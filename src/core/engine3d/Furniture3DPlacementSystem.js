import * as THREE from 'three';
import { FURNITURE_REGISTRY } from '../../features/furniture/furniture.registry.js';
import { FurnitureEngine } from '../furniture/FurnitureEngine.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { VerticalPropagationEngine } from '../vertical/VerticalPropagationEngine.js';
import { SpatialDependencyEngine, RELATIONSHIP_TYPES, globalSpatialDependencyEngine } from '../spatial/SpatialDependencyEngine.js';
import { SpatialHostResolver } from '../spatial/SpatialHostResolver.js';
import { SnapEngine } from '../snap/SnapEngine.js';
import { coreEventBus } from '../EventBus.js';

/**
 * Furniture3DPlacementSystem
 * 
 * Direct Sims 4-Style 3D Placement for:
 * - Furniture & Soft Furnishings (Sofas, Beds, Tables, Chairs, Storage, Wardrobes)
 * - Modular Kitchen (Counters, Islands, Cabinets, Floating Uppers, Sinks, Ranges)
 * - Bathroom & Sanitary (Vanities, Toilets, Showers, Bathtubs, Basins, Fixtures)
 * - Electronics & Appliances (TVs, Fridges, Ovens, Washers, Small Appliances)
 * - All 3D Catalog Models in FURNITURE_REGISTRY
 * 
 * Features:
 * - Real-time 3D Holographic Ghost Preview with Cyan Floor Footprint Perimeter
 * - Stable Center-Anchored Coordinates with Zero-Jump Grab Offset System
 * - Interactive Touch Action Bar with In-Place Smooth 90° Rotation
 * - Multi-Level Elevation Awareness and Precision Grid Snapping
 * - Full Undo/Redo (SnapshotCommand) & 2D/3D Bi-directional Synchronization
 */
export class Furniture3DPlacementSystem {
    constructor(ctx, interactionSystem) {
        this.ctx = ctx;
        this.interactions = interactionSystem;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.activePos = new THREE.Vector3();
        this.activeRotation = 0; // Degrees (0, 90, 180, 270)
        this.activeElevation = 0;
        this.wallCollisionEnabled = true;
        this.wallSnapEnabled = true;
        this.snapMode = 10; // cm default CAD snap

        // Relocation / Move Mode State for existing furniture
        this.isRelocating = false;
        this.relocatingEntity = null;

        // Grab offset: preserves relative distance when user touches/clicks anywhere
        // on the model (beginning, center, end, edge) — preventing reposition jumps
        this._grabOffset = new THREE.Vector3(0, 0, 0);
        this._isGrabbing = false;
        this._isDragging = false;

        // Master Ghost Group in 3D Scene
        this.ghostGroup = new THREE.Group();
        this.ghostGroup.name = 'Sims4_FurniturePlacement_GhostGroup';
        this.ghostGroup.visible = false;
        this.ghostGroup.raycast = () => {};
        this.ctx.scene.add(this.ghostGroup);

        // 1. Model Preview Container
        this.modelPreviewGroup = new THREE.Group();
        this.modelPreviewGroup.raycast = () => {};
        this.ghostGroup.add(this.modelPreviewGroup);

        // 2. Footprint Floor Outline on Ground Plane
        this.footprintMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 2.5,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.footprintMesh = new THREE.LineSegments(new THREE.BufferGeometry(), this.footprintMat);
        this.footprintMesh.renderOrder = 1008;
        this.footprintMesh.raycast = () => {};
        this.footprintMesh.visible = false;
        this.ghostGroup.add(this.footprintMesh);

        // Relative delta tracking for zero-teleport relocation
        this._initialHit = null;
        this._initialPos = null;
        this.initialEntityPosition = null;

        // 3. Create Stable Static DOM HUD Action Bar
        this.createBadgeDOM();

        // Keyboard Controls listener
        this._onKeyDown = (e) => this.handleKeyDown(e);
        window.addEventListener('keydown', this._onKeyDown);

        this._lastPresetHash = '';
        this._isLoadingModel = false;
    }

    createBadgeDOM() {
        this.badgeDom = document.createElement('div');
        this.badgeDom.id = 'sims4-furniture-placement-badge';
        this.badgeDom.style.cssText = `
            position: fixed;
            display: none;
            pointer-events: auto;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.94);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border: 1px solid rgba(0, 240, 255, 0.45);
            box-shadow: 0 14px 36px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 240, 255, 0.2);
            border-radius: 9999px;
            padding: 6px 14px;
            color: #f1f5f9;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 600;
            z-index: 995;
            user-select: none;
            -webkit-user-select: none;
            touch-action: manipulation;
            transition: all 0.15s ease;
        `;

        this.badgeDom.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">
                <!-- Entity Badge -->
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #00f0ff; box-shadow: 0 0 8px #00f0ff;"></span>
                    <span id="furn-ui-title" style="color: #38bdf8; font-weight: 700; font-size: 12px;">Furniture Item</span>
                </div>
                
                <div style="width: 1px; height: 20px; background: rgba(255, 255, 255, 0.15);"></div>

                <!-- Action Coords & Angle -->
                <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #94a3b8;">
                    <label style="display: flex; align-items: center; gap: 2px;">
                        X: <input id="furn-ui-coord-x" type="number" style="width: 44px; background: rgba(0, 0, 0, 0.45); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: #fff; padding: 2px 4px; font-size: 11px; font-weight: 700; text-align: right; outline: none;" step="10" />
                    </label>
                    <label style="display: flex; align-items: center; gap: 2px;">
                        Z: <input id="furn-ui-coord-z" type="number" style="width: 44px; background: rgba(0, 0, 0, 0.45); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: #fff; padding: 2px 4px; font-size: 11px; font-weight: 700; text-align: right; outline: none;" step="10" />
                    </label>
                    <span style="color: #38bdf8; font-weight: 700; margin-left: 2px;">(<span id="furn-ui-rot">0°</span>)</span>
                </div>

                <!-- Precision D-Pad Nudge Steppers -->
                <div style="display: flex; align-items: center; gap: 2px;">
                    <button id="furn-ui-nudge-left" type="button" title="Nudge Left (-X)" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; color: #f1f5f9; font-size: 13px; font-weight: 700; cursor: pointer;">←</button>
                    <button id="furn-ui-nudge-fwd" type="button" title="Nudge Forward (-Z)" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; color: #f1f5f9; font-size: 13px; font-weight: 700; cursor: pointer;">↑</button>
                    <button id="furn-ui-nudge-back" type="button" title="Nudge Backward (+Z)" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; color: #f1f5f9; font-size: 13px; font-weight: 700; cursor: pointer;">↓</button>
                    <button id="furn-ui-nudge-right" type="button" title="Nudge Right (+X)" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; color: #f1f5f9; font-size: 13px; font-weight: 700; cursor: pointer;">→</button>
                </div>

                <div style="width: 1px; height: 20px; background: rgba(255, 255, 255, 0.15);"></div>

                <!-- Snap Mode Pills -->
                <div id="furn-ui-snaps" style="display: flex; align-items: center; gap: 4px;">
                    <button type="button" class="furn-snap-pill" data-snap="0" style="padding: 3px 7px; font-size: 10px; font-weight: 700; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; cursor: pointer;">FREE</button>
                    <button type="button" class="furn-snap-pill" data-snap="1" style="padding: 3px 7px; font-size: 10px; font-weight: 700; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; cursor: pointer;">1cm</button>
                    <button type="button" class="furn-snap-pill active" data-snap="10" style="padding: 3px 7px; font-size: 10px; font-weight: 700; border-radius: 6px; background: rgba(0, 240, 255, 0.2); border: 1px solid rgba(0, 240, 255, 0.5); color: #00f0ff; cursor: pointer;">10cm</button>
                    <button type="button" class="furn-snap-pill" data-snap="50" style="padding: 3px 7px; font-size: 10px; font-weight: 700; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; cursor: pointer;">50cm</button>
                </div>

                <!-- Wall Snap Toggle Button -->
                <button 
                    id="furn-ui-btn-wallsnap" 
                    type="button" 
                    title="Toggle Wall Collision & Magnetic Snap"
                    style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; background: rgba(16, 185, 129, 0.22); border: 1px solid rgba(16, 185, 129, 0.6); color: #34d399; cursor: pointer; transition: all 0.15s ease; white-space: nowrap;"
                >
                    🧲 Wall Snap: <span id="furn-ui-wallsnap-status">ON</span>
                </button>

                <div style="width: 1px; height: 20px; background: rgba(255, 255, 255, 0.15);"></div>

                <!-- Rotate Button -->
                <button id="furn-ui-btn-rot" type="button" title="Rotate (Key: R)" style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #f1f5f9; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer; min-height: 30px;">
                    ↻ Rotate
                </button>

                <!-- Commit & Cancel Buttons -->
                <div style="display: flex; align-items: center; gap: 5px;">
                    <button id="furn-ui-btn-place" type="button" title="Confirm Placement (Key: Enter / Space)" style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: #22c55e; border: none; color: #0f172a; border-radius: 8px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 30px;">
                        ✓ Place
                    </button>
                    <button id="furn-ui-btn-cancel" type="button" title="Cancel Placement (Key: Esc)" style="display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.1); border: none; color: #94a3b8; border-radius: 50%; width: 28px; height: 28px; font-size: 12px; font-weight: 700; cursor: pointer;">
                        ✕
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(this.badgeDom);

        // Cache stable DOM references
        this.elTitle = this.badgeDom.querySelector('#furn-ui-title');
        this.inputX = this.badgeDom.querySelector('#furn-ui-coord-x');
        this.inputZ = this.badgeDom.querySelector('#furn-ui-coord-z');
        this.elRot = this.badgeDom.querySelector('#furn-ui-rot');
        this.btnWallSnap = this.badgeDom.querySelector('#furn-ui-btn-wallsnap');
        this.elWallSnapStatus = this.badgeDom.querySelector('#furn-ui-wallsnap-status');
        this.btnRot = this.badgeDom.querySelector('#furn-ui-btn-rot');
        this.btnPlace = this.badgeDom.querySelector('#furn-ui-btn-place');
        this.btnCancel = this.badgeDom.querySelector('#furn-ui-btn-cancel');

        // Coordinate input handlers
        [this.inputX, this.inputZ].forEach(input => {
            if (!input) return;
            input.addEventListener('pointerdown', (e) => e.stopPropagation());
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('keydown', (e) => e.stopPropagation());
            input.addEventListener('change', () => this._onCoordInputChange());
        });

        // D-Pad Nudge Buttons
        const nudgeButtons = [
            { id: '#furn-ui-nudge-left', dx: -1, dz: 0 },
            { id: '#furn-ui-nudge-fwd', dx: 0, dz: -1 },
            { id: '#furn-ui-nudge-back', dx: 0, dz: 1 },
            { id: '#furn-ui-nudge-right', dx: 1, dz: 0 }
        ];
        nudgeButtons.forEach(({ id, dx, dz }) => {
            const btn = this.badgeDom.querySelector(id);
            if (btn) {
                btn.addEventListener('pointerdown', (e) => e.stopPropagation());
                btn.addEventListener('click', (ev) => {
                    ev.preventDefault(); ev.stopPropagation();
                    this.nudge(dx, dz);
                });
            }
        });

        // Snap Pills
        const pills = this.badgeDom.querySelectorAll('.furn-snap-pill');
        pills.forEach(pill => {
            pill.addEventListener('pointerdown', (e) => e.stopPropagation());
            pill.addEventListener('click', (ev) => {
                ev.preventDefault(); ev.stopPropagation();
                const snapVal = Number(pill.getAttribute('data-snap'));
                this.setSnapMode(snapVal);
            });
        });

        // Wall Snap toggle
        this.btnWallSnap.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnWallSnap.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            this.toggleWallSnap();
        });

        // Rotate button
        this.btnRot.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnRot.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            this.rotateStep(90);
        });

        // Place button
        this.btnPlace.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnPlace.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            this.placeFurniture();
        });

        // Cancel button
        this.btnCancel.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnCancel.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            if (this.isRelocating) {
                this.cancelRelocation();
                return;
            }
            const pl = this.getPlanner();
            if (pl) {
                pl.tool = 'select';
                if (typeof pl.updateToolStates === 'function') pl.updateToolStates();
                pl.syncAll();
            }
            this.hideGhost();
        });
    }

    _onCoordInputChange() {
        if (!this.inputX || !this.inputZ) return;
        let newX = parseFloat(this.inputX.value);
        let newZ = parseFloat(this.inputZ.value);
        if (isNaN(newX)) newX = this.activePos.x;
        if (isNaN(newZ)) newZ = this.activePos.z;

        const planner = this.getPlanner();
        if (planner && (this.wallCollisionEnabled || this.wallSnapEnabled)) {
            const preset = planner.activePresetParams || {};
            const configId = preset.type || preset.id || planner.tool;
            const config = FURNITURE_REGISTRY[configId] || {};
            const w = Number(preset.width) || Number(config.default?.width) || 100;
            const d = Number(preset.depth) || Number(config.default?.depth) || 100;

            const resolved = SnapEngine.resolvePosition({
                x: newX,
                z: newZ,
                rotation: this.activeRotation,
                width: w,
                depth: d
            }, { planner }, {
                enableCollision: this.wallCollisionEnabled !== false,
                enableWallSnap: this.wallSnapEnabled !== false,
                enableWallContour: true,
                enableWallAlign: false,
                snapDistance: 20,
                enableGridSnap: false
            });
            newX = resolved.x;
            newZ = resolved.z;
            this.inputX.value = Math.round(newX);
            this.inputZ.value = Math.round(newZ);
        }

        this.activePos.x = newX;
        this.activePos.z = newZ;
        this.updateGhostTransform();
        if (coreEventBus) {
            coreEventBus.emit('UniversalMoveChanged', {
                x: Math.round(newX),
                z: Math.round(newZ)
            });
        }
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    setSnapMode(snapVal) {
        this.snapMode = Number(snapVal);
        const pills = this.badgeDom.querySelectorAll('.furn-snap-pill');
        pills.forEach(p => {
            const val = Number(p.getAttribute('data-snap'));
            if (val === this.snapMode) {
                p.style.background = 'rgba(0, 240, 255, 0.2)';
                p.style.borderColor = 'rgba(0, 240, 255, 0.5)';
                p.style.color = '#00f0ff';
            } else {
                p.style.background = 'rgba(255, 255, 255, 0.05)';
                p.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                p.style.color = '#94a3b8';
            }
        });
        if (coreEventBus) {
            coreEventBus.emit('UniversalMoveChanged', {
                snapMode: this.snapMode
            });
        }
    }

    toggleWallSnap() {
        this.wallSnapEnabled = !this.wallSnapEnabled;
        this.wallCollisionEnabled = this.wallSnapEnabled;

        if (this.btnWallSnap && this.elWallSnapStatus) {
            this.elWallSnapStatus.textContent = this.wallSnapEnabled ? 'ON' : 'OFF';
            if (this.wallSnapEnabled) {
                this.btnWallSnap.style.background = 'rgba(16, 185, 129, 0.22)';
                this.btnWallSnap.style.borderColor = 'rgba(16, 185, 129, 0.6)';
                this.btnWallSnap.style.color = '#34d399';
            } else {
                this.btnWallSnap.style.background = 'rgba(255, 255, 255, 0.06)';
                this.btnWallSnap.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                this.btnWallSnap.style.color = '#94a3b8';
            }
        }
        if (coreEventBus) {
            coreEventBus.emit('UniversalMoveChanged', {
                wallSnap: this.wallSnapEnabled
            });
        }

        if (this.wallSnapEnabled) {
            const planner = this.getPlanner();
            if (planner) {
                const preset = planner.activePresetParams || {};
                const configId = preset.type || preset.id || planner.tool;
                const config = FURNITURE_REGISTRY[configId] || {};
                const w = Number(preset.width) || Number(config.default?.width) || 100;
                const d = Number(preset.depth) || Number(config.default?.depth) || 100;

                const resolved = SnapEngine.resolvePosition({
                    x: this.activePos.x,
                    z: this.activePos.z,
                    rotation: this.activeRotation,
                    width: w,
                    depth: d
                }, { planner }, {
                    enableCollision: true,
                    enableWallSnap: true,
                    enableWallContour: true,
                    enableWallAlign: false,
                    snapDistance: 20,
                    enableGridSnap: false
                });
                this.activePos.x = resolved.x;
                this.activePos.z = resolved.z;
                this.updateGhostTransform();
                if (this.inputX) this.inputX.value = Math.round(this.activePos.x);
                if (this.inputZ) this.inputZ.value = Math.round(this.activePos.z);
                if (this.ctx && typeof this.ctx.requestRender === 'function') {
                    this.ctx.requestRender();
                }
            }
        }
    }

    isPlacementTool() {
        if (this.isRelocating) return true;
        const planner = this.getPlanner();
        if (!planner) return false;
        const tool = planner.tool;
        if (!tool || tool === 'select' || tool === 'pan') return false;

        const preset = planner.activePresetParams || {};
        const configId = preset.type || preset.id || tool;

        return tool === 'furniture' ||
               tool === 'kitchen' ||
               tool === 'bathroom' ||
               tool === 'electronics' ||
               tool.startsWith('furniture_') ||
               tool.startsWith('kitchen_') ||
               tool.startsWith('bathroom_') ||
               tool.startsWith('sanitary_') ||
               tool.startsWith('electronics_') ||
               !!FURNITURE_REGISTRY[configId] ||
               !!FURNITURE_REGISTRY[tool];
    }

    getPlanner() {
        return this.ctx.planner || window.planner?.value || window.planner || (this.ctx.appState && this.ctx.appState.planner);
    }

    getActiveElevation() {
        const planner = this.getPlanner();
        if (!planner) return 0;
        if (planner.activeLevelIndex !== undefined && planner.levels && planner.levels[planner.activeLevelIndex]) {
            return Number(planner.levels[planner.activeLevelIndex].elevation) || 0;
        }
        return 0;
    }

    isTouchDevice() {
        return typeof window !== 'undefined' && (window.innerWidth <= 768 || (('ontouchstart' in window) && (navigator.maxTouchPoints > 1) && window.innerWidth <= 1024));
    }

    rotateStep(deltaDeg) {
        this.activeRotation = (this.activeRotation + deltaDeg + 360) % 360;

        // Re-resolve Wall Collision & Wall Snap with the new orientation
        const planner = this.getPlanner();
        if (planner && (this.wallCollisionEnabled || this.wallSnapEnabled)) {
            const preset = planner.activePresetParams || {};
            const configId = preset.type || preset.id || planner.tool;
            const config = FURNITURE_REGISTRY[configId] || {};
            const w = Number(preset.width) || Number(config.default?.width) || 100;
            const d = Number(preset.depth) || Number(config.default?.depth) || 100;

            const resolved = SnapEngine.resolvePosition({
                x: this.activePos.x,
                z: this.activePos.z,
                rotation: this.activeRotation,
                width: w,
                depth: d
            }, { planner }, {
                enableCollision: this.wallCollisionEnabled !== false,
                enableWallSnap: this.wallSnapEnabled !== false,
                enableWallContour: true,
                enableWallAlign: false,
                snapDistance: 20,
                enableGridSnap: false
            });
            this.activePos.x = resolved.x;
            this.activePos.z = resolved.z;
        }

        this.updateGhostTransform();
        if (this.elRot) this.elRot.textContent = `${this.activeRotation % 360}°`;
        if (this.inputX && document.activeElement !== this.inputX) this.inputX.value = Math.round(this.activePos.x);
        if (this.inputZ && document.activeElement !== this.inputZ) this.inputZ.value = Math.round(this.activePos.z);
        if (coreEventBus) {
            coreEventBus.emit('UniversalMoveChanged', {
                rotation: this.activeRotation,
                x: Math.round(this.activePos.x),
                z: Math.round(this.activePos.z)
            });
        }
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    nudge(dirX, dirZ) {
        const step = this.snapMode === 0 ? 10 : (this.snapMode || 10);
        let newX = this.activePos.x + dirX * step;
        let newZ = this.activePos.z + dirZ * step;

        const planner = this.getPlanner();
        const preset = this.isRelocating ? (this.relocatingEntity || {}) : (planner?.activePresetParams || {});
        const elev = this.getActiveElevation();

        if (planner && (this.wallCollisionEnabled || this.wallSnapEnabled)) {
            const configId = preset.type || preset.id || planner.tool;
            const config = FURNITURE_REGISTRY[configId] || {};
            const w = Number(preset.width) || Number(config.default?.width) || 100;
            const d = Number(preset.depth) || Number(config.default?.depth) || 100;

            const resolved = SnapEngine.resolvePosition({
                x: newX,
                z: newZ,
                rotation: this.activeRotation,
                width: w,
                depth: d
            }, { planner }, {
                enableCollision: this.wallCollisionEnabled !== false,
                enableWallSnap: this.wallSnapEnabled !== false,
                enableWallContour: true,
                enableWallAlign: false,
                snapDistance: 20,
                enableGridSnap: false
            });
            newX = resolved.x;
            newZ = resolved.z;
        }

        this.activePos.set(newX, elev, newZ);
        this.updateGhostModel(preset, newX, elev, newZ, this.activeRotation);
        this.updateBadgeContent();

        if (coreEventBus) {
            coreEventBus.emit('UniversalMoveChanged', {
                x: Math.round(newX),
                z: Math.round(newZ),
                rotation: this.activeRotation,
                wallSnap: this.wallSnapEnabled,
                snapMode: this.snapMode
            });
        }

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    setCoordinates(x, z) {
        const newX = isNaN(x) ? this.activePos.x : Number(x);
        const newZ = isNaN(z) ? this.activePos.z : Number(z);
        this.activePos.set(newX, this.activeElevation, newZ);
        const preset = this.isRelocating ? (this.relocatingEntity || {}) : (this.getPlanner()?.activePresetParams || {});
        this.updateGhostModel(preset, newX, this.activeElevation, newZ, this.activeRotation);
        this.updateBadgeContent();
        if (coreEventBus) {
            coreEventBus.emit('UniversalMoveChanged', {
                x: Math.round(newX),
                z: Math.round(newZ),
                rotation: this.activeRotation,
                wallSnap: this.wallSnapEnabled,
                snapMode: this.snapMode
            });
        }
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    handleKeyDown(e) {
        if (!this.isPlacementTool()) return;
        if (this.ctx.viewMode3D === 'preview') return;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

        if (e.key === 'r' || e.key === 'R' || e.key === ']' || e.key === '.' || e.key === 'ArrowRight') {
            const step = (e.shiftKey) ? -90 : 90;
            this.rotateStep(step);
            e.preventDefault();
        } else if (e.key === '[' || e.key === ',' || e.key === 'ArrowLeft') {
            this.rotateStep(-90);
            e.preventDefault();
        } else if (e.key === 'Escape') {
            if (this.isRelocating) {
                this.cancelRelocation();
                e.preventDefault();
                return;
            }
            const planner = this.getPlanner();
            if (planner) {
                planner.tool = 'select';
                if (typeof planner.updateToolStates === 'function') planner.updateToolStates();
                planner.syncAll();
            }
            this.hideGhost();
            e.preventDefault();
        }
    }

    _raycastFloor(e) {
        const dom = this.ctx.renderer.domElement;
        const rect = dom.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            return null;
        }
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        const elev = this.getActiveElevation();
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elev);
        const hitPoint = new THREE.Vector3();
        if (!this.raycaster.ray.intersectPlane(floorPlane, hitPoint)) return null;

        const isFine = e.shiftKey;
        const gridStep = this.snapMode === 0 || isFine ? 1 : this.snapMode;
        const snapped = SnapEngine.snapToGrid({ x: hitPoint.x, z: hitPoint.z }, gridStep);
        const snappedX = snapped.x !== undefined ? snapped.x : hitPoint.x;
        const snappedZ = snapped.z !== undefined ? snapped.z : hitPoint.z;

        const planner = this.getPlanner();
        let targetElev = elev;
        let hostPlatformId = null;
        if (planner && planner.platforms) {
            for (const p of planner.platforms) {
                if (VerticalPropagationEngine.isPointInPlatform(snappedX, snappedZ, p)) {
                    const pTop = (Number(p.elevation) || 0) + (Number(p.height) > 0 ? Number(p.height) : 0);
                    targetElev = pTop;
                    hostPlatformId = p.id;
                    break;
                }
            }
        }

        return {
            x: snappedX,
            z: snappedZ,
            elev: targetElev,
            hostPlatformId
        };
    }

    _isHitOnGhost(floorPoint, margin = 25) {
        if (!floorPoint || !this.ghostGroup.visible) return false;
        const dx = floorPoint.x - this.activePos.x;
        const dz = floorPoint.z - this.activePos.z;
        const rotY = -this.activeRotation * Math.PI / 180;
        const cosR = Math.cos(-rotY);
        const sinR = Math.sin(-rotY);
        const localX = dx * cosR + dz * sinR;
        const localZ = -dx * sinR + dz * cosR;

        const minX = (this._localBounds?.minX ?? -50) - margin;
        const maxX = (this._localBounds?.maxX ?? 50) + margin;
        const minZ = (this._localBounds?.minZ ?? -50) - margin;
        const maxZ = (this._localBounds?.maxZ ?? 50) + margin;

        return localX >= minX && localX <= maxX && localZ >= minZ && localZ <= maxZ;
    }

    onPointerMove(e) {
        if (!this.isPlacementTool()) {
            this.hideGhost();
            return false;
        }

        // Check for Right-Click or Middle-Click Drag for Free Camera Orbit
        const isRightClick = (e.buttons & 2) !== 0 || e.button === 2;
        const isMiddleClick = (e.buttons & 4) !== 0 || e.button === 1;
        if (isRightClick || isMiddleClick) {
            if (this.ctx && this.ctx.controls) {
                this.ctx.controls.enableRotate = true;
            }
            return false;
        }

        const isTouch = e.pointerType === 'touch' || (e.pointerType !== 'mouse' && this.isTouchDevice());
        // Multi-touch gestures (pinch-to-zoom / 2-finger orbit) pass through to OrbitControls
        if (isTouch && e.touches && e.touches.length >= 2) {
            if (this.ctx && this.ctx.controls) {
                this.ctx.controls.enableRotate = true;
            }
            return false;
        }

        const floor = this._raycastFloor(e);
        if (!floor) {
            this.hideGhost();
            return false;
        }

        const dom = this.ctx?.renderer?.domElement;
        const planner = this.getPlanner();
        const preset = this.isRelocating ? (this.relocatingEntity || {}) : (planner?.activePresetParams || {});

        if (this.isRelocating) {
            if (!this._isDragging) {
                if (this._isHitOnGhost(floor, 25)) {
                    if (dom) dom.style.cursor = 'grab';
                } else {
                    if (dom) dom.style.cursor = 'auto';
                }
                if (this.ctx && this.ctx.controls) {
                    this.ctx.controls.enableRotate = true;
                }
                return false;
            }

            // Actively dragging in relocation mode
            if (this.ctx && this.ctx.controls) {
                this.ctx.controls.enableRotate = false;
            }
            if (dom) dom.style.cursor = 'grabbing';

            let worldX = floor.x - this._grabOffset.x;
            let worldZ = floor.z - this._grabOffset.z;

            // Resolve Wall Collision & Wall Snap
            if (planner && (this.wallCollisionEnabled || this.wallSnapEnabled)) {
                const configId = preset.type || preset.id || planner.tool;
                const config = FURNITURE_REGISTRY[configId] || {};
                const w = Number(preset.width) || Number(config.default?.width) || 100;
                const d = Number(preset.depth) || Number(config.default?.depth) || 100;

                const resolved = SnapEngine.resolvePosition({
                    x: worldX,
                    z: worldZ,
                    rotation: this.activeRotation,
                    width: w,
                    depth: d
                }, { planner }, {
                    enableCollision: this.wallCollisionEnabled !== false,
                    enableWallSnap: this.wallSnapEnabled !== false,
                    enableWallContour: true,
                    enableWallAlign: false,
                    snapDistance: 20,
                    enableGridSnap: false
                });
                worldX = resolved.x;
                worldZ = resolved.z;
            }

            this.activePos.set(worldX, floor.elev, worldZ);
            this.activeElevation = floor.elev;
            this._lastHostPlatformId = floor.hostPlatformId || null;

            // Update Ghost 3D Mesh
            this.updateGhostModel(preset, worldX, floor.elev, worldZ, this.activeRotation);

            // Update HUD Badge Information
            this.updateBadgeContent(e);

            if (coreEventBus) {
                coreEventBus.emit('InteractionStateChanged', {
                    state: 'ACTION_ACTIVE',
                    activeAction: 'move',
                    hudMode: 'action_minimal',
                    selectedEntity: {
                        type: 'furniture',
                        name: preset.name || preset.type || 'Furniture'
                    }
                });
                coreEventBus.emit('UniversalMoveChanged', {
                    x: Math.round(worldX),
                    z: Math.round(worldZ),
                    rotation: this.activeRotation,
                    wallSnap: this.wallSnapEnabled,
                    snapMode: this.snapMode
                });
            }

            if (this.ctx && typeof this.ctx.requestRender === 'function') {
                this.ctx.requestRender();
            }
            return true;
        }

        // Initial Placement Mode (from side nav)
        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = false;
        }
        if (dom) dom.style.cursor = 'move';

        let worldX = floor.x + this._grabOffset.x;
        let worldZ = floor.z + this._grabOffset.z;

        // Resolve Wall Collision & Wall Snap
        if (planner && (this.wallCollisionEnabled || this.wallSnapEnabled)) {
            const configId = preset.type || preset.id || planner.tool;
            const config = FURNITURE_REGISTRY[configId] || {};
            const w = Number(preset.width) || Number(config.default?.width) || 100;
            const d = Number(preset.depth) || Number(config.default?.depth) || 100;

            const resolved = SnapEngine.resolvePosition({
                x: worldX,
                z: worldZ,
                rotation: this.activeRotation,
                width: w,
                depth: d
            }, { planner }, {
                enableCollision: this.wallCollisionEnabled !== false,
                enableWallSnap: this.wallSnapEnabled !== false,
                enableWallContour: true,
                enableWallAlign: false,
                snapDistance: 20,
                enableGridSnap: false
            });
            worldX = resolved.x;
            worldZ = resolved.z;
        }

        this.activePos.set(worldX, floor.elev, worldZ);
        this.activeElevation = floor.elev;
        this._lastHostPlatformId = floor.hostPlatformId || null;

        // Update Ghost 3D Mesh
        this.updateGhostModel(preset, worldX, floor.elev, worldZ, this.activeRotation);

        // Update HUD Badge Information
        this.updateBadgeContent(e);

        if (coreEventBus) {
            coreEventBus.emit('InteractionStateChanged', {
                state: 'ACTION_ACTIVE',
                activeAction: 'place',
                hudMode: 'action_minimal',
                selectedEntity: {
                    type: 'furniture',
                    name: preset.name || preset.type || 'Furniture'
                }
            });
            coreEventBus.emit('UniversalMoveChanged', {
                x: Math.round(worldX),
                z: Math.round(worldZ),
                rotation: this.activeRotation,
                wallSnap: this.wallSnapEnabled,
                snapMode: this.snapMode
            });
        }

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
        return true;
    }

    updateBadgeContent(pointerEvent = null) {
        const planner = this.getPlanner();
        if (!planner) return;

        const preset = planner.activePresetParams || {};
        const configId = preset.type || preset.id || planner.tool;
        const config = FURNITURE_REGISTRY[configId] || {};
        const title = preset.name || config.label || 'Furniture Item';

        if (this.elTitle) this.elTitle.textContent = title;
        if (this.elRot) this.elRot.textContent = `${this.activeRotation % 360}°`;
        if (this.inputX && document.activeElement !== this.inputX) {
            this.inputX.value = Math.round(this.activePos.x);
        }
        if (this.inputZ && document.activeElement !== this.inputZ) {
            this.inputZ.value = Math.round(this.activePos.z);
        }

        const isMobileScreen = this.isTouchDevice();
        this.badgeDom.style.left = '50%';
        this.badgeDom.style.top = 'auto';
        this.badgeDom.style.bottom = isMobileScreen ? '64px' : '24px';
        this.badgeDom.style.transform = 'translateX(-50%)';

        this.badgeDom.style.display = 'none';
    }

    updateGhostTransform() {
        this.ghostGroup.position.copy(this.activePos);
        this.ghostGroup.rotation.y = -this.activeRotation * Math.PI / 180;
    }

    async updateGhostModel(preset, worldX, elev, worldZ, rotation) {
        this.ghostGroup.position.set(worldX, elev, worldZ);
        this.ghostGroup.rotation.y = -rotation * Math.PI / 180;
        this.ghostGroup.visible = true;

        const planner = this.getPlanner();
        const configId = preset.type || preset.id || planner?.tool;
        const hash = `${configId}_${preset.width}_${preset.depth}_${preset.height}`;

        if (this._lastPresetHash !== hash) {
            this._lastPresetHash = hash;

            // Clear previous 3D model preview
            while (this.modelPreviewGroup.children.length > 0) {
                const child = this.modelPreviewGroup.children[0];
                this.modelPreviewGroup.remove(child);
            }

            const config = FURNITURE_REGISTRY[configId] || {};
            const itemW = Number(preset.width) || Number(config.default?.width) || 100;
            const itemD = Number(preset.depth) || Number(config.default?.depth) || 100;
            const itemH = Number(preset.height) || Number(config.default?.height) || 80;

            const fakeEntity = {
                id: 'ghost_preview',
                type: 'furniture',
                configId: configId,
                config: config,
                width: itemW,
                depth: itemD,
                height: itemH,
                elevation: 0,
                rotation: 0,
                x: 0,
                y: 0,
                ...JSON.parse(JSON.stringify(preset))
            };

            const tempContainer = new THREE.Group();
            
            if (this.ctx.furnitureManager && this.ctx.furnitureManager.load) {
                try {
                    await this.ctx.furnitureManager.load(fakeEntity, tempContainer);
                } catch (err) {
                    console.warn('[Furniture3DPlacementSystem] Error loading preview model:', err);
                }
            }

            // Hide bounding hitboxes and apply glowing holographic highlight to real 3D geometry
            tempContainer.traverse(c => {
                c.raycast = () => {};
                if (c.isMesh) {
                    if (c.userData?.isHitbox || (c.material && c.material.visible === false)) {
                        c.visible = false;
                        return;
                    }

                    // Apply Sims 4 glowing cyan holographic highlight to actual 3D model meshes
                    if (Array.isArray(c.material)) {
                        c.material = c.material.map(m => {
                            const gm = m.clone ? m.clone() : m;
                            if (gm.emissive) {
                                gm.emissive.setHex(0x0284c7);
                                gm.emissiveIntensity = 0.5;
                            }
                            gm.transparent = true;
                            gm.opacity = 0.88;
                            return gm;
                        });
                    } else if (c.material) {
                        const gm = c.material.clone ? c.material.clone() : c.material;
                        if (gm.emissive) {
                            gm.emissive.setHex(0x0284c7);
                            gm.emissiveIntensity = 0.5;
                        }
                        gm.transparent = true;
                        gm.opacity = 0.88;
                        c.material = gm;
                    }
                }
            });
            tempContainer.raycast = () => {};

            this.modelPreviewGroup.add(tempContainer);

            this._localBounds = {
                minX: -itemW / 2,
                maxX: itemW / 2,
                minZ: -itemD / 2,
                maxZ: itemD / 2
            };

            // Build Footprint Floor Rectangle
            this.updateFootprintGeometry(itemW, itemD);

            if (this.ctx && typeof this.ctx.requestRender === 'function') {
                this.ctx.requestRender();
            }
        }
    }

    updateFootprintGeometry(width, depth) {
        // Floating wireframe footprint removed as per user requirement
        if (this.footprintMesh) {
            this.footprintMesh.visible = false;
        }
    }

    onPointerDown(e) {
        if (!this.isPlacementTool()) return false;

        const isRightClick = (e.buttons & 2) !== 0 || e.button === 2;
        const isMiddleClick = (e.buttons & 4) !== 0 || e.button === 1;
        if (isRightClick || isMiddleClick) {
            if (this.ctx && this.ctx.controls) {
                this.ctx.controls.enableRotate = true;
            }
            return false;
        }

        const isTouch = e.pointerType === 'touch' || (e.pointerType !== 'mouse' && this.isTouchDevice());
        if (isTouch && e.touches && e.touches.length >= 2) {
            if (this.ctx && this.ctx.controls) {
                this.ctx.controls.enableRotate = true;
            }
            return false;
        }

        const floor = this._raycastFloor(e);
        if (!floor) return false;

        if (this.isRelocating) {
            // Relocation / Move mode: drag only when interacting with the object footprint
            if (this._isHitOnGhost(floor, isTouch ? 35 : 25)) {
                this._isDragging = true;
                this._grabOffset.set(floor.x - this.activePos.x, 0, floor.z - this.activePos.z);
                if (this.ctx && this.ctx.controls) {
                    this.ctx.controls.enableRotate = false;
                }
                const dom = this.ctx.renderer?.domElement;
                if (dom) dom.style.cursor = 'grabbing';
                return true;
            } else {
                // Clicking/touching outside the object: let OrbitControls rotate/pan freely!
                this._isDragging = false;
                if (this.ctx && this.ctx.controls) {
                    this.ctx.controls.enableRotate = true;
                }
                return false;
            }
        }

        // Initial Placement Mode (from side nav):
        if (this.ghostGroup.visible) {
            if (!isTouch && e.button === 0) {
                return this.placeFurniture();
            }
            return true;
        }

        // Ghost not visible yet — first interaction initializes position
        this.activeElevation = floor.elev;
        this._grabOffset.set(0, 0, 0);
        this._isGrabbing = false;
        let startX = floor.x;
        let startZ = floor.z;
        const planner = this.getPlanner();
        const preset = planner?.activePresetParams || {};

        if (planner && (this.wallCollisionEnabled || this.wallSnapEnabled)) {
            const configId = preset.type || preset.id || planner.tool;
            const config = FURNITURE_REGISTRY[configId] || {};
            const w = Number(preset.width) || Number(config.default?.width) || 100;
            const d = Number(preset.depth) || Number(config.default?.depth) || 100;

            const resolved = SnapEngine.resolvePosition({
                x: startX,
                z: startZ,
                rotation: this.activeRotation,
                width: w,
                depth: d
            }, { planner }, {
                enableCollision: this.wallCollisionEnabled !== false,
                enableWallSnap: this.wallSnapEnabled !== false,
                enableWallContour: true,
                enableWallAlign: false,
                snapDistance: 20,
                enableGridSnap: false
            });
            startX = resolved.x;
            startZ = resolved.z;
        }

        this.activePos.set(startX, floor.elev, startZ);
        this.updateGhostModel(preset, startX, floor.elev, startZ, this.activeRotation);
        this.updateBadgeContent(e);
        if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();

        if (!isTouch && e.button === 0) {
            return this.placeFurniture();
        }
        return true;
    }

    onPointerUp(e) {
        if (!this.isPlacementTool()) return false;
        if (this.isRelocating) {
            if (this._isDragging) {
                this._isDragging = false;
                if (this.ctx && this.ctx.controls) {
                    this.ctx.controls.enableRotate = true;
                }
                const dom = this.ctx.renderer?.domElement;
                if (dom) dom.style.cursor = 'grab';
                return true;
            }
        }
        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = true;
        }
        return false;
    }

    placeFurniture() {
        if (!this.isPlacementTool()) return false;

        const planner = this.getPlanner();
        if (!planner) return false;

        const preset = planner.activePresetParams || {};
        const configId = preset.type || preset.id || planner.tool;

        // 1. Record Snapshot Command for Full Undo/Redo
        let snapshotCmd = null;
        if (planner.commandManager) {
            snapshotCmd = new SnapshotCommand(planner);
        }

        let localTransform = null;
        let hostEntity = null;
        let hostType = null;
        let relationshipType = null;

        const hostRes = SpatialHostResolver.findHostAt(planner, this.activePos.x, this.activePos.z, 'furniture', {
            rotation: this.activeRotation,
            elevation: this.activeElevation
        });

        if (hostRes && hostRes.host) {
            hostEntity = hostRes.host;
            hostType = hostRes.hostType;
            relationshipType = hostRes.relationshipType;
            localTransform = hostRes.localTransform;
        } else if (this._lastHostPlatformId && planner.platforms) {
            hostEntity = planner.platforms.find(p => p.id === this._lastHostPlatformId);
            if (hostEntity) {
                hostType = 'platform';
                relationshipType = RELATIONSHIP_TYPES.SURFACE_ATTACHED;
                const hostTransform = SpatialDependencyEngine.getEntityTransform(hostEntity);
                const furnWorld = {
                    x: this.activePos.x,
                    y: this.activePos.z,
                    elevation: this.activeElevation + (Number(preset.elevation) || 0),
                    rotation: this.activeRotation
                };
                localTransform = SpatialDependencyEngine.computeLocalTransform(furnWorld, hostTransform);
            }
        }

        let resultingFurn = null;

        if (this.isRelocating && this.relocatingEntity) {
            const furn = this.relocatingEntity;
            const updatePayload = {
                x: this.activePos.x,
                y: this.activePos.z,
                elevation: this.activeElevation + (Number(preset.elevation) || 0),
                rotation: this.activeRotation,
                hostPlatformId: hostType === 'platform' ? hostEntity.id : undefined,
                parentWallId: hostType === 'wall' ? hostEntity.id : undefined,
                hostId: hostEntity ? hostEntity.id : undefined,
                hostType: hostType || undefined,
                relationshipType: relationshipType || undefined,
                localTransform: localTransform || undefined,
                relativeElevation: localTransform ? localTransform.elevation : (this._lastHostPlatformId ? (Number(preset.elevation) || 0) : undefined)
            };
            FurnitureEngine.batchUpdate(planner, furn, updatePayload);

            if (furn.mesh3D) {
                furn.mesh3D.visible = true;
            }

            if (hostEntity) {
                globalSpatialDependencyEngine.attach(furn, hostEntity, {
                    relationshipType: relationshipType || RELATIONSHIP_TYPES.SURFACE_ATTACHED,
                    localTransform: localTransform
                });
            }

            this.isRelocating = false;
            this.relocatingEntity = null;
            resultingFurn = furn;
        } else {
            resultingFurn = FurnitureEngine.createFurniture(planner, {
                x: this.activePos.x,
                y: this.activePos.z,
                configId,
                width: preset.width ? Number(preset.width) : undefined,
                depth: preset.depth ? Number(preset.depth) : undefined,
                height: preset.height ? Number(preset.height) : undefined,
                elevation: this.activeElevation + (Number(preset.elevation) || 0),
                rotation: this.activeRotation,
                hostPlatformId: hostType === 'platform' ? hostEntity.id : undefined,
                parentWallId: hostType === 'wall' ? hostEntity.id : undefined,
                hostId: hostEntity ? hostEntity.id : undefined,
                hostType: hostType || undefined,
                relationshipType: relationshipType || undefined,
                localTransform: localTransform || undefined,
                relativeElevation: localTransform ? localTransform.elevation : (this._lastHostPlatformId ? (Number(preset.elevation) || 0) : undefined),
                materials: preset.materials ? JSON.parse(JSON.stringify(preset.materials)) : undefined,
                addToPlanner: true
            });

            if (resultingFurn && hostEntity) {
                globalSpatialDependencyEngine.attach(resultingFurn, hostEntity, {
                    relationshipType: relationshipType || RELATIONSHIP_TYPES.SURFACE_ATTACHED,
                    localTransform: localTransform
                });
            }
        }

        // 3. Finalize Undo Command
        if (snapshotCmd && snapshotCmd.finalize() && planner.commandManager) {
            planner.commandManager.execute(snapshotCmd);
        }

        // 4. In-Place CAD 3D Scene Rebuild
        if (this.ctx.buildScene && planner) {
            const levelsConfigArray = (planner.levels || []).map(l => ({ data: l.data, isVisible: l.isVisible !== false }));
            this.ctx.buildScene(
                planner.walls,
                planner.rooms,
                planner.stairs || [],
                planner.furniture || [],
                planner.roofs || [],
                planner.shapes || [],
                levelsConfigArray,
                planner.activeLevelIndex || 0,
                this.ctx.viewMode3D || 'full-edit',
                true, // Preserve camera zoom and orientation
                planner.outdoorZones || []
            );
        }

        // 5. Select Placed Furniture in 3D Scene
        if (resultingFurn?.mesh3D && typeof this.interactions?.selectObject === 'function') {
            resultingFurn.mesh3D.updateWorldMatrix(true, true);
            this.interactions.selectObject(resultingFurn.mesh3D, null, true);
        }

        // 6. Reset tool and sync
        planner.tool = 'select';
        if (typeof planner.updateToolStates === 'function') planner.updateToolStates();
        planner.syncAll();

        this.hideGhost();

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender('Furniture 3D Placement Complete', 5);
        }

        return true;
    }

    hideGhost() {
        this._initialHit = null;
        this._initialPos = null;
        if (this.ghostGroup) this.ghostGroup.visible = false;
        if (this.footprintMesh) this.footprintMesh.visible = false;
        if (this.badgeDom) this.badgeDom.style.display = 'none';
        this._grabOffset.set(0, 0, 0);
        this._isGrabbing = false;
        if (coreEventBus) {
            coreEventBus.emit('InteractionStateChanged', {
                state: 'IDLE',
                activeAction: null,
                hudMode: 'none',
                selectedEntity: null
            });
        }
        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = true;
        }
        if (this.ctx?.renderer?.domElement) {
            this.ctx.renderer.domElement.style.cursor = 'auto';
        }
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    startRelocate(furnitureEntity) {
        this.startRelocation(furnitureEntity);
    }

    startRelocation(furnitureEntity) {
        if (!furnitureEntity) return;
        this.isRelocating = true;
        this.relocatingEntity = furnitureEntity;
        this._initialHit = null;

        // Hide original mesh during relocation preview
        if (furnitureEntity.mesh3D) {
            furnitureEntity.mesh3D.visible = false;
        }

        this.initialEntityPosition = {
            x: Number(furnitureEntity.x) || 0,
            y: Number(furnitureEntity.y) || 0,
            rotation: Number(furnitureEntity.rotation) || 0,
            elevation: Number(furnitureEntity.elevation) || 0
        };

        const elev = furnitureEntity.elevation !== undefined ? Number(furnitureEntity.elevation) : this.getActiveElevation();
        this.activeElevation = elev;
        this.activeRotation = Number(furnitureEntity.rotation) || 0;

        const worldX = Number(furnitureEntity.x) || 0;
        const worldZ = Number(furnitureEntity.y) || 0;

        this.activePos.set(worldX, elev, worldZ);
        this._initialPos = this.activePos.clone();
        this._initialHit = null;
        this._grabOffset.set(0, 0, 0);
        this._isGrabbing = false;
        this._isDragging = false;

        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = true;
        }
        if (this.ctx?.renderer?.domElement) {
            this.ctx.renderer.domElement.style.cursor = 'grab';
        }

        const preset = {
            id: furnitureEntity.configId || furnitureEntity.type,
            type: furnitureEntity.configId || furnitureEntity.type,
            name: furnitureEntity.config?.label || furnitureEntity.name || 'Furniture Item',
            width: furnitureEntity.width,
            depth: furnitureEntity.depth,
            height: furnitureEntity.height,
            elevation: 0,
            materials: furnitureEntity.materials
        };

        const planner = this.getPlanner();
        if (planner) {
            planner.activePresetParams = preset;
        }

        this._lastPresetHash = '';
        this.updateGhostModel(preset, worldX, elev, worldZ, this.activeRotation);
        this.updateBadgeContent();

        if (coreEventBus) {
            coreEventBus.emit('InteractionStateChanged', {
                state: 'ACTION_ACTIVE',
                activeAction: 'move',
                hudMode: 'action_minimal',
                selectedEntity: furnitureEntity
            });
            coreEventBus.emit('UniversalMoveChanged', {
                x: Math.round(worldX),
                z: Math.round(worldZ),
                rotation: this.activeRotation,
                wallSnap: this.wallSnapEnabled,
                snapMode: this.snapMode
            });
        }

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender('furniture_start_relocate');
        }
    }

    cancelRelocation() {
        if (this.isRelocating) {
            if (this.relocatingEntity) {
                if (this.initialEntityPosition) {
                    this.relocatingEntity.x = this.initialEntityPosition.x;
                    this.relocatingEntity.y = this.initialEntityPosition.y;
                    this.relocatingEntity.rotation = this.initialEntityPosition.rotation;
                    this.relocatingEntity.elevation = this.initialEntityPosition.elevation;
                }
                if (this.relocatingEntity.mesh3D) {
                    this.relocatingEntity.mesh3D.visible = true;
                }
            }
            this.isRelocating = false;
            this.relocatingEntity = null;
            this._initialHit = null;
            this._initialPos = null;
            this._isDragging = false;
            if (this.ctx && this.ctx.controls) {
                this.ctx.controls.enableRotate = true;
            }
            this.hideGhost();
            if (this.ctx && typeof this.ctx.requestRender === 'function') {
                this.ctx.requestRender();
            }
        }
    }

    dispose() {
        if (this._onKeyDown) {
            window.removeEventListener('keydown', this._onKeyDown);
        }
        if (this.badgeDom && this.badgeDom.parentNode) {
            this.badgeDom.parentNode.removeChild(this.badgeDom);
        }
        if (this.ghostGroup && this.ctx.scene) {
            this.ctx.scene.remove(this.ghostGroup);
        }
    }
}

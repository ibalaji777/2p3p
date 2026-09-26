import * as THREE from 'three';
import { WALL_HEIGHT } from '../constants/units.js';
import { Stair3DBuilder } from '../../features/stairs/stairs.renderer3d.js';
import { StairEngine } from '../stairs/StairEngine.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { StairHeightDetector } from '../../features/stairs/StairHeightDetector.js';
import { SpatialDependencyEngine, RELATIONSHIP_TYPES, globalSpatialDependencyEngine } from '../spatial/SpatialDependencyEngine.js';
import { SnapEngine } from '../snap/SnapEngine.js';
import { coreEventBus } from '../EventBus.js';

/**
 * Stair3DPlacementSystem
 * 
 * Direct Sims 4-Style 3D Staircase Placement & Real-Time Ghost/Footprint Highlighting.
 * 
 * COORDINATE ARCHITECTURE:
 * ========================
 * PremiumStaircase defines (stair.x, stair.y) as the origin of the staircase = Step 1 base edge.
 * In 3D, x maps to X and y maps to Z. Geometry extends along local +Z from the origin.
 * 
 * For intuitive placement, the ghost preview is CENTER-ANCHORED:
 * - The 3D bounding box center of the staircase geometry is computed as (cx, 0, cz).
 * - The model preview, footprint lines, and arrow are shifted by (-cx, 0, -cz) so
 *   the cursor/finger always sits at the visual center of the staircase.
 * - On placement, the center offset is rotated back and subtracted to compute the
 *   true PremiumStaircase origin (stair.x, stair.y).
 * 
 * This ensures:
 * 1. Ghost stays centered under cursor at all times (no asymmetric offset).
 * 2. Clicking to place does not jump or reposition.
 * 3. Placed staircase matches ghost preview with pixel precision.
 */
export class Stair3DPlacementSystem {
    constructor(ctx, interactionSystem) {
        this.ctx = ctx;
        this.interactions = interactionSystem;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.activePos = new THREE.Vector3();   // World position of the ghost center
        this.activeRotation = 0;                // Degrees (0, 90, 180, 270)
        this.activeElevation = 0;
        this.activeTurnDirection = 'right';
        this.wallCollisionEnabled = true;
        this.wallSnapEnabled = true;
        this.snapMode = 10;
        
        // Center offset in LOCAL (unrotated) space: the vector from staircase origin to its bounding box center.
        // Used to shift the ghost so the cursor sits at the geometric center.
        this.localCenterOffset = new THREE.Vector3(0, 0, 0);
        
        // Grab offset: the delta between the ghost center and the cursor floor point at the moment
        // the user re-engages (touches/clicks). This preserves the relative position so the
        // staircase doesn't jump when the user touches its edge, beginning, or end.
        this._grabOffset = new THREE.Vector3(0, 0, 0);
        this._isGrabbing = false;
        this._isDragging = false;

        this.stairBuilder = new Stair3DBuilder(ctx.assets, [], ctx.helpers);

        // Sims 4 Dynamic Height Auto-Detection State
        this.autoHeightEnabled = true;
        this.lastDetection = null;

        // Relocation / Move Mode State for existing staircases
        this.isRelocating = false;
        this.relocatingEntity = null;

        // Master Ghost Group in 3D Scene — positioned at cursor = visual center
        this.ghostGroup = new THREE.Group();
        this.ghostGroup.name = 'Sims4_StairPlacement_GhostGroup';
        this.ghostGroup.visible = false;
        this.ghostGroup.raycast = () => {};
        this.ctx.scene.add(this.ghostGroup);

        // 1. Live 3D Model Preview Container — shifted by -centerOffset inside ghostGroup
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

        // 3. Glowing Edge Snap Guideline in 3D Scene
        this.snapGuideMat = new THREE.LineBasicMaterial({
            color: 0x10b981,
            linewidth: 3,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.snapGuideMesh = new THREE.LineSegments(new THREE.BufferGeometry(), this.snapGuideMat);
        this.snapGuideMesh.name = 'Sims4_StairPlacement_SnapGuide';
        this.snapGuideMesh.renderOrder = 1010;
        this.snapGuideMesh.raycast = () => {};
        this.snapGuideMesh.visible = false;
        if (this.ctx.scene) this.ctx.scene.add(this.snapGuideMesh);

        // Relative delta tracking for zero-teleport relocation
        this._initialHit = null;
        this._initialPos = null;
        this.initialEntityPosition = null;

        // 4. Create Stable Static DOM HUD Action Bar
        this.createBadgeDOM();

        // Keyboard navigation listener
        this._onKeyDown = (e) => this.handleKeyDown(e);
        window.addEventListener('keydown', this._onKeyDown);

        this._lastPresetHash = '';
    }

    updateSnapGuideLine(detection) {
        if (!this.snapGuideMesh) return;
        if (!detection || !detection.hasTarget || !detection.targetEdge) {
            this.snapGuideMesh.visible = false;
            return;
        }

        const edge = detection.targetEdge;
        const elev = detection.targetElevation || (this.activeElevation + detection.detectedHeight);
        const p1 = edge.p1;
        const p2 = edge.p2;

        const vertices = new Float32Array([
            p1.x, elev + 0.3, p1.z,
            p2.x, elev + 0.3, p2.z
        ]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        if (this.snapGuideMesh.geometry) this.snapGuideMesh.geometry.dispose();
        this.snapGuideMesh.geometry = geo;
        this.snapGuideMesh.visible = true;
    }

    toggleAutoHeight() {
        this.autoHeightEnabled = !this.autoHeightEnabled;
        if (this.btnAuto) {
            this.btnAuto.textContent = this.autoHeightEnabled ? '⚡ Auto: ON' : '⚡ Auto: OFF';
            this.btnAuto.style.background = this.autoHeightEnabled ? 'rgba(16, 185, 129, 0.22)' : 'rgba(148, 163, 184, 0.22)';
            this.btnAuto.style.borderColor = this.autoHeightEnabled ? 'rgba(16, 185, 129, 0.6)' : 'rgba(148, 163, 184, 0.6)';
            this.btnAuto.style.color = this.autoHeightEnabled ? '#34d399' : '#94a3b8';
        }
        this._lastPresetHash = '';
        const preset = this.getPlanner()?.activePresetParams || {};
        this.updateGhostModel(preset, this.activePos.x, this.activeElevation, this.activePos.z, this.activeRotation);
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    createBadgeDOM() {
        this.badgeDom = document.createElement('div');
        this.badgeDom.id = 'sims4-stair-placement-badge';
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
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #00f0ff; box-shadow: 0 0 8px #00f0ff;"></span>
                    <span id="stair-ui-title" style="color: #38bdf8; font-weight: 700; font-size: 12px;">Custom Staircase</span>
                </div>
                
                <div style="width: 1px; height: 20px; background: rgba(255, 255, 255, 0.15);"></div>

                <div id="stair-ui-specs" style="color: #cbd5e1; font-size: 11px; font-weight: 500;">
                    1000 × 3300 mm • 12 Steps
                </div>
                <span style="color: #94a3b8; font-size: 11px;">(<strong id="stair-ui-rot" style="color: #38bdf8;">0°</strong>)</span>

                <div id="stair-ui-target" style="display: none; align-items: center; gap: 4px; font-size: 10.5px; padding: 2px 7px; border-radius: 999px; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.5); color: #34d399; font-weight: 600;">
                    ⚡ Auto-Fit
                </div>

                <div style="width: 1px; height: 20px; background: rgba(255, 255, 255, 0.15);"></div>

                <div style="display: flex; align-items: center; gap: 5px;">
                    <button id="stair-ui-btn-auto" type="button" title="Toggle Auto Height Detection" style="display: inline-flex; align-items: center; justify-content: center; gap: 3px; background: rgba(16, 185, 129, 0.22); border: 1px solid rgba(16, 185, 129, 0.6); color: #34d399; border-radius: 8px; padding: 5px 8px; font-size: 11px; font-weight: 700; cursor: pointer; min-height: 30px;">
                        ⚡ Auto
                    </button>
                    <button id="stair-ui-btn-rot" type="button" title="Rotate Staircase (Key: R)" style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #f1f5f9; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer; min-height: 30px;">
                        ↻ Rotate
                    </button>
                    <button id="stair-ui-btn-flip" type="button" style="display: none; align-items: center; justify-content: center; gap: 4px; background: rgba(147, 51, 234, 0.22); border: 1px solid rgba(168, 85, 247, 0.6); color: #c084fc; border-radius: 8px; padding: 5px 9px; font-size: 11px; font-weight: 700; cursor: pointer; min-height: 30px;">
                        ⇄ Flip
                    </button>
                    <button id="stair-ui-btn-place" type="button" title="Confirm Placement (Key: Enter / Space)" style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: #22c55e; border: none; color: #0f172a; border-radius: 8px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 30px;">
                        ✓ Place
                    </button>
                    <button id="stair-ui-btn-cancel" type="button" title="Cancel Placement (Key: Esc)" style="display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.1); border: none; color: #94a3b8; border-radius: 50%; width: 28px; height: 28px; font-size: 12px; font-weight: 700; cursor: pointer;">
                        ✕
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(this.badgeDom);

        // Cache stable DOM references
        this.elTitle = this.badgeDom.querySelector('#stair-ui-title');
        this.elRot = this.badgeDom.querySelector('#stair-ui-rot');
        this.elSpecs = this.badgeDom.querySelector('#stair-ui-specs');
        this.elTarget = this.badgeDom.querySelector('#stair-ui-target');
        this.btnAuto = this.badgeDom.querySelector('#stair-ui-btn-auto');
        this.btnRot = this.badgeDom.querySelector('#stair-ui-btn-rot');
        this.btnFlip = this.badgeDom.querySelector('#stair-ui-btn-flip');
        this.btnPlace = this.badgeDom.querySelector('#stair-ui-btn-place');
        this.btnCancel = this.badgeDom.querySelector('#stair-ui-btn-cancel');

        // Wire handlers once without recreating elements
        this.btnAuto.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnAuto.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            this.toggleAutoHeight();
        });

        this.btnRot.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnRot.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            this.rotateStep(90);
        });

        this.btnFlip.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnFlip.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            this.flipTurnDirection();
        });

        this.btnPlace.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnPlace.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            this.placeStaircase();
        });

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

    isPlacementTool() {
        if (this.isRelocating) return true;
        const planner = this.getPlanner();
        if (!planner) return false;
        const tool = planner.tool || planner._tool || (planner.tools && planner.tools.currentTool) || '';
        if (!tool || tool === 'select' || tool === 'pan') return false;

        const preset = planner.activePresetParams || {};
        return tool === 'staircase' || 
               tool.startsWith('stair_v5_') || 
               tool.startsWith('stair_v4_') || 
               (preset && (preset.type?.startsWith('stair_') || preset.shape));
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

    getActiveMaxWallHeight() {
        const planner = this.getPlanner();
        if (!planner) return WALL_HEIGHT;
        const walls = planner.walls || [];
        const mainWalls = walls.filter(w => !w.isUnderStairWall && w.type !== 'railing');
        if (mainWalls.length > 0) {
            return Math.max(...mainWalls.map(w => w.height !== undefined ? w.height : (w.config?.height || WALL_HEIGHT)));
        }
        return WALL_HEIGHT;
    }

    isTouchDevice() {
        return window.innerWidth <= 768 || (('ontouchstart' in window) && (navigator.maxTouchPoints > 1) && window.innerWidth <= 1024);
    }

    toggleWallSnap() {
        this.wallSnapEnabled = !this.wallSnapEnabled;
        this.wallCollisionEnabled = this.wallSnapEnabled;
        if (coreEventBus) {
            coreEventBus.emit('UniversalMoveChanged', {
                wallSnap: this.wallSnapEnabled
            });
        }
        return this.wallSnapEnabled;
    }

    setSnapMode(snapVal) {
        this.snapMode = Number(snapVal);
        if (coreEventBus) {
            coreEventBus.emit('UniversalMoveChanged', {
                snapMode: this.snapMode
            });
        }
    }

    rotateStep(deltaDeg) {
        this.activeRotation = (this.activeRotation + deltaDeg + 360) % 360;
        this.updateGhostTransform();
        if (this.elRot) this.elRot.textContent = `${this.activeRotation % 360}°`;
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

    flipTurnDirection() {
        this.activeTurnDirection = (this.activeTurnDirection === 'left') ? 'right' : 'left';
        this._lastPresetHash = '';
        const preset = this.getPlanner()?.activePresetParams || {};
        this.updateGhostModel(preset, this.activePos.x, this.activeElevation, this.activePos.z, this.activeRotation);
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
            const width = Number(preset.width) || 100;
            const totalSteps = this.lastDetection?.optimalSteps || preset.totalSteps || (Number(preset.flight1Steps || 8) + Number(preset.flight2Steps || 7));
            const length = Number(preset.length) || (totalSteps * (Number(preset.stepDepth) || 28));

            const resolved = SnapEngine.resolvePosition({
                x: newX,
                z: newZ,
                rotation: this.activeRotation,
                width: width,
                depth: length
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
        } else if (e.key === 'f' || e.key === 'F' || e.key === ' ') {
            this.flipTurnDirection();
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
        const minZ = (this._localBounds?.minZ ?? -150) - margin;
        const maxZ = (this._localBounds?.maxZ ?? 150) + margin;

        return localX >= minX && localX <= maxX && localZ >= minZ && localZ <= maxZ;
    }

    onPointerMove(e) {
        if (!this.isPlacementTool()) {
            this.hideGhost();
            return false;
        }

        const dom = this.ctx.renderer.domElement;
        const rect = dom.getBoundingClientRect();

        // Only update if pointer is inside 3D viewport canvas
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
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
        if (!floor) return false;

        const elev = this.getActiveElevation();
        this.activeElevation = elev;

        const planner = this.getPlanner();
        const preset = this.isRelocating ? (this.relocatingEntity || {}) : (planner.activePresetParams || {});

        // Smooth Grid Snapping via SnapEngine
        const isFine = e.shiftKey;
        const gridStep = this.snapMode === 0 || isFine ? 1 : this.snapMode;
        const snappedGrid = SnapEngine.snapToGrid({ x: floor.x, z: floor.z }, gridStep);
        const cursorX = snappedGrid.x !== undefined ? snappedGrid.x : floor.x;
        const cursorZ = snappedGrid.z !== undefined ? snappedGrid.z : floor.z;

        if (this.isRelocating) {
            if (!this._isDragging) {
                if (this._isHitOnGhost(floor, 25)) {
                    dom.style.cursor = 'grab';
                } else {
                    dom.style.cursor = 'auto';
                }
                if (this.ctx && this.ctx.controls) {
                    this.ctx.controls.enableRotate = true;
                }
                return false;
            }

            // Actively dragging the object in relocation mode
            if (this.ctx && this.ctx.controls) {
                this.ctx.controls.enableRotate = false;
            }
            dom.style.cursor = 'grabbing';

            let worldX = cursorX - this._grabOffset.x;
            let worldZ = cursorZ - this._grabOffset.z;

            // Sims 4 Real-Time Height Auto-Detection
            const detection = this.autoHeightEnabled ? StairHeightDetector.detect({
                x: worldX,
                z: worldZ,
                elevation: elev,
                rotation: this.activeRotation,
                preset,
                planner,
                isCenterAnchored: true
            }) : StairHeightDetector.getDefaultResult(preset, elev, this.getActiveMaxWallHeight());

            this.lastDetection = detection;

            if (detection.snappedPos && !e.altKey) {
                worldX = detection.snappedPos.x;
                worldZ = detection.snappedPos.z;
            }

            if (planner && (this.wallCollisionEnabled || this.wallSnapEnabled)) {
                const width = Number(preset.width) || 100;
                const totalSteps = detection?.optimalSteps || preset.totalSteps || (Number(preset.flight1Steps || 8) + Number(preset.flight2Steps || 7));
                const length = Number(preset.length) || (totalSteps * (Number(preset.stepDepth) || 28));

                const resolved = SnapEngine.resolvePosition({
                    x: worldX,
                    z: worldZ,
                    rotation: this.activeRotation,
                    width: width,
                    depth: length
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

            this.activePos.set(worldX, elev, worldZ);
            this.updateGhostModel(preset, worldX, elev, worldZ, this.activeRotation);
            this.updateBadgeContent(e);

            if (coreEventBus) {
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

        // Initial Placement Mode (from side nav - smooth floor following)
        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = false;
        }
        dom.style.cursor = 'move';

        let worldX = cursorX + this._grabOffset.x;
        let worldZ = cursorZ + this._grabOffset.z;

        // Sims 4 Real-Time Height Auto-Detection
        const detection = this.autoHeightEnabled ? StairHeightDetector.detect({
            x: worldX,
            z: worldZ,
            elevation: elev,
            rotation: this.activeRotation,
            preset,
            planner,
            isCenterAnchored: true
        }) : StairHeightDetector.getDefaultResult(preset, elev, this.getActiveMaxWallHeight());

        this.lastDetection = detection;

        // Apply edge flush snapping if close to a platform or wall edge (unless Alt is held)
        if (detection.snappedPos && !e.altKey) {
            worldX = detection.snappedPos.x;
            worldZ = detection.snappedPos.z;
        }

        // Apply Wall Collision & Wall Snap via SnapEngine
        if (planner && (this.wallCollisionEnabled || this.wallSnapEnabled)) {
            const width = Number(preset.width) || 100;
            const totalSteps = detection?.optimalSteps || preset.totalSteps || (Number(preset.flight1Steps || 8) + Number(preset.flight2Steps || 7));
            const length = Number(preset.length) || (totalSteps * (Number(preset.stepDepth) || 28));

            const resolved = SnapEngine.resolvePosition({
                x: worldX,
                z: worldZ,
                rotation: this.activeRotation,
                width: width,
                depth: length
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

        this.activePos.set(worldX, elev, worldZ);

        // Update 3D snap guide line along the target edge
        this.updateSnapGuideLine(detection);

        // Effective stair preset with auto-detected height, steps, and length
        const effectivePreset = {
            ...preset,
            height: detection.detectedHeight,
            totalSteps: detection.optimalSteps,
            flight1Steps: detection.flight1Steps,
            flight2Steps: detection.flight2Steps,
            stepHeight: detection.stepHeight,
            length: detection.flightLength
        };

        // Update Ghost 3D Mesh (centers on cursor + offset)
        this.updateGhostModel(effectivePreset, worldX, elev, worldZ, this.activeRotation);

        // Update HUD Badge Information
        this.updateBadgeContent(e);

        if (coreEventBus) {
            coreEventBus.emit('InteractionStateChanged', {
                state: 'ACTION_ACTIVE',
                activeAction: this.isRelocating ? 'move' : 'place',
                hudMode: 'action_minimal',
                selectedEntity: {
                    type: 'staircase',
                    name: preset.name || 'Custom Staircase'
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
        const width = Number(preset.width) || 100;
        const targetHeight = this.lastDetection?.detectedHeight || (Number(preset.height) || this.getActiveMaxWallHeight());
        const totalSteps = this.lastDetection?.optimalSteps || preset.totalSteps || (Number(preset.flight1Steps || 8) + Number(preset.flight2Steps || 7));
        const length = Number(preset.length) || (totalSteps * Number(preset.stepDepth || 28));
        const stairName = preset.name || 'Custom Staircase';
        const specsText = `${Math.round(width * 10)} × ${Math.round(length * 10)} mm • Height ${Math.round(targetHeight * 10)} mm • ${totalSteps} Steps`;
        const shape = preset.shape || (preset.type ? preset.type.replace('stair_v5_', '') : 'straight');
        const showFlip = (shape === 'L' || shape === 'U' || shape === 'T');

        if (this.elTitle) this.elTitle.textContent = stairName;
        if (this.elRot) this.elRot.textContent = `${this.activeRotation % 360}°`;
        if (this.elSpecs) this.elSpecs.textContent = specsText;
        if (this.btnFlip) this.btnFlip.style.display = showFlip ? 'flex' : 'none';

        if (this.elTarget) {
            if (this.lastDetection?.hasTarget && this.autoHeightEnabled) {
                this.elTarget.style.display = 'inline-flex';
                this.elTarget.textContent = `⚡ ${Math.round(targetHeight * 10)}mm`;
            } else {
                this.elTarget.style.display = 'none';
            }
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

    updateGhostModel(preset, worldX, elev, worldZ, rotation) {
        this.ghostGroup.position.set(worldX, elev, worldZ);
        this.ghostGroup.rotation.y = -rotation * Math.PI / 180;
        this.ghostGroup.visible = true;

        const targetHeight = Number(preset.height) || this.getActiveMaxWallHeight();
        const shape = preset.shape || (preset.type ? preset.type.replace('stair_v5_', '') : 'straight');
        const hash = `${preset.id}_${preset.type}_${shape}_${preset.width}_${preset.length}_${targetHeight}_${preset.totalSteps}_${preset.flight1Steps}_${preset.flight2Steps}_${this.activeTurnDirection}_${preset.stringerType}`;

        if (this._lastPresetHash !== hash) {
            this._lastPresetHash = hash;

            // Clear previous 3D ghost preview
            while (this.modelPreviewGroup.children.length > 0) {
                const child = this.modelPreviewGroup.children[0];
                this.modelPreviewGroup.remove(child);
            }

            const stairPayload = {
                ...preset,
                height: targetHeight,
                shape: shape,
                turnDirection: this.activeTurnDirection || preset.turnDirection || 'right',
                x: 0,
                y: 0,
                elevation: 0,
                rotation: 0
            };

            const tempWrapper = new THREE.Group();
            this.stairBuilder.build([stairPayload], tempWrapper, 0, true, targetHeight);
            tempWrapper.position.set(0, 0, 0);

            // ──── COMPUTE BOUNDING BOX CENTER ────
            // The bounding box of the staircase geometry tells us where the visual center is
            // relative to the staircase origin (0, 0, 0) = Step 1 base edge.
            const bbox = new THREE.Box3().setFromObject(tempWrapper);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            // Only use X and Z for floor-plane centering; Y stays at 0 (vertical center is irrelevant)
            this.localCenterOffset.set(center.x, 0, center.z);
            this._localBounds = {
                minX: bbox.min.x - center.x,
                maxX: bbox.max.x - center.x,
                minZ: bbox.min.z - center.z,
                maxZ: bbox.max.z - center.z
            };

            // Shift the model preview so the bounding box center aligns with ghostGroup origin (= cursor)
            tempWrapper.position.set(-center.x, 0, -center.z);

            // Apply Sims 4 holographic ghost material styling
            const ghostMat = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.78,
                roughness: 0.3,
                metalness: 0.1,
                side: THREE.DoubleSide
            });

            tempWrapper.traverse(c => {
                if (c.isMesh) {
                    c.material = ghostMat;
                    c.raycast = () => {};
                }
            });
            tempWrapper.raycast = () => {};

            this.modelPreviewGroup.add(tempWrapper);

            // Build Footprint Perimeter Lines (shifted by center offset)
            this.updateFootprintGeometry(stairPayload);
        }
    }

    updateFootprintGeometry(stairPayload) {
        // Floating wireframe footprint removed as per user requirement
        if (this.footprintMesh) {
            this.footprintMesh.visible = false;
        }
    }

    /**
     * Raycast cursor to floor plane and return snapped {x, z} or null.
     */
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
        const gridStep = isFine ? 1 : 10;
        return {
            x: Math.round(hitPoint.x / gridStep) * gridStep,
            z: Math.round(hitPoint.z / gridStep) * gridStep,
            elev
        };
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
                return this.placeStaircase();
            }
            return true;
        }

        // Ghost not visible yet — first interaction initializes position (center-anchored)
        this.activeElevation = floor.elev;
        this._grabOffset.set(0, 0, 0);
        this._isGrabbing = false;
        let startX = floor.x;
        let startZ = floor.z;
        const planner = this.getPlanner();
        const preset = planner?.activePresetParams || {};

        if (planner && (this.wallCollisionEnabled || this.wallSnapEnabled)) {
            const width = Number(preset.width) || 100;
            const totalSteps = this.lastDetection?.optimalSteps || preset.totalSteps || (Number(preset.flight1Steps || 8) + Number(preset.flight2Steps || 7));
            const length = Number(preset.length) || (totalSteps * (Number(preset.stepDepth) || 28));

            const resolved = SnapEngine.resolvePosition({
                x: startX,
                z: startZ,
                rotation: this.activeRotation,
                width: width,
                depth: length
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
            return this.placeStaircase();
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

    placeStaircase() {
        if (!this.isPlacementTool()) return false;

        const planner = this.getPlanner();
        if (!planner) return false;

        const preset = planner.activePresetParams || {};
        const shape = (preset.shape || (preset.type ? preset.type.replace('stair_v5_', '') : 'straight')).toString();

        // 1. Record Snapshot Command for Full Undo/Redo
        let snapshotCmd = null;
        if (planner.commandManager) {
            snapshotCmd = new SnapshotCommand(planner);
        }

        // 2. Convert center position (cursor) back to staircase origin (Step 1 base edge).
        //    activePos = world position of the visual center.
        //    localCenterOffset = (cx, 0, cz) = vector from staircase origin to its bounding box center in local space.
        //    We need: originPos = activePos - rotate(localCenterOffset, ghostGroup.rotation.y)
        const rotY = -this.activeRotation * Math.PI / 180;
        const cx = this.localCenterOffset.x;
        const cz = this.localCenterOffset.z;
        // Rotate (cx, cz) by rotY around Y axis:
        const cosR = Math.cos(rotY);
        const sinR = Math.sin(rotY);
        const rotatedCx = cx * cosR + cz * sinR;
        const rotatedCz = -cx * sinR + cz * cosR;
        
        const originX = this.activePos.x - rotatedCx;
        const originZ = this.activePos.z - rotatedCz;

        const stairData = {
            x: originX,
            y: originZ,
            rotation: this.activeRotation,
            elevation: this.activeElevation,
            ...preset
        };
        if (this.lastDetection && this.autoHeightEnabled) {
            stairData.height = this.lastDetection.detectedHeight;
            stairData.totalSteps = this.lastDetection.optimalSteps;
            stairData.flight1Steps = this.lastDetection.flight1Steps;
            stairData.flight2Steps = this.lastDetection.flight2Steps;
            stairData.stepHeight = this.lastDetection.stepHeight;
            stairData.length = this.lastDetection.flightLength;

            if (this.lastDetection.targetSource) {
                const targetHost = this.lastDetection.targetSource;
                const hostType = this.lastDetection.targetType || (targetHost.isBuildingFoundation ? 'platform' : 'platform');
                stairData.hostId = targetHost.id;
                stairData.hostType = hostType;
                stairData.relationshipType = RELATIONSHIP_TYPES.SUPPORTED;
                if (hostType === 'platform') {
                    stairData.hostPlatformId = targetHost.id;
                }

                const hostTransform = SpatialDependencyEngine.getEntityTransform(targetHost);

                const stairWorld = {
                    x: stairData.x,
                    y: stairData.y,
                    elevation: stairData.elevation,
                    rotation: stairData.rotation
                };

                stairData.localTransform = SpatialDependencyEngine.computeLocalTransform(stairWorld, hostTransform);
                stairData.relativeElevation = stairData.localTransform.elevation;
            }
        }
        if (this.activeTurnDirection) {
            stairData.turnDirection = this.activeTurnDirection;
        }

        let resultingStair = null;

        if (this.isRelocating && this.relocatingEntity) {
            const stair = this.relocatingEntity;
            const updatePayload = {
                x: originX,
                y: originZ,
                rotation: this.activeRotation,
                elevation: this.activeElevation
            };
            if (stairData.height !== undefined) updatePayload.height = stairData.height;
            if (stairData.totalSteps !== undefined) updatePayload.totalSteps = stairData.totalSteps;
            if (stairData.flight1Steps !== undefined) updatePayload.flight1Steps = stairData.flight1Steps;
            if (stairData.flight2Steps !== undefined) updatePayload.flight2Steps = stairData.flight2Steps;
            if (stairData.stepHeight !== undefined) updatePayload.stepHeight = stairData.stepHeight;
            if (stairData.length !== undefined) updatePayload.length = stairData.length;
            if (stairData.turnDirection) updatePayload.turnDirection = stairData.turnDirection;
            if (stairData.hostId) updatePayload.hostId = stairData.hostId;
            if (stairData.hostType) updatePayload.hostType = stairData.hostType;
            if (stairData.relationshipType) updatePayload.relationshipType = stairData.relationshipType;
            if (stairData.hostPlatformId) updatePayload.hostPlatformId = stairData.hostPlatformId;
            if (stairData.localTransform) updatePayload.localTransform = stairData.localTransform;
            if (stairData.relativeElevation !== undefined) updatePayload.relativeElevation = stairData.relativeElevation;

            StairEngine.batchUpdate(planner, stair, updatePayload);

            if (stair.mesh3D) {
                stair.mesh3D.visible = true;
            }

            if (stairData.hostId && this.lastDetection?.targetSource) {
                globalSpatialDependencyEngine.attach(stair, this.lastDetection.targetSource, {
                    relationshipType: RELATIONSHIP_TYPES.SUPPORTED,
                    localTransform: stairData.localTransform
                });
            }

            this.isRelocating = false;
            this.relocatingEntity = null;
            resultingStair = stair;
        } else {
            resultingStair = StairEngine.createStair(planner, stairData);

            if (resultingStair && stairData.hostId && this.lastDetection?.targetSource) {
                globalSpatialDependencyEngine.attach(resultingStair, this.lastDetection.targetSource, {
                    relationshipType: RELATIONSHIP_TYPES.SUPPORTED,
                    localTransform: stairData.localTransform
                });
            }
        }

        // 3. Finalize Undo Command
        if (snapshotCmd && snapshotCmd.finalize() && planner.commandManager) {
            planner.commandManager.execute(snapshotCmd);
        }

        // Synchronize active level state so switching levels or exporting preserves the new stair
        if (typeof planner.exportState === 'function' && planner.levels && planner.activeLevelIndex !== undefined && planner.levels[planner.activeLevelIndex]) {
            planner.levels[planner.activeLevelIndex].data = planner.exportState();
        }
        if (typeof this.ctx.saveCurrentLevelState === 'function') {
            this.ctx.saveCurrentLevelState();
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
                true, // Preserve camera angle & zoom
                planner.outdoorZones || []
            );
        }

        // 5. Reset tool and sync to select mode
        planner.tool = 'select';
        if (typeof planner.updateToolStates === 'function') planner.updateToolStates();
        planner.syncAll();
        if (typeof planner.debouncedSaveHistory === 'function') planner.debouncedSaveHistory();

        // 6. Select Placed Staircase in 3D Scene
        if (resultingStair?.mesh3D && typeof this.interactions?.selectObject === 'function') {
            resultingStair.mesh3D.updateWorldMatrix(true, true);
            this.interactions.selectObject(resultingStair.mesh3D, null, true);
        }

        this.hideGhost();

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender('Staircase 3D Placement Complete', 5);
        }

        return true;
    }

    hideGhost() {
        this._initialHit = null;
        this._initialPos = null;
        if (this.ghostGroup) this.ghostGroup.visible = false;
        if (this.footprintMesh) this.footprintMesh.visible = false;
        if (this.badgeDom) this.badgeDom.style.display = 'none';
        if (this.snapGuideMesh) this.snapGuideMesh.visible = false;
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

    startRelocate(stairEntity) {
        this.startRelocation(stairEntity);
    }

    startRelocation(stairEntity) {
        if (!stairEntity) return;
        this.isRelocating = true;
        this.relocatingEntity = stairEntity;
        this._initialHit = null;

        // Hide original stair mesh during relocation preview
        if (stairEntity.mesh3D) {
            stairEntity.mesh3D.visible = false;
        }

        this.initialEntityPosition = {
            x: Number(stairEntity.x),
            y: Number(stairEntity.y),
            rotation: Number(stairEntity.rotation) || 0,
            elevation: Number(stairEntity.elevation) || 0,
            turnDirection: stairEntity.turnDirection || 'right'
        };

        const elev = stairEntity.elevation !== undefined ? Number(stairEntity.elevation) : this.getActiveElevation();
        this.activeElevation = elev;
        this.activeRotation = Number(stairEntity.rotation) || 0;
        this.activeTurnDirection = stairEntity.turnDirection || 'right';

        // Compute geometric center of the staircase to anchor cursor
        const stairData = {
            ...stairEntity,
            x: 0,
            y: 0,
            elevation: 0,
            rotation: 0
        };
        const tempWrapper = new THREE.Group();
        const targetHeight = Number(stairEntity.height) || this.getActiveMaxWallHeight();
        this.stairBuilder.build([stairData], tempWrapper, 0, true, targetHeight);
        const bbox = new THREE.Box3().setFromObject(tempWrapper);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        this.localCenterOffset.set(center.x, 0, center.z);
        this._localBounds = {
            minX: bbox.min.x - center.x,
            maxX: bbox.max.x - center.x,
            minZ: bbox.min.z - center.z,
            maxZ: bbox.max.z - center.z
        };
        tempWrapper.traverse(c => {
            if (c.geometry) c.geometry.dispose();
        });

        const rotY = -this.activeRotation * Math.PI / 180;
        const cosR = Math.cos(rotY);
        const sinR = Math.sin(rotY);
        const rotatedCx = center.x * cosR + center.z * sinR;
        const rotatedCz = -center.x * sinR + center.z * cosR;

        const worldCenterX = Number(stairEntity.x) + rotatedCx;
        const worldCenterZ = Number(stairEntity.y) + rotatedCz;

        this.activePos.set(worldCenterX, elev, worldCenterZ);
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

        this._lastPresetHash = '';
        this.updateGhostModel(stairEntity, worldCenterX, elev, worldCenterZ, this.activeRotation);
        this.updateBadgeContent();

        if (coreEventBus) {
            coreEventBus.emit('InteractionStateChanged', {
                state: 'ACTION_ACTIVE',
                activeAction: 'move',
                hudMode: 'action_minimal',
                selectedEntity: stairEntity
            });
            coreEventBus.emit('UniversalMoveChanged', {
                x: Math.round(stairEntity.x),
                z: Math.round(stairEntity.y),
                rotation: this.activeRotation,
                wallSnap: this.wallSnapEnabled,
                snapMode: this.snapMode
            });
        }

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender('stair_start_relocate');
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
                    if (this.initialEntityPosition.turnDirection) {
                        this.relocatingEntity.turnDirection = this.initialEntityPosition.turnDirection;
                    }
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
        if (this.snapGuideMesh && this.ctx.scene) {
            this.ctx.scene.remove(this.snapGuideMesh);
            if (this.snapGuideMesh.geometry) this.snapGuideMesh.geometry.dispose();
            if (this.snapGuideMat) this.snapGuideMat.dispose();
        }
    }
}

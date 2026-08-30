import * as THREE from 'three';
import { FURNITURE_REGISTRY } from '../../features/furniture/furniture.registry.js';
import { PremiumFurniture } from '../../features/furniture/furniture.renderer2d.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';

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

        // Grab offset: preserves relative distance when user touches/clicks anywhere
        // on the model (beginning, center, end, edge) — preventing reposition jumps
        this._grabOffset = new THREE.Vector3(0, 0, 0);
        this._isGrabbing = false;

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
        this.ghostGroup.add(this.footprintMesh);

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
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(16px);
            border: 1.5px solid rgba(56, 189, 248, 0.85);
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
            border-radius: 12px;
            padding: 9px 13px;
            color: #f8fafc;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.3px;
            z-index: 100000;
            user-select: none;
            -webkit-user-select: none;
            touch-action: manipulation;
            transition: opacity 0.15s ease, transform 0.1s ease;
        `;

        this.badgeDom.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 6px; min-width: 250px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 7px;">
                        <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #00f0ff; box-shadow: 0 0 10px #00f0ff;"></span>
                        <span id="furn-ui-title" style="color: #38bdf8; font-weight: 700; font-size: 12px;">Furniture Item</span>
                    </div>
                    <span style="color: #94a3b8; font-size: 11px;">Rot: <strong id="furn-ui-rot" style="color: #38bdf8;">0°</strong></span>
                </div>
                
                <div id="furn-ui-specs" style="color: #cbd5e1; font-size: 11px; font-weight: 500;">
                    1000 × 1000 × 800 mm
                </div>

                <div style="display: flex; align-items: center; gap: 6px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.12); margin-top: 2px;">
                    <button id="furn-ui-btn-rot" type="button" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; background: rgba(56, 189, 248, 0.22); border: 1.5px solid rgba(56, 189, 248, 0.6); color: #38bdf8; border-radius: 7px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; touch-action: manipulation;">
                        ↻ Rotate
                    </button>
                    <button id="furn-ui-btn-place" type="button" style="flex: 1.3; display: flex; align-items: center; justify-content: center; gap: 4px; background: rgba(16, 185, 129, 0.3); border: 1.5px solid rgba(16, 185, 129, 0.8); color: #34d399; border-radius: 7px; padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer; touch-action: manipulation;">
                        ✓ Place
                    </button>
                    <button id="furn-ui-btn-cancel" type="button" style="display: flex; align-items: center; justify-content: center; background: rgba(239, 68, 68, 0.22); border: 1.5px solid rgba(239, 68, 68, 0.6); color: #f87171; border-radius: 7px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; touch-action: manipulation;">
                        ✕
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(this.badgeDom);

        // Cache stable DOM references
        this.elTitle = this.badgeDom.querySelector('#furn-ui-title');
        this.elRot = this.badgeDom.querySelector('#furn-ui-rot');
        this.elSpecs = this.badgeDom.querySelector('#furn-ui-specs');
        this.btnRot = this.badgeDom.querySelector('#furn-ui-btn-rot');
        this.btnPlace = this.badgeDom.querySelector('#furn-ui-btn-place');
        this.btnCancel = this.badgeDom.querySelector('#furn-ui-btn-cancel');

        // Wire handlers once without DOM recreation
        this.btnRot.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnRot.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            this.rotateStep(90);
        });

        this.btnPlace.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnPlace.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            this.placeFurniture();
        });

        this.btnCancel.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnCancel.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
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
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth <= 768;
    }

    rotateStep(deltaDeg) {
        this.activeRotation = (this.activeRotation + deltaDeg + 360) % 360;
        this.updateGhostTransform();
        if (this.elRot) this.elRot.textContent = `${this.activeRotation % 360}°`;
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
        const gridStep = isFine ? 1 : 10;
        return {
            x: Math.round(hitPoint.x / gridStep) * gridStep,
            z: Math.round(hitPoint.z / gridStep) * gridStep,
            elev
        };
    }

    onPointerMove(e) {
        if (!this.isPlacementTool()) {
            this.hideGhost();
            return false;
        }

        const planner = this.getPlanner();
        const floor = this._raycastFloor(e);
        if (!floor) {
            this.hideGhost();
            return false;
        }

        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = false;
        }

        const preset = planner.activePresetParams || {};

        // Apply grab offset: preserves relative distance so the model does not jump
        const worldX = floor.x + this._grabOffset.x;
        const worldZ = floor.z + this._grabOffset.z;

        this.activePos.set(worldX, floor.elev, worldZ);
        this.activeElevation = floor.elev;

        // Update Ghost 3D Mesh
        this.updateGhostModel(preset, worldX, floor.elev, worldZ, this.activeRotation);

        // Update HUD Badge Information
        this.updateBadgeContent(e);

        this.ctx.renderer.domElement.style.cursor = 'crosshair';
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

        const w = Number(preset.width) || Number(config.default?.width) || 100;
        const d = Number(preset.depth) || Number(config.default?.depth) || 100;
        const h = Number(preset.height) || Number(config.default?.height) || 80;
        const specsText = `${Math.round(w * 10)} × ${Math.round(d * 10)} × ${Math.round(h * 10)} mm`;

        if (this.elTitle) this.elTitle.textContent = title;
        if (this.elRot) this.elRot.textContent = `${this.activeRotation % 360}°`;
        if (this.elSpecs) this.elSpecs.textContent = specsText;

        const isMobileScreen = this.isTouchDevice();

        if (isMobileScreen) {
            this.badgeDom.style.left = '50%';
            this.badgeDom.style.top = 'auto';
            this.badgeDom.style.bottom = '90px';
            this.badgeDom.style.transform = 'translateX(-50%)';
        } else if (pointerEvent) {
            this.badgeDom.style.bottom = 'auto';
            this.badgeDom.style.transform = 'translate(-50%, -135%)';
            this.badgeDom.style.left = `${pointerEvent.clientX}px`;
            this.badgeDom.style.top = `${pointerEvent.clientY}px`;
        }

        this.badgeDom.style.display = 'block';
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

            // Build Footprint Floor Rectangle
            this.updateFootprintGeometry(itemW, itemD);

            if (this.ctx && typeof this.ctx.requestRender === 'function') {
                this.ctx.requestRender();
            }
        }
    }

    updateFootprintGeometry(width, depth) {
        const halfW = width / 2;
        const halfD = depth / 2;
        const linePoints = [
            new THREE.Vector3(-halfW, 0.5, -halfD),
            new THREE.Vector3(halfW, 0.5, -halfD),
            new THREE.Vector3(halfW, 0.5, -halfD),
            new THREE.Vector3(halfW, 0.5, halfD),
            new THREE.Vector3(halfW, 0.5, halfD),
            new THREE.Vector3(-halfW, 0.5, halfD),
            new THREE.Vector3(-halfW, 0.5, halfD),
            new THREE.Vector3(-halfW, 0.5, -halfD)
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
        this.footprintMesh.geometry.dispose();
        this.footprintMesh.geometry = geo;
        this.footprintMesh.visible = true;
    }

    onPointerDown(e) {
        if (!this.isPlacementTool()) return false;

        const isTouch = e.pointerType === 'touch' || this.isTouchDevice();

        if (this.ghostGroup.visible) {
            // Ghost is already visible.
            // Compute grab offset to lock relative distance wherever clicked/touched.
            const floor = this._raycastFloor(e);
            if (floor) {
                this._grabOffset.set(
                    this.activePos.x - floor.x,
                    0,
                    this.activePos.z - floor.z
                );
                this._isGrabbing = true;
            }

            // Desktop: left-click places at exact activePos
            if (!isTouch && e.button === 0) {
                return this.placeFurniture();
            }
            return true;
        }

        // Ghost not visible yet — first interaction initializes position
        const floor = this._raycastFloor(e);
        if (floor) {
            this.activeElevation = floor.elev;
            this._grabOffset.set(0, 0, 0);
            this._isGrabbing = false;
            this.activePos.set(floor.x, floor.elev, floor.z);
            const preset = this.getPlanner()?.activePresetParams || {};
            this.updateGhostModel(preset, floor.x, floor.elev, floor.z, this.activeRotation);
            this.updateBadgeContent(e);
            if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
        }

        if (!isTouch && e.button === 0) {
            return this.placeFurniture();
        }

        return true;
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

        // 2. Instantiate and Position PremiumFurniture Entity
        const newFurn = new PremiumFurniture(
            planner,
            this.activePos.x,
            this.activePos.z,
            configId
        );

        if (preset.width) newFurn.width = Number(preset.width);
        if (preset.depth) newFurn.depth = Number(preset.depth);
        if (preset.height) newFurn.height = Number(preset.height);
        newFurn.elevation = this.activeElevation + (Number(preset.elevation) || 0);
        newFurn.rotation = this.activeRotation;

        if (preset.materials) {
            newFurn.materials = JSON.parse(JSON.stringify(preset.materials));
        }
        if (newFurn.update) newFurn.update();

        if (!planner.furniture) planner.furniture = [];
        if (!planner.furniture.includes(newFurn)) {
            planner.furniture.push(newFurn);
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
        if (newFurn.mesh3D && this.interactions) {
            newFurn.mesh3D.updateWorldMatrix(true, true);
            this.interactions.selectObject(newFurn.mesh3D, null, true);
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
        if (this.ghostGroup) this.ghostGroup.visible = false;
        if (this.badgeDom) this.badgeDom.style.display = 'none';
        this._grabOffset.set(0, 0, 0);
        this._isGrabbing = false;
        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = (this.interactions?.mode === 'camera');
        }
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
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

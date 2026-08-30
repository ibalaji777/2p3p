import * as THREE from 'three';
import { WALL_HEIGHT } from '../constants/units.js';
import { Stair3DBuilder } from '../../features/stairs/stairs.renderer3d.js';
import { PremiumStaircase, getStairCutoutPolygon } from '../../features/stairs/stairs.renderer2d.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';

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
        
        // Center offset in LOCAL (unrotated) space: the vector from staircase origin to its bounding box center.
        // Used to shift the ghost so the cursor sits at the geometric center.
        this.localCenterOffset = new THREE.Vector3(0, 0, 0);
        
        // Grab offset: the delta between the ghost center and the cursor floor point at the moment
        // the user re-engages (touches/clicks). This preserves the relative position so the
        // staircase doesn't jump when the user touches its edge, beginning, or end.
        this._grabOffset = new THREE.Vector3(0, 0, 0);
        this._isGrabbing = false;

        this.stairBuilder = new Stair3DBuilder(ctx.assets, [], ctx.helpers);

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
        this.ghostGroup.add(this.footprintMesh);

        // 3. Glowing Flight Direction Arrow on Floor
        this.arrowGroup = new THREE.Group();
        this.arrowGroup.renderOrder = 1009;
        this.arrowGroup.raycast = () => {};
        this.createDirectionArrow();
        this.ghostGroup.add(this.arrowGroup);

        // 4. Create Stable Static DOM HUD Action Bar
        this.createBadgeDOM();

        // Keyboard navigation listener
        this._onKeyDown = (e) => this.handleKeyDown(e);
        window.addEventListener('keydown', this._onKeyDown);

        this._lastPresetHash = '';
    }

    createDirectionArrow() {
        const arrowGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            0, 0.6, 0,
            0, 0.6, 60,
            0, 0.6, 60,
            -15, 0.6, 45,
            0, 0.6, 60,
            15, 0.6, 45
        ]);
        arrowGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const arrowMat = new THREE.LineBasicMaterial({
            color: 0x10b981,
            linewidth: 3,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.arrowLine = new THREE.LineSegments(arrowGeo, arrowMat);
        this.arrowLine.raycast = () => {};
        this.arrowGroup.add(this.arrowLine);
    }

    updateDirectionArrow(stairPayload) {
        const sd = Number(stairPayload.stepDepth) || 28;
        const steps = Number(stairPayload.totalSteps) || Number(stairPayload.flight1Steps) || 12;
        const totalL = steps * sd;
        const cx = this.localCenterOffset.x;
        const cz = this.localCenterOffset.z;
        
        const arrowGeo = new THREE.BufferGeometry();
        const arrowLen = Math.max(30, totalL * 0.7);
        const barbLen = Math.min(22, arrowLen * 0.28);
        const barbW = Math.min(16, barbLen * 0.75);
        const startZ = Math.max(8, totalL * 0.12) - cz;
        const endZ = startZ + arrowLen;
        
        const vertices = new Float32Array([
            -cx, 0.8, startZ,
            -cx, 0.8, endZ,
            -cx, 0.8, endZ,
            -cx - barbW, 0.8, endZ - barbLen,
            -cx, 0.8, endZ,
            -cx + barbW, 0.8, endZ - barbLen
        ]);
        arrowGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        if (this.arrowLine) {
            this.arrowLine.geometry.dispose();
            this.arrowLine.geometry = arrowGeo;
            this.arrowLine.visible = true;
        }
    }

    createBadgeDOM() {
        this.badgeDom = document.createElement('div');
        this.badgeDom.id = 'sims4-stair-placement-badge';
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
            <div style="display: flex; flex-direction: column; gap: 6px; min-width: 260px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 7px;">
                        <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #00f0ff; box-shadow: 0 0 10px #00f0ff;"></span>
                        <span id="stair-ui-title" style="color: #38bdf8; font-weight: 700; font-size: 12px;">Custom Staircase</span>
                    </div>
                    <span style="color: #94a3b8; font-size: 11px;">Rot: <strong id="stair-ui-rot" style="color: #38bdf8;">0°</strong></span>
                </div>
                
                <div id="stair-ui-specs" style="color: #cbd5e1; font-size: 11px; font-weight: 500;">
                    1000 × 3300 mm • 12 Steps
                </div>

                <div style="display: flex; align-items: center; gap: 6px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.12); margin-top: 2px;">
                    <button id="stair-ui-btn-rot" type="button" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; background: rgba(56, 189, 248, 0.22); border: 1.5px solid rgba(56, 189, 248, 0.6); color: #38bdf8; border-radius: 7px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; touch-action: manipulation;">
                        ↻ Rotate
                    </button>
                    <button id="stair-ui-btn-flip" type="button" style="display: none; align-items: center; justify-content: center; gap: 4px; background: rgba(147, 51, 234, 0.22); border: 1.5px solid rgba(168, 85, 247, 0.6); color: #c084fc; border-radius: 7px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; touch-action: manipulation;">
                        ⇄ Flip
                    </button>
                    <button id="stair-ui-btn-place" type="button" style="flex: 1.2; display: flex; align-items: center; justify-content: center; gap: 4px; background: rgba(16, 185, 129, 0.3); border: 1.5px solid rgba(16, 185, 129, 0.8); color: #34d399; border-radius: 7px; padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer; touch-action: manipulation;">
                        ✓ Place
                    </button>
                    <button id="stair-ui-btn-cancel" type="button" style="display: flex; align-items: center; justify-content: center; background: rgba(239, 68, 68, 0.22); border: 1.5px solid rgba(239, 68, 68, 0.6); color: #f87171; border-radius: 7px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; touch-action: manipulation;">
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
        this.btnRot = this.badgeDom.querySelector('#stair-ui-btn-rot');
        this.btnFlip = this.badgeDom.querySelector('#stair-ui-btn-flip');
        this.btnPlace = this.badgeDom.querySelector('#stair-ui-btn-place');
        this.btnCancel = this.badgeDom.querySelector('#stair-ui-btn-cancel');

        // Wire handlers once without recreating elements
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

    flipTurnDirection() {
        this.activeTurnDirection = (this.activeTurnDirection === 'left') ? 'right' : 'left';
        this._lastPresetHash = '';
        const preset = this.getPlanner()?.activePresetParams || {};
        this.updateGhostModel(preset, this.activePos.x, this.activeElevation, this.activePos.z, this.activeRotation);
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

    onPointerMove(e) {
        if (!this.isPlacementTool()) {
            this.hideGhost();
            return false;
        }

        const planner = this.getPlanner();
        const dom = this.ctx.renderer.domElement;
        const rect = dom.getBoundingClientRect();

        // Only update if pointer is inside 3D viewport canvas
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            return false;
        }

        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        const elev = this.getActiveElevation();
        this.activeElevation = elev;

        // Raycast Floor Plane (y = elev)
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elev);
        const hitPoint = new THREE.Vector3();
        const hasHit = this.raycaster.ray.intersectPlane(floorPlane, hitPoint);

        if (!hasHit) {
            this.hideGhost();
            return false;
        }

        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = false;
        }

        const preset = planner.activePresetParams || {};

        // Smooth Grid Snapping
        const isFine = e.shiftKey;
        const gridStep = isFine ? 1 : 10;
        const cursorX = Math.round(hitPoint.x / gridStep) * gridStep;
        const cursorZ = Math.round(hitPoint.z / gridStep) * gridStep;

        // Apply grab offset: ghost center = cursor + offset
        // This prevents the staircase from jumping when the user touches/clicks
        // on its edge, beginning, or any non-center point.
        const worldX = cursorX + this._grabOffset.x;
        const worldZ = cursorZ + this._grabOffset.z;

        this.activePos.set(worldX, elev, worldZ);

        // Update Ghost 3D Mesh (centers on cursor + offset)
        this.updateGhostModel(preset, worldX, elev, worldZ, this.activeRotation);

        // Update HUD Badge Information
        this.updateBadgeContent(e);

        dom.style.cursor = 'crosshair';
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
        const length = Number(preset.length) || (Number(preset.totalSteps || 12) * Number(preset.stepDepth || 28));
        const maxWallHeight = this.getActiveMaxWallHeight();
        const stairName = preset.name || 'Custom Staircase';
        const totalSteps = preset.totalSteps || (Number(preset.flight1Steps || 8) + Number(preset.flight2Steps || 7));
        const specsText = `${Math.round(width * 10)} × ${Math.round(length * 10)} mm • Height ${Math.round(maxWallHeight * 10)} mm • ${totalSteps} Steps`;
        const shape = preset.shape || (preset.type ? preset.type.replace('stair_v5_', '') : 'straight');
        const showFlip = (shape === 'L' || shape === 'U' || shape === 'T');

        if (this.elTitle) this.elTitle.textContent = stairName;
        if (this.elRot) this.elRot.textContent = `${this.activeRotation % 360}°`;
        if (this.elSpecs) this.elSpecs.textContent = specsText;
        if (this.btnFlip) this.btnFlip.style.display = showFlip ? 'flex' : 'none';

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

    updateGhostModel(preset, worldX, elev, worldZ, rotation) {
        this.ghostGroup.position.set(worldX, elev, worldZ);
        this.ghostGroup.rotation.y = -rotation * Math.PI / 180;
        this.ghostGroup.visible = true;

        const maxWallHeight = this.getActiveMaxWallHeight();
        const shape = preset.shape || (preset.type ? preset.type.replace('stair_v5_', '') : 'straight');
        const hash = `${preset.id}_${preset.type}_${shape}_${preset.width}_${preset.length}_${maxWallHeight}_${preset.totalSteps}_${preset.flight1Steps}_${preset.flight2Steps}_${this.activeTurnDirection}_${preset.stringerType}`;

        if (this._lastPresetHash !== hash) {
            this._lastPresetHash = hash;

            // Clear previous 3D ghost preview
            while (this.modelPreviewGroup.children.length > 0) {
                const child = this.modelPreviewGroup.children[0];
                this.modelPreviewGroup.remove(child);
            }

            const stairPayload = {
                ...preset,
                shape: shape,
                turnDirection: this.activeTurnDirection || preset.turnDirection || 'right',
                x: 0,
                y: 0,
                elevation: 0,
                rotation: 0
            };

            const tempWrapper = new THREE.Group();
            this.stairBuilder.build([stairPayload], tempWrapper, 0, true, maxWallHeight);
            tempWrapper.position.set(0, 0, 0);

            // ──── COMPUTE BOUNDING BOX CENTER ────
            // The bounding box of the staircase geometry tells us where the visual center is
            // relative to the staircase origin (0, 0, 0) = Step 1 base edge.
            const bbox = new THREE.Box3().setFromObject(tempWrapper);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            // Only use X and Z for floor-plane centering; Y stays at 0 (vertical center is irrelevant)
            this.localCenterOffset.set(center.x, 0, center.z);

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

            // Build Footprint Perimeter Lines & Scaled Arrow (both shifted by center offset)
            this.updateFootprintGeometry(stairPayload);
            this.updateDirectionArrow(stairPayload);
        }
    }

    updateFootprintGeometry(stairPayload) {
        // getStairCutoutPolygon returns [{x, y}, {x, y}, ...] in local coordinates (rotation=0, x=0, y=0)
        const pts = getStairCutoutPolygon(stairPayload);
        const cx = this.localCenterOffset.x;
        const cz = this.localCenterOffset.z;

        if (pts && pts.length >= 3) {
            const linePoints = [];
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % pts.length];
                // pts[i].x = local X, pts[i].y = local Z in 3D
                // Shift by -center so footprint aligns with the centered ghost model
                linePoints.push(new THREE.Vector3(p1.x - cx, 0.5, p1.y - cz));
                linePoints.push(new THREE.Vector3(p2.x - cx, 0.5, p2.y - cz));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
            this.footprintMesh.geometry.dispose();
            this.footprintMesh.geometry = geo;
            this.footprintMesh.visible = true;
        } else {
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

        const isTouch = e.pointerType === 'touch' || this.isTouchDevice();

        if (this.ghostGroup.visible) {
            // Ghost is already visible.
            // Compute grab offset = current ghost center - cursor floor point.
            // This preserves the relative position so the staircase doesn't jump
            // no matter where the user clicks/touches on the highlight (beginning, center, end).
            const floor = this._raycastFloor(e);
            if (floor) {
                this._grabOffset.set(
                    this.activePos.x - floor.x,
                    0,
                    this.activePos.z - floor.z
                );
                this._isGrabbing = true;
            }

            // Desktop: left-click places at the exact current activePos (no re-raycasting)
            if (!isTouch && e.button === 0) {
                return this.placeStaircase();
            }
            // Touch: wait for "Place" button. Touch drag will move with grab offset.
            return true;
        }

        // Ghost not visible yet — first click/touch initializes position (center-anchored)
        const floor = this._raycastFloor(e);
        if (floor) {
            this.activeElevation = floor.elev;
            this._grabOffset.set(0, 0, 0); // First interaction: cursor = center, no offset
            this._isGrabbing = false;
            this.activePos.set(floor.x, floor.elev, floor.z);
            const preset = this.getPlanner()?.activePresetParams || {};
            this.updateGhostModel(preset, floor.x, floor.elev, floor.z, this.activeRotation);
            this.updateBadgeContent(e);
            if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
        }

        if (!isTouch && e.button === 0) {
            return this.placeStaircase();
        }

        return true;
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
        if (this.activeTurnDirection) {
            stairData.turnDirection = this.activeTurnDirection;
        }

        const newStair = new PremiumStaircase(planner, shape, stairData);
        Object.assign(newStair, stairData);
        if (newStair.update) newStair.update();

        if (!planner.stairs) planner.stairs = [];
        planner.stairs.push(newStair);

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
                true, // Preserve camera angle & zoom
                planner.outdoorZones || []
            );
        }

        // 5. Select Placed Staircase in 3D Scene
        if (newStair.mesh3D && this.interactions) {
            newStair.mesh3D.updateWorldMatrix(true, true);
            this.interactions.selectObject(newStair.mesh3D, null, true);
        }

        // 6. Reset tool and sync
        planner.tool = 'select';
        if (typeof planner.updateToolStates === 'function') planner.updateToolStates();
        planner.syncAll();

        this.hideGhost();

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender('Staircase 3D Placement Complete', 5);
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

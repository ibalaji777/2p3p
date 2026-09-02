/**
 * UniversalMoveGizmo.js
 * Universal 3D Move & Translation System (CAD / Sims 4 Style).
 * 
 * Key Features:
 * 1. Adaptive 3D Ground Translation Pad with center planar grab disc, cardinal X/Z axes, and vertical Y handle.
 * 2. Click-and-drag anywhere on the object or gizmo for instant, smooth 60fps placement.
 * 3. 100% locked synchronization between object mesh, selection highlight, floor footprint, and dimension lines.
 * 4. Cross-platform pointer & touch raycasting with CAD magnetic grid snapping (1cm, 10cm, 50cm, Free).
 * 5. Ultra-sleek, compact, draggable Move HUD dock with 4-way precision D-Pad steppers, live XYZ inputs, and snap pills.
 * 6. Full in-place transformation and single-source-of-truth syncing across 2D/3D.
 */

import * as THREE from 'three';
import { ObjectCapabilityEvaluator } from './tools/ObjectCapabilityEvaluator.js';

export class UniversalMoveGizmo extends THREE.Group {
    /**
     * @param {Object} ctx - 3D Engine context (scene, camera, renderer, etc.)
     */
    constructor(ctx) {
        super();
        this.name = 'UniversalMoveGizmo';
        this.ctx = ctx;

        this.attachedObject = null;
        this.attachedEntity = null;

        // Interaction State
        this.isDragging = false;
        this.activeHandle = null; // 'center' | 'x' | 'z' | 'y'
        this.dragPlane = new THREE.Plane();
        this.startIntersection = new THREE.Vector3();
        this.startOrigin = new THREE.Vector3();
        this.startMeshPos = new THREE.Vector3();
        this.startGizmoPos = new THREE.Vector3();
        this.startEntityPosition = { x: 0, y: 0, z: 0, elevation: 0, t: 0.5 };
        this.snapMode = 10; // 10cm default CAD snap
        this._activePointerId = null;

        // Visual Components
        this.gizmoVisuals = new THREE.Group();
        this.gizmoVisuals.name = 'UniversalMove_Visuals';
        this.add(this.gizmoVisuals);

        this.dynamicLeaderLine = null;

        // Materials (High visibility, non-clipping, crisp rendering)
        this.matCenter = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
        this.matCenterHover = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, side: THREE.DoubleSide });

        this.matAxisX = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }); // Coral Red
        this.matAxisZ = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }); // Sky Cyan
        this.matAxisY = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }); // Emerald Green

        this.matGuideLine = new THREE.LineDashedMaterial({ color: 0x00f0ff, dashSize: 4, gapSize: 3, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false });

        // Raycasting
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Build DOM Badges & HUD Panel
        this._createHUDPanel();

        // Event Listeners
        this._bindEvents();
    }

    /* -------------------------------------------------------------------------- */
    /*                               ATTACH & DETACH                              */
    /* -------------------------------------------------------------------------- */

    /**
     * Attaches Move Gizmo to target 3D object or entity.
     * @param {THREE.Object3D} targetObject
     */
    attach(targetObject) {
        if (!targetObject) return;

        // Resolve mesh and entity
        const entity = targetObject.userData?.entity || targetObject.userData?.parentWall || null;
        let mesh = targetObject.isMesh || targetObject.isGroup ? targetObject : (entity?.mesh3D || null);

        if (entity && entity.mesh3D && mesh !== entity.mesh3D) {
            mesh = entity.mesh3D;
        }

        if (!mesh) return;

        // Check movability capability
        const caps = ObjectCapabilityEvaluator.getCapabilities(entity, mesh);
        if (!caps.movable) {
            this.detach();
            return;
        }

        this.attachedObject = mesh;
        this.attachedEntity = entity;

        // Calculate world position & bounding box
        mesh.updateMatrixWorld(true);
        const bbox = new THREE.Box3().setFromObject(mesh);
        const center = new THREE.Vector3();
        if (!bbox.isEmpty() && isFinite(bbox.min.x)) {
            bbox.getCenter(center);
            this.position.set(center.x, bbox.min.y + 0.05, center.z);
        } else {
            this.position.set(mesh.position.x, mesh.position.y + 0.05, mesh.position.z);
        }

        this.startOrigin.copy(this.position);
        this.startMeshPos.copy(mesh.position);
        this.startGizmoPos.copy(this.position);

        if (entity) {
            this.startEntityPosition = {
                x: mesh.position.x,
                y: mesh.position.z,
                z: mesh.position.y,
                elevation: entity.elevation !== undefined ? entity.elevation : mesh.position.y,
                t: entity.t !== undefined ? entity.t : 0.5
            };
        }

        // Build 3D Move Handles
        this._buildGizmoGeometry(bbox);

        this.visible = true;
        this.showHUD();
        this.syncHUD();

        if (this.ctx.requestRender) this.ctx.requestRender('universal_move_attach');
    }

    /**
     * Detaches Move Gizmo and cleans up visual elements.
     */
    detach() {
        this.attachedObject = null;
        this.attachedEntity = null;
        this.isDragging = false;
        this.activeHandle = null;
        this.visible = false;

        this._clearVisuals();
        this.hideHUD();

        if (this.ctx.requestRender) this.ctx.requestRender('universal_move_detach');
    }

    _clearVisuals() {
        while (this.gizmoVisuals.children.length > 0) {
            const child = this.gizmoVisuals.children[0];
            if (child.geometry) child.geometry.dispose();
            this.gizmoVisuals.remove(child);
        }
        if (this.dynamicLeaderLine && this.dynamicLeaderLine.parent) {
            this.dynamicLeaderLine.parent.remove(this.dynamicLeaderLine);
            this.dynamicLeaderLine.geometry.dispose();
            this.dynamicLeaderLine = null;
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                         3D GIZMO GEOMETRY GENERATION                       */
    /* -------------------------------------------------------------------------- */

    _buildGizmoGeometry(bbox) {
        this._clearVisuals();

        let sizeX = 40;
        let sizeZ = 40;
        if (bbox && !bbox.isEmpty() && isFinite(bbox.min.x)) {
            sizeX = Math.max(30, bbox.max.x - bbox.min.x);
            sizeZ = Math.max(30, bbox.max.z - bbox.min.z);
        }
        const radius = Math.max(25, Math.hypot(sizeX, sizeZ) * 0.35);

        // 1. Center Planar Grab Disc
        const centerDiscGeo = new THREE.CircleGeometry(radius * 0.35, 32);
        centerDiscGeo.rotateX(-Math.PI / 2);
        const centerDisc = new THREE.Mesh(centerDiscGeo, this.matCenter);
        centerDisc.name = 'handle_center';
        centerDisc.renderOrder = 9999;
        this.gizmoVisuals.add(centerDisc);

        // Center Ring Outline
        const centerRingGeo = new THREE.RingGeometry(radius * 0.34, radius * 0.37, 32);
        centerRingGeo.rotateX(-Math.PI / 2);
        const centerRing = new THREE.Mesh(centerRingGeo, this.matAxisZ);
        centerRing.renderOrder = 9999;
        this.gizmoVisuals.add(centerRing);

        // 2. X-Axis (Coral Red) Arm & Grab Handles (+X and -X)
        const armLength = radius * 1.35;
        const xLineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-armLength, 0.05, 0),
            new THREE.Vector3(armLength, 0.05, 0)
        ]);
        const xLine = new THREE.Line(xLineGeo, this.matAxisX);
        xLine.renderOrder = 9999;
        this.gizmoVisuals.add(xLine);

        // +X / -X Handles
        const handleXGeo = new THREE.SphereGeometry(radius * 0.12, 16, 16);
        const handlePosX = new THREE.Mesh(handleXGeo, this.matAxisX);
        handlePosX.position.set(armLength, 0.05, 0);
        handlePosX.name = 'handle_x';
        handlePosX.renderOrder = 9999;
        this.gizmoVisuals.add(handlePosX);

        const handleNegX = new THREE.Mesh(handleXGeo, this.matAxisX);
        handleNegX.position.set(-armLength, 0.05, 0);
        handleNegX.name = 'handle_x';
        handleNegX.renderOrder = 9999;
        this.gizmoVisuals.add(handleNegX);

        // 3. Z-Axis (Azure Blue) Arm & Grab Handles (+Z and -Z)
        const zLineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.05, -armLength),
            new THREE.Vector3(0, 0.05, armLength)
        ]);
        const zLine = new THREE.Line(zLineGeo, this.matAxisZ);
        zLine.renderOrder = 9999;
        this.gizmoVisuals.add(zLine);

        // +Z / -Z Handles
        const handleZGeo = new THREE.SphereGeometry(radius * 0.12, 16, 16);
        const handlePosZ = new THREE.Mesh(handleZGeo, this.matAxisZ);
        handlePosZ.position.set(0, 0.05, armLength);
        handlePosZ.name = 'handle_z';
        handlePosZ.renderOrder = 9999;
        this.gizmoVisuals.add(handlePosZ);

        const handleNegZ = new THREE.Mesh(handleZGeo, this.matAxisZ);
        handleNegZ.position.set(0, 0.05, -armLength);
        handleNegZ.name = 'handle_z';
        handleNegZ.renderOrder = 9999;
        this.gizmoVisuals.add(handleNegZ);

        // 4. Vertical Y-Axis (Emerald Green) - If Elevation Supported
        const supportsElevation = this.attachedEntity?.elevation !== undefined || this.attachedEntity?.wall;
        if (supportsElevation) {
            const yHeight = radius * 1.2;
            const yLineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0.05, 0),
                new THREE.Vector3(0, yHeight, 0)
            ]);
            const yLine = new THREE.Line(yLineGeo, this.matAxisY);
            yLine.renderOrder = 9999;
            this.gizmoVisuals.add(yLine);

            const handleYGeo = new THREE.SphereGeometry(radius * 0.12, 16, 16);
            const handlePosY = new THREE.Mesh(handleYGeo, this.matAxisY);
            handlePosY.position.set(0, yHeight, 0);
            handlePosY.name = 'handle_y';
            handlePosY.renderOrder = 9999;
            this.gizmoVisuals.add(handlePosY);
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                         CROSS-PLATFORM POINTER EVENTS                      */
    /* -------------------------------------------------------------------------- */

    _bindEvents() {
        const dom = this.ctx.renderer?.domElement || window;

        this._onPointerDown = (e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            if (this.ctx.viewMode3D === 'preview') return;

            this._updateMouseCoords(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

            let handleName = null;

            // 1. Check Gizmo Handles
            if (this.visible && this.gizmoVisuals.children.length > 0) {
                const gizmoIntersects = this.raycaster.intersectObjects(this.gizmoVisuals.children, true);
                if (gizmoIntersects.length > 0) {
                    handleName = gizmoIntersects[0].object.name;
                }
            }

            // 2. Check if clicked anywhere on the currently Attached Object
            if (!handleName && this.attachedObject) {
                const objIntersects = this.raycaster.intersectObject(this.attachedObject, true);
                if (objIntersects.length > 0) {
                    handleName = 'handle_center';
                }
            }

            // 3. Check if clicking on any movable interactable in the scene
            if (!handleName && this.ctx.interactables) {
                const allIntersects = this.raycaster.intersectObjects(this.ctx.interactables, true);
                const validHits = allIntersects.filter(i => i.object && !i.object.userData?.isHitbox && i.object.material && i.object.material.opacity !== 0);
                if (validHits.length > 0) {
                    let hitObj = validHits[0].object;
                    while (hitObj.parent && !hitObj.userData.isFurniture && !hitObj.userData.isWallSide && !hitObj.userData.isWallDecor && !hitObj.userData.isFloor && !hitObj.userData.isWidget && !hitObj.userData.isMolding && !hitObj.userData.isRoof && !hitObj.userData.isPattern && !hitObj.userData.isStair && !hitObj.userData.isFloorCutProxy && !hitObj.userData.isRoofAddon && !hitObj.userData.isRoofSculpture && !hitObj.userData.isSkylight) {
                        hitObj = hitObj.parent;
                    }
                    const ent = hitObj.userData?.entity || hitObj.parent?.userData?.entity;
                    const targetMesh = ent?.mesh3D || hitObj;
                    const caps = ObjectCapabilityEvaluator.getCapabilities(ent, targetMesh);
                    if (caps.movable) {
                        this.attach(targetMesh);
                        if (this.ctx.interactions?.selectObject) {
                            this.ctx.interactions.selectObject(targetMesh);
                        }
                        handleName = 'handle_center';
                    }
                }
            }

            if (handleName && this.attachedObject) {
                this.isDragging = true;
                this.activeHandle = handleName.replace('handle_', ''); // 'center' | 'x' | 'z' | 'y'

                if (this.ctx.controls) this.ctx.controls.enabled = false;

                try {
                    if (dom.setPointerCapture && e.pointerId !== undefined) {
                        dom.setPointerCapture(e.pointerId);
                        this._activePointerId = e.pointerId;
                    }
                } catch (_) {}

                // Setup Drag Plane
                if (this.activeHandle === 'y') {
                    const normal = new THREE.Vector3();
                    this.ctx.camera.getWorldDirection(normal);
                    normal.y = 0;
                    normal.normalize();
                    this.dragPlane.setFromNormalAndCoplanarPoint(normal, this.position);
                } else {
                    this.dragPlane.set(new THREE.Vector3(0, 1, 0), -this.position.y);
                }

                this.raycaster.ray.intersectPlane(this.dragPlane, this.startIntersection);
                this.startOrigin.copy(this.position);
                this.startMeshPos.copy(this.attachedObject.position);
                this.startGizmoPos.copy(this.position);

                const ent = this.attachedEntity;
                if (ent) {
                    this.startEntityPosition = {
                        x: this.startMeshPos.x,
                        y: this.startMeshPos.z,
                        z: this.startMeshPos.y,
                        elevation: ent.elevation !== undefined ? ent.elevation : this.startMeshPos.y,
                        t: ent.t !== undefined ? ent.t : 0.5
                    };
                }

                // Immediate highlight & footprint lock
                if (this.ctx.interactions?.highlightRenderer) {
                    this.ctx.interactions.highlightRenderer.setSelectionHighlight(this.attachedObject);
                }
                if (this.ctx.interactions?._updateSims4Footprint) {
                    this.ctx.interactions._updateSims4Footprint(this.attachedObject);
                }

                e.stopPropagation();
                e.preventDefault();
            }
        };

        this._onPointerMove = (e) => {
            if (this.ctx.viewMode3D === 'preview') return;
            this._updateMouseCoords(e);

            if (this.isDragging && this.attachedObject) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const currentHit = new THREE.Vector3();

                if (this.raycaster.ray.intersectPlane(this.dragPlane, currentHit)) {
                    const delta = new THREE.Vector3().subVectors(currentHit, this.startIntersection);

                    // Constrain delta according to active handle
                    if (this.activeHandle === 'x') {
                        delta.z = 0;
                        delta.y = 0;
                    } else if (this.activeHandle === 'z') {
                        delta.x = 0;
                        delta.y = 0;
                    } else if (this.activeHandle === 'y') {
                        delta.x = 0;
                        delta.z = 0;
                    } else if (e.shiftKey) {
                        // Shift-lock: predominant single horizontal axis
                        if (Math.abs(delta.x) > Math.abs(delta.z)) {
                            delta.z = 0;
                        } else {
                            delta.x = 0;
                        }
                    }

                    // Apply Magnetic Grid Snapping
                    if (this.snapMode > 1 && !e.altKey) {
                        delta.x = Math.round(delta.x / this.snapMode) * this.snapMode;
                        delta.y = Math.round(delta.y / this.snapMode) * this.snapMode;
                        delta.z = Math.round(delta.z / this.snapMode) * this.snapMode;
                    }

                    this._applyTranslation(delta);
                    this._updateLeaderLine(this.startGizmoPos, this.position);
                    this.syncHUD();

                    // Keep visual highlight, footprint and dimensions 100% updated in real-time
                    if (this.ctx.interactions?.highlightRenderer) {
                        this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
                    }
                    if (this.ctx.interactions?._updateSims4Footprint) {
                        this.ctx.interactions._updateSims4Footprint(this.attachedObject);
                    }
                    if (this.ctx.interactions?.dimensionManager) {
                        this.ctx.interactions.dimensionManager.update();
                    }

                    if (this.ctx.requestRender) this.ctx.requestRender('universal_move_drag');
                }
            } else if (this.visible && this.attachedObject) {
                // Hover cursor
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const intersects = this.raycaster.intersectObjects(this.gizmoVisuals.children, true);
                if (intersects.length > 0) {
                    dom.style.cursor = 'grab';
                } else if (this.raycaster.intersectObject(this.attachedObject, true).length > 0) {
                    dom.style.cursor = 'grab';
                } else if (dom.style.cursor === 'grab') {
                    dom.style.cursor = 'default';
                }
            }
        };

        this._onPointerUp = (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                this.activeHandle = null;

                try {
                    if (dom.releasePointerCapture && this._activePointerId !== undefined && this._activePointerId !== null) {
                        dom.releasePointerCapture(this._activePointerId);
                        this._activePointerId = null;
                    }
                } catch (_) {}

                if (this.ctx.controls) this.ctx.controls.enabled = true;
                this._commitTranslationToPlanner();
                if (this.dynamicLeaderLine && this.dynamicLeaderLine.parent) {
                    this.dynamicLeaderLine.parent.remove(this.dynamicLeaderLine);
                }
                if (this.ctx.interactions?.highlightRenderer) {
                    this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
                }
                if (this.ctx.interactions?._updateSims4Footprint) {
                    this.ctx.interactions._updateSims4Footprint(this.attachedObject);
                }
                if (this.ctx.requestRender) this.ctx.requestRender('universal_move_end');
            }
        };

        dom.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
    }

    _updateMouseCoords(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    /* -------------------------------------------------------------------------- */
    /*                         TRANSLATION ENGINE EXECUTION                       */
    /* -------------------------------------------------------------------------- */

    _applyTranslation(delta, targetWorldPos = null) {
        if (!this.attachedObject || !this.attachedEntity) return;

        const ent = this.attachedEntity;

        // 1. Wall-Mounted Opening / Plugin Translation along Host Wall
        if (ent.wall && ent.wall.mesh3D) {
            const wall = ent.wall;
            const wallLength = wall.length3D || 100;
            const startT = this.startEntityPosition.t !== undefined ? this.startEntityPosition.t : 0.5;
            const startLocalX = startT * wallLength;
            const newLocalX = Math.max(5, Math.min(wallLength - 5, startLocalX + delta.x));
            ent.t = newLocalX / wallLength;

            if (delta.y !== 0 && ent.elevation !== undefined) {
                const wallH = wall.height || wall.config?.height || 300;
                const opH = ent.height || 80;
                const startElev = this.startEntityPosition.elevation || 0;
                ent.elevation = Math.max(0, Math.min(wallH - opH, startElev + delta.y));
            }

            if (this.ctx.realtimeUpdate) {
                this.ctx.realtimeUpdate.markDirty(ent, 'geometry');
            }

            // Keep gizmo centered on opening
            this.attachedObject.updateMatrixWorld(true);
            const bbox = new THREE.Box3().setFromObject(this.attachedObject);
            const center = new THREE.Vector3();
            if (!bbox.isEmpty() && isFinite(bbox.min.x)) {
                bbox.getCenter(center);
                this.position.set(center.x, bbox.min.y + 0.05, center.z);
            }
        }
        // 2. Free Planar Objects (Furniture, Shapes, Stairs, Roofs, Elevation Elements)
        else {
            const newX = this.startMeshPos.x + delta.x;
            const newZ = this.startMeshPos.z + delta.z;
            const newY = this.startMeshPos.y + (delta.y || 0);

            this.attachedObject.position.x = newX;
            this.attachedObject.position.z = newZ;
            if (delta.y !== 0) {
                this.attachedObject.position.y = newY;
            }
            this.attachedObject.updateMatrixWorld(true);

            ent.x = newX;
            ent.y = newZ;
            if (ent.elevation !== undefined && delta.y !== 0) {
                ent.elevation = newY;
            }

            if (ent.group && typeof ent.group.x === 'function') {
                ent.group.x(newX);
                ent.group.y(newZ);
            }

            if (typeof ent.update2D === 'function') {
                ent.update2D();
            }

            if (this.ctx.realtimeUpdate) {
                this.ctx.realtimeUpdate.markDirty(ent, 'transform');
            }

            // Always lock gizmo position strictly to the object's bottom center
            const bbox = new THREE.Box3().setFromObject(this.attachedObject);
            const center = new THREE.Vector3();
            if (!bbox.isEmpty() && isFinite(bbox.min.x)) {
                bbox.getCenter(center);
                this.position.set(center.x, bbox.min.y + 0.05, center.z);
            } else {
                this.position.set(newX, newY + 0.05, newZ);
            }
        }
    }

    _updateLeaderLine(fromPos, toPos) {
        if (this.dynamicLeaderLine && this.dynamicLeaderLine.parent) {
            this.dynamicLeaderLine.parent.remove(this.dynamicLeaderLine);
        }

        const points = [fromPos.clone(), toPos.clone()];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        this.dynamicLeaderLine = new THREE.Line(geo, this.matGuideLine);
        this.dynamicLeaderLine.renderOrder = 9998;
        if (this.parent) this.parent.add(this.dynamicLeaderLine);
    }

    _commitTranslationToPlanner() {
        if (!this.attachedEntity) return;
        const ent = this.attachedEntity;
        const id = ent.id || (ent.group && typeof ent.group.id === 'function' ? ent.group.id() : null);
        const plannerInst = window.planner?.value || window.planner || window.plannerInstance;

        if (plannerInst) {
            if (typeof plannerInst.move === 'function' && id) {
                plannerInst.move(id, ent.x, ent.y);
            } else if (typeof plannerInst.setEntityPosition === 'function' && id) {
                plannerInst.setEntityPosition(id, ent.x, ent.y, ent.elevation);
            }
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                    RESPONSIVE CROSS-DEVICE MOVE HUD DOCK                   */
    /* -------------------------------------------------------------------------- */

    _createHUDPanel() {
        this.hudPanel = document.createElement('div');
        this.hudPanel.className = 'universal-move-hud-panel';
        this.hudPanel.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            display: none; flex-direction: column; align-items: center; gap: 6px; width: 195px;
            background: rgba(15, 23, 42, 0.94); color: white; padding: 8px 10px;
            border-radius: 16px; border: 1.5px solid rgba(0, 240, 255, 0.45);
            box-shadow: 0 14px 36px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 240, 255, 0.2);
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            z-index: 100000; font-family: 'Inter', system-ui, -apple-system, sans-serif;
            pointer-events: auto; user-select: none; transition: box-shadow 0.2s ease;
        `;

        this.hudPanel.innerHTML = `
            <!-- Header: Draggable Grip Bar & Close -->
            <div id="move-hud-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: grab; touch-action: none;">
                <div style="display: flex; align-items: center; gap: 5px;">
                    <span style="color: #64748b; font-size: 13px; letter-spacing: -1px; user-select: none;">⠿</span>
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: rgba(0, 240, 255, 0.15); color: #00f0ff; font-size: 10px;">⬌</span>
                    <span style="font-size: 11px; font-weight: 800; color: #f1f5f9; letter-spacing: 0.5px;">MOVE</span>
                </div>
                <button id="move-btn-close-hud" style="background: transparent; border: none; color: #64748b; font-size: 12px; cursor: pointer; padding: 0 2px; line-height: 1; transition: color 0.15s;" title="Close">✕</button>
            </div>

            <!-- Precision 4-Way D-Pad Steppers -->
            <div style="display: grid; grid-template-columns: repeat(3, 34px); grid-template-rows: repeat(3, 26px); gap: 3px; align-items: center; justify-content: center; margin: 2px 0;">
                <div></div>
                <button id="move-btn-dpad-n" class="move-dpad-btn" style="width: 34px; height: 26px; border-radius: 5px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Move North (+Z)">▲</button>
                <div></div>

                <button id="move-btn-dpad-w" class="move-dpad-btn" style="width: 34px; height: 26px; border-radius: 5px; background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.35); color: #f43f5e; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Move West (-X)">◀</button>
                <button id="move-btn-center-reset" style="width: 34px; height: 26px; border-radius: 5px; background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.25); color: #00f0ff; font-size: 10px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Center">🎯</button>
                <button id="move-btn-dpad-e" class="move-dpad-btn" style="width: 34px; height: 26px; border-radius: 5px; background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.35); color: #f43f5e; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Move East (+X)">▶</button>

                <div></div>
                <button id="move-btn-dpad-s" class="move-dpad-btn" style="width: 34px; height: 26px; border-radius: 5px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Move South (-Z)">▼</button>
                <div></div>
            </div>

            <!-- Direct Numeric Coordinates (X, Z) -->
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 4px; padding: 2px 0;">
                <div style="display: flex; align-items: center; gap: 2px;">
                    <span style="font-size: 9px; font-weight: 800; color: #f43f5e;">X:</span>
                    <input type="number" id="move-hud-input-x" step="10" value="0" style="width: 44px; background: rgba(0,0,0,0.45); border: 1px solid rgba(244,63,94,0.35); color: white; border-radius: 4px; padding: 2px 3px; font-size: 9.5px; font-weight: 700; text-align: right; outline: none;">
                </div>
                <div style="display: flex; align-items: center; gap: 2px;">
                    <span style="font-size: 9px; font-weight: 800; color: #38bdf8;">Z:</span>
                    <input type="number" id="move-hud-input-z" step="10" value="0" style="width: 44px; background: rgba(0,0,0,0.45); border: 1px solid rgba(38,189,248,0.35); color: white; border-radius: 4px; padding: 2px 3px; font-size: 9.5px; font-weight: 700; text-align: right; outline: none;">
                </div>
            </div>

            <!-- Snap Pills Strip -->
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding-top: 3px; border-top: 1px solid rgba(255,255,255,0.08);">
                <span style="font-size: 8.5px; color: #94a3b8; font-weight: 700;">SNAP</span>
                <div style="display: flex; gap: 2px; align-items: center; background: rgba(0,0,0,0.35); padding: 1.5px 3px; border-radius: 4px;">
                    <button class="move-snap-mode-btn" data-snap="1" style="padding: 2px 4px; font-size: 8px; font-weight: 700; border-radius: 3px; background: transparent; color: #94a3b8; border: none; cursor: pointer;">1cm</button>
                    <button class="move-snap-mode-btn active" data-snap="10" style="padding: 2px 4px; font-size: 8px; font-weight: 700; border-radius: 3px; background: #00f0ff; color: #0f172a; border: none; cursor: pointer;">10cm</button>
                    <button class="move-snap-mode-btn" data-snap="50" style="padding: 2px 4px; font-size: 8px; font-weight: 700; border-radius: 3px; background: transparent; color: #94a3b8; border: none; cursor: pointer;">50cm</button>
                    <button class="move-snap-mode-btn" data-snap="0" style="padding: 2px 4px; font-size: 8px; font-weight: 700; border-radius: 3px; background: transparent; color: #94a3b8; border: none; cursor: pointer;">FREE</button>
                </div>
            </div>
        `;

        this.hudPanel.addEventListener('pointerdown', e => e.stopPropagation());
        document.body.appendChild(this.hudPanel);

        this._initHUDPanelEvents();
    }

    _initHUDPanelEvents() {
        if (!this.hudPanel) return;

        // 1. Draggable Window Logic
        const headerEl = this.hudPanel.querySelector('#move-hud-header');
        if (headerEl) {
            let isDraggingHUD = false;
            let dragOffsetX = 0;
            let dragOffsetY = 0;

            const onHeaderPointerDown = (e) => {
                if (e.target.closest('button')) return;
                isDraggingHUD = true;
                headerEl.style.cursor = 'grabbing';
                const rect = this.hudPanel.getBoundingClientRect();
                dragOffsetX = e.clientX - rect.left;
                dragOffsetY = e.clientY - rect.top;
                this.hudPanel.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 24px rgba(0, 240, 255, 0.4)';
                e.preventDefault();
            };

            const onWindowPointerMove = (e) => {
                if (!isDraggingHUD) return;
                let x = e.clientX - dragOffsetX;
                let y = e.clientY - dragOffsetY;

                const pad = 8;
                x = Math.max(pad, Math.min(window.innerWidth - this.hudPanel.offsetWidth - pad, x));
                y = Math.max(pad, Math.min(window.innerHeight - this.hudPanel.offsetHeight - pad, y));

                this.hudPanel.style.left = `${x}px`;
                this.hudPanel.style.top = `${y}px`;
                this.hudPanel.style.bottom = 'auto';
                this.hudPanel.style.transform = 'none';
            };

            const onWindowPointerUp = () => {
                if (isDraggingHUD) {
                    isDraggingHUD = false;
                    headerEl.style.cursor = 'grab';
                    this.hudPanel.style.boxShadow = '0 14px 36px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 240, 255, 0.2)';
                }
            };

            headerEl.addEventListener('pointerdown', onHeaderPointerDown);
            window.addEventListener('pointermove', onWindowPointerMove);
            window.addEventListener('pointerup', onWindowPointerUp);
        }

        // Close Button
        const btnClose = this.hudPanel.querySelector('#move-btn-close-hud');
        if (btnClose) {
            btnClose.onclick = () => {
                if (this.ctx.commonController) {
                    this.ctx.commonController.setTool('select');
                } else if (this.ctx.gizmoManager) {
                    this.ctx.gizmoManager.setTransformMode('none');
                } else {
                    this.detach();
                }
            };
            btnClose.onmouseenter = () => { btnClose.style.color = '#ef4444'; };
            btnClose.onmouseleave = () => { btnClose.style.color = '#64748b'; };
        }

        // D-Pad Steppers (N, S, W, E)
        const step = (dx, dz) => {
            if (!this.attachedObject) return;
            const stepDist = this.snapMode > 0 ? this.snapMode : 10;
            const delta = new THREE.Vector3(dx * stepDist, 0, dz * stepDist);
            this.startMeshPos.copy(this.attachedObject.position);
            this.startGizmoPos.copy(this.position);
            this._applyTranslation(delta);
            this._commitTranslationToPlanner();
            this.syncHUD();
            if (this.ctx.interactions?.highlightRenderer) {
                this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
            }
            if (this.ctx.interactions?._updateSims4Footprint) {
                this.ctx.interactions._updateSims4Footprint(this.attachedObject);
            }
            if (this.ctx.requestRender) this.ctx.requestRender('move_dpad_step');
        };

        const btnN = this.hudPanel.querySelector('#move-btn-dpad-n');
        const btnS = this.hudPanel.querySelector('#move-btn-dpad-s');
        const btnW = this.hudPanel.querySelector('#move-btn-dpad-w');
        const btnE = this.hudPanel.querySelector('#move-btn-dpad-e');

        if (btnN) btnN.onclick = () => step(0, 1);
        if (btnS) btnS.onclick = () => step(0, -1);
        if (btnW) btnW.onclick = () => step(-1, 0);
        if (btnE) btnE.onclick = () => step(1, 0);

        // Center / Reset Button
        const btnCenter = this.hudPanel.querySelector('#move-btn-center-reset');
        if (btnCenter) {
            btnCenter.onclick = () => {
                if (this.attachedEntity && this.attachedObject) {
                    this.startMeshPos.set(0, this.attachedObject.position.y, 0);
                    this.attachedEntity.x = 0;
                    this.attachedEntity.y = 0;
                    this.attachedObject.position.x = 0;
                    this.attachedObject.position.z = 0;
                    this.attachedObject.updateMatrixWorld(true);

                    if (this.attachedEntity.group && typeof this.attachedEntity.group.x === 'function') {
                        this.attachedEntity.group.x(0);
                        this.attachedEntity.group.y(0);
                    }
                    if (typeof this.attachedEntity.update2D === 'function') {
                        this.attachedEntity.update2D();
                    }

                    const bbox = new THREE.Box3().setFromObject(this.attachedObject);
                    const center = new THREE.Vector3();
                    if (!bbox.isEmpty() && isFinite(bbox.min.x)) {
                        bbox.getCenter(center);
                        this.position.set(center.x, bbox.min.y + 0.05, center.z);
                    } else {
                        this.position.set(0, this.position.y, 0);
                    }

                    this._commitTranslationToPlanner();
                    this.syncHUD();
                    if (this.ctx.interactions?.highlightRenderer) {
                        this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
                    }
                    if (this.ctx.interactions?._updateSims4Footprint) {
                        this.ctx.interactions._updateSims4Footprint(this.attachedObject);
                    }
                    if (this.ctx.requestRender) this.ctx.requestRender('move_center_reset');
                }
            };
        }

        // Direct Coordinate Inputs (X, Z)
        const inputX = this.hudPanel.querySelector('#move-hud-input-x');
        const inputZ = this.hudPanel.querySelector('#move-hud-input-z');

        if (inputX) {
            inputX.onchange = (e) => {
                const valX = parseFloat(e.target.value) || 0;
                if (this.attachedEntity && this.attachedObject) {
                    const deltaX = valX - (this.attachedEntity.x !== undefined ? this.attachedEntity.x : this.attachedObject.position.x);
                    this.startMeshPos.copy(this.attachedObject.position);
                    this.startGizmoPos.copy(this.position);
                    this._applyTranslation(new THREE.Vector3(deltaX, 0, 0));
                    this._commitTranslationToPlanner();
                    this.syncHUD();
                    if (this.ctx.interactions?.highlightRenderer) {
                        this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
                    }
                    if (this.ctx.interactions?._updateSims4Footprint) {
                        this.ctx.interactions._updateSims4Footprint(this.attachedObject);
                    }
                    if (this.ctx.requestRender) this.ctx.requestRender('move_input_x');
                }
            };
        }

        if (inputZ) {
            inputZ.onchange = (e) => {
                const valZ = parseFloat(e.target.value) || 0;
                if (this.attachedEntity && this.attachedObject) {
                    const deltaZ = valZ - (this.attachedEntity.y !== undefined ? this.attachedEntity.y : this.attachedObject.position.z);
                    this.startMeshPos.copy(this.attachedObject.position);
                    this.startGizmoPos.copy(this.position);
                    this._applyTranslation(new THREE.Vector3(0, 0, deltaZ));
                    this._commitTranslationToPlanner();
                    this.syncHUD();
                    if (this.ctx.interactions?.highlightRenderer) {
                        this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
                    }
                    if (this.ctx.interactions?._updateSims4Footprint) {
                        this.ctx.interactions._updateSims4Footprint(this.attachedObject);
                    }
                    if (this.ctx.requestRender) this.ctx.requestRender('move_input_z');
                }
            };
        }

        // Snap Mode Buttons
        const snapBtns = this.hudPanel.querySelectorAll('.move-snap-mode-btn');
        snapBtns.forEach(btn => {
            btn.onclick = () => {
                snapBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.color = '#94a3b8';
                });
                btn.classList.add('active');
                btn.style.background = '#00f0ff';
                btn.style.color = '#0f172a';
                this.snapMode = parseInt(btn.getAttribute('data-snap'), 10) || 0;
            };
        });
    }

    showHUD() {
        if (this.hudPanel) {
            this.hudPanel.style.display = 'flex';
        }
    }

    hideHUD() {
        if (this.hudPanel) {
            this.hudPanel.style.display = 'none';
        }
    }

    syncHUD() {
        if (!this.hudPanel || !this.attachedObject) return;

        const inputX = this.hudPanel.querySelector('#move-hud-input-x');
        const inputZ = this.hudPanel.querySelector('#move-hud-input-z');

        const curX = Math.round(this.attachedEntity?.x !== undefined ? this.attachedEntity.x : this.attachedObject.position.x);
        const curZ = Math.round(this.attachedEntity?.y !== undefined ? this.attachedEntity.y : this.attachedObject.position.z);

        if (inputX && document.activeElement !== inputX) inputX.value = curX;
        if (inputZ && document.activeElement !== inputZ) inputZ.value = curZ;
    }

    /* -------------------------------------------------------------------------- */
    /*                              CLEANUP & DISPOSE                             */
    /* -------------------------------------------------------------------------- */

    dispose() {
        this.detach();
        if (this.hudPanel && this.hudPanel.parentNode) {
            this.hudPanel.parentNode.removeChild(this.hudPanel);
        }
    }
}

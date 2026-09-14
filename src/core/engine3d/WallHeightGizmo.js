import * as THREE from 'three';
import { EVENTS } from '../constants/events.js';
import { coreEventBus } from '../EventBus.js';
import { WallEngine } from '../wall/WallEngine.js';
import { WallHeightPolicy } from '../wall/WallHeightPolicy.js';
import { WallConnectivity } from '../wall/WallConnectivity.js';
import { WallHeightTransaction } from '../wall/WallHeightTransaction.js';

/**
 * WallHeightGizmo
 * 
 * Provides interactive 3D height & slope handles:
 * 1. Center-Top Vertical Arrow: Adjusts overall wall height (w.height) with live HUD feedback.
 * 2. Left-Top & Right-Top Handles: Adjusts independent sloped top heights (startHeight, endHeight).
 * 3. Unified WallHeightTransaction with guaranteed atomic Undo/Redo (SnapshotCommand finalize).
 * 4. Camera-distance scaling and mobile-friendly touch targets.
 */
export class WallHeightGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.target = null;
        this.visible = false;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.isDragging = false;
        this.activeHandle = null;
        this.dragPlane = new THREE.Plane();
        this.dragStartPoint = new THREE.Vector3();
        this.initialH = WallHeightPolicy.DEFAULT_HEIGHT;
        this.initialStartH = WallHeightPolicy.DEFAULT_HEIGHT;
        this.initialEndH = WallHeightPolicy.DEFAULT_HEIGHT;
        this._capturedPointerId = null;
        this.transaction = null;
        
        this.handles = new THREE.Group();
        this.handles.name = 'WallHeight_Handles';
        this.add(this.handles);
        
        // Materials
        this.matHeight = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.matSlope = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 });
        this.matHover = new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false, transparent: true, opacity: 1.0 });
        this.matActive = new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false, transparent: true, opacity: 1.0 });

        this._createLiveBadge();
        
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onCameraChange = this._onCameraChange.bind(this);
        
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
            dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
            dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
        }

        if (this.ctx.controls) {
            this.ctx.controls.addEventListener('change', this._onCameraChange);
        }
    }

    _createLiveBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'sims4-wallheight-badge';
        this.domBadge.style.cssText = `
            position: fixed;
            display: none;
            transform: translate(-50%, -100%);
            padding: 5px 12px;
            border-radius: 9999px;
            background: rgba(15, 23, 42, 0.94);
            border: 2px solid #10b981;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7), 0 0 16px rgba(16, 185, 129, 0.4);
            color: #ffffff;
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
            pointer-events: none;
            z-index: 100005;
            user-select: none;
            backdrop-filter: blur(8px);
        `;
        document.body.appendChild(this.domBadge);
    }

    _updateBadgeText(text, clientX = null, clientY = null) {
        if (!this.domBadge) return;
        this.domBadge.textContent = text;
        this.domBadge.style.display = 'block';

        if (clientX !== null && clientY !== null) {
            this.domBadge.style.left = `${clientX}px`;
            this.domBadge.style.top = `${clientY - 18}px`;
        } else if (this.centerHandleGroup && this.ctx.camera && this.ctx.renderer) {
            const worldPos = new THREE.Vector3();
            this.centerHandleGroup.getWorldPosition(worldPos);
            worldPos.y += 10;
            worldPos.project(this.ctx.camera);
            const dom = this.ctx.renderer.domElement;
            const rect = dom.getBoundingClientRect();
            const x = (worldPos.x * 0.5 + 0.5) * rect.width + rect.left;
            const y = (-(worldPos.y * 0.5) + 0.5) * rect.height + rect.top;
            this.domBadge.style.left = `${Math.round(x)}px`;
            this.domBadge.style.top = `${Math.round(y)}px`;
        }
    }

    _hideBadge() {
        if (this.domBadge) this.domBadge.style.display = 'none';
    }

    _onCameraChange() {
        if (this.visible) {
            this._updateHandleScales();
        }
    }

    _updateHandleScales() {
        if (!this.ctx.camera) return;
        const cam = this.ctx.camera;
        this.handles.children.forEach(group => {
            const worldPos = new THREE.Vector3();
            group.getWorldPosition(worldPos);
            const dist = cam.position.distanceTo(worldPos);
            const scale = Math.max(0.5, Math.min(2.5, dist / 320));
            group.scale.set(scale, scale, scale);
        });
    }

    updateMouse(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    attach(object) {
        if (!object) return;
        this.target = object;
        this.visible = true;
        this.isDragging = false;
        this.activeHandle = null;
        this.updateHandles();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.isDragging = false;
        this.activeHandle = null;
        this._hideBadge();
        while (this.handles.children.length > 0) {
            const c = this.handles.children[0];
            this.handles.remove(c);
            if (c.geometry) c.geometry.dispose();
        }
    }

    _getWallEntity() {
        if (!this.target) return null;
        if (this.target.userData?.entity) return this.target.userData.entity;
        if (this.target.userData?.isWallSide || this.target.userData?.isWall) return this.target.userData.entity;
        if (this.target.parent?.userData?.entity) return this.target.parent.userData.entity;
        return null;
    }

    updateHandles() {
        while (this.handles.children.length > 0) {
            const c = this.handles.children[0];
            this.handles.remove(c);
            if (c.geometry) c.geometry.dispose();
        }

        const wall = this._getWallEntity();
        if (!wall) return;

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
        
        const midX = (p1.x + p2.x) / 2;
        const midZ = (p1.y + p2.y) / 2;
        const wallBaseY = (wall.elevation || 0);
        const wallH = (wall.height !== undefined ? wall.height : WallHeightPolicy.resolveDefault(wall));
        const startH = (wall.startHeight !== undefined ? wall.startHeight : wallH);
        const endH = (wall.endHeight !== undefined ? wall.endHeight : wallH);
        const peakH = (wall.peakHeight !== undefined ? wall.peakHeight : wallH);
        const profileType = wall.topProfileType || 'normal';

        // 1. Center Vertical Height Up/Down Arrow
        const centerGroup = new THREE.Group();
        centerGroup.position.set(midX, wallBaseY + (profileType === 'gable' ? peakH : wallH) + 6, midZ);
        centerGroup.userData = { isWallHeightHandle: true, handleType: 'uniform_height' };
        this.centerHandleGroup = centerGroup;
        
        // Generous invisible hit collider for touch/mobile
        const hitGeo = new THREE.CylinderGeometry(14, 14, 30, 12);
        const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.userData = { isWallHeightHandle: true, handleType: 'uniform_height' };
        centerGroup.add(hitMesh);

        const arrowGeo = new THREE.ConeGeometry(5, 14, 16);
        const arrowMesh = new THREE.Mesh(arrowGeo, this.matHeight.clone());
        arrowMesh.userData = { isWallHeightHandle: true, handleType: 'uniform_height' };
        centerGroup.add(arrowMesh);

        const stemGeo = new THREE.CylinderGeometry(1.6, 1.6, 12, 12);
        stemGeo.translate(0, -6, 0);
        const stemMesh = new THREE.Mesh(stemGeo, this.matHeight.clone());
        stemMesh.userData = { isWallHeightHandle: true, handleType: 'uniform_height' };
        centerGroup.add(stemMesh);
        this.handles.add(centerGroup);

        // 2. Left Slope Handle (startHeight)
        const leftSlopeGroup = new THREE.Group();
        leftSlopeGroup.position.set(p1.x, wallBaseY + startH + 4, p1.y);
        leftSlopeGroup.userData = { isWallHeightHandle: true, handleType: 'start_slope' };
        
        const leftHit = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16), new THREE.MeshBasicMaterial({ visible: false }));
        leftHit.userData = { isWallHeightHandle: true, handleType: 'start_slope' };
        leftSlopeGroup.add(leftHit);

        const leftBox = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), this.matSlope.clone());
        leftBox.userData = { isWallHeightHandle: true, handleType: 'start_slope' };
        leftSlopeGroup.add(leftBox);
        this.handles.add(leftSlopeGroup);

        // 3. Right Slope Handle (endHeight)
        const rightSlopeGroup = new THREE.Group();
        rightSlopeGroup.position.set(p2.x, wallBaseY + endH + 4, p2.y);
        rightSlopeGroup.userData = { isWallHeightHandle: true, handleType: 'end_slope' };
        
        const rightHit = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16), new THREE.MeshBasicMaterial({ visible: false }));
        rightHit.userData = { isWallHeightHandle: true, handleType: 'end_slope' };
        rightSlopeGroup.add(rightHit);

        const rightBox = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), this.matSlope.clone());
        rightBox.userData = { isWallHeightHandle: true, handleType: 'end_slope' };
        rightSlopeGroup.add(rightBox);
        this.handles.add(rightSlopeGroup);

        this._updateHandleScales();
    }

    _onPointerDown(e) {
        if (!this.visible) return;
        if (e.button !== 0) return;

        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        const meshes = [];
        this.handles.traverse(c => {
            if (c.isMesh && c.userData.isWallHeightHandle) meshes.push(c);
        });

        const intersects = this.raycaster.intersectObjects(meshes, false);
        if (intersects.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            const hitMesh = intersects[0].object;
            this.activeHandle = hitMesh.userData;

            const wall = this._getWallEntity();
            if (!wall) return;

            const wallH = (wall.height !== undefined ? wall.height : WallHeightPolicy.resolveDefault(wall));
            this.initialH = wallH;
            this.initialStartH = (wall.startHeight !== undefined ? wall.startHeight : wallH);
            this.initialEndH = (wall.endHeight !== undefined ? wall.endHeight : wallH);

            const camDir = new THREE.Vector3();
            this.ctx.camera.getWorldDirection(camDir);
            this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(camDir.x, 0, camDir.z).normalize(), intersects[0].point);
            this.dragStartPoint.copy(intersects[0].point);

            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
            const connectedWalls = WallConnectivity.getConnectedRoomWalls(wall, planner);

            this.transaction = new WallHeightTransaction(planner);
            this.transaction.begin(connectedWalls, 'room');

            this.isDragging = true;
            this._capturedPointerId = e.pointerId;
            if (e.target && typeof e.target.setPointerCapture === 'function') {
                try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
            }
            if (this.ctx.controls) this.ctx.controls.enabled = false;

            this._updateBadgeText(`📐 Wall Height: ${Math.round(wallH)} cm`, e.clientX, e.clientY);
        }
    }

    _onPointerMove(e) {
        if (!this.visible) return;
        this.updateMouse(e);

        if (this.isDragging && this.activeHandle) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const currentPoint = new THREE.Vector3();

            if (this.raycaster.ray.intersectPlane(this.dragPlane, currentPoint)) {
                const deltaY = currentPoint.y - this.dragStartPoint.y;
                const wall = this._getWallEntity();
                if (!wall) return;

                const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;

                if (this.activeHandle.handleType === 'uniform_height') {
                    const targetH = this.initialH + deltaY;
                    const appliedH = this.transaction
                        ? this.transaction.update(targetH, { snapStep: WallHeightPolicy.SNAP_DRAG })
                        : WallHeightPolicy.processDragHeight(targetH);

                    const deltaReport = Math.round(appliedH - this.initialH);
                    this._updateBadgeText(
                        `📐 Wall Height: ${appliedH} cm (${deltaReport >= 0 ? '+' : ''}${deltaReport} cm)`,
                        e.clientX,
                        e.clientY
                    );

                    const connectedWalls = this.transaction?.targetWalls || [wall];
                    connectedWalls.forEach(w => {
                        if (typeof this.ctx.updateWallGeometryLive === 'function') {
                            try { this.ctx.updateWallGeometryLive(w); } catch(err) {}
                        }
                    });

                    // Live 2D update during 3D drag
                    if (planner?.wallLayer && typeof planner.wallLayer.batchDraw === 'function') {
                        try { planner.wallLayer.batchDraw(); } catch(err) {}
                    }
                } else if (this.activeHandle.handleType === 'start_slope') {
                    const newStartH = WallHeightPolicy.processDragHeight(this.initialStartH + deltaY);
                    WallEngine.setTopProfile(wall, 'single', { startHeight: newStartH }, false, planner);
                    this._updateBadgeText(`📐 Start Slope: ${newStartH} cm`, e.clientX, e.clientY);
                    if (typeof this.ctx.updateWallGeometryLive === 'function') {
                        try { this.ctx.updateWallGeometryLive(wall); } catch(err) {}
                    }
                } else if (this.activeHandle.handleType === 'end_slope') {
                    const newEndH = WallHeightPolicy.processDragHeight(this.initialEndH + deltaY);
                    WallEngine.setTopProfile(wall, 'single', { endHeight: newEndH }, false, planner);
                    this._updateBadgeText(`📐 End Slope: ${newEndH} cm`, e.clientX, e.clientY);
                    if (typeof this.ctx.updateWallGeometryLive === 'function') {
                        try { this.ctx.updateWallGeometryLive(wall); } catch(err) {}
                    }
                }

                this.updateHandles();

                if (this.ctx.requestRender) {
                    this.ctx.requestRender('wall_height_drag', 2);
                }

                coreEventBus.emit(EVENTS.WALL_CHANGE, { entity: wall });
            }
        } else {
            // Hover highlight
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const meshes = [];
            this.handles.traverse(c => {
                if (c.isMesh && c.userData.isWallHeightHandle && c.material?.visible !== false) meshes.push(c);
            });

            meshes.forEach(m => {
                m.material = m.userData.handleType === 'uniform_height' ? this.matHeight : this.matSlope;
                m.scale.set(1, 1, 1);
            });

            const intersects = this.raycaster.intersectObjects(meshes, false);
            if (intersects.length > 0) {
                intersects[0].object.material = this.matHover;
                intersects[0].object.scale.set(1.25, 1.25, 1.25);
                if (this.ctx.requestRender) this.ctx.requestRender();
            }
        }
    }

    _onPointerUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.activeHandle = null;
            this._hideBadge();

            if (this._capturedPointerId !== null && e.target && typeof e.target.releasePointerCapture === 'function') {
                try { e.target.releasePointerCapture(this._capturedPointerId); } catch(err) {}
                this._capturedPointerId = null;
            }

            if (this.ctx.controls) this.ctx.controls.enabled = true;

            if (this.transaction) {
                this.transaction.commit();
                this.transaction = null;
            }

            this.updateHandles();
            if (this.ctx.requestRender) this.ctx.requestRender();
        }
    }

    dispose() {
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (this.ctx.controls) {
            this.ctx.controls.removeEventListener('change', this._onCameraChange);
        }
        if (this.domBadge && this.domBadge.parentElement) {
            this.domBadge.parentElement.removeChild(this.domBadge);
        }
        this.detach();
    }
}

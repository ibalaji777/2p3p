import * as THREE from 'three';
import { EVENTS } from '../constants/events.js';
import { coreEventBus } from '../EventBus.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';

/**
 * WallPushPullGizmo
 * 
 * Provides interactive Sims 4-style 3D push/pull handles directly on wall surfaces.
 * Dragging the handles moves the wall perpendicularly along its normal vector,
 * seamlessly resizing connected rooms in real-time, maintaining corner miter joints,
 * and preserving attached doors/windows.
 */
export class WallPushPullGizmo extends THREE.Group {
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
        this._capturedPointerId = null;
        
        this.handles = new THREE.Group();
        this.add(this.handles);
        
        // Materials
        this.matFront = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, depthTest: false, transparent: true, opacity: 0.9 });
        this.matBack = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, depthTest: false, transparent: true, opacity: 0.9 });
        this.matHover = new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false, transparent: true, opacity: 1.0 });
        this.matActive = new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false, transparent: true, opacity: 1.0 });
        
        // Build Front and Back handles in local space
        this.handleFront = this._buildArrowHandle('front', 0x0ea5e9);
        this.handleBack = this._buildArrowHandle('back', 0x8b5cf6);
        
        this.handles.add(this.handleFront);
        this.handles.add(this.handleBack);
        
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        
        const dom = this.ctx.renderer.domElement;
        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
        dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
    }

    _buildArrowHandle(side, color) {
        const group = new THREE.Group();
        group.userData = { isWallPushPullHandle: true, side };
        group.renderOrder = 999;
        
        // Central grip cylinder
        const gripGeo = new THREE.CylinderGeometry(16, 16, 7, 24);
        gripGeo.rotateX(Math.PI / 2);
        const gripMesh = new THREE.Mesh(gripGeo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }));
        gripMesh.userData = { isWallPushPullHandle: true, side, part: 'grip' };
        gripMesh.renderOrder = 999;
        group.add(gripMesh);

        // Center ring accent
        const ringGeo = new THREE.TorusGeometry(10, 2, 12, 24);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.95 }));
        ringMesh.userData = { isWallPushPullHandle: true, side, part: 'ring' };
        ringMesh.renderOrder = 1000;
        group.add(ringMesh);

        // Forward Cone (Pointing outward along +Z)
        const arrowGeo = new THREE.ConeGeometry(12, 26, 20);
        arrowGeo.rotateX(Math.PI / 2);
        const arrowMesh = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
        arrowMesh.position.set(0, 0, 20);
        arrowMesh.userData = { isWallPushPullHandle: true, side, part: 'arrow' };
        arrowMesh.renderOrder = 999;
        group.add(arrowMesh);

        // Backward Cone (Pointing inward along -Z)
        const backArrowGeo = new THREE.ConeGeometry(9, 18, 20);
        backArrowGeo.rotateX(-Math.PI / 2);
        const backArrowMesh = new THREE.Mesh(backArrowGeo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.8 }));
        backArrowMesh.position.set(0, 0, -16);
        backArrowMesh.userData = { isWallPushPullHandle: true, side, part: 'backArrow' };
        backArrowMesh.renderOrder = 999;
        group.add(backArrowMesh);

        return group;
    }

    updateMouse(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
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
        this._resetHandleMaterials();
    }

    _getWallEntity() {
        if (!this.target) return null;
        if (this.target.userData && this.target.userData.entity) {
            return this.target.userData.entity;
        }
        if (this.target.parent && this.target.parent.userData && this.target.parent.userData.entity) {
            return this.target.parent.userData.entity;
        }
        return null;
    }

    _getWallGroup() {
        const wall = this._getWallEntity();
        if (!wall) return null;
        if (wall.mesh3D) return wall.mesh3D;
        if (this.target && this.target.isGroup) return this.target;
        if (this.target && this.target.parent && this.target.parent.isGroup) return this.target.parent;
        return null;
    }

    updateHandles() {
        const wall = this._getWallEntity();
        const wallGroup = this._getWallGroup();
        if (!wall || !wallGroup) {
            this.visible = false;
            return;
        }

        const p1 = wall.startAnchor ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
        const p2 = wall.endAnchor ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;

        const h = (wall.height !== undefined ? wall.height : (wall.config?.height || 300));
        const t = (wall.thickness !== undefined ? wall.thickness : 20);

        // Align Gizmo transform with the Wall Group in 3D scene space
        wallGroup.updateMatrixWorld(true);
        this.position.copy(wallGroup.getWorldPosition(new THREE.Vector3()));
        this.quaternion.copy(wallGroup.getWorldQuaternion(new THREE.Quaternion()));
        this.scale.copy(wallGroup.getWorldScale(new THREE.Vector3()));

        // Position Front Handle at center of front face (local Z = +t/2)
        const frontOffset = t / 2 + 10;
        this.handleFront.position.set(len / 2, h / 2, frontOffset);
        this.handleFront.rotation.set(0, 0, 0);

        // Position Back Handle at center of back face (local Z = -t/2)
        const backOffset = t / 2 + 10;
        this.handleBack.position.set(len / 2, h / 2, -backOffset);
        this.handleBack.rotation.set(0, Math.PI, 0);

        this.visible = true;
    }

    _resetHandleMaterials() {
        this._setGroupMaterial(this.handleFront, this.matFront);
        this._setGroupMaterial(this.handleBack, this.matBack);
    }

    _setGroupMaterial(group, mat) {
        group.children.forEach(c => {
            if (c.userData && c.userData.part === 'ring') return; // preserve white accent ring
            if (c.material) c.material = mat;
        });
    }

    _onPointerDown(e) {
        if (!this.visible || (this.ctx.currentTransformMode !== 'wall_push_pull' && this.ctx.currentTransformMode !== 'pushPull')) return;
        if (e.button !== 0) return;
        
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        
        const allHandleMeshes = [...this.handleFront.children, ...this.handleBack.children];
        const intersects = this.raycaster.intersectObjects(allHandleMeshes, true);
        
        if (intersects.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            
            let hitMesh = intersects[0].object;
            while (hitMesh && !hitMesh.userData.isWallPushPullHandle && hitMesh.parent) {
                hitMesh = hitMesh.parent;
            }
            const side = hitMesh?.userData?.side || (intersects[0].object.parent?.userData?.side) || 'front';
            this.activeHandle = side;
            
            const hitGroup = side === 'front' ? this.handleFront : this.handleBack;
            this._resetHandleMaterials();
            this._setGroupMaterial(hitGroup, this.matActive);
            
            const wall = this._getWallEntity();
            if (!wall) return;
            
            const p1 = wall.startAnchor ? wall.startAnchor.position() : { x: wall.startX, y: wall.startY };
            const p2 = wall.endAnchor ? wall.endAnchor.position() : { x: wall.endX, y: wall.endY };
            this.initialStart = { x: p1.x, y: p1.y };
            this.initialEnd = { x: p2.x, y: p2.y };
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);
            if (len === 0) return;
            this.wallNormal2D = { x: -dy / len, y: dx / len };
            
            // Drag plane facing the camera coplanar with the handle contact point
            const hitPoint = intersects[0].point;
            const camDir = new THREE.Vector3();
            this.ctx.camera.getWorldDirection(camDir);
            this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), hitPoint);
            this.dragStartPoint.copy(hitPoint);
            
            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
            if (planner && planner.commandManager) {
                this._snapshotCmd = new SnapshotCommand(planner);
            }
            
            this.isDragging = true;
            this._capturedPointerId = e.pointerId;
            if (e.target && typeof e.target.setPointerCapture === 'function') {
                try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
            }
            if (this.ctx.controls) this.ctx.controls.enabled = false;
        }
    }

    _onPointerMove(e) {
        if (!this.visible || (this.ctx.currentTransformMode !== 'wall_push_pull' && this.ctx.currentTransformMode !== 'pushPull')) return;
        this.updateMouse(e);

        if (this.isDragging && this.activeHandle) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const currentPoint = new THREE.Vector3();
            
            if (this.raycaster.ray.intersectPlane(this.dragPlane, currentPoint)) {
                const deltaWorldX = currentPoint.x - this.dragStartPoint.x;
                const deltaWorldZ = currentPoint.z - this.dragStartPoint.z; // 3D z maps to 2D y
                
                // Project displacement vector along the wall normal
                let dist = (deltaWorldX * this.wallNormal2D.x) + (deltaWorldZ * this.wallNormal2D.y);
                
                // Snap to 2.5cm increments for smooth CAD precision
                const snapStep = 2.5;
                dist = Math.round(dist / snapStep) * snapStep;
                
                const wall = this._getWallEntity();
                if (wall) {
                    const newP1 = {
                        x: Math.round(this.initialStart.x + this.wallNormal2D.x * dist),
                        y: Math.round(this.initialStart.y + this.wallNormal2D.y * dist)
                    };
                    const newP2 = {
                        x: Math.round(this.initialEnd.x + this.wallNormal2D.x * dist),
                        y: Math.round(this.initialEnd.y + this.wallNormal2D.y * dist)
                    };
                    
                    wall.startX = newP1.x;
                    wall.startY = newP1.y;
                    wall.endX = newP2.x;
                    wall.endY = newP2.y;

                    if (wall.startAnchor && wall.startAnchor.node) {
                        wall.startAnchor.node.position(newP1);
                        wall.startAnchor.lastValidPos = newP1;
                    }
                    if (wall.endAnchor && wall.endAnchor.node) {
                        wall.endAnchor.node.position(newP2);
                        wall.endAnchor.lastValidPos = newP2;
                    }
                    
                    const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
                    if (planner && typeof planner.syncAll === 'function') {
                        planner.syncAll();
                    }
                    
                    // Live update 3D meshes for moved wall and connected perpendicular walls
                    if (planner) {
                        const attachedWalls = (planner.walls || []).filter(w => 
                            w === wall || 
                            (w.startAnchor && (w.startAnchor === wall.startAnchor || w.startAnchor === wall.endAnchor)) ||
                            (w.endAnchor && (w.endAnchor === wall.startAnchor || w.endAnchor === wall.endAnchor))
                        );
                        
                        attachedWalls.forEach(w => {
                            if (typeof this.ctx.updateWallGeometryLive === 'function') {
                                try {
                                    this.ctx.updateWallGeometryLive(w);
                                } catch(err) {
                                    console.warn('[WallPushPullGizmo] Live wall update err:', err);
                                }
                            }
                        });
                    }
                    
                    this.updateHandles();
                    
                    if (this.ctx.interactions && this.ctx.interactions.dimensionManager) {
                        this.ctx.interactions.dimensionManager.update();
                    }
                    
                    if (this.ctx.requestRender) {
                        this.ctx.requestRender('wall_push_pull', 2);
                    }
                    
                    coreEventBus.emit(EVENTS.WALL_PUSH_PULL_CHANGE, { entity: wall, delta: dist });
                }
            }
        } else {
            // Hover highlight
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const allHandleMeshes = [...this.handleFront.children, ...this.handleBack.children];
            const intersects = this.raycaster.intersectObjects(allHandleMeshes, true);
            
            this._resetHandleMaterials();
            
            if (intersects.length > 0) {
                let hitMesh = intersects[0].object;
                while (hitMesh && !hitMesh.userData.isWallPushPullHandle && hitMesh.parent) {
                    hitMesh = hitMesh.parent;
                }
                const side = hitMesh?.userData?.side || (intersects[0].object.parent?.userData?.side);
                const hitGroup = side === 'front' ? this.handleFront : (side === 'back' ? this.handleBack : null);
                if (hitGroup) {
                    this._setGroupMaterial(hitGroup, this.matHover);
                }
                this.ctx.renderer.domElement.style.cursor = 'grab';
            } else {
                this.ctx.renderer.domElement.style.cursor = 'auto';
            }
        }
    }

    _onPointerUp(e) {
        if (this.isDragging) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            
            if (this._capturedPointerId !== null && e.target && typeof e.target.releasePointerCapture === 'function') {
                try { e.target.releasePointerCapture(this._capturedPointerId); } catch(err) {}
            }
            this._capturedPointerId = null;

            this.isDragging = false;
            this.activeHandle = null;
            this._resetHandleMaterials();
            
            if (this.ctx.controls) this.ctx.controls.enabled = true;
            this.ctx.renderer.domElement.style.cursor = 'auto';
            
            const wall = this._getWallEntity();
            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
            
            if (this._snapshotCmd && this._snapshotCmd.finalize && planner && planner.commandManager) {
                planner.commandManager.execute(this._snapshotCmd);
            }
            this._snapshotCmd = null;
            
            if (planner && typeof planner.syncAll === 'function') {
                planner.syncAll();
            }
            
            coreEventBus.emit(EVENTS.WALL_PUSH_PULL_END, { entity: wall });
            if (this.ctx.requestRender) this.ctx.requestRender('wall_push_pull_end', 2);
        }
    }

    dispose() {
        const dom = this.ctx.renderer.domElement;
        dom.removeEventListener('pointerdown', this._onPointerDown);
        dom.removeEventListener('pointermove', this._onPointerMove);
        dom.removeEventListener('pointerup', this._onPointerUp);
        
        [this.matFront, this.matBack, this.matHover, this.matActive].forEach(m => m.dispose());
        [this.handleFront, this.handleBack].forEach(group => {
            group.children.forEach(c => {
                if (c.geometry) c.geometry.dispose();
            });
        });
        
        if (this.parent) this.parent.remove(this);
    }
}

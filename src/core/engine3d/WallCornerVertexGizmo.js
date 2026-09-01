import * as THREE from 'three';
import { EVENTS } from '../constants/events.js';
import { coreEventBus } from '../EventBus.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';

/**
 * WallCornerVertexGizmo
 * 
 * Provides interactive Sims 4-style 3D corner/vertex handles at wall joints.
 * Dragging a vertex handle moves the shared WallAnchor (X, Z), dynamically
 * recalculating connected wall lengths, miter joints, and attached openings in real time.
 */
export class WallCornerVertexGizmo extends THREE.Group {
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
        this.handles.name = 'WallCornerVertex_Handles';
        this.add(this.handles);
        
        // Handle Materials
        this.matDefault = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false, transparent: true, opacity: 0.95 });
        this.matHover = new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false, transparent: true, opacity: 1.0 });
        this.matActive = new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false, transparent: true, opacity: 1.0 });
        
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        
        const dom = this.ctx.renderer.domElement;
        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
        dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
    }

    updateMouse(e) {
        const dom = this.ctx.renderer.domElement;
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
        const wallBaseY = (wall.elevation || 0);
        const wallH = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));

        // Create Start and End Corner Handles (both bottom and top vertices)
        this._createCornerHandle('start', p1.x, wallBaseY, p1.y, wall.startAnchor);
        this._createCornerHandle('end', p2.x, wallBaseY, p2.y, wall.endAnchor);
        this._createCornerHandle('start_top', p1.x, wallBaseY + wallH, p1.y, wall.startAnchor);
        this._createCornerHandle('end_top', p2.x, wallBaseY + wallH, p2.y, wall.endAnchor);
    }

    _createCornerHandle(type, x, y, z, anchor) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isWallCornerHandle: true, handleType: type, anchor: anchor };
        group.renderOrder = 1001;

        // Outer Diamond / Octahedron
        const geo = new THREE.OctahedronGeometry(4.5);
        const mesh = new THREE.Mesh(geo, this.matDefault.clone());
        mesh.userData = { isWallCornerHandle: true, handleType: type, anchor: anchor };
        mesh.renderOrder = 1001;
        group.add(mesh);

        // Center ring accent
        const ringGeo = new THREE.TorusGeometry(3.5, 0.8, 8, 16);
        ringGeo.rotateX(Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        ringMesh.renderOrder = 1002;
        group.add(ringMesh);

        this.handles.add(group);
    }

    _onPointerDown(e) {
        if (!this.visible) return;
        if (e.button !== 0) return;

        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        
        const meshes = [];
        this.handles.traverse(c => {
            if (c.isMesh && c.userData.isWallCornerHandle) meshes.push(c);
        });

        const intersects = this.raycaster.intersectObjects(meshes, false);
        if (intersects.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            const hitMesh = intersects[0].object;
            this.activeHandle = hitMesh.userData;
            hitMesh.material = this.matActive;

            const wall = this._getWallEntity();
            if (!wall) return;

            const wallElev = (wall.elevation || 0);
            this.dragPlane.set(new THREE.Vector3(0, 1, 0), -wallElev);
            
            const hitPoint = intersects[0].point;
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
        if (!this.visible) return;
        this.updateMouse(e);

        if (this.isDragging && this.activeHandle) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const currentPoint = new THREE.Vector3();

            if (this.raycaster.ray.intersectPlane(this.dragPlane, currentPoint)) {
                // Snap step for smooth CAD precision
                const snap = 2.5;
                const newX = Math.round(currentPoint.x / snap) * snap;
                const newY = Math.round(currentPoint.z / snap) * snap; // 3D Z maps to 2D Y

                const wall = this._getWallEntity();
                const anchor = this.activeHandle.anchor;

                if (anchor) {
                    if (typeof anchor.position === 'function') {
                        anchor.position({ x: newX, y: newY });
                    }
                    if (anchor.node && typeof anchor.node.position === 'function') {
                        anchor.node.position({ x: newX, y: newY });
                    }
                    anchor.x = newX;
                    anchor.y = newY;
                    anchor.lastValidPos = { x: newX, y: newY };
                } else if (wall) {
                    if (this.activeHandle.handleType.startsWith('start')) {
                        wall.startX = newX;
                        wall.startY = newY;
                    } else {
                        wall.endX = newX;
                        wall.endY = newY;
                    }
                }

                const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
                if (planner && typeof planner.syncAll === 'function') {
                    planner.syncAll();
                }

                // Rebuild connected walls live
                if (planner && planner.walls) {
                    const attachedWalls = planner.walls.filter(w => 
                        w === wall || 
                        w.startAnchor === anchor || 
                        w.endAnchor === anchor
                    );
                    attachedWalls.forEach(w => {
                        if (typeof this.ctx.updateWallGeometryLive === 'function') {
                            try { this.ctx.updateWallGeometryLive(w); } catch(err) {}
                        }
                    });
                }

                this.updateHandles();

                if (this.ctx.requestRender) {
                    this.ctx.requestRender('wall_corner_drag', 2);
                }

                coreEventBus.emit(EVENTS.WALL_CHANGE, { entity: wall });
            }
        } else {
            // Hover highlight
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const meshes = [];
            this.handles.traverse(c => {
                if (c.isMesh && c.userData.isWallCornerHandle) meshes.push(c);
            });

            meshes.forEach(m => {
                m.material = this.matDefault;
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

            if (this._capturedPointerId !== null && e.target && typeof e.target.releasePointerCapture === 'function') {
                try { e.target.releasePointerCapture(this._capturedPointerId); } catch(err) {}
                this._capturedPointerId = null;
            }

            if (this.ctx.controls) this.ctx.controls.enabled = true;

            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
            if (planner && planner.commandManager && this._snapshotCmd) {
                planner.commandManager.execute(this._snapshotCmd);
                this._snapshotCmd = null;
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
        this.detach();
    }
}

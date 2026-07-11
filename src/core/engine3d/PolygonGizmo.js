import { EVENTS } from '../registry.js';
import * as THREE from 'three';

export class PolygonGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.target = null;
        this.visible = false;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.activeDragIndex = -1;
        this.activeDragType = ''; // 'edge' or 'corner'
        this.isDragging = false;
        this.dragPlane = new THREE.Plane();
        this.initialPoints = [];
        this.dragStartPos = new THREE.Vector3();

        this.edgeHandles = new THREE.Group();
        this.cornerHandles = new THREE.Group();
        this.add(this.edgeHandles);
        this.add(this.cornerHandles);

        const edgeGeo = new THREE.BoxGeometry(10, 2, 10);
        const cornerGeo = new THREE.CylinderGeometry(5, 5, 2, 16);
        
        this.edgeMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, depthTest: false, transparent: true, opacity: 0.8 });
        this.edgeMatHover = new THREE.MeshBasicMaterial({ color: 0x60a5fa, depthTest: false, transparent: true, opacity: 1.0 });
        
        this.cornerMat = new THREE.MeshBasicMaterial({ color: 0xef4444, depthTest: false, transparent: true, opacity: 0.8 });
        this.cornerMatHover = new THREE.MeshBasicMaterial({ color: 0xfca5a5, depthTest: false, transparent: true, opacity: 1.0 });
        
        for (let i = 0; i < 20; i++) {
            const edgeMesh = new THREE.Mesh(edgeGeo, this.edgeMat);
            edgeMesh.userData = { isPolygonHandle: true, index: i, type: 'edge' };
            edgeMesh.visible = false;
            this.edgeHandles.add(edgeMesh);
            
            const cornerMesh = new THREE.Mesh(cornerGeo, this.cornerMat);
            cornerMesh.userData = { isPolygonHandle: true, index: i, type: 'corner' };
            cornerMesh.visible = false;
            this.cornerHandles.add(cornerMesh);
        }

        const dom = this.ctx.renderer.domElement;
        
        this._onPointerDown = (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'polygon_edges') return;
            if (e.button !== 0) return;
            this.updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            
            // Prioritize corners over edges
            let intersects = this.raycaster.intersectObjects(this.cornerHandles.children, false);
            if (intersects.length === 0) {
                intersects = this.raycaster.intersectObjects(this.edgeHandles.children, false);
            }
            
            if (intersects.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                
                const handle = intersects[0].object;
                this.activeDragIndex = handle.userData.index;
                this.activeDragType = handle.userData.type;
                
                this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), handle.getWorldPosition(new THREE.Vector3()));
                this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPos);
                
                const entity = this.target.userData.entity;
                this.initialPoints = entity.params.points.map(p => ({ x: p.x, y: p.y }));
                
                this.isDragging = true;
                this.ctx.controls.enabled = false;
            }
        };

        this._onPointerMove = (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'polygon_edges') return;
            this.updateMouse(e);

            if (this.isDragging) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const currentPos = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, currentPos)) {
                    const localStart = this.target.worldToLocal(this.dragStartPos.clone());
                    const localCurrent = this.target.worldToLocal(currentPos.clone());
                    
                    const entity = this.target.userData.entity;
                    const pts = entity.params.points;
                    
                    if (this.activeDragType === 'edge') {
                        const handle = this.edgeHandles.children[this.activeDragIndex];
                        const normal = handle.userData.normal;
                        
                        const moveX = localCurrent.x - localStart.x;
                        const moveY = localCurrent.z - localStart.z;
                        const dist = (moveX * normal.x) + (moveY * normal.y);
                        
                        const i1 = this.activeDragIndex;
                        const i2 = (this.activeDragIndex + 1) % pts.length;
                        
                        pts[i1].x = this.initialPoints[i1].x + (normal.x * dist);
                        pts[i1].y = this.initialPoints[i1].y + (normal.y * dist);
                        pts[i2].x = this.initialPoints[i2].x + (normal.x * dist);
                        pts[i2].y = this.initialPoints[i2].y + (normal.y * dist);
                    } else if (this.activeDragType === 'corner') {
                        const i = this.activeDragIndex;
                        const moveX = localCurrent.x - localStart.x;
                        const moveY = localCurrent.z - localStart.z;
                        
                        pts[i].x = this.initialPoints[i].x + moveX;
                        pts[i].y = this.initialPoints[i].y + moveY;
                    }
                    
                    this.updateHandles();
                    if (this.ctx.updateShapeLive) this.ctx.updateShapeLive(entity);
                    if (this.ctx.syncToUI) this.ctx.syncToUI();
                }
            } else {
                // Hover effect
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                let hit = false;
                
                const cIntersects = this.raycaster.intersectObjects(this.cornerHandles.children, false);
                this.cornerHandles.children.forEach(c => c.material = this.cornerMat);
                if (cIntersects.length > 0) {
                    cIntersects[0].object.material = this.cornerMatHover;
                    hit = true;
                }
                
                const eIntersects = this.raycaster.intersectObjects(this.edgeHandles.children, false);
                this.edgeHandles.children.forEach(c => c.material = this.edgeMat);
                if (!hit && eIntersects.length > 0) {
                    eIntersects[0].object.material = this.edgeMatHover;
                    hit = true;
                }
                
                dom.style.cursor = hit ? 'pointer' : 'default';
            }
        };

        this._onPointerUp = (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                this.activeDragIndex = -1;
                this.activeDragType = '';
                this.ctx.controls.enabled = true;
                if (this.target && this.target.userData.entity) {
                    if (this.ctx.syncToUI) this.ctx.syncToUI();
                    if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
                    
                    const event = new CustomEvent(EVENTS.POLYGON_GIZMO_END, { detail: { entity: this.target.userData.entity }});
                    window.dispatchEvent(event);
                }
            }
        };

        dom.addEventListener('pointerdown', this._onPointerDown);
        dom.addEventListener('pointermove', this._onPointerMove);
        dom.addEventListener('pointerup', this._onPointerUp);
    }

    updateMouse(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    attach(object) {
        if (!object || !object.userData || !object.userData.entity) return;
        const entity = object.userData.entity;
        if (!entity.params || !entity.params.points) return;

        this.target = object;
        this.visible = true;
        
        this.initialPoints = entity.params.points.map(p => ({...p}));
        this.updateHandles();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.activeDragIndex = -1;
        this.activeDragType = '';
        this.isDragging = false;
        this.edgeHandles.children.forEach(c => c.visible = false);
        this.cornerHandles.children.forEach(c => c.visible = false);
    }

    updateHandles() {
        if (!this.target) return;
        const entity = this.target.userData.entity;
        const pts = entity.params.points;
        if (!pts) return;

        this.target.getWorldPosition(this.position);
        this.target.getWorldQuaternion(this.quaternion);
        this.target.getWorldScale(this.scale);

        for (let i = 0; i < this.edgeHandles.children.length; i++) {
            const eHandle = this.edgeHandles.children[i];
            const cHandle = this.cornerHandles.children[i];
            
            if (i < pts.length) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % pts.length];
                
                // Corner handle
                cHandle.position.set(p1.x, 0, p1.y);
                cHandle.visible = true;
                
                // Edge handle
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                eHandle.position.set(midX, 0, midY); 
                eHandle.visible = true;
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.hypot(dx, dy);
                
                eHandle.userData.normal = { x: dy / len, y: -dx / len }; 
                
                // Align edge handle with the edge visually
                const angle = Math.atan2(dx, dy); // Note: Since 3D z corresponds to 2D y, this maps perfectly
                eHandle.rotation.y = angle;
                
            } else {
                eHandle.visible = false;
                cHandle.visible = false;
            }
        }
    }

    dispose() {
        const dom = this.ctx.renderer.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        this.edgeMat.dispose();
        this.edgeMatHover.dispose();
        this.cornerMat.dispose();
        this.cornerMatHover.dispose();
        
        this.edgeHandles.children.forEach(c => {
            if (c.geometry) c.geometry.dispose();
        });
        this.cornerHandles.children.forEach(c => {
            if (c.geometry) c.geometry.dispose();
        });

        if (this.parent) this.parent.remove(this);
    }
}

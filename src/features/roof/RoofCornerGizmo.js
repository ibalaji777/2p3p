import { EVENTS } from '../../core/registry.js';
import * as THREE from 'three';

export class RoofCornerGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.target = null;
        this.handles = new THREE.Group();
        this.add(this.handles);
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.visible = false;
        
        this.handleMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, depthTest: false, transparent: true, opacity: 0.9 });
        this.handleMatHover = new THREE.MeshBasicMaterial({ color: 0x60a5fa, depthTest: false, transparent: true, opacity: 1.0 });
        this.handleMatActive = new THREE.MeshBasicMaterial({ color: 0x4ade80, depthTest: false, transparent: true, opacity: 1.0 });
        this.handleGeo = new THREE.SphereGeometry(15, 16, 16);
        
        this.selectedIndices = new Set();
        this.activeDragIndex = -1;
        this.isDragging = false;
        this.dragPlane = new THREE.Plane();
        this.dragOffset = new THREE.Vector3();
        this.initialPoints = [];
        this.dragStartPos = new THREE.Vector3();

        const dom = this.ctx.renderer.domElement;
        
        dom.addEventListener('pointerdown', (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'roof_corners') return;
            if (e.button !== 0) return;
            this.updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, false);
            if (intersects.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                
                const handle = intersects[0].object;
                const idx = handle.userData.index;
                
                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    if (this.selectedIndices.has(idx)) {
                        this.selectedIndices.delete(idx);
                    } else {
                        this.selectedIndices.add(idx);
                    }
                } else {
                    if (!this.selectedIndices.has(idx)) {
                        this.selectedIndices.clear();
                        this.selectedIndices.add(idx);
                    }
                }
                
                this.activeDragIndex = idx;
                this.isDragging = true;
                
                // Horizontal drag plane (XZ)
                this.dragPlane.setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 1, 0),
                    intersects[0].point
                );
                
                this.dragStartPos.copy(intersects[0].point);
                
                const entity = this.target.userData.entity;
                if (!entity.points) return;
                
                this.initialPoints = entity.points.map(p => ({ x: p.x, y: p.y }));
                
                this.refreshHandleMaterials();
                if (this.ctx.controls) this.ctx.controls.enabled = false;
            } else {
                this.selectedIndices.clear();
                this.refreshHandleMaterials();
            }
        }, { passive: false });
        
        dom.addEventListener('pointermove', (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'roof_corners') return;
            this.updateMouse(e);
            
            if (this.isDragging && this.activeDragIndex !== -1) {
                e.preventDefault();
                e.stopPropagation();
                
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const planeIntersect = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, planeIntersect);
                
                if (planeIntersect) {
                    // Roof points are in local space. The drag plane intersection is in world space.
                    // We must convert the intersection point to the local space of the gizmo (which is roofGroup space)
                    const localIntersect = planeIntersect.clone();
                    this.worldToLocal(localIntersect);
                    const localStart = this.dragStartPos.clone();
                    this.worldToLocal(localStart);
                    
                    const deltaX = localIntersect.x - localStart.x;
                    const deltaZ = localIntersect.z - localStart.z;
                    
                    const entity = this.target.userData.entity;
                    
                    this.selectedIndices.forEach(idx => {
                        entity.points[idx].x = this.initialPoints[idx].x + deltaX;
                        entity.points[idx].y = this.initialPoints[idx].y + deltaZ;
                    });
                    
                    this.updateHandlePositions();
                    if (this.ctx.updateRoofLive) {
                        this.ctx.updateRoofLive(entity);
                    } else if (window.dispatchEvent) {
                        window.dispatchEvent(new CustomEvent(EVENTS.ROOF_CORNER_GIZMO_CHANGE, { detail: { entity: entity } }));
                    }
                }
            } else {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const intersects = this.raycaster.intersectObjects(this.handles.children, false);
                if (intersects.length > 0) {
                    dom.style.cursor = 'pointer';
                    const idx = intersects[0].object.userData.index;
                    this.handles.children.forEach(h => {
                        if (!this.selectedIndices.has(h.userData.index)) {
                            h.material = (h.userData.index === idx) ? this.handleMatHover : this.handleMat;
                        }
                    });
                } else {
                    dom.style.cursor = 'auto';
                    this.refreshHandleMaterials();
                }
            }
        }, { passive: false });
        
        dom.addEventListener('pointerup', (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'roof_corners') return;
            if (this.isDragging) {
                this.isDragging = false;
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                if (this.target && this.target.userData.entity) {
                    window.dispatchEvent(new CustomEvent(EVENTS.ROOF_CORNER_GIZMO_END, { detail: { entity: this.target.userData.entity } }));
                    if (this.ctx.syncToUI) this.ctx.syncToUI();
                }
            }
        }, { passive: false });
    }
    
    updateMouse(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    refreshHandleMaterials() {
        this.handles.children.forEach(h => {
            h.material = this.selectedIndices.has(h.userData.index) ? this.handleMatActive : this.handleMat;
        });
    }
    
    attach(mesh) {
        if (!mesh || !mesh.userData.entity || !mesh.userData.entity.points) return;
        this.target = mesh;
        this.visible = true;
        this.selectedIndices.clear();
        this.activeDragIndex = -1;
        
        this.buildHandles();
        
        if (this.target.parent) {
            this.position.copy(this.target.parent.position);
            this.rotation.copy(this.target.parent.rotation);
        }
    }
    
    detach() {
        this.target = null;
        this.visible = false;
        this.handles.clear();
        this.selectedIndices.clear();
        this.activeDragIndex = -1;
    }
    
    buildHandles() {
        this.handles.clear();
        const entity = this.target.userData.entity;
        const points = entity.points || [];
        
        const h = entity.config?.height || 0; // Wait, roof mesh might be positioned higher. Actually, the mesh local space is usually just Y=0 for points because the roofGroup is translated up.
        // Let's get the mesh's Y offset if any.
        let meshY = 0;
        
        points.forEach((p, idx) => {
            const handle = new THREE.Mesh(this.handleGeo, this.handleMat);
            handle.position.set(p.x, meshY, p.y);
            handle.userData = { index: idx };
            this.handles.add(handle);
        });
    }
    
    updateHandlePositions() {
        if (!this.target) return;
        const entity = this.target.userData.entity;
        const points = entity.points || [];
        
        this.handles.children.forEach(h => {
            const idx = h.userData.index;
            if (points[idx]) {
                h.position.set(points[idx].x, h.position.y, points[idx].y);
            }
        });
    }
}

import { EVENTS } from '../../core/registry.js';
import { coreEventBus } from '../../core/EventBus.js';
import * as THREE from 'three';
import { offsetPolygon } from '../../core/registry.js';

export class RoofOverhangGizmo extends THREE.Group {
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
        this.handleMatActive = new THREE.MeshBasicMaterial({ color: 0x2563eb, depthTest: false, transparent: true, opacity: 0.9 });
        
        // Create an arrow-like geometry using a cone
        this.handleGeo = new THREE.ConeGeometry(12, 30, 8);
        this.handleGeo.rotateX(Math.PI / 2); // Point it along Z axis by default
        
        this.activeDragIndex = -1;
        this.isDragging = false;
        this.dragPlane = new THREE.Plane();
        this.dragStartPos = new THREE.Vector3();
        this.dragIntersect = new THREE.Vector3();

        const dom = this.ctx.renderer.domElement;
        
        this._onPointerDown = (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'roof_overhang') return;
            if (e.button !== 0) return;
            this.updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, false);
            if (intersects.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                
                const handle = intersects[0].object;
                this.activeDragIndex = handle.userData.index;
                this.isDragging = true;
                this.dragStartScreenY = e.clientY;
                this.dragStartScreenX = e.clientX;
                
                const entity = this.target.userData.entity;
                if (!entity.points) return;
                
                if (!entity.config.overhangs || entity.config.overhangs.length !== entity.points.length) {
                    entity.config.overhangs = Array(entity.points.length).fill(entity.config.overhang || 0);
                }
                
                this.initialOverhangs = [...entity.config.overhangs];
                
                this.dragPlane.setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 1, 0),
                    intersects[0].point
                );
                
                this.dragStartPos.copy(intersects[0].point);
                
                this.handles.children.forEach(h => {
                    const idx = h.userData.index;
                    h.userData.initialOverhang = entity.config.overhangs[idx];
                });
                
                this.refreshHandleMaterials();
                if (this.ctx.controls) this.ctx.controls.enabled = false;
            } else {
                this.activeDragIndex = -1;
                this.refreshHandleMaterials();
            }
        };
        
        this._onPointerMove = (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'roof_overhang') return;
            this.updateMouse(e);
            
            if (this.isDragging && this.activeDragIndex !== -1) {
                e.preventDefault();
                e.stopPropagation();
                
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                this.raycaster.ray.intersectPlane(this.dragPlane, this.dragIntersect);
                
                if (this.dragIntersect) {
                    const localIntersect = this.dragIntersect.clone();
                    this.worldToLocal(localIntersect);
                    
                    const localStart = this.dragStartPos.clone();
                    this.worldToLocal(localStart);
                    
                    const dx = localIntersect.x - localStart.x;
                    const dz = localIntersect.z - localStart.z;
                    
                    const handle = this.handles.children.find(h => h.userData.index === this.activeDragIndex);
                    if (handle) {
                        const nx = handle.userData.nx;
                        const ny = handle.userData.ny;
                        
                        const dot = dx * nx + dz * ny;
                        const deltaOverhang = dot * 0.25; // Small damper for comfortable weight
                        
                        const entity = this.target.userData.entity;
                        if (!entity.config.overhangs) {
                            entity.config.overhangs = Array(entity.points.length).fill(entity.config.overhang || 0);
                        }
                        
                        if (e.shiftKey) {
                            this.initialOverhangs.forEach((initO, i) => {
                                let newO = initO + deltaOverhang;
                                if (newO < 0) newO = 0;
                                entity.config.overhangs[i] = newO;
                            });
                        } else {
                            let initO = this.initialOverhangs[this.activeDragIndex];
                            let newO = initO + deltaOverhang;
                            if (newO < 0) newO = 0;
                            entity.config.overhangs[this.activeDragIndex] = newO;
                        }
                        
                        this.updateHandlePositions();
                        
                        if (this.ctx.builder && this.ctx.builder.updateRoofLive) {
                            this.ctx.builder.updateRoofLive(entity);
                        }
                    }
                }
            } else {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const intersects = this.raycaster.intersectObjects(this.handles.children, false);
                if (intersects.length > 0) {
                    dom.style.cursor = 'pointer';
                    const idx = intersects[0].object.userData.index;
                    this.handles.children.forEach(h => {
                        h.material = (h.userData.index === idx) ? this.handleMatHover : this.handleMat;
                    });
                } else {
                    dom.style.cursor = 'auto';
                    this.refreshHandleMaterials();
                }
            }
        };
        
        this._onPointerUp = (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'roof_overhang') return;
            if (this.isDragging) {
                this.isDragging = false;
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                if (this.target && this.target.userData.entity) {
                    const entity = this.target.userData.entity;
                    if (typeof window !== 'undefined') {
                        coreEventBus.emit(EVENTS.ROOF_OVERHANG_GIZMO_END, { entity: entity });
                    }
                    if (this.ctx.syncToUI) this.ctx.syncToUI();
                }
                this.refreshHandleMaterials();
            }
        };

        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
        dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
    }
    
    updateMouse(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    refreshHandleMaterials() {
        this.handles.children.forEach(h => {
            h.material = (h.userData.index === this.activeDragIndex) ? this.handleMatActive : this.handleMat;
        });
    }
    
    attach(mesh) {
        if (!mesh || !mesh.userData.entity || !mesh.userData.entity.points) return;
        this.target = mesh;
        this.visible = true;
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
        this.activeDragIndex = -1;
    }
    
    buildHandles() {
        this.handles.clear();
        const entity = this.target.userData.entity;
        const points = entity.points || [];
        
        console.log('RoofOverhangGizmo building handles for points:', points.length);
        if (points.length < 3) return;
        
        let signedArea = 0;
        for (let i = 0; i < points.length; i++) {
            let p0 = points[i];
            let p1 = points[(i + 1) % points.length];
            signedArea += (p0.x * p1.y - p1.x * p0.y);
        }

        const currentOverhangs = entity.config.overhangs || Array(points.length).fill(entity.config.overhang || 0);
        const offsetPts = offsetPolygon(points, currentOverhangs);
        
        // Find roof elevation
        const meshY = (this.target.position.y || 0) + 2; 
        
        offsetPts.forEach((p, idx) => {
            const nextIdx = (idx + 1) % offsetPts.length;
            const pNext = offsetPts[nextIdx];
            
            const midX = (p.x + pNext.x) / 2;
            const midY = (p.y + pNext.y) / 2;
            
            let p0 = points[idx];
            let p1 = points[(idx + 1) % points.length];
            let dx = p1.x - p0.x;
            let dy = p1.y - p0.y;
            let len = Math.sqrt(dx*dx + dy*dy);
            if (len > 0) { dx /= len; dy /= len; }
            
            let nx = -dy; let ny = dx;
            if (signedArea > 0) { nx = dy; ny = -dx; }
            
            const handle = new THREE.Mesh(this.handleGeo, this.handleMat);
            handle.position.set(midX, meshY, midY); 
            
            // Point the arrow along the normal direction
            handle.rotation.y = -Math.atan2(ny, nx) + Math.PI / 2;
            
            handle.userData = { 
                index: idx, 
                nx: nx, 
                ny: ny,
                initialOverhang: currentOverhangs[idx] 
            };
            this.handles.add(handle);
        });
    }
    
    updateHandlePositions() {
        if (!this.target) return;
        this.buildHandles();
    }
}

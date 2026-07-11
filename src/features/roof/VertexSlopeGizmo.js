import { EVENTS } from '../../core/registry.js';
import { coreEventBus } from '../../core/EventBus.js';
import * as THREE from 'three';

export class VertexSlopeGizmo extends THREE.Group {
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
        this.handleGeo = new THREE.SphereGeometry(6, 16, 16);
        
        this.selectedIndices = new Set();
        this.activeDragIndex = -1;
        this.isDragging = false;
        this.dragPlane = new THREE.Plane();
        this.dragOffset = new THREE.Vector3();
        this.initialElevations = [];
        this.dragStartPos = new THREE.Vector3();

        const dom = this.ctx.renderer.domElement;
        
        this._onPointerDown = (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'vertex_slope') return;
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
                
                this.dragPlane.setFromNormalAndCoplanarPoint(
                    this.ctx.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize(),
                    intersects[0].point
                );
                
                this.dragStartPos.copy(intersects[0].point);
                
                const entity = this.target.userData.entity;
                if (!entity.params) entity.params = {};
                if (!entity.params.vertexElevations) {
                    entity.params.vertexElevations = new Array(this.handles.children.length).fill(0);
                }
                this.initialElevations = [...entity.params.vertexElevations];
                
                this.refreshHandleMaterials();
                if (this.ctx.controls) this.ctx.controls.enabled = false;
            } else {
                this.selectedIndices.clear();
                this.refreshHandleMaterials();
            }
        };
        
        this._onPointerMove = (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'vertex_slope') return;
            this.updateMouse(e);
            
            if (this.isDragging && this.activeDragIndex !== -1) {
                e.preventDefault();
                e.stopPropagation();
                
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const planeIntersect = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, planeIntersect);
                
                if (planeIntersect) {
                    const deltaY = planeIntersect.y - this.dragStartPos.y;
                    const entity = this.target.userData.entity;
                    
                    this.selectedIndices.forEach(idx => {
                        entity.params.vertexElevations[idx] = (this.initialElevations[idx] || 0) + deltaY;
                    });
                    
                    if (this.ctx.updateShapeLive) {
                        this.ctx.updateShapeLive(entity);
                    } else if (this.ctx.syncToUI) {
                        this.ctx.syncToUI();
                    }
                    this.updateHandles();
                }
                return;
            }
            
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, false);
            
            this.handles.children.forEach(c => {
                if (this.selectedIndices.has(c.userData.index)) {
                    c.material = this.handleMatActive;
                } else {
                    c.material = this.handleMat;
                }
            });
            
            if (intersects.length > 0) {
                dom.style.cursor = 'ns-resize';
                const hovered = intersects[0].object;
                if (!this.selectedIndices.has(hovered.userData.index)) {
                    hovered.material = this.handleMatHover;
                }
            } else {
                dom.style.cursor = 'auto';
            }
        };
        
        this._onPointerUp = (e) => {
            if (this.isDragging) {
                e.preventDefault();
                e.stopPropagation();
                this.isDragging = false;
                this.activeDragIndex = -1;
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                
                if (typeof window !== 'undefined') {
                    coreEventBus.emit(EVENTS.VERTEX_SLOPE_GIZMO_END, { entity: this.target.userData.entity });
                }
            }
        };

        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointermove', this._onPointerMove);
        dom.addEventListener('pointerup', this._onPointerUp);
    }
    
    updateMouse(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    attach(target) {
        this.target = target;
        this.visible = true;
        this.selectedIndices.clear();
        this.updateHandles();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.handles.clear();
    }

    updateHandles() {
        if (!this.target || !this.target.userData.entity) return;
        const entity = this.target.userData.entity;
        if (!entity.params) entity.params = {};
        const h = entity.params.height3D || 100;
        const elevations = entity.params.vertexElevations || [];
        
        this.handles.clear();
        
        let corners = [];
        if (entity.type === 'shape_rect') {
            const w2 = (entity.params.width || 100) / 2;
            const d2 = (entity.params.height || 100) / 2;
            corners = [
                { x: -w2, z: -d2 },
                { x: w2, z: -d2 },
                { x: w2, z: d2 },
                { x: -w2, z: d2 }
            ];
        } else if (entity.type === 'shape_polygon' || entity.type === 'shape_triangle') {
            if (entity.params.points) {
                corners = entity.params.points.map(p => ({ x: p.x, z: p.y }));
            }
        }
        
        if (corners.length === 0) return;
        
        if (elevations.length !== corners.length) {
            entity.params.vertexElevations = new Array(corners.length).fill(0);
        }
        
        this.position.copy(this.target.getWorldPosition(new THREE.Vector3()));
        this.quaternion.copy(this.target.getWorldQuaternion(new THREE.Quaternion()));
        
        corners.forEach((c, idx) => {
            const mesh = new THREE.Mesh(this.handleGeo, this.selectedIndices.has(idx) ? this.handleMatActive : this.handleMat);
            mesh.userData = { index: idx };
            mesh.position.set(c.x, h + (entity.params.vertexElevations[idx] || 0), c.z);
            
            // Add a vertical line connecting to the base
            const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, -(h + (entity.params.vertexElevations[idx] || 0)), 0)
            ]);
            const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
            const line = new THREE.Line(lineGeo, lineMat);
            mesh.add(line);
            
            this.handles.add(mesh);
        });
        
        this.renderOrder = 999;
    }
    
    refreshHandleMaterials() {
        this.handles.children.forEach(c => {
            c.material = this.selectedIndices.has(c.userData.index) ? this.handleMatActive : this.handleMat;
        });
    }

    dispose() {
        const dom = this.ctx.renderer.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown, { passive: false });
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (this.handleMat) this.handleMat.dispose();
        if (this.handleMatHover) this.handleMatHover.dispose();
        if (this.handleMatActive) this.handleMatActive.dispose();
        if (this.handleGeo) this.handleGeo.dispose();
        
        this.handles.children.forEach(c => {
            if (c.geometry && c.geometry !== this.handleGeo) c.geometry.dispose();
        });

        if (this.parent) this.parent.remove(this);
    }
}

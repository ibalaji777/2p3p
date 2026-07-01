import * as THREE from 'three';

export class PolygonGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.handles = new THREE.Group();
        this.add(this.handles);
        
        this.target = null;
        this.visible = false;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.activeDragIndex = -1;
        this.isDragging = false;
        this.dragPlane = new THREE.Plane();
        this.dragOffset = new THREE.Vector3();
        this.initialPoints = [];
        this.dragStartPos = new THREE.Vector3();

        const geo = new THREE.SphereGeometry(6, 16, 16);
        this.handleMat = new THREE.MeshBasicMaterial({ color: 0xef4444, depthTest: false, transparent: true, opacity: 0.8 });
        this.handleMatHover = new THREE.MeshBasicMaterial({ color: 0xfca5a5, depthTest: false, transparent: true, opacity: 1.0 });
        
        for (let i = 0; i < 20; i++) {
            const mesh = new THREE.Mesh(geo, this.handleMat);
            mesh.userData = { isPolygonHandle: true, index: i, type: 'edge' };
            mesh.visible = false;
            this.handles.add(mesh);
        }

        const dom = this.ctx.renderer.domElement;
        
        dom.addEventListener('pointerdown', (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'polygon_edges') return;
            if (e.button !== 0) return;
            this.updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, false);
            if (intersects.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                
                const handle = intersects[0].object;
                this.activeDragIndex = handle.userData.index;
                
                // Setup drag plane
                this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), handle.getWorldPosition(new THREE.Vector3()));
                this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPos);
                
                const entity = this.target.userData.entity;
                this.initialPoints = entity.params.points.map(p => ({ x: p.x, y: p.y }));
                
                this.isDragging = true;
                this.ctx.controls.enabled = false;
            }
        });

        dom.addEventListener('pointermove', (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'polygon_edges') return;
            this.updateMouse(e);
            
            if (this.isDragging && this.activeDragIndex !== -1 && this.target && this.target.userData.entity) {
                e.preventDefault();
                e.stopPropagation();
                
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const currentPos = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, currentPos)) {
                    
                    const localStart = this.target.worldToLocal(this.dragStartPos.clone());
                    const localCurrent = this.target.worldToLocal(currentPos.clone());
                    
                    const handle = this.handles.children[this.activeDragIndex];
                    const normal = handle.userData.normal;
                    
                    // Project movement onto normal
                    const moveX = localCurrent.x - localStart.x;
                    const moveY = localCurrent.z - localStart.z;
                    const dist = (moveX * normal.x) + (moveY * normal.y);
                    
                    const entity = this.target.userData.entity;
                    const pts = entity.params.points;
                    
                    const i1 = this.activeDragIndex;
                    const i2 = (this.activeDragIndex + 1) % pts.length;
                    
                    pts[i1].x = this.initialPoints[i1].x + (normal.x * dist);
                    pts[i1].y = this.initialPoints[i1].y + (normal.y * dist);
                    pts[i2].x = this.initialPoints[i2].x + (normal.x * dist);
                    pts[i2].y = this.initialPoints[i2].y + (normal.y * dist);
                    
                    this.updateHandles();
                    if (this.ctx.updateShapeLive) this.ctx.updateShapeLive(entity);
                    if (this.ctx.syncToUI) this.ctx.syncToUI();
                }
            } else {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const intersects = this.raycaster.intersectObjects(this.handles.children, false).filter(h => h.object.visible);
                this.handles.children.forEach(h => {
                    if (h.material !== this.handleMat) h.material = this.handleMat;
                });
                if (intersects.length > 0) {
                    intersects[0].object.material = this.handleMatHover;
                    dom.style.cursor = 'pointer';
                } else {
                    dom.style.cursor = 'auto';
                }
            }
        });

        dom.addEventListener('pointerup', (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                this.activeDragIndex = -1;
                this.ctx.controls.enabled = true;
                if (this.target && this.target.userData.entity) {
                    if (this.ctx.syncToUI) this.ctx.syncToUI();
                    if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
                }
            }
        });
    }

    attach(object) {
        if (!object || !object.userData || !object.userData.entity) return;
        const entity = object.userData.entity;
        if (!entity.params || !entity.params.points) return;

        this.target = object;
        this.visible = true;
        this.updateHandles();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.activeDragIndex = -1;
        this.isDragging = false;
        this.handles.children.forEach(c => c.visible = false);
    }

    updateHandles() {
        if (!this.target) return;
        const entity = this.target.userData.entity;
        const pts = entity.params.points;
        if (!pts) return;

        this.position.copy(this.target.position);
        this.rotation.copy(this.target.rotation);

        for (let i = 0; i < this.handles.children.length; i++) {
            const handle = this.handles.children[i];
            if (i < pts.length) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % pts.length];
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                
                handle.position.set(midX, 5, midY); 
                handle.visible = true;
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.hypot(dx, dy);
                // Rotate vector by 90 degrees to get outward normal
                // In 2D canvas, Y goes down, so dx, dy might need different signs.
                // Assuming standard right-hand rule, outward normal is (-dy, dx)
                handle.userData.normal = { x: dy / len, y: -dx / len }; 
            } else {
                handle.visible = false;
            }
        }
    }

    updateMouse(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
}

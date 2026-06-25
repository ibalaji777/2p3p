import * as THREE from 'three';

export class CornerRadiusGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.target = null;
        this.handles = new THREE.Group();
        this.add(this.handles);
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.visible = false;
        
        this.handleMat = new THREE.MeshBasicMaterial({ color: 0xfca5a5, depthTest: false, transparent: true, opacity: 0.9 });
        this.handleMatHover = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true, opacity: 1.0 });
        this.handleMatActive = new THREE.MeshBasicMaterial({ color: 0x4ade80, depthTest: false, transparent: true, opacity: 1.0 });
        this.handleGeo = new THREE.SphereGeometry(3, 16, 16);
        
        this.activeHandleIndex = -1;

        const dom = this.ctx.renderer.domElement;
        
        dom.addEventListener('pointerdown', (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'corner') return;
            if (e.button !== 0) return;
            this.updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, false);
            if (intersects.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                
                const handle = intersects[0].object;
                this.activeHandleIndex = handle.userData.index;
                this.refreshHandleMaterials();
                
                if (this.ctx.updateCornerPanel) {
                    this.ctx.updateCornerPanel(this.target.userData.entity, this.activeHandleIndex);
                }
            }
        }, { passive: false });
        
        dom.addEventListener('pointermove', (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'corner') return;
            this.updateMouse(e);
            
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, false);
            
            this.handles.children.forEach(c => {
                c.scale.set(1, 1, 1);
                if (c.userData.index !== this.activeHandleIndex) c.material = this.handleMat;
            });
            
            if (intersects.length > 0) {
                intersects[0].object.scale.set(1.2, 1.2, 1.2);
                if (intersects[0].object.userData.index !== this.activeHandleIndex) {
                    intersects[0].object.material = this.handleMatHover;
                }
                dom.style.cursor = 'pointer';
            } else {
                dom.style.cursor = 'auto';
            }
        }, { passive: false });
    }
    
    updateMouse(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    refreshHandleMaterials() {
        this.handles.children.forEach(c => {
            c.material = (c.userData.index === this.activeHandleIndex) ? this.handleMatActive : this.handleMat;
        });
    }

    attach(target) {
        this.target = target;
        this.visible = true;
        this.activeHandleIndex = -1; // Reset selection
        this.updateHandles();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.activeHandleIndex = -1;
        this.handles.clear();
    }

    updateHandles() {
        this.handles.clear();
        if (!this.target || !this.target.userData.entity) return;
        
        const entity = this.target.userData.entity;
        if (!entity.computedPts) return;
        
        this.position.copy(this.target.getWorldPosition(new THREE.Vector3()));
        this.quaternion.copy(this.target.getWorldQuaternion(new THREE.Quaternion()));
        
        const zOff = entity.computedZOffset || 0;
        
        entity.computedPts.forEach((pt, index) => {
            const mesh = new THREE.Mesh(this.handleGeo, this.handleMat);
            mesh.position.set(pt.x, pt.y, zOff);
            mesh.userData = { isCornerHandle: true, index: index };
            mesh.renderOrder = 999;
            this.handles.add(mesh);
        });
        
        this.refreshHandleMaterials();
    }
}

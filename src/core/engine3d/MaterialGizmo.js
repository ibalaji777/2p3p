import * as THREE from 'three';

export class MaterialGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.target = null;
        this.hoveredFace = null;
        
        this.handles = new THREE.Group();
        this.add(this.handles);
        
        const createFacePlane = (name, color) => {
            const mat = new THREE.MeshBasicMaterial({ 
                color, 
                transparent: true, 
                opacity: 0.0, 
                side: THREE.DoubleSide, 
                depthTest: false 
            });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
            mesh.name = name;
            mesh.userData.isFaceHandle = true;
            mesh.renderOrder = 998;
            this.handles.add(mesh);
            return mesh;
        };

        // Redish/Blueish glowing colors for the faces
        this.faces = {
            front: createFacePlane('front', 0x3b82f6),
            back: createFacePlane('back', 0x3b82f6),
            left: createFacePlane('left', 0x3b82f6),
            right: createFacePlane('right', 0x3b82f6),
            top: createFacePlane('top', 0x10b981),
            bottom: createFacePlane('bottom', 0x10b981)
        };
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.visible = false;
        
        const dom = this.ctx.renderer.domElement;
        
        dom.addEventListener('pointerdown', (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'material') return;
            if (e.button !== 0) return;
            this.updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, false);
            if (intersects.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                
                const selectedFace = intersects[0].object.name;
                
                // Highlight briefly to indicate click
                intersects[0].object.material.opacity = 0.6;
                setTimeout(() => {
                    if (intersects[0].object) intersects[0].object.material.opacity = 0.2;
                }, 150);
                
                // Dispatch event to Vue UI
                const event = new CustomEvent('material-gizmo-select', { detail: { face: selectedFace }});
                window.dispatchEvent(event);
                
                // Also update the target's param if possible
                if (this.target && this.target.userData.entity) {
                    this.target.userData.entity.params = this.target.userData.entity.params || {};
                    this.target.userData.entity.params.materialTarget = selectedFace;
                    if (this.ctx.syncToUI) this.ctx.syncToUI();
                }
            }
        }, { passive: false });
        
        dom.addEventListener('pointermove', (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'material') return;
            this.updateMouse(e);
            
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, false);
            
            // Reset all
            Object.values(this.faces).forEach(mesh => mesh.material.opacity = 0.0);
            this.hoveredFace = null;
            dom.style.cursor = 'auto';
            
            if (intersects.length > 0) {
                this.hoveredFace = intersects[0].object;
                this.hoveredFace.material.opacity = 0.3; // Glow on hover
                dom.style.cursor = 'pointer';
                e.stopPropagation();
            }
        }, { passive: false });
    }
    
    updateMouse(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    attach(target) {
        this.target = target;
        this.visible = true;
        this.updateHandles();
    }

    detach() {
        this.target = null;
        this.visible = false;
        Object.values(this.faces).forEach(mesh => mesh.material.opacity = 0.0);
    }

    updateHandles() {
        if (!this.target) return;
        
        // Calculate the bounding box of the target to size our planes
        const box = new THREE.Box3().setFromObject(this.target);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        this.position.copy(center);
        // We do NOT copy the rotation, because Box3 is axis-aligned.
        // Wait, if the object is rotated, Box3 gives the world-aligned bounding box!
        // To be accurate, we should align with the object's local axes.
        this.quaternion.copy(this.target.getWorldQuaternion(new THREE.Quaternion()));
        
        // If we want local bounds, we can compute Box3 on the geometry or assume entity dimensions.
        let w = size.x, h = size.y, d = size.z;
        if (this.target.userData.entity) {
            const entity = this.target.userData.entity;
            if (entity.type === 'shape_rect') {
                w = entity.params?.width || 100;
                h = entity.height || 120;
                d = entity.params?.height || 100; // 2D height is 3D depth
            } else if (entity.type === 'shape_circle') {
                w = (entity.params?.radius || 50) * 2;
                h = entity.height || 120;
                d = w;
            } else if (entity.type === 'shape_polygon') {
                // Polygon requires box3
                const localBox = new THREE.Box3().setFromObject(this.target);
                const localSize = new THREE.Vector3();
                localBox.getSize(localSize);
                w = localSize.x;
                h = localSize.y;
                d = localSize.z;
            }
        }
        
        const padding = 1.0; // Extend slightly outside the shape
        
        // Front Face (+Z)
        this.faces.front.scale.set(w + padding, h + padding, 1);
        this.faces.front.position.set(0, 0, d/2 + padding/2);
        
        // Back Face (-Z)
        this.faces.back.scale.set(w + padding, h + padding, 1);
        this.faces.back.position.set(0, 0, -d/2 - padding/2);
        
        // Left Face (-X)
        this.faces.left.scale.set(d + padding, h + padding, 1);
        this.faces.left.position.set(-w/2 - padding/2, 0, 0);
        this.faces.left.rotation.y = Math.PI / 2;
        
        // Right Face (+X)
        this.faces.right.scale.set(d + padding, h + padding, 1);
        this.faces.right.position.set(w/2 + padding/2, 0, 0);
        this.faces.right.rotation.y = Math.PI / 2;
        
        // Top Face (+Y)
        this.faces.top.scale.set(w + padding, d + padding, 1);
        this.faces.top.position.set(0, h/2 + padding/2, 0);
        this.faces.top.rotation.x = -Math.PI / 2;
        
        // Bottom Face (-Y)
        this.faces.bottom.scale.set(w + padding, d + padding, 1);
        this.faces.bottom.position.set(0, -h/2 - padding/2, 0);
        this.faces.bottom.rotation.x = Math.PI / 2;
    }
}

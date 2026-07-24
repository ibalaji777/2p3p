import * as THREE from 'three';

export class MaterialGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.target = null;
        this.hoveredFace = null;
        this.highlightedObject = null;
        this.highlightedMatIndex = -1;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.visible = false;
        
        const dom = this.ctx.renderer.domElement;
        
        this.pointerDownPos = new THREE.Vector2();
        this.isDragging = false;

        this._onPointerDown = (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'material' || !this.target || this.isPanelOpen) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            this.updateMouse(e);
            this.pointerDownPos.copy(this.mouse);
            this.isDragging = false;
        };
        
        this._onPointerMove = (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'material' || !this.target || this.isPanelOpen) return;
            this.updateMouse(e);
            
            if (this.pointerDownPos.distanceTo(this.mouse) > 0.02) {
                this.isDragging = true;
            }
            
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObject(this.target, true);
            
            const validIntersects = intersects.filter(i => {
                const mat = i.object.material;
                if (i.object.userData.isHitbox) return false;
                if (mat && mat.type === 'MeshBasicMaterial' && mat.opacity === 0) return false;
                return true;
            });
            
            if (validIntersects.length > 0) {
                const intersect = validIntersects[0];
                
                dom.style.cursor = 'crosshair';
                
                if (this.highlightedObject !== intersect.object || this.highlightedMatIndex !== intersect.face.materialIndex) {
                    this.clearHighlight();
                    this.highlightedObject = intersect.object;
                    this.highlightedMatIndex = intersect.face.materialIndex;
                    this.setHighlight(this.highlightedObject, this.highlightedMatIndex, true);
                }
            } else {
                dom.style.cursor = 'auto';
                this.clearHighlight();
            }
        };

        this._onPointerUp = (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'material' || !this.target || this.isPanelOpen) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            
            if (this.isDragging) return; // Ignore drag actions, only trigger on clear clicks/taps
            
            this.updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObject(this.target, true);
            
            const validIntersects = intersects.filter(i => {
                const mat = i.object.material;
                if (i.object.userData.isHitbox) return false;
                if (mat && mat.type === 'MeshBasicMaterial' && mat.opacity === 0) return false;
                return true;
            });
            
            if (validIntersects.length > 0) {
                const intersect = validIntersects[0];
                const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld);
                const worldNormal = intersect.face.normal.clone().applyMatrix3(normalMatrix).normalize();
                const rootNormalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld).invert();
                const localNormal = worldNormal.clone().applyMatrix3(rootNormalMatrix).normalize();
                
                const absX = Math.abs(localNormal.x);
                const absY = Math.abs(localNormal.y);
                const absZ = Math.abs(localNormal.z);
                let selectedFace = '';
                if (absX > absY && absX > absZ) selectedFace = localNormal.x > 0 ? 'right' : 'left';
                else if (absY > absX && absY > absZ) selectedFace = localNormal.y > 0 ? 'top' : 'bottom';
                else selectedFace = localNormal.z > 0 ? 'front' : 'back';
                
                e.preventDefault();
                e.stopPropagation();
                
                this.isPanelOpen = true;
                
                if (this.highlightedObject !== intersect.object || this.highlightedMatIndex !== intersect.face.materialIndex) {
                    this.clearHighlight();
                }
                
                this.selectedFace = selectedFace;
                
                let subMeshIndex = -1;
                if (this.target && this.target.isGroup) {
                    const validChildren = this.target.children.filter(c => !c.userData.isHitbox);
                    subMeshIndex = validChildren.indexOf(intersect.object);
                }
                
                this.activeObject = intersect.object;
                this.activeMatIndex = intersect.face.materialIndex;
                
                this.highlightedObject = this.activeObject;
                this.highlightedMatIndex = this.activeMatIndex;
                this.setHighlight(this.highlightedObject, this.highlightedMatIndex, true);
                
                // Dispatch event to Vue UI or GizmoManager
                if (this.ctx.gizmoManager && this.ctx.gizmoManager.onMaterialFaceSelected) {
                    this.ctx.gizmoManager.onMaterialFaceSelected(this.selectedFace, subMeshIndex, this.activeObject, this.activeMatIndex);
                }
            }
        };

        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointermove', this._onPointerMove);
        dom.addEventListener('pointerup', this._onPointerUp);
    }

    setHighlight(mesh, matIndex, active) {
        if (!mesh || !mesh.material) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (mats[matIndex] && mats[matIndex].type !== 'MeshBasicMaterial') {
            const mat = mats[matIndex];
            if (mat.emissive !== undefined) {
                if (active) {
                    if (mat.userData.origEmissive === undefined) { 
                        mat.userData.origEmissive = mat.emissive.getHex(); 
                        mat.userData.origEmissiveIntensity = mat.emissiveIntensity || 0; 
                    }
                    mat.emissive.setHex(0x00ff00); 
                    mat.emissiveIntensity = 0.8;
                } else {
                    if (mat.userData.origEmissive !== undefined) { 
                        mat.emissive.setHex(mat.userData.origEmissive); 
                        mat.emissiveIntensity = mat.userData.origEmissiveIntensity; 
                    }
                }
                mat.needsUpdate = true;
            }
        }
    }

    clearHighlight() {
        if (this.highlightedObject) {
            this.setHighlight(this.highlightedObject, this.highlightedMatIndex, false);
            this.highlightedObject = null;
            this.highlightedMatIndex = -1;
        }
    }

    updateMouse(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    attach(target) {
        this.target = target;
        this.visible = true;
        this.isPanelOpen = false;
        this.clearHighlight();
    }

    detach() {
        this.clearHighlight();
        this.target = null;
        this.visible = false;
        this.isPanelOpen = false;
    }

    updateHighlights() {
        if (!this.visible || this.ctx.currentTransformMode !== 'material' || !this.target) return;
        
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const intersects = this.raycaster.intersectObject(this.target, true);
        
        const validIntersects = intersects.filter(i => {
            const mat = i.object.material;
            if (i.object.userData.isHitbox) return false;
            if (mat && mat.type === 'MeshBasicMaterial' && mat.opacity === 0) return false;
            return true;
        });
        
        if (validIntersects.length > 0) {
            const intersect = validIntersects[0];
            this.clearHighlight();
            this.highlightedObject = intersect.object;
            this.highlightedMatIndex = intersect.face.materialIndex;
            this.setHighlight(this.highlightedObject, this.highlightedMatIndex, true);
            
            this.activeObject = intersect.object;
            this.activeMatIndex = intersect.face.materialIndex;
        }
    }

    updateHandles() {
        // Obsolete in direct raycast mode
    }

    dispose() {
        const dom = this.ctx.renderer.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (this.parent) this.parent.remove(this);
    }
}

import * as THREE from 'three';
import { BIMMaterialSystem } from './BIMMaterialSystem.js';

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
                
                let localNormal = null;
                if (intersect.face && intersect.face.normal) {
                    const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld);
                    const worldNormal = intersect.face.normal.clone().applyMatrix3(normalMatrix).normalize();
                    const rootNormalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld).invert();
                    localNormal = worldNormal.clone().applyMatrix3(rootNormalMatrix).normalize();
                }

                const descriptor = BIMMaterialSystem.resolveBIMTarget(intersect.object, intersect.face?.materialIndex, localNormal, this.target?.userData?.entity);
                
                if (this.highlightedObject !== descriptor.mesh || this.highlightedMatIndex !== descriptor.targetMatIndex) {
                    this.clearHighlight();
                    this.highlightedObject = descriptor.mesh;
                    this.highlightedMatIndex = descriptor.targetMatIndex;
                    BIMMaterialSystem.setBIMHighlight(descriptor, true);
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
                
                const descriptor = BIMMaterialSystem.resolveBIMTarget(intersect.object, intersect.face.materialIndex, localNormal, this.target?.userData?.entity);
                
                e.preventDefault();
                e.stopPropagation();
                
                this.isPanelOpen = true;
                
                if (this.highlightedObject !== descriptor.mesh || this.highlightedMatIndex !== descriptor.targetMatIndex) {
                    this.clearHighlight();
                }
                
                this.activeDescriptor = descriptor;
                this.selectedFace = descriptor.faceName;
                this.activeObject = descriptor.mesh;
                this.activeMatIndex = descriptor.targetMatIndex;
                this.highlightedObject = descriptor.mesh;
                this.highlightedMatIndex = descriptor.targetMatIndex;
                
                console.info(`%c[BIM Selected Area] %c${descriptor.entity?.type || 'Mesh'} %c-> Face: %c${descriptor.faceName} %c| Component: %c${descriptor.componentType} %c| Slot: %c${descriptor.slotName}`, 
                    'color: #3b82f6; font-weight: bold;', 'color: #10b981;', 'color: #9ca3af;', 'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #8b5cf6; font-weight: bold;', 'color: #9ca3af;', 'color: #ec4899; font-weight: bold;');
                console.info(`%c[BIM Highlight] %cEmissive Green activated on %c${descriptor.componentType || 'Mesh'}`, 
                    'color: #10b981; font-weight: bold;', 'color: #9ca3af;', 'color: #f59e0b; font-weight: bold;');

                BIMMaterialSystem.setBIMHighlight(descriptor, true);
                
                // Dispatch event to Vue UI or GizmoManager
                if (this.ctx.gizmoManager && this.ctx.gizmoManager.onMaterialFaceSelected) {
                    this.ctx.gizmoManager.onMaterialFaceSelected(this.selectedFace, descriptor.subMeshIndex, this.activeObject, this.activeMatIndex, null, descriptor);
                }
            }
        };

        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointermove', this._onPointerMove);
        dom.addEventListener('pointerup', this._onPointerUp);
    }

    setHighlight(mesh, matIndex, active) {
        if (!mesh) return;
        const descriptor = BIMMaterialSystem.resolveBIMTarget(mesh, matIndex, null, this.target?.userData?.entity);
        BIMMaterialSystem.setBIMHighlight(descriptor, active, 0x00ff00, this.ctx);
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

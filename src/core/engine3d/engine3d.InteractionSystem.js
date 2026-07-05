import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { TransformControls } from './TransformControls.js';
import { MaterialGizmo } from './MaterialGizmo.js';
import { CornerRadiusGizmo } from './CornerRadiusGizmo.js';
import { VertexSlopeGizmo } from './VertexSlopeGizmo.js';
import { RoofCornerGizmo } from './RoofCornerGizmo.js';
import { RoofOverhangGizmo } from './RoofOverhangGizmo.js';
import { PolygonGizmo } from './PolygonGizmo.js';
import { SelectionManager } from './engine3d.SelectionManager.js';

import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS } from '../../core/registry';

export class OpeningGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.target = null;
        this.activeHandle = null;
        
        this.handles = new THREE.Group();
        this.add(this.handles);
        
        const createHandle = (name, color, w, h, d) => {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(w, h, d),
                new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 })
            );
            mesh.name = name;
            mesh.userData.isOpeningHandle = true;
            mesh.renderOrder = 999;
            this.handles.add(mesh);
            return mesh;
        };

        const hs = 15;
        this.hLeft = createHandle('left', 0xfca5a5, hs, hs*3, hs);
        this.hRight = createHandle('right', 0xfca5a5, hs, hs*3, hs);
        this.hTop = createHandle('top', 0x86efac, hs*3, hs, hs);
        this.hBottom = createHandle('bottom', 0x86efac, hs*3, hs, hs);
        this.hFront = createHandle('front', 0x93c5fd, hs, hs, hs*3);
        this.hBack = createHandle('back', 0x93c5fd, hs, hs, hs*3);
        this.hCenter = createHandle('center', 0xfde047, hs*1.5, hs*1.5, hs*1.5);
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dragPlane = new THREE.Plane();
        this.dragOffset = new THREE.Vector3();
        
        this.visible = false;
        
        const dom = this.ctx.renderer.domElement;
        
        dom.addEventListener('pointerdown', (e) => {
            if (!this.visible || (this.ctx.currentTransformMode !== 'opening' && this.ctx.currentTransformMode !== 'translate')) return;
            if (e.button !== 0) return;
            this.updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, false).filter(hit => hit.object.visible);
            if (intersects.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                this.activeHandle = intersects[0].object.name;
                
                const planeNormal = new THREE.Vector3();
                const quat = this.quaternion.clone();
                if (this.activeHandle === 'left' || this.activeHandle === 'right' || this.activeHandle === 'center') {
                    planeNormal.set(0, 0, 1).applyQuaternion(quat);
                } else if (this.activeHandle === 'top' || this.activeHandle === 'bottom') {
                    planeNormal.set(0, 0, 1).applyQuaternion(quat);
                } else if (this.activeHandle === 'front' || this.activeHandle === 'back') {
                    planeNormal.set(1, 0, 0).applyQuaternion(quat);
                }
                
                this.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, intersects[0].point);
                
                const intersectPoint = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
                    this.dragOffset.copy(intersectPoint).sub(this.position);
                }
            }
        }, { passive: false });
        
        dom.addEventListener('pointermove', (e) => {
            if (!this.visible || (this.ctx.currentTransformMode !== 'opening' && this.ctx.currentTransformMode !== 'translate')) return;
            if (this.activeHandle) {
                e.preventDefault();
                e.stopPropagation();
            }
            this.updateMouse(e);
            
            if (!this.activeHandle) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const intersects = this.raycaster.intersectObjects(this.handles.children, false).filter(hit => hit.object.visible);
                this.handles.children.forEach(c => c.scale.set(1, 1, 1));
                if (intersects.length > 0) {
                    intersects[0].object.scale.set(1.2, 1.2, 1.2);
                    dom.style.cursor = 'pointer';
                } else {
                    dom.style.cursor = 'auto';
                }
            }
            
            if (this.activeHandle && this.target && this.target.userData.entity) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const targetPoint = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, targetPoint)) {
                    const localTarget = this.target.worldToLocal(targetPoint.clone());
                    const entity = this.target.userData.entity;
                    const wall = entity.wall;
                    
                    const newWorldPos = targetPoint.clone().sub(this.dragOffset);
                    
                    if (this.activeHandle === 'left') {
                        let maxHalfW = Infinity;
                        if (wall && wall.length3D) maxHalfW = wall.length3D * (entity.t || 0.5) - 2;
                        const newHalfW = Math.min(maxHalfW, Math.max(5, -localTarget.x));
                        entity.width = newHalfW * 2;
                    } else if (this.activeHandle === 'right') {
                        let maxHalfW = Infinity;
                        if (wall && wall.length3D) maxHalfW = wall.length3D * (1 - (entity.t || 0.5)) - 2;
                        const newHalfW = Math.min(maxHalfW, Math.max(5, localTarget.x));
                        entity.width = newHalfW * 2;
                    } else if (this.activeHandle === 'top') {
                        const newH = Math.max(10, localTarget.y);
                        entity.height = newH;
                    } else if (this.activeHandle === 'bottom') {
                        const parentTarget = this.target.parent.worldToLocal(newWorldPos);
                        const wallH = wall.height || wall.config?.height || 120;
                        let opH = entity.height; if (opH === undefined) opH = (entity.type === 'window' ? 45 : (entity.type === 'door' ? 80 : 200));
                        
                        let currentElev = entity.elevation; if (currentElev === undefined) currentElev = (entity.type === 'window' ? 35 : 0);
                        let currentTop = currentElev + opH;
                        let newElev = Math.max(0, Math.min(parentTarget.y, wallH - 10));
                        if (newElev > currentTop - 10) newElev = currentTop - 10;
                        entity.elevation = newElev;
                        entity.height = currentTop - newElev;
                    } else if (this.activeHandle === 'front' || this.activeHandle === 'back') {
                        const newHalfD = Math.max(2, Math.abs(localTarget.z));
                        entity.depth = newHalfD * 2;
                    } else if (this.activeHandle === 'center') {
                        if (wall) {
                            const parentTarget = this.target.parent.worldToLocal(newWorldPos);
                            const p1 = wall.startAnchor ? wall.startAnchor.position() : {x: wall.startX, y: wall.startY};
                            const p2 = wall.endAnchor ? wall.endAnchor.position() : {x: wall.endX, y: wall.endY};
                            const C = p2.x - p1.x, D = p2.y - p1.y;
                            const lenSq = C * C + D * D;
                            if (lenSq !== 0) {
                                let projT = this.target.parent.userData?.entity === wall ? parentTarget.x / wall.length3D : ((parentTarget.x - p1.x) * C + (parentTarget.z - p1.y) * D) / lenSq;
                                projT = Math.max(0.01, Math.min(0.99, projT));
                                entity.t = projT;
                            }
                            
                            const wallH = wall.height || wall.config?.height || 120;
                            let opH = entity.height; if (opH === undefined) opH = (entity.type === 'window' ? 45 : (entity.type === 'door' ? 80 : 200));
                            let newElev = parentTarget.y - opH / 2;
                            entity.elevation = Math.max(0, Math.min(newElev, wallH - opH));
                        }
                    }
                    
                    if (this.ctx.syncToUI) this.ctx.syncToUI();
                    
                    this.updateHandles();
                    if (this.ctx.updateOpeningPanel) this.ctx.updateOpeningPanel(entity);
                    
                    const event = new CustomEvent('opening-gizmo-change', { detail: { entity: this.target.userData.entity }});
                    window.dispatchEvent(event);
                }
            }
        }, { passive: false });
        
        dom.addEventListener('pointerup', (e) => {
            if (this.activeHandle) {
                e.preventDefault();
                e.stopPropagation();
                this.activeHandle = null;
                const event = new CustomEvent('opening-gizmo-end', { detail: { entity: this.target.userData.entity }});
                window.dispatchEvent(event);
            }
        }, { passive: false });
    }
    
    updateMouse(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    attach(target, mode = 'opening') {
        this.target = target;
        this.mode = mode;
        this.visible = true;
        this.updateHandles();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.handles.children.forEach(c => c.scale.set(1, 1, 1));
    }

    updateHandles() {
        if (!this.target || !this.target.userData.entity) return;
        const entity = this.target.userData.entity;
        
        const w = entity.width || 100;
        let h = entity.height;
        let yOffset = 0;
        
        if (h === undefined) {
            if (entity.type === 'sunshade') {
                h = (entity.chajjaType === 'box_frame') ? (entity.frameHeight || 150) : 10;
                if (entity.chajjaType === 'box_frame') {
                    yOffset = -h + 6;
                }
            } else {
                h = (entity.type === 'door') ? 80 : ((entity.type === 'window') ? 45 : 200);
            }
        }
        
        const d = entity.depth || entity.wall?.thickness || 20;
        
        this.position.copy(this.target.getWorldPosition(new THREE.Vector3()));
        this.quaternion.copy(this.target.getWorldQuaternion(new THREE.Quaternion()));

        if (this.mode === 'move') {
            this.hCenter.visible = true;
            this.hLeft.visible = false;
            this.hRight.visible = false;
            this.hTop.visible = false;
            this.hBottom.visible = false;
            this.hFront.visible = false;
            this.hBack.visible = false;
            
            this.hCenter.position.set(0, yOffset + h/2, 0);
        } else {
            this.hCenter.visible = false;
            this.hLeft.visible = true;
            this.hRight.visible = true;
            this.hTop.visible = true;
            this.hBottom.visible = true;
            this.hFront.visible = true;
            this.hBack.visible = true;
            
            this.hLeft.position.set(-w/2, yOffset + h/2, 0);
            this.hRight.position.set(w/2, yOffset + h/2, 0);
            this.hTop.position.set(0, yOffset + h, 0);
            this.hBottom.position.set(0, yOffset, 0);
            this.hFront.position.set(0, yOffset + h/2, d/2);
            this.hBack.position.set(0, yOffset + h/2, -d/2);
        }
        
            this.renderOrder = 999;
    }
}

export class InteractionSystem {
    constructor(ctx) {
        this.ctx = ctx;
        this.selectionManager = new SelectionManager(this.ctx, this);
        this.mode = 'edit';
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedObject = null;
        
        this.tapCount = 0;
        this.lastTapTime = 0;
        this.tapTimeout = null;

        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
        this.wallHighlight = new THREE.Mesh(geo, mat);
        this.wallHighlight.visible = false;

        this.transformControls = new TransformControls(this.ctx.camera, this.ctx.renderer.domElement);
        const syncUI = () => { if (this.ctx.syncToUI) this.ctx.syncToUI(); };
        this.transformControls.addEventListener('move-change', syncUI);
        this.transformControls.addEventListener('scale-change', syncUI);
        this.transformControls.addEventListener('spin-change', syncUI);
        this.transformControls.addEventListener('tilt-change', syncUI);
        this.transformControls.addEventListener('rotate-change', syncUI);
        this.transformControls.visible = false;
        this.ctx.scene.add(this.transformControls);

        this.openingGizmo = new OpeningGizmo(ctx);
        this.ctx.scene.add(this.openingGizmo);

        this.materialGizmo = new MaterialGizmo(ctx);
        this.ctx.scene.add(this.materialGizmo);

        this.cornerGizmo = new CornerRadiusGizmo(ctx);
        this.ctx.scene.add(this.cornerGizmo);

        this.vertexSlopeGizmo = new VertexSlopeGizmo(ctx);
        this.ctx.scene.add(this.vertexSlopeGizmo);

        this.roofCornerGizmo = new RoofCornerGizmo(ctx);
        this.ctx.scene.add(this.roofCornerGizmo);

        this.roofOverhangGizmo = new RoofOverhangGizmo(ctx);
        this.ctx.scene.add(this.roofOverhangGizmo);

        this.polygonGizmo = new PolygonGizmo(ctx);
        this.ctx.scene.add(this.polygonGizmo);

        this.initEvents();
    }

    setMode(mode) {
        this.mode = mode;
        this.cancelRelocation();
        this.deselect();
        this.ctx.controls.enableRotate = (mode === 'camera');
        this.ctx.renderer.domElement.style.cursor = (mode === 'camera') ? 'grab' : 'auto';
    }

    updateMouse(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    initEvents() {
        const dom = this.ctx.renderer.domElement;
        
        dom.addEventListener('pointerdown', (e) => {
            if (this.ctx.viewMode3D === 'preview') return;
            if (this.transformControls && this.transformControls.active) return;
            if (this.mode === 'camera' || e.button !== 0) return;
            this.updateMouse(e);
            
            const now = Date.now();
            if (now - this.lastTapTime < 350) {
                this.tapCount++;
            } else {
                this.tapCount = 1;
            }
            this.lastTapTime = now;
            
            // If currently in a transform mode, block all other object selections
            if (this.ctx.currentTransformMode && this.ctx.currentTransformMode !== 'none') {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                
                if (this.transformControls && this.transformControls.visible) {
                    if (this.raycaster.intersectObjects(this.transformControls.handles.children, true).length > 0) return;
                }
                if (this.openingGizmo && this.openingGizmo.visible) {
                    if (this.raycaster.intersectObjects(this.openingGizmo.handles.children, true).length > 0) return;
                }
                if (this.cornerGizmo && this.cornerGizmo.visible) {
                    if (this.raycaster.intersectObjects(this.cornerGizmo.handles.children, true).length > 0) return;
                }
                if (this.polygonGizmo && this.polygonGizmo.visible) {
                    if (this.raycaster.intersectObjects(this.polygonGizmo.edgeHandles.children, true).length > 0) return;
                    if (this.raycaster.intersectObjects(this.polygonGizmo.cornerHandles.children, true).length > 0) return;
                }
                
                const intersects = this.raycaster.intersectObjects(this.ctx.interactables, true);
                if (intersects.length === 0) {
                    this.ctx.setTransformMode('none', true);
                    this.deselect();
                }
                return;
            }

            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.ctx.interactables, true);
            if (intersects.length > 0) {
                let mesh = intersects[0].object;

                if (mesh.userData.isFloorTrigger) {
                    // IGNORE FLOOR CLICKS IF IN FULL BUILDING VIEW
                    if (this.ctx.viewMode3D === 'full-edit') return; 
                    if (this.ctx.onLevelSwitchRequest) {
                        this.ctx.onLevelSwitchRequest(
                            mesh.userData.levelIndex, 
                            mesh.userData.entityIndex, 
                            mesh.userData.entityType
                        );
                    }
                    return;
                }

                while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor && !mesh.userData.isFloor && !mesh.userData.isWidget && !mesh.userData.isMolding && !mesh.userData.isRoof && !mesh.userData.isPattern && !mesh.userData.isStair && !mesh.userData.isFloorCutProxy) mesh = mesh.parent;
                
                if (mesh && (mesh.userData.isFurniture || mesh.userData.isWallSide || mesh.userData.isWallDecor || mesh.userData.isFloor || mesh.userData.isWidget || mesh.userData.isMolding || mesh.userData.isRoof || mesh.userData.isPattern || mesh.userData.isStair || mesh.userData.isFloorCutProxy)) {
                    if (this.mode === 'edit') {
                        this.selectObject(mesh);
                    }
                }
            } else this.deselect();
        });

        dom.addEventListener('pointermove', (e) => {
            if (this.ctx.viewMode3D === 'preview') return;
            if (this.transformControls && this.transformControls.active) return;
            if (this.mode === 'camera') return;
            this.updateMouse(e);
            
            if (this.ctx.currentTransformMode && this.ctx.currentTransformMode !== 'none') {
                // Clear hover highlights while using transform gizmos
                if (this.hoveredObject && this.hoveredObject !== this.selectedObject) {
                    this.setHighlight(this.hoveredObject, false);
                    this.hoveredObject = null;
                }
                return;
            }

            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.ctx.interactables, true);
            if (intersects.length > 0) {
                dom.style.cursor = 'pointer';
                let mesh = intersects[0].object;
                while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor && !mesh.userData.isRoom && !mesh.userData.isRoof && !mesh.userData.isWidget && !mesh.userData.isMolding && !mesh.userData.isPattern && !mesh.userData.isStair && !mesh.userData.isFloorCutProxy) mesh = mesh.parent;
                if (this.hoveredObject !== mesh) {
                    if (this.hoveredObject && this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget || this.hoveredObject.userData.isMolding || this.hoveredObject.userData.isPattern || this.hoveredObject.userData.isStair || this.hoveredObject.userData.isFloorCutProxy)) this.setHighlight(this.hoveredObject, false);
                    this.hoveredObject = mesh;
                    if (this.hoveredObject && this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget || this.hoveredObject.userData.isMolding || this.hoveredObject.userData.isPattern || this.hoveredObject.userData.isStair || this.hoveredObject.userData.isFloorCutProxy)) this.setHighlight(this.hoveredObject, true, 0x93c5fd);
                }
            } else {
                dom.style.cursor = 'auto';
                if (this.hoveredObject) {
                    if (this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget || this.hoveredObject.userData.isMolding || this.hoveredObject.userData.isPattern || this.hoveredObject.userData.isStair || this.hoveredObject.userData.isFloorCutProxy)) this.setHighlight(this.hoveredObject, false);
                    this.hoveredObject = null;
                }
            }
        });

    }

    setTransformMode(mode) {
        if (!this.selectedObject) return;
        
        if (mode === 'material') {
            if (this.transformControls) this.transformControls.detach();
            if (this.openingGizmo) this.openingGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.detach();
            if (this.materialGizmo) this.materialGizmo.attach(this.selectedObject);
        } else if (mode === 'opening') {
            if (this.transformControls) this.transformControls.detach();
            if (this.materialGizmo) this.materialGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.detach();
            if (this.roofCornerGizmo) this.roofCornerGizmo.attach(this.selectedObject);
            if (this.polygonGizmo) this.polygonGizmo.detach();
            if (this.roofOverhangGizmo) this.roofOverhangGizmo.detach();
            if (this.openingGizmo) this.openingGizmo.attach(this.selectedObject);
        } else if (mode === 'corner') {
            if (this.transformControls) this.transformControls.detach();
            if (this.openingGizmo) this.openingGizmo.detach();
            if (this.materialGizmo) this.materialGizmo.detach();
            if (this.vertexSlopeGizmo) this.vertexSlopeGizmo.detach();
            if (this.roofCornerGizmo) this.roofCornerGizmo.detach();
            if (this.roofOverhangGizmo) this.roofOverhangGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.attach(this.selectedObject);
        } else if (mode === 'roof_corners') {
            if (this.transformControls) this.transformControls.detach();
            if (this.openingGizmo) this.openingGizmo.detach();
            if (this.materialGizmo) this.materialGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.detach();
            if (this.vertexSlopeGizmo) this.vertexSlopeGizmo.detach();
            if (this.roofCornerGizmo) this.roofCornerGizmo.attach(this.selectedObject);
            if (this.roofOverhangGizmo) this.roofOverhangGizmo.detach();
        } else if (mode === 'roof_overhang') {
            if (this.transformControls) this.transformControls.detach();
            if (this.openingGizmo) this.openingGizmo.detach();
            if (this.materialGizmo) this.materialGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.detach();
            if (this.vertexSlopeGizmo) this.vertexSlopeGizmo.detach();
            if (this.roofCornerGizmo) this.roofCornerGizmo.detach();
            if (this.roofOverhangGizmo) this.roofOverhangGizmo.attach(this.selectedObject);
        } else if (mode === 'none') {
            if (this.transformControls) this.transformControls.detach();
            if (this.openingGizmo) this.openingGizmo.detach();
            if (this.materialGizmo) this.materialGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.detach();
            if (this.vertexSlopeGizmo) this.vertexSlopeGizmo.detach();
            if (this.roofCornerGizmo) this.roofCornerGizmo.detach();
            if (this.roofOverhangGizmo) this.roofOverhangGizmo.detach();
        } else {
            if (this.openingGizmo) this.openingGizmo.detach();
            if (this.materialGizmo) this.materialGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.detach();
            if (this.vertexSlopeGizmo) this.vertexSlopeGizmo.detach();
            if (this.roofCornerGizmo) this.roofCornerGizmo.detach();
            if (this.roofOverhangGizmo) this.roofOverhangGizmo.detach();
            if (this.transformControls) {
                this.transformControls.mode = mode;
                this.transformControls.attach(this.selectedObject);
            }
        }
    }

    setRelocationState(active) {
        if (this.ctx.onRelocateStateChange) this.ctx.onRelocateStateChange(active);
    }

    cancelRelocation() {
        this.setRelocationState(false);
    }

    setHighlight(group, active, color = 0x3b82f6) {
        if (!group) return;
        group.traverse((child) => {
            if (child.isMesh && !child.userData.isHitbox && child.material && child.material.type !== 'MeshBasicMaterial') {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    if (mat.emissive !== undefined) {
                        if (active) {
                            if (mat.userData.origEmissive === undefined) { mat.userData.origEmissive = mat.emissive.getHex(); mat.userData.origEmissiveIntensity = mat.emissiveIntensity || 0; }
                            mat.emissive.setHex(color); mat.emissiveIntensity = 0.5;
                        } else {
                            if (mat.userData.origEmissive !== undefined) { mat.emissive.setHex(mat.userData.origEmissive); mat.emissiveIntensity = mat.userData.origEmissiveIntensity; }
                        }
                        mat.needsUpdate = true;
                    }
                });
            }
        });
    }

    selectObject(object) {
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isFloor || this.selectedObject.userData.isWidget || this.selectedObject.userData.isMolding || this.selectedObject.userData.isRoof || this.selectedObject.userData.isPattern || this.selectedObject.userData.isStair || this.selectedObject.userData.isFloorCutProxy)) {
            this.setHighlight(this.selectedObject, false);
        }
        if (this.transformControls) this.transformControls.detach();
        if (this.wallHighlight.parent) this.wallHighlight.parent.remove(this.wallHighlight);

        this.selectedObject = object;
        let type = null, side = null;

        // SOLID OCP: Delegate to the centralized Selection Manager
        const result = this.selectionManager.select(object);
        if (result) {
            type = result.type;
            side = result.side;
        }

        if (type && this.ctx.onEntitySelect) this.ctx.onEntitySelect(object.userData.entity, type, side);
        if (window.plannerInstance && object.userData.entity) {
            window.plannerInstance.selectEntity(object.userData.entity, type);
        }
    }

    deselect() {
        this.cancelRelocation();
        if (this.transformControls) this.transformControls.detach();
        if (this.openingGizmo) this.openingGizmo.detach();
        if (this.materialGizmo) this.materialGizmo.detach();
        if (this.cornerGizmo) this.cornerGizmo.detach();
        if (this.vertexSlopeGizmo) this.vertexSlopeGizmo.detach();
        if (this.roofCornerGizmo) this.roofCornerGizmo.detach();
        if (this.polygonGizmo) this.polygonGizmo.detach();
        this.ctx.currentTransformMode = 'none';
        if (this.ctx.showTransformMenu) this.ctx.showTransformMenu(false);
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isFloor || this.selectedObject.userData.isWidget || this.selectedObject.userData.isMolding || this.selectedObject.userData.isRoof || this.selectedObject.userData.isPattern || this.selectedObject.userData.isStair || this.selectedObject.userData.isFloorCutProxy)) this.setHighlight(this.selectedObject, false);
        if (this.wallHighlight.parent) this.wallHighlight.parent.remove(this.wallHighlight);
        this.selectedObject = null;
        if (this.ctx.onEntitySelect) this.ctx.onEntitySelect(null, null, null);
        if (window.plannerInstance) {
            window.plannerInstance.selectEntity(null, null);
        }
    }
}

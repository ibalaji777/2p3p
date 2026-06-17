import * as THREE from 'three';
import { WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT } from '../registry.js';
import { TransformControls } from './TransformControls.js';

export class InteractionSystem {
    constructor(camera, renderer, scene, structureGroup, interactables, callbacks) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.structureGroup = structureGroup;
        this.interactables = interactables;
        this.callbacks = callbacks; // Expected: onLevelSwitchRequest, onEntitySelect, onRelocateStateChange, syncToUI, updateWallDecorLive
        
        this.mode = 'edit';
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.dragOffset = new THREE.Vector3();
        this.selectedObject = null;
        this.isPlacing = false;
        this.viewMode3D = 'full-edit';

        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
        this.wallHighlight = new THREE.Mesh(geo, mat);
        this.wallHighlight.visible = false;

        this.dropGroup = new THREE.Group();
        this.dropHighlight = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
        this.dropHighlight.rotation.x = -Math.PI / 2;
        this.dropGroup.add(this.dropHighlight);
        this.dropGroup.visible = false;
        this.scene.add(this.dropGroup);

        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.addEventListener('dragstart', () => {
            if (this.camera && this.camera.parent === null) { if (this.callbacks.onRelocateStateChange) this.callbacks.onRelocateStateChange(true); } // Dummy trigger to lock Orbit controls via external hook if passed
            if (this.callbacks.onTransformStart) this.callbacks.onTransformStart();
        });
        this.transformControls.addEventListener('change', () => {
            if (this.callbacks.syncToUI) this.callbacks.syncToUI();
        });
        this.transformControls.addEventListener('dragend', () => {
            if (this.callbacks.onRelocateStateChange) this.callbacks.onRelocateStateChange(false);
        });
        this.transformControls.visible = false;
        this.scene.add(this.transformControls);

        this.initEvents();
    }

    setViewMode3D(mode) {
        this.viewMode3D = mode;
    }

    setMode(mode) {
        this.mode = mode;
        this.cancelRelocation();
        this.deselect();
    }

    updateMouse(e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    initEvents() {
        const dom = this.renderer.domElement;
        
        dom.addEventListener('contextmenu', e => e.preventDefault());
        dom.addEventListener('pointerdown', (e) => {
            if (this.viewMode3D === 'preview') return;
            if (this.transformControls.active) return;

            if (this.mode === 'camera' || e.button !== 0) return;
            this.updateMouse(e);
            
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.interactables, true);
            
            if (intersects.length > 0) {
                let mesh = intersects[0].object;

                // Floor Level Switching
                if (mesh.userData.isFloorTrigger) {
                    if (this.viewMode3D === 'full-edit') return; 
                    if (this.callbacks.onLevelSwitchRequest) {
                        this.callbacks.onLevelSwitchRequest(
                            mesh.userData.levelIndex, 
                            mesh.userData.entityIndex, 
                            mesh.userData.entityType
                        );
                    }
                    return;
                }

                while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor && !mesh.userData.isRoom && !mesh.userData.isRoof && !mesh.userData.isWidget && !mesh.userData.isPattern && !mesh.userData.isStair && !(mesh.userData.entity && mesh.userData.entity.type && mesh.userData.entity.type.startsWith('stair_v4'))) mesh = mesh.parent;

                if (mesh && (mesh.userData.isFurniture || mesh.userData.isWallSide || mesh.userData.isWallDecor || mesh.userData.isRoom || mesh.userData.isRoof || mesh.userData.isWidget || mesh.userData.isPattern || mesh.userData.isStair || (mesh.userData.entity && mesh.userData.entity.type && mesh.userData.entity.type.startsWith('stair_v4')))) {
                    if (this.mode === 'edit') {
                        this.selectObject(mesh);
                        if (mesh.userData.isWallDecor) {
                            const wallNormal = new THREE.Vector3(0,0,1).applyEuler(mesh.parent.rotation);
                            this.dragPlane.setFromNormalAndCoplanarPoint(wallNormal, mesh.getWorldPosition(new THREE.Vector3()));
                            this.isPlacing = true;
                            dom.style.cursor = 'grabbing';
                            const target = new THREE.Vector3();
                            if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) this.dragOffset.copy(mesh.position).sub(mesh.parent.worldToLocal(target));
                        }
                    }
                }
            } else this.deselect();
        });

        dom.addEventListener('pointermove', (e) => {
            if (this.viewMode3D === 'preview') return;
            if (this.mode === 'camera') return;
            this.updateMouse(e);

            // Real-time drag positioning
            if (this.mode === 'edit' && this.isPlacing && this.selectedObject && (this.selectedObject.userData.isWidget || this.selectedObject.userData.isPattern)) {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    const wallGroup = this.selectedObject.parent;
                    const localTarget = wallGroup.worldToLocal(target.clone()).add(this.dragOffset);
                    const entity = this.selectedObject.userData.entity, wallData = wallGroup.userData.entity;
                    let visualLocalX = entity.side === 'back' ? wallData.length3D - localTarget.x : localTarget.x;
                    const wallHeight = wallData.config?.height || wallData.height || WALL_HEIGHT;

                    entity.localX = Math.max(-10, Math.min((visualLocalX / wallData.length3D) * 100, 110));
                    entity.localY = Math.max(-10, Math.min((localTarget.y / wallHeight) * 100, 110));                    if (this.callbacks.updateWallDecorLive) this.callbacks.updateWallDecorLive(entity);
                    if (this.callbacks.syncToUI) this.callbacks.syncToUI();
                }
            } else {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const intersects = this.raycaster.intersectObjects(this.interactables, true);
                if (intersects.length > 0) {
                    dom.style.cursor = 'pointer';
                    let mesh = intersects[0].object;
                    while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor && !mesh.userData.isRoom && !mesh.userData.isRoof && !mesh.userData.isWidget && !mesh.userData.isPattern && !mesh.userData.isStair && !(mesh.userData.entity && mesh.userData.entity.type && mesh.userData.entity.type.startsWith('stair_v4'))) mesh = mesh.parent;
                    if (this.hoveredObject !== mesh) {
                        if (this.hoveredObject && this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget || this.hoveredObject.userData.isPattern || this.hoveredObject.userData.isStair || (this.hoveredObject.userData.entity && this.hoveredObject.userData.entity.type && this.hoveredObject.userData.entity.type.startsWith('stair_v4')))) {
                            if (!this.hoveredObject.userData.isRoom) this.setHighlight(this.hoveredObject, false);
                        }
                        this.hoveredObject = mesh;
                        if (this.hoveredObject && this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget || this.hoveredObject.userData.isPattern || this.hoveredObject.userData.isStair || (this.hoveredObject.userData.entity && this.hoveredObject.userData.entity.type && this.hoveredObject.userData.entity.type.startsWith('stair_v4')))) {
                            if (!this.hoveredObject.userData.isRoom) this.setHighlight(this.hoveredObject, true, 0x93c5fd);
                        }
                    }
                } else {
                    dom.style.cursor = 'auto';
                    if (this.hoveredObject) {
                        if (this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget || this.hoveredObject.userData.isPattern || this.hoveredObject.userData.isStair || (this.hoveredObject.userData.entity && this.hoveredObject.userData.entity.type && this.hoveredObject.userData.entity.type.startsWith('stair_v4')))) {
                            if (!this.hoveredObject.userData.isRoom) this.setHighlight(this.hoveredObject, false);
                        }
                        this.hoveredObject = null;
                    }
                }
            }
        });

        dom.addEventListener('dblclick', (e) => {
            if (this.viewMode3D === 'preview') return;
            if (this.mode === 'camera') return;
            if (this.mode === 'edit' && this.selectedObject && (this.selectedObject.userData.isWidget || this.selectedObject.userData.isPattern)) {
                const mesh = this.selectedObject;
                const entity = mesh.userData.entity;
                if (!entity.wall) return;
                const wallNormal = new THREE.Vector3(0,0,1).applyEuler(mesh.rotation);
                this.dragPlane.setFromNormalAndCoplanarPoint(wallNormal, mesh.getWorldPosition(new THREE.Vector3()));
                this.isPlacing = true;
                dom.style.cursor = 'grabbing';
                const target = new THREE.Vector3();
                this.raycaster.setFromCamera(this.mouse, this.camera);
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) this.dragOffset.copy(mesh.position).sub(target);
            }
        });

        window.addEventListener('pointerup', () => {
            if (this.isPlacing && this.selectedObject && (this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isWidget || this.selectedObject.userData.isPattern)) {
                this.isPlacing = false;
                dom.style.cursor = 'pointer';
            }
        });
    }

    setRelocationState(active) {
        this.isPlacing = active;
        this.dropGroup.visible = false;
        
        if (this.callbacks.onRelocateStateChange) this.callbacks.onRelocateStateChange(active);
    }

    cancelRelocation() {
        if (this.isPlacing) this.setRelocationState(false);
        this.isPlacing = false;
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
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isRoof || this.selectedObject.userData.isRoom || this.selectedObject.userData.isWidget || this.selectedObject.userData.isPattern || this.selectedObject.userData.isStair || (this.selectedObject.userData.entity && this.selectedObject.userData.entity.type && this.selectedObject.userData.entity.type.startsWith('stair_v4')))) {
            if (!this.selectedObject.userData.isRoom) this.setHighlight(this.selectedObject, false);
        }
        this.transformControls.detach();
        if (this.wallHighlight.parent) this.wallHighlight.parent.remove(this.wallHighlight);

        this.selectedObject = object;
        let type = null, side = null;

        if (object.userData.isWallSide) {
            type = 'wall'; side = object.userData.side;
            const wallGroup = object.parent;
            const w = wallGroup.userData.entity;
            wallGroup.add(this.wallHighlight);
            
            let maxDepth = 0;
            if (w.attachedDecor) w.attachedDecor.forEach(d => { if (d.side === side && d.depth > maxDepth) maxDepth = d.depth; });
            const hlWidth = w.length3D + (maxDepth * 2) + 0.5;
            const wallHeight = w.config?.height || w.height || WALL_HEIGHT;
            const hlHeight = wallHeight + 0.5;

            const shape = new THREE.Shape();
            shape.moveTo(-hlWidth/2, -hlHeight/2); shape.lineTo(hlWidth/2, -hlHeight/2); shape.lineTo(hlWidth/2, hlHeight/2); shape.lineTo(-hlWidth/2, hlHeight/2); shape.lineTo(-hlWidth/2, -hlHeight/2);

            w.attachedWidgets.forEach(widg => {
                const wCenter = w.length3D * widg.t; const halfW = widg.width / 2; const cx = w.length3D / 2; const cy = wallHeight / 2;
                const hx_min = (wCenter - halfW) - cx; const hx_max = (wCenter + halfW) - cx;
            const type = widg.type || widg.configId;
            let elev = widg.elevation; if (elev === undefined) elev = (type === 'window') ? WINDOW_SILL : 0;
            let h_opening = widg.height; if (h_opening === undefined) h_opening = (type === 'door') ? DOOR_HEIGHT : ((type === 'window') ? WINDOW_HEIGHT : 200);
            elev = Math.max(0, Math.min(elev, wallHeight));
            h_opening = Math.max(0, Math.min(h_opening, wallHeight - elev));
            const hy_min = elev - cy; const hy_max = (elev + h_opening) - cy;

                const hole = new THREE.Path();
                hole.moveTo(hx_min, hy_min); hole.lineTo(hx_max, hy_min); hole.lineTo(hx_max, hy_max); hole.lineTo(hx_min, hy_max); hole.lineTo(hx_min, hy_min);
                shape.holes.push(hole);
            });

            this.wallHighlight.geometry.dispose();
            this.wallHighlight.geometry = new THREE.ShapeGeometry(shape);
            this.wallHighlight.scale.set(1, 1, 1);

            const wallThickness = w.thickness || w.config?.thickness || 20;
            const zOffset = side === 'front' ? (wallThickness / 2 + maxDepth + 0.15) : (-wallThickness / 2 - maxDepth - 0.15);
            this.wallHighlight.position.set(w.length3D / 2, wallHeight / 2, zOffset);
            this.wallHighlight.rotation.set(0, 0, 0); 
            this.wallHighlight.visible = true;
        } 
        else if (object.userData.isFurniture || object.userData.isWallDecor || object.userData.isRoof || object.userData.isRoom || object.userData.isWidget || object.userData.isPattern || object.userData.isStair || (object.userData.entity && object.userData.entity.type && object.userData.entity.type.startsWith('stair_v4'))) {
            type = object.userData.isShape ? 'shape' : (object.userData.isFurniture ? 'furniture' : (object.userData.isRoof ? 'roof' : (object.userData.isRoom ? 'room' : (object.userData.isWidget ? 'widget' : (object.userData.isPattern ? 'advance_openings' : (object.userData.isStair || (object.userData.entity && object.userData.entity.type && object.userData.entity.type.startsWith('stair_v4')) ? 'stair' : 'wallDecor'))))));
            if (!object.userData.isRoom) this.setHighlight(object, true);
            if (type === 'furniture' || type === 'shape' || type === 'stair') {
                this.transformControls.attach(object);
            }
        }
        if (type && this.callbacks.onEntitySelect) this.callbacks.onEntitySelect(object.userData.entity, type, side);
        if (window.plannerInstance && object.userData.entity) {
            window.plannerInstance.selectEntity(object.userData.entity, type);
        }
    }

    deselect() {
        this.cancelRelocation();
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isRoof || this.selectedObject.userData.isRoom || this.selectedObject.userData.isWidget || this.selectedObject.userData.isPattern || this.selectedObject.userData.isStair || (this.selectedObject.userData.entity && this.selectedObject.userData.entity.type && this.selectedObject.userData.entity.type.startsWith('stair_v4')))) {
            if (!this.selectedObject.userData.isRoom) this.setHighlight(this.selectedObject, false);
        }
        this.transformControls.detach();
        if (this.wallHighlight.parent) this.wallHighlight.parent.remove(this.wallHighlight);
        this.selectedObject = null;
        if (this.callbacks.onEntitySelect) this.callbacks.onEntitySelect(null, null, null);
        if (window.plannerInstance) {
            window.plannerInstance.selectEntity(null, null);
        }
    }
}
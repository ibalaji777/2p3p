import * as THREE from 'three';
import { WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT } from '../registry.js';

export class InteractionSystem {
    constructor(camera, renderer, scene, structureGroup, interactables, callbacks) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.structureGroup = structureGroup;
        this.interactables = interactables;
        this.callbacks = callbacks; // Expected: onLevelSwitchRequest, onEntitySelect, onRelocateStateChange, syncToUI, updateWallDecorLive
        
        this.mode = 'adjust';
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
        
        dom.addEventListener('pointerdown', (e) => {
            if (this.viewMode3D === 'preview') return;
            if (this.mode === 'camera' || e.button !== 0) return;
            this.updateMouse(e);
            
            // Drop placement for Furniture
            if (this.mode === 'adjust' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isFurniture) {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    this.selectedObject.position.set(target.x, 0, target.z);
                    this.setRelocationState(false);
                    if (this.callbacks.syncToUI) this.callbacks.syncToUI();
                }
                return;
            }

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

                while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor && !mesh.userData.isRoom && !mesh.userData.isRoof && !mesh.userData.isWidget) mesh = mesh.parent;

                if (mesh && (mesh.userData.isFurniture || mesh.userData.isWallSide || mesh.userData.isWallDecor || mesh.userData.isRoom || mesh.userData.isRoof || mesh.userData.isWidget)) {
                    if (this.mode === 'edit') {
                        if (mesh.userData.isWallDecor) {
                            const side = mesh.userData.entity.side;
                            let targetSkin = null;
                            mesh.userData.parentWall.mesh3D.children.forEach(c => { if (c.userData.isWallSide && c.userData.side === side) targetSkin = c; });
                            if (targetSkin) this.selectObject(targetSkin);
                        } else this.selectObject(mesh);
                    } else if (this.mode === 'adjust') {
                        if (this.selectedObject === mesh && mesh.userData.isFurniture) {
                            this.setRelocationState(true);
                            this.dragPlane.set(new THREE.Vector3(0, 1, 0), -this.structureGroup.position.y); 
                        } else {
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
                }
            } else this.deselect();
        });

        dom.addEventListener('pointermove', (e) => {
            if (this.viewMode3D === 'preview') return;
            if (this.mode === 'camera') return;
            this.updateMouse(e);

            // Real-time drag positioning
            if (this.mode === 'adjust' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isFurniture) {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) this.dropGroup.position.set(target.x, this.structureGroup.position.y + 0.5, target.z);
            } 
            else if (this.mode === 'adjust' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isWallDecor) {
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
                    while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor && !mesh.userData.isRoom && !mesh.userData.isRoof && !mesh.userData.isWidget) mesh = mesh.parent;
                    if (this.hoveredObject !== mesh) {
                        if (this.hoveredObject && this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget)) this.setHighlight(this.hoveredObject, false);
                        this.hoveredObject = mesh;
                        if (this.hoveredObject && this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget)) this.setHighlight(this.hoveredObject, true, 0x93c5fd);
                    }
                } else {
                    dom.style.cursor = 'auto';
                    if (this.hoveredObject) {
                        if (this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget)) this.setHighlight(this.hoveredObject, false);
                        this.hoveredObject = null;
                    }
                }
            }
        });

        dom.addEventListener('dblclick', (e) => {
            if (this.viewMode3D === 'preview') return;
            if (this.mode === 'camera') return;
            if (this.mode === 'adjust' && this.selectedObject && this.selectedObject.userData.isWidget) {
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
            if (this.isPlacing && this.selectedObject && (this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isWidget)) {
                this.isPlacing = false;
                dom.style.cursor = 'pointer';
            }
        });
    }

    setRelocationState(active) {
        this.isPlacing = active;
        if (active && this.selectedObject && this.selectedObject.userData.isFurniture) {
            const entity = this.selectedObject.userData.entity;
            this.dropHighlight.scale.set(entity.width, entity.depth, 1);
            this.dropGroup.rotation.y = this.selectedObject.rotation.y;
            this.dropGroup.position.set(this.selectedObject.position.x, this.structureGroup.position.y + 0.5, this.selectedObject.position.z);
            this.dropGroup.visible = true;
        } else this.dropGroup.visible = false;
        
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
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isRoof || this.selectedObject.userData.isRoom || this.selectedObject.userData.isWidget)) this.setHighlight(this.selectedObject, false);
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
                const hy_min = (widg.type === 'door' ? 0 : WINDOW_SILL) - cy; const hy_max = (widg.type === 'door' ? DOOR_HEIGHT : WINDOW_SILL + WINDOW_HEIGHT) - cy;

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
        else if (object.userData.isFurniture || object.userData.isWallDecor || object.userData.isRoof || object.userData.isRoom || object.userData.isWidget) {
            type = object.userData.isFurniture ? 'furniture' : (object.userData.isRoof ? 'roof' : (object.userData.isRoom ? 'room' : (object.userData.isWidget ? 'widget' : 'wallDecor')));
            this.setHighlight(object, true);
        }
        if (type && this.callbacks.onEntitySelect) this.callbacks.onEntitySelect(object.userData.entity, type, side);
    }

    deselect() {
        this.cancelRelocation();
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isRoof || this.selectedObject.userData.isRoom || this.selectedObject.userData.isWidget)) this.setHighlight(this.selectedObject, false);
        if (this.wallHighlight.parent) this.wallHighlight.parent.remove(this.wallHighlight);
        this.selectedObject = null;
        if (this.callbacks.onEntitySelect) this.callbacks.onEntitySelect(null, null, null);
    }
}
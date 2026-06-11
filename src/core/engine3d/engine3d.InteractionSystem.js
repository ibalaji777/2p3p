import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { TransformControls } from './TransformControls.js';

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
            if (!this.visible || this.ctx.currentTransformMode !== 'opening') return;
            if (e.button !== 0) return;
            this.updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, false);
            if (intersects.length > 0) {
                this.activeHandle = intersects[0].object.name;
                if (this.ctx.controls) this.ctx.controls.enabled = false;
                
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
                e.stopImmediatePropagation();
            }
        });
        
        dom.addEventListener('pointermove', (e) => {
            if (!this.visible || this.ctx.currentTransformMode !== 'opening') return;
            this.updateMouse(e);
            
            if (!this.activeHandle) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const intersects = this.raycaster.intersectObjects(this.handles.children, false);
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
        });
        
        dom.addEventListener('pointerup', () => {
            if (this.activeHandle) {
                this.activeHandle = null;
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                const event = new CustomEvent('opening-gizmo-end', { detail: { entity: this.target.userData.entity }});
                window.dispatchEvent(event);
            }
        });
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
        this.handles.children.forEach(c => c.scale.set(1, 1, 1));
    }

    updateHandles() {
        if (!this.target || !this.target.userData.entity) return;
        const entity = this.target.userData.entity;
        
        const w = entity.width || 100;
        let h = entity.height;
        if (h === undefined) h = (entity.type === 'door') ? 80 : ((entity.type === 'window') ? 45 : 200);
        const d = entity.depth || entity.wall?.thickness || 20;
        
        this.position.copy(this.target.getWorldPosition(new THREE.Vector3()));
        this.quaternion.copy(this.target.getWorldQuaternion(new THREE.Quaternion()));

        this.hLeft.position.set(-w/2, h/2, 0);
        this.hRight.position.set(w/2, h/2, 0);
        this.hTop.position.set(0, h, 0);
        this.hBottom.position.set(0, 0, 0);
        this.hFront.position.set(0, h/2, d/2);
        this.hBack.position.set(0, h/2, -d/2);
        this.hCenter.position.set(0, h/2, 0);
        
        this.renderOrder = 999;
    }
}

export class InteractionSystem {
    constructor(ctx) {
        this.ctx = ctx;
        this.mode = 'edit';
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.dragOffset = new THREE.Vector3();
        this.selectedObject = null;
        this.isPlacing = false;
        
        this.tapCount = 0;
        this.lastTapTime = 0;
        this.tapTimeout = null;

        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
        this.wallHighlight = new THREE.Mesh(geo, mat);
        this.wallHighlight.visible = false;

        this.dropGroup = new THREE.Group();
        this.dropHighlight = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
        this.dropHighlight.rotation.x = -Math.PI / 2;
        this.dropGroup.add(this.dropHighlight);
        this.dropGroup.visible = false;
        this.ctx.scene.add(this.dropGroup);

        this.transformControls = new TransformControls(this.ctx.camera, this.ctx.renderer.domElement);
        this.transformControls.addEventListener('dragstart', () => {
            if (this.ctx.controls) this.ctx.controls.enabled = false;
        });
        this.transformControls.addEventListener('change', () => {
            if (this.ctx.syncToUI) this.ctx.syncToUI();
        });
        this.transformControls.addEventListener('dragend', () => {
            if (this.ctx.controls) this.ctx.controls.enabled = true;
        });
        this.transformControls.visible = false;
        this.ctx.scene.add(this.transformControls);

        this.openingGizmo = new OpeningGizmo(ctx);
        this.ctx.scene.add(this.openingGizmo);

        this.transformControls.addEventListener('change', () => {
            const obj = this.selectedObject;
            if (this.ctx.currentTransformMode === 'translate' && obj && obj.userData.isStair && obj.userData.entity && !obj.userData.entity.connectedFrom) {
                const entity = obj.userData.entity;
                const planner = entity.planner || (window.plannerInstance ? window.plannerInstance.planner : null);
                if (planner) {
                    for (let s of planner.stairs) {
                        if (s === entity || (s.type !== 'stair' && s.type !== 'stair_landing')) continue;
                        const isAncestor = (node, pAnc) => { let curr = node; while(curr) { if (curr.id === pAnc.id) return true; curr = planner.stairs.find(x => x.id === curr.connectedFrom); } return false; };
                        if (isAncestor(s, entity)) continue;
                        if (s.type === 'stair') {
                            if (Math.hypot(obj.position.x - (s.endX||0), obj.position.z - (s.endY||0)) < 30) {
                                obj.position.x = s.endX; obj.position.z = s.endY; break;
                            }
                        } else if (s.type === 'stair_landing') {
                            const sRot = s.absRot || 0;
                            const cos = Math.cos(-sRot), sin = Math.sin(-sRot);
                            const dx = obj.position.x - (s.absX||0), dy = obj.position.z - (s.absY||0);
                            const lx = dx * cos - dy * sin;
                            const ly = dx * sin + dy * cos;
                            const w = s.width || 100, l = s.length || 100;
                            const dTop = Math.abs(ly - l), dBot = Math.abs(ly), dL = Math.abs(lx - (-w/2)), dR = Math.abs(lx - (w/2));
                            const minD = Math.min(dTop, dBot, dL, dR);
                            if (minD < 30 && lx > -w/2 - 20 && lx < w/2 + 20 && ly > -20 && ly < l + 20) {
                                let sx=0, sy=0;
                                if (minD === dTop) { sx = lx; sy = l; }
                                else if (minD === dBot) { sx = lx; sy = 0; }
                                else if (minD === dL) { sx = -w/2; sy = ly; }
                                else { sx = w/2; sy = ly; }
                                const rCos = Math.cos(sRot), rSin = Math.sin(sRot);
                                obj.position.x = (s.absX||0) + sx * rCos + sy * rSin;
                                obj.position.z = (s.absY||0) - sx * rSin + sy * rCos;
                                break;
                            }
                        }
                    }
                }
            }
            if (this.ctx.syncToUI) this.ctx.syncToUI();
        });

        this.transformControls.addEventListener('dragend', () => {
            const obj = this.selectedObject;
            if (this.ctx.currentTransformMode === 'translate' && obj && obj.userData.isStair && obj.userData.entity && !obj.userData.entity.connectedFrom) {
                const entity = obj.userData.entity;
                const planner = entity.planner || (window.plannerInstance ? window.plannerInstance.planner : null);
                if (planner) {
                    for (let s of planner.stairs) {
                        if (s === entity || (s.type !== 'stair' && s.type !== 'stair_landing')) continue;
                        const isAncestor = (node, pAnc) => { let curr = node; while(curr) { if (curr.id === pAnc.id) return true; curr = planner.stairs.find(x => x.id === curr.connectedFrom); } return false; };
                        if (isAncestor(s, entity)) continue;
                        if (s.type === 'stair') {
                            if (Math.hypot(obj.position.x - (s.endX||0), obj.position.z - (s.endY||0)) < 5) {
                                entity.connectedFrom = s.id;
                                entity.attachEdge = 'top'; entity.attachOffsetX = 0; entity.attachOffsetY = 0;
                                entity.rotationOffset = entity.rotation - ((s.absRot || 0) * 180 / Math.PI);
                                entity.systemId = s.systemId;
                                entity.x = undefined; entity.y = undefined;
                                if (entity.group) entity.group.draggable(false);
                                const updateSystemId = (node, sysId) => { node.systemId = sysId; const children = planner.stairs.filter(c => c.connectedFrom === node.id); children.forEach(c => updateSystemId(c, sysId)); }; updateSystemId(entity, s.systemId);
                                planner.syncAll();
                                if (this.ctx.stairSystemManager) this.ctx.stairSystemManager.updatePanel(entity);
                                break;
                            }
                        } else if (s.type === 'stair_landing') {
                            const sRot = s.absRot || 0;
                            const cos = Math.cos(-sRot), sin = Math.sin(-sRot);
                            const dx = obj.position.x - (s.absX||0), dy = obj.position.z - (s.absY||0);
                            const lx = dx * cos - dy * sin;
                            const ly = dx * sin + dy * cos;
                            const w = s.width || 100, l = s.length || 100;
                            const dTop = Math.abs(ly - l), dBot = Math.abs(ly), dL = Math.abs(lx - (-w/2)), dR = Math.abs(lx - (w/2));
                            const minD = Math.min(dTop, dBot, dL, dR);
                            if (minD < 5 && lx > -w/2 - 20 && lx < w/2 + 20 && ly > -20 && ly < l + 20) {
                                entity.connectedFrom = s.id;
                                entity.systemId = s.systemId;
                                if (minD === dTop) { entity.attachEdge = 'top'; entity.attachOffsetX = lx; entity.rotationOffset = 0; }
                                else if (minD === dBot) { entity.attachEdge = 'bottom'; entity.attachOffsetX = lx; entity.rotationOffset = 180; }
                                else if (minD === dL) { entity.attachEdge = 'left'; entity.attachOffsetY = ly - l/2; entity.rotationOffset = -90; }
                                else { entity.attachEdge = 'right'; entity.attachOffsetY = ly - l/2; entity.rotationOffset = 90; }
                                entity.x = undefined; entity.y = undefined;
                                if (entity.group) entity.group.draggable(false);
                                const updateSystemId = (node, sysId) => { node.systemId = sysId; const children = planner.stairs.filter(c => c.connectedFrom === node.id); children.forEach(c => updateSystemId(c, sysId)); }; updateSystemId(entity, s.systemId);
                                planner.syncAll();
                                if (this.ctx.stairSystemManager) this.ctx.stairSystemManager.updatePanel(entity);
                                break;
                            }
                        }
                    }
                }
            }
            if (this.ctx.controls) this.ctx.controls.enabled = true;
        });

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
                // If clicking directly on a transform axis gizmo, allow it
                if (this.transformControls && this.transformControls.axis !== null) return;
                
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const intersects = this.raycaster.intersectObjects(this.ctx.interactables, true);
                if (intersects.length === 0) {
                    this.ctx.setTransformMode('none', true);
                    this.deselect();
                }
                return;
            }

            if (this.mode === 'edit' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isFurniture) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    this.selectedObject.position.set(target.x, 0, target.z);
                    this.setRelocationState(false);
                    this.ctx.syncToUI();
                    if (this.ctx.controls) this.ctx.controls.enabled = true;
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

                while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor && !mesh.userData.isFloor && !mesh.userData.isWidget && !mesh.userData.isPattern && !mesh.userData.isStair && !(mesh.userData.entity && (mesh.userData.entity.type === 'stair' || mesh.userData.entity.type === 'stair_landing'))) mesh = mesh.parent;
                
                if (mesh && (mesh.userData.isFurniture || mesh.userData.isWallSide || mesh.userData.isWallDecor || mesh.userData.isFloor || mesh.userData.isWidget || mesh.userData.isPattern || mesh.userData.isStair || (mesh.userData.entity && (mesh.userData.entity.type === 'stair' || mesh.userData.entity.type === 'stair_landing')))) {
                    if (this.mode === 'edit') {
                        if (this.selectedObject === mesh && mesh.userData.isFurniture) {
                            this.setRelocationState(true);
                            this.dragPlane.set(new THREE.Vector3(0, 1, 0), -this.ctx.structureGroup.position.y); 
                            if (this.ctx.controls) this.ctx.controls.enabled = false;
                        } else if (this.selectedObject === mesh && mesh.userData.isWallDecor) {
                                const wallNormal = new THREE.Vector3(0,0,1).applyEuler(mesh.parent.rotation);
                                this.dragPlane.setFromNormalAndCoplanarPoint(wallNormal, mesh.getWorldPosition(new THREE.Vector3()));
                                this.isPlacing = true;
                                dom.style.cursor = 'grabbing';
                                const target = new THREE.Vector3();
                                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) this.dragOffset.copy(mesh.position).sub(mesh.parent.worldToLocal(target));
                                if (this.ctx.controls) this.ctx.controls.enabled = false;
                        } else {
                            this.selectObject(mesh);
                        }
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

            if (this.mode === 'edit' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isFurniture) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) this.dropGroup.position.set(target.x, this.ctx.structureGroup.position.y + 0.5, target.z);
            } 
            else if (this.mode === 'edit' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isWallDecor) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    const wallGroup = this.selectedObject.parent;
                    const localTarget = wallGroup.worldToLocal(target.clone()).add(this.dragOffset);
                    const entity = this.selectedObject.userData.entity, wallData = wallGroup.userData.entity;
                    let visualLocalX = entity.side === 'back' ? wallData.length3D - localTarget.x : localTarget.x;
                    
                    const wallH = wallData.height || wallData.config?.height || WALL_HEIGHT;
                    
                    entity.localX = Math.max(-10, Math.min((visualLocalX / wallData.length3D) * 100, 110));
                    entity.localY = Math.max(-10, Math.min((localTarget.y / wallH) * 100, 110));
                    this.ctx.decorManager.updateLive(entity);
                    this.ctx.syncToUI();
                }
            } else if (this.mode === 'edit' && this.isPlacing && this.selectedObject && (this.selectedObject.userData.isWidget || this.selectedObject.userData.isPattern)) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    target.add(this.dragOffset);
                    const entity = this.selectedObject.userData.entity;
                    const wall = entity.wall || (entity.parentWall ? entity.parentWall : null);
                    if (wall) {
                        const p1 = wall.startAnchor ? wall.startAnchor.position() : {x: wall.startX, y: wall.startY};
                        const p2 = wall.endAnchor ? wall.endAnchor.position() : {x: wall.endX, y: wall.endY};
                        const C = p2.x - p1.x, D = p2.y - p1.y;
                        const lenSq = C * C + D * D;
                        if (lenSq !== 0) {
                            const param = Math.max(0.01, Math.min(0.99, ((target.x - p1.x) * C + (target.z - p1.y) * D) / lenSq));
                            entity.t = param;
                            if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
                            else if (this.ctx.syncToUI) this.ctx.syncToUI();
                        }
                    }
                }
            } else {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const intersects = this.raycaster.intersectObjects(this.ctx.interactables, true);
                if (intersects.length > 0) {
                    dom.style.cursor = 'pointer';
                    let mesh = intersects[0].object;
                    while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor && !mesh.userData.isRoom && !mesh.userData.isRoof && !mesh.userData.isWidget && !mesh.userData.isPattern) mesh = mesh.parent;
                    if (this.hoveredObject !== mesh) {
                        if (this.hoveredObject && this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget || this.hoveredObject.userData.isPattern)) this.setHighlight(this.hoveredObject, false);
                        this.hoveredObject = mesh;
                        if (this.hoveredObject && this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget || this.hoveredObject.userData.isPattern)) this.setHighlight(this.hoveredObject, true, 0x93c5fd);
                    }
                } else {
                    dom.style.cursor = 'auto';
                    if (this.hoveredObject) {
                        if (this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget || this.hoveredObject.userData.isPattern)) this.setHighlight(this.hoveredObject, false);
                        this.hoveredObject = null;
                    }
                }
            }
        });

        dom.addEventListener('dblclick', (e) => {
            if (this.ctx.viewMode3D === 'preview') return;
            if (this.transformControls && this.transformControls.active) return;
            if (this.mode === 'camera') return;
            if (this.mode === 'edit' && this.selectedObject && (this.selectedObject.userData.isWidget || this.selectedObject.userData.isPattern)) {
                const mesh = this.selectedObject;
                const wallGroup = mesh.parent; // sceneGroup in builder? Wait, in ActiveFloor: "WIDGET_REGISTRY[type].render3D(this.ctx.structureGroup...)"
                // But double clicking simply changes mode to drag along wall
                const entity = mesh.userData.entity;
                if (!entity.wall) return;
                const wallNormal = new THREE.Vector3(0,0,1).applyEuler(mesh.rotation);
                this.dragPlane.setFromNormalAndCoplanarPoint(wallNormal, mesh.getWorldPosition(new THREE.Vector3()));
                this.isPlacing = true;
                dom.style.cursor = 'grabbing';
                if (this.ctx.controls) this.ctx.controls.enabled = false;
                const target = new THREE.Vector3();
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) this.dragOffset.copy(mesh.position).sub(target);
            }
        });

        window.addEventListener('pointerup', () => {
            if (this.isPlacing && this.selectedObject && (this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isWidget || this.selectedObject.userData.isPattern)) {
                this.isPlacing = false;
                dom.style.cursor = 'pointer';
                if (this.ctx && this.ctx.controls) this.ctx.controls.enabled = true;
            }
        });
    }

    setRelocationState(active) {
        this.isPlacing = active;
        if (active && this.selectedObject && this.selectedObject.userData.isFurniture) {
            const entity = this.selectedObject.userData.entity;
            this.dropHighlight.scale.set(entity.width, entity.depth, 1);
            this.dropGroup.rotation.y = this.selectedObject.rotation.y;
            this.dropGroup.position.set(this.selectedObject.position.x, this.ctx.structureGroup.position.y + 0.5, this.selectedObject.position.z);
            this.dropGroup.visible = true;
        } else this.dropGroup.visible = false;
        if (this.ctx.onRelocateStateChange) this.ctx.onRelocateStateChange(active);
    }

    cancelRelocation() {
        if (this.isPlacing) this.setRelocationState(false);
        this.isPlacing = false;
        if (this.ctx && this.ctx.controls) this.ctx.controls.enabled = true;
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
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isFloor || this.selectedObject.userData.isWidget || this.selectedObject.userData.isPattern)) this.setHighlight(this.selectedObject, false);
        if (this.transformControls) this.transformControls.detach();
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
            
            const isRailing = w.type === 'railing';
            let currentH = w.height !== undefined ? w.height : (w.config?.height || (isRailing ? 0 : WALL_HEIGHT));
            
            if (isRailing && this.ctx.planner) {
                const p1 = w.startAnchor ? w.startAnchor.position() : {x: w.startX, y: w.startY};
                const p2 = w.endAnchor ? w.endAnchor.position() : {x: w.endX, y: w.endY};
                const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
            let foundSupport = false;
                for (let sw of this.ctx.planner.walls) {
                    if (sw.type === 'railing') continue;
                    const sp1 = sw.startAnchor ? sw.startAnchor.position() : {x: sw.startX, y: sw.startY};
                    const sp2 = sw.endAnchor ? sw.endAnchor.position() : {x: sw.endX, y: sw.endY};
                    const C = sp2.x - sp1.x, D = sp2.y - sp1.y;
                    const lenSq = C * C + D * D;
                    if (lenSq !== 0) {
                        const param = Math.max(0, Math.min(1, ((midX - sp1.x)*C + (midY - sp1.y)*D)/lenSq));
                        if (Math.hypot(midX - (sp1.x + param*C), midY - (sp1.y + param*D)) < 5) {
                            currentH = sw.height !== undefined ? sw.height : (sw.config?.height || WALL_HEIGHT);
                        foundSupport = true;
                            break;
                        }
                    }
                }

            if (!foundSupport && this.ctx.planner.shapes) {
                for (let s of this.ctx.planner.shapes) {
                    if (s.type !== 'shape_rect' && s.type !== 'shape_polygon') continue;
                    let pts = []; 
                    if (s.type === 'shape_rect') { 
                        const sw = s.params.width; const sh = s.params.height; 
                        pts = [ {x: -sw/2, y: -sh/2}, {x: sw/2, y: -sh/2}, {x: sw/2, y: sh/2}, {x: -sw/2, y: sh/2} ]; 
                    } else { 
                        pts = s.params.points; 
                    }
                    if (!pts || !s.group) continue;

                    const transform = s.group.getTransform();
                    for (let i = 0; i < pts.length; i++) {
                        const sp1 = transform.point(pts[i]); 
                        const sp2 = transform.point(pts[(i + 1) % pts.length]);
                        const C = sp2.x - sp1.x, D = sp2.y - sp1.y;
                        const lenSq = C * C + D * D;
                        if (lenSq !== 0) {
                            const param = Math.max(0, Math.min(1, ((midX - sp1.x) * C + (midY - sp1.y) * D) / lenSq));
                            if (Math.hypot(midX - (sp1.x + param*C), midY - (sp1.y + param*D)) < 5) {
                                currentH = s.params.height3D !== undefined ? s.params.height3D : 100;
                                foundSupport = true;
                                break;
                            }
                        }
                    }
                    if (foundSupport) break;
                }
            }
            }

            const currentT = w.thickness !== undefined ? w.thickness : (w.config?.thickness || (isRailing ? 4 : 8));
            const totalH = isRailing ? currentH + 40 : currentH;
            
            const hlWidth = w.length3D + (maxDepth * 2) + 0.5;
            const hlHeight = totalH + 0.5;

            const shape = new THREE.Shape();
            shape.moveTo(-hlWidth/2, -hlHeight/2); shape.lineTo(hlWidth/2, -hlHeight/2); shape.lineTo(hlWidth/2, hlHeight/2); shape.lineTo(-hlWidth/2, hlHeight/2); shape.lineTo(-hlWidth/2, -hlHeight/2);

            w.attachedWidgets.forEach(widg => {
                const wCenter = w.length3D * widg.t; const halfW = widg.width / 2; const cx = w.length3D / 2; const cy = totalH / 2;
                const hx_min = (wCenter - halfW) - cx; const hx_max = (wCenter + halfW) - cx;
                
                let elev = widg.elevation; if (elev === undefined) elev = (widg.type === 'window') ? 35 : 0;
                let h_opening = widg.height; if (h_opening === undefined) h_opening = (widg.type === 'door') ? 80 : ((widg.type === 'window') ? 45 : 200);
                elev = Math.max(0, Math.min(elev, currentH));
                h_opening = Math.max(0, Math.min(h_opening, currentH - elev));
                const w_y_min = elev; const w_y_max = elev + h_opening;

                if (w_y_max > w_y_min) {
                    const hy_min = w_y_min - cy; const hy_max = w_y_max - cy;
                    const type = widg.type || widg.configId;
                    const hole = new THREE.Path();
                    const hCenter = wCenter - cx;
                    
                    if (type === 'arch_opening') {
                        const radius = halfW;
                        const straightH = Math.max(0, (hy_max - hy_min) - radius);
                        hole.moveTo(hx_min, hy_min);
                        hole.lineTo(hx_max, hy_min);
                        hole.lineTo(hx_max, hy_min + straightH);
                        if (radius > 0) hole.absarc(hCenter, hy_min + straightH, radius, 0, Math.PI, false);
                        hole.lineTo(hx_min, hy_min);
                        shape.holes.push(hole);
                    } else if (type === 'circular_opening') {
                        hole.moveTo(hx_max, hy_min + (hy_max - hy_min)/2);
                        hole.absellipse(hCenter, hy_min + (hy_max - hy_min)/2, halfW, (hy_max - hy_min)/2, 0, Math.PI * 2, false, 0);
                        shape.holes.push(hole);
                    } else if (type === 'custom_shape_opening') {
                        hole.moveTo(hCenter, hy_min);
                        hole.lineTo(hx_max, hy_min + (hy_max - hy_min)/2);
                        hole.lineTo(hCenter, hy_max);
                        hole.lineTo(hx_min, hy_min + (hy_max - hy_min)/2);
                        hole.lineTo(hCenter, hy_min);
                        shape.holes.push(hole);
                    } else {
                        hole.moveTo(hx_min, hy_min); hole.lineTo(hx_max, hy_min); hole.lineTo(hx_max, hy_max); hole.lineTo(hx_min, hy_max); hole.lineTo(hx_min, hy_min);
                        shape.holes.push(hole);
                    }
                }
            });

            this.wallHighlight.geometry.dispose();
            this.wallHighlight.geometry = new THREE.ShapeGeometry(shape);
            this.wallHighlight.scale.set(1, 1, 1);

            const zOffset = side === 'front' ? (currentT / 2 + maxDepth + 0.15) : (-currentT / 2 - maxDepth - 0.15);
            
            // ====== MITER JOINT SHEARING FOR HIGHLIGHT ======
            const pts = (w.poly && typeof w.poly.points === 'function') ? w.poly.points() : w.pts;
            if (pts && pts.length === 8 && !isRailing) {
                const p1 = w.startAnchor ? w.startAnchor.position() : {x: w.startX, y: w.startY};
                const p2 = w.endAnchor ? w.endAnchor.position() : {x: w.endX, y: w.endY};
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                
                const toLocalX = (ptX, ptY) => {
                    const dx_pt = ptX - p1.x;
                    const dy_pt = ptY - p1.y;
                    return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
                };
                const localSL_x = toLocalX(pts[0], pts[1]);
                const localEL_x = toLocalX(pts[2], pts[3]);
                const localER_x = toLocalX(pts[4], pts[5]);
                const localSR_x = toLocalX(pts[6], pts[7]);
                
                const pos = this.wallHighlight.geometry.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const vx = pos.getX(i);
                    const wallX = (w.length3D / 2) + vx; 
                    const tZ = (zOffset + currentT/2) / currentT;
                    const startX = localSR_x + tZ * (localSL_x - localSR_x);
                    const endX = localER_x + tZ * (localEL_x - localER_x);
                    const tX = wallX / w.length3D;
                    const shearedWallX = startX + tX * (endX - startX);
                    pos.setX(i, shearedWallX - w.length3D / 2);
                }
                this.wallHighlight.geometry.computeVertexNormals();
                this.wallHighlight.geometry.computeBoundingBox();
                this.wallHighlight.geometry.computeBoundingSphere();
            }
            
            if (isRailing) {
                const p1 = w.startAnchor ? w.startAnchor.position() : {x: w.startX, y: w.startY};
                const p2 = w.endAnchor ? w.endAnchor.position() : {x: w.endX, y: w.endY};
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                
                this.wallHighlight.position.set(p1.x, totalH / 2, p1.y);
                this.wallHighlight.rotation.set(0, -angle, 0);
                this.wallHighlight.translateX(w.length3D / 2);
                this.wallHighlight.translateZ(zOffset);
            } else {
                this.wallHighlight.position.set(w.length3D / 2, totalH / 2, zOffset);
                this.wallHighlight.rotation.set(0, 0, 0); 
            }
            this.wallHighlight.visible = true;
        } 
        else if (object.userData.isFurniture || object.userData.isWallDecor || object.userData.isFloor || object.userData.isWidget || object.userData.isPattern || object.userData.isStair || (object.userData.entity && (object.userData.entity.type === 'stair' || object.userData.entity.type === 'stair_landing'))) {
            if (object.userData.isShape) type = 'shape';
            else if (object.userData.isFurniture) type = 'furniture';
            else if (object.userData.isWallDecor) type = 'wallDecor';
            else if (object.userData.isFloor) type = 'room';
            else if (object.userData.isWidget) type = 'widget';
            else if (object.userData.isPattern) type = 'advance_openings';
            else if (object.userData.isStair || (object.userData.entity && (object.userData.entity.type === 'stair' || object.userData.entity.type === 'stair_landing'))) type = 'stair';
            this.setHighlight(object, true);
                
            if (type === 'furniture' || type === 'shape') {
                if (this.transformControls) {
                    this.transformControls.attach(object);
                    if (this.ctx.showTransformMenu) this.ctx.showTransformMenu(true);
                }
            } else if (type === 'widget' || type === 'advance_openings' || type === 'stair') {
                if (this.ctx.showTransformMenu) this.ctx.showTransformMenu(true);
                if (type === 'stair' && this.ctx.setTransformMode) {
                    this.ctx.setTransformMode('stair');
                }
            } else {
                if (this.ctx.showTransformMenu) this.ctx.showTransformMenu(false);
            }
            
            if (type === 'stair') {
                if (this.tapTimeout) clearTimeout(this.tapTimeout);
                this.tapTimeout = setTimeout(() => {
                    if (this.ctx.stairSystemManager) {
                        if (this.tapCount === 1) this.ctx.stairSystemManager.setSelectionScope('flight');
                        else if (this.tapCount === 2) this.ctx.stairSystemManager.setSelectionScope('connected');
                        else if (this.tapCount >= 3) this.ctx.stairSystemManager.setSelectionScope('system');
                    }
                    this.tapCount = 0;
                }, 350);
            }
            
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
        if (this.ctx.showTransformMenu) this.ctx.showTransformMenu(false);
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isFloor || this.selectedObject.userData.isWidget || this.selectedObject.userData.isPattern)) this.setHighlight(this.selectedObject, false);
        if (this.transformControls) this.transformControls.detach();
        if (this.wallHighlight.parent) this.wallHighlight.parent.remove(this.wallHighlight);
        this.selectedObject = null;
        if (this.ctx.onEntitySelect) this.ctx.onEntitySelect(null, null, null);
        if (window.plannerInstance) {
            window.plannerInstance.selectEntity(null, null);
        }
    }
}

import { EVENTS } from '../registry.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { TransformControls } from './TransformControls.js';
import { MaterialGizmo } from './MaterialGizmo.js';
import { CornerRadiusGizmo } from './CornerRadiusGizmo.js';
import { VertexSlopeGizmo } from '../../features/roof/VertexSlopeGizmo.js';
import { RoofCornerGizmo } from '../../features/roof/RoofCornerGizmo.js';
import { RoofOverhangGizmo } from '../../features/roof/RoofOverhangGizmo.js';
import { RoofPitchCurvatureGizmo } from '../../features/roof/RoofPitchCurvatureGizmo.js';
import { PolygonGizmo } from './PolygonGizmo.js';
import { UniversalSpinGizmo } from './UniversalSpinGizmo.js';
import { WallPushPullGizmo } from './WallPushPullGizmo.js';
import { WallInteractiveSuite } from './WallInteractiveSuite.js';
import { Wall3DDrawSystem } from './Wall3DDrawSystem.js';
import { Shape3DDrawSystem } from './Shape3DDrawSystem.js';
import { WallPlugin3DPlacementSystem } from './WallPlugin3DPlacementSystem.js';
import { Stair3DPlacementSystem } from './Stair3DPlacementSystem.js';
import { Furniture3DPlacementSystem } from './Furniture3DPlacementSystem.js';
import { Roof3DPlacementSystem } from './Roof3DPlacementSystem.js';
import { RoofPlugin3DPlacementSystem } from './RoofPlugin3DPlacementSystem.js';
import { SelectionManager } from './SelectionManager.js';
import { HighlightRenderer } from './HighlightRenderer.js';
import { DimensionManager3D } from './dimensions/DimensionManager3D.js';
import { CommonInteractionController } from './tools/CommonInteractionController.js';
import { COMMON_TOOLS } from './tools/CommonToolRegistry.js';
import { useSettingsStore } from '../../stores/useSettingsStore.js';
import { usePlannerStore } from '../../stores/usePlannerStore.js';
import { coreEventBus } from '../EventBus.js';

import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, GLASS_REGISTRY } from '../../core/registry';

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
        
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        
        const dom = this.ctx.renderer.domElement;
        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
        dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
    }
    
    _onPointerDown(e) {
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
    }
    

    _onPointerMove(e) {
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
                    this.ctx.renderer.domElement.style.cursor = 'pointer';
                } else {
                    this.ctx.renderer.domElement.style.cursor = 'auto';
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
                    
                    if (this.ctx.realtimeUpdate) {
                        this.ctx.realtimeUpdate.markDirty(entity, 'geometry');
                    }
                    
                    this.updateHandles();
                    if (this.ctx.updateOpeningPanel) this.ctx.updateOpeningPanel(entity);
                    
                    if (typeof window !== 'undefined') {
                        // Notify UI panel
                        coreEventBus.emit(EVENTS.OPENING_GIZMO_CHANGE, { entity });
                        // Update Store for reactive syncing
                        const store = usePlannerStore();
                        store.updateEntityTransform(entity.id || entity, entity.x, entity.y, entity.rotation, entity.elevation);
                    }
                }
            }
    }
    
    _onPointerUp(e) {
            if (this.activeHandle) {
                e.preventDefault();
                e.stopPropagation();
                
                const entity = this.target.userData.entity;
                this.activeHandle = null;
                if (typeof window !== 'undefined') {
                    coreEventBus.emit(EVENTS.OPENING_GIZMO_END, { entity });
                    if (window.plannerInstance) window.plannerInstance.syncAll();
                }
            }
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

    dispose() {
        const dom = this.ctx.renderer.domElement;
        dom.removeEventListener('pointerdown', this._onPointerDown);
        dom.removeEventListener('pointermove', this._onPointerMove);
        dom.removeEventListener('pointerup', this._onPointerUp);
        
        this.handles.children.forEach(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        if (this.parent) this.parent.remove(this);
    }
}

export class InteractionSystem {
    constructor(ctx) {
        this.ctx = ctx;
        this.highlightRenderer = new HighlightRenderer(this.ctx);
        this.selectionManager = new SelectionManager(this.ctx, this);
        this.dimensionManager = new DimensionManager3D(this.ctx);
        this.mode = 'edit';
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedObject = null;
        
        this.tapCount = 0;
        this.lastTapTime = 0;
        this.tapTimeout = null;

        this.wallHighlight = this.highlightRenderer.wallSelectionMesh;
        this.wallHoverHighlight = this.highlightRenderer.wallHoverMesh;

        // Sims 4 Direct Move & Footprint System (Zero Obtrusive Arrows)
        this.sims4FloorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this._tempFloorHit = new THREE.Vector3();
        this._grabOffset = new THREE.Vector3();
        this._pointerDownScreenPos = new THREE.Vector2();
        this._dragStartPos = new THREE.Vector3();
        this.isPotentialSims4Drag = false;
        this.isSims4Dragging = false;
        this.isPotentialSims4Spin = false;
        this.isSims4Spinning = false;
        this._spinPointerDownPos = new THREE.Vector2();
        this._spinStartAngle = 0;

        this.sims4FootprintMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 2.5,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.sims4Footprint = new THREE.LineSegments(new THREE.BufferGeometry(), this.sims4FootprintMat);
        this.sims4Footprint.renderOrder = 1008;
        this.sims4Footprint.raycast = () => {};
        this.sims4Footprint.visible = false;
        this.ctx.scene.add(this.sims4Footprint);

        this.commonController = new CommonInteractionController(this.ctx);
        this.ctx.commonTools = this.commonController;

        this.transformControls = new TransformControls(this.ctx.camera, this.ctx.renderer.domElement);
        this._syncUI = () => { 
            if (this.selectedObject && this.selectedObject.userData && this.selectedObject.userData.entity) {
                const ent = this.selectedObject.userData.entity;
                ent.x = this.selectedObject.position.x;
                ent.y = this.selectedObject.position.z;
                if (ent.group && typeof ent.group.x === 'function') {
                    ent.group.x(ent.x);
                    ent.group.y(ent.y);
                }
                if (typeof ent.update2D === 'function') ent.update2D();
                
                if (this.ctx.realtimeUpdate) {
                    if (ent.wall) {
                        this.ctx.realtimeUpdate.markDirty(ent, 'geometry');
                    } else {
                        this.ctx.realtimeUpdate.markDirty(ent, 'transform');
                    }
                }
            }
            if (this.ctx.syncToUI) this.ctx.syncToUI(); 
        };
        
        this.drag3DStartPos = null;
        this.drag3DStartRot = null;

        this._onMoveStart = (e) => {
            if (e.object && e.object.userData && e.object.userData.entity) {
                const ent = e.object.userData.entity;
                const posX = ent.x !== undefined ? ent.x : (ent.group ? ent.group.x() : e.object.position.x);
                const posY = ent.y !== undefined ? ent.y : (ent.group ? ent.group.y() : e.object.position.z);
                this.drag3DStartPos = { x: posX, y: posY };
            }
        };

        this._onMoveEnd = (e) => {
            if (e.object && e.object.userData && e.object.userData.entity && this.drag3DStartPos) {
                const ent = e.object.userData.entity;
                const id = ent.id || (ent.group && typeof ent.group.id === 'function' ? ent.group.id() : null);
                const endX = e.object.position.x;
                const endY = e.object.position.z;
                
                if (Math.abs(endX - this.drag3DStartPos.x) > 0.001 || Math.abs(endY - this.drag3DStartPos.y) > 0.001) {
                    const plannerInst = window.planner?.value || window.planner;
                    if (plannerInst && typeof plannerInst.move === 'function' && id) {
                        plannerInst.move(id, endX, endY);
                    } else if (ent) {
                        ent.x = endX;
                        ent.y = endY;
                        if (ent.group && typeof ent.group.x === 'function') {
                            ent.group.x(endX);
                            ent.group.y(endY);
                        }
                    }
                }
                this.drag3DStartPos = null;
            }
        };

        this._onRotateStart = (e) => {
            if (e.object && e.object.userData && e.object.userData.entity) {
                this.drag3DStartRot = e.object.rotation.y;
            }
        };

        this._onRotateEnd = (e) => {
            if (e.object && e.object.userData && e.object.userData.entity && this.drag3DStartRot !== null) {
                const ent = e.object.userData.entity;
                const id = ent.id || (ent.group && typeof ent.group.id === 'function' ? ent.group.id() : null);
                const endRotRad = e.object.rotation.y;
                
                if (Math.abs(endRotRad - this.drag3DStartRot) > 0.001) {
                    const endRotDegrees = -(endRotRad * 180 / Math.PI);
                    const plannerInst = window.planner?.value || window.planner;
                    if (plannerInst && typeof plannerInst.rotate === 'function' && id) {
                        plannerInst.rotate(id, endRotDegrees);
                    } else if (ent) {
                        ent.rotation = endRotDegrees;
                        if (ent.group && typeof ent.group.rotation === 'function') {
                            ent.group.rotation(endRotDegrees);
                        }
                    }
                }
                this.drag3DStartRot = null;
            }
        };

        this.transformControls.addEventListener('move-start', this._onMoveStart);
        this.transformControls.addEventListener('move-end', this._onMoveEnd);
        this.transformControls.addEventListener('rotate-start', this._onRotateStart);
        this.transformControls.addEventListener('rotate-end', this._onRotateEnd);
        this.transformControls.addEventListener('move-change', this._syncUI);
        this.transformControls.addEventListener('scale-change', this._syncUI);
        this.transformControls.addEventListener('spin-change', this._syncUI);
        this.transformControls.addEventListener('tilt-change', this._syncUI);
        this.transformControls.addEventListener('rotate-change', this._syncUI);
        this.transformControls.addEventListener('dragging-changed', (event) => {
            if (this.ctx.renderCoordinator) {
                if (event.value) this.ctx.renderCoordinator.startContinuousRender('transform_controls');
                else this.ctx.renderCoordinator.stopContinuousRender('transform_controls');
            }
        });
        this.transformControls.addEventListener('change', () => {
            if (this.ctx.renderCoordinator) this.ctx.renderCoordinator.notifyChange('transform_controls_change', 2);
            if (this.dimensionManager) this.dimensionManager.update();
        });
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

        this.roofPitchGizmo = new RoofPitchCurvatureGizmo(ctx);
        this.ctx.scene.add(this.roofPitchGizmo);

        this.polygonGizmo = new PolygonGizmo(ctx);
        this.ctx.scene.add(this.polygonGizmo);

        this.universalSpinGizmo = new UniversalSpinGizmo(ctx);
        this.ctx.scene.add(this.universalSpinGizmo);

        this.wallInteractiveSuite = new WallInteractiveSuite(ctx);
        this.ctx.scene.add(this.wallInteractiveSuite);

        this.wallPushPullGizmo = new WallPushPullGizmo(ctx);
        this.ctx.scene.add(this.wallPushPullGizmo);

        this.wall3DDrawSystem = new Wall3DDrawSystem(ctx, this);
        this.shape3DDrawSystem = new Shape3DDrawSystem(ctx, this);
        this.wallPluginPlacementSystem = new WallPlugin3DPlacementSystem(ctx, this);
        this.stairPlacementSystem = new Stair3DPlacementSystem(ctx, this);
        this.furniturePlacementSystem = new Furniture3DPlacementSystem(ctx, this);
        this.roofPlacementSystem = new Roof3DPlacementSystem(ctx, this);
        this.roofPluginPlacementSystem = new RoofPlugin3DPlacementSystem(ctx, this);

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

    _updateSims4Footprint(object) {
        if (!object) {
            this.sims4Footprint.visible = false;
            return;
        }
        object.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(object);
        if (box.isEmpty() || !isFinite(box.min.x)) {
            this.sims4Footprint.visible = false;
            return;
        }

        const minX = box.min.x;
        const maxX = box.max.x;
        const minZ = box.min.z;
        const maxZ = box.max.z;
        const groundY = Math.max(0, box.min.y) + 0.5;

        const w = maxX - minX;
        const d = maxZ - minZ;
        const tick = Math.min(w * 0.2, d * 0.2, 8);

        const points = [
            // Outer rectangle
            new THREE.Vector3(minX, groundY, minZ), new THREE.Vector3(maxX, groundY, minZ),
            new THREE.Vector3(maxX, groundY, minZ), new THREE.Vector3(maxX, groundY, maxZ),
            new THREE.Vector3(maxX, groundY, maxZ), new THREE.Vector3(minX, groundY, maxZ),
            new THREE.Vector3(minX, groundY, maxZ), new THREE.Vector3(minX, groundY, minZ),

            // Top-left corner tick
            new THREE.Vector3(minX + tick, groundY, minZ), new THREE.Vector3(minX + tick, groundY, minZ + tick),
            new THREE.Vector3(minX, groundY, minZ + tick), new THREE.Vector3(minX + tick, groundY, minZ + tick),

            // Top-right corner tick
            new THREE.Vector3(maxX - tick, groundY, minZ), new THREE.Vector3(maxX - tick, groundY, minZ + tick),
            new THREE.Vector3(maxX, groundY, minZ + tick), new THREE.Vector3(maxX - tick, groundY, minZ + tick),

            // Bottom-right corner tick
            new THREE.Vector3(maxX - tick, groundY, maxZ), new THREE.Vector3(maxX - tick, groundY, maxZ - tick),
            new THREE.Vector3(maxX, groundY, maxZ - tick), new THREE.Vector3(maxX - tick, groundY, maxZ - tick),

            // Bottom-left corner tick
            new THREE.Vector3(minX + tick, groundY, maxZ), new THREE.Vector3(minX + tick, groundY, maxZ - tick),
            new THREE.Vector3(minX, groundY, maxZ - tick), new THREE.Vector3(minX + tick, groundY, maxZ - tick)
        ];

        if (this.sims4Footprint.geometry) this.sims4Footprint.geometry.dispose();
        this.sims4Footprint.geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.sims4Footprint.position.set(0, 0, 0);
        this.sims4Footprint.rotation.set(0, 0, 0);
        this.sims4Footprint.scale.set(1, 1, 1);
        this.sims4Footprint.visible = true;
    }

    rotateSelectedObjectSims4(deltaDeg = 45) {
        if (!this.selectedObject) return;
        const ent = this.selectedObject.userData?.entity;
        if (ent && this.commonController) {
            this.commonController.transformEngine.executeSpin(ent, deltaDeg);
            if (this.selectedObject) {
                this._updateSims4Footprint(this.selectedObject);
                if (this.highlightRenderer) this.highlightRenderer.setSelectionHighlight(this.selectedObject);
                this.setHighlight(this.selectedObject, true);
            }
        }
    }

    initEvents() {
        const dom = this.ctx.renderer.domElement;
        
        this._onPointerDown = (e) => {
            if (this.ctx.viewMode3D === 'preview') return;
            this.updateMouse(e);

            // Direct 3D Wall / Room Drawing System
            if (this.wall3DDrawSystem && this.wall3DDrawSystem.isWallDrawingTool()) {
                if (this.wall3DDrawSystem.onPointerDown(e)) return;
            }

            // Direct 3D Shape & Floor Cut Drawing System
            if (this.shape3DDrawSystem && this.shape3DDrawSystem.isShapeDrawingTool()) {
                if (this.shape3DDrawSystem.onPointerDown(e)) return;
            }

            // Direct 3D Door / Window / Wall Plugin Placement System
            if (this.wallPluginPlacementSystem && this.wallPluginPlacementSystem.isPlacementTool()) {
                if (this.wallPluginPlacementSystem.onPointerDown(e)) return;
            }

            // Direct 3D Staircase Placement System
            if (this.stairPlacementSystem && this.stairPlacementSystem.isPlacementTool()) {
                if (this.stairPlacementSystem.onPointerDown(e)) return;
            }

            // Direct 3D Furniture / Kitchen / Bathroom / Sanitary / Model Placement System
            if (this.furniturePlacementSystem && this.furniturePlacementSystem.isPlacementTool()) {
                if (this.furniturePlacementSystem.onPointerDown(e)) return;
            }

            // Direct 3D Roof Glass Addon & Sculpture Placement System
            if (this.roofPluginPlacementSystem && this.roofPluginPlacementSystem.isPlacementTool()) {
                if (this.roofPluginPlacementSystem.onPointerDown(e)) return;
            }

            // Direct 3D Roof Placement & Drawing System
            if (this.roofPlacementSystem && this.roofPlacementSystem.isPlacementTool()) {
                if (this.roofPlacementSystem.onPointerDown(e)) return;
            }

            if (this.mode === 'camera') return;

            // Universal Material Face Painting Tool
            if (this.commonController?.activeTool === COMMON_TOOLS.MATERIAL) {
                this.commonController.paintSystem.onPointerDown(e);
                return;
            }

            if (this.transformControls && this.transformControls.active) return;
            if (e.button !== 0) return;

            // Direct check for interactive Universal Spin Gizmo handles
            if (this.universalSpinGizmo && this.universalSpinGizmo.visible) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                if (this.raycaster.intersectObjects(this.universalSpinGizmo.handles.children, true).length > 0) {
                    return;
                }
            }

            // Direct check for interactive Roof Gizmo handles
            if (this.roofPitchGizmo && this.roofPitchGizmo.visible) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                if (this.raycaster.intersectObjects(this.roofPitchGizmo.handles.children, true).length > 0) {
                    return;
                }
            }

            // Direct check for interactive Wall Gizmo handles (Push/Pull, Corners, Height, Extrude Bay/Niche)
            if (this.wallInteractiveSuite) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                if (this.wallInteractiveSuite.pushPullGizmo && this.wallInteractiveSuite.pushPullGizmo.visible) {
                    if (this.raycaster.intersectObjects(this.wallInteractiveSuite.pushPullGizmo.handles.children, true).length > 0) return;
                }
                if (this.wallInteractiveSuite.cornerGizmo && this.wallInteractiveSuite.cornerGizmo.visible) {
                    if (this.raycaster.intersectObjects(this.wallInteractiveSuite.cornerGizmo.handles.children, true).length > 0) return;
                }
                if (this.wallInteractiveSuite.heightGizmo && this.wallInteractiveSuite.heightGizmo.visible) {
                    if (this.raycaster.intersectObjects(this.wallInteractiveSuite.heightGizmo.handles.children, true).length > 0) return;
                }
                if (this.wallInteractiveSuite.extrudeGroup && this.wallInteractiveSuite.extrudeGroup.visible) {
                    const handleObjects = [
                        this.wallInteractiveSuite.extrudeHandle,
                        this.wallInteractiveSuite.extrudeStartHandle,
                        this.wallInteractiveSuite.extrudeEndHandle
                    ];
                    if (this.raycaster.intersectObjects(handleObjects, true).length > 0) return;
                }
                if (this.wallInteractiveSuite.activeMode && this.wallInteractiveSuite.activeMode !== 'menu' && this.wallInteractiveSuite.activeMode !== 'neutral') {
                    // Prevent deselecting active wall when clicking around during editing
                    const wallObj = this.wallInteractiveSuite.target;
                    if (wallObj && this.raycaster.intersectObject(wallObj, true).length > 0) return;
                }
            }
            
            const now = Date.now();
            if (now - this.lastTapTime < 350) {
                this.tapCount++;
            } else {
                this.tapCount = 1;
            }
            this.lastTapTime = now;
            
            // If currently in a specialized sub-gizmo mode (not Sims 4 move/translate), check gizmo handle raycasts
            if (this.ctx.currentTransformMode && this.ctx.currentTransformMode !== 'none' && this.ctx.currentTransformMode !== 'translate' && this.ctx.currentTransformMode !== 'move') {
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
                if (this.wallPushPullGizmo && this.wallPushPullGizmo.visible) {
                    if (this.raycaster.intersectObjects(this.wallPushPullGizmo.handles.children, true).length > 0) return;
                }
                return;
            }

            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.ctx.interactables, true);
            if (intersects.length > 0) {
                let mesh = intersects[0].object;

                if (mesh.userData.isFloorTrigger) {
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

                while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor && !mesh.userData.isFloor && !mesh.userData.isWidget && !mesh.userData.isMolding && !mesh.userData.isRoof && !mesh.userData.isPattern && !mesh.userData.isStair && !mesh.userData.isFloorCutProxy && !mesh.userData.isRoofAddon && !mesh.userData.isRoofSculpture && !mesh.userData.isSkylight) mesh = mesh.parent;
                
                // Fallback: If clicked submesh belongs to an entity (like staircase, furniture, roof), resolve to ent.mesh3D
                const targetEntity = mesh.userData?.entity || mesh.parent?.userData?.entity;
                if (targetEntity && targetEntity.mesh3D) {
                    mesh = targetEntity.mesh3D;
                }

                if (mesh && (mesh.userData.isFurniture || mesh.userData.isWallSide || mesh.userData.isWallDecor || mesh.userData.isFloor || mesh.userData.isWidget || mesh.userData.isMolding || mesh.userData.isRoof || mesh.userData.isPattern || mesh.userData.isStair || mesh.userData.isFloorCutProxy || mesh.userData.isRoofAddon || mesh.userData.isRoofSculpture || mesh.userData.isSkylight)) {
                    if (this.mode === 'edit') {
                        if (mesh.userData.isWallDecor) {
                            const decor = mesh.userData.entity;
                            const wall = mesh.userData.parentWall || mesh.parent?.userData?.entity;
                            const side = decor?.side || mesh.userData.side || 'front';
                            if (wall && wall.mesh3D) {
                                const wallSideMesh = wall.mesh3D.children.find(c => c.userData.isWallSide && c.userData.side === side);
                                if (wallSideMesh) {
                                    if (this.materialGizmo && decor && decor.id) {
                                        this.materialGizmo.activeDecorId = decor.id;
                                    }
                                    this.selectObject(wallSideMesh, intersects[0]);
                                    return;
                                }
                            }
                        }
                        this.selectObject(mesh, intersects[0]);

                        // Direct Sims 4 Move: Grab object, disable OrbitControls, show footprint & highlight immediately
                        const ent = mesh.userData?.entity;
                        const caps = this.commonController?.getCapabilities(ent, mesh) || { movable: false };
                        if (caps.movable) {
                            this.isPotentialSims4Drag = true;
                            this._pointerDownScreenPos.set(e.clientX, e.clientY);
                            this._dragStartPos.copy(mesh.position);
                            this._dragStartRot = mesh.rotation.y;
                            
                            // Prevent OrbitControls from rotating camera when dragging directly on an object!
                            if (this.ctx.controls) this.ctx.controls.enabled = false;

                            // Display tactile floor footprint & selection highlight on mouse down
                            this._updateSims4Footprint(mesh);
                            if (this.highlightRenderer) this.highlightRenderer.setSelectionHighlight(mesh);
                            this.setHighlight(mesh, true, 0x00f0ff);

                            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                            if (this.raycaster.ray.intersectPlane(this.sims4FloorPlane, this._tempFloorHit)) {
                                this._grabOffset.subVectors(this._tempFloorHit, mesh.position);
                            } else {
                                this._grabOffset.set(0, 0, 0);
                            }
                        }
                    }
                }
            } else {
                this.deselect();
                this.isPotentialSims4Drag = false;
                this.isSims4Dragging = false;
                this.sims4Footprint.visible = false;
                if (this.ctx.controls) this.ctx.controls.enabled = true;
            }
        };

        this._onPointerMove = (e) => {
            if (this.ctx.viewMode3D === 'preview') return;
            this.updateMouse(e);

            // Direct 3D Wall / Room Drawing System
            if (this.wall3DDrawSystem && this.wall3DDrawSystem.isWallDrawingTool()) {
                this.wall3DDrawSystem.onPointerMove(e);
                return;
            }

            // Direct 3D Shape & Floor Cut Drawing System
            if (this.shape3DDrawSystem && this.shape3DDrawSystem.isShapeDrawingTool()) {
                if (this.shape3DDrawSystem.onPointerMove(e)) return;
            }

            // Direct 3D Door / Window / Wall Plugin Placement System
            if (this.wallPluginPlacementSystem && this.wallPluginPlacementSystem.isPlacementTool()) {
                if (this.wallPluginPlacementSystem.onPointerMove(e)) return;
            }

            // Direct 3D Staircase Placement System
            if (this.stairPlacementSystem && this.stairPlacementSystem.isPlacementTool()) {
                if (this.stairPlacementSystem.onPointerMove(e)) return;
            }

            // Direct 3D Furniture / Kitchen / Bathroom / Sanitary / Model Placement System
            if (this.furniturePlacementSystem && this.furniturePlacementSystem.isPlacementTool()) {
                if (this.furniturePlacementSystem.onPointerMove(e)) return;
            }

            // Direct 3D Roof Glass Addon & Sculpture Placement System
            if (this.roofPluginPlacementSystem && this.roofPluginPlacementSystem.isPlacementTool()) {
                this.roofPluginPlacementSystem.onPointerMove(e);
                return;
            }

            // Direct 3D Roof Placement & Drawing System
            if (this.roofPlacementSystem && this.roofPlacementSystem.isPlacementTool()) {
                if (this.roofPlacementSystem.onPointerMove(e)) return;
            }

            if (this.mode === 'camera') return;

            // Universal Material Face Painting Tool
            if (this.commonController?.activeTool === COMMON_TOOLS.MATERIAL) {
                this.commonController.paintSystem.onPointerMove(e);
                return;
            }

            // Sims 4 Right-drag or [ Spin ] Tool Spin system
            if (this.isPotentialSims4Spin && this.selectedObject) {
                const dist = Math.hypot(e.clientX - this._spinPointerDownPos.x, e.clientY - this._spinPointerDownPos.y);
                if (dist > 3) {
                    this.isSims4Spinning = true;
                    if (this.ctx.controls) this.ctx.controls.enabled = false;
                    dom.style.cursor = 'ew-resize';
                }
            }

            if (this.isSims4Spinning && this.selectedObject) {
                const ent = this.selectedObject.userData?.entity;
                if (ent && this.commonController) {
                    const deltaX = e.clientX - this._spinPointerDownPos.x;
                    const deltaDeg = Math.round(deltaX * 0.75);
                    let targetAngle = this._spinStartAngle + deltaDeg;

                    // Snap to 15° increments unless Alt is held
                    if (!e.altKey) {
                        targetAngle = Math.round(targetAngle / 15) * 15;
                    }
                    targetAngle = ((targetAngle % 360) + 360) % 360;

                    this.commonController.transformEngine.executeSpin(ent, 0, targetAngle);
                    this._updateSims4Footprint(this.selectedObject);
                    if (this.highlightRenderer) this.highlightRenderer.setSelectionHighlight(this.selectedObject);
                    this.setHighlight(this.selectedObject, true, 0x00f0ff);
                    if (this.ctx.requestRender) this.ctx.requestRender('sims4_spinning');
                }
                return;
            }

            // Sims 4 Direct Move / Dragging System
            if (this.isPotentialSims4Drag && this.selectedObject) {
                const dist = Math.hypot(e.clientX - this._pointerDownScreenPos.x, e.clientY - this._pointerDownScreenPos.y);
                if (dist > 1 || this.commonController?.activeTool === COMMON_TOOLS.MOVE) {
                    this.isSims4Dragging = true;
                    if (this.ctx.controls) this.ctx.controls.enabled = false;
                    dom.style.cursor = 'grabbing';
                }
            }

            if (this.isSims4Dragging && this.selectedObject) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const ent = this.selectedObject.userData?.entity;

                // Maintain glowing highlight on the moving object
                if (this.highlightRenderer) this.highlightRenderer.setSelectionHighlight(this.selectedObject);
                this.setHighlight(this.selectedObject, true, 0x00f0ff);

                // 1. Wall Plugin / Opening Dragging along wall baseline
                if (ent?.wall && ent.wall.mesh3D) {
                    const wallMesh = ent.wall.mesh3D;
                    const intersects = this.raycaster.intersectObject(wallMesh, true);
                    if (intersects.length > 0) {
                        const hit = intersects[0];
                        const localHit = wallMesh.worldToLocal(hit.point.clone());
                        const wallLength = ent.wall.length3D || 100;
                        const newT = Math.max(0.05, Math.min(0.95, (localHit.x + wallLength / 2) / wallLength));
                        ent.t = newT;
                        if (this.ctx.realtimeUpdate) this.ctx.realtimeUpdate.markDirty(ent, 'geometry');
                        this._updateSims4Footprint(this.selectedObject);
                        this._syncUI();
                    }
                }
                // 2. Floor / Free Object Dragging
                else if (this.raycaster.ray.intersectPlane(this.sims4FloorPlane, this._tempFloorHit)) {
                    let newX = this._tempFloorHit.x - this._grabOffset.x;
                    let newZ = this._tempFloorHit.z - this._grabOffset.z;

                    // Snap to 10cm grid unless Alt is pressed
                    if (!e.altKey) {
                        newX = Math.round(newX / 10) * 10;
                        newZ = Math.round(newZ / 10) * 10;
                    }

                    this.selectedObject.position.x = newX;
                    this.selectedObject.position.z = newZ;

                    if (ent) {
                        ent.x = newX;
                        ent.y = newZ;
                        if (ent.group && typeof ent.group.x === 'function') {
                            ent.group.x(newX);
                            ent.group.y(newZ);
                        }
                        if (typeof ent.update2D === 'function') ent.update2D();
                        if (this.ctx.realtimeUpdate) this.ctx.realtimeUpdate.markDirty(ent, 'transform');
                    }

                    this._updateSims4Footprint(this.selectedObject);
                    this._syncUI();
                    if (this.ctx.requestRender) this.ctx.requestRender('sims4_dragging');
                }
                return;
            }

            if (this.transformControls && this.transformControls.active) return;
            
            if (this.ctx.currentTransformMode && this.ctx.currentTransformMode !== 'none' && this.ctx.currentTransformMode !== 'translate' && this.ctx.currentTransformMode !== 'move' && this.ctx.currentTransformMode !== 'rotateY' && this.ctx.currentTransformMode !== 'spin') {
                // Clear hover highlights while using transform gizmos
                if (this.hoveredObject && this.hoveredObject !== this.selectedObject) {
                    this.setHighlight(this.hoveredObject, false);
                    this.hoveredObject = null;
                }
                return;
            }

            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.ctx.interactables, true);
            const validIntersects = intersects.filter(i => i.object && !i.object.userData?.isHitbox && i.object.material && i.object.material.opacity !== 0);

            if (validIntersects.length > 0) {
                dom.style.cursor = 'pointer';
                const hitMesh = validIntersects[0].object;

                if (this.hoveredObject !== hitMesh) {
                    if (this.hoveredObject && this.hoveredObject !== this.selectedObject) {
                        this.setHighlight(this.hoveredObject, false);
                    }
                    this.hoveredObject = hitMesh;
                    if (this.hoveredObject && this.hoveredObject !== this.selectedObject) {
                        this.setHighlight(this.hoveredObject, true, 0x93c5fd);
                    }
                }
            } else {
                dom.style.cursor = 'auto';
                if (this.hoveredObject) {
                    if (this.hoveredObject !== this.selectedObject) {
                        this.setHighlight(this.hoveredObject, false);
                    }
                    this.hoveredObject = null;
                }
            }
        };

        this._onPointerUp = (e) => {
            if (this.ctx.viewMode3D === 'preview') return;

            // Universal Material Face Painting Tool
            if (this.commonController?.activeTool === COMMON_TOOLS.MATERIAL) {
                this.commonController.paintSystem.onPointerUp(e);
                return;
            }

            // Complete Sims 4 Spin / Right-Click Rotation
            if (this.isPotentialSims4Spin || this.isSims4Spinning) {
                if (e.button === 2 && !this.isSims4Spinning && this.selectedObject) {
                    // Single right-click tap: Step rotate 45 degrees
                    this.rotateSelectedObjectSims4(45);
                } else if (this.isSims4Spinning && this.selectedObject) {
                    // Finished dragging rotation: commit to planner history
                    const ent = this.selectedObject.userData?.entity;
                    const id = ent?.id || (ent?.group && typeof ent.group.id === 'function' ? ent.group.id() : null);
                    const plannerInst = window.planner?.value || window.planner;
                    if (plannerInst && typeof plannerInst.rotate === 'function' && id && ent) {
                        plannerInst.rotate(id, ent.rotation);
                    }
                    if (this.ctx.requestRender) this.ctx.requestRender('sims4_spin_end');
                }
                this.isPotentialSims4Spin = false;
                this.isSims4Spinning = false;
                if (this.ctx.controls) this.ctx.controls.enabled = (this.mode === 'camera');
                dom.style.cursor = 'auto';
                if (this.selectedObject) {
                    this._updateSims4Footprint(this.selectedObject);
                    if (this.highlightRenderer) this.highlightRenderer.setSelectionHighlight(this.selectedObject);
                    this.setHighlight(this.selectedObject, true, 0x00f0ff);
                }
            }

            // Complete Sims 4 Direct Drag
            if (this.isSims4Dragging || this.isPotentialSims4Drag) {
                if (this.ctx.controls) this.ctx.controls.enabled = (this.mode === 'camera' || !this.isSims4Dragging);
                dom.style.cursor = 'auto';

                if (this.isSims4Dragging && this.selectedObject && this._dragStartPos) {
                    const distMoved = this.selectedObject.position.distanceTo(this._dragStartPos);
                    if (distMoved > 0.1) {
                        const ent = this.selectedObject.userData?.entity;
                        const id = ent?.id || (ent?.group && typeof ent.group.id === 'function' ? ent.group.id() : null);
                        const plannerInst = window.planner?.value || window.planner;
                        if (plannerInst && typeof plannerInst.move === 'function' && id) {
                            plannerInst.move(id, this.selectedObject.position.x, this.selectedObject.position.z);
                        }
                        if (this.ctx.requestRender) this.ctx.requestRender('sims4_drag_end');
                    }
                }
                this.isSims4Dragging = false;
                this.isPotentialSims4Drag = false;
                if (this.selectedObject) {
                    this._updateSims4Footprint(this.selectedObject);
                    if (this.highlightRenderer) this.highlightRenderer.setSelectionHighlight(this.selectedObject);
                    this.setHighlight(this.selectedObject, true, 0x00f0ff);
                } else {
                    this.sims4Footprint.visible = false;
                }
            }

            if (this.wall3DDrawSystem && this.wall3DDrawSystem.isWallDrawingTool()) {
                if (this.wall3DDrawSystem.onPointerUp && this.wall3DDrawSystem.onPointerUp(e)) return;
            }
            if (this.shape3DDrawSystem && this.shape3DDrawSystem.isShapeDrawingTool()) {
                if (this.shape3DDrawSystem.onPointerUp && this.shape3DDrawSystem.onPointerUp(e)) return;
            }
            if (this.roofPluginPlacementSystem && this.roofPluginPlacementSystem.isPlacementTool()) {
                if (this.roofPluginPlacementSystem.onPointerUp && this.roofPluginPlacementSystem.onPointerUp(e)) return;
            }
            if (this.roofPlacementSystem && this.roofPlacementSystem.isPlacementTool()) {
                if (this.roofPlacementSystem.onPointerUp && this.roofPlacementSystem.onPointerUp(e)) return;
            }
        };

        // 2-Finger Touch Twist Rotation for Mobile & Tablets
        let isTouchTwisting = false;
        let initialTwistAngle = 0;
        let initialEntityAngle = 0;

        this._onTouchStart = (e) => {
            if (e.touches && e.touches.length === 2 && this.selectedObject) {
                const ent = this.selectedObject.userData?.entity;
                if (ent && this.commonController?.getCapabilities(ent, this.selectedObject)?.rotatable) {
                    isTouchTwisting = true;
                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    initialTwistAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
                    initialEntityAngle = ent.rotation || 0;
                    if (this.ctx.controls) this.ctx.controls.enabled = false;
                    if (this.universalSpinGizmo) {
                        this.universalSpinGizmo.attach(this.selectedObject);
                    }
                    e.preventDefault();
                }
            }
        };

        this._onTouchMove = (e) => {
            if (isTouchTwisting && e.touches && e.touches.length === 2 && this.selectedObject) {
                const ent = this.selectedObject.userData?.entity;
                if (!ent) return;
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const curAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
                let delta = curAngle - initialTwistAngle;
                let targetAngle = initialEntityAngle + delta;

                // Smart snap to 15 degrees
                targetAngle = Math.round(targetAngle / 15) * 15;
                targetAngle = ((targetAngle % 360) + 360) % 360;

                this.commonController.transformEngine.executeSpin(ent, 0, targetAngle);
                if (this.universalSpinGizmo) {
                    this.universalSpinGizmo.currentRotation = targetAngle;
                    this.universalSpinGizmo._updateHeadingArrowRotation(targetAngle);
                    this.universalSpinGizmo.syncHUD();
                }
                if (this.ctx.requestRender) this.ctx.requestRender('touch_twist_rotate');
                e.preventDefault();
            }
        };

        this._onTouchEnd = (e) => {
            if (isTouchTwisting) {
                isTouchTwisting = false;
                if (this.ctx.controls) this.ctx.controls.enabled = (this.mode === 'camera');
                if (this.selectedObject) {
                    const ent = this.selectedObject.userData?.entity;
                    const id = ent?.id || (ent?.group && typeof ent.group.id === 'function' ? ent.group.id() : null);
                    const plannerInst = window.planner?.value || window.planner;
                    if (plannerInst && typeof plannerInst.rotate === 'function' && id && ent) {
                        plannerInst.rotate(id, ent.rotation);
                    }
                }
            }
        };

        dom.addEventListener('pointerdown', this._onPointerDown);
        dom.addEventListener('pointermove', this._onPointerMove);
        dom.addEventListener('pointerup', this._onPointerUp);
        dom.addEventListener('touchstart', this._onTouchStart, { passive: false });
        dom.addEventListener('touchmove', this._onTouchMove, { passive: false });
        dom.addEventListener('touchend', this._onTouchEnd, { passive: false });
        dom.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    setTransformMode(mode) {
        if (!this.selectedObject) return;
        if (this.highlightRenderer) this.highlightRenderer.setMode(mode);
        
        if (mode === 'material') {
            if (this.transformControls) this.transformControls.detach();
            if (this.openingGizmo) this.openingGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.detach();
            this.setHighlight(this.selectedObject, false);
            if (this.roofPitchGizmo) this.roofPitchGizmo.detach();
            if (this.materialGizmo) this.materialGizmo.attach(this.selectedObject);
        } else if (mode === 'opening') {
            if (this.transformControls) this.transformControls.detach();
            if (this.materialGizmo) this.materialGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.detach();
            if (this.roofCornerGizmo) this.roofCornerGizmo.detach();
            if (this.polygonGizmo) this.polygonGizmo.detach();
            if (this.roofOverhangGizmo) this.roofOverhangGizmo.detach();
            if (this.roofPitchGizmo) this.roofPitchGizmo.detach();
            if (this.openingGizmo) this.openingGizmo.attach(this.selectedObject);
        } else if (mode === 'corner') {
            if (this.transformControls) this.transformControls.detach();
            if (this.openingGizmo) this.openingGizmo.detach();
            if (this.materialGizmo) this.materialGizmo.detach();
            if (this.vertexSlopeGizmo) this.vertexSlopeGizmo.detach();
            if (this.roofCornerGizmo) this.roofCornerGizmo.detach();
            if (this.roofOverhangGizmo) this.roofOverhangGizmo.detach();
            if (this.roofPitchGizmo) this.roofPitchGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.attach(this.selectedObject);
        } else if (mode === 'roof_corners' || mode === 'roof_overhang') {
            if (this.transformControls) this.transformControls.detach();
            if (this.openingGizmo) this.openingGizmo.detach();
            if (this.materialGizmo) this.materialGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.detach();
            if (this.vertexSlopeGizmo) this.vertexSlopeGizmo.detach();
            if (this.roofCornerGizmo) this.roofCornerGizmo.detach();
            if (this.roofOverhangGizmo) this.roofOverhangGizmo.detach();
            if (this.roofPitchGizmo && this.selectedObject) this.roofPitchGizmo.attach(this.selectedObject, 'corners');
        } else if (mode === 'none' || mode === 'translate' || mode === 'move' || mode === 'rotateY' || mode === 'spin' || mode === 'rotate') {
            if (this.transformControls) this.transformControls.detach();
            if (this.openingGizmo) this.openingGizmo.detach();
            if (this.materialGizmo) this.materialGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.detach();
            if (this.vertexSlopeGizmo) this.vertexSlopeGizmo.detach();
            if (this.roofCornerGizmo) this.roofCornerGizmo.detach();
            if (this.roofOverhangGizmo) this.roofOverhangGizmo.detach();
            if (this.roofPitchGizmo) {
                if (this.selectedObject && (this.selectedObject.userData?.isRoof || this.selectedObject.userData?.entity?.type === 'roof')) {
                    this.roofPitchGizmo.attach(this.selectedObject, (mode === 'spin' || mode === 'rotateY') ? 'spin' : 'corners');
                } else {
                    this.roofPitchGizmo.detach();
                }
            }
            if (mode === 'spin' || mode === 'rotateY') {
                if (this.universalSpinGizmo && this.selectedObject) {
                    this.universalSpinGizmo.attach(this.selectedObject);
                }
            } else {
                if (this.universalSpinGizmo) this.universalSpinGizmo.detach();
            }
        } else {
            if (this.universalSpinGizmo) this.universalSpinGizmo.detach();
            if (this.openingGizmo) this.openingGizmo.detach();
            if (this.materialGizmo) this.materialGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.detach();
            if (this.vertexSlopeGizmo) this.vertexSlopeGizmo.detach();
            if (this.roofCornerGizmo) this.roofCornerGizmo.detach();
            if (this.roofOverhangGizmo) this.roofOverhangGizmo.detach();
            if (this.roofPitchGizmo) this.roofPitchGizmo.detach();
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
        if (this.stairPlacementSystem && this.stairPlacementSystem.hideGhost) {
            this.stairPlacementSystem.hideGhost();
        }
        if (this.wallPluginPlacementSystem && this.wallPluginPlacementSystem.hideGhost) {
            this.wallPluginPlacementSystem.hideGhost();
        }
        if (this.furniturePlacementSystem && this.furniturePlacementSystem.hideGhost) {
            this.furniturePlacementSystem.hideGhost();
        }
        if (this.roofPlacementSystem && this.roofPlacementSystem.hideGhost) {
            this.roofPlacementSystem.hideGhost();
        }
        if (this.roofPluginPlacementSystem && this.roofPluginPlacementSystem.hideGhost) {
            this.roofPluginPlacementSystem.hideGhost();
        }
    }

    refreshSelectionHighlight(object = null) {
        if (this.highlightRenderer) {
            this.highlightRenderer.refresh(object || this.selectedObject);
        }
    }

    setHighlight(group, active, color = 0x38bdf8) {
        if (!group) return;

        const entity = group.userData?.entity || (group.userData?.entityId ? { id: group.userData.entityId } : null);
        const slotName = group.userData?.materialSlot;

        if (entity && entity.id && slotName) {
            ComponentRegistry.setSlotHighlight(entity.id, slotName, active, active ? (color || 0x38bdf8) : 0, this.ctx);
        }

        if (group.isMesh && group.material) {
            BIMMaterialSystem.setBIMHighlight(group, active, active ? (color || 0x38bdf8) : 0, this.ctx);
        }

        if (this.highlightRenderer) {
            let targetGroup = group;
            if (targetGroup.userData && targetGroup.userData.isWallDecor) {
                const wall = targetGroup.userData.parentWall || targetGroup.parent?.userData?.entity;
                const side = targetGroup.userData.entity?.side || targetGroup.userData.side || 'front';
                if (wall && wall.mesh3D) {
                    const wallSideMesh = wall.mesh3D.children.find(c => c.userData.isWallSide && c.userData.side === side);
                    if (wallSideMesh) targetGroup = wallSideMesh;
                }
            }

            if (active) {
                if (targetGroup.userData && targetGroup.userData.isWallSide) {
                    this.highlightRenderer.setSelectionHighlight(targetGroup, this.ctx.currentTransformMode || 'normal');
                } else {
                    this.highlightRenderer.setSelectionHighlight(targetGroup, 'normal');
                }
            } else {
                this.highlightRenderer.clearSelectionHighlight();
                this.highlightRenderer.clearHoverHighlight();
            }
        }        if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
    }

    selectObject(object, intersect = null, preventAutoFocus = false) {
        this.select(object, null, null, preventAutoFocus, intersect);
    }

    select(object, type = null, side = null, preventAutoFocus = false, intersect = null) {
        if (!object || this._isSelecting) return;
        this._isSelecting = true;

        try {
            if (this.selectedObject === object && this.ctx.currentTransformMode !== 'none') {
                return;
            }

            this.deselect();
            this.selectedObject = object;

            const result = this.selectionManager.resolveSelectionType(object);
            if (result) {
                type = result.type;
                side = result.side;
            }

            console.info(`%c[InteractionSystem] %cSelected: %c${type || 'Unknown'} %c(Entity ID: ${object.userData?.entity?.id || 'N/A'})`, 
                'color: #3b82f6; font-weight: bold;', 'color: #9ca3af;', 'color: #10b981; font-weight: bold;', 'color: #6b7280;');

            if (this.dimensionManager) this.dimensionManager.onSelect(object.userData.entity, object);

            if (object.userData?.isRoof || object.userData?.entity?.type === 'roof') {
                if (this.roofPitchGizmo) this.roofPitchGizmo.attach(object, 'corners');
            } else {
                if (this.roofPitchGizmo) this.roofPitchGizmo.detach();
            }

            const wallEntity = object.userData?.parentWall || object.userData?.entity;
            const isWallType = wallEntity && (wallEntity.type === 'outer' || wallEntity.type === 'inner' || wallEntity.type === 'compound' || wallEntity.type === 'wall');
            const isBaseWall = (object.userData?.isWallSide || object.userData?.isWall || object.userData?.isWallMesh || isWallType) && !object.userData?.isOpening;
            if (isBaseWall && this.wallInteractiveSuite) {
                this.wallInteractiveSuite.attach(object, 'menu');
            } else if (this.wallInteractiveSuite) {
                this.wallInteractiveSuite.detach();
            }

            if (type && this.ctx.onEntitySelect) this.ctx.onEntitySelect(object.userData.entity, type, side);
            if (this.commonController) this.commonController.setSelection(object.userData.entity, object);
            if (this.commonController?.activeTool === COMMON_TOOLS.SPIN || this.ctx.currentTransformMode === 'rotateY' || this.ctx.currentTransformMode === 'spin') {
                if (this.universalSpinGizmo) this.universalSpinGizmo.attach(object);
            }
            if (window.plannerInstance && object.userData.entity && window.plannerInstance.selectedEntity !== object.userData.entity) {
                window.plannerInstance.selectEntity(object.userData.entity, type);
            }
            
            const settings = useSettingsStore().floorPlanSettings;
            const shouldAutoFocus = settings.autoFocus !== false; // default true
            const shouldAutoRotate = settings.autoRotate !== false; // default true

            // Auto focus the camera on the selected object only when not explicitly prevented
            if (this.ctx.cameraController && object && shouldAutoFocus && !preventAutoFocus) {
                this.ctx.cameraController.focusOnObject(object, intersect, shouldAutoRotate);
            }

            if (this.ctx && typeof this.ctx.requestRender === 'function') {
                this.ctx.requestRender();
            }
        } finally {
            this._isSelecting = false;
        }
    }

    deselect() {
        if (!this.selectedObject && this.ctx.currentTransformMode === 'none') return;
        if (this._isDeselecting) return;
        this._isDeselecting = true;

        try {
            if (this.selectedObject) {
                console.info(`%c[InteractionSystem] %cDeselected: %c${this.selectedObject.userData?.entity?.type || 'Object'}`, 
                    'color: #3b82f6; font-weight: bold;', 'color: #9ca3af;', 'color: #ef4444; font-weight: bold;');
            }
            this.cancelRelocation();
            if (this.transformControls) this.transformControls.detach();
            if (this.openingGizmo) this.openingGizmo.detach();
            if (this.materialGizmo) this.materialGizmo.detach();
            if (this.cornerGizmo) this.cornerGizmo.detach();
            if (this.vertexSlopeGizmo) this.vertexSlopeGizmo.detach();
            if (this.roofCornerGizmo) this.roofCornerGizmo.detach();
            if (this.roofOverhangGizmo) this.roofOverhangGizmo.detach();
            if (this.roofPitchGizmo) this.roofPitchGizmo.detach();
            if (this.polygonGizmo) this.polygonGizmo.detach();
            if (this.universalSpinGizmo) this.universalSpinGizmo.detach();
            if (this.wallInteractiveSuite) this.wallInteractiveSuite.detach();
            this.ctx.currentTransformMode = 'none';
            if (this.ctx.showTransformMenu) this.ctx.showTransformMenu(false);
            
            if (this.highlightRenderer) {
                this.highlightRenderer.clearAll();
            }
            
            this.selectedObject = null;
            if (this.dimensionManager) this.dimensionManager.onDeselect();
            if (this.ctx.onEntitySelect) this.ctx.onEntitySelect(null, null, null);
            if (this.commonController) this.commonController.clearSelection();
            if (window.plannerInstance && window.plannerInstance.selectedEntity !== null) {
                window.plannerInstance.selectEntity(null, null);
            }
            if (this.ctx && typeof this.ctx.requestRender === 'function') {
                this.ctx.requestRender();
            }
        } finally {
            this._isDeselecting = false;
        }
    }

    dispose() {
        if (this.transformControls) {
            this.transformControls.removeEventListener('move-start', this._onMoveStart);
            this.transformControls.removeEventListener('move-end', this._onMoveEnd);
            this.transformControls.removeEventListener('rotate-start', this._onRotateStart);
            this.transformControls.removeEventListener('rotate-end', this._onRotateEnd);
            this.transformControls.removeEventListener('move-change', this._syncUI);
            this.transformControls.removeEventListener('scale-change', this._syncUI);
            this.transformControls.removeEventListener('spin-change', this._syncUI);
            this.transformControls.removeEventListener('tilt-change', this._syncUI);
            this.transformControls.removeEventListener('rotate-change', this._syncUI);
            if (this.transformControls.dispose) this.transformControls.dispose();
        }

        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            if (this._onPointerDown) dom.removeEventListener('pointerdown', this._onPointerDown);
            if (this._onPointerMove) dom.removeEventListener('pointermove', this._onPointerMove);
            if (this._onPointerUp) dom.removeEventListener('pointerup', this._onPointerUp);
            if (this._onTouchStart) dom.removeEventListener('touchstart', this._onTouchStart);
            if (this._onTouchMove) dom.removeEventListener('touchmove', this._onTouchMove);
            if (this._onTouchEnd) dom.removeEventListener('touchend', this._onTouchEnd);
        }

        if (this.openingGizmo && this.openingGizmo.dispose) this.openingGizmo.dispose();
        if (this.materialGizmo && this.materialGizmo.dispose) this.materialGizmo.dispose();
        if (this.cornerGizmo && this.cornerGizmo.dispose) this.cornerGizmo.dispose();
        if (this.vertexSlopeGizmo && this.vertexSlopeGizmo.dispose) this.vertexSlopeGizmo.dispose();
        if (this.roofCornerGizmo && this.roofCornerGizmo.dispose) this.roofCornerGizmo.dispose();
        if (this.roofOverhangGizmo && this.roofOverhangGizmo.dispose) this.roofOverhangGizmo.dispose();
        if (this.roofPitchGizmo && this.roofPitchGizmo.dispose) this.roofPitchGizmo.dispose();
        if (this.polygonGizmo && this.polygonGizmo.dispose) this.polygonGizmo.dispose();
        if (this.universalSpinGizmo && this.universalSpinGizmo.dispose) this.universalSpinGizmo.dispose();
        if (this.wallInteractiveSuite && this.wallInteractiveSuite.dispose) this.wallInteractiveSuite.dispose();
        if (this.wall3DDrawSystem && this.wall3DDrawSystem.dispose) this.wall3DDrawSystem.dispose();
        if (this.shape3DDrawSystem && this.shape3DDrawSystem.destroy) this.shape3DDrawSystem.destroy();
        if (this.wallPluginPlacementSystem && this.wallPluginPlacementSystem.dispose) this.wallPluginPlacementSystem.dispose();
        if (this.stairPlacementSystem && this.stairPlacementSystem.dispose) this.stairPlacementSystem.dispose();
        if (this.furniturePlacementSystem && this.furniturePlacementSystem.dispose) this.furniturePlacementSystem.dispose();
        if (this.roofPlacementSystem && this.roofPlacementSystem.dispose) this.roofPlacementSystem.dispose();
        if (this.roofPluginPlacementSystem && this.roofPluginPlacementSystem.dispose) this.roofPluginPlacementSystem.dispose();
        if (this.highlightRenderer && this.highlightRenderer.dispose) this.highlightRenderer.dispose();
        if (this.dimensionManager && this.dimensionManager.dispose) this.dimensionManager.dispose();
        if (this.sims4Footprint) {
            if (this.sims4Footprint.geometry) this.sims4Footprint.geometry.dispose();
            if (this.sims4Footprint.material) this.sims4Footprint.material.dispose();
            if (this.sims4Footprint.parent) this.sims4Footprint.parent.remove(this.sims4Footprint);
        }
    }
}

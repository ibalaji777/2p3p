import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { TransformControls } from './engine3d/TransformControls.js';
import { WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, GLASS_REGISTRY, DOOR_TYPES, WINDOW_TYPES, WALL_DECOR_REGISTRY, WIDGET_REGISTRY, MOLDING_REGISTRY, DOOR_MATERIALS_REGISTRY, FABRIC_REGISTRY, getFabricBaseConfig, resolveFabricConfig } from './registry.js';
import { EnvironmentBuilder } from "./engine3d/EnvironmentBuilder.js";
import { AssetManager  } from "./engine3d/AssetManager.js";
import { DecorManager  } from "./engine3d/DecorManager.js";
import { FurnitureManager  } from "../features/furniture/furniture.renderer3d.js";
import { InteractionSystem  } from "./engine3d/InteractionSystem.js";
import { GizmoManager } from "./engine3d/GizmoManager.js";
import { CameraController } from "./camera/CameraController.js";
import { NavigationCube } from "./camera/NavigationCube.js";
import { ThumbnailGenerator } from "./ThumbnailGenerator.js";
import { MaterialFactory } from "./engine3d/MaterialFactory.js";
import { UniversalMaterialManager } from "./engine3d/UniversalMaterialManager.js";
import { RenderCoordinator } from "./engine3d/RenderCoordinator.js";

export class Preview3D {
    constructor(containerEl) {
        this.container = containerEl;
        this.renderCoordinator = new RenderCoordinator(this);

        this.scene = new THREE.Scene();
        this.structureGroup = new THREE.Group();
        this.staticStructureGroup = new THREE.Group();
        this.scene.add(this.structureGroup);
        this.scene.add(this.staticStructureGroup);
        
        const w = this.container.clientWidth > 0 ? this.container.clientWidth : window.innerWidth;
        const h = this.container.clientHeight > 0 ? this.container.clientHeight : window.innerHeight;
        
        this.camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace; 
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        // CSS2D Renderer for measurements and labels
        this.css2DRenderer = new CSS2DRenderer();
        this.css2DRenderer.setSize(w, h);
        this.css2DRenderer.domElement.style.position = 'absolute';
        this.css2DRenderer.domElement.style.top = '0px';
        this.css2DRenderer.domElement.style.pointerEvents = 'none'; // So it doesn't block WebGL interactions
        this.container.appendChild(this.css2DRenderer.domElement);

        // We bypass EffectComposer completely to allow native WebGL hardware anti-aliasing 
        // to work flawlessly. This removes the jagged edge issues.
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        this.cameraController = new CameraController(this.camera, this.renderer.domElement, this);
        this.controls = this.cameraController.controls;
        this.controls.addEventListener('start', () => this.renderCoordinator.startContinuousRender('orbit_controls'));
        this.controls.addEventListener('end', () => this.renderCoordinator.stopContinuousRender('orbit_controls'));
        this.controls.addEventListener('change', () => this.renderCoordinator.notifyChange('orbit_controls_change', 2));

        this.navigationCube = new NavigationCube(this.container, this.cameraController);

        this.interactables = [];
        this.isUpdatingFromUI = false;
        this.needsRender = true;
        
        this.assets = new AssetManager();

        
        this.helpers = {
            ctx: this,
            getDynamicMaterial: (matId, category) => {
                let conf = UniversalMaterialManager.getMaterial(matId);
                if (!conf) return new THREE.MeshStandardMaterial();
                
                // Determine rough fallback dimensions based on category
                let dims = { width: 100, height: 100 };
                if (category === 'door') dims = { width: 90, height: 210 };
                else if (category === 'window_frame') dims = { width: 100, height: 150 };

                let mat = conf.transmission ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();

                MaterialFactory.buildPBRMaterial({
                    material: mat,
                    config: conf,
                    ctx: this,
                    dimensions: dims,
                    faceName: category
                }).then(() => {
                    if (this.materialClonesRegistry && this.materialClonesRegistry.has(mat)) {
                        this.materialClonesRegistry.get(mat).forEach(clone => {
                            clone.copy(mat);
                            clone.needsUpdate = true;
                        });
                    }
                    // if (this.requestRender) this.requestRender('material_loaded', 2);
                });
                
                return mat;
            },
            getFaceMaterials: (entity, baseMaterial, dimensions) => {
                const cloneMat = (base) => {
                    const c = base.clone();
                    if (!this.materialClonesRegistry) this.materialClonesRegistry = new WeakMap();
                    if (!this.materialClonesRegistry.has(base)) this.materialClonesRegistry.set(base, new Set());
                    this.materialClonesRegistry.get(base).add(c);
                    return c;
                };
                let matSides = cloneMat(baseMaterial);
                let matTop = cloneMat(baseMaterial);
                let matBottom = cloneMat(baseMaterial);
                let matLeft = cloneMat(baseMaterial);
                let matRight = cloneMat(baseMaterial);
                let matFront = cloneMat(baseMaterial);
                let matBack = cloneMat(baseMaterial);

                const w = dimensions?.width || entity?.width || entity?.params?.width || 100;
                const h = dimensions?.height || entity?.height || entity?.params?.height || 100;
                const d = dimensions?.depth || entity?.depth || entity?.params?.depth || 30;

                const isWall = entity && (entity.type === 'outer' || entity.type === 'inner' || entity.type === 'wall' || entity.startX !== undefined);
                const applyTex = (mat, texKey, faceW, faceH, faceName) => {
                    if (!texKey) return;
                    const config = resolveMaterialConfig(texKey);
                    if (config) {
                        MaterialFactory.buildPBRMaterial({
                            material: mat,
                            config: config,
                            ctx: this,
                            dimensions: { width: faceW, height: faceH, isWorldUV: isWall },
                            faceName: faceName
                        }).then(() => {
                            if (this.requestRender) this.requestRender('material_loaded', 2);
                        });
                    }
                };

                if (entity && entity.params) {
                    const resolveTex = (...keys) => {
                        for (let k of keys) {
                            if (entity.params[k] === '' || entity.params[k] === null) return null;
                            if (entity.params[k] !== undefined) return entity.params[k];
                        }
                        return null;
                    };
                    applyTex(matTop, resolveTex('textureTop', 'texture'), w, d, 'top');
                    applyTex(matBottom, resolveTex('textureBottom', 'texture'), w, d, 'bottom');
                    applyTex(matSides, resolveTex('textureSides', 'texture'), w, h, 'sides');
                    applyTex(matLeft, resolveTex('textureLeft', 'textureSides', 'texture'), d, h, 'left');
                    applyTex(matRight, resolveTex('textureRight', 'textureSides', 'texture'), d, h, 'right');
                    applyTex(matFront, resolveTex('textureFront', 'textureSides', 'texture'), w, h, 'front');
                    applyTex(matBack, resolveTex('textureBack', 'textureSides', 'texture'), w, h, 'back');
                }

                return {
                    box: [matRight, matLeft, matTop, matBottom, matFront, matBack],
                    extrude: [matTop, matSides] 
                };
            }
        };

        this.envBuilder = new EnvironmentBuilder(this);
        this.decorManager = new DecorManager(this);
        this.furnitureManager = new FurnitureManager(this);
        this.interactions = new InteractionSystem(this);
        
        this.thumbnailGenerator = new ThumbnailGenerator(this);

        this.gizmoManager = new GizmoManager(this);
        this.gizmoManager.init();

        this._onTransformChange = () => {
            if (this.currentTransformMode === 'place' && this.gizmoManager.inputX && this.interactions.selectedObject) {
                this.gizmoManager.inputX.value = this.interactions.selectedObject.position.x.toFixed(1);
                this.gizmoManager.inputY.value = this.interactions.selectedObject.position.z.toFixed(1);
                if (this.gizmoManager.inputZ && this.interactions.selectedObject.userData.entity) {
                    this.gizmoManager.inputZ.value = (this.interactions.selectedObject.userData.entity.elevation || 0).toFixed(1);
                }
            }
        };
        this.interactions.transformControls.addEventListener('change', this._onTransformChange);

        this.envBuilder.setupBaseEnvironment();
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer); 
        pmremGenerator.compileEquirectangularShader(); 
        const roomEnv = new RoomEnvironment();
        this.scene.environment = pmremGenerator.fromScene(roomEnv).texture;
        roomEnv.dispose();
        pmremGenerator.dispose();

        this._onResize = () => this.resize();
        window.addEventListener('resize', this._onResize); 
        this._animateId = requestAnimationFrame(() => this.animate());
    }

    dispose() {
        if (this._onTransformChange && this.interactions && this.interactions.transformControls) {
            this.interactions.transformControls.removeEventListener('change', this._onTransformChange);
        }
        if (this._onResize) window.removeEventListener('resize', this._onResize);
        if (this._animateId) cancelAnimationFrame(this._animateId);
        
        if (this.renderCoordinator) this.renderCoordinator.dispose();
        if (this.interactions && this.interactions.dispose) this.interactions.dispose();
        if (this.gizmoManager && this.gizmoManager.dispose) this.gizmoManager.dispose();
        if (this.navigationCube && this.navigationCube.dispose) this.navigationCube.dispose();
        if (this.cameraController && this.cameraController.dispose) this.cameraController.dispose();
        
        // Clean up WebGL context and renderer
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss();
        }
    }

    resize() {
        if (this.container.style.display !== 'none') { 
            const w = this.container.clientWidth > 0 ? this.container.clientWidth : window.innerWidth; 
            const h = this.container.clientHeight > 0 ? this.container.clientHeight : window.innerHeight; 
            this.camera.aspect = w / h; 
            this.camera.updateProjectionMatrix(); 
            this.renderer.setSize(w, h); 
            if (this.css2DRenderer) this.css2DRenderer.setSize(w, h);
            this.requestRender('window_resize');
        }
    }

    requestRender(reason = 'legacy_request', frames = 2) {
        if (this.renderCoordinator) {
            this.renderCoordinator.notifyChange(reason, frames);
        } else {
            this.needsRender = true;
        }
    }

    animate() { 
        this._animateId = requestAnimationFrame(() => this.animate()); 
        
        // Let camera controller handle its internal damping/updates
        const cameraChanged = this.cameraController.update(); 
        this.navigationCube.update(this.camera);
        
        // Render pass scheduled by RenderCoordinator or active camera movements
        if (this.renderCoordinator.shouldRender() || cameraChanged || this.isUpdatingFromUI) {
            this.renderer.render(this.scene, this.camera); 
            if (this.css2DRenderer) this.css2DRenderer.render(this.scene, this.camera);
            if (this.interactions && this.interactions.dimensionManager) {
                this.interactions.dimensionManager.onCameraUpdate(this.camera, this.renderer.domElement.clientWidth, this.renderer.domElement.clientHeight);
            }
            this.renderCoordinator.onFrameRendered();
            this.needsRender = false;
        }
        
        this.updateTransformMenu();
    }

    showTransformMenu(visible) {
        this.gizmoManager.showTransformMenu(visible);
    }

    setTransformMode(mode, force = false) {
        this.gizmoManager.setTransformMode(mode, force);
    }

    updateTransformMenu() {
        this.gizmoManager.updateTransformMenu();
    }

    updateOpeningPanel(entity) {
        this.gizmoManager.updateOpeningPanel(entity);
    }

    setEnvironment(skyKey, groundKey) { 
        this.envBuilder.setEnvironment(skyKey, groundKey); 
        this.requestRender();
    }
    setInteractionMode(mode) { this.interactions.setMode(mode); }
    cancelRelocation() { this.interactions.cancelRelocation(); }
    selectObject(obj) { this.interactions.selectObject(obj); }
    deselectObject() { this.interactions.deselect(); }
    
    addWallPattern(w, id, s) { return this.decorManager.add(w, id, s); }
    updateWallDecorLive(e) { this.decorManager.updateLive(e); }
    
    updateFurnitureLive(e) { this.furnitureManager.updateLive(e); }
    
    updatePatternLive(widg) {
        if (!widg || !widg.patternMesh3D) return;
        const mat = widg.patternMat3D || (widg.patternMesh3D.isGroup ? widg.patternMesh3D.children[0].material : widg.patternMesh3D.material);

        if (widg.patternLayer && typeof widg.patternLayer === 'object') {
            const layer = widg.patternLayer;
            if (layer.texture && layer.texture !== 'none' && layer.texture !== '') {
                this.assets.getTexture({ id: 'pat_tex_' + (layer.texture.replace(/[^a-z0-9]/gi, '')), texture: layer.texture }).then(tex => {
                    const texClone = tex.clone();
                    texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                    const tileSize = layer.tileSize || 40;
                    texClone.repeat.set(1 / tileSize, 1 / tileSize);
                    if (layer.rotation) texClone.rotation = (layer.rotation * Math.PI) / 180;
                    if (layer.offsetX || layer.offsetY) texClone.offset.set(layer.offsetX || 0, layer.offsetY || 0);
                    mat.map = texClone;
                    mat.color.setHex(layer.color ? parseInt(layer.color.replace('#', '0x')) : 0xffffff);
                    mat.needsUpdate = true;
                }).catch(() => {
                    mat.map = null;
                    if (layer.color) mat.color.setHex(parseInt(layer.color.replace('#', '0x')));
                    mat.needsUpdate = true;
                });
            } else {
                mat.map = null;
                mat.color.setHex(layer.color ? parseInt(layer.color.replace('#', '0x')) : 0xd1d5db);
                mat.needsUpdate = true;
            }
            return;
        }
        
        const configId = typeof widg.patternLayer === 'string' && widg.patternLayer ? widg.patternLayer : widg.decorConfigId;
        if (configId && WALL_DECOR_REGISTRY[configId]) {
            const config = WALL_DECOR_REGISTRY[configId];
            this.assets.getTexture(config).then(tex => {
                const texClone = tex.clone();
                texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                const tileSize = config.defaultTileSize || 40;
                texClone.repeat.set(1 / tileSize, 1 / tileSize);
                mat.map = texClone;
                mat.color.setHex(0xffffff);
                mat.needsUpdate = true;
            });
        } else {
            mat.map = null;
            mat.color.setHex(0xf5f5f0);
            mat.needsUpdate = true;
        }
    }

    updateMaterialLive(entity) {
        if (!entity || !entity.mesh3D || this.isUpdatingFrom3D) return false;
        const obj = entity.mesh3D;
        const parent = obj.parent;
        if (!parent) return false;

        if (entity.type === 'outer' || entity.type === 'inner' || entity.type === 'wall' || entity.type === 'railing') {
            const h = entity.height !== undefined ? entity.height : (entity.config?.height || 300);
            const w = entity.length3D !== undefined ? entity.length3D : 100;
            const baseMat = new THREE.MeshStandardMaterial({ color: 0xfaf8ed });
            
            // Re-fetch materials based on entity.params
            const mats = this.helpers.getFaceMaterials(entity, baseMat, { width: w, height: h }).box;
            
            // Find the actual wall mesh (not hitboxes or widgets)
            const wallMesh = obj.children ? obj.children.find(c => c.isMesh && !c.userData.isHitbox && !c.userData.isWallSide) : null;
            if (wallMesh) {
                if (Array.isArray(wallMesh.material)) {
                    wallMesh.material.forEach((m) => { 
                        if (m && m.dispose && !m.userData?.keepAlive) m.dispose(); 
                    });
                } else if (wallMesh.material) {
                    if (wallMesh.material.dispose && !wallMesh.material.userData?.keepAlive) wallMesh.material.dispose();
                }
                // Assign new array reference so Three.js catches the change
                wallMesh.material = mats;
                
                // Update attached holes if any
                obj.children.forEach(c => {
                    if (c.userData && c.userData.isPattern) {
                        const patMesh = c.children ? c.children[0] : c;
                        if (patMesh.material) {
                            if (patMesh.material.dispose) patMesh.material.dispose();
                            patMesh.material = mats[4].clone(); // front material
                        }
                    }
                });
                
                this.requestRender('wall_material_update', 2);
                return true;
            }
        }

        let renderFunc = null;
        if (WIDGET_REGISTRY[entity.type]) renderFunc = WIDGET_REGISTRY[entity.type].render3D;
        else if (MOLDING_REGISTRY[entity.type]) renderFunc = MOLDING_REGISTRY[entity.type].render3D;
        else if (DOOR_TYPES && DOOR_TYPES[entity.type]) renderFunc = DOOR_TYPES[entity.type].render3D;
        else if (WINDOW_TYPES && WINDOW_TYPES[entity.type]) renderFunc = WINDOW_TYPES[entity.type].render3D;
        else if (WALL_DECOR_REGISTRY && WALL_DECOR_REGISTRY[entity.type]) renderFunc = WALL_DECOR_REGISTRY[entity.type].render3D;
        else if (entity.type === 'pattern' && window.PATTERN_REGISTRY && window.PATTERN_REGISTRY[entity.patternType]) renderFunc = window.PATTERN_REGISTRY[entity.patternType].render3D;
        else if ((entity.type === 'furniture' || entity.isFurniture) && window.FURNITURE_REGISTRY) {
            const fConf = window.FURNITURE_REGISTRY[entity.furnitureType || entity.type];
            if (fConf) renderFunc = fConf.render3D;
        }

        if (renderFunc) {
            const oldMesh = obj;
            // Generate a fresh mesh using the same registry function
            const newMesh = renderFunc(new THREE.Group(), entity, this.helpers);
            
            // The newMesh is attached to the temporary THREE.Group() inside render3D!
            // We need to pull it out and replace the old one
            
            parent.add(newMesh);
            parent.remove(oldMesh);
            
            // Dispose old resources
            oldMesh.traverse(child => {
                if (child.isMesh && child.geometry) child.geometry.dispose();
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => { if (m && m.dispose) m.dispose(); });
                    else if (child.material.dispose) child.material.dispose();
                }
            });

            entity.mesh3D = newMesh;

            // Maintain interaction state
            const interactions = this.interactions;
            if (interactions.selectedObject === oldMesh) {
                interactions.selectedObject = newMesh;
                
                // Update interactables array
                const idx = this.interactables.indexOf(oldMesh);
                if (idx > -1) this.interactables[idx] = newMesh;
                
                if (this.currentTransformMode === 'material' && interactions.materialGizmo) {
                    interactions.materialGizmo.attach(newMesh);
                }

                if (interactions.refreshSelectionHighlight) {
                    interactions.refreshSelectionHighlight(newMesh);
                }
            }
            return true;
        }
        return false;
    }

    updateDoorAnimationLive(entity) {
        if (!entity || !entity.mesh3D || entity.type !== 'door') return;
        
        const openPercent = entity.openAngle !== undefined ? entity.openAngle / 180 : 0;
        const baseOpenAngle = (entity.openAngle !== undefined ? entity.openAngle : 0) * (Math.PI / 180);
        
        entity.mesh3D.traverse((child) => {
            if (child.userData && child.userData.isMovingPart) {
                const ud = child.userData;
                if (ud.motionType === 'rotate' || ud.motionType === 'bifold_main' || ud.motionType === 'bifold_lead') {
                    child.rotation.y = (ud.baseRotation || 0) + baseOpenAngle * ud.motionSign;
                } else if (ud.motionType === 'slide') {
                    child.position.x = ud.baseX + ud.maxSlide * openPercent;
                }
            }
        });
        
        if (this.gizmoManager && typeof this.gizmoManager.updateTransformMenu === 'function') {
            this.gizmoManager.updateTransformMenu();
        }
        
        if (this.interactions && typeof this.interactions.refreshSelectionHighlight === 'function') {
            this.interactions.refreshSelectionHighlight(entity.mesh3D);
        }
    }

    updateWallGeometryLive(w) {
        if (!w || !this.envBuilder) return;
        
        let selectionToRestore = null;
        if (this.interactions && this.interactions.selectedObject && this.interactions.selectedObject.userData) {
            const selEntity = this.interactions.selectedObject.userData.entity;
            if (selEntity && (selEntity === w || selEntity.wall === w)) {
                selectionToRestore = selEntity.id || selEntity;
            }
        }
        
        if (w.mesh3D) {
            this.structureGroup.remove(w.mesh3D);
            this.interactables = this.interactables.filter(m => {
                if (m === w.mesh3D) return false;
                if (m.userData && m.userData.entity === w) return false;
                if (m.userData && m.userData.isWallSide && m.userData.entity === w) return false;
                if (m.userData && m.userData.entity && m.userData.entity.wall === w) return false;
                if (m.userData && m.userData.moldData && m.userData.moldData.wall === w) return false;
                return true;
            });
            w.mesh3D.traverse(c => {
                if (c.geometry) c.geometry.dispose();
            });
        }
        
        this.envBuilder.buildWallGroup(w);
        
        if (selectionToRestore && this.interactions) {
            const newMesh = this.interactables.find(m => m.userData && (m.userData.entity === selectionToRestore || (m.userData.entity && m.userData.entity.id === selectionToRestore)));
            if (newMesh) {
                this.interactions.selectedObject = newMesh;
                if (this.interactions.openingGizmo && this.interactions.openingGizmo.visible) {
                    this.interactions.openingGizmo.attach(newMesh, this.interactions.openingGizmo.mode);
                }
                this.interactions.highlightRenderer.setSelectionHighlight(newMesh);
            }
        }
        
        this.requestRender('wall_geometry_update', 2);
    }

    updateRoofLive(roof) {
        if (!roof || !roof.mesh3D || this.isUpdatingFrom3D) return;
        this.isUpdatingFromUI = true;
        this.envBuilder.updateRoofLive(roof);
        if (this.syncToUI) this.syncToUI();
        this.isUpdatingFromUI = false;
    }

    updateShapeLive(entity) {
        if (!entity || !entity.mesh3D || this.isUpdatingFrom3D) return;
        this.isUpdatingFromUI = true;
        const obj = entity.mesh3D;
        const h = entity.params.height3D || 100;
        
        if (entity.type === 'shape_rect') {
            obj.position.set(entity.group.x(), h / 2, entity.group.y());
            obj.rotation.y = -(entity.rotation || 0) * Math.PI / 180;
            obj.geometry.dispose();
            obj.geometry = new THREE.BoxGeometry(entity.params.width, h, entity.params.height);
            obj.geometry.translate(0, h / 2, 0);
        } else if (entity.type === 'shape_circle') {
            obj.position.set(entity.group.x(), 0, entity.group.y());
            obj.geometry.dispose();
            obj.geometry = new THREE.CylinderGeometry(entity.params.radius, entity.params.radius, h, 32);
            obj.geometry.translate(0, h / 2, 0);
        } else if (entity.type === 'shape_triangle' || entity.type === 'shape_polygon' || entity.type === 'shape_floor_cut') {
            const shape2d = new THREE.Shape();
            if (entity.params.points && entity.params.points.length >= 3) {
                const pts = entity.params.points;
                shape2d.moveTo(pts[0].x, pts[0].y);
                for(let i=1; i<pts.length; i++) shape2d.lineTo(pts[i].x, pts[i].y);
                shape2d.lineTo(pts[0].x, pts[0].y);
                obj.geometry.dispose();
                
                if (entity.type === 'shape_floor_cut') {
                    obj.geometry = new THREE.ShapeGeometry(shape2d);
                    obj.geometry.rotateX(Math.PI / 2);
                    
                    if (obj.children && obj.children.length > 0 && obj.children[0].isLineSegments) {
                        const edgesMesh = obj.children[0];
                        if (edgesMesh.geometry) edgesMesh.geometry.dispose();
                        edgesMesh.geometry = new THREE.EdgesGeometry(obj.geometry);
                    }
                    this.rebuildActiveFloors();
                } else {
                    obj.geometry = new THREE.ExtrudeGeometry(shape2d, { depth: h, bevelEnabled: false });
                    obj.geometry.rotateX(Math.PI / 2);
                    obj.geometry.translate(0, h, 0);
                }
            }
        }
        
        if (entity.params.vertexElevations && entity.params.vertexElevations.some(v => v !== 0)) {
            let corners = [];
            if (entity.type === 'shape_rect') {
                const w2 = (entity.params.width || 100) / 2;
                const d2 = (entity.params.height || 100) / 2;
                corners = [ { x: -w2, z: -d2 }, { x: w2, z: -d2 }, { x: w2, z: d2 }, { x: -w2, z: d2 } ];
            } else if (entity.type === 'shape_polygon' || entity.type === 'shape_triangle') {
                if (entity.params.points) corners = entity.params.points.map(p => ({ x: p.x, z: p.y }));
            }

            if (corners.length > 0 && corners.length === entity.params.vertexElevations.length) {
                const pos = obj.geometry.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    let vy = pos.getY(i);
                    if (vy > h - 1) {
                        let vx = pos.getX(i);
                        let vz = pos.getZ(i);
                        let minD = Infinity;
                        let minIdx = -1;
                        for (let c = 0; c < corners.length; c++) {
                            let dx = vx - corners[c].x;
                            let dz = vz - corners[c].z;
                            let dist = dx*dx + dz*dz;
                            if (dist < minD) {
                                minD = dist;
                                minIdx = c;
                            }
                        }
                        if (minIdx !== -1) {
                            pos.setY(i, vy + entity.params.vertexElevations[minIdx]);
                        }
                    }
                }
                pos.needsUpdate = true;
                obj.geometry.computeVertexNormals();
            }
        }
        
        const groupX = entity.group ? entity.group.x() : (entity.x || 0);
        const groupZ = entity.group ? entity.group.y() : (entity.y || 0);
        const intentionalElevation = entity.elevation || 0;
        
        if (entity.type === 'shape_floor_cut') {
            obj.position.set(groupX, 0.5, groupZ);
        } else {
            obj.position.set(groupX, intentionalElevation, groupZ);
        }
        obj.rotation.set(
            entity.rotationX || 0,
            -(entity.rotation || 0) * Math.PI / 180,
            entity.rotationZ || 0,
            'YXZ'
        );

        const color = entity.params.fill ? parseInt(entity.params.fill.replace('#', '0x')) : 0x38bdf8;
        
        const matBase = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
        let matSides = matBase.clone();
        let matTop = matBase.clone();
        let matBottom = matBase.clone();
        let matLeft = matBase.clone();
        let matRight = matBase.clone();
        let matFront = matBase.clone();
        let matBack = matBase.clone();

        const applyTex = (mat, texKey) => {
            if (!texKey) return;
            const config = WALL_DECOR_REGISTRY[texKey];
            if (config) {
                this.assets.getTexture(config).then(tex => {
                    const texClone = tex.clone();
                    texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                    const tileSize = config.defaultTileSize || 40;
                    const maxDim = Math.max(entity.params.width || entity.params.radius || 100, h);
                    texClone.repeat.set(maxDim / tileSize, maxDim / tileSize);
                    mat.map = texClone;
                    mat.color.setHex(0xffffff);
                    mat.needsUpdate = true;
                });
            }
        };

        applyTex(matTop, entity.params.textureTop || entity.params.texture);
        applyTex(matBottom, entity.params.textureBottom || entity.params.texture);
        applyTex(matSides, entity.params.textureSides || entity.params.texture);
        applyTex(matLeft, entity.params.textureLeft || entity.params.textureSides || entity.params.texture);
        applyTex(matRight, entity.params.textureRight || entity.params.textureSides || entity.params.texture);
        applyTex(matFront, entity.params.textureFront || entity.params.textureSides || entity.params.texture);
        applyTex(matBack, entity.params.textureBack || entity.params.textureSides || entity.params.texture);

        if (entity.type === 'shape_rect') {
            obj.material = [matRight, matLeft, matTop, matBottom, matFront, matBack];
        } else if (entity.type === 'shape_circle') {
            obj.material = [matSides, matTop, matBottom];
        } else {
            obj.material = [matTop, matSides];
        }
        
        const hitbox = obj.children.find(c => c.userData.isHitbox);
        if (hitbox) {
            hitbox.geometry.dispose();
            hitbox.geometry = obj.geometry;
        }
        this.isUpdatingFromUI = false;
    }

    syncToUI() {
        if (!this.isUpdatingFromUI && this.interactions.selectedObject && (this.interactions.selectedObject.userData.isFurniture || this.interactions.selectedObject.userData.isShape || this.interactions.selectedObject.userData.isRoof)) {
            const obj3D = this.interactions.selectedObject;
            const ent2D = obj3D.userData.entity;
            if (ent2D && ent2D.group) { 
                ent2D.group.x(obj3D.position.x); 
                ent2D.group.y(obj3D.position.z); 
                ent2D.rotation = -obj3D.rotation.y * (180 / Math.PI);
                ent2D.rotationX = obj3D.rotation.x;
                ent2D.rotationZ = obj3D.rotation.z;
                ent2D.update(); 
            }
        }
        if (this.onEntityTransform) this.onEntityTransform();
    }

    rebuildActiveFloors() {
        if (!this.envBuilder) return;
        const floorMeshes = this.interactables.filter(m => m.userData && m.userData.isFloor);
        const floorCuts = this.interactables.filter(m => m.userData && m.userData.isFloorCutProxy).map(m => m.userData.entity);

        floorMeshes.forEach(floorMesh => {
            const room = floorMesh.userData.entity;
            if (!room || !room.path || room.path.length < 3) return;
            
            const floorShape = new THREE.Shape();
            floorShape.moveTo(room.path[0].x, room.path[0].y);
            for (let i = 1; i < room.path.length; i++) floorShape.lineTo(room.path[i].x, room.path[i].y);
            
            floorCuts.forEach(shape => {
                const rot = (shape.group ? shape.group.rotation() : (shape.rotation || 0)) * Math.PI / 180;
                const sx = shape.group ? shape.group.x() : (shape.x || shape.params?.x || 0);
                const sy = shape.group ? shape.group.y() : (shape.y || shape.params?.y || 0);
                let pts = shape.params?.points;
                if (!pts) {
                    const w = shape.params?.width || shape.width || 100;
                    const h = shape.params?.height || shape.height || 100;
                    pts = [ { x: -w/2, y: -h/2 }, { x: w/2, y: -h/2 }, { x: w/2, y: h/2 }, { x: -w/2, y: h/2 } ];
                }
                const rotC = pts.map(c => {
                    return {
                        x: sx + (c.x * Math.cos(rot) - c.y * Math.sin(rot)),
                        y: sy + (c.x * Math.sin(rot) + c.y * Math.cos(rot))
                    };
                });
                const hole = new THREE.Path();
                hole.moveTo(rotC[0].x, rotC[0].y);
                for (let i = 1; i < rotC.length; i++) hole.lineTo(rotC[i].x, rotC[i].y);
                hole.lineTo(rotC[0].x, rotC[0].y);
                floorShape.holes.push(hole);
            });
            
            if (floorMesh.geometry && !floorMesh.geometry.userData?.keepAlive) floorMesh.geometry.dispose();
            floorMesh.geometry = new THREE.ExtrudeGeometry(floorShape, { depth: 10, bevelEnabled: false });
            floorMesh.geometry.rotateX(Math.PI / 2);
            
            const pos = floorMesh.geometry.attributes.position;
            const uvs = new Float32Array(pos.count * 2);
            for (let i = 0; i < pos.count; i++) {
                uvs[i * 2] = pos.getX(i) / 100;
                uvs[i * 2 + 1] = -pos.getZ(i) / 100;
            }
            floorMesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        });
    }

    deepDispose(obj) {
        if (obj.userData && obj.userData.keepAlive) return;
        
        if (obj.geometry && !obj.geometry.userData?.keepAlive) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => { if (m && m.dispose && !m.userData?.keepAlive) m.dispose(); });
            } else {
                if (obj.material.dispose && !obj.material.userData?.keepAlive) obj.material.dispose();
            }
        }
        if (obj.children) [...obj.children].forEach(c => this.deepDispose(c));
    }

    buildScene(walls, rooms, stairs = [], furnitureList = [], roofs = [], shapes = [], levelsConfigArray = [], activeIndex = 0, viewMode3D = 'full-edit', preserveCamera = false) {
        this.deselectObject();
        this.interactables.length = 0;
        this.viewMode3D = viewMode3D;
        
        while(this.structureGroup.children.length > 0) { 
            const c = this.structureGroup.children[0]; 
            this.deepDispose(c); 
            this.structureGroup.remove(c); 
        }
        while(this.staticStructureGroup.children.length > 0) { 
            const c = this.staticStructureGroup.children[0]; 
            this.deepDispose(c); 
            this.staticStructureGroup.remove(c); 
        }

        let cumulativeHeight = 0;
        for (let i = 0; i < activeIndex; i++) {
            if (levelsConfigArray[i] && levelsConfigArray[i].data) {
                try {
                    const data = JSON.parse(levelsConfigArray[i].data);
                    let maxH = WALL_HEIGHT;
                    if (data.walls && data.walls.length > 0) {
                        maxH = Math.max(...data.walls.map(w => w.height !== undefined ? w.height : (w.config?.height || WALL_HEIGHT)));
                    }
                    cumulativeHeight += maxH;
                } catch(e) {
                    cumulativeHeight += WALL_HEIGHT;
                }
            } else {
                cumulativeHeight += WALL_HEIGHT;
            }
        }
        const targetY = cumulativeHeight;
        this.structureGroup.position.y = targetY;

        const activeLevelConfig = levelsConfigArray[activeIndex];
        const isActiveVisible = activeLevelConfig ? activeLevelConfig.isVisible : true;

        let stairsBelow = [];
        if (activeIndex > 0 && levelsConfigArray[activeIndex - 1] && levelsConfigArray[activeIndex - 1].data) {
            try {
                const prevData = JSON.parse(levelsConfigArray[activeIndex - 1].data);
                if (prevData.stairs) stairsBelow = prevData.stairs;
            } catch(e) {}
        }

        if (isActiveVisible) {
            this.envBuilder.buildActiveFloor(walls, rooms, shapes, stairs, stairsBelow);
            if (furnitureList) furnitureList.forEach(furn => this.furnitureManager.load(furn));

            if (roofs && roofs.length > 0) this.envBuilder.buildRoofs(roofs, activeIndex, walls, this.structureGroup);
            if (shapes && shapes.length > 0) this.envBuilder.buildShapes(shapes);
        }

        if (levelsConfigArray && levelsConfigArray.length > 0) {
            this.envBuilder.buildStaticFloors(levelsConfigArray, activeIndex, viewMode3D, stairs);
        }

        if (this.previousTargetY === undefined) this.previousTargetY = targetY;
        const diff = targetY - this.previousTargetY;

        if (preserveCamera) {
            if (diff !== 0 && viewMode3D !== 'full-edit') {
                this.controls.target.y += diff;
                this.camera.position.y += diff;
                this.controls.update();
            }
        } else {
            let centerX = 0, centerZ = 0;
            if (walls.length > 0) {
                walls.forEach(w => { const p = w.startAnchor ? w.startAnchor.position() : w; centerX += p.x || w.startX; centerZ += p.y || w.startY; });
                centerX /= walls.length; centerZ /= walls.length;
            }
            this.controls.target.set(centerX, targetY, centerZ); 
            
            const baseDir = new THREE.Vector3(1, 1, 1).normalize();
            const angle = this.cameraController.entranceAngle || 0;
            const dir = baseDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            
            // Using 1000 for distance to loosely match the previous +800,+600,+800
            this.camera.position.set(centerX + dir.x * 1280, targetY + Math.abs(dir.y) * 960, centerZ + dir.z * 1280); 
            this.controls.update(); 
        }
        this.previousTargetY = targetY;

        if (this.isXRayMode) {
            this.setXRayMode(true);
        }
    }
    
    setXRayMode(enabled) {
        this.isXRayMode = enabled;
        const applyXRay = (group) => {
            group.traverse((child) => {
                if (child.isMesh && child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(mat => {
                        if (mat.name === 'highlightMaterial' || mat.name === 'cutHighlightMaterial' || child.userData.isHighlight) return;
                        
                        if (mat._originalOpacity === undefined) {
                            mat._originalOpacity = mat.opacity;
                            mat._originalTransparent = mat.transparent;
                            mat._originalDepthWrite = mat.depthWrite;
                        }

                        if (enabled) {
                            mat.transparent = true;
                            mat.opacity = 0.3;
                            mat.depthWrite = false;
                        } else {
                            mat.opacity = mat._originalOpacity !== undefined ? mat._originalOpacity : 1;
                            mat.transparent = mat._originalTransparent !== undefined ? mat._originalTransparent : false;
                            mat.depthWrite = mat._originalDepthWrite !== undefined ? mat._originalDepthWrite : true;
                        }
                        mat.needsUpdate = true;
                    });
                }
            });
        };
        applyXRay(this.structureGroup);
        applyXRay(this.staticStructureGroup);
    }

    get selectedObject() { return this.interactions.selectedObject; }
}
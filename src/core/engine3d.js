import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { TransformControls } from './engine3d/TransformControls.js';
import { WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS, DOOR_TYPES, WINDOW_TYPES, WALL_DECOR_REGISTRY, WIDGET_REGISTRY, MOLDING_REGISTRY, DOOR_MATERIALS_REGISTRY } from './registry.js';
import { EnvironmentBuilder } from "./engine3d/engine3d.EnvironmentBuilder.js";
import { AssetManager  } from "./engine3d/engine3d.AssetManager.js";
import { DecorManager  } from "./engine3d/engine3d.DecorManager.js";
import { FurnitureManager  } from "./engine3d/engine3d.FurnitureManager.js";
import { InteractionSystem  } from "./engine3d/engine3d.InteractionSystem.js";
import { GizmoManager } from "./engine3d/engine3d.GizmoManager.js";


export class Preview3D {
    constructor(containerEl) {
        this.container = containerEl;
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
        
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.02; 

        this.interactables = [];
        this.isUpdatingFromUI = false;
        
        this.assets = new AssetManager();
        
        this.helpers = {
            getDynamicMaterial: (matId, category) => {
                let conf;
                if (category === 'door') conf = DOOR_MATERIALS[matId] || DOOR_MATERIALS_REGISTRY[matId] || DOOR_MATERIALS.wood;
                else if (category === 'window_frame') conf = WINDOW_FRAME_MATERIALS[matId] || DOOR_MATERIALS_REGISTRY[matId] || WALL_DECOR_REGISTRY[matId] || WINDOW_FRAME_MATERIALS.alum_powder;
                else if (category === 'window_glass') conf = WINDOW_GLASS_MATERIALS[matId] || WINDOW_GLASS_MATERIALS.clear;
                
                if (!conf) return new THREE.MeshStandardMaterial();
                
                let mat;
                if (conf.transmission) {
                    mat = new THREE.MeshPhysicalMaterial({
                        color: conf.color || 0xffffff,
                        roughness: conf.roughness !== undefined ? conf.roughness : 0.5,
                        metalness: conf.metalness !== undefined ? conf.metalness : 0.1,
                        transmission: conf.transmission,
                        ior: conf.ior || 1.5,
                        transparent: true
                    });
                } else {
                    mat = new THREE.MeshStandardMaterial({
                        color: conf.color || 0xffffff,
                        roughness: conf.roughness !== undefined ? conf.roughness : 0.5,
                        metalness: conf.metalness !== undefined ? conf.metalness : 0.1,
                        transparent: conf.transparent || false,
                        opacity: conf.opacity !== undefined ? conf.opacity : 1
                    });
                }
                
                if ((category === 'door' || category === 'window_frame') && (DOOR_MATERIALS_REGISTRY[matId] || WALL_DECOR_REGISTRY[matId]) && this.assets) {
                    const texConf = DOOR_MATERIALS_REGISTRY[matId] || WALL_DECOR_REGISTRY[matId];
                    this.assets.getTexture(texConf).then(tex => {
                        const texClone = tex.clone();
                        texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                        // For thin frames/panels, a vertical repeat works best
                        texClone.repeat.set(1, 2); 
                        mat.map = texClone;
                        mat.color.setHex(0xffffff); // clear base color to let texture show
                        mat.needsUpdate = true;
                    });
                }
                
                return mat;
            },
            getFaceMaterials: (entity, baseMaterial, dimensions) => {
                let matSides = baseMaterial.clone();
                let matTop = baseMaterial.clone();
                let matBottom = baseMaterial.clone();
                let matLeft = baseMaterial.clone();
                let matRight = baseMaterial.clone();
                let matFront = baseMaterial.clone();
                let matBack = baseMaterial.clone();

                const applyTex = (mat, texKey) => {
                    if (!texKey) return;

                    const config = WALL_DECOR_REGISTRY[texKey] || DOOR_MATERIALS_REGISTRY[texKey];
                    if (config) {
                        this.assets.getTexture(config).then(tex => {
                            const texClone = tex.clone();
                            texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                            
                            if (DOOR_MATERIALS_REGISTRY[texKey]) {
                                texClone.repeat.set(1, 2);
                            } else {
                                const tileSize = config.defaultTileSize || 40;
                                const maxDim = Math.max(dimensions?.width || 100, dimensions?.height || 100);
                                texClone.repeat.set(maxDim / tileSize, maxDim / tileSize);
                            }
                            
                            mat.map = texClone;
                            mat.color.setHex(0xffffff); // Revert to white once texture loads
                            mat.needsUpdate = true;
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
                    applyTex(matTop, resolveTex('textureTop', 'texture'));
                    applyTex(matBottom, resolveTex('textureBottom', 'texture'));
                    applyTex(matSides, resolveTex('textureSides', 'texture'));
                    applyTex(matLeft, resolveTex('textureLeft', 'textureSides', 'texture'));
                    applyTex(matRight, resolveTex('textureRight', 'textureSides', 'texture'));
                    applyTex(matFront, resolveTex('textureFront', 'textureSides', 'texture'));
                    applyTex(matBack, resolveTex('textureBack', 'textureSides', 'texture'));
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

        this.gizmoManager = new GizmoManager(this);
        this.gizmoManager.init();

        this.interactions.transformControls.addEventListener('change', () => {
            if (this.currentTransformMode === 'place' && this.gizmoManager.inputX && this.interactions.selectedObject) {
                this.gizmoManager.inputX.value = this.interactions.selectedObject.position.x.toFixed(1);
                this.gizmoManager.inputY.value = this.interactions.selectedObject.position.z.toFixed(1);
                if (this.gizmoManager.inputZ && this.interactions.selectedObject.userData.entity) {
                    this.gizmoManager.inputZ.value = (this.interactions.selectedObject.userData.entity.elevation || 0).toFixed(1);
                }
            }
        });

        this.envBuilder.setupBaseEnvironment();
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer); 
        pmremGenerator.compileEquirectangularShader(); 
        this.scene.environment = pmremGenerator.fromScene(new THREE.Scene()).texture;

        window.addEventListener('resize', () => this.resize()); 
        this.animate();
    }

    resize() {
        if (this.container.style.display !== 'none') { 
            const w = this.container.clientWidth > 0 ? this.container.clientWidth : window.innerWidth; 
            const h = this.container.clientHeight > 0 ? this.container.clientHeight : window.innerHeight; 
            this.camera.aspect = w / h; 
            this.camera.updateProjectionMatrix(); 
            this.renderer.setSize(w, h); 
        }
    }

    animate() { 
        requestAnimationFrame(() => this.animate()); 
        this.controls.update(); 
        this.renderer.render(this.scene, this.camera); 
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

    setEnvironment(skyKey, groundKey) { this.envBuilder.setEnvironment(skyKey, groundKey); }
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
        if (!entity || !entity.mesh3D || this.isUpdatingFrom3D) return;
        const obj = entity.mesh3D;
        const parent = obj.parent;
        if (!parent) return;

        let renderFunc = null;
        if (WIDGET_REGISTRY[entity.type]) renderFunc = WIDGET_REGISTRY[entity.type].render3D;
        else if (MOLDING_REGISTRY[entity.type]) renderFunc = MOLDING_REGISTRY[entity.type].render3D;
        else if (entity.type === 'pattern' && window.PATTERN_REGISTRY && window.PATTERN_REGISTRY[entity.patternType]) renderFunc = window.PATTERN_REGISTRY[entity.patternType].render3D;

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
            }
        }
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
        } else if (entity.type === 'shape_triangle' || entity.type === 'shape_polygon') {
            const shape2d = new THREE.Shape();
            if (entity.params.points && entity.params.points.length >= 3) {
                const pts = entity.params.points;
                shape2d.moveTo(pts[0].x, pts[0].y);
                for(let i=1; i<pts.length; i++) shape2d.lineTo(pts[i].x, pts[i].y);
                shape2d.lineTo(pts[0].x, pts[0].y);
                obj.geometry.dispose();
                obj.geometry = new THREE.ExtrudeGeometry(shape2d, { depth: h, bevelEnabled: false });
                obj.geometry.rotateX(Math.PI / 2);
                obj.geometry.translate(0, h, 0);
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
        
        obj.position.set(entity.group.x(), 0, entity.group.y());
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
            this.camera.position.set(centerX, targetY + 600, centerZ + 800); 
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
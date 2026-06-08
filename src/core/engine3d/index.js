import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { WALL_HEIGHT } from '../registry.js';
import { WIDGET_REGISTRY, WALL_DECOR_REGISTRY } from '../registry.js';

// Import our specialized SOLID Managers
import { AssetManager } from './AssetManager.js';
import { BaseSceneSetup } from './BaseSceneSetup.js';
import { DecorManager } from './DecorManager.js';
import { FurnitureManager } from './FurnitureManager.js';
import { InteractionSystem } from './InteractionSystem.js';
import { ActiveFloor } from './ActiveFloor.js';
import { StaticFloors } from './StaticFloors.js';
import { Stair3DBuilder } from './Stair3DBuilder.js';

export class Preview3D {
    constructor(containerEl) {
        this.container = containerEl;
        this.scene = new THREE.Scene();
        this.structureGroup = new THREE.Group();
        this.staticStructureGroup = new THREE.Group();
        this.scene.add(this.structureGroup);
        this.scene.add(this.staticStructureGroup);
        
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        
        this.camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace; 
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Infinity; // Allow looking from underneath
        this.controls.screenSpacePanning = true; // Enable panning
        this.controls.enableRotate = true; // Explicitly enable rotate
        this.controls.enablePan = true; // Explicitly enable pan
        this.controls.enableZoom = true; // Explicitly enable zoom

        // Shared Global State
        this.interactables = [];
        this.viewMode3D = 'full-edit';

        // 1. Setup Base Environment
        this.assets = new AssetManager();
        this.sceneSetup = new BaseSceneSetup(this.scene);
        this.sceneSetup.setup();

        // 2. Initialize Dependency Injected Managers
        this.decorManager = new DecorManager(this.assets, this.interactables);
        
        this.interactions = new InteractionSystem(
            this.camera, this.renderer, this.scene, this.structureGroup, this.interactables, 
            {
                onLevelSwitchRequest: (lvl, ent, type) => { if(this.onLevelSwitchRequest) this.onLevelSwitchRequest(lvl, ent, type) },
                onEntitySelect: (ent, type, side) => { if(this.onEntitySelect) this.onEntitySelect(ent, type, side) },
                onRelocateStateChange: (state) => { if(this.onRelocateStateChange) this.onRelocateStateChange(state) },
                syncToUI: () => this.syncToUI(),
                updateWallDecorLive: (decor) => this.decorManager.updateLive(decor)
            }
        );

        this.furnitureManager = new FurnitureManager(this.assets, this.structureGroup, this.interactables, {
            onAutoSelect: (entity, wrapper) => {
                if (this.interactions.selectedObject && this.interactions.selectedObject.userData.entity === entity) {
                    this.interactions.selectObject(wrapper);
                }
            }
        });
        
        // 3. Initialize Floor Builders
        this.activeFloorBuilder = new ActiveFloor(this.assets, this.decorManager, this.interactables, this.structureGroup, { updatePatternLive: (w) => this.updatePatternLive(w) });
        this.staticFloorBuilder = new StaticFloors(this.assets, this.decorManager, this.interactables, { updatePatternLive: (w) => this.updatePatternLive(w) });
        this.stairBuilder = new Stair3DBuilder(this.assets, this.interactables);

        // Env Maps
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer); 
        pmremGenerator.compileEquirectangularShader(); 
        this.scene.environment = pmremGenerator.fromScene(new THREE.Scene()).texture;

        window.addEventListener('resize', () => this.resize()); 
        this.animate();
    }

    resize() {
        if (this.container.style.display !== 'none') { 
            const w = this.container.clientWidth || window.innerWidth; 
            const h = this.container.clientHeight || window.innerHeight; 
            if (this.camera.isPerspectiveCamera) {
                this.camera.aspect = w / h;
            } else if (this.camera.isOrthographicCamera) {
                const frustumHeight = this.camera.top - this.camera.bottom;
                const aspect = w / h;
                this.camera.left = -frustumHeight * aspect / 2;
                this.camera.right = frustumHeight * aspect / 2;
            }
            this.camera.updateProjectionMatrix(); 
            this.renderer.setSize(w, h); 
        }
    }

    animate() { 
        requestAnimationFrame(() => this.animate()); 
        this.controls.update(); 
        if (this.interactions && this.interactions.transformControls) {
            this.interactions.transformControls.camera = this.camera;
            this.interactions.transformControls.update();
        }
        this.renderer.render(this.scene, this.camera); 
    }

    // --- Vue API Bridge Methods ---

    setEnvironment(skyKey, groundKey) {
        if (this.sceneSetup) {
            if (skyKey) this.sceneSetup.setSky(skyKey);
            if (groundKey) this.sceneSetup.setGround(groundKey);
        }
    }

    setInteractionMode(mode) { 
        this.interactions.setMode(mode); 
        this.controls.enableRotate = (mode === 'camera' && !this.camera.isOrthographicCamera);
        this.renderer.domElement.style.cursor = (mode === 'camera') ? 'grab' : 'auto';
    }
    
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

    syncToUI() {
        if (!this.isUpdatingFromUI && this.interactions.selectedObject && this.interactions.selectedObject.userData.isFurniture) {
            const obj3D = this.interactions.selectedObject;
            const ent2D = obj3D.userData.entity;
            if (ent2D) {
                if (ent2D.group) { 
                    ent2D.group.x(obj3D.position.x); 
                    ent2D.group.y(obj3D.position.z); 
                    ent2D.rotation = -obj3D.rotation.y * (180 / Math.PI);
                    ent2D.update(); 
                }
                
                const origSize = obj3D.userData.originalSize;
                if (origSize) {
                    if (ent2D.width !== undefined) ent2D.width = obj3D.scale.x * origSize.x;
                    if (ent2D.depth !== undefined) ent2D.depth = obj3D.scale.z * origSize.z;
                    if (ent2D.height !== undefined) ent2D.height = obj3D.scale.y * origSize.y;
                    
                    if (ent2D.params) {
                        if (ent2D.params.width !== undefined) ent2D.params.width = obj3D.scale.x * origSize.x;
                        if (ent2D.params.height !== undefined) ent2D.params.height = obj3D.scale.z * origSize.z;
                        if (ent2D.params.height3D !== undefined) ent2D.params.height3D = obj3D.scale.y * origSize.y;
                        if (ent2D.params.radius !== undefined) ent2D.params.radius = (obj3D.scale.x * origSize.x) / 2;
                    }
                }
            }
        }
        if (this.onEntityTransform) this.onEntityTransform();
    }

    deepDispose(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
        if (obj.children) [...obj.children].forEach(c => this.deepDispose(c));
    }

    buildScene(walls, roomPaths, stairs = [], furnitureList = [], roofs = [], shapes = [], levelsConfigArray = [], activeIndex = 0, viewMode3D = 'full-edit', preserveCamera = false) {
        this.deselectObject();
        this.interactables.length = 0; 
        this.viewMode3D = viewMode3D;
        
        this.interactions.setViewMode3D(viewMode3D);
        this.decorManager.setPreviewMode(viewMode3D === 'preview');
        
        while(this.structureGroup.children.length > 0) { 
            const c = this.structureGroup.children[0]; 
            this.deepDispose(c); this.structureGroup.remove(c); 
        }
        while(this.staticStructureGroup.children.length > 0) { 
            const c = this.staticStructureGroup.children[0]; 
            this.deepDispose(c); this.staticStructureGroup.remove(c); 
        }

        const targetY = activeIndex * WALL_HEIGHT;
        this.structureGroup.position.y = targetY;

        let px = 0, py = 0, rot = 0;
        if (walls && walls.length > 0 && walls[0].planner && walls[0].planner.settings) {
            rot = walls[0].planner.settings.houseRotation || 0;
            px = walls[0].planner.settings.housePivotX || 0;
            py = walls[0].planner.settings.housePivotY || 0;
        }

        // Active Floor Hierarchy
        const activePivot = new THREE.Group();
        activePivot.position.set(px, 0, py);
        activePivot.rotation.y = THREE.MathUtils.degToRad(-rot);
        
        const activeOffset = new THREE.Group();
        activeOffset.position.set(-px, 0, -py);
        activePivot.add(activeOffset);
        this.structureGroup.add(activePivot);

        // Static Floors Hierarchy
        const staticPivot = new THREE.Group();
        staticPivot.position.set(px, 0, py);
        staticPivot.rotation.y = THREE.MathUtils.degToRad(-rot);
        
        const staticOffset = new THREE.Group();
        staticOffset.position.set(-px, 0, -py);
        staticPivot.add(staticOffset);
        this.staticStructureGroup.add(staticPivot);

        const activeLevelConfig = levelsConfigArray[activeIndex];
        const isActiveVisible = activeLevelConfig ? activeLevelConfig.isVisible : true;

        // BUILD ACTIVE (Pass the offset groups instead of the root groups)
        if (isActiveVisible) {
            this.activeFloorBuilder.build(walls, roomPaths, roofs, shapes, stairs, activeIndex, activeOffset);
            if (furnitureList) furnitureList.forEach(furn => this.furnitureManager.load(furn, activeOffset));
            this.stairBuilder.build(stairs, activeOffset, activeIndex);
        }

        // BUILD STATIC
        if (levelsConfigArray.length > 0) {
            this.staticFloorBuilder.build(levelsConfigArray, activeIndex, viewMode3D, staticOffset);
        }

        // CAMERA PANNING
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
            this.camera.position.set(centerX + 800, targetY + 500, centerZ + 800); // More flexible initial camera
            this.controls.update(); 
        }
        this.previousTargetY = targetY;
    }
    
    get selectedObject() { return this.interactions.selectedObject; }
}
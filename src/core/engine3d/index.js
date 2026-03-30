import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { WALL_HEIGHT } from '../registry.js';

// Import our specialized SOLID Managers
import { AssetManager } from './AssetManager.js';
import { BaseSceneSetup } from './BaseSceneSetup.js';
import { DecorManager } from './DecorManager.js';
import { FurnitureManager } from './FurnitureManager.js';
import { InteractionSystem } from './InteractionSystem.js';
import { ActiveFloor } from './ActiveFloor.js';
import { StaticFloors } from './StaticFloors.js';

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
        this.controls.maxPolarAngle = Math.PI / 2 - 0.02; 

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
        this.activeFloorBuilder = new ActiveFloor(this.decorManager, this.interactables, this.structureGroup);
        this.staticFloorBuilder = new StaticFloors(this.decorManager, this.interactables);

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
            this.camera.aspect = w / h; 
            this.camera.updateProjectionMatrix(); 
            this.renderer.setSize(w, h); 
        }
    }

    animate() { 
        requestAnimationFrame(() => this.animate()); 
        this.controls.update(); 
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
        this.controls.enableRotate = (mode === 'camera');
        this.renderer.domElement.style.cursor = (mode === 'camera') ? 'grab' : 'auto';
    }
    
    cancelRelocation() { this.interactions.cancelRelocation(); }
    selectObject(obj) { this.interactions.selectObject(obj); }
    deselectObject() { this.interactions.deselect(); }
    
    addWallPattern(w, id, s) { return this.decorManager.add(w, id, s); }
    updateWallDecorLive(e) { this.decorManager.updateLive(e); }
    updateFurnitureLive(e) { this.furnitureManager.updateLive(e); }
    
    syncToUI() {
        if (this.interactions.selectedObject && this.interactions.selectedObject.userData.isFurniture) {
            const ent = this.interactions.selectedObject.userData.entity;
            if (ent && ent.group) { ent.group.x(this.interactions.selectedObject.position.x); ent.group.y(this.interactions.selectedObject.position.z); ent.update(); }
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

    buildScene(walls, roomPaths, stairs = [], furnitureList = [], roofs = [], levelsJsonArray = [], activeIndex = 0, viewMode3D = 'full-edit', preserveCamera = false) {
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

        // BUILD ACTIVE
        this.activeFloorBuilder.build(walls, roomPaths, roofs, activeIndex);
        if (furnitureList) furnitureList.forEach(furn => this.furnitureManager.load(furn));

        // BUILD STATIC
        if (viewMode3D !== 'isolate' && levelsJsonArray.length > 0) {
            this.staticFloorBuilder.build(levelsJsonArray, activeIndex, viewMode3D, this.staticStructureGroup);
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
            this.camera.position.set(centerX, targetY + 600, centerZ + 800); 
            this.controls.update(); 
        }
        this.previousTargetY = targetY;
    }
    
    get selectedObject() { return this.interactions.selectedObject; }
}
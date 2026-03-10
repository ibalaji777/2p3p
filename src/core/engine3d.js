import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS } from './registry.js';

export class Preview3D {
    constructor(containerEl) {
        this.container = containerEl;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf3f4f6); 
        this.scene.fog = new THREE.FogExp2(0xf3f4f6, 0.0008); 
        
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
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.container.appendChild(this.renderer.domElement);
        
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Lock camera from going beneath floor
        
        this.generateEnvironmentMap();
        this.initLighting();
        this.createProfessionalGrid();
        
        this.structureGroup = new THREE.Group(); 
        this.scene.add(this.structureGroup);
        
        this.proceduralTextures = {}; 
        this.modelCache = {}; 
        
        // --- NEW STATE MACHINE (SELECT -> MOVE -> DROP) ---
        this.interactionMode = 'edit'; 
        this.controls.enabled = false; // Lock camera in edit mode
        
        this.interactableObjects = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.dragOffset = new THREE.Vector3();
        
        this.selectedObject = null;
        this.isPlacing = false; // True when object is attached to mouse
        
        // 1. Rectangular Highlight Box (Selection)
        const dummyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
        this.selectionBox = new THREE.BoxHelper(dummyMesh, 0x3b82f6); 
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);

        // 2. Floor Footprint Highlight (Placement)
        const dropGeo = new THREE.PlaneGeometry(1, 1);
        const dropMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
        this.dropHighlight = new THREE.Mesh(dropGeo, dropMat);
        this.dropHighlight.rotation.x = -Math.PI / 2; 
        this.dropHighlight.position.y = 0.5; // Hover slightly above floor to prevent Z-fighting
        this.dropHighlight.visible = false;
        this.scene.add(this.dropHighlight);

        this.isUpdatingFromUI = false;
        this.isUpdatingFrom3D = false;

        this.initInteraction();

        // Vue Callbacks
        this.onFurnitureSelect = null;
        this.onFurnitureDoubleClick = null;
        this.onFurnitureTransform = null;
        this.onRelocateStateChange = null; 

        window.addEventListener('resize', () => this.resize()); 
        this.animate();
    }

    setInteractionMode(mode) {
        this.interactionMode = mode;
        if (mode === 'camera') {
            this.controls.enabled = true; // Allow room spinning
            this.cancelRelocation();
            this.deselectObject();
            this.renderer.domElement.style.cursor = 'auto';
        } else if (mode === 'edit') {
            this.controls.enabled = false; // Lock camera completely
            this.renderer.domElement.style.cursor = 'auto';
        }
    }

    createProfessionalGrid() {
        const groundGeo = new THREE.PlaneGeometry(10000, 10000); 
        const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 }); 
        const ground = new THREE.Mesh(groundGeo, groundMat); 
        ground.rotation.x = -Math.PI / 2; 
        ground.receiveShadow = true; 
        this.scene.add(ground);

        const grid = new THREE.GridHelper(5000, 250, 0x000000, 0x000000);
        grid.material.opacity = 0.05;
        grid.material.transparent = true;
        this.scene.add(grid);
    }

    updateMouseCoords(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    initInteraction() {
        // --- 1. SINGLE CLICK (SELECT OR DROP) ---
        this.renderer.domElement.addEventListener('pointerdown', (event) => {
            if (this.interactionMode !== 'edit') return; 
            if (event.button !== 0) return; 

            this.updateMouseCoords(event);

            // STATE A: User is currently moving an object -> Click to DROP
            if (this.isPlacing && this.selectedObject) {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    const newPos = target.add(this.dragOffset);
                    this.selectedObject.position.set(newPos.x, 0, newPos.z);
                    this.selectionBox.update();
                    
                    this.setRelocationState(false); // Stop moving
                    
                    // Sync to 2D UI
                    if (!this.isUpdatingFromUI) {
                        this.isUpdatingFrom3D = true;
                        const entity = this.selectedObject.userData.entity;
                        if (entity && entity.group) {
                            entity.group.x(newPos.x);
                            entity.group.y(newPos.z); 
                            entity.update();
                        }
                        if (this.onFurnitureTransform) this.onFurnitureTransform();
                        this.isUpdatingFrom3D = false;
                    }
                }
                return;
            }

            // STATE B: Click an object to SELECT or PICK UP
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);

            if (intersects.length > 0) {
                let mesh = intersects[0].object;
                while (mesh.parent && !mesh.userData.isFurniture) {
                    mesh = mesh.parent; // Traverse to root
                }
                
                if (mesh && mesh.userData.isFurniture) {
                    if (this.selectedObject === mesh) {
                        // Clicked an ALREADY selected object -> PICK IT UP
                        this.setRelocationState(true);
                        
                        const target = new THREE.Vector3();
                        if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                            this.dragOffset.copy(mesh.position).sub(target);
                        }
                    } else {
                        // Clicked a NEW object -> SELECT IT
                        this.selectObject(mesh);
                    }
                }
            } else {
                this.deselectObject(); // Clicked empty floor
            }
        });

        // --- 2. DOUBLE CLICK (OPEN PROPERTIES) ---
        this.renderer.domElement.addEventListener('dblclick', (event) => {
            if (this.interactionMode !== 'edit') return;
            if (event.button !== 0) return;

            this.updateMouseCoords(event);
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);

            if (intersects.length > 0) {
                let mesh = intersects[0].object;
                while (mesh.parent && !mesh.userData.isFurniture) {
                    mesh = mesh.parent;
                }
                if (mesh && mesh.userData.isFurniture) {
                    this.selectObject(mesh);
                    if (this.onFurnitureDoubleClick) this.onFurnitureDoubleClick(mesh.userData.entity);
                }
            }
        });

        // --- 3. MOUSE MOVE (LIVE PREVIEW) ---
        this.renderer.domElement.addEventListener('pointermove', (event) => {
            if (this.interactionMode !== 'edit') return;
            this.updateMouseCoords(event);

            if (this.isPlacing && this.selectedObject) {
                // Object is actively attached to mouse
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    const newPos = target.add(this.dragOffset);
                    
                    // Move 3D object and selection box
                    this.selectedObject.position.set(newPos.x, 0, newPos.z);
                    this.selectionBox.update();
                    
                    // Move floor highlight footprint
                    this.dropHighlight.position.set(newPos.x, 0.5, newPos.z);

                    // Live sync for smooth UI
                    if (!this.isUpdatingFromUI) {
                        this.isUpdatingFrom3D = true;
                        const entity = this.selectedObject.userData.entity;
                        if (entity && entity.group) {
                            entity.group.x(newPos.x);
                            entity.group.y(newPos.z);
                            entity.update();
                        }
                        if (this.onFurnitureTransform) this.onFurnitureTransform();
                        this.isUpdatingFrom3D = false;
                    }
                }
            } else {
                // Hover pointer effect
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);
                this.renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'auto';
            }
        });
    }

    setRelocationState(isRelocating) {
        this.isPlacing = isRelocating;
        if (isRelocating && this.selectedObject) {
            const entity = this.selectedObject.userData.entity;
            this.dropHighlight.scale.set(entity.width, entity.depth, 1);
            this.dropHighlight.visible = true; // Show floor footprint
        } else {
            this.dropHighlight.visible = false;
        }
        if (this.onRelocateStateChange) this.onRelocateStateChange(this.isPlacing);
    }

    cancelRelocation() {
        if (this.isPlacing) {
            this.setRelocationState(false);
        }
    }

    selectObject(object) {
        this.selectedObject = object;
        this.selectionBox.setFromObject(object);
        this.selectionBox.visible = true; // Show Rectangle Box
        if (this.onFurnitureSelect) this.onFurnitureSelect(object.userData.entity);
    }

    deselectObject() {
        this.cancelRelocation();
        this.selectedObject = null;
        this.selectionBox.visible = false;
        if (this.onFurnitureSelect) this.onFurnitureSelect(null);
    }

    updateFurnitureLive(entity) {
        if (this.isUpdatingFrom3D) return;
        if (!entity || !entity.mesh3D) return;
        
        this.isUpdatingFromUI = true;
        const object = entity.mesh3D;

        object.position.set(entity.group.x(), 0, entity.group.y());
        object.rotation.y = -entity.rotation * (Math.PI / 180);
        
        const origSize = object.userData.originalSize;
        object.scale.set(entity.width / origSize.x, entity.height / origSize.y, entity.depth / origSize.z);
        object.updateMatrixWorld();

        if (this.selectionBox.visible && this.selectedObject === object) {
            this.selectionBox.update();
        }
        if (this.isPlacing && this.selectedObject === object) {
            this.dropHighlight.scale.set(entity.width, entity.depth, 1);
        }
        
        this.isUpdatingFromUI = false;
    }

    initLighting() {
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 3.0); hemiLight.position.set(0, 500, 0); this.scene.add(hemiLight);
        const sunLight = new THREE.DirectionalLight(0xfffaed, 5.0); sunLight.position.set(300, 600, 400); sunLight.castShadow = true; sunLight.shadow.mapSize.width = 2048; sunLight.shadow.mapSize.height = 2048; sunLight.shadow.camera.near = 10; sunLight.shadow.camera.far = 2000; sunLight.shadow.bias = -0.0005; const d = 800; sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d; sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d; this.scene.add(sunLight);
    }
    
    generateEnvironmentMap() { const pmremGenerator = new THREE.PMREMGenerator(this.renderer); pmremGenerator.compileEquirectangularShader(); this.scene.environment = pmremGenerator.fromScene(new THREE.Scene()).texture; }
    resize() { if (this.container.style.display !== 'none') { const w = this.container.clientWidth > 0 ? this.container.clientWidth : window.innerWidth; const h = this.container.clientHeight > 0 ? this.container.clientHeight : window.innerHeight; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); } }
    animate() { requestAnimationFrame(() => this.animate()); this.controls.update(); this.renderer.render(this.scene, this.camera); }
    getProceduralTexture(type, colorHex) { /* Kept Native */ }
    getDynamicMaterial(matKey, category = 'door') { /* Kept Native */ }
    createElevation3DTexture(layers, wallLen) { /* Kept Native */ }

    buildScene(walls, roomPaths, stairs = [], furnitureList = [], activeEntity = null) {
        this.deselectObject();
        this.interactableObjects = []; 
        this.activeEntityOnLoad = activeEntity;

        while(this.structureGroup.children.length > 0) { 
            const child = this.structureGroup.children[0]; 
            if(child.geometry) child.geometry.dispose(); 
            this.structureGroup.remove(child); 
        }
        
        let centerX = 0, centerZ = 0, count = 0; 
        const matEdgeDark = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.8 }), matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 }); 
        
        roomPaths.forEach(path => { const floorShape = new THREE.Shape(); floorShape.moveTo(path[0].x, path[0].y); for(let i=1; i<path.length; i++) floorShape.lineTo(path[i].x, path[i].y); const floorGeo = new THREE.ShapeGeometry(floorShape); floorGeo.rotateX(-Math.PI / 2); const floorMesh = new THREE.Mesh(floorGeo, matFloor); floorMesh.position.y = 1; floorMesh.receiveShadow = true; this.structureGroup.add(floorMesh); });
        
        walls.forEach(w => {
            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position(), dx = p2.x - p1.x, dz = p2.y - p1.y, length = Math.hypot(dx, dz), angle = Math.atan2(dz, dx); centerX += p1.x + dx/2; centerZ += p1.y + dz/2; count++;
            const wallShape = new THREE.Shape(); wallShape.moveTo(0, 0); wallShape.lineTo(length, 0); wallShape.lineTo(length, WALL_HEIGHT); wallShape.lineTo(0, WALL_HEIGHT); wallShape.lineTo(0, 0);
            w.attachedWidgets.forEach(widg => { const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2; if (widg.type === 'door') { hole.moveTo(wCenter - halfW, 0); hole.lineTo(wCenter + halfW, 0); hole.lineTo(wCenter + halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, 0); } else if (widg.type === 'window') { hole.moveTo(wCenter - halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL); } wallShape.holes.push(hole); });
            const halfThick = w.config.thickness / 2;
            const extrudeOpts = { depth: halfThick, bevelEnabled: false };
            const matFrontMain = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9 }), matBackMain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
            const geoFront = new THREE.ExtrudeGeometry(wallShape, extrudeOpts), meshFront = new THREE.Mesh(geoFront, [matFrontMain, matEdgeDark]); meshFront.position.set(p1.x, 0, p1.y); meshFront.rotation.y = -angle; meshFront.castShadow = true; meshFront.receiveShadow = true; this.structureGroup.add(meshFront);
            const geoBack = new THREE.ExtrudeGeometry(wallShape, extrudeOpts); geoBack.translate(0, 0, -halfThick); const meshBack = new THREE.Mesh(geoBack, [matBackMain, matEdgeDark]); meshBack.position.set(p1.x, 0, p1.y); meshBack.rotation.y = -angle; meshBack.castShadow = true; meshBack.receiveShadow = true; this.structureGroup.add(meshBack);
            w.attachedWidgets.forEach(widg => { const wcx = p1.x + dx * widg.t, wcz = p1.y + dz * widg.t; const entityData = { ...widg, x: wcx, z: wcz, angle: angle, thick: w.config.thickness }; const definition = WIDGET_REGISTRY[widg.type]; if (definition && definition.render3D) definition.render3D(this.structureGroup, entityData, this); });
        });

        if (furnitureList) {
            furnitureList.forEach(furn => this.loadAndPlaceFurniture(furn));
        }

        if (count > 0) { centerX /= count; centerZ /= count; } 
        else if (furnitureList && furnitureList.length > 0) { centerX = furnitureList[0].group.x(); centerZ = furnitureList[0].group.y(); } 
        else { centerX = this.container.clientWidth / 2; centerZ = this.container.clientHeight / 2; }
        
        this.controls.target.set(centerX, 0, centerZ); 
        this.camera.position.set(centerX, 400, centerZ + 500); 
        this.controls.update(); 
    }

    async loadAndPlaceFurniture(entity) {
        const config = FURNITURE_REGISTRY[entity.config.id];
        try {
            if (!this.modelCache[config.id]) {
                const loader = new GLTFLoader();
                const gltf = await loader.loadAsync(config.model);
                this.modelCache[config.id] = gltf.scene;
            }
            
            const gltfScene = this.modelCache[config.id].clone();
            const wrapper = new THREE.Group();
            wrapper.add(gltfScene);
            
            const box = new THREE.Box3().setFromObject(gltfScene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            gltfScene.position.set(-center.x, -box.min.y, -center.z);

            const safeW = size.x > 0 ? size.x : 1; 
            const safeH = size.y > 0 ? size.y : 1; 
            const safeD = size.z > 0 ? size.z : 1;

            wrapper.scale.set(entity.width / safeW, entity.height / safeH, entity.depth / safeD);
            wrapper.position.set(entity.group.x(), 0, entity.group.y());
            wrapper.rotation.y = -entity.rotation * (Math.PI / 180);

            // Push actual geometry into interactableObjects so Raycaster works flawlessly
            wrapper.traverse((child) => { 
                if (child.isMesh) { 
                    child.castShadow = true; 
                    child.receiveShadow = true; 
                    this.interactableObjects.push(child);
                } 
            });

            wrapper.userData = { isFurniture: true, entity: entity, originalSize: new THREE.Vector3(safeW, safeH, safeD) };
            entity.mesh3D = wrapper;
            
            this.structureGroup.add(wrapper);

            if (this.activeEntityOnLoad === entity) this.selectObject(wrapper);

        } catch (error) {
            console.error(`Failed to load GLB model: ${config.model}`, error);
        }
    }
}
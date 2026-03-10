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
        
        // CAMERA CONTROLS
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent going beneath floor
        
        this.generateEnvironmentMap();
        this.initLighting();
        this.createProfessionalGrid();
        
        this.structureGroup = new THREE.Group(); 
        this.scene.add(this.structureGroup);
        
        this.proceduralTextures = {}; 
        this.modelCache = {}; 
        
        // --- 3 ISOLATED MODES ('camera', 'edit', 'adjust') ---
        this.interactionMode = 'adjust'; 
        this.controls.enableRotate = false; // Lock camera initially
        
        this.interactableObjects = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.dragOffset = new THREE.Vector3();
        
        this.selectedObject = null;
        this.isPlacing = false; 
        
        // 1. Rectangular Highlight Box (Selection)
        const dummyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
        this.selectionBox = new THREE.BoxHelper(dummyMesh, 0x3b82f6); 
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);

        // 2. Floor Footprint Highlight (Placement)
        this.dropGroup = new THREE.Group();
        const dropGeo = new THREE.PlaneGeometry(1, 1);
        const dropMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
        this.dropHighlight = new THREE.Mesh(dropGeo, dropMat);
        this.dropHighlight.rotation.x = -Math.PI / 2; 
        this.dropGroup.add(this.dropHighlight);
        this.scene.add(this.dropGroup);
        this.dropGroup.visible = false;

        this.isUpdatingFromUI = false;
        this.isUpdatingFrom3D = false;

        this.initInteraction();

        // Vue Callbacks
        this.onFurnitureSelect = null;
        this.onFurnitureTransform = null;
        this.onRelocateStateChange = null; 

        window.addEventListener('resize', () => this.resize()); 
        this.animate();
    }

    setInteractionMode(mode) {
        this.interactionMode = mode;
        this.cancelRelocation(); // Cancel placement if switching modes

        if (mode === 'camera') {
            this.controls.enableRotate = true; // Allow room spinning
            this.deselectObject();
            this.renderer.domElement.style.cursor = 'grab';
        } else {
            this.controls.enableRotate = false; // Lock camera for Edit & Adjust
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
        // --- POINTER DOWN ---
        this.renderer.domElement.addEventListener('pointerdown', (event) => {
            if (this.interactionMode === 'camera') return; 
            if (event.button !== 0) return; 

            this.updateMouseCoords(event);

            // ==========================================
            // ADJUSTMENT MODE (Click to pickup, click to drop)
            // ==========================================
            if (this.interactionMode === 'adjust') {
                if (this.isPlacing && this.selectedObject) {
                    this.raycaster.setFromCamera(this.mouse, this.camera);
                    const target = new THREE.Vector3();
                    if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                        const newPos = target.add(this.dragOffset);
                        this.selectedObject.position.set(newPos.x, 0, newPos.z);
                        this.selectionBox.update();
                        
                        this.setRelocationState(false); 
                        
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

                this.raycaster.setFromCamera(this.mouse, this.camera);
                const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);

                if (intersects.length > 0) {
                    let mesh = intersects[0].object;
                    while (mesh.parent && !mesh.userData.isFurniture) {
                        mesh = mesh.parent; 
                    }
                    
                    if (mesh && mesh.userData.isFurniture) {
                        if (this.selectedObject === mesh) {
                            this.setRelocationState(true);
                            const target = new THREE.Vector3();
                            if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                                this.dragOffset.copy(mesh.position).sub(target);
                            }
                        } else {
                            this.selectObject(mesh);
                        }
                    }
                } else {
                    this.deselectObject(); 
                }
            }

            // ==========================================
            // EDIT MODE (Select only, opens properties)
            // ==========================================
            else if (this.interactionMode === 'edit') {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);

                if (intersects.length > 0) {
                    let mesh = intersects[0].object;
                    while (mesh.parent && !mesh.userData.isFurniture) {
                        mesh = mesh.parent; 
                    }
                    if (mesh && mesh.userData.isFurniture) {
                        this.selectObject(mesh);
                    }
                } else {
                    this.deselectObject();
                }
            }
        });

        // --- POINTER MOVE ---
        this.renderer.domElement.addEventListener('pointermove', (event) => {
            if (this.interactionMode === 'camera') return;
            this.updateMouseCoords(event);

            if (this.interactionMode === 'adjust' && this.isPlacing && this.selectedObject) {
                // Footprint follows mouse
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    const newPos = target.add(this.dragOffset);
                    this.dropGroup.position.set(newPos.x, 0.5, newPos.z);
                }
            } else {
                // Hover Effects
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
            this.dropGroup.rotation.y = this.selectedObject.rotation.y;
            this.dropGroup.position.set(this.selectedObject.position.x, 0.5, this.selectedObject.position.z);
            this.dropGroup.visible = true; 
        } else {
            this.dropGroup.visible = false;
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
        this.selectionBox.visible = true; 
        if (this.onFurnitureSelect) this.onFurnitureSelect(object.userData.entity);
    }

    deselectObject() {
        this.cancelRelocation();
        this.selectedObject = null;
        this.selectionBox.visible = false;
        if (this.onFurnitureSelect) this.onFurnitureSelect(null);
    }

    // LIVE UPDATE FROM UI SLIDERS
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
        
        this.isUpdatingFromUI = false;
    }

    initLighting() {
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 3.0); hemiLight.position.set(0, 500, 0); this.scene.add(hemiLight);
        const sunLight = new THREE.DirectionalLight(0xfffaed, 5.0); sunLight.position.set(300, 600, 400); sunLight.castShadow = true; sunLight.shadow.mapSize.width = 2048; sunLight.shadow.mapSize.height = 2048; sunLight.shadow.camera.near = 10; sunLight.shadow.camera.far = 2000; sunLight.shadow.bias = -0.0005; const d = 800; sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d; sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d; this.scene.add(sunLight);
    }
    
    generateEnvironmentMap() { const pmremGenerator = new THREE.PMREMGenerator(this.renderer); pmremGenerator.compileEquirectangularShader(); this.scene.environment = pmremGenerator.fromScene(new THREE.Scene()).texture; }
    resize() { if (this.container.style.display !== 'none') { const w = this.container.clientWidth > 0 ? this.container.clientWidth : window.innerWidth; const h = this.container.clientHeight > 0 ? this.container.clientHeight : window.innerHeight; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); } }
    animate() { requestAnimationFrame(() => this.animate()); this.controls.update(); this.renderer.render(this.scene, this.camera); }
    
    getProceduralTexture(type, colorHex) {
        const key = `${type}_${colorHex}`; if (this.proceduralTextures[key]) return this.proceduralTextures[key];
        const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#' + colorHex.toString(16).padStart(6, '0'); ctx.fillRect(0, 0, 1024, 1024);
        if (type === 'wood') { ctx.globalAlpha = 0.04; ctx.fillStyle = '#1a0b00'; for (let i = 0; i < 600; i++) { let w = Math.random() * 4 + 1; let x = Math.random() * 1024; ctx.fillRect(x, 0, w, 1024); } ctx.globalAlpha = 0.02; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 300; i++) { let w = Math.random() * 3 + 1; let x = Math.random() * 1024; ctx.fillRect(x, 0, w, 1024); } ctx.globalAlpha = 0.05; ctx.strokeStyle = '#2b1400'; for (let i = 0; i < 60; i++) { ctx.beginPath(); ctx.lineWidth = Math.random() * 2 + 1; let startX = Math.random() * 1024; let sway = (Math.random() - 0.5) * 60; ctx.moveTo(startX, 0); ctx.bezierCurveTo(startX + sway, 340, startX - sway, 680, startX + (sway / 2), 1024); ctx.stroke(); } } else if (type === 'brushed') { ctx.globalAlpha = 0.05; ctx.fillStyle = '#000000'; for (let i = 0; i < 800; i++) { let h = Math.random() * 2; let y = Math.random() * 1024; ctx.fillRect(0, y, 1024, h); } }
        const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 1); if(THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace; this.proceduralTextures[key] = texture; return texture;
    }
    
    getDynamicMaterial(matKey, category = 'door') {
        let conf; 
        if (category === 'door') conf = DOOR_MATERIALS[matKey] || DOOR_MATERIALS['wood']; 
        else if (category === 'window_frame') conf = WINDOW_FRAME_MATERIALS[matKey] || WINDOW_FRAME_MATERIALS['alum_powder']; 
        else if (category === 'window_glass') conf = WINDOW_GLASS_MATERIALS[matKey] || WINDOW_GLASS_MATERIALS['clear'];
        
        if (!conf) conf = { color: 0xcccccc, roughness: 0.8, metalness: 0, texture: 'solid' };
        if (conf.transmission || category === 'window_glass') { return new THREE.MeshPhysicalMaterial({ color: conf.color, metalness: conf.metalness || 0, roughness: conf.roughness || 0, transmission: conf.transmission || 0.9, ior: conf.ior || 1.5, thickness: conf.thickness || 2.0, transparent: true, clearcoat: conf.clearcoat || 1.0 }); }
        const texture = conf.texture !== 'solid' ? this.getProceduralTexture(conf.texture, conf.color) : null; return new THREE.MeshStandardMaterial({ color: conf.color, roughness: conf.roughness, metalness: conf.metalness, map: texture, bumpMap: texture, bumpScale: conf.bumpScale || 0 });
    }

    createElevation3DTexture(layers, wallLen) {
        const canvas = document.createElement('canvas'); const RES = 4; canvas.width = Math.max(128, wallLen * RES); canvas.height = WALL_HEIGHT * RES; const ctx = canvas.getContext('2d');
        layers.forEach(layer => { const w = layer.w === '100%' ? canvas.width : parseFloat(layer.w) * RES, h = layer.h === '100%' ? canvas.height : parseFloat(layer.h) * RES, x = parseFloat(layer.x) * RES, y = canvas.height - h - (parseFloat(layer.y) * RES); if (window.applyPatternToCtx) window.applyPatternToCtx(ctx, layer.texture, layer.color, x, y, w, h, 2); else { ctx.fillStyle = layer.color; ctx.fillRect(x, y, w, h); } });
        const texture = new THREE.CanvasTexture(canvas); if(THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.ClampToEdgeWrapping; texture.wrapT = THREE.ClampToEdgeWrapping; texture.repeat.set(1, 1); return texture;
    }

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
        
        // --- RESTORED FLAWLESS SOLID WALL BUILDER ---
        walls.forEach(w => {
            const p1 = w.startAnchor.position();
            const p2 = w.endAnchor.position();
            const dx = p2.x - p1.x;
            const dz = p2.y - p1.y;
            const length = Math.hypot(dx, dz);
            const angle = Math.atan2(dz, dx);
            
            centerX += p1.x + dx/2; 
            centerZ += p1.y + dz/2; 
            count++;

            const wallShape = new THREE.Shape();
            wallShape.moveTo(0, 0);
            wallShape.lineTo(length, 0);
            wallShape.lineTo(length, WALL_HEIGHT);
            wallShape.lineTo(0, WALL_HEIGHT);
            wallShape.lineTo(0, 0);

            w.attachedWidgets.forEach(widg => { 
                const hole = new THREE.Path();
                const wCenter = length * widg.t;
                const halfW = widg.width / 2; 
                if (widg.type === 'door') { 
                    hole.moveTo(wCenter - halfW, 0); 
                    hole.lineTo(wCenter + halfW, 0); 
                    hole.lineTo(wCenter + halfW, DOOR_HEIGHT); 
                    hole.lineTo(wCenter - halfW, DOOR_HEIGHT); 
                    hole.lineTo(wCenter - halfW, 0); 
                } else if (widg.type === 'window') { 
                    hole.moveTo(wCenter - halfW, WINDOW_SILL); 
                    hole.lineTo(wCenter + halfW, WINDOW_SILL); 
                    hole.lineTo(wCenter + halfW, WINDOW_SILL + WINDOW_HEIGHT); 
                    hole.lineTo(wCenter - halfW, WINDOW_SILL + WINDOW_HEIGHT); 
                    hole.lineTo(wCenter - halfW, WINDOW_SILL); 
                } 
                wallShape.holes.push(hole); 
            });

            // Make wall a single solid block so lighting is perfect
            const extrudeOpts = { depth: w.config.thickness, bevelEnabled: false };
            const wallGeo = new THREE.ExtrudeGeometry(wallShape, extrudeOpts);
            wallGeo.translate(0, 0, -w.config.thickness / 2); // Center along Z axis

            // Basic materials - allows proper shadows
            const matMain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
            const matEdge = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.8 });

            const wallMesh = new THREE.Mesh(wallGeo, [matMain, matEdge]);
            wallMesh.position.set(p1.x, 0, p1.y);
            wallMesh.rotation.y = -angle;
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            this.structureGroup.add(wallMesh);

            // Render doors/windows correctly
            w.attachedWidgets.forEach(widg => { 
                // Temporarily inject rendering properties into the object instance
                widg.x = p1.x + dx * widg.t;
                widg.z = p1.y + dz * widg.t;
                widg.angle = angle;
                widg.thick = w.config.thickness;
                
                const definition = WIDGET_REGISTRY[widg.type]; 
                if (definition && definition.render3D) {
                    definition.render3D(this.structureGroup, widg, this); 
                }
            });
        });

        // Corner Joints
        const anchorMap = new Map(); 
        walls.forEach(w => { 
            [w.startAnchor, w.endAnchor].forEach(a => { 
                const data = anchorMap.get(a) || { thickness: 0, type: w.type }; 
                if (w.config.thickness > data.thickness) { 
                    data.thickness = w.config.thickness; 
                    if(w.type === 'outer') data.type = 'outer'; 
                } 
                anchorMap.set(a, data); 
            }); 
        });
        
        anchorMap.forEach((data, anchor) => { 
            const pos = anchor.position(); 
            const jointGeo = new THREE.CylinderGeometry(data.thickness / 2, data.thickness / 2, WALL_HEIGHT, 16); 
            const jointMesh = new THREE.Mesh(jointGeo, new THREE.MeshStandardMaterial({ color: data.type==='outer'?'#f8fafc':'#ffffff', roughness: 0.9 })); 
            jointMesh.position.set(pos.x, WALL_HEIGHT / 2, pos.y); 
            jointMesh.castShadow = true; 
            this.structureGroup.add(jointMesh); 
            
            const capGeo = new THREE.CylinderGeometry(data.thickness / 2, data.thickness / 2, 1, 16); 
            const capMesh = new THREE.Mesh(capGeo, matEdgeDark); 
            capMesh.position.set(pos.x, WALL_HEIGHT, pos.y); 
            this.structureGroup.add(capMesh); 
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

            const hitBoxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
            const hitBoxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }); // Invisible!
            const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
            hitBox.position.set(0, size.y / 2, 0);
            wrapper.add(hitBox);

            const safeW = size.x > 0 ? size.x : 1; 
            const safeH = size.y > 0 ? size.y : 1; 
            const safeD = size.z > 0 ? size.z : 1;

            wrapper.scale.set(entity.width / safeW, entity.height / safeH, entity.depth / safeD);
            wrapper.position.set(entity.group.x(), 0, entity.group.y());
            wrapper.rotation.y = -entity.rotation * (Math.PI / 180);

            wrapper.traverse((child) => { 
                if (child.isMesh) { 
                    child.castShadow = true; 
                    child.receiveShadow = true; 
                    this.interactableObjects.push(child);
                } 
            });

            wrapper.userData = { isFurniture: true, entity: entity, originalSize: new THREE.Vector3(safeW, safeH, safeD) };
            entity.mesh3D = wrapper;
            
            this.interactableObjects.push(hitBox); 
            this.structureGroup.add(wrapper);

            if (this.activeEntityOnLoad === entity) this.selectObject(wrapper);

        } catch (error) {
            console.error(`Failed to load GLB model: ${config.model}`, error);
        }
    }
}
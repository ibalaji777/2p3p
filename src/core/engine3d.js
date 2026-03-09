import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

// Fully imported registry including materials so Doors/Windows do not crash
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
        this.controls.maxPolarAngle = Math.PI / 2 - 0.02; 
        
        this.generateEnvironmentMap();
        this.initLighting();
        this.createProfessionalGrid();
        
        this.structureGroup = new THREE.Group(); 
        this.scene.add(this.structureGroup);
        
        this.proceduralTextures = {}; 
        this.modelCache = {}; 
        
        // --- 3D INTERACTION & EDITING ---
        this.interactableObjects = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Highlight Box (Selection Indicator)
        const dummyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
        this.selectionBox = new THREE.BoxHelper(dummyMesh, 0x3b82f6); 
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);

        // Transform Controls (Move/Rotate/Scale)
        this.transformControl = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControl.setTranslationSnap(5);
        this.transformControl.setRotationSnap(THREE.MathUtils.degToRad(5));
        
        this.isDraggingGizmo = false;
        this.isOrbiting = false;

        this.transformControl.addEventListener('dragging-changed', (e) => { 
            this.controls.enabled = !e.value; 
            this.isDraggingGizmo = e.value;
        });

        this.controls.addEventListener('start', () => { this.isOrbiting = true; });
        this.controls.addEventListener('end', () => { this.isOrbiting = false; });
        
        this.isUpdatingFromUI = false;
        this.isUpdatingFrom3D = false;

        // LIVE SYNC: 3D Gizmo dragging pushes data back to 2D properties
        this.transformControl.addEventListener('change', () => {
            const obj = this.transformControl.object;
            if (!obj || !obj.userData.entity) return;

            if (this.transformControl.getMode() === 'translate') {
                obj.position.y = 0; // Lock to floor!
            }

            if (this.selectionBox.visible) this.selectionBox.update();

            if (!this.isUpdatingFromUI) {
                this.isUpdatingFrom3D = true;
                const entity = obj.userData.entity;
                const origSize = obj.userData.originalSize;

                entity.group.x(obj.position.x);
                entity.group.y(obj.position.z); 
                
                let deg = -obj.rotation.y * (180 / Math.PI);
                while(deg < 0) deg += 360;
                entity.rotation = Math.round(deg % 360); 
                
                entity.width = Math.max(10, Math.round(obj.scale.x * origSize.x));
                entity.height = Math.max(10, Math.round(obj.scale.y * origSize.y));
                entity.depth = Math.max(10, Math.round(obj.scale.z * origSize.z));

                entity.update(); 
                if (this.onFurnitureTransform) this.onFurnitureTransform(); 
                this.isUpdatingFrom3D = false;
            }
        });

        this.scene.add(this.transformControl);
        this.initInteraction();

        this.onFurnitureSelect = null;
        this.onFurnitureTransform = null;
        this.activeEntityOnLoad = null;

        window.addEventListener('resize', () => this.resize()); 
        this.animate();
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

    initInteraction() {
        this.renderer.domElement.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return; 

            // PREVENT CLICK STEALING: Don't raycast if hovering over the Transform Gizmo
            if (this.transformControl.axis !== null) return;

            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);

            if (intersects.length > 0) {
                let object = intersects[0].object;
                while (object.parent && !object.userData.isFurniture) {
                    object = object.parent;
                }
                if (object.userData.isFurniture) this.selectObject(object);
            } else {
                this.deselectObject();
            }
        });
    }

    selectObject(object) {
        this.transformControl.attach(object);
        this.selectionBox.setFromObject(object);
        this.selectionBox.visible = true;
        if (this.onFurnitureSelect) this.onFurnitureSelect(object.userData.entity);
    }

    deselectObject() {
        this.transformControl.detach();
        this.selectionBox.visible = false;
        if (this.onFurnitureSelect) this.onFurnitureSelect(null);
    }

    setTransformMode(mode) {
        this.transformControl.setMode(mode);
        if (mode === 'translate') {
            this.transformControl.showX = true;
            this.transformControl.showY = false; // Prevent dragging into sky
            this.transformControl.showZ = true;
        } else if (mode === 'rotate') {
            this.transformControl.showX = false;
            this.transformControl.showY = true;  // Only rotate on floor axis
            this.transformControl.showZ = false; 
        } else {
            this.transformControl.showX = true;
            this.transformControl.showY = true;
            this.transformControl.showZ = true;
        }
    }

    // LIVE UPDATE FROM THE VUE UI EDIT PANEL
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

        if (this.transformControl.object === object) {
            this.selectionBox.update();
        }
        
        this.isUpdatingFromUI = false;
    }

    initLighting() {
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x777777, 2.5); hemiLight.position.set(0, 500, 0); this.scene.add(hemiLight);
        const sunLight = new THREE.DirectionalLight(0xffffff, 3.0); sunLight.position.set(300, 600, 400); sunLight.castShadow = true; sunLight.shadow.mapSize.width = 2048; sunLight.shadow.mapSize.height = 2048; sunLight.shadow.camera.near = 10; sunLight.shadow.camera.far = 2000; sunLight.shadow.bias = -0.0005; const d = 800; sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d; sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d; this.scene.add(sunLight);
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
        
        if (!conf) conf = { color: 0xcccccc, roughness: 0.8, metalness: 0, texture: 'solid' }; // Failsafe
        
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
        
        walls.forEach(w => {
            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position(), dx = p2.x - p1.x, dz = p2.y - p1.y, length = Math.hypot(dx, dz), angle = Math.atan2(dz, dx); centerX += p1.x + dx/2; centerZ += p1.y + dz/2; count++;
            const wallShape = new THREE.Shape(); wallShape.moveTo(0, 0); wallShape.lineTo(length, 0); wallShape.lineTo(length, WALL_HEIGHT); wallShape.lineTo(0, WALL_HEIGHT); wallShape.lineTo(0, 0);
            w.attachedWidgets.forEach(widg => { const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2; if (widg.type === 'door') { hole.moveTo(wCenter - halfW, 0); hole.lineTo(wCenter + halfW, 0); hole.lineTo(wCenter + halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, 0); } else if (widg.type === 'window') { hole.moveTo(wCenter - halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL); } wallShape.holes.push(hole); });
            const halfThick = w.config.thickness / 2;
            const extrudeOpts = { depth: halfThick, bevelEnabled: false };
            const matFrontMain = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9 }), matBackMain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
            const geoFront = new THREE.ExtrudeGeometry(wallShape, extrudeOpts), meshFront = new THREE.Mesh(geoFront, [matFrontMain, matEdgeDark]); meshFront.position.set(p1.x, 0, p1.y); meshFront.rotation.y = -angle; meshFront.castShadow = true; meshFront.receiveShadow = true; this.structureGroup.add(meshFront);
            const geoBack = new THREE.ExtrudeGeometry(wallShape, extrudeOpts); geoBack.translate(0, 0, -halfThick); const meshBack = new THREE.Mesh(geoBack, [matBackMain, matEdgeDark]); meshBack.position.set(p1.x, 0, p1.y); meshBack.rotation.y = -angle; meshBack.castShadow = true; meshBack.receiveShadow = true; this.structureGroup.add(meshBack);
            
            // Re-render doors/windows properly!
            w.attachedWidgets.forEach(widg => { const wcx = p1.x + dx * widg.t, wcz = p1.y + dz * widg.t; const entityData = { ...widg, x: wcx, z: wcz, angle: angle, thick: w.config.thickness }; const definition = WIDGET_REGISTRY[widg.type]; if (definition && definition.render3D) definition.render3D(this.structureGroup, entityData, this); });
        });

        const anchorMap = new Map(); walls.forEach(w => { [w.startAnchor, w.endAnchor].forEach(a => { const data = anchorMap.get(a) || { thickness: 0, type: w.type }; if (w.config.thickness > data.thickness) { data.thickness = w.config.thickness; if(w.type === 'outer') data.type = 'outer'; } anchorMap.set(a, data); }); });
        anchorMap.forEach((data, anchor) => { const pos = anchor.position(); const jointGeo = new THREE.CylinderGeometry(data.thickness / 2, data.thickness / 2, WALL_HEIGHT, 16); const jointMesh = new THREE.Mesh(jointGeo, new THREE.MeshStandardMaterial({ color: data.type==='outer'?'#f8fafc':'#ffffff', roughness: 0.9 })); jointMesh.position.set(pos.x, WALL_HEIGHT / 2, pos.y); jointMesh.castShadow = true; this.structureGroup.add(jointMesh); const capGeo = new THREE.CylinderGeometry(data.thickness / 2, data.thickness / 2, 1, 16); const capMesh = new THREE.Mesh(capGeo, matEdgeDark); capMesh.position.set(pos.x, WALL_HEIGHT, pos.y); this.structureGroup.add(capMesh); });

        if (furnitureList) {
            this.setTransformMode('translate');
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
            
            // Normalize origin to bottom center so it scales properly from the floor up
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

            wrapper.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });

            wrapper.userData = { isFurniture: true, entity: entity, originalSize: new THREE.Vector3(safeW, safeH, safeD) };
            entity.mesh3D = wrapper;
            
            this.interactableObjects.push(wrapper);
            this.structureGroup.add(wrapper);

            if (this.activeEntityOnLoad === entity) this.selectObject(wrapper);

        } catch (error) {
            console.error(`Failed to load GLB model: ${config.model}`, error);
            this.createFallbackFurniture(entity); 
        }
    }

    createFallbackFurniture(entity) {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        geo.translate(0, 0.5, 0); // Fix origin so it scales upwards, not down through the floor
        const mat = new THREE.MeshStandardMaterial({ color: 0xea580c });
        const mesh = new THREE.Mesh(geo, mat);
        
        mesh.scale.set(entity.width, entity.height, entity.depth);
        mesh.position.set(entity.group.x(), 0, entity.group.y());
        mesh.rotation.y = -entity.rotation * (Math.PI / 180);
        mesh.castShadow = true;

        mesh.userData = { isFurniture: true, entity: entity, originalSize: new THREE.Vector3(1, 1, 1) };
        entity.mesh3D = mesh;

        this.interactableObjects.push(mesh);
        this.structureGroup.add(mesh);
        
        if (this.activeEntityOnLoad === entity) this.selectObject(mesh);
    }
}
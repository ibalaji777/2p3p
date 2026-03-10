import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT } from './registry.js';

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
        
        this.interactionMode = 'adjust'; 
        this.controls.enableRotate = false; 
        
        this.interactableObjects = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); 
        this.dragOffset = new THREE.Vector3();
        
        this.selectedObject = null;
        this.isPlacing = false; 
        
        // 1. STANDARD SELECTION BOX (Furniture Only)
        this.selectionBox = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)), 0x3b82f6); 
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);

        // 2. PERFECT WALL HIGHLIGHT
        const wallHiGeo = new THREE.PlaneGeometry(1, 1);
        wallHiGeo.translate(0.5, 0.5, 0); 
        const wallHiMat = new THREE.MeshBasicMaterial({ 
            color: 0x3b82f6, 
            transparent: true, 
            opacity: 0.35, 
            side: THREE.DoubleSide,
            depthWrite: false 
        });
        this.wallHighlight = new THREE.Mesh(wallHiGeo, wallHiMat);
        this.wallHighlight.visible = false;

        this.dropGroup = new THREE.Group();
        const dropGeo = new THREE.PlaneGeometry(1, 1);
        const dropMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
        this.dropHighlight = new THREE.Mesh(dropGeo, dropMat);
        this.dropHighlight.rotation.x = -Math.PI / 2; 
        this.dropGroup.add(this.dropHighlight);
        this.scene.add(this.dropGroup);
        this.dropGroup.visible = false;

        this.isUpdatingFromUI = false;

        this.initInteraction();

        this.onEntitySelect = null; 
        this.onEntityTransform = null;
        this.onRelocateStateChange = null; 

        window.addEventListener('resize', () => this.resize()); 
        this.animate();
    }

    setInteractionMode(mode) {
        this.interactionMode = mode;
        this.cancelRelocation();
        this.deselectObject();

        if (mode === 'camera') {
            this.controls.enableRotate = true; 
            this.renderer.domElement.style.cursor = 'grab';
        } else {
            this.controls.enableRotate = false; 
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
        this.renderer.domElement.addEventListener('pointerdown', (event) => {
            if (this.interactionMode === 'camera' || event.button !== 0) return; 

            this.updateMouseCoords(event);

            if (this.interactionMode === 'adjust' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isFurniture) {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    this.selectedObject.position.set(target.x, 0, target.z);
                    this.selectionBox.update();
                    this.setRelocationState(false); 
                    this.syncToUI();
                }
                return;
            }

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);

            if (intersects.length > 0) {
                let mesh = intersects[0].object;
                while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor) {
                    mesh = mesh.parent; 
                }
                
                if (mesh && (mesh.userData.isFurniture || mesh.userData.isWallSide || mesh.userData.isWallDecor)) {
                    
                    if (this.interactionMode === 'edit') {
                        // IF THEY CLICK A WALL PATTERN, SELECT THE WALL INSTEAD!
                        if (mesh.userData.isWallDecor) {
                            const wallEntity = mesh.userData.parentWall;
                            const side = mesh.userData.entity.side;
                            let targetSkin = null;
                            wallEntity.mesh3D.children.forEach(c => {
                                if (c.userData.isWallSide && c.userData.side === side) targetSkin = c;
                            });
                            if (targetSkin) this.selectObject(targetSkin);
                        } else {
                            this.selectObject(mesh);
                        }
                    } 
                    else if (this.interactionMode === 'adjust') {
                        if (this.selectedObject === mesh && mesh.userData.isFurniture) {
                            this.setRelocationState(true);
                            this.dragPlane.set(new THREE.Vector3(0, 1, 0), 0); 
                        } else {
                            this.selectObject(mesh);
                            if (mesh.userData.isWallDecor) {
                                const wallNormal = new THREE.Vector3(0,0,1).applyEuler(mesh.parent.rotation);
                                this.dragPlane.setFromNormalAndCoplanarPoint(wallNormal, mesh.getWorldPosition(new THREE.Vector3()));
                                this.isPlacing = true; 
                                this.renderer.domElement.style.cursor = 'grabbing';
                                
                                const target = new THREE.Vector3();
                                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                                    this.dragOffset.copy(mesh.position).sub(mesh.parent.worldToLocal(target));
                                }
                            }
                        }
                    }
                }
            } else {
                this.deselectObject(); 
            }
        });

        this.renderer.domElement.addEventListener('pointermove', (event) => {
            if (this.interactionMode === 'camera') return;
            this.updateMouseCoords(event);

            if (this.interactionMode === 'adjust' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isFurniture) {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    this.dropGroup.position.set(target.x, 0.5, target.z);
                }
            } 
            else if (this.interactionMode === 'adjust' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isWallDecor) {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    const wallGroup = this.selectedObject.parent;
                    const localTarget = wallGroup.worldToLocal(target.clone()).add(this.dragOffset);
                    
                    const entity = this.selectedObject.userData.entity;
                    const wallData = wallGroup.userData.entity;
                    
                    const physicalW = wallData.length3D * (entity.width / 100);
                    const physicalH = WALL_HEIGHT * (entity.height / 100);
                    
                    let visualLocalX = localTarget.x;
                    if (entity.side === 'back') {
                        visualLocalX = wallData.length3D - localTarget.x; 
                    }
                    
                    let newXPercent = ((visualLocalX - physicalW / 2) / wallData.length3D) * 100;
                    let newYPercent = ((localTarget.y - physicalH / 2) / WALL_HEIGHT) * 100;

                    entity.localX = Math.max(0, Math.min(newXPercent, 100 - entity.width));
                    entity.localY = Math.max(0, Math.min(newYPercent, 100 - entity.height));
                    
                    this.updateWallDecorLive(entity);
                    this.syncToUI();
                }
            } else {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);
                this.renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'auto';
            }
        });

        window.addEventListener('pointerup', () => {
            if (this.isPlacing && this.selectedObject && this.selectedObject.userData.isWallDecor) {
                this.isPlacing = false; 
                if (this.renderer) this.renderer.domElement.style.cursor = 'pointer';
            }
        });
    }

    setRelocationState(isRelocating) {
        this.isPlacing = isRelocating;
        if (isRelocating && this.selectedObject && this.selectedObject.userData.isFurniture) {
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
        if (this.isPlacing) this.setRelocationState(false);
        this.isPlacing = false;
    }

    selectObject(object) {
        this.selectedObject = object;
        
        this.selectionBox.visible = false; 
        if (this.wallHighlight.parent) this.wallHighlight.parent.remove(this.wallHighlight);

        let type = null;
        let side = null;

        if (object.userData.isWallSide) {
            type = 'wall';
            side = object.userData.side;
            const wallGroup = object.parent;
            const w = wallGroup.userData.entity;
            
            wallGroup.add(this.wallHighlight);
            this.wallHighlight.scale.set(w.length3D, WALL_HEIGHT, 1);
            
            const zOffset = side === 'front' ? (w.config.thickness / 2 + 0.15) : (-w.config.thickness / 2 - 0.15);
            this.wallHighlight.position.set(0, 0, zOffset);
            this.wallHighlight.rotation.set(0, 0, 0); 
            
            this.wallHighlight.visible = true;
        } 
        else if (object.userData.isFurniture) {
            type = 'furniture';
            this.selectionBox.setFromObject(object);
            this.selectionBox.visible = true;
        }
        else if (object.userData.isWallDecor) {
            type = 'wallDecor';
            // SELECTION BOX REMAINS INVISIBLE FOR WALL DECOR!
        }

        if (type && this.onEntitySelect) {
            this.onEntitySelect(object.userData.entity, type, side);
        }
    }

    deselectObject() {
        this.cancelRelocation();
        this.selectedObject = null;
        this.selectionBox.visible = false;
        if (this.wallHighlight.parent) this.wallHighlight.parent.remove(this.wallHighlight);
        if (this.onEntitySelect) this.onEntitySelect(null, null, null);
    }

    syncToUI() {
        if (!this.isUpdatingFromUI && this.selectedObject) {
            if (this.selectedObject.userData.isFurniture) {
                const entity = this.selectedObject.userData.entity;
                if (entity && entity.group) {
                    entity.group.x(this.selectedObject.position.x);
                    entity.group.y(this.selectedObject.position.z); 
                    entity.update(); 
                }
            }
            if (this.onEntityTransform) this.onEntityTransform();
        }
    }

    addWallPattern(wallEntity, configId, side) {
        const config = WALL_DECOR_REGISTRY[configId];
        if (!config) return null;

        if (!wallEntity.attachedDecor) wallEntity.attachedDecor = [];
        
        const decor = {
            id: 'decor_' + Math.random().toString(36).substr(2, 9),
            configId: configId,
            side: side, 
            localX: 0,
            localY: 0,
            width: 100, 
            height: 100,
            depth: 2
        };
        
        wallEntity.attachedDecor.push(decor);
        this.loadWallPattern(wallEntity, decor);
        return decor;
    }

    async loadWallPattern(wallEntity, decor) {
        const config = WALL_DECOR_REGISTRY[decor.configId];
        if (!config) return;

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
            gltfScene.position.set(-center.x, -center.y, -center.z); 

            const hitBoxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
            const hitBoxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }); 
            const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
            wrapper.add(hitBox);

            const safeW = size.x > 0 ? size.x : 1; 
            const safeH = size.y > 0 ? size.y : 1; 
            const safeD = size.z > 0 ? size.z : 1;

            wrapper.traverse((child) => { 
                if (child.isMesh) { 
                    child.castShadow = true; 
                    child.receiveShadow = true; 
                    this.interactableObjects.push(child);
                } 
            });

            wrapper.userData = { isWallDecor: true, entity: decor, parentWall: wallEntity, originalSize: new THREE.Vector3(safeW, safeH, safeD) };
            decor.mesh3D = wrapper;
            
            this.interactableObjects.push(hitBox); 
            wallEntity.mesh3D.add(wrapper);

            this.updateWallDecorLive(decor);

        } catch (error) {
            console.error(`Failed to load GLB model for wall decor: ${config.model}`, error);
        }
    }

    updateWallDecorLive(entity) {
        if (!entity || !entity.mesh3D) return;
        const object = entity.mesh3D;
        const wallEntity = object.userData.parentWall;

        const physicalW = wallEntity.length3D * (entity.width / 100);
        const physicalH = WALL_HEIGHT * (entity.height / 100);

        let calculatedXPercent = entity.localX;
        if (entity.side === 'back') {
            calculatedXPercent = 100 - entity.localX - entity.width;
        }

        const posX = (wallEntity.length3D * (calculatedXPercent / 100)) + (physicalW / 2);
        const posY = (WALL_HEIGHT * (entity.localY / 100)) + (physicalH / 2);
        
        const zPos = entity.side === 'front' ? (wallEntity.config.thickness / 2 + entity.depth / 2) : (-wallEntity.config.thickness / 2 - entity.depth / 2);

        object.position.set(posX, posY, zPos);
        object.rotation.y = entity.side === 'front' ? 0 : Math.PI;
        
        const origSize = object.userData.originalSize;
        if (origSize) {
            object.scale.set(physicalW / origSize.x, physicalH / origSize.y, entity.depth / origSize.z);
        }
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
            this.selectionBox.setFromObject(object);
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

    buildScene(walls, roomPaths, stairs = [], furnitureList = []) {
        this.deselectObject();
        this.interactableObjects = []; 

        while(this.structureGroup.children.length > 0) { 
            const child = this.structureGroup.children[0]; 
            if(child.geometry) child.geometry.dispose(); 
            this.structureGroup.remove(child); 
        }
        
        let centerX = 0, centerZ = 0, count = 0; 
        const matEdgeDark = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.8 }), matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 }); 
        
        roomPaths.forEach(path => { const floorShape = new THREE.Shape(); floorShape.moveTo(path[0].x, path[0].y); for(let i=1; i<path.length; i++) floorShape.lineTo(path[i].x, path[i].y); const floorGeo = new THREE.ShapeGeometry(floorShape); floorGeo.rotateX(-Math.PI / 2); const floorMesh = new THREE.Mesh(floorGeo, matFloor); floorMesh.position.y = 1; floorMesh.receiveShadow = true; this.structureGroup.add(floorMesh); });
        
        walls.forEach(w => {
            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position(), dx = p2.x - p1.x, dz = p2.y - p1.y, length = Math.hypot(dx, dz), angle = Math.atan2(dz, dx); 
            centerX += p1.x + dx/2; centerZ += p1.y + dz/2; count++;
            w.length3D = length; 

            const wallShape = new THREE.Shape(); wallShape.moveTo(0, 0); wallShape.lineTo(length, 0); wallShape.lineTo(length, WALL_HEIGHT); wallShape.lineTo(0, WALL_HEIGHT); wallShape.lineTo(0, 0);
            w.attachedWidgets.forEach(widg => { const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2; if (widg.type === 'door') { hole.moveTo(wCenter - halfW, 0); hole.lineTo(wCenter + halfW, 0); hole.lineTo(wCenter + halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, 0); } else if (widg.type === 'window') { hole.moveTo(wCenter - halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL); } wallShape.holes.push(hole); });
            
            const extrudeOpts = { depth: w.config.thickness, bevelEnabled: false };
            const matMain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
            const matEdge = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.8 });
            
            const wallGeo = new THREE.ExtrudeGeometry(wallShape, extrudeOpts);
            wallGeo.translate(0, 0, -w.config.thickness / 2);
            const wallMesh = new THREE.Mesh(wallGeo, [matMain, matEdge]);
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            
            const skinGeo = new THREE.PlaneGeometry(length - 0.5, WALL_HEIGHT - 0.5);
            skinGeo.translate(length / 2, WALL_HEIGHT / 2, 0);

            const hitFront = new THREE.Mesh(skinGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
            hitFront.position.set(0, 0, w.config.thickness / 2 + 0.1); 
            hitFront.userData = { isWallSide: true, side: 'front', entity: w };

            const hitBack = new THREE.Mesh(skinGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
            hitBack.position.set(0, 0, -w.config.thickness / 2 - 0.1); 
            hitBack.userData = { isWallSide: true, side: 'back', entity: w };

            const wallGroup = new THREE.Group();
            wallGroup.position.set(p1.x, 0, p1.y);
            wallGroup.rotation.y = -angle;
            
            wallGroup.add(wallMesh, hitFront, hitBack);
            wallGroup.userData = { entity: w };
            
            w.mesh3D = wallGroup;
            this.interactableObjects.push(hitFront, hitBack);
            this.structureGroup.add(wallGroup);
            
            if (w.attachedDecor) {
                w.attachedDecor.forEach(decor => this.loadWallPattern(w, decor));
            }
        });

        const anchorMap = new Map(); walls.forEach(w => { [w.startAnchor, w.endAnchor].forEach(a => { const data = anchorMap.get(a) || { thickness: 0 }; if (w.config.thickness > data.thickness) { data.thickness = w.config.thickness; } anchorMap.set(a, data); }); });
        
        anchorMap.forEach((data, anchor) => { 
            const pos = anchor.position(); 
            const jointGeo = new THREE.CylinderGeometry(data.thickness / 2, data.thickness / 2, WALL_HEIGHT, 16); 
            const jointMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
            const jointMesh = new THREE.Mesh(jointGeo, jointMat); 
            jointMesh.position.set(pos.x, WALL_HEIGHT / 2, pos.y); 
            jointMesh.castShadow = true; 
            jointMesh.receiveShadow = true;
            this.structureGroup.add(jointMesh); 
            
            const capGeo = new THREE.CylinderGeometry(data.thickness / 2, data.thickness / 2, 1, 16); 
            const capMesh = new THREE.Mesh(capGeo, matEdgeDark); 
            capMesh.position.set(pos.x, WALL_HEIGHT, pos.y); 
            this.structureGroup.add(capMesh); 
        });

        if (furnitureList) furnitureList.forEach(furn => this.loadAndPlaceFurniture(furn));

        if (count > 0) { centerX /= count; centerZ /= count; } 
        else if (furnitureList && furnitureList.length > 0) { centerX = furnitureList[0].group.x(); centerZ = furnitureList[0].group.y(); } 
        else { centerX = this.container.clientWidth / 2; centerZ = this.container.clientHeight / 2; }
        
        this.controls.target.set(centerX, 0, centerZ); 
        this.camera.position.set(centerX, 400, centerZ + 500); 
        this.controls.update(); 
    }
}
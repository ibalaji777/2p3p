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
        
        // 1. HIGHLIGHT PIVOT FIX: Center pivot geometry (No translation offset)
        const wallHiGeo = new THREE.PlaneGeometry(1, 1);
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

    setObjectHighlight(group, active) {
        if (!group) return;
        group.traverse((child) => {
            if (child.isMesh && !child.userData.isHitbox && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    if (mat.emissive !== undefined) {
                        if (active) {
                            if (mat.userData.origEmissive === undefined) {
                                mat.userData.origEmissive = mat.emissive.getHex();
                                mat.userData.origEmissiveIntensity = mat.emissiveIntensity || 0;
                            }
                            mat.emissive.setHex(0x3b82f6);
                            mat.emissiveIntensity = 0.5;
                        } else {
                            if (mat.userData.origEmissive !== undefined) {
                                mat.emissive.setHex(mat.userData.origEmissive);
                                mat.emissiveIntensity = mat.userData.origEmissiveIntensity;
                            }
                        }
                        mat.needsUpdate = true;
                    } 
                    else if (mat.color) {
                        if (active) {
                            if (mat.userData.origColor === undefined) mat.userData.origColor = mat.color.getHex();
                            mat.color.setHex(0x3b82f6);
                        } else {
                            if (mat.userData.origColor !== undefined) mat.color.setHex(mat.userData.origColor);
                        }
                        mat.needsUpdate = true;
                    }
                });
            }
        });
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
                    
                    let visualLocalX = localTarget.x;
                    if (entity.side === 'back') {
                        visualLocalX = wallData.length3D - localTarget.x; 
                    }
                    
                    entity.localX = Math.max(-10, Math.min((visualLocalX / wallData.length3D) * 100, 110));
                    entity.localY = Math.max(-10, Math.min((localTarget.y / WALL_HEIGHT) * 100, 110));
                    
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
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor)) {
            this.setObjectHighlight(this.selectedObject, false);
        }
        if (this.wallHighlight.parent) {
            this.wallHighlight.parent.remove(this.wallHighlight);
        }

        this.selectedObject = object;
        
        let type = null;
        let side = null;

        if (object.userData.isWallSide) {
            type = 'wall';
            side = object.userData.side;
            const wallGroup = object.parent;
            const w = wallGroup.userData.entity;
            
            wallGroup.add(this.wallHighlight);
            
            // HIGHLIGHT POSITION & SCALE FIX
            this.wallHighlight.scale.set(w.length3D, WALL_HEIGHT, 1);
            
            let maxDepth = 0;
            if (w.attachedDecor && w.attachedDecor.length > 0) {
                w.attachedDecor.forEach(d => { if (d.side === side && d.depth > maxDepth) maxDepth = d.depth; });
            }
            const zOffset = side === 'front' 
                ? (w.config.thickness / 2 + maxDepth + 0.15) 
                : (-w.config.thickness / 2 - maxDepth - 0.15);

            // Because the pivot is perfectly centered, we just set the position to the middle of the wall!
            this.wallHighlight.position.set(w.length3D / 2, WALL_HEIGHT / 2, zOffset);
            this.wallHighlight.rotation.set(0, 0, 0); 
            
            this.wallHighlight.visible = true;
        } 
        else if (object.userData.isFurniture || object.userData.isWallDecor) {
            type = object.userData.isFurniture ? 'furniture' : 'wallDecor';
            this.setObjectHighlight(object, true);
        }

        if (type && this.onEntitySelect) {
            this.onEntitySelect(object.userData.entity, type, side);
        }
    }

    deselectObject() {
        this.cancelRelocation();
        
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor)) {
            this.setObjectHighlight(this.selectedObject, false);
        }
        if (this.wallHighlight.parent) {
            this.wallHighlight.parent.remove(this.wallHighlight);
        }

        this.selectedObject = null;
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

    // THE GOOD LOGIC RETAINED EXACTLY
    addWallPattern(wallEntity, configId, side) {
        const config = WALL_DECOR_REGISTRY[configId];
        if (!config) return null;

        if (!wallEntity.attachedDecor) wallEntity.attachedDecor = [];
        
        const isOuter = wallEntity.type === 'outer';

        const decor = {
            id: 'decor_' + Math.random().toString(36).substr(2, 9),
            configId: configId,
            side: side, 
            localX: 50,  
            localY: 50,         
            localZ: 0, 
            width: 100,  
            height: 100, 
            depth: config.defaultDepth || 0.2, 
            tileSize: config.defaultTileSize || 40,
            faces: {
                front: true, 
                back: false, 
                left: isOuter,
                right: isOuter
            }
        };
        
        wallEntity.attachedDecor.push(decor);
        this.loadWallPattern(wallEntity, decor);
        return decor;
    }

    async loadWallPattern(wallEntity, decor) {
        const config = WALL_DECOR_REGISTRY[decor.configId];
        if (!config) return;

        try {
            let texture;
            if (!this.modelCache[config.id]) {
                const texLoader = new THREE.TextureLoader();
                texture = await texLoader.loadAsync(config.texture);
                if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
                this.modelCache[config.id] = texture;
            } else {
                texture = this.modelCache[config.id];
            }

            const clonedTexture = texture.clone();
            clonedTexture.needsUpdate = true;

            const wrapper = new THREE.Group();

            const boxGeo = new THREE.BoxGeometry(1, 1, 1); 
            const boxMesh = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xcccccc }));
            boxMesh.userData = { isPatternBox: true };
            
            // 2. TOP UNNECESSARY TEXTURE FIX: openEnded (6th param) is set to TRUE.
            // This completely deletes the flat circular lids from the top and bottom of the cylinder!
            const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
            
            const leftCyl = new THREE.Mesh(cylGeo, new THREE.MeshStandardMaterial({ color: 0xcccccc }));
            leftCyl.userData = { isLeftCyl: true };
            
            const rightCyl = new THREE.Mesh(cylGeo.clone(), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
            rightCyl.userData = { isRightCyl: true };

            wrapper.add(boxMesh, leftCyl, rightCyl);

            const hitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
            const hitBoxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }); 
            const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
            hitBox.userData = { isHitbox: true }; 
            wrapper.add(hitBox);

            wrapper.traverse((child) => { 
                if (child.isMesh && !child.userData.isHitbox) { 
                    child.castShadow = true; 
                    child.receiveShadow = true; 
                    this.interactableObjects.push(child);
                } 
            });

            wrapper.userData = { 
                isWallDecor: true, 
                entity: decor, 
                parentWall: wallEntity, 
                texture: clonedTexture 
            };
            decor.mesh3D = wrapper;
            
            this.interactableObjects.push(hitBox); 
            wallEntity.mesh3D.add(wrapper);

            this.updateWallDecorLive(decor);

        } catch (error) {
            console.error(`Failed to load texture for wall decor: ${config.texture}`, error);
        }
    }

    updateWallDecorLive(entity) {
        if (!entity || !entity.mesh3D) return;
        const object = entity.mesh3D;
        const wallEntity = object.userData.parentWall;

        const t = wallEntity.config.thickness;
        const d = entity.depth;
        const isFront = entity.side === 'front';

        // Percentage to Physical Calculation
        const w = wallEntity.length3D * (entity.width / 100);
        const h = WALL_HEIGHT * (entity.height / 100);

        // Cylinder radius perfectly encapsulates the structural corner + pattern depth
        const cylRadius = (t / 2) + d;

        const boxMesh = object.children.find(c => c.userData.isPatternBox);
        if (boxMesh && boxMesh.geometry) {
            boxMesh.geometry.dispose();
            boxMesh.geometry = new THREE.BoxGeometry(w, h, d);
            boxMesh.position.z = (t / 2 + d / 2) + (entity.localZ || 0);
        }
        
        const leftCyl = object.children.find(c => c.userData.isLeftCyl);
        const rightCyl = object.children.find(c => c.userData.isRightCyl);

        // 2. TOP CAP FIX: true keeps it open-ended, removing the ugly circle on top
        if (leftCyl && leftCyl.geometry) {
            leftCyl.geometry.dispose();
            leftCyl.geometry = new THREE.CylinderGeometry(cylRadius, cylRadius, h, 32, 1, true, isFront ? -Math.PI/2 : Math.PI/2, Math.PI);
        }
        
        if (rightCyl && rightCyl.geometry) {
            rightCyl.geometry.dispose();
            rightCyl.geometry = new THREE.CylinderGeometry(cylRadius, cylRadius, h, 32, 1, true, isFront ? -Math.PI/2 : Math.PI/2, Math.PI);
        }

        const hitbox = object.children.find(c => c.userData && c.userData.isHitbox);
        if (hitbox && hitbox.geometry) {
            hitbox.geometry.dispose();
            hitbox.geometry = new THREE.BoxGeometry(w, h, d);
            hitbox.position.z = (t / 2 + d / 2) + (entity.localZ || 0);
        }

        const texture = object.userData.texture;
        const materials = [];
        let sharedCylMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e7eb });

        if (texture) {
            for (let i = 0; i < 6; i++) {
                let useTexture = false;
                if (i === 4) useTexture = true; 
                
                if (i === 0 && !entity.faces.right) useTexture = true; 
                if (i === 1 && !entity.faces.left) useTexture = true;
                if (i === 2 || i === 3) useTexture = true;

                if (useTexture) {
                    let tex = texture.clone();
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;

                    const tileSize = entity.tileSize || 1;
                    if (i === 0 || i === 1) tex.repeat.set(d / tileSize, h / tileSize);
                    else if (i === 2 || i === 3) tex.repeat.set(w / tileSize, d / tileSize);
                    else tex.repeat.set(w / tileSize, h / tileSize);
                    
                    materials.push(new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff }));
                } else {
                    materials.push(new THREE.MeshBasicMaterial({ visible: false }));
                }
            }
            
            let cylTex = texture.clone();
            cylTex.wrapS = THREE.RepeatWrapping;
            cylTex.wrapT = THREE.RepeatWrapping;
            if (THREE.SRGBColorSpace) cylTex.colorSpace = THREE.SRGBColorSpace;
            const tileSize = entity.tileSize || 1;
            const arcLength = Math.PI * cylRadius;
            cylTex.repeat.set(arcLength / tileSize, h / tileSize);
            sharedCylMaterial = new THREE.MeshStandardMaterial({ map: cylTex, color: 0xffffff });

        } else {
            for (let i = 0; i < 6; i++) materials.push(new THREE.MeshStandardMaterial({ color: 0xe5e7eb }));
        }

        if (boxMesh) {
            if (Array.isArray(boxMesh.material)) {
                boxMesh.material.forEach(m => { if(m.map) m.map.dispose(); m.dispose(); });
            }
            boxMesh.material = materials;
        }

        if (leftCyl) {
            if (leftCyl.material.map) leftCyl.material.map.dispose();
            leftCyl.material.dispose();
            leftCyl.material = sharedCylMaterial;
            leftCyl.visible = entity.faces.left;
            leftCyl.position.set(-w / 2, 0, 0); 
        }

        if (rightCyl) {
            if (rightCyl.material.map) rightCyl.material.map.dispose();
            rightCyl.material.dispose();
            rightCyl.material = sharedCylMaterial;
            rightCyl.visible = entity.faces.right;
            rightCyl.position.set(w / 2, 0, 0);
        }

        let posX = wallEntity.length3D * (entity.localX / 100);
        if (!isFront) {
            posX = wallEntity.length3D - posX;
        }

        const posY = WALL_HEIGHT * (entity.localY / 100);
        
        object.position.set(posX, posY, 0);
        object.rotation.y = isFront ? 0 : Math.PI;
        object.scale.set(1, 1, 1); 
    }

    async loadAndPlaceFurniture(entity) {
        const confId = entity.configId || (entity.config && entity.config.id);
        const config = FURNITURE_REGISTRY[confId];

        if (!config) return;

        try {
            if (!this.modelCache[config.id]) {
                const loader = new GLTFLoader();
                const gltf = await loader.loadAsync(config.model);

                if (config.texture) {
                    const texLoader = new THREE.TextureLoader();
                    const tex = await texLoader.loadAsync(config.texture);
                    tex.flipY = false; 
                    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
                    
                    gltf.scene.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material.map = tex;
                            child.material.needsUpdate = true;
                        }
                    });
                }
                this.modelCache[config.id] = gltf.scene;
            }
            
            const gltfScene = this.modelCache[config.id].clone();
            
            gltfScene.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) child.material = child.material.map(m => m.clone());
                    else child.material = child.material.clone();
                }
            });

            const wrapper = new THREE.Group();
            wrapper.add(gltfScene);
            
            const box = new THREE.Box3().setFromObject(gltfScene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            gltfScene.position.set(-center.x, -box.min.y, -center.z);

            const hitBoxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
            const hitBoxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }); 
            const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
            hitBox.position.set(0, size.y / 2, 0);
            hitBox.userData = { isHitbox: true }; 
            
            wrapper.add(hitBox);

            const safeW = size.x > 0 ? size.x : 1; 
            const safeH = size.y > 0 ? size.y : 1; 
            const safeD = size.z > 0 ? size.z : 1;

            const posX = entity.group ? entity.group.x() : entity.x;
            const posZ = entity.group ? entity.group.y() : entity.z;

            wrapper.scale.set(entity.width / safeW, entity.height / safeH, entity.depth / safeD);
            wrapper.position.set(posX, 0, posZ);
            wrapper.rotation.y = -(entity.rotation || 0) * (Math.PI / 180);

            wrapper.traverse((child) => { 
                if (child.isMesh && !child.userData.isHitbox) { 
                    child.castShadow = true; 
                    child.receiveShadow = true; 
                    this.interactableObjects.push(child); 
                } 
            });

            wrapper.userData = { isFurniture: true, entity: entity, originalSize: new THREE.Vector3(safeW, safeH, safeD) };
            entity.mesh3D = wrapper;
            
            this.interactableObjects.push(hitBox); 
            this.structureGroup.add(wrapper);

            if (this.selectedObject && this.selectedObject.userData.entity === entity) {
                this.selectObject(wrapper);
            }

        } catch (error) {
            console.error(`Failed to load GLB/Texture for furniture: ${config.model}`, error);
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
        const matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 }), matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 }); 
        
        roomPaths.forEach(path => { const floorShape = new THREE.Shape(); floorShape.moveTo(path[0].x, path[0].y); for(let i=1; i<path.length; i++) floorShape.lineTo(path[i].x, path[i].y); const floorGeo = new THREE.ShapeGeometry(floorShape); floorGeo.rotateX(-Math.PI / 2); const floorMesh = new THREE.Mesh(floorGeo, matFloor); floorMesh.position.y = 1; floorMesh.receiveShadow = true; this.structureGroup.add(floorMesh); });
        
        walls.forEach(w => {
            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position(), dx = p2.x - p1.x, dz = p2.y - p1.y, length = Math.hypot(dx, dz), angle = Math.atan2(dz, dx); 
            centerX += p1.x + dx/2; centerZ += p1.y + dz/2; count++;
            w.length3D = length; 

            const wallShape = new THREE.Shape(); 
            wallShape.moveTo(0, 0); 
            wallShape.lineTo(length, 0); 
            wallShape.lineTo(length, WALL_HEIGHT); 
            wallShape.lineTo(0, WALL_HEIGHT); 
            wallShape.lineTo(0, 0);

            w.attachedWidgets.forEach(widg => { 
                const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2; 
                if (widg.type === 'door') { 
                    hole.moveTo(wCenter - halfW, 0); hole.lineTo(wCenter + halfW, 0); hole.lineTo(wCenter + halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, 0); 
                } else if (widg.type === 'window') { 
                    hole.moveTo(wCenter - halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL); 
                } 
                wallShape.holes.push(hole); 
            });
            
            const extrudeOpts = { depth: w.config.thickness, bevelEnabled: false };
            const matMain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
            const matEdge = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });
            
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

        // RESTORED: Stable Gray Structural Cylinders that the wrappers perfectly hide.
        const anchorMap = new Map(); walls.forEach(w => { [w.startAnchor, w.endAnchor].forEach(a => { const data = anchorMap.get(a) || { thickness: 0 }; if (w.config.thickness > data.thickness) { data.thickness = w.config.thickness; } anchorMap.set(a, data); }); });
        
        anchorMap.forEach((data, anchor) => { 
            const pos = anchor.position(); 
            const jointGeo = new THREE.CylinderGeometry(data.thickness / 2, data.thickness / 2, WALL_HEIGHT, 32); 
            const jointMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
            const jointMesh = new THREE.Mesh(jointGeo, jointMat); 
            jointMesh.position.set(pos.x, WALL_HEIGHT / 2, pos.y); 
            jointMesh.castShadow = true; 
            jointMesh.receiveShadow = true;
            this.structureGroup.add(jointMesh); 
            
            const capGeo = new THREE.CylinderGeometry(data.thickness / 2, data.thickness / 2, 1, 32); 
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
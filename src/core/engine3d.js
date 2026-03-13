import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT } from './registry.js';

// ============================================================================
// 1. ASSET MANAGER
// ============================================================================
class AssetManager {
    constructor() {
        this.cache = new Map();
        this.texLoader = new THREE.TextureLoader();
        this.gltfLoader = new GLTFLoader();
    }

    async getTexture(config) {
        if (this.cache.has(config.id)) return this.cache.get(config.id);
        const texture = await this.texLoader.loadAsync(config.texture);
        if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
        this.cache.set(config.id, texture);
        return texture;
    }

    async getModel(config) {
        if (this.cache.has(config.id)) return this.cache.get(config.id);
        const gltf = await this.gltfLoader.loadAsync(config.model);
        if (config.texture) {
            const tex = await this.getTexture({ id: config.id + '_tex', texture: config.texture });
            tex.flipY = false;
            gltf.scene.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.map = tex;
                    child.material.needsUpdate = true;
                }
            });
        }
        this.cache.set(config.id, gltf.scene);
        return gltf.scene;
    }
}

// ============================================================================
// 2. ENVIRONMENT BUILDER
// ============================================================================
class EnvironmentBuilder {
    constructor(ctx) {
        this.ctx = ctx;
    }

    setupBaseEnvironment() {
        this.ctx.scene.background = new THREE.Color(0xf3f4f6);
        this.ctx.scene.fog = new THREE.FogExp2(0xf3f4f6, 0.0008);

        const groundGeo = new THREE.PlaneGeometry(10000, 10000);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.ctx.scene.add(ground);

        const grid = new THREE.GridHelper(5000, 250, 0x000000, 0x000000);
        grid.material.opacity = 0.05;
        grid.material.transparent = true;
        this.ctx.scene.add(grid);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 3.0);
        hemiLight.position.set(0, 500, 0);
        this.ctx.scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xfffaed, 5.0);
        sunLight.position.set(300, 600, 400);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 2000;
        sunLight.shadow.bias = -0.0005;
        const d = 800;
        sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d;
        this.ctx.scene.add(sunLight);
    }

    buildStructure(walls, roomPaths) {
        const matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });
        const matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 });

        roomPaths.forEach(path => {
            const floorShape = new THREE.Shape();
            floorShape.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) floorShape.lineTo(path[i].x, path[i].y);
            const floorGeo = new THREE.ShapeGeometry(floorShape);
            floorGeo.rotateX(-Math.PI / 2);
            const floorMesh = new THREE.Mesh(floorGeo, matFloor);
            floorMesh.position.y = 1;
            floorMesh.receiveShadow = true;
            this.ctx.structureGroup.add(floorMesh);
        });

        walls.forEach(w => {
            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
            const dx = p2.x - p1.x, dz = p2.y - p1.y;
            const length = Math.hypot(dx, dz);
            const angle = Math.atan2(dz, dx);
            w.length3D = length;

            const wallShape = new THREE.Shape();
            wallShape.moveTo(0, 0); wallShape.lineTo(length, 0); wallShape.lineTo(length, WALL_HEIGHT); wallShape.lineTo(0, WALL_HEIGHT); wallShape.lineTo(0, 0);

            w.attachedWidgets.forEach(widg => {
                const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2;
                if (widg.type === 'door') {
                    hole.moveTo(wCenter - halfW, 0); hole.lineTo(wCenter + halfW, 0); hole.lineTo(wCenter + halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, 0);
                } else if (widg.type === 'window') {
                    hole.moveTo(wCenter - halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL);
                }
                wallShape.holes.push(hole);
            });

            const matMain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
            const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: w.config.thickness, bevelEnabled: false });
            wallGeo.translate(0, 0, -w.config.thickness / 2);
            const wallMesh = new THREE.Mesh(wallGeo, [matMain, matEdgeDark]);
            wallMesh.castShadow = true; wallMesh.receiveShadow = true;

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

            this.ctx.interactables.push(hitFront, hitBack);
            this.ctx.structureGroup.add(wallGroup);

            if (w.attachedDecor) w.attachedDecor.forEach(decor => this.ctx.decorManager.load(w, decor));
        });

        // Smart Structural Corner Cylinders (Always present internally to handle extreme angles)
        const anchorMap = new Map();
        walls.forEach(w => {
            [w.startAnchor, w.endAnchor].forEach(a => {
                const data = anchorMap.get(a) || { thickness: 0 };
                if (w.config.thickness > data.thickness) data.thickness = w.config.thickness;
                anchorMap.set(a, data);
            });
        });

        anchorMap.forEach((data, anchor) => {
            const pos = anchor.position();
            const jointGeo = new THREE.CylinderGeometry(data.thickness / 2, data.thickness / 2, WALL_HEIGHT, 32);
            const jointMesh = new THREE.Mesh(jointGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
            jointMesh.position.set(pos.x, WALL_HEIGHT / 2, pos.y);
            jointMesh.castShadow = true; jointMesh.receiveShadow = true;
            
            this.ctx.structureGroup.add(jointMesh);
        });
    }
}

// ============================================================================
// 3. DECOR MANAGER (Pattern Wrappers with Window/Door Holes!)
// ============================================================================
class DecorManager {
    constructor(ctx) {
        this.ctx = ctx;
    }

    add(wallEntity, configId, side) {
        const config = WALL_DECOR_REGISTRY[configId];
        if (!config) return null;
        if (!wallEntity.attachedDecor) wallEntity.attachedDecor = [];
        
        const isOuter = wallEntity.type === 'outer';
        const decor = {
            id: 'decor_' + Math.random().toString(36).substr(2, 9),
            configId: configId,
            side: side,
            localX: 50, localY: 50, localZ: 0,
            width: 100, height: 100,
            depth: config.defaultDepth || 0.2,
            tileSize: config.defaultTileSize || 40,
            faces: { front: true, back: false, left: true, right: true } // Corners ON by default to prevent white gaps
        };
        
        wallEntity.attachedDecor.push(decor);
        this.load(wallEntity, decor);
        return decor;
    }

    async load(wallEntity, decor) {
        const config = WALL_DECOR_REGISTRY[decor.configId];
        if (!config) return;

        const texture = await this.ctx.assets.getTexture(config);
        const clonedTexture = texture.clone();
        clonedTexture.needsUpdate = true;

        const wrapper = new THREE.Group();
        const matDefaults = Array(6).fill(new THREE.MeshStandardMaterial({ color: 0xcccccc }));
        
        // Placeholder Box. Replaced dynamically by updateLive to cut holes!
        const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matDefaults);
        boxMesh.userData = { isPatternBox: true };
        
        // Open-ended corner wrappers
        const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
        const leftCyl = new THREE.Mesh(cylGeo, new THREE.MeshStandardMaterial({ color: 0xcccccc }));
        leftCyl.userData = { isLeftCyl: true };
        const rightCyl = new THREE.Mesh(cylGeo.clone(), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
        rightCyl.userData = { isRightCyl: true };

        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
        hitBox.userData = { isHitbox: true };

        wrapper.add(boxMesh, leftCyl, rightCyl, hitBox);
        wrapper.traverse(c => { if (c.isMesh && !c.userData.isHitbox) { c.castShadow = true; c.receiveShadow = true; this.ctx.interactables.push(c); }});
        
        wrapper.userData = { isWallDecor: true, entity: decor, parentWall: wallEntity, texture: clonedTexture };
        decor.mesh3D = wrapper;
        
        this.ctx.interactables.push(hitBox);
        wallEntity.mesh3D.add(wrapper);
        this.updateLive(decor);
    }

    updateLive(entity) {
        if (!entity || !entity.mesh3D) return;
        const object = entity.mesh3D;
        const wallEntity = object.userData.parentWall;

        const t = wallEntity.config.thickness;
        const d = entity.depth;
        const isFront = entity.side === 'front';

        // 1. DIMENSION FIX: Do not add invisible overlaps to the width, just scale exactly to the wall length.
        const w = wallEntity.length3D * (entity.width / 100);
        const h = WALL_HEIGHT * (entity.height / 100);
        
        // Cylinder radius expands just enough to wrap the gray structural joint
        const cylRadius = (t / 2) + d;

        // Position coordinates for intersections
        let posX = wallEntity.length3D * (entity.localX / 100);
        if (!isFront) posX = wallEntity.length3D - posX;
        const posY = WALL_HEIGHT * (entity.localY / 100);

        // --- HOLE CUTTING LOGIC ---
        const shape = new THREE.Shape();
        shape.moveTo(-w/2, -h/2);
        shape.lineTo(w/2, -h/2);
        shape.lineTo(w/2, h/2);
        shape.lineTo(-w/2, h/2);
        shape.lineTo(-w/2, -h/2);

        wallEntity.attachedWidgets.forEach(widg => {
            const wCenter = wallEntity.length3D * widg.t;
            const halfW = widg.width / 2;
            const wx_min = wCenter - halfW;
            const wx_max = wCenter + halfW;
            const wy_min = widg.type === 'door' ? 0 : WINDOW_SILL;
            const wy_max = widg.type === 'door' ? DOOR_HEIGHT : WINDOW_SILL + WINDOW_HEIGHT;

            let local_wx_min, local_wx_max;
            if (isFront) {
                local_wx_min = wx_min - posX;
                local_wx_max = wx_max - posX;
            } else {
                local_wx_min = -(wx_max - posX);
                local_wx_max = -(wx_min - posX);
            }
            
            const local_wy_min = wy_min - posY;
            const local_wy_max = wy_max - posY;

            const ix_min = Math.max(local_wx_min, -w/2);
            const ix_max = Math.min(local_wx_max, w/2);
            const iy_min = Math.max(local_wy_min, -h/2);
            const iy_max = Math.min(local_wy_max, h/2);

            if (ix_min < ix_max && iy_min < iy_max) {
                const hole = new THREE.Path();
                hole.moveTo(ix_min, iy_min);
                hole.lineTo(ix_max, iy_min);
                hole.lineTo(ix_max, iy_max);
                hole.lineTo(ix_min, iy_max);
                hole.lineTo(ix_min, iy_min);
                shape.holes.push(hole);
            }
        });

        // Rebuild Meshes
        const boxMesh = object.children.find(c => c.userData.isPatternBox);
        if (boxMesh) { 
            boxMesh.geometry.dispose(); 
            boxMesh.geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }); 
            boxMesh.position.z = (t / 2 + d / 2) + 0.05 + (entity.localZ || 0); // 0.05 push prevents Z-fighting
            boxMesh.geometry.translate(0, 0, -d/2);
        }
        
        const leftCyl = object.children.find(c => c.userData.isLeftCyl);
        if (leftCyl) { 
            leftCyl.geometry.dispose(); 
            // Mathematically precise arc spanning from the face around to the back
            leftCyl.geometry = new THREE.CylinderGeometry(cylRadius, cylRadius, h, 32, 1, true, Math.PI, Math.PI); 
        }
        
        const rightCyl = object.children.find(c => c.userData.isRightCyl);
        if (rightCyl) { 
            rightCyl.geometry.dispose(); 
            // Mathematically precise arc spanning from the face around to the back
            rightCyl.geometry = new THREE.CylinderGeometry(cylRadius, cylRadius, h, 32, 1, true, 0, Math.PI); 
        }

        const hitbox = object.children.find(c => c.userData && c.userData.isHitbox);
        if (hitbox) { hitbox.geometry.dispose(); hitbox.geometry = new THREE.BoxGeometry(w, h, d); hitbox.position.z = (t / 2 + d / 2) + (entity.localZ || 0); }

        // --- UV MAPPING FIX (Solves the flat brown texture bug) ---
        const texture = object.userData.texture;
        let matFront = new THREE.MeshBasicMaterial({ visible: false });
        let matSide = new THREE.MeshBasicMaterial({ visible: false });
        let sharedCylMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e7eb });

        if (texture) {
            const tileSize = entity.tileSize || 1;
            
            // ExtrudeGeometry maps world coordinates (X,Y) directly to UVs. We just divide by tileSize!
            let texFront = texture.clone(); texFront.wrapS = texFront.wrapT = THREE.RepeatWrapping; if (THREE.SRGBColorSpace) texFront.colorSpace = THREE.SRGBColorSpace;
            texFront.repeat.set(1 / tileSize, 1 / tileSize);
            matFront = new THREE.MeshStandardMaterial({ map: texFront, color: 0xffffff });

            let texSide = texture.clone(); texSide.wrapS = texSide.wrapT = THREE.RepeatWrapping; if (THREE.SRGBColorSpace) texSide.colorSpace = THREE.SRGBColorSpace;
            texSide.repeat.set(1 / tileSize, 1 / tileSize);
            matSide = new THREE.MeshStandardMaterial({ map: texSide, color: 0xffffff });

            // Cylinder Edge Wrapper
            let cylTex = texture.clone(); cylTex.wrapS = cylTex.wrapT = THREE.RepeatWrapping; if (THREE.SRGBColorSpace) cylTex.colorSpace = THREE.SRGBColorSpace;
            cylTex.repeat.set((Math.PI * cylRadius) / tileSize, h / tileSize);
            sharedCylMaterial = new THREE.MeshStandardMaterial({ map: cylTex, color: 0xffffff });
        } else {
            matFront = new THREE.MeshStandardMaterial({ color: 0xe5e7eb });
            matSide = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        }

        if (boxMesh) { 
            if (Array.isArray(boxMesh.material)) boxMesh.material.forEach(m => { if(m.map) m.map.dispose(); m.dispose(); }); 
            boxMesh.material = [matFront, matSide]; 
        }

        // Exactly attach wrappers to the left and right ends of the pattern
        if (leftCyl) { leftCyl.material = sharedCylMaterial; leftCyl.visible = entity.faces.left; leftCyl.position.set(-w / 2, 0, 0); }
        if (rightCyl) { rightCyl.material = sharedCylMaterial; rightCyl.visible = entity.faces.right; rightCyl.position.set(w / 2, 0, 0); }

        object.position.set(posX, posY, 0);
        object.rotation.y = isFront ? 0 : Math.PI;
    }
}

// ============================================================================
// 4. FURNITURE MANAGER
// ============================================================================
class FurnitureManager {
    constructor(ctx) {
        this.ctx = ctx;
    }

    async load(entity) {
        const config = FURNITURE_REGISTRY[entity.configId || (entity.config && entity.config.id)];
        if (!config) return;

        try {
            const model = await this.ctx.assets.getModel(config);
            const gltfScene = model.clone();
            
            gltfScene.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material = Array.isArray(child.material) ? child.material.map(m => m.clone()) : child.material.clone();
                }
            });

            const wrapper = new THREE.Group();
            wrapper.add(gltfScene);
            
            const box = new THREE.Box3().setFromObject(gltfScene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            gltfScene.position.set(-center.x, -box.min.y, -center.z);

            const hitBox = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
            hitBox.position.set(0, size.y / 2, 0);
            hitBox.userData = { isHitbox: true };
            wrapper.add(hitBox);

            wrapper.traverse((child) => { 
                if (child.isMesh && !child.userData.isHitbox) { child.castShadow = true; child.receiveShadow = true; this.ctx.interactables.push(child); } 
            });

            const safeW = size.x > 0 ? size.x : 1, safeH = size.y > 0 ? size.y : 1, safeD = size.z > 0 ? size.z : 1;
            wrapper.userData = { isFurniture: true, entity: entity, originalSize: new THREE.Vector3(safeW, safeH, safeD) };
            entity.mesh3D = wrapper;
            
            this.ctx.interactables.push(hitBox);
            this.ctx.structureGroup.add(wrapper);
            this.updateLive(entity);

            if (this.ctx.interactions.selectedObject && this.ctx.interactions.selectedObject.userData.entity === entity) {
                this.ctx.interactions.selectObject(wrapper);
            }
        } catch (e) { console.error(e); }
    }

    updateLive(entity) {
        if (!entity || !entity.mesh3D || this.ctx.isUpdatingFrom3D) return;
        this.ctx.isUpdatingFromUI = true;
        const obj = entity.mesh3D;
        obj.position.set(entity.group ? entity.group.x() : entity.x, 0, entity.group ? entity.group.y() : entity.z);
        obj.rotation.y = -(entity.rotation || 0) * (Math.PI / 180);
        const origSize = obj.userData.originalSize;
        obj.scale.set(entity.width / origSize.x, entity.height / origSize.y, entity.depth / origSize.z);
        obj.updateMatrixWorld();
        this.ctx.isUpdatingFromUI = false;
    }
}

// ============================================================================
// 5. INTERACTION SYSTEM
// ============================================================================
class InteractionSystem {
    constructor(ctx) {
        this.ctx = ctx;
        this.mode = 'adjust';
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.dragOffset = new THREE.Vector3();
        this.selectedObject = null;
        this.isPlacing = false;

        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
        this.wallHighlight = new THREE.Mesh(geo, mat);
        this.wallHighlight.visible = false;

        this.dropGroup = new THREE.Group();
        this.dropHighlight = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
        this.dropHighlight.rotation.x = -Math.PI / 2;
        this.dropGroup.add(this.dropHighlight);
        this.dropGroup.visible = false;
        this.ctx.scene.add(this.dropGroup);

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

    initEvents() {
        const dom = this.ctx.renderer.domElement;
        
        dom.addEventListener('pointerdown', (e) => {
            if (this.mode === 'camera' || e.button !== 0) return;
            this.updateMouse(e);
            
            if (this.mode === 'adjust' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isFurniture) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    this.selectedObject.position.set(target.x, 0, target.z);
                    this.setRelocationState(false);
                    this.ctx.syncToUI();
                }
                return;
            }

            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.ctx.interactables, true);
            if (intersects.length > 0) {
                let mesh = intersects[0].object;
                while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor) mesh = mesh.parent;
                
                if (mesh && (mesh.userData.isFurniture || mesh.userData.isWallSide || mesh.userData.isWallDecor)) {
                    if (this.mode === 'edit') {
                        if (mesh.userData.isWallDecor) {
                            const side = mesh.userData.entity.side;
                            let targetSkin = null;
                            mesh.userData.parentWall.mesh3D.children.forEach(c => { if (c.userData.isWallSide && c.userData.side === side) targetSkin = c; });
                            if (targetSkin) this.selectObject(targetSkin);
                        } else this.selectObject(mesh);
                    } else if (this.mode === 'adjust') {
                        if (this.selectedObject === mesh && mesh.userData.isFurniture) {
                            this.setRelocationState(true);
                            this.dragPlane.set(new THREE.Vector3(0, 1, 0), 0);
                        } else {
                            this.selectObject(mesh);
                            if (mesh.userData.isWallDecor) {
                                const wallNormal = new THREE.Vector3(0,0,1).applyEuler(mesh.parent.rotation);
                                this.dragPlane.setFromNormalAndCoplanarPoint(wallNormal, mesh.getWorldPosition(new THREE.Vector3()));
                                this.isPlacing = true;
                                dom.style.cursor = 'grabbing';
                                const target = new THREE.Vector3();
                                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) this.dragOffset.copy(mesh.position).sub(mesh.parent.worldToLocal(target));
                            }
                        }
                    }
                }
            } else this.deselect();
        });

        dom.addEventListener('pointermove', (e) => {
            if (this.mode === 'camera') return;
            this.updateMouse(e);

            if (this.mode === 'adjust' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isFurniture) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) this.dropGroup.position.set(target.x, 0.5, target.z);
            } 
            else if (this.mode === 'adjust' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isWallDecor) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    const wallGroup = this.selectedObject.parent;
                    const localTarget = wallGroup.worldToLocal(target.clone()).add(this.dragOffset);
                    const entity = this.selectedObject.userData.entity, wallData = wallGroup.userData.entity;
                    let visualLocalX = entity.side === 'back' ? wallData.length3D - localTarget.x : localTarget.x;
                    
                    entity.localX = Math.max(-10, Math.min((visualLocalX / wallData.length3D) * 100, 110));
                    entity.localY = Math.max(-10, Math.min((localTarget.y / WALL_HEIGHT) * 100, 110));
                    this.ctx.decorManager.updateLive(entity);
                    this.ctx.syncToUI();
                }
            } else {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                dom.style.cursor = this.raycaster.intersectObjects(this.ctx.interactables, true).length > 0 ? 'pointer' : 'auto';
            }
        });

        window.addEventListener('pointerup', () => {
            if (this.isPlacing && this.selectedObject && this.selectedObject.userData.isWallDecor) {
                this.isPlacing = false;
                dom.style.cursor = 'pointer';
            }
        });
    }

    setRelocationState(active) {
        this.isPlacing = active;
        if (active && this.selectedObject && this.selectedObject.userData.isFurniture) {
            const entity = this.selectedObject.userData.entity;
            this.dropHighlight.scale.set(entity.width, entity.depth, 1);
            this.dropGroup.rotation.y = this.selectedObject.rotation.y;
            this.dropGroup.position.set(this.selectedObject.position.x, 0.5, this.selectedObject.position.z);
            this.dropGroup.visible = true;
        } else this.dropGroup.visible = false;
        if (this.ctx.onRelocateStateChange) this.ctx.onRelocateStateChange(active);
    }

    cancelRelocation() {
        if (this.isPlacing) this.setRelocationState(false);
        this.isPlacing = false;
    }

    setHighlight(group, active) {
        if (!group) return;
        group.traverse((child) => {
            if (child.isMesh && !child.userData.isHitbox && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    if (mat.emissive !== undefined) {
                        if (active) {
                            if (mat.userData.origEmissive === undefined) { mat.userData.origEmissive = mat.emissive.getHex(); mat.userData.origEmissiveIntensity = mat.emissiveIntensity || 0; }
                            mat.emissive.setHex(0x3b82f6); mat.emissiveIntensity = 0.5;
                        } else {
                            if (mat.userData.origEmissive !== undefined) { mat.emissive.setHex(mat.userData.origEmissive); mat.emissiveIntensity = mat.userData.origEmissiveIntensity; }
                        }
                        mat.needsUpdate = true;
                    }
                });
            }
        });
    }

    selectObject(object) {
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor)) this.setHighlight(this.selectedObject, false);
        if (this.wallHighlight.parent) this.wallHighlight.parent.remove(this.wallHighlight);

        this.selectedObject = object;
        let type = null, side = null;

        if (object.userData.isWallSide) {
            type = 'wall'; side = object.userData.side;
            const wallGroup = object.parent;
            const w = wallGroup.userData.entity;
            wallGroup.add(this.wallHighlight);
            
            // --- HIGHLIGHT HOLE CUTTING LOGIC ---
            let maxDepth = 0;
            if (w.attachedDecor) w.attachedDecor.forEach(d => { if (d.side === side && d.depth > maxDepth) maxDepth = d.depth; });
            const hlWidth = w.length3D + (maxDepth * 2) + 0.5; // Removed overlap addition
            const hlHeight = WALL_HEIGHT + 0.5;

            const shape = new THREE.Shape();
            shape.moveTo(-hlWidth/2, -hlHeight/2);
            shape.lineTo(hlWidth/2, -hlHeight/2);
            shape.lineTo(hlWidth/2, hlHeight/2);
            shape.lineTo(-hlWidth/2, hlHeight/2);
            shape.lineTo(-hlWidth/2, -hlHeight/2);

            w.attachedWidgets.forEach(widg => {
                const wCenter = w.length3D * widg.t;
                const halfW = widg.width / 2;
                const cx = w.length3D / 2;
                const cy = WALL_HEIGHT / 2;
                const hx_min = (wCenter - halfW) - cx;
                const hx_max = (wCenter + halfW) - cx;
                const hy_min = (widg.type === 'door' ? 0 : WINDOW_SILL) - cy;
                const hy_max = (widg.type === 'door' ? DOOR_HEIGHT : WINDOW_SILL + WINDOW_HEIGHT) - cy;

                const hole = new THREE.Path();
                hole.moveTo(hx_min, hy_min);
                hole.lineTo(hx_max, hy_min);
                hole.lineTo(hx_max, hy_max);
                hole.lineTo(hx_min, hy_max);
                hole.lineTo(hx_min, hy_min);
                shape.holes.push(hole);
            });

            this.wallHighlight.geometry.dispose();
            this.wallHighlight.geometry = new THREE.ShapeGeometry(shape);
            this.wallHighlight.scale.set(1, 1, 1);

            const zOffset = side === 'front' ? (w.config.thickness / 2 + maxDepth + 0.15) : (-w.config.thickness / 2 - maxDepth - 0.15);
            this.wallHighlight.position.set(w.length3D / 2, WALL_HEIGHT / 2, zOffset);
            this.wallHighlight.rotation.set(0, 0, 0); 
            this.wallHighlight.visible = true;
        } 
        else if (object.userData.isFurniture || object.userData.isWallDecor) {
            type = object.userData.isFurniture ? 'furniture' : 'wallDecor';
            this.setHighlight(object, true);
        }
        if (type && this.ctx.onEntitySelect) this.ctx.onEntitySelect(object.userData.entity, type, side);
    }

    deselect() {
        this.cancelRelocation();
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor)) this.setHighlight(this.selectedObject, false);
        if (this.wallHighlight.parent) this.wallHighlight.parent.remove(this.wallHighlight);
        this.selectedObject = null;
        if (this.ctx.onEntitySelect) this.ctx.onEntitySelect(null, null, null);
    }
}

// ============================================================================
// 6. MAIN FACADE
// ============================================================================
export class Preview3D {
    constructor(containerEl) {
        this.container = containerEl;
        this.scene = new THREE.Scene();
        this.structureGroup = new THREE.Group();
        this.scene.add(this.structureGroup);
        
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

        this.interactables = [];
        this.isUpdatingFromUI = false;
        
        this.assets = new AssetManager();
        this.envBuilder = new EnvironmentBuilder(this);
        this.decorManager = new DecorManager(this);
        this.furnitureManager = new FurnitureManager(this);
        this.interactions = new InteractionSystem(this);

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
    }

    setInteractionMode(mode) { this.interactions.setMode(mode); }
    cancelRelocation() { this.interactions.cancelRelocation(); }
    selectObject(obj) { this.interactions.selectObject(obj); }
    deselectObject() { this.interactions.deselect(); }
    
    addWallPattern(w, id, s) { return this.decorManager.add(w, id, s); }
    updateWallDecorLive(e) { this.decorManager.updateLive(e); }
    
    updateFurnitureLive(e) { this.furnitureManager.updateLive(e); }
    
    syncToUI() {
        if (!this.isUpdatingFromUI && this.interactions.selectedObject && this.interactions.selectedObject.userData.isFurniture) {
            const ent = this.interactions.selectedObject.userData.entity;
            if (ent && ent.group) { ent.group.x(this.interactions.selectedObject.position.x); ent.group.y(this.interactions.selectedObject.position.z); ent.update(); }
        }
        if (this.onEntityTransform) this.onEntityTransform();
    }

    buildScene(walls, roomPaths, stairs = [], furnitureList = []) {
        this.deselectObject();
        this.interactables = [];
        while(this.structureGroup.children.length > 0) { 
            const c = this.structureGroup.children[0]; 
            if(c.geometry) c.geometry.dispose(); 
            this.structureGroup.remove(c); 
        }

        this.envBuilder.buildStructure(walls, roomPaths);
        if (furnitureList) furnitureList.forEach(furn => this.furnitureManager.load(furn));

        let centerX = 0, centerZ = 0;
        if (walls.length > 0) {
            walls.forEach(w => { const p = w.startAnchor.position(); centerX += p.x; centerZ += p.y; });
            centerX /= walls.length; centerZ /= walls.length;
        }
        this.controls.target.set(centerX, 0, centerZ); 
        this.camera.position.set(centerX, 400, centerZ + 500); 
        this.controls.update(); 
    }
    
    get selectedObject() { return this.interactions.selectedObject; }
}
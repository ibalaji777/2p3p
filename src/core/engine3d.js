import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY } from './registry.js';

class AssetManager {
    constructor() {
        this.cache = new Map();
        this.texLoader = new THREE.TextureLoader();
        this.gltfLoader = new GLTFLoader();
        this.objLoader = new OBJLoader();
    }

    async getTexture(config) {
        if (this.cache.has(config.id)) return await this.cache.get(config.id);
        
        // Force absolute path so Vite serves from the /public folder
        let url = config.texture;
        if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('/')) {
            url = '/' + url;
        }
        
        const loadPromise = this.texLoader.loadAsync(url).then(texture => {
            if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
            return texture;
        }).catch(e => {
            console.error(`[AssetManager] Failed to load texture at ${url}. Check your public/ folder!`, e);
            throw e;
        });
        
        this.cache.set(config.id, loadPromise);
        return await loadPromise;
    }

    async getModel(config) {
        if (this.cache.has(config.id)) return await this.cache.get(config.id);
        const loadPromise = (async () => {
            let url = config.model;
            if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('/')) {
                url = '/' + url;
            }
            
            console.log(`[AssetManager] Initiating Loader for URL: ${url}`);
            try {
                let modelScene;
                if (url.toLowerCase().endsWith('.obj')) {
                    console.log(`[AssetManager] Downloading OBJ file from: ${url}`);
                    modelScene = await this.objLoader.loadAsync(url, (xhr) => {
                        console.log(`[AssetManager] OBJ Loading Progress: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
                    });
                    // OBJ files do not contain materials natively. Apply Registry config colors/materials!
                    modelScene.traverse((child) => {
                        if (child.isMesh) {
                            child.material = new THREE.MeshStandardMaterial({
                                color: config.color !== undefined ? config.color : 0xcccccc,
                                transparent: config.transparent || false,
                                opacity: config.opacity !== undefined ? config.opacity : 1.0,
                                roughness: config.roughness !== undefined ? config.roughness : 0.5,
                                metalness: config.metalness !== undefined ? config.metalness : 0.0,
                                side: THREE.DoubleSide
                            });
                        }
                    });
                } else {
                    console.log(`[AssetManager] Downloading GLTF/GLB file from: ${url}`);
                    const gltf = await this.gltfLoader.loadAsync(url, (xhr) => {
                        console.log(`[AssetManager] GLTF/GLB Loading Progress: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
                    });
                    modelScene = gltf.scene;
                }

                if (config.texture) {
                    const tex = await this.getTexture({ id: config.id + '_tex', texture: config.texture });
                    tex.flipY = false;
                    modelScene.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material.map = tex;
                            child.material.needsUpdate = true;
                        }
                    });
                }
                console.log(`[AssetManager] Successfully loaded and configured 3D model for: ${config.id}`);
                return modelScene;
            } catch (e) {
                console.error(`[AssetManager] CRITICAL ERROR: Could not load model at ${url}. Details:`, e);
                throw e;
            }
        })();
        this.cache.set(config.id, loadPromise);
        return await loadPromise;
    }
}

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
        ground.position.y = -0.5; // Prevent Z-fighting with room floors
        ground.receiveShadow = true;
        this.ctx.scene.add(ground);
        this.ground = ground;

        const grid = new THREE.GridHelper(5000, 250, 0x000000, 0x000000);
        grid.position.y = -0.4; // Prevent Z-fighting with room floors
        grid.material.opacity = 0.05;
        grid.material.transparent = true;
        this.ctx.scene.add(grid);
        this.grid = grid;

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 3.0);
        hemiLight.position.set(0, 500, 0);
        this.ctx.scene.add(hemiLight);
        this.hemiLight = hemiLight;

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
        this.sunLight = sunLight;
    }

    setEnvironment(skyKey, groundKey) {
        const skyConfig = SKY_REGISTRY[skyKey];
        if (skyConfig) {
            if (skyConfig.skyColor) {
                this.ctx.scene.background = new THREE.Color(skyConfig.skyColor);
                if (this.ctx.scene.fog) this.ctx.scene.fog.color.setHex(skyConfig.fogColor || skyConfig.skyColor);
            }
            if (this.hemiLight) {
                this.hemiLight.color.setHex(skyConfig.hemiSky || 0xffffff);
                this.hemiLight.groundColor.setHex(skyConfig.hemiGround || 0x444444);
                this.hemiLight.intensity = skyConfig.hemi || 1.0;
            }
            if (this.sunLight) {
                this.sunLight.color.setHex(skyConfig.sunColor || 0xffffff);
                this.sunLight.intensity = skyConfig.sun || 1.0;
            }
        }

        const groundConfig = GROUND_REGISTRY[groundKey];
        if (groundConfig && this.ground) {
            if (groundConfig.color) {
                this.ground.material.color.setHex(groundConfig.color);
                this.ground.material.map = null;
                this.ground.material.needsUpdate = true;
            }
            if (groundConfig.texture) {
                this.ctx.assets.getTexture(groundConfig).then(tex => {
                    const texClone = tex.clone();
                    texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                    texClone.repeat.set(groundConfig.repeat || 100, groundConfig.repeat || 100);
                    this.ground.material.map = texClone;
                    this.ground.material.color.setHex(0xffffff);
                    this.ground.material.needsUpdate = true;
                });
            }
        }
    }

    buildActiveFloor(walls, rooms) {
        const matMain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        const matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });

        if (rooms) {
            rooms.forEach(room => {
                const path = room.path;
                if (!path || path.length < 3) return;

                const floorShape = new THREE.Shape();
                floorShape.moveTo(path[0].x, path[0].y);
                for (let i = 1; i < path.length; i++) floorShape.lineTo(path[i].x, path[i].y);
                
                const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 10, bevelEnabled: false });
                floorGeo.rotateX(Math.PI / 2);
                
                const pos = floorGeo.attributes.position;
                const uvs = new Float32Array(pos.count * 2);
                for (let i = 0; i < pos.count; i++) {
                    uvs[i * 2] = pos.getX(i) / 100;
                    uvs[i * 2 + 1] = -pos.getZ(i) / 100;
                }
                floorGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

                const configId = room.configId || 'hardwood';
                const config = FLOOR_REGISTRY[configId];
                
                const matFloor = new THREE.MeshStandardMaterial({ color: config?.color || 0xd1d5db, roughness: config?.roughness || 0.7 });
                const floorMesh = new THREE.Mesh(floorGeo, matFloor);
                floorMesh.position.y = 0;
                floorMesh.receiveShadow = true;
                floorMesh.userData = { isFloor: true, entity: room };

                if (config && config.texture) {
                    this.ctx.assets.getTexture(config).then(tex => {
                        const texClone = tex.clone();
                        texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                        const repeat = config.repeat || 10;
                        texClone.repeat.set(1 / repeat, 1 / repeat);
                        matFloor.map = texClone;
                        matFloor.needsUpdate = true;
                    });
                }

                this.ctx.interactables.push(floorMesh);
                this.ctx.structureGroup.add(floorMesh);
                room.mesh3D = floorMesh;
            });
        }

        const standardWalls = walls.filter(w => w.type !== 'railing');
        const railingWalls = walls.filter(w => w.type === 'railing');

        standardWalls.forEach(w => {
            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
            const dx = p2.x - p1.x, dz = p2.y - p1.y;
            const length = Math.hypot(dx, dz);
            const angle = Math.atan2(dz, dx);
            w.length3D = length;

            const h = w.height !== undefined ? w.height : (w.config?.height || WALL_HEIGHT);
            const t = w.thickness !== undefined ? w.thickness : (w.config?.thickness || 8);

            const wallShape = new THREE.Shape();
            wallShape.moveTo(0, 0); wallShape.lineTo(length, 0); wallShape.lineTo(length, h); wallShape.lineTo(0, h); wallShape.lineTo(0, 0);

            w.attachedWidgets.forEach(widg => {
                const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2;
                if (widg.type === 'door') {
                    hole.moveTo(wCenter - halfW, 0); hole.lineTo(wCenter + halfW, 0); hole.lineTo(wCenter + halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, 0);
                } else if (widg.type === 'window') {
                    hole.moveTo(wCenter - halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL);
                }
                wallShape.holes.push(hole);
            });

            const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: t, bevelEnabled: false });
            wallGeo.translate(0, 0, -t / 2);
            
            // ====== MITER JOINT SHEARING ======
            const pts = typeof w.poly?.points === 'function' ? w.poly.points() : null;
            let localSL_x = 0, localSR_x = 0, localEL_x = length, localER_x = length;
            if (pts && pts.length === 8) {
                const toLocalX = (ptX, ptY) => {
                    const dx_pt = ptX - p1.x;
                    const dy_pt = ptY - p1.y;
                    return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
                };
                localSL_x = toLocalX(pts[0], pts[1]);
                localEL_x = toLocalX(pts[2], pts[3]);
                localER_x = toLocalX(pts[4], pts[5]);
                localSR_x = toLocalX(pts[6], pts[7]);
            }

            const shearGeo = (geo) => {
                const pos = geo.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i);
                    const z = pos.getZ(i);
                    const tZ = Math.max(0, Math.min(1, (z + t / 2) / t));
                    const startX = localSR_x + tZ * (localSL_x - localSR_x);
                    const endX = localER_x + tZ * (localEL_x - localER_x);
                    const tX = x / length;
                    pos.setX(i, startX + tX * (endX - startX));
                }
                geo.computeVertexNormals();
            };

            if (pts && pts.length === 8) {
                shearGeo(wallGeo);
            }
            // ==================================

            const wallMesh = new THREE.Mesh(wallGeo, [matMain, matEdgeDark]);
            wallMesh.castShadow = true; wallMesh.receiveShadow = true;

            const skinFrontGeo = new THREE.PlaneGeometry(length - 0.5, h - 0.5);
            skinFrontGeo.translate(length / 2, h / 2, t / 2 + 0.1);
            if (pts && pts.length === 8) shearGeo(skinFrontGeo);
            const hitFront = new THREE.Mesh(skinFrontGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
            hitFront.userData = { isWallSide: true, side: 'front', entity: w };

            const skinBackGeo = new THREE.PlaneGeometry(length - 0.5, h - 0.5);
            skinBackGeo.translate(length / 2, h / 2, -t / 2 - 0.1);
            if (pts && pts.length === 8) shearGeo(skinBackGeo);
            const hitBack = new THREE.Mesh(skinBackGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
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

        this.buildRailings(railingWalls, standardWalls);
    }

    buildRailings(railingWalls, standardWalls) {
        railingWalls.forEach(w => {
            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
            const dx = p2.x - p1.x, dz = p2.y - p1.y;
            const length = Math.hypot(dx, dz);
            w.length3D = length;

            let h = w.height !== undefined ? w.height : (w.config?.height || 0);
            let underlyingWall = null;
            
            // Auto-detect if this railing sits directly on top of a standard wall
            if (standardWalls) {
                const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
                for (let sw of standardWalls) {
                    const sp1 = sw.startAnchor.position(), sp2 = sw.endAnchor.position();
                    const C = sp2.x - sp1.x, D = sp2.y - sp1.y;
                    const lenSq = C * C + D * D;
                    if (lenSq !== 0) {
                        const param = Math.max(0, Math.min(1, ((midX - sp1.x) * C + (midY - sp1.y) * D) / lenSq));
                        if (Math.hypot(midX - (sp1.x + param*C), midY - (sp1.y + param*D)) < 5) {
                            underlyingWall = sw;
                            h = sw.height !== undefined ? sw.height : (sw.config?.height || WALL_HEIGHT);
                            break;
                        }
                    }
                }
            }

            const t = Math.max(1, w.thickness !== undefined ? w.thickness : (w.config?.thickness || 4));

            const configId = w.configId || 'rail_1';
            const config = RAILING_REGISTRY[configId] || RAILING_REGISTRY['rail_1'];
            
            const wallGroup = new THREE.Group();
            wallGroup.position.set(0, 0, 0);

            let hitGeo;
            let isMitered = false;
            const pts = (w.poly && typeof w.poly.points === 'function') ? w.poly.points() : w.pts;
            
            // The 3D selection mesh must encompass the curb (h) + the railing physical size (40)
            const totalH = h + 40;

            // Use the exact mitered 2D boundaries for extrusion if available
            if (pts && pts.length === 8) {
                const shape = new THREE.Shape();
                shape.moveTo(pts[0], pts[1]);
                shape.lineTo(pts[2], pts[3]);
                shape.lineTo(pts[4], pts[5]);
                shape.lineTo(pts[6], pts[7]);
                shape.lineTo(pts[0], pts[1]);
                hitGeo = new THREE.ExtrudeGeometry(shape, { depth: totalH, bevelEnabled: false });
                hitGeo.rotateX(Math.PI / 2);
                isMitered = true;
            }
            
            if (!isMitered) {
                hitGeo = new THREE.BoxGeometry(length, totalH, 10);
                hitGeo.translate(length / 2, totalH / 2, 0);
            }

            const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
            if (isMitered) {
                hitMesh.position.set(0, totalH, 0);
            } else {
                hitMesh.position.set(p1.x, 0, p1.y);
                hitMesh.rotation.y = -Math.atan2(dz, dx);
            }
            hitMesh.userData = { isWallSide: true, side: 'front', entity: w };
            wallGroup.add(hitMesh);
            this.ctx.interactables.push(hitMesh);

            this.ctx.structureGroup.add(wallGroup);
            w.mesh3D = wallGroup;

            const buildBaseWall = (baseH, useColor = true) => {
                if (baseH <= 0) return;
                if (underlyingWall && baseH === h) return; // Skip building redundant curb to prevent Z-fighting
                let geo;
                if (isMitered) {
                    const shape = new THREE.Shape();
                    shape.moveTo(pts[0], pts[1]);
                    shape.lineTo(pts[2], pts[3]);
                    shape.lineTo(pts[4], pts[5]);
                    shape.lineTo(pts[6], pts[7]);
                    shape.lineTo(pts[0], pts[1]);
                    geo = new THREE.ExtrudeGeometry(shape, { depth: baseH, bevelEnabled: false });
                    geo.rotateX(Math.PI / 2); 
                } else {
                    geo = new THREE.BoxGeometry(length, baseH, t);
                    geo.translate(length / 2, baseH / 2, 0);
                }
                
                const mat = new THREE.MeshStandardMaterial({ 
                    color: useColor ? (config?.color || 0xcccccc) : 0xcccccc, 
                    transparent: useColor ? (config?.transparent || false) : false, 
                    opacity: useColor ? (config?.opacity || 1) : 1 
                });
                const mesh = new THREE.Mesh(geo, mat);
                
                if (isMitered) {
                    mesh.position.set(0, baseH, 0);
                } else {
                    mesh.position.set(p1.x, 0, p1.y);
                    mesh.rotation.y = -Math.atan2(dz, dx);
                }
                mesh.castShadow = true; mesh.receiveShadow = true;
                wallGroup.add(mesh);
            };

            if (config && config.model) {
                console.log(`[3D Engine] Requesting model build for Railing config: ${configId}`);
                this.ctx.assets.getModel(config).then(model => {
                    console.log(`[3D Engine] Model successfully received by Railing builder for: ${configId}`);
                    const clone = model.clone();
                    
                    // Safely force matrix update so BoundingBox detects correct size
                    clone.updateMatrixWorld(true);
                    
                    const initialBox = new THREE.Box3().setFromObject(clone);
                    const initialSize = initialBox.getSize(new THREE.Vector3());
                    const center = initialBox.getCenter(new THREE.Vector3());

                    if (initialSize.y === 0 || initialSize.x === 0) {
                        buildBaseWall(totalH, true);
                        return;
                    }

                    buildBaseWall(h, false); // Base physical curb/wall beneath the railing

                    const RAILING_TARGET_HEIGHT = 40;
                    const scaleFactor = RAILING_TARGET_HEIGHT / initialSize.y;

                    const translationMat = new THREE.Matrix4().makeTranslation(-center.x, -initialBox.min.y, -center.z);
                    const scaleMat = new THREE.Matrix4().makeScale(scaleFactor, scaleFactor, scaleFactor);

                    const meshes = [];
                    clone.traverse(child => { if (child.isMesh) meshes.push(child); });

                    // Force geometry matrix baking to eliminate nested model transform sinking bugs
                    meshes.forEach(child => {
                        child.geometry = child.geometry.clone();
                        child.geometry.applyMatrix4(child.matrixWorld);
                        child.geometry.applyMatrix4(translationMat);
                        child.geometry.applyMatrix4(scaleMat);
                        child.geometry.computeBoundingBox();
                        child.geometry.computeBoundingSphere();
                        
                        if (child.material) {
                            child.material.side = THREE.DoubleSide;
                            child.material.needsUpdate = true;
                        }
                        child.castShadow = true; child.receiveShadow = true;
                    });

                    clone.traverse(child => {
                        child.position.set(0, 0, 0);
                        child.rotation.set(0, 0, 0);
                        child.scale.set(1, 1, 1);
                        child.updateMatrix();
                    });
                    clone.updateMatrixWorld(true);

                    const currentRailingLength = new THREE.Box3().setFromObject(clone).getSize(new THREE.Vector3()).x;
                    
                    const edge = {
                        start: new THREE.Vector3(p1.x, h, p1.y),
                        end: new THREE.Vector3(p2.x, h, p2.y)
                    };
                    const edgeVector = new THREE.Vector3().subVectors(edge.end, edge.start);
                    const edgeLength = edgeVector.length();
                    const direction = edgeVector.clone().normalize();

                    const count = Math.floor(edgeLength / currentRailingLength);
                    let stretchScale = 1;
                    let actualCount = count;

                    if (count === 0) {
                        stretchScale = edgeLength / currentRailingLength;
                        actualCount = 1;
                    } else {
                        stretchScale = (edgeLength / count) / currentRailingLength;
                    }
                    
                    for (let i = 0; i < actualCount; i++) {
                        const inst = clone.clone();
                        inst.scale.set(stretchScale, 1, 1);

                        const segmentLength = (currentRailingLength * stretchScale);
                        const offsetDistance = (i * segmentLength) + (segmentLength / 2);

                        const position = edge.start.clone().add(direction.clone().multiplyScalar(offsetDistance));
                        inst.position.copy(position);

                        const target = position.clone().add(direction);
                        inst.lookAt(target);
                        inst.rotateY(-Math.PI / 2); 

                        wallGroup.add(inst);
                    }
                }).catch(e => {
                    console.error(`[3D Engine] Failed to load railing model from ${config.model}:`, e);
                    buildBaseWall(totalH, true);
                });
            } else {
                buildBaseWall(totalH, true);
            }
        });
    }

    buildStaticFloors(levelsJsonArray, activeIndex, viewMode3D) {
        levelsJsonArray.forEach((levelStr, index) => {
            if (index === activeIndex) return; 
            if (!levelStr) return;
            if (viewMode3D === 'isolate') return;

            try {
                const data = JSON.parse(levelStr);
                const floorGroup = new THREE.Group();
                floorGroup.position.y = index * WALL_HEIGHT;

                const isPreview = viewMode3D === 'preview';
                const matMain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
                const matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });

                if (data.rooms) {
                    data.rooms.forEach(room => {
                        const path = room.path;
                        if (!path || path.length < 3) return;
                        const floorShape = new THREE.Shape();
                        floorShape.moveTo(path[0].x, path[0].y);
                        for (let i = 1; i < path.length; i++) floorShape.lineTo(path[i].x, path[i].y);
                        
                        const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 10, bevelEnabled: false });
                        floorGeo.rotateX(Math.PI / 2);
                        
                        const pos = floorGeo.attributes.position;
                        const uvs = new Float32Array(pos.count * 2);
                        for (let i = 0; i < pos.count; i++) {
                            uvs[i * 2] = pos.getX(i) / 100;
                            uvs[i * 2 + 1] = -pos.getZ(i) / 100;
                        }
                        floorGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                        
                        const configId = room.configId || 'hardwood';
                        const config = FLOOR_REGISTRY[configId];
                        
                        const matFloor = new THREE.MeshStandardMaterial({ color: config?.color || 0xd1d5db, roughness: config?.roughness || 0.7 });
                        const floorMesh = new THREE.Mesh(floorGeo, matFloor);
                        floorMesh.position.y = 0;
                        floorMesh.receiveShadow = true;
                        
                        if (config && config.texture) {
                            this.ctx.assets.getTexture(config).then(tex => {
                                const texClone = tex.clone();
                                texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                                const repeat = config.repeat || 10;
                                texClone.repeat.set(1 / repeat, 1 / repeat);
                                matFloor.map = texClone;
                                matFloor.needsUpdate = true;
                            });
                        }
                        
                        if (!isPreview) {
                            floorMesh.userData = { isFloorTrigger: true, levelIndex: index };
                            this.ctx.interactables.push(floorMesh);
                        }
                        floorGroup.add(floorMesh);
                    });
                } else if (data.roomPaths) {
                    data.roomPaths.forEach(path => {
                        const floorShape = new THREE.Shape();
                        floorShape.moveTo(path[0].x, path[0].y);
                        for (let i = 1; i < path.length; i++) floorShape.lineTo(path[i].x, path[i].y);
                        
                        const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 10, bevelEnabled: false });
                        floorGeo.rotateX(Math.PI / 2);
                        const floorMesh = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 }));
                        floorMesh.position.y = 0;
                        floorMesh.receiveShadow = true;
                        
                        if (!isPreview) {
                            floorMesh.userData = { isFloorTrigger: true, levelIndex: index };
                            this.ctx.interactables.push(floorMesh);
                        }
                        floorGroup.add(floorMesh);
                    });
                }

                if (data.walls) {
                    data.walls.forEach((w, wallIndex) => {
                        const dx = w.endX - w.startX;
                        const dz = w.endY - w.startY;
                        const length = Math.hypot(dx, dz);
                        const angle = Math.atan2(dz, dx);
                        
                        // MOCK PremiumWall DATA FOR DecorManager TO WORK SEAMLESSLY
                        w.config = { thickness: w.thickness };
                        w.length3D = length;
                        w.attachedWidgets = w.widgets ? w.widgets.map(wd => ({ ...wd, type: wd.configId })) : [];
                        w.attachedDecor = w.decors || [];
                        w.isStatic = true;
                        w.levelIndex = index;
                        w.wallIndex = wallIndex;
                        
                        let h = w.height !== undefined ? w.height : (w.config?.height || (w.type === 'railing' ? 0 : WALL_HEIGHT));
                        let underlyingWall = null;
                        
                        if (w.type === 'railing') {
                            const midX = (w.startX + w.endX) / 2, midY = (w.startY + w.endY) / 2;
                            for (let sw of data.walls) {
                                if (sw.type === 'railing') continue;
                                const C = sw.endX - sw.startX, D = sw.endY - sw.startY;
                                const lenSq = C * C + D * D;
                                if (lenSq !== 0) {
                                    const param = Math.max(0, Math.min(1, ((midX - sw.startX)*C + (midY - sw.startY)*D)/lenSq));
                                    if (Math.hypot(midX - (sw.startX + param*C), midY - (sw.startY + param*D)) < 5) {
                                        underlyingWall = sw;
                                        h = sw.height !== undefined ? sw.height : (sw.config?.height || WALL_HEIGHT);
                                        break;
                                    }
                                }
                            }
                        }
                        
                        const totalH = w.type === 'railing' ? h + 40 : h;
                        const startY = (w.type === 'railing' && underlyingWall && h > 0) ? h : 0;
                        const wallShape = new THREE.Shape();
                        wallShape.moveTo(0, startY); wallShape.lineTo(length, startY); wallShape.lineTo(length, totalH); wallShape.lineTo(0, totalH); wallShape.lineTo(0, startY);
                        
                        if (w.attachedWidgets) {
                            w.attachedWidgets.forEach(widg => {
                                const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2;
                                if (widg.type === 'door') {
                                    hole.moveTo(wCenter - halfW, 0); hole.lineTo(wCenter + halfW, 0); hole.lineTo(wCenter + halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, 0);
                                } else if (widg.type === 'window') {
                                    hole.moveTo(wCenter - halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL);
                                }
                                wallShape.holes.push(hole);
                            });
                        }

                        const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: w.thickness, bevelEnabled: false });
                        wallGeo.translate(0, 0, -w.thickness / 2);
                        
                        // ====== MITER JOINT SHEARING ======
                        let localSL_x = 0, localSR_x = 0, localEL_x = length, localER_x = length;
                        if (w.pts && w.pts.length === 8) {
                            const toLocalX = (ptX, ptY) => {
                                const dx_pt = ptX - w.startX;
                                const dy_pt = ptY - w.startY;
                                return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
                            };
                            localSL_x = toLocalX(w.pts[0], w.pts[1]);
                            localEL_x = toLocalX(w.pts[2], w.pts[3]);
                            localER_x = toLocalX(w.pts[4], w.pts[5]);
                            localSR_x = toLocalX(w.pts[6], w.pts[7]);

                            const pos = wallGeo.attributes.position;
                            for (let i = 0; i < pos.count; i++) {
                                const x = pos.getX(i);
                                const z = pos.getZ(i);
                                const tZ = Math.max(0, Math.min(1, (z + w.thickness / 2) / w.thickness));
                                const startX = localSR_x + tZ * (localSL_x - localSR_x);
                                const endX = localER_x + tZ * (localEL_x - localER_x);
                                const tX = x / length;
                                pos.setX(i, startX + tX * (endX - startX));
                            }
                            wallGeo.computeVertexNormals();
                        }
                        // ==================================

                        const wallMesh = new THREE.Mesh(wallGeo, [matMain, matEdgeDark]);
                        wallMesh.castShadow = true; wallMesh.receiveShadow = true;

                        const wallGroup = new THREE.Group();
                        wallGroup.position.set(w.startX, 0, w.startY);
                        wallGroup.rotation.y = -angle;
                        wallGroup.userData = { entity: w };
                        w.mesh3D = wallGroup;
                        wallGroup.add(wallMesh);
                        
                        if (!isPreview && viewMode3D === 'full-edit') {
                            // CREATE HITBOXES FOR DIRECT SELECTION IN FULL-BUILDING VIEW
                            const shearSkin = (geo) => {
                                const pos = geo.attributes.position;
                                for (let i = 0; i < pos.count; i++) {
                                    const x = pos.getX(i);
                                    const z = pos.getZ(i);
                                    const tZ = Math.max(0, Math.min(1, (z + w.thickness / 2) / w.thickness));
                                    const startX = localSR_x + tZ * (localSL_x - localSR_x);
                                    const endX = localER_x + tZ * (localEL_x - localER_x);
                                    const tX = x / length;
                                    pos.setX(i, startX + tX * (endX - startX));
                                }
                                geo.computeVertexNormals();
                            };
                            
                            const skinFrontGeo = new THREE.PlaneGeometry(length - 0.5, totalH - 0.5);
                            skinFrontGeo.translate(length / 2, totalH / 2, w.thickness / 2 + 0.1);
                            if (w.pts && w.pts.length === 8) shearSkin(skinFrontGeo);
                            const hitFront = new THREE.Mesh(skinFrontGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
                            hitFront.userData = { isWallSide: true, side: 'front', entity: w };

                            const skinBackGeo = new THREE.PlaneGeometry(length - 0.5, totalH - 0.5);
                            skinBackGeo.translate(length / 2, totalH / 2, -w.thickness / 2 - 0.1);
                            if (w.pts && w.pts.length === 8) shearSkin(skinBackGeo);
                            const hitBack = new THREE.Mesh(skinBackGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
                            hitBack.userData = { isWallSide: true, side: 'back', entity: w };

                            wallGroup.add(hitFront, hitBack);
                            this.ctx.interactables.push(hitFront, hitBack);
                        } else if (!isPreview) {
                            // FALLBACK TRIGGER TO SWITCH LEVELS
                            const hitBox = new THREE.Mesh(wallGeo, new THREE.MeshBasicMaterial({ visible: false }));
                            hitBox.userData = { isFloorTrigger: true, levelIndex: index, entityIndex: wallIndex, entityType: 'wall' };
                            wallGroup.add(hitBox);
                            this.ctx.interactables.push(hitBox);
                        }

                        floorGroup.add(wallGroup);

                        // LOAD DECORS VIA MANAGER
                        if (w.attachedDecor) {
                            w.attachedDecor.forEach(decor => this.ctx.decorManager.load(w, decor));
                        }
                    });
                }

                if (data.roofs) {
                    this.buildRoofs(data.roofs, index, data.walls, floorGroup);
                }

                this.ctx.staticStructureGroup.add(floorGroup);
            } catch (e) { console.error("Error parsing static floor", e); }
        });
    }

    buildRoofs(roofs, activeIndex, walls, targetGroup) {
        if (!roofs || roofs.length === 0) return;
        
        const hasWalls = walls && walls.length > 0;
        let maxWallHeight = WALL_HEIGHT;
        if (hasWalls) {
            maxWallHeight = Math.max(...walls.map(w => w.height !== undefined ? w.height : (w.config?.height || WALL_HEIGHT)));
        }

        roofs.forEach(roof => {
            const pts = roof.points || [];
            if (pts.length < 3) return;

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            pts.forEach(p => {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            });

            const conf = roof.config || roof; 
            const wallGap = conf.wallGap || 0;
            
            const W = maxX - minX;
            const D = maxY - minY;
            
            const baseHeight = (hasWalls || activeIndex === 0) ? maxWallHeight : 0;
            const h = baseHeight + wallGap + 0.5;

            const decor = ROOF_DECOR_REGISTRY[conf.material] || ROOF_DECOR_REGISTRY['asphalt_shingles'];
            const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });

            if (decor && decor.texture) {
                this.ctx.assets.getTexture(decor).then(tex => {
                    const texClone = tex.clone();
                    texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                    const repeatScale = decor.repeat || 1;
                    texClone.repeat.set(W / (100 * repeatScale), D / (100 * repeatScale));
                    mat.map = texClone;
                    mat.needsUpdate = true;
                });
            }

            let mesh;
            if (conf.roofType === 'flat') {
                const shape = new THREE.Shape();
                shape.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
                shape.lineTo(pts[0].x, pts[0].y);
                
                const geo = new THREE.ExtrudeGeometry(shape, { depth: conf.thickness || 2, bevelEnabled: false });
                geo.rotateX(Math.PI / 2);
                geo.translate(0, conf.thickness || 2, 0); 
                mesh = new THREE.Mesh(geo, mat);
            } else {
                const pitch = conf.pitch || 30;
                const maxSpan = Math.min(W, D);
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                
                let cx = 0, cy = 0, signedArea = 0;
                for (let i = 0; i < pts.length; i++) {
                    let p0 = pts[i], p1 = pts[(i + 1) % pts.length];
                    let a = p0.x * p1.y - p1.x * p0.y;
                    signedArea += a;
                    cx += (p0.x + p1.x) * a;
                    cy += (p0.y + p1.y) * a;
                }
                signedArea *= 0.5;
                if (signedArea !== 0) { cx /= (6.0 * signedArea); cy /= (6.0 * signedArea); } 
                else { cx = minX + W/2; cy = minY + D/2; }

                const top = [cx, rh, cy];
                const v = [], uv = [];
                
                for (let i = 0; i < pts.length; i++) {
                    let p0 = pts[i], p1 = pts[(i + 1) % pts.length];
                    let dx1 = p1.x - p0.x, dz1 = p1.y - p0.y;
                    let dx2 = top[0] - p0.x, dz2 = top[2] - p0.y;
                    let ny = dx1 * dz2 - dz1 * dx2; 
                    
                    if (ny < 0) { v.push(p1.x, 0, p1.y, p0.x, 0, p0.y, ...top); } 
                    else { v.push(p0.x, 0, p0.y, p1.x, 0, p1.y, ...top); }
                    uv.push(0, 0, 1, 0, 0.5, 1);
                }

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
                geo.computeVertexNormals();
                mesh = new THREE.Mesh(geo, mat);
            }

            const roofGroup = new THREE.Group();
            let groupX = 0, groupZ = 0;
            if (roof.group && typeof roof.group.x === 'function') {
                groupX = roof.group.x();
                groupZ = roof.group.y();
            } else if (roof.x !== undefined) {
                groupX = roof.x;
                groupZ = roof.y;
            }
            roofGroup.position.set(groupX, h, groupZ);
            
            let rot = roof.rotation || 0;
            roofGroup.rotation.y = -rot * Math.PI / 180;

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            if (this.ctx.viewMode3D !== 'preview' && targetGroup === this.ctx.structureGroup) {
                mesh.userData = { isFurniture: true, entity: roof }; 
                this.ctx.interactables.push(mesh);
            }
            
            roofGroup.add(mesh);
            targetGroup.add(roofGroup);
            roof.mesh3D = roofGroup;
        });
    }
}

class DecorManager {
    constructor(ctx) { this.ctx = ctx; }

    add(wallEntity, configId, side) {
        const config = WALL_DECOR_REGISTRY[configId];
        if (!config) return null;
        if (!wallEntity.attachedDecor) wallEntity.attachedDecor = [];
        
        const decor = {
            id: 'decor_' + Math.random().toString(36).substr(2, 9),
            configId: configId,
            side: side,
            localX: 50, localY: 50, localZ: 0,
            width: 100, height: 100,
            depth: config.defaultDepth || 0.2,
            tileSize: config.defaultTileSize || 40,
            faces: { front: true, back: false, left: true, right: true } 
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
        const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), []);
        boxMesh.userData = { isPatternBox: true };
        

        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
        hitBox.userData = { isHitbox: true };

        wrapper.add(boxMesh, hitBox);
        wrapper.traverse(c => { 
            if (c.isMesh && !c.userData.isHitbox) { 
                c.castShadow = true; c.receiveShadow = true; 
                if (this.ctx.viewMode3D !== 'preview' && !c.userData.isWallDecor) this.ctx.interactables.push(c); 
            }
        });
        
        wrapper.userData = { isWallDecor: true, entity: decor, parentWall: wallEntity, texture: clonedTexture };
        decor.mesh3D = wrapper;
        
        if (this.ctx.viewMode3D !== 'preview') this.ctx.interactables.push(hitBox);
        
        wallEntity.mesh3D.add(wrapper);
        this.updateLive(decor);
    }

    updateLive(entity) {
        if (!entity || !entity.mesh3D) return;
        const object = entity.mesh3D;
        const wallEntity = object.userData.parentWall;

        const t = wallEntity.thickness || wallEntity.config?.thickness || 8;
        const wallH = wallEntity.height || wallEntity.config?.height || WALL_HEIGHT;
        const d = entity.depth;
        const isFront = entity.side === 'front';

        const w = wallEntity.length3D * (entity.width / 100);
        const h = wallH * (entity.height / 100);

        let posX = wallEntity.length3D * (entity.localX / 100);
        if (!isFront) posX = wallEntity.length3D - posX;
        const posY = wallH * (entity.localY / 100);

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
            if (isFront) { local_wx_min = wx_min - posX; local_wx_max = wx_max - posX; } 
            else { local_wx_min = -(wx_max - posX); local_wx_max = -(wx_min - posX); }
            
            const local_wy_min = wy_min - posY;
            const local_wy_max = wy_max - posY;

            const ix_min = Math.max(local_wx_min, -w/2);
            const ix_max = Math.min(local_wx_max, w/2);
            const iy_min = Math.max(local_wy_min, -h/2);
            const iy_max = Math.min(local_wy_max, h/2);

            if (ix_min < ix_max && iy_min < iy_max) {
                const hole = new THREE.Path();
                hole.moveTo(ix_min, iy_min); hole.lineTo(ix_max, iy_min); hole.lineTo(ix_max, iy_max); hole.lineTo(ix_min, iy_max); hole.lineTo(ix_min, iy_min);
                shape.holes.push(hole);
            }
        });

        const boxMesh = object.children.find(c => c.userData.isPatternBox);
        if (boxMesh) { 
            boxMesh.geometry.dispose(); 
            boxMesh.geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }); 
            const decorLocalZ = (t / 2 + d / 2) + 0.05 + (entity.localZ || 0);
            boxMesh.position.z = decorLocalZ; 
            boxMesh.geometry.translate(0, 0, -d/2);
            
            // ====== MITER JOINT SHEARING FOR TEXTURES ======
            const pts = (wallEntity.poly && typeof wallEntity.poly.points === 'function') ? wallEntity.poly.points() : wallEntity.pts;
            if (pts && pts.length === 8) {
                const p1 = wallEntity.startAnchor ? wallEntity.startAnchor.position() : {x: wallEntity.startX, y: wallEntity.startY};
                const p2 = wallEntity.endAnchor ? wallEntity.endAnchor.position() : {x: wallEntity.endX, y: wallEntity.endY};
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                
                const toLocalX = (ptX, ptY) => {
                    const dx_pt = ptX - p1.x;
                    const dy_pt = ptY - p1.y;
                    return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
                };
                const localSL_x = toLocalX(pts[0], pts[1]);
                const localEL_x = toLocalX(pts[2], pts[3]);
                const localER_x = toLocalX(pts[4], pts[5]);
                const localSR_x = toLocalX(pts[6], pts[7]);
                
                const pos = boxMesh.geometry.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const vx = pos.getX(i);
                    const vz = pos.getZ(i);
                    const wallX = isFront ? (posX + vx) : (posX - vx);
                    const wallZ = isFront ? (decorLocalZ + vz) : -(decorLocalZ + vz);
                    const tZ = (wallZ + t/2) / t;
                    const startX = localSR_x + tZ * (localSL_x - localSR_x);
                    const endX = localER_x + tZ * (localEL_x - localER_x);
                    const tX = wallX / wallEntity.length3D;
                    const shearedWallX = startX + tX * (endX - startX);
                    const newVx = isFront ? (shearedWallX - posX) : (posX - shearedWallX);
                    pos.setX(i, newVx);
                }
                boxMesh.geometry.computeVertexNormals();
                boxMesh.geometry.computeBoundingBox();
                boxMesh.geometry.computeBoundingSphere();
            }
            // ===============================================
        }
        

        const hitbox = object.children.find(c => c.userData && c.userData.isHitbox);
        if (hitbox) { hitbox.geometry.dispose(); hitbox.geometry = new THREE.BoxGeometry(w, h, d); hitbox.position.z = (t / 2 + d / 2) + (entity.localZ || 0); }

        const texture = object.userData.texture;
        let matFront = new THREE.MeshBasicMaterial({ visible: false });
        let matSide = new THREE.MeshBasicMaterial({ visible: false });

        if (texture) {
            const tileSize = entity.tileSize || 1;
            let texFront = texture.clone(); texFront.wrapS = texFront.wrapT = THREE.RepeatWrapping; if (THREE.SRGBColorSpace) texFront.colorSpace = THREE.SRGBColorSpace;
            texFront.repeat.set(1 / tileSize, 1 / tileSize);
            matFront = new THREE.MeshStandardMaterial({ map: texFront, color: 0xffffff });

            let texSide = texture.clone(); texSide.wrapS = texSide.wrapT = THREE.RepeatWrapping; if (THREE.SRGBColorSpace) texSide.colorSpace = THREE.SRGBColorSpace;
            texSide.repeat.set(1 / tileSize, 1 / tileSize);
            matSide = new THREE.MeshStandardMaterial({ map: texSide, color: 0xffffff });
        } else {
            matFront = new THREE.MeshStandardMaterial({ color: 0xe5e7eb });
            matSide = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        }

        if (boxMesh) { 
            if (Array.isArray(boxMesh.material)) boxMesh.material.forEach(m => { if(m.map) m.map.dispose(); m.dispose(); }); 
            boxMesh.material = [matFront, matSide]; 
        }

        object.position.set(posX, posY, 0);
        object.rotation.y = isFront ? 0 : Math.PI;
    }
}

class FurnitureManager {
    constructor(ctx) { this.ctx = ctx; }

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
            if (this.ctx.viewMode3D === 'preview') return;
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

                if (mesh.userData.isFloorTrigger) {
                    // IGNORE FLOOR CLICKS IF IN FULL BUILDING VIEW
                    if (this.ctx.viewMode3D === 'full-edit') return; 
                    if (this.ctx.onLevelSwitchRequest) {
                        this.ctx.onLevelSwitchRequest(
                            mesh.userData.levelIndex, 
                            mesh.userData.entityIndex, 
                            mesh.userData.entityType
                        );
                    }
                    return;
                }

                while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor && !mesh.userData.isFloor) mesh = mesh.parent;
                
                if (mesh && (mesh.userData.isFurniture || mesh.userData.isWallSide || mesh.userData.isWallDecor || mesh.userData.isFloor)) {
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
                            this.dragPlane.set(new THREE.Vector3(0, 1, 0), -this.ctx.structureGroup.position.y); 
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
            if (this.ctx.viewMode3D === 'preview') return;
            if (this.mode === 'camera') return;
            this.updateMouse(e);

            if (this.mode === 'adjust' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isFurniture) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) this.dropGroup.position.set(target.x, this.ctx.structureGroup.position.y + 0.5, target.z);
            } 
            else if (this.mode === 'adjust' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isWallDecor) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    const wallGroup = this.selectedObject.parent;
                    const localTarget = wallGroup.worldToLocal(target.clone()).add(this.dragOffset);
                    const entity = this.selectedObject.userData.entity, wallData = wallGroup.userData.entity;
                    let visualLocalX = entity.side === 'back' ? wallData.length3D - localTarget.x : localTarget.x;
                    
                    const wallH = wallData.height || wallData.config?.height || WALL_HEIGHT;
                    
                    entity.localX = Math.max(-10, Math.min((visualLocalX / wallData.length3D) * 100, 110));
                    entity.localY = Math.max(-10, Math.min((localTarget.y / wallH) * 100, 110));
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
            this.dropGroup.position.set(this.selectedObject.position.x, this.ctx.structureGroup.position.y + 0.5, this.selectedObject.position.z);
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
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isFloor)) this.setHighlight(this.selectedObject, false);
        if (this.wallHighlight.parent) this.wallHighlight.parent.remove(this.wallHighlight);

        this.selectedObject = object;
        let type = null, side = null;

        if (object.userData.isWallSide) {
            type = 'wall'; side = object.userData.side;
            const wallGroup = object.parent;
            const w = wallGroup.userData.entity;
            wallGroup.add(this.wallHighlight);
            
            let maxDepth = 0;
            if (w.attachedDecor) w.attachedDecor.forEach(d => { if (d.side === side && d.depth > maxDepth) maxDepth = d.depth; });
            
            const isRailing = w.type === 'railing';
            let currentH = w.height !== undefined ? w.height : (w.config?.height || (isRailing ? 0 : WALL_HEIGHT));
            
            if (isRailing && this.ctx.planner) {
                const p1 = w.startAnchor ? w.startAnchor.position() : {x: w.startX, y: w.startY};
                const p2 = w.endAnchor ? w.endAnchor.position() : {x: w.endX, y: w.endY};
                const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
                for (let sw of this.ctx.planner.walls) {
                    if (sw.type === 'railing') continue;
                    const sp1 = sw.startAnchor ? sw.startAnchor.position() : {x: sw.startX, y: sw.startY};
                    const sp2 = sw.endAnchor ? sw.endAnchor.position() : {x: sw.endX, y: sw.endY};
                    const C = sp2.x - sp1.x, D = sp2.y - sp1.y;
                    const lenSq = C * C + D * D;
                    if (lenSq !== 0) {
                        const param = Math.max(0, Math.min(1, ((midX - sp1.x)*C + (midY - sp1.y)*D)/lenSq));
                        if (Math.hypot(midX - (sp1.x + param*C), midY - (sp1.y + param*D)) < 5) {
                            currentH = sw.height !== undefined ? sw.height : (sw.config?.height || WALL_HEIGHT);
                            break;
                        }
                    }
                }
            }

            const currentT = w.thickness !== undefined ? w.thickness : (w.config?.thickness || (isRailing ? 4 : 8));
            const totalH = isRailing ? currentH + 40 : currentH;
            
            const hlWidth = w.length3D + (maxDepth * 2) + 0.5;
            const hlHeight = totalH + 0.5;

            const shape = new THREE.Shape();
            shape.moveTo(-hlWidth/2, -hlHeight/2); shape.lineTo(hlWidth/2, -hlHeight/2); shape.lineTo(hlWidth/2, hlHeight/2); shape.lineTo(-hlWidth/2, hlHeight/2); shape.lineTo(-hlWidth/2, -hlHeight/2);

            w.attachedWidgets.forEach(widg => {
                const wCenter = w.length3D * widg.t; const halfW = widg.width / 2; const cx = w.length3D / 2; const cy = totalH / 2;
                const hx_min = (wCenter - halfW) - cx; const hx_max = (wCenter + halfW) - cx;
                const hy_min = (widg.type === 'door' ? 0 : WINDOW_SILL) - cy; const hy_max = (widg.type === 'door' ? DOOR_HEIGHT : WINDOW_SILL + WINDOW_HEIGHT) - cy;

                const hole = new THREE.Path();
                hole.moveTo(hx_min, hy_min); hole.lineTo(hx_max, hy_min); hole.lineTo(hx_max, hy_max); hole.lineTo(hx_min, hy_max); hole.lineTo(hx_min, hy_min);
                shape.holes.push(hole);
            });

            this.wallHighlight.geometry.dispose();
            this.wallHighlight.geometry = new THREE.ShapeGeometry(shape);
            this.wallHighlight.scale.set(1, 1, 1);

            const zOffset = side === 'front' ? (currentT / 2 + maxDepth + 0.15) : (-currentT / 2 - maxDepth - 0.15);
            
            // ====== MITER JOINT SHEARING FOR HIGHLIGHT ======
            const pts = (w.poly && typeof w.poly.points === 'function') ? w.poly.points() : w.pts;
            if (pts && pts.length === 8 && !isRailing) {
                const p1 = w.startAnchor ? w.startAnchor.position() : {x: w.startX, y: w.startY};
                const p2 = w.endAnchor ? w.endAnchor.position() : {x: w.endX, y: w.endY};
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                
                const toLocalX = (ptX, ptY) => {
                    const dx_pt = ptX - p1.x;
                    const dy_pt = ptY - p1.y;
                    return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
                };
                const localSL_x = toLocalX(pts[0], pts[1]);
                const localEL_x = toLocalX(pts[2], pts[3]);
                const localER_x = toLocalX(pts[4], pts[5]);
                const localSR_x = toLocalX(pts[6], pts[7]);
                
                const pos = this.wallHighlight.geometry.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const vx = pos.getX(i);
                    const wallX = (w.length3D / 2) + vx; 
                    const tZ = (zOffset + currentT/2) / currentT;
                    const startX = localSR_x + tZ * (localSL_x - localSR_x);
                    const endX = localER_x + tZ * (localEL_x - localER_x);
                    const tX = wallX / w.length3D;
                    const shearedWallX = startX + tX * (endX - startX);
                    pos.setX(i, shearedWallX - w.length3D / 2);
                }
                this.wallHighlight.geometry.computeVertexNormals();
                this.wallHighlight.geometry.computeBoundingBox();
                this.wallHighlight.geometry.computeBoundingSphere();
            }
            
            if (isRailing) {
                const p1 = w.startAnchor ? w.startAnchor.position() : {x: w.startX, y: w.startY};
                const p2 = w.endAnchor ? w.endAnchor.position() : {x: w.endX, y: w.endY};
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                
                this.wallHighlight.position.set(p1.x, totalH / 2, p1.y);
                this.wallHighlight.rotation.set(0, -angle, 0);
                this.wallHighlight.translateX(w.length3D / 2);
                this.wallHighlight.translateZ(zOffset);
            } else {
                this.wallHighlight.position.set(w.length3D / 2, totalH / 2, zOffset);
                this.wallHighlight.rotation.set(0, 0, 0); 
            }
            this.wallHighlight.visible = true;
        } 
        else if (object.userData.isFurniture || object.userData.isWallDecor || object.userData.isFloor) {
            if (object.userData.isFurniture) type = 'furniture';
            else if (object.userData.isWallDecor) type = 'wallDecor';
            else if (object.userData.isFloor) type = 'room';
            this.setHighlight(object, true);
        }
        if (type && this.ctx.onEntitySelect) this.ctx.onEntitySelect(object.userData.entity, type, side);
    }

    deselect() {
        this.cancelRelocation();
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isFloor)) this.setHighlight(this.selectedObject, false);
        if (this.wallHighlight.parent) this.wallHighlight.parent.remove(this.wallHighlight);
        this.selectedObject = null;
        if (this.ctx.onEntitySelect) this.ctx.onEntitySelect(null, null, null);
    }
}

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

    setEnvironment(skyKey, groundKey) { this.envBuilder.setEnvironment(skyKey, groundKey); }
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

    deepDispose(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
        if (obj.children) [...obj.children].forEach(c => this.deepDispose(c));
    }

    buildScene(walls, rooms, stairs = [], furnitureList = [], roofs = [], levelsJsonArray = [], activeIndex = 0, viewMode3D = 'full-edit', preserveCamera = false) {
        this.deselectObject();
        this.interactables = [];
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

        const targetY = activeIndex * WALL_HEIGHT;
        this.structureGroup.position.y = targetY;

        this.envBuilder.buildActiveFloor(walls, rooms);
        if (furnitureList) furnitureList.forEach(furn => this.furnitureManager.load(furn));

        if (roofs && roofs.length > 0) this.envBuilder.buildRoofs(roofs, activeIndex, walls, this.structureGroup);

        if (viewMode3D !== 'isolate' && levelsJsonArray && levelsJsonArray.length > 0) {
            this.envBuilder.buildStaticFloors(levelsJsonArray, activeIndex, viewMode3D);
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
    }
    
    get selectedObject() { return this.interactions.selectedObject; }
}
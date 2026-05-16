import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS } from './registry.js';

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
                
                // CRITICAL: Protect cached geometry and materials from being destroyed by deepDispose
                modelScene.traverse((child) => {
                    if (child.isMesh) {
                        child.userData.keepAlive = true;
                        if (child.geometry) child.geometry.userData = { keepAlive: true };
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m.userData = { keepAlive: true });
                            } else {
                                child.material.userData = { keepAlive: true };
                            }
                        }
                    }
                });

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

class Stair3DBuilder {
    constructor(assets, interactables) {
        this.assets = assets;
        this.interactables = interactables;
        this.matStep = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
        this.matRiser = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.9 });
        this.matGlass = new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.9 });
        this.matSteel = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.2 });
        this.matWood = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
        this.matBlack = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    }

    build(stairs, parentGroup, activeIndex) {
        if (!stairs) return;
        stairs.forEach(stair => {
            const stairGroup = new THREE.Group();
            
            if (stair.type === 'staircase_two') {
                this._buildStaircaseTwo(stair, stairGroup);
            } else if (stair.stepData3D && stair.stepData3D.length > 0) {
                this._buildFromStepData(stair.stepData3D, stairGroup, stair.config);
            }

            parentGroup.add(stairGroup);
        });
    }

    _buildStaircaseTwo(stair, group) {
        const config = stair.config;
        group.position.set(stair.x, 0, stair.y);
        group.rotation.y = -config.rotation * Math.PI / 180;

        const w = Number(config.width) || 40;
        const h = Number(config.floorHeight) || WALL_HEIGHT;
        const stepCount = Number(config.stepCount) || 18;
        const tDepth = Number(config.treadDepth) || 11;
        const rHeight = Number(config.riserHeight) || 7.5;

        let currY = 0; // vertical height
        let currZ = 0; // local depth
        let currX = 0; // local x

        const buildStep = (px, pz, py, bw, bd, bh, rotY) => {
            const stepGroup = new THREE.Group();
            stepGroup.position.set(px, py, pz);
            stepGroup.rotation.y = rotY;

            // Tread
            const treadGeo = new THREE.BoxGeometry(bw, 2, bd);
            treadGeo.translate(0, 1, bd/2);
            const tread = new THREE.Mesh(treadGeo, this.matStep);
            tread.castShadow = true; tread.receiveShadow = true;
            stepGroup.add(tread);

            // Riser
            const riserGeo = new THREE.BoxGeometry(bw, bh, 1);
            riserGeo.translate(0, -bh/2 + 1, 0.5);
            const riser = new THREE.Mesh(riserGeo, this.matRiser);
            riser.castShadow = true; riser.receiveShadow = true;
            stepGroup.add(riser);

            group.add(stepGroup);
            return stepGroup;
        };

        const addRailing = (points, isLeft) => {
            if (!config.railing || !config.railing.enabled) return;
            if (isLeft && !config.railing.left) return;
            if (!isLeft && !config.railing.right) return;

            const style = config.railing.style || 'glass';
            const railGroup = new THREE.Group();

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i+1];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dz = p2.z - p1.z;
                const len = Math.hypot(dx, dz);
                const angle = Math.atan2(dx, dz);

                const section = new THREE.Group();
                section.position.copy(p1);
                section.rotation.y = angle;

                if (style === 'glass') {
                    const glassGeo = new THREE.BoxGeometry(1, 90, len);
                    glassGeo.translate(0, 45, len/2);
                    const pMesh = new THREE.Mesh(glassGeo, this.matGlass);
                    section.add(pMesh);
                    
                    const handGeo = new THREE.BoxGeometry(3, 3, len);
                    handGeo.translate(0, 91.5, len/2);
                    section.add(new THREE.Mesh(handGeo, this.matSteel));
                } else if (style === 'modern' || style === 'steel' || style === 'minimal') {
                    const rMat = style === 'steel' ? this.matSteel : this.matBlack;
                    for (let j = 0; j <= 1; j++) {
                        const post = new THREE.Mesh(new THREE.BoxGeometry(2, 90, 2), rMat);
                        post.position.set(0, 45 + p2.y*j, j * len);
                        section.add(post);
                    }
                    const handGeo = new THREE.BoxGeometry(3, 3, len);
                    handGeo.translate(0, 91.5, len/2);
                    handGeo.rotateX(-Math.atan2(p2.y - p1.y, len));
                    section.add(new THREE.Mesh(handGeo, rMat));
                    
                    if (style !== 'minimal') {
                        for (let j = 1; j <= 4; j++) {
                            const mid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, len), rMat);
                            const hRatio = j / 5;
                            mid.position.set(0, 90 * hRatio, len/2);
                            mid.position.y += (p2.y - p1.y) * 0.5;
                            mid.rotation.x = -Math.atan2(p2.y - p1.y, len);
                            section.add(mid);
                        }
                    }
                } else {
                    const postGeo = new THREE.BoxGeometry(4, 90, 4);
                    postGeo.translate(0, 45, 0);
                    const p1m = new THREE.Mesh(postGeo, this.matWood);
                    const p2m = new THREE.Mesh(postGeo, this.matWood);
                    p2m.position.z = len; p2m.position.y = p2.y - p1.y;
                    section.add(p1m, p2m);
                    
                    const handGeo = new THREE.BoxGeometry(5, 4, len);
                    handGeo.translate(0, 92, len/2);
                    handGeo.rotateX(-Math.atan2(p2.y - p1.y, len));
                    section.add(new THREE.Mesh(handGeo, this.matWood));
                }
                railGroup.add(section);
            }
            group.add(railGroup);
        };

        const leftPoints = [];
        const rightPoints = [];

        if (config.stairType === 'straight') {
            for (let i = 0; i < stepCount; i++) {
                buildStep(0, currZ, currY, w, tDepth, rHeight, 0);
                leftPoints.push(new THREE.Vector3(-w/2 + 2, currY, currZ));
                rightPoints.push(new THREE.Vector3(w/2 - 2, currY, currZ));
                currZ += tDepth;
                currY += rHeight;
            }
            leftPoints.push(new THREE.Vector3(-w/2 + 2, currY, currZ));
            rightPoints.push(new THREE.Vector3(w/2 - 2, currY, currZ));
        } else if (config.stairType === 'l_shape') {
            const f1Steps = Math.floor(stepCount / 2);
            const f2Steps = stepCount - f1Steps;
            const m = config.isMirrored ? -1 : 1;
            const lDepth = config.landing.enabled ? Math.max(config.landing.length, w) : w;

            for (let i = 0; i < f1Steps; i++) {
                buildStep(0, currZ, currY, w, tDepth, rHeight, 0);
                leftPoints.push(new THREE.Vector3(-w/2 + 2, currY, currZ));
                rightPoints.push(new THREE.Vector3(w/2 - 2, currY, currZ));
                currZ += tDepth;
                currY += rHeight;
            }
            
            const landGroup = new THREE.Group();
            landGroup.position.set(0, currY, currZ);
            const lGeo = new THREE.BoxGeometry(w, 2, lDepth);
            lGeo.translate(0, 1, lDepth/2);
            landGroup.add(new THREE.Mesh(lGeo, this.matStep));
            group.add(landGroup);

            let currX = config.isMirrored ? -w/2 : w/2;
            let startZ = currZ + w/2;
            const innerPoints = [];

            if (!config.isMirrored) {
                // Turn Right (+X)
                leftPoints.push(new THREE.Vector3(-w/2 + 2, currY, currZ));
                leftPoints.push(new THREE.Vector3(-w/2 + 2, currY, currZ + lDepth - 2));
                leftPoints.push(new THREE.Vector3(w/2 - 2, currY, currZ + lDepth - 2));
                leftPoints.push(new THREE.Vector3(w/2 - 2, currY, startZ + w/2 - 2));
                
                rightPoints.push(new THREE.Vector3(w/2 - 2, currY, currZ));
                rightPoints.push(new THREE.Vector3(w/2 - 2, currY, currZ + 2));
                
                innerPoints.push(new THREE.Vector3(w/2, currY, currZ + 2));
            } else {
                // Turn Left (-X)
                rightPoints.push(new THREE.Vector3(w/2 - 2, currY, currZ));
                rightPoints.push(new THREE.Vector3(w/2 - 2, currY, currZ + lDepth - 2));
                rightPoints.push(new THREE.Vector3(-w/2 + 2, currY, currZ + lDepth - 2));
                rightPoints.push(new THREE.Vector3(-w/2 + 2, currY, startZ + w/2 - 2));
                
                leftPoints.push(new THREE.Vector3(-w/2 + 2, currY, currZ));
                leftPoints.push(new THREE.Vector3(-w/2 + 2, currY, currZ + 2));
                
                innerPoints.push(new THREE.Vector3(-w/2, currY, currZ + 2));
            }

            for (let i = 0; i < f2Steps; i++) {
                buildStep(currX, startZ, currY, w, tDepth, rHeight, m * Math.PI/2);
                
                if (!config.isMirrored) {
                    leftPoints.push(new THREE.Vector3(currX, currY, startZ + w/2 - 2));
                    innerPoints.push(new THREE.Vector3(currX, currY, startZ - w/2 + 2));
                } else {
                    rightPoints.push(new THREE.Vector3(currX, currY, startZ + w/2 - 2));
                    innerPoints.push(new THREE.Vector3(currX, currY, startZ - w/2 + 2));
                }
                
                currX += tDepth * m;
                currY += rHeight;
            }
            
            if (!config.isMirrored) {
                leftPoints.push(new THREE.Vector3(currX, currY, startZ + w/2 - 2));
                innerPoints.push(new THREE.Vector3(currX, currY, startZ - w/2 + 2));
                addRailing(leftPoints, true);
                addRailing(rightPoints, false);
                addRailing(innerPoints, false);
            } else {
                rightPoints.push(new THREE.Vector3(currX, currY, startZ + w/2 - 2));
                innerPoints.push(new THREE.Vector3(currX, currY, startZ - w/2 + 2));
                addRailing(leftPoints, true);
                addRailing(rightPoints, false);
                addRailing(innerPoints, true);
            }
        } else if (config.stairType === 'u_shape' || config.stairType === 'dog_leg') {
            const fSteps = Math.floor(stepCount / 2);
            const f2Steps = stepCount - fSteps;
            const gap = 10;
            const lDepth = config.landing.enabled ? Math.max(config.landing.length, w) : w;

            for (let i = 0; i < fSteps; i++) {
                buildStep(-w/2 - gap/2, currZ, currY, w, tDepth, rHeight, 0);
                leftPoints.push(new THREE.Vector3(-w - gap/2 + 2, currY, currZ));
                rightPoints.push(new THREE.Vector3(-gap/2 - 2, currY, currZ));
                currZ += tDepth;
                currY += rHeight;
            }

            const landGeo = new THREE.BoxGeometry(w * 2 + gap, 2, lDepth);
            landGeo.translate(0, 1, lDepth/2);
            const land = new THREE.Mesh(landGeo, this.matStep);
            land.position.set(0, currY, currZ);
            group.add(land);

            // Outer Railing (leftPoints)
            leftPoints.push(new THREE.Vector3(-w - gap/2 + 2, currY, currZ));
            leftPoints.push(new THREE.Vector3(-w - gap/2 + 2, currY, currZ + lDepth - 2));
            leftPoints.push(new THREE.Vector3(w + gap/2 - 2, currY, currZ + lDepth - 2));
            // Connect to start of flight 2
            leftPoints.push(new THREE.Vector3(w + gap/2 - 2, currY, currZ));

            // Inner Railing Flight 1 (rightPoints)
            rightPoints.push(new THREE.Vector3(-gap/2 - 2, currY, currZ));
            rightPoints.push(new THREE.Vector3(-gap/2 - 2, currY, currZ + 2)); // End inner railing slightly on landing

            // Inner Railing Flight 2 (rightPoints2)
            const rightPoints2 = [];
            rightPoints2.push(new THREE.Vector3(gap/2 + 2, currY, currZ + 2)); // Start inner railing slightly on landing

            // IMPORTANT: For U-shape, flight 2 starts at the same Z where flight 1 ended
            // so we DO NOT do currZ += lDepth; here.

            for (let i = 0; i < f2Steps; i++) {
                buildStep(w/2 + gap/2, currZ, currY, w, tDepth, rHeight, Math.PI);
                leftPoints.push(new THREE.Vector3(w + gap/2 - 2, currY, currZ));
                rightPoints2.push(new THREE.Vector3(gap/2 + 2, currY, currZ));
                currZ -= tDepth;
                currY += rHeight;
            }
            leftPoints.push(new THREE.Vector3(w + gap/2 - 2, currY, currZ));
            rightPoints2.push(new THREE.Vector3(gap/2 + 2, currY, currZ));

            addRailing(leftPoints, true);
            addRailing(rightPoints, false);
            addRailing(rightPoints2, false);
        } else if (config.stairType === 'spiral' || config.stairType === 'circular') {
            const rOut = w;
            const rIn = w * 0.2;
            const angleStep = (Math.PI * 2 * 0.8) / stepCount;

            const pole = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rIn, h, 16), this.matSteel);
            pole.position.set(0, h/2, 0);
            pole.castShadow = true; pole.receiveShadow = true;
            group.add(pole);

            for (let i = 0; i < stepCount; i++) {
                const a = i * angleStep;
                const stepG = new THREE.Group();
                stepG.position.set(0, currY, 0);
                stepG.rotation.y = -a;

                const shape = new THREE.Shape();
                shape.moveTo(rIn, 0);
                shape.lineTo(rOut, 0);
                shape.lineTo(rOut * Math.cos(angleStep), -rOut * Math.sin(angleStep));
                shape.lineTo(rIn * Math.cos(angleStep), -rIn * Math.sin(angleStep));
                shape.lineTo(rIn, 0);

                const tGeo = new THREE.ExtrudeGeometry(shape, { depth: rHeight, bevelEnabled: false });
                tGeo.rotateX(-Math.PI/2);
                const stepMesh = new THREE.Mesh(tGeo, this.matStep);
                stepMesh.castShadow = true; stepMesh.receiveShadow = true;
                stepG.add(stepMesh);
                
                leftPoints.push(new THREE.Vector3(Math.cos(a)*(rOut-2), currY + rHeight, Math.sin(a)*(rOut-2)));
                rightPoints.push(new THREE.Vector3(Math.cos(a)*(rIn+2), currY + rHeight, Math.sin(a)*(rIn+2)));
                
                group.add(stepG);
                currY += rHeight;
            }
            
            const finalA = stepCount * angleStep;
            leftPoints.push(new THREE.Vector3(Math.cos(finalA)*(rOut-2), currY, Math.sin(finalA)*(rOut-2)));
            rightPoints.push(new THREE.Vector3(Math.cos(finalA)*(rIn+2), currY, Math.sin(finalA)*(rIn+2)));
            
            addRailing(leftPoints, true);
            addRailing(rightPoints, false);
        }
        
        if (config.stairType !== 'spiral' && config.stairType !== 'circular') {
            addRailing(leftPoints, true);
            addRailing(rightPoints, false);
        }
    }

    _buildFromStepData(stepData3D, group, config) {
        stepData3D.forEach(sd => {
            if (sd.type === 'step') {
                const stepG = new THREE.Group();
                stepG.position.set(sd.x, sd.y, sd.z);
                if (sd.angle) stepG.rotation.y = -sd.angle;

                const treadGeo = new THREE.BoxGeometry(sd.w, 2, sd.d);
                treadGeo.translate(0, 1, 0);
                stepG.add(new THREE.Mesh(treadGeo, this.matStep));

                const riserGeo = new THREE.BoxGeometry(sd.w, sd.h, 1);
                riserGeo.translate(0, -sd.h/2 + 1, -sd.d/2);
                stepG.add(new THREE.Mesh(riserGeo, this.matRiser));

                group.add(stepG);
            } else if (sd.type === 'landing_poly') {
                if (!sd.pts || sd.pts.length < 3) return;
                const shape = new THREE.Shape();
                shape.moveTo(sd.pts[0].x, sd.pts[0].y);
                for (let i = 1; i < sd.pts.length; i++) shape.lineTo(sd.pts[i].x, sd.pts[i].y);
                const geo = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false });
                geo.rotateX(Math.PI/2);
                const mesh = new THREE.Mesh(geo, this.matStep);
                mesh.position.y = sd.y + 2;
                group.add(mesh);
            }
        });
    }

    static getStairHoles(stairs) {
        const holes = [];
        stairs.forEach(stair => {
            if (!stair.config) return;
            const w = stair.config.width || 40;
            const tDepth = stair.config.treadDepth || 11;
            const count = stair.config.stepCount || 18;
            const l = tDepth * count;

            let pts = [];
            const r = (stair.config.rotation || 0) * Math.PI / 180;
            const cos = Math.cos(-r); // negate because threejs y rot is negative
            const sin = Math.sin(-r);

            const transform = (lx, lz) => {
                return {
                    x: stair.x + lx * cos + lz * sin,
                    y: stair.y - lx * sin + lz * cos
                };
            };

            if (stair.config.stairType === 'straight') {
                pts = [ transform(-w/2, 0), transform(w/2, 0), transform(w/2, l), transform(-w/2, l) ];
            } else if (stair.config.stairType === 'l_shape') {
                const f1 = Math.floor(count/2) * tDepth;
                const f2 = (count - Math.floor(count/2)) * tDepth;
                const ld = stair.config.landing?.length || w;
                const m = stair.config.isMirrored ? -1 : 1;
                const signX = stair.config.isMirrored ? -1 : 1;
                if (stair.config.isMirrored) {
                     pts = [ transform(-w/2, 0), transform(w/2, 0), transform(w/2, f1+ld), transform(-w/2-f2, f1+ld), transform(-w/2-f2, f1), transform(-w/2, f1) ];
                } else {
                     pts = [ transform(-w/2, 0), transform(w/2, 0), transform(w/2, f1), transform(w/2+f2, f1), transform(w/2+f2, f1+ld), transform(-w/2, f1+ld) ];
                }
            } else if (stair.config.stairType === 'u_shape' || stair.config.stairType === 'dog_leg') {
                const f1 = Math.floor(count/2) * tDepth;
                const ld = stair.config.landing?.length || w;
                const gap = 10;
                pts = [ transform(-w-gap/2, 0), transform(w+gap/2, 0), transform(w+gap/2, f1+ld), transform(-w-gap/2, f1+ld) ];
            } else if (stair.config.stairType === 'spiral' || stair.config.stairType === 'circular') {
                for (let a = 0; a < Math.PI * 2; a += Math.PI/4) {
                    pts.push({ x: stair.x + Math.cos(a)*w, y: stair.y + Math.sin(a)*w });
                }
            } else {
                pts = [ transform(-w/2, 0), transform(w/2, 0), transform(w/2, l), transform(-w/2, l) ];
            }

            if (pts.length > 0) {
                const holePath = new THREE.Path();
                holePath.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) holePath.lineTo(pts[i].x, pts[i].y);
                holePath.lineTo(pts[0].x, pts[0].y);
                holes.push(holePath);
            }
        });
        return holes;
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

    buildActiveFloor(walls, rooms, shapes, stairs = []) {
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

        const standardWalls = walls.filter(w => w.type !== 'railing' && !w.hidden);
        const railingWalls = walls.filter(w => w.type === 'railing' && !w.hidden);

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

                                const type = widg.type || widg.configId;
                                if (WIDGET_REGISTRY[type] && WIDGET_REGISTRY[type].render3D) {
                                    widg.x = p1.x + Math.cos(angle) * wCenter;
                                    widg.z = p1.y + Math.sin(angle) * wCenter;
                                    widg.angle = angle;
                                    widg.thick = t;
                                    widg.wall = w;
                                    const widgetGroup = WIDGET_REGISTRY[type].render3D(this.ctx.structureGroup, widg, this.ctx.helpers);
                                    if (widgetGroup) this.ctx.interactables.push(widgetGroup);
                                }
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

        this.buildRailings(railingWalls, standardWalls, shapes);
    }

    buildRailings(railingWalls, standardWalls, shapes) {
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

            if (!underlyingWall && shapes) {
                const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
                for (let s of shapes) {
                    if (s.type !== 'shape_rect' && s.type !== 'shape_polygon') continue;
                    let pts = []; 
                    if (s.type === 'shape_rect') { 
                        const sw = s.params.width; const sh = s.params.height; 
                        pts = [ {x: -sw/2, y: -sh/2}, {x: sw/2, y: -sh/2}, {x: sw/2, y: sh/2}, {x: -sw/2, y: sh/2} ]; 
                    } else { 
                        pts = s.params.points; 
                    }
                    if (!pts || !s.group) continue;

                    const transform = s.group.getTransform();
                    for (let i = 0; i < pts.length; i++) {
                        const sp1 = transform.point(pts[i]); 
                        const sp2 = transform.point(pts[(i + 1) % pts.length]);
                        const C = sp2.x - sp1.x, D = sp2.y - sp1.y;
                        const lenSq = C * C + D * D;
                        if (lenSq !== 0) {
                            const param = Math.max(0, Math.min(1, ((midX - sp1.x) * C + (midY - sp1.y) * D) / lenSq));
                            if (Math.hypot(midX - (sp1.x + param*C), midY - (sp1.y + param*D)) < 5) {
                                h = s.params.height3D !== undefined ? s.params.height3D : 100;
                                underlyingWall = true;
                                break;
                            }
                        }
                    }
                    if (underlyingWall) break;
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
                        position.y = h; // Lift railing to sit on top of underlying wall
                        inst.position.copy(position);

                        const target = position.clone().add(direction);
                        inst.lookAt(target);
                        inst.rotateY(-Math.PI / 2);

                        wallGroup.add(inst);
                    }                }).catch(e => {
                    console.error(`[3D Engine] Failed to load railing model from ${config.model}:`, e);
                    buildBaseWall(totalH, true);
                });
            } else {
                buildBaseWall(totalH, true);
            }
        });
    }

    buildStaticFloors(levelsJsonArray, activeIndex, viewMode3D, stairs = []) {
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
                            
                            if (!underlyingWall && data.shapes) {
                                for (let s of data.shapes) {
                                    if (s.type !== 'shape_rect' && s.type !== 'shape_polygon') continue;
                                    let pts = [];
                                    if (s.type === 'shape_rect') { 
                                        const sw = s.params.width; const sh = s.params.height; 
                                        pts = [ {x: -sw/2, y: -sh/2}, {x: sw/2, y: -sh/2}, {x: sw/2, y: sh/2}, {x: -sw/2, y: sh/2} ]; 
                                    } else { 
                                        pts = s.params.points; 
                                    }
                                    if (!pts) continue;

                                    const rad = (s.rotation || 0) * Math.PI / 180;
                                    const cos = Math.cos(rad), sin = Math.sin(rad);
                                    const sx = s.scaleX || 1, sy = s.scaleY || 1;
                                    const cx = s.x || 0, cy = s.y || 0;

                                    for (let i = 0; i < pts.length; i++) {
                                        const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
                                        const sp1 = { x: cx + (p1.x * sx * cos - p1.y * sy * sin), y: cy + (p1.x * sx * sin + p1.y * sy * cos) };
                                        const sp2 = { x: cx + (p2.x * sx * cos - p2.y * sy * sin), y: cy + (p2.x * sx * sin + p2.y * sy * cos) };

                                        const C = sp2.x - sp1.x, D = sp2.y - sp1.y;
                                        const lenSq = C * C + D * D;
                                        if (lenSq !== 0) {
                                            const param = Math.max(0, Math.min(1, ((midX - sp1.x) * C + (midY - sp1.y) * D) / lenSq));
                                            if (Math.hypot(midX - (sp1.x + param*C), midY - (sp1.y + param*D)) < 5) {
                                                underlyingWall = true;
                                                h = s.params !== undefined && s.params.height3D !== undefined ? s.params.height3D : 100;
                                                break;
                                            }
                                        }
                                    }
                                    if (underlyingWall) break;
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
                                const maxH = totalH; // totalH is the wall height (h)
                                if (widg.type === 'door') {
                                    const dh = Math.min(DOOR_HEIGHT, maxH);
                                    hole.moveTo(wCenter - halfW, 0); hole.lineTo(wCenter + halfW, 0); hole.lineTo(wCenter + halfW, dh); hole.lineTo(wCenter - halfW, dh); hole.lineTo(wCenter - halfW, 0);
                                } else if (widg.type === 'window') {
                                    const ws = Math.min(WINDOW_SILL, maxH);
                                    const wh = Math.min(WINDOW_SILL + WINDOW_HEIGHT, maxH);
                                    hole.moveTo(wCenter - halfW, ws); hole.lineTo(wCenter + halfW, ws); hole.lineTo(wCenter + halfW, wh); hole.lineTo(wCenter - halfW, wh); hole.lineTo(wCenter - halfW, ws);
                                }
                                wallShape.holes.push(hole);

                                const type = widg.type || widg.configId;
                                if (WIDGET_REGISTRY[type] && WIDGET_REGISTRY[type].render3D) {
                                    widg.x = w.startX + Math.cos(angle) * wCenter;
                                    widg.z = w.startY + Math.sin(angle) * wCenter;
                                    widg.angle = angle;
                                    widg.thick = w.thickness;
                                    widg.wall = w;
                                    const widgetGroup = WIDGET_REGISTRY[type].render3D(floorGroup, widg, this.ctx.helpers);
                                    if (widgetGroup) this.ctx.interactables.push(widgetGroup);
                                }
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

    buildShapes(shapes) {
        if (!shapes) return;
        shapes.forEach(shape => {
            const h = shape.params.height3D || 100;
            let geo, mat;
            const color = shape.params.fill ? parseInt(shape.params.fill.replace('#', '0x')) : 0x38bdf8;
            mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });

            if (shape.type === 'shape_rect') {
                geo = new THREE.BoxGeometry(shape.params.width, h, shape.params.height);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(shape.group.x(), h / 2, shape.group.y());
                mesh.rotation.y = -(shape.rotation || 0) * Math.PI / 180;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData = { isFurniture: true, entity: shape };
                this.ctx.interactables.push(mesh);
                this.ctx.structureGroup.add(mesh);
                shape.mesh3D = mesh;
            } else if (shape.type === 'shape_circle') {
                geo = new THREE.CylinderGeometry(shape.params.radius, shape.params.radius, h, 32);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(shape.group.x(), h / 2, shape.group.y());
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData = { isFurniture: true, entity: shape };
                this.ctx.interactables.push(mesh);
                this.ctx.structureGroup.add(mesh);
                shape.mesh3D = mesh;
            } else if (shape.type === 'shape_triangle' || shape.type === 'shape_polygon') {
                const shape2d = new THREE.Shape();
                if (shape.params.points && shape.params.points.length >= 3) {
                    const pts = shape.params.points;
                    
                    shape2d.moveTo(pts[0].x, pts[0].y);
                    for(let i=1; i<pts.length; i++) shape2d.lineTo(pts[i].x, pts[i].y);
                    shape2d.lineTo(pts[0].x, pts[0].y);
                    
                    geo = new THREE.ExtrudeGeometry(shape2d, { depth: h, bevelEnabled: false });
                    geo.rotateX(Math.PI / 2);
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.position.set(shape.group.x(), h, shape.group.y());
                    mesh.rotation.y = -(shape.rotation || 0) * Math.PI / 180;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    mesh.userData = { isFurniture: true, entity: shape };
                    this.ctx.interactables.push(mesh);
                    this.ctx.structureGroup.add(mesh);
                    shape.mesh3D = mesh;
                }
            }
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

                while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor && !mesh.userData.isFloor && !mesh.userData.isWidget) mesh = mesh.parent;
                
                if (mesh && (mesh.userData.isFurniture || mesh.userData.isWallSide || mesh.userData.isWallDecor || mesh.userData.isFloor || mesh.userData.isWidget)) {
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
            } else if (this.mode === 'adjust' && this.isPlacing && this.selectedObject && this.selectedObject.userData.isWidget) {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const target = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
                    target.add(this.dragOffset);
                    const entity = this.selectedObject.userData.entity;
                    const wall = entity.wall || (entity.parentWall ? entity.parentWall : null);
                    if (wall) {
                        const p1 = wall.startAnchor ? wall.startAnchor.position() : {x: wall.startX, y: wall.startY};
                        const p2 = wall.endAnchor ? wall.endAnchor.position() : {x: wall.endX, y: wall.endY};
                        const C = p2.x - p1.x, D = p2.y - p1.y;
                        const lenSq = C * C + D * D;
                        if (lenSq !== 0) {
                            const param = Math.max(0.01, Math.min(0.99, ((target.x - p1.x) * C + (target.z - p1.y) * D) / lenSq));
                            entity.t = param;
                            if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
                            else if (this.ctx.syncToUI) this.ctx.syncToUI();
                        }
                    }
                }
            } else {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const intersects = this.raycaster.intersectObjects(this.ctx.interactables, true);
                if (intersects.length > 0) {
                    dom.style.cursor = 'pointer';
                    let mesh = intersects[0].object;
                    while (mesh.parent && !mesh.userData.isFurniture && !mesh.userData.isWallSide && !mesh.userData.isWallDecor && !mesh.userData.isRoom && !mesh.userData.isRoof && !mesh.userData.isWidget) mesh = mesh.parent;
                    if (this.hoveredObject !== mesh) {
                        if (this.hoveredObject && this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget)) this.setHighlight(this.hoveredObject, false);
                        this.hoveredObject = mesh;
                        if (this.hoveredObject && this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget)) this.setHighlight(this.hoveredObject, true, 0x93c5fd);
                    }
                } else {
                    dom.style.cursor = 'auto';
                    if (this.hoveredObject) {
                        if (this.hoveredObject !== this.selectedObject && (this.hoveredObject.userData.isFurniture || this.hoveredObject.userData.isWallDecor || this.hoveredObject.userData.isRoof || this.hoveredObject.userData.isRoom || this.hoveredObject.userData.isWidget)) this.setHighlight(this.hoveredObject, false);
                        this.hoveredObject = null;
                    }
                }
            }
        });

        dom.addEventListener('dblclick', (e) => {
            if (this.ctx.viewMode3D === 'preview') return;
            if (this.mode === 'camera') return;
            if (this.mode === 'adjust' && this.selectedObject && this.selectedObject.userData.isWidget) {
                const mesh = this.selectedObject;
                const wallGroup = mesh.parent; // sceneGroup in builder? Wait, in ActiveFloor: "WIDGET_REGISTRY[type].render3D(this.ctx.structureGroup...)"
                // But double clicking simply changes mode to drag along wall
                const entity = mesh.userData.entity;
                if (!entity.wall) return;
                const wallNormal = new THREE.Vector3(0,0,1).applyEuler(mesh.rotation);
                this.dragPlane.setFromNormalAndCoplanarPoint(wallNormal, mesh.getWorldPosition(new THREE.Vector3()));
                this.isPlacing = true;
                dom.style.cursor = 'grabbing';
                const target = new THREE.Vector3();
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) this.dragOffset.copy(mesh.position).sub(target);
            }
        });

        window.addEventListener('pointerup', () => {
            if (this.isPlacing && this.selectedObject && (this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isWidget)) {
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

    setHighlight(group, active, color = 0x3b82f6) {
        if (!group) return;
        group.traverse((child) => {
            if (child.isMesh && !child.userData.isHitbox && child.material && child.material.type !== 'MeshBasicMaterial') {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    if (mat.emissive !== undefined) {
                        if (active) {
                            if (mat.userData.origEmissive === undefined) { mat.userData.origEmissive = mat.emissive.getHex(); mat.userData.origEmissiveIntensity = mat.emissiveIntensity || 0; }
                            mat.emissive.setHex(color); mat.emissiveIntensity = 0.5;
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
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isFloor || this.selectedObject.userData.isWidget)) this.setHighlight(this.selectedObject, false);
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
            let foundSupport = false;
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
                        foundSupport = true;
                            break;
                        }
                    }
                }

            if (!foundSupport && this.ctx.planner.shapes) {
                for (let s of this.ctx.planner.shapes) {
                    if (s.type !== 'shape_rect' && s.type !== 'shape_polygon') continue;
                    let pts = []; 
                    if (s.type === 'shape_rect') { 
                        const sw = s.params.width; const sh = s.params.height; 
                        pts = [ {x: -sw/2, y: -sh/2}, {x: sw/2, y: -sh/2}, {x: sw/2, y: sh/2}, {x: -sw/2, y: sh/2} ]; 
                    } else { 
                        pts = s.params.points; 
                    }
                    if (!pts || !s.group) continue;

                    const transform = s.group.getTransform();
                    for (let i = 0; i < pts.length; i++) {
                        const sp1 = transform.point(pts[i]); 
                        const sp2 = transform.point(pts[(i + 1) % pts.length]);
                        const C = sp2.x - sp1.x, D = sp2.y - sp1.y;
                        const lenSq = C * C + D * D;
                        if (lenSq !== 0) {
                            const param = Math.max(0, Math.min(1, ((midX - sp1.x) * C + (midY - sp1.y) * D) / lenSq));
                            if (Math.hypot(midX - (sp1.x + param*C), midY - (sp1.y + param*D)) < 5) {
                                currentH = s.params.height3D !== undefined ? s.params.height3D : 100;
                                foundSupport = true;
                                break;
                            }
                        }
                    }
                    if (foundSupport) break;
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
        else if (object.userData.isFurniture || object.userData.isWallDecor || object.userData.isFloor || object.userData.isWidget) {
            if (object.userData.isFurniture) type = 'furniture';
            else if (object.userData.isWallDecor) type = 'wallDecor';
            else if (object.userData.isFloor) type = 'room';
            else if (object.userData.isWidget) type = 'widget';
            this.setHighlight(object, true);
        }
        if (type && this.ctx.onEntitySelect) this.ctx.onEntitySelect(object.userData.entity, type, side);
    }

    deselect() {
        this.cancelRelocation();
        if (this.selectedObject && (this.selectedObject.userData.isFurniture || this.selectedObject.userData.isWallDecor || this.selectedObject.userData.isFloor || this.selectedObject.userData.isWidget)) this.setHighlight(this.selectedObject, false);
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
        
        this.helpers = {
            getDynamicMaterial: (matId, category) => {
                let conf;
                if (category === 'door') conf = DOOR_MATERIALS[matId] || DOOR_MATERIALS.wood;
                else if (category === 'window_frame') conf = WINDOW_FRAME_MATERIALS[matId] || WINDOW_FRAME_MATERIALS.alum_powder;
                else if (category === 'window_glass') conf = WINDOW_GLASS_MATERIALS[matId] || WINDOW_GLASS_MATERIALS.clear;
                
                if (!conf) return new THREE.MeshStandardMaterial();
                
                return new THREE.MeshStandardMaterial({
                    color: conf.color,
                    roughness: conf.roughness !== undefined ? conf.roughness : 0.5,
                    metalness: conf.metalness !== undefined ? conf.metalness : 0.1,
                    transmission: conf.transmission || 0,
                    ior: conf.ior || 1.5,
                    transparent: conf.transparent || false,
                    opacity: conf.transmission ? (1 - conf.transmission) : 1
                });
            }
        };

        this.envBuilder = new EnvironmentBuilder(this);
        this.stairBuilder = new Stair3DBuilder(this.assets, this.interactables);
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
        
        obj.position.set(entity.group.x(), 0, entity.group.y());
        obj.rotation.y = -(entity.rotation || 0) * Math.PI / 180;

        const color = entity.params.fill ? parseInt(entity.params.fill.replace('#', '0x')) : 0x38bdf8;
        if (obj.material && obj.material.color) {
            obj.material.color.setHex(color);
        }
        
        const hitbox = obj.children.find(c => c.userData.isHitbox);
        if (hitbox) {
            hitbox.geometry.dispose();
            hitbox.geometry = obj.geometry;
        }
        this.isUpdatingFromUI = false;
    }

    syncToUI() {
        if (!this.isUpdatingFromUI && this.interactions.selectedObject && this.interactions.selectedObject.userData.isFurniture) {
            const ent = this.interactions.selectedObject.userData.entity;
            if (ent && ent.group) { ent.group.x(this.interactions.selectedObject.position.x); ent.group.y(this.interactions.selectedObject.position.z); ent.update(); }
        }
        if (this.onEntityTransform) this.onEntityTransform();
    }

    deepDispose(obj) {
        if (obj.userData && obj.userData.keepAlive) return;
        
        if (obj.geometry && !obj.geometry.userData?.keepAlive) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => { if (!m.userData?.keepAlive) m.dispose(); });
            } else {
                if (!obj.material.userData?.keepAlive) obj.material.dispose();
            }
        }
        if (obj.children) [...obj.children].forEach(c => this.deepDispose(c));
    }

    buildScene(walls, rooms, stairs = [], furnitureList = [], roofs = [], shapes = [], levelsJsonArray = [], activeIndex = 0, viewMode3D = 'full-edit', preserveCamera = false) {
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

        this.envBuilder.buildActiveFloor(walls, rooms, shapes, stairs);
        this.stairBuilder.build(stairs, this.structureGroup, activeIndex);
        if (furnitureList) furnitureList.forEach(furn => this.furnitureManager.load(furn));

        if (roofs && roofs.length > 0) this.envBuilder.buildRoofs(roofs, activeIndex, walls, this.structureGroup);
        if (shapes && shapes.length > 0) this.envBuilder.buildShapes(shapes);

        if (viewMode3D !== 'isolate' && levelsJsonArray && levelsJsonArray.length > 0) {
            this.envBuilder.buildStaticFloors(levelsJsonArray, activeIndex, viewMode3D, stairs);
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
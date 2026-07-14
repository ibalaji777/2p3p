import * as THREE from 'three';
import { WIDGET_REGISTRY, ROOF_DECOR_REGISTRY, WALL_DECOR_REGISTRY, MOLDING_REGISTRY, FURNITURE_REGISTRY, RAILING_REGISTRY } from './registry.js';
import { Stair3DBuilder } from '../features/stairs/stairs.renderer3d.js';
import { Molding3DBuilder } from './engine3d/Molding3DBuilder.js';
import { Railing3DBuilder } from '../features/railing/builders/Railing3DBuilder.js';

export class ThumbnailGenerator {
    constructor(ctx) {
        this.ctx = ctx;
        
        // Create an offscreen renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        this.renderer.setSize(256, 256); // Size of the thumbnail
        this.renderer.setPixelRatio(2); // High DPI for crispness
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        this.scene = new THREE.Scene();

        // Studio Lighting Setup
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);
        
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
        keyLight.position.set(100, 150, 100);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.bias = -0.001;
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xccddff, 0.4);
        fillLight.position.set(-100, 50, -100);
        this.scene.add(fillLight);

        // Ground plane to catch shadows without rendering the plane itself
        const groundGeo = new THREE.PlaneGeometry(1000, 1000);
        const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        this.camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 1000);
        
        // Cache to prevent re-rendering the same parameters
        this.cache = new Map();
    }

    async generate(type, params) {
        // Normalize specific catalog IDs back to broad categories for special procedural generators
        if (type && type.startsWith('stair_v5_')) type = 'staircase';
        if (type && type.startsWith('preset_dormer_')) type = 'dormer';

        // 1. Unified Registry Lookup
        let registryConfig = null;
        if (WIDGET_REGISTRY[type]) registryConfig = WIDGET_REGISTRY[type];
        else if (RAILING_REGISTRY && RAILING_REGISTRY[type]) registryConfig = RAILING_REGISTRY[type];
        else if (FURNITURE_REGISTRY && FURNITURE_REGISTRY[type]) registryConfig = FURNITURE_REGISTRY[type];
        else if (MOLDING_REGISTRY && MOLDING_REGISTRY[type]) registryConfig = MOLDING_REGISTRY[type];

        const allowedNonWidgets = ['staircase', 'roof', 'dormer', 'outer', 'inner', 'arc', 'shape_rect', 'shape_circle', 'shape_triangle', 'railing', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'];
        
        if (!registryConfig && !allowedNonWidgets.includes(type)) return null;

        // Create a cache key from params to avoid re-rendering
        const cacheKey = type + '_' + JSON.stringify(params);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        if (this.currentObj) {
            this.scene.remove(this.currentObj);
            this.currentObj = null;
        }

        const group = new THREE.Group();
        const mergedConfig = { ...(registryConfig || {}), ...(params || {}) };
        
        let isModelLoaded = false;
        
        // 2. File-Based Asset Detection & Loading Strategy
        if (mergedConfig.model) {
            try {
                const model = await this.ctx.assets.getModel(mergedConfig);
                if (model) {
                    const clone = model.clone();
                    clone.updateMatrixWorld(true);
                    
                    // Normalize size and center for thumbnail framing
                    const bbox = new THREE.Box3().setFromObject(clone);
                    const size = bbox.getSize(new THREE.Vector3());
                    if (size.x > 0 && size.y > 0 && size.z > 0) {
                        const maxDim = Math.max(size.x, size.y, size.z);
                        // Scale down if extremely large
                        if (maxDim > 200) {
                            const scale = 150 / maxDim;
                            clone.scale.setScalar(scale);
                        }
                    }
                    
                    // Force material update for rendering
                    clone.traverse(child => {
                        if (child.isMesh && child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m.needsUpdate = true);
                            } else {
                                child.material.needsUpdate = true;
                            }
                        }
                    });
                    
                    group.add(clone);
                    isModelLoaded = true;
                }
            } catch (err) {
                console.error(`[ThumbnailGenerator] Failed to load model for ${type}:`, err);
                // Fallback to error box
                const errMesh = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({color: 0xff0000}));
                group.add(errMesh);
                isModelLoaded = true;
            }
        }

        // 3. Procedural Assets Strategy
        if (!isModelLoaded) {
            if (type === 'roof' || type === 'dormer') {
                try {
                    if (ROOF_DECOR_REGISTRY['terracotta_tiles_roof']) await this.ctx.assets.getTexture(ROOF_DECOR_REGISTRY['terracotta_tiles_roof']);
                    if (WALL_DECOR_REGISTRY['white_plaster_wall']) await this.ctx.assets.getTexture(WALL_DECOR_REGISTRY['white_plaster_wall']);
                } catch (e) {}
            }
            
            // Dummy entity based on preset params
            const entity = { ...params };
            if (!entity.width) entity.width = type.startsWith('rail') ? 150 : (registryConfig?.defaultConfig?.width || 40);
            if (!entity.height) entity.height = type.startsWith('rail') ? 40 : (registryConfig?.defaultConfig?.height || (type === 'door' ? 84 : 48));
            
            entity.wall = { thickness: 10, config: { thickness: 10 } };
            entity.thick = 10;
            entity.localX = 0; entity.x = 0; entity.z = 0; entity.angle = 0;
            if (entity.facing === undefined) entity.facing = registryConfig?.defaultConfig?.facing || 1;
            if (entity.side === undefined) entity.side = registryConfig?.defaultConfig?.side || 1;

            if (type === 'staircase') {
                const stairBuilder = new Stair3DBuilder(this.ctx.assets, this.ctx.interactables);
                const shape = params.type ? params.type.split('stair_v5_')[1] : 'straight';
                const dummyStair = { 
                    ...params, 
                    shape, 
                    x: 0, y: 0, elevation: 0, rotation: 0,
                    railingLayout: 'none', // Remove noisy railings for clear thumbnail
                    hasUnderWall: false    // Remove solid underwall to show step profile clearly
                };
                if (dummyStair.steps && !dummyStair.totalSteps) dummyStair.totalSteps = dummyStair.steps;
                if (!dummyStair.totalSteps) dummyStair.totalSteps = 10; // Fewer steps = chunkier, more readable
                if (!dummyStair.flight1Steps) dummyStair.flight1Steps = 5;
                if (!dummyStair.flight2Steps) dummyStair.flight2Steps = 5;
                
                const stairWrapper = new THREE.Group();
                stairBuilder.build([dummyStair], stairWrapper, 0, false, 300);
                
                // Keep default rotation; the PerspectiveCamera will orbit to provide the 3/4 view.
                // Allow the actual beautiful materials and colors defined in params to be visible!
                group.add(stairWrapper);
            } else if (type === 'roof') {
                const dummyRoof = {
                    points: [{x: -100, y: -100}, {x: 100, y: -100}, {x: 100, y: 100}, {x: -100, y: 100}],
                    config: { ...params, roofType: params.roofType || 'gable', material: 'terracotta_tiles_roof', overhang: params.overhang !== undefined ? params.overhang : 8 },
                    x: 0, y: 0, elevation: 0, rotation: 0
                };
                this.ctx.envBuilder.buildRoofs([dummyRoof], 0, false, group);
            } else if (type === 'dormer') {
                const w = params.width || 120;
                const d = params.depth || 150;
                const wallH = params.wallHeight || 120;
                const wallMat = new THREE.MeshStandardMaterial({color: 0xffffff});
                const baseGeo = new THREE.BoxGeometry(w, wallH, d);
                const baseMesh = new THREE.Mesh(baseGeo, wallMat);
                baseMesh.position.y = wallH / 2;
                group.add(baseMesh);
                const dummyRoof = {
                    points: [{x: -w/2, y: -d/2}, {x: w/2, y: -d/2}, {x: w/2, y: d/2}, {x: -w/2, y: d/2}],
                    config: { roofType: params.roofType || 'gable', pitch: params.pitch || 35, material: 'terracotta_tiles_roof', thick: 10, ridgeAxis: 'y', overhang: params.overhang !== undefined ? params.overhang : 8 },
                    x: 0, y: 0, elevation: wallH, rotation: 0
                };
                
                if (dummyRoof.config.roofType === 'gable') {
                    const roofH = (w / 2) * Math.tan(dummyRoof.config.pitch * Math.PI / 180);
                    const shape = new THREE.Shape();
                    shape.moveTo(-w/2, 0);
                    shape.lineTo(w/2, 0);
                    shape.lineTo(0, roofH);
                    shape.lineTo(-w/2, 0);
                    
                    const gableMat = new THREE.MeshStandardMaterial({color: 0xffffff, side: THREE.DoubleSide});
                    const gableGeo = new THREE.ShapeGeometry(shape);
                    
                    const frontGable = new THREE.Mesh(gableGeo, gableMat);
                    frontGable.position.set(0, wallH, d/2);
                    group.add(frontGable);
                    
                    const backGable = new THREE.Mesh(gableGeo, gableMat);
                    backGable.position.set(0, wallH, -d/2);
                    group.add(backGable);
                }

                try {
                    this.ctx.envBuilder.buildRoofs([dummyRoof], 0, false, group);
                } catch(e) {
                    const errMesh = new THREE.Mesh(new THREE.BoxGeometry(w, 20, d), new THREE.MeshBasicMaterial({color: 0xff0000}));
                    errMesh.position.y = wallH + 10;
                    group.add(errMesh);
                }
            } else if (MOLDING_REGISTRY && MOLDING_REGISTRY[type]) {
                const moldBuilder = new Molding3DBuilder();
                const moldData = MOLDING_REGISTRY[type]?.defaultConfig || { profileType: 'flat', depth: 5, t: 0.5 };
                const length = 30; // Shorter chunk to emphasize the profile
                const moldGroup = moldBuilder.buildMolding({ ...moldData, width: length, depth: moldData.depth, type: type }, length, 10, this.ctx.helpers);
                
                // Isometric rotation to clearly show the cut profile and the face
                moldGroup.rotation.y = Math.PI / 6; 
                moldGroup.rotation.x = Math.PI / 12;

                // Apply a glossy material so lighting highlights the subtle curves and details
                const glossyMat = new THREE.MeshStandardMaterial({
                    color: 0xe0e0e0,
                    roughness: 0.3,
                    metalness: 0.2
                });
                moldGroup.traverse(child => {
                    if (child.isMesh) child.material = glossyMat;
                });

                group.add(moldGroup);
            } else if (['outer', 'inner', 'arc'].includes(type)) {
                const w = 100, h = 100, d = 10;
                let geo;
                if (type === 'arc') geo = new THREE.CylinderGeometry(100, 100, h, 32, 1, false, 0, Math.PI / 2);
                else geo = new THREE.BoxGeometry(w, h, d);
                const wallMat = new THREE.MeshStandardMaterial({ color: type === 'outer' ? 0xffffff : 0xeeeeee });
                const mesh = new THREE.Mesh(geo, wallMat);
                group.add(mesh);
            } else if (['shape_rect', 'shape_circle', 'shape_triangle'].includes(type)) {
                const size = 60, h = 60;
                let geo;
                if (type === 'shape_rect') geo = new THREE.BoxGeometry(size, h, size);
                else if (type === 'shape_circle') geo = new THREE.CylinderGeometry(size/2, size/2, h, 32);
                else geo = new THREE.CylinderGeometry(size/2, size/2, h, 3);
                const mat = new THREE.MeshStandardMaterial({ color: 0x88ccff });
                const mesh = new THREE.Mesh(geo, mat);
                group.add(mesh);
            } else if (type === 'railing' || (RAILING_REGISTRY && RAILING_REGISTRY[type])) {
                const configId = RAILING_REGISTRY && RAILING_REGISTRY[type] ? type : (params.configId || params.type || 'glass_stainless');
                const mockRailing = {
                    configId: configId,
                    points: [-30, 0, 30, 0],
                    thickness: RAILING_REGISTRY[configId]?.thickness || 2,
                    height: RAILING_REGISTRY[configId]?.height || 40,
                    config: RAILING_REGISTRY[configId]
                };
                const mesh = Railing3DBuilder.build(mockRailing);
                // Center the generated mesh
                mesh.position.set(0, 0, 0);
                mesh.rotation.y = Math.PI / 6; // Isometric angle
                group.add(mesh);
            } else if (['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(type)) {
                const w = 100, h = 100, d = 10;
                const shape = new THREE.Shape();
                shape.moveTo(-w/2, -h/2); shape.lineTo(w/2, -h/2); shape.lineTo(w/2, h/2); shape.lineTo(-w/2, h/2); shape.lineTo(-w/2, -h/2);
                const hole = new THREE.Path();
                if (type === 'arch_opening') {
                    hole.moveTo(-20, -h/2); hole.lineTo(20, -h/2); hole.lineTo(20, 0);
                    hole.absarc(0, 0, 20, 0, Math.PI, false); hole.lineTo(-20, -h/2);
                } else if (type === 'circular_opening') {
                    hole.absarc(0, 0, 20, 0, Math.PI*2, false);
                } else {
                    hole.moveTo(-20, -20); hole.lineTo(20, -20); hole.lineTo(20, 20); hole.lineTo(-20, 20); hole.lineTo(-20, -20);
                }
                shape.holes.push(hole);
                const extrudeSettings = { depth: d, bevelEnabled: false };
                const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geo.translate(0, 0, -d/2);
                const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
                const mesh = new THREE.Mesh(geo, wallMat);
                group.add(mesh);
            } else if (type.startsWith('kitchen_')) {
                const w = params.width || 240;
                const d = params.depth || 60;
                
                const matBase = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 }); 
                const matToe = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
                const matTop = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.1 }); 
                const matDoor = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });
                const matUpper = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 }); 
                const matHandle = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.2, metalness: 0.8 }); 
                
                const buildRow = (len, dep, rowType) => {
                    const row = new THREE.Group();
                    if (len <= 0) return row;
                    const numMods = Math.max(1, Math.round(len / 60));
                    const modW = len / numMods;
                    
                    if (rowType === 'base') {
                        const bH = 90, tThick = 4, toeH = 10, toeRecess = 5;
                        const toe = new THREE.Mesh(new THREE.BoxGeometry(len, toeH, dep - toeRecess), matToe);
                        toe.position.set(len/2, toeH/2, (dep - toeRecess)/2);
                        row.add(toe);
                        
                        const top = new THREE.Mesh(new THREE.BoxGeometry(len, tThick, dep + 2), matTop);
                        top.position.set(len/2, bH - tThick/2, (dep + 2)/2);
                        row.add(top);
                        
                        for(let i=0; i<numMods; i++) {
                            const X = i * modW + modW/2;
                            const cabH = bH - tThick - toeH;
                            const body = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.2, cabH, dep - 2), matBase);
                            body.position.set(X, toeH + cabH/2, (dep - 2)/2);
                            
                            const door = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, cabH - 0.4, 1.8), matDoor);
                            door.position.set(X, toeH + cabH/2, dep - 2 + 0.9);
                            
                            const handle = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.4, 1.5, 3), matHandle);
                            handle.position.set(X, toeH + cabH - 10, dep - 2 + 1.8 + 1.5);
                            row.add(body, door, handle);
                        }
                    } else {
                        const uH = 70, yStart = 150; 
                        for(let i=0; i<numMods; i++) {
                            const X = i * modW + modW/2;
                            const body = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.2, uH, dep - 2), matBase);
                            body.position.set(X, yStart + uH/2, (dep - 2)/2);
                            
                            const door = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, uH - 0.4, 1.8), matUpper);
                            door.position.set(X, yStart + uH/2, dep - 2 + 0.9);
                            
                            const handle = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.4, 1.5, 3), matHandle);
                            handle.position.set(X, yStart + 10, dep - 2 + 1.8 + 1.5);
                            row.add(body, door, handle);
                        }
                    }
                    return row;
                };

                if (!type.endsWith('_upper')) {
                    group.add(buildRow(w, 60, 'base'));
                    if (type.includes('l_shape') || type.includes('u_shape')) {
                        const leftBase = buildRow(d - 60, 60, 'base');
                        leftBase.rotation.y = Math.PI / 2;
                        leftBase.position.set(0, 0, d);
                        group.add(leftBase);
                    }
                    if (type.includes('u_shape')) {
                        const rightBase = buildRow(d - 60, 60, 'base');
                        rightBase.rotation.y = -Math.PI / 2;
                        rightBase.position.set(w, 0, 60);
                        group.add(rightBase);
                    }
                } else {
                    group.add(buildRow(w, 35, 'upper'));
                    if (type.includes('l_shape') || type.includes('u_shape')) {
                        const leftUpper = buildRow(d - 35, 35, 'upper');
                        leftUpper.rotation.y = Math.PI / 2;
                        leftUpper.position.set(0, 0, d);
                        group.add(leftUpper);
                    }
                    if (type.includes('u_shape')) {
                        const rightUpper = buildRow(d - 35, 35, 'upper');
                        rightUpper.rotation.y = -Math.PI / 2;
                        rightUpper.position.set(w, 0, 35);
                        group.add(rightUpper);
                    }
                }
            } else if (registryConfig && registryConfig.render3D) {
                // Procedural widgets explicitly define their render3D function
                const widgetGroup = registryConfig.render3D(group, entity, this.ctx.helpers);
            }
        }
        
        // Center the group
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        
        // Reset pivot
        group.position.x = -center.x;
        // Float slightly above the ground plane to avoid z-fighting on shadows
        group.position.y = -box.min.y + 0.1;
        group.position.z = -center.z;

        // Patch highly metallic materials so they don't look like black silhouettes under studio lighting without an envMap
        group.traverse(child => {
            if (child.isMesh && child.material) {
                const patchMat = (mat, index) => {
                    if (mat.metalness > 0.4 || mat.transparent) {
                        const newMat = mat.clone();
                        if (newMat.metalness > 0.4) {
                            newMat.metalness = 0.3;
                            newMat.roughness = Math.max(newMat.roughness || 0, 0.6);
                        }
                        // Ensure glass looks somewhat visible against white backgrounds
                        if (newMat.transparent && newMat.transmission > 0) {
                            newMat.color.setHex(0xe0f2fe); // Slight blue tint
                            newMat.opacity = 0.6;
                        }
                        if (index !== undefined && Array.isArray(child.material)) {
                            child.material[index] = newMat;
                        } else {
                            child.material = newMat;
                        }
                    }
                };
                if (Array.isArray(child.material)) {
                    child.material.forEach((m, i) => patchMat(m, i));
                } else {
                    patchMat(child.material);
                }
            }
        });
        
        this.scene.add(group);
        this.currentObj = group;

        // Determine the best camera for the thumbnail type
        let activeCamera = this.camera;
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetY = size.y / 2;

        if (type === 'staircase') {
            const fov = 32;
            activeCamera = new THREE.PerspectiveCamera(fov, 1, 1, 2000);
            
            // Frame the bounding box to fill ~80% of the thumbnail (10% padding on edges -> 1.25 multiplier)
            // For stairs, length (size.z) is usually the largest dimension. We ensure it fits within the 32° FOV.
            const fitSize = maxDim * 1.25; 
            const distance = (fitSize / 2) / Math.tan((fov / 2) * Math.PI / 180);
            
            // Apply orbital rotation: 22° elevation, -55° azimuth
            const phi = (90 - 22) * Math.PI / 180;
            const theta = -55 * Math.PI / 180;
            
            activeCamera.position.setFromSphericalCoords(distance, phi, theta);
            activeCamera.position.y += targetY; // Offset orbit center to bounding box center
            
            activeCamera.lookAt(0, targetY, 0);
            activeCamera.updateProjectionMatrix();
        } else if (RAILING_REGISTRY && RAILING_REGISTRY[type]) {
            const fov = 35;
            activeCamera = new THREE.PerspectiveCamera(fov, 1, 1, 2000);
            
            const fitSize = maxDim * 1.5; 
            const distance = (fitSize / 2) / Math.tan((fov / 2) * Math.PI / 180);
            
            // Orbit: 25° elevation, 35° azimuth (shows the front/length of the railing nicely)
            const phi = (90 - 25) * Math.PI / 180;
            const theta = 35 * Math.PI / 180;
            
            activeCamera.position.setFromSphericalCoords(distance, phi, theta);
            activeCamera.position.y += targetY;
            
            activeCamera.lookAt(0, targetY, 0);
            activeCamera.updateProjectionMatrix();
        } else {
            const frustumSize = maxDim * 1.4; // Leave some margin
            
            this.camera.left = -frustumSize / 2;
            this.camera.right = frustumSize / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = -frustumSize / 2;
            this.camera.updateProjectionMatrix();

            // Position camera for an isometric view (front-right-top)
            this.camera.position.set(maxDim, maxDim * 0.8, maxDim);
            this.camera.lookAt(0, targetY, 0); // Look at the center of the object
        }

        // Give textures a tiny bit of time to load if they were fetched asynchronously in getDynamicMaterial
        await new Promise(resolve => setTimeout(resolve, 100));

        this.renderer.render(this.scene, activeCamera);
        
        const dataUrl = this.renderer.domElement.toDataURL('image/png');
        this.cache.set(cacheKey, dataUrl);
        
        return dataUrl;
    }
}

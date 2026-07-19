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
        const ambient = new THREE.AmbientLight(0xffffff, 1.2); // Increased for visibility
        this.scene.add(ambient);
        
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.5); // Increased for visibility
        keyLight.position.set(100, 150, 100);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.bias = -0.001;
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xccddff, 0.8); // Increased for visibility
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
                        // Scale to consistently fit the 150 unit frame, whether too big or too small
                        const scale = 150 / maxDim;
                        clone.scale.setScalar(scale);
                        clone.updateMatrixWorld(true);
                        
                        // Re-center object to ensure it's in the middle of the camera frustum
                        const centeredBbox = new THREE.Box3().setFromObject(clone);
                        const center = centeredBbox.getCenter(new THREE.Vector3());
                        clone.position.sub(center);
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
                
                let cBase = params.colorBase;
                let cDoor = params.colorDoor;
                let cHandle = params.colorHandle;
                
                let mBaseProps = { roughness: 0.9 };
                let mDoorProps = { roughness: 0.5 };
                let mUpperProps = { roughness: 0.4 };
                
                if (type === 'kitchen_straight_shaker') {
                    cBase = cBase || '#f8fafc'; // White base
                    cDoor = cDoor || '#f1f5f9'; // Soft Antique White doors
                    cHandle = cHandle || '#b45309'; // Premium Brass Handles
                } else if (type === 'kitchen_straight_floating') {
                    cBase = cBase || '#ffffff'; // Pure White
                    cDoor = cDoor || '#ffffff'; // Pure White
                    cHandle = cHandle || '#ffffff'; 
                    mDoorProps = { roughness: 0.1, metalness: 0.1 }; // High Gloss White finish
                } else if (type === 'kitchen_upper_glass') {
                    cBase = cBase || '#78350f'; // Warm Walnut Wood interior
                    cDoor = cDoor || '#F4F0EC'; // Creamy Warm White frame
                    cHandle = cHandle || '#D4AF37'; // Brushed Brass handles
                } else if (type === 'kitchen_upper_shelves') {
                    cBase = cBase || '#e6ccb2'; // Light Oak Wood shelves
                    cDoor = cDoor || '#e6ccb2';
                } else {
                    cBase = cBase || '#334155';
                    cDoor = cDoor || '#475569';
                    cHandle = cHandle || '#ffffff';
                }

                const matBase = new THREE.MeshStandardMaterial({ color: cBase, ...mBaseProps }); 
                const matToe = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });
                const matTop = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.1 }); 
                const matDoor = new THREE.MeshStandardMaterial({ color: cDoor, ...mDoorProps });
                const matUpper = new THREE.MeshStandardMaterial({ color: cDoor, ...mUpperProps }); 
                const matHandle = new THREE.MeshStandardMaterial({ color: cHandle, roughness: 0.2, metalness: 0.8 }); 
                
                const buildRow = (len, dep, rowType, style) => {
                    const row = new THREE.Group();
                    if (len <= 0) return row;
                    const numMods = Math.max(1, Math.round(len / 60));
                    const modW = len / numMods;
                    
                    if (rowType === 'base' || rowType === 'tall') {
                        const isFloating = style === 'kitchen_straight_floating';
                        const isShaker = style === 'kitchen_straight_shaker';
                        const isTall = rowType === 'tall';
                        const bH = isTall ? 210 : 90;
                        const toeH = (isFloating && !isTall) ? 20 : 10;
                        const toeRecess = 5;
                        const tThick = isFloating ? 1.5 : (isShaker ? 5 : 4);
                        
                        if (!isFloating || isTall) {
                            const toe = new THREE.Mesh(new THREE.BoxGeometry(len, toeH, dep - toeRecess), matToe);
                            toe.position.set(len/2, toeH/2, (dep - toeRecess)/2);
                            row.add(toe);
                        } else {
                            // Floating LED strip
                            const led = new THREE.Mesh(new THREE.BoxGeometry(len - 4, 1, 1), new THREE.MeshBasicMaterial({color: 0xffffff}));
                            led.position.set(len/2, toeH - 1, dep - 10);
                            row.add(led);
                        }
                        
                        if (!isTall && style !== 'kitchen_island') {
                            const top = new THREE.Mesh(new THREE.BoxGeometry(len, tThick, dep + 2), matTop);
                            top.position.set(len/2, bH - tThick/2, (dep + 2)/2);
                            row.add(top);
                        }
                        
                        for(let i=0; i<numMods; i++) {
                            const X = i * modW + modW/2;
                            const cabH = isTall ? bH - toeH : bH - tThick - toeH;
                            const body = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.2, cabH, dep - 2), matBase);
                            body.position.set(X, toeH + cabH/2, (dep - 2)/2);
                            
                            const doorGroup = new THREE.Group();
                            if (isTall) {
                                // Tall continuous doors with long handles
                                const door = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, cabH - 0.4, 1.8), matDoor);
                                const handle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 120, 2.5), matHandle);
                                handle.position.set((i%2===0)? modW/2 - 5 : -modW/2 + 5, 0, 2);
                                doorGroup.add(door, handle);
                            } else if (isShaker) {
                                // Shaker door simulation
                                const dFrame = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, cabH - 0.4, 1.8), matDoor);
                                const dPanel = new THREE.Mesh(new THREE.BoxGeometry(modW - 12, cabH - 12, 1.9), matBase); // Recessed visual
                                doorGroup.add(dFrame, dPanel);
                                
                                // Elegant horizontal handlebar
                                const handle = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.5, 1.5, 3), matHandle);
                                handle.position.set(0, cabH/2 - 10, 2);
                                doorGroup.add(handle);
                            } else if (isFloating) {
                                // Flat minimalist, with sleek long handlebar
                                const door = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, cabH - 0.4, 1.8), matDoor);
                                const handle = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.7, 1.2, 2.5), matHandle);
                                handle.position.set(0, cabH/2 - 10, 2);
                                doorGroup.add(door, handle);
                            } else {
                                // Standard
                                const door = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, cabH - 0.4, 1.8), matDoor);
                                const handle = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.4, 1.5, 3), matHandle);
                                handle.position.set(0, cabH/2 - 10, 2);
                                doorGroup.add(door, handle);
                            }
                            doorGroup.position.set(X, toeH + cabH/2, dep - 2 + 0.9);
                            
                            row.add(body, doorGroup);
                        }
                    } else {
                        const isGlass = style === 'kitchen_upper_glass';
                        const isShelves = style === 'kitchen_upper_shelves';
                        const uH = 70;
                        const yStart = 150; 

                        if (isShelves) {
                            const shelfThick = 4;
                            // Add Premium White Marble Backsplash
                            const mMarble = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.1 });
                            const backsplash = new THREE.Mesh(new THREE.BoxGeometry(len, uH, 2), mMarble);
                            backsplash.position.set(len/2, yStart + uH/2, 1);
                            row.add(backsplash);
                            
                            for(let s=0; s<3; s++) {
                                const shelf = new THREE.Mesh(new THREE.BoxGeometry(len, shelfThick, dep - 2), matBase);
                                shelf.position.set(len/2, yStart + s * 30 + shelfThick/2, (dep - 2)/2 + 2);
                                row.add(shelf);
                                
                                // Under-shelf warm LED lighting
                                const led = new THREE.Mesh(new THREE.BoxGeometry(len - 4, 0.5, 0.5), new THREE.MeshBasicMaterial({color: 0xffeedd}));
                                led.position.set(len/2, yStart + s * 30 - 0.25, 3);
                                row.add(led);
                            }
                        } else {
                            for(let i=0; i<numMods; i++) {
                                const X = i * modW + modW/2;
                                const body = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.2, uH, dep - 2), matBase);
                                body.position.set(X, yStart + uH/2, (dep - 2)/2);
                                
                                const doorGroup = new THREE.Group();
                                if (isGlass) {
                                    const dFrame = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, uH - 0.4, 1.8), matUpper);
                                    // Simulating fluted glass (rough, highly transmissive)
                                    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.95, opacity: 1, transparent: true, roughness: 0.4, ior: 1.5, thickness: 0.5 });
                                    const dGlass = new THREE.Mesh(new THREE.BoxGeometry(modW - 12, uH - 12, 1.9), glassMat);
                                    
                                    // Interior light
                                    const light = new THREE.PointLight(0xffeedd, 0.6, 100);
                                    light.position.set(X, yStart + uH - 5, dep/2);
                                    row.add(light);
                                    
                                    doorGroup.add(dFrame, dGlass);
                                    
                                    // Vertical sleek handlebar
                                    const handle = new THREE.Mesh(new THREE.BoxGeometry(1.2, uH * 0.5, 2.5), matHandle);
                                    handle.position.set(modW/2 - 8, -uH/2 + (uH * 0.5)/2 + 5, 2);
                                    doorGroup.add(handle);
                                } else {
                                    const door = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, uH - 0.4, 1.8), matUpper);
                                    const handle = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.4, 1.5, 3), matHandle);
                                    handle.position.set(0, -uH/2 + 10, 2);
                                    doorGroup.add(door, handle);
                                }
                                doorGroup.position.set(X, yStart + uH/2, dep - 2 + 0.9);
                                
                                row.add(body, doorGroup);
                            }
                        }
                    }
                    return row;
                };

                if (type === 'kitchen_island') {
                    // Front base cabinets
                    const frontBase = buildRow(w, 60, 'base', type);
                    group.add(frontBase);
                    
                    // Waterfall Countertop
                    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d + 2), matTop);
                    top.position.set(w/2, 90 - 2, d/2);
                    
                    // Left and Right waterfall legs
                    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(4, 90 - 4, d + 2), matTop);
                    leftLeg.position.set(2, 43, d/2);
                    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(4, 90 - 4, d + 2), matTop);
                    rightLeg.position.set(w - 2, 43, d/2);
                    
                    group.add(top, leftLeg, rightLeg);
                    
                    // Fluted Wood Back panel supporting the island overhang
                    const backGroup = new THREE.Group();
                    const slatW = 4;
                    const slatCount = Math.floor((w - 8) / slatW);
                    const matWood = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.8 }); // Rich Walnut
                    for (let i = 0; i < slatCount; i++) {
                        const slat = new THREE.Mesh(new THREE.CylinderGeometry(slatW/2, slatW/2, 86, 16), matWood);
                        slat.position.set(4 + i*slatW + slatW/2, 43, 61);
                        slat.scale.set(1, 1, 0.4); // flatten into half-ovals for fluted look
                        backGroup.add(slat);
                    }
                    group.add(backGroup);
                } else if (type === 'kitchen_tall_pantry') {
                    // Appliance garage alcove
                    const pW = w; const pD = d; const pH = 210;
                    const toe = new THREE.Mesh(new THREE.BoxGeometry(pW, 10, pD - 5), matToe); toe.position.set(pW/2, 5, pD/2 - 2.5);
                    
                    const lowH = 80;
                    const alcoveH = 45;
                    const upH = pH - 10 - lowH - alcoveH;
                    
                    // Split body to avoid z-fighting with open alcove
                    const bodyLower = new THREE.Mesh(new THREE.BoxGeometry(pW, lowH, pD), matBase);
                    bodyLower.position.set(pW/2, 10 + lowH/2, pD/2);
                    
                    const bodyUpper = new THREE.Mesh(new THREE.BoxGeometry(pW, upH, pD), matBase);
                    bodyUpper.position.set(pW/2, 10 + lowH + alcoveH + upH/2, pD/2);
                    
                    // Lower doors (Shaker)
                    const lDoorGroup = new THREE.Group();
                    const ldFrame = new THREE.Mesh(new THREE.BoxGeometry(pW-0.4, lowH-0.4, 1.8), matDoor);
                    const ldPanel = new THREE.Mesh(new THREE.BoxGeometry(pW-12, lowH-12, 1.9), matBase);
                    const lHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 30, 16), matHandle); lHandle.position.set(-pW/2 + 8, 0, 2);
                    lDoorGroup.add(ldFrame, ldPanel, lHandle);
                    lDoorGroup.position.set(pW/2, 10 + lowH/2, pD + 0.9);
                    
                    // Middle Alcove (Open shelf lined with stone)
                    const alGroup = new THREE.Group();
                    const alY = 10 + lowH;
                    const alBack = new THREE.Mesh(new THREE.BoxGeometry(pW-4, alcoveH, 2), matTop); alBack.position.set(pW/2, alY + alcoveH/2, 1);
                    const alBot = new THREE.Mesh(new THREE.BoxGeometry(pW-4, 2, pD), matTop); alBot.position.set(pW/2, alY + 1, pD/2);
                    const alTop = new THREE.Mesh(new THREE.BoxGeometry(pW-4, 2, pD), matTop); alTop.position.set(pW/2, alY + alcoveH - 1, pD/2);
                    const alL = new THREE.Mesh(new THREE.BoxGeometry(2, alcoveH, pD), matTop); alL.position.set(1, alY + alcoveH/2, pD/2);
                    const alR = new THREE.Mesh(new THREE.BoxGeometry(2, alcoveH, pD), matTop); alR.position.set(pW-1, alY + alcoveH/2, pD/2);
                    // LED Strip under alcove top
                    const led = new THREE.Mesh(new THREE.BoxGeometry(pW-8, 0.5, 2), new THREE.MeshBasicMaterial({color: 0xffffff}));
                    led.position.set(pW/2, alY + alcoveH - 2, pD/2);
                    alGroup.add(alBack, alBot, alTop, alL, alR, led);
                    
                    // Upper Doors (Shaker)
                    const uDoorGroup = new THREE.Group();
                    const udFrame = new THREE.Mesh(new THREE.BoxGeometry(pW-0.4, upH-0.4, 1.8), matDoor);
                    const udPanel = new THREE.Mesh(new THREE.BoxGeometry(pW-12, upH-12, 1.9), matBase);
                    const uHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 40, 16), matHandle); uHandle.position.set(-pW/2 + 8, 0, 2);
                    uDoorGroup.add(udFrame, udPanel, uHandle);
                    uDoorGroup.position.set(pW/2, 10 + lowH + alcoveH + upH/2, pD + 0.9);
                    
                    group.add(toe, bodyLower, bodyUpper, lDoorGroup, alGroup, uDoorGroup);
                } else if (!type.includes('_upper')) {
                    group.add(buildRow(w, 60, 'base', type));
                    if (type.includes('l_shape') || type.includes('u_shape')) {
                        const leftBase = buildRow(d - 60, 60, 'base', type);
                        leftBase.rotation.y = Math.PI / 2;
                        leftBase.position.set(0, 0, d);
                        group.add(leftBase);
                    }
                    if (type.includes('u_shape')) {
                        const rightBase = buildRow(d - 60, 60, 'base', type);
                        rightBase.rotation.y = -Math.PI / 2;
                        rightBase.position.set(w, 0, 60);
                        group.add(rightBase);
                    }
                } else {
                    group.add(buildRow(w, 35, 'upper', type));
                    if (type.includes('l_shape') || type.includes('u_shape')) {
                        const leftUpper = buildRow(d - 35, 35, 'upper', type);
                        leftUpper.rotation.y = Math.PI / 2;
                        leftUpper.position.set(0, 0, d);
                        group.add(leftUpper);
                    }
                    if (type.includes('u_shape')) {
                        const rightUpper = buildRow(d - 35, 35, 'upper', type);
                        rightUpper.rotation.y = -Math.PI / 2;
                        rightUpper.position.set(w, 0, 35);
                        group.add(rightUpper);
                    }
                }
            } else if (registryConfig && registryConfig.render3D) {
                // Procedural widgets explicitly define their render3D function
                const widgetGroup = registryConfig.render3D(group, entity, this.ctx.helpers);
            } else if (type.startsWith('sink_')) {
                const sW = params.width || 60;
                const sD = params.depth || 45;
                const sH = params.height || 20;
                
                const buildSinkBasin = (w, d, h, typeId) => {
                    const grp = new THREE.Group();
                    const isFarmhouse = typeId === 'sink_farmhouse';
                    const isDouble = typeId === 'sink_double';
                    const isStandard = typeId === 'sink_standard';
                    
                    // Premium Materials
                    const mSteel = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.25 });
                    const mGunmetal = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.3 });
                    const mBlackCeramic = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.1, roughness: 0.2 });
                    const mWood = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.9 });
                    const mBrass = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.9, roughness: 0.2 });
                    
                    const mDrainRim = isFarmhouse ? mBrass : new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.1 });
                    const mDrainHole = new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.9 });

                    let mSink = mSteel;
                    if (isStandard) mSink = mGunmetal; // Premium Gunmetal workstation
                    if (isFarmhouse) mSink = mBlackCeramic; // Matte black fluted farmhouse
                    
                    // Zero-radius for modern metal sinks, slightly rounded for farmhouse
                    const t = isFarmhouse ? 5 : 2.5; 
                    const r = isFarmhouse ? 4 : 0.5;   
                    
                    const shape = new THREE.Shape();
                    shape.moveTo(-w/2, -d/2); shape.lineTo(w/2, -d/2); shape.lineTo(w/2, d/2); shape.lineTo(-w/2, d/2); shape.lineTo(-w/2, -d/2);
                    
                    const makeHole = (hW, hD, offsetX) => {
                        const hole = new THREE.Path();
                        hole.moveTo(-hW+r+offsetX, -hD);
                        hole.lineTo(hW-r+offsetX, -hD);
                        hole.quadraticCurveTo(hW+offsetX, -hD, hW+offsetX, -hD+r);
                        hole.lineTo(hW+offsetX, hD-r);
                        hole.quadraticCurveTo(hW+offsetX, hD, hW-r+offsetX, hD);
                        hole.lineTo(-hW+r+offsetX, hD);
                        hole.quadraticCurveTo(-hW+offsetX, hD, -hW+offsetX, hD-r);
                        hole.lineTo(-hW+offsetX, -hD+r);
                        hole.quadraticCurveTo(-hW+offsetX, -hD, -hW+r+offsetX, -hD);
                        return hole;
                    };

                    if (isDouble) {
                        // 60/40 Split Double Sink
                        const basinL = (w * 0.55) / 2 - t;
                        const basinR = (w * 0.45) / 2 - t;
                        shape.holes.push(makeHole(basinL, d/2 - t, -w/2 + t + basinL));
                        shape.holes.push(makeHole(basinR, d/2 - t, w/2 - t - basinR));
                    } else {
                        shape.holes.push(makeHole(w/2 - t, d/2 - t, 0));
                    }

                    const rimGeo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.2, bevelThickness: 0.2 });
                    rimGeo.rotateX(-Math.PI/2); 
                    const rim = new THREE.Mesh(rimGeo, mSink);
                    grp.add(rim);

                    // Inner sloping bottom to drain
                    const botGeo = new THREE.BoxGeometry(w - t*1.5, 1, d - t*1.5);
                    const bot = new THREE.Mesh(botGeo, mSink);
                    bot.position.y = 0.5;
                    grp.add(bot);

                    const createDrain = (xPos) => {
                        const dGroup = new THREE.Group();
                        const rim = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.4, 16, 32), mDrainRim); rim.rotation.x = Math.PI/2;
                        const hole = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.2, 32), mDrainHole); hole.position.y = -0.2;
                        const strainer = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.4, 32), mDrainRim);
                        dGroup.add(rim, hole, strainer);
                        dGroup.position.set(xPos, 1, 0);
                        return dGroup;
                    };

                    if (isDouble) {
                        const basinL = (w * 0.55) / 2 - t;
                        const basinR = (w * 0.45) / 2 - t;
                        grp.add(createDrain(-w/2 + t + basinL));
                        grp.add(createDrain(w/2 - t - basinR));
                        
                        // Add premium bottom grids
                        const gridMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', wireframe: true });
                        const gridL = new THREE.Mesh(new THREE.BoxGeometry(basinL*1.8, 0.5, d - t*3, 10, 1, 10), gridMat);
                        gridL.position.set(-w/2 + t + basinL, 1.5, 0);
                        const gridR = new THREE.Mesh(new THREE.BoxGeometry(basinR*1.8, 0.5, d - t*3, 8, 1, 10), gridMat);
                        gridR.position.set(w/2 - t - basinR, 1.5, 0);
                        grp.add(gridL, gridR);
                    } else {
                        grp.add(createDrain(0));
                    }

                    if (isStandard) {
                        // Workstation accessories (Wood cutting board + roll-up rack)
                        const boardW = w * 0.35;
                        const board = new THREE.Mesh(new THREE.BoxGeometry(boardW, 1.5, d - t*1.5), mWood);
                        board.position.set(-w/2 + t + boardW/2, h - 1.5, 0);
                        
                        const rackW = w * 0.35;
                        const rackGroup = new THREE.Group();
                        for (let i = 0; i < 12; i++) {
                            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, d - t*1.5, 8), mSteel);
                            rod.rotation.x = Math.PI/2;
                            rod.position.set(-rackW/2 + (rackW/12)*i, 0, 0);
                            rackGroup.add(rod);
                        }
                        rackGroup.position.set(w/2 - t - rackW/2, h - 1, 0);
                        
                        grp.add(board, rackGroup);
                    }

                    if (isFarmhouse) {
                        // Fluted/Ribbed Apron Front
                        const apronDepth = t*3;
                        const apronGeo = new THREE.BoxGeometry(w + 2, h + 1, apronDepth);
                        const apron = new THREE.Mesh(apronGeo, mSink);
                        apron.position.set(0, h/2 - 0.5, d/2 - t);
                        grp.add(apron);
                        
                        // Add vertical ribs
                        const ribCount = Math.floor(w / 3.5);
                        const ribSpacing = w / ribCount;
                        for (let i = 0; i <= ribCount; i++) {
                            const rib = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, h + 1, 12), mSink);
                            rib.position.set(-w/2 + i*ribSpacing, h/2 - 0.5, d/2 - t + apronDepth/2);
                            grp.add(rib);
                        }
                    }
                    return grp;
                };

                const basin = buildSinkBasin(sW, sD, sH, type);
                group.add(basin);
                
            } else if (type.startsWith('tap_')) {
                const sW = params.width || 15;
                const sH = params.height || 35;
                const sD = params.depth || 20;

                const tapGroup = new THREE.Group();
                const mTap = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.1 });
                
                if (type === 'tap_modern') {
                    const path = new THREE.CatmullRomCurve3([
                        new THREE.Vector3(0, 0, 0),
                        new THREE.Vector3(0, 15, 0),
                        new THREE.Vector3(0, 25, 5),
                        new THREE.Vector3(0, 25, 15),
                        new THREE.Vector3(0, 20, 18)
                    ]);
                    const tube = new THREE.Mesh(new THREE.TubeGeometry(path, 20, 1.2, 16, false), mTap);
                    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 4, 32), mTap); base.position.y = 2;
                    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 16), mTap); handle.position.set(3, 8, 0); handle.rotation.z = -Math.PI/4;
                    const hBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2, 16), mTap); hBase.position.set(2, 8, 0); hBase.rotation.z = Math.PI/2;
                    tapGroup.add(tube, base, handle, hBase);
                } else if (type === 'tap_industrial') {
                    const fBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 10, 32), mTap); fBase.position.set(0, 5, 0);
                    const fPipe = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 28, 16), mTap); fPipe.position.set(0, 24, 0);
                    const fSpring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.6, 16, 32), mTap); fSpring.rotation.x = Math.PI/2; fSpring.position.set(0, 18, 0);
                    const fSpring2 = new THREE.Mesh(new THREE.TorusGeometry(3, 0.6, 16, 32), mTap); fSpring2.rotation.x = Math.PI/2; fSpring2.position.set(0, 21, 0);
                    const fSpout = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.5, 10, 16), mTap); fSpout.rotation.x = Math.PI/4; fSpout.position.set(0, 32, 10);
                    tapGroup.add(fBase, fPipe, fSpring, fSpring2, fSpout);
                } else if (type === 'tap_classic') {
                    const fBase = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 6, 32), mTap); fBase.position.set(0, 3, 0);
                    const fPipe = new THREE.Mesh(new THREE.TorusGeometry(8, 1.2, 16, 32, Math.PI), mTap); fPipe.position.set(0, 6, 8); fPipe.rotation.y = Math.PI/2;
                    const hL = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 5, 16), mTap); hL.position.set(-6, 2.5, 0);
                    const hLTop = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1), mTap); hLTop.position.set(-6, 5, 0);
                    const hR = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 5, 16), mTap); hR.position.set(6, 2.5, 0);
                    const hRTop = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1), mTap); hRTop.position.set(6, 5, 0);
                    tapGroup.add(fBase, fPipe, hL, hLTop, hR, hRTop);
                }

                // Uniform scale to prevent distortion in the thumbnail
                const baseBox = new THREE.Box3().setFromObject(tapGroup);
                const bSize = baseBox.getSize(new THREE.Vector3());
                const uniformScale = Math.min(sW / bSize.x, sH / bSize.y, sD / bSize.z);
                tapGroup.scale.setScalar(uniformScale);
                
                // Center and place at bottom
                const finalBox = new THREE.Box3().setFromObject(tapGroup);
                const fCenter = finalBox.getCenter(new THREE.Vector3());
                tapGroup.position.set(-fCenter.x, -finalBox.min.y, -fCenter.z);
                
                group.add(tapGroup);
            } else if (['hood_', 'app_', 'wine_', 'trash_', 'handle_', 'cooktop_', 'furniture_', 'lighting_'].some(prefix => type.startsWith(prefix))) {
                const sW = params.width || 60;
                const sH = params.height || 60;
                const sD = params.depth || 60;
                
                const eqGroup = new THREE.Group();
                const mSteel = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.8, roughness: 0.3 });
                const mDarkSteel = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.6, roughness: 0.4 });
                const mGlass = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.1, transparent: true, opacity: 0.8 });
                const mWood = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });
                const mWhite = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 });
                const mBlack = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });
                
                if (type === 'hood_chimney') {
                    const canopyGeo = new THREE.CylinderGeometry(15, 40, 15, 4);
                    canopyGeo.rotateY(Math.PI / 4);
                    canopyGeo.scale(1, 1, 0.8);
                    const canopy = new THREE.Mesh(canopyGeo, mSteel); 
                    canopy.position.y = 7.5;
                    
                    const filter = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 32), mDarkSteel); 
                    filter.position.set(0, 0, 0);
                    
                    // Telescopic Duct
                    const pipeLower = new THREE.Mesh(new THREE.BoxGeometry(18, 30, 14), mSteel);
                    pipeLower.position.set(0, 30, 0);
                    const pipeUpper = new THREE.Mesh(new THREE.BoxGeometry(17, 30, 13), mSteel);
                    pipeUpper.position.set(0, 60, 0);
                    
                    const panel = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 1), mBlack);
                    panel.position.set(0, 2, 21.5);
                    
                    const led = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshStandardMaterial({color: '#10b981', emissive: '#10b981', emissiveIntensity: 2}));
                    led.position.set(0, 2, 21.7);
                    
                    eqGroup.add(canopy, pipeLower, pipeUpper, filter, panel, led);
                    
                    // Ventilation Louvers
                    const mVent = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.9 });
                    for (let i = 0; i < 4; i++) {
                        const ventL = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 8), mVent);
                        ventL.position.set(-8.5, 63 + i * 3, 0);
                        const ventR = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 8), mVent);
                        ventR.position.set(8.5, 63 + i * 3, 0);
                        eqGroup.add(ventL, ventR);
                    }

                } else if (type === 'app_microwave') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(50, 30, 40), mSteel); body.position.y = 15;
                    const door = new THREE.Mesh(new THREE.BoxGeometry(36, 28, 2), mGlass); door.position.set(-6, 15, 20.2);
                    const plate = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.5, 32), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.1}));
                    plate.position.set(-6, 2, 0);
                    
                    const panel = new THREE.Mesh(new THREE.BoxGeometry(10, 30, 1.8), mBlack); panel.position.set(20, 15, 19.2);
                    const clock = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.5), new THREE.MeshStandardMaterial({color: '#0ea5e9', emissive: '#0ea5e9', emissiveIntensity: 1}));
                    clock.position.set(20, 25, 20.2);
                    
                    const dial = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1, 16), mSteel); dial.rotation.x = Math.PI/2; dial.position.set(20, 18, 20.2);
                    eqGroup.add(body, door, plate, panel, clock, dial);
                    for (let i=0; i<3; i++) {
                        for (let j=0; j<2; j++) {
                            const btn = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.5), mSteel);
                            btn.position.set(18 + j*4, 12 - i*2, 20.2);
                            eqGroup.add(btn);
                        }
                    }
                } else if (type === 'app_toaster') {
                    // Premium Modern Toaster Redesign
                    const bodyMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.15, metalness: 0.1 }); // Glossy cream
                    const chromeMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.1, metalness: 0.9 });
                    const darkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });
                    
                    // Top-down rounded rectangle profile
                    const shape = new THREE.Shape();
                    shape.moveTo(-5, -13); shape.lineTo(5, -13); shape.quadraticCurveTo(9, -13, 9, -9);
                    shape.lineTo(9, 9); shape.quadraticCurveTo(9, 13, 5, 13);
                    shape.lineTo(-5, 13); shape.quadraticCurveTo(-9, 13, -9, 9);
                    shape.lineTo(-9, -9); shape.quadraticCurveTo(-9, -13, -5, -13);
                    
                    // Bread slot holes cut directly into the shell
                    const hole1 = new THREE.Path();
                    hole1.moveTo(-4, -10); hole1.lineTo(-1, -10); hole1.lineTo(-1, 10); hole1.lineTo(-4, 10); hole1.lineTo(-4, -10);
                    shape.holes.push(hole1);
                    const hole2 = new THREE.Path();
                    hole2.moveTo(1, -10); hole2.lineTo(4, -10); hole2.lineTo(4, 10); hole2.lineTo(1, 10); hole2.lineTo(1, -10);
                    shape.holes.push(hole2);
                    
                    // Main Colored Body
                    const bodyExt = new THREE.ExtrudeGeometry(shape, {depth: 17, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5});
                    const body = new THREE.Mesh(bodyExt, bodyMat);
                    body.rotation.x = Math.PI / 2; // Converts Z-extrusion into Y-extrusion downwards
                    body.position.set(0, 19, 0); // Y goes from 19 down to 2
                    
                    // Chrome Base Plate
                    const baseExt = new THREE.ExtrudeGeometry(shape, {depth: 1, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2});
                    const base = new THREE.Mesh(baseExt, chromeMat);
                    base.rotation.x = Math.PI / 2;
                    base.position.set(0, 2, 0); // Y goes from 2 down to 1
                    
                    // Dark Interior (To block light inside the slots)
                    const interior = new THREE.Mesh(new THREE.BoxGeometry(9, 15, 21), darkMat);
                    interior.position.set(0, 10, 0);
                    
                    // Lever Mechanism on front face
                    const track = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 0.5), darkMat); 
                    track.position.set(4, 10, 13.5); 
                    const leverArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.5), chromeMat); 
                    leverArm.position.set(4, 12, 14.5);
                    const leverKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 16), darkMat); 
                    leverKnob.rotation.z = Math.PI/2; leverKnob.position.set(4, 12, 15.2);
                    
                    // Temperature Dial
                    const dialBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16), chromeMat); 
                    dialBase.rotation.x = Math.PI/2; dialBase.position.set(-4, 6, 13.7);
                    const dialKnob = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), darkMat); 
                    dialKnob.rotation.x = Math.PI/2; dialKnob.position.set(-4, 6, 14.2);
                    
                    eqGroup.add(base, body, interior, track, leverArm, leverKnob, dialBase, dialKnob);
                } else if (type === 'app_fridge') {
                    // Premium French-Door Refrigerator
                    const mBody = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.7 }); // Dark grey sides
                    const mSteel = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.15, metalness: 0.8 }); // Brushed stainless steel
                    const mDarkPlastic = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });
                    const mGlass = new THREE.MeshPhysicalMaterial({ color: '#000000', metalness: 0.9, roughness: 0.05, clearcoat: 1 });
                    
                    const w = 90, h = 180, d = 70;
                    const body = new THREE.Mesh(new THREE.BoxGeometry(w-2, h-2, d-4), mBody); body.position.set(0, h/2, -2);
                    
                    // Left French Door
                    const doorL = new THREE.Mesh(new THREE.BoxGeometry(w/2 - 1, h*0.65, 4), mSteel);
                    doorL.position.set(-(w/4), h*0.675 + 1, d/2 - 2);
                    // Right French Door
                    const doorR = new THREE.Mesh(new THREE.BoxGeometry(w/2 - 1, h*0.65, 4), mSteel);
                    doorR.position.set(w/4, h*0.675 + 1, d/2 - 2);
                    // Bottom Freezer Drawer
                    const freezer = new THREE.Mesh(new THREE.BoxGeometry(w - 1, h*0.33, 4), mSteel);
                    freezer.position.set(0, h*0.175, d/2 - 2);
                    
                    // Handles
                    const hMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.3, metalness: 0.9 });
                    const handleL = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, h*0.4, 16), hMat); handleL.position.set(-2, h*0.675, d/2 + 1.5);
                    const handleR = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, h*0.4, 16), hMat); handleR.position.set(2, h*0.675, d/2 + 1.5);
                    const handleF = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, w*0.6, 16), hMat); handleF.rotation.z = Math.PI/2; handleF.position.set(0, h*0.25, d/2 + 1.5);
                    
                    // Ice/Water Dispenser on Left Door
                    const dispBase = new THREE.Mesh(new THREE.BoxGeometry(18, 28, 1), mDarkPlastic); dispBase.position.set(-(w/4), h*0.65, d/2);
                    const dispCavity = new THREE.Mesh(new THREE.BoxGeometry(14, 22, 2), mBody); dispCavity.position.set(-(w/4), h*0.63, d/2 - 0.5);
                    const dispPanel = new THREE.Mesh(new THREE.BoxGeometry(16, 4, 1.2), mGlass); dispPanel.position.set(-(w/4), h*0.75, d/2);
                    
                    eqGroup.add(body, doorL, doorR, freezer, handleL, handleR, handleF, dispBase, dispCavity, dispPanel);

                } else if (type === 'app_oven') {
                    // Premium Built-in Oven
                    const mBlackMetal = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.6, metalness: 0.5 });
                    const mSteel = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.2, metalness: 0.8 });
                    const mGlass = new THREE.MeshPhysicalMaterial({ color: '#000000', metalness: 0.9, roughness: 0.05, clearcoat: 1 });
                    
                    const w = 60, h = 60, d = 55;
                    const body = new THREE.Mesh(new THREE.BoxGeometry(w-2, h-2, d-4), mBlackMetal); body.position.set(0, h/2, -2);
                    
                    // Main Glass Door
                    const door = new THREE.Mesh(new THREE.BoxGeometry(w-1, h*0.75, 4), mGlass); door.position.set(0, h*0.375, d/2 - 2);
                    // Steel Frame around Door
                    const frameT = new THREE.Mesh(new THREE.BoxGeometry(w-1, 4, 4.2), mSteel); frameT.position.set(0, h*0.75 - 2, d/2 - 2);
                    const frameB = new THREE.Mesh(new THREE.BoxGeometry(w-1, 4, 4.2), mSteel); frameB.position.set(0, 2, d/2 - 2);
                    
                    // Top Control Panel
                    const panel = new THREE.Mesh(new THREE.BoxGeometry(w-1, h*0.23, 4), mBlackMetal); panel.position.set(0, h*0.885, d/2 - 2);
                    // Knobs
                    const knobL = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2, 16), mSteel); knobL.rotation.x = Math.PI/2; knobL.position.set(-15, h*0.885, d/2);
                    const knobR = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2, 16), mSteel); knobR.rotation.x = Math.PI/2; knobR.position.set(15, h*0.885, d/2);
                    // Digital LED Display
                    const display = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 4.5), mGlass); display.position.set(0, h*0.885, d/2 - 2);
                    
                    // Large Horizontal Steel Handle
                    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, w*0.8, 16), mSteel); handle.rotation.z = Math.PI/2; handle.position.set(0, h*0.65, d/2 + 1);
                    const handleSupportL = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 16), mSteel); handleSupportL.rotation.x = Math.PI/2; handleSupportL.position.set(-w*0.35, h*0.65, d/2 - 0.5);
                    const handleSupportR = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 16), mSteel); handleSupportR.rotation.x = Math.PI/2; handleSupportR.position.set(w*0.35, h*0.65, d/2 - 0.5);
                    
                    eqGroup.add(body, door, frameT, frameB, panel, knobL, knobR, display, handle, handleSupportL, handleSupportR);

                } else if (type === 'app_dishwasher') {
                    // Premium Integrated Dishwasher
                    const mSteel = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.15, metalness: 0.85 });
                    const mBlackGlass = new THREE.MeshPhysicalMaterial({ color: '#020617', metalness: 0.8, roughness: 0.1, clearcoat: 1 });
                    const mGrey = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 });
                    
                    const w = 60, h = 85, d = 55;
                    const body = new THREE.Mesh(new THREE.BoxGeometry(w-2, h-10, d-4), mGrey); body.position.set(0, h/2, -2);
                    const toeKick = new THREE.Mesh(new THREE.BoxGeometry(w-2, 10, d-8), mGrey); toeKick.position.set(0, 5, -4);
                    
                    // Main Steel Door
                    const door = new THREE.Mesh(new THREE.BoxGeometry(w-0.5, h - 11, 3), mSteel); door.position.set(0, h/2 - 0.5, d/2 - 1.5);
                    
                    // Sleek Top Hidden Control Panel (Front facing part)
                    const panel = new THREE.Mesh(new THREE.BoxGeometry(w-0.5, 7, 3.2), mBlackGlass); panel.position.set(0, h - 3.5, d/2 - 1.5);
                    
                    // Recessed Pocket Handle (instead of bar)
                    const pocket = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 2), mGrey); pocket.position.set(0, h - 8.5, d/2 - 1);
                    const pocketLip = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 1), mSteel); pocketLip.position.set(0, h - 7.25, d/2 - 0.5);
                    
                    // LED indicators on panel
                    const ledMat1 = new THREE.MeshBasicMaterial({ color: '#3b82f6' }); // Blue
                    const ledMat2 = new THREE.MeshBasicMaterial({ color: '#ef4444' }); // Red
                    const led1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16), ledMat1); led1.rotation.x = Math.PI/2; led1.position.set(20, h - 3.5, d/2 + 0.1);
                    const led2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16), ledMat2); led2.rotation.x = Math.PI/2; led2.position.set(22, h - 3.5, d/2 + 0.1);
                    
                    eqGroup.add(body, toeKick, door, panel, pocket, pocketLip, led1, led2);
                } else if (type === 'trash_pedal') {
                    // Premium Stainless Steel & Black Plastic Rounded Rectangle Bin
                    const pBody = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.2, metalness: 0.85 }); 
                    const pBlack = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 }); 
                    
                    const w = 30, d = 30, r = 8, h = 55;
                    const binShape = new THREE.Shape();
                    binShape.moveTo(-w/2+r, -d/2); binShape.lineTo(w/2-r, -d/2);
                    binShape.quadraticCurveTo(w/2, -d/2, w/2, -d/2+r); binShape.lineTo(w/2, d/2-r);
                    binShape.quadraticCurveTo(w/2, d/2, w/2-r, d/2); binShape.lineTo(-w/2+r, d/2);
                    binShape.quadraticCurveTo(-w/2, d/2, -w/2, d/2-r); binShape.lineTo(-w/2, -d/2+r);
                    binShape.quadraticCurveTo(-w/2, -d/2, -w/2+r, -d/2);
                    
                    const bodyGeo = new THREE.ExtrudeGeometry(binShape, { depth: h, bevelEnabled: true, bevelSize: 1, bevelThickness: 1, bevelSegments: 3 });
                    bodyGeo.rotateX(-Math.PI/2);
                    const body = new THREE.Mesh(bodyGeo, pBody);
                    
                    const lidGeo = new THREE.ExtrudeGeometry(binShape, { depth: 2, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5, bevelSegments: 2 });
                    lidGeo.rotateX(-Math.PI/2);
                    const lid = new THREE.Mesh(lidGeo, pBlack);
                    lid.position.y = h + 1;
                    
                    const pedal = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 4), pBlack); 
                    pedal.position.set(0, 3, d/2 + 1);
                    
                    eqGroup.add(body, lid, pedal);
                } else if (type === 'trash_recycle') {
                    // Premium Dual Compartment Stainless Steel Bin
                    const pBody = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.2, metalness: 0.85 }); 
                    const pBlack = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 }); 
                    
                    const w = 50, d = 35, h = 60, r = 4;
                    const binShape = new THREE.Shape();
                    binShape.moveTo(-w/2+r, -d/2); binShape.lineTo(w/2-r, -d/2);
                    binShape.quadraticCurveTo(w/2, -d/2, w/2, -d/2+r); binShape.lineTo(w/2, d/2-r);
                    binShape.quadraticCurveTo(w/2, d/2, w/2-r, d/2); binShape.lineTo(-w/2+r, d/2);
                    binShape.quadraticCurveTo(-w/2, d/2, -w/2, d/2-r); binShape.lineTo(-w/2, -d/2+r);
                    binShape.quadraticCurveTo(-w/2, -d/2, -w/2+r, -d/2);
                    
                    const bodyGeo = new THREE.ExtrudeGeometry(binShape, { depth: h, bevelEnabled: true, bevelSize: 1, bevelThickness: 1, bevelSegments: 2 });
                    bodyGeo.rotateX(-Math.PI/2);
                    const body = new THREE.Mesh(bodyGeo, pBody);
                    
                    const lidGeo = new THREE.BoxGeometry(w/2 - 2, 3, d - 4);
                    const lid1 = new THREE.Mesh(lidGeo, pBlack); lid1.position.set(-w/4 + 0.5, h + 1.5, 0);
                    const lid2 = new THREE.Mesh(lidGeo, pBlack); lid2.position.set(w/4 - 0.5, h + 1.5, 0);
                    
                    const pedalGeo = new THREE.BoxGeometry(10, 2, 4);
                    const pedal1 = new THREE.Mesh(pedalGeo, pBlack); pedal1.position.set(-w/4, 3, d/2 + 1);
                    const pedal2 = new THREE.Mesh(pedalGeo, pBlack); pedal2.position.set(w/4, 3, d/2 + 1);
                    
                    eqGroup.add(body, lid1, lid2, pedal1, pedal2);
                } else if (type === 'trash_pullout') {
                    // Premium Concealed In-Cabinet Drawer Bin System
                    const pBody = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.2, metalness: 0.85 }); 
                    const pBlack = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 }); 
                    const pMetal = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.3, metalness: 0.8 }); 
                    
                    const drawerW = 45, drawerD = 50, drawerH = 45;
                    
                    const face = new THREE.Mesh(new THREE.BoxGeometry(drawerW, drawerH, 2), pBody);
                    face.position.set(0, drawerH/2, drawerD/2);
                    
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(drawerW - 4, 2, drawerD), pMetal);
                    frame.position.set(0, 2, 0);
                    
                    const bin1 = new THREE.Mesh(new THREE.BoxGeometry(drawerW - 6, drawerH - 5, drawerD/2 - 2), pBlack);
                    bin1.position.set(0, drawerH/2 - 1, -drawerD/4);
                    
                    const bin2 = new THREE.Mesh(new THREE.BoxGeometry(drawerW - 6, drawerH - 5, drawerD/2 - 2), pBlack);
                    bin2.position.set(0, drawerH/2 - 1, drawerD/4 - 2);
                    
                    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 15, 16), pMetal);
                    handle.rotation.z = Math.PI/2;
                    handle.position.set(0, drawerH - 5, drawerD/2 + 2);
                    
                    eqGroup.add(face, frame, bin1, bin2, handle);
                } else if (type === 'handle_bar') {
                    const bar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 20, 16), mSteel); bar.rotation.z = Math.PI/2; bar.position.y = 4;
                    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4, 16), mSteel); leg1.rotation.x = Math.PI/2; leg1.position.set(-7, 2, 0);
                    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4, 16), mSteel); leg2.rotation.x = Math.PI/2; leg2.position.set(7, 2, 0);
                    eqGroup.add(bar, leg1, leg2);
                } else if (type === 'handle_knob') {
                    const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 16), mSteel); base.rotation.x = Math.PI/2; base.position.y = 1;
                    const top = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), mSteel); top.position.y = 3;
                    eqGroup.add(base, top);
                } else if (type === 'handle_recessed') {
                    const outer = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 1), mSteel); outer.position.y = 2;
                    const hole = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 2), mBlack); hole.position.set(0, 2, 0);
                    eqGroup.add(outer, hole);
                } else if (type === 'cooktop_induction') {
                    // Schott Ceran ultra-premium Induction cooktop
                    const base = new THREE.Mesh(new THREE.BoxGeometry(58, 0.8, 50), mBlack); base.position.y = 0.4;
                    const glass = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 52), mGlass); glass.position.y = 0.9;
                    
                    // Chamfered metal edge frame
                    const mFrame = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9, roughness: 0.1 });
                    const frameL = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 52.4), mFrame); frameL.position.set(-30, 0.8, 0);
                    const frameR = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 52.4), mFrame); frameR.position.set(30, 0.8, 0);
                    const frameT = new THREE.Mesh(new THREE.BoxGeometry(60, 0.4, 1), mFrame); frameT.position.set(0, 0.8, -26);
                    const frameB = new THREE.Mesh(new THREE.BoxGeometry(60, 0.4, 1), mFrame); frameB.position.set(0, 0.8, 26);
                    
                    const ringMat = new THREE.MeshBasicMaterial({ color: '#ef4444' }); // Red induction glow
                    const whiteMat = new THREE.MeshBasicMaterial({ color: '#ffffff' }); // White crosshairs
                    const ringPositions = [[-15, -10, 8], [15, -10, 8], [-15, 10, 6], [15, 10, 6]]; // x, z, radius
                    ringPositions.forEach(pos => {
                        // Subtle inner glowing ring
                        const ring = new THREE.Mesh(new THREE.TorusGeometry(pos[2], 0.1, 16, 32), ringMat);
                        ring.rotation.x = Math.PI/2; ring.position.set(pos[0], 1, pos[1]);
                        
                        // Crosshairs (modern minimalist UI)
                        const crossH = new THREE.Mesh(new THREE.BoxGeometry(4, 0.05, 0.2), whiteMat); crossH.position.set(pos[0], 1.05, pos[1]);
                        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 4), whiteMat); crossV.position.set(pos[0], 1.05, pos[1]);
                        eqGroup.add(ring, crossH, crossV);
                    });
                    
                    // LED Slider Control panel
                    const slider = new THREE.Mesh(new THREE.BoxGeometry(20, 0.05, 2), ringMat); slider.position.set(0, 1.05, 22);
                    eqGroup.add(base, glass, frameL, frameR, frameT, frameB, slider);
                } else if (type === 'furniture_barstool') {
                    // Sculpted Scandinavian Bar Stool
                    const pWood = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.4 }); // Walnut seat
                    const pBrass = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.9, roughness: 0.2 });
                    
                    // Ergonomic sculpted seat (using deformed sphere to simulate curved dish)
                    const seat = new THREE.Mesh(new THREE.SphereGeometry(18, 32, 16, 0, Math.PI*2, 0, Math.PI/2), pWood);
                    seat.scale.set(1, 0.2, 1);
                    seat.position.y = 73.5;
                    seat.rotation.x = Math.PI; // flip upside down so flat is down, curve is up
                    
                    // Seat Base
                    const seatBase = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 2, 32), pWood);
                    seatBase.position.y = 72;
                    
                    for(let i=0; i<4; i++) {
                        const angle = (Math.PI/2) * i + Math.PI/4;
                        // Tapered legs (thicker at top, thin at bottom)
                        const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.6, 73, 16), pBrass);
                        leg.position.set(Math.cos(angle)*12, 36.5, Math.sin(angle)*12);
                        leg.rotation.z = Math.cos(angle) * -0.15;
                        leg.rotation.x = Math.sin(angle) * 0.15;
                        eqGroup.add(leg);
                    }
                    const footrest = new THREE.Mesh(new THREE.TorusGeometry(12, 0.6, 16, 32), pBrass);
                    footrest.rotation.x = Math.PI/2; footrest.position.y = 25;
                    eqGroup.add(seat, seatBase, footrest);
                } else if (type === 'lighting_pendant') {
                    // Multi-layered Ribbed Brass Fixture with Frosted Globe
                    const pBrass = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.9, roughness: 0.2 });
                    const pGlass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 0.8, opacity: 1, transparent: true, roughness: 0.3 });
                    const pWire = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });
                    
                    // Ceiling Rose / Canopy
                    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 2, 32), pBrass); canopy.position.y = 100;
                    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 70, 8), pWire); wire.position.y = 65;
                    
                    // Ribbed brass housing
                    const housing = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 15, 32), pBrass); housing.position.y = 22.5;
                    
                    // Frosted Globe
                    const globe = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 32), pGlass); globe.position.y = 10;
                    
                    const bulb = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 16), new THREE.MeshBasicMaterial({color: 0xfff5e6})); bulb.position.y = 10;
                    const light = new THREE.PointLight(0xffeedd, 1.5, 400); light.position.y = 10;
                    
                    eqGroup.add(canopy, wire, housing, globe, bulb, light);
                }

                const baseBox = new THREE.Box3().setFromObject(eqGroup);
                const bSize = baseBox.getSize(new THREE.Vector3());
                const defaultW = FURNITURE_REGISTRY[type]?.default?.width || bSize.x;
                const defaultH = FURNITURE_REGISTRY[type]?.default?.height || bSize.y;
                const defaultD = FURNITURE_REGISTRY[type]?.default?.depth || bSize.z;
                
                const uniformScale = Math.min(sW / defaultW, sH / defaultH, sD / defaultD);
                eqGroup.scale.setScalar(uniformScale);
                
                const finalBox = new THREE.Box3().setFromObject(eqGroup);
                const fCenter = finalBox.getCenter(new THREE.Vector3());
                eqGroup.position.set(-fCenter.x, -finalBox.min.y, -fCenter.z);
                
                group.add(eqGroup);
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

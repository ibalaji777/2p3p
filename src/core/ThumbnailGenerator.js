import * as THREE from 'three';
import { WIDGET_REGISTRY, ROOF_DECOR_REGISTRY, WALL_DECOR_REGISTRY, MOLDING_REGISTRY, FURNITURE_REGISTRY, RAILING_REGISTRY, WALL_REGISTRY, STAIRCASE_REGISTRY, THUMBNAIL_EXTENSIONS } from './registry.js';
import { ROOF_REGISTRY } from '../features/roof/roof.components.registry.js';
import { Stair3DBuilder } from '../features/stairs/stairs.renderer3d.js';
import { Molding3DBuilder } from './engine3d/Molding3DBuilder.js';
import { Railing3DBuilder } from '../features/railing/builders/Railing3DBuilder.js';
import { FurnitureManager } from '../features/furniture/furniture.renderer3d.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class ThumbnailGenerator {
    constructor(ctx) {
        this.ctx = ctx;
        
        // Create an offscreen renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        this.renderer.setSize(512, 512); // High resolution for sharp downscaling
        this.renderer.setPixelRatio(2); // High DPI for crispness
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer, photorealistic shadows
        if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8fafc); // Clean neutral catalog background

        // Photorealistic Studio Lighting for PBR
        // We use a blended RoomEnvironment for subtle reflections, and strong directional for contrast
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environmentIntensity = 0.8; // Lower intensity to prevent washout while keeping reflections
        
        // Exact Lighting Match to EnvironmentBuilder.js
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 1.1);
        hemiLight.position.set(0, 500, 0);
        this.scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.5);
        sunLight.position.set(500, 700, 600);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048; // Upgraded shadow resolution
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.bias = -0.0005; // Tighter bias for crisp contact shadows
        this.scene.add(sunLight);

        // Fill Light: soft directional light from opposite angle to brighten shadow faces and reveal deep textures
        const fillLight = new THREE.DirectionalLight(0xe2e8f0, 1.5);
        fillLight.position.set(-600, 500, -500);
        this.scene.add(fillLight);

        // Front Accent Light: illuminates front cabinet facades, drawers, and espresso wood textures
        const frontLight = new THREE.DirectionalLight(0xfffaf0, 1.2);
        frontLight.position.set(-200, 400, 600);
        this.scene.add(frontLight);

        // Ground plane to catch shadows without rendering the plane itself
        const groundGeo = new THREE.PlaneGeometry(1000, 1000);
        const groundMat = new THREE.ShadowMaterial({ opacity: 0.22 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        this.camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 1000);
        
        // Cache to prevent re-rendering the same parameters
        this.cache = new Map();
        
        this.isGenerating = false;
    }

    async generate(type, params) {
        // Normalize specific catalog IDs back to broad categories for special procedural generators
        if (type && type.startsWith('preset_dormer_')) type = 'dormer';

        // 1. Unified Registry Lookup
        let registryConfig = null;
        if (WIDGET_REGISTRY[type]) registryConfig = WIDGET_REGISTRY[type];
        else if (THUMBNAIL_EXTENSIONS && THUMBNAIL_EXTENSIONS[type]) registryConfig = THUMBNAIL_EXTENSIONS[type];
        else if (RAILING_REGISTRY && RAILING_REGISTRY[type]) registryConfig = RAILING_REGISTRY[type];
        else if (FURNITURE_REGISTRY && FURNITURE_REGISTRY[type]) registryConfig = FURNITURE_REGISTRY[type];
        else if (MOLDING_REGISTRY && MOLDING_REGISTRY[type]) registryConfig = MOLDING_REGISTRY[type];
        else if (WALL_REGISTRY && WALL_REGISTRY[type]) registryConfig = WALL_REGISTRY[type];
        else if (STAIRCASE_REGISTRY && (STAIRCASE_REGISTRY[type] || (type && (type.startsWith('stair_v5_') || type.startsWith('stair_v4_') || type === 'staircase')))) registryConfig = STAIRCASE_REGISTRY['staircase'];
        else if (ROOF_REGISTRY && type.startsWith('roof')) registryConfig = ROOF_REGISTRY['roof'];
        else if (ROOF_REGISTRY && type === 'dormer') registryConfig = ROOF_REGISTRY['dormer'];

        const allowedNonWidgets = ['staircase', 'roof', 'dormer', 'outer', 'inner', 'arc', 'shape_rect', 'shape_circle', 'shape_triangle', 'railing', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut', 'material_preview', 'material_preview_box'];
        
        if (!registryConfig && !allowedNonWidgets.includes(type)) return null;

        // Create a cache key from params to avoid re-rendering
        const cacheKey = type + '_' + JSON.stringify(params);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        while (this.isGenerating) {
            await new Promise(r => setTimeout(r, 50));
        }
        this.isGenerating = true;

        try {
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
            if (type.startsWith('roof') || type === 'dormer') {
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

            if (registryConfig && registryConfig.render3D) {
                const widgetGroup = await registryConfig.render3D(group, entity, this.ctx.helpers);
            } else if (FURNITURE_REGISTRY && FURNITURE_REGISTRY[type]) {
                const furnitureManager = new FurnitureManager(this.ctx);
                const defaultW = FURNITURE_REGISTRY[type]?.default?.width || 60;
                const defaultH = FURNITURE_REGISTRY[type]?.default?.height || 60;
                const defaultD = FURNITURE_REGISTRY[type]?.default?.depth || 60;

                const sW = params?.width || defaultW;
                const sH = params?.height || defaultH;
                const sD = params?.depth || defaultD;

                const mesh = await furnitureManager.load({
                    ...entity,
                    configId: type,
                    width: sW,
                    height: sH,
                    depth: sD
                });
                if (mesh) {
                    const baseBox = new THREE.Box3().setFromObject(mesh);
                    const bSize = baseBox.getSize(new THREE.Vector3());

                    const uniformScale = Math.min(sW / (bSize.x || sW), sH / (bSize.y || sH), sD / (bSize.z || sD));
                    mesh.scale.setScalar(uniformScale > 0 ? uniformScale : 1);
                    
                    const finalBox = new THREE.Box3().setFromObject(mesh);
                    const fCenter = finalBox.getCenter(new THREE.Vector3());
                    mesh.position.set(-fCenter.x, -finalBox.min.y, -fCenter.z);
                    
                    group.add(mesh);
                }
            }
        }

        
        // Center the group
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        
        // Reset pivot
        group.position.x = -center.x;
        if (type === 'material_preview_box') {
            group.position.y = -center.y;
        } else {
            // Float slightly above the ground plane to avoid z-fighting on shadows
            group.position.y = -box.min.y + 0.1;
        }
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

        if (type === 'staircase' || (type && (type.startsWith('stair_v5_') || type.startsWith('stair_v4_')))) {
            const fov = 32;
            activeCamera = new THREE.PerspectiveCamera(fov, 1, 1, 2000);
            
            // Frame the bounding box to fill ~80% of the thumbnail (10% padding on edges -> 1.25 multiplier)
            // For stairs, length (size.z) is usually the largest dimension. We ensure it fits within the 32° FOV.
            const fitSize = maxDim * 1.25; 
            const distance = (fitSize / 2) / Math.tan((fov / 2) * Math.PI / 180);
            
            // Apply orbital rotation: 25° elevation, 125° azimuth (shows front steps and treads clearly)
          const phi = 65 * Math.PI / 180;
const theta = 145 * Math.PI / 180;
            
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
        } else if (type === 'material_preview_box') {
            this.camera.left = -100;
            this.camera.right = 100;
            this.camera.top = 100;
            this.camera.bottom = -100;
            this.camera.position.set(0, 0, 150);
            this.camera.lookAt(0, 0, 0);
            this.camera.updateProjectionMatrix();
            activeCamera = this.camera;
        } else if (type === 'material_preview') {
            const fov = 35;
            activeCamera = new THREE.PerspectiveCamera(fov, 1, 1, 2000);
            
            const center = box.getCenter(new THREE.Vector3());
            const fitSize = maxDim * 1.5; 
            const distance = (fitSize / 2) / Math.tan((fov / 2) * Math.PI / 180);
            
            const phi = (90 - 25) * Math.PI / 180;
            const theta = 45 * Math.PI / 180;
            activeCamera.position.setFromSphericalCoords(distance, phi, theta);
            activeCamera.position.add(center);
            
            activeCamera.lookAt(center);
            activeCamera.updateProjectionMatrix();
        } else if (type === 'door' || (params && (params.doorType || type.includes('door')))) {
            // Normalized camera framing for doors: doors stand at standardized height (~84 units).
            // Framing based on door height (size.y) ensures Single, French, Sliding, Pocket, and Flush doors render at identical visual heights.
            const doorH = (size.y > 10) ? size.y : 84;
            const frustumHeight = doorH * 1.15; // Fills ~75-80% of vertical snapshot height
            
            this.camera.left = -frustumHeight / 2;
            this.camera.right = frustumHeight / 2;
            this.camera.top = frustumHeight / 2;
            this.camera.bottom = -frustumHeight / 2;
            this.camera.updateProjectionMatrix();

            // Clean 3/4 architectural CAD angle: 18° elevation, 26° azimuth
            const targetCenterY = doorH / 2;
            this.camera.position.set(doorH * 0.65, doorH * 0.42, doorH * 1.1);
            this.camera.lookAt(0, targetCenterY, 0);
            activeCamera = this.camera;
        } else if (type === 'window' || (params && (params.windowType || type.includes('window')))) {
            const frustumSize = maxDim * 1.05; // 60-70% scale (tighter framing)
            
            this.camera.left = -frustumSize / 2;
            this.camera.right = frustumSize / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = -frustumSize / 2;
            this.camera.updateProjectionMatrix();

            const winType = params?.windowType || 'sliding_std';
            const radius = maxDim * 1.2;
            
            // Dynamic angles based on window type
            if (winType.includes('casement') || winType.includes('bay') || winType.includes('fixed') || winType.includes('picture') || winType.includes('panoramic')) {
                // Straight view (front elevation) for casement, bay, fixed, and panoramic slider
                this.camera.position.set(0, maxDim * 0.5, -radius);
            } else {
                // Sliding & others: ~30 degree slight angle
                this.camera.position.set(-radius * 0.5, maxDim * 0.4, -radius * 0.866);
            }
            
            this.camera.lookAt(0, targetY, 0);
        } else if (type && type.startsWith('rug_')) {
            // High-angled top-down studio shot for floor rugs to showcase full carpet surface pattern, borders, and fringes
            const rugDim = Math.max(size.x, size.z);
            const frustumSize = rugDim * 1.35;
            
            this.camera.left = -frustumSize / 2;
            this.camera.right = frustumSize / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = -frustumSize / 2;
            this.camera.updateProjectionMatrix();

            // Studio 55° elevated architectural 3/4 perspective
            this.camera.position.set(rugDim * 0.75, rugDim * 1.25, rugDim * 0.75);
            this.camera.lookAt(0, 0, 0);
            activeCamera = this.camera;
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

        // Ensure all pending texture images and PBR material promises finish loading over HTTP before capturing the snapshot
        const pendingTextureProms = [];
        group.traverse(child => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    if (mat.userData && mat.userData.readyPromise) {
                        pendingTextureProms.push(mat.userData.readyPromise);
                    }
                    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap'].forEach(slot => {
                        const tex = mat[slot];
                        if (tex && tex.image) {
                            if (!tex.image.complete) {
                                pendingTextureProms.push(new Promise(resolve => {
                                    tex.image.addEventListener('load', resolve, { once: true });
                                    tex.image.addEventListener('error', resolve, { once: true });
                                    setTimeout(resolve, 1500);
                                }));
                            }
                        }
                    });
                });
            }
        });

        if (pendingTextureProms.length > 0) {
            await Promise.all(pendingTextureProms);
            await new Promise(resolve => setTimeout(resolve, 50));
        } else {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        this.renderer.render(this.scene, activeCamera);
        
        const dataUrl = this.renderer.domElement.toDataURL('image/png');
        this.cache.set(cacheKey, dataUrl);
        
        return dataUrl;
        } finally {
            if (this.currentObj) {
                this.scene.remove(this.currentObj);
                this.currentObj = null;
            }
            this.isGenerating = false;
        }
    }
}

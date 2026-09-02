import * as THREE from 'three';
import { WIDGET_REGISTRY, ROOF_DECOR_REGISTRY, WALL_DECOR_REGISTRY, MOLDING_REGISTRY, FURNITURE_REGISTRY, RAILING_REGISTRY, WALL_REGISTRY, STAIRCASE_REGISTRY, THUMBNAIL_EXTENSIONS } from './registry.js';
import { ROOF_REGISTRY } from '../features/roof/roof.components.registry.js';
import { Stair3DBuilder } from '../features/stairs/stairs.renderer3d.js';
import { Molding3DBuilder } from './engine3d/Molding3DBuilder.js';
import { Railing3DBuilder } from '../features/railing/builders/Railing3DBuilder.js';
import { FurnitureManager } from '../features/furniture/furniture.renderer3d.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

let _sharedThumbnailRenderer = null;
let _sharedThumbnailEnvironment = null;

function getSharedThumbnailRenderer() {
    if (!_sharedThumbnailRenderer) {
        try {
            _sharedThumbnailRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
            _sharedThumbnailRenderer.setSize(512, 512); // High resolution for sharp downscaling
            _sharedThumbnailRenderer.setPixelRatio(1.5);
            _sharedThumbnailRenderer.shadowMap.enabled = true;
            _sharedThumbnailRenderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer, photorealistic shadows
            if (THREE.SRGBColorSpace) _sharedThumbnailRenderer.outputColorSpace = THREE.SRGBColorSpace;
            _sharedThumbnailRenderer.toneMapping = THREE.ACESFilmicToneMapping;
            _sharedThumbnailRenderer.toneMappingExposure = 1.25;
            if (_sharedThumbnailRenderer.domElement) {
                _sharedThumbnailRenderer.domElement.addEventListener('webglcontextlost', (e) => {
                    e.preventDefault();
                    console.warn('[ThumbnailGenerator] WebGL context lost prevented.');
                    _sharedThumbnailRenderer = null;
                    _sharedThumbnailEnvironment = null;
                }, false);
            }
        } catch (e) {
            console.warn('[ThumbnailGenerator] Failed to create shared WebGLRenderer:', e);
            return null;
        }
    }
    return _sharedThumbnailRenderer;
}

function getSharedThumbnailEnvironment(renderer) {
    if (!renderer || !renderer.capabilities) return null;
    if (!_sharedThumbnailEnvironment) {
        try {
            const pmremGenerator = new THREE.PMREMGenerator(renderer);
            _sharedThumbnailEnvironment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
            pmremGenerator.dispose();
        } catch (e) {
            console.warn('[ThumbnailGenerator] Failed to create PMREM environment:', e);
        }
    }
    return _sharedThumbnailEnvironment;
}

export class ThumbnailGenerator {
    constructor(ctx) {
        this.ctx = ctx;
        
        // Use shared offscreen renderer singleton to avoid exhausting WebGL context limit
        this.renderer = getSharedThumbnailRenderer();
        if (!this.renderer) {
            this.renderer = {
                setSize: () => {},
                setPixelRatio: () => {},
                shadowMap: {},
                render: () => {},
                domElement: { toDataURL: () => 'data:image/png;base64,mock' }
            };
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8fafc); // Clean neutral catalog background

        // Photorealistic Studio Lighting for PBR
        const env = getSharedThumbnailEnvironment(this.renderer);
        if (env) {
            this.scene.environment = env;
            this.scene.environmentIntensity = 0.8; // Lower intensity to prevent washout while keeping reflections
        }
        
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
        if (type && (type.startsWith('skylight_') || type === 'skylight')) type = 'skylight';

        // 1. Unified Registry Lookup
        let registryConfig = null;
        if (WIDGET_REGISTRY[type]) registryConfig = WIDGET_REGISTRY[type];
        else if (THUMBNAIL_EXTENSIONS && THUMBNAIL_EXTENSIONS[type]) registryConfig = THUMBNAIL_EXTENSIONS[type];
        else if (RAILING_REGISTRY && RAILING_REGISTRY[type]) registryConfig = RAILING_REGISTRY[type];
        else if (FURNITURE_REGISTRY && FURNITURE_REGISTRY[type]) registryConfig = FURNITURE_REGISTRY[type];
        else if (MOLDING_REGISTRY && MOLDING_REGISTRY[type]) registryConfig = MOLDING_REGISTRY[type];
        else if (WALL_REGISTRY && WALL_REGISTRY[type]) registryConfig = WALL_REGISTRY[type];
        else if (STAIRCASE_REGISTRY && (STAIRCASE_REGISTRY[type] || (type && (type.startsWith('stair_v5_') || type.startsWith('stair_v4_') || type === 'staircase')))) registryConfig = STAIRCASE_REGISTRY['staircase'];
        else if (ROOF_REGISTRY && ROOF_REGISTRY[type]) registryConfig = ROOF_REGISTRY[type];
        else if (ROOF_REGISTRY && (type.startsWith('ridge_cresting') || type.startsWith('finial_') || type.startsWith('chimney_') || type.startsWith('roof_sculpture') || type.startsWith('roof_cresting') || type.startsWith('roof_finial') || type.startsWith('roof_chimney'))) registryConfig = ROOF_REGISTRY['roof_sculptures'];
        else if (ROOF_REGISTRY && (type.startsWith('skylight'))) registryConfig = ROOF_REGISTRY['skylight'];
        else if (ROOF_REGISTRY && type.startsWith('roof')) registryConfig = ROOF_REGISTRY['roof'];

        const allowedNonWidgets = ['staircase', 'roof', 'skylight', 'roof_sculptures', 'roof_cresting', 'roof_finial', 'roof_chimney', 'outer', 'inner', 'compound', 'arc', 'shape_rect', 'shape_circle', 'shape_triangle', 'shape_polygon', 'shape_floor_cut', 'shape_box', 'shape_cyl', 'shape_prism', 'railing', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut', 'opening', 'material_preview', 'material_preview_box'];
        
        if (!registryConfig && !allowedNonWidgets.includes(type) && !type.startsWith('ridge_cresting_') && !type.startsWith('finial_') && !type.startsWith('chimney_')) return null;

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
            if (type.startsWith('roof')) {
                try {
                    if (ROOF_DECOR_REGISTRY['terracotta_tiles_roof']) await this.ctx.assets.getTexture(ROOF_DECOR_REGISTRY['terracotta_tiles_roof']);
                    if (WALL_DECOR_REGISTRY['white_plaster_wall']) await this.ctx.assets.getTexture(WALL_DECOR_REGISTRY['white_plaster_wall']);
                } catch (e) {}
            }
            
            // Dedicated 3D Wall Openings Procedural Section
            if (['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut', 'opening'].includes(type)) {
                const wallW = 80;
                const wallH = 90;
                const wallThick = 12;
                const wallShape = new THREE.Shape();
                wallShape.moveTo(-wallW / 2, 0);
                wallShape.lineTo(wallW / 2, 0);
                wallShape.lineTo(wallW / 2, wallH);
                wallShape.lineTo(-wallW / 2, wallH);
                wallShape.closePath();

                if (type === 'arch_opening') {
                    const hw = 22;
                    const straightH = 45;
                    const hole = new THREE.Path();
                    hole.moveTo(-hw, 0);
                    hole.lineTo(hw, 0);
                    hole.lineTo(hw, straightH);
                    hole.absarc(0, straightH, hw, 0, Math.PI, false);
                    hole.lineTo(-hw, 0);
                    wallShape.holes.push(hole);
                } else if (type === 'circular_opening') {
                    const hole = new THREE.Path();
                    hole.absellipse(0, 45, 22, 22, 0, Math.PI * 2, false, 0);
                    wallShape.holes.push(hole);
                } else if (type === 'custom_shape_opening') {
                    const hole = new THREE.Path();
                    hole.moveTo(0, 22);
                    hole.lineTo(24, 45);
                    hole.lineTo(0, 68);
                    hole.lineTo(-24, 45);
                    hole.closePath();
                    wallShape.holes.push(hole);
                } else if (type === 'pattern_opening') {
                    for (let r = 0; r < 3; r++) {
                        for (let c = 0; c < 3; c++) {
                            const cellHole = new THREE.Path();
                            const cx = -16 + c * 16;
                            const cy = 29 + r * 16;
                            const sz = 6;
                            cellHole.moveTo(cx - sz, cy - sz);
                            cellHole.lineTo(cx + sz, cy - sz);
                            cellHole.lineTo(cx + sz, cy + sz);
                            cellHole.lineTo(cx - sz, cy + sz);
                            cellHole.closePath();
                            wallShape.holes.push(cellHole);
                        }
                    }
                } else if (type === 'niche_recess') {
                    const recessW = 42, recessH = 52, recessD = 6;
                    const nicheGeo = new THREE.BoxGeometry(recessW, recessH, recessD);
                    const nicheMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.1 });
                    const nicheMesh = new THREE.Mesh(nicheGeo, nicheMat);
                    nicheMesh.position.set(0, 45, (wallThick / 2) - (recessD / 2) + 0.1);
                    group.add(nicheMesh);
                } else {
                    const hw = 24, oh = 58;
                    const hole = new THREE.Path();
                    hole.moveTo(-hw, 0);
                    hole.lineTo(hw, 0);
                    hole.lineTo(hw, oh);
                    hole.lineTo(-hw, oh);
                    hole.closePath();
                    wallShape.holes.push(hole);
                }

                const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: wallThick, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 2 });
                wallGeo.translate(0, 0, -wallThick / 2);

                const wallMat = new THREE.MeshStandardMaterial({
                    color: 0xf1f5f9,
                    roughness: 0.5,
                    metalness: 0.05
                });

                const wallMesh = new THREE.Mesh(wallGeo, wallMat);
                wallMesh.castShadow = true;
                wallMesh.receiveShadow = true;
                group.add(wallMesh);
            } else if (type.startsWith('shape_') || ['shape_rect', 'shape_circle', 'shape_triangle', 'shape_polygon', 'shape_floor_cut', 'shape_box', 'shape_cyl', 'shape_prism'].includes(type)) {
                const shapeMat = new THREE.MeshStandardMaterial({
                    color: type === 'shape_floor_cut' ? 0xef4444 : 0x38bdf8,
                    roughness: 0.3,
                    metalness: 0.15
                });

                if (type === 'shape_rect' || type === 'shape_box') {
                    const geo = new THREE.BoxGeometry(50, 50, 50);
                    const mesh = new THREE.Mesh(geo, shapeMat);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    group.add(mesh);
                } else if (type === 'shape_circle' || type === 'shape_cyl') {
                    const geo = new THREE.CylinderGeometry(25, 25, 50, 32);
                    const mesh = new THREE.Mesh(geo, shapeMat);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    group.add(mesh);
                } else if (type === 'shape_triangle' || type === 'shape_prism') {
                    const shape = new THREE.Shape();
                    shape.moveTo(-25, -25);
                    shape.lineTo(25, -25);
                    shape.lineTo(0, 25);
                    shape.closePath();
                    const geo = new THREE.ExtrudeGeometry(shape, { depth: 50, bevelEnabled: false });
                    geo.translate(0, 0, -25);
                    const mesh = new THREE.Mesh(geo, shapeMat);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    group.add(mesh);
                } else if (type === 'shape_polygon') {
                    const shape = new THREE.Shape();
                    const sides = 6, r = 26;
                    for (let i = 0; i < sides; i++) {
                        const a = (i / sides) * Math.PI * 2;
                        const x = Math.cos(a) * r;
                        const y = Math.sin(a) * r;
                        if (i === 0) shape.moveTo(x, y);
                        else shape.lineTo(x, y);
                    }
                    shape.closePath();
                    const geo = new THREE.ExtrudeGeometry(shape, { depth: 50, bevelEnabled: false });
                    geo.translate(0, 0, -25);
                    const mesh = new THREE.Mesh(geo, shapeMat);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    group.add(mesh);
                } else if (type === 'shape_floor_cut') {
                    const slabShape = new THREE.Shape();
                    slabShape.moveTo(-35, -35);
                    slabShape.lineTo(35, -35);
                    slabShape.lineTo(35, 35);
                    slabShape.lineTo(-35, 35);
                    slabShape.closePath();

                    const voidHole = new THREE.Path();
                    voidHole.moveTo(-18, -18);
                    voidHole.lineTo(18, -18);
                    voidHole.lineTo(18, 18);
                    voidHole.lineTo(-18, 18);
                    voidHole.closePath();
                    slabShape.holes.push(voidHole);

                    const geo = new THREE.ExtrudeGeometry(slabShape, { depth: 10, bevelEnabled: false });
                    geo.rotateX(-Math.PI / 2);
                    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 }));
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    group.add(mesh);
                }
            } else if (['outer', 'inner', 'compound', 'arc'].includes(type)) {
                const wallThick = type === 'outer' ? 14 : (type === 'inner' ? 8 : 10);
                const wallH = type === 'compound' ? 35 : 55;
                const wallLen = 75;

                const wallMat = new THREE.MeshStandardMaterial({
                    color: type === 'outer' ? 0xe2e8f0 : (type === 'inner' ? 0xf8fafc : 0xd1d5db),
                    roughness: 0.5
                });

                if (type === 'arc') {
                    const shape = new THREE.Shape();
                    const r1 = 40, r2 = 40 + wallThick;
                    shape.absarc(0, 0, r2, 0, Math.PI / 2, false);
                    shape.lineTo(0, r1);
                    shape.absarc(0, 0, r1, Math.PI / 2, 0, true);
                    shape.closePath();
                    const geo = new THREE.ExtrudeGeometry(shape, { depth: wallH, bevelEnabled: false });
                    geo.rotateX(-Math.PI / 2);
                    const mesh = new THREE.Mesh(geo, wallMat);
                    mesh.castShadow = true;
                    group.add(mesh);
                } else {
                    const geo = new THREE.BoxGeometry(wallLen, wallH, wallThick);
                    const mesh = new THREE.Mesh(geo, wallMat);
                    mesh.castShadow = true;
                    group.add(mesh);
                }
            } else {
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
        } else if (['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut', 'opening'].includes(type)) {
            const frustumSize = 105;
            this.camera.left = -frustumSize / 2;
            this.camera.right = frustumSize / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = -frustumSize / 2;
            this.camera.updateProjectionMatrix();

            // 3/4 architectural angle showing wall depth and aperture
            this.camera.position.set(60, 50, 95);
            this.camera.lookAt(0, 45, 0);
            activeCamera = this.camera;
        } else if (type.startsWith('shape_') || ['shape_rect', 'shape_circle', 'shape_triangle', 'shape_polygon', 'shape_floor_cut', 'shape_box', 'shape_cyl', 'shape_prism'].includes(type)) {
            const frustumSize = 85;
            this.camera.left = -frustumSize / 2;
            this.camera.right = frustumSize / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = -frustumSize / 2;
            this.camera.updateProjectionMatrix();

            this.camera.position.set(55, 45, 75);
            this.camera.lookAt(0, 25, 0);
            activeCamera = this.camera;
        } else if (['outer', 'inner', 'compound', 'arc'].includes(type)) {
            const frustumSize = 100;
            this.camera.left = -frustumSize / 2;
            this.camera.right = frustumSize / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = -frustumSize / 2;
            this.camera.updateProjectionMatrix();

            this.camera.position.set(65, 45, 75);
            this.camera.lookAt(0, 25, 0);
            activeCamera = this.camera;
        } else if (type.startsWith('ridge_cresting') || type.startsWith('finial_') || type.startsWith('chimney_') || type.startsWith('roof_sculpture') || type.startsWith('roof_cresting') || type.startsWith('roof_finial') || type.startsWith('roof_chimney') || type === 'skylight' || type.startsWith('skylight_')) {
            const frustumSize = Math.max(70, maxDim * 1.25);
            this.camera.left = -frustumSize / 2;
            this.camera.right = frustumSize / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = -frustumSize / 2;
            this.camera.updateProjectionMatrix();

            this.camera.position.set(maxDim * 0.95, maxDim * 0.75, maxDim * 1.15);
            this.camera.lookAt(0, targetY, 0);
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

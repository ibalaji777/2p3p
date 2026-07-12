import * as THREE from 'three';
import { WIDGET_REGISTRY } from './registry.js';

export class ThumbnailGenerator {
    constructor(helpers) {
        this.helpers = helpers;
        
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
        if (!WIDGET_REGISTRY[type] || !WIDGET_REGISTRY[type].render3D) return null;

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
        
        // Dummy entity based on preset params
        const entity = { ...params };
        if (!entity.width) entity.width = WIDGET_REGISTRY[type].defaultConfig?.width || 40;
        if (!entity.height) entity.height = WIDGET_REGISTRY[type].defaultConfig?.height || (type === 'door' ? 84 : 48);
        
        // Provide a dummy wall context so extrusion and frames calculate correctly
        entity.wall = {
            thickness: 10,
            config: { thickness: 10 }
        };
        entity.thick = 10;
        
        // Prevent position NaN errors from registry positional logic
        entity.localX = 0;
        entity.x = 0;
        entity.z = 0;
        entity.angle = 0;

        // Render the procedural mesh
        const widgetGroup = WIDGET_REGISTRY[type].render3D(group, entity, this.helpers);
        
        // Center the group
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        
        // Reset pivot
        group.position.x = -center.x;
        // Float slightly above the ground plane to avoid z-fighting on shadows
        group.position.y = -box.min.y + 0.1;
        group.position.z = -center.z;
        
        this.scene.add(group);
        this.currentObj = group;

        // Frame the camera nicely using isometric perspective
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const frustumSize = maxDim * 1.4; // Leave some margin
        
        this.camera.left = -frustumSize / 2;
        this.camera.right = frustumSize / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;
        this.camera.updateProjectionMatrix();

        // Position camera for an isometric view (front-right-top)
        this.camera.position.set(maxDim, maxDim * 0.8, maxDim);
        this.camera.lookAt(0, size.y / 2, 0); // Look at the center of the object

        // Give textures a tiny bit of time to load if they were fetched asynchronously in getDynamicMaterial
        await new Promise(resolve => setTimeout(resolve, 50));

        this.renderer.render(this.scene, this.camera);
        
        const dataUrl = this.renderer.domElement.toDataURL('image/png');
        this.cache.set(cacheKey, dataUrl);
        
        return dataUrl;
    }
}

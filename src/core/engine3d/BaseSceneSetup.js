import * as THREE from 'three';
import { SKY_REGISTRY, GROUND_REGISTRY } from '../registry.js';

export class BaseSceneSetup {
    constructor(scene) {
        this.scene = scene;
        this.textureLoader = new THREE.TextureLoader();

        // Store references to lights and ground to update them
        this.hemiLight = null;
        this.sunLight = null;
        this.ambientLight = null;
        this.ground = null;
        this.grid = null;
    }

    setup(skyKey = 'arch_viz_sunny', groundKey = 'grass') {
        // Segmented Ground for Terrain Displacement
        const groundGeo = new THREE.PlaneGeometry(10000, 10000, 150, 150);
        groundGeo.rotateX(-Math.PI / 2);
        
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.9, metalness: 0.0 });
        this.ground = new THREE.Mesh(groundGeo, groundMat);
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        this.grid = new THREE.GridHelper(5000, 250, 0xffffff, 0xffffff);
        this.grid.material.opacity = 0.2;
        this.grid.material.transparent = true;
        this.scene.add(this.grid);

        // Lights
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x4ade80, 0.8);
        this.hemiLight.position.set(0, 500, 0);
        this.scene.add(this.hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xffffee, 2.5);
        this.sunLight.position.set(-400, 800, 300);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 4096;
        this.sunLight.shadow.mapSize.height = 4096;
        this.sunLight.shadow.bias = -0.0005;
        const d = 1200;
        this.sunLight.shadow.camera.left = -d; this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d; this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.camera.near = 100;
        this.sunLight.shadow.camera.far = 2500;
        this.scene.add(this.sunLight);

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(this.ambientLight);

        // Initial setup
        this.setSky(skyKey);
        this.setGround(groundKey);
    }

    setSky(skyKey) {
        const config = SKY_REGISTRY[skyKey] || SKY_REGISTRY['arch_viz_sunny'];

        this.sunLight.color.setHex(config.sunColor); this.sunLight.intensity = config.sun;
        this.ambientLight.intensity = config.ambient; this.hemiLight.intensity = config.hemi;

        if (config.type === 'color') {
            this.scene.background = new THREE.Color(config.skyColor);
            this.scene.fog = new THREE.FogExp2(config.fogColor, 0.0004);
            this.hemiLight.groundColor.setHex(config.hemiGround);
            this.scene.environment = null;
        } else if (config.type === 'hdri') {
            this.textureLoader.load(config.url, (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                this.scene.background = texture; this.scene.environment = texture;
                this.scene.fog = new THREE.Fog(0xcccccc, 500, 3000);
            });
            this.hemiLight.groundColor.setHex(0xaaaaaa);
        }
    }

    setGround(groundKey) {
        const config = GROUND_REGISTRY[groundKey] || GROUND_REGISTRY['grass'];
        const isGrid = config.type === 'grid';

        this.grid.visible = isGrid;

        // Vertex height displacement for realism
        const pos = this.ground.geometry.attributes.position;
        const th = config.terrainHeight || 0;
        
        for (let i = 0; i < pos.count; i++) {
            if (isGrid) {
                pos.setY(i, 0); // Flat
            } else {
                // Setting height to 0 for all vertices to make it flat
                pos.setY(i, 0);
            }
        }
        pos.needsUpdate = true;
        this.ground.geometry.computeVertexNormals();

        // Materials & Textures
        if (isGrid) {
            this.ground.material.map = null;
            this.ground.material.normalMap = null;
            this.ground.material.color.setHex(config.color || 0x9aa297);
        } else {
            this.ground.material.color.setHex(0xffffff);
            this.ground.material.roughness = config.roughness !== undefined ? config.roughness : 1.0;
            this.ground.material.metalness = 0.0;
            
            if (config.texture) {
                this.textureLoader.load(config.texture, (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(config.repeat, config.repeat); if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace; this.ground.material.map = tex; this.ground.material.needsUpdate = true; });
            }
            if (config.normal) {
                this.textureLoader.load(config.normal, (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(config.repeat, config.repeat); this.ground.material.normalMap = tex; this.ground.material.normalScale.set(config.normalScale || 1, config.normalScale || 1); this.ground.material.needsUpdate = true; });
            }
        }
        this.ground.material.needsUpdate = true;
    }
}
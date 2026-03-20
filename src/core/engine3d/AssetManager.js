import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AssetManager {
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
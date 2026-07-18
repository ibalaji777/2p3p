import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS } from '../../core/registry';


export class AssetManager {
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
                
                if (config.forceColor) {
                    modelScene.traverse((child) => {
                        if (child.isMesh && child.material) {
                            const applyColor = (mat) => {
                                // Instead of stripping the texture, multiply it by the color!
                                // This keeps all the baked-in fabric details, shadows, and highlights.
                                mat.color.set(config.forceColor);
                                mat.needsUpdate = true;
                            };
                            if (Array.isArray(child.material)) {
                                child.material.forEach(applyColor);
                            } else {
                                applyColor(child.material);
                            }
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

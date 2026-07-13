// src/features/railing/materials/MaterialManager.js
import * as THREE from 'three';
import { RAILING_MATERIAL_DEFS } from './railing.materials.js';

/**
 * Singleton manager to cache and reuse materials across all railing instances.
 * Prevents WebGL context memory leaks by ensuring duplicate materials aren't created.
 */
class RailingMaterialManager {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Retrieves a cached material or creates a new one if it doesn't exist.
     * @param {string} materialId - ID from RAILING_MATERIAL_DEFS
     * @returns {THREE.Material}
     */
    getMaterial(materialId) {
        if (this.cache.has(materialId)) {
            return this.cache.get(materialId);
        }

        const def = RAILING_MATERIAL_DEFS[materialId];
        if (!def) {
            console.warn(`[RailingMaterialManager] Material ${materialId} not found, falling back to default.`);
            return this.getDefaultMaterial();
        }

        let material;
        if (def.type === 'MeshPhysicalMaterial') {
            material = new THREE.MeshPhysicalMaterial(def.params);
        } else if (def.type === 'MeshStandardMaterial') {
            material = new THREE.MeshStandardMaterial(def.params);
        } else {
            material = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // Magenta error fallback
        }

        this.cache.set(materialId, material);
        return material;
    }

    getDefaultMaterial() {
        if (!this.cache.has('default')) {
            this.cache.set('default', new THREE.MeshStandardMaterial({ color: 0xcccccc }));
        }
        return this.cache.get('default');
    }

    /**
     * Disposes all cached materials to free GPU memory.
     */
    disposeAll() {
        this.cache.forEach(mat => mat.dispose());
        this.cache.clear();
    }
}

export const MaterialManager = new RailingMaterialManager();

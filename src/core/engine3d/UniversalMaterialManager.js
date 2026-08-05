import * as THREE from 'three';
import { MaterialManager } from './MaterialManager.js';
import { MaterialFactory } from './MaterialFactory.js';

export class UniversalMaterialComponent {
    constructor(entity, mesh, slotName) {
        this.entity = entity;
        this.mesh = mesh;
        this.slotName = slotName;

        this.texelDensity = { repeatX: 1, repeatY: 1 };
        this.grainRotation = 0;

        if (this.mesh) {
            if (!this.mesh.userData) this.mesh.userData = {};
            this.mesh.userData.materialComponent = this;
            this.mesh.userData.entity = entity;
            this.mesh.userData.materialSlot = slotName;
        }
    }

    async apply(materialId, ctx = null) {
        if (!this.mesh || !this.entity) return;

        const config = UniversalMaterialManager.getMaterial(materialId);
        if (!config) return;

        if (!this.entity.materials) this.entity.materials = {};
        const normalized = MaterialManager.normalizeDescriptor(config);
        
        await MaterialFactory.applyPBRMaterial(this.mesh, normalized, ctx);
    }

    updateUV(repeatX = 1, repeatY = 1) {
        this.texelDensity = { repeatX, repeatY };
        const mats = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];
        
        mats.forEach(mat => {
            if (mat && mat.map) {
                mat.map.repeat.set(repeatX, repeatY);
                mat.map.needsUpdate = true;
                if (mat.normalMap) {
                    mat.normalMap.repeat.set(repeatX, repeatY);
                    mat.normalMap.needsUpdate = true;
                }
                if (mat.roughnessMap) {
                    mat.roughnessMap.repeat.set(repeatX, repeatY);
                    mat.roughnessMap.needsUpdate = true;
                }
                if (mat.aoMap) {
                    mat.aoMap.repeat.set(repeatX, repeatY);
                    mat.aoMap.needsUpdate = true;
                }
            }
        });
    }

    setTexelDensity(value) {
        this.updateUV(value, value);
    }

    rotateGrain(angle) {
        this.grainRotation = angle;
        const mats = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];
        
        mats.forEach(mat => {
            if (mat && mat.map) {
                mat.map.rotation = angle;
                mat.map.needsUpdate = true;
                if (mat.normalMap) {
                    mat.normalMap.rotation = angle;
                    mat.normalMap.needsUpdate = true;
                }
                if (mat.roughnessMap) {
                    mat.roughnessMap.rotation = angle;
                    mat.roughnessMap.needsUpdate = true;
                }
                if (mat.aoMap) {
                    mat.aoMap.rotation = angle;
                    mat.aoMap.needsUpdate = true;
                }
            }
        });
    }

    updatePBR(settings = {}) {
        const mats = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];
        
        mats.forEach(mat => {
            if (mat) {
                if (settings.roughness !== undefined) mat.roughness = settings.roughness;
                if (settings.metalness !== undefined) mat.metalness = settings.metalness;
                if (settings.color !== undefined) mat.color.setHex(settings.color);
                mat.needsUpdate = true;
            }
        });
    }

    refreshThumbnail() {
        if (typeof window !== 'undefined' && window.coreEventBus) {
            window.coreEventBus.emit('THUMBNAIL_REQUEST', { entity: this.entity, slotName: this.slotName });
        }
    }

    dispose() {
        if (this.mesh && this.mesh.userData) {
            this.mesh.userData.materialComponent = null;
        }
        this.mesh = null;
        this.entity = null;
    }
}

/**
 * Universal Material Manager
 * Global singleton coordinating the material pipeline for all 3D entities.
 */
export class UniversalMaterialManager {
    static getMaterial(matId) {
        return MaterialManager.resolveMaterialConfig(matId);
    }

    static async applyMaterialSlot(entity, slotName, matConfig, ctx = null) {
        await MaterialManager.updateEntityMaterialSlot(entity, slotName, matConfig, ctx);
    }
    
    static async previewMaterialSlot(entity, slotName, matConfig, ctx = null) {
        await MaterialManager.previewMaterialSlot(entity, slotName, matConfig, ctx);
    }

    static getCacheMetrics() {
        return {
            cachedMaterials: MaterialFactory.materialCache.size
        };
    }
}

if (typeof window !== 'undefined') {
    window.UniversalMaterialManager = UniversalMaterialManager;
    window.UniversalMaterialComponent = UniversalMaterialComponent;
}

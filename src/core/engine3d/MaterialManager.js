import * as THREE from 'three';
import { MaterialSlots } from '../constants/materialSlots.js';
import { ComponentRegistry } from './ComponentRegistry.js';
import { MaterialFactory } from './MaterialFactory.js';
import { coreEventBus } from '../EventBus.js';
import { EVENTS } from '../constants/events.js';
import { 
    WALL_DECOR_REGISTRY, 
    WOOD_REGISTRY, 
    FLOOR_REGISTRY, 
    FABRIC_REGISTRY, 
    ROOF_DECOR_REGISTRY, 
    GLASS_REGISTRY, 
    MARBLE_REGISTRY, 
    STONE_REGISTRY, 
    METAL_REGISTRY, 
    DOOR_MATERIALS,
    WINDOW_FRAME_MATERIALS,
    PLASTIC_REGISTRY, 
    LEATHER_REGISTRY,
    COMMON_MATERIALS
} from '../registry.js';

/**
 * Enterprise CAD/BIM Material Manager Engine (10/10 Architecture).
 * Authoritative JSON model state manager, transaction coordinator,
 * shared material cache resolver, and multi-level validation system.
 */
export class MaterialManager {
    static activeTransaction = null;
    static assetManifests = {
        door: [MaterialSlots.FRAME, MaterialSlots.LEAF, MaterialSlots.GLASS, MaterialSlots.HARDWARE, MaterialSlots.SEAL, MaterialSlots.TRIM],
        window: [MaterialSlots.FRAME, MaterialSlots.LEAF, MaterialSlots.GLASS, MaterialSlots.HARDWARE, MaterialSlots.SEAL, MaterialSlots.SCREEN],
        wall: [MaterialSlots.WALL_FRONT, MaterialSlots.WALL_BACK, MaterialSlots.WALL_LEFT, MaterialSlots.WALL_RIGHT, MaterialSlots.WALL_TOP, MaterialSlots.WALL_BOTTOM],
        widget: [MaterialSlots.FRAME, MaterialSlots.TRIM, MaterialSlots.CUSTOM]
    };

    /**
     * Normalizes any material key or config into a stable, serializable MaterialDescriptor object.
     * @param {Object|string} matConfig - Raw material key or configuration object.
     * @returns {Object} Stable MaterialDescriptor { id, version, source, ... }.
     */
    static normalizeDescriptor(matConfig) {
        if (!matConfig) return { id: 'default', version: 1, source: 'default' };

        if (typeof matConfig === 'string') {
            return {
                id: matConfig,
                version: 1,
                source: 'library'
            };
        }

        const id = matConfig.id || matConfig.key || matConfig.texture || 'default';
        return {
            ...matConfig,
            id: String(id),
            version: matConfig.version || 1,
            source: matConfig.source || 'library'
        };
    }

    /**
     * Resolves material configuration object from material key or descriptor across all registries.
     * @param {Object|string} matInput 
     * @returns {Object} Full material configuration object.
     */
    static resolveMaterialConfig(matInput) {
        if (!matInput) return null;
        if (typeof matInput === 'object' && matInput.texture) return matInput;

        const descriptor = MaterialManager.normalizeDescriptor(matInput);
        const matKey = descriptor.id;

        let resolved = null;
        if (matKey.startsWith('color_')) {
            const hexStr = matKey.replace('color_#', '').replace('color_', '').replace('#', '');
            const hexVal = parseInt(hexStr, 16);
            resolved = { id: matKey, name: 'Custom Color', color: hexVal, roughness: 0.5, metalness: 0.0 };
        } else {
            resolved = FABRIC_REGISTRY[matKey] ||
                             COMMON_MATERIALS[matKey] ||
                             DOOR_MATERIALS[matKey] ||
                             WINDOW_FRAME_MATERIALS[matKey] ||
                             WOOD_REGISTRY[matKey] ||
                             GLASS_REGISTRY[matKey] ||
                             MARBLE_REGISTRY[matKey] ||
                             STONE_REGISTRY[matKey] ||
                             METAL_REGISTRY[matKey] ||
                             PLASTIC_REGISTRY[matKey] ||
                             LEATHER_REGISTRY[matKey] ||
                             WALL_DECOR_REGISTRY[matKey] ||
                             ROOF_DECOR_REGISTRY[matKey] ||
                             FLOOR_REGISTRY[matKey];
            
            if (!resolved) {
                resolved = { texture: matKey, id: matKey };
            }
        }

        return {
            ...resolved,
            ...descriptor
        };
    }

    /**
     * Ensures an entity has an authoritative JSON materials state dictionary (`entity.materials`).
     * @param {Object} entity 
     */
    static initEntityMaterials(entity) {
        if (!entity) return;
        if (!entity.materials) {
            entity.materials = {};
        }

        // Synchronize legacy entity properties into initial entity.materials state if missing
        if (entity.type === 'door') {
            if (!entity.materials[MaterialSlots.LEAF] && entity.doorMat) {
                entity.materials[MaterialSlots.LEAF] = MaterialManager.normalizeDescriptor(entity.doorMat);
            }
            if (!entity.materials[MaterialSlots.FRAME]) {
                const frameMatKey = entity.frameMat || entity.doorMat;
                if (frameMatKey) entity.materials[MaterialSlots.FRAME] = MaterialManager.normalizeDescriptor(frameMatKey);
            }
            if (!entity.materials[MaterialSlots.GLASS] && entity.glassMat) {
                entity.materials[MaterialSlots.GLASS] = MaterialManager.normalizeDescriptor(entity.glassMat);
            }
        } else if (entity.type === 'window') {
            if (!entity.materials[MaterialSlots.FRAME] && entity.frameMat) {
                entity.materials[MaterialSlots.FRAME] = MaterialManager.normalizeDescriptor(entity.frameMat);
            }
            if (!entity.materials[MaterialSlots.GLASS] && entity.glassMat) {
                entity.materials[MaterialSlots.GLASS] = MaterialManager.normalizeDescriptor(entity.glassMat);
            }
        } else if (entity.params) {
            const p = entity.params;
            if (p.textureFront) entity.materials[MaterialSlots.WALL_FRONT] = MaterialManager.normalizeDescriptor(p.textureFront);
            if (p.textureBack) entity.materials[MaterialSlots.WALL_BACK] = MaterialManager.normalizeDescriptor(p.textureBack);
            if (p.textureLeft) entity.materials[MaterialSlots.WALL_LEFT] = MaterialManager.normalizeDescriptor(p.textureLeft);
            if (p.textureRight) entity.materials[MaterialSlots.WALL_RIGHT] = MaterialManager.normalizeDescriptor(p.textureRight);
            if (p.textureTop) entity.materials[MaterialSlots.WALL_TOP] = MaterialManager.normalizeDescriptor(p.textureTop);
            if (p.textureBottom) entity.materials[MaterialSlots.WALL_BOTTOM] = MaterialManager.normalizeDescriptor(p.textureBottom);
            if (p.texture && !entity.materials[MaterialSlots.CUSTOM]) {
                entity.materials[MaterialSlots.CUSTOM] = MaterialManager.normalizeDescriptor(p.texture);
            }
        }
    }

    /**
     * Updates a single material slot in an entity's authoritative JSON state immutably,
     * then applies the material across all registered meshes for that slot.
     * @param {Object} entity - Target entity.
     * @param {string} slotName - Target material slot.
     * @param {Object|string} matConfig - New material key or config.
     * @param {Object} [ctx=null] - 3D engine context.
     */
    static async updateEntityMaterialSlot(entity, slotName, matConfig, ctx = null) {
        if (!entity || !slotName || !matConfig) return;

        MaterialManager.initEntityMaterials(entity);

        const descriptor = MaterialManager.normalizeDescriptor(matConfig);

        // Immutable JSON state update
        entity.materials = {
            ...entity.materials,
            [slotName]: descriptor
        };

        entity.materialDirty = true;

        if (MaterialManager.activeTransaction) {
            MaterialManager.activeTransaction.entities.add(entity);
            MaterialManager.activeTransaction.slots.add({ entity, slotName });
            return;
        }

        await MaterialManager.applySlot(entity, slotName, descriptor, ctx);

        if (coreEventBus) {
            coreEventBus.emit(EVENTS.MATERIAL_CHANGED || 'MATERIAL_CHANGED', { entity, slotName, descriptor });
            coreEventBus.emit(EVENTS.ENTITY_MODIFIED || 'ENTITY_MODIFIED', { entity });
        }
    }

    /**
     * Previews a material on a slot temporarily without mutating the JSON model.
     * @param {Object} entity 
     * @param {string} slotName 
     * @param {Object|string} matConfig 
     * @param {Object} ctx 
     */
    static async previewMaterialSlot(entity, slotName, matConfig, ctx = null) {
        if (!entity || !slotName || !matConfig) return;
        const descriptor = MaterialManager.normalizeDescriptor(matConfig);
        await MaterialManager.applySlot(entity, slotName, descriptor, ctx);
    }

    /**
     * Applies the specified slot material to all registered meshes of an entity.
     * Uses O(1) ComponentRegistry lookup first, falling back to recursive traversal.
     * @param {Object} entity 
     * @param {string} slotName 
     * @param {Object|string} matInput 
     * @param {Object} ctx 
     */
    static async applySlot(entity, slotName, matInput, ctx = null) {
        if (!entity) return;

        let matToUse = matInput;
        const parentSlot = SLOT_DEFINITIONS[slotName]?.inherits;
        if (!matToUse || (typeof matToUse === 'object' && matToUse.inherits === true)) {
            if (parentSlot && entity.materials?.[parentSlot]) {
                matToUse = entity.materials[parentSlot];
            } else if (slotName.startsWith('sash_')) {
                matToUse = entity.materials?.[MaterialSlots.FRAME] || entity.frameMat || 'wood_teak';
            }
        }
        const config = MaterialManager.resolveMaterialConfig(matToUse);
        if (!config) return;

        let targetMeshes = ComponentRegistry.getMeshesForSlot(entity.id, slotName);

        // Fallback: Traverse 3D object hierarchy if ComponentRegistry has no registered meshes for this slot
        if (targetMeshes.length === 0 && entity.mesh3D) {
            entity.mesh3D.traverse(child => {
                if (!child || !child.isMesh) return;
                const slot = child.userData?.materialSlot;
                if (slot === slotName) {
                    targetMeshes.push(child);
                } else if (!slot) {
                    // Legacy fallback matching
                    if (slotName === MaterialSlots.GLASS && child.userData?.isGlass) targetMeshes.push(child);
                    else if (slotName === MaterialSlots.HARDWARE && child.userData?.isHandle) targetMeshes.push(child);
                    else if (slotName === MaterialSlots.FRAME && child.userData?.isFrame) targetMeshes.push(child);
                    else if (slotName === MaterialSlots.LEAF && !child.userData?.isFrame && !child.userData?.isGlass && !child.userData?.isHandle) targetMeshes.push(child);
                }
            });
        }

        const promises = targetMeshes.map(mesh => {
            if (mesh.userData?.materialLocked) return Promise.resolve();
            return MaterialFactory.applyPBRMaterial(mesh, config, ctx);
        });

        await Promise.all(promises);

        entity.materialDirty = false;

        // Widget / ExtrudeGeometry UV Scaling Rebuild Safety Check
        if (entity.isWidget || entity.supportsLiveMaterialPipeline) {
            if (ctx && typeof ctx.updateMaterialLive === 'function') {
                ctx.updateMaterialLive(entity);
            }
        }

        if (ctx && typeof ctx.requestRender === 'function') {
            ctx.requestRender();
        }
    }

    /**
     * Synchronizes all slot materials from an entity's authoritative JSON state across its 3D mesh graph.
     * @param {Object} entity 
     * @param {THREE.Object3D} [rootObj=null] 
     * @param {Object} [ctx=null] 
     */
    static async syncEntityMaterials(entity, rootObj = null, ctx = null) {
        if (!entity) return;

        MaterialManager.initEntityMaterials(entity);

        const slots = Object.keys(entity.materials);
        const promises = slots.map(slotName => {
            const descriptor = entity.materials[slotName];
            return MaterialManager.applySlot(entity, slotName, descriptor, ctx);
        });

        await Promise.all(promises);

        MaterialManager.validateAssetMaterialSlots(entity, rootObj || entity.mesh3D);
    }

    /**
     * Transaction Engine: Begins a batched material editing transaction.
     */
    static beginTransaction() {
        MaterialManager.activeTransaction = {
            entities: new Set(),
            slots: new Set()
        };
    }

    /**
     * Transaction Engine: Commits active batched transaction and triggers single render event.
     * @param {Object} ctx 
     */
    static async commit(ctx = null) {
        if (!MaterialManager.activeTransaction) return;

        const tx = MaterialManager.activeTransaction;
        MaterialManager.activeTransaction = null;

        const promises = [];
        for (const { entity, slotName } of tx.slots) {
            const descriptor = entity.materials[slotName];
            if (descriptor) {
                promises.push(MaterialManager.applySlot(entity, slotName, descriptor, ctx));
            }
        }

        await Promise.all(promises);

        for (const entity of tx.entities) {
            if (coreEventBus) {
                coreEventBus.emit(EVENTS.ENTITY_MODIFIED || 'ENTITY_MODIFIED', { entity });
            }
        }

        if (ctx && typeof ctx.requestRender === 'function') {
            ctx.requestRender();
        }
    }

    /**
     * Transaction Engine: Cancels active transaction.
     */
    static cancel() {
        MaterialManager.activeTransaction = null;
    }

    /**
     * Asset Validation Engine: Audits generated 3D meshes against manifest declarations.
     * Log Levels: ERROR, WARNING, INFO.
     * @param {Object} entity 
     * @param {THREE.Object3D} rootObj 
     * @param {Object} [options={}] 
     */
    static validateAssetMaterialSlots(entity, rootObj, options = {}) {
        if (!entity || !rootObj) return { valid: true, errors: [], warnings: [], info: [] };

        const errors = [];
        const warnings = [];
        const info = [];

        const entityType = entity.type || 'widget';
        const expectedSlots = MaterialManager.assetManifests[entityType] || [];

        let totalMeshes = 0;
        let assignedMeshes = 0;

        rootObj.traverse(child => {
            if (!child || !child.isMesh || child.userData?.isHitbox) return;
            totalMeshes++;

            const slot = child.userData?.materialSlot;
            if (!slot) {
                errors.push(`[ERROR] Mesh '${child.name || 'unnamed'}' in Entity '${entity.id}' (type: ${entityType}) is missing materialSlot assignment.`);
            } else {
                assignedMeshes++;
                if (expectedSlots.length > 0 && !expectedSlots.includes(slot) && slot !== MaterialSlots.CUSTOM) {
                    warnings.push(`[WARNING] Mesh '${child.name || 'unnamed'}' in Entity '${entity.id}' uses unexpected slot '${slot}'. Expected: [${expectedSlots.join(', ')}].`);
                }
            }
        });

        if (totalMeshes > 0 && assignedMeshes === totalMeshes) {
            info.push(`[INFO] Entity '${entity.id}' passed material slot validation (${assignedMeshes}/${totalMeshes} meshes assigned).`);
        }

        if (options.verbose !== false && (errors.length > 0 || warnings.length > 0)) {
            errors.forEach(e => console.error(e));
            warnings.forEach(w => console.warn(w));
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            info
        };
    }

    /**
     * Material Diagnostic Metrics Generator.
     * @param {THREE.Scene} scene 
     * @returns {Object} Diagnostic metrics.
     */
    static getMaterialMetrics(scene) {
        if (!scene) return { totalMaterials: 0, cachedMaterials: 0, totalMeshes: 0, registeredMeshes: 0 };

        const materialsSet = new Set();
        let totalMeshes = 0;
        let registeredMeshes = 0;

        scene.traverse(child => {
            if (child && child.isMesh) {
                totalMeshes++;
                if (child.userData?.materialSlot) registeredMeshes++;

                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => { if (m) materialsSet.add(m.uuid); });
            }
        });

        return {
            totalMaterials: materialsSet.size,
            cachedMaterials: MaterialFactory.materialCache.size,
            totalMeshes: totalMeshes,
            registeredMeshes: registeredMeshes,
            slotCoverage: totalMeshes > 0 ? `${((registeredMeshes / totalMeshes) * 100).toFixed(1)}%` : '0%'
        };
    }
}

if (typeof window !== 'undefined') {
    window.MaterialManager = MaterialManager;
}

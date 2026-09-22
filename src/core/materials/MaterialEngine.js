/**
 * src/core/materials/MaterialEngine.js
 * 
 * Canonical Domain Authority for Materials, Textures & Shaders Subsystem.
 * Unifies:
 * - Material resolution across all registries (Wood, Stone, Marble, Brick, Metal, Plastic, Glass, Fabric, Leather, Floor, Wall Decor, Jali)
 * - Authoritative 3-Layer BIM slot application (Component Registry -> Material Slots -> Mesh Registry)
 * - PBR material compilation and caching via MaterialFactory
 * - BIM face resolution, raycast picking, and emissive highlighting
 * - Transaction batching (beginTransaction -> commit -> cancel)
 * - Diagnostic validation and scene metrics
 */

import * as THREE from 'three';
import { MaterialManager } from '../engine3d/MaterialManager.js';
import { MaterialFactory } from '../engine3d/MaterialFactory.js';
import { BIMMaterialSystem } from '../engine3d/BIMMaterialSystem.js';
import { ComponentRegistry } from '../engine3d/ComponentRegistry.js';
import { MaterialSlots, ComponentTypes, SLOT_DEFINITIONS, INTERACTION_MODES } from '../constants/materialSlots.js';
import { 
    WOOD_REGISTRY, 
    GLASS_REGISTRY, 
    METAL_REGISTRY, 
    PLASTIC_REGISTRY, 
    STONE_REGISTRY, 
    MARBLE_REGISTRY, 
    BRICK_REGISTRY, 
    FABRIC_REGISTRY, 
    LEATHER_REGISTRY, 
    FLOOR_REGISTRY, 
    WALL_DECOR_REGISTRY, 
    JALI_MATERIALS, 
    JALI_PATTERNS,
    COMMON_MATERIALS 
} from '../registries/material.registry.js';
import { WallEngine } from '../wall/WallEngine.js';
import { RoofEngine } from '../roof/RoofEngine.js';
import { coreEventBus } from '../EventBus.js';
import { EVENTS } from '../constants/events.js';

export class MaterialEngine {
    // Re-export constants for convenient single-import access
    static MaterialSlots = MaterialSlots;
    static ComponentTypes = ComponentTypes;
    static SLOT_DEFINITIONS = SLOT_DEFINITIONS;
    static INTERACTION_MODES = INTERACTION_MODES;

    /**
     * Resolves material configuration object across all registries.
     * @param {Object|string} matKeyOrConfig
     * @returns {Object|null}
     */
    static resolveConfig(matKeyOrConfig) {
        return MaterialManager.resolveMaterialConfig(matKeyOrConfig);
    }

    /**
     * Normalizes a material key or config into a stable MaterialDescriptor.
     * @param {Object|string} matConfig
     * @returns {Object}
     */
    static normalizeDescriptor(matConfig) {
        return MaterialManager.normalizeDescriptor(matConfig);
    }

    /**
     * Returns all recognized material category identifiers.
     * @returns {string[]}
     */
    static getCategories() {
        return [
            'wood',
            'stone',
            'marble',
            'brick',
            'metal',
            'plastic',
            'glass',
            'fabric',
            'leather',
            'wall_decor',
            'floor',
            'jali'
        ];
    }

    /**
     * Retrieves all material definitions registered under a specific category.
     * @param {string} category
     * @returns {Object} Registry dictionary
     */
    static getMaterialsByCategory(category) {
        switch (category) {
            case 'wood': return WOOD_REGISTRY;
            case 'stone': return STONE_REGISTRY;
            case 'marble': return MARBLE_REGISTRY;
            case 'brick': return BRICK_REGISTRY;
            case 'metal': return METAL_REGISTRY;
            case 'plastic': return PLASTIC_REGISTRY;
            case 'glass': return GLASS_REGISTRY;
            case 'fabric': return FABRIC_REGISTRY;
            case 'leather': return LEATHER_REGISTRY;
            case 'wall_decor': return WALL_DECOR_REGISTRY;
            case 'floor': return FLOOR_REGISTRY;
            case 'jali': return JALI_MATERIALS;
            default: return COMMON_MATERIALS;
        }
    }

    /**
     * Instantiates or retrieves a synchronous THREE.Material from a material key or config.
     * @param {Object|string} matKeyOrConfig
     * @param {string} [category='default']
     * @returns {THREE.Material}
     */
    static getThreeMaterial(matKeyOrConfig, category = 'default') {
        const conf = MaterialEngine.resolveConfig(matKeyOrConfig);
        if (!conf) return new THREE.MeshStandardMaterial({ color: 0xcccccc });

        let mat;
        if (conf.transmission) {
            mat = new THREE.MeshPhysicalMaterial({
                color: conf.color !== undefined ? conf.color : 0xffffff,
                transmission: conf.transmission !== undefined ? conf.transmission : 0.9,
                opacity: conf.opacity !== undefined ? conf.opacity : 1,
                metalness: conf.metalness !== undefined ? conf.metalness : 0,
                roughness: conf.roughness !== undefined ? conf.roughness : 0,
                ior: conf.ior !== undefined ? conf.ior : 1.5,
                thickness: conf.thickness !== undefined ? conf.thickness : 0.5,
                transparent: true
            });
        } else {
            mat = new THREE.MeshStandardMaterial({
                color: conf.color !== undefined ? conf.color : 0xcccccc,
                roughness: conf.roughness !== undefined ? conf.roughness : 0.5,
                metalness: conf.metalness !== undefined ? conf.metalness : 0.1
            });
        }
        if (conf.name || typeof matKeyOrConfig === 'string') {
            mat.name = typeof matKeyOrConfig === 'string' ? matKeyOrConfig : (conf.name || conf.id);
        }
        return mat;
    }

    /**
     * Authoritatively applies a material to any domain entity or face target.
     * Automatically handles 3-Layer BIM slot updates, walls, roofs, floors, and platforms.
     * @param {Object} entity - Target domain entity
     * @param {string} slotOrFace - Material slot (e.g. 'leaf', 'frame') or face name ('front', 'back', 'top')
     * @param {Object|string|null} matConfig - New material key, descriptor, or null to clear
     * @param {Object} [options={}] - Context options { ctx, planner, sync }
     * @returns {Promise<boolean>}
     */
    static async applyMaterial(entity, slotOrFace, matConfig, options = {}) {
        if (!entity) return false;

        const ctx = options.ctx || (typeof window !== 'undefined' ? (window.engine3d || window.app3d || window.planner?.engine3d || window.plannerInstance?.engine3d) : null);
        const planner = options.planner || (typeof window !== 'undefined' ? (window.planner?.value || window.planner || window.plannerInstance) : null);

        const isWall = entity.type === 'outer' || entity.type === 'inner' || entity.type === 'compound' || entity.type === 'wall' || entity.type === 'half_wall' || entity.type === 'foundation' || entity.type === 'arc' || entity.walls || entity.parentArc || entity.startX !== undefined;
        const isRoof = entity.type === 'roof' || entity.isRoof || entity.config?.roofType;
        const isFloorOrRoom = entity.type === 'room' || entity.isRoom || entity.type === 'outdoor_zone' || entity.isOutdoorZone || entity.isFloor || entity.path;

        const matId = typeof matConfig === 'string' ? matConfig : (matConfig ? (matConfig.id || matConfig.key) : null);

        // 1. Walls and Curved Arc Assemblies
        if (isWall) {
            const face = (!slotOrFace || slotOrFace === 'all') ? 'all' : slotOrFace.replace('wall_', '');
            WallEngine.applyMaterial(entity, { target: face, key: matId, ctx }, planner);
            if (face === 'front' && entity.elevationLayers?.front) {
                entity.elevationLayers.front.forEach(layer => layer.texture = matId);
            } else if (face === 'back' && entity.elevationLayers?.back) {
                entity.elevationLayers.back.forEach(layer => layer.texture = matId);
            }
            if (options.sync !== false && planner && typeof planner.syncAll === 'function') {
                planner.syncAll();
            }
            return true;
        }

        // 2. Roof Assemblies
        if (isRoof) {
            const slopeKey = (slotOrFace === 'fascia' || slotOrFace === 'sides') ? 'fascia' : ((slotOrFace === 'gable') ? 'gable' : (slotOrFace && slotOrFace !== 'all' ? slotOrFace : null));
            const scope = (slotOrFace === 'fascia' || slotOrFace === 'sides') ? 'fascia' : (slotOrFace === 'gable' ? 'gable' : (slotOrFace && slotOrFace !== 'all' ? 'single' : 'all'));
            RoofEngine.setMaterial(entity, matId, scope, slopeKey, planner);
            if (ctx && typeof ctx.updateRoofLive === 'function') {
                ctx.updateRoofLive(entity);
            }
            return true;
        }

        // 3. Floors, Rooms, and Outdoor Zones
        if (isFloorOrRoom) {
            entity.configId = matId;
            if (!entity.params) entity.params = {};
            entity.params.texture = matId;
            entity.params.material = matId;
            if (ctx && typeof ctx.updateMaterialLive === 'function') {
                ctx.updateMaterialLive(entity);
            }
            if (options.sync !== false && planner && typeof planner.syncAll === 'function') {
                planner.syncAll();
            }
            return true;
        }

        // 4. Component Slot-Based Entities (Doors, Windows, Widgets, Stairs, Railings, Furniture, Platforms, Shapes)
        const legacyToSlot = {
            'doorMat': 'leaf', 'frameMat': 'frame', 'handleMat': 'hardware', 'glassMat': 'glass',
            'fabricMat': 'custom', 'cushionMat': 'custom', 'legMat': 'frame', 'baseMat': 'frame',
            'casingMat': 'trim', 'trimMat': 'trim', 'roofMat': 'custom'
        };
        const normalizedSlot = legacyToSlot[slotOrFace] || slotOrFace || MaterialSlots.CUSTOM;
        
        // Also maintain backward-compatible params (e.g. shapes, protrusions, legacy widgets)
        if (entity.params) {
            if (normalizedSlot === 'leaf') entity.params.textureFront = matId;
            else if (normalizedSlot === 'frame') entity.params.frameMat = matId;
            else {
                if (normalizedSlot === 'all' || !normalizedSlot) {
                    entity.params.texture = matId;
                } else {
                    const paramName = 'texture' + normalizedSlot.charAt(0).toUpperCase() + normalizedSlot.slice(1);
                    entity.params[paramName] = matId;
                }
                entity.params[normalizedSlot] = matId;
            }
        }

        await MaterialManager.updateEntityMaterialSlot(entity, normalizedSlot, matConfig, ctx);

        // Ensure platforms and shapes update 2D/3D geometry
        if (entity.type === 'platform') {
            if (typeof entity.update2D === 'function') entity.update2D();
            if (ctx && typeof ctx.updateMaterialLive === 'function') ctx.updateMaterialLive(entity);
        } else if (ctx && typeof ctx.updateMaterialLive === 'function' && (!entity.materials || Object.keys(entity.materials).length === 0)) {
            ctx.updateMaterialLive(entity);
        }

        if (options.sync !== false && planner && typeof planner.syncAll === 'function') {
            planner.syncAll();
        }

        return true;
    }

    /**
     * Previews a material on a slot temporarily without mutating the canonical JSON model.
     * @param {Object} entity
     * @param {string} slotName
     * @param {Object|string} matConfig
     * @param {Object} [options={}]
     */
    static async previewMaterial(entity, slotName, matConfig, options = {}) {
        const ctx = options.ctx || (typeof window !== 'undefined' ? (window.engine3d || window.app3d) : null);
        await MaterialManager.previewMaterialSlot(entity, slotName, matConfig, ctx);
    }

    /**
     * Resets a material slot back to its factory default.
     * @param {Object} entity
     * @param {string} slotName
     * @param {Object} [options={}]
     */
    static async clearMaterial(entity, slotName, options = {}) {
        return MaterialEngine.applyMaterial(entity, slotName, null, options);
    }

    /**
     * Resolves an unambiguous BIMTargetDescriptor from a raycasted mesh or face.
     * @param {THREE.Mesh} mesh
     * @param {number} [matIndex=-1]
     * @param {THREE.Vector3} [localNormal=null]
     * @param {Object} [entity=null]
     * @returns {Object|null}
     */
    static resolveBIMTarget(mesh, matIndex = -1, localNormal = null, entity = null) {
        return BIMMaterialSystem.resolveBIMTarget(mesh, matIndex, localNormal, entity);
    }

    /**
     * Sets an emissive highlight overlay across all sub-meshes sharing the targeted slot.
     * @param {Object|THREE.Mesh} targetOrMesh
     * @param {boolean} [active=true]
     * @param {number} [color=0x00ff00]
     * @param {Object} [ctx=null]
     */
    static setHighlight(targetOrMesh, active = true, color = 0x00ff00, ctx = null) {
        BIMMaterialSystem.setBIMHighlight(targetOrMesh, active, color, ctx);
    }

    /**
     * Clears highlight on the targeted object.
     * @param {Object|THREE.Mesh} targetOrMesh
     * @param {Object} [ctx=null]
     */
    static clearHighlight(targetOrMesh, ctx = null) {
        BIMMaterialSystem.clearBIMHighlight(targetOrMesh, ctx);
    }

    /**
     * Transaction Engine: Begins a batched material update transaction.
     */
    static beginTransaction() {
        MaterialManager.beginTransaction();
    }

    /**
     * Transaction Engine: Commits the active batched transaction in a single render pass.
     * @param {Object} [ctx=null]
     */
    static async commit(ctx = null) {
        await MaterialManager.commit(ctx);
    }

    /**
     * Transaction Engine: Cancels the active transaction.
     */
    static cancel() {
        MaterialManager.cancel();
    }

    /**
     * Computes diagnostic material and mesh metrics across the 3D scene.
     * @param {THREE.Scene} scene
     * @returns {Object} Metrics
     */
    static getMetrics(scene) {
        return MaterialManager.getMaterialMetrics(scene);
    }

    /**
     * Validates generated 3D sub-meshes against architectural manifest declarations.
     * @param {Object} entity
     * @param {THREE.Object3D} rootObj
     * @param {Object} [options={}]
     * @returns {Object} Validation report
     */
    static validateEntity(entity, rootObj, options = {}) {
        return MaterialManager.validateAssetMaterialSlots(entity, rootObj, options);
    }
}

if (typeof window !== 'undefined') {
    window.MaterialEngine = MaterialEngine;
}

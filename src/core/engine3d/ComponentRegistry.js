import { MaterialSlots, ComponentTypes } from '../constants/materialSlots.js';

/**
 * Unified Component Registry for 3D CAD/BIM Assemblies.
 * Provides O(1) slot-to-mesh lookups, semantic component metadata management,
 * slot-wide highlighting, and selection tracking across doors, windows, walls, and widgets.
 */
export class ComponentRegistry {
    static registry = new Map(); // entityId -> Map<slotName, Set<THREE.Mesh>>
    static meshMetadata = new WeakMap(); // THREE.Mesh -> semantic metadata object

    /**
     * Registers a sub-mesh under an entity's material slot and attaches semantic metadata.
     * @param {Object} entity - Parent 3D entity.
     * @param {string} slotName - Material slot name from MaterialSlots.
     * @param {THREE.Mesh} mesh - The sub-mesh instance.
     * @param {Object} [extraMeta={}] - Additional metadata parameters.
     */
    static registerMesh(entity, slotName, mesh, extraMeta = {}) {
        if (!entity || !entity.id || !mesh || !mesh.isMesh) return;

        const entityId = String(entity.id);
        const slot = slotName || mesh.userData?.materialSlot || MaterialSlots.CUSTOM;

        if (!ComponentRegistry.registry.has(entityId)) {
            ComponentRegistry.registry.set(entityId, new Map());
        }

        const slotMap = ComponentRegistry.registry.get(entityId);
        if (!slotMap.has(slot)) {
            slotMap.set(slot, new Set());
        }
        slotMap.get(slot).add(mesh);

        const metadata = {
            entityId: entityId,
            entityType: entity.type || 'widget',
            componentId: extraMeta.componentId || `${entityId}_${slot}_${slotMap.get(slot).size}`,
            componentType: extraMeta.componentType || ComponentRegistry._inferComponentType(slot),
            materialSlot: slot,
            selectable: extraMeta.selectable !== undefined ? extraMeta.selectable : true,
            highlightable: extraMeta.highlightable !== undefined ? extraMeta.highlightable : true,
            materialLocked: extraMeta.materialLocked || Boolean(mesh.userData?.materialLocked),
            isFrame: slot === MaterialSlots.FRAME,
            isGlass: slot === MaterialSlots.GLASS,
            isHandle: slot === MaterialSlots.HARDWARE,
            isLeaf: slot === MaterialSlots.LEAF,
            isSeal: slot === MaterialSlots.SEAL,
            isTrim: slot === MaterialSlots.TRIM,
            entity: entity
        };

        // Attach metadata both to WeakMap and mesh.userData
        ComponentRegistry.meshMetadata.set(mesh, metadata);
        mesh.userData = {
            ...mesh.userData,
            ...metadata
        };
    }

    /**
     * Unregisters all sub-meshes for an entity.
     * @param {string|Object} entityOrId 
     */
    static unregisterEntity(entityOrId) {
        const entityId = typeof entityOrId === 'object' ? String(entityOrId.id) : String(entityOrId);
        ComponentRegistry.registry.delete(entityId);
    }

    /**
     * Gets all registered meshes for a specific material slot in O(1) time.
     * @param {string|Object} entityOrId 
     * @param {string} slotName 
     * @returns {Array<THREE.Mesh>}
     */
    static getMeshesForSlot(entityOrId, slotName) {
        const entityId = typeof entityOrId === 'object' ? String(entityOrId.id) : String(entityOrId);
        const slotMap = ComponentRegistry.registry.get(entityId);
        if (!slotMap || !slotMap.has(slotName)) return [];
        return Array.from(slotMap.get(slotName)).filter(m => m && m.isMesh);
    }

    /**
     * Gets all registered material slots for an entity.
     * @param {string|Object} entityOrId 
     * @returns {Array<string>}
     */
    static getSlotsForEntity(entityOrId) {
        const entityId = typeof entityOrId === 'object' ? String(entityOrId.id) : String(entityOrId);
        const slotMap = ComponentRegistry.registry.get(entityId);
        if (!slotMap) return [];
        return Array.from(slotMap.keys());
    }

    /**
     * Retrieves semantic metadata for a mesh.
     * @param {THREE.Mesh} mesh 
     * @returns {Object|null}
     */
    static getMetadata(mesh) {
        if (!mesh) return null;
        return ComponentRegistry.meshMetadata.get(mesh) || mesh.userData || null;
    }

    /**
     * Activates or clears slot-wide component highlighting across all sub-meshes registered to a slot in real time.
     * @param {string|Object} entityOrId - Entity or entity ID.
     * @param {string} slotName - Material slot name.
     * @param {boolean} [active=true] - Highlight state.
     * @param {number} [highlightColor=0x00ff00] - Highlight emissive hex color.
     * @param {Object} [ctx=null] - 3D engine context to trigger real-time requestRender.
     */
    static setSlotHighlight(entityOrId, slotName, active = true, highlightColor = 0x00ff00, ctx = null) {
        const meshes = ComponentRegistry.getMeshesForSlot(entityOrId, slotName);
        for (const m of meshes) {
            if (!m || !m.material || m.userData?.highlightable === false) continue;
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            for (const mat of mats) {
                if (!mat || mat.type === 'MeshBasicMaterial' || mat.emissive === undefined) continue;
                if (active) {
                    if (mat.userData.origEmissive === undefined) {
                        mat.userData.origEmissive = mat.emissive.getHex();
                        mat.userData.origEmissiveIntensity = mat.emissiveIntensity || 0;
                    }
                    mat.emissive.setHex(highlightColor);
                    mat.emissiveIntensity = 0.8;
                } else {
                    if (mat.userData.origEmissive !== undefined) {
                        mat.emissive.setHex(mat.userData.origEmissive);
                        mat.emissiveIntensity = mat.userData.origEmissiveIntensity;
                    }
                }
                mat.needsUpdate = true;
            }
        }

        if (ctx && typeof ctx.requestRender === 'function') {
            ctx.requestRender();
        } else if (typeof window !== 'undefined' && window.app3d && typeof window.app3d.requestRender === 'function') {
            window.app3d.requestRender();
        }
    }

    /**
     * Clears highlights from all registered sub-meshes of an entity.
     * @param {string|Object} entityOrId 
     * @param {Object} [ctx=null]
     */
    static clearAllEntityHighlights(entityOrId, ctx = null) {
        const slots = ComponentRegistry.getSlotsForEntity(entityOrId);
        for (const slot of slots) {
            ComponentRegistry.setSlotHighlight(entityOrId, slot, false, 0x00ff00, ctx);
        }
    }

    /**
     * Infers ComponentType from MaterialSlot.
     * @private
     */
    static _inferComponentType(slot) {
        if (slot === MaterialSlots.FRAME) return ComponentTypes.FRAME;
        if (slot === MaterialSlots.LEAF) return ComponentTypes.LEAF;
        if (slot === MaterialSlots.GLASS) return ComponentTypes.GLASS;
        if (slot === MaterialSlots.HARDWARE) return ComponentTypes.HARDWARE;
        if (slot === MaterialSlots.SEAL) return ComponentTypes.SEAL;
        if (slot === MaterialSlots.SCREEN) return ComponentTypes.SCREEN;
        if (slot === MaterialSlots.TRIM) return ComponentTypes.TRIM;
        if (slot.startsWith('wall_')) return ComponentTypes.WALL;
        return ComponentTypes.WIDGET;
    }
}

if (typeof window !== 'undefined') {
    window.ComponentRegistry = ComponentRegistry;
}

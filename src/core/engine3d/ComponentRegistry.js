import { MaterialSlots, ComponentTypes, SLOT_DEFINITIONS, INTERACTION_MODES } from '../constants/materialSlots.js';
import { UniversalMaterialComponent } from './UniversalMaterialManager.js';


/**
 * 3-Layer Architecture Component Registry for 3D CAD/BIM Assemblies.
 * Layer 1: Component Registry (Selection, hover, componentId grouping, property panels, visibility, locking).
 * Layer 2: Material Slots (Inheritance, explicit overrides, serialization).
 * Layer 3: Mesh Registry (Efficient O(1) rendering & material application).
 */
export class ComponentRegistry {
    static slotRegistry = new Map();      // entityId -> Map<slotName, Set<THREE.Mesh>>
    static componentRegistry = new Map(); // entityId -> Map<componentId, Set<THREE.Mesh>>
    static meshMetadata = new WeakMap();  // THREE.Mesh -> semantic metadata object
    static currentMode = INTERACTION_MODES.COMPONENT;

    /**
     * Sets the active selection/interaction granularity mode.
     * @param {string} mode - 'component', 'slot', or 'mesh'.
     */
    static setInteractionMode(mode) {
        ComponentRegistry.currentMode = mode || INTERACTION_MODES.COMPONENT;
    }

    /**
     * Registers a sub-mesh under an entity's component & slot maps and attaches semantic metadata.
     * @param {Object} entity - Parent 3D entity.
     * @param {string} slotName - Material slot name from MaterialSlots.
     * @param {THREE.Mesh} mesh - The sub-mesh instance.
     * @param {Object} [extraMeta={}] - Additional metadata parameters.
     */
    static registerMesh(entity, slotName, mesh, extraMeta = {}) {
        if (!entity || !entity.id || !mesh || !mesh.isMesh) return;

        const entityId = String(entity.id);
        const slot = slotName || mesh.userData?.materialSlot || MaterialSlots.CUSTOM;
        const componentId = extraMeta.componentId || `${entityId}_${slot}`;

        // Universal Architectural Flag Injection
        const def = SLOT_DEFINITIONS[slot];
        if (mesh.userData.paintable === undefined && def && def.paintable !== undefined) {
            mesh.userData.paintable = def.paintable;
        }

        // 1. Layer 3 Mesh Registry (Slot -> Meshes)
        if (!ComponentRegistry.slotRegistry.has(entityId)) {
            ComponentRegistry.slotRegistry.set(entityId, new Map());
        }
        const slotMap = ComponentRegistry.slotRegistry.get(entityId);
        if (!slotMap.has(slot)) {
            slotMap.set(slot, new Set());
        }
        slotMap.get(slot).add(mesh);

        // 2. Layer 1 Component Registry (Component -> Meshes)
        if (!ComponentRegistry.componentRegistry.has(entityId)) {
            ComponentRegistry.componentRegistry.set(entityId, new Map());
        }
        const compMap = ComponentRegistry.componentRegistry.get(entityId);
        if (!compMap.has(componentId)) {
            compMap.set(componentId, new Set());
        }
        compMap.get(componentId).add(mesh);

        const metadata = {
            entityId: entityId,
            entityType: entity.type || 'widget',
            componentId: componentId,
            componentType: extraMeta.componentType || ComponentRegistry._inferComponentType(slot),
            materialSlot: slot,
            inheritsSlot: SLOT_DEFINITIONS[slot]?.inherits || null,
            selectable: extraMeta.selectable !== undefined ? extraMeta.selectable : true,
            highlightable: extraMeta.highlightable !== undefined ? extraMeta.highlightable : true,
            materialLocked: extraMeta.materialLocked || Boolean(mesh.userData?.materialLocked),
            entity: entity
        };

        ComponentRegistry.meshMetadata.set(mesh, metadata);
        mesh.userData = {
            ...mesh.userData,
            ...metadata
        };

        if (!mesh.userData.materialComponent) {
            new UniversalMaterialComponent(entity, mesh, slot);
        }
    }

    /**
     * Unregisters all sub-meshes for an entity.
     * @param {string|Object} entityOrId 
     */
    static unregisterEntity(entityOrId) {
        const entityId = typeof entityOrId === 'object' ? String(entityOrId.id) : String(entityOrId);
        ComponentRegistry.slotRegistry.delete(entityId);
        ComponentRegistry.componentRegistry.delete(entityId);
    }

    /**
     * Gets all registered meshes for a specific material slot in O(1) time.
     * @param {string|Object} entityOrId 
     * @param {string} slotName 
     * @returns {Array<THREE.Mesh>}
     */
    static getMeshesForSlot(entityOrId, slotName) {
        const entityId = typeof entityOrId === 'object' ? String(entityOrId.id) : String(entityOrId);
        const slotMap = ComponentRegistry.slotRegistry.get(entityId);
        if (!slotMap || !slotMap.has(slotName)) return [];
        return Array.from(slotMap.get(slotName)).filter(m => m && m.isMesh);
    }

    /**
     * Gets all registered meshes for a specific componentId in O(1) time.
     * @param {string|Object} entityOrId 
     * @param {string} componentId 
     * @returns {Array<THREE.Mesh>}
     */
    static getMeshesForComponent(entityOrId, componentId) {
        const entityId = typeof entityOrId === 'object' ? String(entityOrId.id) : String(entityOrId);
        const compMap = ComponentRegistry.componentRegistry.get(entityId);
        if (!compMap || !compMap.has(componentId)) return [];
        return Array.from(compMap.get(componentId)).filter(m => m && m.isMesh);
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
     * Highlights sub-meshes based on active interaction mode (Component Mode, Slot Mode, or Mesh Mode).
     * @param {THREE.Mesh} mesh 
     * @param {boolean} [active=true] 
     * @param {number} [highlightColor=0x93c5fd] 
     * @param {Object} [ctx=null] 
     */
    static highlightMeshByInteractionMode(mesh, active = true, highlightColor = 0x93c5fd, ctx = null) {
        if (!mesh) return;

        const meta = ComponentRegistry.getMetadata(mesh);
        if (!meta || !meta.entityId) {
            ComponentRegistry._applyMeshHighlightDirect([mesh], active, highlightColor);
            if (ctx && typeof ctx.requestRender === 'function') ctx.requestRender();
            return;
        }

        let targetMeshes = [];

        if (ComponentRegistry.currentMode === INTERACTION_MODES.COMPONENT && meta.componentId) {
            targetMeshes = ComponentRegistry.getMeshesForComponent(meta.entityId, meta.componentId);
        } else if (ComponentRegistry.currentMode === INTERACTION_MODES.SLOT && meta.materialSlot) {
            targetMeshes = ComponentRegistry.getMeshesForSlot(meta.entityId, meta.materialSlot);
        } else {
            targetMeshes = [mesh];
        }

        ComponentRegistry._applyMeshHighlightDirect(targetMeshes, active, highlightColor);

        if (ctx && typeof ctx.requestRender === 'function') {
            ctx.requestRender();
        } else if (typeof window !== 'undefined' && window.app3d && typeof window.app3d.requestRender === 'function') {
            window.app3d.requestRender();
        }
    }

    /**
     * Activates or clears slot-wide component highlighting.
     * @param {string|Object} entityOrId 
     * @param {string} slotName 
     * @param {boolean} [active=true] 
     * @param {number} [highlightColor=0x00ff00] 
     * @param {Object} [ctx=null] 
     */
    static setSlotHighlight(entityOrId, slotName, active = true, highlightColor = 0x00ff00, ctx = null) {
        const meshes = ComponentRegistry.getMeshesForSlot(entityOrId, slotName);
        ComponentRegistry._applyMeshHighlightDirect(meshes, active, highlightColor);

        if (ctx && typeof ctx.requestRender === 'function') {
            ctx.requestRender();
        } else if (typeof window !== 'undefined' && window.app3d && typeof window.app3d.requestRender === 'function') {
            window.app3d.requestRender();
        }
    }

    /**
     * @private
     */
    static _applyMeshHighlightDirect(meshes, active, color) {
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
                    mat.emissive.setHex(color);
                    mat.emissiveIntensity = 0.25;
                } else {
                    if (mat.userData.origEmissive !== undefined) {
                        mat.emissive.setHex(mat.userData.origEmissive);
                        mat.emissiveIntensity = mat.userData.origEmissiveIntensity;
                    }
                }
                mat.needsUpdate = true;
            }
        }
    }

    /**
     * @private
     */
    static _inferComponentType(slot) {
        if (slot === MaterialSlots.FRAME) return ComponentTypes.FRAME;
        if (slot.startsWith('sash_')) return ComponentTypes.SASH;
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

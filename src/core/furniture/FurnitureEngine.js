/**
 * src/core/furniture/FurnitureEngine.js
 * 
 * Canonical Domain Authority for Furniture Lifecycle:
 * - createFurniture
 * - serialize
 * - deserialize
 * - deleteFurniture
 * - duplicateFurniture
 */
import { PremiumFurniture } from '../../features/furniture/furniture.renderer2d.js';
import { coreEventBus } from '../EventBus.js';
import { EVENTS } from '../registry.js';
import { globalSpatialDependencyEngine, RELATIONSHIP_TYPES } from '../spatial/SpatialDependencyEngine.js';

export class FurnitureEngine {
    /**
     * Create and initialize a new furniture entity.
     * @param {Object} planner - The floor planner instance
     * @param {Object} options - Configuration options
     * @returns {PremiumFurniture}
     */
    static createFurniture(planner, options = {}) {
        const x = options.x ?? (planner?.stage ? planner.stage.width() / 2 : 0);
        const y = options.y ?? (planner?.stage ? planner.stage.height() / 2 : 0);
        const configId = options.configId || options.type || 'chair';
        const id = options.id || null;

        const entity = new PremiumFurniture(planner, x, y, configId, id);

        if (options.width !== undefined && options.width !== null) entity.width = Number(options.width);
        if (options.depth !== undefined && options.depth !== null) entity.depth = Number(options.depth);
        if (options.height !== undefined && options.height !== null) entity.height = Number(options.height);
        if (options.elevation !== undefined && options.elevation !== null) entity.elevation = Number(options.elevation);
        if (options.rotation !== undefined && options.rotation !== null) entity.rotation = Number(options.rotation);
        if (options.parentWallId !== undefined) entity.parentWallId = options.parentWallId;
        if (options.hostPlatformId !== undefined) entity.hostPlatformId = options.hostPlatformId;
        if (options.hostFurnitureId !== undefined) entity.hostFurnitureId = options.hostFurnitureId;
        if (options.hostId !== undefined) entity.hostId = options.hostId;
        if (options.hostType !== undefined) entity.hostType = options.hostType;
        if (options.relationshipType !== undefined) entity.relationshipType = options.relationshipType;
        if (options.localTransform !== undefined) entity.localTransform = options.localTransform ? JSON.parse(JSON.stringify(options.localTransform)) : null;
        if (options.relativeElevation !== undefined && options.relativeElevation !== null) entity.relativeElevation = Number(options.relativeElevation);
        if (options.description !== undefined) entity.description = options.description;

        if (!entity.hostId) {
            if (options.hostPlatformId) {
                entity.hostId = options.hostPlatformId;
                entity.hostType = 'platform';
                entity.relationshipType = entity.relationshipType || RELATIONSHIP_TYPES.SURFACE_ATTACHED;
            } else if (options.hostFurnitureId) {
                entity.hostId = options.hostFurnitureId;
                entity.hostType = 'furniture';
                entity.relationshipType = entity.relationshipType || RELATIONSHIP_TYPES.SURFACE_ATTACHED;
            } else if (options.parentWallId) {
                entity.hostId = options.parentWallId;
                entity.hostType = 'wall';
                entity.relationshipType = entity.relationshipType || RELATIONSHIP_TYPES.SURFACE_ATTACHED;
            }
        }

        if (entity.hostId && planner) {
            const allEntities = [...(planner.platforms || []), ...(planner.furniture || []), ...(planner.walls || [])];
            const hostEntity = allEntities.find(e => e && e.id === entity.hostId);
            if (hostEntity) {
                globalSpatialDependencyEngine.attach(entity, hostEntity, {
                    relationshipType: entity.relationshipType || RELATIONSHIP_TYPES.SURFACE_ATTACHED,
                    localTransform: entity.localTransform,
                    computeFromCurrentWorld: !entity.localTransform
                });
            }
        }

        if (options.materials) {
            entity.materials = JSON.parse(JSON.stringify(options.materials));
        } else if (!entity.materials) {
            entity.materials = {};
        }

        if (options.params) {
            entity.params = JSON.parse(JSON.stringify(options.params));
        }

        if (options.colorBase !== undefined) entity.colorBase = options.colorBase;
        if (options.colorDoor !== undefined) entity.colorDoor = options.colorDoor;
        if (options.colorHandle !== undefined) entity.colorHandle = options.colorHandle;

        if (typeof entity.update2D === 'function') {
            entity.update2D();
        } else if (typeof entity.update === 'function') {
            entity.update();
        }

        const addToPlanner = options.addToPlanner !== false;
        if (addToPlanner && planner) {
            if (!planner.furniture) planner.furniture = [];
            if (!planner.furniture.includes(entity)) {
                planner.furniture.push(entity);
            }
            if (options.select && typeof planner.selectEntity === 'function') {
                planner.selectEntity(entity, 'furniture');
            }
            if (typeof planner.syncAll === 'function') {
                planner.syncAll();
            }
        }

        return entity;
    }

    /**
     * Authoritative JSON serialization for a furniture entity.
     * @param {Object} furniture 
     * @returns {Object} Serialized furniture state
     */
    static serialize(furniture) {
        if (!furniture) return null;

        const getCoord = (field) => {
            if (furniture.group && typeof furniture.group[field] === 'function') {
                return furniture.group[field]();
            }
            return furniture[field] ?? 0;
        };

        const configId = furniture.configId || furniture.config?.id;

        return {
            id: furniture.id,
            type: 'furniture',
            configId: configId,
            x: getCoord('x'),
            y: getCoord('y'),
            rotation: furniture.rotation ?? (furniture.group && typeof furniture.group.rotation === 'function' ? furniture.group.rotation() : 0),
            width: furniture.width,
            depth: furniture.depth,
            height: furniture.height,
            elevation: furniture.elevation || 0,
            materials: furniture.materials ? JSON.parse(JSON.stringify(furniture.materials)) : {},
            params: furniture.params ? JSON.parse(JSON.stringify(furniture.params)) : null,
            hostPlatformId: furniture.hostPlatformId || null,
            hostFurnitureId: furniture.hostFurnitureId || null,
            parentWallId: furniture.parentWallId || null,
            hostId: furniture.hostId || furniture.parentWallId || furniture.hostPlatformId || furniture.hostFurnitureId || null,
            hostType: furniture.hostType || (furniture.parentWallId ? 'wall' : (furniture.hostPlatformId ? 'platform' : (furniture.hostFurnitureId ? 'furniture' : null))),
            relationshipType: furniture.relationshipType || null,
            localTransform: furniture.localTransform ? JSON.parse(JSON.stringify(furniture.localTransform)) : null,
            relativeElevation: furniture.relativeElevation || 0,
            description: furniture.description || null,
            colorBase: furniture.colorBase || undefined,
            colorDoor: furniture.colorDoor || undefined,
            colorHandle: furniture.colorHandle || undefined
        };
    }

    /**
     * Authoritative deserialization of furniture state into active entity.
     * @param {Object} planner 
     * @param {Object} data - Serialized state 
     * @param {Object} options 
     * @returns {PremiumFurniture}
     */
    static deserialize(planner, data, options = {}) {
        if (!data) return null;

        const configId = data.configId || data.type || 'chair';
        const createOptions = {
            id: data.id,
            x: data.x,
            y: data.y,
            configId: configId,
            width: data.width,
            depth: data.depth,
            height: data.height,
            elevation: data.elevation,
            rotation: data.rotation,
            materials: data.materials,
            params: data.params,
            hostPlatformId: data.hostPlatformId,
            hostFurnitureId: data.hostFurnitureId,
            parentWallId: data.parentWallId,
            hostId: data.hostId || data.parentWallId || data.hostPlatformId || data.hostFurnitureId || null,
            hostType: data.hostType || (data.parentWallId ? 'wall' : (data.hostPlatformId ? 'platform' : (data.hostFurnitureId ? 'furniture' : null))),
            relationshipType: data.relationshipType || null,
            localTransform: data.localTransform || null,
            relativeElevation: data.relativeElevation,
            description: data.description,
            colorBase: data.colorBase,
            colorDoor: data.colorDoor,
            colorHandle: data.colorHandle,
            addToPlanner: options.addToPlanner !== false,
            select: options.select === true
        };

        return FurnitureEngine.createFurniture(planner, createOptions);
    }

    /**
     * Cleanly delete furniture entity, disposing Konva and 3D nodes.
     * @param {Object} planner 
     * @param {Object|string} furnitureOrId 
     * @param {Object} options 
     * @returns {boolean}
     */
    static deleteFurniture(planner, furnitureOrId, options = {}) {
        if (!planner) return false;

        let entity = null;
        let id = null;
        if (typeof furnitureOrId === 'string') {
            id = furnitureOrId;
            entity = (planner.furniture || []).find(f => f.id === id);
        } else {
            entity = furnitureOrId;
            id = entity?.id;
        }

        if (!entity && !id) return false;

        if (entity) {
            globalSpatialDependencyEngine.detach(entity);
        } else if (id) {
            globalSpatialDependencyEngine.detach(id);
        }

        // Remove from planner.furniture array
        if (planner.furniture) {
            planner.furniture = planner.furniture.filter(f => f !== entity && f.id !== id);
        }

        // Deselect if active
        if (planner.selectedEntity && (planner.selectedEntity === entity || planner.selectedEntity.id === id)) {
            if (typeof planner.selectEntity === 'function') {
                planner.selectEntity(null);
            } else {
                planner.selectedEntity = null;
                planner.selectedType = null;
            }
        }

        // Clean up 3D mesh if present
        if (entity && entity.mesh3D && entity.mesh3D.parent) {
            entity.mesh3D.parent.remove(entity.mesh3D);
        }

        // Clean up Konva 2D group
        if (entity && entity.group && typeof entity.group.destroy === 'function') {
            entity.group.destroy();
        }

        // Emit events if in browser context
        if (typeof window !== 'undefined') {
            const eventPayload = { entityId: id, entity };
            if (EVENTS?.ENTITY_REMOVED) {
                coreEventBus.emit(EVENTS.ENTITY_REMOVED, eventPayload);
            }
            if (EVENTS?.SCENE_CHANGED) {
                coreEventBus.emit(EVENTS.SCENE_CHANGED);
            }
        }

        if (options.sync !== false && typeof planner.syncAll === 'function') {
            planner.syncAll();
        }

        return true;
    }

    /**
     * Duplicate an existing furniture entity with offset.
     * @param {Object} planner 
     * @param {Object} sourceEntity 
     * @param {Object} offset 
     * @returns {PremiumFurniture}
     */
    static duplicateFurniture(planner, sourceEntity, offset = { x: 20, y: 20 }) {
        if (!sourceEntity) return null;

        const serialized = FurnitureEngine.serialize(sourceEntity);
        if (!serialized) return null;

        // Fresh unique ID and offset positions
        serialized.id = 'furn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        serialized.x = (serialized.x || 0) + (offset.x || 20);
        serialized.y = (serialized.y || 0) + (offset.y || 20);

        return FurnitureEngine.deserialize(planner, serialized, { addToPlanner: true, select: true });
    }
}

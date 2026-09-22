/**
 * StairTopologyEngine.js
 * 
 * Single source of truth for staircase creation, deletion, duplication,
 * serialization, and collection management on planner.stairs[].
 */

import { PremiumStaircase } from '../../features/stairs/stairs.renderer2d.js';
import { StairV4Flight, StairV4Landing } from '../../features/stairs/StaircaseV4.js';
import { globalSpatialDependencyEngine, RELATIONSHIP_TYPES } from '../spatial/SpatialDependencyEngine.js';

export class StairTopologyEngine {
    /**
     * Creates a new canonical staircase instance and optionally registers it in planner.stairs.
     * 
     * @param {Object} planner - FloorPlanner instance
     * @param {Object} options - Stair parameters
     * @returns {Object} Instantiated staircase instance
     */
    static createStair(planner, options = {}) {
        const {
            id,
            shape = 'straight',
            type,
            x = 0,
            y = 0,
            elevation = 0,
            rotation = 0,
            height = 300,
            width = 100,
            stepDepth = 28,
            stepHeight = 17.5,
            totalSteps = 12,
            flight1Steps,
            flight2Steps,
            landingSize,
            gapWidth = 20,
            turnDirection = 'right',
            hasTopLanding = false,
            hasBottomLanding = false,
            stringerType = 'solid',
            primaryColor = '#8b5a2b',
            materials,
            leftRailing,
            rightRailing,
            railingLayout = 'both',
            linkRailings = true,
            addToPlanner = true,
            hostPlatformId = null,
            targetPlatformId = null,
            hostId = null,
            hostType = null,
            relationshipType = null,
            localTransform = null,
            relativeElevation = null
        } = options;

        const cleanShape = shape.replace('stair_v5_', '').replace('stair_v4_', '');
        const finalType = type || `stair_v5_${cleanShape}`;

        const stairData = {
            id: id || 'stairv5_' + Math.random().toString(36).substr(2, 9),
            type: finalType,
            shape: cleanShape,
            x: Number(x),
            y: Number(y),
            elevation: Number(elevation),
            rotation: Number(rotation),
            height: Number(height),
            width: Number(width),
            stepDepth: Number(stepDepth),
            stepHeight: Number(stepHeight),
            totalSteps: Number(totalSteps),
            flight1Steps: flight1Steps !== undefined ? Number(flight1Steps) : (cleanShape === 'straight' ? Number(totalSteps) : 8),
            flight2Steps: flight2Steps !== undefined ? Number(flight2Steps) : (cleanShape === 'straight' ? 0 : 7),
            landingSize: landingSize !== undefined ? Number(landingSize) : Number(width),
            gapWidth: Number(gapWidth),
            turnDirection,
            hasTopLanding: Boolean(hasTopLanding),
            hasBottomLanding: Boolean(hasBottomLanding),
            stringerType,
            primaryColor,
            materials: materials ? JSON.parse(JSON.stringify(materials)) : {
                treads: { id: 'wood_oak' },
                risers: { id: 'wood_oak' },
                stringers: { id: 'wood_oak' },
                landings: { id: 'wood_oak' }
            },
            railingLayout,
            linkRailings: Boolean(linkRailings),
            hostPlatformId: hostPlatformId || hostId || null,
            targetPlatformId: targetPlatformId || null,
            hostId: hostId || hostPlatformId || null,
            hostType: hostType || (hostPlatformId ? 'platform' : null),
            relationshipType: relationshipType || (hostPlatformId ? RELATIONSHIP_TYPES.SUPPORTED : null),
            localTransform: localTransform ? JSON.parse(JSON.stringify(localTransform)) : null,
            relativeElevation: relativeElevation !== null && relativeElevation !== undefined ? Number(relativeElevation) : null
        };

        if (leftRailing) stairData.leftRailing = JSON.parse(JSON.stringify(leftRailing));
        if (rightRailing) stairData.rightRailing = JSON.parse(JSON.stringify(rightRailing));

        let stair = null;
        if (planner) {
            stair = new PremiumStaircase(planner, cleanShape, stairData);
        } else {
            stair = stairData;
        }

        if (stair && stair.hostId && planner) {
            const allEntities = [...(planner.platforms || []), ...(planner.walls || [])];
            const hostEntity = allEntities.find(e => e && e.id === stair.hostId);
            if (hostEntity) {
                globalSpatialDependencyEngine.attach(stair, hostEntity, {
                    relationshipType: stair.relationshipType || RELATIONSHIP_TYPES.SUPPORTED,
                    localTransform: stair.localTransform,
                    computeFromCurrentWorld: !stair.localTransform
                });
            }
        }

        if (addToPlanner && planner) {
            if (!planner.stairs) planner.stairs = [];
            planner.stairs.push(stair);
            if (typeof planner.syncAll === 'function') {
                planner.syncAll();
            }
        }

        return stair;
    }

    /**
     * Deletes a staircase cleanly from layers and planner.stairs.
     * 
     * @param {Object} planner 
     * @param {Object|string} stairOrId 
     * @returns {Object|null} The deleted stair entity
     */
    static deleteStair(planner, stairOrId) {
        if (!planner || !planner.stairs) return null;

        const id = typeof stairOrId === 'string' ? stairOrId : stairOrId?.id;
        const stairIndex = planner.stairs.findIndex(s => s.id === id || s === stairOrId);
        if (stairIndex === -1) return null;

        const [deletedStair] = planner.stairs.splice(stairIndex, 1);

        if (deletedStair) {
            globalSpatialDependencyEngine.detach(deletedStair);
            if (deletedStair.group && typeof deletedStair.group.destroy === 'function') {
                deletedStair.group.destroy();
            }
            if (planner.selectedEntity === deletedStair) {
                planner.selectEntity(null);
            }
            if (typeof planner.syncAll === 'function') {
                planner.syncAll();
            }
        }

        return deletedStair;
    }

    /**
     * Duplicates an existing staircase with an optional position offset.
     * 
     * @param {Object} planner 
     * @param {Object|string} stairOrId 
     * @param {{x: number, y: number}} [offset={x: 30, y: 30}]
     * @returns {Object} Duplicated staircase entity
     */
    static duplicateStair(planner, stairOrId, offset = { x: 30, y: 30 }) {
        if (!planner || !planner.stairs) throw new Error('Planner or stairs array missing');

        const stair = typeof stairOrId === 'string' 
            ? planner.stairs.find(s => s.id === stairOrId) 
            : stairOrId;

        if (!stair) throw new Error(`Stair not found for duplication`);

        const serialized = this.serialize(stair);
        serialized.id = 'stairv5_' + Math.random().toString(36).substr(2, 9);
        serialized.x = (serialized.x || 0) + (offset.x || 30);
        serialized.y = (serialized.y || 0) + (offset.y || 30);

        return this.createStair(planner, serialized);
    }

    /**
     * Serializes a staircase entity into a portable JSON structure.
     * 
     * @param {Object} stair 
     * @returns {Object}
     */
    static serialize(stair) {
        if (!stair) return null;

        if (stair.type === 'stair_v4_flight' || stair.type === 'stair_v4_landing') {
            return {
                id: stair.id,
                type: stair.type,
                systemId: stair.systemId,
                x: stair.group && typeof stair.group.x === 'function' ? stair.group.x() : (Number(stair.x) || 0),
                y: stair.group && typeof stair.group.y === 'function' ? stair.group.y() : (Number(stair.y) || 0),
                rotation: stair.group && typeof stair.group.rotation === 'function' ? stair.group.rotation() : (Number(stair.rotation) || 0),
                elevation: Number(stair.elevation) || 0,
                direction: stair.direction || 'up',
                stepCount: stair.stepCount,
                stepDepth: stair.stepDepth,
                stepHeight: stair.stepHeight,
                width: stair.width,
                length: stair.length,
                shape: stair.shape,
                innerRadius: stair.innerRadius,
                description: stair.description,
                connections: stair.connections ? JSON.parse(JSON.stringify(stair.connections)) : []
            };
        }

        return {
            id: stair.id,
            type: stair.type || `stair_v5_${stair.shape || 'straight'}`,
            shape: stair.shape || 'straight',
            x: stair.group && typeof stair.group.x === 'function' ? stair.group.x() : (Number(stair.x) || 0),
            y: stair.group && typeof stair.group.y === 'function' ? stair.group.y() : (Number(stair.y) || 0),
            elevation: Number(stair.elevation) || 0,
            rotation: stair.group && typeof stair.group.rotation === 'function' ? stair.group.rotation() : (Number(stair.rotation) || 0),
            height: Number(stair.height) || 300,
            width: Number(stair.width) || 100,
            stepDepth: Number(stair.stepDepth) || 28,
            stepHeight: Number(stair.stepHeight) || 17.5,
            totalSteps: Number(stair.totalSteps) || 12,
            flight1Steps: Number(stair.flight1Steps) || 8,
            flight2Steps: Number(stair.flight2Steps) || 7,
            landingSize: Number(stair.landingSize) || Number(stair.width) || 100,
            gapWidth: Number(stair.gapWidth) || 20,
            turnDirection: stair.turnDirection || 'right',
            hasTopLanding: Boolean(stair.hasTopLanding),
            hasBottomLanding: Boolean(stair.hasBottomLanding),
            stringerType: stair.stringerType || 'solid',
            stringerWidth: Number(stair.stringerWidth) || 10,
            stringerThickness: Number(stair.stringerThickness) || 20,
            beamOffset: stair.beamOffset !== undefined ? Number(stair.beamOffset) : 25,
            landingSupports: Boolean(stair.landingSupports),
            primaryColor: stair.primaryColor || '#8b5a2b',
            primaryMaterial: stair.primaryMaterial || 'wood_oak',
            materials: stair.materials ? JSON.parse(JSON.stringify(stair.materials)) : {
                treads: { id: 'wood_oak' },
                risers: { id: 'wood_oak' },
                stringers: { id: 'wood_oak' },
                landings: { id: 'wood_oak' }
            },
            railingLayout: stair.railingLayout || 'both',
            linkRailings: stair.linkRailings !== undefined ? Boolean(stair.linkRailings) : true,
            leftRailing: stair.leftRailing ? JSON.parse(JSON.stringify(stair.leftRailing)) : null,
            rightRailing: stair.rightRailing ? JSON.parse(JSON.stringify(stair.rightRailing)) : null,
            hostPlatformId: stair.hostPlatformId || stair.hostId || null,
            targetPlatformId: stair.targetPlatformId || null,
            hostId: stair.hostId || stair.hostPlatformId || null,
            hostType: stair.hostType || (stair.hostPlatformId ? 'platform' : null),
            relationshipType: stair.relationshipType || null,
            localTransform: stair.localTransform ? JSON.parse(JSON.stringify(stair.localTransform)) : null,
            relativeElevation: stair.relativeElevation !== undefined && stair.relativeElevation !== null ? Number(stair.relativeElevation) : null
        };
    }

    /**
     * Deserializes JSON state back into a canonical stair entity.
     * 
     * @param {Object} planner 
     * @param {Object} data 
     * @returns {Object}
     */
    static deserialize(planner, data) {
        if (!data) return null;

        if (data.type === 'stair_v4_flight') {
            const flight = new StairV4Flight(planner, data);
            return flight;
        } else if (data.type === 'stair_v4_landing') {
            const landing = new StairV4Landing(planner, data);
            return landing;
        }

        return this.createStair(planner, { ...data, addToPlanner: false });
    }
}

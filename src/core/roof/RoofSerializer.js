/**
 * RoofSerializer.js
 * 
 * Centralized Serialization and Deserialization for Roofs:
 * - Schema-safe export to JSON
 * - Schema-safe restoration from JSON
 */

import { RoofTopologyEngine } from './RoofTopologyEngine.js';

export class RoofSerializer {
    /**
     * Serializes a roof instance to a clean plain JSON object.
     * @param {Object} roof 
     * @returns {Object}
     */
    static serialize(roof) {
        if (!roof) return null;
        const conf = roof.config || {};
        const gx = roof.group && typeof roof.group.x === 'function' ? roof.group.x() : (roof.x || 0);
        const gy = roof.group && typeof roof.group.y === 'function' ? roof.group.y() : (roof.y || 0);

        return {
            id: roof.id,
            x: gx,
            y: gy,
            rotation: roof.rotation || 0,
            elevation: roof.elevation !== undefined ? roof.elevation : 120,
            width: conf.width,
            depth: conf.depth,
            pitch: conf.pitch !== undefined ? conf.pitch : 30,
            curve: conf.curve || 0,
            overhang: conf.overhang !== undefined ? conf.overhang : 8,
            overhangs: conf.overhangs ? [...conf.overhangs] : undefined,
            thickness: conf.thickness !== undefined ? conf.thickness : 10,
            ridgeOffset: conf.ridgeOffset || 0,
            points: roof.points ? roof.points.map(p => ({ x: p.x, y: p.y })) : [],
            isHip: !!roof.points,
            roofType: conf.roofType || 'hip',
            material: conf.material || 'dark_asphalt_roof',
            configId: roof.configId || conf.material || 'dark_asphalt_roof',
            wallGap: conf.wallGap || 0,
            ridgeAxis: conf.ridgeAxis || 'x',
            manualRidge: !!conf.manualRidge,
            flipSlope: !!conf.flipSlope,
            autoShapeWalls: !!conf.autoShapeWalls,
            autoPlacementMode: conf.autoPlacementMode || 'manual',
            gableMaterial: conf.gableMaterial || 'white_plaster_wall',
            fasciaMaterial: conf.fasciaMaterial || undefined,
            tileSize: roof.tileSize !== undefined ? roof.tileSize : (conf.tileSize !== undefined ? conf.tileSize : undefined),
            slopes: conf.slopes ? JSON.parse(JSON.stringify(conf.slopes)) : undefined,
            skylights: conf.skylights ? JSON.parse(JSON.stringify(conf.skylights)) : [],
            crestings: conf.crestings ? JSON.parse(JSON.stringify(conf.crestings)) : [],
            finials: conf.finials ? JSON.parse(JSON.stringify(conf.finials)) : [],
            chimneys: conf.chimneys ? JSON.parse(JSON.stringify(conf.chimneys)) : [],
            _restingOnWalls: Boolean(roof._restingOnWalls),
            _lastSyncedWallTop: roof._lastSyncedWallTop !== undefined ? roof._lastSyncedWallTop : null,
            hostWallIds: roof.hostWallIds ? [...roof.hostWallIds] : [],
            radius: roof.radius !== undefined ? roof.radius : (conf.radius !== undefined ? conf.radius : 0),
            cornerRadii: conf.cornerRadii ? [...conf.cornerRadii] : (roof.cornerRadii ? [...roof.cornerRadii] : undefined),
            wallSides: conf.wallSides ? { ...conf.wallSides } : (roof.wallSides ? { ...roof.wallSides } : undefined),
            wallDropHeight: conf.wallDropHeight !== undefined ? conf.wallDropHeight : (roof.wallDropHeight !== undefined ? roof.wallDropHeight : undefined),
            connectedWallId: roof.connectedWallId || conf.connectedWallId || null,
            hasSpotlights: conf.hasSpotlights !== undefined ? Boolean(conf.hasSpotlights) : (roof.hasSpotlights !== undefined ? Boolean(roof.hasSpotlights) : undefined),
            spotlightCount: conf.spotlightCount !== undefined ? conf.spotlightCount : (roof.spotlightCount !== undefined ? roof.spotlightCount : undefined),
            spotlightSpacing: conf.spotlightSpacing !== undefined ? conf.spotlightSpacing : (roof.spotlightSpacing !== undefined ? roof.spotlightSpacing : undefined),
            edgeCurves: conf.edgeCurves ? JSON.parse(JSON.stringify(conf.edgeCurves)) : (roof.edgeCurves ? JSON.parse(JSON.stringify(roof.edgeCurves)) : undefined),
            materials: roof.materials ? JSON.parse(JSON.stringify(roof.materials)) : (conf.materials ? JSON.parse(JSON.stringify(conf.materials)) : undefined),
            levelId: roof.levelId !== undefined ? roof.levelId : (conf.levelId !== undefined ? conf.levelId : null),
            description: roof.description
        };
    }

    /**
     * Recreates a roof entity from serialized JSON data.
     * @param {Object} rData 
     * @param {Object} planner 
     * @param {Object} [options={}]
     * @returns {Object|null}
     */
    static deserialize(rData, planner, options = {}) {
        if (!rData || !rData.points || !Array.isArray(rData.points) || rData.points.length < 3) {
            return null;
        }

        const config = {
            pitch: rData.pitch !== undefined ? rData.pitch : 30,
            curve: rData.curve || 0,
            overhang: rData.overhang !== undefined ? rData.overhang : 8,
            overhangs: rData.overhangs ? [...rData.overhangs] : undefined,
            thickness: rData.thickness !== undefined ? rData.thickness : 10,
            ridgeOffset: rData.ridgeOffset || 0,
            roofType: rData.roofType || 'hip',
            material: rData.material || 'dark_asphalt_roof',
            wallGap: rData.wallGap || 0,
            ridgeAxis: rData.ridgeAxis || 'x',
            manualRidge: !!rData.manualRidge,
            flipSlope: !!rData.flipSlope,
            autoShapeWalls: !!rData.autoShapeWalls,
            autoPlacementMode: rData.autoPlacementMode || 'manual',
            gableMaterial: rData.gableMaterial || 'white_plaster_wall',
            fasciaMaterial: rData.fasciaMaterial || undefined,
            tileSize: rData.tileSize !== undefined ? rData.tileSize : undefined,
            slopes: rData.slopes,
            radius: rData.radius !== undefined ? rData.radius : 0,
            cornerRadii: rData.cornerRadii ? [...rData.cornerRadii] : undefined,
            wallSides: rData.wallSides ? { ...rData.wallSides } : undefined,
            wallDropHeight: rData.wallDropHeight !== undefined ? rData.wallDropHeight : undefined,
            connectedWallId: rData.connectedWallId || null,
            hasSpotlights: rData.hasSpotlights !== undefined ? Boolean(rData.hasSpotlights) : undefined,
            spotlightCount: rData.spotlightCount !== undefined ? rData.spotlightCount : undefined,
            spotlightSpacing: rData.spotlightSpacing !== undefined ? rData.spotlightSpacing : undefined,
            edgeCurves: rData.edgeCurves ? JSON.parse(JSON.stringify(rData.edgeCurves)) : undefined,
            materials: rData.materials ? JSON.parse(JSON.stringify(rData.materials)) : undefined,
            skylights: rData.skylights || [],
            crestings: rData.crestings || [],
            finials: rData.finials || [],
            chimneys: rData.chimneys || []
        };

        const shouldAdd = options.addToPlanner !== undefined ? options.addToPlanner : true;

        const roof = RoofTopologyEngine.createRoof(planner, rData.points, config, {
            id: rData.id,
            elevation: rData.elevation !== undefined ? rData.elevation : 120,
            rotation: rData.rotation || 0,
            x: rData.x || 0,
            y: rData.y || 0,
            levelId: rData.levelId !== undefined ? rData.levelId : undefined,
            description: rData.description,
            addToPlanner: shouldAdd,
            select: options.select || false
        });

        if (roof) {
            if (rData.levelId !== undefined) roof.levelId = rData.levelId;
            if (rData.configId) roof.configId = rData.configId;
            if (rData.tileSize !== undefined) roof.tileSize = rData.tileSize;
            if (rData._restingOnWalls !== undefined) roof._restingOnWalls = Boolean(rData._restingOnWalls);
            if (rData._lastSyncedWallTop !== null && rData._lastSyncedWallTop !== undefined) roof._lastSyncedWallTop = rData._lastSyncedWallTop;
            if (rData.hostWallIds && Array.isArray(rData.hostWallIds)) roof.hostWallIds = [...rData.hostWallIds];
            if (rData.radius !== undefined) roof.radius = rData.radius;
            if (rData.cornerRadii && Array.isArray(rData.cornerRadii)) {
                roof.cornerRadii = [...rData.cornerRadii];
                roof.config.cornerRadii = [...rData.cornerRadii];
            }
            if (rData.wallSides) roof.wallSides = { ...rData.wallSides };
            if (rData.wallDropHeight !== undefined) roof.wallDropHeight = rData.wallDropHeight;
            if (rData.connectedWallId) roof.connectedWallId = rData.connectedWallId;
            if (rData.hasSpotlights !== undefined) roof.hasSpotlights = Boolean(rData.hasSpotlights);
            if (rData.spotlightCount !== undefined) roof.spotlightCount = rData.spotlightCount;
            if (rData.spotlightSpacing !== undefined) roof.spotlightSpacing = rData.spotlightSpacing;
            if (rData.edgeCurves) roof.edgeCurves = JSON.parse(JSON.stringify(rData.edgeCurves));
            if (rData.materials) roof.materials = JSON.parse(JSON.stringify(rData.materials));
        }

        return roof;
    }
}

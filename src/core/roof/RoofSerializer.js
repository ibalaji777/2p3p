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
            gableMaterial: conf.gableMaterial || 'white_plaster_wall',
            autoShapeWalls: !!conf.autoShapeWalls,
            slopes: conf.slopes ? JSON.parse(JSON.stringify(conf.slopes)) : undefined,
            skylights: conf.skylights ? JSON.parse(JSON.stringify(conf.skylights)) : [],
            crestings: conf.crestings ? JSON.parse(JSON.stringify(conf.crestings)) : [],
            finials: conf.finials ? JSON.parse(JSON.stringify(conf.finials)) : [],
            chimneys: conf.chimneys ? JSON.parse(JSON.stringify(conf.chimneys)) : [],
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
            gableMaterial: rData.gableMaterial || 'white_plaster_wall',
            autoShapeWalls: !!rData.autoShapeWalls,
            slopes: rData.slopes,
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
            description: rData.description,
            addToPlanner: shouldAdd,
            select: options.select || false
        });

        if (roof && rData.configId) {
            roof.configId = rData.configId;
        }

        return roof;
    }
}

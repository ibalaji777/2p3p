/**
 * src/core/outdoor/OutdoorZoneEngine.js
 * 
 * Canonical Domain Authority for Outdoor Landscaping & Exterior Zones Subsystem:
 * - createOutdoorZone
 * - serialize
 * - deserialize
 * - deleteOutdoorZone
 * - duplicateOutdoorZone
 * - setSubType / setWidth / straightenPath / reversePath
 * - computeCorridorOffsets / computeCorridorPolygon
 */
import { PremiumOutdoorZone, OUTDOOR_ZONE_TYPES } from '../engine2d/PremiumOutdoorZone.js';
import { computeCorridorOffsets, computeCorridorPolygon } from '../engine2d/corridorUtils.js';
import { DEFAULT_UNIVERSAL_TILE_SIZE } from '../registries/material.registry.js';

export class OutdoorZoneEngine {
    /**
     * Create and initialize a new outdoor zone.
     * @param {Object} planner - The floor planner instance
     * @param {Object} params - Zone configuration parameters
     * @param {Object} options - Lifecycle options (addToPlanner, select, sync, addToSession)
     * @returns {PremiumOutdoorZone}
     */
    static createOutdoorZone(planner, params = {}, options = {}) {
        const subType = params.subType || 'pavement';
        const zoneDefaults = OUTDOOR_ZONE_TYPES[subType] || OUTDOOR_ZONE_TYPES.pavement;

        const isCorridor = subType === 'driveway' || subType === 'walkway' || Boolean(params.width || params.centerline);
        const corridorWidth = Number(params.width) || (subType === 'walkway' ? 60 : (subType === 'driveway' ? 160 : undefined));

        let finalPoints = params.points ? [...params.points] : [];
        let finalCenterline = params.centerline ? [...params.centerline] : null;
        let cx = params.x;
        let cy = params.y;

        // If centerline is provided but polygon points are missing, compute polygon
        if (isCorridor && finalCenterline && finalCenterline.length >= 2 && (!finalPoints || finalPoints.length < 3)) {
            finalPoints = computeCorridorPolygon(finalCenterline, corridorWidth) || [];
        }

        // Normalize points to relative coordinates if raw points are supplied without explicit cx, cy
        if (finalPoints && finalPoints.length > 0 && (cx === undefined || cy === undefined)) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            finalPoints.forEach(p => {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            });
            cx = (minX + maxX) / 2;
            cy = (minY + maxY) / 2;

            finalPoints = finalPoints.map(p => ({ x: p.x - cx, y: p.y - cy }));
            if (finalCenterline) {
                finalCenterline = finalCenterline.map(p => ({ x: p.x - cx, y: p.y - cy }));
            }
        }

        const zoneParams = {
            id: params.id || null,
            name: params.name || zoneDefaults.label,
            subType: subType,
            x: cx !== undefined ? cx : (planner?.stage ? planner.stage.width() / 2 : 0),
            y: cy !== undefined ? cy : (planner?.stage ? planner.stage.height() / 2 : 0),
            rotation: params.rotation || 0,
            points: finalPoints,
            width: isCorridor ? corridorWidth : undefined,
            centerline: finalCenterline,
            configId: params.configId || params.material || zoneDefaults.defaultMaterial,
            materialScale: params.materialScale !== undefined ? params.materialScale : DEFAULT_UNIVERSAL_TILE_SIZE,
            elevation: params.elevation !== undefined ? Number(params.elevation) : 0,
            height3D: params.height3D !== undefined ? Number(params.height3D) : zoneDefaults.defaultHeight3D,
            fill: params.fill || zoneDefaults.fill,
            stroke: params.stroke || zoneDefaults.stroke,
            params: params.params ? JSON.parse(JSON.stringify(params.params)) : {}
        };

        const newZone = new PremiumOutdoorZone(planner, 'outdoor_zone', zoneParams);

        const addToPlanner = options.addToPlanner !== false;
        if (addToPlanner && planner) {
            if (!planner.outdoorZones) planner.outdoorZones = [];
            if (!planner.outdoorZones.includes(newZone)) {
                planner.outdoorZones.push(newZone);
            }
        }

        if (options.addToSession && planner?.currentSessionEntities) {
            planner.currentSessionEntities.push(newZone);
        }

        if (options.select && planner && typeof planner.selectEntity === 'function') {
            planner.selectEntity(newZone, 'outdoor_zone');
        }

        if (options.sync !== false && planner && typeof planner.syncAll === 'function') {
            planner.syncAll();
        }

        return newZone;
    }

    /**
     * Authoritative JSON serialization for an outdoor zone.
     * @param {Object} zone
     * @returns {Object} Serialized state
     */
    static serialize(zone) {
        if (!zone) return null;

        const getCoord = (field) => {
            if (zone.group && typeof zone.group[field] === 'function') {
                return zone.group[field]();
            }
            return zone[field] ?? 0;
        };

        return {
            id: zone.id,
            type: 'outdoor_zone',
            subType: zone.subType || 'pavement',
            name: zone.name,
            x: getCoord('x'),
            y: getCoord('y'),
            rotation: zone.group && typeof zone.group.rotation === 'function' ? zone.group.rotation() : (zone.rotation ?? 0),
            points: Array.isArray(zone.points) ? JSON.parse(JSON.stringify(zone.points)) : [],
            width: zone.width !== undefined ? zone.width : undefined,
            centerline: Array.isArray(zone.centerline) ? JSON.parse(JSON.stringify(zone.centerline)) : null,
            configId: zone.configId,
            materialScale: zone.materialScale !== undefined ? zone.materialScale : DEFAULT_UNIVERSAL_TILE_SIZE,
            elevation: zone.elevation ?? 0,
            height3D: zone.height3D ?? 0.3,
            fill: zone.fill,
            stroke: zone.stroke,
            params: zone.params ? JSON.parse(JSON.stringify(zone.params)) : {}
        };
    }

    /**
     * Recreate an outdoor zone from serialized data.
     * @param {Object} planner - The floor planner instance
     * @param {Object} data - Serialized state
     * @param {Object} options - Lifecycle options
     * @returns {PremiumOutdoorZone}
     */
    static deserialize(planner, data, options = {}) {
        if (!data) return null;

        return OutdoorZoneEngine.createOutdoorZone(planner, {
            ...data,
            id: data.id // Strict preservation of entity ID
        }, options);
    }

    /**
     * Authoritatively delete an outdoor zone from the planner and scene.
     * @param {Object} planner - The floor planner instance
     * @param {Object|string} zoneOrId - Zone instance or ID
     * @param {Object} options - Options (sync)
     * @returns {boolean} Whether entity was found and removed
     */
    static deleteOutdoorZone(planner, zoneOrId, options = {}) {
        if (!planner) return false;

        const zone = typeof zoneOrId === 'string'
            ? (planner.outdoorZones ? planner.outdoorZones.find(z => z && z.id === zoneOrId) : null)
            : zoneOrId;

        if (!zone) return false;

        if (planner.outdoorZones) {
            planner.outdoorZones = planner.outdoorZones.filter(z => z !== zone && z.id !== zone.id);
        }

        if (typeof zone.destroy === 'function') {
            zone.destroy();
        }

        if (options.sync !== false && typeof planner.syncAll === 'function') {
            planner.syncAll();
        }

        return true;
    }

    /**
     * Duplicate an outdoor zone with a spatial offset.
     * @param {Object} planner - The floor planner instance
     * @param {Object} sourceZone - Zone to duplicate
     * @param {Object} offset - Coordinate offset {x, y}
     * @returns {PremiumOutdoorZone}
     */
    static duplicateOutdoorZone(planner, sourceZone, offset = { x: 30, y: 30 }) {
        if (!sourceZone) return null;

        const serialized = OutdoorZoneEngine.serialize(sourceZone);
        const cloned = JSON.parse(JSON.stringify(serialized));

        cloned.x = (cloned.x || 0) + (offset.x || 0);
        cloned.y = (cloned.y || 0) + (offset.y || 0);
        cloned.id = 'zone_' + Math.random().toString(36).substr(2, 9);

        return OutdoorZoneEngine.deserialize(planner, cloned, { addToPlanner: true });
    }

    /**
     * Update 2D/3D geometry of an outdoor zone.
     * @param {Object} zone
     */
    static updateGeometry(zone) {
        if (!zone) return;
        if (typeof zone.update2D === 'function') {
            zone.update2D();
        } else if (typeof zone.updateGeometry === 'function') {
            zone.updateGeometry();
        }
    }

    /**
     * Update corridor width.
     * @param {Object} zone
     * @param {number} width
     */
    static setWidth(zone, width) {
        if (!zone) return;
        if (typeof zone.setWidth === 'function') {
            zone.setWidth(width);
        } else {
            zone.width = Number(width);
            OutdoorZoneEngine.updateGeometry(zone);
        }
    }

    /**
     * Update zone subtype and defaults.
     * @param {Object} zone
     * @param {string} subType
     */
    static setSubType(zone, subType) {
        if (!zone) return;
        if (typeof zone.setSubType === 'function') {
            zone.setSubType(subType);
        } else {
            zone.subType = subType;
            OutdoorZoneEngine.updateGeometry(zone);
        }
    }

    /**
     * Straighten corridor path into direct line.
     * @param {Object} zone
     */
    static straightenPath(zone) {
        if (!zone) return;
        if (typeof zone.straightenPath === 'function') {
            zone.straightenPath();
        }
    }

    /**
     * Reverse corridor path orientation.
     * @param {Object} zone
     */
    static reversePath(zone) {
        if (!zone) return;
        if (typeof zone.reversePath === 'function') {
            zone.reversePath();
        }
    }

    // Re-export mathematical ribbon helpers for external convenience
    static computeCorridorOffsets(points, width) {
        return computeCorridorOffsets(points, width);
    }

    static computeCorridorPolygon(points, width) {
        return computeCorridorPolygon(points, width);
    }
}

export { computeCorridorOffsets, computeCorridorPolygon, OUTDOOR_ZONE_TYPES };

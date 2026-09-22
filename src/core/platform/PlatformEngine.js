/**
 * src/core/platform/PlatformEngine.js
 * 
 * Canonical Domain Authority for Platforms & Foundation Subsystem:
 * - createPlatform
 * - serialize
 * - deserialize
 * - deletePlatform
 * - duplicatePlatform
 * - setHeight / setElevation / setDimensions / setTrimStyle / setMaterial
 * - raisePlatform / lowerPlatform
 * - update2D
 * - PLATFORM_TRIM_STYLES
 */
import { PremiumPlatform, PLATFORM_TRIM_STYLES } from '../engine2d/PremiumPlatform.js';
import { VerticalPropagationEngine } from '../vertical/VerticalPropagationEngine.js';

export class PlatformEngine {
    /**
     * Create and initialize a new platform or building foundation.
     * @param {Object} planner - The floor planner instance
     * @param {Object} params - Configuration parameters
     * @param {Object} options - Lifecycle options (addToPlanner, select, sync, build3D)
     * @returns {PremiumPlatform}
     */
    static createPlatform(planner, params = {}, options = {}) {
        let rawPoints = params.points ? [...params.points] : [];
        const shapeType = params.shapeType || (rawPoints.length >= 3 ? 'polygon' : 'rect');

        let cx = params.x;
        let cy = params.y;

        // Auto-center polygonal points if raw points are supplied without explicit cx, cy
        if (shapeType === 'polygon' && rawPoints.length > 0 && (cx === undefined || cy === undefined)) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            rawPoints.forEach(p => {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            });
            cx = (minX + maxX) / 2;
            cy = (minY + maxY) / 2;

            rawPoints = rawPoints.map(p => ({ x: p.x - cx, y: p.y - cy }));
        }

        const platformParams = {
            id: params.id || null,
            name: params.name || 'Platform',
            shapeType: shapeType,
            width: params.width !== undefined ? Number(params.width) : 120,
            depth: params.depth !== undefined ? Number(params.depth) : 120,
            height: params.height !== undefined ? Number(params.height) : 20,
            stepHeight: params.stepHeight !== undefined ? Number(params.stepHeight) : 15,
            elevation: params.elevation !== undefined ? Number(params.elevation) : 0,
            trimStyle: params.trimStyle || 'flat',
            materials: params.materials ? JSON.parse(JSON.stringify(params.materials)) : {
                top: { id: params.material || params.configId || 'wood_golden_teak' },
                side: { id: params.sideMaterial || 'wood_white_oak' }
            },
            rotation: params.rotation !== undefined ? Number(params.rotation) : 0,
            x: cx !== undefined ? Number(cx) : (planner?.stage ? planner.stage.width() / 2 : 0),
            y: cy !== undefined ? Number(cy) : (planner?.stage ? planner.stage.height() / 2 : 0),
            points: rawPoints,
            fill: params.fill,
            stroke: params.stroke,
            isBuildingFoundation: Boolean(params.isBuildingFoundation),
            isRoomInteriorPlatform: Boolean(params.isRoomInteriorPlatform),
            associatedRoomId: params.associatedRoomId || null,
            params: params.params ? JSON.parse(JSON.stringify(params.params)) : {}
        };

        const platform = new PremiumPlatform(planner, 'platform', platformParams);

        if (platformParams.isBuildingFoundation) {
            platform.isBuildingFoundation = true;
            platform.associatedRoomId = platformParams.associatedRoomId;
            if (platform.group) {
                platform.group.visible(false);
                platform.group.listening(false);
                platform.group.draggable(false);
            }
            if (platform.badgeGroup) platform.badgeGroup.visible(false);
        }

        if (platformParams.isRoomInteriorPlatform) {
            platform.isRoomInteriorPlatform = true;
            platform.associatedRoomId = platformParams.associatedRoomId;
        }

        const addToPlanner = options.addToPlanner !== false;
        if (addToPlanner && planner) {
            if (!planner.platforms) planner.platforms = [];
            if (!planner.platforms.includes(platform)) {
                planner.platforms.push(platform);
            }
        }

        if (options.select && planner && typeof planner.selectEntity === 'function') {
            planner.selectEntity(platform, 'platform');
        }

        if (options.build3D && planner?.renderer3D?.envBuilder?.platformBuilder) {
            planner.renderer3D.envBuilder.platformBuilder.buildPlatform(platform);
        }

        if (options.sync !== false && planner && typeof planner.syncAll === 'function') {
            planner.syncAll();
        }

        return platform;
    }

    /**
     * Authoritative JSON serialization for a platform entity.
     * @param {Object} platform
     * @returns {Object} Serialized state
     */
    static serialize(platform) {
        if (!platform) return null;

        const getCoord = (field) => {
            if (platform.group && typeof platform.group[field] === 'function') {
                return platform.group[field]();
            }
            return platform[field] ?? 0;
        };

        return {
            id: platform.id,
            type: 'platform',
            name: platform.name,
            shapeType: platform.shapeType || 'rect',
            width: platform.width,
            depth: platform.depth,
            height: platform.height,
            stepHeight: platform.stepHeight,
            elevation: platform.elevation ?? 0,
            trimStyle: platform.trimStyle || 'flat',
            materials: platform.materials ? JSON.parse(JSON.stringify(platform.materials)) : {},
            rotation: platform.group && typeof platform.group.rotation === 'function' ? platform.group.rotation() : (platform.rotation ?? 0),
            x: getCoord('x'),
            y: getCoord('y'),
            points: Array.isArray(platform.points) ? JSON.parse(JSON.stringify(platform.points)) : [],
            fill: platform.fill,
            stroke: platform.stroke,
            isBuildingFoundation: Boolean(platform.isBuildingFoundation),
            isRoomInteriorPlatform: Boolean(platform.isRoomInteriorPlatform),
            associatedRoomId: platform.associatedRoomId || null,
            params: platform.params ? JSON.parse(JSON.stringify(platform.params)) : {}
        };
    }

    /**
     * Recreate a platform from serialized data.
     * @param {Object} planner - The floor planner instance
     * @param {Object} data - Serialized state
     * @param {Object} options - Lifecycle options
     * @returns {PremiumPlatform}
     */
    static deserialize(planner, data, options = {}) {
        if (!data) return null;

        return PlatformEngine.createPlatform(planner, {
            ...data,
            id: data.id // Strict preservation of entity ID
        }, options);
    }

    /**
     * Authoritatively delete a platform from the planner and scene.
     * @param {Object} planner - The floor planner instance
     * @param {Object|string} platformOrId - Platform instance or ID
     * @param {Object} options - Options (sync)
     * @returns {boolean} Whether entity was found and removed
     */
    static deletePlatform(planner, platformOrId, options = {}) {
        if (!planner) return false;

        const platform = typeof platformOrId === 'string'
            ? (planner.platforms ? planner.platforms.find(p => p && p.id === platformOrId) : null)
            : platformOrId;

        if (!platform) return false;

        if (planner.platforms) {
            planner.platforms = planner.platforms.filter(p => p !== platform && p.id !== platform.id);
        }

        if (typeof platform.destroy === 'function') {
            platform.destroy();
        }

        if (options.sync !== false && typeof planner.syncAll === 'function') {
            planner.syncAll();
        }

        return true;
    }

    /**
     * Duplicate a platform with a spatial offset.
     * @param {Object} planner - The floor planner instance
     * @param {Object} sourcePlatform - Platform to duplicate
     * @param {Object} offset - Coordinate offset {x, y}
     * @returns {PremiumPlatform}
     */
    static duplicatePlatform(planner, sourcePlatform, offset = { x: 30, y: 30 }) {
        if (!sourcePlatform) return null;

        const serialized = PlatformEngine.serialize(sourcePlatform);
        const cloned = JSON.parse(JSON.stringify(serialized));

        cloned.x = (cloned.x || 0) + (offset.x || 0);
        cloned.y = (cloned.y || 0) + (offset.y || 0);
        cloned.id = 'platform_' + Math.random().toString(36).substr(2, 9);

        return PlatformEngine.deserialize(planner, cloned, { addToPlanner: true });
    }

    /**
     * Update 2D/3D geometry of a platform.
     * @param {Object} platform
     */
    static update2D(platform) {
        if (!platform) return;
        if (typeof platform.update2D === 'function') {
            platform.update2D();
        } else if (typeof platform.update === 'function') {
            platform.update();
        }
    }

    /**
     * Parametrically adjust platform height.
     * @param {Object} platform
     * @param {number} height
     */
    static setHeight(platform, height) {
        if (!platform) return;
        if (typeof platform.setHeight === 'function') {
            return platform.setHeight(height);
        }
        platform.height = Number(height);
        PlatformEngine.update2D(platform);
        return platform.height;
    }

    /**
     * Parametrically adjust platform elevation.
     * @param {Object} platform
     * @param {number} elevation
     */
    static setElevation(platform, elevation) {
        if (!platform) return;
        if (typeof platform.setElevation === 'function') {
            return platform.setElevation(elevation);
        }
        platform.elevation = Number(elevation);
        PlatformEngine.update2D(platform);
    }

    /**
     * Parametrically adjust dimensions.
     * @param {Object} platform
     * @param {number|Object} widthOrDims - Width number or object { width, depth }
     * @param {number} [depth]
     */
    static setDimensions(platform, widthOrDims, depth) {
        if (!platform) return;
        let w = widthOrDims;
        let d = depth;
        if (typeof widthOrDims === 'object' && widthOrDims !== null) {
            w = widthOrDims.width;
            d = widthOrDims.depth !== undefined ? widthOrDims.depth : widthOrDims.height;
        }
        if (typeof platform.setDimensions === 'function') {
            platform.setDimensions(w, d);
        } else {
            if (w !== undefined) platform.width = Math.max(10, Number(w));
            if (d !== undefined) platform.depth = Math.max(10, Number(d));
            PlatformEngine.update2D(platform);
        }
    }

    /**
     * Set architectural trim style.
     * @param {Object} platform
     * @param {string} style
     */
    static setTrimStyle(platform, style) {
        if (!platform) return;
        if (typeof platform.setTrimStyle === 'function') {
            platform.setTrimStyle(style);
        } else {
            platform.trimStyle = style;
        }
    }

    /**
     * Set material slot ('top' or 'side').
     * @param {Object} platform
     * @param {string} slot
     * @param {string} matId
     */
    static setMaterial(platform, slot, matId) {
        if (!platform) return;
        if (typeof platform.setMaterial === 'function') {
            platform.setMaterial(slot, matId);
        } else {
            if (!platform.materials) platform.materials = {};
            platform.materials[slot] = { id: matId };
        }
    }

    /**
     * Raise platform by step increment.
     * @param {Object} platform
     * @param {number} [step]
     */
    static raisePlatform(platform, step) {
        if (!platform) return;
        if (typeof platform.raisePlatform === 'function') {
            return platform.raisePlatform(step);
        }
        return PlatformEngine.setHeight(platform, (platform.height || 0) + (step || 15));
    }

    /**
     * Lower platform by step increment.
     * @param {Object} platform
     * @param {number} [step]
     */
    static lowerPlatform(platform, step) {
        if (!platform) return;
        if (typeof platform.lowerPlatform === 'function') {
            return platform.lowerPlatform(step);
        }
        return PlatformEngine.setHeight(platform, (platform.height || 0) - (step || 15));
    }
}

export { PLATFORM_TRIM_STYLES };

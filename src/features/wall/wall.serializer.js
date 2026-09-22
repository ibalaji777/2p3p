import { WallFactory } from './wall.factory.js';
import { WallEngine } from '../../core/wall/WallEngine.js';

/**
 * wall.serializer.js
 * Canonical serialization and deserialization for walls and their attached components.
 */

function safeClone(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    try {
        const seen = new WeakSet();
        return JSON.parse(JSON.stringify(obj, (key, value) => {
            if (key === 'mesh3D' || key === 'object' || key === 'entity' || key === 'wall' || key === 'parent' || key === 'planner' || key === 'startAnchor' || key === 'endAnchor' || key === 'poly' || key === 'wallGroup' || key === 'labelGroup' || key === 'frontHighlight' || key === 'backHighlight' || key === 'profileIndicators' || key === 'entranceGroup' || key === 'raiserGroup' || key === 'raiserHit' || key === 'raiserBg' || key === 'raiserText') {
                return undefined;
            }
            if (typeof value === 'object' && value !== null) {
                if (value.isObject3D || value.isMesh || value.isGroup || value.isNode || value.isShape) return undefined;
                if (seen.has(value)) return undefined;
                seen.add(value);
            }
            return value;
        }));
    } catch (e) {
        return Array.isArray(obj) ? [] : {};
    }
}

export const WallSerializer = {
    serialize(w) {
        return {
            id: w.id,
            startAnchorId: w.startAnchor?._id || w.startAnchor?.id,
            endAnchorId: w.endAnchor?._id || w.endAnchor?.id,
            startX: (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position().x : (w.startAnchor?.x || 0),
            startY: (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position().y : (w.startAnchor?.y || 0),
            endX: (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position().x : (w.endAnchor?.x || 0),
            endY: (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position().y : (w.endAnchor?.y || 0),
            thickness: w.thickness || w.config?.thickness || 20,
            height: w.height !== undefined ? w.height : (w.config?.height || 180),
            type: w.type,
            configId: w.configId,
            hidden: w.hidden,
            description: w.description,
            topProfileType: w.topProfileType,
            flipSlope: w.flipSlope,
            startHeight: w.startHeight,
            peakHeight: w.peakHeight,
            endHeight: w.endHeight,
            isAutoGable: w.isAutoGable,
            parentWallId: w.parentWallId,
            parentRoofId: w.parentRoofId,
            hostLevelId: w.hostLevelId || null,
            relativeElevation: w.relativeElevation || 0,
            elevation: w.elevation,
            pts: typeof w.getExactPolygonPoints === 'function' ? w.getExactPolygonPoints() : (w.poly ? (typeof w.poly.points === 'function' ? w.poly.points() : null) : null),
            bevels: w.wallShapeData ? { start: w.wallShapeData.startData, end: w.wallShapeData.endData } : null,
            startProfile: w.wallShapeData?.startProfile || null,
            endProfile: w.wallShapeData?.endProfile || null,
            wallShapeData: w.wallShapeData ? {
                hasStartCap: w.wallShapeData.hasStartCap,
                hasEndCap: w.wallShapeData.hasEndCap,
                startProfile: w.wallShapeData.startProfile,
                endProfile: w.wallShapeData.endProfile
            } : null,
            elevationLayers: w.elevationLayers ? safeClone(w.elevationLayers) : null,
            widgets: w.attachedWidgets ? w.attachedWidgets.map(wid => WallEngine.serializeWidget(wid)) : [],
            decors: w.attachedDecor ? safeClone(w.attachedDecor) : [],
            moldings: w.attachedMoldings ? w.attachedMoldings.map(m => WallEngine.serializeMolding(m)) : [],
            params: w.params ? safeClone(w.params) : {}
        };
    },

    deserialize(wData, planner, anchorMap) {
        let a1, a2;
        if (wData.startAnchorId !== undefined && wData.endAnchorId !== undefined && anchorMap && anchorMap.has(wData.startAnchorId) && anchorMap.has(wData.endAnchorId)) {
            a1 = anchorMap.get(wData.startAnchorId);
            a2 = anchorMap.get(wData.endAnchorId);
        } else if (wData.startX !== undefined && wData.startY !== undefined && wData.endX !== undefined && wData.endY !== undefined && planner) {
            a1 = planner.getOrCreateAnchor(wData.startX, wData.startY);
            a2 = planner.getOrCreateAnchor(wData.endX, wData.endY);
        }

        const activeLvl = planner?.activeLevel || planner?.activeLevelConfig;
        let height = wData.height;
        if (activeLvl?.type === 'plinth' || activeLvl?.type === 'foundation') {
            height = Number(activeLvl.height) || (activeLvl.type === 'plinth' ? 18 : 40);
        } else if (!height && activeLvl?.height !== undefined) {
            height = Number(activeLvl.height);
        }

        let thickness = wData.thickness;
        if (!thickness && activeLvl?.defaultWallThickness !== undefined) {
            thickness = Number(activeLvl.defaultWallThickness);
        }

        const wall = WallFactory.createWall(planner, {
            startAnchor: a1,
            endAnchor: a2,
            type: wData.type || 'outer',
            id: wData.id,
            height: height,
            thickness: thickness,
            elevation: wData.elevation || 0,
            topProfileType: wData.topProfileType,
            startHeight: wData.startHeight,
            endHeight: wData.endHeight,
            peakHeight: wData.peakHeight,
            flipSlope: wData.flipSlope,
            params: wData.params ? safeClone(wData.params) : {},
            addToPlanner: false
        });

        if (wData.configId) wall.configId = wData.configId;
        if (wData.hidden !== undefined) wall.hidden = wData.hidden;
        if (wData.description !== undefined) wall.description = wData.description;
        if (wData.elevationLayers) wall.elevationLayers = wData.elevationLayers;
        if (wData.isAutoGable !== undefined) {
            wall.isAutoGable = wData.isAutoGable;
            if (wall.isAutoGable) {
                if (wall.wallGroup) wall.wallGroup.visible(false);
                if (wall.labelGroup) wall.labelGroup.visible(false);
            }
        }
        if (wData.parentWallId !== undefined) wall.parentWallId = wData.parentWallId;
        if (wData.parentRoofId !== undefined) wall.parentRoofId = wData.parentRoofId;
        if (wData.hostLevelId !== undefined) wall.hostLevelId = wData.hostLevelId;
        if (wData.relativeElevation !== undefined) wall.relativeElevation = wData.relativeElevation;

        // Restore Widgets
        if (wData.widgets && Array.isArray(wData.widgets)) {
            wall.attachedWidgets = wData.widgets.map(widData => {
                return WallEngine.deserializeWidget(planner, wall, widData);
            }).filter(Boolean);
        }

        // Restore Moldings
        if (wData.moldings && Array.isArray(wData.moldings)) {
            wall.attachedMoldings = wData.moldings.map(moldData => {
                return WallEngine.deserializeMolding(planner, wall, moldData);
            }).filter(Boolean);
        }

        // Restore Decors
        if (wData.decors && Array.isArray(wData.decors)) {
            wall.attachedDecor = safeClone(wData.decors);
        }

        return wall;
    }
};

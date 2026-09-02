import { WallFactory } from './wall.factory.js';
import { PremiumWidget } from '../../core/engine2d/PremiumWidget.js';
import { PremiumMolding } from '../../core/engine2d/PremiumMolding.js';

/**
 * wall.serializer.js
 * Canonical serialization and deserialization for walls and their attached components.
 */

function safeClone(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    try {
        const seen = new WeakSet();
        return JSON.parse(JSON.stringify(obj, (key, value) => {
            if (key === 'mesh3D' || key === 'object' || key === 'entity' || key === 'wall' || key === 'parent' || key === 'planner' || key === 'startAnchor' || key === 'endAnchor' || key === 'poly' || key === 'wallGroup' || key === 'labelGroup' || key === 'frontHighlight' || key === 'backHighlight' || key === 'profileIndicators' || key === 'entranceGroup') {
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
            widgets: w.attachedWidgets ? w.attachedWidgets.map(wid => {
                if (typeof wid.serialize === 'function') return wid.serialize();
                return { 
                    t: wid.t, type: wid.type, configId: wid.type, width: wid.width, height: wid.height, depth: wid.depth, elevation: wid.elevation,
                    thick: wid.thick, facing: wid.facing, side: wid.side, 
                    profileType: wid.profileType, fasciaMat: wid.fasciaMat, topArm: wid.topArm, bottomArm: wid.bottomArm,
                    sunshadeType: wid.sunshadeType, pattern: wid.pattern, jaliMount: wid.jaliMount,
                    rows: wid.rows, cols: wid.cols, spacing: wid.spacing, patternStyle: wid.patternStyle, decorConfigId: wid.decorConfigId,
                    doorType: wid.doorType, 
                    doorShape: wid.doorShape || wid.params?.doorShape,
                    doorStyle: wid.doorStyle || wid.params?.doorStyle,
                    doorMat: wid.doorMat,
                    windowType: wid.windowType,
                    windowShape: wid.windowShape || wid.params?.windowShape,
                    frameMat: wid.frameMat,
                    glassMat: wid.glassMat,
                    grillePattern: wid.grillePattern,
                    grilleProfile: wid.grilleProfile,
                    description: wid.description,
                    materials: wid.materials ? safeClone(wid.materials) : {},
                    params: wid.params ? safeClone(wid.params) : {}
                };
            }) : [],
            decors: w.attachedDecor ? safeClone(w.attachedDecor) : [],
            moldings: w.attachedMoldings ? w.attachedMoldings.map(m => (typeof m.serialize === 'function' ? m.serialize() : { 
                t: m.t, type: m.type, configId: m.type, width: m.width, depth: m.depth, heightOffset: m.heightOffset, 
                moldingHeight: m.moldingHeight || m.height || 10,
                side: m.side, profileType: m.profileType, material: m.material, color: m.color, layers: m.layers, 
                layerGap: m.layerGap, grooveWidth: m.grooveWidth, frameWidth: m.frameWidth 
            })) : [],
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
        if (wData.isAutoGable !== undefined) wall.isAutoGable = wData.isAutoGable;
        if (wData.parentWallId !== undefined) wall.parentWallId = wData.parentWallId;
        if (wData.parentRoofId !== undefined) wall.parentRoofId = wData.parentRoofId;

        // Restore Widgets
        if (wData.widgets && Array.isArray(wData.widgets)) {
            wall.attachedWidgets = wData.widgets.map(widData => {
                const wid = new PremiumWidget(planner, wall, widData.t, widData.type || widData.configId);
                Object.assign(wid, widData);
                wid.wall = wall;
                return wid;
            });
        }

        // Restore Moldings
        if (wData.moldings && Array.isArray(wData.moldings)) {
            wall.attachedMoldings = wData.moldings.map(moldData => {
                const mold = new PremiumMolding(planner, wall, moldData.t || 0.5, moldData.type || moldData.configId || 'molding_skirting_flat');
                Object.assign(mold, moldData);
                mold.wall = wall;
                return mold;
            });
        }

        // Restore Decors
        if (wData.decors && Array.isArray(wData.decors)) {
            wall.attachedDecor = safeClone(wData.decors);
        }

        return wall;
    }
};

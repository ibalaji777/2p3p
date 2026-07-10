/**
 * wall.serializer.js
 * Handles the JSON serialization and deserialization for walls and their attached components.
 */

export const WallSerializer = {
    serialize(w) {
        return {
            id: w.id,
            startAnchorId: w.startAnchor._id,
            endAnchorId: w.endAnchor._id,
            startX: w.startAnchor.x,
            startY: w.startAnchor.y,
            endX: w.endAnchor.x,
            endY: w.endAnchor.y,
            thickness: w.thickness || w.config.thickness,
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
            pts: typeof w.getExactPolygonPoints === 'function' ? w.getExactPolygonPoints() : (w.poly ? w.poly.points() : null),
            bevels: w.wallShapeData ? { start: w.wallShapeData.startData, end: w.wallShapeData.endData } : null,
            elevationLayers: w.elevationLayers,
            widgets: w.attachedWidgets ? w.attachedWidgets.map(wid => ({ 
                t: wid.t, type: wid.type, configId: wid.type, width: wid.width, height: wid.height, depth: wid.depth, elevation: wid.elevation,
                facing: wid.facing, side: wid.side, 
                rows: wid.rows, cols: wid.cols, spacing: wid.spacing, patternStyle: wid.patternStyle, decorConfigId: wid.decorConfigId,
                doorType: wid.doorType, doorMat: wid.doorMat, 
                windowType: wid.windowType, frameMat: wid.frameMat, glassMat: wid.glassMat, grillePattern: wid.grillePattern,
                description: wid.description,
                params: wid.params || {}
            })) : [],
            decors: w.attachedDecor ? w.attachedDecor.map(d => ({ 
                id: d.id, configId: d.configId, side: d.side, localX: d.localX, localY: d.localY, localZ: d.localZ, 
                width: d.width, height: d.height, depth: d.depth, tileSize: d.tileSize, 
                faces: { front: d.faces.front, back: d.faces.back, left: d.faces.left, right: d.faces.right } 
            })) : [],
            moldings: w.attachedMoldings ? w.attachedMoldings.map(m => ({ 
                t: m.t, type: m.type, configId: m.type, width: m.width, depth: m.depth, heightOffset: m.heightOffset, 
                side: m.side, profileType: m.profileType, material: m.material, color: m.color, layers: m.layers, 
                layerGap: m.layerGap, grooveWidth: m.grooveWidth, frameWidth: m.frameWidth 
            })) : [],
            params: w.params || {}
        };
    },

    deserialize(wData, planner, getAnchorById) {
        // This expects the planner to have a way to fetch anchors, or we pass them in
        // In Phase 3, we just provide the structured data format parsing.
        // Full deserialization logic will be injected here during refactoring.
    }
};

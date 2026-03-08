import { Anchor, PremiumWall, PremiumWidget, PremiumStair } from './engine2d.js';

export class FileManager {
    static exportJSON(planner) {
        try {
            planner.anchors.forEach((a, i) => a._id = i);
            const data = {
                unit: planner.currentUnit, anchors: planner.anchors.map(a => ({ id: a._id, x: a.x, y: a.y })),
                walls: planner.walls.map(w => ({ startAnchor: w.startAnchor._id, endAnchor: w.endAnchor._id, type: w.type, elevationLayers: w.elevationLayers, widgets: w.attachedWidgets.map(widg => ({ type: widg.type, t: widg.t, width: widg.width, facing: widg.facing, side: widg.side, doorType: widg.doorType, doorMat: widg.doorMat, windowType: widg.windowType, frameMat: widg.frameMat, glassMat: widg.glassMat, grillePattern: widg.grillePattern })) })),
                stairs: planner.stairs.map(s => ({ path: s.path, config: s.config }))
            };
            const blob = new Blob([JSON.stringify(data)], { type: "application/json" }); const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = "premium_floorplan.json"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch(e) { alert("Failed to save the project."); }
    }

    static importJSON(planner, jsonData) {
        try {
            planner.finishChain();
            while (planner.walls.length > 0) { planner.walls[0].remove(); }
            while (planner.stairs.length > 0) { planner.stairs[0].remove(); }
            planner.anchors.forEach(a => { if (a.node) a.node.destroy(); });
            planner.anchors = []; planner.roomLayer.destroyChildren();
            if (jsonData.unit) { planner.currentUnit = jsonData.unit; }

            const anchorMap = new Map();
            if (jsonData.anchors && Array.isArray(jsonData.anchors)) { jsonData.anchors.forEach(aData => { const newAnchor = new Anchor(planner, aData.x, aData.y); planner.anchors.push(newAnchor); anchorMap.set(aData.id, newAnchor); }); }
            if (jsonData.walls && Array.isArray(jsonData.walls)) {
                jsonData.walls.forEach(wData => {
                    const sAnchor = anchorMap.get(wData.startAnchor), eAnchor = anchorMap.get(wData.endAnchor);
                    if (sAnchor && eAnchor) {
                        const newWall = new PremiumWall(planner, sAnchor, eAnchor, wData.type);
                        if (wData.elevationLayers) { newWall.elevationLayers = wData.elevationLayers; }
                        planner.walls.push(newWall);
                        if (wData.widgets && Array.isArray(wData.widgets)) {
                            wData.widgets.forEach(widgData => {
                                const newWidget = new PremiumWidget(planner, newWall, widgData.t, widgData.type);
                                newWidget.width = widgData.width; newWidget.facing = widgData.facing !== undefined ? widgData.facing : 1; newWidget.side = widgData.side !== undefined ? widgData.side : 1;
                                if (widgData.type === 'door') { newWidget.doorType = widgData.doorType || 'single'; newWidget.doorMat = widgData.doorMat || 'wood'; } 
                                else { newWidget.windowType = widgData.windowType || 'sliding_std'; newWidget.frameMat = widgData.frameMat || 'alum_powder'; newWidget.glassMat = widgData.glassMat || 'clear'; newWidget.grillePattern = widgData.grillePattern || 'grid'; }
                                newWall.attachedWidgets.push(newWidget); newWidget.update(); 
                            });
                        }
                    }
                });
            }
            if (jsonData.stairs && Array.isArray(jsonData.stairs)) { jsonData.stairs.forEach(sData => { const newStair = new PremiumStair(planner, 0, 0); newStair.path = sData.path; newStair.config = sData.config; newStair.initHandles(); newStair.update(); planner.stairs.push(newStair); }); }
            planner.syncAll();
        } catch(e) { alert("Failed to render the floor plan. The file might be corrupted."); }
    }
}
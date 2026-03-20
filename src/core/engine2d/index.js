// src/core/engine2d/index.js
import Konva from 'konva';
import { GRID, PX_TO_FT, SNAP_DIST } from '../registry.js';

// SOLID: Import the decoupled 2D entity classes from the same folder
import { Anchor } from './Anchor.js';
import { PremiumWall } from './PremiumWall.js';
import { PremiumWidget } from './PremiumWidget.js';
import { PremiumFurniture } from './PremiumFurniture.js';
import { PremiumStair } from './PremiumStair.js';
import { PremiumRoof } from './PremiumRoof.js';

// Export the specific classes that App.vue needs to spawn items
export { PremiumFurniture, PremiumRoof };

export class FloorPlanner {
    constructor(containerEl) { 
        this.container = containerEl; this.tool = "outer"; this.currentUnit = "ft"; this.drawing = false; this.lastAnchor = null; this.startAnchor = null; this.drawingStair = null; this.preview = null;
        this.walls = []; this.anchors = []; this.roomPaths = []; this.stairs = []; this.furniture = []; this.roofs = []; this.selectedEntity = null; this.selectedType = null; this.selectedNodeIndex = -1;
        this.onSelectionChange = null; 
        this.initKonva(); this.drawGrid(); this.initHUD(); this.initStageEvents(); 
    }
    
    initKonva() { 
        this.stage = new Konva.Stage({ container: this.container, width: window.innerWidth - 380, height: window.innerHeight }); 
        
        this.bgLayer = new Konva.Layer();
        this.gridLayer = new Konva.Group(); 
        this.referenceLayer = new Konva.Group(); 
        this.roomLayer = new Konva.Group(); 
        this.bgLayer.add(this.gridLayer, this.referenceLayer, this.roomLayer);

        this.mainLayer = new Konva.Layer();
        this.wallLayer = new Konva.Group(); 
        this.widgetLayer = new Konva.Group(); 
        this.furnitureLayer = new Konva.Group(); 
        this.roofLayer = new Konva.Group(); 
        this.mainLayer.add(this.wallLayer, this.widgetLayer, this.furnitureLayer, this.roofLayer);

        this.uiLayer = new Konva.Layer(); 
        this.stage.add(this.bgLayer, this.mainLayer, this.uiLayer); 
    }

    addAutoRoof() {
        if (!this.roofs) this.roofs = [];
        
        // COMPLEX SHAPE DETECTION: Generate intersecting roofs based on closed rooms
        if (this.roomPaths && this.roomPaths.length > 0) {
            this.roomPaths.forEach(path => {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                path.forEach(p => {
                    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                });
                
                let w = maxX - minX; let d = maxY - minY;
                let cx = minX + w / 2; let cy = minY + d / 2;
                
                let rotation = 0;
                if (d > w) { const temp = w; w = d; d = temp; rotation = 90; } // Auto-rotate to fit

                const newRoof = new PremiumRoof(this, cx, cy, w, d);
                newRoof.rotation = rotation; newRoof.update();
                this.roofs.push(newRoof);
                this.selectEntity(newRoof, 'roof');
            });
        } 
        // SINGLE SHAPE FALLBACK: Wrap all walls in one bounding box
        else if (this.walls && this.walls.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            this.walls.forEach(wall => {
                const p1 = wall.startAnchor.position(); const p2 = wall.endAnchor.position();
                minX = Math.min(minX, p1.x, p2.x); maxX = Math.max(maxX, p1.x, p2.x);
                minY = Math.min(minY, p1.y, p2.y); maxY = Math.max(maxY, p1.y, p2.y);
            });
            let w = maxX - minX; let d = maxY - minY;
            let cx = minX + w / 2; let cy = minY + d / 2;

            let rotation = 0;
            if (d > w) { const temp = w; w = d; d = temp; rotation = 90; }

            const newRoof = new PremiumRoof(this, cx, cy, w, d);
            newRoof.rotation = rotation; newRoof.update();
            this.roofs.push(newRoof);
            this.selectEntity(newRoof, 'roof');
        } else {
            // EMPTY CANVAS FALLBACK
            const newRoof = new PremiumRoof(this, this.stage.width()/2, this.stage.height()/2, 400, 300);
            this.roofs.push(newRoof);
            this.selectEntity(newRoof, 'roof');
        }

        this.syncAll();
    }
    
    initHUD() {
        this.snapGlow = new Konva.Circle({ radius: 8, fill: '#10b981', shadowColor: '#10b981', shadowBlur: 15, opacity: 0.8, visible: false, listening: false }); 
        this.uiLayer.add(this.snapGlow);
        
        this.guideLineInfinite = new Konva.Line({ points: [0,0,0,0], stroke: '#38bdf8', strokeWidth: 1, dash: [4, 4], visible: false, listening: false }); 
        this.uiLayer.add(this.guideLineInfinite);
        
        this.infoBadgeGroup = new Konva.Group({ visible: false, listening: false }); 
        this.infoBadgeBg = new Konva.Rect({ fill: '#111827', cornerRadius: 6, opacity: 0.9, shadowColor: 'black', shadowBlur: 4, shadowOffsetY: 2, shadowOpacity: 0.2 }); 
        this.infoBadgeText = new Konva.Text({ text: '', fill: 'white', padding: 8, fontSize: 11, align: 'center', fontStyle: 'bold', lineHeight: 1.4 }); 
        this.infoBadgeGroup.add(this.infoBadgeBg, this.infoBadgeText); 
        this.uiLayer.add(this.infoBadgeGroup);
    }
    
    showSnapGlow(x, y) { this.snapGlow.position({x, y}); this.snapGlow.show(); } 
    hideSnapGlow() { this.snapGlow.hide(); }
    
    drawGuideLine(x1, y1, x2, y2, show) { 
        if (!show) { this.guideLineInfinite.hide(); return; } 
        const dx = x2 - x1, dy = y2 - y1; const scale = 2000; 
        this.guideLineInfinite.points([x1 - dx*scale, y1 - dy*scale, x1 + dx*scale, y1 + dy*scale]); 
        this.guideLineInfinite.show(); 
        this.guideLineInfinite.moveToBottom(); 
    }
    
    updateInfoBadge(x, y, length, angle, snapped) { 
        let txt = `${length}\n${angle}°`; 
        if (snapped) txt += `\n🎯 Snapped`; 
        this.infoBadgeText.text(txt); 
        this.infoBadgeBg.setAttrs({ width: this.infoBadgeText.width(), height: this.infoBadgeText.height() });
        this.infoBadgeGroup.position({ x: x + 15, y: y + 15 }); 
        this.infoBadgeGroup.show(); 
        this.infoBadgeGroup.moveToTop(); 
    } 
    hideInfoBadge() { this.infoBadgeGroup.hide(); }

    snap(v) { return Math.round(v / GRID) * GRID; }
    formatLength(px) { const feet = px * PX_TO_FT; if (this.currentUnit === 'in') return Math.round(feet * 12) + '"'; if (this.currentUnit === 'cm') return Math.round(feet * 30.48) + ' cm'; if (this.currentUnit === 'm') return (feet * 0.3048).toFixed(2) + ' m'; const wholeFeet = Math.floor(feet), inches = Math.round((feet - wholeFeet) * 12); return inches > 0 ? `${wholeFeet}' ${inches}"` : `${wholeFeet}'`; }
    drawGrid() { for (let i = 0; i < this.stage.width() / GRID; i++) this.gridLayer.add(new Konva.Line({ points: [i * GRID, 0, i * GRID, this.stage.height()], stroke: "#f0f0f0", strokeWidth: 1, listening: false })); for (let j = 0; j < this.stage.height() / GRID; j++) this.gridLayer.add(new Konva.Line({ points: [0, j * GRID, this.stage.width(), j * GRID], stroke: "#f0f0f0", strokeWidth: 1, listening: false })); this.bgLayer.batchDraw(); }
    
    doIntersect(p1, p2, p3, p4) { const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x); return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4); }
    checkWallIntersection(p1, p2, ignoreWalls = []) { for (let w of this.walls) { if (ignoreWalls.includes(w)) continue; if (this.getDistanceToWall(p1, w) < 1.0) continue; if (this.getDistanceToWall(p2, w) < 1.0) continue; if (this.doIntersect(p1, p2, w.startAnchor.position(), w.endAnchor.position())) return true; } return false; }
    getDistanceToWall(pos, wall) { const p1 = wall.startAnchor.position(), p2 = wall.endAnchor.position(), C = p2.x - p1.x, D = p2.y - p1.y, dot = (pos.x - p1.x) * C + (pos.y - p1.y) * D, lenSq = C * C + D * D; let param = -1; if (lenSq !== 0) param = Math.max(0, Math.min(1, dot / lenSq)); const xx = p1.x + param * C, yy = p1.y + param * D; return Math.hypot(pos.x - xx, pos.y - yy); }
    getClosestPointOnSegment(p, p1, p2) { const C = p2.x - p1.x, D = p2.y - p1.y, lenSq = C*C + D*D; if (lenSq === 0) return p1; let t = Math.max(0, Math.min(1, ((p.x - p1.x)*C + (p.y - p1.y)*D) / lenSq)); return { x: p1.x + t*C, y: p1.y + t*D }; }

    selectEntity(entity, type, nodeIndex = -1) { 
        if (this.selectedEntity && this.selectedType === 'wall') this.selectedEntity.setHighlight(false);
        if (this.selectedEntity && this.selectedType === 'stair') this.selectedEntity.setHighlight(false);
        if (this.selectedEntity && this.selectedType === 'stair_node') this.selectedEntity.setHighlight(false);
        if (this.selectedEntity && this.selectedType === 'furniture') this.selectedEntity.setHighlight(false);
        if (this.selectedEntity && this.selectedType === 'roof') this.selectedEntity.setHighlight(false);
        
        this.selectedEntity = entity; this.selectedType = type; this.selectedNodeIndex = nodeIndex;
        
        if (entity && (type === 'wall' || type === 'stair' || type === 'stair_node' || type === 'furniture' || type === 'roof')) entity.setHighlight(true);
        if (this.onSelectionChange) this.onSelectionChange(entity, type, nodeIndex);
    }

    updateToolStates() { 
        const isSelect = this.tool === "select"; 
        this.walls.forEach(w => { w.poly.setAttr('draggable', isSelect); w.attachedWidgets.forEach(widg => widg.visualGroup.setAttr('draggable', isSelect)); }); 
        this.stairs.forEach(s => { s.group.setAttr('draggable', isSelect); }); 
        this.anchors.forEach(a => { a.node.setAttr('draggable', isSelect); }); 
        this.furniture.forEach(f => { f.group.setAttr('draggable', isSelect); });
        this.roofs.forEach(r => { r.group.setAttr('draggable', isSelect); });
    }

    getOrCreateAnchor(x, y) { let a = this.anchors.find(a => Math.hypot(a.x - x, a.y - y) < SNAP_DIST); if (a) return a; const newAnchor = new Anchor(this, x, y); this.anchors.push(newAnchor); return newAnchor; }
    deselectAll() { this.walls.forEach(w => w.setHighlight(false)); this.stairs.forEach(s => s.setHighlight(false)); this.furniture.forEach(f => f.setHighlight(false)); this.roofs.forEach(r => r.setHighlight(false)); this.anchors.forEach(a => a.hide()); this.selectEntity(null); this.syncAll(); }
    syncAll() { this.walls.forEach(w => w.update()); this.stairs.forEach(s => s.update()); this.furniture.forEach(f => f.update()); this.roofs.forEach(r => r.update()); this.mainLayer.batchDraw(); this.detectRooms(); }
    
    finishChain() { 
        if (this.drawingStair) { this.drawingStair.finishDrawing(); this.drawingStair = null; } 
        this.drawing = false; this.lastAnchor = null; this.startAnchor = null; 
        this.preview?.destroy(); this.preview = null; 
        this.hideSnapGlow(); this.drawGuideLine(0,0,0,0, false); this.hideInfoBadge(); 
        this.deselectAll(); 
    }
    
    initStageEvents() { 
        this.stage.on("mousedown", (e) => { 
            if (e.target === this.stage || e.target === this.bgLayer || e.target === this.mainLayer) this.deselectAll(); 
            // ... (rest of your standard drawing events remain exactly the same)
        }); 
        this.stage.on("mousemove", () => { 
             // ... (rest of your standard mousemove events remain exactly the same)
        }); 
    }

    detectRooms() { this.roomLayer.destroyChildren(); this.roomPaths = []; const visited = new Set(); for (let wall of this.walls) { let path = []; let current = wall.startAnchor; let next = wall.endAnchor; path.push(current); let attempts = 0; while (next && attempts < this.walls.length) { path.push(next); if (next === wall.startAnchor && path.length > 2) { this.drawRoom(path); this.roomPaths.push(path); break; } let nextWall = this.walls.find(w => w !== wall && !visited.has(w) && (w.startAnchor === next || w.endAnchor === next)); if (!nextWall) break; visited.add(nextWall); next = (nextWall.startAnchor === next) ? nextWall.endAnchor : nextWall.startAnchor; attempts++; } } }
    drawRoom(anchorPath) { const points = anchorPath.flatMap(a => [a.x, a.y]); const poly = new Konva.Line({ points: points, fill: '#f0f4f8', closed: true, opacity: 0.7 }); let cx = 0, cy = 0; anchorPath.forEach(a => { cx += a.x; cy += a.y; }); cx /= anchorPath.length; cy /= anchorPath.length; const label = new Konva.Text({ x: cx, y: cy, text: "Room\n" + Math.round(this.calculateArea(points)) + " sqft", fontSize: 12, fill: '#6b7280', align: 'center', fontStyle: 'bold' }); label.offsetX(label.width() / 2); label.offsetY(label.height() / 2); this.roomLayer.add(poly); this.roomLayer.add(label); }
    calculateArea(points) { let area = 0; for (let i = 0; i < points.length; i += 2) { let j = (i + 2) % points.length; area += points[i] * points[j + 1]; area -= points[i + 1] * points[j]; } return Math.abs(area / 2) * (PX_TO_FT * PX_TO_FT); }

    clearAll() {
        [...this.walls].forEach(w => w.remove()); [...this.furniture].forEach(f => f.remove()); [...this.stairs].forEach(s => s.remove()); [...this.roofs].forEach(r => r.remove()); 
        this.walls = []; this.furniture = []; this.stairs = []; this.roofs = []; this.roomPaths = [];
        this.anchors.forEach(a => { if(a.node) a.node.destroy(); }); this.anchors = [];
        if (this.wallLayer) this.wallLayer.destroyChildren(); if (this.furnitureLayer) this.furnitureLayer.destroyChildren(); if (this.widgetLayer) this.widgetLayer.destroyChildren(); if (this.roofLayer) this.roofLayer.destroyChildren();
        if (this.mainLayer) this.mainLayer.batchDraw();
        this.selectEntity(null);
    }

    exportState() {
        const state = {
            walls: this.walls.map(w => ({
                startX: w.startAnchor.x, startY: w.startAnchor.y, endX: w.endAnchor.x, endY: w.endAnchor.y, thickness: w.config.thickness, type: w.type,
                widgets: w.attachedWidgets.map(wid => ({ t: wid.t, configId: wid.type, width: wid.width })),
                decors: w.attachedDecor ? w.attachedDecor.map(d => ({ id: d.id, configId: d.configId, side: d.side, localX: d.localX, localY: d.localY, localZ: d.localZ, width: d.width, height: d.height, depth: d.depth, tileSize: d.tileSize, faces: { front: d.faces.front, back: d.faces.back, left: d.faces.left, right: d.faces.right } })) : []
            })),
            furniture: this.furniture.map(f => ({ x: f.group.x(), y: f.group.y(), rotation: f.rotation, width: f.width, depth: f.depth, height: f.height, configId: f.config.id })),
            stairs: this.stairs.map(s => ({ path: s.path.map(p => ({ x: p.x, y: p.y, shape: p.shape })) })),
            roofs: this.roofs.map(r => ({ x: r.group.x(), y: r.group.y(), rotation: r.rotation, width: r.config.width, depth: r.config.depth, pitch: r.config.pitch, overhang: r.config.overhang, thickness: r.config.thickness, ridgeOffset: r.config.ridgeOffset })),
            roomPaths: this.roomPaths.map(path => path.map(p => ({ x: p.x, y: p.y })))
        };
        return JSON.stringify(state);
    }

    importState(jsonStr) {
        this.clearAll();
        if (!jsonStr) return;
        try {
            const state = JSON.parse(jsonStr);
            if (state.walls) {
                state.walls.forEach(wData => {
                    const a1 = this.getOrCreateAnchor(wData.startX, wData.startY); const a2 = this.getOrCreateAnchor(wData.endX, wData.endY);
                    const wall = new PremiumWall(this, a1, a2, wData.type);
                    if (wData.widgets) { wData.widgets.forEach(wd => { const widget = new PremiumWidget(this, wall, wd.t, wd.configId); widget.width = wd.width; wall.attachedWidgets.push(widget); }); }
                    if (wData.decors) { wall.attachedDecor = JSON.parse(JSON.stringify(wData.decors)); }
                    this.walls.push(wall);
                });
            }
            if (state.furniture) {
                state.furniture.forEach(fData => {
                    const furn = new PremiumFurniture(this, fData.x, fData.y, fData.configId);
                    furn.rotation = fData.rotation; furn.width = fData.width; furn.depth = fData.depth; furn.height = fData.height;
                    this.furniture.push(furn);
                });
            }
            if (state.stairs) {
                state.stairs.forEach(sData => {
                    if (sData.path && sData.path.length > 0) {
                        const stair = new PremiumStair(this, sData.path[0].x, sData.path[0].y); stair.path = sData.path; stair.initHandles(); this.stairs.push(stair);
                    }
                });
            }
            if (state.roofs) {
                state.roofs.forEach(rData => {
                    const roof = new PremiumRoof(this, rData.x, rData.y, rData.width, rData.depth);
                    if(rData.rotation) roof.rotation = rData.rotation;
                    roof.config.pitch = rData.pitch; roof.config.overhang = rData.overhang; roof.config.thickness = rData.thickness; roof.config.ridgeOffset = rData.ridgeOffset;
                    roof.update(); this.roofs.push(roof);
                });
            }
            this.syncAll();
        } catch (e) { console.error("Failed to import internal state", e); }
    }

    clearReferenceBackground() { if (this.referenceGroup) { this.referenceGroup.destroy(); this.referenceGroup = null; if (this.bgLayer) this.bgLayer.batchDraw(); } }
    loadReferenceBackground(jsonStr) {
        this.clearReferenceBackground();
        if (!jsonStr) return;
        this.referenceGroup = new Konva.Group({ opacity: 0.35, listening: false });
        this.referenceLayer.add(this.referenceGroup);
        try {
            const state = JSON.parse(jsonStr);
            if (state && state.walls) {
                state.walls.forEach(wData => {
                    const line = new Konva.Line({ points: [wData.startX, wData.startY, wData.endX, wData.endY], stroke: '#94a3b8', strokeWidth: wData.thickness || 20, lineCap: 'round', lineJoin: 'round', dash: [] });
                    this.referenceGroup.add(line);
                });
            }
            this.bgLayer.batchDraw();
        } catch (err) { console.error("Failed to load reference background", err); }
    }
}
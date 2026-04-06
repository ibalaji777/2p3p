// src/core/engine2d/index.js
import Konva from 'konva';
import { GRID, PX_TO_FT, SNAP_DIST, WALL_REGISTRY, WIDGET_REGISTRY } from '../registry.js';

// SOLID: Import the decoupled 2D entity classes from the same folder
import { Anchor } from '/src/core/engine2d/Anchor.js';
import { PremiumWall } from '/src/core/engine2d/PremiumWall.js';
import { PremiumWidget } from '/src/core/engine2d/PremiumWidget.js';
import { PremiumFurniture } from '/src/core/engine2d/PremiumFurniture.js';
import { PremiumStair } from '/src/core/engine2d/PremiumStair.js';
import { PremiumHipRoof } from '/src/core/engine2d/PremiumHipRoof.js';

// Export the specific classes that App.vue needs to spawn items
export { PremiumFurniture, PremiumHipRoof };

export class PremiumBalcony {}

export class FloorPlanner {
    constructor(containerEl) { 
        this.container = containerEl; this.tool = "outer"; this.currentUnit = "ft"; this.drawing = false; this.lastAnchor = null; this.startAnchor = null; this.drawingStair = null; this.preview = null;
        this.activeCategory = 'tools';
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
                
                const points = [{x: minX, y: minY}, {x: maxX, y: minY}, {x: maxX, y: maxY}, {x: minX, y: maxY}];

                const newRoof = new PremiumHipRoof(this, points);
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

            const points = [{x: minX, y: minY}, {x: maxX, y: minY}, {x: maxX, y: maxY}, {x: minX, y: maxY}];

            const newRoof = new PremiumHipRoof(this, points);
            this.roofs.push(newRoof);
            this.selectEntity(newRoof, 'roof');
        } else {
            // EMPTY CANVAS FALLBACK
            const cx = this.stage.width()/2; const cy = this.stage.height()/2;
            const points = [{x: cx - 200, y: cy - 150}, {x: cx + 200, y: cy - 150}, {x: cx + 200, y: cy + 150}, {x: cx - 200, y: cy + 150}];
            const newRoof = new PremiumHipRoof(this, points);
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

        this.wallHighlight = new Konva.Line({ stroke: '#3b82f6', strokeWidth: 6, opacity: 0.7, visible: false, listening: false });
        this.uiLayer.add(this.wallHighlight);
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
    
    drawGrid() { 
        const size = 5000; // Giant 10,000px canvas workspace
        for (let i = -size; i <= size; i += GRID) {
            this.gridLayer.add(new Konva.Line({ points: [i, -size, i, size], stroke: "#f0f0f0", strokeWidth: 1, listening: false })); 
            this.gridLayer.add(new Konva.Line({ points: [-size, i, size, i], stroke: "#f0f0f0", strokeWidth: 1, listening: false })); 
        }
        this.bgLayer.batchDraw(); 
    }
    
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
        if (this.selectedEntity && this.selectedType === 'balcony') this.selectedEntity.setHighlight(false);
        
        this.selectedEntity = entity; this.selectedType = type; this.selectedNodeIndex = nodeIndex;
        
        if (entity && (type === 'wall' || type === 'stair' || type === 'stair_node' || type === 'furniture' || type === 'roof' || type === 'balcony')) entity.setHighlight(true);
        
        this.syncAll();

        if (this.onSelectionChange) this.onSelectionChange(entity, type, nodeIndex);
    }

    updateToolStates() {
        const cat = this.activeCategory || 'tools';
        const isSelect = this.tool === "select";
        const isSplitWall = this.tool === "split_wall";
        const allowWallEdit = isSelect || cat === 'walls';
        const isWidget = !!WIDGET_REGISTRY[this.tool];
        this.walls.forEach(w => {
            if(w.poly) { w.poly.setAttr('draggable', allowWallEdit); w.poly.setAttr('listening', allowWallEdit || isWidget || isSplitWall); }
            w.attachedWidgets.forEach(widg => { if(widg.visualGroup) { widg.visualGroup.setAttr('draggable', isSelect); widg.visualGroup.setAttr('listening', isSelect); } });
        });
        this.stairs.forEach(s => { if(s.group) { s.group.setAttr('draggable', isSelect); s.group.setAttr('listening', isSelect); } });
        this.anchors.forEach(a => { if(a.node) { a.node.setAttr('draggable', allowWallEdit); a.node.setAttr('listening', allowWallEdit); } });
        this.furniture.forEach(f => { if(f.group) { f.group.setAttr('draggable', isSelect); f.group.setAttr('listening', isSelect); } });
        this.roofs.forEach(r => { if(r.group) { r.group.setAttr('draggable', isSelect); r.group.setAttr('listening', isSelect); } });
        if(this.balconies) this.balconies.forEach(b => { if(b.group) { b.group.setAttr('draggable', isSelect); b.group.setAttr('listening', isSelect); } });

        const allowAll = (cat === 'tools' || cat === 'advanced');

        // FORCE LAYER LISTENING OFF DURING DRAWING OR RESTRICT BY CATEGORY
        if (this.wallLayer) this.wallLayer.listening(allowAll || cat === 'walls' || cat === 'doors_windows' || cat === 'structures' || isWidget || isSplitWall);
        if (this.widgetLayer) this.widgetLayer.listening(allowAll || cat === 'doors_windows' || cat === 'structures');
        if (this.furnitureLayer) this.furnitureLayer.listening(allowAll || cat === 'furniture');
        if (this.roofLayer) this.roofLayer.listening(allowAll || cat === 'structures');
    }
    loadDefaultHouse() {
        if (this.walls && this.walls.length > 0) return;
        
        const cx = this.stage.width() / 2;
        const cy = this.stage.height() / 2;
        
        // 750 sqft shape (25ft x 30ft). With GRID=20 (PX_TO_FT = 1/20), 25ft=500px, 30ft=600px.
        const hw = 300; const hd = 250;
        
        const a1 = this.getOrCreateAnchor(cx - hw, cy - hd); const a2 = this.getOrCreateAnchor(cx + hw, cy - hd);
        const a3 = this.getOrCreateAnchor(cx + hw, cy + hd); const a4 = this.getOrCreateAnchor(cx - hw, cy + hd);

        this.walls.push(new PremiumWall(this, a1, a2, 'outer'), new PremiumWall(this, a2, a3, 'outer'), new PremiumWall(this, a3, a4, 'outer'), new PremiumWall(this, a4, a1, 'outer'));
        this.syncAll();
    }

    getOrCreateAnchor(x, y) { let a = this.anchors.find(a => Math.hypot(a.x - x, a.y - y) < SNAP_DIST); if (a) return a; const newAnchor = new Anchor(this, x, y); this.anchors.push(newAnchor); return newAnchor; }
    deselectAll() { this.walls.forEach(w => w.setHighlight(false)); this.stairs.forEach(s => s.setHighlight(false)); this.furniture.forEach(f => f.setHighlight(false)); this.roofs.forEach(r => r.setHighlight(false)); if(this.balconies) this.balconies.forEach(b => b.setHighlight(false)); this.selectEntity(null); this.syncAll(); }
    syncAll() { 
        this.buildingCenter = null; 
        this.walls.forEach(w => w.update()); 
        this.stairs.forEach(s => s.update()); 
        this.furniture.forEach(f => f.update()); 
        this.roofs.forEach(r => r.update()); 
        if(this.balconies) this.balconies.forEach(b => b.update()); 
        
        this.anchors.forEach(a => {
            let connectedCount = this.walls.filter(w => w.startAnchor === a || w.endAnchor === a).length;
            if (connectedCount >= 2) {
                a.show();
            } else if (this.selectedEntity && this.selectedType === 'wall' && (this.selectedEntity.startAnchor === a || this.selectedEntity.endAnchor === a)) {
                a.show();
            } else if (this.drawing && (this.startAnchor === a || this.lastAnchor === a)) {
                a.show();
            } else {
                a.hide();
            }
        });

        this.mainLayer.batchDraw(); 
        this.uiLayer.batchDraw();
        this.detectRooms(); 
    }
    
    getOutwardNormal(wall) {
        if (!this.buildingCenter) {
            let totalX = 0, totalY = 0, count = 0;
            this.walls.forEach(w => { totalX += w.startAnchor.x; totalY += w.startAnchor.y; count++; });
            if (count > 0) { this.buildingCenter = { x: totalX / count, y: totalY / count }; } 
            else { this.buildingCenter = { x: this.stage.width() / 2, y: this.stage.height() / 2 }; }
        }
        const p1 = wall.startAnchor.position(), p2 = wall.endAnchor.position();
        const wallCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const normal = { x: -dy, y: dx };
        const len = Math.hypot(normal.x, normal.y);
        if (len > 0) { normal.x /= len; normal.y /= len; }
        const vecToCenter = { x: this.buildingCenter.x - wallCenter.x, y: this.buildingCenter.y - wallCenter.y };
        if (normal.x * vecToCenter.x + normal.y * vecToCenter.y > 0) { normal.x *= -1; normal.y *= -1; }
        return normal;
    }

    getPointerPos() {
        const pointer = this.stage.getPointerPosition();
        if (!pointer) return null;
        if (typeof this.stage.getRelativePointerPosition === 'function') {
            return this.stage.getRelativePointerPosition();
        }
        return this.stage.getAbsoluteTransform().copy().invert().point(pointer);
    }

    finishChain() { 
        if (this.drawingStair) { this.drawingStair.finishDrawing(); this.drawingStair = null; } 
        if (this.drawingRoofPoints) { this.drawingRoofPoints = null; if (this.roofPreview) { this.roofPreview.destroy(); this.roofPreview = null; } }
        this.drawing = false; this.lastAnchor = null; this.startAnchor = null; 
        this.preview?.destroy(); this.preview = null; 
        this.hideSnapGlow(); this.drawGuideLine(0,0,0,0, false); this.hideInfoBadge(); 
        this.deselectAll(); 
    }
    
    initStageEvents() { 
        this.stage.on("mousedown touchstart", (e) => { 
            if (this.tool === 'roof') return;
            if (e.target === this.stage || e.target === this.bgLayer || e.target === this.mainLayer) this.deselectAll(); 
            const wallConfig = WALL_REGISTRY[this.tool]; 
            
            const pos = this.getPointerPos();
            if (!pos) return;
            
            let targetPos = { x: this.snap(pos.x), y: this.snap(pos.y) }; 

            if (this.tool === 'stair') { if (!this.drawingStair) { this.drawingStair = new PremiumStair(this, targetPos.x, targetPos.y); this.stairs.push(this.drawingStair); } else { this.drawingStair.addPoint(targetPos.x, targetPos.y); } this.syncAll(); return; }
            if (!wallConfig) return; 

            let targetSnapWall = null; 
            if (wallConfig && wallConfig.events.includes("snap_to_wall")) { 
                let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < SNAP_DIST); 
                if (a) { targetPos = { x: a.x, y: a.y }; targetSnapWall = this.walls.find(w => w.startAnchor === a || w.endAnchor === a); } 
                else { let closestDist = SNAP_DIST, closestPoint = null; for (let w of this.walls) { let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position()); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); if (dist < closestDist) { closestDist = dist; closestPoint = proj; targetSnapWall = w; } } if (closestPoint) targetPos = closestPoint; } 
            } 
            
            if (this.drawing && wallConfig && wallConfig.events.includes("stop_collision") && this.checkWallIntersection(this.lastAnchor.position(), targetPos, [targetSnapWall])) return; 
            
            const currentAnchor = this.getOrCreateAnchor(targetPos.x, targetPos.y); 
            if (!this.drawing) { this.drawing = true; this.lastAnchor = currentAnchor; this.startAnchor = currentAnchor; currentAnchor.show(); } 
            else { if (this.lastAnchor !== currentAnchor) { this.walls.push(new PremiumWall(this, this.lastAnchor, currentAnchor, this.tool)); } if (currentAnchor === this.startAnchor) this.finishChain(); else { this.lastAnchor = currentAnchor; currentAnchor.show(); } } 
            this.syncAll(); 
        }); 

        this.stage.on("mousemove touchmove", () => { 
            if (this.tool === 'roof') return;
            const pos = this.getPointerPos();
            if (!pos) return;
            
            let rawPos = { x: this.snap(pos.x), y: this.snap(pos.y) }; 
            
            if (this.drawingStair) { this.drawingStair.updateLastPoint(rawPos.x, rawPos.y); return; }
            const wallConfig = WALL_REGISTRY[this.tool]; 
            
            let dxAxis = rawPos.x - (this.lastAnchor?.x || 0), dyAxis = rawPos.y - (this.lastAnchor?.y || 0), rawAngle = Math.atan2(dyAxis, dxAxis) * 180 / Math.PI, distAxis = Math.hypot(dxAxis, dyAxis), snappedToAxis = false;
            if (this.drawing) {
                for (let a of [0, 45, 90, 135, 180, -45, -90, -135, -180]) {
                    if (Math.abs(rawAngle - a) < 5) { let rad = a * Math.PI / 180; rawPos.x = this.lastAnchor.x + distAxis * Math.cos(rad); rawPos.y = this.lastAnchor.y + distAxis * Math.sin(rad); snappedToAxis = true; this.drawGuideLine(this.lastAnchor.x, this.lastAnchor.y, rawPos.x, rawPos.y, true); break; }
                }
                if (!snappedToAxis) this.drawGuideLine(0,0,0,0, false);
            }

            let snapPos = rawPos; let targetSnapWall = null; let snappedObj = false;

            if (wallConfig && wallConfig.events.includes("snap_to_wall")) { 
                let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < SNAP_DIST); 
                if (a) { snapPos = { x: a.x, y: a.y }; targetSnapWall = this.walls.find(w => w.startAnchor === a || w.endAnchor === a); snappedObj = true; } 
                else { 
                    let closestDist = SNAP_DIST, closestPoint = null; 

                    let allReferenceWalls = this.referenceGroup ? this.referenceGroup.getChildren() : [];
                    for (let line of allReferenceWalls) {
                        let pts = line.points();
                        if (pts && pts.length === 4) {
                            let d1 = Math.hypot(pos.x - pts[0], pos.y - pts[1]);
                            let d2 = Math.hypot(pos.x - pts[2], pos.y - pts[3]);
                            if (d1 < 40) { closestDist = 0; closestPoint = {x: pts[0], y: pts[1]}; snappedObj = true; }
                            else if (d2 < 40) { closestDist = 0; closestPoint = {x: pts[2], y: pts[3]}; snappedObj = true; }
                            else if (!snappedObj) {
                                let proj = this.getClosestPointOnSegment(pos, {x: pts[0], y: pts[1]}, {x: pts[2], y: pts[3]});
                                let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                                if (dist < closestDist) { closestDist = dist; closestPoint = proj; snappedObj = true; }
                            }
                        }
                    }

                    for (let w of this.walls) { 
                        let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position()); 
                        let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); 
                        if (dist < closestDist && !snappedObj) { closestDist = dist; closestPoint = proj; targetSnapWall = w; snappedObj = true; } 
                    } 
                    if (closestPoint) snapPos = closestPoint; 
                } 
            } 
            
            if (this.lastAnchor) {
                let dxBadge = snapPos.x - this.lastAnchor.x, dyBadge = snapPos.y - this.lastAnchor.y;
                let lenBadge = this.formatLength(Math.hypot(dxBadge, dyBadge));
                let angBadge = Math.abs(Math.atan2(dyBadge, dxBadge) * 180 / Math.PI).toFixed(1);
                this.updateInfoBadge(snapPos.x, snapPos.y, lenBadge, angBadge, snappedObj);
            } else {
                this.hideInfoBadge();
            }

            if (snappedObj) { this.showSnapGlow(snapPos.x, snapPos.y); } else { this.hideSnapGlow(); }

            if (!this.drawing) {
                this.uiLayer.batchDraw();
                return;
            }
            this.walls.forEach(w => w.setHighlight(w === this.selectedEntity));

            let isColliding = false; 
            if (wallConfig && (wallConfig.events.includes("collision_detected") || wallConfig.events.includes("stop_collision"))) { isColliding = this.checkWallIntersection(this.lastAnchor.position(), snapPos, [targetSnapWall]); } 
            
            this.preview?.destroy(); 
            const isClosing = (this.startAnchor && Math.hypot(this.startAnchor.x - snapPos.x, this.startAnchor.y - snapPos.y) < 15); 
            let drawColor = (isColliding && wallConfig && wallConfig.events.includes("stop_collision")) ? "#ef4444" : (isClosing ? "#10b981" : "#3b82f6"); 
            this.preview = new Konva.Line({ points: [this.lastAnchor.x, this.lastAnchor.y, snapPos.x, snapPos.y], stroke: drawColor, strokeWidth: 2, opacity: 0.8 }); 
            this.uiLayer.add(this.preview); 
            this.preview.moveToBottom();
            
            this.uiLayer.batchDraw(); 
        }); 

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.finishChain();
        });

        // --- Hip Roof Drawing Mode Logic ---
        this.stage.on("mousedown.roof touchstart.roof", (e) => {
            if (this.tool !== 'roof') return;
            const pos = this.getPointerPos();
            if (!pos) return;
            
            console.log("mousedown.roof: Clicked with roof tool at", pos);

            let snap = pos;
            let closestDist = SNAP_DIST;
            
            let allReferenceWalls = this.referenceGroup ? this.referenceGroup.getChildren() : [];
            for (let line of allReferenceWalls) {
                let pts = line.points();
                if (pts && pts.length === 4) {
                    let d1 = Math.hypot(pos.x - pts[0], pos.y - pts[1]); let d2 = Math.hypot(pos.x - pts[2], pos.y - pts[3]);
                    if (d1 < closestDist) { closestDist = d1; snap = {x: pts[0], y: pts[1]}; }
                    if (d2 < closestDist) { closestDist = d2; snap = {x: pts[2], y: pts[3]}; }
                    let proj = this.getClosestPointOnSegment(pos, {x: pts[0], y: pts[1]}, {x: pts[2], y: pts[3]}); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); if (dist < closestDist) { closestDist = dist; snap = proj; }
                }
            }

            // ADD WALL SNAPPING TO MOUSEDOWN
            for (let w of this.walls) {
                const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y); let d2 = Math.hypot(pos.x - p2.x, pos.y - p2.y);
                if (d1 < closestDist) { closestDist = d1; snap = p1; }
                if (d2 < closestDist) { closestDist = d2; snap = p2; }
                let proj = this.getClosestPointOnSegment(pos, p1, p2); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                if (dist < closestDist) { closestDist = dist; snap = proj; }
            }
            
            if (!this.drawingRoofPoints) {
                console.log("mousedown.roof: Starting new roof");
                this.drawingRoofPoints = [snap];
                this.roofPreview = new Konva.Line({ points: [snap.x, snap.y, snap.x, snap.y], stroke: '#f59e0b', strokeWidth: 4, dash: [6, 4], fill: 'rgba(245, 158, 11, 0.3)' });
                this.uiLayer.add(this.roofPreview); // Add to UI layer so it's always visible above walls
                this.uiLayer.batchDraw();
            } else {
                console.log("mousedown.roof: Adding point to roof");
                const startP = this.drawingRoofPoints[0];
                if (Math.hypot(snap.x - startP.x, snap.y - startP.y) < SNAP_DIST && this.drawingRoofPoints.length > 2) {
                    console.log("mousedown.roof: Finishing roof");
                    const roof = new PremiumHipRoof(this, this.drawingRoofPoints);
                    this.roofs.push(roof); this.selectEntity(roof, 'roof');
                    this.drawingRoofPoints = null; this.roofPreview.destroy(); this.roofPreview = null;
                    this.tool = 'select'; this.updateToolStates(); this.syncAll();
                    if (this.onToolChange) this.onToolChange(this.tool);
                } else {
                    this.drawingRoofPoints.push(snap);
                    const pts = this.drawingRoofPoints.flatMap(p => [p.x, p.y]); pts.push(snap.x, snap.y);
                    this.roofPreview.points(pts);
                    this.uiLayer.batchDraw();
                }
            }
        });

        this.stage.on("mousemove.roof touchmove.roof", () => {
            if (this.tool === 'roof') {
                const pos = this.getPointerPos();
                if (!pos) return;
                
                let snap = pos; 
                let closestDist = SNAP_DIST;
                let snappedObj = false;
                let targetSnapWall = null;

                let allReferenceWalls = this.referenceGroup ? this.referenceGroup.getChildren() : [];
                for (let line of allReferenceWalls) {
                    let pts = line.points();
                    if (pts && pts.length === 4) {
                        let d1 = Math.hypot(pos.x - pts[0], pos.y - pts[1]); let d2 = Math.hypot(pos.x - pts[2], pos.y - pts[3]);
                        if (d1 < closestDist) { closestDist = d1; snap = {x: pts[0], y: pts[1]}; snappedObj = true; } if (d2 < closestDist) { closestDist = d2; snap = {x: pts[2], y: pts[3]}; snappedObj = true; }
                        let proj = this.getClosestPointOnSegment(pos, {x: pts[0], y: pts[1]}, {x: pts[2], y: pts[3]}); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); if (dist < closestDist) { closestDist = dist; snap = proj; snappedObj = true; }
                    }
                }

                // ADD WALL SNAPPING TO MOUSEMOVE
                for (let w of this.walls) {
                    const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                    let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y); let d2 = Math.hypot(pos.x - p2.x, pos.y - p2.y);
                    if (d1 < closestDist) { closestDist = d1; snap = p1; snappedObj = true; targetSnapWall = w; }
                    if (d2 < closestDist) { closestDist = d2; snap = p2; snappedObj = true; targetSnapWall = w; }
                    let proj = this.getClosestPointOnSegment(pos, p1, p2); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    if (dist < closestDist) { closestDist = dist; snap = proj; snappedObj = true; targetSnapWall = w; }
                }
                
                this.walls.forEach(w => w.setHighlight(w === targetSnapWall || w === this.selectedEntity));
                
                if (snappedObj) { this.showSnapGlow(snap.x, snap.y); } else { this.hideSnapGlow(); }

                if (this.drawingRoofPoints && this.roofPreview) {
                    const pts = this.drawingRoofPoints.flatMap(p => [p.x, p.y]); pts.push(snap.x, snap.y);
                    this.roofPreview.points(pts);
                }
                
                document.body.style.cursor = 'crosshair'; this.mainLayer.batchDraw(); this.uiLayer.batchDraw();
            } else {
                if (this.drawingRoofPoints) { this.drawingRoofPoints = null; if (this.roofPreview) { this.roofPreview.destroy(); this.roofPreview = null; } }
                if (document.body.style.cursor === 'crosshair') { document.body.style.cursor = 'default'; }
            }
        });
    }

    detectRooms() { 
        this.roomLayer.destroyChildren(); 
        const newRooms = []; 
        const edges = [];
        
        const isPointOnSegment = (p, p1, p2) => {
            const crossProduct = (p.y - p1.y) * (p2.x - p1.x) - (p.x - p1.x) * (p2.y - p1.y);
            const dist = Math.abs(crossProduct) / Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (dist > 1.0) return false;
            const dotProduct = (p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y);
            if (dotProduct < 0) return false;
            const squaredLengthBA = (p2.x - p1.x)*(p2.x - p1.x) + (p2.y - p1.y)*(p2.y - p1.y);
            if (dotProduct > squaredLengthBA) return false;
            return true;
        };

        this.walls.forEach(w => {
            const p1 = w.startAnchor;
            const p2 = w.endAnchor;
            const pointsOnWall = [];
            this.anchors.forEach(a => {
                if (a === p1 || a === p2) return;
                if (isPointOnSegment(a.position(), p1.position(), p2.position())) {
                    pointsOnWall.push(a);
                }
            });
            pointsOnWall.sort((a, b) => {
                return Math.hypot(a.x - p1.x, a.y - p1.y) - Math.hypot(b.x - p1.x, b.y - p1.y);
            });
            const segments = [p1, ...pointsOnWall, p2];
            for (let i = 0; i < segments.length - 1; i++) {
                edges.push({ from: segments[i], to: segments[i+1], wall: w });
                edges.push({ from: segments[i+1], to: segments[i], wall: w });
            }
        });

        const adj = new Map();
        edges.forEach(e => {
            if (!adj.has(e.from)) adj.set(e.from, []);
            adj.get(e.from).push(e);
        });

        adj.forEach((outgoing, anchor) => {
            outgoing.sort((a, b) => {
                const angleA = Math.atan2(a.to.y - anchor.y, a.to.x - anchor.x);
                const angleB = Math.atan2(b.to.y - anchor.y, b.to.x - anchor.x);
                return angleA - angleB;
            });
        });

        const visitedEdges = new Set();
        const faces = [];

        edges.forEach(startEdge => {
            if (visitedEdges.has(startEdge)) return;
            
            const face = [];
            let currentEdge = startEdge;
            let isClosed = false;

            while (!visitedEdges.has(currentEdge)) {
                visitedEdges.add(currentEdge);
                face.push(currentEdge);
                
                const nextAnchor = currentEdge.to;
                const outgoing = adj.get(nextAnchor);
                if (!outgoing || outgoing.length === 0) break;
                
                let revIndex = outgoing.findIndex(e => e.to === currentEdge.from);
                let nextIndex = (revIndex - 1 + outgoing.length) % outgoing.length;
                currentEdge = outgoing[nextIndex];
                
                if (currentEdge === startEdge) {
                    isClosed = true;
                    break;
                }
            }

            if (isClosed && face.length >= 3) {
                let area = 0;
                for (let i = 0; i < face.length; i++) {
                    const p1 = face[i].from;
                    const p2 = face[i].to;
                    area += (p2.x - p1.x) * (p2.y + p1.y);
                }
                if (area < 0) {
                    faces.push(face);
                }
            }
        });

        faces.forEach(face => {
            const path = face.map(e => e.from);
            path.push(face[face.length - 1].to); 
            
            let cx = 0, cy = 0;
            const uniquePoints = path.slice(0, -1);
            uniquePoints.forEach(p => { cx += p.x; cy += p.y; });
            cx /= uniquePoints.length;
            cy /= uniquePoints.length;

            let existingRoom = (this.rooms || []).find(r => Math.hypot(r.cx - cx, r.cy - cy) < 20);
            const room = { path, cx, cy, configId: existingRoom ? existingRoom.configId : 'hardwood' };
            newRooms.push(room);
            this.drawRoom(room);
        });

        this.rooms = newRooms;
        this.roomPaths = newRooms.map(r => r.path);
        if (this.bgLayer) this.bgLayer.batchDraw();
    }
    drawRoom(room) { 
        const anchorPath = room.path;
        const points = anchorPath.flatMap(a => [a.x, a.y]); 
        const poly = new Konva.Line({ points: points, fill: '#f0f4f8', closed: true, opacity: 0.7 }); 
        
        poly.on('mouseenter', () => { if(this.tool === 'select') document.body.style.cursor = 'pointer'; });
        poly.on('mouseleave', () => document.body.style.cursor = 'default');
        poly.on('click', (e) => { 
            if(this.tool === 'select') {
                e.cancelBubble = true;
                this.selectEntity(room, 'room');
            }
        });
        
        room.setHighlight = (active) => {
            poly.stroke(active ? '#4f46e5' : null);
            poly.strokeWidth(active ? 4 : 0);
            this.stage.batchDraw();
        };

        const label = new Konva.Text({ x: room.cx, y: room.cy, text: "Room\n" + Math.round(this.calculateArea(points)) + " sqft", fontSize: 12, fill: '#6b7280', align: 'center', fontStyle: 'bold', listening: false }); 
        label.offsetX(label.width() / 2); label.offsetY(label.height() / 2); 
        this.roomLayer.add(poly); this.roomLayer.add(label); 
    }
    calculateArea(points) { let area = 0; for (let i = 0; i < points.length; i += 2) { let j = (i + 2) % points.length; area += points[i] * points[j + 1]; area -= points[i + 1] * points[j]; } return Math.abs(area / 2) * (PX_TO_FT * PX_TO_FT); }

    clearAll() {
        [...this.walls].forEach(w => w.remove()); [...this.furniture].forEach(f => f.remove()); [...this.stairs].forEach(s => s.remove()); [...this.roofs].forEach(r => r.remove()); 
        if (this.balconies) [...this.balconies].forEach(b => b.remove());
        this.walls = []; this.furniture = []; this.stairs = []; this.roofs = []; this.balconies = []; this.roomPaths = [];
        this.anchors.forEach(a => { if(a.node) a.node.destroy(); }); this.anchors = [];
        if (this.wallLayer) this.wallLayer.destroyChildren(); if (this.furnitureLayer) this.furnitureLayer.destroyChildren(); if (this.widgetLayer) this.widgetLayer.destroyChildren(); if (this.roofLayer) this.roofLayer.destroyChildren();
        if (this.mainLayer) this.mainLayer.batchDraw();
        this.selectEntity(null);
    }

    exportState() {
        const state = {
            walls: this.walls.map(w => ({
                startX: w.startAnchor.x, startY: w.startAnchor.y, endX: w.endAnchor.x, endY: w.endAnchor.y, thickness: w.thickness || w.config.thickness, height: w.height || w.config?.height || 120, type: w.type,
                widgets: w.attachedWidgets.map(wid => ({ t: wid.t, configId: wid.type, width: wid.width })),
                decors: w.attachedDecor ? w.attachedDecor.map(d => ({ id: d.id, configId: d.configId, side: d.side, localX: d.localX, localY: d.localY, localZ: d.localZ, width: d.width, height: d.height, depth: d.depth, tileSize: d.tileSize, faces: { front: d.faces.front, back: d.faces.back, left: d.faces.left, right: d.faces.right } })) : []
            })),
            furniture: this.furniture.map(f => ({ x: f.group.x(), y: f.group.y(), rotation: f.rotation, width: f.width, depth: f.depth, height: f.height, configId: f.config.id })),
            stairs: this.stairs.map(s => ({ path: s.path.map(p => ({ x: p.x, y: p.y, shape: p.shape })) })),
            roofs: this.roofs.map(r => ({ x: r.group.x(), y: r.group.y(), rotation: r.rotation, width: r.config?.width, depth: r.config?.depth, pitch: r.config?.pitch, overhang: r.config?.overhang, thickness: r.config?.thickness, ridgeOffset: r.config?.ridgeOffset, points: r.points, isHip: !!r.points, roofType: r.config?.roofType, material: r.config?.material, wallGap: r.config?.wallGap })),
            rooms: this.rooms ? this.rooms.map(r => ({ path: r.path.map(p => ({ x: p.x, y: p.y })), cx: r.cx, cy: r.cy, configId: r.configId })) : [],
            roomPaths: this.roomPaths ? this.roomPaths.map(path => path.map(p => ({ x: p.x, y: p.y }))) : []
        };
        return JSON.stringify(state);
    }

    importState(jsonStr) {
        this.clearAll();
        if (!jsonStr) return;
        try {
            const state = JSON.parse(jsonStr);
            if (state.rooms) {
                this.rooms = state.rooms;
            }
            if (state.walls) {
                state.walls.forEach(wData => {
                    const a1 = this.getOrCreateAnchor(wData.startX, wData.startY); const a2 = this.getOrCreateAnchor(wData.endX, wData.endY);
                    const wall = new PremiumWall(this, a1, a2, wData.type);
                    if (wData.thickness) wall.thickness = wData.thickness;
                    if (wData.height) wall.height = wData.height;
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
                    let roof;
                    if (rData.points) {
                        roof = new PremiumHipRoof(this, rData.points);
                        roof.group.position({ x: rData.x, y: rData.y });
                    } else {
                        return; // Ignore old legacy roofs missing points arrays
                    }
                    if(rData.rotation) roof.rotation = rData.rotation;
                    if(roof.config) { roof.config.pitch = rData.pitch; roof.config.overhang = rData.overhang; roof.config.thickness = rData.thickness; roof.config.ridgeOffset = rData.ridgeOffset; roof.config.roofType = rData.roofType || 'hip'; roof.config.material = rData.material || 'asphalt_shingles'; roof.config.wallGap = rData.wallGap || 0; }
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
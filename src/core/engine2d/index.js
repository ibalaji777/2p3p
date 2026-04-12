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
import { PremiumRailing } from '/src/core/engine2d/PremiumRailing.js';

// Export the specific classes that App.vue needs to spawn items
export { PremiumFurniture, PremiumHipRoof };

export class PremiumArc {
    constructor(planner, p1, p2, pos) {
        this.planner = planner;
        this.type = 'arc';
        this.p1 = p1; 
        this.p2 = p2;
        this.pos = { x: pos.x, y: pos.y }; 
        this.walls = [];
        this.intermediateAnchors = [];
        this.hasRailing = false;
        this.railingConfig = { configId: 'rail_1', thickness: 4, height: undefined };
        
        this.group = new Konva.Group();
        this.controlHandle = new Konva.Circle({
            radius: 8, fill: '#38bdf8', stroke: 'white', strokeWidth: 2, draggable: true, visible: false
        });
        
        this.controlHandle.on('mouseenter', () => { if(this.planner.tool === 'select') document.body.style.cursor = 'move'; });
        this.controlHandle.on('mouseleave', () => document.body.style.cursor = 'default');
        this.controlHandle.on('mousedown touchstart', (e) => { e.cancelBubble = true; this.planner.selectEntity(this, 'arc'); });
        this.controlHandle.on('dragmove', (e) => {
            e.cancelBubble = true;
            this.pos = this.controlHandle.position();
            this.rebuild();
            this.planner.syncAll();
        });
        this.controlHandle.on('dragend', (e) => {
            e.cancelBubble = true;
            this.planner.syncAll();
        });
        
        this.group.add(this.controlHandle);
        this.planner.uiLayer.add(this.group);
        
        this.rebuild();
    }
    
    setHighlight(isActive) {
        this.controlHandle.visible(isActive);
        if (isActive) {
            this.controlHandle.position(this.pos);
            this.controlHandle.moveToTop();
        }
        this.walls.forEach(w => w.poly.stroke(isActive ? '#3b82f6' : w.strokeColor));
        this.planner.stage.batchDraw();
    }

    rebuild() {
        this.walls.forEach(w => { w.wallGroup.destroy(); w.labelGroup.destroy(); this.planner.walls = this.planner.walls.filter(existing => existing !== w); });
        this.intermediateAnchors.forEach(a => { a.node.destroy(); this.planner.anchors = this.planner.anchors.filter(existing => existing !== a); });
        this.walls = []; this.intermediateAnchors = [];

        const p1 = this.p1.position(), p2 = this.p2.position();
        const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
        if (L < 0.5) return;
        
        const mid = { x: p1.x + dx/2, y: p1.y + dy/2 }, n = { x: -dy/L, y: dx/L };
        let h = (this.pos.x - mid.x)*n.x + (this.pos.y - mid.y)*n.y;
        if (Math.abs(Math.abs(h) - L/2) < SNAP_DIST) { h = Math.sign(h) * (L/2); }
        if (Math.abs(h) < 0.1) h = Math.sign(h) * 0.1 || 0.1;
        
        this.pos = { x: mid.x + n.x * h, y: mid.y + n.y * h };
        this.controlHandle.position(this.pos);
        
        const R = Math.abs(h/2 + (L*L)/(8*h)), dC = (L*L)/(8*h) - h/2;
        const center = { x: mid.x - n.x * dC, y: mid.y - n.y * dC };
        const sAng = Math.atan2(p1.y - center.y, p1.x - center.x), eAng = Math.atan2(p2.y - center.y, p2.x - center.x);
        const ccw = h < 0;
        let sweep = eAng - sAng;
        if (ccw) { while(sweep > 0) sweep -= Math.PI * 2; } else { while(sweep < 0) sweep += Math.PI * 2; }
        
        const arcLen = Math.abs(sweep) * R;
        let segments = Math.max(6, Math.min(48, Math.floor(arcLen / 15))), prevAnchor = this.p1;
        
        for (let i = 1; i <= segments; i++) {
            const t = i / segments, cAng = sAng + sweep * t;
            const x = center.x + R * Math.cos(cAng), y = center.y + R * Math.sin(cAng);
            
            let currentAnchor;
            if (i === segments) { currentAnchor = this.p2; } 
            else { currentAnchor = new Anchor(this.planner, x, y); currentAnchor.isArcIntermediate = true; currentAnchor.hide(); this.planner.anchors.push(currentAnchor); this.intermediateAnchors.push(currentAnchor); }
            
            if (prevAnchor !== currentAnchor) {
                if (Math.hypot(currentAnchor.x - prevAnchor.x, currentAnchor.y - prevAnchor.y) > 1.0) {
                    const newWall = new PremiumWall(this.planner, prevAnchor, currentAnchor, 'outer');
                    newWall.parentArc = this; newWall.labelGroup.visible(false);
                    newWall.poly.off('mousedown touchstart');
                    newWall.poly.on('mousedown touchstart', (e) => { if (this.planner.tool === 'select') { e.cancelBubble = true; this.planner.selectEntity(this, 'arc'); } });
                    newWall.poly.draggable(false); newWall.poly.on('dragstart dragmove dragend', (e) => e.cancelBubble = true);
                    this.walls.push(newWall); this.planner.walls.push(newWall);
                    
                    // Auto-generate linked railing if enabled
                    if (this.hasRailing) {
                        const r = new PremiumRailing(this.planner, prevAnchor, currentAnchor);
                        r.parentArc = this; r.labelGroup.visible(false);
                        r.configId = this.railingConfig.configId;
                        if (this.railingConfig.thickness) r.thickness = this.railingConfig.thickness;
                        if (this.railingConfig.height !== undefined) r.height = this.railingConfig.height;
                        r.poly.off('mousedown touchstart');
                        r.poly.on('mousedown touchstart', (e) => { 
                            if (this.planner.tool === 'select') { 
                                e.cancelBubble = true; 
                                this.planner.selectEntity(r, 'wall'); 
                            } 
                        });
                        r.poly.draggable(false); r.poly.on('dragstart dragmove dragend', (e) => e.cancelBubble = true);
                        this.walls.push(r); this.planner.walls.push(r);
                    }
                    
                    prevAnchor = currentAnchor;
                    
                } else if (i === segments && this.walls.length > 0) { 
                    if (this.hasRailing && this.walls.length >= 2) {
                        this.walls[this.walls.length - 1].endAnchor = currentAnchor; 
                        this.walls[this.walls.length - 2].endAnchor = currentAnchor; 
                    } else {
                        this.walls[this.walls.length - 1].endAnchor = currentAnchor; 
                    }
                }
            }
        }
        this.lastP1 = { ...p1 }; this.lastP2 = { ...p2 };
        
        if (this.planner.selectedEntity === this) {
            this.walls.forEach(w => w.poly.stroke('#3b82f6'));
        }
    }
    
    update() { const p1 = this.p1.position(), p2 = this.p2.position(); if (!this.lastP1 || !this.lastP2 || this.lastP1.x !== p1.x || this.lastP1.y !== p1.y || this.lastP2.x !== p2.x || this.lastP2.y !== p2.y) this.rebuild(); }
    
    remove() { this.walls.forEach(w => { w.wallGroup.destroy(); w.labelGroup.destroy(); this.planner.walls = this.planner.walls.filter(existing => existing !== w); }); this.intermediateAnchors.forEach(a => { a.node.destroy(); this.planner.anchors = this.planner.anchors.filter(existing => existing !== a); }); this.group.destroy(); this.planner.arcs = (this.planner.arcs || []).filter(a => a !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
}

export class PremiumBalcony {}

export class PremiumShape {
    constructor(planner, type, params) {
        this.planner = planner;
        if (type === 'shape_triangle') type = 'shape_polygon';
        this.type = type;
        this.params = params || {};
        this.rotation = params.rotation || 0;
        
        if (!this.params.fill) this.params.fill = '#f0f4f8';
        if (!this.params.stroke) this.params.stroke = '#9ca3af';
        if (this.params.height3D === undefined) this.params.height3D = 100;
        
        this.group = new Konva.Group({
            x: params.x || 0,
            y: params.y || 0,
            rotation: this.rotation,
            draggable: true
        });

        const shapeConfig = {
            fill: this.params.fill,
            stroke: this.params.stroke,
            strokeWidth: 8,
            lineJoin: 'round',
            shadowColor: 'black', 
            shadowBlur: 10, 
            shadowOffset: {x: 2, y: 2}, 
            shadowOpacity: 0.2
        };

        if (type === 'shape_rect') {
            this.shape = new Konva.Rect({
                ...shapeConfig,
                width: params.width,
                height: params.height,
                offsetX: params.width / 2,
                offsetY: params.height / 2
            });
        } else if (type === 'shape_circle') {
            this.shape = new Konva.Circle({
                ...shapeConfig,
                radius: params.radius
            });
        } else if (type === 'shape_polygon') {
            this.shape = new Konva.Line({
                ...shapeConfig,
                points: this.params.points ? this.params.points.flatMap(p => [p.x, p.y]) : [],
                closed: true
            });
        }

        this.group.add(this.shape);
        this.planner.furnitureLayer.add(this.group);
        
        this.group.on('mouseenter', () => { if (this.planner.tool === 'select') document.body.style.cursor = 'move'; });
        this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        this.group.on('mousedown touchstart', (e) => { 
            e.cancelBubble = true; 
            if (e.evt) e.evt.stopPropagation();
            if (this.planner.tool === 'split') {
                const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
                this.convertToPolygon(pos);
            } else {
                this.planner.selectEntity(this, 'shape'); 
            }
        });
        this.group.on('dragmove', () => { this.planner.syncAll(); });
        this.group.on('transform', () => {
            this.rotation = this.group.rotation();
            if (this.type === 'shape_rect') {
                this.params.width = Math.abs(this.shape.width() * this.group.scaleX());
                this.params.height = Math.abs(this.shape.height() * this.group.scaleY());
                this.group.scaleX(1); this.group.scaleY(1);
                this.shape.width(this.params.width); this.shape.height(this.params.height);
                this.shape.offsetX(this.params.width / 2); this.shape.offsetY(this.params.height / 2);
            } else if (this.type === 'shape_circle') {
                this.params.radius = Math.abs(this.shape.radius() * Math.max(Math.abs(this.group.scaleX()), Math.abs(this.group.scaleY())));
                this.group.scaleX(1); this.group.scaleY(1);
                this.shape.radius(this.params.radius);
            }
            this.planner.syncAll();
            
            if (this.planner.snapAndAlign) {
                this.planner.snapAndAlign(this.group, true);
            }
        });
        this.group.on('transformend', () => {
            if (this.planner.alignmentLines) {
                this.planner.alignmentLines.destroyChildren();
                this.planner.uiLayer.batchDraw();
            }
        });
        
        if (this.type === 'shape_polygon') {
            this.rebuildHandles();
        }
    }
    setHighlight(isActive) { this.shape.stroke(this.params.stroke); if (this.handlesGroup) this.handlesGroup.visible(isActive); this.planner.stage.batchDraw(); }
    update() {
        if (this.type === 'shape_rect') {
            this.shape.width(this.params.width); this.shape.height(this.params.height);
            this.shape.offsetX(this.params.width / 2); this.shape.offsetY(this.params.height / 2);
        } else if (this.type === 'shape_circle') {
            this.shape.radius(this.params.radius);
        } else if (this.type === 'shape_polygon') {
            if (this.params.points) {
                this.shape.points(this.params.points.flatMap(p => [p.x, p.y]));
            }
        }
        this.shape.fill(this.params.fill); this.group.rotation(this.rotation);
        if (this.handlesGroup) {
            this.handles.forEach((h, i) => h.position(this.params.points[i]));
                if (this.updateEdgeHandles) this.updateEdgeHandles();
        }
    }
        
    updateEdgeHandles() {
        if (this.edgeHandles) {
            this.edgeHandles.forEach((h, i) => {
                const p1 = this.params.points[i];
                const p2 = this.params.points[(i + 1) % this.params.points.length];
                h.position({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
            });
        }
        if (this.edgeHits) {
            this.edgeHits.forEach((h, i) => {
                const p1 = this.params.points[i];
                const p2 = this.params.points[(i + 1) % this.params.points.length];
                h.points([p1.x, p1.y, p2.x, p2.y]);
            });
        }
    }

    rebuildHandles() {
        if (this.handlesGroup) this.handlesGroup.destroy();
        this.handlesGroup = new Konva.Group({ visible: this.planner.selectedEntity === this });
        this.group.add(this.handlesGroup);
        this.handles = [];
        this.edgeHandles = [];
        this.edgeHits = [];
        if (!this.params.points) return;
        
        this.params.points.forEach((pt, i) => {
            const handle = new Konva.Group({ x: pt.x, y: pt.y, draggable: true, name: 'shape-handle' });
            handle.add(new Konva.Circle({ radius: 8, fill: "#111827", stroke: "white", strokeWidth: 2 }));

            handle.on('mouseenter', () => document.body.style.cursor = 'crosshair');
            handle.on('mouseleave', () => document.body.style.cursor = 'default');
            handle.on('dragstart', (e) => { e.cancelBubble = true; });
            handle.on('dragmove', (e) => {
                e.cancelBubble = true;
                const pos = this.planner.getPointerPos();
                let snapPos = pos; let closestDist = SNAP_DIST; let snapped = false;
                for (let w of this.planner.walls) {
                    const proj = this.planner.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                    const dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    if (dist < closestDist) { closestDist = dist; snapPos = proj; snapped = true; }
                }
                const localSnap = this.group.getTransform().copy().invert().point(snapPos);
                handle.position(localSnap); this.params.points[i] = localSnap;
                this.shape.points(this.params.points.flatMap(p => [p.x, p.y]));
                if (snapped) this.planner.showSnapGlow(snapPos.x, snapPos.y); else this.planner.hideSnapGlow();
                if (this.updateEdgeHandles) this.updateEdgeHandles();
                this.planner.mainLayer.batchDraw(); this.planner.uiLayer.batchDraw(); this.planner.syncAll();
            });
            handle.on('dragend', (e) => { e.cancelBubble = true; this.planner.hideSnapGlow(); this.planner.syncAll(); });
            this.handlesGroup.add(handle); this.handles.push(handle);
        });
        
        for (let i = 0; i < this.params.points.length; i++) {
            const p1 = this.params.points[i];
            const p2 = this.params.points[(i + 1) % this.params.points.length];
            
            // Invisible hit area for dragging the border itself
            const edgeHit = new Konva.Line({
                points: [p1.x, p1.y, p2.x, p2.y],
                stroke: 'transparent',
                strokeWidth: 20,
                draggable: true,
                name: 'edge-hit'
            });
            
            edgeHit.on('dragstart', (e) => { e.cancelBubble = true; });
            edgeHit.on('dragmove', (e) => {
                e.cancelBubble = true;
                const mousePos = this.planner.getPointerPos();
                const localMousePos = this.group.getTransform().copy().invert().point(mousePos);
                const edgeDx = p2.x - p1.x; const edgeDy = p2.y - p1.y;
                const len = Math.hypot(edgeDx, edgeDy);
                if (len === 0) return;
                const nx = -edgeDy / len; const ny = edgeDx / len;
                const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2;
                const dragVecX = localMousePos.x - midX; const dragVecY = localMousePos.y - midY;
                const dot = dragVecX * nx + dragVecY * ny;
                const shiftX = nx * dot; const shiftY = ny * dot;
                
                this.params.points[i].x += shiftX; this.params.points[i].y += shiftY;
                this.params.points[(i + 1) % this.params.points.length].x += shiftX; 
                this.params.points[(i + 1) % this.params.points.length].y += shiftY;
                
                this.shape.points(this.params.points.flatMap(p => [p.x, p.y]));
                this.handles[i].position(this.params.points[i]);
                this.handles[(i + 1) % this.params.points.length].position(this.params.points[(i + 1) % this.params.points.length]);
                if (this.updateEdgeHandles) this.updateEdgeHandles();
                this.planner.mainLayer.batchDraw(); this.planner.uiLayer.batchDraw(); this.planner.syncAll();
            });
            edgeHit.on('dragend', (e) => { e.cancelBubble = true; this.planner.syncAll(); });
            edgeHit.on('mouseenter', () => document.body.style.cursor = 'move');
            edgeHit.on('mouseleave', () => document.body.style.cursor = 'default');
            this.handlesGroup.add(edgeHit);
            this.edgeHits.push(edgeHit);

            // Visible center handle for pulling out a new corner
            const edgeHandle = new Konva.Circle({
                x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2,
                radius: 6, fill: '#111827', stroke: '#ffffff', strokeWidth: 2,
                draggable: true, name: 'edge-handle'
            });
            
            let dragPos = null;
            edgeHandle.on('dragstart', (e) => { 
                e.cancelBubble = true; 
                dragPos = { x: edgeHandle.x(), y: edgeHandle.y() };
            });
            edgeHandle.on('dragmove', (e) => {
                e.cancelBubble = true;
                const localMousePos = this.group.getTransform().copy().invert().point(this.planner.getPointerPos());
                dragPos = localMousePos;
                edgeHandle.position(localMousePos);
                
                const tempPts = [...this.params.points];
                tempPts.splice(i + 1, 0, dragPos);
                this.shape.points(tempPts.flatMap(p => [p.x, p.y]));
                
                this.planner.mainLayer.batchDraw(); this.planner.uiLayer.batchDraw(); this.planner.syncAll();
            });
            edgeHandle.on('dragend', (e) => { 
                e.cancelBubble = true; 
                if (dragPos) {
                    this.params.points.splice(i + 1, 0, dragPos);
                }
                this.rebuildHandles(); 
                this.planner.syncAll(); 
            });
            edgeHandle.on('dblclick', (e) => { 
                e.cancelBubble = true; 
                const stagePt = this.group.getTransform().point(edgeHandle.position());
                this.convertToPolygon(stagePt); 
            });
            edgeHandle.on('mouseenter', () => document.body.style.cursor = 'crosshair');
                edgeHandle.on('mouseleave', () => document.body.style.cursor = 'default');
            
            this.handlesGroup.add(edgeHandle);
            this.edgeHandles.push(edgeHandle);
        }
    }
    remove() {
        if (this.planner.shapeTransformer && this.planner.shapeTransformer.nodes().includes(this.group)) { this.planner.shapeTransformer.nodes([]); }
        this.group.destroy(); this.planner.shapes = (this.planner.shapes || []).filter(s => s !== this);
        this.planner.selectEntity(null); this.planner.syncAll();
    }

    convertToPolygon(clickPos) {
        if (this.type === 'shape_circle') return; // Cannot easily split circles into linear walls

        if (this.type === 'shape_polygon') {
            if (clickPos) {
                const localClick = this.group.getTransform().copy().invert().point(clickPos);
                let bestDist = Infinity, bestEdge = -1, bestProj = null;
                for(let i = 0; i < this.params.points.length; i++) {
                    const p1 = this.params.points[i], p2 = this.params.points[(i + 1) % this.params.points.length];
                    const proj = this.planner.getClosestPointOnSegment(localClick, p1, p2);
                    const dist = Math.hypot(localClick.x - proj.x, localClick.y - proj.y);
                    if (dist < bestDist) { bestDist = dist; bestEdge = i; bestProj = proj; }
                }
                const hitThreshold = 20 / (this.planner.stage.scaleX() || 1);
                if (bestEdge !== -1 && bestDist < hitThreshold) {
                    this.params.points.splice(bestEdge + 1, 0, bestProj);
                    this.shape.points(this.params.points.flatMap(p => [p.x, p.y]));
                    this.rebuildHandles();
                }
            }
            this.planner.tool = 'select'; this.planner.updateToolStates();
            if (this.planner.onToolChange) this.planner.onToolChange('select');
            this.planner.selectEntity(this, 'shape'); this.planner.syncAll();
            return;
        }

        let localPts = [];
        if (this.type === 'shape_rect') {
            const w = this.params.width;
            const h = this.params.height;
            localPts = [
                { x: -w / 2, y: -h / 2 },
                { x: w / 2, y: -h / 2 },
                { x: w / 2, y: h / 2 },
                { x: -w / 2, y: h / 2 }
            ];
        } else if (this.type === 'shape_triangle') {
            const linePts = this.shape.points();
            for (let i = 0; i < linePts.length; i += 2) {
                localPts.push({ x: linePts[i], y: linePts[i+1] });
            }
        }

        const transform = this.group.getTransform();
        let stagePts = localPts.map(p => transform.point(p));

        let cx = 0, cy = 0;
        stagePts.forEach(p => { cx += p.x; cy += p.y; });
        cx /= stagePts.length; cy /= stagePts.length;

        let newLocalPts = stagePts.map(p => ({ x: p.x - cx, y: p.y - cy }));
        
        this.group.setAttrs({ x: cx, y: cy, rotation: 0, scaleX: 1, scaleY: 1 });
        this.rotation = 0; this.params.width = 0; this.params.height = 0;
        this.type = 'shape_polygon'; this.params.points = newLocalPts;

        if (clickPos) {
            const localClick = this.group.getTransform().copy().invert().point(clickPos);
            let bestDist = Infinity, bestEdge = -1, bestProj = null;
            for(let i = 0; i < newLocalPts.length; i++) {
                const p1 = newLocalPts[i], p2 = newLocalPts[(i + 1) % newLocalPts.length];
                const proj = this.planner.getClosestPointOnSegment(localClick, p1, p2);
                const dist = Math.hypot(localClick.x - proj.x, localClick.y - proj.y);
                if (dist < bestDist) { bestDist = dist; bestEdge = i; bestProj = proj; }
            }
            const hitThreshold = 20 / (this.planner.stage.scaleX() || 1);
            if (bestEdge !== -1 && bestDist < hitThreshold) {
                this.params.points.splice(bestEdge + 1, 0, bestProj);
            }
        }

        this.shape.destroy();
        const shapeConfig = { fill: this.params.fill, stroke: this.params.stroke, strokeWidth: 8, lineJoin: 'round', shadowColor: 'black', shadowBlur: 10, shadowOffset: {x: 2, y: 2}, shadowOpacity: 0.2, closed: true };
        this.shape = new Konva.Line({ ...shapeConfig, points: this.params.points.flatMap(p => [p.x, p.y]) });
        this.group.add(this.shape); this.shape.moveToBottom();
        this.rebuildHandles();
        
        this.planner.tool = 'select';
        this.planner.updateToolStates();
        if (this.planner.onToolChange) this.planner.onToolChange('select');
        this.planner.selectEntity(this, 'shape');
        this.planner.syncAll();
    }
}

export class FloorPlanner {
    constructor(containerEl) { 
        this.container = containerEl; this.tool = "select"; this.currentUnit = "ft"; this.drawing = false; this.lastAnchor = null; this.startAnchor = null; this.drawingStair = null; this.preview = null;
        this.activeCategory = 'tools';
        this.walls = []; this.anchors = []; this.roomPaths = []; this.stairs = []; this.furniture = []; this.roofs = []; this.arcs = []; this.shapes = []; this.selectedEntity = null; this.selectedType = null; this.selectedNodeIndex = -1;
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
        
        this.splitPreviewGlow = new Konva.Circle({ radius: 6, fill: '#ef4444', shadowColor: '#ef4444', shadowBlur: 10, opacity: 0.8, visible: false, listening: false });
        this.uiLayer.add(this.splitPreviewGlow);
        
        this.guideLineInfinite = new Konva.Line({ points: [0,0,0,0], stroke: '#38bdf8', strokeWidth: 1, dash: [4, 4], visible: false, listening: false }); 
        this.uiLayer.add(this.guideLineInfinite);
        
        this.infoBadgeGroup = new Konva.Group({ visible: false, listening: false }); 
        this.infoBadgeBg = new Konva.Rect({ fill: '#111827', cornerRadius: 6, opacity: 0.9, shadowColor: 'black', shadowBlur: 4, shadowOffsetY: 2, shadowOpacity: 0.2 }); 
        this.infoBadgeText = new Konva.Text({ text: '', fill: 'white', padding: 8, fontSize: 11, align: 'center', fontStyle: 'bold', lineHeight: 1.4 }); 
        this.infoBadgeGroup.add(this.infoBadgeBg, this.infoBadgeText); 
        this.uiLayer.add(this.infoBadgeGroup);

        this.wallHighlight = new Konva.Line({ stroke: '#3b82f6', strokeWidth: 6, opacity: 0.7, visible: false, listening: false });
        this.uiLayer.add(this.wallHighlight);
        
        this.shapeTransformer = new Konva.Transformer({
            borderStroke: '#3b82f6', anchorStroke: '#ffffff', anchorFill: '#111827',
            anchorSize: 16, anchorCornerRadius: 8, anchorStrokeWidth: 2,
            rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
            boundBoxFunc: (oldBox, newBox) => {
                // Only snap cleanly unrotated boxes 
                if (Math.abs(newBox.rotation % 90) > 0.1) return newBox;
                
                const SNAP_TOLERANCE = 10;
                let snapX = null;
                let snapY = null;
                
                const nodes = [...this.furnitureLayer.getChildren(), ...this.widgetLayer.getChildren()];

                const activeAnchor = this.shapeTransformer.getActiveAnchor();
                let isTop = activeAnchor && activeAnchor.includes('top');
                let isBottom = activeAnchor && activeAnchor.includes('bottom');
                let isLeft = activeAnchor && activeAnchor.includes('left');
                let isRight = activeAnchor && activeAnchor.includes('right');

                nodes.forEach(node => {
                    if (this.selectedEntity && this.selectedEntity.group === node) return;
                    if (node.name() && node.name().includes('anchor')) return;
                    
                    const targetRect = node.getClientRect();
                    if (targetRect.width === 0 || targetRect.height === 0) return;

                    const targetCenter = { x: targetRect.x + targetRect.width/2, y: targetRect.y + targetRect.height/2 };

                    if (isLeft || isRight) {
                        const sourceEdge = isLeft ? newBox.x : newBox.x + newBox.width;
                        const targetsX = [targetRect.x, targetCenter.x, targetRect.x + targetRect.width];
                        if (snapX === null) {
                            for (let t of targetsX) {
                                if (Math.abs(sourceEdge - t) < SNAP_TOLERANCE) { snapX = t - sourceEdge; break; }
                            }
                        }
                    }

                    if (isTop || isBottom) {
                        const sourceEdge = isTop ? newBox.y : newBox.y + newBox.height;
                        const targetsY = [targetRect.y, targetCenter.y, targetRect.y + targetRect.height];
                        if (snapY === null) {
                            for (let t of targetsY) {
                                if (Math.abs(sourceEdge - t) < SNAP_TOLERANCE) { snapY = t - sourceEdge; break; }
                            }
                        }
                    }
                });

                if (snapX !== null) {
                    if (isLeft) { newBox.x += snapX; newBox.width -= snapX; } else if (isRight) { newBox.width += snapX; }
                }
                if (snapY !== null) {
                    if (isTop) { newBox.y += snapY; newBox.height -= snapY; } else if (isBottom) { newBox.height += snapY; }
                }
                if (newBox.width < 10) newBox.width = 10; if (newBox.height < 10) newBox.height = 10;
                return newBox;
            }
        });
        this.uiLayer.add(this.shapeTransformer);
        
        this.shapePreviewGroup = new Konva.Group({ listening: false });
        this.shapePreviewRect = new Konva.Rect({ stroke: '#3b82f6', dash: [4, 4], strokeWidth: 2, visible: false, listening: false });
        this.shapePreviewCircle = new Konva.Circle({ stroke: '#3b82f6', dash: [4, 4], strokeWidth: 2, visible: false, listening: false });
        this.shapePreviewTriangle = new Konva.Line({ stroke: '#3b82f6', dash: [4, 4], strokeWidth: 2, visible: false, listening: false });
        this.shapePreviewGroup.add(this.shapePreviewRect, this.shapePreviewCircle, this.shapePreviewTriangle);
        this.uiLayer.add(this.shapePreviewGroup);

        this.alignmentLines = new Konva.Group({ listening: false });
        this.uiLayer.add(this.alignmentLines);
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
    
    snapAndAlign(dragNode, isTransforming = false) {
        if (!this.alignmentLines) {
            this.alignmentLines = new Konva.Group({ listening: false });
            this.uiLayer.add(this.alignmentLines);
        }
        this.alignmentLines.destroyChildren();

        if (this.tool !== 'select' || dragNode.isWallPoly || dragNode.isStairNodeHandle || (dragNode.name() && dragNode.name().includes('anchor'))) {
            this.uiLayer.batchDraw();
            return;
        }

        const SNAP_TOLERANCE = 10; 
        const dragRect = dragNode.getClientRect();
        const dragCenter = { x: dragRect.x + dragRect.width / 2, y: dragRect.y + dragRect.height / 2 };

        const nodes = [...this.furnitureLayer.getChildren(), ...this.widgetLayer.getChildren()];

        let snapX = null;
        let snapY = null;
        let guideX = null;
        let guideY = null;
        let isColliding = false;
        let distTargetX = null;
        let distTargetY = null;

        nodes.forEach(node => {
            if (node === dragNode || node === this.ghostPreview || node.isAncestorOf(dragNode) || dragNode.isAncestorOf(node) || (node.name() && node.name().includes('anchor'))) return;

            const targetRect = node.getClientRect();
            if (targetRect.width === 0 || targetRect.height === 0) return;
            
            const targetCenter = { x: targetRect.x + targetRect.width / 2, y: targetRect.y + targetRect.height / 2 };

            // Check Bounding Box Collision
            if (
                dragRect.x < targetRect.x + targetRect.width &&
                dragRect.x + dragRect.width > targetRect.x &&
                dragRect.y < targetRect.y + targetRect.height &&
                dragRect.y + dragRect.height > targetRect.y
            ) {
                isColliding = true;
            }

            let activeAnchor = (isTransforming && this.shapeTransformer) ? this.shapeTransformer.getActiveAnchor() : null;
            let checkLeft = !activeAnchor || activeAnchor.includes('left');
            let checkRight = !activeAnchor || activeAnchor.includes('right');
            let checkTop = !activeAnchor || activeAnchor.includes('top');
            let checkBottom = !activeAnchor || activeAnchor.includes('bottom');
            let checkCenterX = !activeAnchor;
            let checkCenterY = !activeAnchor;

            // X Alignments
            const xAlignments = [];
            if (checkLeft) {
                xAlignments.push({ source: dragRect.x, target: targetRect.x });
                xAlignments.push({ source: dragRect.x, target: targetRect.x + targetRect.width });
                xAlignments.push({ source: dragRect.x, target: targetCenter.x });
            }
            if (checkRight) {
                xAlignments.push({ source: dragRect.x + dragRect.width, target: targetRect.x + targetRect.width });
                xAlignments.push({ source: dragRect.x + dragRect.width, target: targetRect.x });
                xAlignments.push({ source: dragRect.x + dragRect.width, target: targetCenter.x });
            }
            if (checkCenterX) {
                xAlignments.push({ source: dragCenter.x, target: targetCenter.x });
            }

            // Y Alignments
            const yAlignments = [];
            if (checkTop) {
                yAlignments.push({ source: dragRect.y, target: targetRect.y });
                yAlignments.push({ source: dragRect.y, target: targetRect.y + targetRect.height });
                yAlignments.push({ source: dragRect.y, target: targetCenter.y });
            }
            if (checkBottom) {
                yAlignments.push({ source: dragRect.y + dragRect.height, target: targetRect.y + targetRect.height });
                yAlignments.push({ source: dragRect.y + dragRect.height, target: targetRect.y });
                yAlignments.push({ source: dragRect.y + dragRect.height, target: targetCenter.y });
            }
            if (checkCenterY) {
                yAlignments.push({ source: dragCenter.y, target: targetCenter.y });
            }

            if (snapX === null) {
                for (let xA of xAlignments) {
                    if (Math.abs(xA.source - xA.target) < SNAP_TOLERANCE) {
                        snapX = xA.target - xA.source;
                        guideX = xA.target;
                        distTargetX = targetRect;
                        break;
                    }
                }
            }

            if (snapY === null) {
                for (let yA of yAlignments) {
                    if (Math.abs(yA.source - yA.target) < SNAP_TOLERANCE) {
                        snapY = yA.target - yA.source;
                        guideY = yA.target;
                        distTargetY = targetRect;
                        break;
                    }
                }
            }
        });

        // Apply Snapping (Absolute Position adjustment)
        if (!isTransforming) {
            let newAbsPos = dragNode.getAbsolutePosition();
            if (snapX !== null) newAbsPos.x += snapX;
            if (snapY !== null) newAbsPos.y += snapY;
            if (snapX !== null || snapY !== null) dragNode.setAbsolutePosition(newAbsPos);
        }

        // Draw Guides (Convert absolute guide coordinates back to local UI Layer coordinates)
        const inverseTransform = this.uiLayer.getAbsoluteTransform().copy().invert();
        const scale = 1 / this.stage.scaleX();
        
        if (guideX !== null) {
            const p1 = inverseTransform.point({ x: guideX, y: -5000 });
            const p2 = inverseTransform.point({ x: guideX, y: 5000 });
            this.alignmentLines.add(new Konva.Line({ points: [p1.x, p1.y, p2.x, p2.y], stroke: '#38bdf8', strokeWidth: scale, dash: [4 * scale, 4 * scale] }));
            
            if (distTargetX) {
                const yPos = inverseTransform.point({ x: 0, y: Math.min(dragCenter.y, distTargetX.y + distTargetX.height / 2) }).y;
                let gapStart, gapEnd;
                if (dragCenter.x < distTargetX.x + distTargetX.width / 2) { gapStart = dragRect.x + dragRect.width; gapEnd = distTargetX.x; } 
                else { gapStart = distTargetX.x + distTargetX.width; gapEnd = dragRect.x; }
                if (gapEnd > gapStart) {
                    const pS = inverseTransform.point({ x: gapStart, y: 0 }); const pE = inverseTransform.point({ x: gapEnd, y: 0 });
                    this.alignmentLines.add(new Konva.Line({ points: [pS.x, yPos, pE.x, yPos], stroke: '#f59e0b', strokeWidth: scale }));
                    const txt = new Konva.Text({ x: (pS.x + pE.x) / 2, y: yPos - 12 * scale, text: `← ${this.formatLength(gapEnd - gapStart)} →`, fontSize: 11 * scale, fill: '#f59e0b', fontStyle: 'bold' });
                    txt.offsetX(txt.width() / 2); this.alignmentLines.add(txt);
                }
            }
        }
        
        if (guideY !== null) {
            const p1 = inverseTransform.point({ x: -5000, y: guideY });
            const p2 = inverseTransform.point({ x: 5000, y: guideY });
            this.alignmentLines.add(new Konva.Line({ points: [p1.x, p1.y, p2.x, p2.y], stroke: '#38bdf8', strokeWidth: scale, dash: [4 * scale, 4 * scale] }));
            
            if (distTargetY) {
                const xPos = inverseTransform.point({ x: Math.min(dragCenter.x, distTargetY.x + distTargetY.width / 2), y: 0 }).x;
                let gapStart, gapEnd;
                if (dragCenter.y < distTargetY.y + distTargetY.height / 2) { gapStart = dragRect.y + dragRect.height; gapEnd = distTargetY.y; } 
                else { gapStart = distTargetY.y + distTargetY.height; gapEnd = dragRect.y; }
                if (gapEnd > gapStart) {
                    const pS = inverseTransform.point({ x: 0, y: gapStart }); const pE = inverseTransform.point({ x: 0, y: gapEnd });
                    this.alignmentLines.add(new Konva.Line({ points: [xPos, pS.y, xPos, pE.y], stroke: '#f59e0b', strokeWidth: scale }));
                    const txt = new Konva.Text({ x: xPos + 5 * scale, y: (pS.y + pE.y) / 2, text: `↕ ${this.formatLength(gapEnd - gapStart)}`, fontSize: 11 * scale, fill: '#f59e0b', fontStyle: 'bold' });
                    txt.offsetY(txt.height() / 2); this.alignmentLines.add(txt);
                }
            }
        }

        if (isColliding) {
            const effSnapX = isTransforming ? 0 : (snapX || 0);
            const effSnapY = isTransforming ? 0 : (snapY || 0);
            const pTL = inverseTransform.point({ x: dragRect.x + effSnapX, y: dragRect.y + effSnapY });
            const pBR = inverseTransform.point({ x: dragRect.x + dragRect.width + effSnapX, y: dragRect.y + dragRect.height + effSnapY });
            this.alignmentLines.add(new Konva.Rect({ x: pTL.x, y: pTL.y, width: pBR.x - pTL.x, height: pBR.y - pTL.y, fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', strokeWidth: 2 * scale, cornerRadius: 4 * scale }));
        }

        this.uiLayer.batchDraw();
    }

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
        if (this.selectedEntity && this.selectedType === 'arc') this.selectedEntity.setHighlight(false);
        
        this.selectedEntity = entity; this.selectedType = type; this.selectedNodeIndex = nodeIndex;
        
        if (entity && (type === 'wall' || type === 'stair' || type === 'stair_node' || type === 'furniture' || type === 'roof' || type === 'balcony' || type === 'arc' || type === 'shape')) entity.setHighlight(true);
        if (this.shapeTransformer) {
            if (type === 'shape') {
                this.shapeTransformer.nodes([entity.group]);
                this.shapeTransformer.resizeEnabled(entity.type !== 'shape_polygon');
                
                // Inject custom arrows into the transformer resizing anchors
                this.shapeTransformer.find('Rect').forEach(anchor => {
                    if (anchor.name() && anchor.name().includes('rotater')) return;
                    if (anchor.hasCustomStyle) return;
                    anchor.hasCustomStyle = true;
                    anchor.sceneFunc((ctx, shape) => {
                        const size = shape.width();
                        const r = size / 2;
                        
                        ctx.beginPath();
                        ctx.arc(r, r, r, 0, Math.PI * 2);
                        ctx.fillStyle = "#111827";
                        ctx.fill();
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = "white";
                        ctx.stroke();

                        ctx.fillStyle = "#111827";
                        const arrowOffset = 11; const arrowSize = 4;
                        const drawArr = (pts) => {
                            ctx.beginPath(); ctx.moveTo(r + pts[0], r + pts[1]); ctx.lineTo(r + pts[2], r + pts[3]); ctx.lineTo(r + pts[4], r + pts[5]); ctx.closePath(); ctx.fill();
                        };
                        drawArr([0, -arrowOffset, -arrowSize, -arrowOffset+arrowSize, arrowSize, -arrowOffset+arrowSize]);
                        drawArr([0, arrowOffset, -arrowSize, arrowOffset-arrowSize, arrowSize, arrowOffset-arrowSize]);
                        drawArr([-arrowOffset, 0, -arrowOffset+arrowSize, -arrowSize, -arrowOffset+arrowSize, arrowSize]);
                        drawArr([arrowOffset, 0, arrowOffset-arrowSize, -arrowSize, arrowOffset-arrowSize, arrowSize]);
                    });
                    
                    // Expand hit area slightly so it covers the arrows too
                    anchor.hitFunc((ctx, shape) => {
                        const size = shape.width();
                        const r = size / 2;
                        ctx.beginPath();
                        ctx.arc(r, r, r + 15, 0, Math.PI * 2);
                        ctx.closePath();
                        ctx.fillStrokeShape(shape);
                    });
                });
            } else {
                this.shapeTransformer.nodes([]);
            }
        }
        this.syncAll();

        if (this.onSelectionChange) this.onSelectionChange(entity, type, nodeIndex);
    }

    updateToolStates() {
        const cat = this.activeCategory || 'tools';
        const isSelect = this.tool === "select";
        const isSplit = this.tool === "split";
        const isWidget = !!WIDGET_REGISTRY[this.tool];
        const allowAll = (cat === 'tools' || cat === 'advanced');

        this.walls.forEach(w => {
            let isRailing = w.type === 'railing';
            let canEditThisWall = false;

            if (allowAll) {
                canEditThisWall = isSelect || isSplit;
            } else if (cat === 'walls') {
                canEditThisWall = !isRailing && (isSelect || isSplit);
            } else if (cat === 'common') {
                canEditThisWall = isRailing && (isSelect || isSplit);
            }

            if(w.poly) { 
                w.poly.setAttr('draggable', canEditThisWall); 
                w.poly.setAttr('listening', canEditThisWall || isWidget || isSplit); 
            }
            
            w.attachedWidgets.forEach(widg => { 
                if(widg.visualGroup) { 
                    let canEditWidget = isSelect && (allowAll || cat === 'doors_windows');
                    widg.visualGroup.setAttr('draggable', canEditWidget); 
                    widg.visualGroup.setAttr('listening', canEditWidget); 
                } 
            });
        });

        this.stairs.forEach(s => { 
            let canEdit = isSelect && (allowAll || cat === 'structures');
            if(s.group) { s.group.setAttr('draggable', canEdit); s.group.setAttr('listening', canEdit); } 
        });
        this.anchors.forEach(a => { 
            let canEdit = isSelect && (allowAll || cat === 'walls' || cat === 'common');
            if(a.node) { a.node.setAttr('draggable', canEdit); a.node.setAttr('listening', canEdit); } 
        });
        this.furniture.forEach(f => { 
            let canEdit = isSelect && (allowAll || cat === 'furniture');
            if(f.group) { f.group.setAttr('draggable', canEdit); f.group.setAttr('listening', canEdit); } 
        });
        this.roofs.forEach(r => { 
            let canEdit = isSelect && (allowAll || cat === 'structures');
            if(r.group) { r.group.setAttr('draggable', canEdit); r.group.setAttr('listening', canEdit); } 
        });
        if(this.balconies) this.balconies.forEach(b => { 
            let canEdit = isSelect && (allowAll || cat === 'structures');
            if(b.group) { b.group.setAttr('draggable', canEdit); b.group.setAttr('listening', canEdit); } 
        });
        if (this.shapes) this.shapes.forEach(s => {
            let canEdit = isSelect && (allowAll || cat === 'shapes');
            let canSplit = isSplit && (allowAll || cat === 'advanced' || cat === 'shapes');
            if(s.group) { 
                s.group.setAttr('draggable', canEdit); 
                s.group.setAttr('listening', canEdit || canSplit); 
            } 
        });

        // FORCE LAYER LISTENING OFF DURING DRAWING OR RESTRICT BY CATEGORY
        if (this.wallLayer) { this.wallLayer.listening(allowAll || cat === "common" || cat === "walls" || cat === "doors_windows" || cat === "structures" || isWidget || isSplit); }
        if (this.widgetLayer) { this.widgetLayer.listening(allowAll || cat === "doors_windows" || cat === "structures"); }
        if (this.furnitureLayer) { this.furnitureLayer.listening(allowAll || cat === "furniture" || cat === "shapes" || isSplit); }
        if (this.roofLayer) { this.roofLayer.listening(allowAll || cat === "structures"); }

        if (this.stage) {
            this.stage.draggable(isSelect);
            this.stage.container().style.cursor = isSelect ? 'grab' : 'crosshair';
            document.body.style.cursor = '';
        }
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
        this.updateToolStates();
    }

    getOrCreateAnchor(x, y) { let a = this.anchors.find(a => Math.hypot(a.x - x, a.y - y) < SNAP_DIST); if (a) return a; const newAnchor = new Anchor(this, x, y); this.anchors.push(newAnchor); return newAnchor; }
    deselectAll() { this.walls.forEach(w => w.setHighlight(false)); this.stairs.forEach(s => s.setHighlight(false)); this.furniture.forEach(f => f.setHighlight(false)); this.roofs.forEach(r => r.setHighlight(false)); if(this.balconies) this.balconies.forEach(b => b.setHighlight(false)); if(this.shapes) this.shapes.forEach(s => s.setHighlight(false)); this.selectEntity(null); this.syncAll(); }
    syncAll() { 
        this.buildingCenter = null; 
        this.walls.forEach(w => w.update()); 
        this.stairs.forEach(s => s.update()); 
        this.furniture.forEach(f => f.update()); 
        this.roofs.forEach(r => r.update()); 
        if(this.balconies) this.balconies.forEach(b => b.update()); 
        if(this.arcs) this.arcs.forEach(a => a.update());
        if(this.shapes) this.shapes.forEach(s => s.update());
        
        this.anchors.forEach(a => {
            if (a.isArcIntermediate) {
                a.hide();
                return;
            }
            let connectedCount = this.walls.filter(w => w.startAnchor === a || w.endAnchor === a).length;
            if (connectedCount >= 2) {
                a.show();
            } else if (this.selectedEntity && this.selectedType === 'wall' && (this.selectedEntity.startAnchor === a || this.selectedEntity.endAnchor === a)) {
                a.show();
            } else if (this.selectedEntity && this.selectedType === 'arc' && (this.selectedEntity.p1 === a || this.selectedEntity.p2 === a)) {
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
        if (this.drawingArc) { this.drawingArc = null; if (this.arcPreview) { this.arcPreview.destroy(); this.arcPreview = null; } }
        if (this.shapePreviewGroup) { this.shapePreviewRect.visible(false); this.shapePreviewCircle.visible(false); this.shapePreviewTriangle.visible(false); }
        this.drawing = false; this.lastAnchor = null; this.startAnchor = null; 
        this.preview?.destroy(); this.preview = null; 
        this.hideSnapGlow(); this.drawGuideLine(0,0,0,0, false); this.hideInfoBadge(); 
        this.deselectAll(); 
    }
    
    initStageEvents() { 
        this.stage.on('dragstart', (e) => {
            if (e.target === this.stage) this.stage.container().style.cursor = 'grabbing';
            
            if (this.tool === 'select' && (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape') && !e.target.isWallPoly && !e.target.isStairNodeHandle && !(e.target.name() && e.target.name().includes('anchor'))) {
                if (this.ghostPreview) { this.ghostPreview.destroy(); }
                this.ghostPreview = e.target.clone();
                this.ghostPreview.opacity(0.3);
                this.ghostPreview.listening(false);
                e.target.getLayer().add(this.ghostPreview);
                this.ghostPreview.moveToBottom();
            }
        });
        
        this.stage.on('dragmove', (e) => {
            if (e.target === this.stage) return;
            if (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape') {
                if (this.tool === 'select' && !e.target.isWallPoly && !e.target.isStairNodeHandle && !(e.target.name() && e.target.name().includes('anchor'))) {
                    this.snapAndAlign(e.target);
                }
            }
        });

        this.stage.on('dragend', (e) => {
            if (e.target === this.stage) this.stage.container().style.cursor = this.tool === 'select' ? 'grab' : 'crosshair';
            if (this.alignmentLines) {
                this.alignmentLines.destroyChildren();
                this.uiLayer.batchDraw();
            }
            if (this.ghostPreview) {
                this.ghostPreview.destroy();
                this.ghostPreview = null;
            }
        });

        this.stage.on("mousedown touchstart", (e) => { 
            if (this.tool === 'roof') return;
            if (e.target === this.stage || e.target === this.bgLayer || e.target === this.mainLayer) this.deselectAll(); 
            const wallConfig = WALL_REGISTRY[this.tool]; 
            
            const pos = this.getPointerPos();
            if (!pos) return;
            
            let targetPos = { x: this.snap(pos.x), y: this.snap(pos.y) }; 

            if (this.tool === 'stair') { if (!this.drawingStair) { this.drawingStair = new PremiumStair(this, targetPos.x, targetPos.y); this.stairs.push(this.drawingStair); } else { this.drawingStair.addPoint(targetPos.x, targetPos.y); } this.syncAll(); return; }
            
            if (this.tool === 'arc') {
                let snap = targetPos;
                let closestDist = SNAP_DIST;
                
                let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < closestDist);
                if (a) { snap = { x: a.x, y: a.y }; closestDist = Math.hypot(a.x - pos.x, a.y - pos.y); }

                for (let w of this.walls) {
                    let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                    let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    if (dist < closestDist) { closestDist = dist; snap = proj; }
                }
                
                if (this.drawingArc && this.arcMousePos) {
                    snap = this.arcMousePos;
                }

                if (!this.drawingArc) {
                    this.drawingArc = { p1: snap, p2: null, state: 1 };
                    this.arcMousePos = snap;
                    
                    this.arcPreview = new Konva.Group();
                    this.arcPreview.ghostCircle = new Konva.Circle({ stroke: '#cbd5e1', dash: [4,4], strokeWidth: 1, listening: false });
                    this.arcPreview.angleFill = new Konva.Shape({ fill: 'rgba(59, 130, 246, 0.15)', listening: false });
                    this.arcPreview.radiusLines = new Konva.Line({ stroke: '#9ca3af', dash: [4,4], strokeWidth: 1, listening: false });
                    this.arcPreview.lineBase = new Konva.Line({ stroke: '#9ca3af', dash: [5,5], strokeWidth: 2, listening: false });
                    this.arcPreview.guideLine = new Konva.Line({ stroke: '#38bdf8', dash: [4,4], strokeWidth: 1, listening: false });
                    this.arcPreview.arcCurve = new Konva.Shape({ stroke: '#3b82f6', strokeWidth: 4, listening: false });
                    this.arcPreview.dragDot = new Konva.Circle({ radius: 6, fill: '#38bdf8', stroke: 'white', strokeWidth: 2, listening: false });

                    this.arcPreview.add(this.arcPreview.ghostCircle, this.arcPreview.angleFill, this.arcPreview.radiusLines, this.arcPreview.lineBase, this.arcPreview.guideLine, this.arcPreview.arcCurve, this.arcPreview.dragDot);
                    this.uiLayer.add(this.arcPreview);
                } else if (this.drawingArc.state === 1) {
                    if (Math.hypot(snap.x - this.drawingArc.p1.x, snap.y - this.drawingArc.p1.y) > 5) {
                        this.drawingArc.p2 = snap;
                        this.drawingArc.state = 2;
                        
                        const dx = snap.x - this.drawingArc.p1.x;
                        const dy = snap.y - this.drawingArc.p1.y;
                        const L = Math.hypot(dx, dy), n = { x: -dy/L, y: dx/L };
                        this.arcMousePos = { x: this.drawingArc.p1.x + dx/2 + n.x * (L/4), y: this.drawingArc.p1.y + dy/2 + n.y * (L/4) };
                        this.uiLayer.batchDraw();
                    }
                } else if (this.drawingArc.state === 2) {
                    if (!this.arcs) this.arcs = [];
                    const a1 = this.getOrCreateAnchor(this.drawingArc.p1.x, this.drawingArc.p1.y);
                    const a2 = this.getOrCreateAnchor(this.drawingArc.p2.x, this.drawingArc.p2.y);
                    const newArc = new PremiumArc(this, a1, a2, snap);
                    this.arcs.push(newArc);
                    this.finishChain();
                    this.tool = 'select'; this.updateToolStates();
                    if (this.onToolChange) this.onToolChange('select');
                    this.selectEntity(newArc, 'arc');
                    this.syncAll();
                }
                return;
            }
            
            if (this.tool.startsWith('shape_')) {
                let snapPos = targetPos;
                let closestDist = SNAP_DIST;
                let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < closestDist);
                if (a) { snapPos = { x: a.x, y: a.y }; }
                else {
                    for (let w of this.walls) {
                        let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                        let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                        if (dist < closestDist) { closestDist = dist; snapPos = proj; }
                    }
                }
                if (this.tool === 'shape_rect' || this.tool === 'shape_circle') {
                    this.drawingShapeType = this.tool; this.shapeStartPos = snapPos;
                    if (this.tool === 'shape_rect') { this.shapePreviewRect.position(snapPos); this.shapePreviewRect.width(0); this.shapePreviewRect.height(0); this.shapePreviewRect.visible(true); }
                    else if (this.tool === 'shape_circle') { this.shapePreviewCircle.position(snapPos); this.shapePreviewCircle.radius(0); this.shapePreviewCircle.visible(true); }
                    this.uiLayer.batchDraw();
                } else if (this.tool === 'shape_triangle') {
                    if (!this.drawingTriangle) { this.drawingTriangle = [snapPos]; }
                    else {
                        this.drawingTriangle.push(snapPos);
                        if (this.drawingTriangle.length === 3) { const newShape = new PremiumShape(this, 'shape_triangle', { points: [...this.drawingTriangle] }); if(!this.shapes) this.shapes = []; this.shapes.push(newShape); this.drawingTriangle = null; this.shapePreviewTriangle.visible(false); this.tool = 'select'; this.updateToolStates(); if (this.onToolChange) this.onToolChange('select'); this.selectEntity(newShape, 'shape'); this.syncAll(); }
                    }
                }
                return;
            }
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
            else { 
                let reachedArcEnd = false;
                let sharedArc = null;
                if (this.lastAnchor !== currentAnchor) { 
                    sharedArc = (this.arcs || []).find(arc => {
                        let arcNodes = [arc.p1, ...arc.intermediateAnchors, arc.p2];
                        return arcNodes.includes(this.lastAnchor) && arcNodes.includes(currentAnchor);
                    });
                    
                    if (sharedArc) {
                        let arcNodes = [sharedArc.p1, ...sharedArc.intermediateAnchors, sharedArc.p2];
                        let i1 = arcNodes.indexOf(this.lastAnchor);
                        let i2 = arcNodes.indexOf(currentAnchor);
                        let step = i1 < i2 ? 1 : -1;
                        
                        let prev = arcNodes[i1];
                        for(let i = i1 + step; i !== i2 + step; i += step) {
                            let curr = arcNodes[i];
                            let w;
                            if (this.tool === 'railing') {
                                w = new PremiumRailing(this, prev, curr);
                                w.parentArc = sharedArc;
                                w.labelGroup.visible(false);
                                w.poly.off('mousedown touchstart');
                                w.poly.on('mousedown touchstart', (e) => { 
                                    if (this.tool === 'select') { 
                                        e.cancelBubble = true; 
                                        this.selectEntity(w, 'wall'); 
                                    } 
                                });
                                w.poly.draggable(false); 
                                w.poly.on('dragstart dragmove dragend', (e) => e.cancelBubble = true);
                            } else {
                                w = new PremiumWall(this, prev, curr, this.tool);
                            }
                            this.walls.push(w);
                            prev = curr;
                        }
                        
                        if (i2 === 0 || i2 === arcNodes.length - 1) reachedArcEnd = true;
                        if (this.tool === 'railing' && ((i1 === 0 && i2 === arcNodes.length - 1) || (i2 === 0 && i1 === arcNodes.length - 1))) {
                            sharedArc.hasRailing = true;
                        }
                    } else {
                        if (this.tool === 'railing') {
                            this.walls.push(new PremiumRailing(this, this.lastAnchor, currentAnchor));
                        } else {
                            this.walls.push(new PremiumWall(this, this.lastAnchor, currentAnchor, this.tool)); 
                        }
                    }
                } 
                if (currentAnchor === this.startAnchor || reachedArcEnd) { 
                    this.finishChain(); 
                    if (reachedArcEnd && this.tool === 'railing') {
                        this.tool = 'select'; this.updateToolStates();
                        if (this.onToolChange) this.onToolChange('select');
                        
                        if (sharedArc) {
                            const attachedRailing = this.walls.filter(w => w.type === 'railing' && w.parentArc === sharedArc);
                            if (attachedRailing.length > 0) {
                                this.selectEntity(attachedRailing[0], 'wall');
                            }
                        }
                    }
                } else { this.lastAnchor = currentAnchor; currentAnchor.show(); } 
            } 
            this.syncAll(); 
        }); 

        this.stage.on("mousemove touchmove", (e) => { 
            if (this.tool === 'roof') return;

            if (e.target === this.stage || e.target === this.bgLayer || e.target === this.mainLayer) {
                document.body.style.cursor = ''; 
                this.stage.container().style.cursor = this.tool === 'select' ? (this.stage.isDragging() ? 'grabbing' : 'grab') : 'crosshair';
            }

            const pos = this.getPointerPos();
            if (!pos) return;
            
            let rawPos = { x: this.snap(pos.x), y: this.snap(pos.y) }; 
            
            if (this.drawingStair) { this.drawingStair.updateLastPoint(rawPos.x, rawPos.y); return; }
            
            if (this.drawingShapeType === 'shape_rect' && this.shapeStartPos) {
                const w = pos.x - this.shapeStartPos.x; const h = pos.y - this.shapeStartPos.y;
                this.shapePreviewRect.width(w); this.shapePreviewRect.height(h);
                this.updateInfoBadge(pos.x, pos.y + 30, `W: ${this.formatLength(Math.abs(w))}\nH: ${this.formatLength(Math.abs(h))}`, "", false);
                this.uiLayer.batchDraw(); return;
            } else if (this.drawingShapeType === 'shape_circle' && this.shapeStartPos) {
                const r = Math.hypot(pos.x - this.shapeStartPos.x, pos.y - this.shapeStartPos.y);
                this.shapePreviewCircle.radius(r);
                this.updateInfoBadge(pos.x, pos.y + 30, `R: ${this.formatLength(r)}`, "", false);
                this.uiLayer.batchDraw(); return;
            } else if (this.tool === 'shape_triangle' && this.drawingTriangle) {
                const pts = this.drawingTriangle.flatMap(p => [p.x, p.y]); pts.push(pos.x, pos.y);
                this.shapePreviewTriangle.points(pts); this.shapePreviewTriangle.visible(true);
                this.updateInfoBadge(pos.x, pos.y + 30, `Point ${this.drawingTriangle.length + 1}`, "", false);
                this.uiLayer.batchDraw(); return;
            }

            if (this.tool === 'split') {
                const hitThreshold = 20 / (this.stage.scaleX() || 1);
                let foundGlow = false;
                for (let w of this.walls) {
                    if (!WALL_REGISTRY[w.type] || !WALL_REGISTRY[w.type].events.includes('split_edge')) continue;
                    const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                    const proj = this.getClosestPointOnSegment(pos, p1, p2);
                    if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < hitThreshold) {
                        this.splitPreviewGlow.position(proj); this.splitPreviewGlow.show();
                        foundGlow = true; break;
                    }
                }
                if (!foundGlow && this.balconies) {
                    for (let b of this.balconies) {
                        if (!WIDGET_REGISTRY['balcony'] || !WIDGET_REGISTRY['balcony'].events.includes('split_edge')) continue;
                        const pts = b.vertices || b.points; if (!pts || pts.length < 3) continue;
                        const transform = b.group.getTransform();
                        for (let i = 0; i < pts.length; i++) {
                            const p1 = transform.point(pts[i]); const p2 = transform.point(pts[(i + 1) % pts.length]);
                            const proj = this.getClosestPointOnSegment(pos, p1, p2);
                            if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < hitThreshold) { this.splitPreviewGlow.position(proj); this.splitPreviewGlow.show(); foundGlow = true; break; }
                        }
                    }
                }
                if (!foundGlow && this.shapes) {
                    for (let s of this.shapes) {
                        if (s.type !== 'shape_rect' && s.type !== 'shape_polygon') continue;
                        let pts = []; if (s.type === 'shape_rect') { const w = s.params.width; const h = s.params.height; pts = [ {x: -w/2, y: -h/2}, {x: w/2, y: -h/2}, {x: w/2, y: h/2}, {x: -w/2, y: h/2} ]; } else { pts = s.params.points; }
                        const transform = s.group.getTransform();
                        for (let i = 0; i < pts.length; i++) {
                            const p1 = transform.point(pts[i]); const p2 = transform.point(pts[(i + 1) % pts.length]); const proj = this.getClosestPointOnSegment(pos, p1, p2);
                            if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < hitThreshold) { this.splitPreviewGlow.position(proj); this.splitPreviewGlow.show(); foundGlow = true; break; }
                        }
                    }
                }
                if (!foundGlow && this.splitPreviewGlow) this.splitPreviewGlow.hide(); this.uiLayer.batchDraw(); return;
            } else { if (this.splitPreviewGlow) this.splitPreviewGlow.hide(); }

            if (this.tool === 'arc') {
                let snap = rawPos;
                let closestDist = SNAP_DIST;
                let snappedObj = false;
                let targetSnapWall = null;

                let snappedToAxis = false;
                if (this.drawingArc && this.drawingArc.state === 1) {
                    const p1 = this.drawingArc.p1;
                    let dxAxis = rawPos.x - p1.x, dyAxis = rawPos.y - p1.y;
                    let rawAngle = Math.atan2(dyAxis, dxAxis) * 180 / Math.PI;
                    let distAxis = Math.hypot(dxAxis, dyAxis);
                    for (let a of [0, 45, 90, 135, 180, -45, -90, -135, -180]) {
                        if (Math.abs(rawAngle - a) < 5) { 
                            let rad = a * Math.PI / 180; 
                            rawPos.x = p1.x + distAxis * Math.cos(rad); 
                            rawPos.y = p1.y + distAxis * Math.sin(rad); 
                            snappedToAxis = true; 
                            this.drawGuideLine(p1.x, p1.y, rawPos.x, rawPos.y, true); 
                            break; 
                        }
                    }
                    if (!snappedToAxis) this.drawGuideLine(0,0,0,0, false);
                    snap = rawPos;
                }

                let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < closestDist);
                if (a) { snap = { x: a.x, y: a.y }; closestDist = Math.hypot(a.x - pos.x, a.y - pos.y); snappedObj = true; }

                for (let w of this.walls) {
                    let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                    let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    if (dist < closestDist) { closestDist = dist; snap = proj; snappedObj = true; targetSnapWall = w; }
                }

                if (snappedObj && (!this.drawingArc || this.drawingArc.state === 1)) {
                    this.showSnapGlow(snap.x, snap.y);
                } else {
                    this.hideSnapGlow();
                }
                
                this.walls.forEach(w => w.setHighlight(w === targetSnapWall || w === this.selectedEntity));
                
                this.arcMousePos = (this.drawingArc && this.drawingArc.state === 2) ? pos : snap;
                
                if (this.drawingArc && this.arcPreview) {
                    if (this.drawingArc.state === 1) {
                        this.arcPreview.lineBase.points([this.drawingArc.p1.x, this.drawingArc.p1.y, snap.x, snap.y]);
                        this.arcPreview.lineBase.visible(true);
                        this.arcPreview.ghostCircle.visible(false);
                        this.arcPreview.angleFill.visible(false);
                        this.arcPreview.radiusLines.visible(false);
                        this.arcPreview.guideLine.visible(false);
                        this.arcPreview.arcCurve.visible(false);
                        this.arcPreview.dragDot.visible(false);
                        
                        let dxBadge = snap.x - this.drawingArc.p1.x, dyBadge = snap.y - this.drawingArc.p1.y;
                        let lenBadge = this.formatLength(Math.hypot(dxBadge, dyBadge));
                        let angBadge = Math.abs(Math.atan2(dyBadge, dxBadge) * 180 / Math.PI).toFixed(1);
                        this.updateInfoBadge(snap.x, snap.y, lenBadge, angBadge, snappedObj);
                    } else if (this.drawingArc.state === 2) {
                        const p1 = this.drawingArc.p1, p2 = this.drawingArc.p2, posCurve = this.arcMousePos;
                        const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
                        if (L >= 0.5) {
                            const mid = { x: p1.x + dx/2, y: p1.y + dy/2 }, n = { x: -dy/L, y: dx/L };
                            let h = (posCurve.x - mid.x)*n.x + (posCurve.y - mid.y)*n.y;
                            if (Math.abs(Math.abs(h) - L/2) < SNAP_DIST) { h = Math.sign(h) * (L/2); }
                            if (Math.abs(h) < 0.1) h = Math.sign(h) * 0.1 || 0.1;
                            
                            const R = Math.abs(h/2 + (L*L)/(8*h)), dC = (L*L)/(8*h) - h/2;
                            const center = { x: mid.x - n.x * dC, y: mid.y - n.y * dC };
                            const sAng = Math.atan2(p1.y - center.y, p1.x - center.x), eAng = Math.atan2(p2.y - center.y, p2.x - center.x), ccw = h < 0;
                            
                            this.arcPreview.lineBase.points([p1.x, p1.y, p2.x, p2.y]);
                            this.arcPreview.lineBase.visible(true);
                            this.arcPreview.ghostCircle.setAttrs({ x: center.x, y: center.y, radius: R, visible: true });
                            this.arcPreview.arcCurve.sceneFunc((ctx, shape) => { ctx.beginPath(); ctx.arc(center.x, center.y, R, sAng, eAng, ccw); ctx.strokeShape(shape); });
                            this.arcPreview.arcCurve.visible(true);
                            this.arcPreview.radiusLines.points([p1.x, p1.y, center.x, center.y, p2.x, p2.y]);
                            this.arcPreview.radiusLines.visible(true);
                            const curveMidX = mid.x + n.x * h, curveMidY = mid.y + n.y * h;
                            this.arcPreview.guideLine.points([mid.x, mid.y, curveMidX, curveMidY]);
                            this.arcPreview.guideLine.visible(true);
                            this.arcPreview.dragDot.position({ x: curveMidX, y: curveMidY });
                            this.arcPreview.dragDot.visible(true);
                            
                            this.updateInfoBadge(posCurve.x, posCurve.y + 30, "Move mouse to form curve", "", false);
                        }
                    }
                    this.uiLayer.batchDraw();
                }
                
                document.body.style.cursor = 'crosshair';
                return;
            }
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

            this.walls.forEach(w => {
                let isHigh = (w === this.selectedEntity);
                if (!isHigh && w === targetSnapWall) {
                    isHigh = true;
                }
                w.setHighlight(isHigh);
            });

            if (!this.drawing) {
                this.uiLayer.batchDraw();
                return;
            }

            let isColliding = false; 
            if (wallConfig && (wallConfig.events.includes("collision_detected") || wallConfig.events.includes("stop_collision"))) { isColliding = this.checkWallIntersection(this.lastAnchor.position(), snapPos, [targetSnapWall]); } 
            
            this.preview?.destroy(); 
            const isClosing = (this.startAnchor && Math.hypot(this.startAnchor.x - snapPos.x, this.startAnchor.y - snapPos.y) < 15); 
            let drawColor = (isColliding && wallConfig && wallConfig.events.includes("stop_collision")) ? "#ef4444" : (isClosing ? "#10b981" : "#3b82f6"); 
            
            let previewPoints = [this.lastAnchor.x, this.lastAnchor.y, snapPos.x, snapPos.y];
            if (!isColliding && this.drawing && (this.tool === 'railing' || this.tool === 'outer' || this.tool === 'inner')) {
                let a2 = this.anchors.find(a => Math.hypot(a.x - snapPos.x, a.y - snapPos.y) < 1);
                if (a2) {
                    let sharedArc = (this.arcs || []).find(arc => {
                        let arcNodes = [arc.p1, ...arc.intermediateAnchors, arc.p2];
                        return arcNodes.includes(this.lastAnchor) && arcNodes.includes(a2);
                    });
                    if (sharedArc) {
                        let arcNodes = [sharedArc.p1, ...sharedArc.intermediateAnchors, sharedArc.p2];
                        let i1 = arcNodes.indexOf(this.lastAnchor);
                        let i2 = arcNodes.indexOf(a2);
                        let step = i1 < i2 ? 1 : -1;
                        previewPoints = [];
                        for(let i = i1; i !== i2 + step; i += step) previewPoints.push(arcNodes[i].x, arcNodes[i].y);
                    }
                }
            }
            
            this.preview = new Konva.Line({ points: previewPoints, stroke: drawColor, strokeWidth: 2, opacity: 0.8 }); 
            this.uiLayer.add(this.preview); 
            this.preview.moveToBottom();
            
            this.uiLayer.batchDraw(); 
        }); 

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.finishChain();
        });

        this.stage.on('mouseup touchend', (e) => {
            if (this.drawingShapeType) {
                if (this.drawingShapeType === 'shape_rect') {
                    const w = this.shapePreviewRect.width(); const h = this.shapePreviewRect.height();
                    if (Math.abs(w) > 5 && Math.abs(h) > 5) {
                        const cx = this.shapeStartPos.x + w / 2; const cy = this.shapeStartPos.y + h / 2;
                        const newShape = new PremiumShape(this, 'shape_rect', { x: cx, y: cy, width: Math.abs(w), height: Math.abs(h) });
                        if(!this.shapes) this.shapes = []; this.shapes.push(newShape); this.tool = 'select'; this.updateToolStates(); if (this.onToolChange) this.onToolChange('select'); this.selectEntity(newShape, 'shape');
                    }
                    this.shapePreviewRect.visible(false);
                } else if (this.drawingShapeType === 'shape_circle') {
                    const r = this.shapePreviewCircle.radius();
                    if (r > 5) {
                        const newShape = new PremiumShape(this, 'shape_circle', { x: this.shapeStartPos.x, y: this.shapeStartPos.y, radius: r });
                        if(!this.shapes) this.shapes = []; this.shapes.push(newShape); this.tool = 'select'; this.updateToolStates(); if (this.onToolChange) this.onToolChange('select'); this.selectEntity(newShape, 'shape');
                    }
                    this.shapePreviewCircle.visible(false);
                }
                this.drawingShapeType = null; this.shapeStartPos = null; this.hideInfoBadge(); this.uiLayer.batchDraw(); this.syncAll();
            }
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
            const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (len < 0.5) return false;
            const crossProduct = (p.y - p1.y) * (p2.x - p1.x) - (p.x - p1.x) * (p2.y - p1.y);
            const dist = Math.abs(crossProduct) / len;
            if (dist > 0.5) return false; // Tighten cross-axis tolerance
            const dotProduct = (p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y);
            if (dotProduct < 0.1 || dotProduct > len * len - 0.1) return false; // Strictly inside endpoints
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
            
            const uniquePoints = [p1];
            pointsOnWall.forEach(pt => {
                const last = uniquePoints[uniquePoints.length - 1];
                if (Math.hypot(pt.x - last.x, pt.y - last.y) > 0.5) {
                    uniquePoints.push(pt);
                }
            });
            
            if (Math.hypot(p2.x - uniquePoints[uniquePoints.length - 1].x, p2.y - uniquePoints[uniquePoints.length - 1].y) > 0.5) {
                uniquePoints.push(p2);
            } else {
                uniquePoints[uniquePoints.length - 1] = p2;
            }

            for (let i = 0; i < uniquePoints.length - 1; i++) {
                edges.push({ from: uniquePoints[i], to: uniquePoints[i+1], wall: w });
                edges.push({ from: uniquePoints[i+1], to: uniquePoints[i], wall: w });
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
                // Reject mathematically impossible slivers and the infinite outer boundary
                if (area < -50) {
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
        if (this.arcs) [...this.arcs].forEach(a => a.remove());
        if (this.shapes) [...this.shapes].forEach(s => s.remove());
        if (this.shapeTransformer) this.shapeTransformer.nodes([]);
        this.walls = []; this.furniture = []; this.stairs = []; this.roofs = []; this.balconies = []; this.arcs = []; this.shapes = []; this.roomPaths = [];
        this.anchors.forEach(a => { if(a.node) a.node.destroy(); }); this.anchors = [];
        if (this.wallLayer) this.wallLayer.destroyChildren(); if (this.furnitureLayer) this.furnitureLayer.destroyChildren(); if (this.widgetLayer) this.widgetLayer.destroyChildren(); if (this.roofLayer) this.roofLayer.destroyChildren();
        if (this.mainLayer) this.mainLayer.batchDraw();
        this.selectEntity(null);
    }

    exportState() {
        const standardWalls = this.walls.filter(w => !w.parentArc);
        const state = {
            walls: standardWalls.map(w => ({
                startX: w.startAnchor.x, startY: w.startAnchor.y, endX: w.endAnchor.x, endY: w.endAnchor.y, thickness: w.thickness || w.config.thickness, height: w.height !== undefined ? w.height : (w.config?.height || 120), type: w.type, configId: w.configId,
                pts: w.poly ? w.poly.points() : null,
                widgets: w.attachedWidgets.map(wid => ({ t: wid.t, configId: wid.type, width: wid.width })),
                decors: w.attachedDecor ? w.attachedDecor.map(d => ({ id: d.id, configId: d.configId, side: d.side, localX: d.localX, localY: d.localY, localZ: d.localZ, width: d.width, height: d.height, depth: d.depth, tileSize: d.tileSize, faces: { front: d.faces.front, back: d.faces.back, left: d.faces.left, right: d.faces.right } })) : []
            })),
            furniture: this.furniture.map(f => ({ x: f.group.x(), y: f.group.y(), rotation: f.rotation, width: f.width, depth: f.depth, height: f.height, configId: f.config.id })),
            stairs: this.stairs.map(s => ({ path: s.path.map(p => ({ x: p.x, y: p.y, shape: p.shape })) })),
            roofs: this.roofs.map(r => ({ x: r.group.x(), y: r.group.y(), rotation: r.rotation, width: r.config?.width, depth: r.config?.depth, pitch: r.config?.pitch, overhang: r.config?.overhang, thickness: r.config?.thickness, ridgeOffset: r.config?.ridgeOffset, points: r.points, isHip: !!r.points, roofType: r.config?.roofType, material: r.config?.material, wallGap: r.config?.wallGap })),
            arcs: this.arcs ? this.arcs.map(a => ({ p1: {x: a.p1.x, y: a.p1.y}, p2: {x: a.p2.x, y: a.p2.y}, pos: a.pos, hasRailing: a.hasRailing, railingConfig: a.railingConfig })) : [],
            shapes: this.shapes ? this.shapes.map(s => ({ type: s.type, x: s.group.x(), y: s.group.y(), rotation: s.rotation, scaleX: s.group.scaleX(), scaleY: s.group.scaleY(), params: s.params })) : [],
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
                    if (wData.configId) wall.configId = wData.configId;
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
            if (state.arcs) {
                if (!this.arcs) this.arcs = [];
                state.arcs.forEach(aData => {
                    const a1 = this.getOrCreateAnchor(aData.p1.x, aData.p1.y);
                    const a2 = this.getOrCreateAnchor(aData.p2.x, aData.p2.y);
                    const arc = new PremiumArc(this, a1, a2, aData.pos);
                    if (aData.hasRailing) {
                        arc.hasRailing = true;
                        if (aData.railingConfig) arc.railingConfig = aData.railingConfig;
                        arc.rebuild();
                    }
                    this.arcs.push(arc);
                });
            }
            if (state.shapes) {
                if (!this.shapes) this.shapes = [];
                state.shapes.forEach(sData => {
                    const shape = new PremiumShape(this, sData.type, sData.params);
                    shape.group.position({ x: sData.x, y: sData.y });
                    shape.rotation = sData.rotation;
                    shape.group.scale({ x: sData.scaleX || 1, y: sData.scaleY || 1 });
                    shape.update(); this.shapes.push(shape);
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
import Konva from 'konva';
import { SNAP_DIST } from '../registry.js';

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
        
        // Ensure newly drawn polygons have their group centered and points relative
        // This prevents wild erratic movement when dragging a freshly drawn prism
        if (this.type === 'shape_polygon' && this.params.points && this.params.x === undefined && this.params.y === undefined) {
            let cx = 0, cy = 0;
            this.params.points.forEach(p => { cx += p.x; cy += p.y; });
            cx /= this.params.points.length;
            cy /= this.params.points.length;
            this.params.x = cx;
            this.params.y = cy;
            this.params.points = this.params.points.map(p => ({ x: p.x - cx, y: p.y - cy }));
        }

        this.group = new Konva.Group({
            x: this.params.x || 0,
            y: this.params.y || 0,
            rotation: this.rotation,
            draggable: true
        });

        const shapeConfig = {
            fill: this.params.fill,
            stroke: this.params.stroke,
            strokeWidth: 8,
            lineJoin: 'miter',
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

        this.attachedWall = null;
        this.isDragging = false;

        this.attachmentArrow = new Konva.Arrow({
            points: [0, 15, 0, -5],
            pointerLength: 8,
            pointerWidth: 8,
            fill: '#f59e0b',
            stroke: '#f59e0b',
            strokeWidth: 3,
            visible: false,
            name: 'attachment-arrow'
        });

        this.group.add(this.shape);
        this.group.add(this.attachmentArrow);
        if (this.planner.baseLayer) {
            this.planner.baseLayer.add(this.group);
        } else {
            this.planner.furnitureLayer.add(this.group);
        }
        
        this.group.on('mouseenter', () => { if (this.planner.tool === 'select') document.body.style.cursor = 'move'; });
        this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        this.group.on('mousedown touchstart', (e) => { 
            this.group.moveToTop();
            if (this.planner.tool === 'split') {
                e.cancelBubble = true; 
                if (e.evt) e.evt.stopPropagation();
                const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
                this.convertToPolygon(pos);
            } else if (this.planner.tool === 'select') {
                e.cancelBubble = true; 
                if (e.evt) e.evt.stopPropagation();
                this.planner.selectEntity(this, 'shape'); 
            }
        });
        this.group.on('dragmove', (e) => {
            if (e.target !== this.group) { this.planner.syncAll(); return; }
            const pointer = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
            const rawCenter = { x: pointer.x + (this.dragOffset ? this.dragOffset.x : 0), y: pointer.y + (this.dragOffset ? this.dragOffset.y : 0) };
            const center = rawCenter;
            let minDist = 40; 
            let targetWall = null;
            let finalSnapDist = 0;
            
            const checkWall = (w) => {
                const wallP1 = w.startAnchor.position();
                const wallP2 = w.endAnchor.position();
                const proj = this.planner.getClosestPointOnSegment(center, wallP1, wallP2);
                const dist = Math.hypot(center.x - proj.x, center.y - proj.y);
                
                let outNorm = { ...this.planner.getOutwardNormal(w) };
                const toCenterX = center.x - proj.x; const toCenterY = center.y - proj.y;
                if (toCenterX * outNorm.x + toCenterY * outNorm.y < 0) { outNorm.x *= -1; outNorm.y *= -1; }
                
                let currentSnapDist = 0;
                if (this.type === 'shape_rect') {
                    const normAngle = Math.atan2(outNorm.y, outNorm.x);
                    const shapeAngle = this.rotation * Math.PI / 180;
                    const theta = shapeAngle - normAngle;
                    currentSnapDist = (this.params.width / 2) * Math.abs(Math.cos(theta)) + (this.params.height / 2) * Math.abs(Math.sin(theta));
                } else if (this.type === 'shape_circle') { 
                    currentSnapDist = this.params.radius; 
                } else if (this.type === 'shape_polygon') { 
                    if (this.params.points && this.params.points.length > 0) {
                        let maxDist = 0;
                        const rad = this.rotation * Math.PI / 180;
                        const cos = Math.cos(rad), sin = Math.sin(rad);
                        for (let p of this.params.points) {
                            const rx = p.x * cos - p.y * sin;
                            const ry = p.x * sin + p.y * cos;
                            const projDist = -(rx * outNorm.x + ry * outNorm.y);
                            if (projDist > maxDist) maxDist = projDist;
                        }
                        currentSnapDist = maxDist;
                    } else {
                        currentSnapDist = 20; 
                    }
                }
                
                currentSnapDist += 5; // Account for visual stroke widths (shape stroke=4px outer, wall stroke=1px outer)
                
                const surfaceDist = Math.max(0, dist - currentSnapDist);
                return { surfaceDist, currentSnapDist };
            };
            
            if (this.attachedWall) {
                const res = checkWall(this.attachedWall);
                if (res.surfaceDist < 40) { // Keep attached unless dragged fully away
                    minDist = res.surfaceDist;
                    targetWall = this.attachedWall;
                    finalSnapDist = res.currentSnapDist;
                } else {
                    this.attachedWall = null;
                }
            }
            
            if (!this.attachedWall) {
                this.planner.walls.forEach(w => {
                    const res = checkWall(w);
                    if (res.surfaceDist < minDist) { minDist = res.surfaceDist; targetWall = w; finalSnapDist = res.currentSnapDist; }
                });
            }

            if (targetWall) {
                let outNorm = { ...this.planner.getOutwardNormal(targetWall) };
                const wallP1 = targetWall.startAnchor.position();
                const wallP2 = targetWall.endAnchor.position();
                const proj = this.planner.getClosestPointOnSegment(center, wallP1, wallP2);
                const toCenterX = center.x - proj.x; const toCenterY = center.y - proj.y;
                if (toCenterX * outNorm.x + toCenterY * outNorm.y < 0) { outNorm.x *= -1; outNorm.y *= -1; }
                
                if (finalSnapDist > 0 && minDist < 15) {
                    const ht = targetWall.thickness ? targetWall.thickness / 2 : (targetWall.config ? targetWall.config.thickness / 2 : 4);
                    
                    this.group.position({ x: proj.x + outNorm.x * (ht + finalSnapDist), y: proj.y + outNorm.y * (ht + finalSnapDist) });
                } else {
                    this.group.position(rawCenter);
                }
                
                this.attachedWall = targetWall;
                this.planner.wallHighlight.points([wallP1.x, wallP1.y, wallP2.x, wallP2.y]).show();
                this.shape.stroke('#f59e0b');

                const arrowRotation = Math.atan2(outNorm.y, outNorm.x) * 180 / Math.PI + 90;
                this.attachmentArrow.rotation(arrowRotation - this.rotation); // Relative to group rotation
                this.attachmentArrow.fill('#f59e0b');
                this.attachmentArrow.stroke('#f59e0b');
                this.attachmentArrow.visible(true);
            } else {
                this.attachedWall = null;
                this.planner.wallHighlight.hide();
                this.shape.stroke(this.params.stroke);
                this.attachmentArrow.visible(false);
                this.group.position(rawCenter);
            }
            this.update();
            this.planner.syncAll();
        });
        this.group.on('dragstart', (e) => {
            this.isDragging = true;

            if (this.planner.shapeTransformer) {
                this.planner.shapeTransformer.visible(false);
            }
            if (this.handlesGroup) {
                this.handlesGroup.visible(false);
            }

            const pointer = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
            const pos = this.group.position();
            this.dragOffset = { x: pos.x - pointer.x, y: pos.y - pointer.y };

            if (this.planner.roofLayer) {
                this.group.moveTo(this.planner.roofLayer);
                this.planner.mainLayer.batchDraw();
            }
            this.update();
        });
        this.group.on('dragend', (e) => {
            this.isDragging = false;

            if (this.planner.shapeTransformer && this.planner.selectedEntity === this) {
                this.planner.shapeTransformer.visible(true);
            }
            if (this.handlesGroup && this.planner.selectedEntity === this) {
                this.handlesGroup.visible(true);
            }

            this.planner.wallHighlight.hide();
            
            if (this.attachedWall) {
                this.attachmentArrow.fill('#10b981');
                this.attachmentArrow.stroke('#10b981');
                this.attachmentArrow.visible(true);
            } else {
                this.attachmentArrow.visible(false);
            }

            if (this.planner.baseLayer) {
                this.group.moveTo(this.planner.baseLayer);
            } else {
                this.group.moveTo(this.planner.furnitureLayer);
            }
            this.update();
            this.planner.mainLayer.batchDraw();
        });
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
            }
            if (this.planner.smartGuides) {
                this.planner.smartGuides.clear();
            }
            this.planner.uiLayer.batchDraw();
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
        const shapeConfig = { fill: this.params.fill, stroke: this.params.stroke, strokeWidth: 8, lineJoin: 'miter', shadowColor: 'black', shadowBlur: 10, shadowOffset: {x: 2, y: 2}, shadowOpacity: 0.2, closed: true };
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

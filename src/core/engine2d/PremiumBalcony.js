import Konva from 'konva';

export class PremiumBalcony {
    constructor(planner, x, y, shape = 'rectangular') {
        this.planner = planner;
        this.type = 'balcony';
        this.shape = shape;
        this.attachedWall = null;
        this.attachedEdge = null;
        this.config = { balconyType: shape };

        const initialWidth = 150;
        const initialDepth = 80;
        this.vertices = [
            { x: x - initialWidth / 2, y: y },
            { x: x + initialWidth / 2, y: y },
            { x: x + initialWidth / 2, y: y + initialDepth },
            { x: x - initialWidth / 2, y: y + initialDepth },
        ];

        this.group = new Konva.Group({ draggable: true });
        this.polygon = new Konva.Line({
            fill: 'rgba(59, 130, 246, 0.15)',
            stroke: '#9ca3af',
            strokeWidth: 2,
            closed: true,
            lineJoin: 'round',
            shadowColor: 'black', shadowBlur: 0, shadowOpacity: 0, shadowOffset: { x: 2, y: 2 }
        });

        this.handles = [];
        this.edgeHandles = [];

        // Add Rotation Symbol at the center
        this.rotater = new Konva.Group({ draggable: true, visible: false });
        this.rotater.add(new Konva.Circle({
            radius: 14, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2,
            shadowColor: 'black', shadowBlur: 4, shadowOpacity: 0.3
        }));
        this.rotater.add(new Konva.Text({
            text: '↻', fontSize: 18, fill: 'white', x: -9, y: -8, fontStyle: 'bold'
        }));

        this.attachmentArrow = new Konva.Arrow({
            points: [0, 5, 0, -15],
            pointerLength: 8,
            pointerWidth: 8,
            fill: '#f59e0b',
            stroke: '#f59e0b',
            strokeWidth: 3,
            visible: false
        });

        let startAngle = 0;
        let initialVertices = null;
        this.rotater.on('dragstart', (e) => {
            e.cancelBubble = true;
            const center = this.getCenter();
            const pos = this.planner.stage.getPointerPosition();
            startAngle = Math.atan2(pos.y - center.y, pos.x - center.x);
            initialVertices = this.vertices.map(v => ({ ...v }));
            this.attachedWall = null; // Detach from wall on manual rotation
            this.attachedEdge = null;
        });

        this.rotater.on('dragmove', (e) => {
            e.cancelBubble = true;
            const center = this.getCenter();
            this.rotater.position(center); // visually lock to center
            
            const pos = this.planner.stage.getPointerPosition();
            const currentAngle = Math.atan2(pos.y - center.y, pos.x - center.x);
            const deltaAngle = currentAngle - startAngle;
            
            this.vertices = initialVertices.map(v => {
                const dx = v.x - center.x;
                const dy = v.y - center.y;
                return {
                    x: center.x + dx * Math.cos(deltaAngle) - dy * Math.sin(deltaAngle),
                    y: center.y + dx * Math.sin(deltaAngle) + dy * Math.cos(deltaAngle)
                };
            });
            this.update();
            this.planner.mainLayer.batchDraw();
            this.planner.uiLayer.batchDraw();
        });

        this.rotater.on('dragend', (e) => {
            e.cancelBubble = true;
            this.planner.syncAll();
        });

        this.rotater.on('mouseenter', () => document.body.style.cursor = 'grab');
        this.rotater.on('mouseleave', () => document.body.style.cursor = 'default');
        this.rotater.on('mousedown', () => document.body.style.cursor = 'grabbing');
        this.rotater.on('mouseup', () => document.body.style.cursor = 'grab');

        this.group.add(this.polygon, this.rotater, this.attachmentArrow);
        this.planner.widgetLayer.add(this.group);

        this.rebuildHandles();
        this.initEvents();
        this.update();
    }

    get points() { return this.vertices; }
    set points(val) { this.vertices = val; }

    splitEdge(index, exactPoint) {
        const p1 = this.vertices[index];
        const p2 = this.vertices[(index + 1) % this.vertices.length];
        const insertPt = exactPoint || { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        this.vertices.splice(index + 1, 0, insertPt);
        this.rebuildHandles();
        this.update();
        this.planner.syncAll();
    }

    rebuildHandles() {
        if (this.handles) this.handles.forEach(h => h.destroy());
        if (this.edgeHandles) this.edgeHandles.forEach(h => h.destroy());

        const isActive = this.planner.selectedEntity === this;

        this.handles = this.vertices.map((v, i) => {
            const handle = new Konva.Circle({
                x: v.x, y: v.y,
                radius: 6, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2,
                shadowColor: 'black', shadowBlur: 4, shadowOpacity: 0.3,
                draggable: true, visible: isActive
            });
            handle.on('dragmove', (e) => this.onVertexDrag(i, e));
            handle.on('dragstart', (e) => e.cancelBubble = true);
            handle.on('dragend', (e) => { e.cancelBubble = true; this.planner.drawGuideLine(0, 0, 0, 0, false); this.planner.syncAll(); });
            handle.on('mouseenter', () => document.body.style.cursor = 'crosshair');
            handle.on('mouseleave', () => document.body.style.cursor = 'default');
            this.group.add(handle);
            return handle;
        });

        this.edgeHandles = [];
        for (let i = 0; i < this.vertices.length; i++) {
            const edgeHandle = new Konva.Circle({
                radius: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2,
                draggable: true, visible: isActive, name: 'edge-handle'
            });
            
            edgeHandle.on('dragstart', (e) => { e.cancelBubble = true; });
            edgeHandle.on('dragmove', (e) => {
                e.cancelBubble = true;
                const mousePos = this.planner.stage.getPointerPosition();
                const transform = this.group.getAbsoluteTransform().copy().invert();
                const localMousePos = transform.point(mousePos);
                const p1 = this.vertices[i];
                const p2 = this.vertices[(i + 1) % this.vertices.length];
                const edgeDx = p2.x - p1.x; const edgeDy = p2.y - p1.y;
                const len = Math.hypot(edgeDx, edgeDy);
                if (len === 0) return;
                const nx = -edgeDy / len; const ny = edgeDx / len;
                const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2;
                const dragVecX = localMousePos.x - midX; const dragVecY = localMousePos.y - midY;
                const dot = dragVecX * nx + dragVecY * ny;
                const shiftX = nx * dot; const shiftY = ny * dot;
                this.vertices[i].x += shiftX; this.vertices[i].y += shiftY;
                this.vertices[(i + 1) % this.vertices.length].x += shiftX; this.vertices[(i + 1) % this.vertices.length].y += shiftY;
                this.update();
                this.planner.mainLayer.batchDraw(); this.planner.uiLayer.batchDraw();
            });
            edgeHandle.on('dragend', (e) => { e.cancelBubble = true; this.planner.syncAll(); });
            edgeHandle.on('dblclick', (e) => { e.cancelBubble = true; this.splitEdge(i); });
            edgeHandle.on('mouseenter', () => document.body.style.cursor = 'move');
            edgeHandle.on('mouseleave', () => document.body.style.cursor = 'default');
            
            this.group.add(edgeHandle);
            this.edgeHandles.push(edgeHandle);
        }
        
        if (this.rotater) this.rotater.moveToTop();
        if (this.attachmentArrow) this.attachmentArrow.moveToTop();
    }

    update() {
        const flatPoints = this.vertices.flatMap(v => [v.x, v.y]);
        this.polygon.points(flatPoints);
        this.handles.forEach((h, i) => h.position(this.vertices[i]));
        this.edgeHandles.forEach((h, i) => {
            const p1 = this.vertices[i];
            const p2 = this.vertices[(i + 1) % this.vertices.length];
            h.position({
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2
            });
        });
        if (this.rotater) this.rotater.position(this.getCenter());
    }

    initEvents() {
        this.group.on('mouseenter', () => { if (this.planner.tool === 'select') document.body.style.cursor = 'move'; });
        this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        this.group.on('mousedown', (e) => { if (this.planner.tool !== 'select') return; e.cancelBubble = true; this.planner.selectEntity(this, 'balcony'); });

        this.polygon.on('click tap', (e) => {
            if (this.planner.tool !== 'split') return;
            e.cancelBubble = true;
            const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
            if (!pos) return;

            const pts = this.vertices;
            if (!pts || pts.length < 3) return;

            const transform = this.group.getTransform();
            let bestDist = Infinity;
            let bestEdge = -1;
            let bestProj = null;

            for (let i = 0; i < pts.length; i++) {
                const p1 = transform.point(pts[i]); 
                const p2 = transform.point(pts[(i + 1) % pts.length]);
                const proj = this.planner.getClosestPointOnSegment(pos, p1, p2);
                const dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                if (dist < bestDist) { bestDist = dist; bestEdge = i; bestProj = proj; }
            }

            const hitThreshold = 20 / (this.planner.stage.scaleX() || 1);
            if (bestDist < hitThreshold && bestEdge !== -1) {
                const localProj = transform.copy().invert().point(bestProj);
                this.splitEdge(bestEdge, localProj);
                
                this.planner.tool = 'select';
                this.planner.updateToolStates();
                this.planner.selectEntity(this, 'balcony');
            }
        });

        let startPointer = null;
        let startVertices = null;

        this.group.on('dragstart', (e) => {
            if (e.target !== this.group) return;
            startPointer = this.planner.stage.getPointerPosition();
            startVertices = this.vertices.map(v => ({ ...v }));
        });

        this.group.on('dragmove', (e) => {
            if (e.target !== this.group) return; 
            this.group.position({ x: 0, y: 0 });

            if (!startPointer || !startVertices) return;

            const currentPointer = this.planner.stage.getPointerPosition();
            const deltaX = currentPointer.x - startPointer.x;
            const deltaY = currentPointer.y - startPointer.y;

            // Track "ghost" raw vertices to prevent the cursor from getting permanently stuck to the wall!
            const rawVertices = startVertices.map(v => ({ x: v.x + deltaX, y: v.y + deltaY }));

            let minDist = 60; // Strong magnetic feel
            let targetWall = null;

            let cx = 0, cy = 0;
            rawVertices.forEach(v => { cx += v.x; cy += v.y; });
            const center = { x: cx / rawVertices.length, y: cy / rawVertices.length };

            this.planner.walls.forEach(w => {
                const proj = this.planner.getClosestPointOnSegment(center, w.startAnchor.position(), w.endAnchor.position());
                const dist = Math.hypot(center.x - proj.x, center.y - proj.y);
                const effectiveDist = (this.attachedWall === w) ? dist * 0.5 : dist; // Sticky to current wall
                if (effectiveDist < minDist) { minDist = effectiveDist; targetWall = w; }
            });

            if (targetWall) {
                const outNorm = this.planner.getOutwardNormal(targetWall);
                const ht = targetWall.config.thickness / 2;
                const wallP1 = targetWall.startAnchor.position();
                const wallP2 = targetWall.endAnchor.position();
                const wallDir = { x: wallP2.x - wallP1.x, y: wallP2.y - wallP1.y };
                const wallLen = Math.hypot(wallDir.x, wallDir.y);
                if (wallLen > 0) { wallDir.x /= wallLen; wallDir.y /= wallLen; }

                let edgeI1 = 0, edgeI2 = 1;
                if (this.attachedWall === targetWall && this.attachedEdge) {
                    edgeI1 = this.attachedEdge.i1;
                    edgeI2 = this.attachedEdge.i2;
                } else {
                    let closestEdgeDist = Infinity;
                    for (let i = 0; i < rawVertices.length; i++) {
                        const i2 = (i + 1) % rawVertices.length;
                        const midX = (rawVertices[i].x + rawVertices[i2].x) / 2;
                        const midY = (rawVertices[i].y + rawVertices[i2].y) / 2;
                        const proj = this.planner.getClosestPointOnSegment({ x: midX, y: midY }, wallP1, wallP2);
                        const dist = Math.hypot(midX - proj.x, midY - proj.y);
                        if (dist < closestEdgeDist) { closestEdgeDist = dist; edgeI1 = i; edgeI2 = i2; }
                    }
                    this.attachedEdge = { i1: edgeI1, i2: edgeI2 };
                }

                const pA = rawVertices[edgeI1];
                const pB = rawVertices[edgeI2];
                const edgeAngle = Math.atan2(pB.y - pA.y, pB.x - pA.x);
                const wallAngle = Math.atan2(wallDir.y, wallDir.x);
                let angleDiff = wallAngle - edgeAngle;
                this.rotateAround(center, angleDiff, rawVertices);

                const newEdgeMid = { x: (rawVertices[edgeI1].x + rawVertices[edgeI2].x) / 2, y: (rawVertices[edgeI1].y + rawVertices[edgeI2].y) / 2 };
                const toCenter = { x: center.x - newEdgeMid.x, y: center.y - newEdgeMid.y };
                if (toCenter.x * outNorm.x + toCenter.y * outNorm.y < 0) this.rotateAround(center, Math.PI, rawVertices); 

                const finalEdgeMid = { x: (rawVertices[edgeI1].x + rawVertices[edgeI2].x) / 2, y: (rawVertices[edgeI1].y + rawVertices[edgeI2].y) / 2 };
                const projOnWall = this.planner.getClosestPointOnSegment(finalEdgeMid, wallP1, wallP2);
                const snapPos = { x: projOnWall.x + outNorm.x * ht, y: projOnWall.y + outNorm.y * ht };
                const dx = snapPos.x - finalEdgeMid.x, dy = snapPos.y - finalEdgeMid.y;
                rawVertices.forEach(v => { v.x += dx; v.y += dy; });

                const arrowRotation = Math.atan2(outNorm.y, outNorm.x) * 180 / Math.PI + 90;
                this.attachmentArrow.rotation(arrowRotation);
                this.attachmentArrow.position(finalEdgeMid);
                this.attachmentArrow.visible(true);

                this.attachedWall = targetWall;
                this.planner.wallHighlight.points([wallP1.x, wallP1.y, wallP2.x, wallP2.y]).show();
            } else {
                this.attachedWall = null;
                this.attachedEdge = null;
                this.attachmentArrow.visible(false);
                this.planner.wallHighlight.hide();
            }
            
            this.vertices = rawVertices;
            this.update();
            this.planner.mainLayer.batchDraw();
            this.planner.uiLayer.batchDraw();
        });

        this.group.on('dragend', () => {
            startPointer = null;
            startVertices = null;
            this.attachmentArrow.visible(false);
            this.planner.wallHighlight.hide();
            this.planner.drawGuideLine(0, 0, 0, 0, false);
            this.planner.syncAll();
        });
    }

    onVertexDrag(index, e) {
        e.cancelBubble = true;
        const pos = this.planner.stage.getPointerPosition();
        let snapPos = { x: this.planner.snap(pos.x), y: this.planner.snap(pos.y) };
        let alignLineX = null, alignLineY = null;

        let minDist = 30;
        this.planner.walls.forEach(w => {
            const outNorm = this.planner.getOutwardNormal(w);
            const ht = w.config.thickness / 2;

            [w.startAnchor, w.endAnchor].forEach(anchor => {
                const anchorPos = anchor.position();
                const outerCorner = { x: anchorPos.x + outNorm.x * ht, y: anchorPos.y + outNorm.y * ht };

                if (Math.hypot(pos.x - outerCorner.x, pos.y - outerCorner.y) < minDist) {
                    snapPos = outerCorner;
                    alignLineX = { x1: outerCorner.x, y1: outerCorner.y, x2: outerCorner.x - outNorm.y * 200, y2: outerCorner.y + outNorm.x * 200 };
                    alignLineY = { x1: outerCorner.x, y1: outerCorner.y, x2: outerCorner.x + outNorm.x * 200, y2: outerCorner.y + outNorm.y * 200 };
                }
            });
        });

        this.vertices[index] = snapPos;

        if (alignLineX) this.planner.drawGuideLine(alignLineX.x1, alignLineX.y1, alignLineX.x2, alignLineX.y2, true);
        else this.planner.drawGuideLine(0,0,0,0, false);

        this.update();
        this.planner.mainLayer.batchDraw();
        this.planner.uiLayer.batchDraw();
    }

    getCenter() {
        let cx = 0, cy = 0;
        this.vertices.forEach(v => { cx += v.x; cy += v.y; });
        return { x: cx / this.vertices.length, y: cy / this.vertices.length };
    }

    getClosestEdgeToPoint(point) {
        let closestDist = Infinity;
        let closestEdge = { i1: -1, i2: -1 };
        for (let i = 0; i < this.vertices.length; i++) {
            const i2 = (i + 1) % this.vertices.length;
            const p1 = this.vertices[i];
            const p2 = this.vertices[i2];
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const dist = Math.hypot(point.x - mid.x, point.y - mid.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestEdge = { i1: i, i2: i2 };
            }
        }
        return closestEdge;
    }

    rotateAround(center, angleRad, targetVertices = this.vertices) {
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        targetVertices.forEach(v => {
            const dx = v.x - center.x;
            const dy = v.y - center.y;
            v.x = center.x + dx * cos - dy * sin;
            v.y = center.y + dx * sin + dy * cos;
        });
    }

    setHighlight(isActive) {
        this.polygon.stroke(isActive ? '#2563eb' : '#9ca3af');
        this.polygon.strokeWidth(isActive ? 3 : 2);
        this.polygon.shadowBlur(isActive ? 12 : 0);
        this.polygon.shadowOpacity(isActive ? 0.15 : 0);
        this.handles.forEach(h => h.visible(isActive));
        this.edgeHandles.forEach(h => h.visible(isActive));
        if (this.rotater) this.rotater.visible(isActive);
        this.planner.mainLayer.batchDraw();
    }

    remove() {
        this.group.destroy();
        this.planner.balconies = this.planner.balconies.filter(b => b !== this);
        if (this.planner.selectedEntity === this) this.planner.selectEntity(null);
        this.planner.syncAll(); 
    }

    serialize() {
        return {
            shape: this.shape,
            config: this.config,
            vertices: this.vertices.map(v => ({ x: v.x, y: v.y }))
        };
    }
}
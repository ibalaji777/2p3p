import { GRID, PX_TO_FT, SNAP_DIST, WALL_HEIGHT, WALL_REGISTRY, WIDGET_REGISTRY, FURNITURE_REGISTRY } from './registry.js';
import Konva from 'konva';

export class Anchor {
    constructor(planner, x, y) {
        this.planner = planner; this.lastValidPos = { x, y };
        this.node = new Konva.Group({ x, y, draggable: true, visible: false });
        this.node.add(new Konva.Circle({ radius: 8, fill: "#111827", stroke: "white", strokeWidth: 2 }));
        const arrowOffset = 11; const arrowSize = 4;
        const makeArrow = (points) => new Konva.Line({ points, fill: '#111827', closed: true });
        this.node.add(makeArrow([0, -arrowOffset, -arrowSize, -arrowOffset+arrowSize, arrowSize, -arrowOffset+arrowSize])); this.node.add(makeArrow([0, arrowOffset, -arrowSize, arrowOffset-arrowSize, arrowSize, arrowOffset-arrowSize])); this.node.add(makeArrow([-arrowOffset, 0, -arrowOffset+arrowSize, -arrowSize, -arrowOffset+arrowSize, arrowSize])); this.node.add(makeArrow([arrowOffset, 0, arrowOffset-arrowSize, -arrowSize, arrowOffset-arrowSize, arrowSize]));
        this.node.on('dragstart', () => { let attachedWalls = this.planner.walls.filter(w => w.startAnchor === this || w.endAnchor === this); attachedWalls.forEach(w => w.setHighlight(true)); });
        this.node.on('dragmove', () => {
            let rawPos = { x: this.planner.snap(this.node.x()), y: this.planner.snap(this.node.y()) };
            let attachedWalls = this.planner.walls.filter(w => w.startAnchor === this || w.endAnchor === this);
            if (attachedWalls.length === 1) {
                let fixedAnchor = attachedWalls[0].startAnchor === this ? attachedWalls[0].endAnchor : attachedWalls[0].startAnchor;
                let dx = rawPos.x - fixedAnchor.x; let dy = rawPos.y - fixedAnchor.y; let rawAngle = Math.atan2(dy, dx) * 180 / Math.PI; let dist = Math.hypot(dx, dy);
                for (let a of [0, 45, 90, 135, 180, -45, -90, -135, -180]) {
                    if (Math.abs(rawAngle - a) < 5) { let rad = a * Math.PI / 180; rawPos.x = fixedAnchor.x + dist * Math.cos(rad); rawPos.y = fixedAnchor.y + dist * Math.sin(rad); this.planner.drawGuideLine(fixedAnchor.x, fixedAnchor.y, rawPos.x, rawPos.y, true); break; } else { this.planner.drawGuideLine(0,0,0,0, false); }
                }
            }
            let proposedPos = rawPos; let targetSnapWall = null, closestDist = SNAP_DIST, snappedObj = false;
            for (let w of this.planner.walls) { if (attachedWalls.includes(w)) continue; let proj = this.planner.getClosestPointOnSegment(proposedPos, w.startAnchor.position(), w.endAnchor.position()); let dist = Math.hypot(proposedPos.x - proj.x, proposedPos.y - proj.y); if (dist < closestDist) { closestDist = dist; proposedPos = proj; targetSnapWall = w; snappedObj = true; } }
            if (attachedWalls.length === 1) {
                let fixedAnchor = attachedWalls[0].startAnchor === this ? attachedWalls[0].endAnchor : attachedWalls[0].startAnchor; let dx = proposedPos.x - fixedAnchor.x; let dy = proposedPos.y - fixedAnchor.y; let len = this.planner.formatLength(Math.hypot(dx, dy)); let ang = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1); this.planner.updateInfoBadge(proposedPos.x, proposedPos.y, len, ang, snappedObj);
            }
            this.planner.walls.forEach(w => { w.setHighlight(attachedWalls.includes(w) || w === this.planner.selectedEntity); });
            let collision = false; for (let w of attachedWalls) { if (w.hasEvent("stop_collision")) { let otherAnc = w.startAnchor === this ? w.endAnchor : w.startAnchor; if (this.planner.checkWallIntersection(proposedPos, otherAnc.position(), [targetSnapWall])) { collision = true; break; } } }
            if (collision) { this.node.position(this.lastValidPos); } else { this.node.position(proposedPos); this.lastValidPos = proposedPos; } 
            if (snappedObj) this.planner.showSnapGlow(proposedPos.x, proposedPos.y); else this.planner.hideSnapGlow();
            this.planner.syncAll();
        });
        this.node.on('dragend', () => { this.planner.walls.forEach(w => w.setHighlight(w === this.planner.selectedEntity)); this.planner.drawGuideLine(0,0,0,0, false); this.planner.hideInfoBadge(); this.planner.hideSnapGlow(); this.planner.syncAll(); }); 
        this.planner.uiLayer.add(this.node);
    }
    get x() { return this.node.x(); } get y() { return this.node.y(); } show() { this.node.show(); } hide() { this.node.hide(); } position() { return this.node.position(); }
}

export class PremiumStair {
    constructor(planner, startX, startY) {
        this.planner = planner; this.config = { width: 40, height: WALL_HEIGHT, treadDepth: 11, riserHeight: 7.5 };
        this.path = [ { x: startX, y: startY, shape: 'flat' }, { x: startX, y: startY, shape: 'flat' } ];
        this.group = new Konva.Group({ draggable: true }); this.stepsGroup = new Konva.Group(); this.handlesGroup = new Konva.Group({ visible: false });
        this.handles = []; this.stepData3D = []; this.basePath = null;
        this.group.add(this.stepsGroup, this.handlesGroup); this.planner.widgetLayer.add(this.group);
        this.initHandles(); this.initEvents(); this.update();
    }
    addPoint(x, y) { this.path.push({ x, y, shape: 'flat' }); this.initHandles(); this.update(); }
    updateLastPoint(x, y) { if (this.path.length > 0) { this.path[this.path.length - 1].x = x; this.path[this.path.length - 1].y = y; this.update(); } }
    finishDrawing() { let pL = this.path[this.path.length - 1], pL2 = this.path[this.path.length - 2]; if (Math.hypot(pL.x - pL2.x, pL.y - pL2.y) < 10) { this.path.pop(); } this.initHandles(); this.update(); }
    initHandles() {
        this.handlesGroup.destroyChildren(); this.handles = [];
        this.path.forEach((node, idx) => {
            const handle = new Konva.Circle({ x: node.x, y: node.y, radius: 8, fill: '#10b981', stroke: 'white', strokeWidth: 2, draggable: true });
            handle.isStairNodeHandle = true; handle.nodeIndex = idx;
            handle.on('mouseenter', () => document.body.style.cursor = 'move'); handle.on('mouseleave', () => document.body.style.cursor = 'pointer');
            handle.on('click', (e) => { e.cancelBubble = true; this.planner.selectEntity(this, 'stair_node', idx); });
            handle.on('dragmove', () => { let rawPos = { x: handle.x(), y: handle.y() }; handle.position(rawPos); this.path[idx].x = rawPos.x; this.path[idx].y = rawPos.y; this.update(true); this.planner.syncAll(); });
            this.handles.push(handle); this.handlesGroup.add(handle);
        });
    }
    initEvents() {
        this.stepsGroup.on('mouseenter', () => { if (this.planner.tool === 'select') document.body.style.cursor = 'pointer'; });
        this.stepsGroup.on('mouseleave', () => document.body.style.cursor = 'default');
        this.stepsGroup.on('click', (e) => { if (this.planner.tool === 'select') { this.planner.selectEntity(this, 'stair'); e.cancelBubble = true; } });
        this.group.on('dragstart', (e) => { if (e.target.isStairNodeHandle) return; this.basePath = JSON.parse(JSON.stringify(this.path)); });
        this.group.setAttr('dragBoundFunc', (pos) => { if (!this.basePath) return {x:0, y:0}; let dx = pos.x; let dy = pos.y; for (let i = 0; i < this.path.length; i++) { this.path[i].x = this.basePath[i].x + dx; this.path[i].y = this.basePath[i].y + dy; } this.update(true); this.planner.syncAll(); return { x: 0, y: 0 }; });
        this.group.on('dragend', (e) => { if (e.target.isStairNodeHandle) return; this.basePath = null; this.planner.syncAll(); });
    }
    setHighlight(isActive) { this.handlesGroup.visible(isActive); this.update(isActive); }
    update(isActive = false) {
        this.group.position({x: 0, y: 0}); this.stepsGroup.destroyChildren(); this.handles.forEach((h, i) => h.position(this.path[i]));
        if (this.path.length < 2) return;
        let w = this.config.width, hw = w / 2; this.stepData3D = []; let totalRun = 0, flights = [];
        for (let i = 0; i < this.path.length - 1; i++) {
            let p1 = this.path[i], p2 = this.path[i+1], dx = p2.x - p1.x, dy = p2.y - p1.y, dist = Math.hypot(dx, dy); if (dist < 1) continue; 
            let dir = { x: dx/dist, y: dy/dist }, n = { x: -dir.y, y: dir.x }, angle = Math.atan2(dy, dx), hasStartLanding = (i > 0), hasEndLanding = (i < this.path.length - 2);
            let startOff = hasStartLanding ? hw : 0, endOff = hasEndLanding ? hw : 0, effDist = Math.max(0.1, dist - startOff - endOff); 
            let sP = { x: p1.x + dir.x * startOff, y: p1.y + dir.y * startOff }, eP = { x: p2.x - dir.x * endOff, y: p2.y - dir.y * endOff };
            flights.push({ sP, eP, dir, n, angle, effDist, hasStartLanding, hasEndLanding, p1, p2, startNodeIdx: i }); totalRun += effDist;
        }
        let actualTread = this.config.treadDepth, totalSteps = Math.max(1, Math.ceil(totalRun / actualTread)), totalItems = totalSteps + Math.max(0, this.path.length - 2), riserH = this.config.height / totalItems;
        let currentHeight = 0, globalStepCount = 0, breakStep = 8, strokeColor = isActive ? '#4f46e5' : '#8b5a2b';
        flights.forEach((flight, idx) => {
            if (flight.hasStartLanding) {
                let prevF = flights[idx - 1], currF = flight, shape = this.path[flight.startNodeIdx].shape || 'flat';
                let prevL = { x: prevF.eP.x - prevF.n.x * hw, y: prevF.eP.y - prevF.n.y * hw }, prevR = { x: prevF.eP.x + prevF.n.x * hw, y: prevF.eP.y + prevF.n.y * hw };
                let currL = { x: currF.sP.x - currF.n.x * hw, y: currF.sP.y - currF.n.y * hw }, currR = { x: currF.sP.x + currF.n.x * hw, y: currF.sP.y + currF.n.y * hw };
                if (shape === 'circular') { this.stepsGroup.add(new Konva.Circle({ x: currF.p1.x, y: currF.p1.y, radius: hw, fill: 'rgba(139, 90, 43, 0.2)', stroke: strokeColor, strokeWidth: 2 })); this.stepData3D.push({ type: 'landing_circ', x: currF.p1.x, y: currentHeight, z: currF.p1.y, r: hw, h: riserH, angle: currF.angle }); } 
                else { this.stepsGroup.add(new Konva.Line({ points: [prevL.x, prevL.y, prevR.x, prevR.y, currR.x, currR.y, currL.x, currL.y], fill: 'rgba(139, 90, 43, 0.2)', stroke: strokeColor, strokeWidth: 3, closed: true })); this.stepData3D.push({ type: 'landing_poly', pts: [prevL, prevR, currR, currL], y: currentHeight, h: riserH }); }
                currentHeight += riserH;
            }
            let pL1 = { x: flight.sP.x - flight.n.x * hw, y: flight.sP.y - flight.n.y * hw }, pL2 = { x: flight.eP.x - flight.n.x * hw, y: flight.eP.y - flight.n.y * hw };
            let pR1 = { x: flight.sP.x + flight.n.x * hw, y: flight.sP.y + flight.n.y * hw }, pR2 = { x: flight.eP.x + flight.n.x * hw, y: flight.eP.y + flight.n.y * hw };
            this.stepsGroup.add(new Konva.Line({ points: [pL1.x, pL1.y, pL2.x, pL2.y], stroke: strokeColor, strokeWidth: 3 })); this.stepsGroup.add(new Konva.Line({ points: [pR1.x, pR1.y, pR2.x, pR2.y], stroke: strokeColor, strokeWidth: 3 }));
            let flightSteps = Math.max(1, Math.round((flight.effDist / totalRun) * totalSteps)), stepDepth = flight.effDist / flightSteps;
            for (let j = 0; j < flightSteps; j++) {
                let isSolid = globalStepCount <= breakStep, cx = flight.sP.x + flight.dir.x * (j * stepDepth + stepDepth/2), cy = flight.sP.y + flight.dir.y * (j * stepDepth + stepDepth/2);
                let stL = { x: cx - flight.n.x * hw, y: cy - flight.n.y * hw }, stR = { x: cx + flight.n.x * hw, y: cy + flight.n.y * hw };
                this.stepsGroup.add(new Konva.Line({ points: [stL.x, stL.y, stR.x, stR.y], stroke: '#9ca3af', strokeWidth: 1, dash: isSolid ? [] : [4,4] }));
                if (globalStepCount === breakStep) { let mid1 = {x: stL.x + (stR.x-stL.x)*0.33 + flight.dir.x*8, y: stL.y + (stR.y-stL.y)*0.33 + flight.dir.y*8}, mid2 = {x: stL.x + (stR.x-stL.x)*0.66 - flight.dir.x*8, y: stL.y + (stR.y-stL.y)*0.66 - flight.dir.y*8}; this.stepsGroup.add(new Konva.Line({ points: [stL.x, stL.y, mid1.x, mid1.y, mid2.x, mid2.y, stR.x, stR.y], stroke: '#111827', strokeWidth: 1.5 })); }
                this.stepData3D.push({ type: 'step', x: cx, y: currentHeight, z: cy, w: w, d: stepDepth, h: riserH, angle: flight.angle }); currentHeight += riserH; globalStepCount++;
            }
            if (idx === 0) { let aStart = { x: flight.sP.x + flight.dir.x * 5, y: flight.sP.y + flight.dir.y * 5 }, aEnd = { x: flight.sP.x + flight.dir.x * Math.min(40, flight.effDist), y: flight.sP.y + flight.dir.y * Math.min(40, flight.effDist) }; this.stepsGroup.add(new Konva.Arrow({ points: [aStart.x, aStart.y, aEnd.x, aEnd.y], fill: '#111827', stroke: '#111827', strokeWidth: 2, pointerLength: 6, pointerWidth: 6 })); let textAngle = flight.angle * 180 / Math.PI; let upText = new Konva.Text({ x: aStart.x, y: aStart.y, text: "UP", fontSize: 10, fontStyle: 'bold', fill: '#111827', rotation: textAngle }); upText.offset({x: upText.width()/2, y: upText.height() + 10}); this.stepsGroup.add(upText); }
        });
    }
    remove() { this.group.destroy(); this.planner.stairs = this.planner.stairs.filter(s => s !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
}

export class PremiumWidget {
    constructor(planner, wall, t, configId) {
        this.planner = planner; this.wall = wall; this.t = t; this.type = configId; this.isDragging = false; 
        this.config = WIDGET_REGISTRY[configId];
        Object.assign(this, JSON.parse(JSON.stringify(this.config.defaultConfig)));
        this.cutter = new Konva.Rect({ height: wall.config.thickness + 4, fill: 'black', globalCompositeOperation: 'destination-out', listening: false }); this.planner.wallLayer.add(this.cutter);
        this.visualGroup = new Konva.Group({ draggable: false }); this.frameL = new Konva.Rect({ width: 4, fill: '#374151' }); this.frameR = new Konva.Rect({ width: 4, fill: '#374151' }); this.visualGroup.add(this.frameL, this.frameR);
        this.innerParts = new Konva.Group(); this.visualGroup.add(this.innerParts);
        if (this.hasEvent("resize_handles_along_wall_axis")) {
            this.leftHandle = new Konva.Circle({ radius: 7, fill: '#10b981', stroke: 'white', strokeWidth: 2, draggable: true, visible: false }); this.rightHandle = new Konva.Circle({ radius: 7, fill: '#10b981', stroke: 'white', strokeWidth: 2, draggable: true, visible: false });
            [this.leftHandle, this.rightHandle].forEach((handle, idx) => { handle.on('mouseenter', () => document.body.style.cursor = 'ew-resize'); handle.on('mouseleave', () => document.body.style.cursor = 'pointer'); handle.on('dragstart', (e) => { e.cancelBubble = true; }); handle.on('dragmove', (e) => { e.cancelBubble = true; this.requestResize(this.planner.stage.getPointerPosition(), idx === 0); }); handle.on('dragend', (e) => { e.cancelBubble = true; this.planner.syncAll(); }); }); this.planner.uiLayer.add(this.leftHandle, this.rightHandle);
        }
        this.initEvents(); this.planner.widgetLayer.add(this.visualGroup); this.update();
    }
    hasEvent(eventName) { return this.config.events.includes(eventName); }
    checkOverlap(targetWall, proposedT, proposedWidth) { const wallLen = targetWall.getLength(), pMin = proposedT * wallLen - proposedWidth / 2, pMax = proposedT * wallLen + proposedWidth / 2; for (let w of targetWall.attachedWidgets) { if (w === this) continue; const wMin = w.t * wallLen - w.width / 2, wMax = w.t * wallLen + w.width / 2; if (pMax > wMin + 1 && pMin < wMax - 1) return true; } return false; }
    requestResize(pos, isLeft) { const wallLen = this.wall.getLength(); let targetT = this.wall.getClosestT(pos); const fixedEdgeT = this.t + (isLeft ? (this.width / 2) / wallLen : -(this.width / 2) / wallLen); let newWidth = Math.abs(fixedEdgeT - targetT) * wallLen; if (newWidth < 20) newWidth = 20; let newT = (fixedEdgeT + targetT) / 2; if (newWidth === 20) { targetT = fixedEdgeT + (isLeft ? -20/wallLen : 20/wallLen); newT = (fixedEdgeT + targetT) / 2; } const halfW = newWidth / 2; if (newT - halfW/wallLen < 0 || newT + halfW/wallLen > 1) return; if (this.hasEvent("prevent_overlap") && this.checkOverlap(this.wall, newT, newWidth)) return; this.width = newWidth; this.t = newT; this.update(); }
    initEvents() { 
        this.visualGroup.on('mouseenter', () => { if (this.planner.tool === 'select') document.body.style.cursor = 'pointer'; }); 
        this.visualGroup.on('mouseleave', () => { document.body.style.cursor = 'default'; }); 
        this.visualGroup.on('dragstart', () => { this.isDragging = true; }); 
        this.visualGroup.on('dragmove', () => { if (!this.hasEvent("drag_along_wall")) return; const pos = this.planner.stage.getPointerPosition(); let targetWall = this.wall; if (this.hasEvent("jump_wall_to_wall")) { let minDist = this.planner.getDistanceToWall(pos, this.wall); this.planner.walls.forEach(w => { if (w === this.wall) return; const dist = this.planner.getDistanceToWall(pos, w); if (dist < minDist && dist < 50) { minDist = dist; targetWall = w; } }); if (targetWall !== this.wall) { let tempT = targetWall.getClosestT(pos); if (!this.hasEvent("prevent_overlap") || !this.checkOverlap(targetWall, tempT, this.width)) { this.wall.attachedWidgets = this.wall.attachedWidgets.filter(d => d !== this); this.wall = targetWall; this.wall.attachedWidgets.push(this); } } } let rawT = this.wall.getClosestT(pos); const wallLen = this.wall.getLength(), halfW = this.width / 2; const minT = halfW / wallLen, maxT = 1 - (halfW / wallLen); let t = rawT; const snapMargin = 15 / wallLen; if (this.hasEvent("snap_to_corners")) { if (Math.abs(t - minT) < snapMargin) t = minT; if (Math.abs(maxT - t) < snapMargin) t = maxT; } if (this.hasEvent("snap_to_center")) { if (Math.abs(t - 0.5) < snapMargin) t = 0.5; } t = Math.max(minT, Math.min(maxT, t)); if (this.hasEvent("prevent_overlap") && this.checkOverlap(this.wall, t, this.width)) return; this.t = t; this.update(); }); 
        this.visualGroup.on('dragend', () => { setTimeout(() => { this.isDragging = false; }, 100); this.planner.syncAll(); }); 
        this.visualGroup.on('click', (e) => { if (this.planner.tool === 'select' && !this.isDragging) { this.planner.selectEntity(this, 'widget'); e.cancelBubble = true; } }); 
    }
    remove() { this.cutter.destroy(); this.visualGroup.destroy(); if (this.leftHandle) { this.leftHandle.destroy(); this.rightHandle.destroy(); } this.wall.attachedWidgets = this.wall.attachedWidgets.filter(d => d !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
    update() {
        const p1 = this.wall.startAnchor.position(), p2 = this.wall.endAnchor.position(), dx = p2.x - p1.x, dy = p2.y - p1.y, angle = Math.atan2(dy, dx) * 180 / Math.PI, absPos = { x: p1.x + dx * this.t, y: p1.y + dy * this.t }, thick = this.wall.config.thickness, hw = this.width / 2;
        this.cutter.width(this.width); this.cutter.offsetX(this.width / 2); this.cutter.offsetY((thick + 4) / 2); this.cutter.absolutePosition(absPos); this.cutter.rotation(angle);
        this.visualGroup.absolutePosition(absPos); this.visualGroup.rotation(angle); this.frameL.setAttrs({ height: thick, x: -hw, y: -thick/2 }); this.frameR.setAttrs({ height: thick, x: hw - 4, y: -thick/2 });
        this.innerParts.destroyChildren(); this.config.render2D(this.innerParts, this);
        if (this.leftHandle && this.rightHandle) { const rad = angle * Math.PI / 180, cosA = Math.cos(rad), sinA = Math.sin(rad); this.leftHandle.position({ x: absPos.x - hw * cosA, y: absPos.y - hw * sinA }); this.rightHandle.position({ x: absPos.x + hw * cosA, y: absPos.y + hw * sinA }); }
    }
}

export class PremiumWall {
    constructor(planner, startAnchor, endAnchor, type = "outer") {
        this.planner = planner; this.startAnchor = startAnchor; this.endAnchor = endAnchor; this.attachedWidgets = []; this.type = type; this.config = WALL_REGISTRY[type] || WALL_REGISTRY['outer'];
        this.elevationLayers = { front: [{ id: Date.now(), texture: 'none', color: '#e2e8f0', x: 0, y: 0, w: '100%', h: '100%' }], back: [{ id: Date.now()+1, texture: 'none', color: '#f8fafc', x: 0, y: 0, w: '100%', h: '100%' }] };
        this.fillColor = this.type === 'outer' ? '#e5e5e5' : '#f3f4f6'; this.strokeColor = this.type === 'outer' ? '#9ca3af' : '#d1d5db';
        this.wallGroup = new Konva.Group(); 
        this.poly = new Konva.Line({ fill: this.fillColor, stroke: this.strokeColor, strokeWidth: 2, closed: true, lineJoin: 'miter', shadowColor: 'black', shadowBlur: 10, shadowOffset: {x: 2, y: 2}, shadowOpacity: 0.2 });
        this.frontHighlight = new Konva.Line({ stroke: '#3b82f6', strokeWidth: 4, visible: false }); 
        this.backHighlight = new Konva.Line({ stroke: '#10b981', strokeWidth: 4, visible: false });
        this.wallGroup.add(this.poly, this.frontHighlight, this.backHighlight); 
        this.planner.wallLayer.add(this.wallGroup);
        
        this.labelGroup = new Konva.Group({ listening: false }); 
        this.labelText = new Konva.Text({ fontSize: 11, fill: "#4b5563", padding: 2, fontStyle: 'bold' }); 
        this.labelGroup.add(this.labelText); 
        this.planner.uiLayer.add(this.labelGroup);

        this.initEvents(); this.update();
    }
    hasEvent(eventName) { return this.config.events.includes(eventName); }
    getLength() { const p1 = this.startAnchor.position(), p2 = this.endAnchor.position(); return Math.hypot(p2.x - p1.x, p2.y - p1.y); }
    setHighlight(isActive) { this.poly.stroke(this.planner.selectedEntity === this ? "#4f46e5" : this.strokeColor); this.planner.stage.batchDraw(); }
    initEvents() { 
        this.poly.on('mousedown', (e) => { 
            if (WIDGET_REGISTRY[this.planner.tool]) { let t = this.getClosestT(this.planner.stage.getPointerPosition()); const widget = new PremiumWidget(this.planner, this, t, this.planner.tool); this.attachedWidgets.push(widget); this.planner.updateToolStates(); this.planner.syncAll(); return; } 
            if (this.planner.tool !== 'select') return; e.cancelBubble = true; this.planner.selectEntity(this, 'wall'); 
        }); 
        let startAncPos = {}, startPointer = {}; 
        this.poly.on('dragstart', () => { this.setHighlight(true); const pos = this.planner.stage.getPointerPosition(); startPointer = { x: pos.x, y: pos.y }; startAncPos = { x1: this.startAnchor.x, y1: this.startAnchor.y, x2: this.endAnchor.x, y2: this.endAnchor.y }; }); 
        this.poly.on('dragmove', () => { const pos = this.planner.stage.getPointerPosition(); const dx = this.planner.snap(pos.x - startPointer.x), dy = this.planner.snap(pos.y - startPointer.y); const proposedStart = { x: startAncPos.x1 + dx, y: startAncPos.y1 + dy }; const proposedEnd = { x: startAncPos.x2 + dx, y: startAncPos.y2 + dy }; if (this.hasEvent("stop_collision") && this.planner.checkWallIntersection(proposedStart, proposedEnd, [this])) return; this.startAnchor.node.position(proposedStart); this.endAnchor.node.position(proposedEnd); this.poly.position({ x: 0, y: 0 }); this.planner.syncAll(); }); 
        this.poly.on('dragend', () => { this.setHighlight(this.planner.selectedEntity === this); });
    }
    getClosestT(pos) { const p1 = this.startAnchor.position(), p2 = this.endAnchor.position(), dx = p2.x - p1.x, dy = p2.y - p1.y, lenSq = dx*dx + dy*dy; if (lenSq === 0) return 0.5; let t = ((pos.x - p1.x) * dx + (pos.y - p1.y) * dy) / lenSq; return Math.max(0, Math.min(1, t)); }
    update() { 
        const p1 = this.startAnchor.position(), p2 = this.endAnchor.position(); const vdx = p2.x - p1.x, vdy = p2.y - p1.y, vlen = Math.hypot(vdx, vdy); if (vlen === 0) return;
        const u = { x: vdx/vlen, y: vdy/vlen }, n = { x: -u.y, y: u.x }, ht = this.config.thickness / 2;
        const p1_L = { x: p1.x + n.x * ht, y: p1.y + n.y * ht }, p1_R = { x: p1.x - n.x * ht, y: p1.y - n.y * ht }, p2_L = { x: p2.x + n.x * ht, y: p2.y + n.y * ht }, p2_R = { x: p2.x - n.x * ht, y: p2.y - n.y * ht };
        const intersectLines = (pA, dA, pB, dB) => { const det = dA.x * dB.y - dA.y * dB.x; if (Math.abs(det) < 1e-5) return null; const t = ((pB.x - pA.x) * dB.y - (pB.y - pA.y) * dB.x) / det; return { x: pA.x + t * dA.x, y: pA.y + t * dA.y }; };
        const getCorners = (anchor, isStart) => {
            const baseL = isStart ? p1_L : p2_L, baseR = isStart ? p1_R : p2_R, P = anchor.position();
            const connectedWalls = this.planner.walls.filter(w => (w.startAnchor === anchor || w.endAnchor === anchor) && w !== this);
            if (connectedWalls.length === 1) {
                const w2 = connectedWalls[0], w2_p1 = w2.startAnchor.position(), w2_p2 = w2.endAnchor.position(), vdx2 = w2_p2.x - w2_p1.x, vdy2 = w2_p2.y - w2_p1.y, vlen2 = Math.hypot(vdx2, vdy2);
                if (vlen2 > 0) { const u2 = { x: vdx2/vlen2, y: vdy2/vlen2 }, n2 = { x: -u2.y, y: u2.x }, ht2 = w2.config.thickness / 2; const w2_baseL = { x: P.x + n2.x * ht2, y: P.y + n2.y * ht2 }, w2_baseR = { x: P.x - n2.x * ht2, y: P.y - n2.y * ht2 }; const iL = intersectLines(baseL, u, w2_baseL, u2), iR = intersectLines(baseR, u, w2_baseR, u2); if (iL && iR) { const distL = Math.hypot(iL.x - P.x, iL.y - P.y), distR = Math.hypot(iR.x - P.x, iR.y - P.y), maxDist = Math.max(ht, ht2) * 5; if (distL < maxDist && distR < maxDist) { return [iL, iR]; } } }
            } else if (connectedWalls.length === 0) {
                let snappedWall = null; for (let w of this.planner.walls) { if (w === this) continue; if (this.planner.getDistanceToWall(P, w) < 2) { snappedWall = w; break; } }
                if (snappedWall) {
                    const w2_p1 = snappedWall.startAnchor.position(), w2_p2 = snappedWall.endAnchor.position(), vdx2 = w2_p2.x - w2_p1.x, vdy2 = w2_p2.y - w2_p1.y, vlen2 = Math.hypot(vdx2, vdy2);
                    if (vlen2 > 0) { const u2 = { x: vdx2/vlen2, y: vdy2/vlen2 }, n2 = { x: -u2.y, y: u2.x }, ht2 = snappedWall.config.thickness / 2; const edge1_P = { x: w2_p1.x + n2.x * ht2, y: w2_p1.y + n2.y * ht2 }, edge2_P = { x: w2_p1.x - n2.x * ht2, y: w2_p1.y - n2.y * ht2 }; const iL1 = intersectLines(baseL, u, edge1_P, u2), iL2 = intersectLines(baseL, u, edge2_P, u2), iR1 = intersectLines(baseR, u, edge1_P, u2), iR2 = intersectLines(baseR, u, edge2_P, u2); const otherP = isStart ? p2 : p1; let finalL = baseL, finalR = baseR; if (iL1 && iL2) { finalL = Math.hypot(iL1.x - otherP.x, iL1.y - otherP.y) < Math.hypot(iL2.x - otherP.x, iL2.y - otherP.y) ? iL1 : iL2; } if (iR1 && iR2) { finalR = Math.hypot(iR1.x - otherP.x, iR1.y - otherP.y) < Math.hypot(iR2.x - otherP.x, iR2.y - otherP.y) ? iR1 : iR2; } return [finalL, finalR]; }
                }
            }
            return [baseL, baseR];
        };
        const [startL, startR] = getCorners(this.startAnchor, true), [endL, endR] = getCorners(this.endAnchor, false);
        this.poly.points([ startL.x, startL.y, endL.x, endL.y, endR.x, endR.y, startR.x, startR.y ]);
        const fOff = 4; this.frontHighlight.points([ startL.x + n.x * fOff, startL.y + n.y * fOff, endL.x + n.x * fOff, endL.y + n.y * fOff ]); this.backHighlight.points([ startR.x - n.x * fOff, startR.y - n.y * fOff, endR.x - n.x * fOff, endR.y - n.y * fOff ]);
        this.labelText.text(this.planner.formatLength(this.getLength())); this.labelGroup.position({ x: (p1.x + p2.x) / 2 - this.labelText.width() / 2, y: (p1.y + p2.y) / 2 - 15 });
        this.attachedWidgets.forEach(w => w.update()); 
    }   
    remove() { this.wallGroup.destroy(); this.labelGroup.destroy(); this.attachedWidgets.forEach(w => w.remove()); this.planner.walls = this.planner.walls.filter(w => w !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
}

export class PremiumFurniture {
    constructor(planner, x, y, configId) {
        this.planner = planner; this.type = 'furniture'; this.config = FURNITURE_REGISTRY[configId];
        this.width = this.config.default.width; this.depth = this.config.default.depth; this.height = this.config.default.height; 
        this.rotation = 0; this.isDragging = false;
        this.group = new Konva.Group({ x: x, y: y, width: this.width, height: this.depth, draggable: true, offsetX: this.width / 2, offsetY: this.depth / 2 });
        this.body = new Konva.Rect({ width: this.width, height: this.depth, fill: '#fde68a', stroke: '#ea580c', strokeWidth: 2, cornerRadius: 4, shadowColor: 'black', shadowBlur: 5, shadowOpacity: 0.2 });
        this.rotHandle = new Konva.Circle({ x: this.width / 2, y: -15, radius: 6, fill: '#ea580c', stroke: 'white', strokeWidth: 2, draggable: true, visible: false });
        this.group.add(this.body, this.rotHandle); this.planner.furnitureLayer.add(this.group);
        this.initEvents();
    }
    setHighlight(isActive) { this.body.stroke(isActive ? '#4f46e5' : '#ea580c'); this.body.strokeWidth(isActive ? 3 : 2); this.rotHandle.visible(isActive); this.planner.stage.batchDraw(); }
    initEvents() {
        this.group.on('mouseenter', () => document.body.style.cursor = 'move'); this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        this.group.on('mousedown', (e) => { e.cancelBubble = true; this.planner.selectEntity(this, 'furniture'); });
        this.group.on('dragstart', () => { this.isDragging = true; this.planner.selectEntity(this, 'furniture'); });
        this.group.on('dragmove', (e) => { if (e.target === this.rotHandle) return; this.planner.syncAll(); });
        this.group.on('dragend', () => { this.isDragging = false; });
        this.rotHandle.on('dragmove', (e) => { e.cancelBubble = true; const pos = this.planner.stage.getPointerPosition(); const angleRad = Math.atan2(pos.y - this.group.y(), pos.x - this.group.x()); this.rotation = (angleRad * 180 / Math.PI) + 90; this.group.rotation(this.rotation); this.rotHandle.position({ x: this.width / 2, y: -15 }); this.planner.syncAll(); });
    }
    update() { this.group.width(this.width); this.group.height(this.depth); this.group.offsetX(this.width / 2); this.group.offsetY(this.depth / 2); this.body.width(this.width); this.body.height(this.depth); this.group.rotation(this.rotation); this.rotHandle.x(this.width / 2); }
    remove() { this.group.destroy(); this.planner.furniture = this.planner.furniture.filter(f => f !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
}

export class FloorPlanner {
    constructor(containerEl) { 
        this.container = containerEl; this.tool = "outer"; this.currentUnit = "ft"; this.drawing = false; this.lastAnchor = null; this.startAnchor = null; this.drawingStair = null; this.preview = null;
        this.walls = []; this.anchors = []; this.roomPaths = []; this.stairs = []; this.furniture = []; this.selectedEntity = null; this.selectedType = null; this.selectedNodeIndex = -1;
        this.onSelectionChange = null; 
        
        this.virtualWidth = 3000;
        this.virtualHeight = 2000;

        this.initKonva(); this.drawGrid(); this.initHUD(); this.initStageEvents(); 
    }
    
    initKonva() { 
        const rect = this.container.getBoundingClientRect();
        this.stage = new Konva.Stage({ container: this.container, width: rect.width, height: rect.height }); 
        
        this.bgLayer = new Konva.Layer();
        this.gridLayer = new Konva.Group(); 
        this.referenceLayer = new Konva.Group(); 
        this.roomLayer = new Konva.Group(); 
        this.bgLayer.add(this.gridLayer, this.referenceLayer, this.roomLayer);

        this.mainLayer = new Konva.Layer();
        this.wallLayer = new Konva.Group(); 
        this.widgetLayer = new Konva.Group(); 
        this.furnitureLayer = new Konva.Group(); 
        this.mainLayer.add(this.wallLayer, this.widgetLayer, this.furnitureLayer);

        this.uiLayer = new Konva.Layer(); 
        
        this.stage.add(this.bgLayer, this.mainLayer, this.uiLayer); 
        
        window.addEventListener('resize', () => {
            if(this.container.clientWidth > 0) {
                this.stage.width(this.container.clientWidth);
                this.stage.height(this.container.clientHeight);
                this.drawGrid();
            }
        });
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
    
    drawGrid() { 
        this.gridLayer.destroyChildren();
        const w = Math.max(this.stage.width(), this.virtualWidth);
        const h = Math.max(this.stage.height(), this.virtualHeight);
        
        for (let i = 0; i < w / GRID; i++) this.gridLayer.add(new Konva.Line({ points: [i * GRID, 0, i * GRID, h], stroke: "#f0f0f0", strokeWidth: 1, listening: false })); 
        for (let j = 0; j < h / GRID; j++) this.gridLayer.add(new Konva.Line({ points: [0, j * GRID, w, j * GRID], stroke: "#f0f0f0", strokeWidth: 1, listening: false })); 
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
        
        this.selectedEntity = entity; this.selectedType = type; this.selectedNodeIndex = nodeIndex;
        
        if (entity && (type === 'wall' || type === 'stair' || type === 'stair_node' || type === 'furniture')) entity.setHighlight(true);
        if (this.onSelectionChange) this.onSelectionChange(entity, type, nodeIndex);
    }

    updateToolStates() { 
        const isSelect = this.tool === "select"; 
        this.walls.forEach(w => { w.poly.setAttr('draggable', isSelect); w.attachedWidgets.forEach(widg => widg.visualGroup.setAttr('draggable', isSelect)); }); 
        this.stairs.forEach(s => { s.group.setAttr('draggable', isSelect); }); 
        this.anchors.forEach(a => { a.node.setAttr('draggable', isSelect); }); 
        this.furniture.forEach(f => { f.group.setAttr('draggable', isSelect); });
    }

    getOrCreateAnchor(x, y) { let a = this.anchors.find(a => Math.hypot(a.x - x, a.y - y) < SNAP_DIST); if (a) return a; const newAnchor = new Anchor(this, x, y); this.anchors.push(newAnchor); return newAnchor; }
    deselectAll() { this.walls.forEach(w => w.setHighlight(false)); this.stairs.forEach(s => s.setHighlight(false)); this.furniture.forEach(f => f.setHighlight(false)); this.anchors.forEach(a => a.hide()); this.selectEntity(null); this.syncAll(); }
    syncAll() { this.walls.forEach(w => w.update()); this.stairs.forEach(s => s.update()); this.furniture.forEach(f => f.update()); this.mainLayer.batchDraw(); this.detectRooms(); }
    
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
            const wallConfig = WALL_REGISTRY[this.tool]; 
            const pos = this.stage.getPointerPosition(); 
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

        this.stage.on("mousemove", () => { 
            const pos = this.stage.getPointerPosition(); 
            if (!pos) return;
            let rawPos = { x: this.snap(pos.x), y: this.snap(pos.y) }; 
            
            if (this.drawingStair) { this.drawingStair.updateLastPoint(rawPos.x, rawPos.y); return; }
            if (!this.drawing) return; 
            const wallConfig = WALL_REGISTRY[this.tool]; 
            
            let dxAxis = rawPos.x - this.lastAnchor.x, dyAxis = rawPos.y - this.lastAnchor.y, rawAngle = Math.atan2(dyAxis, dxAxis) * 180 / Math.PI, distAxis = Math.hypot(dxAxis, dyAxis), snappedToAxis = false;
            for (let a of [0, 45, 90, 135, 180, -45, -90, -135, -180]) {
                if (Math.abs(rawAngle - a) < 5) { 
                    let rad = a * Math.PI / 180; 
                    rawPos.x = this.lastAnchor.x + distAxis * Math.cos(rad); 
                    rawPos.y = this.lastAnchor.y + distAxis * Math.sin(rad); 
                    snappedToAxis = true; 
                    this.drawGuideLine(this.lastAnchor.x, this.lastAnchor.y, rawPos.x, rawPos.y, true); 
                    break; 
                }
            }
            if (!snappedToAxis) this.drawGuideLine(0,0,0,0, false);

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
                            
                            // 40px radius overrides all other snaps
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
            
            let dxBadge = snapPos.x - this.lastAnchor.x, dyBadge = snapPos.y - this.lastAnchor.y;
            let lenBadge = this.formatLength(Math.hypot(dxBadge, dyBadge));
            let angBadge = Math.abs(Math.atan2(dyBadge, dxBadge) * 180 / Math.PI).toFixed(1);
            this.updateInfoBadge(snapPos.x, snapPos.y, lenBadge, angBadge, snappedObj);

            if (snappedObj) this.showSnapGlow(snapPos.x, snapPos.y); else this.hideSnapGlow();
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
    }

    detectRooms() { this.roomLayer.destroyChildren(); this.roomPaths = []; const visited = new Set(); for (let wall of this.walls) { let path = []; let current = wall.startAnchor; let next = wall.endAnchor; path.push(current); let attempts = 0; while (next && attempts < this.walls.length) { path.push(next); if (next === wall.startAnchor && path.length > 2) { this.drawRoom(path); this.roomPaths.push(path); break; } let nextWall = this.walls.find(w => w !== wall && !visited.has(w) && (w.startAnchor === next || w.endAnchor === next)); if (!nextWall) break; visited.add(nextWall); next = (nextWall.startAnchor === next) ? nextWall.endAnchor : nextWall.startAnchor; attempts++; } } }
    drawRoom(anchorPath) { const points = anchorPath.flatMap(a => [a.x, a.y]); const poly = new Konva.Line({ points: points, fill: '#f0f4f8', closed: true, opacity: 0.7 }); let cx = 0, cy = 0; anchorPath.forEach(a => { cx += a.x; cy += a.y; }); cx /= anchorPath.length; cy /= anchorPath.length; const label = new Konva.Text({ x: cx, y: cy, text: "Room\n" + Math.round(this.calculateArea(points)) + " sqft", fontSize: 12, fill: '#6b7280', align: 'center', fontStyle: 'bold' }); label.offsetX(label.width() / 2); label.offsetY(label.height() / 2); this.roomLayer.add(poly); this.roomLayer.add(label); }
    calculateArea(points) { let area = 0; for (let i = 0; i < points.length; i += 2) { let j = (i + 2) % points.length; area += points[i] * points[j + 1]; area -= points[i + 1] * points[j]; } return Math.abs(area / 2) * (PX_TO_FT * PX_TO_FT); }

    clearAll() {
        [...this.walls].forEach(w => w.remove());
        [...this.furniture].forEach(f => f.remove());
        [...this.stairs].forEach(s => s.remove());
        this.walls = [];
        this.furniture = [];
        this.stairs = [];
        this.roomPaths = [];
        
        this.anchors.forEach(a => { if(a.node) a.node.destroy(); });
        this.anchors = [];
        
        if (this.wallLayer) this.wallLayer.destroyChildren();
        if (this.furnitureLayer) this.furnitureLayer.destroyChildren();
        if (this.widgetLayer) this.widgetLayer.destroyChildren();
        
        if (this.mainLayer) this.mainLayer.batchDraw();
        this.selectEntity(null);
    }

    exportState() {
        const state = {
            walls: this.walls.map(w => ({
                startX: w.startAnchor.x, startY: w.startAnchor.y,
                endX: w.endAnchor.x, endY: w.endAnchor.y,
                thickness: w.config.thickness,
                type: w.type,
                widgets: w.attachedWidgets.map(wid => ({ t: wid.t, configId: wid.type, width: wid.width })),
                decors: w.attachedDecor ? w.attachedDecor.map(d => ({
                    id: d.id, configId: d.configId, side: d.side,
                    localX: d.localX, localY: d.localY, localZ: d.localZ,
                    width: d.width, height: d.height, depth: d.depth, tileSize: d.tileSize,
                    faces: { front: d.faces.front, back: d.faces.back, left: d.faces.left, right: d.faces.right }
                })) : []
            })),
            furniture: this.furniture.map(f => ({
                x: f.group.x(), y: f.group.y(),
                rotation: f.rotation, width: f.width, depth: f.depth, height: f.height,
                configId: f.config.id
            })),
            stairs: this.stairs.map(s => ({
                path: s.path.map(p => ({ x: p.x, y: p.y, shape: p.shape }))
            })),
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
                    const a1 = this.getOrCreateAnchor(wData.startX, wData.startY);
                    const a2 = this.getOrCreateAnchor(wData.endX, wData.endY);
                    const wall = new PremiumWall(this, a1, a2, wData.type);
                    if (wData.widgets) {
                        wData.widgets.forEach(wd => {
                            const widget = new PremiumWidget(this, wall, wd.t, wd.configId);
                            widget.width = wd.width;
                            wall.attachedWidgets.push(widget);
                        });
                    }
                    if (wData.decors) {
                        wall.attachedDecor = JSON.parse(JSON.stringify(wData.decors));
                    }
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
                        const stair = new PremiumStair(this, sData.path[0].x, sData.path[0].y);
                        stair.path = sData.path;
                        stair.initHandles();
                        this.stairs.push(stair);
                    }
                });
            }
            this.syncAll();
        } catch (e) {
            console.error("Failed to import internal state", e);
        }
    }

    clearReferenceBackground() {
        if (this.referenceGroup) {
            this.referenceGroup.destroy();
            this.referenceGroup = null;
            if (this.bgLayer) this.bgLayer.batchDraw();
        }
    }

    loadReferenceBackground(jsonStr) {
        this.clearReferenceBackground();
        if (!jsonStr) return;

        this.referenceGroup = new Konva.Group({ opacity: 0.35, listening: false });
        this.referenceLayer.add(this.referenceGroup);

        try {
            const state = JSON.parse(jsonStr);
            if (state && state.walls) {
                state.walls.forEach(wData => {
                    const line = new Konva.Line({
                        points: [wData.startX, wData.startY, wData.endX, wData.endY],
                        stroke: '#94a3b8', 
                        strokeWidth: wData.thickness || 20,
                        lineCap: 'round', lineJoin: 'round',
                        dash: [] 
                    });
                    this.referenceGroup.add(line);
                });
            }
            this.bgLayer.batchDraw();
        } catch (err) {
            console.error("Failed to load reference background", err);
        }
    }
}
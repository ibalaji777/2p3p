import { GRID, PX_TO_FT, SNAP_DIST, WALL_HEIGHT, WALL_REGISTRY, WIDGET_REGISTRY, FURNITURE_REGISTRY } from './registry.js';
import Konva from 'konva';
import { PremiumHipRoof } from './engine2d/PremiumHipRoof.js';

/**
 * A simple local event emitter class.
 */
class EventEmitter {
    constructor() {
        this.events = {};
    }
    on(eventName, fn) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(fn);
        return () => this.off(eventName, fn);
    }
    off(eventName, fn) {
        if (this.events[eventName]) {
            this.events[eventName] = this.events[eventName].filter(f => f !== fn);
        }
    }
    emit(eventName, ...args) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(fn => fn(...args));
        }
    }
}


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
        console.log(`PremiumWidget constructor called with configId: ${configId}`);
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
        this.visualGroup.on('dragmove', () => { if (!this.hasEvent("drag_along_wall")) return; const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition(); let targetWall = this.wall; if (this.hasEvent("jump_wall_to_wall")) { let minDist = this.planner.getDistanceToWall(pos, this.wall); this.planner.walls.forEach(w => { if (w === this.wall) return; const dist = this.planner.getDistanceToWall(pos, w); if (dist < minDist && dist < 50) { minDist = dist; targetWall = w; } }); if (targetWall !== this.wall) { let tempT = targetWall.getClosestT(pos); if (!this.hasEvent("prevent_overlap") || !this.checkOverlap(targetWall, tempT, this.width)) { this.wall.attachedWidgets = this.wall.attachedWidgets.filter(d => d !== this); this.wall = targetWall; this.wall.attachedWidgets.push(this); } } } let rawT = this.wall.getClosestT(pos); const wallLen = this.wall.getLength(), halfW = this.width / 2; const minT = halfW / wallLen, maxT = 1 - (halfW / wallLen); let t = rawT; const snapMargin = 15 / wallLen; if (this.hasEvent("snap_to_corners")) { if (Math.abs(t - minT) < snapMargin) t = minT; if (Math.abs(maxT - t) < snapMargin) t = maxT; } if (this.hasEvent("snap_to_center")) { if (Math.abs(t - 0.5) < snapMargin) t = 0.5; } t = Math.max(minT, Math.min(maxT, t)); if (this.hasEvent("prevent_overlap") && this.checkOverlap(this.wall, t, this.width)) return; this.t = t; this.update(); });
        this.visualGroup.on('dragend', () => { setTimeout(() => { this.isDragging = false; }, 100); this.planner.syncAll(); });
        this.visualGroup.on('click tap', (e) => { if (this.planner.tool === 'select' && !this.isDragging) { this.planner.selectEntity(this, 'widget'); e.cancelBubble = true; } });
    }
    remove() { this.cutter.destroy(); this.visualGroup.destroy(); if (this.leftHandle) { this.leftHandle.destroy(); this.rightHandle.destroy(); } this.wall.attachedWidgets = this.wall.attachedWidgets.filter(d => d !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
    update() {
        console.log(`Updating widget of type: ${this.type}`);
        const p1 = this.wall.startAnchor.position(), p2 = this.wall.endAnchor.position(), dx = p2.x - p1.x, dy = p2.y - p1.y, angle = Math.atan2(dy, dx) * 180 / Math.PI, absPos = { x: p1.x + dx * this.t, y: p1.y + dy * this.t }, thick = this.wall.config.thickness, hw = this.width / 2;
        console.log(`Widget position:`, absPos, `angle: ${angle}`);
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
        this.fillColor = this.type === 'outer' ? '#e5e5e5' : (this.type === 'railing' ? '#374151' : '#f3f4f6'); this.strokeColor = this.type === 'outer' ? '#9ca3af' : (this.type === 'railing' ? '#111827' : '#d1d5db');
        this.wallGroup = new Konva.Group();
        this.poly = new Konva.Line({ fill: this.fillColor, stroke: this.strokeColor, strokeWidth: this.type === 'railing' ? 6 : 2, closed: true, lineJoin: 'miter', shadowColor: 'black', shadowBlur: 10, shadowOffset: {x: 2, y: 2}, shadowOpacity: 0.2 });
        this.poly.parentWall = this;
        this.poly.isWallPoly = true;
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
    setHighlight(isActive) { this.poly.stroke(isActive ? "#4f46e5" : (this.planner.selectedEntity === this ? "#4f46e5" : this.strokeColor)); this.planner.stage.batchDraw(); }
    initEvents() {
        this.poly.on('mouseenter', () => {
            if (this.planner.tool === 'select' || WIDGET_REGISTRY[this.planner.tool]) {
                document.body.style.cursor = 'pointer';
            }
        });
        this.poly.on('mouseleave', () => { document.body.style.cursor = 'default'; });

        this.poly.on('mousedown touchstart', (e) => {
            console.log("Wall mousedown/touchstart event fired.");
            const toolIsWidget = !!WIDGET_REGISTRY[this.planner.tool];
            const pos = this.planner.getPointerPos();
            console.log(`Current tool: ${this.planner.tool}, Is Widget: ${toolIsWidget}, Position:`, pos);

            if (!pos) {
                console.error("Could not get pointer position.");
                return;
            }

            if (toolIsWidget) {
                console.log("Widget tool is active. Attempting to create widget.");
                e.cancelBubble = true;
                let t = this.getClosestT(pos);
                const widget = new PremiumWidget(this.planner, this, t, this.planner.tool);
                this.attachedWidgets.push(widget);
                this.planner.selectEntity(widget, 'widget');
                this.planner.syncAll();
                return;
            }

            if (this.planner.tool === 'select') {
                console.log("Select tool is active. Selecting wall.");
                e.cancelBubble = true;
                this.planner.selectEntity(this, 'wall');
            }
        });

        let startAncPos = {}, startPointer = {};
        this.poly.on('dragstart', (e) => {
            if (this.planner.tool !== 'select') {
                e.target.stopDrag();
                e.cancelBubble = true;
                return;
            }
            this.setHighlight(true);
            const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
            startPointer = { x: pos.x, y: pos.y };
            startAncPos = { x1: this.startAnchor.x, y1: this.startAnchor.y, x2: this.endAnchor.x, y2: this.endAnchor.y };
        });
        this.poly.on('dragmove', () => {
            if (this.planner.tool !== 'select') return;
            const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
            const dx = this.planner.snap(pos.x - startPointer.x), dy = this.planner.snap(pos.y - startPointer.y);
            const proposedStart = { x: startAncPos.x1 + dx, y: startAncPos.y1 + dy };
            const proposedEnd = { x: startAncPos.x2 + dx, y: startAncPos.y2 + dy };
            if (this.hasEvent("stop_collision") && this.planner.checkWallIntersection(proposedStart, proposedEnd, [this])) return;
            this.startAnchor.node.position(proposedStart);
            this.endAnchor.node.position(proposedEnd);
            this.poly.position({ x: 0, y: 0 }); this.planner.syncAll();
        });
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
            if (connectedWalls.length >= 1) {
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

        // Railing explicit color update in fallback drawing mode
        if (this.type === 'railing') {
            const rConf = RAILING_REGISTRY[this.configId || 'rail_1'];
            if (rConf && rConf.color) this.poly.fill('#' + rConf.color.toString(16).padStart(6, '0'));
        }
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
        this.rotHandle.on('dragmove', (e) => { e.cancelBubble = true; const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition(); const angleRad = Math.atan2(pos.y - this.group.y(), pos.x - this.group.x()); this.rotation = (angleRad * 180 / Math.PI) + 90; this.group.rotation(this.rotation); this.rotHandle.position({ x: this.width / 2, y: -15 }); this.planner.syncAll(); });
    }
    update() { this.group.width(this.width); this.group.height(this.depth); this.group.offsetX(this.width / 2); this.group.offsetY(this.depth / 2); this.body.width(this.width); this.body.height(this.depth); this.group.rotation(this.rotation); this.rotHandle.x(this.width / 2); }
    remove() { this.group.destroy(); this.planner.furniture = this.planner.furniture.filter(f => f !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
}


export class FloorPlanner {
    constructor(containerEl) {
        this.container = containerEl; this.tool = "outer"; this.currentUnit = "ft"; this.drawing = false; this.lastAnchor = null; this.startAnchor = null; this.drawingStair = null; this.preview = null;
        this.activeCategory = 'tools';
        this.walls = []; this.anchors = []; this.roomPaths = []; this.stairs = []; this.furniture = []; this.roofs = []; this.selectedEntity = null; this.selectedType = null; this.selectedNodeIndex = -1;
        this.events = new EventEmitter();
        this.initKonva(); this.drawGrid(); this.initHUD(); this.initStageEvents();
    }

    on(eventName, listener) { return this.events.on(eventName, listener); }
    off(eventName, listener) { this.events.off(eventName, listener); }
    emit(eventName, ...args) { this.events.emit(eventName, ...args); }

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

    initHUD() {
        this.snapGlow = new Konva.Circle({ radius: 8, fill: '#10b981', shadowColor: '#10b981', shadowBlur: 15, opacity: 0.8, visible: false, listening: false });
        this.uiLayer.add(this.snapGlow);

        this.splitPreviewGlow = new Konva.Circle({ radius: 5, fill: '#ef4444', opacity: 0.8, visible: false, listening: false });
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
        if (this.selectedEntity && this.selectedEntity.setHighlight) {
            this.selectedEntity.setHighlight(false);
        }

        this.selectedEntity = entity; this.selectedType = type; this.selectedNodeIndex = nodeIndex;

        if (entity && entity.setHighlight) {
             entity.setHighlight(true);
        }
        this.emit('selectionchange', entity, type, nodeIndex);
    }

    updateToolStates() {
        const cat = this.activeCategory || 'tools';
        const isSelect = this.tool === "select";
        const isSplitWall = this.tool === "split_wall";
        const isWidget = !!WIDGET_REGISTRY[this.tool];
        const allowAll = (cat === 'tools' || cat === 'advanced');

        this.walls.forEach(w => {
            let isRailing = w.type === 'railing';
            let canEditThisWall = false;

            if (allowAll) {
                canEditThisWall = isSelect || isSplitWall;
            } else if (cat === 'walls') {
                canEditThisWall = !isRailing && (isSelect || isSplitWall);
            } else if (cat === 'common') {
                canEditThisWall = isRailing && (isSelect || isSplitWall);
            }

            if(w.poly) { 
                w.poly.setAttr('draggable', canEditThisWall); 
                w.poly.setAttr('listening', canEditThisWall || isWidget || isSplitWall); 
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
        if (this.roofs) {
            this.roofs.forEach(r => { 
                let canEdit = isSelect && (allowAll || cat === 'structures');
                if(r.group) { r.group.setAttr('draggable', canEdit); r.group.setAttr('listening', canEdit); } 
            });
        }
        if (this.balconies) {
            this.balconies.forEach(b => { 
                let canEdit = isSelect && (allowAll || cat === 'structures');
                if(b.group) { b.group.setAttr('draggable', canEdit); b.group.setAttr('listening', canEdit); } 
            });
        }

        // FORCE LAYER LISTENING OFF DURING DRAWING OR RESTRICT BY CATEGORY
        if (this.wallLayer) { this.wallLayer.listening(allowAll || cat === "common" || cat === "walls" || cat === "doors_windows" || cat === "structures" || isWidget || isSplitWall); }
        if (this.widgetLayer) { this.widgetLayer.listening(allowAll || cat === "doors_windows" || cat === "structures"); }
        if (this.furnitureLayer) { this.furnitureLayer.listening(allowAll || cat === "furniture"); }
        if (this.roofLayer) { this.roofLayer.listening(allowAll || cat === "structures"); }
    }

    getOrCreateAnchor(x, y) { let a = this.anchors.find(a => Math.hypot(a.x - x, a.y - y) < SNAP_DIST); if (a) return a; const newAnchor = new Anchor(this, x, y); this.anchors.push(newAnchor); return newAnchor; }
    deselectAll() { if (this.selectedEntity) { this.selectEntity(null); } this.anchors.forEach(a => a.hide()); this.syncAll(); }
    syncAll() { this.buildingCenter = null; this.walls.forEach(w => w.update()); this.stairs.forEach(s => s.update()); this.furniture.forEach(f => f.update()); this.roofs.forEach(r => r.update()); this.mainLayer.batchDraw(); this.detectRooms(); this.emit('sync'); }

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
        this.drawing = false; this.lastAnchor = null; this.startAnchor = null;
        this.preview?.destroy(); this.preview = null;
        this.hideSnapGlow(); this.drawGuideLine(0,0,0,0, false); this.hideInfoBadge();
        this.deselectAll();
    }

    initStageEvents() {

        this.stage.on("mousedown touchstart", (e) => {
            const target = e.target;
            const pos = this.getPointerPos();
            if (!pos) return;
            
            // Logic for placing widgets on walls and selecting walls has been moved to PremiumWall.initEvents
            // This makes event handling more localized and robust.

            if (target.isWallPoly) {
                // Do not intercept if actively drawing a new railing or wall
                if (this.drawing) {
                    return;
                }
                // This event is now handled by the polygon itself in PremiumWall.
                // We let the event bubble up if not handled there (e.g., for dragging the stage).
                return;
            }

            if (this.tool === 'roof') return;
            if (this.tool === 'split') {
                const hitThreshold = 20 / (this.stage.scaleX() || 1);

                for (let w of this.walls) {
                    if (!WALL_REGISTRY[w.type] || !WALL_REGISTRY[w.type].events.includes('split_edge')) continue;
                    const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                    const proj = this.getClosestPointOnSegment(pos, p1, p2);
                    if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < hitThreshold) {
                        if (Math.hypot(proj.x - p1.x, proj.y - p1.y) < hitThreshold || Math.hypot(proj.x - p2.x, proj.y - p2.y) < hitThreshold) return;

                        const newAnchor = this.getOrCreateAnchor(proj.x, proj.y);
                        const oldEnd = w.endAnchor;
                        w.endAnchor = newAnchor;
                        const newWall = new PremiumWall(this, newAnchor, oldEnd, w.type);
                        this.walls.push(newWall);

                        this.tool = 'select'; this.updateToolStates();
                        this.selectEntity(newWall, 'wall');
                        newAnchor.show();
                        this.syncAll();
                        this.splitPreviewGlow.hide();
                        this.uiLayer.batchDraw();
                        return;
                    }
                }

                if (this.balconies) {
                    for (let b of this.balconies) {
                        if (!WIDGET_REGISTRY['balcony'] || !WIDGET_REGISTRY['balcony'].events.includes('split_edge')) continue;
                        const pts = b.vertices || b.points;
                        if (!pts || pts.length < 3) continue;

                        const transform = b.group.getTransform();
                        for (let i = 0; i < pts.length; i++) {
                            const p1 = transform.point(pts[i]);
                            const p2 = transform.point(pts[(i + 1) % pts.length]);
                            const proj = this.getClosestPointOnSegment(pos, p1, p2);
                            if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < hitThreshold) {
                                const localProj = transform.copy().invert().point(proj);
                                if (b.splitEdge) {
                                    b.splitEdge(i, localProj);
                                    this.tool = 'select'; this.updateToolStates();
                                    this.selectEntity(b, 'balcony');
                                }
                                this.splitPreviewGlow.hide();
                                this.uiLayer.batchDraw();
                                return;
                            }
                        }
                    }
                }
                return;
            }

            if (e.target === this.stage || e.target.getLayer() === this.bgLayer) {
                 this.deselectAll();
            }

            const wallConfig = WALL_REGISTRY[this.tool];
            let targetPos = { x: this.snap(pos.x), y: this.snap(pos.y) };

            if (this.tool === 'stair') { if (!this.drawingStair) { this.drawingStair = new PremiumStair(this, targetPos.x, targetPos.y); this.stairs.push(this.drawingStair); } else { this.drawingStair.addPoint(targetPos.x, targetPos.y); } this.syncAll(); return; }
            if (this.tool === 'balcony') {
                if (!this.balconies) this.balconies = [];
                const newBalcony = new PremiumBalcony(this, targetPos.x, targetPos.y, 'rectangle');
                this.balconies.push(newBalcony);
                this.selectEntity(newBalcony, 'balcony');
                this.tool = 'select'; this.updateToolStates();
                this.syncAll();
                return;
            }
            if (!wallConfig) return;

            let targetSnapWall = null;
            if (wallConfig && wallConfig.events.includes("snap_to_wall")) {
                let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < SNAP_DIST);
                if (a) { targetPos = { x: a.x, y: a.y }; targetSnapWall = this.walls.find(w => w.startAnchor === a || w.endAnchor === a); }
                else { 
                    let closestDist = SNAP_DIST, closestPoint = null; 
                    for (let w of this.walls) { 
                        let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position()); 
                        if (this.tool === 'railing') {
                            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                            const vdx = p2.x - p1.x, vdy = p2.y - p1.y, vlen = Math.hypot(vdx, vdy);
                            if (vlen > 0) {
                                const n = { x: -vdy/vlen, y: vdx/vlen }, ht = (w.thickness || w.config.thickness) / 2;
                                const e1 = { x: proj.x + n.x * ht, y: proj.y + n.y * ht }, e2 = { x: proj.x - n.x * ht, y: proj.y - n.y * ht };
                                const d1 = Math.hypot(pos.x - e1.x, pos.y - e1.y), d2 = Math.hypot(pos.x - e2.x, pos.y - e2.y);
                                if (d1 < closestDist) { closestDist = d1; closestPoint = e1; targetSnapWall = w; }
                                if (d2 < closestDist) { closestDist = d2; closestPoint = e2; targetSnapWall = w; }
                            }
                            continue;
                        }
                        let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); 
                        if (dist < closestDist) { closestDist = dist; closestPoint = proj; targetSnapWall = w; } 
                    } 
                    if (closestPoint) targetPos = closestPoint; 
                }
            }

            if (this.drawing && wallConfig && wallConfig.events.includes("stop_collision") && this.checkWallIntersection(this.lastAnchor.position(), targetPos, [targetSnapWall])) return;

            const currentAnchor = this.getOrCreateAnchor(targetPos.x, targetPos.y);
            if (!this.drawing) { this.drawing = true; this.lastAnchor = currentAnchor; this.startAnchor = currentAnchor; currentAnchor.show(); }
            else { if (this.lastAnchor !== currentAnchor) { this.walls.push(new PremiumWall(this, this.lastAnchor, currentAnchor, this.tool)); } if (currentAnchor === this.startAnchor) this.finishChain(); else { this.lastAnchor = currentAnchor; currentAnchor.show(); } }
            this.syncAll();
        });

        this.stage.on("mousemove touchmove", () => {
            const pos = this.getPointerPos();
            if (!pos) return;

            let rawPos = { x: this.snap(pos.x), y: this.snap(pos.y) };

            if (this.drawingStair) { this.drawingStair.updateLastPoint(rawPos.x, rawPos.y); return; }
            if (!this.drawing) return;
            const wallConfig = WALL_REGISTRY[this.tool];

            let dxAxis = rawPos.x - this.lastAnchor.x, dyAxis = rawPos.y - this.lastAnchor.y, rawAngle = Math.atan2(dyAxis, dxAxis) * 180 / Math.PI, distAxis = Math.hypot(dxAxis, dyAxis), snappedToAxis = false;
            if (this.drawing) {
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
                        if (this.tool === 'railing') {
                            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                            const vdx = p2.x - p1.x, vdy = p2.y - p1.y, vlen = Math.hypot(vdx, vdy);
                            if (vlen > 0) {
                                const n = { x: -vdy/vlen, y: vdx/vlen }, ht = (w.thickness || w.config.thickness) / 2;
                                const e1 = { x: proj.x + n.x * ht, y: proj.y + n.y * ht }, e2 = { x: proj.x - n.x * ht, y: proj.y - n.y * ht };
                                const d1 = Math.hypot(pos.x - e1.x, pos.y - e1.y), d2 = Math.hypot(pos.x - e2.x, pos.y - e2.y);
                                if (d1 < closestDist && !snappedObj) { closestDist = d1; closestPoint = e1; targetSnapWall = w; snappedObj = true; }
                                if (d2 < closestDist && !snappedObj) { closestDist = d2; closestPoint = e2; targetSnapWall = w; snappedObj = true; }
                            }
                            continue;
                        }
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
            this.walls.forEach(w => w.setHighlight(w === targetSnapWall || w === this.selectedEntity));

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

        // --- Hip Roof Drawing Mode Logic ---
        this.stage.on("mousedown.roof touchstart.roof", (e) => {
            if (this.tool !== 'roof') return;
            const pos = this.getPointerPos();
            if (!pos) return;

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
            for (let w of this.walls) {
                const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y); let d2 = Math.hypot(pos.x - p2.x, pos.y - p2.y);
                if (d1 < closestDist) { closestDist = d1; snap = p1; }
                if (d2 < closestDist) { closestDist = d2; snap = p2; }
                let proj = this.getClosestPointOnSegment(pos, p1, p2); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                if (dist < closestDist) { closestDist = dist; snap = proj; }
            }

            if (!this.drawingRoofPoints) {
                this.drawingRoofPoints = [snap];
                this.roofPreview = new Konva.Line({ points: [snap.x, snap.y, snap.x, snap.y], stroke: '#f59e0b', strokeWidth: 4, dash: [6, 4], fill: 'rgba(245, 158, 11, 0.3)' });
                this.uiLayer.add(this.roofPreview);
            } else {
                const startP = this.drawingRoofPoints[0];
                if (Math.hypot(snap.x - startP.x, snap.y - startP.y) < SNAP_DIST && this.drawingRoofPoints.length > 2) {
                    const roof = new PremiumHipRoof(this, this.drawingRoofPoints);
                    this.roofs.push(roof); this.selectEntity(roof, 'roof');
                    this.drawingRoofPoints = null; this.roofPreview.destroy(); this.roofPreview = null;
                    this.tool = 'select'; this.updateToolStates(); this.syncAll();
                } else {
                    this.drawingRoofPoints.push(snap);
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
                thickness: w.thickness || w.config.thickness,
                height: w.height !== undefined ? w.height : (w.config?.height || 120),
                type: w.type,
                configId: w.configId,
                pts: w.poly ? w.poly.points() : null,
                widgets: w.attachedWidgets.map(wid => ({
                    t: wid.t, configId: wid.type, width: wid.width
                })),
                decors: w.attachedDecor ? w.attachedDecor.map(d => ({
                    id: d.id, configId: d.configId, side: d.side,
                    localX: d.localX, localY: d.localY, localZ: d.localZ,
                    width: d.width, height: d.height, depth: d.depth, tileSize: d.tileSize,
                    faces: { front: d.faces.front, back: d.faces.back, left: d.faces.left, right: d.faces.right }
                })) : []
            })),
            furniture: this.furniture.map(f => ({
                x: f.group.x(), y: f.group.y(), rotation: f.rotation,
                width: f.width, depth: f.depth, height: f.height, configId: f.config.id
            })),
            stairs: this.stairs.map(s => ({
                path: s.path.map(p => ({ x: p.x, y: p.y, shape: p.shape }))
            })),
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
                    const a1 = this.getOrCreateAnchor(wData.startX, wData.startY);
                    const a2 = this.getOrCreateAnchor(wData.endX, wData.endY);
                    const wall = new PremiumWall(this, a1, a2, wData.type);
                    if (wData.thickness) wall.thickness = wData.thickness;
                    if (wData.height) wall.height = wData.height;
                    if (wData.configId) wall.configId = wData.configId;
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

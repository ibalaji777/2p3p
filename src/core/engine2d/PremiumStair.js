import Konva from 'konva';
import { WALL_HEIGHT } from '../registry.js';

export class PremiumStair {
    constructor(planner, startX, startY) {
        this.planner = planner; 
        this.config = { width: 40, height: WALL_HEIGHT, treadDepth: 11, riserHeight: 7.5 };
        this.path = [ { x: startX, y: startY, shape: 'flat' }, { x: startX, y: startY, shape: 'flat' } ];
        this.group = new Konva.Group({ draggable: true }); 
        this.stepsGroup = new Konva.Group(); 
        this.handlesGroup = new Konva.Group({ visible: false });
        this.handles = []; this.stepData3D = []; this.basePath = null;
        
        this.group.add(this.stepsGroup, this.handlesGroup); 
        this.planner.widgetLayer.add(this.group);
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
            if (idx === 0) { 
                let aStart = { x: flight.sP.x + flight.dir.x * 5, y: flight.sP.y + flight.dir.y * 5 };
                let aEnd = { x: flight.sP.x + flight.dir.x * Math.min(40, flight.effDist), y: flight.sP.y + flight.dir.y * Math.min(40, flight.effDist) }; 
                this.stepsGroup.add(new Konva.Arrow({ points: [aStart.x, aStart.y, aEnd.x, aEnd.y], fill: '#111827', stroke: '#111827', strokeWidth: 2, pointerLength: 6, pointerWidth: 6 })); 
                let textAngle = flight.angle * 180 / Math.PI; 
                let upText = new Konva.Text({ x: aStart.x, y: aStart.y, text: "UP", fontSize: 10, fontStyle: 'bold', fill: '#111827', rotation: textAngle }); 
                upText.offset({x: upText.width()/2, y: upText.height() + 10}); this.stepsGroup.add(upText); 
            }
        });
    }
    
    remove() { this.group.destroy(); this.planner.stairs = this.planner.stairs.filter(s => s !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
}
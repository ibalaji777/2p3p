import Konva from 'konva';

export class StairV4Node {
    constructor(planner, data) {
        this.planner = planner;
        this.id = data.id || 'stairv4_' + Math.random().toString(36).substr(2, 9);
        this.type = data.type || 'stair_v4_node';
        this.x = data.x || 0;
        this.y = data.y || 0;
        this.rotation = data.rotation || 0;
        this.elevation = data.elevation || 0;
        this.systemId = data.systemId || this.id;
        
        this.connections = data.connections || [];
        
        this.group = new Konva.Group({ x: this.x, y: this.y, rotation: this.rotation, draggable: true });
        this.poly = new Konva.Line({ stroke: '#3b82f6', strokeWidth: 2, closed: true, fill: 'rgba(59, 130, 246, 0.2)' });
        this.contentGroup = new Konva.Group();
        this.handlesGroup = new Konva.Group({ visible: false });
        this.snapPointsGroup = new Konva.Group({ listening: false });

        this.group.add(this.poly, this.contentGroup, this.handlesGroup, this.snapPointsGroup);
        if (this.planner.widgetLayer) this.planner.widgetLayer.add(this.group);

        this.initBaseEvents();
    }

    getSockets() { return []; }

    getGlobalSocket(spotId) {
        const socket = this.getSockets().find(s => s.id === spotId);
        if (!socket) return null;
        const rad = this.rotation * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        return {
            x: this.x + socket.localX * cos - socket.localY * sin,
            y: this.y + socket.localX * sin + socket.localY * cos,
            angle: this.rotation + socket.localAngle,
            elev: this.elevation + socket.elevOffset
        };
    }

    initBaseEvents() {
        this.group.on('mouseenter', () => { if (this.planner.tool === 'select') document.body.style.cursor = 'pointer'; });
        this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        
        this.group.on('click tap', (e) => {
            if (this.planner.tool === 'select') {
                e.cancelBubble = true;
                this.planner.selectEntity(this, 'stair');
            }
        });

        this.group.on('dragstart', () => {
            this.planner.selectEntity(this, 'stair');
            this.planner.stairs.forEach(s => { if (s.showSnapPoints && s !== this) s.showSnapPoints(true); });
        });

        this.group.on('dragmove', (e) => {
            if (e.target !== this.group) return;
            this.x = this.group.x();
            this.y = this.group.y();
            StaircaseV4Solver.solve(this.planner, this.systemId, this.id);
            this.planner.syncAll();
        });

        this.group.on('dragend', (e) => {
            if (e.target !== this.group) return;
            this.planner.stairs.forEach(s => { if (s.showSnapPoints) s.showSnapPoints(false); });
            this.trySnap();
            StaircaseV4Solver.solve(this.planner, this.systemId, this.id);
            this.planner.syncAll();
        });
    }

    setHighlight(isActive) {
        this.poly.stroke(isActive ? '#f59e0b' : '#3b82f6');
        this.poly.strokeWidth(isActive ? 3 : 2);
        this.handlesGroup.visible(isActive);
        this.snapPointsGroup.listening(isActive);
        this.showSnapPoints(isActive);
        if (isActive) this.group.moveToTop();
        this.planner.stage.batchDraw();
    }

    remove() {
        [...this.connections].forEach(c => StaircaseV4Solver.disconnect(this.planner, this.id, c.mySpot));
        this.group.destroy();
        this.planner.stairs = this.planner.stairs.filter(s => s !== this);
        this.planner.syncAll();
    }

    showSnapPoints(active) {
        this.snapPointsGroup.destroyChildren();
        if (!active) {
            this.planner.stage.batchDraw();
            return;
        }
        
        const sockets = this.getSockets();
        sockets.forEach(s => {
            const isConn = this.connections.find(c => c.mySpot === s.id);
            const pt = new Konva.Circle({
                x: s.localX, y: s.localY, radius: 12,
                fill: isConn ? '#ef4444' : '#10b981',
                opacity: isConn ? 0.9 : 0.5,
                listening: true
            });
            
            pt.on('mouseenter', () => document.body.style.cursor = 'pointer');
            pt.on('mouseleave', () => document.body.style.cursor = 'default');
            
            pt.on('click tap', (e) => {
                e.cancelBubble = true;
                if (isConn) {
                    StaircaseV4Solver.disconnect(this.planner, this.id, s.id);
                }
            });
            
            this.snapPointsGroup.add(pt);
            
            if (!isConn) {
                const rad = s.localAngle * Math.PI / 180;
                const ax = s.localX + Math.cos(rad) * 25;
                const ay = s.localY + Math.sin(rad) * 25;
                this.snapPointsGroup.add(new Konva.Arrow({
                    x: s.localX, y: s.localY, points: [0, 0, ax - s.localX, ay - s.localY],
                    stroke: '#10b981', fill: '#10b981', strokeWidth: 3, pointerLength: 6, pointerWidth: 6, listening: false
                }));
            }
        });
        this.planner.stage.batchDraw();
    }

    trySnap() {
        const mySockets = this.getSockets().filter(s => !this.connections.find(c => c.mySpot === s.id));
        for (let s of mySockets) {
            const myGlob = this.getGlobalSocket(s.id);
            for (let other of this.planner.stairs) {
                if (other.id === this.id || !other.getSockets) continue;
                if (other.systemId === this.systemId) continue;
                
                const otherSockets = other.getSockets().filter(os => !other.connections.find(c => c.mySpot === os.id));
                for (let os of otherSockets) {
                    const osGlob = other.getGlobalSocket(os.id);
                    if (Math.hypot(myGlob.x - osGlob.x, myGlob.y - osGlob.y) < 40) {
                        StaircaseV4Solver.connect(this.planner, this, s.id, other, os.id);
                        return;
                    }
                }
            }
        }
    }

    update() {
        this.updateGeometry();
    }
    
    updateGeometry() {
        this.group.position({ x: this.x, y: this.y });
        this.group.rotation(this.rotation);
    }
}

export class StairV4Flight extends StairV4Node {
    constructor(planner, data) {
        super(planner, data);
        this.type = 'stair_v4_flight';
        this.stepCount = data.stepCount || 10;
        this.stepDepth = data.stepDepth || 28;
        this.stepHeight = data.stepHeight || 17.5;
        this.width = data.width || 100;
        this.length = this.stepCount * this.stepDepth;

        this.initFlightHandles();
        this.update();
    }

    getSockets() {
        const l = this.stepCount * this.stepDepth;
        return [
            { id: 'start', localX: 0, localY: 0, localAngle: -90, elevOffset: 0 },
            { id: 'end', localX: 0, localY: l, localAngle: 90, elevOffset: this.stepCount * this.stepHeight }
        ];
    }

    initFlightHandles() {
        this.rotHandle = new Konva.Circle({ radius: 8, fill: '#3b82f6', stroke: 'white', strokeWidth: 2, draggable: true });
        this.rotHandle.on('mouseenter', () => document.body.style.cursor = 'crosshair');
        this.rotHandle.on('mouseleave', () => document.body.style.cursor = 'default');
        this.rotHandle.on('dragmove', (e) => {
            e.cancelBubble = true;
            const pos = this.planner.stage.getPointerPosition();
            if (!pos) return;
            const groupPos = this.group.getAbsolutePosition();
            const angleRad = Math.atan2(pos.y - groupPos.y, pos.x - groupPos.x);
            let newRot = (angleRad * 180 / Math.PI) - 90;
            
            if (this.connections.length > 0) {
                let anchorConn = this.connections.find(c => c.mySpot === 'start') || this.connections[0];
                const parent = this.planner.stairs.find(s => s.id === anchorConn.targetId);
                if (parent) {
                    const pSocketGlob = parent.getGlobalSocket(anchorConn.targetSpot);
                    const mSocketLoc = this.getSockets().find(s => s.id === anchorConn.mySpot);
                    
                    let reqGlobAngle = newRot + mSocketLoc.localAngle;
                    let newUserRot = reqGlobAngle - 180 - pSocketGlob.angle;
                    newUserRot = Math.round(newUserRot / 15) * 15;
                    
                    anchorConn.userRot = newUserRot;
                    const pConn = parent.connections.find(c => c.targetId === this.id && c.mySpot === anchorConn.targetSpot);
                    if (pConn) pConn.userRot = -newUserRot;
                    
                    StaircaseV4Solver.solve(this.planner, this.systemId, parent.id);
                    this.planner.syncAll();
                    return;
                }
            }
            
            this.rotation = Math.round(newRot / 15) * 15;
            this.update();
            StaircaseV4Solver.solve(this.planner, this.systemId, this.id);
            this.planner.syncAll();
        });
        
        this.lenHandle = new Konva.Rect({ width: 12, height: 12, fill: 'white', stroke: '#3b82f6', strokeWidth: 2, cornerRadius: 6, offsetX: 6, offsetY: 6, draggable: true });
        this.lenHandle.on('mouseenter', () => document.body.style.cursor = 'ns-resize');
        this.lenHandle.on('mouseleave', () => document.body.style.cursor = 'default');
        this.lenHandle.on('dragmove', (e) => {
            e.cancelBubble = true;
            let newL = this.lenHandle.y();
            let newSteps = Math.round(newL / this.stepDepth);
            if (newSteps < 3) newSteps = 3;
            this.stepCount = newSteps;
            this.update(); 
            StaircaseV4Solver.solve(this.planner, this.systemId, this.id); 
            this.planner.syncAll();
        });

        this.handlesGroup.add(this.rotHandle, this.lenHandle);
    }

    update() {
        this.length = this.stepCount * this.stepDepth;
        const w = this.width, l = this.length;
        
        super.updateGeometry();
        
        this.poly.points([-w/2, 0, w/2, 0, w/2, l, -w/2, l]);
        this.rotHandle.position({ x: 0, y: l + 30 });
        this.lenHandle.position({ x: 0, y: l });
        
        this.contentGroup.destroyChildren();
        for(let i=1; i<this.stepCount; i++) {
            const sy = i * this.stepDepth;
            this.contentGroup.add(new Konva.Line({ points: [-w/2, sy, w/2, sy], stroke: '#3b82f6', strokeWidth: 1 }));
        }
        this.contentGroup.add(new Konva.Arrow({ points: [0, 5, 0, Math.min(l-5, 40)], fill: '#111827', stroke: '#111827', strokeWidth: 2, pointerLength: 6, pointerWidth: 6 }));
        
        if (this.snapPointsGroup.listening()) this.showSnapPoints(true);
    }
}

export class StairV4Landing extends StairV4Node {
    constructor(planner, data) {
        super(planner, data);
        this.type = 'stair_v4_landing';
        this.width = data.width || 100;
        this.length = data.length || 100;
        
        this.initLandingHandles();
        this.update();
    }

    getSockets() {
        const w = this.width, l = this.length;
        return [
            { id: 'south_center', localX: 0, localY: 0, localAngle: -90, elevOffset: 0 },
            { id: 'south_left', localX: -w/3, localY: 0, localAngle: -90, elevOffset: 0 },
            { id: 'south_right', localX: w/3, localY: 0, localAngle: -90, elevOffset: 0 },
            
            { id: 'north_center', localX: 0, localY: l, localAngle: 90, elevOffset: 0 },
            { id: 'north_left', localX: -w/3, localY: l, localAngle: 90, elevOffset: 0 },
            { id: 'north_right', localX: w/3, localY: l, localAngle: 90, elevOffset: 0 },
            
            { id: 'west_center', localX: -w/2, localY: l/2, localAngle: 180, elevOffset: 0 },
            { id: 'west_top', localX: -w/2, localY: l*0.75, localAngle: 180, elevOffset: 0 },
            { id: 'west_bot', localX: -w/2, localY: l*0.25, localAngle: 180, elevOffset: 0 },
            
            { id: 'east_center', localX: w/2, localY: l/2, localAngle: 0, elevOffset: 0 },
            { id: 'east_top', localX: w/2, localY: l*0.75, localAngle: 0, elevOffset: 0 },
            { id: 'east_bot', localX: w/2, localY: l*0.25, localAngle: 0, elevOffset: 0 }
        ];
    }

    initLandingHandles() {
        const createHandle = (name) => {
            const h = new Konva.Rect({ width: 12, height: 12, fill: 'white', stroke: '#10b981', strokeWidth: 2, cornerRadius: 6, offsetX: 6, offsetY: 6, draggable: true, name });
            h.on('mouseenter', () => document.body.style.cursor = name.includes('w') ? 'ew-resize' : 'ns-resize');
            h.on('mouseleave', () => document.body.style.cursor = 'default');
            this.handlesGroup.add(h);
            return h;
        };
        
        this.wRight = createHandle('wRight');
        this.wLeft = createHandle('wLeft');
        this.lBot = createHandle('lBot');

        this.wRight.on('dragmove', (e) => {
            e.cancelBubble = true;
            let newW = this.wRight.x() * 2;
            if (newW < 40) newW = 40;
            this.width = newW;
            this.update(); StaircaseV4Solver.solve(this.planner, this.systemId, this.id); this.planner.syncAll();
        });
        
        this.wLeft.on('dragmove', (e) => {
            e.cancelBubble = true;
            let newW = -this.wLeft.x() * 2;
            if (newW < 40) newW = 40;
            this.width = newW;
            this.update(); StaircaseV4Solver.solve(this.planner, this.systemId, this.id); this.planner.syncAll();
        });
        
        this.lBot.on('dragmove', (e) => {
            e.cancelBubble = true;
            let newL = this.lBot.y();
            if (newL < 40) newL = 40;
            this.length = newL;
            this.update(); StaircaseV4Solver.solve(this.planner, this.systemId, this.id); this.planner.syncAll();
        });
    }

    update() {
        const w = this.width, l = this.length;
        super.updateGeometry();
        
        this.poly.points([-w/2, 0, w/2, 0, w/2, l, -w/2, l]);
        this.wRight.position({ x: w/2, y: l/2 });
        this.wLeft.position({ x: -w/2, y: l/2 });
        this.lBot.position({ x: 0, y: l });
        
        this.contentGroup.destroyChildren();
        
        if (this.snapPointsGroup.listening()) this.showSnapPoints(true);
    }
}

export const StaircaseV4Solver = {
    connect: function(planner, nodeA, spotAId, nodeB, spotBId) {
        if (nodeA.connections.find(c => c.mySpot === spotAId)) return;
        if (nodeB.connections.find(c => c.mySpot === spotBId)) return;
        
        nodeA.connections.push({ mySpot: spotAId, targetId: nodeB.id, targetSpot: spotBId, userRot: 0 });
        nodeB.connections.push({ mySpot: spotBId, targetId: nodeA.id, targetSpot: spotAId, userRot: 0 });
        
        const newSysId = nodeB.systemId;
        const oldSysId = nodeA.systemId;
        planner.stairs.forEach(s => {
            if (s.systemId === oldSysId) s.systemId = newSysId;
        });
        
        this.solve(planner, newSysId, nodeB.id);
    },
    
    disconnect: function(planner, nodeId, spotId) {
        const nodeA = planner.stairs.find(s => s.id === nodeId);
        if (!nodeA) return;
        const conn = nodeA.connections.find(c => c.mySpot === spotId);
        if (!conn) return;
        
        const nodeB = planner.stairs.find(s => s.id === conn.targetId);
        
        nodeA.connections = nodeA.connections.filter(c => c.mySpot !== spotId);
        if (nodeB) {
            nodeB.connections = nodeB.connections.filter(c => c.mySpot !== conn.targetSpot);
        }
        
        this._rebuildSystemId(planner, nodeA, 'sys_' + Math.random().toString(36).substr(2, 9));
        if (nodeB) {
            this._rebuildSystemId(planner, nodeB, 'sys_' + Math.random().toString(36).substr(2, 9));
        }
        
        nodeA.update();
        if (nodeB) nodeB.update();
    },
    
    _rebuildSystemId: function(planner, startNode, newSysId) {
        const visited = new Set();
        const q = [startNode];
        while (q.length > 0) {
            const curr = q.shift();
            if (visited.has(curr.id)) continue;
            visited.add(curr.id);
            curr.systemId = newSysId;
            
            curr.connections.forEach(c => {
                const n = planner.stairs.find(s => s.id === c.targetId);
                if (n && !visited.has(n.id)) q.push(n);
            });
        }
    },
    
    solve: function(planner, systemId, rootNodeId) {
        const nodes = planner.stairs.filter(s => s.systemId === systemId);
        if (nodes.length === 0) return;
        let root = nodes.find(n => n.id === rootNodeId) || nodes[0];
        
        const visited = new Set([root.id]);
        const q = [root];
        
        while(q.length > 0) {
            const curr = q.shift();
            
            curr.connections.forEach(conn => {
                if (!visited.has(conn.targetId)) {
                    visited.add(conn.targetId);
                    const target = nodes.find(n => n.id === conn.targetId);
                    if (target) {
                        this._alignTarget(curr, conn.mySpot, target, conn.targetSpot, conn.userRot);
                        target.updateGeometry();
                        q.push(target);
                    }
                }
            });
            curr.updateGeometry();
        }
    },
    
    _alignTarget: function(source, sourceSpotId, target, targetSpotId, userRot) {
        const sSocketGlobal = source.getGlobalSocket(sourceSpotId);
        const tSocketLocal = target.getSockets().find(s => s.id === targetSpotId);
        if (!sSocketGlobal || !tSocketLocal) return;
        
        let requiredGlobalAngle = sSocketGlobal.angle + 180 + userRot;
        target.rotation = requiredGlobalAngle - tSocketLocal.localAngle;
        
        const rad = target.rotation * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        
        target.x = sSocketGlobal.x - (tSocketLocal.localX * cos - tSocketLocal.localY * sin);
        target.y = sSocketGlobal.y - (tSocketLocal.localX * sin + tSocketLocal.localY * cos);
        
        target.elevation = sSocketGlobal.elev - tSocketLocal.elevOffset;
    }
};
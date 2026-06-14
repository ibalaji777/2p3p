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

        // Render handles on top of snap points so they can be grabbed when connected
        this.group.add(this.poly, this.contentGroup, this.snapPointsGroup, this.handlesGroup);
        if (this.planner.widgetLayer) this.planner.widgetLayer.add(this.group);

        this.initBaseEvents();
    }

    getSockets() { return []; }
    getEdges() { return []; }

    getGlobalEdgeSocket(edgeId, offset) {
        const edge = this.getEdges().find(e => e.id === edgeId);
        if (!edge) return null;
        const localX = edge.p1.x + (edge.p2.x - edge.p1.x) * offset;
        const localY = edge.p1.y + (edge.p2.y - edge.p1.y) * offset;
        const rad = this.rotation * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        return {
            x: this.x + localX * cos - localY * sin,
            y: this.y + localX * sin + localY * cos,
            angle: this.rotation + edge.localAngle,
            elev: this.elevation + edge.elevOffset
        };
    }

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
            this.planner.stairs.forEach(s => { if (s.showSnapPoints && s !== this) s.showSnapPoints(true, true); });
        });

        this.group.on('dragmove', (e) => {
            if (e.target !== this.group) return;
            
            // If this is a flight and it's connected to a landing, slide it along the edge!
            if (this.type === 'stair_v4_flight') {
                const landingConn = this.connections.find(c => {
                    const target = this.planner.stairs.find(s => s.id === c.targetId);
                    return target && target.type === 'stair_v4_landing';
                });
                
                if (landingConn) {
                    const landing = this.planner.stairs.find(s => s.id === landingConn.targetId);
                    const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
                    
                    const edge = landing.getEdges().find(e => e.id === landingConn.targetSpot);
                    if (edge) {
                        const p1Glob = landing.getGlobalEdgeSocket(edge.id, 0);
                        const p2Glob = landing.getGlobalEdgeSocket(edge.id, 1);
                        const dx = p2Glob.x - p1Glob.x; const dy = p2Glob.y - p1Glob.y; const len = Math.hypot(dx, dy);
                        if (len > 0) {
                            let t = ((pos.x - p1Glob.x) * dx + (pos.y - p1Glob.y) * dy) / (len * len);
                            const halfWT = (this.width / 2) / len;
                            t = Math.max(halfWT, Math.min(1 - halfWT, t));
                            
                            const otherConns = landing.connections.filter(c => c.mySpot === landingConn.targetSpot && c.targetId !== this.id);
                            for (let oc of otherConns) { const otherFlight = this.planner.stairs.find(s => s.id === oc.targetId); if (otherFlight) { const otherHalfWT = (otherFlight.width / 2) / len; if (Math.abs(t - oc.offset) < halfWT + otherHalfWT) { if (t < oc.offset) t = oc.offset - halfWT - otherHalfWT; else t = oc.offset + halfWT + otherHalfWT; } } }
                            t = Math.max(halfWT, Math.min(1 - halfWT, t));
                            
                            landingConn.offset = t;
                            const myConnOnLanding = landing.connections.find(c => c.targetId === this.id && c.mySpot === landingConn.targetSpot);
                            if (myConnOnLanding) myConnOnLanding.offset = t;
                            
                            StaircaseV4Solver.solve(this.planner, this.systemId, landing.id);
                            this.planner.syncAll();
                            return;
                        }
                    }
                }
            }
            
            const mySockets = this.getSockets ? this.getSockets().filter(s => !this.connections.find(c => c.mySpot === s.id)) : [];
            const myGlobSockets = mySockets.map(s => this.getGlobalSocket(s.id));
            const myEdges = this.getEdges ? this.getEdges() : [];
            
            this.planner.stairs.forEach(other => {
                if (other === this || other.systemId === this.systemId) return;
                
                if (other.snapPointsGroup && other.getEdges) {
                    const edgeLines = other.snapPointsGroup.find('.edge-line');
                    const otherEdges = other.getEdges();
                    otherEdges.forEach((e, i) => {
                        const edgeLine = edgeLines[i];
                        if (!edgeLine) return;
                        let isHovered = false;
                        let isValid = false;
                        const p1Glob = other.getGlobalEdgeSocket(e.id, 0);
                        const p2Glob = other.getGlobalEdgeSocket(e.id, 1);
                        const dx = p2Glob.x - p1Glob.x;
                        const dy = p2Glob.y - p1Glob.y;
                        const lenSq = dx*dx + dy*dy;
                        if (lenSq > 0) {
                            for (let myGlob of myGlobSockets) {
                                let t = ((myGlob.x - p1Glob.x) * dx + (myGlob.y - p1Glob.y) * dy) / lenSq;
                                if (t >= 0 && t <= 1) {
                                    const projX = p1Glob.x + t * dx;
                                    const projY = p1Glob.y + t * dy;
                                    if (Math.hypot(myGlob.x - projX, myGlob.y - projY) < 40) {
                                        isHovered = true;
                                        const len = Math.sqrt(lenSq);
                                        const halfWT = (this.width / 2) / len;
                                        t = Math.max(halfWT, Math.min(1 - halfWT, t));
                                        let overlap = false;
                                        const otherConns = other.connections.filter(c => c.mySpot === e.id);
                                        for (let oc of otherConns) {
                                            const otherFlight = this.planner.stairs.find(st => st.id === oc.targetId);
                                            if (otherFlight) {
                                                const otherHalfWT = (otherFlight.width / 2) / len;
                                                if (Math.abs(t - oc.offset) < halfWT + otherHalfWT) { overlap = true; break; }
                                            }
                                        }
                                        isValid = !overlap;
                                        break;
                                    }
                                }
                            }
                        }
                        if (isHovered) { 
                            edgeLine.stroke(isValid ? '#10b981' : '#ef4444'); edgeLine.opacity(1); edgeLine.strokeWidth(2);
                        } else { 
                            const hasConn = other.connections.some(c => c.mySpot === e.id);
                            edgeLine.stroke(hasConn ? '#10b981' : 'transparent'); edgeLine.opacity(1); edgeLine.strokeWidth(2);
                        }
                    });
                }
                
                if (this.snapPointsGroup && this.getEdges && other.getSockets) {
                    const edgeLines = this.snapPointsGroup.find('.edge-line');
                    const otherSockets = other.getSockets().filter(os => !other.connections.find(c => c.mySpot === os.id));
                    const otherGlobSockets = otherSockets.map(os => other.getGlobalSocket(os.id));
                    myEdges.forEach((e, i) => {
                        const edgeLine = edgeLines[i];
                        if (!edgeLine) return;
                        let isHovered = false;
                        let isValid = false;
                        const p1Glob = this.getGlobalEdgeSocket(e.id, 0);
                        const p2Glob = this.getGlobalEdgeSocket(e.id, 1);
                        const dx = p2Glob.x - p1Glob.x;
                        const dy = p2Glob.y - p1Glob.y;
                        const lenSq = dx*dx + dy*dy;
                        if (lenSq > 0) {
                            for (let osGlob of otherGlobSockets) {
                                let t = ((osGlob.x - p1Glob.x) * dx + (osGlob.y - p1Glob.y) * dy) / lenSq;
                                if (t >= 0 && t <= 1) {
                                    const projX = p1Glob.x + t * dx;
                                    const projY = p1Glob.y + t * dy;
                                    if (Math.hypot(osGlob.x - projX, osGlob.y - projY) < 40) {
                                        isHovered = true;
                                        const len = Math.sqrt(lenSq);
                                        const halfWT = (other.width / 2) / len;
                                        t = Math.max(halfWT, Math.min(1 - halfWT, t));
                                        let overlap = false;
                                        const myConns = this.connections.filter(c => c.mySpot === e.id);
                                        for (let mc of myConns) { const myFlight = this.planner.stairs.find(st => st.id === mc.targetId); if (myFlight) { const myHalfWT = (myFlight.width / 2) / len; if (Math.abs(t - mc.offset) < halfWT + myHalfWT) { overlap = true; break; } } }
                                        isValid = !overlap;
                                        break;
                                    }
                                }
                            }
                        }
                        if (isHovered) { 
                            edgeLine.stroke(isValid ? '#10b981' : '#ef4444'); edgeLine.opacity(1); edgeLine.strokeWidth(2);
                        } else { 
                            const hasConn = this.connections.some(c => c.mySpot === e.id);
                            edgeLine.stroke(hasConn ? '#10b981' : 'transparent'); edgeLine.opacity(1); edgeLine.strokeWidth(2);
                        }
                    });
                }
            });
            
            this.x = this.group.x();
            this.y = this.group.y();
            StaircaseV4Solver.solve(this.planner, this.systemId, this.id);
            this.planner.syncAll();
        });

        this.group.on('dragend', (e) => {
            if (e.target !== this.group) return;
            this.planner.stairs.forEach(s => { if (s.showSnapPoints && s !== this) s.showSnapPoints(false); });
            this.trySnap();
            StaircaseV4Solver.solve(this.planner, this.systemId, this.id);
            this.planner.syncAll();
        });
    }

    setHighlight(isActive) {
        this.poly.stroke(isActive ? '#f59e0b' : '#3b82f6');
        this.poly.strokeWidth(2);
        this.handlesGroup.visible(isActive);
        this.snapPointsGroup.listening(isActive);
        this.showSnapPoints(isActive, false);
        if (isActive) this.group.moveToTop();
        if (isActive) this.handlesGroup.moveToTop();
        this.planner.stage.batchDraw();
    }

    remove() {
        [...this.connections].forEach(c => StaircaseV4Solver.disconnect(this.planner, this.id, c.mySpot));
        this.group.destroy();
        this.planner.stairs = this.planner.stairs.filter(s => s !== this);
        this.planner.selectEntity(null);
        this.planner.syncAll();
    }

    showSnapPoints(active, showUnconnected = true) {
        this._showUnconnected = showUnconnected;
        this.snapPointsGroup.destroyChildren();
        if (!active) {
            this.planner.stage.batchDraw();
            return;
        }
        
        if (this.getSockets) {
            const sockets = this.getSockets();
            sockets.forEach(s => {
                const isConn = this.connections.find(c => c.mySpot === s.id);
                if (!isConn && !showUnconnected) return;

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
                
                if (!isConn && this.type !== 'stair_v4_landing') {
                    const rad = s.localAngle * Math.PI / 180;
                    const ax = s.localX + Math.cos(rad) * 25;
                    const ay = s.localY + Math.sin(rad) * 25;
                    this.snapPointsGroup.add(new Konva.Arrow({
                        x: s.localX, y: s.localY, points: [0, 0, ax - s.localX, ay - s.localY],
                        stroke: '#10b981', fill: '#10b981', strokeWidth: 3, pointerLength: 6, pointerWidth: 6, listening: false
                    }));
                }
            });
        }
        
        if (this.getEdges) {
            const edges = this.getEdges();
            edges.forEach(e => {
                const conns = this.connections.filter(c => c.mySpot === e.id);
                
                const edgeLine = new Konva.Line({
                    name: 'edge-line',
                    points: [e.p1.x, e.p1.y, e.p2.x, e.p2.y],
                    stroke: conns.length > 0 ? '#10b981' : 'transparent',
                    strokeWidth: 2,
                    opacity: 1,
                    lineCap: 'square',
                    listening: false
                });
                this.snapPointsGroup.add(edgeLine);
                
                conns.forEach(c => {
                    const localX = e.p1.x + (e.p2.x - e.p1.x) * c.offset;
                    const localY = e.p1.y + (e.p2.y - e.p1.y) * c.offset;
                    
                    const pt = new Konva.Circle({
                        x: localX, y: localY, radius: 12,
                        fill: '#ef4444',
                        opacity: 0.9,
                        listening: true
                    });
                    
                    pt.on('mouseenter', () => document.body.style.cursor = 'pointer');
                    pt.on('mouseleave', () => document.body.style.cursor = 'default');
                    
                    pt.on('click tap', (ev) => {
                        ev.cancelBubble = true;
                        StaircaseV4Solver.disconnectTarget(this.planner, this.id, e.id, c.targetId);
                    });
                    
                    this.snapPointsGroup.add(pt);
                });
            });
        }
        
        this.planner.stage.batchDraw();
    }

    trySnap() {
        const mySockets = this.getSockets ? this.getSockets().filter(s => !this.connections.find(c => c.mySpot === s.id)) : [];
        const myEdges = this.getEdges ? this.getEdges() : [];
        
        for (let s of mySockets) {
            const myGlob = this.getGlobalSocket(s.id);
            for (let other of this.planner.stairs) {
                if (other.id === this.id) continue;
                if (other.systemId === this.systemId) continue;
                
                let skipSocketToSocket = false;
                if (this.type === 'stair_v4_flight' && other.type === 'stair_v4_landing') skipSocketToSocket = true;
                if (this.type === 'stair_v4_landing' && other.type === 'stair_v4_flight') skipSocketToSocket = true;

                let snapped = false;
                if (other.getSockets && !skipSocketToSocket) {
                    const otherSockets = other.getSockets().filter(os => !other.connections.find(c => c.mySpot === os.id));
                    for (let os of otherSockets) {
                        const osGlob = other.getGlobalSocket(os.id);
                        if (Math.hypot(myGlob.x - osGlob.x, myGlob.y - osGlob.y) < 40) {
                            StaircaseV4Solver.connect(this.planner, this, s.id, false, other, os.id, false, 0);
                            snapped = true;
                            break;
                        }
                    }
                }
                if (snapped) return;
                
                if (other.getEdges) {
                    const otherEdges = other.getEdges();
                    for (let e of otherEdges) {
                        const p1Glob = other.getGlobalEdgeSocket(e.id, 0);
                        const p2Glob = other.getGlobalEdgeSocket(e.id, 1);
                        const dx = p2Glob.x - p1Glob.x;
                        const dy = p2Glob.y - p1Glob.y;
                        const lenSq = dx*dx + dy*dy;
                        if (lenSq === 0) continue;
                        
                        let t = ((myGlob.x - p1Glob.x) * dx + (myGlob.y - p1Glob.y) * dy) / lenSq;
                        if (t >= 0 && t <= 1) {
                            const projX = p1Glob.x + t * dx;
                            const projY = p1Glob.y + t * dy;
                            if (Math.hypot(myGlob.x - projX, myGlob.y - projY) < 40) {
                                const len = Math.sqrt(lenSq);
                                const halfWT = (this.width / 2) / len;
                                t = Math.max(halfWT, Math.min(1 - halfWT, t));
                                
                                let overlap = false;
                                const otherConns = other.connections.filter(c => c.mySpot === e.id);
                                for (let oc of otherConns) {
                                    const otherFlight = this.planner.stairs.find(st => st.id === oc.targetId);
                                    if (otherFlight) { const otherHalfWT = (otherFlight.width / 2) / len; if (Math.abs(t - oc.offset) < halfWT + otherHalfWT) { overlap = true; break; } }
                                }
                                if (!overlap) {
                                    StaircaseV4Solver.connect(this.planner, this, s.id, false, other, e.id, true, t);
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        for (let e of myEdges) {
            const p1Glob = this.getGlobalEdgeSocket(e.id, 0);
            const p2Glob = this.getGlobalEdgeSocket(e.id, 1);
            const dx = p2Glob.x - p1Glob.x;
            const dy = p2Glob.y - p1Glob.y;
            const lenSq = dx*dx + dy*dy;
            if (lenSq === 0) continue;
            
            for (let other of this.planner.stairs) {
                if (other.id === this.id) continue;
                if (other.systemId === this.systemId) continue;
                
                let skipSocketToSocket = false;
                if (this.type === 'stair_v4_flight' && other.type === 'stair_v4_landing') skipSocketToSocket = true;
                if (this.type === 'stair_v4_landing' && other.type === 'stair_v4_flight') skipSocketToSocket = true;

                if (other.getSockets && !skipSocketToSocket) {
                    const otherSockets = other.getSockets().filter(os => !other.connections.find(c => c.mySpot === os.id));
                    for (let os of otherSockets) {
                        const osGlob = other.getGlobalSocket(os.id);
                        let t = ((osGlob.x - p1Glob.x) * dx + (osGlob.y - p1Glob.y) * dy) / lenSq;
                        if (t >= 0 && t <= 1) {
                            const projX = p1Glob.x + t * dx;
                            const projY = p1Glob.y + t * dy;
                            if (Math.hypot(osGlob.x - projX, osGlob.y - projY) < 40) {
                                const len = Math.sqrt(lenSq);
                                const halfWT = (other.width / 2) / len;
                                t = Math.max(halfWT, Math.min(1 - halfWT, t));
                                
                                let overlap = false;
                                const myConns = this.connections.filter(c => c.mySpot === e.id);
                                for (let mc of myConns) {
                                    const myFlight = this.planner.stairs.find(st => st.id === mc.targetId);
                                    if (myFlight) { const myHalfWT = (myFlight.width / 2) / len; if (Math.abs(t - mc.offset) < halfWT + myHalfWT) { overlap = true; break; } }
                                }
                                if (!overlap) {
                                    StaircaseV4Solver.connect(this.planner, this, e.id, true, other, os.id, false, t);
                                    return;
                                }
                            }
                        }
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
        this.direction = data.direction || 'up';

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
        
        this.lenHandle = new Konva.Rect({ width: 16, height: 16, fill: 'white', stroke: '#3b82f6', strokeWidth: 2, cornerRadius: 4, offsetX: 8, offsetY: 8, draggable: true });
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

        this.wRight = new Konva.Rect({ width: 16, height: 16, fill: 'white', stroke: '#3b82f6', strokeWidth: 2, cornerRadius: 4, offsetX: 8, offsetY: 8, draggable: true });
        this.wRight.on('mouseenter', () => document.body.style.cursor = 'ew-resize');
        this.wRight.on('mouseleave', () => document.body.style.cursor = 'default');
        this.wRight.on('dragmove', (e) => {
            e.cancelBubble = true;
            let localX = this.wRight.x();
            let currentW = this.width;
            let leftEdge = -currentW / 2;
            let newW = localX - leftEdge;
            if (newW < 40) { newW = 40; localX = leftEdge + 40; }
            let shiftLocalX = (localX - currentW / 2) / 2;
            this.width = newW;
            const rad = this.rotation * Math.PI / 180;
            this.x += shiftLocalX * Math.cos(rad);
            this.y += shiftLocalX * Math.sin(rad);
            this.update(); StaircaseV4Solver.solve(this.planner, this.systemId, this.id); this.planner.syncAll();
        });

        this.wLeft = new Konva.Rect({ width: 16, height: 16, fill: 'white', stroke: '#3b82f6', strokeWidth: 2, cornerRadius: 4, offsetX: 8, offsetY: 8, draggable: true });
        this.wLeft.on('mouseenter', () => document.body.style.cursor = 'ew-resize');
        this.wLeft.on('mouseleave', () => document.body.style.cursor = 'default');
        this.wLeft.on('dragmove', (e) => {
            e.cancelBubble = true;
            let localX = this.wLeft.x();
            let currentW = this.width;
            let rightEdge = currentW / 2;
            let newW = rightEdge - localX;
            if (newW < 40) { newW = 40; localX = rightEdge - 40; }
            let shiftLocalX = (localX - (-currentW / 2)) / 2;
            this.width = newW;
            const rad = this.rotation * Math.PI / 180;
            this.x += shiftLocalX * Math.cos(rad);
            this.y += shiftLocalX * Math.sin(rad);
            this.update(); StaircaseV4Solver.solve(this.planner, this.systemId, this.id); this.planner.syncAll();
        });

        this.handlesGroup.add(this.rotHandle, this.lenHandle, this.wRight, this.wLeft);
    }

    update() {
        this.length = this.stepCount * this.stepDepth;
        const w = this.width, l = this.length;
        
        super.updateGeometry();
        
        this.poly.points([-w/2, 0, w/2, 0, w/2, l, -w/2, l]);
        this.rotHandle.position({ x: 0, y: l + 40 });
        this.lenHandle.position({ x: 0, y: l });
        this.wRight.position({ x: w/2, y: l/2 });
        this.wLeft.position({ x: -w/2, y: l/2 });
        
        this.contentGroup.destroyChildren();
        for(let i=1; i<this.stepCount; i++) {
            const sy = i * this.stepDepth;
            this.contentGroup.add(new Konva.Line({ points: [-w/2, sy, w/2, sy], stroke: '#3b82f6', strokeWidth: 1 }));
        }
        
        const arrowGroup = new Konva.Group();
        const longArrow = new Konva.Arrow({ 
            fill: '#3b82f6', 
            stroke: '#3b82f6', 
            strokeWidth: 3, 
            pointerLength: 8, 
            pointerWidth: 8,
            hitStrokeWidth: 25
        });
        if (this.direction === 'down') {
            longArrow.points([0, 5, 0, Math.min(l-5, 40)]);
        } else {
            longArrow.points([0, Math.min(l-5, 40), 0, 5]);
        }
        
        arrowGroup.add(longArrow);
        arrowGroup.on('mouseenter', () => { document.body.style.cursor = 'pointer'; longArrow.stroke('#2563eb'); longArrow.fill('#2563eb'); this.planner.stage.batchDraw(); });
        arrowGroup.on('mouseleave', () => { document.body.style.cursor = 'default'; longArrow.stroke('#3b82f6'); longArrow.fill('#3b82f6'); this.planner.stage.batchDraw(); });
        arrowGroup.on('click tap', (e) => {
            e.cancelBubble = true;
            this.direction = this.direction === 'up' ? 'down' : 'up';
            this.update();
            this.planner.syncAll();
        });
        
        this.contentGroup.add(arrowGroup);
        
        this.handlesGroup.find('.slide-handle').forEach(h => h.destroy());
        this.handlesGroup.find('.slide-arrow').forEach(h => h.destroy());
        this.connections.forEach(conn => {
            if (conn.targetIsEdge) {
                const isStart = conn.mySpot === 'start';
                const yPos = isStart ? 0 : l;
                const slideHandle = new Konva.Rect({
                    name: 'slide-handle',
                    width: 32, height: 16, fill: 'white', stroke: '#f59e0b', strokeWidth: 2, cornerRadius: 4,
                    offsetX: 16, offsetY: 8, x: 0, y: yPos, draggable: true
                });
                
                const arrowL = new Konva.Path({ name: 'slide-arrow', data: 'M 4 6 L 8 2 L 8 10 Z', fill: '#f59e0b', listening: false, x: -12, y: yPos - 6 });
                const arrowR = new Konva.Path({ name: 'slide-arrow', data: 'M 28 6 L 24 2 L 24 10 Z', fill: '#f59e0b', listening: false, x: -20, y: yPos - 6 });
                
                slideHandle.on('mouseenter', () => document.body.style.cursor = 'grab');
                slideHandle.on('mouseleave', () => document.body.style.cursor = 'default');
                slideHandle.on('dragstart', (e) => { e.cancelBubble = true; document.body.style.cursor = 'grabbing'; });
                slideHandle.on('dragmove', (e) => {
                    e.cancelBubble = true;
                    const pos = this.planner.stage.getPointerPosition();
                    const landing = this.planner.stairs.find(s => s.id === conn.targetId);
                    const flightWidth = this.width;
                    if (landing) {
                        const edge = landing.getEdges().find(e => e.id === conn.targetSpot);
                        if (edge) {
                            const p1Glob = landing.getGlobalEdgeSocket(edge.id, 0);
                            const p2Glob = landing.getGlobalEdgeSocket(edge.id, 1);
                            const dx = p2Glob.x - p1Glob.x; const dy = p2Glob.y - p1Glob.y; const len = Math.hypot(dx, dy);
                            if (len > 0) {
                                let t = ((pos.x - p1Glob.x) * dx + (pos.y - p1Glob.y) * dy) / (len * len);
                                const halfWT = (flightWidth / 2) / len;
                                t = Math.max(halfWT, Math.min(1 - halfWT, t));
                                
                                const otherConns = landing.connections.filter(c => c.mySpot === conn.targetSpot && c.targetId !== this.id);
                                for (let oc of otherConns) { const otherFlight = this.planner.stairs.find(s => s.id === oc.targetId); if (otherFlight) { const otherHalfWT = (otherFlight.width / 2) / len; if (Math.abs(t - oc.offset) < halfWT + otherHalfWT) { if (t < oc.offset) t = oc.offset - halfWT - otherHalfWT; else t = oc.offset + halfWT + otherHalfWT; } } }
                                t = Math.max(halfWT, Math.min(1 - halfWT, t));
                                conn.offset = t; const landingConn = landing.connections.find(c => c.mySpot === conn.targetSpot && c.targetId === this.id); if (landingConn) landingConn.offset = t;
                                StaircaseV4Solver.solve(this.planner, this.systemId, landing.id); this.planner.syncAll();
                            }
                        }
                    }
                });
                slideHandle.on('dragend', (e) => { e.cancelBubble = true; document.body.style.cursor = 'grab'; this.planner.syncAll(); });
                this.handlesGroup.add(slideHandle, arrowL, arrowR);
            }
        });

        if (this.snapPointsGroup.listening() || this._showUnconnected) this.showSnapPoints(true, this._showUnconnected);
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
            { id: 'north_sock', localX: 0, localY: l, localAngle: 90, elevOffset: 0 },
            { id: 'south_sock', localX: 0, localY: 0, localAngle: -90, elevOffset: 0 },
            { id: 'east_sock', localX: w/2, localY: l/2, localAngle: 0, elevOffset: 0 },
            { id: 'west_sock', localX: -w/2, localY: l/2, localAngle: 180, elevOffset: 0 }
        ];
    }

    getEdges() {
        const w = this.width, l = this.length;
        return [
            { id: 'north', p1: {x: -w/2, y: l}, p2: {x: w/2, y: l}, localAngle: 90, elevOffset: 0 },
            { id: 'south', p1: {x: w/2, y: 0}, p2: {x: -w/2, y: 0}, localAngle: -90, elevOffset: 0 },
            { id: 'east', p1: {x: w/2, y: l}, p2: {x: w/2, y: 0}, localAngle: 0, elevOffset: 0 },
            { id: 'west', p1: {x: -w/2, y: 0}, p2: {x: -w/2, y: l}, localAngle: 180, elevOffset: 0 }
        ];
    }

    initLandingHandles() {
        const createHandle = (name) => {
            const h = new Konva.Rect({ width: 16, height: 16, fill: 'white', stroke: '#10b981', strokeWidth: 2, cornerRadius: 4, offsetX: 8, offsetY: 8, draggable: true, name });
            h.on('mouseenter', () => document.body.style.cursor = name.includes('w') ? 'ew-resize' : 'ns-resize');
            h.on('mouseleave', () => document.body.style.cursor = 'default');
            this.handlesGroup.add(h);
            return h;
        };
        
        this.wRight = createHandle('wRight');
        this.wLeft = createHandle('wLeft');
        this.lBot = createHandle('lBot');
        
        this.rotHandle = new Konva.Circle({ radius: 8, fill: '#10b981', stroke: 'white', strokeWidth: 2, draggable: true });
        this.rotHandle.on('mouseenter', () => document.body.style.cursor = 'crosshair');
        this.rotHandle.on('mouseleave', () => document.body.style.cursor = 'default');
        this.handlesGroup.add(this.rotHandle);
        
        this.rotHandle.on('dragmove', (e) => {
            e.cancelBubble = true;
            const pos = this.planner.stage.getPointerPosition();
            if (!pos) return;
            const groupPos = this.group.getAbsolutePosition();
            const angleRad = Math.atan2(pos.y - groupPos.y, pos.x - groupPos.x);
            let newRot = (angleRad * 180 / Math.PI) - 90;
            
            this.rotation = Math.round(newRot / 15) * 15;
            this.update();
            StaircaseV4Solver.solve(this.planner, this.systemId, this.id);
            this.planner.syncAll();
        });

        this.wRight.on('dragmove', (e) => {
            e.cancelBubble = true;
            let localX = this.wRight.x();
            let currentW = this.width;
            let leftEdge = -currentW / 2;
            let newW = localX - leftEdge;
            if (newW < 40) { newW = 40; localX = leftEdge + 40; }
            let shiftLocalX = (localX - currentW / 2) / 2;
            this.width = newW;
            const rad = this.rotation * Math.PI / 180;
            this.x += shiftLocalX * Math.cos(rad);
            this.y += shiftLocalX * Math.sin(rad);
            this.update(); StaircaseV4Solver.solve(this.planner, this.systemId, this.id); this.planner.syncAll();
        });
        
        this.wLeft.on('dragmove', (e) => {
            e.cancelBubble = true;
            let localX = this.wLeft.x();
            let currentW = this.width;
            let rightEdge = currentW / 2;
            let newW = rightEdge - localX;
            if (newW < 40) { newW = 40; localX = rightEdge - 40; }
            let shiftLocalX = (localX - (-currentW / 2)) / 2;
            this.width = newW;
            const rad = this.rotation * Math.PI / 180;
            this.x += shiftLocalX * Math.cos(rad);
            this.y += shiftLocalX * Math.sin(rad);
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
        this.rotHandle.position({ x: 0, y: l + 40 });
        
        this.contentGroup.destroyChildren();
        
        const arrowGroup = new Konva.Group({ x: 0, y: l/2, rotation: this.arrowRotation || 0 });
        const lineLength = Math.min(l - 20, 60);
        const halfL = lineLength / 2;
        const arrowLine = new Konva.Arrow({ 
            points: [0, halfL, 0, -halfL], 
            fill: '#3b82f6', 
            stroke: '#3b82f6', 
            strokeWidth: 3, 
            pointerLength: 8, 
            pointerWidth: 8,
            hitStrokeWidth: 25
        });
        
        arrowGroup.add(arrowLine);
        arrowGroup.on('mouseenter', () => { document.body.style.cursor = 'pointer'; arrowLine.stroke('#2563eb'); arrowLine.fill('#2563eb'); this.planner.stage.batchDraw(); });
        arrowGroup.on('mouseleave', () => { document.body.style.cursor = 'default'; arrowLine.stroke('#3b82f6'); arrowLine.fill('#3b82f6'); this.planner.stage.batchDraw(); });
        arrowGroup.on('click tap', (e) => {
            e.cancelBubble = true;
            this.arrowRotation = ((this.arrowRotation || 0) + 90) % 360;
            this.update();
            this.planner.syncAll();
        });
        this.contentGroup.add(arrowGroup);
        
        if (this.snapPointsGroup.listening() || this._showUnconnected) this.showSnapPoints(true, this._showUnconnected);
    }
}

export const StaircaseV4Solver = {
    connect: function(planner, nodeA, spotAId, isAEdge, nodeB, spotBId, isBEdge, offset) {
        if (!isAEdge && nodeA.connections.find(c => c.mySpot === spotAId)) return;
        if (!isBEdge && nodeB.connections.find(c => c.mySpot === spotBId)) return;
        
        let locA = isAEdge ? nodeA.getEdges().find(e => e.id === spotAId) : nodeA.getSockets().find(s => s.id === spotAId);
        let locB = isBEdge ? nodeB.getEdges().find(e => e.id === spotBId) : nodeB.getSockets().find(s => s.id === spotBId);
        
        let currentUserRot = nodeA.rotation + locA.localAngle - (nodeB.rotation + locB.localAngle) - 180;
        currentUserRot = Math.round(currentUserRot / 15) * 15;
        
        nodeA.connections.push({ mySpot: spotAId, targetId: nodeB.id, targetSpot: spotBId, targetIsEdge: isBEdge, offset: offset, userRot: -currentUserRot });
        nodeB.connections.push({ mySpot: spotBId, targetId: nodeA.id, targetSpot: spotAId, targetIsEdge: isAEdge, offset: offset, userRot: currentUserRot });
        
        const newSysId = nodeB.systemId;
        const oldSysId = nodeA.systemId;
        planner.stairs.forEach(s => {
            if (s.systemId === oldSysId) s.systemId = newSysId;
        });
        
        this.solve(planner, newSysId, nodeB.id);
    },
    
    disconnectTarget: function(planner, nodeId, spotId, targetId) {
        const nodeA = planner.stairs.find(s => s.id === nodeId);
        if (!nodeA) return;
        const conn = nodeA.connections.find(c => c.mySpot === spotId && c.targetId === targetId);
        if (!conn) return;
        
        const nodeB = planner.stairs.find(s => s.id === targetId);
        
        nodeA.connections = nodeA.connections.filter(c => c !== conn);
        if (nodeB) {
            nodeB.connections = nodeB.connections.filter(c => !(c.targetId === nodeId && c.targetSpot === spotId));
        }
        
        this._rebuildSystemId(planner, nodeA, 'sys_' + Math.random().toString(36).substr(2, 9));
        if (nodeB) {
            this._rebuildSystemId(planner, nodeB, 'sys_' + Math.random().toString(36).substr(2, 9));
        }
        
        nodeA.update();
        if (nodeB) nodeB.update();
    },

    disconnect: function(planner, nodeId, spotId) {
        const nodeA = planner.stairs.find(s => s.id === nodeId);
        if (!nodeA) return;
        const conns = nodeA.connections.filter(c => c.mySpot === spotId);
        conns.forEach(conn => {
            this.disconnectTarget(planner, nodeId, spotId, conn.targetId);
        });
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
                        this._alignTarget(curr, conn.mySpot, target, conn.targetSpot, conn.userRot, conn.targetIsEdge, conn.offset);
                        target.updateGeometry();
                        q.push(target);
                    }
                }
            });
            curr.updateGeometry();
        }
    },
    
    _alignTarget: function(source, sourceSpotId, target, targetSpotId, userRot, targetIsEdge, offset) {
        let sSocketGlobal;
        const sIsEdge = source.getEdges && source.getEdges().find(e => e.id === sourceSpotId);
        if (sIsEdge) {
            sSocketGlobal = source.getGlobalEdgeSocket(sourceSpotId, offset);
        } else {
            sSocketGlobal = source.getGlobalSocket(sourceSpotId);
        }
        
        let tSocketLocal;
        if (targetIsEdge) {
            const edge = target.getEdges().find(e => e.id === targetSpotId);
            tSocketLocal = {
                localX: edge.p1.x + (edge.p2.x - edge.p1.x) * offset,
                localY: edge.p1.y + (edge.p2.y - edge.p1.y) * offset,
                localAngle: edge.localAngle,
                elevOffset: edge.elevOffset
            };
        } else {
            tSocketLocal = target.getSockets().find(s => s.id === targetSpotId);
        }
        
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
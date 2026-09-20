import Konva from 'konva';
import { SNAP_DIST } from '../registry.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { WallEngine } from '../wall/WallEngine.js';
import { WallGeometryEngine } from '../wall/WallGeometryEngine.js';

export class Anchor {
    constructor(planner, x, y) {
        this.planner = planner; this.lastValidPos = { x, y };
        this.node = new Konva.Group({ x, y, draggable: true, visible: false });
        this.node.add(new Konva.Circle({ radius: 35, fill: 'transparent' })); // Large invisible touch target
        this.innerCircle = new Konva.Circle({ radius: 8, fill: "#111827", stroke: "white", strokeWidth: 2 });
        this.node.add(this.innerCircle);
        const arrowOffset = 11; const arrowSize = 4;
        const makeArrow = (points) => new Konva.Line({ points, fill: '#111827', closed: true });
        this.node.add(makeArrow([0, -arrowOffset, -arrowSize, -arrowOffset+arrowSize, arrowSize, -arrowOffset+arrowSize]));
        this.node.add(makeArrow([0, arrowOffset, -arrowSize, arrowOffset-arrowSize, arrowSize, arrowOffset-arrowSize]));
        this.node.add(makeArrow([-arrowOffset, 0, -arrowOffset+arrowSize, -arrowSize, -arrowOffset+arrowSize, arrowSize]));
        this.node.add(makeArrow([arrowOffset, 0, arrowOffset-arrowSize, -arrowSize, arrowOffset-arrowSize, arrowSize]));
        
        this.node.on('mouseenter', () => {
            const isInteractive = this.planner.tool === 'select' || this.planner.tool === 'corner';
            if (!isInteractive) return;
            document.body.style.cursor = 'pointer';
            if (this.planner.stage && typeof this.planner.stage.container === 'function' && this.planner.stage.container()) {
                this.planner.stage.container().style.cursor = 'pointer';
            }
            if (this.innerCircle && this.planner.selectedEntity !== this) {
                this.innerCircle.fill('#0284c7');
                this.innerCircle.stroke('#38bdf8');
                this.innerCircle.strokeWidth(3);
                if (this.node && this.node.getLayer()) this.node.getLayer().batchDraw();
            }
        });

        this.node.on('mouseleave', () => {
            if (this.planner.tool === 'select' || this.planner.tool === 'corner') {
                document.body.style.cursor = '';
                if (this.planner.stage && typeof this.planner.stage.container === 'function' && this.planner.stage.container()) {
                    this.planner.stage.container().style.cursor = this.planner.tool === 'select' ? (this.planner.stage.isDragging() ? 'grabbing' : 'grab') : 'crosshair';
                }
            }
            if (this.innerCircle && this.planner.selectedEntity !== this) {
                this.innerCircle.fill('#111827');
                this.innerCircle.stroke('white');
                this.innerCircle.strokeWidth(2);
                if (this.node && this.node.getLayer()) this.node.getLayer().batchDraw();
            }
        });
        
        this.node.on('click tap', (e) => {
            if (this.planner.tool !== 'select' && this.planner.tool !== 'corner') return;
            e.cancelBubble = true;
            this.planner.selectEntity(this, 'anchor');
            this.planner.syncAll();
        });

        this.node.on('dragstart', (e) => {
            if (this.planner.tool !== 'select' && this.planner.tool !== 'corner') { e.target.stopDrag(); return; }
            let attachedWalls = this.planner.walls.filter(w => w.startAnchor === this || w.endAnchor === this); 
            
            this.planner.selectEntity(this, 'anchor');
            if (this.planner.commandManager) this._dragSnapshotCmd = new SnapshotCommand(this.planner);
            
            this.trackedObjects = [];
            this.trackedArcs = [];

            const getBestWallForObject = (item, type) => {
                if (item.attachedWall) return item.attachedWall;
                let objPos;
                if (type === 'furniture' || (type && type.startsWith('shape'))) objPos = { x: item.group.x(), y: item.group.y() };
                else return null;
                let minDist = 100;
                let bestWall = null;
                attachedWalls.forEach(w => {
                    let d = this.planner.getDistanceToWall(objPos, w);
                    if (d < minDist) { minDist = d; bestWall = w; }
                });
                return bestWall;
            };

            attachedWalls.forEach(w => {
                const p1 = w.startAnchor.position();
                const p2 = w.endAnchor.position();
                const dx = p2.x - p1.x, dy = p2.y - p1.y;
                const wallAngle = Math.atan2(dy, dx);
                const len = Math.hypot(dx, dy);
                
                if (this.planner.wallTrackingEnabled) {
                    const collectNear = (list, type) => {
                        if (!list) return;
                        list.forEach(item => {
                            if (this.trackedObjects.some(to => to.obj === item)) return;
                            if (getBestWallForObject(item, type) === w) {
                                let pos = { x: item.group.x(), y: item.group.y() };
                                const t = len === 0 ? 0 : ((pos.x - p1.x)*dx + (pos.y - p1.y)*dy) / (len*len);
                                const distToWall = len === 0 ? 0 : (pos.x - p1.x)*(-dy/len) + (pos.y - p1.y)*(dx/len);
                                this.trackedObjects.push({
                                    wall: w, type, obj: item,
                                    relT: t, normDist: distToWall,
                                    relRot: (item.rotation || 0) - (wallAngle * 180 / Math.PI),
                                    initialLen: len,
                                    initialScaleX: item.group.scaleX ? item.group.scaleX() : 1,
                                    initialScaleY: item.group.scaleY ? item.group.scaleY() : 1,
                                    initialWidth: item.width || (item.params ? item.params.width : undefined),
                                    initialHeight: item.depth || item.height || (item.params ? item.params.height : undefined)
                                });
                            }
                        });
                    };
                    collectNear(this.planner.furniture, 'furniture');
                    collectNear(this.planner.shapes, 'shape');
                }
                
                if (this.planner.arcs) {
                    const isPointOnSegment = (p, pA, pB) => {
                        if (Math.hypot(p.x - pA.x, p.y - pA.y) < 1) return true;
                        if (Math.hypot(p.x - pB.x, p.y - pB.y) < 1) return true;
                        const C = pB.x - pA.x, D = pB.y - pA.y, lenSq = C*C + D*D;
                        if (lenSq === 0) return false;
                        let t = ((p.x - pA.x)*C + (p.y - pA.y)*D) / lenSq;
                        if (t < 0 || t > 1) return false;
                        let projX = pA.x + t*C, projY = pA.y + t*D;
                        return Math.hypot(p.x - projX, p.y - projY) < 2.0;
                    };
                    this.planner.arcs.forEach(a => {
                        if (this.trackedArcs.some(ta => ta.arc === a)) return;
                        let p1OnWall = isPointOnSegment(a.p1.position(), p1, p2);
                        let p2OnWall = isPointOnSegment(a.p2.position(), p1, p2);
                        if (p1OnWall && p2OnWall) {
                            const getRel = (pos) => {
                                const t = len === 0 ? 0 : ((pos.x - p1.x)*dx + (pos.y - p1.y)*dy) / (len*len);
                                const normDist = len === 0 ? 0 : (pos.x - p1.x)*(-dy/len) + (pos.y - p1.y)*(dx/len);
                                return { t, normDist, initialLen: len };
                            };
                            this.trackedArcs.push({ arc: a, wall: w, p1Rel: getRel(a.p1.position()), p2Rel: getRel(a.p2.position()), posRel: getRel(a.pos) });
                        }
                    });
                }
            });
            
            if (!this.planner.wallTrackingEnabled) {
                attachedWalls.forEach(w => w.setHighlight(true));
            }
        });
        
        this.node.on('dragmove', () => {
            let rawPos = { x: this.planner.snap(this.node.x()), y: this.planner.snap(this.node.y()) };
            let attachedWalls = this.planner.walls.filter(w => w.startAnchor === this || w.endAnchor === this);
            
            let fixedAnchor = null;
            let refAngle = 0;
            if (attachedWalls.length === 1) {
                fixedAnchor = attachedWalls[0].startAnchor === this ? attachedWalls[0].endAnchor : attachedWalls[0].startAnchor;
                if (this.planner.smartGuides && this.planner.smartGuides.calculateAngleSnap) {
                    rawPos = this.planner.smartGuides.calculateAngleSnap({x: fixedAnchor.x, y: fixedAnchor.y}, rawPos, 0);
                }
            } else if (attachedWalls.length >= 2) {
                fixedAnchor = attachedWalls[0].startAnchor === this ? attachedWalls[0].endAnchor : attachedWalls[0].startAnchor;
            }
            
            let proposedPos = rawPos; let targetSnapWall = null, closestDist = SNAP_DIST, snappedObj = false;
            for (let w of this.planner.walls) { 
                if (attachedWalls.includes(w)) continue; 
                let proj = this.planner.getClosestPointOnSegment(proposedPos, w.startAnchor.position(), w.endAnchor.position()); 
                let dist = Math.hypot(proposedPos.x - proj.x, proposedPos.y - proj.y); 
                if (dist < closestDist) { closestDist = dist; proposedPos = proj; targetSnapWall = w; snappedObj = true; } 
            }
            
            if (attachedWalls.length === 1) {
                let fixedAnchor = attachedWalls[0].startAnchor === this ? attachedWalls[0].endAnchor : attachedWalls[0].startAnchor; 
                let dx = proposedPos.x - fixedAnchor.x; let dy = proposedPos.y - fixedAnchor.y; 
                let len = this.planner.formatLength(Math.hypot(dx, dy)); 
                let ang = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1); 
                this.planner.updateInfoBadge(proposedPos.x, proposedPos.y, len, ang, snappedObj);
            }
            
            this.planner.walls.forEach(w => { w.setHighlight(attachedWalls.includes(w) || w === this.planner.selectedEntity); });
            let collision = false; 
            let ignoreWalls = attachedWalls.slice();
            if (targetSnapWall) ignoreWalls.push(targetSnapWall);
            if (this.trackedArcs) {
                this.trackedArcs.forEach(item => {
                    if (item.arc && item.arc.walls) {
                        ignoreWalls.push(...item.arc.walls);
                    }
                });
            }
            for (let w of attachedWalls) { 
                if (w.hasEvent("stop_collision")) { 
                    let otherAnc = w.startAnchor === this ? w.endAnchor : w.startAnchor; 
                    if (this.planner.checkWallIntersection(proposedPos, otherAnc.position(), ignoreWalls)) { collision = true; break; } 
                } 
            }
            
            if (collision) { 
                WallEngine.moveAnchor(this, this.lastValidPos, this.planner, false); 
            } else { 
                WallEngine.moveAnchor(this, proposedPos, this.planner, false); 
                this.lastValidPos = proposedPos; 
            } 
            
            if (this.planner.wallTrackingEnabled && this.trackedObjects && this.trackedObjects.length > 0) {
                this.trackedObjects.forEach(item => {
                    const w = item.wall;
                    const p1 = w.startAnchor.position();
                    const p2 = w.endAnchor.position();
                    const dx = p2.x - p1.x, dy = p2.y - p1.y;
                    const len = Math.hypot(dx, dy);
                    if (len === 0) return;
                    const wallAngle = Math.atan2(dy, dx);
                    const nx = -dy / len;
                    const ny = dx / len;
                    
                    const scaleRatio = item.initialLen > 0 ? len / item.initialLen : 1;
                    
                    const newX = p1.x + item.relT * dx + nx * (item.normDist * scaleRatio);
                    const newY = p1.y + item.relT * dy + ny * (item.normDist * scaleRatio);
                    const newRot = item.relRot + (wallAngle * 180 / Math.PI);
                    
                    if (item.type === 'furniture' || (item.type && item.type.startsWith('shape'))) {
                        item.obj.group.position({ x: newX, y: newY });
                        item.obj.rotation = newRot;
                        if (item.type === 'furniture') {
                            if (item.initialWidth !== undefined) item.obj.width = item.initialWidth * scaleRatio;
                            if (item.initialHeight !== undefined) item.obj.depth = item.initialHeight * scaleRatio;
                        } else {
                            if (item.initialScaleX !== undefined) item.obj.group.scaleX(item.initialScaleX * scaleRatio);
                            if (item.initialScaleY !== undefined) item.obj.group.scaleY(item.initialScaleY * scaleRatio);
                        }
                        if (item.obj.update) item.obj.update();
                    }
                });
            }

            if (this.trackedArcs && this.trackedArcs.length > 0) {
                this.trackedArcs.forEach(item => {
                    const w = item.wall;
                    const p1 = w.startAnchor.position();
                    const p2 = w.endAnchor.position();
                    const dx = p2.x - p1.x, dy = p2.y - p1.y;
                    const len = Math.hypot(dx, dy);
                    if (len === 0) return;
                    const nx = -dy / len;
                    const ny = dx / len;
                    
                    const scaleRatio = item.p1Rel.initialLen > 0 ? len / item.p1Rel.initialLen : 1;
                    const getAbs = (rel) => ({ x: p1.x + rel.t * dx + nx * (rel.normDist * scaleRatio), y: p1.y + rel.t * dy + ny * (rel.normDist * scaleRatio) });
                    
                    const newP1 = getAbs(item.p1Rel);
                    const newP2 = getAbs(item.p2Rel);
                    const newPos = getAbs(item.posRel);
                    
                    if (item.arc.p1 !== w.startAnchor && item.arc.p1 !== w.endAnchor) { item.arc.p1.node.position(newP1); item.arc.p1.lastValidPos = newP1; }
                    if (item.arc.p2 !== w.startAnchor && item.arc.p2 !== w.endAnchor) { item.arc.p2.node.position(newP2); item.arc.p2.lastValidPos = newP2; }
                    item.arc.pos = newPos;
                    if (item.arc.controlHandle) item.arc.controlHandle.position(item.arc.pos);
                });
            }

            if (snappedObj) this.planner.showSnapGlow(proposedPos.x, proposedPos.y); 
            else this.planner.hideSnapGlow();
            
            if (fixedAnchor && this.planner.smartGuides && this.planner.smartGuides.drawAngleGuide) {
                if (attachedWalls.length >= 2) {
                    let fix2 = attachedWalls[1].startAnchor === this ? attachedWalls[1].endAnchor : attachedWalls[1].startAnchor;
                    let angle2 = Math.atan2(fix2.y - proposedPos.y, fix2.x - proposedPos.x) * 180 / Math.PI;
                    this.planner.smartGuides.drawAngleGuide(proposedPos, {x: fixedAnchor.x, y: fixedAnchor.y}, angle2, true);
                } else {
                    this.planner.smartGuides.clear();
                }
            }

            this.planner.syncAll();
        });
        
        this.node.on('dragend', () => { 
            this.planner.selectEntity(this.planner.selectedEntity, this.planner.selectedType, this.planner.selectedNodeIndex);
            this.planner.drawGuideLine(0,0,0,0, false); 
            this.planner.hideInfoBadge(); 
            this.planner.hideSnapGlow(); 
            if (this.planner.smartGuides) this.planner.smartGuides.clear();
            
            if (this._dragSnapshotCmd && this._dragSnapshotCmd.finalize()) {
                this.planner.commandManager.execute(this._dragSnapshotCmd);
            }
            this._dragSnapshotCmd = null;

            this.planner.syncAll(); 
        }); 
        this.planner.uiLayer.add(this.node);

        // 2D Interactive Corner Fillet Drag Handle (Figma / CAD style)
        this.filletGroup = new Konva.Group({ visible: false, listening: true });
        this.filletLine = new Konva.Line({
            points: [0, 0, 0, 0],
            stroke: '#10b981',
            strokeWidth: 2,
            dash: [4, 4],
            listening: false
        });
        this.filletHandle = new Konva.Circle({
            radius: 8.5,
            fill: '#10b981',
            stroke: '#ffffff',
            strokeWidth: 2,
            draggable: true,
            shadowColor: '#10b981',
            shadowBlur: 8,
            shadowOpacity: 0.6
        });
        this.filletInnerDot = new Konva.Circle({
            radius: 3,
            fill: '#ffffff',
            listening: false
        });

        this.filletGroup.add(this.filletLine);
        this.filletGroup.add(this.filletHandle);
        this.filletGroup.add(this.filletInnerDot);
        if (this.planner.uiLayer) this.planner.uiLayer.add(this.filletGroup);

        this.node.on('destroy', () => {
            if (this.filletGroup) {
                this.filletGroup.destroy();
                this.filletGroup = null;
            }
        });

        this.filletHandle.on('mouseenter', () => {
            if (this.planner.tool === 'select') document.body.style.cursor = 'grab';
        });
        this.filletHandle.on('mouseleave', () => {
            if (!this._isFilletDragging) document.body.style.cursor = 'default';
        });

        this.filletHandle.on('dragstart', (e) => {
            e.cancelBubble = true;
            this._isFilletDragging = true;
            document.body.style.cursor = 'grabbing';
            if (this.planner.commandManager) {
                this._filletSnapshotCmd = new SnapshotCommand(this.planner);
            }
        });

        this.filletHandle.on('dragmove', (e) => {
            e.cancelBubble = true;
            if (!this._filletData) return;
            const { pC, b, factorK, maxRadius } = this._filletData;
            const hPos = this.filletHandle.position();
            const d = (hPos.x - pC.x) * b.x + (hPos.y - pC.y) * b.y;

            if (d <= 12) {
                this._candidateRadius = 0;
                this.filletHandle.fill('#00f0ff');
                this.filletHandle.shadowColor('#00f0ff');
                const targetX = pC.x + 14 * b.x;
                const targetY = pC.y + 14 * b.y;
                this.filletHandle.position({ x: targetX, y: targetY });
                this.filletInnerDot.position({ x: targetX, y: targetY });
                if (this._ghostArc2D) this._ghostArc2D.visible(false);
                if (typeof this.planner.updateInfoBadge === 'function') {
                    this.planner.updateInfoBadge(targetX, targetY, 'Sharp', '90°', false);
                }
            } else {
                const rawR = d / factorK;
                const stepR = Math.max(20, Math.min(maxRadius || 200, Math.round(rawR / 5) * 5));
                this._candidateRadius = stepR;
                this.filletHandle.fill('#10b981');
                this.filletHandle.shadowColor('#10b981');
                const actualD = stepR * factorK;
                const targetX = pC.x + actualD * b.x;
                const targetY = pC.y + actualD * b.y;
                this.filletHandle.position({ x: targetX, y: targetY });
                this.filletInnerDot.position({ x: targetX, y: targetY });
                this._render2DGhostArc(stepR);
                if (typeof this.planner.updateInfoBadge === 'function') {
                    this.planner.updateInfoBadge(targetX, targetY, 'Radius', `${stepR} cm`, false);
                }
            }

            if (this.planner.uiLayer) this.planner.uiLayer.batchDraw();
            if (this.planner.stage) this.planner.stage.batchDraw();
        });

        this.filletHandle.on('dragend', (e) => {
            e.cancelBubble = true;
            this._isFilletDragging = false;
            document.body.style.cursor = 'default';
            if (this._ghostArc2D) {
                this._ghostArc2D.visible(false);
            }
            if (typeof this.planner.hideInfoBadge === 'function') {
                this.planner.hideInfoBadge();
            }

            if (this._candidateRadius !== undefined && this._candidateRadius !== null) {
                if (this._candidateRadius <= 0) {
                    WallEngine.unfilletCorner(this.planner, this);
                } else {
                    WallEngine.filletCorner(this.planner, this, this._candidateRadius);
                }
                this._candidateRadius = null;
            }

            if (this._filletSnapshotCmd && this._filletSnapshotCmd.finalize()) {
                this.planner.commandManager.execute(this._filletSnapshotCmd);
            }
            this._filletSnapshotCmd = null;
            if (typeof this.planner.syncAll === 'function') this.planner.syncAll();
            if (typeof this.planner.findRooms === 'function') this.planner.findRooms();
            if (typeof this.planner.update3D === 'function') this.planner.update3D();
            this._updateFilletHandle();
        });
    }
    
    get x() { return this.node.x(); } 
    set x(val) { this.node.x(val); this.lastValidPos.x = val; }
    get y() { return this.node.y(); } 
    set y(val) { this.node.y(val); this.lastValidPos.y = val; }
    show() { this.node.show(); } 
    hide() { this.node.hide(); } 
    position(pos) { 
        if (pos !== undefined) {
            this.node.position(pos);
            this.lastValidPos = { x: pos.x, y: pos.y };
            return this;
        }
        return this.node.position(); 
    }
    setHighlight(active) {
        if (this.innerCircle) {
            this.innerCircle.fill(active ? '#0284c7' : '#111827');
            this.innerCircle.stroke(active ? '#38bdf8' : 'white');
            this.innerCircle.strokeWidth(active ? 3 : 2);
            if (this.node && this.node.getLayer()) this.node.getLayer().batchDraw();
        }
        if (this.planner && this.planner.walls) {
            this.planner.walls.filter(w => w.startAnchor === this || w.endAnchor === this)
                .forEach(w => { if (w.setHighlight) w.setHighlight(active); });
        }
        if (active && this.planner?.selectedEntity === this) {
            this._updateFilletHandle();
        } else if (!active) {
            this._hideFilletHandle();
        }
    }

    _updateFilletHandle() {
        if (!this.planner || !this.filletGroup) return;
        const cd = WallEngine.getCornerData(this.planner, this);
        if (!cd || !cd.isCorner) {
            this._hideFilletHandle();
            return;
        }

        const walls = cd.walls || [];
        if (walls.length < 2) {
            this._hideFilletHandle();
            return;
        }

        const [w1, w2] = walls;
        const pC = cd.filletData?.apexPos || this.filletData?.apexPos || WallGeometryEngine.getAnchorPosition(this);
        const other1 = cd.filletData?.origEndpoint1 === 'start' ? w1.endAnchor : (w1.startAnchor === this ? w1.endAnchor : w1.startAnchor);
        const other2 = cd.filletData?.origEndpoint2 === 'start' ? w2.endAnchor : (w2.startAnchor === this ? w2.endAnchor : w2.startAnchor);
        const p1 = WallGeometryEngine.getAnchorPosition(other1);
        const p2 = WallGeometryEngine.getAnchorPosition(other2);

        const v1 = { x: p1.x - pC.x, y: p1.y - pC.y };
        const v2 = { x: p2.x - pC.x, y: p2.y - pC.y };
        const l1 = Math.hypot(v1.x, v1.y);
        const l2 = Math.hypot(v2.x, v2.y);
        if (l1 < 1 || l2 < 1) {
            this._hideFilletHandle();
            return;
        }

        const u1 = { x: v1.x / l1, y: v1.y / l1 };
        const u2 = { x: v2.x / l2, y: v2.y / l2 };
        const dot = Math.max(-0.9999, Math.min(0.9999, u1.x * u2.x + u1.y * u2.y));
        const theta = Math.acos(dot);
        const sinHalf = Math.max(0.05, Math.sin(theta / 2));
        const factorK = Math.max(0.05, (1 / sinHalf) - 1);
        const maxRadius = cd.maxRadius || 200;

        const bx = u1.x + u2.x;
        const by = u1.y + u2.y;
        const bLen = Math.hypot(bx, by);
        if (bLen < 0.001) {
            this._hideFilletHandle();
            return;
        }
        const b = { x: bx / bLen, y: by / bLen };

        const isFilleted = cd.isFilleted;
        const curRadius = isFilleted ? (cd.radius || 80) : 0;
        const curDist = curRadius > 0 ? (curRadius * factorK) : 22;
        const maxDist = Math.max(curDist + 30, maxRadius * factorK);

        this._filletData = { pC, b, factorK, maxRadius, isFilleted, curRadius, u1, u2, l1, l2, theta, sinHalf };

        const hX = pC.x + curDist * b.x;
        const hY = pC.y + curDist * b.y;

        this.filletLine.points([pC.x, pC.y, pC.x + maxDist * b.x, pC.y + maxDist * b.y]);
        this.filletLine.stroke(isFilleted ? '#10b981' : '#00f0ff');
        this.filletHandle.position({ x: hX, y: hY });
        this.filletHandle.fill(isFilleted ? '#10b981' : '#00f0ff');
        this.filletHandle.shadowColor(isFilleted ? '#10b981' : '#00f0ff');
        this.filletInnerDot.position({ x: hX, y: hY });

        if (this._ghostArc2D) this._ghostArc2D.visible(false);

        this.filletGroup.visible(true);
        this.filletGroup.moveToTop();
        if (this.planner.uiLayer) this.planner.uiLayer.batchDraw();
    }

    _render2DGhostArc(radius) {
        if (!this.filletGroup || !this._filletData || !radius || radius <= 0) {
            if (this._ghostArc2D) this._ghostArc2D.visible(false);
            return;
        }

        const { pC, u1, u2, b, theta, sinHalf, l1, l2 } = this._filletData;
        const deltaPhi = Math.PI - theta;
        const tanHalfDelta = Math.tan(deltaPhi / 2);
        let T = radius * tanHalfDelta;
        const maxT = Math.min(l1, l2) * 0.85;
        if (T > maxT) {
            T = maxT;
            radius = T / tanHalfDelta;
        }

        const pT1 = { x: pC.x + T * u1.x, y: pC.y + T * u1.y };
        const pT2 = { x: pC.x + T * u2.x, y: pC.y + T * u2.y };
        const D_O = radius / Math.max(0.01, sinHalf);
        const O = { x: pC.x + D_O * b.x, y: pC.y + D_O * b.y };
        const pMid = { x: pC.x + (D_O - radius) * b.x, y: pC.y + (D_O - radius) * b.y };

        const v1 = { x: pT1.x - O.x, y: pT1.y - O.y };
        const v2 = { x: pT2.x - O.x, y: pT2.y - O.y };
        const vMid = { x: pMid.x - O.x, y: pMid.y - O.y };

        const a1 = Math.atan2(v1.y, v1.x);
        const a2 = Math.atan2(v2.y, v2.x);
        const aMid = Math.atan2(vMid.y, vMid.x);

        let d1 = aMid - a1;
        while (d1 <= -Math.PI) d1 += 2 * Math.PI;
        while (d1 > Math.PI) d1 -= 2 * Math.PI;

        let d2 = a2 - aMid;
        while (d2 <= -Math.PI) d2 += 2 * Math.PI;
        while (d2 > Math.PI) d2 -= 2 * Math.PI;

        const totalSweep = d1 + d2;
        const N = 16;
        const pts = [];

        for (let i = 0; i <= N; i++) {
            const t = i / N;
            const ang = a1 + t * totalSweep;
            pts.push(O.x + radius * Math.cos(ang), O.y + radius * Math.sin(ang));
        }

        if (!this._ghostArc2D) {
            this._ghostArc2D = new Konva.Line({
                points: pts,
                stroke: '#10b981',
                strokeWidth: 4,
                dash: [6, 4],
                lineCap: 'round',
                lineJoin: 'round',
                listening: false,
                opacity: 0.9
            });
            this.filletGroup.add(this._ghostArc2D);
        } else {
            this._ghostArc2D.points(pts);
            this._ghostArc2D.visible(true);
        }
        this._ghostArc2D.moveToTop();
        this.filletHandle.moveToTop();
        this.filletInnerDot.moveToTop();
    }

    _hideFilletHandle() {
        if (this._ghostArc2D) this._ghostArc2D.visible(false);
        if (this.filletGroup) {
            this.filletGroup.visible(false);
            if (this.planner?.uiLayer) this.planner.uiLayer.batchDraw();
        }
    }

    destroy() {
        this._hideFilletHandle();
        if (this._ghostArc2D) {
            this._ghostArc2D.destroy();
            this._ghostArc2D = null;
        }
        if (this.filletGroup) {
            this.filletGroup.destroy();
            this.filletGroup = null;
        }
        if (this.node) {
            this.node.destroy();
        }
    }
}
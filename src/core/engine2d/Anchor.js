import Konva from 'konva';
import { SNAP_DIST } from '../registry.js';

export class Anchor {
    constructor(planner, x, y) {
        this.planner = planner; this.lastValidPos = { x, y };
        this.node = new Konva.Group({ x, y, draggable: true, visible: false });
        this.node.add(new Konva.Circle({ radius: 8, fill: "#111827", stroke: "white", strokeWidth: 2 }));
        const arrowOffset = 11; const arrowSize = 4;
        const makeArrow = (points) => new Konva.Line({ points, fill: '#111827', closed: true });
        this.node.add(makeArrow([0, -arrowOffset, -arrowSize, -arrowOffset+arrowSize, arrowSize, -arrowOffset+arrowSize]));
        this.node.add(makeArrow([0, arrowOffset, -arrowSize, arrowOffset-arrowSize, arrowSize, arrowOffset-arrowSize]));
        this.node.add(makeArrow([-arrowOffset, 0, -arrowOffset+arrowSize, -arrowSize, -arrowOffset+arrowSize, arrowSize]));
        this.node.add(makeArrow([arrowOffset, 0, arrowOffset-arrowSize, -arrowSize, arrowOffset-arrowSize, arrowSize]));
        
        this.node.on('dragstart', (e) => {
            if (this.planner.tool !== 'select') { e.target.stopDrag(); e.cancelBubble = true; return; }
            let attachedWalls = this.planner.walls.filter(w => w.startAnchor === this || w.endAnchor === this); 
            
            this.planner.selectEntity(this, 'anchor');
            
            this.trackedObjects = [];
            this.trackedArcs = [];

            const getBestWallForObject = (item, type) => {
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
            
            if (collision) { this.node.position(this.lastValidPos); } 
            else { this.node.position(proposedPos); this.lastValidPos = proposedPos; } 
            
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
            this.planner.syncAll(); 
        }); 
        this.planner.uiLayer.add(this.node);
    }
    
    get x() { return this.node.x(); } 
    get y() { return this.node.y(); } 
    show() { this.node.show(); } 
    hide() { this.node.hide(); } 
    position() { return this.node.position(); }
}
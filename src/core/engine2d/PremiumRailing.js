import Konva from 'konva';
import { WALL_REGISTRY, RAILING_REGISTRY } from '../registry.js';

export class PremiumRailing {
    constructor(planner, startAnchor, endAnchor) {
        this.planner = planner; 
        this.startAnchor = startAnchor; 
        this.endAnchor = endAnchor; 
        this.attachedWidgets = []; // Keep for interface compatibility
        this.type = 'railing'; 
        this.config = WALL_REGISTRY['railing'];
        this.thickness = this.config.thickness || 4;
        this.height = this.config.height || 0;
        this.configId = 'rail_1';

        this.strokeColor = '#9ca3af'; // Match wall default appearance
        
        this.wallGroup = new Konva.Group();
        this.poly = new Konva.Line({
            stroke: this.strokeColor,
            strokeWidth: this.thickness,
            lineJoin: 'miter',
            lineCap: 'square',
            shadowColor: 'black',
            shadowBlur: 10,
            shadowOffset: { x: 2, y: 2 },
            shadowOpacity: 0.2,
            hitStrokeWidth: 20,
            closed: false,
            fillEnabled: false
        });
        this.poly.parentWall = this;
        this.poly.isWallPoly = true;

        this.frontHighlight = new Konva.Line({ stroke: '#3b82f6', strokeWidth: 4, visible: false }); 
        this.backHighlight = new Konva.Line({ stroke: '#10b981', strokeWidth: 4, visible: false });
        this.wallGroup.add(this.poly, this.frontHighlight, this.backHighlight);
        this.planner.widgetLayer.add(this.wallGroup);

        this.labelGroup = new Konva.Group({ listening: false });
        this.labelText = new Konva.Text({ fontSize: 11, fill: "#4b5563", padding: 2, fontStyle: 'bold' });
        this.labelGroup.add(this.labelText);
        this.planner.uiLayer.add(this.labelGroup);

        this.initEvents();
        this.update();
    }

    hasEvent(eventName) { return this.config.events.includes(eventName); }
    getLength() { const p1 = this.startAnchor.position(), p2 = this.endAnchor.position(); return Math.hypot(p2.x - p1.x, p2.y - p1.y); }
    
    getBaseColor() {
        const rConf = RAILING_REGISTRY[this.configId || 'rail_1'];
        return rConf && rConf.color ? '#' + rConf.color.toString(16).padStart(6, '0') : this.strokeColor;
    }

    setHighlight(isActive) {
        const isSel = isActive || this.planner.selectedEntity === this;
        if (this.parentArc) {
            this.parentArc.walls.filter(w => w.type === 'railing').forEach(w => {
                w.poly.stroke(isSel ? "#4f46e5" : (w.hidden ? '#475569' : w.getBaseColor()));
            });
            this.planner.stage.batchDraw();
            return;
        }
        this.poly.stroke(isSel ? "#4f46e5" : (this.hidden ? '#475569' : this.getBaseColor()));
        this.planner.stage.batchDraw();
    }

    initEvents() {
        this.poly.on('mouseenter', () => { if (this.planner.tool === 'select') document.body.style.cursor = 'pointer'; });
        this.poly.on('mouseleave', () => { document.body.style.cursor = 'default'; });
        
        this.poly.on('mousedown touchstart', (e) => {
            if (this.planner.tool === 'split') {
                e.cancelBubble = true;
                if (e.evt) e.evt.stopPropagation();
                const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
                if (!pos) return;
                const proj = this.planner.getClosestPointOnSegment(pos, this.startAnchor.position(), this.endAnchor.position());
                const splitAnchor = this.planner.getOrCreateAnchor(proj.x, proj.y);
                const newRailing = new PremiumRailing(this.planner, splitAnchor, this.endAnchor);
                newRailing.configId = this.configId;
                this.endAnchor = splitAnchor;
                this.planner.walls.push(newRailing);
                this.planner.tool = 'select';
                if (this.planner.onToolChange) this.planner.onToolChange('select');
                this.planner.updateToolStates();
                this.planner.selectEntity(splitAnchor, 'anchor');
                this.planner.syncAll();
                return;
            }
            if (this.planner.tool !== 'select') return;
            e.cancelBubble = true;
            if (e.evt) e.evt.stopPropagation();
            this.planner.selectEntity(this, 'wall'); 
        });

        let startAncPos = {}, startPointer = {}, initialObjectPositions = [];
        let anchorsOnWall = [], arcsOnWall = [];
        this.poly.on('dragstart', (e) => { 
            if (this.planner.tool !== 'select') { e.target.stopDrag(); e.cancelBubble = true; return; }
            this.setHighlight(true); 
            const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition(); 
            startPointer = { x: pos.x, y: pos.y }; startAncPos = { x1: this.startAnchor.x, y1: this.startAnchor.y, x2: this.endAnchor.x, y2: this.endAnchor.y }; 
            
            anchorsOnWall = [];
            arcsOnWall = [];
            if (this.planner.anchors) {
                const p1 = this.startAnchor.position();
                const p2 = this.endAnchor.position();
                const isPointOnSegment = (p, p1, p2) => {
                    if (Math.hypot(p.x - p1.x, p.y - p1.y) < 1) return true;
                    if (Math.hypot(p.x - p2.x, p.y - p2.y) < 1) return true;
                    const C = p2.x - p1.x, D = p2.y - p1.y, lenSq = C*C + D*D;
                    if (lenSq === 0) return false;
                    let t = ((p.x - p1.x)*C + (p.y - p1.y)*D) / lenSq;
                    if (t < 0 || t > 1) return false;
                    let projX = p1.x + t*C, projY = p1.y + t*D;
                    return Math.hypot(p.x - projX, p.y - projY) < 2.0;
                };
                this.planner.anchors.forEach(a => {
                    if (a !== this.startAnchor && a !== this.endAnchor && isPointOnSegment(a.position(), p1, p2)) {
                        anchorsOnWall.push({ anchor: a, startPos: a.position() });
                    }
                });
            }
            if (this.planner.arcs) {
                this.planner.arcs.forEach(a => {
                    let p1Moving = false, p2Moving = false;
                    if (a.p1 === this.startAnchor || a.p1 === this.endAnchor || anchorsOnWall.some(aw => aw.anchor === a.p1)) p1Moving = true;
                    if (a.p2 === this.startAnchor || a.p2 === this.endAnchor || anchorsOnWall.some(aw => aw.anchor === a.p2)) p2Moving = true;
                    if (p1Moving || p2Moving) {
                        const p1Pos = a.p1.position(), p2Pos = a.p2.position();
                        const adx = p2Pos.x - p1Pos.x, ady = p2Pos.y - p1Pos.y, L = Math.hypot(adx, ady);
                        let initialH = 0;
                        if (L > 0) {
                            const mid = { x: p1Pos.x + adx/2, y: p1Pos.y + ady/2 }, n = { x: -ady/L, y: adx/L };
                            initialH = (a.pos.x - mid.x)*n.x + (a.pos.y - mid.y)*n.y;
                        }
                        arcsOnWall.push({ arc: a, startPos: { ...a.pos }, p1Moving, p2Moving, initialH });
                    }
                });
            }
            
            initialObjectPositions = [];
            if (this.planner.shapes) {
                this.planner.shapes.forEach(s => {
                    if (s.attachedWall === this) initialObjectPositions.push({ type: 'shape', obj: s, x: s.group.x(), y: s.group.y() });
                });
            }

            let attachedWalls = this.planner.walls.filter(w => 
                w !== this && (w.startAnchor === this.startAnchor || w.endAnchor === this.startAnchor || w.startAnchor === this.endAnchor || w.endAnchor === this.endAnchor)
            );

            const getBestWallForObject = (item, type) => {
                let objPos;
                if (type === 'furniture' || (type && type.startsWith('shape'))) objPos = { x: item.group.x(), y: item.group.y() };
                else return null;
                let minDist = 100;
                let bestWall = null;
                let dThis = this.planner.getDistanceToWall(objPos, this);
                if (dThis < minDist) { minDist = dThis; bestWall = this; }
                attachedWalls.forEach(w => {
                    let d = this.planner.getDistanceToWall(objPos, w);
                    if (d < minDist) { minDist = d; bestWall = w; }
                });
                return bestWall;
            };

            if (this.planner.wallTrackingEnabled) {
                const collectNear = (list, type) => {
                    if (!list) return;
                    list.forEach(item => {
                        if (initialObjectPositions.some(io => io.obj === item)) return;
                        if (getBestWallForObject(item, type) === this) {
                            initialObjectPositions.push({ type, obj: item, x: item.group.x(), y: item.group.y() });
                        }
                    });
                };
                collectNear(this.planner.furniture, 'furniture');
                collectNear(this.planner.shapes, 'shape');
            }

            this.trackedAttachedObjects = [];
            this.trackedAttachedArcs = [];

            attachedWalls.forEach(w => {
                const p1 = w.startAnchor.position();
                const p2 = w.endAnchor.position();
                const dx = p2.x - p1.x, dy = p2.y - p1.y;
                const wallAngle = Math.atan2(dy, dx);
                const len = Math.hypot(dx, dy);

                if (this.planner.wallTrackingEnabled) {
                    const collectNearAtt = (list, type) => {
                        if (!list) return;
                        list.forEach(item => {
                            if (this.trackedAttachedObjects.some(to => to.obj === item)) return;
                            if (initialObjectPositions.some(io => io.obj === item)) return;
                            if (getBestWallForObject(item, type) === w) {
                                let pos = { x: item.group.x(), y: item.group.y() };
                                const t = len === 0 ? 0 : ((pos.x - p1.x)*dx + (pos.y - p1.y)*dy) / (len*len);
                                const distToWall = len === 0 ? 0 : (pos.x - p1.x)*(-dy/len) + (pos.y - p1.y)*(dx/len);
                                this.trackedAttachedObjects.push({
                                    wall: w, type, obj: item,
                                    relT: t, normDist: distToWall,
                                    relRot: (item.rotation || 0) - (wallAngle * 180 / Math.PI)
                                });
                            }
                        });
                    };
                    collectNearAtt(this.planner.furniture, 'furniture');
                    collectNearAtt(this.planner.shapes, 'shape');
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
                        if (arcsOnWall.some(aw => aw.arc === a)) return;
                        if (this.trackedAttachedArcs.some(ta => ta.arc === a)) return;

                        let p1OnWall = isPointOnSegment(a.p1.position(), p1, p2);
                        let p2OnWall = isPointOnSegment(a.p2.position(), p1, p2);
                        if (p1OnWall && p2OnWall) {
                            const getRel = (pos) => {
                                const t = len === 0 ? 0 : ((pos.x - p1.x)*dx + (pos.y - p1.y)*dy) / (len*len);
                                const normDist = len === 0 ? 0 : (pos.x - p1.x)*(-dy/len) + (pos.y - p1.y)*(dx/len);
                                return { t, normDist };
                            };
                            this.trackedAttachedArcs.push({ arc: a, wall: w, p1Rel: getRel(a.p1.position()), p2Rel: getRel(a.p2.position()), posRel: getRel(a.pos) });
                        }
                    });
                }
            });        }); 
            this.poly.on('dragmove', () => { 
            if (this.planner.tool !== 'select') return;
            const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition(); 
            const dx = this.planner.snap(pos.x - startPointer.x), dy = this.planner.snap(pos.y - startPointer.y); 
            const proposedStart = { x: startAncPos.x1 + dx, y: startAncPos.y1 + dy }, proposedEnd = { x: startAncPos.x2 + dx, y: startAncPos.y2 + dy }; 
            this.poly.position({ x: 0, y: 0 });
            let ignoreList = [this];
            this.planner.walls.forEach(w => {
                if (w.startAnchor === this.startAnchor || w.endAnchor === this.startAnchor || 
                    w.startAnchor === this.endAnchor || w.endAnchor === this.endAnchor) {
                    ignoreList.push(w);
                }
                if (anchorsOnWall.some(aw => aw.anchor === w.startAnchor || aw.anchor === w.endAnchor)) {
                    ignoreList.push(w);
                }
            });
            arcsOnWall.forEach(item => {
                if (item.arc && item.arc.walls) {
                    ignoreList.push(...item.arc.walls);
                }
            });
            if (this.trackedAttachedArcs) {
                this.trackedAttachedArcs.forEach(item => {
                    if (item.arc && item.arc.walls) {
                        ignoreList.push(...item.arc.walls);
                    }
                });
            }
            if (this.hasEvent("stop_collision") && this.planner.checkWallIntersection(proposedStart, proposedEnd, ignoreList)) return;
            this.startAnchor.node.position(proposedStart); this.endAnchor.node.position(proposedEnd); this.startAnchor.lastValidPos = proposedStart; this.endAnchor.lastValidPos = proposedEnd;

            anchorsOnWall.forEach(item => {
                item.anchor.node.position({ x: item.startPos.x + dx, y: item.startPos.y + dy });
                item.anchor.lastValidPos = { x: item.startPos.x + dx, y: item.startPos.y + dy };
            });

            arcsOnWall.forEach(item => {
                if (item.p1Moving && item.p2Moving) {
                    item.arc.pos = { x: item.startPos.x + dx, y: item.startPos.y + dy };
                } else {
                    const p1Pos = item.arc.p1.position(), p2Pos = item.arc.p2.position();
                    const adx = p2Pos.x - p1Pos.x, ady = p2Pos.y - p1Pos.y, L = Math.hypot(adx, ady);
                    if (L > 0.5) {
                        const mid = { x: p1Pos.x + adx/2, y: p1Pos.y + ady/2 }, n = { x: -ady/L, y: adx/L };
                        item.arc.pos = { x: mid.x + n.x * item.initialH, y: mid.y + n.y * item.initialH };
                    }
                }
                if (item.arc.controlHandle) item.arc.controlHandle.position(item.arc.pos);
            });

            if (initialObjectPositions.length > 0) {
                initialObjectPositions.forEach(item => {
                    if (item.type === 'furniture' || item.type === 'shape') {
                        item.obj.group.position({ x: item.x + dx, y: item.y + dy });
                        if (item.obj.update) item.obj.update();
                    }
                });
            }

            if (this.planner.wallTrackingEnabled && this.trackedAttachedObjects && this.trackedAttachedObjects.length > 0) {
                this.trackedAttachedObjects.forEach(item => {
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

            if (this.trackedAttachedArcs && this.trackedAttachedArcs.length > 0) {
                this.trackedAttachedArcs.forEach(item => {
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

            this.planner.syncAll();
            });        this.poly.on('dragend', () => { this.planner.selectEntity(this.planner.selectedEntity, this.planner.selectedType, this.planner.selectedNodeIndex); });
    }

    getClosestT(pos) { const p1 = this.startAnchor.position(), p2 = this.endAnchor.position(), dx = p2.x - p1.x, dy = p2.y - p1.y, lenSq = dx*dx + dy*dy; if (lenSq === 0) return 0.5; let t = ((pos.x - p1.x) * dx + (pos.y - p1.y) * dy) / lenSq; return Math.max(0, Math.min(1, t)); }

    update() {
        if (this.parentArc) {
            this.parentArc.railingConfig.configId = this.configId;
            this.parentArc.railingConfig.thickness = this.thickness;
            this.parentArc.railingConfig.height = this.height;
            this.parentArc.walls.filter(w => w.type === 'railing').forEach(w => {
                if (w !== this) {
                    w.configId = this.configId; w.thickness = this.thickness; w.height = this.height; w.poly.stroke(w.getBaseColor());
                }
            });
        }
        const p1 = this.startAnchor.position(), p2 = this.endAnchor.position(); 
        this.poly.points([p1.x, p1.y, p2.x, p2.y]);
        
        const isSel = this.planner.selectedEntity === this || (this.parentArc && this.planner.selectedEntity === this.parentArc);
        if (this.hidden) {
            this.poly.stroke(isSel ? '#4f46e5' : '#475569');
            this.poly.dash([6, 6]);
            this.poly.opacity(0.7);
        } else {
            this.poly.stroke(isSel ? '#4f46e5' : this.getBaseColor());
            this.poly.dash([]);
            this.poly.opacity(1);
        }
        this.poly.strokeWidth(this.thickness || this.config.thickness || 4);
        this.labelText.text(this.planner.formatLength(this.getLength()));
        this.labelGroup.position({ x: (p1.x + p2.x) / 2 - this.labelText.width() / 2, y: (p1.y + p2.y) / 2 - 15 });
        this.labelGroup.visible(this.planner.settings ? this.planner.settings.showDimensionLabels : true);    }

    remove() {
        if (this.parentArc) {
            this.parentArc.hasRailing = false;
            this.parentArc.rebuild();
            this.planner.selectEntity(null);
            this.planner.syncAll();
            return;
        }
        this.wallGroup.destroy(); this.labelGroup.destroy(); this.planner.walls = this.planner.walls.filter(w => w !== this); this.planner.selectEntity(null); this.planner.syncAll();
    }
}
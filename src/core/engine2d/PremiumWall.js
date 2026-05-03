import Konva from 'konva';
import { WALL_REGISTRY, WIDGET_REGISTRY, RAILING_REGISTRY } from '../registry.js';
import { PremiumWidget } from './PremiumWidget.js';

export class PremiumWall {
    constructor(planner, startAnchor, endAnchor, type = "outer") {
        this.planner = planner; this.startAnchor = startAnchor; this.endAnchor = endAnchor; this.attachedWidgets = []; this.type = type; this.config = WALL_REGISTRY[type] || WALL_REGISTRY['outer'];
        this.thickness = this.config.thickness;
        this.height = this.config.height || 120;
        
        // Parametric constraints to prevent joint folding on acute angles
        this.miterLimitRatio = this.config.miterLimitRatio || 3;
        this.miterLimit = this.config.miterLimit || 10; // Native canvas bevel cutoff (standard is 10)
        this.miterFoldLimit = this.config.miterFoldLimit || 20; // Intersection distance multiplier fallback
        
        this.elevationLayers = { front: [{ id: Date.now(), texture: 'none', color: '#e2e8f0', x: 0, y: 0, w: '100%', h: '100%' }], back: [{ id: Date.now()+1, texture: 'none', color: '#f8fafc', x: 0, y: 0, w: '100%', h: '100%' }] };
        this.fillColor = this.type === 'outer' ? '#e5e5e5' : '#f3f4f6'; 
        this.strokeColor = this.type === 'outer' ? '#9ca3af' : '#d1d5db';
        this.wallGroup = new Konva.Group(); 
        
        this.poly = new Konva.Line({ 
            fill: this.fillColor, 
            stroke: this.strokeColor, 
            strokeWidth: 1,
            closed: true, 
            lineJoin: 'miter',
            lineCap: 'square',
            miterLimit: this.miterLimit,
        });
        this.poly.parentWall = this;
        this.poly.isWallPoly = true;
        
        this.poly.sceneFunc((ctx, shape) => {
            if (!this.wallShapeData) return;
            const { startL, endL, endR, startR, hasStartCap, hasEndCap, startData, endData } = this.wallShapeData;

            // 1. Fill Path (Solid Interior)
            ctx.beginPath();
            if (startData.bevelL) { ctx.moveTo(startData.bevelL.x, startData.bevelL.y); ctx.lineTo(startL.x, startL.y); }
            else { ctx.moveTo(startL.x, startL.y); }
            
            ctx.lineTo(endL.x, endL.y);
            
            if (endData.bevelL) { ctx.lineTo(endData.bevelL.x, endData.bevelL.y); }
            if (endData.bevelR) { ctx.lineTo(endData.bevelR.x, endData.bevelR.y); }
            
            ctx.lineTo(endR.x, endR.y);
            ctx.lineTo(startR.x, startR.y);
            
            if (startData.bevelR) { ctx.lineTo(startData.bevelR.x, startData.bevelR.y); }
            
            ctx.closePath();
            ctx.fillShape(shape);

            // 2. Stroke Path (Exact outlines following bevel rules without overshooting)
            ctx.beginPath();
            
            // Left side
            if (startData.bevelL) { ctx.moveTo(startData.bevelL.x, startData.bevelL.y); ctx.lineTo(startL.x, startL.y); }
            else { ctx.moveTo(startL.x, startL.y); }
            
            ctx.lineTo(endL.x, endL.y);
            if (endData.bevelL) { ctx.lineTo(endData.bevelL.x, endData.bevelL.y); }

            // Handle end cap or start a new right-side stroke
            if (hasEndCap) {
                if (endData.bevelR) { ctx.lineTo(endData.bevelR.x, endData.bevelR.y); }
                ctx.lineTo(endR.x, endR.y);
            } else {
                ctx.strokeShape(shape); // Stroke the left path
                ctx.beginPath(); // Start new path for right side
                if (endData.bevelR) { ctx.moveTo(endData.bevelR.x, endData.bevelR.y); ctx.lineTo(endR.x, endR.y); }
                else { ctx.moveTo(endR.x, endR.y); }
            }

            // Right side (drawn backwards from end to start)
            ctx.lineTo(startR.x, startR.y);
            if (startData.bevelR) { ctx.lineTo(startData.bevelR.x, startData.bevelR.y); }

            // Handle start cap transition
            if (hasStartCap) {
                if (startData.bevelL) { ctx.lineTo(startData.bevelL.x, startData.bevelL.y); }
                else { ctx.lineTo(startL.x, startL.y); }
            }
            
            ctx.strokeShape(shape);
        });
        
        this.frontHighlight = new Konva.Line({ stroke: '#3b82f6', strokeWidth: 4, visible: false, lineCap: 'square', lineJoin: 'miter' }); 
        this.backHighlight = new Konva.Line({ stroke: '#10b981', strokeWidth: 4, visible: false, lineCap: 'square', lineJoin: 'miter' });
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
    setHighlight(isActive) { 
        const isSel = isActive;
        if (this.hidden) {
            this.poly.fill(isSel ? '#bfdbfe' : '#cbd5e1');
            this.poly.stroke(isSel ? '#4f46e5' : '#475569');
        } else {
            this.poly.fill(isSel ? '#bfdbfe' : this.fillColor);
            this.poly.stroke(isSel ? '#4f46e5' : this.strokeColor);
        }
        this.planner.stage.batchDraw(); 
    }
    
    initEvents() { 
        this.poly.on('mouseenter', () => { if (this.planner.tool === 'select' || WIDGET_REGISTRY[this.planner.tool]) document.body.style.cursor = 'pointer'; });
        this.poly.on('mouseleave', () => { document.body.style.cursor = 'default'; });
        this.poly.on('mousedown touchstart', (e) => { 
            this.wallGroup.moveToTop();
            console.log("Wall mousedown/touchstart event fired.", { tool: this.planner.tool, isWidget: !!WIDGET_REGISTRY[this.planner.tool] });
            
            if (this.planner.tool === 'split') {
                e.cancelBubble = true;
                if (e.evt) e.evt.stopPropagation();
                const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
                if (!pos) return;
                
                const proj = this.planner.getClosestPointOnSegment(pos, this.startAnchor.position(), this.endAnchor.position());
                const splitAnchor = this.planner.getOrCreateAnchor(proj.x, proj.y);
                
                const newWall = new PremiumWall(this.planner, splitAnchor, this.endAnchor, this.type);
                this.endAnchor = splitAnchor;
                
                this.planner.walls.push(newWall);
                
                this.planner.tool = 'select';
                if (this.planner.onToolChange) this.planner.onToolChange('select');
                this.planner.updateToolStates();
                this.planner.selectEntity(splitAnchor, 'anchor');
                this.planner.syncAll();
                return;
            }
            if (WIDGET_REGISTRY[this.planner.tool]) { 
                console.log("Widget tool is active. Attempting to create widget.");
                e.cancelBubble = true; 
                if (e.evt) e.evt.stopPropagation();
                const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition(); 
                if (!pos) {
                    console.error("Could not get pointer position.");
                    return;
                }
                let t = this.getClosestT(pos); 
                console.log("Calculated t:", t, "Position:", pos);
                const widget = new PremiumWidget(this.planner, this, t, this.planner.tool); 
                this.attachedWidgets.push(widget); 
                this.planner.selectEntity(widget, 'widget'); 
                this.planner.syncAll(); 
                console.log("Widget added:", widget);
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
            this.setHighlight(true); const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition(); startPointer = { x: pos.x, y: pos.y }; startAncPos = { x1: this.startAnchor.x, y1: this.startAnchor.y, x2: this.endAnchor.x, y2: this.endAnchor.y }; 
            
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
                                return { t, normDist, initialLen: len };
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
            const proposedStart = { x: startAncPos.x1 + dx, y: startAncPos.y1 + dy }; 
            const proposedEnd = { x: startAncPos.x2 + dx, y: startAncPos.y2 + dy }; 
            
            this.poly.position({ x: 0, y: 0 }); // Prevent drift on collision
            
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
            if (this.hasEvent("stop_collision") && this.planner.checkWallIntersection(proposedStart, proposedEnd, ignoreList)) return; 
            
            this.startAnchor.node.position(proposedStart); 
            this.endAnchor.node.position(proposedEnd); 
            this.startAnchor.lastValidPos = proposedStart;
            this.endAnchor.lastValidPos = proposedEnd;
            
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
        }); 
        this.poly.on('dragend', () => { this.planner.selectEntity(this.planner.selectedEntity, this.planner.selectedType, this.planner.selectedNodeIndex); });
    }
    
    getClosestT(pos) { const p1 = this.startAnchor.position(), p2 = this.endAnchor.position(), dx = p2.x - p1.x, dy = p2.y - p1.y, lenSq = dx*dx + dy*dy; if (lenSq === 0) return 0.5; let t = ((pos.x - p1.x) * dx + (pos.y - p1.y) * dy) / lenSq; return Math.max(0, Math.min(1, t)); }
    
    update() { 
        const getExactPos = (anchor) => { const p = anchor.position(); return { x: p.x, y: p.y }; };
        const p1 = getExactPos(this.startAnchor), p2 = getExactPos(this.endAnchor); const vdx = p2.x - p1.x, vdy = p2.y - p1.y, vlen = Math.hypot(vdx, vdy); if (vlen === 0) return;
        const u = { x: vdx/vlen, y: vdy/vlen }, n = { x: -u.y, y: u.x }, ht = this.thickness / 2;
        const p1_L = { x: p1.x + n.x * ht, y: p1.y + n.y * ht }, p1_R = { x: p1.x - n.x * ht, y: p1.y - n.y * ht }, p2_L = { x: p2.x + n.x * ht, y: p2.y + n.y * ht }, p2_R = { x: p2.x - n.x * ht, y: p2.y - n.y * ht };
        
        let startL = p1_L, startR = p1_R, endL = p2_L, endR = p2_R;
        const intersectLines = (pA, dA, pB, dB) => { const det = dA.x * dB.y - dA.y * dB.x; if (Math.abs(det) < 1e-5) return null; const t = ((pB.x - pA.x) * dB.y - (pB.y - pA.y) * dB.x) / det; return { x: pA.x + t * dA.x, y: pA.y + t * dA.y }; };
        const getCorners = (anchor, isStart) => {
            const baseL = isStart ? p1_L : p2_L, baseR = isStart ? p1_R : p2_R, P = getExactPos(anchor);
            const connectedWalls = this.planner.walls.filter(w => (w.startAnchor === anchor || w.endAnchor === anchor) && w !== this && w.type !== 'railing' && !w.hidden);
            
            const getTJointIntersections = (snappedWall) => {
                const w2_p1 = getExactPos(snappedWall.startAnchor), w2_p2 = getExactPos(snappedWall.endAnchor), vdx2 = w2_p2.x - w2_p1.x, vdy2 = w2_p2.y - w2_p1.y, vlen2 = Math.hypot(vdx2, vdy2);
                if (vlen2 > 0) {
                    const u2 = { x: vdx2/vlen2, y: vdy2/vlen2 }, n2 = { x: -u2.y, y: u2.x }, ht2 = (snappedWall.thickness || snappedWall.config.thickness) / 2;
                    const edge1_P = { x: w2_p1.x + n2.x * ht2, y: w2_p1.y + n2.y * ht2 }, edge2_P = { x: w2_p1.x - n2.x * ht2, y: w2_p1.y - n2.y * ht2 };
                    const iL1 = intersectLines(baseL, u, edge1_P, u2), iL2 = intersectLines(baseL, u, edge2_P, u2);
                    const iR1 = intersectLines(baseR, u, edge1_P, u2), iR2 = intersectLines(baseR, u, edge2_P, u2);
                    const otherP = isStart ? p2 : p1;
                    let finalL = baseL, finalR = baseR;
                    if (iL1 && iL2) finalL = Math.hypot(iL1.x - otherP.x, iL1.y - otherP.y) < Math.hypot(iL2.x - otherP.x, iL2.y - otherP.y) ? iL1 : iL2; else if (iL1) finalL = iL1; else if (iL2) finalL = iL2;
                    if (iR1 && iR2) finalR = Math.hypot(iR1.x - otherP.x, iR1.y - otherP.y) < Math.hypot(iR2.x - otherP.x, iR2.y - otherP.y) ? iR1 : iR2; else if (iR1) finalR = iR1; else if (iR2) finalR = iR2;
                    return [finalL, finalR];
                }
                return null;
            };
            
            const rays = [];
            this.planner.walls.forEach(w => {
                if ((w.startAnchor === anchor || w.endAnchor === anchor) && w.type !== 'railing' && (!w.hidden || w === this)) {
                    const isWStart = w.startAnchor === anchor;
                    const wp1 = getExactPos(w.startAnchor);
                    const wp2 = getExactPos(w.endAnchor);
                    const wu = { x: wp2.x - wp1.x, y: wp2.y - wp1.y };
                    const wlen = Math.hypot(wu.x, wu.y);
                    if (wlen === 0) return;
                    wu.x /= wlen; wu.y /= wlen;
                    const wn = { x: -wu.y, y: wu.x };
                    const wht = (w.thickness || w.config.thickness) / 2;
                    
                    const w_p1_L = { x: wp1.x + wn.x * wht, y: wp1.y + wn.y * wht };
                    const w_p1_R = { x: wp1.x - wn.x * wht, y: wp1.y - wn.y * wht };
                    const w_p2_L = { x: wp2.x + wn.x * wht, y: wp2.y + wn.y * wht };
                    const w_p2_R = { x: wp2.x - wn.x * wht, y: wp2.y - wn.y * wht };
                    
                    const dir = isWStart ? wu : { x: -wu.x, y: -wu.y };
                    rays.push({
                        w: w,
                        dir: dir,
                        angle: Math.atan2(dir.y, dir.x),
                        L_pt: isWStart ? w_p1_L : w_p2_R,
                        R_pt: isWStart ? w_p1_R : w_p2_L
                    });
                }
            });
            
            if (rays.length === 1) {
                let snappedWall = null; for (let w of this.planner.walls) { if (w === this || w.type === 'railing' || w.hidden) continue; if (this.planner.getDistanceToWall(P, w) < 2) { snappedWall = w; break; } }
                if (snappedWall) {
                    const corners = getTJointIntersections(snappedWall);
                    if (corners) return { corners, hasCap: false };
                }
                return { corners: [baseL, baseR], hasCap: true };
            }
            
            rays.sort((a, b) => a.angle - b.angle);
            const myIndex = rays.findIndex(r => r.w === this);
            if (myIndex === -1) return { corners: [baseL, baseR], hasCap: true };
            
            const leftNeighbor = rays[(myIndex - 1 + rays.length) % rays.length];
            const rightNeighbor = rays[(myIndex + 1) % rays.length];
            
            const myRay = rays[myIndex];
            
            const maxMiterLength = ht * this.miterLimitRatio;

            // Cross products to determine if the wedge is an inner corner (<180 deg) or outer corner (>180 deg)
            const cpL = myRay.dir.x * rightNeighbor.dir.y - myRay.dir.y * rightNeighbor.dir.x;
            let leftSideCorner = myRay.L_pt, leftSideBevel = rightNeighbor.R_pt;
            const iL = intersectLines(myRay.L_pt, myRay.dir, rightNeighbor.R_pt, rightNeighbor.dir);
            if (iL) {
                if (cpL >= -1e-5) { 
                    // Inner corner: Always use exact intersection to prevent inner geometry gaps/crossings
                    leftSideCorner = iL;
                    leftSideBevel = null;
                } else if (Math.hypot(iL.x - P.x, iL.y - P.y) <= maxMiterLength) { 
                    // Outer corner: Apply miter limit, fallback to bevel if exceeded
                    leftSideCorner = iL;
                    leftSideBevel = null;
                }
            }

            const cpR = leftNeighbor.dir.x * myRay.dir.y - leftNeighbor.dir.y * myRay.dir.x;
            let rightSideCorner = myRay.R_pt, rightSideBevel = leftNeighbor.L_pt;
            const iR = intersectLines(myRay.R_pt, myRay.dir, leftNeighbor.L_pt, leftNeighbor.dir);
            if (iR) {
                if (cpR >= -1e-5) {
                    // Inner corner
                    rightSideCorner = iR;
                    rightSideBevel = null;
                } else if (Math.hypot(iR.x - P.x, iR.y - P.y) <= maxMiterLength) {
                    // Outer corner
                    rightSideCorner = iR;
                    rightSideBevel = null;
                }
            }

            let finalL, finalR, bevelL, bevelR;
            if (isStart) {
                finalL = leftSideCorner; finalR = rightSideCorner;
                bevelL = leftSideBevel; bevelR = rightSideBevel;
            } else {
                finalL = rightSideCorner; finalR = leftSideCorner;
                bevelL = rightSideBevel; bevelR = leftSideBevel;
            }

            return { 
                corners: [finalL, finalR], 
                hasCap: false, 
                leftDir: leftNeighbor.dir, 
                rightDir: rightNeighbor.dir,
                bevelL: bevelL,
                bevelR: bevelR
            };
        };
        const startData = getCorners(this.startAnchor, true);
        const endData = getCorners(this.endAnchor, false);
        const startCorners = startData.corners;
        const endCorners = endData.corners;
        startL = { x: startCorners[0].x, y: startCorners[0].y };
        startR = { x: startCorners[1].x, y: startCorners[1].y };
        endL = { x: endCorners[0].x, y: endCorners[0].y };
        endR = { x: endCorners[1].x, y: endCorners[1].y };
        
        this.wallShapeData = {
            startL, endL, endR, startR,
            hasStartCap: startData.hasCap,
            hasEndCap: endData.hasCap,
            startData,
            endData
        };
        
        this.poly.points([startL.x, startL.y, endL.x, endL.y, endR.x, endR.y, startR.x, startR.y]);
        this.poly.closed(true);
        this.poly.fillEnabled(true);
        this.poly.strokeWidth(1);
        this.poly.lineJoin('miter');
        this.poly.lineCap('square');
        this.poly.miterLimit(this.miterLimit);
        
        const isSel = this.planner.selectedEntity === this || (this.parentArc && this.planner.selectedEntity === this.parentArc);
        if (this.hidden) {
            this.poly.dash([6, 6]);
            this.poly.opacity(0.7);
            this.poly.stroke(isSel ? '#4f46e5' : '#475569');
            this.poly.fill(isSel ? '#bfdbfe' : '#cbd5e1');
        } else {
            this.poly.dash([]);
            this.poly.opacity(1);
            this.poly.stroke(isSel ? '#4f46e5' : this.strokeColor);
            this.poly.fill(isSel ? '#bfdbfe' : this.fillColor);
        }

        const fOff = 4; this.frontHighlight.points([ startL.x + n.x * fOff, startL.y + n.y * fOff, endL.x + n.x * fOff, endL.y + n.y * fOff ]); this.backHighlight.points([ startR.x - n.x * fOff, startR.y - n.y * fOff, endR.x - n.x * fOff, endR.y - n.y * fOff ]);
        this.labelText.text(this.planner.formatLength(this.getLength())); this.labelGroup.position({ x: (p1.x + p2.x) / 2 - this.labelText.width() / 2, y: (p1.y + p2.y) / 2 - 15 });
        this.attachedWidgets.forEach(w => w.update()); 
    }   
    remove() { 
        this.wallGroup.destroy(); this.labelGroup.destroy(); this.attachedWidgets.forEach(w => w.remove()); this.planner.walls = this.planner.walls.filter(w => w !== this); this.planner.selectEntity(null); this.planner.syncAll(); 
    }
}

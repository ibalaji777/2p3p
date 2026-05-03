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
            if (this.planner.wallTrackingEnabled) {
                const collectNear = (list, type) => {
                    if (!list) return;
                    list.forEach(item => {
                        if (initialObjectPositions.some(io => io.obj === item)) return;
                        let objPos;
                        if (type === 'furniture' || (type && type.startsWith('shape'))) objPos = { x: item.group.x(), y: item.group.y() };
                        else return;
                        
                        if (this.planner.getDistanceToWall(objPos, this) < 100) {
                            initialObjectPositions.push({ type, obj: item, x: objPos.x, y: objPos.y });
                        }
                    });
                };
                collectNear(this.planner.furniture, 'furniture');
                collectNear(this.planner.shapes, 'shape');
            }
        });
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

            this.planner.syncAll();
        });
        this.poly.on('dragend', () => { this.planner.selectEntity(this.planner.selectedEntity, this.planner.selectedType, this.planner.selectedNodeIndex); });
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
    }

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
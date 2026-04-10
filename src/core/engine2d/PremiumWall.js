import Konva from 'konva';
import { WALL_REGISTRY, WIDGET_REGISTRY, RAILING_REGISTRY } from '../registry.js';
import { PremiumWidget } from './PremiumWidget.js';

export class PremiumWall {
    constructor(planner, startAnchor, endAnchor, type = "outer") {
        this.planner = planner; this.startAnchor = startAnchor; this.endAnchor = endAnchor; this.attachedWidgets = []; this.type = type; this.config = WALL_REGISTRY[type] || WALL_REGISTRY['outer'];
        this.thickness = this.config.thickness;
        this.height = this.config.height || 120;
        this.elevationLayers = { front: [{ id: Date.now(), texture: 'none', color: '#e2e8f0', x: 0, y: 0, w: '100%', h: '100%' }], back: [{ id: Date.now()+1, texture: 'none', color: '#f8fafc', x: 0, y: 0, w: '100%', h: '100%' }] };
        this.fillColor = this.type === 'outer' ? '#e5e5e5' : (this.type === 'railing' ? '#4b5563' : '#f3f4f6'); this.strokeColor = this.type === 'outer' ? '#9ca3af' : (this.type === 'railing' ? '#1f2937' : '#d1d5db');
        this.wallGroup = new Konva.Group(); 
        
        this.poly = new Konva.Line({ 
            fill: this.fillColor, 
            stroke: this.strokeColor, 
            strokeWidth: 2, 
            closed: true, 
            lineJoin: 'round', 
            lineCap: 'round',
            shadowColor: 'black', 
            shadowBlur: 10, 
            shadowOffset: {x: 2, y: 2}, 
            shadowOpacity: 0.2, 
            hitStrokeWidth: 20 
        });
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
    setHighlight(isActive) { 
        const getBaseColor = (w) => {
            if (w.type === 'railing') {
                const rConf = RAILING_REGISTRY[w.configId || 'rail_1'];
                return rConf && rConf.color ? '#' + rConf.color.toString(16).padStart(6, '0') : w.strokeColor;
            }
            return w.strokeColor;
        };

        if (this.parentArc && this.type === 'railing') {
            this.parentArc.walls.filter(w => w.type === 'railing').forEach(w => {
                w.poly.stroke(isActive ? "#4f46e5" : getBaseColor(w));
            });
            this.planner.stage.batchDraw();
            return;
        }
        this.poly.stroke(isActive ? "#4f46e5" : (this.planner.selectedEntity === this ? "#4f46e5" : getBaseColor(this))); this.planner.stage.batchDraw(); 
    }
    
    initEvents() { 
        this.poly.on('mouseenter', () => { if (this.planner.tool === 'select' || WIDGET_REGISTRY[this.planner.tool]) document.body.style.cursor = 'pointer'; });
        this.poly.on('mouseleave', () => { document.body.style.cursor = 'default'; });
        this.poly.on('mousedown touchstart', (e) => { 
            console.log("Wall mousedown/touchstart event fired.", { tool: this.planner.tool, isWidget: !!WIDGET_REGISTRY[this.planner.tool] });
            if (this.planner.tool === 'split_wall') {
                e.cancelBubble = true;
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
            if (this.planner.tool !== 'select') return; e.cancelBubble = true; this.planner.selectEntity(this, 'wall'); 
        }); 
        let startAncPos = {}, startPointer = {}; 
        this.poly.on('dragstart', () => { this.setHighlight(true); const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition(); startPointer = { x: pos.x, y: pos.y }; startAncPos = { x1: this.startAnchor.x, y1: this.startAnchor.y, x2: this.endAnchor.x, y2: this.endAnchor.y }; }); 
        this.poly.on('dragmove', () => { 
            const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition(); 
            const dx = this.planner.snap(pos.x - startPointer.x), dy = this.planner.snap(pos.y - startPointer.y); 
            const proposedStart = { x: startAncPos.x1 + dx, y: startAncPos.y1 + dy }; 
            const proposedEnd = { x: startAncPos.x2 + dx, y: startAncPos.y2 + dy }; 
            
            this.poly.position({ x: 0, y: 0 }); // Prevent drift on collision
            
            if (this.hasEvent("stop_collision") && this.planner.checkWallIntersection(proposedStart, proposedEnd, [this])) return; 
            
            this.startAnchor.node.position(proposedStart); 
            this.endAnchor.node.position(proposedEnd); 
            this.startAnchor.lastValidPos = proposedStart;
            this.endAnchor.lastValidPos = proposedEnd;
            
            this.planner.syncAll(); 
        }); 
        this.poly.on('dragend', () => { this.setHighlight(this.planner.selectedEntity === this); });
    }
    
    getClosestT(pos) { const p1 = this.startAnchor.position(), p2 = this.endAnchor.position(), dx = p2.x - p1.x, dy = p2.y - p1.y, lenSq = dx*dx + dy*dy; if (lenSq === 0) return 0.5; let t = ((pos.x - p1.x) * dx + (pos.y - p1.y) * dy) / lenSq; return Math.max(0, Math.min(1, t)); }
    
    update() { 
        if (this.parentArc && this.type === 'railing') {
            this.parentArc.railingConfig.configId = this.configId;
            this.parentArc.railingConfig.thickness = this.thickness;
            this.parentArc.railingConfig.height = this.height;
            this.parentArc.walls.filter(w => w.type === 'railing').forEach(w => {
                if (w !== this) {
                    w.configId = this.configId;
                    w.thickness = this.thickness;
                    w.height = this.height;
                    const rConf = RAILING_REGISTRY[w.configId || 'rail_1'];
                    if (rConf && rConf.color) w.poly.stroke('#' + rConf.color.toString(16).padStart(6, '0'));
                    else w.poly.stroke(w.strokeColor);
                }
            });
        }
        
        const p1 = this.startAnchor.position(), p2 = this.endAnchor.position(); const vdx = p2.x - p1.x, vdy = p2.y - p1.y, vlen = Math.hypot(vdx, vdy); if (vlen === 0) return;
        const u = { x: vdx/vlen, y: vdy/vlen }, n = { x: -u.y, y: u.x }, ht = this.thickness / 2;
        const p1_L = { x: p1.x + n.x * ht, y: p1.y + n.y * ht }, p1_R = { x: p1.x - n.x * ht, y: p1.y - n.y * ht }, p2_L = { x: p2.x + n.x * ht, y: p2.y + n.y * ht }, p2_R = { x: p2.x - n.x * ht, y: p2.y - n.y * ht };
        
        let startL = p1_L, startR = p1_R, endL = p2_L, endR = p2_R;
        if (this.type === 'railing') {
            this.poly.points([p1.x, p1.y, p2.x, p2.y]);
            this.poly.closed(false);
            this.poly.fillEnabled(false);
            const rConf = RAILING_REGISTRY[this.configId || 'rail_1'];
            this.poly.stroke(rConf && rConf.color ? '#' + rConf.color.toString(16).padStart(6, '0') : this.strokeColor);
            this.poly.strokeWidth(this.thickness || this.config.thickness || 4);
        } else {
            const intersectLines = (pA, dA, pB, dB) => { const det = dA.x * dB.y - dA.y * dB.x; if (Math.abs(det) < 1e-5) return null; const t = ((pB.x - pA.x) * dB.y - (pB.y - pA.y) * dB.x) / det; return { x: pA.x + t * dA.x, y: pA.y + t * dA.y }; };
            const getCorners = (anchor, isStart) => {
                const baseL = isStart ? p1_L : p2_L, baseR = isStart ? p1_R : p2_R, P = anchor.position();
                const connectedWalls = this.planner.walls.filter(w => (w.startAnchor === anchor || w.endAnchor === anchor) && w !== this && w.type !== 'railing');
                if (connectedWalls.length >= 1) {
                    const w2 = connectedWalls[0], w2_p1 = w2.startAnchor.position(), w2_p2 = w2.endAnchor.position(), vdx2 = w2_p2.x - w2_p1.x, vdy2 = w2_p2.y - w2_p1.y, vlen2 = Math.hypot(vdx2, vdy2);
                    if (vlen2 > 0) { const u2 = { x: vdx2/vlen2, y: vdy2/vlen2 }, n2 = { x: -u2.y, y: u2.x }, ht2 = w2.thickness / 2; const w2_baseL = { x: P.x + n2.x * ht2, y: P.y + n2.y * ht2 }, w2_baseR = { x: P.x - n2.x * ht2, y: P.y - n2.y * ht2 }; const iL = intersectLines(baseL, u, w2_baseL, u2), iR = intersectLines(baseR, u, w2_baseR, u2); if (iL && iR) { const distL = Math.hypot(iL.x - P.x, iL.y - P.y), distR = Math.hypot(iR.x - P.x, iR.y - P.y), maxDist = Math.max(ht, ht2) * 5; if (distL < maxDist && distR < maxDist) { return [iL, iR]; } } }
                } else if (connectedWalls.length === 0) {
                    let snappedWall = null; for (let w of this.planner.walls) { if (w === this || w.type === 'railing') continue; if (this.planner.getDistanceToWall(P, w) < 2) { snappedWall = w; break; } }
                    if (snappedWall) {
                        const w2_p1 = snappedWall.startAnchor.position(), w2_p2 = snappedWall.endAnchor.position(), vdx2 = w2_p2.x - w2_p1.x, vdy2 = w2_p2.y - w2_p1.y, vlen2 = Math.hypot(vdx2, vdy2);
                        if (vlen2 > 0) { const u2 = { x: vdx2/vlen2, y: vdy2/vlen2 }, n2 = { x: -u2.y, y: u2.x }, ht2 = snappedWall.thickness / 2; const edge1_P = { x: w2_p1.x + n2.x * ht2, y: w2_p1.y + n2.y * ht2 }, edge2_P = { x: w2_p1.x - n2.x * ht2, y: w2_p1.y - n2.y * ht2 }; const iL1 = intersectLines(baseL, u, edge1_P, u2), iL2 = intersectLines(baseL, u, edge2_P, u2), iR1 = intersectLines(baseR, u, edge1_P, u2), iR2 = intersectLines(baseR, u, edge2_P, u2); const otherP = isStart ? p2 : p1; let finalL = baseL, finalR = baseR; if (iL1 && iL2) { finalL = Math.hypot(iL1.x - otherP.x, iL1.y - otherP.y) < Math.hypot(iL2.x - otherP.x, iL2.y - otherP.y) ? iL1 : iL2; } if (iR1 && iR2) { finalR = Math.hypot(iR1.x - otherP.x, iR1.y - otherP.y) < Math.hypot(iR2.x - otherP.x, iR2.y - otherP.y) ? iR1 : iR2; } return [finalL, finalR]; }
                    }
                }
                return [baseL, baseR];
            };
            const startCorners = getCorners(this.startAnchor, true);
            const endCorners = getCorners(this.endAnchor, false);
            startL = startCorners[0]; startR = startCorners[1]; endL = endCorners[0]; endR = endCorners[1];
            this.poly.points([startL.x, startL.y, endL.x, endL.y, endR.x, endR.y, startR.x, startR.y]);
            this.poly.closed(true);
            this.poly.fillEnabled(true);
            this.poly.strokeWidth(2);
            this.poly.stroke(this.strokeColor);
            this.poly.fill(this.fillColor);
        }

        const fOff = 4; this.frontHighlight.points([ startL.x + n.x * fOff, startL.y + n.y * fOff, endL.x + n.x * fOff, endL.y + n.y * fOff ]); this.backHighlight.points([ startR.x - n.x * fOff, startR.y - n.y * fOff, endR.x - n.x * fOff, endR.y - n.y * fOff ]);
        this.labelText.text(this.planner.formatLength(this.getLength())); this.labelGroup.position({ x: (p1.x + p2.x) / 2 - this.labelText.width() / 2, y: (p1.y + p2.y) / 2 - 15 });
        this.attachedWidgets.forEach(w => w.update()); 
    }   
    remove() { 
        if (this.parentArc && this.type === 'railing') {
            this.parentArc.hasRailing = false;
            this.parentArc.rebuild();
            this.planner.selectEntity(null);
            this.planner.syncAll();
            return;
        }
        this.wallGroup.destroy(); this.labelGroup.destroy(); this.attachedWidgets.forEach(w => w.remove()); this.planner.walls = this.planner.walls.filter(w => w !== this); this.planner.selectEntity(null); this.planner.syncAll(); 
    }
}
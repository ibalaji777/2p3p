import Konva from 'konva';
import { WALL_REGISTRY, WIDGET_REGISTRY, RAILING_REGISTRY } from '../registry.js';
import { PremiumWidget } from './PremiumWidget.js';

export class PremiumWall {
    constructor(planner, startAnchor, endAnchor, type = "outer") {
        this.planner = planner; this.startAnchor = startAnchor; this.endAnchor = endAnchor; this.attachedWidgets = []; this.type = type; this.config = WALL_REGISTRY[type] || WALL_REGISTRY['outer'];
        this.thickness = this.config.thickness;
        this.height = this.config.height || 120;
        this.elevationLayers = { front: [{ id: Date.now(), texture: 'none', color: '#e2e8f0', x: 0, y: 0, w: '100%', h: '100%' }], back: [{ id: Date.now()+1, texture: 'none', color: '#f8fafc', x: 0, y: 0, w: '100%', h: '100%' }] };
        this.fillColor = this.type === 'outer' ? '#e5e5e5' : '#f3f4f6'; 
        this.strokeColor = this.type === 'outer' ? '#9ca3af' : '#d1d5db';
        this.wallGroup = new Konva.Group(); 
        
        this.poly = new Konva.Line({ 
            fill: this.fillColor, 
            stroke: this.strokeColor, 
            strokeWidth: 1,
            closed: true, 
            lineJoin: 'round',
            shadowColor: 'black', 
            shadowBlur: 10, 
            shadowOffset: {x: 2, y: 2}, 
            shadowOpacity: 0.2, 
        });
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
    setHighlight(isActive) { 
        this.poly.stroke(isActive ? "#4f46e5" : (this.planner.selectedEntity === this ? "#4f46e5" : this.strokeColor)); this.planner.stage.batchDraw(); 
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
        const getRoundedPos = (anchor) => { const p = anchor.position(); return { x: Math.round(p.x), y: Math.round(p.y) }; };
        const p1 = getRoundedPos(this.startAnchor), p2 = getRoundedPos(this.endAnchor); const vdx = p2.x - p1.x, vdy = p2.y - p1.y, vlen = Math.hypot(vdx, vdy); if (vlen === 0) return;
        const u = { x: vdx/vlen, y: vdy/vlen }, n = { x: -u.y, y: u.x }, ht = this.thickness / 2;
        const p1_L = { x: p1.x + n.x * ht, y: p1.y + n.y * ht }, p1_R = { x: p1.x - n.x * ht, y: p1.y - n.y * ht }, p2_L = { x: p2.x + n.x * ht, y: p2.y + n.y * ht }, p2_R = { x: p2.x - n.x * ht, y: p2.y - n.y * ht };
        
        let startL = p1_L, startR = p1_R, endL = p2_L, endR = p2_R;
        const intersectLines = (pA, dA, pB, dB) => { const det = dA.x * dB.y - dA.y * dB.x; if (Math.abs(det) < 1e-5) return null; const t = ((pB.x - pA.x) * dB.y - (pB.y - pA.y) * dB.x) / det; return { x: pA.x + t * dA.x, y: pA.y + t * dA.y }; };
        const getCorners = (anchor, isStart) => {
            const baseL = isStart ? p1_L : p2_L, baseR = isStart ? p1_R : p2_R, P = getRoundedPos(anchor);
            const connectedWalls = this.planner.walls.filter(w => (w.startAnchor === anchor || w.endAnchor === anchor) && w !== this && w.type !== 'railing');
            
            const getCornerIntersections = (w2) => {
                const w2_p1 = getRoundedPos(w2.startAnchor), w2_p2 = getRoundedPos(w2.endAnchor), vdx2 = w2_p2.x - w2_p1.x, vdy2 = w2_p2.y - w2_p1.y, vlen2 = Math.hypot(vdx2, vdy2);
                if (vlen2 > 0) {
                    const u2 = { x: vdx2/vlen2, y: vdy2/vlen2 }, n2 = { x: -u2.y, y: u2.x }, ht2 = (w2.thickness || w2.config.thickness) / 2;
                    const w2_L = { x: w2_p1.x + n2.x * ht2, y: w2_p1.y + n2.y * ht2 };
                    const w2_R = { x: w2_p1.x - n2.x * ht2, y: w2_p1.y - n2.y * ht2 };
                    const A_dir = isStart ? -1 : 1;
                    const B_dir = (w2.startAnchor === anchor) ? -1 : 1;
                    let iL, iR;
                    if (A_dir === B_dir) {
                        iL = intersectLines(baseL, u, w2_R, u2);
                        iR = intersectLines(baseR, u, w2_L, u2);
                    } else {
                        iL = intersectLines(baseL, u, w2_L, u2);
                        iR = intersectLines(baseR, u, w2_R, u2);
                    }
                    if (iL && iR) {
                        const maxDist = Math.max(ht, ht2) * 5;
                        if (Math.hypot(iL.x - P.x, iL.y - P.y) < maxDist && Math.hypot(iR.x - P.x, iR.y - P.y) < maxDist) {
                            return [iL, iR];
                        }
                    }
                }
                return null;
            };
            
            const getTJointIntersections = (snappedWall) => {
                const w2_p1 = getRoundedPos(snappedWall.startAnchor), w2_p2 = getRoundedPos(snappedWall.endAnchor), vdx2 = w2_p2.x - w2_p1.x, vdy2 = w2_p2.y - w2_p1.y, vlen2 = Math.hypot(vdx2, vdy2);
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
            
            if (connectedWalls.length === 1) {
                const corners = getCornerIntersections(connectedWalls[0]);
                if (corners) return corners;
            } else if (connectedWalls.length > 1) {
                let myDir = isStart ? { x: p2.x - p1.x, y: p2.y - p1.y } : { x: p1.x - p2.x, y: p1.y - p2.y };
                let myAngle = Math.atan2(myDir.y, myDir.x);
                let neighbors = connectedWalls.map(w => {
                    let w_p1 = getRoundedPos(w.startAnchor), w_p2 = getRoundedPos(w.endAnchor);
                    let dir = w.startAnchor === anchor ? { x: w_p2.x - w_p1.x, y: w_p2.y - w_p1.y } : { x: w_p1.x - w_p2.x, y: w_p1.y - w_p2.y };
                    let ang = Math.atan2(dir.y, dir.x);
                    let diff = ang - myAngle;
                    while (diff <= -Math.PI) diff += 2 * Math.PI;
                    while (diff > Math.PI) diff -= 2 * Math.PI;
                    return { w, diff };
                });
                neighbors.sort((a, b) => a.diff - b.diff);
                let rightNeighbor = neighbors.filter(n => n.diff > 0).shift() || neighbors[0];
                let leftNeighbor = neighbors.filter(n => n.diff < 0).pop() || neighbors[neighbors.length - 1];
                let finalL = baseL, finalR = baseR;
                const lCorners = getCornerIntersections(leftNeighbor.w);
                if (lCorners) finalL = lCorners[0];
                const rCorners = getCornerIntersections(rightNeighbor.w);
                if (rCorners) finalR = rCorners[1];
                return [finalL, finalR];
            } else {
                let snappedWall = null; for (let w of this.planner.walls) { if (w === this || w.type === 'railing') continue; if (this.planner.getDistanceToWall(P, w) < 2) { snappedWall = w; break; } }
                if (snappedWall) {
                    const corners = getTJointIntersections(snappedWall);
                    if (corners) return corners;
                }
            }
            return [baseL, baseR];
        };
        const startCorners = getCorners(this.startAnchor, true);
        const endCorners = getCorners(this.endAnchor, false);
        startL = { x: Math.round(startCorners[0].x), y: Math.round(startCorners[0].y) };
        startR = { x: Math.round(startCorners[1].x), y: Math.round(startCorners[1].y) };
        endL = { x: Math.round(endCorners[0].x), y: Math.round(endCorners[0].y) };
        endR = { x: Math.round(endCorners[1].x), y: Math.round(endCorners[1].y) };
        this.poly.points([startL.x, startL.y, endL.x, endL.y, endR.x, endR.y, startR.x, startR.y]);
        this.poly.closed(true);
        this.poly.fillEnabled(true);
        this.poly.strokeWidth(1);
        this.poly.lineJoin('round');
        this.poly.stroke(this.strokeColor);
        this.poly.fill(this.fillColor);

        const fOff = 4; this.frontHighlight.points([ startL.x + n.x * fOff, startL.y + n.y * fOff, endL.x + n.x * fOff, endL.y + n.y * fOff ]); this.backHighlight.points([ startR.x - n.x * fOff, startR.y - n.y * fOff, endR.x - n.x * fOff, endR.y - n.y * fOff ]);
        this.labelText.text(this.planner.formatLength(this.getLength())); this.labelGroup.position({ x: (p1.x + p2.x) / 2 - this.labelText.width() / 2, y: (p1.y + p2.y) / 2 - 15 });
        this.attachedWidgets.forEach(w => w.update()); 
    }   
    remove() { 
        this.wallGroup.destroy(); this.labelGroup.destroy(); this.attachedWidgets.forEach(w => w.remove()); this.planner.walls = this.planner.walls.filter(w => w !== this); this.planner.selectEntity(null); this.planner.syncAll(); 
    }
}
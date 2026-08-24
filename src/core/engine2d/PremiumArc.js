import Konva from 'konva';
import { SNAP_DIST, RAILING_REGISTRY } from '../registry.js';
import { Anchor } from './Anchor.js';
import { PremiumWall } from '../../features/wall/wall.renderer2d.js';

export class PremiumArc {
    constructor(planner, p1, p2, pos) {
        this.planner = planner;
        this.type = 'arc';
        this.p1 = p1; 
        this.p2 = p2;
        this.pos = { x: pos.x, y: pos.y }; 
        this.walls = [];
        this.intermediateAnchors = [];
        this.hasRailing = false;
        this.railingConfig = { configId: this.planner?.activePresetParams?.type || 'rail_1', thickness: 4, height: undefined };
        this.params = {};
        
        this.group = new Konva.Group();
        this.controlHandle = new Konva.Circle({
            radius: 8, fill: '#38bdf8', stroke: 'white', strokeWidth: 2, draggable: true, visible: false
        });
        
        this.controlHandle.on('mouseenter', () => { if(this.planner.tool === 'select') document.body.style.cursor = 'move'; });
        this.controlHandle.on('mouseleave', () => document.body.style.cursor = 'default');
        this.controlHandle.on('mousedown touchstart', (e) => { e.cancelBubble = true; this.planner.selectEntity(this, 'arc'); });
        this.controlHandle.on('dragmove', (e) => {
            e.cancelBubble = true;
            this.pos = this.controlHandle.position();
            this.rebuild();
            this.planner.syncAll();
        });
        this.controlHandle.on('dragend', (e) => {
            e.cancelBubble = true;
            this.planner.syncAll();
        });
        
        this.group.add(this.controlHandle);
        this.planner.uiLayer.add(this.group);
        
        this.rebuild();
    }
    
    getBaseColor(w) {
        if (w.type === 'railing') {
            const rConf = RAILING_REGISTRY[w.configId || 'rail_1'];
            return rConf && rConf.color ? '#' + rConf.color.toString(16).padStart(6, '0') : w.strokeColor;
        }
        return w.strokeColor;
    }
    
    setHighlight(isActive) {
        this.controlHandle.visible(isActive);
        if (isActive) {
            this.controlHandle.position(this.pos);
            this.controlHandle.moveToTop();
        }
        this.walls.forEach(w => {
            w.poly.stroke(isActive ? '#3b82f6' : this.getBaseColor(w));
        });
        this.planner.stage.batchDraw();
    }

    applyMaterial({ target, key, newMat, activeMatIndex, activeObject, ctx }) {
        this.params = this.params || {};
        if (target === 'top') this.params.textureTop = key;
        else if (target === 'bottom') this.params.textureBottom = key;
        else if (target === 'left') this.params.textureLeft = key;
        else if (target === 'right') this.params.textureRight = key;
        else if (target === 'front') this.params.textureFront = key;
        else if (target === 'back') this.params.textureBack = key;
        else if (target === 'all' || target === 'sides') {
            this.params.texture = key;
            this.params.textureSides = key;
            this.params.textureFront = key;
            this.params.textureBack = key;
            this.params.textureLeft = key;
            this.params.textureRight = key;
            this.params.textureTop = key;
            this.params.textureBottom = key;
        }

        this.walls.forEach(w => {
            w.applyMaterial({ target, key, newMat: newMat ? newMat.clone() : null, activeMatIndex, activeObject: null, ctx });
        });
    }

    rebuild() {
        this.walls.forEach(w => { w.wallGroup.destroy(); w.labelGroup.destroy(); this.planner.walls = this.planner.walls.filter(existing => existing !== w); });
        this.intermediateAnchors.forEach(a => { a.node.destroy(); this.planner.anchors = this.planner.anchors.filter(existing => existing !== a); });
        this.walls = []; this.intermediateAnchors = [];

        const p1 = this.p1.position(), p2 = this.p2.position();
        const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
        if (L < 0.5) return;
        
        const mid = { x: p1.x + dx/2, y: p1.y + dy/2 }, n = { x: -dy/L, y: dx/L };
        let h = (this.pos.x - mid.x)*n.x + (this.pos.y - mid.y)*n.y;
        if (Math.abs(Math.abs(h) - L/2) < SNAP_DIST) { h = Math.sign(h) * (L/2); }
        if (Math.abs(h) < 0.1) h = Math.sign(h) * 0.1 || 0.1;
        
        this.pos = { x: mid.x + n.x * h, y: mid.y + n.y * h };
        this.controlHandle.position(this.pos);
        
        const R = Math.abs(h/2 + (L*L)/(8*h)), dC = (L*L)/(8*h) - h/2;
        const center = { x: mid.x - n.x * dC, y: mid.y - n.y * dC };
        const sAng = Math.atan2(p1.y - center.y, p1.x - center.x), eAng = Math.atan2(p2.y - center.y, p2.x - center.x);
        const ccw = h < 0;
        let sweep = eAng - sAng;
        if (ccw) { while(sweep > 0) sweep -= Math.PI * 2; } else { while(sweep < 0) sweep += Math.PI * 2; }
        
        const arcLen = Math.abs(sweep) * R;
        let segments = Math.max(6, Math.min(48, Math.floor(arcLen / 15))), prevAnchor = this.p1;
        
        for (let i = 1; i <= segments; i++) {
            const t = i / segments, cAng = sAng + sweep * t;
            const x = center.x + R * Math.cos(cAng), y = center.y + R * Math.sin(cAng);
            
            let currentAnchor;
            if (i === segments) { currentAnchor = this.p2; } 
            else { currentAnchor = new Anchor(this.planner, x, y); currentAnchor.isArcIntermediate = true; currentAnchor.hide(); this.planner.anchors.push(currentAnchor); this.intermediateAnchors.push(currentAnchor); }
            
            if (prevAnchor !== currentAnchor) {
                if (Math.hypot(currentAnchor.x - prevAnchor.x, currentAnchor.y - prevAnchor.y) > 1.0) {
                    const newWall = new PremiumWall(this.planner, prevAnchor, currentAnchor, 'outer');
                    newWall.parentArc = this; newWall.labelGroup.visible(false);
                    if (this.thickness !== undefined) newWall.thickness = this.thickness;
                    if (this.height !== undefined) newWall.height = this.height;
                    if (this.topProfileType !== undefined) newWall.topProfileType = this.topProfileType;
                    if (this.startHeight !== undefined) newWall.startHeight = this.startHeight;
                    if (this.endHeight !== undefined) newWall.endHeight = this.endHeight;
                    if (this.peakHeight !== undefined) newWall.peakHeight = this.peakHeight;
                    if (this.flipSlope !== undefined) newWall.flipSlope = this.flipSlope;
                    if (this.hidden !== undefined) newWall.hidden = this.hidden;
                    if (this.elevation !== undefined) newWall.elevation = this.elevation;
                    if (this.params && Object.keys(this.params).length > 0) {
                        newWall.params = JSON.parse(JSON.stringify(this.params));
                    }
                    newWall.poly.off('mousedown touchstart');
                    newWall.poly.on('mousedown touchstart', (e) => { if (this.planner.tool === 'select') { e.cancelBubble = true; this.planner.selectEntity(this, 'arc'); } });
                    newWall.poly.draggable(false); newWall.poly.on('dragstart dragmove dragend', (e) => e.cancelBubble = true);
                    this.walls.push(newWall); this.planner.walls.push(newWall);
                    
                    // Auto-generate linked railing if enabled
                    if (this.hasRailing) {
                        const r = new PremiumWall(this.planner, prevAnchor, currentAnchor, 'railing');
                        r.parentArc = this; r.labelGroup.visible(false);
                        r.configId = this.railingConfig.configId;
                        if (this.railingConfig.thickness) r.thickness = this.railingConfig.thickness;
                        if (this.railingConfig.height !== undefined) r.height = this.railingConfig.height;
                        if (this.hidden !== undefined) r.hidden = this.hidden;
                        r.poly.off('mousedown touchstart');
                        r.poly.on('mousedown touchstart', (e) => { 
                            if (this.planner.tool === 'select') { 
                                e.cancelBubble = true; 
                                this.planner.selectEntity(r, 'wall'); 
                            } 
                        });
                        r.poly.draggable(false); r.poly.on('dragstart dragmove dragend', (e) => e.cancelBubble = true);
                        this.walls.push(r); this.planner.walls.push(r);
                    }
                    
                    prevAnchor = currentAnchor;
                    
                } else if (i === segments && this.walls.length > 0) { 
                    if (this.hasRailing && this.walls.length >= 2) {
                        this.walls[this.walls.length - 1].endAnchor = currentAnchor; 
                        this.walls[this.walls.length - 2].endAnchor = currentAnchor; 
                    } else {
                        this.walls[this.walls.length - 1].endAnchor = currentAnchor; 
                    }
                }
            }
        }
        this.lastP1 = { ...p1 }; this.lastP2 = { ...p2 };
        
        if (this.planner.selectedEntity === this) {
            this.walls.forEach(w => w.poly.stroke('#3b82f6'));
        }
    }
    
    update() { const p1 = this.p1.position(), p2 = this.p2.position(); if (!this.lastP1 || !this.lastP2 || this.lastP1.x !== p1.x || this.lastP1.y !== p1.y || this.lastP2.x !== p2.x || this.lastP2.y !== p2.y) this.rebuild(); }
    
    remove() { this.walls.forEach(w => { w.wallGroup.destroy(); w.labelGroup.destroy(); this.planner.walls = this.planner.walls.filter(existing => existing !== w); }); this.intermediateAnchors.forEach(a => { a.node.destroy(); this.planner.anchors = this.planner.anchors.filter(existing => existing !== a); }); this.group.destroy(); this.planner.arcs = (this.planner.arcs || []).filter(a => a !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
}
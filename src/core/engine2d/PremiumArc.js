import Konva from 'konva';
import { SNAP_DIST, RAILING_REGISTRY } from '../registry.js';
import { Anchor } from './Anchor.js';
import { WallEngine } from '../wall/WallEngine.js';

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
        this.walls.forEach(w => {
            w.wallGroup.destroy();
            w.labelGroup.destroy();
            this.planner.walls = this.planner.walls.filter(existing => existing !== w);
        });
        this.walls = [];
        
        this.intermediateAnchors.forEach(a => {
            a.node.destroy();
            this.planner.anchors = this.planner.anchors.filter(existing => existing !== a);
        });
        this.intermediateAnchors = [];
        
        const p1 = this.p1.position(), p2 = this.p2.position(), p3 = this.pos;
        this.centerHandle.position(p3);
        
        const D = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
        if (Math.abs(D) < 1e-4) return;
        
        const p1Sq = p1.x * p1.x + p1.y * p1.y, p2Sq = p2.x * p2.x + p2.y * p2.y, p3Sq = p3.x * p3.x + p3.y * p3.y;
        const Ux = (p1Sq * (p2.y - p3.y) + p2Sq * (p3.y - p1.y) + p3Sq * (p1.y - p2.y)) / D;
        const Uy = (p1Sq * (p3.x - p2.x) + p2Sq * (p1.x - p3.x) + p3Sq * (p2.x - p1.x)) / D;
        const center = { x: Ux, y: Uy }, R = Math.hypot(p1.x - Ux, p1.y - Uy);
        
        const sAng = Math.atan2(p1.y - Uy, p1.x - Ux), eAng = Math.atan2(p2.y - Uy, p2.x - Ux), mAng = Math.atan2(p3.y - Uy, p3.x - Ux);
        
        let normE = eAng - sAng; while(normE <= 0) normE += Math.PI * 2;
        let normM = mAng - sAng; while(normM <= 0) normM += Math.PI * 2;
        const ccw = (normM > normE);
        
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
                    const newWall = WallFactory.createWall(this.planner, {
                        startAnchor: prevAnchor,
                        endAnchor: currentAnchor,
                        type: 'outer',
                        thickness: this.thickness,
                        height: this.height,
                        topProfileType: this.topProfileType,
                        startHeight: this.startHeight,
                        endHeight: this.endHeight,
                        peakHeight: this.peakHeight,
                        flipSlope: this.flipSlope,
                        elevation: this.elevation,
                        params: this.params ? JSON.parse(JSON.stringify(this.params)) : {},
                        addToPlanner: false
                    });
                    newWall.parentArc = this;
                    newWall.labelGroup.visible(false);
                    if (this.hidden !== undefined) newWall.hidden = this.hidden;
                    newWall.poly.off('mousedown touchstart');
                    newWall.poly.on('mousedown touchstart', (e) => { if (this.planner.tool === 'select') { e.cancelBubble = true; this.planner.selectEntity(this, 'arc'); } });
                    newWall.poly.draggable(false); newWall.poly.on('dragstart dragmove dragend', (e) => e.cancelBubble = true);
                    this.walls.push(newWall); this.planner.walls.push(newWall);
                    
                    // Auto-generate linked railing if enabled
                    if (this.hasRailing) {
                        const r = WallFactory.createWall(this.planner, {
                            startAnchor: prevAnchor,
                            endAnchor: currentAnchor,
                            type: 'railing',
                            thickness: this.railingConfig.thickness,
                            height: this.railingConfig.height,
                            addToPlanner: false
                        });
                        r.parentArc = this; r.labelGroup.visible(false);
                        r.configId = this.railingConfig.configId;
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
                        WallEngine.setEndpoints(this.walls[this.walls.length - 1], null, currentAnchor.position(), false, this.planner);
                        WallEngine.setEndpoints(this.walls[this.walls.length - 2], null, currentAnchor.position(), false, this.planner);
                    } else {
                        WallEngine.setEndpoints(this.walls[this.walls.length - 1], null, currentAnchor.position(), false, this.planner);
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
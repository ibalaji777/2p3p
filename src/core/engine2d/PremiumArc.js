import Konva from 'konva';
import { SNAP_DIST, RAILING_REGISTRY } from '../registry.js';
import { Anchor } from './Anchor.js';
import { WallEngine } from '../wall/WallEngine.js';
import { WallFactory } from '../../features/wall/wall.factory.js';

export class PremiumArc {
    constructor(planner, p1, p2, pos, options = {}) {
        this.id = options.id || ('arc_' + Date.now() + '_' + Math.floor(Math.random() * 10000));
        this.planner = planner;
        this.type = 'arc';
        this.p1 = p1; 
        this.p2 = p2;
        this.pos = { x: pos.x, y: pos.y }; 
        this.walls = [];
        this.intermediateAnchors = [];
        this.hasRailing = false;
        this.railingConfig = { configId: this.planner?.activePresetParams?.type || 'rail_1', thickness: 4, height: undefined };
        this.params = options.params ? JSON.parse(JSON.stringify(options.params)) : {};
        if (options.thickness !== undefined) this.thickness = options.thickness;
        if (options.height !== undefined) this.height = options.height;
        if (options.elevation !== undefined) this.elevation = options.elevation;
        if (options.wallType !== undefined) this.wallType = options.wallType;
        if (options.topProfileType !== undefined) this.topProfileType = options.topProfileType;
        if (options.isCornerFillet) this.isCornerFillet = true;
        if (options.cornerData) this.cornerData = options.cornerData;
        
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
        if (this.planner?.uiLayer) {
            this.planner.uiLayer.add(this.group);
        }

        // Interactive 2D Arc Raiser Handle (One single badge for the entire curved wall)
        this.raiserGroup = new Konva.Group({ visible: false });
        this.raiserHit = new Konva.Rect({ fill: 'transparent' });
        this.raiserBg = new Konva.Rect({
            fill: '#1e293b',
            stroke: '#10b981',
            strokeWidth: 1.5,
            cornerRadius: 10,
            shadowColor: 'rgba(0, 0, 0, 0.4)',
            shadowBlur: 6,
            shadowOffset: { x: 0, y: 2 }
        });
        this.raiserText = new Konva.Text({
            fill: '#ffffff',
            fontSize: 10,
            fontStyle: 'bold',
            align: 'center',
            padding: 5
        });
        this.raiserGroup.add(this.raiserHit, this.raiserBg, this.raiserText);
        if (this.planner?.uiLayer) {
            this.planner.uiLayer.add(this.raiserGroup);
        }
        
        this.rebuild();
    }
    
    updateRaiserBadge(h) {
        if (!this.raiserText || !this.raiserBg || !this.raiserGroup) return;
        const currentH = Math.round(h !== undefined ? h : (this.height || 180));
        this.raiserText.text(`▲ ${currentH} cm ▼`);
        const pad = 5;
        const w = this.raiserText.width() + pad * 2;
        const ht = this.raiserText.height() + pad * 2;
        this.raiserBg.width(w);
        this.raiserBg.height(ht);
        if (this.raiserHit) {
            this.raiserHit.width(w + 14);
            this.raiserHit.height(ht + 14);
            this.raiserHit.position({ x: -7, y: -7 });
        }
        this.raiserGroup.offset({ x: w / 2, y: ht / 2 });
    }

    getBaseColor(w) {
        if (w.type === 'railing') {
            const rConf = RAILING_REGISTRY[w.configId || 'rail_1'];
            return rConf && rConf.color ? '#' + rConf.color.toString(16).padStart(6, '0') : w.strokeColor;
        }
        return w.strokeColor;
    }
    
    setHighlight(isActive) {
        this.controlHandle.visible(isActive && !this.isCornerFillet);
        if (isActive && !this.isCornerFillet) {
            this.controlHandle.position(this.pos);
            this.controlHandle.moveToTop();
        }
        if (this.raiserGroup && !this.isCornerFillet && this.wallType !== 'railing') {
            if (isActive) {
                this.updateRaiserBadge(this.height);
                this.raiserGroup.position({ x: this.pos.x, y: this.pos.y - 25 });
                this.raiserGroup.visible(true);
                this.raiserGroup.moveToTop();
            } else {
                this.raiserGroup.visible(false);
            }
        }
        this.walls.forEach(w => {
            w.poly.stroke(isActive ? '#3b82f6' : this.getBaseColor(w));
        });
        if (this.isCornerFillet && this.cornerApexAnchor && typeof this.cornerApexAnchor.setHighlight === 'function') {
            this.cornerApexAnchor.setHighlight(isActive);
        }
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
            if (w.mesh3D) {
                if (w.mesh3D.parent) w.mesh3D.parent.remove(w.mesh3D);
                w.mesh3D.traverse?.(c => { if (c.geometry) c.geometry.dispose(); });
                w.mesh3D = null;
            }
            this.planner.walls = this.planner.walls.filter(existing => existing !== w);
        });
        this.walls = [];
        
        this.intermediateAnchors.forEach(a => {
            a.node.destroy();
            this.planner.anchors = this.planner.anchors.filter(existing => existing !== a);
        });
        this.intermediateAnchors = [];
        
        const p1 = this.p1.position(), p2 = this.p2.position(), p3 = this.pos;
        if (this.controlHandle) this.controlHandle.position(p3);
        
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
        let accumulatedLength = 0;
        
        for (let i = 1; i <= segments; i++) {
            const t = i / segments, cAng = sAng + sweep * t;
            const x = center.x + R * Math.cos(cAng), y = center.y + R * Math.sin(cAng);
            
            let currentAnchor;
            if (i === segments) { currentAnchor = this.p2; } 
            else { currentAnchor = new Anchor(this.planner, x, y); currentAnchor.isArcIntermediate = true; currentAnchor.hide(); this.planner.anchors.push(currentAnchor); this.intermediateAnchors.push(currentAnchor); }
            
            if (prevAnchor !== currentAnchor) {
                const segLen = Math.hypot(currentAnchor.x - prevAnchor.x, currentAnchor.y - prevAnchor.y);
                if (segLen > 1.0) {
                    const newWall = WallFactory.createWall(this.planner, {
                        startAnchor: prevAnchor,
                        endAnchor: currentAnchor,
                        type: this.wallType || 'outer',
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
                    newWall.arcDistanceOffset = accumulatedLength;
                    newWall.arcSegmentIndex = this.walls.length;
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
                        r.arcDistanceOffset = accumulatedLength;
                        r.arcSegmentIndex = newWall.arcSegmentIndex;
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
                    
                    accumulatedLength += segLen;
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
        this.totalArcLength = accumulatedLength;
        this.walls.forEach(w => {
            w.totalArcLength = accumulatedLength;
            w.totalArcSegments = this.walls.length;
        });
        this.lastP1 = { ...p1 }; this.lastP2 = { ...p2 };
        
        if (this.planner.selectedEntity === this) {
            this.walls.forEach(w => w.poly.stroke('#3b82f6'));
        }
    }
    
    update() { const p1 = this.p1.position(), p2 = this.p2.position(); if (!this.lastP1 || !this.lastP2 || this.lastP1.x !== p1.x || this.lastP1.y !== p1.y || this.lastP2.x !== p2.x || this.lastP2.y !== p2.y) this.rebuild(); }
    
    move(dx, dy) {
        if (!dx && !dy) return;
        if (this.p1) {
            const pos1 = typeof this.p1.position === 'function' ? this.p1.position() : { x: this.p1.x, y: this.p1.y };
            if (typeof this.p1.position === 'function') this.p1.position({ x: pos1.x + dx, y: pos1.y + dy });
            else { this.p1.x += dx; this.p1.y += dy; }
        }
        if (this.p2) {
            const pos2 = typeof this.p2.position === 'function' ? this.p2.position() : { x: this.p2.x, y: this.p2.y };
            if (typeof this.p2.position === 'function') this.p2.position({ x: pos2.x + dx, y: pos2.y + dy });
            else { this.p2.x += dx; this.p2.y += dy; }
        }
        if (this.pos) {
            this.pos.x += dx;
            this.pos.y += dy;
        }
        this.rebuild();
        if (this.planner && typeof this.planner.syncAll === 'function') this.planner.syncAll();
    }
    
    remove() { 
        this.walls.forEach(w => { 
            if (w.wallGroup) w.wallGroup.destroy(); 
            if (w.labelGroup) w.labelGroup.destroy(); 
            if (w.mesh3D) {
                if (w.mesh3D.parent) w.mesh3D.parent.remove(w.mesh3D);
                w.mesh3D.traverse?.(c => { if (c.geometry) c.geometry.dispose(); });
                w.mesh3D = null;
            }
            this.planner.walls = (this.planner.walls || []).filter(existing => existing !== w); 
        }); 
        this.intermediateAnchors.forEach(a => { 
            if (a.node) a.node.destroy(); 
            this.planner.anchors = (this.planner.anchors || []).filter(existing => existing !== a); 
        }); 
        this.walls = [];
        this.intermediateAnchors = [];
        if (this.raiserGroup) this.raiserGroup.destroy();
        if (this.group) this.group.destroy(); 
        if (this.planner?.arcs) this.planner.arcs = this.planner.arcs.filter(a => a !== this); 
        if (typeof this.planner?.selectEntity === 'function') this.planner.selectEntity(null); 
        if (typeof this.planner?.syncAll === 'function') this.planner.syncAll(); 
    }

    applyMaterial(options = {}) {
        const { target = 'all', key, newMat, ctx } = options;
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

        if (this.walls && Array.isArray(this.walls)) {
            this.walls.forEach(w => {
                WallEngine.applyMaterial(w, { target, key, newMat, ctx }, this.planner);
            });
        }

        if (ctx && typeof ctx.updateMaterialLive === 'function') {
            ctx.updateMaterialLive(this);
        }
    }
}
import { PremiumShape } from '/src/core/engine2d/PremiumShape.js';
// src/core/engine2d/index.js
import Konva from 'konva';
import { GRID, PX_TO_FT, SNAP_DIST, WALL_REGISTRY, WIDGET_REGISTRY } from '../registry.js';

// SOLID: Import the decoupled 2D entity classes from the same folder
import { Anchor } from '/src/core/engine2d/Anchor.js';
import { PremiumWall } from '/src/core/engine2d/PremiumWall.js';
import { PremiumWidget } from '/src/core/engine2d/PremiumWidget.js';
import { PremiumFurniture } from '/src/core/engine2d/PremiumFurniture.js';
import { PremiumStair } from '/src/core/engine2d/PremiumStair.js';
import { StaircaseTwo } from '/src/core/engine2d/StaircaseTwo.js';
import { PremiumHipRoof } from '/src/core/engine2d/PremiumHipRoof.js';
import { PremiumRailing } from '/src/core/engine2d/PremiumRailing.js';
import { SmartGuidesTrackingSystem } from '/src/core/engine2d/SmartGuidesTrackingSystem.js';
import { advance_openings } from '/src/core/engine2d/advance_openings.js';

// Export the specific classes that App.vue needs to spawn items
export { PremiumFurniture, PremiumHipRoof };

export class PremiumStairV3 {
    constructor(planner, data) {
        this.planner = planner;
        Object.assign(this, data);
        if (!this.id) this.id = 'stair_' + Math.random().toString(36).substr(2, 9);
        if (!this.systemId) this.systemId = this.id;
        
        this.group = new Konva.Group({ draggable: true });
        this.poly = new Konva.Line({
            fill: 'rgba(59, 130, 246, 0.2)',
            stroke: '#3b82f6',
            strokeWidth: 2,
            closed: true
        });
        this.stepsGroup = new Konva.Group();
        this.group.add(this.poly, this.stepsGroup);
        
        this.rotHandle = new Konva.Circle({ 
            radius: 6, fill: '#3b82f6', stroke: 'white', strokeWidth: 2, draggable: true, visible: false,
            name: 'stair-rotater'
        });
        this.group.add(this.rotHandle);
        
        this.handlesGroup = new Konva.Group({ visible: false });
        this.widthHandleR = new Konva.Rect({ width: 8, height: 16, fill: '#ffffff', stroke: '#8b5cf6', strokeWidth: 2, cornerRadius: 2, offsetX: 4, offsetY: 8, draggable: true, name: 'stair-width-handle-r' });
        this.widthHandleL = new Konva.Rect({ width: 8, height: 16, fill: '#ffffff', stroke: '#8b5cf6', strokeWidth: 2, cornerRadius: 2, offsetX: 4, offsetY: 8, draggable: true, name: 'stair-width-handle-l' });
        this.lengthHandleB = new Konva.Rect({ width: 16, height: 8, fill: '#ffffff', stroke: '#10b981', strokeWidth: 2, cornerRadius: 2, offsetX: 8, offsetY: 4, draggable: true, name: 'stair-length-handle-b' });
        this.lengthHandleT = new Konva.Rect({ width: 16, height: 8, fill: '#ffffff', stroke: '#10b981', strokeWidth: 2, cornerRadius: 2, offsetX: 8, offsetY: 4, draggable: true, name: 'stair-length-handle-t' });
        
        const setupWidthHandle = (handle, isLeft) => {
            handle.on('mouseenter', () => document.body.style.cursor = 'ew-resize');
            handle.on('mouseleave', () => document.body.style.cursor = 'default');
            handle.on('dragstart', (e) => { e.cancelBubble = true; });
            handle.on('dragmove', (e) => {
                e.cancelBubble = true;
                const oldWidth = this.width || 100;
                const newLocalX = handle.x();
                let newWidth;
                let shiftLocalX;
                if (isLeft) {
                    newWidth = Math.round(oldWidth / 2 - newLocalX);
                    if (this.type === 'stair_landing' && newWidth < oldWidth) newWidth = oldWidth;
                    if (newWidth < 20) newWidth = 20;
                    const dw = newWidth - oldWidth;
                    shiftLocalX = -dw / 2;
                } else {
                    newWidth = Math.round(newLocalX + oldWidth / 2);
                    if (this.type === 'stair_landing' && newWidth < oldWidth) newWidth = oldWidth;
                    if (newWidth < 20) newWidth = 20;
                    const dw = newWidth - oldWidth;
                    shiftLocalX = dw / 2;
                }
                if (newWidth === oldWidth) {
                    this.update();
                    return;
                }
                this.width = newWidth;
                const radRot = this.absRot !== undefined ? this.absRot : ((this.rotation || 0) * Math.PI / 180);
                const newAbsX = (this.absX !== undefined ? this.absX : this.x) + shiftLocalX * Math.cos(radRot);
                const newAbsY = (this.absY !== undefined ? this.absY : this.y) - shiftLocalX * Math.sin(radRot);
                if (this.connectedFrom) {
                    const parent = this.planner.stairs.find(s => s.id === this.connectedFrom);
                    if (parent && parent.type === 'stair_landing') {
                        const pr = parent.absRot !== undefined ? parent.absRot : ((parent.rotation || 0) * Math.PI / 180);
                        const px = parent.absX !== undefined ? parent.absX : (parent.x || 0);
                        const pz = parent.absY !== undefined ? parent.absY : (parent.y || 0);
                        const cos = Math.cos(-pr), sin = Math.sin(-pr);
                        const lx = (newAbsX - px) * cos - (newAbsY - pz) * sin;
                        const ly = (newAbsX - px) * sin + (newAbsY - pz) * cos;
                        if (this.attachEdge === 'top' || this.attachEdge === 'bottom') {
                            this.attachOffsetX = lx;
                        } else if (this.attachEdge === 'left' || this.attachEdge === 'right') {
                            this.attachOffsetY = ly - (parent.length || 100)/2;
                        }
                    }
                } else {
                    this.x = newAbsX;
                    this.y = newAbsY;
                }
                this.update();
                const token = Date.now() + Math.random();
                this.planner.stairs.forEach(s => { if (s.systemId === this.systemId) s.update(token); });
                this.planner.syncAll();
            });
            handle.on('dragend', (e) => { e.cancelBubble = true; this.planner.syncAll(); });
        };
        
        setupWidthHandle(this.widthHandleR, false);
        setupWidthHandle(this.widthHandleL, true);

        this.lengthHandleB.on('mouseenter', () => document.body.style.cursor = 'ns-resize');
        this.lengthHandleB.on('mouseleave', () => document.body.style.cursor = 'default');
        this.lengthHandleB.on('dragstart', (e) => { e.cancelBubble = true; });
        this.lengthHandleB.on('dragmove', (e) => {
            e.cancelBubble = true;
            const newY = this.lengthHandleB.y();
            if (this.type === 'stair') {
                let newSteps = Math.round(newY / (this.stepDepth || 28.0));
                if (newSteps < 3) newSteps = 3;
                this.stepCount = newSteps;
            } else {
                const oldLength = this.length || 100;
                let newLength = Math.round(newY);
                if (this.type === 'stair_landing' && newLength < oldLength) newLength = oldLength;
                if (newLength < 20) newLength = 20;
                if (newLength === oldLength) {
                    this.update();
                    return;
                }
                this.length = newLength;
            }
            this.update();
            const token = Date.now() + Math.random();
            this.planner.stairs.forEach(s => { if (s.systemId === this.systemId) s.update(token); });
            this.planner.syncAll();
        });
        this.lengthHandleB.on('dragend', (e) => { e.cancelBubble = true; this.planner.syncAll(); });
        
        this.lengthHandleT.on('mouseenter', () => document.body.style.cursor = 'ns-resize');
        this.lengthHandleT.on('mouseleave', () => document.body.style.cursor = 'default');
        this.lengthHandleT.on('dragstart', (e) => { e.cancelBubble = true; });
        this.lengthHandleT.on('dragmove', (e) => {
            e.cancelBubble = true;
            if (this.type !== 'stair_landing') return;

            const oldLength = this.length || 100;
            const newLocalY = this.lengthHandleT.y(); 
            let newLength = Math.round(oldLength - newLocalY);
            if (newLength < oldLength) newLength = oldLength;
            if (newLength < 20) newLength = 20;
            
            const dl = newLength - oldLength;
            if (dl === 0) {
                this.update();
                return;
            }

            const shiftLocalY = -dl;
            this.length = newLength;
            
            const radRot = this.absRot !== undefined ? this.absRot : ((this.rotation || 0) * Math.PI / 180);
            const newAbsX = (this.absX !== undefined ? this.absX : this.x) + shiftLocalY * Math.sin(radRot);
            const newAbsY = (this.absY !== undefined ? this.absY : this.y) + shiftLocalY * Math.cos(radRot);
            
            if (this.connectedFrom) {
                const parent = this.planner.stairs.find(s => s.id === this.connectedFrom);
                if (parent && parent.type === 'stair_landing') {
                    const pr = parent.absRot !== undefined ? parent.absRot : ((parent.rotation || 0) * Math.PI / 180);
                    const px = parent.absX !== undefined ? parent.absX : (parent.x || 0);
                    const pz = parent.absY !== undefined ? parent.absY : (parent.y || 0);
                    const cos = Math.cos(-pr), sin = Math.sin(-pr);
                    const lx = (newAbsX - px) * cos - (newAbsY - pz) * sin;
                    const ly = (newAbsX - px) * sin + (newAbsY - pz) * cos;
                    if (this.attachEdge === 'top' || this.attachEdge === 'bottom') {
                        this.attachOffsetX = lx;
                    } else if (this.attachEdge === 'left' || this.attachEdge === 'right') {
                        this.attachOffsetY = ly - (parent.length || 100)/2;
                    }
                }
            } else {
                this.x = newAbsX;
                this.y = newAbsY;
            }
            
            this.update();
            const token = Date.now() + Math.random();
            this.planner.stairs.forEach(s => { if (s.systemId === this.systemId) s.update(token); });
            this.planner.syncAll();
        });
        this.lengthHandleT.on('dragend', (e) => { e.cancelBubble = true; this.planner.syncAll(); });

        this.handlesGroup.add(this.widthHandleR, this.widthHandleL, this.lengthHandleB, this.lengthHandleT);
        this.group.add(this.handlesGroup);
        
        if (this.planner.widgetLayer) {
            this.planner.widgetLayer.add(this.group);
        }
        
        this.initEvents();
        this.update();
    }
    
    showSnapPoints(active) {
        if (!this.snapPointsGroup) {
            this.snapPointsGroup = new Konva.Group({ listening: false });
            this.group.add(this.snapPointsGroup);
        }
        this.snapPointsGroup.destroyChildren();
        if (!active) {
            this.planner.stage.batchDraw();
            return;
        }
        const w = this.width || 100;
        const l = this.type === 'stair' ? (this.stepCount || 10) * (this.stepDepth || 28.0) : (this.length || 100);
        if (this.type === 'stair') {
            this.snapPointsGroup.add(new Konva.Circle({ x: 0, y: l, radius: 10, fill: '#10b981', opacity: 0.6 }));
        } else if (this.type === 'stair_landing') {
            this.snapPointsGroup.add(new Konva.Circle({ x: 0, y: l, radius: 10, fill: '#10b981', opacity: 0.6 }));
            this.snapPointsGroup.add(new Konva.Circle({ x: 0, y: 0, radius: 10, fill: '#10b981', opacity: 0.6 }));
            this.snapPointsGroup.add(new Konva.Circle({ x: -w/2, y: l/2, radius: 10, fill: '#10b981', opacity: 0.6 }));
            this.snapPointsGroup.add(new Konva.Circle({ x: w/2, y: l/2, radius: 10, fill: '#10b981', opacity: 0.6 }));
        }
        this.snapPointsGroup.moveToTop();
        this.planner.stage.batchDraw();
    }
    
    initEvents() {
        this.group.on('mouseenter', () => { if (this.planner.tool === 'select') document.body.style.cursor = 'pointer'; });
        this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        this.group.on('click tap', (e) => {
            if (this.planner.tool === 'select') {
                e.cancelBubble = true;
                this.planner.selectEntity(this, 'stair');
            }
        });
        this.group.on('dragstart', (e) => {
            this.planner.selectEntity(this, 'stair');
        });
        this.group.on('dragmove', (e) => {
            if (e.target !== this.group) return;
            this.planner.stairs.forEach(s => { if (s.showSnapPoints) s.showSnapPoints(false); });
            
            if (this.connectedFrom) {
                const parent = this.planner.stairs.find(s => s.id === this.connectedFrom);
                if (parent && parent.type === 'stair_landing') {
                    const pos = this.planner.stage.getPointerPosition();
                    if (!pos) return;
                    const pr = parent.absRot !== undefined ? parent.absRot : ((parent.rotation || 0) * Math.PI / 180);
                    const px = parent.absX !== undefined ? parent.absX : (parent.x || 0);
                    const pz = parent.absY !== undefined ? parent.absY : (parent.y || 0);
                    
                    const cos = Math.cos(-pr), sin = Math.sin(-pr);
                    const lx = (pos.x - px) * cos - (pos.y - pz) * sin;
                    const ly = (pos.x - px) * sin + (pos.y - pz) * cos;
                    
                    if (this.attachEdge === 'top' || this.attachEdge === 'bottom') {
                        this.attachOffsetX = lx;
                    } else if (this.attachEdge === 'left' || this.attachEdge === 'right') {
                        this.attachOffsetY = ly - (parent.length || 100)/2;
                    }
                }
                this.update();
            } else {
                this.x = this.group.x(); this.y = this.group.y();
                
                let nearestS = null;
                let minDist = 100;
                const isAncestor = (node, pAnc) => { let curr = node; while(curr) { if (curr.id === pAnc.id) return true; curr = this.planner.stairs.find(x => x.id === curr.connectedFrom); } return false; };
                for (let s of this.planner.stairs) {
                    if (s === this || (s.type !== 'stair' && s.type !== 'stair_landing') || isAncestor(s, this)) continue;
                    if (s.type === 'stair') {
                        const dist = Math.hypot(this.x - (s.endX||0), this.y - (s.endY||0));
                        if (dist < 50 && dist < minDist) { minDist = dist; nearestS = s; }
                    } else if (s.type === 'stair_landing') {
                        const cos = Math.cos(-(s.absRot||0)), sin = Math.sin(-(s.absRot||0));
                        const lx = (this.x - (s.absX||0)) * cos - (this.y - (s.absY||0)) * sin;
                        const ly = (this.x - (s.absX||0)) * sin + (this.y - (s.absY||0)) * cos;
                        const w = s.width || 100, l = s.length || 100;
                        if (lx > -w - 50 && lx < w + 50 && ly > -50 && ly < l + 50) {
                            nearestS = s;
                            break;
                        }
                    }
                }
                if (nearestS && nearestS.showSnapPoints) nearestS.showSnapPoints(true);
            }
            
            const token = Date.now() + Math.random();
            this.planner.stairs.forEach(s => { if (s.systemId === this.systemId) s.update(token); });
            this.planner.syncAll();
        });
        if (this.rotHandle) {
            this.rotHandle.on('dragmove', (e) => {
                e.cancelBubble = true;
                const pos = this.planner.stage.getPointerPosition();
                if (!pos) return;
                const groupPos = this.group.getAbsolutePosition();
                const angleRad = Math.atan2(pos.y - groupPos.y, pos.x - groupPos.x);
                let newRot = (angleRad * 180 / Math.PI) + 90;
                
                if (this.connectedFrom) {
                    const parent = this.planner.stairs.find(s => s.id === this.connectedFrom);
                    if (parent) {
                        const pr = parent.absRot !== undefined ? parent.absRot : ((parent.rotation || 0) * (Math.PI / 180));
                        let baseEdgeRot = 0;
                        if (parent.type === 'stair_landing') {
                            if (this.attachEdge === 'bottom') baseEdgeRot = 180;
                            else if (this.attachEdge === 'left') baseEdgeRot = -90;
                            else if (this.attachEdge === 'right') baseEdgeRot = 90;
                        }
                        
                        let rotOff = newRot - (pr * 180 / Math.PI) - baseEdgeRot;
                        rotOff = Math.round(rotOff / 15) * 15;
                        this.rotationOffset = rotOff;
                        newRot = (pr * 180 / Math.PI) + baseEdgeRot + rotOff;
                    }
                }
                
                this.rotation = newRot;
                this.update();
                const token = Date.now() + Math.random();
                this.planner.stairs.forEach(s => { if (s.systemId === this.systemId) s.update(token); });
                this.planner.syncAll();
            });
            this.rotHandle.on('mouseenter', () => document.body.style.cursor = 'crosshair');
            this.rotHandle.on('mouseleave', () => document.body.style.cursor = 'default');
        }
        this.group.on('dragend', (e) => {
            this.planner.stairs.forEach(s => { if (s.showSnapPoints) s.showSnapPoints(false); });
            if (e.target !== this.group || this.connectedFrom) return;
            let snapped = false;
            const isAncestor = (node, pAnc) => { let curr = node; while(curr) { if (curr.id === pAnc.id) return true; curr = this.planner.stairs.find(x => x.id === curr.connectedFrom); } return false; };
            for (let s of this.planner.stairs) {
                if (s === this || (s.type !== 'stair' && s.type !== 'stair_landing') || isAncestor(s, this)) continue;
                if (s.type === 'stair') {
                    if (Math.hypot(this.x - (s.endX||0), this.y - (s.endY||0)) < 60) {
                        this.connectedFrom = s.id; this.attachEdge = 'top'; this.attachOffsetX = 0; this.attachOffsetY = 0;
                        this.rotationOffset = this.rotation - ((s.absRot||0) * 180 / Math.PI);
                        this.systemId = s.systemId; snapped = true; s.setHighlight(true); setTimeout(() => s.setHighlight(false), 500); break;
                    }
                } else if (s.type === 'stair_landing') {
                    const cos = Math.cos(-(s.absRot||0)), sin = Math.sin(-(s.absRot||0));
                    const lx = (this.x - (s.absX||0)) * cos - (this.y - (s.absY||0)) * sin;
                    const ly = (this.x - (s.absX||0)) * sin + (this.y - (s.absY||0)) * cos;
                    const w = s.width || 100, l = s.length || 100, dTop = Math.abs(ly - l), dBot = Math.abs(ly), dL = Math.abs(lx - (-w/2)), dR = Math.abs(lx - (w/2));
                    const minD = Math.min(dTop, dBot, dL, dR);
                    if (minD < 60 && lx > -w/2 - 40 && lx < w/2 + 40 && ly > -40 && ly < l + 40) {
                        this.connectedFrom = s.id; this.systemId = s.systemId;
                        if (minD === dTop) { this.attachEdge = 'top'; this.attachOffsetX = lx; this.rotationOffset = 0; }
                        else if (minD === dBot) { this.attachEdge = "bottom"; this.attachOffsetX = lx; this.rotationOffset = 0; }
                        else if (minD === dL) { this.attachEdge = "left"; this.attachOffsetY = ly - l/2; this.rotationOffset = 0; }
                        else { this.attachEdge = "right"; this.attachOffsetY = ly - l/2; this.rotationOffset = 0; }
                        snapped = true; s.setHighlight(true); setTimeout(() => s.setHighlight(false), 500); break;
                    }
                }
            }
            if (snapped) { const u = (node, sysId) => { node.systemId = sysId; this.planner.stairs.filter(c => c.connectedFrom === node.id).forEach(c => u(c, sysId)); }; u(this, this.systemId); }
            const token = Date.now() + Math.random();
            this.planner.stairs.forEach(s => { if (s.systemId === this.systemId) s.update(token); });
            this.planner.syncAll();
        });
    }
    
    setHighlight(isActive) {
        this.poly.stroke(isActive ? '#f59e0b' : '#3b82f6');
        this.poly.strokeWidth(isActive ? 3 : 2);
        if (this.rotHandle) this.rotHandle.visible(isActive);
        if (this.handlesGroup) this.handlesGroup.visible(isActive);
        if (isActive) this.group.moveToTop();
        this.planner.stage.batchDraw();
    }
    
    update(forceToken = null) {
        if (forceToken && this.lastUpdateToken === forceToken) return;
        if (forceToken) this.lastUpdateToken = forceToken;

        let cursorX = this.x || 0;
        let cursorZ = this.y || 0;
        let radRot = (this.rotation || 0) * (Math.PI / 180);
        let cursorElev = this.elevation || 0;
        
        if (this.connectedFrom) {
            const parent = this.planner.stairs.find(s => s.id === this.connectedFrom);
            if (parent) {
                if (forceToken) parent.update(forceToken); else if (parent.absX === undefined) parent.update();
                const px = parent.absX !== undefined ? parent.absX : (parent.x || 0), pz = parent.absY !== undefined ? parent.absY : (parent.y || 0);
                const pr = parent.absRot !== undefined ? parent.absRot : ((parent.rotation || 0) * (Math.PI / 180)), pe = parent.absElev !== undefined ? parent.absElev : (parent.elevation || 0);
                const pCos = Math.cos(pr), pSin = Math.sin(pr), trans = (lx, lz) => ({ x: px + lx * pCos + lz * pSin, y: pz - lx * pSin + lz * pCos });
                
                let myW = this.width || 100;
                if (parent.type === 'stair') {
                    const pt = trans(0, (parent.stepCount || 10) * (parent.stepDepth || 28));
                    cursorX = pt.x; cursorZ = pt.y; cursorElev = pe + (parent.stepCount || 10) * (parent.stepHeight || 17.5);
                    radRot = pr + (this.rotationOffset || 0) * Math.PI / 180;
                } else if (parent.type === 'stair_landing') {
                    const pw = parent.width || 100, pl = parent.length || 100, ox = this.attachOffsetX || 0, oy = this.attachOffsetY || 0;
                    
                    let clampOx = Math.max(-pw/2 + myW/2, Math.min(pw/2 - myW/2, ox));
                    let clampOy = Math.max(-pl/2 + myW/2, Math.min(pl/2 - myW/2, oy));
                    if (ox !== clampOx) this.attachOffsetX = clampOx;
                    if (oy !== clampOy) this.attachOffsetY = clampOy;
                    
                    let pt;
                    if (this.attachEdge === 'top') { pt = trans(clampOx, pl); radRot = pr + (this.rotationOffset || 0) * Math.PI / 180; }
                    else if (this.attachEdge === 'bottom') { pt = trans(clampOx, 0); radRot = pr + (180 + (this.rotationOffset || 0)) * Math.PI / 180; }
                    else if (this.attachEdge === 'left') { pt = trans(-pw/2, pl/2 + clampOy); radRot = pr + (-90 + (this.rotationOffset || 0)) * Math.PI / 180; }
                    else if (this.attachEdge === 'right') { pt = trans(pw/2, pl/2 + clampOy); radRot = pr + (90 + (this.rotationOffset || 0)) * Math.PI / 180; }
                    else { pt = trans(0, pl); radRot = pr + (this.rotationOffset || 0) * Math.PI / 180; }
                    cursorX = pt.x; cursorZ = pt.y; cursorElev = pe;
                }
            }
        }
        
        this.absX = cursorX;
        this.absY = cursorZ;
        this.absRot = radRot;
        this.absElev = cursorElev;
        this.absX = cursorX; this.absY = cursorZ; this.absRot = radRot; this.absElev = cursorElev;
        
        const w = this.width || 100;
        const l = this.type === 'stair' ? (this.stepCount || 10) * (this.stepDepth || 28.0) : (this.length || 100);
        const nextElev = this.type === 'stair' ? (this.stepCount || 10) * (this.stepHeight || 17.5) : 0;
        
        this.endX = cursorX + Math.sin(radRot) * l;
        this.endY = cursorZ + Math.cos(radRot) * l;
        this.endElev = cursorElev + nextElev;
        
        this.group.position({ x: cursorX, y: cursorZ });
        this.group.rotation(-radRot * 180 / Math.PI);
        this.poly.position({ x: 0, y: 0 });
        this.stepsGroup.position({ x: 0, y: 0 });
        this.poly.points([-w/2, 0, w/2, 0, w/2, l, -w/2, l]);

        if (this.rotHandle) {
            this.rotHandle.position({ x: 0, y: l + 30 });
        }
        if (this.widthHandleR && this.widthHandleL && this.lengthHandleB) {
            this.widthHandleR.position({ x: w / 2, y: l / 2 });
            this.widthHandleL.position({ x: -w / 2, y: l / 2 });
            this.lengthHandleB.position({ x: 0, y: l });
            
            if (this.lengthHandleT) {
                this.lengthHandleT.position({ x: 0, y: 0 });
                this.lengthHandleT.visible(this.type === 'stair_landing');
            }
        }
        
        this.stepsGroup.destroyChildren();
        if (this.type === 'stair') {
            for(let i=1; i<this.stepCount; i++) {
                const sy = i * this.stepDepth;
                this.stepsGroup.add(new Konva.Line({ points: [-w/2, sy, w/2, sy], stroke: '#3b82f6', strokeWidth: 1 }));
            }
            this.stepsGroup.add(new Konva.Arrow({ points: [0, 5, 0, Math.min(l-5, 40)], fill: '#111827', stroke: '#111827', strokeWidth: 2, pointerLength: 6, pointerWidth: 6 }));
        } else {
            const children = this.planner.stairs.filter(s => s.connectedFrom === this.id);
            let occupiedEdges = [];
            if (this.connectedFrom) {
                const parent = this.planner.stairs.find(s => s.id === this.connectedFrom);
                if (parent && parent.type === 'stair') occupiedEdges.push('bottom');
                else if (parent && parent.type === 'stair_landing') {
                    if (this.attachEdge === 'top') occupiedEdges.push('bottom');
                    else if (this.attachEdge === 'bottom') occupiedEdges.push('top');
                    else if (this.attachEdge === 'left') occupiedEdges.push('right');
                    else if (this.attachEdge === 'right') occupiedEdges.push('left');
                }
                let inX = 0, inY = 0;
                if (this.attachEdge === 'bottom') { inX = 0; inY = l; }
                else if (this.attachEdge === 'left') { inX = -w/2; inY = l/2; }
                else if (this.attachEdge === 'right') { inX = w/2; inY = l/2; }
                this.stepsGroup.add(new Konva.Arrow({ points: [inX, inY, 0, l/2], stroke: '#10b981', fill: '#10b981', strokeWidth: 3, dash: [6, 4], pointerLength: 8, pointerWidth: 8 }));
            }
            children.forEach(c => { if (c.attachEdge) occupiedEdges.push(c.attachEdge); });
            children.forEach(child => {
                let ex = 0, ey = l;
                if (child.attachEdge === 'right') { ex = w/2; ey = l/2 + (child.attachOffsetY || 0); }
                else if (child.attachEdge === 'left') { ex = -w/2; ey = l/2 + (child.attachOffsetY || 0); }
                else if (child.attachEdge === 'bottom') { ex = (child.attachOffsetX || 0); ey = 0; }
                else if (child.attachEdge === 'top') { ex = (child.attachOffsetX || 0); ey = l; }
                this.stepsGroup.add(new Konva.Arrow({ points: [0, l/2, ex, ey], stroke: '#3b82f6', fill: '#3b82f6', strokeWidth: 3, dash: [6, 4], tension: 0.4, pointerLength: 8, pointerWidth: 8 }));
            });
            const txt = new Konva.Text({ x: 0, y: l/2, text: 'JUNCTION', fontSize: 10, fill: '#3b82f6', align: 'center', fontStyle: 'bold', rotation: radRot * 180 / Math.PI });
            txt.offsetX(txt.width()/2); txt.offsetY(txt.height()/2);
            this.stepsGroup.add(txt);
        }
    }
    
    remove() {
        this.group.destroy();
        this.planner.stairs = this.planner.stairs.filter(s => s !== this);
        this.planner.stairs.filter(s => s.connectedFrom === this.id).forEach(s => s.remove());
        this.planner.selectEntity(null);
        this.planner.syncAll();
    }
}

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
        this.railingConfig = { configId: 'rail_1', thickness: 4, height: undefined };
        
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
            if (w.type === 'railing') {
                w.poly.stroke(isActive ? '#3b82f6' : (w.hidden ? '#475569' : this.getBaseColor(w)));
            } else {
                if (w.hidden) {
                    w.poly.fill(isActive ? '#bfdbfe' : '#cbd5e1');
                    w.poly.stroke(isActive ? '#4f46e5' : '#475569');
                } else {
                    w.poly.fill(isActive ? '#bfdbfe' : w.fillColor);
                    w.poly.stroke(isActive ? '#3b82f6' : this.getBaseColor(w));
                }
            }
        });
        this.planner.stage.batchDraw();
    }
    rebuild() {
        const savedWidgets = [];
        this.walls.forEach(w => { 
            if (w.attachedWidgets) w.attachedWidgets.forEach(widg => {
                let grp = widg.visualGroup || widg.group;
                if (grp) savedWidgets.push({ widg: widg, oldPos: grp.position() });
            });
            w.wallGroup.destroy(); 
            w.labelGroup.destroy(); 
            this.planner.walls = this.planner.walls.filter(existing => existing !== w); 
        });
        this.intermediateAnchors.forEach(a => { a.node.destroy(); this.planner.anchors = this.planner.anchors.filter(existing => existing !== a); });
        this.walls = []; this.intermediateAnchors = [];

        const p1 = this.p1.position(), p2 = this.p2.position();
        const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
        if (L < 0.5) {
            savedWidgets.forEach(sw => sw.widg.remove());
            return;
        }
        
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
                    newWall.poly.off('mousedown touchstart');
                    newWall.poly.on('mousedown touchstart', (e) => { 
                        const isAdvancedOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(this.planner.tool);
                        if (WIDGET_REGISTRY[this.planner.tool] || isAdvancedOpening) {
                            e.cancelBubble = true;
                            if (e.evt) e.evt.stopPropagation();
                            const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
                            if (!pos) return;
                            let newT = newWall.getClosestT(pos);
                            let widget;
                            if (isAdvancedOpening) {
                                widget = new advance_openings(this.planner, newWall, newT, this.planner.tool);
                                this.planner.selectEntity(widget, 'advance_openings');
                            } else {
                                widget = new PremiumWidget(this.planner, newWall, newT, this.planner.tool);
                                this.planner.selectEntity(widget, 'widget');
                            }
                            newWall.attachedWidgets.push(widget);
                            this.planner.syncAll();
                            return;
                        }
                        if (this.planner.tool === 'select') { e.cancelBubble = true; this.planner.selectEntity(this, 'arc'); } 
                    });
                    newWall.poly.draggable(false); newWall.poly.on('dragstart dragmove dragend', (e) => e.cancelBubble = true);
                    this.walls.push(newWall); this.planner.walls.push(newWall);
                    
                    // Auto-generate linked railing if enabled
                    if (this.hasRailing) {
                        const r = new PremiumRailing(this.planner, prevAnchor, currentAnchor);
                        r.parentArc = this; r.labelGroup.visible(false);
                        r.configId = this.railingConfig.configId;
                        if (this.railingConfig.thickness) r.thickness = this.railingConfig.thickness;
                        if (this.railingConfig.height !== undefined) r.height = this.railingConfig.height;
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
        
        // Re-attach saved widgets
        savedWidgets.forEach(sw => {
             let closestWall = null; let closestDist = Infinity;
             this.walls.forEach(nw => {
                  if (nw.type === 'railing') return;
                  let proj = this.planner.getClosestPointOnSegment(sw.oldPos, nw.startAnchor.position(), nw.endAnchor.position());
                  let dist = Math.hypot(sw.oldPos.x - proj.x, sw.oldPos.y - proj.y);
                  if (dist < closestDist) { closestDist = dist; closestWall = nw; }
             });
             if (closestWall && closestDist < 50) {
                  let newT = closestWall.getClosestT(sw.oldPos);
                  sw.widg.wall = closestWall;
                  sw.widg.t = newT;
                  closestWall.attachedWidgets.push(sw.widg);
                  sw.widg.update();
             } else {
                  sw.widg.remove();
             }
        });

        this.lastP1 = { ...p1 }; this.lastP2 = { ...p2 };
        
        if (this.planner.selectedEntity === this) {
            this.walls.forEach(w => w.poly.stroke('#3b82f6'));
        }
    }
    
    update() { const p1 = this.p1.position(), p2 = this.p2.position(); if (!this.lastP1 || !this.lastP2 || this.lastP1.x !== p1.x || this.lastP1.y !== p1.y || this.lastP2.x !== p2.x || this.lastP2.y !== p2.y) this.rebuild(); }
    
    remove() { this.walls.forEach(w => { w.wallGroup.destroy(); w.labelGroup.destroy(); this.planner.walls = this.planner.walls.filter(existing => existing !== w); }); this.intermediateAnchors.forEach(a => { a.node.destroy(); this.planner.anchors = this.planner.anchors.filter(existing => existing !== a); }); this.group.destroy(); this.planner.arcs = (this.planner.arcs || []).filter(a => a !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
}

export class PremiumBalcony {}



export class FloorPlanner {
    constructor(containerEl) { 
        this.container = containerEl; this.tool = "select"; this.currentUnit = "ft"; this.drawing = false; this.lastAnchor = null; this.startAnchor = null; this.drawingStair = null; this.preview = null;
        this.activeCategory = 'tools';
        this.settings = {
            mainEntranceFacing: 'north',
            measurementUnit: 'feet_inches',
            areaUnit: 'sqft',
            showCompass: true,
            showGrid: true,
            showDimensionLabels: true,
            showDiagonalDimensions: true,
            diagonalMeasurementMode: 'inner',
            showWorkspaceLabels: true,
            wallTracking: true,
            entranceWallId: null
        };
        this.wallTrackingEnabled = this.settings.wallTracking;
        this.walls = []; this.anchors = []; this.roomPaths = []; this.stairs = []; this.furniture = []; this.roofs = []; this.arcs = []; this.shapes = []; this.selectedEntity = null; this.selectedType = null; this.selectedNodeIndex = -1;
        this.onSelectionChange = null; 
        this.initKonva(); this.drawGrid(); this.initHUD(); this.initStageEvents(); 
        this.snapManager = this.smartGuides;
    }
    
    setWallTracking(enabled) {
        this.wallTrackingEnabled = enabled;
        if (this.onWallTrackingChange) this.onWallTrackingChange(enabled);
        if (this.selectedEntity && (this.selectedType === 'wall' || this.selectedType === 'railing' || this.selectedType === 'arc')) {
            this.selectEntity(this.selectedEntity, this.selectedType, this.selectedNodeIndex);
        }
    }

    resize() {
        if (!this.stage) return;
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.stage.width(w);
        this.stage.height(h);
        this.syncAll();
    }

    initKonva() {
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.stage = new Konva.Stage({ container: this.container, width: w, height: h });        
        this.bgLayer = new Konva.Layer();
        this.gridLayer = new Konva.Group(); 
        this.referenceLayer = new Konva.Group(); 
        this.bgLayer.add(this.gridLayer, this.referenceLayer);

        this.mainLayer = new Konva.Layer();
        this.houseGroup = new Konva.Group();

        this.roomLayer = new Konva.Group(); 
        this.baseLayer = new Konva.Group();
        this.wallLayer = new Konva.Group(); 
        this.roomLabelLayer = new Konva.Group(); 
        this.widgetLayer = new Konva.Group(); 
        this.furnitureLayer = new Konva.Group(); 
        this.roofLayer = new Konva.Group(); 

        this.houseGroup.add(this.roomLayer, this.baseLayer, this.wallLayer, this.roomLabelLayer, this.widgetLayer, this.furnitureLayer, this.roofLayer);
        this.mainLayer.add(this.houseGroup);

        this.uiLayer = new Konva.Layer(); 
        this.stage.add(this.bgLayer, this.mainLayer, this.uiLayer); 
    }

    addAutoRoof() {
        if (!this.roofs) this.roofs = [];
        
        // COMPLEX SHAPE DETECTION: Generate intersecting roofs based on closed rooms
        if (this.roomPaths && this.roomPaths.length > 0) {
            this.roomPaths.forEach(path => {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                path.forEach(p => {
                    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                });
                
                let w = maxX - minX; let d = maxY - minY;
                let cx = minX + w / 2; let cy = minY + d / 2;
                
                const points = [{x: minX, y: minY}, {x: maxX, y: minY}, {x: maxX, y: maxY}, {x: minX, y: maxY}];

                const newRoof = new PremiumHipRoof(this, points);
                this.roofs.push(newRoof);
                this.selectEntity(newRoof, 'roof');
            });
        } 
        // SINGLE SHAPE FALLBACK: Wrap all walls in one bounding box
        else if (this.walls && this.walls.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            this.walls.forEach(wall => {
                const p1 = wall.startAnchor.position(); const p2 = wall.endAnchor.position();
                minX = Math.min(minX, p1.x, p2.x); maxX = Math.max(maxX, p1.x, p2.x);
                minY = Math.min(minY, p1.y, p2.y); maxY = Math.max(maxY, p1.y, p2.y);
            });
            let w = maxX - minX; let d = maxY - minY;
            let cx = minX + w / 2; let cy = minY + d / 2;

            const points = [{x: minX, y: minY}, {x: maxX, y: minY}, {x: maxX, y: maxY}, {x: minX, y: maxY}];

            const newRoof = new PremiumHipRoof(this, points);
            this.roofs.push(newRoof);
            this.selectEntity(newRoof, 'roof');
        } else {
            // EMPTY CANVAS FALLBACK
            const cx = this.stage.width()/2; const cy = this.stage.height()/2;
            const points = [{x: cx - 200, y: cy - 150}, {x: cx + 200, y: cy - 150}, {x: cx + 200, y: cy + 150}, {x: cx - 200, y: cy + 150}];
            const newRoof = new PremiumHipRoof(this, points);
            this.roofs.push(newRoof);
            this.selectEntity(newRoof, 'roof');
        }

        this.syncAll();
    }
    
    initHUD() {
        this.smartGuides = new SmartGuidesTrackingSystem(this);
        
        this.snapGlow = new Konva.Circle({ radius: 8, fill: '#10b981', shadowColor: '#10b981', shadowBlur: 15, opacity: 0.8, visible: false, listening: false }); 
        this.uiLayer.add(this.snapGlow);
        
        this.splitPreviewGlow = new Konva.Circle({ radius: 6, fill: '#ef4444', shadowColor: '#ef4444', shadowBlur: 10, opacity: 0.8, visible: false, listening: false });
        this.uiLayer.add(this.splitPreviewGlow);
        
        this.guideLineInfinite = new Konva.Line({ points: [0,0,0,0], stroke: '#38bdf8', strokeWidth: 1, dash: [4, 4], visible: false, listening: false }); 
        this.uiLayer.add(this.guideLineInfinite);
        
        this.infoBadgeGroup = new Konva.Group({ visible: false, listening: false }); 
        this.infoBadgeBg = new Konva.Rect({ fill: '#111827', cornerRadius: 6, opacity: 0.9, shadowColor: 'black', shadowBlur: 4, shadowOffsetY: 2, shadowOpacity: 0.2 }); 
        this.infoBadgeText = new Konva.Text({ text: '', fill: 'white', padding: 8, fontSize: 11, align: 'center', fontStyle: 'bold', lineHeight: 1.4 }); 
        this.infoBadgeGroup.add(this.infoBadgeBg, this.infoBadgeText); 
        this.uiLayer.add(this.infoBadgeGroup);

        this.wallHighlight = new Konva.Line({ stroke: '#3b82f6', strokeWidth: 6, opacity: 0.7, visible: false, listening: false });
        this.uiLayer.add(this.wallHighlight);
        
        this.shapeTransformer = new Konva.Transformer({
            borderEnabled: false,
            borderStroke: '#3b82f6', anchorStroke: '#ffffff', anchorFill: '#111827',
            anchorSize: 16, anchorCornerRadius: 8, anchorStrokeWidth: 2, rotateEnabled: false,
            rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
            ignoreStroke: true,
            enabledAnchors: ['top-center', 'bottom-center', 'middle-left', 'middle-right'],
            boundBoxFunc: (oldBox, newBox) => {
                // Only snap cleanly unrotated boxes 
                if (Math.abs(newBox.rotation % 90) > 0.1) return newBox;
                
                const SNAP_TOLERANCE = 10;
                let snapX = null;
                let snapY = null;
                
                const nodes = [...this.furnitureLayer.getChildren(), ...this.widgetLayer.getChildren()];

                const activeAnchor = this.shapeTransformer.getActiveAnchor();
                let isTop = activeAnchor && activeAnchor.includes('top');
                let isBottom = activeAnchor && activeAnchor.includes('bottom');
                let isLeft = activeAnchor && activeAnchor.includes('left');
                let isRight = activeAnchor && activeAnchor.includes('right');

                nodes.forEach(node => {
                    if (this.selectedEntity && this.selectedEntity.group === node) return;
                    if (node.name() && node.name().includes('anchor')) return;
                    
                    const targetRect = node.getClientRect();
                    if (targetRect.width === 0 || targetRect.height === 0) return;

                    const targetCenter = { x: targetRect.x + targetRect.width/2, y: targetRect.y + targetRect.height/2 };

                    if (isLeft || isRight) {
                        const sourceEdge = isLeft ? newBox.x : newBox.x + newBox.width;
                        const targetsX = [targetRect.x, targetCenter.x, targetRect.x + targetRect.width];
                        if (snapX === null) {
                            for (let t of targetsX) {
                                if (Math.abs(sourceEdge - t) < SNAP_TOLERANCE) { snapX = t - sourceEdge; break; }
                            }
                        }
                    }

                    if (isTop || isBottom) {
                        const sourceEdge = isTop ? newBox.y : newBox.y + newBox.height;
                        const targetsY = [targetRect.y, targetCenter.y, targetRect.y + targetRect.height];
                        if (snapY === null) {
                            for (let t of targetsY) {
                                if (Math.abs(sourceEdge - t) < SNAP_TOLERANCE) { snapY = t - sourceEdge; break; }
                            }
                        }
                    }
                });

                if (snapX !== null) {
                    if (isLeft) { newBox.x += snapX; newBox.width -= snapX; } else if (isRight) { newBox.width += snapX; }
                }
                if (snapY !== null) {
                    if (isTop) { newBox.y += snapY; newBox.height -= snapY; } else if (isBottom) { newBox.height += snapY; }
                }
                if (newBox.width < 10) newBox.width = 10; if (newBox.height < 10) newBox.height = 10;
                return newBox;
            }
        });
        this.uiLayer.add(this.shapeTransformer);
        
        this.shapePreviewGroup = new Konva.Group({ listening: false });
        this.shapePreviewRect = new Konva.Rect({ stroke: '#3b82f6', dash: [4, 4], strokeWidth: 2, visible: false, listening: false });
        this.shapePreviewCircle = new Konva.Circle({ stroke: '#3b82f6', dash: [4, 4], strokeWidth: 2, visible: false, listening: false });
        this.shapePreviewTriangle = new Konva.Line({ stroke: '#3b82f6', dash: [4, 4], strokeWidth: 2, visible: false, listening: false });
        this.shapePreviewGroup.add(this.shapePreviewRect, this.shapePreviewCircle, this.shapePreviewTriangle);
        this.uiLayer.add(this.shapePreviewGroup);

        this.alignmentLines = new Konva.Group({ listening: false });
        this.uiLayer.add(this.alignmentLines);
    }
    
    showSnapGlow(x, y) { this.snapGlow.position({x, y}); this.snapGlow.show(); } 
    hideSnapGlow() { this.snapGlow.hide(); }
    
    drawGuideLine(x1, y1, x2, y2, show) { 
        if (!show) { this.guideLineInfinite.hide(); return; } 
        const dx = x2 - x1, dy = y2 - y1; const scale = 2000; 
        this.guideLineInfinite.points([x1 - dx*scale, y1 - dy*scale, x1 + dx*scale, y1 + dy*scale]); 
        this.guideLineInfinite.show(); 
        this.guideLineInfinite.moveToBottom(); 
    }
    
    updateInfoBadge(x, y, length, angle, snapped) { 
        let txt = `${length}\n${angle}°`; 
        if (snapped) txt += `\n🎯 Snapped`; 
        this.infoBadgeText.text(txt); 
        this.infoBadgeBg.setAttrs({ width: this.infoBadgeText.width(), height: this.infoBadgeText.height() });
        this.infoBadgeGroup.position({ x: x + 15, y: y + 15 }); 
        this.infoBadgeGroup.rotation(-(this.settings?.houseRotation || 0));
        this.infoBadgeGroup.show(); 
        this.infoBadgeGroup.moveToTop(); 
    } 
    hideInfoBadge() { this.infoBadgeGroup.hide(); }

    snap(v) { return Math.round(v / GRID) * GRID; }
    formatLength(px) { 
        const feet = px * PX_TO_FT; 
        const unit = this.settings ? this.settings.measurementUnit : this.currentUnit;
        if (unit === 'in') return Math.round(feet * 12) + '"'; 
        if (unit === 'cm') return Math.round(feet * 30.48) + ' cm'; 
        if (unit === 'mm') return Math.round(feet * 304.8) + ' mm'; 
        if (unit === 'm') return (feet * 0.3048).toFixed(2) + ' m'; 
        if (unit === 'ft') return feet.toFixed(2) + ' ft'; 
        const wholeFeet = Math.floor(feet), inches = Math.round((feet - wholeFeet) * 12); 
        return inches > 0 ? `${wholeFeet}' ${inches}"` : `${wholeFeet}'`; 
    }
    
    snapAndAlign(dragNode, isTransforming = false) {
        if (this.smartGuides) this.smartGuides.snapAndAlign(dragNode, isTransforming);
    }

    drawGrid() { 
        const size = 5000; // Giant 10,000px canvas workspace
        for (let i = -size; i <= size; i += GRID) {
            this.gridLayer.add(new Konva.Line({ points: [i, -size, i, size], stroke: "#f0f0f0", strokeWidth: 1, listening: false })); 
            this.gridLayer.add(new Konva.Line({ points: [-size, i, size, i], stroke: "#f0f0f0", strokeWidth: 1, listening: false })); 
        }
        this.bgLayer.batchDraw(); 
    }
    
    doIntersect(p1, p2, p3, p4) { const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x); return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4); }
    checkWallIntersection(p1, p2, ignoreWalls = []) { for (let w of this.walls) { if (ignoreWalls.includes(w)) continue; if (this.getDistanceToWall(p1, w) < 1.0) continue; if (this.getDistanceToWall(p2, w) < 1.0) continue; if (this.doIntersect(p1, p2, w.startAnchor.position(), w.endAnchor.position())) return true; } return false; }
    getDistanceToWall(pos, wall) { const p1 = wall.startAnchor.position(), p2 = wall.endAnchor.position(), C = p2.x - p1.x, D = p2.y - p1.y, dot = (pos.x - p1.x) * C + (pos.y - p1.y) * D, lenSq = C * C + D * D; let param = -1; if (lenSq !== 0) param = Math.max(0, Math.min(1, dot / lenSq)); const xx = p1.x + param * C, yy = p1.y + param * D; return Math.hypot(pos.x - xx, pos.y - yy); }
    getClosestPointOnSegment(p, p1, p2) { const C = p2.x - p1.x, D = p2.y - p1.y, lenSq = C*C + D*D; if (lenSq === 0) return p1; let t = Math.max(0, Math.min(1, ((p.x - p1.x)*C + (p.y - p1.y)*D) / lenSq)); return { x: p1.x + t*C, y: p1.y + t*D }; }

    selectEntity(entity, type, nodeIndex = -1) { 
        this.walls.forEach(w => { if(w.setHighlight) w.setHighlight(false); });
        this.stairs.forEach(s => { if(s.setHighlight) s.setHighlight(false); });
        this.furniture.forEach(f => { if(f.setHighlight) f.setHighlight(false); });
        this.roofs.forEach(r => { if(r.setHighlight) r.setHighlight(false); });
        if (this.balconies) this.balconies.forEach(b => { if(b.setHighlight) b.setHighlight(false); });
        if (this.shapes) this.shapes.forEach(s => { if(s.setHighlight) s.setHighlight(false); });
        if (this.arcs) this.arcs.forEach(a => { if(a.setHighlight) a.setHighlight(false); });
        
        this.selectedEntity = entity; this.selectedType = type; this.selectedNodeIndex = nodeIndex;
        
        if (this.wallTrackingEnabled && entity && (type === 'wall' || type === 'railing' || type === 'arc')) {
            if (entity.setHighlight) entity.setHighlight(true);
            const highlightNear = (list) => {
                if (!list) return;
                list.forEach(item => {
                    let pos;
                    if (item.type === 'furniture' || (item.type && item.type.startsWith('shape'))) pos = { x: item.group.x(), y: item.group.y() };
                    else return;
                        if (item.attachedWall === entity || this.getDistanceToWall(pos, entity) < 100) {
                        if (item.setHighlight) item.setHighlight(true);
                    }
                });
            };
            highlightNear(this.furniture);
            highlightNear(this.shapes);
        } else if (this.wallTrackingEnabled && entity && type === 'anchor') {
            let attachedWalls = this.walls.filter(w => w.startAnchor === entity || w.endAnchor === entity);
            attachedWalls.forEach(w => {
                if (w.setHighlight) w.setHighlight(true);
                const highlightNear = (list) => {
                    if (!list) return;
                    list.forEach(item => {
                        let pos;
                        if (item.type === 'furniture' || (item.type && item.type.startsWith('shape'))) pos = { x: item.group.x(), y: item.group.y() };
                        else return;
                            if (item.attachedWall === w || this.getDistanceToWall(pos, w) < 100) {
                            if (item.setHighlight) item.setHighlight(true);
                        }
                    });
                };
                highlightNear(this.furniture);
                highlightNear(this.shapes);
            });
        } else if (entity && entity.setHighlight) {
            entity.setHighlight(true);
        }

        if (this.shapeTransformer) {
            if (type === 'shape') {
                if (!this.wallTrackingEnabled) {
                    this.shapeTransformer.nodes([entity.group]);
                    this.shapeTransformer.resizeEnabled(entity.type !== 'shape_polygon');
                    
                    // Inject custom arrows into the transformer resizing anchors
                    this.shapeTransformer.find('Rect').forEach(anchor => {
                        if (anchor.name() && anchor.name().includes('rotater')) return;
                        if (anchor.hasCustomStyle) return;
                        anchor.hasCustomStyle = true;
                        anchor.sceneFunc((ctx, shape) => {
                            const size = shape.width();
                            const r = size / 2;
                            
                            ctx.beginPath();
                            ctx.arc(r, r, r, 0, Math.PI * 2);
                            ctx.fillStyle = "#111827";
                            ctx.fill();
                            ctx.lineWidth = 2;
                            ctx.strokeStyle = "white";
                            ctx.stroke();
    
                            ctx.fillStyle = "#111827";
                            const arrowOffset = 11; const arrowSize = 4;
                            const drawArr = (pts) => {
                                ctx.beginPath(); ctx.moveTo(r + pts[0], r + pts[1]); ctx.lineTo(r + pts[2], r + pts[3]); ctx.lineTo(r + pts[4], r + pts[5]); ctx.closePath(); ctx.fill();
                            };
                            drawArr([0, -arrowOffset, -arrowSize, -arrowOffset+arrowSize, arrowSize, -arrowOffset+arrowSize]);
                            drawArr([0, arrowOffset, -arrowSize, arrowOffset-arrowSize, arrowSize, arrowOffset-arrowSize]);
                            drawArr([-arrowOffset, 0, -arrowOffset+arrowSize, -arrowSize, -arrowOffset+arrowSize, arrowSize]);
                            drawArr([arrowOffset, 0, arrowOffset-arrowSize, -arrowSize, arrowOffset-arrowSize, arrowSize]);
                        });
                        
                        // Expand hit area slightly so it covers the arrows too
                        anchor.hitFunc((ctx, shape) => {
                            const size = shape.width();
                            const r = size / 2;
                            ctx.beginPath();
                            ctx.arc(r, r, r + 15, 0, Math.PI * 2);
                            ctx.closePath();
                            ctx.fillStrokeShape(shape);
                        });
                    });
                } else {
                    this.shapeTransformer.nodes([]);
                }
            } else {
                this.shapeTransformer.nodes([]);
            }
        }
        this.syncAll();

        if (this.onSelectionChange) this.onSelectionChange(entity, type, nodeIndex);
    }

    updateToolStates() {
        const cat = this.activeCategory || 'tools';
        const isSelect = this.tool === "select";
        const isSplit = this.tool === "split";
        const isWidget = !!WIDGET_REGISTRY[this.tool];
        const isAdvancedOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(this.tool);
        const allowAll = (cat === 'tools' || cat === 'advanced');

        this.walls.forEach(w => {
            let isRailing = w.type === 'railing';
            let canEditThisWall = false;

            if (allowAll) {
                canEditThisWall = isSelect || isSplit;
            } else if (cat === 'walls') {
                canEditThisWall = !isRailing && (isSelect || isSplit);
            } else if (cat === 'common') {
                canEditThisWall = isRailing && (isSelect || isSplit);
            }

            if(w.poly) { 
                w.poly.setAttr('draggable', canEditThisWall); 
                w.poly.setAttr('listening', canEditThisWall || (isWidget && !isRailing) || isSplit || isAdvancedOpening); 
            }
            
            w.attachedWidgets.forEach(widg => {
                let group = widg.visualGroup || widg.group;
                if(group) {
                    let canEditWidget = isSelect || cat === 'doors_windows' || cat === 'advance_openings';
                    group.setAttr('draggable', canEditWidget);
                    group.setAttr('listening', canEditWidget);
                }
            });        });

        this.stairs.forEach(s => { 
            let canEdit = isSelect && (allowAll || cat === 'structures');
            if(s.group) { s.group.setAttr('draggable', canEdit); s.group.setAttr('listening', canEdit); } 
        });
        this.anchors.forEach(a => { 
            let canEdit = isSelect && (allowAll || cat === 'walls' || cat === 'common');
            if(a.node) { a.node.setAttr('draggable', canEdit); a.node.setAttr('listening', canEdit); } 
        });
        this.furniture.forEach(f => { 
            let canEdit = isSelect && (allowAll || cat === 'furniture');
            if(f.group) { f.group.setAttr('draggable', canEdit); f.group.setAttr('listening', canEdit); } 
        });
        this.roofs.forEach(r => { 
            let canEdit = isSelect && (allowAll || cat === 'structures');
            if(r.group) { r.group.setAttr('draggable', canEdit); r.group.setAttr('listening', canEdit); } 
        });
        if(this.balconies) this.balconies.forEach(b => { 
            let canEdit = isSelect && (allowAll || cat === 'structures');
            if(b.group) { b.group.setAttr('draggable', canEdit); b.group.setAttr('listening', canEdit); } 
        });
        if (this.shapes) this.shapes.forEach(s => {
            let canEdit = isSelect && (allowAll || cat === 'shapes');
            let canSplit = isSplit && (allowAll || cat === 'advanced' || cat === 'shapes');
            if(s.group) { 
                s.group.setAttr('draggable', canEdit); 
                s.group.setAttr('listening', canEdit || canSplit); 
            } 
        });

        // FORCE LAYER LISTENING OFF DURING DRAWING OR RESTRICT BY CATEGORY
        if (this.baseLayer) { this.baseLayer.listening(allowAll || cat === "shapes" || cat === "structures" || isSplit); }
        if (this.wallLayer) { this.wallLayer.listening(allowAll || cat === "common" || cat === "walls" || cat === "doors_windows" || cat === "advance_openings" || cat === "structures" || isWidget || isSplit || isAdvancedOpening); }
        if (this.widgetLayer) { this.widgetLayer.listening(allowAll || cat === "doors_windows" || cat === "advance_openings" || cat === "structures"); }
        if (this.furnitureLayer) { this.furnitureLayer.listening(allowAll || cat === "furniture" || cat === "shapes" || isSplit); }
        if (this.roofLayer) { this.roofLayer.listening(allowAll || cat === "structures"); }

        if (this.stage) {
            this.stage.draggable(isSelect);
            this.stage.container().style.cursor = isSelect ? 'grab' : 'crosshair';
            document.body.style.cursor = '';
        }
    }
    loadDefaultHouse() {
        if (this.walls && this.walls.length > 0) return;
        
        const cx = this.stage.width() / 2;
        const cy = this.stage.height() / 2;
        
        // 750 sqft shape (25ft x 30ft). With GRID=20 (PX_TO_FT = 1/20), 25ft=500px, 30ft=600px.
        const hw = 300; const hd = 250;
        
        const a1 = this.getOrCreateAnchor(cx - hw, cy - hd); const a2 = this.getOrCreateAnchor(cx + hw, cy - hd);
        const a3 = this.getOrCreateAnchor(cx + hw, cy + hd); const a4 = this.getOrCreateAnchor(cx - hw, cy + hd);

        this.walls.push(new PremiumWall(this, a1, a2, 'outer'), new PremiumWall(this, a2, a3, 'outer'), new PremiumWall(this, a3, a4, 'outer'), new PremiumWall(this, a4, a1, 'outer'));
        this.syncAll();
        this.updateToolStates();
    }

    getOrCreateAnchor(x, y) { let a = this.anchors.find(a => Math.hypot(a.x - x, a.y - y) < SNAP_DIST); if (a) return a; const newAnchor = new Anchor(this, x, y); this.anchors.push(newAnchor); return newAnchor; }
    deselectAll() { this.walls.forEach(w => w.setHighlight(false)); this.stairs.forEach(s => s.setHighlight(false)); this.furniture.forEach(f => f.setHighlight(false)); this.roofs.forEach(r => r.setHighlight(false)); if(this.balconies) this.balconies.forEach(b => b.setHighlight(false)); if(this.shapes) this.shapes.forEach(s => s.setHighlight(false)); this.selectEntity(null); this.syncAll(); }
    syncAll() {
        this.buildingCenter = null;
        if (this.gridLayer) {
            this.gridLayer.visible(this.settings ? this.settings.showGrid : true);
        }

        if (this.settings && this.settings.houseRotation !== undefined) {
            if (this.settings.housePivotX !== undefined && this.settings.housePivotY !== undefined) {
                this.houseGroup.offset({ x: this.settings.housePivotX, y: this.settings.housePivotY });
                this.houseGroup.position({ x: this.settings.housePivotX, y: this.settings.housePivotY });
                this.uiLayer.offset({ x: this.settings.housePivotX, y: this.settings.housePivotY });
                this.uiLayer.position({ x: this.settings.housePivotX, y: this.settings.housePivotY });
            }
            this.houseGroup.rotation(this.settings.houseRotation);
            this.uiLayer.rotation(this.settings.houseRotation);
        } else {
            this.houseGroup.offset({ x: 0, y: 0 });
            this.houseGroup.position({ x: 0, y: 0 });
            this.houseGroup.rotation(0);
            this.uiLayer.offset({ x: 0, y: 0 });
            this.uiLayer.position({ x: 0, y: 0 });
            this.uiLayer.rotation(0);
        }

        this.walls.forEach(w => w.update());
        for (let i = 0; i < this.stairs.length; i++) {
            if ((this.stairs[i].type === 'stair' || this.stairs[i].type === 'stair_landing') && !this.stairs[i].group) {
                this.stairs[i] = new PremiumStairV3(this, this.stairs[i]);
            }
        }
        this.stairs.forEach(s => s.update());
        this.furniture.forEach(f => f.update()); 
        this.roofs.forEach(r => r.update()); 
        if(this.balconies) this.balconies.forEach(b => b.update()); 
        if(this.arcs) this.arcs.forEach(a => a.update());
        if(this.shapes) this.shapes.forEach(s => s.update());
        
        this.anchors.forEach(a => {
            if (a.isArcIntermediate || this.activeCategory !== 'walls') {
                a.hide();
                return;
            }
            let connectedCount = this.walls.filter(w => w.startAnchor === a || w.endAnchor === a).length;
            if (connectedCount >= 2) {
                a.show();
            } else if (this.selectedEntity && this.selectedType === 'wall' && (this.selectedEntity.startAnchor === a || this.selectedEntity.endAnchor === a)) {
                a.show();
            } else if (this.selectedEntity && this.selectedType === 'arc' && (this.selectedEntity.p1 === a || this.selectedEntity.p2 === a)) {
                a.show();
            } else if (this.drawing && (this.startAnchor === a || this.lastAnchor === a)) {
                a.show();
            } else {
                a.hide();
            }
        });

        this.mainLayer.batchDraw(); 
        this.uiLayer.batchDraw();
        this.detectRooms(); 
    }
    
    getOutwardNormal(wall) {
        if (!this.buildingCenter) {
            let totalX = 0, totalY = 0, count = 0;
            this.walls.forEach(w => { totalX += w.startAnchor.x; totalY += w.startAnchor.y; count++; });
            if (count > 0) { this.buildingCenter = { x: totalX / count, y: totalY / count }; } 
            else { this.buildingCenter = { x: this.stage.width() / 2, y: this.stage.height() / 2 }; }
        }
        const p1 = wall.startAnchor.position(), p2 = wall.endAnchor.position();
        const wallCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const normal = { x: -dy, y: dx };
        const len = Math.hypot(normal.x, normal.y);
        if (len > 0) { normal.x /= len; normal.y /= len; }
        const vecToCenter = { x: this.buildingCenter.x - wallCenter.x, y: this.buildingCenter.y - wallCenter.y };
        if (normal.x * vecToCenter.x + normal.y * vecToCenter.y > 0) { normal.x *= -1; normal.y *= -1; }
        return normal;
    }

    getPointerPos() {
        const pointer = this.stage.getPointerPosition();
        if (!pointer) return null;
        if (typeof this.stage.getRelativePointerPosition === 'function') {
            return this.stage.getRelativePointerPosition();
        }
        return this.stage.getAbsoluteTransform().copy().invert().point(pointer);
    }

    finishChain() { 
        if (this.drawingStair) { this.drawingStair.finishDrawing(); this.drawingStair = null; } 
        if (this.drawingRoofPoints) { this.drawingRoofPoints = null; if (this.roofPreview) { this.roofPreview.destroy(); this.roofPreview = null; } }
        if (this.drawingArc) { this.drawingArc = null; if (this.arcPreview) { this.arcPreview.destroy(); this.arcPreview = null; } }
        if (this.shapePreviewGroup) { this.shapePreviewRect.visible(false); this.shapePreviewCircle.visible(false); this.shapePreviewTriangle.visible(false); }
        this.drawing = false; this.lastAnchor = null; this.startAnchor = null; 
        this.preview?.destroy(); this.preview = null; 
        this.hideSnapGlow(); this.drawGuideLine(0,0,0,0, false); this.hideInfoBadge(); 
        if (this.smartGuides) this.smartGuides.clear();
        this.deselectAll(); 
    }
    
    initStageEvents() { 
        this.stage.on('dragstart', (e) => {
            if (e.target === this.stage) this.stage.container().style.cursor = 'grabbing';
        });
        
        this.stage.on('dragmove', (e) => {
            if (e.target === this.stage) return;
            if (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape') {
                if (this.tool === 'select' && !e.target.isWallPoly && !e.target.isStairNodeHandle && !(e.target.name() && e.target.name().includes('anchor'))) {
                    this.snapAndAlign(e.target);
                }
            }
        });

        this.stage.on('dragend', (e) => {
            if (e.target === this.stage) this.stage.container().style.cursor = this.tool === 'select' ? 'grab' : 'crosshair';
            if (this.alignmentLines) {
                this.alignmentLines.destroyChildren();
            }
            if (this.smartGuides) {
                this.smartGuides.clear();
            }
            this.uiLayer.batchDraw();
        });

        this.stage.on("mousedown touchstart", (e) => {
            if (e.evt && e.evt.touches && e.evt.touches.length > 1) return;
 
            if (this.tool === 'roof') return;
            if (e.target === this.stage || e.target === this.bgLayer || e.target === this.mainLayer) this.deselectAll(); 
            const wallConfig = WALL_REGISTRY[this.tool]; 
            
            const pos = this.getPointerPos();
            if (!pos) return;
            
            let targetPos = { x: this.snap(pos.x), y: this.snap(pos.y) }; 

            if (this.tool === 'stair') { if (!this.drawingStair) { this.drawingStair = new PremiumStair(this, targetPos.x, targetPos.y); this.stairs.push(this.drawingStair); } else { this.drawingStair.addPoint(targetPos.x, targetPos.y); } this.syncAll(); return; }
            if (this.tool === 'staircase_two') {
                const stair2 = new StaircaseTwo(this, targetPos.x, targetPos.y);
                this.stairs.push(stair2);
                this.tool = 'select';
                this.selectEntity(stair2, 'staircase_two');
                this.updateToolStates();
                this.syncAll();
                return;
            }
            if (this.tool === 'stair_v3') {
                const rootId = 'stair_' + Math.random().toString(36).substr(2, 9);
                const stairV3Data = {
                    id: rootId,
                    type: 'stair',
                    systemId: rootId,
                    x: targetPos.x, y: targetPos.y, elevation: 0, rotation: 0,
                    width: 100, stepCount: 10, stepHeight: 17.5, stepDepth: 28.0
                };
                const stairV3 = new PremiumStairV3(this, stairV3Data);
                this.stairs.push(stairV3);
                this.tool = 'select';
                this.updateToolStates();
                this.selectEntity(stairV3, 'stair');
                this.syncAll();
                return;
            }
            if (this.tool === 'stair_landing') {
                const rootId = 'stair_landing_' + Math.random().toString(36).substr(2, 9);
                const landingData = {
                    id: rootId,
                    type: 'stair_landing',
                    systemId: rootId,
                    x: targetPos.x, y: targetPos.y, elevation: 0, rotation: 0,
                    width: 100, length: 100, thickness: 20
                };
                const landing = new PremiumStairV3(this, landingData);
                this.stairs.push(landing);
                this.tool = 'select';
                this.updateToolStates();
                this.selectEntity(landing, 'stair');
                this.syncAll();
                return;
            }
            
            if (this.tool === 'arc') {
                let snap = targetPos;
                let closestDist = SNAP_DIST;
                
                let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < closestDist);
                if (a) { snap = { x: a.x, y: a.y }; closestDist = Math.hypot(a.x - pos.x, a.y - pos.y); }

                for (let w of this.walls) {
                    let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                    let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    if (dist < closestDist) { closestDist = dist; snap = proj; }
                }
                
                if (this.drawingArc && this.arcMousePos) {
                    snap = this.arcMousePos;
                }

                if (!this.drawingArc) {
                    this.drawingArc = { p1: snap, p2: null, state: 1 };
                    this.arcMousePos = snap;
                    
                    this.arcPreview = new Konva.Group();
                    this.arcPreview.ghostCircle = new Konva.Circle({ stroke: '#cbd5e1', dash: [4,4], strokeWidth: 1, listening: false });
                    this.arcPreview.angleFill = new Konva.Shape({ fill: 'rgba(59, 130, 246, 0.15)', listening: false });
                    this.arcPreview.radiusLines = new Konva.Line({ stroke: '#9ca3af', dash: [4,4], strokeWidth: 1, listening: false });
                    this.arcPreview.lineBase = new Konva.Line({ stroke: '#9ca3af', dash: [5,5], strokeWidth: 2, listening: false });
                    this.arcPreview.guideLine = new Konva.Line({ stroke: '#38bdf8', dash: [4,4], strokeWidth: 1, listening: false });
                    this.arcPreview.arcCurve = new Konva.Shape({ stroke: '#3b82f6', strokeWidth: 4, listening: false });
                    this.arcPreview.dragDot = new Konva.Circle({ radius: 6, fill: '#38bdf8', stroke: 'white', strokeWidth: 2, listening: false });

                    this.arcPreview.add(this.arcPreview.ghostCircle, this.arcPreview.angleFill, this.arcPreview.radiusLines, this.arcPreview.lineBase, this.arcPreview.guideLine, this.arcPreview.arcCurve, this.arcPreview.dragDot);
                    this.uiLayer.add(this.arcPreview);
                } else if (this.drawingArc.state === 1) {
                    if (Math.hypot(snap.x - this.drawingArc.p1.x, snap.y - this.drawingArc.p1.y) > 5) {
                        this.drawingArc.p2 = snap;
                        this.drawingArc.state = 2;
                        
                        const dx = snap.x - this.drawingArc.p1.x;
                        const dy = snap.y - this.drawingArc.p1.y;
                        const L = Math.hypot(dx, dy), n = { x: -dy/L, y: dx/L };
                        this.arcMousePos = { x: this.drawingArc.p1.x + dx/2 + n.x * (L/4), y: this.drawingArc.p1.y + dy/2 + n.y * (L/4) };
                        this.uiLayer.batchDraw();
                    }
                } else if (this.drawingArc.state === 2) {
                    if (!this.arcs) this.arcs = [];
                    const a1 = this.getOrCreateAnchor(this.drawingArc.p1.x, this.drawingArc.p1.y);
                    const a2 = this.getOrCreateAnchor(this.drawingArc.p2.x, this.drawingArc.p2.y);
                    const newArc = new PremiumArc(this, a1, a2, snap);
                    this.arcs.push(newArc);
                    this.finishChain();
                    this.tool = 'select'; this.updateToolStates();
                    if (this.onToolChange) this.onToolChange('select');
                    this.selectEntity(newArc, 'arc');
                    this.syncAll();
                }
                return;
            }
            
            if (this.tool.startsWith('shape_')) {
                let snapPos = targetPos;
                let closestDist = SNAP_DIST;
                let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < closestDist);
                if (a) { snapPos = { x: a.x, y: a.y }; }
                else {
                    for (let w of this.walls) {
                        let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                        let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                        if (dist < closestDist) { closestDist = dist; snapPos = proj; }
                    }
                }
                if (this.tool === 'shape_rect' || this.tool === 'shape_circle') {
                    this.drawingShapeType = this.tool; this.shapeStartPos = snapPos;
                    if (this.tool === 'shape_rect') { this.shapePreviewRect.position(snapPos); this.shapePreviewRect.width(0); this.shapePreviewRect.height(0); this.shapePreviewRect.visible(true); }
                    else if (this.tool === 'shape_circle') { this.shapePreviewCircle.position(snapPos); this.shapePreviewCircle.radius(0); this.shapePreviewCircle.visible(true); }
                    this.uiLayer.batchDraw();
                } else if (this.tool === 'shape_triangle') {
                    if (!this.drawingTriangle) { this.drawingTriangle = [snapPos]; }
                    else {
                        this.drawingTriangle.push(snapPos);
                        if (this.drawingTriangle.length === 3) { const newShape = new PremiumShape(this, 'shape_triangle', { points: [...this.drawingTriangle] }); if(!this.shapes) this.shapes = []; this.shapes.push(newShape); this.drawingTriangle = null; this.shapePreviewTriangle.visible(false); this.tool = 'select'; this.updateToolStates(); if (this.onToolChange) this.onToolChange('select'); this.selectEntity(newShape, 'shape'); this.syncAll(); }
                    }
                }
                return;
            }
            if (!wallConfig) return; 

            let targetSnapWall = null; 
            if (wallConfig && wallConfig.events.includes("snap_to_wall")) { 
                let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < SNAP_DIST); 
                if (a) { targetPos = { x: a.x, y: a.y }; targetSnapWall = this.walls.find(w => w.startAnchor === a || w.endAnchor === a); } 
                else { 
                    let closestDist = SNAP_DIST, closestPoint = null; 

                    let allReferenceWalls = this.referenceGroup ? this.referenceGroup.getChildren() : [];
                    for (let line of allReferenceWalls) {
                        let pts = line.points();
                        if (pts && pts.length === 4) {
                            let d1 = Math.hypot(pos.x - pts[0], pos.y - pts[1]); let d2 = Math.hypot(pos.x - pts[2], pos.y - pts[3]);
                            if (d1 < 40 && d1 < closestDist) { closestDist = 0; closestPoint = {x: pts[0], y: pts[1]}; targetSnapWall = null; }
                            else if (d2 < 40 && d2 < closestDist) { closestDist = 0; closestPoint = {x: pts[2], y: pts[3]}; targetSnapWall = null; }
                            else { let proj = this.getClosestPointOnSegment(pos, {x: pts[0], y: pts[1]}, {x: pts[2], y: pts[3]}); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); if (dist < closestDist) { closestDist = dist; closestPoint = proj; targetSnapWall = null; } }
                        }
                    }

                    if (this.shapes) {
                        for (let s of this.shapes) {
                            if (s.type !== 'shape_rect' && s.type !== 'shape_polygon') continue;
                            let pts = []; if (s.type === 'shape_rect') { const w = s.params.width; const h = s.params.height; pts = [ {x: -w/2, y: -h/2}, {x: w/2, y: -h/2}, {x: w/2, y: h/2}, {x: -w/2, y: h/2} ]; } else { pts = s.params.points; }
                            if (!pts) continue;
                            const transform = s.group.getTransform();
                            for (let i = 0; i < pts.length; i++) {
                                const p1 = transform.point(pts[i]); const p2 = transform.point(pts[(i + 1) % pts.length]);
                                let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y);
                                if (d1 < closestDist) { closestDist = d1; closestPoint = p1; targetSnapWall = null; }
                                const proj = this.getClosestPointOnSegment(pos, p1, p2);
                                const dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                                if (dist < closestDist) { closestDist = dist; closestPoint = proj; targetSnapWall = null; }
                            }
                        }
                    }

                    for (let w of this.walls) { 
                        let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position()); 
                        let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); 
                        if (dist < closestDist) { closestDist = dist; closestPoint = proj; targetSnapWall = w; } 
                    } 
                    if (closestPoint) targetPos = closestPoint; 
                } 
            } 
            
            if (this.drawing && wallConfig && wallConfig.events.includes("stop_collision") && this.checkWallIntersection(this.lastAnchor.position(), targetPos, [targetSnapWall])) return; 
            
            
            const currentAnchor = this.getOrCreateAnchor(targetPos.x, targetPos.y); 
            if (!this.drawing) { this.drawing = true; this.lastAnchor = currentAnchor; this.startAnchor = currentAnchor; currentAnchor.show(); } 
            else { 
                let reachedArcEnd = false;
                let sharedArc = null;
                if (this.lastAnchor !== currentAnchor) { 
                    sharedArc = (this.arcs || []).find(arc => {
                        let arcNodes = [arc.p1, ...arc.intermediateAnchors, arc.p2];
                        return arcNodes.includes(this.lastAnchor) && arcNodes.includes(currentAnchor);
                    });
                    
                    if (sharedArc) {
                        let arcNodes = [sharedArc.p1, ...sharedArc.intermediateAnchors, sharedArc.p2];
                        let i1 = arcNodes.indexOf(this.lastAnchor);
                        let i2 = arcNodes.indexOf(currentAnchor);
                        let step = i1 < i2 ? 1 : -1;
                        
                        let prev = arcNodes[i1];
                        for(let i = i1 + step; i !== i2 + step; i += step) {
                            let curr = arcNodes[i];
                            let w;
                            if (this.tool === 'railing') {
                                w = new PremiumRailing(this, prev, curr);
                                w.parentArc = sharedArc;
                                w.labelGroup.visible(false);
                                w.poly.off('mousedown touchstart');
                                w.poly.on('mousedown touchstart', (e) => { 
                                    if (this.tool === 'select') { 
                                        e.cancelBubble = true; 
                                        this.selectEntity(w, 'wall'); 
                                    } 
                                });
                                w.poly.draggable(false); 
                                w.poly.on('dragstart dragmove dragend', (e) => e.cancelBubble = true);
                            } else {
                                w = new PremiumWall(this, prev, curr, this.tool);
                            }
                            this.walls.push(w);
                            prev = curr;
                        }
                        
                        if (i2 === 0 || i2 === arcNodes.length - 1) reachedArcEnd = true;
                        if (this.tool === 'railing' && ((i1 === 0 && i2 === arcNodes.length - 1) || (i2 === 0 && i1 === arcNodes.length - 1))) {
                            sharedArc.hasRailing = true;
                        }
                    } else {
                        if (this.tool === 'railing') {
                            this.walls.push(new PremiumRailing(this, this.lastAnchor, currentAnchor));
                        } else {
                            this.walls.push(new PremiumWall(this, this.lastAnchor, currentAnchor, this.tool)); 
                        }
                    }
                } 
                if (currentAnchor === this.startAnchor || reachedArcEnd) { 
                    this.finishChain(); 
                    if (reachedArcEnd && this.tool === 'railing') {
                        this.tool = 'select'; this.updateToolStates();
                        if (this.onToolChange) this.onToolChange('select');
                        
                        if (sharedArc) {
                            const attachedRailing = this.walls.filter(w => w.type === 'railing' && w.parentArc === sharedArc);
                            if (attachedRailing.length > 0) {
                                this.selectEntity(attachedRailing[0], 'wall');
                            }
                        }
                    }
                } else { this.lastAnchor = currentAnchor; currentAnchor.show(); } 
            } 
            this.syncAll(); 
        }); 

        this.stage.on("mousemove touchmove", (e) => {
            if (e.evt && e.evt.touches && e.evt.touches.length > 1) return;
 
            if (this.tool === 'roof') return;

            if (e.target === this.stage || e.target === this.bgLayer || e.target === this.mainLayer) {
                document.body.style.cursor = ''; 
                this.stage.container().style.cursor = this.tool === 'select' ? (this.stage.isDragging() ? 'grabbing' : 'grab') : 'crosshair';
            }

            const pos = this.getPointerPos();
            if (!pos) return;
            
            let rawPos = { x: this.snap(pos.x), y: this.snap(pos.y) }; 
            
            if (this.drawingStair) { this.drawingStair.updateLastPoint(rawPos.x, rawPos.y); return; }
            
            if (this.drawingShapeType === 'shape_rect' && this.shapeStartPos) {
                const w = pos.x - this.shapeStartPos.x; const h = pos.y - this.shapeStartPos.y;
                this.shapePreviewRect.width(w); this.shapePreviewRect.height(h);
                this.updateInfoBadge(pos.x, pos.y + 30, `W: ${this.formatLength(Math.abs(w))}\nH: ${this.formatLength(Math.abs(h))}`, "", false);
                this.uiLayer.batchDraw(); return;
            } else if (this.drawingShapeType === 'shape_circle' && this.shapeStartPos) {
                const r = Math.hypot(pos.x - this.shapeStartPos.x, pos.y - this.shapeStartPos.y);
                this.shapePreviewCircle.radius(r);
                this.updateInfoBadge(pos.x, pos.y + 30, `R: ${this.formatLength(r)}`, "", false);
                this.uiLayer.batchDraw(); return;
            } else if (this.tool === 'shape_triangle' && this.drawingTriangle) {
                const pts = this.drawingTriangle.flatMap(p => [p.x, p.y]); pts.push(pos.x, pos.y);
                this.shapePreviewTriangle.points(pts); this.shapePreviewTriangle.visible(true);
                this.updateInfoBadge(pos.x, pos.y + 30, `Point ${this.drawingTriangle.length + 1}`, "", false);
                this.uiLayer.batchDraw(); return;
            }

            if (this.tool === 'split') {
                const hitThreshold = 20 / (this.stage.scaleX() || 1);
                let foundGlow = false;
                for (let w of this.walls) {
                    if (!WALL_REGISTRY[w.type] || !WALL_REGISTRY[w.type].events.includes('split_edge')) continue;
                    const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                    const proj = this.getClosestPointOnSegment(pos, p1, p2);
                    if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < hitThreshold) {
                        this.splitPreviewGlow.position(proj); this.splitPreviewGlow.show();
                        foundGlow = true; break;
                    }
                }
                if (!foundGlow && this.balconies) {
                    for (let b of this.balconies) {
                        if (!WIDGET_REGISTRY['balcony'] || !WIDGET_REGISTRY['balcony'].events.includes('split_edge')) continue;
                        const pts = b.vertices || b.points; if (!pts || pts.length < 3) continue;
                        const transform = b.group.getTransform();
                        for (let i = 0; i < pts.length; i++) {
                            const p1 = transform.point(pts[i]); const p2 = transform.point(pts[(i + 1) % pts.length]);
                            const proj = this.getClosestPointOnSegment(pos, p1, p2);
                            if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < hitThreshold) { this.splitPreviewGlow.position(proj); this.splitPreviewGlow.show(); foundGlow = true; break; }
                        }
                    }
                }
                if (!foundGlow && this.shapes) {
                    for (let s of this.shapes) {
                        if (s.type !== 'shape_rect' && s.type !== 'shape_polygon') continue;
                        let pts = []; if (s.type === 'shape_rect') { const w = s.params.width; const h = s.params.height; pts = [ {x: -w/2, y: -h/2}, {x: w/2, y: -h/2}, {x: w/2, y: h/2}, {x: -w/2, y: h/2} ]; } else { pts = s.params.points; }
                        const transform = s.group.getTransform();
                        for (let i = 0; i < pts.length; i++) {
                            const p1 = transform.point(pts[i]); const p2 = transform.point(pts[(i + 1) % pts.length]); const proj = this.getClosestPointOnSegment(pos, p1, p2);
                            if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < hitThreshold) { this.splitPreviewGlow.position(proj); this.splitPreviewGlow.show(); foundGlow = true; break; }
                        }
                    }
                }
                if (!foundGlow && this.splitPreviewGlow) this.splitPreviewGlow.hide(); this.uiLayer.batchDraw(); return;
            } else { if (this.splitPreviewGlow) this.splitPreviewGlow.hide(); }

            if (this.tool === 'arc') {
                let snap = rawPos;
                let closestDist = SNAP_DIST;
                let snappedObj = false;
                let targetSnapWall = null;

                let snappedToAxis = false;
                if (this.drawingArc && this.drawingArc.state === 1) {
                    const p1 = this.drawingArc.p1;
                    let dxAxis = rawPos.x - p1.x, dyAxis = rawPos.y - p1.y;
                    let rawAngle = Math.atan2(dyAxis, dxAxis) * 180 / Math.PI;
                    let distAxis = Math.hypot(dxAxis, dyAxis);
                    for (let a of [0, 45, 90, 135, 180, -45, -90, -135, -180]) {
                        if (Math.abs(rawAngle - a) < 5) { 
                            let rad = a * Math.PI / 180; 
                            rawPos.x = p1.x + distAxis * Math.cos(rad); 
                            rawPos.y = p1.y + distAxis * Math.sin(rad); 
                            snappedToAxis = true; 
                            this.drawGuideLine(p1.x, p1.y, rawPos.x, rawPos.y, true); 
                            break; 
                        }
                    }
                    if (!snappedToAxis) this.drawGuideLine(0,0,0,0, false);
                    snap = rawPos;
                }

                let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < closestDist);
                if (a) { snap = { x: a.x, y: a.y }; closestDist = Math.hypot(a.x - pos.x, a.y - pos.y); snappedObj = true; }

                for (let w of this.walls) {
                    let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                    let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    if (dist < closestDist) { closestDist = dist; snap = proj; snappedObj = true; targetSnapWall = w; }
                }

                if (snappedObj && (!this.drawingArc || this.drawingArc.state === 1)) {
                    this.showSnapGlow(snap.x, snap.y);
                } else {
                    this.hideSnapGlow();
                }
                
                this.walls.forEach(w => w.setHighlight(w === targetSnapWall || w === this.selectedEntity || (w.parentArc && w.parentArc === this.selectedEntity)));
                
                this.arcMousePos = (this.drawingArc && this.drawingArc.state === 2) ? pos : snap;
                
                if (this.drawingArc && this.arcPreview) {
                    if (this.drawingArc.state === 1) {
                        this.arcPreview.lineBase.points([this.drawingArc.p1.x, this.drawingArc.p1.y, snap.x, snap.y]);
                        this.arcPreview.lineBase.visible(true);
                        this.arcPreview.ghostCircle.visible(false);
                        this.arcPreview.angleFill.visible(false);
                        this.arcPreview.radiusLines.visible(false);
                        this.arcPreview.guideLine.visible(false);
                        this.arcPreview.arcCurve.visible(false);
                        this.arcPreview.dragDot.visible(false);
                        
                        let dxBadge = snap.x - this.drawingArc.p1.x, dyBadge = snap.y - this.drawingArc.p1.y;
                        let lenBadge = this.formatLength(Math.hypot(dxBadge, dyBadge));
                        let angBadge = Math.abs(Math.atan2(dyBadge, dxBadge) * 180 / Math.PI).toFixed(1);
                        this.updateInfoBadge(snap.x, snap.y, lenBadge, angBadge, snappedObj);
                    } else if (this.drawingArc.state === 2) {
                        const p1 = this.drawingArc.p1, p2 = this.drawingArc.p2, posCurve = this.arcMousePos;
                        const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
                        if (L >= 0.5) {
                            const mid = { x: p1.x + dx/2, y: p1.y + dy/2 }, n = { x: -dy/L, y: dx/L };
                            let h = (posCurve.x - mid.x)*n.x + (posCurve.y - mid.y)*n.y;
                            if (Math.abs(Math.abs(h) - L/2) < SNAP_DIST) { h = Math.sign(h) * (L/2); }
                            if (Math.abs(h) < 0.1) h = Math.sign(h) * 0.1 || 0.1;
                            
                            const R = Math.abs(h/2 + (L*L)/(8*h)), dC = (L*L)/(8*h) - h/2;
                            const center = { x: mid.x - n.x * dC, y: mid.y - n.y * dC };
                            const sAng = Math.atan2(p1.y - center.y, p1.x - center.x), eAng = Math.atan2(p2.y - center.y, p2.x - center.x), ccw = h < 0;
                            
                            this.arcPreview.lineBase.points([p1.x, p1.y, p2.x, p2.y]);
                            this.arcPreview.lineBase.visible(true);
                            this.arcPreview.ghostCircle.setAttrs({ x: center.x, y: center.y, radius: R, visible: true });
                            this.arcPreview.arcCurve.sceneFunc((ctx, shape) => { ctx.beginPath(); ctx.arc(center.x, center.y, R, sAng, eAng, ccw); ctx.strokeShape(shape); });
                            this.arcPreview.arcCurve.visible(true);
                            this.arcPreview.radiusLines.points([p1.x, p1.y, center.x, center.y, p2.x, p2.y]);
                            this.arcPreview.radiusLines.visible(true);
                            const curveMidX = mid.x + n.x * h, curveMidY = mid.y + n.y * h;
                            this.arcPreview.guideLine.points([mid.x, mid.y, curveMidX, curveMidY]);
                            this.arcPreview.guideLine.visible(true);
                            this.arcPreview.dragDot.position({ x: curveMidX, y: curveMidY });
                            this.arcPreview.dragDot.visible(true);
                            
                            this.updateInfoBadge(posCurve.x, posCurve.y + 30, "Move mouse to form curve", "", false);
                        }
                    }
                    this.uiLayer.batchDraw();
                }
                
                document.body.style.cursor = 'crosshair';
                return;
            }
            const wallConfig = WALL_REGISTRY[this.tool]; 
            
            let refAngle = 0;
            let isWallReference = false;
            if (this.drawing && this.lastAnchor) {
                const connectedWalls = this.walls.filter(w => w.endAnchor === this.lastAnchor || w.startAnchor === this.lastAnchor);
                if (connectedWalls.length > 0) {
                    const w = connectedWalls[0];
                    const otherAnc = w.startAnchor === this.lastAnchor ? w.endAnchor : w.startAnchor;
                    refAngle = Math.atan2(otherAnc.y - this.lastAnchor.y, otherAnc.x - this.lastAnchor.x) * 180 / Math.PI;
                    isWallReference = true;
                } else {
                    for (let w of this.walls) {
                        const p1 = w.startAnchor.position();
                        const p2 = w.endAnchor.position();
                        const lastPos = { x: this.lastAnchor.x, y: this.lastAnchor.y };
                        const proj = this.getClosestPointOnSegment(lastPos, p1, p2);
                        if (Math.hypot(lastPos.x - proj.x, lastPos.y - proj.y) < 2) {
                            let distToP1 = Math.hypot(lastPos.x - p1.x, lastPos.y - p1.y);
                            let distToP2 = Math.hypot(lastPos.x - p2.x, lastPos.y - p2.y);
                            if (distToP1 > distToP2) {
                                refAngle = Math.atan2(p1.y - lastPos.y, p1.x - lastPos.x) * 180 / Math.PI;
                            } else {
                                refAngle = Math.atan2(p2.y - lastPos.y, p2.x - lastPos.x) * 180 / Math.PI;
                            }
                            isWallReference = true;
                            break;
                        }
                    }
                }
                if (this.smartGuides && this.smartGuides.calculateAngleSnap) {
                    rawPos = this.smartGuides.calculateAngleSnap(this.lastAnchor.position(), rawPos, refAngle);
                }
            }

            let snapPos = rawPos; let targetSnapWall = null; let snappedObj = false;

            if (wallConfig && wallConfig.events.includes("snap_to_wall")) { 
                let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < SNAP_DIST); 
                if (a) { snapPos = { x: a.x, y: a.y }; targetSnapWall = this.walls.find(w => w.startAnchor === a || w.endAnchor === a); snappedObj = true; } 
                else { 
                    let closestDist = SNAP_DIST, closestPoint = null; 

                    let allReferenceWalls = this.referenceGroup ? this.referenceGroup.getChildren() : [];
                    for (let line of allReferenceWalls) {
                        let pts = line.points();
                        if (pts && pts.length === 4) {
                            let d1 = Math.hypot(pos.x - pts[0], pos.y - pts[1]);
                            let d2 = Math.hypot(pos.x - pts[2], pos.y - pts[3]);
                            if (d1 < 40 && d1 < closestDist) { closestDist = 0; closestPoint = {x: pts[0], y: pts[1]}; snappedObj = true; targetSnapWall = null; }
                            else if (d2 < 40 && d2 < closestDist) { closestDist = 0; closestPoint = {x: pts[2], y: pts[3]}; snappedObj = true; targetSnapWall = null; }
                            else {
                                let proj = this.getClosestPointOnSegment(pos, {x: pts[0], y: pts[1]}, {x: pts[2], y: pts[3]});
                                let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                                if (dist < closestDist) { closestDist = dist; closestPoint = proj; snappedObj = true; targetSnapWall = null; }
                            }
                        }
                    }

                    if (this.shapes) {
                        for (let s of this.shapes) {
                            if (s.type !== 'shape_rect' && s.type !== 'shape_polygon') continue;
                            let pts = []; if (s.type === 'shape_rect') { const w = s.params.width; const h = s.params.height; pts = [ {x: -w/2, y: -h/2}, {x: w/2, y: -h/2}, {x: w/2, y: h/2}, {x: -w/2, y: h/2} ]; } else { pts = s.params.points; }
                            if (!pts) continue;
                            const transform = s.group.getTransform();
                            for (let i = 0; i < pts.length; i++) {
                                const p1 = transform.point(pts[i]); const p2 = transform.point(pts[(i + 1) % pts.length]);
                                let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y);
                                if (d1 < closestDist) { closestDist = d1; closestPoint = p1; snappedObj = true; targetSnapWall = null; }
                                const proj = this.getClosestPointOnSegment(pos, p1, p2);
                                const dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                                if (dist < closestDist) { closestDist = dist; closestPoint = proj; snappedObj = true; targetSnapWall = null; }
                            }
                        }
                    }

                    for (let w of this.walls) { 
                        let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position()); 
                        let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); 
                        if (dist < closestDist) { closestDist = dist; closestPoint = proj; targetSnapWall = w; snappedObj = true; } 
                    } 
                    if (closestPoint) snapPos = closestPoint; 
                } 
            } 

            let endRefAngle = 0;
            let isEndWallReference = false;
            if (this.drawing && targetSnapWall) {
                const p1 = targetSnapWall.startAnchor.position();
                const p2 = targetSnapWall.endAnchor.position();
                let distToP1 = Math.hypot(snapPos.x - p1.x, snapPos.y - p1.y);
                let distToP2 = Math.hypot(snapPos.x - p2.x, snapPos.y - p2.y);
                if (distToP1 > distToP2) {
                    endRefAngle = Math.atan2(p1.y - snapPos.y, p1.x - snapPos.x) * 180 / Math.PI;
                } else {
                    endRefAngle = Math.atan2(p2.y - snapPos.y, p2.x - snapPos.x) * 180 / Math.PI;
                }
                isEndWallReference = true;
            }
            
            if (this.lastAnchor) {
                let dxBadge = snapPos.x - this.lastAnchor.x, dyBadge = snapPos.y - this.lastAnchor.y;
                let lenBadge = this.formatLength(Math.hypot(dxBadge, dyBadge));
                let angBadge = Math.abs(Math.atan2(dyBadge, dxBadge) * 180 / Math.PI).toFixed(1);
                this.updateInfoBadge(snapPos.x, snapPos.y, lenBadge, angBadge, snappedObj);
            } else {
                this.hideInfoBadge();
            }

            if (snappedObj) { this.showSnapGlow(snapPos.x, snapPos.y); } else { this.hideSnapGlow(); }

            this.walls.forEach(w => {
                let isHigh = (w === this.selectedEntity || (w.parentArc && w.parentArc === this.selectedEntity));
                if (!isHigh && w === targetSnapWall) {
                    isHigh = true;
                }
                w.setHighlight(isHigh);
            });

            if (!this.drawing) {
                this.uiLayer.batchDraw();
                return;
            }

            let isColliding = false; 
            if (wallConfig && (wallConfig.events.includes("collision_detected") || wallConfig.events.includes("stop_collision"))) { isColliding = this.checkWallIntersection(this.lastAnchor.position(), snapPos, [targetSnapWall]); } 
            
            this.preview?.destroy(); 
            const isClosing = (this.startAnchor && Math.hypot(this.startAnchor.x - snapPos.x, this.startAnchor.y - snapPos.y) < 15); 
            let drawColor = (isColliding && wallConfig && wallConfig.events.includes("stop_collision")) ? "#ef4444" : (isClosing ? "#10b981" : "#3b82f6"); 
            
            let previewPoints = [this.lastAnchor.x, this.lastAnchor.y, snapPos.x, snapPos.y];
            if (!isColliding && this.drawing && (this.tool === 'railing' || this.tool === 'outer' || this.tool === 'inner')) {
                let a2 = this.anchors.find(a => Math.hypot(a.x - snapPos.x, a.y - snapPos.y) < 1);
                if (a2) {
                    let sharedArc = (this.arcs || []).find(arc => {
                        let arcNodes = [arc.p1, ...arc.intermediateAnchors, arc.p2];
                        return arcNodes.includes(this.lastAnchor) && arcNodes.includes(a2);
                    });
                    if (sharedArc) {
                        let arcNodes = [sharedArc.p1, ...sharedArc.intermediateAnchors, sharedArc.p2];
                        let i1 = arcNodes.indexOf(this.lastAnchor);
                        let i2 = arcNodes.indexOf(a2);
                        let step = i1 < i2 ? 1 : -1;
                        previewPoints = [];
                        for(let i = i1; i !== i2 + step; i += step) previewPoints.push(arcNodes[i].x, arcNodes[i].y);
                    }
                }
            }
            
            let previewThickness = wallConfig && wallConfig.thickness ? wallConfig.thickness : 2;
            this.preview = new Konva.Line({ points: previewPoints, stroke: drawColor, strokeWidth: previewThickness, lineCap: 'square', opacity: 0.6 }); 
            this.uiLayer.add(this.preview); 
            this.preview.moveToBottom();
            
            if (this.drawing && this.lastAnchor && this.smartGuides && this.smartGuides.drawAngleGuide) {
                let drawnStart = false;
                if (isWallReference) {
                    this.smartGuides.drawAngleGuide(this.lastAnchor.position(), snapPos, refAngle, true);
                    drawnStart = true;
                } else {
                    this.smartGuides.clear();
                }
                if (isEndWallReference) {
                    this.smartGuides.drawAngleGuide(snapPos, this.lastAnchor.position(), endRefAngle, true, drawnStart);
                }
            } else if (this.smartGuides && this.smartGuides.clear) {
                this.smartGuides.clear();
            }

            this.uiLayer.batchDraw(); 
        }); 

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.finishChain();
        });

        this.stage.on('mouseup touchend', (e) => {
            if (e.evt && e.evt.touches && e.evt.touches.length > 0) return;

            if (this.drawingShapeType) {
                if (this.drawingShapeType === 'shape_rect') {
                    const w = this.shapePreviewRect.width(); const h = this.shapePreviewRect.height();
                    if (Math.abs(w) > 5 && Math.abs(h) > 5) {
                        const cx = this.shapeStartPos.x + w / 2; const cy = this.shapeStartPos.y + h / 2;
                        const newShape = new PremiumShape(this, 'shape_rect', { x: cx, y: cy, width: Math.abs(w), height: Math.abs(h) });
                        if(!this.shapes) this.shapes = []; this.shapes.push(newShape); this.tool = 'select'; this.updateToolStates(); if (this.onToolChange) this.onToolChange('select'); this.selectEntity(newShape, 'shape');
                    }
                    this.shapePreviewRect.visible(false);
                } else if (this.drawingShapeType === 'shape_circle') {
                    const r = this.shapePreviewCircle.radius();
                    if (r > 5) {
                        const newShape = new PremiumShape(this, 'shape_circle', { x: this.shapeStartPos.x, y: this.shapeStartPos.y, radius: r });
                        if(!this.shapes) this.shapes = []; this.shapes.push(newShape); this.tool = 'select'; this.updateToolStates(); if (this.onToolChange) this.onToolChange('select'); this.selectEntity(newShape, 'shape');
                    }
                    this.shapePreviewCircle.visible(false);
                }
                this.drawingShapeType = null; this.shapeStartPos = null; this.hideInfoBadge(); this.uiLayer.batchDraw(); this.syncAll();
            }
        });

        // --- Hip Roof Drawing Mode Logic ---
        this.stage.on("mousedown.roof touchstart.roof", (e) => {
            if (e.evt && e.evt.touches && e.evt.touches.length > 1) return;

            if (this.tool !== 'roof') return;
            const pos = this.getPointerPos();
            if (!pos) return;
            
            console.log("mousedown.roof: Clicked with roof tool at", pos);

            let snap = pos;
            let closestDist = SNAP_DIST;
            
            let allReferenceWalls = this.referenceGroup ? this.referenceGroup.getChildren() : [];
            for (let line of allReferenceWalls) {
                let pts = line.points();
                if (pts && pts.length === 4) {
                    let d1 = Math.hypot(pos.x - pts[0], pos.y - pts[1]); let d2 = Math.hypot(pos.x - pts[2], pos.y - pts[3]);
                    if (d1 < closestDist) { closestDist = d1; snap = {x: pts[0], y: pts[1]}; }
                    if (d2 < closestDist) { closestDist = d2; snap = {x: pts[2], y: pts[3]}; }
                    let proj = this.getClosestPointOnSegment(pos, {x: pts[0], y: pts[1]}, {x: pts[2], y: pts[3]}); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); if (dist < closestDist) { closestDist = dist; snap = proj; }
                }
            }

            // ADD WALL SNAPPING TO MOUSEDOWN
            for (let w of this.walls) {
                const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y); let d2 = Math.hypot(pos.x - p2.x, pos.y - p2.y);
                if (d1 < closestDist) { closestDist = d1; snap = p1; }
                if (d2 < closestDist) { closestDist = d2; snap = p2; }
                let proj = this.getClosestPointOnSegment(pos, p1, p2); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                if (dist < closestDist) { closestDist = dist; snap = proj; }
            }
            
            if (!this.drawingRoofPoints) {
                console.log("mousedown.roof: Starting new roof");
                this.drawingRoofPoints = [snap];
                this.roofPreview = new Konva.Line({ points: [snap.x, snap.y, snap.x, snap.y], stroke: '#f59e0b', strokeWidth: 4, dash: [6, 4], fill: 'rgba(245, 158, 11, 0.3)' });
                this.uiLayer.add(this.roofPreview); // Add to UI layer so it's always visible above walls
                this.uiLayer.batchDraw();
            } else {
                console.log("mousedown.roof: Adding point to roof");
                const startP = this.drawingRoofPoints[0];
                if (Math.hypot(snap.x - startP.x, snap.y - startP.y) < SNAP_DIST && this.drawingRoofPoints.length > 2) {
                    console.log("mousedown.roof: Finishing roof");
                    const roof = new PremiumHipRoof(this, this.drawingRoofPoints);
                    this.roofs.push(roof); this.selectEntity(roof, 'roof');
                    this.drawingRoofPoints = null; this.roofPreview.destroy(); this.roofPreview = null;
                    this.tool = 'select'; this.updateToolStates(); this.syncAll();
                    if (this.onToolChange) this.onToolChange(this.tool);
                } else {
                    this.drawingRoofPoints.push(snap);
                    const pts = this.drawingRoofPoints.flatMap(p => [p.x, p.y]); pts.push(snap.x, snap.y);
                    this.roofPreview.points(pts);
                    this.uiLayer.batchDraw();
                }
            }
        });

        this.stage.on("mousemove.roof touchmove.roof", (e) => {
            if (e && e.evt && e.evt.touches && e.evt.touches.length > 1) return;

            if (this.tool === 'roof') {
                const pos = this.getPointerPos();
                if (!pos) return;
                
                let snap = pos; 
                let closestDist = SNAP_DIST;
                let snappedObj = false;
                let targetSnapWall = null;

                let allReferenceWalls = this.referenceGroup ? this.referenceGroup.getChildren() : [];
                for (let line of allReferenceWalls) {
                    let pts = line.points();
                    if (pts && pts.length === 4) {
                        let d1 = Math.hypot(pos.x - pts[0], pos.y - pts[1]); let d2 = Math.hypot(pos.x - pts[2], pos.y - pts[3]);
                        if (d1 < closestDist) { closestDist = d1; snap = {x: pts[0], y: pts[1]}; snappedObj = true; } if (d2 < closestDist) { closestDist = d2; snap = {x: pts[2], y: pts[3]}; snappedObj = true; }
                        let proj = this.getClosestPointOnSegment(pos, {x: pts[0], y: pts[1]}, {x: pts[2], y: pts[3]}); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); if (dist < closestDist) { closestDist = dist; snap = proj; snappedObj = true; }
                    }
                }

                // ADD WALL SNAPPING TO MOUSEMOVE
                for (let w of this.walls) {
                    const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                    let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y); let d2 = Math.hypot(pos.x - p2.x, pos.y - p2.y);
                    if (d1 < closestDist) { closestDist = d1; snap = p1; snappedObj = true; targetSnapWall = w; }
                    if (d2 < closestDist) { closestDist = d2; snap = p2; snappedObj = true; targetSnapWall = w; }
                    let proj = this.getClosestPointOnSegment(pos, p1, p2); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    if (dist < closestDist) { closestDist = dist; snap = proj; snappedObj = true; targetSnapWall = w; }
                }
                
                this.walls.forEach(w => w.setHighlight(w === targetSnapWall || w === this.selectedEntity || (w.parentArc && w.parentArc === this.selectedEntity)));
                
                if (snappedObj) { this.showSnapGlow(snap.x, snap.y); } else { this.hideSnapGlow(); }

                if (this.drawingRoofPoints && this.roofPreview) {
                    const pts = this.drawingRoofPoints.flatMap(p => [p.x, p.y]); pts.push(snap.x, snap.y);
                    this.roofPreview.points(pts);
                }
                
                document.body.style.cursor = 'crosshair'; this.mainLayer.batchDraw(); this.uiLayer.batchDraw();
            } else {
                if (this.drawingRoofPoints) { this.drawingRoofPoints = null; if (this.roofPreview) { this.roofPreview.destroy(); this.roofPreview = null; } }
                if (document.body.style.cursor === 'crosshair') { document.body.style.cursor = 'default'; }
            }
        });
    }

    detectRooms() { 
        this.roomLayer.destroyChildren(); 
        if (this.roomLabelLayer) this.roomLabelLayer.destroyChildren();
        const newRooms = []; 
        const edges = [];
        
        const isPointOnSegment = (p, p1, p2) => {
            const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (len < 0.5) return false;
            const crossProduct = (p.y - p1.y) * (p2.x - p1.x) - (p.x - p1.x) * (p2.y - p1.y);
            const dist = Math.abs(crossProduct) / len;
            if (dist > 0.5) return false; // Tighten cross-axis tolerance
            const dotProduct = (p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y);
            if (dotProduct < 0.1 || dotProduct > len * len - 0.1) return false; // Strictly inside endpoints
            return true;
        };

        this.walls.forEach(w => {
            const p1 = w.startAnchor;
            const p2 = w.endAnchor;
            const pointsOnWall = [];
            this.anchors.forEach(a => {
                if (a === p1 || a === p2) return;
                if (isPointOnSegment(a.position(), p1.position(), p2.position())) {
                    pointsOnWall.push(a);
                }
            });
            pointsOnWall.sort((a, b) => {
                return Math.hypot(a.x - p1.x, a.y - p1.y) - Math.hypot(b.x - p1.x, b.y - p1.y);
            });
            
            const uniquePoints = [p1];
            pointsOnWall.forEach(pt => {
                const last = uniquePoints[uniquePoints.length - 1];
                if (Math.hypot(pt.x - last.x, pt.y - last.y) > 0.5) {
                    uniquePoints.push(pt);
                }
            });
            
            if (Math.hypot(p2.x - uniquePoints[uniquePoints.length - 1].x, p2.y - uniquePoints[uniquePoints.length - 1].y) > 0.5) {
                uniquePoints.push(p2);
            } else {
                uniquePoints[uniquePoints.length - 1] = p2;
            }

            for (let i = 0; i < uniquePoints.length - 1; i++) {
                edges.push({ from: uniquePoints[i], to: uniquePoints[i+1], wall: w });
                edges.push({ from: uniquePoints[i+1], to: uniquePoints[i], wall: w });
            }
        });

        const getCluster = (anchor, adjMap) => {
            for (let cluster of adjMap.keys()) {
                if (Math.hypot(cluster.x - anchor.x, cluster.y - anchor.y) < 2) {
                    return cluster;
                }
            }
            return anchor;
        };

        const adj = new Map();
        edges.forEach(e => {
            const clusterFrom = getCluster(e.from, adj);
            const clusterTo = getCluster(e.to, adj);
            if (clusterFrom === clusterTo) return;
            
            if (!adj.has(clusterFrom)) adj.set(clusterFrom, []);
            
            // Prevent duplicate edges from identical overlapping walls (like railings on top of walls)
            if (!adj.get(clusterFrom).some(ex => ex.to === clusterTo)) {
                adj.get(clusterFrom).push({ from: clusterFrom, to: clusterTo, wall: e.wall, realFrom: e.from, realTo: e.to });
            }
        });

        adj.forEach((outgoing, anchor) => {
            outgoing.sort((a, b) => {
                const angleA = Math.atan2(a.to.y - anchor.y, a.to.x - anchor.x);
                const angleB = Math.atan2(b.to.y - anchor.y, b.to.x - anchor.x);
                return angleA - angleB;
            });
        });

        const visitedEdges = new Set();
        const faces = [];

        edges.forEach(startEdge => {
            const clusterStartFrom = getCluster(startEdge.from, adj);
            const clusterStartTo = getCluster(startEdge.to, adj);
            if (clusterStartFrom === clusterStartTo) return;
            
            const clusteredStartEdges = adj.get(clusterStartFrom);
            if (!clusteredStartEdges) return;
            const clusteredStartEdge = clusteredStartEdges.find(e => e.to === clusterStartTo);
            if (!clusteredStartEdge || visitedEdges.has(clusteredStartEdge)) return;
            
            const face = [];
            let currentEdge = clusteredStartEdge;
            let isClosed = false;

            while (!visitedEdges.has(currentEdge)) {
                visitedEdges.add(currentEdge);
                face.push(currentEdge);
                
                const nextAnchor = currentEdge.to;
                const outgoing = adj.get(nextAnchor);
                if (!outgoing || outgoing.length === 0) break;
                
                let revIndex = outgoing.findIndex(e => e.to === currentEdge.from);
                let nextIndex = (revIndex - 1 + outgoing.length) % outgoing.length;
                currentEdge = outgoing[nextIndex];
                
                if (currentEdge === clusteredStartEdge) {
                    isClosed = true;
                    break;
                }
            }

            if (isClosed && face.length >= 3) {
                let area = 0;
                for (let i = 0; i < face.length; i++) {
                    const p1 = face[i].from;
                    const p2 = face[i].to;
                    area += (p2.x - p1.x) * (p2.y + p1.y);
                }
                // Reject mathematically impossible slivers and the infinite outer boundary
                if (area < -50) {
                    faces.push(face);
                }
            }
        });

        faces.forEach(face => {
            const path = face.map(e => e.realFrom || e.from);
            path.push(face[face.length - 1].realTo || face[face.length - 1].to); 
            
            let cx = 0, cy = 0;
            const uniquePoints = path.slice(0, -1);
            uniquePoints.forEach(p => { cx += p.x; cy += p.y; });
            cx /= uniquePoints.length;
            cy /= uniquePoints.length;

            let existingRoom = (this.rooms || []).find(r => Math.hypot(r.cx - cx, r.cy - cy) < 20);
            const room = { path, cx, cy, configId: existingRoom ? existingRoom.configId : 'hardwood', isDeleted: existingRoom ? existingRoom.isDeleted : false, isHidden: existingRoom ? existingRoom.isHidden : false, materialRepeat: existingRoom ? existingRoom.materialRepeat : undefined };
            newRooms.push(room);
            if (!room.isDeleted && !room.isHidden) {
                this.drawRoom(room);
            }
        });

        this.rooms = newRooms;
        this.roomPaths = newRooms.map(r => r.path);
        if (this.bgLayer) this.bgLayer.batchDraw();
    }
    drawRoom(room) { 
        const anchorPath = room.path;
        const points = anchorPath.flatMap(a => [a.x, a.y]); 
        const poly = new Konva.Line({ points: points, fill: '#f0f4f8', closed: true, opacity: 0.7 }); 
        
        poly.on('mouseenter', () => { 
            const cat = this.activeCategory || 'tools';
            if(this.tool === 'select' && cat !== 'doors_windows') document.body.style.cursor = 'pointer'; 
        });
        poly.on('mouseleave', () => document.body.style.cursor = 'default');
        poly.on('click', (e) => { 
            const cat = this.activeCategory || 'tools';
            if(this.tool === 'select' && cat !== 'doors_windows') {
                e.cancelBubble = true;
                this.selectEntity(room, 'room');
            }
        });
        
        room.setHighlight = (active) => {
            poly.stroke(active ? '#4f46e5' : null);
            poly.strokeWidth(active ? 4 : 0);
            this.stage.batchDraw();
        };

        const areaSqFt = this.calculateArea(points);
        let areaText = Math.round(areaSqFt) + " sqft";
        if (this.settings && this.settings.areaUnit) {
            const au = this.settings.areaUnit;
            if (au === 'sqm') areaText = (areaSqFt * 0.092903).toFixed(2) + " sqm";
            else if (au === 'cent') areaText = (areaSqFt / 435.6).toFixed(2) + " cent";
            else if (au === 'ground') areaText = (areaSqFt / 2400).toFixed(2) + " ground";
            else if (au === 'gunta') areaText = (areaSqFt / 1089).toFixed(2) + " gunta";
            else areaText = Math.round(areaSqFt) + " sqft";
        }
        const label = new Konva.Text({ x: room.cx, y: room.cy, text: "Room\n" + areaText, fontSize: 12, fill: '#6b7280', align: 'center', fontStyle: 'bold', listening: false, visible: this.settings ? this.settings.showWorkspaceLabels : true }); 
        label.offsetX(label.width() / 2); label.offsetY(label.height() / 2); 
        label.rotation(-(this.settings?.houseRotation || 0));
        this.roomLayer.add(poly); 
        if (this.roomLabelLayer) this.roomLabelLayer.add(label); else this.roomLayer.add(label);

        // Draw Diagonal Dimensions if enabled
        if (this.settings && this.settings.showDiagonalDimensions && anchorPath.length > 3) {
            let corners = [];
            let uniquePoints = anchorPath.slice(0, -1);
            
            if (uniquePoints.length >= 4) {
                for (let i = 0; i < uniquePoints.length; i++) {
                    let pPrev = uniquePoints[(i - 1 + uniquePoints.length) % uniquePoints.length];
                    let pCurr = uniquePoints[i];
                    let pNext = uniquePoints[(i + 1) % uniquePoints.length];
                    
                    let dir1 = { x: pCurr.x - pPrev.x, y: pCurr.y - pPrev.y };
                    let len1 = Math.hypot(dir1.x, dir1.y);
                    if (len1 > 0) { dir1.x /= len1; dir1.y /= len1; }
                    
                    let dir2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };
                    let len2 = Math.hypot(dir2.x, dir2.y);
                    if (len2 > 0) { dir2.x /= len2; dir2.y /= len2; }
                    
                    let ang1 = Math.atan2(dir1.y, dir1.x);
                    let ang2 = Math.atan2(dir2.y, dir2.x);
                    
                    let diff = Math.abs(ang1 - ang2);
                    diff = diff % (2 * Math.PI);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;
                    
                    // Register corner if angle change is more than ~5.7 degrees (0.1 rad)
                    if (diff > 0.1) {
                        let w1s = this.walls.filter(w => w.type !== 'railing' && this.getDistanceToWall(pPrev, w) < 2 && this.getDistanceToWall(pCurr, w) < 2);
                        let w1 = w1s[0];
                        
                        let w2s = this.walls.filter(w => w.type !== 'railing' && this.getDistanceToWall(pCurr, w) < 2 && this.getDistanceToWall(pNext, w) < 2);
                        let w2 = w2s[0];
                        
                        let t1 = w1 ? (w1.thickness || (w1.config && w1.config.thickness) || 10) : 10;
                        let t2 = w2 ? (w2.thickness || (w2.config && w2.config.thickness) || 10) : 10;
                        
                        let n1 = { x: -dir1.y, y: dir1.x };
                        let n2 = { x: -dir2.y, y: dir2.x };
                        
                        let sign = (this.settings && this.settings.diagonalMeasurementMode === 'outer') ? -1 : 1;
                        
                        let L1_p = { x: pCurr.x + n1.x * (t1/2) * sign, y: pCurr.y + n1.y * (t1/2) * sign };
                        let L2_p = { x: pCurr.x + n2.x * (t2/2) * sign, y: pCurr.y + n2.y * (t2/2) * sign };
                        
                        let det = dir1.x * dir2.y - dir1.y * dir2.x;
                        let innerCorner;
                        if (Math.abs(det) < 1e-6) {
                            innerCorner = { x: pCurr.x, y: pCurr.y };
                        } else {
                            let t = ((L2_p.x - L1_p.x) * dir2.y - (L2_p.y - L1_p.y) * dir2.x) / det;
                            innerCorner = { x: L1_p.x + t * dir1.x, y: L1_p.y + t * dir1.y };
                        }
                        corners.push(innerCorner);
                    }
                }
            }
            
            if (corners.length === 4) {
                const d1 = new Konva.Line({ points: [corners[0].x, corners[0].y, corners[2].x, corners[2].y], stroke: '#9ca3af', strokeWidth: 1, dash: [4, 4], listening: false });
                const d2 = new Konva.Line({ points: [corners[1].x, corners[1].y, corners[3].x, corners[3].y], stroke: '#9ca3af', strokeWidth: 1, dash: [4, 4], listening: false });
                
                const len1 = Math.hypot(corners[2].x - corners[0].x, corners[2].y - corners[0].y);
                const len2 = Math.hypot(corners[3].x - corners[1].x, corners[3].y - corners[1].y);
                
                let cx1 = corners[0].x + (corners[2].x - corners[0].x) * 0.3;
                let cy1 = corners[0].y + (corners[2].y - corners[0].y) * 0.3;
                let ang1 = Math.atan2(corners[2].y - corners[0].y, corners[2].x - corners[0].x) * 180 / Math.PI;
                let screenAng1 = (ang1 + (this.settings?.houseRotation || 0)) % 360;
                if (screenAng1 > 180) screenAng1 -= 360; if (screenAng1 < -180) screenAng1 += 360;
                if (screenAng1 > 90 || screenAng1 <= -90) ang1 += 180;
                
                const text1 = new Konva.Text({ x: cx1, y: cy1, text: this.formatLength(len1), fontSize: 11, fill: '#6b7280', align: 'center', fontStyle: 'bold', listening: false, rotation: ang1 });
                text1.offsetX(text1.width() / 2); text1.offsetY(text1.height() + 2);
                
                let cx2 = corners[1].x + (corners[3].x - corners[1].x) * 0.3;
                let cy2 = corners[1].y + (corners[3].y - corners[1].y) * 0.3;
                let ang2 = Math.atan2(corners[3].y - corners[1].y, corners[3].x - corners[1].x) * 180 / Math.PI;
                let screenAng2 = (ang2 + (this.settings?.houseRotation || 0)) % 360;
                if (screenAng2 > 180) screenAng2 -= 360; if (screenAng2 < -180) screenAng2 += 360;
                if (screenAng2 > 90 || screenAng2 <= -90) ang2 += 180;
                
                const text2 = new Konva.Text({ x: cx2, y: cy2, text: this.formatLength(len2), fontSize: 11, fill: '#6b7280', align: 'center', fontStyle: 'bold', listening: false, rotation: ang2 });
                text2.offsetX(text2.width() / 2); text2.offsetY(text2.height() + 2);
                
                if (this.roomLabelLayer) {
                    this.roomLabelLayer.add(d1, d2, text1, text2);
                } else {
                    this.roomLayer.add(d1, d2, text1, text2);
                }
            }
        }
    }
    calculateArea(points) { let area = 0; for (let i = 0; i < points.length; i += 2) { let j = (i + 2) % points.length; area += points[i] * points[j + 1]; area -= points[i + 1] * points[j]; } return Math.abs(area / 2) * (PX_TO_FT * PX_TO_FT); }

    clearAll() {
        [...this.walls].forEach(w => w.remove()); [...this.furniture].forEach(f => f.remove()); [...this.stairs].forEach(s => s.remove()); [...this.roofs].forEach(r => r.remove()); 
        if (this.balconies) [...this.balconies].forEach(b => b.remove());
        if (this.arcs) [...this.arcs].forEach(a => a.remove());
        if (this.shapes) [...this.shapes].forEach(s => s.remove());
        if (this.shapeTransformer) this.shapeTransformer.nodes([]);
        this.walls = []; this.furniture = []; this.stairs = []; this.roofs = []; this.balconies = []; this.arcs = []; this.shapes = []; this.roomPaths = [];
        this.anchors.forEach(a => { if(a.node) a.node.destroy(); }); this.anchors = [];
        if (this.baseLayer) this.baseLayer.destroyChildren();
        if (this.wallLayer) this.wallLayer.destroyChildren(); if (this.furnitureLayer) this.furnitureLayer.destroyChildren(); if (this.widgetLayer) this.widgetLayer.destroyChildren(); if (this.roofLayer) this.roofLayer.destroyChildren();
        if (this.roomLabelLayer) this.roomLabelLayer.destroyChildren();
        if (this.mainLayer) this.mainLayer.batchDraw();
        this.selectEntity(null);
    }

    exportState() {
        const standardWalls = this.walls.filter(w => !w.parentArc);
        // Explicitly map anchors by index so we retain exact topology without accidental merging
        this.anchors.forEach((a, i) => a._id = i);

        const state = {
            settings: this.settings,
            unit: this.currentUnit,
            anchors: this.anchors.map(a => ({ id: a._id, x: a.x, y: a.y })),
            walls: standardWalls.map(w => ({
                startAnchorId: w.startAnchor._id, endAnchorId: w.endAnchor._id,
                startX: w.startAnchor.x, startY: w.startAnchor.y, endX: w.endAnchor.x, endY: w.endAnchor.y, thickness: w.thickness || w.config.thickness, height: w.height !== undefined ? w.height : (w.config?.height || 120), type: w.type, configId: w.configId,
                hidden: w.hidden,
                description: w.description,
                pts: w.poly ? w.poly.points() : null,                elevationLayers: w.elevationLayers,
                widgets: w.attachedWidgets.map(wid => ({ 
                    t: wid.t, type: wid.type, configId: wid.type, width: wid.width, height: wid.height, depth: wid.depth, elevation: wid.elevation,
                    facing: wid.facing, side: wid.side, 
                    rows: wid.rows, cols: wid.cols, spacing: wid.spacing, patternStyle: wid.patternStyle, decorConfigId: wid.decorConfigId,
                    doorType: wid.doorType, doorMat: wid.doorMat, 
                    windowType: wid.windowType, frameMat: wid.frameMat, glassMat: wid.glassMat, grillePattern: wid.grillePattern,
                    description: wid.description
                })),
                decors: w.attachedDecor ? w.attachedDecor.map(d => ({ id: d.id, configId: d.configId, side: d.side, localX: d.localX, localY: d.localY, localZ: d.localZ, width: d.width, height: d.height, depth: d.depth, tileSize: d.tileSize, faces: { front: d.faces.front, back: d.faces.back, left: d.faces.left, right: d.faces.right } })) : []
            })),
            furniture: this.furniture.map(f => ({ x: f.group.x(), y: f.group.y(), rotation: f.rotation, width: f.width, depth: f.depth, height: f.height, configId: f.config.id, description: f.description })),
            stairs: this.stairs.map(s => {
                if (s.type === 'staircase_two') return s.export();
                if (s.type === 'stair' || s.type === 'stair_landing') {
                    return {
                        id: s.id, type: s.type, systemId: s.systemId,
                        connectedFrom: s.connectedFrom, connectedTo: s.connectedTo,
                        x: s.x, y: s.y, elevation: s.elevation, rotation: s.rotation, rotationOffset: s.rotationOffset,
                        width: s.width, stepCount: s.stepCount, stepHeight: s.stepHeight, stepDepth: s.stepDepth,
                        length: s.length, thickness: s.thickness
                    };
                }
                return { path: s.path ? s.path.map(p => ({ x: p.x, y: p.y, shape: p.shape })) : [], description: s.description };
            }),
            roofs: this.roofs.map(r => ({ x: r.group.x(), y: r.group.y(), rotation: r.rotation, width: r.config?.width, depth: r.config?.depth, pitch: r.config?.pitch, overhang: r.config?.overhang, thickness: r.config?.thickness, ridgeOffset: r.config?.ridgeOffset, points: r.points, isHip: !!r.points, roofType: r.config?.roofType, material: r.config?.material, wallGap: r.config?.wallGap, description: r.description })),
            arcs: this.arcs ? this.arcs.map(a => ({ p1: {x: a.p1.x, y: a.p1.y}, p2: {x: a.p2.x, y: a.p2.y}, pos: a.pos, hasRailing: a.hasRailing, railingConfig: a.railingConfig, hidden: a.hidden, description: a.description })) : [],
            shapes: this.shapes ? this.shapes.map(s => ({ type: s.type, x: s.group.x(), y: s.group.y(), rotation: s.rotation, scaleX: s.group.scaleX(), scaleY: s.group.scaleY(), params: s.params, description: s.description })) : [],
            rooms: this.rooms ? this.rooms.map(r => ({ path: r.path.map(p => ({ x: p.x, y: p.y })), cx: r.cx, cy: r.cy, configId: r.configId, materialRepeat: r.materialRepeat, description: r.description })) : [],
            roomPaths: this.roomPaths ? this.roomPaths.map(path => path.map(p => ({ x: p.x, y: p.y }))) : []
        };
        return JSON.stringify(state);
    }

    importState(jsonStr) {
        this.clearAll();
        if (!jsonStr) return;
        try {
            const state = JSON.parse(jsonStr);
            if (state.settings) {
                this.settings = state.settings;
                this.wallTrackingEnabled = this.settings.wallTracking;
            }
            if (state.unit) {
                this.currentUnit = state.unit;
            }
            if (state.rooms) {
                this.rooms = state.rooms;
            }

            const anchorMap = new Map();
            if (state.anchors && Array.isArray(state.anchors)) { 
                state.anchors.forEach(aData => { 
                    const newAnchor = new Anchor(this, aData.x, aData.y); 
                    this.anchors.push(newAnchor); 
                    anchorMap.set(aData.id, newAnchor); 
                }); 
            }

            if (state.walls) {
                state.walls.forEach(wData => {
                    let a1, a2;
                    if (wData.startAnchorId !== undefined && wData.endAnchorId !== undefined && anchorMap.has(wData.startAnchorId) && anchorMap.has(wData.endAnchorId)) {
                        a1 = anchorMap.get(wData.startAnchorId);
                        a2 = anchorMap.get(wData.endAnchorId);
                    } else {
                        // Fallback for legacy state format
                        a1 = this.getOrCreateAnchor(wData.startX, wData.startY); 
                        a2 = this.getOrCreateAnchor(wData.endX, wData.endY);
                    }

                    let wall;
                    if (wData.type === 'railing') {
                        wall = new PremiumRailing(this, a1, a2);
                    } else {
                        wall = new PremiumWall(this, a1, a2, wData.type);
                    }
                    if (wData.thickness) wall.thickness = wData.thickness;
                    if (wData.height) wall.height = wData.height;
                    if (wData.configId) wall.configId = wData.configId;
                    if (wData.hidden !== undefined) wall.hidden = wData.hidden;
                    if (wData.description !== undefined) wall.description = wData.description;
                    if (wData.elevationLayers) wall.elevationLayers = wData.elevationLayers;

                    if (wData.widgets) { 
                        wData.widgets.forEach(wd => { 
                            if (['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(wd.type || wd.configId)) {
                                const advOp = new advance_openings(this, wall, wd.t, wd.type || wd.configId);
                                if (wd.width !== undefined) advOp.width = wd.width;
                                if (wd.height !== undefined) advOp.height = wd.height;
                                if (wd.depth !== undefined) advOp.depth = wd.depth;
                                if (wd.elevation !== undefined) advOp.elevation = wd.elevation;
                                if (wd.rows !== undefined) advOp.rows = wd.rows;
                                if (wd.cols !== undefined) advOp.cols = wd.cols;
                                if (wd.spacing !== undefined) advOp.spacing = wd.spacing;
                                if (wd.patternStyle !== undefined) advOp.patternStyle = wd.patternStyle;
                                if (wd.decorConfigId !== undefined) advOp.decorConfigId = wd.decorConfigId;
                                wall.attachedWidgets.push(advOp);
                            } else {
                                const widget = new PremiumWidget(this, wall, wd.t, wd.configId || wd.type); 
                                widget.width = wd.width; 
                                if (wd.description !== undefined) widget.description = wd.description;
                                if (wd.facing !== undefined) widget.facing = wd.facing;
                                if (wd.side !== undefined) widget.side = wd.side;
                                if (wd.doorType) widget.doorType = wd.doorType;
                                if (wd.doorMat) widget.doorMat = wd.doorMat;
                                if (wd.windowType) widget.windowType = wd.windowType;
                                if (wd.frameMat) widget.frameMat = wd.frameMat;
                                if (wd.glassMat) widget.glassMat = wd.glassMat;
                                if (wd.grillePattern) widget.grillePattern = wd.grillePattern;
                                wall.attachedWidgets.push(widget); 
                            }
                        }); 
                    }
                    if (wData.decors) { wall.attachedDecor = JSON.parse(JSON.stringify(wData.decors)); }
                    this.walls.push(wall);
                });
            }
            if (state.furniture) {
                state.furniture.forEach(fData => {
                    const furn = new PremiumFurniture(this, fData.x, fData.y, fData.configId);
                    furn.rotation = fData.rotation; furn.width = fData.width; furn.depth = fData.depth; furn.height = fData.height;
                    if (fData.description !== undefined) furn.description = fData.description;
                    this.furniture.push(furn);
                });
            }
            if (state.stairs) {
                state.stairs.forEach(sData => {
                    if (sData.type === 'staircase_two') {
                        const stair2 = new StaircaseTwo(this, sData.x, sData.y, sData.config);
                        if (sData.description !== undefined) stair2.description = sData.description;
                        this.stairs.push(stair2);
                        } else if (sData.type === 'stair' || sData.type === 'stair_landing') {
                            const stairV3 = new PremiumStairV3(this, sData);
                            this.stairs.push(stairV3);
                    } else if (sData.path && sData.path.length > 0) {
                        const stair = new PremiumStair(this, sData.path[0].x, sData.path[0].y); stair.path = sData.path; stair.initHandles();
                        if (sData.description !== undefined) stair.description = sData.description;
                        this.stairs.push(stair);
                    }
                });
            }
            if (state.roofs) {
                state.roofs.forEach(rData => {
                    let roof;
                    if (rData.points) {
                        roof = new PremiumHipRoof(this, rData.points);
                        roof.group.position({ x: rData.x, y: rData.y });
                    } else {
                        return; // Ignore old legacy roofs missing points arrays
                    }
                    if(rData.rotation) roof.rotation = rData.rotation;
                    if(roof.config) { roof.config.pitch = rData.pitch; roof.config.overhang = rData.overhang; roof.config.thickness = rData.thickness; roof.config.ridgeOffset = rData.ridgeOffset; roof.config.roofType = rData.roofType || 'hip'; roof.config.material = rData.material || 'asphalt_shingles'; roof.config.wallGap = rData.wallGap || 0; }
                    if (rData.description !== undefined) roof.description = rData.description;
                    roof.update(); this.roofs.push(roof);
                });
            }
            if (state.arcs) {
                if (!this.arcs) this.arcs = [];
                state.arcs.forEach(aData => {
                    const a1 = this.getOrCreateAnchor(aData.p1.x, aData.p1.y);
                    const a2 = this.getOrCreateAnchor(aData.p2.x, aData.p2.y);
                    const arc = new PremiumArc(this, a1, a2, aData.pos);
                    if (aData.hasRailing) {
                        arc.hasRailing = true;
                        if (aData.railingConfig) arc.railingConfig = aData.railingConfig;
                    }
                    if (aData.hidden !== undefined) {
                        arc.hidden = aData.hidden;
                    }
                    if (aData.description !== undefined) {
                        arc.description = aData.description;
                    }
                    arc.rebuild();
                    if (arc.hidden) {
                        arc.walls.forEach(w => w.hidden = true);
                    }
                    this.arcs.push(arc);
                });
            }
            if (state.shapes) {
                if (!this.shapes) this.shapes = [];
                state.shapes.forEach(sData => {
                    const shape = new PremiumShape(this, sData.type, sData.params);
                    shape.group.position({ x: sData.x, y: sData.y });
                    shape.rotation = sData.rotation;
                    shape.group.scale({ x: sData.scaleX || 1, y: sData.scaleY || 1 });
                    if (sData.description !== undefined) shape.description = sData.description;
                    shape.update(); this.shapes.push(shape);
                });
            }
            this.syncAll();
        } catch (e) { console.error("Failed to import internal state", e); }
    }

    clearReferenceBackground() { if (this.referenceGroup) { this.referenceGroup.destroy(); this.referenceGroup = null; if (this.bgLayer) this.bgLayer.batchDraw(); } }
    loadReferenceBackground(jsonStr) {
        this.clearReferenceBackground();
        if (!jsonStr) return;
        this.referenceGroup = new Konva.Group({ opacity: 0.35, listening: false });
        this.referenceLayer.add(this.referenceGroup);
        try {
            const state = JSON.parse(jsonStr);
            if (state && state.walls) {
                state.walls.forEach(wData => {
                    const line = new Konva.Line({ points: [wData.startX, wData.startY, wData.endX, wData.endY], stroke: '#94a3b8', strokeWidth: wData.thickness || 20, lineCap: 'round', lineJoin: 'round', dash: [] });
                    this.referenceGroup.add(line);
                });
            }
            this.bgLayer.batchDraw();
        } catch (err) { console.error("Failed to load reference background", err); }
    }
}
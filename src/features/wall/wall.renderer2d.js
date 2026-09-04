import Konva from 'konva';
import { WALL_REGISTRY, WIDGET_REGISTRY, RAILING_REGISTRY, MOLDING_REGISTRY } from '../../core/registry.js';
import { PremiumWidget } from '../../core/engine2d/PremiumWidget.js';
import { PremiumMolding } from '../../core/engine2d/PremiumMolding.js';
import { advance_openings } from '../../core/engine2d/advance_openings.js';
import { WallSerializer } from './wall.serializer.js';
import { WallEngine } from '../../core/wall/WallEngine.js';
import { WallGeometryEngine } from '../../core/wall/WallGeometryEngine.js';

export class PremiumWall {
    constructor(planner, startAnchor, endAnchor, type = "outer") {
        this.planner = planner; this.startAnchor = startAnchor; this.endAnchor = endAnchor; this.attachedWidgets = []; this.attachedMoldings = []; this.type = type; this.config = WALL_REGISTRY[type] || WALL_REGISTRY['outer'];
        this.id = 'wall_' + Date.now() + '_' + Math.floor(Math.random()*1000);
        const activeLevel = planner?.activeLevel || planner?.activeLevelConfig;
        this.thickness = activeLevel?.defaultWallThickness || this.config.thickness || (type === 'outer' ? 20 : 10);
        this.height = activeLevel?.height !== undefined ? Number(activeLevel.height) : (this.config.height || 180);
        
        // Parametric constraints to prevent joint folding on acute angles
        this.miterLimitRatio = this.config.miterLimitRatio || 3;
        this.miterLimit = this.config.miterLimit || 10; // Native canvas bevel cutoff (standard is 10)
        this.miterFoldLimit = this.config.miterFoldLimit || 20; // Intersection distance multiplier fallback
        
        this.elevationLayers = { front: [{ id: Date.now(), texture: 'none', color: '#e2e8f0', x: 0, y: 0, w: '100%', h: '100%' }], back: [{ id: Date.now()+1, texture: 'none', color: '#f8fafc', x: 0, y: 0, w: '100%', h: '100%' }] };
        this.fillColor = this.type === 'outer' ? '#e5e5e5' : (this.type === 'compound' ? '#e2e8f0' : '#f3f4f6'); 
        this.strokeColor = this.type === 'outer' ? '#9ca3af' : (this.type === 'compound' ? '#64748b' : '#d1d5db');
        this.isAutoGable = false;
        this.parentWallId = null;
        this.parentRoofId = null;
        this.elevation = 0;
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
            const { startL, endL, endR, startR, hasStartCap, hasEndCap, startData, endData, frontVerts, backVerts } = this.wallShapeData;

            const fVerts = (frontVerts && frontVerts.length > 0) ? frontVerts : [startL, endL];
            const bVerts = (backVerts && backVerts.length > 0) ? backVerts : [endR, startR];

            // 1. Fill Path (Solid Interior)
            ctx.beginPath();
            if (startData.bevelL) {
                ctx.moveTo(startData.bevelL.x, startData.bevelL.y);
                ctx.lineTo(fVerts[0].x, fVerts[0].y);
            } else {
                ctx.moveTo(fVerts[0].x, fVerts[0].y);
            }

            for (let i = 1; i < fVerts.length; i++) {
                ctx.lineTo(fVerts[i].x, fVerts[i].y);
            }

            if (endData.bevelL) { ctx.lineTo(endData.bevelL.x, endData.bevelL.y); }
            if (endData.bevelR) { ctx.lineTo(endData.bevelR.x, endData.bevelR.y); }

            for (let i = 0; i < bVerts.length; i++) {
                ctx.lineTo(bVerts[i].x, bVerts[i].y);
            }

            if (startData.bevelR) { ctx.lineTo(startData.bevelR.x, startData.bevelR.y); }

            ctx.closePath();
            ctx.fillShape(shape);

            // 2. Stroke Path (Exact outlines following bevel rules without overshooting)
            ctx.beginPath();

            // Left / Front side
            if (startData.bevelL) {
                ctx.moveTo(startData.bevelL.x, startData.bevelL.y);
                ctx.lineTo(fVerts[0].x, fVerts[0].y);
            } else {
                ctx.moveTo(fVerts[0].x, fVerts[0].y);
            }

            for (let i = 1; i < fVerts.length; i++) {
                ctx.lineTo(fVerts[i].x, fVerts[i].y);
            }

            if (endData.bevelL) { ctx.lineTo(endData.bevelL.x, endData.bevelL.y); }

            // Handle end cap or start a new right-side stroke
            if (hasEndCap) {
                if (endData.bevelR) { ctx.lineTo(endData.bevelR.x, endData.bevelR.y); }
                ctx.lineTo(bVerts[0].x, bVerts[0].y);
            } else {
                ctx.strokeShape(shape); // Stroke the left/front path
                ctx.beginPath(); // Start new path for right/back side
                if (endData.bevelR) {
                    ctx.moveTo(endData.bevelR.x, endData.bevelR.y);
                    ctx.lineTo(bVerts[0].x, bVerts[0].y);
                } else {
                    ctx.moveTo(bVerts[0].x, bVerts[0].y);
                }
            }

            // Right / Back side (drawn backwards from end to start)
            for (let i = 1; i < bVerts.length; i++) {
                ctx.lineTo(bVerts[i].x, bVerts[i].y);
            }

            if (startData.bevelR) { ctx.lineTo(startData.bevelR.x, startData.bevelR.y); }

            // Handle start cap transition
            if (hasStartCap) {
                if (startData.bevelL) { ctx.lineTo(startData.bevelL.x, startData.bevelL.y); }
                else { ctx.lineTo(fVerts[0].x, fVerts[0].y); }
            }

            ctx.strokeShape(shape);
        });
        
        this.frontHighlight = new Konva.Line({ stroke: '#0ea5e9', strokeWidth: 4, shadowColor: '#0ea5e9', shadowBlur: 8, listening: false, visible: false, lineCap: 'round', lineJoin: 'round' }); 
        this.backHighlight = new Konva.Line({ stroke: '#0ea5e9', strokeWidth: 4, shadowColor: '#0ea5e9', shadowBlur: 8, listening: false, visible: false, lineCap: 'round', lineJoin: 'round' });
        this.wallGroup.add(this.poly, this.frontHighlight, this.backHighlight); 
        this.planner.wallLayer.add(this.wallGroup);
        
        this.labelGroup = new Konva.Group({ listening: false });
        this.labelText = new Konva.Text({ fontSize: 11, fill: "#4b5563", padding: 2, fontStyle: 'bold' });
        this.labelGroup.add(this.labelText);
        this.planner.uiLayer.add(this.labelGroup);

        this.profileIndicators = new Konva.Group({ listening: false });
        this.wallGroup.add(this.profileIndicators);

        this.entranceGroup = new Konva.Group({ listening: false, visible: false });
        this.entranceBg = new Konva.Rect({ fill: '#f59e0b', cornerRadius: 4, height: 20 });
        this.entranceText = new Konva.Text({ fill: 'white', padding: 4, fontSize: 10, fontStyle: 'bold' });
        this.entranceGroup.add(this.entranceBg, this.entranceText);
        this.planner.uiLayer.add(this.entranceGroup);
        this.initEvents(); this.update();
    }
    
    hasEvent(eventName) { return this.config.events.includes(eventName); }
    getLength() { const p1 = this.startAnchor.position(), p2 = this.endAnchor.position(); return Math.hypot(p2.x - p1.x, p2.y - p1.y); }
    setHighlight(isActive) { 
        if (isActive) {
            // Selected state uses a subtle blue glow
            this.poly.fill(this.fillColor); 
            this.poly.stroke('#4f46e5'); 
            this.poly.strokeWidth(2); 
            this.poly.shadowColor('#4f46e5');
            this.poly.shadowBlur(5);
            this.poly.shadowOpacity(0.3);
            this.poly.shadowOffset({ x: 0, y: 0 });
        } else {
            this.poly.fill(this.hidden ? '#cbd5e1' : this.fillColor);
            this.poly.stroke(this.hidden ? '#475569' : this.strokeColor);
            this.poly.strokeWidth(1.5);
            this.poly.shadowBlur(0);
            this.poly.shadowOpacity(0);
        }
        this.planner.stage.batchDraw(); 
    }

    pulseHighlight() {
        const origFill = this.poly.fill();
        this.poly.fill('#86efac'); // Flash light green for visual feedback
        const tween = new Konva.Tween({
            node: this.poly,
            duration: 0.5,
            fill: origFill,
            onFinish: () => { tween.destroy(); }
        });
        tween.play();
    }

    placeItemFromSnapping(tool, face, pos) {
        this.planner.lastPlacementTime = Date.now();
        
        const isAdvancedOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(tool);
        const isMolding = !!MOLDING_REGISTRY[tool];
        const isWidget = !!WIDGET_REGISTRY[tool];
        
        let t = this.getClosestT(pos);
        let widget;
        
        this.pulseHighlight();

        if (isAdvancedOpening) {
            // Note: advance_openings requires the class to exist globally, fallback to PremiumOpening if needed
            widget = typeof advance_openings !== 'undefined' ? new advance_openings(this.planner, this, t, tool) : new PremiumOpening(this.planner, this, tool);
            this.planner.selectEntity(widget, 'opening');
            if (!this.attachedWidgets) this.attachedWidgets = [];
            this.attachedWidgets.push(widget);
        } else if (isMolding) {
            const moldType = MOLDING_REGISTRY[tool] ? tool : (this.planner.activePresetParams?.type || 'molding_skirting_flat');
            widget = new PremiumMolding(this.planner, this, 0.5, moldType);
            const start = this.startAnchor.position();
            const end = this.endAnchor.position();
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            widget.side = face === 'front' ? 'left' : 'right';
            widget.width = Math.hypot(dx, dy);
            if (this.planner.activePresetParams) {
                Object.assign(widget, this.planner.activePresetParams);
                widget.side = face === 'front' ? 'left' : 'right';
                widget.width = Math.hypot(dx, dy);
            }
            widget.update();
            this.planner.selectEntity(widget, 'molding');
            if (!this.attachedMoldings) this.attachedMoldings = [];
            this.attachedMoldings.push(widget);
        } else if (isWidget) {
            widget = new PremiumWidget(this.planner, this, t, tool);
            widget.facing = (face === 'back') ? -1 : 1;
            
            if (this.planner.activePresetParams) {
                Object.assign(widget, this.planner.activePresetParams);
                widget.update();
            }
            
            this.planner.selectEntity(widget, 'widget');
            if (!this.attachedWidgets) this.attachedWidgets = [];
            this.attachedWidgets.push(widget);
        }
        
        if (!isWidget) {
            this.planner.tool = 'select';
            if (this.planner.onToolChange) this.planner.onToolChange('select');
            this.planner.updateToolStates();
        }
        
        this.planner.syncAll();
        console.log("Object added via snapping:", widget);
    }
    
    initEvents() { 
        this.poly.on('mouseenter', () => {
            const isPlacementTool = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(this.planner.tool) || !!MOLDING_REGISTRY[this.planner.tool] || !!WIDGET_REGISTRY[this.planner.tool];
            
            if (this.planner.tool === 'select' || isPlacementTool) {
                document.body.style.cursor = 'pointer';
            }
        });
        this.poly.on('mouseleave', () => { 
            document.body.style.cursor = 'default'; 
        });
        this.poly.on('mousedown touchstart touchend', (e) => { 
            this.wallGroup.moveToTop();
            const isAdvancedOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(this.planner.tool);
            console.log("Wall mousedown/touchstart event fired.", { tool: this.planner.tool, isWidget: !!WIDGET_REGISTRY[this.planner.tool], isAdvancedOpening });
            
            if (this.planner.tool === 'split') {
                e.cancelBubble = true;
                if (e.evt) e.evt.stopPropagation();
                const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
                if (!pos) return;
                
                const p1 = this.startAnchor.position();
                const p2 = this.endAnchor.position();
                const proj = this.planner.getClosestPointOnSegment(pos, p1, p2);
                
                const result = WallEngine.splitWall(this.planner, this, proj);
                const splitAnchor = (result && result[1]) ? result[1].startAnchor : this.planner.getOrCreateAnchor(proj.x, proj.y);
                
                this.planner.tool = 'select';
                if (this.planner.onToolChange) this.planner.onToolChange('select');
                this.planner.updateToolStates();
                this.planner.selectEntity(splitAnchor, 'anchor');
                return;
            }
            const isMolding = !!MOLDING_REGISTRY[this.planner.tool];
            const isWidget = !!WIDGET_REGISTRY[this.planner.tool];
            const isPlacementTool = isWidget || isAdvancedOpening || isMolding;
            
            if (isPlacementTool) {
                // Let index.js handle the placement to ensure unified logic
                return;
            }

            if (this.planner.tool !== 'select') {
                return;
            }
            if (this.planner.lastPlacementTime && Date.now() - this.planner.lastPlacementTime < 500) {
                e.cancelBubble = true;
                return;
            }
            e.cancelBubble = true; 
            if (e.evt) e.evt.stopPropagation();
            if (this.parentGroup) {
                this.planner.selectEntity(this.parentGroup, 'preset_group');
                this.planner.syncAll();
            } else {
                this.planner.selectEntity(this, 'wall'); 
                this.planner.syncAll();
            }
        }); 
        
        this.poly.on('click tap', (e) => {
            if (this.planner.tool !== 'select') return;
            e.cancelBubble = true;
            if (this.parentGroup) {
                this.planner.selectEntity(this.parentGroup, 'preset_group');
                this.planner.syncAll();
            } else {
                this.planner.selectEntity(this, 'wall');
                this.planner.syncAll();
            }
        });
        
        let startAncPos = {}, startPointer = {}, initialObjectPositions = []; 
        let anchorsOnWall = [], arcsOnWall = [];
        this.poly.on('dragstart', (e) => { 
            if (this.planner.tool !== 'select' || this.parentGroup) { e.target.stopDrag(); return; }
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
                if (item.attachedWall) return item.attachedWall;
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
    
    getClosestT(pos) { const p1 = WallGeometryEngine.getAnchorPosition(this.startAnchor), p2 = WallGeometryEngine.getAnchorPosition(this.endAnchor), dx = p2.x - p1.x, dy = p2.y - p1.y, lenSq = dx*dx + dy*dy; if (lenSq === 0) return 0.5; let t = ((pos.x - p1.x) * dx + (pos.y - p1.y) * dy) / lenSq; return Math.max(0, Math.min(1, t)); }
    
    update() { 
        const p1 = WallGeometryEngine.getAnchorPosition(this.startAnchor);
        const p2 = WallGeometryEngine.getAnchorPosition(this.endAnchor);
        const vlen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (vlen === 0) return;

        const allWalls = this.planner?.walls || [];
        WallEngine.recalculateGeometry(this, allWalls);
        if (!this.wallShapeData) return;

        const { startData, endData } = this.wallShapeData;
        const n = WallGeometryEngine.getNormal(this);
        
        const startCorners = startData.corners;
        const endCorners = endData.corners;

        const startL = { x: startCorners[0].x, y: startCorners[0].y };
        const startR = { x: startCorners[1].x, y: startCorners[1].y };
        const endL = { x: endCorners[0].x, y: endCorners[0].y };
        const endR = { x: endCorners[1].x, y: endCorners[1].y };

        // Construct monolithic wall polygon including all solid exterior protrusions
        const frontVerts = [ { x: startL.x, y: startL.y } ];
        const backVerts = [ { x: endR.x, y: endR.y } ];

        const protrusions = (this.attachedWidgets || []).filter(w => (w.type === 'solid_protrusion' || w.configId === 'solid_protrusion' || w.type?.includes('protrusion') || w.configId?.includes('protrusion')));
        const wLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const halfThick = (this.thickness || this.config?.thickness || 20) / 2;
        const p1L = { x: p1.x + n.x * halfThick, y: p1.y + n.y * halfThick };
        const p2L = { x: p2.x + n.x * halfThick, y: p2.y + n.y * halfThick };
        const p1R = { x: p1.x - n.x * halfThick, y: p1.y - n.y * halfThick };
        const p2R = { x: p2.x - n.x * halfThick, y: p2.y - n.y * halfThick };

        if (protrusions.length > 0 && wLen > 1) {
            const isBackFacing = (p) => (p.facing === -1 || p.facing === 'back' || p.side === 'right');
            const frontProtrusions = protrusions.filter(p => !isBackFacing(p)).sort((a, b) => (a.t || 0.5) - (b.t || 0.5));
            const backProtrusions = protrusions.filter(p => isBackFacing(p)).sort((a, b) => (b.t || 0.5) - (a.t || 0.5));

            // Front edge protrusions (+n)
            frontProtrusions.forEach(p => {
                const halfSpan = Math.min(0.49, (p.width || 40) / (2 * wLen));
                const tCenter = p.t !== undefined ? p.t : 0.5;
                const t1 = Math.max(0.001, tCenter - halfSpan);
                const t2 = Math.min(0.999, tCenter + halfSpan);
                const d = Math.abs(Number(p.depth) || 10);

                const ptA = {
                    x: p1L.x + t1 * (p2L.x - p1L.x),
                    y: p1L.y + t1 * (p2L.y - p1L.y)
                };
                const ptA_out = { x: ptA.x + n.x * d, y: ptA.y + n.y * d };
                const ptB = {
                    x: p1L.x + t2 * (p2L.x - p1L.x),
                    y: p1L.y + t2 * (p2L.y - p1L.y)
                };
                const ptB_out = { x: ptB.x + n.x * d, y: ptB.y + n.y * d };

                frontVerts.push(ptA, ptA_out, ptB_out, ptB);
            });

            // Back edge protrusions (-n)
            backProtrusions.forEach(p => {
                const halfSpan = Math.min(0.49, (p.width || 40) / (2 * wLen));
                const tCenter = p.t !== undefined ? p.t : 0.5;
                const t1 = Math.max(0.001, tCenter - halfSpan);
                const t2 = Math.min(0.999, tCenter + halfSpan);
                const d = Math.abs(Number(p.depth) || 10);

                const ptB = {
                    x: p1R.x + t2 * (p2R.x - p1R.x),
                    y: p1R.y + t2 * (p2R.y - p1R.y)
                };
                const ptB_out = { x: ptB.x - n.x * d, y: ptB.y - n.y * d };
                const ptA = {
                    x: p1R.x + t1 * (p2R.x - p1R.x),
                    y: p1R.y + t1 * (p2R.y - p1R.y)
                };
                const ptA_out = { x: ptA.x - n.x * d, y: ptA.y - n.y * d };

                backVerts.push(ptB, ptB_out, ptA_out, ptA);
            });
        }

        frontVerts.push({ x: endL.x, y: endL.y });
        backVerts.push({ x: startR.x, y: startR.y });

        this.wallShapeData.frontVerts = frontVerts;
        this.wallShapeData.backVerts = backVerts;

        const polyCoords = [];
        if (startData.bevelL) polyCoords.push(startData.bevelL.x, startData.bevelL.y);
        frontVerts.forEach(v => polyCoords.push(v.x, v.y));
        if (endData.bevelL) polyCoords.push(endData.bevelL.x, endData.bevelL.y);
        if (endData.bevelR) polyCoords.push(endData.bevelR.x, endData.bevelR.y);
        backVerts.forEach(v => polyCoords.push(v.x, v.y));
        if (startData.bevelR) polyCoords.push(startData.bevelR.x, startData.bevelR.y);

        this.poly.points(polyCoords);
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

        const fCoords = [];
        frontVerts.forEach(v => fCoords.push(v.x, v.y));
        this.frontHighlight.points(fCoords);

        const bCoords = [];
        backVerts.forEach(v => bCoords.push(v.x, v.y));
        const labelStr = (this.planner && typeof this.planner.formatLength === 'function') ? this.planner.formatLength(this.getLength()) : `${Math.round(this.getLength())}`;
        this.labelText.text(labelStr);
        this.labelGroup.position({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
        this.labelGroup.offset({ x: this.labelText.width() / 2, y: 15 });
        this.labelGroup.rotation(-(this.planner.settings?.houseRotation || 0));
        this.labelGroup.visible(this.planner.settings ? this.planner.settings.showDimensionLabels : true);

        // --- Add Wall Profile (Sloped/Gable) Visualization ---
        this.profileIndicators.destroyChildren();
        if (this.topProfileType === 'gable' || this.topProfileType === 'single') {
            const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy);
            if (len > 0) {
                const u = { x: dx/len, y: dy/len };
                const inN = { x: -u.y, y: u.x }; // Normal vector extending INWARD
                const outN = { x: u.y, y: -u.x }; // Normal vector extending OUTWARD
                const normal = this.flipSlope ? outN : inN;
                
                // Extract true heights matching 3D EnvironmentBuilder.js
                const startH = Number(this.startHeight !== undefined ? this.startHeight : this.height) || 0;
                const endH = Number(this.endHeight !== undefined ? this.endHeight : this.height) || 0;
                const peakH = Number(this.peakHeight !== undefined ? this.peakHeight : this.height) || 0;
                
                // The base of the folded-in elevation should run along the edge of the wall,
                // between the true anchor points (ignoring miter joint extensions).
                const halfThick = this.thickness / 2;
                const baseP1 = { x: p1.x + normal.x * halfThick, y: p1.y + normal.y * halfThick };
                const baseP2 = { x: p2.x + normal.x * halfThick, y: p2.y + normal.y * halfThick };
                const fullDx = baseP2.x - baseP1.x;
                const fullDy = baseP2.y - baseP1.y;

                if (this.topProfileType === 'gable') {
                    const pMid = { x: baseP1.x + fullDx/2, y: baseP1.y + fullDy/2 };
                    const peak = { x: pMid.x + normal.x * peakH, y: pMid.y + normal.y * peakH };
                    const pStart = { x: baseP1.x + normal.x * startH, y: baseP1.y + normal.y * startH };
                    const pEnd = { x: baseP2.x + normal.x * endH, y: baseP2.y + normal.y * endH };
                    
                    // Main outline
                    this.profileIndicators.add(new Konva.Line({
                        points: [baseP1.x, baseP1.y, pStart.x, pStart.y, peak.x, peak.y, pEnd.x, pEnd.y, baseP2.x, baseP2.y],
                        stroke: '#94a3b8', strokeWidth: 1.5, dash: [4, 4],
                        fill: 'rgba(148, 163, 184, 0.15)', closed: true
                    }));
                    
                    // Hatching lines
                    for(let i=1; i<=7; i++) {
                        let t = i / 8;
                        let bx = baseP1.x + fullDx * t;
                        let by = baseP1.y + fullDy * t;
                        let h = t <= 0.5 ? startH + (peakH - startH) * (t / 0.5) : peakH + (endH - peakH) * ((t - 0.5) / 0.5);
                        this.profileIndicators.add(new Konva.Line({
                            points: [bx, by, bx + normal.x * h, by + normal.y * h],
                            stroke: 'rgba(148, 163, 184, 0.4)', strokeWidth: 1
                        }));
                    }
                } else if (this.topProfileType === 'single') {
                    const pStart = { x: baseP1.x + normal.x * startH, y: baseP1.y + normal.y * startH };
                    const pEnd = { x: baseP2.x + normal.x * endH, y: baseP2.y + normal.y * endH };
                    
                    // Single slope outline
                    this.profileIndicators.add(new Konva.Line({
                        points: [baseP1.x, baseP1.y, pStart.x, pStart.y, pEnd.x, pEnd.y, baseP2.x, baseP2.y],
                        stroke: '#94a3b8', strokeWidth: 1.5, dash: [4, 4],
                        fill: 'rgba(148, 163, 184, 0.15)', closed: true
                    }));
                    
                    // Hatching lines
                    for(let i=1; i<=7; i++) {
                        let t = i / 8;
                        let bx = baseP1.x + fullDx * t;
                        let by = baseP1.y + fullDy * t;
                        let h = startH + (endH - startH) * t;
                        this.profileIndicators.add(new Konva.Line({
                            points: [bx, by, bx + normal.x * h, by + normal.y * h],
                            stroke: 'rgba(148, 163, 184, 0.4)', strokeWidth: 1
                        }));
                    }
                }
            }
        }

        // --- Add Solid Wall Bump-out / Protrusion 2D Dimension Reference ---
        if (protrusions.length > 0 && wLen > 1) {
            protrusions.forEach(p => {
                const tCenter = p.t !== undefined ? p.t : 0.5;
                const d = Math.abs(Number(p.depth) || 10);
                const isBack = (p.facing === -1 || p.facing === 'back' || p.side === 'right');
                const edgeSign = isBack ? -1 : 1;
                const posX = p1.x + tCenter * (p2.x - p1.x) + n.x * (edgeSign * (halfThick + d / 2));
                const posY = p1.y + tCenter * (p2.y - p1.y) + n.y * (edgeSign * (halfThick + d / 2));

                const badgeText = new Konva.Text({
                    x: posX,
                    y: posY,
                    text: `+${Math.round(d)}`,
                    fontSize: 10,
                    fill: isSel ? '#4f46e5' : '#475569',
                    fontStyle: 'bold',
                    align: 'center'
                });
                badgeText.offsetX(badgeText.width() / 2);
                badgeText.offsetY(badgeText.height() / 2);
                badgeText.rotation(-(this.planner.settings?.houseRotation || 0));
                this.profileIndicators.add(badgeText);
            });
        }

        if (this.planner.settings && this.planner.settings.entranceWallId === this) {
            let facing = this.planner.settings.mainEntranceFacing || 'north';
            let labelMap = { north: 'North', south: 'South', east: 'East', west: 'West', north_east: 'North-East', north_west: 'North-West', south_east: 'South-East', south_west: 'South-West' };
            this.entranceText.text('🧭 ' + (labelMap[facing] || 'North') + ' Facing Entrance');
            this.entranceBg.width(this.entranceText.width());

            const dx = p2.x - p1.x; const dy = p2.y - p1.y;
            let ang = Math.atan2(dy, dx) * 180 / Math.PI;
            if (ang > 90 || ang <= -90) ang += 180;

            this.entranceGroup.position({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
            this.entranceGroup.rotation(ang);
            this.entranceGroup.offsetX(this.entranceText.width() / 2);            this.entranceGroup.offsetY(-15);
            this.entranceGroup.visible(true);
            this.entranceGroup.moveToTop();
        } else {
            this.entranceGroup.visible(false);
        }

        if (this.attachedWidgets) {
            this.attachedWidgets.forEach(w => {
                if (typeof w?.update === 'function') w.update();
            });
        } 
        if (this.attachedMoldings) {
            const wH = this.height !== undefined ? this.height : (this.config?.height || 180);
            this.attachedMoldings.forEach(m => {
                const mH = m.moldingHeight || 10;
                const isCrown = m.profileType === 'crown' || m.profileType === 'ogee' || m.profileType === 'dentil' || m.profileType === 'frieze_exterior';
                if (isCrown && m.heightOffset !== undefined && m.heightOffset >= 100) {
                    m.heightOffset = Math.max(0, wH - mH);
                }
                if (m.update) m.update();
            });
        }
    } 

    destroy() { 
        WallEngine.deleteWall(this.planner, this);
    } 

    getExactPolygonPoints() {
        return WallGeometryEngine.getExactPolygonPoints(this, this.planner?.walls || []);
    }

    applyMaterial(options) {
        WallEngine.applyMaterial(this, options, this.planner);
    }

    // ====== CANONICAL IN-PLACE MUTATION METHODS (CAD-STYLE) ======
    
    setThickness(newThickness, shouldSync = true) {
        WallEngine.setThickness(this, newThickness, shouldSync, this.planner);
    }

    setHeight(newHeight, shouldSync = true) {
        WallEngine.setHeight(this, newHeight, shouldSync, this.planner);
    }

    setElevation(newElevation, shouldSync = true) {
        WallEngine.setElevation(this, newElevation, shouldSync, this.planner);
    }

    setTopProfile(profileType, options = {}, shouldSync = true) {
        WallEngine.setTopProfile(this, profileType, options, shouldSync, this.planner);
    }

    setEndpoints(startPos, endPos, shouldSync = true) {
        WallEngine.setEndpoints(this, startPos, endPos, shouldSync, this.planner);
    }

    attachWidget(widget, shouldSync = true) {
        WallEngine.attachWidget(this, widget, shouldSync, this.planner);
    }

    removeWidget(widgetOrId, shouldSync = true) {
        WallEngine.removeWidget(this, widgetOrId, shouldSync, this.planner);
    }

    attachMolding(molding, shouldSync = true) {
        WallEngine.attachMolding(this, molding, shouldSync, this.planner);
    }

    removeMolding(moldingOrId, shouldSync = true) {
        WallEngine.removeMolding(this, moldingOrId, shouldSync, this.planner);
    }

    getLength() {
        return WallGeometryEngine.getLength(this);
    }

    getAngle() {
        return WallGeometryEngine.getAngle(this);
    }

    getNormal() {
        return WallGeometryEngine.getNormal(this);
    }

    getCenterline() {
        return WallGeometryEngine.getCenterline(this);
    }

    serialize() { 
        return WallSerializer.serialize(this);
    }
}


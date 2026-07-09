import { PremiumShape } from './PremiumShape.js';
// src/core/engine2d/index.js
import Konva from 'konva';
import { CameraController } from './CameraController.js';
import { GestureManager } from './GestureManager.js';
import { GRID, PX_TO_FT, SNAP_DIST, WALL_REGISTRY, WIDGET_REGISTRY, MOLDING_REGISTRY, offsetPolygon } from '../registry.js';

// SOLID: Import the decoupled 2D entity classes from the same folder
import { Anchor } from './Anchor.js';
import { PremiumWall } from './PremiumWall.js';
import { PremiumWidget } from './PremiumWidget.js';
import { PremiumFurniture } from './PremiumFurniture.js';

import { PremiumHipRoof } from './PremiumHipRoof.js';
import { PremiumRailing } from './PremiumRailing.js';
import { SmartGuidesTrackingSystem } from './SmartGuidesTrackingSystem.js';
import { advance_openings } from './advance_openings.js';
import { PremiumArc } from './PremiumArc.js';
import { StairV4Flight, StairV4Landing, StaircaseV4Solver } from './StaircaseV4.js';
import { PremiumStaircase } from './PremiumStaircase.js';
import { PremiumMolding } from './PremiumMolding.js';
import { PRESET_REGISTRY, autoAlign } from './presetRegistry.js';
import { PresetGroup } from './PresetGroup.js';

// Export the specific classes that App.vue needs to spawn items
export { PremiumFurniture, PremiumHipRoof, StairV4Flight, StairV4Landing, PremiumMolding };

export class FloorPlanner {
    get mobileDrawState() { return this._mobileDrawState || 'Idle'; }
    set mobileDrawState(val) {
        this._mobileDrawState = val;
        if (this.updateMobileDragHandle) this.updateMobileDragHandle();
    }
    
    constructor(containerEl) { 
        this.container = containerEl; this.tool = "select"; this.currentUnit = "ft"; this.drawing = false; this.lastAnchor = null; this.startAnchor = null;  this.preview = null; this.presetPreview = null;
        this._mobileDrawState = 'Idle';
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
        this.walls = [];
        this.presetRegistry = PRESET_REGISTRY;
        this.autoAlign = autoAlign;
        this.anchors = []; this.roomPaths = []; this.stairs = []; this.furniture = []; this.roofs = []; this.arcs = []; this.shapes = []; this.moldings = []; this.presetGroups = []; this.selectedEntity = null; this.selectedType = null; this.selectedNodeIndex = -1;
        this.onSelectionChange = null; 
        this.initKonva(); this.drawGrid(); this.initHUD(); 
        this.cameraController = new CameraController(this);
        this.gestureManager = new GestureManager(this, this.cameraController);
        this.initStageEvents(); 
        this.snapManager = this.smartGuides;
    }
    
    updateMobileDragHandle() {
        if (!this.uiLayer) return;
        if (!this.mobileDragHandle) {
            this.mobileDragHandle = new Konva.Group({ visible: false, listening: false });
            
            const outerCircle = new Konva.Circle({
                x: 0, y: 0, radius: 25,
                fill: 'rgba(239, 68, 68, 0.2)', // red-500
                stroke: '#ef4444', strokeWidth: 2
            });
            
            const innerCircle = new Konva.Circle({
                x: 0, y: 0, radius: 10,
                fill: '#ef4444'
            });
            
            this.mobileDragHandle.add(outerCircle, innerCircle);
            this.uiLayer.add(this.mobileDragHandle);
            
            this.mobileDragHandleAnim = new Konva.Animation((frame) => {
                const scale = 1 + Math.sin(frame.time * 0.005) * 0.15;
                outerCircle.scale({ x: scale, y: scale });
            }, this.uiLayer);
        }

        const isWallTool = ['outer', 'inner', 'railing'].includes(this.tool);
        
        if (this._mobileDrawState === 'ChainWaiting' && this.lastAnchor && isWallTool) {
            const scale = this.stage.scaleX() || 1;
            this.mobileDragHandle.position(this.lastAnchor.position());
            this.mobileDragHandle.scale({ x: 1/scale, y: 1/scale });
            this.mobileDragHandle.visible(true);
            this.mobileDragHandle.moveToTop();
            if (!this.mobileDragHandleAnim.isRunning()) {
                this.mobileDragHandleAnim.start();
            }
        } else {
            this.mobileDragHandle.visible(false);
            if (this.mobileDragHandleAnim && this.mobileDragHandleAnim.isRunning()) {
                this.mobileDragHandleAnim.stop();
            }
            this.uiLayer.batchDraw();
        }
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
    
    showSnapGlow(x, y, isTouch = false) { this.snapGlow.position({x, y}); this.snapGlow.radius(isTouch ? 12 : 6); this.snapGlow.show(); } 
    hideSnapGlow() { this.snapGlow.hide(); }
    
    drawGuideLine(x1, y1, x2, y2, show) { 
        if (!show) { this.guideLineInfinite.hide(); return; } 
        const dx = x2 - x1, dy = y2 - y1; const scale = 2000; 
        this.guideLineInfinite.points([x1 - dx*scale, y1 - dy*scale, x1 + dx*scale, y1 + dy*scale]); 
        this.guideLineInfinite.show(); 
        this.guideLineInfinite.moveToBottom(); 
    }
    
    updateInfoBadge(x, y, length, angle, snapped) { 
        let txt = `${length}\n${angle}Â°`; 
        if (snapped) txt += `\nðŸŽ¯ Snapped`; 
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

    selectEntity(entity, type, nodeIndex = -1, side = 'both') { 
        this.walls.forEach(w => { 
            if(w.setHighlight) w.setHighlight(false); 
            if(w.frontHighlight) w.frontHighlight.visible(false);
            if(w.backHighlight) w.backHighlight.visible(false);
        });
        this.stairs.forEach(s => { if(s.setHighlight) s.setHighlight(false); });
        this.furniture.forEach(f => { if(f.setHighlight) f.setHighlight(false); });
        this.roofs.forEach(r => { if(r.setHighlight) r.setHighlight(false); });
        if (this.balconies) this.balconies.forEach(b => { if(b.setHighlight) b.setHighlight(false); });
        if (this.shapes) this.shapes.forEach(s => { if(s.setHighlight) s.setHighlight(false); });
        if (this.arcs) this.arcs.forEach(a => { if(a.setHighlight) a.setHighlight(false); });
        if (this.presetGroups) this.presetGroups.forEach(pg => { if(pg.setHighlight) pg.setHighlight(false); });
        
        this.selectedEntity = entity; this.selectedType = type; this.selectedNodeIndex = nodeIndex; this.selectedSide = side;
        
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
        const isPan = this.tool === "pan";
        const isSplit = this.tool === "split";
        const isWidget = !!WIDGET_REGISTRY[this.tool];
        const isMolding = !!MOLDING_REGISTRY[this.tool];
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
                w.poly.setAttr('listening', canEditThisWall || (isWidget && !isRailing) || isMolding || isSplit || isAdvancedOpening); 
                
                // Clear any existing highlight when switching tools
                if (this.selectedEntity !== w) {
                    w.setHighlight(false);
                }
            }
            
            w.attachedWidgets.forEach(widg => {
                let group = widg.visualGroup || widg.group;
                if(group) {
                    let canEditWidget = isSelect || cat === 'doors_windows' || cat === 'advance_openings' || cat === 'architectural_details';
                    group.setAttr('draggable', canEditWidget);
                    group.setAttr('listening', canEditWidget);
                }
            });
            if (w.attachedMoldings) {
                w.attachedMoldings.forEach(mold => {
                    if(mold.visualGroup) {
                        let canEditMolding = isSelect || cat === 'architectural_details';
                        mold.visualGroup.setAttr('draggable', canEditMolding);
                        mold.visualGroup.setAttr('listening', canEditMolding);
                    }
                });
            }
        });

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
        if (this.wallLayer) { this.wallLayer.listening(allowAll || cat === "common" || cat === "walls" || cat === "doors_windows" || cat === "advance_openings" || cat === "structures" || cat === "architectural_details" || isWidget || isSplit || isAdvancedOpening || isMolding); }
        if (this.widgetLayer) { this.widgetLayer.listening(allowAll || cat === "doors_windows" || cat === "advance_openings" || cat === "structures" || cat === "architectural_details"); }
        if (this.furnitureLayer) { this.furnitureLayer.listening(allowAll || cat === "furniture" || cat === "shapes" || isSplit); }
        if (this.roofLayer) { this.roofLayer.listening(allowAll || cat === "structures"); }

        if (this.stage) {
            this.stage.draggable(isSelect || isPan);
            this.stage.container().style.cursor = isSelect ? 'grab' : (isPan ? 'move' : 'crosshair');
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
    deselectAll() { this.walls.forEach(w => w.setHighlight(false)); this.stairs.forEach(s => s.setHighlight(false)); this.furniture.forEach(f => f.setHighlight(false)); this.roofs.forEach(r => r.setHighlight(false)); if(this.balconies) this.balconies.forEach(b => b.setHighlight(false)); if(this.shapes) this.shapes.forEach(s => s.setHighlight(false)); if(this.presetGroups) this.presetGroups.forEach(pg => { if(pg.setHighlight) pg.setHighlight(false); }); this.selectEntity(null); this.syncAll(); }
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

    getPointerPos(e) {
        const pointer = this.stage.getPointerPosition();
        if (!pointer) return null;
        let pos = { x: pointer.x, y: pointer.y };

        const isDrawingTool = this.tool === 'outer' || this.tool === 'inner' || this.tool === 'railing' || this.drawing;
        const isTouch = e && e.type && (e.type.startsWith('touch') || e.pointerType === 'touch');

        // Jitter Reduction
        if (isTouch && isDrawingTool && e && e.type === 'touchmove') {
            if (this.lastRawTouchPos) {
                const dist = Math.hypot(pos.x - this.lastRawTouchPos.x, pos.y - this.lastRawTouchPos.y);
                if (dist < 3) { // 3 pixels screen distance ignore
                    pos = { x: this.lastRawTouchPos.x, y: this.lastRawTouchPos.y };
                } else {
                    this.lastRawTouchPos = { x: pos.x, y: pos.y };
                }
            } else {
                this.lastRawTouchPos = { x: pos.x, y: pos.y };
            }
        } else if (isTouch && isDrawingTool && e && e.type === 'touchstart') {
            this.lastRawTouchPos = { x: pos.x, y: pos.y };
        }

        const transform = this.stage.getAbsoluteTransform().copy().invert();
        const worldPos = transform.point(pos);

        return worldPos;
    }

    finishChain(isCancel = false) { 
         
        let newlyCreated = [...(this.currentSessionEntities || [])];
        
        if (this.drawingRoofPoints) { this.drawingRoofPoints = null; if (this.roofPreviewGroup) { this.roofPreviewGroup.destroy(); this.roofPreviewGroup = null; } else if (this.roofPreview) { this.roofPreview.destroy(); } this.roofPreview = null; }
        if (this.roofCloseTick) { this.roofCloseTick.destroy(); this.roofCloseTick = null; }
        if (this.drawingArc) { 
            if (this.drawingArc.state === 2) {
                if (!this.arcs) this.arcs = [];
                const a1 = this.getOrCreateAnchor(this.drawingArc.p1.x, this.drawingArc.p1.y);
                const a2 = this.getOrCreateAnchor(this.drawingArc.p2.x, this.drawingArc.p2.y);
                const snapPos = this.arcMousePos || this.drawingArc.p2;
                const newArc = new PremiumArc(this, a1, a2, snapPos);
                this.arcs.push(newArc);
                setTimeout(() => {
                    this.tool = 'select'; this.updateToolStates();
                    if (this.onToolChange) this.onToolChange('select');
                    this.selectEntity(newArc, 'arc');
                    this.syncAll();
                }, 10);
            }
            this.drawingArc = null; 
            if (this.arcPreview) { this.arcPreview.destroy(); this.arcPreview = null; } 
        }
        if (this.shapePreviewGroup) { this.shapePreviewRect.visible(false); this.shapePreviewCircle.visible(false); this.shapePreviewTriangle.visible(false); }
        this.drawing = false; this.lastAnchor = null; this.startAnchor = null; this.mobileDrawState = 'Idle';
        if (this.onDrawingChange) this.onDrawingChange(false);
        this.preview?.destroy(); this.preview = null; 
        this.hideSnapGlow(); this.drawGuideLine(0,0,0,0, false); this.hideInfoBadge(); 
        if (this.smartGuides) this.smartGuides.clear();
        
        this.deselectAll(); 
        
        if (!isCancel && newlyCreated.length > 0) {
            setTimeout(() => {
                this.tool = 'select';
                this.updateToolStates();
                if (this.onToolChange) this.onToolChange('select');
                this.selectEntity(newlyCreated[newlyCreated.length - 1], newlyCreated[newlyCreated.length - 1].type || 'wall');
            }, 10);
        } else {
            this.updateToolStates();
        }
    }
    
    cancelChain() {
        if (this.currentSessionEntities && this.currentSessionEntities.length > 0) {
            this.currentSessionEntities.forEach(ent => {
                if (ent.destroy) ent.destroy();
                if (this.walls) this.walls = this.walls.filter(w => w !== ent);
                if (this.arcs) this.arcs = this.arcs.filter(a => a !== ent);
            });
            this.currentSessionEntities = [];
        }
        this.drawing = false; this.lastAnchor = null; this.startAnchor = null; this.mobileDrawState = 'Idle';
        if (this.onDrawingChange) this.onDrawingChange(false);
        if (this.drawingShapeType) {
            this.drawingShapeType = null; this.shapeStartPos = null; this.drawingTriangle = null;
            if (this.shapePreviewGroup) { this.shapePreviewRect.visible(false); this.shapePreviewCircle.visible(false); this.shapePreviewTriangle.visible(false); }
        }
        if (this.drawingArc) {
            this.drawingArc = null;
            if (this.arcPreview) { this.arcPreview.destroy(); this.arcPreview = null; }
        }
        this.finishChain(true);
        this.syncAll();
    }
    
    updateArcPreviewState2(posCurve) {
        if (!this.drawingArc || this.drawingArc.state !== 2 || !this.arcPreview) return;
        const p1 = this.drawingArc.p1, p2 = this.drawingArc.p2;
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
            this.arcPreview.bendDot.position({ x: curveMidX, y: curveMidY });
            this.arcPreview.bendDot.visible(true);
            
            this.updateInfoBadge(posCurve.x, posCurve.y + 40, "Drag blue dot to shape the curve\nTap Finish to confirm", "", false);
        }
        this.uiLayer.batchDraw();
    }

    initStageEvents() { 
        this.stage.on('dragstart', (e) => {
            if (e.target === this.stage) this.stage.container().style.cursor = 'grabbing';
        });
        
        this.stage.on('dragmove', (e) => {
            if (e.target === this.stage) return;
            if (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape') {
                if ((this.tool === 'select' || this.tool === 'pan') && !e.target.isWallPoly && !e.target.isStairNodeHandle && !(e.target.name() && e.target.name().includes('anchor'))) {
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
            const isTouch = e.evt && (e.evt.touches || e.evt.pointerType === 'touch');
            
            if (isTouch && e.type === 'touchstart') {
                const isWallTool = ['outer', 'inner', 'railing'].includes(this.tool);
                if (isWallTool) {
                    if (this.gestureManager && this.gestureManager.isActive()) return;
                    const clonedPos = this.getPointerPos(e);
                    if (!clonedPos) return;
                    this.lastTouchDownPos = { x: clonedPos.x, y: clonedPos.y };
                    if (this.mobileDrawState === 'ChainWaiting') {
                        let distToLast = Infinity;
                        if (this.lastAnchor) {
                            distToLast = Math.hypot(clonedPos.x - this.lastAnchor.x, clonedPos.y - this.lastAnchor.y);
                        }
                        let distToStart = Infinity;
                        if (this.startAnchor) {
                            distToStart = Math.hypot(clonedPos.x - this.startAnchor.x, clonedPos.y - this.startAnchor.y);
                        }
                        const scale = this.stage.scaleX() || 1;
                        
                        // Prioritize startAnchor tap if it's closer than the drag handle
                        if (distToStart < distToLast && distToStart < 40 / scale) {
                            this.mobileIsPanning = true;
                        } else if (distToLast < 40 / scale) {
                            this.mobileDrawState = 'PreviewDrawing';
                            this.mobileIsPanning = false;
                        } else {
                            this.mobileIsPanning = true;
                        }
                    } else {
                        this.mobileIsPanning = false;
                        this.mobileDrawState = 'PreviewDrawing';
                        this._executePointerDownLogic(e, clonedPos, isTouch);
                    }
                    return;
                }

                if (this._touchDrawTimer) clearTimeout(this._touchDrawTimer);
                this._touchDrawCancelled = false;
                
                const clonedPos = this.getPointerPos(e);
                if (!clonedPos) return;

                this._touchDrawTimer = setTimeout(() => {
                    this._touchDrawTimer = null;
                    if (this._touchDrawCancelled) return;
                    if (this.gestureManager && this.gestureManager.isActive()) return;
                    this._executePointerDownLogic(e, clonedPos, isTouch);
                }, 150);
                return;
            }
            
            if (this.gestureManager && this.gestureManager.isActive()) return;
            const pos = this.getPointerPos(e);
            if (!pos) return;
            this._executePointerDownLogic(e, pos, isTouch);
        });

        this._executePointerDownLogic = (e, pos, isTouch) => {
            if (this.gestureManager && this.gestureManager.isActive()) return;
 
            if (this.tool === 'roof') return;
            
            if (this.lastPlacementTime && Date.now() - this.lastPlacementTime < 500) {
                return;
            }
            
            if (e.type !== 'touchend' && (e.target === this.stage || e.target === this.bgLayer || e.target === this.mainLayer)) {
                this.deselectAll(); 
            }
            const wallConfig = WALL_REGISTRY[this.tool]; 
            
            
            // Handle Smart Snapping Placement for Moldings and Openings
            const isAdvancedOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(this.tool);
            const isMolding = !!MOLDING_REGISTRY[this.tool];
            const isWidget = !!WIDGET_REGISTRY[this.tool];
            const isPlacementTool = isWidget || isAdvancedOpening || isMolding;

            if (isPlacementTool) {
                let targetWall = null;
                let targetFace = null;
                
                if (e.target && e.target.isWallPoly) {
                    targetWall = e.target.parentWall;
                    const start = targetWall.startAnchor.position();
                    const end = targetWall.endAnchor.position();
                    const dx = end.x - start.x;
                    const dy = end.y - start.y;
                    const cp = (pos.x - start.x) * dy - (pos.y - start.y) * dx;
                    targetFace = cp > 0 ? 'back' : 'front';
                } else {
                    let minWallDist = 60 / (this.stage.scaleX() || 1);
                    for (let w of this.walls) {
                        if (w.hidden || w.type === 'railing') continue;
                        const start = w.startAnchor.position();
                        const end = w.endAnchor.position();
                        const proj = this.getClosestPointOnSegment(pos, start, end);
                        const dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                        
                        if (dist < minWallDist) {
                            targetWall = w;
                            minWallDist = dist;
                            const dx = end.x - start.x;
                            const dy = end.y - start.y;
                            const cp = (pos.x - start.x) * dy - (pos.y - start.y) * dx;
                            targetFace = cp > 0 ? 'back' : 'front';
                        }
                    }
                }
                
                if (targetWall && targetWall.placeItemFromSnapping) {
                    this.walls.forEach(w => {
                        if (w.frontHighlight) w.frontHighlight.visible(false);
                        if (w.backHighlight) w.backHighlight.visible(false);
                    });
                    this.mainLayer.batchDraw();
                    targetWall.placeItemFromSnapping(this.tool, targetFace, pos);
                    return; 
                }
            }
            
            let targetPos = { x: this.snap(pos.x), y: this.snap(pos.y) };
            if (this.tool === 'stair_v4_flight') {
                const rootId = 'stairv4_' + Math.random().toString(36).substr(2, 9);
                const flightData = { id: rootId, x: targetPos.x, y: targetPos.y };
                const flight = new StairV4Flight(this, flightData);
                this.stairs.push(flight);
                this.tool = 'select';
                this.updateToolStates();
                this.selectEntity(flight, 'stair');
                this.syncAll();
                return;
            }
            if (this.tool === 'stair_v4_landing') {
                const rootId = 'stairv4_landing_' + Math.random().toString(36).substr(2, 9);
                const landingData = { id: rootId, x: targetPos.x, y: targetPos.y };
                const landing = new StairV4Landing(this, landingData);
                this.stairs.push(landing);
                this.tool = 'select';
                this.updateToolStates();
                this.selectEntity(landing, 'stair');
                this.syncAll();
                return;
            }
            if (this.tool === 'stair_v4_landing_curve') {
                const rootId = 'stairv4_landing_' + Math.random().toString(36).substr(2, 9);
                const landingData = { id: rootId, x: targetPos.x, y: targetPos.y, shape: 'u_curve', length: 100, innerRadius: 40 };
                const landing = new StairV4Landing(this, landingData);
                this.stairs.push(landing);
                this.tool = 'select';
                this.updateToolStates();
                this.selectEntity(landing, 'stair');
                this.syncAll();
                return;
            }
            if (this.tool.startsWith('stair_v5_')) {
                const shape = this.tool.split('_').pop(); // straight, L, U, T
                const stair = new PremiumStaircase(this, shape, { x: targetPos.x, y: targetPos.y });
                this.stairs.push(stair);
                this.tool = 'select';
                this.updateToolStates();
                this.selectEntity(stair, 'stair');
                this.syncAll();
                return;
            }
            
            if (this.tool === 'arc') {
                const scale = this.stage.scaleX() || 1;
                let activeSnapDist = isTouch ? (SNAP_DIST * 1.5) / scale : SNAP_DIST / scale;
                
                let snap = targetPos;
                let closestDist = activeSnapDist;
                
                let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < closestDist);
                if (a) { snap = { x: a.x, y: a.y }; closestDist = Math.hypot(a.x - pos.x, a.y - pos.y); }

                for (let w of this.walls) {
                    let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                    let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    if (dist < closestDist) { closestDist = dist; snap = proj; }
                }
                
                if (this.drawingArc) {
                    if (this.drawingArc.isFrozen) {
                        snap = this.drawingArc.frozenPos;
                    } else if (e.type !== 'touchstart' && this.arcMousePos) {
                        snap = this.arcMousePos;
                    } else {
                        this.arcMousePos = snap;
                    }
                }

                if (!this.drawingArc) {
                    this.drawingArc = { p1: snap, p2: null, state: 1 };
                    this.arcMousePos = snap;
                    
                    this.arcPreview = new Konva.Group();
                    this.arcPreview.ghostCircle = new Konva.Circle({ stroke: '#cbd5e1', dash: [4,4], strokeWidth: 1, listening: false, visible: false });
                    this.arcPreview.angleFill = new Konva.Shape({ fill: 'rgba(59, 130, 246, 0.15)', listening: false, visible: false });
                    this.arcPreview.radiusLines = new Konva.Line({ stroke: '#9ca3af', dash: [4,4], strokeWidth: 1, listening: false, visible: false });
                    this.arcPreview.lineBase = new Konva.Line({ stroke: '#9ca3af', dash: [5,5], strokeWidth: 2, listening: false, visible: false });
                    this.arcPreview.guideLine = new Konva.Line({ stroke: '#38bdf8', dash: [4,4], strokeWidth: 1, listening: false, visible: false });
                    this.arcPreview.arcCurve = new Konva.Shape({ stroke: '#3b82f6', strokeWidth: 4, listening: false, visible: false });
                    this.arcPreview.p1Dot = new Konva.Circle({ radius: 6, fill: '#22c55e', listening: false, x: snap.x, y: snap.y });
                    this.arcPreview.p2Dot = new Konva.Circle({ radius: 6, fill: '#22c55e', listening: false, visible: false });
                    this.arcPreview.bendDot = new Konva.Circle({ radius: 18, fill: '#3b82f6', draggable: true, visible: false });
                    this.arcPreview.bendDot.on('dragmove', (e) => {
                        this.arcMousePos = { x: e.target.x(), y: e.target.y() };
                        this.updateArcPreviewState2(this.arcMousePos);
                    });

                    this.arcPreview.add(this.arcPreview.ghostCircle, this.arcPreview.angleFill, this.arcPreview.radiusLines, this.arcPreview.lineBase, this.arcPreview.guideLine, this.arcPreview.arcCurve, this.arcPreview.p1Dot, this.arcPreview.p2Dot, this.arcPreview.bendDot);
                    this.uiLayer.add(this.arcPreview);
                    this.uiLayer.batchDraw();
                    if (this.onDrawingChange) this.onDrawingChange(true);
                } else if (this.drawingArc.state === 1) {
                    if (Math.hypot(snap.x - this.drawingArc.p1.x, snap.y - this.drawingArc.p1.y) > 5) {
                        this.drawingArc.p2 = snap;
                        this.drawingArc.state = 2;
                        this.stage.draggable(true);
                        
                        const dx = snap.x - this.drawingArc.p1.x;
                        const dy = snap.y - this.drawingArc.p1.y;
                        const L = Math.hypot(dx, dy), n = { x: -dy/L, y: dx/L };
                        this.arcMousePos = { x: this.drawingArc.p1.x + dx/2 + n.x * (L/4), y: this.drawingArc.p1.y + dy/2 + n.y * (L/4) };
                        this.arcPreview.p2Dot.position(snap);
                        this.arcPreview.p2Dot.visible(true);
                        this.arcPreview.bendDot.position(this.arcMousePos);
                        this.arcPreview.bendDot.visible(true);
                        this.updateArcPreviewState2(this.arcMousePos);
                        this.uiLayer.batchDraw();
                    }
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
                    if (this.onDrawingChange) this.onDrawingChange(true);
                    this.uiLayer.batchDraw();
                } else if (this.tool === 'shape_triangle') {
                    if (!this.drawingTriangle) { 
                        this.drawingTriangle = [snapPos]; 
                        if (this.onDrawingChange) this.onDrawingChange(true);
                    }
                    else {
                        this.drawingTriangle.push(snapPos);
                        if (this.drawingTriangle.length === 3) { const newShape = new PremiumShape(this, 'shape_triangle', { points: [...this.drawingTriangle] }); if(!this.shapes) this.shapes = []; this.shapes.push(newShape); this.drawingTriangle = null; this.shapePreviewTriangle.visible(false); this.tool = 'select'; this.updateToolStates(); if (this.onToolChange) this.onToolChange('select'); this.selectEntity(newShape, 'shape'); if (this.onDrawingChange) this.onDrawingChange(false); this.syncAll(); }
                    }
                }
                return;
            }
            if (!wallConfig) return; 

            let targetSnapWall = null; 
            const scale = this.stage.scaleX() || 1;
            const activeSnapDist = isTouch ? 20 / scale : SNAP_DIST / scale;

            if (wallConfig && wallConfig.events.includes("snap_to_wall")) { 
                let closestDist = activeSnapDist;
                
                if (isTouch && this.lastStickySnap && Math.hypot(pos.x - this.lastStickySnap.rawPos.x, pos.y - this.lastStickySnap.rawPos.y) < activeSnapDist * 1.1) {
                    targetPos = { x: this.lastStickySnap.snapPos.x, y: this.lastStickySnap.snapPos.y };
                    targetSnapWall = this.lastStickySnap.wall;
                    closestDist = 0;
                } else if (isTouch && this.drawing && this.startAnchor && Math.hypot(pos.x - this.startAnchor.x, pos.y - this.startAnchor.y) < activeSnapDist * 3) {
                    targetPos = this.startAnchor.position();
                    closestDist = 0;
                } else {
                    this.lastStickySnap = null;
                }

                if (closestDist > 0) {
                    const anchorSnapMult = isTouch ? 1.5 : 1;
                    let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < activeSnapDist * anchorSnapMult); 
                    if (a) { targetPos = { x: a.x, y: a.y }; targetSnapWall = this.walls.find(w => w.startAnchor === a || w.endAnchor === a); } 
                    else { 
                        let closestPoint = null; 
    
                        let allReferenceWalls = this.referenceGroup ? this.referenceGroup.getChildren() : [];
                        for (let line of allReferenceWalls) {
                            let pts = line.getAttr('refPts') || line.points();
                            if (pts && pts.length === 4) {
                                let d1 = Math.hypot(pos.x - pts[0], pos.y - pts[1]); let d2 = Math.hypot(pos.x - pts[2], pos.y - pts[3]);
                                if (d1 < 40 && d1 < closestDist) { closestDist = 0; closestPoint = {x: pts[0], y: pts[1]}; targetSnapWall = null; }
                                else if (d2 < 40 && d2 < closestDist) { closestDist = 0; closestPoint = {x: pts[2], y: pts[3]}; targetSnapWall = null; }
                                else { let proj = this.getClosestPointOnSegment(pos, {x: pts[0], y: pts[1]}, {x: pts[2], y: pts[3]}); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); if (dist < closestDist) { closestDist = dist; closestPoint = proj; targetSnapWall = null; } }
                            }
                        }
    
                        if (this.shapes) {
                            for (let s of this.shapes) {
                                if (s.type !== 'shape_rect' && s.type !== 'shape_floor_cut' && s.type !== 'shape_polygon') continue;
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
            } 
            
            if (this.drawing && wallConfig && wallConfig.events.includes("stop_collision") && this.checkWallIntersection(this.lastAnchor.position(), targetPos, [targetSnapWall])) return; 
            
            
            const currentAnchor = this.getOrCreateAnchor(targetPos.x, targetPos.y); 
            if (!this.drawing) { 
                this.drawing = true; 
                this.lastAnchor = currentAnchor; 
                this.startAnchor = currentAnchor; 
                this.currentSessionEntities = []; 
                currentAnchor.show(); 
                if (this.onDrawingChange) this.onDrawingChange(true); 
                this.mainLayer.batchDraw();
            } 
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
                            this.lastDrawnEntity = w;
                            this.currentSessionEntities.push(w);
                            prev = curr;
                        }
                        
                        if (i2 === 0 || i2 === arcNodes.length - 1) reachedArcEnd = true;
                        if (this.tool === 'railing' && ((i1 === 0 && i2 === arcNodes.length - 1) || (i2 === 0 && i1 === arcNodes.length - 1))) {
                            sharedArc.hasRailing = true;
                        }
                    } else {
                        if (this.tool === 'railing') {
                            const w = new PremiumRailing(this, this.lastAnchor, currentAnchor);
                            this.walls.push(w);
                            this.lastDrawnEntity = w;
                            this.currentSessionEntities.push(w);
                        } else {
                            const w = new PremiumWall(this, this.lastAnchor, currentAnchor, this.tool);
                            this.walls.push(w); 
                            this.lastDrawnEntity = w;
                            this.currentSessionEntities.push(w);
                        }
                    }
                }
                if (currentAnchor === this.startAnchor || reachedArcEnd || targetSnapWall) { 
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
            this.lastPlacementTime = Date.now();
            this.syncAll(); 
    };

        this.stage.on("click tap", (e) => {
            if (this.gestureManager && this.gestureManager.isActive()) return;
            let pos = this.getPointerPos();
            let snapPos = { x: this.snap(pos.x), y: this.snap(pos.y) };

            if (this.tool.startsWith('preset_') && PRESET_REGISTRY[this.tool] && this.activePresetParams) {
                const preset = PRESET_REGISTRY[this.tool];
                const alignData = autoAlign(this, snapPos, this.activePresetParams.elevation, this.activePresetParams.depth);
                const group = preset.generate(this, snapPos, this.activePresetParams, alignData);
                this.syncAll();
                this.updateToolStates();
                this.tool = 'select';
                if (this.presetPreview) { this.presetPreview.visible(false); }
                if (this.onToolChange) this.onToolChange('select');
                if (group) {
                    this.selectEntity(group, 'preset_group');
                }
                return;
            }

            const isTouch = e.evt && (e.evt.changedTouches || e.evt.pointerType === 'touch');
            const isWallTool = ['outer', 'inner', 'railing'].includes(this.tool);

            if (isTouch && isWallTool && this.mobileDrawState === 'ChainWaiting') {
                const scale = this.stage.scaleX() || 1;
                const activeSnapDist = 20 / scale;
                let tappedEntity = false;

                // Don't treat a tap on the lastAnchor (red handle) as a room closure
                if (this.lastAnchor && Math.hypot(pos.x - this.lastAnchor.x, pos.y - this.lastAnchor.y) < activeSnapDist * 2) {
                    return; 
                }

                if (this.startAnchor && Math.hypot(pos.x - this.startAnchor.x, pos.y - this.startAnchor.y) < activeSnapDist * 3) {
                    tappedEntity = true;
                } else if (this.anchors.some(a => a !== this.lastAnchor && Math.hypot(a.x - pos.x, a.y - pos.y) < activeSnapDist * 1.5)) {
                    tappedEntity = true;
                } else {
                    for (let w of this.walls) {
                        let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                        if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < activeSnapDist) {
                            tappedEntity = true; break;
                        }
                    }
                }

                if (tappedEntity) {
                    this._executePointerDownLogic(e, pos, true);
                    this.preview?.destroy(); this.preview = null;
                    this.hideInfoBadge();
                    this.hideSnapGlow();
                    if (this.smartGuides) this.smartGuides.clear();
                    if (this.drawing) {
                        this.mobileDrawState = 'ChainWaiting';
                    } else {
                        this.mobileDrawState = 'Idle';
                    }
                    this.uiLayer.batchDraw();
                    return;
                }
            }
        });

        this.stage.on("mousemove touchmove", (e) => {
            const _isTouchMove = e.evt && (e.evt.touches || e.evt.pointerType === 'touch');
            if (_isTouchMove && this._touchDrawTimer) { this._touchDrawCancelled = true; }
            if (e.evt && e.evt.touches && e.evt.touches.length > 1) return;
            if (this.gestureManager && this.gestureManager.isActive()) return;
            
            const isWallTool = ['outer', 'inner', 'railing'].includes(this.tool);
            if (_isTouchMove && isWallTool && (this.mobileDrawState === 'ChainWaiting' || this.mobileIsPanning)) return;
            if (this.tool === 'roof') return;

            if (e.target === this.stage || e.target === this.bgLayer || e.target === this.mainLayer) {
                document.body.style.cursor = ''; 
                this.stage.container().style.cursor = this.tool === 'select' ? (this.stage.isDragging() ? 'grabbing' : 'grab') : 'crosshair';
            }

            let pos = this.getPointerPos(e);
            if (!pos) return;
            let rawPos = { x: this.snap(pos.x), y: this.snap(pos.y) };
            // Smart Snapping Edge-Specific Highlight for Placement Tools
            const isAdvancedOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(this.tool);
            const isMolding = !!MOLDING_REGISTRY[this.tool];
            const isWidget = !!WIDGET_REGISTRY[this.tool];
            const isPlacementTool = isWidget || isAdvancedOpening || isMolding;

            if (isPlacementTool) {
                let closestWall = null;
                let minWallDist = 60 / (this.stage.scaleX() || 1); // Dynamic snap distance based on zoom
                let closestFace = null;
                
                // Hide all highlights first
                this.walls.forEach(w => {
                    if (w.frontHighlight) w.frontHighlight.visible(false);
                    if (w.backHighlight) w.backHighlight.visible(false);
                });
                
                for (let w of this.walls) {
                    const start = w.startAnchor.position();
                    const end = w.endAnchor.position();
                    const proj = this.getClosestPointOnSegment(pos, start, end);
                    const dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    
                    if (dist < minWallDist) {
                        closestWall = w;
                        minWallDist = dist;
                        const dx = end.x - start.x;
                        const dy = end.y - start.y;
                        const cp = (pos.x - start.x) * dy - (pos.y - start.y) * dx;
                        closestFace = cp > 0 ? 'back' : 'front';
                    }
                }
                
                if (closestWall) {
                    if (closestFace === 'front' && closestWall.frontHighlight) closestWall.frontHighlight.visible(true);
                    else if (closestWall.backHighlight) closestWall.backHighlight.visible(true);
                }
                this.mainLayer.batchDraw();
                return;
            }
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

            if (this.tool.startsWith('preset_') && PRESET_REGISTRY[this.tool] && this.activePresetParams) {
                if (!this.presetPreview) {
                    this.presetPreview = new Konva.Shape({ stroke: '#4f46e5', strokeWidth: 2, fill: 'rgba(79, 70, 229, 0.2)', dash: [5, 5] });
                    this.presetPreview.sceneFunc((ctx, shape) => {
                        const preset = PRESET_REGISTRY[this.tool];
                        if (preset && preset.icon2d && this.activePresetParams) {
                            preset.icon2d(ctx, this.activePresetParams.width || 200, this.activePresetParams.depth || 200);
                        }
                    });
                    this.uiLayer.add(this.presetPreview);
                }
                const alignData = autoAlign(this, rawPos, this.activePresetParams.elevation, this.activePresetParams.depth);
                this.presetPreview.position(rawPos);
                this.presetPreview.rotation(alignData.rotation);
                
                this.presetPreview.visible(true);
                this.presetPreview.sceneFunc((ctx, shape) => {
                    const preset = PRESET_REGISTRY[this.tool];
                    if (preset && preset.icon2d && this.activePresetParams) {
                        preset.icon2d(ctx, this.activePresetParams.width || 200, this.activePresetParams.depth || 200);
                    }
                });
                this.uiLayer.batchDraw();
                return;
            } else if (this.presetPreview && this.presetPreview.visible()) {
                this.presetPreview.visible(false);
                this.uiLayer.batchDraw();
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
                        if (s.type !== 'shape_rect' && s.type !== 'shape_floor_cut' && s.type !== 'shape_polygon') continue;
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
                if (this.drawingArc && this.drawingArc.isFrozen) return;
                const isTouch = e.evt && (e.evt.touches || e.evt.pointerType === 'touch');
                const scale = this.stage.scaleX() || 1;
                let activeSnapDist = isTouch ? (SNAP_DIST * 1.5) / scale : SNAP_DIST / scale;
                
                let snap = rawPos;
                let closestDist = activeSnapDist;
                let snappedObj = false;
                let targetSnapWall = null;

                if (isTouch && this.lastStickyArcSnap) {
                    const dragDist = Math.hypot(pos.x - this.lastStickyArcSnap.rawPos.x, pos.y - this.lastStickyArcSnap.rawPos.y);
                    if (dragDist < 25) {
                        snap = { x: this.lastStickyArcSnap.snapPos.x, y: this.lastStickyArcSnap.snapPos.y };
                        snappedObj = true;
                        targetSnapWall = this.lastStickyArcSnap.wall;
                        closestDist = 0;
                    } else {
                        this.lastStickyArcSnap = null;
                    }
                }

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
                    if (!snappedObj) snap = rawPos;
                }

                if (closestDist > 0) {
                    let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < activeSnapDist);
                    if (a) { snap = { x: a.x, y: a.y }; closestDist = Math.hypot(a.x - pos.x, a.y - pos.y); snappedObj = true; }

                    for (let w of this.walls) {
                        let proj = this.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                        let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                        if (dist < closestDist) { closestDist = dist; snap = proj; snappedObj = true; targetSnapWall = w; }
                    }
                }
                
                if (isTouch && snappedObj && !this.lastStickyArcSnap) {
                    this.lastStickyArcSnap = { rawPos: { x: pos.x, y: pos.y }, snapPos: { x: snap.x, y: snap.y }, wall: targetSnapWall };
                }

                if (snappedObj && (!this.drawingArc || this.drawingArc.state === 1)) {
                    this.showSnapGlow(snap.x, snap.y);
                } else {
                    this.hideSnapGlow();
                }
                
                this.walls.forEach(w => w.setHighlight(w === this.selectedEntity || (w.parentArc && w.parentArc === this.selectedEntity)));
                
                if (this.drawingArc && this.drawingArc.state === 1) {
                    this.arcMousePos = snap;
                }
                
                if (this.drawingArc && this.arcPreview) {
                    if (this.drawingArc.state === 1) {
                        this.arcPreview.lineBase.points([this.drawingArc.p1.x, this.drawingArc.p1.y, snap.x, snap.y]);
                        this.arcPreview.lineBase.visible(true);
                        this.arcPreview.ghostCircle.visible(false);
                        this.arcPreview.angleFill.visible(false);
                        this.arcPreview.radiusLines.visible(false);
                        this.arcPreview.guideLine.visible(false);
                        this.arcPreview.arcCurve.visible(false);
                        
                        let dxBadge = snap.x - this.drawingArc.p1.x, dyBadge = snap.y - this.drawingArc.p1.y;
                        let lenBadge = this.formatLength(Math.hypot(dxBadge, dyBadge));
                        let angBadge = Math.abs(Math.atan2(dyBadge, dxBadge) * 180 / Math.PI).toFixed(1);
                        this.updateInfoBadge(snap.x, snap.y, lenBadge, angBadge, snappedObj);
                    } else if (this.drawingArc.state === 2) {
                        this.updateArcPreviewState2(this.arcMousePos);
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
            const isTouch = e && e.type && (e.type.startsWith('touch') || e.pointerType === 'touch');
            const activeSnapDist = isTouch ? SNAP_DIST * 1.4 : SNAP_DIST;

            if (wallConfig && wallConfig.events.includes("snap_to_wall")) { 
                let closestDist = activeSnapDist;

                if (isTouch && this.lastStickySnap && Math.hypot(pos.x - this.lastStickySnap.rawPos.x, pos.y - this.lastStickySnap.rawPos.y) < activeSnapDist * 1.1) {
                    snapPos = { x: this.lastStickySnap.snapPos.x, y: this.lastStickySnap.snapPos.y };
                    targetSnapWall = this.lastStickySnap.wall;
                    snappedObj = true;
                    closestDist = 0;
                } else {
                    this.lastStickySnap = null;
                }

                if (closestDist > 0) {
                    let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < activeSnapDist); 
                    if (a) { snapPos = { x: a.x, y: a.y }; targetSnapWall = this.walls.find(w => w.startAnchor === a || w.endAnchor === a); snappedObj = true; } 
                    else { 
                        let closestPoint = null; 
    
                        let allReferenceWalls = this.referenceGroup ? this.referenceGroup.getChildren() : [];
                        for (let line of allReferenceWalls) {
                            let pts = line.getAttr('refPts') || line.points();
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
                                if (s.type !== 'shape_rect' && s.type !== 'shape_floor_cut' && s.type !== 'shape_polygon') continue;
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

                if (isTouch && snappedObj) {
                    this.lastStickySnap = { rawPos: { x: pos.x, y: pos.y }, snapPos: { x: snapPos.x, y: snapPos.y }, wall: targetSnapWall };
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

            if (snappedObj) { this.showSnapGlow(snapPos.x, snapPos.y, isTouch); } else { this.hideSnapGlow(); }

            this.walls.forEach(w => {
                let isHigh = (w === this.selectedEntity || (w.parentArc && w.parentArc === this.selectedEntity));
                const isDrawingTool = ['wall', 'room', 'railing', 'arc', 'shape_rect', 'shape_circle', 'shape_triangle', 'roof'].includes(this.tool);
                if (!isHigh && w === targetSnapWall && !isDrawingTool) {
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
            if (isTouch) previewThickness = Math.max(previewThickness, 8);
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
            const wasPanning = this.mobileIsPanning;
            this.mobileIsPanning = false;
            
            const isTouchRelease = e.evt && (e.evt.changedTouches || e.evt.pointerType === 'touch');
            const isWallTool = ['outer', 'inner', 'railing'].includes(this.tool);

            const pos = this.getPointerPos(e) || this.lastRawTouchPos;

            if (isTouchRelease && isWallTool && this.mobileDrawState === 'PreviewDrawing') {
                if (pos && this.lastAnchor) {
                    const dist = Math.hypot(pos.x - this.lastAnchor.x, pos.y - this.lastAnchor.y);
                    const scale = this.stage.scaleX() || 1;
                    if (dist < 25 / scale) {
                        this.mobileDrawState = 'ChainWaiting';
                        this.preview?.destroy();
                        this.preview = null;
                        this.hideInfoBadge();
                        this.hideSnapGlow();
                        this.uiLayer.batchDraw();
                        return;
                    }
                    this._executePointerDownLogic(e, pos, true);
                    this.preview?.destroy(); this.preview = null;
                    this.hideInfoBadge();
                    this.hideSnapGlow();
                    if (this.smartGuides) this.smartGuides.clear();
                    if (this.drawing) {
                        this.mobileDrawState = 'ChainWaiting';
                    }
                } else {
                    if (this.drawing) {
                        this.mobileDrawState = 'ChainWaiting';
                    }
                }
                return;
            }

            if (this.tool === 'arc' && this.drawingArc && this.drawingArc.state === 2) {
                if (isTouchRelease) {
                    this.drawingArc.isFrozen = true;
                    this.drawingArc.frozenPos = { ...this.arcMousePos };
                }
            }

            if (this.drawingShapeType) {
                if (this.drawingShapeType === 'shape_rect') {
                    const targetPos = this.getPointerPos(e);
                    const cx = (this.shapeStartPos.x + targetPos.x) / 2;
                    const cy = (this.shapeStartPos.y + targetPos.y) / 2;
                    const w = targetPos.x - this.shapeStartPos.x;
                    const h = targetPos.y - this.shapeStartPos.y;
                    if (Math.abs(w) > 5 && Math.abs(h) > 5) {
                        const newShape = new PremiumShape(this, 'shape_rect', { 
                            x: cx, y: cy, width: Math.abs(w), height: Math.abs(h)
                        });
                        if (!this.shapes) this.shapes = []; this.shapes.push(newShape); this.tool = 'select'; this.updateToolStates(); if (this.onToolChange) this.onToolChange('select'); this.selectEntity(newShape, 'shape');
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

            if (this.tool !== 'roof' && this.tool !== 'shape_floor_cut') return;
            
            let snap = pos;
            let closestDist = SNAP_DIST * 2.5; // Stronger snapping for roof outer edges
            
            let allReferenceWalls = this.referenceGroup ? this.referenceGroup.getChildren() : [];
            for (let line of allReferenceWalls) {
                let pts = line.getAttr('refPts') || line.points();
                if (pts && pts.length >= 4) {
                    for (let i = 0; i < pts.length; i += 2) {
                        let cx = pts[i], cy = pts[i+1];
                        if (Math.hypot(pos.x - cx, pos.y - cy) < closestDist) { closestDist = Math.hypot(pos.x - cx, pos.y - cy); snap = {x: cx, y: cy}; }
                        let nx = pts[(i+2)%pts.length], ny = pts[(i+3)%pts.length];
                        let proj = this.getClosestPointOnSegment(pos, {x: cx, y: cy}, {x: nx, y: ny});
                        let distSeg = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                        if (distSeg < closestDist) { closestDist = distSeg; snap = proj; }
                    }
                }
            }

            // ADD WALL SNAPPING TO MOUSEDOWN
            for (let w of this.walls) {
                if (typeof w.getExactPolygonPoints === 'function') {
                    const pts = w.getExactPolygonPoints();
                    if (pts && pts.length >= 4) {
                        for (let i = 0; i < pts.length; i += 2) {
                            let cx = pts[i], cy = pts[i+1];
                            let distCorner = Math.hypot(pos.x - cx, pos.y - cy);
                            if (distCorner < closestDist) { closestDist = distCorner; snap = {x: cx, y: cy}; }
                            
                            let nx = pts[(i+2)%pts.length], ny = pts[(i+3)%pts.length];
                            let proj = this.getClosestPointOnSegment(pos, {x: cx, y: cy}, {x: nx, y: ny});
                            let distSeg = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                            if (distSeg < closestDist) { closestDist = distSeg; snap = proj; }
                        }
                    }
                } else {
                    const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                    let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y); let d2 = Math.hypot(pos.x - p2.x, pos.y - p2.y);
                    if (d1 < closestDist) { closestDist = d1; snap = p1; }
                    if (d2 < closestDist) { closestDist = d2; snap = p2; }
                    let proj = this.getClosestPointOnSegment(pos, p1, p2); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    if (dist < closestDist) { closestDist = dist; snap = proj; }
                }
            }
            
            if (!this.drawingRoofPoints) {
                this.drawingRoofPoints = [snap];
                this.roofPreviewGroup = new Konva.Group();
                this.roofPreview = new Konva.Line({ 
                    points: [snap.x, snap.y, snap.x, snap.y], 
                    stroke: this.tool === 'shape_floor_cut' ? '#ef4444' : 'rgba(148, 163, 184, 0.5)', 
                    strokeWidth: this.tool === 'shape_floor_cut' ? 4 : 2, 
                    fill: this.tool === 'shape_floor_cut' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(226, 232, 240, 0.4)',
                    closed: true
                });
                this.roofPreviewGroup.add(this.roofPreview);
                const startCircle = new Konva.Circle({ x: snap.x, y: snap.y, radius: 6, fill: '#334155', stroke: 'white', strokeWidth: 1.5 });
                this.roofPreviewGroup.add(startCircle);
                this.uiLayer.add(this.roofPreviewGroup);
                this.uiLayer.batchDraw();
            } else {
                const startP = this.drawingRoofPoints[0];
                if (Math.hypot(snap.x - startP.x, snap.y - startP.y) < SNAP_DIST && this.drawingRoofPoints.length > 2) {
                    
                    if (this.tool === 'shape_floor_cut') {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        this.drawingRoofPoints.forEach(p => {
                            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                        });
                        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
                        const w = maxX - minX, h = maxY - minY;
                        
                        const relPts = this.drawingRoofPoints.map(p => ({ x: p.x - cx, y: p.y - cy }));
                        
                        const newShape = new PremiumShape(this, 'shape_floor_cut', { 
                            x: cx, y: cy, width: w, height: h, points: relPts,
                            stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.2)'
                        });
                        if (!this.shapes) this.shapes = []; this.shapes.push(newShape);
                        this.selectEntity(newShape, 'shape');
                    } else {
                        const roof = new PremiumHipRoof(this, this.drawingRoofPoints);
                        roof.config.roofType = this.currentRoofToolType || 'hip';
                        this.roofs.push(roof); this.selectEntity(roof, 'roof');
                    }
                    
                    this.drawingRoofPoints = null; 
                    if (this.roofPreviewGroup) { this.roofPreviewGroup.destroy(); this.roofPreviewGroup = null; }
                    else if (this.roofPreview) { this.roofPreview.destroy(); }
                    this.roofPreview = null;
                    if (this.roofCloseTick) { this.roofCloseTick.destroy(); this.roofCloseTick = null; }
                    this.tool = 'select'; this.updateToolStates(); this.syncAll();
                    if (this.onToolChange) this.onToolChange(this.tool);
                } else {
                    this.drawingRoofPoints.push(snap);
                    if (this.roofPreviewGroup) {
                        const newCircle = new Konva.Circle({ x: snap.x, y: snap.y, radius: 4, fill: '#334155', stroke: 'white', strokeWidth: 1.5 });
                        this.roofPreviewGroup.add(newCircle);
                    }
                    const pts = this.drawingRoofPoints.flatMap(p => [p.x, p.y]); pts.push(snap.x, snap.y);
                    this.roofPreview.points(pts);
                    this.uiLayer.batchDraw();
                }
            }
        });

        this.stage.on("mousemove.roof touchmove.roof", (e) => {
            if (e && e.evt && e.evt.touches && e.evt.touches.length > 1) return;

            if (this.tool === 'roof' || this.tool === 'shape_floor_cut') {
                const pos = this.getPointerPos(e);
                if (!pos) return;
                
                let snap = pos; 
                let closestDist = SNAP_DIST * 2.5; // Stronger snapping for roof outer edges
                let snappedObj = false;
                let targetSnapWall = null;

                let allReferenceWalls = this.referenceGroup ? this.referenceGroup.getChildren() : [];
                for (let line of allReferenceWalls) {
                    let pts = line.getAttr('refPts') || line.points();
                    if (pts && pts.length >= 4) {
                        for (let i = 0; i < pts.length; i += 2) {
                            let cx = pts[i], cy = pts[i+1];
                            if (Math.hypot(pos.x - cx, pos.y - cy) < closestDist) { closestDist = Math.hypot(pos.x - cx, pos.y - cy); snap = {x: cx, y: cy}; snappedObj = true; }
                            
                            let nx = pts[(i+2)%pts.length], ny = pts[(i+3)%pts.length];
                            let proj = this.getClosestPointOnSegment(pos, {x: cx, y: cy}, {x: nx, y: ny});
                            let distSeg = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                            if (distSeg < closestDist) { closestDist = distSeg; snap = proj; snappedObj = true; }
                        }
                    }
                }

                if (!snappedObj) {
                    for (let w of this.walls) {
                        if (typeof w.getExactPolygonPoints === 'function') {
                            const pts = w.getExactPolygonPoints();
                            if (pts && pts.length >= 4) {
                                for (let i = 0; i < pts.length; i += 2) {
                                    let cx = pts[i], cy = pts[i+1];
                                    if (Math.hypot(pos.x - cx, pos.y - cy) < closestDist) { closestDist = Math.hypot(pos.x - cx, pos.y - cy); snap = {x: cx, y: cy}; snappedObj = true; }
                                    let nx = pts[(i+2)%pts.length], ny = pts[(i+3)%pts.length];
                                    let proj = this.getClosestPointOnSegment(pos, {x: cx, y: cy}, {x: nx, y: ny});
                                    if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < closestDist) { closestDist = Math.hypot(pos.x - proj.x, pos.y - proj.y); snap = proj; snappedObj = true; }
                                }
                            }
                        } else {
                            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                            let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y); let d2 = Math.hypot(pos.x - p2.x, pos.y - p2.y);
                            if (d1 < closestDist) { closestDist = d1; snap = p1; snappedObj = true; }
                            if (d2 < closestDist) { closestDist = d2; snap = p2; snappedObj = true; }
                            let proj = this.getClosestPointOnSegment(pos, p1, p2); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                            if (dist < closestDist) { closestDist = dist; snap = proj; snappedObj = true; }
                        }
                    }
                    if (!snappedObj) {
                        let a = this.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < closestDist);
                        if (a) { snap = { x: a.x, y: a.y }; snappedObj = true; }
                    }
                }
                let isClosing = false;
                if (this.drawingRoofPoints && this.drawingRoofPoints.length > 2) {
                    const startP = this.drawingRoofPoints[0];
                    if (Math.hypot(pos.x - startP.x, pos.y - startP.y) < SNAP_DIST) {
                        snap = { x: startP.x, y: startP.y };
                        snappedObj = true;
                        isClosing = true;
                    }
                }
                
                if (isClosing) {
                    if (!this.roofCloseTick) {
                        this.roofCloseTick = new Konva.Group({ visible: false });
                        this.roofCloseTick.add(new Konva.Circle({ radius: 12, fill: '#10b981', stroke: 'white', strokeWidth: 2, shadowColor: 'black', shadowBlur: 4, shadowOpacity: 0.3 }));
                        this.roofCloseTick.add(new Konva.Path({ data: 'M-4,1 L-1,4 L5,-3', stroke: 'white', strokeWidth: 2.5, lineCap: 'round', lineJoin: 'round' }));
                        this.uiLayer.add(this.roofCloseTick);
                    }
                    this.roofCloseTick.position({ x: snap.x, y: snap.y });
                    this.roofCloseTick.visible(true);
                    this.roofCloseTick.moveToTop();
                    this.hideSnapGlow();
                } else {
                    if (this.roofCloseTick) this.roofCloseTick.visible(false);
                    if (snappedObj) { this.showSnapGlow(snap.x, snap.y); } else { this.hideSnapGlow(); }
                }

                if (this.drawingRoofPoints && this.roofPreview) {
                    const pts = this.drawingRoofPoints.flatMap(p => [p.x, p.y]); pts.push(snap.x, snap.y);
                    this.roofPreview.points(pts);
                }
                
                document.body.style.cursor = 'crosshair'; this.mainLayer.batchDraw(); this.uiLayer.batchDraw();
            } else {
                if (this.drawingRoofPoints) { this.drawingRoofPoints = null; if (this.roofPreviewGroup) { this.roofPreviewGroup.destroy(); this.roofPreviewGroup = null; } else if (this.roofPreview) { this.roofPreview.destroy(); } this.roofPreview = null; }
                if (this.roofCloseTick) { this.roofCloseTick.destroy(); this.roofCloseTick = null; }
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
        this.updateRoofAutoPlacement();
        if (this.bgLayer) this.bgLayer.batchDraw();
    }

    updateRoofAutoPlacement() {
        if (!this.roofs || this.roofs.length === 0) return;
        
        let globalPerimeter = null;
        if (this.roomPaths && this.roomPaths.length > 0) {
            const edgeCounts = new Map();
            const getEdgeKey = (p1, p2) => `${Math.round(p1.x)},${Math.round(p1.y)}->${Math.round(p2.x)},${Math.round(p2.y)}`;
            
            this.roomPaths.forEach(path => {
                for (let i = 0; i < path.length; i++) {
                    const p1 = path[i];
                    const p2 = path[(i + 1) % path.length];
                    const key = getEdgeKey(p1, p2);
                    edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
                }
            });
            
            const boundaryEdges = [];
            this.roomPaths.forEach(path => {
                for (let i = 0; i < path.length; i++) {
                    const p1 = path[i];
                    const p2 = path[(i + 1) % path.length];
                    const reverseKey = getEdgeKey(p2, p1);
                    if (!edgeCounts.has(reverseKey)) {
                        boundaryEdges.push({ p1, p2 });
                    }
                }
            });
            
            if (boundaryEdges.length > 0) {
                const polygon = [];
                let currentEdge = boundaryEdges[0];
                polygon.push(currentEdge.p1);
                
                let safety = 0;
                while (safety < boundaryEdges.length * 2) {
                    polygon.push(currentEdge.p2);
                    boundaryEdges.splice(boundaryEdges.indexOf(currentEdge), 1);
                    
                    const nextEdge = boundaryEdges.find(e => Math.hypot(e.p1.x - currentEdge.p2.x, e.p1.y - currentEdge.p2.y) < 2);
                    if (!nextEdge) break;
                    
                    currentEdge = nextEdge;
                    if (Math.hypot(currentEdge.p2.x - polygon[0].x, currentEdge.p2.y - polygon[0].y) < 2) {
                        break;
                    }
                    safety++;
                }
                globalPerimeter = polygon;
            }
        }
        
        if (!globalPerimeter || globalPerimeter.length < 3) return;
        
        this.roofs.forEach(roof => {
            const mode = roof.config?.autoPlacementMode || 'manual';
            if (mode === 'manual') return;
            
            const offset = 5; // Half of typical wall thickness
            
            let finalPolygon = [];
            if (mode === 'center') {
                finalPolygon = globalPerimeter.map(p => ({x: p.x, y: p.y}));
            } else if (mode === 'outer') {
                finalPolygon = offsetPolygon(globalPerimeter, offset);
            } else if (mode === 'inner') {
                finalPolygon = offsetPolygon(globalPerimeter, -offset);
            }
            
            if (finalPolygon && finalPolygon.length >= 3) {
                roof.points = finalPolygon;
                if (roof.updateGeometry) roof.updateGeometry();
            }
        });
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
        const safeRemove = (obj) => { if (obj) { if (typeof obj.remove === 'function') obj.remove(); else if (typeof obj.destroy === 'function') obj.destroy(); } };
        [...this.walls].forEach(safeRemove); [...this.furniture].forEach(safeRemove); [...this.stairs].forEach(safeRemove); [...this.roofs].forEach(safeRemove); 
        if (this.balconies) [...this.balconies].forEach(safeRemove);
        if (this.arcs) [...this.arcs].forEach(safeRemove);
        if (this.shapes) [...this.shapes].forEach(safeRemove);
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
                id: w.id,
                startAnchorId: w.startAnchor._id, endAnchorId: w.endAnchor._id,
                startX: w.startAnchor.x, startY: w.startAnchor.y, endX: w.endAnchor.x, endY: w.endAnchor.y, thickness: w.thickness || w.config.thickness, height: w.height !== undefined ? w.height : (w.config?.height || 180), type: w.type, configId: w.configId,
                hidden: w.hidden,
                description: w.description,
                topProfileType: w.topProfileType, flipSlope: w.flipSlope, startHeight: w.startHeight, peakHeight: w.peakHeight, endHeight: w.endHeight,
                isAutoGable: w.isAutoGable, parentWallId: w.parentWallId, parentRoofId: w.parentRoofId, elevation: w.elevation,
                pts: typeof w.getExactPolygonPoints === 'function' ? w.getExactPolygonPoints() : (w.poly ? w.poly.points() : null),
                bevels: w.wallShapeData ? { start: w.wallShapeData.startData, end: w.wallShapeData.endData } : null,
                elevationLayers: w.elevationLayers,
                widgets: w.attachedWidgets.map(wid => ({ 
                    t: wid.t, type: wid.type, configId: wid.type, width: wid.width, height: wid.height, depth: wid.depth, elevation: wid.elevation,
                    facing: wid.facing, side: wid.side, 
                    rows: wid.rows, cols: wid.cols, spacing: wid.spacing, patternStyle: wid.patternStyle, decorConfigId: wid.decorConfigId,
                    doorType: wid.doorType, doorMat: wid.doorMat, 
                    windowType: wid.windowType, frameMat: wid.frameMat, glassMat: wid.glassMat, grillePattern: wid.grillePattern,
                    description: wid.description,
                    params: wid.params || {}
                })),
                decors: w.attachedDecor ? w.attachedDecor.map(d => ({ id: d.id, configId: d.configId, side: d.side, localX: d.localX, localY: d.localY, localZ: d.localZ, width: d.width, height: d.height, depth: d.depth, tileSize: d.tileSize, faces: { front: d.faces.front, back: d.faces.back, left: d.faces.left, right: d.faces.right } })) : [],
                moldings: w.attachedMoldings ? w.attachedMoldings.map(m => ({ t: m.t, type: m.type, configId: m.type, width: m.width, depth: m.depth, heightOffset: m.heightOffset, side: m.side, profileType: m.profileType, material: m.material, color: m.color, layers: m.layers, layerGap: m.layerGap, grooveWidth: m.grooveWidth, frameWidth: m.frameWidth })) : [],
                params: w.params || {}
            })),
            furniture: this.furniture.map(f => ({ x: f.group.x(), y: f.group.y(), rotation: f.rotation, width: f.width, depth: f.depth, height: f.height, configId: f.config.id, description: f.description })),
            stairs: this.stairs.map(s => {
                if (s.type === 'stair_v4_flight' || s.type === 'stair_v4_landing') {
                    return { type: s.type, x: s.x, y: s.y, rotation: s.rotation, elevation: s.elevation, direction: s.direction, stepCount: s.stepCount, stepDepth: s.stepDepth, stepHeight: s.stepHeight, width: s.width, length: s.length, shape: s.shape, innerRadius: s.innerRadius, systemId: s.systemId, id: s.id, description: s.description, connections: s.connections ? JSON.parse(JSON.stringify(s.connections)) : [] };
                } else if (s.type.startsWith('stair_v5_')) {
                    return { 
                        type: s.type, shape: s.shape, x: s.x, y: s.y, rotation: s.rotation, elevation: s.elevation, direction: s.direction, 
                        width: s.width, stepDepth: s.stepDepth, stepHeight: s.stepHeight, totalSteps: s.totalSteps, 
                        flight1Steps: s.flight1Steps, flight2Steps: s.flight2Steps, turnDirection: s.turnDirection, 
                        landingSize: s.landingSize, gapWidth: s.gapWidth, id: s.id, description: s.description,
                        hasTopLanding: s.hasTopLanding, hasBottomLanding: s.hasBottomLanding,
                        stringerType: s.stringerType, stringerWidth: s.stringerWidth, stringerThickness: s.stringerThickness,
                        beamOffset: s.beamOffset, landingSupports: s.landingSupports, columnSupports: s.columnSupports,
                        railingLayout: s.railingLayout, linkRailings: s.linkRailings,
                        leftRailing: JSON.parse(JSON.stringify(s.leftRailing)),
                        rightRailing: JSON.parse(JSON.stringify(s.rightRailing)),
                        useUnifiedMaterial: s.useUnifiedMaterial, primaryMaterial: s.primaryMaterial, primaryColor: s.primaryColor,
                        treadMaterial: s.treadMaterial, treadColor: s.treadColor,
                        riserMaterial: s.riserMaterial, riserColor: s.riserColor,
                        landingMaterial: s.landingMaterial, landingColor: s.landingColor,
                        structureMaterial: s.structureMaterial, structureColor: s.structureColor
                    };
                }
            }),
            roofs: this.roofs.map(r => ({ id: r.id, x: r.group.x(), y: r.group.y(), rotation: r.rotation, elevation: r.elevation, width: r.config?.width, depth: r.config?.depth, pitch: r.config?.pitch, overhang: r.config?.overhang, thickness: r.config?.thickness, ridgeOffset: r.config?.ridgeOffset, points: r.points, isHip: !!r.points, roofType: r.config?.roofType, material: r.config?.material, configId: r.configId, wallGap: r.config?.wallGap, ridgeAxis: r.config?.ridgeAxis, gableMaterial: r.config?.gableMaterial, autoShapeWalls: r.config?.autoShapeWalls, description: r.description })),
            arcs: this.arcs ? this.arcs.map(a => ({ p1: {x: a.p1.x, y: a.p1.y}, p2: {x: a.p2.x, y: a.p2.y}, pos: a.pos, hasRailing: a.hasRailing, railingConfig: a.railingConfig, hidden: a.hidden, description: a.description })) : [],
            shapes: this.shapes ? this.shapes.map(s => ({ type: s.type, x: s.group.x(), y: s.group.y(), rotation: s.rotation, scaleX: s.group.scaleX(), scaleY: s.group.scaleY(), params: s.params, description: s.description })) : [],
            rooms: this.rooms ? this.rooms.map(r => ({ path: r.path.map(p => ({ x: p.x, y: p.y })), cx: r.cx, cy: r.cy, configId: r.configId, isHidden: r.isHidden, isDeleted: r.isDeleted, materialRepeat: r.materialRepeat, description: r.description })) : [],
            roomPaths: this.roomPaths ? this.roomPaths.map(path => path.map(p => ({ x: p.x, y: p.y }))) : [],
            presetGroups: this.presetGroups ? this.presetGroups.map(g => g.export()) : []
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
                    if (wData.id) wall.id = wData.id;
                    if (wData.thickness) wall.thickness = wData.thickness;
                    if (wData.height) wall.height = wData.height;
                    if (wData.configId) wall.configId = wData.configId;
                    if (wData.hidden !== undefined) wall.hidden = wData.hidden;
                    if (wData.description !== undefined) wall.description = wData.description;
                    if (wData.elevationLayers) wall.elevationLayers = wData.elevationLayers;
                    if (wData.topProfileType !== undefined) wall.topProfileType = wData.topProfileType;
                    if (wData.flipSlope !== undefined) wall.flipSlope = wData.flipSlope;
                    if (wData.startHeight !== undefined) wall.startHeight = wData.startHeight;
                    if (wData.peakHeight !== undefined) wall.peakHeight = wData.peakHeight;
                    if (wData.endHeight !== undefined) wall.endHeight = wData.endHeight;
                    if (wData.isAutoGable !== undefined) wall.isAutoGable = wData.isAutoGable;
                    if (wData.parentWallId !== undefined) wall.parentWallId = wData.parentWallId;
                    if (wData.parentRoofId !== undefined) wall.parentRoofId = wData.parentRoofId;
                    if (wData.elevation !== undefined) wall.elevation = wData.elevation;

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
                    if (wData.moldings) {
                        wData.moldings.forEach(md => {
                            const molding = new PremiumMolding(this, wall, md.t, md.type);
                            if (md.width !== undefined) molding.width = md.width;
                            if (md.depth !== undefined) molding.depth = md.depth;
                            if (md.heightOffset !== undefined) molding.heightOffset = md.heightOffset;
                            if (md.side !== undefined) molding.side = md.side;
                            if (md.profileType !== undefined) molding.profileType = md.profileType;
                            molding.material = md.material;
                            molding.color = md.color;
                            if (md.layers !== undefined) molding.layers = md.layers;
                            if (md.layerGap !== undefined) molding.layerGap = md.layerGap;
                            if (md.grooveWidth !== undefined) molding.grooveWidth = md.grooveWidth;
                            if (md.frameWidth !== undefined) molding.frameWidth = md.frameWidth;
                            if (!wall.attachedMoldings) wall.attachedMoldings = [];
                            wall.attachedMoldings.push(molding);
                        });
                    }
                    if (wData.decors) { wall.attachedDecor = JSON.parse(JSON.stringify(wData.decors)); }
                    if (wData.params) { wall.params = JSON.parse(JSON.stringify(wData.params)); }
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
                state.stairs.forEach(sData => { if (sData.type === 'stair_v4_flight') {
                        const stairV4 = new StairV4Flight(this, sData);
                        this.stairs.push(stairV4);
                    } else if (sData.type === 'stair_v4_landing') {
                        const landingV4 = new StairV4Landing(this, sData);
                        landingV4.systemId = sData.systemId || landingV4.systemId;
                        this.stairs.push(landingV4);
                    } else if (sData.type.startsWith('stair_v5_')) {
                        const stairV5 = new PremiumStaircase(this, sData.shape, sData);
                        this.stairs.push(stairV5);
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
                    if(rData.elevation !== undefined) roof.elevation = rData.elevation;
                    if(roof.config) { roof.config.pitch = rData.pitch; roof.config.overhang = rData.overhang; roof.config.thickness = rData.thickness; roof.config.ridgeOffset = rData.ridgeOffset; roof.config.roofType = rData.roofType || 'hip'; roof.config.material = rData.material || 'dark_asphalt_roof'; roof.config.wallGap = rData.wallGap || 0; roof.config.ridgeAxis = rData.ridgeAxis || 'x'; roof.config.gableMaterial = rData.gableMaterial || 'white_plaster_wall'; roof.config.autoShapeWalls = !!rData.autoShapeWalls; }
                    if (rData.id) roof.id = rData.id;
                    if (rData.configId !== undefined) roof.configId = rData.configId;
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
            if (state.presetGroups) {
                if (!this.presetGroups) this.presetGroups = [];
                state.presetGroups.forEach(gData => {
                    const group = new PresetGroup(this, gData.typeId, gData.params, gData.origin, gData.rotation);
                    group.id = gData.id;
                    if (gData.wallIds) group.walls = this.walls.filter(w => gData.wallIds.includes(w.id));
                    if (gData.roofIds) group.roofs = this.roofs.filter(r => gData.roofIds.includes(r.id));
                    if (gData.anchorIds) group.anchors = this.anchors.filter(a => gData.anchorIds.includes(a._id || a.id));
                    
                    group.walls.forEach(w => w.parentGroup = group);
                    group.roofs.forEach(r => r.parentGroup = group);
                    group.anchors.forEach(a => a.parentGroup = group);
                    
                    this.presetGroups.push(group);
                });
            }
            // Auto-solve all stairs to repair any corrupted elevations/positions from old bugs
            if (this.stairs && this.stairs.length > 0) {
                setTimeout(() => {
                    this.stairs.forEach(s => {
                        try { StaircaseV4Solver.solve(this, s.systemId, s.id); } catch(e) {}
                    });
                    this.syncAll();
                }, 50);
            }
            this.syncAll();
        } catch (e) { console.error("Failed to import internal state", e); }
    }

    clearReferenceBackground() { if (this.referenceGroup) { this.referenceGroup.destroy(); this.referenceGroup = null; if (this.bgLayer) this.bgLayer.batchDraw(); } }
    loadReferenceBackground(jsonStr) {
        this.clearReferenceBackground();
        if (!jsonStr) return;
        this.referenceGroup = new Konva.Group({ opacity: 0.6, listening: false });
        this.referenceLayer.add(this.referenceGroup);
        try {
            const state = JSON.parse(jsonStr);
            if (state && state.walls) {
                state.walls.forEach(wData => {
                    let shape;
                    if (wData.pts && wData.pts.length > 4) {
                        shape = new Konva.Line({ points: wData.pts, fill: '#cbd5e1', stroke: '#94a3b8', strokeWidth: 1, closed: true, lineJoin: 'miter', lineCap: 'square' });
                    } else {
                        shape = new Konva.Line({ points: [wData.startX, wData.startY, wData.endX, wData.endY], stroke: '#94a3b8', strokeWidth: wData.thickness || 20, lineCap: 'round', lineJoin: 'round', dash: [] });
                    }
                    shape.setAttr('refPts', [wData.startX, wData.startY, wData.endX, wData.endY]);
                    if (wData.bevels) shape.setAttr('bevels', wData.bevels);
                    this.referenceGroup.add(shape);
                });
            }
            if (state && state.stairs) {
                state.stairs.forEach(stair => {
                    let width = Number(stair.width) || 100;
                    let sd = Number(stair.stepDepth) || 25;
                    let l1 = stair.flight1Steps !== undefined ? Number(stair.flight1Steps) * sd : (Number(stair.length1) || 200);
                    let l2 = stair.flight2Steps !== undefined ? Number(stair.flight2Steps) * sd : (Number(stair.length2) || 200);
                    let ls = stair.landingSize !== undefined ? Number(stair.landingSize) : width;
                    let gw = Number(stair.gapWidth) || 10;
                    let turn = stair.turnDirection || stair.turnDir || 'right';
                    let pts = [];
                    
                    if (stair.shape === 'straight') {
                        const totalL = (Number(stair.totalSteps) || 12) * sd;
                        let y = 0; let totalLen = totalL;
                        if (stair.hasTopLanding) { y -= ls; totalLen += ls; }
                        if (stair.hasBottomLanding) { totalLen += ls; }
                        pts = [
                            {x: -width/2, y: y}, {x: width/2, y: y},
                            {x: width/2, y: y + totalLen}, {x: -width/2, y: y + totalLen}
                        ];
                    } else if (stair.shape === 'L') {
                        let y = 0; let f1Len = l1;
                        if (stair.hasTopLanding) { y -= ls; f1Len += ls; }
                        const f2X = turn === 'right' ? -width/2 : -width/2 - l2;
                        let f2Len = l2 + width;
                        let f2Start = f2X;
                        if (stair.hasBottomLanding) {
                            f2Len += ls;
                            if (turn !== 'right') f2Start -= ls;
                        }
                        if (turn === 'right') {
                            pts = [
                                {x: -width/2, y: y}, {x: width/2, y: y}, {x: width/2, y: l1},
                                {x: f2Start + f2Len, y: l1}, {x: f2Start + f2Len, y: l1 + width},
                                {x: -width/2, y: l1 + width}
                            ];
                        } else {
                            pts = [
                                {x: -width/2, y: y}, {x: width/2, y: y}, {x: width/2, y: l1 + width},
                                {x: f2Start, y: l1 + width}, {x: f2Start, y: l1}, {x: -width/2, y: l1}
                            ];
                        }
                    } else if (stair.shape === 'U') {
                        let y = 0; let f1Len = l1;
                        if (stair.hasTopLanding) { y -= ls; f1Len += ls; }
                        let f2Y = l1 - l2; let f2Len = l2;
                        if (stair.hasBottomLanding) { f2Y -= ls; f2Len += ls; }
                        if (turn === 'right') {
                            pts = [
                                {x: -width/2, y: y}, {x: width/2, y: y}, {x: width/2, y: f2Y},
                                {x: width/2 + gw + width, y: f2Y}, {x: width/2 + gw + width, y: l1 + ls},
                                {x: -width/2, y: l1 + ls}
                            ];
                        } else {
                            pts = [
                                {x: -width/2, y: y}, {x: width/2, y: y}, {x: width/2, y: l1 + ls},
                                {x: -width/2 - width - gw, y: l1 + ls}, {x: -width/2 - width - gw, y: f2Y},
                                {x: -width/2, y: f2Y}
                            ];
                        }
                    }

                    if (pts.length > 0) {
                        const rot = (Number(stair.rotation) || 0) * Math.PI / 180;
                        const sx = Number(stair.x) || 0, sy = Number(stair.y) || 0;
                        const rotatedPts = pts.map(p => ({
                            x: sx + (p.x * Math.cos(rot) - p.y * Math.sin(rot)),
                            y: sy + (p.x * Math.sin(rot) + p.y * Math.cos(rot))
                        }));
                        const flatPts = rotatedPts.flatMap(p => [p.x, p.y]);
                        
                        const stairGhost = new Konva.Line({
                            points: flatPts,
                            fill: 'rgba(239, 68, 68, 0.4)',
                            stroke: '#ef4444',
                            strokeWidth: 4,
                            dash: [8, 4],
                            closed: true,
                            lineJoin: 'round'
                        });
                        this.referenceGroup.add(stairGhost);

                        // Create a multi-segment arrow path through the center of the staircase
                        let arrowPath = [];
                        if (stair.shape === 'straight') {
                            const y = stair.hasTopLanding ? -ls : 0;
                            const totalL = ((Number(stair.totalSteps) || 12) * sd) + (stair.hasTopLanding ? ls : 0) + (stair.hasBottomLanding ? ls : 0);
                            arrowPath = [ {x: 0, y: y}, {x: 0, y: y + totalL} ];
                        } else if (stair.shape === 'L') {
                            const y = stair.hasTopLanding ? -ls : 0;
                            const f2X = turn === 'right' ? -width/2 : -width/2 - l2;
                            let f2Len = l2 + width + (stair.hasBottomLanding ? ls : 0);
                            let f2Start = f2X - (stair.hasBottomLanding && turn !== 'right' ? ls : 0);
                            const endX = turn === 'right' ? f2Start + f2Len : f2Start;
                            arrowPath = [
                                {x: 0, y: y},
                                {x: 0, y: l1 + width/2},
                                {x: endX, y: l1 + width/2}
                            ];
                        } else if (stair.shape === 'U') {
                            const y = stair.hasTopLanding ? -ls : 0;
                            let f2Y = l1 - l2 - (stair.hasBottomLanding ? ls : 0);
                            const centerF2X = turn === 'right' ? (width + gw) : (-width - gw);
                            const landingY = l1 + ls/2;
                            arrowPath = [
                                {x: 0, y: y},
                                {x: 0, y: landingY},
                                {x: centerF2X, y: landingY},
                                {x: centerF2X, y: f2Y}
                            ];
                        }

                        if (arrowPath.length > 0) {
                            const rotArrowPath = arrowPath.map(p => ({
                                x: sx + (p.x * Math.cos(rot) - p.y * Math.sin(rot)),
                                y: sy + (p.x * Math.sin(rot) + p.y * Math.cos(rot))
                            }));
                            const flatArrowPts = rotArrowPath.flatMap(p => [p.x, p.y]);

                            const stairArrow = new Konva.Arrow({
                                points: flatArrowPts,
                                pointerLength: 15,
                                pointerWidth: 15,
                                fill: '#ef4444',
                                stroke: '#ef4444',
                                strokeWidth: 4,
                                lineJoin: 'round',
                                tension: 0
                            });
                            this.referenceGroup.add(stairArrow);
                        }
                    }
                });
            }
            this.bgLayer.batchDraw();
        } catch (err) { console.error("Failed to load reference background", err); }
    }
}
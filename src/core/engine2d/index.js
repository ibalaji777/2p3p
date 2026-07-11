import { PremiumShape } from './PremiumShape.js';
// src/core/engine2d/index.js
import Konva from 'konva';
import { CameraController } from './CameraController.js';
import { GestureManager } from './GestureManager.js';
import { GridSystem } from './GridSystem.js';
import { InputManager } from './InputManager.js';
import { GRID, PX_TO_FT, SNAP_DIST, WALL_REGISTRY, WIDGET_REGISTRY, MOLDING_REGISTRY, offsetPolygon } from '../registry.js';
import { CommandManager } from '../commands/CommandManager.js';
import { AutomationAPI } from '../api/AutomationAPI.js';
import { MoveCommand } from '../commands/MoveCommand.js';
import { RotateCommand } from '../commands/RotateCommand.js';
import { ResizeCommand } from '../commands/ResizeCommand.js';
import { DeleteCommand } from '../commands/DeleteCommand.js';
import { CreateCommand } from '../commands/CreateCommand.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { EVENTS } from '../constants/events.js';
import { coreEventBus } from '../EventBus.js';

// SOLID: Import the decoupled 2D entity classes from the same folder
import { Anchor } from './Anchor.js';
import { PremiumWall } from '../../features/wall/wall.renderer2d.js';
import { PremiumWidget } from './PremiumWidget.js';
import { PremiumFurniture } from '../../features/furniture/furniture.renderer2d.js';
import { WallSerializer } from '../../features/wall/wall.serializer.js';

import { PremiumHipRoof } from '../../features/roof/roof.renderer2d.js';
import { PremiumRailing } from './PremiumRailing.js';
import { SmartGuidesTrackingSystem } from './SmartGuidesTrackingSystem.js';
import { advance_openings } from './advance_openings.js';
import { PremiumArc } from './PremiumArc.js';
import { StairV4Flight, StairV4Landing, StaircaseV4Solver } from '../../features/stairs/StaircaseV4.js';
import { PremiumStaircase } from '../../features/stairs/stairs.renderer2d.js';
import { PremiumMolding } from './PremiumMolding.js';
import { PRESET_REGISTRY, autoAlign } from './presetRegistry.js';
import { PresetGroup } from './PresetGroup.js';

// Export the specific classes that App.vue needs to spawn items
export { PremiumFurniture, PremiumHipRoof, StairV4Flight, StairV4Landing, PremiumMolding };

/**
 * The core orchestrator for the 2D layout engine. Manages application state, entities, rendering layers, and integrations with input sub-systems.
 */
export class FloorPlanner {
    get mobileDrawState() { return this._mobileDrawState || 'Idle'; }
    set mobileDrawState(val) {
        this._mobileDrawState = val;
        if (this.updateMobileDragHandle) this.updateMobileDragHandle();
    }
    
    constructor(containerEl) { 
        this.container = containerEl; 
        this._tool = "select"; 
        this.currentUnit = "ft"; 
        this.drawing = false; 
        this.lastAnchor = null; 
        this.startAnchor = null;  
        this.preview = null; 
        this.presetPreview = null;
        this._activeTimeouts = new Set();
        this.registerTimeout = (cb, ms) => {
            const id = setTimeout(() => {
                this._activeTimeouts.delete(id);
                cb();
            }, ms);
            this._activeTimeouts.add(id);
            return id;
        };
        
        Object.defineProperty(this, 'tool', {
            get: function() {
                return this._tool;
            },
            set: function(newTool) {
                if (this._tool === newTool) return;
                this._tool = newTool;
                
                // Clear state when selecting any placement/drawing tool, or cancelling to select
                if (this.drawing) {
                    this.drawing = false;
                }
                this.lastAnchor = null;
                this.startAnchor = null;
                this.currentSessionEntities = [];
                if (this.preview) {
                    this.preview.destroy();
                    this.preview = null;
                }
                this.mobileDrawState = 'Idle';
                if (this.hideSnapGlow) this.hideSnapGlow();
                if (this.hideInfoBadge) this.hideInfoBadge();
                if (this.smartGuides) this.smartGuides.clear();
                if (this.updateMobileDragHandle) this.updateMobileDragHandle();
            }
        });
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
        /** @deprecated Use planner.getWalls() */
        this.walls = [];
        this.presetRegistry = PRESET_REGISTRY;
        this.autoAlign = autoAlign;
        
        /** @deprecated Use getter APIs (e.g. getRooms, getStairs) instead of direct array access */
        this.anchors = []; this.roomPaths = []; this.stairs = []; this.furniture = []; this.roofs = []; this.arcs = []; this.shapes = []; this.moldings = []; this.presetGroups = []; this.selectedEntity = null; this.selectedType = null; this.selectedNodeIndex = -1;
        this.onSelectionChange = null; 
        this.initKonva(); this.gridSystem = new GridSystem(this); this.gridSystem.setupGrid(); this.initHUD(); 
        this.cameraController = new CameraController(this);
        this.gestureManager = new GestureManager(this, this.cameraController);
        this.inputManager = new InputManager(this); 
        this.snapManager = this.smartGuides;
        this.commandManager = new CommandManager(100);
        // Initialize Engine Automation API
        this.automationApi = new AutomationAPI(this);
    }
    
    
    // ==========================================
    // PUBLIC API: QUERY METHODS
    // ==========================================

    /**
     * @returns {Array<Object>} Currently selected entities
     */
    getSelection() {
        return this.selectedEntity ? [this.selectedEntity] : [];
    }
    
    getWalls() { return this.walls; }
    getDoors() { 
        let doors = [];
        this.walls.forEach(w => { if (w.openings) { w.openings.forEach(o => { if (o.type === 'door') doors.push(o); }); } });
        return doors; 
    }
    getWindows() { 
        let windows = [];
        this.walls.forEach(w => { if (w.openings) { w.openings.forEach(o => { if (o.type === 'window') windows.push(o); }); } });
        return windows; 
    }
    getRooms() { return this.rooms || []; }
    getRoofs() { return this.roofs; }
    getFurniture() { return this.furniture; }
    getStairs() { return this.stairs; }
    
    /**
     * @returns {Array<Object>} All physical entities in the scene
     */
    getEntities() {
        return [...this.walls, ...this.roofs, ...this.furniture, ...this.stairs, ...this.shapes, ...this.arcs, ...this.presetGroups];
    }
    
    getSceneState() {
        return {
            unit: this.currentUnit,
            wallTracking: this.wallTrackingEnabled
        };
    }
    
    getStatistics() {
        return {
            walls: this.walls.length,
            furniture: this.furniture.length,
            stairs: this.stairs.length,
            roofs: this.roofs.length
        };
    }

    // ==========================================
    // PUBLIC API: MUTATION METHODS (COMMANDS)
    // ==========================================

    create(type, config) {
        const cmd = new CreateCommand(this, type, config);
        this.commandManager.execute(cmd);
        return cmd.entityState; // Might not have instantiated yet though! Actually we should just let create return void, or handle differently.
    }
    
    move(entityId, x, y) {
        const entity = this.getEntities().find(e => e.id === entityId || (e.group && e.group.id() === entityId));
        if (!entity) return;
        const startPos = { x: entity.group.x(), y: entity.group.y() };
        const cmd = new MoveCommand(this, entityId, startPos, { x, y });
        this.commandManager.execute(cmd);
    }
    
    rotate(entityId, angle) {
        const entity = this.getEntities().find(e => e.id === entityId || (e.group && e.group.id() === entityId));
        if (!entity) return;
        const startRot = entity.rotation || 0;
        const cmd = new RotateCommand(this, entityId, startRot, angle);
        this.commandManager.execute(cmd);
    }
    
    resize(entityId, values) {
        const entity = this.getEntities().find(e => e.id === entityId || (e.group && e.group.id() === entityId));
        if (!entity) return;
        const startValues = { width: entity.width, depth: entity.depth, height: entity.height };
        const cmd = new ResizeCommand(this, entityId, startValues, values);
        this.commandManager.execute(cmd);
    }
    
    delete(entityId) {
        const entity = this.getEntities().find(e => e.id === entityId || (e.group && e.group.id() === entityId));
        if (!entity) return;
        const cmd = new DeleteCommand(this, entity);
        this.commandManager.execute(cmd);
    }

    // ==========================================
    // INTERNAL COMMAND EXECUTORS
    // ==========================================

    _applyMove(entityId, x, y) {
        const entity = this.getEntities().find(e => e.id === entityId || (e.group && e.group.id() === entityId));
        if (!entity || !entity.group) return;
        entity.group.position({ x, y });
        if (typeof entity.update3D === 'function') entity.update3D();
        this.syncAll();
    }

    _applyRotate(entityId, angle) {
        const entity = this.getEntities().find(e => e.id === entityId || (e.group && e.group.id() === entityId));
        if (!entity) return;
        entity.rotation = angle;
        if (entity.group) entity.group.rotation(angle);
        if (typeof entity.update3D === 'function') entity.update3D();
        this.syncAll();
    }

    _applyResize(entityId, values) {
        const entity = this.getEntities().find(e => e.id === entityId || (e.group && e.group.id() === entityId));
        if (!entity) return;
        if (values.width !== undefined) entity.width = values.width;
        if (values.depth !== undefined) entity.depth = values.depth;
        if (values.height !== undefined) entity.height = values.height;
        if (typeof entity.update2D === 'function') entity.update2D();
        if (typeof entity.update3D === 'function') entity.update3D();
        this.syncAll();
    }

    _applyDelete(entityId) {
        const entity = this.getEntities().find(e => e.id === entityId || (e.group && e.group.id() === entityId));
        if (!entity) return;
        if (typeof entity.remove === 'function') entity.remove();
        else if (typeof entity.destroy === 'function') entity.destroy();
        
        if (this.selectedEntity === entity) {
            this.selectedEntity = null;
            this.selectedType = null;
        }
        
        if (typeof window !== 'undefined') {
            coreEventBus.emit(EVENTS.ENTITY_REMOVED, { entityId });
            coreEventBus.emit(EVENTS.SCENE_CHANGED);
        }
        this.syncAll();
    }

    exportEntityState(entity) {
        if (entity.type === 'furniture') return { x: entity.group.x(), y: entity.group.y(), rotation: entity.rotation, width: entity.width, depth: entity.depth, height: entity.height, configId: entity.config.id, description: entity.description };
        // Basic fallback for now
        return { x: entity.group.x(), y: entity.group.y(), rotation: entity.rotation };
    }

    _applyCreate(type, config) {
        if (type === 'furniture') {
            const center = { x: this.stage.width() / 2, y: this.stage.height() / 2 };
            const item = new PremiumFurniture(this, center.x, center.y, config.id);
            this.furniture.push(item);
            this.selectEntity(item, 'furniture');
            this.syncAll();
            return item;
        }
        return null;
    }

    _applyRestore(type, state) {
        // Mocking restore for furniture specifically since it's commonly tested
        if (type === 'furniture') {
            const item = new PremiumFurniture(this, state.x, state.y, state.configId);
            item.rotation = state.rotation;
            if (state.width) item.width = state.width;
            if (state.depth) item.depth = state.depth;
            if (state.height) item.height = state.height;
            item.update2D();
            this.furniture.push(item);
            this.syncAll();
            return item;
        }
    }

    // ==========================================
    // PUBLIC API: HISTORY METHODS
    // ==========================================

    executeWithSnapshot(callback) {
        if (!this.commandManager) { callback(); return; }
        const cmd = new SnapshotCommand(this);
        callback();
        if (cmd.finalize()) {
            this.commandManager.execute(cmd);
        }
    }

    undo() {
        if (this.drawing) {
            let currentEntitiesCount = this.currentSessionEntities ? this.currentSessionEntities.length : 0;
            let wasDrawing = true;
            
            if (this.currentSessionEntities) this.currentSessionEntities.pop();
            
            let prevPos = null;
            if (currentEntitiesCount > 1) {
                let lastWall = this.currentSessionEntities[this.currentSessionEntities.length - 1];
                prevPos = lastWall.endAnchor.position();
            } else if (currentEntitiesCount === 1) {
                prevPos = this.startAnchor.position();
            } else {
                wasDrawing = false;
            }
            
            this.commandManager.undo();
            
            if (wasDrawing && prevPos) {
                this.drawing = true;
                let a = this.anchors.find(anc => Math.abs(anc.x - prevPos.x) < 1 && Math.abs(anc.y - prevPos.y) < 1);
                if (a) {
                    this.lastAnchor = a;
                    if (currentEntitiesCount === 1) this.startAnchor = a;
                } else {
                    this.cancelChain();
                }
                this.mobileDrawState = 'PreviewDrawing';
                
                // Reset visual indicators (snap, guide, tooltips, preview polygon) so they don't linger
                this.hideInfoBadge();
                this.hideSnapGlow();
                this.drawGuideLine(0, 0, 0, 0, false);
                if (this.smartGuides) this.smartGuides.clear();
                if (this.crosshair) this.crosshair.hide();
                if (this.preview) { this.preview.destroy(); this.preview = null; }
                this.mainLayer.batchDraw();
            } else {
                this.cancelChain();
            }
            return;
        }
        this.commandManager.undo();
    }
    
    redo() {
        this.commandManager.redo();
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

        const isWallTool = ['outer', 'inner', 'railing', 'roof'].includes(this.tool);
        
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
        this.executeWithSnapshot(() => {
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
            this.tool = 'select';
            this.updateToolStates();
            if (this.onToolChange) this.onToolChange('select');
        });
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
        if (typeof window !== 'undefined') {
            coreEventBus.emit(EVENTS.SELECTION_CHANGED, { entity, type, nodeIndex });
        }
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
        if (this.roofs) this.roofs.forEach(r => {
            let canEdit = isSelect;
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
        if (this.roofLayer) { this.roofLayer.listening(isSelect); }
        if (this.roomLayer) { this.roomLayer.listening(isSelect); }

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
        
        if (this.drawingRoofPoints && !isCancel && this.drawingRoofPoints.length > 2) {
            if (this.tool === 'shape_floor_cut') {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                this.drawingRoofPoints.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
                const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
                const w = maxX - minX, h = maxY - minY;
                const relPts = this.drawingRoofPoints.map(p => ({ x: p.x - cx, y: p.y - cy }));
                const newShape = new PremiumShape(this, 'shape_floor_cut', { x: cx, y: cy, width: w, height: h, points: relPts, stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.2)' });
                if (!this.shapes) this.shapes = []; this.shapes.push(newShape);
                
                this.registerTimeout(() => {
                    this.tool = 'select'; this.updateToolStates();
                    if (this.onToolChange) this.onToolChange('select');
                    this.selectEntity(newShape, 'shape');
                    this.syncAll();
                }, 10);
            } else {
                const roof = new PremiumHipRoof(this, this.drawingRoofPoints);
                roof.config.roofType = this.currentRoofToolType || 'hip';
                this.roofs.push(roof); 
                
                this.registerTimeout(() => {
                    this.tool = 'select'; this.updateToolStates();
                    if (this.onToolChange) this.onToolChange('select');
                    this.selectEntity(roof, 'roof');
                    this.syncAll();
                }, 10);
            }
        }
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
                this.registerTimeout(() => {
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
        if (this.crosshair) this.crosshair.hide();
        if (this.smartGuides) this.smartGuides.clear();
        
        this.deselectAll(); 
        
        if (!isCancel && newlyCreated.length > 0) {
            this.registerTimeout(() => {
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
                if (this.roofs) this.roofs = this.roofs.filter(r => r !== ent);
                if (this.shapes) this.shapes = this.shapes.filter(s => s !== ent);
            });
            this.currentSessionEntities = [];
        }
        this.drawing = false; this.lastAnchor = null; this.startAnchor = null; this.mobileDrawState = 'Idle';
        if (this.crosshair) this.crosshair.hide();
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

    /**
     * Completely clears the 2D workspace, removing all walls, furniture, shapes, and data.
     */
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

    /**
     * Serializes the entire 2D scene into a JSON string.
     * @returns {string} The JSON representation of the current state.
     */
    exportState() {
        const standardWalls = this.walls.filter(w => !w.parentArc);
        // Explicitly map anchors by index so we retain exact topology without accidental merging
        this.anchors.forEach((a, i) => a._id = i);

        const state = {
            settings: this.settings,
            unit: this.currentUnit,
            anchors: this.anchors.map(a => ({ id: a._id, x: a.x, y: a.y })),
            walls: standardWalls.map(w => WallSerializer.serialize(w)),
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

    /**
     * Restores the 2D scene from a serialized JSON string.
     * @param {string} jsonStr - The JSON state to load.
     */
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
                this.registerTimeout(() => {
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

    dispose() {
        if (this._handleGlobalKeyDown) {
            window.removeEventListener('keydown', this._handleGlobalKeyDown);
        }
        if (this._activeTimeouts) {
            this._activeTimeouts.forEach(id => clearTimeout(id));
            this._activeTimeouts.clear();
        }

        if (this.cameraController && this.cameraController.dispose) {
            this.cameraController.dispose();
        }
        if (this.gestureManager && this.gestureManager.dispose) {
            this.gestureManager.dispose();
        }

        if (this.stage) {
            this.stage.destroy();
            this.stage = null;
        }
    }
}

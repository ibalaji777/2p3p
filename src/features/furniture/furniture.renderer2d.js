import Konva from 'konva';
import { FURNITURE_REGISTRY, WORKSPACE_2D_SHAPES } from '../../core/registry.js';
import { coreEventBus } from '../../core/EventBus.js';
import { globalShapeMirror } from '../../core/sync/ShapeMirrorEngine.js';

export class PremiumFurniture {
    constructor(planner, x, y, configId, id = null) {
        this.planner = planner; 
        this.type = 'furniture'; 
        this.id = id || 'furn_' + Math.random().toString(36).substr(2, 9);
        this.configId = configId;
        this.config = FURNITURE_REGISTRY[configId] || { default: { width: 100, depth: 100, height: 100 } };
        this.materialMode = 'MULTI_MESH';
        this.supportsLiveMaterialPipeline = false;
        this.width = this.config.default.width; 
        this.depth = this.config.default.depth; 
        this.height = this.config.default.height; 
        this.elevation = (this.config.default && this.config.default.elevation !== undefined) ? this.config.default.elevation : 0;
        this.rotation = 0; 
        this.isDragging = false;
        this.group = new Konva.Group({ x: x, y: y, width: this.width, height: this.depth, draggable: true, offsetX: this.width / 2, offsetY: this.depth / 2 });
        this.bg = new Konva.Rect({ width: this.width, height: this.depth, fill: 'transparent', cornerRadius: 4 });
        
        const shapeKey = this.config.shape2D || 'default';
        const pathData = (WORKSPACE_2D_SHAPES && WORKSPACE_2D_SHAPES[shapeKey]) ? WORKSPACE_2D_SHAPES[shapeKey] : "M 0 0 L 100 0 L 100 100 L 0 100 Z";
        this.body = new Konva.Path({ data: pathData, fill: this.config.color2D || 'transparent', stroke: '#94a3b8', strokeWidth: 1.5, strokeScaleEnabled: false, scaleX: this.width / 100, scaleY: this.depth / 100 });
        
        this.rotHandle = new Konva.Circle({ x: this.width / 2, y: -15, radius: 6, fill: '#3b82f6', stroke: 'white', strokeWidth: 2, draggable: true, visible: false });
        this.group.add(this.bg, this.body, this.rotHandle); 
        if (this.planner && this.planner.furnitureLayer) {
            this.planner.furnitureLayer.add(this.group);
        }
        this.initEvents();

        // Dynamic GLB fallback for unmapped custom GLB models
        if (this.config && this.config.model && (!this.config.shape2D || this.config.shape2D === 'furniture' || this.config.shape2D === 'default')) {
            globalShapeMirror.loadAndExtractFootprint(this.config, this.id, this.width, this.depth).then((footprint) => {
                if (footprint) {
                    const svgPath = globalShapeMirror.pointsToSvg(footprint);
                    if (svgPath) {
                        this.body.data(svgPath);
                        this.body.scaleX(1);
                        this.body.scaleY(1);
                        this.body.x(this.width / 2);
                        this.body.y(this.depth / 2);
                        this.hasDynamicFootprint = true;
                        this.update();
                        if (this.planner && this.planner.mainLayer) this.planner.mainLayer.batchDraw();
                        if (this.planner && this.planner.furnitureLayer) this.planner.furnitureLayer.batchDraw();
                    }
                }
            });
        }
    }

    setHighlight(isActive) { 
        this.body.stroke(isActive ? '#3b82f6' : '#94a3b8'); 
        this.body.strokeWidth(isActive ? 2.5 : 1.5); 
        this.rotHandle.visible(isActive); 
        if (this.planner && this.planner.stage) this.planner.stage.batchDraw(); 
    }

    initEvents() {
        this.group.on('mouseenter', () => document.body.style.cursor = 'move'); 
        this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        this.group.on('mousedown touchstart', (e) => { 
            this.group.moveToTop();
            if (this.planner && this.planner.tool === 'select') {
                e.cancelBubble = true; 
                if (e.evt) e.evt.stopPropagation();
                this.planner.selectEntity(this, 'furniture'); 
            }
        });
        this.group.on('dragstart', () => { 
            this.isDragging = true; 
            this.dragStartPos = { x: this.group.x(), y: this.group.y() };
            if (this.planner) this.planner.selectEntity(this, 'furniture'); 
        });
        this.group.on('dragmove', (e) => { 
            if (e.target === this.rotHandle) return; 
            if (this.planner && this.planner.syncAll) this.planner.syncAll(); 
            coreEventBus.emit('EntityTransformUpdated2D', { id: this.id, x: this.group.x(), y: this.group.y(), rotation: this.rotation });
        });
        this.group.on('dragend', () => { 
            this.isDragging = false; 
            if (this.dragStartPos) {
                const endX = this.group.x();
                const endY = this.group.y();
                if (Math.abs(endX - this.dragStartPos.x) > 0.001 || Math.abs(endY - this.dragStartPos.y) > 0.001) {
                    this.group.position(this.dragStartPos);
                    if (this.planner && this.planner.move) this.planner.move(this.id, endX, endY);
                }
                this.dragStartPos = null;
            }
        });
        
        this.rotHandle.on('dragstart', (e) => {
            e.cancelBubble = true;
            this.dragStartRot = this.rotation;
        });
        this.rotHandle.on('dragmove', (e) => { 
            e.cancelBubble = true; 
            if (!this.planner || !this.planner.stage) return;
            const pos = this.planner.stage.getPointerPosition(); 
            if (!pos) return;
            const angleRad = Math.atan2(pos.y - this.group.y(), pos.x - this.group.x()); 
            this.rotation = (angleRad * 180 / Math.PI) + 90; 
            this.group.rotation(this.rotation); 
            this.rotHandle.position({ x: this.width / 2, y: -15 }); 
            if (this.planner.syncAll) this.planner.syncAll(); 
            coreEventBus.emit('EntityTransformUpdated2D', { id: this.id, x: this.group.x(), y: this.group.y(), rotation: this.rotation });
        });
        this.rotHandle.on('dragend', (e) => {
            e.cancelBubble = true;
            if (this.dragStartRot !== undefined) {
                const endRot = this.rotation;
                if (Math.abs(endRot - this.dragStartRot) > 0.001) {
                    this.rotation = this.dragStartRot;
                    this.group.rotation(this.dragStartRot);
                    if (this.planner && this.planner.rotate) this.planner.rotate(this.id, endRot);
                }
                this.dragStartRot = undefined;
            }
        });
    }

    update() { 
        this.group.width(this.width); 
        this.group.height(this.depth); 
        this.group.offsetX(this.width / 2); 
        this.group.offsetY(this.depth / 2); 
        this.bg.width(this.width); 
        this.bg.height(this.depth); 
        if (this.hasDynamicFootprint) {
            this.body.x(this.width / 2);
            this.body.y(this.depth / 2);
        } else {
            this.body.scaleX(this.width / 100); 
            this.body.scaleY(this.depth / 100); 
        }
        this.group.rotation(this.rotation); 
        this.rotHandle.x(this.width / 2); 
    }

    remove() { 
        this.group.destroy(); 
        if (this.planner) {
            if (this.planner.furniture) this.planner.furniture = this.planner.furniture.filter(f => f !== this); 
            if (this.planner.selectEntity) this.planner.selectEntity(null); 
            if (this.planner.syncAll) this.planner.syncAll(); 
        }
    }
}
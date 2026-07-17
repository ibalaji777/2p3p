import Konva from 'konva';
import { FURNITURE_REGISTRY, WORKSPACE_2D_SHAPES } from '../../core/registry.js';

export class PremiumFurniture {
    constructor(planner, x, y, configId) {
        this.planner = planner; this.type = 'furniture'; this.config = FURNITURE_REGISTRY[configId];
        this.width = this.config.default.width; this.depth = this.config.default.depth; this.height = this.config.default.height; 
        this.rotation = 0; this.isDragging = false;
        this.group = new Konva.Group({ x: x, y: y, width: this.width, height: this.depth, draggable: true, offsetX: this.width / 2, offsetY: this.depth / 2 });
        this.bg = new Konva.Rect({ width: this.width, height: this.depth, fill: 'transparent', cornerRadius: 4 });
        
        const shapeKey = this.config.shape2D || 'default';
        const pathData = WORKSPACE_2D_SHAPES[shapeKey] || WORKSPACE_2D_SHAPES['default'];
        this.body = new Konva.Path({ data: pathData, fill: 'transparent', stroke: '#94a3b8', strokeWidth: 1.5, strokeScaleEnabled: false, scaleX: this.width / 100, scaleY: this.depth / 100 });
        
        this.rotHandle = new Konva.Circle({ x: this.width / 2, y: -15, radius: 6, fill: '#3b82f6', stroke: 'white', strokeWidth: 2, draggable: true, visible: false });
        this.group.add(this.bg, this.body, this.rotHandle); this.planner.furnitureLayer.add(this.group);
        this.initEvents();
    }
    setHighlight(isActive) { this.body.stroke(isActive ? '#3b82f6' : '#94a3b8'); this.body.strokeWidth(isActive ? 2.5 : 1.5); this.rotHandle.visible(isActive); this.planner.stage.batchDraw(); }
    initEvents() {
        this.group.on('mouseenter', () => document.body.style.cursor = 'move'); this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        this.group.on('mousedown touchstart', (e) => { 
            this.group.moveToTop();
            if (this.planner.tool === 'select') {
                e.cancelBubble = true; 
                if (e.evt) e.evt.stopPropagation();
                this.planner.selectEntity(this, 'furniture'); 
            }
        });
        this.group.on('dragstart', () => { 
            this.isDragging = true; 
            this.dragStartPos = { x: this.group.x(), y: this.group.y() };
            this.planner.selectEntity(this, 'furniture'); 
        });
        this.group.on('dragmove', (e) => { 
            if (e.target === this.rotHandle) return; 
            this.planner.syncAll(); 
        });
        this.group.on('dragend', () => { 
            this.isDragging = false; 
            if (this.dragStartPos) {
                const endX = this.group.x();
                const endY = this.group.y();
                if (Math.abs(endX - this.dragStartPos.x) > 0.001 || Math.abs(endY - this.dragStartPos.y) > 0.001) {
                    this.group.position(this.dragStartPos);
                    if (this.planner.move) this.planner.move(this.id, endX, endY);
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
            const pos = this.planner.stage.getPointerPosition(); 
            const angleRad = Math.atan2(pos.y - this.group.y(), pos.x - this.group.x()); 
            this.rotation = (angleRad * 180 / Math.PI) + 90; 
            this.group.rotation(this.rotation); 
            this.rotHandle.position({ x: this.width / 2, y: -15 }); 
            this.planner.syncAll(); 
        });
        this.rotHandle.on('dragend', (e) => {
            e.cancelBubble = true;
            if (this.dragStartRot !== undefined) {
                const endRot = this.rotation;
                if (Math.abs(endRot - this.dragStartRot) > 0.001) {
                    this.rotation = this.dragStartRot;
                    this.group.rotation(this.dragStartRot);
                    if (this.planner.rotate) this.planner.rotate(this.id, endRot);
                }
                this.dragStartRot = undefined;
            }
        });
    }
    update() { this.group.width(this.width); this.group.height(this.depth); this.group.offsetX(this.width / 2); this.group.offsetY(this.depth / 2); this.bg.width(this.width); this.bg.height(this.depth); this.body.scaleX(this.width / 100); this.body.scaleY(this.depth / 100); this.group.rotation(this.rotation); this.rotHandle.x(this.width / 2); }
    remove() { this.group.destroy(); this.planner.furniture = this.planner.furniture.filter(f => f !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
}
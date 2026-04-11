import Konva from 'konva';
import { FURNITURE_REGISTRY } from '../registry.js';

export class PremiumFurniture {
    constructor(planner, x, y, configId) {
        this.planner = planner; this.type = 'furniture'; this.config = FURNITURE_REGISTRY[configId];
        this.width = this.config.default.width; this.depth = this.config.default.depth; this.height = this.config.default.height; 
        this.rotation = 0; this.isDragging = false;
        this.group = new Konva.Group({ x: x, y: y, width: this.width, height: this.depth, draggable: true, offsetX: this.width / 2, offsetY: this.depth / 2 });
        this.body = new Konva.Rect({ width: this.width, height: this.depth, fill: '#fde68a', stroke: '#ea580c', strokeWidth: 2, cornerRadius: 4, shadowColor: 'black', shadowBlur: 5, shadowOpacity: 0.2 });
        this.rotHandle = new Konva.Circle({ x: this.width / 2, y: -15, radius: 6, fill: '#ea580c', stroke: 'white', strokeWidth: 2, draggable: true, visible: false });
        this.group.add(this.body, this.rotHandle); this.planner.furnitureLayer.add(this.group);
        this.initEvents();
    }
    setHighlight(isActive) { this.body.stroke(isActive ? '#4f46e5' : '#ea580c'); this.body.strokeWidth(isActive ? 3 : 2); this.rotHandle.visible(isActive); this.planner.stage.batchDraw(); }
    initEvents() {
        this.group.on('mouseenter', () => document.body.style.cursor = 'move'); this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        this.group.on('mousedown touchstart', (e) => { 
            e.cancelBubble = true; 
            if (e.evt) e.evt.stopPropagation();
            this.planner.selectEntity(this, 'furniture'); 
        });
        this.group.on('dragstart', () => { this.isDragging = true; this.planner.selectEntity(this, 'furniture'); });
        this.group.on('dragmove', (e) => { if (e.target === this.rotHandle) return; this.planner.syncAll(); });
        this.group.on('dragend', () => { this.isDragging = false; });
        this.rotHandle.on('dragmove', (e) => { e.cancelBubble = true; const pos = this.planner.stage.getPointerPosition(); const angleRad = Math.atan2(pos.y - this.group.y(), pos.x - this.group.x()); this.rotation = (angleRad * 180 / Math.PI) + 90; this.group.rotation(this.rotation); this.rotHandle.position({ x: this.width / 2, y: -15 }); this.planner.syncAll(); });
    }
    update() { this.group.width(this.width); this.group.height(this.depth); this.group.offsetX(this.width / 2); this.group.offsetY(this.depth / 2); this.body.width(this.width); this.body.height(this.depth); this.group.rotation(this.rotation); this.rotHandle.x(this.width / 2); }
    remove() { this.group.destroy(); this.planner.furniture = this.planner.furniture.filter(f => f !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
}
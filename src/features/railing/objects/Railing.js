// src/features/railing/objects/Railing.js
import Konva from 'konva';
import { getRailingConfig } from '../registry/railing.registry.js';
import { Railing2DBuilder } from '../builders/Railing2DBuilder.js';

export class Railing {
    constructor(planner, startAnchor, endAnchor) {
        this.planner = planner;
        this.startAnchor = startAnchor;
        this.endAnchor = endAnchor;
        this.type = 'railing';
        
        // Defaults to first config if none set
        this.configId = this.planner?.activePresetParams?.type || 'glass_stainless';
        this.config = getRailingConfig(this.configId);
        
        this.thickness = this.config.thickness || 2;
        this.height = this.config.height || 40;
        
        this.id = Math.random().toString(36).substring(2, 9);
        
        this.attachedWidgets = [];
        this.attachedMoldings = [];
        
        this.wallGroup = new Konva.Group();
        
        // Mock poly for compatibility with tools that check wall.poly
        this.poly = new Konva.Line({ hitStrokeWidth: 20 });
        this.poly.parentWall = this;
        this.poly.isWallPoly = true;
        this.poly.points = () => this.points;
        this.wallGroup.add(this.poly);
        
        this.planner.widgetLayer.add(this.wallGroup);
        
        this.labelGroup = new Konva.Group({ listening: false });
        this.planner.uiLayer.add(this.labelGroup);

        this.initEvents();
        this.update2D();
    }

    get points() {
        if (!this.startAnchor || !this.endAnchor) return [];
        const p1 = this.startAnchor.position();
        const p2 = this.endAnchor.position();
        return [p1.x, p1.y, p2.x, p2.y];
    }

    getLength() {
        const pts = this.points;
        if (pts.length < 4) return 0;
        return Math.hypot(pts[2] - pts[0], pts[3] - pts[1]);
    }

    setConfig(configId) {
        this.configId = configId;
        this.config = getRailingConfig(configId);
        this.thickness = this.config.thickness || 2;
        this.height = this.config.height || 40;
        
        this.update2D();
        if (this.planner && this.planner.syncAll) this.planner.syncAll();
    }

    setHighlight(isActive) {
        this.isSelected = isActive || this.planner.selectedEntity === this;
        this.update2D();
    }

    update() {
        this.update2D();
    }

    update2D() {
        if (!this.wallGroup) return;
        // Clear previous drawing
        const children = this.wallGroup.getChildren(node => node !== this.poly);
        if (children && children.forEach) {
            children.forEach(n => n.destroy());
        }
        
        const representation = Railing2DBuilder.build(this, this.isSelected);
        
        // Add new shapes
        const repChildren = representation.getChildren();
        if (repChildren && repChildren.forEach) {
            repChildren.forEach(n => {
                this.wallGroup.add(n.clone());
            });
        }
        
        this.poly.points(this.points); // update hit area
        
        if (this.planner && this.planner.stage) {
            this.planner.stage.batchDraw();
        }
    }

    // Required methods for compatibility with wall systems
    hasEvent(eventName) {
        return ['select', 'split'].includes(eventName);
    }

    initEvents() {
        this.poly.on('mouseenter', () => { if (this.planner.tool === 'select') document.body.style.cursor = 'pointer'; });
        this.poly.on('mouseleave', () => { document.body.style.cursor = 'default'; });
        
        this.poly.on('mousedown touchstart', (e) => {
            if (this.planner.tool !== 'select') return;
            e.cancelBubble = true;
            if (e.evt) e.evt.stopPropagation();
            this.planner.selectEntity(this, 'wall');
        });
    }

    destroy() {
        if (this.wallGroup) this.wallGroup.destroy();
        if (this.labelGroup) this.labelGroup.destroy();
    }
}

import Konva from 'konva';

export class advance_openings {
    constructor(planner, wall, t, type) {
        this.planner = planner;
        this.wall = wall;
        this.t = t; 
        this.type = type;
        this.configId = type;
        
        this.width = 100;
        this.height = 200;
        this.depth = 15; 
        this.elevation = 0; 
        this.facing = 1;
        this.side = 1;
        
        this.rows = 4;
        this.cols = 4;
        this.spacing = 5;
        this.patternStyle = 'grid'; // grid, diamond, circle
        
        this.config = {
            id: type,
            type: 'advance_openings',
            label: type.replace(/_/g, ' ').toUpperCase()
        };
        
        this.group = new Konva.Group({ draggable: true });
        
        // Background cutter punch hole in the wall
        this.cutter = new Konva.Rect({
            fill: 'black',
            globalCompositeOperation: 'destination-out',
            listening: false
        });
        this.planner.wallLayer.add(this.cutter);
        
        this.shapeGroup = new Konva.Group({ listening: false });
        this.hitBox = new Konva.Rect({ fill: 'transparent', listening: true });
        
        this.group.add(this.hitBox);
        this.group.add(this.shapeGroup);
        this.planner.widgetLayer.add(this.group);
        
        this.initEvents();
        this.update();
    }
    
    initEvents() {
        this.group.on('mouseenter', () => { 
            if (this.planner.tool === 'select') document.body.style.cursor = 'pointer'; 
        });
        this.group.on('mouseleave', () => { 
            document.body.style.cursor = 'default'; 
        });

        this.group.on('dragmove', (e) => {
            if (this.planner.tool !== 'select') return;
            const pos = this.planner.getPointerPos();
            const p1 = this.wall.startAnchor.position();
            const p2 = this.wall.endAnchor.position();
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx*dx + dy*dy;
            
            if (lenSq > 0) {
                let t = ((pos.x - p1.x) * dx + (pos.y - p1.y) * dy) / lenSq;
                this.t = Math.max(0.05, Math.min(0.95, t));
            }
            this.update();
            this.planner.syncAll();
        });
        
        this.group.on('mousedown touchstart', (e) => {
            if (this.planner.tool !== 'select') return;
            e.cancelBubble = true;
            this.planner.selectEntity(this, 'advance_openings');
        });

        // Nudge with Keyboard Shortcuts
        this.handleKeyDown = (e) => {
            if (this.planner.selectedEntity !== this) return;
            if (!e.ctrlKey && !e.metaKey) return;
            
            const nudgeAmount = 0.01; // 1% of wall length
            
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                this.t = Math.max(0.05, this.t - nudgeAmount);
                e.preventDefault();
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                this.t = Math.min(0.95, this.t + nudgeAmount);
                e.preventDefault();
            }
            
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                this.update();
                this.planner.syncAll();
            }
        };
        window.addEventListener('keydown', this.handleKeyDown);
    }
    
    update() {
        const p1 = this.wall.startAnchor.position();
        const p2 = this.wall.endAnchor.position();
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const x = p1.x + this.t * dx;
        const y = p1.y + this.t * dy;
        
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        this.group.position({ x, y });
        this.group.rotation(angle);
        
        const thick = this.wall.thickness || (this.wall.config ? this.wall.config.thickness : 10);
        const hw = this.width / 2;

        // Handle Background Cut
        this.cutter.width(this.width);
        this.cutter.height(thick + 4);
        this.cutter.offsetX(hw);
        this.cutter.offsetY((thick + 4) / 2);
        this.cutter.position({ x, y });
        this.cutter.rotation(angle);

        this.shapeGroup.destroyChildren();

        const isSelected = this.planner.selectedEntity === this;
        const strokeColor = isSelected ? '#facc15' : '#38bdf8';
        const shadowColor = isSelected ? '#facc15' : '#38bdf8';

        const commonProps = {
            stroke: strokeColor,
            strokeWidth: 2,
            shadowColor: shadowColor,
            shadowBlur: isSelected ? 15 : 10,
            shadowOpacity: 0.6,
            fill: 'rgba(56, 189, 248, 0.15)'
        };

        // Draw specific shape configurations for CAD Interface
        if (this.type === 'arch_opening') {
            this.shapeGroup.add(new Konva.Rect({ x: -hw, y: -thick / 2, width: this.width, height: thick, ...commonProps }));
            this.shapeGroup.add(new Konva.Arc({ x: 0, y: 0, innerRadius: hw, outerRadius: hw, angle: 180, rotation: 180, stroke: strokeColor, dash: [4, 4] }));
        } 
        else if (this.type === 'circular_opening') {
            this.shapeGroup.add(new Konva.Ellipse({ x: 0, y: 0, radiusX: hw, radiusY: thick / 2, ...commonProps }));
            this.shapeGroup.add(new Konva.Line({ points: [0, -thick, 0, thick], stroke: strokeColor, dash: [2, 2], strokeWidth: 1 }));
            this.shapeGroup.add(new Konva.Line({ points: [-hw - 5, 0, hw + 5, 0], stroke: strokeColor, dash: [2, 2], strokeWidth: 1 }));
        } 
        else if (this.type === 'custom_shape_opening') {
            this.shapeGroup.add(new Konva.Line({
                points: [-hw, -thick/2, hw, -thick/2 + 5, hw - 5, thick/2, -hw + 5, thick/2],
                closed: true, ...commonProps
            }));
            this.shapeGroup.add(new Konva.Circle({ x: hw - 5, y: thick/2, radius: 3, fill: '#fff', stroke: strokeColor }));
            this.shapeGroup.add(new Konva.Circle({ x: -hw, y: -thick/2, radius: 3, fill: '#fff', stroke: strokeColor }));
        } 
        else if (this.type === 'niche_recess') {
            const recessDepth = Math.min(this.depth, thick - 2);
            this.shapeGroup.add(new Konva.Rect({ x: -hw, y: -thick / 2, width: this.width, height: thick - recessDepth, ...commonProps }));
            this.shapeGroup.add(new Konva.Rect({ x: -hw, y: thick / 2 - recessDepth, width: this.width, height: recessDepth, fill: 'rgba(56, 189, 248, 0.4)' }));
        } 
        else if (this.type === 'pattern_opening') {
            this.shapeGroup.add(new Konva.Rect({ x: -hw, y: -thick / 2, width: this.width, height: thick, ...commonProps }));
            const pCols = this.cols || 4;
            const step = this.width / pCols;
            for(let i = 0; i < pCols; i++) {
                if (this.patternStyle === 'grid') {
                    this.shapeGroup.add(new Konva.Rect({ x: -hw + i * step + step*0.25, y: -step*0.25, width: step*0.5, height: step*0.5, fill: strokeColor }));
                } else if (this.patternStyle === 'diamond') {
                    this.shapeGroup.add(new Konva.RegularPolygon({ x: -hw + (i + 0.5) * step, y: 0, sides: 4, radius: step*0.3, fill: strokeColor }));
                } else if (this.patternStyle === 'circle') {
                    this.shapeGroup.add(new Konva.Circle({ x: -hw + (i + 0.5) * step, y: 0, radius: Math.max(1, step*0.2), fill: strokeColor }));
                } else if (this.patternStyle === 'cross') {
                    this.shapeGroup.add(new Konva.Rect({ x: -hw + (i + 0.5) * step, y: 0, width: step*0.15, height: step*0.5, offsetX: step*0.075, offsetY: step*0.25, fill: strokeColor }));
                    this.shapeGroup.add(new Konva.Rect({ x: -hw + (i + 0.5) * step, y: 0, width: step*0.5, height: step*0.15, offsetX: step*0.25, offsetY: step*0.075, fill: strokeColor }));
                } else if (this.patternStyle === 'hexagon') {
                    this.shapeGroup.add(new Konva.RegularPolygon({ x: -hw + (i + 0.5) * step, y: 0, sides: 6, radius: step*0.3, fill: strokeColor }));
                } else if (this.patternStyle === 'star') {
                    this.shapeGroup.add(new Konva.Star({ x: -hw + (i + 0.5) * step, y: 0, numPoints: 4, innerRadius: step*0.1, outerRadius: step*0.3, fill: strokeColor }));
                } else if (this.patternStyle === 'slit') {
                    this.shapeGroup.add(new Konva.Rect({ x: -hw + i * step + step*0.35, y: -step*0.4, width: step*0.3, height: step*0.8, fill: strokeColor }));
                } else if (this.patternStyle === 'terracotta') {
                    this.shapeGroup.add(new Konva.Circle({ x: -hw + (i + 0.5) * step, y: 0, radius: step*0.25, stroke: strokeColor, strokeWidth: 1 }));
                    this.shapeGroup.add(new Konva.RegularPolygon({ x: -hw + (i + 0.5) * step, y: 0, sides: 4, radius: step*0.12, fill: strokeColor }));
                } else if (this.patternStyle === 'arabesque') {
                    this.shapeGroup.add(new Konva.Star({ x: -hw + (i + 0.5) * step, y: 0, numPoints: 8, innerRadius: step*0.15, outerRadius: step*0.28, fill: strokeColor }));
                } else {
                    this.shapeGroup.add(new Konva.Circle({ x: -hw + (i + 0.5) * step, y: 0, radius: Math.max(1, step*0.2), fill: strokeColor }));
                }
            }
        } 
        else if (this.type === 'boolean_cut') {
            this.shapeGroup.add(new Konva.Rect({ x: -hw, y: -thick / 2, width: this.width, height: thick, ...commonProps, dash: [6, 4] }));
            this.shapeGroup.add(new Konva.Text({ x: -hw, y: -6, width: this.width, text: 'BOOL', fontSize: 11, fill: strokeColor, fontStyle: 'bold', align: 'center' }));
        }

        // Dynamic Hitbox area
        const hitHeight = Math.max(thick + 24, 40);
        this.hitBox.setAttrs({
            x: -hw, y: -hitHeight / 2, width: this.width, height: hitHeight
        });
    }
    
    setHighlight(isActive) {
        this.update();
    }
    
    remove() {
        window.removeEventListener('keydown', this.handleKeyDown);
        this.cutter.destroy();
        this.group.destroy();
        if (this.wall && this.wall.attachedWidgets) {
            this.wall.attachedWidgets = this.wall.attachedWidgets.filter(w => w !== this);
        }
        this.planner.selectEntity(null);
        this.planner.syncAll();
    }
}

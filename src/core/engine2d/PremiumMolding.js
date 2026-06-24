import Konva from 'konva';
import { MOLDING_REGISTRY } from '../registry.js';

export class PremiumMolding {
    constructor(planner, wall, t, configId) {
        this.planner = planner; 
        this.wall = wall; 
        this.t = t; 
        this.type = configId; 
        this.isDragging = false; 
        this.side = 'left';
        
        this.config = MOLDING_REGISTRY[configId];
        Object.assign(this, JSON.parse(JSON.stringify(this.config.defaultConfig)));
        
        this.visualGroup = new Konva.Group({ draggable: false }); 
        this.hitBox = new Konva.Rect({ fill: 'transparent', listening: true });
        this.visualGroup.add(this.hitBox);
        
        // Representation of molding in 2D plan (often a colored rectangle hugging the wall)
        this.moldingRect = new Konva.Rect({ 
            fill: this.type === 'molding_groove' ? '#9ca3af' : '#10b981', 
            opacity: 0.7 
        }); 
        this.visualGroup.add(this.moldingRect);
        
        if (this.hasEvent("resize_handles_along_wall_axis")) {
            this.leftHandle = new Konva.Circle({ radius: 7, fill: '#3b82f6', stroke: 'white', strokeWidth: 2, draggable: true, visible: false }); 
            this.rightHandle = new Konva.Circle({ radius: 7, fill: '#3b82f6', stroke: 'white', strokeWidth: 2, draggable: true, visible: false });
            [this.leftHandle, this.rightHandle].forEach((handle, idx) => { 
                handle.on('mouseenter', () => document.body.style.cursor = 'ew-resize'); 
                handle.on('mouseleave', () => document.body.style.cursor = 'pointer'); 
                handle.on('dragstart', (e) => { e.cancelBubble = true; }); 
                handle.on('dragmove', (e) => { e.cancelBubble = true; const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition(); this.requestResize(pos, idx === 0); }); 
                handle.on('dragend', (e) => { e.cancelBubble = true; this.planner.syncAll(); }); 
            }); 
            this.planner.uiLayer.add(this.leftHandle, this.rightHandle);
        }
        
        this.initEvents(); 
        this.planner.widgetLayer.add(this.visualGroup); 
        this.update();
    }

    hasEvent(eventName) { return this.config.events.includes(eventName); }
    
    requestResize(pos, isLeft) { 
        const wallLen = this.wall.getLength(); let targetT = this.wall.getClosestT(pos); 
        const fixedEdgeT = this.t + (isLeft ? (this.width / 2) / wallLen : -(this.width / 2) / wallLen); 
        let newWidth = Math.abs(fixedEdgeT - targetT) * wallLen; 
        if (newWidth < 10) newWidth = 10; 
        let newT = (fixedEdgeT + targetT) / 2; 
        if (newWidth === 10) { targetT = fixedEdgeT + (isLeft ? -10/wallLen : 10/wallLen); newT = (fixedEdgeT + targetT) / 2; } 
        const halfW = newWidth / 2; 
        if (newT - halfW/wallLen < 0 || newT + halfW/wallLen > 1) return; 
        this.width = newWidth; this.t = newT; this.update(); 
    }
    
    initEvents() { 
        this.visualGroup.on('mouseenter', () => { if (this.planner.tool === 'select') document.body.style.cursor = 'pointer'; }); 
        this.visualGroup.on('mouseleave', () => { document.body.style.cursor = 'default'; }); 
        this.visualGroup.on('mousedown touchstart', () => { this.visualGroup.moveToTop(); });
        this.visualGroup.on('dragstart', () => { this.isDragging = true; }); 
        this.visualGroup.on('dragmove', () => { 
            if (!this.hasEvent("drag_along_wall")) return; 
            const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
            
            let rawT = this.wall.getClosestT(pos); 
            const wallLen = this.wall.getLength(), halfW = this.width / 2; 
            const minT = halfW / wallLen, maxT = 1 - (halfW / wallLen); let t = rawT; const snapMargin = 15 / wallLen; 
            if (this.hasEvent("snap_to_corners")) { if (Math.abs(t - minT) < snapMargin) t = minT; if (Math.abs(maxT - t) < snapMargin) t = maxT; } 
            if (this.hasEvent("snap_to_center")) { if (Math.abs(t - 0.5) < snapMargin) t = 0.5; } 
            t = Math.max(minT, Math.min(maxT, t)); 
            this.t = t; this.update(); 
        }); 
        this.visualGroup.on('dragend', () => { setTimeout(() => { this.isDragging = false; }, 100); this.planner.syncAll(); }); 
        this.visualGroup.on('click tap', (e) => { 
            if (this.planner.tool === 'select' && !this.isDragging) { 
                e.cancelBubble = true; 
                this.planner.selectEntity(this, 'molding'); 
            } 
        }); 
    }

    update() { 
        if (!this.wall || !this.wall.startAnchor || !this.wall.endAnchor) return; 
        const start = this.wall.startAnchor.position(), end = this.wall.endAnchor.position(); 
        const dx = end.x - start.x, dy = end.y - start.y; 
        
        const cx = start.x + dx * this.t, cy = start.y + dy * this.t; 
        const th = this.wall.thickness || this.wall.config.thickness || 8; 
        
        const wallAngle = Math.atan2(dy, dx); 
        
        let nx = -Math.sin(wallAngle);
        let ny = Math.cos(wallAngle);
        
        if (this.side === 'right') {
            nx = -nx;
            ny = -ny;
        }
        
        const offsetDist = th / 2 + Math.max(2, this.depth / 2);
        const px = cx + nx * offsetDist; 
        const py = cy + ny * offsetDist;

        this.visualGroup.position({ x: px, y: py }); 
        this.visualGroup.rotation((wallAngle * 180) / Math.PI); 

        const visualDepth = Math.max(4, Math.abs(this.depth));
        this.moldingRect.width(this.width);
        this.moldingRect.height(visualDepth);
        this.moldingRect.x(-this.width / 2);
        this.moldingRect.y(-visualDepth / 2);

        this.hitBox.width(this.width); 
        this.hitBox.height(visualDepth + 10); 
        this.hitBox.x(-this.width / 2); 
        this.hitBox.y(-visualDepth / 2 - 5); 

        if (this.hasEvent("resize_handles_along_wall_axis")) {
            this.leftHandle.position({ x: px - Math.cos(wallAngle) * (this.width / 2), y: py - Math.sin(wallAngle) * (this.width / 2) }); 
            this.rightHandle.position({ x: px + Math.cos(wallAngle) * (this.width / 2), y: py + Math.sin(wallAngle) * (this.width / 2) }); 
        }
    }

    setSelection(isSelected) { 
        if (isSelected) { 
            this.moldingRect.stroke('#3b82f6'); this.moldingRect.strokeWidth(2); 
            if (this.hasEvent("resize_handles_along_wall_axis")) { this.leftHandle.show(); this.rightHandle.show(); } 
        } else { 
            this.moldingRect.stroke(null); this.moldingRect.strokeWidth(0); 
            if (this.hasEvent("resize_handles_along_wall_axis")) { this.leftHandle.hide(); this.rightHandle.hide(); } 
        } 
        this.visualGroup.moveToTop(); 
    }

    destroy() { 
        this.visualGroup.destroy(); 
        if (this.hasEvent("resize_handles_along_wall_axis")) { this.leftHandle.destroy(); this.rightHandle.destroy(); } 
    }

    remove() {
        this.destroy();
        this.wall.attachedMoldings = this.wall.attachedMoldings.filter(d => d !== this);
        this.planner.selectEntity(null);
        this.planner.syncAll();
    }

    serialize() { 
        return { 
            t: this.t, 
            type: this.type, 
            width: this.width, 
            depth: this.depth, 
            heightOffset: this.heightOffset, 
            side: this.side,
            profileType: this.profileType, 
            material: this.material, 
            color: this.color,
            layers: this.layers,
            layerGap: this.layerGap,
            grooveWidth: this.grooveWidth,
            frameWidth: this.frameWidth
        }; 
    }
}

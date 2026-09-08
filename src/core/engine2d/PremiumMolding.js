import Konva from 'konva';
import { MOLDING_REGISTRY, renderMolding2D } from '../../features/molding/index.js';
import { WallEngine } from '../wall/WallEngine.js';

export class PremiumMolding {
    constructor(planner, wall, t, configId) {
        this.planner = planner; 
        this.wall = wall; 
        this.t = t; 
        this.type = configId; 
        this.isDragging = false; 
        this.side = 'left';
        this.materialMode = 'PROCEDURAL';
        this.supportsLiveMaterialPipeline = true;
        
        this.config = MOLDING_REGISTRY[configId];
        Object.assign(this, JSON.parse(JSON.stringify(this.config.defaultConfig)));
        
        this.visualGroup = new Konva.Group({ draggable: false }); 
        this.hitBox = new Konva.Rect({ fill: 'transparent', listening: true });
        this.visualGroup.add(this.hitBox);
        
        // Representation of molding in 2D plan
        this.moldingPoly = new Konva.Line({ 
            fill: this.type === 'molding_groove' ? '#9ca3af' : '#10b981', 
            opacity: 0.7,
            closed: true
        }); 
        this.visualGroup.add(this.moldingPoly);
        
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
        this.isCustomWidth = true;
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
        this.visualGroup.on('dragend', () => { 
            if (this.dragTimeout) clearTimeout(this.dragTimeout);
            this.dragTimeout = setTimeout(() => { this.isDragging = false; }, 100); 
            this.planner.syncAll(); 
        });
        this.visualGroup.on('click tap', (e) => { 
            if (this.planner.tool === 'select' && !this.isDragging) { 
                e.cancelBubble = true; 
                this.planner.selectEntity(this, 'molding'); 
            } 
        }); 
    }

    update() { 
        if (!this.wall || !this.wall.startAnchor || !this.wall.endAnchor) return; 
        
        renderMolding2D(this, this.visualGroup, this.moldingPoly, this.hitBox);

        if (this.hasEvent("resize_handles_along_wall_axis")) {
            const start = typeof this.wall.startAnchor.position === 'function' ? this.wall.startAnchor.position() : this.wall.startAnchor;
            const end = typeof this.wall.endAnchor.position === 'function' ? this.wall.endAnchor.position() : this.wall.endAnchor;
            const wallAngle = Math.atan2(end.y - start.y, end.x - start.x);
            const px = this.visualGroup.x();
            const py = this.visualGroup.y();
            const currentWidth = this.width || this.wall.getLength();
            this.leftHandle.position({ x: px - Math.cos(wallAngle) * (currentWidth / 2), y: py - Math.sin(wallAngle) * (currentWidth / 2) }); 
            this.rightHandle.position({ x: px + Math.cos(wallAngle) * (currentWidth / 2), y: py + Math.sin(wallAngle) * (currentWidth / 2) }); 
        }
    }

    setHighlight(active) { 
        if (active) { 
            this.moldingPoly.stroke('#3b82f6'); this.moldingPoly.strokeWidth(2); 
            if (this.hasEvent("resize_handles_along_wall_axis")) { this.leftHandle.visible(true); this.rightHandle.visible(true); } 
        } else { 
            this.moldingPoly.stroke(null); this.moldingPoly.strokeWidth(0); 
            if (this.hasEvent("resize_handles_along_wall_axis")) { this.leftHandle.visible(false); this.rightHandle.visible(false); } 
        } 
        this.visualGroup.moveToTop(); 
    }

    setSelection(isSelected) { 
        if (isSelected) { 
            this.moldingPoly.stroke('#3b82f6'); this.moldingPoly.strokeWidth(2); 
            if (this.hasEvent("resize_handles_along_wall_axis")) { this.leftHandle.visible(true); this.rightHandle.visible(true); } 
            this.visualGroup.moveToTop();
        } else { 
            this.moldingPoly.stroke(null); this.moldingPoly.strokeWidth(0); 
            if (this.hasEvent("resize_handles_along_wall_axis")) { this.leftHandle.visible(false); this.rightHandle.visible(false); } 
        } 
    }

    destroy() { 
        if (this.dragTimeout) clearTimeout(this.dragTimeout);
        this.visualGroup.destroy(); 
        if (this.hasEvent("resize_handles_along_wall_axis")) { this.leftHandle.destroy(); this.rightHandle.destroy(); } 
    }

    remove() {
        this.destroy();
        if (this.wall) {
            WallEngine.removeMolding(this.wall, this, false, this.planner);
        }
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
            moldingHeight: this.moldingHeight || 10,
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

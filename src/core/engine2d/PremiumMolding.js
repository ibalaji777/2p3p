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
        const start = this.wall.startAnchor.position(), end = this.wall.endAnchor.position(); 
        const dx = end.x - start.x, dy = end.y - start.y; 
        
        let cx = start.x + dx * this.t, cy = start.y + dy * this.t; 
        const th = this.wall.thickness || this.wall.config.thickness || 8; 
        
        const wallAngle = Math.atan2(dy, dx); 
        
        let nx = -Math.sin(wallAngle);
        let ny = Math.cos(wallAngle);
        
        if (this.side === 'right') {
            nx = -nx;
            ny = -ny;
        }
        
        let px, py;
        let currentWidth = this.width;
        const wallLen = Math.hypot(dx, dy);

        if (Math.abs(this.width - wallLen) < 2 && this.wall.wallShapeData) {
            const startTrue = this.wall.wallShapeData.startData.trueCorners || this.wall.wallShapeData.startData.corners;
            const endTrue = this.wall.wallShapeData.endData.trueCorners || this.wall.wallShapeData.endData.corners;
            const edgeStart = this.side === 'right' ? startTrue[1] : startTrue[0];
            const edgeEnd = this.side === 'right' ? endTrue[1] : endTrue[0];
            
            currentWidth = Math.hypot(edgeEnd.x - edgeStart.x, edgeEnd.y - edgeStart.y);
            const edgeCx = (edgeStart.x + edgeEnd.x) / 2;
            const edgeCy = (edgeStart.y + edgeEnd.y) / 2;
            
            const depthOffset = Math.max(2, this.depth / 2);
            px = edgeCx + nx * depthOffset;
            py = edgeCy + ny * depthOffset;
        } else {
            const offsetDist = th / 2 + Math.max(2, this.depth / 2);
            px = cx + nx * offsetDist; 
            py = cy + ny * offsetDist;
        }

        this.visualGroup.position({ x: px, y: py }); 
        this.visualGroup.rotation((wallAngle * 180) / Math.PI); 
        
        const visualDepth = Math.max(4, Math.abs(this.depth));
        
        if (Math.abs(this.width - wallLen) < 2 && this.wall.wallShapeData) {
            // Full-length molding: compute perfectly mitered polygon
            const startTrue = this.wall.wallShapeData.startData.trueCorners || this.wall.wallShapeData.startData.corners;
            const endTrue = this.wall.wallShapeData.endData.trueCorners || this.wall.wallShapeData.endData.corners;
            const edgeStart = this.side === 'right' ? startTrue[1] : startTrue[0];
            const edgeEnd = this.side === 'right' ? endTrue[1] : endTrue[0];
            
            const pStart = start;
            const vStart = { x: edgeStart.x - pStart.x, y: edgeStart.y - pStart.y };
            const pEnd = end;
            const vEnd = { x: edgeEnd.x - pEnd.x, y: edgeEnd.y - pEnd.y };
            
            const scaleOuter = (th / 2 + visualDepth) / (th / 2);
            
            const outerStart = { x: pStart.x + vStart.x * scaleOuter, y: pStart.y + vStart.y * scaleOuter };
            const outerEnd = { x: pEnd.x + vEnd.x * scaleOuter, y: pEnd.y + vEnd.y * scaleOuter };
            
            // Convert global points to local space relative to the visualGroup
            const toLocal = (p) => {
                const lx = p.x - px;
                const ly = p.y - py;
                const cos = Math.cos(-wallAngle);
                const sin = Math.sin(-wallAngle);
                return { x: lx * cos - ly * sin, y: lx * sin + ly * cos };
            };
            
            const ls = toLocal(edgeStart);
            const le = toLocal(edgeEnd);
            const loe = toLocal(outerEnd);
            const los = toLocal(outerStart);
            
            this.moldingPoly.points([ls.x, ls.y, le.x, le.y, loe.x, loe.y, los.x, los.y]);
        } else {
            // Partial molding: just a rectangle
            this.moldingPoly.points([
                -currentWidth / 2, -visualDepth / 2,
                currentWidth / 2, -visualDepth / 2,
                currentWidth / 2, visualDepth / 2,
                -currentWidth / 2, visualDepth / 2
            ]);
        }

        this.hitBox.width(currentWidth); 
        this.hitBox.height(visualDepth + 10); 
        this.hitBox.x(-currentWidth / 2); 
        this.hitBox.y(-visualDepth / 2 - 5); 

        if (this.hasEvent("resize_handles_along_wall_axis")) {
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

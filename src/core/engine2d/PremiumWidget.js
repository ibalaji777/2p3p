    import Konva from 'konva';
import { WIDGET_REGISTRY } from '../registry.js';

export class PremiumWidget {
    constructor(planner, wall, t, configId) {
        this.planner = planner; this.wall = wall; this.t = t; this.type = configId; this.isDragging = false; 
        this.config = WIDGET_REGISTRY[configId];
        Object.assign(this, JSON.parse(JSON.stringify(this.config.defaultConfig)));
        
        this.cutter = new Konva.Rect({ height: wall.config.thickness + 4, fill: 'black', globalCompositeOperation: 'destination-out', listening: false }); 
        this.planner.wallLayer.add(this.cutter);
        
        this.visualGroup = new Konva.Group({ draggable: false }); 
        this.frameL = new Konva.Rect({ width: 4, fill: '#374151' }); 
        this.frameR = new Konva.Rect({ width: 4, fill: '#374151' }); 
        this.visualGroup.add(this.frameL, this.frameR);
        this.innerParts = new Konva.Group(); 
        this.visualGroup.add(this.innerParts);
        
        if (this.hasEvent("resize_handles_along_wall_axis")) {
            this.leftHandle = new Konva.Circle({ radius: 7, fill: '#10b981', stroke: 'white', strokeWidth: 2, draggable: true, visible: false }); 
            this.rightHandle = new Konva.Circle({ radius: 7, fill: '#10b981', stroke: 'white', strokeWidth: 2, draggable: true, visible: false });
            [this.leftHandle, this.rightHandle].forEach((handle, idx) => { 
                handle.on('mouseenter', () => document.body.style.cursor = 'ew-resize'); 
                handle.on('mouseleave', () => document.body.style.cursor = 'pointer'); 
                handle.on('dragstart', (e) => { e.cancelBubble = true; }); 
                handle.on('dragmove', (e) => { e.cancelBubble = true; this.requestResize(this.planner.stage.getPointerPosition(), idx === 0); }); 
                handle.on('dragend', (e) => { e.cancelBubble = true; this.planner.syncAll(); }); 
            }); 
            this.planner.uiLayer.add(this.leftHandle, this.rightHandle);
        }
        
        this.initEvents(); 
        this.planner.widgetLayer.add(this.visualGroup); 
        this.update();
    }

    hasEvent(eventName) { return this.config.events.includes(eventName); }
    
    checkOverlap(targetWall, proposedT, proposedWidth) { 
        const wallLen = targetWall.getLength(), pMin = proposedT * wallLen - proposedWidth / 2, pMax = proposedT * wallLen + proposedWidth / 2; 
        for (let w of targetWall.attachedWidgets) { 
            if (w === this) continue; 
            const wMin = w.t * wallLen - w.width / 2, wMax = w.t * wallLen + w.width / 2; 
            if (pMax > wMin + 1 && pMin < wMax - 1) return true; 
        } 
        return false; 
    }
    
    requestResize(pos, isLeft) { 
        const wallLen = this.wall.getLength(); let targetT = this.wall.getClosestT(pos); 
        const fixedEdgeT = this.t + (isLeft ? (this.width / 2) / wallLen : -(this.width / 2) / wallLen); 
        let newWidth = Math.abs(fixedEdgeT - targetT) * wallLen; 
        if (newWidth < 20) newWidth = 20; 
        let newT = (fixedEdgeT + targetT) / 2; 
        if (newWidth === 20) { targetT = fixedEdgeT + (isLeft ? -20/wallLen : 20/wallLen); newT = (fixedEdgeT + targetT) / 2; } 
        const halfW = newWidth / 2; 
        if (newT - halfW/wallLen < 0 || newT + halfW/wallLen > 1) return; 
        if (this.hasEvent("prevent_overlap") && this.checkOverlap(this.wall, newT, newWidth)) return; 
        this.width = newWidth; this.t = newT; this.update(); 
    }
    
    initEvents() { 
        this.visualGroup.on('mouseenter', () => { if (this.planner.tool === 'select') document.body.style.cursor = 'pointer'; }); 
        this.visualGroup.on('mouseleave', () => { document.body.style.cursor = 'default'; }); 
        this.visualGroup.on('dragstart', () => { this.isDragging = true; }); 
        this.visualGroup.on('dragmove', () => { 
            if (!this.hasEvent("drag_along_wall")) return; 
            const pos = this.planner.stage.getPointerPosition(); 
            let targetWall = this.wall; 
            if (this.hasEvent("jump_wall_to_wall")) { 
                let minDist = this.planner.getDistanceToWall(pos, this.wall); 
                this.planner.walls.forEach(w => { 
                    if (w === this.wall) return; 
                    const dist = this.planner.getDistanceToWall(pos, w); 
                    if (dist < minDist && dist < 50) { minDist = dist; targetWall = w; } 
                }); 
                if (targetWall !== this.wall) { 
                    let tempT = targetWall.getClosestT(pos); 
                    if (!this.hasEvent("prevent_overlap") || !this.checkOverlap(targetWall, tempT, this.width)) { 
                        this.wall.attachedWidgets = this.wall.attachedWidgets.filter(d => d !== this); 
                        this.wall = targetWall; this.wall.attachedWidgets.push(this); 
                    } 
                } 
            } 
            let rawT = this.wall.getClosestT(pos); 
            const wallLen = this.wall.getLength(), halfW = this.width / 2; 
            const minT = halfW / wallLen, maxT = 1 - (halfW / wallLen); let t = rawT; const snapMargin = 15 / wallLen; 
            if (this.hasEvent("snap_to_corners")) { if (Math.abs(t - minT) < snapMargin) t = minT; if (Math.abs(maxT - t) < snapMargin) t = maxT; } 
            if (this.hasEvent("snap_to_center")) { if (Math.abs(t - 0.5) < snapMargin) t = 0.5; } 
            t = Math.max(minT, Math.min(maxT, t)); 
            if (this.hasEvent("prevent_overlap") && this.checkOverlap(this.wall, t, this.width)) return; 
            this.t = t; this.update(); 
        }); 
        this.visualGroup.on('dragend', () => { setTimeout(() => { this.isDragging = false; }, 100); this.planner.syncAll(); }); 
        this.visualGroup.on('click', (e) => { if (this.planner.tool === 'select' && !this.isDragging) { this.planner.selectEntity(this, 'widget'); e.cancelBubble = true; } }); 
    }
    
    remove() { this.cutter.destroy(); this.visualGroup.destroy(); if (this.leftHandle) { this.leftHandle.destroy(); this.rightHandle.destroy(); } this.wall.attachedWidgets = this.wall.attachedWidgets.filter(d => d !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
    
    update() {
        const p1 = this.wall.startAnchor.position(), p2 = this.wall.endAnchor.position(), dx = p2.x - p1.x, dy = p2.y - p1.y, angle = Math.atan2(dy, dx) * 180 / Math.PI, absPos = { x: p1.x + dx * this.t, y: p1.y + dy * this.t }, thick = this.wall.config.thickness, hw = this.width / 2;
        this.cutter.width(this.width); this.cutter.offsetX(this.width / 2); this.cutter.offsetY((thick + 4) / 2); this.cutter.absolutePosition(absPos); this.cutter.rotation(angle);
        this.visualGroup.absolutePosition(absPos); this.visualGroup.rotation(angle); this.frameL.setAttrs({ height: thick, x: -hw, y: -thick/2 }); this.frameR.setAttrs({ height: thick, x: hw - 4, y: -thick/2 });
        this.innerParts.destroyChildren(); this.config.render2D(this.innerParts, this);
        if (this.leftHandle && this.rightHandle) { const rad = angle * Math.PI / 180, cosA = Math.cos(rad), sinA = Math.sin(rad); this.leftHandle.position({ x: absPos.x - hw * cosA, y: absPos.y - hw * sinA }); this.rightHandle.position({ x: absPos.x + hw * cosA, y: absPos.y + hw * sinA }); }
    }
}
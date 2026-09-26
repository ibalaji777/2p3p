import Konva from 'konva';
import { WIDGET_REGISTRY } from '../registry.js';
import { WallEngine, isFloorAnchoredDoor } from '../wall/WallEngine.js';
import { TransformEngine } from '../transform/TransformEngine.js';

export class PremiumWidget {
    constructor(planner, wall, t, configId) {
        this.planner = planner; this.wall = wall; this.t = t; this.type = configId; this.isDragging = false; 
        this.materialMode = 'PROCEDURAL';
        this.supportsLiveMaterialPipeline = true;
        this.config = WIDGET_REGISTRY[configId] || WIDGET_REGISTRY['door'] || { defaultConfig: {}, events: [] };
        if (this.config.defaultConfig) {
            Object.assign(this, JSON.parse(JSON.stringify(this.config.defaultConfig)));
        }
        if (isFloorAnchoredDoor(this)) {
            this.elevation = 0;
        }
        
        const thick = (wall.thickness || wall.config?.thickness || 20);
        this.cutter = new Konva.Rect({ height: thick + 4, fill: 'black', globalCompositeOperation: 'destination-out', listening: false }); 
        if (this.config.cutsWall !== false && this.planner?.wallLayer?.add) this.planner.wallLayer.add(this.cutter);
        
        this.visualGroup = new Konva.Group({ draggable: true }); 
        this.hitBox = new Konva.Rect({ fill: 'transparent', listening: true });
        this.visualGroup.add(this.hitBox);
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
                handle.on('dragmove', (e) => { e.cancelBubble = true; const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : (this.planner.stage?.getPointerPosition ? this.planner.stage.getPointerPosition() : { x: 0, y: 0 }); this.requestResize(pos, idx === 0); }); 
                handle.on('dragend', (e) => { e.cancelBubble = true; if (this.planner?.syncAll) this.planner.syncAll(); }); 
            }); 
            if (this.planner?.uiLayer?.add) this.planner.uiLayer.add(this.leftHandle, this.rightHandle);
        }
        
        this.initEvents(); 
        if (this.planner?.widgetLayer?.add) this.planner.widgetLayer.add(this.visualGroup); 
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
        this.visualGroup.on('mousedown touchstart', () => { this.visualGroup.moveToTop(); });
        this.visualGroup.on('dragstart', () => { 
            this.isDragging = true; 
            TransformEngine.startSession(this, 'move');
        }); 
        this.visualGroup.on('dragmove', () => { 
            if (!this.hasEvent("drag_along_wall")) return; 
            const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
            let targetWall = this.wall; 
            if (this.hasEvent("jump_wall_to_wall")) {
                let targetWall = this.wall;
                let minDist = this.planner.getDistanceToWall(pos, this.wall);
                this.planner.walls.forEach(w => {
                    if (w === this.wall || w.type === 'railing') return;
                    const dist = this.planner.getDistanceToWall(pos, w);
                    if (dist < minDist && dist < 50) { minDist = dist; targetWall = w; }
                });
                if (targetWall !== this.wall) {                    let tempT = targetWall.getClosestT(pos); 
                    if (!this.hasEvent("prevent_overlap") || !this.checkOverlap(targetWall, tempT, this.width)) { 
                        WallEngine.removeWidget(this.wall, this, false, this.planner); 
                        this.wall = targetWall;
                        WallEngine.attachWidget(targetWall, this, false, this.planner); 
                    } 
                } 
            } 
            let rawT = this.wall.getClosestT(pos); 
            const wallLen = this.wall.getLength(), halfW = this.width / 2; 
            const minT = halfW / wallLen, maxT = 1 - (halfW / wallLen); let t = rawT; const snapMargin = 15 / wallLen; 
            if (this.hasEvent("snap_to_corners")) { if (Math.abs(t - minT) < snapMargin) t = minT; if (Math.abs(maxT - t) < snapMargin) t = maxT; } 
            if (this.hasEvent("snap_to_center")) { 
                if (Math.abs(rawT - 0.5) < snapMargin) { 
                    t = 0.5; 
                    if (this.hasEvent("auto_expand_on_center")) this.width = wallLen;
                } 
            } 
            t = Math.max(minT, Math.min(maxT, t)); 
            if (this.hasEvent("prevent_overlap") && this.checkOverlap(this.wall, t, this.width)) return; 
            this.t = t; 
            this.update(); 
            if (TransformEngine.isSessionActive()) {
                TransformEngine.previewMove(this, { absoluteT: t });
            }
        }); 
        this.visualGroup.on('dragend', () => { 
            if (this.dragTimeout) clearTimeout(this.dragTimeout);
            this.dragTimeout = setTimeout(() => { this.isDragging = false; }, 100); 
            if (TransformEngine.isSessionActive()) {
                TransformEngine.commitSession(this.planner);
            }
            this.planner.syncAll(); 
        }); 
        this.visualGroup.on('click tap', (e) => { 
            if (this.planner.tool === 'select' && !this.isDragging) { 
                this.planner.selectEntity(this, 'widget'); 
                e.cancelBubble = true; 
                if (e.evt) e.evt.stopPropagation();
            } 
        }); 
        this.visualGroup.on('dblclick dbltap', (e) => {
            if (this.planner.tool === 'select') {
                this.facing = this.facing === 1 ? -1 : 1;
                this.update();
                this.planner.syncAll();
                e.cancelBubble = true;
                if (e.evt) e.evt.stopPropagation();
            }
        });
    }
    
    remove() { 
        if (this.dragTimeout) clearTimeout(this.dragTimeout);
        if (this.cutter && typeof this.cutter.destroy === 'function') this.cutter.destroy();
        if (this.visualGroup && typeof this.visualGroup.destroy === 'function') this.visualGroup.destroy();
        if (this.leftHandle && typeof this.leftHandle.destroy === 'function') this.leftHandle.destroy();
        if (this.rightHandle && typeof this.rightHandle.destroy === 'function') this.rightHandle.destroy();
        if (this.wall) { WallEngine.removeWidget(this.wall, this, false, this.planner); }
        if (this.planner && typeof this.planner.selectEntity === 'function' && this.planner.selectedEntity === this) {
            this.planner.selectEntity(null);
        }
        if (this.planner && typeof this.planner.syncAll === 'function') this.planner.syncAll(); 
    }
    
    update() {
        if (!this.wall) return;
        if (isFloorAnchoredDoor(this)) {
            this.elevation = 0;
        }
        const p1 = typeof this.wall.startAnchor?.position === 'function' 
            ? this.wall.startAnchor.position() 
            : (this.wall.startAnchor || { x: this.wall.startX || 0, y: this.wall.startY || 0 });
        const p2 = typeof this.wall.endAnchor?.position === 'function' 
            ? this.wall.endAnchor.position() 
            : (this.wall.endAnchor || { x: this.wall.endX || 0, y: this.wall.endY || 0 });
        const dx = p2.x - p1.x, dy = p2.y - p1.y, angle = Math.atan2(dy, dx) * 180 / Math.PI, absPos = { x: p1.x + dx * this.t, y: p1.y + dy * this.t }, thick = this.wall.thickness || this.wall.config?.thickness || 20, hw = this.width / 2;
        if (this.cutter) {
            this.cutter.width(this.width); this.cutter.height(thick + 4); this.cutter.offsetX(this.width / 2); this.cutter.offsetY((thick + 4) / 2); this.cutter.position(absPos); this.cutter.rotation(angle);
        }
        if (this.visualGroup) {
            this.visualGroup.position(absPos); this.visualGroup.rotation(angle);
        }
        if (this.frameL && this.frameR) {
            this.frameL.setAttrs({ height: thick, x: -hw, y: -thick/2 }); this.frameR.setAttrs({ height: thick, x: hw - 4, y: -thick/2 });
        }
        const hitHeight = Math.max(thick + 20, this.width * 2);
        if (this.hitBox) {
            this.hitBox.setAttrs({ x: -hw, y: -hitHeight / 2, width: this.width, height: hitHeight });
        }
        if (this.innerParts) {
            this.innerParts.destroyChildren();
            if (this.config?.render2D) this.config.render2D(this.innerParts, this);
        }
        if (this.leftHandle && this.rightHandle) { const rad = angle * Math.PI / 180, cosA = Math.cos(rad), sinA = Math.sin(rad); this.leftHandle.position({ x: absPos.x - hw * cosA, y: absPos.y - hw * sinA }); this.rightHandle.position({ x: absPos.x + hw * cosA, y: absPos.y + hw * sinA }); }
    }

    serialize() {
        return {
            id: this.id,
            t: this.t,
            type: this.type || this.configId,
            configId: this.type || this.configId,
            width: this.width,
            height: this.height,
            depth: this.depth,
            elevation: isFloorAnchoredDoor(this) ? 0 : this.elevation,
            thick: this.thick,
            facing: this.facing,
            side: this.side,
            profileType: this.profileType,
            fasciaMat: this.fasciaMat,
            topArm: this.topArm,
            bottomArm: this.bottomArm,
            sunshadeType: this.sunshadeType,
            pattern: this.pattern,
            jaliMount: this.jaliMount,
            doorType: this.doorType,
            doorShape: this.doorShape || this.params?.doorShape,
            doorStyle: this.doorStyle || this.params?.doorStyle,
            doorMat: this.doorMat,
            windowType: this.windowType,
            windowShape: this.windowShape || this.params?.windowShape,
            frameMat: this.frameMat,
            glassMat: this.glassMat,
            grillePattern: this.grillePattern,
            grilleProfile: this.grilleProfile,
            patternStyle: this.patternStyle,
            rows: this.rows,
            cols: this.cols,
            spacing: this.spacing,
            decorConfigId: this.decorConfigId,
            description: this.description,
            anchorMode: this.anchorMode || 'bottom',
            parentWallId: this.parentWallId || this.wall?.id,
            materials: this.materials ? JSON.parse(JSON.stringify(this.materials)) : undefined,
            params: this.params ? JSON.parse(JSON.stringify(this.params)) : undefined
        };
    }
}
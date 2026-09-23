import Konva from 'konva';
import { MOLDING_REGISTRY } from '../../features/molding/molding.registry.js';
import { renderMolding2D } from '../../features/molding/molding.renderer2d.js';
import { TransformEngine } from '../transform/TransformEngine.js';

export class PremiumMolding {
    constructor(planner, wall, t, configId) {
        this.planner = planner; 
        this.wall = wall; 
        this.t = t; 
        this.type = configId; 
        this.isDragging = false; 
        this.side = 'left';
        this.id = 'mold_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        this.materialMode = 'PROCEDURAL';
        this.supportsLiveMaterialPipeline = true;
        
        const reg = MOLDING_REGISTRY || {};
        this.config = reg[configId] || reg['molding_skirting_flat'] || { defaultConfig: {}, events: [] };
        if (this.config.defaultConfig) {
            Object.assign(this, JSON.parse(JSON.stringify(this.config.defaultConfig)));
        }
        
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
                handle.on('dragmove', (e) => { e.cancelBubble = true; const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : (this.planner.stage?.getPointerPosition ? this.planner.stage.getPointerPosition() : { x: 0, y: 0 }); this.requestResize(pos, idx === 0); }); 
                handle.on('dragend', (e) => { e.cancelBubble = true; if (this.planner?.syncAll) this.planner.syncAll(); }); 
            }); 
            if (this.planner?.uiLayer?.add) this.planner.uiLayer.add(this.leftHandle, this.rightHandle);
        }
        
        this.initEvents(); 
        if (this.planner?.widgetLayer?.add) this.planner.widgetLayer.add(this.visualGroup); 
        this.update();
    }

    hasEvent(eventName) { return Array.isArray(this.config?.events) && this.config.events.includes(eventName); }
    
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
        this.visualGroup.on('dragstart', () => { 
            this.isDragging = true; 
            TransformEngine.startSession(this, 'openings');
        }); 
        this.visualGroup.on('dragmove', () => { 
            if (!this.hasEvent("drag_along_wall")) return; 
            const pos = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
            
            let rawT = this.wall.getClosestT(pos); 
            const wallLen = this.wall.getLength(), halfW = this.width / 2; 
            const minT = halfW / wallLen, maxT = 1 - (halfW / wallLen); let t = rawT; const snapMargin = 15 / wallLen; 
            if (this.hasEvent("snap_to_corners")) { if (Math.abs(t - minT) < snapMargin) t = minT; if (Math.abs(maxT - t) < snapMargin) t = maxT; } 
            if (this.hasEvent("snap_to_center")) { if (Math.abs(t - 0.5) < snapMargin) t = 0.5; } 
            t = Math.max(minT, Math.min(maxT, t)); 
            if (TransformEngine.isSessionActive()) {
                TransformEngine.previewMove(this, { absoluteT: t });
            } else {
                this.t = t; 
                this.update(); 
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
        if (this.visualGroup && typeof this.visualGroup.destroy === 'function') this.visualGroup.destroy(); 
        if (this.hasEvent("resize_handles_along_wall_axis")) { 
            if (this.leftHandle && typeof this.leftHandle.destroy === 'function') this.leftHandle.destroy(); 
            if (this.rightHandle && typeof this.rightHandle.destroy === 'function') this.rightHandle.destroy(); 
        } 
    }

    remove() {
        this.destroy();
        if (this.wall && Array.isArray(this.wall.attachedMoldings)) {
            const idx = this.wall.attachedMoldings.indexOf(this);
            if (idx !== -1) {
                this.wall.attachedMoldings.splice(idx, 1);
            }
        }
        if (this.planner && typeof this.planner.selectEntity === 'function' && this.planner.selectedEntity === this) {
            this.planner.selectEntity(null);
        }
        if (this.planner && typeof this.planner.syncAll === 'function') {
            this.planner.syncAll();
        }
    }

    serialize() { 
        return { 
            id: this.id,
            t: this.t, 
            type: this.type || this.configId, 
            configId: this.configId || this.type,
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
            frameWidth: this.frameWidth,
            anchorMode: this.anchorMode || (this.type && (this.type.includes('crown') || this.type.includes('frieze') || this.type.includes('cornice')) ? 'top' : 'bottom'),
            parentWallId: this.parentWallId || this.wall?.id,
            materials: this.materials ? JSON.parse(JSON.stringify(this.materials)) : undefined,
            params: this.params ? JSON.parse(JSON.stringify(this.params)) : undefined
        }; 
    }
}

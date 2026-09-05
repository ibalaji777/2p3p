import Konva from 'konva';
import { SNAP_DIST } from '../registry.js';

export const PLATFORM_TRIM_STYLES = {
    flat: { id: 'flat', name: 'Clean Modern Riser', icon: 'square' },
    beveled: { id: 'beveled', name: 'Chamfered Bevel', icon: 'slash' },
    bullnose: { id: 'bullnose', name: 'Bullnose Fillet', icon: 'circle' },
    classical: { id: 'classical', name: 'Classical Molded', icon: 'layers' },
    recessed_led: { id: 'recessed_led', name: 'Floating LED Reveal', icon: 'sun' },
    stone: { id: 'stone', name: 'Stone Plinth', icon: 'shield' }
};

export class PremiumPlatform {
    constructor(planner, type = 'platform', params = {}) {
        this.planner = planner;
        this.type = 'platform';
        this.id = params.id || ('platform_' + Math.random().toString(36).substr(2, 9));
        this.name = params.name || 'Platform';
        this.shapeType = params.shapeType || (params.points && params.points.length >= 3 ? 'polygon' : 'rect');

        this.materialMode = 'PROCEDURAL';
        this.supportsLiveMaterialPipeline = true;
        this.params = params || {};
        this.rotation = Number(params.rotation) || 0;

        // Dimensions (cm)
        this.width = params.width !== undefined ? Number(params.width) : 120;
        this.depth = params.depth !== undefined ? Number(params.depth) : 120;
        this.height = params.height !== undefined ? Number(params.height) : 20; // Default 1 step (20cm)
        this.stepHeight = params.stepHeight !== undefined ? Number(params.stepHeight) : 15; // 15cm standard step
        this.elevation = params.elevation !== undefined ? Number(params.elevation) : 0;
        this.trimStyle = params.trimStyle || 'flat';

        // Dual Material Slots (3-Layer CAD/BIM standard)
        this.materials = {
            top: params.materials?.top || { id: params.material || params.configId || 'wood_golden_teak' },
            side: params.materials?.side || { id: params.sideMaterial || 'wood_white_oak' }
        };

        // 2D Visuals
        this.fill = params.fill || 'rgba(245, 158, 11, 0.22)';
        this.stroke = params.stroke || '#d97706';
        this.isSunken = this.height < 0;

        // Polygonal points (relative to center)
        let rawPoints = params.points || [];
        if (this.shapeType === 'polygon' && rawPoints.length > 0 && params.x === undefined && params.y === undefined) {
            let cx = 0, cy = 0;
            rawPoints.forEach(p => { cx += p.x; cy += p.y; });
            cx /= rawPoints.length;
            cy /= rawPoints.length;
            this.x = cx;
            this.y = cy;
            this.points = rawPoints.map(p => ({ x: p.x - cx, y: p.y - cy }));
        } else {
            this.x = params.x !== undefined ? Number(params.x) : 0;
            this.y = params.y !== undefined ? Number(params.y) : 0;
            this.points = rawPoints.map(p => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 }));
        }

        this.mesh3D = null;
        this.isDragging = false;
        this.attachedWall = null;

        this._initKonva();
    }

    /* -------------------------------------------------------------------------- */
    /*                              2D KONVA SETUP                                */
    /* -------------------------------------------------------------------------- */

    _initKonva() {
        this.group = new Konva.Group({
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            draggable: true,
            name: 'platform-group'
        });

        // 1. Base shape
        if (this.shapeType === 'rect') {
            this.shape = new Konva.Rect({
                width: this.width,
                height: this.depth,
                offsetX: this.width / 2,
                offsetY: this.depth / 2,
                fill: this.fill,
                stroke: this.stroke,
                strokeWidth: 2,
                cornerRadius: 2,
                shadowColor: 'rgba(0,0,0,0.2)',
                shadowBlur: 8,
                shadowOffset: { x: 2, y: 2 }
            });
        } else {
            const flatPts = [];
            (this.points || []).forEach(p => flatPts.push(p.x, p.y));
            this.shape = new Konva.Line({
                points: flatPts,
                closed: true,
                fill: this.fill,
                stroke: this.stroke,
                strokeWidth: 2,
                shadowColor: 'rgba(0,0,0,0.2)',
                shadowBlur: 8,
                shadowOffset: { x: 2, y: 2 }
            });
        }
        this.group.add(this.shape);

        // 2. Interior Step Lines (shows concentric or parallel step lines for multi-step platforms)
        this.stepLinesGroup = new Konva.Group({ listening: false });
        this.group.add(this.stepLinesGroup);

        // 3. Selection Highlight
        this.highlightLine = new Konva.Rect({
            width: this.width + 6,
            height: this.depth + 6,
            offsetX: (this.width + 6) / 2,
            offsetY: (this.depth + 6) / 2,
            stroke: '#00f0ff',
            strokeWidth: 2.5,
            dash: [6, 4],
            listening: false,
            visible: false
        });
        this.group.add(this.highlightLine);

        // 4. Center Info Badge (Sims 4 Platform Step Badge)
        this.badgeGroup = new Konva.Group({ listening: false });
        this.badgeBg = new Konva.Tag({
            fill: '#0f172a',
            stroke: this.height < 0 ? '#ef4444' : '#10b981',
            strokeWidth: 1.5,
            cornerRadius: 12,
            shadowColor: 'rgba(0,0,0,0.4)',
            shadowBlur: 6
        });
        this.badgeText = new Konva.Text({
            text: this.getStepLabel(),
            fontSize: 11,
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'bold',
            fill: '#ffffff',
            padding: 5,
            align: 'center'
        });
        this.badgeLabel = new Konva.Label({ listening: false });
        this.badgeLabel.add(this.badgeBg);
        this.badgeLabel.add(this.badgeText);
        this.badgeGroup.add(this.badgeLabel);
        this.group.add(this.badgeGroup);

        // 5. Rotation Handle
        this.rotHandle = new Konva.Circle({
            radius: 6,
            fill: '#00f0ff',
            stroke: '#ffffff',
            strokeWidth: 2,
            draggable: true,
            visible: false,
            name: 'platform-rotater'
        });
        this.group.add(this.rotHandle);

        // 6. Resizing Handles for Rectangles
        this.resizeHandles = new Konva.Group({ visible: false });
        this._createResizeHandles();
        this.group.add(this.resizeHandles);

        // Layer Placement
        if (this.planner && this.planner.baseLayer) {
            this.planner.baseLayer.add(this.group);
        } else if (this.planner && this.planner.furnitureLayer) {
            this.planner.furnitureLayer.add(this.group);
        }

        this._bindEvents();
        this.update();
    }

    _createResizeHandles() {
        this.resizeHandles.destroyChildren();
        if (this.shapeType !== 'rect') return;

        const corners = [
            { name: 'tl', cursor: 'nwse-resize' },
            { name: 'tr', cursor: 'nesw-resize' },
            { name: 'br', cursor: 'nwse-resize' },
            { name: 'bl', cursor: 'nesw-resize' }
        ];

        corners.forEach(c => {
            const handle = new Konva.Rect({
                width: 10,
                height: 10,
                offsetX: 5,
                offsetY: 5,
                fill: '#ffffff',
                stroke: '#0284c7',
                strokeWidth: 2,
                draggable: true,
                name: `handle-${c.name}`
            });

            handle.on('mouseenter', () => { document.body.style.cursor = c.cursor; });
            handle.on('mouseleave', () => { document.body.style.cursor = 'default'; });

            handle.on('dragmove', (e) => {
                e.cancelBubble = true;
                const pos = handle.position();
                const newW = Math.max(20, Math.abs(pos.x * 2));
                const newD = Math.max(20, Math.abs(pos.y * 2));
                this.width = Math.round(newW);
                this.depth = Math.round(newD);

                this.update();
                this._sync3DGeometry();
                if (this.planner?.syncAll) this.planner.syncAll();
            });

            handle.on('dragend', () => {
                this.update();
                this._sync3DGeometry();
                if (this.planner?.debouncedSaveHistory) this.planner.debouncedSaveHistory();
            });

            this.resizeHandles.add(handle);
        });
    }

    _bindEvents() {
        this.group.on('mouseenter', () => {
            if (this.planner?.tool === 'select') document.body.style.cursor = 'move';
        });
        this.group.on('mouseleave', () => {
            document.body.style.cursor = 'default';
        });

        this.group.on('mousedown touchstart', (e) => {
            this.group.moveToTop();
            if (this.planner?.tool === 'select') {
                e.cancelBubble = true;
                if (e.evt) e.evt.stopPropagation();
                this.planner.selectEntity(this, 'platform');
            }
        });

        this.group.on('dragstart', () => {
            this.isDragging = true;
            this.resizeHandles.visible(false);
            this.rotHandle.visible(false);
            const pointer = this.planner?.getPointerPos ? this.planner.getPointerPos() : this.planner?.stage?.getPointerPosition() || { x: 0, y: 0 };
            const pos = this.group.position();
            this.dragOffset = { x: pos.x - pointer.x, y: pos.y - pointer.y };
        });

        this.group.on('dragmove', (e) => {
            if (e.target !== this.group) return;
            const pointer = this.planner?.getPointerPos ? this.planner.getPointerPos() : this.planner?.stage?.getPointerPosition() || { x: 0, y: 0 };
            const rawX = pointer.x + (this.dragOffset ? this.dragOffset.x : 0);
            const rawY = pointer.y + (this.dragOffset ? this.dragOffset.y : 0);

            this.x = Math.round(rawX);
            this.y = Math.round(rawY);
            this.group.position({ x: this.x, y: this.y });

            this._sync3DTransform();
            if (this.planner?.syncAll) this.planner.syncAll();
        });

        this.group.on('dragend', () => {
            this.isDragging = false;
            this.x = Math.round(this.group.x());
            this.y = Math.round(this.group.y());
            this.update();
            this._sync3DTransform();
            if (this.planner?.debouncedSaveHistory) this.planner.debouncedSaveHistory();
        });

        // Rotation Handle drag
        this.rotHandle.on('dragmove', (e) => {
            e.cancelBubble = true;
            const hPos = this.rotHandle.position();
            let angle = Math.atan2(hPos.y, hPos.x) * 180 / Math.PI + 90;
            // Snap to 15 degrees or 45/90
            if (Math.abs(angle % 45) < 5) angle = Math.round(angle / 45) * 45;
            this.rotation = Math.round(angle);
            this.group.rotation(this.rotation);
            this._sync3DTransform();
            if (this.planner?.syncAll) this.planner.syncAll();
        });

        this.rotHandle.on('dragend', () => {
            this.update();
            this._sync3DTransform();
            if (this.planner?.debouncedSaveHistory) this.planner.debouncedSaveHistory();
        });
    }

    /* -------------------------------------------------------------------------- */
    /*                         SIMS 4 PLATFORM OPERATIONS                         */
    /* -------------------------------------------------------------------------- */

    /**
     * Raises platform height by step increment (The Sims 4 ▲ Up Arrow).
     * @param {number} [step] 
     */
    raisePlatform(step = this.stepHeight) {
        this.height = Math.round((this.height + step) * 10) / 10;
        this.isSunken = this.height < 0;
        this.update();
        this._sync3DGeometry();
        if (this.planner?.syncAll) this.planner.syncAll();
        if (this.planner?.debouncedSaveHistory) this.planner.debouncedSaveHistory();
        return this.height;
    }

    stepUp(step = this.stepHeight) {
        return this.raisePlatform(step);
    }

    /**
     * Lowers platform height by step increment (The Sims 4 ▼ Down Arrow).
     * Supports negative values for sunken conversation pits.
     * @param {number} [step] 
     */
    lowerPlatform(step = this.stepHeight) {
        this.height = Math.round((this.height - step) * 10) / 10;
        this.isSunken = this.height < 0;
        this.update();
        this._sync3DGeometry();
        if (this.planner?.syncAll) this.planner.syncAll();
        if (this.planner?.debouncedSaveHistory) this.planner.debouncedSaveHistory();
        return this.height;
    }

    stepDown(step = this.stepHeight) {
        return this.lowerPlatform(step);
    }

    getStepBadgeText() {
        return this.getStepLabel();
    }

    setHeight(h) {
        this.height = Number(h) || 0;
        this.isSunken = this.height < 0;
        this.update();
        this._sync3DGeometry();
        if (this.planner?.syncAll) this.planner.syncAll();
        if (this.planner?.debouncedSaveHistory) this.planner.debouncedSaveHistory();
    }

    setElevation(elev) {
        this.elevation = Number(elev) || 0;
        this._sync3DTransform();
        if (this.planner?.syncAll) this.planner.syncAll();
        if (this.planner?.debouncedSaveHistory) this.planner.debouncedSaveHistory();
    }

    setDimensions(width, depth) {
        if (width !== undefined) this.width = Math.max(10, Number(width));
        if (depth !== undefined) this.depth = Math.max(10, Number(depth));
        this.update();
        this._sync3DGeometry();
        if (this.planner?.syncAll) this.planner.syncAll();
        if (this.planner?.debouncedSaveHistory) this.planner.debouncedSaveHistory();
    }

    setTrimStyle(style) {
        if (PLATFORM_TRIM_STYLES[style]) {
            this.trimStyle = style;
            this._sync3DGeometry();
            if (this.planner?.debouncedSaveHistory) this.planner.debouncedSaveHistory();
        }
    }

    setMaterial(slot, matId) {
        if (!this.materials) this.materials = {};
        this.materials[slot] = { id: matId };
        this._sync3DMaterials();
        if (this.planner?.debouncedSaveHistory) this.planner.debouncedSaveHistory();
    }

    getStepCount() {
        const stepH = this.stepHeight || 15;
        return Math.max(1, Math.round(Math.abs(this.height) / stepH));
    }

    getStepLabel() {
        const count = this.getStepCount();
        const stepsText = count === 1 ? '1 Step' : `${count} Steps`;
        if (this.height < 0) {
            return `▼ ${this.height.toFixed(0)}cm (${stepsText} Down)`;
        } else if (this.height === 0) {
            return `Level (0cm)`;
        } else {
            return `▲ +${this.height.toFixed(0)}cm (${stepsText})`;
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                              UPDATE & RENDER                               */
    /* -------------------------------------------------------------------------- */

    update() {
        this.isSunken = this.height < 0;
        const colorBorder = this.isSunken ? '#ef4444' : '#d97706';
        const colorFill = this.isSunken ? 'rgba(239, 68, 68, 0.22)' : 'rgba(245, 158, 11, 0.22)';

        if (this.shapeType === 'rect') {
            this.shape.width(this.width);
            this.shape.height(this.depth);
            this.shape.offsetX(this.width / 2);
            this.shape.offsetY(this.depth / 2);
            this.shape.fill(colorFill);
            this.shape.stroke(colorBorder);

            this.highlightLine.width(this.width + 6);
            this.highlightLine.height(this.depth + 6);
            this.highlightLine.offsetX((this.width + 6) / 2);
            this.highlightLine.offsetY((this.depth + 6) / 2);

            // Update handles
            const hw = this.width / 2;
            const hd = this.depth / 2;
            const tl = this.resizeHandles.findOne('.handle-tl');
            const tr = this.resizeHandles.findOne('.handle-tr');
            const br = this.resizeHandles.findOne('.handle-br');
            const bl = this.resizeHandles.findOne('.handle-bl');
            if (tl) tl.position({ x: -hw, y: -hd });
            if (tr) tr.position({ x: hw, y: -hd });
            if (br) br.position({ x: hw, y: hd });
            if (bl) bl.position({ x: -hw, y: hd });

            this.rotHandle.position({ x: 0, y: -hd - 20 });
        } else {
            const flatPts = [];
            (this.points || []).forEach(p => flatPts.push(p.x, p.y));
            this.shape.points(flatPts);
            this.shape.fill(colorFill);
            this.shape.stroke(colorBorder);
            this.rotHandle.position({ x: 0, y: -40 });
        }

        // Update step lines
        this._updateStepLines();

        // Update badge text and position
        this.badgeText.text(this.getStepLabel());
        this.badgeBg.stroke(this.isSunken ? '#ef4444' : '#10b981');

        const badgeW = this.badgeLabel.width();
        const badgeH = this.badgeLabel.height();
        this.badgeLabel.offsetX(badgeW / 2);
        this.badgeLabel.offsetY(badgeH / 2);

        if (this.group?.layer) this.group.layer.batchDraw();
    }

    _updateStepLines() {
        this.stepLinesGroup.destroyChildren();
        const steps = this.getStepCount();
        if (steps <= 1) return;

        // Draw inner concentric step rectangles/lines indicating tier levels
        if (this.shapeType === 'rect') {
            const hw = this.width / 2;
            const hd = this.depth / 2;
            const maxOffset = Math.min(hw * 0.4, hd * 0.4, 25);
            for (let i = 1; i < steps; i++) {
                const off = (maxOffset / steps) * i;
                const innerRect = new Konva.Rect({
                    width: (hw - off) * 2,
                    height: (hd - off) * 2,
                    offsetX: hw - off,
                    offsetY: hd - off,
                    stroke: this.isSunken ? 'rgba(239, 68, 68, 0.35)' : 'rgba(217, 119, 6, 0.35)',
                    strokeWidth: 1,
                    dash: [4, 4],
                    listening: false
                });
                this.stepLinesGroup.add(innerRect);
            }
        }
    }

    setHighlight(active) {
        this.highlightLine.visible(active);
        this.resizeHandles.visible(active && this.shapeType === 'rect');
        this.rotHandle.visible(active);
        if (this.group?.layer) this.group.layer.batchDraw();
    }

    /* -------------------------------------------------------------------------- */
    /*                         IN-PLACE 3D SYNCHRONIZATION                        */
    /* -------------------------------------------------------------------------- */

    _sync3DTransform() {
        if (!this.mesh3D) return;
        this.mesh3D.position.x = this.x;
        this.mesh3D.position.z = this.y;
        this.mesh3D.position.y = (this.elevation || 0) + (this.height < 0 ? this.height : 0);
        this.mesh3D.rotation.y = -this.rotation * Math.PI / 180;
        if (this.planner?.renderer3D?.requestRender) {
            this.planner.renderer3D.requestRender();
        }
    }

    _sync3DGeometry() {
        if (!this.mesh3D || !this.mesh3D.userData?.builder) return;
        this.mesh3D.userData.builder.updatePlatformGeometry(this);
    }

    _sync3DMaterials() {
        if (!this.mesh3D || !this.mesh3D.userData?.builder) return;
        this.mesh3D.userData.builder.updatePlatformMaterials(this);
    }

    /* -------------------------------------------------------------------------- */
    /*                               SERIALIZATION                                */
    /* -------------------------------------------------------------------------- */

    export() {
        return {
            id: this.id,
            type: 'platform',
            name: this.name,
            shapeType: this.shapeType,
            width: this.width,
            depth: this.depth,
            height: this.height,
            stepHeight: this.stepHeight,
            elevation: this.elevation,
            trimStyle: this.trimStyle,
            materials: JSON.parse(JSON.stringify(this.materials)),
            rotation: this.rotation,
            x: this.x,
            y: this.y,
            points: (this.points || []).map(p => ({ x: p.x, y: p.y })),
            fill: this.fill,
            stroke: this.stroke
        };
    }

    toJSON() {
        return this.export();
    }

    exportState() {
        return this.export();
    }

    destroy() {
        if (this.group) {
            this.group.destroy();
        }
        if (this.mesh3D && this.mesh3D.parent) {
            this.mesh3D.parent.remove(this.mesh3D);
        }
        if (this.planner && this.planner.platforms) {
            this.planner.platforms = this.planner.platforms.filter(p => p !== this);
        }
    }
}

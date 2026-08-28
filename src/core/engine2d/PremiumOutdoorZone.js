import Konva from 'konva';
import { SNAP_DIST } from '../registry.js';

export const OUTDOOR_ZONE_TYPES = {
    pavement: {
        id: 'pavement',
        label: 'Pavement',
        description: 'Hard-surface areas such as driveways, walkways, parking areas, paved paths, etc.',
        defaultMaterial: 'tile_yellow_hexagon',
        fill: 'rgba(234, 179, 8, 0.30)',
        stroke: '#ca8a04',
        badgeColor: '#854d0e',
        badgeIcon: 'car',
        defaultHeight3D: 0.3
    },
    patio: {
        id: 'patio',
        label: 'Patio',
        description: 'A dedicated outdoor sitting/entertainment area attached to or near the house.',
        defaultMaterial: 'tile_yellow_cotto_squares',
        fill: 'rgba(217, 119, 6, 0.28)',
        stroke: '#b45309',
        badgeColor: '#92400e',
        badgeIcon: 'patio',
        defaultHeight3D: 0.3
    },
    softscape: {
        id: 'softscape',
        label: 'Softscape',
        description: 'Landscaped/green areas such as lawn, planting beds, trees, shrubs, and garden zones.',
        defaultMaterial: 'grass',
        fill: 'rgba(34, 197, 94, 0.28)',
        stroke: '#16a34a',
        badgeColor: '#15803d',
        badgeIcon: 'flower',
        defaultHeight3D: 0.3
    },
    other_space: {
        id: 'other_space',
        label: 'Other space',
        description: 'Miscellaneous outdoor areas that don\'t fit into pavement, patio, or landscaping.',
        defaultMaterial: 'tile_beige_limestone',
        fill: 'rgba(148, 163, 184, 0.30)',
        stroke: '#64748b',
        badgeColor: '#475569',
        badgeIcon: 'polygon',
        defaultHeight3D: 0.3
    }
};

export class PremiumOutdoorZone {
    constructor(planner, type = 'outdoor_zone', params = {}) {
        this.planner = planner;
        this.type = 'outdoor_zone';
        this.subType = params.subType || 'pavement';
        this.id = params.id || ('zone_' + Math.random().toString(36).substr(2, 9));
        this.name = params.name || (OUTDOOR_ZONE_TYPES[this.subType]?.label || 'Outdoor Zone');
        this.materialMode = 'PROCEDURAL';
        this.supportsLiveMaterialPipeline = true;
        this.params = params || {};
        this.rotation = params.rotation || 0;

        const typeDefaults = OUTDOOR_ZONE_TYPES[this.subType] || OUTDOOR_ZONE_TYPES.pavement;
        this.configId = params.configId || params.material || typeDefaults.defaultMaterial;
        this.materialScale = params.materialScale || 200;
        this.elevation = params.elevation !== undefined ? Number(params.elevation) : 0;
        this.height3D = params.height3D !== undefined ? Number(params.height3D) : typeDefaults.defaultHeight3D;
        this.fill = params.fill || typeDefaults.fill;
        this.stroke = params.stroke || typeDefaults.stroke;

        // Points array: [{x, y}, ...]
        let rawPoints = params.points || [];
        if (rawPoints.length > 0 && params.x === undefined && params.y === undefined) {
            let cx = 0, cy = 0;
            rawPoints.forEach(p => { cx += p.x; cy += p.y; });
            cx /= rawPoints.length;
            cy /= rawPoints.length;
            this.x = cx;
            this.y = cy;
            this.points = rawPoints.map(p => ({ x: p.x - cx, y: p.y - cy }));
        } else {
            this.x = params.x || 0;
            this.y = params.y || 0;
            this.points = rawPoints;
        }

        this.vertexHandles = [];
        this.initKonva();
    }

    initKonva() {
        this.group = new Konva.Group({
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            draggable: true,
            id: this.id
        });

        // 1. Base Polygon Line
        this.polygonShape = new Konva.Line({
            points: this.getFlatPoints(),
            fill: this.fill,
            stroke: this.stroke,
            strokeWidth: 2,
            lineJoin: 'round',
            closed: true,
            dash: this.subType === 'pavement' ? [8, 4] : undefined
        });

        // 2. Selection / Highlight outline
        this.sealHighlight = new Konva.Line({
            points: this.getFlatPoints(),
            stroke: '#06b6d4',
            strokeWidth: 4,
            dash: [10, 6],
            lineCap: 'square',
            lineJoin: 'miter',
            opacity: 0.95,
            shadowColor: '#06b6d4',
            shadowBlur: 8,
            listening: false,
            visible: false,
            closed: true
        });

        // 3. Center Info Badge (Label + Area)
        this.badgeGroup = new Konva.Group({
            listening: false
        });
        this.createBadgeContent();

        // 4. Rotation handle
        this.rotHandle = new Konva.Circle({
            radius: 6,
            fill: '#06b6d4',
            stroke: 'white',
            strokeWidth: 2,
            draggable: true,
            visible: false,
            name: 'zone-rotater'
        });

        this.group.add(this.polygonShape);
        this.group.add(this.sealHighlight);
        this.group.add(this.badgeGroup);
        this.group.add(this.rotHandle);

        this.setupEvents();
        this.createVertexHandles();
        this.updateBadgePosition();
        this.updateRotHandlePosition();

        if (this.planner.baseLayer) {
            this.planner.baseLayer.add(this.group);
        } else if (this.planner.mainLayer) {
            this.planner.mainLayer.add(this.group);
        }
        if (this.planner.mainLayer) {
            this.planner.mainLayer.batchDraw();
        }
    }

    getFlatPoints() {
        return this.points.flatMap(p => [p.x, p.y]);
    }

    calculateArea() {
        if (!this.points || this.points.length < 3) return 0;
        let sum = 0;
        for (let i = 0; i < this.points.length; i++) {
            const p1 = this.points[i];
            const p2 = this.points[(i + 1) % this.points.length];
            sum += (p1.x * p2.y) - (p2.x * p1.y);
        }
        return Math.abs(sum / 2);
    }

    getFormattedArea() {
        const areaSqCm = this.calculateArea();
        const areaSqM = (areaSqCm / 10000).toFixed(1);
        const areaSqFt = ((areaSqCm / 10000) * 10.7639).toFixed(1);
        
        const unit = this.planner?.currentUnit || 'cm';
        if (unit === 'ft' || unit === 'inch') {
            return `${areaSqFt} sq ft`;
        }
        return `${areaSqM} m²`;
    }

    createBadgeContent() {
        this.badgeGroup.destroyChildren();

        const typeInfo = OUTDOOR_ZONE_TYPES[this.subType] || OUTDOOR_ZONE_TYPES.pavement;
        const areaText = this.getFormattedArea();
        const labelText = `${this.name}\n${areaText}`;

        const badgeRect = new Konva.Rect({
            fill: 'rgba(15, 23, 42, 0.85)',
            cornerRadius: 8,
            shadowColor: 'black',
            shadowBlur: 6,
            shadowOpacity: 0.3,
            shadowOffset: { x: 0, y: 2 }
        });

        const badgeText = new Konva.Text({
            text: labelText,
            fontSize: 11,
            fontFamily: 'Inter, sans-serif',
            fontStyle: '600',
            fill: '#f8fafc',
            align: 'center',
            lineHeight: 1.3,
            padding: 6
        });

        badgeRect.width(badgeText.width());
        badgeRect.height(badgeText.height());
        badgeRect.offsetX(badgeText.width() / 2);
        badgeRect.offsetY(badgeText.height() / 2);
        badgeText.offsetX(badgeText.width() / 2);
        badgeText.offsetY(badgeText.height() / 2);

        this.badgeGroup.add(badgeRect);
        this.badgeGroup.add(badgeText);
    }

    updateBadgePosition() {
        if (!this.points || this.points.length === 0) return;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.points.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        this.badgeGroup.position({ x: cx, y: cy });
    }

    updateRotHandlePosition() {
        if (!this.points || this.points.length === 0) return;
        let minY = Infinity;
        let topX = 0;
        this.points.forEach(p => {
            if (p.y < minY) {
                minY = p.y;
                topX = p.x;
            }
        });
        this.rotHandle.position({ x: topX, y: minY - 24 });
    }

    createVertexHandles() {
        this.vertexHandles.forEach(h => h.destroy());
        this.vertexHandles = [];

        this.points.forEach((pt, idx) => {
            const handle = new Konva.Circle({
                x: pt.x,
                y: pt.y,
                radius: 5,
                fill: '#06b6d4',
                stroke: '#ffffff',
                strokeWidth: 2,
                draggable: true,
                visible: false,
                name: `vertex-handle-${idx}`
            });

            handle.on('dragmove', (e) => {
                e.cancelBubble = true;
                this.points[idx] = { x: handle.x(), y: handle.y() };
                this.updateGeometry();
            });

            handle.on('dragend', (e) => {
                e.cancelBubble = true;
                if (this.planner && this.planner.saveState) {
                    this.planner.saveState();
                }
                if (this.planner && this.planner.onSelectionChange) {
                    this.planner.onSelectionChange(this, 'outdoor_zone');
                }
            });

            this.group.add(handle);
            this.vertexHandles.push(handle);
        });
    }

    updateGeometry() {
        const flatPts = this.getFlatPoints();
        this.polygonShape.points(flatPts);
        this.sealHighlight.points(flatPts);
        this.createBadgeContent();
        this.updateBadgePosition();
        this.updateRotHandlePosition();

        if (this.planner.mainLayer) this.planner.mainLayer.batchDraw();
        if (this.planner.syncAll) this.planner.syncAll();
    }

    setHighlight(val) {
        this.sealHighlight.visible(val);
        this.rotHandle.visible(val);
        this.vertexHandles.forEach(h => h.visible(val));
        if (val) {
            this.createBadgeContent();
            this.updateBadgePosition();
            this.updateRotHandlePosition();
        }
        if (this.planner.mainLayer) this.planner.mainLayer.batchDraw();
    }

    setSubType(newSubType) {
        this.subType = newSubType;
        const typeDefaults = OUTDOOR_ZONE_TYPES[newSubType] || OUTDOOR_ZONE_TYPES.pavement;
        this.name = typeDefaults.label;
        this.configId = typeDefaults.defaultMaterial;
        this.fill = typeDefaults.fill;
        this.stroke = typeDefaults.stroke;
        this.height3D = typeDefaults.defaultHeight3D;

        this.polygonShape.fill(this.fill);
        this.polygonShape.stroke(this.stroke);
        this.polygonShape.dash(newSubType === 'pavement' ? [8, 4] : undefined);
        this.createBadgeContent();

        if (this.planner.mainLayer) this.planner.mainLayer.batchDraw();
        if (this.planner.syncAll) this.planner.syncAll();
    }

    setupEvents() {
        this.group.on('click tap', (e) => {
            e.cancelBubble = true;
            this.planner.selectEntity(this, 'outdoor_zone');
        });

        this.group.on('dragmove', () => {
            this.x = this.group.x();
            this.y = this.group.y();
            if (this.planner.syncAll) this.planner.syncAll();
        });

        this.group.on('dragend', () => {
            this.x = this.group.x();
            this.y = this.group.y();
            if (this.planner.saveState) this.planner.saveState();
        });

        this.rotHandle.on('dragmove', (e) => {
            e.cancelBubble = true;
            const hPos = this.rotHandle.position();
            const angle = Math.atan2(hPos.y, hPos.x) * 180 / Math.PI + 90;
            this.group.rotation(angle);
            this.rotation = angle;
            if (this.planner.syncAll) this.planner.syncAll();
        });

        this.rotHandle.on('dragend', (e) => {
            e.cancelBubble = true;
            this.updateRotHandlePosition();
            if (this.planner.saveState) this.planner.saveState();
        });
    }

    toJSON() {
        return {
            id: this.id,
            type: 'outdoor_zone',
            subType: this.subType,
            name: this.name,
            x: this.group ? this.group.x() : this.x,
            y: this.group ? this.group.y() : this.y,
            rotation: this.group ? this.group.rotation() : this.rotation,
            points: this.points,
            configId: this.configId,
            materialScale: this.materialScale,
            elevation: this.elevation,
            height3D: this.height3D,
            fill: this.fill,
            stroke: this.stroke
        };
    }

    export() {
        return this.toJSON();
    }

    exportState() {
        return this.toJSON();
    }

    destroy() {
        if (this.group) {
            this.group.destroy();
            this.group = null;
        }
        if (this.mesh3D && this.mesh3D.parent) {
            this.mesh3D.parent.remove(this.mesh3D);
            this.mesh3D = null;
        }
    }
}

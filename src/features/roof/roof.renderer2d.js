import { EVENTS, offsetPolygon } from '../../core/registry.js';
import { coreEventBus } from '../../core/EventBus.js';
import { StairEngine } from '../../core/stairs/StairEngine.js';
import { WallEngine } from '../../core/wall/WallEngine.js';
import { RoofGeometryEngine } from '../../core/roof/RoofGeometryEngine.js';
import { RoofEngine } from '../../core/roof/RoofEngine.js';
import Konva from 'konva';

export class PremiumHipRoof {
    constructor(planner, points) {
        this.planner = planner;
        this.type = 'roof';
        this.materialMode = 'PROCEDURAL';
        this.supportsLiveMaterialPipeline = true;
        this.id = 'roof_' + Date.now() + '_' + Math.floor(Math.random()*1000);
        
        this.points = RoofGeometryEngine.cleanPoints(points);
        
        this.config = {
            pitch: 30,
            overhang: 8,
            thickness: 10,
            ridgeOffset: 0,
            roofType: 'hip',
            material: 'dark_asphalt_roof',
            wallGap: 0,
            ridgeAxis: 'x',
            gableMaterial: 'white_plaster_wall',
            autoShapeWalls: false
        };
        
        this.rotation = 0; 
        
        this.configId = 'dark_asphalt_roof';

        this.group = new Konva.Group({ draggable: true });
        
        this.boundary = new Konva.Line({
            points: this.getFlatPoints(),
            fill: 'rgba(226, 232, 240, 0.4)', // Semi-transparent grey fill
            stroke: 'rgba(148, 163, 184, 0.5)', // Subtle slate stroke
            strokeWidth: 2,
            closed: true,
            lineJoin: 'round',
            shadowColor: 'black',
            shadowBlur: 15,
            shadowOffset: {x: 3, y: 3},
            shadowOpacity: 0.3
        });
        
        this.hipLinesGroup = new Konva.Group();
        
        this.group.add(this.boundary, this.hipLinesGroup);
        if (this.planner && this.planner.roofLayer) this.planner.roofLayer.add(this.group);
        
        this.handles = [];
        this.initHandles();
        this.update();
        this.initEvents();
    }
    getFlatPoints() {
        if (!this.config.overhangs || this.config.overhangs.length !== this.points.length) {
            this.config.overhangs = Array(this.points.length).fill(this.config.overhang || 0);
        }
        const offsetPts = offsetPolygon(this.points, this.config.overhangs);
        return offsetPts.flatMap(p => [p.x, p.y]);
    }
    
    initHandles() {
        this.points.forEach((p, i) => {
            const handle = new Konva.Circle({
                x: p.x, y: p.y,
                radius: 8, fill: '#FFA500', stroke: 'white', strokeWidth: 2,
                draggable: true, visible: false
            });
            handle.on('dragmove', (e) => {
                e.cancelBubble = true;
                const newPts = this.points.map((pt, idx) => idx === i ? { x: handle.x(), y: handle.y() } : { x: pt.x, y: pt.y });
                RoofEngine.setPoints(this, newPts, this.planner);
            });
            handle.on('dragend', (e) => {
                e.cancelBubble = true;
                const newPts = this.points.map((pt, idx) => idx === i ? { x: handle.x(), y: handle.y() } : { x: pt.x, y: pt.y });
                RoofEngine.setPoints(this, newPts, this.planner);
                if (this.planner?.history?.record) {
                    this.planner.history.record();
                }
            });
            this.handles.push(handle);
            this.group.add(handle);
        });
    }
    
    setHighlight(isActive) {
        this.boundary.stroke(isActive ? '#4f46e5' : 'rgba(148, 163, 184, 0.5)');
        this.boundary.strokeWidth(isActive ? 3 : 2);
        const mode = this.config?.autoPlacementMode || 'manual';
        this.handles.forEach(h => h.visible(isActive && mode === 'manual'));
        this.group.draggable(mode === 'manual' && !this.parentGroup);
        this.planner.stage.batchDraw();
    }
    
    initEvents() {
        this.group.on('mouseenter', () => { 
            const mode = this.config?.autoPlacementMode || 'manual';
            if(this.planner.tool === 'select' && mode === 'manual') document.body.style.cursor = 'move'; 
        });
        this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        
        this.group.on('mousedown touchstart', (e) => { 
            if (this.planner.tool !== 'select') return; 
            this.group.moveToTop(); 
            e.cancelBubble = true; 
            if (e.evt) e.evt.stopPropagation();
            if (this.parentGroup) {
                this.planner.selectEntity(this.parentGroup, 'preset_group');
                this.planner.syncAll();
            } else {
                this.planner.selectEntity(this, 'roof'); 
                this.planner.syncAll();
            }
        });
        
        this.group.on('click tap', (e) => {
            if (this.planner.tool !== 'select') return;
            e.cancelBubble = true;
            if (this.parentGroup) {
                this.planner.selectEntity(this.parentGroup, 'preset_group');
                this.planner.syncAll();
            } else {
                this.planner.selectEntity(this, 'roof');
                this.planner.syncAll();
            }
        });
        this.group.on('dragstart', (e) => { 
            if (this.handles.includes(e.target)) return; // Allow handles to drag even if tool is roof
            if (this.planner.tool !== 'select' || this.parentGroup) {
                e.target.stopDrag();
                return;
            } 
            this.planner.selectEntity(this, 'roof'); 
        });
        this.group.on('dragmove', (e) => { if (this.planner.tool !== 'select' || this.handles.includes(e.target)) return; this.planner.syncAll(); });
        this.group.on('dragend', (e) => {
            if (this.planner.tool !== 'select' || this.handles.includes(e.target)) return;
            const dx = this.group.x();
            const dy = this.group.y();
            if (dx === 0 && dy === 0) return;
            this.group.position({ x: 0, y: 0 });
            const newPts = this.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy }));
            RoofEngine.setPoints(this, newPts, this.planner);
            if (this.planner?.history?.record) {
                this.planner.history.record();
            }
            this.planner.syncAll();
        });
    }
    
    update() {
        this.boundary.points(this.getFlatPoints());
        this.generateHipLines();
    }

    update2D() {
        this.updateGeometry();
    }
    
    updateGeometry() {
        if (this.handles && this.handles.length === this.points.length) {
            this.points.forEach((p, i) => {
                const h = this.handles[i];
                if (h && (!h.isDragging || !h.isDragging())) {
                    h.position({ x: p.x, y: p.y });
                }
            });
        } else {
            this.handles.forEach(h => h.destroy());
            this.handles = [];
            this.initHandles();
        }
        this.update();
        const mode = this.config?.autoPlacementMode || 'manual';
        this.handles.forEach(h => h.visible(mode === 'manual' && this.planner?.selectedEntity === this));
    }
    
    generateHipLines() {
        this.hipLinesGroup.destroyChildren();
        const overhangs = this.config.overhangs ? this.config.overhangs : (this.config.overhang || 0);
        const pts = offsetPolygon(this.points, overhangs);

        this.hipLinesGroup.clipFunc((ctx) => {
            ctx.beginPath();
            if (pts.length > 0) {
                ctx.moveTo(pts[0].x, pts[0].y);
                for(let i=1; i<pts.length; i++) {
                    ctx.lineTo(pts[i].x, pts[i].y);
                }
                ctx.closePath();
            }
        });
        
        let cx = 0, cy = 0, signedArea = 0;
        for (let i = 0; i < this.points.length; i++) {
            let p0 = this.points[i], p1 = this.points[(i + 1) % this.points.length];
            let a = p0.x * p1.y - p1.x * p0.y;
            signedArea += a; cx += (p0.x + p1.x) * a; cy += (p0.y + p1.y) * a;
        }
        signedArea *= 0.5;
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
        
        let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
        this.points.forEach(p => { bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x); bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y); });

        if (Math.abs(signedArea) > 0.1) { cx /= (6.0 * signedArea); cy /= (6.0 * signedArea); } 
        else { cx = bMinX + (bMaxX - bMinX) / 2; cy = bMinY + (bMaxY - bMinY) / 2; }

        this.boundary.fill('rgba(226, 232, 240, 0.4)'); // Semi-transparent grey fill
        this.boundary.stroke('rgba(148, 163, 184, 0.5)'); // Subtle slate outer boundary
        this.boundary.strokeWidth(2);
        this.boundary.fillPriority('color');

        // Draw inner dashed boundary (wall line)
        if (this.points && this.points.length > 0) {
            const innerPts = [];
            this.points.forEach(p => { innerPts.push(p.x, p.y); });
            this.hipLinesGroup.add(new Konva.Line({
                points: innerPts,
                stroke: '#475569',
                strokeWidth: 1.5,
                closed: true
            }));
        }

        const ridgeStroke = '#334155'; // Dark slate for ridges and diagonals
        const hatchStroke = 'rgba(51, 65, 85, 0.2)'; // Subtle slate for hatching

        if (this.config.roofType === 'flat' || this.config.roofType === 'curved_portal' || this.config.roofType === 'modern_wrap') {
            // Flat / Curved Portal Roof:
            if (this.config.roofType === 'curved_portal' || this.config.roofType === 'modern_wrap') {
                const wallSides = this.config.wallSides || { left: true, right: true, front: false, back: false };
                const thick = Number(this.config.thickness) || 15;
                const bW = maxX - minX;
                const bD = maxY - minY;

                // Render active portal drop walls along edges
                if (wallSides.left) {
                    this.hipLinesGroup.add(new Konva.Rect({
                        x: minX,
                        y: minY,
                        width: thick,
                        height: bD,
                        fill: 'rgba(51, 65, 85, 0.45)',
                        stroke: '#334155',
                        strokeWidth: 2
                    }));
                }
                if (wallSides.right) {
                    this.hipLinesGroup.add(new Konva.Rect({
                        x: maxX - thick,
                        y: minY,
                        width: thick,
                        height: bD,
                        fill: 'rgba(51, 65, 85, 0.45)',
                        stroke: '#334155',
                        strokeWidth: 2
                    }));
                }
                if (wallSides.back) {
                    this.hipLinesGroup.add(new Konva.Rect({
                        x: minX,
                        y: minY,
                        width: bW,
                        height: thick,
                        fill: 'rgba(51, 65, 85, 0.45)',
                        stroke: '#334155',
                        strokeWidth: 2
                    }));
                }
                if (wallSides.front) {
                    this.hipLinesGroup.add(new Konva.Rect({
                        x: minX,
                        y: maxY - thick,
                        width: bW,
                        height: thick,
                        fill: 'rgba(51, 65, 85, 0.45)',
                        stroke: '#334155',
                        strokeWidth: 2
                    }));
                }

                // Render recessed spotlights indicators in 2D
                if (this.config.hasSpotlights !== false && bW > 40 && bD > 40) {
                    const spacing = Math.max(60, Number(this.config.spotlightSpacing) || 90);
                    const numX = Math.max(1, Math.round((bW - 2 * thick) / spacing));
                    const numZ = Math.max(1, Math.round((bD - 2 * thick) / spacing));
                    const stepX = (bW - 2 * thick) / (numX + 1);
                    const stepZ = (bD - 2 * thick) / (numZ + 1);

                    for (let ix = 1; ix <= numX; ix++) {
                        for (let iz = 1; iz <= numZ; iz++) {
                            const sx = minX + thick + ix * stepX;
                            const sz = minY + thick + iz * stepZ;
                            this.hipLinesGroup.add(new Konva.Circle({
                                x: sx,
                                y: sz,
                                radius: 4,
                                fill: '#fef08a',
                                stroke: '#ca8a04',
                                strokeWidth: 1.5
                            }));
                        }
                    }
                }
            }

            // Render stair cut references directly on the flat roof slab
            const allStairs = [
                ...(this.planner.stairs || []),
                ...(this.planner.referenceFloorData?.stairs || [])
            ];
            
            allStairs.forEach(stair => {
                const worldPts = StairEngine.getCutoutPolygon(stair);
                if (worldPts && worldPts.length > 0) {
                    const gx = this.group.x() || 0;
                    const gy = this.group.y() || 0;

                    const rotatedPts = worldPts.map(p => ({
                        x: p.x - gx,
                        y: p.y - gy
                    }));
                    const flatStairPts = rotatedPts.flatMap(p => [p.x, p.y]);

                    // Render high-contrast red dashed stair cut opening directly on the flat roof
                    this.hipLinesGroup.add(new Konva.Line({
                        points: flatStairPts,
                        fill: 'rgba(239, 68, 68, 0.25)',
                        stroke: '#ef4444',
                        strokeWidth: 3,
                        dash: [8, 4],
                        closed: true,
                        lineJoin: 'round'
                    }));

                    // Add diagonal cross void indicator inside the stair cutout
                    if (rotatedPts.length >= 4) {
                        this.hipLinesGroup.add(new Konva.Line({
                            points: [rotatedPts[0].x, rotatedPts[0].y, rotatedPts[2].x, rotatedPts[2].y],
                            stroke: '#ef4444',
                            strokeWidth: 1.5,
                            dash: [4, 4]
                        }));
                        this.hipLinesGroup.add(new Konva.Line({
                            points: [rotatedPts[1].x, rotatedPts[1].y, rotatedPts[3].x, rotatedPts[3].y],
                            stroke: '#ef4444',
                            strokeWidth: 1.5,
                            dash: [4, 4]
                        }));
                    }
                }
            });
        } else if (this.config.roofType === 'gable') {
            const width = (this.config.ridgeAxis === 'y') ? (maxX - minX) : (maxY - minY);
            const H = (width / 2) * Math.tan((this.config.pitch || 30) * Math.PI / 180);

            if (this.config.ridgeAxis === 'y') {
                const topPts = pts.filter(p => p.y < cy);
                const botPts = pts.filter(p => p.y >= cy);

                let topPeakX = cx, botPeakX = cx;
                if (topPts.length > 0) {
                    const tLeft = topPts.reduce((min, p) => p.x < min.x ? p : min, topPts[0]);
                    const tRight = topPts.reduce((max, p) => p.x > max.x ? p : max, topPts[0]);
                    topPeakX = (tLeft.x + tRight.x) / 2;
                }
                if (botPts.length > 0) {
                    const bLeft = botPts.reduce((min, p) => p.x < min.x ? p : min, botPts[0]);
                    const bRight = botPts.reduce((max, p) => p.x > max.x ? p : max, botPts[0]);
                    botPeakX = (bLeft.x + bRight.x) / 2;
                }

                // Subtle slope hatching
                for (let i = 1; i <= 3; i++) {
                    const offset = (width / 2) * (i / 4);
                    this.hipLinesGroup.add(new Konva.Line({ points: [cx - offset, minY, cx - offset, maxY], stroke: hatchStroke, strokeWidth: 1 }));
                    this.hipLinesGroup.add(new Konva.Line({ points: [cx + offset, minY, cx + offset, maxY], stroke: hatchStroke, strokeWidth: 1 }));
                }

                this.hipLinesGroup.add(new Konva.Line({ points: [topPeakX, minY, botPeakX, maxY], stroke: ridgeStroke, strokeWidth: 2 }));
                
                // Top Slope Wall Profile (Inward)
                this.addHatchedTriangle({x: minX, y: minY}, {x: topPeakX, y: minY + H}, {x: maxX, y: minY});
                // Bottom Slope Wall Profile (Inward)
                this.addHatchedTriangle({x: minX, y: maxY}, {x: botPeakX, y: maxY - H}, {x: maxX, y: maxY});
            } else {
                const leftPts = pts.filter(p => p.x < cx);
                const rightPts = pts.filter(p => p.x >= cx);

                let leftPeakY = cy, rightPeakY = cy;
                if (leftPts.length > 0) {
                    const lTop = leftPts.reduce((min, p) => p.y < min.y ? p : min, leftPts[0]);
                    const lBot = leftPts.reduce((max, p) => p.y > max.y ? p : max, leftPts[0]);
                    leftPeakY = (lTop.y + lBot.y) / 2;
                }
                if (rightPts.length > 0) {
                    const rTop = rightPts.reduce((min, p) => p.y < min.y ? p : min, rightPts[0]);
                    const rBot = rightPts.reduce((max, p) => p.y > max.y ? p : max, rightPts[0]);
                    rightPeakY = (rTop.y + rBot.y) / 2;
                }

                // Subtle slope hatching
                for (let i = 1; i <= 3; i++) {
                    const offset = (width / 2) * (i / 4);
                    this.hipLinesGroup.add(new Konva.Line({ points: [minX, cy - offset, maxX, cy - offset], stroke: hatchStroke, strokeWidth: 1 }));
                    this.hipLinesGroup.add(new Konva.Line({ points: [minX, cy + offset, maxX, cy + offset], stroke: hatchStroke, strokeWidth: 1 }));
                }

                this.hipLinesGroup.add(new Konva.Line({ points: [minX, leftPeakY, maxX, rightPeakY], stroke: ridgeStroke, strokeWidth: 2 })); 
                
                // Left Slope Wall Profile (Inward)
                this.addHatchedTriangle({x: minX, y: minY}, {x: minX + H, y: leftPeakY}, {x: minX, y: maxY});
                // Right Slope Wall Profile (Inward)
                this.addHatchedTriangle({x: maxX, y: minY}, {x: maxX - H, y: rightPeakY}, {x: maxX, y: maxY});
            }
        } else if (this.config.roofType === 'shed') {
            const axis = this.config.ridgeAxis || 'x';
            const flip = !!this.config.flipSlope;
            if (axis === 'x') {
                const yHigh = flip ? minY : maxY;
                this.hipLinesGroup.add(new Konva.Line({ points: [minX, yHigh, maxX, yHigh], stroke: ridgeStroke, strokeWidth: 3 }));
                for (let i = 1; i <= 5; i++) {
                    const y = minY + (maxY - minY) * (i / 6);
                    this.hipLinesGroup.add(new Konva.Line({ points: [minX, y, maxX, y], stroke: hatchStroke, strokeWidth: 1, dash: [4, 4] }));
                }
            } else {
                const xHigh = flip ? minX : maxX;
                this.hipLinesGroup.add(new Konva.Line({ points: [xHigh, minY, xHigh, maxY], stroke: ridgeStroke, strokeWidth: 3 }));
                for (let i = 1; i <= 5; i++) {
                    const x = minX + (maxX - minX) * (i / 6);
                    this.hipLinesGroup.add(new Konva.Line({ points: [x, minY, x, maxY], stroke: hatchStroke, strokeWidth: 1, dash: [4, 4] }));
                }
            }
        } else if (this.config.roofType === 'half_hip') {
            const bW = maxX - minX;
            const bD = maxY - minY;
            const isHorizontal = bW >= bD;
            if (isHorizontal) {
                const r1x = minX + bD / 2, r1y = minY + bD / 2;
                const r2x = maxX, r2y = minY + bD / 2;
                this.hipLinesGroup.add(new Konva.Line({ points: [r1x, r1y, r2x, r2y], stroke: ridgeStroke, strokeWidth: 2 }));
                this.hipLinesGroup.add(new Konva.Line({ points: [minX, minY, r1x, r1y], stroke: ridgeStroke, strokeWidth: 1.5 }));
                this.hipLinesGroup.add(new Konva.Line({ points: [minX, maxY, r1x, r1y], stroke: ridgeStroke, strokeWidth: 1.5 }));
            } else {
                const r1x = minX + bW / 2, r1y = minY + bW / 2;
                const r2x = minX + bW / 2, r2y = maxY;
                this.hipLinesGroup.add(new Konva.Line({ points: [r1x, r1y, r2x, r2y], stroke: ridgeStroke, strokeWidth: 2 }));
                this.hipLinesGroup.add(new Konva.Line({ points: [minX, minY, r1x, r1y], stroke: ridgeStroke, strokeWidth: 1.5 }));
                this.hipLinesGroup.add(new Konva.Line({ points: [maxX, minY, r1x, r1y], stroke: ridgeStroke, strokeWidth: 1.5 }));
            }
        } else {
            // Hip Roof Ridge Line and 4 Hip Rafters
            const bW = maxX - minX;
            const bD = maxY - minY;
            const isHorizontal = bW >= bD;
            if (isHorizontal) {
                const r1x = minX + bD / 2, r1y = minY + bD / 2;
                const r2x = maxX - bD / 2, r2y = minY + bD / 2;
                this.hipLinesGroup.add(new Konva.Line({ points: [r1x, r1y, r2x, r2y], stroke: ridgeStroke, strokeWidth: 2 }));
                this.hipLinesGroup.add(new Konva.Line({ points: [minX, minY, r1x, r1y], stroke: ridgeStroke, strokeWidth: 1.5 }));
                this.hipLinesGroup.add(new Konva.Line({ points: [minX, maxY, r1x, r1y], stroke: ridgeStroke, strokeWidth: 1.5 }));
                this.hipLinesGroup.add(new Konva.Line({ points: [maxX, minY, r2x, r2y], stroke: ridgeStroke, strokeWidth: 1.5 }));
                this.hipLinesGroup.add(new Konva.Line({ points: [maxX, maxY, r2x, r2y], stroke: ridgeStroke, strokeWidth: 1.5 }));
            } else {
                const r1x = minX + bW / 2, r1y = minY + bW / 2;
                const r2x = minX + bW / 2, r2y = maxY - bW / 2;
                this.hipLinesGroup.add(new Konva.Line({ points: [r1x, r1y, r2x, r2y], stroke: ridgeStroke, strokeWidth: 2 }));
                this.hipLinesGroup.add(new Konva.Line({ points: [minX, minY, r1x, r1y], stroke: ridgeStroke, strokeWidth: 1.5 }));
                this.hipLinesGroup.add(new Konva.Line({ points: [maxX, minY, r1x, r1y], stroke: ridgeStroke, strokeWidth: 1.5 }));
                this.hipLinesGroup.add(new Konva.Line({ points: [minX, maxY, r2x, r2y], stroke: ridgeStroke, strokeWidth: 1.5 }));
                this.hipLinesGroup.add(new Konva.Line({ points: [maxX, maxY, r2x, r2y], stroke: ridgeStroke, strokeWidth: 1.5 }));
            }
        }

        // Render 2D Skylight Windows & Glass Insets
        const skylights = this.config.skylights || this.skylights;
        if (Array.isArray(skylights) && skylights.length > 0) {
            const bW = maxX - minX;
            const bD = maxY - minY;
            const pitchRad = (this.config.pitch || 30) * Math.PI / 180;
            const axis = this.config.ridgeAxis || 'x';

            skylights.forEach(sk => {
                const skX = sk.x !== undefined ? sk.x : (sk.u !== undefined ? (minX + sk.u * bW) : (minX + bW / 2));
                const skY = sk.z !== undefined ? sk.z : (sk.v !== undefined ? (minY + sk.v * bD) : (minY + bD / 2));
                
                let effW = Number(sk.width) || 120;
                let effL = Number(sk.length) || 180;
                if (sk.coverage === 'full_width' || sk.coverage === 'full_both') effW = (axis === 'x' ? bW : bD);
                if (sk.coverage === 'full_slope' || sk.coverage === 'full_both') effL = ((axis === 'x' ? bD : bW) / 2) / Math.cos(pitchRad);

                const projL = effL * Math.cos(pitchRad);
                const rectX = skX - effW / 2;
                const rectY = skY - projL / 2;

                // Glass Area (Transparent Blue Aperture)
                this.hipLinesGroup.add(new Konva.Rect({
                    x: rectX,
                    y: rectY,
                    width: effW,
                    height: projL,
                    fill: 'rgba(56, 189, 248, 0.4)',
                    stroke: '#0284c7',
                    strokeWidth: 2,
                    lineJoin: 'round',
                    shadowColor: '#0369a1',
                    shadowBlur: 6,
                    shadowOpacity: 0.25
                }));

                // Center cross / diamond mullion indicators in 2D
                if (sk.type === 'skylight_diamond_lattice' || sk.material === 'glass_roof_diamond_lattice') {
                    this.hipLinesGroup.add(new Konva.Line({
                        points: [
                            rectX + effW / 2, rectY,
                            rectX + effW, rectY + projL / 2,
                            rectX + effW / 2, rectY + projL,
                            rectX, rectY + projL / 2
                        ],
                        stroke: '#0369a1',
                        strokeWidth: 1.5,
                        closed: true
                    }));
                } else {
                    this.hipLinesGroup.add(new Konva.Line({
                        points: [rectX, rectY + projL / 2, rectX + effW, rectY + projL / 2],
                        stroke: '#0369a1',
                        strokeWidth: 1.5
                    }));
                    this.hipLinesGroup.add(new Konva.Line({
                        points: [rectX + effW / 2, rectY, rectX + effW / 2, rectY + projL],
                        stroke: '#0369a1',
                        strokeWidth: 1.5
                    }));
                }
            });
        }
    }

    addHatchedTriangle(p1, p2, p3) {
        // Draw the outline of the triangle (subtle slate grey)
        this.hipLinesGroup.add(new Konva.Line({
            points: [p1.x, p1.y, p2.x, p2.y, p3.x, p3.y],
            stroke: '#94a3b8', strokeWidth: 1.5,
            fill: 'rgba(148, 163, 184, 0.15)', closed: true
        }));

        // Draw hatching lines inside the triangle radiating to the peak
        for (let i = 1; i <= 7; i++) {
            let bx = p1.x + (p3.x - p1.x) * (i / 8);
            let by = p1.y + (p3.y - p1.y) * (i / 8);
            this.hipLinesGroup.add(new Konva.Line({
                points: [bx, by, p2.x, p2.y],
                stroke: 'rgba(148, 163, 184, 0.4)', strokeWidth: 1
            }));
        }
    }
    
    applyMaterial({ target, key, activeMatIndex, activeObject, ctx }) {
        if (activeObject && activeObject.userData && activeObject.userData.isGable) {
            this.gableMaterial = key;
        } else {
            this.config = this.config || {};
            this.config.material = key;
            this.configId = key;
        }
        
        if (typeof window !== 'undefined') {
            coreEventBus.emit(EVENTS.MATERIAL_GIZMO_APPLY);
        }
    }

    remove() {
        RoofEngine.deleteRoof(this.planner, this);
    }
}
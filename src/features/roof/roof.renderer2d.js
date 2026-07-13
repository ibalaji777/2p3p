import { EVENTS, offsetPolygon } from '../../core/registry.js';
import { coreEventBus } from '../../core/EventBus.js';
import Konva from 'konva';

export class PremiumHipRoof {
    constructor(planner, points) {
        this.planner = planner;
        this.type = 'roof';
        this.id = 'roof_' + Date.now() + '_' + Math.floor(Math.random()*1000);
        
        // Copy node points and remove consecutive duplicates to prevent duplicate handles
        let cleanedPoints = [];
        for (let p of points) {
            if (cleanedPoints.length > 0) {
                const last = cleanedPoints[cleanedPoints.length - 1];
                if (Math.hypot(p.x - last.x, p.y - last.y) < 1) continue; // Skip consecutive duplicates
            }
            cleanedPoints.push({ x: p.x, y: p.y });
        }
        
        // If the roof forms a closed loop but the last point equals the first point, remove the duplicate last point
        if (cleanedPoints.length > 2) {
            const first = cleanedPoints[0];
            const last = cleanedPoints[cleanedPoints.length - 1];
            if (Math.hypot(first.x - last.x, first.y - last.y) < 1) {
                cleanedPoints.pop();
            }
        }
        
        this.points = cleanedPoints;
        
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
        this.planner.roofLayer.add(this.group);
        
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
                this.points[i].x = handle.x();
                this.points[i].y = handle.y();
                this.update();
                this.planner.syncAll();
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
            this.group.moveToTop(); 
            if (this.planner.tool !== 'select') return; 
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
    }
    
    update() {
        this.autoDetectRidgeAxis();
        this.autoShapeWalls();
        this.boundary.points(this.getFlatPoints());
        this.generateHipLines();
    }
    
    autoDetectRidgeAxis() {
        if (this.config.roofType !== 'gable') return;
        if (this.config.manualRidge) return; // User manually set the ridge direction
        if (!this.planner || !this.planner.walls) return;
        
        const gableWalls = this.planner.walls.filter(w => w.topProfileType === 'gable');
        if (gableWalls.length === 0) return;
        
        let dxSum = 0;
        let dySum = 0;
        
        // Offset roof local points by group position to get world coordinates
        const gx = this.group.x() || 0;
        const gy = this.group.y() || 0;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.points.forEach(p => { 
            minX = Math.min(minX, p.x + gx); maxX = Math.max(maxX, p.x + gx); 
            minY = Math.min(minY, p.y + gy); maxY = Math.max(maxY, p.y + gy); 
        });
        
        gableWalls.forEach(w => {
            const cx = (w.startAnchor.x + w.endAnchor.x) / 2;
            const cy = (w.startAnchor.y + w.endAnchor.y) / 2;
            
            // Check if wall center is under or very close to this roof
            if (cx >= minX - 20 && cx <= maxX + 20 && cy >= minY - 20 && cy <= maxY + 20) {
                const wDx = Math.abs(w.endAnchor.x - w.startAnchor.x);
                const wDy = Math.abs(w.endAnchor.y - w.startAnchor.y);
                dxSum += wDx;
                dySum += wDy;
            }
        });
        
        if (dxSum > 0 || dySum > 0) {
            // If gable walls are mostly horizontal (dx > dy), ridgeAxis should be 'y' (gables on top/bottom)
            const newAxis = (dxSum > dySum) ? 'y' : 'x';
            if (this.config.ridgeAxis !== newAxis) {
                this.config.ridgeAxis = newAxis;
            }
        }
    }
    
    autoShapeWalls() {
        if (!this.planner || !this.planner.walls) return;
        
        if (!this.config.autoShapeWalls || this.config.roofType !== 'gable') {
            // Clean up any existing auto gables for this roof
            this.planner.walls.filter(w => w.isAutoGable && w.parentRoofId === this.id).forEach(w => w.destroy());
            return;
        }

        // Offset roof local points by group position to get world coordinates
        const gx = this.group.x() || 0;
        const gy = this.group.y() || 0;
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.points.forEach(p => { 
            minX = Math.min(minX, p.x + gx); maxX = Math.max(maxX, p.x + gx); 
            minY = Math.min(minY, p.y + gy); maxY = Math.max(maxY, p.y + gy); 
        });

        const width = (this.config.ridgeAxis === 'y') ? (maxX - minX) : (maxY - minY);
        const roofH = (width / 2) * Math.tan((this.config.pitch || 30) * Math.PI / 180);
        
        this.planner.walls.forEach(w => {
            if (w.isAutoGable) return; // Ignore already generated gable walls
            
            const cx = (w.startAnchor.x + w.endAnchor.x) / 2;
            const cy = (w.startAnchor.y + w.endAnchor.y) / 2;
            
            // Check if wall is under this roof
            if (cx >= minX - 20 && cx <= maxX + 20 && cy >= minY - 20 && cy <= maxY + 20) {
                const wDx = Math.abs(w.endAnchor.x - w.startAnchor.x);
                const wDy = Math.abs(w.endAnchor.y - w.startAnchor.y);
                
                const isGable = (this.config.ridgeAxis === 'y') ? (wDx > wDy) : (wDy > wDx);
                let isOuter = false;
                if (isGable) {
                    if (this.config.ridgeAxis === 'y') {
                        isOuter = Math.abs(cy - minY) < 20 || Math.abs(cy - Math.max(minY, maxY)) < 20;
                    } else {
                        isOuter = Math.abs(cx - minX) < 20 || Math.abs(cx - Math.max(minX, maxX)) < 20;
                    }
                }
                
                if (isGable && isOuter) {
                    let gableWall = this.planner.walls.find(cw => cw.isAutoGable && cw.parentWallId === w.id && cw.parentRoofId === this.id);
                    if (!gableWall) {
                        const WallClass = w.constructor; // dynamically get the wall class (e.g. PremiumWall)
                        gableWall = new WallClass(this.planner, w.startAnchor, w.endAnchor, w.type);
                        gableWall.isAutoGable = true;
                        gableWall.parentWallId = w.id;
                        gableWall.parentRoofId = this.id;
                        gableWall.description = "Auto Gable Wall";
                        gableWall.topProfileType = 'gable';
                        gableWall.startHeight = 0;
                        gableWall.endHeight = 0;
                        this.planner.walls.push(gableWall);
                    }
                    const baseHeight = w.height !== undefined ? w.height : (w.config?.height || 180);
                    gableWall.elevation = (w.elevation || 0) + baseHeight;
                    gableWall.height = 0;
                    gableWall.peakHeight = roofH;
                    if (w.thickness !== undefined) gableWall.thickness = w.thickness;
                    if (gableWall.updateGeometry) gableWall.updateGeometry();
                } else {
                    let gableWall = this.planner.walls.find(cw => cw.isAutoGable && cw.parentWallId === w.id && cw.parentRoofId === this.id);
                    if (gableWall) gableWall.destroy();
                }
            }
        });
    }
    
    updateGeometry() {
        this.handles.forEach(h => h.destroy());
        this.handles = [];
        this.initHandles();
        this.update();
        const mode = this.config?.autoPlacementMode || 'manual';
        this.handles.forEach(h => h.visible(mode === 'manual' && this.planner.selectedEntity === this));
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

        if (this.config.roofType === 'gable') {
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
        } else {
            // Hip Roof Diagonals (Solid Lines)
            pts.forEach(p => { 
                this.hipLinesGroup.add(new Konva.Line({ points: [p.x, p.y, cx, cy], stroke: ridgeStroke, strokeWidth: 1.5 })); 
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
        this.group.destroy(); this.planner.roofs = this.planner.roofs.filter(r => r !== this); this.planner.selectEntity(null); this.planner.syncAll(); 
    }
}
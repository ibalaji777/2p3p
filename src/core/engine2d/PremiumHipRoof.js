import Konva from 'konva';
import { offsetPolygon } from '../registry.js';
import { PremiumWidget } from './PremiumWidget.js';
export class PremiumHipRoof {
    constructor(planner, points) {
        this.planner = planner;
        this.type = 'roof';
        this.id = 'roof_' + Date.now() + '_' + Math.floor(Math.random()*1000);
        
        // Copy node points to avoid direct reference mutation issues
        this.points = points.map(p => ({ x: p.x, y: p.y }));
        
        this.config = {
            pitch: 30,
            overhang: 0,
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
            fill: 'rgba(245, 158, 11, 0.3)', // Default fill
            stroke: '#f59e0b',
            strokeWidth: 4,
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
        const offsetPts = offsetPolygon(this.points, this.config.overhang || 0);
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
        this.boundary.stroke(isActive ? '#FF8C00' : '#FFA500');
        this.boundary.strokeWidth(isActive ? 4 : 3);
        const mode = this.config?.autoPlacementMode || 'manual';
        this.handles.forEach(h => h.visible(isActive && mode === 'manual'));
        this.group.draggable(mode === 'manual');
        this.planner.stage.batchDraw();
    }
    
    initEvents() {
        this.group.on('mouseenter', () => { 
            const mode = this.config?.autoPlacementMode || 'manual';
            if(this.planner.tool === 'select' && mode === 'manual') document.body.style.cursor = 'move'; 
        });
        this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        
        this.group.on('mousedown touchstart', (e) => { this.group.moveToTop(); if (this.planner.tool !== 'select') return; e.cancelBubble = true; this.planner.selectEntity(this, 'roof'); });
        this.group.on('dragstart', (e) => { if (this.planner.tool !== 'select' || this.handles.includes(e.target)) return; this.planner.selectEntity(this, 'roof'); });
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
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.points.forEach(p => { 
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); 
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); 
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

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.points.forEach(p => { 
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); 
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); 
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
                
                if (isGable) {
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
                    gableWall.elevation = w.height !== undefined ? w.height : (w.config?.height || 120);
                    gableWall.height = 0;
                    gableWall.peakHeight = roofH;
                    if (gableWall.updateGeometry) gableWall.updateGeometry();
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
        
        const pts = offsetPolygon(this.points, this.config.overhang || 0);
        
        let cx = 0, cy = 0, signedArea = 0;
        for (let i = 0; i < pts.length; i++) {
            let p0 = pts[i], p1 = pts[(i + 1) % pts.length];
            let a = p0.x * p1.y - p1.x * p0.y;
            signedArea += a; cx += (p0.x + p1.x) * a; cy += (p0.y + p1.y) * a;
        }
        signedArea *= 0.5;
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
        
        if (signedArea !== 0) { cx /= (6.0 * signedArea); cy /= (6.0 * signedArea); } 
        else {
            cx = minX + (maxX - minX) / 2; cy = minY + (maxY - minY) / 2;
        }

        let tP1 = {x: minX, y: minY}, tP2 = {x: maxX, y: minY};
        let bP1 = {x: minX, y: maxY}, bP2 = {x: maxX, y: maxY};
        let lP1 = {x: minX, y: minY}, lP2 = {x: minX, y: maxY};
        let rP1 = {x: maxX, y: minY}, rP2 = {x: maxX, y: maxY};

        if (pts.length === 4) {
            const sortedY = [...pts].sort((a,b) => a.y - b.y);
            const topTwo = [sortedY[0], sortedY[1]].sort((a,b) => a.x - b.x);
            const bottomTwo = [sortedY[2], sortedY[3]].sort((a,b) => a.x - b.x);
            tP1 = topTwo[0]; tP2 = topTwo[1];
            bP1 = bottomTwo[0]; bP2 = bottomTwo[1];

            const sortedX = [...pts].sort((a,b) => a.x - b.x);
            const leftTwo = [sortedX[0], sortedX[1]].sort((a,b) => a.y - b.y);
            const rightTwo = [sortedX[2], sortedX[3]].sort((a,b) => a.y - b.y);
            lP1 = leftTwo[0]; lP2 = leftTwo[1];
            rP1 = rightTwo[0]; rP2 = rightTwo[1];
        }

        // Calculate structural points for the gable wall indicators (ignoring overhang)
        let tP1s = tP1, tP2s = tP2, bP1s = bP1, bP2s = bP2;
        let lP1s = lP1, lP2s = lP2, rP1s = rP1, rP2s = rP2;
        if (this.points.length === 4) {
            const sY = [...this.points].sort((a,b) => a.y - b.y);
            const tTs = [sY[0], sY[1]].sort((a,b) => a.x - b.x);
            const bTs = [sY[2], sY[3]].sort((a,b) => a.x - b.x);
            tP1s = tTs[0]; tP2s = tTs[1];
            bP1s = bTs[0]; bP2s = bTs[1];

            const sX = [...this.points].sort((a,b) => a.x - b.x);
            const lTs = [sX[0], sX[1]].sort((a,b) => a.y - b.y);
            const rTs = [sX[2], sX[3]].sort((a,b) => a.y - b.y);
            lP1s = lTs[0]; lP2s = lTs[1];
            rP1s = rTs[0]; rP2s = rTs[1];
        }

        // Apply a gradient fill based on the roof type to give a 3D shading effect
        const darkOrange = 'rgba(245, 158, 11, 0.6)';
        const lightOrange = 'rgba(245, 158, 11, 0.1)';
        const normalOrange = 'rgba(245, 158, 11, 0.3)';

        if (this.config.roofType === 'gable') {
            const width = (this.config.ridgeAxis === 'y') ? (maxX - minX) : (maxY - minY);
            const H = (width / 2) * Math.tan((this.config.pitch || 30) * Math.PI / 180);

            if (this.config.ridgeAxis === 'y') {
                this.boundary.fillLinearGradientStartPoint({ x: minX, y: 0 });
                this.boundary.fillLinearGradientEndPoint({ x: maxX, y: 0 });
                this.boundary.fillLinearGradientColorStops([0, darkOrange, 0.5, lightOrange, 1, darkOrange]);
                
                // Roof Plane Hatching Lines
                for (let i = 1; i <= 3; i++) {
                    const offset = (width / 2) * (i / 4);
                    this.hipLinesGroup.add(new Konva.Line({ points: [cx - offset, minY, cx - offset, maxY], stroke: 'rgba(245, 158, 11, 0.4)', strokeWidth: 1 }));
                    this.hipLinesGroup.add(new Konva.Line({ points: [cx + offset, minY, cx + offset, maxY], stroke: 'rgba(245, 158, 11, 0.4)', strokeWidth: 1 }));
                }

                const topPeakX = (tP1s.x + tP2s.x) / 2;
                const botPeakX = (bP1s.x + bP2s.x) / 2;

                // Ridge line
                this.hipLinesGroup.add(new Konva.Line({ points: [topPeakX, minY, botPeakX, maxY], stroke: '#FFA500', strokeWidth: 3, dash: [6, 6] })); 
                
                // Slope arrows
                this.addSlopeIndicator(cx - (cx - minX) / 2, cy, 180); // left slope
                this.addSlopeIndicator(cx + (maxX - cx) / 2, cy, 0);   // right slope
                
                // Gable End Labels & Folded-out Slope Wall Guides
                this.addGableLabel(topPeakX, tP1s.y + 15, 'GABLE WALL', 0);
                this.addGableLabel(botPeakX, bP1s.y - 15, 'GABLE WALL', 0);

                // Top Slope Wall Profile (Inward)
                this.addHatchedTriangle(
                    tP1s, 
                    {x: topPeakX, y: (tP1s.y + tP2s.y)/2 + H}, 
                    tP2s
                );
                // Bottom Slope Wall Profile (Inward)
                this.addHatchedTriangle(
                    bP1s, 
                    {x: botPeakX, y: (bP1s.y + bP2s.y)/2 - H}, 
                    bP2s
                );

            } else {
                this.boundary.fillLinearGradientStartPoint({ x: 0, y: minY });
                this.boundary.fillLinearGradientEndPoint({ x: 0, y: maxY });
                this.boundary.fillLinearGradientColorStops([0, darkOrange, 0.5, lightOrange, 1, darkOrange]);
                
                // Roof Plane Hatching Lines
                for (let i = 1; i <= 3; i++) {
                    const offset = (width / 2) * (i / 4);
                    this.hipLinesGroup.add(new Konva.Line({ points: [minX, cy - offset, maxX, cy - offset], stroke: 'rgba(245, 158, 11, 0.4)', strokeWidth: 1 }));
                    this.hipLinesGroup.add(new Konva.Line({ points: [minX, cy + offset, maxX, cy + offset], stroke: 'rgba(245, 158, 11, 0.4)', strokeWidth: 1 }));
                }
                
                const leftPeakY = (lP1s.y + lP2s.y) / 2;
                const rightPeakY = (rP1s.y + rP2s.y) / 2;

                // Ridge line
                this.hipLinesGroup.add(new Konva.Line({ points: [minX, leftPeakY, maxX, rightPeakY], stroke: '#FFA500', strokeWidth: 3, dash: [6, 6] })); 
                
                // Slope arrows
                this.addSlopeIndicator(cx, cy - (cy - minY) / 2, -90); // up slope
                this.addSlopeIndicator(cx, cy + (maxY - cy) / 2, 90);  // down slope
                
                // Gable End Labels & Folded-out Slope Wall Guides
                this.addGableLabel(lP1s.x + 15, leftPeakY, 'GABLE WALL', -90);
                this.addGableLabel(rP1s.x - 15, rightPeakY, 'GABLE WALL', 90);

                // Left Slope Wall Profile (Inward)
                this.addHatchedTriangle(
                    lP1s, 
                    {x: (lP1s.x + lP2s.x)/2 + H, y: leftPeakY}, 
                    lP2s
                );
                // Right Slope Wall Profile (Inward)
                this.addHatchedTriangle(
                    rP1s, 
                    {x: (rP1s.x + rP2s.x)/2 - H, y: rightPeakY}, 
                    rP2s
                );
            }
            this.boundary.fill(null); // use gradient instead of solid fill
            this.boundary.fillPriority('linear-gradient');
        } else {
            // For hip roof, we can use a radial gradient from center to simulate shading
            this.boundary.fillRadialGradientStartPoint({ x: cx, y: cy });
            this.boundary.fillRadialGradientStartRadius(0);
            this.boundary.fillRadialGradientEndPoint({ x: cx, y: cy });
            this.boundary.fillRadialGradientEndRadius(Math.max(maxX - minX, maxY - minY) / 2);
            this.boundary.fillRadialGradientColorStops([0, lightOrange, 1, darkOrange]);
            this.boundary.fill(null);
            this.boundary.fillPriority('radial-gradient');

            pts.forEach(p => { 
                this.hipLinesGroup.add(new Konva.Line({ points: [p.x, p.y, cx, cy], stroke: '#FFA500', strokeWidth: 2, dash: [4, 4] })); 
            });
            
            // Add slope indicators for 4 sides
            this.addSlopeIndicator(cx, cy - (cy - minY) / 2, 270); // up
            this.addSlopeIndicator(cx, cy + (maxY - cy) / 2, 90);  // down
            this.addSlopeIndicator(cx - (cx - minX) / 2, cy, 180); // left
            this.addSlopeIndicator(cx + (maxX - cx) / 2, cy, 0);   // right
        }
    }

    addSlopeIndicator(x, y, angle) {
        const length = 24;
        const rad = angle * Math.PI / 180;
        
        const startX = x - (length / 2) * Math.cos(rad);
        const startY = y - (length / 2) * Math.sin(rad);
        const endX = x + (length / 2) * Math.cos(rad);
        const endY = y + (length / 2) * Math.sin(rad);

        const arrow = new Konva.Arrow({
            points: [startX, startY, endX, endY],
            pointerLength: 6,
            pointerWidth: 6,
            fill: '#d97706',
            stroke: '#d97706',
            strokeWidth: 2,
        });
        
        const pitchText = new Konva.Text({
            x: endX,
            y: endY,
            text: `${this.config.pitch}°`,
            fontSize: 12,
            fill: '#b45309',
            fontStyle: 'bold'
        });
        
        // Offset text to prevent overlapping with arrow
        if (angle === 0) { pitchText.y(endY - 6); pitchText.x(endX + 5); }
        else if (angle === 180) { pitchText.y(endY - 6); pitchText.x(endX - 25); }
        else if (angle === 90) { pitchText.x(endX + 5); pitchText.y(endY + 2); }
        else if (angle === 270) { pitchText.x(endX + 5); pitchText.y(endY - 14); }

        this.hipLinesGroup.add(arrow, pitchText);
    }

    addGableLabel(x, y, text, rotation) {
        const label = new Konva.Text({
            x: x,
            y: y,
            text: text,
            fontSize: 14,
            fill: '#b45309',
            fontStyle: 'bold',
            align: 'center',
            verticalAlign: 'middle',
            rotation: rotation,
            letterSpacing: 2,
            opacity: 0.8
        });
        
        // Center the text origin so rotation and placement is around its center
        label.offsetX(label.width() / 2);
        label.offsetY(label.height() / 2);
        
        this.hipLinesGroup.add(label);
    }
    
    addHatchedTriangle(p1, p2, p3) {
        // Draw the outline of the triangle
        this.hipLinesGroup.add(new Konva.Line({
            points: [p1.x, p1.y, p2.x, p2.y, p3.x, p3.y],
            stroke: '#ff4500', strokeWidth: 2, dash: [4, 4],
            fill: 'rgba(255, 69, 0, 0.15)', closed: true
        }));

        // Draw hatching lines inside the triangle radiating to the peak (p2)
        // This gives a very clear 3D slope wall visualization in 2D
        for (let i = 1; i <= 7; i++) {
            let bx = p1.x + (p3.x - p1.x) * (i / 8);
            let by = p1.y + (p3.y - p1.y) * (i / 8);
            this.hipLinesGroup.add(new Konva.Line({
                points: [bx, by, p2.x, p2.y],
                stroke: 'rgba(255, 69, 0, 0.5)', strokeWidth: 1
            }));
        }
    }
    
    remove() {
        this.group.destroy(); this.planner.roofs = this.planner.roofs.filter(r => r !== this); this.planner.selectEntity(null); this.planner.syncAll(); 
    }
}
import Konva from 'konva';
import { offsetPolygon } from '../registry.js';
export class PremiumHipRoof {
    constructor(planner, points) {
        this.planner = planner;
        this.type = 'roof';
        
        // Copy node points to avoid direct reference mutation issues
        this.points = points.map(p => ({ x: p.x, y: p.y }));
        
        this.config = {
            pitch: 30,
            overhang: 0,
            thickness: 10,
            ridgeOffset: 0,
            roofType: 'hip',
            material: 'white_plaster_roof',
            wallGap: 0,
            ridgeAxis: 'x',
            gableMaterial: 'white_plaster_wall'
        };
        
        this.rotation = 0; 
        
        this.configId = 'white_plaster_roof';

        this.group = new Konva.Group({ draggable: true });
        
        this.boundary = new Konva.Line({
            points: this.getFlatPoints(),
            fill: 'rgba(245, 158, 11, 0.3)', // Solid orange fill
            stroke: '#f59e0b',               // Thicker orange stroke
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
        this.boundary.points(this.getFlatPoints());
        this.generateHipLines();
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
        
        if (this.config.roofType === 'gable') {
            if (this.config.ridgeAxis === 'y') {
                this.hipLinesGroup.add(new Konva.Line({ points: [cx, minY, cx, maxY], stroke: '#FFA500', strokeWidth: 2, dash: [4, 4] })); 
            } else {
                this.hipLinesGroup.add(new Konva.Line({ points: [minX, cy, maxX, cy], stroke: '#FFA500', strokeWidth: 2, dash: [4, 4] })); 
            }
        } else {
            pts.forEach(p => { 
                this.hipLinesGroup.add(new Konva.Line({ points: [p.x, p.y, cx, cy], stroke: '#FFA500', strokeWidth: 2, dash: [4, 4] })); 
            });
        }
    }
    
    remove() { this.group.destroy(); this.planner.roofs = this.planner.roofs.filter(r => r !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
}
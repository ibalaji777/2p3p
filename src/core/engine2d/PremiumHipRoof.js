import Konva from 'konva';

export class PremiumHipRoof {
    constructor(planner, points) {
        this.planner = planner;
        this.type = 'roof';
        
        // Copy node points to avoid direct reference mutation issues
        this.points = points.map(p => ({ x: p.x, y: p.y }));
        
        this.config = {
            pitch: 30,
            overhang: 20,
            thickness: 10,
            ridgeOffset: 0,
            roofType: 'hip',
            material: 'asphalt_shingles',
            wallGap: 0
        };
        
        this.rotation = 0; 
        
        this.group = new Konva.Group({ draggable: true });
        
        this.boundary = new Konva.Line({
            points: this.getFlatPoints(),
            fill: 'rgba(255, 165, 0, 0.2)', // Orange fill
            stroke: '#FFA500',              // Orange stroke
            strokeWidth: 3,
            closed: true,
            lineJoin: 'round'
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
        return this.points.flatMap(p => [p.x, p.y]);
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
        this.handles.forEach(h => h.visible(isActive));
        this.planner.stage.batchDraw();
    }
    
    initEvents() {
        this.group.on('mouseenter', () => { if(this.planner.tool === 'select') document.body.style.cursor = 'move'; });
        this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        
        this.group.on('mousedown', (e) => { if (this.planner.tool !== 'select') return; e.cancelBubble = true; this.planner.selectEntity(this, 'roof'); });
        this.group.on('dragstart', (e) => { if (this.planner.tool !== 'select' || this.handles.includes(e.target)) return; this.planner.selectEntity(this, 'roof'); });
        this.group.on('dragmove', (e) => { if (this.planner.tool !== 'select' || this.handles.includes(e.target)) return; this.planner.syncAll(); });
    }
    
    update() {
        this.boundary.points(this.getFlatPoints());
        this.generateHipLines();
    }
    
    generateHipLines() {
        this.hipLinesGroup.destroyChildren();
        
        // Calculate generic center visual (inward bisector intersection approximation)
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.points.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
        
        let cx = minX + (maxX - minX) / 2;
        let cy = minY + (maxY - minY) / 2;
        
        let W = maxX - minX, D = maxY - minY;
        let r1x, r1y, r2x, r2y;
        
        if (W >= D) {
            r1x = cx - (W - D)/2; r1y = cy; r2x = cx + (W - D)/2; r2y = cy;
            this.hipLinesGroup.add(new Konva.Line({ points: [r1x, r1y, r2x, r2y], stroke: '#FFA500', strokeWidth: 2, dash: [4, 4] }));
            this.points.forEach(p => { 
                let targetX = (p.x < cx) ? r1x : r2x; 
                this.hipLinesGroup.add(new Konva.Line({ points: [p.x, p.y, targetX, cy], stroke: '#FFA500', strokeWidth: 2, dash: [4, 4] })); 
            });
        } else {
            r1x = cx; r1y = cy - (D - W)/2; r2x = cx; r2y = cy + (D - W)/2;
            this.hipLinesGroup.add(new Konva.Line({ points: [r1x, r1y, r2x, r2y], stroke: '#FFA500', strokeWidth: 2, dash: [4, 4] }));
            this.points.forEach(p => { 
                let targetY = (p.y < cy) ? r1y : r2y; 
                this.hipLinesGroup.add(new Konva.Line({ points: [p.x, p.y, cx, targetY], stroke: '#FFA500', strokeWidth: 2, dash: [4, 4] })); 
            });
        }
    }
    
    remove() { this.group.destroy(); this.planner.roofs = this.planner.roofs.filter(r => r !== this); this.planner.selectEntity(null); this.planner.syncAll(); }
}
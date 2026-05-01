import Konva from 'konva';
import { SNAP_DIST } from '../registry.js';

export class Anchor {
    constructor(planner, x, y) {
        this.planner = planner; this.lastValidPos = { x, y };
        this.node = new Konva.Group({ x, y, draggable: true, visible: false });
        this.node.add(new Konva.Circle({ radius: 8, fill: "#111827", stroke: "white", strokeWidth: 2 }));
        const arrowOffset = 11; const arrowSize = 4;
        const makeArrow = (points) => new Konva.Line({ points, fill: '#111827', closed: true });
        this.node.add(makeArrow([0, -arrowOffset, -arrowSize, -arrowOffset+arrowSize, arrowSize, -arrowOffset+arrowSize])); 
        this.node.add(makeArrow([0, arrowOffset, -arrowSize, arrowOffset-arrowSize, arrowSize, arrowOffset-arrowSize])); 
        this.node.add(makeArrow([-arrowOffset, 0, -arrowOffset+arrowSize, -arrowSize, -arrowOffset+arrowSize, arrowSize])); 
        this.node.add(makeArrow([arrowOffset, 0, arrowOffset-arrowSize, -arrowSize, arrowOffset-arrowSize, arrowSize]));
        
        this.node.on('dragstart', () => { 
            let attachedWalls = this.planner.walls.filter(w => w.startAnchor === this || w.endAnchor === this); 
            attachedWalls.forEach(w => w.setHighlight(true)); 
        });
        
        this.node.on('dragmove', () => {
            let rawPos = { x: this.planner.snap(this.node.x()), y: this.planner.snap(this.node.y()) };
            let attachedWalls = this.planner.walls.filter(w => w.startAnchor === this || w.endAnchor === this);
            
            let fixedAnchor = null;
            let refAngle = 0;
            if (attachedWalls.length === 1) {
                fixedAnchor = attachedWalls[0].startAnchor === this ? attachedWalls[0].endAnchor : attachedWalls[0].startAnchor;
                if (this.planner.smartGuides && this.planner.smartGuides.calculateAngleSnap) {
                    rawPos = this.planner.smartGuides.calculateAngleSnap({x: fixedAnchor.x, y: fixedAnchor.y}, rawPos, 0);
                }
            } else if (attachedWalls.length >= 2) {
                fixedAnchor = attachedWalls[0].startAnchor === this ? attachedWalls[0].endAnchor : attachedWalls[0].startAnchor;
            }
            
            let proposedPos = rawPos; let targetSnapWall = null, closestDist = SNAP_DIST, snappedObj = false;
            for (let w of this.planner.walls) { 
                if (attachedWalls.includes(w)) continue; 
                let proj = this.planner.getClosestPointOnSegment(proposedPos, w.startAnchor.position(), w.endAnchor.position()); 
                let dist = Math.hypot(proposedPos.x - proj.x, proposedPos.y - proj.y); 
                if (dist < closestDist) { closestDist = dist; proposedPos = proj; targetSnapWall = w; snappedObj = true; } 
            }
            
            if (attachedWalls.length === 1) {
                let fixedAnchor = attachedWalls[0].startAnchor === this ? attachedWalls[0].endAnchor : attachedWalls[0].startAnchor; 
                let dx = proposedPos.x - fixedAnchor.x; let dy = proposedPos.y - fixedAnchor.y; 
                let len = this.planner.formatLength(Math.hypot(dx, dy)); 
                let ang = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1); 
                this.planner.updateInfoBadge(proposedPos.x, proposedPos.y, len, ang, snappedObj);
            }
            
            this.planner.walls.forEach(w => { w.setHighlight(attachedWalls.includes(w) || w === this.planner.selectedEntity); });
            let collision = false; 
            for (let w of attachedWalls) { 
                if (w.hasEvent("stop_collision")) { 
                    let otherAnc = w.startAnchor === this ? w.endAnchor : w.startAnchor; 
                    if (this.planner.checkWallIntersection(proposedPos, otherAnc.position(), [targetSnapWall])) { collision = true; break; } 
                } 
            }
            
            if (collision) { this.node.position(this.lastValidPos); } 
            else { this.node.position(proposedPos); this.lastValidPos = proposedPos; } 
            
            if (snappedObj) this.planner.showSnapGlow(proposedPos.x, proposedPos.y); 
            else this.planner.hideSnapGlow();
            
            if (fixedAnchor && this.planner.smartGuides && this.planner.smartGuides.drawAngleGuide) {
                if (attachedWalls.length >= 2) {
                    let fix2 = attachedWalls[1].startAnchor === this ? attachedWalls[1].endAnchor : attachedWalls[1].startAnchor;
                    let angle2 = Math.atan2(fix2.y - proposedPos.y, fix2.x - proposedPos.x) * 180 / Math.PI;
                    this.planner.smartGuides.drawAngleGuide(proposedPos, {x: fixedAnchor.x, y: fixedAnchor.y}, angle2, true);
                } else {
                    this.planner.smartGuides.clear();
                }
            }

            this.planner.syncAll();
        });
        
        this.node.on('dragend', () => { 
            this.planner.walls.forEach(w => w.setHighlight(w === this.planner.selectedEntity)); 
            this.planner.drawGuideLine(0,0,0,0, false); 
            this.planner.hideInfoBadge(); 
            this.planner.hideSnapGlow(); 
            if (this.planner.smartGuides) this.planner.smartGuides.clear();
            this.planner.syncAll(); 
        }); 
        this.planner.uiLayer.add(this.node);
    }
    
    get x() { return this.node.x(); } 
    get y() { return this.node.y(); } 
    show() { this.node.show(); } 
    hide() { this.node.hide(); } 
    position() { return this.node.position(); }
}
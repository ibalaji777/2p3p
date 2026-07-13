// src/features/railing/tools/RailingTool.js
import { Railing } from '../objects/Railing.js';
import { RailingSnap } from '../utils/RailingSnap.js';

export class RailingTool {
    constructor(planner) {
        this.planner = planner;
    }

    onMouseDown(e) {
        const pos = this.planner.getPointerPos();
        if (!pos) return;

        // Snap logic
        const snap = RailingSnap.getSnapPoint(pos, this.planner);
        const startPoint = snap ? snap.point : pos;
        
        let anchor = snap && snap.type === 'anchor' ? snap.target : this.planner.getOrCreateAnchor(startPoint.x, startPoint.y);

        if (!this.planner.drawing) {
            // Start drawing
            this.planner.drawing = true;
            this.planner.startAnchor = anchor;
            this.planner.lastAnchor = anchor;
            
            // Create preview
            this.planner.preview = new Railing(this.planner, anchor, this.planner.getOrCreateAnchor(pos.x, pos.y));
            this.planner.preview.poly = this.planner.preview; // Mock for compatibility during drag
        } else {
            // Finish segment and continue
            this.planner.preview.endAnchor = anchor;
            this.planner.walls.push(this.planner.preview);
            
            // Start next segment
            this.planner.startAnchor = anchor;
            this.planner.lastAnchor = anchor;
            this.planner.preview = new Railing(this.planner, anchor, this.planner.getOrCreateAnchor(pos.x, pos.y));
        }
        
        this.planner.syncAll();
    }

    onMouseMove(e) {
        if (!this.planner.drawing || !this.planner.preview) return;
        
        const pos = this.planner.getPointerPos();
        if (!pos) return;

        const snap = RailingSnap.getSnapPoint(pos, this.planner);
        const endPoint = snap ? snap.point : pos;

        // Update preview end anchor
        if (this.planner.preview.endAnchor) {
            this.planner.preview.endAnchor.x = endPoint.x;
            this.planner.preview.endAnchor.y = endPoint.y;
        }

        this.planner.stage.batchDraw();
    }

    onDoubleClick(e) {
        if (this.planner.drawing) {
            this.planner.drawing = false;
            if (this.planner.preview) {
                // Determine if we should keep the last segment
                if (this.planner.preview.getLength() > 5) {
                    this.planner.walls.push(this.planner.preview);
                }
                this.planner.preview = null;
            }
            this.planner.tool = 'select';
            this.planner.updateToolStates();
            this.planner.syncAll();
        }
    }
}

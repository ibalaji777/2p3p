// src/features/railing/utils/RailingSnap.js
import { RailingMath } from './RailingMath.js';

export class RailingSnap {
    /**
     * Finds the closest snap point for a given position based on surrounding walls and stairs.
     */
    static getSnapPoint(pos, planner, snapDistance = 15) {
        let bestSnap = null;
        let minDist = snapDistance;

        // Check for anchor snaps
        planner.walls.forEach(w => {
            [w.startAnchor, w.endAnchor].forEach(anchor => {
                if (!anchor) return;
                const dist = RailingMath.distance(pos, anchor.position());
                if (dist < minDist) {
                    minDist = dist;
                    bestSnap = {
                        point: { ...anchor.position() },
                        target: anchor,
                        type: 'anchor'
                    };
                }
            });
        });

        // Check for edge snaps
        if (!bestSnap) {
            planner.walls.forEach(w => {
                if (!w.startAnchor || !w.endAnchor) return;
                const p1 = w.startAnchor.position();
                const p2 = w.endAnchor.position();
                
                const proj = RailingMath.projectPointOnSegment(pos, p1, p2);
                const dist = RailingMath.distance(pos, proj);
                
                if (dist < minDist) {
                    minDist = dist;
                    bestSnap = {
                        point: proj,
                        target: w,
                        type: 'edge'
                    };
                }
            });
        }

        return bestSnap;
    }
}

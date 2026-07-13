// src/features/railing/utils/CornerResolver.js
import { RailingMath } from './RailingMath.js';

export class CornerResolver {
    /**
     * Resolves the corner geometry between two connected railing segments.
     * Calculates the miter angle, extension offsets, and junction type.
     */
    static resolveCorner(segmentIn, segmentOut, thickness) {
        const inDir = { 
            x: segmentIn.end.x - segmentIn.start.x, 
            y: segmentIn.end.y - segmentIn.start.y 
        };
        const outDir = { 
            x: segmentOut.end.x - segmentOut.start.x, 
            y: segmentOut.end.y - segmentOut.start.y 
        };

        const miterVec = RailingMath.calculateMiterBisector(inDir, outDir);
        
        // Calculate corner angle
        const d1 = RailingMath.normalize(inDir);
        const d2 = RailingMath.normalize(outDir);
        
        const dot = RailingMath.dot(d1, d2);
        const det = d1.x * d2.y - d1.y * d2.x;
        const angle = Math.atan2(det, dot); // signed angle between segments

        // Calculate miter extension length needed to match thickness
        // length = (thickness / 2) / sin(theta / 2)
        const halfAngle = Math.abs(angle) / 2;
        let miterExtension = 0;
        
        if (halfAngle > 0.01 && halfAngle < Math.PI - 0.01) {
            miterExtension = (thickness / 2) / Math.sin(halfAngle);
        }

        const isInsideCorner = angle > 0;

        return {
            miterVector: miterVec,
            miterExtension,
            angle,
            isInsideCorner,
            type: Math.abs(angle) < 0.1 ? 'straight' : (Math.abs(angle) > Math.PI / 2 ? 'acute' : 'obtuse')
        };
    }
}

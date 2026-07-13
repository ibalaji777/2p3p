// src/features/railing/utils/RailingMath.js

/**
 * Mathematical utilities for railing generation and manipulation.
 */
export class RailingMath {
    static distance(p1, p2) {
        return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }

    static distance3D(p1, p2) {
        return Math.hypot(p2.x - p1.x, p2.y - p1.y, (p2.z || 0) - (p1.z || 0));
    }

    static angle(p1, p2) {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    }

    static angle3D(p1, p2) {
        const dx = p2.x - p1.x;
        const dz = p2.y - p1.y; // using y as z in 2d context mapping to 3d
        return Math.atan2(dz, dx);
    }

    static normalize(v) {
        const len = Math.hypot(v.x, v.y);
        if (len === 0) return { x: 0, y: 0 };
        return { x: v.x / len, y: v.y / len };
    }

    static cross(v1, v2) {
        return v1.x * v2.y - v1.y * v2.x;
    }

    static dot(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y;
    }

    static projectPointOnSegment(p, a, b) {
        const atob = { x: b.x - a.x, y: b.y - a.y };
        const atop = { x: p.x - a.x, y: p.y - a.y };
        const lenSq = atob.x * atob.x + atob.y * atob.y;
        if (lenSq === 0) return { x: a.x, y: a.y };
        const dot = atop.x * atob.x + atop.y * atob.y;
        const t = Math.max(0, Math.min(1, dot / lenSq));
        return {
            x: a.x + atob.x * t,
            y: a.y + atob.y * t
        };
    }

    static calculateMiterBisector(dir1, dir2) {
        // dir1 is incoming direction, dir2 is outgoing direction
        // Normalize both
        const d1 = this.normalize(dir1);
        const d2 = this.normalize(dir2);
        
        // Tangent vector of the corner is the average of the two directions
        let tx = d1.x + d2.x;
        let ty = d1.y + d2.y;
        
        const tLen = Math.hypot(tx, ty);
        if (tLen < 1e-5) {
            // Straight line or 180 degree turn
            return { x: -d1.y, y: d1.x }; 
        }
        
        tx /= tLen;
        ty /= tLen;
        
        // Miter vector is orthogonal to the tangent
        return { x: -ty, y: tx };
    }
}

// src/features/railing/generators/PathGenerator.js
import * as THREE from 'three';

/**
 * Normalizes any railing path (flat, sloped, or curved) into a standard 3D path.
 * All subsequent geometry generators consume this normalized path.
 */
export class PathGenerator {
    /**
     * Normalizes a line segment into a Path3D object.
     * @param {THREE.Vector3} start 
     * @param {THREE.Vector3} end 
     */
    static normalizeLinear(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dz = end.z - start.z;
        const length = Math.hypot(dx, dy, dz);
        
        const dir = length > 0.0001 ? new THREE.Vector3(dx, dy, dz).normalize() : new THREE.Vector3(1, 0, 0);
        
        return {
            type: 'linear',
            start,
            end,
            length,
            direction: dir,
            getPointAt: (t) => {
                return new THREE.Vector3().copy(start).lerp(end, t);
            },
            getTangentAt: (t) => {
                return dir.clone();
            }
        };
    }

    /**
     * Generates a CatmullRom path for curved or splined railings.
     */
    static normalizeCurve(points) {
        const curve = new THREE.CatmullRomCurve3(points);
        const length = curve.getLength();
        
        return {
            type: 'curve',
            start: points[0],
            end: points[points.length - 1],
            length,
            getPointAt: (t) => curve.getPoint(t),
            getTangentAt: (t) => curve.getTangent(t)
        };
    }
}

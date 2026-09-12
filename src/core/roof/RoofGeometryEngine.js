/**
 * RoofGeometryEngine.js
 * 
 * Pure mathematical calculations for the Roof System:
 * - Polygon bounds, dimensions, and centroids
 * - Effective ridge axis calculations
 * - Pitch to peak-height and inverse peak-height to pitch conversions
 * - Eave perimeter offset polygons
 * - Aperture voids and cutout bounding boxes
 * 
 * ZERO dependencies on Three.js or Konva.
 */

import { offsetPolygon } from '../registry.js';

export class RoofGeometryEngine {
    /**
     * Cleans an array of 2D points, removing consecutive duplicates
     * and closing duplicates within 1 unit of distance.
     * @param {Array<{x: number, y: number}>} points 
     * @returns {Array<{x: number, y: number}>}
     */
    static cleanPoints(points) {
        if (!points || !Array.isArray(points)) return [];
        const cleaned = [];
        for (const p of points) {
            if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue;
            if (cleaned.length > 0) {
                const last = cleaned[cleaned.length - 1];
                if (Math.hypot(p.x - last.x, p.y - last.y) < 1) continue;
            }
            cleaned.push({ x: p.x, y: p.y });
        }

        if (cleaned.length > 2) {
            const first = cleaned[0];
            const last = cleaned[cleaned.length - 1];
            if (Math.hypot(first.x - last.x, first.y - last.y) < 1) {
                cleaned.pop();
            }
        }
        return cleaned;
    }

    /**
     * Calculates the axis-aligned bounding box and dimensions for a set of points.
     * @param {Array<{x: number, y: number}>} points 
     * @param {{x: number, y: number}} [offset={x: 0, y: 0}]
     * @returns {{minX: number, maxX: number, minY: number, maxY: number, width: number, depth: number, cx: number, cy: number}}
     */
    static getBounds(points, offset = { x: 0, y: 0 }) {
        if (!points || points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, depth: 0, cx: 0, cy: 0 };
        }

        const ox = offset?.x || 0;
        const oy = offset?.y || 0;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const p of points) {
            const px = p.x + ox;
            const py = p.y + oy;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
        }

        if (minX === Infinity) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, depth: 0, cx: 0, cy: 0 };
        }

        const width = maxX - minX;
        const depth = maxY - minY;
        return {
            minX,
            maxX,
            minY,
            maxY,
            width,
            depth,
            cx: minX + width / 2,
            cy: minY + depth / 2
        };
    }

    /**
     * Calculates the 2D polygon centroid using signed area formula.
     * Falls back to bounding box center for degenerate polygons.
     * @param {Array<{x: number, y: number}>} points 
     * @returns {{x: number, y: number}}
     */
    static getCentroid(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };
        if (points.length < 3) {
            const b = this.getBounds(points);
            return { x: b.cx, y: b.cy };
        }

        let cx = 0, cy = 0, signedArea = 0;
        for (let i = 0; i < points.length; i++) {
            const p0 = points[i];
            const p1 = points[(i + 1) % points.length];
            const a = p0.x * p1.y - p1.x * p0.y;
            signedArea += a;
            cx += (p0.x + p1.x) * a;
            cy += (p0.y + p1.y) * a;
        }
        signedArea *= 0.5;

        if (Math.abs(signedArea) > 0.1) {
            return {
                x: cx / (6.0 * signedArea),
                y: cy / (6.0 * signedArea)
            };
        }

        const b = this.getBounds(points);
        return { x: b.cx, y: b.cy };
    }

    /**
     * Computes the effective ridge axis ('x' or 'y') for a gable roof.
     * If user explicitly forced an axis, returns it.
     * Otherwise automatically selects based on bounding aspect ratio.
     * @param {Array<{x: number, y: number}>} points 
     * @param {string} [explicitAxis] - 'x' | 'y'
     * @param {boolean} [manualRidge=false]
     * @returns {'x' | 'y'}
     */
    static getEffectiveRidgeAxis(points, explicitAxis = 'x', manualRidge = false) {
        if (manualRidge && (explicitAxis === 'x' || explicitAxis === 'y')) {
            return explicitAxis;
        }
        const bounds = this.getBounds(points);
        return bounds.width >= bounds.depth ? 'x' : 'y';
    }

    /**
     * Calculates the peak ridge height of a roof above its base wall elevation.
     * @param {Array<{x: number, y: number}> | Object} pointsOrRoof 
     * @param {number} [pitch=30] 
     * @param {string} [roofType='gable'] 
     * @param {string} [ridgeAxis='x'] 
     * @returns {number} Peak height in cm
     */
    static getPeakHeight(pointsOrRoof, pitch = 30, roofType = 'gable', ridgeAxis = 'x') {
        let points = pointsOrRoof;
        let p = pitch;
        let rType = roofType;
        let axis = ridgeAxis;

        if (pointsOrRoof && !Array.isArray(pointsOrRoof) && pointsOrRoof.points) {
            points = pointsOrRoof.points;
            const conf = pointsOrRoof.config || pointsOrRoof;
            p = conf.pitch !== undefined ? conf.pitch : pitch;
            rType = conf.roofType || roofType;
            axis = conf.ridgeAxis || ridgeAxis;
        }

        if (rType === 'flat') return 0;

        const bounds = this.getBounds(points);
        const isShed = rType === 'shed' || rType === 'half_gable';
        const span = (axis === 'y') ? bounds.width : (axis === 'x' ? bounds.depth : Math.min(bounds.width, bounds.depth));
        const effSpan = isShed ? span : span / 2;
        const pitchVal = (p !== undefined && p !== null) ? Number(p) : 30;
        if (pitchVal <= 0) return 0;
        const rad = pitchVal * Math.PI / 180;
        const height = effSpan * Math.tan(rad);
        return Math.max(0, Math.round(height * 10) / 10);
    }

    /**
     * Inverse calculation: computes the pitch angle in degrees given a target peak height.
     * @param {Array<{x: number, y: number}> | Object} pointsOrRoof 
     * @param {number} peakHeight 
     * @param {string} [roofType='gable'] 
     * @param {string} [ridgeAxis='x'] 
     * @returns {number} Pitch in degrees [0..88]
     */
    static getPitchFromHeight(pointsOrRoof, peakHeight, roofType = 'gable', ridgeAxis = 'x') {
        let points = pointsOrRoof;
        let rType = roofType;
        let axis = ridgeAxis;

        if (pointsOrRoof && !Array.isArray(pointsOrRoof) && pointsOrRoof.points) {
            points = pointsOrRoof.points;
            const conf = pointsOrRoof.config || pointsOrRoof;
            rType = conf.roofType || roofType;
            axis = conf.ridgeAxis || ridgeAxis;
        }

        if (rType === 'flat' || !peakHeight || peakHeight <= 0) return 0;

        const bounds = this.getBounds(points);
        const isShed = rType === 'shed' || rType === 'half_gable';
        const span = (axis === 'y') ? bounds.width : (axis === 'x' ? bounds.depth : Math.min(bounds.width, bounds.depth));
        const effSpan = isShed ? span : span / 2;
        if (effSpan <= 0) return 0;

        const rad = Math.atan(peakHeight / effSpan);
        const deg = Math.round(rad * 180 / Math.PI);
        return Math.max(0, Math.min(88, deg));
    }

    /**
     * Calculates the offset eave polygon given master or per-edge overhangs.
     * @param {Array<{x: number, y: number}>} points 
     * @param {number|Array<number>} overhangs 
     * @returns {Array<{x: number, y: number}>}
     */
    static getOffsetEaves(points, overhangs = 8) {
        if (!points || points.length < 3) return points || [];
        return offsetPolygon(points, overhangs);
    }

    /**
     * Extracts cutout void boxes for upper-level walls, dormers, and rooms intersecting the roof.
     * @param {Object} roof 
     * @param {Array<Object>} walls 
     * @returns {Array<{x0: number, x1: number, z0: number, z1: number}>}
     */
    static getUpperWallCutouts(roof, walls = []) {
        if (!roof || !walls || walls.length === 0) return [];
        const rotDeg = roof.rotation || (roof.group && typeof roof.group.rotation === 'function' ? roof.group.rotation() : 0);
        if (Math.abs(rotDeg % 360) > 0.01 || roof._isDragging || roof.isDragging) return [];

        const roofElev = roof.elevation !== undefined ? roof.elevation : 120;
        const upperWalls = walls.filter(w => !w.hidden && !w.isAutoGable && w.parentRoofId !== roof.id && (w.elevation || 0) >= (roofElev + 5));
        if (upperWalls.length === 0) return [];

        const bounds = this.getBounds(roof.points, { x: roof.x || 0, y: roof.y || 0 });
        const cutouts = [];

        let uMinX = Infinity, uMaxX = -Infinity, uMinZ = Infinity, uMaxZ = -Infinity;
        let hasUpperWallInRoof = false;

        upperWalls.forEach(w => {
            const p1 = (w.startAnchor && typeof w.startAnchor.position === 'function')
                ? w.startAnchor.position()
                : (w.startAnchor || { x: w.startX || 0, y: w.startY || 0 });
            const p2 = (w.endAnchor && typeof w.endAnchor.position === 'function')
                ? w.endAnchor.position()
                : (w.endAnchor || { x: w.endX || 0, y: w.endY || 0 });

            const wMinX = Math.min(p1.x, p2.x);
            const wMaxX = Math.max(p1.x, p2.x);
            const wMinZ = Math.min(p1.y, p2.y);
            const wMaxZ = Math.max(p1.y, p2.y);

            if (wMaxX >= bounds.minX && wMinX <= bounds.maxX && wMaxZ >= bounds.minY && wMinZ <= bounds.maxY) {
                hasUpperWallInRoof = true;
                uMinX = Math.min(uMinX, wMinX);
                uMaxX = Math.max(uMaxX, wMaxX);
                uMinZ = Math.min(uMinZ, wMinZ);
                uMaxZ = Math.max(uMaxZ, wMaxZ);
            }
        });

        const isFullRoofCover = (uMinX <= bounds.minX + 1 && uMaxX >= bounds.maxX - 1 && uMinZ <= bounds.minY + 1 && uMaxZ >= bounds.maxY - 1) ||
                                (uMaxX - uMinX >= bounds.width - 20 && uMaxZ - uMinZ >= bounds.depth - 20);
        if (hasUpperWallInRoof && uMinX !== Infinity && !isFullRoofCover) {
            cutouts.push({
                x0: uMinX,
                x1: uMaxX,
                z0: uMinZ,
                z1: uMaxZ
            });
        }

        return cutouts;
    }
}

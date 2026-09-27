/**
 * src/core/site/SiteGeometryEngine.js
 * 
 * Pure mathematical authority for site boundaries, 4-sided plots,
 * setback insets, and buildable envelopes.
 * 
 * Zero dependencies on DOM, Three.js, or Konva.
 */

export const UNITS_PER_FT = 20;
export const SQ_UNITS_PER_SQFT = 400; // 20 * 20
export const FT_TO_CM = 30.48;
export const SQFT_TO_CM2 = 929.0304; // 30.48 * 30.48
export const UNITS_TO_CM = 1.524; // 30.48 / 20

export class SiteGeometryEngine {
    /**
     * Calculates the signed area of a 2D polygon using the Shoelace formula.
     * Positive for Clockwise in screen Y-down coordinates.
     * @param {Array<{x: number, y: number}>} points 
     * @returns {number}
     */
    static getSignedArea(points) {
        if (!points || points.length < 3) return 0;
        let sum = 0;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            sum += (p1.x * p2.y - p2.x * p1.y);
        }
        return sum / 2;
    }

    /**
     * Calculates the absolute area of a 2D polygon in world units² (pixels²).
     * @param {Array<{x: number, y: number}>} points 
     * @returns {number}
     */
    static getArea(points) {
        return Math.abs(this.getSignedArea(points));
    }

    /**
     * Converts area in world units² to Square Feet (1 sq ft = 400 units²).
     * @param {number} areaUnits2 
     * @returns {number}
     */
    static units2ToSqFt(areaUnits2) {
        return (Number(areaUnits2) || 0) / SQ_UNITS_PER_SQFT;
    }

    /**
     * Converts Square Feet to world units².
     * @param {number} sqft 
     * @returns {number}
     */
    static sqFtToUnits2(sqft) {
        return (Number(sqft) || 0) * SQ_UNITS_PER_SQFT;
    }

    /**
     * Converts linear world units to feet (20 units = 1 ft).
     * @param {number} units 
     * @returns {number}
     */
    static unitsToFt(units) {
        return (Number(units) || 0) / UNITS_PER_FT;
    }

    /**
     * Converts feet to linear world units.
     * @param {number} ft 
     * @returns {number}
     */
    static ftToUnits(ft) {
        return (Number(ft) || 0) * UNITS_PER_FT;
    }

    /**
     * Converts linear world units to centimeters (1 unit = 1.524 cm).
     * @param {number} units 
     * @returns {number}
     */
    static unitsToCm(units) {
        return (Number(units) || 0) * UNITS_TO_CM;
    }

    /**
     * Converts centimeters to linear world units.
     * @param {number} cm 
     * @returns {number}
     */
    static cmToUnits(cm) {
        return (Number(cm) || 0) / UNITS_TO_CM;
    }

    /**
     * Converts area in cm² to Square Feet (1 sq ft = 929.0304 cm²).
     * @param {number} cm2 
     * @returns {number}
     */
    static cm2ToSqFt(cm2) {
        return (Number(cm2) || 0) / SQFT_TO_CM2;
    }

    /**
     * Converts Square Feet to cm² (1 sq ft = 929.0304 cm²).
     * @param {number} sqft 
     * @returns {number}
     */
    static sqFtToCm2(sqft) {
        return (Number(sqft) || 0) * SQFT_TO_CM2;
    }

    /**
     * Checks if vertices are in Counter-Clockwise order (in screen Y-down coordinates).
     * In screen Y-down (Canvas/SVG), negative signed area is CCW, positive is CW.
     * @param {Array<{x: number, y: number}>} points 
     * @returns {boolean}
     */
    static isCCW(points) {
        return this.getSignedArea(points) < 0;
    }

    /**
     * Normalizes polygon points without inverting edge order.
     * @param {Array<{x: number, y: number}>} points 
     * @returns {Array<{x: number, y: number}>}
     */
    static normalizeCCW(points) {
        if (!points || points.length < 3) return points ? [...points] : [];
        if (!this.isCCW(points)) {
            return [...points].reverse();
        }
        return [...points];
    }

    /**
     * Computes the length of each edge in a polygon.
     * @param {Array<{x: number, y: number}>} points 
     * @returns {Array<number>} Edge lengths in cm
     */
    static getEdgeLengths(points) {
        if (!points || points.length < 2) return [];
        const lengths = [];
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            lengths.push(Math.hypot(p2.x - p1.x, p2.y - p1.y));
        }
        return lengths;
    }

    /**
     * Computes the interior corner angles of a polygon in degrees.
     * @param {Array<{x: number, y: number}>} points 
     * @returns {Array<number>} Angles in degrees (0 to 360)
     */
    static getCornerAngles(points) {
        if (!points || points.length < 3) return [];
        const n = points.length;
        const ccw = this.normalizeCCW(points);
        const angles = [];

        for (let i = 0; i < n; i++) {
            const prev = ccw[(i - 1 + n) % n];
            const curr = ccw[i];
            const next = ccw[(i + 1) % n];

            // Incoming vector (prev -> curr)
            const vIn = { x: curr.x - prev.x, y: curr.y - prev.y };
            // Outgoing vector (curr -> next)
            const vOut = { x: next.x - curr.x, y: next.y - curr.y };

            const lenIn = Math.hypot(vIn.x, vIn.y);
            const lenOut = Math.hypot(vOut.x, vOut.y);

            if (lenIn < 1e-4 || lenOut < 1e-4) {
                angles.push(180);
                continue;
            }

            // Cross product and dot product of vIn and vOut
            // In screen Y-down, for a CCW polygon:
            // Cross product (vIn.x * vOut.y - vIn.y * vOut.x) is negative for left turns
            const cross = vIn.x * vOut.y - vIn.y * vOut.x;
            const dot = vIn.x * vOut.x + vIn.y * vOut.y;

            // Turn angle (deflection) in radians
            const turnAngle = Math.atan2(-cross, dot);

            // Interior angle = PI - turnAngle
            let interiorRad = Math.PI - turnAngle;
            if (interiorRad < 0) interiorRad += 2 * Math.PI;
            if (interiorRad > 2 * Math.PI) interiorRad -= 2 * Math.PI;

            angles.push(Math.round((interiorRad * 180 / Math.PI) * 10) / 10);
        }

        return angles;
    }

    /**
     * Intersects two infinite 2D lines defined by a point and direction vector.
     * @param {{x: number, y: number}} p1 
     * @param {{x: number, y: number}} d1 
     * @param {{x: number, y: number}} p2 
     * @param {{x: number, y: number}} d2 
     * @returns {{x: number, y: number}|null}
     */
    static intersectLines(p1, d1, p2, d2) {
        const det = d1.x * d2.y - d1.y * d2.x;
        if (Math.abs(det) < 1e-6) return null;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const t = (dx * d2.y - dy * d2.x) / det;
        return {
            x: p1.x + t * d1.x,
            y: p1.y + t * d1.y
        };
    }

    /**
     * Tests if two finite line segments intersect.
     * @param {{x: number, y: number}} a1 
     * @param {{x: number, y: number}} a2 
     * @param {{x: number, y: number}} b1 
     * @param {{x: number, y: number}} b2 
     * @returns {boolean}
     */
    static doSegmentsIntersect(a1, a2, b1, b2) {
        const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
        return (ccw(a1, b1, b2) !== ccw(a2, b1, b2)) && (ccw(a1, a2, b1) !== ccw(a1, a2, b2));
    }

    /**
     * Validates a 4-vertex quadrilateral boundary.
     * @param {Array<{x: number, y: number}>} points 
     * @returns {{ valid: boolean, error?: string }}
     */
    static validateQuadrilateral(points) {
        if (!points || !Array.isArray(points)) {
            return { valid: false, error: 'Points array is required.' };
        }
        if (points.length !== 4) {
            return { valid: false, error: `Plot boundary must have exactly 4 vertices. Received ${points.length}.` };
        }

        for (let i = 0; i < 4; i++) {
            const p = points[i];
            if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || isNaN(p.x) || isNaN(p.y)) {
                return { valid: false, error: `Vertex at index ${i} contains invalid coordinates.` };
            }
        }

        // Check self-intersections (edge 0-1 vs edge 2-3, edge 1-2 vs edge 3-0)
        if (this.doSegmentsIntersect(points[0], points[1], points[2], points[3])) {
            return { valid: false, error: 'Plot boundary is self-intersecting (hourglass shape).' };
        }
        if (this.doSegmentsIntersect(points[1], points[2], points[3], points[0])) {
            return { valid: false, error: 'Plot boundary is self-intersecting.' };
        }

        // Check minimum area (at least 50 sq ft)
        const areaSqFt = this.units2ToSqFt(this.getArea(points));
        if (areaSqFt < 50) {
            return { valid: false, error: `Plot area (${Math.round(areaSqFt)} sq ft) is below minimum required 50 sq ft.` };
        }

        return { valid: true };
    }

    /**
     * Constructs a rigid 4-vertex quadrilateral from 4 side lengths and 1 diagonal.
     * 
     * Triangle 1 (A-B-C) with sides a (AB), b (BC), and diagonal d1 (AC).
     * Triangle 2 (A-C-D) with sides d1 (AC), c (CD), and d (DA).
     * 
     * @param {Object} params
     * @param {number} params.sideA - Edge 0 (A to B) in cm
     * @param {number} params.sideB - Edge 1 (B to C) in cm
     * @param {number} params.sideC - Edge 2 (C to D) in cm
     * @param {number} params.sideD - Edge 3 (D to A) in cm
     * @param {number} params.diagonalAC - Diagonal from A to C in cm
     * @param {{x: number, y: number}} [params.origin={x: 0, y: 0}] - Position of vertex A
     * @param {number} [params.rotation=0] - Rotation angle of edge AB in degrees
     * @returns {Array<{x: number, y: number}>|null}
     */
    static constructFromSidesAndDiagonal({ sideA, sideB, sideC, sideD, diagonalAC, origin = { x: 0, y: 0 }, rotation = 0 }) {
        const a = Number(sideA);
        const b = Number(sideB);
        const c = Number(sideC);
        const d = Number(sideD);
        const diag = Number(diagonalAC);

        if (!a || !b || !c || !d || !diag) return null;

        // Triangle inequality checks
        if (a + b <= diag || a + diag <= b || b + diag <= a) return null;
        if (c + d <= diag || c + diag <= d || d + diag <= c) return null;

        // Law of Cosines for angle B in triangle ABC
        // diag^2 = a^2 + b^2 - 2ab*cos(B)
        const cosB = (a * a + b * b - diag * diag) / (2 * a * b);
        const angleB = Math.acos(Math.max(-1, Math.min(1, cosB)));

        // Law of Cosines for angle BAC in triangle ABC
        const cosBAC = (a * a + diag * diag - b * b) / (2 * a * diag);
        const angleBAC = Math.acos(Math.max(-1, Math.min(1, cosBAC)));

        // Law of Cosines for angle CAD in triangle ACD
        const cosCAD = (d * d + diag * diag - c * c) / (2 * d * diag);
        const angleCAD = Math.acos(Math.max(-1, Math.min(1, cosCAD)));

        const rotRad = (rotation * Math.PI) / 180;

        // Vertex A at origin
        const ptA = { x: origin.x, y: origin.y };

        // Vertex B along edge AB direction
        const ptB = {
            x: ptA.x + a * Math.cos(rotRad),
            y: ptA.y + a * Math.sin(rotRad)
        };

        // Vertex C from A along AC (angle rotRad + angleBAC)
        const ptC = {
            x: ptA.x + diag * Math.cos(rotRad + angleBAC),
            y: ptA.y + diag * Math.sin(rotRad + angleBAC)
        };

        // Vertex D from A along AD (angle rotRad + angleBAC - angleCAD or other side)
        // For convex quadrilateral, D is on opposite side of AC from B:
        const ptD = {
            x: ptA.x + d * Math.cos(rotRad + angleBAC + angleCAD),
            y: ptA.y + d * Math.sin(rotRad + angleBAC + angleCAD)
        };

        return [ptA, ptB, ptC, ptD];
    }

    /**
     * Constructs a rigid 4-vertex quadrilateral from 4 side lengths and corner angle A.
     * Uses Law of Cosines to derive diagonal AC, then calls constructFromSidesAndDiagonal.
     * @param {Object} params
     * @param {number} params.sideA
     * @param {number} params.sideB
     * @param {number} params.sideC
     * @param {number} params.sideD
     * @param {number} params.angleA - Corner angle between sideD and sideA in degrees
     * @param {{x: number, y: number}} [params.origin={x: 0, y: 0}]
     * @param {number} [params.rotation=0]
     * @returns {Array<{x: number, y: number}>|null}
     */
    static constructFromSidesAndAngle({ sideA, sideB, sideC, sideD, angleA, origin = { x: 0, y: 0 }, rotation = 0 }) {
        const a = Number(sideA);
        const d = Number(sideD);
        const angRad = (Number(angleA) * Math.PI) / 180;

        // diag^2 = a^2 + d^2 - 2ad*cos(angleA)
        const diagSq = a * a + d * d - 2 * a * d * Math.cos(angRad);
        if (diagSq <= 0) return null;
        const diagonalAC = Math.sqrt(diagSq);

        return this.constructFromSidesAndDiagonal({
            sideA,
            sideB,
            sideC,
            sideD,
            diagonalAC,
            origin,
            rotation
        });
    }

    /**
     * Computes the buildable envelope polygon by insetting boundary edges
     * by their respective setback distances.
     * 
     * Edge 0 (V0 -> V1): Front setback
     * Edge 1 (V1 -> V2): Right setback
     * Edge 2 (V2 -> V3): Rear setback
     * Edge 3 (V3 -> V0): Left setback
     * 
     * If setbacks is null/undefined or all 0, the buildable region equals the site boundary.
     * 
     * @param {Array<{x: number, y: number}>} points - Plot boundary vertices (4 or arbitrary polygon)
     * @param {Object|Array<number>|null} [setbacks=null] - Setback distances in world units
     * @param {Array<number>|null} [roadFrontages=null] - Indices of edges with road frontage
     * @returns {Array<{x: number, y: number}>|null} Inset buildable envelope vertices
     */
    static computeBuildableEnvelope(points, setbacks = null, roadFrontages = null) {
        if (!points || !Array.isArray(points) || points.length < 3) return null;

        if (points.length === 4) {
            const validation = this.validateQuadrilateral(points);
            if (!validation.valid) return null;
        }

        const pts = points;
        const n = pts.length;

        // If no setback configured (setbacks === null or undefined), buildable envelope is the plot boundary itself
        if (setbacks === null || setbacks === undefined) {
            return pts.map(p => ({ x: p.x, y: p.y }));
        }

        // Setbacks per edge: [front (edge 0), right (edge 1), rear (edge 2), left (edge 3)]
        let s;
        if (Array.isArray(setbacks)) {
            s = setbacks.map(v => Math.max(0, Number(v) || 0));
        } else {
            const front = setbacks.front !== undefined && setbacks.front !== null ? Math.max(0, Number(setbacks.front)) : 0;
            const right = setbacks.right !== undefined && setbacks.right !== null ? Math.max(0, Number(setbacks.right)) : 0;
            const rear = setbacks.rear !== undefined && setbacks.rear !== null ? Math.max(0, Number(setbacks.rear)) : 0;
            const left = setbacks.left !== undefined && setbacks.left !== null ? Math.max(0, Number(setbacks.left)) : 0;

            if (roadFrontages && Array.isArray(roadFrontages) && roadFrontages.length > 0 && n === 4) {
                s = [0, 0, 0, 0];
                const rSet = new Set(roadFrontages.map(Number));
                const primaryRoad = Number(roadFrontages[0]) || 0;

                for (let i = 0; i < 4; i++) {
                    if (rSet.has(i)) {
                        s[i] = front;
                    } else if (i === (primaryRoad + 2) % 4) {
                        s[i] = rear;
                    } else if (i === (primaryRoad + 1) % 4) {
                        s[i] = right;
                    } else {
                        s[i] = left;
                    }
                }
            } else {
                s = [front, right, rear, left];
            }
        }

        // If all setbacks are zero (Zero Lot Line), envelope is the plot boundary itself
        if (s.every(dist => dist === 0)) {
            return pts.map(p => ({ x: p.x, y: p.y }));
        }

        // Determine orientation: in screen Y-down, positive signed area is Clockwise (standard V0->V1->V2->V3)
        const signedArea = this.getSignedArea(pts);
        const isClockwise = signedArea > 0;

        // 1. Calculate inward-offset lines for each edge
        const offsetLines = [];
        for (let i = 0; i < n; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % n];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-4) return null;

            const dir = { x: dx / len, y: dy / len };
            // In screen Y-down:
            // For Clockwise polygon, inward normal (turning right) is (-dir.y, dir.x)
            // For Counter-Clockwise polygon, inward normal is (dir.y, -dir.x)
            const normIn = isClockwise ? { x: -dir.y, y: dir.x } : { x: dir.y, y: -dir.x };

            const setbackDist = s[i] !== undefined ? s[i] : 0;
            const pOffset = {
                x: p1.x + normIn.x * setbackDist,
                y: p1.y + normIn.y * setbackDist
            };

            offsetLines.push({ point: pOffset, dir: dir });
        }

        // 2. Intersect adjacent offset lines to form envelope vertices
        const envelope = [];
        for (let i = 0; i < n; i++) {
            const linePrev = offsetLines[(i - 1 + n) % n];
            const lineCurr = offsetLines[i];

            const pt = this.intersectLines(linePrev.point, linePrev.dir, lineCurr.point, lineCurr.dir);
            if (!pt) return null; // Parallel or degenerate lines
            envelope.push({
                x: Math.round(pt.x * 10) / 10,
                y: Math.round(pt.y * 10) / 10
            });
        }

        // 3. Verify envelope validity
        if (envelope.length === 4) {
            const envValidation = this.validateQuadrilateral(envelope);
            if (!envValidation.valid) return null;
        }

        // Check if envelope orientation inverted relative to original plot (edges crossed)
        const envSignedArea = this.getSignedArea(envelope);
        if ((envSignedArea > 0) !== isClockwise) {
            return null; // Setbacks too large, edges crossed and inverted
        }

        // Verify envelope is completely contained inside original plot
        const originalArea = this.getArea(pts);
        const envelopeArea = this.getArea(envelope);
        if (envelopeArea >= originalArea || envelopeArea < this.sqFtToUnits2(20)) {
            return null; // Setbacks too large, buildable envelope collapsed
        }

        for (let i = 0; i < envelope.length; i++) {
            if (!this.isPointInsidePolygon(envelope[i], pts)) {
                return null;
            }
        }

        return envelope;
    }

    /**
     * Determines whether an inner polygon is completely contained within an outer polygon.
     * Checks all vertices and verifies no edge crossings.
     * 
    /**
     * Determines whether two line segments strictly cross each other (proper intersection).
     * Collinear segments or segments touching at an endpoint do NOT strictly cross.
     * @param {{x: number, y: number}} a1
     * @param {{x: number, y: number}} a2
     * @param {{x: number, y: number}} b1
     * @param {{x: number, y: number}} b2
     * @returns {boolean}
     */
    static doSegmentsProperlyIntersect(a1, a2, b1, b2) {
        const cp = (p1, p2, p3) => (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
        const cp1 = cp(a1, a2, b1);
        const cp2 = cp(a1, a2, b2);
        const cp3 = cp(b1, b2, a1);
        const cp4 = cp(b1, b2, a2);

        return ((cp1 > 1e-4 && cp2 < -1e-4) || (cp1 < -1e-4 && cp2 > 1e-4)) &&
               ((cp3 > 1e-4 && cp4 < -1e-4) || (cp3 < -1e-4 && cp4 > 1e-4));
    }

    /**
     * Verifies that innerPolygon is strictly contained within outerPolygon.
     * All vertices of innerPolygon must be inside or on the boundary of outerPolygon,
     * and no edges of innerPolygon may cross any edges of outerPolygon.
     * 
     * @param {Array<{x: number, y: number}>} innerPolygon 
     * @param {Array<{x: number, y: number}>} outerPolygon 
     * @param {number} [tolerance=0.5] 
     * @returns {boolean}
     */
    static isPolygonContained(innerPolygon, outerPolygon, tolerance = 0.5) {
        if (!innerPolygon || !outerPolygon || innerPolygon.length < 3 || outerPolygon.length < 3) return false;

        // 1. All vertices of innerPolygon must be inside outerPolygon
        for (let i = 0; i < innerPolygon.length; i++) {
            if (!this.isPointInsidePolygon(innerPolygon[i], outerPolygon, tolerance)) {
                return false;
            }
        }

        // 2. No edge of innerPolygon may strictly cross any edge of outerPolygon
        const nInner = innerPolygon.length;
        const nOuter = outerPolygon.length;
        for (let i = 0; i < nInner; i++) {
            const a1 = innerPolygon[i];
            const a2 = innerPolygon[(i + 1) % nInner];
            for (let j = 0; j < nOuter; j++) {
                const b1 = outerPolygon[j];
                const b2 = outerPolygon[(j + 1) % nOuter];
                if (this.doSegmentsProperlyIntersect(a1, a2, b1, b2)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Determines whether a point lies inside a 2D polygon.
     * @param {{x: number, y: number}} point 
     * @param {Array<{x: number, y: number}>} polygon 
     * @returns {boolean}
     */
    static isPointInsidePolygon(point, polygon, tolerance = 0.5) {
        if (!point || !polygon || polygon.length < 3) return false;

        // Check if point lies directly on any edge within tolerance
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq > 0) {
                const t = Math.max(0, Math.min(1, ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq));
                const projX = p1.x + t * dx;
                const projY = p1.y + t * dy;
                const distSq = (point.x - projX) ** 2 + (point.y - projY) ** 2;
                if (distSq <= tolerance * tolerance) {
                    return true;
                }
            }
        }

        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
}

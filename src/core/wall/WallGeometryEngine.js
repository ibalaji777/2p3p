/**
 * WallGeometryEngine.js
 * 
 * Single source of truth for all wall geometry calculations:
 * - Length, Direction, Angle, and Normal
 * - 2D Corner Miters, Bevels, T-Junctions, and Multi-Wall Junctions
 * - Exact Monolithic 2D Polygons (including solid protrusions)
 * - Top Profiles (Normal, Gable, Single Slope)
 * - Canonical Aperture Void Definitions (Doors, Windows, Openings)
 */

export class WallGeometryEngine {
    /**
     * Resolves anchor position object { x, y } safely from an Anchor instance or coordinates object.
     * @param {Object} anchor 
     * @returns {{x: number, y: number}}
     */
    static getAnchorPosition(anchor) {
        if (!anchor) return { x: 0, y: 0 };
        if (typeof anchor.position === 'function') {
            const p = anchor.position();
            return { x: Number(p.x) || 0, y: Number(p.y) || 0 };
        }
        return {
            x: Number(anchor.x !== undefined ? anchor.x : (anchor.startX || 0)),
            y: Number(anchor.y !== undefined ? anchor.y : (anchor.startY || 0))
        };
    }

    /**
     * Computes the Euclidean length of the wall centerline.
     * @param {Object} wall 
     * @returns {number} Length in cm
     */
    static getLength(wall) {
        if (!wall) return 0;
        const p1 = this.getAnchorPosition(wall.startAnchor || { x: wall.startX, y: wall.startY });
        const p2 = this.getAnchorPosition(wall.endAnchor || { x: wall.endX, y: wall.endY });
        return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }

    /**
     * Computes the normalized unit direction vector along the wall from start to end.
     * @param {Object} wall 
     * @returns {{x: number, y: number}}
     */
    static getDirection(wall) {
        const p1 = this.getAnchorPosition(wall.startAnchor || { x: wall.startX, y: wall.startY });
        const p2 = this.getAnchorPosition(wall.endAnchor || { x: wall.endX, y: wall.endY });
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return { x: 1, y: 0 };
        return { x: dx / len, y: dy / len };
    }

    /**
     * Computes the angle of the wall in radians (-PI to +PI).
     * @param {Object} wall 
     * @returns {number}
     */
    static getAngle(wall) {
        const p1 = this.getAnchorPosition(wall.startAnchor || { x: wall.startX, y: wall.startY });
        const p2 = this.getAnchorPosition(wall.endAnchor || { x: wall.endX, y: wall.endY });
        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    }

    /**
     * Computes the perpendicular unit normal vector pointing toward the FRONT face (+Z / left in 2D).
     * @param {Object} wall 
     * @returns {{x: number, y: number}}
     */
    static getNormal(wall) {
        const u = this.getDirection(wall);
        return { x: -u.y, y: u.x };
    }

    /**
     * Returns the 2D baseline centerline endpoints and length/angle package.
     * @param {Object} wall 
     * @returns {{p1: {x, y}, p2: {x, y}, length: number, angle: number, normal: {x, y}, direction: {x, y}}}
     */
    static getCenterline(wall) {
        const p1 = this.getAnchorPosition(wall.startAnchor || { x: wall.startX, y: wall.startY });
        const p2 = this.getAnchorPosition(wall.endAnchor || { x: wall.endX, y: wall.endY });
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.hypot(dx, dy);
        const direction = length > 0 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 };
        const normal = { x: -direction.y, y: direction.x };
        const angle = Math.atan2(dy, dx);
        return { p1, p2, length, angle, normal, direction };
    }

    /**
     * Intersects two 2D infinite lines defined by a point and direction vector.
     * @param {{x, y}} p1 
     * @param {{x, y}} v1 
     * @param {{x, y}} p2 
     * @param {{x, y}} v2 
     * @returns {{x, y}|null}
     */
    static intersectLines(p1, v1, p2, v2) {
        const det = v1.x * v2.y - v1.y * v2.x;
        if (Math.abs(det) < 1e-5) return null;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const t = (dx * v2.y - dy * v2.x) / det;
        return { x: p1.x + t * v1.x, y: p1.y + t * v1.y };
    }

    /**
     * Calculates the canonical corner miters, bevels, and junction geometry for a wall endpoint.
     * @param {Object} wall - The PremiumWall instance
     * @param {Object} anchor - The anchor node being evaluated
     * @param {boolean} isStart - True if evaluating startAnchor, false if endAnchor
     * @param {Array<Object>} allWalls - The full collection of walls (planner.walls)
     * @returns {Object} Miter result containing corners, trueCorners, hasCap, bevels
     */
    static getCorners(wall, anchor, isStart, allWalls = []) {
        if (!anchor) {
            return {
                corners: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
                trueCorners: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
                hasCap: true,
                bevelL: null,
                bevelR: null
            };
        }

        const P = this.getAnchorPosition(anchor);
        const p1 = this.getAnchorPosition(wall.startAnchor || { x: wall.startX, y: wall.startY });
        const p2 = this.getAnchorPosition(wall.endAnchor || { x: wall.endX, y: wall.endY });
        const vdx = p2.x - p1.x;
        const vdy = p2.y - p1.y;
        const vlen = Math.hypot(vdx, vdy);
        if (vlen === 0) {
            return { corners: [P, P], trueCorners: [P, P], hasCap: true, bevelL: null, bevelR: null };
        }

        const u = { x: vdx / vlen, y: vdy / vlen };
        const n = { x: -u.y, y: u.x };
        const ht = (Number(wall.thickness) || Number(wall.config?.thickness) || 20) / 2;

        const baseL = isStart ? { x: p1.x + n.x * ht, y: p1.y + n.y * ht } : { x: p2.x + n.x * ht, y: p2.y + n.y * ht };
        const baseR = isStart ? { x: p1.x - n.x * ht, y: p1.y - n.y * ht } : { x: p2.x - n.x * ht, y: p2.y - n.y * ht };

        // Collect all outgoing rays at this anchor
        const rays = [];
        allWalls.forEach(w => {
            if ((w.startAnchor === anchor || w.endAnchor === anchor) && w.type !== 'railing' && (!w.hidden || w === wall)) {
                const isWStart = w.startAnchor === anchor;
                const wp1 = this.getAnchorPosition(w.startAnchor || { x: w.startX, y: w.startY });
                const wp2 = this.getAnchorPosition(w.endAnchor || { x: w.endX, y: w.endY });
                const wu = { x: wp2.x - wp1.x, y: wp2.y - wp1.y };
                const wlen = Math.hypot(wu.x, wu.y);
                if (wlen === 0) return;
                wu.x /= wlen;
                wu.y /= wlen;
                const wn = { x: -wu.y, y: wu.x };
                const wht = (Number(w.thickness) || Number(w.config?.thickness) || 20) / 2;

                const w_p1_L = { x: wp1.x + wn.x * wht, y: wp1.y + wn.y * wht };
                const w_p1_R = { x: wp1.x - wn.x * wht, y: wp1.y - wn.y * wht };
                const w_p2_L = { x: wp2.x + wn.x * wht, y: wp2.y + wn.y * wht };
                const w_p2_R = { x: wp2.x - wn.x * wht, y: wp2.y - wn.y * wht };

                const dir = isWStart ? wu : { x: -wu.x, y: -wu.y };
                const angle = Math.atan2(dir.y, dir.x);

                const existingRay = rays.find(r => Math.abs(r.angle - angle) < 1e-4);
                if (existingRay) {
                    if (w === wall) existingRay.w = wall;
                } else {
                    rays.push({
                        w: w,
                        dir: dir,
                        angle: angle,
                        L_pt: isWStart ? w_p1_L : w_p2_R,
                        R_pt: isWStart ? w_p1_R : w_p2_L
                    });
                }
            }
        });

        // 1 RAY: Dead end (with optional reference background extension)
        if (rays.length <= 1) {
            return { corners: [baseL, baseR], trueCorners: [baseL, baseR], hasCap: true, bevelL: null, bevelR: null };
        }

        rays.sort((a, b) => a.angle - b.angle);
        const myIndex = rays.findIndex(r => r.w === wall);
        if (myIndex === -1) {
            return { corners: [baseL, baseR], trueCorners: [baseL, baseR], hasCap: true, bevelL: null, bevelR: null };
        }

        const myRay = rays[myIndex];

        // 3+ RAYS: Check if this wall is part of a straight collinear through-wall meeting a T-junction
        const collinearOppositeRay = rays.find(r => r !== myRay && Math.abs(r.dir.x * myRay.dir.x + r.dir.y * myRay.dir.y + 1) < 1e-3);
        if (collinearOppositeRay && rays.length >= 3) {
            return {
                corners: [baseL, baseR],
                trueCorners: [baseL, baseR],
                hasCap: false,
                leftDir: collinearOppositeRay.dir,
                rightDir: collinearOppositeRay.dir,
                bevelL: null,
                bevelR: null
            };
        }

        const leftNeighbor = rays[(myIndex - 1 + rays.length) % rays.length];
        const rightNeighbor = rays[(myIndex + 1) % rays.length];

        // Left side intersection with rightNeighbor
        const rightNeighborHt = (rightNeighbor.w?.thickness || 20) / 2;
        const cornerDistL = Math.hypot(ht, rightNeighborHt);
        const maxMiterLengthL = Math.max(ht * (wall.miterLimitRatio || 3.0), cornerDistL * 1.5);

        const cpL = myRay.dir.x * rightNeighbor.dir.y - myRay.dir.y * rightNeighbor.dir.x;
        let leftSideCorner = myRay.L_pt, leftSideBevel = null;
        let trueL = myRay.L_pt;
        const iL = this.intersectLines(myRay.L_pt, myRay.dir, rightNeighbor.R_pt, rightNeighbor.dir);
        if (iL) {
            const distIL = Math.hypot(iL.x - P.x, iL.y - P.y);
            if (distIL <= maxMiterLengthL) {
                trueL = iL;
            } else {
                const dirL = { x: (iL.x - P.x) / distIL, y: (iL.y - P.y) / distIL };
                trueL = { x: P.x + dirL.x * maxMiterLengthL, y: P.y + dirL.y * maxMiterLengthL };
            }
            if (cpL >= -1e-5) {
                leftSideCorner = iL;
                leftSideBevel = null;
            } else if (distIL <= maxMiterLengthL) {
                leftSideCorner = iL;
                leftSideBevel = null;
            } else {
                leftSideCorner = myRay.L_pt;
                leftSideBevel = rightNeighbor.R_pt;
            }
        } else {
            leftSideCorner = myRay.L_pt;
            leftSideBevel = null;
        }

        // Right side intersection with leftNeighbor
        const leftNeighborHt = (leftNeighbor.w?.thickness || 20) / 2;
        const cornerDistR = Math.hypot(ht, leftNeighborHt);
        const maxMiterLengthR = Math.max(ht * (wall.miterLimitRatio || 3.0), cornerDistR * 1.5);

        const cpR = leftNeighbor.dir.x * myRay.dir.y - leftNeighbor.dir.y * myRay.dir.x;
        let rightSideCorner = myRay.R_pt, rightSideBevel = null;
        let trueR = myRay.R_pt;
        const iR = this.intersectLines(myRay.R_pt, myRay.dir, leftNeighbor.L_pt, leftNeighbor.dir);
        if (iR) {
            const distIR = Math.hypot(iR.x - P.x, iR.y - P.y);
            if (distIR <= maxMiterLengthR) {
                trueR = iR;
            } else {
                const dirR = { x: (iR.x - P.x) / distIR, y: (iR.y - P.y) / distIR };
                trueR = { x: P.x + dirR.x * maxMiterLengthR, y: P.y + dirR.y * maxMiterLengthR };
            }
            if (cpR >= -1e-5) {
                rightSideCorner = iR;
                rightSideBevel = null;
            } else if (distIR <= maxMiterLengthR) {
                rightSideCorner = iR;
                rightSideBevel = null;
            } else {
                rightSideCorner = myRay.R_pt;
                rightSideBevel = leftNeighbor.L_pt;
            }
        } else {
            rightSideCorner = myRay.R_pt;
            rightSideBevel = null;
        }

        let finalL, finalR, bevelL, bevelR, trueFinalL, trueFinalR;
        if (isStart) {
            finalL = leftSideCorner; finalR = rightSideCorner;
            bevelL = leftSideBevel; bevelR = rightSideBevel;
            trueFinalL = (iL && cpL >= -1e-5) ? iL : trueL;
            trueFinalR = (iR && cpR >= -1e-5) ? iR : trueR;
        } else {
            finalL = rightSideCorner; finalR = leftSideCorner;
            bevelL = rightSideBevel; bevelR = leftSideBevel;
            trueFinalL = (iR && cpR >= -1e-5) ? iR : trueR;
            trueFinalR = (iL && cpL >= -1e-5) ? iL : trueL;
        }

        return {
            corners: [finalL, finalR],
            trueCorners: [trueFinalL, trueFinalR],
            hasCap: false,
            leftDir: leftNeighbor.dir,
            rightDir: rightNeighbor.dir,
            bevelL: bevelL,
            bevelR: bevelR
        };
    }

    /**
     * Calculates the full 2D polygon vertex array [x1, y1, x2, y2, ...] enclosing the wall and any protrusions.
     * @param {Object} wall 
     * @param {Array<Object>} allWalls 
     * @returns {Array<number>}
     */
    static getExactPolygonPoints(wall, allWalls = []) {
        if (!wall) return [];
        const centerline = this.getCenterline(wall);
        const { p1, p2, length, normal } = centerline;
        if (length === 0) return [];

        const halfThick = (Number(wall.thickness) || Number(wall.config?.thickness) || 20) / 2;
        const startData = this.getCorners(wall, wall.startAnchor, true, allWalls);
        const endData = this.getCorners(wall, wall.endAnchor, false, allWalls);

        const startL = startData.corners[0];
        const startR = startData.corners[1];
        const endL = endData.corners[0];
        const endR = endData.corners[1];

        // Step-out solid protrusions (Universal Wall Push/Pull & Solid Protrusions standard)
        const protrusions = (wall.attachedWidgets || []).filter(w => w.type === 'solid_protrusion' && (w.depth || w.width));

        let frontVerts = [];
        let backVerts = [];

        if (startData.bevelL) frontVerts.push({ x: startData.bevelL.x, y: startData.bevelL.y });
        frontVerts.push(startL);

        const frontProtrusions = protrusions.filter(p => (p.facing === undefined || p.facing === 1) || p.side === 'front');
        const backProtrusions = protrusions.filter(p => p.facing === -1 || p.side === 'back');

        // Front Face step-outs
        if (frontProtrusions.length > 0) {
            frontProtrusions.sort((a, b) => (a.t || 0.5) - (b.t || 0.5));
            frontProtrusions.forEach(p => {
                const pW = p.width || 100;
                const pD = p.depth || 20;
                const tCenter = p.t !== undefined ? p.t : 0.5;
                const tHalf = (pW / 2) / length;
                const t1 = Math.max(0, Math.min(1, tCenter - tHalf));
                const t2 = Math.max(0, Math.min(1, tCenter + tHalf));

                const ptA = { x: p1.x + normal.x * halfThick + (p2.x - p1.x) * t1, y: p1.y + normal.y * halfThick + (p2.y - p1.y) * t1 };
                const ptB = { x: p1.x + normal.x * halfThick + (p2.x - p1.x) * t2, y: p1.y + normal.y * halfThick + (p2.y - p1.y) * t2 };
                const ptA_out = { x: ptA.x + normal.x * pD, y: ptA.y + normal.y * pD };
                const ptB_out = { x: ptB.x + normal.x * pD, y: ptB.y + normal.y * pD };

                frontVerts.push(ptA, ptA_out, ptB_out, ptB);
            });
        }

        frontVerts.push(endL);
        if (endData.bevelL) frontVerts.push({ x: endData.bevelL.x, y: endData.bevelL.y });
        if (endData.bevelR) frontVerts.push({ x: endData.bevelR.x, y: endData.bevelR.y });

        backVerts.push(endR);

        // Back Face step-outs
        if (backProtrusions.length > 0) {
            backProtrusions.sort((a, b) => (b.t || 0.5) - (a.t || 0.5));
            backProtrusions.forEach(p => {
                const pW = p.width || 100;
                const pD = p.depth || 20;
                const tCenter = p.t !== undefined ? p.t : 0.5;
                const tHalf = (pW / 2) / length;
                const t1 = Math.max(0, Math.min(1, tCenter + tHalf));
                const t2 = Math.max(0, Math.min(1, tCenter - tHalf));

                const ptA = { x: p1.x - normal.x * halfThick + (p2.x - p1.x) * t1, y: p1.y - normal.y * halfThick + (p2.y - p1.y) * t1 };
                const ptB = { x: p1.x - normal.x * halfThick + (p2.x - p1.x) * t2, y: p1.y - normal.y * halfThick + (p2.y - p1.y) * t2 };
                const ptA_out = { x: ptA.x - normal.x * pD, y: ptA.y - normal.y * pD };
                const ptB_out = { x: ptB.x - normal.x * pD, y: ptB.y - normal.y * pD };

                backVerts.push(ptA, ptA_out, ptB_out, ptB);
            });
        }

        backVerts.push(startR);
        if (startData.bevelR) backVerts.push({ x: startData.bevelR.x, y: startData.bevelR.y });

        const pts = [];
        [...frontVerts, ...backVerts].forEach(v => {
            pts.push(v.x, v.y);
        });
        return pts;
    }

    /**
     * Calculates the height profile across the wall (gable, single-slope, or flat).
     * @param {Object} wall 
     * @returns {{type: string, startHeight: number, endHeight: number, peakHeight: number, maxHeight: number}}
     */
    static getTopProfile(wall) {
        const defaultH = Number(wall.height) || Number(wall.config?.height) || 180;
        const type = wall.topProfileType || 'normal';
        const startHeight = wall.startHeight !== undefined ? Number(wall.startHeight) : defaultH;
        const endHeight = wall.endHeight !== undefined ? Number(wall.endHeight) : defaultH;
        const peakHeight = wall.peakHeight !== undefined ? Number(wall.peakHeight) : defaultH;
        const maxHeight = Math.max(defaultH, startHeight, endHeight, peakHeight);
        return { type, startHeight, endHeight, peakHeight, maxHeight };
    }

    /**
     * Extracts canonical aperture voids (doors, windows, cutouts) for both 2D and 3D.
     * @param {Object} wall 
     * @returns {Array<Object>}
     */
    static getApertureVoids(wall) {
        if (!wall || !wall.attachedWidgets) return [];
        const length = this.getLength(wall);
        const wallH = Number(wall.height) || Number(wall.config?.height) || 180;

        return wall.attachedWidgets.map(widget => {
            const t = widget.t !== undefined ? widget.t : 0.5;
            const wCenter = t * length;
            const width = Number(widget.width) || (widget.type === 'door' ? 90 : 120);
            const height = Number(widget.height) || (widget.type === 'door' ? 210 : 120);
            const elev = widget.elevation !== undefined ? Number(widget.elevation) : (widget.type === 'door' ? 0 : 90);

            const isDoor = widget.type === 'door' || widget.doorType || widget.type?.startsWith('door_');
            const isWindow = widget.type === 'window' || widget.windowType || widget.type?.startsWith('window_');
            const isOpening = widget.type === 'opening' || widget.type === 'wall_opening' || widget.type === 'circular_opening' || widget.type === 'arch_opening';
            const isJali = widget.type === 'jali' || widget.type === 'jali_panel';
            const isProtrusion = widget.type === 'solid_protrusion';

            const hasHole = !isProtrusion && (isDoor || isWindow || isOpening || isJali);

            return {
                id: widget.id,
                type: widget.type,
                widget: widget,
                t: t,
                centerLocalX: wCenter,
                startX: wCenter - width / 2,
                endX: wCenter + width / 2,
                width: width,
                height: height,
                elevation: elev,
                hasHole: hasHole,
                isDoor,
                isWindow,
                isOpening,
                isJali,
                isProtrusion,
                facing: widget.facing !== undefined ? widget.facing : 1
            };
        });
    }
}

/**
 * WallCollisionEngine.js
 * 
 * UNIVERSAL WALL COLLISION & MAGNETIC WALL SNAP ENGINE FOR 2D/3D.
 * 
 * Capabilities:
 * 1. OBB (Oriented Bounding Box) Separating Axis Theorem (SAT) projection against 2D wall baselines.
 * 2. Hard Wall Collision: Prevents objects (furniture, stairs, shapes, appliances) from penetrating walls.
 * 3. Magnetic Wall Snap: Automatically snaps objects flush against the wall face when within snap threshold.
 * 4. Wall Surface Auto-Alignment: Automatically aligns object rotation parallel or flush with the wall angle.
 * 5. Corner Pinch Resolution: Multi-wall resolution for interior corners and L-junctions.
 */

import { WallGeometryEngine } from './WallGeometryEngine.js';
import { WallEngine } from './WallEngine.js';

export class WallCollisionEngine {
    /**
     * Resolves object position and rotation against all walls in the planner scene.
     * 
     * @param {Object} params
     * @param {number} params.x - Candidate world X coordinate (cm).
     * @param {number} params.z - Candidate world Z coordinate (cm, mapped to 2D Y).
     * @param {number} [params.rotation=0] - Current object rotation in degrees.
     * @param {number} [params.width=80] - Object width along local X (cm).
     * @param {number} [params.depth=80] - Object depth along local Z (cm).
     * @param {Object} params.planner - Canonical planner instance holding walls.
     * @param {Object} [params.options={}] - Configuration options.
     * @param {boolean} [params.options.enableCollision=true] - Prevent penetrating through walls.
     * @param {boolean} [params.options.enableWallSnap=true] - Snap flush to wall face when nearby.
     * @param {boolean} [params.options.enableWallAlign=true] - Snap rotation to align with wall.
     * @param {number} [params.options.snapDistance=20] - Proximity threshold to trigger snap (cm).
     * @param {Array<string>} [params.options.ignoreWallIds=[]] - Wall IDs to ignore.
     * 
     * @returns {{
     *   x: number,
     *   z: number,
     *   rotation: number,
     *   isColliding: boolean,
     *   isSnapped: boolean,
     *   snappedWall: Object|null
     * }}
     */
    static resolvePlacement({
        x,
        z,
        rotation = 0,
        width = 80,
        depth = 80,
        planner,
        options = {}
    }) {
        const enableCollision = options.enableCollision !== false;
        const enableWallSnap = options.enableWallSnap !== false;
        const enableWallAlign = options.enableWallAlign !== false;
        const snapDistance = options.snapDistance !== undefined ? options.snapDistance : 20;
        const ignoreWallIds = options.ignoreWallIds || [];

        let resolvedX = x;
        let resolvedZ = z;
        let resolvedRot = rotation;
        let isColliding = false;
        let isSnapped = false;
        let snappedWall = null;

        if (!planner || !planner.walls || planner.walls.length === 0) {
            return {
                x: resolvedX,
                z: resolvedZ,
                rotation: resolvedRot,
                isColliding: false,
                isSnapped: false,
                snappedWall: null
            };
        }

        // Object half dimensions
        const halfW = Math.max(1, width / 2);
        const halfD = Math.max(1, depth / 2);

        // Object local axes unit vectors in world space
        // Rotation in Three.js around Y is: yRot = -rot * Math.PI / 180
        const rotRad = -(rotation * Math.PI / 180);
        const axX = Math.cos(rotRad);
        const axZ = -Math.sin(rotRad);
        const azX = Math.sin(rotRad);
        const azZ = Math.cos(rotRad);

        // Multiple passes to resolve corner pinches (e.g. object between two walls)
        const maxPasses = 2;
        let closestSnapDist = Infinity;
        let bestSnapCandidate = null;

        // Fix 8: Acute Wall Corner Collision Convergence & Bisector Clamping
        // Check if object initially penetrates two walls sharing a common anchor, resolving directly along bisector
        if (enableCollision && planner.walls && planner.walls.length >= 2) {
            for (let i = 0; i < planner.walls.length; i++) {
                const w1 = planner.walls[i];
                if (!w1 || ignoreWallIds.includes(w1.id)) continue;
                const p1_1 = WallGeometryEngine.getAnchorPosition(w1.startAnchor || { x: w1.startX, y: w1.startY });
                const p2_1 = WallGeometryEngine.getAnchorPosition(w1.endAnchor || { x: w1.endX, y: w1.endY });
                const dx1 = p2_1.x - p1_1.x, dy1 = p2_1.y - p1_1.y, len1 = Math.hypot(dx1, dy1);
                if (len1 < 1) continue;
                const u1 = { x: dx1 / len1, y: dy1 / len1 };
                const n1 = { x: -u1.y, y: u1.x };
                const Rn1 = halfW * Math.abs(axX * n1.x + axZ * n1.y) + halfD * Math.abs(azX * n1.x + azZ * n1.y);
                const Dmin1 = (Number(w1.thickness) || 20) / 2 + Rn1;
                const v1 = { x: resolvedX - p1_1.x, y: resolvedZ - p1_1.y };
                const t1 = v1.x * u1.x + v1.y * u1.y;
                if (t1 < -Rn1 * 0.5 || t1 > len1 + Rn1 * 0.5) continue;
                const dSigned1 = v1.x * n1.x + v1.y * n1.y;
                if (Math.abs(dSigned1) >= Dmin1 - 0.05) continue;

                for (let j = i + 1; j < planner.walls.length; j++) {
                    const w2 = planner.walls[j];
                    if (!w2 || ignoreWallIds.includes(w2.id)) continue;
                    const p1_2 = WallGeometryEngine.getAnchorPosition(w2.startAnchor || { x: w2.startX, y: w2.startY });
                    const p2_2 = WallGeometryEngine.getAnchorPosition(w2.endAnchor || { x: w2.endX, y: w2.endY });
                    const dx2 = p2_2.x - p1_2.x, dy2 = p2_2.y - p1_2.y, len2 = Math.hypot(dx2, dy2);
                    if (len2 < 1) continue;
                    const u2 = { x: dx2 / len2, y: dy2 / len2 };
                    const n2 = { x: -u2.y, y: u2.x };
                    const Rn2 = halfW * Math.abs(axX * n2.x + axZ * n2.y) + halfD * Math.abs(azX * n2.x + azZ * n2.y);
                    const Dmin2 = (Number(w2.thickness) || 20) / 2 + Rn2;
                    const v2 = { x: resolvedX - p1_2.x, y: resolvedZ - p1_2.y };
                    const t2 = v2.x * u2.x + v2.y * u2.y;
                    if (t2 < -Rn2 * 0.5 || t2 > len2 + Rn2 * 0.5) continue;
                    const dSigned2 = v2.x * n2.x + v2.y * n2.y;
                    if (Math.abs(dSigned2) >= Dmin2 - 0.05) continue;

                    let corner = null;
                    if (Math.hypot(p1_1.x - p1_2.x, p1_1.y - p1_2.y) < 1 || Math.hypot(p1_1.x - p2_2.x, p1_1.y - p2_2.y) < 1) corner = p1_1;
                    else if (Math.hypot(p2_1.x - p1_2.x, p2_1.y - p1_2.y) < 1 || Math.hypot(p2_1.x - p2_2.x, p2_1.y - p2_2.y) < 1) corner = p2_1;

                    if (corner) {
                        const side1 = dSigned1 >= 0 ? 1 : -1;
                        const side2 = dSigned2 >= 0 ? 1 : -1;
                        const N1 = { x: side1 * n1.x, y: side1 * n1.y };
                        const N2 = { x: side2 * n2.x, y: side2 * n2.y };
                        const Bx = N1.x + N2.x;
                        const By = N1.y + N2.y;
                        const BLen = Math.hypot(Bx, By);
                        if (BLen > 0.05) {
                            const uBx = Bx / BLen;
                            const uBy = By / BLen;
                            const dotN = Math.max(0.1, uBx * N1.x + uBy * N1.y);
                            const requiredDist = Math.max(Dmin1, Dmin2) / dotN;
                            resolvedX = corner.x + uBx * requiredDist;
                            resolvedZ = corner.y + uBy * requiredDist;
                            isColliding = true;
                            snappedWall = w1;
                        }
                    }
                }
            }
        }

        for (let pass = 0; pass < maxPasses; pass++) {
            let passHadAdjustment = false;

            for (const wall of planner.walls) {
                if (!wall || ignoreWallIds.includes(wall.id)) continue;

                // Wall baseline centerline
                const p1 = WallGeometryEngine.getAnchorPosition(wall.startAnchor || { x: wall.startX, y: wall.startY });
                const p2 = WallGeometryEngine.getAnchorPosition(wall.endAnchor || { x: wall.endX, y: wall.endY });

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const wallLen = Math.hypot(dx, dy);
                if (wallLen < 1) continue;

                // Unit direction vector along wall: u
                const ux = dx / wallLen;
                const uy = dy / wallLen;

                // Unit normal vector pointing to front face: n = (-uy, ux)
                const nx = -uy;
                const ny = ux;

                const wallThick = Number(wall.thickness) || 20;
                const halfThick = wallThick / 2;

                // SAT projection of object OBB onto wall normal n
                // Rn is the half-extent of the object along n
                const Rn = halfW * Math.abs(axX * nx + axZ * ny) + halfD * Math.abs(azX * nx + azZ * ny);

                // Minimum allowable distance from object center to wall centerline
                const Dmin = halfThick + Rn;

                // Vector from p1 to object center C
                const vX = resolvedX - p1.x;
                const vY = resolvedZ - p1.y;

                // Projection along wall direction: t
                const t = vX * ux + vY * uy;

                // Check longitudinal span (allow slight margin at wall endpoints)
                if (t < -Rn * 0.5 || t > wallLen + Rn * 0.5) {
                    continue;
                }

                // Signed perpendicular distance from center to wall centerline along n
                const dSigned = vX * nx + vY * ny;
                const absD = Math.abs(dSigned);

                // 1. HARD COLLISION: Center is inside the wall boundary (absD < Dmin)
                if (enableCollision && absD < Dmin - 0.05) {
                    isColliding = true;
                    passHadAdjustment = true;

                    // Direction to push: along normal (or front side if exactly centered)
                    const side = dSigned >= 0 ? 1 : -1;
                    const pushDistance = Dmin - absD;

                    resolvedX += side * nx * pushDistance;
                    resolvedZ += side * ny * pushDistance;
                    snappedWall = wall;
                }

                // 2. MAGNETIC WALL SNAP: Object is in snap proximity outside the wall
                else if (enableWallSnap && pass === 0 && absD >= Dmin - 0.1 && absD <= Dmin + snapDistance) {
                    const snapGap = absD - Dmin;
                    if (snapGap < closestSnapDist) {
                        closestSnapDist = snapGap;
                        const side = dSigned >= 0 ? 1 : -1;
                        bestSnapCandidate = {
                            wall,
                            side,
                            nx,
                            ny,
                            ux,
                            uy,
                            Dmin,
                            dSigned,
                            wallLen,
                            p1
                        };
                    }
                }
            }

            if (!passHadAdjustment) break;
        }

        // Apply best magnetic snap candidate if not already colliding
        if (bestSnapCandidate && !isColliding) {
            const { wall, side, nx, ny, ux, uy, Dmin, wallLen, p1 } = bestSnapCandidate;
            const vX = resolvedX - p1.x;
            const vY = resolvedZ - p1.y;
            const t = Math.max(0, Math.min(wallLen, vX * ux + vY * uy));

            // Snap center flush to wall surface: C_snap = p1 + t*u + side * Dmin * n
            resolvedX = p1.x + t * ux + side * nx * Dmin;
            resolvedZ = p1.y + t * uy + side * ny * Dmin;

            isSnapped = true;
            snappedWall = wall;

            // Auto-align rotation to wall orientation if enabled
            if (enableWallAlign) {
                // Wall angle in degrees: atan2(dy, dx)
                let wallAngleDeg = Math.atan2(uy, ux) * 180 / Math.PI;
                wallAngleDeg = ((wallAngleDeg % 360) + 360) % 360;

                // 4 candidate angles relative to wall: parallel (0°, 180°) and perpendicular (90°, 270°)
                const candidates = [
                    wallAngleDeg,
                    (wallAngleDeg + 90) % 360,
                    (wallAngleDeg + 180) % 360,
                    (wallAngleDeg + 270) % 360
                ];

                const curRotNormalized = ((rotation % 360) + 360) % 360;

                let minAngleDiff = Infinity;
                let bestAngle = curRotNormalized;

                for (const cand of candidates) {
                    let diff = Math.abs(curRotNormalized - cand);
                    if (diff > 180) diff = 360 - diff;
                    if (diff < minAngleDiff) {
                        minAngleDiff = diff;
                        bestAngle = cand;
                    }
                }

                // Snap orientation if within 45° of a candidate alignment
                if (minAngleDiff <= 45) {
                    resolvedRot = Math.round(bestAngle);
                }
            }
        }

        return {
            x: Math.round(resolvedX * 10) / 10,
            z: Math.round(resolvedZ * 10) / 10,
            rotation: resolvedRot,
            isColliding,
            isSnapped,
            snappedWall
        };
    }

    /**
     * Extracts the canonical outer contour boundary segments (front face, back face, end caps)
     * for a given wall entity without mutating any corner calculations.
     * 
     * @param {Object} wall 
     * @param {Object} [planner=null]
     * @returns {Array<{
     *   p1: { x: number, y: number },
     *   p2: { x: number, y: number },
     *   normal: { x: number, y: number },
     *   length: number,
     *   facing: 1 | -1 | 0,
     *   side: 'front' | 'back' | 'cap',
     *   wall: Object
     * }>}
     */
    static getWallContourSegments(wall, planner = null) {
        if (!wall) return [];
        let shapeData = wall.wallShapeData;
        if (!shapeData && typeof WallEngine?.recalculateGeometry === 'function') {
            const allWalls = planner?.walls || [];
            shapeData = WallEngine.recalculateGeometry(wall, allWalls);
        }

        const segments = [];

        // Fallback to baseline offset if shapeData is not available
        if (!shapeData) {
            const p1 = WallGeometryEngine.getAnchorPosition(wall.startAnchor || { x: wall.startX, y: wall.startY });
            const p2 = WallGeometryEngine.getAnchorPosition(wall.endAnchor || { x: wall.endX, y: wall.endY });
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);
            if (len < 1) return [];

            const ux = dx / len;
            const uy = dy / len;
            const nx = -uy;
            const ny = ux;
            const halfThick = (Number(wall.thickness) || 20) / 2;

            // Front face (+n)
            segments.push({
                p1: { x: p1.x + nx * halfThick, y: p1.y + ny * halfThick },
                p2: { x: p2.x + nx * halfThick, y: p2.y + ny * halfThick },
                normal: { x: nx, y: ny },
                length: len,
                facing: 1,
                side: 'front',
                wall
            });

            // Back face (-n)
            segments.push({
                p1: { x: p2.x - nx * halfThick, y: p2.y - ny * halfThick },
                p2: { x: p1.x - nx * halfThick, y: p1.y - ny * halfThick },
                normal: { x: -nx, y: -ny },
                length: len,
                facing: -1,
                side: 'back',
                wall
            });

            return segments;
        }

        const { startL, endL, endR, startR, hasStartCap, hasEndCap, startData, endData, frontVerts, backVerts } = shapeData;

        // 1. Front Face Segments (+n)
        const fVerts = [];
        if (startData?.bevelL) fVerts.push(startData.bevelL);
        if (Array.isArray(frontVerts) && frontVerts.length > 0) {
            frontVerts.forEach(v => fVerts.push(v));
        } else {
            fVerts.push(startL, endL);
        }
        if (endData?.bevelL) fVerts.push(endData.bevelL);

        for (let i = 0; i < fVerts.length - 1; i++) {
            const pt1 = fVerts[i];
            const pt2 = fVerts[i + 1];
            const dx = pt2.x - pt1.x;
            const dy = pt2.y - pt1.y;
            const len = Math.hypot(dx, dy);
            if (len > 0.1) {
                segments.push({
                    p1: { x: pt1.x, y: pt1.y },
                    p2: { x: pt2.x, y: pt2.y },
                    normal: { x: -dy / len, y: dx / len },
                    length: len,
                    facing: 1,
                    side: 'front',
                    wall
                });
            }
        }

        // 2. Back Face Segments (-n)
        const bVerts = [];
        if (endData?.bevelR) bVerts.push(endData.bevelR);
        if (Array.isArray(backVerts) && backVerts.length > 0) {
            backVerts.forEach(v => bVerts.push(v));
        } else {
            bVerts.push(endR, startR);
        }
        if (startData?.bevelR) bVerts.push(startData.bevelR);

        for (let i = 0; i < bVerts.length - 1; i++) {
            const pt1 = bVerts[i];
            const pt2 = bVerts[i + 1];
            const dx = pt2.x - pt1.x;
            const dy = pt2.y - pt1.y;
            const len = Math.hypot(dx, dy);
            if (len > 0.1) {
                segments.push({
                    p1: { x: pt1.x, y: pt1.y },
                    p2: { x: pt2.x, y: pt2.y },
                    normal: { x: -dy / len, y: dx / len },
                    length: len,
                    facing: -1,
                    side: 'back',
                    wall
                });
            }
        }

        // 3. End Caps
        if (hasEndCap !== false && fVerts.length > 0 && bVerts.length > 0) {
            const endPt1 = fVerts[fVerts.length - 1];
            const endPt2 = bVerts[0];
            const dx = endPt2.x - endPt1.x;
            const dy = endPt2.y - endPt1.y;
            const len = Math.hypot(dx, dy);
            if (len > 0.1) {
                segments.push({
                    p1: { x: endPt1.x, y: endPt1.y },
                    p2: { x: endPt2.x, y: endPt2.y },
                    normal: { x: -dy / len, y: dx / len },
                    length: len,
                    facing: 0,
                    side: 'cap',
                    wall
                });
            }
        }

        if (hasStartCap !== false && fVerts.length > 0 && bVerts.length > 0) {
            const startPt1 = bVerts[bVerts.length - 1];
            const startPt2 = fVerts[0];
            const dx = startPt2.x - startPt1.x;
            const dy = startPt2.y - startPt1.y;
            const len = Math.hypot(dx, dy);
            if (len > 0.1) {
                segments.push({
                    p1: { x: startPt1.x, y: startPt1.y },
                    p2: { x: startPt2.x, y: startPt2.y },
                    normal: { x: -dy / len, y: dx / len },
                    length: len,
                    facing: 0,
                    side: 'cap',
                    wall
                });
            }
        }

        return segments;
    }
}

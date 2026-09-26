/**
 * src/core/snap/SnapEngine.js
 * 
 * UNIVERSAL CENTRALIZED SNAP SERVICE FOR 2D & 3D
 * 
 * Capabilities:
 * 1. Uniform Cartesian Grid Snapping (2D & 3D).
 * 2. Wall Endpoint & Anchor Snapping.
 * 3. Object-to-Object Bounding Box Snapping (Smart Guides geometry).
 * 4. Magnetic Angle Snapping (15° CAD, 45° Shift-lock, Free Alt-override).
 * 5. Wall Surface Collision & Magnetic Face Alignment (via WallCollisionEngine).
 * 6. Hierarchical Position Resolution Pipeline.
 * 
 * Invariants:
 * - 100% Stateless: Contains zero runtime cache or DOM dependencies.
 * - Single Source of Truth: All 2D and 3D snap queries yield identical mathematical results.
 */

import { WallCollisionEngine } from '../wall/WallCollisionEngine.js';
import { WallGeometryEngine } from '../wall/WallGeometryEngine.js';

export class SnapEngine {
    /**
     * Snaps 2D or 3D coordinate point to uniform Cartesian grid.
     * 
     * @param {{ x?: number, y?: number, z?: number }} point 
     * @param {number} [gridSize=10]
     * @returns {{ x?: number, y?: number, z?: number, isSnapped: boolean }}
     */
    static snapToGrid(point, gridSize = 10) {
        if (!point || typeof point !== 'object') return { isSnapped: false };
        const g = Math.max(0.1, Number(gridSize) || 10);
        const res = {};
        let isSnapped = false;

        if (point.x !== undefined) {
            const snappedX = Math.round(point.x / g) * g;
            res.x = Math.round(snappedX * 100) / 100;
            if (Math.abs(res.x - point.x) > 0.001) isSnapped = true;
        }
        if (point.y !== undefined) {
            const snappedY = Math.round(point.y / g) * g;
            res.y = Math.round(snappedY * 100) / 100;
            if (Math.abs(res.y - point.y) > 0.001) isSnapped = true;
        }
        if (point.z !== undefined) {
            const snappedZ = Math.round(point.z / g) * g;
            res.z = Math.round(snappedZ * 100) / 100;
            if (Math.abs(res.z - point.z) > 0.001) isSnapped = true;
        }

        res.isSnapped = isSnapped;
        return res;
    }

    /**
     * Resolves angle with CAD magnetic snapping.
     * 
     * @param {number} rawAngleDeg 
     * @param {Object} [options={}]
     * @param {number} [options.step=15] - Snap interval in degrees.
     * @param {number} [options.magneticZone=3.5] - Magnetic latch threshold in degrees.
     * @param {boolean} [options.free=false] - Alt override for continuous rotation.
     * @param {boolean} [options.lock45=false] - Shift override for 45° increments.
     * @returns {{ angle: number, isSnapped: boolean }}
     */
    static resolveAngle(rawAngleDeg, options = {}) {
        let angle = ((rawAngleDeg % 360) + 360) % 360;

        if (options.free) {
            return { angle: Math.round(angle * 10) / 10, isSnapped: false };
        }

        const step = options.lock45 ? 45 : (options.step || 15);
        if (step <= 1) {
            return { angle: Math.round(angle * 10) / 10, isSnapped: false };
        }

        const snapped = Math.round(angle / step) * step;
        const normalizedSnapped = ((snapped % 360) + 360) % 360;
        let diff = Math.abs(angle - normalizedSnapped);
        if (diff > 180) diff = 360 - diff;
        const magneticZone = options.magneticZone !== undefined ? options.magneticZone : 3.5;

        if (diff <= magneticZone || options.lock45) {
            return { angle: normalizedSnapped, isSnapped: true };
        }

        return { angle: Math.round(angle * 10) / 10, isSnapped: false };
    }

    /**
     * Snaps a 2D point to the nearest wall endpoint or anchor.
     * 
     * @param {{ x: number, y?: number, z?: number }} point 
     * @param {Array<Object>} walls 
     * @param {number} [threshold=20] 
     * @returns {{ x: number, y: number, z: number, isSnapped: boolean, snappedAnchor: Object|null, distance: number }}
     */
    static snapToWallEndpoints(point, walls, threshold = 20) {
        const px = point.x;
        const py = point.z !== undefined ? point.z : point.y;
        if (px === undefined || py === undefined || !Array.isArray(walls) || walls.length === 0) {
            return { x: px, y: py, z: py, isSnapped: false, snappedAnchor: null, distance: Infinity };
        }

        let bestDist = threshold;
        let bestAnchor = null;
        let bestPos = null;

        for (const wall of walls) {
            if (!wall) continue;
            const endpoints = [
                wall.startAnchor ? WallGeometryEngine.getAnchorPosition(wall.startAnchor) : { x: wall.startX, y: wall.startY },
                wall.endAnchor ? WallGeometryEngine.getAnchorPosition(wall.endAnchor) : { x: wall.endX, y: wall.endY }
            ];

            for (let i = 0; i < endpoints.length; i++) {
                const ep = endpoints[i];
                if (!ep || ep.x === undefined || ep.y === undefined) continue;
                const d = Math.hypot(ep.x - px, ep.y - py);
                if (d < bestDist) {
                    bestDist = d;
                    bestAnchor = i === 0 ? (wall.startAnchor || ep) : (wall.endAnchor || ep);
                    bestPos = { x: ep.x, y: ep.y };
                }
            }
        }

        if (bestPos) {
            return {
                x: bestPos.x,
                y: bestPos.y,
                z: bestPos.y,
                isSnapped: true,
                snappedAnchor: bestAnchor,
                distance: bestDist
            };
        }

        return {
            x: px,
            y: py,
            z: py,
            isSnapped: false,
            snappedAnchor: null,
            distance: Infinity
        };
    }

    /**
     * Snaps an AABB bounding box against reference AABB boxes (Smart Guides math).
     * Compares center-to-center, left-to-left, right-to-right, left-to-right, right-to-left,
     * top-to-top, bottom-to-bottom, top-to-bottom, bottom-to-top.
     * 
     * @param {{ x: number, y: number, width: number, height: number }} dragRect 
     * @param {Array<{ x: number, y: number, width: number, height: number }>} referenceRects 
     * @param {Object} [options={}]
     * @param {number} [options.threshold=8]
     * @returns {{ deltaX: number, deltaY: number, isSnappedX: boolean, isSnappedY: boolean, guides: Array<Object> }}
     */
    static snapToObjectBounds(dragRect, referenceRects, options = {}) {
        const threshold = options.threshold !== undefined ? options.threshold : 8;
        let deltaX = 0;
        let deltaY = 0;
        let isSnappedX = false;
        let isSnappedY = false;
        const guides = [];

        if (!dragRect || !Array.isArray(referenceRects) || referenceRects.length === 0) {
            return { deltaX, deltaY, isSnappedX, isSnappedY, guides };
        }

        const dragEdgesX = [
            { pos: dragRect.x - dragRect.width / 2, type: 'left' },
            { pos: dragRect.x, type: 'center' },
            { pos: dragRect.x + dragRect.width / 2, type: 'right' }
        ];

        const dragEdgesY = [
            { pos: dragRect.y - dragRect.height / 2, type: 'top' },
            { pos: dragRect.y, type: 'center' },
            { pos: dragRect.y + dragRect.height / 2, type: 'bottom' }
        ];

        let minDiffX = threshold;
        let minDiffY = threshold;

        for (const ref of referenceRects) {
            if (!ref || ref === dragRect) continue;

            const refEdgesX = [
                { pos: ref.x - ref.width / 2, type: 'left' },
                { pos: ref.x, type: 'center' },
                { pos: ref.x + ref.width / 2, type: 'right' }
            ];

            const refEdgesY = [
                { pos: ref.y - ref.height / 2, type: 'top' },
                { pos: ref.y, type: 'center' },
                { pos: ref.y + ref.height / 2, type: 'bottom' }
            ];

            // X-Axis Alignment
            for (const de of dragEdgesX) {
                for (const re of refEdgesX) {
                    const diff = re.pos - de.pos;
                    if (Math.abs(diff) < minDiffX) {
                        minDiffX = Math.abs(diff);
                        deltaX = diff;
                        isSnappedX = true;
                        guides.push({
                            axis: 'x',
                            pos: re.pos,
                            dragEdge: de.type,
                            refEdge: re.type
                        });
                    }
                }
            }

            // Y-Axis Alignment
            for (const de of dragEdgesY) {
                for (const re of refEdgesY) {
                    const diff = re.pos - de.pos;
                    if (Math.abs(diff) < minDiffY) {
                        minDiffY = Math.abs(diff);
                        deltaY = diff;
                        isSnappedY = true;
                        guides.push({
                            axis: 'y',
                            pos: re.pos,
                            dragEdge: de.type,
                            refEdge: re.type
                        });
                    }
                }
            }
        }

        return { deltaX, deltaY, isSnappedX, isSnappedY, guides };
    }

    /**
     * Snaps object against wall faces and aligns rotation (via WallCollisionEngine).
     * 
     * @param {Object} params - Forwarded to WallCollisionEngine.resolvePlacement
     * @returns {Object}
     */
    static snapToWallSurface(params) {
        return WallCollisionEngine.resolvePlacement(params);
    }

    /**
     * Snaps an object directly against the outer contour face segments of walls.
     * 
     * @param {Object} query - { x, y, z, rotation, width, depth }
     * @param {Array<Object>} walls 
     * @param {Object} [options={}]
     * @param {number} [options.snapDistance=20]
     * @param {boolean} [options.enableWallAlign=true]
     * @param {Object} [options.planner=null]
     * @returns {{
     *   x: number,
     *   y: number,
     *   z: number,
     *   rotation: number,
     *   isSnapped: boolean,
     *   distance: number,
     *   snappedWall: Object|null,
     *   snappedSegment: Object|null
     * }}
     */
    static snapToWallContour(query, walls, options = {}) {
        const rawX = query.x !== undefined ? query.x : 0;
        const rawZ = query.z !== undefined ? query.z : (query.y !== undefined ? query.y : 0);
        const rot = query.rotation !== undefined ? query.rotation : 0;
        const width = query.width || 80;
        const depth = query.depth || query.length || 80;
        const snapDist = options.snapDistance !== undefined ? options.snapDistance : 20;
        const enableWallAlign = options.enableWallAlign !== false;
        const planner = options.planner || null;

        if (!Array.isArray(walls) || walls.length === 0) {
            return {
                x: rawX, y: rawZ, z: rawZ,
                rotation: rot,
                isSnapped: false,
                distance: Infinity,
                snappedWall: null,
                snappedSegment: null
            };
        }

        const halfW = width / 2;
        const halfD = depth / 2;

        let bestDist = snapDist;
        let bestCandidate = null;

        for (const wall of walls) {
            if (!wall || (options.ignoreWallIds && options.ignoreWallIds.includes(wall.id))) continue;
            const segments = WallCollisionEngine.getWallContourSegments(wall, planner);

            for (const seg of segments) {
                const { p1, p2, normal, length: segLen } = seg;
                if (segLen < 1) continue;

                const ux = (p2.x - p1.x) / segLen;
                const uy = (p2.y - p1.y) / segLen;

                const vx = rawX - p1.x;
                const vy = rawZ - p1.y;

                const t = vx * ux + vy * uy;
                const perpDist = vx * normal.x + vy * normal.y;

                const rotRad = -(rot * Math.PI / 180);
                const axX = Math.cos(rotRad);
                const axZ = -Math.sin(rotRad);
                const azX = Math.sin(rotRad);
                const azZ = Math.cos(rotRad);
                const Rn = halfW * Math.abs(axX * normal.x + axZ * normal.y) + halfD * Math.abs(azX * normal.x + azZ * normal.y);

                if (t < -Rn * 0.5 || t > segLen + Rn * 0.5) continue;

                const surfaceGap = perpDist - Rn;

                if (surfaceGap >= -Rn && surfaceGap <= snapDist) {
                    const absGap = Math.abs(surfaceGap);
                    if (absGap < bestDist) {
                        bestDist = absGap;
                        bestCandidate = {
                            wall,
                            seg,
                            p1,
                            ux,
                            uy,
                            normal,
                            segLen,
                            tClamped: Math.max(0, Math.min(segLen, t)),
                            Rn
                        };
                    }
                }
            }
        }

        if (bestCandidate) {
            const { wall, seg, p1, ux, uy, normal, tClamped, Rn } = bestCandidate;

            let snappedRot = rot;
            let currentRn = Rn;

            if (enableWallAlign) {
                let wallAngleDeg = Math.atan2(uy, ux) * 180 / Math.PI;
                wallAngleDeg = ((wallAngleDeg % 360) + 360) % 360;

                const candidates = [
                    wallAngleDeg,
                    (wallAngleDeg + 90) % 360,
                    (wallAngleDeg + 180) % 360,
                    (wallAngleDeg + 270) % 360
                ];

                let bestDiff = Infinity;
                let bestAngle = rot;

                const curNorm = ((rot % 360) + 360) % 360;
                for (const cand of candidates) {
                    let diff = Math.abs(curNorm - cand);
                    if (diff > 180) diff = 360 - diff;
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        bestAngle = cand;
                    }
                }

                if (bestDiff <= 35) {
                    snappedRot = Math.round(bestAngle);

                    const newRotRad = -(snappedRot * Math.PI / 180);
                    const nAxX = Math.cos(newRotRad);
                    const nAxZ = -Math.sin(newRotRad);
                    const nAzX = Math.sin(newRotRad);
                    const nAzZ = Math.cos(newRotRad);
                    currentRn = halfW * Math.abs(nAxX * normal.x + nAxZ * normal.y) + halfD * Math.abs(nAzX * normal.x + nAzZ * normal.y);
                }
            }

            const snapX = p1.x + tClamped * ux + normal.x * currentRn;
            const snapZ = p1.y + tClamped * uy + normal.y * currentRn;

            return {
                x: Math.round(snapX * 10) / 10,
                y: Math.round(snapZ * 10) / 10,
                z: Math.round(snapZ * 10) / 10,
                rotation: snappedRot,
                isSnapped: true,
                distance: bestDist,
                snappedWall: wall,
                snappedSegment: seg
            };
        }

        return {
            x: rawX,
            y: rawZ,
            z: rawZ,
            rotation: rot,
            isSnapped: false,
            distance: Infinity,
            snappedWall: null,
            snappedSegment: null
        };
    }

    /**
     * Hierarchical Position Resolution:
     * Priority 1: Wall Endpoints / Anchors (if enabled)
     * Priority 2: Wall Surface Snap & Collision (if enabled)
     * Priority 3: Object-to-Object Bounds (if enabled)
     * Priority 4: Cartesian Grid Snap (if enabled or fallback)
     * 
     * @param {Object} query - { x, y, z, rotation, width, depth, elevation }
     * @param {Object} context - { planner, walls, referenceBoxes }
     * @param {Object} [options={}]
     * @returns {{
     *   x: number,
     *   y: number,
     *   z: number,
     *   elevation: number,
     *   rotation: number,
     *   isSnapped: boolean,
     *   snapType: 'wall_endpoint'|'wall_surface'|'wall_collision'|'object_bound'|'grid'|'none',
     *   snappedTarget: Object|null,
     *   guides: Array<Object>
     * }}
     */
    static resolvePosition(query = {}, context = {}, options = {}) {
        const rawX = query.x !== undefined ? query.x : 0;
        const rawPlanarY = query.z !== undefined ? query.z : (query.y !== undefined ? query.y : 0);
        const elev = query.elevation !== undefined ? query.elevation : (query.y !== undefined && query.z !== undefined ? query.y : 0);
        const rot = query.rotation !== undefined ? query.rotation : 0;
        const width = query.width || 80;
        const depth = query.depth || query.length || 80;

        const planner = context.planner || (typeof window !== 'undefined' ? (window.planner?.value || window.planner || window.plannerInstance) : null);
        const walls = context.walls || (planner?.walls || []);

        const enableEndpoints = options.enableEndpointSnap !== false && options.enableWallEndpoints === true;
        const enableWallSnap = options.enableWallSnap !== false;
        const enableCollision = options.enableCollision !== false;
        const enableWallAlign = options.enableWallAlign !== false;
        const enableGrid = options.enableGridSnap !== false;
        const gridSize = options.gridSize || 10;
        const snapDist = options.snapDistance !== undefined ? options.snapDistance : 20;

        let curX = rawX;
        let curZ = rawPlanarY;
        let curRot = rot;
        let snapType = 'none';
        let isSnapped = false;
        let snappedTarget = null;
        let snappedSegment = null;
        let guides = [];

        // 1. Wall Endpoints / Anchors Snap
        if (enableEndpoints && walls.length > 0) {
            const epSnap = this.snapToWallEndpoints({ x: curX, y: curZ }, walls, snapDist);
            if (epSnap.isSnapped) {
                curX = epSnap.x;
                curZ = epSnap.y;
                snapType = 'wall_endpoint';
                isSnapped = true;
                snappedTarget = epSnap.snappedAnchor;
            }
        }

        // 2. Wall Face Collision & Magnetic Snap
        if (snapType === 'none' && (enableWallSnap || enableCollision) && walls.length > 0) {
            // Check outer contour face segments first
            if (options.enableWallContour !== false) {
                const contourRes = this.snapToWallContour({
                    x: curX,
                    z: curZ,
                    rotation: curRot,
                    width,
                    depth
                }, walls, {
                    snapDistance: snapDist,
                    enableWallAlign,
                    planner,
                    ignoreWallIds: options.ignoreWallIds
                });

                if (contourRes.isSnapped) {
                    curX = contourRes.x;
                    curZ = contourRes.z;
                    curRot = contourRes.rotation;
                    isSnapped = true;
                    snapType = 'wall_surface';
                    snappedTarget = contourRes.snappedWall;
                    snappedSegment = contourRes.snappedSegment;
                }
            }

            // Fallback to baseline SAT collision if not contour-snapped
            if (!isSnapped && planner) {
                const wallRes = WallCollisionEngine.resolvePlacement({
                    x: curX,
                    z: curZ,
                    rotation: curRot,
                    width,
                    depth,
                    planner,
                    options: {
                        enableCollision,
                        enableWallSnap,
                        enableWallAlign,
                        snapDistance: snapDist,
                        ignoreWallIds: options.ignoreWallIds
                    }
                });

                if (wallRes.isSnapped || wallRes.isColliding) {
                    curX = wallRes.x;
                    curZ = wallRes.z;
                    curRot = wallRes.rotation;
                    isSnapped = true;
                    snapType = wallRes.isSnapped ? 'wall_surface' : 'wall_collision';
                    snappedTarget = wallRes.snappedWall;
                    if (wallRes.snappedWall) {
                        snappedSegment = wallRes.snappedSegment || {
                            p1: { x: wallRes.snappedWall.startX || 0, y: wallRes.snappedWall.startY || 0 },
                            p2: { x: wallRes.snappedWall.endX || 0, y: wallRes.snappedWall.endY || 0 }
                        };
                    }
                }
            }
        }

        // 3. Object-to-Object Bounds Snap
        if (snapType === 'none' && options.enableObjectBounds && Array.isArray(context.referenceBoxes) && context.referenceBoxes.length > 0) {
            const boxRes = this.snapToObjectBounds(
                { x: curX, y: curZ, width, height: depth },
                context.referenceBoxes,
                { threshold: options.boundsThreshold || 8 }
            );
            if (boxRes.isSnappedX || boxRes.isSnappedY) {
                curX += boxRes.deltaX;
                curZ += boxRes.deltaY;
                isSnapped = true;
                snapType = 'object_bound';
                guides = boxRes.guides;
            }
        }

        // 4. Grid Snap (fallback or enabled)
        if (snapType === 'none' && enableGrid) {
            const gridRes = this.snapToGrid({ x: curX, y: curZ }, gridSize);
            if (gridRes.isSnapped) {
                curX = gridRes.x;
                curZ = gridRes.y;
                isSnapped = true;
                snapType = 'grid';
            }
        }

        return {
            x: curX,
            y: query.z !== undefined ? elev : curZ,
            z: curZ,
            elevation: elev,
            rotation: curRot,
            isSnapped,
            snapType,
            snappedTarget,
            snappedSegment,
            guides
        };
    }
}

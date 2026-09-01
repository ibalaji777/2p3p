import { PremiumWall } from '../../features/wall/wall.renderer2d.js';
import { SNAP_DIST } from '../registry.js';

/**
 * WallReformer
 * 
 * Provides robust planar graph reformation for walls.
 * When new wall segments (or rectangular room boxes) are drawn across or overlapping
 * existing walls, this module:
 * 1. Computes all 2D intersection points and collinear overlaps.
 * 2. Splits crossing existing walls at intersection points while preserving properties and remapping attached widgets.
 * 3. Removes / dissolves interior wall sections enclosed inside the new room box (Sims 4 room merging).
 * 4. Subdivides new wall segments at all intersection points and existing anchors.
 * 5. Deduplicates collinear overlapping segments so no duplicate walls are created.
 * 6. Creates connected PremiumWall instances sharing corner anchors.
 */
export class WallReformer {
    /**
     * Compute intersection between segment AB and segment CD.
     * Returns null if no intersection or parallel/collinear.
     */
    static getSegmentIntersection(A, B, C, D) {
        const dx1 = B.x - A.x;
        const dy1 = B.y - A.y;
        const dx2 = D.x - C.x;
        const dy2 = D.y - C.y;

        const denom = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(denom) < 1e-6) {
            return null; // Parallel or collinear
        }

        const t = ((C.x - A.x) * dy2 - (C.y - A.y) * dx2) / denom;
        const u = ((C.x - A.x) * dy1 - (C.y - A.y) * dx1) / denom;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            const pt = {
                x: A.x + t * dx1,
                y: A.y + t * dy1
            };
            return {
                point: pt,
                t: t,
                u: u,
                isInternal1: t > 0.005 && t < 0.995 && Math.hypot(pt.x - A.x, pt.y - A.y) > 2 && Math.hypot(pt.x - B.x, pt.y - B.y) > 2,
                isInternal2: u > 0.005 && u < 0.995 && Math.hypot(pt.x - C.x, pt.y - C.y) > 2 && Math.hypot(pt.x - D.x, pt.y - D.y) > 2
            };
        }

        return null;
    }

    /**
     * Check if point P lies strictly on segment AB (within tolerance).
     */
    static isPointOnSegment(P, A, B, tolerance = 6.0) {
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) return false;

        const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / lenSq;
        if (t <= 0.005 || t >= 0.995) return false;

        const projX = A.x + t * dx;
        const projY = A.y + t * dy;
        const dist = Math.hypot(P.x - projX, P.y - projY);

        if (dist <= tolerance) {
            return {
                point: { x: projX, y: projY },
                t: t
            };
        }

        return false;
    }

    /**
     * Check for collinear overlapping segments.
     * Returns an array of split points along segment AB.
     */
    static getCollinearOverlapSplits(A, B, C, D, tolerance = 6.0) {
        const dx1 = B.x - A.x;
        const dy1 = B.y - A.y;
        const lenSq1 = dx1 * dx1 + dy1 * dy1;
        if (lenSq1 < 1e-6) return [];

        const len1 = Math.sqrt(lenSq1);
        const distC = Math.abs((C.x - A.x) * dy1 - (C.y - A.y) * dx1) / len1;
        const distD = Math.abs((D.x - A.x) * dy1 - (D.y - A.y) * dx1) / len1;

        if (distC > tolerance || distD > tolerance) return [];

        // Points are collinear
        const tC = ((C.x - A.x) * dx1 + (C.y - A.y) * dy1) / lenSq1;
        const tD = ((D.x - A.x) * dx1 + (D.y - A.y) * dy1) / lenSq1;

        const minT = Math.min(tC, tD);
        const maxT = Math.max(tC, tD);

        // Check if intervals [0, 1] and [minT, maxT] overlap
        if (maxT <= 0.005 || minT >= 0.995) return [];

        const splits = [];
        if (tC > 0.005 && tC < 0.995) splits.push({ point: { x: C.x, y: C.y }, t: tC });
        if (tD > 0.005 && tD < 0.995) splits.push({ point: { x: D.x, y: D.y }, t: tD });

        return splits;
    }

    /**
     * Reconstruct and reform all walls when a set of input segments is drawn.
     * 
     * @param {Object} planner - The FloorPlanner instance.
     * @param {Array<{p1: {x: number, y: number}, p2: {x: number, y: number}}>} inputSegments - Array of line segments.
     * @param {string} wallType - Type of walls to create (default 'outer').
     * @param {Object} wallConfig - Custom height, thickness, and params.
     * @returns {Array<PremiumWall>} The newly created wall instances.
     */
    static reformAndAddWallSegments(planner, inputSegments, wallType = 'outer', wallConfig = {}) {
        if (!planner || !inputSegments || inputSegments.length === 0) return [];

        const wallHeight = wallConfig.height !== undefined ? wallConfig.height : 120;
        const wallThick = wallConfig.thickness !== undefined ? wallConfig.thickness : 16;
        const wallElev = wallConfig.elevation !== undefined ? wallConfig.elevation : 0;
        const wallParams = wallConfig.params ? JSON.parse(JSON.stringify(wallConfig.params)) : null;

        const createdWalls = [];
        const existingWalls = [...planner.walls.filter(w => !w.parentArc && w.type !== 'railing' && !w.hidden)];

        // Compute bounding box of input segments to identify interior overlapping walls
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        inputSegments.forEach(seg => {
            minX = Math.min(minX, seg.p1.x, seg.p2.x);
            maxX = Math.max(maxX, seg.p1.x, seg.p2.x);
            minY = Math.min(minY, seg.p1.y, seg.p2.y);
            maxY = Math.max(maxY, seg.p1.y, seg.p2.y);
        });

        const isSegmentInsideBox = (p1, p2) => {
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const eps = 2.0;
            return midX > minX + eps && midX < maxX - eps && midY > minY + eps && midY < maxY - eps;
        };

        // ============================================================
        // PHASE 1: Find all split points for EXISTING walls
        // ============================================================
        const existingWallSplits = new Map(); // Map<PremiumWall, Array<{point: {x, y}, t: number}>>

        existingWalls.forEach(w => {
            const pA = w.startAnchor.position();
            const pB = w.endAnchor.position();
            const splits = [];

            inputSegments.forEach(seg => {
                const pC = seg.p1;
                const pD = seg.p2;

                // 1. Line segment intersection
                const hit = WallReformer.getSegmentIntersection(pA, pB, pC, pD);
                if (hit && hit.isInternal1) {
                    splits.push({ point: hit.point, t: hit.t });
                }

                // 2. Collinear overlaps
                const colSplits = WallReformer.getCollinearOverlapSplits(pA, pB, pC, pD);
                colSplits.forEach(cs => splits.push(cs));

                // 3. New segment endpoints touching existing wall
                const onSegC = WallReformer.isPointOnSegment(pC, pA, pB);
                if (onSegC) splits.push(onSegC);

                const onSegD = WallReformer.isPointOnSegment(pD, pA, pB);
                if (onSegD) splits.push(onSegD);
            });

            if (splits.length > 0) {
                // Deduplicate splits along wall
                splits.sort((a, b) => a.t - b.t);
                const uniqueSplits = [];
                splits.forEach(s => {
                    if (uniqueSplits.length === 0) {
                        uniqueSplits.push(s);
                    } else {
                        const last = uniqueSplits[uniqueSplits.length - 1];
                        if (Math.hypot(s.point.x - last.point.x, s.point.y - last.point.y) > 2.0 && Math.abs(s.t - last.t) > 0.005) {
                            uniqueSplits.push(s);
                        }
                    }
                });

                if (uniqueSplits.length > 0) {
                    existingWallSplits.set(w, uniqueSplits);
                }
            }
        });

        // ============================================================
        // PHASE 2: Split affected EXISTING walls & Dissolve Internal Segments
        // ============================================================
        existingWallSplits.forEach((splits, w) => {
            const origStartAnchor = w.startAnchor;
            const origEndAnchor = w.endAnchor;
            const origStartPos = origStartAnchor.position();
            const origEndPos = origEndAnchor.position();
            const origLen = Math.hypot(origEndPos.x - origStartPos.x, origEndPos.y - origStartPos.y);

            // Anchors for each split point
            const splitAnchors = splits.map(s => planner.getOrCreateAnchor(s.point.x, s.point.y));
            const anchorSequence = [origStartAnchor, ...splitAnchors, origEndAnchor];

            // Evaluate all sub-segments and filter out internal ones that lie inside the box
            const keptSubSegments = [];
            for (let i = 0; i < anchorSequence.length - 1; i++) {
                const subStart = anchorSequence[i];
                const subEnd = anchorSequence[i + 1];
                const p1 = subStart.position();
                const p2 = subEnd.position();

                if (isSegmentInsideBox(p1, p2)) {
                    // This sub-segment is strictly inside the new room box! Remove/dissolve it (Sims 4 style).
                    continue;
                }
                keptSubSegments.push({ start: subStart, end: subEnd });
            }

            const subWalls = [];
            let originalWallReused = false;

            keptSubSegments.forEach(seg => {
                if (!originalWallReused) {
                    w.startAnchor = seg.start;
                    w.endAnchor = seg.end;
                    if (w.update) w.update();
                    if (w.update2D) w.update2D();
                    subWalls.push(w);
                    originalWallReused = true;
                } else {
                    const newSubWall = new PremiumWall(planner, seg.start, seg.end, w.type);
                    newSubWall.height = w.height;
                    newSubWall.thickness = w.thickness;
                    newSubWall.elevation = w.elevation || 0;
                    if (w.params) newSubWall.params = JSON.parse(JSON.stringify(w.params));

                    planner.walls.push(newSubWall);
                    createdWalls.push(newSubWall);
                    subWalls.push(newSubWall);
                }
            });

            if (!originalWallReused) {
                // All parts of this wall were inside the new room box! Destroy and remove it.
                if (w.wallGroup) w.wallGroup.destroy();
                if (w.labelGroup) w.labelGroup.destroy();
                planner.walls = planner.walls.filter(item => item !== w);
            } else if (w.attachedWidgets && w.attachedWidgets.length > 0 && origLen > 0) {
                // Remap attached widgets (doors, windows, openings) proportionally to kept sub-walls
                const widgetsToDistribute = [...w.attachedWidgets];
                w.attachedWidgets = [];

                let cumulativeDist = 0;
                const subWallRanges = subWalls.map(sw => {
                    const sp1 = sw.startAnchor.position();
                    const sp2 = sw.endAnchor.position();
                    const subLen = Math.hypot(sp2.x - sp1.x, sp2.y - sp1.y);
                    const startDist = cumulativeDist;
                    const endDist = cumulativeDist + subLen;
                    cumulativeDist = endDist;
                    return { wall: sw, startDist, endDist, len: subLen };
                });

                widgetsToDistribute.forEach(widget => {
                    const origDist = (widget.t !== undefined ? widget.t : 0.5) * origLen;
                    const range = subWallRanges.find(r => origDist >= r.startDist - 1.0 && origDist <= r.endDist + 1.0);
                    if (range && range.len > 0) {
                        const localT = Math.max(0.05, Math.min(0.95, (origDist - range.startDist) / range.len));
                        widget.wall = range.wall;
                        widget.t = localT;
                        if (!range.wall.attachedWidgets) range.wall.attachedWidgets = [];
                        range.wall.attachedWidgets.push(widget);
                        if (widget.update) widget.update();
                    } else if (widget.destroy) {
                        widget.destroy();
                    }
                });
            }
        });

        // Also remove any existing walls that did not intersect borders but are completely inside the box
        existingWalls.forEach(w => {
            if (existingWallSplits.has(w)) return;
            const p1 = w.startAnchor.position();
            const p2 = w.endAnchor.position();
            if (isSegmentInsideBox(p1, p2)) {
                if (w.wallGroup) w.wallGroup.destroy();
                if (w.labelGroup) w.labelGroup.destroy();
                planner.walls = planner.walls.filter(item => item !== w);
            }
        });

        // ============================================================
        // PHASE 3: Subdivide all NEW input segments
        // ============================================================
        const currentActiveWalls = [...planner.walls.filter(w => !w.parentArc && w.type !== 'railing' && !w.hidden)];

        inputSegments.forEach(seg => {
            const pStart = seg.p1;
            const pEnd = seg.p2;
            const segDx = pEnd.x - pStart.x;
            const segDy = pEnd.y - pStart.y;
            const segLenSq = segDx * segDx + segDy * segDy;
            if (segLenSq < 1e-6) return;

            const splitPoints = [{ point: pStart, t: 0 }, { point: pEnd, t: 1 }];

            // 1. Intersect with all active walls
            currentActiveWalls.forEach(w => {
                const wA = w.startAnchor.position();
                const wB = w.endAnchor.position();

                const hit = WallReformer.getSegmentIntersection(pStart, pEnd, wA, wB);
                if (hit && hit.isInternal1) {
                    splitPoints.push({ point: hit.point, t: hit.t });
                }

                // Collinear overlap
                const colSplits = WallReformer.getCollinearOverlapSplits(pStart, pEnd, wA, wB);
                colSplits.forEach(cs => splitPoints.push(cs));

                // Wall anchors lying on segment
                const onSegA = WallReformer.isPointOnSegment(wA, pStart, pEnd);
                if (onSegA) splitPoints.push(onSegA);

                const onSegB = WallReformer.isPointOnSegment(wB, pStart, pEnd);
                if (onSegB) splitPoints.push(onSegB);
            });

            // 2. Intersect with other new input segments
            inputSegments.forEach(otherSeg => {
                if (otherSeg === seg) return;
                const hit = WallReformer.getSegmentIntersection(pStart, pEnd, otherSeg.p1, otherSeg.p2);
                if (hit && hit.isInternal1) {
                    splitPoints.push({ point: hit.point, t: hit.t });
                }
            });

            // 3. Existing anchors lying on segment
            planner.anchors.forEach(a => {
                const aPos = a.position();
                const onSeg = WallReformer.isPointOnSegment(aPos, pStart, pEnd);
                if (onSeg) splitPoints.push(onSeg);
            });

            // Sort split points from 0 to 1
            splitPoints.sort((a, b) => a.t - b.t);

            // Deduplicate points
            const uniquePoints = [];
            splitPoints.forEach(sp => {
                if (uniquePoints.length === 0) {
                    uniquePoints.push(sp.point);
                } else {
                    const last = uniquePoints[uniquePoints.length - 1];
                    if (Math.hypot(sp.point.x - last.x, sp.point.y - last.y) > 2.0) {
                        uniquePoints.push(sp.point);
                    }
                }
            });

            // ============================================================
            // PHASE 4: Create new non-duplicate wall sub-segments
            // ============================================================
            for (let i = 0; i < uniquePoints.length - 1; i++) {
                const ptA = uniquePoints[i];
                const ptB = uniquePoints[i + 1];
                const dist = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
                if (dist < 5.0) continue; // Skip sub-segments smaller than 5cm

                const ancA = planner.getOrCreateAnchor(ptA.x, ptA.y);
                const ancB = planner.getOrCreateAnchor(ptB.x, ptB.y);
                if (ancA === ancB) continue;

                // Check if a wall already exists between ancA and ancB
                const existing = planner.walls.find(w =>
                    (w.startAnchor === ancA && w.endAnchor === ancB) ||
                    (w.startAnchor === ancB && w.endAnchor === ancA)
                );

                if (existing) {
                    // Wall already exists along this segment! Skip duplicate creation.
                    continue;
                }

                const newWall = new PremiumWall(planner, ancA, ancB, wallType);
                newWall.height = wallHeight;
                newWall.thickness = wallThick;
                newWall.elevation = wallElev;
                if (wallParams) newWall.params = JSON.parse(JSON.stringify(wallParams));

                planner.walls.push(newWall);
                createdWalls.push(newWall);
                planner.lastDrawnEntity = newWall;
            }
        });

        if (!planner.currentSessionEntities) planner.currentSessionEntities = [];
        planner.currentSessionEntities.push(...createdWalls);

        // Update 2D polygons of all walls
        planner.walls.forEach(w => {
            if (w.update) w.update();
            if (w.update2D) w.update2D();
        });

        return createdWalls;
    }

    /**
     * Split an existing wall into two connected sub-walls at point P.
     */
    static splitWallAtPoint(planner, wall, pt) {
        if (!planner || !wall || !pt) return null;

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 25) return null;

        // Project point onto segment
        let t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / lenSq;
        t = Math.max(0.05, Math.min(0.95, t));

        const midX = Math.round(p1.x + t * dx);
        const midY = Math.round(p1.y + t * dy);

        const anc1 = wall.startAnchor || planner.getOrCreateAnchor(p1.x, p1.y);
        const anc2 = wall.endAnchor || planner.getOrCreateAnchor(p2.x, p2.y);
        const ancMid = planner.getOrCreateAnchor(midX, midY);

        if (anc1 === ancMid || anc2 === ancMid) return null;

        // Create Sub-wall 1 (p1 -> mid)
        const wall1 = new PremiumWall(planner, anc1, ancMid, wall.type || 'outer');
        wall1.height = wall.height;
        wall1.thickness = wall.thickness;
        wall1.elevation = wall.elevation;
        if (wall.materials) wall1.materials = JSON.parse(JSON.stringify(wall.materials));
        if (wall.config) wall1.config = JSON.parse(JSON.stringify(wall.config));
        if (wall.params) wall1.params = JSON.parse(JSON.stringify(wall.params));

        // Create Sub-wall 2 (mid -> p2)
        const wall2 = new PremiumWall(planner, ancMid, anc2, wall.type || 'outer');
        wall2.height = wall.height;
        wall2.thickness = wall.thickness;
        wall2.elevation = wall.elevation;
        if (wall.materials) wall2.materials = JSON.parse(JSON.stringify(wall.materials));
        if (wall.config) wall2.config = JSON.parse(JSON.stringify(wall.config));
        if (wall.params) wall2.params = JSON.parse(JSON.stringify(wall.params));

        // Transfer attached openings (doors/windows)
        const wallLen = Math.hypot(dx, dy);
        const subLen1 = wallLen * t;

        if (wall.attachedEntities && wall.attachedEntities.length > 0) {
            wall.attachedEntities.forEach(ent => {
                const entX = ent.localX !== undefined ? ent.localX : (ent.x || 0);
                if (entX <= subLen1) {
                    if (!wall1.attachedEntities) wall1.attachedEntities = [];
                    wall1.attachedEntities.push(ent);
                    ent.wall = wall1;
                } else {
                    if (!wall2.attachedEntities) wall2.attachedEntities = [];
                    ent.localX = entX - subLen1;
                    wall2.attachedEntities.push(ent);
                    ent.wall = wall2;
                }
            });
        }

        // Replace wall in planner
        const idx = planner.walls.indexOf(wall);
        if (idx !== -1) {
            planner.walls.splice(idx, 1);
            planner.walls.push(wall1, wall2);
        }

        if (wall.remove2D) wall.remove2D();
        if (wall1.update) wall1.update();
        if (wall2.update) wall2.update();

        if (planner.syncAll) planner.syncAll();
        if (planner.findRooms) planner.findRooms();

        return [wall1, wall2];
    }

    /**
     * Extrude or recess a section of a wall outward/inward by depth.
     */
    static extrudeWallSegment(planner, wall, tStart = 0.25, tEnd = 0.75, depth = 30) {
        if (!planner || !wall) return null;

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 30) return null;

        const nx = -dy / len;
        const ny = dx / len;

        const ptA = { x: Math.round(p1.x + tStart * dx), y: Math.round(p1.y + tStart * dy) };
        const ptB = { x: Math.round(p1.x + tEnd * dx), y: Math.round(p1.y + tEnd * dy) };
        const ptA_ext = { x: Math.round(ptA.x + depth * nx), y: Math.round(ptA.y + depth * ny) };
        const ptB_ext = { x: Math.round(ptB.x + depth * nx), y: Math.round(ptB.y + depth * ny) };

        const anc1 = wall.startAnchor || planner.getOrCreateAnchor(p1.x, p1.y);
        const anc2 = wall.endAnchor || planner.getOrCreateAnchor(p2.x, p2.y);
        const ancA = planner.getOrCreateAnchor(ptA.x, ptA.y);
        const ancB = planner.getOrCreateAnchor(ptB.x, ptB.y);
        const ancA_ext = planner.getOrCreateAnchor(ptA_ext.x, ptA_ext.y);
        const ancB_ext = planner.getOrCreateAnchor(ptB_ext.x, ptB_ext.y);

        const newWalls = [];
        const copyProps = (targetW) => {
            targetW.height = wall.height;
            targetW.thickness = wall.thickness;
            targetW.elevation = wall.elevation;
            if (wall.materials) targetW.materials = JSON.parse(JSON.stringify(wall.materials));
            if (wall.config) targetW.config = JSON.parse(JSON.stringify(wall.config));
        };

        // 1. Initial segment (p1 -> ptA) if tStart > 0.05
        if (tStart > 0.05) {
            const wStart = new PremiumWall(planner, anc1, ancA, wall.type || 'outer');
            copyProps(wStart);
            newWalls.push(wStart);
        }

        // 2. Return Wall 1 (ptA -> ptA_ext)
        const wReturn1 = new PremiumWall(planner, ancA, ancA_ext, wall.type || 'outer');
        copyProps(wReturn1);
        newWalls.push(wReturn1);

        // 3. Front Extruded Face (ptA_ext -> ptB_ext)
        const wFront = new PremiumWall(planner, ancA_ext, ancB_ext, wall.type || 'outer');
        copyProps(wFront);
        newWalls.push(wFront);

        // 4. Return Wall 2 (ptB_ext -> ptB)
        const wReturn2 = new PremiumWall(planner, ancB_ext, ancB, wall.type || 'outer');
        copyProps(wReturn2);
        newWalls.push(wReturn2);

        // 5. Ending segment (ptB -> p2) if tEnd < 0.95
        if (tEnd < 0.95) {
            const wEnd = new PremiumWall(planner, ancB, anc2, wall.type || 'outer');
            copyProps(wEnd);
            newWalls.push(wEnd);
        }

        // Remove old wall and insert new extruded walls
        const idx = planner.walls.indexOf(wall);
        if (idx !== -1) {
            planner.walls.splice(idx, 1);
        }
        planner.walls.push(...newWalls);

        if (wall.remove2D) wall.remove2D();
        newWalls.forEach(w => { if (w.update) w.update(); });

        if (planner.syncAll) planner.syncAll();
        if (planner.findRooms) planner.findRooms();

        return newWalls;
    }
}

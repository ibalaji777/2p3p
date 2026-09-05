/**
 * WallTopologyEngine.js
 * 
 * Single source of truth for all wall topology, connectivity, creation,
 * splitting, merging, deletion, and CSG network slicing.
 */

import { PremiumWall } from '../../features/wall/wall.renderer2d.js';
import { PremiumMolding } from '../engine2d/PremiumMolding.js';
import { WallGeometryEngine } from './WallGeometryEngine.js';

export class WallTopologyEngine {
    /**
     * Creates a new canonical wall instance.
     * @param {Object} planner - FloorPlanner instance
     * @param {Object} options - { startAnchor, endAnchor, type, height, thickness, elevation, params, topProfileType, startHeight, endHeight, peakHeight, flipSlope, id, addToPlanner }
     * @returns {PremiumWall}
     */
    static createWall(planner, options = {}) {
        const {
            startAnchor,
            endAnchor,
            type = 'outer',
            height,
            thickness,
            elevation = 0,
            params,
            topProfileType = 'normal',
            startHeight,
            endHeight,
            peakHeight,
            flipSlope = false,
            id,
            addToPlanner = true
        } = options;

        const wall = new PremiumWall(planner, startAnchor, endAnchor, type);
        if (id) wall.id = id;

        if (thickness !== undefined) {
            wall.thickness = Number(thickness);
            if (wall.config) wall.config.thickness = Number(thickness);
        }
        if (height !== undefined) {
            wall.height = Number(height);
            if (wall.config) wall.config.height = Number(height);
        }
        if (elevation !== undefined) wall.elevation = Number(elevation);

        if (topProfileType) wall.topProfileType = topProfileType;
        if (startHeight !== undefined) wall.startHeight = Number(startHeight);
        if (endHeight !== undefined) wall.endHeight = Number(endHeight);
        if (peakHeight !== undefined) wall.peakHeight = Number(peakHeight);
        if (flipSlope !== undefined) wall.flipSlope = !!flipSlope;

        if (params) {
            wall.params = { ...(wall.params || {}), ...params };
        }

        if (addToPlanner && planner && planner.walls) {
            if (!planner.walls.includes(wall)) {
                planner.walls.push(wall);
            }
            if (planner.syncAll) planner.syncAll();
        }

        return wall;
    }

    /**
     * Creates a 4-wall rectangular room box sharing 4 corner anchors.
     * @param {Object} planner 
     * @param {Object} bounds - { minX, minY, maxX, maxY, type, height, thickness, elevation, params }
     * @returns {Array<PremiumWall>}
     */
    static createRoomBox(planner, bounds = {}) {
        const { minX, minY, maxX, maxY, type = 'outer', height = 120, thickness = 16, elevation = 0, params } = bounds;
        const width = maxX - minX;
        const depth = maxY - minY;

        if (width <= 5 || depth <= 5 || !planner) return [];

        const activeParams = params || planner.activePresetParams || {};

        const roomSegments = [
            { p1: { x: minX, y: minY }, p2: { x: maxX, y: minY } }, // Top: TL -> TR
            { p1: { x: maxX, y: minY }, p2: { x: maxX, y: maxY } }, // Right: TR -> BR
            { p1: { x: maxX, y: maxY }, p2: { x: minX, y: maxY } }, // Bottom: BR -> BL
            { p1: { x: minX, y: maxY }, p2: { x: minX, y: minY } }  // Left: BL -> TL
        ];

        // Check if existing walls intersect this room box on the same vertical level
        const wallElev = elevation !== undefined ? elevation : 0;
        const isWallOnSameLevel = (w) => {
            const wBot = Number(w.elevation) || 0;
            const wTop = wBot + (Number(w.height) || 120);
            const newBot = Number(wallElev) || 0;
            const newTop = newBot + Number(height);
            return Math.max(wBot, newBot) < Math.min(wTop, newTop) - 2.0;
        };
        const existingWalls = (planner.walls || []).filter(w => !w.parentArc && w.type !== 'railing' && !w.hidden && isWallOnSameLevel(w));
        let hasIntersections = false;
        for (const seg of roomSegments) {
            for (const w of existingWalls) {
                const wA = WallGeometryEngine.getAnchorPosition(w.startAnchor);
                const wB = WallGeometryEngine.getAnchorPosition(w.endAnchor);
                const hit = this.getSegmentIntersection(seg.p1, seg.p2, wA, wB);
                if (hit && hit.isInternal1) {
                    hasIntersections = true;
                    break;
                }
            }
            if (hasIntersections) break;
        }

        if (hasIntersections) {
            return this.reformAndAddWallSegments(planner, roomSegments, type, {
                height,
                thickness,
                elevation,
                params: activeParams
            });
        }

        // Direct clean 4-anchor sequence matching standard wall drawing
        const a1 = planner.getOrCreateAnchor(minX, minY);
        const a2 = planner.getOrCreateAnchor(maxX, minY);
        const a3 = planner.getOrCreateAnchor(maxX, maxY);
        const a4 = planner.getOrCreateAnchor(minX, maxY);

        const w1 = this.createWall(planner, { startAnchor: a1, endAnchor: a2, type, height, thickness, elevation, params: activeParams, addToPlanner: true });
        const w2 = this.createWall(planner, { startAnchor: a2, endAnchor: a3, type, height, thickness, elevation, params: activeParams, addToPlanner: true });
        const w3 = this.createWall(planner, { startAnchor: a3, endAnchor: a4, type, height, thickness, elevation, params: activeParams, addToPlanner: true });
        const w4 = this.createWall(planner, { startAnchor: a4, endAnchor: a1, type, height, thickness, elevation, params: activeParams, addToPlanner: true });

        if (planner.syncAll) planner.syncAll();
        return [w1, w2, w3, w4];
    }

    /**
     * Splits a wall at a given point into two connected wall segments.
     * @param {Object} planner 
     * @param {Object} wall 
     * @param {{x: number, y: number}} splitPoint 
     * @returns {Array<Object>} [wall1, wall2]
     */
    static splitWall(planner, wall, splitPoint) {
        if (!planner || !wall || !splitPoint) return [wall];

        const p1 = WallGeometryEngine.getAnchorPosition(wall.startAnchor);
        const p2 = WallGeometryEngine.getAnchorPosition(wall.endAnchor);
        const origLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (origLen <= 1e-4) return [wall];

        const midAnchor = planner.getOrCreateAnchor(splitPoint.x, splitPoint.y);
        const oldEndAnchor = wall.endAnchor;

        // Truncate original wall
        wall.endAnchor = midAnchor;

        // Create second wall segment
        const secondWall = this.createWall(planner, {
            startAnchor: midAnchor,
            endAnchor: oldEndAnchor,
            type: wall.type,
            height: wall.height,
            thickness: wall.thickness,
            elevation: wall.elevation,
            topProfileType: wall.topProfileType,
            startHeight: wall.startHeight,
            endHeight: wall.endHeight,
            peakHeight: wall.peakHeight,
            flipSlope: wall.flipSlope,
            params: wall.params ? JSON.parse(JSON.stringify(wall.params)) : {},
            addToPlanner: true
        });

        // Proportional split of attached widgets
        if (wall.attachedWidgets && wall.attachedWidgets.length > 0) {
            const widgetsToTransfer = [];
            const splitT = Math.hypot(splitPoint.x - p1.x, splitPoint.y - p1.y) / origLen;

            wall.attachedWidgets = wall.attachedWidgets.filter(widget => {
                const widgetT = widget.t !== undefined ? widget.t : 0.5;
                if (widgetT > splitT) {
                    widget.t = (widgetT - splitT) / (1 - splitT);
                    widget.wall = secondWall;
                    widgetsToTransfer.push(widget);
                    return false;
                } else {
                    widget.t = widgetT / splitT;
                    return true;
                }
            });

            secondWall.attachedWidgets = widgetsToTransfer;
        }

        // Proportional split of attached moldings
        if (wall.attachedMoldings && wall.attachedMoldings.length > 0) {
            const moldingsToTransfer = [];
            const splitT = Math.hypot(splitPoint.x - p1.x, splitPoint.y - p1.y) / origLen;

            wall.attachedMoldings = wall.attachedMoldings.filter(molding => {
                const moldingT = molding.t !== undefined ? molding.t : 0.5;
                if (moldingT > splitT) {
                    molding.t = (moldingT - splitT) / (1 - splitT);
                    molding.wall = secondWall;
                    moldingsToTransfer.push(molding);
                    return false;
                } else {
                    molding.t = moldingT / splitT;
                    return true;
                }
            });

            secondWall.attachedMoldings = moldingsToTransfer;
        }

        if (planner.syncAll) planner.syncAll();
        return [wall, secondWall];
    }

    /**
     * Merges two collinear adjacent walls sharing an anchor into one continuous wall.
     * @param {Object} planner 
     * @param {Object} wall1 
     * @param {Object} wall2 
     * @returns {Object|null} The merged wall or null if not mergeable
     */
    static mergeWalls(planner, wall1, wall2) {
        if (!planner || !wall1 || !wall2 || wall1 === wall2) return null;

        // Find shared anchor
        let sharedAnchor = null;
        let startAnchor = null;
        let endAnchor = null;

        if (wall1.endAnchor === wall2.startAnchor) {
            sharedAnchor = wall1.endAnchor;
            startAnchor = wall1.startAnchor;
            endAnchor = wall2.endAnchor;
        } else if (wall1.startAnchor === wall2.endAnchor) {
            sharedAnchor = wall1.startAnchor;
            startAnchor = wall2.startAnchor;
            endAnchor = wall1.endAnchor;
        } else if (wall1.startAnchor === wall2.startAnchor) {
            sharedAnchor = wall1.startAnchor;
            startAnchor = wall1.endAnchor;
            endAnchor = wall2.endAnchor;
        } else if (wall1.endAnchor === wall2.endAnchor) {
            sharedAnchor = wall1.endAnchor;
            startAnchor = wall1.startAnchor;
            endAnchor = wall2.startAnchor;
        }

        if (!sharedAnchor) return null;

        // Check collinearity
        const u1 = WallGeometryEngine.getDirection(wall1);
        const u2 = WallGeometryEngine.getDirection(wall2);
        const dot = u1.x * u2.x + u1.y * u2.y;
        if (Math.abs(Math.abs(dot) - 1.0) > 0.05) return null; // Must be collinear

        const p1 = WallGeometryEngine.getAnchorPosition(startAnchor);
        const p2 = WallGeometryEngine.getAnchorPosition(endAnchor);
        const totalLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const len1 = WallGeometryEngine.getLength(wall1);

        // Update wall1 to span the full length
        wall1.startAnchor = startAnchor;
        wall1.endAnchor = endAnchor;

        // Migrate widgets from wall2
        if (wall2.attachedWidgets && wall2.attachedWidgets.length > 0 && totalLen > 0) {
            wall2.attachedWidgets.forEach(widget => {
                const origT = widget.t !== undefined ? widget.t : 0.5;
                const distOn2 = origT * WallGeometryEngine.getLength(wall2);
                widget.t = (len1 + distOn2) / totalLen;
                widget.wall = wall1;
                wall1.attachedWidgets.push(widget);
            });
            wall2.attachedWidgets = [];
        }

        // Migrate moldings from wall2
        if (wall2.attachedMoldings && wall2.attachedMoldings.length > 0 && totalLen > 0) {
            wall2.attachedMoldings.forEach(molding => {
                const origT = molding.t !== undefined ? molding.t : 0.5;
                const distOn2 = origT * WallGeometryEngine.getLength(wall2);
                molding.t = (len1 + distOn2) / totalLen;
                molding.wall = wall1;
                wall1.attachedMoldings.push(molding);
            });
            wall2.attachedMoldings = [];
        }

        // Destroy wall2
        this.deleteWall(planner, wall2);

        if (planner.syncAll) planner.syncAll();
        return wall1;
    }

    /**
     * Deletes a wall with cascading removal of attached widgets, moldings, attic gables, and 2D/3D render nodes.
     * @param {Object} planner 
     * @param {Object} wall 
     */
    static deleteWall(planner, wall) {
        if (!wall) return;

        // Cascade delete child gable/attic walls
        if (planner && planner.walls) {
            planner.walls.filter(w => w.parentWallId === wall.id).forEach(cw => this.deleteWall(planner, cw));
        }

        // Destroy 2D Konva nodes
        if (wall.wallGroup && typeof wall.wallGroup.destroy === 'function') wall.wallGroup.destroy();
        if (wall.labelGroup && typeof wall.labelGroup.destroy === 'function') wall.labelGroup.destroy();
        if (wall.entranceGroup && typeof wall.entranceGroup.destroy === 'function') wall.entranceGroup.destroy();
        if (wall.profileIndicators && typeof wall.profileIndicators.destroy === 'function') wall.profileIndicators.destroy();

        // Destroy attached widgets & moldings
        if (wall.attachedWidgets) {
            wall.attachedWidgets.forEach(w => { if (w && typeof w.destroy === 'function') w.destroy(); });
            wall.attachedWidgets = [];
        }
        if (wall.attachedMoldings) {
            wall.attachedMoldings.forEach(m => { if (m && typeof m.destroy === 'function') m.destroy(); });
            wall.attachedMoldings = [];
        }

        // Destroy 3D mesh
        if (wall.mesh3D) {
            if (wall.mesh3D.parent) wall.mesh3D.parent.remove(wall.mesh3D);
            if (typeof wall.mesh3D.traverse === 'function') {
                wall.mesh3D.traverse(c => {
                    if (c.geometry) c.geometry.dispose();
                });
            }
            wall.mesh3D = null;
        }

        if (planner && planner.walls) {
            planner.walls = planner.walls.filter(w => w !== wall);
            if (planner.selectedEntity === wall) {
                planner.selectEntity(null);
            }
            if (planner.syncAll) planner.syncAll();
        }
    }

    /**
     * Performs CSG boolean slicing on input segments intersecting existing wall networks.
     * @param {Object} planner 
     * @param {Array<Object>} inputSegments - [{ p1: {x, y}, p2: {x, y} }]
     * @param {string} wallType 
     * @param {Object} wallConfig 
     * @returns {Array<Object>} Created walls
     */
    static reformAndAddWallSegments(planner, inputSegments, wallType = 'outer', wallConfig = {}) {
        if (!planner || !inputSegments || inputSegments.length === 0) return [];

        let wallHeight = wallConfig.height !== undefined ? wallConfig.height : 120;
        let wallThick = wallConfig.thickness !== undefined ? wallConfig.thickness : 16;
        let wallElev = wallConfig.elevation !== undefined ? wallConfig.elevation : 0;
        const wallParams = wallConfig.params ? JSON.parse(JSON.stringify(wallConfig.params)) : null;

        // Auto-elevate walls drawn directly on top of foundation walls if elevation was not explicitly set
        if (wallType !== 'foundation' && wallConfig.elevation === undefined) {
            let foundFoundationTop = 0;
            const areSegmentsOverlappingCollinear = (A, B, C, D, tolerance = 6.0) => {
                const dx1 = B.x - A.x, dy1 = B.y - A.y;
                const lenSq1 = dx1 * dx1 + dy1 * dy1;
                if (lenSq1 < 1e-6) return false;
                const len1 = Math.sqrt(lenSq1);
                const distC = Math.abs((C.x - A.x) * dy1 - (C.y - A.y) * dx1) / len1;
                const distD = Math.abs((D.x - A.x) * dy1 - (D.y - A.y) * dx1) / len1;
                if (distC > tolerance || distD > tolerance) return false;

                const tC = ((C.x - A.x) * dx1 + (C.y - A.y) * dy1) / lenSq1;
                const tD = ((D.x - A.x) * dx1 + (D.y - A.y) * dy1) / lenSq1;
                const minT = Math.min(tC, tD);
                const maxT = Math.max(tC, tD);
                return Math.max(0, minT) < Math.min(1, maxT) - 0.05;
            };

            (planner.walls || []).forEach(w => {
                if (w.type === 'foundation' && !w.hidden) {
                    const wA = WallGeometryEngine.getAnchorPosition(w.startAnchor);
                    const wB = WallGeometryEngine.getAnchorPosition(w.endAnchor);
                    inputSegments.forEach(seg => {
                        if (areSegmentsOverlappingCollinear(wA, wB, seg.p1, seg.p2)) {
                            const fTop = (Number(w.elevation) || 0) + (Number(w.height) || 40);
                            if (fTop > foundFoundationTop) foundFoundationTop = fTop;
                        }
                    });
                }
            });
            if (foundFoundationTop > 0) {
                wallElev = foundFoundationTop;
            }
        }

        const isWallOnSameLevel = (w) => {
            const wBot = Number(w.elevation) || 0;
            const wTop = wBot + (Number(w.height) || 120);
            const newBot = Number(wallElev) || 0;
            const newTop = newBot + Number(wallHeight);
            // Two walls only interact horizontally if their vertical spans overlap
            return Math.max(wBot, newBot) < Math.min(wTop, newTop) - 2.0;
        };

        const createdWalls = [];
        const existingWalls = [...planner.walls.filter(w => !w.parentArc && w.type !== 'railing' && !w.hidden && isWallOnSameLevel(w))];

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

        const existingWallSplits = new Map();

        existingWalls.forEach(w => {
            const pA = WallGeometryEngine.getAnchorPosition(w.startAnchor);
            const pB = WallGeometryEngine.getAnchorPosition(w.endAnchor);
            const splits = [];

            inputSegments.forEach(seg => {
                const pC = seg.p1;
                const pD = seg.p2;

                const hit = this.getSegmentIntersection(pA, pB, pC, pD);
                if (hit && hit.isInternal1) {
                    splits.push({ point: hit.point, t: hit.t });
                }

                const colSplits = this.getCollinearOverlapSplits(pA, pB, pC, pD);
                colSplits.forEach(cs => splits.push(cs));

                const onSegC = this.isPointOnSegment(pC, pA, pB);
                if (onSegC) splits.push(onSegC);

                const onSegD = this.isPointOnSegment(pD, pA, pB);
                if (onSegD) splits.push(onSegD);
            });

            if (splits.length > 0) {
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

        existingWallSplits.forEach((splits, w) => {
            const origStartAnchor = w.startAnchor;
            const origEndAnchor = w.endAnchor;
            const splitAnchors = splits.map(s => planner.getOrCreateAnchor(s.point.x, s.point.y));
            const anchorSequence = [origStartAnchor, ...splitAnchors, origEndAnchor];

            const keptSubSegments = [];
            for (let i = 0; i < anchorSequence.length - 1; i++) {
                const subStart = anchorSequence[i];
                const subEnd = anchorSequence[i + 1];
                const p1 = WallGeometryEngine.getAnchorPosition(subStart);
                const p2 = WallGeometryEngine.getAnchorPosition(subEnd);

                if (isSegmentInsideBox(p1, p2)) continue;
                keptSubSegments.push({ start: subStart, end: subEnd });
            }

            let originalWallReused = false;
            keptSubSegments.forEach(seg => {
                if (!originalWallReused) {
                    w.startAnchor = seg.start;
                    w.endAnchor = seg.end;
                    originalWallReused = true;
                } else {
                    const newSubWall = this.createWall(planner, {
                        startAnchor: seg.start,
                        endAnchor: seg.end,
                        type: w.type,
                        height: w.height,
                        thickness: w.thickness,
                        elevation: w.elevation || 0,
                        params: w.params ? JSON.parse(JSON.stringify(w.params)) : {},
                        addToPlanner: true
                    });
                    createdWalls.push(newSubWall);
                }
            });

            if (!originalWallReused) {
                this.deleteWall(planner, w);
            }
        });

        // Remove any existing walls that did not intersect borders but are completely inside the box
        existingWalls.forEach(w => {
            if (existingWallSplits.has(w)) return;
            const p1 = WallGeometryEngine.getAnchorPosition(w.startAnchor);
            const p2 = WallGeometryEngine.getAnchorPosition(w.endAnchor);
            if (isSegmentInsideBox(p1, p2)) {
                this.deleteWall(planner, w);
            }
        });

        // ============================================================
        // PHASE 3: Subdivide all NEW input segments
        // ============================================================
        const currentActiveWalls = [...planner.walls.filter(w => !w.parentArc && w.type !== 'railing' && !w.hidden && isWallOnSameLevel(w))];

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
                const wA = WallGeometryEngine.getAnchorPosition(w.startAnchor);
                const wB = WallGeometryEngine.getAnchorPosition(w.endAnchor);

                const hit = this.getSegmentIntersection(pStart, pEnd, wA, wB);
                if (hit && hit.isInternal1) {
                    splitPoints.push({ point: hit.point, t: hit.t });
                }

                const colSplits = this.getCollinearOverlapSplits(pStart, pEnd, wA, wB);
                colSplits.forEach(cs => splitPoints.push(cs));

                const onSegA = this.isPointOnSegment(wA, pStart, pEnd);
                if (onSegA) splitPoints.push(onSegA);

                const onSegB = this.isPointOnSegment(wB, pStart, pEnd);
                if (onSegB) splitPoints.push(onSegB);
            });

            // 2. Intersect with other new input segments
            inputSegments.forEach(otherSeg => {
                if (otherSeg === seg) return;
                const hit = this.getSegmentIntersection(pStart, pEnd, otherSeg.p1, otherSeg.p2);
                if (hit && hit.isInternal1) {
                    splitPoints.push({ point: hit.point, t: hit.t });
                }
            });

            // 3. Existing anchors lying on segment
            if (planner.anchors) {
                planner.anchors.forEach(a => {
                    const aPos = WallGeometryEngine.getAnchorPosition(a);
                    const onSeg = this.isPointOnSegment(aPos, pStart, pEnd);
                    if (onSeg) splitPoints.push(onSeg);
                });
            }

            splitPoints.sort((a, b) => a.t - b.t);
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

            for (let i = 0; i < uniquePoints.length - 1; i++) {
                const ptA = uniquePoints[i];
                const ptB = uniquePoints[i + 1];
                if (Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y) < 5.0) continue;

                const ancA = planner.getOrCreateAnchor(ptA.x, ptA.y);
                const ancB = planner.getOrCreateAnchor(ptB.x, ptB.y);
                if (ancA === ancB) continue;

                const existing = currentActiveWalls.find(w =>
                    (w.startAnchor === ancA && w.endAnchor === ancB) ||
                    (w.startAnchor === ancB && w.endAnchor === ancA)
                );
                if (existing) continue;

                const newWall = this.createWall(planner, {
                    startAnchor: ancA,
                    endAnchor: ancB,
                    type: wallType,
                    height: wallHeight,
                    thickness: wallThick,
                    elevation: wallElev,
                    params: wallParams ? JSON.parse(JSON.stringify(wallParams)) : {},
                    addToPlanner: true
                });

                createdWalls.push(newWall);
            }
        });

        // Merge redundant collinear walls if any
        this.mergeRedundantCollinearWalls(planner);

        // Update 2D polygons for all walls
        planner.walls.forEach(w => {
            if (w.update) w.update();
            if (w.update2D) w.update2D();
        });

        if (planner.syncAll) planner.syncAll();
        return createdWalls;
    }

    /**
     * Merges collinear adjacent wall segments sharing an anchor with degree 2.
     */
    static mergeRedundantCollinearWalls(planner) {
        if (!planner || !planner.walls) return;
        let merged = true;
        while (merged) {
            merged = false;
            for (let i = 0; i < planner.walls.length; i++) {
                const w1 = planner.walls[i];
                if (!w1 || w1.parentArc || w1.type === 'railing' || w1.hidden) continue;

                for (let j = i + 1; j < planner.walls.length; j++) {
                    const w2 = planner.walls[j];
                    if (!w2 || w2.parentArc || w2.type === 'railing' || w2.hidden) continue;

                    let sharedAnchor = null;
                    if (w1.endAnchor === w2.startAnchor) sharedAnchor = w1.endAnchor;
                    else if (w1.startAnchor === w2.endAnchor) sharedAnchor = w1.startAnchor;
                    else if (w1.startAnchor === w2.startAnchor) sharedAnchor = w1.startAnchor;
                    else if (w1.endAnchor === w2.endAnchor) sharedAnchor = w1.endAnchor;

                    if (!sharedAnchor) continue;

                    const connected = planner.walls.filter(w => (w.startAnchor === sharedAnchor || w.endAnchor === sharedAnchor) && !w.hidden);
                    if (connected.length !== 2) continue;

                    const p1A = WallGeometryEngine.getAnchorPosition(w1.startAnchor);
                    const p1B = WallGeometryEngine.getAnchorPosition(w1.endAnchor);
                    const p2A = WallGeometryEngine.getAnchorPosition(w2.startAnchor);
                    const p2B = WallGeometryEngine.getAnchorPosition(w2.endAnchor);

                    const len1 = Math.hypot(p1B.x - p1A.x, p1B.y - p1A.y);
                    const len2 = Math.hypot(p2B.x - p2A.x, p2B.y - p2A.y);
                    if (len1 < 1e-3 || len2 < 1e-3) continue;

                    const u1 = { x: (p1B.x - p1A.x) / len1, y: (p1B.y - p1A.y) / len1 };
                    const u2 = { x: (p2B.x - p2A.x) / len2, y: (p2B.y - p2A.y) / len2 };

                    const dot = Math.abs(u1.x * u2.x + u1.y * u2.y);
                    if (dot > 0.999) {
                        const mergedWall = this.mergeWalls(planner, w1, w2);
                        if (mergedWall) {
                            merged = true;
                            break;
                        }
                    }
                }
                if (merged) break;
            }
        }
    }

    /**
     * Line-segment intersection test with internal parameter checks.
     */
    static getSegmentIntersection(p1, p2, p3, p4) {
        const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
        const det = d1x * d2y - d1y * d2x;
        if (Math.abs(det) < 1e-6) return null;

        const dx = p3.x - p1.x, dy = p3.y - p1.y;
        const t = (dx * d2y - dy * d2x) / det;
        const u = (dx * d1y - dy * d1x) / det;

        const eps = 0.002;
        const isInternal1 = t > eps && t < 1 - eps;
        const isInternal2 = u > eps && u < 1 - eps;

        if (t >= -eps && t <= 1 + eps && u >= -eps && u <= 1 + eps) {
            return {
                point: { x: p1.x + t * d1x, y: p1.y + t * d1y },
                t: Math.max(0, Math.min(1, t)),
                u: Math.max(0, Math.min(1, u)),
                isInternal1,
                isInternal2
            };
        }
        return null;
    }

    static isPointOnSegment(p, pA, pB, tolerance = 6.0) {
        const dx = pB.x - pA.x;
        const dy = pB.y - pA.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) return null;

        const t = ((p.x - pA.x) * dx + (p.y - pA.y) * dy) / lenSq;
        if (t <= 0.005 || t >= 0.995) return null;

        const projX = pA.x + t * dx;
        const projY = pA.y + t * dy;
        const dist = Math.hypot(p.x - projX, p.y - projY);

        if (dist <= tolerance) {
            return { point: { x: Math.round(projX), y: Math.round(projY) }, t };
        }
        return null;
    }

    static getCollinearOverlapSplits(A, B, C, D, tolerance = 6.0) {
        const dx1 = B.x - A.x;
        const dy1 = B.y - A.y;
        const lenSq1 = dx1 * dx1 + dy1 * dy1;
        if (lenSq1 < 1e-6) return [];

        const len1 = Math.sqrt(lenSq1);
        const distC = Math.abs((C.x - A.x) * dy1 - (C.y - A.y) * dx1) / len1;
        const distD = Math.abs((D.x - A.x) * dy1 - (D.y - A.y) * dx1) / len1;

        if (distC > tolerance || distD > tolerance) return [];

        const tC = ((C.x - A.x) * dx1 + (C.y - A.y) * dy1) / lenSq1;
        const tD = ((D.x - A.x) * dx1 + (D.y - A.y) * dy1) / lenSq1;

        const minT = Math.min(tC, tD);
        const maxT = Math.max(tC, tD);

        if (maxT <= 0.005 || minT >= 0.995) return [];

        const splits = [];
        if (tC > 0.005 && tC < 0.995) splits.push({ point: { x: Math.round(C.x), y: Math.round(C.y) }, t: tC });
        if (tD > 0.005 && tD < 0.995) splits.push({ point: { x: Math.round(D.x), y: Math.round(D.y) }, t: tD });

        return splits;
    }

    /**
     * Extrude or recess a section of a wall outward/inward by depth.
     */
    static extrudeWallSegment(planner, wall, tStart = 0.25, tEnd = 0.75, depth = 30) {
        if (!planner || !wall) return null;

        const p1 = WallGeometryEngine.getAnchorPosition(wall.startAnchor);
        const p2 = WallGeometryEngine.getAnchorPosition(wall.endAnchor);

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

        const getAnchor = (x, y) => {
            if (planner && typeof planner.getOrCreateAnchor === 'function') return planner.getOrCreateAnchor(x, y);
            if (planner && typeof planner.findOrCreateAnchor === 'function') return planner.findOrCreateAnchor(x, y);
            const anchorObj = { x, y, position: () => ({ x, y }) };
            if (planner && planner.anchors && Array.isArray(planner.anchors)) planner.anchors.push(anchorObj);
            return anchorObj;
        };

        const anc1 = wall.startAnchor || getAnchor(p1.x, p1.y);
        const anc2 = wall.endAnchor || getAnchor(p2.x, p2.y);
        const ancA = getAnchor(ptA.x, ptA.y);
        const ancB = getAnchor(ptB.x, ptB.y);
        const ancA_ext = getAnchor(ptA_ext.x, ptA_ext.y);
        const ancB_ext = getAnchor(ptB_ext.x, ptB_ext.y);

        const newWalls = [];
        const wallOpts = {
            type: wall.type || 'outer',
            height: wall.height,
            thickness: wall.thickness,
            elevation: wall.elevation || 0,
            params: wall.params ? JSON.parse(JSON.stringify(wall.params)) : {},
            addToPlanner: true
        };

        let wStart = null;
        let wEnd = null;

        // 1. Initial segment (p1 -> ptA) if tStart > 0.05
        if (tStart > 0.05) {
            wStart = this.createWall(planner, {
                ...wallOpts,
                startAnchor: anc1,
                endAnchor: ancA
            });
            newWalls.push(wStart);
        }

        // 2. Return Wall 1 (ptA -> ptA_ext)
        const wReturn1 = this.createWall(planner, {
            ...wallOpts,
            startAnchor: ancA,
            endAnchor: ancA_ext
        });
        newWalls.push(wReturn1);

        // 3. Front Extruded Face (ptA_ext -> ptB_ext)
        const wFront = this.createWall(planner, {
            ...wallOpts,
            startAnchor: ancA_ext,
            endAnchor: ancB_ext
        });
        newWalls.push(wFront);

        // 4. Return Wall 2 (ptB_ext -> ptB)
        const wReturn2 = this.createWall(planner, {
            ...wallOpts,
            startAnchor: ancB_ext,
            endAnchor: ancB
        });
        newWalls.push(wReturn2);

        // 5. Ending segment (ptB -> p2) if tEnd < 0.95
        if (tEnd < 0.95) {
            wEnd = this.createWall(planner, {
                ...wallOpts,
                startAnchor: ancB,
                endAnchor: anc2
            });
            newWalls.push(wEnd);
        }

        // Transfer attached widgets (openings, windows, doors, protrusions) to appropriate replacement segment
        if (wall.attachedWidgets && wall.attachedWidgets.length > 0) {
            wall.attachedWidgets.forEach(widget => {
                const wT = widget.t !== undefined ? widget.t : 0.5;
                const widgetData = typeof widget.serialize === 'function' ? widget.serialize() : { ...widget };
                
                let targetWall = wFront;
                let mappedT = 0.5;

                if (wStart && wT < tStart) {
                    targetWall = wStart;
                    mappedT = wT / tStart;
                } else if (wEnd && wT > tEnd) {
                    targetWall = wEnd;
                    mappedT = (wT - tEnd) / (1 - tEnd);
                } else {
                    targetWall = wFront;
                    mappedT = (tEnd > tStart) ? (wT - tStart) / (tEnd - tStart) : 0.5;
                }

                if (targetWall) {
                    const newWidget = {
                        ...widgetData,
                        wall: targetWall,
                        t: Math.max(0.01, Math.min(0.99, mappedT))
                    };
                    if (!targetWall.attachedWidgets) targetWall.attachedWidgets = [];
                    targetWall.attachedWidgets.push(newWidget);
                }

                if (widget.destroy) widget.destroy();
                else if (widget.remove) widget.remove();
            });
            wall.attachedWidgets = [];
        }

        // Transfer moldings along all new bay walls
        if (wall.attachedMoldings && wall.attachedMoldings.length > 0) {
            wall.attachedMoldings.forEach(mold => {
                const moldData = mold.serialize ? mold.serialize() : { ...mold };
                newWalls.forEach(nw => {
                    const nwp1 = WallGeometryEngine.getAnchorPosition(nw.startAnchor);
                    const nwp2 = WallGeometryEngine.getAnchorPosition(nw.endAnchor);
                    const nwLen = Math.hypot(nwp2.x - nwp1.x, nwp2.y - nwp1.y);
                    const nm = new PremiumMolding(planner, nw, 0.5, mold.type || 'molding_chair_rail');
                    Object.assign(nm, moldData);
                    nm.wall = nw;
                    nm.width = nwLen;
                    nm.t = 0.5;
                    if (!nw.attachedMoldings) nw.attachedMoldings = [];
                    nw.attachedMoldings.push(nm);
                    if (nm.update) nm.update();
                });
                if (mold.destroy) mold.destroy();
            });
            wall.attachedMoldings = [];
        }

        // Delete original wall via canonical deleteWall
        this.deleteWall(planner, wall);

        if (planner.syncAll) planner.syncAll();
        if (planner.findRooms) planner.findRooms();

        return newWalls;
    }
}

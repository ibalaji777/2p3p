/**
 * src/core/adaptation/DesignIntentAnalyzer.js
 * 
 * Design Intent & BIM Entity Classifier for the Building Adaptation System.
 * Distinguishes between fixed physical components, elastic architectural spans,
 * and derived procedural geometry.
 */

import { WallEngine } from '../wall/WallEngine.js';
import { WallGeometryEngine } from '../wall/WallGeometryEngine.js';
import { SiteGeometryEngine } from '../site/SiteGeometryEngine.js';

export const ENTITY_ROLE = {
    FIXED: 'fixed',         // Real-world physical dimensions locked (doors, windows, stairs, furniture, wall thickness)
    ADAPTABLE: 'adaptable', // Elastic spaces that absorb dimensional changes (wall lengths, room spans, anchor positions)
    DERIVED: 'derived'      // Procedural elements regenerated from parent architecture (slabs, roofs, ceilings, miters)
};

export class DesignIntentAnalyzer {
    /**
     * Analyzes planner state and returns a structured architectural breakdown.
     * 
     * @param {Object} planner - Canonical FloorPlanner instance
     * @returns {Object}
     */
    static analyze(planner) {
        if (!planner) return null;

        const bounds = this.getBuildingBounds(planner);
        const walls = planner.walls || [];
        const anchors = planner.anchors || [];
        const roofs = planner.roofs || [];
        const rooms = planner.rooms || [];
        const furniture = planner.furniture || [];
        const stairs = planner.stairs || [];

        // Collect all openings (doors, windows, arches) attached to walls
        const openings = [];
        walls.forEach(w => {
            if (w.widgets && Array.isArray(w.widgets)) {
                w.widgets.forEach(widget => {
                    openings.push({
                        widget,
                        wall: w,
                        type: widget.type || widget.configId || 'door',
                        isDoor: WallEngine.isFloorAnchoredDoor(widget),
                        width: Number(widget.width) || (WallEngine.isFloorAnchoredDoor(widget) ? 90 : 120),
                        height: Number(widget.height) || 210,
                        elevation: Number(widget.elevation) || 0,
                        t: Number(widget.t) !== undefined ? Number(widget.t) : 0.5
                    });
                });
            }
        });

        // Classify roof strategy
        const hasSlopedRoofs = this.hasSlopedRoofs(planner);
        const dominantRoofType = roofs.length > 0 ? (roofs[0].type || roofs[0].roofType || 'flat') : 'flat';

        // Categorize rooms (primary living spaces vs secondary circulation/utility)
        const roomClassification = rooms.map(r => {
            const name = (r.name || '').toLowerCase();
            const isSecondary = name.includes('bath') || name.includes('toilet') || 
                                name.includes('hall') || name.includes('corridor') || 
                                name.includes('utility') || name.includes('store') ||
                                name.includes('closet');
            return {
                room: r,
                name: r.name || 'Room',
                isSecondary,
                minWidth: isSecondary ? 120 : 270 // cm minimum width guideline
            };
        });

        return {
            bounds,
            wallCount: walls.length,
            anchorCount: anchors.length,
            openings,
            stairs,
            furniture,
            roofs,
            rooms: roomClassification,
            hasSlopedRoofs,
            dominantRoofType
        };
    }

    /**
    /**
     * Determines whether a wall belongs to the main habitable building core.
     * Excludes compound boundary walls, fences, and foundation footings.
     * @param {Object} w 
     * @returns {boolean}
     */
    static isBuildingWall(w) {
        if (!w || w.hidden) return false;
        const type = (w.type || w.wallType || 'inner').toLowerCase();
        return type !== 'compound' && type !== 'foundation';
    }

    /**
     * Computes the outer bounding box and area of the building footprint.
     * Strictly excludes outdoor compound boundary walls.
     * 
     * @param {Object} planner 
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number, width: number, depth: number, areaCm2: number, areaSqFt: number, cx: number, cy: number }}
     */
    static getBuildingBounds(planner) {
        if (!planner) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, depth: 0, areaCm2: 0, areaSqFt: 0, cx: 0, cy: 0 };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Inspect only main building walls (excluding compound boundary walls)
        const buildingWalls = (planner.walls && Array.isArray(planner.walls))
            ? planner.walls.filter(w => DesignIntentAnalyzer.isBuildingWall(w))
            : [];

        if (buildingWalls.length > 0) {
            buildingWalls.forEach(w => {
                const p1 = WallGeometryEngine.getAnchorPosition(w.startAnchor || { x: w.startX, y: w.startY });
                const p2 = WallGeometryEngine.getAnchorPosition(w.endAnchor || { x: w.endX, y: w.endY });
                if (p1 && typeof p1.x === 'number' && typeof p1.y === 'number') {
                    minX = Math.min(minX, p1.x);
                    maxX = Math.max(maxX, p1.x);
                    minY = Math.min(minY, p1.y);
                    maxY = Math.max(maxY, p1.y);
                }
                if (p2 && typeof p2.x === 'number' && typeof p2.y === 'number') {
                    minX = Math.min(minX, p2.x);
                    maxX = Math.max(maxX, p2.x);
                    minY = Math.min(minY, p2.y);
                    maxY = Math.max(maxY, p2.y);
                }
            });
        }

        // If walls alone do not form a 2D bounding area (e.g. single-wall mock test plans),
        // fallback to evaluate anchors if available
        if ((minX === Infinity || maxX - minX <= 0 || maxY - minY <= 0) && planner.anchors && Array.isArray(planner.anchors) && planner.anchors.length > 0) {
            let aMinX = Infinity, aMinY = Infinity, aMaxX = -Infinity, aMaxY = -Infinity;
            planner.anchors.forEach(a => {
                const pos = typeof a.position === 'function' ? a.position() : a;
                if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                    aMinX = Math.min(aMinX, pos.x);
                    aMaxX = Math.max(aMaxX, pos.x);
                    aMinY = Math.min(aMinY, pos.y);
                    aMaxY = Math.max(aMaxY, pos.y);
                }
            });
            if (aMaxX - aMinX > 0 && aMaxY - aMinY > 0) {
                minX = aMinX;
                maxX = aMaxX;
                minY = aMinY;
                maxY = aMaxY;
            }
        }

        if (minX === Infinity || maxX === -Infinity) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, depth: 0, areaCm2: 0, areaSqFt: 0, cx: 0, cy: 0 };
        }

        const width = maxX - minX;
        const depth = maxY - minY;
        const cx = minX + width / 2;
        const cy = minY + depth / 2;
        const areaCm2 = width * depth;
        const areaSqFt = SiteGeometryEngine.units2ToSqFt(areaCm2);

        return { minX, maxX, minY, maxY, width, depth, areaCm2, areaSqFt, cx, cy };
    }

    /**
     * Determines whether any sloped / pitched roofs exist on the plan.
     * Sloped roofs require a strictly rectangular bounding module to prevent non-planar twist.
     * 
     * @param {Object} planner 
     * @returns {boolean}
     */
    static hasSlopedRoofs(planner) {
        if (!planner || !planner.roofs || planner.roofs.length === 0) return false;
        
        return planner.roofs.some(r => {
            const type = (r.type || r.roofType || '').toLowerCase();
            return type !== 'flat' && type !== '';
        });
    }

    /**
     * Classifies a single entity into fixed, adaptable, or derived.
     * 
     * @param {Object} entity 
     * @returns {string} One of ENTITY_ROLE
     */
    static classifyEntity(entity) {
        if (!entity) return ENTITY_ROLE.DERIVED;

        // Doors, windows, openings
        if (entity.isDoor || entity.type === 'door' || entity.type === 'window' || entity.type === 'opening' || WallEngine.isFloorAnchoredDoor(entity)) {
            return ENTITY_ROLE.FIXED;
        }

        // Staircases
        if (entity.type === 'stair' || entity.type === 'staircase' || entity.systemId || entity.steps || entity.treadDepth !== undefined) {
            return ENTITY_ROLE.FIXED;
        }

        // Furniture
        if (entity.type === 'furniture' || entity.catalogId || entity.isFurniture) {
            return ENTITY_ROLE.FIXED;
        }

        // Wall Thickness
        if (entity.thickness !== undefined && entity.startAnchor !== undefined) {
            // The wall itself is adaptable, but its thickness is fixed
            return ENTITY_ROLE.ADAPTABLE;
        }

        // Anchors / Nodes
        if (entity.startAnchor === undefined && (entity.x !== undefined || typeof entity.position === 'function')) {
            return ENTITY_ROLE.ADAPTABLE;
        }

        // Roofs, Slabs, Ceilings
        if (entity.type === 'roof' || entity.isRoof || entity.isSlab || entity.isCeiling) {
            return ENTITY_ROLE.DERIVED;
        }

        return ENTITY_ROLE.ADAPTABLE;
    }

    /**
     * Validates that an attached opening fits safely on a resized wall length
     * without cutting into corner miters or protruding beyond endpoints.
     * 
     * @param {number} newWallLength - Target wall length in cm
     * @param {number} openingWidth - Opening physical width in cm
     * @param {number} currentT - Current normalized position [0, 1]
     * @param {number} [minClearance=10] - Minimum clearance from wall endpoints in cm
     * @returns {{ fits: boolean, clampedT: number, minLengthRequired: number }}
     */
    static calculateSafeOpeningT(newWallLength, openingWidth, currentT, minClearance = 10) {
        const minLengthRequired = openingWidth + 2 * minClearance;
        
        if (newWallLength < minLengthRequired) {
            return {
                fits: false,
                clampedT: 0.5,
                minLengthRequired
            };
        }

        const halfW = openingWidth / 2;
        const minDist = halfW + minClearance;
        const maxDist = newWallLength - halfW - minClearance;

        const tMin = minDist / newWallLength;
        const tMax = maxDist / newWallLength;

        const clampedT = Math.max(tMin, Math.min(tMax, currentT));

        return {
            fits: true,
            clampedT,
            minLengthRequired
        };
    }

    /**
     * Extracts the true building footprint perimeter polygon (distinguishing L, T, U, stepped footprints from AABB).
     * @param {Object} planner 
     * @returns {{ points: Array<{x: number, y: number}>, bounds: Object, areaUnits2: number, areaSqFt: number, isRectangular: boolean }}
     */
    static getBuildingFootprint(planner) {
        const bounds = this.getBuildingBounds(planner);
        if (!planner || bounds.width <= 0 || bounds.depth <= 0) {
            return {
                points: [],
                bounds,
                areaUnits2: 0,
                areaSqFt: 0,
                isRectangular: true
            };
        }

        // 1. If closed rooms exist, derive outer perimeter by canceling shared interior wall segments
        let rooms = planner.rooms || [];
        if ((!rooms || rooms.length === 0) && typeof planner.detectRooms === 'function') {
            try {
                rooms = planner.detectRooms() || [];
            } catch (e) {
                // ignore
            }
        }

        const validRooms = (rooms || []).filter(r => r.path && r.path.length >= 3 && !r.isDeleted && !r.isHidden);

        if (validRooms.length > 0) {
            // Map directed segments: key is "x1,y1->x2,y2"
            const roundCoord = (v) => Math.round(v * 10) / 10;
            const ptKey = (p) => `${roundCoord(p.x)},${roundCoord(p.y)}`;
            const edgeCount = new Map();
            const edgeObjects = [];

            validRooms.forEach(r => {
                const path = r.path;
                const n = path.length;
                for (let i = 0; i < n; i++) {
                    const p1 = path[i];
                    const p2 = path[(i + 1) % n];
                    const k1 = ptKey(p1);
                    const k2 = ptKey(p2);
                    if (k1 === k2) continue;

                    const forwardKey = `${k1}->${k2}`;
                    const reverseKey = `${k2}->${k1}`;

                    // If opposite directed edge already exists, cancel both (interior partition wall)
                    if (edgeCount.has(reverseKey) && edgeCount.get(reverseKey) > 0) {
                        edgeCount.set(reverseKey, edgeCount.get(reverseKey) - 1);
                    } else {
                        edgeCount.set(forwardKey, (edgeCount.get(forwardKey) || 0) + 1);
                        edgeObjects.push({ fromKey: k1, toKey: k2, from: { x: roundCoord(p1.x), y: roundCoord(p1.y) }, to: { x: roundCoord(p2.x), y: roundCoord(p2.y) } });
                    }
                }
            });

            const exteriorEdges = edgeObjects.filter(e => (edgeCount.get(`${e.fromKey}->${e.toKey}`) || 0) > 0);

            if (exteriorEdges.length >= 3) {
                // Chain exterior edges into ordered boundary loops
                const adj = new Map();
                exteriorEdges.forEach(e => {
                    if (!adj.has(e.fromKey)) adj.set(e.fromKey, []);
                    adj.get(e.fromKey).push(e);
                });

                // Find start point with minimum X then minimum Y
                let startKey = exteriorEdges[0].fromKey;
                let minVal = Infinity;
                exteriorEdges.forEach(e => {
                    const val = e.from.x * 100000 + e.from.y;
                    if (val < minVal) {
                        minVal = val;
                        startKey = e.fromKey;
                    }
                });

                const loop = [];
                let currentKey = startKey;
                const visited = new Set();
                let maxSteps = exteriorEdges.length * 2;

                while (maxSteps-- > 0) {
                    const outgoing = adj.get(currentKey);
                    if (!outgoing || outgoing.length === 0) break;
                    const nextEdge = outgoing.find(e => !visited.has(e)) || outgoing[0];
                    visited.add(nextEdge);
                    loop.push(nextEdge.from);
                    currentKey = nextEdge.toKey;
                    if (currentKey === startKey) break;
                }

                if (loop.length >= 3) {
                    // Simplify collinear points along straight outer walls
                    const simplified = [];
                    const m = loop.length;
                    for (let i = 0; i < m; i++) {
                        const prev = loop[(i - 1 + m) % m];
                        const curr = loop[i];
                        const next = loop[(i + 1) % m];
                        const dx1 = curr.x - prev.x;
                        const dy1 = curr.y - prev.y;
                        const dx2 = next.x - curr.x;
                        const dy2 = next.y - curr.y;
                        const cross = dx1 * dy2 - dy1 * dx2;
                        if (Math.abs(cross) > 1.0) {
                            simplified.push(curr);
                        }
                    }

                    const finalPoints = simplified.length >= 3 ? simplified : loop;
                    const footprintAreaUnits2 = SiteGeometryEngine.getArea(finalPoints);
                    const footprintAreaSqFt = SiteGeometryEngine.units2ToSqFt(footprintAreaUnits2);

                    const isRectangular = finalPoints.length === 4 && (
                        Math.abs(footprintAreaUnits2 - (bounds.width * bounds.depth)) < 50
                    );

                    return {
                        points: finalPoints,
                        bounds,
                        areaUnits2: footprintAreaUnits2,
                        areaSqFt: Math.round(footprintAreaSqFt * 10) / 10,
                        isRectangular
                    };
                }
            }
        }

        // Fallback when no rooms: Trace wall network cycle if walls form a closed perimeter
        const wallsList = (planner.walls && Array.isArray(planner.walls))
            ? planner.walls.filter(w => DesignIntentAnalyzer.isBuildingWall(w))
            : [];

        if (wallsList.length >= 3) {
            const roundCoord = (v) => Math.round(v * 10) / 10;
            const ptKey = (p) => `${roundCoord(p.x)},${roundCoord(p.y)}`;
            const adj = new Map();

            wallsList.forEach(w => {
                const p1 = (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position() : (w.startAnchor || { x: w.startX, y: w.startY });
                const p2 = (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position() : (w.endAnchor || { x: w.endX, y: w.endY });
                if (!p1 || !p2) return;
                const k1 = ptKey(p1);
                const k2 = ptKey(p2);
                if (k1 === k2) return;
                if (!adj.has(k1)) adj.set(k1, []);
                if (!adj.has(k2)) adj.set(k2, []);
                adj.get(k1).push({ toKey: k2, from: { x: roundCoord(p1.x), y: roundCoord(p1.y) }, to: { x: roundCoord(p2.x), y: roundCoord(p2.y) } });
                adj.get(k2).push({ toKey: k1, from: { x: roundCoord(p2.x), y: roundCoord(p2.y) }, to: { x: roundCoord(p1.x), y: roundCoord(p1.y) } });
            });

            let startKey = null;
            let minVal = Infinity;
            adj.forEach((edges, k) => {
                const pt = edges[0].from;
                const val = pt.x * 100000 + pt.y;
                if (val < minVal) {
                    minVal = val;
                    startKey = k;
                }
            });

            if (startKey) {
                const loop = [];
                let currentKey = startKey;
                const visitedEdges = new Set();
                let maxSteps = wallsList.length * 2;

                while (maxSteps-- > 0) {
                    const outgoing = adj.get(currentKey);
                    if (!outgoing || outgoing.length === 0) break;
                    const nextEdge = outgoing.find(e => !visitedEdges.has(`${currentKey}->${e.toKey}`) && !visitedEdges.has(`${e.toKey}->${currentKey}`)) || outgoing[0];
                    visitedEdges.add(`${currentKey}->${nextEdge.toKey}`);
                    loop.push(nextEdge.from);
                    currentKey = nextEdge.toKey;
                    if (currentKey === startKey) break;
                }

                if (loop.length >= 3 && currentKey === startKey) {
                    const footprintAreaUnits2 = SiteGeometryEngine.getArea(loop);
                    const footprintAreaSqFt = SiteGeometryEngine.units2ToSqFt(footprintAreaUnits2);
                    const isRectangular = loop.length === 4 && (
                        Math.abs(footprintAreaUnits2 - (bounds.width * bounds.depth)) < 50
                    );

                    return {
                        points: loop,
                        bounds,
                        areaUnits2: footprintAreaUnits2,
                        areaSqFt: Math.round(footprintAreaSqFt * 10) / 10,
                        isRectangular
                    };
                }
            }
        }

        // Final Fallback: 4-corner bounding box
        const defaultCorners = [
            { x: bounds.minX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.maxY },
            { x: bounds.minX, y: bounds.maxY }
        ];

        return {
            points: defaultCorners,
            bounds,
            areaUnits2: bounds.areaCm2,
            areaSqFt: bounds.areaSqFt,
            isRectangular: true
        };
    }

    /**
     * Extracts the boundary loop of an outdoor compound wall enclosure if present.
     * Used as the authoritative buildable container when no legal site boundary object exists (Scenarios 2, 5, 7, 10).
     * @param {Object} planner 
     * @returns {{ polygon: Array<{x: number, y: number}>, bounds: Object, areaUnits2: number, areaSqFt: number, wallCount: number }|null}
     */
    static getCompoundBoundary(planner) {
        if (!planner || !planner.walls) return null;
        const compoundWalls = planner.walls.filter(w => !w.hidden && (w.type === 'compound' || w.wallType === 'compound'));
        if (compoundWalls.length < 3) return null;

        const roundCoord = (v) => Math.round(v * 10) / 10;
        const ptKey = (p) => `${roundCoord(p.x)},${roundCoord(p.y)}`;
        const adj = new Map();

        compoundWalls.forEach(w => {
            const p1 = (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position() : (w.startAnchor || { x: w.startX, y: w.startY });
            const p2 = (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position() : (w.endAnchor || { x: w.endX, y: w.endY });
            if (!p1 || !p2) return;
            const k1 = ptKey(p1);
            const k2 = ptKey(p2);
            if (k1 === k2) return;
            if (!adj.has(k1)) adj.set(k1, []);
            if (!adj.has(k2)) adj.set(k2, []);
            adj.get(k1).push({ toKey: k2, from: { x: roundCoord(p1.x), y: roundCoord(p1.y) }, to: { x: roundCoord(p2.x), y: roundCoord(p2.y) } });
            adj.get(k2).push({ toKey: k1, from: { x: roundCoord(p2.x), y: roundCoord(p2.y) }, to: { x: roundCoord(p1.x), y: roundCoord(p1.y) } });
        });

        // Find starting vertex with minimum X then minimum Y
        let startKey = null;
        let minVal = Infinity;
        adj.forEach((edges, k) => {
            const pt = edges[0].from;
            const val = pt.x * 100000 + pt.y;
            if (val < minVal) {
                minVal = val;
                startKey = k;
            }
        });

        if (!startKey) return null;

        const loop = [];
        let currentKey = startKey;
        const visitedEdges = new Set();
        let maxSteps = compoundWalls.length * 2;

        while (maxSteps-- > 0) {
            const outgoing = adj.get(currentKey);
            if (!outgoing || outgoing.length === 0) break;
            const nextEdge = outgoing.find(e => !visitedEdges.has(`${currentKey}->${e.toKey}`) && !visitedEdges.has(`${e.toKey}->${currentKey}`)) || outgoing[0];
            visitedEdges.add(`${currentKey}->${nextEdge.toKey}`);
            loop.push(nextEdge.from);
            currentKey = nextEdge.toKey;
            if (currentKey === startKey) break;
        }

        if (loop.length < 3 || currentKey !== startKey) return null;

        const areaUnits2 = SiteGeometryEngine.getArea(loop);
        const areaSqFt = SiteGeometryEngine.units2ToSqFt(areaUnits2);

        return {
            polygon: loop,
            areaUnits2,
            areaSqFt: Math.round(areaSqFt * 10) / 10,
            wallCount: compoundWalls.length
        };
    }

    /**
     * Analyzes wall spans along the principal X and Y axes, classifying
     * intervals into protected (corridors, bathrooms, stairs, openings) vs adaptable.
     * Strictly isolates building walls and anchors from compound boundaries.
     * 
     * @param {Object} planner 
     * @returns {{ xLines: Array<number>, yLines: Array<number>, xSpans: Array<Object>, ySpans: Array<Object> }}
     */
    static analyzeSpans(planner) {
        // Collect anchors exclusively from main building walls
        const buildingWalls = (planner.walls && Array.isArray(planner.walls))
            ? planner.walls.filter(w => DesignIntentAnalyzer.isBuildingWall(w))
            : [];
        
        const buildingAnchorSet = new Set();
        buildingWalls.forEach(w => {
            if (w.startAnchor) buildingAnchorSet.add(w.startAnchor);
            if (w.endAnchor) buildingAnchorSet.add(w.endAnchor);
        });

        const anchors = buildingAnchorSet.size > 0 
            ? Array.from(buildingAnchorSet) 
            : (planner.anchors || []);

        const rawXs = [];
        const rawYs = [];

        anchors.forEach(a => {
            const p = typeof a.position === 'function' ? a.position() : a;
            if (p && typeof p.x === 'number' && typeof p.y === 'number') {
                rawXs.push(p.x);
                rawYs.push(p.y);
            }
        });

        // Cluster coordinates within 2.0 world units
        const clusterCoords = (coords) => {
            const sorted = [...coords].sort((a, b) => a - b);
            const clusters = [];
            sorted.forEach(c => {
                const last = clusters[clusters.length - 1];
                if (last && Math.abs(c - last.center) < 3.0) {
                    last.points.push(c);
                    last.center = last.points.reduce((s, v) => s + v, 0) / last.points.length;
                } else {
                    clusters.push({ center: c, points: [c] });
                }
            });
            return clusters.map(c => Math.round(c.center * 10) / 10);
        };

        const xLines = clusterCoords(rawXs);
        const yLines = clusterCoords(rawYs);

        const buildSpans = (lines, axis) => {
            const spans = [];
            for (let i = 0; i < lines.length - 1; i++) {
                const start = lines[i];
                const end = lines[i + 1];
                const spanLen = end - start;
                if (spanLen <= 0.5) continue;

                let minLen = 40; // minimum fallback span (2 ft)
                let elasticity = 1.0; // 1.0 = highly adaptable, 0.2 = protected
                let role = 'adaptable';

                // Check rooms spanning this interval
                if (planner.rooms) {
                    planner.rooms.forEach(r => {
                        if (!r.path || r.path.length < 3) return;
                        const coords = r.path.map(p => axis === 'x' ? p.x : p.y);
                        const rMin = Math.min(...coords);
                        const rMax = Math.max(...coords);

                        // If room overlaps this interval
                        if (rMin < end - 1 && rMax > start + 1) {
                            const name = (r.name || '').toLowerCase();
                            const isBath = name.includes('bath') || name.includes('toilet') || name.includes('powder') || name.includes('wc');
                            const isCorridor = name.includes('corridor') || name.includes('passage') || name.includes('entry') || name.includes('foyer');

                            if (isBath) {
                                minLen = Math.max(minLen, 80); // 4 ft bathroom
                                elasticity = Math.min(elasticity, 0.2);
                                role = 'protected';
                            } else if (isCorridor) {
                                minLen = Math.max(minLen, 60); // 3 ft corridor
                                elasticity = Math.min(elasticity, 0.15);
                                role = 'protected';
                            }
                        }
                    });
                }

                // Check stairs in this interval
                if (planner.stairs) {
                    planner.stairs.forEach(s => {
                        const stairPos = (s.group && typeof s.group.position === 'function') 
                            ? s.group.position() 
                            : (s.x !== undefined ? { x: s.x, y: s.y } : null);
                        if (stairPos) {
                            const val = axis === 'x' ? stairPos.x : stairPos.y;
                            if (val >= start - 10 && val <= end + 10) {
                                minLen = Math.max(minLen, 80);
                                elasticity = Math.min(elasticity, 0.1);
                                role = 'fixed';
                            }
                        }
                    });
                }

                // Check openings on walls along this interval
                if (planner.walls) {
                    planner.walls.forEach(w => {
                        if (!DesignIntentAnalyzer.isBuildingWall(w)) return;
                        if (!w.widgets || w.widgets.length === 0) return;
                        const p1 = (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position() : (w.startAnchor || { x: w.startX, y: w.startY });
                        const p2 = (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position() : (w.endAnchor || { x: w.endX, y: w.endY });
                        const wMin = Math.min(axis === 'x' ? p1.x : p1.y, axis === 'x' ? p2.x : p2.y);
                        const wMax = Math.max(axis === 'x' ? p1.x : p1.y, axis === 'x' ? p2.x : p2.y);
                        if (wMin <= start + 2 && wMax >= end - 2) {
                            w.widgets.forEach(widget => {
                                const openW = Number(widget.width) || 60;
                                minLen = Math.max(minLen, openW + 20); // opening + clearances
                            });
                        }
                    });
                }

                spans.push({
                    start,
                    end,
                    length: spanLen,
                    minLen: Math.min(spanLen, minLen),
                    elasticity,
                    role
                });
            }
            return spans;
        };

        return {
            xLines,
            yLines,
            xSpans: buildSpans(xLines, 'x'),
            ySpans: buildSpans(yLines, 'y')
        };
    }
}

import { WallFactory } from '../../features/wall/wall.factory.js';
import { PremiumWall } from '../../features/wall/wall.renderer2d.js';
import { PremiumMolding } from './PremiumMolding.js';
import { SNAP_DIST } from '../registry.js';
import { WallTopologyEngine } from '../wall/WallTopologyEngine.js';

/**
 * WallReformer
 * 
 * Provides planar graph reformation for walls.
 * Delegates canonical topology and split/merge operations to WallTopologyEngine.
 */
export class WallReformer {
    /**
     * Compute intersection between segment AB and segment CD.
     */
    static getSegmentIntersection(A, B, C, D) {
        return WallTopologyEngine.getSegmentIntersection(A, B, C, D);
    }

    /**
     * Check if point P lies strictly on segment AB (within tolerance).
     */
    static isPointOnSegment(P, A, B, tolerance = 6.0) {
        return WallTopologyEngine.isPointOnSegment(P, A, B, tolerance);
    }

    /**
     * Check for collinear overlapping segments.
     */
    static getCollinearOverlapSplits(A, B, C, D, tolerance = 6.0) {
        return WallTopologyEngine.getCollinearOverlapSplits(A, B, C, D, tolerance);
    }

    /**
     * Reconstruct and reform all walls when a set of input segments is drawn.
     */
    static reformAndAddWallSegments(planner, inputSegments, wallType = 'outer', wallConfig = {}) {
        return WallTopologyEngine.reformAndAddWallSegments(planner, inputSegments, wallType, wallConfig);
    }

    /**
     * Splits an existing wall at splitPt (x, y) into two connected wall segments.
     */
    static splitWallAtPoint(planner, wall, splitPt) {
        return WallTopologyEngine.splitWall(planner, wall, splitPt);
    }

    /**
     * Finds collinear wall pairs sharing an anchor with degree 2, and merges them into a single continuous wall.
     */
    static mergeRedundantCollinearWalls(planner) {
        return WallTopologyEngine.mergeRedundantCollinearWalls(planner);
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
            const wStart = WallFactory.createWall(planner, {
                startAnchor: anc1,
                endAnchor: ancA,
                type: wall.type || 'outer',
                addToPlanner: false
            });
            copyProps(wStart);
            newWalls.push(wStart);
        }

        // 2. Return Wall 1 (ptA -> ptA_ext)
        const wReturn1 = WallFactory.createWall(planner, {
            startAnchor: ancA,
            endAnchor: ancA_ext,
            type: wall.type || 'outer',
            addToPlanner: false
        });
        copyProps(wReturn1);
        newWalls.push(wReturn1);

        // 3. Front Extruded Face (ptA_ext -> ptB_ext)
        const wFront = WallFactory.createWall(planner, {
            startAnchor: ancA_ext,
            endAnchor: ancB_ext,
            type: wall.type || 'outer',
            addToPlanner: false
        });
        copyProps(wFront);
        newWalls.push(wFront);

        // 4. Return Wall 2 (ptB_ext -> ptB)
        const wReturn2 = WallFactory.createWall(planner, {
            startAnchor: ancB_ext,
            endAnchor: ancB,
            type: wall.type || 'outer',
            addToPlanner: false
        });
        copyProps(wReturn2);
        newWalls.push(wReturn2);

        // 5. Ending segment (ptB -> p2) if tEnd < 0.95
        if (tEnd < 0.95) {
            const wEnd = WallFactory.createWall(planner, {
                startAnchor: ancB,
                endAnchor: anc2,
                type: wall.type || 'outer',
                addToPlanner: false
            });
            copyProps(wEnd);
            newWalls.push(wEnd);
        }

        // Transfer moldings along all new bay walls
        if (wall.attachedMoldings && wall.attachedMoldings.length > 0) {
            wall.attachedMoldings.forEach(mold => {
                const moldData = mold.serialize ? mold.serialize() : { ...mold };
                newWalls.forEach(nw => {
                    const nwp1 = nw.startAnchor.position();
                    const nwp2 = nw.endAnchor.position();
                    const nwLen = Math.hypot(nwp2.x - nwp1.x, nwp2.y - nwp1.y);
                    const nm = new PremiumMolding(planner, nw, 0.5, mold.type || 'molding_chair_rail');
                    Object.assign(nm, moldData);
                    nm.wall = nw;
                    nm.width = nwLen;
                    nm.t = 0.5;
                    if (!nw.attachedMoldings) nw.attachedMoldings = [];
                    nw.attachedMoldings.push(nm);
                    nm.update();
                });
                if (mold.destroy) mold.destroy();
            });
            wall.attachedMoldings = [];
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

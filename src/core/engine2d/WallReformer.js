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
        return WallTopologyEngine.extrudeWallSegment(planner, wall, tStart, tEnd, depth);
    }
}

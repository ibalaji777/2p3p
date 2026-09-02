import { WallTopologyEngine } from '../../core/wall/WallTopologyEngine.js';
import { WallEngine } from '../../core/wall/WallEngine.js';

/**
 * WallFactory
 * 
 * Centralized factory adapter for creating, modifying, and destroying wall entities.
 * Delegates directly to the canonical WallTopologyEngine and WallEngine.
 */
export class WallFactory {
    /**
     * Creates a single PremiumWall instance, properly configured and attached to anchors.
     * @param {Object} planner - The FloorPlanner instance.
     * @param {Object} options - Wall creation options.
     * @returns {Object} PremiumWall
     */
    static createWall(planner, options = {}) {
        return WallTopologyEngine.createWall(planner, options);
    }

    /**
     * Creates a 4-wall rectangular room box, sharing 4 corner anchors.
     * @param {Object} planner - The FloorPlanner instance.
     * @param {Object} bounds - { minX, minY, maxX, maxY, type, thickness, height, elevation, params }
     * @returns {Array<Object>}
     */
    static createRoomBox(planner, bounds = {}) {
        return WallTopologyEngine.createRoomBox(planner, bounds);
    }

    /**
     * Splits a wall at a given point into two connected wall segments.
     * @param {Object} planner - The FloorPlanner instance.
     * @param {Object} wall - The wall to split.
     * @param {Object} splitPoint - { x, y }
     * @returns {Array<Object>} [wall1, wall2]
     */
    static splitWall(planner, wall, splitPoint) {
        return WallTopologyEngine.splitWall(planner, wall, splitPoint);
    }

    /**
     * Merges two collinear adjacent walls sharing an anchor into one continuous wall.
     * @param {Object} planner 
     * @param {Object} wall1 
     * @param {Object} wall2 
     * @returns {Object|null}
     */
    static mergeWalls(planner, wall1, wall2) {
        return WallTopologyEngine.mergeWalls(planner, wall1, wall2);
    }

    /**
     * Safely destroys a wall and removes all its 2D/3D representations.
     * @param {Object} planner - The FloorPlanner instance.
     * @param {Object} wall - The wall to destroy.
     */
    static destroyWall(planner, wall) {
        return WallTopologyEngine.deleteWall(planner, wall);
    }
}

import { PremiumWall } from './wall.renderer2d.js';
import { WALL_REGISTRY } from './wall.registry.js';
import { WallReformer } from '../../core/engine2d/WallReformer.js';

/**
 * WallFactory
 * 
 * Centralized factory for creating, modifying, and destroying wall entities.
 * Eliminates duplicate new PremiumWall calls across the application.
 */
export class WallFactory {
    /**
     * Creates a single PremiumWall instance, properly configured and attached to anchors.
     * @param {Object} planner - The FloorPlanner instance.
     * @param {Object} options - Wall creation options.
     * @returns {PremiumWall}
     */
    static createWall(planner, options = {}) {
        let a1 = options.startAnchor;
        let a2 = options.endAnchor;

        if (!a1 && options.start && planner) {
            a1 = planner.getOrCreateAnchor(options.start.x, options.start.y);
        }
        if (!a2 && options.end && planner) {
            a2 = planner.getOrCreateAnchor(options.end.x, options.end.y);
        }

        const type = options.type || 'outer';
        const wall = new PremiumWall(planner, a1, a2, type);

        if (options.id) wall.id = options.id;
        if (options.thickness !== undefined) wall.thickness = Number(options.thickness);
        if (options.height !== undefined) wall.height = Number(options.height);
        if (options.elevation !== undefined) wall.elevation = Number(options.elevation);
        if (options.topProfileType) wall.topProfileType = options.topProfileType;
        if (options.startHeight !== undefined) wall.startHeight = Number(options.startHeight);
        if (options.endHeight !== undefined) wall.endHeight = Number(options.endHeight);
        if (options.peakHeight !== undefined) wall.peakHeight = Number(options.peakHeight);
        if (options.flipSlope !== undefined) wall.flipSlope = options.flipSlope;
        if (options.params) wall.params = { ...(wall.params || {}), ...options.params };

        if (options.addToPlanner !== false && planner && planner.walls) {
            planner.walls.push(wall);
            planner.lastDrawnEntity = wall;
            if (options.sync !== false && planner.syncAll) {
                planner.syncAll();
            }
        }

        return wall;
    }

    /**
     * Creates a 4-wall rectangular room box, sharing 4 corner anchors.
     * @param {Object} planner - The FloorPlanner instance.
     * @param {Object} bounds - { minX, minY, maxX, maxY, type, thickness, height, elevation, params }
     * @returns {Array<PremiumWall>}
     */
    static createRoomBox(planner, bounds = {}) {
        const { minX, minY, maxX, maxY, type = 'outer', height, thickness, elevation, params } = bounds;
        const width = maxX - minX;
        const depth = maxY - minY;

        if (width <= 0 || depth <= 0) return [];

        const roomSegments = [
            { p1: { minX, minY }, p2: { maxX, minY } }, // Top
            { p1: { maxX, minY }, p2: { maxX, maxY } }, // Right
            { p1: { maxX, maxY }, p2: { minX, maxY } }, // Bottom
            { p1: { minX, maxY }, p2: { minX, minY } }  // Left
        ].map(seg => ({
            p1: { x: seg.p1.minX !== undefined ? seg.p1.minX : seg.p1.maxX, y: seg.p1.minY !== undefined ? seg.p1.minY : seg.p1.maxY },
            p2: { x: seg.p2.minX !== undefined ? seg.p2.minX : seg.p2.maxX, y: seg.p2.minY !== undefined ? seg.p2.minY : seg.p2.maxY }
        }));

        return WallReformer.reformAndAddWallSegments(planner, roomSegments, type, {
            height: height || 120,
            thickness: thickness || 16,
            elevation: elevation !== undefined ? elevation : 0,
            params: params || planner?.activePresetParams
        });
    }

    /**
     * Splits a wall at a given point into two connected wall segments.
     * @param {Object} planner - The FloorPlanner instance.
     * @param {PremiumWall} wall - The wall to split.
     * @param {Object} splitPoint - { x, y }
     * @returns {Array<PremiumWall>} [wall1, wall2]
     */
    static splitWall(planner, wall, splitPoint) {
        if (!planner || !wall || !splitPoint) return [wall];

        const a1 = wall.startAnchor;
        const a2 = wall.endAnchor;
        const midAnchor = planner.getOrCreateAnchor(splitPoint.x, splitPoint.y);

        // Update existing wall to connect a1 -> midAnchor
        wall.endAnchor = midAnchor;
        if (a2.connectedWalls) {
            a2.connectedWalls = a2.connectedWalls.filter(w => w !== wall);
        }
        if (midAnchor.connectedWalls && !midAnchor.connectedWalls.includes(wall)) {
            midAnchor.connectedWalls.push(wall);
        }

        // Create second wall midAnchor -> a2
        const secondWall = new PremiumWall(planner, midAnchor, a2, wall.type);
        secondWall.thickness = wall.thickness;
        secondWall.height = wall.height;
        secondWall.elevation = wall.elevation;
        secondWall.params = JSON.parse(JSON.stringify(wall.params || {}));

        planner.walls.push(secondWall);
        planner.syncAll();

        return [wall, secondWall];
    }

    /**
     * Safely destroys a wall and removes all its 2D/3D representations.
     * @param {Object} planner - The FloorPlanner instance.
     * @param {PremiumWall} wall - The wall to destroy.
     */
    static destroyWall(planner, wall) {
        if (!wall) return;
        if (planner && planner.walls) {
            planner.walls = planner.walls.filter(w => w !== wall);
        }
        if (typeof wall.destroy === 'function') {
            wall.destroy();
        } else if (typeof wall.remove === 'function') {
            wall.remove();
        }
        if (planner && planner.syncAll) {
            planner.syncAll();
        }
    }
}

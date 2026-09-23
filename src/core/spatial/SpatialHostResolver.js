/**
 * src/core/spatial/SpatialHostResolver.js
 * 
 * Stateless Geometric Query Layer for Universal Host Detection.
 * 
 * Responsibilities:
 * - Detect candidate host platforms under an (x, y) point.
 * - Detect candidate walls for surface-attached entities (shapes, decor).
 * - Detect abutting support structures for staircases via StairHeightDetector.
 * - Compute local attachment transforms via SpatialDependencyEngine inverse kinematics.
 * 
 * Guarantees:
 * - 100% Stateless: Contains zero runtime cache or lifecycle state.
 * - Zero Side-Effects: Performs no mutations to planner, entities, or history.
 * - Pure Query API: Accepts current geometry coordinates and returns relational descriptor.
 */

import { RELATIONSHIP_TYPES, SpatialDependencyEngine } from './SpatialDependencyEngine.js';
import { StairHeightDetector } from '../../features/stairs/StairHeightDetector.js';

export class SpatialHostResolver {
    /**
     * Tests whether a 2D point (x, y) is inside a polygon.
     * Uses standard ray-casting / crossing-number algorithm.
     * 
     * @param {{ x: number, y: number }} pt 
     * @param {Array<{ x: number, y: number }>} vertices 
     * @returns {boolean}
     */
    static isPointInPolygon(pt, vertices) {
        if (!pt || !Array.isArray(vertices) || vertices.length < 3) return false;
        let inside = false;
        const n = vertices.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = vertices[i].x, yi = vertices[i].y;
            const xj = vertices[j].x, yj = vertices[j].y;

            const intersect = ((yi > pt.y) !== (yj > pt.y))
                && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Computes the 2D world-space polygon vertices of a platform.
     * 
     * @param {Object} platform 
     * @returns {Array<{ x: number, y: number }>}
     */
    static getPlatformWorldVertices(platform) {
        if (!platform) return [];

        const posX = platform.group && typeof platform.group.x === 'function' ? platform.group.x() : (Number(platform.x) || 0);
        const posY = platform.group && typeof platform.group.y === 'function' ? platform.group.y() : (Number(platform.y) || 0);
        const rotDeg = platform.group && typeof platform.group.rotation === 'function' ? platform.group.rotation() : (Number(platform.rotation) || 0);

        const rotRad = (rotDeg * Math.PI) / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);

        let localVertices = [];

        if (platform.shapeType === 'polygon' && platform.points && platform.points.length >= 3) {
            localVertices = platform.points.map(p => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 }));
        } else {
            const w = Number(platform.width) || 120;
            const d = Number(platform.depth) || 120;
            const hw = w / 2;
            const hd = d / 2;
            localVertices = [
                { x: -hw, y: -hd },
                { x: hw, y: -hd },
                { x: hw, y: hd },
                { x: -hw, y: hd }
            ];
        }

        return localVertices.map(v => ({
            x: posX + (v.x * cosR - v.y * sinR),
            y: posY + (v.x * sinR + v.y * cosR)
        }));
    }

    /**
     * Finds the topmost platform situated directly beneath the world coordinate (x, y).
     * 
     * @param {Object} planner 
     * @param {number} x 
     * @param {number} y 
     * @param {Object} [ignoreEntity=null] Optional entity to ignore
     * @returns {Object|null} Topmost platform entity or null
     */
    static findPlatformUnderPoint(planner, x, y, ignoreEntity = null) {
        if (!planner || !planner.platforms || planner.platforms.length === 0) return null;

        const pt = { x: Number(x) || 0, y: Number(y) || 0 };
        const matchingPlatforms = [];

        for (const platform of planner.platforms) {
            if (!platform || platform.isDeleted || platform.isHidden || platform === ignoreEntity) continue;

            const worldVertices = this.getPlatformWorldVertices(platform);
            if (this.isPointInPolygon(pt, worldVertices)) {
                const elev = Number(platform.elevation) || 0;
                const h = Number(platform.height) || 20;
                matchingPlatforms.push({
                    platform,
                    topElevation: elev + h
                });
            }
        }

        if (matchingPlatforms.length === 0) return null;

        // Sort descending: highest surface takes precedence
        matchingPlatforms.sort((a, b) => b.topElevation - a.topElevation);
        return matchingPlatforms[0].platform;
    }

    /**
     * Finds the closest wall within maxDistance of a 2D world coordinate.
     * 
     * @param {Object} planner 
     * @param {number} x 
     * @param {number} y 
     * @param {number} [maxDistance=40] 
     * @returns {{ wall: Object, distance: number, projection: {x: number, y: number}, t: number, normal: {x: number, y: number} }|null}
     */
    static findWallNearPoint(planner, x, y, maxDistance = 40) {
        if (!planner || !planner.walls || planner.walls.length === 0) return null;

        const pt = { x: Number(x) || 0, y: Number(y) || 0 };
        let bestCandidate = null;
        let minDist = maxDistance;

        for (const wall of planner.walls) {
            if (!wall || wall.isDeleted || wall.hidden) continue;

            const p1 = wall.startAnchor ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
            const p2 = wall.endAnchor ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq < 1e-4) continue;

            const len = Math.sqrt(lenSq);
            let t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));

            const projX = p1.x + t * dx;
            const projY = p1.y + t * dy;
            const dist = Math.hypot(pt.x - projX, pt.y - projY);

            const halfThick = (Number(wall.thickness) || 15) / 2;
            const surfaceDist = Math.max(0, dist - halfThick);

            if (surfaceDist < minDist) {
                minDist = surfaceDist;

                // Outward normal (-dy, dx) normalized
                let nx = -dy / len;
                let ny = dx / len;
                // Face classification towards point
                if ((pt.x - projX) * nx + (pt.y - projY) * ny < 0) {
                    nx = -nx;
                    ny = -ny;
                }

                bestCandidate = {
                    wall,
                    distance: surfaceDist,
                    projection: { x: projX, y: projY },
                    t,
                    normal: { x: nx, y: ny }
                };
            }
        }

        return bestCandidate;
    }

    /**
     * Universal Host Query.
     * Evaluates current world coordinates and returns relationship descriptor.
     * 
     * @param {Object} planner 
     * @param {number} x 
     * @param {number} y 
     * @param {string} entityType - 'furniture' | 'stair' | 'shape' | 'surface_attached'
     * @param {Object} [options={}] - { elevation, rotation, preset, ignoreEntity }
     * @returns {Object|null} Host relationship descriptor or null
     */
    static findHostAt(planner, x, y, entityType = 'furniture', options = {}) {
        if (!planner) return null;

        const elev = Number(options.elevation) || 0;
        const rot = Number(options.rotation) || 0;

        // ─────────────────────────────────────────────────────────────────────────
        // 1. STAIR HOST RESOLUTION (Abutting Platform / Upper Level)
        // ─────────────────────────────────────────────────────────────────────────
        if (entityType === 'stair' || (entityType && entityType.includes('stair'))) {
            const detection = StairHeightDetector.detect({
                x,
                z: y, // StairHeightDetector uses 3D coordinates (z is 2D y)
                elevation: elev,
                rotation: rot,
                preset: options.preset || {},
                planner,
                isCenterAnchored: options.isCenterAnchored ?? true
            });

            if (detection && detection.hasTarget && detection.targetSource) {
                const host = detection.targetSource;
                const hostType = detection.targetType || 'platform';
                const hostTransform = SpatialDependencyEngine.getEntityTransform(host);

                const stairWorld = {
                    x: detection.snappedPos?.x ?? x,
                    y: detection.snappedPos?.z ?? y,
                    elevation: elev,
                    rotation: detection.snappedRotation ?? rot
                };

                const localTransform = SpatialDependencyEngine.computeLocalTransform(stairWorld, hostTransform);
                const relationshipType = hostType === 'wall' ? RELATIONSHIP_TYPES.SURFACE_ATTACHED : RELATIONSHIP_TYPES.SUPPORTED;

                return {
                    host,
                    hostId: host.id,
                    hostType,
                    relationshipType,
                    localTransform,
                    detection
                };
            }
            return null;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // 2. PLATFORM RESTING SURFACE (Furniture, Shapes, GLBs on Platform)
        // Highest priority: If situated over a platform, platform is primary host
        // ─────────────────────────────────────────────────────────────────────────
        const platform = this.findPlatformUnderPoint(planner, x, y, options.ignoreEntity);
        if (platform) {
            const pElev = Number(platform.elevation) || 0;
            const pH = Number(platform.height) || 20;
            const surfaceElev = pElev + pH;

            const hostTransform = SpatialDependencyEngine.getEntityTransform(platform);

            const worldTransform = {
                x,
                y,
                elevation: surfaceElev,
                rotation: rot
            };

            const localTransform = SpatialDependencyEngine.computeLocalTransform(worldTransform, hostTransform);

            return {
                host: platform,
                hostId: platform.id,
                hostType: 'platform',
                relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
                localTransform,
                surfaceElevation: surfaceElev
            };
        }

        // ─────────────────────────────────────────────────────────────────────────
        // 3. WALL SURFACE-ATTACHED RESOLUTION (Furniture, Shapes, GLBs, Decor, etc.)
        // If not on a platform, check if abutting or within snap distance of a wall
        // ─────────────────────────────────────────────────────────────────────────
        const isWallAttachable = entityType === 'shape' || entityType === 'surface_attached' ||
            entityType === 'furniture' || (typeof entityType === 'string' && entityType.startsWith('shape_')) ||
            entityType === 'glb' || entityType === 'model' || entityType === 'decor' || entityType === 'fixture' ||
            entityType === 'custom_entity' || entityType === 'custom';

        if (isWallAttachable) {
            const snapDist = options.snapDist || 40;
            const wallCandidate = this.findWallNearPoint(planner, x, y, snapDist);
            if (wallCandidate) {
                const wall = wallCandidate.wall;
                const hostTransform = SpatialDependencyEngine.getEntityTransform(wall);

                const worldTransform = {
                    x,
                    y,
                    elevation: elev,
                    rotation: rot
                };

                const localTransform = SpatialDependencyEngine.computeLocalTransform(worldTransform, hostTransform);

                return {
                    host: wall,
                    hostId: wall.id,
                    hostType: 'wall',
                    relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
                    localTransform,
                    wallCandidate
                };
            }
        }

        return null;
    }
}

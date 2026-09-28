/**
 * StairHeightDetector.js
 * 
 * Architectural & Sims 4-Style Real-Time Staircase Height Auto-Detection Engine.
 * 
 * Automatically detects target structures (platforms, walls, upper levels, split landings)
 * when a staircase is moved or dragged in the 3D scene, and computes ergonomic IRC/IBC
 * step counts, riser heights, flight lengths, and edge alignment snapping.
 */

import { WALL_HEIGHT } from '../../core/registry.js';
import { StairGeometryEngine } from '../../core/stairs/StairGeometryEngine.js';

export const STAIR_PROXIMITY_CONFIG = {
    PLATFORM_PROXIMITY: 140, // cm threshold to detect a platform
    WALL_PROXIMITY: 110,     // cm threshold to detect a wall
    EDGE_SNAP_DISTANCE: 40,  // cm threshold to snap flush to an edge
    TARGET_RISER_HEIGHT: 17.5, // Standard IBC/IRC residential riser height (cm)
    MIN_RISER_HEIGHT: 14.0,
    MAX_RISER_HEIGHT: 20.0,
    DEFAULT_STORY_HEIGHT: 300 // cm fallback story height
};

export class StairHeightDetector {
    /**
     * Detects nearby candidate structures and computes the optimal staircase configuration.
     * 
     * @param {Object} options
     * @param {number} options.x - World X position (center or base)
     * @param {number} options.z - World Z position (in 3D coordinates, where Z is 2D Y)
     * @param {number} [options.elevation=0] - Current base elevation of the staircase
     * @param {number} [options.rotation=0] - Staircase rotation in degrees
     * @param {Object} [options.preset={}] - Staircase preset parameters (width, stepDepth, shape, etc.)
     * @param {Object} options.planner - Canonical planner store containing walls, platforms, levels, rooms
     * @param {boolean} [options.isCenterAnchored=true] - True if (x, z) represents bounding center
     * @returns {Object} Detection result
     */
    static detect({
        x = 0,
        z = 0,
        elevation = 0,
        rotation = 0,
        preset = {},
        planner = null,
        isCenterAnchored = true
    } = {}) {
        if (!planner) {
            return this.getDefaultResult(preset, elevation, STAIR_PROXIMITY_CONFIG.DEFAULT_STORY_HEIGHT);
        }

        const shape = (preset.shape || (preset.type ? preset.type.replace('stair_v5_', '') : 'straight')).toString();
        const stepDepth = Number(preset.stepDepth) || 28;
        const width = Number(preset.width) || 100;
        const currentSteps = Number(preset.totalSteps) || 12;
        const approxLength = currentSteps * stepDepth;

        // Compute key reference points in 3D world space
        const rotRad = -rotation * Math.PI / 180;
        const fwdX = Math.sin(rotRad);
        const fwdZ = Math.cos(rotRad);

        let centerWorld = { x, z };
        let topWorld = { x, z };
        let baseWorld = { x, z };

        if (isCenterAnchored) {
            centerWorld = { x, z };
            topWorld = {
                x: x + fwdX * (approxLength * 0.5),
                z: z + fwdZ * (approxLength * 0.5)
            };
            baseWorld = {
                x: x - fwdX * (approxLength * 0.5),
                z: z - fwdZ * (approxLength * 0.5)
            };
        } else {
            baseWorld = { x, z };
            topWorld = {
                x: x + fwdX * approxLength,
                z: z + fwdZ * approxLength
            };
            centerWorld = {
                x: x + fwdX * (approxLength * 0.5),
                z: z + fwdZ * (approxLength * 0.5)
            };
        }

        const candidates = [];

        // ─────────────────────────────────────────────────────────────────────────────
        // 1. SCAN PLATFORMS (Highest priority in Sims 4 Build Mode)
        // ─────────────────────────────────────────────────────────────────────────────
        const platforms = planner.platforms || [];
        for (const platform of platforms) {
            if (!platform || platform.isDeleted || platform.isHidden) continue;

            const pElev = Number(platform.elevation) || 0;
            const pH = Number(platform.height) || 20;
            const pTop = pElev + pH;

            // Height difference from staircase base
            const deltaH = pTop - elevation;
            if (deltaH <= 4) continue; // Ignore if platform is at or below stair base

            const edges = this.getPlatformWorldEdges(platform);
            if (!edges || edges.length === 0) continue;

            // Find nearest edge to staircase top or center
            let closestEdge = null;
            let minDistance = Infinity;
            let closestPoint = null;

            for (const edge of edges) {
                // Test both topWorld (top landing) and centerWorld
                const dTop = this.pointToSegmentDistance(topWorld, edge.p1, edge.p2);
                const dCenter = this.pointToSegmentDistance(centerWorld, edge.p1, edge.p2);
                const dist = Math.min(dTop.distance, dCenter.distance);

                if (dist < minDistance) {
                    minDistance = dist;
                    closestEdge = edge;
                    closestPoint = dTop.distance <= dCenter.distance ? dTop.point : dCenter.point;
                }
            }

            if (closestEdge && minDistance <= STAIR_PROXIMITY_CONFIG.PLATFORM_PROXIMITY) {
                candidates.push({
                    type: 'platform',
                    name: platform.name || 'Platform',
                    height: deltaH,
                    targetElevation: pTop,
                    distance: minDistance,
                    edge: closestEdge,
                    closestPoint,
                    source: platform,
                    priority: 100 - minDistance // Closer has higher priority
                });
            }
        }

        // ─────────────────────────────────────────────────────────────────────────────
        // 2. SCAN WALLS (Half-walls, parapets, custom height walls)
        // ─────────────────────────────────────────────────────────────────────────────
        const walls = planner.walls || [];
        for (const wall of walls) {
            if (!wall || wall.isUnderStairWall || wall.isDeleted || wall.isHidden) continue;

            const p1 = wall.startAnchor ? (typeof wall.startAnchor.position === 'function' ? wall.startAnchor.position() : wall.startAnchor) : { x: Number(wall.startX) || 0, y: Number(wall.startY) || 0 };
            const p2 = wall.endAnchor ? (typeof wall.endAnchor.position === 'function' ? wall.endAnchor.position() : wall.endAnchor) : { x: Number(wall.endX) || 0, y: Number(wall.endY) || 0 };

            // In 2D, coordinates are (x, y) where y maps to 3D Z
            const segP1 = { x: p1.x, z: p1.y };
            const segP2 = { x: p2.x, z: p2.y };

            const wallH = Number(wall.height !== undefined ? wall.height : (wall.config?.height || WALL_HEIGHT));
            const wallElev = Number(wall.elevation) || 0;
            const wallTop = wallElev + wallH;
            const deltaH = wallTop - elevation;

            if (deltaH <= 4) continue;

            const wallThick = wall.thickness !== undefined ? Number(wall.thickness) : 15;
            const faceOffset = wallThick * 0.5;

            // Unit wall vector & normal
            const wdx = segP2.x - segP1.x;
            const wdz = segP2.z - segP1.z;
            const wLen = Math.hypot(wdx, wdz);
            let wnx = 0, wnz = 1;
            if (wLen > 0.001) {
                wnx = -wdz / wLen;
                wnz = wdx / wLen;
            }

            const dCenter = this.pointToSegmentDistance(centerWorld, segP1, segP2);
            // Orient normal towards stair center
            const toCenterX = centerWorld.x - dCenter.point.x;
            const toCenterZ = centerWorld.z - dCenter.point.z;
            if (toCenterX * wnx + toCenterZ * wnz < 0) {
                wnx = -wnx;
                wnz = -wnz;
            }

            // Determine if stair orientation is parallel or perpendicular to wall
            const dotFwdNormal = Math.abs(fwdX * wnx + fwdZ * wnz);
            const dotRtNormal = Math.abs(-fwdZ * wnx + fwdX * wnz);
            const isParallel = dotRtNormal > dotFwdNormal;
            const stairHalfExtent = isParallel ? (width * 0.5) : (approxLength * 0.5);

            // True surface-to-face gap
            const surfaceGap = Math.max(0, dCenter.distance - (faceOffset + stairHalfExtent));
            const dTop = this.pointToSegmentDistance(topWorld, segP1, segP2);
            const dist = Math.min(dTop.distance, dCenter.distance, surfaceGap);

            if (dist <= STAIR_PROXIMITY_CONFIG.WALL_PROXIMITY) {
                const wallTypeLabel = wallH < 150 ? 'Half Wall' : (wallH < 250 ? 'Low Wall' : 'Wall');
                candidates.push({
                    type: 'wall',
                    name: wallTypeLabel,
                    height: deltaH,
                    targetElevation: wallTop,
                    distance: surfaceGap, // Used for edge snap proximity
                    rawCenterDist: dCenter.distance,
                    edge: { p1: segP1, p2: segP2 },
                    closestPoint: dCenter.point,
                    source: wall,
                    priority: 50 - surfaceGap
                });
            }
        }

        // ─────────────────────────────────────────────────────────────────────────────
        // 3. SCAN MULTI-LEVEL / UPPER FLOOR DIFFERENCE
        // ─────────────────────────────────────────────────────────────────────────────
        const activeIdx = planner.activeLevelIndex || 0;
        const levels = planner.levels || [];
        if (levels.length > activeIdx + 1) {
            const nextLevel = levels[activeIdx + 1];
            const nextElev = Number(nextLevel.elevation) || (elevation + STAIR_PROXIMITY_CONFIG.DEFAULT_STORY_HEIGHT);
            const storyDeltaH = nextElev - elevation;
            if (storyDeltaH > 10) {
                candidates.push({
                    type: 'upper_floor',
                    name: nextLevel.name || 'Upper Floor',
                    height: storyDeltaH,
                    targetElevation: nextElev,
                    distance: Infinity,
                    priority: 10
                });
            }
        }

        // ─────────────────────────────────────────────────────────────────────────────
        // 4. SELECT THE BEST CANDIDATE
        // ─────────────────────────────────────────────────────────────────────────────
        if (candidates.length > 0) {
            // Sort by priority descending
            candidates.sort((a, b) => b.priority - a.priority);
            const best = candidates[0];

            // If the best candidate is within proximity, calculate optimal steps
            if (best.distance <= STAIR_PROXIMITY_CONFIG.PLATFORM_PROXIMITY) {
                return this.buildResult(best, shape, stepDepth, width, elevation, centerWorld, rotRad, fwdX, fwdZ);
            }
        }

        // ─────────────────────────────────────────────────────────────────────────────
        // 5. DEFAULT STORY / ROOM WALL HEIGHT FALLBACK
        // ─────────────────────────────────────────────────────────────────────────────
        let defaultH = STAIR_PROXIMITY_CONFIG.DEFAULT_STORY_HEIGHT;
        const mainWalls = walls.filter(w => !w.isUnderStairWall && w.type !== 'railing');
        if (mainWalls.length > 0) {
            defaultH = Math.max(...mainWalls.map(w => w.height !== undefined ? Number(w.height) : (Number(w.config?.height) || STAIR_PROXIMITY_CONFIG.DEFAULT_STORY_HEIGHT)));
        }

        return this.getDefaultResult(preset, elevation, defaultH);
    }

    /**
     * Builds the complete detection result object.
     */
    static buildResult(candidate, shape, stepDepth, width, elevation, centerWorld, rotRad, fwdX, fwdZ) {
        const targetHeight = Math.round(candidate.height * 10) / 10;
        const optimal = this.calculateOptimalSteps(targetHeight, shape);

        const flightLength = optimal.totalSteps * stepDepth;

        // Snapping logic if close to edge
        let snappedPos = null;
        let snappedRotation = null;
        const isNearEdge = candidate.distance <= STAIR_PROXIMITY_CONFIG.EDGE_SNAP_DISTANCE;

        if (isNearEdge && candidate.edge && candidate.closestPoint) {
            const p1 = candidate.edge.p1;
            const p2 = candidate.edge.p2;
            const dx = p2.x - p1.x;
            const dz = p2.z - p1.z;
            const edgeLen = Math.hypot(dx, dz);

            if (edgeLen > 1) {
                // Unit edge vector and outward normal
                const ux = dx / edgeLen;
                const uz = dz / edgeLen;
                let nx = -uz;
                let nz = ux;

                // Determine normal direction pointing towards the staircase center
                const toCenterX = centerWorld.x - candidate.closestPoint.x;
                const toCenterZ = centerWorld.z - candidate.closestPoint.z;
                if (toCenterX * nx + toCenterZ * nz < 0) {
                    nx = -nx;
                    nz = -nz;
                }

                // Check wall face offset
                const wallThick = candidate.source?.thickness !== undefined ? Number(candidate.source.thickness) : (candidate.type === 'wall' ? 15 : 0);
                const faceOffset = candidate.type === 'wall' ? (wallThick * 0.5) : 0;

                // Orientation alignment:
                // Check if staircase orientation is parallel or perpendicular to edge
                // fwd = (fwdX, fwdZ), right = (-fwdZ, fwdX)
                const dotFwdNormal = Math.abs(fwdX * nx + fwdZ * nz);
                const dotRtNormal = Math.abs(-fwdZ * nx + fwdX * nz);

                let halfExtent;
                let halfExtentParallel;
                if (candidate.type === 'wall' && dotRtNormal > dotFwdNormal) {
                    // Parallel to wall: side of stair sits flush against wall face
                    halfExtent = width * 0.5;
                    halfExtentParallel = flightLength * 0.5;
                    snappedRotation = null; // Keep current rotation
                } else {
                    // Perpendicular to edge (platform landing or stair facing wall)
                    halfExtent = flightLength * 0.5;
                    halfExtentParallel = width * 0.5;
                    const alignRad = Math.atan2(-nx, -nz);
                    const alignDeg = Math.round(((alignRad * 180 / Math.PI) + 360) % 360);
                    snappedRotation = Math.round(alignDeg / 90) * 90 % 360;
                }

                // Clamp contact point along wall tangent to prevent overhanging wall corners
                let t = (centerWorld.x - p1.x) * ux + (centerWorld.z - p1.z) * uz;
                if (edgeLen > 2 * halfExtentParallel) {
                    t = Math.max(halfExtentParallel, Math.min(edgeLen - halfExtentParallel, t));
                } else {
                    t = Math.max(0, Math.min(edgeLen, t));
                }
                const clampedPoint = {
                    x: p1.x + t * ux,
                    z: p1.z + t * uz
                };

                const requiredOffset = faceOffset + halfExtent;

                snappedPos = {
                    x: Math.round(clampedPoint.x + nx * requiredOffset),
                    z: Math.round(clampedPoint.z + nz * requiredOffset)
                };
            }
        }

        return {
            hasTarget: true,
            targetType: candidate.type,
            targetName: candidate.name,
            detectedHeight: targetHeight,
            optimalSteps: optimal.totalSteps,
            flight1Steps: optimal.flight1Steps,
            flight2Steps: optimal.flight2Steps,
            stepHeight: optimal.stepHeight,
            flightLength,
            distance: candidate.distance,
            targetEdge: candidate.edge || null,
            targetSource: candidate.source || null,
            snappedPos,
            snappedRotation,
            description: `${candidate.name} Snap: ${Math.round(targetHeight * 10)} mm (${optimal.totalSteps} steps)`
        };
    }

    /**
     * Fallback standard result when not near any target.
     */
    static getDefaultResult(preset, elevation, defaultHeight = 300) {
        const shape = (preset.shape || (preset.type ? preset.type.replace('stair_v5_', '') : 'straight')).toString();
        const stepDepth = Number(preset.stepDepth) || 28;
        const targetHeight = (preset.height !== undefined && Number(preset.height) > 0) ? Number(preset.height) : defaultHeight;
        const optimal = this.calculateOptimalSteps(targetHeight, shape);

        return {
            hasTarget: false,
            targetType: 'default',
            targetName: 'Floor-to-Floor',
            targetSource: null,
            detectedHeight: targetHeight,
            optimalSteps: optimal.totalSteps,
            flight1Steps: optimal.flight1Steps,
            flight2Steps: optimal.flight2Steps,
            stepHeight: optimal.stepHeight,
            flightLength: optimal.totalSteps * stepDepth,
            distance: Infinity,
            targetEdge: null,
            snappedPos: null,
            snappedRotation: null,
            description: `Standard: ${Math.round(targetHeight * 10)} mm (${optimal.totalSteps} steps)`
        };
    }

    /**
     * Computes the ergonomic IRC/IBC step count and riser height for a given height.
     * Standard residential stair rise: ~17.5 cm (clamped between 14cm and 20cm).
     */
    static calculateOptimalSteps(height, shape = 'straight') {
        return StairGeometryEngine.calculateOptimalSteps(height, shape);
    }

    /**
     * Computes the 2D world edges of a platform (supporting rectangle and polygon shapes).
     */
    static getPlatformWorldEdges(platform) {
        const posX = platform.group && typeof platform.group.x === 'function' ? platform.group.x() : (Number(platform.x) || 0);
        const posZ = platform.group && typeof platform.group.y === 'function' ? platform.group.y() : (Number(platform.y) || 0);
        const rotDeg = platform.group && typeof platform.group.rotation === 'function' ? platform.group.rotation() : (Number(platform.rotation) || 0);
        const rotRad = -rotDeg * Math.PI / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);

        let localVertices = [];

        if (platform.shapeType === 'polygon' && platform.points && platform.points.length >= 3) {
            localVertices = platform.points.map(p => ({ x: Number(p.x) || 0, z: Number(p.y) || 0 }));
        } else {
            // Rectangular platform
            const w = Number(platform.width) || 120;
            const d = Number(platform.depth) || 120;
            const hw = w / 2;
            const hd = d / 2;
            localVertices = [
                { x: -hw, z: -hd },
                { x: hw, z: -hd },
                { x: hw, z: hd },
                { x: -hw, z: hd }
            ];
        }

        // Transform local vertices to 3D world space (where 2D Y is 3D Z)
        const worldVertices = localVertices.map(v => ({
            x: posX + (v.x * cosR - v.z * sinR),
            z: posZ + (v.x * sinR + v.z * cosR)
        }));

        // Generate line segment edges
        const edges = [];
        for (let i = 0; i < worldVertices.length; i++) {
            const p1 = worldVertices[i];
            const p2 = worldVertices[(i + 1) % worldVertices.length];
            edges.push({ p1, p2 });
        }

        return edges;
    }

    /**
     * Calculates distance from a point to a finite 2D line segment.
     */
    static pointToSegmentDistance(p, a, b) {
        const abX = b.x - a.x;
        const abZ = b.z - a.z;
        const lenSq = abX * abX + abZ * abZ;

        if (lenSq === 0) {
            const dist = Math.hypot(p.x - a.x, p.z - a.z);
            return { distance: dist, point: { x: a.x, z: a.z } };
        }

        let t = ((p.x - a.x) * abX + (p.z - a.z) * abZ) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const projX = a.x + t * abX;
        const projZ = a.z + t * abZ;
        const dist = Math.hypot(p.x - projX, p.z - projZ);

        return {
            distance: dist,
            point: { x: projX, z: projZ }
        };
    }

    /**
     * Dynamically recalculates staircase steps and riser heights for a new target height.
     * @param {Object} stair 
     * @param {number} targetHeight 
     * @returns {boolean} True if modified
     */
    static recalculateStairForHeight(stair, targetHeight) {
        if (!stair || targetHeight <= 0) return false;
        const optimal = this.calculateOptimalSteps(targetHeight, stair.shape || 'straight');
        stair.totalSteps = optimal.totalSteps;
        stair.stepHeight = optimal.stepHeight;
        if (optimal.flight1Steps !== undefined) stair.flight1Steps = optimal.flight1Steps;
        if (optimal.flight2Steps !== undefined) stair.flight2Steps = optimal.flight2Steps;
        if (stair.update) stair.update();
        return true;
    }
}


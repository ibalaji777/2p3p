import * as THREE from 'three';
import { FACADE_RIBBON_MATERIALS } from '../facade/facadeRibbon.registry.js';
import { renderElevationSegment2D, syncElevationSegments2D, computeElevationSegment2DFootprint, computeElevationSegmentSpotlights2D } from './elevationSegment.renderer2d.js';

export { renderElevationSegment2D, syncElevationSegments2D, computeElevationSegment2DFootprint, computeElevationSegmentSpotlights2D };

export const ELEVATION_SEGMENT_MATERIALS = {
    ...FACADE_RIBBON_MATERIALS
};

export const ELEVATION_SEGMENT_CONFIG = {
    id: 'elevation_segment',
    label: 'Elevation Segment',
    description: 'Start with a straight elevation segment on a wall. Drag endpoints to extend, or use ↑/↓ sprout arrows to bend into L, U, Z, and branched facade shapes.',
    render2D: renderElevationSegment2D,
    defaultParams: {
        width: 30,             // Cross-section beam drop / thickness (cm)
        depth: 40,             // Cantilever overhang / projection from wall (cm)
        length: 180,           // Initial straight segment length (cm)
        material: 'wood',      // Default architectural material
        hasSpotlights: false,  // Under-soffit recessed downlights (opt-in)
        spotlightSpacing: 80,  // Spacing between spotlights (cm)
        defaultSproutDist: 120 // Default arm length when sprouting (cm)
    }
};

/**
 * Creates a brand new authoritative Elevation Segment entity attached to a host wall.
 */
export function createStarterElevationSegment(wall, localHitX, hitY, facing = 1, options = {}) {
    const width = options.width || ELEVATION_SEGMENT_CONFIG.defaultParams.width;
    const depth = options.depth || ELEVATION_SEGMENT_CONFIG.defaultParams.depth;
    const initialLen = options.length || ELEVATION_SEGMENT_CONFIG.defaultParams.length;
    const material = options.material || ELEVATION_SEGMENT_CONFIG.defaultParams.material;
    const hasSpotlights = options.hasSpotlights === true;
    const spotlightSpacing = options.spotlightSpacing || ELEVATION_SEGMENT_CONFIG.defaultParams.spotlightSpacing;

    // Get wall baseline points
    const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
    const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });

    const dx = p2.x - p1.x;
    const dz = p2.y - p1.y;
    const wallLen = Math.hypot(dx, dz) || 1;
    const dirX = dx / wallLen;
    const dirZ = dz / wallLen;

    // Outward wall normal vector (facing +1 is front (+90 deg), facing -1 is back (-90 deg))
    const normX = -dirZ * facing;
    const normZ = dirX * facing;

    const wallThick = wall.thickness || 20;
    // Surface offset from wall center: half thickness + 3mm clearance to prevent coplanar Z-fighting
    const surfaceOffset = (wallThick / 2) + 0.3;

    // Clamp initial segment within wall bounds
    const halfLen = Math.min(initialLen / 2, wallLen * 0.4);
    const centerX = Math.max(halfLen, Math.min(wallLen - halfLen, localHitX || wallLen / 2));

    const uStart = centerX - halfLen;
    const uEnd = centerX + halfLen;

    // Calculate 3D coordinates sitting flush on the wall face
    const startPt = {
        x: Math.round(p1.x + dirX * uStart + normX * surfaceOffset),
        y: Math.round(hitY || 150),
        z: Math.round(p1.y + dirZ * uStart + normZ * surfaceOffset),
        normal: { x: normX, y: 0, z: normZ },
        cornerStyle: 'sharp',
        radius: 0
    };

    const endPt = {
        x: Math.round(p1.x + dirX * uEnd + normX * surfaceOffset),
        y: Math.round(hitY || 150),
        z: Math.round(p1.y + dirZ * uEnd + normZ * surfaceOffset),
        normal: { x: normX, y: 0, z: normZ },
        cornerStyle: 'sharp',
        radius: 0
    };

    const id = 'elevation_segment_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);

    return {
        id,
        type: 'elevation_segment',
        wallId: wall.id || null,
        wallFacing: facing,
        width,
        depth,
        material,
        hasSpotlights,
        spotlightSpacing,
        // Authoritative points list for sweeping
        points: [startPt, endPt],
        // Explicit node definitions for UI and graph manipulations
        nodes: [
            { id: `${id}_n0`, ...startPt },
            { id: `${id}_n1`, ...endPt }
        ],
        segments: [
            { id: `${id}_s0`, startNodeId: `${id}_n0`, endNodeId: `${id}_n1` }
        ],
        branches: []
    };
}

/**
 * Sprouts a new connected segment from an existing endpoint, creating a bend at the junction.
 */
export function sproutBendAtEndpoint(entity, nodeIndex, direction, distance = 120) {
    if (!entity || !entity.points || entity.points.length < 2) return null;

    const n = entity.points.length;
    if (nodeIndex !== 0 && nodeIndex !== n - 1) {
        // Sprouting from interior node is a T-branch!
        return sproutBranchFromNode(entity, nodeIndex, direction, distance);
    }

    const isStart = (nodeIndex === 0);
    const targetPt = entity.points[nodeIndex];
    const neighborPt = isStart ? entity.points[1] : entity.points[n - 2];

    const currentDir = new THREE.Vector3(
        targetPt.x - neighborPt.x,
        targetPt.y - neighborPt.y,
        targetPt.z - neighborPt.z
    ).normalize();

    const normal = targetPt.normal ? new THREE.Vector3(targetPt.normal.x, targetPt.normal.y, targetPt.normal.z) : new THREE.Vector3(0, 0, 1);

    // Compute new segment direction based on chosen sprout direction
    let sproutVec = new THREE.Vector3(0, 1, 0); // Default UP

    if (direction === 'up') {
        sproutVec.set(0, 1, 0);
    } else if (direction === 'down') {
        sproutVec.set(0, -1, 0);
    } else if (direction === 'forward') {
        sproutVec.copy(currentDir);
    } else if (direction === 'left' || direction === 'right') {
        // Perpendicular vector along wall plane
        const up = new THREE.Vector3(0, 1, 0);
        const wallTangent = up.clone().cross(normal).normalize();
        if (direction === 'left') {
            sproutVec.copy(wallTangent).negate();
        } else {
            sproutVec.copy(wallTangent);
        }
    }

    const newPt = {
        x: Math.round(targetPt.x + sproutVec.x * distance),
        y: Math.round(targetPt.y + sproutVec.y * distance),
        z: Math.round(targetPt.z + sproutVec.z * distance),
        normal: { x: normal.x, y: normal.y, z: normal.z },
        cornerStyle: 'sharp',
        radius: 0
    };

    // The current endpoint now becomes an internal bend node
    targetPt.cornerStyle = targetPt.cornerStyle || 'sharp';
    targetPt.radius = targetPt.radius || 0;

    const newNodeId = `${entity.id}_n${Date.now()}`;
    const newSegId = `${entity.id}_s${Date.now()}`;

    if (isStart) {
        entity.points.unshift(newPt);
        if (entity.nodes) {
            entity.nodes.unshift({ id: newNodeId, ...newPt });
        }
        if (entity.segments) {
            entity.segments.unshift({
                id: newSegId,
                startNodeId: newNodeId,
                endNodeId: entity.nodes[1].id
            });
        }
    } else {
        entity.points.push(newPt);
        if (entity.nodes) {
            entity.nodes.push({ id: newNodeId, ...newPt });
        }
        if (entity.segments) {
            entity.segments.push({
                id: newSegId,
                startNodeId: entity.nodes[entity.nodes.length - 2].id,
                endNodeId: newNodeId
            });
        }
    }

    return {
        newNode: newPt,
        bendNode: targetPt,
        entity
    };
}

/**
 * Sprouts a T-branch from any interior node of the elevation assembly.
 */
export function sproutBranchFromNode(entity, nodeIndex, direction, distance = 100) {
    if (!entity || !entity.points || nodeIndex < 0 || nodeIndex >= entity.points.length) return null;

    const rootPt = entity.points[nodeIndex];
    const normal = rootPt.normal ? new THREE.Vector3(rootPt.normal.x, rootPt.normal.y, rootPt.normal.z) : new THREE.Vector3(0, 0, 1);

    let sproutVec = new THREE.Vector3(0, 1, 0);
    if (direction === 'up') sproutVec.set(0, 1, 0);
    else if (direction === 'down') sproutVec.set(0, -1, 0);
    else if (direction === 'left' || direction === 'right') {
        const wallTangent = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
        sproutVec = (direction === 'left') ? wallTangent.negate() : wallTangent;
    }

    const branchEndPt = {
        x: Math.round(rootPt.x + sproutVec.x * distance),
        y: Math.round(rootPt.y + sproutVec.y * distance),
        z: Math.round(rootPt.z + sproutVec.z * distance),
        normal: { x: normal.x, y: normal.y, z: normal.z },
        cornerStyle: 'sharp',
        radius: 0
    };

    if (!entity.branches) entity.branches = [];

    const branch = {
        id: `${entity.id}_branch_${Date.now()}`,
        fromNodeIndex: nodeIndex,
        points: [
            { x: rootPt.x, y: rootPt.y, z: rootPt.z, normal: rootPt.normal },
            branchEndPt
        ]
    };

    entity.branches.push(branch);
    return branch;
}

/**
 * Updates corner style and fillet radius for a specific bend node.
 */
export function setNodeCornerStyle(entity, nodeIndex, cornerStyle, radius = 25) {
    if (!entity || !entity.points || nodeIndex < 0 || nodeIndex >= entity.points.length) return false;

    const pt = entity.points[nodeIndex];
    pt.cornerStyle = cornerStyle; // 'sharp' or 'fillet'
    pt.radius = (cornerStyle === 'fillet') ? Math.max(5, Math.min(150, radius)) : 0;

    if (entity.nodes && entity.nodes[nodeIndex]) {
        entity.nodes[nodeIndex].cornerStyle = pt.cornerStyle;
        entity.nodes[nodeIndex].radius = pt.radius;
    }

    return true;
}

/**
 * Checks whether an endpoint is within reach of an adjacent connected wall corner.
 */
export function getConnectedWallCorner(entity, nodeIndex, planner, maxDist = 70) {
    if (!entity || !entity.points || entity.points.length < 2) return null;
    const n = entity.points.length;
    if (nodeIndex !== 0 && nodeIndex !== n - 1) return null;

    const targetPt = entity.points[nodeIndex];
    const walls = planner?.walls || [];
    if (walls.length === 0) return null;

    let hostWall = null;
    if (entity.wallIds && entity.wallIds.length > 0) {
        let minDist = Infinity;
        for (const wid of entity.wallIds) {
            const w = walls.find(wall => wall.id === wid);
            if (!w) continue;
            const wp1 = (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position() : (w.startAnchor || { x: w.startX || 0, y: w.startY || 0 });
            const wp2 = (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position() : (w.endAnchor || { x: w.endX || 0, y: w.endY || 0 });
            const d = Math.min(Math.hypot(targetPt.x - wp1.x, targetPt.z - wp1.y), Math.hypot(targetPt.x - wp2.x, targetPt.z - wp2.y));
            if (d < minDist) {
                minDist = d;
                hostWall = w;
            }
        }
    }
    if (!hostWall) {
        hostWall = walls.find(w => w.id === entity.wallId) || walls[0];
    }
    if (!hostWall) return null;

    const p1 = (hostWall.startAnchor && typeof hostWall.startAnchor.position === 'function') ? hostWall.startAnchor.position() : (hostWall.startAnchor || { x: hostWall.startX || 0, y: hostWall.startY || 0 });
    const p2 = (hostWall.endAnchor && typeof hostWall.endAnchor.position === 'function') ? hostWall.endAnchor.position() : (hostWall.endAnchor || { x: hostWall.endX || 0, y: hostWall.endY || 0 });

    const d1 = Math.hypot(targetPt.x - p1.x, targetPt.z - p1.y);
    const d2 = Math.hypot(targetPt.x - p2.x, targetPt.z - p2.y);
    const cornerAnchor = (d1 <= d2) ? p1 : p2;
    const cornerDist = Math.min(d1, d2);

    if (cornerDist > maxDist) return null;

    const cornerAnchorObj = (d1 <= d2) ? hostWall.startAnchor : hostWall.endAnchor;

    // Check for adjacent wall sharing this corner
    for (const w of walls) {
        if (w === hostWall || w.id === hostWall.id) continue;
        const wp1 = (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position() : (w.startAnchor || { x: w.startX || 0, y: w.startY || 0 });
        const wp2 = (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position() : (w.endAnchor || { x: w.endX || 0, y: w.endY || 0 });

        if (Math.hypot(wp1.x - cornerAnchor.x, wp1.y - cornerAnchor.y) < 35 || (cornerAnchorObj && w.startAnchor === cornerAnchorObj)) {
            return { hostWall, adjWall: w, cornerAnchor, adjCornerIsStart: true };
        }
        if (Math.hypot(wp2.x - cornerAnchor.x, wp2.y - cornerAnchor.y) < 35 || (cornerAnchorObj && w.endAnchor === cornerAnchorObj)) {
            return { hostWall, adjWall: w, cornerAnchor, adjCornerIsStart: false };
        }
    }
    return null;
}

/**
 * Wraps an elevation segment around a 90° corner onto an adjacent connected wall.
 */
export function wrapElevationSegmentToAdjacentWall(entity, nodeIndex, planner, options = {}) {
    if (!entity || !entity.points || entity.points.length < 2) return null;
    const n = entity.points.length;
    if (nodeIndex !== 0 && nodeIndex !== n - 1) return null;

    const isStart = (nodeIndex === 0);
    const targetPt = entity.points[nodeIndex];
    const neighborPt = isStart ? entity.points[1] : entity.points[n - 2];

    const conn = getConnectedWallCorner(entity, nodeIndex, planner, 120);
    if (!conn) return null;

    const { hostWall, adjWall, cornerAnchor, adjCornerIsStart } = conn;

    // Adjacent wall endpoints
    const aw1 = (adjWall.startAnchor && typeof adjWall.startAnchor.position === 'function') ? adjWall.startAnchor.position() : (adjWall.startAnchor || { x: adjWall.startX || 0, y: adjWall.startY || 0 });
    const aw2 = (adjWall.endAnchor && typeof adjWall.endAnchor.position === 'function') ? adjWall.endAnchor.position() : (adjWall.endAnchor || { x: adjWall.endX || 0, y: adjWall.endY || 0 });

    // Direction along adjacent wall extending away from the corner
    const adjFrom = adjCornerIsStart ? aw1 : aw2;
    const adjTo = adjCornerIsStart ? aw2 : aw1;
    const awDx = adjTo.x - adjFrom.x;
    const awDz = adjTo.y - adjFrom.y;
    const awLen = Math.hypot(awDx, awDz) || 1;
    const adjDirX = awDx / awLen;
    const adjDirZ = awDz / awLen;

    // Calculate outward normal for adjacent wall matching current facing
    const hostNorm = targetPt.normal ? new THREE.Vector3(targetPt.normal.x, targetPt.normal.y, targetPt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
    const candNorm1 = new THREE.Vector3(-adjDirZ, 0, adjDirX).normalize();
    const candNorm2 = candNorm1.clone().negate();

    // Natural curve flow across corner: dIn (into corner) -> dOut (out of corner)
    // Left-face elements stay on Left face; Right-face elements stay on Right face
    const dIn = new THREE.Vector3(cornerAnchor.x - neighborPt.x, 0, cornerAnchor.y - neighborPt.z).normalize();
    const dOut = new THREE.Vector3(adjDirX, 0, adjDirZ).normalize();

    const sideIn = new THREE.Vector3().crossVectors(dIn, hostNorm).y; // < 0 is Left, > 0 is Right
    const sideCand1 = new THREE.Vector3().crossVectors(dOut, candNorm1).y;

    let adjNorm = (sideCand1 * sideIn > 0) ? candNorm1 : candNorm2;

    const bisectorNorm = hostNorm.clone().add(adjNorm).normalize();
    if (bisectorNorm.lengthSq() < 0.001) {
        bisectorNorm.copy(hostNorm);
    }

    const dot = Math.max(-0.85, Math.min(0.99, hostNorm.dot(adjNorm)));
    const miterScale = Math.min(2.5, 1 / Math.sqrt((1 + dot) / 2));

    const wallThick = hostWall.thickness || 20;
    const adjThick = adjWall.thickness || 20;
    const cornerOffset = ((wallThick / 2) + 0.3) * miterScale;

    const cornerStyle = options.cornerStyle || 'sharp';
    const radius = (cornerStyle === 'fillet') ? (options.radius !== undefined ? options.radius : 25) : 0;

    // Corner point sitting flush on the corner miter
    const cornerPt = {
        x: Math.round(cornerAnchor.x + bisectorNorm.x * cornerOffset),
        y: targetPt.y,
        z: Math.round(cornerAnchor.y + bisectorNorm.z * cornerOffset),
        normal: { x: bisectorNorm.x, y: 0, z: bisectorNorm.z },
        cornerStyle,
        radius
    };

    const adjSurfaceOffset = (adjWall.thickness || 20) / 2 + 0.3;

    // Extended endpoint along the adjacent wall face
    let endPt;
    if (options.fullWall) {
        const fullArm = Math.max(10, awLen - 5);
        endPt = {
            x: Math.round(cornerAnchor.x + adjDirX * fullArm + adjNorm.x * adjSurfaceOffset),
            y: targetPt.y,
            z: Math.round(cornerAnchor.y + adjDirZ * fullArm + adjNorm.z * adjSurfaceOffset),
            normal: { x: adjNorm.x, y: 0, z: adjNorm.z },
            cornerStyle: 'sharp',
            radius: 0
        };
    } else {
        const armDistTarget = (options.distance !== undefined) ? options.distance : Math.min(120, awLen * 0.7);
        endPt = {
            x: Math.round(cornerPt.x + adjDirX * armDistTarget),
            y: targetPt.y,
            z: Math.round(cornerPt.z + adjDirZ * armDistTarget),
            normal: { x: adjNorm.x, y: 0, z: adjNorm.z },
            cornerStyle: 'sharp',
            radius: 0
        };
    }

    const cornerNodeId = `${entity.id}_c${Date.now()}`;
    const endNodeId = `${entity.id}_e${Date.now()}`;
    const newSegId = `${entity.id}_s${Date.now()}`;

    if (isStart) {
        entity.points[0] = cornerPt;
        entity.points.unshift(endPt);

        if (entity.nodes) {
            entity.nodes[0] = { id: cornerNodeId, ...cornerPt };
            entity.nodes.unshift({ id: endNodeId, ...endPt });
        }
        if (entity.segments) {
            entity.segments.unshift({
                id: newSegId,
                startNodeId: endNodeId,
                endNodeId: cornerNodeId
            });
        }
    } else {
        entity.points[n - 1] = cornerPt;
        entity.points.push(endPt);

        if (entity.nodes) {
            entity.nodes[entity.nodes.length - 1] = { id: cornerNodeId, ...cornerPt };
            entity.nodes.push({ id: endNodeId, ...endPt });
        }
        if (entity.segments) {
            entity.segments.push({
                id: newSegId,
                startNodeId: cornerNodeId,
                endNodeId: endNodeId
            });
        }
    }

    if (!entity.wallIds) entity.wallIds = [entity.wallId].filter(Boolean);
    if (!entity.wallIds.includes(adjWall.id)) entity.wallIds.push(adjWall.id);

    return {
        cornerPt,
        endPt,
        adjWall,
        entity
    };
}

/**
 * Snaps an overshooting or near-corner endpoint flush against the wall corner anchor.
 */
export function snapEndpointToWallCorner(entity, nodeIndex, planner) {
    if (!entity || !entity.points || entity.points.length < 2) return null;
    const n = entity.points.length;
    if (nodeIndex !== 0 && nodeIndex !== n - 1) return null;

    const conn = getConnectedWallCorner(entity, nodeIndex, planner, 150);
    if (!conn) return null;

    const { hostWall, cornerAnchor } = conn;
    const targetPt = entity.points[nodeIndex];

    let hostNorm;
    if (targetPt.normal) {
        hostNorm = new THREE.Vector3(targetPt.normal.x, targetPt.normal.y, targetPt.normal.z).normalize();
    } else {
        const p1 = (hostWall.startAnchor && typeof hostWall.startAnchor.position === 'function') ? hostWall.startAnchor.position() : (hostWall.startAnchor || { x: hostWall.startX || 0, y: hostWall.startY || 0 });
        const p2 = (hostWall.endAnchor && typeof hostWall.endAnchor.position === 'function') ? hostWall.endAnchor.position() : (hostWall.endAnchor || { x: hostWall.endX || 0, y: hostWall.endY || 0 });
        const dx = p2.x - p1.x;
        const dz = p2.y - p1.y;
        const len = Math.hypot(dx, dz) || 1;
        const facing = entity.wallFacing || entity.facing || 1;
        hostNorm = new THREE.Vector3(-dz / len * facing, 0, dx / len * facing);
    }

    let currOffset = (targetPt.x - cornerAnchor.x) * hostNorm.x + (targetPt.z - cornerAnchor.y) * hostNorm.z;
    if (Math.abs(currOffset) < 0.01) {
        currOffset = ((hostWall.thickness || 20) / 2) + 0.3;
    }

    const snappedX = Math.round((cornerAnchor.x + hostNorm.x * currOffset) * 10) / 10;
    const snappedZ = Math.round((cornerAnchor.y + hostNorm.z * currOffset) * 10) / 10;

    targetPt.x = snappedX;
    targetPt.z = snappedZ;

    if (entity.nodes && entity.nodes[nodeIndex]) {
        entity.nodes[nodeIndex].x = snappedX;
        entity.nodes[nodeIndex].z = snappedZ;
    }

    return {
        success: true,
        targetPt,
        cornerAnchor,
        hostWall
    };
}

/**
 * Reports detailed corner connectivity status for an endpoint.
 */
export function getEndpointCornerStatus(entity, nodeIndex, planner) {
    const emptyStatus = {
        hasConnectedWall: false,
        canWrap: false,
        distToCorner: Infinity,
        isAtCorner: false,
        turnDirection: 'none',
        turnArrow: '',
        turnLabel: 'No Connected Wall',
        hostWall: null,
        adjWall: null,
        cornerAnchor: null
    };

    if (!entity || !entity.points || entity.points.length < 2) return emptyStatus;
    const n = entity.points.length;
    if (nodeIndex !== 0 && nodeIndex !== n - 1) return emptyStatus;

    const targetPt = entity.points[nodeIndex];
    const isStart = (nodeIndex === 0);
    const neighborPt = isStart ? entity.points[1] : entity.points[n - 2];

    const conn = getConnectedWallCorner(entity, nodeIndex, planner, 150);
    if (!conn || !conn.adjWall) return emptyStatus;

    const { hostWall, adjWall, cornerAnchor, adjCornerIsStart } = conn;

    let hostNorm;
    if (targetPt.normal) {
        hostNorm = new THREE.Vector3(targetPt.normal.x, targetPt.normal.y, targetPt.normal.z).normalize();
    } else {
        const p1 = (hostWall.startAnchor && typeof hostWall.startAnchor.position === 'function') ? hostWall.startAnchor.position() : (hostWall.startAnchor || { x: hostWall.startX || 0, y: hostWall.startY || 0 });
        const p2 = (hostWall.endAnchor && typeof hostWall.endAnchor.position === 'function') ? hostWall.endAnchor.position() : (hostWall.endAnchor || { x: hostWall.endX || 0, y: hostWall.endY || 0 });
        const dx = p2.x - p1.x;
        const dz = p2.y - p1.y;
        const len = Math.hypot(dx, dz) || 1;
        const facing = entity.wallFacing || entity.facing || 1;
        hostNorm = new THREE.Vector3(-dz / len * facing, 0, dx / len * facing);
    }

    let currOffset = (targetPt.x - cornerAnchor.x) * hostNorm.x + (targetPt.z - cornerAnchor.y) * hostNorm.z;
    if (Math.abs(currOffset) < 0.01) {
        currOffset = ((hostWall.thickness || 20) / 2) + 0.3;
    }

    const cornerSurfaceX = cornerAnchor.x + hostNorm.x * currOffset;
    const cornerSurfaceZ = cornerAnchor.y + hostNorm.z * currOffset;
    const distToCorner = Math.round(Math.hypot(targetPt.x - cornerSurfaceX, targetPt.z - cornerSurfaceZ));
    const isAtCorner = distToCorner <= 30;

    // Adjacent wall endpoints
    const aw1 = (adjWall.startAnchor && typeof adjWall.startAnchor.position === 'function') ? adjWall.startAnchor.position() : (adjWall.startAnchor || { x: adjWall.startX || 0, y: adjWall.startY || 0 });
    const aw2 = (adjWall.endAnchor && typeof adjWall.endAnchor.position === 'function') ? adjWall.endAnchor.position() : (adjWall.endAnchor || { x: adjWall.endX || 0, y: adjWall.endY || 0 });

    const adjFrom = adjCornerIsStart ? aw1 : aw2;
    const adjTo = adjCornerIsStart ? aw2 : aw1;
    const awDx = adjTo.x - adjFrom.x;
    const awDz = adjTo.y - adjFrom.y;
    const awLen = Math.hypot(awDx, awDz) || 1;
    const adjDirX = awDx / awLen;
    const adjDirZ = awDz / awLen;

    const dIn = new THREE.Vector3(cornerAnchor.x - neighborPt.x, 0, cornerAnchor.y - neighborPt.z).normalize();
    const dOut = new THREE.Vector3(adjDirX, 0, adjDirZ).normalize();
    const crossY = dIn.z * dOut.x - dIn.x * dOut.z;

    const isLeft = crossY > 0.01;
    const turnDirection = isLeft ? 'left' : 'right';
    const turnArrow = isLeft ? '↰' : '↱';
    const turnLabel = isLeft ? '90° Left Turn' : '90° Right Turn';

    return {
        hasConnectedWall: true,
        canWrap: true,
        distToCorner,
        isAtCorner,
        turnDirection,
        turnArrow,
        turnLabel,
        hostWall,
        adjWall,
        cornerAnchor,
        adjCornerIsStart
    };
}

/**
 * Wraps an elevation segment around all connected walls in sequence.
 */
export function wrapElevationSegmentAllConnectedWalls(entity, planner, options = {}) {
    if (!entity || !entity.points || entity.points.length < 2 || !planner?.walls?.length) return 0;

    let wrappedCount = 0;
    const maxSteps = Math.min(20, planner.walls.length + 2);
    const visitedWallIds = new Set(entity.wallIds || [entity.wallId].filter(Boolean));

    for (let step = 0; step < maxSteps; step++) {
        const lastIdx = entity.points.length - 1;
        const conn = getConnectedWallCorner(entity, lastIdx, planner, 150);
        if (!conn || !conn.adjWall) break;

        // If we've already wrapped onto this wall, stop loop
        if (visitedWallIds.has(conn.adjWall.id)) break;

        const res = wrapElevationSegmentToAdjacentWall(entity, lastIdx, planner, {
            ...options,
            fullWall: true
        });

        if (!res) break;

        visitedWallIds.add(res.adjWall.id);
        wrappedCount++;
    }

    return wrappedCount;
}


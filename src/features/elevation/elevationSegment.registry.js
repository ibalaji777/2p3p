import * as THREE from 'three';
import { FACADE_RIBBON_MATERIALS } from '../facade/facadeRibbon.registry.js';
import { renderElevationSegment2D, syncElevationSegments2D, computeElevationSegment2DFootprint, computeElevationSegmentSpotlights2D } from './elevationSegment.renderer2d.js';
import { renderElevationSegment3D } from './elevationSegment.renderer3d.js';

export { renderElevationSegment2D, syncElevationSegments2D, computeElevationSegment2DFootprint, computeElevationSegmentSpotlights2D, renderElevationSegment3D };

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

    // Calculate initial segment span (allows placement anywhere including edges and center)
    const segLen = Math.min(initialLen, wallLen);
    const halfLen = segLen / 2;

    let uStart, uEnd;
    if (options.uStart !== undefined && options.uEnd !== undefined) {
        uStart = options.uStart;
        uEnd = options.uEnd;
    } else {
        const targetCenter = (localHitX !== undefined && localHitX !== null) ? localHitX : (wallLen / 2);
        // Center alignment check first
        if (Math.abs(targetCenter - wallLen / 2) <= 15) {
            const centerLen = Math.min(segLen, wallLen);
            uStart = Math.max(0, (wallLen - centerLen) / 2);
            uEnd = Math.min(wallLen, uStart + centerLen);
        }
        // Start edge alignment (if target is near start of wall)
        else if (targetCenter <= halfLen + 5) {
            uStart = 0;
            uEnd = Math.min(wallLen, segLen);
        } 
        // End edge alignment (if target is near end of wall)
        else if (targetCenter >= wallLen - halfLen - 5) {
            uStart = Math.max(0, wallLen - segLen);
            uEnd = wallLen;
        } 
        // Free placement anywhere along span
        else {
            uStart = Math.max(0, targetCenter - halfLen);
            uEnd = Math.min(wallLen, uStart + segLen);
            if (uEnd - uStart < segLen) {
                uStart = Math.max(0, uEnd - segLen);
            }
        }
    }

    const wallBaseY = (wall && wall.elevation !== undefined) ? Number(wall.elevation) : ((wall && wall.level && wall.level.elevation) ? Number(wall.level.elevation) : 0);
    const targetY = Math.round(hitY !== undefined ? hitY : (wallBaseY + 150));

    // Calculate 3D coordinates sitting flush on the wall face
    const startPt = {
        x: Math.round(p1.x + dirX * uStart + normX * surfaceOffset),
        y: targetY,
        z: Math.round(p1.y + dirZ * uStart + normZ * surfaceOffset),
        u: uStart,
        t: wallLen > 0 ? (uStart / wallLen) : 0,
        normal: { x: normX, y: 0, z: normZ },
        cornerStyle: 'sharp',
        radius: 0
    };

    const endPt = {
        x: Math.round(p1.x + dirX * uEnd + normX * surfaceOffset),
        y: targetY,
        z: Math.round(p1.y + dirZ * uEnd + normZ * surfaceOffset),
        u: uEnd,
        t: wallLen > 0 ? (uEnd / wallLen) : 1,
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
        elevation: targetY,
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
export function sproutBendAtEndpoint(entity, nodeIndex, direction, distance = 120, options = {}) {
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
    const up = new THREE.Vector3(0, 1, 0);
    const wallTangent = up.clone().cross(normal).normalize();

    // Compute new segment direction based on chosen sprout direction or custom angle
    let sproutVec = new THREE.Vector3(0, 1, 0); // Default UP

    if (options && options.angleDeg !== undefined) {
        // Rotate currentDir around wall normal by angleDeg
        const rad = (options.angleDeg * Math.PI) / 180;
        sproutVec = currentDir.clone().applyAxisAngle(normal, rad).normalize();
    } else if (direction === 'up') {
        sproutVec.set(0, 1, 0);
    } else if (direction === 'down') {
        sproutVec.set(0, -1, 0);
    } else if (direction === 'forward') {
        sproutVec.copy(currentDir);
    } else if (direction === 'left') {
        sproutVec.copy(wallTangent).negate();
    } else if (direction === 'right') {
        sproutVec.copy(wallTangent);
    } else if (direction === 'diagonal_up' || direction === 'diagonal_down') {
        const ySign = (direction === 'diagonal_up') ? 1 : -1;
        const xSign = currentDir.dot(wallTangent) >= 0 ? 1 : -1;
        sproutVec = wallTangent.clone().multiplyScalar(xSign).add(up.clone().multiplyScalar(ySign)).normalize();
    } else if (direction === 'away_wall' || direction === 'out' || direction === 'depth_out') {
        sproutVec.copy(normal);
    } else if (direction === 'toward_wall' || direction === 'in' || direction === 'depth_in') {
        sproutVec.copy(normal).negate();
    } else if (direction === 'perp' || direction === 'perp_pos') {
        sproutVec = currentDir.clone().applyAxisAngle(normal, Math.PI / 2).normalize();
    } else if (direction === 'perp_neg') {
        sproutVec = currentDir.clone().applyAxisAngle(normal, -Math.PI / 2).normalize();
    }

    const cornerStyle = options.cornerStyle || 'sharp';
    const radius = options.radius !== undefined ? options.radius : 0;

    const newPt = {
        x: Math.round(targetPt.x + sproutVec.x * distance),
        y: Math.round(targetPt.y + sproutVec.y * distance),
        z: Math.round(targetPt.z + sproutVec.z * distance),
        normal: { x: normal.x, y: normal.y, z: normal.z },
        cornerStyle,
        radius
    };

    // The current endpoint now becomes an internal bend node
    targetPt.cornerStyle = cornerStyle;
    targetPt.radius = radius;

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

    initEntitySegments(entity);

    return {
        newNode: newPt,
        bendNode: targetPt,
        entity
    };
}

/**
 * 1-Click Corner Generation Presets (90°, 45° diagonal, 60°/120° V-shape).
 */
export function sproutCornerPreset(entity, nodeIndex, presetType, options = {}) {
    const dist = options.distance || 100;
    if (presetType === 'square_90') {
        const dir = options.direction || 'up';
        return sproutBendAtEndpoint(entity, nodeIndex, dir, dist, { cornerStyle: options.cornerStyle || 'sharp', radius: options.radius });
    }
    if (presetType === 'diagonal_45' || presetType === 'sloped_45') {
        const dir = options.direction === 'down' ? 'diagonal_down' : 'diagonal_up';
        return sproutBendAtEndpoint(entity, nodeIndex, dir, dist, { cornerStyle: options.cornerStyle || 'bevel', radius: options.radius || 20 });
    }
    if (presetType === 'v_angle') {
        const angle = options.angleDeg !== undefined ? options.angleDeg : 60;
        return sproutBendAtEndpoint(entity, nodeIndex, 'custom', dist, { angleDeg: angle, cornerStyle: options.cornerStyle || 'sharp', radius: options.radius });
    }
    return sproutBendAtEndpoint(entity, nodeIndex, options.direction || 'up', dist, options);
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
    } else if (direction === 'away_wall' || direction === 'out' || direction === 'depth_out') {
        sproutVec.copy(normal);
    } else if (direction === 'toward_wall' || direction === 'in' || direction === 'depth_in') {
        sproutVec.copy(normal).negate();
    } else if (direction === 'perp' || direction === 'perp_pos') {
        sproutVec = new THREE.Vector3(0, 1, 0).applyAxisAngle(normal, Math.PI / 2).normalize();
    } else if (direction === 'perp_neg') {
        sproutVec = new THREE.Vector3(0, 1, 0).applyAxisAngle(normal, -Math.PI / 2).normalize();
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
 * Updates corner style (sharp, fillet, bevel) and radius for a specific bend node.
 */
export function setNodeCornerStyle(entity, nodeIndex, cornerStyle, radius = 25) {
    if (!entity || !entity.points || nodeIndex < 0 || nodeIndex >= entity.points.length) return false;

    const pt = entity.points[nodeIndex];
    pt.cornerStyle = cornerStyle; // 'sharp', 'fillet', 'bevel', 'chamfer'
    pt.radius = (cornerStyle === 'fillet' || cornerStyle === 'bevel' || cornerStyle === 'chamfer')
        ? Math.max(5, Math.min(150, radius))
        : 0;

    if (entity.nodes && entity.nodes[nodeIndex]) {
        entity.nodes[nodeIndex].cornerStyle = pt.cornerStyle;
        entity.nodes[nodeIndex].radius = pt.radius;
    }

    return true;
}

/**
 * Rotates an Elevation Segment around its geometric center on the wall plane.
 */
export function rotateElevationSegment(entity, newAngleDeg, centerPt = null) {
    if (!entity || !entity.points || entity.points.length < 2) return false;

    const pts = entity.points;
    const n = pts.length;

    let cx = 0, cy = 0, cz = 0;
    if (centerPt) {
        cx = centerPt.x;
        cy = centerPt.y;
        cz = centerPt.z;
    } else {
        for (let i = 0; i < n; i++) {
            cx += pts[i].x;
            cy += pts[i].y;
            cz += pts[i].z;
        }
        cx /= n;
        cy /= n;
        cz /= n;
    }

    const norm = pts[0].normal
        ? new THREE.Vector3(pts[0].normal.x, pts[0].normal.y, pts[0].normal.z).normalize()
        : new THREE.Vector3(0, 0, 1);

    const currentAngle = entity.rotation || 0;
    const deltaDeg = newAngleDeg - currentAngle;
    if (Math.abs(deltaDeg) < 0.001) return false;

    const deltaRad = (deltaDeg * Math.PI) / 180;

    for (let i = 0; i < n; i++) {
        const pt = pts[i];
        const v = new THREE.Vector3(pt.x - cx, pt.y - cy, pt.z - cz);
        v.applyAxisAngle(norm, deltaRad);
        pt.x = Math.round(cx + v.x);
        pt.y = Math.round(cy + v.y);
        pt.z = Math.round(cz + v.z);

        if (entity.nodes && entity.nodes[i]) {
            entity.nodes[i].x = pt.x;
            entity.nodes[i].y = pt.y;
            entity.nodes[i].z = pt.z;
        }
    }

    if (entity.branches && entity.branches.length > 0) {
        entity.branches.forEach(b => {
            if (b.points) {
                b.points.forEach(bp => {
                    const bv = new THREE.Vector3(bp.x - cx, bp.y - cy, bp.z - cz);
                    bv.applyAxisAngle(norm, deltaRad);
                    bp.x = Math.round(cx + bv.x);
                    bp.y = Math.round(cy + bv.y);
                    bp.z = Math.round(cz + bv.z);
                });
            }
        });
    }

    entity.rotation = Math.round(((newAngleDeg % 360) + 360) % 360);
    renderElevationSegment3D(null, entity);
    return true;
}

/**
 * Detects nearby elevation segments whose endpoints are within proximity of the active segment.
 */
export function findNearbyElevationSegments(planner, activeEntity, maxDist = 35) {
    if (!planner || !planner.elevationSegments || !activeEntity || !activeEntity.points) return [];
    const results = [];
    const nA = activeEntity.points.length;
    const startA = activeEntity.points[0];
    const endA = activeEntity.points[nA - 1];

    planner.elevationSegments.forEach(other => {
        if (!other || other.id === activeEntity.id || !other.points || other.points.length < 2) return;
        const nB = other.points.length;
        const startB = other.points[0];
        const endB = other.points[nB - 1];

        const d1 = Math.hypot(endA.x - startB.x, endA.y - startB.y, endA.z - startB.z);
        const d2 = Math.hypot(endA.x - endB.x, endA.y - endB.y, endA.z - endB.z);
        const d3 = Math.hypot(startA.x - endB.x, startA.y - endB.y, startA.z - endB.z);
        const d4 = Math.hypot(startA.x - startB.x, startA.y - startB.y, startA.z - startB.z);

        const minDist = Math.min(d1, d2, d3, d4);
        if (minDist <= maxDist) {
            results.push({ segment: other, distance: Math.round(minDist) });
        }
    });

    return results;
}

/**
 * Automatically joins two nearby elevation segments into one continuous assembly.
 */
export function joinElevationSegments(planner, segA, segB, maxDist = 45) {
    if (!segA || !segB || !segA.points || !segB.points) return null;

    const nA = segA.points.length;
    const nB = segB.points.length;
    const startA = segA.points[0];
    const endA = segA.points[nA - 1];
    const startB = segB.points[0];
    const endB = segB.points[nB - 1];

    const d1 = Math.hypot(endA.x - startB.x, endA.y - startB.y, endA.z - startB.z);
    const d2 = Math.hypot(endA.x - endB.x, endA.y - endB.y, endA.z - endB.z);
    const d3 = Math.hypot(startA.x - endB.x, startA.y - endB.y, startA.z - endB.z);
    const d4 = Math.hypot(startA.x - startB.x, startA.y - startB.y, startA.z - startB.z);

    const minDist = Math.min(d1, d2, d3, d4);
    if (minDist > maxDist) return null;

    let mergedPoints = [];

    if (minDist === d1) {
        // segA end -> segB start
        const bridgePt = {
            ...startB,
            x: Math.round((endA.x + startB.x) / 2),
            y: Math.round((endA.y + startB.y) / 2),
            z: Math.round((endA.z + startB.z) / 2),
            cornerStyle: 'sharp'
        };
        mergedPoints = [...segA.points.slice(0, nA - 1), bridgePt, ...segB.points.slice(1)];
    } else if (minDist === d2) {
        // segA end -> segB end (reverse segB)
        const revB = segB.points.slice().reverse();
        const bridgePt = {
            ...endB,
            x: Math.round((endA.x + endB.x) / 2),
            y: Math.round((endA.y + endB.y) / 2),
            z: Math.round((endA.z + endB.z) / 2),
            cornerStyle: 'sharp'
        };
        mergedPoints = [...segA.points.slice(0, nA - 1), bridgePt, ...revB.slice(1)];
    } else if (minDist === d3) {
        // segB end -> segA start
        const bridgePt = {
            ...startA,
            x: Math.round((startA.x + endB.x) / 2),
            y: Math.round((startA.y + endB.y) / 2),
            z: Math.round((startA.z + endB.z) / 2),
            cornerStyle: 'sharp'
        };
        mergedPoints = [...segB.points.slice(0, nB - 1), bridgePt, ...segA.points.slice(1)];
    } else {
        // segB start -> segA start (reverse segB)
        const revB = segB.points.slice().reverse();
        const bridgePt = {
            ...startA,
            x: Math.round((startA.x + startB.x) / 2),
            y: Math.round((startA.y + startB.y) / 2),
            z: Math.round((startA.z + startB.z) / 2),
            cornerStyle: 'sharp'
        };
        mergedPoints = [...revB.slice(0, nB - 1), bridgePt, ...segA.points.slice(1)];
    }

    segA.points = mergedPoints;
    segA.nodes = mergedPoints.map((p, idx) => ({ id: `${segA.id}_n${idx}`, ...p }));
    segA.segments = [];
    for (let i = 0; i < mergedPoints.length - 1; i++) {
        segA.segments.push({
            id: `${segA.id}_s${i}`,
            startNodeId: segA.nodes[i].id,
            endNodeId: segA.nodes[i + 1].id
        });
    }

    // Remove segB from planner
    if (planner && planner.elevationSegments) {
        const idx = planner.elevationSegments.findIndex(s => s.id === segB.id);
        if (idx !== -1) {
            planner.elevationSegments.splice(idx, 1);
        }
    }
    if (segB.mesh3D?.parent) {
        segB.mesh3D.parent.remove(segB.mesh3D);
    }

    renderElevationSegment3D(null, segA);
    if (planner && typeof planner.syncAll === 'function') {
        planner.syncAll();
    }

    return segA;
}

/**
 * Splits an elevation segment at an interior node into two independent, editable segments.
 * Preserves independent editing after joining or continuous sprawling.
 * 
 * @param {Object} planner - The planner instance containing elevationSegments
 * @param {Object} entity - The elevation segment to split
 * @param {number} nodeIndex - The interior node index (1 <= nodeIndex <= n - 2)
 * @returns {{ segA: Object, segB: Object } | null}
 */
export function splitElevationSegmentAtNode(planner, entity, nodeIndex) {
    if (!entity || !entity.points || entity.points.length < 3) return null;
    const n = entity.points.length;
    if (nodeIndex < 1 || nodeIndex > n - 2) return null;

    const pointsA = entity.points.slice(0, nodeIndex + 1);
    const pointsB = entity.points.slice(nodeIndex);

    // Endpoint of segA should be sharp
    const lastA = pointsA[pointsA.length - 1];
    pointsA[pointsA.length - 1] = {
        ...lastA,
        cornerStyle: 'sharp'
    };
    delete pointsA[pointsA.length - 1].radius;

    // Start point of segB should be sharp
    const firstB = pointsB[0];
    pointsB[0] = {
        ...firstB,
        cornerStyle: 'sharp'
    };
    delete pointsB[0].radius;

    // Update entity (segA) in place
    entity.points = pointsA;
    entity.nodes = pointsA.map((p, idx) => ({ id: `${entity.id}_n${idx}`, ...p }));
    entity.segments = [];
    for (let i = 0; i < pointsA.length - 1; i++) {
        entity.segments.push({
            id: `${entity.id}_s${i}`,
            startNodeId: entity.nodes[i].id,
            endNodeId: entity.nodes[i + 1].id
        });
    }

    // Create segB
    const segBId = 'elev_seg_' + Math.random().toString(36).substring(2, 9);
    const segB = {
        ...entity,
        id: segBId,
        name: `${entity.name || 'Elevation Segment'} (Part 2)`,
        points: pointsB.map(p => ({ ...p })),
        wallId: entity.wallId,
        wallIds: entity.wallIds ? [...entity.wallIds] : (entity.wallId ? [entity.wallId] : [])
    };
    delete segB.mesh3D;

    segB.nodes = segB.points.map((p, idx) => ({ id: `${segBId}_n${idx}`, ...p }));
    segB.segments = [];
    for (let i = 0; i < segB.points.length - 1; i++) {
        segB.segments.push({
            id: `${segBId}_s${i}`,
            startNodeId: segB.nodes[i].id,
            endNodeId: segB.nodes[i + 1].id
        });
    }

    if (planner && planner.elevationSegments) {
        planner.elevationSegments.push(segB);
    }

    // Re-render segA
    renderElevationSegment3D(null, entity);

    // Render segB
    renderElevationSegment3D(null, segB);
    if (entity.mesh3D?.parent && segB.mesh3D) {
        entity.mesh3D.parent.add(segB.mesh3D);
    }

    if (planner && typeof planner.syncAll === 'function') {
        planner.syncAll();
    }

    return { segA: entity, segB };
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

    initEntitySegments(entity);

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

/**
 * Initializes or updates entity.segments array with independent per-segment metadata.
 */
export function initEntitySegments(entity) {
    if (!entity || !entity.points || entity.points.length < 2) return [];
    if (!Array.isArray(entity.segments)) entity.segments = [];

    const n = entity.points.length;
    const defaultW = entity.width || 30;
    const defaultD = entity.depth || 40;

    for (let i = 0; i < n - 1; i++) {
        const pA = entity.points[i];
        const pB = entity.points[i + 1];
        const len = Math.hypot(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);

        if (!entity.segments[i]) {
            entity.segments[i] = {
                id: `${entity.id || 'seg'}_arm_${i}`,
                startNodeId: i,
                endNodeId: i + 1,
                length: Math.round(len),
                width: defaultW,
                depth: defaultD
            };
        } else {
            entity.segments[i].length = Math.round(len);
            if (entity.segments[i].width === undefined) entity.segments[i].width = defaultW;
            if (entity.segments[i].depth === undefined) entity.segments[i].depth = defaultD;
            entity.segments[i].startNodeId = i;
            entity.segments[i].endNodeId = i + 1;
        }
    }

    if (entity.segments.length > n - 1) {
        entity.segments.length = n - 1;
    }
    return entity.segments;
}

/**
 * Adjusts the physical length of a specific segment arm independently.
 */
export function setSegmentLength(entity, segmentIndex, newLength) {
    if (!entity || !entity.points || entity.points.length < 2) return false;
    const n = entity.points.length;
    if (segmentIndex < 0 || segmentIndex >= n - 1) return false;

    const targetLen = Math.max(15, Math.round(Number(newLength) || 15));
    const pts = entity.points;
    const i = segmentIndex;

    const pA = pts[i];
    const pB = pts[i + 1];
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const dz = pB.z - pA.z;
    const curLen = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / curLen;
    const uy = dy / curLen;
    const uz = dz / curLen;
    const deltaL = targetLen - curLen;

    if (Math.abs(deltaL) < 0.001) return true;

    if (n === 2) {
        // Single segment: P0 is anchor, P1 extends along direction
        pts[1].x = Math.round(pA.x + ux * targetLen);
        pts[1].y = Math.round(pA.y + uy * targetLen);
        pts[1].z = Math.round(pA.z + uz * targetLen);
        if (entity.nodes && entity.nodes[1]) {
            entity.nodes[1].x = pts[1].x;
            entity.nodes[1].y = pts[1].y;
            entity.nodes[1].z = pts[1].z;
        }
    } else if (i === 0) {
        // Leading segment: P1 is anchor junction, P0 is free end extending backwards
        pts[0].x = Math.round(pB.x - ux * targetLen);
        pts[0].y = Math.round(pB.y - uy * targetLen);
        pts[0].z = Math.round(pB.z - uz * targetLen);
        if (entity.nodes && entity.nodes[0]) {
            entity.nodes[0].x = pts[0].x;
            entity.nodes[0].y = pts[0].y;
            entity.nodes[0].z = pts[0].z;
        }
    } else {
        // Trailing segment or internal segment: Pi is pivot junction, P(i+1) and downstream points shift
        const shiftX = Math.round(ux * deltaL);
        const shiftY = Math.round(uy * deltaL);
        const shiftZ = Math.round(uz * deltaL);

        for (let k = i + 1; k < n; k++) {
            pts[k].x += shiftX;
            pts[k].y += shiftY;
            pts[k].z += shiftZ;
            if (entity.nodes && entity.nodes[k]) {
                entity.nodes[k].x = pts[k].x;
                entity.nodes[k].y = pts[k].y;
                entity.nodes[k].z = pts[k].z;
            }
        }
    }

    initEntitySegments(entity);
    renderElevationSegment3D(null, entity);
    return true;
}

/**
 * Updates dimensions (width, depth, length) for a specific segment arm independently.
 */
export function setSegmentDimensions(entity, segmentIndex, dims = {}) {
    if (!entity || !entity.points || entity.points.length < 2) return false;
    const n = entity.points.length;
    if (segmentIndex < 0 || segmentIndex >= n - 1) return false;

    initEntitySegments(entity);
    const seg = entity.segments[segmentIndex];
    if (!seg) return false;

    if (dims.width !== undefined && dims.width !== null) {
        seg.width = Math.max(10, Math.min(250, Math.round(Number(dims.width))));
        if (entity.points.length === 2) {
            entity.width = seg.width;
        }
    }
    if (dims.depth !== undefined && dims.depth !== null) {
        seg.depth = Math.max(10, Math.min(250, Math.round(Number(dims.depth))));
        if (entity.points.length === 2) {
            entity.depth = seg.depth;
        }
    }
    if (dims.length !== undefined && dims.length !== null) {
        setSegmentLength(entity, segmentIndex, dims.length);
        return true;
    }

    renderElevationSegment3D(null, entity);
    return true;
}

/**
 * Computes the angle of a specific segment arm in degrees [0, 360).
 */
export function getSegmentAngle(entity, segmentIndex) {
    if (!entity || !entity.points || entity.points.length < 2) return 0;
    const n = entity.points.length;
    if (segmentIndex < 0 || segmentIndex >= n - 1) return 0;

    const pA = entity.points[segmentIndex];
    const pB = entity.points[segmentIndex + 1];

    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const dz = pB.z - pA.z;

    const norm = pA.normal
        ? new THREE.Vector3(pA.normal.x, pA.normal.y, pA.normal.z).normalize()
        : new THREE.Vector3(0, 0, 1);

    const up = new THREE.Vector3(0, 1, 0);
    let tangent = new THREE.Vector3().crossVectors(up, norm).normalize();
    if (tangent.lengthSq() < 0.001) tangent.set(1, 0, 0);

    const v = new THREE.Vector3(dx, dy, dz);
    const vx = v.dot(tangent);
    const vy = v.dot(up);

    const rad = Math.atan2(vy, vx);
    const deg = ((rad * 180 / Math.PI) % 360 + 360) % 360;
    return Math.round(deg);
}

/**
 * Rotates an individual segment arm around its connected junction, preserving other segments.
 */
export function rotateSegmentArm(entity, segmentIndex, newAngleDeg) {
    if (!entity || !entity.points || entity.points.length < 2) return false;
    const n = entity.points.length;
    if (segmentIndex < 0 || segmentIndex >= n - 1) return false;

    const currentAngle = getSegmentAngle(entity, segmentIndex);
    const deltaDeg = newAngleDeg - currentAngle;
    if (Math.abs(deltaDeg) < 0.01) return true;

    const deltaRad = (deltaDeg * Math.PI) / 180;
    const pts = entity.points;
    const i = segmentIndex;

    const norm = pts[i].normal
        ? new THREE.Vector3(pts[i].normal.x, pts[i].normal.y, pts[i].normal.z).normalize()
        : new THREE.Vector3(0, 0, 1);

    if (n === 2) {
        // Single segment: pivot around P0, rotate P1
        const cx = pts[0].x, cy = pts[0].y, cz = pts[0].z;
        const v = new THREE.Vector3(pts[1].x - cx, pts[1].y - cy, pts[1].z - cz);
        v.applyAxisAngle(norm, deltaRad);
        pts[1].x = Math.round(cx + v.x);
        pts[1].y = Math.round(cy + v.y);
        pts[1].z = Math.round(cz + v.z);
        if (entity.nodes && entity.nodes[1]) {
            entity.nodes[1].x = pts[1].x;
            entity.nodes[1].y = pts[1].y;
            entity.nodes[1].z = pts[1].z;
        }
    } else if (i === 0) {
        // Leading segment: P1 is anchor junction, P0 rotates around P1
        const cx = pts[1].x, cy = pts[1].y, cz = pts[1].z;
        const v = new THREE.Vector3(pts[0].x - cx, pts[0].y - cy, pts[0].z - cz);
        v.applyAxisAngle(norm, deltaRad);
        pts[0].x = Math.round(cx + v.x);
        pts[0].y = Math.round(cy + v.y);
        pts[0].z = Math.round(cz + v.z);
        if (entity.nodes && entity.nodes[0]) {
            entity.nodes[0].x = pts[0].x;
            entity.nodes[0].y = pts[0].y;
            entity.nodes[0].z = pts[0].z;
        }
    } else if (i === n - 2) {
        // Trailing segment: Pi is anchor junction, P(i+1) rotates around Pi
        const cx = pts[i].x, cy = pts[i].y, cz = pts[i].z;
        const v = new THREE.Vector3(pts[i + 1].x - cx, pts[i + 1].y - cy, pts[i + 1].z - cz);
        v.applyAxisAngle(norm, deltaRad);
        pts[i + 1].x = Math.round(cx + v.x);
        pts[i + 1].y = Math.round(cy + v.y);
        pts[i + 1].z = Math.round(cz + v.z);
        if (entity.nodes && entity.nodes[i + 1]) {
            entity.nodes[i + 1].x = pts[i + 1].x;
            entity.nodes[i + 1].y = pts[i + 1].y;
            entity.nodes[i + 1].z = pts[i + 1].z;
        }
    } else {
        // Internal segment: Pi is pivot junction, P(i+1) and downstream points k > i rotate around Pi
        const cx = pts[i].x, cy = pts[i].y, cz = pts[i].z;
        for (let k = i + 1; k < n; k++) {
            const v = new THREE.Vector3(pts[k].x - cx, pts[k].y - cy, pts[k].z - cz);
            v.applyAxisAngle(norm, deltaRad);
            pts[k].x = Math.round(cx + v.x);
            pts[k].y = Math.round(cy + v.y);
            pts[k].z = Math.round(cz + v.z);
            if (entity.nodes && entity.nodes[k]) {
                entity.nodes[k].x = pts[k].x;
                entity.nodes[k].y = pts[k].y;
                entity.nodes[k].z = pts[k].z;
            }
        }
    }

    initEntitySegments(entity);
    renderElevationSegment3D(null, entity);
    return true;
}

/**
 * Snaps a segment arm to be strictly perpendicular (90°) relative to its connected neighbor.
 */
export function setSegmentPerpendicular(entity, segmentIndex, referenceIndex = null) {
    if (!entity || !entity.points || entity.points.length < 2) return false;
    const n = entity.points.length;
    if (segmentIndex < 0 || segmentIndex >= n - 1) return false;

    let targetAngle = 90;
    const currentAngle = getSegmentAngle(entity, segmentIndex);

    if (n === 2) {
        // Single segment: snap to nearest 90-degree cardinal
        targetAngle = Math.round(currentAngle / 90) * 90;
        if (Math.abs(currentAngle - targetAngle) < 1) {
            targetAngle = (targetAngle + 90) % 360;
        }
    } else {
        const refIdx = (referenceIndex !== null && referenceIndex !== undefined)
            ? referenceIndex
            : (segmentIndex > 0 ? segmentIndex - 1 : segmentIndex + 1);

        const refAngle = getSegmentAngle(entity, refIdx);
        const cand1 = (refAngle + 90) % 360;
        const cand2 = (refAngle + 270) % 360;

        const diff1 = Math.min(Math.abs(currentAngle - cand1), 360 - Math.abs(currentAngle - cand1));
        const diff2 = Math.min(Math.abs(currentAngle - cand2), 360 - Math.abs(currentAngle - cand2));

        targetAngle = (diff1 <= diff2) ? cand1 : cand2;
    }

    targetAngle = ((targetAngle % 360) + 360) % 360;
    return rotateSegmentArm(entity, segmentIndex, targetAngle);
}

/**
 * Adjusts the Y elevation of a single selected segment arm while keeping other segments in place.
 * If adjacent segments are horizontal, inserts step nodes so that neighboring arms stay 100% horizontal
 * at their original Y position with zero slanting.
 *
 * @param {Object} entity - Elevation segment entity
 * @param {number} segmentIndex - Index of the arm to adjust (0 to n - 2)
 * @param {number} deltaY - Vertical change in cm (e.g. +10, -10)
 * @returns {boolean}
 */
export function adjustArmElevation(entity, segmentIndex, deltaY) {
    if (!entity || !entity.points || entity.points.length < 2) return false;
    const n = entity.points.length;
    const a = Math.min(Math.max(0, segmentIndex || 0), n - 2);

    if (n === 2) {
        entity.points[0].y = Math.max(0, (entity.points[0].y || 0) + deltaY);
        entity.points[1].y = Math.max(0, (entity.points[1].y || 0) + deltaY);
        entity.elevation = entity.points[0].y;
        if (entity.nodes) {
            if (entity.nodes[0]) entity.nodes[0].y = entity.points[0].y;
            if (entity.nodes[1]) entity.nodes[1].y = entity.points[1].y;
        }
        renderElevationSegment3D(null, entity);
        return true;
    }

    const pA = entity.points[a];
    const pB = entity.points[a + 1];

    const isArmAHorizontal = Math.abs(pA.y - pB.y) <= 1;

    const hasPrev = (a > 0);
    const prevPt = hasPrev ? entity.points[a - 1] : null;
    const prevCollinearY = prevPt && Math.abs(prevPt.y - pA.y) <= 1;

    const hasNext = (a + 1 < n - 1);
    const nextPt = hasNext ? entity.points[a + 2] : null;
    const nextCollinearY = nextPt && Math.abs(nextPt.y - pB.y) <= 1;

    if (isArmAHorizontal && (prevCollinearY || nextCollinearY)) {
        let pts = entity.points;
        let curA = a;

        if (prevCollinearY && Math.hypot(prevPt.x - pA.x, prevPt.z - pA.z) > 1) {
            const stepNode = {
                ...pA,
                cornerStyle: 'sharp',
                radius: 0
            };
            pts.splice(curA, 0, stepNode);
            curA++;
        }

        const newB = curA + 1;
        const curNextPt = pts[newB + 1];
        if (curNextPt && Math.abs(curNextPt.y - pts[newB].y) <= 1 && Math.hypot(curNextPt.x - pts[newB].x, curNextPt.z - pts[newB].z) > 1) {
            const stepNode = {
                ...pts[newB],
                cornerStyle: 'sharp',
                radius: 0
            };
            pts.splice(newB + 1, 0, stepNode);
        }

        pts[curA].y = Math.max(0, pts[curA].y + deltaY);
        pts[curA + 1].y = Math.max(0, pts[curA + 1].y + deltaY);

        initEntitySegments(entity);
        renderElevationSegment3D(null, entity);
        return true;
    }

    pA.y = Math.max(0, (pA.y || 0) + deltaY);
    pB.y = Math.max(0, (pB.y || 0) + deltaY);

    if (entity.nodes) {
        if (entity.nodes[a]) entity.nodes[a].y = pA.y;
        if (entity.nodes[a + 1]) entity.nodes[a + 1].y = pB.y;
    }

    initEntitySegments(entity);
    renderElevationSegment3D(null, entity);
    return true;
}

/**
 * Sets the absolute elevation of a single selected segment arm while keeping remaining segments in place.
 */
export function setArmElevation(entity, segmentIndex, targetY) {
    if (!entity || !entity.points || entity.points.length < 2) return false;
    const n = entity.points.length;
    const a = Math.min(Math.max(0, segmentIndex || 0), n - 2);
    const curY = (entity.points[a].y + entity.points[a + 1].y) / 2;
    const deltaY = Math.round(targetY - curY);
    return adjustArmElevation(entity, a, deltaY);
}




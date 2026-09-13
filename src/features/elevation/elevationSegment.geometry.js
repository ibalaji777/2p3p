import * as THREE from 'three';
import { computeNodeFrame, normalizeRibbonUVs } from '../facade/facadeRibbon.geometry.js';

/**
 * Expands a sequence of 3D polyline nodes, converting any nodes marked as
 * cornerStyle === 'fillet' into smooth concentric arc subdivisions.
 */
export function expandPathWithFillets(points, defaultWidth = 30, defaultDepth = 40) {
    if (!points || points.length < 3) return points.map(p => ({ ...p }));

    const expanded = [];
    const n = points.length;

    expanded.push({ ...points[0] });

    for (let i = 1; i < n - 1; i++) {
        const pPrev = new THREE.Vector3(points[i - 1].x, points[i - 1].y, points[i - 1].z);
        const pCurr = new THREE.Vector3(points[i].x, points[i].y, points[i].z);
        const pNext = new THREE.Vector3(points[i + 1].x, points[i + 1].y, points[i + 1].z);

        const vIn = pCurr.clone().sub(pPrev);
        const vOut = pNext.clone().sub(pCurr);

        const lenIn = vIn.length();
        const lenOut = vOut.length();

        const node = points[i];
        const isFillet = (node.cornerStyle === 'fillet' && (node.radius || 0) > 0);

        if (!isFillet || lenIn < 10 || lenOut < 10) {
            expanded.push({ ...node });
            continue;
        }

        const dirIn = vIn.clone().normalize();
        const dirOut = vOut.clone().normalize();

        const dot = Math.max(-0.999, Math.min(0.999, dirIn.dot(dirOut)));
        const angle = Math.acos(dot); // Interior turn angle

        // If collinear (angle near 0 or Math.PI), no fillet needed
        if (angle < 0.05 || angle > Math.PI - 0.05) {
            expanded.push({ ...node });
            continue;
        }

        const halfTurn = (Math.PI - angle) / 2;
        const requestedR = node.radius || 25;

        // Maximum tangent cutoff distance (clamped to 45% of adjacent segment lengths)
        const maxTangentDist = Math.min(lenIn * 0.45, lenOut * 0.45);
        const tangentDist = Math.min(maxTangentDist, requestedR / Math.tan(halfTurn));
        const effectiveR = tangentDist * Math.tan(halfTurn);

        if (effectiveR < 2) {
            expanded.push({ ...node });
            continue;
        }

        // Tangent start point (on incoming segment)
        const ptStart = pCurr.clone().sub(dirIn.clone().multiplyScalar(tangentDist));
        // Tangent end point (on outgoing segment)
        const ptEnd = pCurr.clone().add(dirOut.clone().multiplyScalar(tangentDist));

        // Normal plane of the corner turn
        const turnAxis = dirIn.clone().cross(dirOut).normalize();
        if (turnAxis.lengthSq() < 0.001) {
            expanded.push({ ...node });
            continue;
        }

        // Bisector pointing into the corner
        const inBisector = dirOut.clone().sub(dirIn).normalize();
        const centerDist = effectiveR / Math.sin(halfTurn);
        const arcCenter = pCurr.clone().add(inBisector.clone().multiplyScalar(centerDist));

        const radiusStartVec = ptStart.clone().sub(arcCenter);
        const radiusEndVec = ptEnd.clone().sub(arcCenter);

        const rotAxis = radiusStartVec.clone().cross(radiusEndVec).normalize();
        if (rotAxis.lengthSq() < 0.001) {
            expanded.push({ ...node });
            continue;
        }

        const arcAngle = radiusStartVec.angleTo(radiusEndVec);

        // Generate 16 arc samples for smooth CAD-grade curvature
        const SAMPLES = 16;

        // Compute start and end normals for the turn
        const normStartVec = (points[i - 1] && points[i - 1].normal)
            ? new THREE.Vector3(points[i - 1].normal.x, points[i - 1].normal.y, points[i - 1].normal.z).normalize()
            : null;
        const normEndVec = (points[i + 1] && points[i + 1].normal)
            ? new THREE.Vector3(points[i + 1].normal.x, points[i + 1].normal.y, points[i + 1].normal.z).normalize()
            : null;
        const fallbackNorm = (node && node.normal)
            ? new THREE.Vector3(node.normal.x, node.normal.y, node.normal.z).normalize()
            : (points[0] && points[0].normal
                ? new THREE.Vector3(points[0].normal.x, points[0].normal.y, points[0].normal.z).normalize()
                : new THREE.Vector3(0, 0, 1));

        const normStart = normStartVec || fallbackNorm;
        const normEnd = normEndVec || fallbackNorm;

        for (let k = 0; k <= SAMPLES; k++) {
            const frac = k / SAMPLES;
            const currentVec = radiusStartVec.clone().applyAxisAngle(rotAxis, arcAngle * frac);
            const arcPt = arcCenter.clone().add(currentVec);

            let sampleNormal;
            if (k === 0) {
                sampleNormal = normStart.clone();
            } else if (k === SAMPLES) {
                sampleNormal = normEnd.clone();
            } else {
                if (normStart.distanceToSquared(normEnd) < 0.001) {
                    sampleNormal = normStart.clone();
                } else {
                    sampleNormal = normStart.clone().applyAxisAngle(rotAxis, arcAngle * frac).normalize();
                    if (sampleNormal.dot(normEnd) < normStart.dot(normEnd) && arcAngle > 0.05) {
                        sampleNormal = normStart.clone().applyAxisAngle(rotAxis, -arcAngle * frac).normalize();
                    }
                }
            }

            expanded.push({
                x: arcPt.x,
                y: arcPt.y,
                z: arcPt.z,
                normal: { x: sampleNormal.x, y: sampleNormal.y, z: sampleNormal.z },
                isFilletSample: true,
                parentBendIndex: i
            });
        }
    }

    expanded.push({ ...points[n - 1] });
    return expanded;
}

/**
 * Builds complete 3D geometry for an elevation segment, including fillet bends,
 * mitered junctions, and optional T-branches.
 */
export function buildElevationSegmentGeometry(points, options = {}) {
    if (!points || points.length < 2) return null;

    const width = options.width || 30;
    const depth = options.depth || 40;

    // Expand path with curved fillet subdivisions where requested
    const path = expandPathWithFillets(points, width, depth);
    const numPoints = path.length;

    // Compute parallel-transport node frames
    const nodeFrames = [];
    let prevFrame = null;
    for (let i = 0; i < numPoints; i++) {
        const frame = computeNodeFrame(path, i, width, depth, options.defaultNormal, prevFrame, false);
        // Pin inner (back) vertices to the sharp wall corner node so inner edge stays flush against the wall
        if (path[i].isFilletSample && path[i].parentBendIndex !== undefined && points[path[i].parentBendIndex]) {
            const pCorner = points[path[i].parentBendIndex];
            frame[0].x = pCorner.x;
            frame[0].z = pCorner.z;
            frame[3].x = pCorner.x;
            frame[3].z = pCorner.z;
        }
        nodeFrames.push(frame);
        prevFrame = frame;
    }

    const positions = [];
    const uvs = [];
    const normals = [];
    const indices = [];

    let vertexOffset = 0;
    let accumulatedLen = 0;

    // Calculate total path length
    let totalLen = 0;
    for (let i = 0; i < numPoints - 1; i++) {
        const pA = path[i];
        const pB = path[i + 1];
        totalLen += Math.hypot(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);
    }

    // Build 4 quad strips around the beam
    for (let i = 0; i < numPoints - 1; i++) {
        const frameA = nodeFrames[i];
        const frameB = nodeFrames[i + 1];

        const pA = path[i];
        const pB = path[i + 1];
        const segLen = Math.hypot(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);
        const u0 = accumulatedLen / 100;
        const u1 = (accumulatedLen + segLen) / 100;
        accumulatedLen += segLen;

        const faces = [
            [0, 1], // Top / Left
            [1, 2], // Front face
            [2, 3], // Soffit (Bottom / Right)
            [3, 0]  // Back face (against wall)
        ];

        // Intrinsic outward normals for the 4 faces around the cross section
        const targetFaceNormals = [
            frameA.widthVec ? frameA.widthVec.clone().normalize() : new THREE.Vector3(0, 1, 0),              // Face 0: Top face
            frameA.normal ? frameA.normal.clone().normalize() : new THREE.Vector3(0, 0, 1),                  // Face 1: Front face
            frameA.widthVec ? frameA.widthVec.clone().negate().normalize() : new THREE.Vector3(0, -1, 0),    // Face 2: Bottom face
            frameA.normal ? frameA.normal.clone().negate().normalize() : new THREE.Vector3(0, 0, -1)        // Face 3: Back face
        ];

        faces.forEach(([idx0, idx1], faceIdx) => {
            const p00 = frameA[idx0];
            const p01 = frameA[idx1];
            const p10 = frameB[idx0];
            const p11 = frameB[idx1];

            // Face 3 is the back face against the wall.
            // On a corner fillet fan, both frameA and frameB back vertices meet at the sharp wall corner.
            if (faceIdx === 3 && path[i].isFilletSample && path[i + 1].isFilletSample) {
                return;
            }

            const outNorm = targetFaceNormals[faceIdx];
            const vHeight = (faceIdx === 0 || faceIdx === 2) ? (depth / 100) : (width / 100);

            // If p00 and p10 meet at the sharp wall corner (Face 0 Top or Face 2 Bottom),
            // render a clean 3-vertex triangle fan instead of a degenerate quad:
            if ((faceIdx === 0 || faceIdx === 2) && p00.distanceToSquared(p10) < 0.01) {
                const triNorm = new THREE.Vector3().crossVectors(
                    p01.clone().sub(p00),
                    p11.clone().sub(p01)
                );
                const isCCW = triNorm.dot(outNorm) >= 0;
                positions.push(
                    p00.x, p00.y, p00.z,
                    p01.x, p01.y, p01.z,
                    p11.x, p11.y, p11.z
                );
                for (let k = 0; k < 3; k++) normals.push(outNorm.x, outNorm.y, outNorm.z);
                uvs.push(u0, 0, u0, vHeight, u1, vHeight);
                if (isCCW) {
                    indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
                } else {
                    indices.push(vertexOffset, vertexOffset + 2, vertexOffset + 1);
                }
                vertexOffset += 3;
                return;
            }

            // Determine CCW triangle winding against outward normal
            const testTriNorm = new THREE.Vector3().crossVectors(
                p01.clone().sub(p00),
                p11.clone().sub(p01)
            );
            const isCCW = testTriNorm.dot(outNorm) >= 0;

            positions.push(
                p00.x, p00.y, p00.z,
                p01.x, p01.y, p01.z,
                p11.x, p11.y, p11.z,
                p10.x, p10.y, p10.z
            );

            if (faceIdx === 1) {
                // Smooth vertex normals along the front face (curved cylinder / continuous ribbon)
                const normA = frameA.normal ? frameA.normal.clone().normalize() : outNorm;
                const normB = frameB.normal ? frameB.normal.clone().normalize() : outNorm;
                normals.push(
                    normA.x, normA.y, normA.z,
                    normA.x, normA.y, normA.z,
                    normB.x, normB.y, normB.z,
                    normB.x, normB.y, normB.z
                );
            } else {
                for (let k = 0; k < 4; k++) normals.push(outNorm.x, outNorm.y, outNorm.z);
            }

            uvs.push(
                u0, 0,
                u0, vHeight,
                u1, vHeight,
                u1, 0
            );

            if (isCCW) {
                indices.push(
                    vertexOffset, vertexOffset + 1, vertexOffset + 2,
                    vertexOffset, vertexOffset + 2, vertexOffset + 3
                );
            } else {
                // Inverted winding: reverse to maintain strictly CCW front-facing triangles
                indices.push(
                    vertexOffset, vertexOffset + 2, vertexOffset + 1,
                    vertexOffset, vertexOffset + 3, vertexOffset + 2
                );
            }
            vertexOffset += 4;
        });
    }

    // Start cap
    const startF = nodeFrames[0];
    const startNorm = new THREE.Vector3(path[0].x - path[1].x, path[0].y - path[1].y, path[0].z - path[1].z).normalize();
    const sc0 = startF[0], sc1 = startF[3], sc2 = startF[2], sc3 = startF[1];
    const scTriNorm = new THREE.Vector3().crossVectors(sc1.clone().sub(sc0), sc2.clone().sub(sc1));
    const scIsCCW = scTriNorm.dot(startNorm) >= 0;

    positions.push(
        sc0.x, sc0.y, sc0.z,
        sc1.x, sc1.y, sc1.z,
        sc2.x, sc2.y, sc2.z,
        sc3.x, sc3.y, sc3.z
    );
    for (let k = 0; k < 4; k++) normals.push(startNorm.x, startNorm.y, startNorm.z);
    uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
    if (scIsCCW) {
        indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
    } else {
        indices.push(vertexOffset, vertexOffset + 2, vertexOffset + 1, vertexOffset, vertexOffset + 3, vertexOffset + 2);
    }
    vertexOffset += 4;

    // End cap
    const endF = nodeFrames[numPoints - 1];
    const endNorm = new THREE.Vector3(path[numPoints - 1].x - path[numPoints - 2].x, path[numPoints - 1].y - path[numPoints - 2].y, path[numPoints - 1].z - path[numPoints - 2].z).normalize();
    const ec0 = endF[0], ec1 = endF[1], ec2 = endF[2], ec3 = endF[3];
    const ecTriNorm = new THREE.Vector3().crossVectors(ec1.clone().sub(ec0), ec2.clone().sub(ec1));
    const ecIsCCW = ecTriNorm.dot(endNorm) >= 0;

    positions.push(
        ec0.x, ec0.y, ec0.z,
        ec1.x, ec1.y, ec1.z,
        ec2.x, ec2.y, ec2.z,
        ec3.x, ec3.y, ec3.z
    );
    for (let k = 0; k < 4; k++) normals.push(endNorm.x, endNorm.y, endNorm.z);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    if (ecIsCCW) {
        indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
    } else {
        indices.push(vertexOffset, vertexOffset + 2, vertexOffset + 1, vertexOffset, vertexOffset + 3, vertexOffset + 2);
    }
    vertexOffset += 4;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingBox();

    // Spotlights on horizontal spans
    const spotlights = [];
    if (options.hasSpotlights === true) {
        const spacing = options.spotlightSpacing || 80;
        for (let i = 0; i < numPoints - 1; i++) {
            const pA = path[i];
            const pB = path[i + 1];
            const dy = Math.abs(pB.y - pA.y);
            const segLen = Math.hypot(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);

            if (dy < segLen * 0.15 && segLen >= 40) {
                const count = Math.max(1, Math.floor(segLen / spacing));
                const frameA = nodeFrames[i];
                const frameB = nodeFrames[i + 1];

                // Dynamically find the bottom face (minimum average Y)
                const facePairs = [[0, 1], [1, 2], [2, 3], [3, 0]];
                let bestPair = facePairs[2];
                let minY = Infinity;
                for (const pair of facePairs) {
                    const avgY = (frameA[pair[0]].y + frameA[pair[1]].y + frameB[pair[0]].y + frameB[pair[1]].y) / 4;
                    if (avgY < minY) {
                        minY = avgY;
                        bestPair = pair;
                    }
                }

                for (let s = 1; s <= count; s++) {
                    const t = s / (count + 1);
                    const b0 = frameA[bestPair[0]].clone().lerp(frameB[bestPair[0]], t);
                    const b1 = frameA[bestPair[1]].clone().lerp(frameB[bestPair[1]], t);
                    const centerPt = b0.clone().lerp(b1, 0.5);

                    spotlights.push({
                        x: centerPt.x,
                        y: centerPt.y,
                        z: centerPt.z,
                        radius: 3.5,
                        depth: 1.0,
                        segmentIndex: i
                    });
                }
            }
        }
    }

    return {
        geometry: geo,
        spotlights,
        totalLength: totalLen,
        nodeFrames,
        expandedPath: path
    };
}

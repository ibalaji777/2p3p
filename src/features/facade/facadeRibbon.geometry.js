import * as THREE from 'three';

/**
 * Normalizes UV coordinates across ribbon BufferGeometry for physical texel scaling.
 */
export const normalizeRibbonUVs = (geo, totalLength, perimeter, tileSize = 100) => {
    if (!geo || !geo.attributes || !geo.attributes.uv || !geo.attributes.position) return geo;
    const uvs = geo.attributes.uv;
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;

    if (!geo.boundingBox) geo.computeBoundingBox();
    const bbox = geo.boundingBox;

    for (let i = 0; i < uvs.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const ny = norm ? Math.abs(norm.getY(i)) : 0;
        const nz = norm ? Math.abs(norm.getZ(i)) : 0;

        if (ny > 0.6) {
            uvs.setXY(i, (vx - bbox.min.x) / tileSize, (vz - bbox.min.z) / tileSize);
        } else if (nz > 0.6) {
            uvs.setXY(i, (vx - bbox.min.x) / tileSize, (vy - bbox.min.y) / tileSize);
        } else {
            uvs.setXY(i, (vz - bbox.min.z) / tileSize, (vy - bbox.min.y) / tileSize);
        }
    }
    uvs.needsUpdate = true;
    return geo;
};

/**
 * Computes 3D bisector miter cross-section vertices at node i of a 3D polyline.
 * Cross-section sits flush on the wall surface and cantilevers outward along normal N.
 * Uses parallel transport to ensure zero twisting across both 90° horizontal building corner
 * wraps, vertical elbow L-turns, and closed box frames.
 */
export const computeNodeFrame = (points, index, width, depth, defaultNormal = null, prevFrame = null, isClosed = false) => {
    const p = new THREE.Vector3(points[index].x, points[index].y, points[index].z);
    const n = points.length;

    let dirIn = null;
    let dirOut = null;

    if (index > 0) {
        const prev = new THREE.Vector3(points[index - 1].x, points[index - 1].y, points[index - 1].z);
        dirIn = p.clone().sub(prev).normalize();
    } else if (isClosed && n > 2) {
        const prev = new THREE.Vector3(points[n - 2].x, points[n - 2].y, points[n - 2].z);
        dirIn = p.clone().sub(prev).normalize();
    }

    if (index < n - 1) {
        const next = new THREE.Vector3(points[index + 1].x, points[index + 1].y, points[index + 1].z);
        dirOut = next.clone().sub(p).normalize();
    } else if (isClosed && n > 2) {
        const next = new THREE.Vector3(points[1].x, points[1].y, points[1].z);
        dirOut = next.clone().sub(p).normalize();
    }

    let tangent;
    if (dirIn && dirOut) {
        tangent = dirIn.clone().add(dirOut).normalize();
        if (tangent.lengthSq() < 0.0001) tangent = dirOut.clone();
    } else if (dirIn) {
        tangent = dirIn.clone();
    } else if (dirOut) {
        tangent = dirOut.clone();
    } else {
        tangent = new THREE.Vector3(1, 0, 0);
    }

    // Determine normal N for this node
    let normal = null;
    if (points[index].normal) {
        const pn = points[index].normal;
        normal = new THREE.Vector3(pn.x, pn.y, pn.z).normalize();
    } else if (prevFrame && prevFrame.normal) {
        normal = prevFrame.normal.clone();
    } else if (defaultNormal) {
        normal = defaultNormal.clone().normalize();
    }

    // If still no normal provided, find any defined normal in the path
    if (!normal || normal.lengthSq() < 0.001) {
        for (let k = 0; k < n; k++) {
            if (points[k].normal) {
                const pn = points[k].normal;
                normal = new THREE.Vector3(pn.x, pn.y, pn.z).normalize();
                break;
            }
        }
    }

    // Fallback normal if none in points
    if (!normal || normal.lengthSq() < 0.001) {
        let horizDir = null;
        if (dirIn && (Math.abs(dirIn.x) > 0.01 || Math.abs(dirIn.z) > 0.01)) {
            horizDir = new THREE.Vector3(dirIn.x, 0, dirIn.z).normalize();
        } else if (dirOut && (Math.abs(dirOut.x) > 0.01 || Math.abs(dirOut.z) > 0.01)) {
            horizDir = new THREE.Vector3(dirOut.x, 0, dirOut.z).normalize();
        }

        if (horizDir) {
            normal = new THREE.Vector3(-horizDir.z, 0, horizDir.x).normalize();
        } else {
            normal = new THREE.Vector3(0, 0, 1);
        }
    }

    // Miter expansion factor at corner bisectors
    let miterScaleDepth = 1.0;
    let miterScaleWidth = 1.0;

    const isFilletSample = Boolean(points[index] && points[index].isFilletSample);
    if (dirIn && dirOut && !isFilletSample) {
        const dot = dirIn.dot(dirOut);
        const clampedDot = Math.max(-0.85, Math.min(0.99, dot));
        const angleFactor = Math.sqrt(2 / (1 + clampedDot));
        const safeScale = Math.min(2.5, angleFactor);

        // Turn classification:
        // Horizontal turn around building corner: normal bisector expands depth
        const isHorizTurn = Math.abs(dirIn.y) < 0.25 && Math.abs(dirOut.y) < 0.25;
        if (isHorizTurn) {
            miterScaleDepth = safeScale;
        } else {
            // Vertical or L-bend turn on the wall: width expands along 45° miter line
            miterScaleWidth = safeScale;
        }
    }

    // Width axis is perpendicular to tangent and outward normal: N x T
    let widthVec = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    if (widthVec.lengthSq() < 0.001) {
        widthVec = new THREE.Vector3(0, 1, 0);
    }

    // Parallel transport: align widthVec consistently with the previous node
    if (prevFrame && prevFrame.widthVec) {
        if (prevFrame.widthVec.dot(widthVec) < -0.05) {
            widthVec.negate();
        }
    } else {
        // Initial node: if moving primarily horizontal, prefer +Y upwards
        if (Math.abs(tangent.y) < 0.5 && widthVec.y < 0) {
            widthVec.negate();
        }
    }

    const hw = (width / 2) * miterScaleWidth;
    const effDepth = depth * miterScaleDepth;

    // 4 Corner Vertices of Cross Section:
    // 0: Back-Top / Left (flush on wall surface)
    // 1: Front-Top / Left (cantilevered outward by effDepth along normal)
    // 2: Front-Bottom / Right (cantilevered outward by effDepth along normal)
    // 3: Back-Bottom / Right (flush on wall surface)
    const v0 = p.clone().add(widthVec.clone().multiplyScalar(hw));
    const v3 = p.clone().add(widthVec.clone().multiplyScalar(-hw));
    const v1 = v0.clone().add(normal.clone().multiplyScalar(effDepth));
    const v2 = v3.clone().add(normal.clone().multiplyScalar(effDepth));

    const vertices = [v0, v1, v2, v3];
    vertices.widthVec = widthVec;
    vertices.normal = normal;

    return vertices;
};

/**
 * Sweeps a 3D rectangular beam profile along a 3D polyline with gapless bisector miters.
 */
export const buildRibbon3DGeometry = (points, options = {}) => {
    if (!points || points.length < 2) return null;

    // Filter out duplicate or near-coincident consecutive points (< 2 cm)
    const filteredPoints = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const prev = filteredPoints[filteredPoints.length - 1];
        const cur = points[i];
        const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z);
        if (dist > 2) {
            filteredPoints.push(cur);
        }
    }
    if (filteredPoints.length < 2) return null;

    const width = options.width || 40;  // profile thickness / drop
    const depth = options.depth || 50;  // cantilever overhang
    const pts = filteredPoints;
    const numPoints = pts.length;

    // Check if the polyline forms a closed box loop
    const pStart = pts[0];
    const pEnd = pts[numPoints - 1];
    const isClosed = numPoints >= 4 && Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y, pEnd.z - pStart.z) < 15;

    // Compute 4 corner vertices for every node along the 3D path with parallel transport
    const nodeFrames = [];
    let prevFrame = null;
    for (let i = 0; i < numPoints; i++) {
        const frame = computeNodeFrame(pts, i, width, depth, options.defaultNormal, prevFrame, isClosed);
        nodeFrames.push(frame);
        prevFrame = frame;
    }

    if (isClosed) {
        nodeFrames[numPoints - 1] = nodeFrames[0];
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
        const pA = pts[i];
        const pB = pts[i + 1];
        totalLen += Math.hypot(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);
    }

    // Build 4 side quad strips for each segment connecting nodeFrames[i] to nodeFrames[i+1]
    for (let i = 0; i < numPoints - 1; i++) {
        const frameA = nodeFrames[i];
        const frameB = nodeFrames[i + 1];

        const pA = pts[i];
        const pB = pts[i + 1];
        const segLen = Math.hypot(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);
        const u0 = accumulatedLen / 100;
        const u1 = (accumulatedLen + segLen) / 100;
        accumulatedLen += segLen;

        // 4 Faces around the beam:
        // Face 0 (Top / Left): v0 -> v1 (frameA to frameB)
        // Face 1 (Front): v1 -> v2
        // Face 2 (Bottom / Right): v2 -> v3
        // Face 3 (Back): v3 -> v0
        const faces = [
            [0, 1], // Top / Left
            [1, 2], // Front
            [2, 3], // Soffit (Bottom / Right)
            [3, 0]  // Back
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

            const outNorm = targetFaceNormals[faceIdx];

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

            for (let k = 0; k < 4; k++) {
                normals.push(outNorm.x, outNorm.y, outNorm.z);
            }

            uvs.push(
                u0, 0,
                u0, 1,
                u1, 1,
                u1, 0
            );

            if (isCCW) {
                indices.push(
                    vertexOffset, vertexOffset + 1, vertexOffset + 2,
                    vertexOffset, vertexOffset + 2, vertexOffset + 3
                );
            } else {
                indices.push(
                    vertexOffset, vertexOffset + 2, vertexOffset + 1,
                    vertexOffset, vertexOffset + 3, vertexOffset + 2
                );
            }
            vertexOffset += 4;
        });
    }

    // Only add start and end caps if NOT a closed loop
    if (!isClosed) {
        // Start Cap (at node 0)
        const startF = nodeFrames[0];
        const startNorm = new THREE.Vector3(pts[0].x - pts[1].x, pts[0].y - pts[1].y, pts[0].z - pts[1].z).normalize();
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

        // End Cap (at node n-1)
        const endF = nodeFrames[numPoints - 1];
        const endNorm = new THREE.Vector3(pts[numPoints - 1].x - pts[numPoints - 2].x, pts[numPoints - 1].y - pts[numPoints - 2].y, pts[numPoints - 1].z - pts[numPoints - 2].z).normalize();
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
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingBox();

    // Calculate Spotlights on downward-facing segments
    const spotlights = [];
    if (options.hasSpotlights !== false) {
        const spacing = options.spotlightSpacing || 80;
        for (let i = 0; i < numPoints - 1; i++) {
            const pA = points[i];
            const pB = points[i + 1];
            const dy = Math.abs(pB.y - pA.y);
            const segLen = Math.hypot(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);

            // If segment is primarily horizontal (elevation difference < 15% of length)
            if (dy < segLen * 0.15 && segLen >= 40) {
                const count = Math.max(1, Math.floor(segLen / spacing));
                const frameA = nodeFrames[i];
                const frameB = nodeFrames[i + 1];

                for (let s = 1; s <= count; s++) {
                    const t = s / (count + 1);
                    // Bottom center point at t
                    const b0 = frameA[2].clone().lerp(frameB[2], t);
                    const b1 = frameA[3].clone().lerp(frameB[3], t);
                    const centerPt = b0.clone().lerp(b1, 0.5);

                    spotlights.push({
                        x: centerPt.x,
                        y: centerPt.y + 0.5,
                        z: centerPt.z,
                        radius: 3.5,
                        depth: 1.5,
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
        nodeFrames
    };
};

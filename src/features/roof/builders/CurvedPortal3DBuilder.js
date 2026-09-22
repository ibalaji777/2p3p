import * as THREE from 'three';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';
import { ROOF_DECOR_REGISTRY, WALL_DECOR_REGISTRY } from '../../../core/registry.js';

/**
 * CurvedPortal3DBuilder
 * 
 * Specialized CAD/BIM 3D Geometry Builder for Modern Curved Portal / Wrap Roofs.
 * 
 * Features:
 * 1. Parametric 90° circular fillet arcs at the junction between the horizontal
 *    roof/canopy slab and vertical drop walls.
 * 2. Concentric outer ($R$) and inner ($\max(0, R - T)$) fillets for uniform slab thickness.
 * 3. Sharp 90° default when radius is 0; smooth continuous curvature when radius > 0.
 * 4. Selective wall sides: Left, Right, Front, Back, with clean miters and end caps.
 * 5. Under-soffit ceiling with optional recessed LED spotlights (downlights).
 * 6. Multi-slot ComponentRegistry integration: 'outer', 'ceiling', 'fascia', 'spotlights'.
 * 7. Relative Y coordinates aligned with Roof3DBuilder's roofGroup (Y = 0 is top slab, Y = -dropHeight is floor).
 */
export class CurvedPortal3DBuilder {
    static build(roof, conf, pts, h, ctx, resolveRoofMaterial) {
        const group = new THREE.Group();
        group.name = `CurvedPortalRoof_${roof.id || 'new'}`;

        // 1. Dimensions and Parameters
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pts.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });

        const W = Math.max(20, maxX - minX);
        const D = Math.max(20, maxY - minY);
        const T = Math.max(4, Number(conf.thickness) || 15);

        // Corner fillet radius (cm)
        const cornerRadii = conf.cornerRadii || roof?.cornerRadii;
        let R = conf.radius !== undefined ? Math.max(0, Number(conf.radius)) : 0;
        const maxR = Math.min(W / 2 - 1, D / 2 - 1, 150);
        R = Math.min(R, Math.max(0, maxR));

        const R_left = Math.min(Math.max(0, (cornerRadii?.[0] !== undefined) ? Number(cornerRadii[0]) : R), maxR);
        const R_right = Math.min(Math.max(0, (cornerRadii?.[1] !== undefined) ? Number(cornerRadii[1]) : R), maxR);
        const R_front = Math.min(Math.max(0, (cornerRadii?.[2] !== undefined) ? Number(cornerRadii[2]) : R), maxR);
        const R_back = Math.min(Math.max(0, (cornerRadii?.[3] !== undefined) ? Number(cornerRadii[3]) : R), maxR);

        const rInner_left = Math.max(0, R_left - T);
        const rInner_right = Math.max(0, R_right - T);
        const rInner_front = Math.max(0, R_front - T);
        const rInner_back = Math.max(0, R_back - T);

        const maxRadius = Math.max(R_left, R_right, R_front, R_back);

        // Active wall sides
        const wallSides = conf.wallSides || {
            left: conf.wallLeft !== undefined ? Boolean(conf.wallLeft) : true,
            right: conf.wallRight !== undefined ? Boolean(conf.wallRight) : true,
            front: Boolean(conf.wallFront),
            back: Boolean(conf.wallBack)
        };

        // Downward wall drop height (cm)
        // If not specified or 0, drop all the way to floor level (y = 0 in world, which is -h in local mesh)
        let dropHeight = conf.wallDropHeight !== undefined && Number(conf.wallDropHeight) > 0
            ? Number(conf.wallDropHeight)
            : h;
        dropHeight = Math.max(maxRadius + 5, Math.min(h, dropHeight));

        // Detect existing below walls to automatically connect flush with zero overlap
        const allWalls = (ctx?.walls) || (roof.planner?.walls) || (roof._planner?.walls) || (ctx?.helpers?.getPlanner?.()?.walls) || [];
        const roofElev = roof.elevation !== undefined ? Number(roof.elevation) : h;

        const getBelowWallForEdge = (edge) => {
            if (!allWalls || allWalls.length === 0) return null;

            // 1. Check explicit connection via conf.connectedWallId
            if (conf.connectedWallId) {
                const cw = allWalls.find(w => w.id === conf.connectedWallId);
                if (cw) {
                    const p1 = cw.startAnchor?.position ? cw.startAnchor.position() : { x: cw.x1 || cw.startX || 0, y: cw.y1 || cw.startY || 0 };
                    const p2 = cw.endAnchor?.position ? cw.endAnchor.position() : { x: cw.x2 || cw.endX || 0, y: cw.y2 || cw.endY || 0 };
                    const wMidX = (p1.x + p2.x) / 2;
                    const wMidY = (p1.y + p2.y) / 2;
                    if (edge === 'left' && Math.abs(wMidX - minX) < 35) return cw;
                    if (edge === 'right' && Math.abs(wMidX - maxX) < 35) return cw;
                    if (edge === 'back' && Math.abs(wMidY - minY) < 35) return cw;
                    if (edge === 'front' && Math.abs(wMidY - maxY) < 35) return cw;
                }
            }

            // 2. Spatial scan across all walls in scene
            for (const w of allWalls) {
                if (w.hidden || w.isAutoGable || w.parentRoofId) continue;
                const p1 = w.startAnchor?.position ? w.startAnchor.position() : { x: w.x1 || w.startX || 0, y: w.y1 || w.startY || 0 };
                const p2 = w.endAnchor?.position ? w.endAnchor.position() : { x: w.x2 || w.endX || 0, y: w.y2 || w.endY || 0 };
                const wTop = (Number(w.elevation) || 0) + (w.height !== undefined ? Number(w.height) : (Number(w.config?.height) || 120));

                if (wTop > roofElev + 5) continue;

                const wMidX = (p1.x + p2.x) / 2;
                const wMidY = (p1.y + p2.y) / 2;

                if (edge === 'left' && Math.abs(wMidX - minX) < 25 && wMidY >= minY - 25 && wMidY <= maxY + 25) return w;
                if (edge === 'right' && Math.abs(wMidX - maxX) < 25 && wMidY >= minY - 25 && wMidY <= maxY + 25) return w;
                if (edge === 'back' && Math.abs(wMidY - minY) < 25 && wMidX >= minX - 25 && wMidX <= maxX + 25) return w;
                if (edge === 'front' && Math.abs(wMidY - maxY) < 25 && wMidX >= minX - 25 && wMidX <= maxX + 25) return w;
            }
            return null;
        };

        const getWallBottomY = (edge) => {
            const belowW = getBelowWallForEdge(edge);
            if (belowW) {
                const wTop = (Number(belowW.elevation) || 0) + (belowW.height !== undefined ? Number(belowW.height) : (Number(belowW.config?.height) || 120));
                const diff = roofElev - wTop;
                return -Math.max(0, Math.round(diff * 10) / 10);
            }
            return -dropHeight;
        };

        const wallBottomYLeft = getWallBottomY('left');
        const wallBottomYRight = getWallBottomY('right');
        const wallBottomYBack = getWallBottomY('back');
        const wallBottomYFront = getWallBottomY('front');

        // 2. Materials
        const outerMatInfo = resolveRoofMaterial(conf.material || 'white_plaster_wall');
        const outerMat = outerMatInfo.mat;
        outerMat.side = THREE.DoubleSide;

        const ceilingKey = conf.undersideMaterial || conf.ceilingMaterial || 'white_plaster_wall';
        const ceilingMat = (ctx?.helpers?.getDynamicMaterial ? ctx.helpers.getDynamicMaterial(ceilingKey, 'wall') : null)
            || new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 });
        ceilingMat.side = THREE.DoubleSide;

        const fasciaKey = conf.fasciaMaterial || 'metal_dark_steel';
        const fasciaMat = (ctx?.helpers?.getDynamicMaterial ? ctx.helpers.getDynamicMaterial(fasciaKey, 'metal') : null)
            || new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.5 });
        fasciaMat.side = THREE.DoubleSide;

        // 3. Coordinate Bounds for Top Slab
        const hasLeft = Boolean(wallSides.left);
        const hasRight = Boolean(wallSides.right);
        const hasFront = Boolean(wallSides.front);
        const hasBack = Boolean(wallSides.back);

        const slabMinX = hasLeft ? (minX + R_left) : minX;
        const slabMaxX = hasRight ? (maxX - R_right) : maxX;
        const slabMinZ = hasBack ? (minY + R_back) : minY;
        const slabMaxZ = hasFront ? (maxY - R_front) : maxY;

        const outerV = [], outerUV = [], outerNorm = [];
        const ceilV = [], ceilUV = [], ceilNorm = [];
        const fasciaV = [], fasciaUV = [], fasciaNorm = [];

        const addQuad = (vArr, uvArr, nArr, p0, p1, p2, p3, normal, uScale = 100, vScale = 100) => {
            vArr.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
            nArr.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);
            uvArr.push(p0.x / uScale, p0.z / vScale, p1.x / uScale, p1.z / vScale, p2.x / uScale, p2.z / vScale);

            vArr.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
            nArr.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);
            uvArr.push(p0.x / uScale, p0.z / vScale, p2.x / uScale, p2.z / vScale, p3.x / uScale, p3.z / vScale);
        };

        const addQuadVertical = (vArr, uvArr, nArr, p0, p1, p2, p3, normal) => {
            vArr.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
            nArr.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);
            uvArr.push(p0.z / 100, p0.y / 100, p1.z / 100, p1.y / 100, p2.z / 100, p2.y / 100);

            vArr.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
            nArr.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);
            uvArr.push(p0.z / 100, p0.y / 100, p2.z / 100, p2.y / 100, p3.z / 100, p3.y / 100);
        };

        const addQuadFrontBack = (vArr, uvArr, nArr, p0, p1, p2, p3, normal) => {
            vArr.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
            nArr.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);
            uvArr.push(p0.x / 100, p0.y / 100, p1.x / 100, p1.y / 100, p2.x / 100, p2.y / 100);

            vArr.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
            nArr.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);
            uvArr.push(p0.x / 100, p0.y / 100, p2.x / 100, p2.y / 100, p3.x / 100, p3.y / 100);
        };

        // --- A. TOP HORIZONTAL ROOF SLAB ---
        if (pts && pts.length > 4) {
            // Arbitrary N-sided polygon slab (Option B polyline footprint)
            try {
                const flatPoints = pts.map(p => new THREE.Vector2(p.x, p.y));
                const triangles = THREE.ShapeUtils.triangulateShape(flatPoints, []);

                // Top Surface (+Y, Outer Material) at Y = 0
                for (const tri of triangles) {
                    const p0 = pts[tri[0]], p1 = pts[tri[1]], p2 = pts[tri[2]];
                    outerV.push(p0.x, 0, p0.y, p1.x, 0, p1.y, p2.x, 0, p2.y);
                    outerNorm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
                    outerUV.push(p0.x / 100, p0.y / 100, p1.x / 100, p1.y / 100, p2.x / 100, p2.y / 100);
                }

                // Underside Soffit (-Y, Ceiling Material) at Y = -T
                for (const tri of triangles) {
                    const p0 = pts[tri[0]], p1 = pts[tri[1]], p2 = pts[tri[2]];
                    ceilV.push(p0.x, -T, p0.y, p2.x, -T, p2.y, p1.x, -T, p1.y);
                    ceilNorm.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
                    ceilUV.push(p0.x / 100, p0.y / 100, p2.x / 100, p2.y / 100, p1.x / 100, p1.y / 100);
                }

                // Perimeter Fascia along every polygon edge
                for (let i = 0; i < pts.length; i++) {
                    const j = (i + 1) % pts.length;
                    const pi = pts[i], pj = pts[j];
                    const edx = pj.x - pi.x, edz = pj.y - pi.y;
                    const elen = Math.hypot(edx, edz);
                    if (elen < 0.1) continue;
                    const enx = -edz / elen, enz = edx / elen;

                    fasciaV.push(
                        pi.x, 0, pi.y,  pj.x, 0, pj.y,  pj.x, -T, pj.y,
                        pi.x, 0, pi.y,  pj.x, -T, pj.y,  pi.x, -T, pi.y
                    );
                    fasciaNorm.push(enx, 0, enz, enx, 0, enz, enx, 0, enz, enx, 0, enz, enx, 0, enz, enx, 0, enz);
                    fasciaUV.push(0, 0, elen / 100, 0, elen / 100, T / 100, 0, 0, elen / 100, T / 100, 0, T / 100);
                }
            } catch (err) {}
        } else if (slabMaxX > slabMinX && slabMaxZ > slabMinZ) {
            // Standard 4-point bounding box slab
            // Top Surface (+Y, Outer Material) at Y = 0
            const upNorm = { x: 0, y: 1, z: 0 };
            addQuad(outerV, outerUV, outerNorm,
                { x: slabMinX, y: 0, z: slabMinZ },
                { x: slabMaxX, y: 0, z: slabMinZ },
                { x: slabMaxX, y: 0, z: slabMaxZ },
                { x: slabMinX, y: 0, z: slabMaxZ },
                upNorm
            );

            // Underside Soffit (-Y, Ceiling Material) at Y = -T
            const downNorm = { x: 0, y: -1, z: 0 };
            addQuad(ceilV, ceilUV, ceilNorm,
                { x: slabMinX, y: -T, z: slabMaxZ },
                { x: slabMaxX, y: -T, z: slabMaxZ },
                { x: slabMaxX, y: -T, z: slabMinZ },
                { x: slabMinX, y: -T, z: slabMinZ },
                downNorm
            );
        }

        // --- B. CURVED FILLET ARCS & VERTICAL DROP WALLS ---
        const isFourSided = !pts || pts.length <= 4;
        if (isFourSided) {
            const arcSubdivs = R > 0 ? 16 : 1;

            // 1. LEFT WALL (-X)
        if (hasLeft) {
            const arcSubdivsLeft = R_left > 0 ? 16 : 1;
            const z0 = slabMinZ;
            const z1 = slabMaxZ;
            const xc = minX + R_left;
            const yc = -R_left;

            if (R_left > 0) {
                // 90° Fillet Arc from theta = PI/2 (top, Y = 0) to theta = PI (left, Y = -R)
                for (let i = 0; i < arcSubdivsLeft; i++) {
                    const a0 = Math.PI / 2 + (i / arcSubdivsLeft) * (Math.PI / 2);
                    const a1 = Math.PI / 2 + ((i + 1) / arcSubdivsLeft) * (Math.PI / 2);

                    const cos0 = Math.cos(a0), sin0 = Math.sin(a0);
                    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);

                    const xOut0 = xc + R_left * cos0, yOut0 = yc + R_left * sin0;
                    const xOut1 = xc + R_left * cos1, yOut1 = yc + R_left * sin1;

                    outerV.push(
                        xOut0, yOut0, z0,  xOut1, yOut1, z0,  xOut1, yOut1, z1,
                        xOut0, yOut0, z0,  xOut1, yOut1, z1,  xOut0, yOut0, z1
                    );
                    outerNorm.push(
                        cos0, sin0, 0,  cos1, sin1, 0,  cos1, sin1, 0,
                        cos0, sin0, 0,  cos1, sin1, 0,  cos0, sin0, 0
                    );
                    outerUV.push(
                        z0 / 100, yOut0 / 100,  z0 / 100, yOut1 / 100,  z1 / 100, yOut1 / 100,
                        z0 / 100, yOut0 / 100,  z1 / 100, yOut1 / 100,  z1 / 100, yOut0 / 100
                    );

                    if (rInner_left > 0) {
                        const xIn0 = xc + rInner_left * cos0, yIn0 = yc + rInner_left * sin0;
                        const xIn1 = xc + rInner_left * cos1, yIn1 = yc + rInner_left * sin1;

                        ceilV.push(
                            xIn0, yIn0, z1,  xIn1, yIn1, z1,  xIn1, yIn1, z0,
                            xIn0, yIn0, z1,  xIn1, yIn1, z0,  xIn0, yIn0, z0
                        );
                        ceilNorm.push(
                            -cos0, -sin0, 0,  -cos1, -sin1, 0,  -cos1, -sin1, 0,
                            -cos0, -sin0, 0,  -cos1, -sin1, 0,  -cos0, -sin0, 0
                        );
                        ceilUV.push(
                            z1 / 100, yIn0 / 100,  z1 / 100, yIn1 / 100,  z0 / 100, yIn1 / 100,
                            z1 / 100, yIn0 / 100,  z0 / 100, yIn1 / 100,  z0 / 100, yIn0 / 100
                        );
                    }

                    // Side End Caps of the Fillet Arc (Fascia)
                    if (!hasBack) {
                        fasciaV.push(
                            xOut0, yOut0, z0,  xOut1, yOut1, z0,  xc + rInner_left * cos1, yc + rInner_left * sin1, z0,
                            xOut0, yOut0, z0,  xc + rInner_left * cos1, yc + rInner_left * sin1, z0,  xc + rInner_left * cos0, yc + rInner_left * sin0, z0
                        );
                        fasciaNorm.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
                        fasciaUV.push(xOut0 / 100, yOut0 / 100, xOut1 / 100, yOut1 / 100, xOut1 / 100, yOut1 / 100, xOut0 / 100, yOut0 / 100, xOut1 / 100, yOut1 / 100, xOut0 / 100, yOut0 / 100);
                    }

                    if (!hasFront) {
                        fasciaV.push(
                            xOut0, yOut0, z1,  xc + rInner_left * cos1, yc + rInner_left * sin1, z1,  xOut1, yOut1, z1,
                            xOut0, yOut0, z1,  xc + rInner_left * cos0, yc + rInner_left * sin0, z1,  xc + rInner_left * cos1, yc + rInner_left * sin1, z1
                        );
                        fasciaNorm.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
                        fasciaUV.push(xOut0 / 100, yOut0 / 100, xOut1 / 100, yOut1 / 100, xOut1 / 100, yOut1 / 100, xOut0 / 100, yOut0 / 100, xOut1 / 100, yOut1 / 100, xOut0 / 100, yOut0 / 100);
                    }
                }
            }

            // Vertical Wall Drop
            const wallTopY = -R_left;
            const wallOuterX = minX;
            const wallInnerX = minX + T;

            // Outer Face (-X)
            addQuadVertical(outerV, outerUV, outerNorm,
                { x: wallOuterX, y: wallTopY, z: z1 },
                { x: wallOuterX, y: wallTopY, z: z0 },
                { x: wallOuterX, y: wallBottomYLeft, z: z0 },
                { x: wallOuterX, y: wallBottomYLeft, z: z1 },
                { x: -1, y: 0, z: 0 }
            );

            // Inner Face (+X, Ceiling/Interior Material)
            addQuadVertical(ceilV, ceilUV, ceilNorm,
                { x: wallInnerX, y: wallTopY, z: z0 },
                { x: wallInnerX, y: wallTopY, z: z1 },
                { x: wallInnerX, y: wallBottomYLeft, z: z1 },
                { x: wallInnerX, y: wallBottomYLeft, z: z0 },
                { x: 1, y: 0, z: 0 }
            );

            // Bottom Edge Cap (-Y)
            addQuad(fasciaV, fasciaUV, fasciaNorm,
                { x: wallOuterX, y: wallBottomYLeft, z: z0 },
                { x: wallInnerX, y: wallBottomYLeft, z: z0 },
                { x: wallInnerX, y: wallBottomYLeft, z: z1 },
                { x: wallOuterX, y: wallBottomYLeft, z: z1 },
                { x: 0, y: -1, z: 0 }
            );

            // Wall Vertical Side Caps (North and South if open)
            if (!hasBack) {
                addQuadFrontBack(fasciaV, fasciaUV, fasciaNorm,
                    { x: wallOuterX, y: wallTopY, z: z0 },
                    { x: wallInnerX, y: wallTopY, z: z0 },
                    { x: wallInnerX, y: wallBottomYLeft, z: z0 },
                    { x: wallOuterX, y: wallBottomYLeft, z: z0 },
                    { x: 0, y: 0, z: -1 }
                );
            }
            if (!hasFront) {
                addQuadFrontBack(fasciaV, fasciaUV, fasciaNorm,
                    { x: wallInnerX, y: wallTopY, z: z1 },
                    { x: wallOuterX, y: wallTopY, z: z1 },
                    { x: wallOuterX, y: wallBottomYLeft, z: z1 },
                    { x: wallInnerX, y: wallBottomYLeft, z: z1 },
                    { x: 0, y: 0, z: 1 }
                );
            }
        }

        // 2. RIGHT WALL (+X)
        if (hasRight) {
            const arcSubdivsRight = R_right > 0 ? 16 : 1;
            const z0 = slabMinZ;
            const z1 = slabMaxZ;
            const xc = maxX - R_right;
            const yc = -R_right;

            if (R_right > 0) {
                // 90° Fillet Arc from theta = PI/2 (top, Y = 0) to theta = 0 (right, Y = -R)
                for (let i = 0; i < arcSubdivsRight; i++) {
                    const a0 = Math.PI / 2 - (i / arcSubdivsRight) * (Math.PI / 2);
                    const a1 = Math.PI / 2 - ((i + 1) / arcSubdivsRight) * (Math.PI / 2);

                    const cos0 = Math.cos(a0), sin0 = Math.sin(a0);
                    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);

                    const xOut0 = xc + R_right * cos0, yOut0 = yc + R_right * sin0;
                    const xOut1 = xc + R_right * cos1, yOut1 = yc + R_right * sin1;

                    outerV.push(
                        xOut0, yOut0, z1,  xOut1, yOut1, z1,  xOut1, yOut1, z0,
                        xOut0, yOut0, z1,  xOut1, yOut1, z0,  xOut0, yOut0, z0
                    );
                    outerNorm.push(
                        cos0, sin0, 0,  cos1, sin1, 0,  cos1, sin1, 0,
                        cos0, sin0, 0,  cos1, sin1, 0,  cos0, sin0, 0
                    );
                    outerUV.push(
                        z1 / 100, yOut0 / 100,  z1 / 100, yOut1 / 100,  z0 / 100, yOut1 / 100,
                        z1 / 100, yOut0 / 100,  z0 / 100, yOut1 / 100,  z0 / 100, yOut0 / 100
                    );

                    if (rInner_right > 0) {
                        const xIn0 = xc + rInner_right * cos0, yIn0 = yc + rInner_right * sin0;
                        const xIn1 = xc + rInner_right * cos1, yIn1 = yc + rInner_right * sin1;

                        ceilV.push(
                            xIn0, yIn0, z0,  xIn1, yIn1, z0,  xIn1, yIn1, z1,
                            xIn0, yIn0, z0,  xIn1, yIn1, z1,  xIn0, yIn0, z1
                        );
                        ceilNorm.push(
                            -cos0, -sin0, 0,  -cos1, -sin1, 0,  -cos1, -sin1, 0,
                            -cos0, -sin0, 0,  -cos1, -sin1, 0,  -cos0, -sin0, 0
                        );
                        ceilUV.push(
                            z0 / 100, yIn0 / 100,  z0 / 100, yIn1 / 100,  z1 / 100, yIn1 / 100,
                            z0 / 100, yIn0 / 100,  z1 / 100, yIn1 / 100,  z1 / 100, yIn0 / 100
                        );
                    }

                    // Side End Caps (Fascia)
                    if (!hasBack) {
                        fasciaV.push(
                            xOut0, yOut0, z0,  xc + rInner_right * cos1, yc + rInner_right * sin1, z0,  xOut1, yOut1, z0,
                            xOut0, yOut0, z0,  xc + rInner_right * cos0, yc + rInner_right * sin0, z0,  xc + rInner_right * cos1, yc + rInner_right * sin1, z0
                        );
                        fasciaNorm.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
                        fasciaUV.push(xOut0 / 100, yOut0 / 100, xOut1 / 100, yOut1 / 100, xOut1 / 100, yOut1 / 100, xOut0 / 100, yOut0 / 100, xOut1 / 100, yOut1 / 100, xOut0 / 100, yOut0 / 100);
                    }

                    if (!hasFront) {
                        fasciaV.push(
                            xOut0, yOut0, z1,  xOut1, yOut1, z1,  xc + rInner_right * cos1, yc + rInner_right * sin1, z1,
                            xOut0, yOut0, z1,  xc + rInner_right * cos0, yc + rInner_right * sin0, z1,  xc + rInner_right * cos1, yc + rInner_right * sin1, z1
                        );
                        fasciaNorm.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
                        fasciaUV.push(xOut0 / 100, yOut0 / 100, xOut1 / 100, yOut1 / 100, xOut1 / 100, yOut1 / 100, xOut0 / 100, yOut0 / 100, xOut1 / 100, yOut1 / 100, xOut0 / 100, yOut0 / 100);
                    }
                }
            }

            const wallTopY = -R_right;
            const wallOuterX = maxX;
            const wallInnerX = maxX - T;

            // Outer Face (+X)
            addQuadVertical(outerV, outerUV, outerNorm,
                { x: wallOuterX, y: wallTopY, z: z0 },
                { x: wallOuterX, y: wallTopY, z: z1 },
                { x: wallOuterX, y: wallBottomYRight, z: z1 },
                { x: wallOuterX, y: wallBottomYRight, z: z0 },
                { x: 1, y: 0, z: 0 }
            );

            // Inner Face (-X)
            addQuadVertical(ceilV, ceilUV, ceilNorm,
                { x: wallInnerX, y: wallTopY, z: z1 },
                { x: wallInnerX, y: wallTopY, z: z0 },
                { x: wallInnerX, y: wallBottomYRight, z: z0 },
                { x: wallInnerX, y: wallBottomYRight, z: z1 },
                { x: -1, y: 0, z: 0 }
            );

            // Bottom Edge Cap (-Y)
            addQuad(fasciaV, fasciaUV, fasciaNorm,
                { x: wallInnerX, y: wallBottomYRight, z: z0 },
                { x: wallOuterX, y: wallBottomYRight, z: z0 },
                { x: wallOuterX, y: wallBottomYRight, z: z1 },
                { x: wallInnerX, y: wallBottomYRight, z: z1 },
                { x: 0, y: -1, z: 0 }
            );

            // Wall Vertical Side Caps (North and South if open)
            if (!hasBack) {
                addQuadFrontBack(fasciaV, fasciaUV, fasciaNorm,
                    { x: wallInnerX, y: wallTopY, z: z0 },
                    { x: wallOuterX, y: wallTopY, z: z0 },
                    { x: wallOuterX, y: wallBottomYRight, z: z0 },
                    { x: wallInnerX, y: wallBottomYRight, z: z0 },
                    { x: 0, y: 0, z: -1 }
                );
            }
            if (!hasFront) {
                addQuadFrontBack(fasciaV, fasciaUV, fasciaNorm,
                    { x: wallOuterX, y: wallTopY, z: z1 },
                    { x: wallInnerX, y: wallTopY, z: z1 },
                    { x: wallInnerX, y: wallBottomYRight, z: z1 },
                    { x: wallOuterX, y: wallBottomYRight, z: z1 },
                    { x: 0, y: 0, z: 1 }
                );
            }
        }

        // 3. BACK WALL (-Z)
        if (hasBack) {
            const arcSubdivsBack = R_back > 0 ? 16 : 1;
            const x0 = slabMinX;
            const x1 = slabMaxX;
            const zc = minY + R_back;
            const yc = -R_back;

            if (R_back > 0) {
                for (let i = 0; i < arcSubdivsBack; i++) {
                    const a0 = (i / arcSubdivsBack) * (Math.PI / 2);
                    const a1 = ((i + 1) / arcSubdivsBack) * (Math.PI / 2);

                    const sin0 = Math.sin(a0), cos0 = Math.cos(a0);
                    const sin1 = Math.sin(a1), cos1 = Math.cos(a1);

                    const zOut0 = zc - R_back * sin0, yOut0 = yc + R_back * cos0;
                    const zOut1 = zc - R_back * sin1, yOut1 = yc + R_back * cos1;

                    outerV.push(
                        x0, yOut0, zOut0,  x1, yOut0, zOut0,  x1, yOut1, zOut1,
                        x0, yOut0, zOut0,  x1, yOut1, zOut1,  x0, yOut1, zOut1
                    );
                    outerNorm.push(
                        0, cos0, -sin0,  0, cos0, -sin0,  0, cos1, -sin1,
                        0, cos0, -sin0,  0, cos1, -sin1,  0, cos1, -sin1
                    );
                    outerUV.push(
                        x0 / 100, yOut0 / 100,  x1 / 100, yOut0 / 100,  x1 / 100, yOut1 / 100,
                        x0 / 100, yOut0 / 100,  x1 / 100, yOut1 / 100,  x0 / 100, yOut1 / 100
                    );

                    if (rInner_back > 0) {
                        const zIn0 = zc - rInner_back * sin0, yIn0 = yc + rInner_back * cos0;
                        const zIn1 = zc - rInner_back * sin1, yIn1 = yc + rInner_back * cos1;

                        ceilV.push(
                            x1, yIn0, zIn0,  x0, yIn0, zIn0,  x0, yIn1, zIn1,
                            x1, yIn0, zIn0,  x0, yIn1, zIn1,  x1, yIn1, zIn1
                        );
                        ceilNorm.push(
                            0, -cos0, sin0,  0, -cos0, sin0,  0, -cos1, sin1,
                            0, -cos0, sin0,  0, -cos1, sin1,  0, -cos1, sin1
                        );
                        ceilUV.push(
                            x1 / 100, yIn0 / 100,  x0 / 100, yIn0 / 100,  x0 / 100, yIn1 / 100,
                            x1 / 100, yIn0 / 100,  x0 / 100, yIn1 / 100,  x1 / 100, yIn1 / 100
                        );
                    }

                    if (!hasLeft) {
                        fasciaV.push(
                            x0, yOut0, zOut0,  x0, yOut1, zOut1,  x0, yc + rInner_back * cos1, zc - rInner_back * sin1,
                            x0, yOut0, zOut0,  x0, yc + rInner_back * cos1, zc - rInner_back * sin1,  x0, yc + rInner_back * cos0, zc - rInner_back * sin0
                        );
                        fasciaNorm.push(-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0);
                        fasciaUV.push(zOut0 / 100, yOut0 / 100, zOut1 / 100, yOut1 / 100, (zc - rInner_back * sin1) / 100, (yc + rInner_back * cos1) / 100, zOut0 / 100, yOut0 / 100, (zc - rInner_back * sin1) / 100, (yc + rInner_back * cos1) / 100, (zc - rInner_back * sin0) / 100, (yc + rInner_back * cos0) / 100);
                    }
                    if (!hasRight) {
                        fasciaV.push(
                            x1, yOut0, zOut0,  x1, yc + rInner_back * cos1, zc - rInner_back * sin1,  x1, yOut1, zOut1,
                            x1, yOut0, zOut0,  x1, yc + rInner_back * cos0, zc - rInner_back * sin0,  x1, yc + rInner_back * cos1, zc - rInner_back * sin1
                        );
                        fasciaNorm.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
                        fasciaUV.push(zOut0 / 100, yOut0 / 100, (zc - rInner_back * sin1) / 100, (yc + rInner_back * cos1) / 100, zOut1 / 100, yOut1 / 100, zOut0 / 100, yOut0 / 100, (zc - rInner_back * sin0) / 100, (yc + rInner_back * cos0) / 100, (zc - rInner_back * sin1) / 100, (yc + rInner_back * cos1) / 100);
                    }
                }
            }

            const wallTopY = -R_back;
            const wallOuterZ = minY;
            const wallInnerZ = minY + T;

            // Outer Face (-Z)
            addQuadFrontBack(outerV, outerUV, outerNorm,
                { x: x1, y: wallTopY, z: wallOuterZ },
                { x: x0, y: wallTopY, z: wallOuterZ },
                { x: x0, y: wallBottomYBack, z: wallOuterZ },
                { x: x1, y: wallBottomYBack, z: wallOuterZ },
                { x: 0, y: 0, z: -1 }
            );

            // Inner Face (+Z)
            addQuadFrontBack(ceilV, ceilUV, ceilNorm,
                { x: x0, y: wallTopY, z: wallInnerZ },
                { x: x1, y: wallTopY, z: wallInnerZ },
                { x: x1, y: wallBottomYBack, z: wallInnerZ },
                { x: x0, y: wallBottomYBack, z: wallInnerZ },
                { x: 0, y: 0, z: 1 }
            );

            // Bottom Edge Cap (-Y)
            addQuad(fasciaV, fasciaUV, fasciaNorm,
                { x: x0, y: wallBottomYBack, z: wallOuterZ },
                { x: x1, y: wallBottomYBack, z: wallOuterZ },
                { x: x1, y: wallBottomYBack, z: wallInnerZ },
                { x: x0, y: wallBottomYBack, z: wallInnerZ },
                { x: 0, y: -1, z: 0 }
            );

            // Side Caps if open
            if (!hasLeft) {
                addQuadVertical(fasciaV, fasciaUV, fasciaNorm,
                    { x: x0, y: wallTopY, z: wallInnerZ },
                    { x: x0, y: wallTopY, z: wallOuterZ },
                    { x: x0, y: wallBottomYBack, z: wallOuterZ },
                    { x: x0, y: wallBottomYBack, z: wallInnerZ },
                    { x: -1, y: 0, z: 0 }
                );
            }
            if (!hasRight) {
                addQuadVertical(fasciaV, fasciaUV, fasciaNorm,
                    { x: x1, y: wallTopY, z: wallOuterZ },
                    { x: x1, y: wallTopY, z: wallInnerZ },
                    { x: x1, y: wallBottomYBack, z: wallInnerZ },
                    { x: x1, y: wallBottomYBack, z: wallOuterZ },
                    { x: 1, y: 0, z: 0 }
                );
            }
        }

        // 4. FRONT WALL (+Z)
        if (hasFront) {
            const arcSubdivsFront = R_front > 0 ? 16 : 1;
            const x0 = slabMinX;
            const x1 = slabMaxX;
            const zc = maxY - R_front;
            const yc = -R_front;

            if (R_front > 0) {
                for (let i = 0; i < arcSubdivsFront; i++) {
                    const a0 = (i / arcSubdivsFront) * (Math.PI / 2);
                    const a1 = ((i + 1) / arcSubdivsFront) * (Math.PI / 2);

                    const sin0 = Math.sin(a0), cos0 = Math.cos(a0);
                    const sin1 = Math.sin(a1), cos1 = Math.cos(a1);

                    const zOut0 = zc + R_front * sin0, yOut0 = yc + R_front * cos0;
                    const zOut1 = zc + R_front * sin1, yOut1 = yc + R_front * cos1;

                    outerV.push(
                        x1, yOut0, zOut0,  x0, yOut0, zOut0,  x0, yOut1, zOut1,
                        x1, yOut0, zOut0,  x0, yOut1, zOut1,  x1, yOut1, zOut1
                    );
                    outerNorm.push(
                        0, cos0, sin0,  0, cos0, sin0,  0, cos1, sin1,
                        0, cos0, sin0,  0, cos1, sin1,  0, cos1, sin1
                    );
                    outerUV.push(
                        x1 / 100, yOut0 / 100,  x0 / 100, yOut0 / 100,  x0 / 100, yOut1 / 100,
                        x1 / 100, yOut0 / 100,  x0 / 100, yOut1 / 100,  x1 / 100, yOut1 / 100
                    );

                    if (rInner_front > 0) {
                        const zIn0 = zc + rInner_front * sin0, yIn0 = yc + rInner_front * cos0;
                        const zIn1 = zc + rInner_front * sin1, yIn1 = yc + rInner_front * cos1;

                        ceilV.push(
                            x0, yIn0, zIn0,  x1, yIn0, zIn0,  x1, yIn1, zIn1,
                            x0, yIn0, zIn0,  x1, yIn1, zIn1,  x0, yIn1, zIn1
                        );
                        ceilNorm.push(
                            0, -cos0, -sin0,  0, -cos0, -sin0,  0, -cos1, -sin1,
                            0, -cos0, -sin0,  0, -cos1, -sin1,  0, -cos1, -sin1
                        );
                        ceilUV.push(
                            x0 / 100, yIn0 / 100,  x1 / 100, yIn0 / 100,  x1 / 100, yIn1 / 100,
                            x0 / 100, yIn0 / 100,  x1 / 100, yIn1 / 100,  x0 / 100, yIn1 / 100
                        );
                    }

                    if (!hasLeft) {
                        fasciaV.push(
                            x0, yOut0, zOut0,  x0, yc + rInner_front * cos1, zc + rInner_front * sin1,  x0, yOut1, zOut1,
                            x0, yOut0, zOut0,  x0, yc + rInner_front * cos0, zc + rInner_front * sin0,  x0, yc + rInner_front * cos1, zc + rInner_front * sin1
                        );
                        fasciaNorm.push(-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0);
                        fasciaUV.push(zOut0 / 100, yOut0 / 100, (zc + rInner_front * sin1) / 100, (yc + rInner_front * cos1) / 100, zOut1 / 100, yOut1 / 100, zOut0 / 100, yOut0 / 100, (zc + rInner_front * sin0) / 100, (yc + rInner_front * cos0) / 100, (zc + rInner_front * sin1) / 100, (yc + rInner_front * cos1) / 100);
                    }
                    if (!hasRight) {
                        fasciaV.push(
                            x1, yOut0, zOut0,  x1, yOut1, zOut1,  x1, yc + rInner_front * cos1, zc + rInner_front * sin1,
                            x1, yOut0, zOut0,  x1, yc + rInner_front * cos1, zc + rInner_front * sin1,  x1, yc + rInner_front * cos0, zc + rInner_front * sin0
                        );
                        fasciaNorm.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
                        fasciaUV.push(zOut0 / 100, yOut0 / 100, zOut1 / 100, yOut1 / 100, (zc + rInner_front * sin1) / 100, (yc + rInner_front * cos1) / 100, zOut0 / 100, yOut0 / 100, (zc + rInner_front * sin1) / 100, (yc + rInner_front * cos1) / 100, (zc + rInner_front * sin0) / 100, (yc + rInner_front * cos0) / 100);
                    }
                }
            }

            const wallTopY = -R_front;
            const wallOuterZ = maxY;
            const wallInnerZ = maxY - T;

            // Outer Face (+Z)
            addQuadFrontBack(outerV, outerUV, outerNorm,
                { x: x0, y: wallTopY, z: wallOuterZ },
                { x: x1, y: wallTopY, z: wallOuterZ },
                { x: x1, y: wallBottomYFront, z: wallOuterZ },
                { x: x0, y: wallBottomYFront, z: wallOuterZ },
                { x: 0, y: 0, z: 1 }
            );

            // Inner Face (-Z)
            addQuadFrontBack(ceilV, ceilUV, ceilNorm,
                { x: x1, y: wallTopY, z: wallInnerZ },
                { x: x0, y: wallTopY, z: wallInnerZ },
                { x: x0, y: wallBottomYFront, z: wallInnerZ },
                { x: x1, y: wallBottomYFront, z: wallInnerZ },
                { x: 0, y: 0, z: -1 }
            );

            // Bottom Edge Cap (-Y)
            addQuad(fasciaV, fasciaUV, fasciaNorm,
                { x: x1, y: wallBottomYFront, z: wallOuterZ },
                { x: x0, y: wallBottomYFront, z: wallOuterZ },
                { x: x0, y: wallBottomYFront, z: wallInnerZ },
                { x: x1, y: wallBottomYFront, z: wallInnerZ },
                { x: 0, y: -1, z: 0 }
            );

            // Side Caps if open
            if (!hasLeft) {
                addQuadVertical(fasciaV, fasciaUV, fasciaNorm,
                    { x: x0, y: wallTopY, z: wallOuterZ },
                    { x: x0, y: wallTopY, z: wallInnerZ },
                    { x: x0, y: wallBottomYFront, z: wallInnerZ },
                    { x: x0, y: wallBottomYFront, z: wallOuterZ },
                    { x: -1, y: 0, z: 0 }
                );
            }
            if (!hasRight) {
                addQuadVertical(fasciaV, fasciaUV, fasciaNorm,
                    { x: x1, y: wallTopY, z: wallInnerZ },
                    { x: x1, y: wallTopY, z: wallOuterZ },
                    { x: x1, y: wallBottomYFront, z: wallOuterZ },
                    { x: x1, y: wallBottomYFront, z: wallInnerZ },
                    { x: 1, y: 0, z: 0 }
                );
            }
        }

        // --- C. EXPOSED EDGES (FASCIA TRIMS) FOR OPEN SIDES ---
        if (!hasFront) {
            addQuadFrontBack(fasciaV, fasciaUV, fasciaNorm,
                { x: slabMinX, y: 0, z: maxY },
                { x: slabMaxX, y: 0, z: maxY },
                { x: slabMaxX, y: -T, z: maxY },
                { x: slabMinX, y: -T, z: maxY },
                { x: 0, y: 0, z: 1 }
            );
        }

        if (!hasBack) {
            addQuadFrontBack(fasciaV, fasciaUV, fasciaNorm,
                { x: slabMaxX, y: 0, z: minY },
                { x: slabMinX, y: 0, z: minY },
                { x: slabMinX, y: -T, z: minY },
                { x: slabMaxX, y: -T, z: minY },
                { x: 0, y: 0, z: -1 }
            );
        }

        if (!hasLeft) {
            addQuadVertical(fasciaV, fasciaUV, fasciaNorm,
                { x: minX, y: 0, z: maxY },
                { x: minX, y: 0, z: minY },
                { x: minX, y: -T, z: minY },
                { x: minX, y: -T, z: maxY },
                { x: -1, y: 0, z: 0 }
            );
        }

        if (!hasRight) {
            addQuadVertical(fasciaV, fasciaUV, fasciaNorm,
                { x: maxX, y: 0, z: minY },
                { x: maxX, y: 0, z: maxY },
                { x: maxX, y: -T, z: maxY },
                { x: maxX, y: -T, z: minY },
                { x: 1, y: 0, z: 0 }
            );
        }
    }

        // 4. Create BufferGeometries and Meshes
        const createSubMesh = (v, uv, norm, material, slotName) => {
            if (v.length === 0) return null;
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
            geo.computeBoundingBox();

            const m = new THREE.Mesh(geo, material);
            m.castShadow = true;
            m.receiveShadow = true;
            m.userData = {
                isRoof: true,
                entity: roof,
                materialSlot: slotName,
                componentType: slotName
            };
            group.add(m);
            ComponentRegistry.registerMesh(roof, slotName, m);
            return m;
        };

        createSubMesh(outerV, outerUV, outerNorm, outerMat, 'outer');
        createSubMesh(ceilV, ceilUV, ceilNorm, ceilingMat, 'ceiling');
        createSubMesh(fasciaV, fasciaUV, fasciaNorm, fasciaMat, 'fascia');

        // 5. UNDER-SOFFIT RECESSED LED SPOTLIGHTS (DOWNLIGHTS)
        if (conf.hasSpotlights !== false && slabMaxX > slabMinX + 40 && slabMaxZ > slabMinZ + 40) {
            const spotGroup = new THREE.Group();
            spotGroup.name = 'CurvedPortal_Spotlights';

            const spotRingGeo = new THREE.RingGeometry(2.5, 3.8, 24);
            spotRingGeo.rotateX(Math.PI / 2);

            const spotLensGeo = new THREE.CircleGeometry(2.5, 24);
            spotLensGeo.rotateX(Math.PI / 2);

            const ringMat = new THREE.MeshStandardMaterial({
                color: 0x1e293b,
                metalness: 0.8,
                roughness: 0.2
            });

            const lensMat = new THREE.MeshBasicMaterial({
                color: 0xfff4e0,
                toneMapped: false
            });

            const spacing = Math.max(60, Number(conf.spotlightSpacing) || 90);
            const spanX = slabMaxX - slabMinX;
            const spanZ = slabMaxZ - slabMinZ;
            const numX = Math.max(1, Math.round(spanX / spacing));
            const numZ = Math.max(1, Math.round(spanZ / spacing));

            const stepX = spanX / (numX + 1);
            const stepZ = spanZ / (numZ + 1);
            const spotY = -T + 0.1;

            for (let ix = 1; ix <= numX; ix++) {
                for (let iz = 1; iz <= numZ; iz++) {
                    const sx = slabMinX + ix * stepX;
                    const sz = slabMinZ + iz * stepZ;

                    const ringMesh = new THREE.Mesh(spotRingGeo, ringMat);
                    ringMesh.position.set(sx, spotY, sz);
                    ringMesh.userData = { isRoof: true, entity: roof, materialSlot: 'spotlights' };
                    spotGroup.add(ringMesh);

                    const lensMesh = new THREE.Mesh(spotLensGeo, lensMat);
                    lensMesh.position.set(sx, spotY - 0.05, sz);
                    lensMesh.userData = { isRoof: true, entity: roof, materialSlot: 'spotlights' };
                    spotGroup.add(lensMesh);
                }
            }

            group.add(spotGroup);
            ComponentRegistry.registerMesh(roof, 'spotlights', spotGroup);
        }

        group.userData = {
            isRoof: true,
            isRoofGroup: true,
            entity: roof,
            roofId: roof.id,
            componentType: 'curved_portal'
        };

        return group;
    }
}

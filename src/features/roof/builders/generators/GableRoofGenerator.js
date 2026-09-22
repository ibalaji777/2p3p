import * as THREE from 'three';
import { WALL_DECOR_REGISTRY } from '../../../../core/registry.js';
import { ComponentRegistry } from '../../../../core/engine3d/ComponentRegistry.js';
import { thickenGeometry, applyRoofGroups } from './RoofGeneratorHelpers.js';

/**
 * Specialized CAD/BIM Generator for Gable and Curved (Barrel Vault) Roofs.
 * Handles:
 * - Dual slope symmetrical/asymmetrical pitch
 * - Ridge offset
 * - Parametric arch curvature for curved barrel roofs
 * - Triangular and segmental curved gable end walls
 * - Geometry thickening and fascia edge wrapping
 */
export class GableRoofGenerator {
    static build({
        roof,
        conf,
        pts,
        basePts,
        h,
        ctx,
        resolveRoofMaterial,
        isGlassRoof,
        mat,
        fasciaMat,
        hasWalls,
        wallList
    }) {
        let mesh;
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                pts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;

                let baseMinX = Infinity, baseMaxX = -Infinity, baseMinY = Infinity, baseMaxY = -Infinity;
                basePts.forEach(p => {
                    baseMinX = Math.min(baseMinX, p.x); baseMaxX = Math.max(baseMaxX, p.x);
                    baseMinY = Math.min(baseMinY, p.y); baseMaxY = Math.max(baseMaxY, p.y);
                });
                const baseW = (baseMinX !== Infinity) ? (baseMaxX - baseMinX) : bW;
                const baseD = (baseMinY !== Infinity) ? (baseMaxY - baseMinY) : bD;
                const baseCx = (baseMinX !== Infinity) ? (baseMinX + baseMaxX) / 2 : (bMinX + bW / 2);
                const baseCy = (baseMinY !== Infinity) ? (baseMinY + baseMaxY) / 2 : (bMinY + bD / 2);

                const pitch = conf.pitch !== undefined ? conf.pitch : 30;
                const pitchRad = pitch * Math.PI / 180;
                const axis = conf.ridgeAxis || 'x';
                const maxSpan = axis === 'x' ? baseD : baseW;
                const rh = Math.tan(pitchRad) * (maxSpan / 2);
                let cx = axis === 'x' ? (bMinX + bW / 2) : baseCx;
                let cy = axis === 'x' ? baseCy : (bMinY + bD / 2);
                const curve = conf.curve !== undefined ? conf.curve : (conf.roofType === 'curved' ? -20 : 0);
                const gWestX = (baseMinX !== Infinity && !conf.flushGable) ? Math.max(bMinX, Math.min(bMaxX, baseMinX)) : bMinX;
                const gEastX = (baseMaxX !== -Infinity && !conf.flushGable) ? Math.max(bMinX, Math.min(bMaxX, baseMaxX)) : bMaxX;
                const gNorthY = (baseMinY !== Infinity && !conf.flushGable) ? Math.max(bMinY, Math.min(bMaxY, baseMinY)) : bMinY;
                const gSouthY = (baseMaxY !== -Infinity && !conf.flushGable) ? Math.max(bMinY, Math.min(bMaxY, baseMaxY)) : bMaxY;

                const hasAutoGableCADWalls = hasWalls && wallList.some(w => w.isAutoGable && w.parentRoofId === roof.id && w.mesh3D && w.mesh3D.parent);
                const shouldGenerateGableEndMesh = (conf.showGableWalls !== false) && (conf.autoShapeWalls !== false) && !hasAutoGableCADWalls && (rh > 0.5);

                const v1 = [], uv1 = [];
                const v2 = [], uv2 = [];
                const gv = [], guv = [];
                const numSubdivs = 32;

                const addQuadTo = (targetV, targetUV, p0, p1, p2, p3) => {
                    let dx1 = p1.x - p0.x, dz1 = p1.z - p0.z;
                    let dx2 = p2.x - p0.x, dz2 = p2.z - p0.z;
                    let ny = dz1 * dx2 - dx1 * dz2;
                    if (ny < 0) {
                        targetV.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p1.x, p1.y, p1.z);
                        targetUV.push(p0.x / 100, p0.z / 100, p2.x / 100, p2.z / 100, p1.x / 100, p1.z / 100);
                        targetV.push(p0.x, p0.y, p0.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z);
                        targetUV.push(p0.x / 100, p0.z / 100, p3.x / 100, p3.z / 100, p2.x / 100, p2.z / 100);
                    } else {
                        targetV.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                        targetUV.push(p0.x / 100, p0.z / 100, p1.x / 100, p1.z / 100, p2.x / 100, p2.z / 100);
                        targetV.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
                        targetUV.push(p0.x / 100, p0.z / 100, p2.x / 100, p2.z / 100, p3.x / 100, p3.z / 100);
                    }
                };

                // Precalculate 2D bounding boxes of all skylight aperture cutouts
                const skylightsList = (conf.skylights || roof.skylights || []);

                const skylightCutouts = skylightsList.map(sk => {
                    const skX = sk.x !== undefined ? sk.x : (sk.u !== undefined ? (bMinX + sk.u * bW) : (bMinX + bW / 2));
                    const skZ = sk.z !== undefined ? sk.z : (sk.v !== undefined ? (bMinY + sk.v * bD) : (bMinY + bD / 2));
                    let effW = Number(sk.width) || 100;
                    let effL = Number(sk.length) || 150;
                    if (sk.coverage === 'full_width' || sk.coverage === 'full_both') effW = (axis === 'x' ? bW : bD);
                    if (sk.coverage === 'full_slope' || sk.coverage === 'full_both') effL = ((axis === 'x' ? bD : bW) / 2) / Math.cos(pitchRad);

                    const cutW = Math.max(10, effW - 8);
                    const cutL = Math.max(10, effL - 8);
                    const projL = cutL * Math.cos(pitchRad);

                    return {
                        x0: skX - cutW / 2,
                        x1: skX + cutW / 2,
                        z0: skZ - projL / 2,
                        z1: skZ + projL / 2
                    };
                });

                // Calculate aperture cutouts for any upper-level walls/rooms intersecting this roof (Sims 4 Room roof void clipping)
                const wallCutouts = [];
                const rotDeg = roof.rotation || (roof.group && typeof roof.group.rotation === 'function' ? roof.group.rotation() : 0);
                const isRotated = Math.abs(rotDeg % 360) > 0.01;
                const isInteracting = Boolean(roof._isDragging || roof._isRotating || roof.isDragging);

                if (!isRotated && !isInteracting && wallList && wallList.length > 0) {
                    const roofElev = roof.elevation !== undefined ? roof.elevation : 120;
                    const upperWalls = wallList.filter(w => !w.hidden && !w.isAutoGable && w.parentRoofId !== roof.id && (w.elevation || 0) >= (roofElev + 5));

                    if (upperWalls.length > 0) {
                        let uMinX = Infinity, uMaxX = -Infinity, uMinZ = Infinity, uMaxZ = -Infinity;
                        let hasUpperWallInRoof = false;

                        upperWalls.forEach(w => {
                            const p1 = (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position() : (w.startAnchor || { x: w.startX || 0, y: w.startY || 0 });
                            const p2 = (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position() : (w.endAnchor || { x: w.endX || 0, y: w.endY || 0 });
                            const wMinX = Math.min(p1.x, p2.x);
                            const wMaxX = Math.max(p1.x, p2.x);
                            const wMinZ = Math.min(p1.y, p2.y);
                            const wMaxZ = Math.max(p1.y, p2.y);

                            if (wMaxX >= bMinX && wMinX <= bMaxX && wMaxZ >= bMinY && wMinZ <= bMaxY) {
                                hasUpperWallInRoof = true;
                                uMinX = Math.min(uMinX, wMinX);
                                uMaxX = Math.max(uMaxX, wMaxX);
                                uMinZ = Math.min(uMinZ, wMinZ);
                                uMaxZ = Math.max(uMaxZ, wMaxZ);
                            }
                        });

                        const isFullRoofCover = (uMinX <= bMinX + 1 && uMaxX >= bMaxX - 1 && uMinZ <= bMinY + 1 && uMaxZ >= bMaxY - 1) ||
                                                (uMaxX - uMinX >= bW - 20 && uMaxZ - uMinZ >= bD - 20);
                        if (hasUpperWallInRoof && uMinX !== Infinity && !isFullRoofCover) {
                            wallCutouts.push({
                                x0: uMinX,
                                x1: uMaxX,
                                z0: uMinZ,
                                z1: uMaxZ
                            });
                        }
                    }
                }

                const slopeCutouts = [...skylightCutouts, ...wallCutouts];

                const addSegmentedSlopeStripX = (targetV, targetUV, z0, z1, y0, y1) => {
                    const minZ = Math.min(z0, z1);
                    const maxZ = Math.max(z0, z1);
                    const hits = slopeCutouts.filter(cut => maxZ >= cut.z0 && minZ <= cut.z1);
                    if (hits.length === 0) {
                        addQuadTo(targetV, targetUV, { x: bMinX, y: y0, z: z0 }, { x: bMaxX, y: y0, z: z0 }, { x: bMaxX, y: y1, z: z1 }, { x: bMinX, y: y1, z: z1 });
                        return;
                    }

                    hits.sort((a, b) => a.x0 - b.x0);
                    let curX = bMinX;
                    hits.forEach(cut => {
                        const h0 = Math.max(bMinX, Math.min(bMaxX, cut.x0));
                        const h1 = Math.max(bMinX, Math.min(bMaxX, cut.x1));
                        if (h0 > curX + 1) {
                            addQuadTo(targetV, targetUV, { x: curX, y: y0, z: z0 }, { x: h0, y: y0, z: z0 }, { x: h0, y: y1, z: z1 }, { x: curX, y: y1, z: z1 });
                        }
                        curX = Math.max(curX, h1); // Skip cutout region (creates aperture opening under dormer/skylight!)
                    });
                    if (curX < bMaxX - 1) {
                        addQuadTo(targetV, targetUV, { x: curX, y: y0, z: z0 }, { x: bMaxX, y: y0, z: z0 }, { x: bMaxX, y: y1, z: z1 }, { x: curX, y: y1, z: z1 });
                    }
                };

                const addSegmentedSlopeStripY = (targetV, targetUV, x0, x1, y0, y1) => {
                    const minX = Math.min(x0, x1);
                    const maxX = Math.max(x0, x1);
                    const hits = slopeCutouts.filter(cut => maxX >= cut.x0 && minX <= cut.x1);
                    if (hits.length === 0) {
                        addQuadTo(targetV, targetUV, { x: x0, y: y0, z: bMinY }, { x: x0, y: y0, z: bMaxY }, { x: x1, y: y1, z: bMaxY }, { x: x1, y: y1, z: bMinY });
                        return;
                    }

                    hits.sort((a, b) => a.z0 - b.z0);
                    let curZ = bMinY;
                    hits.forEach(cut => {
                        const h0 = Math.max(bMinY, Math.min(bMaxY, cut.z0));
                        const h1 = Math.max(bMinY, Math.min(bMaxY, cut.z1));
                        if (h0 > curZ + 1) {
                            addQuadTo(targetV, targetUV, { x: x0, y: y0, z: curZ }, { x: x0, y: y0, z: h0 }, { x: x1, y: y1, z: h0 }, { x: x1, y: y1, z: curZ });
                        }
                        curZ = Math.max(curZ, h1); // Skip cutout region
                    });
                    if (curZ < bMaxY - 1) {
                        addQuadTo(targetV, targetUV, { x: x0, y: y0, z: curZ }, { x: x0, y: y0, z: bMaxY }, { x: x1, y: y1, z: bMaxY }, { x: x1, y: y1, z: curZ });
                    }
                };

                if (axis === 'x') {
                    // Slope 1: North (bMinY -> cy)
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs;
                        const t1 = (i + 1) / numSubdivs;
                        const z0 = bMinY + t0 * (cy - bMinY);
                        const z1 = bMinY + t1 * (cy - bMinY);
                        let y0 = t0 * rh + curve * Math.sin(Math.PI * t0);
                        let y1 = t1 * rh + curve * Math.sin(Math.PI * t1);

                        addSegmentedSlopeStripX(v1, uv1, z0, z1, y0, y1);

                        if (shouldGenerateGableEndMesh) {
                            // Gable End Walls (West at gWestX and East at gEastX)
                            gv.push(gWestX, 0, z0, gWestX, y0, z0, gWestX, y1, z1);
                            guv.push(z0/100, 0, z0/100, y0/100, z1/100, y1/100);
                            gv.push(gWestX, 0, z0, gWestX, y1, z1, gWestX, 0, z1);
                            guv.push(z0/100, 0, z1/100, y1/100, z1/100, 0);

                            gv.push(gEastX, 0, z0, gEastX, y1, z1, gEastX, y0, z0);
                            guv.push(z0/100, 0, z1/100, y1/100, z0/100, y0/100);
                            gv.push(gEastX, 0, z0, gEastX, 0, z1, gEastX, y1, z1);
                            guv.push(z0/100, 0, z1/100, 0, z1/100, y1/100);
                        }
                    }

                    // Slope 2: South (cy -> bMaxY)
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs;
                        const t1 = (i + 1) / numSubdivs;
                        const z0 = cy + t0 * (bMaxY - cy);
                        const z1 = cy + t1 * (bMaxY - cy);
                        let y0 = (1 - t0) * rh + curve * Math.sin(Math.PI * (1 - t0));
                        let y1 = (1 - t1) * rh + curve * Math.sin(Math.PI * (1 - t1));

                        addSegmentedSlopeStripX(v2, uv2, z0, z1, y0, y1);

                        if (shouldGenerateGableEndMesh) {
                            // Gable End Walls (West at gWestX and East at gEastX)
                            gv.push(gWestX, 0, z0, gWestX, y0, z0, gWestX, y1, z1);
                            guv.push(z0/100, 0, z0/100, y0/100, z1/100, y1/100);
                            gv.push(gWestX, 0, z0, gWestX, y1, z1, gWestX, 0, z1);
                            guv.push(z0/100, 0, z1/100, y1/100, z1/100, 0);

                            gv.push(gEastX, 0, z0, gEastX, y1, z1, gEastX, y0, z0);
                            guv.push(z0/100, 0, z1/100, y1/100, z0/100, y0/100);
                            gv.push(gEastX, 0, z0, gEastX, 0, z1, gEastX, y1, z1);
                            guv.push(z0/100, 0, z1/100, 0, z1/100, y1/100);
                        }
                    }
                } else {
                    // Axis Y (Ridge along Y axis, slopes East/West)
                    // Slope 1: West (bMinX -> cx)
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs;
                        const t1 = (i + 1) / numSubdivs;
                        const x0 = bMinX + t0 * (cx - bMinX);
                        const x1 = bMinX + t1 * (cx - bMinX);
                        let y0 = t0 * rh + curve * Math.sin(Math.PI * t0);
                        let y1 = t1 * rh + curve * Math.sin(Math.PI * t1);

                        addSegmentedSlopeStripY(v1, uv1, x0, x1, y0, y1);

                        if (shouldGenerateGableEndMesh) {
                            // Gable End Walls (North at gNorthY and South at gSouthY)
                            gv.push(x0, 0, gNorthY, x1, y1, gNorthY, x0, y0, gNorthY);
                            guv.push(x0/100, 0, x1/100, y1/100, x0/100, y0/100);
                            gv.push(x0, 0, gNorthY, x1, 0, gNorthY, x1, y1, gNorthY);
                            guv.push(x0/100, 0, x1/100, 0, x1/100, y1/100);

                            gv.push(x0, 0, gSouthY, x0, y0, gSouthY, x1, y1, gSouthY);
                            guv.push(x0/100, 0, x0/100, y0/100, x1/100, y1/100);
                            gv.push(x0, 0, gSouthY, x1, y1, gSouthY, x1, 0, gSouthY);
                            guv.push(x0/100, 0, x1/100, y1/100, x1/100, 0);
                        }
                    }

                    // Slope 2: East (cx -> bMaxX)
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs;
                        const t1 = (i + 1) / numSubdivs;
                        const x0 = cx + t0 * (bMaxX - cx);
                        const x1 = cx + t1 * (bMaxX - cx);
                        let y0 = (1 - t0) * rh + curve * Math.sin(Math.PI * (1 - t0));
                        let y1 = (1 - t1) * rh + curve * Math.sin(Math.PI * (1 - t1));

                        addSegmentedSlopeStripY(v2, uv2, x0, x1, y0, y1);

                        if (shouldGenerateGableEndMesh) {
                            // Gable End Walls (North at gNorthY and South at gSouthY)
                            gv.push(x0, 0, gNorthY, x1, y1, gNorthY, x0, y0, gNorthY);
                            guv.push(x0/100, 0, x1/100, y1/100, x0/100, y0/100);
                            gv.push(x0, 0, gNorthY, x1, 0, gNorthY, x1, y1, gNorthY);
                            guv.push(x0/100, 0, x1/100, 0, x1/100, y1/100);

                            gv.push(x0, 0, gSouthY, x0, y0, gSouthY, x1, y1, gSouthY);
                            guv.push(x0/100, 0, x0/100, y0/100, x1/100, y1/100);
                            gv.push(x0, 0, gSouthY, x1, y1, gSouthY, x1, 0, gSouthY);
                            guv.push(x0/100, 0, x1/100, y1/100, x1/100, 0);
                        }
                    }
                }

                const v = [...v1, ...v2];
                const uv = [...uv1, ...uv2];

                const T = conf.thickness || 8;
                const {v: vThick, uv: uvThick} = thickenGeometry(v, uv, T);

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(vThick, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvThick, 2));
                geo.computeVertexNormals();
                
                const hasSlopeOverrides = Boolean(conf.slopes && (conf.slopes.slope1 || conf.slopes.slope2));
                if (hasSlopeOverrides) {
                    const s1 = resolveRoofMaterial(conf.slopes.slope1 || conf.material);
                    const s2 = resolveRoofMaterial(conf.slopes.slope2 || conf.material);

                    const count1 = v1.length / 3;
                    const count2 = v2.length / 3;
                    const totalTop = count1 + count2;
                    const totalThick = vThick.length / 3;
                    const fasciaCount = totalThick - 2 * totalTop;

                    geo.addGroup(0, count1, 0);
                    geo.addGroup(count1, count2, 1);
                    geo.addGroup(totalTop, count1, s1.isGlass ? 0 : 2);
                    geo.addGroup(totalTop + count1, count2, s2.isGlass ? 1 : 2);
                    geo.addGroup(2 * totalTop, fasciaCount, 2);

                    mesh = new THREE.Mesh(geo, [s1.mat, s2.mat, fasciaMat]);
                } else {
                    applyRoofGroups(geo, v.length, vThick.length, isGlassRoof);
                    mesh = new THREE.Mesh(geo, [mat, fasciaMat]);
                }
                
                if (gv.length > 0) {
                    const gGeo = new THREE.BufferGeometry();
                    gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gv, 3));
                    gGeo.setAttribute("uv", new THREE.Float32BufferAttribute(guv, 2));
                    gGeo.computeVertexNormals();

                    const gableMatId = conf.gableMaterial || 'white_plaster_wall';
                    const wallDecor = WALL_DECOR_REGISTRY[gableMatId] || WALL_DECOR_REGISTRY['white_plaster_wall'];
                    let gableMat = (ctx?.helpers?.getDynamicMaterial ? ctx.helpers.getDynamicMaterial(gableMatId || 'white_plaster_wall', 'wall') : null) || new THREE.MeshStandardMaterial({color: 0xefede5}); gableMat.side = THREE.DoubleSide; gableMat.side = THREE.DoubleSide;
                    
                    if (wallDecor && wallDecor.texture) {
                        ctx.assets.getTexture(wallDecor).then(tex => {
                            const gTex = tex.clone();
                            gTex.wrapS = gTex.wrapT = THREE.RepeatWrapping;
                            gTex.repeat.set(100/(wallDecor.scaleRatio || 100), 100/(wallDecor.scaleRatio || 100));
                            gableMat.map = gTex;
                            gableMat.bumpMap = gTex;
                            gableMat.bumpScale = 0.015;
                            gableMat.side = THREE.DoubleSide;
                            gableMat.needsUpdate = true;
                        });
                    }
                    const gableMesh = new THREE.Mesh(gGeo, gableMat);
                    gableMesh.userData = { isRoof: true, isGable: true, entity: roof, materialSlot: 'gable', componentType: 'gable_wall' };
                    mesh.add(gableMesh);
                    ComponentRegistry.registerMesh(roof, "gable", gableMesh);
                }

        return mesh;
    }
}

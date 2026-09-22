import * as THREE from 'three';
import { ComponentRegistry } from '../../../../core/engine3d/ComponentRegistry.js';
import { thickenGeometry, applyRoofGroups } from './RoofGeneratorHelpers.js';

/**
 * Specialized CAD/BIM Generator for Hip, Half-Hip, Dutch-Gable, and Jerkinhead Roofs.
 * Handles:
 * - 4-way hip sloped rafters & ridge convergence
 * - Half-hip vertical gable cutoffs
 * - Dutch-gable integrated mini-pediments
 * - Jerkinhead clipped gables
 * - Multi-slope glass paneling & materials
 */
export class HipRoofGenerator {
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
        const roofType = conf.roofType || 'hip';
        let mesh;

        if (roofType === 'half_hip') {
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                pts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;

                const pitch = conf.pitch || 30;
                const maxSpan = Math.min(bW, bD);
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                const isHorizontal = bW >= bD;

                const v = [], uv = [];
                const addTri = (p1, p2, p3) => {
                    let dx1 = p2.x - p1.x, dz1 = p2.z - p1.z;
                    let dx2 = p3.x - p1.x, dz2 = p3.z - p1.z;
                    let ny = dz1 * dx2 - dx1 * dz2;
                    if (ny < 0) {
                        v.push(p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z);
                        uv.push(p1.x / 100, p1.z / 100, p3.x / 100, p3.z / 100, p2.x / 100, p2.z / 100);
                    } else {
                        v.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
                        uv.push(p1.x / 100, p1.z / 100, p2.x / 100, p2.z / 100, p3.x / 100, p3.z / 100);
                    }
                };

                const dropFactor = Math.tan(pitch * Math.PI / 180);
                const drop = -8 * dropFactor;
                const cNW = { x: bMinX, y: drop, z: bMinY };
                const cNE = { x: bMaxX, y: drop, z: bMinY };
                const cSE = { x: bMaxX, y: drop, z: bMaxY };
                const cSW = { x: bMinX, y: drop, z: bMaxY };

                const gv = [], guv = [];

                if (isHorizontal) {
                    const r1 = { x: bMinX + bD / 2, y: rh, z: bMinY + bD / 2 };
                    const r2 = { x: bMaxX, y: rh, z: bMinY + bD / 2 }; // Extended to East gable wall

                    // 1. North Slope (Trapezoid)
                    addTri(cNW, cNE, r2);
                    addTri(cNW, r2, r1);

                    // 2. West Hip End (Triangle)
                    addTri(cSW, cNW, r1);

                    // 3. South Slope (Trapezoid)
                    addTri(cSE, cSW, r1);
                    addTri(cSE, r1, r2);

                    // 4. East Vertical Gable Wall
                    gv.push(bMaxX, 0, bMinY, bMaxX, rh, bMinY + bD / 2, bMaxX, 0, bMaxY);
                    guv.push(0, 0, 0.5, 1, 1, 0);
                    gv.push(bMaxX, 0, bMinY, bMaxX, rh, bMinY + bD / 2, bMaxX, 0, bMinY + bD / 2);
                    guv.push(0, 0, 0.5, 1, 0.5, 0);
                } else {
                    const r1 = { x: bMinX + bW / 2, y: rh, z: bMinY + bW / 2 };
                    const r2 = { x: bMinX + bW / 2, y: rh, z: bMaxY };

                    // 1. North Hip End (Triangle)
                    addTri(cNE, cNW, r1);

                    // 2. West Slope (Trapezoid)
                    addTri(cNW, cSW, r2);
                    addTri(cNW, r2, r1);

                    // 3. East Slope (Trapezoid)
                    addTri(cSE, cNE, r1);
                    addTri(cSE, r1, r2);

                    // 4. South Vertical Gable Wall
                    gv.push(bMinX, 0, bMaxY, bMaxX, 0, bMaxY, bMinX + bW / 2, rh, bMaxY);
                    guv.push(0, 0, 1, 0, 0.5, 1);
                }

                const T = conf.thickness || 8;
                const {v: vThick, uv: uvThick} = thickenGeometry(v, uv, T);

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(vThick, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvThick, 2));
                geo.computeVertexNormals();
                
                applyRoofGroups(geo, v.length, vThick.length, isGlassRoof);
                mesh = new THREE.Mesh(geo, [mat, fasciaMat]);

                if (gv.length > 0) {
                    const gGeo = new THREE.BufferGeometry();
                    gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gv, 3));
                    gGeo.setAttribute("uv", new THREE.Float32BufferAttribute(guv, 2));
                    gGeo.computeVertexNormals();

                    let gableMat = (ctx?.helpers?.getDynamicMaterial ? ctx.helpers.getDynamicMaterial(conf.gableMaterial || 'white_plaster_wall', 'wall') : null) || new THREE.MeshStandardMaterial({color: 0xefede5});
                    gableMat.side = THREE.DoubleSide;
                    const gableMesh = new THREE.Mesh(gGeo, gableMat);
                    gableMesh.userData = { isRoof: true, isGable: true, isGableWall: true, entity: roof, materialSlot: 'gable', componentType: 'gable_wall' };
                    mesh.add(gableMesh);
                    ComponentRegistry.registerMesh(roof, "gable", gableMesh);
                }
        } else if (roofType === 'dutch_gable') {
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                pts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;

                const pitch = conf.pitch || 30;
                const maxSpan = Math.min(bW, bD);
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                const isHorizontal = bW >= bD;
                const hBreak = rh * 0.40;
                const inBreak = (maxSpan / 2) * 0.40;
                const curve = conf.curve || 0;

                const v = [], uv = [], gv = [], guv = [];
                const addTri = (p1, p2, p3) => {
                    let dx1 = p2.x - p1.x, dz1 = p2.z - p1.z;
                    let dx2 = p3.x - p1.x, dz2 = p3.z - p1.z;
                    let ny = dz1 * dx2 - dx1 * dz2;
                    if (ny < 0) {
                        v.push(p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z);
                        uv.push(p1.x / 100, p1.z / 100, p3.x / 100, p3.z / 100, p2.x / 100, p2.z / 100);
                    } else {
                        v.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
                        uv.push(p1.x / 100, p1.z / 100, p2.x / 100, p2.z / 100, p3.x / 100, p3.z / 100);
                    }
                };

                const eNW = { x: bMinX, y: 0, z: bMinY };
                const eNE = { x: bMaxX, y: 0, z: bMinY };
                const eSE = { x: bMaxX, y: 0, z: bMaxY };
                const eSW = { x: bMinX, y: 0, z: bMaxY };

                const bNW = { x: bMinX + inBreak, y: hBreak, z: bMinY + inBreak };
                const bNE = { x: bMaxX - inBreak, y: hBreak, z: bMinY + inBreak };
                const bSE = { x: bMaxX - inBreak, y: hBreak, z: bMaxY - inBreak };
                const bSW = { x: bMinX + inBreak, y: hBreak, z: bMaxY - inBreak };

                addTri(eNW, eNE, bNE); addTri(eNW, bNE, bNW);
                addTri(eSE, eSW, bSW); addTri(eSE, bSW, bSE);
                addTri(eSW, eNW, bNW); addTri(eSW, bNW, bSW);
                addTri(eNE, eSE, bSE); addTri(eNE, bSE, bNE);

                const numSubdivs = 16;
                if (isHorizontal) {
                    const cy = bMinY + bD / 2;
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const zN0 = bNW.z + t0 * (cy - bNW.z), zN1 = bNW.z + t1 * (cy - bNW.z);
                        const zS0 = bSW.z - t0 * (bSW.z - cy), zS1 = bSW.z - t1 * (bSW.z - cy);
                        const y0 = hBreak + t0 * (rh - hBreak) + curve * Math.sin(Math.PI * t0);
                        const y1 = hBreak + t1 * (rh - hBreak) + curve * Math.sin(Math.PI * t1);

                        addTri({ x: bNW.x, y: y0, z: zN0 }, { x: bNE.x, y: y0, z: zN0 }, { x: bNE.x, y: y1, z: zN1 });
                        addTri({ x: bNW.x, y: y0, z: zN0 }, { x: bNE.x, y: y1, z: zN1 }, { x: bNW.x, y: y1, z: zN1 });

                        addTri({ x: bSE.x, y: y0, z: zS0 }, { x: bSW.x, y: y0, z: zS0 }, { x: bSW.x, y: y1, z: zS1 });
                        addTri({ x: bSE.x, y: y0, z: zS0 }, { x: bSW.x, y: y1, z: zS1 }, { x: bSE.x, y: y1, z: zS1 });
                    }

                    gv.push(bNW.x, hBreak, bNW.z, bNW.x, rh, cy, bNW.x, hBreak, bSW.z);
                    guv.push(0, 0, 0.5, 1, 1, 0);
                    gv.push(bNE.x, hBreak, bSE.z, bNE.x, rh, cy, bNE.x, hBreak, bNE.z);
                    guv.push(0, 0, 0.5, 1, 1, 0);
                } else {
                    const cx = bMinX + bW / 2;
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const xW0 = bNW.x + t0 * (cx - bNW.x), xW1 = bNW.x + t1 * (cx - bNW.x);
                        const xE0 = bNE.x - t0 * (bNE.x - cx), xE1 = bNE.x - t1 * (bNE.x - cx);
                        const y0 = hBreak + t0 * (rh - hBreak) + curve * Math.sin(Math.PI * t0);
                        const y1 = hBreak + t1 * (rh - hBreak) + curve * Math.sin(Math.PI * t1);

                        addTri({ x: xW0, y: y0, z: bNW.z }, { x: xW0, y: y0, z: bSW.z }, { x: xW1, y: y1, z: bSW.z });
                        addTri({ x: xW0, y: y0, z: bNW.z }, { x: xW1, y: y1, z: bSW.z }, { x: xW1, y: y1, z: bNW.z });

                        addTri({ x: xE0, y: y0, z: bSE.z }, { x: xE0, y: y0, z: bNE.z }, { x: xE1, y: y1, z: bNE.z });
                        addTri({ x: xE0, y: y0, z: bSE.z }, { x: xE1, y: y1, z: bNE.z }, { x: xE1, y: y1, z: bSE.z });
                    }

                    gv.push(bNW.x, hBreak, bNW.z, cx, rh, bNW.z, bNE.x, hBreak, bNE.z);
                    guv.push(0, 0, 0.5, 1, 1, 0);
                    gv.push(bSE.x, hBreak, bSE.z, cx, rh, bSE.z, bSW.x, hBreak, bSW.z);
                    guv.push(0, 0, 0.5, 1, 1, 0);
                }

                const T = conf.thickness || 8;
                const {v: vThick, uv: uvThick} = thickenGeometry(v, uv, T);

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(vThick, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvThick, 2));
                geo.computeVertexNormals();

                applyRoofGroups(geo, v.length, vThick.length, isGlassRoof);
                mesh = new THREE.Mesh(geo, [mat, fasciaMat]);

                if (gv.length > 0) {
                    const gGeo = new THREE.BufferGeometry();
                    gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gv, 3));
                    gGeo.setAttribute("uv", new THREE.Float32BufferAttribute(guv, 2));
                    gGeo.computeVertexNormals();

                    let gableMat = (ctx?.helpers?.getDynamicMaterial ? ctx.helpers.getDynamicMaterial(conf.gableMaterial || 'white_plaster_wall', 'wall') : null) || new THREE.MeshStandardMaterial({color: 0xefede5});
                    gableMat.side = THREE.DoubleSide;
                    const gableMesh = new THREE.Mesh(gGeo, gableMat);
                    gableMesh.userData = { isRoof: true, isGable: true, entity: roof, materialSlot: 'gable', componentType: 'gable_wall' };
                    mesh.add(gableMesh);
                    ComponentRegistry.registerMesh(roof, "gable", gableMesh);
                }
        } else if (roofType === 'jerkinhead') {
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                pts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;

                const pitch = conf.pitch || 30;
                const maxSpan = Math.min(bW, bD);
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                const isHorizontal = bW >= bD;
                const hBreak = rh * 0.60;
                const inBreak = (maxSpan / 2) * 0.40;
                const curve = conf.curve || 0;

                const v = [], uv = [], gv = [], guv = [];
                const addTri = (p1, p2, p3) => {
                    let dx1 = p2.x - p1.x, dz1 = p2.z - p1.z;
                    let dx2 = p3.x - p1.x, dz2 = p3.z - p1.z;
                    let ny = dz1 * dx2 - dx1 * dz2;
                    if (ny < 0) {
                        v.push(p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z);
                        uv.push(p1.x / 100, p1.z / 100, p3.x / 100, p3.z / 100, p2.x / 100, p2.z / 100);
                    } else {
                        v.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
                        uv.push(p1.x / 100, p1.z / 100, p2.x / 100, p2.z / 100, p3.x / 100, p3.z / 100);
                    }
                };

                const eNW = { x: bMinX, y: 0, z: bMinY };
                const eNE = { x: bMaxX, y: 0, z: bMinY };
                const eSE = { x: bMaxX, y: 0, z: bMaxY };
                const eSW = { x: bMinX, y: 0, z: bMaxY };

                const numSubdivs = 16;
                if (isHorizontal) {
                    const cy = bMinY + bD / 2;
                    const r1 = { x: bMinX + inBreak, y: rh, z: cy };
                    const r2 = { x: bMaxX - inBreak, y: rh, z: cy };

                    const kNW = { x: bMinX, y: hBreak, z: bMinY + inBreak };
                    const kSW = { x: bMinX, y: hBreak, z: bMaxY - inBreak };
                    const kNE = { x: bMaxX, y: hBreak, z: bMinY + inBreak };
                    const kSE = { x: bMaxX, y: hBreak, z: bMaxY - inBreak };

                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const z0 = bMinY + t0 * (cy - bMinY), z1 = bMinY + t1 * (cy - bMinY);
                        const y0 = t0 * rh + curve * Math.sin(Math.PI * t0);
                        const y1 = t1 * rh + curve * Math.sin(Math.PI * t1);

                        addTri({ x: bMinX, y: y0, z: z0 }, { x: bMaxX, y: y0, z: z0 }, { x: bMaxX, y: y1, z: z1 });
                        addTri({ x: bMinX, y: y0, z: z0 }, { x: bMaxX, y: y1, z: z1 }, { x: bMinX, y: y1, z: z1 });
                    }

                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const z0 = cy + t0 * (bMaxY - cy), z1 = cy + t1 * (bMaxY - cy);
                        const y0 = (1 - t0) * rh + curve * Math.sin(Math.PI * (1 - t0));
                        const y1 = (1 - t1) * rh + curve * Math.sin(Math.PI * (1 - t1));

                        addTri({ x: bMinX, y: y0, z: z0 }, { x: bMaxX, y: y0, z: z0 }, { x: bMaxX, y: y1, z: z1 });
                        addTri({ x: bMinX, y: y0, z: z0 }, { x: bMaxX, y: y1, z: z1 }, { x: bMinX, y: y1, z: z1 });
                    }

                    addTri(kSW, kNW, r1);
                    addTri(kNE, kSE, r2);

                    gv.push(bMinX, 0, bMinY, bMinX, hBreak, kNW.z, bMinX, 0, bMaxY);
                    guv.push(0, 0, 0.3, 0.6, 1, 0);
                    gv.push(bMinX, hBreak, kNW.z, bMinX, hBreak, kSW.z, bMinX, 0, bMaxY);
                    guv.push(0.3, 0.6, 0.7, 0.6, 1, 0);

                    gv.push(bMaxX, 0, bMinY, bMaxX, 0, bMaxY, bMaxX, hBreak, kNE.z);
                    guv.push(0, 0, 1, 0, 0.3, 0.6);
                    gv.push(bMaxX, hBreak, kNE.z, bMaxX, 0, bMaxY, bMaxX, hBreak, kSE.z);
                    guv.push(0.3, 0.6, 1, 0, 0.7, 0.6);
                } else {
                    const cx = bMinX + bW / 2;
                    const r1 = { x: cx, y: rh, z: bMinY + inBreak };
                    const r2 = { x: cx, y: rh, z: bMaxY - inBreak };

                    const kNW = { x: bMinX + inBreak, y: hBreak, z: bMinY };
                    const kNE = { x: bMaxX - inBreak, y: hBreak, z: bMinY };
                    const kSW = { x: bMinX + inBreak, y: hBreak, z: bMaxY };
                    const kSE = { x: bMaxX - inBreak, y: hBreak, z: bMaxY };

                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const x0 = bMinX + t0 * (cx - bMinX), x1 = bMinX + t1 * (cx - bMinX);
                        const y0 = t0 * rh + curve * Math.sin(Math.PI * t0);
                        const y1 = t1 * rh + curve * Math.sin(Math.PI * t1);

                        addTri({ x: x0, y: y0, z: bMinY }, { x: x0, y: y0, z: bMaxY }, { x: x1, y: y1, z: bMaxY });
                        addTri({ x: x0, y: y0, z: bMinY }, { x: x1, y: y1, z: bMaxY }, { x: x1, y: y1, z: bMinY });
                    }

                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const x0 = cx + t0 * (bMaxX - cx), x1 = cx + t1 * (bMaxX - cx);
                        const y0 = (1 - t0) * rh + curve * Math.sin(Math.PI * (1 - t0));
                        const y1 = (1 - t1) * rh + curve * Math.sin(Math.PI * (1 - t1));

                        addTri({ x: x0, y: y0, z: bMinY }, { x: x0, y: y0, z: bMaxY }, { x: x1, y: y1, z: bMaxY });
                        addTri({ x: x0, y: y0, z: bMinY }, { x: x1, y: y1, z: bMaxY }, { x: x1, y: y1, z: bMinY });
                    }

                    addTri(kNE, kNW, r1);
                    addTri(kSW, kSE, r2);

                    gv.push(bMinX, 0, bMinY, bMaxX, 0, bMinY, kNW.x, hBreak, bMinY);
                    guv.push(0, 0, 1, 0, 0.3, 0.6);
                    gv.push(kNW.x, hBreak, bMinY, bMaxX, 0, bMinY, kNE.x, hBreak, bMinY);
                    guv.push(0.3, 0.6, 1, 0, 0.7, 0.6);

                    gv.push(bMinX, 0, bMaxY, kSW.x, hBreak, bMaxY, bMaxX, 0, bMaxY);
                    guv.push(0, 0, 0.3, 0.6, 1, 0);
                    gv.push(kSW.x, hBreak, bMaxY, kSE.x, hBreak, bMaxY, bMaxX, 0, bMaxY);
                    guv.push(0.3, 0.6, 0.7, 0.6, 1, 0);
                }

                const T = conf.thickness || 8;
                const {v: vThick, uv: uvThick} = thickenGeometry(v, uv, T);

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(vThick, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvThick, 2));
                geo.computeVertexNormals();

                applyRoofGroups(geo, v.length, vThick.length, isGlassRoof);
                mesh = new THREE.Mesh(geo, [mat, fasciaMat]);

                if (gv.length > 0) {
                    const gGeo = new THREE.BufferGeometry();
                    gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gv, 3));
                    gGeo.setAttribute("uv", new THREE.Float32BufferAttribute(guv, 2));
                    gGeo.computeVertexNormals();

                    let gableMat = (ctx?.helpers?.getDynamicMaterial ? ctx.helpers.getDynamicMaterial(conf.gableMaterial || 'white_plaster_wall', 'wall') : null) || new THREE.MeshStandardMaterial({color: 0xefede5});
                    gableMat.side = THREE.DoubleSide;
                    const gableMesh = new THREE.Mesh(gGeo, gableMat);
                    gableMesh.userData = { isRoof: true, isGable: true, entity: roof, materialSlot: 'gable', componentType: 'gable_wall' };
                    mesh.add(gableMesh);
                    ComponentRegistry.registerMesh(roof, "gable", gableMesh);
                }
        } else {
            // Standard Hip Roof
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                pts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;

                const pitch = conf.pitch || 30;
                const maxSpan = Math.min(bW, bD);
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                const isHorizontal = bW >= bD;
                const ridgeOffset = conf.ridgeOffset || 0;

                const vN = [], uvN = [];
                const vS = [], uvS = [];
                const vW = [], uvW = [];
                const vE = [], uvE = [];

                const addTriTo = (targetV, targetUV, p1, p2, p3) => {
                    let dx1 = p2.x - p1.x, dz1 = p2.z - p1.z;
                    let dx2 = p3.x - p1.x, dz2 = p3.z - p1.z;
                    let ny = dz1 * dx2 - dx1 * dz2;
                    if (ny < 0) {
                        targetV.push(p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z);
                        targetUV.push(p1.x / 100, p1.z / 100, p3.x / 100, p3.z / 100, p2.x / 100, p2.z / 100);
                    } else {
                        targetV.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
                        targetUV.push(p1.x / 100, p1.z / 100, p2.x / 100, p2.z / 100, p3.x / 100, p3.z / 100);
                    }
                };

                const curve = conf.curve || 0;
                const numSubdivs = curve !== 0 ? 12 : 1;

                if (isHorizontal) {
                    const r1 = { x: bMinX + bD / 2, y: rh, z: bMinY + bD / 2 + ridgeOffset };
                    const r2 = { x: bMaxX - bD / 2, y: rh, z: bMinY + bD / 2 + ridgeOffset };

                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs;
                        const t1 = (i + 1) / numSubdivs;
                        let y0 = t0 * rh + (curve !== 0 ? curve * Math.sin(Math.PI * t0) : 0);
                        let y1 = t1 * rh + (curve !== 0 ? curve * Math.sin(Math.PI * t1) : 0);

                        const xL0 = bMinX + t0 * bD / 2, xR0 = bMaxX - t0 * bD / 2;
                        const xL1 = bMinX + t1 * bD / 2, xR1 = bMaxX - t1 * bD / 2;

                        const zN0 = bMinY + t0 * bD / 2, zN1 = bMinY + t1 * bD / 2;
                        const zS0 = bMaxY - t0 * bD / 2, zS1 = bMaxY - t1 * bD / 2;

                        // 1. North Slope Strip
                        addTriTo(vN, uvN, { x: xL0, y: y0, z: zN0 }, { x: xR0, y: y0, z: zN0 }, { x: xR1, y: y1, z: zN1 });
                        addTriTo(vN, uvN, { x: xL0, y: y0, z: zN0 }, { x: xR1, y: y1, z: zN1 }, { x: xL1, y: y1, z: zN1 });

                        // 2. South Slope Strip
                        addTriTo(vS, uvS, { x: xR0, y: y0, z: zS0 }, { x: xL0, y: y0, z: zS0 }, { x: xL1, y: y1, z: zS1 });
                        addTriTo(vS, uvS, { x: xR0, y: y0, z: zS0 }, { x: xL1, y: y1, z: zS1 }, { x: xR1, y: y1, z: zS1 });

                        // 3. West Hip Strip
                        if (i === numSubdivs - 1) {
                            addTriTo(vW, uvW, { x: xL0, y: y0, z: zS0 }, { x: xL0, y: y0, z: zN0 }, { x: r1.x, y: rh, z: r1.z });
                        } else {
                            addTriTo(vW, uvW, { x: xL0, y: y0, z: zS0 }, { x: xL0, y: y0, z: zN0 }, { x: xL1, y: y1, z: zN1 });
                            addTriTo(vW, uvW, { x: xL0, y: y0, z: zS0 }, { x: xL1, y: y1, z: zN1 }, { x: xL1, y: y1, z: zS1 });
                        }

                        // 4. East Hip Strip
                        if (i === numSubdivs - 1) {
                            addTriTo(vE, uvE, { x: xR0, y: y0, z: zN0 }, { x: xR0, y: y0, z: zS0 }, { x: r2.x, y: rh, z: r2.z });
                        } else {
                            addTriTo(vE, uvE, { x: xR0, y: y0, z: zN0 }, { x: xR0, y: y0, z: zS0 }, { x: xR1, y: y1, z: zN1 });
                            addTriTo(vE, uvE, { x: xR0, y: y0, z: zS0 }, { x: xR1, y: y1, z: zN1 }, { x: xR1, y: y1, z: zS1 });
                        }
                    }
                } else {
                    const r1 = { x: bMinX + bW / 2 + ridgeOffset, y: rh, z: bMinY + bW / 2 };
                    const r2 = { x: bMinX + bW / 2 + ridgeOffset, y: rh, z: bMaxY - bW / 2 };

                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs;
                        const t1 = (i + 1) / numSubdivs;
                        let y0 = t0 * rh + (curve !== 0 ? curve * Math.sin(Math.PI * t0) : 0);
                        let y1 = t1 * rh + (curve !== 0 ? curve * Math.sin(Math.PI * t1) : 0);

                        const zT0 = bMinY + t0 * bW / 2, zB0 = bMaxY - t0 * bW / 2;
                        const zT1 = bMinY + t1 * bW / 2, zB1 = bMaxY - t1 * bW / 2;

                        const xW0 = bMinX + t0 * bW / 2, xW1 = bMinX + t1 * bW / 2;
                        const xE0 = bMaxX - t0 * bW / 2, xE1 = bMaxX - t1 * bW / 2;

                        // 1. West Slope Strip
                        addTriTo(vW, uvW, { x: xW0, y: y0, z: zB0 }, { x: xW0, y: y0, z: zT0 }, { x: xW1, y: y1, z: zT1 });
                        addTriTo(vW, uvW, { x: xW0, y: y0, z: zB0 }, { x: xW1, y: y1, z: zT1 }, { x: xW1, y: y1, z: zB1 });

                        // 2. East Slope Strip
                        addTriTo(vE, uvE, { x: xE0, y: y0, z: zT0 }, { x: xE0, y: y0, z: zB0 }, { x: xE1, y: y1, z: zB1 });
                        addTriTo(vE, uvE, { x: xE0, y: y0, z: zT0 }, { x: xE1, y: y1, z: zB1 }, { x: xE1, y: y1, z: zT1 });

                        // 3. North Hip Strip
                        if (i === numSubdivs - 1) {
                            addTriTo(vN, uvN, { x: xE0, y: y0, z: zT0 }, { x: xW0, y: y0, z: zT0 }, { x: r1.x, y: rh, z: r1.z });
                        } else {
                            addTriTo(vN, uvN, { x: xE0, y: y0, z: zT0 }, { x: xW0, y: y0, z: zT0 }, { x: xW1, y: y1, z: zT1 });
                            addTriTo(vN, uvN, { x: xE0, y: y0, z: zT0 }, { x: xW1, y: y1, z: zT1 }, { x: xE1, y: y1, z: zT1 });
                        }

                        // 4. South Hip Strip
                        if (i === numSubdivs - 1) {
                            addTriTo(vS, uvS, { x: xW0, y: y0, z: zB0 }, { x: xE0, y: y0, z: zB0 }, { x: r2.x, y: rh, z: r2.z });
                        } else {
                            addTriTo(vS, uvS, { x: xW0, y: y0, z: zB0 }, { x: xE0, y: y0, z: zB0 }, { x: xE1, y: y1, z: zB1 });
                            addTriTo(vS, uvS, { x: xW0, y: y0, z: zB0 }, { x: xE1, y: y1, z: zB1 }, { x: xW1, y: y1, z: zB1 });
                        }
                    }
                }

                const v = [...vN, ...vS, ...vW, ...vE];
                const uv = [...uvN, ...uvS, ...uvW, ...uvE];

                const T = conf.thickness || 8;
                const {v: vThick, uv: uvThick} = thickenGeometry(v, uv, T);

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(vThick, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvThick, 2));
                geo.computeVertexNormals();
                
                const hasHipOverrides = Boolean(conf.slopes && (conf.slopes.north || conf.slopes.south || conf.slopes.west || conf.slopes.east));
                if (hasHipOverrides) {
                    const sN = resolveRoofMaterial(conf.slopes.north || conf.material);
                    const sS = resolveRoofMaterial(conf.slopes.south || conf.material);
                    const sW = resolveRoofMaterial(conf.slopes.west || conf.material);
                    const sE = resolveRoofMaterial(conf.slopes.east || conf.material);

                    const cN = vN.length / 3;
                    const cS = vS.length / 3;
                    const cW = vW.length / 3;
                    const cE = vE.length / 3;
                    const totalTop = cN + cS + cW + cE;
                    const fasciaCount = (vThick.length / 3) - 2 * totalTop;

                    geo.addGroup(0, cN, 0);
                    geo.addGroup(cN, cS, 1);
                    geo.addGroup(cN + cS, cW, 2);
                    geo.addGroup(cN + cS + cW, cE, 3);

                    geo.addGroup(totalTop, cN, sN.isGlass ? 0 : 4);
                    geo.addGroup(totalTop + cN, cS, sS.isGlass ? 1 : 4);
                    geo.addGroup(totalTop + cN + cS, cW, sW.isGlass ? 2 : 4);
                    geo.addGroup(totalTop + cN + cS + cW, cE, sE.isGlass ? 3 : 4);

                    geo.addGroup(2 * totalTop, fasciaCount, 4);

                    mesh = new THREE.Mesh(geo, [sN.mat, sS.mat, sW.mat, sE.mat, fasciaMat]);
                } else {
                    applyRoofGroups(geo, v.length, vThick.length, isGlassRoof);
                    mesh = new THREE.Mesh(geo, [mat, fasciaMat]);
                }
            }

        return mesh;
    }
}

import * as THREE from 'three';
import { ComponentRegistry } from '../../../../core/engine3d/ComponentRegistry.js';
import { thickenGeometry, applyRoofGroups } from './RoofGeneratorHelpers.js';

/**
 * Specialized CAD/BIM Generator for Complex Roofs: Turret, Gambrel, and Mansard.
 * Handles:
 * - Octagonal, hexagonal, and square multi-faceted turrets & spires
 * - Dual-pitch barn gambrel roofs with upper cap and lower rake knuckles
 * - French curb mansard roofs with flat terrace upper caps
 */
export class ComplexRoofGenerator {
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
        const roofType = conf.roofType || 'turret';
        let mesh;

        if (roofType.startsWith('turret')) {
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                pts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;
                const cx = (bMinX + bMaxX) / 2;
                const cz = (bMinY + bMaxY) / 2;
                const Rx = bW / 2;
                const Rz = bD / 2;
                const baseR = Math.min(Rx, Rz);

                const pitch = conf.pitch !== undefined ? conf.pitch : 40;
                const rh = Math.tan(pitch * Math.PI / 180) * baseR;
                const curve = conf.curve || 0;
                const overhang = conf.overhang !== undefined ? conf.overhang : 8;

                let numSides = 32;
                if (conf.roofType === 'turret_octagonal') numSides = 8;
                else if (conf.roofType === 'turret_hexagonal') numSides = 6;
                else if (conf.roofType === 'turret_square') numSides = 4;

                const v = [], uv = [];
                const addQuad = (p0, p1, p2, p3) => {
                    let dx1 = p1.x - p0.x, dz1 = p1.z - p0.z;
                    let dx2 = p2.x - p0.x, dz2 = p2.z - p0.z;
                    let ny = dz1 * dx2 - dx1 * dz2;
                    if (ny < 0) {
                        v.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p1.x, p1.y, p1.z);
                        uv.push(p0.x / 100, p0.z / 100, p2.x / 100, p2.z / 100, p1.x / 100, p1.z / 100);
                        v.push(p0.x, p0.y, p0.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z);
                        uv.push(p0.x / 100, p0.z / 100, p3.x / 100, p3.z / 100, p2.x / 100, p2.z / 100);
                    } else {
                        v.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                        uv.push(p0.x / 100, p0.z / 100, p1.x / 100, p1.z / 100, p2.x / 100, p2.z / 100);
                        v.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
                        uv.push(p0.x / 100, p0.z / 100, p2.x / 100, p2.z / 100, p3.x / 100, p3.z / 100);
                    }
                };

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

                const numSubdivs = 16;
                const apex = { x: cx, y: rh, z: cz };
                for (let s = 0; s < numSubdivs; s++) {
                    const t0 = s / numSubdivs;
                    const t1 = (s + 1) / numSubdivs;
                    let y0 = t0 * rh + curve * Math.sin(Math.PI * t0);
                    let y1 = t1 * rh + curve * Math.sin(Math.PI * t1);

                    const rFactor0 = 1 - t0;
                    const rFactor1 = 1 - t1;
                    const flare0 = curve !== 0 ? (curve * 0.3 * Math.sin(Math.PI * t0)) : 0;
                    const flare1 = curve !== 0 ? (curve * 0.3 * Math.sin(Math.PI * t1)) : 0;

                    const rx0 = Math.max(0, (Rx + overhang * (1 - t0)) * rFactor0 - flare0);
                    const rz0 = Math.max(0, (Rz + overhang * (1 - t0)) * rFactor0 - flare0);

                    if (s === numSubdivs - 1) {
                        for (let i = 0; i < numSides; i++) {
                            const a0 = (i / numSides) * Math.PI * 2;
                            const a1 = ((i + 1) / numSides) * Math.PI * 2;

                            const p0 = { x: cx + rx0 * Math.cos(a0), y: y0, z: cz + rz0 * Math.sin(a0) };
                            const p1 = { x: cx + rx0 * Math.cos(a1), y: y0, z: cz + rz0 * Math.sin(a1) };
                            addTri(p0, p1, apex);
                        }
                    } else {
                        const rx1 = Math.max(0, (Rx + overhang * (1 - t1)) * rFactor1 - flare1);
                        const rz1 = Math.max(0, (Rz + overhang * (1 - t1)) * rFactor1 - flare1);

                        for (let i = 0; i < numSides; i++) {
                            const a0 = (i / numSides) * Math.PI * 2;
                            const a1 = ((i + 1) / numSides) * Math.PI * 2;

                            const p0 = { x: cx + rx0 * Math.cos(a0), y: y0, z: cz + rz0 * Math.sin(a0) };
                            const p1 = { x: cx + rx0 * Math.cos(a1), y: y0, z: cz + rz0 * Math.sin(a1) };
                            const p2 = { x: cx + rx1 * Math.cos(a1), y: y1, z: cz + rz1 * Math.sin(a1) };
                            const p3 = { x: cx + rx1 * Math.cos(a0), y: y1, z: cz + rz1 * Math.sin(a0) };

                            addQuad(p0, p1, p2, p3);
                        }
                    }
                }

                const T = conf.thickness || 8;
                const {v: vThick, uv: uvThick} = thickenGeometry(v, uv, T);

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(vThick, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvThick, 2));
                geo.computeVertexNormals();

                applyRoofGroups(geo, v.length, vThick.length, isGlassRoof);
                mesh = new THREE.Mesh(geo, [mat, fasciaMat]);
        } else if (roofType === 'gambrel') {
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                pts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;

                const pitch = conf.pitch !== undefined ? conf.pitch : 45;
                const axis = conf.ridgeAxis || 'x';
                const maxSpan = axis === 'x' ? bD : bW;
                const halfSpan = maxSpan / 2;
                const rh = Math.tan(pitch * Math.PI / 180) * halfSpan;
                let cx = bMinX + bW / 2;
                let cy = bMinY + bD / 2;
                const curve = conf.curve || 0;

                const kHeight = rh * 0.60;
                const kSpan = halfSpan * 0.35;

                const v = [], uv = [], gv = [], guv = [];
                const addQuad = (p0, p1, p2, p3) => {
                    let dx1 = p1.x - p0.x, dz1 = p1.z - p0.z;
                    let dx2 = p2.x - p0.x, dz2 = p2.z - p0.z;
                    let ny = dz1 * dx2 - dx1 * dz2;
                    if (ny < 0) {
                        v.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p1.x, p1.y, p1.z);
                        uv.push(p0.x / 100, p0.z / 100, p2.x / 100, p2.z / 100, p1.x / 100, p1.z / 100);
                        v.push(p0.x, p0.y, p0.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z);
                        uv.push(p0.x / 100, p0.z / 100, p3.x / 100, p3.z / 100, p2.x / 100, p2.z / 100);
                    } else {
                        v.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                        uv.push(p0.x / 100, p0.z / 100, p1.x / 100, p1.z / 100, p2.x / 100, p2.z / 100);
                        v.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
                        uv.push(p0.x / 100, p0.z / 100, p2.x / 100, p2.z / 100, p3.x / 100, p3.z / 100);
                    }
                };

                const numSubdivs = 8;
                if (axis === 'x') {
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const z0 = bMinY + t0 * kSpan, z1 = bMinY + t1 * kSpan;
                        const y0 = t0 * kHeight + curve * Math.sin(Math.PI * t0);
                        const y1 = t1 * kHeight + curve * Math.sin(Math.PI * t1);
                        addQuad({ x: bMinX, y: y0, z: z0 }, { x: bMaxX, y: y0, z: z0 }, { x: bMaxX, y: y1, z: z1 }, { x: bMinX, y: y1, z: z1 });
                    }
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const z0 = (bMinY + kSpan) + t0 * (cy - (bMinY + kSpan));
                        const z1 = (bMinY + kSpan) + t1 * (cy - (bMinY + kSpan));
                        const y0 = kHeight + t0 * (rh - kHeight) + curve * Math.sin(Math.PI * t0);
                        const y1 = kHeight + t1 * (rh - kHeight) + curve * Math.sin(Math.PI * t1);
                        addQuad({ x: bMinX, y: y0, z: z0 }, { x: bMaxX, y: y0, z: z0 }, { x: bMaxX, y: y1, z: z1 }, { x: bMinX, y: y1, z: z1 });
                    }
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const z0 = cy + t0 * ((bMaxY - kSpan) - cy);
                        const z1 = cy + t1 * ((bMaxY - kSpan) - cy);
                        const y0 = rh - t0 * (rh - kHeight) + curve * Math.sin(Math.PI * (1 - t0));
                        const y1 = rh - t1 * (rh - kHeight) + curve * Math.sin(Math.PI * (1 - t1));
                        addQuad({ x: bMinX, y: y0, z: z0 }, { x: bMaxX, y: y0, z: z0 }, { x: bMaxX, y: y1, z: z1 }, { x: bMinX, y: y1, z: z1 });
                    }
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const z0 = (bMaxY - kSpan) + t0 * kSpan;
                        const z1 = (bMaxY - kSpan) + t1 * kSpan;
                        const y0 = kHeight * (1 - t0) + curve * Math.sin(Math.PI * (1 - t0));
                        const y1 = kHeight * (1 - t1) + curve * Math.sin(Math.PI * (1 - t1));
                        addQuad({ x: bMinX, y: y0, z: z0 }, { x: bMaxX, y: y0, z: z0 }, { x: bMaxX, y: y1, z: z1 }, { x: bMinX, y: y1, z: z1 });
                    }

                    const buildGableEnd = (gx) => {
                        const z0 = bMinY, z1 = bMinY + kSpan, z2 = cy, z3 = bMaxY - kSpan, z4 = bMaxY;
                        gv.push(gx, 0, z0, gx, kHeight, z1, gx, 0, z4);
                        guv.push(0, 0, 0.2, 0.6, 1, 0);
                        gv.push(gx, kHeight, z1, gx, rh, z2, gx, kHeight, z3);
                        guv.push(0.2, 0.6, 0.5, 1, 0.8, 0.6);
                        gv.push(gx, kHeight, z1, gx, kHeight, z3, gx, 0, z4);
                        guv.push(0.2, 0.6, 0.8, 0.6, 1, 0);
                    };
                    buildGableEnd(bMinX);
                    buildGableEnd(bMaxX);
                } else {
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const x0 = bMinX + t0 * kSpan, x1 = bMinX + t1 * kSpan;
                        const y0 = t0 * kHeight + curve * Math.sin(Math.PI * t0);
                        const y1 = t1 * kHeight + curve * Math.sin(Math.PI * t1);
                        addQuad({ x: x0, y: y0, z: bMinY }, { x: x0, y: y0, z: bMaxY }, { x: x1, y: y1, z: bMaxY }, { x: x1, y: y1, z: bMinY });
                    }
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const x0 = (bMinX + kSpan) + t0 * (cx - (bMinX + kSpan));
                        const x1 = (bMinX + kSpan) + t1 * (cx - (bMinX + kSpan));
                        const y0 = kHeight + t0 * (rh - kHeight) + curve * Math.sin(Math.PI * t0);
                        const y1 = kHeight + t1 * (rh - kHeight) + curve * Math.sin(Math.PI * t1);
                        addQuad({ x: x0, y: y0, z: bMinY }, { x: x0, y: y0, z: bMaxY }, { x: x1, y: y1, z: bMaxY }, { x: x1, y: y1, z: bMinY });
                    }
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const x0 = cx + t0 * ((bMaxX - kSpan) - cx);
                        const x1 = cx + t1 * ((bMaxX - kSpan) - cx);
                        const y0 = rh - t0 * (rh - kHeight) + curve * Math.sin(Math.PI * (1 - t0));
                        const y1 = rh - t1 * (rh - kHeight) + curve * Math.sin(Math.PI * (1 - t1));
                        addQuad({ x: x0, y: y0, z: bMinY }, { x: x0, y: y0, z: bMaxY }, { x: x1, y: y1, z: bMaxY }, { x: x1, y: y1, z: bMinY });
                    }
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                        const x0 = (bMaxX - kSpan) + t0 * kSpan;
                        const x1 = (bMaxX - kSpan) + t1 * kSpan;
                        const y0 = kHeight * (1 - t0) + curve * Math.sin(Math.PI * (1 - t0));
                        const y1 = kHeight * (1 - t1) + curve * Math.sin(Math.PI * (1 - t1));
                        addQuad({ x: x0, y: y0, z: bMinY }, { x: x0, y: y0, z: bMaxY }, { x: x1, y: y1, z: bMaxY }, { x: x1, y: y1, z: bMinY });
                    }

                    const buildGableEnd = (gz) => {
                        const x0 = bMinX, x1 = bMinX + kSpan, x2 = cx, x3 = bMaxX - kSpan, x4 = bMaxX;
                        gv.push(x0, 0, gz, x1, kHeight, gz, x4, 0, gz);
                        guv.push(0, 0, 0.2, 0.6, 1, 0);
                        gv.push(x1, kHeight, gz, x2, rh, gz, x3, kHeight, gz);
                        guv.push(0.2, 0.6, 0.5, 1, 0.8, 0.6);
                        gv.push(x1, kHeight, gz, x3, kHeight, gz, x4, 0, gz);
                        guv.push(0.2, 0.6, 0.8, 0.6, 1, 0);
                    };
                    buildGableEnd(bMinY);
                    buildGableEnd(bMaxY);
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
        } else if (roofType === 'mansard') {
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                pts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;

                const pitch = conf.pitch !== undefined ? conf.pitch : 60;
                const maxSpan = Math.min(bW, bD);
                const halfSpan = maxSpan / 2;
                const rh = Math.tan(pitch * Math.PI / 180) * halfSpan;
                const kHeight = rh * 0.70;
                const kInward = halfSpan * 0.28;
                const curve = conf.curve || 0;

                const v = [], uv = [];
                const addQuad = (p0, p1, p2, p3) => {
                    let dx1 = p1.x - p0.x, dz1 = p1.z - p0.z;
                    let dx2 = p2.x - p0.x, dz2 = p2.z - p0.z;
                    let ny = dz1 * dx2 - dx1 * dz2;
                    if (ny < 0) {
                        v.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p1.x, p1.y, p1.z);
                        uv.push(p0.x / 100, p0.z / 100, p2.x / 100, p2.z / 100, p1.x / 100, p1.z / 100);
                        v.push(p0.x, p0.y, p0.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z);
                        uv.push(p0.x / 100, p0.z / 100, p3.x / 100, p3.z / 100, p2.x / 100, p2.z / 100);
                    } else {
                        v.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                        uv.push(p0.x / 100, p0.z / 100, p1.x / 100, p1.z / 100, p2.x / 100, p2.z / 100);
                        v.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
                        uv.push(p0.x / 100, p0.z / 100, p2.x / 100, p2.z / 100, p3.x / 100, p3.z / 100);
                    }
                };

                const numSubdivs = 16;
                for (let i = 0; i < numSubdivs; i++) {
                    const t0 = i / numSubdivs, t1 = (i + 1) / numSubdivs;
                    const y0 = t0 * kHeight + curve * Math.sin(Math.PI * t0);
                    const y1 = t1 * kHeight + curve * Math.sin(Math.PI * t1);
                    const in0 = t0 * kInward, in1 = t1 * kInward;

                    const nw0 = { x: bMinX + in0, y: y0, z: bMinY + in0 };
                    const ne0 = { x: bMaxX - in0, y: y0, z: bMinY + in0 };
                    const se0 = { x: bMaxX - in0, y: y0, z: bMaxY - in0 };
                    const sw0 = { x: bMinX + in0, y: y0, z: bMaxY - in0 };

                    const nw1 = { x: bMinX + in1, y: y1, z: bMinY + in1 };
                    const ne1 = { x: bMaxX - in1, y: y1, z: bMinY + in1 };
                    const se1 = { x: bMaxX - in1, y: y1, z: bMaxY - in1 };
                    const sw1 = { x: bMinX + in1, y: y1, z: bMaxY - in1 };

                    addQuad(nw0, ne0, ne1, nw1);
                    addQuad(ne0, se0, se1, ne1);
                    addQuad(se0, sw0, sw1, se1);
                    addQuad(sw0, nw0, nw1, sw1);
                }

                const kNW = { x: bMinX + kInward, y: kHeight, z: bMinY + kInward };
                const kNE = { x: bMaxX - kInward, y: kHeight, z: bMinY + kInward };
                const kSE = { x: bMaxX - kInward, y: kHeight, z: bMaxY - kInward };
                const kSW = { x: bMinX + kInward, y: kHeight, z: bMaxY - kInward };

                const topApexY = rh;
                const topApexZ = (kNW.z + kSW.z) / 2;
                const topApexX = (kNW.x + kNE.x) / 2;
                addQuad(kNW, kNE, { x: topApexX, y: topApexY, z: topApexZ }, { x: topApexX, y: topApexY, z: topApexZ });
                addQuad(kSW, kSE, { x: topApexX, y: topApexY, z: topApexZ }, { x: topApexX, y: topApexY, z: topApexZ });
                addQuad(kNW, kSW, { x: topApexX, y: topApexY, z: topApexZ }, { x: topApexX, y: topApexY, z: topApexZ });
                addQuad(kNE, kSE, { x: topApexX, y: topApexY, z: topApexZ }, { x: topApexX, y: topApexY, z: topApexZ });

                const T = conf.thickness || 8;
                const {v: vThick, uv: uvThick} = thickenGeometry(v, uv, T);

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(vThick, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvThick, 2));
                geo.computeVertexNormals();

                applyRoofGroups(geo, v.length, vThick.length, isGlassRoof);
                mesh = new THREE.Mesh(geo, [mat, fasciaMat]);
        }

        return mesh;
    }
}

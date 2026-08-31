import * as THREE from 'three';
import { WALL_HEIGHT, ROOF_DECOR_REGISTRY, WALL_DECOR_REGISTRY, offsetPolygon } from '../../../core/registry.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';

export class Roof3DBuilder {
    constructor(ctx) {
        this.ctx = ctx;
    }

    buildRoofs(roofs, activeIndex, walls, targetGroup, shapes = null) {
        if (!roofs || roofs.length === 0) return;
        
        const shapeList = shapes || (this.ctx && this.ctx.shapes) || (this.ctx && this.ctx.planner && this.ctx.planner.shapes) || [];
        const wallList = (walls && Array.isArray(walls) && walls.length > 0) ? walls : (this.ctx?.walls || this.ctx?.planner?.walls || []);
        const hasWalls = wallList && wallList.length > 0;
        let maxWallHeight = 120;
        if (hasWalls) {
            const mainWalls = wallList.filter(w => !w.parentGroup);
            if (mainWalls.length > 0) maxWallHeight = Math.max(...mainWalls.map(w => w.height !== undefined ? w.height : (w.config?.height || 120)));
        }

        const thickenGeometry = (v, uv, T) => {
            const vNew = [...v];
            const uvNew = [...uv];
            
            // Bottom surface
            for (let i = 0; i < v.length; i += 9) {
                const p0x = v[i], p0y = v[i+1], p0z = v[i+2];
                const p1x = v[i+3], p1y = v[i+4], p1z = v[i+5];
                const p2x = v[i+6], p2y = v[i+7], p2z = v[i+8];
                
                vNew.push(
                    p0x, p0y - T, p0z,
                    p2x, p2y - T, p2z,
                    p1x, p1y - T, p1z
                );
                
                const uv0u = uv[i/3*2], uv0v = uv[i/3*2+1];
                const uv1u = uv[i/3*2+2], uv1v = uv[i/3*2+3];
                const uv2u = uv[i/3*2+4], uv2v = uv[i/3*2+5];
                
                uvNew.push(uv0u, uv0v, uv2u, uv2v, uv1u, uv1v);
            }
            
            // Fascia
            const edges = {};
            for (let i = 0; i < v.length; i += 9) {
                for (let j = 0; j < 3; j++) {
                    const idx1 = i + j*3;
                    const idx2 = i + ((j+1)%3)*3;
                    const p1 = {x: v[idx1], y: v[idx1+1], z: v[idx1+2]};
                    const p2 = {x: v[idx2], y: v[idx2+1], z: v[idx2+2]};
                    const key = `${p1.x.toFixed(3)},${p1.y.toFixed(3)},${p1.z.toFixed(3)}|${p2.x.toFixed(3)},${p2.y.toFixed(3)},${p2.z.toFixed(3)}`;
                    const revKey = `${p2.x.toFixed(3)},${p2.y.toFixed(3)},${p2.z.toFixed(3)}|${p1.x.toFixed(3)},${p1.y.toFixed(3)},${p1.z.toFixed(3)}`;
                    
                    if (edges[revKey]) delete edges[revKey];
                    else edges[key] = {p1, p2};
                }
            }
            
            Object.values(edges).forEach(({p1, p2}) => {
                const p1d = {x: p1.x, y: p1.y - T, z: p1.z};
                const p2d = {x: p2.x, y: p2.y - T, z: p2.z};
                vNew.push(
                    p1.x, p1.y, p1.z,
                    p1d.x, p1d.y, p1d.z,
                    p2d.x, p2d.y, p2d.z,
                    
                    p1.x, p1.y, p1.z,
                    p2d.x, p2d.y, p2d.z,
                    p2.x, p2.y, p2.z
                );
                
                const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z) / 100;
                const tUv = T / 100;
                uvNew.push(
                    0, tUv,    // p1
                    0, 0,      // p1d
                    dist, 0,   // p2d
                    
                    0, tUv,    // p1
                    dist, 0,   // p2d
                    dist, tUv  // p2
                );
            });
            
            return {v: vNew, uv: uvNew};
        };

        roofs.forEach(roof => {
            try {
                const basePts = roof.points || [];
                if (basePts.length < 3) return;

            const conf = roof.config || roof; 
            const overhangs = conf.overhangs ? conf.overhangs : (conf.overhang !== undefined ? conf.overhang : 8);
            const pts = offsetPolygon(basePts, overhangs);

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            pts.forEach(p => {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            });

            const wallGap = conf.wallGap || 0;
            
            const W = maxX - minX;
            const D = maxY - minY;
            
            // Find walls that intersect or are near this roof
            let localWallHeight = maxWallHeight;
            if (hasWalls) {
                const wallsUnderRoof = wallList.filter(w => {
                    const p1 = (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position() : (w.startAnchor || { x: w.startX || 0, y: w.startY || 0 });
                    const p2 = (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position() : (w.endAnchor || { x: w.endX || 0, y: w.endY || 0 });
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
                    return midX >= minX - 40 && midX <= maxX + 40 && midY >= minY - 40 && midY <= maxY + 40;
                });
                if (wallsUnderRoof.length > 0) {
                    localWallHeight = Math.max(...wallsUnderRoof.map(w => w.height !== undefined ? w.height : (w.config?.height || 120)));
                }
            }

            const baseHeight = roof.elevation !== undefined ? roof.elevation : (hasWalls ? localWallHeight : 0);
            const h = baseHeight + wallGap;

            const decor = ROOF_DECOR_REGISTRY[conf.material] || ROOF_DECOR_REGISTRY['concrete_flat'];
            const mat = this.ctx.helpers.getDynamicMaterial(roof.config?.material || 'terracotta_tiles_roof', 'roof') || new THREE.MeshStandardMaterial({color: 0x888888}); mat.side = THREE.DoubleSide;

            if (decor && decor.texture) {
                this.ctx.assets.getTexture(decor).then(tex => {
                    const texClone = tex.clone();
                    texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                    const baseSize = roof.tileSize || 100;
                    const tSize = baseSize * (decor.scaleRatio || 1);
                    texClone.repeat.set(100 / tSize, 100 / tSize);
                    mat.map = texClone;
                    mat.needsUpdate = true;
                });
            }

            let mesh;
            if (conf.roofType === 'flat') {
                const shape = new THREE.Shape();
                shape.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
                shape.lineTo(pts[0].x, pts[0].y);

                if (shapeList && shapeList.length > 0) {
                    const floorCuts = shapeList.filter(s => s.type === 'shape_floor_cut');
                    floorCuts.forEach(s => {
                        const rot = (s.group ? s.group.rotation() : (s.rotation || 0)) * Math.PI / 180;
                        const sx = s.group ? s.group.x() : (s.x || s.params?.x || 0);
                        const sy = s.group ? s.group.y() : (s.y || s.params?.y || 0);
                        let sPts = s.params?.points;
                        if (!sPts || sPts.length < 3) {
                            const w = s.params?.width || s.width || 100;
                            const h = s.params?.height || s.height || 100;
                            sPts = [ { x: -w/2, y: -h/2 }, { x: w/2, y: -h/2 }, { x: w/2, y: h/2 }, { x: -w/2, y: h/2 } ];
                        }
                        const rotC = sPts.map(c => ({
                            x: sx + (c.x * Math.cos(rot) - c.y * Math.sin(rot)),
                            y: sy + (c.x * Math.sin(rot) + c.y * Math.cos(rot))
                        }));

                        let minRx = Infinity, maxRx = -Infinity, minRy = Infinity, maxRy = -Infinity;
                        pts.forEach(p => {
                            if (p.x < minRx) minRx = p.x; if (p.x > maxRx) maxRx = p.x;
                            if (p.y < minRy) minRy = p.y; if (p.y > maxRy) maxRy = p.y;
                        });
                        let minHx = Infinity, maxHx = -Infinity, minHy = Infinity, maxHy = -Infinity;
                        rotC.forEach(p => {
                            if (p.x < minHx) minHx = p.x; if (p.x > maxHx) maxHx = p.x;
                            if (p.y < minHy) minHy = p.y; if (p.y > maxHy) maxHy = p.y;
                        });

                        if (!(maxRx <= minHx || minRx >= maxHx || maxRy <= minHy || minRy >= maxHy)) {
                            const roofIsCW = THREE.ShapeUtils.isClockWise(pts);
                            const holeIsCW = THREE.ShapeUtils.isClockWise(rotC);
                            const finalHolePts = (roofIsCW === holeIsCW) ? [...rotC].reverse() : rotC;

                            const hole = new THREE.Path();
                            hole.moveTo(finalHolePts[0].x, finalHolePts[0].y);
                            for (let i = 1; i < finalHolePts.length; i++) hole.lineTo(finalHolePts[i].x, finalHolePts[i].y);
                            hole.lineTo(finalHolePts[0].x, finalHolePts[0].y);
                            shape.holes.push(hole);
                        }
                    });
                }
                
                const geo = new THREE.ExtrudeGeometry(shape, { depth: conf.thickness || 2, bevelEnabled: false });
                geo.rotateX(Math.PI / 2);
                geo.translate(0, conf.thickness || 2, 0); 
                
                // UV Fix for Flat Roof (ExtrudeGeometry) - World Space Projection
                const uvs = geo.attributes.uv;
                const pos = geo.attributes.position;
                geo.computeVertexNormals();
                const norms = geo.attributes.normal;
                for (let i = 0; i < uvs.count; i++) {
                    const nx = Math.abs(norms.getX(i));
                    const ny = Math.abs(norms.getY(i));
                    const nz = Math.abs(norms.getZ(i));
                    const vx = pos.getX(i) / 100;
                    const vy = pos.getY(i) / 100;
                    const vz = pos.getZ(i) / 100;
                    
                    if (ny > 0.5) uvs.setXY(i, vx, vz); // Top/Bottom
                    else if (nx > nz) uvs.setXY(i, vz, vy); // Side X
                    else uvs.setXY(i, vx, vy); // Side Z
                }

                const matId = roof.configId || conf.material;
                let flatMat = new THREE.MeshStandardMaterial({ 
                    color: 0xefede5,
                    roughness: 0.98,
                    metalness: 0.02,
                    bumpScale: 0.015
                });
                
                if (matId && ROOF_DECOR_REGISTRY[matId]) {
                    const decorConf = ROOF_DECOR_REGISTRY[matId];
                    const tex = new THREE.TextureLoader().load(decorConf.texture);
                    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                    const baseSize = roof.tileSize || 100;
                    const tSize = baseSize * (decorConf.scaleRatio || 1);
                    tex.repeat.set(100 / tSize, 100 / tSize);
                    
                }

                mesh = new THREE.Mesh(geo, flatMat);
            } else if (conf.roofType === 'shed') {
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                pts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;

                const pitch = conf.pitch || 20;
                const axis = conf.ridgeAxis || 'x';
                const span = axis === 'x' ? bD : bW;
                const rh = Math.tan(pitch * Math.PI / 180) * span;
                const curve = conf.curve || 0;
                const flip = !!conf.flipSlope;

                const v = [], uv = [];
                const numSubdivs = curve !== 0 ? 12 : 1;
                for (let i = 0; i < numSubdivs; i++) {
                    const t0 = i / numSubdivs;
                    const t1 = (i + 1) / numSubdivs;
                    
                    let y0 = t0 * rh;
                    let y1 = t1 * rh;
                    if (curve !== 0) {
                        y0 += curve * Math.sin(Math.PI * t0);
                        y1 += curve * Math.sin(Math.PI * t1);
                    }

                    if (axis === 'x') {
                        const z0 = flip ? (bMaxY - t0 * bD) : (bMinY + t0 * bD);
                        const z1 = flip ? (bMaxY - t1 * bD) : (bMinY + t1 * bD);
                        
                        const pNW = { x: bMinX, y: y0, z: z0 };
                        const pNE = { x: bMaxX, y: y0, z: z0 };
                        const pSE = { x: bMaxX, y: y1, z: z1 };
                        const pSW = { x: bMinX, y: y1, z: z1 };

                        v.push(pNW.x, pNW.y, pNW.z, pNE.x, pNE.y, pNE.z, pSE.x, pSE.y, pSE.z);
                        uv.push(pNW.x/100, pNW.z/100, pNE.x/100, pNE.z/100, pSE.x/100, pSE.z/100);

                        v.push(pNW.x, pNW.y, pNW.z, pSE.x, pSE.y, pSE.z, pSW.x, pSW.y, pSW.z);
                        uv.push(pNW.x/100, pNW.z/100, pSE.x/100, pSE.z/100, pSW.x/100, pSW.z/100);
                    } else {
                        const x0 = flip ? (bMaxX - t0 * bW) : (bMinX + t0 * bW);
                        const x1 = flip ? (bMaxX - t1 * bW) : (bMinX + t1 * bW);
                        
                        const pNW = { x: x0, y: y0, z: bMinY };
                        const pSW = { x: x0, y: y0, z: bMaxY };
                        const pSE = { x: x1, y: y1, z: bMaxY };
                        const pNE = { x: x1, y: y1, z: bMinY };

                        v.push(pNW.x, pNW.y, pNW.z, pSW.x, pSW.y, pSW.z, pSE.x, pSE.y, pSE.z);
                        uv.push(pNW.x/100, pNW.z/100, pSW.x/100, pSW.z/100, pSE.x/100, pSE.z/100);

                        v.push(pNW.x, pNW.y, pNW.z, pSE.x, pSE.y, pSE.z, pNE.x, pNE.y, pNE.z);
                        uv.push(pNW.x/100, pNW.z/100, pSE.x/100, pSE.z/100, pNE.x/100, pNE.z/100);
                    }
                }

                // Side gable walls and rear high wall for Shed roof
                const gv = [], guv = [];
                if (axis === 'x') {
                    const zLow = flip ? bMaxY : bMinY;
                    const zHigh = flip ? bMinY : bMaxY;
                    gv.push(bMinX, 0, zLow, bMinX, rh, zHigh, bMinX, 0, zHigh);
                    guv.push(0, 0, 1, 1, 1, 0);
                    gv.push(bMaxX, 0, zLow, bMaxX, 0, zHigh, bMaxX, rh, zHigh);
                    guv.push(0, 0, 1, 0, 1, 1);
                    gv.push(bMinX, 0, zHigh, bMaxX, 0, zHigh, bMaxX, rh, zHigh);
                    guv.push(0, 0, 1, 0, 1, 1);
                    gv.push(bMinX, 0, zHigh, bMaxX, rh, zHigh, bMinX, rh, zHigh);
                    guv.push(0, 0, 1, 1, 0, 1);
                } else {
                    const xLow = flip ? bMaxX : bMinX;
                    const xHigh = flip ? bMinX : bMaxX;
                    gv.push(xLow, 0, bMinY, xHigh, rh, bMinY, xHigh, 0, bMinY);
                    guv.push(0, 0, 1, 1, 1, 0);
                    gv.push(xLow, 0, bMaxY, xHigh, 0, bMaxY, xHigh, rh, bMaxY);
                    guv.push(0, 0, 1, 0, 1, 1);
                    gv.push(xHigh, 0, bMinY, xHigh, rh, bMinY, xHigh, 0, bMaxY);
                    guv.push(0, 0, 0, 1, 1, 0);
                    gv.push(xHigh, rh, bMinY, xHigh, rh, bMaxY, xHigh, 0, bMaxY);
                    guv.push(0, 1, 1, 1, 1, 0);
                }

                const T = conf.thickness || 8;
                const {v: vThick, uv: uvThick} = thickenGeometry(v, uv, T);

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(vThick, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvThick, 2));
                geo.computeVertexNormals();
                
                geo.addGroup(0, v.length / 3, 0); 
                geo.addGroup(v.length / 3, (vThick.length - v.length) / 3, 1);

                const fasciaMat = this.ctx.helpers.getDynamicMaterial('white_plaster_wall', 'wall') || new THREE.MeshStandardMaterial({color: 0xF5F5F5});
                mesh = new THREE.Mesh(geo, [mat, fasciaMat]);

                if (gv.length > 0) {
                    const gGeo = new THREE.BufferGeometry();
                    gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gv, 3));
                    gGeo.setAttribute("uv", new THREE.Float32BufferAttribute(guv, 2));
                    gGeo.computeVertexNormals();

                    let gableMat = this.ctx.helpers.getDynamicMaterial(conf.gableMaterial || 'white_plaster_wall', 'wall') || new THREE.MeshStandardMaterial({color: 0xefede5});
                    gableMat.side = THREE.DoubleSide;
                    const gableMesh = new THREE.Mesh(gGeo, gableMat);
                    gableMesh.userData = { isRoof: true, isGable: true, entity: roof, materialSlot: 'gable', componentType: 'gable_wall' };
                    mesh.add(gableMesh);
                    ComponentRegistry.registerMesh(roof, "gable", gableMesh);
                }
            } else if (conf.roofType === 'half_hip') {
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
                
                geo.addGroup(0, v.length / 3, 0); 
                geo.addGroup(v.length / 3, (vThick.length - v.length) / 3, 1);

                const fasciaMat = this.ctx.helpers.getDynamicMaterial('white_plaster_wall', 'wall') || new THREE.MeshStandardMaterial({color: 0xF5F5F5});
                mesh = new THREE.Mesh(geo, [mat, fasciaMat]);

                if (gv.length > 0) {
                    const gGeo = new THREE.BufferGeometry();
                    gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gv, 3));
                    gGeo.setAttribute("uv", new THREE.Float32BufferAttribute(guv, 2));
                    gGeo.computeVertexNormals();

                    let gableMat = this.ctx.helpers.getDynamicMaterial(conf.gableMaterial || 'white_plaster_wall', 'wall') || new THREE.MeshStandardMaterial({color: 0xefede5});
                    gableMat.side = THREE.DoubleSide;
                    const gableMesh = new THREE.Mesh(gGeo, gableMat);
                    gableMesh.userData = { isRoof: true, isGable: true, entity: roof, materialSlot: 'gable', componentType: 'gable_wall' };
                    mesh.add(gableMesh);
                    ComponentRegistry.registerMesh(roof, "gable", gableMesh);
                }
            } else if (conf.roofType === 'gable' || conf.roofType === 'curved') {
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                pts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;

                const pitch = conf.pitch !== undefined ? conf.pitch : 30;
                const axis = conf.ridgeAxis || 'x';
                const maxSpan = axis === 'x' ? bD : bW;
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                let cx = bMinX + bW / 2;
                let cy = bMinY + bD / 2;
                const curve = conf.curve || (conf.roofType === 'curved' ? -20 : 0);

                const v = [], uv = [];
                const numSubdivs = 16;

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

                const gv = [], guv = [];

                if (axis === 'x') {
                    // Slope 1: North (bMinY -> cy)
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs;
                        const t1 = (i + 1) / numSubdivs;
                        const z0 = bMinY + t0 * (cy - bMinY);
                        const z1 = bMinY + t1 * (cy - bMinY);
                        let y0 = t0 * rh + curve * Math.sin(Math.PI * t0);
                        let y1 = t1 * rh + curve * Math.sin(Math.PI * t1);

                        const p0 = { x: bMinX, y: y0, z: z0 };
                        const p1 = { x: bMaxX, y: y0, z: z0 };
                        const p2 = { x: bMaxX, y: y1, z: z1 };
                        const p3 = { x: bMinX, y: y1, z: z1 };
                        addQuad(p0, p1, p2, p3);

                        // Gable End Walls (West at bMinX and East at bMaxX)
                        gv.push(bMinX, 0, z0, bMinX, y0, z0, bMinX, y1, z1);
                        guv.push(z0/100, 0, z0/100, y0/100, z1/100, y1/100);
                        gv.push(bMinX, 0, z0, bMinX, y1, z1, bMinX, 0, z1);
                        guv.push(z0/100, 0, z1/100, y1/100, z1/100, 0);

                        gv.push(bMaxX, 0, z0, bMaxX, y1, z1, bMaxX, y0, z0);
                        guv.push(z0/100, 0, z1/100, y1/100, z0/100, y0/100);
                        gv.push(bMaxX, 0, z0, bMaxX, 0, z1, bMaxX, y1, z1);
                        guv.push(z0/100, 0, z1/100, 0, z1/100, y1/100);
                    }

                    // Slope 2: South (cy -> bMaxY)
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs;
                        const t1 = (i + 1) / numSubdivs;
                        const z0 = cy + t0 * (bMaxY - cy);
                        const z1 = cy + t1 * (bMaxY - cy);
                        let y0 = (1 - t0) * rh + curve * Math.sin(Math.PI * (1 - t0));
                        let y1 = (1 - t1) * rh + curve * Math.sin(Math.PI * (1 - t1));

                        const p0 = { x: bMinX, y: y0, z: z0 };
                        const p1 = { x: bMaxX, y: y0, z: z0 };
                        const p2 = { x: bMaxX, y: y1, z: z1 };
                        const p3 = { x: bMinX, y: y1, z: z1 };
                        addQuad(p0, p1, p2, p3);

                        // Gable End Walls (West at bMinX and East at bMaxX)
                        gv.push(bMinX, 0, z0, bMinX, y0, z0, bMinX, y1, z1);
                        guv.push(z0/100, 0, z0/100, y0/100, z1/100, y1/100);
                        gv.push(bMinX, 0, z0, bMinX, y1, z1, bMinX, 0, z1);
                        guv.push(z0/100, 0, z1/100, y1/100, z1/100, 0);

                        gv.push(bMaxX, 0, z0, bMaxX, y1, z1, bMaxX, y0, z0);
                        guv.push(z0/100, 0, z1/100, y1/100, z0/100, y0/100);
                        gv.push(bMaxX, 0, z0, bMaxX, 0, z1, bMaxX, y1, z1);
                        guv.push(z0/100, 0, z1/100, 0, z1/100, y1/100);
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

                        const p0 = { x: x0, y: y0, z: bMinY };
                        const p1 = { x: x0, y: y0, z: bMaxY };
                        const p2 = { x: x1, y: y1, z: bMaxY };
                        const p3 = { x: x1, y: y1, z: bMinY };
                        addQuad(p0, p1, p2, p3);

                        // Gable End Walls (North at bMinY and South at bMaxY)
                        gv.push(x0, 0, bMinY, x1, y1, bMinY, x0, y0, bMinY);
                        guv.push(x0/100, 0, x1/100, y1/100, x0/100, y0/100);
                        gv.push(x0, 0, bMinY, x1, 0, bMinY, x1, y1, bMinY);
                        guv.push(x0/100, 0, x1/100, 0, x1/100, y1/100);

                        gv.push(x0, 0, bMaxY, x0, y0, bMaxY, x1, y1, bMaxY);
                        guv.push(x0/100, 0, x0/100, y0/100, x1/100, y1/100);
                        gv.push(x0, 0, bMaxY, x1, y1, bMaxY, x1, 0, bMaxY);
                        guv.push(x0/100, 0, x1/100, y1/100, x1/100, 0);
                    }

                    // Slope 2: East (cx -> bMaxX)
                    for (let i = 0; i < numSubdivs; i++) {
                        const t0 = i / numSubdivs;
                        const t1 = (i + 1) / numSubdivs;
                        const x0 = cx + t0 * (bMaxX - cx);
                        const x1 = cx + t1 * (bMaxX - cx);
                        let y0 = (1 - t0) * rh + curve * Math.sin(Math.PI * (1 - t0));
                        let y1 = (1 - t1) * rh + curve * Math.sin(Math.PI * (1 - t1));

                        const p0 = { x: x0, y: y0, z: bMinY };
                        const p1 = { x: x0, y: y0, z: bMaxY };
                        const p2 = { x: x1, y: y1, z: bMaxY };
                        const p3 = { x: x1, y: y1, z: bMinY };
                        addQuad(p0, p1, p2, p3);

                        // Gable End Walls (North at bMinY and South at bMaxY)
                        gv.push(x0, 0, bMinY, x1, y1, bMinY, x0, y0, bMinY);
                        guv.push(x0/100, 0, x1/100, y1/100, x0/100, y0/100);
                        gv.push(x0, 0, bMinY, x1, 0, bMinY, x1, y1, bMinY);
                        guv.push(x0/100, 0, x1/100, 0, x1/100, y1/100);

                        gv.push(x0, 0, bMaxY, x0, y0, bMaxY, x1, y1, bMaxY);
                        guv.push(x0/100, 0, x0/100, y0/100, x1/100, y1/100);
                        gv.push(x0, 0, bMaxY, x1, y1, bMaxY, x1, 0, bMaxY);
                        guv.push(x0/100, 0, x1/100, y1/100, x1/100, 0);
                    }
                }

                const T = conf.thickness || 8;
                const {v: vThick, uv: uvThick} = thickenGeometry(v, uv, T);

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(vThick, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvThick, 2));
                geo.computeVertexNormals();
                
                // Group 0: Top surface (roof material)
                // Group 1: Bottom & Fascia (solid color)
                geo.addGroup(0, v.length / 3, 0); 
                geo.addGroup(v.length / 3, (vThick.length - v.length) / 3, 1);

                const fasciaMat = this.ctx.helpers.getDynamicMaterial('white_plaster_wall', 'wall') || new THREE.MeshStandardMaterial({color: 0xF5F5F5});
                mesh = new THREE.Mesh(geo, [mat, fasciaMat]);
                
                if (gv.length > 0) {
                    const gGeo = new THREE.BufferGeometry();
                    gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gv, 3));
                    gGeo.setAttribute("uv", new THREE.Float32BufferAttribute(guv, 2));
                    gGeo.computeVertexNormals();

                    const gableMatId = conf.gableMaterial || 'white_plaster_wall';
                    const wallDecor = WALL_DECOR_REGISTRY[gableMatId] || WALL_DECOR_REGISTRY['white_plaster_wall'];
                    let gableMat = this.ctx.helpers.getDynamicMaterial('white_plaster_wall', 'wall') || new THREE.MeshStandardMaterial({color: 0xefede5}); gableMat.side = THREE.DoubleSide;
                    
                    if (wallDecor && wallDecor.texture) {
                        this.ctx.assets.getTexture(wallDecor).then(tex => {
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
                
            } else {
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

                // Helper to get overhang for an edge
                const dropFactor = Math.tan(pitch * Math.PI / 180);
                const getOverhang = (idx) => {
                    if (Array.isArray(conf.overhangs) && conf.overhangs[idx] !== undefined) return conf.overhangs[idx];
                    return conf.overhang !== undefined ? conf.overhang : 8;
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
                        addTri({ x: xL0, y: y0, z: zN0 }, { x: xR0, y: y0, z: zN0 }, { x: xR1, y: y1, z: zN1 });
                        addTri({ x: xL0, y: y0, z: zN0 }, { x: xR1, y: y1, z: zN1 }, { x: xL1, y: y1, z: zN1 });

                        // 2. South Slope Strip
                        addTri({ x: xR0, y: y0, z: zS0 }, { x: xL0, y: y0, z: zS0 }, { x: xL1, y: y1, z: zS1 });
                        addTri({ x: xR0, y: y0, z: zS0 }, { x: xL1, y: y1, z: zS1 }, { x: xR1, y: y1, z: zS1 });

                        // 3. West Hip Strip
                        if (i === numSubdivs - 1) {
                            addTri({ x: xL0, y: y0, z: zS0 }, { x: xL0, y: y0, z: zN0 }, { x: r1.x, y: rh, z: r1.z });
                        } else {
                            addTri({ x: xL0, y: y0, z: zS0 }, { x: xL0, y: y0, z: zN0 }, { x: xL1, y: y1, z: zN1 });
                            addTri({ x: xL0, y: y0, z: zS0 }, { x: xL1, y: y1, z: zN1 }, { x: xL1, y: y1, z: zS1 });
                        }

                        // 4. East Hip Strip
                        if (i === numSubdivs - 1) {
                            addTri({ x: xR0, y: y0, z: zN0 }, { x: xR0, y: y0, z: zS0 }, { x: r2.x, y: rh, z: r2.z });
                        } else {
                            addTri({ x: xR0, y: y0, z: zN0 }, { x: xR0, y: y0, z: zS0 }, { x: xR1, y: y1, z: zS1 });
                            addTri({ x: xR0, y: y0, z: zN0 }, { x: xR1, y: y1, z: zS1 }, { x: xR1, y: y1, z: zN1 });
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
                        addTri({ x: xW0, y: y0, z: zB0 }, { x: xW0, y: y0, z: zT0 }, { x: xW1, y: y1, z: zT1 });
                        addTri({ x: xW0, y: y0, z: zB0 }, { x: xW1, y: y1, z: zT1 }, { x: xW1, y: y1, z: zB1 });

                        // 2. East Slope Strip
                        addTri({ x: xE0, y: y0, z: zT0 }, { x: xE0, y: y0, z: zB0 }, { x: xE1, y: y1, z: zB1 });
                        addTri({ x: xE0, y: y0, z: zT0 }, { x: xE1, y: y1, z: zB1 }, { x: xE1, y: y1, z: zT1 });

                        // 3. North Hip Strip
                        if (i === numSubdivs - 1) {
                            addTri({ x: xE0, y: y0, z: zT0 }, { x: xW0, y: y0, z: zT0 }, { x: r1.x, y: rh, z: r1.z });
                        } else {
                            addTri({ x: xE0, y: y0, z: zT0 }, { x: xW0, y: y0, z: zT0 }, { x: xW1, y: y1, z: zT1 });
                            addTri({ x: xE0, y: y0, z: zT0 }, { x: xW1, y: y1, z: zT1 }, { x: xE1, y: y1, z: zT1 });
                        }

                        // 4. South Hip Strip
                        if (i === numSubdivs - 1) {
                            addTri({ x: xW0, y: y0, z: zB0 }, { x: xE0, y: y0, z: zB0 }, { x: r2.x, y: rh, z: r2.z });
                        } else {
                            addTri({ x: xW0, y: y0, z: zB0 }, { x: xE0, y: y0, z: zB0 }, { x: xE1, y: y1, z: zB1 });
                            addTri({ x: xW0, y: y0, z: zB0 }, { x: xE1, y: y1, z: zB1 }, { x: xW1, y: y1, z: zB1 });
                        }
                    }
                }

                const T = conf.thickness || 8;
                const {v: vThick, uv: uvThick} = thickenGeometry(v, uv, T);

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(vThick, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvThick, 2));
                geo.computeVertexNormals();
                
                geo.addGroup(0, v.length / 3, 0); 
                geo.addGroup(v.length / 3, (vThick.length - v.length) / 3, 1);
                
                const mat = this.ctx.helpers.getDynamicMaterial(roof.config?.material || 'terracotta_tiles_roof', 'roof') || new THREE.MeshStandardMaterial({color: 0x888888}); mat.side = THREE.DoubleSide;
                if (decor && decor.texture) {
                    this.ctx.assets.getTexture(decor).then(tex => {
                        const texClone = tex.clone();
                        texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                        const baseSize = roof.tileSize || 100;
                        const tSize = baseSize * (decor.scaleRatio || 1);
                        texClone.repeat.set(100 / tSize, 100 / tSize);
                        mat.map = texClone;
                        mat.needsUpdate = true;
                    });
                }

                const fasciaMat = this.ctx.helpers.getDynamicMaterial('white_plaster_wall', 'wall') || new THREE.MeshStandardMaterial({color: 0xF5F5F5});
                mesh = new THREE.Mesh(geo, [mat, fasciaMat]);
            }

            let ptsMinX = Infinity, ptsMaxX = -Infinity, ptsMinY = Infinity, ptsMaxY = -Infinity;
            (roof.points || []).forEach(p => {
                ptsMinX = Math.min(ptsMinX, p.x); ptsMaxX = Math.max(ptsMaxX, p.x);
                ptsMinY = Math.min(ptsMinY, p.y); ptsMaxY = Math.max(ptsMaxY, p.y);
            });
            const cx = (ptsMinX !== Infinity) ? (ptsMinX + ptsMaxX) / 2 : 0;
            const cz = (ptsMinY !== Infinity) ? (ptsMinY + ptsMaxY) / 2 : 0;

            const roofGroup = new THREE.Group();
            let groupX = 0, groupZ = 0;
            if (roof.group && typeof roof.group.x === 'function') {
                groupX = roof.group.x();
                groupZ = roof.group.y();
            } else if (roof.x !== undefined) {
                groupX = roof.x;
                groupZ = roof.y;
            }
            roofGroup.position.set(groupX + cx, h, groupZ + cz);
            
            let rot = roof.rotation || 0;
            if (roof.group && typeof roof.group.rotation === 'function') rot = roof.group.rotation();
            roofGroup.rotation.y = -rot * Math.PI / 180;

            mesh.position.set(-cx, 0, -cz);

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            mesh.userData = { isRoof: true, entity: roof, materialSlot: 'top', componentType: 'roof_top' }; 
            if (this.ctx.viewMode3D !== 'preview' && targetGroup === this.ctx.structureGroup) {
                this.ctx.interactables.push(mesh);
            }
            
            roofGroup.add(mesh);
            ComponentRegistry.registerMesh(roof, "top", mesh);
            targetGroup.add(roofGroup);
            
            if (targetGroup === this.ctx.structureGroup) {
                roof.mesh3D = roofGroup;
            }
        } catch(err) {
            console.error("Error building individual roof 3D mesh:", err);
        }
    });
    }




}

import * as THREE from 'three';
import { WALL_HEIGHT, ROOF_DECOR_REGISTRY, WALL_DECOR_REGISTRY, offsetPolygon } from '../../../core/registry.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';
import { Skylight3DBuilder } from './Skylight3DBuilder.js';
import { RoofSculpture3DBuilder } from './RoofSculpture3DBuilder.js';

export class Roof3DBuilder {
    constructor(ctx) {
        this.ctx = ctx;
    }

    buildRoofs(roofs, activeIndex, walls, targetGroup, shapes = null) {
        if (!roofs || roofs.length === 0) return;
        
        let actualTargetGroup = targetGroup;
        if (!actualTargetGroup) {
            if (activeIndex && (activeIndex.isGroup || activeIndex.isObject3D || (typeof THREE !== 'undefined' && activeIndex instanceof THREE.Object3D))) {
                actualTargetGroup = activeIndex;
            } else {
                actualTargetGroup = this.ctx?.structureGroup || this.ctx?.scene;
            }
        }
        targetGroup = actualTargetGroup;
        
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
                
                uvNew.push(
                    uv[i/3 * 2], uv[i/3 * 2 + 1],
                    uv[(i+6)/3 * 2], uv[(i+6)/3 * 2 + 1],
                    uv[(i+3)/3 * 2], uv[(i+3)/3 * 2 + 1]
                );
            }
            
            // Fascia Side Walls
            const edges = new Map();
            for (let i = 0; i < v.length; i += 9) {
                const tri = [
                    {x: v[i], y: v[i+1], z: v[i+2]},
                    {x: v[i+3], y: v[i+4], z: v[i+5]},
                    {x: v[i+6], y: v[i+7], z: v[i+8]}
                ];
                for (let j = 0; j < 3; j++) {
                    const p1 = tri[j];
                    const p2 = tri[(j + 1) % 3];
                    const k1 = `${p1.x.toFixed(2)},${p1.y.toFixed(2)},${p1.z.toFixed(2)}`;
                    const k2 = `${p2.x.toFixed(2)},${p2.y.toFixed(2)},${p2.z.toFixed(2)}`;
                    const key = k1 < k2 ? `${k1}_${k2}` : `${k2}_${k1}`;
                    
                    if (edges.has(key)) {
                        edges.delete(key);
                    } else {
                        edges.set(key, {p1, p2, k1, k2});
                    }
                }
            }
            
            edges.forEach(({p1, p2, k1, k2}) => {
                const p1d = {x: p1.x, y: p1.y - T, z: p1.z};
                const p2d = {x: p2.x, y: p2.y - T, z: p2.z};
                
                const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z) / 100;
                const tUv = T / 100;
                
                vNew.push(
                    p1.x, p1.y, p1.z,
                    p1d.x, p1d.y, p1d.z,
                    p2.x, p2.y, p2.z,
                    
                    p1d.x, p1d.y, p1d.z,
                    p2d.x, p2d.y, p2d.z,
                    p2.x, p2.y, p2.z
                );
                
                uvNew.push(
                    0, 0,      // p1
                    0, tUv,    // p1d
                    dist, 0,   // p2
                    
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

            const resolveRoofMaterial = (matKey) => {
                const effectiveKey = matKey || conf.material || 'terracotta_tiles_roof';
                const matDecor = ROOF_DECOR_REGISTRY[effectiveKey] || ROOF_DECOR_REGISTRY['concrete_flat'];
                const isGlass = Boolean(matDecor && (matDecor.isGlass || matDecor.category === 'glass' || effectiveKey.startsWith('glass_roof_')));
                const m = this.ctx.helpers.getDynamicMaterial(effectiveKey, isGlass ? 'glass' : 'roof') || new THREE.MeshStandardMaterial({color: 0x888888});
                m.side = THREE.DoubleSide;
                if (isGlass) {
                    m.transparent = true;
                    m.opacity = matDecor?.opacity !== undefined ? matDecor.opacity : 0.92;
                    m.roughness = matDecor?.roughness !== undefined ? matDecor.roughness : 0.05;
                    m.metalness = matDecor?.metalness !== undefined ? matDecor.metalness : 0.15;
                    m.depthWrite = true;
                    m.depthTest = true;
                    if (m.isMeshPhysicalMaterial) {
                        m.transmission = matDecor?.transmission !== undefined ? matDecor.transmission : 0.90;
                        m.ior = matDecor?.ior || 1.52;
                        m.clearcoat = matDecor?.clearcoat || 1.0;
                        m.clearcoatRoughness = 0.02;
                    }
                }
                if (matDecor && (matDecor.texture || matDecor.dataUri)) {
                    const texSrc = matDecor.dataUri || matDecor.texture;
                    this.ctx.assets.getTexture(texSrc).then(tex => {
                        if (!tex) return;
                        const texClone = tex.clone();
                        texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                        const baseSize = roof.tileSize || 100;
                        const tSize = baseSize * (matDecor.scaleRatio || 1);
                        texClone.repeat.set(100 / tSize, 100 / tSize);
                        m.map = texClone;
                        if (isGlass) m.transparent = true;
                        m.needsUpdate = true;
                    });
                }
                return { mat: m, isGlass, decor: matDecor, key: effectiveKey };
            };

            const defaultMatInfo = resolveRoofMaterial(conf.material);
            const decor = defaultMatInfo.decor;
            const isGlassRoof = defaultMatInfo.isGlass;
            const mat = defaultMatInfo.mat;
            
            const defaultFascia = isGlassRoof ? 'metal_dark_steel' : 'white_plaster_wall';
            const fasciaMat = this.ctx.helpers.getDynamicMaterial(conf.fasciaMaterial || defaultFascia, isGlassRoof ? 'metal' : 'wall') 
                || new THREE.MeshStandardMaterial({
                    color: isGlassRoof ? 0x1e293b : 0xF5F5F5, 
                    metalness: isGlassRoof ? 0.75 : 0.0, 
                    roughness: isGlassRoof ? 0.25 : 0.5
                });

            const applyRoofGroups = (targetGeo, vTopLength, vThickLength, isCustomGlass = isGlassRoof) => {
                const topCount = vTopLength / 3;
                const bottomCount = vTopLength / 3;
                const fasciaCount = (vThickLength - 2 * vTopLength) / 3;
                
                if (isCustomGlass) {
                    targetGeo.addGroup(0, topCount, 0);
                    targetGeo.addGroup(topCount, bottomCount, 0);
                    targetGeo.addGroup(topCount + bottomCount, fasciaCount, 1);
                } else {
                    targetGeo.addGroup(0, topCount, 0);
                    targetGeo.addGroup(topCount, bottomCount + fasciaCount, 1);
                }
            };

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

                let flatMat = mat;
                if (!isGlassRoof) {
                    const matId = roof.configId || conf.material;
                    flatMat = new THREE.MeshStandardMaterial({ 
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
                        flatMat.map = tex;
                    }
                }

                mesh = new THREE.Mesh(geo, isGlassRoof ? [flatMat, fasciaMat] : flatMat);
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
                
                applyRoofGroups(geo, v.length, vThick.length);
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
                
                applyRoofGroups(geo, v.length, vThick.length);
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
                const pitchRad = pitch * Math.PI / 180;
                const axis = conf.ridgeAxis || 'x';
                const maxSpan = axis === 'x' ? bD : bW;
                const rh = Math.tan(pitchRad) * (maxSpan / 2);
                let cx = bMinX + bW / 2;
                let cy = bMinY + bD / 2;
                const curve = conf.curve || (conf.roofType === 'curved' ? -20 : 0);

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

                const addSegmentedSlopeStripX = (targetV, targetUV, z0, z1, y0, y1) => {
                    const minZ = Math.min(z0, z1);
                    const maxZ = Math.max(z0, z1);
                    const hits = skylightCutouts.filter(cut => maxZ >= cut.z0 && minZ <= cut.z1);
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
                        curX = Math.max(curX, h1); // Skip cutout region (creates aperture opening in tiles!)
                    });
                    if (curX < bMaxX - 1) {
                        addQuadTo(targetV, targetUV, { x: curX, y: y0, z: z0 }, { x: bMaxX, y: y0, z: z0 }, { x: bMaxX, y: y1, z: z1 }, { x: curX, y: y1, z: z1 });
                    }
                };

                const addSegmentedSlopeStripY = (targetV, targetUV, x0, x1, y0, y1) => {
                    const minX = Math.min(x0, x1);
                    const maxX = Math.max(x0, x1);
                    const hits = skylightCutouts.filter(cut => maxX >= cut.x0 && minX <= cut.x1);
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

                        addSegmentedSlopeStripX(v2, uv2, z0, z1, y0, y1);

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

                        addSegmentedSlopeStripY(v1, uv1, x0, x1, y0, y1);

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

                        addSegmentedSlopeStripY(v2, uv2, x0, x1, y0, y1);

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
                    applyRoofGroups(geo, v.length, vThick.length);
                    mesh = new THREE.Mesh(geo, [mat, fasciaMat]);
                }
                
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
            } else if (conf.roofType && conf.roofType.startsWith('turret')) {
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

                applyRoofGroups(geo, v.length, vThick.length);
                mesh = new THREE.Mesh(geo, [mat, fasciaMat]);
            } else if (conf.roofType === 'gambrel') {
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

                applyRoofGroups(geo, v.length, vThick.length);
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
            } else if (conf.roofType === 'mansard') {
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

                applyRoofGroups(geo, v.length, vThick.length);
                mesh = new THREE.Mesh(geo, [mat, fasciaMat]);
            } else if (conf.roofType === 'dutch_gable') {
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

                applyRoofGroups(geo, v.length, vThick.length);
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
            } else if (conf.roofType === 'jerkinhead') {
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

                applyRoofGroups(geo, v.length, vThick.length);
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
                    applyRoofGroups(geo, v.length, vThick.length);
                    mesh = new THREE.Mesh(geo, [mat, fasciaMat]);
                }
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
            if (Array.isArray(this.ctx.interactables) && this.ctx.viewMode3D !== 'preview' && targetGroup === this.ctx.structureGroup) {
                this.ctx.interactables.push(mesh);
            }
            
            roofGroup.add(mesh);
            ComponentRegistry.registerMesh(roof, "top", mesh);

            // Render embedded 3D Skylight Windows & Glass Regions
            const skylightList = Array.isArray(conf.skylights) ? conf.skylights : (Array.isArray(roof.skylights) ? roof.skylights : []);
            if (skylightList.length > 0) {
                const skylightBuilder = new Skylight3DBuilder(this.ctx);
                const bW = ptsMaxX - ptsMinX;
                const bD = ptsMaxY - ptsMinY;
                const cy = (ptsMinY + ptsMaxY) / 2;
                const cx = (ptsMinX + ptsMaxX) / 2;

                skylightList.forEach(sk => {
                    const pitchRad = ((sk.pitch !== undefined ? sk.pitch : conf.pitch) || 30) * Math.PI / 180;
                    const axis = conf.ridgeAxis || 'x';
                    const rh = Math.tan(pitchRad) * ((axis === 'x' ? bD : bW) / 2);
                    const slopeSpan = (axis === 'x' ? bD : bW) / 2;
                    const slopeHypot = slopeSpan / Math.cos(pitchRad);

                    let effectiveWidth = sk.width || 120;
                    let effectiveLength = sk.length || 180;

                    if (sk.coverage === 'full_width' || sk.coverage === 'full_both') {
                        effectiveWidth = (axis === 'x' ? bW : bD);
                        sk.u = 0.5;
                    }
                    if (sk.coverage === 'full_slope' || sk.coverage === 'full_both') {
                        effectiveLength = slopeHypot;
                        sk.v = 0.5;
                    }

                    const skClone = { ...sk, width: effectiveWidth, length: effectiveLength };
                    const skGroup = skylightBuilder.buildSkylight(skClone, roof);
                    
                    let skX = sk.x !== undefined ? sk.x : (sk.u !== undefined ? (ptsMinX + sk.u * bW) : (ptsMinX + bW / 2));
                    let skZ = sk.z !== undefined ? sk.z : (sk.v !== undefined ? (ptsMinY + sk.v * bD) : (ptsMinY + bD / 2));
                    
                    let tiltX = 0, tiltZ = 0, skY = 0;

                    if (conf.roofType === 'gable' || conf.roofType === 'curved') {
                        if (axis === 'x') {
                            const isSouth = skZ >= cy;
                            tiltX = isSouth ? pitchRad : -pitchRad;
                            const distFromRidge = Math.abs(skZ - cy);
                            skY = rh * Math.max(0, 1 - distFromRidge / (bD / 2));
                        } else {
                            const isEast = skX >= cx;
                            tiltZ = isEast ? -pitchRad : pitchRad;
                            const distFromRidge = Math.abs(skX - cx);
                            skY = rh * Math.max(0, 1 - distFromRidge / (bW / 2));
                        }
                    } else if (conf.roofType === 'shed') {
                        const shedRh = Math.tan(pitchRad) * (axis === 'x' ? bD : bW);
                        if (axis === 'x') {
                            tiltX = conf.flipSlope ? -pitchRad : pitchRad;
                            const t = conf.flipSlope ? (ptsMaxY - skZ) / bD : (skZ - ptsMinY) / bD;
                            skY = Math.max(0, t) * shedRh;
                        } else {
                            tiltZ = conf.flipSlope ? pitchRad : -pitchRad;
                            const t = conf.flipSlope ? (ptsMaxX - skX) / bW : (skX - ptsMinX) / bW;
                            skY = Math.max(0, t) * shedRh;
                        }
                    } else {
                        // Hip
                        const distFromEdge = Math.min(skX - ptsMinX, ptsMaxX - skX, skZ - ptsMinY, ptsMaxY - skZ);
                        skY = Math.tan(pitchRad) * Math.max(0, distFromEdge);
                        if (skZ < ptsMinY + bD / 2 && Math.abs(skZ - ptsMinY) <= Math.abs(skX - ptsMinX)) {
                            tiltX = -pitchRad;
                        } else if (skZ >= ptsMinY + bD / 2 && Math.abs(ptsMaxY - skZ) <= Math.abs(skX - ptsMinX)) {
                            tiltX = pitchRad;
                        } else if (skX < ptsMinX + bW / 2) {
                            tiltZ = pitchRad;
                        } else {
                            tiltZ = -pitchRad;
                        }
                    }

                    skGroup.position.set(skX - cx, (sk.elevationOffset || 0) + skY, skZ - cz);
                    skGroup.rotation.x = tiltX;
                    skGroup.rotation.z = tiltZ;

                    roofGroup.add(skGroup);
                });
            }

            // Render Attached Sims 4 Roof Sculptures (Ridge Cresting, Apex Finials, Chimney Stacks)
            const sculptureBuilder = new RoofSculpture3DBuilder(this.ctx);
            const ridgeSegments = this.getRoofRidgeSegments(roof);
            const apexPoints = this.getRoofApexPoints(roof);

            // 1. Ridge Crestings (Wrought iron lace, gothic spikes, modern metal cap)
            const crestingList = Array.isArray(conf.crestings) ? conf.crestings : (Array.isArray(roof.crestings) ? roof.crestings : []);
            if (crestingList.length > 0 && ridgeSegments.length > 0) {
                crestingList.forEach(cr => {
                    const targetSeg = (cr.segmentIndex !== undefined && ridgeSegments[cr.segmentIndex]) ? ridgeSegments[cr.segmentIndex] : ridgeSegments[0];
                    if (!targetSeg) return;

                    const crestMesh = sculptureBuilder.buildRidgeCresting(cr, targetSeg.length, roof);
                    crestMesh.position.set(
                        targetSeg.center.x + (cr.offsetX || 0),
                        targetSeg.center.y + (cr.elevationOffset || 0),
                        targetSeg.center.z + (cr.offsetZ || 0)
                    );
                    crestMesh.rotation.y = targetSeg.angleY + ((cr.rotation || 0) * Math.PI / 180);
                    roofGroup.add(crestMesh);
                });
            }

            // 2. Apex Finials & Weather Vanes (Victorian spires, copper spires, globe orbs, weather roosters)
            const finialList = Array.isArray(conf.finials) ? conf.finials : (Array.isArray(roof.finials) ? roof.finials : []);
            if (finialList.length > 0 && apexPoints.length > 0) {
                finialList.forEach(fin => {
                    let targets = [];
                    const pos = fin.position || (apexPoints.length === 1 ? 'center_apex' : 'both_apexes');

                    if (pos === 'start_apex') {
                        targets = [apexPoints[0]];
                    } else if (pos === 'end_apex') {
                        targets = [apexPoints[apexPoints.length - 1]];
                    } else if (pos === 'both_apexes') {
                        targets = apexPoints.length > 1 ? [apexPoints[0], apexPoints[apexPoints.length - 1]] : [apexPoints[0]];
                    } else if (pos === 'all_apexes') {
                        targets = apexPoints;
                    } else if (pos === 'center_apex' || pos === 'turret_peak') {
                        targets = [apexPoints[0]];
                    } else if (pos === 'custom' && fin.x !== undefined && fin.z !== undefined) {
                        targets = [{ x: fin.x, y: fin.y || apexPoints[0].y, z: fin.z }];
                    } else {
                        targets = [apexPoints[0]];
                    }

                    targets.forEach(pt => {
                        const finMesh = sculptureBuilder.buildApexFinial(fin, roof);
                        finMesh.position.set(
                            pt.x + (fin.offsetX || 0),
                            pt.y + (fin.elevationOffset || 0),
                            pt.z + (fin.offsetZ || 0)
                        );
                        roofGroup.add(finMesh);
                    });
                });
            }

            // 3. Chimney Stacks (Traditional red brick, Tudor stone, modern flue pipes, double brick)
            const chimneyList = Array.isArray(conf.chimneys) ? conf.chimneys : (Array.isArray(roof.chimneys) ? roof.chimneys : []);
            if (chimneyList.length > 0) {
                const bW = ptsMaxX - ptsMinX;
                const bD = ptsMaxY - ptsMinY;
                const cy = (ptsMinY + ptsMaxY) / 2;
                const cx = (ptsMinX + ptsMaxX) / 2;
                const pitchRad = ((conf.pitch !== undefined ? conf.pitch : 30)) * Math.PI / 180;
                const axis = conf.ridgeAxis || 'x';
                const rh = Math.tan(pitchRad) * ((axis === 'x' ? bD : bW) / 2);

                chimneyList.forEach(ch => {
                    const chMesh = sculptureBuilder.buildChimneyStack(ch, roof);

                    let chX = ch.x !== undefined ? ch.x : (ch.u !== undefined ? (ptsMinX + ch.u * bW) : (ptsMinX + bW * 0.75));
                    let chZ = ch.z !== undefined ? ch.z : (ch.v !== undefined ? (ptsMinY + ch.v * bD) : (ptsMinY + bD * 0.75));
                    let chY = 0;

                    if (conf.roofType === 'gable' || conf.roofType === 'curved') {
                        if (axis === 'x') {
                            const distFromRidge = Math.abs(chZ - cy);
                            chY = rh * Math.max(0, 1 - distFromRidge / (bD / 2));
                        } else {
                            const distFromRidge = Math.abs(chX - cx);
                            chY = rh * Math.max(0, 1 - distFromRidge / (bW / 2));
                        }
                    } else if (conf.roofType === 'shed') {
                        const shedRh = Math.tan(pitchRad) * (axis === 'x' ? bD : bW);
                        if (axis === 'x') {
                            const t = conf.flipSlope ? (ptsMaxY - chZ) / bD : (chZ - ptsMinY) / bD;
                            chY = Math.max(0, t) * shedRh;
                        } else {
                            const t = conf.flipSlope ? (ptsMaxX - chX) / bW : (chX - ptsMinX) / bW;
                            chY = Math.max(0, t) * shedRh;
                        }
                    } else {
                        const distFromEdge = Math.min(chX - ptsMinX, ptsMaxX - chX, chZ - ptsMinY, ptsMaxY - chZ);
                        chY = Math.tan(pitchRad) * Math.max(0, distFromEdge);
                    }

                    // Chimney rises vertically through the roof slope
                    chMesh.position.set(chX - cx, (ch.elevationOffset || 0) + chY, chZ - cz);
                    roofGroup.add(chMesh);
                });
            }

            // 4. Unified sculptures array if present
            const unifiedSculptures = Array.isArray(conf.sculptures) ? conf.sculptures : (Array.isArray(roof.sculptures) ? roof.sculptures : []);
            if (unifiedSculptures.length > 0) {
                unifiedSculptures.forEach(sc => {
                    if (sc.sculptureCategory === 'cresting' || sc.type?.startsWith('ridge_cresting')) {
                        const targetSeg = ridgeSegments[0];
                        if (targetSeg) {
                            const m = sculptureBuilder.buildRidgeCresting(sc, targetSeg.length, roof);
                            m.position.set(targetSeg.center.x, targetSeg.center.y, targetSeg.center.z);
                            m.rotation.y = targetSeg.angleY;
                            roofGroup.add(m);
                        }
                    } else if (sc.sculptureCategory === 'finial' || sc.type?.startsWith('finial_')) {
                        if (apexPoints.length > 0) {
                            apexPoints.forEach(pt => {
                                const m = sculptureBuilder.buildApexFinial(sc, roof);
                                m.position.set(pt.x, pt.y, pt.z);
                                roofGroup.add(m);
                            });
                        }
                    } else if (sc.sculptureCategory === 'chimney' || sc.type?.startsWith('chimney_')) {
                        const m = sculptureBuilder.buildChimneyStack(sc, roof);
                        m.position.set(sc.x || 0, sc.y || 0, sc.z || 0);
                        roofGroup.add(m);
                    }
                });
            }

            targetGroup.add(roofGroup);
            if (targetGroup === this.ctx.structureGroup) {
                roof.mesh3D = roofGroup;
            }
        } catch(err) {
            console.error("Error building individual roof 3D mesh:", err);
        }
    });
    }

    /**
     * Calculates 3D ridge segments in local roofGroup coordinate space (centered at X=0, Z=0)
     * @param {Object} roof - Roof configuration
     * @returns {Array<Object>} Array of ridge segments with start, end, length, center, and angleY
     */
    getRoofRidgeSegments(roof) {
        const conf = roof.config || roof;
        const basePts = roof.points || [];
        if (basePts.length < 3) return [];

        const overhangs = conf.overhangs ? conf.overhangs : (conf.overhang !== undefined ? conf.overhang : 8);
        const pts = offsetPolygon(basePts, overhangs);

        let ptsMinX = Infinity, ptsMaxX = -Infinity, ptsMinY = Infinity, ptsMaxY = -Infinity;
        pts.forEach(p => {
            ptsMinX = Math.min(ptsMinX, p.x); ptsMaxX = Math.max(ptsMaxX, p.x);
            ptsMinY = Math.min(ptsMinY, p.y); ptsMaxY = Math.max(ptsMaxY, p.y);
        });
        const bW = ptsMaxX - ptsMinX;
        const bD = ptsMaxY - ptsMinY;
        const cx = (ptsMinX + ptsMaxX) / 2;
        const cz = (ptsMinY + ptsMaxY) / 2;

        const pitch = conf.pitch !== undefined ? conf.pitch : 30;
        const pitchRad = pitch * Math.PI / 180;
        const roofType = conf.roofType || 'gable';
        const axis = conf.ridgeAxis || 'x';
        const ridgeOffset = conf.ridgeOffset || 0;

        const segments = [];

        if (roofType === 'gable' || roofType === 'curved' || roofType === 'gambrel') {
            const maxSpan = axis === 'x' ? bD : bW;
            const rh = Math.tan(pitchRad) * (maxSpan / 2);
            if (axis === 'x') {
                segments.push({
                    id: 'main_ridge',
                    start: { x: ptsMinX - cx, y: rh, z: 0 },
                    end: { x: ptsMaxX - cx, y: rh, z: 0 },
                    length: bW,
                    center: { x: 0, y: rh, z: 0 },
                    angleY: Math.PI / 2,
                    axis: 'x'
                });
            } else {
                segments.push({
                    id: 'main_ridge',
                    start: { x: 0, y: rh, z: ptsMinY - cz },
                    end: { x: 0, y: rh, z: ptsMaxY - cz },
                    length: bD,
                    center: { x: 0, y: rh, z: 0 },
                    angleY: 0,
                    axis: 'y'
                });
            }
        } else if (roofType === 'hip' || roofType === 'half_hip' || roofType === 'dutch_gable' || roofType === 'jerkinhead') {
            const maxSpan = Math.min(bW, bD);
            const rh = Math.tan(pitchRad) * (maxSpan / 2);
            const isHorizontal = bW >= bD;
            if (isHorizontal) {
                const x0 = ptsMinX + bD / 2 - cx;
                const x1 = ptsMaxX - bD / 2 - cx;
                const len = Math.max(1, x1 - x0);
                segments.push({
                    id: 'main_ridge',
                    start: { x: x0, y: rh, z: ridgeOffset },
                    end: { x: x1, y: rh, z: ridgeOffset },
                    length: len,
                    center: { x: (x0 + x1) / 2, y: rh, z: ridgeOffset },
                    angleY: Math.PI / 2,
                    axis: 'x'
                });
            } else {
                const z0 = ptsMinY + bW / 2 - cz;
                const z1 = ptsMaxY - bW / 2 - cz;
                const len = Math.max(1, z1 - z0);
                segments.push({
                    id: 'main_ridge',
                    start: { x: ridgeOffset, y: rh, z: z0 },
                    end: { x: ridgeOffset, y: rh, z: z1 },
                    length: len,
                    center: { x: ridgeOffset, y: rh, z: (z0 + z1) / 2 },
                    angleY: 0,
                    axis: 'y'
                });
            }
        } else if (roofType === 'mansard') {
            const rh = Math.tan(pitchRad) * (Math.min(bW, bD) / 3);
            const wTop = bW * 0.5, dTop = bD * 0.5;
            segments.push({
                id: 'north_ridge',
                start: { x: -wTop / 2, y: rh, z: -dTop / 2 },
                end: { x: wTop / 2, y: rh, z: -dTop / 2 },
                length: wTop,
                center: { x: 0, y: rh, z: -dTop / 2 },
                angleY: Math.PI / 2,
                axis: 'x'
            });
            segments.push({
                id: 'south_ridge',
                start: { x: -wTop / 2, y: rh, z: dTop / 2 },
                end: { x: wTop / 2, y: rh, z: dTop / 2 },
                length: wTop,
                center: { x: 0, y: rh, z: dTop / 2 },
                angleY: Math.PI / 2,
                axis: 'x'
            });
        } else if (roofType === 'shed') {
            const shedRh = Math.tan(pitchRad) * (axis === 'x' ? bD : bW);
            if (axis === 'x') {
                const zPos = conf.flipSlope ? (ptsMinY - cz) : (ptsMaxY - cz);
                segments.push({
                    id: 'main_ridge',
                    start: { x: ptsMinX - cx, y: shedRh, z: zPos },
                    end: { x: ptsMaxX - cx, y: shedRh, z: zPos },
                    length: bW,
                    center: { x: 0, y: shedRh, z: zPos },
                    angleY: Math.PI / 2,
                    axis: 'x'
                });
            } else {
                const xPos = conf.flipSlope ? (ptsMaxX - cx) : (ptsMinX - cx);
                segments.push({
                    id: 'main_ridge',
                    start: { x: xPos, y: shedRh, z: ptsMinY - cz },
                    end: { x: xPos, y: shedRh, z: ptsMaxY - cz },
                    length: bD,
                    center: { x: xPos, y: shedRh, z: 0 },
                    angleY: 0,
                    axis: 'y'
                });
            }
        }

        return segments;
    }

    /**
     * Calculates 3D apex / peak points in local roofGroup coordinate space
     * @param {Object} roof - Roof configuration
     * @returns {Array<Object>} Array of apex points with id, x, y, z, and label
     */
    getRoofApexPoints(roof) {
        const conf = roof.config || roof;
        const basePts = roof.points || [];
        if (basePts.length < 3) return [];

        const overhangs = conf.overhangs ? conf.overhangs : (conf.overhang !== undefined ? conf.overhang : 8);
        const pts = offsetPolygon(basePts, overhangs);

        let ptsMinX = Infinity, ptsMaxX = -Infinity, ptsMinY = Infinity, ptsMaxY = -Infinity;
        pts.forEach(p => {
            ptsMinX = Math.min(ptsMinX, p.x); ptsMaxX = Math.max(ptsMaxX, p.x);
            ptsMinY = Math.min(ptsMinY, p.y); ptsMaxY = Math.max(ptsMaxY, p.y);
        });
        const bW = ptsMaxX - ptsMinX;
        const bD = ptsMaxY - ptsMinY;
        const cx = (ptsMinX + ptsMaxX) / 2;
        const cz = (ptsMinY + ptsMaxY) / 2;

        const pitch = conf.pitch !== undefined ? conf.pitch : 30;
        const pitchRad = pitch * Math.PI / 180;
        const roofType = conf.roofType || 'gable';
        const axis = conf.ridgeAxis || 'x';
        const ridgeOffset = conf.ridgeOffset || 0;

        const apexes = [];

        if (roofType.startsWith('turret')) {
            const rh = Math.tan(pitchRad) * (Math.min(bW, bD) / 2);
            apexes.push({ id: 'center', x: 0, y: rh, z: 0, label: 'Turret Peak' });
        } else if (roofType === 'gable' || roofType === 'curved' || roofType === 'gambrel') {
            const maxSpan = axis === 'x' ? bD : bW;
            const rh = Math.tan(pitchRad) * (maxSpan / 2);
            if (axis === 'x') {
                apexes.push({ id: 'start', x: ptsMinX - cx, y: rh, z: 0, label: 'West Apex' });
                apexes.push({ id: 'end', x: ptsMaxX - cx, y: rh, z: 0, label: 'East Apex' });
            } else {
                apexes.push({ id: 'start', x: 0, y: rh, z: ptsMinY - cz, label: 'North Apex' });
                apexes.push({ id: 'end', x: 0, y: rh, z: ptsMaxY - cz, label: 'South Apex' });
            }
        } else if (roofType === 'hip' || roofType === 'half_hip' || roofType === 'dutch_gable' || roofType === 'jerkinhead') {
            const maxSpan = Math.min(bW, bD);
            const rh = Math.tan(pitchRad) * (maxSpan / 2);
            const isHorizontal = bW >= bD;
            if (isHorizontal) {
                apexes.push({ id: 'start', x: ptsMinX + bD / 2 - cx, y: rh, z: ridgeOffset, label: 'West Hip Peak' });
                apexes.push({ id: 'end', x: ptsMaxX - bD / 2 - cx, y: rh, z: ridgeOffset, label: 'East Hip Peak' });
            } else {
                apexes.push({ id: 'start', x: ridgeOffset, y: rh, z: ptsMinY + bW / 2 - cz, label: 'North Hip Peak' });
                apexes.push({ id: 'end', x: ridgeOffset, y: rh, z: ptsMaxY - bW / 2 - cz, label: 'South Hip Peak' });
            }
        } else if (roofType === 'mansard') {
            const rh = Math.tan(pitchRad) * (Math.min(bW, bD) / 3);
            const wTop = bW * 0.5, dTop = bD * 0.5;
            apexes.push({ id: 'nw', x: -wTop / 2, y: rh, z: -dTop / 2, label: 'NW Corner' });
            apexes.push({ id: 'ne', x: wTop / 2, y: rh, z: -dTop / 2, label: 'NE Corner' });
            apexes.push({ id: 'sw', x: -wTop / 2, y: rh, z: dTop / 2, label: 'SW Corner' });
            apexes.push({ id: 'se', x: wTop / 2, y: rh, z: dTop / 2, label: 'SE Corner' });
        } else if (roofType === 'shed') {
            const shedRh = Math.tan(pitchRad) * (axis === 'x' ? bD : bW);
            if (axis === 'x') {
                const zPos = conf.flipSlope ? (ptsMinY - cz) : (ptsMaxY - cz);
                apexes.push({ id: 'start', x: ptsMinX - cx, y: shedRh, z: zPos, label: 'Start Peak' });
                apexes.push({ id: 'end', x: ptsMaxX - cx, y: shedRh, z: zPos, label: 'End Peak' });
            } else {
                const xPos = conf.flipSlope ? (ptsMaxX - cx) : (ptsMinX - cx);
                apexes.push({ id: 'start', x: xPos, y: shedRh, z: ptsMinY - cz, label: 'Start Peak' });
                apexes.push({ id: 'end', x: xPos, y: shedRh, z: ptsMaxY - cz, label: 'End Peak' });
            }
        }

        return apexes;
    }
}

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
        const hasWalls = walls && walls.length > 0;
        let maxWallHeight = WALL_HEIGHT;
        if (hasWalls) {
            const mainWalls = walls.filter(w => !w.parentGroup);
            if (mainWalls.length > 0) maxWallHeight = Math.max(...mainWalls.map(w => w.height !== undefined ? w.height : (w.config?.height || WALL_HEIGHT)));
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
            
            const baseHeight = roof.elevation !== undefined ? roof.elevation : ((hasWalls || activeIndex === 0) ? maxWallHeight : 0);
            const h = baseHeight + wallGap + 0.5;

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
            } else if (conf.roofType === 'gable') {
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                basePts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;

                const pitch = conf.pitch || 30;
                const axis = conf.ridgeAxis || 'x';
                const maxSpan = axis === 'x' ? bD : bW;
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                let cx = bMinX + bW/2;
                let cy = bMinY + bD/2;

                const v = [], uv = [];
                
                const shape = new THREE.Shape();
                shape.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
                const shapeGeo = new THREE.ShapeGeometry(shape);
                const pos = shapeGeo.attributes.position;
                
                let rawTriangles = [];
                if (shapeGeo.index) {
                    const idx = shapeGeo.index.array;
                    for (let i = 0; i < idx.length; i += 3) {
                        const a = idx[i], b = idx[i+1], c = idx[i+2];
                        rawTriangles.push([
                            {x: pos.getX(a), y: pos.getY(a)},
                            {x: pos.getX(b), y: pos.getY(b)},
                            {x: pos.getX(c), y: pos.getY(c)}
                        ]);
                    }
                } else {
                    for (let i = 0; i < pos.count; i += 3) {
                        rawTriangles.push([
                            {x: pos.getX(i), y: pos.getY(i)},
                            {x: pos.getX(i+1), y: pos.getY(i+1)},
                            {x: pos.getX(i+2), y: pos.getY(i+2)}
                        ]);
                    }
                }
                
                function splitTriangle(p1, p2, p3, lineVal, isAxisX) {
                    const tPts = [p1, p2, p3];
                    const val = p => isAxisX ? p.y : p.x;
                    const above = tPts.filter(p => val(p) < lineVal);
                    const below = tPts.filter(p => val(p) > lineVal);
                    const on = tPts.filter(p => val(p) === lineVal);

                    if (above.length === 3 || below.length === 3) return [tPts];
                    if (above.length === 2 && on.length === 1) return [tPts];
                    if (below.length === 2 && on.length === 1) return [tPts];
                    if (above.length === 1 && on.length === 2) return [tPts];
                    if (below.length === 1 && on.length === 2) return [tPts];
                    if (on.length === 3) return [tPts];

                    if (on.length === 1) {
                        const pAbove = above[0], pBelow = below[0], pOn = on[0];
                        const t = (lineVal - val(pAbove)) / (val(pBelow) - val(pAbove));
                        const pIntersect = isAxisX ? 
                            { x: pAbove.x + t * (pBelow.x - pAbove.x), y: lineVal } :
                            { x: lineVal, y: pAbove.y + t * (pBelow.y - pAbove.y) };
                        return [
                            [pAbove, pOn, pIntersect],
                            [pBelow, pOn, pIntersect]
                        ];
                    } else {
                        const lone = above.length === 1 ? above[0] : below[0];
                        const pair = above.length === 2 ? above : below;
                        
                        const t1 = (lineVal - val(lone)) / (val(pair[0]) - val(lone));
                        const pI1 = isAxisX ?
                            { x: lone.x + t1 * (pair[0].x - lone.x), y: lineVal } :
                            { x: lineVal, y: lone.y + t1 * (pair[0].y - lone.y) };
                        
                        const t2 = (lineVal - val(lone)) / (val(pair[1]) - val(lone));
                        const pI2 = isAxisX ?
                            { x: lone.x + t2 * (pair[1].x - lone.x), y: lineVal } :
                            { x: lineVal, y: lone.y + t2 * (pair[1].y - lone.y) };
                        
                        return [
                            [lone, pI1, pI2],
                            [pair[0], pI1, pI2],
                            [pair[0], pI2, pair[1]]
                        ];
                    }
                }
                
                let refinedTriangles = [];
                rawTriangles.forEach(tri => {
                    const split = splitTriangle(tri[0], tri[1], tri[2], axis === 'x' ? cy : cx, axis === 'x');
                    refinedTriangles.push(...split);
                });
                
                refinedTriangles.forEach(tri => {
                    for (let i = 0; i < 3; i++) {
                        const pt = tri[i];
                        let rv = 0;
                        if (axis === 'x') {
                            if (pt.y <= cy) rv = (pt.y - bMinY) * Math.tan(pitch * Math.PI / 180);
                            else rv = (bMaxY - pt.y) * Math.tan(pitch * Math.PI / 180);
                        } else {
                            if (pt.x <= cx) rv = (pt.x - bMinX) * Math.tan(pitch * Math.PI / 180);
                            else rv = (bMaxX - pt.x) * Math.tan(pitch * Math.PI / 180);
                        }
                        v.push(pt.x, rv, pt.y);
                        uv.push(pt.x / 100, pt.y / 100);
                    }
                });

                for (let i = 0; i < v.length; i += 9) {
                    const dx1 = v[i+3] - v[i], dz1 = v[i+5] - v[i+2];
                    const dx2 = v[i+6] - v[i], dz2 = v[i+8] - v[i+2];
                    const ny_true = dz1 * dx2 - dx1 * dz2;
                    if (ny_true < 0) { 
                        const tX = v[i+3], tY = v[i+4], tZ = v[i+5];
                        const tU = uv[i/3*2+2], tV = uv[i/3*2+3];
                        v[i+3] = v[i+6]; v[i+4] = v[i+7]; v[i+5] = v[i+8];
                        uv[i/3*2+2] = uv[i/3*2+4]; uv[i/3*2+3] = uv[i/3*2+5];
                        v[i+6] = tX; v[i+7] = tY; v[i+8] = tZ;
                        uv[i/3*2+4] = tU; uv[i/3*2+5] = tV;
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
                
                const gv = [], guv = [];
                const addGableQuad = (p1, p2, h1, h2) => {
                    gv.push(p1.x, 0, p1.y, p2.x, 0, p2.y, p1.x, h1, p1.y);
                    gv.push(p1.x, h1, p1.y, p2.x, 0, p2.y, p2.x, h2, p2.y);
                    let sc = 1/100;
                    if (axis === 'x') {
                        guv.push(p1.y*sc, 0, p2.y*sc, 0, p1.y*sc, h1*sc);
                        guv.push(p1.y*sc, h1*sc, p2.y*sc, 0, p2.y*sc, h2*sc);
                    } else {
                        guv.push(p1.x*sc, 0, p2.x*sc, 0, p1.x*sc, h1*sc);
                        guv.push(p1.x*sc, h1*sc, p2.x*sc, 0, p2.x*sc, h2*sc);
                    }
                };

                if (conf.autoShapeWalls) {
                    let perimPts = [];
                    for(let i=0; i<basePts.length; i++) {
                        const p1 = basePts[i];
                        const p2 = basePts[(i+1)%basePts.length];
                        perimPts.push(p1);
                        const lineVal = axis === 'x' ? cy : cx;
                        const val1 = axis === 'x' ? p1.y : p1.x;
                        const val2 = axis === 'x' ? p2.y : p2.x;
                        if ((val1 < lineVal && val2 > lineVal) || (val1 > lineVal && val2 < lineVal)) {
                            const t = (lineVal - val1) / (val2 - val1);
                            perimPts.push({
                                x: p1.x + t * (p2.x - p1.x),
                                y: p1.y + t * (p2.y - p1.y)
                            });
                        }
                    }

                    for(let i=0; i<perimPts.length; i++) {
                        const p1 = perimPts[i];
                        const p2 = perimPts[(i+1)%perimPts.length];
                        let h1 = 0, h2 = 0;
                        if (axis === 'x') {
                            h1 = p1.y <= cy ? (p1.y - bMinY) * Math.tan(pitch * Math.PI / 180) : (bMaxY - p1.y) * Math.tan(pitch * Math.PI / 180);
                            h2 = p2.y <= cy ? (p2.y - bMinY) * Math.tan(pitch * Math.PI / 180) : (bMaxY - p2.y) * Math.tan(pitch * Math.PI / 180);
                        } else {
                            h1 = p1.x <= cx ? (p1.x - bMinX) * Math.tan(pitch * Math.PI / 180) : (bMaxX - p1.x) * Math.tan(pitch * Math.PI / 180);
                            h2 = p2.x <= cx ? (p2.x - bMinX) * Math.tan(pitch * Math.PI / 180) : (bMaxX - p2.x) * Math.tan(pitch * Math.PI / 180);
                        }
                        if (h1 > 0.01 || h2 > 0.01) {
                            let isOuter = false;
                            if (axis === 'x') {
                                isOuter = Math.abs(p1.x - bMinX) < 1 || Math.abs(p1.x - bMaxX) < 1 || Math.abs(p2.x - bMinX) < 1 || Math.abs(p2.x - bMaxX) < 1;
                            } else {
                                isOuter = Math.abs(p1.y - bMinY) < 1 || Math.abs(p1.y - bMaxY) < 1 || Math.abs(p2.y - bMinY) < 1 || Math.abs(p2.y - bMaxY) < 1;
                            }

                            if (isOuter) {
                                // Skip outer walls because Wall3DBuilder already generates thick PremiumWalls for them!
                            } else {
                                addGableQuad(p1, p2, h1, h2);
                            }
                        }
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
                        mesh.add(gableMesh);
                    }
                }
                
            } else {
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                basePts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;

                const pitch = conf.pitch || 30;
                const maxSpan = Math.min(bW, bD);
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                
                let cx = 0, cy = 0, signedArea = 0;
                for (let i = 0; i < basePts.length; i++) {
                    let p0 = basePts[i], p1 = basePts[(i + 1) % basePts.length];
                    let a = p0.x * p1.y - p1.x * p0.y;
                    signedArea += a;
                    cx += (p0.x + p1.x) * a;
                    cy += (p0.y + p1.y) * a;
                }
                signedArea *= 0.5;
                if (Math.abs(signedArea) > 0.1) { cx /= (6.0 * signedArea); cy /= (6.0 * signedArea); } 
                else { cx = bMinX + bW/2; cy = bMinY + bD/2; }

                const top = [cx, rh, cy];
                const v = [], uv = [];
                
                const dropFactor = Math.tan(pitch * Math.PI / 180);
                
                // Helper to get overhang for an edge
                const getOverhang = (idx) => {
                    if (Array.isArray(conf.overhangs) && conf.overhangs[idx] !== undefined) return conf.overhangs[idx];
                    return conf.overhang !== undefined ? conf.overhang : 8;
                };

                for (let i = 0; i < pts.length; i++) {
                    let p0 = pts[i], p1 = pts[(i + 1) % pts.length];
                    let dx1 = p1.x - p0.x, dz1 = p1.y - p0.y;
                    let dx2 = top[0] - p0.x, dz2 = top[2] - p0.y;
                    let ny = dx1 * dz2 - dz1 * dx2; 
                    
                    let prevIdx = (i - 1 + pts.length) % pts.length;
                    let nextIdx = (i + 1) % pts.length;
                    
                    let drop0 = -Math.max(getOverhang(prevIdx), getOverhang(i)) * dropFactor;
                    let drop1 = -Math.max(getOverhang(i), getOverhang(nextIdx)) * dropFactor;
                    
                    if (ny < 0) { 
                        v.push(p1.x, drop1, p1.y, p0.x, drop0, p0.y, ...top); 
                        uv.push(p1.x / 100, p1.y / 100, p0.x / 100, p0.y / 100, top[0] / 100, top[2] / 100);
                    } 
                    else { 
                        v.push(p0.x, drop0, p0.y, p1.x, drop1, p1.y, ...top); 
                        uv.push(p0.x / 100, p0.y / 100, p1.x / 100, p1.y / 100, top[0] / 100, top[2] / 100);
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

            const roofGroup = new THREE.Group();
            let groupX = 0, groupZ = 0;
            if (roof.group && typeof roof.group.x === 'function') {
                groupX = roof.group.x();
                groupZ = roof.group.y();
            } else if (roof.x !== undefined) {
                groupX = roof.x;
                groupZ = roof.y;
            }
            roofGroup.position.set(groupX, h, groupZ);
            
            let rot = roof.rotation || 0;
            roofGroup.rotation.y = -rot * Math.PI / 180;

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            mesh.userData = { isRoof: true, entity: roof }; 
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

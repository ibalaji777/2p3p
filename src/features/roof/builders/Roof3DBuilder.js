import * as THREE from 'three';
import { WALL_HEIGHT, ROOF_DECOR_REGISTRY, WALL_DECOR_REGISTRY, offsetPolygon } from '../../../core/registry.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';
import { Skylight3DBuilder } from './Skylight3DBuilder.js';
import { RoofSculpture3DBuilder } from './RoofSculpture3DBuilder.js';
import { CurvedPortal3DBuilder } from './CurvedPortal3DBuilder.js';
import { RoofGeometryEngine } from '../../../core/roof/RoofGeometryEngine.js';
import { FlatRoofGenerator } from './generators/FlatRoofGenerator.js';
import { ShedRoofGenerator } from './generators/ShedRoofGenerator.js';
import { GableRoofGenerator } from './generators/GableRoofGenerator.js';
import { HipRoofGenerator } from './generators/HipRoofGenerator.js';
import { ComplexRoofGenerator } from './generators/ComplexRoofGenerator.js';


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
            const mainWalls = wallList.filter(w => !w.parentGroup && !w.isAutoGable && !w.parentRoofId);
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
            
            // Use canonical RoofGeometryEngine to detect walls under this roof
            const wallsUnderRoof = hasWalls ? RoofGeometryEngine.getWallsUnderRoof(roof, wallList) : [];
            const maxWallTop = (hasWalls && wallsUnderRoof.length > 0)
                ? RoofGeometryEngine.getMaxWallTopUnderRoof(roof, wallsUnderRoof)
                : 0;

            const isResting = roof._restingOnWalls !== false && (
                roof._restingOnWalls ||
                roof.elevation === undefined ||
                (maxWallTop > 0 && Math.abs((Number(roof.elevation) || 0) - maxWallTop) < 2)
            );

            let baseHeight;
            if (maxWallTop > 0 && isResting) {
                // Roof is resting on walls: strictly track wall top UP and DOWN
                baseHeight = maxWallTop;
                roof.elevation = maxWallTop;
                roof._restingOnWalls = true;
                roof._lastSyncedWallTop = maxWallTop;
            } else if (roof.elevation !== undefined) {
                // Manually placed roof: if explicitly detached, respect elevation directly
                if (roof._restingOnWalls === false) {
                    baseHeight = Number(roof.elevation) || 0;
                } else {
                    baseHeight = maxWallTop > 0 ? Math.max(Number(roof.elevation), maxWallTop) : Number(roof.elevation);
                }
            } else {
                baseHeight = maxWallTop > 0 ? maxWallTop : (hasWalls ? maxWallHeight : 0);
            }

            const h = baseHeight + wallGap;

            const resolveRoofMaterial = (matKey) => {
                const effectiveKey = matKey || conf.material || 'terracotta_tiles_roof';
                const matDecor = ROOF_DECOR_REGISTRY[effectiveKey] || ROOF_DECOR_REGISTRY['concrete_flat'];
                const isGlass = Boolean(matDecor && (matDecor.isGlass || matDecor.category === 'glass' || effectiveKey.startsWith('glass_roof_')));
                const m = (this.ctx?.helpers?.getDynamicMaterial ? this.ctx.helpers.getDynamicMaterial(effectiveKey, isGlass ? 'glass' : 'roof') : null) || new THREE.MeshStandardMaterial({color: 0x888888});
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
                if (matDecor && (matDecor.texture || matDecor.dataUri) && this.ctx?.assets?.getTexture) {
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
            const fasciaMat = (this.ctx?.helpers?.getDynamicMaterial ? this.ctx.helpers.getDynamicMaterial(conf.fasciaMaterial || defaultFascia, isGlassRoof ? 'metal' : 'wall') : null) 
                || new THREE.MeshStandardMaterial({
                    color: isGlassRoof ? 0x1e293b : 0xefede5, 
                    metalness: 0.0, 
                    roughness: isGlassRoof ? 0.25 : 0.9,
                    envMapIntensity: 0.08
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
            const roofType = conf.roofType || 'gable';

            if (roofType === 'curved_portal' || roofType === 'modern_wrap') {
                mesh = CurvedPortal3DBuilder.build(roof, conf, pts, h, this.ctx, resolveRoofMaterial);
            } else if (roofType === 'flat') {
                mesh = FlatRoofGenerator.build({
                    roof, conf, pts, h, ctx: this.ctx, resolveRoofMaterial,
                    shapeList, wallsUnderRoof, isGlassRoof, mat, fasciaMat
                });
            } else if (roofType === 'shed' || roofType === 'half_gable') {
                mesh = ShedRoofGenerator.build({
                    roof, conf, pts, basePts, h, ctx: this.ctx, resolveRoofMaterial,
                    isGlassRoof, mat, fasciaMat, hasWalls, wallList
                });
            } else if (roofType === 'gable' || roofType === 'curved') {
                mesh = GableRoofGenerator.build({
                    roof, conf, pts, basePts, h, ctx: this.ctx, resolveRoofMaterial,
                    isGlassRoof, mat, fasciaMat, hasWalls, wallList
                });
            } else if (roofType === 'half_hip' || roofType === 'hip' || roofType === 'dutch_gable' || roofType === 'jerkinhead') {
                mesh = HipRoofGenerator.build({
                    roof, conf, pts, basePts, h, ctx: this.ctx, resolveRoofMaterial,
                    isGlassRoof, mat, fasciaMat, hasWalls, wallList
                });
            } else if (roofType === 'gambrel' || roofType === 'mansard' || roofType.startsWith('turret')) {
                mesh = ComplexRoofGenerator.build({
                    roof, conf, pts, basePts, h, ctx: this.ctx, resolveRoofMaterial,
                    isGlassRoof, mat, fasciaMat, hasWalls, wallList
                });
            } else {
                mesh = HipRoofGenerator.build({
                    roof, conf, pts, basePts, h, ctx: this.ctx, resolveRoofMaterial,
                    isGlassRoof, mat, fasciaMat, hasWalls, wallList
                });
            }

            let ptsMinX = Infinity, ptsMaxX = -Infinity, ptsMinY = Infinity, ptsMaxY = -Infinity;
            (roof.points || []).forEach(p => {
                ptsMinX = Math.min(ptsMinX, p.x); ptsMaxX = Math.max(ptsMaxX, p.x);
                ptsMinY = Math.min(ptsMinY, p.y); ptsMaxY = Math.max(ptsMaxY, p.y);
            });
            const cx = (ptsMinX !== Infinity) ? (ptsMinX + ptsMaxX) / 2 : 0;
            const cz = (ptsMinY !== Infinity) ? (ptsMinY + ptsMaxY) / 2 : 0;

            const roofGroup = new THREE.Group();
            roofGroup.userData = {
                isRoof: true,
                isRoofGroup: true,
                entity: roof,
                roofId: roof.id
            };
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
            
            const isCurvedPortal = conf.roofType === 'curved_portal' || conf.roofType === 'modern_wrap';
            mesh.userData = { 
                isRoof: true, 
                isFlatRoof: conf.roofType === 'flat',
                isCurvedPortal: isCurvedPortal,
                entity: roof, 
                materialSlot: isCurvedPortal ? 'outer' : 'top', 
                componentType: isCurvedPortal ? 'curved_portal' : 'roof_top',
                levelIndex: activeIndex,
                roofId: roof.id
            }; 
            if (Array.isArray(this.ctx.interactables) && targetGroup === this.ctx.structureGroup) {
                if (isCurvedPortal) {
                    mesh.traverse(c => {
                        if (c.isMesh) this.ctx.interactables.push(c);
                    });
                } else {
                    this.ctx.interactables.push(mesh);
                }
            }
            
            roofGroup.add(mesh);
            if (!isCurvedPortal) {
                ComponentRegistry.registerMesh(roof, "top", mesh, { componentId: `${roof.id}_top`, componentType: 'roof_top' });
                if (conf.roofType === 'flat') {
                    ComponentRegistry.registerMesh(roof, "fascia", mesh, { componentId: `${roof.id}_fascia`, componentType: 'fascia' });
                    mesh.userData.materialSlot = 'top';
                    mesh.userData.componentType = 'roof_top';
                }
            }

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
                    } else if (conf.roofType === 'shed' || conf.roofType === 'half_gable') {
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
                    skGroup.userData = { isRoofAddon: true, isSkylight: true, addonType: 'skylight', entity: sk, parentRoof: roof };

                    roofGroup.add(skGroup);
                    if (Array.isArray(this.ctx.interactables) && targetGroup === this.ctx.structureGroup) {
                        this.ctx.interactables.push(skGroup);
                    }
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
                    if (Array.isArray(this.ctx.interactables) && targetGroup === this.ctx.structureGroup) {
                        this.ctx.interactables.push(crestMesh);
                    }
                });
            }

            // 2. Apex Finials & Weather Vanes (Victorian spires, copper spires, globe orbs, weather roosters)
            const finialList = Array.isArray(conf.finials) ? conf.finials : (Array.isArray(roof.finials) ? roof.finials : []);
            if (finialList.length > 0 && apexPoints.length > 0) {
                finialList.forEach(fin => {
                    let targets = [];
                    const pos = fin.position || (apexPoints.length === 1 ? 'center_apex' : 'both_apexes');

                    if (pos === 'start_apex' || pos === 'start') {
                        targets = [apexPoints[0]];
                    } else if (pos === 'end_apex' || pos === 'end') {
                        targets = [apexPoints[apexPoints.length - 1]];
                    } else if (pos === 'both_apexes') {
                        targets = apexPoints.length > 1 ? [apexPoints[0], apexPoints[apexPoints.length - 1]] : [apexPoints[0]];
                    } else if (pos === 'all_apexes') {
                        targets = apexPoints;
                    } else if (pos === 'center_apex' || pos === 'center' || pos === 'turret_peak') {
                        const centerPt = apexPoints.find(ap => ap.id === 'center') || apexPoints[0];
                        targets = [centerPt];
                    } else if (pos === 'custom' && fin.x !== undefined && fin.z !== undefined) {
                        targets = [{ x: fin.x, y: fin.y || apexPoints[0].y, z: fin.z }];
                    } else {
                        const matched = apexPoints.find(ap => ap.id === pos);
                        if (matched) targets = [matched];
                        else targets = [apexPoints[0]];
                    }

                    targets.forEach(pt => {
                        const finMesh = sculptureBuilder.buildApexFinial(fin, roof);
                        finMesh.position.set(
                            pt.x + (fin.offsetX || 0),
                            pt.y + (fin.elevationOffset || 0),
                            pt.z + (fin.offsetZ || 0)
                        );
                        roofGroup.add(finMesh);
                        if (Array.isArray(this.ctx.interactables) && targetGroup === this.ctx.structureGroup) {
                            this.ctx.interactables.push(finMesh);
                        }
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
                    } else if (conf.roofType === 'shed' || conf.roofType === 'half_gable') {
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
                    if (Array.isArray(this.ctx.interactables) && targetGroup === this.ctx.structureGroup) {
                        this.ctx.interactables.push(chMesh);
                    }
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

            if (targetGroup === this.ctx.structureGroup) {
                const existingIndex = targetGroup.children.findIndex(c => 
                    (roof.mesh3D && c === roof.mesh3D) || 
                    (c.userData && (
                        (roof.id && c.userData.roofId === roof.id) || 
                        (roof && c.userData.entity === roof)
                    ))
                );
                if (existingIndex !== -1) {
                    const oldGroup = targetGroup.children[existingIndex];
                    if (oldGroup !== roofGroup) {
                        targetGroup.remove(oldGroup);
                        if (this.ctx && typeof this.ctx.deepDispose === 'function') {
                            this.ctx.deepDispose(oldGroup);
                        }
                    }
                }
                roof.mesh3D = roofGroup;
            } else if (roof.mesh3D && roof.mesh3D !== roofGroup && roof.mesh3D.parent === targetGroup) {
                targetGroup.remove(roof.mesh3D);
            }
            targetGroup.add(roofGroup);
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
        } else if (roofType === 'shed' || roofType === 'half_gable') {
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
        } else if (roofType === 'shed' || roofType === 'half_gable') {
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

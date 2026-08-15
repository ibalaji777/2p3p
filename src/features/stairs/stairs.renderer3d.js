import * as THREE from 'three';
import { WALL_HEIGHT } from '../../core/registry.js';
import { MaterialManager } from '../railing/materials/MaterialManager.js';
import { Railing3DBuilder } from '../railing/builders/Railing3DBuilder.js';
import { getRailingConfig } from '../railing/registry/railing.registry.js';
import { ComponentRegistry } from '../../core/engine3d/ComponentRegistry.js';

export class Stair3DBuilder {
    constructor(assets, interactables, helpers) {
        this.assets = assets;
        this.interactables = interactables;
        this.helpers = helpers;
        this.defaultMat = new THREE.MeshStandardMaterial({ color: 0xff00ff, roughness: 0.8 }); // Magenta error material
    }

    getTexture(url, repeatX = 1, repeatY = 1) {
        if (!Stair3DBuilder.textureCache) Stair3DBuilder.textureCache = {};
        const key = url + '_' + repeatX + '_' + repeatY;
        if (Stair3DBuilder.textureCache[key]) return Stair3DBuilder.textureCache[key];
        
        const tex = new THREE.TextureLoader().load(url);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
        tex.colorSpace = THREE.SRGBColorSpace;
        Stair3DBuilder.textureCache[key] = tex;
        return tex;
    }

    build(stairs, parentGroup, activeIndex, isStatic = false, maxWallHeight = 300) {
        if (!stairs || stairs.length === 0) return;

        stairs.forEach(stair => {
            if (!stair.type) return;
            const group = new THREE.Group();
            
            const getMat = (slotId) => {
                const matId = stair.materials?.[slotId]?.id;
                let mat = this.defaultMat;
                if (matId && this.helpers && this.helpers.getDynamicMaterial) {
                    mat = this.helpers.getDynamicMaterial(matId, 'staircase') || this.defaultMat;
                }
                // Clone to ensure each slot has a unique material instance to prevent cross-highlighting
                if (Array.isArray(mat)) {
                    return mat.map(m => m.clone ? m.clone() : m);
                }
                return mat.clone ? mat.clone() : mat;
            };

            const treadMat = getMat('treads');
            const riserMat = getMat('risers');
            const landingMat = getMat('landings');
            const structureMat = getMat('stringers');
            
            // Fallback for v4 and legacy geometries that don't distinguish parts well
            const stairMat = treadMat; 
            
            // Apply global positioning
            const sx = Number(stair.x) || 0;
            const sy = Number(stair.elevation) || 0;
            const sz = Number(stair.y) || 0;
            const sRot = Number(stair.rotation) || 0;
            
            group.position.set(sx, sy, sz);
            // Convert 2D rotation to 3D rotation around Y axis
            group.rotation.y = -sRot * Math.PI / 180;

            if (stair.type === 'stair_v4_flight') {
                const stepCount = Number(stair.stepCount) || 15;
                const stepDepth = Number(stair.stepDepth) || 18.33;
                const stepHeight = Number(stair.stepHeight) || 11.67;
                const width = Number(stair.width) || 60;
                const direction = stair.direction || 'up'; // Defaults to up

                const treadThick = 1.5;
                const riserThick = 3;
                const riserHeight = Math.max(1, stepHeight - treadThick);

                const treadGeo = new THREE.BoxGeometry(width, treadThick, stepDepth);
                const riserGeo = new THREE.BoxGeometry(width, riserHeight, riserThick);

                for (let i = 0; i < stepCount; i++) {
                    const localZIndex = direction === 'up' ? (stepCount - 1 - i) : i;
                    const stepTopY = (i + 1) * stepHeight;
                    const stepBottomY = i * stepHeight;
                    const meshZ = localZIndex * stepDepth + stepDepth / 2;

                    // Tread
                    const treadMesh = new THREE.Mesh(treadGeo, treadMat);
                    treadMesh.name = 'tread';
                    treadMesh.position.set(0, stepTopY - treadThick / 2, meshZ);
                    treadMesh.castShadow = true;
                    treadMesh.receiveShadow = true;
                    group.add(treadMesh);

                    // Riser
                    if (riserMat !== null) {
                        const riserMesh = new THREE.Mesh(riserGeo, riserMat);
                        riserMesh.name = 'riser';
                        const riserZ = localZIndex * stepDepth + riserThick / 2;
                        riserMesh.position.set(0, stepBottomY + riserHeight / 2, riserZ);
                        riserMesh.castShadow = true;
                        riserMesh.receiveShadow = true;
                        group.add(riserMesh);
                    }
                }

            } else if (stair.type === 'stair_v4_landing') {
                const shapeType = stair.shape || 'rectangular';
                const stepHeight = 17.5; // Standard step thickness

                if (shapeType === 'u_curve') {
                    const rIn = Number(stair.innerRadius) || 20;
                    const l = Number(stair.length) || 100;
                    const rOut = rIn + l;

                    const shape = new THREE.Shape();
                    // Draw outer arc
                    shape.absarc(0, 0, rOut, 0, Math.PI, false);
                    // Draw inner arc backwards
                    shape.absarc(0, 0, rIn, Math.PI, 0, true);

                    const extrudeSettings = { depth: stepHeight, bevelEnabled: false };
                    const landingGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                    
                    landingGeo.rotateX(Math.PI / 2);
                    landingGeo.translate(0, stepHeight, 0);

                    const landingMesh = new THREE.Mesh(landingGeo, stairMat);
                    landingMesh.name = 'landing';
                    landingMesh.castShadow = true;
                    landingMesh.receiveShadow = true;
                    group.add(landingMesh);

                } else {
                    const width = Number(stair.width) || 60;
                    const length = Number(stair.length) || 60;
                    
                    const landingGeo = new THREE.BoxGeometry(width, stepHeight, length);
                    const landingMesh = new THREE.Mesh(landingGeo, stairMat);
                    landingMesh.name = 'landing';
                    landingMesh.position.set(0, stepHeight / 2, length / 2);
                    landingMesh.castShadow = true;
                    landingMesh.receiveShadow = true;
                    group.add(landingMesh);
                }
            } else if (stair.type && (stair.type.startsWith('stair_v5_') || stair.type.startsWith('stair_v4_') || stair.type === 'staircase')) {
                let shape = stair.shape;
                if (!shape || shape.startsWith('stair_v5_') || shape.startsWith('stair_v4_') || shape === 'staircase') {
                    const raw = (stair.shape || stair.type || 'straight').toString();
                    if (raw.endsWith('_straight') || raw === 'straight' || raw === 'staircase') shape = 'straight';
                    else if (raw.endsWith('_L') || raw === 'L') shape = 'L';
                    else if (raw.endsWith('_U') || raw === 'U') shape = 'U';
                    else if (raw.endsWith('_T') || raw === 'T') shape = 'T';
                    else shape = 'straight';
                }

                const width = Number(stair.width) || 60;
                const stepDepth = Number(stair.stepDepth) || 18.33;
                const direction = stair.direction || 'up';
                const turnDir = stair.turnDirection || 'right';
                let f1Steps = Number(stair.flight1Steps) || 0;
                let f2Steps = Number(stair.flight2Steps) || 0;

                if (shape === 'straight') {
                    if (!f1Steps) f1Steps = Number(stair.totalSteps) || Number(stair.steps) || 10;
                    f2Steps = 0;
                } else if (shape === 'L' || shape === 'U' || shape === 'T') {
                    if (!f1Steps) f1Steps = Number(stair.flight1Steps) || 8;
                    if (!f2Steps) f2Steps = Number(stair.flight2Steps) || 7;
                }

                const totalRisers = shape === 'straight' ? f1Steps : (f1Steps + f2Steps);
                
                // AUTO-FIT HEIGHT: Enforce perfect fit to next floor height
                const stepHeight = maxWallHeight / totalRisers;
                const l1 = f1Steps * stepDepth;
                const l2 = f2Steps * stepDepth;
                const landingSize = Number(stair.landingSize) || width;
                const gapWidth = Number(stair.gapWidth) || 20;

                const stringerType = stair.stringerType || 'solid';
                const sWidth = Number(stair.stringerWidth) || 10;
                const sThick = Number(stair.stringerThickness) || 20;
                const bOffset = stair.beamOffset !== undefined ? Number(stair.beamOffset) : 25;
                const hasLandingSupports = stair.landingSupports === true;
                const hasTopLanding = stair.hasTopLanding === true;
                const hasBottomLanding = stair.hasBottomLanding === true;
                
                const railingLayout = stair.railingLayout || 'both';
                const leftRailing = stair.leftRailing || {};
                const rightRailing = stair.rightRailing || {};

                const getRailingMaterial = (matId) => {
                    if (matId === 'default' || !matId) return stairMat;
                    
                    let globalMatId = 'metal_black';
                    if (matId === 'wood') globalMatId = 'wood_oak';
                    else if (matId === 'steel' || matId === 'stainless_steel') globalMatId = 'metal_stainless';
                    else if (matId === 'aluminum') globalMatId = 'metal_aluminum';
                    else if (matId === 'black_metal' || matId === 'black_steel') globalMatId = 'metal_black';
                    else if (matId === 'glass_clear') globalMatId = 'glass_clear';
                    else if (matId === 'glass_frosted') globalMatId = 'glass_frosted';
                    else if (matId === 'glass_tinted') globalMatId = 'glass_tinted';
                    else return stairMat;

                    return MaterialManager.getMaterial(globalMatId);
                };

                const treadThick = 1.5;
                const riserThick = 1.5;
                const nosing = 2.0; // Architectural front nosing overhang (2 cm)
                const riserHeight = Math.max(1, stepHeight - treadThick);

                const buildStep = (startX, startZ, rotY, stepIdx, logicalElevIdx) => {
                    const stepTopY = (logicalElevIdx + 1) * stepHeight;
                    const stepBottomY = logicalElevIdx * stepHeight;

                    // Tread front nosing overhang (2cm) & back extension under upper riser (1.5cm)
                    const sideNosing = (stringerType === 'side') ? 0 : 1.5;
                    const actualTreadWidth = width + sideNosing * 2;
                    const actualTreadDepth = stepDepth + nosing + riserThick;

                    // Tread local coordinates along flight Z (front lip overhanging, back extending under upper riser):
                    const treadZ_local = stepIdx * stepDepth + stepDepth / 2 - nosing / 2 + riserThick / 2;
                    const treadX = startX + Math.sin(rotY) * treadZ_local;
                    const treadZ = startZ + Math.cos(rotY) * treadZ_local;
                    const treadY = stepTopY - treadThick / 2;

                    const treadGeo = new THREE.BoxGeometry(actualTreadWidth, treadThick, actualTreadDepth);
                    const treadMesh = new THREE.Mesh(treadGeo, treadMat);
                    treadMesh.name = 'tread';
                    treadMesh.position.set(treadX, treadY, treadZ);
                    treadMesh.rotation.y = rotY;
                    treadMesh.castShadow = true; treadMesh.receiveShadow = true;
                    group.add(treadMesh);

                    // Riser panel resting directly on top of the bottom tread plank:
                    if (riserMat !== null) {
                        const riserZ_local = stepIdx * stepDepth + riserThick / 2;
                        const riserX = startX + Math.sin(rotY) * riserZ_local;
                        const riserZ = startZ + Math.cos(rotY) * riserZ_local;
                        const riserY = stepBottomY + riserHeight / 2;

                        const riserGeo = new THREE.BoxGeometry(width, riserHeight, riserThick);
                        const riserMesh = new THREE.Mesh(riserGeo, riserMat);
                        riserMesh.name = 'riser';
                        riserMesh.position.set(riserX, riserY, riserZ);
                        riserMesh.rotation.y = rotY;
                        riserMesh.castShadow = true; riserMesh.receiveShadow = true;
                        group.add(riserMesh);
                    }
                };

                const buildFlight = (startX, startZ, rotY, stepCount, startElevIdx) => {
                    const flightLength = stepCount * stepDepth;
                    
                    const startH = direction === 'up' ? (startElevIdx) * stepHeight : (startElevIdx + stepCount) * stepHeight;
                    const endH = direction === 'up' ? (startElevIdx + stepCount) * stepHeight : (startElevIdx) * stepHeight;

                    for (let i = 0; i < stepCount; i++) {
                        const logicalIdx = direction === 'up' ? (startElevIdx + i) : (startElevIdx + stepCount - 1 - i);
                        buildStep(startX, startZ, rotY, i, logicalIdx);
                    }

                    if (stringerType === 'solid') {
                        // Build continuous stepped solid sub-base underneath the steps (100% orthogonal tread seats & riser backings)
                        const shape = new THREE.Shape();
                        const baseFlightH = startElevIdx * stepHeight;
                        const topFlightH = (startElevIdx + stepCount) * stepHeight;

                        shape.moveTo(0, 0);
                        shape.lineTo(flightLength, 0);
                        shape.lineTo(flightLength, topFlightH - treadThick);

                        // Sawtooth contour: 100% horizontal under treads and 100% vertical behind risers
                        for (let i = stepCount - 1; i >= 0; i--) {
                            const stepTopY = (startElevIdx + i + 1) * stepHeight;
                            const stepBottomY = (startElevIdx + i) * stepHeight;
                            const treadBottomY = stepTopY - treadThick;
                            const zStart = i * stepDepth;
                            const riserBackZ = zStart + riserThick;

                            // 1. Horizontal line under tread i (at treadBottomY back to riserBackZ)
                            shape.lineTo(riserBackZ, treadBottomY);
                            // 2. Vertical line down behind riser i (at riserBackZ from treadBottomY down to stepBottomY)
                            shape.lineTo(riserBackZ, stepBottomY);
                            // 3. Horizontal line under riser i bottom (at stepBottomY from riserBackZ to zStart)
                            shape.lineTo(zStart, stepBottomY);
                            // 4. Vertical step down to previous tread level (stepBottomY - treadThick)
                            shape.lineTo(zStart, Math.max(0, stepBottomY - treadThick));
                        }

                        if (baseFlightH > 0) {
                            shape.lineTo(0, baseFlightH);
                        } else {
                            shape.lineTo(0, 0);
                        }
                        shape.closePath();

                        const extrudeSettings = { depth: width, bevelEnabled: false };
                        const wedgeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                        
                        const wedgeMesh = new THREE.Mesh(wedgeGeo, structureMat);
                        wedgeMesh.name = 'stringer_solid';

                        wedgeMesh.rotation.y = -Math.PI / 2;

                        const beamGroup = new THREE.Group();
                        beamGroup.position.set(startX, 0, startZ);
                        beamGroup.rotation.y = rotY;

                        wedgeMesh.position.set(width / 2, 0, 0);
                        beamGroup.add(wedgeMesh);

                        wedgeMesh.castShadow = true; wedgeMesh.receiveShadow = true;
                        group.add(beamGroup);
                    } else {
                        const buildBeam = (offsetX, customWidth = sWidth) => {
                            const baseFlightH = startElevIdx * stepHeight;
                            const topFlightH = (startElevIdx + stepCount) * stepHeight;
                            const shape = new THREE.Shape();
                            
                            const pitch = Math.atan2((topFlightH - baseFlightH), flightLength);
                            const vThick = sThick / Math.cos(pitch);
                            
                            if (stringerType === 'side') {
                                const curbHeight = 8;
                                // Parallel skirtboard of uniform thickness (vThick) framing the flight
                                const topY0 = baseFlightH + curbHeight;
                                const topY1 = topFlightH + curbHeight;
                                const botY0 = baseFlightH + curbHeight - vThick;
                                const botY1 = topFlightH + curbHeight - vThick;

                                shape.moveTo(0, botY0);
                                shape.lineTo(flightLength, botY1);
                                shape.lineTo(flightLength, topY1);
                                shape.lineTo(0, topY0);
                                shape.closePath();
                            } else {
                                // Parallel beam of uniform thickness (vThick) running under the steps
                                const topY0 = baseFlightH;
                                const topY1 = topFlightH;
                                const botY0 = baseFlightH - vThick;
                                const botY1 = topFlightH - vThick;

                                shape.moveTo(0, botY0);
                                shape.lineTo(flightLength, botY1);
                                shape.lineTo(flightLength, topY1);
                                shape.lineTo(0, topY0);
                                shape.closePath();
                            }
                            
                            const extrudeSettings = { depth: customWidth, bevelEnabled: false };
                            const beamGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                            
                            const beamMesh = new THREE.Mesh(beamGeo, structureMat);
                            beamMesh.name = 'stringer';
                            
                            beamMesh.rotation.y = -Math.PI / 2;
                            
                            const meshX = offsetX + customWidth / 2;
                            
                            const beamGroup = new THREE.Group();
                            beamGroup.position.set(startX, 0, startZ);
                            beamGroup.rotation.y = rotY;
                            
                            beamMesh.position.set(meshX, 0, 0);
                            beamGroup.add(beamMesh);
                            
                            beamMesh.castShadow = true; beamMesh.receiveShadow = true;
                            group.add(beamGroup);
                        };

                        if (stringerType === 'mono') buildBeam(0);
                        else if (stringerType === 'double') { buildBeam(width/2 - bOffset); buildBeam(-width/2 + bOffset); }
                        else if (stringerType === 'side') { buildBeam(width/2 + sWidth/2); buildBeam(-width/2 - sWidth/2); }
                        else if (stringerType === 'box') { buildBeam(0, width); }
                    }

                    if (railingLayout !== 'none') {
                        const buildRailing = (sideStr) => {
                            const conf = sideStr === 'left' ? leftRailing : rightRailing;
                            if (!conf) return;

                            const rOffset = Number(conf.offset) || 5;
                            const rHeight = Number(conf.height) || 60;
                            
                            // Determine X offset relative to center of the flight
                            const railX = sideStr === 'left' ? -(width/2 - rOffset) : (width/2 - rOffset);

                            // Load the universal config
                            const baseConfigId = conf.configId || (conf.useGlassPanels ? 'stair_glass_default' : (conf.useCableRails ? 'stair_cable_default' : 'stair_baluster_default'));
                            const baseConfig = getRailingConfig(baseConfigId);
                            
                            // Clone and inject stair logic
                            const standardConfig = JSON.parse(JSON.stringify(baseConfig));
                            standardConfig.isStairStyle = true; // Forces routing through UniversalStairGenerator
                            standardConfig.height = rHeight;

                            if (conf.hasNewelPosts) {
                                const nSize = Number(conf.newelSize) || 8;
                                // Add posts if they were missing, or override size
                                standardConfig.post = { spacing: flightLength, width: nSize, depth: nSize, material: 'metal_black' };
                            } else {
                                standardConfig.post = null; // Explicitly remove posts if toggled off
                            }
                            
                            // Inject material overrides from the stair entity
                            if (stair.materials) {
                                if (stair.materials.handrail && standardConfig.handrail) standardConfig.handrail.material = stair.materials.handrail.id;
                                if (stair.materials.balusters) {
                                    if (standardConfig.baluster) standardConfig.baluster.material = stair.materials.balusters.id;
                                    if (standardConfig.cable) standardConfig.cable.material = stair.materials.balusters.id;
                                }
                                if (stair.materials.posts && standardConfig.post) standardConfig.post.material = stair.materials.posts.id;
                                if (stair.materials.glass && standardConfig.glass) standardConfig.glass.material = stair.materials.glass.id;
                                if (stair.materials.bottom_rail && standardConfig.bottomRail) standardConfig.bottomRail.material = stair.materials.bottom_rail.id;
                            }

                            const railGroup = new THREE.Group();
                            railGroup.position.set(startX, 0, startZ);
                            railGroup.rotation.y = rotY;

                            const railStart = new THREE.Vector3(railX, startH, 0);
                            const railEnd = new THREE.Vector3(railX, endH, flightLength);

                            const railing3D = Railing3DBuilder.build3D(railStart, railEnd, standardConfig, stair);
                            railGroup.add(railing3D);

                            group.add(railGroup);
                        };

                        if (railingLayout === 'left' || railingLayout === 'both') buildRailing('left');
                        if (railingLayout === 'right' || railingLayout === 'both') buildRailing('right');
                    }
                };

                const buildLanding = (x, z, lw, lh, elevIdx, isEndLanding = false) => {
                    const topHeight = elevIdx * stepHeight; 
                    
                    if (stringerType === 'solid') {
                        const landingGeo = new THREE.BoxGeometry(lw, topHeight, lh);
                        const landingMesh = new THREE.Mesh(landingGeo, landingMat);
                        landingMesh.name = 'landing';
                        landingMesh.position.set(x, topHeight / 2, z);
                        landingMesh.castShadow = true; landingMesh.receiveShadow = true;
                        group.add(landingMesh);
                    } else {
                        const plateThick = 5;
                        const landingGeo = new THREE.BoxGeometry(lw, plateThick, lh);
                        const landingMesh = new THREE.Mesh(landingGeo, landingMat);
                        landingMesh.name = 'landing';
                        landingMesh.position.set(x, topHeight - plateThick/2, z);
                        landingMesh.castShadow = true; landingMesh.receiveShadow = true;
                        group.add(landingMesh);
                        
                        const frameGeo = new THREE.BoxGeometry(lw, sThick, lh);
                        const frameMesh = new THREE.Mesh(frameGeo, structureMat);
                        frameMesh.name = 'stringer_frame';
                        frameMesh.position.set(x, topHeight - plateThick - sThick/2, z);
                        frameMesh.castShadow = true; frameMesh.receiveShadow = true;
                        group.add(frameMesh);
                        
                        if (hasLandingSupports) {
                            const colSize = 10;
                            const colHeight = topHeight - plateThick - sThick;
                            if (colHeight > 0) {
                                const cx = [x - lw/2 + colSize, x + lw/2 - colSize];
                                const cz = [z - lh/2 + colSize, z + lh/2 - colSize];
                                for (let ci of cx) {
                                    for (let cj of cz) {
                                        const colGeo = new THREE.BoxGeometry(colSize, colHeight, colSize);
                                        const colMesh = new THREE.Mesh(colGeo, structureMat);
                                        colMesh.name = 'stringer_col';
                                        colMesh.position.set(ci, colHeight/2, cj);
                                        colMesh.castShadow = true; colMesh.receiveShadow = true;
                                        group.add(colMesh);
                                    }
                                }
                            }
                        }
                    }
                };

                const addEndLanding = (x, z, lw, lh, rotY, elevIdx) => {
                    const cx = x + Math.sin(rotY) * lh/2;
                    const cz = z + Math.cos(rotY) * lh/2;
                    const lRotY = Math.abs(rotY) === Math.PI/2 ? lw : lh;
                    const lRotX = Math.abs(rotY) === Math.PI/2 ? lh : lw;
                    buildLanding(cx, cz, lRotX, lRotY, elevIdx, true);
                };

                const startLanding = direction === 'up' ? hasBottomLanding : hasTopLanding;
                const endLanding = direction === 'up' ? hasTopLanding : hasBottomLanding;

                if (shape === 'straight') {
                    const steps = Number(stair.totalSteps) || 12;
                    if (startLanding) addEndLanding(0, -landingSize, width, landingSize, 0, direction === 'up' ? 0 : steps);
                    buildFlight(0, 0, 0, steps, 0);
                    if (endLanding) addEndLanding(0, steps * stepDepth, width, landingSize, 0, direction === 'up' ? steps : 0);
                } else if (shape === 'L') {
                    if (startLanding) addEndLanding(0, -landingSize, width, landingSize, 0, direction === 'up' ? 0 : f1Steps + f2Steps);
                    buildFlight(0, 0, 0, f1Steps, direction === 'up' ? 0 : f2Steps);
                    
                    const landingElevIdx = direction === 'up' ? f1Steps : f2Steps;
                    buildLanding(0, l1 + landingSize / 2, width, landingSize, landingElevIdx);
                    
                    const f2X = turnDir === 'right' ? width / 2 : -width / 2;
                    const f2Rot = turnDir === 'right' ? Math.PI / 2 : -Math.PI / 2;
                    buildFlight(f2X, l1 + landingSize / 2, f2Rot, f2Steps, direction === 'up' ? f1Steps : 0);
                    
                    if (endLanding) {
                        const endX = f2X + Math.sin(f2Rot) * l2;
                        const endZ = l1 + landingSize / 2 + Math.cos(f2Rot) * l2;
                        addEndLanding(endX, endZ, width, landingSize, f2Rot, direction === 'up' ? f1Steps + f2Steps : 0);
                    }
                } else if (shape === 'U') {
                    if (startLanding) addEndLanding(0, -landingSize, width, landingSize, 0, direction === 'up' ? 0 : f1Steps + f2Steps);
                    buildFlight(0, 0, 0, f1Steps, direction === 'up' ? 0 : f2Steps);
                    
                    const landingElevIdx = direction === 'up' ? f1Steps : f2Steps;
                    const totalW = width * 2 + gapWidth;
                    const landingX = turnDir === 'right' ? width / 2 + gapWidth / 2 : -width / 2 - gapWidth / 2;
                    buildLanding(landingX, l1 + landingSize / 2, totalW, landingSize, landingElevIdx);
                    
                    const f2X = turnDir === 'right' ? width + gapWidth : -width - gapWidth;
                    buildFlight(f2X, l1, Math.PI, f2Steps, direction === 'up' ? f1Steps : 0);

                    if (endLanding) {
                        const endX = f2X + Math.sin(Math.PI) * l2;
                        const endZ = l1 + Math.cos(Math.PI) * l2;
                        addEndLanding(endX, endZ, width, landingSize, Math.PI, direction === 'up' ? f1Steps + f2Steps : 0);
                    }
                } else if (shape === 'T') {
                    if (startLanding) addEndLanding(0, -landingSize, width, landingSize, 0, direction === 'up' ? 0 : f1Steps + f2Steps);
                    buildFlight(0, 0, 0, f1Steps, direction === 'up' ? 0 : f2Steps);
                    
                    const landingElevIdx = direction === 'up' ? f1Steps : f2Steps;
                    const totalW = l2 * 2 + width;
                    buildLanding(0, l1 + landingSize / 2, totalW, landingSize, landingElevIdx);
                    
                    buildFlight(-width / 2, l1 + landingSize / 2, -Math.PI / 2, f2Steps, direction === 'up' ? f1Steps : 0);
                    buildFlight(width / 2, l1 + landingSize / 2, Math.PI / 2, f2Steps, direction === 'up' ? f1Steps : 0);

                    if (endLanding) {
                        const lX = -width / 2 + Math.sin(-Math.PI / 2) * l2;
                        const lZ = l1 + landingSize / 2 + Math.cos(-Math.PI / 2) * l2;
                        addEndLanding(lX, lZ, width, landingSize, -Math.PI / 2, direction === 'up' ? f1Steps + f2Steps : 0);
                        
                        const rX = width / 2 + Math.sin(Math.PI / 2) * l2;
                        const rZ = l1 + landingSize / 2 + Math.cos(Math.PI / 2) * l2;
                        addEndLanding(rX, rZ, width, landingSize, Math.PI / 2, direction === 'up' ? f1Steps + f2Steps : 0);
                    }
                }
            }

            group.updateMatrixWorld(true);

            // Ensure unified component highlighting, material registry, and continuous 1:1 physical UVs
            const worldPos = new THREE.Vector3();
            group.traverse(child => {
                if (child.isMesh && child.geometry && child.geometry.attributes.position) {
                    const geo = child.geometry;
                    const uvs = geo.attributes.uv;
                    const pos = geo.attributes.position;
                    const norms = geo.attributes.normal;
                    
                    child.getWorldPosition(worldPos);

                    if (uvs && norms) {
                        // Uniform physical metric scale (150 cm = 1.5m per tile repeat)
                        const scale = 150;
                        
                        for (let k = 0; k < pos.count; k++) {
                            // Absolute world-space UV coordinates (100% continuous across flights & landings, zero glitch, zero seam)
                            const wx = (pos.getX(k) + worldPos.x) / scale;
                            const wy = (pos.getY(k) + worldPos.y) / scale;
                            const wz = (pos.getZ(k) + worldPos.z) / scale;

                            const nx = Math.abs(norms.getX(k));
                            const ny = Math.abs(norms.getY(k));
                            const nz = Math.abs(norms.getZ(k));

                            if (ny >= 0.5) {
                                // Top/Bottom horizontal faces
                                uvs.setXY(k, wx, wz);
                            } else if (nx >= nz) {
                                // Side X faces
                                uvs.setXY(k, wz, wy);
                            } else {
                                // Side Z faces (Risers, Front/Back faces)
                                uvs.setXY(k, wx, wy);
                            }
                        }
                        uvs.needsUpdate = true;
                    }

                    // Apply MirroredRepeatWrapping to eliminate texture boundary seam lines seamlessly
                    const applyMirroredWrapping = (m) => {
                        if (!m) return;
                        const maps = [m.map, m.bumpMap, m.normalMap, m.roughnessMap];
                        maps.forEach(t => {
                            if (t) {
                                t.wrapS = THREE.MirroredRepeatWrapping;
                                t.wrapT = THREE.MirroredRepeatWrapping;
                                t.needsUpdate = true;
                            }
                        });
                    };

                    if (Array.isArray(child.material)) {
                        child.material.forEach(applyMirroredWrapping);
                    } else if (child.material) {
                        applyMirroredWrapping(child.material);
                    }

                    // Determine material slot
                    let slot = child.userData.materialSlot;
                    
                    if (!slot) {
                        if (child.name.includes('tread')) slot = 'treads';
                        else if (child.name.includes('riser')) slot = 'risers';
                        else if (child.name.includes('stringer') || child.name.includes('base') || child.name.includes('frame') || child.name.includes('col') || child.name.includes('landing')) slot = 'stringers';
                        else slot = 'stringers';
                    }
                    
                    // Unify material for stringer structural sub-meshes so 100% of stringer is single material
                    if (slot === 'stringers' && structureMat) {
                        child.material = structureMat;
                    }
                    
                    child.userData.entity = stair;
                    child.userData.materialSlot = slot;
                    ComponentRegistry.registerMesh(stair, slot, child);
                }
            });

            // Assign user data to be able to identify or select it if needed
            group.userData = { entity: stair, isStair: true, isStatic: isStatic };
            this.interactables.push(group);
            
            parentGroup.add(group);
        });
    }
}

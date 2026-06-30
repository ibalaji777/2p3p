import * as THREE from 'three';
import { WALL_HEIGHT } from '../registry.js';

export class Stair3DBuilder {
    constructor(assets, interactables) {
        this.assets = assets;
        this.interactables = interactables;
        this.defaultMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }); // Wood-like color
    }

    build(stairs, parentGroup, activeIndex, isStatic = false) {
        if (!stairs || stairs.length === 0) return;

        stairs.forEach(stair => {
            if (!stair.type) return;
            const group = new THREE.Group();
            const stairMat = this.defaultMat.clone();
            
            // Apply global positioning
            const sx = Number(stair.x) || 0;
            const sy = Number(stair.elevation) || 0;
            const sz = Number(stair.y) || 0;
            const sRot = Number(stair.rotation) || 0;
            
            group.position.set(sx, sy, sz);
            // Convert 2D rotation to 3D rotation around Y axis
            group.rotation.y = -sRot * Math.PI / 180;

            if (stair.type === 'stair_v4_flight') {
                const stepCount = Number(stair.stepCount) || 10;
                const stepDepth = Number(stair.stepDepth) || 28;
                const stepHeight = Number(stair.stepHeight) || 17.5;
                const width = Number(stair.width) || 100;
                const direction = stair.direction || 'up'; // Defaults to up

                const stepGeo = new THREE.BoxGeometry(width, stepHeight, stepDepth);

                for (let i = 0; i < stepCount; i++) {
                    const stepMesh = new THREE.Mesh(stepGeo, stairMat);
                    // If direction is up, lowest step (i=0) is at Z = length (bottom of 2d rect).
                    // If direction is down, lowest step is at Z = 0 (top of 2d rect).
                    const localZIndex = direction === 'up' ? (stepCount - 1 - i) : i;
                    const curHeight = (i + 1) * stepHeight;

                    // Solid block from 0 to curHeight
                    const solidGeo = new THREE.BoxGeometry(width, curHeight, stepDepth);
                    const solidMesh = new THREE.Mesh(solidGeo, stairMat);

                    solidMesh.position.set(
                        0,
                        curHeight / 2,
                        localZIndex * stepDepth + stepDepth / 2
                    );
                    solidMesh.castShadow = true;
                    solidMesh.receiveShadow = true;
                    group.add(solidMesh);
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
                    landingMesh.castShadow = true;
                    landingMesh.receiveShadow = true;
                    group.add(landingMesh);

                } else {
                    const width = Number(stair.width) || 100;
                    const length = Number(stair.length) || 100;
                    
                    const landingGeo = new THREE.BoxGeometry(width, stepHeight, length);
                    const landingMesh = new THREE.Mesh(landingGeo, stairMat);
                    landingMesh.position.set(0, stepHeight / 2, length / 2);
                    landingMesh.castShadow = true;
                    landingMesh.receiveShadow = true;
                    group.add(landingMesh);
                }
            } else if (stair.type && stair.type.startsWith('stair_v5_')) {
                const shape = stair.shape;
                const width = Number(stair.width) || 100;
                const stepDepth = Number(stair.stepDepth) || 28;
                const stepHeight = Number(stair.stepHeight) || 17.5;
                const direction = stair.direction || 'up';
                const turnDir = stair.turnDirection || 'right';
                const f1Steps = Number(stair.flight1Steps) || 0;
                const f2Steps = Number(stair.flight2Steps) || 0;
                const l1 = f1Steps * stepDepth;
                const l2 = f2Steps * stepDepth;
                const landingSize = Number(stair.landingSize) || width;
                const gapWidth = Number(stair.gapWidth) || 20;

                const stringerType = stair.stringerType || 'solid';
                const sWidth = Number(stair.stringerWidth) || 10;
                const sThick = Number(stair.stringerThickness) || 20;
                const bOffset = stair.beamOffset !== undefined ? Number(stair.beamOffset) : 25;
                const hasLandingSupports = stair.landingSupports !== false;
                const hasColumnSupports = stair.columnSupports === true;
                const hasTopLanding = stair.hasTopLanding === true;
                const hasBottomLanding = stair.hasBottomLanding === true;
                
                const railingLayout = stair.railingLayout || 'both';
                const leftRailing = stair.leftRailing || {};
                const rightRailing = stair.rightRailing || {};

                const getRailingMaterial = (matId) => {
                    if (matId === 'default' || !matId) return stairMat;
                    if (matId === 'wood') return new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
                    if (matId === 'steel' || matId === 'stainless_steel') return new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
                    if (matId === 'aluminum') return new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.5, roughness: 0.4 });
                    if (matId === 'black_metal' || matId === 'black_steel') return new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });
                    if (matId === 'glass_clear') return new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, opacity: 1, transparent: true, roughness: 0.05, ior: 1.5, thickness: 2 });
                    if (matId === 'glass_frosted') return new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.6, opacity: 1, transparent: true, roughness: 0.5, ior: 1.5, thickness: 2 });
                    if (matId === 'glass_tinted') return new THREE.MeshPhysicalMaterial({ color: 0x000000, transmission: 0.8, opacity: 1, transparent: true, roughness: 0.05, ior: 1.5, thickness: 2 });
                    return stairMat;
                };

                const buildTread = (x, y, z, rotY) => {
                    const treadThick = 5;
                    const treadGeo = new THREE.BoxGeometry(width, treadThick, stepDepth);
                    const treadMesh = new THREE.Mesh(treadGeo, stairMat);
                    treadMesh.position.set(x, y - treadThick / 2, z);
                    treadMesh.rotation.y = rotY;
                    treadMesh.castShadow = true; treadMesh.receiveShadow = true;
                    group.add(treadMesh);
                };

                const buildSolidStep = (x, y, z, rotY) => {
                    const solidGeo = new THREE.BoxGeometry(width, y, stepDepth);
                    const solidMesh = new THREE.Mesh(solidGeo, stairMat);
                    solidMesh.position.set(x, y / 2, z);
                    solidMesh.rotation.y = rotY;
                    solidMesh.castShadow = true; solidMesh.receiveShadow = true;
                    group.add(solidMesh);
                };

                const buildFlight = (startX, startZ, rotY, stepCount, startElevIdx) => {
                    const flightLength = stepCount * stepDepth;
                    
                    const startH = direction === 'up' ? (startElevIdx + stepCount) * stepHeight : (startElevIdx) * stepHeight;
                    const endH = direction === 'up' ? (startElevIdx) * stepHeight : (startElevIdx + stepCount) * stepHeight;
                    
                    for (let i = 0; i < stepCount; i++) {
                        const logicalIdx = direction === 'up' ? (startElevIdx + stepCount - 1 - i) : (startElevIdx + i);
                        const curHeight = (logicalIdx + 1) * stepHeight;
                        const meshZ = i * stepDepth + stepDepth / 2;
                        const treadX = startX + Math.sin(rotY) * meshZ;
                        const treadZ = startZ + Math.cos(rotY) * meshZ;
                        
                        if (stringerType === 'solid') buildSolidStep(treadX, curHeight, treadZ, rotY);
                        else buildTread(treadX, curHeight, treadZ, rotY);
                    }

                    if (stringerType !== 'solid') {
                        const buildBeam = (offsetX, customWidth = sWidth) => {
                            const startH = direction === 'up' ? (startElevIdx + stepCount) * stepHeight : (startElevIdx) * stepHeight;
                            const endH = direction === 'up' ? (startElevIdx) * stepHeight : (startElevIdx + stepCount) * stepHeight;
                            
                            const shape = new THREE.Shape();
                            
                            const pitch = Math.atan(stepHeight / stepDepth);
                            const vThick = sThick / Math.cos(pitch);
                            
                            let yTopOffset = -2.5; // Under the floating tread
                            if (stringerType === 'side') {
                                yTopOffset = stepHeight; // Side curb sticking above
                            }
                            
                            // Draw in Shape X-Y plane (X = flight Z, Y = flight Y)
                            shape.moveTo(0, startH + yTopOffset);
                            shape.lineTo(flightLength, endH + yTopOffset);
                            shape.lineTo(flightLength, endH + yTopOffset - vThick);
                            shape.lineTo(0, startH + yTopOffset - vThick);
                            shape.closePath();
                            
                            const extrudeSettings = {
                                depth: customWidth,
                                bevelEnabled: false
                            };
                            
                            const beamGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                            const beamMesh = new THREE.Mesh(beamGeo, stairMat);
                            
                            // Rotate to map Shape X to Flight Z, and Shape Extrude Z to Flight X
                            beamMesh.rotation.y = -Math.PI / 2;
                            
                            const meshX = offsetX + customWidth / 2;
                            const meshY = 0;
                            const meshZ = 0;
                            
                            const beamGroup = new THREE.Group();
                            beamGroup.position.set(startX, 0, startZ);
                            beamGroup.rotation.y = rotY;
                            
                            beamMesh.position.set(meshX, meshY, meshZ);
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

                            const rMat = getRailingMaterial(conf.handrailMaterial);
                            const bMat = getRailingMaterial(conf.balusterMaterial);
                            const pMat = getRailingMaterial(conf.panelMaterial);
                            const cMat = getRailingMaterial(conf.cableMaterial);

                            const rOffset = Number(conf.offset) || 5;
                            const rHeight = Number(conf.height) || 90;
                            const hSize = Number(conf.handrailSize) || 6;
                            
                            // Determine X offset relative to center of the flight
                            const railX = sideStr === 'left' ? -(width/2 - rOffset) : (width/2 - rOffset);

                            const railGroup = new THREE.Group();
                            railGroup.position.set(startX, 0, startZ);
                            railGroup.rotation.y = rotY;

                            // Draw handrail (Shape X-Y plane mapped)
                            const hShape = new THREE.Shape();
                            const vThick = hSize;
                            hShape.moveTo(0, startH + rHeight);
                            hShape.lineTo(flightLength, endH + rHeight);
                            hShape.lineTo(flightLength, endH + rHeight - vThick);
                            hShape.lineTo(0, startH + rHeight - vThick);
                            hShape.closePath();

                            let extrudeSettings = { depth: hSize, bevelEnabled: false };
                            const hGeo = new THREE.ExtrudeGeometry(hShape, extrudeSettings);
                            const hMesh = new THREE.Mesh(hGeo, rMat);
                            hMesh.rotation.y = -Math.PI / 2;
                            hMesh.position.set(railX + hSize/2, 0, 0);
                            hMesh.castShadow = true; hMesh.receiveShadow = true;
                            railGroup.add(hMesh);

                            if (conf.useGlassPanels) {
                                const gThick = Number(conf.glassThickness) || 1.5;
                                const gShape = new THREE.Shape();
                                // Glass sits between treads and handrail
                                gShape.moveTo(0, startH + 5);
                                gShape.lineTo(flightLength, endH + 5);
                                gShape.lineTo(flightLength, endH + rHeight - hSize - 2);
                                gShape.lineTo(0, startH + rHeight - hSize - 2);
                                gShape.closePath();
                                
                                const gGeo = new THREE.ExtrudeGeometry(gShape, { depth: gThick, bevelEnabled: false });
                                const gMesh = new THREE.Mesh(gGeo, pMat);
                                gMesh.rotation.y = -Math.PI / 2;
                                gMesh.position.set(railX + gThick/2, 0, 0);
                                gMesh.castShadow = true; gMesh.receiveShadow = true;
                                railGroup.add(gMesh);
                            } else if (conf.useCableRails) {
                                const cables = Number(conf.cableCount) || 5;
                                const cDiam = Number(conf.cableDiameter) || 0.8;
                                const span = rHeight - hSize - 10;
                                const gap = span / (cables + 1);
                                
                                for(let k=1; k<=cables; k++) {
                                    const cShape = new THREE.Shape();
                                    const cHeight = 5 + k*gap;
                                    cShape.moveTo(0, startH + cHeight);
                                    cShape.lineTo(flightLength, endH + cHeight);
                                    cShape.lineTo(flightLength, endH + cHeight - cDiam);
                                    cShape.lineTo(0, startH + cHeight - cDiam);
                                    cShape.closePath();
                                    
                                    const cGeo = new THREE.ExtrudeGeometry(cShape, { depth: cDiam, bevelEnabled: false });
                                    const cMesh = new THREE.Mesh(cGeo, cMat);
                                    cMesh.rotation.y = -Math.PI / 2;
                                    cMesh.position.set(railX + cDiam/2, 0, 0);
                                    cMesh.castShadow = true; cMesh.receiveShadow = true;
                                    railGroup.add(cMesh);
                                }
                            } else {
                                // Balusters
                                const bSpacing = Number(conf.balusterSpacing) || 15;
                                const bSize = Number(conf.balusterSize) || 4;
                                const bShape = conf.balusterShape || 'square';
                                const numBalusters = Math.floor(flightLength / bSpacing);
                                
                                const bGeo = bShape === 'round' ? new THREE.CylinderGeometry(bSize/2, bSize/2, 1, 8) : new THREE.BoxGeometry(bSize, 1, bSize);
                                
                                // We'll instanced mesh them or just add meshes
                                for(let k=0; k<=numBalusters; k++) {
                                    const bZ = k * bSpacing;
                                    const t = bZ / flightLength;
                                    const bH = startH * (1 - t) + endH * t;
                                    const balHeight = rHeight - hSize;
                                    
                                    const bm = new THREE.Mesh(bGeo, bMat);
                                    bm.scale.set(1, balHeight, 1);
                                    bm.position.set(railX, bH + balHeight/2, bZ);
                                    bm.castShadow = true; bm.receiveShadow = true;
                                    railGroup.add(bm);
                                }
                            }

                            // Posts
                            if (conf.hasNewelPosts) {
                                const nSize = Number(conf.newelSize) || 8;
                                const nGeo = new THREE.BoxGeometry(nSize, rHeight + 5, nSize);
                                const nMeshStart = new THREE.Mesh(nGeo, bMat);
                                nMeshStart.position.set(railX, startH + (rHeight+5)/2, 0);
                                nMeshStart.castShadow = true; nMeshStart.receiveShadow = true;
                                railGroup.add(nMeshStart);
                                
                                const nMeshEnd = new THREE.Mesh(nGeo, bMat);
                                nMeshEnd.position.set(railX, endH + (rHeight+5)/2, flightLength);
                                nMeshEnd.castShadow = true; nMeshEnd.receiveShadow = true;
                                railGroup.add(nMeshEnd);
                            }

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
                        const landingMesh = new THREE.Mesh(landingGeo, stairMat);
                        landingMesh.position.set(x, topHeight / 2, z);
                        landingMesh.castShadow = true; landingMesh.receiveShadow = true;
                        group.add(landingMesh);
                    } else {
                        const plateThick = 5;
                        const landingGeo = new THREE.BoxGeometry(lw, plateThick, lh);
                        const landingMesh = new THREE.Mesh(landingGeo, stairMat);
                        landingMesh.position.set(x, topHeight - plateThick/2, z);
                        landingMesh.castShadow = true; landingMesh.receiveShadow = true;
                        group.add(landingMesh);
                        
                        const frameGeo = new THREE.BoxGeometry(lw, sThick, lh);
                        const frameMesh = new THREE.Mesh(frameGeo, stairMat);
                        frameMesh.position.set(x, topHeight - plateThick - sThick/2, z);
                        frameMesh.castShadow = true; frameMesh.receiveShadow = true;
                        group.add(frameMesh);
                        
                        if (hasLandingSupports || (isEndLanding && hasColumnSupports)) {
                            const colSize = 10;
                            const colHeight = topHeight - plateThick - sThick;
                            if (colHeight > 0) {
                                const cx = [x - lw/2 + colSize, x + lw/2 - colSize];
                                const cz = [z - lh/2 + colSize, z + lh/2 - colSize];
                                for (let ci of cx) {
                                    for (let cj of cz) {
                                        const colGeo = new THREE.BoxGeometry(colSize, colHeight, colSize);
                                        const colMesh = new THREE.Mesh(colGeo, stairMat);
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

                const startLanding = direction === 'up' ? hasTopLanding : hasBottomLanding;
                const endLanding = direction === 'up' ? hasBottomLanding : hasTopLanding;

                if (shape === 'straight') {
                    const steps = Number(stair.totalSteps) || 12;
                    if (startLanding) addEndLanding(0, -landingSize, width, landingSize, 0, direction === 'up' ? steps : 0);
                    buildFlight(0, 0, 0, steps, 0);
                    if (endLanding) addEndLanding(0, steps * stepDepth, width, landingSize, 0, direction === 'up' ? 0 : steps);
                } else if (shape === 'L') {
                    if (startLanding) addEndLanding(0, -landingSize, width, landingSize, 0, direction === 'up' ? f1Steps + f2Steps : 0);
                    buildFlight(0, 0, 0, f1Steps, f2Steps);
                    
                    const landingElevIdx = direction === 'up' ? f2Steps : f1Steps;
                    buildLanding(0, l1 + landingSize / 2, width, landingSize, landingElevIdx);
                    
                    const f2X = turnDir === 'right' ? width / 2 : -width / 2;
                    const f2Rot = turnDir === 'right' ? Math.PI / 2 : -Math.PI / 2;
                    buildFlight(f2X, l1 + landingSize / 2, f2Rot, f2Steps, direction === 'up' ? 0 : f1Steps);
                    
                    if (endLanding) {
                        const endX = f2X + Math.sin(f2Rot) * l2;
                        const endZ = l1 + landingSize / 2 + Math.cos(f2Rot) * l2;
                        addEndLanding(endX, endZ, width, landingSize, f2Rot, direction === 'up' ? 0 : f1Steps + f2Steps);
                    }
                } else if (shape === 'U') {
                    if (startLanding) addEndLanding(0, -landingSize, width, landingSize, 0, direction === 'up' ? f1Steps + f2Steps : 0);
                    buildFlight(0, 0, 0, f1Steps, f2Steps);
                    
                    const landingElevIdx = direction === 'up' ? f2Steps : f1Steps;
                    const totalW = width * 2 + gapWidth;
                    const landingX = turnDir === 'right' ? width / 2 + gapWidth / 2 : -width / 2 - gapWidth / 2;
                    buildLanding(landingX, l1 + landingSize / 2, totalW, landingSize, landingElevIdx);
                    
                    const f2X = turnDir === 'right' ? width + gapWidth : -width - gapWidth;
                    buildFlight(f2X, l1, Math.PI, f2Steps, direction === 'up' ? 0 : f1Steps);

                    if (endLanding) {
                        const endX = f2X + Math.sin(Math.PI) * l2;
                        const endZ = l1 + Math.cos(Math.PI) * l2;
                        addEndLanding(endX, endZ, width, landingSize, Math.PI, direction === 'up' ? 0 : f1Steps + f2Steps);
                    }
                } else if (shape === 'T') {
                    if (startLanding) addEndLanding(0, -landingSize, width, landingSize, 0, direction === 'up' ? f1Steps + f2Steps : 0);
                    buildFlight(0, 0, 0, f1Steps, f2Steps);
                    
                    const landingElevIdx = direction === 'up' ? f2Steps : f1Steps;
                    const totalW = l2 * 2 + width;
                    buildLanding(0, l1 + landingSize / 2, totalW, landingSize, landingElevIdx);
                    
                    buildFlight(-width / 2, l1 + landingSize / 2, -Math.PI / 2, f2Steps, direction === 'up' ? 0 : f1Steps);
                    buildFlight(width / 2, l1 + landingSize / 2, Math.PI / 2, f2Steps, direction === 'up' ? 0 : f1Steps);

                    if (endLanding) {
                        const lX = -width / 2 + Math.sin(-Math.PI / 2) * l2;
                        const lZ = l1 + landingSize / 2 + Math.cos(-Math.PI / 2) * l2;
                        addEndLanding(lX, lZ, width, landingSize, -Math.PI / 2, direction === 'up' ? 0 : f1Steps + f2Steps);
                        
                        const rX = width / 2 + Math.sin(Math.PI / 2) * l2;
                        const rZ = l1 + landingSize / 2 + Math.cos(Math.PI / 2) * l2;
                        addEndLanding(rX, rZ, width, landingSize, Math.PI / 2, direction === 'up' ? 0 : f1Steps + f2Steps);
                    }
                }
            }

            // Assign user data to be able to identify or select it if needed
            group.userData = { entity: stair, isStair: true };
            if (!isStatic) {
                this.interactables.push(...group.children);
                group.children.forEach(c => c.userData = { entity: stair, isStair: true });
            }

            parentGroup.add(group);
        });
    }
}

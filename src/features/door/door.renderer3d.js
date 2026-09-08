import * as THREE from 'three';
import { DOOR_HEIGHT } from '../../core/constants/units.js';
import { MaterialSlots } from '../../core/constants/materialSlots.js';
import { MaterialManager } from '../../core/engine3d/MaterialManager.js';
import { BIMComponentBuilder } from '../../core/engine3d/BIMComponentBuilder.js';
import {
    createDoorShape,
    createBeveledExtrude,
    rotateUVs as rotateUvs,
    buildDetailedDoorPanel
} from './door.geometry.js';

/**
 * 3D BIM assembly generator for doors.
 * Constructs full door assemblies with frames, stops, gaskets, thresholds, sidelights, transoms,
 * movable panels (swing, double, sliding, pocket, pivot, bi-fold), and hardware.
 * 
 * @param {THREE.Group} sceneGroup - Parent 3D scene / wall container
 * @param {Object} entity - Door entity instance
 * @param {Object} helpers - Material and geometry helpers
 * @returns {THREE.Group} Constructed door 3D assembly group
 */
export function renderDoor3D(sceneGroup, entity, helpers) {
    let baseElev = entity.elevation || 0;
    let height = entity.height || DOOR_HEIGHT;
    let bottomY = baseElev;
    const builder = new BIMComponentBuilder(entity, helpers);
    const doorGroup = builder.group;

    if (entity.localX !== undefined) {
        doorGroup.position.set(entity.localX, bottomY, 0);
        doorGroup.rotation.y = 0;
    } else {
        doorGroup.position.set(entity.x, bottomY, entity.z);
        doorGroup.rotation.y = -entity.angle;
    }

    const isSliding = entity.doorType === 'sliding' || entity.doorType === 'double_sliding' || entity.doorType === 'pocket';
    const fW = 4;
    const fThick = entity.thick + 0.2;

    MaterialManager.initEntityMaterials(entity);
    const matLeafKey = entity.materials?.[MaterialSlots.LEAF]?.id;
    const frameMatKey = entity.materials?.[MaterialSlots.FRAME]?.id;
    const trimMatKey = entity.materials?.[MaterialSlots.TRIM]?.id;

    if (!matLeafKey) console.warn(`Missing required parameter for slot LEAF on door entity ${entity.id}`);
    if (!frameMatKey) console.warn(`Missing required parameter for slot FRAME on door entity ${entity.id}`);

    const matDoor = helpers.getDynamicMaterial(matLeafKey, 'door');
    const matFrame = helpers.getDynamicMaterial(frameMatKey, 'door');
    const matThreshold = helpers.getDynamicMaterial(trimMatKey, 'door');

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 });

    const isGate = Boolean((entity.doorStyle && entity.doorStyle.startsWith('gate_')) || entity.doorType === 'gate');
    const isGlassDoor = matLeafKey === 'glass';
    const jambW = 1.25; const stopW = 1.25; const stopThick = 0.6; const archW = 3.8; const archThick = 1.2;
    const frameWidth = isGate ? 0 : jambW;
    const frameThick = entity.thick + 0.2;
    const doorThick = isGate ? 2.0 : 2.4; // Realistic architectural door slab
    const gapSide = isGate ? 1.0 : 0.12;
    const gapTop = isGate ? 0.5 : 0.12;

    // Threshold — separate optional piece sitting ON the floor (NOT a bottom frame)
    const isPocket = entity.doorType === 'pocket';
    const hasThreshold = !isPocket && !isGate && entity.hasThreshold !== false;
    const tHeight = hasThreshold ? 0.8 : 0;
    const doorClearance = isGate ? 2.0 : 0.35;
    const gapBottom = tHeight + doorClearance;

    if (hasThreshold) {
        const thresholdW = entity.width - jambW * 2;
        const tDepth = frameThick;
        const thresholdGeo = rotateUvs(createBeveledExtrude(thresholdW, tHeight, tDepth, 0.02));
        builder.addNode({ geometry: thresholdGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, position: new THREE.Vector3(0, tHeight / 2, 0), castShadow: true, receiveShadow: true, userData: { isThreshold: true, isFrame: true } });
    }

    if (!isGate) {
        // Sill plate — fills the below-floor gap in the wall cutout
        const sillHeight = 1.0;
        const totalFrameW = entity.width - jambW * 2 + archW * 2;
        const sillGeo = rotateUvs(createBeveledExtrude(totalFrameW, sillHeight, frameThick, 0.01));
        builder.addNode({ geometry: sillGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, position: new THREE.Vector3(0, -sillHeight / 2, 0), receiveShadow: true, userData: { isSillPlate: true, isFrame: true } });
    }

    const slWidth = (entity.hasSidelights && (!entity.doorShape || entity.doorShape === 'square') && !['pocket', 'sliding'].includes(entity.doorType)) ? Math.min(60, entity.width * 0.22) : 0;
    const leafWidth = entity.width - (frameWidth * 2) - (gapSide * 2) - (slWidth * 2);
    const leafHeight = height - frameWidth - gapTop - gapBottom;
    const baseOpenAngle = (entity.openAngle !== undefined ? entity.openAngle : 0) * (Math.PI / 180);
    const openAngle = baseOpenAngle * (entity.facing === 1 ? 1 : -1);
    const pivotXOffset = -entity.width / 2 + frameWidth + slWidth + gapSide / 2;
    const hingePinZ = doorThick / 2;

    // Contact shadow — soft AO shadow on the floor under the door
    let cShadowMat = null;
    try {
        const cShadowCanvas = document.createElement('canvas'); cShadowCanvas.width = 256; cShadowCanvas.height = 64;
        const cShadowCtx = cShadowCanvas.getContext ? cShadowCanvas.getContext('2d') : null;
        if (cShadowCtx) {
            const grad = cShadowCtx.createLinearGradient(0, 0, 0, 64);
            grad.addColorStop(0, 'rgba(0,0,0,0.35)');
            grad.addColorStop(0.3, 'rgba(0,0,0,0.12)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            cShadowCtx.fillStyle = grad; cShadowCtx.fillRect(0, 0, 256, 64);
            const cShadowTex = new THREE.CanvasTexture(cShadowCanvas);
            cShadowMat = new THREE.MeshBasicMaterial({ map: cShadowTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
        }
    } catch (e) {}
    if (!cShadowMat) {
        cShadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.15, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    }
    const cShadowGeo = new THREE.PlaneGeometry(leafWidth + 2, doorThick + 2);
    const contactShadow = builder.addNode({ geometry: cShadowGeo, materialOverride: cShadowMat, parent: doorGroup, isHitbox: false, castShadow: false, receiveShadow: false, userData: { isShadow: true } });
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0, 0.02, 0);

    const shapeType = entity.doorShape || 'square';
    if (!isGate) {
        if (entity.doorType !== 'pocket' || shapeType !== 'square') {
            if (shapeType === 'square') {
                if (entity.doorType !== 'pocket') {
                    // Clean Butt Joints for Jambs (Head Jamb between Side Jambs)
                    const jamHeight = height;
                    const jamY = jamHeight / 2;
                    const jamGeo = createBeveledExtrude(jambW, jamHeight, frameThick, 0.03);
                    const jamL = builder.addNode({ geometry: jamGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true, isJamb: true } });
                    jamL.position.set(-entity.width / 2 + jambW / 2, jamY, 0);
                    const jamR = builder.addNode({ geometry: jamGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true, isJamb: true } });
                    jamR.position.set(entity.width / 2 - jambW / 2, jamY, 0);
                    const jamTGeo = rotateUvs(createBeveledExtrude(entity.width - jambW * 2, jambW, frameThick, 0.03));
                    const jamT = builder.addNode({ geometry: jamTGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true, isHeadJamb: true } });
                    jamT.position.set(0, height - jambW / 2, 0);

                    // Stops (Rebate) & Gasket
                    const swingDir = entity.facing === 1 ? 1 : -1;
                    const stopZ = -swingDir * (doorThick / 2 + stopThick / 2);
                    const stopBottom = tHeight;
                    const stopH = (height - jambW) - stopBottom;
                    const stopY = stopBottom + stopH / 2;
                    const stopGeoV = createBeveledExtrude(stopW, stopH, stopThick, 0.02);
                    const stopL = builder.addNode({ geometry: stopGeoV, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true, isStop: true } });
                    stopL.position.set(-entity.width / 2 + jambW + stopW / 2, stopY, stopZ);
                    const stopR = builder.addNode({ geometry: stopGeoV, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true, isStop: true } });
                    stopR.position.set(entity.width / 2 - jambW - stopW / 2, stopY, stopZ);
                    const stopGeoH = rotateUvs(createBeveledExtrude(entity.width - jambW * 2 - stopW * 2, stopW, stopThick, 0.02));
                    const stopT = builder.addNode({ geometry: stopGeoH, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true, isStop: true } });
                    stopT.position.set(0, height - jambW - stopW / 2, stopZ);

                    const gasketMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
                    const gaskGeo = new THREE.BoxGeometry(0.1, stopH, 0.1);
                    const gaskL = builder.addNode({ geometry: gaskGeo, materialOverride: gasketMat, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
                    gaskL.position.set(-entity.width / 2 + jambW + stopW + 0.05, stopY, doorThick / 2 + 0.05);
                    const gaskR = builder.addNode({ geometry: gaskGeo, materialOverride: gasketMat, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
                    gaskR.position.set(entity.width / 2 - jambW - stopW - 0.05, stopY, doorThick / 2 + 0.05);
                    const gaskGeoH = new THREE.BoxGeometry(entity.width - jambW * 2 - stopW * 2, 0.1, 0.1);
                    const gaskT = builder.addNode({ geometry: gaskGeoH, materialOverride: gasketMat, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
                    gaskT.position.set(0, height - jambW - stopW - 0.05, doorThick / 2 + 0.05);

                    // Architraves & Casing (Header spans across Side Casings)
                    const totalArchW = entity.width - jambW * 2 + archW * 2;
                    const archHeight = height;
                    const archY = archHeight / 2;
                    const archV = createBeveledExtrude(archW, archHeight, archThick, 0.04);
                    const archHgeo = rotateUvs(createBeveledExtrude(totalArchW, archW, archThick, 0.04));
                    const archXLeft = -entity.width / 2 + jambW - archW / 2;
                    const archXRight = entity.width / 2 - jambW + archW / 2;

                    [-frameThick / 2 - archThick / 2, frameThick / 2 + archThick / 2].forEach(zOff => {
                        const tL = builder.addNode({ geometry: archV, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } });
                        tL.position.set(archXLeft, archY, zOff);
                        const tR = builder.addNode({ geometry: archV, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } });
                        tR.position.set(archXRight, archY, zOff);
                        const tT = builder.addNode({ geometry: archHgeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } });
                        tT.position.set(0, height + archW / 2, zOff);
                    });

                    if (slWidth > 0) {
                        const innerJamGeo = createBeveledExtrude(jambW, height - jambW, frameThick);
                        const iJamL = builder.addNode({ geometry: innerJamGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } });
                        iJamL.position.set(-entity.width / 2 + jambW + slWidth - jambW / 2, (height - jambW) / 2, 0);
                        const iJamR = builder.addNode({ geometry: innerJamGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } });
                        iJamR.position.set(entity.width / 2 - jambW - slWidth + jambW / 2, (height - jambW) / 2, 0);

                        const slGlassW = slWidth - jambW;
                        const slBotGeo = createBeveledExtrude(slGlassW, 5, frameThick);
                        const slBotL = builder.addNode({ geometry: slBotGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
                        slBotL.position.set(-entity.width / 2 + jambW + slGlassW / 2, 2.5, 0);
                        const slBotR = builder.addNode({ geometry: slBotGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
                        slBotR.position.set(entity.width / 2 - jambW - slGlassW / 2, 2.5, 0);

                        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_clear';
                        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
                        const slGlassGeo = new THREE.BoxGeometry(slGlassW, height - jambW - 5, 0.4);
                        const glassL = builder.addNode({ geometry: slGlassGeo, materialOverride: glassMat, slot: MaterialSlots.GLASS, parent: doorGroup, userData: { isGlass: true } });
                        glassL.position.set(-entity.width / 2 + jambW + slGlassW / 2, 5 + (height - jambW - 5) / 2, 0);
                        const glassR = builder.addNode({ geometry: slGlassGeo, materialOverride: glassMat, slot: MaterialSlots.GLASS, parent: doorGroup, userData: { isGlass: true } });
                        glassR.position.set(entity.width / 2 - jambW - slGlassW / 2, 5 + (height - jambW - 5) / 2, 0);
                    }
                }
            } else {
                const createArchedFrameShape = (wOuter, hOuter, wInner, hInner, type) => {
                    const shape = new THREE.Shape();
                    const hwO = wOuter / 2;
                    const hwI = wInner / 2;

                    shape.moveTo(-hwO, 0);
                    if (type === 'radius' || type === 'arch') {
                        const strHO = Math.max(0, hOuter - hwO);
                        shape.lineTo(-hwO, strHO);
                        if (hwO > 0) shape.absarc(0, strHO, hwO, Math.PI, 0, true);
                    } else if (type === 'segment') {
                        const riseO = wOuter * 0.15;
                        const strHO = Math.max(0, hOuter - riseO);
                        shape.lineTo(-hwO, strHO);
                        shape.quadraticCurveTo(0, hOuter + riseO * 0.5, hwO, strHO);
                    } else if (type === 'gothic') {
                        const strHO = Math.max(0, hOuter - (wOuter * 0.7));
                        shape.lineTo(-hwO, strHO);
                        shape.quadraticCurveTo(-hwO * 0.2, hOuter, 0, hOuter);
                        shape.quadraticCurveTo(hwO * 0.2, hOuter, hwO, strHO);
                    }

                    shape.lineTo(hwO, 0);
                    shape.lineTo(hwI, 0);

                    if (type === 'radius' || type === 'arch') {
                        const strHI = Math.max(0, hInner - hwI);
                        shape.lineTo(hwI, strHI);
                        if (hwI > 0) shape.absarc(0, strHI, hwI, 0, Math.PI, false);
                    } else if (type === 'segment') {
                        const riseI = wInner * 0.15;
                        const strHI = Math.max(0, hInner - riseI);
                        shape.lineTo(hwI, strHI);
                        shape.quadraticCurveTo(0, hInner + riseI * 0.5, -hwI, strHI);
                    } else if (type === 'gothic') {
                        const strHI = Math.max(0, hInner - (wInner * 0.7));
                        shape.lineTo(hwI, strHI);
                        shape.quadraticCurveTo(hwI * 0.2, hInner, 0, hInner);
                        shape.quadraticCurveTo(-hwI * 0.2, hInner, -hwI, strHI);
                    }

                    shape.lineTo(-hwI, 0);
                    shape.lineTo(-hwO, 0);
                    return shape;
                };

                const normalizeArchedFrameUVs = (geo, w, h, depth) => {
                    const uvs = geo.attributes.uv;
                    const pos = geo.attributes.position;
                    const norm = geo.attributes.normal;
                    if (!uvs || !pos) return geo;
                    const hw = w / 2;
                    const totalH = h;
                    const d = depth || 15;
                    for (let i = 0; i < uvs.count; i++) {
                        const vx = pos.getX(i);
                        const vy = pos.getY(i);
                        const vz = pos.getZ(i);
                        const nz = norm ? norm.getZ(i) : 1;
                        if (Math.abs(nz) > 0.5) {
                            uvs.setXY(i, (vx + hw) / w, vy / totalH);
                        } else {
                            uvs.setXY(i, (vz + d / 2) / d, vy / totalH);
                        }
                    }
                    uvs.needsUpdate = true;
                    return geo;
                };

                const frameShape = createArchedFrameShape(entity.width, height, entity.width - (frameWidth * 2), height - frameWidth, shapeType);
                const jamGeo = new THREE.ExtrudeGeometry(frameShape, { depth: frameThick, bevelEnabled: false });
                jamGeo.translate(0, 0, -frameThick / 2);
                normalizeArchedFrameUVs(jamGeo, entity.width, height, frameThick);
                const jam = builder.addNode({ geometry: jamGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } });
                jam.position.set(0, 0, 0);

                [-frameThick / 2 - 0.25, frameThick / 2 + 0.25].forEach(zOff => {
                    const trimShape = createArchedFrameShape(entity.width + 8, height + 4, entity.width - (frameWidth * 2), height - frameWidth, shapeType);
                    const trimGeo = new THREE.ExtrudeGeometry(trimShape, { depth: 0.5, bevelEnabled: false });
                    trimGeo.translate(0, 0, -0.25);
                    normalizeArchedFrameUVs(trimGeo, entity.width + 8, height + 4, 0.5);
                    const trim = builder.addNode({ geometry: trimGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } });
                    trim.position.set(0, 0, zOff);
                });
            }
        }
    } else {
        // Compound Gates have NO door frame; instead they use heavy wall mounting clamps & pintles
        const clampMat = helpers.getDynamicMaterial(frameMatKey || 'metal_dark_steel', 'door');
        const clampMatMetal = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.25 });
        const isDoubleGate = ['double', 'french'].includes(entity.doorType);
        const isSlidingGate = entity.doorType === 'sliding' || entity.doorType === 'double_sliding' || entity.doorStyle === 'gate_driveway_sliding';

        if (isSlidingGate) {
            const rollerBracketGeo = createBeveledExtrude(4, 5, 2.5, 0.05);
            const rollerWheelGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.0, 16);
            rollerWheelGeo.rotateX(Math.PI / 2);

            [-entity.width / 2 + 1, entity.width / 2 - 1].forEach(gx => {
                builder.addNode({ geometry: rollerBracketGeo, materialOverride: clampMat, slot: MaterialSlots.FRAME, parent: doorGroup, position: new THREE.Vector3(gx, height - 3, 0), castShadow: true, receiveShadow: true, userData: { isFrame: true } });
                builder.addNode({ geometry: rollerWheelGeo, materialOverride: clampMatMetal, slot: MaterialSlots.HARDWARE, parent: doorGroup, position: new THREE.Vector3(gx, height - 3, doorThick / 2 + 1.2), castShadow: true, userData: { isHandle: true } });
                builder.addNode({ geometry: rollerWheelGeo, materialOverride: clampMatMetal, slot: MaterialSlots.HARDWARE, parent: doorGroup, position: new THREE.Vector3(gx, height - 3, -doorThick / 2 - 1.2), castShadow: true, userData: { isHandle: true } });
            });
            const catchGeo = createBeveledExtrude(3.5, 12, 4, 0.05);
            builder.addNode({ geometry: catchGeo, materialOverride: clampMat, slot: MaterialSlots.FRAME, parent: doorGroup, position: new THREE.Vector3(entity.width / 2 - 1.5, 6, 0), castShadow: true, receiveShadow: true, userData: { isFrame: true } });
        } else {
            const clampH = 6; const clampW = 3.5; const clampThick = 1.0;
            const hingePinRadius = 0.55; const hingePinH = 5.5;
            const clampFlangeGeo = createBeveledExtrude(clampW, clampH, clampThick, 0.04);
            const pintleGeo = new THREE.CylinderGeometry(hingePinRadius, hingePinRadius, hingePinH, 16);
            const strapClampGeo = createBeveledExtrude(4.0, 2.2, doorThick + 0.6, 0.04);
            const boltGeo = new THREE.CylinderGeometry(0.25, 0.25, doorThick + 1.2, 12);
            boltGeo.rotateX(Math.PI / 2);

            const clampHeights = height > 160 ? [height * 0.18, height * 0.5, height * 0.82] : [height * 0.25, height * 0.75];

            const renderClampSide = (sign) => {
                const wallEdgeX = (entity.width / 2 - clampW / 2) * sign;
                const pinX = (entity.width / 2 - clampW - hingePinRadius) * sign;
                const strapX = (entity.width / 2 - clampW - hingePinRadius - 1.5) * sign;

                clampHeights.forEach(cy => {
                    builder.addNode({ geometry: clampFlangeGeo, materialOverride: clampMat, slot: MaterialSlots.FRAME, parent: doorGroup, position: new THREE.Vector3(wallEdgeX, cy, 0), castShadow: true, receiveShadow: true, userData: { isFrame: true } });
                    builder.addNode({ geometry: pintleGeo, materialOverride: clampMatMetal, slot: MaterialSlots.HARDWARE, parent: doorGroup, position: new THREE.Vector3(pinX, cy, 0), castShadow: true, userData: { isHandle: true } });
                    builder.addNode({ geometry: strapClampGeo, materialOverride: clampMat, slot: MaterialSlots.FRAME, parent: doorGroup, position: new THREE.Vector3(strapX, cy, 0), castShadow: true, receiveShadow: true, userData: { isFrame: true } });
                    builder.addNode({ geometry: boltGeo, materialOverride: clampMatMetal, slot: MaterialSlots.HARDWARE, parent: doorGroup, position: new THREE.Vector3(strapX, cy, 0), castShadow: true, userData: { isHandle: true } });
                });
            };

            if (isDoubleGate) {
                renderClampSide(-1);
                renderClampSide(1);

                const dropStopGeo = createBeveledExtrude(3.0, 1.2, 5.0, 0.04);
                builder.addNode({ geometry: dropStopGeo, materialOverride: clampMatMetal, slot: MaterialSlots.HARDWARE, parent: doorGroup, position: new THREE.Vector3(0, 0.6, 0), castShadow: true, userData: { isHandle: true } });
            } else {
                const hingeSign = entity.side === 1 ? 1 : -1;
                renderClampSide(hingeSign);

                const strikeClampSign = -hingeSign;
                const strikeX = (entity.width / 2 - clampW / 2) * strikeClampSign;
                const strikePlateGeo = createBeveledExtrude(clampW, 14, clampThick, 0.04);
                const strikeCatchGeo = createBeveledExtrude(2.5, 6, 2.5, 0.04);
                builder.addNode({ geometry: strikePlateGeo, materialOverride: clampMat, slot: MaterialSlots.FRAME, parent: doorGroup, position: new THREE.Vector3(strikeX, height * 0.45, 0), castShadow: true, receiveShadow: true, userData: { isFrame: true } });
                builder.addNode({ geometry: strikeCatchGeo, materialOverride: clampMatMetal, slot: MaterialSlots.HARDWARE, parent: doorGroup, position: new THREE.Vector3(strikeX - 1.2 * strikeClampSign, height * 0.45, 0), castShadow: true, userData: { isHandle: true } });
            }
        }
    }

    const isArched = (shapeType !== 'square');
    const panelZOffset = isArched ? 0 : -hingePinZ;

    if (entity.doorType === 'single' || !entity.doorType) {
        const hingeHolder = new THREE.Group();
        if (entity.side === 1) {
            const panel = buildDetailedDoorPanel(entity, leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers, builder);
            hingeHolder.position.set(-(pivotXOffset + gapSide / 2), gapBottom, hingePinZ);
            panel.position.set(-leafWidth / 2, 0, panelZOffset);
            hingeHolder.rotation.y = -openAngle;
            hingeHolder.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: -(entity.facing === 1 ? 1 : -1) };
            hingeHolder.add(panel);
        } else {
            const panel = buildDetailedDoorPanel(entity, leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers, builder);
            hingeHolder.position.set(pivotXOffset + gapSide / 2, gapBottom, hingePinZ);
            panel.position.set(leafWidth / 2, 0, panelZOffset);
            hingeHolder.rotation.y = openAngle;
            hingeHolder.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: (entity.facing === 1 ? 1 : -1) };
            hingeHolder.add(panel);
        }
        doorGroup.add(hingeHolder);
    } else if (entity.doorType === 'double' || entity.doorType === 'french') {
        const hw = leafWidth / 2 - gapSide / 2;
        const hL = new THREE.Group(); hL.position.set(pivotXOffset + gapSide / 2, gapBottom, hingePinZ); hL.rotation.y = openAngle;
        hL.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: (entity.facing === 1 ? 1 : -1) };
        const panelL = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers, builder);
        panelL.position.set(hw / 2, 0, panelZOffset); hL.add(panelL);

        const hR = new THREE.Group(); hR.position.set(-(pivotXOffset + gapSide / 2), gapBottom, hingePinZ); hR.rotation.y = -openAngle;
        hR.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: -(entity.facing === 1 ? 1 : -1) };
        const panelR = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers, builder);
        panelR.position.set(-hw / 2, 0, panelZOffset); hR.add(panelR);

        const isLeftActive = entity.side === -1;
        const inactivePanel = isLeftActive ? panelR : panelL;

        if (shapeType === 'square') {
            const astragalW = 1.0; const astragalThick = 0.5;
            const astragalGeo = createBeveledExtrude(astragalW, leafHeight, astragalThick, 0.04);
            const astragal = builder.addNode({ geometry: astragalGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: inactivePanel, castShadow: true, userData: { isFrame: true } });
            const astX = isLeftActive ? -hw / 2 : hw / 2;
            astragal.position.set(astX, leafHeight / 2, doorThick / 2 + astragalThick / 2);
        }

        doorGroup.add(hL, hR);
    } else if (entity.doorType === 'sliding' || entity.doorType === 'double_sliding') {
        const trackMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.5 });
        const trackW = doorThick * 2.5;
        const trackGeo = new THREE.BoxGeometry(leafWidth, 0.5, trackW);
        if (shapeType === 'square') {
            const trackT = builder.addNode({ geometry: trackGeo, materialOverride: trackMat, slot: MaterialSlots.HARDWARE, parent: doorGroup });
            trackT.position.set(0, height - frameWidth - 0.25, 0);
        }
        const trackB = builder.addNode({ geometry: trackGeo, materialOverride: trackMat, slot: MaterialSlots.HARDWARE, parent: doorGroup });
        trackB.position.set(0, gapBottom - 0.25, 0);
        const overlap = 2;
        if (entity.doorType === 'sliding') {
            const hw = (leafWidth / 2) + (overlap / 2);
            const maxSlide = hw - overlap;
            const openPercent = entity.openAngle !== undefined ? entity.openAngle / 180 : 0;
            const slideAmount = maxSlide * openPercent;

            const pFixed = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers, builder);
            pFixed.position.set(-hw / 2 + overlap / 2, gapBottom, isArched ? 0 : (-doorThick / 2 - 0.1));
            doorGroup.add(pFixed);

            const pSlide = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers, builder);
            pSlide.position.set(hw / 2 - overlap / 2 - slideAmount, gapBottom, isArched ? 0 : (doorThick / 2 + 0.1));
            pSlide.userData = { isMovingPart: true, motionType: 'slide', baseX: hw / 2 - overlap / 2, maxSlide: -maxSlide };
            doorGroup.add(pSlide);
        } else {
            const hw = (leafWidth / 4) + (overlap / 2);
            const maxSlide = hw - overlap;
            const openPercent = entity.openAngle !== undefined ? entity.openAngle / 180 : 0;
            const slideAmount = maxSlide * openPercent;

            const pFixL = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers, builder);
            pFixL.position.set(-leafWidth / 2 + hw / 2, gapBottom, isArched ? 0 : (-doorThick / 2 - 0.1));
            const pFixR = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers, builder);
            pFixR.position.set(leafWidth / 2 - hw / 2, gapBottom, isArched ? 0 : (-doorThick / 2 - 0.1));

            const pSlideL = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers, builder);
            pSlideL.position.set(-leafWidth / 4 + overlap / 2 + slideAmount, gapBottom, isArched ? 0 : (doorThick / 2 + 0.1));
            pSlideL.userData = { isMovingPart: true, motionType: 'slide', baseX: -leafWidth / 4 + overlap / 2, maxSlide: -(hw - overlap) };

            const pSlideR = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers, builder);
            pSlideR.position.set(leafWidth / 4 - overlap / 2 - slideAmount, gapBottom, isArched ? 0 : (doorThick / 2 + 0.1));
            pSlideR.userData = { isMovingPart: true, motionType: 'slide', baseX: leafWidth / 4 - overlap / 2, maxSlide: (hw - overlap) };

            doorGroup.add(pFixL, pFixR, pSlideL, pSlideR);
        }
    } else if (entity.doorType === 'pocket') {
        const passageW = entity.width;
        const pocketDoorThick = 1.75;
        const widthBetweenJambs = passageW - frameWidth * 2;
        const overlap = 1.0;
        const pLeafW = widthBetweenJambs + overlap;
        const pLeafH = height - frameWidth - gapTop - gapBottom;
        const slideDir = entity.facing === 1 ? 1 : -1;

        const strikeX = -slideDir * (passageW / 2 - frameWidth / 2);
        const pocketX = slideDir * (passageW / 2 - frameWidth / 2);

        if (shapeType === 'square') {
            const jamGeoStrike = createBeveledExtrude(frameWidth, height + bottomY, frameThick);
            const jamStrike = builder.addNode({ geometry: jamGeoStrike, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
            jamStrike.position.set(strikeX, (height + bottomY) / 2 - bottomY, 0);

            const splitJambThick = (frameThick - pocketDoorThick - 0.24) / 2;
            const splitGeo = createBeveledExtrude(frameWidth, height + bottomY, splitJambThick);
            const jamR_front = builder.addNode({ geometry: splitGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
            jamR_front.position.set(pocketX, (height + bottomY) / 2 - bottomY, frameThick / 2 - splitJambThick / 2);
            const jamR_back = builder.addNode({ geometry: splitGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
            jamR_back.position.set(pocketX, (height + bottomY) / 2 - bottomY, -frameThick / 2 + splitJambThick / 2);

            const headGeo = rotateUvs(createBeveledExtrude(passageW - frameWidth * 2, frameWidth, frameThick));
            const head = builder.addNode({ geometry: headGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
            head.position.set(0, height - frameWidth / 2, 0);
        }

        const pocketShadowCanvas = document.createElement('canvas'); pocketShadowCanvas.width = 32; pocketShadowCanvas.height = 256;
        const pCtx = pocketShadowCanvas.getContext('2d');
        if (pCtx) {
            const grad = pCtx.createLinearGradient(0, 0, 32, 0);
            grad.addColorStop(slideDir === 1 ? 0 : 1, 'rgba(0,0,0,0.6)'); grad.addColorStop(slideDir === 1 ? 1 : 0, 'rgba(0,0,0,0)');
            pCtx.fillStyle = grad; pCtx.fillRect(0, 0, 32, 256);
        }
        const pTex = new THREE.CanvasTexture(pocketShadowCanvas);
        const pShadowPlane = builder.addNode({ geometry: new THREE.PlaneGeometry(8, height), materialOverride: new THREE.MeshBasicMaterial({ map: pTex, transparent: true, depthWrite: false }), parent: doorGroup, castShadow: false, receiveShadow: false, isHitbox: false, userData: { isShadow: true } });
        pShadowPlane.position.set(pocketX + (slideDir * 3), height / 2, 0);

        const strikeInnerX = -slideDir * (passageW / 2 - frameWidth);
        const p = buildDetailedDoorPanel(entity, pLeafW, pLeafH, pocketDoorThick, matDoor, entity.doorType, isGlassDoor, 0, helpers, builder);
        const openPercent = entity.openAngle !== undefined ? entity.openAngle / 180 : 0;
        const baseX = strikeInnerX + slideDir * (pLeafW / 2);
        const maxSlide = slideDir * widthBetweenJambs;

        p.position.set(baseX + maxSlide * openPercent, gapBottom, 0);
        p.userData = { isMovingPart: true, motionType: 'slide', baseX: baseX, maxSlide: maxSlide };
        doorGroup.add(p);
    } else if (entity.doorType === 'pivot') {
        const p = buildDetailedDoorPanel(entity, leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers, builder);
        const off = leafWidth * 0.15;
        p.position.set(leafWidth / 2 - off, gapBottom, 0);
        const pivot = new THREE.Group();
        const signX = entity.side === 1 ? 1 : -1;
        pivot.position.set(pivotXOffset + off, 0, 0);
        pivot.rotation.y = -openAngle * signX;
        pivot.add(p);
        pivot.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: -signX * (entity.facing === 1 ? 1 : -1) };
        doorGroup.add(pivot);

        const plateGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16);
        const floorPlate = builder.addNode({ geometry: plateGeo, materialOverride: metalMat, slot: MaterialSlots.HARDWARE, parent: doorGroup });
        floorPlate.position.set(pivotXOffset + off, 0.2, 0);
        const topPlate = builder.addNode({ geometry: plateGeo, materialOverride: metalMat, slot: MaterialSlots.HARDWARE, parent: doorGroup });
        topPlate.position.set(pivotXOffset + off, height - 0.2, 0);
    } else if (entity.doorType === 'folding') {
        const numPanels = 2;
        if (shapeType === 'square') {
            const trackGeo = new THREE.BoxGeometry(entity.width - frameWidth * 2, 1.5, doorThick + 1);
            const track = builder.addNode({ geometry: trackGeo, materialOverride: metalMat, slot: MaterialSlots.HARDWARE, parent: doorGroup });
            track.position.set(0, height - frameWidth / 2 - 0.75, 0);
        }
        const panelW = (leafWidth - (gapSide * (numPanels - 1))) / numPanels;
        const swingDir = entity.facing === 1 ? 1 : -1;
        const isRightHinge = entity.side === 1;
        const signX = isRightHinge ? 1 : -1;

        const pivot1 = new THREE.Group();
        pivot1.position.set(pivotXOffset * -signX, gapBottom, isArched ? 0 : hingePinZ);
        pivot1.rotation.y = baseOpenAngle * (entity.facing === 1 ? 1 : -1);
        pivot1.userData = { isMovingPart: true, motionType: 'bifold_main', motionSign: (entity.facing === 1 ? 1 : -1) };
        doorGroup.add(pivot1);

        const p1SignX = isRightHinge ? -1 : 1;
        const p1 = buildDetailedDoorPanel(entity, panelW, leafHeight, doorThick, matDoor, 'folding_main', isGlassDoor, p1SignX, helpers, builder);
        p1.position.set((panelW / 2 + gapSide / 2) * -signX, 0, isArched ? 0 : (-hingePinZ * swingDir));
        pivot1.add(p1);

        const pivot2 = new THREE.Group();
        pivot2.position.set((panelW + gapSide) * -signX, 0, 0);
        pivot2.rotation.y = -baseOpenAngle * 2 * (entity.facing === 1 ? 1 : -1);
        pivot2.userData = { isMovingPart: true, motionType: 'bifold_lead', motionSign: -2 * (entity.facing === 1 ? 1 : -1) };
        pivot1.add(pivot2);

        const p2SignX = isRightHinge ? 1 : -1;
        const p2 = buildDetailedDoorPanel(entity, panelW, leafHeight, doorThick, matDoor, 'folding_lead', isGlassDoor, p2SignX, helpers, builder);
        p2.position.set((panelW / 2 + gapSide / 2) * -signX, 0, 0);
        pivot2.add(p2);

        const jointHingeGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 12);
        [leafHeight * 0.85, leafHeight * 0.5, leafHeight * 0.15].forEach(yPos => {
            const hingeMesh = builder.addNode({ geometry: jointHingeGeo, materialOverride: metalMat, slot: MaterialSlots.HARDWARE, parent: pivot2 });
            hingeMesh.position.set(0, yPos, (doorThick / 2 + 0.1) * swingDir);
        });
        const guidePin = builder.addNode({ geometry: new THREE.CylinderGeometry(0.4, 0.4, 3, 8), materialOverride: metalMat, slot: MaterialSlots.HARDWARE, parent: p2 });
        guidePin.position.set((panelW - 2) * -signX, leafHeight, 0);
        pivot2.add(guidePin);
    }

    const hitboxGeo = new THREE.BoxGeometry(entity.width + 10, height + 10, (entity.thick || 20) + 10);
    const hitbox = builder.addNode({ geometry: hitboxGeo, materialOverride: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), parent: doorGroup, isHitbox: true, castShadow: false, receiveShadow: false });
    hitbox.position.set(0, height / 2, 0);
    doorGroup.userData = { isWidget: true, entity: entity };

    const finalGroup = builder.build();
    sceneGroup.add(finalGroup);
    return finalGroup;
}

import * as THREE from 'three';
import { WINDOW_SILL, WINDOW_HEIGHT } from '../../core/constants/units.js';
import { MaterialSlots, ComponentTypes } from '../../core/constants/materialSlots.js';
import { MaterialManager } from '../../core/engine3d/MaterialManager.js';
import { BIMComponentBuilder } from '../../core/engine3d/BIMComponentBuilder.js';
import { WINDOW_TYPES } from './window.registry.js';
import {
    createBeveledRect,
    rotateUVs,
    createMiterRailTopGeo,
    createMiterRailBotGeo,
    createMiterStileLeftGeo,
    createMiterStileRightGeo,
    createThinBarGeo
} from './window.geometry.js';

/**
 * 3D BIM assembly generator for windows.
 * Constructs full window assemblies with mitered outer frames, sliding / casement sashes,
 * glass panes, glazing beads, rubber seals, cremone lock rods, security grilles, sills, and bay enclosures.
 * 
 * @param {THREE.Group} sceneGroup - Parent 3D scene / wall container
 * @param {Object} entity - Window entity instance
 * @param {Object} helpers - Material and geometry helpers
 * @returns {THREE.Group} Constructed window 3D assembly group
 */
export function renderWindow3D(sceneGroup, entity, helpers) {
    let baseElev = entity.elevation !== undefined ? entity.elevation : WINDOW_SILL;
    let rawHeight = entity.height !== undefined ? entity.height : WINDOW_HEIGHT;
    let bottomY = Math.max(0.2, baseElev);
    let topY = baseElev + rawHeight;
    let height = topY - bottomY;
    const builder = new BIMComponentBuilder(entity, helpers);
    const winGroup = builder.group;

    if (entity.localX !== undefined) {
        winGroup.position.set(entity.localX, bottomY, 0);
        winGroup.rotation.y = 0;
    } else {
        winGroup.position.set(entity.x, bottomY, entity.z);
        winGroup.rotation.y = -entity.angle;
    }

    const wConf = WINDOW_TYPES[entity.windowType] || WINDOW_TYPES.sliding_std;
    MaterialManager.initEntityMaterials(entity);
    const frameMatKey = entity.materials?.[MaterialSlots.FRAME]?.id;
    const sashMatKey = entity.materials?.[MaterialSlots.LEAF]?.id;
    const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';

    if (!frameMatKey) console.warn(`Missing required parameter for slot FRAME on window entity ${entity.id}`);
    if (!sashMatKey) console.warn(`Missing required parameter for slot LEAF on window entity ${entity.id}`);

    const matFrame = helpers.getDynamicMaterial(frameMatKey, 'window_frame');
    const matSash = helpers.getDynamicMaterial(sashMatKey, 'window_sash');
    const matGlass = helpers.getDynamicMaterial(glassMatKey, 'window_glass');
    if (matGlass) matGlass.envMapIntensity = 2.5;

    const isTrad = wConf.type === 'traditional';
    const isBay = wConf.type === 'bay';
    const wallThickness = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || entity.thick || 20) : (entity.thick || 20);
    const fW = isTrad ? 3.5 : 1.8;
    const fThick = isTrad ? wallThickness + 2 : wallThickness + 0.5;
    const zOffset = isBay ? 12 : 0;

    const hwMatKey = entity.materials?.[MaterialSlots.HARDWARE]?.id;
    const sealMatKey = entity.materials?.[MaterialSlots.SEAL]?.id;
    const grilleMatKey = entity.materials?.[MaterialSlots.GRILLE]?.id;

    if (!hwMatKey) console.warn(`Missing required parameter for slot HARDWARE on window entity ${entity.id}`);
    if (!sealMatKey) console.warn(`Missing required parameter for slot SEAL on window entity ${entity.id}`);
    if (!grilleMatKey && entity.grillePattern && entity.grillePattern !== 'none') console.warn(`Missing required parameter for slot GRILLE on window entity ${entity.id}`);

    const matMetalHardware = helpers.getDynamicMaterial(hwMatKey, 'hardware');
    const matRubberSeal = helpers.getDynamicMaterial(sealMatKey, 'seal');
    const matGrille = helpers.getDynamicMaterial(grilleMatKey, 'window');

    const matsFrameRaw = (helpers && helpers.getFaceMaterials) ? helpers.getFaceMaterials(entity, matFrame, { width: entity.width, height: height, thick: fThick }).box : matFrame;
    const matsExtrude = Array.isArray(matsFrameRaw) ? [matsFrameRaw[4] || matsFrameRaw[0], matsFrameRaw[1] || matsFrameRaw[0]] : matsFrameRaw;

    const matsSashRaw = (helpers && helpers.getFaceMaterials) ? helpers.getFaceMaterials(entity, matSash, { width: entity.width, height: height, thick: fThick }).box : matSash;
    const matsExtrudeSash = Array.isArray(matsSashRaw) ? [matsSashRaw[4] || matsSashRaw[0], matsSashRaw[1] || matsSashRaw[0]] : matsSashRaw;

    // --- 1. Outer Architectural Frame Assembly (45° Miter Joints, Tracks, Runner Rails & Drainage) ---
    const buildOuterFrame = (totalW, totalH) => {
        const frameGroup = new THREE.Group();

        const geoRailT = createMiterRailTopGeo(totalW, fW, fThick);
        const geoRailB = createMiterRailBotGeo(totalW, fW, fThick);
        const geoStileL = createMiterStileLeftGeo(totalH, fW, fThick);
        const geoStileR = createMiterStileRightGeo(totalH, fW, fThick);

        builder.addNode({ geometry: geoStileL, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [-totalW / 2 + fW / 2, totalH / 2, 0], userData: { isFrame: true }, castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStileR, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [totalW / 2 - fW / 2, totalH / 2, 0], userData: { isFrame: true }, castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [0, totalH - fW / 2, 0], userData: { isFrame: true }, castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [0, fW / 2, 0], userData: { isFrame: true }, castShadow: true, receiveShadow: true });

        // Stepped Sash Seating Rebate (Decorative inner step)
        const rebateW = 0.5, rebateD = fThick * 0.15;
        const geoRebateV = createBeveledRect(rebateW, totalH - fW * 2, rebateD, 0.08, 0.08);
        const geoRebateH = rotateUVs(createBeveledRect(totalW - fW * 2, rebateW, rebateD, 0.08, 0.08));

        builder.addNode({ geometry: geoRebateV, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [-totalW / 2 + fW + rebateW / 2, totalH / 2, fThick / 2 - rebateD / 2], userData: { isFrame: true }, castShadow: true });
        builder.addNode({ geometry: geoRebateV, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [totalW / 2 - fW - rebateW / 2, totalH / 2, fThick / 2 - rebateD / 2], userData: { isFrame: true }, castShadow: true });
        builder.addNode({ geometry: geoRebateH, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [0, totalH - fW - rebateW / 2, fThick / 2 - rebateD / 2], userData: { isFrame: true }, castShadow: true });
        builder.addNode({ geometry: geoRebateH, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [0, fW + rebateW / 2, fThick / 2 - rebateD / 2], userData: { isFrame: true }, castShadow: true });

        const sThickLocal = entity.thick * 0.35;
        const headerTrackGeo = new THREE.BoxGeometry(totalW - fW * 2, 0.5, sThickLocal * 2.2);
        builder.addNode({ geometry: headerTrackGeo, materialOverride: matMetalHardware, parent: frameGroup, slot: MaterialSlots.HARDWARE, position: [0, totalH - fW - 0.25, 0], userData: { isHandle: true }, paintable: false });

        frameGroup.position.set(0, 0, zOffset);
        return frameGroup;
    };

    winGroup.add(buildOuterFrame(entity.width, height));

    const iW = entity.width - fW * 2;
    const iH = height - fW * 2;
    const sThick = 1.35;

    // --- 2. Window Sash Assembly (45° Miter Joints, Rollers, Interlockers, Beads, Glass & Hardware) ---
    const makeSash = (w, h, useGlass = true, isCasement = false, hingeSide = 1, slotName = MaterialSlots.LEAF) => {
        const sG = new THREE.Group();
        const shadowGap = 0.2;
        const sashW = w - shadowGap * 2;
        const sashH = h - shadowGap * 2;
        const sFw = isTrad ? 2.2 : 1.25;

        const geoStileL = createMiterStileLeftGeo(sashH, sFw, sThick);
        const geoStileR = createMiterStileRightGeo(sashH, sFw, sThick);
        const geoRailT = createMiterRailTopGeo(sashW, sFw, sThick);
        const geoRailB = createMiterRailBotGeo(sashW, sFw, sThick);

        const sashCompId = `${entity.id}_${slotName}`;
        builder.addNode({ geometry: geoStileL, materialOverride: matsExtrudeSash, parent: sG, slot: slotName, position: [-sashW / 2 + sFw / 2, sashH / 2, 0], userData: { isFrame: true, componentId: sashCompId, componentType: ComponentTypes.SASH }, castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStileR, materialOverride: matsExtrudeSash, parent: sG, slot: slotName, position: [sashW / 2 - sFw / 2, sashH / 2, 0], userData: { isFrame: true, componentId: sashCompId, componentType: ComponentTypes.SASH }, castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrudeSash, parent: sG, slot: slotName, position: [0, sashH - sFw / 2, 0], userData: { isFrame: true, componentId: sashCompId, componentType: ComponentTypes.SASH }, castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrudeSash, parent: sG, slot: slotName, position: [0, sFw / 2, 0], userData: { isFrame: true, componentId: sashCompId, componentType: ComponentTypes.SASH }, castShadow: true, receiveShadow: true });

        [ -sashW * 0.35, sashW * 0.35 ].forEach(xWheel => {
            const rollerGroup = new THREE.Group();
            rollerGroup.position.set(xWheel, 0, 0);
            sG.add(rollerGroup);

            builder.addNode({ geometry: new THREE.BoxGeometry(1.0, 0.5, sThick * 0.8), materialOverride: matMetalHardware, parent: rollerGroup, slot: MaterialSlots.HARDWARE, position: [0, -0.25, 0], userData: { isHandle: true }, paintable: false });
            const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 16);
            wheelGeo.rotateZ(Math.PI / 2);
            builder.addNode({ geometry: wheelGeo, materialOverride: matMetalHardware, parent: rollerGroup, slot: MaterialSlots.HARDWARE, position: [0, -0.45, 0], userData: { isHandle: true }, paintable: false });
            const axleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
            builder.addNode({ geometry: axleGeo, materialOverride: matMetalHardware, parent: rollerGroup, slot: MaterialSlots.HARDWARE, position: [0, -0.45, 0], rotation: [Math.PI / 2, 0, 0], userData: { isHandle: true }, paintable: false });
        });

        const cutoutW = sashW - sFw * 2;
        const cutoutH = sashH - sFw * 2;

        if (useGlass) {
            const beadW = 0.35, beadDepth = sThick * 0.4;
            const bGeoStileL = createMiterStileLeftGeo(cutoutH + beadW * 2, beadW, beadDepth, 0.06, 0.06);
            const bGeoStileR = createMiterStileRightGeo(cutoutH + beadW * 2, beadW, beadDepth, 0.06, 0.06);
            const bGeoRailT = createMiterRailTopGeo(cutoutW + beadW * 2, beadW, beadDepth, 0.06, 0.06);
            const bGeoRailB = createMiterRailBotGeo(cutoutW + beadW * 2, beadW, beadDepth, 0.06, 0.06);

            builder.addNode({ geometry: bGeoStileL, materialOverride: matsExtrudeSash, parent: sG, slot: slotName, position: [-cutoutW / 2 + beadW / 2, sashH / 2, 0], userData: { isFrame: true, componentId: sashCompId, componentType: ComponentTypes.SASH }, castShadow: true });
            builder.addNode({ geometry: bGeoStileR, materialOverride: matsExtrudeSash, parent: sG, slot: slotName, position: [cutoutW / 2 - beadW / 2, sashH / 2, 0], userData: { isFrame: true, componentId: sashCompId, componentType: ComponentTypes.SASH }, castShadow: true });
            builder.addNode({ geometry: bGeoRailT, materialOverride: matsExtrudeSash, parent: sG, slot: slotName, position: [0, sashH - sFw - beadW / 2, 0], userData: { isFrame: true, componentId: sashCompId, componentType: ComponentTypes.SASH }, castShadow: true });
            builder.addNode({ geometry: bGeoRailB, materialOverride: matsExtrudeSash, parent: sG, slot: slotName, position: [0, sFw + beadW / 2, 0], userData: { isFrame: true, componentId: sashCompId, componentType: ComponentTypes.SASH }, castShadow: true });

            const sealW = 0.15;
            const geoSealV = new THREE.BoxGeometry(sealW, cutoutH, sThick * 0.3);
            const geoSealH = new THREE.BoxGeometry(cutoutW, sealW, sThick * 0.3);

            builder.addNode({ geometry: geoSealV, materialOverride: matRubberSeal, parent: sG, slot: MaterialSlots.SEAL, position: [-cutoutW / 2 + sealW / 2, sashH / 2, 0], userData: { isSeal: true }, paintable: false });
            builder.addNode({ geometry: geoSealV, materialOverride: matRubberSeal, parent: sG, slot: MaterialSlots.SEAL, position: [cutoutW / 2 - sealW / 2, sashH / 2, 0], userData: { isSeal: true }, paintable: false });
            builder.addNode({ geometry: geoSealH, materialOverride: matRubberSeal, parent: sG, slot: MaterialSlots.SEAL, position: [0, sashH - sFw - sealW / 2, 0], userData: { isSeal: true }, paintable: false });
            builder.addNode({ geometry: geoSealH, materialOverride: matRubberSeal, parent: sG, slot: MaterialSlots.SEAL, position: [0, sFw + sealW / 2, 0], userData: { isSeal: true }, paintable: false });

            const glassDepth = 0.6;
            const glassGeo = new THREE.BoxGeometry(cutoutW - beadW * 1.4, cutoutH - beadW * 1.4, glassDepth);
            builder.addNode({ geometry: glassGeo, materialOverride: matGlass, parent: sG, slot: MaterialSlots.GLASS, position: [0, sashH / 2, -beadDepth * 0.2], userData: { isGlass: true }, isGlass: true });

            const handleGroup = new THREE.Group();
            if (isCasement) {
                builder.addNode({ geometry: createBeveledRect(0.8, 3.5, 0.2, 0.04, 0.04), materialOverride: matMetalHardware, parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, 0, sThick / 2 + 0.1], userData: { isHandle: true }, paintable: false });
                builder.addNode({ geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.4, 12), materialOverride: matMetalHardware, parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, 0, sThick / 2 + 0.3], rotation: [Math.PI / 2, 0, 0], userData: { isHandle: true }, paintable: false });
                builder.addNode({ geometry: createBeveledRect(0.5, 4.2, 0.2, 0.05, 0.05), materialOverride: matMetalHardware, parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, -1.8, sThick / 2 + 0.5], userData: { isHandle: true }, paintable: false });

                const lockRodGeo = new THREE.CylinderGeometry(0.12, 0.12, sashH * 0.35, 8);
                builder.addNode({ geometry: lockRodGeo, materialOverride: matMetalHardware, parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, sashH * 0.22, sThick / 2 + 0.1], userData: { isHandle: true }, paintable: false });
                builder.addNode({ geometry: lockRodGeo, materialOverride: matMetalHardware, parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, -sashH * 0.22, sThick / 2 + 0.1], userData: { isHandle: true }, paintable: false });

                const handleX = hingeSide === 1 ? sashW / 2 - sFw / 2 : -sashW / 2 + sFw / 2;
                handleGroup.position.set(handleX, sashH * 0.42, 0);
            } else {
                builder.addNode({ geometry: createBeveledRect(1.4, 5.5, 0.3, 0.05, 0.05), materialOverride: matMetalHardware, parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, 0, sThick / 2 + 0.08], userData: { isHandle: true }, paintable: false });
                builder.addNode({ geometry: new THREE.BoxGeometry(0.8, 3.8, 0.25), materialOverride: new THREE.MeshBasicMaterial({ color: 0x0a0a0a }), parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, 0, sThick / 2 + 0.15], userData: { isHandle: true }, paintable: false });
                builder.addNode({ geometry: createBeveledRect(0.4, 0.8, 0.2, 0.03, 0.03), materialOverride: matMetalHardware, parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, 2.0, sThick / 2 + 0.2], userData: { isHandle: true }, paintable: false });
                handleGroup.position.set(sashW / 2 - sFw / 2, sashH * 0.42, 0);
            }
            sG.add(handleGroup);

            if (isCasement) {
                const hingeX = hingeSide === 1 ? -sashW / 2 : sashW / 2;
                [sashH * 0.8, sashH * 0.2].forEach(yPos => {
                    const hingeGroup = new THREE.Group();
                    hingeGroup.position.set(hingeX, yPos, sThick / 2);
                    sG.add(hingeGroup);
                    builder.addNode({ geometry: new THREE.CylinderGeometry(0.2, 0.2, 2.5, 12), materialOverride: matMetalHardware, parent: hingeGroup, slot: MaterialSlots.HARDWARE, position: [0, 0, 0], userData: { isHandle: true }, paintable: false });
                    builder.addNode({ geometry: new THREE.BoxGeometry(0.8, 1.8, 0.15), materialOverride: matMetalHardware, parent: hingeGroup, slot: MaterialSlots.HARDWARE, position: [-0.4, 0, 0], userData: { isHandle: true }, paintable: false });
                    builder.addNode({ geometry: new THREE.BoxGeometry(0.8, 1.8, 0.15), materialOverride: matMetalHardware, parent: hingeGroup, slot: MaterialSlots.HARDWARE, position: [0.4, 0, 0], userData: { isHandle: true }, paintable: false });
                });
            }
        } else {
            const panelGeo = createBeveledRect(cutoutW, cutoutH, sThick * 0.5, 0.3, 0.3);
            builder.addNode({ geometry: panelGeo, materialOverride: matsExtrudeSash, parent: sG, slot: slotName, position: [0, sashH / 2, 0], userData: { isFrame: true, componentId: sashCompId, componentType: ComponentTypes.SASH } });
        }

        sG.position.set(0, shadowGap, 0);
        return sG;
    };

    // --- 3. Window Type Specific Layouts ---
    if (wConf.type === 'fixed') {
        const sash = makeSash(iW, iH, true, false, 1, MaterialSlots.LEAF);
        sash.position.set(0, fW, zOffset);
        winGroup.add(sash);
    } else if (wConf.type === 'casement' || wConf.type === 'traditional') {
        const hw = iW / 2;
        const useGlass = wConf.type !== 'traditional';
        const openAngle = Math.PI / 6;

        const sL = makeSash(hw, iH, useGlass, true, 1, MaterialSlots.LEAF);
        const pL = new THREE.Group(); pL.position.set(-iW / 2, fW, zOffset); sL.position.set(hw / 2, 0, 0); pL.rotation.y = openAngle * entity.facing; pL.add(sL);

        const sR = makeSash(hw, iH, useGlass, true, -1, MaterialSlots.LEAF);
        const pR = new THREE.Group(); pR.position.set(iW / 2, fW, zOffset); sR.position.set(-hw / 2, 0, 0); pR.rotation.y = -openAngle * entity.facing; pR.add(sR);

        winGroup.add(pL, pR);
    } else if (wConf.type === 'sliding') {
        const overlap = 2.5;
        const panes = 2;
        const hw = (iW / panes) + (overlap / 2);
        for (let i = 0; i < panes; i++) {
            const sash = makeSash(hw, iH);
            const zOff = (i % 2 === 0) ? sThick / 2 + 0.15 : -sThick / 2 - 0.15;
            let xPos = -iW / 2 + hw / 2 + (i * (hw - overlap));
            if (i === panes - 1) xPos -= hw * 0.25 * entity.facing;

            const interlockerGeo = new THREE.BoxGeometry(0.4, iH - 0.5, sThick * 0.8);
            builder.addNode({ geometry: interlockerGeo, materialOverride: matMetalHardware, parent: sash, slot: MaterialSlots.HARDWARE, position: [i === 0 ? hw / 2 - 0.4 : -hw / 2 + 0.4, iH / 2, 0], userData: { isHandle: true }, paintable: false });

            sash.position.set(xPos, fW, zOffset + zOff);
            winGroup.add(sash);
        }
    } else if (wConf.type === 'louver') {
        const slatH = 5.5;
        const count = Math.floor(iH / (slatH - 0.6));
        for (let i = 0; i < count; i++) {
            const slatGeo = createBeveledRect(iW - 1.2, slatH, 0.6, 0.08, 0.08);
            builder.addNode({ geometry: slatGeo, materialOverride: matGlass, parent: winGroup, slot: MaterialSlots.GLASS, position: [0, fW + (i * (slatH - 0.6)) + slatH / 2, zOffset], rotation: [Math.PI / 5, 0, 0], userData: { isGlass: true }, isGlass: true });
        }
    } else if (wConf.type === 'bay') {
        const frontW = iW * 0.6; const frontSash = makeSash(frontW, iH); frontSash.position.set(0, fW, zOffset); winGroup.add(frontSash);
        const sideW = Math.hypot(iW * 0.2, zOffset); const sideAng = Math.atan2(zOffset, iW * 0.2);
        const sL = makeSash(sideW, iH); sL.position.set(-iW / 2 + (iW * 0.2) / 2, fW, zOffset / 2); sL.rotation.y = -sideAng;
        const sR = makeSash(sideW, iH); sR.position.set(iW / 2 - (iW * 0.2) / 2, fW, zOffset / 2); sR.rotation.y = sideAng;
        winGroup.add(sL, sR);

        const capShape = new THREE.Shape(); capShape.moveTo(-iW / 2 - fW, 0); capShape.lineTo(iW / 2 + fW, 0); capShape.lineTo(frontW / 2 + fW, zOffset + fThick / 2); capShape.lineTo(-frontW / 2 - fW, zOffset + fThick / 2);
        const capGeo = new THREE.ExtrudeGeometry(capShape, { depth: fW, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2 }); capGeo.rotateX(Math.PI / 2);
        builder.addNode({ geometry: capGeo, materialOverride: matsExtrude, parent: winGroup, slot: MaterialSlots.FRAME, position: [0, height, 0], userData: { isFrame: true } });
        builder.addNode({ geometry: capGeo, materialOverride: matsExtrude, parent: winGroup, slot: MaterialSlots.FRAME, position: [0, fW, 0], userData: { isFrame: true } });
    } else if (wConf.type === 'split_asymmetric') {
        const leftW = iW * 0.45; const rightW = iW - leftW;
        const rightSash = makeSash(rightW, iH); rightSash.position.set(iW / 2 - rightW / 2, fW, zOffset); winGroup.add(rightSash);
        const botH = iH * 0.4; const topH = iH - botH;
        const botSash = makeSash(leftW, botH); botSash.position.set(-iW / 2 + leftW / 2, fW, zOffset);
        const topSash = makeSash(leftW, topH); topSash.position.set(-iW / 2 + leftW / 2, fW + botH, zOffset);
        winGroup.add(botSash, topSash);
    } else if (wConf.type === 'window_seat') {
        const hw = iW / 2;
        const sL = makeSash(hw, iH); sL.position.set(-hw / 2, fW, zOffset);
        const sR = makeSash(hw, iH); sR.position.set(hw / 2, fW, zOffset);
        winGroup.add(sL, sR);
    } else if (wConf.type === 'garden_open') {
        const frontW = iW * 0.6; const frontSash = makeSash(frontW, iH); frontSash.position.set(0, fW, zOffset); winGroup.add(frontSash);
        const sideW = Math.hypot(iW * 0.2, zOffset);
        const sL = makeSash(sideW, iH, true); const pL = new THREE.Group(); pL.position.set(-frontW / 2, fW, zOffset); sL.position.set(-sideW / 2, 0, 0); pL.rotation.y = -Math.PI / 3; pL.add(sL); winGroup.add(pL);
        const sR = makeSash(sideW, iH, true); const pR = new THREE.Group(); pR.position.set(frontW / 2, fW, zOffset); sR.position.set(sideW / 2, 0, 0); pR.rotation.y = Math.PI / 3; pR.add(sR); winGroup.add(pR);
    } else if (wConf.type === 'panoramic_slider') {
        const overlap = 2.0; const panes = 3; const hw = (iW / panes) + (overlap / 2);
        for (let i = 0; i < panes; i++) {
            const sash = makeSash(hw, iH);
            const zOff = (i % 2 === 0) ? sThick / 2 + 0.15 : -sThick / 2 - 0.15;
            let xPos = -iW / 2 + hw / 2 + (i * (hw - overlap));
            sash.position.set(xPos, fW, zOffset + zOff);
            winGroup.add(sash);
        }
    }

    // --- 4. Architectural 3D Grill Bars (8mm Profile & Grid Lines) ---
    const activePattern = entity.grillePattern || 'grid';
    if (activePattern && activePattern !== 'none') {
        const grilleGroup = new THREE.Group();
        const grilleZ = entity.facing === 1 ? fThick / 2 - 1.0 : -fThick / 2 + 1.0;
        grilleGroup.position.set(0, 0, zOffset + grilleZ);

        const barWidth = 0.8, barDepth = 0.5;
        const isRound = entity.grilleProfile === 'round';

        const makeVBar = (x) => {
            const barGroup = new THREE.Group();
            const geo = createThinBarGeo(barWidth, iH, barDepth, false, isRound, barWidth);
            builder.addNode({ geometry: geo, materialOverride: matGrille, parent: barGroup, slot: MaterialSlots.GRILLE, position: [0, height / 2, 0], userData: { isGrille: true }, castShadow: true });
            barGroup.position.set(x, 0, 0);
            return barGroup;
        };

        const makeHBar = (y) => {
            const barGroup = new THREE.Group();
            const geo = createThinBarGeo(iW, barWidth, barDepth, true, isRound, barWidth);
            builder.addNode({ geometry: geo, materialOverride: matGrille, parent: barGroup, slot: MaterialSlots.GRILLE, position: [0, y, 0], userData: { isGrille: true }, castShadow: true });
            return barGroup;
        };

        const numCols = entity.grilleCols || 4;
        const numRows = entity.grilleRows || 4;
        if (activePattern === 'vertical' || activePattern === 'grid' || activePattern === 'grid_4') {
            for (let k = 1; k < numCols; k++) {
                const x = -iW / 2 + (k * iW / numCols);
                grilleGroup.add(makeVBar(x));
            }
        }
        if (activePattern === 'horizontal' || activePattern === 'grid' || activePattern === 'grid_4') {
            for (let k = 1; k < numRows; k++) {
                const y = fW + (k * iH / numRows);
                grilleGroup.add(makeHBar(y));
            }
        }
        if (activePattern === 'diamond') {
            const dGroup = new THREE.Group();
            const maxDim = Math.max(iW, iH) * 1.4;
            const stepD = maxDim / 6;
            for (let i = -maxDim / 2 + stepD; i < maxDim / 2; i += stepD) {
                builder.addNode({ geometry: createThinBarGeo(barWidth, maxDim, barDepth, false, isRound, barWidth), materialOverride: matGrille, parent: dGroup, slot: MaterialSlots.GRILLE, position: [i, 0, 0], userData: { isGrille: true } });
                builder.addNode({ geometry: createThinBarGeo(maxDim, barWidth, barDepth, true, isRound, barWidth), materialOverride: matGrille, parent: dGroup, slot: MaterialSlots.GRILLE, position: [0, i, 0], userData: { isGrille: true } });
            }
            dGroup.rotation.z = Math.PI / 4;
            dGroup.position.set(0, height / 2, 0);
            grilleGroup.add(dGroup);
        }
        winGroup.add(grilleGroup);
    }

    const hitboxGeo = new THREE.BoxGeometry(entity.width + 10, height + 10, (entity.thick || 20) + 10);
    builder.addNode({ geometry: hitboxGeo, isHitbox: true, parent: winGroup, position: [0, height / 2, 0] });
    winGroup.userData = { isWidget: true, entity: entity };

    const finalGroup = builder.build();
    sceneGroup.add(finalGroup);
    return finalGroup;
}

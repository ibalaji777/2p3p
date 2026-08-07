import Konva from 'konva';
import * as THREE from 'three';
export * from './constants/units.js';
export * from './constants/events.js';
export * from '../features/door/door.registry.js';
export * from '../features/roof/roof.registry.js';
export * from '../features/furniture/furniture.registry.js';
export * from '../features/railing/registry/railing.registry.js';
export * from '../features/window/window.registry.js';
export * from '../features/wall/wall.registry.js';
export * from './registries/material.registry.js';

import { DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT } from './constants/units.js';
import { WINDOW_TYPES } from '../features/window/window.registry.js';
import { JALI_MATERIALS } from './registries/material.registry.js';
import { MaterialSlots } from './constants/materialSlots.js';
import { ComponentRegistry } from './engine3d/ComponentRegistry.js';

export const WORKSPACE_2D_SHAPES = {
    // Default boundary
    'default': "M 0 0 L 100 0 L 100 100 L 0 100 Z",
    'furniture': "M 0 0 L 100 0 L 100 100 L 0 100 Z",

    // Couches & Sofas
    'couch': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 0 22 L 100 22 M 15 22 L 15 100 M 85 22 L 85 100 M 50 22 L 50 100",
    'sofa_l_shape': "M 0 0 L 100 0 L 100 38 L 38 38 L 38 100 L 0 100 Z M 0 22 L 100 22 M 22 0 L 22 100",
    'sofa_round': "M 50 0 A 50 50 0 1 0 50 100 A 50 50 0 1 0 50 0 Z M 10 50 C 10 15, 90 15, 90 50 M 25 30 L 48 20 L 54 36 L 31 46 Z M 46 20 L 68 16 L 74 32 L 52 36 Z",
    'curved_sectional': "M 0 75 C 0 35, 45 0, 100 20 C 100 45, 78 55, 55 45 C 38 35, 20 65, 20 85 C 10 90, 0 85, 0 75 Z M 10 65 C 8 32, 48 10, 92 25",

    // Seating & Chairs
    'chair': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 0 25 L 100 25 M 18 25 L 18 100 M 82 25 L 82 100",
    'armchair': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 0 22 L 100 22 M 18 22 L 18 100 M 82 22 L 82 100",
    'bench': "M 0 10 L 100 10 L 100 90 L 0 90 Z M 0 30 L 100 30",

    // Tables & Dining Sets
    'table_round': "M 50 0 A 50 50 0 1 0 50 100 A 50 50 0 1 0 50 0 Z",
    'circle': "M 50 0 A 50 50 0 1 0 50 100 A 50 50 0 1 0 50 0 Z",
    'table_rectangular': "M 0 0 L 100 0 L 100 100 L 0 100 Z",
    'dining_set': "M 15 15 L 85 15 L 85 85 L 15 85 Z M 25 0 L 75 0 L 75 12 L 25 12 Z M 25 88 L 75 88 L 75 100 L 25 100 Z M 0 25 L 12 25 L 12 75 L 0 75 Z M 88 25 L 100 25 L 100 75 L 88 75 Z",

    // Beds
    'bed': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 5 8 L 46 8 L 46 28 L 5 28 Z M 54 8 L 95 8 L 95 28 L 54 28 Z M 0 32 L 100 32",

    // Kitchen Modules
    'kitchen_straight': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 0 20 L 100 20",
    'kitchen_l_shape': "M 0 0 L 100 0 L 100 35 L 35 35 L 35 100 L 0 100 Z",
    'kitchen_u_shape': "M 0 0 L 100 0 L 100 100 L 65 100 L 65 35 L 35 35 L 35 100 L 0 100 Z",
    'kitchen_island': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 0 18 L 100 18",
    'kitchen_tall_pantry': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 0 0 L 100 100 M 100 0 L 0 100",

    // Sinks & Appliances
    'sink_standard': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 10 10 L 90 10 L 90 90 L 10 90 Z",
    'sink_double': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 8 10 L 46 10 L 46 90 L 8 90 Z M 54 10 L 92 10 L 92 90 L 54 90 Z",
    'sink_farmhouse': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 8 8 L 92 8 L 92 92 L 8 92 Z",
    'tap': "M 45 0 L 55 0 L 55 45 L 45 45 Z M 35 45 L 65 45 L 65 95 L 35 95 Z",
    'hood_chimney': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 20 20 L 80 20 L 80 80 L 20 80 Z",
    'app_fridge': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 0 42 L 100 42",
    'app_oven': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 10 10 A 40 40 0 1 0 90 10",
    'app_microwave': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 10 10 L 75 10 L 75 90 L 10 90 Z",
    'cooktop_induction': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 A 20 20 0 1 0 25 25.1 M 75 25 A 20 20 0 1 0 75 25.1 M 25 75 A 20 20 0 1 0 25 75.1 M 75 75 A 20 20 0 1 0 75 75.1",

    // Bathroom & Sanitary
    'toilet_standard': "M 15 0 L 85 0 L 85 30 L 15 30 Z M 25 30 A 35 45 0 1 0 75 30 Z",
    'sanitary_unit': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 20 20 A 30 30 0 1 0 80 20 Z",

    // Entertainment & Storage
    'tv_unit': "M 0 30 L 100 30 L 100 70 L 0 70 Z M 15 42 L 85 42 L 85 58 L 15 58 Z"
};

export const createDoorShape = (w, h, type = 'square') => {
    const shape = new THREE.Shape();
    const hw = w / 2;
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    
    if (type === 'radius') {
        const straightH = Math.max(0, h - hw);
        shape.lineTo(hw, straightH);
        if (hw > 0) shape.absarc(0, straightH, hw, 0, Math.PI, false);
    } else if (type === 'segment') {
        const rise = w * 0.15;
        const straightH = Math.max(0, h - rise);
        shape.lineTo(hw, straightH);
        shape.quadraticCurveTo(0, h + rise*0.5, -hw, straightH);
    } else if (type === 'gothic') {
        const straightH = Math.max(0, h - (w * 0.7));
        shape.lineTo(hw, straightH);
        shape.quadraticCurveTo(hw * 0.2, h, 0, h);
        shape.quadraticCurveTo(-hw * 0.2, h, -hw, straightH);
    } else {
        shape.lineTo(hw, h);
        shape.lineTo(-hw, h);
    }
    shape.lineTo(-hw, 0);
    return shape;
};

function buildDetailedDoorPanel(entity, width, height, thickness, material, type, isGlass, signX = 1, helpers) {
    const mats = (helpers && helpers.getFaceMaterials) ? helpers.getFaceMaterials(entity, material, { width, height, thick: thickness }).box : material;
    const group = new THREE.Group(); const gap = 0.2; 
    const style = entity && entity.doorStyle ? entity.doorStyle : 'flat';
    
    const createBeveledRect = (w, h, depth) => {
        const shape = new THREE.Shape();
        const hw = w/2, hh = h/2;
        shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
        const bSize = 0.08; const bThick = 0.06;
        const d = Math.max(0.01, depth - bThick * 2);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: bSize, bevelThickness: bThick });
        geo.translate(0, 0, -d/2);
        const uvs = geo.attributes.uv; const pos = geo.attributes.position;
        if (uvs && pos) {
            for (let i = 0; i < uvs.count; i++) {
                uvs.setXY(i, (pos.getX(i) + hw) / w, (pos.getY(i) + hh) / h);
            }
            uvs.needsUpdate = true;
        }
        return geo;
    };
    
    const rotateUVs = (geo) => {
        const uvs = geo.attributes.uv;
        if (uvs) {
            for (let i = 0; i < uvs.count; i++) {
                const u = uvs.getX(i) - 0.5; const v = uvs.getY(i) - 0.5;
                uvs.setXY(i, -v + 0.5, u + 0.5); // 90 degree rotation
            }
            uvs.needsUpdate = true;
        }
        return geo;
    };

    const matsExtrude = Array.isArray(mats) ? [mats[4], mats[1]] : mats;

    if (style === 'glass_bottom_panel') {
        const frameW = 3.5; const topRailH = 3.5; const botRailH = height * 0.28;
        const geoStile = createBeveledRect(frameW, height, thickness); const geoRailT = rotateUVs(createBeveledRect(width - frameW*2, topRailH, thickness)); const geoRailB = rotateUVs(createBeveledRect(width - frameW*2, botRailH, thickness));
        const stileL = new THREE.Mesh(geoStile, matsExtrude); stileL.position.set(-width/2 + frameW/2, height/2, 0); const stileR = new THREE.Mesh(geoStile, matsExtrude); stileR.position.set(width/2 - frameW/2, height/2, 0);
        const railT = new THREE.Mesh(geoRailT, matsExtrude); railT.position.set(0, height - topRailH/2, 0); const railB = new THREE.Mesh(geoRailB, matsExtrude); railB.position.set(0, botRailH/2, 0);
        [stileL, stileR, railT, railB].forEach(m => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
        
        const grooveGeo = rotateUVs(createBeveledRect(width - frameW*2, 0.4, thickness + 0.1));
        const groove1 = new THREE.Mesh(grooveGeo, matsExtrude); groove1.position.set(0, botRailH * 0.4, 0); group.add(groove1);
        const groove2 = new THREE.Mesh(grooveGeo, matsExtrude); groove2.position.set(0, botRailH * 0.7, 0); group.add(groove2);

        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const geoGlass = new THREE.BoxGeometry(width - frameW*2, height - topRailH - botRailH, thickness * 0.25);
        const glass = new THREE.Mesh(geoGlass, glassMat); glass.userData.isGlass = true; glass.position.set(0, height/2 + (botRailH - topRailH)/2, 0); group.add(glass);
    } else if (style === 'glass_grid') {
        const frameW = 3.5; const topRailH = 3.5; const botRailH = 5;
        const geoStile = createBeveledRect(frameW, height, thickness); const geoRailT = rotateUVs(createBeveledRect(width - frameW*2, topRailH, thickness)); const geoRailB = rotateUVs(createBeveledRect(width - frameW*2, botRailH, thickness));
        const stileL = new THREE.Mesh(geoStile, matsExtrude); stileL.position.set(-width/2 + frameW/2, height/2, 0); const stileR = new THREE.Mesh(geoStile, matsExtrude); stileR.position.set(width/2 - frameW/2, height/2, 0);
        const railT = new THREE.Mesh(geoRailT, matsExtrude); railT.position.set(0, height - topRailH/2, 0); const railB = new THREE.Mesh(geoRailB, matsExtrude); railB.position.set(0, botRailH/2, 0);
        [stileL, stileR, railT, railB].forEach(m => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
        
        const mullionW = 1.5; const glassH = height - topRailH - botRailH; const glassW = width - frameW*2;
        const vMullionGeo = createBeveledRect(mullionW, glassH, thickness);
        const vMullion = new THREE.Mesh(vMullionGeo, matsExtrude); vMullion.position.set(0, height/2 + (botRailH - topRailH)/2, 0); group.add(vMullion);
        
        const hMullionGeo = rotateUVs(createBeveledRect(glassW, mullionW, thickness));
        for (let i = 1; i <= 3; i++) {
            const hMullion = new THREE.Mesh(hMullionGeo, matsExtrude);
            hMullion.position.set(0, botRailH + (glassH / 4) * i, 0);
            group.add(hMullion);
        }

        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door'); const geoGlass = new THREE.BoxGeometry(glassW, glassH, thickness * 0.4);
        const glass = new THREE.Mesh(geoGlass, glassMat); glass.userData.isGlass = true; glass.position.set(0, height/2 + (botRailH - topRailH)/2, 0); group.add(glass);
    } else if (isGlass || type === 'french') {
        const frameW = 3.5; const topRailH = 3.5; const botRailH = 5;
        const geoStile = createBeveledRect(frameW, height, thickness); const geoRailT = rotateUVs(createBeveledRect(width - frameW*2, topRailH, thickness)); const geoRailB = rotateUVs(createBeveledRect(width - frameW*2, botRailH, thickness));
        const stileL = new THREE.Mesh(geoStile, matsExtrude); stileL.position.set(-width/2 + frameW/2, height/2, 0); const stileR = new THREE.Mesh(geoStile, matsExtrude); stileR.position.set(width/2 - frameW/2, height/2, 0);
        const railT = new THREE.Mesh(geoRailT, matsExtrude); railT.position.set(0, height - topRailH/2, 0); const railB = new THREE.Mesh(geoRailB, matsExtrude); railB.position.set(0, botRailH/2, 0);
        [stileL, stileR, railT, railB].forEach(m => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
        
        const beadW = 0.8;
        const beadGeoV = createBeveledRect(beadW, height - topRailH - botRailH, thickness * 0.65);
        const beadGeoH = rotateUVs(createBeveledRect(width - frameW*2 - beadW*2, beadW, thickness * 0.65));
        const beadL = new THREE.Mesh(beadGeoV, matsExtrude); beadL.position.set(-width/2 + frameW + beadW/2, height/2 + (botRailH - topRailH)/2, 0);
        const beadR = new THREE.Mesh(beadGeoV, matsExtrude); beadR.position.set(width/2 - frameW - beadW/2, height/2 + (botRailH - topRailH)/2, 0);
        const beadT = new THREE.Mesh(beadGeoH, matsExtrude); beadT.position.set(0, height - topRailH - beadW/2, 0);
        const beadB = new THREE.Mesh(beadGeoH, matsExtrude); beadB.position.set(0, botRailH + beadW/2, 0);
        [beadL, beadR, beadT, beadB].forEach(m => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
        
        const gMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
        const gL = new THREE.Mesh(new THREE.BoxGeometry(0.1, height-topRailH-botRailH-beadW*2, thickness*0.28), gMat); gL.position.set(-width/2 + frameW + beadW + 0.05, height/2 + (botRailH - topRailH)/2, 0);
        const gR = new THREE.Mesh(new THREE.BoxGeometry(0.1, height-topRailH-botRailH-beadW*2, thickness*0.28), gMat); gR.position.set(width/2 - frameW - beadW - 0.05, height/2 + (botRailH - topRailH)/2, 0);
        [gL, gR].forEach(m => group.add(m));

        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const geoGlass = new THREE.BoxGeometry(width - frameW*2 - beadW*2, height - topRailH - botRailH - beadW*2, thickness * 0.25);
        const glass = new THREE.Mesh(geoGlass, glassMat); glass.userData.isGlass = true; glass.position.set(0, height/2 + (botRailH - topRailH)/2, 0); group.add(glass);
    } else {
        const shapeType = entity && entity.doorShape ? entity.doorShape : 'square';
        const bSize = 0.06;
        const doorOutline = createDoorShape(width, Math.max(0.1, height - bSize*2), shapeType);
        const coreGeo = new THREE.ExtrudeGeometry(doorOutline, { depth: Math.max(0.01, thickness - bSize*2), bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: bSize, bevelThickness: bSize });
        coreGeo.translate(0, bSize, -Math.max(0.01, thickness - bSize*2) / 2);
        
        // Normalize UVs for ExtrudeGeometry so texture repeat mapping scales properly [0, 1]
        const coreUvs = coreGeo.attributes.uv;
        const corePos = coreGeo.attributes.position;
        if (coreUvs && corePos) {
            for (let i = 0; i < coreUvs.count; i++) {
                const vx = corePos.getX(i);
                const vy = corePos.getY(i);
                coreUvs.setXY(i, (vx + width / 2) / width, vy / height);
            }
            coreUvs.needsUpdate = true;
        }

        const matsExtrude = Array.isArray(mats) ? [mats[4], mats[1]] : mats;
        const core = new THREE.Mesh(coreGeo, matsExtrude); core.position.set(0, 0, 0); core.castShadow = true; core.receiveShadow = true; group.add(core);

        // Door sweep — acts as an extension of the door leaf to close the clearance gap
        const sweepH = 0.35; // Matches doorClearance (8.89mm) exactly
        const sweepW = width - 0.4;
        const sweepD = thickness * 0.7;
        const shape = new THREE.Shape();
        const sw = sweepW/2, sh = sweepH/2;
        shape.moveTo(-sw, -sh); shape.lineTo(sw, -sh); shape.lineTo(sw, sh); shape.lineTo(-sw, sh); shape.lineTo(-sw, -sh);
        const sweepGeo = new THREE.ExtrudeGeometry(shape, { depth: sweepD, bevelEnabled: false });
        sweepGeo.translate(0, 0, -sweepD/2);
        
        const sweepUvs = sweepGeo.attributes.uv;
        const sweepPos = sweepGeo.attributes.position;
        if (sweepUvs && sweepPos) {
            for (let i = 0; i < sweepUvs.count; i++) {
                sweepUvs.setXY(i, (sweepPos.getX(i) + sw) / sweepW, (sweepPos.getY(i) + sh) / sweepH);
            }
            sweepUvs.needsUpdate = true;
        }

        const sweep = new THREE.Mesh(sweepGeo, matsExtrude); 
        sweep.position.set(0, -sweepH / 2 + 0.01, 0); // Positioned extending down from Y=0 (bottom of leaf)
        sweep.castShadow = true; sweep.receiveShadow = true;
        sweep.userData = { isSweep: true };
        group.add(sweep);

        
        const createBeveledPanelGeo = (pw, ph, pth, panelShape = 'square') => {
            const bSize = 0.12; const bThick = 0.06;
            const sw = Math.max(0.1, pw - bSize*2); const sh = Math.max(0.1, ph - bSize*2);
            
            const shape = new THREE.Shape();
            const hw = sw / 2;
            shape.moveTo(-hw, -sh/2); shape.lineTo(hw, -sh/2);
            
            if (panelShape === 'radius') {
                const straightH = (sh/2) - hw;
                shape.lineTo(hw, straightH);
                if (hw > 0) shape.absarc(0, straightH, hw, 0, Math.PI, false);
            } else if (panelShape === 'segment') {
                const rise = sw * 0.15;
                const straightH = (sh/2) - rise;
                shape.lineTo(hw, straightH);
                shape.quadraticCurveTo(0, sh/2 + rise*0.5, -hw, straightH);
            } else if (panelShape === 'gothic') {
                const straightH = (sh/2) - (sw * 0.7);
                shape.lineTo(hw, straightH);
                shape.quadraticCurveTo(hw * 0.2, sh/2, 0, sh/2);
                shape.quadraticCurveTo(-hw * 0.2, sh/2, -hw, straightH);
            } else {
                shape.lineTo(hw, sh/2);
                shape.lineTo(-hw, sh/2);
            }
            shape.lineTo(-hw, -sh/2);
            
            const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, pth - bThick*2), bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: bSize, bevelThickness: bThick });
            geo.translate(0, 0, -Math.max(0.01, pth - bThick*2)/2);

            // Normalize UVs for panel ExtrudeGeometry
            const pUvs = geo.attributes.uv;
            const pPos = geo.attributes.position;
            if (pUvs && pPos) {
                for (let i = 0; i < pUvs.count; i++) {
                    const vx = pPos.getX(i);
                    const vy = pPos.getY(i);
                    pUvs.setXY(i, (vx + pw / 2) / pw, (vy + ph / 2) / ph);
                }
                pUvs.needsUpdate = true;
            }

            return geo;
        };
        


        if (style === 'classic_4_horizontal') {
            const numPanels = 4; const panelHeight = (height - (gap * (numPanels - 1))) / numPanels; 
            for (let i = 0; i < numPanels; i++) { 
                const isTop = (i === numPanels - 1);
                const geoPanel = createBeveledPanelGeo(width - 0.6, panelHeight, thickness + 0.05, isTop ? shapeType : 'square'); 
                const p = new THREE.Mesh(geoPanel, matsExtrude); 
                const yPos = (panelHeight / 2) + i * (panelHeight + gap); 
                p.position.set(0, yPos, 0); p.castShadow = true; p.receiveShadow = true; group.add(p); 
            }
        } else if (style === 'classic_2_panel') {
            const topH = height * 0.65; const botH = height * 0.25; 
            const geoTop = createBeveledPanelGeo(width - 0.8, topH, thickness + 0.05, shapeType); const geoBot = createBeveledPanelGeo(width - 0.8, botH, thickness + 0.05, 'square');
            const pTop = new THREE.Mesh(geoTop, matsExtrude); pTop.position.set(0, height - topH/2 - gap, 0); pTop.castShadow = true; group.add(pTop);
            const pBot = new THREE.Mesh(geoBot, matsExtrude); pBot.position.set(0, botH/2 + gap*2, 0); pBot.castShadow = true; group.add(pBot);
        } else if (style === 'classic_4_panel') {
            const topH = height * 0.55; const botH = height * 0.3; const pw = width/2 - 0.4;
            const geoTop = createBeveledPanelGeo(pw, topH, thickness + 0.05, shapeType); const geoBot = createBeveledPanelGeo(pw, botH, thickness + 0.05, 'square');
            [-1, 1].forEach(side => {
                const xOff = (pw/2 + 0.15) * side;
                const pTop = new THREE.Mesh(geoTop, matsExtrude); pTop.position.set(xOff, height - topH/2 - gap, 0); pTop.castShadow = true; group.add(pTop);
                const pBot = new THREE.Mesh(geoBot, matsExtrude); pBot.position.set(xOff, botH/2 + gap*2, 0); pBot.castShadow = true; group.add(pBot);
            });
        } else if (style === 'grid_panel') {
            const rows = 5; const cols = 3; const pW = (width - gap*(cols+1))/cols; const pH = (height - gap*(rows+1))/rows;
            for (let r=0; r<rows; r++) {
                const isTop = (r === rows - 1);
                for (let c=0; c<cols; c++) {
                    const geoGrid = createBeveledPanelGeo(pW - 0.1, pH - 0.1, thickness + 0.05, isTop ? shapeType : 'square');
                    const p = new THREE.Mesh(geoGrid, matsExtrude);
                    const xPos = -width/2 + gap + pW/2 + c*(pW + gap);
                    const yPos = gap + pH/2 + r*(pH + gap);
                    p.position.set(xPos, yPos, 0); p.castShadow = true; group.add(p);
                }
            }
        }
    }
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 }); const silverMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.9, roughness: 0.15 }); const handleY = height * 0.45; 
    if (['sliding', 'double_sliding'].includes(type) && isGlass) {
        const handleGeo = new THREE.CylinderGeometry(0.35, 0.35, 30, 16); const standoffGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
        [-1, 1].forEach(side => { const zPos = side === 1 ? thickness/2 + 1.2 : -thickness/2 - 1.2; const pull = new THREE.Mesh(handleGeo, silverMat); pull.position.set((width/2 - 3) * signX, handleY, zPos); const so1 = new THREE.Mesh(standoffGeo, silverMat); so1.rotation.x = Math.PI/2; so1.position.set((width/2 - 3) * signX, handleY + 12, zPos - side*0.6); const so2 = new THREE.Mesh(standoffGeo, silverMat); so2.rotation.x = Math.PI/2; so2.position.set((width/2 - 3) * signX, handleY - 12, zPos - side*0.6); [pull, so1, so2].forEach(m => { m.userData.isHandle = true; m.castShadow = true; group.add(m); }); });
    } else if (['sliding', 'double_sliding', 'pocket'].includes(type)) {
        const isPocket = type === 'pocket';
        const hW = isPocket ? 2.5 : 2;
        const hH = isPocket ? 16 : 10;
        const hY = isPocket ? height * 0.5 : handleY;
        
        // Premium brushed matte black metal
        const pocketHandleMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.8, roughness: 0.45 });
        
        const makeHandleGeo = (w, h, d, b=0.04) => {
            const wAdj = Math.max(0.01, w - b*2);
            const hAdj = Math.max(0.01, h - b*2);
            const shape = new THREE.Shape(); const hw = wAdj/2, hh = hAdj/2;
            shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
            const dAdj = Math.max(0.01, d - b*2);
            const ex = new THREE.ExtrudeGeometry(shape, { depth: dAdj, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: b, bevelThickness: b });
            ex.translate(0, 0, -dAdj/2);
            return ex;
        };

        // Use makeHandleGeo to add subtle edge bevel (0.04 = 1mm)
        const flushGeo = makeHandleGeo(hW, hH, 0.4, 0.04);
        const pullF = new THREE.Mesh(flushGeo, isPocket ? pocketHandleMat : metalMat); pullF.position.set((width/2 - 4) * signX, hY, thickness/2 + 0.1);
        const pullB = new THREE.Mesh(flushGeo, isPocket ? pocketHandleMat : metalMat); pullB.position.set((width/2 - 4) * signX, hY, -thickness/2 - 0.1);
        
        // Inner recessed cavity for realistic depth
        const innerGeo = makeHandleGeo(hW * 0.6, hH * 0.8, 0.5, 0.02);
        const innerMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.9, roughness: 0.6 });
        const innerF = new THREE.Mesh(innerGeo, innerMat); innerF.position.set((width/2 - 4) * signX, hY, thickness/2 + 0.05);
        const innerB = new THREE.Mesh(innerGeo, innerMat); innerB.position.set((width/2 - 4) * signX, hY, -thickness/2 - 0.05);
        
        [pullF, pullB, innerF, innerB].forEach(m => { m.userData.isHandle = true; m.castShadow = true; group.add(m); });
    } else if (type === 'pivot') {
        const barGeo = new THREE.CylinderGeometry(0.5, 0.5, 24, 16); const standoffGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 8);
        [-1, 1].forEach(side => { const zPos = side === 1 ? thickness/2 + 1.5 : -thickness/2 - 1.5; const bar = new THREE.Mesh(barGeo, metalMat); bar.position.set((width/2 - 4) * signX, handleY, zPos); const so1 = new THREE.Mesh(standoffGeo, metalMat); so1.rotation.x = Math.PI/2; so1.position.set((width/2 - 4) * signX, handleY + 10, zPos - side); const so2 = new THREE.Mesh(standoffGeo, metalMat); so2.rotation.x = Math.PI/2; so2.position.set((width/2 - 4) * signX, handleY - 10, zPos - side); [bar, so1, so2].forEach(m => { m.userData.isHandle = true; m.castShadow = true; group.add(m); }); });
    } else if (type === 'folding_lead') { const pullGeo = new THREE.BoxGeometry(0.8, 14, thickness + 1.2); const pull = new THREE.Mesh(pullGeo, metalMat); pull.position.set((width/2 - 1.5) * -signX, handleY, 0); pull.castShadow = true; pull.userData.isHandle = true; group.add(pull);
    } else if (['single', 'double', 'french'].includes(type)) {
        const hZF = thickness/2; const hZB = -thickness/2;
        const leverX = (width/2 - 3.5) * signX;
        
        const roseGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.2, 24); roseGeo.rotateX(Math.PI/2);
        const roseF = new THREE.Mesh(roseGeo, metalMat); roseF.position.set(leverX, handleY, hZF + 0.1);
        const roseB = new THREE.Mesh(roseGeo, metalMat); roseB.position.set(leverX, handleY, hZB - 0.1);
        
        const stemGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.5, 16); stemGeo.rotateX(Math.PI/2);
        const stemF = new THREE.Mesh(stemGeo, metalMat); stemF.position.set(leverX, handleY, hZF + 0.75);
        const stemB = new THREE.Mesh(stemGeo, metalMat); stemB.position.set(leverX, handleY, hZB - 0.75);
        
        const handleLGeo = new THREE.CylinderGeometry(0.3, 0.4, 5, 16); handleLGeo.rotateZ(Math.PI/2);
        const handleDir = -signX; 
        const handleF = new THREE.Mesh(handleLGeo, metalMat); handleF.position.set(leverX + 2.5*handleDir, handleY, hZF + 1.25);
        const handleB = new THREE.Mesh(handleLGeo, metalMat); handleB.position.set(leverX + 2.5*handleDir, handleY, hZB - 1.25);

        const keyGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.25, 16); keyGeo.rotateX(Math.PI/2);
        const keyF = new THREE.Mesh(keyGeo, metalMat); keyF.position.set(leverX, handleY - 2.5, hZF + 0.125);
        const keyB = new THREE.Mesh(keyGeo, metalMat); keyB.position.set(leverX, handleY - 2.5, hZB - 0.125);
        
        const latchGeo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
        const latch = new THREE.Mesh(latchGeo, silverMat); latch.position.set((width/2 + 0.2) * signX, handleY, 0);
        const faceplateGeo = new THREE.BoxGeometry(0.1, 4, 1.2);
        const faceplate = new THREE.Mesh(faceplateGeo, metalMat); faceplate.position.set((width/2 + 0.05) * signX, handleY, 0);

        [roseF, roseB, stemF, stemB, handleF, handleB, keyF, keyB, latch, faceplate].forEach(m => { m.userData.isHandle = true; m.castShadow = true; group.add(m); });
    }
    if (['single', 'double', 'french', 'folding_main'].includes(type) && signX !== 0) { 
        const hingeW = 0.8, hingeD = 4.2;
        const hingeGeo = new THREE.BoxGeometry(hingeW, hingeD, 0.15);
        const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, hingeD, 16);
        [height * 0.88, height * 0.5, height * 0.12].forEach(y => { 
            const hG = new THREE.Group();
            const plate = new THREE.Mesh(hingeGeo, metalMat);
            plate.position.set((width/2 - 0.05) * -signX, 0, 0); 
            plate.rotation.y = signX === 1 ? Math.PI/2 : -Math.PI/2;
            const barrel = new THREE.Mesh(barrelGeo, metalMat);
            barrel.position.set((width/2 + 0.15) * -signX, 0, thickness/2 + 0.1);
            [plate, barrel].forEach(m => m.userData.isHandle = true);
            hG.add(plate, barrel); hG.position.set(0, y, 0);
            hG.castShadow = true; group.add(hG); 
        }); 
        
        const strikeGeo = new THREE.BoxGeometry(0.1, 6, 2.5);
        const strikePlate = new THREE.Mesh(strikeGeo, metalMat);
        strikePlate.position.set((width/2 - 0.01) * signX, height * 0.5, 0);
        strikePlate.userData.isHandle = true;
        group.add(strikePlate);
    }
    return group;
}

export const WIDGET_REGISTRY = {

    'jali_panel': {
        widget: "jali_panel", label: "JALI PANEL",
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 40, height: 100, jaliPattern: 'geometric', jaliMat: 'wood', thick: 2, elevation: 0 },
        render2D: (group, entity) => {
            const hw = entity.width / 2; const thick = entity.wall ? (entity.wall.thickness || entity.wall.config.thickness) : (entity.thick || 4);
            const w = entity.width; const h = thick;
            const rect = new Konva.Rect({ x: -hw, y: -h/2, width: w, height: h, fill: 'transparent', stroke: '#d97706', strokeWidth: 2, dash: [4, 2] });
            group.add(rect);
            for(let i = -hw + 4; i < hw; i += 8) { group.add(new Konva.Line({ points: [i, -h/2, i+4, h/2], stroke: '#d97706', strokeWidth: 1 })); }
        },
        render3D: (sceneGroup, entity, helpers) => {
            let baseElev = entity.elevation || 0; let rawHeight = entity.height || 100;
            let bottomY = Math.max(0.2, baseElev); let topY = baseElev + rawHeight; let height = topY - bottomY;
            const jaliGroup = new THREE.Group(); jaliGroup.position.set(entity.x, bottomY, entity.z); jaliGroup.rotation.y = -entity.angle;
            
            const mount = entity.jaliMount || 'flush';
            if (mount === 'recessed') jaliGroup.translateZ(-4);
            if (mount === 'protruding') jaliGroup.translateZ(4);
            
            const matConfig = JALI_MATERIALS[entity.jaliMat || 'wood'];
            const matFrame = new THREE.MeshPhysicalMaterial({ 
                color: matConfig.color, 
                roughness: matConfig.roughness, 
                metalness: matConfig.metalness,
                clearcoat: matConfig.clearcoat || 0,
                clearcoatRoughness: matConfig.clearcoatRoughness || 0
            });
            let matExtrude = matFrame;
            let matBox = matFrame;
            if (helpers && helpers.getFaceMaterials) {
                const mm = helpers.getFaceMaterials(entity, matFrame, { width: entity.width, height: height });
                matExtrude = mm.extrude;
                matBox = mm.box;
            }
            const frameW = 2; const fThick = entity.thick || 2;
            const createBeveledFramePiece = (w, h) => {
                const shape = new THREE.Shape();
                shape.moveTo(-w/2, -h/2); shape.lineTo(w/2, -h/2); shape.lineTo(w/2, h/2); shape.lineTo(-w/2, h/2); shape.lineTo(-w/2, -h/2);
                const extrudeSettings = { depth: fThick, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.1, bevelThickness: 0.1 };
                const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geo.translate(0, 0, -fThick/2);
                return new THREE.Mesh(geo, matExtrude);
            };
            const sl = createBeveledFramePiece(frameW, height); sl.position.set(-entity.width/2 + frameW/2, height/2, 0);
            const sr = createBeveledFramePiece(frameW, height); sr.position.set(entity.width/2 - frameW/2, height/2, 0);
            const rt = createBeveledFramePiece(entity.width - frameW*2, frameW); rt.position.set(0, height - frameW/2, 0);
            const rb = createBeveledFramePiece(entity.width - frameW*2, frameW); rb.position.set(0, frameW/2, 0);
            [sl, sr, rt, rb].forEach(m => { m.castShadow = true; m.receiveShadow = true; jaliGroup.add(m); });
            const iW = entity.width - frameW*2; const iH = height - frameW*2; const lThick = fThick * 0.5;
            const latticeGroup = new THREE.Group(); latticeGroup.position.set(0, height/2, 0);
            
            if (['kolam', 'lotus', 'peacock', 'gopuram', 'ventilation', 'mango', 'chettinad'].includes(entity.jaliPattern)) {
                const targetStep = entity.jaliPatternSize || 20;
                const cols = Math.max(1, Math.round(iW / targetStep));
                const rows = Math.max(1, Math.round(iH / targetStep));
                const stepX = iW / cols; const stepY = iH / rows;
                
                const shape = new THREE.Shape();
                shape.moveTo(-stepX/2, -stepY/2); shape.lineTo(stepX/2, -stepY/2); shape.lineTo(stepX/2, stepY/2); shape.lineTo(-stepX/2, stepY/2); shape.lineTo(-stepX/2, -stepY/2);
                
                const maxSize = Math.min(stepX, stepY);
                const hw = maxSize * 0.45; const hh = maxSize * 0.45;
                
                if (entity.jaliPattern === 'ventilation') {
                    const hole = new THREE.Path();
                    hole.absellipse(0, 0, hw*0.8, hh*0.8, 0, Math.PI * 2, false);
                    shape.holes.push(hole);
                } else if (entity.jaliPattern === 'lotus') {
                    const h1 = new THREE.Path(); h1.moveTo(0, hh*0.8); h1.quadraticCurveTo(hw*0.4, 0, 0, -hh*0.8); h1.quadraticCurveTo(-hw*0.4, 0, 0, hh*0.8);
                    const h2 = new THREE.Path(); h2.moveTo(hw*0.1, -hh*0.6); h2.quadraticCurveTo(hw*0.8, -hh*0.2, hw*0.9, hh*0.4); h2.quadraticCurveTo(hw*0.5, hh*0.1, hw*0.1, -hh*0.6);
                    const h3 = new THREE.Path(); h3.moveTo(-hw*0.1, -hh*0.6); h3.quadraticCurveTo(-hw*0.8, -hh*0.2, -hw*0.9, hh*0.4); h3.quadraticCurveTo(-hw*0.5, hh*0.1, -hw*0.1, -hh*0.6);
                    shape.holes.push(h1, h2, h3);
                } else if (entity.jaliPattern === 'peacock') {
                    const p = new THREE.Path();
                    p.moveTo(0, -hh); p.quadraticCurveTo(hw, -hh, hw, -hh*0.2);
                    p.quadraticCurveTo(hw*0.8, hh*0.6, 0, hh*0.8);
                    p.quadraticCurveTo(-hw*0.6, hh*0.6, -hw*0.6, 0); p.quadraticCurveTo(-hw, hh*0.2, -hw*0.8, 0);
                    p.quadraticCurveTo(-hw*0.2, -0.4, 0, -hh);
                    shape.holes.push(p);
                } else if (entity.jaliPattern === 'gopuram') {
                    const t1 = new THREE.Path(); t1.moveTo(-hw*0.8, -hh*0.8); t1.lineTo(hw*0.8, -hh*0.8); t1.lineTo(hw*0.6, -hh*0.2); t1.lineTo(-hw*0.6, -hh*0.2); t1.lineTo(-hw*0.8, -hh*0.8);
                    const t2 = new THREE.Path(); t2.moveTo(-hw*0.5, -hh*0.1); t2.lineTo(hw*0.5, -hh*0.1); t2.lineTo(hw*0.3, hh*0.4); t2.lineTo(-hw*0.3, hh*0.4); t2.lineTo(-hw*0.5, -hh*0.1);
                    const t3 = new THREE.Path(); t3.moveTo(-hw*0.2, hh*0.5); t3.lineTo(hw*0.2, hh*0.5); t3.lineTo(0, hh*0.9); t3.lineTo(-hw*0.2, hh*0.5);
                    shape.holes.push(t1, t2, t3);
                } else if (entity.jaliPattern === 'mango') {
                    const m = new THREE.Path();
                    m.moveTo(0, -hh*0.8);
                    m.bezierCurveTo(hw, -hh*0.8, hw, hh*0.6, 0, hh*0.8);
                    m.bezierCurveTo(-hw*0.8, hh*0.8, -hw, hh*0.2, -hw*0.4, hh*0.2);
                    m.bezierCurveTo(-hw*0.2, hh*0.2, -hw*0.2, hh*0.4, 0, hh*0.4);
                    m.bezierCurveTo(-hw*0.8, hh*0.4, -hw*0.8, -hh*0.6, 0, -hh*0.8);
                    shape.holes.push(m);
                } else if (entity.jaliPattern === 'chettinad' || entity.jaliPattern === 'kolam') {
                    const d = new THREE.Path();
                    d.moveTo(0, hh*0.8); d.lineTo(hw*0.8, 0); d.lineTo(0, -hh*0.8); d.lineTo(-hw*0.8, 0); d.lineTo(0, hh*0.8);
                    shape.holes.push(d);
                    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([dx, dy]) => {
                        const c = new THREE.Path();
                        c.absellipse(dx*hw*0.8, dy*hh*0.8, hw*0.15, hh*0.15, 0, Math.PI * 2, false);
                        shape.holes.push(c);
                    });
                }
                
                const extrudeSettings = { 
                    depth: lThick, 
                    bevelEnabled: true, 
                    bevelSegments: 5, 
                    curveSegments: 64,
                    steps: 1, 
                    bevelSize: lThick * 0.02, 
                    bevelThickness: lThick * 0.015 
                };
                const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                const iMesh = new THREE.InstancedMesh(geo, matFrame, cols * rows);
                iMesh.castShadow = true; iMesh.receiveShadow = true;
                
                const dummy = new THREE.Object3D();
                let idx = 0;
                for (let c = 0; c < cols; c++) {
                    for (let rIdx = 0; rIdx < rows; rIdx++) {
                        dummy.position.set(-iW/2 + (c + 0.5) * stepX, -iH/2 + (rIdx + 0.5) * stepY, -lThick/2);
                        dummy.updateMatrix();
                        iMesh.setMatrixAt(idx++, dummy.matrix);
                    }
                }
                latticeGroup.add(iMesh);
            } else if (entity.jaliPattern === 'modern') {
                const targetStep = entity.jaliPatternSize || 4;
                const cols = Math.max(1, Math.round(iW / targetStep));
                const stepX = iW / cols;
                for (let c = 1; c < cols; c++) {
                    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.5, iH, lThick), matFrame);
                    slat.position.set(-iW/2 + c * stepX, 0, 0); slat.castShadow = true; latticeGroup.add(slat);
                }
            } else {
                const defaultStep = entity.jaliPattern === 'geometric' ? 6 : 8;
                const targetStep = entity.jaliPatternSize || defaultStep;
                const cols = Math.max(1, Math.round(iW / targetStep));
                const rows = Math.max(1, Math.round(iH / targetStep));
                const stepX = iW / cols;
                const stepY = iH / rows;
                
                for (let c = 0; c < cols; c++) {
                    const vBar = new THREE.Mesh(new THREE.BoxGeometry(1, iH, lThick), matBox);
                    vBar.position.set(-iW/2 + (c + 0.5) * stepX, 0, 0); vBar.castShadow = true; latticeGroup.add(vBar);
                }
                for (let r = 0; r < rows; r++) {
                    const hBar = new THREE.Mesh(new THREE.BoxGeometry(iW, 1, lThick), matBox);
                    hBar.position.set(0, -iH/2 + (r + 0.5) * stepY, 0); hBar.castShadow = true; latticeGroup.add(hBar);
                }
                
                if (entity.jaliPattern === 'islamic') {
                    const diagLen = Math.hypot(stepX, stepY);
                    const angle = Math.atan2(stepY, stepX);
                    for (let c = 0; c < cols; c++) {
                        for (let r = 0; r < rows; r++) {
                            const cx = -iW/2 + (c + 0.5) * stepX;
                            const cy = -iH/2 + (r + 0.5) * stepY;
                            const c1 = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.5, lThick), matBox);
                            c1.position.set(cx, cy, 0); c1.rotation.z = angle; c1.castShadow = true; latticeGroup.add(c1);
                            const c2 = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.5, lThick), matBox);
                            c2.position.set(cx, cy, 0); c2.rotation.z = -angle; c2.castShadow = true; latticeGroup.add(c2);
                        }
                    }
                }
            }
            jaliGroup.add(latticeGroup);
            const hitboxGeo = new THREE.BoxGeometry(entity.width + 10, height + 10, (entity.thick || 20) + 10);
            const hitbox = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}));
            hitbox.position.set(0, height/2, 0); jaliGroup.add(hitbox);
            jaliGroup.userData = { isWidget: true, entity: entity }; sceneGroup.add(jaliGroup);
            return jaliGroup;
        }
    },
    'door': {
        widget: "door", label: "DOOR",
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 40, height: DOOR_HEIGHT, doorType: 'single', materials: { leaf: { id: 'wood_golden_teak' }, frame: { id: 'wood_golden_teak' } }, facing: 1, side: 1 },
        render2D: (group, entity) => {
            const hw = entity.width / 2; const thick = entity.wall.thickness || entity.wall.config.thickness;
            const slWidth = (entity.hasSidelights && (!entity.doorShape || entity.doorShape === 'square') && !['pocket', 'sliding'].includes(entity.doorType)) ? Math.min(60, entity.width * 0.22) : 0;
            const doorW = entity.width - (slWidth * 2);
            const doorHW = doorW / 2;
            const pivotBase = hw - slWidth;
            
            if (slWidth > 0) {
                group.add(new Konva.Rect({ x: -hw, y: -thick/2, width: slWidth, height: thick, fill: '#bae6fd', opacity: 0.3, stroke: '#9ca3af' }));
                group.add(new Konva.Rect({ x: hw - slWidth, y: -thick/2, width: slWidth, height: thick, fill: '#bae6fd', opacity: 0.3, stroke: '#9ca3af' }));
            }

            if (entity.doorType === 'single') {
                const hingeX = (entity.side === 1) ? pivotBase : -pivotBase; const arcRot = (entity.side === 1) ? ((entity.facing === 1) ? 180 : 90) : ((entity.facing === 1) ? 270 : 0); 
                group.add(new Konva.Arc({ x: hingeX, y: 0, innerRadius: doorW, outerRadius: doorW, angle: 90, stroke: '#9ca3af', dash: [4, 4], rotation: arcRot }), new Konva.Line({ points: [hingeX, 0, hingeX, -doorW * entity.facing], stroke: '#374151', strokeWidth: 3 })); 
            } else if (entity.doorType === 'double' || entity.doorType === 'french') { 
                const arcRotL = entity.facing === 1 ? 270 : 0, arcRotR = entity.facing === 1 ? 180 : 90; 
                group.add(new Konva.Arc({ x: -pivotBase, y: 0, innerRadius: doorHW, outerRadius: doorHW, angle: 90, rotation: arcRotL, stroke: '#9ca3af', dash: [4, 4] }), new Konva.Line({ points: [-pivotBase, 0, -pivotBase, -doorHW * entity.facing], stroke: '#374151', strokeWidth: 3 }), new Konva.Arc({ x: pivotBase, y: 0, innerRadius: doorHW, outerRadius: doorHW, angle: 90, rotation: arcRotR, stroke: '#9ca3af', dash: [4, 4] }), new Konva.Line({ points: [pivotBase, 0, pivotBase, -doorHW * entity.facing], stroke: '#374151', strokeWidth: 3 })); 
            } else if (entity.doorType === 'sliding' || entity.doorType === 'double_sliding') { 
                const off = thick * 0.2; group.add(new Konva.Line({ points: [-doorHW, -off, 0, -off], stroke: '#374151', strokeWidth: 3 }), new Konva.Line({ points: [0, off, doorHW, off], stroke: '#374151', strokeWidth: 3 })); 
            } else if (entity.doorType === 'pocket') { 
                const slideDir = entity.facing === 1 ? 1 : -1;
                group.add(new Konva.Line({ points: [-doorHW, 0, doorHW, 0], stroke: '#374151', strokeWidth: 3 }));
                const trackStart = slideDir === 1 ? doorHW : -doorHW;
                const trackEnd = trackStart + (doorW * slideDir);
                group.add(new Konva.Line({ points: [trackStart, 0, trackEnd, 0], stroke: '#374151', strokeWidth: 3, dash: [4,4] })); 
            } else if (entity.doorType === 'pivot') { 
                const pivotX = entity.side === 1 ? pivotBase - 10 : -pivotBase + 10, arcRot = entity.side === 1 ? (entity.facing===1?180:90) : (entity.facing===1?270:0); group.add(new Konva.Line({ points: [pivotX, doorW*0.2*entity.facing, pivotX, -doorW*0.8*entity.facing], stroke: '#374151', strokeWidth: 3 }), new Konva.Arc({ x: pivotX, y: 0, innerRadius: doorW*0.8, outerRadius: doorW*0.8, angle: 90, rotation: arcRot, stroke: '#9ca3af', dash: [4, 4] })); 
            } else if (entity.doorType === 'folding') { 
                const qw = doorW / 4; group.add(new Konva.Line({ points: [-doorHW, 0, -doorHW + qw, -qw*entity.facing], stroke: '#374151', strokeWidth: 3 }), new Konva.Line({ points: [-doorHW + qw, -qw*entity.facing, 0, 0], stroke: '#374151', strokeWidth: 3 })); 
            }
        },
        render3D: (sceneGroup, entity, helpers) => {
            let baseElev = entity.elevation || 0;
            let height = entity.height || DOOR_HEIGHT;
            let bottomY = baseElev;
            const doorGroup = new THREE.Group(); 
            if (entity.localX !== undefined) {
                doorGroup.position.set(entity.localX, bottomY, 0);
                doorGroup.rotation.y = 0;
            } else {
                doorGroup.position.set(entity.x, bottomY, entity.z);
                doorGroup.rotation.y = -entity.angle;
            }
            const isSliding = entity.doorType === 'sliding' || entity.doorType === 'double_sliding' || entity.doorType === 'pocket';
            const fW = 4; const fThick = entity.thick + 0.2;
            MaterialManager.initEntityMaterials(entity);
            const matLeafKey = entity.materials?.[MaterialSlots.LEAF]?.id || 'wood_golden_teak';
            const frameMatKey = entity.materials?.[MaterialSlots.FRAME]?.id || matLeafKey;
            
            const matDoor = helpers.getDynamicMaterial(matLeafKey, 'door'); 
            const matFrame = helpers.getDynamicMaterial(frameMatKey, 'door');
            const matThreshold = helpers.getDynamicMaterial(entity.materials?.[MaterialSlots.TRIM]?.id || frameMatKey, 'door');
            
            // Apply a slight bevel to standard wood materials for realism (1mm edge bevel)
            // Handled via createBeveledExtrude default parameter

            
            // Helper to tag frame meshes so GizmoManager knows it's the frame
            const metalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 });
            const tagFrame = (mesh) => {
                if (Array.isArray(mesh)) {
                    mesh.forEach(m => m.userData = { ...m.userData, isFrame: true });
                } else {
                    mesh.userData = { ...mesh.userData, isFrame: true };
                }
                return mesh;
            };
            const createBeveledExtrude = (w, h, d, b=0.04) => { // 0.04 units ~ 1mm bevel for realism
                const wAdj = Math.max(0.01, w - b*2);
                const hAdj = Math.max(0.01, h - b*2);
                const shape = new THREE.Shape(); const hw = wAdj/2, hh = hAdj/2;
                shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
                const dAdj = Math.max(0.01, d - b*2);
                const ex = new THREE.ExtrudeGeometry(shape, { depth: dAdj, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: b, bevelThickness: b });
                ex.translate(0, 0, -dAdj/2);
                const uvs = ex.attributes.uv, pos = ex.attributes.position;
                if(uvs && pos) { for(let i=0; i<uvs.count; i++) { uvs.setXY(i, (pos.getX(i)+hw)/wAdj, (pos.getY(i)+hh)/hAdj); } uvs.needsUpdate = true; }
                return ex;
            };
            const rotateUvs = (geo) => {
                const uvs = geo.attributes.uv;
                if(uvs) { for(let i=0; i<uvs.count; i++) { const u = uvs.getX(i)-0.5, v = uvs.getY(i)-0.5; uvs.setXY(i, -v+0.5, u+0.5); } uvs.needsUpdate = true; }
                return geo;
            };

            const isGlassDoor = matLeafKey === 'glass'; 
            const jambW = 0.75; const stopW = 1.25; const stopThick = 0.4; const archW = 2.75; const archThick = 0.5;
            const frameWidth = jambW; const frameThick = entity.thick + 0.2; const doorThick = 1.4; // Frame lines wall cutout; door leaf is 35 mm slim real-world BIM depth 
            const gapSide = 0.12; const gapTop = 0.12; 
            
            // Threshold — separate optional piece sitting ON the floor (NOT a bottom frame)
            // Real doors: Header + Left Jamb + Right Jamb + optional Threshold. No bottom frame member.
            const isPocket = entity.doorType === 'pocket';
            const hasThreshold = !isPocket && entity.hasThreshold !== false; // default: true, but false for pocket
            const tHeight = hasThreshold ? 0.9 : 0; // 22.86mm (~20-25mm range) when present
            const doorClearance = 0.35; // 8.89mm gap between door bottom and threshold top (or floor)
            const gapBottom = tHeight + doorClearance; // door leaf Y starts here
            
            if (hasThreshold) {
                // Threshold fits exactly between the side jambs to look like a bottom frame piece
                const thresholdW = entity.width - jambW * 2;
                const tDepth = frameThick; // flush with frame
                const thresholdGeo = rotateUvs(createBeveledExtrude(thresholdW, tHeight, tDepth, 0.03));
                const threshold = tagFrame(new THREE.Mesh(thresholdGeo, matFrame)); // MATCH FRAME WOOD
                threshold.position.set(0, -bottomY + tHeight/2, 0);
                threshold.receiveShadow = true; threshold.castShadow = true;
                threshold.userData = { ...threshold.userData, isThreshold: true };
                doorGroup.add(threshold);
            }
            
            // Sill plate — fills the below-floor gap in the wall cutout (wallBottom=-1 to floor=0)
            const sillHeight = 1.0; 
            const totalFrameW = entity.width + archW * 2 - jambW * 2;
            const sillGeo = rotateUvs(createBeveledExtrude(totalFrameW, sillHeight, frameThick, 0.01));
            const sillPlate = new THREE.Mesh(sillGeo, matFrame); // MATCH FRAME WOOD
            sillPlate.position.set(0, -bottomY - sillHeight/2, 0);
            sillPlate.receiveShadow = true;
            sillPlate.userData = { isFrame: true, isSillPlate: true };
            doorGroup.add(sillPlate);
            
            const slWidth = (entity.hasSidelights && (!entity.doorShape || entity.doorShape === 'square') && !['pocket', 'sliding'].includes(entity.doorType)) ? Math.min(60, entity.width * 0.22) : 0;
            const leafWidth = entity.width - (frameWidth * 2) - (gapSide * 2) - (slWidth * 2); const leafHeight = height - frameWidth - gapTop - gapBottom;
            const baseOpenAngle = (entity.openAngle !== undefined ? entity.openAngle : 0) * (Math.PI / 180);
            const openAngle = baseOpenAngle * (entity.facing === 1 ? 1 : -1); const pivotXOffset = -entity.width/2 + frameWidth + slWidth + gapSide/2; 
            const hingePinZ = doorThick/2; 
            
            // Contact shadow — soft AO shadow on the floor under the door
            const cShadowCanvas = document.createElement('canvas'); cShadowCanvas.width = 256; cShadowCanvas.height = 64;
            const cShadowCtx = cShadowCanvas.getContext('2d');
            if (cShadowCtx) {
                const grad = cShadowCtx.createLinearGradient(0, 0, 0, 64);
                grad.addColorStop(0, 'rgba(0,0,0,0.35)');
                grad.addColorStop(0.3, 'rgba(0,0,0,0.12)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                cShadowCtx.fillStyle = grad; cShadowCtx.fillRect(0, 0, 256, 64);
            }
            const cShadowTex = new THREE.CanvasTexture(cShadowCanvas);
            const cShadowMat = new THREE.MeshBasicMaterial({ map: cShadowTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
            const cShadowGeo = new THREE.PlaneGeometry(leafWidth + 2, doorThick + 2);
            const contactShadow = new THREE.Mesh(cShadowGeo, cShadowMat);
            contactShadow.rotation.x = -Math.PI / 2;
            contactShadow.position.set(0, -bottomY + 0.02, 0);
            contactShadow.userData = { isShadow: true };
            doorGroup.add(contactShadow);
            
            if (entity.doorType !== 'pocket') {
                const shapeType = entity.doorShape || 'square';
                if (shapeType === 'square') {
                    // Clean Butt Joints for Jambs (Head Jamb between Side Jambs)
                    const jamHeight = height + bottomY;
                    const jamY = jamHeight/2 - bottomY;
                    const jamGeo = createBeveledExtrude(jambW, jamHeight, frameThick); 
                    const jamL = tagFrame(new THREE.Mesh(jamGeo, matFrame)); jamL.position.set(-entity.width/2 + jambW/2, jamY, 0); 
                    const jamR = tagFrame(new THREE.Mesh(jamGeo, matFrame)); jamR.position.set(entity.width/2 - jambW/2, jamY, 0); 
                    const jamTGeo = rotateUvs(createBeveledExtrude(entity.width - jambW*2, jambW, frameThick)); 
                    const jamT = tagFrame(new THREE.Mesh(jamTGeo, matFrame)); jamT.position.set(0, height - jambW/2, 0);
                    [jamL, jamR, jamT].forEach(m => { m.castShadow = true; m.receiveShadow = true; doorGroup.add(m); });
                    
                    // Stops (Rebate) & Gasket
                    const swingDir = entity.facing === 1 ? 1 : -1;
                    const stopZ = -swingDir * (doorThick/2 + stopThick/2);
                    const stopBottom = -bottomY + tHeight;
                    const stopH = (height - jambW) - stopBottom;
                    const stopY = stopBottom + stopH/2;
                    const stopGeoV = createBeveledExtrude(stopW, stopH, stopThick, 0.02); 
                    const stopL = tagFrame(new THREE.Mesh(stopGeoV, matFrame)); stopL.position.set(-entity.width/2 + jambW + stopW/2, stopY, stopZ); 
                    const stopR = tagFrame(new THREE.Mesh(stopGeoV, matFrame)); stopR.position.set(entity.width/2 - jambW - stopW/2, stopY, stopZ);
                    const stopGeoH = rotateUvs(createBeveledExtrude(entity.width - jambW*2 - stopW*2, stopW, stopThick, 0.02)); 
                    const stopT = tagFrame(new THREE.Mesh(stopGeoH, matFrame)); stopT.position.set(0, height - jambW - stopW/2, stopZ);
                    [stopL, stopR, stopT].forEach(m => { m.castShadow = true; m.receiveShadow = true; doorGroup.add(m); });
                    
                    const gasketMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }); 
                    const gaskGeo = new THREE.BoxGeometry(0.1, stopH, 0.1); 
                    const gaskL = tagFrame(new THREE.Mesh(gaskGeo, gasketMat)); gaskL.position.set(-entity.width/2 + jambW + stopW + 0.05, stopY, doorThick/2 + 0.05); 
                    const gaskR = tagFrame(new THREE.Mesh(gaskGeo, gasketMat)); gaskR.position.set(entity.width/2 - jambW - stopW - 0.05, stopY, doorThick/2 + 0.05); 
                    const gaskGeoH = new THREE.BoxGeometry(entity.width - jambW*2 - stopW*2, 0.1, 0.1); 
                    const gaskT = tagFrame(new THREE.Mesh(gaskGeoH, gasketMat)); gaskT.position.set(0, height - jambW - stopW - 0.05, doorThick/2 + 0.05);
                    [gaskL, gaskR, gaskT].forEach(m => doorGroup.add(m));

                    // Architraves (Clean Butt Joints)
                    const archHeight = height + bottomY;
                    const archY = archHeight/2 - bottomY;
                    const archV = createBeveledExtrude(archW, archHeight, archThick); 
                    const archHgeo = rotateUvs(createBeveledExtrude(entity.width + archW*2, archW, archThick));
                    
                    [-frameThick/2 - archThick/2 + 0.05, frameThick/2 + archThick/2 - 0.05].forEach(zOff => { 
                        const tL = tagFrame(new THREE.Mesh(archV, matFrame)); tL.position.set(-entity.width/2 - archW/2 + jambW, archY, zOff); 
                        const tR = tagFrame(new THREE.Mesh(archV, matFrame)); tR.position.set(entity.width/2 + archW/2 - jambW, archY, zOff); 
                        const tT = tagFrame(new THREE.Mesh(archHgeo, matFrame)); tT.position.set(0, height + archW/2, zOff); 
                        
                        [tL, tR, tT].forEach(m => { m.castShadow = true; m.receiveShadow = true; doorGroup.add(m); }); 
                    });
                    
                    if (slWidth > 0) {
                        const innerJamGeo = createBeveledExtrude(jambW, height - jambW + bottomY, frameThick);
                        const iJamL = tagFrame(new THREE.Mesh(innerJamGeo, matFrame)); iJamL.position.set(-entity.width/2 + jambW + slWidth - jambW/2, (height - jambW + bottomY)/2 - bottomY, 0);
                        const iJamR = tagFrame(new THREE.Mesh(innerJamGeo, matFrame)); iJamR.position.set(entity.width/2 - jambW - slWidth + jambW/2, (height - jambW + bottomY)/2 - bottomY, 0);
                        [iJamL, iJamR].forEach(m => { m.castShadow = true; m.receiveShadow = true; doorGroup.add(m); });
                        
                        const slGlassW = slWidth - jambW;
                        const slBotGeo = createBeveledExtrude(slGlassW, 5, frameThick);
                        const slBotL = tagFrame(new THREE.Mesh(slBotGeo, matFrame)); slBotL.position.set(-entity.width/2 + jambW + slGlassW/2, 2.5, 0);
                        const slBotR = tagFrame(new THREE.Mesh(slBotGeo, matFrame)); slBotR.position.set(entity.width/2 - jambW - slGlassW/2, 2.5, 0);
                        [slBotL, slBotR].forEach(m => doorGroup.add(m));
                        
                        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_clear';
                        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
                        const slGlassGeo = new THREE.BoxGeometry(slGlassW, height - jambW - 5, 0.4);
                        const glassL = new THREE.Mesh(slGlassGeo, glassMat); glassL.position.set(-entity.width/2 + jambW + slGlassW/2, 5 + (height - jambW - 5)/2, 0);
                        const glassR = new THREE.Mesh(slGlassGeo, glassMat); glassR.position.set(entity.width/2 - jambW - slGlassW/2, 5 + (height - jambW - 5)/2, 0);
                        doorGroup.add(glassL, glassR);
                    }
                } else {
                    const createArchedFrameShape = (wOuter, hOuter, wInner, hInner, type) => {
                        const shape = new THREE.Shape();
                        const hwO = wOuter / 2;
                        const hwI = wInner / 2;
                        
                        shape.moveTo(-hwO, -bottomY);
                        if (type === 'radius') {
                            const strHO = Math.max(0, hOuter - hwO);
                            shape.lineTo(-hwO, strHO);
                            if (hwO > 0) shape.absarc(0, strHO, hwO, Math.PI, 0, true);
                        } else if (type === 'segment') {
                            const riseO = wOuter * 0.15;
                            const strHO = Math.max(0, hOuter - riseO);
                            shape.lineTo(-hwO, strHO);
                            shape.quadraticCurveTo(0, hOuter + riseO*0.5, hwO, strHO);
                        } else if (type === 'gothic') {
                            const strHO = Math.max(0, hOuter - (wOuter * 0.7));
                            shape.lineTo(-hwO, strHO);
                            shape.quadraticCurveTo(-hwO * 0.2, hOuter, 0, hOuter);
                            shape.quadraticCurveTo(hwO * 0.2, hOuter, hwO, strHO);
                        }
                        
                        shape.lineTo(hwO, -bottomY);
                        shape.lineTo(hwI, -bottomY);
                        
                        if (type === 'radius') {
                            const strHI = Math.max(0, hInner - hwI);
                            shape.lineTo(hwI, strHI);
                            if (hwI > 0) shape.absarc(0, strHI, hwI, 0, Math.PI, false);
                        } else if (type === 'segment') {
                            const riseI = wInner * 0.15;
                            const strHI = Math.max(0, hInner - riseI);
                            shape.lineTo(hwI, strHI);
                            shape.quadraticCurveTo(0, hInner + riseI*0.5, -hwI, strHI);
                        } else if (type === 'gothic') {
                            const strHI = Math.max(0, hInner - (wInner * 0.7));
                            shape.lineTo(hwI, strHI);
                            shape.quadraticCurveTo(hwI * 0.2, hInner, 0, hInner);
                            shape.quadraticCurveTo(-hwI * 0.2, hInner, -hwI, strHI);
                        }
                        
                        shape.lineTo(-hwI, -bottomY);
                        shape.lineTo(-hwO, -bottomY);
                        return shape;
                    };
                    
                    const frameShape = createArchedFrameShape(entity.width, height, entity.width - (frameWidth * 2), height - frameWidth, shapeType);
                    const jamGeo = new THREE.ExtrudeGeometry(frameShape, { depth: frameThick, bevelEnabled: false });
                    jamGeo.translate(0, 0, -frameThick/2);
                    const jam = tagFrame(new THREE.Mesh(jamGeo, matFrame));
                    jam.position.set(0, 0, 0);
                    jam.castShadow = true; jam.receiveShadow = true; doorGroup.add(jam);
                    
                    [-frameThick/2 - 0.25, frameThick/2 + 0.25].forEach(zOff => {
                        const trimShape = createArchedFrameShape(entity.width + 8, height + 4, entity.width - (frameWidth * 2), height - frameWidth, shapeType);
                        const trimGeo = new THREE.ExtrudeGeometry(trimShape, { depth: 0.5, bevelEnabled: false });
                        trimGeo.translate(0, 0, -0.25);
                        const trim = tagFrame(new THREE.Mesh(trimGeo, matFrame));
                        trim.position.set(0, 0, zOff);
                        trim.castShadow = true; trim.receiveShadow = true; doorGroup.add(trim);
                    });
                }
            }
            if (entity.doorType === 'single') {
                const hingeHolder = new THREE.Group(); 
                if (entity.side === 1) { 
                    const panel = buildDetailedDoorPanel(entity, leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers); 
                    hingeHolder.position.set(-(pivotXOffset + gapSide/2), gapBottom, hingePinZ); 
                    panel.position.set(-leafWidth/2, 0, -hingePinZ); 
                    hingeHolder.rotation.y = -openAngle; 
                    hingeHolder.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: -(entity.facing === 1 ? 1 : -1) };
                    hingeHolder.add(panel);
                } else { 
                    const panel = buildDetailedDoorPanel(entity, leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); 
                    hingeHolder.position.set(pivotXOffset + gapSide/2, gapBottom, hingePinZ); 
                    panel.position.set(leafWidth/2, 0, -hingePinZ); 
                    hingeHolder.rotation.y = openAngle; 
                    hingeHolder.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: (entity.facing === 1 ? 1 : -1) };
                    hingeHolder.add(panel);
                } 
                doorGroup.add(hingeHolder);
            } else if (entity.doorType === 'double' || entity.doorType === 'french') {
                const hw = leafWidth / 2 - gapSide/2; 
                const hL = new THREE.Group(); hL.position.set(pivotXOffset + gapSide/2, gapBottom, hingePinZ); hL.rotation.y = openAngle; 
                hL.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: (entity.facing === 1 ? 1 : -1) };
                const panelL = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); 
                panelL.position.set(hw/2, 0, -hingePinZ); hL.add(panelL);
                
                const hR = new THREE.Group(); hR.position.set(-(pivotXOffset + gapSide/2), gapBottom, hingePinZ); hR.rotation.y = -openAngle;
                hR.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: -(entity.facing === 1 ? 1 : -1) };
                const panelR = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers); 
                panelR.position.set(-hw/2, 0, -hingePinZ); hR.add(panelR);
                
                const isLeftActive = entity.side === -1;
                const inactivePanel = isLeftActive ? panelR : panelL;
                const astragalW = 1.0; const astragalThick = 0.5;
                const astragalGeo = createBeveledExtrude(astragalW, leafHeight, astragalThick, 0.04);
                const astragal = new THREE.Mesh(astragalGeo, matFrame);
                const astX = isLeftActive ? -hw/2 : hw/2;
                astragal.position.set(astX, leafHeight/2, doorThick/2 + astragalThick/2);
                astragal.castShadow = true; inactivePanel.add(astragal);
                
                doorGroup.add(hL, hR);
            } else if (entity.doorType === 'sliding' || entity.doorType === 'double_sliding') {
                const trackMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.5 }); const trackW = doorThick * 2.5; const trackGeo = new THREE.BoxGeometry(leafWidth, 0.5, trackW); 
                const trackT = new THREE.Mesh(trackGeo, trackMat); trackT.position.set(0, height - frameWidth - 0.25, 0); const trackB = new THREE.Mesh(trackGeo, trackMat); trackB.position.set(0, gapBottom - 0.25, 0); doorGroup.add(trackT, trackB);
                const overlap = 2; 
                if (entity.doorType === 'sliding') {
                    const hw = (leafWidth / 2) + (overlap / 2);
                    const maxSlide = hw - overlap;
                    const openPercent = entity.openAngle !== undefined ? entity.openAngle / 180 : 0;
                    const slideAmount = maxSlide * openPercent;
                    const pFixed = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); pFixed.position.set(hw/2 - overlap/2, gapBottom, -doorThick/2 - 0.1); doorGroup.add(pFixed);
                    const pSlide = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers); pSlide.position.set(-hw/2 + overlap/2 + slideAmount, gapBottom, doorThick/2 + 0.1); 
                    pSlide.userData = { isMovingPart: true, motionType: 'slide', baseX: -hw/2 + overlap/2, maxSlide: maxSlide };
                    doorGroup.add(pSlide);
                } else {
                    const hw = (leafWidth / 4) + (overlap / 2);
                    const maxSlide = hw - overlap;
                    const openPercent = entity.openAngle !== undefined ? entity.openAngle / 180 : 0;
                    const slideAmount = maxSlide * openPercent;
                    const pFixL = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 0, helpers); pFixL.position.set(-leafWidth/2 + hw/2, gapBottom, -doorThick/2 - 0.1);
                    const pFixR = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 0, helpers); pFixR.position.set(leafWidth/2 - hw/2, gapBottom, -doorThick/2 - 0.1);
                    const pSlideL = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers); pSlideL.position.set(-leafWidth/4 + overlap/2 + slideAmount, gapBottom, doorThick/2 + 0.1); 
                    pSlideL.userData = { isMovingPart: true, motionType: 'slide', baseX: -leafWidth/4 + overlap/2, maxSlide: -(hw - overlap) };
                    const pSlideR = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); pSlideR.position.set(leafWidth/4 - overlap/2 - slideAmount, gapBottom, doorThick/2 + 0.1);
                    pSlideR.userData = { isMovingPart: true, motionType: 'slide', baseX: leafWidth/4 - overlap/2, maxSlide: (hw - overlap) };
                    doorGroup.add(pFixL, pFixR, pSlideL, pSlideR);
                }
            } else if (entity.doorType === 'pocket') {
                const passageW = entity.width;
                const pocketDoorThick = 1.75; // Premium 44.5mm thickness
                const widthBetweenJambs = passageW - frameWidth*2;
                const overlap = 1.0; // Extend 1 unit into pocket so it's fully captive
                const pLeafW = widthBetweenJambs + overlap; 
                const pLeafH = height - frameWidth - gapTop - gapBottom;
                const slideDir = entity.facing === 1 ? 1 : -1; // 1 = slide right, -1 = slide left
                
                const strikeX = -slideDir * (passageW/2 - frameWidth/2);
                const pocketX = slideDir * (passageW/2 - frameWidth/2);
                
                // 1. Strike Jamb (opposite of pocket)
                const jamGeoStrike = createBeveledExtrude(frameWidth, height + bottomY, frameThick);
                const jamStrike = tagFrame(new THREE.Mesh(jamGeoStrike, matFrame));
                jamStrike.position.set(strikeX, (height + bottomY)/2 - bottomY, 0);
                
                // 2. Split Jamb (Pocket Entrance)
                const splitJambThick = (frameThick - pocketDoorThick - 0.24) / 2; // ~3mm reveal clearance each side
                const splitGeo = createBeveledExtrude(frameWidth, height + bottomY, splitJambThick);
                const jamR_front = tagFrame(new THREE.Mesh(splitGeo, matFrame));
                jamR_front.position.set(pocketX, (height + bottomY)/2 - bottomY, frameThick/2 - splitJambThick/2);
                const jamR_back = tagFrame(new THREE.Mesh(splitGeo, matFrame));
                jamR_back.position.set(pocketX, (height + bottomY)/2 - bottomY, -frameThick/2 + splitJambThick/2);
                
                // 3. Head Track (Spans across the passage)
                const headGeo = rotateUvs(createBeveledExtrude(passageW - frameWidth*2, frameWidth, frameThick));
                const head = tagFrame(new THREE.Mesh(headGeo, matFrame));
                head.position.set(0, height - frameWidth/2, 0);
                
                // 4. Internal AO Contact Shadow plane inside pocket
                const pocketShadowCanvas = document.createElement('canvas'); pocketShadowCanvas.width = 32; pocketShadowCanvas.height = 256;
                const pCtx = pocketShadowCanvas.getContext('2d');
                if (pCtx) {
                    const grad = pCtx.createLinearGradient(0, 0, 32, 0);
                    grad.addColorStop(slideDir === 1 ? 0 : 1, 'rgba(0,0,0,0.6)'); grad.addColorStop(slideDir === 1 ? 1 : 0, 'rgba(0,0,0,0)');
                    pCtx.fillStyle = grad; pCtx.fillRect(0, 0, 32, 256);
                }
                const pTex = new THREE.CanvasTexture(pocketShadowCanvas);
                const pShadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(8, height), new THREE.MeshBasicMaterial({ map: pTex, transparent: true, depthWrite: false }));
                pShadowPlane.position.set(pocketX + (slideDir * 3), height/2, 0);
                
                doorGroup.add(jamStrike, jamR_front, jamR_back, head, pShadowPlane);
                
                // 5. Pocket Door Panel
                // When closed, edge touches strike jamb perfectly
                const strikeInnerX = -slideDir * (passageW/2 - frameWidth);
                const p = buildDetailedDoorPanel(entity, pLeafW, pLeafH, pocketDoorThick, matDoor, entity.doorType, isGlassDoor, -slideDir, helpers); 
                const openPercent = entity.openAngle !== undefined ? entity.openAngle / 180 : 0;
                const baseX = strikeInnerX + slideDir * (pLeafW / 2);
                const maxSlide = slideDir * widthBetweenJambs;
                
                p.position.set(baseX + maxSlide * openPercent, gapBottom, 0);
                p.userData = { isMovingPart: true, motionType: 'slide', baseX: baseX, maxSlide: maxSlide };
                doorGroup.add(p);
            } else if (entity.doorType === 'pivot') {
                const p = buildDetailedDoorPanel(entity, leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); const off = leafWidth * 0.15; p.position.set(leafWidth/2 - off, gapBottom, 0);
                const pivot = new THREE.Group(); const signX = entity.side === 1 ? 1 : -1; pivot.position.set(pivotXOffset + off, 0, 0); pivot.rotation.y = -openAngle * signX; pivot.add(p);
                pivot.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: -signX * (entity.facing === 1 ? 1 : -1) };
                doorGroup.add(pivot);
                const plateGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16); const floorPlate = new THREE.Mesh(plateGeo, metalMat); floorPlate.position.set(pivotXOffset + off, 0.2, 0); const topPlate = new THREE.Mesh(plateGeo, metalMat); topPlate.position.set(pivotXOffset + off, height - 0.2, 0); doorGroup.add(floorPlate, topPlate);
            } else if (entity.doorType === 'folding') {
                const numPanels = 2;
                const trackGeo = new THREE.BoxGeometry(entity.width - frameWidth*2, 1.5, doorThick + 1); const track = new THREE.Mesh(trackGeo, metalMat); track.position.set(0, height - frameWidth/2 - 0.75, 0); doorGroup.add(track);
                const panelW = (leafWidth - (gapSide * (numPanels - 1))) / numPanels; const swingDir = entity.facing === 1 ? 1 : -1; const isRightHinge = entity.side === 1; const signX = isRightHinge ? 1 : -1;
                
                const pivot1 = new THREE.Group(); pivot1.position.set(pivotXOffset * -signX, gapBottom, hingePinZ); 
                pivot1.rotation.y = baseOpenAngle * (entity.facing === 1 ? 1 : -1); 
                pivot1.userData = { isMovingPart: true, motionType: 'bifold_main', motionSign: (entity.facing === 1 ? 1 : -1) };
                doorGroup.add(pivot1);
                const p1HingeSide = isRightHinge ? -1 : 1; const p1 = buildDetailedDoorPanel(entity, panelW, leafHeight, doorThick, matDoor, 'folding_main', isGlassDoor, p1HingeSide, helpers); p1.position.set((panelW/2 + gapSide/2) * -signX, 0, -hingePinZ * swingDir); pivot1.add(p1);
                
                const pivot2 = new THREE.Group(); pivot2.position.set((panelW + gapSide) * -signX, 0, 0); 
                pivot2.rotation.y = -baseOpenAngle * 2 * (entity.facing === 1 ? 1 : -1); 
                pivot2.userData = { isMovingPart: true, motionType: 'bifold_lead', motionSign: -2 * (entity.facing === 1 ? 1 : -1) };
                pivot1.add(pivot2);
                const p2 = buildDetailedDoorPanel(entity, panelW, leafHeight, doorThick, matDoor, 'folding_lead', isGlassDoor, p1HingeSide, helpers); p2.position.set((panelW/2 + gapSide/2) * -signX, 0, 0); pivot2.add(p2);
                const jointHingeGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 12); [leafHeight * 0.85, leafHeight * 0.5, leafHeight * 0.15].forEach(yPos => { const hingeMesh = new THREE.Mesh(jointHingeGeo, metalMat); hingeMesh.position.set(0, yPos, (doorThick/2 + 0.1) * swingDir); pivot2.add(hingeMesh); });
                const guidePin = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 8), metalMat); guidePin.position.set((panelW - 2) * -signX, leafHeight, 0); p2.add(guidePin); p1.add(pivot2);
            }
            const hitboxGeo = new THREE.BoxGeometry(entity.width + 10, height + 10, (entity.thick || 20) + 10);
            const hitbox = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}));
            hitbox.position.set(0, height/2, 0);
            doorGroup.add(hitbox);
            doorGroup.userData = { isWidget: true, entity: entity };
            doorGroup.traverse(child => {
                if (child && child.isMesh && !child.userData?.isHitbox) {
                    child.userData.entity = entity;
                    const isFrame = Boolean(child.userData?.isFrame);
                    const isGlass = Boolean(child.userData?.isGlass);
                    const isHandle = Boolean(child.userData?.isHandle);
                    let slotName = child.userData?.materialSlot || (isFrame ? MaterialSlots.FRAME : (isGlass ? MaterialSlots.GLASS : (isHandle ? MaterialSlots.HARDWARE : MaterialSlots.LEAF)));
                    child.userData.materialSlot = slotName;
                    ComponentRegistry.registerMesh(entity, slotName, child, { componentId: `${entity.id}_${slotName}` });
                }
            });
            sceneGroup.add(doorGroup);
            return doorGroup;
        }
    },
    'window': {
        widget: "window", label: "WINDOW",
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 50, height: WINDOW_HEIGHT, elevation: WINDOW_SILL, windowType: 'sliding_std', materials: { frame: { id: 'wood_teak' }, glass: { id: 'clear' } }, grillePattern: 'grid', facing: 1, side: 1 },
        render2D: (group, entity) => {
            const hw = entity.width / 2;
            const thick = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || 20) : 20;
            const halfThick = thick / 2;
            const wConf = WINDOW_TYPES[entity.windowType] || WINDOW_TYPES.sliding_std;

            // 1. Wall Cutout End Cap Lines (Left & Right Jamb Termination Caps)
            group.add(new Konva.Line({ points: [-hw, -halfThick, -hw, halfThick], stroke: '#374151', strokeWidth: 2.5 }));
            group.add(new Konva.Line({ points: [hw, -halfThick, hw, halfThick], stroke: '#374151', strokeWidth: 2.5 }));

            // 2. Wall Sill Edge Boundary Lines (Outer & Inner Sill Limits)
            group.add(new Konva.Line({ points: [-hw, -halfThick, hw, -halfThick], stroke: '#6b7280', strokeWidth: 1.5 }));
            group.add(new Konva.Line({ points: [-hw, halfThick, hw, halfThick], stroke: '#6b7280', strokeWidth: 1.5 }));

            // 3. Glass Pane Body (Soft Architectural Blue Fill)
            group.add(new Konva.Rect({
                x: -hw + 3,
                y: -thick * 0.2,
                width: entity.width - 6,
                height: thick * 0.4,
                fill: '#e0f2fe',
                opacity: 0.45,
                stroke: '#38bdf8',
                strokeWidth: 1
            }));

            // 4. Window Type Specific Architectural Symbols
            if (wConf.type === 'sliding') {
                const off = thick * 0.16;
                // Overlapping dual sliding sash lines matching CAD standards
                group.add(new Konva.Line({ points: [-hw + 4, -off, 2, -off], stroke: '#1f2937', strokeWidth: 3, lineCap: 'round' }));
                group.add(new Konva.Line({ points: [-2, off, hw - 4, off], stroke: '#1f2937', strokeWidth: 3, lineCap: 'round' }));
            } else if (wConf.type === 'casement' || wConf.type === 'traditional') {
                const hingeX = (entity.side === 1) ? hw : -hw;
                const arcRot = (entity.side === 1) ? ((entity.facing === 1) ? 180 : 90) : ((entity.facing === 1) ? 270 : 0);
                group.add(new Konva.Arc({ x: hingeX, y: 0, innerRadius: entity.width * 0.8, outerRadius: entity.width * 0.8, angle: 60, stroke: '#9ca3af', dash: [4, 4], rotation: arcRot }));
                group.add(new Konva.Line({ points: [hingeX, 0, hingeX, -entity.width * 0.7 * entity.facing], stroke: '#1f2937', strokeWidth: 3, lineCap: 'round' }));
            } else if (wConf.type === 'louver') {
                const numSlats = 4;
                const step = (entity.width - 8) / numSlats;
                for (let i = 0; i < numSlats; i++) {
                    const x = -hw + 4 + i * step;
                    group.add(new Konva.Line({ points: [x, -thick * 0.25, x + step * 0.8, thick * 0.25], stroke: '#374151', strokeWidth: 2 }));
                }
            } else if (wConf.type === 'bay') {
                const offset = 14 * (entity.facing === 1 ? 1 : -1);
                group.add(new Konva.Line({ points: [-hw, 0, -hw + 10, offset, hw - 10, offset, hw, 0], stroke: '#1f2937', strokeWidth: 3, lineCap: 'round' }));
            } else { // Fixed
                group.add(new Konva.Line({ points: [-hw + 4, 0, hw - 4, 0], stroke: '#1f2937', strokeWidth: 3 }));
            }

            // 5. Grill Pattern Line Indicator (4-Column Iron Grid Indicators)
            const grillePattern = entity.grillePattern || 'grid';
            if (grillePattern && grillePattern !== 'none') {
                const numCols = 4;
                const colStep = (entity.width - 8) / numCols;
                for (let k = 1; k < numCols; k++) {
                    const xTick = -hw + 4 + k * colStep;
                    group.add(new Konva.Line({ points: [xTick, -halfThick * 0.6, xTick, halfThick * 0.6], stroke: '#1c1c1c', strokeWidth: 2, dash: [2, 2] }));
                }
            }
        },
        render3D: (sceneGroup, entity, helpers) => {
            let baseElev = entity.elevation !== undefined ? entity.elevation : WINDOW_SILL;
            let rawHeight = entity.height !== undefined ? entity.height : WINDOW_HEIGHT;
            let bottomY = Math.max(0.2, baseElev);
            let topY = baseElev + rawHeight;
            let height = topY - bottomY;
            const winGroup = new THREE.Group(); 
            if (entity.localX !== undefined) {
                winGroup.position.set(entity.localX, bottomY, 0);
                winGroup.rotation.y = 0;
            } else {
                winGroup.position.set(entity.x, bottomY, entity.z);
                winGroup.rotation.y = -entity.angle;
            }
            const wConf = WINDOW_TYPES[entity.windowType] || WINDOW_TYPES.sliding_std;
            MaterialManager.initEntityMaterials(entity);
            const matFrame = helpers.getDynamicMaterial(entity.materials?.[MaterialSlots.FRAME]?.id || 'wood_teak', 'window_frame');
            const matGlass = helpers.getDynamicMaterial(entity.materials?.[MaterialSlots.GLASS]?.id || 'clear', 'window_glass');
            if (matGlass) matGlass.envMapIntensity = 2.5;
            const isTrad = wConf.type === 'traditional';
            const isBay = wConf.type === 'bay';
            const wallThickness = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || entity.thick || 20) : (entity.thick || 20);
            const fW = isTrad ? 3.5 : 1.8;
            const fThick = isTrad ? wallThickness + 2 : wallThickness + 0.5; // Spans full wall cutout
            const zOffset = isBay ? 12 : 0; 
            
            const matMetalHardware = new THREE.MeshStandardMaterial({ color: 0x2a303c, metalness: 0.90, roughness: 0.22 });
            const matRunnerRail = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.95, roughness: 0.15 });
            const matRollerBrass = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.90, roughness: 0.25 });
            const matRubberSeal = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.85, metalness: 0.0 });
            const matGrille = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, metalness: 0.85, roughness: 0.35 });
            const matConcrete = new THREE.MeshStandardMaterial({ color: 0xd4d4d4, roughness: 0.9 });

            const matsFrameRaw = (helpers && helpers.getFaceMaterials) ? helpers.getFaceMaterials(entity, matFrame, { width: entity.width, height: height, thick: fThick }).box : matFrame;
            const matsExtrude = Array.isArray(matsFrameRaw) ? [matsFrameRaw[4] || matsFrameRaw[0], matsFrameRaw[1] || matsFrameRaw[0]] : matsFrameRaw;

            // --- Unified Frame Material Reference ---
            const matsExtrudeStile = matsExtrude;
            const matsExtrudeRail = matsExtrude;

            // --- 3D Geometry Helper with Chamfers & UV Mapping ---
            const createBeveledRect = (w, h, depth, bSize = 0.25, bThick = 0.25) => {
                const shape = new THREE.Shape();
                const hw = w / 2, hh = h / 2;
                shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
                const d = Math.max(0.01, depth - bThick * 2);
                const geo = new THREE.ExtrudeGeometry(shape, {
                    depth: d,
                    bevelEnabled: true,
                    bevelSegments: 3,
                    steps: 1,
                    bevelSize: Math.min(bSize, w * 0.15, h * 0.15),
                    bevelThickness: Math.min(bThick, depth * 0.2)
                });
                geo.translate(0, 0, -d / 2);
                const uvs = geo.attributes.uv;
                const pos = geo.attributes.position;
                if (uvs && pos) {
                    for (let i = 0; i < uvs.count; i++) {
                        uvs.setXY(i, (pos.getX(i) + hw) / w, (pos.getY(i) + hh) / h);
                    }
                    uvs.needsUpdate = true;
                }
                return geo;
            };

            const rotateUVs = (geo) => {
                const uvs = geo.attributes.uv;
                if (uvs) {
                    for (let i = 0; i < uvs.count; i++) {
                        const u = uvs.getX(i) - 0.5;
                        const v = uvs.getY(i) - 0.5;
                        uvs.setXY(i, -v + 0.5, u + 0.5); // 90 degree rotation for horizontal grain
                    }
                    uvs.needsUpdate = true;
                }
                return geo;
            };

            // --- 45 Degree Miter Joint Member Generators ---
            const createMiterRailTopGeo = (length, memberW, depth, bSize = 0.15, bThick = 0.15) => {
                const shape = new THREE.Shape();
                const hl = length / 2, hw = memberW / 2;
                shape.moveTo(-hl, hw);
                shape.lineTo(hl, hw);
                shape.lineTo(hl - memberW, -hw);
                shape.lineTo(-hl + memberW, -hw);
                shape.lineTo(-hl, hw);
                const d = Math.max(0.01, depth - bThick * 2);
                const geo = new THREE.ExtrudeGeometry(shape, {
                    depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1,
                    bevelSize: Math.min(bSize, memberW * 0.12, length * 0.05),
                    bevelThickness: Math.min(bThick, depth * 0.15)
                });
                geo.translate(0, 0, -d / 2);
                const uvs = geo.attributes.uv, pos = geo.attributes.position;
                if (uvs && pos) {
                    for (let i = 0; i < uvs.count; i++) {
                        uvs.setXY(i, (pos.getX(i) + hl) / length, (pos.getY(i) + hw) / memberW);
                    }
                    uvs.needsUpdate = true;
                }
                return geo;
            };

            const createMiterRailBotGeo = (length, memberW, depth, bSize = 0.15, bThick = 0.15) => {
                const shape = new THREE.Shape();
                const hl = length / 2, hw = memberW / 2;
                shape.moveTo(-hl, -hw);
                shape.lineTo(hl, -hw);
                shape.lineTo(hl - memberW, hw);
                shape.lineTo(-hl + memberW, hw);
                shape.lineTo(-hl, -hw);
                const d = Math.max(0.01, depth - bThick * 2);
                const geo = new THREE.ExtrudeGeometry(shape, {
                    depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1,
                    bevelSize: Math.min(bSize, memberW * 0.12, length * 0.05),
                    bevelThickness: Math.min(bThick, depth * 0.15)
                });
                geo.translate(0, 0, -d / 2);
                const uvs = geo.attributes.uv, pos = geo.attributes.position;
                if (uvs && pos) {
                    for (let i = 0; i < uvs.count; i++) {
                        uvs.setXY(i, (pos.getX(i) + hl) / length, (pos.getY(i) + hw) / memberW);
                    }
                    uvs.needsUpdate = true;
                }
                return geo;
            };

            const createMiterStileLeftGeo = (length, memberW, depth, bSize = 0.15, bThick = 0.15) => {
                const shape = new THREE.Shape();
                const hl = length / 2, hw = memberW / 2;
                shape.moveTo(-hw, -hl);
                shape.lineTo(-hw, hl);
                shape.lineTo(hw, hl - memberW);
                shape.lineTo(hw, -hl + memberW);
                shape.lineTo(-hw, -hl);
                const d = Math.max(0.01, depth - bThick * 2);
                const geo = new THREE.ExtrudeGeometry(shape, {
                    depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1,
                    bevelSize: Math.min(bSize, memberW * 0.12, length * 0.05),
                    bevelThickness: Math.min(bThick, depth * 0.15)
                });
                geo.translate(0, 0, -d / 2);
                const uvs = geo.attributes.uv, pos = geo.attributes.position;
                if (uvs && pos) {
                    for (let i = 0; i < uvs.count; i++) {
                        uvs.setXY(i, (pos.getX(i) + hw) / memberW, (pos.getY(i) + hl) / length);
                    }
                    uvs.needsUpdate = true;
                }
                return geo;
            };

            const createMiterStileRightGeo = (length, memberW, depth, bSize = 0.15, bThick = 0.15) => {
                const shape = new THREE.Shape();
                const hl = length / 2, hw = memberW / 2;
                shape.moveTo(hw, -hl);
                shape.lineTo(hw, hl);
                shape.lineTo(-hw, hl - memberW);
                shape.lineTo(-hw, -hl + memberW);
                shape.lineTo(hw, -hl);
                const d = Math.max(0.01, depth - bThick * 2);
                const geo = new THREE.ExtrudeGeometry(shape, {
                    depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1,
                    bevelSize: Math.min(bSize, memberW * 0.12, length * 0.05),
                    bevelThickness: Math.min(bThick, depth * 0.15)
                });
                geo.translate(0, 0, -d / 2);
                const uvs = geo.attributes.uv, pos = geo.attributes.position;
                if (uvs && pos) {
                    for (let i = 0; i < uvs.count; i++) {
                        uvs.setXY(i, (pos.getX(i) + hw) / memberW, (pos.getY(i) + hl) / length);
                    }
                    uvs.needsUpdate = true;
                }
                return geo;
            };

            // --- 1. Outer Architectural Frame Assembly (45° Miter Joints, Tracks, Runner Rails & Drainage) ---
            const buildOuterFrame = (totalW, totalH) => {
                const frameGroup = new THREE.Group();

                // 45-degree mitered outer frame members
                const geoRailT = createMiterRailTopGeo(totalW, fW, fThick);
                const geoRailB = createMiterRailBotGeo(totalW, fW, fThick);
                const geoStileL = createMiterStileLeftGeo(totalH, fW, fThick);
                const geoStileR = createMiterStileRightGeo(totalH, fW, fThick);

                const stileL = new THREE.Mesh(geoStileL, matsExtrudeStile); stileL.position.set(-totalW / 2 + fW / 2, totalH / 2, 0);
                const stileR = new THREE.Mesh(geoStileR, matsExtrudeStile); stileR.position.set(totalW / 2 - fW / 2, totalH / 2, 0);
                const railT = new THREE.Mesh(geoRailT, matsExtrudeRail); railT.position.set(0, totalH - fW / 2, 0);
                const railB = new THREE.Mesh(geoRailB, matsExtrudeRail); railB.position.set(0, fW / 2, 0);

                [stileL, stileR, railT, railB].forEach(m => {
                    m.castShadow = true; m.receiveShadow = true; m.userData = { isFrame: true };
                    frameGroup.add(m);
                });

                // Stepped Sash Seating Rebate (Decorative inner step)
                const rebateW = 0.5, rebateD = fThick * 0.15;
                const geoRebateV = createBeveledRect(rebateW, totalH - fW * 2, rebateD, 0.08, 0.08);
                const geoRebateH = rotateUVs(createBeveledRect(totalW - fW * 2, rebateW, rebateD, 0.08, 0.08));

                const rebL = new THREE.Mesh(geoRebateV, matsExtrudeStile); rebL.position.set(-totalW / 2 + fW + rebateW / 2, totalH / 2, fThick / 2 - rebateD / 2);
                const rebR = new THREE.Mesh(geoRebateV, matsExtrudeStile); rebR.position.set(totalW / 2 - fW - rebateW / 2, totalH / 2, fThick / 2 - rebateD / 2);
                const rebT = new THREE.Mesh(geoRebateH, matsExtrudeRail); rebT.position.set(0, totalH - fW - rebateW / 2, fThick / 2 - rebateD / 2);
                const rebB = new THREE.Mesh(geoRebateH, matsExtrudeRail); rebB.position.set(0, fW + rebateW / 2, fThick / 2 - rebateD / 2);
                [rebL, rebR, rebT, rebB].forEach(m => { m.castShadow = true; m.userData = { isFrame: true }; frameGroup.add(m); });

                // Architectural Sliding Track Channels & Dual Runner Rails with Micro Guide Grooves
                const trackW = totalW - fW * 2;
                const sThick = entity.thick * 0.35; // 35 mm slim sash depth (30% reduction for lightweight engineered look)

                // Upper Header Track Channel with Guide Grooves
                const headerTrackGeo = new THREE.BoxGeometry(trackW, 0.5, sThick * 2.2);
                const headerTrack = new THREE.Mesh(headerTrackGeo, matMetalHardware);
                headerTrack.position.set(0, totalH - fW - 0.25, 0);
                frameGroup.add(headerTrack);

                frameGroup.position.set(0, 0, zOffset);
                return frameGroup;
            };

            winGroup.add(buildOuterFrame(entity.width, height));

            const iW = entity.width - fW * 2;
            const iH = height - fW * 2;
            const sThick = 1.35; // 34 mm slim engineered sash depth (real-world BIM standard)

            // --- 2. Window Sash Assembly (45° Miter Joints, Sash Rollers, Interlockers, Glazing Beads, PBR Glass & Hardware) ---
            const makeSash = (w, h, useGlass = true, isCasement = false, hingeSide = 1, slotName = MaterialSlots.FRAME) => {
                const sG = new THREE.Group();
                const shadowGap = 0.2; // 2 mm shadow gap
                const sashW = w - shadowGap * 2;
                const sashH = h - shadowGap * 2;
                const sFw = isTrad ? 2.2 : 1.25; // 32 mm slim architectural sash profile width

                // 45-degree Mitered Sash Stiles & Rails with Directional Grain & Board Variation
                const geoStileL = createMiterStileLeftGeo(sashH, sFw, sThick);
                const geoStileR = createMiterStileRightGeo(sashH, sFw, sThick);
                const geoRailT = createMiterRailTopGeo(sashW, sFw, sThick);
                const geoRailB = createMiterRailBotGeo(sashW, sFw, sThick);

                const s1 = new THREE.Mesh(geoStileL, matsExtrudeStile); s1.position.set(-sashW / 2 + sFw / 2, sashH / 2, 0);
                const s2 = new THREE.Mesh(geoStileR, matsExtrudeStile); s2.position.set(sashW / 2 - sFw / 2, sashH / 2, 0);
                const r1 = new THREE.Mesh(geoRailT, matsExtrudeRail); r1.position.set(0, sashH - sFw / 2, 0);
                const r2 = new THREE.Mesh(geoRailB, matsExtrudeRail); r2.position.set(0, sFw / 2, 0);

                const sashCompId = `${entity.id}_${slotName}`;
                [s1, s2, r1, r2].forEach(m => {
                    m.castShadow = true; m.receiveShadow = true;
                    m.userData = { isFrame: true, materialSlot: slotName, componentId: sashCompId };
                    ComponentRegistry.registerMesh(entity, slotName, m, { componentId: sashCompId, componentType: ComponentTypes.SASH });
                    sG.add(m);
                });

                // Sash Roller Wheel Assemblies (Bottom Edge Sitting on Runner Rails with Axle Pins)
                [ -sashW * 0.35, sashW * 0.35 ].forEach(xWheel => {
                    const rollerGroup = new THREE.Group();
                    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, sThick * 0.8), matMetalHardware);
                    housing.position.set(0, -0.25, 0);
                    const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 16);
                    wheelGeo.rotateZ(Math.PI / 2);
                    const wheel = new THREE.Mesh(wheelGeo, matRollerBrass);
                    wheel.position.set(0, -0.45, 0);
                    const axlePin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8), matMetalHardware);
                    axlePin.rotation.x = Math.PI / 2; axlePin.position.set(0, -0.45, 0);
                    rollerGroup.add(housing, wheel, axlePin);
                    rollerGroup.position.set(xWheel, 0, 0);
                    sG.add(rollerGroup);
                });

                const cutoutW = sashW - sFw * 2;
                const cutoutH = sashH - sFw * 2;

                if (useGlass) {
                    // 45° Mitered Glazing Beads (Inner Beveled Trim with Glass Recess Depth)
                    const beadW = 0.35, beadDepth = sThick * 0.4;
                    const bGeoStileL = createMiterStileLeftGeo(cutoutH + beadW * 2, beadW, beadDepth, 0.06, 0.06);
                    const bGeoStileR = createMiterStileRightGeo(cutoutH + beadW * 2, beadW, beadDepth, 0.06, 0.06);
                    const bGeoRailT = createMiterRailTopGeo(cutoutW + beadW * 2, beadW, beadDepth, 0.06, 0.06);
                    const bGeoRailB = createMiterRailBotGeo(cutoutW + beadW * 2, beadW, beadDepth, 0.06, 0.06);

                    const bL = new THREE.Mesh(bGeoStileL, matsExtrudeStile); bL.position.set(-cutoutW / 2 + beadW / 2, sashH / 2, 0);
                    const bR = new THREE.Mesh(bGeoStileR, matsExtrudeStile); bR.position.set(cutoutW / 2 - beadW / 2, sashH / 2, 0);
                    const bT = new THREE.Mesh(bGeoRailT, matsExtrudeRail); bT.position.set(0, sashH - sFw - beadW / 2, 0);
                    const bB = new THREE.Mesh(bGeoRailB, matsExtrudeRail); bB.position.set(0, sFw + beadW / 2, 0);
                    [bL, bR, bT, bB].forEach(m => { m.castShadow = true; m.userData = { isFrame: true }; sG.add(m); });

                    // Rubber Weather Seal Gaskets (EPDM Black Gasket Reveal)
                    const sealW = 0.15;
                    const geoSealV = new THREE.BoxGeometry(sealW, cutoutH, sThick * 0.3);
                    const geoSealH = new THREE.BoxGeometry(cutoutW, sealW, sThick * 0.3);

                    const sealL = new THREE.Mesh(geoSealV, matRubberSeal); sealL.position.set(-cutoutW / 2 + sealW / 2, sashH / 2, 0);
                    const sealR = new THREE.Mesh(geoSealV, matRubberSeal); sealR.position.set(cutoutW / 2 - sealW / 2, sashH / 2, 0);
                    const sealT = new THREE.Mesh(geoSealH, matRubberSeal); sealT.position.set(0, sashH - sFw - sealW / 2, 0);
                    const sealB = new THREE.Mesh(geoSealH, matRubberSeal); sealB.position.set(0, sFw + sealW / 2, 0);
                    [sealL, sealR, sealT, sealB].forEach(m => { m.userData = { isSeal: true, materialSlot: MaterialSlots.SEAL }; sG.add(m); });

                    // Recessed Physical 3D Glass Pane (6-8 mm Thickness with PBR Refraction & Fresnel Reflections)
                    const glassDepth = 0.6;
                    const glassGeo = new THREE.BoxGeometry(cutoutW - beadW * 1.4, cutoutH - beadW * 1.4, glassDepth);
                    const glass = new THREE.Mesh(glassGeo, matGlass);
                    glass.position.set(0, sashH / 2, -beadDepth * 0.2);
                    glass.userData = { isGlass: true, materialSlot: MaterialSlots.GLASS };
                    sG.add(glass);

                    // Hardware 1: Sleek Architectural Lever Handle with Lock Rods or Recessed Flush Pull
                    const handleGroup = new THREE.Group();
                    if (isCasement) {
                        const backplate = new THREE.Mesh(createBeveledRect(0.8, 3.5, 0.2, 0.04, 0.04), matMetalHardware); backplate.position.set(0, 0, sThick / 2 + 0.1);
                        const leverNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 12), matMetalHardware); leverNeck.rotation.x = Math.PI / 2; leverNeck.position.set(0, 0, sThick / 2 + 0.3);
                        const leverHandle = new THREE.Mesh(createBeveledRect(0.5, 4.2, 0.2, 0.05, 0.05), matMetalHardware); leverHandle.position.set(0, -1.8, sThick / 2 + 0.5);
                        
                        // Top and Bottom Vertical Cremone Lock Rods
                        const lockRodGeo = new THREE.CylinderGeometry(0.12, 0.12, sashH * 0.35, 8);
                        const rodTop = new THREE.Mesh(lockRodGeo, matMetalHardware); rodTop.position.set(0, sashH * 0.22, sThick / 2 + 0.1);
                        const rodBot = new THREE.Mesh(lockRodGeo, matMetalHardware); rodBot.position.set(0, -sashH * 0.22, sThick / 2 + 0.1);
                        
                        handleGroup.add(backplate, leverNeck, leverHandle, rodTop, rodBot);
                        const handleX = hingeSide === 1 ? sashW / 2 - sFw / 2 : -sashW / 2 + sFw / 2;
                        handleGroup.position.set(handleX, sashH * 0.42, 0);
                    } else {
                        // Recessed Metal Flush Pull for Sliding Windows
                        const flushPullBack = new THREE.Mesh(createBeveledRect(1.4, 5.5, 0.3, 0.05, 0.05), matMetalHardware); flushPullBack.position.set(0, 0, sThick / 2 + 0.08);
                        const flushPullCup = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.8, 0.25), new THREE.MeshBasicMaterial({ color: 0x0a0a0a })); flushPullCup.position.set(0, 0, sThick / 2 + 0.15);
                        const lockToggle = new THREE.Mesh(createBeveledRect(0.4, 0.8, 0.2, 0.03, 0.03), matRollerBrass); lockToggle.position.set(0, 2.0, sThick / 2 + 0.2);
                        handleGroup.add(flushPullBack, flushPullCup, lockToggle);
                        handleGroup.position.set(sashW / 2 - sFw / 2, sashH * 0.42, 0);
                    }
                    handleGroup.traverse(m => { if (m && m.isMesh) m.userData = { isHandle: true, materialSlot: MaterialSlots.HARDWARE }; });
                    sG.add(handleGroup);

                    // Hardware 2: Butt Hinges for Casement Windows
                    if (isCasement) {
                        const hingeX = hingeSide === 1 ? -sashW / 2 : sashW / 2;
                        [sashH * 0.8, sashH * 0.2].forEach(yPos => {
                            const hingeGroup = new THREE.Group();
                            const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5, 12), matMetalHardware);
                            const leafL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.15), matMetalHardware); leafL.position.set(-0.4, 0, 0);
                            const leafR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.15), matMetalHardware); leafR.position.set(0.4, 0, 0);
                            hingeGroup.add(pin, leafL, leafR);
                            hingeGroup.position.set(hingeX, yPos, sThick / 2);
                            sG.add(hingeGroup);
                        });
                    }
                } else {
                    // Solid Wooden Raised Panel (For Traditional Shutters)
                    const panelGeo = createBeveledRect(cutoutW, cutoutH, sThick * 0.5, 0.3, 0.3);
                    const woodPanel = new THREE.Mesh(panelGeo, matsExtrudeStile);
                    woodPanel.position.set(0, sashH / 2, 0);
                    woodPanel.userData = { isFrame: true };
                    sG.add(woodPanel);
                }

                sG.position.set(0, shadowGap, 0);
                return sG;
            };

            // --- 3. Window Type Specific Layouts ---
            if (wConf.type === 'fixed') {
                const sash = makeSash(iW, iH);
                sash.position.set(0, fW, zOffset);
                winGroup.add(sash);
            } else if (wConf.type === 'casement' || wConf.type === 'traditional') {
                const hw = iW / 2;
                const useGlass = wConf.type !== 'traditional';
                const openAngle = Math.PI / 6; // Moderate natural 30° preview opening angle

                const sL = makeSash(hw, iH, useGlass, true, 1, MaterialSlots.SASH_LEFT);
                const pL = new THREE.Group(); pL.position.set(-iW / 2, fW, zOffset); sL.position.set(hw / 2, 0, 0); pL.rotation.y = openAngle * entity.facing; pL.add(sL);

                const sR = makeSash(hw, iH, useGlass, true, -1, MaterialSlots.SASH_RIGHT);
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

                    // Vertical Interlocker Seal Strip on Meeting Stile
                    const interlockerGeo = new THREE.BoxGeometry(0.4, iH - 0.5, sThick * 0.8);
                    const interlocker = new THREE.Mesh(interlockerGeo, matMetalHardware);
                    interlocker.position.set(i === 0 ? hw / 2 - 0.4 : -hw / 2 + 0.4, iH / 2, 0);
                    sash.add(interlocker);

                    sash.position.set(xPos, fW, zOffset + zOff);
                    winGroup.add(sash);
                }
            } else if (wConf.type === 'louver') {
                const slatH = 5.5;
                const count = Math.floor(iH / (slatH - 0.6));
                for (let i = 0; i < count; i++) {
                    const slatGeo = createBeveledRect(iW - 1.2, slatH, 0.6, 0.08, 0.08);
                    const slat = new THREE.Mesh(slatGeo, matGlass);
                    slat.position.set(0, fW + (i * (slatH - 0.6)) + slatH / 2, zOffset);
                    slat.rotation.x = Math.PI / 5;
                    winGroup.add(slat);
                }
            } else if (wConf.type === 'bay') {
                const frontW = iW * 0.6; const frontSash = makeSash(frontW, iH); frontSash.position.set(0, fW, zOffset); winGroup.add(frontSash);
                const sideW = Math.hypot(iW * 0.2, zOffset); const sideAng = Math.atan2(zOffset, iW * 0.2);
                const sL = makeSash(sideW, iH); sL.position.set(-iW / 2 + (iW * 0.2) / 2, fW, zOffset / 2); sL.rotation.y = -sideAng;
                const sR = makeSash(sideW, iH); sR.position.set(iW / 2 - (iW * 0.2) / 2, fW, zOffset / 2); sR.rotation.y = sideAng;
                winGroup.add(sL, sR);

                const capShape = new THREE.Shape(); capShape.moveTo(-iW / 2 - fW, 0); capShape.lineTo(iW / 2 + fW, 0); capShape.lineTo(frontW / 2 + fW, zOffset + fThick / 2); capShape.lineTo(-frontW / 2 - fW, zOffset + fThick / 2);
                const capGeo = new THREE.ExtrudeGeometry(capShape, { depth: fW, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2 }); capGeo.rotateX(Math.PI / 2);
                const capT = new THREE.Mesh(capGeo, matsExtrudeRail); capT.position.set(0, height, 0);
                const capB = new THREE.Mesh(capGeo, matsExtrudeRail); capB.position.set(0, fW, 0);
                [capT, capB].forEach(m => m.userData = { isFrame: true });
                winGroup.add(capT, capB);
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

            // --- 4. Architectural 3D Grill Bars (8mm Profile & 4x4 Grid Lines) ---
            const activePattern = entity.grillePattern || 'grid';
            if (activePattern && activePattern !== 'none') {
                const grilleGroup = new THREE.Group();
                const grilleZ = entity.facing === 1 ? fThick / 2 - 1.0 : -fThick / 2 + 1.0; // 10 mm clearance gap from glass
                grilleGroup.position.set(0, 0, zOffset + grilleZ);

                const barWidth = 0.8, barDepth = 0.5; // 8 mm face width x 5 mm depth
                const createThinBarGeo = (w, h, depth, isRotated = false) => {
                    const shape = new THREE.Shape();
                    const hw = w / 2, hh = h / 2;
                    shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
                    const geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false, steps: 1 });
                    geo.translate(0, 0, -depth / 2);
                    if (isRotated) rotateUVs(geo);
                    return geo;
                };

                const makeVBar = (x) => {
                    const barGroup = new THREE.Group();
                    const geo = createThinBarGeo(barWidth, iH, barDepth, false);
                    const mesh = new THREE.Mesh(geo, matGrille);
                    mesh.position.set(0, height / 2, 0);
                    mesh.castShadow = true;
                    barGroup.add(mesh);
                    barGroup.position.set(x, 0, 0);
                    return barGroup;
                };

                const makeHBar = (y) => {
                    const barGroup = new THREE.Group();
                    const geo = createThinBarGeo(iW, barWidth, barDepth, true);
                    const mesh = new THREE.Mesh(geo, matGrille);
                    mesh.position.set(0, y, 0);
                    mesh.castShadow = true;
                    barGroup.add(mesh);
                    return barGroup;
                };

                const numCols = entity.grilleCols || 4; // 4 columns (3 vertical muntin bars)
                const numRows = entity.grilleRows || 4; // 4 rows (3 horizontal muntin bars)
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
                        const vMesh = new THREE.Mesh(createThinBarGeo(barWidth, maxDim, barDepth, false), matGrille);
                        vMesh.position.set(i, 0, 0);
                        dGroup.add(vMesh);
                        const hMesh = new THREE.Mesh(createThinBarGeo(maxDim, barWidth, barDepth, true), matGrille);
                        hMesh.position.set(0, i, 0);
                        dGroup.add(hMesh);
                    }
                    dGroup.rotation.z = Math.PI / 4;
                    dGroup.position.set(0, height / 2, 0);
                    grilleGroup.add(dGroup);
                }
                winGroup.add(grilleGroup);
            }

            // Hitbox for selection & gizmo interactions
            const hitboxGeo = new THREE.BoxGeometry(entity.width + 10, height + 10, (entity.thick || 20) + 10);
            const hitbox = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
            hitbox.position.set(0, height / 2, 0);
            winGroup.add(hitbox);
            winGroup.userData = { isWidget: true, entity: entity };
            winGroup.traverse(child => {
                if (child && child.isMesh && !child.userData?.isHitbox) {
                    child.userData.entity = entity;
                    const isGlass = Boolean(child.userData?.isGlass);
                    const isHandle = Boolean(child.userData?.isHandle);
                    const isSeal = Boolean(child.userData?.isSeal);
                    let slotName = child.userData?.materialSlot || (isGlass ? MaterialSlots.GLASS : (isHandle ? MaterialSlots.HARDWARE : (isSeal ? MaterialSlots.SEAL : MaterialSlots.FRAME)));
                    child.userData.materialSlot = slotName;
                    ComponentRegistry.registerMesh(entity, slotName, child, { componentId: `${entity.id}_${slotName}` });
                }
            });
            sceneGroup.add(winGroup);
            return winGroup;
        }
    },
    'sunshade': {
        widget: "sunshade", label: "SUNSHADE / CHAJJA", cutsWall: false,
        events: ["drag_along_wall", "snap_to_corners", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 60, elevation: 90, thick: 20, chajjaType: 'concrete_slab', facing: -1, depth: 40 },
        render2D: (group, entity) => {
            const hw = entity.width / 2;
            const w = entity.width; 
            const d = entity.depth || 40; 
            const thick = entity.wall?.thickness || entity.wall?.config?.thickness || 20;
            const wallOffset = thick / 2; 
            // Default to pointing OUTSIDE (negative Y) for clockwise rooms
            const signY = entity.facing === 1 ? 1 : -1; 
            const rectY = signY === 1 ? wallOffset : -wallOffset - d;
            
            const rect = new Konva.Rect({ 
                x: -hw, y: rectY, width: w, height: d, 
                fill: '#fcd34d', opacity: 0.4, stroke: '#f59e0b', strokeWidth: 1 
            });
            group.add(rect);
        },
        render3D: (sceneGroup, entity, helpers) => {
            const sunshadeGroup = new THREE.Group();
            let baseElev = entity.elevation || 90;
            sunshadeGroup.position.set(entity.x, baseElev, entity.z);
            sunshadeGroup.rotation.y = -entity.angle;

            const thick = entity.thick || 20;
            const wallOffset = thick / 2; 
            // Default to pointing OUTSIDE (negative Z) for clockwise rooms
            const signZ = (entity.facing === -1) ? -1 : 1;
            
            const contentGroup = new THREE.Group();
            contentGroup.position.z = wallOffset * signZ;
            sunshadeGroup.add(contentGroup);

            let chajjaStyle = entity.chajjaType || 'concrete_slab';
            const matConcrete = helpers.getDynamicMaterial('concrete', 'wall');
            const cDepth = entity.depth || 40;
            
            let mmBox = matConcrete;
            let mmExtrude = matConcrete;
            if (helpers && helpers.getFaceMaterials) {
                const mats = helpers.getFaceMaterials(entity, matConcrete, { width: entity.width, height: cDepth });
                
                // Inherit painted material for unpainted faces of the sunshade
                const p = entity.params || {};
                const paintedMat = mats.box.find((m, i) => {
                    const key = ['textureRight', 'textureLeft', 'textureTop', 'textureBottom', 'textureFront', 'textureBack'][i];
                    return p[key];
                });
                if (paintedMat) {
                    for (let i = 0; i < 6; i++) {
                        const key = ['textureRight', 'textureLeft', 'textureTop', 'textureBottom', 'textureFront', 'textureBack'][i];
                        if (!p[key]) {
                            mats.box[i] = paintedMat;
                        }
                    }
                }
                
                mmBox = mats.box;
                mmExtrude = mats.extrude;
            }
            
            if (chajjaStyle === 'concrete_slab') {
                const cH = 2; 
                const cGeo = new THREE.BoxGeometry(entity.width, cH, cDepth); 
                const cMesh = new THREE.Mesh(cGeo, mmBox); 
                cMesh.position.set(0, cH/2, (cDepth/2) * signZ); 
                cMesh.castShadow = true; 
                contentGroup.add(cMesh);
            } else if (chajjaStyle === 'wooden_pergola' || chajjaStyle === 'metal_louvers') {
                const isWood = chajjaStyle === 'wooden_pergola';
                const cMat = isWood ? JALI_MATERIALS['wood'] : JALI_MATERIALS['metal_black'];
                const matLouver = new THREE.MeshStandardMaterial({
                    color: cMat.color, roughness: cMat.roughness, metalness: cMat.metalness
                });
                
                const cWidth = entity.width;
                const joistWidth = isWood ? 2 : 2;
                const joistHeight = isWood ? 8 : 8;
                const joistGeo = new THREE.BoxGeometry(joistWidth, joistHeight, cDepth);
                
                const jL = new THREE.Mesh(joistGeo, matLouver);
                jL.position.set(-cWidth/2 + joistWidth/2, joistHeight/2, (cDepth/2) * signZ);
                jL.castShadow = true;
                
                const jR = new THREE.Mesh(joistGeo, matLouver);
                jR.position.set(cWidth/2 - joistWidth/2, joistHeight/2, (cDepth/2) * signZ);
                jR.castShadow = true;
                
                contentGroup.add(jL, jR);
                
                const fasciaGeo = new THREE.BoxGeometry(cWidth, joistHeight, joistWidth);
                const fascia = new THREE.Mesh(fasciaGeo, matLouver);
                fascia.position.set(0, joistHeight/2, (cDepth - joistWidth/2) * signZ);
                fascia.castShadow = true;
                contentGroup.add(fascia);
                
                const numJoists = Math.max(3, Math.floor(cWidth / 40));
                if (numJoists > 2) {
                    const joistSpacing = (cWidth - joistWidth) / (numJoists - 1);
                    for (let i = 1; i < numJoists - 1; i++) {
                        const jM = new THREE.Mesh(joistGeo, matLouver);
                        jM.position.set(-cWidth/2 + joistWidth/2 + i * joistSpacing, joistHeight/2, (cDepth/2) * signZ);
                        jM.castShadow = true;
                        contentGroup.add(jM);
                    }
                }
                
                const louverThick = isWood ? 2 : 1; 
                const louverHeight = isWood ? 4 : 4;
                const spacing = isWood ? 8 : 8; 
                const numLouvers = Math.floor(cDepth / spacing);
                
                const lGeo = new THREE.BoxGeometry(cWidth, louverHeight, louverThick);
                
                for(let i=1; i<=numLouvers; i++) {
                    const l = new THREE.Mesh(lGeo, matLouver);
                    l.position.set(0, joistHeight + louverHeight/2 - (isWood ? 2 : 0), (i * spacing - louverThick/2) * signZ);
                    l.rotation.x = isWood ? 0 : (Math.PI / 4) * signZ;
                    l.castShadow = true;
                    contentGroup.add(l);
                }
            } else if (chajjaStyle === 'glass_canopy' || chajjaStyle === 'polycarbonate_canopy') {
                const isPoly = chajjaStyle === 'polycarbonate_canopy';
                const cWidth = entity.width; const glassThick = 0.5;
                const matGlassConf = GLASS_REGISTRY['clear'];
                
                let matCanopyPanel;
                if (isPoly) {
                    matCanopyPanel = new THREE.MeshPhysicalMaterial({
                        color: 0xffffff, transmission: 0.4, roughness: 0.6, transparent: true, ior: 1.2, thickness: 0.5
                    });
                } else {
                    matCanopyPanel = new THREE.MeshPhysicalMaterial({
                        color: matGlassConf.color, transmission: matGlassConf.transmission, roughness: matGlassConf.roughness, transparent: true, ior: matGlassConf.ior, thickness: 0.5
                    });
                }
                const matMetal = new THREE.MeshStandardMaterial({color: 0xe0e0e0, metalness: 0.9, roughness: 0.2});
                
                const frameThick = 1.5;
                const fSideGeo = new THREE.BoxGeometry(frameThick, frameThick, cDepth);
                const fFrontGeo = new THREE.BoxGeometry(cWidth, frameThick, frameThick);
                const fL = new THREE.Mesh(fSideGeo, matMetal); fL.position.set(-cWidth/2 + frameThick/2, frameThick/2, (cDepth/2)*signZ); fL.castShadow = true;
                const fR = new THREE.Mesh(fSideGeo, matMetal); fR.position.set(cWidth/2 - frameThick/2, frameThick/2, (cDepth/2)*signZ); fR.castShadow = true;
                const fF = new THREE.Mesh(fFrontGeo, matMetal); fF.position.set(0, frameThick/2, (cDepth - frameThick/2)*signZ); fF.castShadow = true;
                contentGroup.add(fL, fR, fF);
                
                const numPanes = Math.max(1, Math.floor(cWidth / 40));
                const paneWidth = (cWidth - frameThick * 2) / numPanes;
                for (let i = 1; i < numPanes; i++) {
                    const m = new THREE.Mesh(fSideGeo, matMetal);
                    m.position.set(-cWidth/2 + frameThick + i * paneWidth, frameThick/2, (cDepth/2)*signZ);
                    m.castShadow = true;
                    contentGroup.add(m);
                }

                const gGeo = new THREE.BoxGeometry(cWidth - frameThick*2, glassThick, cDepth - frameThick);
                const gMesh = new THREE.Mesh(gGeo, matCanopyPanel);
                gMesh.position.set(0, frameThick/2, (cDepth/2)*signZ);
                contentGroup.add(gMesh);
                
                const tieHeight = Math.max(15, cDepth * 0.6);
                const tieZ = cDepth * 0.8;
                
                const bracketGeo = new THREE.BoxGeometry(1, 4, 2);
                
                const rodPositions = [];
                if (numPanes > 1) {
                    rodPositions.push(-cWidth/2 + 4, cWidth/2 - 4);
                    for (let i=1; i<numPanes; i++) rodPositions.push(-cWidth/2 + frameThick + i * paneWidth);
                } else {
                    rodPositions.push(-cWidth/2 + 4, cWidth/2 - 4);
                }
                
                const bracketZ = 1; 
                const spiderY = frameThick/2 + 0.5;
                const dz = tieZ - bracketZ;
                const dy = tieHeight - spiderY;
                const tieLen = Math.hypot(dz, dy);
                const angle = Math.atan2(dz, dy);
                const tieGeo = new THREE.CylinderGeometry(0.2, 0.2, tieLen, 8);
                
                rodPositions.forEach(x => {
                    const tieGroup = new THREE.Group();
                    const tie = new THREE.Mesh(tieGeo, matMetal);
                    tie.position.set(0, spiderY + dy/2, ((bracketZ + tieZ)/2) * signZ);
                    tie.rotation.x = -angle * signZ;
                    tie.castShadow = true;
                    tieGroup.add(tie);
                    
                    const wBracket = new THREE.Mesh(bracketGeo, matMetal);
                    wBracket.position.set(0, tieHeight, bracketZ * signZ);
                    wBracket.castShadow = true;
                    tieGroup.add(wBracket);
                    
                    const spiderGeo = new THREE.CylinderGeometry(0.8, 0.8, 1, 8);
                    const spider = new THREE.Mesh(spiderGeo, matMetal);
                    spider.position.set(0, spiderY, tieZ * signZ);
                    spider.castShadow = true;
                    tieGroup.add(spider);
                    
                    tieGroup.position.x = x;
                    contentGroup.add(tieGroup);
                });
            } else if (chajjaStyle === 'metal_canopy') {
                const cWidth = entity.width;
                const matMetalDark = new THREE.MeshStandardMaterial({color: 0x222222, metalness: 0.5, roughness: 0.5});
                const matMetalRoof = new THREE.MeshStandardMaterial({color: 0x444444, metalness: 0.3, roughness: 0.8});
                
                const lipDrop = 4;
                const lipThick = 2;
                const roofThick = 2;
                
                const roofGeo = new THREE.BoxGeometry(cWidth, roofThick, cDepth);
                const roof = new THREE.Mesh(roofGeo, matMetalRoof);
                roof.position.set(0, lipDrop - roofThick/2, (cDepth/2)*signZ);
                roof.castShadow = true;
                contentGroup.add(roof);
                
                const fLipGeo = new THREE.BoxGeometry(cWidth, lipDrop, lipThick);
                const fLip = new THREE.Mesh(fLipGeo, matMetalDark);
                fLip.position.set(0, lipDrop/2, (cDepth - lipThick/2)*signZ);
                fLip.castShadow = true;
                contentGroup.add(fLip);
                
                const sLipGeo = new THREE.BoxGeometry(lipThick, lipDrop, cDepth - lipThick);
                const sL = new THREE.Mesh(sLipGeo, matMetalDark);
                sL.position.set(-cWidth/2 + lipThick/2, lipDrop/2, ((cDepth - lipThick)/2)*signZ);
                sL.castShadow = true;
                const sR = new THREE.Mesh(sLipGeo, matMetalDark);
                sR.position.set(cWidth/2 - lipThick/2, lipDrop/2, ((cDepth - lipThick)/2)*signZ);
                sR.castShadow = true;
                contentGroup.add(sL, sR);
            } else if (chajjaStyle === 'curved_rcc') {
                const cH = 4;
                const radius = Math.min(20, cDepth/2, entity.width/4);
                const halfW = entity.width/2;
                const shape = new THREE.Shape();
                shape.moveTo(-halfW, 0);
                shape.lineTo(-halfW, cDepth - radius);
                shape.quadraticCurveTo(-halfW, cDepth, -halfW + radius, cDepth);
                shape.lineTo(halfW - radius, cDepth);
                shape.quadraticCurveTo(halfW, cDepth, halfW, cDepth - radius);
                shape.lineTo(halfW, 0);
                shape.lineTo(-halfW, 0);
                
                const cGeo = new THREE.ExtrudeGeometry(shape, { depth: cH, bevelEnabled: false });
                const cMesh = new THREE.Mesh(cGeo, mmExtrude);
                cMesh.rotation.x = -Math.PI / 2; 
                if (signZ === 1) cMesh.rotation.y = Math.PI; 
                cMesh.position.set(0, 0, 0);
                cMesh.castShadow = true;
                contentGroup.add(cMesh);
            } else if (chajjaStyle === 'cantilever_rcc') {
                const cH = 2; 
                const cGeo = new THREE.BoxGeometry(entity.width, cH, cDepth);
                const cMesh = new THREE.Mesh(cGeo, mmBox);
                cMesh.position.set(0, cH/2, (cDepth/2) * signZ);
                cMesh.castShadow = true;
                contentGroup.add(cMesh);
            } else if (chajjaStyle === 'jali_canopy') {
                const cWidth = entity.width;
                const roofThick = 2;
                const dropH = 15;
                const matSolid = new THREE.MeshStandardMaterial({color: 0xf5f5f5, roughness: 0.9});
                
                const roofGeo = new THREE.BoxGeometry(cWidth, roofThick, cDepth);
                const roof = new THREE.Mesh(roofGeo, matSolid);
                roof.position.set(0, dropH - roofThick/2, (cDepth/2)*signZ);
                roof.castShadow = true;
                contentGroup.add(roof);
                
                const buildGrid = (w, h, mat) => {
                    const group = new THREE.Group();
                    const thick = 1;
                    const step = 5;
                    const hGeo = new THREE.BoxGeometry(w, thick, thick);
                    const vGeo = new THREE.BoxGeometry(thick, h, thick);
                    for (let y = -h/2 + step/2; y < h/2; y += step) {
                        const m = new THREE.Mesh(hGeo, mat);
                        m.position.y = y; m.castShadow = true;
                        group.add(m);
                    }
                    for (let x = -w/2 + step/2; x < w/2; x += step) {
                        const m = new THREE.Mesh(vGeo, mat);
                        m.position.x = x; m.castShadow = true;
                        group.add(m);
                    }
                    const t = new THREE.Mesh(new THREE.BoxGeometry(w, 2, 2), mat); t.position.y = h/2; t.castShadow = true; group.add(t);
                    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 2, 2), mat); b.position.y = -h/2; b.castShadow = true; group.add(b);
                    const l = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), mat); l.position.x = -w/2; l.castShadow = true; group.add(l);
                    const r = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), mat); r.position.x = w/2; r.castShadow = true; group.add(r);
                    return group;
                };
                
                const fJali = buildGrid(cWidth, dropH, matSolid);
                fJali.position.set(0, dropH/2, cDepth * signZ);
                if (signZ === -1) fJali.rotation.y = Math.PI;
                contentGroup.add(fJali);
                
                const sL = buildGrid(cDepth, dropH, matSolid);
                sL.position.set(-cWidth/2, dropH/2, (cDepth/2)*signZ);
                sL.rotation.y = -Math.PI / 2;
                
                const sR = buildGrid(cDepth, dropH, matSolid);
                sR.position.set(cWidth/2, dropH/2, (cDepth/2)*signZ);
                sR.rotation.y = Math.PI / 2;
                
                contentGroup.add(sL, sR);
            } else if (chajjaStyle === 'box_frame') {
                const cWidth = entity.width;
                const frameDrop = entity.frameHeight || 150;
                const frameThick = 6;
                
                const topGeo = new THREE.BoxGeometry(cWidth, frameThick, cDepth);
                const topM = new THREE.Mesh(topGeo, mmBox);
                topM.position.set(0, frameThick/2, (cDepth/2)*signZ);
                topM.castShadow = true;
                contentGroup.add(topM);
                
                const sideGeo = new THREE.BoxGeometry(frameThick, frameDrop, cDepth);
                const sL = new THREE.Mesh(sideGeo, mmBox);
                sL.position.set(-cWidth/2 + frameThick/2, -frameDrop/2 + frameThick, (cDepth/2)*signZ);
                sL.castShadow = true;
                
                const sR = new THREE.Mesh(sideGeo, mmBox);
                sR.position.set(cWidth/2 - frameThick/2, -frameDrop/2 + frameThick, (cDepth/2)*signZ);
                sR.castShadow = true;
                
                const botGeo = new THREE.BoxGeometry(cWidth, frameThick, cDepth);
                const botM = new THREE.Mesh(botGeo, mmBox);
                botM.position.set(0, -frameDrop + frameThick/2, (cDepth/2)*signZ);
                botM.castShadow = true;
                
                contentGroup.add(sL, sR, botM);
            }

            const hbHeight = chajjaStyle === 'box_frame' ? (entity.frameHeight || 150) : 10;
            const hbY = chajjaStyle === 'box_frame' ? -hbHeight/2 + 6 : 5;
            const hitboxGeo = new THREE.BoxGeometry(entity.width, hbHeight, cDepth);
            const hitbox = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}));
            hitbox.position.set(0, hbY, (cDepth/2)*signZ);
            hitbox.userData = { isHitbox: true };
            contentGroup.add(hitbox);
            sunshadeGroup.userData = { isWidget: true, entity: entity };
            sceneGroup.add(sunshadeGroup);
            return sunshadeGroup;
        }
    },
    'elevation_fascia': {
        widget: "elevation_fascia", label: "ELEVATION FASCIA", cutsWall: false,
        events: ["drag_along_wall", "snap_to_corners", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 100, height: 120, depth: 40, thick: 10, elevation: 0, profileType: 'c_shape_left', fasciaMat: 'white' },
        render2D: (group, entity) => {
            const hw = entity.width / 2; const thick = entity.wall ? (entity.wall.thickness || entity.wall.config.thickness) : (entity.thick || 4);
            const w = entity.width; const h = thick;
            const rect = new Konva.Rect({ x: -hw, y: -h/2, width: w, height: h, fill: '#60a5fa', stroke: '#2563eb', strokeWidth: 2, opacity: 0.5 });
            group.add(rect);
            const d = entity.depth || 40;
            const projDir = entity.facing === 1 ? 1 : -1; 
            const projY = projDir === 1 ? h/2 : -h/2 - d;
            const projRect = new Konva.Rect({ x: -hw, y: projY, width: w, height: d, stroke: '#2563eb', strokeWidth: 1, dash: [4, 4] });
            group.add(projRect);
        },
        render3D: (sceneGroup, entity, helpers) => {
            let baseElev = entity.elevation || 0; let height = entity.height || 120;
            let width = entity.width || 100; let depth = entity.depth || 40; let thick = entity.thick || 10;
            const fasciaGroup = new THREE.Group(); fasciaGroup.position.set(entity.x, baseElev, entity.z); fasciaGroup.rotation.y = -entity.angle;
            
            let fColor = 0xffffff;
            if (entity.fasciaMat === 'dark_grey') fColor = 0x333333;
            else if (entity.fasciaMat === 'stone') fColor = 0xa8a29e;
            else if (entity.fasciaMat === 'wood') fColor = 0x8b5a2b;
            const matFascia = new THREE.MeshStandardMaterial({ color: fColor, roughness: 0.8 });
            
            let blockCounter = 0;
            const createBlock = (w, h, d, x, y, z, exposed = {}, blockRadii = [0,0,0,0]) => {
                let geo;
                if (!blockRadii.some(r => r > 0)) {
                    geo = new THREE.BoxGeometry(w, h, d);
                } else {
                    const shape = new THREE.Shape();
                    const [rBL, rBR, rTR, rTL] = blockRadii;
                    if (rBL > 0) { shape.moveTo(rBL, 0); shape.absarc(rBL, rBL, rBL, Math.PI, Math.PI*1.5, false); } else shape.moveTo(0, 0);
                    if (rBR > 0) { shape.lineTo(w - rBR, 0); shape.absarc(w - rBR, rBR, rBR, Math.PI*1.5, Math.PI*2, false); } else shape.lineTo(w, 0);
                    if (rTR > 0) { shape.lineTo(w, h - rTR); shape.absarc(w - rTR, h - rTR, rTR, 0, Math.PI*0.5, false); } else shape.lineTo(w, h);
                    if (rTL > 0) { shape.lineTo(rTL, h); shape.absarc(rTL, h - rTL, rTL, Math.PI*0.5, Math.PI, false); } else shape.lineTo(0, h);
                    shape.lineTo(rBL > 0 ? 0 : 0, rBL > 0 ? rBL : 0);
                    
                    const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 8 });
                    extrudeGeo.translate(-w/2, -h/2, -d/2);
                    
                    const geoNonIdx = extrudeGeo.toNonIndexed();
                    const pos = geoNonIdx.attributes.position.array;
                    const norm = geoNonIdx.attributes.normal.array;
                    
                    const groupedVerts = [[], [], [], [], [], []];
                    const groupedNorms = [[], [], [], [], [], []];
                    const groupedUVs = [[], [], [], [], [], []];
                    
                    for (let i = 0; i < pos.length / 9; i++) {
                        const nx = norm[i*9]; const ny = norm[i*9+1]; const nz = norm[i*9+2];
                        let matIndex = 0;
                        if (nz > 0.5) matIndex = 4;
                        else if (nz < -0.5) matIndex = 5;
                        else {
                            if (Math.abs(nx) > Math.abs(ny)) matIndex = nx > 0 ? 0 : 1;
                            else matIndex = ny > 0 ? 2 : 3;
                        }
                        
                        for(let j=0; j<3; j++) {
                            const vx = pos[i*9 + j*3]; const vy = pos[i*9 + j*3 + 1]; const vz = pos[i*9 + j*3 + 2];
                            groupedVerts[matIndex].push(vx, vy, vz);
                            groupedNorms[matIndex].push(norm[i*9 + j*3], norm[i*9 + j*3 + 1], norm[i*9 + j*3 + 2]);
                            
                            let u = 0, v = 0;
                            if (matIndex === 4) { u = (vx + w/2)/w; v = (vy + h/2)/h; }
                            else if (matIndex === 5) { u = (-vx + w/2)/w; v = (vy + h/2)/h; }
                            else if (matIndex === 0) { u = (-vz + d/2)/d; v = (vy + h/2)/h; }
                            else if (matIndex === 1) { u = (vz + d/2)/d; v = (vy + h/2)/h; }
                            else if (matIndex === 2) { u = (vx + w/2)/w; v = (-vz + d/2)/d; }
                            else if (matIndex === 3) { u = (vx + w/2)/w; v = (vz + d/2)/d; }
                            groupedUVs[matIndex].push(u, v);
                        }
                    }
                    
                    geo = new THREE.BufferGeometry();
                    let flatPos = [], flatNorm = [], flatUV = [];
                    let offset = 0;
                    for(let m=0; m<6; m++) {
                        const count = groupedVerts[m].length / 3;
                        if (count > 0) {
                            flatPos.push(...groupedVerts[m]); flatNorm.push(...groupedNorms[m]); flatUV.push(...groupedUVs[m]);
                            geo.addGroup(offset, count, m); offset += count;
                        }
                    }
                    geo.setAttribute('position', new THREE.Float32BufferAttribute(flatPos, 3));
                    geo.setAttribute('normal', new THREE.Float32BufferAttribute(flatNorm, 3));
                    geo.setAttribute('uv', new THREE.Float32BufferAttribute(flatUV, 2));
                    extrudeGeo.dispose(); geoNonIdx.dispose();
                }

                let materials = matFascia;
                const blockIndex = blockCounter++;
                if (helpers && helpers.getFaceMaterials) {
                    const blockEntity = { params: {} };
                    if (entity.params) {
                        Object.assign(blockEntity.params, entity.params);
                        delete blockEntity.params.texture; delete blockEntity.params.textureFront; delete blockEntity.params.textureBack;
                        delete blockEntity.params.textureLeft; delete blockEntity.params.textureRight; delete blockEntity.params.textureTop; delete blockEntity.params.textureBottom; delete blockEntity.params.textureSides;
                    }
                    if (entity.params && entity.params.blocks && entity.params.blocks[blockIndex]) {
                        Object.assign(blockEntity.params, entity.params.blocks[blockIndex]);
                    }
                    const multiMat = helpers.getFaceMaterials(blockEntity, matFascia, { width: w, height: h });
                    materials = [ multiMat.box[0], multiMat.box[1], multiMat.box[2], multiMat.box[3], multiMat.box[4], multiMat.box[5] ];
                }
                const mesh = new THREE.Mesh(geo, materials);
                mesh.position.set(x, y + h/2, z);
                mesh.castShadow = true; mesh.receiveShadow = true;
                return mesh;
            };

            const createInnerFillet = (r, d, x, y, z, quad) => {
                if (!r || r <= 0) return;
                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                if (quad === 1) { shape.lineTo(r, 0); shape.absarc(r, r, r, Math.PI*1.5, Math.PI, true); shape.lineTo(0, r); }
                else if (quad === 2) { shape.lineTo(0, r); shape.absarc(-r, r, r, 0, Math.PI*1.5, true); shape.lineTo(-r, 0); }
                else if (quad === 3) { shape.lineTo(-r, 0); shape.absarc(-r, -r, r, Math.PI*0.5, 0, true); shape.lineTo(0, -r); }
                else if (quad === 4) { shape.lineTo(0, -r); shape.absarc(r, -r, r, Math.PI, Math.PI*0.5, true); shape.lineTo(r, 0); }
                shape.lineTo(0, 0);
                
                const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 8 });
                extrudeGeo.translate(0, 0, -d/2);
                const geoNonIdx = extrudeGeo.toNonIndexed();
                const pos = geoNonIdx.attributes.position.array;
                const norm = geoNonIdx.attributes.normal.array;
                
                const groupedVerts = [[], [], [], [], [], []];
                const groupedNorms = [[], [], [], [], [], []];
                const groupedUVs = [[], [], [], [], [], []];
                for (let i = 0; i < pos.length / 9; i++) {
                    const nx = norm[i*9]; const ny = norm[i*9+1]; const nz = norm[i*9+2];
                    let matIndex = 0;
                    if (nz > 0.5) matIndex = 4; else if (nz < -0.5) matIndex = 5;
                    else { if (Math.abs(nx) > Math.abs(ny)) matIndex = nx > 0 ? 0 : 1; else matIndex = ny > 0 ? 2 : 3; }
                    for(let j=0; j<3; j++) {
                        const vx = pos[i*9 + j*3]; const vy = pos[i*9 + j*3 + 1]; const vz = pos[i*9 + j*3 + 2];
                        groupedVerts[matIndex].push(vx, vy, vz); groupedNorms[matIndex].push(norm[i*9 + j*3], norm[i*9 + j*3 + 1], norm[i*9 + j*3 + 2]);
                        let u = 0, v = 0;
                        if (matIndex === 4) { u = vx/r; v = vy/r; } else if (matIndex === 5) { u = -vx/r; v = vy/r; }
                        else if (matIndex === 0) { u = -vz/d; v = vy/r; } else if (matIndex === 1) { u = vz/d; v = vy/r; }
                        else if (matIndex === 2) { u = vx/r; v = -vz/d; } else if (matIndex === 3) { u = vx/r; v = vz/d; }
                        groupedUVs[matIndex].push(u, v);
                    }
                }
                const geo = new THREE.BufferGeometry();
                let flatPos = [], flatNorm = [], flatUV = []; let offset = 0;
                for(let m=0; m<6; m++) {
                    const count = groupedVerts[m].length / 3;
                    if (count > 0) { flatPos.push(...groupedVerts[m]); flatNorm.push(...groupedNorms[m]); flatUV.push(...groupedUVs[m]); geo.addGroup(offset, count, m); offset += count; }
                }
                geo.setAttribute('position', new THREE.Float32BufferAttribute(flatPos, 3));
                geo.setAttribute('normal', new THREE.Float32BufferAttribute(flatNorm, 3));
                geo.setAttribute('uv', new THREE.Float32BufferAttribute(flatUV, 2));
                extrudeGeo.dispose(); geoNonIdx.dispose();

                let materials = matFascia;
                if (helpers && helpers.getFaceMaterials) {
                    const multiMat = helpers.getFaceMaterials(entity, matFascia, { width: r, height: r });
                    materials = [multiMat.box[0], multiMat.box[1], multiMat.box[2], multiMat.box[3], multiMat.box[4], multiMat.box[5]];
                }
                const mesh = new THREE.Mesh(geo, materials);
                mesh.position.set(x, y, z);
                mesh.castShadow = true; mesh.receiveShadow = true;
                fasciaGroup.add(mesh);
            };
            
            const wallThick = entity.wall ? (entity.wall.thickness || entity.wall.config.thickness) : 16;
            const zOffset = (entity.facing === -1) ? (wallThick/2 + depth/2) : -(wallThick/2 + depth/2);

            let topArm = entity.topArm !== undefined ? entity.topArm : width;
            let bottomArm = entity.bottomArm !== undefined ? entity.bottomArm : width;

            const radii = entity.cornerRadii || [];
            const getR = (idx) => Math.max(0, radii[idx] || 0);

            if (entity.profileType === 'c_shape_left') {
                fasciaGroup.add(createBlock(topArm, thick, depth, -width/2 + topArm/2, height - thick, zOffset, { bottom: false }, [0, getR(5), getR(6), getR(7)])); 
                fasciaGroup.add(createBlock(thick, height - 2*thick, depth, -width/2 + thick/2, thick, zOffset, { top: false, bottom: false, right: false })); 
                fasciaGroup.add(createBlock(bottomArm, thick, depth, -width/2 + bottomArm/2, 0, zOffset, { top: false }, [getR(0), getR(1), getR(2), 0])); 
                createInnerFillet(getR(3), depth, -width/2 + thick, thick, zOffset, 1);
                createInnerFillet(getR(4), depth, -width/2 + thick, height - thick, zOffset, 4);
                entity.computedPts = [ new THREE.Vector2(-width/2, 0), new THREE.Vector2(-width/2 + bottomArm, 0), new THREE.Vector2(-width/2 + bottomArm, thick), new THREE.Vector2(-width/2 + thick, thick), new THREE.Vector2(-width/2 + thick, height - thick), new THREE.Vector2(-width/2 + topArm, height - thick), new THREE.Vector2(-width/2 + topArm, height), new THREE.Vector2(-width/2, height) ];
            } else if (entity.profileType === 'c_shape_right') {
                fasciaGroup.add(createBlock(topArm, thick, depth, width/2 - topArm/2, height - thick, zOffset, { bottom: false }, [getR(4), 0, getR(2), getR(3)])); 
                fasciaGroup.add(createBlock(thick, height - 2*thick, depth, width/2 - thick/2, thick, zOffset, { top: false, bottom: false, left: false })); 
                fasciaGroup.add(createBlock(bottomArm, thick, depth, width/2 - bottomArm/2, 0, zOffset, { top: false }, [getR(0), getR(1), 0, getR(7)])); 
                createInnerFillet(getR(5), depth, width/2 - thick, height - thick, zOffset, 3);
                createInnerFillet(getR(6), depth, width/2 - thick, thick, zOffset, 2);
                entity.computedPts = [ new THREE.Vector2(width/2 - bottomArm, 0), new THREE.Vector2(width/2, 0), new THREE.Vector2(width/2, height), new THREE.Vector2(width/2 - topArm, height), new THREE.Vector2(width/2 - topArm, height - thick), new THREE.Vector2(width/2 - thick, height - thick), new THREE.Vector2(width/2 - thick, thick), new THREE.Vector2(width/2 - bottomArm, thick) ];
            } else if (entity.profileType === 'l_shape_left') {
                fasciaGroup.add(createBlock(topArm, thick, depth, -width/2 + topArm/2, height - thick, zOffset, { bottom: false }, [0, getR(3), getR(4), getR(5)])); 
                fasciaGroup.add(createBlock(thick, height - thick, depth, -width/2 + thick/2, 0, zOffset, { top: false, right: false }, [getR(0), getR(1), 0, 0])); 
                createInnerFillet(getR(2), depth, -width/2 + thick, height - thick, zOffset, 4);
                entity.computedPts = [ new THREE.Vector2(-width/2, 0), new THREE.Vector2(-width/2 + thick, 0), new THREE.Vector2(-width/2 + thick, height - thick), new THREE.Vector2(-width/2 + topArm, height - thick), new THREE.Vector2(-width/2 + topArm, height), new THREE.Vector2(-width/2, height) ];
            } else if (entity.profileType === 'l_shape_right') {
                fasciaGroup.add(createBlock(topArm, thick, depth, width/2 - topArm/2, height - thick, zOffset, { bottom: false }, [getR(4), 0, 0, getR(3)])); 
                fasciaGroup.add(createBlock(thick, height - thick, depth, width/2 - thick/2, 0, zOffset, { top: false, left: false }, [0, getR(1), getR(2), 0])); 
                createInnerFillet(getR(5), depth, width/2 - thick, height - thick, zOffset, 3);
                entity.computedPts = [ new THREE.Vector2(width/2 - thick, 0), new THREE.Vector2(width/2, 0), new THREE.Vector2(width/2, height), new THREE.Vector2(width/2 - topArm, height), new THREE.Vector2(width/2 - topArm, height - thick), new THREE.Vector2(width/2 - thick, height - thick) ];
            } else if (entity.profileType === 'full_box') {
                fasciaGroup.add(createBlock(width, thick, depth, 0, height - thick, zOffset, { bottom: false }, [0, 0, getR(2), getR(3)])); 
                fasciaGroup.add(createBlock(width, thick, depth, 0, 0, zOffset, { top: false }, [getR(0), getR(1), 0, 0])); 
                fasciaGroup.add(createBlock(thick, height - 2*thick, depth, -width/2 + thick/2, thick, zOffset, { top: false, bottom: false, right: false })); 
                fasciaGroup.add(createBlock(thick, height - 2*thick, depth, width/2 - thick/2, thick, zOffset, { top: false, bottom: false, left: false })); 
                createInnerFillet(getR(4), depth, -width/2 + thick, thick, zOffset, 1);
                createInnerFillet(getR(5), depth, -width/2 + thick, height - thick, zOffset, 4);
                createInnerFillet(getR(6), depth, width/2 - thick, height - thick, zOffset, 3);
                createInnerFillet(getR(7), depth, width/2 - thick, thick, zOffset, 2);
                entity.computedPts = [ new THREE.Vector2(-width/2, 0), new THREE.Vector2(width/2, 0), new THREE.Vector2(width/2, height), new THREE.Vector2(-width/2, height), new THREE.Vector2(-width/2 + thick, thick), new THREE.Vector2(-width/2 + thick, height - thick), new THREE.Vector2(width/2 - thick, height - thick), new THREE.Vector2(width/2 - thick, thick) ];
            }
            
            entity.computedZOffset = zOffset;

            const hitboxGeo = new THREE.BoxGeometry(width + 10, height + 10, depth + 20);
            const hitbox = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}));
            hitbox.position.set(0, height/2, zOffset); fasciaGroup.add(hitbox);
            
            fasciaGroup.userData = { isWidget: true, entity: entity }; sceneGroup.add(fasciaGroup);
            return fasciaGroup;
        }
    }
};

export function offsetPolygon(points, offsetAmount) {
    if (points.length < 3) return points;
    
    let isArray = Array.isArray(offsetAmount);
    if (!isArray && (!offsetAmount || offsetAmount === 0)) return points;
    
    let signedArea = 0;
    for (let i = 0; i < points.length; i++) {
        let p0 = points[i];
        let p1 = points[(i + 1) % points.length];
        signedArea += (p0.x * p1.y - p1.x * p0.y);
    }
    
    const result = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
        let prev = points[(i - 1 + n) % n];
        let curr = points[i];
        let next = points[(i + 1) % n];
        
        let e1x = curr.x - prev.x;
        let e1y = curr.y - prev.y;
        let len1 = Math.sqrt(e1x * e1x + e1y * e1y);
        if(len1 > 0) { e1x /= len1; e1y /= len1; }
        
        let e2x = next.x - curr.x;
        let e2y = next.y - curr.y;
        let len2 = Math.sqrt(e2x * e2x + e2y * e2y);
        if(len2 > 0) { e2x /= len2; e2y /= len2; }
        
        let n1x = -e1y; let n1y = e1x;
        if (signedArea > 0) { n1x = e1y; n1y = -e1x; }
        
        let n2x = -e2y; let n2y = e2x;
        if (signedArea > 0) { n2x = e2y; n2y = -e2x; }
        
        let off1 = isArray ? (offsetAmount[(i - 1 + n) % n] || 0) : offsetAmount;
        let off2 = isArray ? (offsetAmount[i] || 0) : offsetAmount;
        
        let p1x = curr.x + n1x * off1;
        let p1y = curr.y + n1y * off1;
        
        let p2x = curr.x + n2x * off2;
        let p2y = curr.y + n2y * off2;
        
        let cross = e1x * e2y - e1y * e2x;
        
        if (Math.abs(cross) < 1e-6) {
            let bx = n1x + n2x;
            let by = n1y + n2y;
            let blen = Math.sqrt(bx * bx + by * by);
            if (blen < 0.0001) { bx = n1x; by = n1y; blen = 1; }
            bx /= blen; by /= blen;
            
            let dot = bx * n1x + by * n1y;
            if (Math.abs(dot) < 0.1) dot = 0.1;
            let avgOff = (off1 + off2) / 2;
            let dist = avgOff / dot;
            
            result.push({ x: curr.x + bx * dist, y: curr.y + by * dist });
        } else {
            let dx = p2x - p1x;
            let dy = p2y - p1y;
            let t = (dx * e2y - dy * e2x) / cross;
            
            result.push({
                x: p1x + t * e1x,
                y: p1y + t * e1y
            });
        }
    }
    return result;
}

export const GIZMO_REGISTRY = {
    'roof': ['material', 'roofCorners'],
    'door': ['move', 'opening', 'material', 'style'],
    'door_french': ['move', 'opening', 'material'],
    'window': ['move', 'opening', 'material', 'style'],
    'opening': ['move', 'opening', 'material'],
    'elevation_fascia': ['move', 'place', 'scale', 'spin', 'tilt', 'material', 'corner'],
    'shape': ['move', 'place', 'scale', 'spin', 'tilt', 'material', 'vertexSlope'],
    'floor_cut': ['polygonEdges'],
    'face_material_obj': ['move', 'place', 'scale', 'spin', 'tilt', 'material'],
    'default': ['move', 'place', 'scale', 'spin', 'tilt']
};
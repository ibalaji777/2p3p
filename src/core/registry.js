import Konva from 'konva';
import * as THREE from 'three';
export * from './constants/units.js';
export * from './constants/events.js';
export * from '../features/door/door.registry.js';
export * from '../features/roof/roof.registry.js';
export { STAIRCASE_REGISTRY } from '../features/stairs/stairs.registry.js';
export { ROOF_REGISTRY } from '../features/roof/roof.components.registry.js';

export * from '../features/furniture/furniture.registry.js';
export * from '../features/railing/registry/railing.registry.js';
export * from '../features/window/window.registry.js';
export * from '../features/wall/wall.registry.js';
export * from './registries/material.registry.js';

import { DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT } from './constants/units.js';
import { WINDOW_TYPES } from '../features/window/window.registry.js';
import { JALI_MATERIALS, GLASS_REGISTRY } from './registries/material.registry.js';
import { MaterialSlots } from './constants/materialSlots.js';
import { ComponentRegistry } from './engine3d/ComponentRegistry.js';
import { BIMComponentBuilder } from './engine3d/BIMComponentBuilder.js';
import { MaterialManager } from './engine3d/MaterialManager.js';

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

export const createDoorShape = (w, h, type = 'square', halfSide = 0) => {
    const shape = new THREE.Shape();
    const hw = w / 2;
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    
    if (type === 'radius') {
        if (halfSide === 0) {
            const straightH = Math.max(0, h - hw);
            shape.lineTo(hw, straightH);
            if (hw > 0) shape.absarc(0, straightH, hw, 0, Math.PI, false);
        } else if (halfSide === -1) {
            const r = w;
            const straightH = Math.max(0, h - r);
            shape.lineTo(hw, h);
            if (r > 0) shape.absarc(hw, straightH, r, Math.PI/2, Math.PI, false);
        } else if (halfSide === 1) {
            const r = w;
            const straightH = Math.max(0, h - r);
            shape.lineTo(hw, straightH);
            if (r > 0) shape.absarc(-hw, straightH, r, 0, Math.PI/2, false);
        }
    } else if (type === 'segment') {
        if (halfSide === 0) {
            const rise = w * 0.15;
            const straightH = Math.max(0, h - rise);
            shape.lineTo(hw, straightH);
            shape.quadraticCurveTo(0, h + rise*0.5, -hw, straightH);
        } else if (halfSide === -1) {
            const fullW = w * 2;
            const rise = fullW * 0.15;
            const straightH = Math.max(0, h - rise);
            const peakY = h - 0.25 * rise;
            const ctrlY = (straightH + h + rise*0.5) / 2;
            shape.lineTo(hw, peakY);
            shape.quadraticCurveTo(0, ctrlY, -hw, straightH);
        } else if (halfSide === 1) {
            const fullW = w * 2;
            const rise = fullW * 0.15;
            const straightH = Math.max(0, h - rise);
            const peakY = h - 0.25 * rise;
            const ctrlY = (straightH + h + rise*0.5) / 2;
            shape.lineTo(hw, straightH);
            shape.quadraticCurveTo(0, ctrlY, -hw, peakY);
        }
    } else if (type === 'gothic') {
        if (halfSide === 0) {
            const straightH = Math.max(0, h - (w * 0.7));
            shape.lineTo(hw, straightH);
            shape.quadraticCurveTo(hw * 0.2, h, 0, h);
            shape.quadraticCurveTo(-hw * 0.2, h, -hw, straightH);
        } else if (halfSide === -1) {
            const straightH = Math.max(0, h - (w * 1.4));
            shape.lineTo(hw, h);
            shape.quadraticCurveTo(w * 0.1, h, -hw, straightH);
        } else if (halfSide === 1) {
            const straightH = Math.max(0, h - (w * 1.4));
            shape.lineTo(hw, straightH);
            shape.quadraticCurveTo(-w * 0.1, h, -hw, h);
        }
    } else {
        shape.lineTo(hw, h);
        shape.lineTo(-hw, h);
    }
    shape.lineTo(-hw, 0);
    return shape;
};

function buildDetailedDoorPanel(entity, width, height, thickness, material, type, isGlass, signX = 1, helpers, builder) {
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

    if (style === 'modern_grooved') {
        const numPanels = 5;
        const grooveSize = 0.4;
        const panelH = (height - (grooveSize * (numPanels - 1))) / numPanels;
        for (let i = 0; i < numPanels; i++) {
            const geoPanel = createBeveledRect(width, panelH, thickness);
            const yPos = panelH/2 + i * (panelH + grooveSize);
            builder.addNode({ geometry: geoPanel, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, yPos, 0), castShadow: true, receiveShadow: true });
        }
        const coreGeo = new THREE.BoxGeometry(width - 1, height - 1, thickness - 0.4);
        builder.addNode({ geometry: coreGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height/2, 0) });
    } else if (style === 'louvered_half') {
        const frameW = 4; const topRailH = 4; const midRailH = 4; const botRailH = 6;
        const geoStile = createBeveledRect(frameW, height, thickness); 
        const geoRailT = rotateUVs(createBeveledRect(width - frameW*2, topRailH, thickness)); 
        const geoRailB = rotateUVs(createBeveledRect(width - frameW*2, botRailH, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width - frameW*2, midRailH, thickness));
        
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height/2, 0), castShadow: true, receiveShadow: true });
        
        const botPanelH = (height/2 - midRailH/2) - botRailH;
        const panelGeo = createBeveledRect(width - frameW*2, botPanelH, thickness * 0.6);
        builder.addNode({ geometry: panelGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + botPanelH/2, 0), castShadow: true, receiveShadow: true });
        
        const topOpeningH = (height - topRailH) - (height/2 + midRailH/2);
        const louverW = width - frameW*2 + 0.5;
        const louverGeo = rotateUVs(createBeveledRect(louverW, 0.4, thickness * 0.5));
        const numLouvers = Math.floor(topOpeningH / 1.2);
        const louverSpacing = topOpeningH / numLouvers;
        const louverStartY = height/2 + midRailH/2 + louverSpacing/2;
        
        for (let i = 0; i < numLouvers; i++) {
            builder.addNode({ geometry: louverGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, louverStartY + i * louverSpacing, 0), rotation: new THREE.Euler(Math.PI/6, 0, 0), castShadow: true, receiveShadow: true });
        }
    } else if (style === 'office_glass_lite') {
        const frameW = 4.5; const topRailH = 4.5; const botRailH = 6; const mullionH = 2; const numLites = 4;
        const geoStile = createBeveledRect(frameW, height, thickness); 
        const geoRailT = rotateUVs(createBeveledRect(width - frameW*2, topRailH, thickness)); 
        const geoRailB = rotateUVs(createBeveledRect(width - frameW*2, botRailH, thickness));
        const geoMullion = rotateUVs(createBeveledRect(width - frameW*2, mullionH, thickness));
        
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH/2, 0), castShadow: true, receiveShadow: true });
        
        const totalGlassH = height - topRailH - botRailH - mullionH*(numLites-1);
        const liteH = totalGlassH / numLites;
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_frosted';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const geoGlass = new THREE.BoxGeometry(width - frameW*2, liteH, thickness * 0.25);
        
        let curY = botRailH;
        for (let i = 0; i < numLites; i++) {
            builder.addNode({ geometry: geoGlass, materialOverride: glassMat, parent: group, position: new THREE.Vector3(0, curY + liteH/2, 0), userData: { isGlass: true } });
            curY += liteH;
            if (i < numLites - 1) {
                builder.addNode({ geometry: geoMullion, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, curY + mullionH/2, 0), castShadow: true, receiveShadow: true });
                curY += mullionH;
            }
        }
    } else if (style === 'entry_grand_panel') {
        const frameW = 6.5; const topRailH = 6.5; const botRailH = 10;
        const midRailH = 6.5;
        const geoStile = createBeveledRect(frameW, height, thickness); 
        const geoRailT = rotateUVs(createBeveledRect(width - frameW*2, topRailH, thickness)); 
        const geoRailB = rotateUVs(createBeveledRect(width - frameW*2, botRailH, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width - frameW*2, midRailH, thickness));
        
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH/2, 0), castShadow: true, receiveShadow: true });
        
        const totalInnerH = height - topRailH - botRailH - midRailH;
        const botPanelH = totalInnerH * 0.7;
        const topPanelH = totalInnerH * 0.3;
        
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + botPanelH + midRailH/2, 0), castShadow: true, receiveShadow: true });
        
        const botPanelGeo = createBeveledRect(width - frameW*2 + 1, botPanelH + 1, thickness * 0.55);
        const topPanelGeo = createBeveledRect(width - frameW*2 + 1, topPanelH + 1, thickness * 0.55);
        
        builder.addNode({ geometry: botPanelGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + botPanelH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: topPanelGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH - topPanelH/2, 0), castShadow: true, receiveShadow: true });
    } else if (style === 'entry_modern_slit') {
        const slitW = 6;
        const slitH = height * 0.7;
        const slitX = width / 2 - 12; // towards the handle side
        
        const shape = new THREE.Shape();
        const hw = width / 2;
        shape.moveTo(-hw, 0); shape.lineTo(hw, 0); shape.lineTo(hw, height); shape.lineTo(-hw, height); shape.lineTo(-hw, 0);
        
        const liteHW = slitW/2, liteHH = slitH/2;
        const liteY = height / 2;
        
        const hole = new THREE.Path();
        hole.moveTo(slitX - liteHW, liteY - liteHH); hole.lineTo(slitX + liteHW, liteY - liteHH);
        hole.lineTo(slitX + liteHW, liteY + liteHH); hole.lineTo(slitX - liteHW, liteY + liteHH);
        hole.lineTo(slitX - liteHW, liteY - liteHH);
        shape.holes.push(hole);
        
        const coreGeo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.2, bevelThickness: 0.2 });
        coreGeo.translate(0, 0, -thickness/2);
        
        const coreUvs = coreGeo.attributes.uv; const corePos = coreGeo.attributes.position;
        if (coreUvs && corePos) {
            for (let i = 0; i < coreUvs.count; i++) {
                coreUvs.setXY(i, (corePos.getX(i) + hw) / width, corePos.getY(i) / height);
            }
            coreUvs.needsUpdate = true;
        }
        builder.addNode({ geometry: coreGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, 0, 0), castShadow: true, receiveShadow: true });
        
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_frosted';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const geoGlass = new THREE.BoxGeometry(slitW, slitH, thickness * 0.25);
        builder.addNode({ geometry: geoGlass, materialOverride: glassMat, parent: group, position: new THREE.Vector3(slitX, liteY, 0), userData: { isGlass: true } });
    } else if (style === 'entry_craftsman') {
        const frameW = 6.5; const topRailH = 6.5; const botRailH = 10; const midRailH = 8;
        const mullionW = 2; const midStileW = 4;
        
        const geoStile = createBeveledRect(frameW, height, thickness); 
        const geoRailT = rotateUVs(createBeveledRect(width - frameW*2, topRailH, thickness)); 
        const geoRailB = rotateUVs(createBeveledRect(width - frameW*2, botRailH, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width - frameW*2, midRailH, thickness));
        
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH/2, 0), castShadow: true, receiveShadow: true });
        
        const totalInnerH = height - topRailH - botRailH - midRailH;
        const topH = totalInnerH * 0.25;
        const botH = totalInnerH * 0.75;
        
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + botH + midRailH/2, 0), castShadow: true, receiveShadow: true });
        
        // 3 glass lites on top
        const glassW = (width - frameW*2 - mullionW*2) / 3;
        const geoGlass = new THREE.BoxGeometry(glassW, topH, thickness * 0.25);
        const geoMullion = createBeveledRect(mullionW, topH, thickness);
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        
        let cx = -width/2 + frameW + glassW/2;
        let cy = height - topRailH - topH/2;
        for (let i = 0; i < 3; i++) {
            builder.addNode({ geometry: geoGlass, materialOverride: glassMat, parent: group, position: new THREE.Vector3(cx, cy, 0), userData: { isGlass: true } });
            if (i < 2) {
                builder.addNode({ geometry: geoMullion, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(cx + glassW/2 + mullionW/2, cy, 0), castShadow: true, receiveShadow: true });
            }
            cx += glassW + mullionW;
        }
        
        // 2 solid panels on bottom
        const panelW = (width - frameW*2 - midStileW) / 2;
        const panelGeo = createBeveledRect(panelW + 1, botH + 1, thickness * 0.55);
        const geoMidStile = createBeveledRect(midStileW, botH, thickness);
        
        builder.addNode({ geometry: panelGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW + panelW/2, botRailH + botH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoMidStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + botH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: panelGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW - panelW/2, botRailH + botH/2, 0), castShadow: true, receiveShadow: true });
    } else if (style === 'shaker_multi_panel') {
        const frameW = 4.5; const topRailH = 4.5; const botRailH = 6; const midRailH = 3; const numPanels = 5;
        const geoStile = createBeveledRect(frameW, height, thickness); 
        const geoRailT = rotateUVs(createBeveledRect(width - frameW*2, topRailH, thickness)); 
        const geoRailB = rotateUVs(createBeveledRect(width - frameW*2, botRailH, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width - frameW*2, midRailH, thickness));
        
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH/2, 0), castShadow: true, receiveShadow: true });
        
        const totalPanelH = height - topRailH - botRailH - midRailH*(numPanels-1);
        const panelH = totalPanelH / numPanels;
        const panelGeo = createBeveledRect(width - frameW*2 + 0.5, panelH + 0.5, thickness * 0.4);
        
        let curY = botRailH;
        for (let i = 0; i < numPanels; i++) {
            builder.addNode({ geometry: panelGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, curY + panelH/2, 0), castShadow: true, receiveShadow: true });
            curY += panelH;
            if (i < numPanels - 1) {
                builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, curY + midRailH/2, 0), castShadow: true, receiveShadow: true });
                curY += midRailH;
            }
        }
    } else if (style === 'utility_vision') {
        const bSize = 0.06;
        const shape = new THREE.Shape();
        const hw = width / 2;
        shape.moveTo(-hw, 0); shape.lineTo(hw, 0); shape.lineTo(hw, height); shape.lineTo(-hw, height); shape.lineTo(-hw, 0);
        
        const liteW = 5; const liteH = 24; const liteY = height - 6 - liteH/2; const liteX = width/2 - 7;
        const liteHW = liteW/2, liteHH = liteH/2;
        const hole = new THREE.Path();
        hole.moveTo(liteX - liteHW, liteY - liteHH); hole.lineTo(liteX + liteHW, liteY - liteHH);
        hole.lineTo(liteX + liteHW, liteY + liteHH); hole.lineTo(liteX - liteHW, liteY + liteHH);
        hole.lineTo(liteX - liteHW, liteY - liteHH);
        shape.holes.push(hole);
        
        const coreGeo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, thickness - bSize*2), bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: bSize, bevelThickness: bSize });
        coreGeo.translate(0, 0, -Math.max(0.01, thickness - bSize*2) / 2);
        
        const coreUvs = coreGeo.attributes.uv; const corePos = coreGeo.attributes.position;
        if (coreUvs && corePos) {
            for (let i = 0; i < coreUvs.count; i++) {
                coreUvs.setXY(i, (corePos.getX(i) + hw) / width, corePos.getY(i) / height);
            }
            coreUvs.needsUpdate = true;
        }
        builder.addNode({ geometry: coreGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, 0, 0), castShadow: true, receiveShadow: true });
        
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const geoGlass = new THREE.BoxGeometry(liteW, liteH, thickness * 0.25);
        builder.addNode({ geometry: geoGlass, materialOverride: glassMat, parent: group, position: new THREE.Vector3(liteX, liteY, 0), userData: { isGlass: true } });
        
        const beadW = 0.5;
        const geoBeadV = createBeveledRect(beadW, liteH, thickness * 0.7);
        const geoBeadH = rotateUVs(createBeveledRect(liteW + beadW*2, beadW, thickness * 0.7));
        
        builder.addNode({ geometry: geoBeadV, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(liteX - liteW/2 - beadW/2, liteY, 0), castShadow: true });
        builder.addNode({ geometry: geoBeadV, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(liteX + liteW/2 + beadW/2, liteY, 0), castShadow: true });
        builder.addNode({ geometry: geoBeadH, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(liteX, liteY + liteH/2 + beadW/2, 0), castShadow: true });
        builder.addNode({ geometry: geoBeadH, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(liteX, liteY - liteH/2 - beadW/2, 0), castShadow: true });
    } else if (style === 'back_half_lite') {
        const frameW = 4.5; const topRailH = 4.5; const midRailH = 5; const botRailH = 8;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW*2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW*2, botRailH, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width - frameW*2, midRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH/2, 0), castShadow: true, receiveShadow: true });

        const midY = height * 0.45;
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, midY, 0), castShadow: true, receiveShadow: true });

        // Glass on top
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const glassH = (height - topRailH) - (midY + midRailH/2);
        const geoGlass = new THREE.BoxGeometry(width - frameW*2, glassH, thickness * 0.25);
        builder.addNode({ geometry: geoGlass, materialOverride: glassMat, parent: group, position: new THREE.Vector3(0, midY + midRailH/2 + glassH/2, 0), userData: { isGlass: true } });

        // Solid raised panel on bottom
        const botPanelH = (midY - midRailH/2) - botRailH;
        const panelGeo = createBeveledRect(width - frameW*2 + 0.5, botPanelH + 0.5, thickness * 0.55);
        builder.addNode({ geometry: panelGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + botPanelH/2, 0), castShadow: true, receiveShadow: true });
    } else if (style === 'back_dutch') {
        const frameW = 4.5; const railH = 4.5; const splitY = height * 0.48; const shelfH = 2.0; const shelfDepth = thickness + 2.0;
        
        // Lower leaf stiles & rails
        const lowerH = splitY - 0.2;
        const geoStileL = createBeveledRect(frameW, lowerH, thickness);
        const geoRailBot = rotateUVs(createBeveledRect(width - frameW*2, 6, thickness));
        const geoRailSplitL = rotateUVs(createBeveledRect(width - frameW*2, railH, thickness));
        
        builder.addNode({ geometry: geoStileL, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, lowerH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStileL, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, lowerH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailBot, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, 3, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailSplitL, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, lowerH - railH/2, 0), castShadow: true, receiveShadow: true });
        
        const botPanelH = lowerH - 6 - railH;
        const botPanelGeo = createBeveledRect(width - frameW*2 + 0.5, botPanelH + 0.5, thickness * 0.5);
        builder.addNode({ geometry: botPanelGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, 6 + botPanelH/2, 0), castShadow: true, receiveShadow: true });

        // Dutch shelf astragal
        const geoShelf = rotateUVs(createBeveledRect(width + 1.0, shelfH, shelfDepth));
        builder.addNode({ geometry: geoShelf, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, splitY, 0), castShadow: true, receiveShadow: true });

        // Upper leaf stiles & rails
        const upperH = height - (splitY + 0.2);
        const geoStileU = createBeveledRect(frameW, upperH, thickness);
        const geoRailTop = rotateUVs(createBeveledRect(width - frameW*2, railH, thickness));
        const geoRailSplitU = rotateUVs(createBeveledRect(width - frameW*2, railH, thickness));
        const upperCenterY = splitY + 0.2 + upperH/2;

        builder.addNode({ geometry: geoStileU, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, upperCenterY, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStileU, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, upperCenterY, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailTop, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - railH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailSplitU, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, splitY + 0.2 + railH/2, 0), castShadow: true, receiveShadow: true });

        const topPanelH = upperH - railH*2;
        const topPanelGeo = createBeveledRect(width - frameW*2 + 0.5, topPanelH + 0.5, thickness * 0.5);
        builder.addNode({ geometry: topPanelGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, splitY + 0.2 + railH + topPanelH/2, 0), castShadow: true, receiveShadow: true });
    } else if (style === 'service_steel_flush') {
        const geoCore = createBeveledRect(width, height, thickness);
        builder.addNode({ geometry: geoCore, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height/2, 0), castShadow: true, receiveShadow: true });

        // Stainless kick plate on bottom
        const kickH = 10;
        const kickMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
        const kickGeo = new THREE.BoxGeometry(width - 1.0, kickH, thickness + 0.15);
        builder.addNode({ geometry: kickGeo, materialOverride: kickMat, parent: group, position: new THREE.Vector3(0, kickH/2 + 0.5, 0), castShadow: true, userData: { isHandle: true } });

        // Push / Armor plate in the center
        const plateGeo = new THREE.BoxGeometry(8, 16, thickness + 0.15);
        builder.addNode({ geometry: plateGeo, materialOverride: kickMat, parent: group, position: new THREE.Vector3((width/2 - 6) * signX, height * 0.48, 0), castShadow: true, userData: { isHandle: true } });
    } else if (style === 'service_louvered') {
        const frameW = 4.5; const topRailH = 5.0; const botRailH = 8.0;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW*2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW*2, botRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH/2, 0), castShadow: true, receiveShadow: true });

        const openH = height - topRailH - botRailH;
        const louverW = width - frameW*2 + 0.4;
        const louverGeo = rotateUVs(createBeveledRect(louverW, 0.45, thickness * 0.5));
        const numLouvers = Math.max(10, Math.floor(openH / 1.1));
        const spacing = openH / numLouvers;
        const startY = botRailH + spacing/2;

        for (let i = 0; i < numLouvers; i++) {
            builder.addNode({ geometry: louverGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, startY + i * spacing, 0), rotation: new THREE.Euler(Math.PI/6, 0, 0), castShadow: true, receiveShadow: true });
        }
    } else if (style === 'garage_sectional') {
        const numSections = 4;
        const grooveW = 0.5;
        const secH = (height - grooveW * (numSections - 1)) / numSections;
        const stilesPerSec = 4;

        for (let s = 0; s < numSections; s++) {
            const secY = secH/2 + s * (secH + grooveW);
            const secGeo = createBeveledRect(width, secH, thickness);
            builder.addNode({ geometry: secGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, secY, 0), castShadow: true, receiveShadow: true });

            // Embossed cassettes across width
            const cassW = (width - 4 * (stilesPerSec + 1)) / stilesPerSec;
            const cassH = secH - 4;
            if (cassW > 4 && cassH > 4) {
                const cassGeo = createBeveledRect(cassW, cassH, thickness * 0.4);
                let cx = -width/2 + 4 + cassW/2;
                for (let c = 0; c < stilesPerSec; c++) {
                    builder.addNode({ geometry: cassGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(cx, secY, 0), castShadow: true, receiveShadow: true });
                    cx += cassW + 4;
                }
            }
        }
    } else if (style === 'garage_modern_glass') {
        const frameW = 4.0; const numRows = 4; const numCols = 3;
        const geoStileL = createBeveledRect(frameW, height, thickness);
        const geoStileR = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width, frameW, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width, frameW, thickness));

        builder.addNode({ geometry: geoStileL, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStileR, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - frameW/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, frameW/2, 0), castShadow: true, receiveShadow: true });

        const mullionW = 2.5;
        const innerW = width - frameW*2;
        const innerH = height - frameW*2;
        const cellW = (innerW - mullionW * (numCols - 1)) / numCols;
        const cellH = (innerH - mullionW * (numRows - 1)) / numRows;

        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_frosted';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const glassGeo = new THREE.BoxGeometry(cellW, cellH, thickness * 0.25);

        for (let r = 0; r < numRows; r++) {
            const cy = frameW + cellH/2 + r * (cellH + mullionW);
            for (let c = 0; c < numCols; c++) {
                const cx = -width/2 + frameW + cellW/2 + c * (cellW + mullionW);
                builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, position: new THREE.Vector3(cx, cy, 0), userData: { isGlass: true } });
            }
            if (r < numRows - 1) {
                const hMullionGeo = rotateUVs(createBeveledRect(innerW, mullionW, thickness));
                builder.addNode({ geometry: hMullionGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, frameW + (r + 1) * cellH + (r + 0.5) * mullionW, 0), castShadow: true, receiveShadow: true });
            }
        }
        for (let c = 0; c < numCols - 1; c++) {
            const vMullionGeo = createBeveledRect(mullionW, innerH, thickness);
            const mx = -width/2 + frameW + (c + 1) * cellW + (c + 0.5) * mullionW;
            builder.addNode({ geometry: vMullionGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(mx, height/2, 0), castShadow: true, receiveShadow: true });
        }
    } else if (style === 'garage_carriage') {
        const frameW = 5.0; const topRailH = 6.0; const botRailH = 8.0; const midRailH = 5.0;
        const geoStileL = createBeveledRect(frameW, height, thickness);
        const geoStileR = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW*2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW*2, botRailH, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width - frameW*2, midRailH, thickness));

        builder.addNode({ geometry: geoStileL, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStileR, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height/2, 0), castShadow: true, receiveShadow: true });

        // T&G background backing
        const backingGeo = createBeveledRect(width - frameW*2 + 0.5, height - topRailH - botRailH, thickness * 0.4);
        builder.addNode({ geometry: backingGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height/2, 0), castShadow: true, receiveShadow: true });

        // X-Braces on top and bottom sections
        const secH = (height - topRailH - botRailH - midRailH) / 2;
        const braceW = 3.5;
        const braceLen = Math.sqrt(Math.pow(width - frameW*2, 2) + Math.pow(secH, 2));
        const braceAngle = Math.atan2(secH, width - frameW*2);

        [botRailH + secH/2, height/2 + midRailH/2 + secH/2].forEach(secCenterY => {
            const braceGeo1 = rotateUVs(createBeveledRect(braceLen, braceW, thickness * 0.6));
            const braceGeo2 = rotateUVs(createBeveledRect(braceLen, braceW, thickness * 0.6));
            builder.addNode({ geometry: braceGeo1, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, secCenterY, 0), rotation: new THREE.Euler(0, 0, braceAngle), castShadow: true, receiveShadow: true });
            builder.addNode({ geometry: braceGeo2, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, secCenterY, 0), rotation: new THREE.Euler(0, 0, -braceAngle), castShadow: true, receiveShadow: true });
        });
    } else if (style === 'gate_slat_modern') {
        const frameW = 4.5;
        const geoStileL = createBeveledRect(frameW, height, thickness);
        const geoStileR = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width, frameW, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width, frameW, thickness));

        builder.addNode({ geometry: geoStileL, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStileR, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - frameW/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, frameW/2, 0), castShadow: true, receiveShadow: true });

        // Horizontal slats with gaps
        const slatW = width - frameW*2;
        const slatH = 5.0;
        const gapH = 1.8;
        const innerH = height - frameW*2;
        const numSlats = Math.floor(innerH / (slatH + gapH));
        const totalSlatsH = numSlats * slatH + (numSlats - 1) * gapH;
        const startY = frameW + (innerH - totalSlatsH)/2 + slatH/2;

        const slatGeo = rotateUVs(createBeveledRect(slatW + 0.4, slatH, thickness * 0.7));
        for (let i = 0; i < numSlats; i++) {
            builder.addNode({ geometry: slatGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, startY + i * (slatH + gapH), 0), castShadow: true, receiveShadow: true });
        }
    } else if (style === 'gate_wrought_iron') {
        const frameW = 3.5;
        const geoStileL = createBeveledRect(frameW, height, thickness);
        const geoStileR = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width, frameW, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width, frameW, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width, frameW * 0.8, thickness));

        builder.addNode({ geometry: geoStileL, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStileR, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - frameW/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, frameW/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height * 0.38, 0), castShadow: true, receiveShadow: true });

        // Vertical iron spindles
        const spindleRadius = 0.45;
        const spindleGeo = new THREE.CylinderGeometry(spindleRadius, spindleRadius, height - frameW*2, 12);
        const numSpindles = Math.max(3, Math.floor((width - frameW*2) / 6.0));
        const spacing = (width - frameW*2) / (numSpindles + 1);

        for (let i = 1; i <= numSpindles; i++) {
            const sx = -width/2 + frameW + i * spacing;
            builder.addNode({ geometry: spindleGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(sx, height/2, 0), castShadow: true, receiveShadow: true });
            
            // Decorative ring/finial rosette at mid rail
            const ringGeo = new THREE.TorusGeometry(1.2, 0.25, 8, 16);
            builder.addNode({ geometry: ringGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(sx, height * 0.38, 0), castShadow: true });
            
            // Spear top finial
            const spearGeo = new THREE.ConeGeometry(0.8, 2.5, 8);
            builder.addNode({ geometry: spearGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(sx, height + 1.25, 0), castShadow: true });
        }
    } else if (style === 'gate_pedestrian_wicket') {
        const frameW = 3.5;
        const geoStileL = createBeveledRect(frameW, height, thickness);
        const geoStileR = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width, frameW, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width, frameW, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width, frameW, thickness));

        builder.addNode({ geometry: geoStileL, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStileR, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - frameW/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, frameW/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height * 0.45, 0), castShadow: true, receiveShadow: true });

        // Integrated lockbox plate
        const lockBoxW = 8; const lockBoxH = 12;
        const lockGeo = createBeveledRect(lockBoxW, lockBoxH, thickness + 0.2);
        builder.addNode({ geometry: lockGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3((width/2 - frameW - lockBoxW/2) * signX, height * 0.45, 0), castShadow: true });

        // Vertical bars
        const numBars = Math.max(3, Math.floor((width - frameW*2) / 5.0));
        const spacing = (width - frameW*2) / (numBars + 1);
        const barGeoTop = new THREE.CylinderGeometry(0.35, 0.35, height * 0.55 - frameW, 12);
        const barGeoBot = new THREE.CylinderGeometry(0.35, 0.35, height * 0.45 - frameW, 12);

        for (let i = 1; i <= numBars; i++) {
            const bx = -width/2 + frameW + i * spacing;
            builder.addNode({ geometry: barGeoTop, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(bx, height * 0.45 + (height * 0.55 - frameW)/2, 0), castShadow: true });
            builder.addNode({ geometry: barGeoBot, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(bx, (height * 0.45)/2, 0), castShadow: true });
        }
    } else if (style === 'gate_driveway_sliding') {
        const frameW = 5.0; const bottomTrackH = 8.0;
        const geoStileL = createBeveledRect(frameW, height, thickness);
        const geoStileR = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width, frameW, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width, bottomTrackH, thickness * 1.2));

        builder.addNode({ geometry: geoStileL, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStileR, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - frameW/2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, bottomTrackH/2, 0), castShadow: true, receiveShadow: true });

        // Vertical pickets
        const picketW = 2.0;
        const innerW = width - frameW*2;
        const numPickets = Math.max(5, Math.floor(innerW / 8.0));
        const spacing = innerW / (numPickets + 1);
        const picketH = height - frameW - bottomTrackH;
        const picketGeo = createBeveledRect(picketW, picketH, thickness * 0.7);

        for (let i = 1; i <= numPickets; i++) {
            const px = -width/2 + frameW + i * spacing;
            builder.addNode({ geometry: picketGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(px, bottomTrackH + picketH/2, 0), castShadow: true, receiveShadow: true });
        }

        // Roller track wheel housings on bottom
        const wheelGeo = new THREE.CylinderGeometry(2.0, 2.0, thickness * 1.4, 16);
        wheelGeo.rotateX(Math.PI/2);
        const metalHardwareMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9, roughness: 0.2 });
        [-width/3, width/3].forEach(wx => {
            builder.addNode({ geometry: wheelGeo, materialOverride: metalHardwareMat, parent: group, position: new THREE.Vector3(wx, 1.5, 0), userData: { isHandle: true } });
        });
    } else if (style === 'gate_garden_picket') {
        const picketW = 4.0; const picketThick = thickness * 0.7;
        const numPickets = Math.max(4, Math.floor(width / 6.0));
        const spacing = width / numPickets;
        const topPointH = 3.0;

        // Custom pointed picket geometry
        const shape = new THREE.Shape();
        const pw = picketW/2;
        shape.moveTo(-pw, 0);
        shape.lineTo(pw, 0);
        shape.lineTo(pw, height - topPointH);
        shape.lineTo(0, height);
        shape.lineTo(-pw, height - topPointH);
        shape.lineTo(-pw, 0);

        const picketGeo = new THREE.ExtrudeGeometry(shape, { depth: picketThick, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.06, bevelThickness: 0.06 });
        picketGeo.translate(0, 0, -picketThick/2);

        for (let i = 0; i < numPickets; i++) {
            const px = -width/2 + spacing/2 + i * spacing;
            builder.addNode({ geometry: picketGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(px, 0, 0), castShadow: true, receiveShadow: true });
        }

        // Rear horizontal rails & diagonal Z-brace
        const railH = 3.5;
        const railGeo = rotateUVs(createBeveledRect(width, railH, thickness * 0.6));
        builder.addNode({ geometry: railGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height * 0.25, -picketThick/2 - thickness * 0.3), castShadow: true });
        builder.addNode({ geometry: railGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height * 0.75, -picketThick/2 - thickness * 0.3), castShadow: true });

        const zLen = Math.sqrt(Math.pow(width, 2) + Math.pow(height * 0.5, 2));
        const zAngle = Math.atan2(height * 0.5, width);
        const zGeo = rotateUVs(createBeveledRect(zLen, railH, thickness * 0.6));
        builder.addNode({ geometry: zGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height * 0.5, -picketThick/2 - thickness * 0.3), rotation: new THREE.Euler(0, 0, zAngle), castShadow: true });
    } else if (isGlass || type === 'french' || style === 'french' || style === 'glass_grid' || style === 'glass_bottom_panel' || style === 'patio_multi_slide' || style === 'patio_bifold') {
        const shapeType = entity && entity.doorShape ? entity.doorShape : 'square';
        const halfSide = (entity.doorType === 'double' || entity.doorType === 'french' || entity.doorType === 'double_french') ? -signX : 0;
        const isArched = (shapeType !== 'square');
        const frameW = style === 'patio_multi_slide' ? 2.2 : (style === 'patio_bifold' ? 2.8 : 3.5);
        const topRailH = style === 'patio_multi_slide' ? 2.2 : (style === 'patio_bifold' ? 2.8 : 3.5);
        const botRailH = (style === 'glass_bottom_panel') ? height * 0.28 : (style === 'patio_multi_slide' ? 3.0 : 5);

        if (isArched) {
            // Build unified arched stile & rail frame with inner glass cutout
            const outerShape = createDoorShape(width, height, shapeType, halfSide);
            const hole = new THREE.Path();
            const hw = width / 2;
            const hwI = (width - frameW * 2) / 2;
            const hI = height - topRailH;

            if (shapeType === 'radius' || shapeType === 'arch' || shapeType === 'arched') {
                if (halfSide === 0) {
                    const strH = Math.max(botRailH, hI - hwI);
                    hole.moveTo(-hwI, botRailH);
                    hole.lineTo(hwI, botRailH);
                    hole.lineTo(hwI, strH);
                    if (hwI > 0) hole.absarc(0, strH, hwI, 0, Math.PI, false);
                    hole.lineTo(-hwI, botRailH);
                } else if (halfSide === -1) {
                    const r = width - frameW * 2;
                    const strH = Math.max(botRailH, hI - r);
                    hole.moveTo(-hw + frameW, botRailH);
                    hole.lineTo(hw - frameW, botRailH);
                    hole.lineTo(hw - frameW, hI);
                    if (r > 0) hole.absarc(hw - frameW, strH, r, Math.PI/2, Math.PI, false);
                    hole.lineTo(-hw + frameW, botRailH);
                } else if (halfSide === 1) {
                    const r = width - frameW * 2;
                    const strH = Math.max(botRailH, hI - r);
                    hole.moveTo(-hw + frameW, botRailH);
                    hole.lineTo(hw - frameW, botRailH);
                    hole.lineTo(hw - frameW, strH);
                    if (r > 0) hole.absarc(-hw + frameW, strH, r, 0, Math.PI/2, false);
                    hole.lineTo(-hw + frameW, botRailH);
                }
            } else if (shapeType === 'segment') {
                if (halfSide === 0) {
                    const rise = (width - frameW * 2) * 0.15;
                    const strH = Math.max(botRailH, hI - rise);
                    hole.moveTo(-hwI, botRailH);
                    hole.lineTo(hwI, botRailH);
                    hole.lineTo(hwI, strH);
                    hole.quadraticCurveTo(0, hI + rise*0.5, -hwI, strH);
                    hole.lineTo(-hwI, botRailH);
                } else if (halfSide === -1) {
                    const fullW = (width - frameW * 2) * 2;
                    const rise = fullW * 0.15;
                    const strH = Math.max(botRailH, hI - rise);
                    const peakY = hI - 0.25 * rise;
                    const ctrlY = (strH + hI + rise*0.5) / 2;
                    hole.moveTo(-hw + frameW, botRailH);
                    hole.lineTo(hw - frameW, botRailH);
                    hole.lineTo(hw - frameW, peakY);
                    hole.quadraticCurveTo(0, ctrlY, -hw + frameW, strH);
                    hole.lineTo(-hw + frameW, botRailH);
                } else if (halfSide === 1) {
                    const fullW = (width - frameW * 2) * 2;
                    const rise = fullW * 0.15;
                    const strH = Math.max(botRailH, hI - rise);
                    const peakY = hI - 0.25 * rise;
                    const ctrlY = (strH + hI + rise*0.5) / 2;
                    hole.moveTo(-hw + frameW, botRailH);
                    hole.lineTo(hw - frameW, botRailH);
                    hole.lineTo(hw - frameW, strH);
                    hole.quadraticCurveTo(0, ctrlY, -hw + frameW, peakY);
                    hole.lineTo(-hw + frameW, botRailH);
                }
            } else if (shapeType === 'gothic') {
                if (halfSide === 0) {
                    const strH = Math.max(botRailH, hI - ((width - frameW * 2) * 0.7));
                    hole.moveTo(-hwI, botRailH);
                    hole.lineTo(hwI, botRailH);
                    hole.lineTo(hwI, strH);
                    hole.quadraticCurveTo(hwI * 0.2, hI, 0, hI);
                    hole.quadraticCurveTo(-hwI * 0.2, hI, -hwI, strH);
                    hole.lineTo(-hwI, botRailH);
                } else if (halfSide === -1) {
                    const strH = Math.max(botRailH, hI - ((width - frameW * 2) * 1.4));
                    hole.moveTo(-hw + frameW, botRailH);
                    hole.lineTo(hw - frameW, botRailH);
                    hole.lineTo(hw - frameW, hI);
                    hole.quadraticCurveTo((width - frameW * 2) * 0.1, hI, -hw + frameW, strH);
                    hole.lineTo(-hw + frameW, botRailH);
                } else if (halfSide === 1) {
                    const strH = Math.max(botRailH, hI - ((width - frameW * 2) * 1.4));
                    hole.moveTo(-hw + frameW, botRailH);
                    hole.lineTo(hw - frameW, botRailH);
                    hole.lineTo(hw - frameW, strH);
                    hole.quadraticCurveTo(-(width - frameW * 2) * 0.1, hI, -hw + frameW, hI);
                    hole.lineTo(-hw + frameW, botRailH);
                }
            } else {
                hole.moveTo(-hwI, botRailH);
                hole.lineTo(hwI, botRailH);
                hole.lineTo(hwI, hI);
                hole.lineTo(-hwI, hI);
                hole.lineTo(-hwI, botRailH);
            }
            outerShape.holes.push(hole);

            // 1. Stile/Rail Outer Frame Mesh
            const leafFrameGeo = new THREE.ExtrudeGeometry(outerShape, { depth: thickness, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.08, bevelThickness: 0.06 });
            leafFrameGeo.translate(0, 0, -thickness / 2);
            const uvs = leafFrameGeo.attributes.uv, pos = leafFrameGeo.attributes.position;
            if (uvs && pos) {
                for (let i = 0; i < uvs.count; i++) {
                    uvs.setXY(i, (pos.getX(i) + hw) / width, pos.getY(i) / height);
                }
                uvs.needsUpdate = true;
            }
            builder.addNode({ geometry: leafFrameGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, 0, 0), castShadow: true, receiveShadow: true });

            // 2. Glass Shape Mesh (matches inner opening contour)
            const glassShape = new THREE.Shape();
            if (shapeType === 'radius' || shapeType === 'arch' || shapeType === 'arched') {
                if (halfSide === 0) {
                    const strH = Math.max(botRailH, hI - hwI);
                    glassShape.moveTo(-hwI, botRailH);
                    glassShape.lineTo(hwI, botRailH);
                    glassShape.lineTo(hwI, strH);
                    if (hwI > 0) glassShape.absarc(0, strH, hwI, 0, Math.PI, false);
                    glassShape.lineTo(-hwI, botRailH);
                } else if (halfSide === -1) {
                    const r = width - frameW * 2;
                    const strH = Math.max(botRailH, hI - r);
                    glassShape.moveTo(-hw + frameW, botRailH);
                    glassShape.lineTo(hw - frameW, botRailH);
                    glassShape.lineTo(hw - frameW, hI);
                    if (r > 0) glassShape.absarc(hw - frameW, strH, r, Math.PI/2, Math.PI, false);
                    glassShape.lineTo(-hw + frameW, botRailH);
                } else if (halfSide === 1) {
                    const r = width - frameW * 2;
                    const strH = Math.max(botRailH, hI - r);
                    glassShape.moveTo(-hw + frameW, botRailH);
                    glassShape.lineTo(hw - frameW, botRailH);
                    glassShape.lineTo(hw - frameW, strH);
                    if (r > 0) glassShape.absarc(-hw + frameW, strH, r, 0, Math.PI/2, false);
                    glassShape.lineTo(-hw + frameW, botRailH);
                }
            } else if (shapeType === 'segment') {
                if (halfSide === 0) {
                    const rise = (width - frameW * 2) * 0.15;
                    const strH = Math.max(botRailH, hI - rise);
                    glassShape.moveTo(-hwI, botRailH);
                    glassShape.lineTo(hwI, botRailH);
                    glassShape.lineTo(hwI, strH);
                    glassShape.quadraticCurveTo(0, hI + rise*0.5, -hwI, strH);
                    glassShape.lineTo(-hwI, botRailH);
                } else if (halfSide === -1) {
                    const fullW = (width - frameW * 2) * 2;
                    const rise = fullW * 0.15;
                    const strH = Math.max(botRailH, hI - rise);
                    const peakY = hI - 0.25 * rise;
                    const ctrlY = (strH + hI + rise*0.5) / 2;
                    glassShape.moveTo(-hw + frameW, botRailH);
                    glassShape.lineTo(hw - frameW, botRailH);
                    glassShape.lineTo(hw - frameW, peakY);
                    glassShape.quadraticCurveTo(0, ctrlY, -hw + frameW, strH);
                    glassShape.lineTo(-hw + frameW, botRailH);
                } else if (halfSide === 1) {
                    const fullW = (width - frameW * 2) * 2;
                    const rise = fullW * 0.15;
                    const strH = Math.max(botRailH, hI - rise);
                    const peakY = hI - 0.25 * rise;
                    const ctrlY = (strH + hI + rise*0.5) / 2;
                    glassShape.moveTo(-hw + frameW, botRailH);
                    glassShape.lineTo(hw - frameW, botRailH);
                    glassShape.lineTo(hw - frameW, strH);
                    glassShape.quadraticCurveTo(0, ctrlY, -hw + frameW, peakY);
                    glassShape.lineTo(-hw + frameW, botRailH);
                }
            } else if (shapeType === 'gothic') {
                if (halfSide === 0) {
                    const strH = Math.max(botRailH, hI - ((width - frameW * 2) * 0.7));
                    glassShape.moveTo(-hwI, botRailH);
                    glassShape.lineTo(hwI, botRailH);
                    glassShape.lineTo(hwI, strH);
                    glassShape.quadraticCurveTo(hwI * 0.2, hI, 0, hI);
                    glassShape.quadraticCurveTo(-hwI * 0.2, hI, -hwI, strH);
                    glassShape.lineTo(-hwI, botRailH);
                } else if (halfSide === -1) {
                    const strH = Math.max(botRailH, hI - ((width - frameW * 2) * 1.4));
                    glassShape.moveTo(-hw + frameW, botRailH);
                    glassShape.lineTo(hw - frameW, botRailH);
                    glassShape.lineTo(hw - frameW, hI);
                    glassShape.quadraticCurveTo((width - frameW * 2) * 0.1, hI, -hw + frameW, strH);
                    glassShape.lineTo(-hw + frameW, botRailH);
                } else if (halfSide === 1) {
                    const strH = Math.max(botRailH, hI - ((width - frameW * 2) * 1.4));
                    glassShape.moveTo(-hw + frameW, botRailH);
                    glassShape.lineTo(hw - frameW, botRailH);
                    glassShape.lineTo(hw - frameW, strH);
                    glassShape.quadraticCurveTo(-(width - frameW * 2) * 0.1, hI, -hw + frameW, hI);
                    glassShape.lineTo(-hw + frameW, botRailH);
                }
            } else {
                glassShape.moveTo(-hwI, botRailH);
                glassShape.lineTo(hwI, botRailH);
                glassShape.lineTo(hwI, hI);
                glassShape.lineTo(-hwI, hI);
                glassShape.lineTo(-hwI, botRailH);
            }

            const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_clear';
            const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
            const geoGlass = new THREE.ExtrudeGeometry(glassShape, { depth: thickness * 0.25, bevelEnabled: false });
            geoGlass.translate(0, 0, -thickness * 0.125);
            builder.addNode({ geometry: geoGlass, materialOverride: glassMat, parent: group, position: new THREE.Vector3(0, 0, 0), userData: { isGlass: true } });

            // 3. If glass_grid, add mullions
            if (style === 'glass_grid') {
                const glassH = hI - botRailH;
                const glassW = width - frameW * 2;
                const mullionW = 1.2;
                for (let i = 1; i <= 3; i++) {
                    const hMullionGeo = rotateUVs(createBeveledRect(glassW, mullionW, thickness * 0.5));
                    builder.addNode({ geometry: hMullionGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + (glassH / 4) * i, 0) });
                }
            }
        } else {
            // Standard square glass/french door construction
            const geoStile = createBeveledRect(frameW, height, thickness);
            const geoRailT = rotateUVs(createBeveledRect(width - frameW*2, topRailH, thickness));
            const geoRailB = rotateUVs(createBeveledRect(width - frameW*2, botRailH, thickness));
            
            builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
            builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW/2, height/2, 0), castShadow: true, receiveShadow: true });
            builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH/2, 0), castShadow: true, receiveShadow: true });
            builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH/2, 0), castShadow: true, receiveShadow: true });
            
            if (style === 'glass_grid') {
                const mullionW = 1.5; const glassH = height - topRailH - botRailH; const glassW = width - frameW*2;
                const vMullionGeo = createBeveledRect(mullionW, glassH, thickness);
                builder.addNode({ geometry: vMullionGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height/2 + (botRailH - topRailH)/2, 0) });
                const hMullionGeo = rotateUVs(createBeveledRect(glassW, mullionW, thickness));
                for (let i = 1; i <= 3; i++) {
                    builder.addNode({ geometry: hMullionGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + (glassH / 4) * i, 0) });
                }
            } else if (style === 'glass_bottom_panel') {
                const grooveGeo = rotateUVs(createBeveledRect(width - frameW*2, 0.4, thickness + 0.1));
                builder.addNode({ geometry: grooveGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH * 0.4, 0) });
                builder.addNode({ geometry: grooveGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH * 0.7, 0) });
            } else {
                const beadW = 0.8;
                const beadGeoV = createBeveledRect(beadW, height - topRailH - botRailH, thickness * 0.65);
                const beadGeoH = rotateUVs(createBeveledRect(width - frameW*2 - beadW*2, beadW, thickness * 0.65));
                builder.addNode({ geometry: beadGeoV, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + frameW + beadW/2, height/2 + (botRailH - topRailH)/2, 0), castShadow: true, receiveShadow: true });
                builder.addNode({ geometry: beadGeoV, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - frameW - beadW/2, height/2 + (botRailH - topRailH)/2, 0), castShadow: true, receiveShadow: true });
                builder.addNode({ geometry: beadGeoH, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH - beadW/2, 0), castShadow: true, receiveShadow: true });
                builder.addNode({ geometry: beadGeoH, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + beadW/2, 0), castShadow: true, receiveShadow: true });
            }

            const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_clear';
            const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
            const geoGlass = new THREE.BoxGeometry(width - frameW*2, height - topRailH - botRailH, thickness * 0.25);
            builder.addNode({ geometry: geoGlass, materialOverride: glassMat, parent: group, position: new THREE.Vector3(0, height/2 + (botRailH - topRailH)/2, 0), userData: { isGlass: true } });
        }
    } else {
        const shapeType = entity && entity.doorShape ? entity.doorShape : 'square';
        const isDoubleOrMulti = ['double', 'french', 'double_french', 'sliding', 'double_sliding', 'folding'].includes(entity.doorType) || type === 'folding_main' || type === 'folding_lead';
        const halfSide = isDoubleOrMulti ? -signX : 0;
        const isSquare = (shapeType === 'square');
        const isClassicOrGrid = style.startsWith('classic') || style === 'grid_panel';
        const matsExtrude = Array.isArray(mats) ? [mats[4], mats[1]] : mats;

        const createBeveledPanelGeo = (pw, ph, pth, panelShape = 'square', panelHalfSide = 0) => {
            const bSize = 0.12; const bThick = 0.06;
            const sw = Math.max(0.1, pw - bSize*2); const sh = Math.max(0.1, ph - bSize*2);
            const shape = new THREE.Shape();
            const hw = sw / 2;
            shape.moveTo(-hw, -sh/2); shape.lineTo(hw, -sh/2);
            if (panelShape === 'radius') {
                if (panelHalfSide === 0) {
                    const straightH = (sh/2) - hw;
                    shape.lineTo(hw, straightH);
                    if (hw > 0) shape.absarc(0, straightH, hw, 0, Math.PI, false);
                } else if (panelHalfSide === -1) {
                    // Peak on right, curve down on left
                    const r = sw;
                    const straightH = (sh/2) - r;
                    shape.lineTo(hw, sh/2);
                    if (r > 0) shape.absarc(hw, straightH, r, Math.PI/2, Math.PI, false);
                } else if (panelHalfSide === 1) {
                    // Peak on left, curve down on right
                    const r = sw;
                    const straightH = (sh/2) - r;
                    shape.lineTo(hw, straightH);
                    if (r > 0) shape.absarc(-hw, straightH, r, 0, Math.PI/2, false);
                }
            } else if (panelShape === 'segment') {
                if (panelHalfSide === 0) {
                    const rise = sw * 0.15;
                    const straightH = (sh/2) - rise;
                    shape.lineTo(hw, straightH);
                    shape.quadraticCurveTo(0, sh/2 + rise*0.5, -hw, straightH);
                } else if (panelHalfSide === -1) {
                    const fullW = sw * 2;
                    const rise = fullW * 0.15;
                    const straightH = (sh/2) - rise;
                    const peakY = sh/2 - 0.25 * rise;
                    const ctrlY = (straightH + sh/2 + rise*0.5) / 2;
                    shape.lineTo(hw, peakY);
                    shape.quadraticCurveTo(0, ctrlY, -hw, straightH);
                } else if (panelHalfSide === 1) {
                    const fullW = sw * 2;
                    const rise = fullW * 0.15;
                    const straightH = (sh/2) - rise;
                    const peakY = sh/2 - 0.25 * rise;
                    const ctrlY = (straightH + sh/2 + rise*0.5) / 2;
                    shape.lineTo(hw, straightH);
                    shape.quadraticCurveTo(0, ctrlY, -hw, peakY);
                }
            } else if (panelShape === 'gothic') {
                if (panelHalfSide === 0) {
                    const straightH = (sh/2) - (sw * 0.7);
                    shape.lineTo(hw, straightH);
                    shape.quadraticCurveTo(hw * 0.2, sh/2, 0, sh/2);
                    shape.quadraticCurveTo(-hw * 0.2, sh/2, -hw, straightH);
                } else if (panelHalfSide === -1) {
                    const straightH = (sh/2) - (sw * 1.4);
                    shape.lineTo(hw, sh/2);
                    shape.quadraticCurveTo(sw * 0.1, sh/2, -hw, straightH);
                } else if (panelHalfSide === 1) {
                    const straightH = (sh/2) - (sw * 1.4);
                    shape.lineTo(hw, straightH);
                    shape.quadraticCurveTo(-sw * 0.1, sh/2, -hw, sh/2);
                }
            } else {
                shape.lineTo(hw, sh/2);
                shape.lineTo(-hw, sh/2);
            }
            shape.lineTo(-hw, -sh/2);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, pth - bThick*2), bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: bSize, bevelThickness: bThick });
            geo.translate(0, 0, -Math.max(0.01, pth - bThick*2)/2);
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

        if (isSquare && isClassicOrGrid) {
            const stileW = Math.max(3.0, width * 0.12);
            const railTopH = stileW;
            const railBotH = stileW * 2.0;
            const railMidH = stileW * 0.9;
            const mullionW = stileW * 0.9;
            const handleY = height * 0.45;

            const geoStile = createBeveledRect(stileW, height, thickness); 
            const geoRailT = rotateUVs(createBeveledRect(width - stileW*2, railTopH, thickness)); 
            const geoRailB = rotateUVs(createBeveledRect(width - stileW*2, railBotH, thickness));

            builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width/2 + stileW/2, height/2, 0), castShadow: true, receiveShadow: true });
            builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width/2 - stileW/2, height/2, 0), castShadow: true, receiveShadow: true });
            builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - railTopH/2, 0), castShadow: true, receiveShadow: true });
            builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, railBotH/2, 0), castShadow: true, receiveShadow: true });

            if (style === 'classic_4_panel') {
                const geoRailM = rotateUVs(createBeveledRect(width - stileW*2, railMidH, thickness));
                builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, handleY, 0), castShadow: true, receiveShadow: true });
                const botPanelH = (handleY - railMidH/2) - railBotH;
                const topPanelH = (height - railTopH) - (handleY + railMidH/2);
                const panelW = (width - stileW*2 - mullionW) / 2;
                const geoMullionBot = createBeveledRect(mullionW, botPanelH, thickness);
                const geoMullionTop = createBeveledRect(mullionW, topPanelH, thickness);
                builder.addNode({ geometry: geoMullionBot, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, railBotH + botPanelH/2, 0), castShadow: true, receiveShadow: true });
                builder.addNode({ geometry: geoMullionTop, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, handleY + railMidH/2 + topPanelH/2, 0), castShadow: true, receiveShadow: true });
                const geoBotPanel = createBeveledPanelGeo(panelW, botPanelH, thickness * 0.6, 'square');
                const geoTopPanel = createBeveledPanelGeo(panelW, topPanelH, thickness * 0.6, 'square');
                [-1, 1].forEach(side => {
                    const xOff = (mullionW/2 + panelW/2) * side;
                    builder.addNode({ geometry: geoBotPanel, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(xOff, railBotH + botPanelH/2, 0), castShadow: true, receiveShadow: true });
                    builder.addNode({ geometry: geoTopPanel, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(xOff, handleY + railMidH/2 + topPanelH/2, 0), castShadow: true, receiveShadow: true });
                });
            } else if (style === 'classic_2_panel') {
                const geoRailM = rotateUVs(createBeveledRect(width - stileW*2, railMidH, thickness));
                builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, handleY, 0), castShadow: true, receiveShadow: true });
                const botPanelH = (handleY - railMidH/2) - railBotH;
                const topPanelH = (height - railTopH) - (handleY + railMidH/2);
                const panelW = width - stileW*2;
                const geoBotPanel = createBeveledPanelGeo(panelW, botPanelH, thickness * 0.6, 'square');
                const geoTopPanel = createBeveledPanelGeo(panelW, topPanelH, thickness * 0.6, 'square');
                builder.addNode({ geometry: geoBotPanel, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, railBotH + botPanelH/2, 0), castShadow: true, receiveShadow: true });
                builder.addNode({ geometry: geoTopPanel, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, handleY + railMidH/2 + topPanelH/2, 0), castShadow: true, receiveShadow: true });
            } else if (style === 'classic_4_horizontal') {
                const numPanels = 4;
                const totalRailSpace = railMidH * (numPanels - 1);
                const panelHeight = (height - railTopH - railBotH - totalRailSpace) / numPanels;
                const panelW = width - stileW*2;
                for (let i = 0; i < numPanels; i++) {
                    const geoPanel = createBeveledPanelGeo(panelW, panelHeight, thickness * 0.6, 'square');
                    const yPos = railBotH + panelHeight/2 + i * (panelHeight + railMidH);
                    builder.addNode({ geometry: geoPanel, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, yPos, 0), castShadow: true, receiveShadow: true });
                    if (i < numPanels - 1) {
                        const geoRail = rotateUVs(createBeveledRect(panelW, railMidH, thickness));
                        const railY = yPos + panelHeight/2 + railMidH/2;
                        builder.addNode({ geometry: geoRail, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, railY, 0), castShadow: true, receiveShadow: true });
                    }
                }
            } else if (style === 'grid_panel') {
                const rows = 5; const cols = 3; 
                const pW = (width - stileW*2 - mullionW*(cols-1))/cols; 
                const pH = (height - railTopH - railBotH - railMidH*(rows-1))/rows;
                for (let r=0; r<rows; r++) {
                    for (let c=0; c<cols; c++) {
                        const geoGrid = createBeveledPanelGeo(pW, pH, thickness * 0.6, 'square');
                        const xPos = -width/2 + stileW + pW/2 + c*(pW + mullionW);
                        const yPos = railBotH + pH/2 + r*(pH + railMidH);
                        builder.addNode({ geometry: geoGrid, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(xPos, yPos, 0), castShadow: true, receiveShadow: true });
                    }
                }
                const geoRailInt = rotateUVs(createBeveledRect(width - stileW*2, railMidH, thickness));
                for (let r=1; r<rows; r++) {
                    const yPos = railBotH + r*pH + (r-1)*railMidH + railMidH/2;
                    builder.addNode({ geometry: geoRailInt, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, yPos, 0), castShadow: true, receiveShadow: true });
                }
                const geoMullionInt = createBeveledRect(mullionW, pH, thickness);
                for (let r=0; r<rows; r++) {
                    const yPos = railBotH + pH/2 + r*(pH + railMidH);
                    for (let c=1; c<cols; c++) {
                        const xPos = -width/2 + stileW + c*pW + (c-1)*mullionW + mullionW/2;
                        builder.addNode({ geometry: geoMullionInt, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(xPos, yPos, 0), castShadow: true, receiveShadow: true });
                    }
                }
            }
        } else {
            const isArched = shapeType !== 'square';
            const bSize = isArched ? 0 : 0.06;
            const hAdjust = isArched ? 0 : bSize*2;
            const doorOutline = createDoorShape(width, Math.max(0.1, height - hAdjust), shapeType, halfSide);
            const coreGeo = new THREE.ExtrudeGeometry(doorOutline, { 
                depth: Math.max(0.01, thickness - hAdjust), 
                bevelEnabled: !isArched, 
                bevelSegments: 3, 
                steps: 1, 
                bevelSize: bSize, 
                bevelThickness: bSize 
            });
            coreGeo.translate(0, bSize, -Math.max(0.01, thickness - hAdjust) / 2);
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
            builder.addNode({ geometry: coreGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, 0, 0), castShadow: true, receiveShadow: true });

            const gap = 0.2;
            if (style === 'classic_4_horizontal') {
                const numPanels = 4; const panelHeight = (height - (gap * (numPanels - 1))) / numPanels; 
                for (let i = 0; i < numPanels; i++) { 
                    const isTop = (i === numPanels - 1);
                    const geoPanel = createBeveledPanelGeo(width - 0.6, panelHeight, thickness + 0.05, isTop ? shapeType : 'square', isTop ? halfSide : 0); 
                    const yPos = (panelHeight / 2) + i * (panelHeight + gap); 
                    builder.addNode({ geometry: geoPanel, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, yPos, 0), castShadow: true, receiveShadow: true });
                }
            } else if (style === 'classic_2_panel') {
                const topH = height * 0.65; const botH = height * 0.25; 
                const geoTop = createBeveledPanelGeo(width - 0.8, topH, thickness + 0.05, shapeType, halfSide); const geoBot = createBeveledPanelGeo(width - 0.8, botH, thickness + 0.05, 'square');
                builder.addNode({ geometry: geoTop, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topH/2 - gap, 0), castShadow: true });
                builder.addNode({ geometry: geoBot, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botH/2 + gap*2, 0), castShadow: true });
            } else if (style === 'classic_4_panel') {
                const topH = height * 0.55; const botH = height * 0.3; const pw = width/2 - 0.4;
                const geoTop = createBeveledPanelGeo(pw, topH, thickness + 0.05, shapeType, halfSide); const geoBot = createBeveledPanelGeo(pw, botH, thickness + 0.05, 'square');
                [-1, 1].forEach(side => {
                    const xOff = (pw/2 + 0.15) * side;
                    builder.addNode({ geometry: geoTop, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(xOff, height - topH/2 - gap, 0), castShadow: true });
                    builder.addNode({ geometry: geoBot, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(xOff, botH/2 + gap*2, 0), castShadow: true });
                });
            } else if (style === 'grid_panel') {
                const rows = 5; const cols = 3; const pW = (width - gap*(cols+1))/cols; const pH = (height - gap*(rows+1))/rows;
                for (let r=0; r<rows; r++) {
                    const isTop = (r === rows - 1);
                    for (let c=0; c<cols; c++) {
                        const geoGrid = createBeveledPanelGeo(pW - 0.1, pH - 0.1, thickness + 0.05, isTop ? shapeType : 'square', isTop ? halfSide : 0);
                        const xPos = -width/2 + gap + pW/2 + c*(pW + gap);
                        const yPos = gap + pH/2 + r*(pH + gap);
                        builder.addNode({ geometry: geoGrid, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(xPos, yPos, 0), castShadow: true });
                    }
                }
            }
        }

        const sweepH = 0.35;
        const sweepW = width - 0.4;
        const sweepD = thickness * 0.7;
        const shapeSweep = new THREE.Shape();
        const sw = sweepW/2, shSweep = sweepH/2;
        shapeSweep.moveTo(-sw, -shSweep); shapeSweep.lineTo(sw, -shSweep); shapeSweep.lineTo(sw, shSweep); shapeSweep.lineTo(-sw, shSweep); shapeSweep.lineTo(-sw, -shSweep);
        const sweepGeo = new THREE.ExtrudeGeometry(shapeSweep, { depth: sweepD, bevelEnabled: false });
        sweepGeo.translate(0, 0, -sweepD/2);
        const sweepUvs = sweepGeo.attributes.uv;
        const sweepPos = sweepGeo.attributes.position;
        if (sweepUvs && sweepPos) {
            for (let i = 0; i < sweepUvs.count; i++) {
                sweepUvs.setXY(i, (sweepPos.getX(i) + sw) / sweepW, (sweepPos.getY(i) + shSweep) / sweepH);
            }
            sweepUvs.needsUpdate = true;
        }
        builder.addNode({ geometry: sweepGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, -sweepH / 2 + 0.01, 0), castShadow: true, receiveShadow: true, userData: { isSweep: true } });
    }
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 }); const silverMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.9, roughness: 0.15 }); const handleY = height * 0.45; 
    if (['sliding', 'double_sliding'].includes(type) && isGlass) {
        const handleGeo = new THREE.CylinderGeometry(0.35, 0.35, 30, 16); const standoffGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
        [-1, 1].forEach(side => { const zPos = side === 1 ? thickness/2 + 1.2 : -thickness/2 - 1.2; 
            builder.addNode({ geometry: handleGeo, materialOverride: silverMat, parent: group, position: new THREE.Vector3((width/2 - 3) * signX, handleY, zPos), castShadow: true, userData: { isHandle: true } });
            builder.addNode({ geometry: standoffGeo, materialOverride: silverMat, parent: group, position: new THREE.Vector3((width/2 - 3) * signX, handleY + 12, zPos - side*0.6), rotation: new THREE.Euler(Math.PI/2, 0, 0), castShadow: true, userData: { isHandle: true } });
            builder.addNode({ geometry: standoffGeo, materialOverride: silverMat, parent: group, position: new THREE.Vector3((width/2 - 3) * signX, handleY - 12, zPos - side*0.6), rotation: new THREE.Euler(Math.PI/2, 0, 0), castShadow: true, userData: { isHandle: true } });
        });
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
        builder.addNode({ geometry: flushGeo, materialOverride: isPocket ? pocketHandleMat : metalMat, parent: group, position: new THREE.Vector3((width/2 - 4) * signX, hY, thickness/2 + 0.1), castShadow: true, userData: { isHandle: true } });
        builder.addNode({ geometry: flushGeo, materialOverride: isPocket ? pocketHandleMat : metalMat, parent: group, position: new THREE.Vector3((width/2 - 4) * signX, hY, -thickness/2 - 0.1), castShadow: true, userData: { isHandle: true } });
        
        // Inner recessed cavity for realistic depth
        const innerGeo = makeHandleGeo(hW * 0.6, hH * 0.8, 0.5, 0.02);
        const innerMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.9, roughness: 0.6 });
        builder.addNode({ geometry: innerGeo, materialOverride: innerMat, parent: group, position: new THREE.Vector3((width/2 - 4) * signX, hY, thickness/2 + 0.05), castShadow: true, userData: { isHandle: true } });
        builder.addNode({ geometry: innerGeo, materialOverride: innerMat, parent: group, position: new THREE.Vector3((width/2 - 4) * signX, hY, -thickness/2 - 0.05), castShadow: true, userData: { isHandle: true } });
    } else if (type === 'pivot') {
        const barGeo = new THREE.CylinderGeometry(0.5, 0.5, 24, 16); const standoffGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 8);
        [-1, 1].forEach(side => { const zPos = side === 1 ? thickness/2 + 1.5 : -thickness/2 - 1.5; 
            builder.addNode({ geometry: barGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3((width/2 - 4) * signX, handleY, zPos), castShadow: true, userData: { isHandle: true } });
            builder.addNode({ geometry: standoffGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3((width/2 - 4) * signX, handleY + 10, zPos - side), rotation: new THREE.Euler(Math.PI/2, 0, 0), castShadow: true, userData: { isHandle: true } });
            builder.addNode({ geometry: standoffGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3((width/2 - 4) * signX, handleY - 10, zPos - side), rotation: new THREE.Euler(Math.PI/2, 0, 0), castShadow: true, userData: { isHandle: true } });
        });
    } else if (type === 'folding_lead') { 
        const pullGeo = new THREE.BoxGeometry(0.8, 14, thickness + 1.2); 
        builder.addNode({ geometry: pullGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3((width/2 - 1.5) * -signX, handleY, 0), castShadow: true, userData: { isHandle: true } });
    } else if (['single', 'double', 'french'].includes(type) && !Boolean(style && style.startsWith('gate_'))) {
        const hZF = thickness/2; const hZB = -thickness/2;
        const leverX = (width/2 - 3.5) * signX;
        
        const roseGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.2, 24); roseGeo.rotateX(Math.PI/2);
        builder.addNode({ geometry: roseGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(leverX, handleY, hZF + 0.1), castShadow: true, userData: { isHandle: true } });
        builder.addNode({ geometry: roseGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(leverX, handleY, hZB - 0.1), castShadow: true, userData: { isHandle: true } });
        
        const stemGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.5, 16); stemGeo.rotateX(Math.PI/2);
        builder.addNode({ geometry: stemGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(leverX, handleY, hZF + 0.75), castShadow: true, userData: { isHandle: true } });
        builder.addNode({ geometry: stemGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(leverX, handleY, hZB - 0.75), castShadow: true, userData: { isHandle: true } });
        
        const handleLGeo = new THREE.CylinderGeometry(0.3, 0.4, 5, 16); handleLGeo.rotateZ(Math.PI/2);
        const handleDir = -signX; 
        builder.addNode({ geometry: handleLGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(leverX + 2.5*handleDir, handleY, hZF + 1.25), castShadow: true, userData: { isHandle: true } });
        builder.addNode({ geometry: handleLGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(leverX + 2.5*handleDir, handleY, hZB - 1.25), castShadow: true, userData: { isHandle: true } });

        const keyGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.25, 16); keyGeo.rotateX(Math.PI/2);
        builder.addNode({ geometry: keyGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(leverX, handleY - 2.5, hZF + 0.125), castShadow: true, userData: { isHandle: true } });
        builder.addNode({ geometry: keyGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(leverX, handleY - 2.5, hZB - 0.125), castShadow: true, userData: { isHandle: true } });
        
        const latchGeo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
        builder.addNode({ geometry: latchGeo, materialOverride: silverMat, parent: group, position: new THREE.Vector3((width/2 + 0.2) * signX, handleY, 0), castShadow: true, userData: { isHandle: true } });
        const faceplateGeo = new THREE.BoxGeometry(0.1, 4, 1.2);
        builder.addNode({ geometry: faceplateGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3((width/2 + 0.05) * signX, handleY, 0), castShadow: true, userData: { isHandle: true } });

    } else if (Boolean(style && style.startsWith('gate_')) && ['single', 'double', 'french'].includes(type)) {
        // Heavy-duty sliding bolt latch on gate
        const latchX = (width/2 - 4.5) * signX;
        const latchBackplateGeo = new THREE.BoxGeometry(3.0, 10.0, 0.4);
        const boltRodGeo = new THREE.CylinderGeometry(0.35, 0.35, 12.0, 16);
        boltRodGeo.rotateZ(Math.PI / 2);
        const boltKnobGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.8, 12);
        boltKnobGeo.rotateX(Math.PI / 2);

        [-thickness/2 - 0.2, thickness/2 + 0.2].forEach(zPos => {
            builder.addNode({ geometry: latchBackplateGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(latchX, handleY, zPos), castShadow: true, userData: { isHandle: true } });
            builder.addNode({ geometry: boltRodGeo, materialOverride: silverMat, parent: group, position: new THREE.Vector3(latchX + 1.5 * signX, handleY, zPos + (zPos > 0 ? 0.3 : -0.3)), castShadow: true, userData: { isHandle: true } });
            builder.addNode({ geometry: boltKnobGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(latchX, handleY, zPos + (zPos > 0 ? 0.9 : -0.9)), castShadow: true, userData: { isHandle: true } });
        });

        // Vertical ground drop-bolt on double gates
        if (type === 'double' && signX === 1) {
            const dropRodGeo = new THREE.CylinderGeometry(0.35, 0.35, 20.0, 16);
            const dropGuideGeo = new THREE.BoxGeometry(2.0, 3.0, 1.5);
            builder.addNode({ geometry: dropRodGeo, materialOverride: silverMat, parent: group, position: new THREE.Vector3(width/2 - 2, 8, thickness/2 + 0.3), castShadow: true, userData: { isHandle: true } });
            builder.addNode({ geometry: dropGuideGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(width/2 - 2, 5, thickness/2 + 0.3), castShadow: true, userData: { isHandle: true } });
            builder.addNode({ geometry: dropGuideGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(width/2 - 2, 14, thickness/2 + 0.3), castShadow: true, userData: { isHandle: true } });
        }
    }
    if (['single', 'double', 'french', 'folding_main'].includes(type) && signX !== 0 && !Boolean(style && style.startsWith('gate_'))) { 
        const hingeW = 0.8, hingeD = 4.2;
        const hingeGeo = new THREE.BoxGeometry(hingeW, hingeD, 0.15);
        const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, hingeD, 16);
        [height * 0.88, height * 0.5, height * 0.12].forEach(y => { 
            const hG = new THREE.Group();
            builder.addNode({ geometry: hingeGeo, materialOverride: metalMat, parent: hG, position: new THREE.Vector3((width/2 - 0.05) * -signX, 0, 0), rotation: new THREE.Euler(0, signX === 1 ? Math.PI/2 : -Math.PI/2, 0), userData: { isHandle: true } });
            builder.addNode({ geometry: barrelGeo, materialOverride: metalMat, parent: hG, position: new THREE.Vector3((width/2 + 0.15) * -signX, 0, thickness/2 + 0.1), userData: { isHandle: true } });
            hG.position.set(0, y, 0);
            hG.castShadow = true; group.add(hG); 
        }); 
        
        const strikeGeo = new THREE.BoxGeometry(0.1, 6, 2.5);
        builder.addNode({ geometry: strikeGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3((width/2 - 0.01) * signX, height * 0.5, 0), userData: { isHandle: true } });
    }
    return group;
}
export const WIDGET_REGISTRY = {

    'jali_panel': {
        widget: "jali_panel", label: "JALI PANEL",
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 40, height: 100, jaliPattern: 'geometric', jaliMat: 'wood', thick: 2, elevation: 0 },
        render2D: (group, entity) => {
            const hw = entity.width / 2; const thick = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || 4) : (entity.thick || 4);
            const w = entity.width; const h = thick;
            const rect = new Konva.Rect({ x: -hw, y: -h/2, width: w, height: h, fill: 'transparent', stroke: '#d97706', strokeWidth: 2, dash: [4, 2] });
            group.add(rect);
            for(let i = -hw + 4; i < hw; i += 8) { group.add(new Konva.Line({ points: [i, -h/2, i+4, h/2], stroke: '#d97706', strokeWidth: 1 })); }
        },
        render3D: (sceneGroup, entity, helpers) => {
            let baseElev = entity.elevation || 0; let rawHeight = entity.height || 100;
            let bottomY = Math.max(0.2, baseElev); let topY = baseElev + rawHeight; let height = topY - bottomY;
            const builder = new BIMComponentBuilder(entity, helpers);
            const jaliGroup = builder.group;
            if (entity.localX !== undefined) {
                jaliGroup.position.set(entity.localX, bottomY, 0);
                jaliGroup.rotation.y = 0;
            } else {
                jaliGroup.position.set(entity.x, bottomY, entity.z);
                jaliGroup.rotation.y = -entity.angle;
            }
            
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
            const createBeveledFramePiece = (w, h, x, y, z) => {
                const shape = new THREE.Shape();
                shape.moveTo(-w/2, -h/2); shape.lineTo(w/2, -h/2); shape.lineTo(w/2, h/2); shape.lineTo(-w/2, h/2); shape.lineTo(-w/2, -h/2);
                const extrudeSettings = { depth: fThick, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.1, bevelThickness: 0.1 };
                const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geo.translate(0, 0, -fThick/2);
                builder.addNode({ geometry: geo, materialOverride: matExtrude, parent: jaliGroup, position: new THREE.Vector3(x, y, z), castShadow: true, receiveShadow: true });
            };
            createBeveledFramePiece(frameW, height, -entity.width/2 + frameW/2, height/2, 0);
            createBeveledFramePiece(frameW, height, entity.width/2 - frameW/2, height/2, 0);
            createBeveledFramePiece(entity.width - frameW*2, frameW, 0, height - frameW/2, 0);
            createBeveledFramePiece(entity.width - frameW*2, frameW, 0, frameW/2, 0);
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
                    builder.addNode({ geometry: new THREE.BoxGeometry(1.5, iH, lThick), materialOverride: matFrame, parent: latticeGroup, position: new THREE.Vector3(-iW/2 + c * stepX, 0, 0), castShadow: true });
                }
            } else {
                const defaultStep = entity.jaliPattern === 'geometric' ? 6 : 8;
                const targetStep = entity.jaliPatternSize || defaultStep;
                const cols = Math.max(1, Math.round(iW / targetStep));
                const rows = Math.max(1, Math.round(iH / targetStep));
                const stepX = iW / cols;
                const stepY = iH / rows;
                
                for (let c = 0; c < cols; c++) {
                    builder.addNode({ geometry: new THREE.BoxGeometry(1, iH, lThick), materialOverride: matBox, parent: latticeGroup, position: new THREE.Vector3(-iW/2 + (c + 0.5) * stepX, 0, 0), castShadow: true });
                }
                for (let r = 0; r < rows; r++) {
                    builder.addNode({ geometry: new THREE.BoxGeometry(iW, 1, lThick), materialOverride: matBox, parent: latticeGroup, position: new THREE.Vector3(0, -iH/2 + (r + 0.5) * stepY, 0), castShadow: true });
                }
                
                if (entity.jaliPattern === 'islamic') {
                    const diagLen = Math.hypot(stepX, stepY);
                    const angle = Math.atan2(stepY, stepX);
                    for (let c = 0; c < cols; c++) {
                        for (let r = 0; r < rows; r++) {
                            const cx = -iW/2 + (c + 0.5) * stepX;
                            const cy = -iH/2 + (r + 0.5) * stepY;
                            builder.addNode({ geometry: new THREE.BoxGeometry(diagLen, 0.5, lThick), materialOverride: matBox, parent: latticeGroup, position: new THREE.Vector3(cx, cy, 0), rotation: new THREE.Euler(0, 0, angle), castShadow: true });
                            builder.addNode({ geometry: new THREE.BoxGeometry(diagLen, 0.5, lThick), materialOverride: matBox, parent: latticeGroup, position: new THREE.Vector3(cx, cy, 0), rotation: new THREE.Euler(0, 0, -angle), castShadow: true });
                        }
                    }
                }
            }
            jaliGroup.add(latticeGroup);
            const hitboxGeo = new THREE.BoxGeometry(entity.width + 10, height + 10, (entity.thick || 20) + 10);
            builder.addNode({ geometry: hitboxGeo, parent: jaliGroup, position: new THREE.Vector3(0, height/2, 0), isHitbox: true });
            jaliGroup.userData = { isWidget: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
        }
    },
    'door': {
        widget: "door", label: "DOOR",
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 40, height: DOOR_HEIGHT, doorType: 'single', materials: { leaf: { id: 'wood_golden_teak' }, frame: { id: 'wood_golden_teak' } }, facing: 1, side: 1 },
        render2D: (group, entity) => {
            const hw = entity.width / 2; const thick = entity.wall?.thickness || entity.wall?.config?.thickness || 20;
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
            const fW = 4; const fThick = entity.thick + 0.2;
            MaterialManager.initEntityMaterials(entity);
            const matLeafKey = entity.materials?.[MaterialSlots.LEAF]?.id;
            const frameMatKey = entity.materials?.[MaterialSlots.FRAME]?.id;
            const trimMatKey = entity.materials?.[MaterialSlots.TRIM]?.id;
            
            if (!matLeafKey) console.warn(`Missing required parameter for slot LEAF on door entity ${entity.id}`);
            if (!frameMatKey) console.warn(`Missing required parameter for slot FRAME on door entity ${entity.id}`);
            
            const matDoor = helpers.getDynamicMaterial(matLeafKey, 'door'); 
            const matFrame = helpers.getDynamicMaterial(frameMatKey, 'door');
            const matThreshold = helpers.getDynamicMaterial(trimMatKey, 'door');
            
            // Apply a slight bevel to standard wood materials for realism (1mm edge bevel)
            // Handled via createBeveledExtrude default parameter

            
            // Helper to tag frame meshes so GizmoManager knows it's the frame
            const metalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 });
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

            const isGate = Boolean((entity.doorStyle && entity.doorStyle.startsWith('gate_')) || entity.doorType === 'gate');
            const isGlassDoor = matLeafKey === 'glass'; 
            const jambW = 0.75; const stopW = 1.25; const stopThick = 0.4; const archW = 2.75; const archThick = 0.5;
            const frameWidth = isGate ? 0 : jambW; 
            const frameThick = entity.thick + 0.2; 
            const doorThick = isGate ? 2.0 : 1.4; // Gates use sturdy 50mm structural hollow section depth
            const gapSide = isGate ? 1.0 : 0.12; 
            const gapTop = isGate ? 0.5 : 0.12; 
            
            // Threshold — separate optional piece sitting ON the floor (NOT a bottom frame)
            // Real doors: Header + Left Jamb + Right Jamb + optional Threshold. No bottom frame member.
            const isPocket = entity.doorType === 'pocket';
            const hasThreshold = !isPocket && !isGate && entity.hasThreshold !== false; // Gates have no threshold
            const tHeight = hasThreshold ? 0.9 : 0; 
            const doorClearance = isGate ? 2.0 : 0.35; // 50mm bottom clearance for gates
            const gapBottom = tHeight + doorClearance; // door leaf Y starts here
            
            if (hasThreshold) {
                // Threshold fits exactly between the side jambs to look like a bottom frame piece
                const thresholdW = entity.width - jambW * 2;
                const tDepth = frameThick; // flush with frame
                const thresholdGeo = rotateUvs(createBeveledExtrude(thresholdW, tHeight, tDepth, 0.03));
                builder.addNode({ geometry: thresholdGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, position: new THREE.Vector3(0, -bottomY + tHeight/2, 0), castShadow: true, receiveShadow: true, userData: { isThreshold: true, isFrame: true } });
            }
            
            if (!isGate) {
                // Sill plate — fills the below-floor gap in the wall cutout (wallBottom=-1 to floor=0)
                const sillHeight = 1.0; 
                const totalFrameW = entity.width + archW * 2 - jambW * 2;
                const sillGeo = rotateUvs(createBeveledExtrude(totalFrameW, sillHeight, frameThick, 0.01));
                builder.addNode({ geometry: sillGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, position: new THREE.Vector3(0, -bottomY - sillHeight/2, 0), receiveShadow: true, userData: { isSillPlate: true, isFrame: true } });
            }
            
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
            const contactShadow = builder.addNode({ geometry: cShadowGeo, materialOverride: cShadowMat, parent: doorGroup, isHitbox: false, castShadow: false, receiveShadow: false, userData: { isShadow: true } });
            contactShadow.rotation.x = -Math.PI / 2;
            contactShadow.position.set(0, -bottomY + 0.02, 0);
            
            const shapeType = entity.doorShape || 'square';
            if (!isGate) {
                if (entity.doorType !== 'pocket' || shapeType !== 'square') {
                    if (shapeType === 'square') {
                        if (entity.doorType !== 'pocket') {
                            // Clean Butt Joints for Jambs (Head Jamb between Side Jambs)
                            const jamHeight = height + bottomY;
                            const jamY = jamHeight/2 - bottomY;
                            const jamGeo = createBeveledExtrude(jambW, jamHeight, frameThick); 
                            const jamL = builder.addNode({ geometry: jamGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } }); jamL.position.set(-entity.width/2 + jambW/2, jamY, 0); 
                            const jamR = builder.addNode({ geometry: jamGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } }); jamR.position.set(entity.width/2 - jambW/2, jamY, 0); 
                            const jamTGeo = rotateUvs(createBeveledExtrude(entity.width - jambW*2, jambW, frameThick)); 
                            const jamT = builder.addNode({ geometry: jamTGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } }); jamT.position.set(0, height - jambW/2, 0);
                            
                            // Stops (Rebate) & Gasket
                            const swingDir = entity.facing === 1 ? 1 : -1;
                            const stopZ = -swingDir * (doorThick/2 + stopThick/2);
                            const stopBottom = -bottomY + tHeight;
                            const stopH = (height - jambW) - stopBottom;
                            const stopY = stopBottom + stopH/2;
                            const stopGeoV = createBeveledExtrude(stopW, stopH, stopThick, 0.02); 
                            const stopL = builder.addNode({ geometry: stopGeoV, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } }); stopL.position.set(-entity.width/2 + jambW + stopW/2, stopY, stopZ); 
                            const stopR = builder.addNode({ geometry: stopGeoV, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } }); stopR.position.set(entity.width/2 - jambW - stopW/2, stopY, stopZ);
                            const stopGeoH = rotateUvs(createBeveledExtrude(entity.width - jambW*2 - stopW*2, stopW, stopThick, 0.02)); 
                            const stopT = builder.addNode({ geometry: stopGeoH, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } }); stopT.position.set(0, height - jambW - stopW/2, stopZ);
                            
                            const gasketMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }); 
                            const gaskGeo = new THREE.BoxGeometry(0.1, stopH, 0.1); 
                            const gaskL = builder.addNode({ geometry: gaskGeo, materialOverride: gasketMat, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } }); gaskL.position.set(-entity.width/2 + jambW + stopW + 0.05, stopY, doorThick/2 + 0.05); 
                            const gaskR = builder.addNode({ geometry: gaskGeo, materialOverride: gasketMat, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } }); gaskR.position.set(entity.width/2 - jambW - stopW - 0.05, stopY, doorThick/2 + 0.05); 
                            const gaskGeoH = new THREE.BoxGeometry(entity.width - jambW*2 - stopW*2, 0.1, 0.1); 
                            const gaskT = builder.addNode({ geometry: gaskGeoH, materialOverride: gasketMat, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } }); gaskT.position.set(0, height - jambW - stopW - 0.05, doorThick/2 + 0.05);
                            
                            // Architraves (Clean Butt Joints)
                            const archHeight = height + bottomY;
                            const archY = archHeight/2 - bottomY;
                            const archV = createBeveledExtrude(archW, archHeight, archThick); 
                            const archHgeo = rotateUvs(createBeveledExtrude(entity.width + archW*2, archW, archThick));
                            
                            [-frameThick/2 - archThick/2 + 0.05, frameThick/2 + archThick/2 - 0.05].forEach(zOff => { 
                                const tL = builder.addNode({ geometry: archV, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } }); tL.position.set(-entity.width/2 - archW/2 + jambW, archY, zOff); 
                                const tR = builder.addNode({ geometry: archV, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } }); tR.position.set(entity.width/2 + archW/2 - jambW, archY, zOff); 
                                const tT = builder.addNode({ geometry: archHgeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } }); tT.position.set(0, height + archW/2, zOff); 
                            });
                            
                            if (slWidth > 0) {
                                const innerJamGeo = createBeveledExtrude(jambW, height - jambW + bottomY, frameThick);
                                const iJamL = builder.addNode({ geometry: innerJamGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } }); iJamL.position.set(-entity.width/2 + jambW + slWidth - jambW/2, (height - jambW + bottomY)/2 - bottomY, 0);
                                const iJamR = builder.addNode({ geometry: innerJamGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } }); iJamR.position.set(entity.width/2 - jambW - slWidth + jambW/2, (height - jambW + bottomY)/2 - bottomY, 0);
                                
                                const slGlassW = slWidth - jambW;
                                const slBotGeo = createBeveledExtrude(slGlassW, 5, frameThick);
                                const slBotL = builder.addNode({ geometry: slBotGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } }); slBotL.position.set(-entity.width/2 + jambW + slGlassW/2, 2.5, 0);
                                const slBotR = builder.addNode({ geometry: slBotGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } }); slBotR.position.set(entity.width/2 - jambW - slGlassW/2, 2.5, 0);
                                
                                const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'glass_clear';
                                const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
                                const slGlassGeo = new THREE.BoxGeometry(slGlassW, height - jambW - 5, 0.4);
                                const glassL = builder.addNode({ geometry: slGlassGeo, materialOverride: glassMat, slot: MaterialSlots.GLASS, parent: doorGroup, userData: { isGlass: true } }); glassL.position.set(-entity.width/2 + jambW + slGlassW/2, 5 + (height - jambW - 5)/2, 0);
                                const glassR = builder.addNode({ geometry: slGlassGeo, materialOverride: glassMat, slot: MaterialSlots.GLASS, parent: doorGroup, userData: { isGlass: true } }); glassR.position.set(entity.width/2 - jambW - slGlassW/2, 5 + (height - jambW - 5)/2, 0);
                            }
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
                        const normalizeArchedFrameUVs = (geo, w, h, depth) => {
                            const uvs = geo.attributes.uv;
                            const pos = geo.attributes.position;
                            const norm = geo.attributes.normal;
                            if (!uvs || !pos) return geo;
                            const hw = w / 2;
                            const totalH = h + bottomY;
                            const d = depth || 15;
                            for (let i = 0; i < uvs.count; i++) {
                                const vx = pos.getX(i);
                                const vy = pos.getY(i);
                                const vz = pos.getZ(i);
                                const nz = norm ? norm.getZ(i) : 1;
                                if (Math.abs(nz) > 0.5) {
                                    uvs.setXY(i, (vx + hw) / w, (vy + bottomY) / totalH);
                                } else {
                                    uvs.setXY(i, (vz + d / 2) / d, (vy + bottomY) / totalH);
                                }
                            }
                            uvs.needsUpdate = true;
                            return geo;
                        };
                        
                        const frameShape = createArchedFrameShape(entity.width, height, entity.width - (frameWidth * 2), height - frameWidth, shapeType);
                        const jamGeo = new THREE.ExtrudeGeometry(frameShape, { depth: frameThick, bevelEnabled: false });
                        jamGeo.translate(0, 0, -frameThick/2);
                        normalizeArchedFrameUVs(jamGeo, entity.width, height, frameThick);
                        const jam = builder.addNode({ geometry: jamGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, castShadow: true, receiveShadow: true, userData: { isFrame: true } });
                        jam.position.set(0, 0, 0);
                        
                        [-frameThick/2 - 0.25, frameThick/2 + 0.25].forEach(zOff => {
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
                    // Wall-mounted guide roller brackets at top and bottom track stops
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
                    // Swing Gate Hinge Clamp Assemblies
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
            
            // Arched doors must be mounted flush with the wall face (Z=0 relative to hinge) 
            // so their tall peaks do not clip through the thick curved wall barrel when swinging.
            const panelZOffset = isArched ? 0 : -hingePinZ;

            if (entity.doorType === 'single') {
                const hingeHolder = new THREE.Group(); 
                if (entity.side === 1) { 
                    const panel = buildDetailedDoorPanel(entity, leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers, builder); 
                    hingeHolder.position.set(-(pivotXOffset + gapSide/2), gapBottom, hingePinZ); 
                    panel.position.set(-leafWidth/2, 0, panelZOffset); 
                    hingeHolder.rotation.y = -openAngle; 
                    hingeHolder.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: -(entity.facing === 1 ? 1 : -1) };
                    hingeHolder.add(panel);
                } else { 
                    const panel = buildDetailedDoorPanel(entity, leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers, builder); 
                    hingeHolder.position.set(pivotXOffset + gapSide/2, gapBottom, hingePinZ); 
                    panel.position.set(leafWidth/2, 0, panelZOffset); 
                    hingeHolder.rotation.y = openAngle; 
                    hingeHolder.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: (entity.facing === 1 ? 1 : -1) };
                    hingeHolder.add(panel);
                } 
                doorGroup.add(hingeHolder);
            } else if (entity.doorType === 'double' || entity.doorType === 'french') {
                const hw = leafWidth / 2 - gapSide/2; 
                const hL = new THREE.Group(); hL.position.set(pivotXOffset + gapSide/2, gapBottom, hingePinZ); hL.rotation.y = openAngle; 
                hL.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: (entity.facing === 1 ? 1 : -1) };
                const panelL = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers, builder); 
                panelL.position.set(hw/2, 0, panelZOffset); hL.add(panelL);
                
                const hR = new THREE.Group(); hR.position.set(-(pivotXOffset + gapSide/2), gapBottom, hingePinZ); hR.rotation.y = -openAngle;
                hR.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: -(entity.facing === 1 ? 1 : -1) };
                const panelR = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers, builder); 
                panelR.position.set(-hw/2, 0, panelZOffset); hR.add(panelR);
                
                const isLeftActive = entity.side === -1;
                const inactivePanel = isLeftActive ? panelR : panelL;
                
                if (shapeType === 'square') {
                    const astragalW = 1.0; const astragalThick = 0.5;
                    const astragalGeo = createBeveledExtrude(astragalW, leafHeight, astragalThick, 0.04);
                    const astragal = builder.addNode({ geometry: astragalGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: inactivePanel, castShadow: true, userData: { isFrame: true } });
                    const astX = isLeftActive ? -hw/2 : hw/2;
                    astragal.position.set(astX, leafHeight/2, doorThick/2 + astragalThick/2);
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
                    // Left panel (fixed on left half of arch, curves up to center)
                    const pFixed = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers, builder); 
                    pFixed.position.set(-hw/2 + overlap/2, gapBottom, isArched ? 0 : (-doorThick/2 - 0.1)); 
                    doorGroup.add(pFixed);
                    // Right panel (slides on right half of arch, curves down to right)
                    const pSlide = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers, builder); 
                    pSlide.position.set(hw/2 - overlap/2 - slideAmount, gapBottom, isArched ? 0 : (doorThick/2 + 0.1)); 
                    pSlide.userData = { isMovingPart: true, motionType: 'slide', baseX: hw/2 - overlap/2, maxSlide: -maxSlide };
                    doorGroup.add(pSlide);
                } else {
                    const hw = (leafWidth / 4) + (overlap / 2);
                    const maxSlide = hw - overlap;
                    const openPercent = entity.openAngle !== undefined ? entity.openAngle / 180 : 0;
                    const slideAmount = maxSlide * openPercent;
                    const pFixL = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers, builder); 
                    pFixL.position.set(-leafWidth/2 + hw/2, gapBottom, isArched ? 0 : (-doorThick/2 - 0.1));
                    const pFixR = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers, builder); 
                    pFixR.position.set(leafWidth/2 - hw/2, gapBottom, isArched ? 0 : (-doorThick/2 - 0.1));
                    const pSlideL = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers, builder); 
                    pSlideL.position.set(-leafWidth/4 + overlap/2 + slideAmount, gapBottom, isArched ? 0 : (doorThick/2 + 0.1)); 
                    pSlideL.userData = { isMovingPart: true, motionType: 'slide', baseX: -leafWidth/4 + overlap/2, maxSlide: -(hw - overlap) };
                    const pSlideR = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers, builder); 
                    pSlideR.position.set(leafWidth/4 - overlap/2 - slideAmount, gapBottom, isArched ? 0 : (doorThick/2 + 0.1));
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
                
                if (shapeType === 'square') {
                    // 1. Strike Jamb (opposite of pocket)
                    const jamGeoStrike = createBeveledExtrude(frameWidth, height + bottomY, frameThick);
                    const jamStrike = builder.addNode({ geometry: jamGeoStrike, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
                    jamStrike.position.set(strikeX, (height + bottomY)/2 - bottomY, 0);
                    
                    // 2. Split Jamb (Pocket Entrance)
                    const splitJambThick = (frameThick - pocketDoorThick - 0.24) / 2; // ~3mm reveal clearance each side
                    const splitGeo = createBeveledExtrude(frameWidth, height + bottomY, splitJambThick);
                    const jamR_front = builder.addNode({ geometry: splitGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
                    jamR_front.position.set(pocketX, (height + bottomY)/2 - bottomY, frameThick/2 - splitJambThick/2);
                    const jamR_back = builder.addNode({ geometry: splitGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
                    jamR_back.position.set(pocketX, (height + bottomY)/2 - bottomY, -frameThick/2 + splitJambThick/2);
                    
                    // 3. Head Track (Spans across the passage)
                    const headGeo = rotateUvs(createBeveledExtrude(passageW - frameWidth*2, frameWidth, frameThick));
                    const head = builder.addNode({ geometry: headGeo, materialOverride: matFrame, slot: MaterialSlots.FRAME, parent: doorGroup, userData: { isFrame: true } });
                    head.position.set(0, height - frameWidth/2, 0);
                }
                
                // 4. Internal AO Contact Shadow plane inside pocket
                const pocketShadowCanvas = document.createElement('canvas'); pocketShadowCanvas.width = 32; pocketShadowCanvas.height = 256;
                const pCtx = pocketShadowCanvas.getContext('2d');
                if (pCtx) {
                    const grad = pCtx.createLinearGradient(0, 0, 32, 0);
                    grad.addColorStop(slideDir === 1 ? 0 : 1, 'rgba(0,0,0,0.6)'); grad.addColorStop(slideDir === 1 ? 1 : 0, 'rgba(0,0,0,0)');
                    pCtx.fillStyle = grad; pCtx.fillRect(0, 0, 32, 256);
                }
                const pTex = new THREE.CanvasTexture(pocketShadowCanvas);
                const pShadowPlane = builder.addNode({ geometry: new THREE.PlaneGeometry(8, height), materialOverride: new THREE.MeshBasicMaterial({ map: pTex, transparent: true, depthWrite: false }), parent: doorGroup, castShadow: false, receiveShadow: false, isHitbox: false, userData: { isShadow: true } });
                pShadowPlane.position.set(pocketX + (slideDir * 3), height/2, 0);
                
                // 5. Pocket Door Panel
                // When closed, edge touches strike jamb perfectly
                const strikeInnerX = -slideDir * (passageW/2 - frameWidth);
                const p = buildDetailedDoorPanel(entity, pLeafW, pLeafH, pocketDoorThick, matDoor, entity.doorType, isGlassDoor, 0, helpers, builder); 
                const openPercent = entity.openAngle !== undefined ? entity.openAngle / 180 : 0;
                const baseX = strikeInnerX + slideDir * (pLeafW / 2);
                const maxSlide = slideDir * widthBetweenJambs;
                
                p.position.set(baseX + maxSlide * openPercent, gapBottom, 0);
                p.userData = { isMovingPart: true, motionType: 'slide', baseX: baseX, maxSlide: maxSlide };
                doorGroup.add(p);
            } else if (entity.doorType === 'pivot') {
                const p = buildDetailedDoorPanel(entity, leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers, builder); const off = leafWidth * 0.15; p.position.set(leafWidth/2 - off, gapBottom, 0);
                const pivot = new THREE.Group(); const signX = entity.side === 1 ? 1 : -1; pivot.position.set(pivotXOffset + off, 0, 0); pivot.rotation.y = -openAngle * signX; pivot.add(p);
                pivot.userData = { isMovingPart: true, motionType: 'rotate', baseRotation: 0, motionSign: -signX * (entity.facing === 1 ? 1 : -1) };
                doorGroup.add(pivot);
                const plateGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16); const floorPlate = builder.addNode({ geometry: plateGeo, materialOverride: metalMat, slot: MaterialSlots.HARDWARE, parent: doorGroup }); floorPlate.position.set(pivotXOffset + off, 0.2, 0); const topPlate = builder.addNode({ geometry: plateGeo, materialOverride: metalMat, slot: MaterialSlots.HARDWARE, parent: doorGroup }); topPlate.position.set(pivotXOffset + off, height - 0.2, 0); 
            } else if (entity.doorType === 'folding') {
                const numPanels = 2;
                if (shapeType === 'square') {
                    const trackGeo = new THREE.BoxGeometry(entity.width - frameWidth*2, 1.5, doorThick + 1); 
                    const track = builder.addNode({ geometry: trackGeo, materialOverride: metalMat, slot: MaterialSlots.HARDWARE, parent: doorGroup }); 
                    track.position.set(0, height - frameWidth/2 - 0.75, 0); 
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
                
                // Panel on Left half of arch must curve from outer left up to center (signX=1 -> halfSide=-1).
                // Panel on Right half of arch must curve from center down to outer right (signX=-1 -> halfSide=1).
                const p1SignX = isRightHinge ? -1 : 1; 
                const p1 = buildDetailedDoorPanel(entity, panelW, leafHeight, doorThick, matDoor, 'folding_main', isGlassDoor, p1SignX, helpers, builder); 
                p1.position.set((panelW/2 + gapSide/2) * -signX, 0, isArched ? 0 : (-hingePinZ * swingDir)); 
                pivot1.add(p1);
                
                const pivot2 = new THREE.Group(); 
                pivot2.position.set((panelW + gapSide) * -signX, 0, 0); 
                pivot2.rotation.y = -baseOpenAngle * 2 * (entity.facing === 1 ? 1 : -1); 
                pivot2.userData = { isMovingPart: true, motionType: 'bifold_lead', motionSign: -2 * (entity.facing === 1 ? 1 : -1) };
                pivot1.add(pivot2);
                
                const p2SignX = isRightHinge ? 1 : -1; 
                const p2 = buildDetailedDoorPanel(entity, panelW, leafHeight, doorThick, matDoor, 'folding_lead', isGlassDoor, p2SignX, helpers, builder); 
                p2.position.set((panelW/2 + gapSide/2) * -signX, 0, 0); 
                pivot2.add(p2);
                
                const jointHingeGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 12); 
                [leafHeight * 0.85, leafHeight * 0.5, leafHeight * 0.15].forEach(yPos => { 
                    const hingeMesh = builder.addNode({ geometry: jointHingeGeo, materialOverride: metalMat, slot: MaterialSlots.HARDWARE, parent: pivot2 }); 
                    hingeMesh.position.set(0, yPos, (doorThick/2 + 0.1) * swingDir); 
                });
                const guidePin = builder.addNode({ geometry: new THREE.CylinderGeometry(0.4, 0.4, 3, 8), materialOverride: metalMat, slot: MaterialSlots.HARDWARE, parent: p2 }); 
                guidePin.position.set((panelW - 2) * -signX, leafHeight, 0); 
                pivot2.add(guidePin);
            }
            const hitboxGeo = new THREE.BoxGeometry(entity.width + 10, height + 10, (entity.thick || 20) + 10);
            const hitbox = builder.addNode({ geometry: hitboxGeo, materialOverride: new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}), parent: doorGroup, isHitbox: true, castShadow: false, receiveShadow: false });
            hitbox.position.set(0, height/2, 0);
            doorGroup.userData = { isWidget: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
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
            const fThick = isTrad ? wallThickness + 2 : wallThickness + 0.5; // Spans full wall cutout
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

                const stileL = builder.addNode({ geometry: geoStileL, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [-totalW / 2 + fW / 2, totalH / 2, 0], userData: { isFrame: true }, castShadow: true, receiveShadow: true });
                const stileR = builder.addNode({ geometry: geoStileR, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [totalW / 2 - fW / 2, totalH / 2, 0], userData: { isFrame: true }, castShadow: true, receiveShadow: true });
                const railT = builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [0, totalH - fW / 2, 0], userData: { isFrame: true }, castShadow: true, receiveShadow: true });
                const railB = builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [0, fW / 2, 0], userData: { isFrame: true }, castShadow: true, receiveShadow: true });

                // Stepped Sash Seating Rebate (Decorative inner step)
                const rebateW = 0.5, rebateD = fThick * 0.15;
                const geoRebateV = createBeveledRect(rebateW, totalH - fW * 2, rebateD, 0.08, 0.08);
                const geoRebateH = rotateUVs(createBeveledRect(totalW - fW * 2, rebateW, rebateD, 0.08, 0.08));

                builder.addNode({ geometry: geoRebateV, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [-totalW / 2 + fW + rebateW / 2, totalH / 2, fThick / 2 - rebateD / 2], userData: { isFrame: true }, castShadow: true });
                builder.addNode({ geometry: geoRebateV, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [totalW / 2 - fW - rebateW / 2, totalH / 2, fThick / 2 - rebateD / 2], userData: { isFrame: true }, castShadow: true });
                builder.addNode({ geometry: geoRebateH, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [0, totalH - fW - rebateW / 2, fThick / 2 - rebateD / 2], userData: { isFrame: true }, castShadow: true });
                builder.addNode({ geometry: geoRebateH, materialOverride: matsExtrude, parent: frameGroup, slot: MaterialSlots.FRAME, position: [0, fW + rebateW / 2, fThick / 2 - rebateD / 2], userData: { isFrame: true }, castShadow: true });

                const sThick = entity.thick * 0.35;
                const headerTrackGeo = new THREE.BoxGeometry(totalW - fW * 2, 0.5, sThick * 2.2);
                builder.addNode({ geometry: headerTrackGeo, materialOverride: matMetalHardware, parent: frameGroup, slot: MaterialSlots.HARDWARE, position: [0, totalH - fW - 0.25, 0], userData: { isHandle: true }, paintable: false });

                frameGroup.position.set(0, 0, zOffset);
                return frameGroup;
            };

            winGroup.add(buildOuterFrame(entity.width, height));

            const iW = entity.width - fW * 2;
            const iH = height - fW * 2;
            const sThick = 1.35;

            // --- 2. Window Sash Assembly (45° Miter Joints, Sash Rollers, Interlockers, Glazing Beads, PBR Glass & Hardware) ---
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
                        
                        // Top and Bottom Vertical Cremone Lock Rods
                        const lockRodGeo = new THREE.CylinderGeometry(0.12, 0.12, sashH * 0.35, 8);
                        builder.addNode({ geometry: lockRodGeo, materialOverride: matMetalHardware, parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, sashH * 0.22, sThick / 2 + 0.1], userData: { isHandle: true }, paintable: false });
                        builder.addNode({ geometry: lockRodGeo, materialOverride: matMetalHardware, parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, -sashH * 0.22, sThick / 2 + 0.1], userData: { isHandle: true }, paintable: false });
                        
                        const handleX = hingeSide === 1 ? sashW / 2 - sFw / 2 : -sashW / 2 + sFw / 2;
                        handleGroup.position.set(handleX, sashH * 0.42, 0);
                    } else {
                        // Recessed Metal Flush Pull for Sliding Windows
                        builder.addNode({ geometry: createBeveledRect(1.4, 5.5, 0.3, 0.05, 0.05), materialOverride: matMetalHardware, parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, 0, sThick / 2 + 0.08], userData: { isHandle: true }, paintable: false });
                        builder.addNode({ geometry: new THREE.BoxGeometry(0.8, 3.8, 0.25), materialOverride: new THREE.MeshBasicMaterial({ color: 0x0a0a0a }), parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, 0, sThick / 2 + 0.15], userData: { isHandle: true }, paintable: false });
                        builder.addNode({ geometry: createBeveledRect(0.4, 0.8, 0.2, 0.03, 0.03), materialOverride: matMetalHardware, parent: handleGroup, slot: MaterialSlots.HARDWARE, position: [0, 2.0, sThick / 2 + 0.2], userData: { isHandle: true }, paintable: false });
                        handleGroup.position.set(sashW / 2 - sFw / 2, sashH * 0.42, 0);
                    }
                    sG.add(handleGroup);

                    // Hardware 2: Butt Hinges for Casement Windows
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
                    // Solid Wooden Raised Panel (For Traditional Shutters)
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
                const openAngle = Math.PI / 6; // Moderate natural 30° preview opening angle

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

                    // Vertical Interlocker Seal Strip on Meeting Stile
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

            // --- 4. Architectural 3D Grill Bars (8mm Profile & 4x4 Grid Lines) ---
            const activePattern = entity.grillePattern || 'grid';
            if (activePattern && activePattern !== 'none') {
                const grilleGroup = new THREE.Group();
                const grilleZ = entity.facing === 1 ? fThick / 2 - 1.0 : -fThick / 2 + 1.0; // 10 mm clearance gap from glass
                grilleGroup.position.set(0, 0, zOffset + grilleZ);

                const barWidth = 0.8, barDepth = 0.5; // 8 mm face width x 5 mm depth
                const isRound = entity.grilleProfile === 'round';

                const createThinBarGeo = (w, h, depth, isRotated = false) => {
                    if (isRound) {
                        const len = isRotated ? w : h;
                        const geo = new THREE.CylinderGeometry(barWidth / 2, barWidth / 2, len, 12);
                        if (isRotated) geo.rotateZ(Math.PI / 2);
                        return geo;
                    }
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
                    builder.addNode({ geometry: geo, materialOverride: matGrille, parent: barGroup, slot: MaterialSlots.GRILLE, position: [0, height / 2, 0], userData: { isGrille: true }, castShadow: true });
                    barGroup.position.set(x, 0, 0);
                    return barGroup;
                };

                const makeHBar = (y) => {
                    const barGroup = new THREE.Group();
                    const geo = createThinBarGeo(iW, barWidth, barDepth, true);
                    builder.addNode({ geometry: geo, materialOverride: matGrille, parent: barGroup, slot: MaterialSlots.GRILLE, position: [0, y, 0], userData: { isGrille: true }, castShadow: true });
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
                        builder.addNode({ geometry: createThinBarGeo(barWidth, maxDim, barDepth, false), materialOverride: matGrille, parent: dGroup, slot: MaterialSlots.GRILLE, position: [i, 0, 0], userData: { isGrille: true } });
                        builder.addNode({ geometry: createThinBarGeo(maxDim, barWidth, barDepth, true), materialOverride: matGrille, parent: dGroup, slot: MaterialSlots.GRILLE, position: [0, i, 0], userData: { isGrille: true } });
                    }
                    dGroup.rotation.z = Math.PI / 4;
                    dGroup.position.set(0, height / 2, 0);
                    grilleGroup.add(dGroup);
                }
                winGroup.add(grilleGroup);
            }

            // Hitbox for selection & gizmo interactions
            const hitboxGeo = new THREE.BoxGeometry(entity.width + 10, height + 10, (entity.thick || 20) + 10);
            builder.addNode({ geometry: hitboxGeo, isHitbox: true, parent: winGroup, position: [0, height / 2, 0] });
            winGroup.userData = { isWidget: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
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
            const builder = new BIMComponentBuilder(entity, helpers);
            const sunshadeGroup = builder.group;
            let baseElev = entity.elevation || 90;
            if (entity.localX !== undefined) {
                sunshadeGroup.position.set(entity.localX, baseElev, 0);
                sunshadeGroup.rotation.y = 0;
            } else {
                sunshadeGroup.position.set(entity.x, baseElev, entity.z);
                sunshadeGroup.rotation.y = -entity.angle;
            }

            const thick = entity.thick || 20;
            const wallOffset = thick / 2; 
            // Default to pointing OUTSIDE (negative Z) for clockwise rooms
            const signZ = (entity.facing === -1) ? -1 : 1;
            
            const contentGroup = new THREE.Group();
            contentGroup.position.z = wallOffset * signZ;
            sunshadeGroup.add(contentGroup);

            let chajjaStyle = entity.chajjaType || 'concrete_slab';
            const frameMatKey = entity.materials?.[MaterialSlots.FRAME]?.id;
            if (!frameMatKey) console.warn(`Missing required parameter for slot FRAME on sunshade entity ${entity.id}`);
            const matConcrete = helpers.getDynamicMaterial(frameMatKey, 'widget');
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
                builder.addNode({ geometry: cGeo, materialOverride: mmBox, parent: contentGroup, position: new THREE.Vector3(0, cH/2, (cDepth/2) * signZ), castShadow: true });
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
                
                builder.addNode({ geometry: joistGeo, materialOverride: matLouver, parent: contentGroup, position: new THREE.Vector3(-cWidth/2 + joistWidth/2, joistHeight/2, (cDepth/2) * signZ), castShadow: true });
                builder.addNode({ geometry: joistGeo, materialOverride: matLouver, parent: contentGroup, position: new THREE.Vector3(cWidth/2 - joistWidth/2, joistHeight/2, (cDepth/2) * signZ), castShadow: true });
                
                const fasciaGeo = new THREE.BoxGeometry(cWidth, joistHeight, joistWidth);
                builder.addNode({ geometry: fasciaGeo, materialOverride: matLouver, parent: contentGroup, position: new THREE.Vector3(0, joistHeight/2, (cDepth - joistWidth/2) * signZ), castShadow: true });
                
                const numJoists = Math.max(3, Math.floor(cWidth / 40));
                if (numJoists > 2) {
                    const joistSpacing = (cWidth - joistWidth) / (numJoists - 1);
                    for (let i = 1; i < numJoists - 1; i++) {
                        builder.addNode({ geometry: joistGeo, materialOverride: matLouver, parent: contentGroup, position: new THREE.Vector3(-cWidth/2 + joistWidth/2 + i * joistSpacing, joistHeight/2, (cDepth/2) * signZ), castShadow: true });
                    }
                }
                
                const louverThick = isWood ? 2 : 1; 
                const louverHeight = isWood ? 4 : 4;
                const spacing = isWood ? 8 : 8; 
                const numLouvers = Math.floor(cDepth / spacing);
                
                const lGeo = new THREE.BoxGeometry(cWidth, louverHeight, louverThick);
                
                for(let i=1; i<=numLouvers; i++) {
                    builder.addNode({ geometry: lGeo, materialOverride: matLouver, parent: contentGroup, position: new THREE.Vector3(0, joistHeight + louverHeight/2 - (isWood ? 2 : 0), (i * spacing - louverThick/2) * signZ), rotation: new THREE.Euler(isWood ? 0 : (Math.PI / 4) * signZ, 0, 0), castShadow: true });
                }
            } else if (chajjaStyle === 'glass_canopy' || chajjaStyle === 'polycarbonate_canopy') {
                const isPoly = chajjaStyle === 'polycarbonate_canopy';
                const cWidth = entity.width; const glassThick = 0.5;
                const matGlassConf = GLASS_REGISTRY?.['clear'] || { color: 0xffffff, transmission: 0.95, roughness: 0.05, ior: 1.5 };
                
                let matCanopyPanel;
                if (isPoly) {
                    matCanopyPanel = new THREE.MeshPhysicalMaterial({
                        color: 0xffffff, transmission: 0.4, roughness: 0.6, transparent: true, ior: 1.2, thickness: 0.5
                    });
                } else {
                    matCanopyPanel = (helpers && typeof helpers.getDynamicMaterial === 'function') 
                        ? helpers.getDynamicMaterial('clear', 'glass') 
                        : new THREE.MeshPhysicalMaterial({
                            color: matGlassConf.color, transmission: matGlassConf.transmission, roughness: matGlassConf.roughness, transparent: true, ior: matGlassConf.ior, thickness: 0.5
                        });
                }
                const matMetal = new THREE.MeshStandardMaterial({color: 0xe0e0e0, metalness: 0.9, roughness: 0.2});
                
                const frameThick = 1.5;
                const fSideGeo = new THREE.BoxGeometry(frameThick, frameThick, cDepth);
                const fFrontGeo = new THREE.BoxGeometry(cWidth, frameThick, frameThick);
                builder.addNode({ geometry: fSideGeo, materialOverride: matMetal, parent: contentGroup, position: new THREE.Vector3(-cWidth/2 + frameThick/2, frameThick/2, (cDepth/2)*signZ), castShadow: true });
                builder.addNode({ geometry: fSideGeo, materialOverride: matMetal, parent: contentGroup, position: new THREE.Vector3(cWidth/2 - frameThick/2, frameThick/2, (cDepth/2)*signZ), castShadow: true });
                builder.addNode({ geometry: fFrontGeo, materialOverride: matMetal, parent: contentGroup, position: new THREE.Vector3(0, frameThick/2, (cDepth - frameThick/2)*signZ), castShadow: true });
                
                const numPanes = Math.max(1, Math.floor(cWidth / 40));
                const paneWidth = (cWidth - frameThick * 2) / numPanes;
                for (let i = 1; i < numPanes; i++) {
                    builder.addNode({ geometry: fSideGeo, materialOverride: matMetal, parent: contentGroup, position: new THREE.Vector3(-cWidth/2 + frameThick + i * paneWidth, frameThick/2, (cDepth/2)*signZ), castShadow: true });
                }

                const gGeo = new THREE.BoxGeometry(cWidth - frameThick*2, glassThick, cDepth - frameThick);
                builder.addNode({ geometry: gGeo, materialOverride: matCanopyPanel, parent: contentGroup, position: new THREE.Vector3(0, frameThick/2, (cDepth/2)*signZ) });
                
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
                    builder.addNode({ geometry: tieGeo, materialOverride: matMetal, parent: tieGroup, position: new THREE.Vector3(0, spiderY + dy/2, ((bracketZ + tieZ)/2) * signZ), rotation: new THREE.Euler(-angle * signZ, 0, 0), castShadow: true });
                    builder.addNode({ geometry: bracketGeo, materialOverride: matMetal, parent: tieGroup, position: new THREE.Vector3(0, tieHeight, bracketZ * signZ), castShadow: true });
                    const spiderGeo = new THREE.CylinderGeometry(0.8, 0.8, 1, 8);
                    builder.addNode({ geometry: spiderGeo, materialOverride: matMetal, parent: tieGroup, position: new THREE.Vector3(0, spiderY, tieZ * signZ), castShadow: true });
                    
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
                builder.addNode({ geometry: roofGeo, materialOverride: matMetalRoof, parent: contentGroup, position: new THREE.Vector3(0, lipDrop - roofThick/2, (cDepth/2)*signZ), castShadow: true });
                
                const fLipGeo = new THREE.BoxGeometry(cWidth, lipDrop, lipThick);
                builder.addNode({ geometry: fLipGeo, materialOverride: matMetalDark, parent: contentGroup, position: new THREE.Vector3(0, lipDrop/2, (cDepth - lipThick/2)*signZ), castShadow: true });
                
                const sLipGeo = new THREE.BoxGeometry(lipThick, lipDrop, cDepth - lipThick);
                builder.addNode({ geometry: sLipGeo, materialOverride: matMetalDark, parent: contentGroup, position: new THREE.Vector3(-cWidth/2 + lipThick/2, lipDrop/2, ((cDepth - lipThick)/2)*signZ), castShadow: true });
                builder.addNode({ geometry: sLipGeo, materialOverride: matMetalDark, parent: contentGroup, position: new THREE.Vector3(cWidth/2 - lipThick/2, lipDrop/2, ((cDepth - lipThick)/2)*signZ), castShadow: true });
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
                builder.addNode({ geometry: cGeo, materialOverride: mmExtrude, parent: contentGroup, position: new THREE.Vector3(0, 0, 0), rotation: new THREE.Euler(-Math.PI / 2, signZ === 1 ? Math.PI : 0, 0), castShadow: true });
            } else if (chajjaStyle === 'cantilever_rcc') {
                const cH = 2; 
                const cGeo = new THREE.BoxGeometry(entity.width, cH, cDepth);
                builder.addNode({ geometry: cGeo, materialOverride: mmBox, parent: contentGroup, position: new THREE.Vector3(0, cH/2, (cDepth/2) * signZ), castShadow: true });
            } else if (chajjaStyle === 'jali_canopy') {
                const cWidth = entity.width;
                const roofThick = 2;
                const dropH = 15;
                const matSolid = new THREE.MeshStandardMaterial({color: 0xf5f5f5, roughness: 0.9});
                
                const roofGeo = new THREE.BoxGeometry(cWidth, roofThick, cDepth);
                builder.addNode({ geometry: roofGeo, materialOverride: matSolid, parent: contentGroup, position: new THREE.Vector3(0, dropH - roofThick/2, (cDepth/2)*signZ), castShadow: true });
                
                const buildGrid = (w, h, mat) => {
                    const group = new THREE.Group();
                    const thick = 1;
                    const step = 5;
                    const hGeo = new THREE.BoxGeometry(w, thick, thick);
                    const vGeo = new THREE.BoxGeometry(thick, h, thick);
                    for (let y = -h/2 + step/2; y < h/2; y += step) {
                        builder.addNode({ geometry: hGeo, materialOverride: mat, parent: group, position: new THREE.Vector3(0, y, 0), castShadow: true });
                    }
                    for (let x = -w/2 + step/2; x < w/2; x += step) {
                        builder.addNode({ geometry: vGeo, materialOverride: mat, parent: group, position: new THREE.Vector3(x, 0, 0), castShadow: true });
                    }
                    builder.addNode({ geometry: new THREE.BoxGeometry(w, 2, 2), materialOverride: mat, parent: group, position: new THREE.Vector3(0, h/2, 0), castShadow: true });
                    builder.addNode({ geometry: new THREE.BoxGeometry(w, 2, 2), materialOverride: mat, parent: group, position: new THREE.Vector3(0, -h/2, 0), castShadow: true });
                    builder.addNode({ geometry: new THREE.BoxGeometry(2, h, 2), materialOverride: mat, parent: group, position: new THREE.Vector3(-w/2, 0, 0), castShadow: true });
                    builder.addNode({ geometry: new THREE.BoxGeometry(2, h, 2), materialOverride: mat, parent: group, position: new THREE.Vector3(w/2, 0, 0), castShadow: true });
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
                builder.addNode({ geometry: topGeo, materialOverride: mmBox, parent: contentGroup, position: new THREE.Vector3(0, frameThick/2, (cDepth/2)*signZ), castShadow: true });
                
                const sideGeo = new THREE.BoxGeometry(frameThick, frameDrop, cDepth);
                builder.addNode({ geometry: sideGeo, materialOverride: mmBox, parent: contentGroup, position: new THREE.Vector3(-cWidth/2 + frameThick/2, -frameDrop/2 + frameThick, (cDepth/2)*signZ), castShadow: true });
                builder.addNode({ geometry: sideGeo, materialOverride: mmBox, parent: contentGroup, position: new THREE.Vector3(cWidth/2 - frameThick/2, -frameDrop/2 + frameThick, (cDepth/2)*signZ), castShadow: true });
                
                const botGeo = new THREE.BoxGeometry(cWidth, frameThick, cDepth);
                builder.addNode({ geometry: botGeo, materialOverride: mmBox, parent: contentGroup, position: new THREE.Vector3(0, -frameDrop + frameThick/2, (cDepth/2)*signZ), castShadow: true });
            }

            const hbHeight = chajjaStyle === 'box_frame' ? (entity.frameHeight || 150) : 10;
            const hbY = chajjaStyle === 'box_frame' ? -hbHeight/2 + 6 : 5;
            const hitboxGeo = new THREE.BoxGeometry(entity.width, hbHeight, cDepth);
            builder.addNode({ geometry: hitboxGeo, parent: contentGroup, position: new THREE.Vector3(0, hbY, (cDepth/2)*signZ), isHitbox: true });
            sunshadeGroup.userData = { isWidget: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
        }
    },
    'elevation_fascia': {
        widget: "elevation_fascia", label: "ELEVATION FASCIA", cutsWall: false,
        events: ["drag_along_wall", "snap_to_corners", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 100, height: 120, depth: 40, thick: 10, elevation: 0, profileType: 'c_shape_left', fasciaMat: 'white' },
        render2D: (group, entity) => {
            const hw = entity.width / 2; const thick = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || 4) : (entity.thick || 4);
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
            const builder = new BIMComponentBuilder(entity, helpers);
            const fasciaGroup = builder.group;
            let baseElev = entity.elevation || 0; let height = entity.height || 120;
            let width = entity.width || 100; let depth = entity.depth || 40; let thick = entity.thick || 10;
            if (entity.localX !== undefined) {
                fasciaGroup.position.set(entity.localX, baseElev, 0);
                fasciaGroup.rotation.y = 0;
            } else {
                fasciaGroup.position.set(entity.x, baseElev, entity.z);
                fasciaGroup.rotation.y = -entity.angle;
            }
            
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
                const node = builder.addNode({ geometry: geo, materialOverride: materials, parent: fasciaGroup, position: new THREE.Vector3(x, y + h/2, z), castShadow: true, receiveShadow: true });
                return node;
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
                builder.addNode({ geometry: geo, materialOverride: materials, parent: fasciaGroup, position: new THREE.Vector3(x, y, z), castShadow: true, receiveShadow: true });
            };
            
            const wallThick = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || 16) : 16;
            const zOffset = (entity.facing === -1) ? (wallThick/2 + depth/2) : -(wallThick/2 + depth/2);

            let topArm = entity.topArm !== undefined ? entity.topArm : width;
            let bottomArm = entity.bottomArm !== undefined ? entity.bottomArm : width;

            const radii = entity.cornerRadii || [];
            const getR = (idx) => Math.max(0, radii[idx] || 0);

            if (entity.profileType === 'c_shape_left') {
                createBlock(topArm, thick, depth, -width/2 + topArm/2, height - thick, zOffset, { bottom: false }, [0, getR(5), getR(6), getR(7)]); 
                createBlock(thick, height - 2*thick, depth, -width/2 + thick/2, thick, zOffset, { top: false, bottom: false, right: false }); 
                createBlock(bottomArm, thick, depth, -width/2 + bottomArm/2, 0, zOffset, { top: false }, [getR(0), getR(1), getR(2), 0]); 
                createInnerFillet(getR(3), depth, -width/2 + thick, thick, zOffset, 1);
                createInnerFillet(getR(4), depth, -width/2 + thick, height - thick, zOffset, 4);
                entity.computedPts = [ new THREE.Vector2(-width/2, 0), new THREE.Vector2(-width/2 + bottomArm, 0), new THREE.Vector2(-width/2 + bottomArm, thick), new THREE.Vector2(-width/2 + thick, thick), new THREE.Vector2(-width/2 + thick, height - thick), new THREE.Vector2(-width/2 + topArm, height - thick), new THREE.Vector2(-width/2 + topArm, height), new THREE.Vector2(-width/2, height) ];
            } else if (entity.profileType === 'c_shape_right') {
                createBlock(topArm, thick, depth, width/2 - topArm/2, height - thick, zOffset, { bottom: false }, [getR(4), 0, getR(2), getR(3)]); 
                createBlock(thick, height - 2*thick, depth, width/2 - thick/2, thick, zOffset, { top: false, bottom: false, left: false }); 
                createBlock(bottomArm, thick, depth, width/2 - bottomArm/2, 0, zOffset, { top: false }, [getR(0), getR(1), 0, getR(7)]); 
                createInnerFillet(getR(5), depth, width/2 - thick, height - thick, zOffset, 3);
                createInnerFillet(getR(6), depth, width/2 - thick, thick, zOffset, 2);
                entity.computedPts = [ new THREE.Vector2(width/2 - bottomArm, 0), new THREE.Vector2(width/2, 0), new THREE.Vector2(width/2, height), new THREE.Vector2(width/2 - topArm, height), new THREE.Vector2(width/2 - topArm, height - thick), new THREE.Vector2(width/2 - thick, height - thick), new THREE.Vector2(width/2 - thick, thick), new THREE.Vector2(width/2 - bottomArm, thick) ];
            } else if (entity.profileType === 'l_shape_left') {
                createBlock(topArm, thick, depth, -width/2 + topArm/2, height - thick, zOffset, { bottom: false }, [0, getR(3), getR(4), getR(5)]); 
                createBlock(thick, height - thick, depth, -width/2 + thick/2, 0, zOffset, { top: false, right: false }, [getR(0), getR(1), 0, 0]); 
                createInnerFillet(getR(2), depth, -width/2 + thick, height - thick, zOffset, 4);
                entity.computedPts = [ new THREE.Vector2(-width/2, 0), new THREE.Vector2(-width/2 + thick, 0), new THREE.Vector2(-width/2 + thick, height - thick), new THREE.Vector2(-width/2 + topArm, height - thick), new THREE.Vector2(-width/2 + topArm, height), new THREE.Vector2(-width/2, height) ];
            } else if (entity.profileType === 'l_shape_right') {
                createBlock(topArm, thick, depth, width/2 - topArm/2, height - thick, zOffset, { bottom: false }, [getR(4), 0, 0, getR(3)]); 
                createBlock(thick, height - thick, depth, width/2 - thick/2, 0, zOffset, { top: false, left: false }, [0, getR(1), getR(2), 0]); 
                createInnerFillet(getR(5), depth, width/2 - thick, height - thick, zOffset, 3);
                entity.computedPts = [ new THREE.Vector2(width/2 - thick, 0), new THREE.Vector2(width/2, 0), new THREE.Vector2(width/2, height), new THREE.Vector2(width/2 - topArm, height), new THREE.Vector2(width/2 - topArm, height - thick), new THREE.Vector2(width/2 - thick, height - thick) ];
            } else if (entity.profileType === 'full_box') {
                createBlock(width, thick, depth, 0, height - thick, zOffset, { bottom: false }, [0, 0, getR(2), getR(3)]); 
                createBlock(width, thick, depth, 0, 0, zOffset, { top: false }, [getR(0), getR(1), 0, 0]); 
                createBlock(thick, height - 2*thick, depth, -width/2 + thick/2, thick, zOffset, { top: false, bottom: false, right: false }); 
                createBlock(thick, height - 2*thick, depth, width/2 - thick/2, thick, zOffset, { top: false, bottom: false, left: false }); 
                createInnerFillet(getR(4), depth, -width/2 + thick, thick, zOffset, 1);
                createInnerFillet(getR(5), depth, -width/2 + thick, height - thick, zOffset, 4);
                createInnerFillet(getR(6), depth, width/2 - thick, height - thick, zOffset, 3);
                createInnerFillet(getR(7), depth, width/2 - thick, thick, zOffset, 2);
                entity.computedPts = [ new THREE.Vector2(-width/2, 0), new THREE.Vector2(width/2, 0), new THREE.Vector2(width/2, height), new THREE.Vector2(-width/2, height), new THREE.Vector2(-width/2 + thick, thick), new THREE.Vector2(-width/2 + thick, height - thick), new THREE.Vector2(width/2 - thick, height - thick), new THREE.Vector2(width/2 - thick, thick) ];
            }
            
            entity.computedZOffset = zOffset;

            const hitboxGeo = new THREE.BoxGeometry(width + 10, height + 10, depth + 20);
            builder.addNode({ geometry: hitboxGeo, parent: fasciaGroup, position: new THREE.Vector3(0, height/2, zOffset), isHitbox: true });
            
            fasciaGroup.userData = { isWidget: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
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
    'wall': ['material'],
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
// Thumbnail generation extensions
export const THUMBNAIL_EXTENSIONS = {};
['shape_rect', 'shape_circle', 'shape_triangle'].forEach(type => {
    if (!THUMBNAIL_EXTENSIONS[type]) THUMBNAIL_EXTENSIONS[type] = { type };
    THUMBNAIL_EXTENSIONS[type].render3D = (sceneGroup, entity, helpers) => {
        const size = 60, h = 60;
        let geo;
        if (type === 'shape_rect') geo = new THREE.BoxGeometry(size, h, size);
        else if (type === 'shape_circle') geo = new THREE.CylinderGeometry(size/2, size/2, h, 32);
        else geo = new THREE.CylinderGeometry(size/2, size/2, h, 3);
        const mat = new THREE.MeshStandardMaterial({ color: 0x88ccff });
        const mesh = new THREE.Mesh(geo, mat);
        sceneGroup.add(mesh);
        return mesh;
    };
});

['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].forEach(type => {
    if (!THUMBNAIL_EXTENSIONS[type]) THUMBNAIL_EXTENSIONS[type] = { type };
    THUMBNAIL_EXTENSIONS[type].render3D = (sceneGroup, entity, helpers) => {
        const w = 100, h = 100, d = 10;
        const shape = new THREE.Shape();
        shape.moveTo(-w/2, -h/2); shape.lineTo(w/2, -h/2); shape.lineTo(w/2, h/2); shape.lineTo(-w/2, h/2); shape.lineTo(-w/2, -h/2);
        const hole = new THREE.Path();
        if (type === 'arch_opening') {
            hole.moveTo(-20, -h/2); hole.lineTo(20, -h/2); hole.lineTo(20, 0);
            hole.absarc(0, 0, 20, 0, Math.PI, false); hole.lineTo(-20, -h/2);
        } else if (type === 'circular_opening') {
            hole.absarc(0, 0, 20, 0, Math.PI*2, false);
        } else {
            hole.moveTo(-20, -20); hole.lineTo(20, -20); hole.lineTo(20, 20); hole.lineTo(-20, 20); hole.lineTo(-20, -20);
        }
        shape.holes.push(hole);
        const extrudeSettings = { depth: d, bevelEnabled: false };
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.translate(0, 0, -d/2);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(geo, wallMat);
        sceneGroup.add(mesh);
        return mesh;
    };
});

['material_preview', 'material_preview_box'].forEach(type => {
    if (!THUMBNAIL_EXTENSIONS[type]) THUMBNAIL_EXTENSIONS[type] = { type };
    THUMBNAIL_EXTENSIONS[type].render3D = async (sceneGroup, entity, helpers) => {
        const isBox = type === 'material_preview_box' || (entity && entity.previewShape === 'box');
        const geo = isBox ? new THREE.PlaneGeometry(200, 200) : new THREE.SphereGeometry(45, 64, 64);
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
        
        let factory = window.MaterialFactory;
        if (!factory) {
            const imported = await import('./engine3d/MaterialFactory.js');
            factory = imported.MaterialFactory;
        }
        
        await factory.applyPBRMaterial(mesh, entity, helpers.ctx);
        sceneGroup.add(mesh);
        return mesh;
    };
});

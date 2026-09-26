import Konva from 'konva';
import * as THREE from 'three';
export * from './constants/units.js';
export * from './constants/events.js';
export * from '../features/door/door.registry.js';
export { createDoorShape, buildDetailedDoorPanel } from '../features/door/door.geometry.js';
export * from '../features/roof/roof.registry.js';
export { STAIRCASE_REGISTRY } from '../features/stairs/stairs.registry.js';
export { ROOF_COMPONENT_REGISTRY, ROOF_REGISTRY } from '../features/roof/roof.components.registry.js';

export * from '../features/furniture/furniture.registry.js';
export * from '../features/railing/registry/railing.registry.js';
export * from '../features/window/window.registry.js';
export { createWindowShape } from '../features/window/window.geometry.js';
export * from '../features/wall/wall.registry.js';
export * from '../features/molding/index.js';
export * from '../features/fascia/index.js';
export * from './registries/material.registry.js';

import { DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT } from './constants/units.js';
import { DoorRegistry } from '../features/door/door.registry.js';
import { WindowRegistry, WINDOW_TYPES } from '../features/window/window.registry.js';
import { FASCIA_REGISTRY } from '../features/fascia/fascia.registry.js';
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
    'tv_unit': "M 0 30 L 100 30 L 100 70 L 0 70 Z M 15 42 L 85 42 L 85 58 L 15 58 Z",

    // Soft Furnishings & Window Dressings
    'curtain_drapes': "M 0 40 C 15 20, 20 60, 35 40 C 50 20, 55 60, 70 40 C 85 20, 90 60, 100 40 L 100 60 C 90 80, 85 40, 70 60 C 55 80, 50 40, 35 60 C 20 80, 15 40, 0 60 Z M -5 30 L 105 30",
    'curtain_blind': "M 0 25 L 100 25 L 100 75 L 0 75 Z M 0 40 L 100 40 M 0 55 L 100 55 M 92 25 L 92 85",
    'curtain_pelmet': "M 0 15 L 100 15 L 100 85 L 0 85 Z M 5 25 L 95 25 M 5 75 L 95 75",

    // Rugs & Carpets
    'rug_rect': "M 5 5 L 95 5 L 95 95 L 5 95 Z M 12 12 L 88 12 L 88 88 L 12 88 Z M 0 10 L 5 10 M 0 30 L 5 30 M 0 50 L 5 50 M 0 70 L 5 70 M 0 90 L 5 90 M 95 10 L 100 10 M 95 30 L 100 30 M 95 50 L 100 50 M 95 70 L 100 70 M 95 90 L 100 90",
    'rug_circle': "M 50 0 A 50 50 0 1 0 50 100 A 50 50 0 1 0 50 0 Z M 50 12 A 38 38 0 1 0 50 88 A 38 38 0 1 0 50 12 Z M 50 28 A 22 22 0 1 0 50 72 A 22 22 0 1 0 50 28 Z",

    // Wall Decor, Greenery & Styling Props
    'decor_art': "M 0 35 L 100 35 L 100 65 L 0 65 Z M 8 42 L 92 42 L 92 58 L 8 58 Z",
    'decor_clock': "M 50 0 A 50 50 0 1 0 50 100 A 50 50 0 1 0 50 0 Z M 50 50 L 50 20 M 50 50 L 72 50",
    'decor_mirror': "M 20 0 L 80 0 A 20 20 0 0 1 100 20 L 100 80 A 20 20 0 0 1 80 100 L 20 100 A 20 20 0 0 1 0 80 L 0 20 A 20 20 0 0 1 20 0 Z M 25 10 L 75 10 A 15 15 0 0 1 90 25 L 90 75 A 15 15 0 0 1 75 90 L 25 90 A 15 15 0 0 1 10 75 L 10 25 A 15 15 0 0 1 25 10 Z",
    'decor_plant': "M 50 20 A 30 30 0 1 0 50 80 A 30 30 0 1 0 50 20 Z M 50 0 C 40 25, 40 40, 50 50 C 60 40, 60 25, 50 0 Z M 100 50 C 75 40, 60 40, 50 50 C 60 60, 75 60, 100 50 Z M 50 100 C 40 75, 40 60, 50 50 C 60 60, 60 75, 50 100 Z M 0 50 C 25 40, 40 40, 50 50 C 40 60, 25 60, 0 50 Z",
    'decor_books': "M 15 10 L 85 10 L 85 90 L 15 90 Z M 25 5 L 95 5 L 95 85 L 25 85 Z M 10 18 L 80 18 L 80 98 L 10 98 Z",
    'decor_vases': "M 35 20 A 20 20 0 1 0 35 60 A 20 20 0 1 0 35 20 Z M 70 45 A 25 25 0 1 0 70 95 A 25 25 0 1 0 70 45 Z",
    'decor_cushions': "M 10 10 Q 50 0 90 10 Q 100 50 90 90 Q 50 100 10 90 Q 0 50 10 10 Z M 50 42 L 50 58 M 42 50 L 58 50",
    'decor_tableware': "M 50 5 A 45 45 0 1 0 50 95 A 45 45 0 1 0 50 5 Z M 50 22 A 28 28 0 1 0 50 78 A 28 28 0 1 0 50 22 Z M 10 10 L 10 90 M 90 10 L 90 90"
};

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
            
            const mount = entity.jaliMount || entity.params?.jaliMount || 'flush';
            if (mount === 'recessed') jaliGroup.translateZ(-4);
            if (mount === 'protruding') jaliGroup.translateZ(4);
            
            const rawPattern = entity.jaliPattern || entity.pattern || entity.params?.jaliPattern || entity.params?.pattern || (entity.id?.includes('breeze') || entity.id?.includes('terracotta') ? 'terracotta_breeze' : (entity.id?.includes('star') ? 'islamic' : (entity.id?.includes('chettinad') ? 'chettinad' : (entity.id?.includes('lotus') ? 'lotus' : (entity.id?.includes('peacock') ? 'peacock' : (entity.id?.includes('gopuram') ? 'gopuram' : (entity.id?.includes('kolam') ? 'kolam' : (entity.id?.includes('honeycomb') ? 'ventilation' : 'geometric'))))))));
            let jaliPattern = rawPattern;
            if (jaliPattern === 'square_grid') jaliPattern = 'geometric';
            else if (jaliPattern === 'geometric_honeycomb' || jaliPattern === 'honeycomb') jaliPattern = 'ventilation';
            else if (jaliPattern === 'mughal_star' || jaliPattern === 'star') jaliPattern = 'islamic';
            else if (jaliPattern === 'floral_vine' || jaliPattern === 'floral') jaliPattern = 'lotus';
            else if (jaliPattern === 'terracotta' || jaliPattern === 'breeze_block' || jaliPattern === 'terracotta_star') jaliPattern = 'terracotta_breeze';

            MaterialManager.initEntityMaterials(entity);
            const leafSlot = entity.materials?.[MaterialSlots.LEAF];
            const frameSlot = entity.materials?.[MaterialSlots.FRAME];
            const customSlot = entity.materials?.[MaterialSlots.CUSTOM];
            let matKey = leafSlot?.id || frameSlot?.id || customSlot?.id || (typeof entity.materials === 'string' ? entity.materials : null) || entity.jaliMat || entity.params?.jaliMat || (jaliPattern === 'terracotta_breeze' ? 'terracotta' : 'wood_golden_teak');
            
            const matMain = (helpers && typeof helpers.getDynamicMaterial === 'function') 
                ? helpers.getDynamicMaterial(matKey, 'widget') 
                : new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.5 });
            
            const mm = (helpers && typeof helpers.getFaceMaterials === 'function')
                ? helpers.getFaceMaterials(entity, matMain, { width: entity.width, height: height })
                : { box: [matMain, matMain, matMain, matMain, matMain, matMain], extrude: [matMain, matMain] };
            
            const matsExtrude = Array.isArray(mm.box) ? [mm.box[4] || matMain, mm.box[1] || matMain] : [matMain, matMain];
            const matsBox = Array.isArray(mm.box) ? mm.box : matMain;

            const frameW = jaliPattern === 'terracotta_breeze' ? 0.6 : 2; 
            const fThick = entity.thick || 2;
            const createBeveledFramePiece = (w, h, x, y, z) => {
                const shape = new THREE.Shape();
                shape.moveTo(-w/2, -h/2); shape.lineTo(w/2, -h/2); shape.lineTo(w/2, h/2); shape.lineTo(-w/2, h/2); shape.lineTo(-w/2, -h/2);
                const extrudeSettings = { depth: fThick, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };
                const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geo.translate(0, 0, -fThick/2);
                const uvs = geo.attributes.uv, pos = geo.attributes.position;
                if (uvs && pos) {
                    for (let i = 0; i < uvs.count; i++) {
                        uvs.setXY(i, (pos.getX(i) + w/2) / w, (pos.getY(i) + h/2) / h);
                    }
                    uvs.needsUpdate = true;
                }
                builder.addNode({ geometry: geo, slot: MaterialSlots.FRAME, materialOverride: matsExtrude, parent: jaliGroup, position: new THREE.Vector3(x, y, z), castShadow: true, receiveShadow: true });
            };
            createBeveledFramePiece(frameW, height, -entity.width/2 + frameW/2, height/2, 0);
            createBeveledFramePiece(frameW, height, entity.width/2 - frameW/2, height/2, 0);
            createBeveledFramePiece(entity.width - frameW*2, frameW, 0, height - frameW/2, 0);
            createBeveledFramePiece(entity.width - frameW*2, frameW, 0, frameW/2, 0);
            const iW = entity.width - frameW*2; const iH = height - frameW*2; const lThick = fThick * 0.5;
            const latticeGroup = new THREE.Group(); latticeGroup.position.set(0, height/2, 0);
            
            if (['kolam', 'lotus', 'peacock', 'gopuram', 'ventilation', 'mango', 'chettinad', 'terracotta_breeze'].includes(jaliPattern)) {
                const targetStep = entity.jaliPatternSize || entity.params?.jaliPatternSize || 20;
                const cols = Math.max(1, Math.round(iW / targetStep));
                const rows = Math.max(1, Math.round(iH / targetStep));
                const stepX = iW / cols; const stepY = iH / rows;
                
                const shape = new THREE.Shape();
                shape.moveTo(-stepX/2, -stepY/2); shape.lineTo(stepX/2, -stepY/2); shape.lineTo(stepX/2, stepY/2); shape.lineTo(-stepX/2, stepY/2); shape.lineTo(-stepX/2, -stepY/2);
                
                const maxSize = Math.min(stepX, stepY);
                const hw = maxSize * 0.495; const hh = maxSize * 0.495;
                
                if (jaliPattern === 'terracotta_breeze') {
                    // 1. Ultra-slender Center circular opening
                    const centerHole = new THREE.Path();
                    centerHole.absellipse(0, 0, hw * 0.44, hh * 0.44, 0, Math.PI * 2, false);
                    shape.holes.push(centerHole);

                    // 2. 4 Ultra-slender Cardinal Petals radiating from the central ring
                    [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].forEach(a => {
                        const cos = Math.cos(a), sin = Math.sin(a);
                        const rot = (x, y) => ({ x: x * cos - y * sin, y: x * sin + y * cos });
                        const p = new THREE.Path();
                        const tip = rot(0, hh * 0.95);
                        const cr = rot(hw * 0.18, hh * 0.72);
                        const br = rot(hw * 0.22, hw * 0.51);
                        const bl = rot(-hw * 0.22, hw * 0.51);
                        const cl = rot(-hw * 0.18, hh * 0.72);
                        const midRing = rot(0, hw * 0.49);

                        p.moveTo(tip.x, tip.y);
                        p.quadraticCurveTo(cr.x, cr.y, br.x, br.y);
                        p.quadraticCurveTo(midRing.x, midRing.y, bl.x, bl.y);
                        p.quadraticCurveTo(cl.x, cl.y, tip.x, tip.y);
                        shape.holes.push(p);
                    });

                    // 3. 4 Ultra-slender Corner Arcs
                    [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].forEach(a => {
                        const cos = Math.cos(a), sin = Math.sin(a);
                        const rot = (x, y) => ({ x: x * cos - y * sin, y: x * sin + y * cos });
                        const p = new THREE.Path();
                        const p1 = rot(hw * 0.12, hh * 0.95);
                        const p2 = rot(hw * 0.95, hh * 0.95);
                        const p3 = rot(hw * 0.95, hh * 0.12);
                        const pCtrl = rot(hw * 0.42, hh * 0.42);

                        p.moveTo(p1.x, p1.y);
                        p.lineTo(p2.x, p2.y);
                        p.lineTo(p3.x, p3.y);
                        p.quadraticCurveTo(pCtrl.x, pCtrl.y, p1.x, p1.y);
                        shape.holes.push(p);
                    });
                } else if (jaliPattern === 'ventilation') {
                    const hole = new THREE.Path();
                    hole.absellipse(0, 0, hw*0.8, hh*0.8, 0, Math.PI * 2, false);
                    shape.holes.push(hole);
                } else if (jaliPattern === 'lotus') {
                    const h1 = new THREE.Path(); h1.moveTo(0, hh*0.8); h1.quadraticCurveTo(hw*0.4, 0, 0, -hh*0.8); h1.quadraticCurveTo(-hw*0.4, 0, 0, hh*0.8);
                    const h2 = new THREE.Path(); h2.moveTo(hw*0.1, -hh*0.6); h2.quadraticCurveTo(hw*0.8, -hh*0.2, hw*0.9, hh*0.4); h2.quadraticCurveTo(hw*0.5, hh*0.1, hw*0.1, -hh*0.6);
                    const h3 = new THREE.Path(); h3.moveTo(-hw*0.1, -hh*0.6); h3.quadraticCurveTo(-hw*0.8, -hh*0.2, -hw*0.9, hh*0.4); h3.quadraticCurveTo(-hw*0.5, hh*0.1, -hw*0.1, -hh*0.6);
                    shape.holes.push(h1, h2, h3);
                } else if (jaliPattern === 'peacock') {
                    const p = new THREE.Path();
                    p.moveTo(0, -hh); p.quadraticCurveTo(hw, -hh, hw, -hh*0.2);
                    p.quadraticCurveTo(hw*0.8, hh*0.6, 0, hh*0.8);
                    p.quadraticCurveTo(-hw*0.6, hh*0.6, -hw*0.6, 0); p.quadraticCurveTo(-hw, hh*0.2, -hw*0.8, 0);
                    p.quadraticCurveTo(-hw*0.2, -0.4, 0, -hh);
                    shape.holes.push(p);
                } else if (jaliPattern === 'gopuram') {
                    const t1 = new THREE.Path(); t1.moveTo(-hw*0.8, -hh*0.8); t1.lineTo(hw*0.8, -hh*0.8); t1.lineTo(hw*0.6, -hh*0.2); t1.lineTo(-hw*0.6, -hh*0.2); t1.lineTo(-hw*0.8, -hh*0.8);
                    const t2 = new THREE.Path(); t2.moveTo(-hw*0.5, -hh*0.1); t2.lineTo(hw*0.5, -hh*0.1); t2.lineTo(hw*0.3, hh*0.4); t2.lineTo(-hw*0.3, hh*0.4); t2.lineTo(-hw*0.5, -hh*0.1);
                    const t3 = new THREE.Path(); t3.moveTo(-hw*0.2, hh*0.5); t3.lineTo(hw*0.2, hh*0.5); t3.lineTo(0, hh*0.9); t3.lineTo(-hw*0.2, hh*0.5);
                    shape.holes.push(t1, t2, t3);
                } else if (jaliPattern === 'mango') {
                    const m = new THREE.Path();
                    m.moveTo(0, -hh*0.8);
                    m.bezierCurveTo(hw, -hh*0.8, hw, hh*0.6, 0, hh*0.8);
                    m.bezierCurveTo(-hw*0.8, hh*0.8, -hw, hh*0.2, -hw*0.4, hh*0.2);
                    m.bezierCurveTo(-hw*0.2, hh*0.2, -hw*0.2, hh*0.4, 0, hh*0.4);
                    m.bezierCurveTo(-hw*0.8, hh*0.4, -hw*0.8, -hh*0.6, 0, -hh*0.8);
                    shape.holes.push(m);
                } else if (jaliPattern === 'chettinad' || jaliPattern === 'kolam') {
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
                    bevelSegments: 3, 
                    curveSegments: 32,
                    steps: 1, 
                    bevelSize: lThick * 0.02, 
                    bevelThickness: lThick * 0.015 
                };
                const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                const uvs = geo.attributes.uv, pos = geo.attributes.position;
                if (uvs && pos) {
                    for (let i = 0; i < uvs.count; i++) {
                        uvs.setXY(i, (pos.getX(i) + stepX/2) / stepX, (pos.getY(i) + stepY/2) / stepY);
                    }
                    uvs.needsUpdate = true;
                }
                const latticeMat = matsExtrude[0] || matMain;
                const iMesh = new THREE.InstancedMesh(geo, latticeMat, cols * rows);
                iMesh.castShadow = true; iMesh.receiveShadow = true;
                iMesh.userData = { entity: entity, materialSlot: MaterialSlots.LEAF, componentId: `${entity.id}_${MaterialSlots.LEAF}` };
                ComponentRegistry.registerMesh(entity, MaterialSlots.LEAF, iMesh);
                
                const dummy = new THREE.Object3D();
                let idx = 0;
                for (let c = 0; c < cols; c++) {
                    for (let rIdx = 0; rIdx < rows; rIdx++) {
                        dummy.position.set(-iW/2 + (c + 0.5) * stepX, -iH/2 + (rIdx + 0.5) * stepY, -lThick/2);
                        dummy.updateMatrix();
                        iMesh.setMatrixAt(idx++, dummy.matrix);
                    }
                }
                iMesh.instanceMatrix.needsUpdate = true;
                latticeGroup.add(iMesh);
            } else if (jaliPattern === 'modern' || jaliPattern === 'horizontal_slats') {
                const isHorizontal = entity.orientation === 'horizontal' || entity.params?.orientation === 'horizontal' || entity.horizontal || jaliPattern === 'horizontal_slats';
                const targetStep = entity.jaliPatternSize || entity.params?.jaliPatternSize || 4;
                if (isHorizontal) {
                    const rows = Math.max(1, Math.round(iH / targetStep));
                    const stepY = iH / rows;
                    for (let r = 1; r < rows; r++) {
                        builder.addNode({ geometry: new THREE.BoxGeometry(iW, 1.5, lThick), slot: MaterialSlots.LEAF, materialOverride: matsBox, parent: latticeGroup, position: new THREE.Vector3(0, -iH/2 + r * stepY, 0), castShadow: true });
                    }
                } else {
                    const cols = Math.max(1, Math.round(iW / targetStep));
                    const stepX = iW / cols;
                    for (let c = 1; c < cols; c++) {
                        builder.addNode({ geometry: new THREE.BoxGeometry(1.5, iH, lThick), slot: MaterialSlots.LEAF, materialOverride: matsBox, parent: latticeGroup, position: new THREE.Vector3(-iW/2 + c * stepX, 0, 0), castShadow: true });
                    }
                }
            } else {
                const defaultStep = jaliPattern === 'geometric' ? 6 : 8;
                const targetStep = entity.jaliPatternSize || entity.params?.jaliPatternSize || defaultStep;
                const cols = Math.max(1, Math.round(iW / targetStep));
                const rows = Math.max(1, Math.round(iH / targetStep));
                const stepX = iW / cols;
                const stepY = iH / rows;
                
                for (let c = 0; c < cols; c++) {
                    builder.addNode({ geometry: new THREE.BoxGeometry(1, iH, lThick), slot: MaterialSlots.LEAF, materialOverride: matsBox, parent: latticeGroup, position: new THREE.Vector3(-iW/2 + (c + 0.5) * stepX, 0, 0), castShadow: true });
                }
                for (let r = 0; r < rows; r++) {
                    builder.addNode({ geometry: new THREE.BoxGeometry(iW, 1, lThick), slot: MaterialSlots.LEAF, materialOverride: matsBox, parent: latticeGroup, position: new THREE.Vector3(0, -iH/2 + (r + 0.5) * stepY, 0), castShadow: true });
                }
                
                if (jaliPattern === 'islamic') {
                    const diagLen = Math.hypot(stepX, stepY);
                    const angle = Math.atan2(stepY, stepX);
                    for (let c = 0; c < cols; c++) {
                        for (let r = 0; r < rows; r++) {
                            const cx = -iW/2 + (c + 0.5) * stepX;
                            const cy = -iH/2 + (r + 0.5) * stepY;
                            builder.addNode({ geometry: new THREE.BoxGeometry(diagLen, 0.5, lThick), slot: MaterialSlots.LEAF, materialOverride: matsBox, parent: latticeGroup, position: new THREE.Vector3(cx, cy, 0), rotation: new THREE.Euler(0, 0, angle), castShadow: true });
                            builder.addNode({ geometry: new THREE.BoxGeometry(diagLen, 0.5, lThick), slot: MaterialSlots.LEAF, materialOverride: matsBox, parent: latticeGroup, position: new THREE.Vector3(cx, cy, 0), rotation: new THREE.Euler(0, 0, -angle), castShadow: true });
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
    'door': DoorRegistry,
    'window': WindowRegistry,
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
            let baseElev = entity.elevation !== undefined ? entity.elevation : 90;
            if (entity.localX !== undefined) {
                sunshadeGroup.position.set(entity.localX, baseElev, 0);
                sunshadeGroup.rotation.y = 0;
            } else {
                sunshadeGroup.position.set(entity.x, baseElev, entity.z);
                sunshadeGroup.rotation.y = -entity.angle;
            }

            const wallThick = (entity.wall && (entity.wall.thickness || entity.wall.config?.thickness)) ? (entity.wall.thickness || entity.wall.config?.thickness) : (entity.wallThick || 20);
            const wallOffset = wallThick / 2; 
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
                const joistWidth = isWood ? 1.5 : 1.2;
                const joistHeight = isWood ? 4 : 3.5;
                const joistGeo = new THREE.BoxGeometry(joistWidth, joistHeight, cDepth);
                
                builder.addNode({ geometry: joistGeo, materialOverride: matLouver, parent: contentGroup, position: new THREE.Vector3(-cWidth/2 + joistWidth/2, joistHeight/2, (cDepth/2) * signZ), castShadow: true });
                builder.addNode({ geometry: joistGeo, materialOverride: matLouver, parent: contentGroup, position: new THREE.Vector3(cWidth/2 - joistWidth/2, joistHeight/2, (cDepth/2) * signZ), castShadow: true });
                
                const fasciaGeo = new THREE.BoxGeometry(cWidth, joistHeight, joistWidth);
                builder.addNode({ geometry: fasciaGeo, materialOverride: matLouver, parent: contentGroup, position: new THREE.Vector3(0, joistHeight/2, (cDepth - joistWidth/2) * signZ), castShadow: true });
                
                const numJoists = Math.max(3, Math.floor(cWidth / 30));
                if (numJoists > 2) {
                    const joistSpacing = (cWidth - joistWidth) / (numJoists - 1);
                    for (let i = 1; i < numJoists - 1; i++) {
                        builder.addNode({ geometry: joistGeo, materialOverride: matLouver, parent: contentGroup, position: new THREE.Vector3(-cWidth/2 + joistWidth/2 + i * joistSpacing, joistHeight/2, (cDepth/2) * signZ), castShadow: true });
                    }
                }
                
                const louverThick = isWood ? 1.5 : 1; 
                const louverHeight = isWood ? 2 : 1.8;
                const spacing = isWood ? 6 : 5; 
                const numLouvers = Math.floor(cDepth / spacing);
                
                const lGeo = new THREE.BoxGeometry(cWidth, louverHeight, louverThick);
                
                for(let i=1; i<=numLouvers; i++) {
                    builder.addNode({ geometry: lGeo, materialOverride: matLouver, parent: contentGroup, position: new THREE.Vector3(0, joistHeight + louverHeight/2 - (isWood ? 1 : 0), (i * spacing - louverThick/2) * signZ), rotation: new THREE.Euler(isWood ? 0 : (Math.PI / 4) * signZ, 0, 0), castShadow: true });
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
            } else if (chajjaStyle === 'cantilever_soffit') {
                const cWidth = entity.width;
                const soffitThick = entity.soffitHeight || entity.thick || entity.thickness || 10;
                const slabGeo = new THREE.BoxGeometry(cWidth, soffitThick, cDepth);
                builder.addNode({
                    geometry: slabGeo,
                    materialOverride: mmBox,
                    parent: contentGroup,
                    position: new THREE.Vector3(0, -soffitThick / 2, (cDepth / 2) * signZ),
                    castShadow: true
                });

                // Under-soffit architectural recessed downlights (pot lights)
                const numLights = entity.numLights || (cWidth > 150 ? 3 : 2);
                const lightSpacing = cWidth / (numLights + 1);
                const potRadius = 3.5;
                const potDepth = 0.6;
                const bezelGeo = new THREE.CylinderGeometry(potRadius + 0.8, potRadius + 0.8, potDepth, 16);
                const lensGeo = new THREE.CylinderGeometry(potRadius, potRadius, potDepth + 0.1, 16);
                const matBezel = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8, roughness: 0.25 });
                const matLens = new THREE.MeshStandardMaterial({
                    color: 0xfffaed,
                    emissive: 0xffdf80,
                    emissiveIntensity: 1.8,
                    roughness: 0.1
                });

                for (let i = 1; i <= numLights; i++) {
                    const posX = -cWidth / 2 + i * lightSpacing;
                    const posZ = (cDepth / 2) * signZ;
                    const posY = -soffitThick;

                    builder.addNode({
                        geometry: bezelGeo,
                        materialOverride: matBezel,
                        parent: contentGroup,
                        position: new THREE.Vector3(posX, posY, posZ),
                        slot: MaterialSlots.HARDWARE
                    });
                    builder.addNode({
                        geometry: lensGeo,
                        materialOverride: matLens,
                        parent: contentGroup,
                        position: new THREE.Vector3(posX, posY - 0.05, posZ),
                        slot: MaterialSlots.CUSTOM
                    });
                }
            }

            const hbHeight = chajjaStyle === 'box_frame' ? (entity.frameHeight || 150) : (chajjaStyle === 'cantilever_soffit' ? (entity.soffitHeight || entity.thick || entity.thickness || 10) : 10);
            const hbY = chajjaStyle === 'box_frame' ? -hbHeight/2 + 6 : (chajjaStyle === 'cantilever_soffit' ? -hbHeight/2 : 5);
            const hitboxGeo = new THREE.BoxGeometry(entity.width, hbHeight, cDepth);
            builder.addNode({ geometry: hitboxGeo, parent: contentGroup, position: new THREE.Vector3(0, hbY, (cDepth/2)*signZ), isHitbox: true });
            sunshadeGroup.userData = { isWidget: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
        }
    },
    get 'elevation_fascia'() {
        return FASCIA_REGISTRY ? FASCIA_REGISTRY['elevation_fascia'] : undefined;
    },
    'curtain': {
        widget: "curtain", label: "CURTAINS & BLINDS", cutsWall: false,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 80, height: 95, elevation: 5, thick: 4, facing: 1, curtainType: 'curtain_drapes_sheer' },
        render2D: (group, entity) => {
            const hw = (entity.width || 80) / 2;
            const w = entity.width || 80;
            const thick = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || 20) : (entity.thick || 20);
            const signY = (entity.facing === -1) ? -1 : 1;
            const yPos = signY * (thick / 2 + 4);

            const rod = new Konva.Line({
                points: [-hw - 5, yPos, hw + 5, yPos],
                stroke: '#0284c7', strokeWidth: 3, lineCap: 'round'
            });
            const finialL = new Konva.Circle({ x: -hw - 5, y: yPos, radius: 3, fill: '#0284c7' });
            const finialR = new Konva.Circle({ x: hw + 5, y: yPos, radius: 3, fill: '#0284c7' });
            
            const wavePoints = [];
            const waves = 8;
            for (let i = 0; i <= waves; i++) {
                const wx = -hw + (i / waves) * w;
                const wy = yPos + (i % 2 === 0 ? signY * 4 : 0);
                wavePoints.push(wx, wy);
            }
            const pleats = new Konva.Line({
                points: wavePoints,
                stroke: '#38bdf8', strokeWidth: 2, tension: 0.4
            });
            group.add(rod, finialL, finialR, pleats);
        },
        render3D: (sceneGroup, entity, helpers) => {
            const builder = new BIMComponentBuilder(entity, helpers);
            const curtainGroup = builder.group;
            let baseElev = entity.elevation !== undefined ? entity.elevation : 5;
            if (entity.localX !== undefined) {
                curtainGroup.position.set(entity.localX, baseElev, 0);
                curtainGroup.rotation.y = 0;
            } else {
                curtainGroup.position.set(entity.x || 0, baseElev, entity.z || 0);
                curtainGroup.rotation.y = -(entity.angle || 0);
            }

            const thick = entity.wall?.thickness || entity.wall?.config?.thickness || entity.thick || 20;
            const wallOffset = thick / 2;
            const signZ = (entity.facing === -1) ? -1 : 1;

            const cType = entity.curtainType || entity.type || 'curtain_drapes_sheer';
            const cW = entity.width || 80;
            const cH = entity.height || 95;
            const cD = entity.depth || 10;

            const isBlind = cType === 'curtain_roller_blind' || cType === 'curtain_roman_shade';
            const standOff = isBlind ? 2.2 : 5.0;

            const contentGroup = new THREE.Group();
            contentGroup.position.z = (wallOffset + standOff) * signZ;
            if (signZ === -1) {
                contentGroup.rotation.y = Math.PI;
            }
            curtainGroup.add(contentGroup);

            const registerSlotMesh = (mesh, slotName) => {
                mesh.userData.entity = entity;
                mesh.userData.materialSlot = slotName;
                mesh.userData.componentId = `${entity.id || 'curtain'}_${slotName}`;
                ComponentRegistry.registerMesh(entity, slotName, mesh, { componentId: mesh.userData.componentId, componentType: cType });
                contentGroup.add(mesh);
                return mesh;
            };

            const getDynamicMat = (slotName, defaultKey, defaultProps = {}) => {
                const slotId = entity.materials?.[slotName]?.id || defaultKey;
                if (helpers?.getDynamicMaterial) {
                    return helpers.getDynamicMaterial(slotId, slotName);
                }
                return new THREE.MeshStandardMaterial({ ...defaultProps });
            };

            const buildContinuousFabricDrapeGeo = (w, h, waveCount = 8, waveAmp = 2.8) => {
                const segX = Math.max(60, Math.floor(w * 1.5));
                const segY = Math.max(30, Math.floor(h * 0.5));
                const geo = new THREE.PlaneGeometry(w, h, segX, segY);
                geo.translate(0, h / 2, 0);

                const pos = geo.attributes.position;
                const uv = geo.attributes.uv;

                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i);
                    const y = pos.getY(i);
                    const u = (x + w / 2) / w;
                    const v = y / h;

                    const primaryWave = Math.sin(u * Math.PI * 2 * waveCount) * waveAmp;
                    const organicSag = Math.sin(u * Math.PI * 6 + v * 2.5) * (waveAmp * 0.2) * (1 - v * 0.5);
                    const foldDepth = (primaryWave + organicSag) * (0.85 + 0.15 * (1 - v));

                    pos.setZ(i, foldDepth);
                    uv.setXY(i, (x + w / 2) / 50, y / 50);
                }

                pos.needsUpdate = true;
                uv.needsUpdate = true;
                geo.computeVertexNormals();
                return geo;
            };

            if (cType === 'curtain_drapes_sheer') {
                const mFabric = getDynamicMat('fabric', 'crepe_satin_real', { color: '#f8fafc', roughness: 0.6, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
                mFabric.side = THREE.DoubleSide;
                const mRod = getDynamicMat('rod', 'metal_brass', { color: '#d97706', metalness: 0.9, roughness: 0.2 });
                const mRings = getDynamicMat('rings', 'metal_brass', { color: '#d97706', metalness: 0.9, roughness: 0.2 });

                const rodGeo = new THREE.CylinderGeometry(1.0, 1.0, cW + 10, 24);
                rodGeo.rotateZ(Math.PI / 2);
                const rod = new THREE.Mesh(rodGeo, mRod);
                rod.position.set(0, cH - 1.5, 0);
                registerSlotMesh(rod, 'rod');

                const finialL = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 24), mRod);
                finialL.position.set(-cW / 2 - 5, cH - 1.5, 0);
                const finialR = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 24), mRod);
                finialR.position.set(cW / 2 + 5, cH - 1.5, 0);
                registerSlotMesh(finialL, 'rod');
                registerSlotMesh(finialR, 'rod');

                [-cW / 2 + 8, 0, cW / 2 - 8].forEach(bx => {
                    const brk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, standOff), mRod);
                    brk.position.set(bx, cH - 1.5, -standOff / 2);
                    registerSlotMesh(brk, 'rod');
                });

                const ringSpacing = 10;
                const numRings = Math.floor(cW / ringSpacing);
                for (let i = 0; i <= numRings; i++) {
                    const rx = -cW / 2 + i * ringSpacing;
                    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.25, 12, 24), mRings);
                    ring.position.set(rx, cH - 1.5, 0);
                    registerSlotMesh(ring, 'rings');
                }

                // Full continuous sheer drape across entire curtain width
                const drapeGeo = buildContinuousFabricDrapeGeo(cW, cH - 4.5, 7.5, 2.5);
                const drape = new THREE.Mesh(drapeGeo, mFabric);
                drape.position.set(0, 0, 0);
                registerSlotMesh(drape, 'fabric');

            } else if (cType === 'curtain_drapes_blackout') {
                const mFabric = getDynamicMat('fabric', 'caban_neutral', { color: '#334155', roughness: 0.9, side: THREE.DoubleSide });
                mFabric.side = THREE.DoubleSide;
                const mRod = getDynamicMat('rod', 'metal_matte_black', { color: '#0f172a', roughness: 0.6 });

                const rodGeo = new THREE.CylinderGeometry(1.2, 1.2, cW + 12, 24);
                rodGeo.rotateZ(Math.PI / 2);
                const rod = new THREE.Mesh(rodGeo, mRod);
                rod.position.set(0, cH - 1.5, 0);
                registerSlotMesh(rod, 'rod');

                const finialL = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 3, 16), mRod);
                finialL.rotateZ(Math.PI / 2);
                finialL.position.set(-cW / 2 - 6, cH - 1.5, 0);
                const finialR = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 3, 16), mRod);
                finialR.rotateZ(Math.PI / 2);
                finialR.position.set(cW / 2 + 6, cH - 1.5, 0);
                registerSlotMesh(finialL, 'rod');
                registerSlotMesh(finialR, 'rod');

                [-cW / 2 + 8, 0, cW / 2 - 8].forEach(bx => {
                    const brk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, standOff), mRod);
                    brk.position.set(bx, cH - 1.5, -standOff / 2);
                    registerSlotMesh(brk, 'rod');
                });

                // Full continuous blackout pinch-pleat drape across entire curtain width
                const drapeGeo = buildContinuousFabricDrapeGeo(cW, cH - 4.5, 9.0, 3.5);
                const drape = new THREE.Mesh(drapeGeo, mFabric);
                drape.position.set(0, 0, 0);
                registerSlotMesh(drape, 'fabric');

            } else if (cType === 'curtain_roller_blind') {
                const mFabric = getDynamicMat('fabric', 'caban_neutral', { color: '#f1f5f9', roughness: 0.7, side: THREE.DoubleSide });
                mFabric.side = THREE.DoubleSide;
                const mCassette = getDynamicMat('cassette', 'upvc_white', { color: '#ffffff', roughness: 0.3 });
                const mBottomBar = getDynamicMat('bottomBar', 'upvc_white', { color: '#e2e8f0', roughness: 0.4 });
                const mChain = getDynamicMat('chain', 'metal_chrome', { color: '#cbd5e1', metalness: 0.9, roughness: 0.1 });

                // Sleek low-profile compact top cassette (height: 2.8 cm, depth: 2.6 cm)
                const cassetteH = 2.8;
                const cassetteD = 2.6;
                const cassette = new THREE.Mesh(new THREE.BoxGeometry(cW + 0.8, cassetteH, cassetteD), mCassette);
                cassette.position.set(0, cH - cassetteH / 2, 0);
                registerSlotMesh(cassette, 'cassette');

                // End mounting brackets
                const bracketL = new THREE.Mesh(new THREE.BoxGeometry(0.4, cassetteH + 0.2, cassetteD + 0.2), mCassette);
                bracketL.position.set(-cW / 2 - 0.4, cH - cassetteH / 2, 0);
                const bracketR = new THREE.Mesh(new THREE.BoxGeometry(0.4, cassetteH + 0.2, cassetteD + 0.2), mCassette);
                bracketR.position.set(cW / 2 + 0.4, cH - cassetteH / 2, 0);
                registerSlotMesh(bracketL, 'cassette');
                registerSlotMesh(bracketR, 'cassette');

                // Fabric sheet
                const bottomBarH = 1.6;
                const sheetH = cH - cassetteH - bottomBarH - 0.4;
                const sheetGeo = new THREE.PlaneGeometry(cW, sheetH);
                sheetGeo.translate(0, sheetH / 2 + bottomBarH + 0.2, 0.4);
                const sPos = sheetGeo.attributes.position;
                const sUv = sheetGeo.attributes.uv;
                for (let i = 0; i < sPos.count; i++) {
                    sUv.setXY(i, (sPos.getX(i) + cW / 2) / 50, (sPos.getY(i)) / 50);
                }
                sUv.needsUpdate = true;
                sheetGeo.computeVertexNormals();

                const blind = new THREE.Mesh(sheetGeo, mFabric);
                registerSlotMesh(blind, 'fabric');

                // Slim weighted bottom hem bar
                const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(cW, bottomBarH, 0.8), mBottomBar);
                bottomBar.position.set(0, bottomBarH / 2 + 0.2, 0.4);
                registerSlotMesh(bottomBar, 'bottomBar');

                // Delicate side beaded chain & drop weight
                const chainLen = cH * 0.65;
                const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, chainLen, 8), mChain);
                chain.position.set(cW / 2 + 1.2, cH - cassetteH - chainLen / 2, 0.6);
                registerSlotMesh(chain, 'chain');

                const dropWeight = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.15, 1.8, 12), mChain);
                dropWeight.position.set(cW / 2 + 1.2, cH - cassetteH - chainLen, 0.6);
                registerSlotMesh(dropWeight, 'chain');

            } else if (cType === 'curtain_roman_shade') {
                const mFabric = getDynamicMat('fabric', 'curly_teddy_checkered', { color: '#e2e8f0', roughness: 0.85, side: THREE.DoubleSide });
                mFabric.side = THREE.DoubleSide;
                const mHeadrail = getDynamicMat('headrail', 'upvc_white', { color: '#ffffff', roughness: 0.4 });
                const mBottomBar = getDynamicMat('bottomBar', 'upvc_white', { color: '#e2e8f0', roughness: 0.4 });
                const mChain = getDynamicMat('chain', 'metal_chrome', { color: '#cbd5e1', metalness: 0.9, roughness: 0.1 });

                // 1. Top Decorative Pelmet / Headrail
                const headrail = new THREE.Mesh(new THREE.BoxGeometry(cW + 1.5, 4.0, 3.2), mHeadrail);
                headrail.position.set(0, cH - 2.0, 0);
                registerSlotMesh(headrail, 'headrail');

                // 2. Continuous Backing Fabric Liner
                const linerGeo = new THREE.PlaneGeometry(cW, cH - 5.0);
                linerGeo.translate(0, (cH - 5.0) / 2 + 1.0, 0.2);
                const liner = new THREE.Mesh(linerGeo, mFabric);
                registerSlotMesh(liner, 'fabric');

                // 3. Segmented Cascading Soft Loops (Waterfall Roman Shade Folds)
                const numTiers = Math.max(3, Math.min(6, Math.floor(cH / 18)));
                const tierNetH = (cH - 6.0) / numTiers;
                const tierOverlap = 1.8;

                for (let i = 0; i < numTiers; i++) {
                    const tierH = tierNetH + tierOverlap;
                    const yBase = i * tierNetH + 1.0;
                    const segGeo = new THREE.PlaneGeometry(cW, tierH, 32, 12);
                    segGeo.translate(0, tierH / 2, 0);

                    const pos = segGeo.attributes.position;
                    const uv = segGeo.attributes.uv;

                    for (let j = 0; j < pos.count; j++) {
                        const px = pos.getX(j);
                        const py = pos.getY(j);
                        const u = (px + cW / 2) / cW;
                        const v = py / tierH;

                        const bulge = Math.sin(v * Math.PI) * 2.2 + (1 - v) * 0.9;
                        const softSag = Math.sin(u * Math.PI) * 0.3;
                        pos.setZ(j, bulge + softSag);

                        uv.setXY(j, (px + cW / 2) / 45, (yBase + py) / 45);
                    }

                    pos.needsUpdate = true;
                    uv.needsUpdate = true;
                    segGeo.computeVertexNormals();

                    const tierMesh = new THREE.Mesh(segGeo, mFabric);
                    tierMesh.position.set(0, yBase, 0.3);
                    registerSlotMesh(tierMesh, 'fabric');

                    // Horizontal stitched seam / batten rod at tier top
                    if (i < numTiers - 1) {
                        const seamGeo = new THREE.CylinderGeometry(0.3, 0.3, cW, 12);
                        seamGeo.rotateZ(Math.PI / 2);
                        const seamMesh = new THREE.Mesh(seamGeo, mHeadrail);
                        seamMesh.position.set(0, yBase + tierNetH, 0.8);
                        registerSlotMesh(seamMesh, 'headrail');
                    }
                }

                // 4. Tailored Bottom Weight Hem Bar
                const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(cW, 2.5, 1.2), mBottomBar);
                bottomBar.position.set(0, 1.25, 1.0);
                registerSlotMesh(bottomBar, 'bottomBar');

                // 5. Beaded Metal Side Pull Chain & Teardrop Weight
                const chainLen = cH * 0.65;
                const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, chainLen, 8), mChain);
                chain.position.set(cW / 2 + 1.8, cH - 4.0 - chainLen / 2, 1.5);
                registerSlotMesh(chain, 'chain');

                const dropWeight = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.2, 2.2, 12), mChain);
                dropWeight.position.set(cW / 2 + 1.8, cH - 4.0 - chainLen, 1.5);
                registerSlotMesh(dropWeight, 'chain');
            }

            const hitboxGeo = new THREE.BoxGeometry(cW + 10, cH + 10, 15);
            builder.addNode({ geometry: hitboxGeo, parent: curtainGroup, position: new THREE.Vector3(0, cH / 2, 0), isHitbox: true });

            curtainGroup.userData = { isWidget: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
        }
    },
    'curtain_drapes_sheer': {
        widget: "curtain_drapes_sheer", label: "SHEER WAVE CURTAINS", cutsWall: false,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 80, height: 95, elevation: 0, thick: 4, facing: 1, curtainType: 'curtain_drapes_sheer' },
        render2D: (group, entity) => WIDGET_REGISTRY['curtain'].render2D(group, { ...entity, curtainType: 'curtain_drapes_sheer' }),
        render3D: (sceneGroup, entity, helpers) => WIDGET_REGISTRY['curtain'].render3D(sceneGroup, { ...entity, curtainType: 'curtain_drapes_sheer' }, helpers)
    },
    'curtain_drapes_blackout': {
        widget: "curtain_drapes_blackout", label: "BLACKOUT PINCH-PLEAT DRAPES", cutsWall: false,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 90, height: 95, elevation: 0, thick: 4, facing: 1, curtainType: 'curtain_drapes_blackout' },
        render2D: (group, entity) => WIDGET_REGISTRY['curtain'].render2D(group, { ...entity, curtainType: 'curtain_drapes_blackout' }),
        render3D: (sceneGroup, entity, helpers) => WIDGET_REGISTRY['curtain'].render3D(sceneGroup, { ...entity, curtainType: 'curtain_drapes_blackout' }, helpers)
    },
    'curtain_roller_blind': {
        widget: "curtain_roller_blind", label: "MODERN ROLLER BLIND", cutsWall: false,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 50, height: 50, elevation: 35, thick: 4, facing: 1, curtainType: 'curtain_roller_blind' },
        render2D: (group, entity) => WIDGET_REGISTRY['curtain'].render2D(group, { ...entity, curtainType: 'curtain_roller_blind' }),
        render3D: (sceneGroup, entity, helpers) => WIDGET_REGISTRY['curtain'].render3D(sceneGroup, { ...entity, curtainType: 'curtain_roller_blind' }, helpers)
    },
    'curtain_roman_shade': {
        widget: "curtain_roman_shade", label: "SEGMENTED ROMAN SHADE", cutsWall: false,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 50, height: 50, elevation: 35, thick: 4, facing: 1, curtainType: 'curtain_roman_shade' },
        render2D: (group, entity) => WIDGET_REGISTRY['curtain'].render2D(group, { ...entity, curtainType: 'curtain_roman_shade' }),
        render3D: (sceneGroup, entity, helpers) => WIDGET_REGISTRY['curtain'].render3D(sceneGroup, { ...entity, curtainType: 'curtain_roman_shade' }, helpers)
    },
    'wall_art': {
        widget: "wall_art", label: "WALL ART & FRAMES", cutsWall: false,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 50, height: 35, depth: 3, elevation: 45, thick: 2, facing: 1, artType: 'decor_wall_art_canvas' },
        render2D: (group, entity) => {
            const hw = (entity.width || 50) / 2;
            const w = entity.width || 50;
            const thick = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || 20) : (entity.thick || 20);
            const signY = (entity.facing === -1) ? -1 : 1;
            const yPos = signY * (thick / 2 + 2);

            const rect = new Konva.Rect({
                x: -hw, y: yPos - 1.5, width: w, height: 3,
                fill: '#6366f1', stroke: '#4338ca', strokeWidth: 1.5
            });
            const cross = new Konva.Line({
                points: [-hw + 2, yPos, hw - 2, yPos],
                stroke: '#a5b4fc', strokeWidth: 1
            });
            group.add(rect, cross);
        },
        render3D: (sceneGroup, entity, helpers) => {
            const builder = new BIMComponentBuilder(entity, helpers);
            const artGroup = builder.group;
            let baseElev = entity.elevation !== undefined ? entity.elevation : 45;
            if (entity.localX !== undefined) {
                artGroup.position.set(entity.localX, baseElev, 0);
                artGroup.rotation.y = 0;
            } else {
                artGroup.position.set(entity.x || 0, baseElev, entity.z || 0);
                artGroup.rotation.y = -(entity.angle || 0);
            }

            const thick = entity.wall?.thickness || entity.wall?.config?.thickness || entity.thick || 20;
            const wallOffset = thick / 2;
            const signZ = (entity.facing === -1) ? -1 : 1;

            const contentGroup = new THREE.Group();
            contentGroup.position.z = wallOffset * signZ;
            if (signZ === -1) {
                contentGroup.rotation.y = Math.PI;
            }
            artGroup.add(contentGroup);

            const aType = entity.artType || entity.type || 'decor_wall_art_canvas';
            const aW = entity.width || 50;
            const aH = entity.height || 35;
            const aD = entity.depth || 3;

            const registerSlotMesh = (mesh, slotName) => {
                mesh.userData.entity = entity;
                mesh.userData.materialSlot = slotName;
                mesh.userData.componentId = `${entity.id || 'art'}_${slotName}`;
                ComponentRegistry.registerMesh(entity, slotName, mesh, { componentId: mesh.userData.componentId, componentType: aType });
                contentGroup.add(mesh);
                return mesh;
            };

            const getDynamicMat = (slotName, defaultKey, defaultProps = {}) => {
                const slotId = entity.materials?.[slotName]?.id || defaultKey;
                if (helpers?.getDynamicMaterial) {
                    return helpers.getDynamicMaterial(slotId, slotName);
                }
                return new THREE.MeshStandardMaterial({ ...defaultProps });
            };

            if (aType === 'decor_photo_gallery') {
                const mFrame = getDynamicMat('frame', 'metal_matte_black', { color: '#0f172a', roughness: 0.6 });
                const mMatting = getDynamicMat('matting', 'upvc_white', { color: '#f8fafc', roughness: 0.9 });
                const mPhoto = getDynamicMat('photo', 'crepe_satin_real', { color: '#e2e8f0', roughness: 0.5 });
                const mGlass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 0.9, opacity: 1, transparent: true, roughness: 0.1 });

                const fW = (aW - 10) / 3;
                const fH = aH;
                const fD = aD;
                const baseZ = fD / 2 + 0.2;

                [-fW - 4, 0, fW + 4].forEach((ox, idx) => {
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(fW, fH, fD), mFrame);
                    frame.position.set(ox, fH / 2, baseZ);

                    const matting = new THREE.Mesh(new THREE.BoxGeometry(fW - 2, fH - 2, 0.4), mMatting);
                    matting.position.set(ox, fH / 2, baseZ + fD / 2 - 0.2);

                    const photo = new THREE.Mesh(new THREE.BoxGeometry(fW - 6, fH - 8, 0.2), mPhoto);
                    photo.position.set(ox, fH / 2, baseZ + fD / 2);

                    const glass = new THREE.Mesh(new THREE.BoxGeometry(fW - 1.5, fH - 1.5, 0.2), mGlass);
                    glass.position.set(ox, fH / 2, baseZ + fD / 2 + 0.2);

                    registerSlotMesh(frame, 'frame');
                    registerSlotMesh(matting, 'matting');
                    registerSlotMesh(photo, 'photo');
                    contentGroup.add(glass);
                });
            } else {
                // decor_wall_art_canvas
                const mFrame = getDynamicMat('frame', 'wood_dark_walnut', { color: '#3e2723', roughness: 0.7 });
                const mCanvas = getDynamicMat('canvas', 'caban_neutral', { color: '#f8fafc', roughness: 0.9 });
                const baseZ = aD / 2 + 0.2;

                const frame = new THREE.Mesh(new THREE.BoxGeometry(aW, aH, aD), mFrame);
                frame.position.set(0, aH / 2, baseZ);
                registerSlotMesh(frame, 'frame');

                const canvas = new THREE.Mesh(new THREE.BoxGeometry(aW - 2, aH - 2, aD + 0.2), mCanvas);
                canvas.position.set(0, aH / 2, baseZ + 0.1);
                registerSlotMesh(canvas, 'canvas');
            }

            const hitboxGeo = new THREE.BoxGeometry(aW + 5, aH + 5, 8);
            builder.addNode({ geometry: hitboxGeo, parent: artGroup, position: new THREE.Vector3(0, aH / 2, 0), isHitbox: true });

            artGroup.userData = { isWidget: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
        }
    },
    'decor_wall_art_canvas': {
        widget: "decor_wall_art_canvas", label: "CANVAS WALL ART", cutsWall: false,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 50, height: 35, depth: 3, elevation: 45, thick: 2, facing: 1, artType: 'decor_wall_art_canvas' },
        render2D: (group, entity) => WIDGET_REGISTRY['wall_art'].render2D(group, { ...entity, artType: 'decor_wall_art_canvas' }),
        render3D: (sceneGroup, entity, helpers) => WIDGET_REGISTRY['wall_art'].render3D(sceneGroup, { ...entity, artType: 'decor_wall_art_canvas' }, helpers)
    },
    'decor_photo_gallery': {
        widget: "decor_photo_gallery", label: "PHOTO GALLERY 3-FRAME", cutsWall: false,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 60, height: 25, depth: 3, elevation: 50, thick: 2, facing: 1, artType: 'decor_photo_gallery' },
        render2D: (group, entity) => WIDGET_REGISTRY['wall_art'].render2D(group, { ...entity, artType: 'decor_photo_gallery' }),
        render3D: (sceneGroup, entity, helpers) => WIDGET_REGISTRY['wall_art'].render3D(sceneGroup, { ...entity, artType: 'decor_photo_gallery' }, helpers)
    },
    'arch_opening': {
        widget: "arch_opening", label: "ARCH OPENING", cutsWall: true,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 50, height: DOOR_HEIGHT, depth: 20, elevation: 0, thick: 20, facing: 1 },
        render2D: (group, entity) => {
            const hw = (entity.width || 50) / 2; const thick = entity.wall ? (entity.wall.thickness || 20) : 20;
            group.add(new Konva.Rect({ x: -hw, y: -thick/2, width: entity.width || 50, height: thick, stroke: '#38bdf8', strokeWidth: 2, fill: 'rgba(56, 189, 248, 0.15)' }));
            group.add(new Konva.Arc({ x: 0, y: 0, innerRadius: hw, outerRadius: hw, angle: 180, rotation: 180, stroke: '#38bdf8', dash: [4, 4] }));
        },
        render3D: (sceneGroup, entity, helpers) => {
            const baseElev = entity.elevation || 0; const h = entity.height || DOOR_HEIGHT; const w = entity.width || 50; const thick = entity.wall ? (entity.wall.thickness || 20) : (entity.thick || 20);
            const builder = new BIMComponentBuilder(entity, helpers);
            const opGroup = builder.group;
            if (entity.localX !== undefined) opGroup.position.set(entity.localX, baseElev, 0);
            else opGroup.position.set(entity.x || 0, baseElev, entity.z || 0);
            const hitGeo = new THREE.BoxGeometry(w, h, thick + 4);
            builder.addNode({ geometry: hitGeo, parent: opGroup, position: new THREE.Vector3(0, h/2, 0), isHitbox: true });
            opGroup.userData = { isWidget: true, isOpening: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
        }
    },
    'circular_opening': {
        widget: "circular_opening", label: "CIRCULAR OPENING", cutsWall: true,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 40, height: 40, depth: 20, elevation: 40, thick: 20, facing: 1 },
        render2D: (group, entity) => {
            const hw = (entity.width || 40) / 2; const thick = entity.wall ? (entity.wall.thickness || 20) : 20;
            group.add(new Konva.Ellipse({ x: 0, y: 0, radiusX: hw, radiusY: thick/2, stroke: '#38bdf8', strokeWidth: 2, fill: 'rgba(56, 189, 248, 0.15)' }));
        },
        render3D: (sceneGroup, entity, helpers) => {
            const baseElev = entity.elevation !== undefined ? entity.elevation : 40; const h = entity.height || 40; const w = entity.width || 40; const thick = entity.wall ? (entity.wall.thickness || 20) : (entity.thick || 20);
            const builder = new BIMComponentBuilder(entity, helpers);
            const opGroup = builder.group;
            if (entity.localX !== undefined) opGroup.position.set(entity.localX, baseElev, 0);
            else opGroup.position.set(entity.x || 0, baseElev, entity.z || 0);
            const hitGeo = new THREE.BoxGeometry(w, h, thick + 4);
            builder.addNode({ geometry: hitGeo, parent: opGroup, position: new THREE.Vector3(0, h/2, 0), isHitbox: true });
            opGroup.userData = { isWidget: true, isOpening: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
        }
    },
    'custom_shape_opening': {
        widget: "custom_shape_opening", label: "CUSTOM SHAPE OPENING", cutsWall: true,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 50, height: 60, depth: 20, elevation: 40, thick: 20, facing: 1 },
        render2D: (group, entity) => {
            const hw = (entity.width || 50) / 2; const thick = entity.wall ? (entity.wall.thickness || 20) : 20;
            group.add(new Konva.Rect({ x: -hw, y: -thick/2, width: entity.width || 50, height: thick, stroke: '#38bdf8', strokeWidth: 2, fill: 'rgba(56, 189, 248, 0.15)' }));
        },
        render3D: (sceneGroup, entity, helpers) => {
            const baseElev = entity.elevation !== undefined ? entity.elevation : 40; const h = entity.height || 60; const w = entity.width || 50; const thick = entity.wall ? (entity.wall.thickness || 20) : (entity.thick || 20);
            const builder = new BIMComponentBuilder(entity, helpers);
            const opGroup = builder.group;
            if (entity.localX !== undefined) opGroup.position.set(entity.localX, baseElev, 0);
            else opGroup.position.set(entity.x || 0, baseElev, entity.z || 0);
            const hitGeo = new THREE.BoxGeometry(w, h, thick + 4);
            builder.addNode({ geometry: hitGeo, parent: opGroup, position: new THREE.Vector3(0, h/2, 0), isHitbox: true });
            opGroup.userData = { isWidget: true, isOpening: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
        }
    },
    'solid_protrusion': {
        widget: "solid_protrusion", label: "SOLID PROTRUSION", cutsWall: false,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 40, height: 50, depth: 10, elevation: 0, thick: 20, facing: 1 },
        render2D: (group, entity) => {
            const hw = (entity.width || 40) / 2;
            const thick = entity.wall ? (entity.wall.thickness || 20) : (entity.thick || 20);
            const depth = entity.depth || 10;
            const facing = entity.facing || 1;
            const yPos = facing === 1 ? (thick / 2) : (-thick / 2 - depth);
            group.add(new Konva.Text({
                x: -hw,
                y: yPos + depth / 2 - 6,
                width: entity.width || 40,
                text: `+${Math.round(depth)}`,
                fontSize: 10,
                fill: '#475569',
                fontStyle: 'bold',
                align: 'center'
            }));
        },
        render3D: null
    },
    'niche_recess': {
        widget: "niche_recess", label: "NICHE & RECESS", cutsWall: false,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 40, height: 50, depth: 6, elevation: 40, thick: 20, facing: 1 },
        render2D: (group, entity) => {
            const hw = (entity.width || 40) / 2; const thick = entity.wall ? (entity.wall.thickness || 20) : 20;
            const recessDepth = Math.min(entity.depth || 6, thick - 2);
            group.add(new Konva.Rect({ x: -hw, y: -thick/2, width: entity.width || 40, height: thick - recessDepth, stroke: '#38bdf8', strokeWidth: 2, fill: 'rgba(56, 189, 248, 0.15)' }));
            group.add(new Konva.Rect({ x: -hw, y: thick/2 - recessDepth, width: entity.width || 40, height: recessDepth, fill: 'rgba(56, 189, 248, 0.4)' }));
        },
        render3D: (sceneGroup, entity, helpers) => {
            const baseElev = entity.elevation !== undefined ? entity.elevation : 40; const h = entity.height || 50; const w = entity.width || 40; const thick = entity.wall ? (entity.wall.thickness || 20) : (entity.thick || 20);
            const builder = new BIMComponentBuilder(entity, helpers);
            const opGroup = builder.group;
            if (entity.localX !== undefined) opGroup.position.set(entity.localX, baseElev, 0);
            else opGroup.position.set(entity.x || 0, baseElev, entity.z || 0);
            const hitGeo = new THREE.BoxGeometry(w, h, thick + 4);
            builder.addNode({ geometry: hitGeo, parent: opGroup, position: new THREE.Vector3(0, h/2, 0), isHitbox: true });
            opGroup.userData = { isWidget: true, isOpening: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
        }
    },
    'pattern_opening': {
        widget: "pattern_opening", label: "PATTERN OPENING", cutsWall: true,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 50, height: 60, depth: 20, elevation: 40, thick: 20, facing: 1, rows: 4, cols: 4, spacing: 5, patternStyle: 'grid' },
        render2D: (group, entity) => {
            const hw = (entity.width || 50) / 2; const thick = entity.wall ? (entity.wall.thickness || 20) : 20;
            group.add(new Konva.Rect({ x: -hw, y: -thick/2, width: entity.width || 50, height: thick, stroke: '#38bdf8', strokeWidth: 2, fill: 'rgba(56, 189, 248, 0.15)' }));
        },
        render3D: (sceneGroup, entity, helpers) => {
            const baseElev = entity.elevation !== undefined ? entity.elevation : 40; const h = entity.height || 60; const w = entity.width || 50; const thick = entity.wall ? (entity.wall.thickness || 20) : (entity.thick || 20);
            const builder = new BIMComponentBuilder(entity, helpers);
            const opGroup = builder.group;
            if (entity.localX !== undefined) opGroup.position.set(entity.localX, baseElev, 0);
            else opGroup.position.set(entity.x || 0, baseElev, entity.z || 0);
            const hitGeo = new THREE.BoxGeometry(w, h, thick + 4);
            builder.addNode({ geometry: hitGeo, parent: opGroup, position: new THREE.Vector3(0, h/2, 0), isHitbox: true });
            opGroup.userData = { isWidget: true, isOpening: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
        }
    },
    'boolean_cut': {
        widget: "boolean_cut", label: "BOOLEAN CUT", cutsWall: true,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 50, height: 60, depth: 20, elevation: 40, thick: 20, facing: 1 },
        render2D: (group, entity) => {
            const hw = (entity.width || 50) / 2; const thick = entity.wall ? (entity.wall.thickness || 20) : 20;
            group.add(new Konva.Rect({ x: -hw, y: -thick/2, width: entity.width || 50, height: thick, stroke: '#38bdf8', strokeWidth: 2, dash: [6, 4], fill: 'rgba(56, 189, 248, 0.15)' }));
        },
        render3D: (sceneGroup, entity, helpers) => {
            const baseElev = entity.elevation !== undefined ? entity.elevation : 40; const h = entity.height || 60; const w = entity.width || 50; const thick = entity.wall ? (entity.wall.thickness || 20) : (entity.thick || 20);
            const builder = new BIMComponentBuilder(entity, helpers);
            const opGroup = builder.group;
            if (entity.localX !== undefined) opGroup.position.set(entity.localX, baseElev, 0);
            else opGroup.position.set(entity.x || 0, baseElev, entity.z || 0);
            const hitGeo = new THREE.BoxGeometry(w, h, thick + 4);
            builder.addNode({ geometry: hitGeo, parent: opGroup, position: new THREE.Vector3(0, h/2, 0), isHitbox: true });
            opGroup.userData = { isWidget: true, isOpening: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
        }
    },
    'opening': {
        widget: "opening", label: "WALL OPENING", cutsWall: true,
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 50, height: DOOR_HEIGHT, depth: 20, elevation: 0, thick: 20, facing: 1 },
        render2D: (group, entity) => {
            const hw = (entity.width || 50) / 2; const thick = entity.wall ? (entity.wall.thickness || 20) : 20;
            group.add(new Konva.Rect({ x: -hw, y: -thick/2, width: entity.width || 50, height: thick, stroke: '#38bdf8', strokeWidth: 2, fill: 'rgba(56, 189, 248, 0.15)' }));
        },
        render3D: (sceneGroup, entity, helpers) => {
            const baseElev = entity.elevation || 0; const h = entity.height || DOOR_HEIGHT; const w = entity.width || 50; const thick = entity.wall ? (entity.wall.thickness || 20) : (entity.thick || 20);
            const builder = new BIMComponentBuilder(entity, helpers);
            const opGroup = builder.group;
            if (entity.localX !== undefined) opGroup.position.set(entity.localX, baseElev, 0);
            else opGroup.position.set(entity.x || 0, baseElev, entity.z || 0);
            const hitGeo = new THREE.BoxGeometry(w, h, thick + 4);
            builder.addNode({ geometry: hitGeo, parent: opGroup, position: new THREE.Vector3(0, h/2, 0), isHitbox: true });
            opGroup.userData = { isWidget: true, isOpening: true, entity: entity };
            const finalGroup = builder.build();
            sceneGroup.add(finalGroup);
            return finalGroup;
        }
    }
};

export function offsetPolygon(points, offsetAmount) {
    if (!points || points.length < 3) return points;
    
    let isArray = Array.isArray(offsetAmount);
    if (!isArray && (!offsetAmount || offsetAmount === 0)) return points;

    // Sanitize points: remove duplicate adjacent vertices and duplicate closing vertex
    const pts = [];
    for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') continue;
        if (pts.length > 0) {
            const prev = pts[pts.length - 1];
            if (Math.hypot(pt.x - prev.x, pt.y - prev.y) < 1e-4) continue;
        }
        pts.push({ x: pt.x, y: pt.y });
    }
    if (pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-4) {
        pts.pop();
    }
    if (pts.length < 3) return points;
    
    let signedArea = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        let p0 = pts[i];
        let p1 = pts[(i + 1) % n];
        signedArea += (p0.x * p1.y - p1.x * p0.y);
    }
    
    const result = [];
    for (let i = 0; i < n; i++) {
        let prev = pts[(i - 1 + n) % n];
        let curr = pts[i];
        let next = pts[(i + 1) % n];
        
        let e1x = curr.x - prev.x;
        let e1y = curr.y - prev.y;
        let len1 = Math.sqrt(e1x * e1x + e1y * e1y);
        if (len1 > 1e-5) { e1x /= len1; e1y /= len1; }
        else { e1x = 1; e1y = 0; }
        
        let e2x = next.x - curr.x;
        let e2y = next.y - curr.y;
        let len2 = Math.sqrt(e2x * e2x + e2y * e2y);
        if (len2 > 1e-5) { e2x /= len2; e2y /= len2; }
        else { e2x = 1; e2y = 0; }
        
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
        
        if (Math.abs(cross) < 1e-5) {
            let bx = n1x + n2x;
            let by = n1y + n2y;
            let blen = Math.sqrt(bx * bx + by * by);
            if (blen < 0.0001) { bx = n1x; by = n1y; blen = 1; }
            bx /= blen; by /= blen;
            
            let dot = bx * n1x + by * n1y;
            if (Math.abs(dot) < 0.1) dot = 0.1;
            let avgOff = (off1 + off2) / 2;
            let dist = avgOff / dot;
            const maxClamp = Math.max(Math.abs(off1), Math.abs(off2), 5) * 3;
            if (Math.abs(dist) > maxClamp) dist = Math.sign(dist) * maxClamp;
            
            result.push({ x: curr.x + bx * dist, y: curr.y + by * dist });
        } else {
            let dx = p2x - p1x;
            let dy = p2y - p1y;
            let t = (dx * e2y - dy * e2x) / cross;
            let rx = p1x + t * e1x;
            let ry = p1y + t * e1y;
            
            // Clamp miter extension on acute angles to avoid arrow spikes
            const maxMiter = Math.max(Math.abs(off1), Math.abs(off2), 5) * 4;
            if (Math.hypot(rx - curr.x, ry - curr.y) > maxMiter) {
                let bx = n1x + n2x;
                let by = n1y + n2y;
                let blen = Math.hypot(bx, by);
                if (blen > 1e-4) {
                    bx /= blen; by /= blen;
                    rx = curr.x + bx * maxMiter;
                    ry = curr.y + by * maxMiter;
                }
            }
            
            result.push({
                x: rx,
                y: ry
            });
        }
    }
    return result;
}

export const GIZMO_REGISTRY = {
    'floor': ['material'],
    'room': ['material'],
    'wall': ['pushPull', 'material'],
    'roof': ['material', 'roofCorners', 'move', 'spin'],
    'door': ['move', 'opening', 'material', 'style', 'delete'],
    'door_french': ['move', 'opening', 'material', 'delete'],
    'window': ['move', 'opening', 'material', 'style', 'delete'],
    'opening': ['move', 'opening', 'material', 'delete'],
    'jali_panel': ['move', 'opening', 'material', 'style', 'delete'],
    'sunshade': ['move', 'place', 'scale', 'spin', 'tilt', 'material', 'delete'],
    'elevation_fascia': ['move', 'place', 'scale', 'spin', 'tilt', 'material', 'corner', 'delete'],
    'shape': ['move', 'place', 'scale', 'spin', 'tilt', 'material', 'vertexSlope', 'delete'],
    'floor_cut': ['polygonEdges'],
    'elevation_segment': [],
    'facade_ribbon': [],
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

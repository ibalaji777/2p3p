import Konva from 'konva';
import * as THREE from 'three';

export const GRID = 20;
export const PX_TO_FT = 1 / GRID;
export const WALL_HEIGHT = 120;
export const DOOR_HEIGHT = 80;
export const WINDOW_SILL = 35;
export const WINDOW_HEIGHT = 45;
export const SNAP_DIST = 25; 

export const DOOR_TYPES = { single: { label: "Single Hinged Door" }, double: { label: "Double Door" }, sliding: { label: "Sliding Door" }, double_sliding: { label: "Double Sliding Door" }, folding: { label: "Folding / Bi-fold" }, pivot: { label: "Pivot Door" }, pocket: { label: "Pocket Door" }, french: { label: "French Door (Glass)" } };
export const WINDOW_TYPES = { sliding_std: { label: "Standard Sliding Window", type: "sliding", hasChajja: false }, casement_std: { label: "Casement / Hinged Window", type: "casement", hasChajja: false }, casement_chajja: { label: "Window with Concrete Sunshade", type: "casement", hasChajja: true }, fixed_elevation: { label: "Fixed Elevation Glass", type: "fixed", hasChajja: false }, bay_box: { label: "Box Bay Window (Villa Style)", type: "bay", hasChajja: true }, louver_vent: { label: "Vent / Louver (Bathroom)", type: "louver", hasChajja: false }, traditional_indian: { label: "Traditional Wooden Shutter", type: "traditional", hasChajja: true } };

export const DOOR_MATERIALS = {
    wood: { label: "White Oak", color: 0xc4a482, roughness: 0.6, metalness: 0.05, texture: 'wood', bumpScale: 0.005, clearcoat: 0.05 },
    steel: { label: "Brushed Steel", color: 0xa0a5aa, roughness: 0.35, metalness: 0.8, texture: 'brushed', bumpScale: 0.005, clearcoat: 0.2 },
    glass: { label: "Double-Pane Glass", color: 0xeff6ff, roughness: 0.0, metalness: 0.1, transmission: 0.98, transparent: true, ior: 1.52, thickness: 3.0, clearcoat: 1.0 },
    aluminium: { label: "Aluminium", color: 0xc8cdd0, roughness: 0.4, metalness: 0.6, texture: 'solid' },
    pvc: { label: "Matte White", color: 0xfdfdfd, roughness: 0.7, metalness: 0.0, texture: 'solid', clearcoat: 0.0 },
    laminate: { label: "Charcoal Black", color: 0x2e2b2a, roughness: 0.4, metalness: 0.1, texture: 'wood', bumpScale: 0.002, clearcoat: 0.1 }
};

export const WINDOW_FRAME_MATERIALS = { upvc_white: { label: "White uPVC", color: 0xffffff, roughness: 0.8, metalness: 0.0, texture: 'solid' }, upvc_wood: { label: "Wood Finish uPVC", color: 0x8b5a2b, roughness: 0.7, metalness: 0.0, texture: 'wood', bumpScale: 0.005 }, alum_powder: { label: "Powder Coated Alum (Black)", color: 0x1f1f1f, roughness: 0.5, metalness: 0.6, texture: 'solid' }, wood_teak: { label: "Teak Wood", color: 0x6b4226, roughness: 0.6, metalness: 0.1, texture: 'wood', bumpScale: 0.005 }, steel_ms: { label: "MS Steel Frame", color: 0x222222, roughness: 0.4, metalness: 0.9, texture: 'solid' } };
export const WINDOW_GLASS_MATERIALS = { clear: { label: "Clear Glass", color: 0xeff6ff, transmission: 0.95, roughness: 0.0, ior: 1.5, transparent: true }, frosted: { label: "Frosted / Privacy Glass", color: 0xffffff, transmission: 0.5, roughness: 0.5, ior: 1.4, transparent: true }, tinted: { label: "Tinted Glass (Dark)", color: 0x222222, transmission: 0.85, roughness: 0.0, ior: 1.5, transparent: true }, reflective: { label: "Reflective / Mirror", color: 0xaaaaaa, transmission: 0.3, roughness: 0.0, metalness: 1.0, ior: 2.0, transparent: true } };
export const WINDOW_GRILLE_PATTERNS = { grid: { label: "Standard Grid" }, horizontal: { label: "Horizontal Bars" }, vertical: { label: "Vertical Bars" }, diamond: { label: "Diamond Pattern" }, none: { label: "No Safety Grille" } };

// Outer wall is thicker (16), Inner wall is less thick (8)
export const WALL_REGISTRY = {
    'outer': { type: "outer", label: "OUTER WALL", thickness: 16, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] },
    'inner': { type: "inner", label: "INNER WALL", thickness: 8, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] }
};

// --- PNG WALL PATTERNS REGISTRY ---
export const WALL_DECOR_REGISTRY = {
    'brick_wall': {
        id: 'brick_wall',
        name: 'Red Bricks',
                texture: 'models/wall/redbrick.png', 
        // texture: 'https://threejs.org/examples/textures/brick_diffuse.jpg', 
        thumbnail: 'https://threejs.org/examples/textures/brick_diffuse.jpg', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2, // Reference Code logic
        defaultRepeat: 3   // Reference Code logic
    },
    'wood_panel': {
        id: 'wood_panel',
        name: 'Wood Panels',
        texture: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg', 
        thumbnail: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2, 
        defaultRepeat: 3   
    },
    'solid_color': {
        id: 'solid_color',
        name: 'Painted Wall',
        texture: 'https://via.placeholder.com/512x512/e2e8f0/e2e8f0', 
        thumbnail: 'https://via.placeholder.com/150x150/e2e8f0/000?text=Paint', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 1
    }
};

export const FURNITURE_REGISTRY = {
      'couch_1': {
        id: 'couch_1',
        name: 'Ekero couch',
        model: 'models/chairs_couch/couch.glb', 
        texture: 'textures/ik-ekero-orange_baked.png',
        preview: 'https://via.placeholder.com/150/FF8C00/FFFFFF?text=Chair', 
        default: { width: 40, height: 50, depth: 40 }, 
        editable: { resize: true, rotation: true, move: true }
    },
    'chair_ekero': {
        id: 'chair_ekero',
        name: 'Ekero Chair',
        model: 'models/chair_ekero.glb', 
        texture: 'textures/ik-ekero-orange_baked.png',
        preview: 'https://via.placeholder.com/150/FF8C00/FFFFFF?text=Chair', 
        default: { width: 40, height: 50, depth: 40 }, 
        editable: { resize: true, rotation: true, move: true }
    },
    'table_dining': {
        id: 'table_dining',
        name: 'Dining Table',
        model: 'models/table_dining.glb',
        preview: 'https://via.placeholder.com/150/8B4513/FFFFFF?text=Table',
        default: { width: 100, height: 40, depth: 60 },
        editable: { resize: true, rotation: true, move: true }
    }
};

function buildDetailedDoorPanel(width, height, thickness, material, type, isGlass, signX = 1, helpers) {
    const group = new THREE.Group(); const gap = 0.2; 
    if (isGlass || type === 'french') {
        const frameW = 3.5; const topRailH = 3.5; const botRailH = 5;
        const geoStile = new THREE.BoxGeometry(frameW, height, thickness); const geoRailT = new THREE.BoxGeometry(width - frameW*2, topRailH, thickness); const geoRailB = new THREE.BoxGeometry(width - frameW*2, botRailH, thickness);
        const stileL = new THREE.Mesh(geoStile, material); stileL.position.set(-width/2 + frameW/2, height/2, 0); const stileR = new THREE.Mesh(geoStile, material); stileR.position.set(width/2 - frameW/2, height/2, 0);
        const railT = new THREE.Mesh(geoRailT, material); railT.position.set(0, height - topRailH/2, 0); const railB = new THREE.Mesh(geoRailB, material); railB.position.set(0, botRailH/2, 0);
        [stileL, stileR, railT, railB].forEach(m => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
        const glassMat = helpers.getDynamicMaterial('glass', 'door'); const geoGlass = new THREE.BoxGeometry(width - frameW*2, height - topRailH - botRailH, thickness * 0.4);
        const glass = new THREE.Mesh(geoGlass, glassMat); glass.position.set(0, height/2 + (botRailH - topRailH)/2, 0); group.add(glass);
    } else {
        const coreGeo = new THREE.BoxGeometry(width, height, thickness - 0.1); const core = new THREE.Mesh(coreGeo, material); core.position.set(0, height/2, 0); core.castShadow = true; core.receiveShadow = true; group.add(core);
        const numPanels = 4; const panelHeight = (height - (gap * (numPanels - 1))) / numPanels; const geoPanel = new THREE.BoxGeometry(width, panelHeight, thickness);
        for (let i = 0; i < numPanels; i++) { const p = new THREE.Mesh(geoPanel, material); const yPos = (panelHeight / 2) + i * (panelHeight + gap); p.position.set(0, yPos, 0); p.castShadow = true; p.receiveShadow = true; group.add(p); }
    }
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 }); const silverMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.9, roughness: 0.15 }); const handleY = height * 0.45; 
    if (['sliding', 'double_sliding'].includes(type) && isGlass) {
        const handleGeo = new THREE.CylinderGeometry(0.35, 0.35, 30, 16); const standoffGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
        [-1, 1].forEach(side => { const zPos = side === 1 ? thickness/2 + 1.2 : -thickness/2 - 1.2; const pull = new THREE.Mesh(handleGeo, silverMat); pull.position.set((width/2 - 3) * signX, handleY, zPos); const so1 = new THREE.Mesh(standoffGeo, silverMat); so1.rotation.x = Math.PI/2; so1.position.set((width/2 - 3) * signX, handleY + 12, zPos - side*0.6); const so2 = new THREE.Mesh(standoffGeo, silverMat); so2.rotation.x = Math.PI/2; so2.position.set((width/2 - 3) * signX, handleY - 12, zPos - side*0.6); [pull, so1, so2].forEach(m => { m.castShadow = true; group.add(m); }); });
    } else if (['sliding', 'double_sliding', 'pocket'].includes(type)) {
        const flushGeo = new THREE.BoxGeometry(2, 10, 0.4); const pullF = new THREE.Mesh(flushGeo, metalMat); pullF.position.set((width/2 - 4) * signX, handleY, thickness/2 + 0.1); const pullB = new THREE.Mesh(flushGeo, metalMat); pullB.position.set((width/2 - 4) * signX, handleY, -thickness/2 - 0.1); [pullF, pullB].forEach(m => group.add(m));
    } else if (type === 'pivot') {
        const barGeo = new THREE.CylinderGeometry(0.5, 0.5, 24, 16); const standoffGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 8);
        [-1, 1].forEach(side => { const zPos = side === 1 ? thickness/2 + 1.5 : -thickness/2 - 1.5; const bar = new THREE.Mesh(barGeo, metalMat); bar.position.set((width/2 - 4) * signX, handleY, zPos); const so1 = new THREE.Mesh(standoffGeo, metalMat); so1.rotation.x = Math.PI/2; so1.position.set((width/2 - 4) * signX, handleY + 10, zPos - side); const so2 = new THREE.Mesh(standoffGeo, metalMat); so2.rotation.x = Math.PI/2; so2.position.set((width/2 - 4) * signX, handleY - 10, zPos - side); [bar, so1, so2].forEach(m => { m.castShadow = true; group.add(m); }); });
    } else if (type === 'folding_lead') { const pullGeo = new THREE.BoxGeometry(0.8, 14, thickness + 1.2); const pull = new THREE.Mesh(pullGeo, metalMat); pull.position.set((width/2 - 1.5) * -signX, handleY, 0); pull.castShadow = true; group.add(pull);
    } else if (['single', 'double', 'french'].includes(type)) {
        const rose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 6, thickness + 1.2), metalMat); rose.position.set((width/2 - 3.5) * signX, handleY, 0); const leverF = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 1.0), metalMat); leverF.position.set((width/2 - 5.5) * signX, handleY, thickness/2 + 0.9); const leverB = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 1.0), metalMat); leverB.position.set((width/2 - 5.5) * signX, handleY, -thickness/2 - 0.9); [rose, leverF, leverB].forEach(m => { m.castShadow = true; group.add(m); });
    }
    if (['single', 'double', 'french', 'folding_main'].includes(type) && signX !== 0) { const hingeGeo = new THREE.CylinderGeometry(0.2, 0.2, 4, 12); [height * 0.88, height * 0.5, height * 0.12].forEach(y => { const hinge = new THREE.Mesh(hingeGeo, metalMat); hinge.position.set((width/2) * -signX, y, thickness/2 + 0.2); hinge.castShadow = true; group.add(hinge); }); }
    return group;
}

export const WIDGET_REGISTRY = {
    'door': {
        widget: "door", label: "DOOR",
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "jump_wall_to_wall", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 40, doorType: 'single', doorMat: 'wood', facing: 1, side: 1 },
        render2D: (group, entity) => {
            const hw = entity.width / 2; const thick = entity.wall.config.thickness;
            if (entity.doorType === 'single') {
                const hingeX = (entity.side === 1) ? hw : -hw; const arcRot = (entity.side === 1) ? ((entity.facing === 1) ? 180 : 90) : ((entity.facing === 1) ? 270 : 0); 
                group.add(new Konva.Arc({ x: hingeX, y: 0, innerRadius: entity.width, outerRadius: entity.width, angle: 90, stroke: '#9ca3af', dash: [4, 4], rotation: arcRot }), new Konva.Line({ points: [hingeX, 0, hingeX, -entity.width * entity.facing], stroke: '#374151', strokeWidth: 3 })); 
            } else if (entity.doorType === 'double' || entity.doorType === 'french') { 
                const arcRotL = entity.facing === 1 ? 270 : 0, arcRotR = entity.facing === 1 ? 180 : 90; 
                group.add(new Konva.Arc({ x: -hw, y: 0, innerRadius: hw, outerRadius: hw, angle: 90, rotation: arcRotL, stroke: '#9ca3af', dash: [4, 4] }), new Konva.Line({ points: [-hw, 0, -hw, -hw * entity.facing], stroke: '#374151', strokeWidth: 3 }), new Konva.Arc({ x: hw, y: 0, innerRadius: hw, outerRadius: hw, angle: 90, rotation: arcRotR, stroke: '#9ca3af', dash: [4, 4] }), new Konva.Line({ points: [hw, 0, hw, -hw * entity.facing], stroke: '#374151', strokeWidth: 3 })); 
            } else if (entity.doorType === 'sliding' || entity.doorType === 'double_sliding') { 
                const off = thick * 0.2; group.add(new Konva.Line({ points: [-hw, -off, 0, -off], stroke: '#374151', strokeWidth: 3 }), new Konva.Line({ points: [0, off, hw, off], stroke: '#374151', strokeWidth: 3 })); 
            } else if (entity.doorType === 'pocket') { 
                group.add(new Konva.Line({ points: [-hw, 0, 0, 0], stroke: '#374151', strokeWidth: 3 }), new Konva.Line({ points: [0, 0, hw, 0], stroke: '#374151', strokeWidth: 3, dash: [4,4] })); 
            } else if (entity.doorType === 'pivot') { 
                const pivotX = entity.side === 1 ? hw - 10 : -hw + 10, arcRot = entity.side === 1 ? (entity.facing===1?180:90) : (entity.facing===1?270:0); group.add(new Konva.Line({ points: [pivotX, entity.width*0.2*entity.facing, pivotX, -entity.width*0.8*entity.facing], stroke: '#374151', strokeWidth: 3 }), new Konva.Arc({ x: pivotX, y: 0, innerRadius: entity.width*0.8, outerRadius: entity.width*0.8, angle: 90, rotation: arcRot, stroke: '#9ca3af', dash: [4, 4] })); 
            } else if (entity.doorType === 'folding') { 
                const qw = entity.width / 4; group.add(new Konva.Line({ points: [-hw, 0, -hw + qw, -qw*entity.facing], stroke: '#374151', strokeWidth: 3 }), new Konva.Line({ points: [-hw + qw, -qw*entity.facing, 0, 0], stroke: '#374151', strokeWidth: 3 })); 
            }
        },
        render3D: (sceneGroup, entity, helpers) => {
            const doorGroup = new THREE.Group(); doorGroup.position.set(entity.x, 0, entity.z); doorGroup.rotation.y = -entity.angle;
            const matDoor = helpers.getDynamicMaterial(entity.doorMat, 'door'); const conf = DOOR_MATERIALS[entity.doorMat] || DOOR_MATERIALS.wood; const frameColorHex = new THREE.Color(conf.color).multiplyScalar(0.85);
            const matFrame = new THREE.MeshStandardMaterial({ color: frameColorHex, roughness: conf.roughness, metalness: conf.metalness, map: matDoor.map, bumpMap: matDoor.bumpMap, bumpScale: conf.bumpScale });
            const metalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 });
            const isGlassDoor = entity.doorMat === 'glass'; const frameWidth = 1.5; const frameThick = entity.thick + 1; const doorThick = 2.0; const gapSide = 0.15; const gapTop = 0.15; const gapBottom = 0.5; 
            const leafWidth = entity.width - (frameWidth * 2) - (gapSide * 2); const leafHeight = DOOR_HEIGHT - frameWidth - gapTop - gapBottom;
            const openAngle = (Math.PI / 4) * (entity.facing === 1 ? 1 : -1); const pivotXOffset = -entity.width/2 + frameWidth + gapSide/2; const hingePinZ = 0; 
            if (entity.doorType !== 'pocket') { 
                const jamGeo = new THREE.BoxGeometry(frameWidth, DOOR_HEIGHT, frameThick); const jamL = new THREE.Mesh(jamGeo, matFrame); jamL.position.set(-entity.width/2 + frameWidth/2, DOOR_HEIGHT/2, 0); const jamR = new THREE.Mesh(jamGeo, matFrame); jamR.position.set(entity.width/2 - frameWidth/2, DOOR_HEIGHT/2, 0); const jamT = new THREE.Mesh(new THREE.BoxGeometry(entity.width, frameWidth, frameThick), matFrame); jamT.position.set(0, DOOR_HEIGHT - frameWidth/2, 0);
                const trimStile = new THREE.BoxGeometry(4, DOOR_HEIGHT + 2, 0.5); const trimRail = new THREE.BoxGeometry(entity.width + 8, 4, 0.5);
                [-frameThick/2 - 0.25, frameThick/2 + 0.25].forEach(zOff => { const tL = new THREE.Mesh(trimStile, matFrame); tL.position.set(-entity.width/2 - 2 + frameWidth, DOOR_HEIGHT/2 + 1, zOff); const tR = new THREE.Mesh(trimStile, matFrame); tR.position.set(entity.width/2 + 2 - frameWidth, DOOR_HEIGHT/2 + 1, zOff); const tT = new THREE.Mesh(trimRail, matFrame); tT.position.set(0, DOOR_HEIGHT + 2, zOff); [tL, tR, tT].forEach(m => { m.castShadow = true; m.receiveShadow = true; doorGroup.add(m); }); });
                [jamL, jamR, jamT].forEach(m => { m.castShadow = true; m.receiveShadow = true; doorGroup.add(m); });
            }
            if (entity.doorType === 'single') {
                const panel = buildDetailedDoorPanel(leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, entity.side, helpers); const hingeHolder = new THREE.Group(); 
                if (entity.side === 1) { hingeHolder.position.set(-pivotXOffset, gapBottom, hingePinZ); panel.position.set(-leafWidth/2 - gapSide/2, 0, -hingePinZ); panel.rotation.y = Math.PI; hingeHolder.rotation.y = -openAngle; } else { hingeHolder.position.set(pivotXOffset, gapBottom, hingePinZ); panel.position.set(leafWidth/2 + gapSide/2, 0, -hingePinZ); hingeHolder.rotation.y = openAngle; } 
                hingeHolder.add(panel); doorGroup.add(hingeHolder);
            } else if (entity.doorType === 'double' || entity.doorType === 'french') {
                const hw = leafWidth / 2 - gapSide/2; const hL = new THREE.Group(); hL.position.set(pivotXOffset, gapBottom, hingePinZ); hL.rotation.y = openAngle; 
                const panelL = buildDetailedDoorPanel(hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); panelL.position.set(hw/2 + gapSide/2, 0, -hingePinZ); hL.add(panelL);
                const hR = new THREE.Group(); hR.position.set(-pivotXOffset, gapBottom, hingePinZ); hR.rotation.y = -openAngle;
                const panelR = buildDetailedDoorPanel(hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); panelR.position.set(-hw/2 - gapSide/2, 0, -hingePinZ); panelR.rotation.y = Math.PI; hR.add(panelR);
                doorGroup.add(hL, hR);
            } else if (entity.doorType === 'sliding' || entity.doorType === 'double_sliding') {
                const trackMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.5 }); const trackW = doorThick * 2.5; const trackGeo = new THREE.BoxGeometry(leafWidth, 0.5, trackW); 
                const trackT = new THREE.Mesh(trackGeo, trackMat); trackT.position.set(0, DOOR_HEIGHT - frameWidth - 0.25, 0); const trackB = new THREE.Mesh(trackGeo, trackMat); trackB.position.set(0, gapBottom - 0.25, 0); doorGroup.add(trackT, trackB);
                const overlap = 2; 
                if (entity.doorType === 'sliding') {
                    const hw = (leafWidth / 2) + (overlap / 2);
                    const pFixed = buildDetailedDoorPanel(hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); pFixed.position.set(hw/2 - overlap/2, gapBottom, -doorThick/2 - 0.1); doorGroup.add(pFixed);
                    const pSlide = buildDetailedDoorPanel(hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers); const slideAmount = hw * 0.4; pSlide.position.set(-hw/2 + overlap/2 + slideAmount, gapBottom, doorThick/2 + 0.1); doorGroup.add(pSlide);
                } else {
                    const hw = (leafWidth / 4) + (overlap / 2);
                    const pFixL = buildDetailedDoorPanel(hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 0, helpers); pFixL.position.set(-leafWidth/2 + hw/2, gapBottom, -doorThick/2 - 0.1);
                    const pFixR = buildDetailedDoorPanel(hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 0, helpers); pFixR.position.set(leafWidth/2 - hw/2, gapBottom, -doorThick/2 - 0.1);
                    const slideAmount = hw * 0.45;
                    const pSlideL = buildDetailedDoorPanel(hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers); pSlideL.position.set(-leafWidth/4 + slideAmount/2, gapBottom, doorThick/2 + 0.1); 
                    const pSlideR = buildDetailedDoorPanel(hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); pSlideR.position.set(leafWidth/4 - slideAmount/2, gapBottom, doorThick/2 + 0.1);
                    doorGroup.add(pFixL, pFixR, pSlideL, pSlideR);
                }
            } else if (entity.doorType === 'pocket') {
                const jamL = new THREE.Mesh(new THREE.BoxGeometry(frameWidth, DOOR_HEIGHT, frameThick), matFrame); jamL.position.set(-entity.width/2 + frameWidth/2, DOOR_HEIGHT/2, 0); doorGroup.add(jamL);
                const p = buildDetailedDoorPanel(leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); p.position.set(pivotXOffset - leafWidth * 0.4, gapBottom, 0); doorGroup.add(p);
            } else if (entity.doorType === 'pivot') {
                const p = buildDetailedDoorPanel(leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); const off = leafWidth * 0.15; p.position.set(leafWidth/2 - off, gapBottom, 0);
                const pivot = new THREE.Group(); const signX = entity.side === 1 ? 1 : -1; pivot.position.set(pivotXOffset + off, 0, 0); pivot.rotation.y = -openAngle * 1.2 * signX; pivot.add(p);
                const plateGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16); const floorPlate = new THREE.Mesh(plateGeo, metalMat); floorPlate.position.set(pivotXOffset + off, 0.2, 0); const topPlate = new THREE.Mesh(plateGeo, metalMat); topPlate.position.set(pivotXOffset + off, DOOR_HEIGHT - 0.2, 0); doorGroup.add(pivot, floorPlate, topPlate);
            } else if (entity.doorType === 'folding') {
                const trackGeo = new THREE.BoxGeometry(entity.width - frameWidth*2, 1.5, doorThick + 1); const track = new THREE.Mesh(trackGeo, metalMat); track.position.set(0, DOOR_HEIGHT - frameWidth/2 - 0.75, 0); doorGroup.add(track);
                const panelW = leafWidth / 2 - gapSide/2; const foldAngleBase = Math.PI / 4.5; 
                const isRightHinge = entity.side === 1; const signX = isRightHinge ? 1 : -1; const startX = isRightHinge ? -pivotXOffset : pivotXOffset; const swingDir = entity.facing === 1 ? 1 : -1; 
                const pivot1 = new THREE.Group(); pivot1.position.set(startX, gapBottom, hingePinZ * swingDir); pivot1.rotation.y = -foldAngleBase * swingDir * signX;
                const p1HingeSide = isRightHinge ? -1 : 1; const p1 = buildDetailedDoorPanel(panelW, leafHeight, doorThick, matDoor, 'folding_main', isGlassDoor, p1HingeSide, helpers); p1.position.set((panelW/2 + gapSide/2) * -signX, 0, -hingePinZ * swingDir); pivot1.add(p1);
                const pivot2 = new THREE.Group(); pivot2.position.set((panelW + gapSide) * -signX, 0, 0); pivot2.rotation.y = foldAngleBase * 2 * swingDir * signX; 
                const p2 = buildDetailedDoorPanel(panelW, leafHeight, doorThick, matDoor, 'folding_lead', isGlassDoor, p1HingeSide, helpers); p2.position.set((panelW/2 + gapSide/2) * -signX, 0, 0); pivot2.add(p2);
                const jointHingeGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 12); [leafHeight * 0.85, leafHeight * 0.5, leafHeight * 0.15].forEach(yPos => { const hingeMesh = new THREE.Mesh(jointHingeGeo, metalMat); hingeMesh.position.set(0, yPos, (doorThick/2 + 0.1) * swingDir); pivot2.add(hingeMesh); });
                const guidePin = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 8), metalMat); guidePin.position.set((panelW - 2) * -signX, leafHeight, 0); p2.add(guidePin); p1.add(pivot2); doorGroup.add(pivot1);
            }
            sceneGroup.add(doorGroup);
        }
    },
    'window': {
        widget: "window", label: "WINDOW",
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "jump_wall_to_wall", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 50, windowType: 'sliding_std', frameMat: 'alum_powder', glassMat: 'clear', grillePattern: 'grid', facing: 1, side: 1 },
        render2D: (group, entity) => {
            const hw = entity.width / 2; const thick = entity.wall.config.thickness; const wConf = WINDOW_TYPES[entity.windowType] || WINDOW_TYPES.sliding_std;
            if (wConf.type === 'fixed' || wConf.type === 'louver') { group.add(new Konva.Rect({ fill: '#bae6fd', opacity: 0.6, stroke: '#38bdf8', strokeWidth: 1, width: entity.width - 8, height: thick * 0.4, x: -hw + 4, y: -thick * 0.2 })); } 
            else if (wConf.type === 'sliding') { const off = thick * 0.2; group.add(new Konva.Line({ points: [-hw, -off, 0, -off], stroke: '#38bdf8', strokeWidth: 2 }), new Konva.Line({ points: [0, off, hw, off], stroke: '#38bdf8', strokeWidth: 2 })); } 
            else if (wConf.type === 'casement' || wConf.type === 'traditional') { const hingeX = (entity.side === 1) ? hw : -hw, arcRot = (entity.side === 1) ? ((entity.facing === 1) ? 180 : 90) : ((entity.facing === 1) ? 270 : 0); group.add(new Konva.Arc({ x: hingeX, y: 0, innerRadius: entity.width, outerRadius: entity.width, angle: 60, stroke: '#9ca3af', dash: [4, 4], rotation: arcRot }), new Konva.Line({ points: [hingeX, 0, hingeX, -entity.width * 0.8 * entity.facing], stroke: '#38bdf8', strokeWidth: 2 })); }
            else if (wConf.type === 'bay') { group.add(new Konva.Line({ points: [-hw, 0, -hw+10, -20*entity.facing, hw-10, -20*entity.facing, hw, 0], stroke: '#38bdf8', strokeWidth: 2 })); }
            if (entity.grillePattern !== 'none') { group.add(new Konva.Line({ points: [-hw, thick*0.4, hw, thick*0.4], stroke: '#ef4444', dash: [2,2] })); }
        },
        render3D: (sceneGroup, entity, helpers) => {
            const winGroup = new THREE.Group(); winGroup.position.set(entity.x, WINDOW_SILL, entity.z); winGroup.rotation.y = -entity.angle;
            const wConf = WINDOW_TYPES[entity.windowType] || WINDOW_TYPES.sliding_std;
            const matFrame = helpers.getDynamicMaterial(entity.frameMat, 'window_frame'); const matGlass = helpers.getDynamicMaterial(entity.glassMat, 'window_glass');
            const isTrad = wConf.type === 'traditional'; const isBay = wConf.type === 'bay'; const fW = isTrad ? 5 : 3; const fThick = entity.thick + (isTrad ? 4 : 1); const zOffset = isBay ? 12 : 0; 
            const matGrille = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 }); const matConcrete = new THREE.MeshStandardMaterial({ color: 0xd4d4d4, roughness: 1.0 });
            const outStile = new THREE.BoxGeometry(fW, WINDOW_HEIGHT, fThick); const outRail = new THREE.BoxGeometry(entity.width - fW*2, fW, fThick);
            const sl = new THREE.Mesh(outStile, matFrame); sl.position.set(-entity.width/2 + fW/2, WINDOW_HEIGHT/2, zOffset); const sr = new THREE.Mesh(outStile, matFrame); sr.position.set(entity.width/2 - fW/2, WINDOW_HEIGHT/2, zOffset);
            const rt = new THREE.Mesh(outRail, matFrame); rt.position.set(0, WINDOW_HEIGHT - fW/2, zOffset); const rb = new THREE.Mesh(outRail, matFrame); rb.position.set(0, fW/2, zOffset);
            [sl, sr, rt, rb].forEach(m => { m.castShadow = true; m.receiveShadow = true; winGroup.add(m); });
            const iW = entity.width - fW*2; const iH = WINDOW_HEIGHT - fW*2; const sThick = entity.thick * 0.6;
            const makeSash = (w, h, useGlass=true) => {
                const sG = new THREE.Group(); const sFw = isTrad ? 4 : 2.5; const geoS = new THREE.BoxGeometry(sFw, h, sThick); const geoR = new THREE.BoxGeometry(w - sFw*2, sFw, sThick);
                const s1 = new THREE.Mesh(geoS, matFrame); s1.position.set(-w/2 + sFw/2, h/2, 0); const s2 = new THREE.Mesh(geoS, matFrame); s2.position.set(w/2 - sFw/2, h/2, 0);
                const r1 = new THREE.Mesh(geoR, matFrame); r1.position.set(0, h - sFw/2, 0); const r2 = new THREE.Mesh(geoR, matFrame); r2.position.set(0, sFw/2, 0);
                [s1, s2, r1, r2].forEach(m => { m.castShadow = true; m.receiveShadow = true; sG.add(m); });
                if (useGlass) { const glass = new THREE.Mesh(new THREE.BoxGeometry(w - sFw*2, h - sFw*2, sThick*0.3), matGlass); glass.position.set(0, h/2, 0); sG.add(glass); } 
                else { const woodPanel = new THREE.Mesh(new THREE.BoxGeometry(w - sFw*2, h - sFw*2, sThick*0.5), matFrame); woodPanel.position.set(0, h/2, 0); sG.add(woodPanel); }
                return sG;
            };
            if (wConf.type === 'fixed') { const sash = makeSash(iW, iH); sash.position.set(0, fW, zOffset); winGroup.add(sash); } 
            else if (wConf.type === 'casement' || wConf.type === 'traditional') {
                const hw = iW / 2; const useGlass = wConf.type !== 'traditional';
                const sL = makeSash(hw, iH, useGlass); const pL = new THREE.Group(); pL.position.set(-iW/2, fW, zOffset); sL.position.set(hw/2, 0, 0); pL.rotation.y = (Math.PI / 4) * entity.facing; pL.add(sL);
                const sR = makeSash(hw, iH, useGlass); const pR = new THREE.Group(); pR.position.set(iW/2, fW, zOffset); sR.position.set(-hw/2, 0, 0); pR.rotation.y = -(Math.PI / 4) * entity.facing; pR.add(sR); winGroup.add(pL, pR);
            } else if (wConf.type === 'sliding') {
                const overlap = 2; const panes = 2; const hw = (iW / panes) + (overlap/2);
                for(let i=0; i<panes; i++) { const sash = makeSash(hw, iH); const zOff = (i % 2 === 0) ? sThick/2 + 0.1 : -sThick/2 - 0.1; let xPos = -iW/2 + hw/2 + (i * (hw - overlap)); if (i === panes - 1) xPos -= hw * 0.3 * entity.facing; sash.position.set(xPos, fW, zOffset + zOff); winGroup.add(sash); }
            } else if (wConf.type === 'louver') { const slatH = 5; const count = Math.floor(iH / (slatH - 0.5)); for(let i=0; i<count; i++) { const slat = new THREE.Mesh(new THREE.BoxGeometry(iW - 1, slatH, 0.5), matGlass); slat.position.set(0, fW + (i * (slatH - 0.5)) + slatH/2, 0); slat.rotation.x = Math.PI / 6; winGroup.add(slat); } }
            else if (wConf.type === 'bay') {
                const frontW = iW * 0.6; const frontSash = makeSash(frontW, iH); frontSash.position.set(0, fW, zOffset); winGroup.add(frontSash);
                const sideW = Math.hypot(iW*0.2, zOffset); const sideAng = Math.atan2(zOffset, iW*0.2);
                const sL = makeSash(sideW, iH); sL.position.set(-iW/2 + (iW*0.2)/2, fW, zOffset/2); sL.rotation.y = -sideAng; winGroup.add(sL); const sR = makeSash(sideW, iH); sR.position.set(iW/2 - (iW*0.2)/2, fW, zOffset/2); sR.rotation.y = sideAng; winGroup.add(sR);
                const capShape = new THREE.Shape(); capShape.moveTo(-iW/2 - fW, 0); capShape.lineTo(iW/2 + fW, 0); capShape.lineTo(frontW/2 + fW, zOffset + fThick/2); capShape.lineTo(-frontW/2 - fW, zOffset + fThick/2);
                const capGeo = new THREE.ExtrudeGeometry(capShape, {depth: fW, bevelEnabled:false}); capGeo.rotateX(Math.PI/2); const capT = new THREE.Mesh(capGeo, matFrame); capT.position.set(0, WINDOW_HEIGHT, 0); const capB = new THREE.Mesh(capGeo, matFrame); capB.position.set(0, fW, 0); winGroup.add(capT, capB);
            }
            if (entity.grillePattern && entity.grillePattern !== 'none') {
                const grilleGroup = new THREE.Group(); const grilleZ = entity.facing === 1 ? fThick/2 - 0.5 : -fThick/2 + 0.5; grilleGroup.position.set(0, 0, grilleZ); const barRadius = 0.3;
                const makeVBar = (x) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(barRadius, barRadius, iH + 2, 8), matGrille); b.position.set(x, WINDOW_HEIGHT/2, 0); return b; }; const makeHBar = (y) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(barRadius, barRadius, iW + 2, 8), matGrille); b.rotation.z = Math.PI/2; b.position.set(0, y, 0); return b; };
                if (entity.grillePattern === 'vertical' || entity.grillePattern === 'grid') { for (let i = -iW/2 + 5; i < iW/2; i += 5) { grilleGroup.add(makeVBar(i)); } }
                if (entity.grillePattern === 'horizontal' || entity.grillePattern === 'grid') { for (let j = fW + 6; j < WINDOW_HEIGHT - fW; j += 6) { grilleGroup.add(makeHBar(j)); } }
                if (entity.grillePattern === 'diamond') { const dGroup = new THREE.Group(); const maxDim = Math.max(iW, iH) * 1.5; for (let i = -maxDim/2; i <= maxDim/2; i += 6) { const v = new THREE.Mesh(new THREE.CylinderGeometry(barRadius, barRadius, maxDim, 8), matGrille); v.position.set(i, 0, 0); dGroup.add(v); const h = new THREE.Mesh(new THREE.CylinderGeometry(barRadius, barRadius, maxDim, 8), matGrille); h.rotation.z = Math.PI/2; h.position.set(0, i, 0); dGroup.add(h); } dGroup.rotation.z = Math.PI / 4; dGroup.position.set(0, WINDOW_HEIGHT/2, 0); grilleGroup.add(dGroup); }
                winGroup.add(grilleGroup);
            }
            if (wConf.hasChajja) { const chajjaDepth = 15; const chajjaHeight = 2; const chajjaGeo = new THREE.BoxGeometry(entity.width + 10, chajjaHeight, chajjaDepth); const chajja = new THREE.Mesh(chajjaGeo, matConcrete); const cZ = entity.facing === 1 ? chajjaDepth/2 : -chajjaDepth/2; chajja.position.set(0, WINDOW_HEIGHT + chajjaHeight/2, cZ); chajja.castShadow = true; winGroup.add(chajja); }
            sceneGroup.add(winGroup);
        }
    }
};
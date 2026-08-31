import * as THREE from 'three';
import { Molding3DBuilder } from '../../core/engine3d/Molding3DBuilder.js';
export const WALL_REGISTRY = {
    'outer': { type: "outer", label: "OUTER WALL", thickness: 16, height: 120, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] },
    'inner': { type: "inner", label: "INNER WALL", thickness: 8, height: 120, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] },
    'compound': { type: "compound", label: "COMPOUND WALL", thickness: 12, height: 80, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] },
    'arc': { type: "arc", label: "CURVED WALL", thickness: 10, height: 120, events: ["proximity_highlight", "snap_preview", "snap_to_wall"] },
    'railing': { type: "railing", label: "RAILING", thickness: 4, height: 0, events: ["proximity_highlight", "snap_preview", "snap_to_wall"] },
    'room_box': { type: "room_box", label: "WALL ROOM (RECTANGLE)", thickness: 16, height: 120, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] }
};

export const MOLDING_REGISTRY = {
    // Baseboards & Skirting
    'molding_skirting_flat': { type: 'molding_skirting_flat', label: 'Flat Modern Baseboard', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2, heightOffset: 0, moldingHeight: 12, profileType: 'skirting_flat', material: 'white_paint', color: '#ffffff' } },
    'molding_skirting_beveled': { type: 'molding_skirting_beveled', label: 'Chamfered Baseboard', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2, heightOffset: 0, moldingHeight: 12, profileType: 'skirting_beveled', material: 'wood_white_oak', color: '#ffffff' } },
    'molding_skirting_torus': { type: 'molding_skirting_torus', label: 'Torus / Bullnose Skirting', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2.2, heightOffset: 0, moldingHeight: 14, profileType: 'skirting_torus', material: 'wood_golden_teak', color: '#ffffff' } },
    'molding_skirting_ogee': { type: 'molding_skirting_ogee', label: 'Classic Ogee Skirting', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2.5, heightOffset: 0, moldingHeight: 15, profileType: 'skirting_ogee', material: 'wood_dark', color: '#ffffff' } },
    'molding_skirting_craftsman': { type: 'molding_skirting_craftsman', label: 'Stepped Craftsman Skirting', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2.2, heightOffset: 0, moldingHeight: 14, profileType: 'skirting_craftsman', material: 'wood_dark', color: '#ffffff' } },
    'molding_skirting_shadow': { type: 'molding_skirting_shadow', label: 'Shadow Gap / Reglet Skirting', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2, heightOffset: 0, moldingHeight: 10, profileType: 'skirting_shadow', material: 'black_metal', color: '#111111' } },
    'molding_skirting_scotia': { type: 'molding_skirting_scotia', label: 'Scotia Cove Baseboard', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2, heightOffset: 0, moldingHeight: 10, profileType: 'skirting_scotia', material: 'white_paint', color: '#ffffff' } },
    'molding_skirting_shoe': { type: 'molding_skirting_shoe', label: 'Quarter Round Shoe Trim', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 1.8, heightOffset: 0, moldingHeight: 3, profileType: 'skirting_shoe', material: 'white_paint', color: '#ffffff' } },

    // Crown Moldings, Cornices, & Trims
    'molding_band': { type: 'molding_band', label: 'Horizontal Band', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 3, heightOffset: 50, moldingHeight: 10, profileType: 'flat', material: 'white_paint', color: '#ffffff' } },
    'molding_crown': { type: 'molding_crown', label: 'Crown Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 5, heightOffset: 110, moldingHeight: 10, profileType: 'crown', material: 'white_paint', color: '#ffffff' } },
    'molding_ogee': { type: 'molding_ogee', label: 'Ogee (Cyma) Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 6, heightOffset: 110, moldingHeight: 10, profileType: 'ogee', material: 'white_paint', color: '#ffffff' } },
    'molding_egg_and_dart': { type: 'molding_egg_and_dart', label: 'Egg and Dart Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 6, heightOffset: 110, moldingHeight: 10, profileType: 'egg_and_dart', material: 'white_paint', color: '#ffffff' } },
    'molding_dentil': { type: 'molding_dentil', label: 'Dentil Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 6, heightOffset: 110, moldingHeight: 10, profileType: 'dentil', material: 'white_paint', color: '#ffffff' } },
    'molding_craftsman': { type: 'molding_craftsman', label: 'Step / Craftsman Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 6, heightOffset: 110, moldingHeight: 10, profileType: 'craftsman', material: 'white_paint', color: '#ffffff' } },
    'molding_window': { type: 'molding_window', label: 'Window Frame', events: ['snap_to_wall', 'drag_along_wall'], defaultConfig: { width: 45, depth: 4, heightOffset: 35, moldingHeight: 5, profileType: 'frame', material: 'white_paint', color: '#ffffff', frameWidth: 5 } },
    'molding_door': { type: 'molding_door', label: 'Door Frame', events: ['snap_to_wall', 'drag_along_wall'], defaultConfig: { width: 40, depth: 4, heightOffset: 0, moldingHeight: 5, profileType: 'frame', material: 'white_paint', color: '#ffffff', frameWidth: 5 } },
    'molding_groove': { type: 'molding_groove', label: 'Decorative Groove', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: -2, heightOffset: 50, moldingHeight: 2, profileType: 'groove', material: 'wall_material', color: '#000000', grooveWidth: 2 } },
    'molding_layered': { type: 'molding_layered', label: 'Layered Projection', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 5, heightOffset: 50, moldingHeight: 10, profileType: 'layered', material: 'white_paint', color: '#ffffff', layers: 3, layerGap: 1 } }
};

// Aliases for direct skirting tool IDs
[
    'skirting_flat', 'skirting_beveled', 'skirting_torus', 'skirting_ogee', 
    'skirting_craftsman', 'skirting_shadow', 'skirting_scotia', 'skirting_shoe'
].forEach(k => {
    MOLDING_REGISTRY[k] = MOLDING_REGISTRY['molding_' + k];
});

Object.keys(MOLDING_REGISTRY).forEach(key => {
    MOLDING_REGISTRY[key].render3D = (sceneGroup, entity, helpers) => {
        const moldBuilder = new Molding3DBuilder();
        const moldData = { ...(MOLDING_REGISTRY[key]?.defaultConfig || {}), ...(entity?.params || entity || {}) };
        const length = 36; // Emphasize profile in 3D thumbnail preview
        const moldGroup = moldBuilder.buildMolding({ ...moldData, width: length, depth: moldData.depth, type: key }, length, 10, helpers);
        
        // 3D Isometric Catalog Preview Angle
        moldGroup.rotation.y = Math.PI / 4.5; 
        moldGroup.rotation.x = Math.PI / 14;

        const glossyMat = new THREE.MeshStandardMaterial({
            color: moldData.material === 'wood_dark' ? 0x4a3b32 : (moldData.material === 'black_metal' ? 0x222222 : 0xf1f5f9),
            roughness: 0.4,
            metalness: 0.1
        });
        moldGroup.traverse(child => {
            if (child.isMesh) child.material = glossyMat;
        });

        sceneGroup.add(moldGroup);
        return moldGroup;
    };
});

['outer', 'inner', 'compound', 'arc', 'room_box'].forEach(key => {
    if (WALL_REGISTRY[key]) {
        WALL_REGISTRY[key].render3D = (sceneGroup, entity, helpers) => {
            if (key === 'room_box') {
                const group = new THREE.Group();
                const w = 80, d = 80, h = 60, t = 8;
                const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
                // 4 walls
                const w1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mat);
                w1.position.set(0, h / 2, -d / 2);
                const w2 = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mat);
                w2.position.set(0, h / 2, d / 2);
                const w3 = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), mat);
                w3.position.set(-w / 2, h / 2, 0);
                const w4 = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), mat);
                w4.position.set(w / 2, h / 2, 0);
                const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide }));
                floor.rotation.x = -Math.PI / 2;
                floor.position.y = 0.5;
                group.add(w1, w2, w3, w4, floor);
                group.rotation.y = Math.PI / 4;
                group.rotation.x = Math.PI / 12;
                sceneGroup.add(group);
                return group;
            }
            const w = 100, h = 100, d = 10;
            let geo;
            if (key === 'arc') geo = new THREE.CylinderGeometry(100, 100, h, 32, 1, false, 0, Math.PI / 2);
            else geo = new THREE.BoxGeometry(w, h, d);
            const wallColor = key === 'outer' ? 0xffffff : (key === 'compound' ? 0xe2e8f0 : 0xeeeeee);
            const wallMat = new THREE.MeshStandardMaterial({ color: wallColor });
            const mesh = new THREE.Mesh(geo, wallMat);
            sceneGroup.add(mesh);
            return mesh;
        };
    }
});

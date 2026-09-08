import * as THREE from 'three';
import { Molding3DBuilder } from '../../core/engine3d/Molding3DBuilder.js';
export { WallFactory } from './wall.factory.js';
export const WALL_REGISTRY = {
    'outer': { type: "outer", label: "OUTER WALL", thickness: 16, height: 120, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] },
    'inner': { type: "inner", label: "INNER WALL", thickness: 8, height: 120, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] },
    'compound': { type: "compound", label: "COMPOUND WALL", thickness: 12, height: 80, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] },
    'arc': { type: "arc", label: "CURVED WALL", thickness: 10, height: 120, events: ["proximity_highlight", "snap_preview", "snap_to_wall"] },
    'railing': { type: "railing", label: "RAILING", thickness: 4, height: 0, events: ["proximity_highlight", "snap_preview", "snap_to_wall"] },
    'room_box': { type: "room_box", label: "WALL ROOM (RECTANGLE)", thickness: 16, height: 120, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] },
    'foundation': { type: "foundation", label: "FOUNDATION WALL", thickness: 24, height: 40, material: "stone_ashlar_grey", events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] },
    'foundation_box': { type: "foundation_box", label: "FOUNDATION ROOM (BOX)", thickness: 24, height: 40, material: "stone_ashlar_grey", events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] },
    'half_wall': { type: "half_wall", label: "HALF WALL / PARAPET", thickness: 10, height: 50, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] }
};

export { MOLDING_REGISTRY, MOLDING_PROFILES, MOLDING_CATALOG } from '../molding/molding.registry.js';



['outer', 'inner', 'compound', 'arc', 'room_box', 'foundation', 'foundation_box', 'half_wall'].forEach(key => {
    if (WALL_REGISTRY[key]) {
        WALL_REGISTRY[key].render3D = (sceneGroup, entity, helpers) => {
            if (key === 'room_box' || key === 'foundation_box') {
                const group = new THREE.Group();
                const w = 80, d = 80, h = key === 'foundation_box' ? 30 : 60, t = key === 'foundation_box' ? 12 : 8;
                const matColor = key === 'foundation_box' ? 0x94a3b8 : 0xffffff;
                const mat = new THREE.MeshStandardMaterial({ color: matColor, roughness: 0.8 });
                // 4 walls
                const w1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mat);
                w1.position.set(0, h / 2, -d / 2);
                const w2 = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mat);
                w2.position.set(0, h / 2, d / 2);
                const w3 = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), mat);
                w3.position.set(-w / 2, h / 2, 0);
                const w4 = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), mat);
                w4.position.set(w / 2, h / 2, 0);
                const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x64748b, side: THREE.DoubleSide }));
                floor.rotation.x = -Math.PI / 2;
                floor.position.y = 0.5;
                group.add(w1, w2, w3, w4, floor);
                group.rotation.y = Math.PI / 4;
                group.rotation.x = Math.PI / 12;
                sceneGroup.add(group);
                return group;
            }
            const w = 100;
            const h = key === 'foundation' ? 40 : (key === 'half_wall' ? 50 : 100);
            const d = key === 'foundation' ? 24 : (key === 'half_wall' ? 10 : (key === 'compound' ? 12 : 16));
            let geo;
            if (key === 'arc') geo = new THREE.CylinderGeometry(100, 100, h, 32, 1, false, 0, Math.PI / 2);
            else geo = new THREE.BoxGeometry(w, h, d);
            
            const wallColor = key === 'outer' ? 0xffffff : (key === 'foundation' ? 0x94a3b8 : (key === 'half_wall' ? 0xf1f5f9 : (key === 'compound' ? 0xe2e8f0 : 0xeeeeee)));
            const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.8 });
            const mesh = new THREE.Mesh(geo, wallMat);

            if (key === 'half_wall') {
                // Add top coping cap
                const capGeo = new THREE.BoxGeometry(w + 2, 3, d + 4);
                const capMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
                const capMesh = new THREE.Mesh(capGeo, capMat);
                capMesh.position.y = h / 2 + 1.5;
                const group = new THREE.Group();
                mesh.position.y = h / 2;
                group.add(mesh, capMesh);
                sceneGroup.add(group);
                return group;
            }

            mesh.position.y = h / 2;
            sceneGroup.add(mesh);
            return mesh;
        };
    }
});

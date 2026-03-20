import * as THREE from 'three';
import { Wall3DBuilder } from './Wall3DBuilder.js';

export class ActiveFloor {
    constructor(decorManager, interactables, structureGroup) {
        this.decorManager = decorManager;
        this.interactables = interactables;
        this.structureGroup = structureGroup;
        this.wallBuilder = new Wall3DBuilder();
        this.matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 });
    }

    build(walls, roomPaths) {
        this._buildSlabs(roomPaths);
        
        const anchorMap = new Map();

        walls.forEach(w => {
            const p1 = w.startAnchor.position(); const p2 = w.endAnchor.position();
            const dx = p2.x - p1.x; const dz = p2.y - p1.y;
            const length = Math.hypot(dx, dz); const angle = Math.atan2(dz, dx);
            w.length3D = length;

            // Generate Wall Mesh
            const { wallGroup } = this.wallBuilder.buildWallGroup(length, w.config.thickness, w.attachedWidgets, p1.x, p1.y, angle);
            wallGroup.userData = { entity: w };
            w.mesh3D = wallGroup;

            // Generate Hitboxes
            const hitboxes = this.wallBuilder.createHitboxes(length, w.config.thickness, w);
            hitboxes.forEach(hb => {
                wallGroup.add(hb);
                this.interactables.push(hb);
            });

            this.structureGroup.add(wallGroup);

            // Load Decors
            if (w.attachedDecor) w.attachedDecor.forEach(decor => this.decorManager.load(w, decor));

            // Map Joints
            [w.startAnchor, w.endAnchor].forEach(a => {
                const data = anchorMap.get(a) || { thickness: 0 };
                if (w.config.thickness > data.thickness) data.thickness = w.config.thickness;
                anchorMap.set(a, data);
            });
        });

        // Build Corner Joints
        anchorMap.forEach((data, anchor) => {
            const pos = anchor.position();
            this.structureGroup.add(this.wallBuilder.createJoint(pos.x, pos.y, data.thickness));
        });
    }

    _buildSlabs(roomPaths) {
        roomPaths.forEach(path => {
            const floorShape = new THREE.Shape();
            floorShape.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) floorShape.lineTo(path[i].x, path[i].y);
            
            const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 10, bevelEnabled: false });
            floorGeo.rotateX(Math.PI / 2);
            const floorMesh = new THREE.Mesh(floorGeo, this.matFloor);
            floorMesh.receiveShadow = true;
            this.structureGroup.add(floorMesh);
        });
    }
}
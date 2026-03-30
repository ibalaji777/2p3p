import * as THREE from 'three';
import { Wall3DBuilder } from './Wall3DBuilder.js';
import { WALL_HEIGHT, ROOF_DECOR_REGISTRY } from '../registry.js';

export class ActiveFloor {
    constructor(decorManager, interactables, structureGroup) {
        this.decorManager = decorManager;
        this.interactables = interactables;
        this.structureGroup = structureGroup;
        this.wallBuilder = new Wall3DBuilder();
        this.matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 });
    }

    build(walls, roomPaths, roofs, activeIndex = 0) {
        this._buildSlabs(roomPaths);
        
        const hasWalls = walls && walls.length > 0;
        if (roofs) this._buildRoofs(roofs, activeIndex, hasWalls);
        
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

    _buildRoofs(roofs, activeIndex, hasWalls) {
        roofs.forEach(roof => {
            const pts = roof.points || [];
            if (pts.length < 3) return;

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            pts.forEach(p => {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            });

            const conf = roof.config || {};
            const overhang = conf.overhang || 0;
            const wallGap = conf.wallGap || 0;
            const wallOffset = 8; // Expands base to outer wall edges to prevent wall poking

            const W = (maxX - minX) + (wallOffset * 2) + (overhang * 2);
            const D = (maxY - minY) + (wallOffset * 2) + (overhang * 2);
            const cx = minX + (maxX - minX) / 2;
            const cz = minY + (maxY - minY) / 2;
            
            // Auto-detect: if no walls exist here, roof mathematically caps the floor below
            const baseHeight = (hasWalls || activeIndex === 0) ? WALL_HEIGHT : 0;
            const h = baseHeight + wallGap; 

            const decor = ROOF_DECOR_REGISTRY[conf.material] || ROOF_DECOR_REGISTRY['asphalt_shingles'];
            const tex = new THREE.TextureLoader().load(decor.texture);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            const repeatScale = decor.repeat || 1;
            tex.repeat.set(W / (100 * repeatScale), D / (100 * repeatScale));
            const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide });

            let mesh;
            if (conf.roofType === 'flat') {
                const geo = new THREE.BoxGeometry(W, conf.thickness || 2, D);
                mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(cx, (conf.thickness || 2)/2, cz);
            } else {
                const pitch = conf.pitch || 30;
                const drop = Math.tan(pitch * Math.PI / 180) * overhang;
                const rh = Math.tan(pitch * Math.PI / 180) * (Math.min(W, D) / 2);
                
                const p1 = [cx - W/2, -drop, cz - D/2];
                const p2 = [cx + W/2, -drop, cz - D/2];
                const p3 = [cx + W/2, -drop, cz + D/2];
                const p4 = [cx - W/2, -drop, cz + D/2];

                const v = [], uv = [];
                if (W >= D) {
                    const r1 = [cx - (W - D)/2, rh - drop, cz];
                    const r2 = [cx + (W - D)/2, rh - drop, cz];
                    v.push(...p4, ...p3, ...r2, ...p4, ...r2, ...r1); uv.push(0,0, 1,0, 0.75,1, 0,0, 0.75,1, 0.25,1);
                    v.push(...p3, ...p2, ...r2); uv.push(0,0, 1,0, 0.5,1);
                    v.push(...p2, ...p1, ...r1, ...p2, ...r1, ...r2); uv.push(0,0, 1,0, 0.75,1, 0,0, 0.75,1, 0.25,1);
                    v.push(...p1, ...p4, ...r1); uv.push(0,0, 1,0, 0.5,1);
                } else {
                    const r1 = [cx, rh - drop, cz - (D - W)/2];
                    const r2 = [cx, rh - drop, cz + (D - W)/2];
                    v.push(...p4, ...p3, ...r2); uv.push(0,0, 1,0, 0.5,1);
                    v.push(...p3, ...p2, ...r1, ...p3, ...r1, ...r2); uv.push(0,0, 1,0, 0.75,1, 0,0, 0.75,1, 0.25,1);
                    v.push(...p2, ...p1, ...r1); uv.push(0,0, 1,0, 0.5,1);
                    v.push(...p1, ...p4, ...r2, ...p1, ...r2, ...r1); uv.push(0,0, 1,0, 0.75,1, 0,0, 0.75,1, 0.25,1);
                }

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
                geo.computeVertexNormals();
                mesh = new THREE.Mesh(geo, mat);
            }

            const roofGroup = new THREE.Group();
            roofGroup.position.set(roof.group.x(), h, roof.group.y());
            roofGroup.rotation.y = -roof.rotation * Math.PI / 180; 
            
            mesh.castShadow = true; mesh.receiveShadow = true;
            mesh.userData = { entity: roof, isRoof: true };
            roofGroup.add(mesh);

            this.structureGroup.add(roofGroup);
            this.interactables.push(mesh);
        });
    }
}
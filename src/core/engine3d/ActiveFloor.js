import * as THREE from 'three';
import { Wall3DBuilder } from './Wall3DBuilder.js';
import { RailingBuilder } from './RailingBuilder.js';
import { WALL_HEIGHT, ROOF_DECOR_REGISTRY, FLOOR_REGISTRY, WIDGET_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS } from '../registry.js';

export class ActiveFloor {
    constructor(assets, decorManager, interactables, structureGroup) {
        this.decorManager = decorManager;
        this.interactables = interactables;
        this.structureGroup = structureGroup;
        this.wallBuilder = new Wall3DBuilder();
        this.railingBuilder = new RailingBuilder(assets, interactables, structureGroup);
        this.matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7, side: THREE.DoubleSide });
        
        this.helpers = {
            getDynamicMaterial: (matId, category) => {
                let conf;
                if (category === 'door') conf = DOOR_MATERIALS[matId] || DOOR_MATERIALS.wood;
                else if (category === 'window_frame') conf = WINDOW_FRAME_MATERIALS[matId] || WINDOW_FRAME_MATERIALS.alum_powder;
                else if (category === 'window_glass') conf = WINDOW_GLASS_MATERIALS[matId] || WINDOW_GLASS_MATERIALS.clear;
                
                if (!conf) return new THREE.MeshStandardMaterial();
                
                return new THREE.MeshStandardMaterial({
                    color: conf.color,
                    roughness: conf.roughness !== undefined ? conf.roughness : 0.5,
                    metalness: conf.metalness !== undefined ? conf.metalness : 0.1,
                    transmission: conf.transmission || 0,
                    ior: conf.ior || 1.5,
                    transparent: conf.transparent || false,
                    opacity: conf.transmission ? (1 - conf.transmission) : 1
                });
            }
        };
    }

    build(walls, rooms, roofs, shapes, activeIndex = 0) {
        this._buildSlabs(rooms);

        const hasWalls = walls && walls.length > 0;
        let maxWallHeight = WALL_HEIGHT;
        if (hasWalls) {
            maxWallHeight = Math.max(...walls.map(w => w.height || w.config?.height || WALL_HEIGHT));
        }

        if (roofs) this._buildRoofs(roofs, activeIndex, hasWalls, maxWallHeight);        
        if (shapes) this._buildShapes(shapes);

        const standardWalls = walls.filter(w => w.type !== 'railing');
        const railingWalls = walls.filter(w => w.type === 'railing');

        standardWalls.forEach(w => {
            const p1 = w.startAnchor.position(); const p2 = w.endAnchor.position();
            const dx = p2.x - p1.x; const dz = p2.y - p1.y;
            const length = Math.hypot(dx, dz); const angle = Math.atan2(dz, dx);
            w.length3D = length;

            // Generate Wall Mesh
            const wallHeight = w.height || w.config?.height || WALL_HEIGHT;
            const wallThickness = w.thickness || w.config?.thickness || 20;
            const { wallGroup } = this.wallBuilder.buildWallGroup(length, wallThickness, w, p1.x, p1.y, angle, wallHeight);
            wallGroup.userData = { entity: w };
            w.mesh3D = wallGroup;

            // Render Widgets (Doors & Windows)
            if (w.attachedWidgets) {
                w.attachedWidgets.forEach(widg => {
                    const wCenter = length * widg.t;
                    const widgEntity = {
                        ...widg,
                        x: p1.x + Math.cos(angle) * wCenter,
                        z: p1.y + Math.sin(angle) * wCenter,
                        angle: angle,
                        thick: wallThickness
                    };
                    const type = widg.type || widg.configId;
                    if (WIDGET_REGISTRY[type] && WIDGET_REGISTRY[type].render3D) {
                        WIDGET_REGISTRY[type].render3D(this.structureGroup, widgEntity, this.helpers);
                    }
                });
            }

            // Generate Hitboxes
            const hitboxes = this.wallBuilder.createHitboxes(length, wallThickness, w, false, 0, 0, wallHeight);
            hitboxes.forEach(hb => {
                wallGroup.add(hb);
                this.interactables.push(hb);
            });

            this.structureGroup.add(wallGroup);

            // Load Decors
            if (w.attachedDecor) w.attachedDecor.forEach(decor => this.decorManager.load(w, decor));
        });

        this.railingBuilder.build(railingWalls, standardWalls);
    }

    _buildShapes(shapes) {
        if (!shapes) return;
        shapes.forEach(shapeData => {
            let geo;
            const w = shapeData.width || 40;
            const d = shapeData.depth || 40;
            const h = shapeData.height || 120;
            const type = shapeData.type || shapeData.shapeType || 'shape_rect';
            
            if (type === 'shape_circle') {
                geo = new THREE.CylinderGeometry(shapeData.params.radius, shapeData.params.radius, h, 32);
            } else if (type === 'shape_polygon' || type === 'shape_triangle') {
                const shape2d = new THREE.Shape();
                if (shapeData.params.points && shapeData.params.points.length >= 3) {
                    const pts = shapeData.params.points;
                    shape2d.moveTo(pts[0].x, pts[0].y);
                    for(let i=1; i<pts.length; i++) shape2d.lineTo(pts[i].x, pts[i].y);
                    shape2d.lineTo(pts[0].x, pts[0].y);
                    geo = new THREE.ExtrudeGeometry(shape2d, { depth: h, bevelEnabled: false });
                    geo.rotateX(Math.PI / 2);
                }
            } else if (type === 'shape_rect') {
                geo = new THREE.BoxGeometry(shapeData.params.width, h, shapeData.params.height);
            }
            // Correctly elevate the shapes to sit flat onto the base plane
            geo.translate(0, h / 2, 0);

            const color = shapeData.params?.fill ? parseInt(shapeData.params.fill.replace('#', '0x')) : 0xfcd34d;
            const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 });
            const mesh = new THREE.Mesh(geo, mat);
            
            const groupX = shapeData.group ? shapeData.group.x() : shapeData.x;
            const groupZ = shapeData.group ? shapeData.group.y() : shapeData.y;
            const rot = shapeData.rotation || 0;
            const elevation = shapeData.elevation || 0;

            mesh.position.set(groupX, elevation, groupZ);
            mesh.rotation.y = -rot * Math.PI / 180;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Create invisible hitbox for perfect mouse raycasting & highlighting
            const hitBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
            hitBox.position.set(0, h / 2, 0);
            hitBox.userData = { isHitbox: true };
            mesh.add(hitBox);

            mesh.userData = { isFurniture: true, entity: shapeData, originalSize: new THREE.Vector3(w, h, d), isShape: true };
            shapeData.mesh3D = mesh;

            this.interactables.push(mesh);
            this.interactables.push(hitBox);
            this.structureGroup.add(mesh);
        });
    }

    _buildSlabs(rooms) {
        if (!rooms) return;
        rooms.forEach(room => {
            const path = room.path;
            if (!path || path.length < 3) return;
            const floorShape = new THREE.Shape();
            floorShape.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) floorShape.lineTo(path[i].x, path[i].y);
            
                        const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 2, bevelEnabled: false });
                        floorGeo.rotateX(Math.PI / 2);
                        floorGeo.translate(0, 0.2, 0);
            
            let mat = this.matFloor;
            const configId = room.configId || 'hardwood';
            const floorConfig = FLOOR_REGISTRY[configId];
            if (floorConfig && floorConfig.texture) {
                const tex = new THREE.TextureLoader().load(floorConfig.texture);
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                const repeatScale = floorConfig.repeat || 1;
                // Use a default size for calculating UV repeat if not specified, 100 is typically 1 unit in 3D
                tex.repeat.set(1 / (100 * repeatScale), 1 / (100 * repeatScale));
                mat = new THREE.MeshStandardMaterial({ map: tex, roughness: floorConfig.roughness !== undefined ? floorConfig.roughness : 0.8, color: floorConfig.color || 0xffffff, side: THREE.DoubleSide });
            } else if (floorConfig && floorConfig.color) {
                mat = new THREE.MeshStandardMaterial({ color: floorConfig.color, roughness: floorConfig.roughness !== undefined ? floorConfig.roughness : 0.8, side: THREE.DoubleSide });
            }

            const floorMesh = new THREE.Mesh(floorGeo, mat);
            floorMesh.receiveShadow = true;
            floorMesh.userData = { entity: room, isRoom: true };
            this.interactables.push(floorMesh);
            this.structureGroup.add(floorMesh);
        });
    }

    _buildRoofs(roofs, activeIndex, hasWalls, maxWallHeight = WALL_HEIGHT) {
        roofs.forEach(roof => {
            const pts = roof.points || [];
            if (pts.length < 3) return;

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            pts.forEach(p => {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            });

            const conf = roof.config || {};
            const wallGap = conf.wallGap || 0;
            
            const W = maxX - minX;
            const D = maxY - minY;
            
            // Auto-detect: if no walls exist here, roof mathematically caps the floor below
            const baseHeight = (hasWalls || activeIndex === 0) ? maxWallHeight : 0;
            const h = baseHeight + wallGap + 0.5; // +0.5 prevents z-fighting with top of the walls

            const decor = ROOF_DECOR_REGISTRY[conf.material] || ROOF_DECOR_REGISTRY['asphalt_shingles'];
            const tex = new THREE.TextureLoader().load(decor.texture);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            const repeatScale = decor.repeat || 1;
            tex.repeat.set(W / (100 * repeatScale), D / (100 * repeatScale));
            const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide });

            let mesh;
            if (conf.roofType === 'flat') {
                const shape = new THREE.Shape();
                shape.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
                shape.lineTo(pts[0].x, pts[0].y);
                
                const geo = new THREE.ExtrudeGeometry(shape, { depth: conf.thickness || 2, bevelEnabled: false });
                geo.rotateX(Math.PI / 2);
                geo.translate(0, conf.thickness || 2, 0); // Flat roofs rest perfectly flush
                mesh = new THREE.Mesh(geo, mat);
            } else {
                const pitch = conf.pitch || 30;
                const maxSpan = Math.min(W, D);
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                
                // Calculate Polygon Mathematical Centroid
                let cx = 0, cy = 0, signedArea = 0;
                for (let i = 0; i < pts.length; i++) {
                    let p0 = pts[i], p1 = pts[(i + 1) % pts.length];
                    let a = p0.x * p1.y - p1.x * p0.y;
                    signedArea += a;
                    cx += (p0.x + p1.x) * a;
                    cy += (p0.y + p1.y) * a;
                }
                signedArea *= 0.5;
                if (signedArea !== 0) { cx /= (6.0 * signedArea); cy /= (6.0 * signedArea); } 
                else { cx = minX + W/2; cy = minY + D/2; }

                const top = [cx, rh, cy];
                const v = [], uv = [];
                
                // Build perfectly sealed triangles with upward facing normals
                for (let i = 0; i < pts.length; i++) {
                    let p0 = pts[i], p1 = pts[(i + 1) % pts.length];
                    let dx1 = p1.x - p0.x, dz1 = p1.y - p0.y;
                    let dx2 = top[0] - p0.x, dz2 = top[2] - p0.y;
                    let ny = dx1 * dz2 - dz1 * dx2; 
                    
                    if (ny < 0) { v.push(p1.x, 0, p1.y, p0.x, 0, p0.y, ...top); } 
                    else { v.push(p0.x, 0, p0.y, p1.x, 0, p1.y, ...top); }
                    uv.push(0, 0, 1, 0, 0.5, 1);
                }

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
                geo.computeVertexNormals();
                mesh = new THREE.Mesh(geo, mat);
            }

            const roofGroup = new THREE.Group();
            let groupX = 0, groupZ = 0;
            if (roof.group && typeof roof.group.x === 'function') {
                groupX = roof.group.x();
                groupZ = roof.group.y();
            } else if (roof.x !== undefined) {
                groupX = roof.x;
                groupZ = roof.y;
            }
            roofGroup.position.set(groupX, h, groupZ); // Account for 2D dragging
       
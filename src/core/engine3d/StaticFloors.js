import * as THREE from 'three';
import { WALL_HEIGHT, ROOF_DECOR_REGISTRY, FLOOR_REGISTRY } from '../registry.js';
import { Wall3DBuilder } from './Wall3DBuilder.js';

export class StaticFloors {
    constructor(decorManager, interactables) {
        this.decorManager = decorManager;
        this.interactables = interactables;
        this.wallBuilder = new Wall3DBuilder();
        this.matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7, side: THREE.DoubleSide });
    }

    build(levelsJsonArray, activeIndex, viewMode3D, staticStructureGroup) {
        const isPreview = viewMode3D === 'preview';

        levelsJsonArray.forEach((levelStr, index) => {
            if (index === activeIndex || !levelStr || viewMode3D === 'isolate') return;

            try {
                const data = JSON.parse(levelStr);
                const floorGroup = new THREE.Group();
                floorGroup.position.y = index * WALL_HEIGHT;

                // Build Slabs
                if (data.rooms) {
                    data.rooms.forEach(room => {
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
                            tex.repeat.set(1 / (100 * repeatScale), 1 / (100 * repeatScale));
                            mat = new THREE.MeshStandardMaterial({ map: tex, roughness: floorConfig.roughness !== undefined ? floorConfig.roughness : 0.8, color: floorConfig.color || 0xffffff, side: THREE.DoubleSide });
                        } else if (floorConfig && floorConfig.color) {
                            mat = new THREE.MeshStandardMaterial({ color: floorConfig.color, roughness: floorConfig.roughness !== undefined ? floorConfig.roughness : 0.8, side: THREE.DoubleSide });
                        }

                        const floorMesh = new THREE.Mesh(floorGeo, mat);
                        floorMesh.receiveShadow = true;
                        
                        if (!isPreview) {
                            floorMesh.userData = { isFloorTrigger: true, levelIndex: index };
                            this.interactables.push(floorMesh);
                        }
                        floorGroup.add(floorMesh);
                    });
                }

                // Build Walls
                if (data.walls) {
                    const anchorMap = new Map(); 

                    data.walls.forEach((w, wallIndex) => {
                        const dx = w.endX - w.startX; const dz = w.endY - w.startY;
                        const length = Math.hypot(dx, dz); const angle = Math.atan2(dz, dx);
                        
                        const wallHeight = w.height || w.config?.height || WALL_HEIGHT;
                        // Mock Data for Managers
                        w.config = { thickness: w.thickness, height: wallHeight }; w.length3D = length; w.attachedWidgets = w.widgets || []; w.attachedDecor = w.decors || []; w.isStatic = true; w.levelIndex = index; w.wallIndex = wallIndex;
                        const { wallGroup } = this.wallBuilder.buildWallGroup(length, w.thickness, w.attachedWidgets, w.startX, w.startY, angle, wallHeight);
                        wallGroup.userData = { entity: w };
                        w.mesh3D = wallGroup;

                        if (!isPreview) {
                            const hitboxes = this.wallBuilder.createHitboxes(length, w.thickness, w, true, index, wallIndex, wallHeight);
                            hitboxes.forEach(hb => {
                                // Only add Face hitboxes if in full-edit mode. Otherwise, just add the volume trigger.
                                if (viewMode3D === 'full-edit' || hb.userData.isFloorTrigger) {
                                    wallGroup.add(hb);
                                    this.interactables.push(hb);
                                }
                            });
                        }

                        floorGroup.add(wallGroup);
                        if (w.attachedDecor) w.attachedDecor.forEach(decor => this.decorManager.load(w, decor));

                        // Map Joints
                        const startKey = `${w.startX.toFixed(2)},${w.startY.toFixed(2)}`;
                        const endKey = `${w.endX.toFixed(2)},${w.endY.toFixed(2)}`;
                        let sData = anchorMap.get(startKey) || { x: w.startX, y: w.startY, thickness: 0, height: 0 };
                        if (w.thickness > sData.thickness) sData.thickness = w.thickness;
                        if (wallHeight > sData.height) sData.height = wallHeight;
                        anchorMap.set(startKey, sData);

                        let eData = anchorMap.get(endKey) || { x: w.endX, y: w.endY, thickness: 0, height: 0 };
                        if (w.thickness > eData.thickness) eData.thickness = w.thickness;
                        if (wallHeight > eData.height) eData.height = wallHeight;
                        anchorMap.set(endKey, eData);
                    });

                    // Build Joints
                    anchorMap.forEach((data) => {
                        floorGroup.add(this.wallBuilder.createJoint(data.x, data.y, data.thickness, data.height)); 
                    });
                }
                
                // Build Roofs
                if (data.roofs) {
                    const hasWalls = data.walls && data.walls.length > 0;
                    let maxWallHeight = WALL_HEIGHT;
                    if (hasWalls) {
                        maxWallHeight = Math.max(...data.walls.map(w => w.height || w.config?.height || WALL_HEIGHT));
                    }
                    const baseHeight = (hasWalls || index === 0) ? maxWallHeight : 0;

                    data.roofs.forEach(roofData => {
                        const pts = roofData.points;
                        if (!pts || pts.length < 3) return;

                        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                        pts.forEach(p => {
                            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                        });

                        const wallGap = roofData.wallGap || 0;
                        const W = maxX - minX;
                        const D = maxY - minY;
                        const h = baseHeight + wallGap + 0.5;

                        const decor = ROOF_DECOR_REGISTRY[roofData.material] || ROOF_DECOR_REGISTRY['asphalt_shingles'];
                        const tex = new THREE.TextureLoader().load(decor.texture);
                        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                        tex.repeat.set(W / (100 * (decor.repeat || 1)), D / (100 * (decor.repeat || 1)));
                        const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide });

                        let mesh;
                        if (roofData.roofType === 'flat') {
                            const shape = new THREE.Shape();
                            shape.moveTo(pts[0].x, pts[0].y);
                            for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
                            shape.lineTo(pts[0].x, pts[0].y);
                            const geo = new THREE.ExtrudeGeometry(shape, { depth: roofData.thickness || 2, bevelEnabled: false });
                            geo.rotateX(Math.PI / 2); geo.translate(0, roofData.thickness || 2, 0);
                            mesh = new THREE.Mesh(geo, mat);
                        } else {
                            const pitch = roofData.pitch || 30;
                            const rh = Math.tan(pitch * Math.PI / 180) * (Math.min(W, D) / 2);
                            
                            let cx = 0, cy = 0, signedArea = 0;
                            for (let i = 0; i < pts.length; i++) {
                                let p0 = pts[i], p1 = pts[(i + 1) % pts.length];
                                let a = p0.x * p1.y - p1.x * p0.y;
                                signedArea += a; cx += (p0.x + p1.x) * a; cy += (p0.y + p1.y) * a;
                            }
                            signedArea *= 0.5;
                            if (signedArea !== 0) { cx /= (6.0 * signedArea); cy /= (6.0 * signedArea); } 
                            else { cx = minX + W/2; cy = minY + D/2; }

                            const top = [cx, rh, cy];
                            const v = [], uv = [];
                            for (let i = 0; i < pts.length; i++) {
                                let p0 = pts[i], p1 = pts[(i + 1) % pts.length];
                                let dx1 = p1.x - p0.x, dz1 = p1.y - p0.y;
                                let dx2 = top[0] - p0.x, dz2 = top[2] - p0.y;
                                let ny = dx1 * dz2 - dz1 * dx2; 
                                if (ny < 0) { v.push(p1.x, 0, p1.y, p0.x, 0, p0.y, ...top); } 
                                else { v.push(p0.x, 0, p0.y, p1.x, 0, p1.y, ...top); }
                                uv.push(0, 0, 1, 0, 0.5, 1);
                            }

                            const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
                            mesh = new THREE.Mesh(geo, mat);
                        }

                        const roofGroup = new THREE.Group(); roofGroup.position.set(roofData.x || 0, h, roofData.y || 0); roofGroup.rotation.y = -(roofData.rotation || 0) * Math.PI / 180;
                        mesh.castShadow = true; mesh.receiveShadow = true;
                        if (!isPreview) { mesh.userData = { isFloorTrigger: true, levelIndex: index }; this.interactables.push(mesh); }
                        roofGroup.add(mesh); floorGroup.add(roofGroup);
                    });
                }
                
                staticStructureGroup.add(floorGroup);
            } catch (e) { console.error("Error parsing static floor", e); }
        });
    }
}
import * as THREE from 'three';
import { WALL_HEIGHT, ROOF_DECOR_REGISTRY } from '../registry.js';
import { Wall3DBuilder } from './Wall3DBuilder.js';

export class StaticFloors {
    constructor(decorManager, interactables) {
        this.decorManager = decorManager;
        this.interactables = interactables;
        this.wallBuilder = new Wall3DBuilder();
        this.matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 });
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
                if (data.roomPaths) {
                    data.roomPaths.forEach(path => {
                        const floorShape = new THREE.Shape();
                        floorShape.moveTo(path[0].x, path[0].y);
                        for (let i = 1; i < path.length; i++) floorShape.lineTo(path[i].x, path[i].y);
                        
                        const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 10, bevelEnabled: false });
                        floorGeo.rotateX(Math.PI / 2);
                        const floorMesh = new THREE.Mesh(floorGeo, this.matFloor);
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
                        
                        // Mock Data for Managers
                        w.config = { thickness: w.thickness }; w.length3D = length; w.attachedWidgets = w.widgets || []; w.attachedDecor = w.decors || []; w.isStatic = true; w.levelIndex = index; w.wallIndex = wallIndex;
                        const { wallGroup } = this.wallBuilder.buildWallGroup(length, w.thickness, w.attachedWidgets, w.startX, w.startY, angle);
                        wallGroup.userData = { entity: w };
                        w.mesh3D = wallGroup;

                        if (!isPreview) {
                            const hitboxes = this.wallBuilder.createHitboxes(length, w.thickness, w, true, index, wallIndex);
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
                        let sData = anchorMap.get(startKey) || { x: w.startX, y: w.startY, thickness: 0 };
                        if (w.thickness > sData.thickness) sData.thickness = w.thickness;
                        anchorMap.set(startKey, sData);

                        let eData = anchorMap.get(endKey) || { x: w.endX, y: w.endY, thickness: 0 };
                        if (w.thickness > eData.thickness) eData.thickness = w.thickness;
                        anchorMap.set(endKey, eData);
                    });

                    // Build Joints
                    anchorMap.forEach((data) => {
                        floorGroup.add(this.wallBuilder.createJoint(data.x, data.y, data.thickness)); 
                    });
                }
                
                // Build Roofs
                if (data.roofs) {
                    const hasWalls = data.walls && data.walls.length > 0;
                    const baseHeight = (hasWalls || index === 0) ? WALL_HEIGHT : 0;

                    data.roofs.forEach(roofData => {
                        const pts = roofData.points;
                        if (!pts || pts.length < 3) return;

                        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                        pts.forEach(p => {
                            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                        });

                        const overhang = roofData.overhang || 0;
                        const wallGap = roofData.wallGap || 0;
                        const wallOffset = 8; // Fixes wall poking by expanding base to outer edges

                        const W = (maxX - minX) + (wallOffset * 2) + (overhang * 2);
                        const D = (maxY - minY) + (wallOffset * 2) + (overhang * 2);
                        const cx = minX + (maxX - minX) / 2;
                        const cz = minY + (maxY - minY) / 2;
                        const h = baseHeight + wallGap;

                        const decor = ROOF_DECOR_REGISTRY[roofData.material] || ROOF_DECOR_REGISTRY['asphalt_shingles'];
                        const tex = new THREE.TextureLoader().load(decor.texture);
                        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                        tex.repeat.set(W / (100 * (decor.repeat || 1)), D / (100 * (decor.repeat || 1)));
                        const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide });

                        let mesh;
                        if (roofData.roofType === 'flat') {
                            const geo = new THREE.BoxGeometry(W, roofData.thickness || 2, D);
                            mesh = new THREE.Mesh(geo, mat); mesh.position.set(cx, (roofData.thickness || 2)/2, cz);
                        } else {
                            const pitch = roofData.pitch || 30;
                            const drop = Math.tan(pitch * Math.PI / 180) * overhang;
                            const rh = Math.tan(pitch * Math.PI / 180) * (Math.min(W, D) / 2);
                            
                            const p1 = [cx - W/2, -drop, cz - D/2]; const p2 = [cx + W/2, -drop, cz - D/2];
                            const p3 = [cx + W/2, -drop, cz + D/2]; const p4 = [cx - W/2, -drop, cz + D/2];
                            const v = [], uv = [];
                            if (W >= D) {
                                const r1 = [cx - (W - D)/2, rh - drop, cz]; const r2 = [cx + (W - D)/2, rh - drop, cz];
                                v.push(...p4, ...p3, ...r2, ...p4, ...r2, ...r1); uv.push(0,0, 1,0, 0.75,1, 0,0, 0.75,1, 0.25,1);
                                v.push(...p3, ...p2, ...r2); uv.push(0,0, 1,0, 0.5,1);
                                v.push(...p2, ...p1, ...r1, ...p2, ...r1, ...r2); uv.push(0,0, 1,0, 0.75,1, 0,0, 0.75,1, 0.25,1);
                                v.push(...p1, ...p4, ...r1); uv.push(0,0, 1,0, 0.5,1);
                            } else {
                                const r1 = [cx, rh - drop, cz - (D - W)/2]; const r2 = [cx, rh - drop, cz + (D - W)/2];
                                v.push(...p4, ...p3, ...r2); uv.push(0,0, 1,0, 0.5,1);
                                v.push(...p3, ...p2, ...r1, ...p3, ...r1, ...r2); uv.push(0,0, 1,0, 0.75,1, 0,0, 0.75,1, 0.25,1);
                                v.push(...p2, ...p1, ...r1); uv.push(0,0, 1,0, 0.5,1);
                                v.push(...p1, ...p4, ...r2, ...p1, ...r2, ...r1); uv.push(0,0, 1,0, 0.75,1, 0,0, 0.75,1, 0.25,1);
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
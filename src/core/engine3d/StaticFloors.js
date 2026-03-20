import * as THREE from 'three';
import { WALL_HEIGHT } from '../registry.js';
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
                        w.config = { thickness: w.thickness }; w.length3D = length;
                        w.attachedWidgets = w.widgets || []; w.attachedDecor = w.decors || [];
                        w.isStatic = true; w.levelIndex = index; w.wallIndex = wallIndex;

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
                staticStructureGroup.add(floorGroup);
            } catch (e) { console.error("Error parsing static floor", e); }
        });
    }
}
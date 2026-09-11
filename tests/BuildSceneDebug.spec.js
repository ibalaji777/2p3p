import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import fs from 'fs';
import path from 'path';
import { EnvironmentBuilder } from '../src/core/engine3d/EnvironmentBuilder.js';
import { AssetManager } from '../src/core/engine3d/AssetManager.js';
import { FurnitureManager } from '../src/features/furniture/furniture.renderer3d.js';
import { DecorManager } from '../src/core/engine3d/DecorManager.js';
import { CameraController } from '../src/core/camera/CameraController.js';

describe('BuildScene & CameraController Debug', () => {
    it('computes building bounding box and camera positions properly', () => {
        const jsonPath = path.resolve(process.cwd(), 'public/building_planner_elevation_project.json');
        const jsonStr = fs.readFileSync(jsonPath, 'utf8');
        const project = JSON.parse(jsonStr);

        const scene = new THREE.Scene();
        const structureGroup = new THREE.Group();
        const staticStructureGroup = new THREE.Group();
        scene.add(structureGroup);
        scene.add(staticStructureGroup);

        const camera = new THREE.PerspectiveCamera(45, 1, 2, 20000);
        const mockDom = {
            clientWidth: 1000,
            clientHeight: 800,
            style: {},
            addEventListener: () => {},
            removeEventListener: () => {},
            getRootNode: () => ({ addEventListener: () => {}, removeEventListener: () => {} }),
            ownerDocument: { addEventListener: () => {}, removeEventListener: () => {} }
        };

        const mockPreview3D = {
            camera,
            scene,
            structureGroup,
            staticStructureGroup,
            interactables: [],
            helpers: {
                ctx: null,
                getDynamicMaterial: () => new THREE.MeshStandardMaterial(),
                getFaceMaterials: () => ({
                    box: Array(6).fill(new THREE.MeshStandardMaterial()),
                    extrude: [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()]
                })
            },
            assets: new AssetManager(),
            furnitureManager: null,
            decorManager: null,
            updatePatternLive: () => {},
            requestRender: () => {},
            viewMode3D: 'preview'
        };
        mockPreview3D.helpers.ctx = mockPreview3D;
        mockPreview3D.furnitureManager = new FurnitureManager(mockPreview3D);
        mockPreview3D.decorManager = new DecorManager(mockPreview3D);

        const cameraController = new CameraController(camera, mockDom, mockPreview3D);
        mockPreview3D.cameraController = cameraController;

        const envBuilder = new EnvironmentBuilder(mockPreview3D);
        mockPreview3D.envBuilder = envBuilder;

        const levelsConfigArray = project.levels.map(l => ({
            id: l.id,
            name: l.name,
            type: l.type,
            height: l.height,
            defaultWallThickness: l.defaultWallThickness,
            data: l.data,
            isVisible: l.isVisible !== false
        }));

        const level0Data = typeof project.levels[0].data === 'string' ? JSON.parse(project.levels[0].data) : project.levels[0].data;

        // Build active floor
        envBuilder.buildActiveFloor(level0Data.walls, level0Data.rooms, level0Data.shapes || [], level0Data.stairs || [], [], []);

        // Build static floors
        envBuilder.buildStaticFloors(levelsConfigArray, 0, 'preview', []);

        console.log('StructureGroup children:', structureGroup.children.length);
        console.log('StaticStructureGroup children:', staticStructureGroup.children.length);

        const checkGroupForNaN = (group, groupName) => {
            group.traverse(child => {
                if (child.isMesh && child.geometry) {
                    const b = new THREE.Box3().setFromObject(child);
                    if (isNaN(b.min.x) || isNaN(b.max.x)) {
                        console.log(`[NaN Found in ${groupName}] Object:`, child.name || child.type, 'userData:', child.userData);
                        const pos = child.geometry.attributes.position;
                        if (pos) {
                            for (let i = 0; i < pos.count; i++) {
                                if (isNaN(pos.getX(i)) || isNaN(pos.getY(i)) || isNaN(pos.getZ(i))) {
                                    console.log(`  Vertex ${i} has NaN:`, pos.getX(i), pos.getY(i), pos.getZ(i));
                                    break;
                                }
                            }
                        }
                    }
                }
            });
        };

        checkGroupForNaN(structureGroup, 'structureGroup');
        checkGroupForNaN(staticStructureGroup, 'staticStructureGroup');

        const b1 = new THREE.Box3().setFromObject(structureGroup);
        console.log('structureGroup box:', b1.min, b1.max);

        staticStructureGroup.children.forEach((child, i) => {
            child.traverse(grandchild => {
                const gb = new THREE.Box3().setFromObject(grandchild);
                if (isNaN(gb.min.x)) {
                    console.log(`[NaN Grandchild]:`, grandchild.type, 'pos:', grandchild.position, 'scale:', grandchild.scale, 'matrixWorld:', grandchild.matrixWorld.elements.slice(0, 4));
                    let p = grandchild.parent;
                    while (p) {
                        console.log(`  parent ${p.type} pos:`, p.position, 'scale:', p.scale, 'matrixWorld:', p.matrixWorld.elements.slice(0, 4));
                        p = p.parent;
                    }
                }
            });
        });

        const box = cameraController.getBuildingBoundingBox();
        console.log('Building Bounding Box:', {
            min: box.min,
            max: box.max,
            center: box.getCenter(new THREE.Vector3()),
            size: box.getSize(new THREE.Vector3())
        });

        // Test updateCameraBounds
        cameraController.updateCameraBounds();
        console.log('Camera pos after updateCameraBounds:', camera.position);
        console.log('Controls target after updateCameraBounds:', cameraController.controls.target);

        expect(box.isEmpty()).toBe(false);
    });
});

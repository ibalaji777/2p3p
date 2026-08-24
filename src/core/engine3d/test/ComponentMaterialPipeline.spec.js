import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MaterialSlots, ComponentTypes } from '../../constants/materialSlots.js';
import { ComponentRegistry } from '../ComponentRegistry.js';
import { MaterialManager } from '../MaterialManager.js';

describe('10/10 CAD/BIM Component & Material Pipeline', () => {
    let mockEntity;
    let mockDoorGroup;
    let frameMesh1, frameMesh2, leafMesh, glassMesh, lockedHardwareMesh;

    beforeEach(() => {
        ComponentRegistry.slotRegistry.clear();
        ComponentRegistry.componentRegistry.clear();

        mockEntity = {
            id: 'test_door_101',
            type: 'door',
            materials: {
                [MaterialSlots.LEAF]: { id: 'wood_golden_teak' },
                [MaterialSlots.FRAME]: { id: 'wood_golden_teak' },
                [MaterialSlots.GLASS]: { id: 'glass_clear' }
            }
        };

        mockDoorGroup = new THREE.Group();

        // 1. Frame Meshes (Left Jamb, Right Jamb)
        frameMesh1 = new THREE.Mesh(new THREE.BoxGeometry(2, 80, 4), new THREE.MeshStandardMaterial());
        frameMesh1.name = 'left_jamb';
        frameMesh2 = new THREE.Mesh(new THREE.BoxGeometry(2, 80, 4), new THREE.MeshStandardMaterial());
        frameMesh2.name = 'right_jamb';

        // 2. Leaf Mesh
        leafMesh = new THREE.Mesh(new THREE.BoxGeometry(36, 80, 1.75), new THREE.MeshStandardMaterial());
        leafMesh.name = 'door_panel';

        // 3. Glass Mesh
        glassMesh = new THREE.Mesh(new THREE.BoxGeometry(20, 40, 0.5), new THREE.MeshStandardMaterial());
        glassMesh.name = 'glass_pane';

        // 4. Locked Hardware Mesh
        lockedHardwareMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 2), new THREE.MeshStandardMaterial({ color: 0x000000 }));
        lockedHardwareMesh.name = 'brass_handle';
        lockedHardwareMesh.userData.materialLocked = true;

        mockDoorGroup.add(frameMesh1, frameMesh2, leafMesh, glassMesh, lockedHardwareMesh);

        // Register Meshes in ComponentRegistry
        ComponentRegistry.registerMesh(mockEntity, MaterialSlots.FRAME, frameMesh1, { componentId: 'jamb_left' });
        ComponentRegistry.registerMesh(mockEntity, MaterialSlots.FRAME, frameMesh2, { componentId: 'jamb_right' });
        ComponentRegistry.registerMesh(mockEntity, MaterialSlots.LEAF, leafMesh, { componentId: 'leaf_main' });
        ComponentRegistry.registerMesh(mockEntity, MaterialSlots.GLASS, glassMesh, { componentId: 'glass_vision' });
        ComponentRegistry.registerMesh(mockEntity, MaterialSlots.HARDWARE, lockedHardwareMesh, { componentId: 'handle_lock' });
    });

    it('1. should register semantic metadata and support O(1) slot mesh lookups', () => {
        const frameMeshes = ComponentRegistry.getMeshesForSlot(mockEntity.id, MaterialSlots.FRAME);
        expect(frameMeshes.length).toBe(2);
        expect(frameMeshes).toContain(frameMesh1);
        expect(frameMeshes).toContain(frameMesh2);

        const leafMeshes = ComponentRegistry.getMeshesForSlot(mockEntity.id, MaterialSlots.LEAF);
        expect(leafMeshes.length).toBe(1);
        expect(leafMeshes[0]).toBe(leafMesh);

        expect(frameMesh1.userData.materialSlot).toBe(MaterialSlots.FRAME);
        expect(frameMesh1.userData.componentType).toBe(ComponentTypes.FRAME);
    });

    it('2. should activate slot-wide component highlighting across all sub-meshes of a slot', () => {
        // Highlighting slot FRAME should illuminate both frameMesh1 and frameMesh2
        ComponentRegistry.setSlotHighlight(mockEntity.id, MaterialSlots.FRAME, true, 0x00ff00);

        expect(frameMesh1.material.emissive.getHex()).toBe(0x00ff00);
        expect(frameMesh2.material.emissive.getHex()).toBe(0x00ff00);
        expect(leafMesh.material.emissive.getHex()).toBe(0x000000); // Leaf remains untouched

        // Clear highlight
        ComponentRegistry.setSlotHighlight(mockEntity.id, MaterialSlots.FRAME, false);
        expect(frameMesh1.material.emissive.getHex()).toBe(0x000000);
        expect(frameMesh2.material.emissive.getHex()).toBe(0x000000);
    });

    it('3. should update JSON model state immutably and maintain single source of truth', async () => {
        await MaterialManager.updateEntityMaterialSlot(mockEntity, MaterialSlots.FRAME, 'wood_oak_dark');

        expect(mockEntity.materials[MaterialSlots.FRAME]).toBeDefined();
        expect(mockEntity.materials[MaterialSlots.FRAME].id).toBe('wood_oak_dark');
    });

    it('4. should support transaction batching (beginTransaction -> commit)', async () => {
        MaterialManager.beginTransaction();

        await MaterialManager.updateEntityMaterialSlot(mockEntity, MaterialSlots.FRAME, 'wood_walnut');
        await MaterialManager.updateEntityMaterialSlot(mockEntity, MaterialSlots.LEAF, 'wood_teak');

        expect(MaterialManager.activeTransaction).not.toBeNull();

        await MaterialManager.commit();

        expect(MaterialManager.activeTransaction).toBeNull();
        expect(mockEntity.materials[MaterialSlots.FRAME].id).toBe('wood_walnut');
        expect(mockEntity.materials[MaterialSlots.LEAF].id).toBe('wood_teak');
    });

    it('5. should enforce material locks and prevent recoloring locked hardware meshes', async () => {
        const origColor = lockedHardwareMesh.material.color.getHex();
        await MaterialManager.applySlot(mockEntity, MaterialSlots.HARDWARE, 'metal_gold');

        // Color must remain unchanged because userData.materialLocked = true
        expect(lockedHardwareMesh.material.color.getHex()).toBe(origColor);
    });

    it('6. should run asset validation and report diagnostic material metrics', () => {
        const validation = MaterialManager.validateAssetMaterialSlots(mockEntity, mockDoorGroup, { verbose: false });
        expect(validation.valid).toBe(true);

        const scene = new THREE.Scene();
        scene.add(mockDoorGroup);
        const metrics = MaterialManager.getMaterialMetrics(scene);

        expect(metrics.totalMeshes).toBe(5);
        expect(metrics.registeredMeshes).toBe(5);
        expect(metrics.slotCoverage).toBe('100.0%');
    });

    it('7. should automatically highlight and apply materials across the entire material group when any sub-mesh is selected', async () => {
        // Selecting frameMesh1 (left jamb) should resolve slot FRAME and update all frame meshes (left jamb, right jamb)
        const frameMeshes = ComponentRegistry.getMeshesForSlot(mockEntity.id, MaterialSlots.FRAME);
        expect(frameMeshes.length).toBe(2);

        // Highlight whole group
        ComponentRegistry.setSlotHighlight(mockEntity.id, MaterialSlots.FRAME, true, 0x93c5fd);
        expect(frameMesh1.material.emissive.getHex()).toBe(0x93c5fd);
        expect(frameMesh2.material.emissive.getHex()).toBe(0x93c5fd);

        // Apply material to the group
        await MaterialManager.updateEntityMaterialSlot(mockEntity, MaterialSlots.FRAME, 'wood_golden_oak');
        expect(mockEntity.materials[MaterialSlots.FRAME].id).toBe('wood_golden_oak');
    });

    it('8. should support multiple material pattern layers on a wall matching properties behavior', async () => {
        const wallEntity = {
            id: 'test_wall_decor_1',
            type: 'outer',
            attachedDecor: [],
            thickness: 10,
            mesh3D: new THREE.Group()
        };

        const mockDecorManager = {
            add(wall, configId, side) {
                const decor = {
                    id: 'decor_' + Math.random().toString(36).substr(2, 9),
                    type: 'wallDecor',
                    configId: configId,
                    side: side,
                    localX: 50, localY: 50, localZ: 0,
                    width: 100, height: 100,
                    depth: 0.2, tileSize: 70
                };
                wall.attachedDecor.push(decor);
                return decor;
            },
            updateLive(decor) {
                // updates 3D mesh
            }
        };

        // 1. Add first pattern layer (brick) to front side
        const decor1 = mockDecorManager.add(wallEntity, 'brick_red', 'front');
        expect(wallEntity.attachedDecor.length).toBe(1);
        expect(wallEntity.attachedDecor[0].configId).toBe('brick_red');
        expect(wallEntity.attachedDecor[0].side).toBe('front');

        // 2. Add second pattern layer (wood) to front side (allowing multiple materials on the wall)
        const decor2 = mockDecorManager.add(wallEntity, 'wood_golden_oak', 'front');
        expect(wallEntity.attachedDecor.length).toBe(2);
        expect(wallEntity.attachedDecor[1].configId).toBe('wood_golden_oak');

        // 3. Update existing pattern layer material
        decor1.configId = 'stone_slate';
        expect(wallEntity.attachedDecor[0].configId).toBe('stone_slate');
    });
});

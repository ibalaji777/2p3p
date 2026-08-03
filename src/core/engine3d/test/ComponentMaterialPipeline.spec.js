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
        ComponentRegistry.registry.clear();

        mockEntity = {
            id: 'test_door_101',
            type: 'door',
            doorMat: 'wood_golden_teak',
            frameMat: 'wood_golden_teak',
            glassMat: 'glass_clear'
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
        expect(mockEntity.frameMat).toBe('wood_oak_dark');
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
});

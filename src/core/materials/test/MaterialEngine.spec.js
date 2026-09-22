import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { MaterialEngine } from '../MaterialEngine.js';
import { MaterialSlots, ComponentTypes } from '../../constants/materialSlots.js';
import { ComponentRegistry } from '../../engine3d/ComponentRegistry.js';
import { ApplyMaterialCommand } from '../../commands/ApplyMaterialCommand.js';

describe('MaterialEngine - Canonical Domain Authority for Materials, Textures & Shaders', () => {
    let mockEntity;
    let mockDoorGroup;
    let frameMesh1, frameMesh2, leafMesh, glassMesh;

    beforeEach(() => {
        ComponentRegistry.slotRegistry.clear();
        ComponentRegistry.componentRegistry.clear();

        mockEntity = {
            id: 'door_mat_engine_1',
            type: 'door',
            params: {},
            materials: {
                [MaterialSlots.LEAF]: { id: 'wood_oak' },
                [MaterialSlots.FRAME]: { id: 'wood_oak' }
            }
        };

        mockDoorGroup = new THREE.Group();
        frameMesh1 = new THREE.Mesh(new THREE.BoxGeometry(2, 80, 4), new THREE.MeshStandardMaterial());
        frameMesh2 = new THREE.Mesh(new THREE.BoxGeometry(2, 80, 4), new THREE.MeshStandardMaterial());
        leafMesh = new THREE.Mesh(new THREE.BoxGeometry(36, 80, 1.75), new THREE.MeshStandardMaterial());
        glassMesh = new THREE.Mesh(new THREE.BoxGeometry(20, 40, 0.5), new THREE.MeshStandardMaterial());

        mockDoorGroup.add(frameMesh1, frameMesh2, leafMesh, glassMesh);

        ComponentRegistry.registerMesh(mockEntity, MaterialSlots.FRAME, frameMesh1, { componentId: 'jamb_left' });
        ComponentRegistry.registerMesh(mockEntity, MaterialSlots.FRAME, frameMesh2, { componentId: 'jamb_right' });
        ComponentRegistry.registerMesh(mockEntity, MaterialSlots.LEAF, leafMesh, { componentId: 'leaf_main' });
        ComponentRegistry.registerMesh(mockEntity, MaterialSlots.GLASS, glassMesh, { componentId: 'glass_pane' });
    });

    describe('1. Resolution & Normalization', () => {
        it('resolves material configurations across registries', () => {
            const oak = MaterialEngine.resolveConfig('wood_oak');
            expect(oak).toBeDefined();
            expect(oak.color !== undefined || oak.id === 'wood_oak').toBe(true);

            const glass = MaterialEngine.resolveConfig('glass_clear');
            expect(glass).toBeDefined();
            expect(glass.transmission !== undefined || glass.opacity !== undefined).toBe(true);
        });

        it('normalizes material keys into canonical descriptors', () => {
            const desc = MaterialEngine.normalizeDescriptor('metal_stainless');
            expect(desc).toBeDefined();
            expect(desc.id).toBe('metal_stainless');

            const objDesc = MaterialEngine.normalizeDescriptor({ id: 'brick_red_1', roughness: 0.8 });
            expect(objDesc.id).toBe('brick_red_1');
            expect(objDesc.roughness).toBe(0.8);
        });

        it('lists all registered categories and retrieves their dictionaries', () => {
            const categories = MaterialEngine.getCategories();
            expect(categories).toContain('wood');
            expect(categories).toContain('glass');
            expect(categories).toContain('metal');
            expect(categories).toContain('stone');
            expect(categories).toContain('floor');

            const woodDict = MaterialEngine.getMaterialsByCategory('wood');
            expect(woodDict).toBeDefined();
            expect(woodDict.wood_golden_teak).toBeDefined();
        });
    });

    describe('2. Three.js Material Instantiation', () => {
        it('compiles standard materials for non-transmissive configurations', () => {
            const mat = MaterialEngine.getThreeMaterial('metal_black');
            expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
            expect(mat.name).toBe('metal_black');
        });

        it('compiles physical materials for transmissive glass configurations', () => {
            const mat = MaterialEngine.getThreeMaterial('glass_clear');
            expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
            expect(mat.transparent).toBe(true);
        });

        it('falls back to default standard material for unknown configurations', () => {
            const mat = MaterialEngine.getThreeMaterial('non_existent_mat_xyz');
            expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
        });
    });

    describe('3. Application across Entity Types', () => {
        it('authoritatively applies materials to component slots and syncs JSON state', async () => {
            await MaterialEngine.applyMaterial(mockEntity, MaterialSlots.FRAME, 'wood_walnut');

            expect(mockEntity.materials[MaterialSlots.FRAME]).toBeDefined();
            expect(mockEntity.materials[MaterialSlots.FRAME].id).toBe('wood_walnut');
            expect(mockEntity.params.frameMat).toBe('wood_walnut');
        });

        it('supports legacy slot aliases (e.g. doorMat -> leaf)', async () => {
            await MaterialEngine.applyMaterial(mockEntity, 'doorMat', 'wood_teak');

            expect(mockEntity.materials[MaterialSlots.LEAF]).toBeDefined();
            expect(mockEntity.materials[MaterialSlots.LEAF].id).toBe('wood_teak');
            expect(mockEntity.doorMat).toBe('wood_teak');
        });

        it('applies materials to walls and updates wall face params and elevation layers', async () => {
            const wall = {
                id: 'test_wall_1',
                type: 'outer',
                params: {},
                elevationLayers: {
                    front: [{ id: 'layer_1', texture: 'old_texture' }]
                }
            };

            await MaterialEngine.applyMaterial(wall, 'front', 'brick_red_1');

            expect(wall.params.textureFront).toBe('brick_red_1');
            expect(wall.elevationLayers.front[0].texture).toBe('brick_red_1');
        });

        it('applies materials to all faces of a wall when face is "all"', async () => {
            const wall = {
                id: 'test_wall_2',
                type: 'inner',
                params: {}
            };

            await MaterialEngine.applyMaterial(wall, 'all', 'stone_granite_1');

            expect(wall.params.textureFront).toBe('stone_granite_1');
            expect(wall.params.textureBack).toBe('stone_granite_1');
        });

        it('applies materials to roofs including fascia and gable slopes', async () => {
            const roof = {
                id: 'test_roof_1',
                type: 'roof',
                config: {
                    roofType: 'gable',
                    material: 'old_slate'
                }
            };

            await MaterialEngine.applyMaterial(roof, 'all', 'tiles_slate');
            expect(roof.config.material).toBe('tiles_slate');

            await MaterialEngine.applyMaterial(roof, 'fascia', 'wood_oak');
            expect(roof.config.fasciaMaterial).toBe('wood_oak');

            await MaterialEngine.applyMaterial(roof, 'gable', 'stone_granite_1');
            expect(roof.config.gableMaterial).toBe('stone_granite_1');
        });

        it('applies materials to floors, rooms, and outdoor zones', async () => {
            const room = {
                id: 'test_room_1',
                type: 'room',
                params: {}
            };

            await MaterialEngine.applyMaterial(room, 'floor', 'hardwood');
            expect(room.configId).toBe('hardwood');
            expect(room.params.texture).toBe('hardwood');
        });
    });

    describe('4. Highlighting & Transactions', () => {
        it('highlights and clears slot meshes', () => {
            MaterialEngine.setHighlight({ entity: mockEntity, slotName: MaterialSlots.FRAME }, true, 0x00ff00);
            expect(frameMesh1.material.emissive.getHex()).toBe(0x00ff00);
            expect(frameMesh2.material.emissive.getHex()).toBe(0x00ff00);
            expect(leafMesh.material.emissive.getHex()).toBe(0x000000);

            MaterialEngine.clearHighlight({ entity: mockEntity, slotName: MaterialSlots.FRAME });
            expect(frameMesh1.material.emissive.getHex()).toBe(0x000000);
            expect(frameMesh2.material.emissive.getHex()).toBe(0x000000);
        });

        it('batches transactions and commits changes cleanly', async () => {
            MaterialEngine.beginTransaction();

            await MaterialEngine.applyMaterial(mockEntity, MaterialSlots.FRAME, 'wood_cherry');
            await MaterialEngine.applyMaterial(mockEntity, MaterialSlots.LEAF, 'wood_golden_teak');

            expect(mockEntity.materials[MaterialSlots.FRAME].id).toBe('wood_cherry');
            expect(mockEntity.materials[MaterialSlots.LEAF].id).toBe('wood_golden_teak');

            await MaterialEngine.commit();
        });
    });

    describe('5. ApplyMaterialCommand Integration', () => {
        it('executes and undos material application via ApplyMaterialCommand', () => {
            const wall = {
                id: 'wall_cmd_test',
                type: 'outer',
                params: { textureFront: 'initial_paint' }
            };

            const mockPlanner = {
                walls: [wall],
                syncAll: vi.fn()
            };

            const cmd = new ApplyMaterialCommand(mockPlanner, 'wall_cmd_test', 'front', 'stone_slate', 'initial_paint');
            cmd.execute();
            expect(wall.params.textureFront).toBe('stone_slate');

            cmd.undo();
            expect(wall.params.textureFront).toBe('initial_paint');
        });
    });
});

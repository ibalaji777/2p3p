import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FURNITURE_REGISTRY, WORKSPACE_2D_SHAPES } from '../../../core/registry.js';
import { FurnitureManager } from '../furniture.renderer3d.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';

describe('Soft Furnishings & Interior Decor System', () => {
    const newItems = [
        // Window Dressings
        'curtain_drapes_sheer',
        'curtain_drapes_blackout',
        'curtain_roller_blind',
        'curtain_roman_shade',
        // Rugs & Carpets
        'rug_rectangular_modern',
        'rug_rectangular_persian',
        'rug_rectangular_jute',
        'rug_circular_boho',
        'rug_circular_plush',
        // Wall Decor & Art
        'decor_wall_art_canvas',
        'decor_photo_gallery',
        // Plants & Greenery
        'decor_plant_monstera',
        'decor_plant_snake',
        'decor_plant_fiddle',
        // Styling Props
        'decor_vases_ceramic'
    ];

    it('should have all soft furnishings and decor models in FURNITURE_REGISTRY', () => {
        newItems.forEach(id => {
            const config = FURNITURE_REGISTRY[id];
            expect(config, `Missing config for ${id}`).toBeDefined();
            expect(config.procedural).toBe(true);
            expect(config.default).toBeDefined();
            expect(config.default.width).toBeGreaterThan(0);
            expect(config.default.height).toBeGreaterThan(0);
            expect(config.default.depth).toBeGreaterThan(0);
        });
    });

    it('should have corresponding 2D shapes in WORKSPACE_2D_SHAPES', () => {
        newItems.forEach(id => {
            const config = FURNITURE_REGISTRY[id];
            const shape = WORKSPACE_2D_SHAPES[config.shape2D];
            expect(shape, `Missing 2D shape ${config.shape2D} for ${id}`).toBeDefined();
            expect(shape.length).toBeGreaterThan(5);
        });
    });

    it('should generate valid 3D procedural meshes with ComponentRegistry slots', async () => {
        const mockCtx = {
            assets: { getModel: async () => new THREE.Group() },
            helpers: {
                getDynamicMaterial: (matId, slotName) => new THREE.MeshStandardMaterial({ name: `${matId}_${slotName}` })
            }
        };

        const manager = new FurnitureManager(mockCtx);

        for (const id of newItems) {
            const config = FURNITURE_REGISTRY[id];
            const entity = {
                id: `test_${id}`,
                configId: id,
                width: config.default.width,
                height: config.default.height,
                depth: config.default.depth,
                materials: {}
            };

            const group = await manager.load(entity);
            expect(group, `load() failed for ${id}`).toBeDefined();
            expect(group instanceof THREE.Group).toBe(true);
            expect(group.children.length).toBeGreaterThan(0);

            // Verify meshes have component metadata attached
            let meshCount = 0;
            group.traverse(child => {
                if (child.isMesh && child.userData?.materialSlot) {
                    meshCount++;
                    expect(child.userData.entity).toBe(entity);
                    expect(child.userData.componentId).toBeDefined();
                }
            });
            expect(meshCount, `No registered sub-meshes found for ${id}`).toBeGreaterThan(0);
        }
    });

    it('should generate smooth drapery geometries with valid metric UV coordinates and BIM slots', async () => {
        const mockCtx = {
            assets: { getModel: async () => new THREE.Group() },
            helpers: {
                getDynamicMaterial: (matId, slotName) => new THREE.MeshStandardMaterial({ name: `${matId}_${slotName}` })
            }
        };
        const manager = new FurnitureManager(mockCtx);

        const curtainEntity = {
            id: 'curtain_test_1',
            configId: 'curtain_drapes_sheer',
            width: 80,
            height: 95,
            depth: 12,
            materials: {}
        };

        const group = await manager.load(curtainEntity);
        const drapeMeshes = ComponentRegistry.getMeshesForSlot('curtain_test_1', 'fabric');
        expect(drapeMeshes.length).toBeGreaterThan(0);

        const drapeMesh = drapeMeshes[0];
        expect(drapeMesh.geometry).toBeDefined();
        expect(drapeMesh.geometry.attributes.uv).toBeDefined();
        expect(drapeMesh.geometry.attributes.uv.count).toBeGreaterThan(50);

        // Test BIMMaterialSystem target resolution
        const { BIMMaterialSystem } = await import('../../../core/engine3d/BIMMaterialSystem.js');
        const descriptor = BIMMaterialSystem.resolveBIMTarget(drapeMesh, 0, null, curtainEntity);
        expect(descriptor).toBeDefined();
        expect(descriptor.slotName).toBe('fabric');

        // Test slot highlighting
        ComponentRegistry.setSlotHighlight('curtain_test_1', 'fabric', true, 0x00ff00);
        const mat = Array.isArray(drapeMesh.material) ? drapeMesh.material[0] : drapeMesh.material;
        expect(mat.emissive.getHex()).toBe(0x00ff00);

        ComponentRegistry.setSlotHighlight('curtain_test_1', 'fabric', false);
    });
});

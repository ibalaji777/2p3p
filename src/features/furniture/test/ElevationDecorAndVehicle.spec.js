import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FURNITURE_REGISTRY, WORKSPACE_2D_SHAPES, RAILING_REGISTRY } from '../../../core/registry.js';
import { FurnitureManager } from '../furniture.renderer3d.js';
import { Railing3DBuilder } from '../../railing/builders/Railing3DBuilder.js';

describe('Architectural Elevation 3D Assets & Features', () => {
    const elevationItems = [
        'decor_car_white_sedan',
        'decor_car_white_hatchback',
        'decor_hanging_ivy',
        'decor_tree_slender',
        'decor_hedge_sphere'
    ];

    it('should have all new elevation items defined in FURNITURE_REGISTRY', () => {
        elevationItems.forEach(id => {
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
        elevationItems.forEach(id => {
            const config = FURNITURE_REGISTRY[id];
            const shape = WORKSPACE_2D_SHAPES[config.shape2D];
            expect(shape, `Missing 2D shape for ${id}`).toBeDefined();
        });
    });

    it('should procedurally generate 3D meshes with valid ComponentRegistry slots', async () => {
        const mockCtx = {
            assets: { getModel: async () => new THREE.Group() },
            helpers: {
                getDynamicMaterial: (matId, slotName) => new THREE.MeshStandardMaterial({ name: `${matId}_${slotName}` })
            }
        };

        const manager = new FurnitureManager(mockCtx);

        for (const id of elevationItems) {
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

            let registeredCount = 0;
            group.traverse(child => {
                if (child.isMesh && child.userData?.materialSlot) {
                    registeredCount++;
                    expect(child.userData.entity).toBe(entity);
                }
            });
            expect(registeredCount, `Expected registered sub-meshes for ${id}`).toBeGreaterThan(0);
        }
    });

    it('should support glass_wood_modern railing configuration with wood handrail', () => {
        const config = RAILING_REGISTRY['glass_wood_modern'];
        expect(config).toBeDefined();
        expect(config.handrail).toBeDefined();
        expect(config.handrail.material).toBe('wood_oak');
        expect(config.glass).toBeDefined();
        expect(config.glass.material).toBe('glass_clear');

        const mockRailing = {
            id: 'test_railing_wood_glass',
            configId: 'glass_wood_modern',
            points: [0, 0, 100, 0],
            thickness: 2,
            height: 40,
            config
        };

        const mesh = Railing3DBuilder.build(mockRailing);
        expect(mesh).toBeDefined();
        expect(mesh.children.length).toBeGreaterThan(0);
    });
});

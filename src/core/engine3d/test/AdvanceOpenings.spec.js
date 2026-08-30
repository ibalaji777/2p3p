import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { WIDGET_REGISTRY } from '../../registry.js';
import { WallPlugin3DPlacementSystem } from '../WallPlugin3DPlacementSystem.js';

describe('Advanced Wall Openings Pipeline', () => {
    it('1. should verify all 7 advance opening types are registered in WIDGET_REGISTRY', () => {
        const requiredTypes = [
            'arch_opening',
            'circular_opening',
            'custom_shape_opening',
            'niche_recess',
            'pattern_opening',
            'boolean_cut',
            'opening'
        ];

        requiredTypes.forEach(type => {
            expect(WIDGET_REGISTRY[type]).toBeDefined();
            expect(WIDGET_REGISTRY[type].defaultConfig).toBeDefined();
            expect(typeof WIDGET_REGISTRY[type].render2D).toBe('function');
            expect(typeof WIDGET_REGISTRY[type].render3D).toBe('function');
        });
    });

    it('2. should verify cutsWall configuration for through-cutouts vs recessed niche', () => {
        expect(WIDGET_REGISTRY['arch_opening'].cutsWall).toBe(true);
        expect(WIDGET_REGISTRY['circular_opening'].cutsWall).toBe(true);
        expect(WIDGET_REGISTRY['custom_shape_opening'].cutsWall).toBe(true);
        expect(WIDGET_REGISTRY['pattern_opening'].cutsWall).toBe(true);
        expect(WIDGET_REGISTRY['boolean_cut'].cutsWall).toBe(true);
        expect(WIDGET_REGISTRY['opening'].cutsWall).toBe(true);
        expect(WIDGET_REGISTRY['niche_recess'].cutsWall).toBe(false);
    });

    it('3. should generate shape-accurate 3D aperture void for arch_opening in 3D placement system', () => {
        const mockCtx = {
            scene: new THREE.Scene(),
            camera: new THREE.PerspectiveCamera(),
            renderer: { domElement: document.createElement('canvas') },
            requestRender: vi.fn()
        };

        const placementSystem = new WallPlugin3DPlacementSystem(mockCtx);
        const wallEntity = {
            id: 'test_wall_1',
            thickness: 20,
            height: 240,
            attachedWidgets: []
        };

        const p1 = { x: 0, y: 0 };
        const p2 = { x: 200, y: 0 };

        // Test arch_opening aperture void
        placementSystem.updateApertureAndModel(
            'arch_opening',
            wallEntity,
            0.5,
            0,
            1,
            200,
            200,
            0,
            p1,
            p2,
            20,
            240,
            50,
            80,
            20,
            true,
            false,
            false,
            false,
            100,
            { type: 'arch_opening' }
        );

        expect(placementSystem.apertureVoidMesh.geometry).toBeDefined();
        expect(placementSystem.apertureVoidMesh.position.x).toBe(100);
        expect(placementSystem.apertureVoidMesh.position.y).toBe(0);
    });

    it('4. should generate cylindrical 3D aperture void for circular_opening', () => {
        const mockCtx = {
            scene: new THREE.Scene(),
            camera: new THREE.PerspectiveCamera(),
            renderer: { domElement: document.createElement('canvas') },
            requestRender: vi.fn()
        };

        const placementSystem = new WallPlugin3DPlacementSystem(mockCtx);
        const wallEntity = {
            id: 'test_wall_2',
            thickness: 20,
            height: 240,
            attachedWidgets: []
        };

        const p1 = { x: 0, y: 0 };
        const p2 = { x: 200, y: 0 };

        placementSystem.updateApertureAndModel(
            'circular_opening',
            wallEntity,
            0.5,
            40,
            1,
            200,
            200,
            0,
            p1,
            p2,
            20,
            240,
            40,
            40,
            20,
            true,
            false,
            false,
            false,
            100,
            { type: 'circular_opening' }
        );

        expect(placementSystem.apertureVoidMesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
        expect(placementSystem.apertureVoidMesh.position.y).toBe(60); // 40 + 40/2
    });
});

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Molding3DBuilder } from '../Molding3DBuilder.js';
import { ComponentRegistry } from '../ComponentRegistry.js';
import { MaterialSlots, ComponentTypes } from '../../constants/materialSlots.js';
import { MOLDING_REGISTRY } from '../../../features/wall/wall.registry.js';
import { WallSerializer } from '../../../features/wall/wall.serializer.js';

describe('Baseboards & Skirting 3D Architecture & Catalog Pipeline', () => {
    let builder;

    beforeEach(() => {
        builder = new Molding3DBuilder();
        ComponentRegistry.slotRegistry.clear();
        ComponentRegistry.componentRegistry.clear();
    });

    it('1. should generate valid 3D geometry for all Skirting & Baseboard profiles', () => {
        const skirtingProfiles = [
            'skirting_flat',
            'skirting_beveled',
            'skirting_torus',
            'skirting_ogee',
            'skirting_craftsman',
            'skirting_shadow',
            'skirting_scotia',
            'skirting_shoe'
        ];

        skirtingProfiles.forEach(profileType => {
            const moldData = {
                id: `skirt_${profileType}`,
                type: `molding_${profileType}`,
                profileType,
                width: 100,
                depth: 2.5,
                moldingHeight: 12,
                heightOffset: 0,
                side: 'left',
                material: 'white_paint'
            };

            const group = builder.buildMolding(moldData, 100, 10);
            expect(group).toBeDefined();
            expect(group.isGroup).toBe(true);
            expect(group.children.length).toBeGreaterThan(0);

            const mesh = group.children[0];
            expect(mesh.isMesh).toBe(true);
            expect(mesh.geometry).toBeDefined();

            // Verify bounding box matches expected dimensions
            mesh.geometry.computeBoundingBox();
            const bbox = mesh.geometry.boundingBox;
            const sizeY = bbox.max.y - bbox.min.y;
            expect(sizeY).toBeCloseTo(12, 0.1);
        });
    });

    it('2. should register skirting meshes in ComponentRegistry with MaterialSlots.SKIRTING', () => {
        const moldData = {
            id: 'test_skirting_01',
            type: 'molding_skirting_torus',
            profileType: 'skirting_torus',
            width: 120,
            depth: 2.2,
            moldingHeight: 14,
            heightOffset: 0,
            side: 'left'
        };

        const group = builder.buildMolding(moldData, 120, 10);
        const mesh = group.children[0];

        expect(mesh.userData.materialSlot).toBe(MaterialSlots.SKIRTING);
        expect(mesh.userData.componentType).toBe(ComponentTypes.SKIRTING);

        const registeredMeshes = ComponentRegistry.getMeshesForSlot(moldData.id, MaterialSlots.SKIRTING);
        expect(registeredMeshes.length).toBeGreaterThanOrEqual(1);
        expect(registeredMeshes).toContain(mesh);
    });

    it('3. should support slot-wide highlight for skirting elements', () => {
        const moldData = {
            id: 'test_skirting_highlight',
            type: 'molding_skirting_ogee',
            profileType: 'skirting_ogee',
            width: 150,
            depth: 2.5,
            moldingHeight: 15,
            heightOffset: 0
        };

        const group = builder.buildMolding(moldData, 150, 10);
        const mesh = group.children[0];

        ComponentRegistry.setSlotHighlight(moldData.id, MaterialSlots.SKIRTING, true, 0x3b82f6);
        expect(mesh.material.emissive.getHex()).toBe(0x3b82f6);

        ComponentRegistry.setSlotHighlight(moldData.id, MaterialSlots.SKIRTING, false);
        expect(mesh.material.emissive.getHex()).toBe(0x000000);
    });

    it('4. should correctly serialize and deserialize skirting properties including moldingHeight', () => {
        const mockWall = {
            id: 'wall_123',
            startAnchor: { _id: 'a1', x: 0, y: 0 },
            endAnchor: { _id: 'a2', x: 100, y: 0 },
            config: { thickness: 10, height: 180 },
            attachedMoldings: [
                {
                    t: 0.5,
                    type: 'molding_skirting_flat',
                    width: 100,
                    depth: 2,
                    heightOffset: 0,
                    moldingHeight: 12,
                    side: 'left',
                    profileType: 'skirting_flat',
                    material: 'white_paint',
                    color: '#ffffff'
                }
            ]
        };

        const serialized = WallSerializer.serialize(mockWall);
        expect(serialized.moldings.length).toBe(1);
        expect(serialized.moldings[0].profileType).toBe('skirting_flat');
        expect(serialized.moldings[0].moldingHeight).toBe(12);
        expect(serialized.moldings[0].heightOffset).toBe(0);
    });

    it('5. should have all skirting catalog presets registered in MOLDING_REGISTRY with 3D renderers', () => {
        const expectedSkirtingTypes = [
            'molding_skirting_flat',
            'molding_skirting_beveled',
            'molding_skirting_torus',
            'molding_skirting_ogee',
            'molding_skirting_craftsman',
            'molding_skirting_shadow',
            'molding_skirting_scotia',
            'molding_skirting_shoe'
        ];

        expectedSkirtingTypes.forEach(key => {
            expect(MOLDING_REGISTRY[key]).toBeDefined();
            expect(MOLDING_REGISTRY[key].defaultConfig.heightOffset).toBe(0);
            expect(typeof MOLDING_REGISTRY[key].render3D).toBe('function');

            const sceneGroup = new THREE.Group();
            const rendered = MOLDING_REGISTRY[key].render3D(sceneGroup, MOLDING_REGISTRY[key].defaultConfig);
            expect(rendered).toBeDefined();
            expect(sceneGroup.children.length).toBeGreaterThan(0);
        });
    });

    it('6. should automatically cut baseboard geometry around door openings', () => {
        const mockWall = {
            id: 'wall_door_cutout',
            attachedWidgets: [
                {
                    type: 'door',
                    width: 90,
                    height: 210,
                    elevation: 0,
                    t: 0.5 // Centered at X = 250 on a 500cm wall -> cutout [205, 295]
                }
            ]
        };

        const moldData = {
            id: 'skirt_door_test',
            type: 'molding_skirting_flat',
            profileType: 'skirting_flat',
            width: 500,
            depth: 2,
            moldingHeight: 12,
            heightOffset: 0,
            side: 'left'
        };

        const segments = builder.getMoldingSegments(500, 0, 12, mockWall);
        expect(segments.length).toBe(2);
        expect(segments[0].start).toBeCloseTo(0);
        expect(segments[0].end).toBeCloseTo(202.45);
        expect(segments[1].start).toBeCloseTo(297.55);
        expect(segments[1].end).toBeCloseTo(500);

        const group = builder.buildMolding(moldData, 500, 20, null, mockWall);
        expect(group.children.length).toBe(2);
        expect(group.children[0].isMesh).toBe(true);
        expect(group.children[1].isMesh).toBe(true);
    });
});


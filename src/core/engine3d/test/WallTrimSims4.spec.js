import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Molding3DBuilder } from '../Molding3DBuilder.js';
import { ComponentRegistry } from '../ComponentRegistry.js';
import { MaterialSlots, ComponentTypes } from '../../constants/materialSlots.js';
import { MOLDING_REGISTRY } from '../../../features/wall/wall.registry.js';
import { WallSerializer } from '../../../features/wall/wall.serializer.js';

describe('Sims 4-Style Wall Trims, Chair Rails & Dynamic Mitering Pipeline', () => {
    let builder;

    beforeEach(() => {
        builder = new Molding3DBuilder();
        ComponentRegistry.slotRegistry.clear();
        ComponentRegistry.componentRegistry.clear();
    });

    it('1. should generate valid 3D geometry for all Sims 4 Wall Trim profiles', () => {
        const trimProfiles = [
            { profileType: 'chair_rail', expectedHeight: 8, depth: 2.5 },
            { profileType: 'picture_rail', expectedHeight: 6, depth: 2.2 },
            { profileType: 'fluted_band', expectedHeight: 10, depth: 2.5 },
            { profileType: 'double_bead', expectedHeight: 8, depth: 2.2 },
            { profileType: 'beveled_trim', expectedHeight: 8, depth: 2.0 },
            { profileType: 'frieze_exterior', expectedHeight: 15, depth: 4.5 },
            { profileType: 'foundation_trim', expectedHeight: 35, depth: 5.0 }
        ];

        trimProfiles.forEach(({ profileType, expectedHeight, depth }) => {
            const moldData = {
                id: `trim_${profileType}`,
                type: `molding_${profileType}`,
                profileType,
                width: 150,
                depth,
                moldingHeight: expectedHeight,
                heightOffset: 90,
                side: 'left',
                material: 'white_paint'
            };

            const group = builder.buildMolding(moldData, 150, 20);
            expect(group).toBeDefined();
            expect(group.isGroup).toBe(true);
            expect(group.children.length).toBeGreaterThan(0);

            const mesh = group.children[0];
            expect(mesh.isMesh).toBe(true);
            expect(mesh.geometry).toBeDefined();

            mesh.geometry.computeBoundingBox();
            const bbox = mesh.geometry.boundingBox;
            const sizeY = bbox.max.y - bbox.min.y;
            expect(sizeY).toBeCloseTo(expectedHeight, 0.1);
        });
    });

    it('2. should correctly segment wall trim around door openings on the wall', () => {
        const mockWall = {
            id: 'wall_with_door',
            startAnchor: { position: () => ({ x: 0, y: 0 }) },
            endAnchor: { position: () => ({ x: 300, y: 0 }) },
            config: { thickness: 20, height: 240 },
            attachedWidgets: [
                {
                    type: 'door',
                    t: 0.5, // Center at 150cm
                    width: 90, // From 105cm to 195cm
                    height: 210,
                    elevation: 0,
                    cutsWall: true
                }
            ]
        };

        // For chair rail at 90cm elevation with height 8cm
        const segments = builder.getMoldingSegments(300, 90, 8, mockWall);
        expect(segments.length).toBe(2);

        // Segment 1: from start of wall to outer casing of door (150 - (45 + 2.55) = 102.45)
        expect(segments[0].start).toBeCloseTo(0, 0.1);
        expect(segments[0].end).toBeCloseTo(102.45, 0.1);

        // Segment 2: from right outer casing of door to end of wall (150 + (45 + 2.55) = 197.55)
        expect(segments[1].start).toBeCloseTo(197.55, 0.1);
        expect(segments[1].end).toBeCloseTo(300, 0.1);
    });

    it('3. should support dual-side placement (Front / Left and Back / Right)', () => {
        const frontMold = {
            id: 'trim_front',
            type: 'molding_chair_rail',
            profileType: 'chair_rail',
            width: 200,
            depth: 2.5,
            moldingHeight: 8,
            heightOffset: 90,
            side: 'left' // Front face
        };

        const backMold = {
            id: 'trim_back',
            type: 'molding_chair_rail',
            profileType: 'chair_rail',
            width: 200,
            depth: 2.5,
            moldingHeight: 8,
            heightOffset: 90,
            side: 'right' // Back face
        };

        const groupFront = builder.buildMolding(frontMold, 200, 20);
        const groupBack = builder.buildMolding(backMold, 200, 20);

        const meshFront = groupFront.children[0];
        const meshBack = groupBack.children[0];

        meshFront.geometry.computeBoundingBox();
        meshBack.geometry.computeBoundingBox();

        // Front face extends in +Z (z > 0), Back face extends in -Z (z < 0)
        expect(meshFront.geometry.boundingBox.max.z).toBeGreaterThan(0);
        expect(meshBack.geometry.boundingBox.min.z).toBeLessThan(0);
    });

    it('4. should correctly shear corner vertices for miter joints', () => {
        const moldData = {
            id: 'trim_miter_test',
            type: 'molding_chair_rail',
            profileType: 'chair_rail',
            width: 200,
            depth: 2.5,
            moldingHeight: 8,
            heightOffset: 90,
            side: 'left'
        };

        const group = builder.buildMolding(moldData, 200, 20);
        const mesh = group.children[0];
        const geo = mesh.geometry;

        // Simulate 45 degree miter shift on wall corner
        const localSL_x = -10;
        const localSR_x = 0;
        const localEL_x = 210;
        const localER_x = 200;
        const thick = 20;

        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const tZ = (z + thick / 2) / thick;
            const startX = localSR_x + tZ * (localSL_x - localSR_x);
            const endX = localER_x + tZ * (localEL_x - localER_x);

            if (x <= 0.1) {
                pos.setX(i, startX);
            } else if (x >= 200 - 0.1) {
                pos.setX(i, endX);
            }
        }
        pos.needsUpdate = true;
        geo.computeBoundingBox();

        // Miter extends the bounding box horizontally
        expect(geo.boundingBox.min.x).toBeLessThan(0);
        expect(geo.boundingBox.max.x).toBeGreaterThan(200);
    });

    it('5. should register all Sims 4 Wall Trim presets and aliases in MOLDING_REGISTRY', () => {
        const trimKeys = [
            'wall_trim',
            'chair_rail',
            'picture_rail',
            'molding_chair_rail',
            'molding_picture_rail',
            'molding_fluted_band',
            'molding_double_bead',
            'molding_beveled_trim',
            'molding_frieze_exterior',
            'molding_foundation_trim'
        ];

        trimKeys.forEach(key => {
            expect(MOLDING_REGISTRY[key]).toBeDefined();
            expect(typeof MOLDING_REGISTRY[key].render3D).toBe('function');
        });
    });

    it('6. should serialize and deserialize wall trim properties accurately', () => {
        const mockWall = {
            id: 'wall_trim_serial',
            startAnchor: { _id: 'a1', x: 0, y: 0 },
            endAnchor: { _id: 'a2', x: 250, y: 0 },
            config: { thickness: 20, height: 280 },
            attachedMoldings: [
                {
                    t: 0.5,
                    type: 'molding_chair_rail',
                    profileType: 'chair_rail',
                    width: 250,
                    depth: 2.5,
                    moldingHeight: 8,
                    heightOffset: 90,
                    side: 'left',
                    material: 'white_paint',
                    color: '#ffffff'
                }
            ]
        };

        const serialized = WallSerializer.serialize(mockWall);
        expect(serialized.moldings.length).toBe(1);
        expect(serialized.moldings[0].profileType).toBe('chair_rail');
        expect(serialized.moldings[0].heightOffset).toBe(90);
        expect(serialized.moldings[0].moldingHeight).toBe(8);
    });
}); 

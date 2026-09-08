import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MOLDING_REGISTRY, MOLDING_PROFILES, MOLDING_CATALOG } from '../molding.registry.js';
import { generateMoldingProfileShape, calculateMoldingSegments, normalizeExtrudeUVs } from '../molding.geometry.js';
import { buildMoldingMesh3D, renderMolding3D } from '../molding.renderer3d.js';
import { renderMolding2D } from '../molding.renderer2d.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';
import { MaterialSlots, ComponentTypes } from '../../../core/constants/materialSlots.js';

describe('Molding Feature Centralization Suite', () => {
    beforeEach(() => {
        ComponentRegistry.slotRegistry.clear();
        ComponentRegistry.componentRegistry.clear();
    });

    describe('1. Authoritative Registry & Catalog', () => {
        it('should contain all canonical profiles in MOLDING_PROFILES', () => {
            const expectedProfiles = [
                'skirting_flat', 'skirting_beveled', 'skirting_torus', 'skirting_ogee',
                'skirting_craftsman', 'skirting_shadow', 'skirting_scotia', 'skirting_shoe',
                'chair_rail', 'picture_rail', 'fluted_band', 'double_bead', 'beveled_trim',
                'flat', 'frame', 'groove', 'frieze_exterior', 'foundation_trim',
                'crown', 'ogee', 'egg_and_dart', 'dentil', 'craftsman', 'layered'
            ];
            expectedProfiles.forEach(p => {
                expect(MOLDING_PROFILES[p], `Missing profile: ${p}`).toBeDefined();
                expect(MOLDING_PROFILES[p].category).toBeDefined();
            });
        });

        it('should contain full catalog presets in MOLDING_CATALOG', () => {
            expect(MOLDING_CATALOG.length).toBeGreaterThan(10);
            const chairRail = MOLDING_CATALOG.find(c => c.id === 'molding_chair_rail');
            expect(chairRail).toBeDefined();
            expect(chairRail.params.profileType).toBe('chair_rail');
            expect(chairRail.params.heightOffset).toBe(90);
        });

        it('should expose render3D for thumbnail generation on every registry item', () => {
            const keys = Object.keys(MOLDING_REGISTRY);
            keys.forEach(k => {
                expect(typeof MOLDING_REGISTRY[k].render3D).toBe('function');
            });
        });
    });

    describe('2. Authoritative Geometry & Cutouts', () => {
        it('should generate valid 2D THREE.Shape for every profile', () => {
            Object.keys(MOLDING_PROFILES).forEach(profileKey => {
                const shape = generateMoldingProfileShape(profileKey, 4, 12);
                expect(shape).toBeDefined();
                expect(shape.curves.length).toBeGreaterThan(0);
            });
        });

        it('should accurately segment wall around doors and cutouts', () => {
            const mockWall = {
                id: 'wall_with_door',
                attachedWidgets: [
                    {
                        type: 'door',
                        localX: 150,
                        width: 90,
                        height: 210,
                        elevation: 0
                    }
                ]
            };

            const segments = calculateMoldingSegments(300, 0, 12, mockWall);
            expect(segments.length).toBe(2);
            expect(segments[0].start).toBeCloseTo(0, 0.1);
            expect(segments[0].end).toBeCloseTo(150 - (45 + 2.55), 0.1);
            expect(segments[1].start).toBeCloseTo(150 + (45 + 2.55), 0.1);
            expect(segments[1].end).toBeCloseTo(300, 0.1);
        });

        it('should correctly normalize ExtrudeGeometry UVs without stretching', () => {
            const shape = generateMoldingProfileShape('skirting_flat', 2, 12);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 100, bevelEnabled: false });
            normalizeExtrudeUVs(geo, 100, 12, 2, 0, 0);

            const uvs = geo.attributes.uv;
            expect(uvs).toBeDefined();
            for (let i = 0; i < uvs.count; i++) {
                expect(uvs.getX(i)).toBeGreaterThanOrEqual(-0.01);
                expect(uvs.getX(i)).toBeLessThanOrEqual(1.01);
                expect(uvs.getY(i)).toBeGreaterThanOrEqual(-0.01);
                expect(uvs.getY(i)).toBeLessThanOrEqual(1.01);
            }
        });
    });

    describe('3. 3D Mesh Construction & ComponentRegistry', () => {
        it('should construct 3D group and register with MaterialSlots.MOLDING for trims', () => {
            const moldData = {
                id: 'test_chair_rail_1',
                type: 'molding_chair_rail',
                profileType: 'chair_rail',
                width: 200,
                depth: 2.5,
                moldingHeight: 8,
                heightOffset: 90,
                side: 'left',
                material: 'white_paint'
            };

            const group = buildMoldingMesh3D(moldData, 200, 20);
            expect(group).toBeDefined();
            expect(group.isGroup).toBe(true);

            const meshes = ComponentRegistry.getMeshesForSlot(moldData.id, MaterialSlots.MOLDING);
            expect(meshes.length).toBeGreaterThanOrEqual(1);
            expect(meshes[0].userData.materialSlot).toBe(MaterialSlots.MOLDING);
            expect(meshes[0].userData.componentType).toBe(ComponentTypes.MOLDING);
        });

        it('should register skirting with MaterialSlots.SKIRTING', () => {
            const moldData = {
                id: 'test_skirting_1',
                type: 'molding_skirting_ogee',
                profileType: 'skirting_ogee',
                width: 150,
                depth: 2.5,
                moldingHeight: 15,
                heightOffset: 0,
                side: 'left',
                material: 'wood_dark'
            };

            const group = buildMoldingMesh3D(moldData, 150, 15);
            expect(group).toBeDefined();

            const meshes = ComponentRegistry.getMeshesForSlot(moldData.id, MaterialSlots.SKIRTING);
            expect(meshes.length).toBeGreaterThanOrEqual(1);
            expect(meshes[0].userData.materialSlot).toBe(MaterialSlots.SKIRTING);
        });

        it('should support slot-wide highlighting', () => {
            const moldData = {
                id: 'test_skirting_highlight',
                type: 'molding_skirting_flat',
                profileType: 'skirting_flat',
                width: 100,
                depth: 2,
                moldingHeight: 12,
                heightOffset: 0
            };

            const group = buildMoldingMesh3D(moldData, 100, 10);
            const mesh = group.children[0];

            ComponentRegistry.setSlotHighlight(moldData.id, MaterialSlots.SKIRTING, true, 0x00f0ff);
            expect(mesh.material.emissive.getHex()).toBe(0x00f0ff);

            ComponentRegistry.setSlotHighlight(moldData.id, MaterialSlots.SKIRTING, false);
            expect(mesh.material.emissive.getHex()).toBe(0x000000);
        });
    });
});

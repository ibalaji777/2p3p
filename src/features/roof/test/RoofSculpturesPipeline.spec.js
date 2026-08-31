import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RoofSculpture3DBuilder } from '../builders/RoofSculpture3DBuilder.js';
import { Roof3DBuilder } from '../builders/Roof3DBuilder.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';

describe('Sims 4 Roof Ridge Cresting, Apex Finials & Chimney Stacks Pipeline', () => {
    const createMockCtx = () => {
        const targetGroup = new THREE.Group();
        return {
            mockCtx: {
                scene: new THREE.Scene(),
                structureGroup: targetGroup,
                interactables: [],
                helpers: {
                    getDynamicMaterial: (id, type) => {
                        return new THREE.MeshStandardMaterial({ color: 0x222222 });
                    }
                },
                assets: {
                    getTexture: () => Promise.resolve(new THREE.Texture())
                }
            },
            targetGroup
        };
    };

    describe('RoofSculpture3DBuilder - Parametric Geometries', () => {
        it('builds Victorian Lace Wrought Iron Ridge Cresting with scrolls and fleur-de-lis', () => {
            const { mockCtx } = createMockCtx();
            const builder = new RoofSculpture3DBuilder(mockCtx);
            const dummyRoof = { id: 'roof_test_1', points: [{x: 0, y: 0}, {x: 300, y: 0}, {x: 300, y: 200}, {x: 0, y: 200}] };

            const crestingConfig = {
                id: 'cr_1',
                type: 'ridge_cresting_victorian_lace',
                height: 18,
                spacing: 22,
                material: 'metal_wrought_iron'
            };

            const group = builder.buildRidgeCresting(crestingConfig, 300, dummyRoof);
            expect(group).toBeDefined();
            expect(group.userData.isRoofSculpture).toBe(true);
            expect(group.userData.sculptureType).toBe('cresting');

            // Verify children: base rail, top rail, scrollwork arches, fleur-de-lis cones, and end spires
            expect(group.children.length).toBeGreaterThan(0);
            const laceSubGroup = group.children[0];
            expect(laceSubGroup.children.length).toBeGreaterThan(5);

            // Verify CAD/BIM ComponentRegistry registration
            const registered = ComponentRegistry.getMeshesForSlot(dummyRoof, 'sculpture');
            expect(registered.length).toBeGreaterThan(0);
        });

        it('builds Gothic Spikes Wrought Iron Cresting with sharp spearheads and end posts', () => {
            const { mockCtx } = createMockCtx();
            const builder = new RoofSculpture3DBuilder(mockCtx);
            const dummyRoof = { id: 'roof_test_2' };

            const crestingConfig = {
                id: 'cr_2',
                type: 'ridge_cresting_gothic_spikes',
                height: 20,
                spacing: 16,
                material: 'metal_dark_steel'
            };

            const group = builder.buildRidgeCresting(crestingConfig, 250, dummyRoof);
            expect(group).toBeDefined();
            const gothicSubGroup = group.children[0];
            expect(gothicSubGroup.children.length).toBeGreaterThan(10);
        });

        it('builds Modern Standing Seam Metal Ridge Cap Strip', () => {
            const { mockCtx } = createMockCtx();
            const builder = new RoofSculpture3DBuilder(mockCtx);
            const dummyRoof = { id: 'roof_test_3' };

            const crestingConfig = {
                id: 'cr_3',
                type: 'ridge_cresting_metal_cap',
                height: 8,
                material: 'galvanized_steel'
            };

            const group = builder.buildRidgeCresting(crestingConfig, 400, dummyRoof);
            expect(group).toBeDefined();
            const capSubGroup = group.children[0];
            expect(capSubGroup.children.length).toBeGreaterThan(2);
        });

        it('builds Victorian Iron Spire Finial with turned spheres and needle pinnacle', () => {
            const { mockCtx } = createMockCtx();
            const builder = new RoofSculpture3DBuilder(mockCtx);
            const dummyRoof = { id: 'roof_test_fin_1' };

            const finialConfig = {
                id: 'fin_1',
                type: 'finial_victorian_spire',
                height: 45,
                scale: 1.0,
                material: 'metal_wrought_iron'
            };

            const group = builder.buildApexFinial(finialConfig, dummyRoof);
            expect(group).toBeDefined();
            expect(group.userData.isRoofSculpture).toBe(true);
            expect(group.userData.sculptureType).toBe('finial');

            const registered = ComponentRegistry.getMeshesForSlot(dummyRoof, 'sculpture');
            expect(registered.length).toBeGreaterThan(0);
        });

        it('builds Weather Rooster Vane with directional compass cross arms and rooster silhouette', () => {
            const { mockCtx } = createMockCtx();
            const builder = new RoofSculpture3DBuilder(mockCtx);
            const dummyRoof = { id: 'roof_test_vane' };

            const finialConfig = {
                id: 'vane_1',
                type: 'finial_weather_rooster',
                height: 55,
                scale: 1.2,
                rotation: 45,
                material: 'metal_wrought_iron'
            };

            const group = builder.buildApexFinial(finialConfig, dummyRoof);
            expect(group).toBeDefined();
            const vaneSub = group.children[0];
            expect(vaneSub.children.length).toBeGreaterThan(5); // base, rod, spheres, cross arms, letter badges, rooster group
        });

        it('builds Traditional Red Brick Chimney Stack with limestone coping and dual terracotta flues', () => {
            const { mockCtx } = createMockCtx();
            const builder = new RoofSculpture3DBuilder(mockCtx);
            const dummyRoof = { id: 'roof_test_chim_1' };

            const chimneyConfig = {
                id: 'ch_1',
                type: 'chimney_brick_traditional',
                width: 45,
                depth: 45,
                height: 90,
                material: 'red_brick',
                capMaterial: 'limestone',
                potMaterial: 'terracotta_clay'
            };

            const group = builder.buildChimneyStack(chimneyConfig, dummyRoof);
            expect(group).toBeDefined();
            expect(group.userData.isRoofSculpture).toBe(true);
            expect(group.userData.sculptureType).toBe('chimney');

            const registered = ComponentRegistry.getMeshesForSlot(dummyRoof, 'sculpture');
            expect(registered.length).toBeGreaterThan(0);
        });

        it('builds Modern Stove Metal Flue Pipe with flashing skirt, storm collar, and spark arrestor rain cap', () => {
            const { mockCtx } = createMockCtx();
            const builder = new RoofSculpture3DBuilder(mockCtx);
            const dummyRoof = { id: 'roof_test_flue' };

            const flueConfig = {
                id: 'flue_1',
                type: 'chimney_metal_flue',
                width: 24,
                depth: 24,
                height: 110,
                material: 'metal_dark_steel'
            };

            const group = builder.buildChimneyStack(flueConfig, dummyRoof);
            expect(group).toBeDefined();
            const flueSub = group.children[0];
            expect(flueSub.children.length).toBeGreaterThan(4);
        });
    });

    describe('Roof Ridge & Apex Calculation Algorithms', () => {
        it('calculates exact ridge segments and apex endpoints on a Gable Roof', () => {
            const { mockCtx } = createMockCtx();
            const builder = new Roof3DBuilder(mockCtx);

            const gableRoof = {
                id: 'gable_1',
                points: [
                    { x: 0, y: 0 },
                    { x: 400, y: 0 },
                    { x: 400, y: 300 },
                    { x: 0, y: 300 }
                ],
                config: {
                    roofType: 'gable',
                    pitch: 30,
                    ridgeAxis: 'x',
                    overhang: 0
                }
            };

            const segments = builder.getRoofRidgeSegments(gableRoof);
            expect(segments.length).toBe(1);
            expect(segments[0].axis).toBe('x');
            expect(segments[0].length).toBe(400);
            expect(segments[0].center.x).toBe(0);
            expect(segments[0].center.z).toBe(0);
            expect(segments[0].center.y).toBeCloseTo(Math.tan(30 * Math.PI / 180) * 150, 1);

            const apexes = builder.getRoofApexPoints(gableRoof);
            expect(apexes.length).toBe(2);
            expect(apexes[0].id).toBe('start');
            expect(apexes[1].id).toBe('end');
            expect(apexes[0].x).toBe(-200);
            expect(apexes[1].x).toBe(200);
        });

        it('calculates central ridge and hip apexes on a Hip Roof', () => {
            const { mockCtx } = createMockCtx();
            const builder = new Roof3DBuilder(mockCtx);

            const hipRoof = {
                id: 'hip_1',
                points: [
                    { x: 0, y: 0 },
                    { x: 500, y: 0 },
                    { x: 500, y: 300 },
                    { x: 0, y: 300 }
                ],
                config: {
                    roofType: 'hip',
                    pitch: 35,
                    overhang: 0
                }
            };

            const segments = builder.getRoofRidgeSegments(hipRoof);
            expect(segments.length).toBe(1);
            expect(segments[0].length).toBe(200); // 500 - 300 = 200 cm central ridge

            const apexes = builder.getRoofApexPoints(hipRoof);
            expect(apexes.length).toBe(2);
            expect(apexes[0].x).toBe(-100);
            expect(apexes[1].x).toBe(100);
        });

        it('calculates single peak apex on a Turret Roof', () => {
            const { mockCtx } = createMockCtx();
            const builder = new Roof3DBuilder(mockCtx);

            const turretRoof = {
                id: 'turret_1',
                points: [
                    { x: 0, y: 0 },
                    { x: 200, y: 0 },
                    { x: 200, y: 200 },
                    { x: 0, y: 200 }
                ],
                config: {
                    roofType: 'turret_octagonal',
                    pitch: 50,
                    overhang: 0
                }
            };

            const apexes = builder.getRoofApexPoints(turretRoof);
            expect(apexes.length).toBe(1);
            expect(apexes[0].id).toBe('center');
            expect(apexes[0].x).toBe(0);
            expect(apexes[0].z).toBe(0);
            expect(apexes[0].y).toBeCloseTo(Math.tan(50 * Math.PI / 180) * 100, 1);
        });
    });

    describe('Full Roof Assembly with Attached Sculptures & Material Independence', () => {
        it('builds a complete Gable Roof with Victorian Iron Ridge Cresting, Spire Finials, and Brick Chimney', () => {
            const { mockCtx, targetGroup } = createMockCtx();
            const builder = new Roof3DBuilder(mockCtx);

            const roofEntity = {
                id: 'roof_victorian_manor',
                type: 'roof',
                points: [
                    { x: 0, y: 0 },
                    { x: 600, y: 0 },
                    { x: 600, y: 400 },
                    { x: 0, y: 400 }
                ],
                config: {
                    roofType: 'gable',
                    pitch: 35,
                    material: 'grey_slate_roof',
                    crestings: [
                        {
                            id: 'crest_main',
                            type: 'ridge_cresting_victorian_lace',
                            material: 'metal_wrought_iron',
                            height: 18
                        }
                    ],
                    finials: [
                        {
                            id: 'fin_apexes',
                            type: 'finial_victorian_spire',
                            position: 'both_apexes',
                            material: 'metal_wrought_iron',
                            height: 45
                        }
                    ],
                    chimneys: [
                        {
                            id: 'chim_main',
                            type: 'chimney_brick_traditional',
                            material: 'red_brick',
                            width: 45,
                            depth: 45,
                            height: 90,
                            u: 0.75,
                            v: 0.25
                        }
                    ]
                }
            };

            builder.buildRoofs([roofEntity], targetGroup);

            expect(targetGroup.children.length).toBe(1);
            const roofGroup = targetGroup.children[0];

            // 1. Check roof main mesh
            const roofMesh = roofGroup.children.find(c => c.userData && c.userData.isRoof && c.userData.materialSlot === 'top');
            expect(roofMesh).toBeDefined();

            // 2. Check attached cresting
            const crestMesh = roofGroup.children.find(c => c.name?.startsWith('cresting_'));
            expect(crestMesh).toBeDefined();
            expect(crestMesh.userData.sculptureType).toBe('cresting');

            // 3. Check attached finials (2 finials for both_apexes)
            const finialMeshes = roofGroup.children.filter(c => c.name?.startsWith('finial_'));
            expect(finialMeshes.length).toBe(2);

            // 4. Check attached chimney
            const chimneyMesh = roofGroup.children.find(c => c.name?.startsWith('chimney_'));
            expect(chimneyMesh).toBeDefined();
            expect(chimneyMesh.userData.sculptureType).toBe('chimney');

            // 5. Verify Material Independence Rule:
            // The roof top mesh still has materialSlot: 'top' and its assigned slate material
            expect(roofMesh.userData.materialSlot).toBe('top');
            const registeredTop = ComponentRegistry.getMeshesForSlot(roofEntity, 'top');
            expect(registeredTop.includes(roofMesh)).toBe(true);

            // The sculpture meshes belong strictly to slot 'sculpture'
            const registeredSculptures = ComponentRegistry.getMeshesForSlot(roofEntity, 'sculpture');
            expect(registeredSculptures.length).toBeGreaterThan(0);
            expect(registeredSculptures.includes(roofMesh)).toBe(false);
        });
    });
});

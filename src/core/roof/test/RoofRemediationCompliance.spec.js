import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { RoofEngine } from '../RoofEngine.js';
import { RoofMutationEngine } from '../RoofMutationEngine.js';
import { RoofTopologyEngine } from '../RoofTopologyEngine.js';
import { RoofSerializer } from '../RoofSerializer.js';
import { DuplicateEntityCommand } from '../../commands/DuplicateEntityCommand.js';
import { UniversalRealtimeUpdate } from '../../sync/UniversalRealtimeUpdate.js';
import { PremiumHipRoof } from '../../../features/roof/roof.renderer2d.js';
import { FloorPlanner } from '../../engine2d/index.js';
import * as THREE from 'three';

describe('Roof Remediation Compliance & Architectural Invariants', () => {
    let mockPlanner;

    beforeAll(() => {
        if (typeof HTMLCanvasElement !== 'undefined') {
            HTMLCanvasElement.prototype.getContext = () => ({
                clearRect: () => {},
                fillRect: () => {},
                getImageData: () => ({ data: new Uint8ClampedArray(4) }),
                putImageData: () => {},
                createImageData: () => ({ data: new Uint8ClampedArray(4) }),
                setTransform: () => {},
                drawImage: () => {},
                save: () => {},
                restore: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                closePath: () => {},
                stroke: () => {},
                fill: () => {},
                scale: () => {},
                translate: () => {},
                rotate: () => {},
                arc: () => {},
                measureText: () => ({ width: 0 })
            });
        }
    });

    beforeEach(() => {
        const updateRoofLive = vi.fn();
        mockPlanner = {
            roofs: [],
            walls: [],
            furniture: [],
            stairs: [],
            roofLayer: {
                add: vi.fn(),
                children: []
            },
            stage: {
                batchDraw: vi.fn()
            },
            envBuilder: {
                updateRoofLive
            },
            ctx: {
                requestRender: vi.fn(),
                envBuilder: {
                    updateRoofLive
                }
            },
            debouncedSaveHistory: vi.fn(),
            syncAll: vi.fn(),
            selectEntity: vi.fn()
        };
    });

    describe('1. Complete Lossless Serialization Round-Trip', () => {
        it('serializes and deserializes flipSlope, autoPlacementMode, tileSize, and fasciaMaterial losslessly', () => {
            const pts = [
                { x: 0, y: 0 },
                { x: 200, y: 0 },
                { x: 200, y: 150 },
                { x: 0, y: 150 }
            ];
            const roof = RoofEngine.createRoof(mockPlanner, pts, {
                roofType: 'shed',
                pitch: 25,
                flipSlope: true,
                autoPlacementMode: 'inner',
                tileSize: 150,
                fasciaMaterial: 'wood_dark_oak',
                gableMaterial: 'brick_red',
                material: 'slate_black_roof'
            });

            expect(roof.config.flipSlope).toBe(true);
            expect(roof.config.autoPlacementMode).toBe('inner');
            expect(roof.tileSize).toBe(150);
            expect(roof.config.fasciaMaterial).toBe('wood_dark_oak');

            const serialized = RoofEngine.serialize(roof);
            expect(serialized.flipSlope).toBe(true);
            expect(serialized.autoPlacementMode).toBe('inner');
            expect(serialized.tileSize).toBe(150);
            expect(serialized.fasciaMaterial).toBe('wood_dark_oak');
            expect(serialized.gableMaterial).toBe('brick_red');
            expect(serialized.material).toBe('slate_black_roof');

            const restored = RoofEngine.deserialize(serialized, mockPlanner, { addToPlanner: true });
            expect(restored).toBeDefined();
            expect(restored.config.flipSlope).toBe(true);
            expect(restored.config.autoPlacementMode).toBe('inner');
            expect(restored.tileSize).toBe(150);
            expect(restored.config.fasciaMaterial).toBe('wood_dark_oak');
            expect(restored.config.gableMaterial).toBe('brick_red');
            expect(restored.config.material).toBe('slate_black_roof');
            expect(restored.points.length).toBe(4);
        });

        it('handles backwards-compatible defaults when deserializing legacy roof data', () => {
            const legacyData = {
                id: 'roof_legacy_1',
                points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
                pitch: 35
            };

            const restored = RoofEngine.deserialize(legacyData, mockPlanner);
            expect(restored).toBeDefined();
            expect(restored.config.flipSlope).toBe(false);
            expect(restored.config.autoPlacementMode).toBe('manual');
            expect(restored.config.pitch).toBe(35);
        });
    });

    describe('2. Addon Updates via updateAddon across all categories', () => {
        it('updates chimneys, finials, crestings, and skylights via updateAddon', () => {
            const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);

            // Add addons
            const chimney = RoofEngine.addChimney(roof, { type: 'chimney_brick_traditional', width: 50, depth: 50 }, mockPlanner);
            const finial = RoofEngine.addFinial(roof, { type: 'finial_victorian_spire', scale: 1.0 }, mockPlanner);
            const cresting = RoofEngine.addCresting(roof, { type: 'ridge_cresting_victorian_lace', height: 18 }, mockPlanner);
            const skylight = RoofEngine.addSkylight(roof, { type: 'skylight_velux_frame', width: 80 }, mockPlanner);

            // Update chimney
            const chRes = RoofEngine.updateAddon(roof, 'chimney', chimney.id, { width: 75, height: 140 }, mockPlanner);
            expect(chRes).toBe(true);
            expect(chimney.width).toBe(75);
            expect(chimney.height).toBe(140);

            // Update finial
            const finRes = RoofEngine.updateAddon(roof, 'finial', finial.id, { scale: 1.8, material: 'copper' }, mockPlanner);
            expect(finRes).toBe(true);
            expect(finial.scale).toBe(1.8);
            expect(finial.material).toBe('copper');

            // Update cresting
            const crRes = RoofEngine.updateAddon(roof, 'cresting', cresting.id, { height: 28, spacing: 30 }, mockPlanner);
            expect(crRes).toBe(true);
            expect(cresting.height).toBe(28);
            expect(cresting.spacing).toBe(30);

            // Update skylight
            const skRes = RoofEngine.updateAddon(roof, 'skylight', skylight.id, { width: 110, transparency: 0.85 }, mockPlanner);
            expect(skRes).toBe(true);
            expect(skylight.width).toBe(110);
            expect(skylight.transparency).toBe(0.85);

            expect(mockPlanner.envBuilder.updateRoofLive).toHaveBeenCalled();
        });
    });

    describe('3. Atomic batchUpdate with Single Synchronization Cycle', () => {
        it('applies multiple property updates atomically with single notifyRoofUpdated', () => {
            const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);

            const notifySpy = vi.spyOn(RoofMutationEngine, 'notifyRoofUpdated');

            RoofEngine.batchUpdate(roof, {
                pitch: 45,
                curve: -10,
                overhang: 14,
                thickness: 12,
                wallGap: 5,
                roofType: 'gable',
                ridgeAxis: 'y',
                flipSlope: true,
                autoShapeWalls: true,
                tileSize: 120,
                slopes: { slope1: 'slate_grey', slope2: 'terracotta' }
            }, mockPlanner);

            expect(roof.config.pitch).toBe(45);
            expect(roof.config.curve).toBe(-10);
            expect(roof.config.overhang).toBe(14);
            expect(roof.config.thickness).toBe(12);
            expect(roof.config.wallGap).toBe(5);
            expect(roof.config.roofType).toBe('gable');
            expect(roof.config.ridgeAxis).toBe('y');
            expect(roof.config.flipSlope).toBe(true);
            expect(roof.config.autoShapeWalls).toBe(true);
            expect(roof.tileSize).toBe(120);
            expect(roof.config.slopes.slope1).toBe('slate_grey');
            expect(roof.config.slopes.slope2).toBe('terracotta');

            // Must only notify once during batchUpdate
            expect(notifySpy).toHaveBeenCalledTimes(1);
            notifySpy.mockRestore();
        });
    });

    describe('4. duplicateRoof & DuplicateEntityCommand Undo/Redo', () => {
        it('duplicates a roof entity with full structural cloning and offset', () => {
            const pts = [{ x: 10, y: 10 }, { x: 210, y: 10 }, { x: 210, y: 110 }, { x: 10, y: 110 }];
            const source = RoofEngine.createRoof(mockPlanner, pts, {
                pitch: 35,
                curve: 5,
                overhang: 10,
                tileSize: 140
            });
            source.x = 50;
            source.y = 60;
            source.group = { x: () => 50, y: () => 60, position: vi.fn() };

            const dup = RoofEngine.duplicateRoof(mockPlanner, source, { x: 40, y: 40 });
            expect(dup).toBeDefined();
            expect(dup.id).not.toBe(source.id);
            expect(dup.config.pitch).toBe(35);
            expect(dup.config.curve).toBe(5);
            expect(dup.config.overhang).toBe(10);
            expect(dup.tileSize).toBe(140);
            expect(mockPlanner.roofs).toContain(dup);
        });

        it('executes, undoes, and redoes DuplicateEntityCommand losslessly for a roof', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const sourceRoof = RoofEngine.createRoof(mockPlanner, pts, {
                pitch: 40,
                roofType: 'gable',
                material: 'grey_slate_roof'
            });

            const cmd = new DuplicateEntityCommand(mockPlanner, sourceRoof.id);

            // Execute (first duplication)
            cmd.execute();
            expect(cmd.createdEntity).toBeDefined();
            const duplicatedId = cmd.createdEntity.id;
            expect(mockPlanner.roofs.some(r => r.id === duplicatedId)).toBe(true);

            // Undo (deletion of duplicated entity)
            cmd.undo();
            expect(mockPlanner.roofs.some(r => r.id === duplicatedId)).toBe(false);

            // Redo (restoration via deserialize)
            cmd.execute();
            expect(cmd.createdEntity).toBeDefined();
            expect(cmd.createdEntity.id).toBe(duplicatedId);
            expect(mockPlanner.roofs.some(r => r.id === duplicatedId)).toBe(true);
            expect(cmd.createdEntity.config.pitch).toBe(40);
        });
    });

    describe('5. UniversalRealtimeUpdate & In-Place 3D Updates', () => {
        it('dispatches updateRoofLive via rebuildMeshInPlace for roof entities', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);
            roof.mesh3D = new THREE.Group();

            const mock3DContext = {
                envBuilder: {
                    updateRoofLive: vi.fn()
                },
                requestRender: vi.fn(),
                scene: new THREE.Scene()
            };

            const realtime = new UniversalRealtimeUpdate(mock3DContext);
            const updated = realtime.rebuildMeshInPlace(roof);
            expect(updated).toBe(true);
            expect(mock3DContext.envBuilder.updateRoofLive).toHaveBeenCalledWith(roof);
            expect(mock3DContext.requestRender).toHaveBeenCalled();
        });

        it('dispatches updateRoofLive on parentRoof for roof_addon entities', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);
            const addon = {
                type: 'roof_addon',
                addonType: 'chimney',
                parentRoof: roof
            };

            const mock3DContext = {
                envBuilder: {
                    updateRoofLive: vi.fn()
                },
                requestRender: vi.fn()
            };

            const realtime = new UniversalRealtimeUpdate(mock3DContext);
            const updated = realtime.rebuildMeshInPlace(addon);
            expect(updated).toBe(true);
            expect(mock3DContext.envBuilder.updateRoofLive).toHaveBeenCalledWith(roof);
        });
    });

    describe('6. PremiumHipRoof update2D Entity Contract', () => {
        it('provides update2D method conforming to standard 2D scene contract', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = new PremiumHipRoof(mockPlanner, pts);

            expect(typeof roof.update2D).toBe('function');
            const geomSpy = vi.spyOn(roof, 'updateGeometry');
            roof.update2D();
            expect(geomSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('7. FloorPlanner Export & Snapshot Integration', () => {
        it('exports state with roofs without throwing ReferenceError: RoofSerializer is not defined', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);

            const fakeFloorPlanner = {
                anchors: [],
                walls: [],
                furniture: [],
                stairs: [],
                roofs: [roof],
                arcs: [],
                shapes: [],
                outdoorZones: [],
                platforms: [],
                rooms: [],
                roomPaths: [],
                presetGroups: [],
                settings: {},
                currentUnit: 'in'
            };

            expect(() => {
                const jsonStr = FloorPlanner.prototype.exportState.call(fakeFloorPlanner);
                const state = JSON.parse(jsonStr);
                expect(state.roofs).toBeDefined();
                expect(state.roofs.length).toBe(1);
                expect(state.roofs[0].roofType).toBe('gable');
            }).not.toThrow();
        });
    });

    describe('8. Flat Roof Plain Wall Plaster Default Material Invariant', () => {
        it('defaults flat roof creation to white_plaster_wall instead of textured roof materials', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const flatRoof = RoofEngine.createRoof(mockPlanner, pts, { roofType: 'flat' });

            expect(flatRoof.config.roofType).toBe('flat');
            expect(flatRoof.config.material).toBe('white_plaster_wall');
            expect(flatRoof.configId).toBe('white_plaster_wall');
        });

        it('RoofSerializer.deserialize defaults flat roof without explicit material to white_plaster_wall', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const deserialized = RoofSerializer.deserialize({ roofType: 'flat', points: pts }, mockPlanner, { addToPlanner: false });

            expect(deserialized.config.material).toBe('white_plaster_wall');
        });

        it('Roof3DBuilder resolves flat roof default and legacy defaults to plain wall plaster', async () => {
            const { Roof3DBuilder } = await import('../../../features/roof/builders/Roof3DBuilder.js');
            const targetGroup = new THREE.Group();
            const mock3DCtx = {
                structureGroup: targetGroup,
                requestRender: vi.fn(),
                helpers: {
                    getDynamicMaterial: vi.fn((matId, category) => new THREE.MeshStandardMaterial({ name: `${category}_${matId}` }))
                }
            };
            const builder = new Roof3DBuilder(mock3DCtx);
            const flatRoof = {
                id: 'test_flat_plain',
                type: 'roof',
                points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
                config: { roofType: 'flat', thickness: 15 }
            };

            builder.buildRoofs([flatRoof], 0, [], targetGroup);
            const roofMesh = targetGroup.children[0]?.children.find(c => c.userData?.isRoof);
            expect(roofMesh).toBeDefined();
            expect(Array.isArray(roofMesh.material)).toBe(true);
            // Cap index 0 = terrace top, index 1 = perimeter wall fascia
            expect(roofMesh.material[0].name).toBe('wall_white_plaster_wall');
            expect(roofMesh.material[1].name).toBe('wall_white_plaster_wall');
        });
    });
});

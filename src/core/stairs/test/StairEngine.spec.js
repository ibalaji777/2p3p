import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { StairEngine, StairGeometryEngine, StairTopologyEngine, StairMutationEngine } from '../StairEngine.js';
import { CreateStairCommand } from '../../commands/CreateStairCommand.js';
import { DeleteEntityCommand } from '../../commands/DeleteEntityCommand.js';
import { DuplicateEntityCommand } from '../../commands/DuplicateEntityCommand.js';
import { UpdatePropertyCommand } from '../../commands/UpdatePropertyCommand.js';
import { CommandFactory } from '../../api/CommandFactory.js';
import { ValidationLayer } from '../../api/ValidationLayer.js';

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
            fillText: () => {},
            restore: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            stroke: () => {},
            fill: () => {},
            measureText: () => ({ width: 50 }),
            transform: () => {},
            rect: () => {},
            clip: () => {},
        });
    }
});

describe('Staircase Centralized Subsystem (StairEngine)', () => {
    let mockPlanner;

    beforeEach(() => {
        mockPlanner = {
            stairs: [],
            selectedEntity: null,
            selectEntity(ent) { this.selectedEntity = ent; },
            syncAll() {},
            widgetLayer: { add() {} },
            furnitureLayer: { add() {} },
            stage: {
                batchDraw() {},
                getPointerPosition() { return { x: 0, y: 0 }; }
            },
            renderer3D: {
                realtimeUpdate: {
                    markDirty() {}
                }
            }
        };
    });

    describe('StairGeometryEngine', () => {
        it('should calculate 4-point aperture cutout polygon for straight stair', () => {
            const stair = {
                shape: 'straight',
                width: 100,
                stepDepth: 28,
                totalSteps: 12,
                x: 0,
                y: 0,
                rotation: 0
            };

            const pts = StairGeometryEngine.getCutoutPolygon(stair);
            expect(pts).toHaveLength(4);
            expect(pts[0]).toEqual({ x: -50, y: 0 });
            expect(pts[1]).toEqual({ x: 50, y: 0 });
            expect(pts[2]).toEqual({ x: 50, y: 336 }); // 12 * 28 = 336
            expect(pts[3]).toEqual({ x: -50, y: 336 });
        });

        it('should expand cutout polygon when top and bottom landings are enabled', () => {
            const stair = {
                shape: 'straight',
                width: 100,
                stepDepth: 28,
                totalSteps: 10,
                landingSize: 100,
                hasTopLanding: true,
                hasBottomLanding: true,
                x: 0,
                y: 0,
                rotation: 0
            };

            const pts = StairGeometryEngine.getCutoutPolygon(stair);
            expect(pts).toHaveLength(4);
            expect(pts[0].y).toBe(-100);
            expect(pts[2].y).toBe(10 * 28 + 100); // 380 (y = -100 to y = 380, total length = 480)
        });

        it('should calculate 6-point cutout polygon for L-shape stair (right and left turn)', () => {
            const stairRight = {
                shape: 'L',
                width: 100,
                stepDepth: 28,
                flight1Steps: 8,
                flight2Steps: 7,
                turnDirection: 'right',
                x: 0,
                y: 0,
                rotation: 0
            };

            const ptsRight = StairGeometryEngine.getCutoutPolygon(stairRight);
            expect(ptsRight).toHaveLength(6);

            const stairLeft = {
                ...stairRight,
                turnDirection: 'left'
            };
            const ptsLeft = StairGeometryEngine.getCutoutPolygon(stairLeft);
            expect(ptsLeft).toHaveLength(6);
            // Left turn branches towards negative X
            expect(ptsLeft[3].x).toBeLessThan(-50);
        });

        it('should calculate 6-point cutout polygon for U-shape stair', () => {
            const stairU = {
                shape: 'U',
                width: 100,
                stepDepth: 28,
                flight1Steps: 8,
                flight2Steps: 7,
                gapWidth: 20,
                landingSize: 100,
                turnDirection: 'right',
                x: 0,
                y: 0,
                rotation: 0
            };

            const pts = StairGeometryEngine.getCutoutPolygon(stairU);
            expect(pts).toHaveLength(6);
        });

        it('should calculate 8-point cutout polygon for T-shape stair', () => {
            const stairT = {
                shape: 'T',
                width: 100,
                stepDepth: 28,
                flight1Steps: 8,
                flight2Steps: 7,
                landingSize: 100,
                x: 0,
                y: 0,
                rotation: 0
            };

            const pts = StairGeometryEngine.getCutoutPolygon(stairT);
            expect(pts).toHaveLength(8);
        });

        it('should compute IRC/IBC ergonomic optimal step distributions', () => {
            // Standard 300cm story height -> 300 / 17.5 = 17.14 -> 17 steps, 17.65cm riser
            const straight300 = StairGeometryEngine.calculateOptimalSteps(300, 'straight');
            expect(straight300.totalSteps).toBe(17);
            expect(straight300.stepHeight).toBeCloseTo(17.65, 1);
            expect(straight300.flight1Steps).toBe(17);
            expect(straight300.flight2Steps).toBe(0);

            // L-shape with 300cm height -> splits 17 steps into 9 and 8
            const lShape300 = StairGeometryEngine.calculateOptimalSteps(300, 'L');
            expect(lShape300.totalSteps).toBe(17);
            expect(lShape300.flight1Steps).toBe(9);
            expect(lShape300.flight2Steps).toBe(8);
        });

        it('should return complete step metrics', () => {
            const stair = {
                shape: 'L',
                width: 100,
                height: 300,
                stepDepth: 28,
                flight1Steps: 8,
                flight2Steps: 7
            };

            const metrics = StairGeometryEngine.getStepMetrics(stair);
            expect(metrics.totalSteps).toBe(15);
            expect(metrics.stepHeight).toBe(20.0);
            expect(metrics.flight1Length).toBe(8 * 28);
            expect(metrics.flight2Length).toBe(7 * 28);
            expect(metrics.treadThickness).toBe(1.5);
            expect(metrics.nosing).toBe(2.0);
        });
    });

    describe('StairTopologyEngine', () => {
        it('should create and register a new staircase on planner.stairs', () => {
            const stair = StairEngine.createStair(mockPlanner, {
                shape: 'straight',
                width: 100,
                height: 300,
                totalSteps: 12
            });

            expect(mockPlanner.stairs).toHaveLength(1);
            expect(mockPlanner.stairs[0]).toBe(stair);
            expect(stair.shape).toBe('straight');
            expect(stair.type).toBe('stair_v5_straight');
        });

        it('should delete a staircase and clear selection', () => {
            const stair = StairEngine.createStair(mockPlanner, { shape: 'straight' });
            mockPlanner.selectEntity(stair);

            const deleted = StairEngine.deleteStair(mockPlanner, stair);
            expect(deleted).toBe(stair);
            expect(mockPlanner.stairs).toHaveLength(0);
            expect(mockPlanner.selectedEntity).toBeNull();
        });

        it('should duplicate a staircase with offset coordinates', () => {
            const original = StairEngine.createStair(mockPlanner, {
                shape: 'L',
                x: 100,
                y: 150,
                width: 110,
                height: 280
            });

            const duplicated = StairEngine.duplicateStair(mockPlanner, original, { x: 50, y: 50 });
            expect(mockPlanner.stairs).toHaveLength(2);
            expect(duplicated.id).not.toBe(original.id);
            expect(duplicated.x).toBe(150);
            expect(duplicated.y).toBe(200);
            expect(duplicated.width).toBe(110);
            expect(duplicated.height).toBe(280);
            expect(duplicated.shape).toBe('L');
        });

        it('should serialize and deserialize with full roundtrip fidelity', () => {
            const original = StairEngine.createStair(mockPlanner, {
                shape: 'U',
                width: 95,
                height: 290,
                flight1Steps: 9,
                flight2Steps: 8,
                gapWidth: 25,
                turnDirection: 'left'
            });

            const serialized = StairEngine.serialize(original);
            expect(serialized.shape).toBe('U');
            expect(serialized.width).toBe(95);
            expect(serialized.height).toBe(290);
            expect(serialized.gapWidth).toBe(25);
            expect(serialized.turnDirection).toBe('left');

            const restored = StairEngine.deserialize(mockPlanner, serialized);
            expect(restored.shape).toBe('U');
            expect(restored.width).toBe(95);
            expect(restored.height).toBe(290);
        });
    });

    describe('StairMutationEngine', () => {
        it('should morph shape between straight and L-shape with step redistribution', () => {
            const stair = StairEngine.createStair(mockPlanner, {
                shape: 'straight',
                totalSteps: 16
            });

            StairEngine.setShape(mockPlanner, stair, 'L');
            expect(stair.shape).toBe('L');
            expect(stair.type).toBe('stair_v5_L');
            expect(stair.totalSteps).toBe(16);
            expect(stair.flight1Steps).toBe(8);
            expect(stair.flight2Steps).toBe(8);

            StairEngine.setShape(mockPlanner, stair, 'straight');
            expect(stair.shape).toBe('straight');
            expect(stair.flight1Steps).toBe(16);
            expect(stair.flight2Steps).toBe(0);
        });

        it('should update height and recalculate ergonomic steps', () => {
            const stair = StairEngine.createStair(mockPlanner, {
                shape: 'straight',
                height: 200
            });

            StairEngine.setHeight(mockPlanner, stair, 350);
            expect(stair.height).toBe(350);
            expect(stair.totalSteps).toBe(20); // 350 / 17.5 = 20
            expect(stair.stepHeight).toBe(17.5);
        });

        it('should flip turn direction', () => {
            const stair = StairEngine.createStair(mockPlanner, {
                shape: 'L',
                turnDirection: 'right'
            });

            StairEngine.flipTurnDirection(mockPlanner, stair);
            expect(stair.turnDirection).toBe('left');

            StairEngine.flipTurnDirection(mockPlanner, stair);
            expect(stair.turnDirection).toBe('right');
        });

        it('should apply batch property updates atomically', () => {
            const stair = StairEngine.createStair(mockPlanner, {
                shape: 'straight',
                width: 100
            });

            StairEngine.batchUpdate(mockPlanner, [stair], {
                shape: 'U',
                width: 120,
                gapWidth: 30,
                'materials.treads': { id: 'wood_dark_walnut' }
            });

            expect(stair.shape).toBe('U');
            expect(stair.width).toBe(120);
            expect(stair.gapWidth).toBe(30);
            expect(stair.materials.treads.id).toBe('wood_dark_walnut');
        });
    });

    describe('Commands & Automation API Integration', () => {
        it('should execute and undo CreateStairCommand', () => {
            const cmd = new CreateStairCommand(mockPlanner, {
                shape: 'straight',
                x: 50,
                y: 50
            }, 'test_stair_1');

            cmd.execute();
            expect(mockPlanner.stairs).toHaveLength(1);
            expect(mockPlanner.stairs[0].id).toBe('test_stair_1');

            cmd.undo();
            expect(mockPlanner.stairs).toHaveLength(0);
        });

        it('should delete and cleanly restore stairs on DeleteEntityCommand undo', () => {
            const stair = StairEngine.createStair(mockPlanner, { id: 'test_stair_2', shape: 'straight' });
            mockPlanner.getEntities = () => mockPlanner.stairs;

            const deleteCmd = new DeleteEntityCommand(mockPlanner, stair.id);
            deleteCmd.execute();
            expect(mockPlanner.stairs).toHaveLength(0);

            deleteCmd.undo();
            expect(mockPlanner.stairs).toHaveLength(1);
            expect(mockPlanner.stairs[0].id).toBe(stair.id);
        });

        it('should duplicate stair via DuplicateEntityCommand', () => {
            const stair = StairEngine.createStair(mockPlanner, { id: 'source_stair', shape: 'straight', x: 20, y: 20 });
            mockPlanner.getEntities = () => mockPlanner.stairs;

            const dupCmd = new DuplicateEntityCommand(mockPlanner, 'source_stair', 'cloned_stair');
            dupCmd.execute();
            expect(mockPlanner.stairs).toHaveLength(2);
            expect(mockPlanner.stairs[1].id).toBe('cloned_stair');
            expect(mockPlanner.stairs[1].x).toBe(50); // 20 + 30
        });

        it('should update stair properties via UpdatePropertyCommand', () => {
            const stair = StairEngine.createStair(mockPlanner, { id: 'prop_stair', shape: 'straight', width: 90 });
            mockPlanner.getEntities = () => mockPlanner.stairs;

            const updateCmd = new UpdatePropertyCommand(mockPlanner, 'prop_stair', { width: 115 }, { width: 90 });
            updateCmd.execute();
            expect(stair.width).toBe(115);

            updateCmd.undo();
            expect(stair.width).toBe(90);
        });

        it('should validate and create stair via AutomationAPI CommandFactory', () => {
            const payload = {
                action: 'createStair',
                x: 100,
                y: 200,
                shape: 'L',
                width: 105
            };

            expect(() => ValidationLayer.validate(mockPlanner, payload)).not.toThrow();

            const cmd = CommandFactory.create(mockPlanner, payload);
            expect(cmd).toBeInstanceOf(CreateStairCommand);

            cmd.execute();
            expect(mockPlanner.stairs).toHaveLength(1);
            expect(mockPlanner.stairs[0].shape).toBe('L');
            expect(mockPlanner.stairs[0].width).toBe(105);
        });
    });
});

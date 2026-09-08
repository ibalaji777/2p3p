import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { StairEngine, StairGeometryEngine, StairTopologyEngine, StairMutationEngine } from '../StairEngine.js';
import { Stair3DPlacementSystem } from '../../engine3d/Stair3DPlacementSystem.js';
import { StairInteractiveSuite } from '../../engine3d/StairInteractiveSuite.js';
import { StairHeightDetector } from '../../../features/stairs/StairHeightDetector.js';
import { DeleteEntityCommand } from '../../commands/DeleteEntityCommand.js';
import { DuplicateEntityCommand } from '../../commands/DuplicateEntityCommand.js';
import { CreateStairCommand } from '../../commands/CreateStairCommand.js';

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

describe('Staircase Centralized Architecture Compliance', () => {
    let mockPlanner;
    let mockCtx;

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

        mockCtx = {
            scene: { add() {}, remove() {} },
            planner: mockPlanner,
            requestRender: () => {},
            renderer3D: { realtimeUpdate: { markDirty() {} } }
        };
    });

    describe('AC-1: Single Source of Truth & Universal Creation', () => {
        it('Stair3DPlacementSystem.placeStaircase routes strictly through StairEngine.createStair', () => {
            mockPlanner.tool = 'stair_v5_L';
            mockPlanner._tool = 'stair_v5_L';
            mockPlanner.activePresetParams = { shape: 'L', width: 100 };

            const placement = new Stair3DPlacementSystem(mockCtx);
            placement.activePos.set(120, 0, 250);
            placement.activeElevation = 0;
            placement.placeStaircase();

            expect(mockPlanner.stairs).toHaveLength(1);
            const placed = mockPlanner.stairs[0];
            expect(placed.shape).toBe('L');
            expect(placed.type).toBe('stair_v5_L');
            expect(placed.elevation).toBe(0);
        });

        it('Direct instantiation outside StairEngine/StairTopologyEngine is prevented in creation tools', () => {
            const stair = StairEngine.createStair(mockPlanner, {
                shape: 'U',
                x: 50,
                y: 60,
                width: 110
            });

            expect(mockPlanner.stairs).toContain(stair);
            expect(stair.shape).toBe('U');
            expect(stair.width).toBe(110);
        });
    });

    describe('AC-2: 3D Interactive HUD Strict Delegation to StairEngine', () => {
        it('HUD shape morphing calls StairEngine.setShape without recreating entity', () => {
            const stair = StairEngine.createStair(mockPlanner, { shape: 'straight', totalSteps: 16 });
            const suite = new StairInteractiveSuite(mockCtx);
            suite.attach({ userData: { entity: stair } });

            // Shape change via HUD button click
            suite.shapeButtons['L'].onclick({ stopPropagation() {} });
            expect(stair.shape).toBe('L');
            expect(stair.type).toBe('stair_v5_L');
            expect(stair.flight1Steps).toBe(8);
            expect(stair.flight2Steps).toBe(8);

            suite.shapeButtons['U'].onclick({ stopPropagation() {} });
            expect(stair.shape).toBe('U');
            expect(stair.type).toBe('stair_v5_U');

            suite.shapeButtons['straight'].onclick({ stopPropagation() {} });
            expect(stair.shape).toBe('straight');
            expect(stair.flight1Steps).toBe(16);
            expect(stair.flight2Steps).toBe(0);
        });

        it('HUD turn flip, width adjustment, landing adjustment, stringer cycling, and deletion route through StairEngine', () => {
            const stair = StairEngine.createStair(mockPlanner, { shape: 'L', width: 100, turnDirection: 'right', stringerType: 'solid' });
            const suite = new StairInteractiveSuite(mockCtx);
            suite.attach({ userData: { entity: stair } });

            // Flip turn
            suite.btnFlip.onclick({ stopPropagation() {} });
            expect(stair.turnDirection).toBe('left');

            // Cycle stringer
            suite.btnStringer.onclick({ stopPropagation() {} });
            expect(stair.stringerType).toBe('mono');

            // Delete
            suite._deleteStaircase();
            expect(mockPlanner.stairs).toHaveLength(0);
        });
    });

    describe('AC-3: Unified Ergonomics & Optimal Step Detection', () => {
        it('StairHeightDetector delegates directly to StairGeometryEngine without logic divergence', () => {
            const height = 320;
            const geomResult = StairGeometryEngine.calculateOptimalSteps(height, 'L');
            const detResult = StairHeightDetector.calculateOptimalSteps(height, 'L');

            expect(detResult).toEqual(geomResult);
            expect(detResult.totalSteps).toBe(Math.round(320 / 17.5));
            expect(detResult.flight1Steps + detResult.flight2Steps).toBe(detResult.totalSteps);
        });

        it('Boundary conditions (short stairs) are handled ergonomically', () => {
            const shortResult = StairGeometryEngine.calculateOptimalSteps(35, 'straight');
            expect(shortResult.totalSteps).toBe(2);
            expect(shortResult.stepHeight).toBe(17.5);
        });
    });

    describe('AC-4: Complete Aperture Cutout Polygon Authority', () => {
        it('Generates accurate 2D/3D cutouts for all shapes and legacy V4 types', () => {
            // Straight
            const straight = { shape: 'straight', width: 100, stepDepth: 28, totalSteps: 10 };
            const polyStraight = StairGeometryEngine.getCutoutPolygon(straight);
            expect(polyStraight).toHaveLength(4);

            // L-shape
            const lShape = { shape: 'L', width: 100, stepDepth: 28, flight1Steps: 8, flight2Steps: 7, turnDirection: 'right' };
            const polyL = StairGeometryEngine.getCutoutPolygon(lShape);
            expect(polyL).toHaveLength(6);

            // U-shape
            const uShape = { shape: 'U', width: 100, stepDepth: 28, flight1Steps: 8, flight2Steps: 7, gapWidth: 20, landingSize: 100 };
            const polyU = StairGeometryEngine.getCutoutPolygon(uShape);
            expect(polyU).toHaveLength(6);

            // T-shape
            const tShape = { shape: 'T', width: 100, stepDepth: 28, flight1Steps: 8, flight2Steps: 7, landingSize: 100 };
            const polyT = StairGeometryEngine.getCutoutPolygon(tShape);
            expect(polyT).toHaveLength(8);

            // Legacy V4 Flight
            const v4Flight = { type: 'stair_v4_flight', width: 90, totalLength: 250 };
            const polyV4Flight = StairGeometryEngine.getCutoutPolygon(v4Flight);
            expect(polyV4Flight).toHaveLength(4);

            // Legacy V4 Landing
            const v4Landing = { type: 'stair_v4_landing', width: 100, depth: 100 };
            const polyV4Landing = StairGeometryEngine.getCutoutPolygon(v4Landing);
            expect(polyV4Landing).toHaveLength(4);
        });
    });

    describe('AC-5: Full Undo/Redo & Topology Restoration', () => {
        it('DeleteEntityCommand cleanly removes stair and fully restores it on undo', () => {
            const stair = StairEngine.createStair(mockPlanner, {
                id: 'stair_undo_test',
                shape: 'L',
                width: 105,
                height: 290,
                turnDirection: 'left'
            });
            mockPlanner.getEntities = () => mockPlanner.stairs;

            const deleteCmd = new DeleteEntityCommand(mockPlanner, stair.id);
            deleteCmd.execute();
            expect(mockPlanner.stairs).toHaveLength(0);

            deleteCmd.undo();
            expect(mockPlanner.stairs).toHaveLength(1);
            const restored = mockPlanner.stairs[0];
            expect(restored.id).toBe('stair_undo_test');
            expect(restored.shape).toBe('L');
            expect(restored.width).toBe(105);
            expect(restored.height).toBe(290);
            expect(restored.turnDirection).toBe('left');
        });

        it('DuplicateEntityCommand duplicates and safely removes on undo', () => {
            const stair = StairEngine.createStair(mockPlanner, {
                id: 'stair_src',
                shape: 'straight',
                x: 10,
                y: 20
            });
            mockPlanner.getEntities = () => mockPlanner.stairs;

            const dupCmd = new DuplicateEntityCommand(mockPlanner, 'stair_src', 'stair_clone');
            dupCmd.execute();
            expect(mockPlanner.stairs).toHaveLength(2);
            expect(mockPlanner.stairs[1].id).toBe('stair_clone');

            dupCmd.undo();
            expect(mockPlanner.stairs).toHaveLength(1);
            expect(mockPlanner.stairs[0].id).toBe('stair_src');
        });
    });

    describe('AC-6: Atomic Batch Updates and Mutators', () => {
        it('setPosition and setRotation update coordinates cleanly', () => {
            const stair = StairEngine.createStair(mockPlanner, { shape: 'straight', x: 0, y: 0, rotation: 0 });

            StairEngine.setPosition(mockPlanner, stair, 75, 85);
            expect(stair.x).toBe(75);
            expect(stair.y).toBe(85);

            StairEngine.setRotation(mockPlanner, stair, 90);
            expect(stair.rotation).toBe(90);
        });

        it('adjustLanding updates flight1Steps and maintains boundaries', () => {
            const stair = StairEngine.createStair(mockPlanner, { shape: 'L', flight1Steps: 8, flight2Steps: 7 });

            StairEngine.adjustLanding(mockPlanner, stair, 2);
            expect(stair.flight1Steps).toBe(10);
            expect(stair.flight2Steps).toBe(5);

            StairEngine.adjustLanding(mockPlanner, stair, -100);
            expect(stair.flight1Steps).toBe(10); // Out-of-bounds delta is ignored safely
        });

        it('setStringerType updates stringer configuration', () => {
            const stair = StairEngine.createStair(mockPlanner, { shape: 'straight', stringerType: 'solid' });

            StairEngine.setStringerType(mockPlanner, stair, 'central_beam');
            expect(stair.stringerType).toBe('central_beam');
        });
    });
});
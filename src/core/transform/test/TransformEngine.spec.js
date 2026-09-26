import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { TransformEngine } from '../TransformEngine.js';
import { TransformCommand } from '../../commands/TransformCommand.js';
import { StairEngine } from '../../stairs/StairEngine.js';
import { WallEngine } from '../../wall/WallEngine.js';
import { RoofEngine } from '../../roof/RoofEngine.js';

describe('TransformEngine & TransformCommand Universal Pipeline', () => {
    let mockPlanner;
    let commandHistory;

    beforeEach(() => {
        commandHistory = [];
        mockPlanner = {
            commandManager: {
                execute: vi.fn((cmd) => {
                    commandHistory.push(cmd);
                    cmd.execute();
                }),
                undo: vi.fn(() => {
                    const cmd = commandHistory.pop();
                    if (cmd) cmd.undo();
                })
            },
            getEntities: vi.fn(() => []),
            walls: [],
            furniture: [],
            stairs: [],
            shapes: [],
            roofs: [],
            syncAll: vi.fn()
        };

        // Ensure no leftover session
        if (TransformEngine.isSessionActive()) {
            TransformEngine.cancelSession(mockPlanner);
        }
    });

    describe('Mathematical Snapping & Center Pivot Compensation', () => {
        it('should snap angle to nearest step within magnetic zone', () => {
            const snapped1 = TransformEngine.snapAngle(14, { step: 15, magneticZone: 3.5 });
            expect(snapped1.angle).toBe(15);
            expect(snapped1.isSnapped).toBe(true);

            const snapped2 = TransformEngine.snapAngle(17, { step: 15, magneticZone: 3.5 });
            expect(snapped2.angle).toBe(15);
            expect(snapped2.isSnapped).toBe(true);
        });

        it('should retain continuous angle outside magnetic zone unless locked', () => {
            const unsnapped = TransformEngine.snapAngle(22, { step: 15, magneticZone: 3.5 });
            expect(unsnapped.angle).toBe(22);
            expect(unsnapped.isSnapped).toBe(false);

            const locked45 = TransformEngine.snapAngle(25, { lock45: true });
            expect(locked45.angle).toBe(45);
            expect(locked45.isSnapped).toBe(true);

            const locked0 = TransformEngine.snapAngle(22, { lock45: true });
            expect(locked0.angle).toBe(0);
            expect(locked0.isSnapped).toBe(true);
        });

        it('should bypass snapping completely when free mode is active', () => {
            const free = TransformEngine.snapAngle(14.8, { free: true });
            expect(free.angle).toBe(14.8);
            expect(free.isSnapped).toBe(false);
        });

        it('should keep world center 100% stationary when computing center-compensated position', () => {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(60, 40, 100),
                new THREE.MeshBasicMaterial()
            );
            mesh.position.set(100, 20, 200);

            const entity = {
                id: 'table_1',
                type: 'furniture',
                x: 100,
                y: 200,
                elevation: 20,
                rotation: 0,
                mesh3D: mesh
            };

            // Compute stationary center
            const { x: newX, y: newY } = TransformEngine.computeCenterCompensatedPosition(entity, 90);
            
            // For a symmetric box centered at (100, 20, 200), center is at (100, 20, 200).
            expect(typeof newX).toBe('number');
            expect(typeof newY).toBe('number');
            expect(Math.abs(newX - 100)).toBeLessThan(1);
            expect(Math.abs(newY - 200)).toBeLessThan(1);
        });
    });

    describe('Interactive Session Lifecycle & Single Undo Guarantee', () => {
        let mockEntity;
        let mockMesh;

        beforeEach(() => {
            mockMesh = new THREE.Mesh(
                new THREE.BoxGeometry(40, 40, 40),
                new THREE.MeshBasicMaterial()
            );
            mockMesh.position.set(50, 0, 80);

            mockEntity = {
                id: 'furn_test_1',
                type: 'furniture',
                x: 50,
                y: 80,
                elevation: 0,
                rotation: 0,
                mesh3D: mockMesh,
                group: {
                    x: vi.fn((val) => val !== undefined ? (mockEntity.x = val) : mockEntity.x),
                    y: vi.fn((val) => val !== undefined ? (mockEntity.y = val) : mockEntity.y),
                    position: vi.fn((pos) => { mockEntity.x = pos.x; mockEntity.y = pos.y; }),
                    rotation: vi.fn((rot) => { mockEntity.rotation = rot; })
                }
            };

            mockPlanner.getEntities = vi.fn(() => [mockEntity]);
            mockPlanner.furniture = [mockEntity];
        });

        it('should start a session, preview move, and commit exactly ONE TransformCommand', () => {
            TransformEngine.startSession(mockEntity, 'move');
            expect(TransformEngine.isSessionActive()).toBe(true);

            // Preview multiple moves during 60 FPS drag
            TransformEngine.previewMove(mockEntity, { x: 10, y: 20 });
            TransformEngine.previewMove(mockEntity, { x: 30, y: 50 });

            expect(mockEntity.x).toBe(80);
            expect(mockEntity.y).toBe(130);
            expect(commandHistory.length).toBe(0); // Zero commands generated during transient drag!

            // Commit gesture
            const cmd = TransformEngine.commitSession(mockPlanner);
            expect(TransformEngine.isSessionActive()).toBe(false);
            expect(cmd).toBeInstanceOf(TransformCommand);
            expect(commandHistory.length).toBe(1); // Exactly ONE command committed!

            // Single Undo restores initial state
            mockPlanner.commandManager.undo();
            expect(mockEntity.x).toBe(50);
            expect(mockEntity.y).toBe(80);
            expect(mockMesh.position.x).toBe(50);
            expect(mockMesh.position.z).toBe(80);

            // Redo reapplies new state
            cmd.execute();
            expect(mockEntity.x).toBe(80);
            expect(mockEntity.y).toBe(130);
        });

        it('should cancel active session and cleanly revert entity to initial state', () => {
            TransformEngine.startSession(mockEntity, 'move');
            TransformEngine.previewMove(mockEntity, { x: 100, y: 150 });

            expect(mockEntity.x).toBe(150);
            expect(mockEntity.y).toBe(230);

            TransformEngine.cancelSession(mockPlanner);
            expect(TransformEngine.isSessionActive()).toBe(false);
            expect(commandHistory.length).toBe(0);
            expect(mockEntity.x).toBe(50);
            expect(mockEntity.y).toBe(80);
        });

        it('should handle compound Move + Spin in a single gesture with strictly ONE undo (No Double-Undo Bug)', () => {
            TransformEngine.startSession(mockEntity, 'spin');

            // Perform spin preview
            TransformEngine.previewSpin(mockEntity, 90);

            expect(mockEntity.rotation).toBe(90);

            // Commit session
            const cmd = TransformEngine.commitSession(mockPlanner);
            expect(commandHistory.length).toBe(1); // Strictly ONE command!
            expect(cmd.beforeState.rotation).toBe(0);
            expect(cmd.afterState.rotation).toBe(90);

            // Single undo simultaneously restores rotation and compensated position
            mockPlanner.commandManager.undo();
            expect(mockEntity.rotation).toBe(0);
            expect(mockEntity.x).toBe(50);
            expect(mockEntity.y).toBe(80);
        });

        it('should not create a command if commitSession is called without any transformation change', () => {
            TransformEngine.startSession(mockEntity, 'move');
            // No moves performed
            const cmd = TransformEngine.commitSession(mockPlanner);
            expect(cmd).toBeNull();
            expect(commandHistory.length).toBe(0);
        });
    });

    describe('Discrete Step Transformations (Keyboard R & Nudges)', () => {
        let mockEntity;

        beforeEach(() => {
            mockEntity = {
                id: 'chair_1',
                type: 'furniture',
                x: 100,
                y: 100,
                elevation: 0,
                rotation: 0,
                mesh3D: new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial()),
                group: {
                    x: vi.fn(() => 100),
                    y: vi.fn(() => 100),
                    position: vi.fn(),
                    rotation: vi.fn()
                }
            };
            mockPlanner.getEntities = vi.fn(() => [mockEntity]);
        });

        it('should execute discrete +90° spin step with single undoable command', () => {
            const cmd = TransformEngine.executeDiscreteStep(mockPlanner, mockEntity, { deltaRotation: 90 });
            expect(cmd).toBeInstanceOf(TransformCommand);
            expect(commandHistory.length).toBe(1);
            expect(mockEntity.rotation).toBe(90);

            // Undo reverts to 0
            mockPlanner.commandManager.undo();
            expect(mockEntity.rotation).toBe(0);
        });

        it('should execute discrete opening t nudge', () => {
            const mockOpening = {
                id: 'opening_1',
                type: 'advance_openings',
                t: 0.5,
                update: vi.fn()
            };
            mockPlanner.getEntities = vi.fn(() => [mockOpening]);

            const cmd = TransformEngine.executeDiscreteStep(mockPlanner, mockOpening, { deltaT: 0.05 });
            expect(cmd).toBeInstanceOf(TransformCommand);
            expect(mockOpening.t).toBe(0.55);

            // Undo reverts t to 0.5
            mockPlanner.commandManager.undo();
            expect(mockOpening.t).toBe(0.5);
        });
    });

    describe('Subsystem Delegation', () => {
        it('should delegate staircase position and rotation to StairEngine', () => {
            const setPosSpy = vi.spyOn(StairEngine, 'setPosition').mockImplementation(() => {});
            const setRotSpy = vi.spyOn(StairEngine, 'setRotation').mockImplementation(() => {});

            const stairEntity = {
                id: 'stair_test_1',
                type: 'stair_v5_straight',
                x: 200,
                y: 300,
                rotation: 0,
                totalSteps: 15
            };
            mockPlanner.getEntities = vi.fn(() => [stairEntity]);
            mockPlanner.stairs = [stairEntity];

            TransformEngine.applyState(mockPlanner, stairEntity.id, { x: 250, y: 350, rotation: 180 });

            expect(setPosSpy).toHaveBeenCalledWith(mockPlanner, stairEntity, 250, 350);
            expect(setRotSpy).toHaveBeenCalledWith(mockPlanner, stairEntity, 180);

            setPosSpy.mockRestore();
            setRotSpy.mockRestore();
        });

        it('should delegate anchor position to WallEngine.moveAnchor', () => {
            const moveAnchorSpy = vi.spyOn(WallEngine, 'moveAnchor').mockImplementation(() => {});

            const anchorEntity = {
                id: 'anchor_1',
                isAnchor: true,
                x: 100,
                y: 100
            };
            mockPlanner.getEntities = vi.fn(() => [anchorEntity]);

            TransformEngine.applyState(mockPlanner, anchorEntity.id, { x: 120, y: 140 });

            expect(moveAnchorSpy).toHaveBeenCalledWith(anchorEntity, { x: 120, y: 140 }, mockPlanner, false);

            moveAnchorSpy.mockRestore();
        });

        it('should delegate roof rotation and points to RoofEngine', () => {
            const setRotSpy = vi.spyOn(RoofEngine, 'setRotation').mockImplementation(() => {});
            const setPtsSpy = vi.spyOn(RoofEngine, 'setPoints').mockImplementation(() => {});

            const roofEntity = {
                id: 'roof_1',
                type: 'roof',
                config: { roofType: 'hip' },
                points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
                rotation: 0
            };
            mockPlanner.getEntities = vi.fn(() => [roofEntity]);
            mockPlanner.roofs = [roofEntity];

            const newPts = [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 110 }, { x: 10, y: 110 }];
            TransformEngine.applyState(mockPlanner, roofEntity.id, { rotation: 45, points: newPts });

            expect(setRotSpy).toHaveBeenCalledWith(roofEntity, 45, mockPlanner);
            expect(setPtsSpy).toHaveBeenCalledWith(roofEntity, newPts, mockPlanner);

            setRotSpy.mockRestore();
            setPtsSpy.mockRestore();
        });

        it('should clamp wall opening elevation to sloped top profile height (Fix 10)', () => {
            const slopedWall = {
                id: 'sloped_wall_1',
                length3D: 200,
                topProfileType: 'single',
                startHeight: 200,
                endHeight: 100, // drops from 200 to 100
                height: 200
            };
            const windowEntity = {
                id: 'win_sloped',
                type: 'window',
                wall: slopedWall,
                t: 0.8, // At t=0.8, wall height is 200 + 0.8*(100-200) = 120cm
                elevation: 30,
                height: 50 // opH = 50cm. Max allowable elev = 120 - 50 = 70cm
            };

            TransformEngine.startSession(windowEntity, 'move');

            // Attempt to drag elevation upward by +100cm (would reach 130cm without clamp)
            TransformEngine.previewMove(windowEntity, { y: 100 });

            // Must clamp to wallHeightAtT - opH = 120 - 50 = 70cm
            expect(windowEntity.elevation).toBe(70);

            TransformEngine.cancelSession(mockPlanner);
        });

        it('should project 3D drag vector along angled wall vector in TransformEngine (Fix 1)', () => {
            // Wall running from (0, 0) to (0, 200) along Z-axis
            const zWall = {
                id: 'z_wall_1',
                startX: 0,
                startY: 0,
                endX: 0,
                endY: 200,
                length3D: 200,
                height: 280
            };
            const doorEntity = {
                id: 'door_z',
                type: 'door',
                wall: zWall,
                t: 0.5 // initial localX = 100cm
            };

            TransformEngine.startSession(doorEntity, 'move');

            // Move by +50cm along world Z (which is the longitudinal axis of zWall)
            TransformEngine.previewMove(doorEntity, { x: 0, z: 50 });

            // New localX should be 100 + 50 = 150cm => t = 150/200 = 0.75
            expect(doorEntity.t).toBeCloseTo(0.75);

            TransformEngine.cancelSession(mockPlanner);
        });
    });
});

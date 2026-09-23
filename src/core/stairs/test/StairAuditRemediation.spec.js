import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { StairEngine, StairTopologyEngine } from '../StairEngine.js';
import { FloorPlanner } from '../../engine2d/index.js';
import { DeleteCommand } from '../../commands/DeleteCommand.js';
import { ComponentRegistry } from '../../engine3d/ComponentRegistry.js';
import { UniversalRealtimeUpdate } from '../../sync/UniversalRealtimeUpdate.js';
import { StairInteractiveSuite } from '../../engine3d/StairInteractiveSuite.js';
import { Stair3DPlacementSystem } from '../../engine3d/Stair3DPlacementSystem.js';

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

describe('Staircase Subsystem Audit Remediation & Regression Suite', () => {
    let mockPlanner;

    beforeEach(() => {
        mockPlanner = {
            tool: 'select',
            stairs: [],
            walls: [],
            furniture: [],
            roofs: [],
            platforms: [],
            shapes: [],
            outdoorZones: [],
            selectedEntity: null,
            selectEntity(ent) { this.selectedEntity = ent; },
            syncAll: vi.fn(),
            widgetLayer: { add: vi.fn() },
            furnitureLayer: { add: vi.fn() },
            commandManager: {
                execute: vi.fn(cmd => cmd.execute()),
                undo: vi.fn(cmd => cmd?.undo())
            },
            renderer3D: {
                interactables: [],
                realtimeUpdate: {
                    markDirty: vi.fn()
                }
            },
            exportEntityState: FloorPlanner.prototype.exportEntityState,
            _applyRestore: FloorPlanner.prototype._applyRestore,
            _applyDelete: vi.fn(function(ent) {
                StairEngine.deleteStair(this, ent);
            })
        };
    });

    describe('1. Lossless exportEntityState & DeleteCommand Undo', () => {
        it('FloorPlanner.exportEntityState preserves all parametric stair properties', () => {
            const stair = StairEngine.createStair(mockPlanner, {
                shape: 'L',
                width: 110,
                height: 280,
                totalSteps: 16,
                flight1Steps: 9,
                flight2Steps: 7,
                stepDepth: 27,
                stepHeight: 17.5,
                turnDirection: 'left',
                stringerType: 'mono',
                materials: {
                    treads: { id: 'wood_cherry' }
                }
            });

            const exported = mockPlanner.exportEntityState(stair);

            expect(exported).toBeDefined();
            expect(exported.id).toBe(stair.id);
            expect(exported.shape).toBe('L');
            expect(exported.width).toBe(110);
            expect(exported.height).toBe(280);
            expect(exported.totalSteps).toBe(16);
            expect(exported.flight1Steps).toBe(9);
            expect(exported.flight2Steps).toBe(7);
            expect(exported.turnDirection).toBe('left');
            expect(exported.stringerType).toBe('mono');
            expect(exported.materials.treads.id).toBe('wood_cherry');
        });

        it('DeleteCommand executes deletion and restores lossless state on undo', () => {
            const stair = StairEngine.createStair(mockPlanner, {
                shape: 'U',
                width: 95,
                height: 310,
                totalSteps: 18,
                flight1Steps: 10,
                flight2Steps: 8,
                turnDirection: 'right',
                stringerType: 'double'
            });

            expect(mockPlanner.stairs.length).toBe(1);

            // Create and execute DeleteCommand
            mockPlanner._applyDelete = vi.fn(ent => {
                StairEngine.deleteStair(mockPlanner, ent);
            });

            const deleteCmd = new DeleteCommand(mockPlanner, stair);
            deleteCmd.execute();

            expect(mockPlanner.stairs.length).toBe(0);

            // Undo deletion
            deleteCmd.undo();

            expect(mockPlanner.stairs.length).toBe(1);
            const restored = mockPlanner.stairs[0];
            expect(restored.shape).toBe('U');
            expect(restored.width).toBe(95);
            expect(restored.height).toBe(310);
            expect(restored.totalSteps).toBe(18);
            expect(restored.flight1Steps).toBe(10);
            expect(restored.flight2Steps).toBe(8);
            expect(restored.turnDirection).toBe('right');
            expect(restored.stringerType).toBe('double');
            expect(mockPlanner.renderer3D.realtimeUpdate.markDirty).toHaveBeenCalledWith(restored, 'geometry');
        });
    });

    describe('2. Elimination of Zombie 3D Meshes & ComponentRegistry Cleanup', () => {
        it('StairTopologyEngine.deleteStair detaches and disposes 3D mesh and interactables', () => {
            const stair = StairEngine.createStair(mockPlanner, { shape: 'straight' });
            
            // Mock parent structureGroup and Three.js hierarchy
            const parentGroup = new THREE.Group();
            const stairMesh = new THREE.Group();
            const childMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
            stairMesh.add(childMesh);
            parentGroup.add(stairMesh);
            stair.mesh3D = stairMesh;

            mockPlanner.renderer3D.interactables.push(stairMesh);
            ComponentRegistry.registerMesh(stair, 'tread', childMesh);

            expect(ComponentRegistry.getMeshesForSlot(stair.id, 'tread').length).toBe(1);
            expect(mockPlanner.renderer3D.interactables.includes(stairMesh)).toBe(true);

            // Delete
            const deleted = StairEngine.deleteStair(mockPlanner, stair);

            expect(deleted).toBe(stair);
            expect(mockPlanner.stairs.length).toBe(0);
            expect(stairMesh.parent).toBeNull();
            expect(mockPlanner.renderer3D.interactables.includes(stairMesh)).toBe(false);
            expect(ComponentRegistry.getMeshesForSlot(stair.id, 'tread').length).toBe(0);
            expect(stair.mesh3D).toBeNull();
        });

        it('StairInteractiveSuite._deleteStaircase dispatches DeleteCommand, deselects and requests render', () => {
            const stair = StairEngine.createStair(mockPlanner, { shape: 'straight' });
            const stairMesh = new THREE.Group();
            stairMesh.userData = { entity: stair, isStair: true };
            stair.mesh3D = stairMesh;

            const mockInteractions = {
                deselect: vi.fn()
            };
            const mockCtx = {
                planner: mockPlanner,
                interactions: mockInteractions,
                requestRender: vi.fn(),
                controls: { addEventListener: vi.fn(), removeEventListener: vi.fn() }
            };

            const suite = new StairInteractiveSuite(mockCtx);
            suite.attach(stairMesh);

            suite._deleteStaircase();

            expect(mockInteractions.deselect).toHaveBeenCalled();
            expect(mockPlanner.commandManager.execute).toHaveBeenCalled();
            expect(mockCtx.requestRender).toHaveBeenCalledWith('Staircase Deleted', 5);
        });
    });

    describe('3. UniversalRealtimeUpdate Interactables Cache Consistency', () => {
        it('rebuildMeshInPlace updates interactables even when object is not currently selected', () => {
            const stair = StairEngine.createStair(mockPlanner, { shape: 'straight' });
            const oldMesh = new THREE.Group();
            oldMesh.userData = { entity: stair, isStair: true };
            stair.mesh3D = oldMesh;

            const mockInteractions = {
                selectedObject: null, // NOT selected
                refreshSelectionHighlight: vi.fn()
            };
            const mockCtx = {
                interactables: [oldMesh],
                interactions: mockInteractions,
                structureGroup: new THREE.Group(),
                helpers: {}
            };
            mockCtx.structureGroup.add(oldMesh);

            const realtimeUpdate = new UniversalRealtimeUpdate(mockCtx);
            const result = realtimeUpdate.rebuildMeshInPlace(stair);

            expect(result).toBe(true);
            expect(mockCtx.interactables.includes(oldMesh)).toBe(false);
            expect(mockCtx.interactables.includes(stair.mesh3D)).toBe(true);
        });
    });

    describe('4. 3D Placement & Level State Persistence', () => {
        it('Stair3DPlacementSystem.placeStaircase updates planner.levels[activeLevelIndex].data', () => {
            mockPlanner.tool = 'staircase';
            mockPlanner.activeLevelIndex = 0;
            mockPlanner.levels = [
                { id: 'level_0', data: '{}' },
                { id: 'level_1', data: '{}' }
            ];
            mockPlanner.exportState = vi.fn(() => JSON.stringify({
                stairs: [{ id: 'stair_test_1', shape: 'straight' }]
            }));
            mockPlanner.activePresetParams = { shape: 'straight', type: 'stair_v5_straight' };

            const mockCtx = {
                planner: mockPlanner,
                scene: new THREE.Group(),
                camera: new THREE.PerspectiveCamera(),
                buildScene: vi.fn(),
                requestRender: vi.fn()
            };
            const mockInteractions = {
                selectObject: vi.fn(),
                mode: 'select'
            };

            const placementSystem = new Stair3DPlacementSystem(mockCtx, mockInteractions);
            placementSystem.activePos.set(100, 0, 200);

            const result = placementSystem.placeStaircase();

            expect(result).toBe(true);
            expect(mockPlanner.exportState).toHaveBeenCalled();
            expect(mockPlanner.levels[0].data).toContain('stair_test_1');
            expect(mockCtx.buildScene).toHaveBeenCalled();
        });
    });
});

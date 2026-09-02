import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { COMMON_TOOLS, COMMON_TOOL_DEFINITIONS, getToolDefinition } from '../tools/CommonToolRegistry.js';
import { ObjectCapabilityEvaluator } from '../tools/ObjectCapabilityEvaluator.js';
import { CommonShortcutRegistry, SHORTCUT_ACTIONS } from '../tools/CommonShortcutRegistry.js';
import { CommonTransformEngine } from '../tools/CommonTransformEngine.js';
import { UniversalMaterialPaintSystem } from '../tools/UniversalMaterialPaintSystem.js';
import { CommonInteractionController } from '../tools/CommonInteractionController.js';
import { CameraController } from '../../camera/CameraController.js';
import { ComponentRegistry } from '../ComponentRegistry.js';
import { MaterialSlots } from '../../constants/materialSlots.js';

describe('Universal 3D Scene Common Tools Architecture (Sims 4 Style)', () => {
    describe('1. CommonToolRegistry', () => {
        it('should define all 7 common tools', () => {
            expect(COMMON_TOOLS.SELECT).toBe('select');
            expect(COMMON_TOOLS.MATERIAL).toBe('material');
            expect(COMMON_TOOLS.MOVE).toBe('move');
            expect(COMMON_TOOLS.SPIN).toBe('spin');
            expect(COMMON_TOOLS.TILT).toBe('tilt');
            expect(COMMON_TOOLS.AXIS_UP).toBe('axis_up');
            expect(COMMON_TOOLS.AXIS_DOWN).toBe('axis_down');
        });

        it('should have complete tool metadata definitions', () => {
            expect(COMMON_TOOL_DEFINITIONS.length).toBe(7);
            const selectDef = getToolDefinition(COMMON_TOOLS.SELECT);
            expect(selectDef).toBeDefined();
            expect(selectDef.hotkey).toBe('V');

            const matDef = getToolDefinition(COMMON_TOOLS.MATERIAL);
            expect(matDef.hotkey).toBe('B');

            const moveDef = getToolDefinition(COMMON_TOOLS.MOVE);
            expect(moveDef.capability).toBe('movable');

            const spinDef = getToolDefinition(COMMON_TOOLS.SPIN);
            expect(spinDef.capability).toBe('rotatable');

            const tiltDef = getToolDefinition(COMMON_TOOLS.TILT);
            expect(tiltDef.capability).toBe('tiltable');
        });
    });

    describe('2. ObjectCapabilityEvaluator', () => {
        it('should evaluate wall capabilities correctly', () => {
            const wall = { id: 'w1', type: 'wall', startX: 0, startY: 0, endX: 100, endY: 0 };
            const caps = ObjectCapabilityEvaluator.getCapabilities(wall);
            expect(caps.selectable).toBe(true);
            expect(caps.material).toBe(true);
            expect(caps.movable).toBe(false);
            expect(caps.rotatable).toBe(false);
            expect(caps.tiltable).toBe(false);
            expect(caps.elevatable).toBe(false);
            expect(caps.pushPullable).toBe(true);
        });

        it('should evaluate door / window opening capabilities correctly', () => {
            const door = { id: 'd1', type: 'door', width: 36, height: 80 };
            const caps = ObjectCapabilityEvaluator.getCapabilities(door);
            expect(caps.selectable).toBe(true);
            expect(caps.material).toBe(true);
            expect(caps.movable).toBe(true);
            expect(caps.rotatable).toBe(false);
            expect(caps.tiltable).toBe(false);
            expect(caps.elevatable).toBe(true);
            expect(caps.apertureResizable).toBe(true);
        });

        it('should evaluate wall plugin (sunshade / molding / fascia) capabilities correctly', () => {
            const sunshade = { id: 's1', type: 'sunshade', width: 40 };
            const caps = ObjectCapabilityEvaluator.getCapabilities(sunshade);
            expect(caps.selectable).toBe(true);
            expect(caps.material).toBe(true);
            expect(caps.movable).toBe(true);
            expect(caps.rotatable).toBe(false);
            expect(caps.tiltable).toBe(false);
            expect(caps.elevatable).toBe(true);
        });

        it('should evaluate furniture capabilities correctly', () => {
            const chair = { id: 'f1', type: 'furniture', name: 'Dining Chair' };
            const caps = ObjectCapabilityEvaluator.getCapabilities(chair);
            expect(caps.selectable).toBe(true);
            expect(caps.material).toBe(true);
            expect(caps.movable).toBe(true);
            expect(caps.rotatable).toBe(true);
            expect(caps.tiltable).toBe(true);
            expect(caps.elevatable).toBe(true);
        });

        it('should evaluate roof capabilities correctly', () => {
            const roof = { id: 'r1', type: 'roof', config: { roofType: 'gable' } };
            const caps = ObjectCapabilityEvaluator.getCapabilities(roof);
            expect(caps.selectable).toBe(true);
            expect(caps.material).toBe(true);
            expect(caps.movable).toBe(true);
            expect(caps.rotatable).toBe(true);
            expect(caps.tiltable).toBe(false);
            expect(caps.elevatable).toBe(true);
        });

        it('should evaluate stair capabilities correctly', () => {
            const stair = { id: 'st1', type: 'stair', width: 36 };
            const caps = ObjectCapabilityEvaluator.getCapabilities(stair);
            expect(caps.selectable).toBe(true);
            expect(caps.material).toBe(true);
            expect(caps.movable).toBe(true);
            expect(caps.rotatable).toBe(true);
            expect(caps.tiltable).toBe(false);
            expect(caps.elevatable).toBe(true);
        });

        it('should evaluate shapes capabilities correctly', () => {
            const shape = { id: 'sh1', type: 'shape_rect', width: 50 };
            const caps = ObjectCapabilityEvaluator.getCapabilities(shape);
            expect(caps.selectable).toBe(true);
            expect(caps.material).toBe(true);
            expect(caps.movable).toBe(true);
            expect(caps.rotatable).toBe(true);
            expect(caps.tiltable).toBe(true);
            expect(caps.elevatable).toBe(true);
        });

        it('should evaluate floor cut capabilities correctly', () => {
            const floorCut = { id: 'fc1', type: 'shape_floor_cut' };
            const caps = ObjectCapabilityEvaluator.getCapabilities(floorCut);
            expect(caps.selectable).toBe(true);
            expect(caps.material).toBe(false);
            expect(caps.movable).toBe(true);
            expect(caps.rotatable).toBe(true);
        });
    });

    describe('3. CommonShortcutRegistry', () => {
        let registry;
        beforeEach(() => {
            registry = new CommonShortcutRegistry();
        });

        it('should map keys to standard common actions', () => {
            expect(registry.resolveEvent({ key: 'v' })).toBe(SHORTCUT_ACTIONS.SELECT);
            expect(registry.resolveEvent({ key: 'b' })).toBe(SHORTCUT_ACTIONS.MATERIAL);
            expect(registry.resolveEvent({ key: 'm' })).toBe(SHORTCUT_ACTIONS.MOVE);
            expect(registry.resolveEvent({ key: 'r' })).toBe(SHORTCUT_ACTIONS.SPIN);
            expect(registry.resolveEvent({ key: 't' })).toBe(SHORTCUT_ACTIONS.TILT);
            expect(registry.resolveEvent({ key: ']' })).toBe(SHORTCUT_ACTIONS.AXIS_UP);
            expect(registry.resolveEvent({ key: '[' })).toBe(SHORTCUT_ACTIONS.AXIS_DOWN);
            expect(registry.resolveEvent({ key: 'Escape' })).toBe(SHORTCUT_ACTIONS.SELECT);
            expect(registry.resolveEvent({ key: 'Delete' })).toBe(SHORTCUT_ACTIONS.DELETE);
        });

        it('should handle Ctrl+Z and Ctrl+Y undo/redo shortcuts', () => {
            expect(registry.resolveEvent({ key: 'z', ctrlKey: true })).toBe(SHORTCUT_ACTIONS.UNDO);
            expect(registry.resolveEvent({ key: 'z', ctrlKey: true, shiftKey: true })).toBe(SHORTCUT_ACTIONS.REDO);
            expect(registry.resolveEvent({ key: 'y', ctrlKey: true })).toBe(SHORTCUT_ACTIONS.REDO);
        });

        it('should ignore keystrokes when typing inside inputs', () => {
            const inputEl = { tagName: 'INPUT' };
            expect(registry.resolveEvent({ key: 'v', target: inputEl })).toBeNull();
        });
    });

    describe('4. CommonTransformEngine', () => {
        let mockCtx, transformEngine;

        beforeEach(() => {
            mockCtx = {
                requestRender: vi.fn(),
                syncToUI: vi.fn(),
                realtimeUpdate: { markDirty: vi.fn() }
            };
            transformEngine = new CommonTransformEngine(mockCtx);
        });

        it('should execute planar move on movable entities', () => {
            const chair = {
                id: 'chair_1',
                type: 'furniture',
                x: 10,
                y: 20,
                mesh3D: new THREE.Mesh()
            };

            const success = transformEngine.executeMove(chair, { x: 5, z: -10 });
            expect(success).toBe(true);
            expect(chair.x).toBe(15);
            expect(chair.y).toBe(10);
            expect(chair.mesh3D.position.x).toBe(15);
            expect(chair.mesh3D.position.z).toBe(10);
        });

        it('should execute wall opening baseline move and elevation', () => {
            const door = {
                id: 'door_1',
                type: 'door',
                t: 0.5,
                elevation: 0,
                wall: { length3D: 200, height: 280 }
            };

            const success = transformEngine.executeMove(door, { x: 20, y: 15 });
            expect(success).toBe(true);
            expect(door.t).toBe(0.6); // (0.5 * 200 + 20) / 200 = 120 / 200 = 0.6
            expect(door.elevation).toBe(15);
        });

        it('should reject move on unmovable entities (like base walls)', () => {
            const wall = {
                id: 'wall_1',
                type: 'wall',
                startX: 0,
                startY: 0
            };

            const success = transformEngine.executeMove(wall, { x: 10, z: 10 });
            expect(success).toBe(false);
        });

        it('should execute spin (Yaw) on rotatable entities', () => {
            const sofa = {
                id: 'sofa_1',
                type: 'furniture',
                rotation: 45,
                mesh3D: new THREE.Mesh()
            };

            const success = transformEngine.executeSpin(sofa, 90);
            expect(success).toBe(true);
            expect(sofa.rotation).toBe(135);
        });

        it('should execute tilt (Pitch) on tiltable entities and clamp angles', () => {
            const painting = {
                id: 'art_1',
                type: 'furniture',
                tilt: 10,
                mesh3D: new THREE.Mesh()
            };

            const success = transformEngine.executeTilt(painting, 15);
            expect(success).toBe(true);
            expect(painting.tilt).toBe(25);

            // Test clamping
            transformEngine.executeTilt(painting, 100);
            expect(painting.tilt).toBe(85); // Clamped max 85
        });

        it('should execute elevation axis steps (+10, -10) cleanly', () => {
            const table = {
                id: 'table_1',
                type: 'furniture',
                elevation: 10,
                mesh3D: new THREE.Mesh()
            };

            transformEngine.executeAxisStep(table, 1, 10);
            expect(table.elevation).toBe(20);
            expect(table.mesh3D.position.y).toBe(20);

            transformEngine.executeAxisStep(table, -1, 10);
            expect(table.elevation).toBe(10);

            // Cannot go below zero
            transformEngine.executeAxisStep(table, -1, 50);
            expect(table.elevation).toBe(0);
        });
    });

    describe('5. UniversalMaterialPaintSystem & Continuous Painting', () => {
        let mockCtx, controller, paintSystem;

        beforeEach(() => {
            ComponentRegistry.slotRegistry.clear();
            ComponentRegistry.componentRegistry.clear();

            mockCtx = {
                renderer: {
                    domElement: {
                        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
                        style: {}
                    }
                },
                camera: new THREE.PerspectiveCamera(),
                interactables: [],
                requestRender: vi.fn(),
                updateMaterialLive: vi.fn()
            };

            controller = new CommonInteractionController(mockCtx);
            paintSystem = controller.paintSystem;
        });

        it('should activate and deactivate cleanly', () => {
            expect(paintSystem.enabled).toBe(false);
            paintSystem.setActive(true);
            expect(paintSystem.enabled).toBe(true);
            paintSystem.setActive(false);
            expect(paintSystem.enabled).toBe(false);
        });

        it('should maintain active material brush for continuous multi-face painting', () => {
            paintSystem.setActiveMaterial('wood_golden_teak');
            expect(paintSystem.activeMaterial).toBe('wood_golden_teak');

            const mockDescriptor1 = {
                entity: { id: 'door_1', type: 'door', materials: { [MaterialSlots.LEAF]: { id: 'default' } } },
                faceName: 'front',
                slotName: MaterialSlots.LEAF
            };

            const mockDescriptor2 = {
                entity: { id: 'door_1', type: 'door', materials: { [MaterialSlots.FRAME]: { id: 'default' } } },
                faceName: 'frame',
                slotName: MaterialSlots.FRAME
            };

            // Paint Face A
            paintSystem.applyMaterialToDescriptor(paintSystem.activeMaterial, mockDescriptor1);
            expect(mockDescriptor1.entity.materials[MaterialSlots.LEAF].id).toBe('wood_golden_teak');

            // Paint Face B consecutively without resetting mode
            paintSystem.applyMaterialToDescriptor(paintSystem.activeMaterial, mockDescriptor2);
            expect(mockDescriptor2.entity.materials[MaterialSlots.FRAME].id).toBe('wood_golden_teak');
        });
    });

    describe('6. CommonInteractionController Unified State', () => {
        let mockCtx, controller;

        beforeEach(() => {
            mockCtx = {
                renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} } },
                camera: new THREE.PerspectiveCamera(),
                interactions: { transformControls: { detach: vi.fn() } },
                gizmoManager: { setTransformMode: vi.fn() },
                requestRender: vi.fn()
            };
            controller = new CommonInteractionController(mockCtx);
        });

        it('should switch tools and update subsystem states', () => {
            controller.setTool(COMMON_TOOLS.MATERIAL);
            expect(controller.activeTool).toBe(COMMON_TOOLS.MATERIAL);
            expect(controller.paintSystem.enabled).toBe(true);

            controller.setTool(COMMON_TOOLS.MOVE);
            expect(controller.activeTool).toBe(COMMON_TOOLS.MOVE);
            expect(controller.paintSystem.enabled).toBe(false);

            controller.setTool(COMMON_TOOLS.SELECT);
            expect(controller.activeTool).toBe(COMMON_TOOLS.SELECT);
            expect(controller.paintSystem.enabled).toBe(false);
        });

        it('should dispatch actions from keyboard shortcuts uniformly', () => {
            const keyboardEvent = { key: 'b' };
            const handled = controller.handleKeyDown(keyboardEvent);
            expect(handled).toBe(true);
            expect(controller.activeTool).toBe(COMMON_TOOLS.MATERIAL);
        });
    });

    describe('7. Sims 4 Camera Movement & Scene Navigation', () => {
        let camera, domElement, preview3D, cameraController;

        beforeEach(() => {
            camera = new THREE.PerspectiveCamera(45, 800 / 600, 1, 5000);
            camera.position.set(500, 400, 500);
            domElement = document.createElement('div');
            domElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
            preview3D = {
                requestRender: vi.fn(),
                structureGroup: new THREE.Group()
            };
            cameraController = new CameraController(camera, domElement, preview3D);
        });

        it('should configure ground-plane horizontal panning (screenSpacePanning = false)', () => {
            expect(cameraController.controls.screenSpacePanning).toBe(false);
            expect(cameraController.controls.enableDamping).toBe(true);
            expect(cameraController.controls.maxPolarAngle).toBeCloseTo(Math.PI / 2 - 0.02);
            expect(cameraController.controls.mouseButtons.RIGHT).toBe(THREE.MOUSE.PAN);
        });

        it('should handle continuous WASD ground panning', () => {
            cameraController.controls.target.set(0, 0, 0);
            const initialCamZ = camera.position.z;

            // Simulate pressing 'W' (forward)
            cameraController.activeKeys.add('w');
            cameraController.update();

            // Camera and target should move forward along ground plane
            expect(camera.position.z).not.toBe(initialCamZ);
            expect(cameraController.controls.target.z).not.toBe(0);
        });

        it('should execute 45-degree Sims 4 stepped orbit rotation', () => {
            cameraController.controls.target.set(0, 0, 0);
            cameraController.rotateSims4Isometric(1);

            expect(cameraController.isAnimating).toBe(true);
            expect(cameraController.sims4IsoIndex).toBe(1);
        });

        it('should toggle between Top-Down view and Isometric perspective with T key', () => {
            cameraController.controls.target.set(0, 0, 0);
            camera.position.set(0, 800, 0.001); // Top down
            cameraController.toggleSims4TopDown();

            expect(cameraController.isAnimating).toBe(true);
        });

        it('should zoom in and out cleanly with boundary checks', () => {
            cameraController.controls.target.set(0, 0, 0);
            const initialDist = camera.position.distanceTo(cameraController.controls.target);

            cameraController.zoomBy(-100);
            const zoomedInDist = camera.position.distanceTo(cameraController.controls.target);
            expect(zoomedInDist).toBeLessThan(initialDist);

            cameraController.zoomBy(200);
            const zoomedOutDist = camera.position.distanceTo(cameraController.controls.target);
            expect(zoomedOutDist).toBeGreaterThan(zoomedInDist);
        });
    });
});

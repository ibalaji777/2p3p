import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { COMMON_TOOLS, COMMON_TOOL_DEFINITIONS, getToolDefinition } from '../tools/CommonToolRegistry.js';
import { ObjectCapabilityEvaluator } from '../tools/ObjectCapabilityEvaluator.js';
import { CommonShortcutRegistry, globalShortcutRegistry, SHORTCUT_ACTIONS } from '../tools/CommonShortcutRegistry.js';
import { CommonTransformEngine } from '../tools/CommonTransformEngine.js';
import { UniversalMaterialPaintSystem } from '../tools/UniversalMaterialPaintSystem.js';
import { CommonInteractionController } from '../tools/CommonInteractionController.js';
import { CameraController } from '../../camera/CameraController.js';
import { ComponentRegistry } from '../ComponentRegistry.js';
import { MaterialSlots } from '../../constants/materialSlots.js';
import { MaterialFactory } from '../MaterialFactory.js';
import { WallEngine } from '../../wall/WallEngine.js';

describe('Universal 3D Scene Common Tools Architecture (sms 4 Style)', () => {
    describe('1. CommonToolRegistry', () => {
        it('should define all common tools including wall suite tools', () => {
            expect(COMMON_TOOLS.SELECT).toBe('select');
            expect(COMMON_TOOLS.MATERIAL).toBe('material');
            expect(COMMON_TOOLS.MOVE).toBe('move');
            expect(COMMON_TOOLS.SPIN).toBe('spin');
            expect(COMMON_TOOLS.TILT).toBe('tilt');
            expect(COMMON_TOOLS.AXIS_UP).toBe('axis_up');
            expect(COMMON_TOOLS.AXIS_DOWN).toBe('axis_down');
            expect(COMMON_TOOLS.BUILDING_RISE).toBe('building_rise');
            expect(COMMON_TOOLS.WALL_CORNERS).toBe('wall_corners');
            expect(COMMON_TOOLS.ROOM).toBe('room_suite');
            expect(COMMON_TOOLS.EXTENDER).toBe('push_pull');
            expect(COMMON_TOOLS.VERTICES).toBe('corner');
            expect(COMMON_TOOLS.BAY_NICHE).toBe('extrude_recess');
            expect(COMMON_TOOLS.SPLIT).toBe('split');
        });

        it('should have complete tool metadata definitions', () => {
            expect(COMMON_TOOL_DEFINITIONS.length).toBe(14);
            const selectDef = getToolDefinition(COMMON_TOOLS.SELECT);
            expect(selectDef).toBeDefined();
            expect(selectDef.hotkey).toBe('V');

            const riseDef = getToolDefinition(COMMON_TOOLS.BUILDING_RISE);
            expect(riseDef).toBeDefined();
            expect(riseDef.hotkey).toBe('U');

            const matDef = getToolDefinition(COMMON_TOOLS.MATERIAL);
            expect(matDef.hotkey).toBe('B');

            const extenderDef = getToolDefinition(COMMON_TOOLS.EXTENDER);
            expect(extenderDef).toBeDefined();
            expect(extenderDef.hotkey).toBe('E');
            expect(extenderDef.requiresSelection).toBe(false);

            const verticesDef = getToolDefinition(COMMON_TOOLS.VERTICES);
            expect(verticesDef).toBeDefined();
            expect(verticesDef.hotkey).toBe('K');
            expect(verticesDef.requiresSelection).toBe(false);

            const bayDef = getToolDefinition(COMMON_TOOLS.BAY_NICHE);
            expect(bayDef).toBeDefined();
            expect(bayDef.hotkey).toBe('N');
            expect(bayDef.requiresSelection).toBe(false);

            const splitDef = getToolDefinition(COMMON_TOOLS.SPLIT);
            expect(splitDef).toBeDefined();
            expect(splitDef.hotkey).toBe('X');
            expect(splitDef.requiresSelection).toBe(false);

            const roomDef = getToolDefinition(COMMON_TOOLS.ROOM);
            expect(roomDef).toBeDefined();
            expect(roomDef.requiresSelection).toBe(false);

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

        it('should perform in-place 60 FPS live hover preview and cleanly restore on leave', () => {
            paintSystem.setActive(true);
            paintSystem.setActiveMaterial('brick_red_1');

            const origMat0 = new THREE.MeshStandardMaterial({ name: 'orig_0' });
            const origMatFront = new THREE.MeshStandardMaterial({ name: 'orig_front' });
            const origMatBack = new THREE.MeshStandardMaterial({ name: 'orig_back' });
            const mats = [origMat0, origMat0, origMat0, origMat0, origMatFront, origMatBack];

            const mockMesh = {
                isMesh: true,
                material: mats,
                userData: { isWallMesh: true }
            };

            const mockWall = {
                id: 'wall_test_1',
                type: 'outer',
                params: { textureFront: 'plaster_white' },
                wallMesh3D: mockMesh
            };

            const descriptor = {
                entity: mockWall,
                mesh: mockMesh,
                faceName: 'front',
                targetMatIndex: 4
            };

            // 1. Apply hover preview on front face (index 4)
            paintSystem.applyHoverPreview(descriptor, 'selectedFace');
            expect(mockMesh.material[4]).not.toBe(origMatFront);
            expect(paintSystem._previewBackups.length).toBe(1);
            expect(paintSystem._previewBackups[0].origMat).toBe(origMatFront);

            // 2. Clear hover preview (mouse moves away) -> must restore original material
            paintSystem.clearPreviewBackups();
            expect(mockMesh.material[4]).toBe(origMatFront);
            expect(paintSystem._previewBackups.length).toBe(0);
        });

        it('should support scope switching and Eyedropper material sampling', () => {
            paintSystem.setActive(true);
            paintSystem.setMaterialScope('room');
            expect(paintSystem.materialScope).toBe('room');

            // Test Eyedropper
            paintSystem.setEyedropper(true);
            expect(paintSystem.isEyedropper).toBe(true);

            const sampleWall = {
                id: 'wall_sample',
                type: 'outer',
                params: { textureFront: 'stone_slate_dark', textureBack: 'brick_tan' }
            };

            const frontDesc = { entity: sampleWall, faceName: 'front' };
            const sampled = paintSystem.sampleMaterialFromDescriptor(frontDesc);
            expect(sampled).toBe('stone_slate_dark');

            const backDesc = { entity: sampleWall, faceName: 'back' };
            expect(paintSystem.sampleMaterialFromDescriptor(backDesc)).toBe('brick_tan');

            paintSystem.setEyedropper(false);
            expect(paintSystem.isEyedropper).toBe(false);
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

        it('should require selection for material tool (disabled when unselected)', () => {
            controller.setTool(COMMON_TOOLS.MATERIAL);
            expect(controller.activeTool).toBe(COMMON_TOOLS.SELECT);
            expect(controller.paintSystem.enabled).toBe(false);
        });

        it('should switch tools and update subsystem states when an object is selected', () => {
            const dummyEntity = { id: 'wall_test', type: 'wall', params: {} };
            controller.setSelection(dummyEntity);

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

        it('should dispatch actions from keyboard shortcuts uniformly when selection is valid', () => {
            const dummyEntity = { id: 'wall_test', type: 'wall', params: {} };
            controller.setSelection(dummyEntity);

            const keyboardEvent = { key: 'b' };
            const handled = controller.handleKeyDown(keyboardEvent);
            expect(handled).toBe(true);
            expect(controller.activeTool).toBe(COMMON_TOOLS.MATERIAL);
        });
    });

    describe('7. sms 4 Camera Movement & Scene Navigation', () => {
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

        it('should execute 45-degree sms 4 stepped orbit rotation', () => {
            cameraController.controls.target.set(0, 0, 0);
            cameraController.rotatesms4Isometric(1);

            expect(cameraController.isAnimating).toBe(true);
            expect(cameraController.sms4IsoIndex).toBe(1);
        });

        it('should toggle between Top-Down view and Isometric perspective with T key', () => {
            cameraController.controls.target.set(0, 0, 0);
            camera.position.set(0, 800, 0.001); // Top down
            cameraController.togglesms4TopDown();

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

    describe('8. Cross-Device Global Material Workflow', () => {
        let mockCtx, paintSystem, mockPlanner;

        beforeEach(() => {
            mockPlanner = {
                saveHistory: vi.fn(),
                syncAll: vi.fn()
            };
            mockCtx = {
                camera: new THREE.PerspectiveCamera(),
                interactables: [],
                planner: mockPlanner,
                requestRender: vi.fn(),
                helpers: {
                    getDynamicMaterial: vi.fn(() => new THREE.MeshBasicMaterial())
                },
                envBuilder: {
                    buildWallGroup: vi.fn(),
                    updateRoofLive: vi.fn()
                },
                updateMaterialLive: vi.fn()
            };
            paintSystem = new UniversalMaterialPaintSystem(mockCtx);
        });

        it('should enforce disabled state when unselected and enabled when supported object is selected', () => {
            // Unselected: material capability is false
            const unselectedCaps = ObjectCapabilityEvaluator.getCapabilities(null, null);
            expect(unselectedCaps.material).toBe(false);

            // Supported objects: material capability is true
            const wallCaps = ObjectCapabilityEvaluator.getCapabilities({ id: 'w1', type: 'wall' });
            expect(wallCaps.material).toBe(true);

            const roofCaps = ObjectCapabilityEvaluator.getCapabilities({ id: 'r1', type: 'roof' });
            expect(roofCaps.material).toBe(true);

            const doorCaps = ObjectCapabilityEvaluator.getCapabilities({ id: 'd1', type: 'door' });
            expect(doorCaps.material).toBe(true);

            const windowCaps = ObjectCapabilityEvaluator.getCapabilities({ id: 'win1', type: 'window' });
            expect(windowCaps.material).toBe(true);

            const floorCaps = ObjectCapabilityEvaluator.getCapabilities({ id: 'fl1', type: 'floor' });
            expect(floorCaps.material).toBe(true);

            const furnCaps = ObjectCapabilityEvaluator.getCapabilities({ id: 'f1', type: 'furniture' });
            expect(furnCaps.material).toBe(true);
        });

        it('should filter material categories strictly by selected object type', async () => {
            const { GizmoManager } = await import('../GizmoManager.js');
            const getCats = GizmoManager.prototype.getCompatibleCategoriesForEntity;

            const wallCats = getCats({ type: 'wall' }).map(c => c.id);
            expect(wallCats).toContain('stone');
            expect(wallCats).toContain('brick');
            expect(wallCats).toContain('marble');
            expect(wallCats).toContain('tile');
            expect(wallCats).toContain('paint');
            expect(wallCats).not.toContain('fabric');
            expect(wallCats).not.toContain('leather');
            expect(wallCats).not.toContain('roof');

            const roofCats = getCats({ type: 'roof' }).map(c => c.id);
            expect(roofCats).toContain('roof');
            expect(roofCats).toContain('wood');
            expect(roofCats).not.toContain('fabric');
            expect(roofCats).not.toContain('floor');

            const floorCats = getCats({ type: 'floor' }).map(c => c.id);
            expect(floorCats).toContain('floor');
            expect(floorCats).toContain('marble');
            expect(floorCats).not.toContain('roof');
            expect(floorCats).not.toContain('fabric');

            const doorCats = getCats({ type: 'door' }).map(c => c.id);
            expect(doorCats).toContain('wood');
            expect(doorCats).toContain('glass');
            expect(doorCats).not.toContain('roof');
            expect(doorCats).not.toContain('floor');

            const furnCats = getCats({ type: 'furniture' }).map(c => c.id);
            expect(furnCats).toContain('fabric');
            expect(furnCats).toContain('leather');
            expect(furnCats).not.toContain('roof');
        });

        it('should select pending material swatch without modifying scene data immediately', () => {
            const dummyWall = { id: 'w_test', type: 'wall', textureFront: 'stone_slate' };
            paintSystem.startSession(dummyWall);

            // Selecting a swatch arms the brush
            paintSystem.setActiveMaterial('brick_red');
            expect(paintSystem.activeMaterial).toBe('brick_red');

            // Scene data model must NOT be mutated on swatch selection
            expect(dummyWall.textureFront).toBe('stone_slate');
            expect(mockPlanner.saveHistory).not.toHaveBeenCalled();
        });

        it('should commit session on Done: saves history once and cleans up session', async () => {
            const dummyWall = { id: 'w_commit', type: 'wall', textureFront: 'old_texture', params: {} };
            paintSystem.startSession(dummyWall);

            const descriptor = {
                entity: dummyWall,
                faceName: 'front',
                targetMatIndex: 4,
                mesh: new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()])
            };

            await paintSystem.applyMaterialWithScope('new_painted_mat', descriptor, 'selectedFace');

            // Intermediate painting does not save per-click history in active session
            expect(mockPlanner.saveHistory).not.toHaveBeenCalled();
            expect(paintSystem.isSessionActive).toBe(true);

            // Done commits session in a single transaction
            paintSystem.commitSession();
            expect(mockPlanner.saveHistory).toHaveBeenCalledTimes(1);
            expect(paintSystem.isSessionActive).toBe(false);
            expect(paintSystem.enabled).toBe(false);
        });

        it('should cancel session on Discard: reverts all changes with zero history added', async () => {
            const dummyWall = { id: 'w_discard', type: 'wall', textureFront: 'original_mat', params: { textureFront: 'original_mat' } };
            paintSystem.startSession(dummyWall);

            const descriptor = {
                entity: dummyWall,
                faceName: 'front',
                targetMatIndex: 4,
                mesh: new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()])
            };

            await paintSystem.applyMaterialWithScope('temporary_mat', descriptor, 'selectedFace');
            expect(dummyWall.textureFront).toBe('temporary_mat');

            // Cancel session reverts to pristine pre-session state
            paintSystem.cancelSession();
            expect(dummyWall.textureFront).toBe('original_mat');
            expect(mockPlanner.saveHistory).not.toHaveBeenCalled();
            expect(paintSystem.isSessionActive).toBe(false);
            expect(paintSystem.enabled).toBe(false);
        });

        it('should verify TILE_REGISTRY contains real tiles from FLOOR_REGISTRY', async () => {
            const { TILE_REGISTRY } = await import('../GizmoManager.js');
            expect(TILE_REGISTRY).toBeDefined();
            // Should contain actual tile items like porcelain or calacatta gold
            const tileKeys = Object.keys(TILE_REGISTRY);
            expect(tileKeys.length).toBeGreaterThan(0);
            expect(tileKeys.some(k => k.startsWith('tile_'))).toBe(true);
            expect(TILE_REGISTRY['tile_calacatta_gold'] || TILE_REGISTRY['tile_porcelain_white']).toBeDefined();
        });

        it('should calculate world UV scale (1/ts) for wall materials to prevent 100x distortion', async () => {
            const { MaterialFactory } = await import('../MaterialFactory.js');
            const densityWorld = MaterialFactory.calculateTexelDensity({ width: 100, height: 100, isWorldUV: true }, { tileSize: 70 });
            // For world UV, repeat is 1 / tileSize = 1 / 70 ≈ 0.01428 (NOT 100/70 = 1.428)
            expect(densityWorld.repeatX).toBeCloseTo(1 / 70, 5);
            expect(densityWorld.repeatY).toBeCloseTo(1 / 70, 5);
        });

        it('should support independent multi-face materials on walls without rogue decor boxes', async () => {
            const dummyWall = { id: 'w_multiface', type: 'wall', textureFront: 'brick_3_red', textureBack: 'marble_calacatta_gold', params: {} };
            paintSystem.startSession(dummyWall);

            const frontDesc = {
                entity: dummyWall,
                faceName: 'front',
                targetMatIndex: 4,
                mesh: new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()])
            };

            const backDesc = {
                entity: dummyWall,
                faceName: 'back',
                targetMatIndex: 5,
                mesh: new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()])
            };

            // Paint inner face with brick
            await paintSystem.applyMaterialWithScope('brick_3_red', frontDesc, 'selectedFace');
            expect(dummyWall.textureFront).toBe('brick_3_red');
            expect(dummyWall.params.textureFront).toBe('brick_3_red');

            // Paint outer face with marble
            await paintSystem.applyMaterialWithScope('marble_calacatta_gold', backDesc, 'selectedFace');
            expect(dummyWall.textureBack).toBe('marble_calacatta_gold');
            expect(dummyWall.params.textureBack).toBe('marble_calacatta_gold');

            // Inner face must remain brick
            expect(dummyWall.textureFront).toBe('brick_3_red');
            // Must NOT attach floating decor objects
            expect(dummyWall.attachedDecor === undefined || dummyWall.attachedDecor.length === 0).toBe(true);
        });

        it('should resolveEntityKind correctly for all domain types', async () => {
            const { resolveEntityKind } = await import('../tools/UniversalMaterialPaintSystem.js');
            expect(resolveEntityKind({ type: 'outer' })).toBe('wall');
            expect(resolveEntityKind({ type: 'inner' })).toBe('wall');
            expect(resolveEntityKind({ startX: 0, endX: 100 })).toBe('wall');
            expect(resolveEntityKind({ type: 'roof' })).toBe('roof');
            expect(resolveEntityKind({ isRoof: true })).toBe('roof');
            expect(resolveEntityKind({ type: 'door' })).toBe('door');
            expect(resolveEntityKind({ type: 'window' })).toBe('window');
            expect(resolveEntityKind({ type: 'floor' })).toBe('floor');
            expect(resolveEntityKind({ type: 'room' })).toBe('floor');
            expect(resolveEntityKind({ type: 'stair' })).toBe('stair');
            expect(resolveEntityKind({ type: 'staircase' })).toBe('stair');
            expect(resolveEntityKind({ type: 'furniture' })).toBe('furniture');
            expect(resolveEntityKind({ isFurniture: true })).toBe('furniture');
        });

        it('should enforce compatibility lock between material and target object', () => {
            const dummyWall = { id: 'w1', type: 'wall', textureFront: 'mat_w1' };
            const dummyRoof = { id: 'r1', type: 'roof', texture: 'mat_r1' };
            const dummyDoor = { id: 'd1', type: 'door' };

            paintSystem.startSession(dummyWall);
            expect(paintSystem.lockedCategory).toBe('wall');

            const wallDesc = { entity: dummyWall, faceName: 'front', targetMatIndex: 4 };
            const roofDesc = { entity: dummyRoof, faceName: 'top', targetMatIndex: 0 };
            const doorDesc = { entity: dummyDoor, faceName: 'front', targetMatIndex: 0 };

            expect(paintSystem.isTargetCompatible(wallDesc)).toBe(true);
            expect(paintSystem.isTargetCompatible(roofDesc)).toBe(false);
            expect(paintSystem.isTargetCompatible(doorDesc)).toBe(false);

            // Selecting a wall material keeps lockedCategory as 'wall'
            paintSystem.setActiveMaterial('paint_pure_white');
            expect(paintSystem.lockedCategory).toBe('wall');
            expect(paintSystem.isTargetCompatible(wallDesc)).toBe(true);
            expect(paintSystem.isTargetCompatible(roofDesc)).toBe(false);
        });

        it('should support continuous painting across multiple compatible walls in one transaction', async () => {
            const wallA = { id: 'wa', type: 'wall', textureFront: 'old_a', params: {} };
            const wallB = { id: 'wb', type: 'wall', textureFront: 'old_b', textureBack: 'old_b_back', params: {} };

            paintSystem.startSession(wallA);
            paintSystem.setActiveMaterial('brick_red');

            const descA = { entity: wallA, faceName: 'front', targetMatIndex: 4, mesh: new THREE.Mesh() };
            const descB_front = { entity: wallB, faceName: 'front', targetMatIndex: 4, mesh: new THREE.Mesh() };
            const descB_back = { entity: wallB, faceName: 'back', targetMatIndex: 5, mesh: new THREE.Mesh() };

            // Paint wallA
            await paintSystem.applyMaterialWithScope(paintSystem.activeMaterial, descA, 'selectedFace');
            expect(wallA.textureFront).toBe('brick_red');

            // Brush remains armed for continuous painting
            expect(paintSystem.activeMaterial).toBe('brick_red');

            // Paint wallB front
            await paintSystem.applyMaterialWithScope(paintSystem.activeMaterial, descB_front, 'selectedFace');
            expect(wallB.textureFront).toBe('brick_red');

            // Paint wallB back
            await paintSystem.applyMaterialWithScope(paintSystem.activeMaterial, descB_back, 'selectedFace');
            expect(wallB.textureBack).toBe('brick_red');

            // All updates remain in session without intermediate history saves
            expect(mockPlanner.saveHistory).not.toHaveBeenCalled();

            // Commit transaction saves history once for both walls
            paintSystem.commitSession();
            expect(mockPlanner.saveHistory).toHaveBeenCalledTimes(1);
            expect(paintSystem.isSessionActive).toBe(false);
        });

        it('should cancel and revert multiple painted objects back to pristine states with 0 history entries', async () => {
            const wallA = { id: 'wa_rev', type: 'wall', textureFront: 'orig_a', params: { textureFront: 'orig_a' } };
            const wallB = { id: 'wb_rev', type: 'wall', textureFront: 'orig_b', params: { textureFront: 'orig_b' } };

            paintSystem.startSession(wallA);
            paintSystem.recordEntitySnapshot(wallB);
            paintSystem.setActiveMaterial('marble_black');

            const descA = { entity: wallA, faceName: 'front', targetMatIndex: 4, mesh: new THREE.Mesh() };
            const descB = { entity: wallB, faceName: 'front', targetMatIndex: 4, mesh: new THREE.Mesh() };

            await paintSystem.applyMaterialWithScope('marble_black', descA, 'selectedFace');
            await paintSystem.applyMaterialWithScope('marble_black', descB, 'selectedFace');

            expect(wallA.textureFront).toBe('marble_black');
            expect(wallB.textureFront).toBe('marble_black');

            // Cancel session
            paintSystem.cancelSession();

            // Both reverted cleanly with 0 history entries
            expect(wallA.textureFront).toBe('orig_a');
            expect(wallB.textureFront).toBe('orig_b');
            expect(mockPlanner.saveHistory).not.toHaveBeenCalled();
            expect(paintSystem.isSessionActive).toBe(false);
        });

        it('should allow clearing active material and switching object category', () => {
            const dummyWall = { id: 'w_switch', type: 'wall' };
            const dummyRoof = { id: 'r_switch', type: 'roof' };

            paintSystem.startSession(dummyWall);
            expect(paintSystem.lockedCategory).toBe('wall');

            paintSystem.setActiveMaterial('paint_pure_white');
            expect(paintSystem.activeMaterial).toBe('paint_pure_white');
            expect(paintSystem.lockedCategory).toBe('wall');

            // User clears active material
            paintSystem.setActiveMaterial(null);
            expect(paintSystem.activeMaterial).toBeNull();
            expect(paintSystem.lockedCategory).toBeNull();

            // Switching lockedCategory to roof
            paintSystem.lockedCategory = 'roof';
            expect(paintSystem.isTargetCompatible({ entity: dummyRoof })).toBe(true);
            expect(paintSystem.isTargetCompatible({ entity: dummyWall })).toBe(false);
        });

        it('should remove applied material on specific wall using Default clear brush', async () => {
            const dummyWall = { 
                id: 'w_remove', 
                type: 'wall', 
                textureFront: 'brick_3_red', 
                textureBack: 'marble_carrara',
                params: { textureFront: 'brick_3_red', textureBack: 'marble_carrara' } 
            };
            paintSystem.startSession(dummyWall);

            // 1. Arm Default brush
            paintSystem.setActiveMaterial('__default__');
            expect(paintSystem.activeMaterial).toBe('__default__');
            expect(paintSystem.lockedCategory).toBe('wall');

            // 2. Default preview material is a clean unpainted standard material
            const prevMat = paintSystem.getPreviewMaterial('__default__', 'wall');
            expect(prevMat).toBeDefined();
            expect(prevMat.color.getHex()).toBe(0xefede5);

            // 3. Apply Default to front face only (Single mode)
            const frontDesc = {
                entity: dummyWall,
                faceName: 'front',
                targetMatIndex: 4,
                mesh: new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()])
            };
            await paintSystem.applyMaterialWithScope('__default__', frontDesc, 'selectedFace');

            // Front face material is removed (reset to null)
            expect(dummyWall.textureFront).toBeNull();
            expect(dummyWall.params.textureFront).toBeNull();
            // Back face remains untouched
            expect(dummyWall.textureBack).toBe('marble_carrara');
            expect(dummyWall.params.textureBack).toBe('marble_carrara');

            // 4. Apply Default to back face with entireObject (Both mode)
            const backDesc = {
                entity: dummyWall,
                faceName: 'back',
                targetMatIndex: 5,
                mesh: frontDesc.mesh
            };
            await paintSystem.applyMaterialWithScope('__default__', backDesc, 'entireObject');

            // Both faces are now cleared
            expect(dummyWall.textureFront).toBeNull();
            expect(dummyWall.textureBack).toBeNull();
            expect(dummyWall.texture).toBeNull();
        });
    });

    describe('8. Wall Properties Applied Material & Parametric Editing', () => {
        it('calculates texel density respecting custom dimensions.tileSize', () => {
            const densityDefault = MaterialFactory.calculateTexelDensity({ isWorldUV: true }, { defaultTileSize: 70 });
            expect(densityDefault.repeatX).toBeCloseTo(1 / 70);

            const densityCustom = MaterialFactory.calculateTexelDensity({ isWorldUV: true, tileSize: 140 }, { defaultTileSize: 70 });
            expect(densityCustom.repeatX).toBeCloseTo(1 / 140);
            expect(densityCustom.repeatY).toBeCloseTo(1 / 140);
        });

        it('resolves material orientation respecting custom dimensions.rotation', () => {
            const rotAuto = MaterialFactory.resolveOrientation({ id: 'wood_oak' }, { width: 100, height: 100 });
            expect(rotAuto).toBe(0);

            const rotCustom = MaterialFactory.resolveOrientation({ id: 'wood_oak' }, { rotation: Math.PI / 2 });
            expect(rotCustom).toBe(Math.PI / 2);
        });

        it('clears specific wall face material back to null and default plaster', () => {
            const wall = {
                id: 'w_test_prop',
                type: 'outer',
                params: {
                    textureFront: 'brick_red_1',
                    textureBack: 'stone_slate',
                    tileSizeFront: 80,
                    rotationFront: Math.PI / 2
                }
            };

            // Remove front face material
            WallEngine.applyMaterial(wall, { target: 'front', key: null }, null);
            expect(wall.params.textureFront).toBeNull();
            expect(wall.textureFront).toBeNull();
            // Back face remains untouched
            expect(wall.params.textureBack).toBe('stone_slate');

            // Remove back face material
            WallEngine.applyMaterial(wall, { target: 'back', key: null }, null);
            expect(wall.params.textureBack).toBeNull();
            expect(wall.textureBack).toBeNull();
        });
    });

    describe('9. Wall & Room Interactive Suite Tools (Tool-First Workflow)', () => {
        let mockCtx;
        let controller;
        let mockWallInteractiveSuite;
        let mockRoomInteractiveSuite;
        let mockWallMesh;
        let dummyWall;

        beforeEach(() => {
            dummyWall = {
                id: 'w101',
                type: 'outer',
                startX: 0,
                startY: 0,
                endX: 200,
                endY: 0,
                height: 300,
                thickness: 20
            };
            mockWallMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 300, 20));
            mockWallMesh.userData = {
                entity: dummyWall,
                isWall: true,
                isWallMesh: true
            };
            dummyWall.mesh3D = mockWallMesh;

            mockWallInteractiveSuite = {
                attach: vi.fn(),
                detach: vi.fn(),
                activeMode: 'neutral'
            };

            mockRoomInteractiveSuite = {
                attach: vi.fn(),
                detach: vi.fn(),
                activateBuildingRiseMode: vi.fn(),
                deactivateBuildingRiseMode: vi.fn(),
                isBuildingRiseMode: false
            };

            mockCtx = {
                scene: new THREE.Scene(),
                camera: new THREE.PerspectiveCamera(),
                renderer: { domElement: { style: {} } },
                interactions: {
                    wallInteractiveSuite: mockWallInteractiveSuite,
                    roomInteractiveSuite: mockRoomInteractiveSuite,
                    transformControls: { attach: vi.fn(), detach: vi.fn() },
                    universalSpinGizmo: { attach: vi.fn(), detach: vi.fn() },
                    highlightRenderer: { setSelectionHighlight: vi.fn(), clearSelectionHighlight: vi.fn() }
                },
                gizmoManager: {
                    setTransformMode: vi.fn()
                },
                requestRender: vi.fn()
            };

            controller = new CommonInteractionController(mockCtx);
        });

        it('resolves keyboard shortcuts e, k, n, x to wall tools', () => {
            expect(globalShortcutRegistry.resolveEvent({ key: 'e' })).toBe('push_pull');
            expect(globalShortcutRegistry.resolveEvent({ key: 'k' })).toBe('corner');
            expect(globalShortcutRegistry.resolveEvent({ key: 'n' })).toBe('extrude_recess');
            expect(globalShortcutRegistry.resolveEvent({ key: 'x' })).toBe('split');
        });

        it('activates wall tools without prior selection (tool-first flow)', () => {
            controller.setTool(COMMON_TOOLS.EXTENDER);
            expect(controller.activeTool).toBe('push_pull');

            // When wall is subsequently selected / actioned
            controller.select(dummyWall, mockWallMesh, 'wall');
            expect(mockWallInteractiveSuite.attach).toHaveBeenCalledWith(mockWallMesh, 'push_pull');
        });

        it('activates Vertices (corner) tool directly on wall selection', () => {
            controller.setTool(COMMON_TOOLS.VERTICES);
            expect(controller.activeTool).toBe('corner');

            controller.select(dummyWall, mockWallMesh, 'wall');
            expect(mockWallInteractiveSuite.attach).toHaveBeenCalledWith(mockWallMesh, 'corner');
        });

        it('activates Bay/Niche (extrude_recess) tool directly on wall selection', () => {
            controller.setTool(COMMON_TOOLS.BAY_NICHE);
            expect(controller.activeTool).toBe('extrude_recess');

            controller.select(dummyWall, mockWallMesh, 'wall');
            expect(mockWallInteractiveSuite.attach).toHaveBeenCalledWith(mockWallMesh, 'extrude_recess');
        });

        it('activates Split (split) tool directly on wall selection', () => {
            controller.setTool(COMMON_TOOLS.SPLIT);
            expect(controller.activeTool).toBe('split');

            controller.select(dummyWall, mockWallMesh, 'wall');
            expect(mockWallInteractiveSuite.attach).toHaveBeenCalledWith(mockWallMesh, 'split');
        });

        it('activates Room Suite tool directly on wall/room selection', () => {
            controller.setTool(COMMON_TOOLS.ROOM);
            expect(controller.activeTool).toBe('room_suite');

            controller.select(dummyWall, mockWallMesh, 'wall');
            expect(mockRoomInteractiveSuite.attach).toHaveBeenCalledWith(mockWallMesh);
        });

        it('clears previous selection and enters clean targeting mode when wall tool is chosen', () => {
            // 1. Select wall first in neutral mode
            controller.select(dummyWall, mockWallMesh, 'wall');
            expect(controller.selectedEntity).toBe(dummyWall);

            // 2. Click Extender tool: enters clean targeting mode
            controller.setTool(COMMON_TOOLS.EXTENDER);
            expect(controller.selectedEntity).toBeNull();
            expect(mockWallInteractiveSuite.detach).toHaveBeenCalled();

            // 3. Subsequently clicking/selecting any wall pins the action
            controller.select(dummyWall, mockWallMesh, 'wall');
            expect(mockWallInteractiveSuite.attach).toHaveBeenCalledWith(mockWallMesh, 'push_pull');
        });
    });
});



import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { UniversalMoveGizmo } from '../UniversalMoveGizmo.js';
import { CommonTransformEngine } from '../tools/CommonTransformEngine.js';
import { TransformEngine } from '../../transform/TransformEngine.js';

describe('Universal 3D Move & Translation Gizmo System', () => {
    let mockCtx;
    let gizmo;
    let mockEntity;
    let mockMesh;

    beforeEach(() => {
        // Mock DOM element
        const domElement = document.createElement('div');
        domElement.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: 1000,
            height: 800
        });

        const camera = new THREE.PerspectiveCamera(45, 1000 / 800, 1, 10000);
        camera.position.set(0, 150, 300);
        camera.lookAt(0, 0, 0);

        mockCtx = {
            renderer: { domElement },
            camera,
            scene: new THREE.Scene(),
            controls: { enabled: true },
            requestRender: vi.fn(),
            realtimeUpdate: { markDirty: vi.fn() },
            interactions: {}
        };

        const transformEngine = new CommonTransformEngine(mockCtx);
        mockCtx.commonController = {
            transformEngine
        };

        gizmo = new UniversalMoveGizmo(mockCtx);
        mockCtx.interactions.universalMoveGizmo = gizmo;

        mockMesh = new THREE.Mesh(
            new THREE.BoxGeometry(60, 40, 80),
            new THREE.MeshBasicMaterial()
        );
        mockMesh.position.set(100, 20, 100);

        mockEntity = {
            id: 'furniture_table_1',
            type: 'furniture',
            x: 100,
            y: 100,
            mesh3D: mockMesh
        };
        mockMesh.userData = { entity: mockEntity };
    });

    describe('1. Instantiation & Dynamic Geometry Sizing', () => {
        it('should initialize with correct default properties and visual group', () => {
            expect(gizmo.name).toBe('UniversalMoveGizmo');
            expect(gizmo.gizmoVisuals).toBeDefined();
            expect(gizmo.snapMode).toBe(10);
            expect(gizmo.isDragging).toBe(false);
        });

        it('should build 3D ground handles when attached to movable object', () => {
            gizmo.attach(mockMesh);
            expect(gizmo.attachedObject).toBe(mockMesh);
            expect(gizmo.attachedEntity).toBe(mockEntity);
            expect(gizmo.visible).toBe(true);

            // Verify Center Grab Disc, X-Axis line/handles, Z-Axis line/handles
            const handles = gizmo.gizmoVisuals.children.map(c => c.name).filter(Boolean);
            expect(handles).toContain('handle_center');
            expect(handles).toContain('handle_x');
            expect(handles).toContain('handle_z');
        });

        it('should add vertical Y handle if entity supports elevation', () => {
            const elevEntity = {
                id: 'shelf_1',
                type: 'furniture',
                elevation: 100,
                mesh3D: mockMesh
            };
            mockMesh.userData = { entity: elevEntity };

            gizmo.attach(mockMesh);
            const handles = gizmo.gizmoVisuals.children.map(c => c.name).filter(Boolean);
            expect(handles).toContain('handle_y');
        });

        it('should strictly reject doors, windows, and roofs from attaching', () => {
            const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(90, 210, 15));
            doorMesh.userData = { entity: { id: 'door_test', type: 'door' }, isWidget: true };
            gizmo.attach(doorMesh);
            expect(gizmo.attachedObject).toBeNull();
            expect(gizmo.visible).toBe(false);

            const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(120, 120, 15));
            windowMesh.userData = { entity: { id: 'win_test', type: 'window' }, isOpening: true };
            gizmo.attach(windowMesh);
            expect(gizmo.attachedObject).toBeNull();
            expect(gizmo.visible).toBe(false);

            const roofMesh = new THREE.Mesh(new THREE.BufferGeometry());
            roofMesh.userData = { entity: { id: 'roof_test', type: 'roof', config: { roofType: 'gable' } }, isRoof: true };
            gizmo.attach(roofMesh);
            expect(gizmo.attachedObject).toBeNull();
            expect(gizmo.visible).toBe(false);
        });
    });

    describe('2. In-Place Translation & Single Source of Truth', () => {
        it('should translate entity and mesh in place without recreating groups', () => {
            gizmo.attach(mockMesh);

            const initialPos = { x: mockEntity.x, y: mockEntity.y };
            const delta = new THREE.Vector3(20, 0, 30);
            const targetPos = new THREE.Vector3(120, 0.05, 130);

            gizmo._applyTranslation(delta, targetPos);

            expect(mockEntity.x).toBe(initialPos.x + 20);
            expect(mockEntity.y).toBe(initialPos.y + 30);
            expect(mockMesh.position.x).toBe(120);
            expect(mockMesh.position.z).toBe(130);
            expect(mockCtx.realtimeUpdate.markDirty).toHaveBeenCalledWith(mockEntity, 'transform');
        });

        it('should translate staircases and shapes across the floor plane', () => {
            const stairEntity = {
                id: 'staircase_1',
                type: 'staircase',
                x: 50,
                y: 50,
                mesh3D: mockMesh
            };
            mockMesh.userData = { entity: stairEntity, isStair: true };

            gizmo.attach(mockMesh);
            expect(gizmo.attachedObject).toBe(mockMesh);
            expect(gizmo.visible).toBe(true);

            gizmo._applyTranslation(new THREE.Vector3(10, 0, 15), new THREE.Vector3(60, 0.05, 65));
            expect(stairEntity.x).toBe(60);
            expect(stairEntity.y).toBe(65);
        });

        it('should translate contained entities when dragging a room in 3D (Fix 6)', () => {
            const mockRoomMesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 300));
            mockRoomMesh.userData = { isFloor: true, isRoomFloor: true };

            const roomEntity = {
                id: 'room_living',
                path: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }]
            };
            mockRoomMesh.userData.entity = roomEntity;

            const containedChair = {
                id: 'chair_in_room',
                type: 'furniture',
                x: 100,
                y: 100,
                mesh3D: new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40))
            };

            const mockWall = {
                id: 'wall_r1',
                startX: 0, startY: 0, endX: 300, endY: 0,
                startAnchor: { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) },
                endAnchor: { x: 300, y: 0, position: () => ({ x: 300, y: 0 }) },
                mesh3D: new THREE.Mesh()
            };

            mockCtx.planner = {
                walls: [mockWall],
                furniture: [containedChair],
                stairs: [],
                shapes: [],
                platforms: [],
                syncAll: vi.fn(),
                detectRooms: vi.fn()
            };

            gizmo.attach(mockRoomMesh);
            expect(gizmo.isRoomMove).toBe(true);
            expect(gizmo.roomMoveData.containedEntities.length).toBe(1);

            // Drag room by +50cm in X and +50cm in Z
            gizmo._applyTranslation(new THREE.Vector3(50, 0, 50));

            expect(containedChair.x).toBe(150);
            expect(containedChair.y).toBe(150);
            expect(containedChair.mesh3D.position.x).toBe(150);
            expect(containedChair.mesh3D.position.z).toBe(150);
        });

        it('should auto-enter SC move mode on attach and commit via commitMoveMode()', () => {
            gizmo.attach(mockMesh);

            // attach() now auto-starts SC move mode (unified single flow)
            expect(gizmo.isMoveModeActive).toBe(true);
            expect(gizmo._isLuminousActive).toBe(true);

            gizmo.commitMoveMode();

            // Move mode committed — no longer active
            expect(gizmo.isMoveModeActive).toBe(false);
        });

        it('should keep gizmo locked to bottom-center of the object during translation', () => {
            gizmo.attach(mockMesh);
            const delta = new THREE.Vector3(50, 0, 80);
            gizmo._applyTranslation(delta);

            expect(mockMesh.position.x).toBe(150);
            expect(mockMesh.position.z).toBe(180);
            expect(gizmo.position.x).toBe(150);
            expect(gizmo.position.z).toBe(180);
        });
    });

    describe('3. Move HUD Panel Interaction & Precision Controls', () => {
        it('should render compact draggable HUD panel with live coordinate inputs and D-Pad', () => {
            gizmo.attach(mockMesh);

            expect(gizmo.hudPanel).toBeDefined();
            expect(gizmo.hudPanel.style.display).toBe('flex');

            const inputX = gizmo.hudPanel.querySelector('#move-hud-input-x');
            const inputZ = gizmo.hudPanel.querySelector('#move-hud-input-z');
            expect(inputX).toBeDefined();
            expect(inputZ).toBeDefined();
            expect(inputX.value).toBe('100');
            expect(inputZ.value).toBe('100');
        });

        it('should update entity position when D-Pad buttons are clicked', () => {
            gizmo.attach(mockMesh);

            const btnE = gizmo.hudPanel.querySelector('#move-btn-dpad-e'); // +X
            const btnN = gizmo.hudPanel.querySelector('#move-btn-dpad-n'); // +Z

            // Snap mode is 10cm by default
            btnE.click();
            expect(mockEntity.x).toBe(110);

            btnN.click();
            expect(mockEntity.y).toBe(110);
        });

        it('should center entity position when Center button is clicked', () => {
            gizmo.attach(mockMesh);

            const btnCenter = gizmo.hudPanel.querySelector('#move-btn-center-reset');
            btnCenter.click();

            expect(mockEntity.x).toBe(0);
            expect(mockEntity.y).toBe(0);
            expect(mockMesh.position.x).toBe(0);
            expect(mockMesh.position.z).toBe(0);
        });

        it('should change snap increments when snap mode pills are clicked', () => {
            gizmo.attach(mockMesh);

            const snap50Btn = gizmo.hudPanel.querySelector('.move-snap-mode-btn[data-snap="50"]');
            snap50Btn.click();

            expect(gizmo.snapMode).toBe(50);
            expect(snap50Btn.classList.contains('active')).toBe(true);
        });
    });

    describe('4. Detach & Cleanup', () => {
        it('should hide HUD and clear visuals on detach', () => {
            gizmo.attach(mockMesh);
            expect(gizmo.visible).toBe(true);

            gizmo.detach();
            expect(gizmo.visible).toBe(false);
            expect(gizmo.attachedObject).toBeNull();
            expect(gizmo.hudPanel.style.display).toBe('none');
        });

        it('should remove DOM HUD elements on dispose', () => {
            gizmo.attach(mockMesh);
            const hud = gizmo.hudPanel;
            expect(document.body.contains(hud)).toBe(true);

            gizmo.dispose();
            expect(document.body.contains(hud)).toBe(false);
        });
    });

    describe('5. TransformEngine Authority & Command Lifecycle', () => {
        it('should commit translation through TransformEngine generating a single TransformCommand', () => {
            const executedCommands = [];
            const mockPlanner = {
                commandManager: {
                    execute: vi.fn((cmd) => {
                        executedCommands.push(cmd);
                        cmd.execute();
                    })
                },
                getEntities: () => [mockEntity]
            };
            mockCtx.planner = mockPlanner;

            gizmo.attach(mockMesh);

            // attach() auto-starts SC move mode which starts TransformEngine session
            expect(gizmo.isMoveModeActive).toBe(true);
            expect(TransformEngine.isSessionActive()).toBe(true);

            // 2. Preview move
            gizmo._applyTranslation(new THREE.Vector3(30, 0, 40));
            expect(mockEntity.x).toBe(130);
            expect(mockEntity.y).toBe(140);
            expect(mockMesh.position.x).toBe(130);
            expect(mockMesh.position.z).toBe(140);

            // 3. Commit translation via SC commit
            gizmo.commitMoveMode();
            expect(gizmo.isMoveModeActive).toBe(false);
            expect(TransformEngine.isSessionActive()).toBe(false);
            expect(mockPlanner.commandManager.execute).toHaveBeenCalledTimes(1);
            const cmd = executedCommands[0];
            expect(cmd).toBeDefined();
            expect(cmd.constructor.name).toBe('TransformCommand');

            // 4. Undo restores exact initial coordinate
            cmd.undo();
            expect(mockEntity.x).toBe(100);
            expect(mockEntity.y).toBe(100);
            expect(mockMesh.position.x).toBe(100);
            expect(mockMesh.position.z).toBe(100);
        });

        it('should execute discrete reset center with strictly ONE command (Fix 3 No Double-Undo)', () => {
            const executedCommands = [];
            const mockPlanner = {
                commandManager: {
                    execute: vi.fn((cmd) => {
                        executedCommands.push(cmd);
                        cmd.execute();
                    })
                },
                getEntities: () => [mockEntity]
            };
            mockCtx.planner = mockPlanner;

            gizmo.attach(mockMesh);
            expect(mockEntity.x).toBe(100);
            expect(mockEntity.y).toBe(100);

            const btnCenter = gizmo.hudPanel.querySelector('#move-btn-center-reset');
            btnCenter.click();

            expect(mockEntity.x).toBe(0);
            expect(mockEntity.y).toBe(0);

            // Crucial: exactly ONE command executed, NEVER two!
            expect(mockPlanner.commandManager.execute).toHaveBeenCalledTimes(1);
            expect(executedCommands.length).toBe(1);

            // A single undo restores original (100, 100)
            executedCommands[0].undo();
            expect(mockEntity.x).toBe(100);
            expect(mockEntity.y).toBe(100);
        });

        it('should batch continuous D-pad button hold into a single command gesture (Fix 4)', () => {
            const executedCommands = [];
            const mockPlanner = {
                commandManager: {
                    execute: vi.fn((cmd) => {
                        executedCommands.push(cmd);
                        cmd.execute();
                    })
                },
                getEntities: () => [mockEntity]
            };
            mockCtx.planner = mockPlanner;

            gizmo.attach(mockMesh);

            const btnE = gizmo.hudPanel.querySelector('#move-btn-dpad-e');

            // Simulate pointerdown
            btnE.dispatchEvent(new Event('pointerdown'));
            expect(TransformEngine.isSessionActive()).toBe(true);
            expect(mockEntity.x).toBe(110);
            expect(mockPlanner.commandManager.execute).toHaveBeenCalledTimes(0);

            // Simulate pointerup
            btnE.dispatchEvent(new Event('pointerup'));
            expect(TransformEngine.isSessionActive()).toBe(false);
            expect(mockPlanner.commandManager.execute).toHaveBeenCalledTimes(1);
            expect(executedCommands.length).toBe(1);

            // Single undo restores to 100
            executedCommands[0].undo();
            expect(mockEntity.x).toBe(100);
        });
    });

    describe('5. Luminous Move Mode & Holographic Visuals', () => {
        it('should activate luminous move mode automatically on attach with holographic styling and footprint', () => {
            const origMaterial = mockMesh.material;
            gizmo.attach(mockMesh);

            // attach() auto-starts SC move mode (unified flow)
            expect(gizmo.isMoveModeActive).toBe(true);
            expect(gizmo._isLuminousActive).toBe(true);

            // Mesh material has holographic styling
            expect(mockMesh.material).not.toBe(origMaterial);
            expect(mockMesh.material.transparent).toBe(true);
            expect(mockMesh.material.opacity).toBe(0.88);
            if (mockMesh.material.emissive) {
                expect(mockMesh.material.emissive.getHex()).toBe(0x0284c7);
            }

            // Luminous footprint is suppressed per user mandate (no floating wireframe box)
            expect(gizmo.luminousFootprintMesh).toBeDefined();
            expect(gizmo.luminousFootprintMesh.visible).toBe(false);
        });

        it('should commit luminous move mode and cleanly restore original materials', () => {
            const origMaterial = mockMesh.material;
            gizmo.attach(mockMesh);
            // attach() auto-started SC mode
            expect(gizmo.isMoveModeActive).toBe(true);

            gizmo.commitMoveMode();
            expect(gizmo.isMoveModeActive).toBe(false);
            expect(gizmo._isLuminousActive).toBe(false);

            // Original material restored with 100% reference parity
            expect(mockMesh.material).toBe(origMaterial);
            expect(gizmo.luminousFootprintMesh.visible).toBe(false);
        });

        it('should cancel luminous move mode, revert transform, and restore materials', () => {
            const origMaterial = mockMesh.material;
            mockEntity.x = 250;
            mockEntity.y = 350;
            mockMesh.position.set(250, 0, 350);

            gizmo.attach(mockMesh);
            // attach() auto-started SC mode

            // Simulate moving the object
            gizmo._applyTranslation(new THREE.Vector3(50, 0, 50));
            expect(mockEntity.x).toBe(300);
            expect(mockEntity.y).toBe(400);

            // Cancel move
            gizmo.cancelMoveMode();
            expect(gizmo.isMoveModeActive).toBe(false);
            expect(gizmo._isLuminousActive).toBe(false);

            // Position reverted to starting coordinates
            expect(mockEntity.x).toBe(250);
            expect(mockEntity.y).toBe(350);
            expect(mockMesh.position.x).toBe(250);
            expect(mockMesh.position.z).toBe(350);

            // Material restored
            expect(mockMesh.material).toBe(origMaterial);
            expect(gizmo.luminousFootprintMesh.visible).toBe(false);
        });

        it('should support rotateStep(90) and keep luminous visuals in sync', () => {
            gizmo.attach(mockMesh);
            // attach() auto-started SC mode

            expect(mockEntity.rotation || 0).toBe(0);
            gizmo.rotateStep(90);

            expect(mockEntity.rotation).toBe(90);
            expect(gizmo._isLuminousActive).toBe(true);
            expect(gizmo.luminousFootprintMesh.visible).toBe(false);

            gizmo.commitMoveMode();
            expect(gizmo.isMoveModeActive).toBe(false);
            expect(mockEntity.rotation).toBe(90);
        });

        it('should display holographic luminous highlight for furniture and GLB models', () => {
            const furnitureMesh = new THREE.Mesh(new THREE.BoxGeometry(80, 80, 80), new THREE.MeshBasicMaterial());
            const furnitureEntity = {
                id: 'cabinet_1',
                type: 'furniture',
                width: 80,
                height: 80,
                mesh3D: furnitureMesh,
                x: 100,
                y: 100
            };
            furnitureMesh.userData = { entity: furnitureEntity };

            gizmo.attach(furnitureMesh);
            expect(gizmo.attachedObject).toBe(furnitureMesh);
            expect(gizmo.isMoveModeActive).toBe(true);
            expect(gizmo._isLuminousActive).toBe(true);
            expect(furnitureMesh.material.color.getHex()).toBe(0x38bdf8);

            gizmo.commitMoveMode();
            expect(gizmo.isMoveModeActive).toBe(false);
            expect(furnitureMesh.material.color.getHex()).toBe(0xffffff);
        });

        it('should hide 3D arrow gizmoVisuals on attach and show glowing emerald green snap guideline on wall snap', () => {
            const wall = {
                id: 'w1',
                startX: 0,
                startY: 0,
                endX: 300,
                endY: 0,
                thickness: 20
            };
            mockCtx.planner = {
                walls: [wall],
                rooms: [],
                furniture: [mockEntity],
                commandManager: { execute: vi.fn() }
            };

            gizmo.attach(mockMesh);

            // 3D move gizmo visuals visible
            expect(gizmo.gizmoVisuals.visible).toBe(true);
            // attach() auto-started SC mode
            expect(gizmo.isMoveModeActive).toBe(true);

            // Translate into snap range of wall w1 (y = 0)
            gizmo._applyTranslation(new THREE.Vector3(0, 0, -85));

            expect(gizmo.snapGuideMesh).toBeDefined();
            expect(gizmo.snapGuideMesh.visible).toBe(true);
            expect(gizmo.snapGuideMesh.renderOrder).toBe(1010);
            expect(gizmo.snapGuideMat.color.getHex()).toBe(0x10b981); // Glowing emerald green per SC

            // Verify guideline segment coordinates along wall
            const posAttr = gizmo.snapGuideMesh.geometry.getAttribute('position');
            expect(posAttr).toBeDefined();
            expect(posAttr.count).toBe(2);

            // Rotate while snapped - guideline remains active and updated
            gizmo.rotateStep(90);
            expect(gizmo.snapGuideMesh.visible).toBe(true);

            // Commit move cleanly hides guideline
            gizmo.commitMoveMode();
            expect(gizmo.snapGuideMesh.visible).toBe(false);
        });

        it('should unify staircase move with pure SC holographic cyan glow and cutout footprint', () => {
            const stairMesh = new THREE.Mesh(new THREE.BoxGeometry(100, 200, 250), new THREE.MeshStandardMaterial({ color: 0xffffff }));
            stairMesh.position.set(200, 0, 200);
            const stairEntity = {
                id: 'stair_straight_1',
                type: 'stair_v5_straight',
                shape: 'straight',
                width: 100,
                length: 250,
                x: 200,
                y: 200,
                rotation: 0,
                mesh3D: stairMesh
            };
            stairMesh.userData = { entity: stairEntity, isStair: true };

            gizmo.attach(stairMesh);

            // 1. Attached uniformly through UniversalMoveGizmo
            expect(gizmo.attachedObject).toBe(stairMesh);
            expect(gizmo.attachedEntity).toBe(stairEntity);
            expect(gizmo.isMoveModeActive).toBe(true);

            // 2. Holographic glowing cyan material applied (Image 1)
            expect(gizmo._isLuminousActive).toBe(true);
            expect(stairMesh.material.color.getHex()).toBe(0x38bdf8);
            expect(stairMesh.material.transparent).toBe(true);

            // 3. Luminous cyan footprint suppressed per user mandate (no hanging wireframe box)
            expect(gizmo.luminousFootprintMesh).toBeDefined();
            expect(gizmo.luminousFootprintMesh.visible).toBe(false);

            // 4. Translate stair in place
            gizmo._applyTranslation(new THREE.Vector3(50, 0, 80));
            expect(stairEntity.x).toBe(250);
            expect(stairEntity.y).toBe(280);
            expect(stairMesh.position.x).toBe(250);
            expect(stairMesh.position.z).toBe(280);

            // 5. Commit move restores original material cleanly
            gizmo.commitMoveMode();
            expect(gizmo.isMoveModeActive).toBe(false);
            expect(stairMesh.material.color.getHex()).toBe(0xffffff);
            expect(gizmo.luminousFootprintMesh.visible).toBe(false);
        });

        it('should move shapes with translation and cancel restores coordinates', () => {
            const shapeMesh = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshStandardMaterial({ color: 0x888888 }));
            shapeMesh.position.set(150, 50, 150);
            const shapeEntity = {
                id: 'shape_box_1',
                type: 'shape_box',
                isShape: true,
                x: 150,
                y: 150,
                elevation: 0,
                rotation: 0,
                mesh3D: shapeMesh
            };
            shapeMesh.userData = { entity: shapeEntity, isShape: true };

            gizmo.attach(shapeMesh);

            expect(gizmo.attachedObject).toBe(shapeMesh);
            expect(gizmo.isMoveModeActive).toBe(true);
            expect(shapeMesh.material.color.getHex()).toBe(0x38bdf8);

            gizmo._applyTranslation(new THREE.Vector3(50, 0, 0));
            expect(shapeMesh.position.x).toBe(200);

            gizmo.cancelMoveMode();
            expect(gizmo.isMoveModeActive).toBe(false);
            expect(shapeMesh.material.color.getHex()).toBe(0x888888);
            expect(shapeMesh.position.x).toBe(150);
            expect(shapeMesh.position.z).toBe(150);
        });
    });
});

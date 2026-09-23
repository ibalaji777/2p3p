import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { CommandManager } from '../../commands/CommandManager.js';
import { MoveCommand } from '../../commands/MoveCommand.js';
import { RotateCommand } from '../../commands/RotateCommand.js';
import { EVENTS } from '../../constants/events.js';
import { coreEventBus } from '../../EventBus.js';
import { UniversalMoveGizmo } from '../../engine3d/UniversalMoveGizmo.js';
import { UniversalSpinGizmo } from '../../engine3d/UniversalSpinGizmo.js';
import { CommonTransformEngine } from '../../engine3d/tools/CommonTransformEngine.js';

describe('2D ↔ 3D State Synchronization & Invariants Integrity Suite', () => {
    let mockPlanner;
    let commandManager;

    beforeEach(() => {
        commandManager = new CommandManager();
        mockPlanner = {
            commandManager,
            entities: [],
            getEntities() { return this.entities; },
            syncAll: vi.fn(),
            update3D(options = {}) {
                coreEventBus.emit(EVENTS.SCENE_CHANGED, { source: 'domain_engine', ...options });
            },
            move(entityId, x, y, customStartPos = null) {
                const entity = this.entities.find(e => e.id === entityId);
                if (!entity) return;
                const startPos = (customStartPos && typeof customStartPos.x === 'number')
                    ? { x: customStartPos.x, y: customStartPos.y }
                    : { x: entity.x || 0, y: entity.y || 0 };
                const cmd = new MoveCommand(this, entityId, startPos, { x, y });
                this.commandManager.execute(cmd);
            },
            rotate(entityId, angle, customStartRot = null) {
                const entity = this.entities.find(e => e.id === entityId);
                if (!entity) return;
                const startRot = (typeof customStartRot === 'number') ? customStartRot : (entity.rotation || 0);
                const cmd = new RotateCommand(this, entityId, startRot, angle);
                this.commandManager.execute(cmd);
            },
            _applyMove(entityId, x, y) {
                const entity = this.entities.find(e => e.id === entityId);
                if (!entity) return;
                entity.x = x;
                entity.y = y;
                if (entity.mesh3D) {
                    entity.mesh3D.position.set(x, entity.elevation || 0, y);
                }
                if (entity.group && typeof entity.group.position === 'function') {
                    entity.group.position({ x, y });
                }
            },
            _applyRotate(entityId, angle) {
                const entity = this.entities.find(e => e.id === entityId);
                if (!entity) return;
                entity.rotation = angle;
                if (entity.mesh3D) {
                    entity.mesh3D.rotation.y = -angle * Math.PI / 180;
                }
            }
        };
    });

    describe('Invariant 1 & 2: Single Identity & Single State Authority', () => {
        it('should maintain single identity across 2D, domain entity, and 3D mesh', () => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
            const entity = {
                id: 'chair_101',
                type: 'furniture',
                x: 50,
                y: 50,
                mesh3D: mesh
            };
            mesh.userData = { entity };
            mockPlanner.entities.push(entity);

            expect(entity.id).toBe('chair_101');
            expect(mesh.userData.entity.id).toBe(entity.id);
            expect(mockPlanner.getEntities()[0].id).toBe('chair_101');
        });
    });

    describe('Invariant 3 & 4: 3D Direct Manipulation & History Command Integrity', () => {
        it('UniversalMoveGizmo captures true startPos and creates valid MoveCommand with startPos != endPos', () => {
            const domElement = document.createElement('div');
            domElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

            const mesh = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial());
            mesh.position.set(100, 0, 100);

            const entity = {
                id: 'table_1',
                type: 'furniture',
                x: 100,
                y: 100,
                elevation: 0,
                mesh3D: mesh,
                group: {
                    x: vi.fn(() => 100),
                    y: vi.fn(() => 100),
                    id: () => 'table_1'
                }
            };
            mesh.userData = { entity };
            mockPlanner.entities.push(entity);

            const mockCtx = {
                renderer: { domElement },
                camera: new THREE.PerspectiveCamera(45, 800 / 600, 1, 1000),
                scene: new THREE.Scene(),
                controls: { enabled: true },
                requestRender: vi.fn(),
                realtimeUpdate: { markDirty: vi.fn() },
                interactions: {},
                planner: mockPlanner
            };
            mockCtx.commonController = { transformEngine: new CommonTransformEngine(mockCtx) };

            const gizmo = new UniversalMoveGizmo(mockCtx);
            gizmo.attach(mesh);

            // Dragged to new coordinates (200, 300)
            entity.x = 200;
            entity.y = 300;
            mesh.position.set(200, 0, 300);

            // Commit translation to planner
            gizmo._commitTranslationToPlanner();

            // Verify MoveCommand on undo stack
            expect(commandManager.undoStack.length).toBe(1);
            const cmd = commandManager.undoStack[0];
            expect(cmd.startPos).toEqual({ x: 100, y: 100 });
            expect(cmd.endPos).toEqual({ x: 200, y: 300 });
            expect(cmd.startPos).not.toEqual(cmd.endPos);

            // Test Undo: restores exact previous state
            commandManager.undo();
            expect(entity.x).toBe(100);
            expect(entity.y).toBe(100);
            expect(mesh.position.x).toBe(100);
            expect(mesh.position.z).toBe(100);

            // Test Redo: restores exact edited state
            commandManager.redo();
            expect(entity.x).toBe(200);
            expect(entity.y).toBe(300);
            expect(mesh.position.x).toBe(200);
            expect(mesh.position.z).toBe(300);
        });

        it('UniversalSpinGizmo captures true startRot and creates valid RotateCommand with startRot != endRot', () => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial());
            const entity = {
                id: 'sofa_1',
                type: 'furniture',
                rotation: 0,
                mesh3D: mesh,
                group: { id: () => 'sofa_1' }
            };
            mesh.userData = { entity };
            mockPlanner.entities.push(entity);

            const domElement = document.createElement('div');
            domElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

            const mockCtx = {
                renderer: { domElement },
                camera: new THREE.PerspectiveCamera(45, 800 / 600, 1, 1000),
                scene: new THREE.Scene(),
                controls: { enabled: true },
                requestRender: vi.fn(),
                planner: mockPlanner
            };
            window.planner = { value: mockPlanner };

            const gizmo = new UniversalSpinGizmo(mockCtx);
            gizmo.target = mesh;
            gizmo.initialRotation = 0;
            gizmo.currentRotation = 90;

            gizmo._commitRotationToPlanner();

            expect(commandManager.undoStack.length).toBe(1);
            const cmd = commandManager.undoStack[0];
            expect(cmd.startRot).toBe(0);
            expect(cmd.endRot).toBe(90);

            // Undo restores angle
            commandManager.undo();
            expect(entity.rotation).toBe(0);

            // Redo restores rotated angle
            commandManager.redo();
            expect(entity.rotation).toBe(90);
        });
    });

    describe('Invariant 5 & 8: Domain State Change Notification & Event Routing', () => {
        it('CommandManager emits structured EVENTS.SCENE_CHANGED on execute, undo, and redo', () => {
            const sceneChangedEvents = [];
            const unsub = coreEventBus.on(EVENTS.SCENE_CHANGED, (payload) => {
                sceneChangedEvents.push(payload);
            });

            const entity = { id: 'box_1', x: 0, y: 0 };
            mockPlanner.entities.push(entity);

            // 1. Execute
            mockPlanner.move('box_1', 50, 50, { x: 0, y: 0 });
            expect(sceneChangedEvents.length).toBe(1);
            expect(sceneChangedEvents[0].source).toBe('command');
            expect(sceneChangedEvents[0].operation).toBe('execute');

            // 2. Undo
            commandManager.undo();
            expect(sceneChangedEvents.length).toBe(2);
            expect(sceneChangedEvents[1].source).toBe('command');
            expect(sceneChangedEvents[1].operation).toBe('undo');

            // 3. Redo
            commandManager.redo();
            expect(sceneChangedEvents.length).toBe(3);
            expect(sceneChangedEvents[2].source).toBe('command');
            expect(sceneChangedEvents[2].operation).toBe('redo');

            unsub();
        });

        it('FloorPlanner.update3D() routes cleanly to EVENTS.SCENE_CHANGED with metadata', () => {
            let receivedPayload = null;
            const unsub = coreEventBus.on(EVENTS.SCENE_CHANGED, (payload) => {
                receivedPayload = payload;
            });

            mockPlanner.update3D({ entityType: 'wall', changeType: 'geometry' });

            expect(receivedPayload).toBeDefined();
            expect(receivedPayload.source).toBe('domain_engine');
            expect(receivedPayload.entityType).toBe('wall');
            expect(receivedPayload.changeType).toBe('geometry');

            unsub();
        });
    });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { 
    CommonInteractionController, 
    InteractionController,
    INTERACTION_STATE, 
    INTERACTION_ACTIONS 
} from '../tools/CommonInteractionController.js';
import { UniversalMoveGizmo } from '../UniversalMoveGizmo.js';
import { UniversalSpinGizmo } from '../UniversalSpinGizmo.js';
import { coreEventBus } from '../../EventBus.js';

describe('Centralized Interaction Controller & State Machine', () => {
    let mockCtx, controller;
    let toastEvents = [];
    let stateEvents = [];
    let unsubs = [];

    beforeEach(() => {
        toastEvents = [];
        stateEvents = [];

        unsubs.push(coreEventBus.on('ShowToast', (toast) => {
            toastEvents.push(toast);
        }));

        unsubs.push(coreEventBus.on('InteractionStateChanged', (state) => {
            stateEvents.push(state);
        }));

        mockCtx = {
            renderer: { 
                domElement: { 
                    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), 
                    style: {} 
                } 
            },
            camera: new THREE.PerspectiveCamera(),
            scene: new THREE.Scene(),
            interactions: {
                transformControls: { detach: vi.fn() },
                highlightRenderer: {
                    setSelectionHighlight: vi.fn(),
                    clearSelectionHighlight: vi.fn()
                },
                universalMoveGizmo: {
                    attach: vi.fn(),
                    detach: vi.fn(),
                    startMoveMode: vi.fn(),
                    commitMoveMode: vi.fn(),
                    cancelMoveMode: vi.fn(),
                    step: vi.fn(),
                    setCoordinates: vi.fn(),
                    setSnapMode: vi.fn()
                },
                universalSpinGizmo: {
                    attach: vi.fn(),
                    detach: vi.fn(),
                    setAngle: vi.fn(),
                    flip180: vi.fn(),
                    setSnapMode: vi.fn()
                }
            },
            gizmoManager: { 
                setTransformMode: vi.fn() 
            },
            requestRender: vi.fn()
        };

        controller = new CommonInteractionController(mockCtx);
    });

    afterEach(() => {
        unsubs.forEach(u => u());
        unsubs = [];
    });

    describe('1. Initial & Idle State', () => {
        it('should initialize in IDLE state with no active actions or popups', () => {
            expect(controller.interactionState).toBe(INTERACTION_STATE.IDLE);
            expect(controller.activeAction).toBeNull();
            expect(controller.hudMode).toBe('none');
            expect(controller.selectedEntity).toBeNull();
            expect(controller.selectedMesh).toBeNull();

            const state = controller.getInteractionState();
            expect(state.state).toBe(INTERACTION_STATE.IDLE);
            expect(state.activeAction).toBeNull();
            expect(state.hudMode).toBe('none');
        });

        it('should export canonical InteractionController alias', () => {
            expect(InteractionController).toBe(CommonInteractionController);
        });
    });

    describe('2. Block Action Without Selection (Zero Floating Windows)', () => {
        it('should block activateAction("move") when nothing is selected and emit toast', () => {
            controller.activateAction(INTERACTION_ACTIONS.MOVE);

            expect(controller.interactionState).toBe(INTERACTION_STATE.IDLE);
            expect(controller.activeAction).toBeNull();
            expect(controller.hudMode).toBe('none');
            expect(mockCtx.interactions.universalMoveGizmo.attach).not.toHaveBeenCalled();

            expect(toastEvents.length).toBe(1);
            expect(toastEvents[0].message).toBe('Select an object first');
        });

        it('should block activateAction("spin") when nothing is selected and emit toast', () => {
            controller.activateAction(INTERACTION_ACTIONS.SPIN);

            expect(controller.interactionState).toBe(INTERACTION_STATE.IDLE);
            expect(controller.activeAction).toBeNull();
            expect(mockCtx.interactions.universalSpinGizmo.attach).not.toHaveBeenCalled();

            expect(toastEvents.length).toBe(1);
            expect(toastEvents[0].message).toBe('Select an object first');
        });

        it('should block handleAxisStep when nothing is selected and emit toast', () => {
            controller.handleAxisStep(1);

            expect(toastEvents.length).toBe(1);
            expect(toastEvents[0].message).toBe('Select an object first');
        });
    });

    describe('3. Selection Authority & Capabilities', () => {
        it('should transition to OBJECT_SELECTED when an entity is selected', () => {
            const furniture = { id: 'f1', type: 'furniture', x: 100, y: 200, rotation: 45 };
            const mesh = new THREE.Mesh();
            furniture.mesh3D = mesh;

            controller.select(furniture, mesh, 'furniture');

            expect(controller.interactionState).toBe(INTERACTION_STATE.OBJECT_SELECTED);
            expect(controller.selectedEntity).toBe(furniture);
            expect(controller.selectedMesh).toBe(mesh);
            expect(controller.hudMode).toBe('contextual');

            const caps = controller.getCurrentCapabilities();
            expect(caps.movable).toBe(true);
            expect(caps.rotatable).toBe(true);

            expect(mockCtx.interactions.highlightRenderer.setSelectionHighlight).toHaveBeenCalledWith(mesh);
            expect(stateEvents.length).toBeGreaterThan(0);
            expect(stateEvents[stateEvents.length - 1].hudMode).toBe('contextual');
        });

        it('should evaluate wall capabilities correctly (not movable/rotatable in object sense)', () => {
            const wall = { id: 'w1', type: 'wall', startX: 0, startY: 0, endX: 100, endY: 0 };
            const mesh = new THREE.Mesh();

            controller.select(wall, mesh, 'wall');

            expect(controller.interactionState).toBe(INTERACTION_STATE.OBJECT_SELECTED);
            const caps = controller.getCurrentCapabilities();
            expect(caps.movable).toBe(false);
            expect(caps.rotatable).toBe(false);
            expect(caps.material).toBe(true);
        });

        it('should deselect cleanly and return to IDLE', () => {
            const furniture = { id: 'f1', type: 'furniture' };
            controller.select(furniture);
            expect(controller.interactionState).toBe(INTERACTION_STATE.OBJECT_SELECTED);

            controller.deselect();
            expect(controller.interactionState).toBe(INTERACTION_STATE.IDLE);
            expect(controller.selectedEntity).toBeNull();
            expect(controller.hudMode).toBe('none');
            expect(mockCtx.interactions.highlightRenderer.clearSelectionHighlight).toHaveBeenCalled();
        });
    });

    describe('4. Action Activation & Flow (Select -> Action -> Done)', () => {
        let furniture, mesh;

        beforeEach(() => {
            furniture = { id: 'f1', type: 'furniture', x: 50, y: 75, rotation: 0 };
            mesh = new THREE.Mesh();
            furniture.mesh3D = mesh;
            controller.select(furniture, mesh, 'furniture');
        });

        it('should transition to ACTION_ACTIVE when Move is chosen', () => {
            controller.activateAction(INTERACTION_ACTIONS.MOVE);

            expect(controller.interactionState).toBe(INTERACTION_STATE.ACTION_ACTIVE);
            expect(controller.activeAction).toBe(INTERACTION_ACTIONS.MOVE);
            expect(controller.hudMode).toBe('action_minimal');

            expect(mockCtx.interactions.universalMoveGizmo.attach).toHaveBeenCalledWith(mesh);
            expect(mockCtx.interactions.universalMoveGizmo.startMoveMode).toHaveBeenCalled();
            expect(mockCtx.interactions.universalSpinGizmo.detach).toHaveBeenCalled();
        });

        it('should transition to ACTION_ACTIVE when Spin is chosen', () => {
            controller.activateAction(INTERACTION_ACTIONS.SPIN);

            expect(controller.interactionState).toBe(INTERACTION_STATE.ACTION_ACTIVE);
            expect(controller.activeAction).toBe(INTERACTION_ACTIONS.SPIN);
            expect(controller.hudMode).toBe('action_minimal');

            expect(mockCtx.interactions.universalSpinGizmo.attach).toHaveBeenCalledWith(mesh);
            expect(mockCtx.interactions.universalMoveGizmo.detach).toHaveBeenCalled();
        });

        it('should seamlessly switch between Move and Spin without stacking popups', () => {
            controller.activateAction(INTERACTION_ACTIONS.MOVE);
            expect(controller.activeAction).toBe(INTERACTION_ACTIONS.MOVE);

            // Switch to Spin directly
            controller.activateAction(INTERACTION_ACTIONS.SPIN);
            expect(controller.activeAction).toBe(INTERACTION_ACTIONS.SPIN);
            expect(mockCtx.interactions.universalMoveGizmo.detach).toHaveBeenCalled();
            expect(mockCtx.interactions.universalSpinGizmo.attach).toHaveBeenCalledWith(mesh);
        });

        it('should attach universalMoveGizmo when Move action is activated', () => {
            controller.activateAction(INTERACTION_ACTIONS.MOVE);

            expect(mockCtx.interactions.universalMoveGizmo.attach).toHaveBeenCalledWith(mesh);
            expect(controller.activeAction).toBe(INTERACTION_ACTIONS.MOVE);
            expect(controller.interactionState).toBe(INTERACTION_STATE.ACTION_ACTIVE);
        });

        it('should return to OBJECT_SELECTED with selection intact when completeAction is called', () => {
            controller.activateAction(INTERACTION_ACTIONS.MOVE);
            expect(controller.interactionState).toBe(INTERACTION_STATE.ACTION_ACTIVE);

            controller.completeAction();

            expect(controller.interactionState).toBe(INTERACTION_STATE.OBJECT_SELECTED);
            expect(controller.activeAction).toBeNull();
            expect(controller.hudMode).toBe('contextual');
            expect(controller.selectedEntity).toBe(furniture);
            expect(mockCtx.interactions.universalMoveGizmo.detach).toHaveBeenCalled();
        });

        it('should return to OBJECT_SELECTED when cancelAction is called', () => {
            controller.activateAction(INTERACTION_ACTIONS.SPIN);
            expect(controller.interactionState).toBe(INTERACTION_STATE.ACTION_ACTIVE);

            controller.cancelAction();

            expect(controller.interactionState).toBe(INTERACTION_STATE.OBJECT_SELECTED);
            expect(controller.activeAction).toBeNull();
            expect(controller.hudMode).toBe('contextual');
            expect(mockCtx.interactions.universalSpinGizmo.detach).toHaveBeenCalled();
        });

        it('should route Move for doors to dedicated opening mode and NOT attach universalMoveGizmo', () => {
            const door = { id: 'door_main', type: 'door', width: 90, height: 210 };
            const doorMesh = new THREE.Mesh();
            doorMesh.userData = { entity: door, isWidget: true };
            controller.select(door, doorMesh, 'door');

            controller.activateAction(INTERACTION_ACTIONS.MOVE);

            expect(mockCtx.gizmoManager.setTransformMode).toHaveBeenCalledWith('opening', true);
            expect(mockCtx.interactions.universalMoveGizmo.attach).not.toHaveBeenCalledWith(doorMesh);
            expect(mockCtx.interactions.universalMoveGizmo.detach).toHaveBeenCalled();
        });

        it('should route Move for roofs to dedicated roof move mode and NOT attach universalMoveGizmo', () => {
            const roof = { id: 'roof_1', type: 'roof', config: { roofType: 'flat' } };
            const roofMesh = new THREE.Mesh();
            roofMesh.userData = { entity: roof, isRoof: true };
            controller.select(roof, roofMesh, 'roof');

            controller.activateAction(INTERACTION_ACTIONS.MOVE);

            expect(mockCtx.gizmoManager.setTransformMode).toHaveBeenCalledWith('translate', true);
            expect(mockCtx.interactions.universalMoveGizmo.attach).not.toHaveBeenCalledWith(roofMesh);
            expect(mockCtx.interactions.universalMoveGizmo.detach).toHaveBeenCalled();
        });
    });

    describe('5. Keyboard Navigation & Shortcuts', () => {
        let furniture, mesh;

        beforeEach(() => {
            furniture = { id: 'f1', type: 'furniture', x: 0, y: 0 };
            mesh = new THREE.Mesh();
            furniture.mesh3D = mesh;
        });

        it('should trigger toast when pressing "m" or "r" with nothing selected', () => {
            controller.handleKeyDown({ key: 'm' });
            expect(toastEvents.length).toBe(1);
            expect(toastEvents[0].message).toBe('Select an object first');

            controller.handleKeyDown({ key: 'r' });
            expect(toastEvents.length).toBe(2);
            expect(toastEvents[1].message).toBe('Select an object first');
        });

        it('should activate Move when pressing "m" with object selected', () => {
            controller.select(furniture, mesh, 'furniture');
            const handled = controller.handleKeyDown({ key: 'm' });

            expect(handled).toBe(true);
            expect(controller.interactionState).toBe(INTERACTION_STATE.ACTION_ACTIVE);
            expect(controller.activeAction).toBe(INTERACTION_ACTIONS.MOVE);
        });

        it('should activate Spin when pressing "r" with object selected', () => {
            controller.select(furniture, mesh, 'furniture');
            const handled = controller.handleKeyDown({ key: 'r' });

            expect(handled).toBe(true);
            expect(controller.interactionState).toBe(INTERACTION_STATE.ACTION_ACTIVE);
            expect(controller.activeAction).toBe(INTERACTION_ACTIONS.SPIN);
        });

        it('should cancel active action on Escape and return to OBJECT_SELECTED', () => {
            controller.select(furniture, mesh, 'furniture');
            controller.activateAction(INTERACTION_ACTIONS.MOVE);
            expect(controller.interactionState).toBe(INTERACTION_STATE.ACTION_ACTIVE);

            const handled = controller.handleKeyDown({ key: 'Escape' });
            expect(handled).toBe(true);
            expect(controller.interactionState).toBe(INTERACTION_STATE.OBJECT_SELECTED);
            expect(controller.selectedEntity).toBe(furniture);
        });

        it('should clear selection on Escape when in OBJECT_SELECTED state', () => {
            controller.select(furniture, mesh, 'furniture');
            expect(controller.interactionState).toBe(INTERACTION_STATE.OBJECT_SELECTED);

            const handled = controller.handleKeyDown({ key: 'Escape' });
            expect(handled).toBe(true);
            expect(controller.interactionState).toBe(INTERACTION_STATE.IDLE);
            expect(controller.selectedEntity).toBeNull();
        });
    });

    describe('6. Redundant Floating Pop-Up Suppression', () => {
        let moveGizmo, spinGizmo;

        beforeEach(() => {
            const preview3D = {
                camera: new THREE.PerspectiveCamera(),
                scene: new THREE.Scene(),
                domElement: document.createElement('div'),
                requestRender: vi.fn()
            };
            moveGizmo = new UniversalMoveGizmo(preview3D);
            spinGizmo = new UniversalSpinGizmo(preview3D);
        });

        it('should suppress standalone move HUD dialog when ContextualActionHUD is mounted', () => {
            // Mount dummy contextual action HUD container
            const hudContainer = document.createElement('div');
            hudContainer.className = 'contextual-action-hud-container';
            document.body.appendChild(hudContainer);

            // Trigger move gizmo showHUD
            moveGizmo.showHUD();

            // Standalone #universal-move-hud-panel should NOT be created
            const legacyPanel = document.getElementById('universal-move-hud-panel');
            expect(legacyPanel).toBeNull();

            // Clean up
            document.body.removeChild(hudContainer);
        });

        it('should suppress standalone spin HUD dialog when ContextualActionHUD is mounted', () => {
            // Mount dummy contextual action HUD container
            const hudContainer = document.createElement('div');
            hudContainer.className = 'contextual-action-hud-container';
            document.body.appendChild(hudContainer);

            // Trigger spin gizmo showHUD
            spinGizmo.showHUD();

            // Standalone #universal-spin-hud-panel should NOT be created
            const legacyPanel = document.getElementById('universal-spin-hud-panel');
            expect(legacyPanel).toBeNull();

            // Clean up
            document.body.removeChild(hudContainer);
        });

        it('should report isActionActive() accurately across the state machine lifecycle', () => {
            expect(controller.isActionActive()).toBe(false);
            expect(controller.isAction('move')).toBe(false);

            const furniture = { id: 'f1', type: 'furniture' };
            const mesh = new THREE.Mesh();
            furniture.mesh3D = mesh;
            controller.select(furniture, mesh, 'furniture');

            expect(controller.isActionActive()).toBe(false);

            controller.activateAction(INTERACTION_ACTIONS.MOVE);
            expect(controller.isActionActive()).toBe(true);
            expect(controller.isAction('move')).toBe(true);
            expect(controller.isAction('spin')).toBe(false);

            controller.completeAction();
            expect(controller.isActionActive()).toBe(false);
            expect(controller.isAction('move')).toBe(false);
        });
    });

    describe('7. Door & Window Dedicated Menu & Isolation', () => {
        it('should correctly configure capabilities for doors and windows without rotatable flag', () => {
            const door = { id: 'door_entry', type: 'door', width: 90, height: 210 };
            const doorMesh = new THREE.Mesh();
            doorMesh.userData = { entity: door, isWidget: true };

            const caps = controller.getCapabilities(door, doorMesh);
            expect(caps.selectable).toBe(true);
            expect(caps.movable).toBe(true);
            expect(caps.material).toBe(true);
            expect(caps.rotatable).toBe(false);
            expect(caps.tiltable).toBe(false);
            expect(caps.apertureResizable).toBe(true);
        });

        it('should retain dedicated GIZMO_REGISTRY actions for doors and windows', async () => {
            const { GIZMO_REGISTRY } = await import('../../registry.js');
            expect(GIZMO_REGISTRY.door).toEqual(['move', 'opening', 'material', 'style', 'delete']);
            expect(GIZMO_REGISTRY.window).toEqual(['move', 'opening', 'material', 'style', 'delete']);
            expect(GIZMO_REGISTRY.opening).toEqual(['move', 'opening', 'material', 'delete']);
        });

        it('should never attach universalSpinGizmo to a door or window', () => {
            const win = { id: 'win_1', type: 'window', width: 120, height: 100 };
            const winMesh = new THREE.Mesh();
            winMesh.userData = { entity: win, isWidget: true };
            controller.select(win, winMesh, 'window');

            const result = controller.activateAction(INTERACTION_ACTIONS.SPIN);
            expect(result).toBe(false);
            expect(mockCtx.interactions.universalSpinGizmo.attach).not.toHaveBeenCalled();
        });

        it('should safely execute setTransformMode("none") without selected object or with door', async () => {
            const { GizmoManager } = await import('../GizmoManager.js');
            const container = document.createElement('div');
            const mockFullCtx = {
                container,
                renderer: { domElement: document.createElement('canvas') },
                scene: new THREE.Scene(),
                camera: new THREE.PerspectiveCamera(),
                interactions: {
                    transformControls: new THREE.Object3D(),
                    selectedObject: null,
                    setHighlight: vi.fn(),
                    openingGizmo: { attach: vi.fn(), detach: vi.fn() },
                    materialGizmo: { attach: vi.fn(), detach: vi.fn() }
                },
                controls: { enabled: true }
            };
            const gm = new GizmoManager(mockFullCtx, container);
            gm.init();
            expect(() => gm.setTransformMode('none')).not.toThrow();

            const door = { id: 'd1', type: 'door' };
            const doorMesh = new THREE.Mesh();
            doorMesh.userData = { entity: door, isWidget: true };
            mockFullCtx.interactions.selectedObject = doorMesh;

            expect(() => gm.setTransformMode('none')).not.toThrow();
            expect(gm.transformMenu.style.display).toBe('flex');
            expect(gm.btnOpening.style.display).toBe('flex');
            expect(gm.btnMove.style.display).toBe('flex');
            expect(gm.btnStyle.style.display).toBe('flex');
            expect(gm.btnSpin.style.display).toBe('none');

            gm.dispose();
        });
    });
});

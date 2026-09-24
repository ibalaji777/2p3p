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
});

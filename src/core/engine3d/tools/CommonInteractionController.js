/**
 * CommonInteractionController.js
 * Master Centralized Controller for 3D Scene Interactions (Single Source of Truth).
 * 
 * Unifies:
 * - Common Tool Selection & State
 * - Universal Object Selection vs Material Face Painting
 * - Common Transformations (Move, Spin, Tilt, Axis Up/Down)
 * - Input Device Routing (Desktop Mouse, Mobile Touch, Keyboard Shortcuts, Gizmos)
 */

import { COMMON_TOOLS, getToolDefinition } from './CommonToolRegistry.js';
import { ObjectCapabilityEvaluator } from './ObjectCapabilityEvaluator.js';
import { UniversalMaterialPaintSystem } from './UniversalMaterialPaintSystem.js';
import { CommonTransformEngine } from './CommonTransformEngine.js';
import { globalShortcutRegistry, SHORTCUT_ACTIONS } from './CommonShortcutRegistry.js';
import { coreEventBus } from '../../EventBus.js';
import { usePlannerStore } from '../../../stores/usePlannerStore.js';

export const INTERACTION_STATE = {
    IDLE: 'IDLE',
    OBJECT_SELECTED: 'OBJECT_SELECTED',
    ACTION_SELECTED: 'ACTION_SELECTED',
    ACTION_ACTIVE: 'ACTION_ACTIVE',
    ACTION_COMPLETE: 'ACTION_COMPLETE'
};

export const INTERACTION_ACTIONS = {
    SELECT: 'select',
    MOVE: 'move',
    SPIN: 'spin',
    TILT: 'tilt',
    PROPERTIES: 'properties',
    MATERIAL: 'material',
    DELETE: 'delete',
    BUILDING_RISE: 'building_rise',
    WALL_CORNERS: 'wall_corners'
};

export class CommonInteractionController {
    constructor(ctx) {
        this.ctx = ctx;
        
        // Canonical State Machine State
        this.interactionState = INTERACTION_STATE.IDLE;
        this.activeAction = null;
        this.hudMode = 'none'; // 'none' | 'contextual' | 'action_minimal' | 'properties'

        // Authoritative Selection State
        this.activeTool = COMMON_TOOLS.SELECT;
        this.selectedEntity = null;
        this.selectedMesh = null;
        this.selectedType = null;
        this.inputDevice = 'pointer';

        // Subsystems
        this.paintSystem = new UniversalMaterialPaintSystem(ctx, this);
        this.transformEngine = new CommonTransformEngine(ctx);
        this.shortcutRegistry = globalShortcutRegistry;
    }

    /**
     * Returns canonical snapshot of current interaction state.
     * @returns {Object}
     */
    getInteractionState() {
        return {
            state: this.interactionState,
            selectedEntity: this.selectedEntity,
            selectedMesh: this.selectedMesh,
            selectedType: this.selectedType,
            activeAction: this.activeAction,
            hudMode: this.hudMode,
            activeTool: this.activeTool,
            capabilities: this.getCurrentCapabilities()
        };
    }

    /**
     * Sets the active tool.
     * @param {string} toolId - One of COMMON_TOOLS.
     * @param {Object} options
     */
    setTool(toolId, options = {}) {
        if (!toolId) toolId = COMMON_TOOLS.SELECT;

        // Instant Action Tools (Axis Up / Axis Down)
        if (toolId === COMMON_TOOLS.AXIS_UP) {
            this.handleAxisStep(1);
            return;
        }
        if (toolId === COMMON_TOOLS.AXIS_DOWN) {
            this.handleAxisStep(-1);
            return;
        }

        const previousTool = this.activeTool;
        this.activeTool = toolId;

        console.info(`%c[CommonTools] %cTool Activated: %c${toolId.toUpperCase()}`,
            'color: #3b82f6; font-weight: bold;', 'color: #9ca3af;', 'color: #10b981; font-weight: bold;');

        // 1. Material Tool Activation
        if (toolId === COMMON_TOOLS.MATERIAL) {
            this.paintSystem.setActive(true);
            if (this.ctx.interactions) {
                if (this.ctx.interactions.transformControls) this.ctx.interactions.transformControls.detach();
                if (this.ctx.interactions.openingGizmo) this.ctx.interactions.openingGizmo.detach();
                if (this.ctx.interactions.wallInteractiveSuite) this.ctx.interactions.wallInteractiveSuite.detach();
            }
            if (this.ctx.gizmoManager) {
                this.ctx.gizmoManager.setTransformMode('material', true);
            }
        } else {
            this.paintSystem.setActive(false);
        }

        // 2. Transform Tools (Move, Spin, Tilt)
        if (toolId === COMMON_TOOLS.MOVE || toolId === COMMON_TOOLS.SPIN || toolId === COMMON_TOOLS.TILT) {
            if (this.selectedEntity) {
                this.interactionState = INTERACTION_STATE.ACTION_ACTIVE;
                this.activeAction = toolId;
                this.hudMode = 'action_minimal';
            }
            const targetMesh = this.selectedMesh || this.selectedEntity?.mesh3D || this.ctx.interactions?.selectedObject;
            const targetEntity = this.selectedEntity || targetMesh?.userData?.entity;
            const entType = targetEntity?.type || targetMesh?.userData?.type || '';
            const isOpening = Boolean(targetMesh?.userData?.isWidget || targetMesh?.userData?.isOpening || ['door', 'window', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(entType));
            const isRoof = Boolean(targetMesh?.userData?.isRoof || entType === 'roof' || targetEntity?.config?.roofType);

            if (targetMesh && this.ctx.gizmoManager) {
                const modeMap = {
                    [COMMON_TOOLS.MOVE]: isOpening ? 'opening' : 'translate',
                    [COMMON_TOOLS.SPIN]: 'rotateY',
                    [COMMON_TOOLS.TILT]: 'rotateX'
                };
                this.ctx.gizmoManager.setTransformMode(modeMap[toolId], true);
            }
            if (toolId === COMMON_TOOLS.MOVE) {
                if (!isOpening && !isRoof && targetMesh && this.ctx.interactions?.universalMoveGizmo) {
                    this.ctx.interactions.universalMoveGizmo.attach(targetMesh);
                } else if (this.ctx.interactions?.universalMoveGizmo) {
                    this.ctx.interactions.universalMoveGizmo.detach();
                }
            } else {
                if (this.ctx.interactions?.universalMoveGizmo) {
                    this.ctx.interactions.universalMoveGizmo.detach();
                }
            }
            if (toolId === COMMON_TOOLS.SPIN) {
                if (!isRoof && !isOpening && targetMesh && this.ctx.interactions?.universalSpinGizmo) {
                    this.ctx.interactions.universalSpinGizmo.attach(targetMesh);
                } else if (this.ctx.interactions?.universalSpinGizmo) {
                    this.ctx.interactions.universalSpinGizmo.detach();
                }
            } else {
                if (this.ctx.interactions?.universalSpinGizmo) {
                    this.ctx.interactions.universalSpinGizmo.detach();
                }
            }
        } else {
            if (this.ctx.interactions?.universalMoveGizmo) {
                this.ctx.interactions.universalMoveGizmo.detach();
            }
            if (this.ctx.interactions?.universalSpinGizmo) {
                this.ctx.interactions.universalSpinGizmo.detach();
            }
        }

        // 3. Select Mode
        if (toolId === COMMON_TOOLS.SELECT) {
            if (this.ctx.gizmoManager) {
                this.ctx.gizmoManager.setTransformMode('none', true);
            }
            if (this.interactionState === INTERACTION_STATE.ACTION_ACTIVE) {
                this.activeAction = null;
                this.hudMode = this.selectedEntity ? 'contextual' : 'none';
                this.interactionState = this.selectedEntity ? INTERACTION_STATE.OBJECT_SELECTED : INTERACTION_STATE.IDLE;
            }
        }

        // 4. Building Rise Mode
        if (toolId === COMMON_TOOLS.BUILDING_RISE) {
            if (this.ctx.gizmoManager) {
                this.ctx.gizmoManager.setTransformMode('none', true);
            }
            if (this.ctx.interactions?.roomInteractiveSuite) {
                this.ctx.interactions.roomInteractiveSuite.activateBuildingRiseMode();
            }
        } else {
            if (this.ctx.interactions?.roomInteractiveSuite && (!this.selectedEntity || !this.selectedEntity.path)) {
                this.ctx.interactions.roomInteractiveSuite.deactivateBuildingRiseMode();
            }
        }

        // 5. Wall Corners Mode (Show all wall corners)
        if (toolId === COMMON_TOOLS.WALL_CORNERS) {
            if (this.ctx.gizmoManager) {
                this.ctx.gizmoManager.setTransformMode('none', true);
            }
            if (this.ctx.interactions?.allWallCornersGizmo) {
                this.ctx.interactions.allWallCornersGizmo.show(true);
            }
        } else {
            if (this.ctx.interactions?.allWallCornersGizmo) {
                this.ctx.interactions.allWallCornersGizmo.show(false);
            }
        }

        // Emit global event for reactive UI updates
        coreEventBus.emit('CommonToolChanged', {
            activeTool: this.activeTool,
            previousTool
        });
        coreEventBus.emit('InteractionStateChanged', this.getInteractionState());

        if (this.ctx.requestRender) this.ctx.requestRender('tool_changed');
    }

    /**
     * Gets capabilities of the currently selected entity.
     * @returns {Object}
     */
    getCurrentCapabilities() {
        return ObjectCapabilityEvaluator.getCapabilities(this.selectedEntity, this.selectedMesh);
    }

    /**
     * Gets capabilities for a specific entity or mesh.
     * @param {Object} entity
     * @param {THREE.Object3D} mesh
     * @returns {Object}
     */
    getCapabilities(entity, mesh = null) {
        return ObjectCapabilityEvaluator.getCapabilities(entity, mesh);
    }

    /**
     * Master Selection Authority.
     * Updates selection state, evaluates capabilities, and transitions to OBJECT_SELECTED.
     * @param {Object|null} entity
     * @param {THREE.Object3D|null} mesh
     * @param {string|null} type
     */
    select(entity, mesh = null, type = null) {
        if (!entity) {
            this.clearSelection();
            return;
        }

        // If an action was active, complete or reset it before changing selection
        if (this.interactionState === INTERACTION_STATE.ACTION_ACTIVE) {
            this.completeAction();
        }

        this.selectedEntity = entity;
        this.selectedMesh = mesh || entity?.mesh3D || null;
        this.selectedType = type || entity?.type || null;
        this.interactionState = INTERACTION_STATE.OBJECT_SELECTED;
        this.activeAction = null;
        this.hudMode = 'contextual';

        // Synchronize 3D highlight
        if (this.selectedMesh && this.ctx.interactions?.highlightRenderer) {
            this.ctx.interactions.highlightRenderer.setSelectionHighlight(this.selectedMesh);
        }

        coreEventBus.emit('InteractionStateChanged', this.getInteractionState());
        coreEventBus.emit('CommonSelectionChanged', {
            entity: this.selectedEntity,
            mesh: this.selectedMesh,
            capabilities: this.getCurrentCapabilities()
        });

        if (this.ctx.requestRender) this.ctx.requestRender('selection_changed');
    }

    /**
     * Backward-compatible alias for select().
     * @param {Object} entity
     * @param {THREE.Object3D|null} mesh
     * @param {string|null} type
     */
    setSelection(entity, mesh = null, type = null) {
        this.select(entity, mesh, type);
    }

    /**
     * Clears the current selection and transitions back to IDLE.
     */
    clearSelection() {
        if (this.interactionState === INTERACTION_STATE.ACTION_ACTIVE) {
            this.completeAction();
        }

        this.selectedEntity = null;
        this.selectedMesh = null;
        this.selectedType = null;
        this.activeAction = null;
        this.interactionState = INTERACTION_STATE.IDLE;
        this.hudMode = 'none';

        if (this.ctx.interactions?.universalMoveGizmo) {
            this.ctx.interactions.universalMoveGizmo.detach();
        }
        if (this.ctx.interactions?.universalSpinGizmo) {
            this.ctx.interactions.universalSpinGizmo.detach();
        }
        if (this.ctx.gizmoManager) {
            this.ctx.gizmoManager.setTransformMode('none', true);
        }
        if (this.ctx.interactions?.highlightRenderer) {
            if (typeof this.ctx.interactions.highlightRenderer.clearSelectionHighlight === 'function') {
                this.ctx.interactions.highlightRenderer.clearSelectionHighlight();
            } else if (typeof this.ctx.interactions.highlightRenderer.clearHighlight === 'function') {
                this.ctx.interactions.highlightRenderer.clearHighlight();
            }
        }

        if (this.activeTool !== COMMON_TOOLS.SELECT && this.activeTool !== COMMON_TOOLS.MATERIAL && this.activeTool !== COMMON_TOOLS.BUILDING_RISE && this.activeTool !== COMMON_TOOLS.WALL_CORNERS) {
            this.setTool(COMMON_TOOLS.SELECT);
        }

        coreEventBus.emit('InteractionStateChanged', this.getInteractionState());
        coreEventBus.emit('CommonSelectionChanged', {
            entity: null,
            mesh: null,
            capabilities: this.getCurrentCapabilities()
        });

        if (this.ctx.requestRender) this.ctx.requestRender('selection_cleared');
    }

    /**
     * Alias for clearSelection().
     */
    deselect() {
        this.clearSelection();
    }

    /**
     * Checks if a transform action (move, spin, tilt) is actively running.
     * @returns {boolean}
     */
    isActionActive() {
        return this.interactionState === INTERACTION_STATE.ACTION_ACTIVE || !!this.activeAction;
    }

    /**
     * Checks if a specific action is currently active.
     * @param {string} actionId
     * @returns {boolean}
     */
    isAction(actionId) {
        return this.activeAction === actionId;
    }

    /**
     * Centralized action activator with capability guards & toast notifications.
     * @param {string} actionId - 'move' | 'spin' | 'tilt' | 'properties' | 'material' | 'delete'
     * @param {Object} options
     * @returns {boolean} True if activated.
     */
    activateAction(actionId, options = {}) {
        // Require selection for object actions
        const requiresSelection = [
            INTERACTION_ACTIONS.MOVE,
            INTERACTION_ACTIONS.SPIN,
            INTERACTION_ACTIONS.TILT,
            INTERACTION_ACTIONS.PROPERTIES,
            INTERACTION_ACTIONS.DELETE,
            COMMON_TOOLS.AXIS_UP,
            COMMON_TOOLS.AXIS_DOWN
        ];

        if (!this.selectedEntity && requiresSelection.includes(actionId)) {
            coreEventBus.emit('ShowToast', {
                message: 'Select an object first',
                type: 'info'
            });
            return false;
        }

        const caps = this.getCurrentCapabilities();

        switch (actionId) {
            case INTERACTION_ACTIONS.MOVE:
                if (!caps.movable) return false;
                this.interactionState = INTERACTION_STATE.ACTION_ACTIVE;
                this.activeAction = INTERACTION_ACTIONS.MOVE;
                this.hudMode = 'action_minimal';
                this.setTool(COMMON_TOOLS.MOVE, options);
                {
                    const targetEntity = this.selectedEntity;
                    const targetMesh = this.selectedMesh || this.selectedEntity?.mesh3D || this.ctx.interactions?.selectedObject;
                    const entType = targetEntity?.type || targetMesh?.userData?.type || '';
                    const isOpening = Boolean(targetMesh?.userData?.isWidget || targetMesh?.userData?.isOpening || ['door', 'window', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(entType));
                    const isRoof = Boolean(targetMesh?.userData?.isRoof || entType === 'roof' || targetEntity?.config?.roofType);

                    let handledByRelocation = false;
                    if (!isOpening && !isRoof && this.ctx.interactions && typeof this.ctx.interactions.startRelocation === 'function') {
                        handledByRelocation = this.ctx.interactions.startRelocation(targetEntity, targetMesh);
                    }

                    if (!isOpening && !isRoof && !handledByRelocation && targetMesh && this.ctx.interactions?.universalMoveGizmo) {
                        if (typeof this.ctx.interactions.universalMoveGizmo.attach === 'function') {
                            this.ctx.interactions.universalMoveGizmo.attach(targetMesh);
                        }
                        if (typeof this.ctx.interactions.universalMoveGizmo.startMoveMode === 'function') {
                            this.ctx.interactions.universalMoveGizmo.startMoveMode();
                        }
                    }
                }
                coreEventBus.emit('InteractionStateChanged', this.getInteractionState());
                return true;

            case INTERACTION_ACTIONS.SPIN:
                if (!caps.rotatable) return false;
                this.interactionState = INTERACTION_STATE.ACTION_ACTIVE;
                this.activeAction = INTERACTION_ACTIONS.SPIN;
                this.hudMode = 'action_minimal';
                this.setTool(COMMON_TOOLS.SPIN, options);
                coreEventBus.emit('InteractionStateChanged', this.getInteractionState());
                return true;

            case INTERACTION_ACTIONS.TILT:
                if (!caps.tiltable) return false;
                this.interactionState = INTERACTION_STATE.ACTION_ACTIVE;
                this.activeAction = INTERACTION_ACTIONS.TILT;
                this.hudMode = 'action_minimal';
                this.setTool(COMMON_TOOLS.TILT, options);
                coreEventBus.emit('InteractionStateChanged', this.getInteractionState());
                return true;

            case INTERACTION_ACTIONS.PROPERTIES:
                this.hudMode = (this.hudMode === 'properties' ? 'contextual' : 'properties');
                coreEventBus.emit('InteractionStateChanged', this.getInteractionState());
                return true;

            case INTERACTION_ACTIONS.MATERIAL:
                this.setTool(COMMON_TOOLS.MATERIAL, options);
                return true;

            case INTERACTION_ACTIONS.DELETE:
                if (this.ctx.onDeleteRequested) {
                    this.ctx.onDeleteRequested(this.selectedEntity);
                }
                this.clearSelection();
                return true;

            default:
                return false;
        }
    }

    /**
     * Completes the current active action and returns to OBJECT_SELECTED state.
     * The selected object remains selected.
     */
    completeAction() {
        if (this.interactionState !== INTERACTION_STATE.ACTION_ACTIVE) return;

        this.interactionState = INTERACTION_STATE.ACTION_COMPLETE;

        // Commit active relocation if running in stair/furniture placement systems
        if (this.ctx.interactions?.stairPlacementSystem?.isRelocating) {
            this.ctx.interactions.stairPlacementSystem.placeStaircase();
        }
        if (this.ctx.interactions?.furniturePlacementSystem?.isRelocating) {
            this.ctx.interactions.furniturePlacementSystem.placeFurniture();
        }

        // Commit active move mode if running
        if (typeof this.ctx.interactions?.universalMoveGizmo?.commitMoveMode === 'function' && this.ctx.interactions.universalMoveGizmo.isMoveModeActive) {
            this.ctx.interactions.universalMoveGizmo.commitMoveMode();
        }

        // Detach transform gizmos
        if (this.ctx.interactions?.universalMoveGizmo) {
            if (typeof this.ctx.interactions.universalMoveGizmo.detach === 'function') {
                this.ctx.interactions.universalMoveGizmo.detach();
            }
        }
        if (this.ctx.interactions?.universalSpinGizmo) {
            if (typeof this.ctx.interactions.universalSpinGizmo.detach === 'function') {
                this.ctx.interactions.universalSpinGizmo.detach();
            }
        }
        if (this.ctx.gizmoManager) {
            this.ctx.gizmoManager.setTransformMode('none', true);
        }

        // Return to clean OBJECT_SELECTED state
        this.activeAction = null;
        this.hudMode = 'contextual';
        this.activeTool = COMMON_TOOLS.SELECT;
        this.interactionState = this.selectedEntity ? INTERACTION_STATE.OBJECT_SELECTED : INTERACTION_STATE.IDLE;

        coreEventBus.emit('InteractionStateChanged', this.getInteractionState());
        if (this.ctx.requestRender) this.ctx.requestRender('action_complete');
    }

    /**
     * Cancels the current active action, reverts changes if applicable, and returns to OBJECT_SELECTED.
     */
    cancelAction() {
        if (this.interactionState === INTERACTION_STATE.ACTION_ACTIVE) {
            if (this.ctx.interactions?.stairPlacementSystem?.isRelocating) {
                this.ctx.interactions.stairPlacementSystem.cancelRelocation();
            }
            if (this.ctx.interactions?.furniturePlacementSystem?.isRelocating) {
                this.ctx.interactions.furniturePlacementSystem.cancelRelocation();
            }
            if (typeof this.ctx.interactions?.universalMoveGizmo?.cancelMoveMode === 'function' && this.ctx.interactions.universalMoveGizmo.isMoveModeActive) {
                this.ctx.interactions.universalMoveGizmo.cancelMoveMode();
            }
            this.completeAction();
        } else if (this.interactionState === INTERACTION_STATE.OBJECT_SELECTED) {
            this.clearSelection();
        }
    }

    /**
     * Handles vertical elevation step (+ / -).
     * @param {number} direction - +1 for up, -1 for down.
     */
    handleAxisStep(direction = 1) {
        if (!this.selectedEntity) {
            coreEventBus.emit('ShowToast', {
                message: 'Select an object first',
                type: 'info'
            });
            return;
        }
        this.transformEngine.executeAxisStep(this.selectedEntity, direction, 10);
    }

    /**
     * Sets active paint material.
     * @param {string|Object} mat
     */
    setActiveMaterial(mat) {
        this.paintSystem.setActiveMaterial(mat);
    }

    /**
     * Centralized action dispatcher.
     * @param {string} actionName
     * @param {any} payload
     */
    dispatchAction(actionName, payload = null) {
        switch (actionName) {
            case SHORTCUT_ACTIONS.SELECT:
                if (this.interactionState === INTERACTION_STATE.ACTION_ACTIVE) {
                    this.completeAction();
                } else if (this.interactionState === INTERACTION_STATE.OBJECT_SELECTED) {
                    this.clearSelection();
                } else {
                    this.setTool(COMMON_TOOLS.SELECT);
                }
                break;
            case SHORTCUT_ACTIONS.MATERIAL:
                this.setTool(COMMON_TOOLS.MATERIAL);
                break;
            case SHORTCUT_ACTIONS.BUILDING_RISE:
                this.setTool(COMMON_TOOLS.BUILDING_RISE);
                break;
            case SHORTCUT_ACTIONS.WALL_CORNERS:
                this.setTool(this.activeTool === COMMON_TOOLS.WALL_CORNERS ? COMMON_TOOLS.SELECT : COMMON_TOOLS.WALL_CORNERS);
                break;
            case SHORTCUT_ACTIONS.MOVE:
                this.activateAction(INTERACTION_ACTIONS.MOVE);
                break;
            case SHORTCUT_ACTIONS.SPIN:
                this.activateAction(INTERACTION_ACTIONS.SPIN);
                break;
            case SHORTCUT_ACTIONS.TILT:
                this.activateAction(INTERACTION_ACTIONS.TILT);
                break;
            case SHORTCUT_ACTIONS.AXIS_UP:
                this.handleAxisStep(1);
                break;
            case SHORTCUT_ACTIONS.AXIS_DOWN:
                this.handleAxisStep(-1);
                break;
            case SHORTCUT_ACTIONS.DELETE:
                if (this.selectedEntity) {
                    this.activateAction(INTERACTION_ACTIONS.DELETE);
                }
                break;
            case SHORTCUT_ACTIONS.ROTATE_CAMERA_LEFT:
                if (this.ctx.cameraController?.rotateSims4Isometric) {
                    this.ctx.cameraController.rotateSims4Isometric(-1);
                }
                break;
            case SHORTCUT_ACTIONS.ROTATE_CAMERA_RIGHT:
                if (this.ctx.cameraController?.rotateSims4Isometric) {
                    this.ctx.cameraController.rotateSims4Isometric(1);
                }
                break;
            case SHORTCUT_ACTIONS.HELP:
                coreEventBus.emit('ToggleCommonHelpModal');
                break;
            default:
                break;
        }
    }

    /**
     * Handles keyboard events through the centralized action registry.
     * @param {KeyboardEvent} e
     * @returns {boolean} True if shortcut was handled.
     */
    handleKeyDown(e) {
        const action = this.shortcutRegistry.resolveEvent(e);
        if (action) {
            this.dispatchAction(action);
            return true;
        }
        return false;
    }

    dispose() {
        if (this.paintSystem) this.paintSystem.setActive(false);
    }
}

export const InteractionController = CommonInteractionController;

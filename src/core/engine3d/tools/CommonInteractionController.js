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

export class CommonInteractionController {
    constructor(ctx) {
        this.ctx = ctx;
        
        // Authoritative Interaction State
        this.activeTool = COMMON_TOOLS.SELECT;
        this.selectedEntity = null;
        this.selectedMesh = null;
        this.inputDevice = 'pointer';

        // Subsystems
        this.paintSystem = new UniversalMaterialPaintSystem(ctx, this);
        this.transformEngine = new CommonTransformEngine(ctx);
        this.shortcutRegistry = globalShortcutRegistry;
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
            const targetMesh = this.selectedMesh || this.selectedEntity?.mesh3D || this.ctx.interactions?.selectedObject;
            if (targetMesh && this.ctx.gizmoManager) {
                const modeMap = {
                    [COMMON_TOOLS.MOVE]: 'translate',
                    [COMMON_TOOLS.SPIN]: 'rotateY',
                    [COMMON_TOOLS.TILT]: 'rotateX'
                };
                this.ctx.gizmoManager.setTransformMode(modeMap[toolId], true);
            }
            if (toolId === COMMON_TOOLS.MOVE) {
                if (targetMesh && this.ctx.interactions?.universalMoveGizmo) {
                    this.ctx.interactions.universalMoveGizmo.attach(targetMesh);
                }
            } else {
                if (this.ctx.interactions?.universalMoveGizmo) {
                    this.ctx.interactions.universalMoveGizmo.detach();
                }
            }
            if (toolId === COMMON_TOOLS.SPIN) {
                if (targetMesh && this.ctx.interactions?.universalSpinGizmo) {
                    this.ctx.interactions.universalSpinGizmo.attach(targetMesh);
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
        }

        // Emit global event for reactive UI updates
        coreEventBus.emit('CommonToolChanged', {
            activeTool: this.activeTool,
            previousTool
        });

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
     * Updates selection state and evaluates capabilities.
     * @param {Object} entity
     * @param {THREE.Object3D|null} mesh
     */
    setSelection(entity, mesh = null) {
        this.selectedEntity = entity;
        this.selectedMesh = mesh;

        // If currently in a transform tool, update or attach gizmo to new selection
        if (this.activeTool === COMMON_TOOLS.MOVE || this.activeTool === COMMON_TOOLS.SPIN || this.activeTool === COMMON_TOOLS.TILT) {
            const targetMesh = mesh || entity?.mesh3D || this.ctx.interactions?.selectedObject;
            if (targetMesh && this.ctx.gizmoManager) {
                const modeMap = {
                    [COMMON_TOOLS.MOVE]: 'translate',
                    [COMMON_TOOLS.SPIN]: 'rotateY',
                    [COMMON_TOOLS.TILT]: 'rotateX'
                };
                this.ctx.gizmoManager.setTransformMode(modeMap[this.activeTool], true);
            }
            if (this.activeTool === COMMON_TOOLS.MOVE && targetMesh && this.ctx.interactions?.universalMoveGizmo) {
                this.ctx.interactions.universalMoveGizmo.attach(targetMesh);
            }
            if (this.activeTool === COMMON_TOOLS.SPIN && targetMesh && this.ctx.interactions?.universalSpinGizmo) {
                this.ctx.interactions.universalSpinGizmo.attach(targetMesh);
            }
        }

        coreEventBus.emit('CommonSelectionChanged', {
            entity,
            mesh,
            capabilities: this.getCurrentCapabilities()
        });
    }

    /**
     * Clears the current selection.
     */
    clearSelection() {
        this.selectedEntity = null;
        this.selectedMesh = null;
        if (this.activeTool !== COMMON_TOOLS.SELECT && this.activeTool !== COMMON_TOOLS.MATERIAL) {
            this.setTool(COMMON_TOOLS.SELECT);
        }
    }

    /**
     * Handles vertical elevation step (+ / -).
     * @param {number} direction - +1 for up, -1 for down.
     */
    handleAxisStep(direction = 1) {
        if (!this.selectedEntity) return;
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
                this.setTool(COMMON_TOOLS.SELECT);
                break;
            case SHORTCUT_ACTIONS.MATERIAL:
                this.setTool(COMMON_TOOLS.MATERIAL);
                break;
            case SHORTCUT_ACTIONS.MOVE:
                this.setTool(COMMON_TOOLS.MOVE);
                break;
            case SHORTCUT_ACTIONS.SPIN:
                if (this.selectedEntity) {
                    // Quick spin step by 90 degrees if object is selected
                    this.transformEngine.executeSpin(this.selectedEntity, 90);
                } else {
                    this.setTool(COMMON_TOOLS.SPIN);
                }
                break;
            case SHORTCUT_ACTIONS.TILT:
                this.setTool(COMMON_TOOLS.TILT);
                break;
            case SHORTCUT_ACTIONS.AXIS_UP:
                this.handleAxisStep(1);
                break;
            case SHORTCUT_ACTIONS.AXIS_DOWN:
                this.handleAxisStep(-1);
                break;
            case SHORTCUT_ACTIONS.DELETE:
                if (this.ctx.onDeleteRequested) {
                    this.ctx.onDeleteRequested(this.selectedEntity);
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

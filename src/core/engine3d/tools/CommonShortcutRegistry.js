/**
 * CommonShortcutRegistry.js
 * Centralized Shortcut & Action Registry for 3D Scene Interactions.
 */

import { COMMON_TOOLS } from './CommonToolRegistry.js';

export const SHORTCUT_ACTIONS = {
    SELECT: COMMON_TOOLS.SELECT,
    MATERIAL: COMMON_TOOLS.MATERIAL,
    MOVE: COMMON_TOOLS.MOVE,
    SPIN: COMMON_TOOLS.SPIN,
    TILT: COMMON_TOOLS.TILT,
    AXIS_UP: COMMON_TOOLS.AXIS_UP,
    AXIS_DOWN: COMMON_TOOLS.AXIS_DOWN,
    DELETE: 'delete',
    UNDO: 'undo',
    REDO: 'redo',
    DESELECT: 'deselect',
    ROTATE_CAMERA_LEFT: 'rotate_camera_left',
    ROTATE_CAMERA_RIGHT: 'rotate_camera_right',
    HELP: 'help'
};

export class CommonShortcutRegistry {
    constructor() {
        this.keymap = new Map();
        this.initDefaultBindings();
    }

    initDefaultBindings() {
        // Core Tools
        this.bindKey('v', SHORTCUT_ACTIONS.SELECT);
        this.bindKey('b', SHORTCUT_ACTIONS.MATERIAL);
        this.bindKey('m', SHORTCUT_ACTIONS.MOVE);
        this.bindKey('g', SHORTCUT_ACTIONS.MOVE);
        this.bindKey('r', SHORTCUT_ACTIONS.SPIN);
        this.bindKey('t', SHORTCUT_ACTIONS.TILT);
        this.bindKey(']', SHORTCUT_ACTIONS.AXIS_UP);
        this.bindKey('[', SHORTCUT_ACTIONS.AXIS_DOWN);
        this.bindKey('PageUp', SHORTCUT_ACTIONS.AXIS_UP);
        this.bindKey('PageDown', SHORTCUT_ACTIONS.AXIS_DOWN);
        this.bindKey('Escape', SHORTCUT_ACTIONS.SELECT);
        this.bindKey('Delete', SHORTCUT_ACTIONS.DELETE);
        this.bindKey('Backspace', SHORTCUT_ACTIONS.DELETE);
        this.bindKey(',', SHORTCUT_ACTIONS.ROTATE_CAMERA_LEFT);
        this.bindKey('<', SHORTCUT_ACTIONS.ROTATE_CAMERA_LEFT);
        this.bindKey('.', SHORTCUT_ACTIONS.ROTATE_CAMERA_RIGHT);
        this.bindKey('>', SHORTCUT_ACTIONS.ROTATE_CAMERA_RIGHT);
        this.bindKey('?', SHORTCUT_ACTIONS.HELP);
        this.bindKey('h', SHORTCUT_ACTIONS.HELP);
        this.bindKey('/', SHORTCUT_ACTIONS.HELP);
    }

    bindKey(key, action) {
        this.keymap.set(key.toLowerCase(), action);
    }

    /**
     * Resolves a KeyboardEvent into a standard action string.
     * @param {KeyboardEvent} e
     * @returns {string|null}
     */
    resolveEvent(e) {
        // Ignore input keystrokes when typing in input/textarea/select
        const tag = e.target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
            return null;
        }

        // Undo / Redo modifiers
        if (e.ctrlKey || e.metaKey) {
            const keyLower = e.key.toLowerCase();
            if (keyLower === 'z') {
                return e.shiftKey ? SHORTCUT_ACTIONS.REDO : SHORTCUT_ACTIONS.UNDO;
            }
            if (keyLower === 'y') {
                return SHORTCUT_ACTIONS.REDO;
            }
            return null;
        }

        const key = e.key.toLowerCase();
        return this.keymap.get(key) || this.keymap.get(e.key) || null;
    }
}

export const globalShortcutRegistry = new CommonShortcutRegistry();

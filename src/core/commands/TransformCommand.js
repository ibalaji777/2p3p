/**
 * TransformCommand.js
 * 
 * ATOMIC TRANSFORMATION COMMAND
 * Encapsulates combined position, elevation, rotation, wall-t progression,
 * and polygon points into a SINGLE undoable command transaction.
 * 
 * Eliminates the "Double Undo" bug where 3D center-pivot rotations created
 * separate Move and Rotate commands.
 */

import { Command } from './Command.js';
import { TransformEngine } from '../transform/TransformEngine.js';

export class TransformCommand extends Command {
    /**
     * @param {Object} planner - FloorPlanner instance.
     * @param {string|number} entityId - Unique ID of target entity.
     * @param {string} [entityType=''] - Type of the entity.
     * @param {Object} beforeState - State before transformation: { x, y, elevation, rotation, t, points }.
     * @param {Object} afterState - State after transformation: { x, y, elevation, rotation, t, points }.
     */
    constructor(planner, entityId, entityType = '', beforeState = {}, afterState = {}) {
        super();
        this.planner = planner;
        this.entityId = entityId;
        this.entityType = entityType;
        this.beforeState = { ...beforeState };
        if (Array.isArray(beforeState.points)) {
            this.beforeState.points = JSON.parse(JSON.stringify(beforeState.points));
        }
        this.afterState = { ...afterState };
        if (Array.isArray(afterState.points)) {
            this.afterState.points = JSON.parse(JSON.stringify(afterState.points));
        }
    }

    execute() {
        TransformEngine.applyState(this.planner, this.entityId, this.afterState);
    }

    undo() {
        TransformEngine.applyState(this.planner, this.entityId, this.beforeState);
    }

    // Backward-compatibility getters for legacy test suites & inspectors
    get startRot() {
        return this.beforeState.rotation;
    }

    get endRot() {
        return this.afterState.rotation;
    }

    get startPos() {
        return { x: this.beforeState.x, y: this.beforeState.y };
    }

    get endPos() {
        return { x: this.afterState.x, y: this.afterState.y };
    }
}

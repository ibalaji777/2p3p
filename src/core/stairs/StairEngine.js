/**
 * StairEngine.js
 * 
 * THE SINGLE AUTHORITATIVE PUBLIC FAÇADE FOR THE STAIRCASE SUBSYSTEM.
 * 
 * Orchestrates:
 * - Canonical Staircase State (planner.stairs[])
 * - Canonical Geometry & Cutout Polygons (StairGeometryEngine)
 * - Canonical Topology & Entity Lifecycle (StairTopologyEngine)
 * - Canonical Mutations & Batch Updates (StairMutationEngine)
 * - 2D & 3D Synchronization
 */

import { StairGeometryEngine } from './StairGeometryEngine.js';
import { StairTopologyEngine } from './StairTopologyEngine.js';
import { StairMutationEngine } from './StairMutationEngine.js';

export class StairEngine {
    // ==========================================
    // 1. GEOMETRY AUTHORITY
    // ==========================================

    /**
     * Calculates authoritative 2D world aperture cutout polygon points.
     * @param {Object} stair 
     * @returns {Array<{x: number, y: number}>}
     */
    static getCutoutPolygon(stair) {
        return StairGeometryEngine.getCutoutPolygon(stair);
    }

    /**
     * Calculates local bounding coordinates.
     * @param {Object} stair 
     * @returns {{minX: number, minY: number, maxX: number, maxY: number, width: number, length: number}}
     */
    static getLocalBounds(stair) {
        return StairGeometryEngine.getLocalBounds(stair);
    }

    /**
     * Calculates optimal IRC/IBC step and riser configuration.
     * @param {number} totalHeight 
     * @param {string} [shape='straight'] 
     * @returns {{totalSteps: number, flight1Steps: number, flight2Steps: number, stepHeight: number}}
     */
    static calculateOptimalSteps(totalHeight, shape = 'straight') {
        return StairGeometryEngine.calculateOptimalSteps(totalHeight, shape);
    }

    /**
     * Returns key metric calculations for a staircase.
     * @param {Object} stair 
     * @returns {Object}
     */
    static getStepMetrics(stair) {
        return StairGeometryEngine.getStepMetrics(stair);
    }

    // ==========================================
    // 2. TOPOLOGY AUTHORITY
    // ==========================================

    /**
     * Creates and registers a new canonical staircase.
     * @param {Object} planner 
     * @param {Object} options 
     * @returns {Object}
     */
    static createStair(planner, options = {}) {
        return StairTopologyEngine.createStair(planner, options);
    }

    /**
     * Deletes a staircase safely.
     * @param {Object} planner 
     * @param {Object|string} stairOrId 
     * @returns {Object|null}
     */
    static deleteStair(planner, stairOrId) {
        return StairTopologyEngine.deleteStair(planner, stairOrId);
    }

    /**
     * Duplicates an existing staircase with position offset.
     * @param {Object} planner 
     * @param {Object|string} stairOrId 
     * @param {{x: number, y: number}} [offset] 
     * @returns {Object}
     */
    static duplicateStair(planner, stairOrId, offset) {
        return StairTopologyEngine.duplicateStair(planner, stairOrId, offset);
    }

    /**
     * Serializes a staircase into a portable JSON object.
     * @param {Object} stair 
     * @returns {Object}
     */
    static serialize(stair) {
        return StairTopologyEngine.serialize(stair);
    }

    /**
     * Deserializes JSON state into a staircase entity.
     * @param {Object} planner 
     * @param {Object} data 
     * @returns {Object}
     */
    static deserialize(planner, data) {
        return StairTopologyEngine.deserialize(planner, data);
    }

    // ==========================================
    // 3. MUTATION AUTHORITY
    // ==========================================

    /**
     * Sets staircase shape ('straight', 'L', 'U', 'T').
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {string} newShape 
     */
    static setShape(planner, stair, newShape) {
        return StairMutationEngine.setShape(planner, stair, newShape);
    }

    /**
     * Updates staircase total height.
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {number} newHeight 
     */
    static setHeight(planner, stair, newHeight) {
        return StairMutationEngine.setHeight(planner, stair, newHeight);
    }

    /**
     * Updates staircase flight width.
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {number} newWidth 
     */
    static setWidth(planner, stair, newWidth) {
        return StairMutationEngine.setWidth(planner, stair, newWidth);
    }

    /**
     * Flips turn direction between left and right.
     * @param {Object} planner 
     * @param {Object} stair 
     */
    static flipTurnDirection(planner, stair) {
        return StairMutationEngine.flipTurnDirection(planner, stair);
    }

    /**
     * Auto-detects and snaps staircase height to nearest floor/platform.
     * @param {Object} planner 
     * @param {Object} stair 
     * @returns {boolean}
     */
    static autoFitHeight(planner, stair) {
        return StairMutationEngine.autoFitHeight(planner, stair);
    }

    /**
     * Sets flight 1 step count and recalculates flight 2 steps.
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {number} flight1Steps 
     */
    static setFlightSteps(planner, stair, flight1Steps) {
        return StairMutationEngine.setFlightSteps(planner, stair, flight1Steps);
    }

    /**
     * Sets staircase position.
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {number} x 
     * @param {number} y 
     */
    static setPosition(planner, stair, x, y) {
        return StairMutationEngine.setPosition(planner, stair, x, y);
    }

    /**
     * Sets staircase rotation angle in degrees.
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {number} rotation 
     */
    static setRotation(planner, stair, rotation) {
        return StairMutationEngine.setRotation(planner, stair, rotation);
    }

    /**
     * Adjusts landing step allocation.
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {number} deltaSteps 
     */
    static adjustLanding(planner, stair, deltaSteps) {
        return StairMutationEngine.adjustLanding(planner, stair, deltaSteps);
    }

    /**
     * Sets stringer structural type.
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {string} stringerType 
     */
    static setStringerType(planner, stair, stringerType) {
        return StairMutationEngine.setStringerType(planner, stair, stringerType);
    }

    /**
     * Applies batch properties to one or multiple staircases.
     * @param {Object} planner 
     * @param {Array<Object>|Object} stairs 
     * @param {Object} props 
     */
    static batchUpdate(planner, stairs, props) {
        return StairMutationEngine.batchUpdate(planner, stairs, props);
    }
}

export {
    StairGeometryEngine,
    StairTopologyEngine,
    StairMutationEngine
};

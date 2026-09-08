/**
 * StairMutationEngine.js
 * 
 * Single source of truth for mutating staircase properties, shape morphing,
 * height auto-fit, step redistribution, railing configuration, and batch updates.
 */

import { StairGeometryEngine } from './StairGeometryEngine.js';
import { StairHeightDetector } from '../../features/stairs/StairHeightDetector.js';

export class StairMutationEngine {
    /**
     * Sets the shape of a staircase ('straight', 'L', 'U', 'T') and redistributes steps.
     * 
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {string} newShape 
     */
    static setShape(planner, stair, newShape) {
        if (!stair || !newShape) return;
        const cleanShape = newShape.replace('stair_v5_', '').replace('stair_v4_', '');
        if (stair.shape === cleanShape) return;

        stair.shape = cleanShape;
        stair.type = `stair_v5_${cleanShape}`;

        if (cleanShape === 'straight') {
            const total = (Number(stair.flight1Steps) || 8) + (Number(stair.flight2Steps) || 7);
            stair.totalSteps = total || 15;
            stair.flight1Steps = stair.totalSteps;
            stair.flight2Steps = 0;
        } else {
            const total = Number(stair.totalSteps) || ((Number(stair.flight1Steps) || 8) + (Number(stair.flight2Steps) || 7)) || 15;
            stair.flight1Steps = Math.max(2, Math.ceil(total / 2));
            stair.flight2Steps = Math.max(2, total - stair.flight1Steps);
            stair.totalSteps = stair.flight1Steps + stair.flight2Steps;
            if (!stair.turnDirection) stair.turnDirection = 'right';
            if (!stair.landingSize) stair.landingSize = Number(stair.width) || 100;
            if (stair.gapWidth === undefined) stair.gapWidth = 20;
        }

        this._refreshStair(planner, stair);
    }

    /**
     * Updates staircase total height and recalculates ergonomic step distribution.
     * 
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {number} newHeight 
     */
    static setHeight(planner, stair, newHeight) {
        if (!stair) return;
        const val = Math.max(20, Math.min(600, Number(newHeight) || 300));
        stair.height = val;

        const optimal = StairGeometryEngine.calculateOptimalSteps(val, stair.shape);
        stair.totalSteps = optimal.totalSteps;
        stair.flight1Steps = optimal.flight1Steps;
        stair.flight2Steps = optimal.flight2Steps;
        stair.stepHeight = optimal.stepHeight;

        this._refreshStair(planner, stair);
    }

    /**
     * Updates staircase width.
     * 
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {number} newWidth 
     */
    static setWidth(planner, stair, newWidth) {
        if (!stair) return;
        const val = Math.max(40, Math.min(300, Number(newWidth) || 100));
        stair.width = val;
        this._refreshStair(planner, stair);
    }

    /**
     * Flips turn direction between left and right for L and U shapes.
     * 
     * @param {Object} planner 
     * @param {Object} stair 
     */
    static flipTurnDirection(planner, stair) {
        if (!stair) return;
        stair.turnDirection = (stair.turnDirection === 'right') ? 'left' : 'right';
        this._refreshStair(planner, stair);
    }

    /**
     * Auto-detects target floor/platform heights and snaps the staircase height.
     * 
     * @param {Object} planner 
     * @param {Object} stair 
     * @returns {boolean} True if height was adjusted
     */
    static autoFitHeight(planner, stair) {
        if (!planner || !stair) return false;

        const p = planner?.value || planner;
        const detection = StairHeightDetector.detect({
            x: stair.group && typeof stair.group.x === 'function' ? stair.group.x() : (stair.x || 0),
            z: stair.group && typeof stair.group.y === 'function' ? stair.group.y() : (stair.y || 0),
            elevation: stair.elevation || 0,
            rotation: stair.group && typeof stair.group.rotation === 'function' ? stair.group.rotation() : (stair.rotation || 0),
            preset: stair,
            planner: p,
            isCenterAnchored: false
        });

        if (detection && detection.hasTarget) {
            stair.height = detection.detectedHeight;
            stair.totalSteps = detection.optimalSteps;
            stair.flight1Steps = detection.flight1Steps;
            stair.flight2Steps = detection.flight2Steps;
            stair.stepHeight = detection.stepHeight;
            this._refreshStair(planner, stair);
            return true;
        }

        return false;
    }

    /**
     * Updates step allocation between flight 1 and flight 2.
     * 
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {number} flight1Steps 
     */
    static setFlightSteps(planner, stair, flight1Steps) {
        if (!stair || stair.shape === 'straight') return;
        const total = (Number(stair.flight1Steps) || 8) + (Number(stair.flight2Steps) || 7);
        const newF1 = Math.max(2, Math.min(total - 2, Number(flight1Steps)));
        stair.flight1Steps = newF1;
        stair.flight2Steps = total - newF1;
        this._refreshStair(planner, stair);
    }

    /**
     * Updates staircase position.
     * 
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {number} x 
     * @param {number} y 
     */
    static setPosition(planner, stair, x, y) {
        if (!stair) return;
        stair.x = Number(x) || 0;
        stair.y = Number(y) || 0;
        if (stair.group && typeof stair.group.position === 'function') {
            stair.group.position({ x: stair.x, y: stair.y });
        }
        this._refreshStair(planner, stair);
    }

    /**
     * Updates staircase rotation angle in degrees.
     * 
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {number} rotation 
     */
    static setRotation(planner, stair, rotation) {
        if (!stair) return;
        stair.rotation = Number(rotation) || 0;
        if (stair.group && typeof stair.group.rotation === 'function') {
            stair.group.rotation(stair.rotation);
        }
        this._refreshStair(planner, stair);
    }

    /**
     * Adjusts landing step split by deltaSteps.
     * 
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {number} deltaSteps 
     */
    static adjustLanding(planner, stair, deltaSteps) {
        if (!stair || stair.shape === 'straight') return;
        const currentF1 = Number(stair.flight1Steps) || 8;
        const total = (Number(stair.flight1Steps) || 8) + (Number(stair.flight2Steps) || 7);
        const targetF1 = currentF1 + deltaSteps;
        if (targetF1 < 2 || targetF1 > total - 2) return;
        return this.setFlightSteps(planner, stair, targetF1);
    }

    /**
     * Sets stringer structural type.
     * 
     * @param {Object} planner 
     * @param {Object} stair 
     * @param {string} stringerType 
     */
    static setStringerType(planner, stair, stringerType) {
        if (!stair || !stringerType) return;
        stair.stringerType = stringerType;
        this._refreshStair(planner, stair);
    }

    /**
     * Applies batch properties to one or multiple staircases atomically.
     * 
     * @param {Object} planner 
     * @param {Array<Object>|Object} stairs - Single stair or array of stairs
     * @param {Object} props - Properties dictionary
     */
    static batchUpdate(planner, stairs, props = {}) {
        if (!stairs) return;
        const stairList = Array.isArray(stairs) ? stairs : [stairs];

        for (const stair of stairList) {
            if (!stair) continue;

            for (const key in props) {
                if (key === 'shape') {
                    this.setShape(planner, stair, props.shape);
                } else if (key === 'height') {
                    this.setHeight(planner, stair, props.height);
                } else if (key === 'width') {
                    this.setWidth(planner, stair, props.width);
                } else if (key === 'flight1Steps') {
                    this.setFlightSteps(planner, stair, props.flight1Steps);
                } else if (key === 'stringerType') {
                    this.setStringerType(planner, stair, props.stringerType);
                } else if (key === 'rotation') {
                    this.setRotation(planner, stair, props.rotation);
                } else if (key === 'x' || key === 'y') {
                    const newX = props.x !== undefined ? props.x : stair.x;
                    const newY = props.y !== undefined ? props.y : stair.y;
                    this.setPosition(planner, stair, newX, newY);
                } else if (key.startsWith('materials.')) {
                    const slot = key.substring(10);
                    if (!stair.materials) stair.materials = {};
                    stair.materials[slot] = typeof props[key] === 'object' ? props[key] : { id: props[key] };
                } else if (key.startsWith('leftRailing.')) {
                    const propName = key.substring(12);
                    if (!stair.leftRailing) stair.leftRailing = {};
                    stair.leftRailing[propName] = props[key];
                    if (stair.linkRailings) {
                        if (!stair.rightRailing) stair.rightRailing = {};
                        stair.rightRailing[propName] = props[key];
                    }
                } else if (key.startsWith('rightRailing.')) {
                    const propName = key.substring(13);
                    if (!stair.rightRailing) stair.rightRailing = {};
                    stair.rightRailing[propName] = props[key];
                    if (stair.linkRailings) {
                        if (!stair.leftRailing) stair.leftRailing = {};
                        stair.leftRailing[propName] = props[key];
                    }
                } else {
                    stair[key] = props[key];
                }
            }

            this._refreshStair(planner, stair);
        }
    }

    /**
     * Refreshes 2D graphics and sends real-time 3D dirty notifications.
     * @private
     */
    static _refreshStair(planner, stair) {
        if (!stair) return;

        if (typeof stair.update === 'function') {
            stair.update();
        }

        const p = planner?.value || planner || stair.planner;
        const realtimeUpdate = p?.renderer3D?.realtimeUpdate ||
                               p?.engine3d?.realtimeUpdate ||
                               p?.appState?.scene3D?.realtimeUpdate ||
                               (typeof window !== 'undefined' && (
                                   window.renderer3D?.realtimeUpdate ||
                                   window.preview3D?.realtimeUpdate ||
                                   window.planner?.renderer3D?.realtimeUpdate ||
                                   window.planner?.engine3d?.realtimeUpdate ||
                                   window.plannerInstance?.renderer3D?.realtimeUpdate ||
                                   window.plannerInstance?.engine3d?.realtimeUpdate ||
                                   window.scene3D?.realtimeUpdate
                               ));

        if (realtimeUpdate && typeof realtimeUpdate.markDirty === 'function') {
            realtimeUpdate.markDirty(stair, 'geometry');
        }

        if (p && typeof p.syncAll === 'function') {
            p.syncAll();
        }
    }
}

import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { WallHeightPolicy } from './WallHeightPolicy.js';
import { WallEngine } from './WallEngine.js';
import { coreEventBus } from '../EventBus.js';
import { EVENTS } from '../constants/events.js';

/**
 * WallHeightTransaction
 * 
 * Manages the interactive Wall Raiser lifecycle across 2D and 3D.
 * Guarantees a single atomic undo/redo history entry per drag gesture,
 * live preview updates during dragging, and clean rollback on cancel.
 */
export class WallHeightTransaction {
    constructor(planner) {
        this.planner = planner;
        this.targetWalls = [];
        this.scope = 'wall';
        this.snapshotCmd = null;
        this.isActive = false;
        this.initialHeights = new Map();
        this.initialElevations = new Map();
    }

    /**
     * Begins an interactive height adjustment transaction.
     * @param {Array<Object>|Object} walls - Target wall or array of walls
     * @param {'wall'|'room'|'building'} scope 
     */
    begin(walls, scope = 'wall') {
        const wallList = Array.isArray(walls) ? walls : [walls];
        this.targetWalls = wallList.filter(Boolean);
        this.scope = scope;
        this.initialHeights.clear();
        this.initialElevations.clear();

        this.targetWalls.forEach(w => {
            this.initialHeights.set(w, {
                height: w.height !== undefined ? w.height : WallHeightPolicy.DEFAULT_HEIGHT,
                startHeight: w.startHeight,
                endHeight: w.endHeight,
                peakHeight: w.peakHeight,
                topProfileType: w.topProfileType
            });
            this.initialElevations.set(w, w.elevation || 0);
        });

        const p = this.planner || window.planner?.value || window.plannerInstance;
        if (p && p.commandManager) {
            this.snapshotCmd = new SnapshotCommand(p);
        } else {
            this.snapshotCmd = null;
        }

        this.isActive = true;
    }

    /**
     * Updates target wall heights during continuous drag.
     * @param {number} newHeight 
     * @param {Object} options 
     * @returns {number} The clamped and snapped height applied
     */
    update(newHeight, options = {}) {
        if (!this.isActive || this.targetWalls.length === 0) return newHeight;

        const snapStep = options.snapStep !== undefined ? options.snapStep : WallHeightPolicy.SNAP_DRAG;
        const validH = WallHeightPolicy.processDragHeight(newHeight, snapStep);
        const p = this.planner || window.planner?.value || window.plannerInstance;

        WallEngine.batchUpdate(p, this.targetWalls, { height: validH }, false);

        // Update corresponding room wallHeight if room scope or wall in room
        if (p && Array.isArray(p.rooms)) {
            p.rooms.forEach(r => {
                if (Array.isArray(r.walls) && r.walls.some(rw => this.targetWalls.includes(rw))) {
                    r.wallHeight = validH;
                }
            });
        }

        return validH;
    }

    /**
     * Commits the transaction on pointer release.
     * Finalizes the SnapshotCommand so that Redo works correctly.
     * @returns {boolean} True if successfully committed
     */
    commit() {
        if (!this.isActive) return false;
        this.isActive = false;

        const p = this.planner || window.planner?.value || window.plannerInstance;
        if (p && typeof p.syncAll === 'function') {
            p.syncAll();
            if (p.update3D) p.update3D();
        }

        if (p && p.commandManager && this.snapshotCmd) {
            const hasChanged = this.snapshotCmd.finalize();
            if (hasChanged) {
                p.commandManager.execute(this.snapshotCmd);
            }
            this.snapshotCmd = null;
        }

        coreEventBus.emit(EVENTS.WALL_CHANGE, { walls: this.targetWalls, scope: this.scope });
        return true;
    }

    /**
     * Cancels the transaction and restores original wall states.
     */
    cancel() {
        if (!this.isActive) return;
        this.isActive = false;

        const p = this.planner || window.planner?.value || window.plannerInstance;

        if (this.snapshotCmd && this.snapshotCmd.stateBefore && p && typeof p.importState === 'function') {
            p.importState(this.snapshotCmd.stateBefore);
        } else {
            // Revert individual recorded values
            this.targetWalls.forEach(w => {
                const init = this.initialHeights.get(w);
                if (init) {
                    w.height = init.height;
                    w.startHeight = init.startHeight;
                    w.endHeight = init.endHeight;
                    w.peakHeight = init.peakHeight;
                    w.topProfileType = init.topProfileType;
                    w.wallShapeData = null;
                }
                const initElev = this.initialElevations.get(w);
                if (initElev !== undefined) {
                    w.elevation = initElev;
                }
            });
        }

        if (p && typeof p.syncAll === 'function') {
            p.syncAll();
            if (p.update3D) p.update3D();
        }

        this.snapshotCmd = null;
        coreEventBus.emit(EVENTS.WALL_CHANGE, { walls: this.targetWalls, reverted: true });
    }
}

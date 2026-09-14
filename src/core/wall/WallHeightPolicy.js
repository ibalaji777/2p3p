import { WALL_HEIGHT } from '../constants/units.js';

/**
 * WallHeightPolicy
 * 
 * Single authoritative policy for all wall height calculations, validations,
 * clamping, and snapping across 2D and 3D throughout the application.
 */
export const WallHeightPolicy = {
    MIN_HEIGHT: 20,
    MAX_HEIGHT: 1000,
    DEFAULT_HEIGHT: WALL_HEIGHT || 180,
    SNAP_DRAG: 5,     // 5 cm CAD standard snapping for interactive drag
    SNAP_FINE: 1,     // 1 cm fine adjustment for numeric entry

    /**
     * Normalizes an arbitrary value to a clean finite number.
     * Handles NaN, Infinity, negative, strings, null, and undefined.
     * @param {*} value 
     * @param {number} fallback 
     * @returns {number}
     */
    normalize(value, fallback = WallHeightPolicy.DEFAULT_HEIGHT) {
        if (value === null || value === undefined) return fallback;
        const num = Number(value);
        if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
        return num;
    },

    /**
     * Clamps a height value within architecturally safe bounds.
     * @param {number} value 
     * @param {number} min 
     * @param {number} max 
     * @returns {number}
     */
    clamp(value, min = WallHeightPolicy.MIN_HEIGHT, max = WallHeightPolicy.MAX_HEIGHT) {
        const num = this.normalize(value, min);
        return Math.max(min, Math.min(max, num));
    },

    /**
     * Snaps a height value to the nearest step.
     * @param {number} value 
     * @param {number} step 
     * @returns {number}
     */
    snap(value, step = WallHeightPolicy.SNAP_DRAG) {
        const num = this.normalize(value);
        if (step <= 0) return num;
        return Math.round(num / step) * step;
    },

    /**
     * Processes an interactive drag input: normalizes, snaps, and clamps within bounds.
     * @param {number} value 
     * @param {number} step 
     * @param {number} min 
     * @param {number} max 
     * @returns {number}
     */
    processDragHeight(value, step = WallHeightPolicy.SNAP_DRAG, min = WallHeightPolicy.MIN_HEIGHT, max = WallHeightPolicy.MAX_HEIGHT) {
        const snapped = this.snap(value, step);
        return this.clamp(snapped, min, max);
    },

    /**
     * Processes an explicit input height: normalizes, clamps, and rounds to integer.
     * @param {number} value 
     * @param {number} min 
     * @param {number} max 
     * @returns {number}
     */
    processInputHeight(value, min = WallHeightPolicy.MIN_HEIGHT, max = WallHeightPolicy.MAX_HEIGHT) {
        const num = this.normalize(value, min);
        return Math.round(this.clamp(num, min, max));
    },

    /**
     * Validates whether a value is a valid physical wall height.
     * @param {*} value 
     * @returns {boolean}
     */
    validate(value) {
        if (value === null || value === undefined) return false;
        const num = Number(value);
        return Number.isFinite(num) && !Number.isNaN(num) && num >= this.MIN_HEIGHT && num <= this.MAX_HEIGHT;
    },

    /**
     * Resolves the authoritative default height for a wall based on its type and active level.
     * @param {Object} wall 
     * @param {Object} activeLevel 
     * @returns {number}
     */
    resolveDefault(wall = null, activeLevel = null) {
        const lvl = activeLevel || wall?.planner?.activeLevel || wall?.planner?.activeLevelConfig;
        
        // Foundation / Plinth wall presets
        if (wall?.type === 'foundation' || lvl?.type === 'plinth' || lvl?.type === 'foundation') {
            return Number(lvl?.height) || 40;
        }

        // Half-wall / Parapet presets
        if (wall?.type === 'half_wall') {
            return 80;
        }

        // Compound wall preset
        if (wall?.type === 'compound') {
            return 80;
        }

        // Standard level ceiling height if configured
        if (lvl?.height !== undefined) {
            const lvlH = Number(lvl.height);
            if (Number.isFinite(lvlH) && lvlH > 0) return lvlH;
        }

        // Wall configuration default
        if (wall?.config?.height !== undefined) {
            const confH = Number(wall.config.height);
            if (Number.isFinite(confH) && confH > 0) return confH;
        }

        return this.DEFAULT_HEIGHT;
    }
};

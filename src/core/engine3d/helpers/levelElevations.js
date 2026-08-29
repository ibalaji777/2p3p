/**
 * src/core/engine3d/helpers/levelElevations.js
 * Calculates Y elevation offsets for all levels.
 * Sub-structure (Foundation, Basement) sits below ground level (Y <= 0).
 * Plinth forms the transition at Y = 0 with plinth height.
 * Ground floor sits at Plinth level (or Y = 0 if no plinth).
 * Upper floors stack upwards sequentially.
 */
import { WALL_HEIGHT } from '../../../core/registry.js';

export function computeLevelElevations(levelsConfigArray) {
    if (!levelsConfigArray || levelsConfigArray.length === 0) return [];
    
    const count = levelsConfigArray.length;
    const elevations = new Array(count).fill(0);
    const heights = new Array(count).fill(WALL_HEIGHT || 180);

    // 1. Determine effective height for each level
    for (let i = 0; i < count; i++) {
        const lvl = levelsConfigArray[i];
        let h = Number(lvl?.height) || (lvl?.type === 'plinth' ? 18 : (lvl?.type === 'foundation' ? 40 : (WALL_HEIGHT || 120)));
        heights[i] = h;
    }

    // 2. Identify the "Ground Zero" index
    let groundIndex = -1;
    const plinthIdx = levelsConfigArray.findIndex(l => l?.type === 'plinth');
    const explicitGroundIdx = levelsConfigArray.findIndex(l => l?.type === 'ground');

    if (plinthIdx !== -1) {
        groundIndex = plinthIdx;
    } else if (explicitGroundIdx !== -1) {
        groundIndex = explicitGroundIdx;
    } else {
        const firstNonSub = levelsConfigArray.findIndex(l => l?.type !== 'foundation' && l?.type !== 'basement');
        groundIndex = firstNonSub !== -1 ? firstNonSub : 0;
    }

    // 3. Calculate upward elevations from groundIndex onwards
    elevations[groundIndex] = 0;
    for (let i = groundIndex + 1; i < count; i++) {
        elevations[i] = elevations[i - 1] + heights[i - 1];
    }

    // 4. Calculate downward elevations for sub-structure levels (before groundIndex)
    for (let i = groundIndex - 1; i >= 0; i--) {
        elevations[i] = elevations[i + 1] - heights[i];
    }

    return elevations;
}

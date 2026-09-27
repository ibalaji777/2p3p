/**
 * src/features/site/site.tool.js
 * 
 * Tool authority for interactive site boundary operations in 2D FloorPlanner.
 */

import { SiteEngine } from '../../core/site/SiteEngine.js';

export class SiteTool {
    /**
     * @param {Object} planner 
     */
    constructor(planner) {
        this.planner = planner;
        this.drawingPoints = [];
    }

    /**
     * Handles pointer click to place corner vertices.
     * @param {{x: number, y: number}} pos 
     */
    onPointerDown(pos) {
        if (!this.planner) return;
        this.drawingPoints.push({ x: pos.x, y: pos.y });

        if (this.drawingPoints.length === 4) {
            SiteEngine.createSite(this.planner, this.drawingPoints);
            this.drawingPoints = [];
            if (typeof this.planner.selectEntity === 'function') {
                this.planner.selectEntity(this.planner.site, 'site');
            }
        }
    }

    onPointerMove(pos) {
        // Live ghost line preview during interactive click-to-draw
    }

    onPointerUp() {
    }

    reset() {
        this.drawingPoints = [];
    }
}

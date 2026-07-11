import { GRID } from '../registry.js';
import Konva from 'konva';

/**
 * Manages the rendering and visibility of the background grid in the 2D Engine.
 */
export class GridSystem {
    /**
     * @param {Object} planner - The FloorPlanner instance.
     */
    constructor(planner) {
        this.planner = planner;
        this.gridLayer = new Konva.Group();
        this.planner.bgLayer.add(this.gridLayer);
        
        // Ensure gridLayer is positioned beneath references if needed
        this.gridLayer.moveToBottom();
    }

    /**
     * Draws the initial infinite grid lines.
     */
    setupGrid() {
        const size = 5000; // Giant 10,000px canvas workspace
        
        for (let i = -size; i <= size; i += GRID) {
            this.gridLayer.add(
                new Konva.Line({ 
                    points: [i, -size, i, size], 
                    stroke: "#f0f0f0", 
                    strokeWidth: 1, 
                    listening: false 
                })
            );
            this.gridLayer.add(
                new Konva.Line({ 
                    points: [-size, i, size, i], 
                    stroke: "#f0f0f0", 
                    strokeWidth: 1, 
                    listening: false 
                })
            );
        }
        
        this.redrawGrid();
    }

    /**
     * Redraws the grid layer (usually invoked after visibility changes).
     */
    redrawGrid() {
        if (this.gridLayer && this.planner.bgLayer) {
            this.planner.bgLayer.batchDraw();
        }
    }

    /**
     * Toggles grid visibility based on user settings.
     * @param {boolean} isVisible - True to show the grid, false to hide.
     */
    setVisibility(isVisible) {
        if (this.gridLayer) {
            this.gridLayer.visible(isVisible);
            this.redrawGrid();
        }
    }

    /**
     * Cleans up grid resources.
     */
    destroy() {
        if (this.gridLayer) {
            this.gridLayer.destroy();
            this.gridLayer = null;
        }
    }
}

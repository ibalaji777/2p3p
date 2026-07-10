/**
 * wall.tool.js
 * Encapsulates the user interaction (mouse/touch) logic for drawing walls.
 */

export class WallTool {
    constructor(planner) {
        this.planner = planner;
    }

    onPointerDown(pos, isTouch, tool) {
        // Core drawing logic extracted from FloorPlanner will go here.
        // It will interact with the planner's snap grids and wall arrays.
        // For Phase 3, we define the boundary interface.
        console.log(`[WallTool] Started drawing ${tool} at`, pos);
    }

    onPointerMove(pos, isTouch, tool) {
        // Handle dragging/previewing
    }

    onPointerUp(pos, isTouch, tool) {
        // Finalize wall creation
    }
}

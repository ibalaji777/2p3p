import { ViewportEngine } from '../viewport/ViewportEngine.js';

/**
 * WorkspaceControls
 * 
 * Unified controller adapter connecting 2D and 3D viewport zoom/pan operations.
 * Delegates directly to the canonical ViewportEngine while preserving backward-compatible APIs.
 */
export class WorkspaceControls {
    constructor(preview3D, planner) {
        this.preview3D = preview3D;
        this.camera = preview3D?.camera;
        this.controls = preview3D?.controls;
        this.planner = planner;
    }

    // --- 2D Viewport Controls ---

    zoomIn2D(factor = 1.0) {
        ViewportEngine.zoomIn('2d', { planner: this.planner }, factor);
    }

    zoomOut2D(factor = 1.0) {
        ViewportEngine.zoomOut('2d', { planner: this.planner }, factor);
    }

    resetZoom2D() {
        ViewportEngine.resetZoom('2d', { planner: this.planner });
    }

    // --- 3D Viewport Controls ---

    zoomIn3D(factor = 1.0) {
        ViewportEngine.zoomIn('3d', { renderer3D: this.preview3D }, factor);
    }

    zoomOut3D(factor = 1.0) {
        ViewportEngine.zoomOut('3d', { renderer3D: this.preview3D }, factor);
    }

    resetZoom3D() {
        ViewportEngine.resetZoom('3d', { renderer3D: this.preview3D });
    }

    dispose() {
        // No dangling stage event listeners to clean up since GestureManager handles Konva stage gestures
    }
}
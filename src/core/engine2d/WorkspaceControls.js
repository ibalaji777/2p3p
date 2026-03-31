import * as THREE from 'three';

export class WorkspaceControls {
    constructor(camera, controls, planner) {
        this.camera = camera;
        this.controls = controls; // OrbitControls
        this.planner = planner; // 2D FloorPlanner instance

        this.isCameraControlsVisible = true;
    }

    // --- 3D Controls ---

    zoomIn3D(factor = 0.8) {
        this.camera.position.multiplyScalar(factor);
    }

    zoomOut3D(factor = 1.2) {
        this.camera.position.multiplyScalar(factor);
    }

    setCameraPosition(preset) {
        // Example presets
        const presets = {
            top: { pos: [0, 1000, 0], target: [0, 0, 0] },
            iso: { pos: [500, 500, 500], target: [0, 0, 0] },
            front: { pos: [0, 150, 800], target: [0, 100, 0] },
        };

        const config = presets[preset];
        if (config) {
            this.camera.position.set(...config.pos);
            if (this.controls) {
                this.controls.target.set(...config.target);
            }
        }
    }

    toggleCameraHelper(visible) {
        this.isCameraControlsVisible = visible;
        // In a more advanced setup, you might show/hide a camera gizmo in the scene
        console.log("Camera controls visibility:", this.isCameraControlsVisible);
    }


    // --- 2D Controls ---

    zoomIn2D(factor = 1.1) {
        if (!this.planner || !this.planner.stage) return;
        const stage = this.planner.stage;
        const oldScale = stage.scaleX();
        const newScale = oldScale * factor;

        const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 };
        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        stage.scale({ x: newScale, y: newScale });
        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        stage.position(newPos);
        stage.batchDraw();
    }

    zoomOut2D(factor = 0.9) {
        // This is essentially the same logic as zoomIn but with a smaller factor
        this.zoomIn2D(factor);
    }

    resetZoom2D() {
        if (!this.planner || !this.planner.stage) return;
        this.planner.stage.scale({ x: 1, y: 1 });
        this.planner.stage.position({ x: 0, y: 0 });
        this.planner.stage.batchDraw();
    }
}
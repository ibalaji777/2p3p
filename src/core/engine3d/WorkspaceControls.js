import * as THREE from 'three';

export class WorkspaceControls {
    constructor(camera, controls, planner) {
        this.camera = camera;
        this.controls = controls; // OrbitControls
        this.planner = planner; // 2D FloorPlanner instance

        this.isCameraControlsVisible = true;
        this.isPanning2D = false;
        this.lastPanPos = { x: 0, y: 0 };
        
        this.init2DMouseControls();
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

    rotateCamera(angle) {
        if (!this.controls) return;
        this.controls.rotateLeft(angle);
    }
    
    init2DMouseControls() {
        if (!this.planner || !this.planner.stage) return;
        const stage = this.planner.stage;

        // Mouse Wheel Zoom
        stage.on('wheel', (e) => {
            e.evt.preventDefault();
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();
            if (!pointer) return;

            const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
            const direction = e.evt.deltaY > 0 ? -1 : 1;
            const scaleBy = 1.1;
            const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

            stage.scale({ x: newScale, y: newScale });
            const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
            stage.position(newPos);
            stage.batchDraw();
        });

        // Right Click / Middle Click Pan
        stage.on('mousedown', (e) => {
            if (e.evt.button === 1 || e.evt.button === 2) {
                e.evt.preventDefault();
                this.isPanning2D = true;
                this.lastPanPos = { x: e.evt.clientX, y: e.evt.clientY };
                document.body.style.cursor = 'grabbing';
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isPanning2D) return;
            e.preventDefault();
            const dx = e.clientX - this.lastPanPos.x; const dy = e.clientY - this.lastPanPos.y;
            this.lastPanPos = { x: e.clientX, y: e.clientY };
            stage.position({ x: stage.x() + dx, y: stage.y() + dy });
            stage.batchDraw();
        });

        window.addEventListener('mouseup', (e) => {
            if (this.isPanning2D && (e.button === 1 || e.button === 2)) {
                this.isPanning2D = false;
                document.body.style.cursor = 'default';
            }
        });
        
        stage.on('contextmenu', (e) => e.evt.preventDefault()); // Prevent browser menu on right click
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
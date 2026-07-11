import * as THREE from 'three';

export class WorkspaceControls {
    constructor(preview3D, planner) {
        this.preview3D = preview3D;
        this.camera = preview3D.camera;
        this.controls = preview3D.controls; // OrbitControls
        this.planner = planner; // 2D FloorPlanner instance

        const w = window.innerWidth;
        const h = window.innerHeight;
        this.isPanning2D = false;
        this.lastPanPos = { x: 0, y: 0 };
        
        this.init2DMouseControls();
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
                stage.container().style.cursor = 'grabbing';
                document.body.style.cursor = '';
            }
        });

        this._onMouseMove = (e) => {
            if (!this.isPanning2D) return;
            e.preventDefault();
            const dx = e.clientX - this.lastPanPos.x; const dy = e.clientY - this.lastPanPos.y;
            this.lastPanPos = { x: e.clientX, y: e.clientY };
            stage.position({ x: stage.x() + dx, y: stage.y() + dy });
            stage.batchDraw();
        };
        window.addEventListener('mousemove', this._onMouseMove);

        this._onMouseUp = (e) => {
            if (this.isPanning2D && (e.button === 1 || e.button === 2)) {
                this.isPanning2D = false;
                if (this.planner && this.planner.stage) {
                    this.planner.stage.container().style.cursor = this.planner.tool === 'select' ? 'grab' : 'crosshair';
                    document.body.style.cursor = '';
                }
            }
        };
        window.addEventListener('mouseup', this._onMouseUp);
        
        
        // Touch Pinch Zoom & Two-Finger Pan
        let lastCenter = null;
        let lastDist = 0;

        stage.on('touchmove', (e) => {
            const touch1 = e.evt.touches[0];
            const touch2 = e.evt.touches[1];

            if (touch1 && touch2) {
                e.evt.preventDefault();
                
                const p1 = { x: touch1.clientX, y: touch1.clientY };
                const p2 = { x: touch2.clientX, y: touch2.clientY };
                
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const center = {
                    x: (p1.x + p2.x) / 2,
                    y: (p1.y + p2.y) / 2,
                };

                if (lastCenter && lastDist) {
                    // Pan
                    const dx = center.x - lastCenter.x;
                    const dy = center.y - lastCenter.y;
                    
                    // Zoom
                    const oldScale = stage.scaleX();
                    const scaleBy = dist / lastDist;
                    const newScale = oldScale * scaleBy;
                    
                    // Adjust stage scale
                    stage.scale({ x: newScale, y: newScale });
                    
                    // 2. Adjust for zoom around center and apply pan
                    const pointTo = {
                        x: (lastCenter.x - stage.x()) / oldScale,
                        y: (lastCenter.y - stage.y()) / oldScale,
                    };
                    
                    const newPos = {
                        x: center.x - pointTo.x * newScale,
                        y: center.y - pointTo.y * newScale
                    };

                    stage.position(newPos);
                    stage.batchDraw();
                }

                lastDist = dist;
                lastCenter = center;
            }
        });

        stage.on('touchend', () => {
            lastDist = 0;
            lastCenter = null;
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

    dispose() {
        if (this._onMouseMove) window.removeEventListener('mousemove', this._onMouseMove);
        if (this._onMouseUp) window.removeEventListener('mouseup', this._onMouseUp);
    }
}
export class GestureManager {
    constructor(floorplanner, cameraController) {
        this.floorplanner = floorplanner;
        this.cameraController = cameraController;
        this.stage = floorplanner.stage;

        this.isPinching = false;
        this.isPanning = false;

        this.lastDistance = 0;
        this.lastCenter = null;
        
        // Custom double tap state
        this.lastTapTime = 0;
        this.lastTapPos = null;
        this.lastTapFingers = 0;
        this.doubleTapThreshold = 300; // ms

        this.initEvents();
    }

    isActive() {
        return this.isPinching || this.isPanning;
    }

    getDistance(p1, p2) {
        return Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
    }

    getCenter(p1, p2) {
        return {
            x: (p1.clientX + p2.clientX) / 2,
            y: (p1.clientY + p2.clientY) / 2,
        };
    }

    initEvents() {
        // Ensure the container prevents native touch actions to avoid browser zoom hijacking
        if (this.stage.container()) {
            this.stage.container().style.touchAction = 'none';
        }
        
        // We attach to the container to catch native touch events, 
        // or we can use Konva's touch events. Konva handles e.evt.touches.
        // We'll use Konva's stage events to integrate smoothly.
        
        this.stage.on('touchstart', (e) => {
            const touches = e.evt.touches;
            if (!touches) return;

            // Handle Double Tap Detection
            const now = Date.now();
            if (now - this.lastTapTime < this.doubleTapThreshold && this.lastTapFingers === touches.length) {
                // Potential double tap
                if (touches.length === 1) {
                    this.handleDoubleTap1Finger(e);
                } else if (touches.length === 2) {
                    this.handleDoubleTap2Fingers(e);
                }
                this.lastTapTime = 0; // reset
            } else {
                this.lastTapTime = now;
                this.lastTapFingers = touches.length;
            }

            if (touches.length === 2) {
                // Start Pinch Zoom / 2-Finger Pan
                this.isPinching = true;
                this.isPanning = false;
                
                this.lastDistance = this.getDistance(touches[0], touches[1]);
                this.lastCenter = this.getCenter(touches[0], touches[1]);
                
                // Disable drag/select while pinching
                if (this.stage.isDragging()) {
                    this.stage.stopDrag();
                }
                
                e.evt.preventDefault();
            } else if (touches.length === 1) {
                // If touching on background, we might want to pan the canvas
                const target = e.target;
                
                let isWallPan = false;
                const isWallTool = ['outer', 'inner', 'railing'].includes(this.floorplanner.tool);
                if (isWallTool && this.floorplanner.mobileDrawState === 'ChainWaiting') {
                    const pointerPos = this.stage.getPointerPosition();
                    if (pointerPos && this.floorplanner.lastAnchor) {
                        const transform = this.stage.getAbsoluteTransform().copy().invert();
                        const worldPos = transform.point(pointerPos);
                        const dist = Math.hypot(worldPos.x - this.floorplanner.lastAnchor.x, worldPos.y - this.floorplanner.lastAnchor.y);
                        const scale = this.stage.scaleX() || 1;
                        if (dist >= 60 / scale) {
                            isWallPan = true;
                            this.floorplanner.mobileIsPanning = true;
                        }
                    }
                }

                if (this.floorplanner.tool === 'pan' || ((target === this.stage || target.name() === 'bgLayer' || target === this.floorplanner.bgLayer || target === this.floorplanner.mainLayer) && this.floorplanner.tool === 'select') || isWallPan) {
                    // Start canvas pan
                    this.isPanning = true;
                    this.lastCenter = { x: touches[0].clientX, y: touches[0].clientY };
                }
            }
        });

        this.stage.on('touchmove', (e) => {
            const touches = e.evt.touches;
            if (!touches) return;

            if (touches.length === 2 && this.isPinching) {
                e.evt.preventDefault();
                
                const currentDistance = this.getDistance(touches[0], touches[1]);
                const currentCenter = this.getCenter(touches[0], touches[1]);

                // Handle Zoom
                const scaleBy = currentDistance / this.lastDistance;
                if (scaleBy !== 1) {
                    const oldScale = this.stage.scaleX();
                    const newScale = oldScale * scaleBy;
                    
                    // Convert LAST screen center to Konva stage coords to anchor the zoom properly
                    const pointerPos = {
                        x: this.lastCenter.x - this.stage.container().getBoundingClientRect().left,
                        y: this.lastCenter.y - this.stage.container().getBoundingClientRect().top
                    };
                    
                    this.cameraController.zoomAt(pointerPos, newScale, false);
                }

                // Handle 2-Finger Pan simultaneously
                if (this.lastCenter) {
                    const deltaX = currentCenter.x - this.lastCenter.x;
                    const deltaY = currentCenter.y - this.lastCenter.y;
                    this.cameraController.pan(deltaX, deltaY);
                }

                this.lastDistance = currentDistance;
                this.lastCenter = currentCenter;
                
            } else if (touches.length === 1 && this.isPanning) {
                e.evt.preventDefault();
                
                const currentCenter = { x: touches[0].clientX, y: touches[0].clientY };
                if (this.lastCenter) {
                    const deltaX = currentCenter.x - this.lastCenter.x;
                    const deltaY = currentCenter.y - this.lastCenter.y;
                    this.cameraController.pan(deltaX, deltaY);
                }
                this.lastCenter = currentCenter;
            }
        });

        this.stage.on('touchend', (e) => {
            const touches = e.evt.touches;
            if (!touches) return;

            if (touches.length < 2) {
                this.isPinching = false;
            }
            if (touches.length === 0) {
                this.isPanning = false;
                this.lastCenter = null;
            } else if (touches.length === 1 && this.isPinching) {
                // Dropped from 2 fingers to 1 finger
                this.isPinching = false;
                const isDrawingTool = ['outer', 'inner', 'railing', 'arc', 'shape_rect', 'shape_circle', 'shape_triangle', 'roof'].includes(this.floorplanner.tool) || this.floorplanner.drawing || (this.floorplanner.mobileDrawState && this.floorplanner.mobileDrawState !== 'Idle');
                if (!isDrawingTool || this.floorplanner.mobileIsPanning) {
                    this.isPanning = true; // Fallback to panning if dragging on bg? 
                    this.lastCenter = { x: touches[0].clientX, y: touches[0].clientY };
                } else {
                    this.isPanning = false;
                    this.lastCenter = null;
                }
            }
        });
        
        // Desktop support for zoom/pan
        this.stage.on('wheel', (e) => {
            e.evt.preventDefault();
            
            const pointer = this.stage.getPointerPosition();
            if (!pointer) return;
            
            const scaleBy = 1.1;
            const oldScale = this.stage.scaleX();
            const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
            
            this.cameraController.zoomAt(pointer, newScale, false);
        });
    }

    handleDoubleTap1Finger(e) {
        const target = e.target;
        
        if (target === this.stage || target.name() === 'bgLayer' || target === this.floorplanner.bgLayer || target === this.floorplanner.mainLayer) {
            // Double tap on empty space -> zoom in
            const nextScale = this.cameraController.getNextZoomLevel(true);
            const pointer = this.stage.getPointerPosition() || { x: this.stage.width()/2, y: this.stage.height()/2 };
            this.cameraController.zoomAt(pointer, nextScale, true);
        } else {
            // Double tap on object -> fit object
            if (this.floorplanner.selectedEntity) {
                this.cameraController.fitObject(this.floorplanner.selectedEntity);
            }
        }
    }

    handleDoubleTap2Fingers(e) {
        // Zoom out one level centered on screen
        const prevScale = this.cameraController.getNextZoomLevel(false);
        const center = { x: this.stage.width() / 2, y: this.stage.height() / 2 };
        this.cameraController.zoomAt(center, prevScale, true);
    }
}

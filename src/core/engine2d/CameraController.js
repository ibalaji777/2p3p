export class CameraController {
    constructor(floorplanner) {
        this.floorplanner = floorplanner;
        this.stage = floorplanner.stage;
        
        this.minZoom = 0.2;
        this.maxZoom = 8.0;
        
        this.zoomLevels = [0.25, 0.5, 1.0, 2.0, 4.0, 8.0];
        
        this.animationDuration = 300; // ms for double tap animations
        this.isAnimating = false;
    }

    screenToWorld(point) {
        const transform = this.stage.getAbsoluteTransform().copy();
        transform.invert();
        return transform.point(point);
    }

    worldToScreen(point) {
        const transform = this.stage.getAbsoluteTransform();
        return transform.point(point);
    }

    zoomAt(point, newScale, smooth = false) {
        if (this.isAnimating && smooth) return; // Prevent conflicting animations
        
        // Clamp scale
        newScale = Math.max(this.minZoom, Math.min(this.maxZoom, newScale));
        
        const oldScale = this.stage.scaleX();
        const pointerWorldPos = this.screenToWorld(point);

        if (smooth) {
            this.animateTransform(newScale, point, pointerWorldPos);
        } else {
            this.stage.scale({ x: newScale, y: newScale });
            const newPos = {
                x: point.x - pointerWorldPos.x * newScale,
                y: point.y - pointerWorldPos.y * newScale
            };
            this.stage.position(newPos);
            this.stage.batchDraw();
            if (this.floorplanner.updateMobileDragHandle) this.floorplanner.updateMobileDragHandle();
        }
    }

    pan(deltaX, deltaY) {
        if (this.isAnimating) return;
        const pos = this.stage.position();
        this.stage.position({
            x: pos.x + deltaX,
            y: pos.y + deltaY
        });
        this.stage.batchDraw();
    }

    fitObject(entity) {
        let node;
        if (entity.poly) node = entity.poly;
        else if (entity.group) node = entity.group;
        else if (entity.node) node = entity.node;
        else return;

        if (!node) return;

        // Get bounds relative to the main coordinate space, not absolute screen space
        const worldRect = node.getClientRect({ relativeTo: this.floorplanner.mainLayer, skipTransform: false });
        
        const stageWidth = this.stage.width();
        const stageHeight = this.stage.height();
        
        const padding = 50; // px
        
        const scaleX = (stageWidth - padding * 2) / (worldRect.width || 1);
        const scaleY = (stageHeight - padding * 2) / (worldRect.height || 1);
        let newScale = Math.min(scaleX, scaleY);
        newScale = Math.max(this.minZoom, Math.min(this.maxZoom, newScale));

        const targetCenterWorld = {
            x: worldRect.x + worldRect.width / 2,
            y: worldRect.y + worldRect.height / 2
        };

        const targetX = stageWidth / 2 - targetCenterWorld.x * newScale;
        const targetY = stageHeight / 2 - targetCenterWorld.y * newScale;

        this.animateTo(targetX, targetY, newScale);
    }

    fitScene() {
        const rect = this.floorplanner.mainLayer.getClientRect({ skipTransform: true });
        if (rect.width === 0 || rect.height === 0) return this.reset();
        
        const stageWidth = this.stage.width();
        const stageHeight = this.stage.height();
        const padding = 100;

        const scaleX = (stageWidth - padding * 2) / rect.width;
        const scaleY = (stageHeight - padding * 2) / rect.height;
        let newScale = Math.min(scaleX, scaleY);
        newScale = Math.max(this.minZoom, Math.min(this.maxZoom, newScale));

        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        
        const targetX = stageWidth / 2 - cx * newScale;
        const targetY = stageHeight / 2 - cy * newScale;
        
        this.animateTo(targetX, targetY, newScale);
    }

    reset() {
        this.animateTo(0, 0, 1.0);
    }

    getNextZoomLevel(zoomIn = true) {
        const currentScale = this.stage.scaleX();
        if (zoomIn) {
            for (let i = 0; i < this.zoomLevels.length; i++) {
                if (this.zoomLevels[i] > currentScale + 0.05) return this.zoomLevels[i];
            }
            return this.maxZoom;
        } else {
            for (let i = this.zoomLevels.length - 1; i >= 0; i--) {
                if (this.zoomLevels[i] < currentScale - 0.05) return this.zoomLevels[i];
            }
            return this.minZoom;
        }
    }

    animateTo(targetX, targetY, targetScale) {
        this.isAnimating = true;
        const startX = this.stage.x();
        const startY = this.stage.y();
        const startScale = this.stage.scaleX();
        
        const startTime = performance.now();
        
        const animate = (time) => {
            let t = (time - startTime) / this.animationDuration;
            if (t > 1) t = 1;
            
            // Ease out cubic
            const ease = 1 - Math.pow(1 - t, 3);
            
            this.stage.position({
                x: startX + (targetX - startX) * ease,
                y: startY + (targetY - startY) * ease
            });
            this.stage.scale({
                x: startScale + (targetScale - startScale) * ease,
                y: startScale + (targetScale - startScale) * ease
            });
            this.stage.batchDraw();
            if (this.floorplanner.updateMobileDragHandle) this.floorplanner.updateMobileDragHandle();
            
            if (t < 1) {
                this._animId = requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
                this._animId = null;
            }
        };
        this._animId = requestAnimationFrame(animate);
    }

    animateTransform(targetScale, screenPivot, worldPivot) {
        this.isAnimating = true;
        const startScale = this.stage.scaleX();
        const startTime = performance.now();
        
        const animate = (time) => {
            let t = (time - startTime) / this.animationDuration;
            if (t > 1) t = 1;
            
            // Ease out cubic
            const ease = 1 - Math.pow(1 - t, 3);
            
            const currentScale = startScale + (targetScale - startScale) * ease;
            
            this.stage.scale({ x: currentScale, y: currentScale });
            
            this.stage.position({
                x: screenPivot.x - worldPivot.x * currentScale,
                y: screenPivot.y - worldPivot.y * currentScale
            });
            
            this.stage.batchDraw();
            if (this.floorplanner.updateMobileDragHandle) this.floorplanner.updateMobileDragHandle();
            
            if (t < 1) {
                this._animId = requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
                this._animId = null;
            }
        };
        this._animId = requestAnimationFrame(animate);
    }

    dispose() {
        if (this._animId) {
            cancelAnimationFrame(this._animId);
            this._animId = null;
        }
        this.isAnimating = false;
    }
}

export class BottomSheetController {
    constructor(element, handle, onHeightChange, onSnapChange) {
        this.element = element;
        this.handle = handle;
        this.onHeightChange = onHeightChange;
        this.onSnapChange = onSnapChange;

        this.isDragging = false;
        this.startY = 0;
        this.startHeight = 0;
        this.lastY = 0;
        this.lastTime = 0;
        this.velocity = 0;
        this.startTime = 0;

        // Snaps: Peek (25%), Edit (50%), Full (90%)
        this.snaps = [0.25, 0.50, 0.90];
        this.currentSnapIndex = 0;

        this.initEvents();
    }

    initEvents() {
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);

        if (this.handle) {
            this.handle.addEventListener('pointerdown', this.onPointerDown);
            // Prevent default touch actions like browser scroll on the handle
            this.handle.style.touchAction = 'none'; 
        }
    }

    destroy() {
        if (this.handle) {
            this.handle.removeEventListener('pointerdown', this.onPointerDown);
            this.handle.removeEventListener('pointermove', this.onPointerMove);
            this.handle.removeEventListener('pointerup', this.onPointerUp);
            this.handle.removeEventListener('pointercancel', this.onPointerUp);
        }
    }

    onPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        this.isDragging = true;
        this.startY = e.clientY;
        this.startHeight = this.element.getBoundingClientRect().height;
        this.lastY = e.clientY;
        this.lastTime = performance.now();
        this.startTime = this.lastTime;
        this.velocity = 0;

        this.handle.setPointerCapture(e.pointerId);
        
        // Disable transitions for 1:1 finger tracking
        this.element.style.transition = 'none';

        this.handle.addEventListener('pointermove', this.onPointerMove);
        this.handle.addEventListener('pointerup', this.onPointerUp);
        this.handle.addEventListener('pointercancel', this.onPointerUp);
    }

    onPointerMove(e) {
        if (!this.isDragging) return;
        
        const deltaY = e.clientY - this.startY;
        let newHeight = this.startHeight - deltaY;

        // Apply limits with slight rubber banding
        const maxHeight = window.innerHeight * 0.95;
        const minHeight = window.innerHeight * 0.15;
        
        if (newHeight > maxHeight) {
            newHeight = maxHeight + (newHeight - maxHeight) * 0.1;
        } else if (newHeight < minHeight) {
            newHeight = minHeight + (newHeight - minHeight) * 0.1;
        }

        this.onHeightChange(newHeight);

        const now = performance.now();
        const dt = now - this.lastTime;
        if (dt > 0) {
            // Negative velocity = moving up (expanding)
            this.velocity = (e.clientY - this.lastY) / dt; 
        }
        this.lastY = e.clientY;
        this.lastTime = now;
    }

    onPointerUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        this.handle.releasePointerCapture(e.pointerId);
        this.handle.removeEventListener('pointermove', this.onPointerMove);
        this.handle.removeEventListener('pointerup', this.onPointerUp);
        this.handle.removeEventListener('pointercancel', this.onPointerUp);

        // Re-enable smooth transition for snapping
        this.element.style.transition = 'height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        
        const timeElapsed = performance.now() - this.startTime;
        const distance = Math.abs(e.clientY - this.startY);
        
        // Detect tap vs drag
        if (timeElapsed < 250 && distance < 10) {
            this.toggleSnap();
        } else {
            this.snapToNearest();
        }
    }

    toggleSnap() {
        if (this.currentSnapIndex === 0) {
            this.setSnapIndex(1); // Peek -> Edit
        } else if (this.currentSnapIndex === 1) {
            this.setSnapIndex(0); // Edit -> Peek
        } else {
            this.setSnapIndex(1); // Full -> Edit
        }
    }

    snapToNearest() {
        const currentHeight = this.element.getBoundingClientRect().height;
        const windowHeight = window.innerHeight;
        let targetSnapIndex = this.currentSnapIndex;

        // Use velocity if flicked
        if (this.velocity < -0.5) { // Flick up
            targetSnapIndex = Math.min(this.snaps.length - 1, this.currentSnapIndex + 1);
        } else if (this.velocity > 0.5) { // Flick down
            targetSnapIndex = Math.max(0, this.currentSnapIndex - 1);
        } else {
            // Find closest geometric snap
            let minDiff = Infinity;
            this.snaps.forEach((snap, index) => {
                const snapHeight = snap * windowHeight;
                const diff = Math.abs(snapHeight - currentHeight);
                if (diff < minDiff) {
                    minDiff = diff;
                    targetSnapIndex = index;
                }
            });
        }

        this.setSnapIndex(targetSnapIndex);
    }

    setSnapIndex(index) {
        this.currentSnapIndex = index;
        const targetHeight = this.snaps[index] * window.innerHeight;
        this.onHeightChange(targetHeight);
        if (this.onSnapChange) {
            this.onSnapChange(index);
        }
    }

    init() {
        // Force the transition on init to smooth in
        this.element.style.transition = 'height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        this.setSnapIndex(0); // Start at Peek
    }
}

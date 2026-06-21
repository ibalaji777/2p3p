import * as THREE from 'three';

export class TransformInput {
    constructor(domElement, camera, raycaster, callbacks) {
        this.domElement = domElement;
        this.camera = camera;
        this.raycaster = raycaster;
        this.callbacks = callbacks; // { onHover, onStart, onMove, onEnd }
        
        this.mouse = new THREE.Vector2();
        this.startMouse = new THREE.Vector2();
        
        this.active = false;
        this.activePointerId = null;

        this.onPointerHover = this.onPointerHover.bind(this);
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);

        this.domElement.addEventListener('pointermove', this.onPointerHover, { capture: true });
        this.domElement.addEventListener('pointerdown', this.onPointerDown, { passive: false, capture: true });
    }

    updateMouse(event) {
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onPointerHover(event) {
        if (this.active) return;
        this.updateMouse(event);
        if (this.callbacks.onHover) {
            this.callbacks.onHover(this.mouse);
        }
    }

    onPointerDown(event) {
        if (this.active) return;
        this.updateMouse(event);
        
        if (this.callbacks.onStart) {
            const axisHit = this.callbacks.onStart(this.mouse);
            if (axisHit) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                
                this.active = true;
                this.activePointerId = event.pointerId;
                this.startMouse.copy(this.mouse);
                
                this.domElement.addEventListener('pointermove', this.onPointerMove, { passive: false, capture: true });
                this.domElement.addEventListener('pointerup', this.onPointerUp, { passive: false, capture: true });
            }
        }
    }

    onPointerMove(event) {
        if (!this.active || event.pointerId !== this.activePointerId) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        this.updateMouse(event);
        if (this.callbacks.onMove) {
            this.callbacks.onMove(this.mouse, this.startMouse);
        }
    }

    onPointerUp(event) {
        if (!this.active || event.pointerId !== this.activePointerId) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        this.active = false;
        this.activePointerId = null;

        if (this.callbacks.onEnd) {
            this.callbacks.onEnd();
        }

        this.domElement.removeEventListener('pointermove', this.onPointerMove, { capture: true });
        this.domElement.removeEventListener('pointerup', this.onPointerUp, { capture: true });
    }

    dispose() {
        this.domElement.removeEventListener('pointermove', this.onPointerHover, { capture: true });
        this.domElement.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
        this.domElement.removeEventListener('pointermove', this.onPointerMove, { capture: true });
        this.domElement.removeEventListener('pointerup', this.onPointerUp, { capture: true });
    }
}

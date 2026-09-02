import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraController {
    constructor(camera, domElement, preview3D) {
        this.camera = camera;
        this.domElement = domElement;
        this.preview3D = preview3D;
        
        // 1. Initialize OrbitControls with Sims 4 Ground Plane & Physics Settings
        this.controls = new OrbitControls(this.camera, this.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        
        // CRITICAL: Ground-plane horizontal panning (Sims 4 style, stays on XZ floor)
        this.controls.screenSpacePanning = false;
        
        // Bounded angles so camera never dips under the floor or flips upside down
        this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
        this.controls.minDistance = 30;
        this.controls.maxDistance = 3500;
        this.controls.panSpeed = 1.2;
        this.controls.rotateSpeed = 0.85;
        this.controls.zoomSpeed = 1.1;

        // Sims 4 Mouse Configuration:
        // - Right-Click Drag: Pan across ground plane
        // - Middle-Click Drag: Rotate / Pitch tilt
        // - Left-Click Drag: Rotate / Orbit (when not interacting with objects)
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.ROTATE,
            RIGHT: THREE.MOUSE.PAN
        };

        // Sims 4 Touch / Mobile Configuration:
        this.controls.touches = {
            ONE: THREE.TOUCH.PAN,
            TWO: THREE.TOUCH.DOLLY_PAN
        };

        // Animation state
        this.isAnimating = false;
        this.animationTargetPos = new THREE.Vector3();
        this.animationTargetLookAt = new THREE.Vector3();
        this.animationSpeed = 0.12; // Smooth lerp factor

        // Continuous Keyboard Navigation (WASD / Arrow Keys)
        this.activeKeys = new Set();
        this.panVelocity = new THREE.Vector3();
        this.isShiftDown = false;
        
        // Default perspective
        this.defaultDistance = 1500;
        this.defaultPosition = new THREE.Vector3(800, 600, 800);
        this.sims4IsoIndex = 0;

        // Cancel animation if user manually interacts with the camera
        this._onControlStart = () => {
            if (this.isAnimating) {
                this.isAnimating = false;
                this.controls.enableDamping = true;
            }
        };
        this.controls.addEventListener('start', this._onControlStart);

        // Sims 4 Build Mode Keyboard Event Listeners
        this._onKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
            if (document.activeElement?.isContentEditable) return;
            if (this.preview3D && this.preview3D.viewMode3D === 'preview') return;

            const key = e.key;
            const keyLower = key.toLowerCase();

            // Continuous navigation keys (WASD + Arrows)
            if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(keyLower)) {
                this.activeKeys.add(keyLower);
                this.isShiftDown = e.shiftKey;
                if (this.isAnimating) this.isAnimating = false;
            }

            // Sims 4 45° Stepped Rotation (< / > / , / . / Q / E)
            if (key === '<' || key === ',' || (keyLower === 'q' && !e.ctrlKey && !e.metaKey && !this.preview3D?.interactions?.drawing)) {
                this.rotateSims4Isometric(-1);
            } else if (key === '>' || key === '.' || (keyLower === 'e' && !e.ctrlKey && !e.metaKey && !this.preview3D?.interactions?.drawing)) {
                this.rotateSims4Isometric(1);
            }
            // Sims 4 Top-Down Toggle (T)
            else if (keyLower === 't' && !e.ctrlKey && !e.metaKey && !this.preview3D?.interactions?.drawing) {
                this.toggleSims4TopDown();
            }
            // Zoom in / out shortcuts (+ / - / Z / X)
            else if (key === '+' || key === '=' || keyLower === 'z') {
                if (!e.ctrlKey && !e.metaKey) this.zoomBy(-120);
            } else if (key === '-' || key === '_' || keyLower === 'x') {
                if (!e.ctrlKey && !e.metaKey) this.zoomBy(120);
            }
            // Reset to default isometric view (Home)
            else if (key === 'Home') {
                this.resetCamera();
            }
            // Cutaway levels
            else if (key === 'PageUp') {
                if (this.preview3D?.setWallCutawayMode) this.preview3D.setWallCutawayMode('walls_up');
            } else if (key === 'PageDown') {
                if (this.preview3D?.setWallCutawayMode) this.preview3D.setWallCutawayMode('walls_down');
            } else if (key === 'End') {
                if (this.preview3D?.setWallCutawayMode) this.preview3D.setWallCutawayMode('cutaway');
            }
        };

        this._onKeyUp = (e) => {
            const keyLower = e.key.toLowerCase();
            this.activeKeys.delete(keyLower);
            this.isShiftDown = e.shiftKey;
        };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    getBuildingBoundingBox() {
        const box = new THREE.Box3();
        if (this.preview3D.structureGroup) {
            box.setFromObject(this.preview3D.structureGroup);
        }
        if (this.preview3D.staticStructureGroup && this.preview3D.staticStructureGroup.children.length > 0) {
            const staticBox = new THREE.Box3().setFromObject(this.preview3D.staticStructureGroup);
            if (!staticBox.isEmpty()) box.union(staticBox);
        }
        if (box.isEmpty()) {
            box.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1000, 1000, 1000));
        }
        return box;
    }

    orbitBy(dx, dy) {
        if (this.isAnimating) {
            this.isAnimating = false;
            this.controls.enableDamping = true;
        }
        this.controls.rotateLeft(dx);
        this.controls.rotateUp(dy);
        this.controls.update();
    }

    zoomBy(delta) {
        if (this.isAnimating) this.isAnimating = false;
        const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
        const currentDist = dir.length();
        const newDist = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, currentDist + delta));
        
        dir.normalize().multiplyScalar(newDist);
        this.camera.position.copy(this.controls.target).add(dir);
        
        if (this.camera.position.y < 20) this.camera.position.y = 20;
        this.controls.update();
        if (this.preview3D?.requestRender) this.preview3D.requestRender('camera_zoom');
    }

    setCameraDirection(directionVector) {
        const box = this.getBuildingBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 500);
        const distance = maxDim * 1.5;

        const newPos = center.clone().add(directionVector.multiplyScalar(distance));
        if (newPos.y < 50) newPos.y = 50;

        this.animateTo(newPos, center);
    }

    focusOnObject(object, intersect = null, autoRotate = true, zoomMultiplier = 1.0) {
        if (!object) return;
        
        let intersectPoint = null;
        let intersectNormal = null;

        if (intersect && intersect.point) {
            intersectPoint = intersect.point;
            if (autoRotate && intersect.face && intersect.face.normal && intersect.object) {
                intersectNormal = intersect.face.normal.clone();
                const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld);
                intersectNormal.applyMatrix3(normalMatrix).normalize();

                const viewVector = new THREE.Vector3().subVectors(intersectPoint, this.camera.position).normalize();
                if (intersectNormal.dot(viewVector) > 0) {
                    intersectNormal.negate();
                }
            }
        }
        
        const box = new THREE.Box3().setFromObject(object);
        if (box.isEmpty()) return;
        
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        const size = new THREE.Vector3();
        box.getSize(size);
        let maxDim = Math.max(size.x, size.y, size.z, 50);
        
        if (object.userData && (object.userData.isWallSide || object.userData.isFloor)) {
            maxDim = Math.min(maxDim, 250); 
        } else {
            maxDim = Math.min(maxDim, 500); 
        }

        let distance = maxDim * 2.5 * zoomMultiplier; 
        if (distance > 1200 * zoomMultiplier) distance = 1200 * zoomMultiplier;

        if (intersectPoint) {
            if (size.lengthSq() > 90000) {
                center.lerp(intersectPoint, 0.7);
            } else {
                center.lerp(intersectPoint, 0.3);
            }
        }

        let dirFromTarget = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
        
        if (intersectNormal) {
            if (Math.abs(intersectNormal.y) > 0.9) {
                dirFromTarget = intersectNormal.clone().add(new THREE.Vector3(0.5, 0, 0.5)).normalize();
            } else {
                dirFromTarget = intersectNormal.clone().add(new THREE.Vector3(0, 0.35, 0)).normalize();
            }
        } else if (dirFromTarget.lengthSq() < 0.1) {
            dirFromTarget.set(1, 1, 1).normalize();
        }

        const newPos = center.clone().add(dirFromTarget.multiplyScalar(distance));
        if (newPos.y < 20) newPos.y = 20;

        this.animateTo(newPos, center);
    }

    setEntranceAngle(angle) {
        this.entranceAngle = angle;
    }

    /**
     * Sets Sims 4 Isometric 45° View around the active center / target.
     * @param {number|null} quadrantIndex
     */
    setSims4IsometricView(quadrantIndex = null) {
        if (quadrantIndex !== null) {
            this.sims4IsoIndex = (quadrantIndex % 4 + 4) % 4;
        } else if (this.sims4IsoIndex === undefined) {
            this.sims4IsoIndex = 0;
        }

        const center = this.controls.target.clone();
        const dist = Math.max(400, this.camera.position.distanceTo(center));

        // 4 quadrants for Sims 4 Isometric View (45°, 135°, 225°, 315°)
        const angle = this.sims4IsoIndex * (Math.PI / 2) + Math.PI / 4;
        const dir = new THREE.Vector3(Math.cos(angle), 0.75, Math.sin(angle)).normalize();
        const newPos = center.clone().add(dir.multiplyScalar(dist));
        this.animateTo(newPos, center);
    }

    /**
     * Rotates camera in 45° step around target pivot (Sims 4 style < / >).
     * @param {number} direction - +1 for clockwise, -1 for counter-clockwise.
     */
    rotateSims4Isometric(direction = 1) {
        if (this.sims4IsoIndex === undefined) this.sims4IsoIndex = 0;
        this.sims4IsoIndex = (this.sims4IsoIndex + direction + 4) % 4;
        this.setSims4IsometricView(this.sims4IsoIndex);
    }

    /**
     * Sets 90° Top-Down plan view directly above current target.
     */
    setTopDownView() {
        const center = this.controls.target.clone();
        const dist = Math.max(500, this.camera.position.distanceTo(center));

        const dir = new THREE.Vector3(0.001, 1, 0.001).normalize();
        const newPos = center.clone().add(dir.multiplyScalar(dist));
        this.animateTo(newPos, center);
    }

    /**
     * Toggles smoothly between Top-Down view and 45° Isometric perspective.
     */
    toggleSims4TopDown() {
        const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
        if (dir.y > 0.92) {
            this.setSims4IsometricView();
        } else {
            this.setTopDownView();
        }
    }

    setFrontElevationView() {
        const center = this.controls.target.clone();
        const dist = Math.max(500, this.camera.position.distanceTo(center));

        const dir = new THREE.Vector3(0, 0.25, 1).normalize();
        const newPos = center.clone().add(dir.multiplyScalar(dist));
        this.animateTo(newPos, center);
    }

    resetCamera() {
        const box = this.getBuildingBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);
        this.controls.target.copy(center);
        this.setSims4IsometricView(0);
    }

    animateTo(position, target) {
        this.animationTargetPos.copy(position);
        this.animationTargetLookAt.copy(target);
        this.isAnimating = true;
        this.controls.enableDamping = false;
    }

    updateCameraBounds() {
        const box = this.getBuildingBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);

        const delta = center.clone().sub(this.controls.target);
        this.controls.target.copy(center);
        this.camera.position.add(delta);
        this.controls.update();
    }

    /**
     * Per-frame camera update handling smooth animations and continuous WASD/Arrow ground movement.
     */
    update() {
        let changed = false;

        // 1. Smooth Camera Animation (Transitions / Focusing)
        if (this.isAnimating) {
            this.camera.position.lerp(this.animationTargetPos, this.animationSpeed);
            this.controls.target.lerp(this.animationTargetLookAt, this.animationSpeed);

            if (this.camera.position.distanceTo(this.animationTargetPos) < 1 &&
                this.controls.target.distanceTo(this.animationTargetLookAt) < 1) {
                this.isAnimating = false;
                this.controls.enableDamping = true;
            }
            changed = true;
        }

        // 2. Sims 4 Continuous WASD / Arrow Key Floor Panning
        if (this.activeKeys.size > 0) {
            // Forward horizontal vector (projected onto ground plane XZ)
            const forward = new THREE.Vector3()
                .subVectors(this.controls.target, this.camera.position);
            forward.y = 0;
            if (forward.lengthSq() > 0.001) forward.normalize();
            else forward.set(0, 0, -1);

            // Right horizontal vector
            const right = new THREE.Vector3()
                .crossVectors(forward, new THREE.Vector3(0, 1, 0))
                .normalize();

            // Calculate base pan speed scaled by camera distance (Sims 4 tactile feel)
            const camDistance = this.camera.position.distanceTo(this.controls.target);
            const baseSpeed = Math.max(8, camDistance * 0.02);
            const speedMultiplier = this.isShiftDown ? 2.2 : 1.0;
            const moveSpeed = baseSpeed * speedMultiplier;

            const moveDir = new THREE.Vector3(0, 0, 0);

            if (this.activeKeys.has('w') || this.activeKeys.has('arrowup')) {
                moveDir.add(forward);
            }
            if (this.activeKeys.has('s') || this.activeKeys.has('arrowdown')) {
                moveDir.sub(forward);
            }
            if (this.activeKeys.has('d') || this.activeKeys.has('arrowright')) {
                moveDir.add(right);
            }
            if (this.activeKeys.has('a') || this.activeKeys.has('arrowleft')) {
                moveDir.sub(right);
            }

            if (moveDir.lengthSq() > 0.001) {
                moveDir.normalize().multiplyScalar(moveSpeed);
                this.panVelocity.add(moveDir);
            }
        }

        // Apply smooth damping / friction to velocity
        if (this.panVelocity.lengthSq() > 0.01) {
            this.camera.position.add(this.panVelocity);
            this.controls.target.add(this.panVelocity);
            this.panVelocity.multiplyScalar(0.82);

            // Keep above ground
            if (this.camera.position.y < 20) this.camera.position.y = 20;

            changed = true;
        } else {
            this.panVelocity.set(0, 0, 0);
        }

        if (this.controls.update()) changed = true;
        return changed;
    }

    dispose() {
        if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
        if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp);
        if (this.controls) {
            this.controls.removeEventListener('start', this._onControlStart);
            this.controls.dispose();
        }
    }
}

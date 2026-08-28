import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraController {
    constructor(camera, domElement, preview3D) {
        this.camera = camera;
        this.domElement = domElement;
        this.preview3D = preview3D;
        
        // Initialize OrbitControls
        this.controls = new OrbitControls(this.camera, this.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.02;

        // Animation state
        this.isAnimating = false;
        this.animationTargetPos = new THREE.Vector3();
        this.animationTargetLookAt = new THREE.Vector3();
        this.animationSpeed = 0.1; // Lerp factor
        
        // Default perspective
        this.defaultDistance = 1500;
        this.defaultPosition = new THREE.Vector3(800, 600, 800);

        // Cancel animation if user manually interacts with the camera
        this._onControlStart = () => {
            if (this.isAnimating) {
                this.isAnimating = false;
                this.controls.enableDamping = true;
            }
        };
        this.controls.addEventListener('start', this._onControlStart);

        // Sims 4 Build Mode Keyboard Shortcuts (< / > / , / . / T / Home)
        this._onKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
            if (this.preview3D && this.preview3D.viewMode3D === 'preview') return;

            if (e.key === '<' || e.key === ',' || (e.key === 'q' && !e.ctrlKey && !e.metaKey && !this.preview3D?.interactions?.drawing)) {
                this.rotateSims4Isometric(-1);
            } else if (e.key === '>' || e.key === '.' || (e.key === 'e' && !e.ctrlKey && !e.metaKey && !this.preview3D?.interactions?.drawing)) {
                this.rotateSims4Isometric(1);
            } else if (e.key === 't' || e.key === 'T') {
                this.toggleSims4TopDown();
            } else if (e.key === 'Home') {
                this.resetCamera();
            }
        };
        window.addEventListener('keydown', this._onKeyDown);
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
        // dx and dy are angles in radians
        this.controls.rotateLeft(dx);
        this.controls.rotateUp(dy);
        this.controls.update();
    }

    setCameraDirection(directionVector) {
        // Find the center of the building to orbit around
        const box = this.getBuildingBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 500);
        const distance = maxDim * 1.5;

        // Calculate new position relative to center
        const newPos = center.clone().add(directionVector.multiplyScalar(distance));
        
        // Ensure we don't go below ground
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

                // Ensure the normal is pointing TOWARDS the camera, not away from it.
                // If it points away, the normal is inverted (common with some models),
                // so we flip it to make sure the camera stays on the side the user clicked from.
                const viewVector = new THREE.Vector3().subVectors(intersectPoint, this.camera.position).normalize();
                if (intersectNormal.dot(viewVector) > 0) {
                    intersectNormal.negate();
                }
            }
        }
        
        // Calculate the bounding box of the object in world space
        const box = new THREE.Box3().setFromObject(object);
        if (box.isEmpty()) return;
        
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        const size = new THREE.Vector3();
        box.getSize(size);
        let maxDim = Math.max(size.x, size.y, size.z, 50); // Ensure a minimum distance
        
        // If it's a huge object like a wall or floor, capping maxDim prevents zooming out to space
        if (object.userData && (object.userData.isWallSide || object.userData.isFloor)) {
            maxDim = Math.min(maxDim, 250); 
        } else {
            maxDim = Math.min(maxDim, 500); 
        }

        // Put a cap on max distance so we don't zoom out too far for large objects like floors/ceilings
        let distance = maxDim * 2.5 * zoomMultiplier; 
        
        if (distance > 1200 * zoomMultiplier) distance = 1200 * zoomMultiplier;

        // If intersectPoint is provided, focus closer to where the user actually clicked
        if (intersectPoint) {
            // Lerp center 70% towards the intersect point for huge objects so we zoom into the click area
            if (size.lengthSq() > 90000) { // 300^2
                center.lerp(intersectPoint, 0.7);
            } else {
                center.lerp(intersectPoint, 0.3); // Slight bias for smaller objects
            }
        }

        let dirFromTarget = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
        
        if (intersectNormal) {
            if (Math.abs(intersectNormal.y) > 0.9) {
                // Clicked on a floor/ceiling. Tilt it slightly so it's not a perfect top-down
                dirFromTarget = intersectNormal.clone().add(new THREE.Vector3(0.5, 0, 0.5)).normalize();
            } else {
                // Clicked on a wall/door. Look at it, but slightly from above (0.35 on Y)
                dirFromTarget = intersectNormal.clone().add(new THREE.Vector3(0, 0.35, 0)).normalize();
            }
        } else if (dirFromTarget.lengthSq() < 0.1) {
            dirFromTarget.set(1, 1, 1).normalize();
        }

        const newPos = center.clone().add(dirFromTarget.multiplyScalar(distance));
        
        // Ensure we don't go below ground
        if (newPos.y < 20) newPos.y = 20;

        this.animateTo(newPos, center);
    }

    setEntranceAngle(angle) {
        this.entranceAngle = angle;
    }

    setSims4IsometricView(quadrantIndex = null) {
        if (quadrantIndex !== null) {
            this.sims4IsoIndex = (quadrantIndex % 4 + 4) % 4;
        } else if (this.sims4IsoIndex === undefined) {
            this.sims4IsoIndex = 0;
        }

        const box = this.getBuildingBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);

        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 500);
        const distance = maxDim * 1.6;

        // 4 quadrants for Sims 4 Isometric View (45°, 135°, 225°, 315°)
        const angle = this.sims4IsoIndex * (Math.PI / 2) + Math.PI / 4;
        const dir = new THREE.Vector3(Math.cos(angle), 0.85, Math.sin(angle)).normalize();
        const newPos = center.clone().add(dir.multiplyScalar(distance));
        this.animateTo(newPos, center);
    }

    rotateSims4Isometric(direction = 1) {
        if (this.sims4IsoIndex === undefined) this.sims4IsoIndex = 0;
        this.sims4IsoIndex = (this.sims4IsoIndex + direction + 4) % 4;
        this.setSims4IsometricView(this.sims4IsoIndex);
    }

    setTopDownView() {
        const box = this.getBuildingBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);

        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.z, 500);
        const distance = maxDim * 1.5;

        // Direct 90 degree top-down view
        const dir = new THREE.Vector3(0.001, 1, 0.001).normalize();
        const newPos = center.clone().add(dir.multiplyScalar(distance));
        this.animateTo(newPos, center);
    }

    toggleSims4TopDown() {
        const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
        if (dir.y > 0.95) {
            // Already top down, switch to 45 degree isometric
            this.setSims4IsometricView();
        } else {
            // Switch to top down
            this.setTopDownView();
        }
    }

    setFrontElevationView() {
        const box = this.getBuildingBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);

        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 500);
        const distance = maxDim * 1.6;

        // Front view looking along Z axis
        const dir = new THREE.Vector3(0, 0.25, 1).normalize();
        const newPos = center.clone().add(dir.multiplyScalar(distance));
        this.animateTo(newPos, center);
    }

    resetCamera() {
        this.setSims4IsometricView(0);
    }

    animateTo(position, target) {
        this.animationTargetPos.copy(position);
        this.animationTargetLookAt.copy(target);
        this.isAnimating = true;
        
        // Disable damping during animation to prevent the controls from fighting our manual lerp
        this.controls.enableDamping = false;
    }

    updateCameraBounds() {
        const box = this.getBuildingBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Pan nicely to the new center
        const delta = center.clone().sub(this.controls.target);
        this.controls.target.copy(center);
        this.camera.position.add(delta);
        this.controls.update();
    }

    update() {
        let changed = false;
        if (this.isAnimating) {
            // Smoothly interpolate position and target
            this.camera.position.lerp(this.animationTargetPos, this.animationSpeed);
            this.controls.target.lerp(this.animationTargetLookAt, this.animationSpeed);

            // Check if we arrived
            if (this.camera.position.distanceTo(this.animationTargetPos) < 1 &&
                this.controls.target.distanceTo(this.animationTargetLookAt) < 1) {
                this.isAnimating = false;
                this.controls.enableDamping = true; // Restore damping once arrived
            }
            changed = true;
        }
        
        if (this.controls.update()) changed = true;
        return changed;
    }

    dispose() {
        if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
        if (this.controls) {
            this.controls.removeEventListener('start', this._onControlStart);
            this.controls.dispose();
        }
    }
}

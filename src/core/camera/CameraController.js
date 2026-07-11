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

    setEntranceAngle(angle) {
        this.entranceAngle = angle;
    }

    resetCamera() {
        const box = this.getBuildingBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 500);
        const distance = maxDim * 1.5;

        const baseDir = new THREE.Vector3(1, 1, 1).normalize();
        const angle = this.entranceAngle || 0;
        
        // Apply entrance rotation (Y-axis) to the direction vector
        const dir = baseDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        
        const newPos = center.clone().add(dir.multiplyScalar(distance));
        this.animateTo(newPos, center);
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
        }
        
        this.controls.update();
    }

    dispose() {
        if (this.controls) {
            this.controls.removeEventListener('start', this._onControlStart);
            this.controls.dispose();
        }
    }
}

import * as THREE from 'three';

export class TransformLogic {
    constructor(camera, dispatchEvent) {
        this.camera = camera;
        this.dispatchEvent = dispatchEvent; // Callback to emit events
        this.snapEnabled = true;
        this.snapSize = 20;
        this.rotationSnap = null;
        
        // Math utility objects
        this.startWorldPosition = new THREE.Vector3();
        this.startObjectPosition = new THREE.Vector3();
        this.startObjectQuaternion = new THREE.Quaternion();
        this.startScale = new THREE.Vector3();
        this.pointStart = new THREE.Vector3();
        this.rotationAxis = new THREE.Vector3();
        this.plane = new THREE.Plane();
    }

    startInteraction(object, mode, axis, worldPosition, worldQuaternion, mouse, raycaster) {
        if (!object || !axis) return false;
        
        this.startWorldPosition.copy(worldPosition);

        if (mode === 'translate' || mode === 'place') {
            if (axis === 'translateX' || axis === 'translateZ') {
                const camDir = new THREE.Vector3().subVectors(this.camera.position, worldPosition).normalize();
                const localAxis = new THREE.Vector3();
                if (axis === 'translateX') localAxis.set(1,0,0);
                if (axis === 'translateZ') localAxis.set(0,0,1);
                
                const planeNormal = new THREE.Vector3().crossVectors(localAxis, camDir).cross(localAxis).normalize();
                if (planeNormal.lengthSq() < 0.001) planeNormal.copy(camDir);
                
                const plane = new THREE.Plane();
                plane.setFromNormalAndCoplanarPoint(planeNormal, worldPosition);
                raycaster.ray.intersectPlane(plane, this.pointStart);
            } else {
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -worldPosition.y);
                raycaster.ray.intersectPlane(plane, this.pointStart);
            }
            this.startObjectPosition.copy(object.position);
        } else if (mode === 'scale') {
            this.startScale.copy(object.scale);
            
            const localAxis = new THREE.Vector3();
            if (axis.includes('X')) localAxis.set(1,0,0);
            else if (axis.includes('Y')) localAxis.set(0,1,0);
            else if (axis.includes('Z')) localAxis.set(0,0,1);
            else localAxis.set(1,1,1); // scaleUniform
            
            localAxis.applyQuaternion(worldQuaternion).normalize();
            
            const camDir = new THREE.Vector3().subVectors(this.camera.position, worldPosition).normalize();
            let planeNormal = new THREE.Vector3();
            
            if (axis.includes('Uniform')) {
                planeNormal.copy(camDir).negate(); // Face the camera
            } else {
                // Create optimal plane that contains the localAxis and faces the camera as much as possible
                planeNormal.crossVectors(localAxis, camDir);
                if (planeNormal.lengthSq() < 0.001) {
                    planeNormal.set(0,1,0);
                    if (Math.abs(localAxis.y) > 0.9) planeNormal.set(1,0,0);
                } else {
                    planeNormal.normalize();
                    planeNormal.crossVectors(planeNormal, localAxis).normalize();
                }
                // Ensure normal points towards camera
                if (planeNormal.dot(camDir) < 0) planeNormal.negate();
            }
            
            this.plane.setFromNormalAndCoplanarPoint(planeNormal, worldPosition);
            const hit = raycaster.ray.intersectPlane(this.plane, this.pointStart);
            if (!hit) this.pointStart.copy(worldPosition);
        } else if (mode === 'rotate') {
            const plane = new THREE.Plane();
            this.rotationAxis.set(0,0,0);
            if (axis === 'X') this.rotationAxis.set(1,0,0); 
            if (axis === 'Y') this.rotationAxis.set(0,1,0); 
            if (axis === 'Z') this.rotationAxis.set(0,0,1); 

            plane.setFromNormalAndCoplanarPoint(this.rotationAxis, worldPosition);
            raycaster.ray.intersectPlane(plane, this.pointStart);
            this.startObjectQuaternion.copy(object.quaternion);
        }

        // Dispatch specific start events
        if (mode === 'translate' || mode === 'place') this.dispatchEvent({ type: 'move-start', object: object });
        else if (mode === 'scale') this.dispatchEvent({ type: 'scale-start', object: object });
        else if (mode === 'rotate') {
            if (axis === 'Y') this.dispatchEvent({ type: 'spin-start', object: object });
            else if (axis === 'X') this.dispatchEvent({ type: 'tilt-start', object: object });
            else this.dispatchEvent({ type: 'rotate-start', object: object });
        }
        return true;
    }

    processInteraction(object, mode, axis, mouse, raycaster, startMouse, worldQuaternion) {
        if (!object || !axis) return;
        const pointEnd = new THREE.Vector3();

        if (mode === 'translate' || mode === 'place') {
            let delta = new THREE.Vector3();
            
            if (axis === 'translateX' || axis === 'translateZ') {
                const camDir = new THREE.Vector3().subVectors(this.camera.position, this.startWorldPosition).normalize();
                const localAxis = new THREE.Vector3();
                if (axis === 'translateX') localAxis.set(1,0,0);
                if (axis === 'translateZ') localAxis.set(0,0,1);

                const planeNormal = new THREE.Vector3().crossVectors(localAxis, camDir).cross(localAxis).normalize();
                if (planeNormal.lengthSq() < 0.001) planeNormal.copy(camDir);
                
                const plane = new THREE.Plane(); 
                plane.setFromNormalAndCoplanarPoint(planeNormal, this.startWorldPosition);
                if (!raycaster.ray.intersectPlane(plane, pointEnd)) return;

                const projStart = this.pointStart.clone().sub(this.startWorldPosition).dot(localAxis);
                const projEnd = pointEnd.clone().sub(this.startWorldPosition).dot(localAxis);
                const moveAmount = projEnd - projStart;

                delta.copy(localAxis).multiplyScalar(moveAmount);
            } else {
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.startWorldPosition.y);
                if (!raycaster.ray.intersectPlane(plane, pointEnd)) return;
                delta.subVectors(pointEnd, this.pointStart);
            }

            if (object.parent) {
                const parentInverse = object.parent.matrixWorld.clone().invert();
                const rotMat = new THREE.Matrix4().extractRotation(parentInverse);
                delta.applyMatrix4(rotMat);
            }
            
            let newPos = this.startObjectPosition.clone().add(delta);
            if (mode === 'place' && this.snapEnabled) {
                if (axis === 'translateX') {
                    newPos.x = Math.round(newPos.x / this.snapSize) * this.snapSize;
                } else if (axis === 'translateZ') {
                    newPos.z = Math.round(newPos.z / this.snapSize) * this.snapSize;
                } else {
                    newPos.x = Math.round(newPos.x / this.snapSize) * this.snapSize;
                    newPos.z = Math.round(newPos.z / this.snapSize) * this.snapSize;
                }
            }
            object.position.copy(newPos);

        } else if (mode === 'scale') {
            if (axis.includes('Uniform')) {
                // Uniform scaling: smoothly scale based on combined screen X and Y movement
                const mouseDelta = (mouse.x - startMouse.x) - (mouse.y - startMouse.y);
                let scaleFactor = Math.exp(mouseDelta * 1.5);
                scaleFactor = Math.max(0.01, scaleFactor);
                object.scale.copy(this.startScale).multiplyScalar(scaleFactor);
            } else {
                // Directional scaling: project 3D axis to 2D screen space to ensure perfect stability
                const localAxis = new THREE.Vector3();
                if (axis.includes('X')) localAxis.set(1,0,0);
                if (axis.includes('Y')) localAxis.set(0,1,0);
                if (axis.includes('Z')) localAxis.set(0,0,1);
                
                localAxis.applyQuaternion(worldQuaternion).normalize();
                
                // Get the true 2D direction of the axis on the screen by transforming to camera view space
                const viewAxis = localAxis.clone().transformDirection(this.camera.matrixWorldInverse);
                const dir2D = new THREE.Vector2(viewAxis.x, viewAxis.y);
                
                if (dir2D.lengthSq() < 0.001) {
                    // Fallback if axis is pointing directly at/away from camera
                    dir2D.set(1, 1).normalize();
                } else {
                    dir2D.normalize();
                }
                
                const mouseDelta = new THREE.Vector2(mouse.x - startMouse.x, mouse.y - startMouse.y);
                const screenMovement = mouseDelta.dot(dir2D);
                
                let scaleFactor = Math.exp(screenMovement * 2.5); // Slightly increased sensitivity for better feel
                scaleFactor = Math.max(0.01, scaleFactor);
                
                object.scale.copy(this.startScale);
                if (axis.includes('X')) object.scale.x *= scaleFactor;
                if (axis.includes('Y')) object.scale.y *= scaleFactor;
                if (axis.includes('Z')) object.scale.z *= scaleFactor;
            }
            object.updateMatrix(); 
        } else if (mode === 'rotate') {
            let rotationAngle = 0;
            if (axis === 'X') {
                rotationAngle = -(mouse.y - startMouse.y) * Math.PI * 2;
            } else if (axis === 'Y') {
                rotationAngle = -(mouse.x - startMouse.x) * Math.PI * 2;
            } else if (axis === 'Z') {
                rotationAngle = -(mouse.x - startMouse.x) * Math.PI * 2;
            }

            const euler = new THREE.Euler().setFromQuaternion(this.startObjectQuaternion, 'YXZ');

            if (axis === 'X') {
                euler.x += rotationAngle;
            } else if (axis === 'Y') {
                euler.y += rotationAngle;
            } else if (axis === 'Z') {
                euler.z += rotationAngle;
            }

            if (this.rotationSnap) {
                const snapRad = THREE.MathUtils.degToRad(this.rotationSnap);
                if (axis === 'X') euler.x = Math.round(euler.x / snapRad) * snapRad;
                if (axis === 'Y') euler.y = Math.round(euler.y / snapRad) * snapRad;
                if (axis === 'Z') euler.z = Math.round(euler.z / snapRad) * snapRad;
            }
            
            object.quaternion.setFromEuler(euler);
        }

        // Dispatch specific change events
        if (mode === 'translate' || mode === 'place') {
            this.dispatchEvent({ type: 'move-change' });
        } else if (mode === 'scale') {
            this.dispatchEvent({ type: 'scale-change' });
        } else if (mode === 'rotate') {
            if (axis === 'Y') this.dispatchEvent({ type: 'spin-change' });
            else if (axis === 'X') this.dispatchEvent({ type: 'tilt-change' });
            else this.dispatchEvent({ type: 'rotate-change' });
        }
    }

    endInteraction(object, mode, axis) {
        if (!object || !axis) return;
        if (mode === 'translate' || mode === 'place') this.dispatchEvent({ type: 'move-end', object: object });
        else if (mode === 'scale') this.dispatchEvent({ type: 'scale-end', object: object });
        else if (mode === 'rotate') {
            this.dispatchEvent({ type: 'rotate-end', object: object });
        }
    }
}

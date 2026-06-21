import * as THREE from 'three';

const GIZMO_COLOR_X = 0xff5555;
const GIZMO_COLOR_Y = 0x55ff55;
const GIZMO_COLOR_Z = 0x5555ff;
const GIZMO_COLOR_HOVER = 0xffff00;

export class TransformControls extends THREE.Group {
    constructor(camera, domElement) {
        super();
        this.camera = camera;
        this.domElement = domElement;
        this.object = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.active = false;
        this.axis = null;
        this.hoveredAxis = null;
        
        this.mode = 'rotate';
        this.showX = true;
        this.showY = true;
        this.showZ = true;
        this.snapEnabled = true;
        this.snapSize = 20; // Matches GRID in registry.js

        this.rotationSnap = null;

        this.worldPosition = new THREE.Vector3();
        this.worldQuaternion = new THREE.Quaternion();
        this.worldScale = new THREE.Vector3();

        this.parentQuaternion = new THREE.Quaternion();
        this.parentScale = new THREE.Vector3();

        this.pointStart = new THREE.Vector3();
        this.pointEnd = new THREE.Vector3();
        this.rotationAxis = new THREE.Vector3();
        this.rotationAngle = 0;
        this.startRotationMatrix = new THREE.Matrix4();
        this.startObjectQuaternion = new THREE.Quaternion();
        this.startObjectPosition = new THREE.Vector3();
        this.startScale = new THREE.Vector3();
        this.startWorldPosition = new THREE.Vector3();

        this.cameraPosition = new THREE.Vector3();
        this.cameraQuaternion = new THREE.Quaternion();
        this.cameraScale = new THREE.Vector3();

        this.eye = new THREE.Vector3();

        this.gizmo = new THREE.Group();
        this.handles = new THREE.Group();
        this.gizmo.add(this.handles);

        this.guideMat = new THREE.LineBasicMaterial({ color: GIZMO_COLOR_HOVER, depthTest: false, depthWrite: false, transparent: true, opacity: 0.4 });
        this.guideX = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-10000, 0, 0), new THREE.Vector3(10000, 0, 0)]), this.guideMat);
        this.guideY = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -10000, 0), new THREE.Vector3(0, 10000, 0)]), this.guideMat);
        this.guideZ = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -10000), new THREE.Vector3(0, 0, 10000)]), this.guideMat);
        this.guideX.visible = false; this.guideY.visible = false; this.guideZ.visible = false;
        
        this.axisGuide = new THREE.Group();
        this.axisGuide.add(this.guideX, this.guideY, this.guideZ);
        this.axisGuide.renderOrder = 998;
        this.add(this.axisGuide);
        this.add(this.gizmo);

        this.createHandles();

        // Event listeners
        this.onPointerHover = this.onPointerHover.bind(this);
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);

        this.domElement.addEventListener('pointermove', this.onPointerHover, { capture: true });
        this.domElement.addEventListener('pointerdown', this.onPointerDown, { passive: false, capture: true });
    }

    createHandles() {
        // Thicker, easily clickable 3D Torus geometry for ALL rotation rings
        const ringGeometry = new THREE.TorusGeometry(1, 0.25, 16, 64);

        // Y-axis (Green, Spin: horizontal on ground, rotates around Y)
        const rotateY = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: GIZMO_COLOR_Y, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }));
        rotateY.rotation.set(-Math.PI / 2, 0, 0); // Horizontal on ground
        rotateY.name = 'Y';
        rotateY.userData = { defaultColor: GIZMO_COLOR_Y, defaultOpacity: 0.6 };
        rotateY.renderOrder = 999;
        this.handles.add(rotateY);

        // X-axis (Red, Tilt: vertical facing X, rotates around X)
        const rotateX = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: GIZMO_COLOR_X, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }));
        rotateX.rotation.set(0, Math.PI / 2, 0); // Faces X
        rotateX.name = 'X';
        rotateX.userData = { defaultColor: GIZMO_COLOR_X, defaultOpacity: 0.6 };
        rotateX.renderOrder = 999;
        this.handles.add(rotateX);


        // Move Handle (XZ plane disc + arrows)
        const moveGroup = new THREE.Group();
        moveGroup.name = 'translate';
        
        const movePlane = new THREE.Mesh(
            new THREE.CircleGeometry(1.2, 32),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
        );
        movePlane.rotation.x = -Math.PI / 2;
        movePlane.name = 'translateXZ';
        movePlane.userData = { defaultColor: 0xffffff, defaultOpacity: 0.2 };
        moveGroup.add(movePlane);

        const createArrow = (color, rotY, axisName) => {
            const arrowGroup = new THREE.Group();
            arrowGroup.rotation.y = rotY;
            const mat = new THREE.MeshBasicMaterial({ color: color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7), mat); // Thicker shaft
            shaft.rotation.x = Math.PI / 2;
            shaft.position.z = 0.45;
            shaft.name = axisName;
            shaft.userData = { defaultColor: color, defaultOpacity: 0.9 };
            shaft.renderOrder = 999;
            const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 12), mat); // Thicker head
            head.rotation.x = Math.PI / 2;
            head.position.z = 0.9;
            head.name = axisName;
            head.userData = { defaultColor: color, defaultOpacity: 0.9 };
            head.renderOrder = 999;

            arrowGroup.add(shaft, head);
            return arrowGroup;
        };

        moveGroup.add(createArrow(GIZMO_COLOR_X, Math.PI / 2, 'translateX')); // X
        moveGroup.add(createArrow(GIZMO_COLOR_X, -Math.PI / 2, 'translateX')); // -X
        moveGroup.add(createArrow(GIZMO_COLOR_Z, 0, 'translateZ')); // Z
        moveGroup.add(createArrow(GIZMO_COLOR_Z, Math.PI, 'translateZ')); // -Z
        
        const gizmoGrid = new THREE.GridHelper(100, 10, 0x3b82f6, 0xffffff);
        gizmoGrid.material.transparent = true;
        gizmoGrid.material.opacity = 0.3;
        gizmoGrid.material.depthWrite = false;
        gizmoGrid.material.depthTest = false;
        gizmoGrid.renderOrder = 998;
        gizmoGrid.name = 'gizmoGrid';
        moveGroup.add(gizmoGrid);

        this.handles.add(moveGroup);

        // Scale Handles
        const scaleGroup = new THREE.Group();
        scaleGroup.name = 'scale';

        const createScaleHandle = (color, rotX, rotY, rotZ, name) => {
            const handleGroup = new THREE.Group();
            handleGroup.rotation.set(rotX, rotY, rotZ);
            const mat = new THREE.MeshBasicMaterial({ color: color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7), mat); // Thicker shaft
            shaft.rotation.x = Math.PI / 2;
            shaft.position.z = 0.45;
            shaft.name = name;
            shaft.userData = { defaultColor: color, defaultOpacity: 0.9 };
            shaft.renderOrder = 999;
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat); // Thicker head
            head.position.z = 0.9;
            head.name = name;
            head.userData = { defaultColor: color, defaultOpacity: 0.9 };
            head.renderOrder = 999;

            handleGroup.add(shaft, head);
            return handleGroup;
        };
        scaleGroup.add(createScaleHandle(GIZMO_COLOR_X, 0, Math.PI / 2, 0, 'scaleX'));
        scaleGroup.add(createScaleHandle(GIZMO_COLOR_Y, -Math.PI / 2, 0, 0, 'scaleY'));
        scaleGroup.add(createScaleHandle(GIZMO_COLOR_Z, 0, 0, 0, 'scaleZ'));
        
        const uniformMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
        const uniformScale = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), uniformMat);
        uniformScale.name = 'scaleUniform';
        uniformScale.userData = { defaultColor: 0xffffff, defaultOpacity: 0.9 };
        uniformScale.renderOrder = 999;
        
        scaleGroup.add(uniformScale);
        
        this.handles.add(scaleGroup);
    }

    attach(object) {
        this.object = object;
        this.visible = true;
        this.update();
    }

    detach() {
        this.object = null;
        this.visible = false;
        this.axis = null;
        this.hoveredAxis = null;
        this.updateHighlight();
    }

    update() {
        if (this.object === null) return;

        if (this.handles) {
            this.handles.children.forEach(child => {
                if (this.mode === 'translate' || this.mode === 'place') {
                    child.visible = child.name === 'translate';
                    if (child.name === 'translate') {
                        child.children.forEach(c => {
                            if (c.name === 'gizmoGrid') c.visible = (this.mode === 'place');
                        });
                    }
                } else if (this.mode === 'scale') {
                    child.visible = child.name === 'scale';
                } else {
                    if (child.name === 'translate') child.visible = false;
                    if (child.name === 'scale') child.visible = false;
                    if (child.name === 'X') child.visible = !!this.showX;
                    if (child.name === 'Y') child.visible = !!this.showY;
                }
            });
        }

        this.object.updateWorldMatrix(true, false);
        this.object.matrixWorld.decompose(this.worldPosition, this.worldQuaternion, this.worldScale);
        this.position.copy(this.worldPosition);

        // Align scale handles visually to match the object's local rotation
        if (this.handles) {
            const scaleGroup = this.handles.getObjectByName('scale');
            if (scaleGroup) scaleGroup.quaternion.copy(this.worldQuaternion);
        }

        // Scale gizmo to be a consistent size on screen
        const camDistance = this.worldPosition.distanceTo(this.camera.position);
        const scale = camDistance / 7; // Adjust this factor for desired screen size
        this.scale.set(scale, scale, scale);
        
        // Update axis guide line
        if (this.active && this.axis) {
            this.guideX.visible = (this.axis === 'translateX' || this.axis === 'scaleX');
            this.guideY.visible = (this.axis === 'scaleY');
            this.guideZ.visible = (this.axis === 'translateZ' || this.axis === 'scaleZ');
            
            if (this.axis.startsWith('scale')) this.axisGuide.quaternion.copy(this.worldQuaternion);
            else this.axisGuide.quaternion.identity();
        } else {
            this.guideX.visible = false;
            this.guideY.visible = false;
            this.guideZ.visible = false;
        }
    }

    createGhost() {
        if (!this.object) return;
        
        // Backup userData to prevent circular structure errors during Three.js clone()
        const userDataBackup = new Map();
        this.object.traverse(c => {
            userDataBackup.set(c, c.userData);
            c.userData = {};
        });
        
        this.ghost = this.object.clone();
        
        this.object.traverse(c => {
            c.userData = userDataBackup.get(c);
        });
        
        this.ghost.traverse(c => {
            if (c.isMesh) {
                c.material = Array.isArray(c.material) ? c.material.map(m => m.clone()) : c.material.clone();
                const mats = Array.isArray(c.material) ? c.material : [c.material];
                mats.forEach(m => { m.transparent = true; m.opacity = 0.3; m.depthWrite = false; });
            }
        });
        if (this.object.parent) this.object.parent.add(this.ghost);
    }

    removeGhost() {
        if (this.ghost) {
            if (this.ghost.parent) this.ghost.parent.remove(this.ghost);
            this.ghost = null;
        }
    }

    onPointerHover(event) {
        if (!this.visible || this.active || this.object === null) return;
        this.updateMouse(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.handles.children, true).filter(hit => hit.object.visible);
        let foundAxis = null;
        if (intersects.length > 0) {
            foundAxis = intersects[0].object.name;
        }
        if (this.hoveredAxis !== foundAxis) {
            this.hoveredAxis = foundAxis;
            this.updateHighlight();
            this.domElement.style.cursor = foundAxis ? 'pointer' : 'auto';
        }
    }

    updateHighlight() {
        const activeAxis = this.active ? this.axis : this.hoveredAxis;
        this.handles.traverse(child => {
            if (child.isMesh && child.name && child.userData.defaultColor !== undefined) {
                if (child.name === activeAxis) {
                    child.material.color.setHex(GIZMO_COLOR_HOVER);
                    child.material.opacity = child.name === 'translateXZ' ? 0.5 : 1.0;
                } else {
                    child.material.color.setHex(child.userData.defaultColor);
                    child.material.opacity = child.userData.defaultOpacity;
                }
            }
        });
    }

    onPointerDown(event) {
        if (this.object === null || this.active === true || !this.visible) return;

        this.updateMouse(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.handles.children, true).filter(hit => hit.object.visible);

        if (intersects.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation(); // Kills OrbitControls/InteractionSystem events

            this.axis = intersects[0].object.name;
            if (!this.axis) return;
            this.active = true;
            this.activePointerId = event.pointerId;
            this.updateHighlight();
            this.update();
            this.startWorldPosition.copy(this.worldPosition);

            if (this.mode === 'translate' || this.mode === 'place') this.dispatchEvent({ type: 'move-start', object: this.object });
            else if (this.mode === 'scale') this.dispatchEvent({ type: 'scale-start', object: this.object });
            else if (this.mode === 'rotate') {
                if (this.axis === 'Y') this.dispatchEvent({ type: 'spin-start', object: this.object });
                else if (this.axis === 'X') this.dispatchEvent({ type: 'tilt-start', object: this.object });
                else this.dispatchEvent({ type: 'rotate-start', object: this.object });
            }

            if (this.mode === 'translate' || this.mode === 'place') {
                if (this.axis === 'translateX' || this.axis === 'translateZ') {
                    const camDir = new THREE.Vector3().subVectors(this.camera.position, this.worldPosition).normalize();
                    const localAxis = new THREE.Vector3();
                    if (this.axis === 'translateX') localAxis.set(1,0,0);
                    if (this.axis === 'translateZ') localAxis.set(0,0,1);
                    
                    const planeNormal = new THREE.Vector3().crossVectors(localAxis, camDir).cross(localAxis).normalize();
                    if (planeNormal.lengthSq() < 0.001) planeNormal.copy(camDir);
                    
                    const plane = new THREE.Plane();
                    plane.setFromNormalAndCoplanarPoint(planeNormal, this.worldPosition);
                    this.raycaster.ray.intersectPlane(plane, this.pointStart);
                } else {
                    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.worldPosition.y);
                    this.raycaster.ray.intersectPlane(plane, this.pointStart);
                }
                this.startObjectPosition.copy(this.object.position);
                if (this.mode === 'place') this.createGhost();
            } else if (this.mode === 'scale') {
                const camDir = new THREE.Vector3().subVectors(this.camera.position, this.worldPosition).normalize();
                if (this.axis === 'scaleUniform') {
                    const planeNormal = camDir.clone();
                    const plane = new THREE.Plane(); plane.setFromNormalAndCoplanarPoint(planeNormal, this.worldPosition);
                    if (this.raycaster.ray.intersectPlane(plane, this.pointStart)) {
                        this.startScale.copy(this.object.scale);
                    }
                } else {
                const localAxis = new THREE.Vector3();
                if (this.axis === 'scaleX') localAxis.set(1,0,0);
                if (this.axis === 'scaleY') localAxis.set(0,1,0);
                if (this.axis === 'scaleZ') localAxis.set(0,0,1);
                localAxis.applyQuaternion(this.worldQuaternion).normalize();
                const planeNormal = new THREE.Vector3().crossVectors(localAxis, camDir).cross(localAxis).normalize();
                if (planeNormal.lengthSq() < 0.001) planeNormal.copy(camDir);
                const plane = new THREE.Plane(); plane.setFromNormalAndCoplanarPoint(planeNormal, this.worldPosition);
                    if (this.raycaster.ray.intersectPlane(plane, this.pointStart)) {
                        this.startScale.copy(this.object.scale);
                    }
                }
            } else {
                const plane = new THREE.Plane();
                this.rotationAxis.set(0,0,0);
                if (this.axis === 'X') this.rotationAxis.set(1,0,0); // Tilt (Local X)
                if (this.axis === 'Y') this.rotationAxis.set(0,1,0); // Spin (Local Y)
                if (this.axis === 'Z') this.rotationAxis.set(0,0,1); // Roll (Local Z)

                plane.setFromNormalAndCoplanarPoint(this.rotationAxis, this.worldPosition);
                this.raycaster.ray.intersectPlane(plane, this.pointStart);
                this.startObjectQuaternion.copy(this.object.quaternion);
            }

            this.startMouseX = this.mouse.x;
            this.startMouseY = this.mouse.y;

            this.domElement.addEventListener('pointermove', this.onPointerMove, { passive: false, capture: true });
            this.domElement.addEventListener('pointerup', this.onPointerUp, { passive: false, capture: true });
        }
    }

    onPointerMove(event) {
        if (this.object === null || this.axis === null || this.active === false) return;
        if (event.pointerId !== this.activePointerId) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        this.updateMouse(event);
        
        if (this.mode === 'translate' || this.mode === 'place') {
            let delta = new THREE.Vector3();
            
            if (this.axis === 'translateX' || this.axis === 'translateZ') {
                const camDir = new THREE.Vector3().subVectors(this.camera.position, this.startWorldPosition).normalize();
                const localAxis = new THREE.Vector3();
                if (this.axis === 'translateX') localAxis.set(1,0,0);
                if (this.axis === 'translateZ') localAxis.set(0,0,1);

                const planeNormal = new THREE.Vector3().crossVectors(localAxis, camDir).cross(localAxis).normalize();
                if (planeNormal.lengthSq() < 0.001) planeNormal.copy(camDir);
                
                const plane = new THREE.Plane(); 
                plane.setFromNormalAndCoplanarPoint(planeNormal, this.startWorldPosition);
                this.raycaster.setFromCamera(this.mouse, this.camera);
                if (!this.raycaster.ray.intersectPlane(plane, this.pointEnd)) return;

                const projStart = this.pointStart.clone().sub(this.startWorldPosition).dot(localAxis);
                const projEnd = this.pointEnd.clone().sub(this.startWorldPosition).dot(localAxis);
                const moveAmount = projEnd - projStart;

                delta.copy(localAxis).multiplyScalar(moveAmount);
            } else {
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.startWorldPosition.y);
                this.raycaster.setFromCamera(this.mouse, this.camera);
                if (!this.raycaster.ray.intersectPlane(plane, this.pointEnd)) return;
                delta.subVectors(this.pointEnd, this.pointStart);
            }

            // Convert world delta to local delta to handle house rotations correctly
            if (this.object.parent) {
                const parentInverse = this.object.parent.matrixWorld.clone().invert();
                const rotMat = new THREE.Matrix4().extractRotation(parentInverse);
                delta.applyMatrix4(rotMat);
            }
            
            let newPos = this.startObjectPosition.clone().add(delta);
            if (this.mode === 'place' && this.snapEnabled) {
                if (this.axis === 'translateX') {
                    newPos.x = Math.round(newPos.x / this.snapSize) * this.snapSize;
                } else if (this.axis === 'translateZ') {
                    newPos.z = Math.round(newPos.z / this.snapSize) * this.snapSize;
                } else {
                    newPos.x = Math.round(newPos.x / this.snapSize) * this.snapSize;
                    newPos.z = Math.round(newPos.z / this.snapSize) * this.snapSize;
                }
            }
            this.object.position.copy(newPos);
        } else if (this.mode === 'scale') {
            const camDir = new THREE.Vector3().subVectors(this.camera.position, this.startWorldPosition).normalize();
            if (this.axis === 'scaleUniform') {
                const planeNormal = camDir.clone();
                const plane = new THREE.Plane(); plane.setFromNormalAndCoplanarPoint(planeNormal, this.startWorldPosition);
                this.raycaster.setFromCamera(this.mouse, this.camera);
                if (!this.raycaster.ray.intersectPlane(plane, this.pointEnd)) return;
                
                const dStart = this.pointStart.distanceTo(this.startWorldPosition);
                const dEnd = this.pointEnd.distanceTo(this.startWorldPosition);
                if (Math.abs(dStart) > 0.01) {
                    const scaleFactor = Math.max(0.1, dEnd / dStart);
                    this.object.scale.copy(this.startScale).multiplyScalar(scaleFactor);
                }
            } else {
                const localAxis = new THREE.Vector3();
                if (this.axis === 'scaleX') localAxis.set(1,0,0);
                if (this.axis === 'scaleY') localAxis.set(0,1,0);
                if (this.axis === 'scaleZ') localAxis.set(0,0,1);
                localAxis.applyQuaternion(this.worldQuaternion).normalize();
                const planeNormal = new THREE.Vector3().crossVectors(localAxis, camDir).cross(localAxis).normalize();
                if (planeNormal.lengthSq() < 0.001) planeNormal.copy(camDir);
                
                const plane = new THREE.Plane(); plane.setFromNormalAndCoplanarPoint(planeNormal, this.startWorldPosition);
                this.raycaster.setFromCamera(this.mouse, this.camera);
                if (!this.raycaster.ray.intersectPlane(plane, this.pointEnd)) return;

                const dStart = this.pointStart.clone().sub(this.startWorldPosition).dot(localAxis);
                const dEnd = this.pointEnd.clone().sub(this.startWorldPosition).dot(localAxis);
                if (Math.abs(dStart) > 0.01) {
                    const scaleFactor = Math.max(0.1, dEnd / dStart); // Restrict shrinking past 10%
                    this.object.scale.copy(this.startScale);
                    if (this.axis === 'scaleX') this.object.scale.x *= scaleFactor;
                    if (this.axis === 'scaleY') this.object.scale.y *= scaleFactor;
                    if (this.axis === 'scaleZ') this.object.scale.z *= scaleFactor;
                }
            }
        } else {
            if (this.axis === 'X') {
                this.rotationAngle = -(this.mouse.y - this.startMouseY) * Math.PI * 2;
            } else if (this.axis === 'Y') {
                this.rotationAngle = -(this.mouse.x - this.startMouseX) * Math.PI * 2;
            } else if (this.axis === 'Z') {
                this.rotationAngle = -(this.mouse.x - this.startMouseX) * Math.PI * 2;
            }

            const euler = new THREE.Euler().setFromQuaternion(this.startObjectQuaternion, 'YXZ');

            if (this.axis === 'X') {
                euler.x += this.rotationAngle;
            } else if (this.axis === 'Y') {
                euler.y += this.rotationAngle;
            } else if (this.axis === 'Z') {
                euler.z += this.rotationAngle;
            }

            if (this.rotationSnap) {
                const snapRad = THREE.MathUtils.degToRad(this.rotationSnap);
                if (this.axis === 'X') euler.x = Math.round(euler.x / snapRad) * snapRad;
                if (this.axis === 'Y') euler.y = Math.round(euler.y / snapRad) * snapRad;
                if (this.axis === 'Z') euler.z = Math.round(euler.z / snapRad) * snapRad;
            }
            
            this.object.quaternion.setFromEuler(euler);
        }

        this.update();

        // Dispatch specific events to prevent confusion
        if (this.mode === 'translate' || this.mode === 'place') {
            this.dispatchEvent({ type: 'move-change' });
        } else if (this.mode === 'scale') {
            this.dispatchEvent({ type: 'scale-change' });
        } else if (this.mode === 'rotate') {
            if (this.axis === 'Y') this.dispatchEvent({ type: 'spin-change' });
            else if (this.axis === 'X') this.dispatchEvent({ type: 'tilt-change' });
            else this.dispatchEvent({ type: 'rotate-change' });
        }
    }

    onPointerUp(event) {
        if (this.active) {
            if (event.pointerId !== this.activePointerId) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }

        this.active = false;
        this.activePointerId = null;
        this.axis = null;
        this.updateHighlight();
        this.update(); // Refresh guide visibility

        if (this.mode === 'translate' || this.mode === 'place') this.dispatchEvent({ type: 'move-end', object: this.object });
        else if (this.mode === 'scale') this.dispatchEvent({ type: 'scale-end', object: this.object });
        else if (this.mode === 'rotate') {
            // Previous axis state is nullified above, but we can assume generic rotate-end if we want, 
            // but we cleared this.axis! Let's just dispatch rotate-end.
            this.dispatchEvent({ type: 'rotate-end', object: this.object });
        }

        if (this.mode === 'place') {
            this.removeGhost();
        }

        this.domElement.removeEventListener('pointermove', this.onPointerMove, { capture: true });
        this.domElement.removeEventListener('pointerup', this.onPointerUp, { capture: true });
    }

    updateMouse(event) {
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    dispose() {
        this.domElement.removeEventListener('pointermove', this.onPointerHover, { capture: true });
        this.domElement.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
        this.domElement.removeEventListener('pointermove', this.onPointerMove, { capture: true });
        this.domElement.removeEventListener('pointerup', this.onPointerUp, { capture: true });
        this.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
}
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
        
        this.mode = 'rotate';
        this.showX = true;
        this.showY = true;
        this.showZ = true;

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

        this.cameraPosition = new THREE.Vector3();
        this.cameraQuaternion = new THREE.Quaternion();
        this.cameraScale = new THREE.Vector3();

        this.eye = new THREE.Vector3();

        this.gizmo = new THREE.Group();
        this.handles = new THREE.Group();
        this.gizmo.add(this.handles);
        this.add(this.gizmo);

        this.createHandles();

        // Event listeners
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);

        this.domElement.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    }

    createHandles() {
        const ringGeometry = new THREE.TorusGeometry(1, 0.02, 16, 100);
        const floorDiscGeometry = new THREE.RingGeometry(1.1, 1.3, 64);

        // Y-axis (Floor Disc)
        const rotateY = new THREE.Mesh(floorDiscGeometry, new THREE.MeshBasicMaterial({ color: GIZMO_COLOR_Y, side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }));
        rotateY.rotation.x = -Math.PI / 2;
        rotateY.name = 'Y';
        rotateY.renderOrder = 999;
        this.handles.add(rotateY);

        // X-axis ring
        const rotateX = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: GIZMO_COLOR_X, side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }));
        rotateX.rotation.y = Math.PI / 2;
        rotateX.name = 'X';
        rotateX.renderOrder = 999;
        this.handles.add(rotateX);

        // Z-axis ring
        const rotateZ = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: GIZMO_COLOR_Z, side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }));
        rotateZ.rotation.x = Math.PI / 2;
        rotateZ.name = 'Z';
        rotateZ.renderOrder = 999;
        this.handles.add(rotateZ);

        // Move Handle (XZ plane disc + arrows)
        const moveGroup = new THREE.Group();
        moveGroup.name = 'XZ';
        
        const movePlane = new THREE.Mesh(
            new THREE.CircleGeometry(1.2, 32),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
        );
        movePlane.rotation.x = -Math.PI / 2;
        movePlane.name = 'XZ';
        moveGroup.add(movePlane);

        const createArrow = (color, rotY) => {
            const arrowGroup = new THREE.Group();
            arrowGroup.rotation.y = rotY;
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6), new THREE.MeshBasicMaterial({ color: color, depthTest: false }));
            shaft.rotation.x = Math.PI / 2;
            shaft.position.z = 0.4;
            shaft.name = 'XZ';
            const head = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 8), new THREE.MeshBasicMaterial({ color: color, depthTest: false }));
            head.rotation.x = Math.PI / 2;
            head.position.z = 0.7;
            head.name = 'XZ';
            arrowGroup.add(shaft, head);
            return arrowGroup;
        };

        moveGroup.add(createArrow(GIZMO_COLOR_X, Math.PI / 2)); // X
        moveGroup.add(createArrow(GIZMO_COLOR_X, -Math.PI / 2)); // -X
        moveGroup.add(createArrow(GIZMO_COLOR_Z, 0)); // Z
        moveGroup.add(createArrow(GIZMO_COLOR_Z, Math.PI)); // -Z
        
        this.handles.add(moveGroup);
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
    }

    update() {
        if (this.object === null) return;

        if (this.handles) {
            this.handles.children.forEach(child => {
                if (this.mode === 'translate') {
                    child.visible = child.name === 'XZ';
                } else {
                    if (child.name === 'X') child.visible = !!this.showX;
                    if (child.name === 'Y') child.visible = !!this.showY;
                    if (child.name === 'Z') child.visible = !!this.showZ;
                    if (child.name === 'XZ') child.visible = false;
                }
            });
        }

        this.object.updateWorldMatrix(true, false);
        this.object.matrixWorld.decompose(this.worldPosition, this.worldQuaternion, this.worldScale);
        this.position.copy(this.worldPosition);

        // Scale gizmo to be a consistent size on screen
        const camDistance = this.worldPosition.distanceTo(this.camera.position);
        const scale = camDistance / 7; // Adjust this factor for desired screen size
        this.scale.set(scale, scale, scale);
    }

    onPointerDown(event) {
        if (this.object === null || this.active === true || !this.visible) return;

        this.updateMouse(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.handles.children, true);

        if (intersects.length > 0) {
            event.preventDefault();
            event.stopPropagation();

            this.axis = intersects[0].object.name;
            if (!this.axis) return;
            this.active = true;
            this.dispatchEvent({ type: 'dragstart', object: this.object });

            if (this.mode === 'translate') {
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.worldPosition.y);
                this.raycaster.ray.intersectPlane(plane, this.pointStart);
                this.startObjectPosition.copy(this.object.position);
            } else {
                const plane = new THREE.Plane();
                this.rotationAxis.set(0,0,0);
                if (this.axis === 'X') this.rotationAxis.set(1,0,0);
                if (this.axis === 'Y') this.rotationAxis.set(0,1,0);
                if (this.axis === 'Z') this.rotationAxis.set(0,0,1);

                plane.setFromNormalAndCoplanarPoint(this.rotationAxis, this.worldPosition);
                this.raycaster.ray.intersectPlane(plane, this.pointStart);
                this.startObjectQuaternion.copy(this.object.quaternion);
            }

            this.domElement.addEventListener('pointermove', this.onPointerMove, { passive: false });
            this.domElement.addEventListener('pointerup', this.onPointerUp, { passive: false });
        }
    }

    onPointerMove(event) {
        if (this.object === null || this.axis === null || this.active === false) return;

        event.preventDefault();
        event.stopPropagation();

        this.updateMouse(event);
        
        if (this.mode === 'translate') {
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.worldPosition.y);
            this.raycaster.setFromCamera(this.mouse, this.camera);
            if (!this.raycaster.ray.intersectPlane(plane, this.pointEnd)) return;

            const delta = new THREE.Vector3().subVectors(this.pointEnd, this.pointStart);
            this.object.position.copy(this.startObjectPosition).add(delta);
        } else {
            const plane = new THREE.Plane();
            plane.setFromNormalAndCoplanarPoint(this.rotationAxis, this.worldPosition);
            this.raycaster.setFromCamera(this.mouse, this.camera);
            if (!this.raycaster.ray.intersectPlane(plane, this.pointEnd)) return;

            const vStart = this.pointStart.clone().sub(this.worldPosition);
            const vEnd = this.pointEnd.clone().sub(this.worldPosition);

            this.rotationAngle = vEnd.angleTo(vStart);

            const cross = vStart.clone().cross(vEnd);
            if (this.rotationAxis.dot(cross) < 0) {
                this.rotationAngle *= -1;
            }

            const tempQuaternion = new THREE.Quaternion();
            tempQuaternion.setFromAxisAngle(this.rotationAxis, this.rotationAngle);
            
            const newQuaternion = this.startObjectQuaternion.clone().multiply(tempQuaternion);

            if (this.rotationSnap) {
                const euler = new THREE.Euler().setFromQuaternion(newQuaternion, 'YXZ');
                const snapRad = THREE.MathUtils.degToRad(this.rotationSnap);
                if (this.axis === 'X') euler.x = Math.round(euler.x / snapRad) * snapRad;
                if (this.axis === 'Y') euler.y = Math.round(euler.y / snapRad) * snapRad;
                if (this.axis === 'Z') euler.z = Math.round(euler.z / snapRad) * snapRad;
                this.object.quaternion.setFromEuler(euler);
            } else {
                this.object.quaternion.copy(newQuaternion);
            }
        }

        this.update();
        this.dispatchEvent({ type: 'change' });
    }

    onPointerUp(event) {
        if (this.active) {
            event.preventDefault();
            event.stopPropagation();
        }

        this.active = false;
        this.axis = null;
        this.dispatchEvent({ type: 'dragend', object: this.object });

        this.domElement.removeEventListener('pointermove', this.onPointerMove);
        this.domElement.removeEventListener('pointerup', this.onPointerUp);
    }

    updateMouse(event) {
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    dispose() {
        this.domElement.removeEventListener('pointerdown', this.onPointerDown);
        this.domElement.removeEventListener('pointermove', this.onPointerMove);
        this.domElement.removeEventListener('pointerup', this.onPointerUp);
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
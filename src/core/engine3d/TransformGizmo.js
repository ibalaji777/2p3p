import * as THREE from 'three';

export const GIZMO_COLOR_X = 0xff5555;
export const GIZMO_COLOR_Y = 0x55ff55;
export const GIZMO_COLOR_Z = 0x5555ff;
export const GIZMO_COLOR_HOVER = 0xffff00;

export class TransformGizmo extends THREE.Group {
    constructor() {
        super();
        this.handles = new THREE.Group();
        this.add(this.handles);

        this.guideMat = new THREE.LineBasicMaterial({ color: GIZMO_COLOR_HOVER, depthTest: false, depthWrite: false, transparent: true, opacity: 0.4 });
        this.guideX = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-10000, 0, 0), new THREE.Vector3(10000, 0, 0)]), this.guideMat);
        this.guideY = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -10000, 0), new THREE.Vector3(0, 10000, 0)]), this.guideMat);
        this.guideZ = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -10000), new THREE.Vector3(0, 0, 10000)]), this.guideMat);
        this.guideX.visible = false; this.guideY.visible = false; this.guideZ.visible = false;
        
        this.axisGuide = new THREE.Group();
        this.axisGuide.add(this.guideX, this.guideY, this.guideZ);
        this.axisGuide.renderOrder = 998;
        this.add(this.axisGuide);

        this.createHandles();
    }

    createHandles() {
        const visibleRingGeo = new THREE.TorusGeometry(1, 0.03, 16, 64);
        const hitRingGeo = new THREE.TorusGeometry(1, 0.3, 16, 64);
        const discGeometry = new THREE.CircleGeometry(1, 64);
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

        // Y-axis (Spin)
        const rotateYGroup = new THREE.Group();
        rotateYGroup.name = 'Y';
        rotateYGroup.rotation.set(-Math.PI / 2, 0, 0); 
        
        const visY = new THREE.Mesh(visibleRingGeo, new THREE.MeshBasicMaterial({ color: GIZMO_COLOR_Y, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }));
        visY.name = 'Y';
        visY.userData = { defaultColor: GIZMO_COLOR_Y, defaultOpacity: 0.6 };
        visY.renderOrder = 999;
        
        const discY = new THREE.Mesh(discGeometry, new THREE.MeshBasicMaterial({ color: GIZMO_COLOR_Y, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
        discY.name = 'Y';
        discY.userData = { defaultColor: GIZMO_COLOR_Y, defaultOpacity: 0.4, hoverOpacity: 0.7 };
        discY.renderOrder = 998;

        const hitY = new THREE.Mesh(hitRingGeo, hitMat);
        hitY.name = 'Y'; 
        
        rotateYGroup.add(visY, discY, hitY);
        this.handles.add(rotateYGroup);

        // X-axis (Tilt)
        const rotateXGroup = new THREE.Group();
        rotateXGroup.name = 'X';
        rotateXGroup.rotation.set(0, Math.PI / 2, 0);
        
        const visX = new THREE.Mesh(visibleRingGeo, new THREE.MeshBasicMaterial({ color: GIZMO_COLOR_X, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }));
        visX.name = 'X';
        visX.userData = { defaultColor: GIZMO_COLOR_X, defaultOpacity: 0.6 };
        visX.renderOrder = 999;
        
        const discX = new THREE.Mesh(discGeometry, new THREE.MeshBasicMaterial({ color: GIZMO_COLOR_X, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
        discX.name = 'X';
        discX.userData = { defaultColor: GIZMO_COLOR_X, defaultOpacity: 0.4, hoverOpacity: 0.7 };
        discX.renderOrder = 998;

        const hitX = new THREE.Mesh(hitRingGeo, hitMat);
        hitX.name = 'X'; 
        
        rotateXGroup.add(visX, discX, hitX);
        this.handles.add(rotateXGroup);

        // Move Handle
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
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7), mat); 
            shaft.rotation.x = Math.PI / 2;
            shaft.position.z = 0.45;
            shaft.name = axisName;
            shaft.userData = { defaultColor: color, defaultOpacity: 0.9 };
            shaft.renderOrder = 999;
            const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 12), mat); 
            head.rotation.x = Math.PI / 2;
            head.position.z = 0.9;
            head.name = axisName;
            head.userData = { defaultColor: color, defaultOpacity: 0.9 };
            head.renderOrder = 999;
            arrowGroup.add(shaft, head);
            return arrowGroup;
        };

        moveGroup.add(createArrow(GIZMO_COLOR_X, Math.PI / 2, 'translateX'));
        moveGroup.add(createArrow(GIZMO_COLOR_X, -Math.PI / 2, 'translateX'));
        moveGroup.add(createArrow(GIZMO_COLOR_Z, 0, 'translateZ'));
        moveGroup.add(createArrow(GIZMO_COLOR_Z, Math.PI, 'translateZ'));
        
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

        const createScaleHandle = (color, axisName, rotX, rotY, rotZ) => {
            const group = new THREE.Group();
            group.name = axisName + '_group';
            group.rotation.set(rotX, rotY, rotZ);
            
            const mat = new THREE.MeshBasicMaterial({ color: color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), mat);
            handle.position.z = 0.9;
            handle.name = axisName;
            handle.userData = { defaultColor: color, defaultOpacity: 0.9, hoverOpacity: 1.0 };
            handle.renderOrder = 999;
            
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8), mat);
            shaft.rotation.x = Math.PI / 2;
            shaft.position.z = 0.45;
            shaft.name = axisName + '_shaft';
            shaft.renderOrder = 998;
            
            group.add(shaft, handle);
            return group;
        };

        scaleGroup.add(createScaleHandle(GIZMO_COLOR_X, 'scaleX', 0, Math.PI / 2, 0));
        scaleGroup.add(createScaleHandle(GIZMO_COLOR_Y, 'scaleY', -Math.PI / 2, 0, 0));
        scaleGroup.add(createScaleHandle(GIZMO_COLOR_Z, 'scaleZ', 0, 0, 0));

        const uniformMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
        const uniformHandle = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), uniformMat);
        uniformHandle.name = 'scaleUniform';
        uniformHandle.userData = { defaultColor: 0xffffff, defaultOpacity: 0.9, hoverOpacity: 1.0 };
        uniformHandle.renderOrder = 999;
        scaleGroup.add(uniformHandle);

        this.handles.add(scaleGroup);
    }
    
    updateScaleGizmo(object, finalScale) {
        const scaleGroup = this.handles.getObjectByName('scale');
        if (!scaleGroup || !object) return;
        
        // Ensure scaleGroup isn't affected by any inverse scaling and inherits TransformControls' uniform scale
        scaleGroup.scale.set(1, 1, 1);
        scaleGroup.quaternion.copy(object.getWorldQuaternion(new THREE.Quaternion()));
    }

    updateVisibility(mode, showX, showY, showZ, activeAxis = null) {
        // Reset all individual meshes to visible first so we recover from isolated dragging
        this.handles.traverse(child => {
            if (child.isMesh) child.visible = true;
        });

        // Apply group-level visibility based on mode
        this.handles.children.forEach(child => {
            if (mode === 'translate' || mode === 'place') {
                child.visible = child.name === 'translate';
                if (child.name === 'translate') {
                    child.children.forEach(c => {
                        if (c.name === 'gizmoGrid') c.visible = (mode === 'place');
                    });
                }
            } else if (mode === 'scale') {
                child.visible = child.name === 'scale';
            } else {
                if (child.name === 'translate') child.visible = false;
                if (child.name === 'scale') child.visible = false;
                if (child.name === 'X') child.visible = !!showX;
                if (child.name === 'Y') child.visible = !!showY;
            }
        });

        // If we are actively dragging, isolate the view
        if (activeAxis) {
            if (mode === 'rotate') {
                this.handles.traverse(child => {
                    if (child.isMesh && child.name && child.name !== 'X' && child.name !== 'Y' && child.name !== 'Z') {
                        child.visible = false;
                    } else if (child.isMesh && child.name) {
                        child.visible = false; // Hide completely for clean rotation view
                    }
                });
            } else {
                this.handles.traverse(child => {
                    if (child.isMesh && child.name && child.name !== activeAxis && child.name !== 'gizmoGrid') {
                        child.visible = false;
                    }
                });
            }
        }
    }

    updateHighlight(activeAxis, hoveredAxis) {
        const highlightTarget = activeAxis || hoveredAxis;
        this.handles.traverse(child => {
            if (child.isMesh && child.name && child.userData.defaultColor !== undefined) {
                if (child.name === highlightTarget) {
                    child.material.color.setHex(GIZMO_COLOR_HOVER);
                    if (child.userData.hoverOpacity !== undefined) {
                        child.material.opacity = child.userData.hoverOpacity;
                    } else {
                        child.material.opacity = child.name === 'translateXZ' ? 0.5 : 1.0;
                    }
                } else {
                    child.material.color.setHex(child.userData.defaultColor);
                    child.material.opacity = child.userData.defaultOpacity;
                }
            }
        });
    }

    updateGuides(isActive, activeAxis, worldQuaternion) {
        if (isActive && activeAxis) {
            this.guideX.visible = (activeAxis === 'translateX' || activeAxis.includes('scaleX'));
            this.guideY.visible = (activeAxis.includes('scaleY'));
            this.guideZ.visible = (activeAxis === 'translateZ' || activeAxis.includes('scaleZ'));
            
            if (activeAxis.startsWith('scale')) this.axisGuide.quaternion.copy(worldQuaternion);
            else this.axisGuide.quaternion.identity();
        } else {
            this.guideX.visible = false;
            this.guideY.visible = false;
            this.guideZ.visible = false;
        }
    }
}

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
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

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
            if (mode === 'scale') {
                child.visible = child.name === 'scale';
            } else {
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
                    if (child.isMesh && child.name && child.name !== activeAxis) {
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
                        child.material.opacity = 1.0;
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

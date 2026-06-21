import * as THREE from 'three';
import { TransformGizmo } from './TransformGizmo.js';
import { TransformLogic } from './TransformLogic.js';
import { TransformInput } from './TransformInput.js';

export class TransformControls extends THREE.Group {
    constructor(camera, domElement) {
        super();
        this.camera = camera;
        this.domElement = domElement;
        this.object = null;
        
        this.raycaster = new THREE.Raycaster();
        
        this.mode = 'rotate';
        this.showX = true;
        this.showY = true;
        this.showZ = true;

        this.axis = null;
        this.hoveredAxis = null;
        
        this.worldPosition = new THREE.Vector3();
        this.worldQuaternion = new THREE.Quaternion();
        this.worldScale = new THREE.Vector3();

        // UI Drag Indicator
        this.dragIndicator = document.createElement('div');
        this.dragIndicator.style.display = 'none';
        this.dragIndicator.style.position = 'absolute';
        this.dragIndicator.style.top = '30px';
        this.dragIndicator.style.left = '50%';
        this.dragIndicator.style.transform = 'translateX(-50%)';
        this.dragIndicator.style.background = 'rgba(17, 24, 39, 0.9)';
        this.dragIndicator.style.border = '1px solid rgba(255,255,255,0.2)';
        this.dragIndicator.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.5)';
        this.dragIndicator.style.color = 'white';
        this.dragIndicator.style.padding = '4px 12px';
        this.dragIndicator.style.borderRadius = '12px';
        this.dragIndicator.style.fontWeight = 'bold';
        this.dragIndicator.style.fontSize = '11px';
        this.dragIndicator.style.zIndex = '2000';
        this.dragIndicator.style.pointerEvents = 'none';
        this.dragIndicator.style.letterSpacing = '1px';
        this.dragIndicator.style.whiteSpace = 'nowrap';
        
        if (this.domElement.parentElement) {
            this.domElement.parentElement.appendChild(this.dragIndicator);
        }

        // Initialize decoupled modules
        this.gizmo = new TransformGizmo();
        this.add(this.gizmo);

        this.logic = new TransformLogic(this.camera, (e) => this.dispatchEvent(e));
        
        this.input = new TransformInput(this.domElement, this.camera, this.raycaster, {
            onHover: this.handleHover.bind(this),
            onStart: this.handleStart.bind(this),
            onMove:  this.handleMove.bind(this),
            onEnd:   this.handleEnd.bind(this)
        });
    }

    // Property pass-throughs for backward compatibility
    get snapEnabled() { return this.logic.snapEnabled; }
    set snapEnabled(v) { this.logic.snapEnabled = v; }
    get snapSize() { return this.logic.snapSize; }
    set snapSize(v) { this.logic.snapSize = v; }
    get rotationSnap() { return this.logic.rotationSnap; }
    set rotationSnap(v) { this.logic.rotationSnap = v; }
    get active() {
        return this.input ? this.input.active : false;
    }

    get handles() {
        return this.gizmo ? this.gizmo.handles : null;
    }

    attach(object) {
        this.object = object;
        this.visible = true;
        
        // Calculate object size to fit the gizmo perfectly around it
        const box = new THREE.Box3().setFromObject(object);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        this.objectFitScale = sphere.radius > 0 ? sphere.radius * 1.2 : 30;
        
        this.update();
    }

    detach() {
        this.object = null;
        this.visible = false;
        this.axis = null;
        this.hoveredAxis = null;
        this.gizmo.updateHighlight(null, null);
    }

    update() {
        if (!this.object) return;

        this.gizmo.updateVisibility(this.mode, this.showX, this.showY, this.showZ, this.active ? this.axis : null);

        this.object.updateWorldMatrix(true, false);
        this.object.matrixWorld.decompose(this.worldPosition, this.worldQuaternion, this.worldScale);
        this.position.copy(this.worldPosition);

        const scaleGroup = this.gizmo.handles.getObjectByName('scale');
        if (scaleGroup) scaleGroup.quaternion.copy(this.worldQuaternion);

        // Scale gizmo to fit the object
        const camDistance = this.worldPosition.distanceTo(this.camera.position);
        const minScreenScale = camDistance / 12; 
        const finalScale = Math.max(this.objectFitScale || 30, minScreenScale);
        this.scale.set(finalScale, finalScale, finalScale);
        
        if (this.mode === 'scale') {
            this.gizmo.updateScaleGizmo(this.object, finalScale);
        } else {
            const scaleGroup = this.gizmo.handles.getObjectByName('scale');
            if (scaleGroup) scaleGroup.quaternion.copy(this.worldQuaternion);
        }
        
        this.gizmo.updateGuides(this.active, this.axis, this.worldQuaternion);
    }

    handleHover(mouse) {
        if (!this.visible || this.object === null) return;
        this.raycaster.setFromCamera(mouse, this.camera);
        
        const isVisible = (obj) => {
            while (obj) {
                if (!obj.visible) return false;
                obj = obj.parent;
            }
            return true;
        };
        
        const intersects = this.raycaster.intersectObjects(this.gizmo.handles.children, true).filter(hit => isVisible(hit.object));
        
        let foundAxis = null;
        if (intersects.length > 0) {
            foundAxis = intersects[0].object.name;
            if (foundAxis === 'X' && !this.showX) foundAxis = null;
            if (foundAxis === 'Y' && !this.showY) foundAxis = null;
            if (foundAxis === 'Z' && !this.showZ) foundAxis = null;
        }

        if (foundAxis !== this.hoveredAxis) {
            this.hoveredAxis = foundAxis;
            this.gizmo.updateHighlight(this.axis, this.hoveredAxis);
            this.domElement.style.cursor = foundAxis ? 'pointer' : 'auto';
        }
    }

    handleStart(mouse) {
        if (!this.visible || this.object === null) return null;
        this.raycaster.setFromCamera(mouse, this.camera);
        
        const isVisible = (obj) => {
            while (obj) {
                if (!obj.visible) return false;
                obj = obj.parent;
            }
            return true;
        };
        
        const intersects = this.raycaster.intersectObjects(this.gizmo.handles.children, true).filter(hit => isVisible(hit.object));
        
        let validHit = null;
        for (let i = 0; i < intersects.length; i++) {
            const hitAxis = intersects[i].object.name;
            if (hitAxis === 'X' && !this.showX) continue;
            if (hitAxis === 'Y' && !this.showY) continue;
            if (hitAxis === 'Z' && !this.showZ) continue;
            validHit = intersects[i];
            break;
        }

        if (validHit) {
            this.axis = validHit.object.name;
            this.gizmo.updateHighlight(this.axis, this.hoveredAxis);
            this.gizmo.handles.visible = false; // Hide the rings/arrows while dragging
            this.update();
            
            if (this.mode === 'place') this.createGhost();
            
            // Show Drag Indicator
            if (this.mode === 'rotate') {
                this.dragIndicator.innerHTML = '⭮ ROTATING...';
                this.dragIndicator.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.5)'; // Greenish glow
            } else if (this.mode === 'scale') {
                let dirName = 'UNIFORM';
                let prefix = '';
                if (this.axis.includes('X')) { prefix = '[X] '; dirName = 'WIDTH'; }
                else if (this.axis.includes('Y')) { prefix = '[Y] '; dirName = 'HEIGHT'; }
                else if (this.axis.includes('Z')) { prefix = '[Z] '; dirName = 'DEPTH'; }
                this.dragIndicator.innerHTML = `${prefix}⤢ SCALING ${dirName}...`;
                this.dragIndicator.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.5)'; // Orange glow
            } else {
                this.dragIndicator.innerHTML = '⬌ MOVING...';
                this.dragIndicator.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.5)'; // Blue glow
            }
            this.dragIndicator.style.display = 'block';

            this.logic.startInteraction(this.object, this.mode, this.axis, this.worldPosition, this.worldQuaternion, mouse, this.raycaster);
            return true;
        }
        return false;
    }

    handleMove(mouse, startMouse) {
        this.raycaster.setFromCamera(mouse, this.camera);
        this.logic.processInteraction(this.object, this.mode, this.axis, mouse, this.raycaster, startMouse, this.worldQuaternion);
        this.update();
    }

    handleEnd() {
        if (this.mode === 'place') this.removeGhost();
        this.logic.endInteraction(this.object, this.mode, this.axis);
        this.axis = null;
        this.dragIndicator.style.display = 'none';
        this.gizmo.updateHighlight(this.axis, this.hoveredAxis);
        this.gizmo.handles.visible = true; // Show the rings/arrows after release
        this.update(); // Triggers updateVisibility which now restores mesh visibility
    }

    createGhost() {
        if (!this.object) return;
        const userDataBackup = new Map();
        this.object.traverse(c => {
            userDataBackup.set(c, c.userData);
            c.userData = {};
        });
        
        this.ghost = this.object.clone();
        
        this.object.traverse(c => { c.userData = userDataBackup.get(c); });
        
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

    dispose() {
        this.input.dispose();
        if (this.dragIndicator && this.dragIndicator.parentElement) {
            this.dragIndicator.parentElement.removeChild(this.dragIndicator);
        }
        this.gizmo.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        });
    }
}
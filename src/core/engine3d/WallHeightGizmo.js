import * as THREE from 'three';
import { EVENTS } from '../constants/events.js';
import { coreEventBus } from '../EventBus.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { WallEngine } from '../wall/WallEngine.js';

/**
 * WallHeightGizmo
 * 
 * Provides interactive Sims 4-style 3D height & slope handles:
 * 1. Center-Top Vertical Arrow: Adjusts overall wall height (w.height).
 * 2. Left-Top & Right-Top Handles: Adjusts independent sloped top heights (startHeight, endHeight).
 * 3. Center-Apex Handle: Adjusts gable peak height (peakHeight).
 */
export class WallHeightGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.target = null;
        this.visible = false;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.isDragging = false;
        this.activeHandle = null;
        this.dragPlane = new THREE.Plane();
        this.dragStartPoint = new THREE.Vector3();
        this.initialH = 120;
        this._capturedPointerId = null;
        
        this.handles = new THREE.Group();
        this.handles.name = 'WallHeight_Handles';
        this.add(this.handles);
        
        // Materials
        this.matHeight = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.matSlope = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 });
        this.matHover = new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false, transparent: true, opacity: 1.0 });
        this.matActive = new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false, transparent: true, opacity: 1.0 });
        
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        
        const dom = this.ctx.renderer.domElement;
        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
        dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
    }

    updateMouse(e) {
        const dom = this.ctx.renderer.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    attach(object) {
        if (!object) return;
        this.target = object;
        this.visible = true;
        this.isDragging = false;
        this.activeHandle = null;
        this.updateHandles();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.isDragging = false;
        this.activeHandle = null;
        while (this.handles.children.length > 0) {
            const c = this.handles.children[0];
            this.handles.remove(c);
            if (c.geometry) c.geometry.dispose();
        }
    }

    _getWallEntity() {
        if (!this.target) return null;
        if (this.target.userData?.entity) return this.target.userData.entity;
        if (this.target.userData?.isWallSide || this.target.userData?.isWall) return this.target.userData.entity;
        if (this.target.parent?.userData?.entity) return this.target.parent.userData.entity;
        return null;
    }

    updateHandles() {
        while (this.handles.children.length > 0) {
            const c = this.handles.children[0];
            this.handles.remove(c);
            if (c.geometry) c.geometry.dispose();
        }

        const wall = this._getWallEntity();
        if (!wall) return;

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
        
        const midX = (p1.x + p2.x) / 2;
        const midZ = (p1.y + p2.y) / 2;
        const wallBaseY = (wall.elevation || 0);
        const wallH = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));
        const startH = (wall.startHeight !== undefined ? wall.startHeight : wallH);
        const endH = (wall.endHeight !== undefined ? wall.endHeight : wallH);
        const peakH = (wall.peakHeight !== undefined ? wall.peakHeight : wallH);
        const profileType = wall.topProfileType || 'normal';

        // 1. Center Vertical Height Up/Down Arrow
        const centerGroup = new THREE.Group();
        centerGroup.position.set(midX, wallBaseY + (profileType === 'gable' ? peakH : wallH) + 6, midZ);
        centerGroup.userData = { isWallHeightHandle: true, handleType: 'uniform_height' };
        
        const arrowGeo = new THREE.ConeGeometry(5, 14, 16);
        const arrowMesh = new THREE.Mesh(arrowGeo, this.matHeight.clone());
        arrowMesh.userData = { isWallHeightHandle: true, handleType: 'uniform_height' };
        centerGroup.add(arrowMesh);

        const stemGeo = new THREE.CylinderGeometry(1.6, 1.6, 12, 12);
        stemGeo.translate(0, -6, 0);
        const stemMesh = new THREE.Mesh(stemGeo, this.matHeight.clone());
        stemMesh.userData = { isWallHeightHandle: true, handleType: 'uniform_height' };
        centerGroup.add(stemMesh);
        this.handles.add(centerGroup);

        // 2. Left Slope Handle (startHeight)
        const leftSlopeGroup = new THREE.Group();
        leftSlopeGroup.position.set(p1.x, wallBaseY + startH + 4, p1.y);
        leftSlopeGroup.userData = { isWallHeightHandle: true, handleType: 'start_slope' };
        const leftBox = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), this.matSlope.clone());
        leftBox.userData = { isWallHeightHandle: true, handleType: 'start_slope' };
        leftSlopeGroup.add(leftBox);
        this.handles.add(leftSlopeGroup);

        // 3. Right Slope Handle (endHeight)
        const rightSlopeGroup = new THREE.Group();
        rightSlopeGroup.position.set(p2.x, wallBaseY + endH + 4, p2.y);
        rightSlopeGroup.userData = { isWallHeightHandle: true, handleType: 'end_slope' };
        const rightBox = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), this.matSlope.clone());
        rightBox.userData = { isWallHeightHandle: true, handleType: 'end_slope' };
        rightSlopeGroup.add(rightBox);
        this.handles.add(rightSlopeGroup);
    }

    _onPointerDown(e) {
        if (!this.visible) return;
        if (e.button !== 0) return;

        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        const meshes = [];
        this.handles.traverse(c => {
            if (c.isMesh && c.userData.isWallHeightHandle) meshes.push(c);
        });

        const intersects = this.raycaster.intersectObjects(meshes, false);
        if (intersects.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            const hitMesh = intersects[0].object;
            this.activeHandle = hitMesh.userData;
            hitMesh.material = this.matActive;

            const wall = this._getWallEntity();
            if (!wall) return;

            const wallH = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));
            this.initialH = wallH;
            this.initialStartH = (wall.startHeight !== undefined ? wall.startHeight : wallH);
            this.initialEndH = (wall.endHeight !== undefined ? wall.endHeight : wallH);

            const camDir = new THREE.Vector3();
            this.ctx.camera.getWorldDirection(camDir);
            this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(camDir.x, 0, camDir.z).normalize(), intersects[0].point);
            this.dragStartPoint.copy(intersects[0].point);

            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
            if (planner && planner.commandManager) {
                this._snapshotCmd = new SnapshotCommand(planner);
            }

            this.isDragging = true;
            this._capturedPointerId = e.pointerId;
            if (e.target && typeof e.target.setPointerCapture === 'function') {
                try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
            }
            if (this.ctx.controls) this.ctx.controls.enabled = false;
        }
    }

    _onPointerMove(e) {
        if (!this.visible) return;
        this.updateMouse(e);

        if (this.isDragging && this.activeHandle) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const currentPoint = new THREE.Vector3();

            if (this.raycaster.ray.intersectPlane(this.dragPlane, currentPoint)) {
                const deltaY = currentPoint.y - this.dragStartPoint.y;
                const snap = 5.0; // 5cm CAD height snap
                const steppedDelta = Math.round(deltaY / snap) * snap;

                const wall = this._getWallEntity();
                if (!wall) return;

                if (this.activeHandle.handleType === 'uniform_height') {
                    const newH = Math.max(40, Math.min(600, this.initialH + steppedDelta));
                    WallEngine.setHeight(wall, newH, false, this.ctx.planner);
                } else if (this.activeHandle.handleType === 'start_slope') {
                    const newStartH = Math.max(40, Math.min(600, this.initialStartH + steppedDelta));
                    WallEngine.setTopProfile(wall, 'single', { startHeight: newStartH }, false, this.ctx.planner);
                } else if (this.activeHandle.handleType === 'end_slope') {
                    const newEndH = Math.max(40, Math.min(600, this.initialEndH + steppedDelta));
                    WallEngine.setTopProfile(wall, 'single', { endHeight: newEndH }, false, this.ctx.planner);
                }

                if (typeof this.ctx.updateWallGeometryLive === 'function') {
                    try { this.ctx.updateWallGeometryLive(wall); } catch(err) {}
                }

                this.updateHandles();

                if (this.ctx.requestRender) {
                    this.ctx.requestRender('wall_height_drag', 2);
                }

                coreEventBus.emit(EVENTS.WALL_CHANGE, { entity: wall });
            }
        } else {
            // Hover highlight
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const meshes = [];
            this.handles.traverse(c => {
                if (c.isMesh && c.userData.isWallHeightHandle) meshes.push(c);
            });

            meshes.forEach(m => {
                m.material = m.userData.handleType === 'uniform_height' ? this.matHeight : this.matSlope;
                m.scale.set(1, 1, 1);
            });

            const intersects = this.raycaster.intersectObjects(meshes, false);
            if (intersects.length > 0) {
                intersects[0].object.material = this.matHover;
                intersects[0].object.scale.set(1.3, 1.3, 1.3);
                if (this.ctx.requestRender) this.ctx.requestRender();
            }
        }
    }

    _onPointerUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.activeHandle = null;

            if (this._capturedPointerId !== null && e.target && typeof e.target.releasePointerCapture === 'function') {
                try { e.target.releasePointerCapture(this._capturedPointerId); } catch(err) {}
                this._capturedPointerId = null;
            }

            if (this.ctx.controls) this.ctx.controls.enabled = true;

            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
            if (planner && planner.commandManager && this._snapshotCmd) {
                planner.commandManager.execute(this._snapshotCmd);
                this._snapshotCmd = null;
            }

            this.updateHandles();
            if (this.ctx.requestRender) this.ctx.requestRender();
        }
    }

    dispose() {
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        this.detach();
    }
}

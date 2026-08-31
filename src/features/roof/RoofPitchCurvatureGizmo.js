import * as THREE from 'three';
import { EVENTS } from '../../core/registry.js';
import { coreEventBus } from '../../core/EventBus.js';
import { offsetPolygon } from '../../core/registry.js';

/**
 * RoofPitchCurvatureGizmo
 * 
 * Complete Sims 4 In-Viewport 3D Interactive Roof Gizmo with Dedicated Mode-Separated Controls:
 * 
 * - 'corners' (Default Shape Mode):
 *     1. Apex Pitch Dual-Arrow (Gold ↕): Dedicated at the Ridge Apex Top.
 *     2. Slope Curvature Orb (Cyan ◯): Dedicated in the middle of the Roof Slope Face.
 *     3. Eave Overhang Pull-Tabs (Blue ↔): Dedicated at the 4 Eave Center Trim Edges.
 *     4. Boundary Corner Stretch Crystals (Pink ⬡): Dedicated at the 4 Outer Footprint Corners.
 * 
 * - 'move' (Move Mode):
 *     Only shows the Emerald 4-Way Compass Pan Icon (✢) right at the exact center of the roof.
 * 
 * - 'spin' (Spin Mode):
 *     Only shows the Indigo Rotation Wheel Icon (↻) right at the exact center of the roof.
 */
export class RoofPitchCurvatureGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'RoofPitchCurvatureGizmo';
        this.target = null;
        this.mode = 'corners'; // 'corners' | 'move' | 'spin'
        this.handles = new THREE.Group();
        this.handles.name = 'RoofGizmoHandles';
        this.add(this.handles);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.visible = false;

        // High-visibility materials (depthTest: false ensures handles are always rendered on top)
        this.pitchMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 });
        this.pitchMatHover = new THREE.MeshBasicMaterial({ color: 0xfde047, depthTest: false, transparent: true, opacity: 1.0 });
        this.pitchMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.moveMat = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.moveMatHover = new THREE.MeshBasicMaterial({ color: 0x34d399, depthTest: false, transparent: true, opacity: 1.0 });
        this.moveMatActive = new THREE.MeshBasicMaterial({ color: 0x059669, depthTest: false, transparent: true, opacity: 1.0 });

        this.spinMat = new THREE.MeshBasicMaterial({ color: 0x6366f1, depthTest: false, transparent: true, opacity: 0.95 });
        this.spinMatHover = new THREE.MeshBasicMaterial({ color: 0x818cf8, depthTest: false, transparent: true, opacity: 1.0 });
        this.spinMatActive = new THREE.MeshBasicMaterial({ color: 0x4f46e5, depthTest: false, transparent: true, opacity: 1.0 });

        this.curveMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, depthTest: false, transparent: true, opacity: 0.95 });
        this.curveMatHover = new THREE.MeshBasicMaterial({ color: 0x67e8f9, depthTest: false, transparent: true, opacity: 1.0 });
        this.curveMatActive = new THREE.MeshBasicMaterial({ color: 0xa855f7, depthTest: false, transparent: true, opacity: 1.0 });

        this.overhangMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, depthTest: false, transparent: true, opacity: 0.95 });
        this.overhangMatHover = new THREE.MeshBasicMaterial({ color: 0x93c5fd, depthTest: false, transparent: true, opacity: 1.0 });
        this.overhangMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.stretchMat = new THREE.MeshBasicMaterial({ color: 0xec4899, depthTest: false, transparent: true, opacity: 0.95 });
        this.stretchMatHover = new THREE.MeshBasicMaterial({ color: 0xf472b6, depthTest: false, transparent: true, opacity: 1.0 });
        this.stretchMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.9 });
        this.darkMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, depthTest: false, transparent: true, opacity: 0.9 });

        this.activeHandle = null;
        this.isDragging = false;
        this.dragPlane = new THREE.Plane();
        this.dragStartPos = new THREE.Vector3();
        this.planeIntersect = new THREE.Vector3();
        this.initialPitch = 30;
        this.initialRh = 30;
        this.initialCurve = 0;
        this.initialOverhang = 8;
        this.initialRidgeAxis = 'x';
        this.initialGroupX = 0;
        this.initialGroupZ = 0;
        this.initialCenterX = 0;
        this.initialCenterZ = 0;
        this.initialAngle = 0;
        this.initialPoints = [];
        this.initialMinX = 0;
        this.initialMaxX = 0;
        this.initialMinY = 0;
        this.initialMaxY = 0;
        this.hoveredHandle = null;

        this._createDOMBadge();

        const dom = this.ctx.renderer?.domElement;

        this._onPointerDown = (e) => {
            if (!this.visible || !this.target) return;
            if (e.button !== 0) return;
            this.updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, true);
            if (intersects.length > 0) {
                e.preventDefault();
                e.stopPropagation();

                let handle = intersects[0].object;
                while (handle.parent && handle.parent !== this.handles) {
                    handle = handle.parent;
                }

                this.activeHandle = handle;
                this.isDragging = true;

                const entity = this.target.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                this.initialPitch = conf.pitch !== undefined ? conf.pitch : 30;
                this.initialCurve = conf.curve !== undefined ? conf.curve : 0;
                this.initialOverhang = conf.overhang !== undefined ? conf.overhang : 8;
                this.initialRidgeAxis = conf.ridgeAxis || 'x';
                this.initialGroupX = (entity.group && typeof entity.group.x === 'function') ? entity.group.x() : (entity.x || 0);
                this.initialGroupZ = (entity.group && typeof entity.group.y === 'function') ? entity.group.y() : (entity.y || 0);
                this.initialPoints = (entity.points || []).map(p => ({ x: p.x, y: p.y }));

                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                this.initialPoints.forEach(p => {
                    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                });
                this.initialMinX = minX;
                this.initialMaxX = maxX;
                this.initialMinY = minY;
                this.initialMaxY = maxY;

                this.initialCenterX = (minX + maxX) / 2;
                this.initialCenterZ = (minY + maxY) / 2;

                const w = maxX - minX, d = maxY - minY;
                const span = Math.min(w, d);
                this.initialRh = Math.tan(this.initialPitch * Math.PI / 180) * (span / 2);

                const type = handle.userData?.type;
                if (type === 'pitch' || type === 'curve') {
                    // Vertical drag plane facing camera
                    const camDir = this.ctx.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate();
                    this.dragPlane.setFromNormalAndCoplanarPoint(camDir, intersects[0].point);
                } else {
                    // Horizontal drag plane (XZ)
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), intersects[0].point);
                }

                this.dragStartPos.copy(intersects[0].point);
                this.initialRotation = (entity.group && typeof entity.group.rotation === 'function') ? entity.group.rotation() : (entity.rotation || 0);
                const worldCx = this.initialGroupX + this.initialCenterX;
                const worldCz = this.initialGroupZ + this.initialCenterZ;
                this.initialAngle = Math.atan2(intersects[0].point.z - worldCz, intersects[0].point.x - worldCx);

                this.refreshHandleMaterials();
                if (this.ctx.controls) this.ctx.controls.enabled = false;
            }
        };

        this._onPointerMove = (e) => {
            if (!this.visible || !this.target) return;
            this.updateMouse(e);

            if (!this.isDragging) {
                // Raycast handles for hover effects
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const intersects = this.raycaster.intersectObjects(this.handles.children, true);
                if (intersects.length > 0) {
                    let handle = intersects[0].object;
                    while (handle.parent && handle.parent !== this.handles) {
                        handle = handle.parent;
                    }
                    if (this.hoveredHandle !== handle) {
                        this.hoveredHandle = handle;
                        this.refreshHandleMaterials();
                        if (this.ctx.requestRender) this.ctx.requestRender();
                    }
                } else if (this.hoveredHandle) {
                    this.hoveredHandle = null;
                    this.refreshHandleMaterials();
                    if (this.ctx.requestRender) this.ctx.requestRender();
                }
                return;
            }

            // Dragging an active handle
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
                const entity = this.target.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const type = this.activeHandle.userData?.type;

                if (type === 'pitch') {
                    // Apex Pitch adjustment
                    const deltaY = this.planeIntersect.y - this.dragStartPos.y;
                    const w = this.initialMaxX - this.initialMinX;
                    const d = this.initialMaxY - this.initialMinY;
                    const span = Math.min(w, d);

                    let newRh = Math.max(4, this.initialRh + deltaY);
                    let newPitch = Math.atan2(newRh, span / 2) * (180 / Math.PI);
                    newPitch = Math.max(5, Math.min(75, Math.round(newPitch)));

                    conf.pitch = newPitch;
                    const peakFeet = this._formatFeetInches(newRh);
                    this._updateDOMBadge(`PITCH: ${newPitch}&deg; | Peak: ${peakFeet}`, { x: e.clientX, y: e.clientY });
                } else if (type === 'move') {
                    // Smooth, continuous direct 3D planar translation (world space)
                    let deltaX = this.planeIntersect.x - this.dragStartPos.x;
                    let deltaZ = this.planeIntersect.z - this.dragStartPos.z;

                    if (!e.shiftKey) {
                        const snapUnit = 10;
                        deltaX = Math.round(deltaX / snapUnit) * snapUnit;
                        deltaZ = Math.round(deltaZ / snapUnit) * snapUnit;
                    }

                    const newGroupX = Math.round(this.initialGroupX + deltaX);
                    const newGroupZ = Math.round(this.initialGroupZ + deltaZ);

                    if (entity.group && typeof entity.group.position === 'function') {
                        entity.group.position({ x: newGroupX, y: newGroupZ });
                    }
                    entity.x = newGroupX;
                    entity.y = newGroupZ;

                    const dist = Math.hypot(deltaX, deltaZ);
                    this._updateDOMBadge(`MOVE: ${this._formatFeetInches(dist)} (&Delta;X: ${deltaX >= 0 ? '+' : ''}${this._formatFeetInches(deltaX)}, &Delta;Z: ${deltaZ >= 0 ? '+' : ''}${this._formatFeetInches(deltaZ)})`, { x: e.clientX, y: e.clientY });
                } else if (type === 'spin') {
                    // Smooth, rigid rotation around exact center without vertex deformation
                    const worldCx = this.initialGroupX + this.initialCenterX;
                    const worldCz = this.initialGroupZ + this.initialCenterZ;
                    const curAngle = Math.atan2(this.planeIntersect.z - worldCz, this.planeIntersect.x - worldCx);
                    let angleDelta = -(curAngle - this.initialAngle) * (180 / Math.PI);

                    let newRot = this.initialRotation + angleDelta;
                    if (!e.shiftKey) {
                        newRot = Math.round(newRot / 15) * 15; // Clean 15-degree snap increments
                    }
                    newRot = ((Math.round(newRot) % 360) + 360) % 360;

                    entity.rotation = newRot;
                    if (entity.group && typeof entity.group.rotation === 'function') {
                        entity.group.rotation(newRot);
                    }

                    // Two-way sync to GizmoManager spin panel
                    if (this.ctx.gizmoManager && this.ctx.gizmoManager.syncRoofSpinPanel) {
                        this.ctx.gizmoManager.syncRoofSpinPanel(entity);
                    }

                    this._updateDOMBadge(`SPIN: ${newRot}&deg;`, { x: e.clientX, y: e.clientY });
                } else if (type === 'curve') {
                    // Slope Curvature adjustment
                    const deltaY = this.planeIntersect.y - this.dragStartPos.y;
                    const newCurve = Math.max(-50, Math.min(50, Math.round(this.initialCurve + deltaY * 0.4)));
                    conf.curve = newCurve;

                    const curveLabel = newCurve > 0 ? `Convex (+${newCurve})` : (newCurve < 0 ? `Pagoda (${newCurve})` : 'Flat (0)');
                    this._updateDOMBadge(`CURVATURE: ${curveLabel}`, { x: e.clientX, y: e.clientY });
                } else if (type === 'overhang') {
                    // Eave Overhang adjustment in local roof space
                    const rot = (entity.group && typeof entity.group.rotation === 'function') ? entity.group.rotation() : (entity.rotation || 0);
                    const rad = rot * Math.PI / 180;
                    const worldDeltaX = this.planeIntersect.x - this.dragStartPos.x;
                    const worldDeltaZ = this.planeIntersect.z - this.dragStartPos.z;
                    const localDeltaX = worldDeltaX * Math.cos(rad) - worldDeltaZ * Math.sin(rad);
                    const localDeltaZ = worldDeltaX * Math.sin(rad) + worldDeltaZ * Math.cos(rad);

                    const edgeIdx = this.activeHandle.userData?.edgeIndex;
                    let delta = 0;
                    if (edgeIdx === 0) delta = -localDeltaZ; // North
                    else if (edgeIdx === 1) delta = localDeltaX;  // East
                    else if (edgeIdx === 2) delta = localDeltaZ;  // South
                    else if (edgeIdx === 3) delta = -localDeltaX; // West

                    const newOverhang = Math.max(0, Math.min(60, Math.round(this.initialOverhang + delta)));
                    conf.overhang = newOverhang;
                    if (conf.overhangs) conf.overhangs.fill(newOverhang);

                    this._updateDOMBadge(`OVERHANG: ${this._formatFeetInches(newOverhang)}`, { x: e.clientX, y: e.clientY });
                } else if (type === 'stretch') {
                    // Corner Footprint Stretch in local roof space
                    const rot = (entity.group && typeof entity.group.rotation === 'function') ? entity.group.rotation() : (entity.rotation || 0);
                    const rad = rot * Math.PI / 180;
                    const worldDeltaX = this.planeIntersect.x - this.dragStartPos.x;
                    const worldDeltaZ = this.planeIntersect.z - this.dragStartPos.z;
                    const deltaX = worldDeltaX * Math.cos(rad) - worldDeltaZ * Math.sin(rad);
                    const deltaZ = worldDeltaX * Math.sin(rad) + worldDeltaZ * Math.cos(rad);

                    const corner = this.activeHandle.userData?.corner;

                    let minX = this.initialMinX, maxX = this.initialMaxX;
                    let minY = this.initialMinY, maxY = this.initialMaxY;

                    if (corner === 'nw') {
                        minX = Math.min(maxX - 40, this.initialMinX + deltaX);
                        minY = Math.min(maxY - 40, this.initialMinY + deltaZ);
                    } else if (corner === 'ne') {
                        maxX = Math.max(minX + 40, this.initialMaxX + deltaX);
                        minY = Math.min(maxY - 40, this.initialMinY + deltaZ);
                    } else if (corner === 'se') {
                        maxX = Math.max(minX + 40, this.initialMaxX + deltaX);
                        maxY = Math.max(minY + 40, this.initialMaxY + deltaZ);
                    } else if (corner === 'sw') {
                        minX = Math.min(maxX - 40, this.initialMinX + deltaX);
                        maxY = Math.max(minY + 40, this.initialMaxY + deltaZ);
                    }

                    entity.points = [
                        { x: minX, y: minY },
                        { x: maxX, y: minY },
                        { x: maxX, y: maxY },
                        { x: minX, y: maxY }
                    ];

                    const curW = maxX - minX, curD = maxY - minY;
                    this._updateDOMBadge(`FOOTPRINT: ${this._formatFeetInches(curW)} &times; ${this._formatFeetInches(curD)}`, { x: e.clientX, y: e.clientY });
                }

                // Granular In-Place CAD Rebuild via EnvironmentBuilder
                if (this.ctx.envBuilder && this.ctx.envBuilder.updateRoofLive) {
                    this.ctx.envBuilder.updateRoofLive(entity);
                } else if (this.ctx.updateRoofLive) {
                    this.ctx.updateRoofLive(entity);
                }

                // Two-way sync to 2D Konva stage
                if (entity.update) entity.update();
                if (this.ctx.planner?.stage?.batchDraw) this.ctx.planner.stage.batchDraw();

                this.updateHandlePositions();
                if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
                return;
            }

            // Hover effects
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, true);
            let newHover = null;
            if (intersects.length > 0) {
                let handle = intersects[0].object;
                while (handle.parent && handle.parent !== this.handles) {
                    handle = handle.parent;
                }
                newHover = handle;
            }

            if (this.hoveredHandle !== newHover) {
                this.hoveredHandle = newHover;
                this.refreshHandleMaterials();
                if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
            }
        };

        this._onPointerUp = (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                this.activeHandle = null;
                this._hideDOMBadge();
                this.refreshHandleMaterials();
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                
                const entity = this.target?.userData?.entity;
                if (entity) {
                    coreEventBus.emit(EVENTS.ROOF_CORNER_GIZMO_END, { entity });
                }
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            }
        };

        if (dom && typeof dom.addEventListener === 'function') {
            dom.addEventListener('pointerdown', this._onPointerDown, true);
            dom.addEventListener('pointermove', this._onPointerMove, false);
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('pointerup', this._onPointerUp, false);
        }
    }

    _createDOMBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'roof-gizmo-live-badge';
        this.domBadge.style.cssText = `
            position: absolute;
            display: none;
            pointer-events: none;
            transform: translate(-50%, -120%);
            padding: 7px 16px;
            border-radius: 18px;
            background: rgba(15, 23, 42, 0.95);
            border: 2px solid #f59e0b;
            box-shadow: 0 6px 22px rgba(0, 0, 0, 0.7), 0 0 16px rgba(245, 158, 11, 0.4);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.5px;
            white-space: nowrap;
            z-index: 999999;
            backdrop-filter: blur(10px);
            user-select: none;
        `;
        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domBadge);
    }

    _updateDOMBadge(text, screenPos) {
        if (!this.domBadge) return;
        if (!text || !screenPos) {
            this.domBadge.style.display = 'none';
            return;
        }
        this.domBadge.innerHTML = text;
        this.domBadge.style.left = `${screenPos.x}px`;
        this.domBadge.style.top = `${screenPos.y}px`;
        this.domBadge.style.display = 'block';
    }

    _hideDOMBadge() {
        if (this.domBadge) this.domBadge.style.display = 'none';
    }

    _formatFeetInches(px) {
        const totalInches = Math.round((px / 20) * 12);
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        return `${feet}' ${inches}"`;
    }

    updateMouse(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    attach(target, mode = 'corners') {
        this.target = target;
        this.mode = mode || 'corners';
        if (!target) {
            this.detach();
            return;
        }

        const entity = target.userData?.entity;
        if (!entity || (entity.type !== 'roof' && !target.userData?.isRoof)) {
            this.detach();
            return;
        }

        this.visible = true;
        this.rebuildHandles();
        this.updateHandlePositions();
        if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
    }

    setMode(mode) {
        this.mode = mode || 'corners';
        this.rebuildHandles();
        this.updateHandlePositions();
        if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.activeHandle = null;
        this.hoveredHandle = null;
        this._hideDOMBadge();
        while (this.handles.children.length > 0) {
            const child = this.handles.children[0];
            this.handles.remove(child);
        }
        if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
    }

    rebuildHandles() {
        while (this.handles.children.length > 0) {
            const child = this.handles.children[0];
            this.handles.remove(child);
        }

        this.peakHandle = null;
        this.moveHandle = null;
        this.spinHandle = null;
        this.curveHandle = null;
        this.overhangHandles = [];
        this.stretchHandles = [];

        if (!this.target) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;

        if (this.mode === 'move') {
            // MODE: Move — Show ONLY the Move 4-Way Compass Icon at the exact center of the roof
            const moveGroup = new THREE.Group();
            moveGroup.userData = { type: 'move' };

            const moveDisc = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 3.5, 32), this.moveMat);
            moveDisc.renderOrder = 9999;

            const mRing = new THREE.Mesh(new THREE.TorusGeometry(17, 2, 12, 32), this.ringMat);
            mRing.rotation.x = Math.PI / 2;
            mRing.renderOrder = 9999;

            // Center Raised Cross
            const crossX = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 4), this.ringMat);
            crossX.position.y = 2; crossX.renderOrder = 9999;
            const crossZ = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 16), this.ringMat);
            crossZ.position.y = 2; crossZ.renderOrder = 9999;

            // 4 Sleek Directional Arrows with Stems (+X, -X, +Z, -Z)
            const stemN = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 10, 8), this.moveMat);
            stemN.rotation.x = Math.PI / 2; stemN.position.z = -18; stemN.renderOrder = 9999;
            const aN = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 16), this.moveMat);
            aN.rotation.x = -Math.PI / 2; aN.position.z = -26; aN.renderOrder = 9999;

            const stemS = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 10, 8), this.moveMat);
            stemS.rotation.x = Math.PI / 2; stemS.position.z = 18; stemS.renderOrder = 9999;
            const aS = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 16), this.moveMat);
            aS.rotation.x = Math.PI / 2; aS.position.z = 26; aS.renderOrder = 9999;

            const stemE = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 10, 8), this.moveMat);
            stemE.rotation.z = Math.PI / 2; stemE.position.x = 18; stemE.renderOrder = 9999;
            const aE = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 16), this.moveMat);
            aE.rotation.z = -Math.PI / 2; aE.position.x = 26; aE.renderOrder = 9999;

            const stemW = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 10, 8), this.moveMat);
            stemW.rotation.z = Math.PI / 2; stemW.position.x = -18; stemW.renderOrder = 9999;
            const aW = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 16), this.moveMat);
            aW.rotation.z = Math.PI / 2; aW.position.x = -26; aW.renderOrder = 9999;

            moveGroup.add(moveDisc, mRing, crossX, crossZ, stemN, aN, stemS, aS, stemE, aE, stemW, aW);
            this.handles.add(moveGroup);
            this.moveHandle = moveGroup;
            this.refreshHandleMaterials();
            return;
        }

        if (this.mode === 'spin') {
            // MODE: Spin — Show ONLY the Spin Rotation Wheel Icon at the exact center of the roof
            const spinGroup = new THREE.Group();
            spinGroup.userData = { type: 'spin' };

            const arc = new THREE.Mesh(new THREE.TorusGeometry(18, 3, 12, 32, Math.PI * 1.6), this.spinMat);
            arc.rotation.x = Math.PI / 2;
            arc.renderOrder = 9999;

            const spinArrow = new THREE.Mesh(new THREE.ConeGeometry(8, 14, 12), this.spinMat);
            spinArrow.position.set(0, 0, 18);
            spinArrow.renderOrder = 9999;

            const centerPivot = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 4, 16), this.ringMat);
            centerPivot.renderOrder = 9999;

            spinGroup.add(arc, spinArrow, centerPivot);
            this.handles.add(spinGroup);
            this.spinHandle = spinGroup;
            this.refreshHandleMaterials();
            return;
        }

        // MODE: 'corners' / Default Shape Mode — Pitch Cone, Curve Orb, Overhangs, Corner Crystals (NO Move/Spin clutter)
        const peakGroup = new THREE.Group();
        peakGroup.userData = { type: 'pitch' };
        
        const topCone = new THREE.Mesh(new THREE.ConeGeometry(13, 24, 16), this.pitchMat);
        topCone.position.y = 12;
        topCone.renderOrder = 9999;

        const bottomCone = new THREE.Mesh(new THREE.ConeGeometry(13, 24, 16), this.pitchMat);
        bottomCone.rotation.x = Math.PI;
        bottomCone.position.y = -12;
        bottomCone.renderOrder = 9999;

        const ring = new THREE.Mesh(new THREE.TorusGeometry(15, 2.2, 8, 24), this.ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.renderOrder = 9999;

        peakGroup.add(topCone, bottomCone, ring);
        this.handles.add(peakGroup);
        this.peakHandle = peakGroup;

        // Slope Curvature Orb (Dedicated Cyan ◯ Sphere on the North slope face)
        const curveGroup = new THREE.Group();
        curveGroup.userData = { type: 'curve' };

        const curveSphere = new THREE.Mesh(new THREE.SphereGeometry(12, 24, 24), this.curveMat);
        curveSphere.renderOrder = 9999;

        const cRing = new THREE.Mesh(new THREE.TorusGeometry(15, 2, 8, 24), this.ringMat);
        cRing.rotation.x = Math.PI / 2;
        cRing.renderOrder = 9999;

        curveGroup.add(curveSphere, cRing);
        this.handles.add(curveGroup);
        this.curveHandle = curveGroup;

        // Eave Overhang Pull-Tabs (Dedicated Blue ↔ Pull-Tabs at 4 center eave edges)
        this.overhangHandles = [];
        for (let i = 0; i < 4; i++) {
            const tabGroup = new THREE.Group();
            tabGroup.userData = { type: 'overhang', edgeIndex: i };

            const tabBody = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 8), this.overhangMat);
            tabBody.renderOrder = 9999;

            const arrow1 = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 8), this.overhangMat);
            arrow1.rotation.x = Math.PI / 2; arrow1.position.z = 6; arrow1.renderOrder = 9999;

            const arrow2 = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 8), this.overhangMat);
            arrow2.rotation.x = -Math.PI / 2; arrow2.position.z = -6; arrow2.renderOrder = 9999;

            const tRing = new THREE.Mesh(new THREE.TorusGeometry(11, 1.8, 6, 16), this.ringMat);
            tRing.rotation.x = Math.PI / 2;
            tRing.renderOrder = 9999;

            tabGroup.add(tabBody, arrow1, arrow2, tRing);

            if (i === 1) tabGroup.rotation.y = Math.PI / 2;        // East
            else if (i === 2) tabGroup.rotation.y = Math.PI;       // South
            else if (i === 3) tabGroup.rotation.y = -Math.PI / 2;   // West

            this.handles.add(tabGroup);
            this.overhangHandles.push(tabGroup);
        }

        // Boundary Corner Stretch Crystals (Dedicated Pink ⬡ Octahedron Diamonds at 4 Footprint Corners)
        this.stretchHandles = [];
        const corners = ['nw', 'ne', 'se', 'sw'];
        for (let i = 0; i < 4; i++) {
            const stretchGroup = new THREE.Group();
            stretchGroup.userData = { type: 'stretch', corner: corners[i] };

            const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(11, 0), this.stretchMat);
            diamond.renderOrder = 9999;

            const dRing = new THREE.Mesh(new THREE.TorusGeometry(13, 1.8, 6, 16), this.ringMat);
            dRing.rotation.x = Math.PI / 2;
            dRing.renderOrder = 9999;

            stretchGroup.add(diamond, dRing);

            this.handles.add(stretchGroup);
            this.stretchHandles.push(stretchGroup);
        }

        this.refreshHandleMaterials();
    }

    updateHandlePositions() {
        if (!this.target) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;
        const pts = entity.points || [];
        if (pts.length < 3) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pts.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });

        const w = maxX - minX;
        const d = maxY - minY;
        const span = Math.min(w, d);

        const pitch = conf.pitch !== undefined ? conf.pitch : 30;
        const rh = Math.tan(pitch * Math.PI / 180) * (span / 2);

        // Calculate exact 3D world position and rotation of the roof
        const worldPos = new THREE.Vector3();
        let targetGroup = this.target;
        while (targetGroup.parent && targetGroup.parent !== this.ctx.structureGroup && targetGroup.parent !== this.ctx.scene) {
            targetGroup = targetGroup.parent;
        }
        targetGroup.getWorldPosition(worldPos);

        const rot = (entity.group && typeof entity.group.rotation === 'function') ? entity.group.rotation() : (entity.rotation || 0);

        this.handles.position.set(worldPos.x, 0, worldPos.z);
        this.handles.rotation.y = -rot * Math.PI / 180;

        const baseY = worldPos.y;
        const overhang = conf.overhang !== undefined ? conf.overhang : 8;

        // Move handle (Dedicated at exact center of the roof)
        if (this.moveHandle) {
            this.moveHandle.position.set(0, baseY + rh + 16, 0);
        }

        // Spin handle (Dedicated at exact center of the roof)
        if (this.spinHandle) {
            this.spinHandle.position.set(0, baseY + rh + 16, 0);
        }

        // Apex Pitch Cone (Dedicated at the highest point of the ridge)
        if (this.peakHandle) {
            this.peakHandle.position.set(0, baseY + rh + 16, 0);
        }

        // Slope Curvature Orb (Dedicated on the middle of the North roof slope face)
        if (this.curveHandle) {
            const curveOffset = (conf.curve || 0);
            const slopeFaceY = baseY + (rh * 0.45) + curveOffset + 8;
            const slopeFaceZ = -(d * 0.28);
            this.curveHandle.position.set(0, slopeFaceY, slopeFaceZ);
        }

        // Eave Overhang Pull-Tabs (Dedicated at the 4 center eave edges)
        if (this.overhangHandles && this.overhangHandles.length >= 4) {
            const eaveY = baseY + 4;
            this.overhangHandles[0].position.set(0, eaveY, -(d / 2 + overhang + 4)); // North Eave
            this.overhangHandles[1].position.set(w / 2 + overhang + 4, eaveY, 0);  // East Eave
            this.overhangHandles[2].position.set(0, eaveY, d / 2 + overhang + 4); // South Eave
            this.overhangHandles[3].position.set(-(w / 2 + overhang + 4), eaveY, 0);  // West Eave
        }

        // Boundary Corner Stretch Crystals (Dedicated at the 4 outer footprint corners)
        if (this.stretchHandles && this.stretchHandles.length >= 4) {
            const cornerY = baseY + 4;
            const cornerOffset = overhang + 6;
            this.stretchHandles[0].position.set(-(w / 2 + cornerOffset), cornerY, -(d / 2 + cornerOffset)); // NW Corner
            this.stretchHandles[1].position.set(w / 2 + cornerOffset, cornerY, -(d / 2 + cornerOffset)); // NE Corner
            this.stretchHandles[2].position.set(w / 2 + cornerOffset, cornerY, d / 2 + cornerOffset); // SE Corner
            this.stretchHandles[3].position.set(-(w / 2 + cornerOffset), cornerY, d / 2 + cornerOffset); // SW Corner
        }
    }

    refreshHandleMaterials() {
        if (this.peakHandle) {
            const isActive = this.activeHandle === this.peakHandle;
            const isHover = this.hoveredHandle === this.peakHandle;
            const m = isActive ? this.pitchMatActive : (isHover ? this.pitchMatHover : this.pitchMat);
            this.peakHandle.children.forEach(c => { if (c.material !== this.ringMat) c.material = m; });
        }

        if (this.moveHandle) {
            const isActive = this.activeHandle === this.moveHandle;
            const isHover = this.hoveredHandle === this.moveHandle;
            const m = isActive ? this.moveMatActive : (isHover ? this.moveMatHover : this.moveMat);
            this.moveHandle.children.forEach(c => { if (c.material !== this.ringMat) c.material = m; });
        }

        if (this.spinHandle) {
            const isActive = this.activeHandle === this.spinHandle;
            const isHover = this.hoveredHandle === this.spinHandle;
            const m = isActive ? this.spinMatActive : (isHover ? this.spinMatHover : this.spinMat);
            this.spinHandle.children.forEach(c => { if (c.material !== this.ringMat) c.material = m; });
        }

        if (this.curveHandle) {
            const isActive = this.activeHandle === this.curveHandle;
            const isHover = this.hoveredHandle === this.curveHandle;
            const m = isActive ? this.curveMatActive : (isHover ? this.curveMatHover : this.curveMat);
            this.curveHandle.children.forEach(c => { if (c.material !== this.ringMat) c.material = m; });
        }

        if (this.overhangHandles) {
            this.overhangHandles.forEach(h => {
                const isActive = this.activeHandle === h;
                const isHover = this.hoveredHandle === h;
                const m = isActive ? this.overhangMatActive : (isHover ? this.overhangMatHover : this.overhangMat);
                h.children.forEach(c => { c.material = m; });
            });
        }

        if (this.stretchHandles) {
            this.stretchHandles.forEach(h => {
                const isActive = this.activeHandle === h;
                const isHover = this.hoveredHandle === h;
                const m = isActive ? this.stretchMatActive : (isHover ? this.stretchMatHover : this.stretchMat);
                h.children.forEach(c => { if (c.material !== this.ringMat) c.material = m; });
            });
        }
    }

    dispose() {
        this.detach();
        const dom = this.ctx.renderer?.domElement;
        if (dom && typeof dom.removeEventListener === 'function') {
            dom.removeEventListener('pointerdown', this._onPointerDown, true);
            dom.removeEventListener('pointermove', this._onPointerMove, false);
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('pointerup', this._onPointerUp, false);
        }
        if (this.domBadge && this.domBadge.parentElement) {
            this.domBadge.parentElement.removeChild(this.domBadge);
        }
        if (this.pitchMat) this.pitchMat.dispose();
        if (this.moveMat) this.moveMat.dispose();
        if (this.spinMat) this.spinMat.dispose();
        if (this.curveMat) this.curveMat.dispose();
        if (this.overhangMat) this.overhangMat.dispose();
        if (this.stretchMat) this.stretchMat.dispose();
    }
}

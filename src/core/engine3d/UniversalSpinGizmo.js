import * as THREE from 'three';
import { coreEventBus } from '../EventBus.js';

/**
 * UniversalSpinGizmo.js
 * 
 * World-Class 10/10 Universal 3D Spin & Protractor Turntable Gizmo.
 * 
 * Features:
 * 1. Adaptive 3D Compass & Protractor Turntable on Ground / Base Plane.
 * 2. 24 Radiant Precision Degree Notches (Cardinal 0°, 90°, 180°, 270°, 45° Bisectors, 15° Fine Ticks).
 * 3. Forward-Facing Directional Heading Indicator (+Z / Local Front Face).
 * 4. Dynamic Swept Angle Arc & Shaded Pie Wedge during active rotation.
 * 5. 4 Elevated Touch-Friendly Cardinal Grab Knobs (0°, 90°, 180°, 270°).
 * 6. True Polar Ground-Plane Raycasting Math (atan2 physics, camera-independent).
 * 7. Tactile Magnetic Snapping (15° CAD, 45° Cardinal, Free 1° on Alt, 45°/90° on Shift).
 * 8. In-Viewport 3D Floating Degree Badge.
 * 9. Responsive Glassmorphic Cross-Device Spin HUD Dock with interactive rotary scrub dial.
 * 10. In-place 60 FPS transform updates with full Undo/Redo history integration.
 */
export class UniversalSpinGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'UniversalSpinGizmo';
        this.target = null;
        this.visible = false;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Interaction State
        this.isDragging = false;
        this.activeHandle = null;
        this.hoveredHandle = null;
        this.dragPlane = new THREE.Plane();
        this.planeIntersect = new THREE.Vector3();
        this.centerWorld = new THREE.Vector3();
        
        this.initialRotation = 0;
        this.initialPointerAngle = 0;
        this.currentRotation = 0;
        this.currentRadius = 45;
        this.snapMode = 15; // 15 | 45 | 1 (free)
        this.isMagneticSnapped = false;

        // Visual Layers
        this.handles = new THREE.Group();
        this.handles.name = 'UniversalSpin_Handles';
        this.add(this.handles);

        this.staticVisuals = new THREE.Group();
        this.staticVisuals.name = 'UniversalSpin_StaticVisuals';
        this.add(this.staticVisuals);

        this.dynamicVisuals = new THREE.Group();
        this.dynamicVisuals.name = 'UniversalSpin_DynamicVisuals';
        this.add(this.dynamicVisuals);

        // High-Visibility Materials (DepthTest: false ensures crisp rendering above floor)
        this.matRing = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
        this.matRingHover = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 1.0, depthTest: false, depthWrite: false });
        this.matRingActive = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 1.0, depthTest: false, depthWrite: false });

        this.matTrack = new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
        this.matCardinal = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }); // Gold
        this.matTick = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false });
        this.matHeadingArrow = new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }); // Indigo

        this.matWedge = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.25, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
        this.matWedgeArc = new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, linewidth: 3 });

        this.matHandle = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
        this.matHandleHover = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, depthTest: false, depthWrite: false });
        this.matHandleActive = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 1.0, depthTest: false, depthWrite: false });

        // Build DOM Badges & HUD Panel
        this._createFloatingBadge();
        this._createHUDPanel();

        // Event Listeners
        this._bindEvents();
    }

    /* -------------------------------------------------------------------------- */
    /*                         LIFECYCLE & ATTACH / DETACH                        */
    /* -------------------------------------------------------------------------- */

    attach(target) {
        if (!target) return;
        this.target = target;
        this.visible = true;
        this.isDragging = false;
        this.activeHandle = null;
        this.hoveredHandle = null;

        this.updateTransformAndGeometry();
        this.showHUD();
        this.syncHUD();

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender('spin_gizmo_attach');
        }
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.isDragging = false;
        this.activeHandle = null;
        this.hoveredHandle = null;

        this._hideFloatingBadge();
        this.hideHUD();
        this._clearDynamicVisuals();

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender('spin_gizmo_detach');
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                      GEOMETRY CREATION & REBUILDING                        */
    /* -------------------------------------------------------------------------- */

    updateTransformAndGeometry() {
        if (!this.target) return;

        const entity = this.target.userData?.entity || this.target.userData?.widget || {};
        const isRoof = entity.type === 'roof' || !!this.target.userData?.isRoof || !!entity.config?.roofType;

        // Compute Bounding Box & Radius
        const box = new THREE.Box3().setFromObject(this.target);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();

        if (box.isEmpty()) {
            this.target.getWorldPosition(center);
            size.set(60, 60, 60);
        } else {
            box.getSize(size);
            box.getCenter(center);
        }

        this.centerWorld.copy(center);

        // Position Gizmo at Base Ground Level (or center base)
        const baseY = isRoof ? (box.min.y + 0.5) : (box.min.y + 0.5);
        this.position.set(center.x, baseY, center.z);

        const horizontalSpan = Math.hypot(size.x, size.z);
        const calculatedRadius = Math.max(32, Math.min(250, (horizontalSpan / 2) * 1.35));

        if (Math.abs(this.currentRadius - calculatedRadius) > 1 || this.handles.children.length === 0) {
            this.currentRadius = calculatedRadius;
            this._rebuildGizmoMeshes(this.currentRadius);
        }

        // Sync Current Rotation
        let curRot = 0;
        if (entity.rotation !== undefined) curRot = entity.rotation;
        else if (entity.group && typeof entity.group.rotation === 'function') curRot = entity.group.rotation();
        else if (this.target.rotation) curRot = -this.target.rotation.y * (180 / Math.PI);

        this.currentRotation = ((Math.round(curRot) % 360) + 360) % 360;
        this._updateHeadingArrowRotation(this.currentRotation);
    }

    _rebuildGizmoMeshes(radius) {
        // Clear Existing Handles & Static Visuals
        while (this.handles.children.length > 0) {
            const child = this.handles.children[0];
            this.handles.remove(child);
        }
        while (this.staticVisuals.children.length > 0) {
            const child = this.staticVisuals.children[0];
            this.staticVisuals.remove(child);
        }

        const tubeThickness = Math.max(0.8, Math.min(2.5, radius * 0.035));

        // 1. Semi-Transparent Background Dark Glass Track Disc
        const trackGeo = new THREE.RingGeometry(radius * 0.85, radius * 1.15, 64);
        trackGeo.rotateX(-Math.PI / 2);
        const trackMesh = new THREE.Mesh(trackGeo, this.matTrack);
        trackMesh.renderOrder = 9990;
        trackMesh.userData = { isGizmoNonInteractive: true };
        this.staticVisuals.add(trackMesh);

        // 2. Outer Radiant Interactive Grab Ring (Torus)
        const ringGeo = new THREE.TorusGeometry(radius, tubeThickness, 16, 64);
        ringGeo.rotateX(Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeo, this.matRing);
        ringMesh.renderOrder = 9998;
        ringMesh.userData = { type: 'ring', isUniversalSpinHandle: true };
        this.handles.add(ringMesh);

        // 3. Inner Concentric Subtle Accent Ring
        const innerRingGeo = new THREE.TorusGeometry(radius * 0.86, tubeThickness * 0.35, 12, 64);
        innerRingGeo.rotateX(Math.PI / 2);
        const innerRing = new THREE.Mesh(innerRingGeo, this.matTick);
        innerRing.renderOrder = 9991;
        this.staticVisuals.add(innerRing);

        // 4. 24 Precision Degree Ticks (0°, 15°, 30°, 45°, 60°, 75°, 90°, ...)
        const ticksGroup = new THREE.Group();
        ticksGroup.name = 'TicksGroup';

        for (let deg = 0; deg < 360; deg += 15) {
            const rad = deg * Math.PI / 180;
            const isCardinal = (deg % 90 === 0);
            const isMajor45 = (deg % 45 === 0 && !isCardinal);

            const innerR = radius * (isCardinal ? 0.72 : (isMajor45 ? 0.78 : 0.84));
            const outerR = radius * (isCardinal ? 1.22 : (isMajor45 ? 1.14 : 1.10));

            const x1 = Math.sin(rad) * innerR;
            const z1 = Math.cos(rad) * innerR;
            const x2 = Math.sin(rad) * outerR;
            const z2 = Math.cos(rad) * outerR;

            const tickMat = isCardinal ? this.matCardinal : (isMajor45 ? this.matRingHover : this.matTick);
            const tickGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x1, 0.1, z1),
                new THREE.Vector3(x2, 0.1, z2)
            ]);
            const tickLine = new THREE.Line(tickGeo, tickMat);
            tickLine.renderOrder = 9992;
            ticksGroup.add(tickLine);

            // Cardinal Marker Pins (0°, 90°, 180°, 270°)
            if (isCardinal) {
                const diamondGeo = new THREE.ConeGeometry(tubeThickness * 1.8, tubeThickness * 3.5, 4);
                diamondGeo.rotateX(Math.PI / 2);
                diamondGeo.rotateY(rad);
                const pin = new THREE.Mesh(diamondGeo, this.matCardinal);
                pin.position.set(Math.sin(rad) * (radius * 1.25), 0.2, Math.cos(rad) * (radius * 1.25));
                pin.renderOrder = 9995;
                ticksGroup.add(pin);
            }
        }
        this.staticVisuals.add(ticksGroup);

        // 5. 4 Elevated Touch-Friendly Cardinal Grab Knobs (0°, 90°, 180°, 270°)
        const knobAngles = [0, 90, 180, 270];
        const knobRadius = Math.max(2.2, radius * 0.07);

        knobAngles.forEach(deg => {
            const rad = deg * Math.PI / 180;
            const knobGroup = new THREE.Group();
            knobGroup.position.set(Math.sin(rad) * radius, 0.2, Math.cos(rad) * radius);
            knobGroup.userData = { type: 'cardinalKnob', angleDeg: deg, isUniversalSpinHandle: true };

            const sphere = new THREE.Mesh(new THREE.SphereGeometry(knobRadius, 16, 16), this.matHandle);
            sphere.renderOrder = 9999;
            sphere.userData = { type: 'cardinalKnob', angleDeg: deg, isUniversalSpinHandle: true };

            const halo = new THREE.Mesh(new THREE.TorusGeometry(knobRadius * 1.35, knobRadius * 0.2, 8, 24), this.matCardinal);
            halo.rotateX(Math.PI / 2);
            halo.renderOrder = 9999;
            halo.userData = { type: 'cardinalKnob', angleDeg: deg, isUniversalSpinHandle: true };

            knobGroup.add(sphere, halo);
            this.handles.add(knobGroup);
        });

        // 6. Forward Heading Indicator (+Z / Local Front Face Arrow)
        const headingGroup = new THREE.Group();
        headingGroup.name = 'HeadingArrowGroup';

        const arrowShaft = new THREE.Mesh(new THREE.CylinderGeometry(tubeThickness * 0.4, tubeThickness * 0.4, radius * 0.65, 8), this.matHeadingArrow);
        arrowShaft.rotateX(Math.PI / 2);
        arrowShaft.position.set(0, 0.2, radius * 0.35);
        arrowShaft.renderOrder = 9996;

        const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(tubeThickness * 1.9, tubeThickness * 4.2, 16), this.matHeadingArrow);
        arrowHead.rotateX(Math.PI / 2);
        arrowHead.position.set(0, 0.2, radius * 0.72);
        arrowHead.renderOrder = 9997;

        headingGroup.add(arrowShaft, arrowHead);
        this.staticVisuals.add(headingGroup);
        this.headingArrowGroup = headingGroup;
    }

    _updateHeadingArrowRotation(rotDeg) {
        if (!this.headingArrowGroup) return;
        const rad = -rotDeg * (Math.PI / 180);
        this.headingArrowGroup.rotation.y = rad;
    }

    /* -------------------------------------------------------------------------- */
    /*                         DYNAMIC SWEPT ANGLE WEDGE                          */
    /* -------------------------------------------------------------------------- */

    _updateDynamicSweptArc(startDeg, curDeg) {
        this._clearDynamicVisuals();

        let deltaDeg = curDeg - startDeg;
        if (Math.abs(deltaDeg) < 0.5) return;

        // Construct 2D Sector Shape
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);

        const startRad = (-startDeg + 90) * Math.PI / 180;
        const curRad = (-curDeg + 90) * Math.PI / 180;

        const clockwise = deltaDeg > 0;
        shape.absarc(0, 0, this.currentRadius, startRad, curRad, clockwise);
        shape.lineTo(0, 0);

        const wedgeGeo = new THREE.ShapeGeometry(shape, 32);
        wedgeGeo.rotateX(Math.PI / 2);

        const wedgeMesh = new THREE.Mesh(wedgeGeo, this.matWedge);
        wedgeMesh.position.y = 0.15;
        wedgeMesh.renderOrder = 9993;
        this.dynamicVisuals.add(wedgeMesh);

        // Swept Arc Line
        const arcCurve = new THREE.EllipseCurve(0, 0, this.currentRadius, this.currentRadius, startRad, curRad, clockwise, 0);
        const points = arcCurve.getPoints(32).map(p => new THREE.Vector3(p.x, 0.25, -p.y));
        const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
        const arcLine = new THREE.Line(arcGeo, this.matWedgeArc);
        arcLine.renderOrder = 9994;
        this.dynamicVisuals.add(arcLine);
    }

    _clearDynamicVisuals() {
        while (this.dynamicVisuals.children.length > 0) {
            const child = this.dynamicVisuals.children[0];
            this.dynamicVisuals.remove(child);
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                           POINTER & DRAG EVENTS                            */
    /* -------------------------------------------------------------------------- */

    _bindEvents() {
        const dom = this.ctx.renderer?.domElement || window;

        this._onPointerDown = (e) => {
            if (!this.visible || !this.target) return;
            if (e.button !== 0) return; // Left-click only for gizmo handles

            this._updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

            const intersects = this.raycaster.intersectObjects(this.handles.children, true);
            if (intersects.length > 0) {
                e.preventDefault();
                e.stopPropagation();

                let handleObj = intersects[0].object;
                this.activeHandle = handleObj;
                this.isDragging = true;

                // Configure Horizontal Drag Plane at Gizmo Base Height
                this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), this.position);

                if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
                    this.initialPointerAngle = Math.atan2(
                        this.planeIntersect.z - this.position.z,
                        this.planeIntersect.x - this.position.x
                    ) * (180 / Math.PI);
                }

                const entity = this.target.userData?.entity || this.target.userData?.widget || {};
                this.initialRotation = entity.rotation !== undefined ? entity.rotation : (this.currentRotation || 0);

                this._setHandlesActive(true);
                if (this.ctx.controls) this.ctx.controls.enabled = false;

                this._showFloatingBadge(`SPIN: ${Math.round(this.initialRotation)}°`, e.clientX, e.clientY);
                if (this.ctx.requestRender) this.ctx.requestRender('spin_drag_start');
            }
        };

        this._onPointerMove = (e) => {
            if (!this.visible || !this.target) return;
            this._updateMouse(e);

            if (!this.isDragging) {
                // Raycast handles for hover effects
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const intersects = this.raycaster.intersectObjects(this.handles.children, true);

                if (intersects.length > 0) {
                    const handleObj = intersects[0].object;
                    if (this.hoveredHandle !== handleObj) {
                        this.hoveredHandle = handleObj;
                        this._setHandleHover(true);
                        const domEl = this.ctx.renderer?.domElement;
                        if (domEl) domEl.style.cursor = 'grab';
                        if (this.ctx.requestRender) this.ctx.requestRender('spin_handle_hover');
                    }
                } else if (this.hoveredHandle) {
                    this.hoveredHandle = null;
                    this._setHandleHover(false);
                    const domEl = this.ctx.renderer?.domElement;
                    if (domEl) domEl.style.cursor = 'auto';
                    if (this.ctx.requestRender) this.ctx.requestRender('spin_handle_unhover');
                }
                return;
            }

            // Dragging: Compute Polar Ground Angle
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
                const currentPointerAngle = Math.atan2(
                    this.planeIntersect.z - this.position.z,
                    this.planeIntersect.x - this.position.x
                ) * (180 / Math.PI);

                const angleDelta = -(currentPointerAngle - this.initialPointerAngle);
                let newRot = this.initialRotation + angleDelta;

                // Smart Magnetic Snapping
                newRot = this._applyMagneticSnapping(newRot, e);
                newRot = ((Math.round(newRot) % 360) + 360) % 360;

                this.currentRotation = newRot;
                this._applyRotationToEntity(newRot);

                this._updateHeadingArrowRotation(newRot);
                this._updateDynamicSweptArc(this.initialRotation, newRot);
                this.syncHUD();

                const snapTag = this.isMagneticSnapped ? `<span style="color:#22c55e; font-weight:800; margin-left:4px;">[SNAP ${this.snapMode}°]</span>` : '';
                this._showFloatingBadge(`SPIN: ${newRot.toFixed(0)}° ${snapTag}`, e.clientX, e.clientY);

                if (this.ctx.requestRender) this.ctx.requestRender('spin_dragging');
            }
        };

        this._onPointerUp = (e) => {
            if (!this.isDragging) return;

            this.isDragging = false;
            this.activeHandle = null;
            this._setHandlesActive(false);
            this._clearDynamicVisuals();
            this._hideFloatingBadge();

            if (this.ctx.controls) this.ctx.controls.enabled = true;
            const domEl = this.ctx.renderer?.domElement;
            if (domEl) domEl.style.cursor = 'auto';

            // Commit rotation to Planner History for Undo/Redo
            this._commitRotationToPlanner();

            if (this.ctx.requestRender) this.ctx.requestRender('spin_drag_end');
        };

        const targetDom = this.ctx.renderer?.domElement || window;
        targetDom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        window.addEventListener('pointermove', this._onPointerMove, { passive: false });
        window.addEventListener('pointerup', this._onPointerUp, { passive: false });
    }

    _updateMouse(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    /* -------------------------------------------------------------------------- */
    /*                         MAGNETIC SNAPPING ENGINE                           */
    /* -------------------------------------------------------------------------- */

    _applyMagneticSnapping(rawAngle, e) {
        // Holding Alt forces continuous 0.1° free rotation
        if (e && e.altKey) {
            this.isMagneticSnapped = false;
            return rawAngle;
        }

        // Holding Shift forces 45° CAD angle locking
        const step = (e && e.shiftKey) ? 45 : this.snapMode;
        if (step <= 1) {
            this.isMagneticSnapped = false;
            return rawAngle;
        }

        const snapped = Math.round(rawAngle / step) * step;
        const diff = Math.abs(rawAngle - snapped);

        // 3.5° Magnetic Latch Zone
        if (diff <= 3.5 || (e && e.shiftKey)) {
            this.isMagneticSnapped = true;
            return snapped;
        }

        this.isMagneticSnapped = false;
        return rawAngle;
    }

    /* -------------------------------------------------------------------------- */
    /*                         IN-PLACE ROTATION DISPATCH                         */
    /* -------------------------------------------------------------------------- */

    _applyRotationToEntity(angleDeg) {
        if (!this.target) return;
        const entity = this.target.userData?.entity || this.target.userData?.widget;
        if (!entity) return;

        if (this.ctx.commonController?.transformEngine) {
            this.ctx.commonController.transformEngine.executeSpin(entity, 0, angleDeg);
        } else {
            entity.rotation = angleDeg;
            if (entity.mesh3D) {
                entity.mesh3D.rotation.y = -(angleDeg * Math.PI / 180);
            }
            if (entity.group && typeof entity.group.rotation === 'function') {
                entity.group.rotation(angleDeg);
            }
        }
    }

    _commitRotationToPlanner() {
        if (!this.target) return;
        const entity = this.target.userData?.entity || this.target.userData?.widget;
        if (!entity) return;

        const id = entity.id || (entity.group && typeof entity.group.id === 'function' ? entity.group.id() : null);
        const plannerInst = window.planner?.value || window.planner;
        if (plannerInst && typeof plannerInst.rotate === 'function' && id) {
            plannerInst.rotate(id, this.currentRotation);
        }

        coreEventBus.emit('EntityTransformUpdated', {
            entity,
            rotation: this.currentRotation
        });
    }

    /* -------------------------------------------------------------------------- */
    /*                         VISUAL MATERIAL HIGHLIGHTS                         */
    /* -------------------------------------------------------------------------- */

    _setHandleHover(hovered) {
        this.handles.traverse(child => {
            if (child.isMesh && child.userData.type === 'ring') {
                child.material = hovered ? this.matRingHover : this.matRing;
            } else if (child.isMesh && child.userData.type === 'cardinalKnob') {
                child.material = hovered ? this.matHandleHover : this.matHandle;
            }
        });
    }

    _setHandlesActive(active) {
        this.handles.traverse(child => {
            if (child.isMesh && child.userData.type === 'ring') {
                child.material = active ? this.matRingActive : this.matRing;
            } else if (child.isMesh && child.userData.type === 'cardinalKnob') {
                child.material = active ? this.matHandleActive : this.matHandle;
            }
        });
    }

    /* -------------------------------------------------------------------------- */
    /*                         FLOATING IN-VIEWPORT BADGE                         */
    /* -------------------------------------------------------------------------- */

    _createFloatingBadge() {
        this.badge = document.createElement('div');
        this.badge.className = 'universal-spin-badge';
        this.badge.style.cssText = `
            position: fixed; display: none; pointer-events: none; z-index: 10000;
            background: rgba(15, 23, 42, 0.92); color: #00f0ff;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 20px;
            box-shadow: 0 4px 20px rgba(0, 240, 255, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            transform: translate(-50%, -140%); transition: opacity 0.15s ease;
            white-space: nowrap; letter-spacing: 0.5px;
        `;
        document.body.appendChild(this.badge);
    }

    _showFloatingBadge(text, clientX, clientY) {
        if (!this.badge) return;
        this.badge.innerHTML = text;
        this.badge.style.left = `${clientX}px`;
        this.badge.style.top = `${clientY}px`;
        this.badge.style.display = 'block';
        this.badge.style.opacity = '1';
    }

    _hideFloatingBadge() {
        if (!this.badge) return;
        this.badge.style.display = 'none';
        this.badge.style.opacity = '0';
    }

    /* -------------------------------------------------------------------------- */
    /*                    RESPONSIVE CROSS-DEVICE SPIN HUD DOCK                   */
    /* -------------------------------------------------------------------------- */

    _createHUDPanel() {
        this.hudPanel = document.createElement('div');
        this.hudPanel.className = 'universal-spin-hud-panel';
        this.hudPanel.style.cssText = `
            position: fixed; bottom: 85px; left: 50%; transform: translateX(-50%);
            display: none; flex-direction: column; gap: 10px; min-width: 320px; max-width: 92vw;
            background: rgba(15, 23, 42, 0.96); color: white; padding: 14px 18px;
            border-radius: 18px; border: 1.5px solid rgba(0, 240, 255, 0.5);
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 24px rgba(0, 240, 255, 0.25);
            backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
            z-index: 100000; font-family: 'Inter', system-ui, -apple-system, sans-serif;
            pointer-events: auto; user-select: none;
        `;

        this.hudPanel.innerHTML = `
            <!-- Header: Title & Live Angle Badge -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: rgba(0, 240, 255, 0.2); color: #00f0ff; font-size: 13px;">⭮</span>
                    <span style="font-size: 12px; font-weight: 800; color: #f8fafc; letter-spacing: 0.6px;">UNIVERSAL SPIN</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span id="spin-hud-cardinal-tag" style="font-size: 10px; font-weight: 700; color: #94a3b8; background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px;">FRONT</span>
                    <span id="spin-hud-angle-display" style="font-size: 14px; font-weight: 800; color: #00f0ff; min-width: 44px; text-align: right;">0°</span>
                </div>
            </div>

            <!-- Rotary Scrub Jog-Wheel & Micro-Step Controls -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0;">
                <button id="spin-btn-step-ccw45" class="spin-hud-btn" style="flex: 1; padding: 7px 4px; font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; border-radius: 8px; cursor: pointer;">↺ -45°</button>
                <button id="spin-btn-step-ccw15" class="spin-hud-btn" style="flex: 1; padding: 7px 4px; font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; border-radius: 8px; cursor: pointer;">↺ -15°</button>
                
                <!-- Interactive Touch Rotary Scrub Wheel -->
                <div id="spin-hud-jog-wheel" style="width: 52px; height: 52px; border-radius: 50%; background: radial-gradient(circle, #1e293b 0%, #0f172a 100%); border: 2px solid #00f0ff; position: relative; cursor: ew-resize; touch-action: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(0, 240, 255, 0.3);">
                    <div id="spin-hud-jog-indicator" style="position: absolute; top: 4px; width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></div>
                    <span style="font-size: 16px; color: #00f0ff;">↻</span>
                </div>

                <button id="spin-btn-step-cw15" class="spin-hud-btn" style="flex: 1; padding: 7px 4px; font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; border-radius: 8px; cursor: pointer;">↻ +15°</button>
                <button id="spin-btn-step-cw45" class="spin-hud-btn" style="flex: 1; padding: 7px 4px; font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; border-radius: 8px; cursor: pointer;">↻ +45°</button>
            </div>

            <!-- Cardinal Presets (0° N, 90° E, 180° S, 270° W) & 180° Flip -->
            <div style="display: flex; gap: 6px;">
                <button class="spin-hud-preset-btn" data-angle="0" style="flex: 1; padding: 6px; font-size: 11px; font-weight: 700; background: rgba(0, 240, 255, 0.12); border: 1px solid rgba(0, 240, 255, 0.3); color: #38bdf8; border-radius: 6px; cursor: pointer;">0° N</button>
                <button class="spin-hud-preset-btn" data-angle="90" style="flex: 1; padding: 6px; font-size: 11px; font-weight: 700; background: rgba(0, 240, 255, 0.12); border: 1px solid rgba(0, 240, 255, 0.3); color: #38bdf8; border-radius: 6px; cursor: pointer;">90° E</button>
                <button class="spin-hud-preset-btn" data-angle="180" style="flex: 1; padding: 6px; font-size: 11px; font-weight: 700; background: rgba(0, 240, 255, 0.12); border: 1px solid rgba(0, 240, 255, 0.3); color: #38bdf8; border-radius: 6px; cursor: pointer;">180° S</button>
                <button class="spin-hud-preset-btn" data-angle="270" style="flex: 1; padding: 6px; font-size: 11px; font-weight: 700; background: rgba(0, 240, 255, 0.12); border: 1px solid rgba(0, 240, 255, 0.3); color: #38bdf8; border-radius: 6px; cursor: pointer;">270° W</button>
                <button id="spin-btn-flip180" style="flex: 1.3; padding: 6px; font-size: 11px; font-weight: 700; background: rgba(245, 158, 11, 0.18); border: 1px solid rgba(245, 158, 11, 0.45); color: #fde047; border-radius: 6px; cursor: pointer;">⇄ 180° Flip</button>
            </div>

            <!-- Snap Selector & Direct Numeric Input -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <div style="display: flex; gap: 4px; align-items: center;">
                    <span style="font-size: 10px; color: #94a3b8; font-weight: 700;">SNAP:</span>
                    <button class="spin-snap-mode-btn active" data-snap="15" style="padding: 3px 7px; font-size: 10px; font-weight: 700; border-radius: 4px; background: #00f0ff; color: #0f172a; border: none; cursor: pointer;">15°</button>
                    <button class="spin-snap-mode-btn" data-snap="45" style="padding: 3px 7px; font-size: 10px; font-weight: 700; border-radius: 4px; background: rgba(255,255,255,0.1); color: white; border: none; cursor: pointer;">45°</button>
                    <button class="spin-snap-mode-btn" data-snap="1" style="padding: 3px 7px; font-size: 10px; font-weight: 700; border-radius: 4px; background: rgba(255,255,255,0.1); color: white; border: none; cursor: pointer;">FREE</button>
                </div>
                
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 10px; color: #94a3b8;">Angle:</span>
                    <input type="number" id="spin-hud-num-input" min="0" max="360" step="1" value="0" style="width: 48px; background: rgba(0,0,0,0.4); border: 1px solid rgba(0,240,255,0.4); color: white; border-radius: 6px; padding: 3px 5px; font-size: 11px; font-weight: 700; text-align: right; outline: none;">
                    <span style="font-size: 11px; color: #94a3b8;">°</span>
                </div>
            </div>
        `;

        this.hudPanel.addEventListener('pointerdown', e => e.stopPropagation());
        document.body.appendChild(this.hudPanel);

        this._initHUDPanelEvents();
    }

    _initHUDPanelEvents() {
        if (!this.hudPanel) return;

        // Step Buttons
        const btnCcw45 = this.hudPanel.querySelector('#spin-btn-step-ccw45');
        const btnCcw15 = this.hudPanel.querySelector('#spin-btn-step-ccw15');
        const btnCw15 = this.hudPanel.querySelector('#spin-btn-step-cw15');
        const btnCw45 = this.hudPanel.querySelector('#spin-btn-step-cw45');
        const btnFlip = this.hudPanel.querySelector('#spin-btn-flip180');

        const stepRotate = (deltaDeg) => {
            let targetAngle = ((Math.round(this.currentRotation + deltaDeg) % 360) + 360) % 360;
            if (this.snapMode > 1) {
                targetAngle = Math.round(targetAngle / this.snapMode) * this.snapMode;
            }
            targetAngle = ((targetAngle % 360) + 360) % 360;
            this.currentRotation = targetAngle;
            this._applyRotationToEntity(targetAngle);
            this._updateHeadingArrowRotation(targetAngle);
            this._commitRotationToPlanner();
            this.syncHUD();
            if (this.ctx.requestRender) this.ctx.requestRender('spin_step');
        };

        if (btnCcw45) btnCcw45.onclick = () => stepRotate(-45);
        if (btnCcw15) btnCcw15.onclick = () => stepRotate(-15);
        if (btnCw15) btnCw15.onclick = () => stepRotate(15);
        if (btnCw45) btnCw45.onclick = () => stepRotate(45);
        if (btnFlip) btnFlip.onclick = () => stepRotate(180);

        // Cardinal Presets
        const presets = this.hudPanel.querySelectorAll('.spin-hud-preset-btn');
        presets.forEach(btn => {
            btn.onclick = () => {
                const angle = parseInt(btn.getAttribute('data-angle'), 10) || 0;
                this.currentRotation = angle;
                this._applyRotationToEntity(angle);
                this._updateHeadingArrowRotation(angle);
                this._commitRotationToPlanner();
                this.syncHUD();
                if (this.ctx.requestRender) this.ctx.requestRender('spin_preset');
            };
        });

        // Snap Mode Buttons
        const snapBtns = this.hudPanel.querySelectorAll('.spin-snap-mode-btn');
        snapBtns.forEach(btn => {
            btn.onclick = () => {
                snapBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'rgba(255,255,255,0.1)';
                    b.style.color = 'white';
                });
                btn.classList.add('active');
                btn.style.background = '#00f0ff';
                btn.style.color = '#0f172a';
                this.snapMode = parseInt(btn.getAttribute('data-snap'), 10) || 15;
            };
        });

        // Direct Number Input
        const numInput = this.hudPanel.querySelector('#spin-hud-num-input');
        if (numInput) {
            numInput.onchange = (e) => {
                let val = parseFloat(e.target.value) || 0;
                val = ((Math.round(val) % 360) + 360) % 360;
                this.currentRotation = val;
                this._applyRotationToEntity(val);
                this._updateHeadingArrowRotation(val);
                this._commitRotationToPlanner();
                this.syncHUD();
                if (this.ctx.requestRender) this.ctx.requestRender('spin_manual_input');
            };
        }

        // Rotary Scrub Jog-Wheel Interaction (Touch & Mouse)
        const jogWheel = this.hudPanel.querySelector('#spin-hud-jog-wheel');
        if (jogWheel) {
            let isJogging = false;
            let jogStartAngle = 0;
            let jogInitialEntityAngle = 0;

            const onJogDown = (e) => {
                isJogging = true;
                const rect = jogWheel.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                jogStartAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
                jogInitialEntityAngle = this.currentRotation;
                e.preventDefault();
                e.stopPropagation();
            };

            const onJogMove = (e) => {
                if (!isJogging) return;
                const rect = jogWheel.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const curAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
                let delta = curAngle - jogStartAngle;

                let targetAngle = jogInitialEntityAngle + delta;
                if (this.snapMode > 1 && !e.altKey) {
                    targetAngle = Math.round(targetAngle / this.snapMode) * this.snapMode;
                }
                targetAngle = ((Math.round(targetAngle) % 360) + 360) % 360;

                this.currentRotation = targetAngle;
                this._applyRotationToEntity(targetAngle);
                this._updateHeadingArrowRotation(targetAngle);
                this.syncHUD();
                if (this.ctx.requestRender) this.ctx.requestRender('spin_jog_wheel');
            };

            const onJogUp = () => {
                if (!isJogging) return;
                isJogging = false;
                this._commitRotationToPlanner();
            };

            jogWheel.addEventListener('pointerdown', onJogDown);
            window.addEventListener('pointermove', onJogMove);
            window.addEventListener('pointerup', onJogUp);
        }
    }

    showHUD() {
        if (this.hudPanel) {
            this.hudPanel.style.display = 'flex';
        }
    }

    hideHUD() {
        if (this.hudPanel) {
            this.hudPanel.style.display = 'none';
        }
    }

    syncHUD() {
        if (!this.hudPanel) return;

        const angleDisplay = this.hudPanel.querySelector('#spin-hud-angle-display');
        const numInput = this.hudPanel.querySelector('#spin-hud-num-input');
        const cardinalTag = this.hudPanel.querySelector('#spin-hud-cardinal-tag');
        const jogIndicator = this.hudPanel.querySelector('#spin-hud-jog-indicator');

        const deg = Math.round(this.currentRotation);
        if (angleDisplay) angleDisplay.innerText = `${deg}°`;
        if (numInput && document.activeElement !== numInput) numInput.value = deg;

        // Cardinal Tag
        if (cardinalTag) {
            let tag = 'CUSTOM';
            if (deg === 0 || deg === 360) tag = 'FRONT (0°)';
            else if (deg === 90) tag = 'RIGHT (90°)';
            else if (deg === 180) tag = 'BACK (180°)';
            else if (deg === 270) tag = 'LEFT (270°)';
            else if (deg === 45) tag = 'NE (45°)';
            else if (deg === 135) tag = 'SE (135°)';
            else if (deg === 225) tag = 'SW (225°)';
            else if (deg === 315) tag = 'NW (315°)';
            cardinalTag.innerText = tag;
        }

        // Rotate Jog Indicator
        if (jogIndicator) {
            const rad = deg * Math.PI / 180;
            const r = 20;
            const x = Math.sin(rad) * r;
            const y = -Math.cos(rad) * r;
            jogIndicator.style.transform = `translate(${x}px, ${y}px)`;
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                              CLEANUP & DISPOSE                             */
    /* -------------------------------------------------------------------------- */

    dispose() {
        this.detach();
        if (this.badge && this.badge.parentNode) {
            this.badge.parentNode.removeChild(this.badge);
        }
        if (this.hudPanel && this.hudPanel.parentNode) {
            this.hudPanel.parentNode.removeChild(this.hudPanel);
        }
    }
}

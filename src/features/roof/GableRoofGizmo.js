import * as THREE from 'three';
import { EVENTS } from '../../core/registry.js';
import { coreEventBus } from '../../core/EventBus.js';
import { offsetPolygon } from '../../core/registry.js';
import { RoofEngine } from '../../core/roof/RoofEngine.js';
import { RoofGeometryEngine } from '../../core/roof/RoofGeometryEngine.js';

/**
 * GableRoofGizmo
 * 
 * Dedicated CAD-Style In-Viewport 3D Interactive Gizmo for Gable Roofs.
 * Completely independent from flat and generic pitched roof gizmos.
 * 
 * Capabilities:
 * 1. Dedicated Ridge Apex Peak Handle:
 *    - Positioned along the ridge apex line with ridge tube aligned to ridgeAxis ('x' | 'y').
 *    - Vertical drag accurately adjusts pitch degrees and peak height based on true gable span.
 *    - Live CAD dimension badge showing: `GABLE PITCH: 30° | Peak: 4' 11" (150cm)`.
 * 2. Distinct Eaves vs Gable Rakes Edge Handles:
 *    - Eave Handles (Cobalt Blue): Positioned at the base low gutters. Dragging adjusts eave overhang.
 *    - Gable Rake Handles (Royal Purple): Positioned at triangular gable ends. Dragging adjusts rake overhang.
 *    - Single-edge modification by default; Shift-drag modifies all eaves or all rakes simultaneously.
 * 3. Footprint Corner Vertex Handles:
 *    - Pink Octahedron crystals at the 4 footprint corners for CAD sizing.
 * 4. In-Scene Floating HUD Toolbar:
 *    - Quick 1-click actions:
 *      - `⇄ Flip Ridge Axis (X / Y)`
 *      - `△ Auto Walls (ON / OFF)`
 *      - `🎨 Material`
 *      - `Pitch - / +`
 *      - `⇥ Flush (0")` and `↔ Overhang 8"`
 * 5. Full Mode Separation:
 *    - `corners`: Shape mode with ridge, eaves, rakes, and corners.
 *    - `move`: Emerald 4-way compass pan icon at roof center.
 *    - `spin`: Indigo rotation wheel with 15° snap increments.
 * 6. Slope Curvature Control:
 *    - Dedicated Cyan sphere on the roof slope allowing interactive vertical drag for pagoda (concave) or barrel (convex) arching.
 *    - In-HUD buttons for 1-click -5 / +5 curve steps and 0 (straight) reset.
 */
export class GableRoofGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'GableRoofGizmo';
        this.mode = 'corners'; // 'corners' | 'move' | 'spin'
        this.target = null;
        this.handles = new THREE.Group();
        this.handles.name = 'GableRoofHandles';
        this.add(this.handles);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.visible = false;

        // Visual Materials (depthTest: false ensures handles render crisp and un-occluded)
        // Ridge Apex Pitch (Gold / Amber)
        this.pitchMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 });
        this.pitchMatHover = new THREE.MeshBasicMaterial({ color: 0xfde047, depthTest: false, transparent: true, opacity: 1.0 });
        this.pitchMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        // Eave Overhang (Cobalt Blue)
        this.eaveMat = new THREE.MeshBasicMaterial({ color: 0x2563eb, depthTest: false, transparent: true, opacity: 0.95 });
        this.eaveMatHover = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false, transparent: true, opacity: 1.0 });
        this.eaveMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        // Gable End Rake Overhang (Royal Purple / Violet)
        this.rakeMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, depthTest: false, transparent: true, opacity: 0.95 });
        this.rakeMatHover = new THREE.MeshBasicMaterial({ color: 0xa78bfa, depthTest: false, transparent: true, opacity: 1.0 });
        this.rakeMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        // Corner Stretch Crystals (Pink)
        this.cornerMat = new THREE.MeshBasicMaterial({ color: 0xec4899, depthTest: false, transparent: true, opacity: 0.95 });
        this.cornerMatHover = new THREE.MeshBasicMaterial({ color: 0xf472b6, depthTest: false, transparent: true, opacity: 1.0 });
        this.cornerMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        // Move Compass (Emerald)
        this.moveMat = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.moveMatHover = new THREE.MeshBasicMaterial({ color: 0x34d399, depthTest: false, transparent: true, opacity: 1.0 });
        this.moveMatActive = new THREE.MeshBasicMaterial({ color: 0x059669, depthTest: false, transparent: true, opacity: 1.0 });

        // Spin Wheel (Indigo)
        this.spinMat = new THREE.MeshBasicMaterial({ color: 0x6366f1, depthTest: false, transparent: true, opacity: 0.95 });
        this.spinMatHover = new THREE.MeshBasicMaterial({ color: 0x818cf8, depthTest: false, transparent: true, opacity: 1.0 });
        this.spinMatActive = new THREE.MeshBasicMaterial({ color: 0x4f46e5, depthTest: false, transparent: true, opacity: 1.0 });

        // Accents
        this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.9 });
        this.ridgeTubeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, depthTest: false, transparent: true, opacity: 0.9 });

        // Slope Curvature (Cyan / Teal)
        this.curveMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, depthTest: false, transparent: true, opacity: 0.95 });
        this.curveMatHover = new THREE.MeshBasicMaterial({ color: 0x67e8f9, depthTest: false, transparent: true, opacity: 1.0 });
        this.curveMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.activeHandle = null;
        this.hoveredHandle = null;
        this.isDragging = false;
        this.dragPlane = new THREE.Plane();
        this.dragStartPos = new THREE.Vector3();
        this.planeIntersect = new THREE.Vector3();

        this.initialPitch = 30;
        this.initialRh = 30;
        this.initialCurve = 0;
        this.initialOverhang = 8;
        this.initialOverhangs = [];
        this.initialRidgeAxis = 'x';
        this.initialPoints = [];
        this.initialMinX = 0;
        this.initialMaxX = 0;
        this.initialMinY = 0;
        this.initialMaxY = 0;
        this.initialGroupX = 0;
        this.initialGroupZ = 0;
        this.initialCenterX = 0;
        this.initialCenterZ = 0;
        this.initialRotation = 0;
        this.initialAngle = 0;

        this.peakHandle = null;
        this.curveHandle = null;
        this.edgeHandles = [];
        this.cornerHandles = [];
        this.moveHandle = null;
        this.spinHandle = null;

        this._createDOMBadge();
        this._createDOMHUD();

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
                const numEdges = entity.points?.length || 4;

                if (!conf.overhangs || !Array.isArray(conf.overhangs) || conf.overhangs.length !== numEdges) {
                    conf.overhangs = Array(numEdges).fill(conf.overhang !== undefined ? conf.overhang : 8);
                }
                this.initialOverhangs = [...conf.overhangs];
                this.initialPitch = conf.pitch !== undefined ? conf.pitch : 30;
                this.initialCurve = conf.curve !== undefined ? conf.curve : 0;
                let pts = entity.points;
                if (!pts || !Array.isArray(pts) || pts.length < 3) {
                    pts = [{ x: -100, y: -80 }, { x: 100, y: -80 }, { x: 100, y: 80 }, { x: -100, y: 80 }];
                }
                this.initialPoints = pts.map(p => ({ x: p.x, y: p.y }));

                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                this.initialPoints.forEach(p => {
                    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                });
                this.initialMinX = minX;
                this.initialMaxX = maxX;
                this.initialMinY = minY;
                this.initialMaxY = maxY;

                const w = maxX - minX, d = maxY - minY;
                const span = (this.initialRidgeAxis === 'x' ? d : w);
                this.initialRh = Math.tan(this.initialPitch * Math.PI / 180) * (span / 2);

                const type = handle.userData?.type;
                if (type === 'pitch' || type === 'curve') {
                    // Vertical drag plane facing camera
                    const camDir = this.ctx.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate();
                    this.dragPlane.setFromNormalAndCoplanarPoint(camDir, intersects[0].point);
                } else if (type === 'edge') {
                    const edgeIdx = handle.userData?.edgeIndex ?? 0;
                    this.initialOverhang = this.initialOverhangs[edgeIdx] !== undefined ? this.initialOverhangs[edgeIdx] : (conf.overhang || 8);
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), intersects[0].point);
                } else {
                    // Horizontal drag plane (XZ)
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), intersects[0].point);
                }

                this.dragStartPos.copy(intersects[0].point);
                this.initialGroupX = (entity.group && typeof entity.group.x === 'function') ? entity.group.x() : (entity.x || 0);
                this.initialGroupZ = (entity.group && typeof entity.group.y === 'function') ? entity.group.y() : (entity.y || 0);
                this.initialCenterX = (minX + maxX) / 2;
                this.initialCenterZ = (minY + maxY) / 2;
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
                return;
            }

            // Handle active drag
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
                const entity = this.target.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const type = this.activeHandle.userData?.type;

                const rot = (entity.group && typeof entity.group.rotation === 'function') ? entity.group.rotation() : (entity.rotation || 0);
                const rad = rot * Math.PI / 180;
                const worldDeltaX = this.planeIntersect.x - this.dragStartPos.x;
                const worldDeltaZ = this.planeIntersect.z - this.dragStartPos.z;
                const localDeltaX = worldDeltaX * Math.cos(rad) - worldDeltaZ * Math.sin(rad);
                const localDeltaZ = worldDeltaX * Math.sin(rad) + worldDeltaZ * Math.cos(rad);

                if (type === 'pitch') {
                    // Dedicated Gable Ridge Apex Pitch adjustment
                    const deltaY = this.planeIntersect.y - this.dragStartPos.y;
                    const w = this.initialMaxX - this.initialMinX;
                    const d = this.initialMaxY - this.initialMinY;
                    const axis = conf.ridgeAxis || 'x';
                    const span = (axis === 'x' ? d : w);

                    let newRh = Math.max(0, this.initialRh + deltaY);
                    let newPitch = Math.atan2(newRh, span / 2) * (180 / Math.PI);
                    newPitch = Math.max(0, Math.min(75, Math.round(newPitch)));

                    RoofEngine.setPitch(entity, newPitch, this.ctx.planner || this.ctx);
                    const peakFeet = this._formatFeetInches(newRh);
                    const pitchLabel = newPitch === 0 ? '0° (Flat)' : `${newPitch}°`;
                    this._updateDOMBadge(`GABLE PITCH: ${pitchLabel} | Ridge: ${peakFeet} (${Math.round(newRh)}cm)`, { x: e.clientX, y: e.clientY });
                } else if (type === 'curve') {
                    // Dedicated Slope Curvature adjustment (-50 to +50)
                    const deltaY = this.planeIntersect.y - this.dragStartPos.y;
                    const newCurve = Math.max(-50, Math.min(50, Math.round(this.initialCurve + deltaY * 0.4)));
                    RoofEngine.setCurve(entity, newCurve, this.ctx.planner || this.ctx);

                    const curveLabel = newCurve > 0 ? `Convex (+${newCurve})` : (newCurve < 0 ? `Pagoda (${newCurve})` : 'Straight (0)');
                    this._updateDOMBadge(`CURVATURE: ${curveLabel}`, { x: e.clientX, y: e.clientY });
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

                    RoofEngine.setPosition(entity, newGroupX, newGroupZ, this.ctx.planner || this.ctx);

                    const dist = Math.hypot(deltaX, deltaZ);
                    this._updateDOMBadge(`MOVE: ${this._formatFeetInches(dist)} (&Delta;X: ${deltaX >= 0 ? '+' : ''}${this._formatFeetInches(deltaX)}, &Delta;Z: ${deltaZ >= 0 ? '+' : ''}${this._formatFeetInches(deltaZ)})`, { x: e.clientX, y: e.clientY });
                } else if (type === 'spin') {
                    // Smooth, rigid rotation around exact center
                    const worldCx = this.initialGroupX + this.initialCenterX;
                    const worldCz = this.initialGroupZ + this.initialCenterZ;
                    const curAngle = Math.atan2(this.planeIntersect.z - worldCz, this.planeIntersect.x - worldCx);
                    let angleDelta = -(curAngle - this.initialAngle) * (180 / Math.PI);

                    let newRot = this.initialRotation + angleDelta;
                    if (!e.shiftKey) {
                        newRot = Math.round(newRot / 15) * 15; // Clean 15-degree snap increments
                    }
                    newRot = ((Math.round(newRot) % 360) + 360) % 360;

                    RoofEngine.setRotation(entity, newRot, this.ctx.planner || this.ctx);

                    if (this.ctx.gizmoManager && this.ctx.gizmoManager.syncRoofSpinPanel) {
                        this.ctx.gizmoManager.syncRoofSpinPanel(entity);
                    }

                    this._updateDOMBadge(`SPIN: ${newRot}&deg;`, { x: e.clientX, y: e.clientY });
                } else if (type === 'edge') {
                    // Dedicated Edge Push/Pull: projects strictly along edge's outward normal
                    const edgeIdx = this.activeHandle.userData?.edgeIndex ?? 0;
                    const role = this.activeHandle.userData?.role || 'eave';
                    const nx = this.activeHandle.userData?.nx ?? 0;
                    const ny = this.activeHandle.userData?.ny ?? 0;

                    let delta = localDeltaX * nx + localDeltaZ * ny;
                    if (isNaN(delta) || (nx === 0 && ny === 0)) {
                        if (edgeIdx === 0) delta = -localDeltaZ;
                        else if (edgeIdx === 1) delta = localDeltaX;
                        else if (edgeIdx === 2) delta = localDeltaZ;
                        else if (edgeIdx === 3) delta = -localDeltaX;
                    }

                    const initO = (this.initialOverhangs && this.initialOverhangs[edgeIdx] !== undefined)
                        ? this.initialOverhangs[edgeIdx]
                        : this.initialOverhang;
                    const newOverhang = Math.max(0, Math.min(100, Math.round(initO + delta)));

                    if (e.shiftKey) {
                        // Adjust all edges of this same role (all eaves or all rakes)
                        const numEdges = entity.points?.length || 4;
                        if (!conf.overhangs || !Array.isArray(conf.overhangs) || conf.overhangs.length !== numEdges) {
                            conf.overhangs = Array(numEdges).fill(conf.overhang !== undefined ? conf.overhang : 8);
                        }
                        this.edgeHandles.forEach(h => {
                            if (h.userData?.role === role && h.userData.edgeIndex !== undefined) {
                                conf.overhangs[h.userData.edgeIndex] = newOverhang;
                            }
                        });
                        RoofEngine.notifyRoofUpdated(entity, this.ctx.planner || this.ctx, 'geometry');
                        const roleLabel = role === 'eave' ? 'ALL EAVES' : 'ALL GABLE RAKES';
                        this._updateDOMBadge(`${roleLabel}: ${this._formatFeetInches(newOverhang)}`, { x: e.clientX, y: e.clientY });
                    } else {
                        // Dedicated SINGLE EDGE modification
                        RoofEngine.setOverhang(entity, newOverhang, edgeIdx, this.ctx.planner || this.ctx);
                        const roleLabel = role === 'eave' ? `EAVE ${edgeIdx + 1}` : `GABLE RAKE ${edgeIdx + 1}`;
                        this._updateDOMBadge(`${roleLabel} OVERHANG: ${this._formatFeetInches(newOverhang)}`, { x: e.clientX, y: e.clientY });
                    }
                } else if (type === 'corner') {
                    // Corner footprint stretch
                    const cIdx = this.activeHandle.userData?.cornerIndex ?? 0;
                    if (this.initialPoints.length === 4) {
                        let minX = this.initialMinX, maxX = this.initialMaxX;
                        let minY = this.initialMinY, maxY = this.initialMaxY;

                        if (cIdx === 0) {
                            minX = Math.min(maxX - 40, this.initialMinX + localDeltaX);
                            minY = Math.min(maxY - 40, this.initialMinY + localDeltaZ);
                        } else if (cIdx === 1) {
                            maxX = Math.max(minX + 40, this.initialMaxX + localDeltaX);
                            minY = Math.min(maxY - 40, this.initialMinY + localDeltaZ);
                        } else if (cIdx === 2) {
                            maxX = Math.max(minX + 40, this.initialMaxX + localDeltaX);
                            maxY = Math.max(minY + 40, this.initialMaxY + localDeltaZ);
                        } else if (cIdx === 3) {
                            minX = Math.min(maxX - 40, this.initialMinX + localDeltaX);
                            maxY = Math.max(minY + 40, this.initialMaxY + localDeltaZ);
                        }

                        const newPts = [
                            { x: minX, y: minY },
                            { x: maxX, y: minY },
                            { x: maxX, y: maxY },
                            { x: minX, y: maxY }
                        ];
                        RoofEngine.setPoints(entity, newPts, this.ctx.planner || this.ctx);
                        const curW = maxX - minX, curD = maxY - minY;
                        this._updateDOMBadge(`GABLE FOOTPRINT: ${this._formatFeetInches(curW)} &times; ${this._formatFeetInches(curD)}`, { x: e.clientX, y: e.clientY });
                    } else if (cIdx !== undefined && this.initialPoints[cIdx]) {
                        const newPts = this.initialPoints.map((p, idx) => {
                            if (idx === cIdx) {
                                return { x: Math.round(p.x + localDeltaX), y: Math.round(p.y + localDeltaZ) };
                            }
                            return { x: p.x, y: p.y };
                        });
                        RoofEngine.setPoints(entity, newPts, this.ctx.planner || this.ctx);
                        this._updateDOMBadge(`CORNER ${cIdx + 1} OFFSET`, { x: e.clientX, y: e.clientY });
                    }
                }

                this.updateHandlePositions();
                this._updateHUDPosition();
                this._updateHUDContent();
                if (this.ctx && typeof this.ctx.requestRender === 'function') {
                    this.ctx.requestRender();
                }
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
                    coreEventBus.emit(EVENTS.ROOF_OVERHANG_GIZMO_END, { entity });
                }
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
                this._updateHUDContent();
            }
        };

        this._onSyncEngine = () => {
            if (this.visible && this.target && !this.isDragging) {
                this.rebuildHandles();
                this.updateHandlePositions();
                this._updateHUDPosition();
                this._updateHUDContent();
                if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
            }
        };
        this._unsubSync = coreEventBus.on(EVENTS.SYNC_ENGINE, this._onSyncEngine);

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
        this.domBadge.className = 'gable-roof-live-badge';
        this.domBadge.style.cssText = `
            position: absolute;
            display: none;
            pointer-events: none;
            transform: translate(-50%, -130%);
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

    _createDOMHUD() {
        if (typeof document === 'undefined') return;
        this.domHUD = document.createElement('div');
        this.domHUD.className = 'gable-roof-floating-hud';
        this.domHUD.style.cssText = `
            position: absolute;
            display: none;
            align-items: center;
            gap: 8px;
            pointer-events: auto;
            transform: translate(-50%, -100%);
            padding: 6px 12px;
            border-radius: 20px;
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 12px rgba(245, 158, 11, 0.35);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 600;
            z-index: 99999;
            backdrop-filter: blur(12px);
            user-select: none;
            transition: opacity 0.2s ease, transform 0.2s ease;
        `;

        this.domHUD.innerHTML = `
            <span style="font-size: 11px; font-weight: 800; color: #f59e0b; letter-spacing: 0.8px; padding-right: 4px; border-right: 1px solid rgba(255,255,255,0.2);">GABLE ROOF</span>
            <button id="gr-btn-flip-axis" style="background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.5); color: #fef3c7; padding: 4px 10px; border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s;" title="Flip gable ridge axis between Horizontal (X) and Vertical (Y)">⇄ Flip Axis (X)</button>
            <button id="gr-btn-auto-walls" style="background: rgba(139, 92, 246, 0.25); border: 1px solid rgba(167, 139, 250, 0.5); color: #ede9fe; padding: 4px 10px; border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s;" title="Toggle automatic triangular gable end walls underneath">△ Auto Walls: ON</button>
            <button id="gr-btn-mat" style="background: rgba(99, 102, 241, 0.25); border: 1px solid rgba(129, 140, 248, 0.5); color: #c7d2fe; padding: 4px 10px; border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s;" title="Select and apply materials to shingles, fascia, or gable end">🎨 Material</button>
            <div style="display: flex; align-items: center; gap: 4px; padding-left: 4px; border-left: 1px solid rgba(255,255,255,0.2);">
                <span id="gr-lbl-pitch" style="font-size: 11px; color: #94a3b8;">30° Pitch</span>
                <button id="gr-btn-pitch-sub" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 20px; height: 20px; border-radius: 10px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;" title="Decrease pitch by 5°">-</button>
                <button id="gr-btn-pitch-add" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 20px; height: 20px; border-radius: 10px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;" title="Increase pitch by 5°">+</button>
            </div>
            <div style="display: flex; align-items: center; gap: 4px; padding-left: 4px; border-left: 1px solid rgba(255,255,255,0.2);">
                <span id="gr-lbl-curve" style="font-size: 11px; color: #67e8f9;">Curve: 0</span>
                <button id="gr-btn-curve-sub" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 20px; height: 20px; border-radius: 10px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;" title="Pagoda / concave curve (-5)">-</button>
                <button id="gr-btn-curve-add" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 20px; height: 20px; border-radius: 10px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;" title="Convex curve (+5)">+</button>
                <button id="gr-btn-curve-reset" style="background: rgba(255,255,255,0.1); border: none; color: #94a3b8; width: 18px; height: 18px; border-radius: 9px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center;" title="Reset curve to 0 (Straight)">0</button>
            </div>
            <button id="gr-btn-flush" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.25); color: #fff; padding: 4px 10px; border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s;" title="Set all overhangs flush to wall baseline (0 inches)">⇥ Flush (0")</button>
            <button id="gr-btn-overhang8" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.25); color: #fff; padding: 4px 10px; border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s;" title="Apply standard 8 inch overhang across all sides">↔ 8" Overhang</button>
        `;

        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domHUD);

        // Bind HUD buttons
        const btnFlipAxis = this.domHUD.querySelector('#gr-btn-flip-axis');
        if (btnFlipAxis) {
            btnFlipAxis.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const curAxis = conf.ridgeAxis || 'x';
                const nextAxis = (curAxis === 'x') ? 'y' : 'x';
                RoofEngine.setRidgeAxis(entity, nextAxis, this.ctx.planner || this.ctx, true);
                this.rebuildHandles();
                this.updateHandlePositions();
                this._updateHUDContent();
                this._updateHUDPosition();
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnAutoWalls = this.domHUD.querySelector('#gr-btn-auto-walls');
        if (btnAutoWalls) {
            btnAutoWalls.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const nextAuto = !conf.autoShapeWalls;
                RoofEngine.setAutoShapeWalls(entity, nextAuto, this.ctx.planner || this.ctx);
                this._updateHUDContent();
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnMat = this.domHUD.querySelector('#gr-btn-mat');
        if (btnMat) {
            btnMat.onclick = (e) => {
                e.stopPropagation();
                if (this.ctx.interactions) {
                    this.ctx.interactions.setTransformMode('material');
                }
            };
        }

        const btnPitchSub = this.domHUD.querySelector('#gr-btn-pitch-sub');
        if (btnPitchSub) {
            btnPitchSub.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const curPitch = conf.pitch !== undefined ? conf.pitch : 30;
                const nextPitch = Math.max(0, curPitch - 5);
                RoofEngine.setPitch(entity, nextPitch, this.ctx.planner || this.ctx);
                this.updateHandlePositions();
                this._updateHUDPosition();
                this._updateHUDContent();
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnPitchAdd = this.domHUD.querySelector('#gr-btn-pitch-add');
        if (btnPitchAdd) {
            btnPitchAdd.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const curPitch = conf.pitch !== undefined ? conf.pitch : 30;
                const nextPitch = Math.min(75, curPitch + 5);
                RoofEngine.setPitch(entity, nextPitch, this.ctx.planner || this.ctx);
                this.updateHandlePositions();
                this._updateHUDPosition();
                this._updateHUDContent();
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnCurveSub = this.domHUD.querySelector('#gr-btn-curve-sub');
        if (btnCurveSub) {
            btnCurveSub.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const cur = conf.curve !== undefined ? conf.curve : 0;
                const next = Math.max(-50, cur - 5);
                RoofEngine.setCurve(entity, next, this.ctx.planner || this.ctx);
                this.updateHandlePositions();
                this._updateHUDPosition();
                this._updateHUDContent();
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnCurveAdd = this.domHUD.querySelector('#gr-btn-curve-add');
        if (btnCurveAdd) {
            btnCurveAdd.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const cur = conf.curve !== undefined ? conf.curve : 0;
                const next = Math.min(50, cur + 5);
                RoofEngine.setCurve(entity, next, this.ctx.planner || this.ctx);
                this.updateHandlePositions();
                this._updateHUDPosition();
                this._updateHUDContent();
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnCurveReset = this.domHUD.querySelector('#gr-btn-curve-reset');
        if (btnCurveReset) {
            btnCurveReset.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                RoofEngine.setCurve(entity, 0, this.ctx.planner || this.ctx);
                this.updateHandlePositions();
                this._updateHUDPosition();
                this._updateHUDContent();
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnFlush = this.domHUD.querySelector('#gr-btn-flush');
        if (btnFlush) {
            btnFlush.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                RoofEngine.setOverhang(entity, 0, null, this.ctx.planner || this.ctx);
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnOverhang8 = this.domHUD.querySelector('#gr-btn-overhang8');
        if (btnOverhang8) {
            btnOverhang8.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                RoofEngine.setOverhang(entity, 8, null, this.ctx.planner || this.ctx);
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }
    }

    _updateHUDContent() {
        if (!this.domHUD || !this.target) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;

        const btnFlipAxis = this.domHUD.querySelector('#gr-btn-flip-axis');
        if (btnFlipAxis) {
            const axis = (conf.ridgeAxis || 'x').toUpperCase();
            btnFlipAxis.innerText = `⇄ Flip Axis (${axis})`;
        }

        const btnAutoWalls = this.domHUD.querySelector('#gr-btn-auto-walls');
        if (btnAutoWalls) {
            const isAuto = Boolean(conf.autoShapeWalls);
            btnAutoWalls.innerText = `△ Auto Walls: ${isAuto ? 'ON' : 'OFF'}`;
            btnAutoWalls.style.background = isAuto ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.2)';
            btnAutoWalls.style.borderColor = isAuto ? 'rgba(52, 211, 153, 0.5)' : 'rgba(248, 113, 113, 0.5)';
            btnAutoWalls.style.color = isAuto ? '#a7f3d0' : '#fecaca';
        }

        const lblPitch = this.domHUD.querySelector('#gr-lbl-pitch');
        if (lblPitch) {
            const pitch = conf.pitch !== undefined ? conf.pitch : 30;
            lblPitch.innerText = pitch === 0 ? '0° (Flat)' : `${pitch}° Pitch`;
        }

        const lblCurve = this.domHUD.querySelector('#gr-lbl-curve');
        if (lblCurve) {
            const curve = conf.curve || 0;
            lblCurve.innerText = curve === 0 ? 'Curve: 0' : (curve > 0 ? `+${curve} Convex` : `${curve} Pagoda`);
        }
    }

    _updateHUDPosition() {
        if (!this.domHUD || !this.target || !this.visible || this.mode !== 'corners') {
            if (this.domHUD) this.domHUD.style.display = 'none';
            return;
        }

        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;
        const pitch = conf.pitch !== undefined ? conf.pitch : 30;
        const axis = conf.ridgeAxis || 'x';

        let basePts = entity.points;
        if (!basePts || !Array.isArray(basePts) || basePts.length < 3) {
            basePts = [{ x: -100, y: -80 }, { x: 100, y: -80 }, { x: 100, y: 80 }, { x: -100, y: 80 }];
        }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        basePts.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        const w = maxX - minX, d = maxY - minY;
        const span = (axis === 'x' ? d : w);
        const rh = Math.tan(pitch * Math.PI / 180) * (span / 2);

        // Position above the ridge apex
        const worldPos = new THREE.Vector3();
        let targetGroup = this.target;
        while (targetGroup.parent && targetGroup.parent !== this.ctx.structureGroup && targetGroup.parent !== this.ctx.scene) {
            targetGroup = targetGroup.parent;
        }
        targetGroup.getWorldPosition(worldPos);

        const hudWorldPos = new THREE.Vector3(worldPos.x, worldPos.y + rh + 28, worldPos.z);
        const screenPos = hudWorldPos.clone().project(this.ctx.camera);

        if (screenPos.z > 1) {
            this.domHUD.style.display = 'none';
            return;
        }

        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();

        const x = (screenPos.x * 0.5 + 0.5) * rect.width + rect.left;
        const y = (-screenPos.y * 0.5 + 0.5) * rect.height + rect.top - 15;

        this.domHUD.style.left = `${x}px`;
        this.domHUD.style.top = `${y}px`;
        this.domHUD.style.display = 'flex';
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
        this.mode = mode;
        if (!target) {
            this.detach();
            return;
        }

        const entity = target.userData?.entity;
        if (!entity) {
            this.detach();
            return;
        }

        const conf = entity.config || entity;
        const numPts = entity.points?.length || 4;
        if (!conf.overhangs || !Array.isArray(conf.overhangs) || conf.overhangs.length !== numPts) {
            conf.overhangs = Array(numPts).fill(conf.overhang !== undefined ? conf.overhang : 8);
        }

        this.visible = true;
        this.rebuildHandles();
        this.updateHandlePositions();
        this._updateHUDContent();
        this._updateHUDPosition();

        if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.activeHandle = null;
        this.hoveredHandle = null;
        this._hideDOMBadge();
        if (this.domHUD) this.domHUD.style.display = 'none';

        while (this.handles.children.length > 0) {
            const child = this.handles.children[0];
            this.handles.remove(child);
        }
        if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
    }

    setMode(mode) {
        this.mode = mode || 'corners';
        this.rebuildHandles();
        this.updateHandlePositions();
        this._updateHUDContent();
        this._updateHUDPosition();
        if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
    }

    rebuildHandles() {
        while (this.handles.children.length > 0) {
            const child = this.handles.children[0];
            this.handles.remove(child);
        }

        this.peakHandle = null;
        this.curveHandle = null;
        this.edgeHandles = [];
        this.cornerHandles = [];
        this.moveHandle = null;
        this.spinHandle = null;

        if (!this.target) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;

        if (this.mode === 'move') {
            const moveGroup = new THREE.Group();
            moveGroup.userData = { type: 'move' };

            const moveDisc = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 2, 24), this.moveMat);
            moveDisc.renderOrder = 9999;
            const mRing = new THREE.Mesh(new THREE.TorusGeometry(14, 1.8, 8, 24), this.ringMat);
            mRing.rotation.x = Math.PI / 2;
            mRing.renderOrder = 9999;

            const crossX = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 4), this.ringMat);
            crossX.position.y = 2; crossX.renderOrder = 9999;
            const crossZ = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 16), this.ringMat);
            crossZ.position.y = 2; crossZ.renderOrder = 9999;

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

        // MODE: 'corners' / Default Shape Mode
        let basePts = entity.points;
        if (!basePts || !Array.isArray(basePts) || basePts.length < 3) {
            basePts = [{ x: -100, y: -80 }, { x: 100, y: -80 }, { x: 100, y: 80 }, { x: -100, y: 80 }];
        }
        const numPts = basePts.length;
        const axis = conf.ridgeAxis || 'x';

        // 1. Dedicated Ridge Apex Peak Handle (Gold/Amber Ridge Beam + Vertical Dual-Cone Arrow)
        const peakGroup = new THREE.Group();
        peakGroup.userData = { type: 'pitch' };

        const topCone = new THREE.Mesh(new THREE.ConeGeometry(11, 20, 16), this.pitchMat);
        topCone.position.y = 10;
        topCone.renderOrder = 9999;

        const bottomCone = new THREE.Mesh(new THREE.ConeGeometry(11, 20, 16), this.pitchMat);
        bottomCone.rotation.x = Math.PI;
        bottomCone.position.y = -10;
        bottomCone.renderOrder = 9999;

        const peakRing = new THREE.Mesh(new THREE.TorusGeometry(14, 2, 8, 24), this.ringMat);
        peakRing.rotation.x = Math.PI / 2;
        peakRing.renderOrder = 9999;

        // Ridge Beam Tube aligned with ridgeAxis
        const ridgeTubeGeo = new THREE.CylinderGeometry(3.5, 3.5, 60, 16);
        const ridgeTube = new THREE.Mesh(ridgeTubeGeo, this.ridgeTubeMat);
        if (axis === 'x') {
            ridgeTube.rotation.z = Math.PI / 2;
        } else {
            ridgeTube.rotation.x = Math.PI / 2;
        }
        ridgeTube.renderOrder = 9999;

        peakGroup.add(topCone, bottomCone, peakRing, ridgeTube);
        this.handles.add(peakGroup);
        this.peakHandle = peakGroup;

        // 2. Dedicated Slope Curvature Handle (Cyan Sphere + Halo Ring on the pitch slope)
        const curveGroup = new THREE.Group();
        curveGroup.userData = { type: 'curve' };

        const curveSphere = new THREE.Mesh(new THREE.SphereGeometry(11, 20, 20), this.curveMat);
        curveSphere.renderOrder = 9999;

        const cRing = new THREE.Mesh(new THREE.TorusGeometry(14, 2, 8, 24), this.ringMat);
        cRing.rotation.x = Math.PI / 2;
        cRing.renderOrder = 9999;

        curveGroup.add(curveSphere, cRing);
        this.handles.add(curveGroup);
        this.curveHandle = curveGroup;

        // 2. Differentiated Edge Handles: Eaves (Cobalt Blue) vs Gable Rakes (Royal Purple)
        for (let i = 0; i < numPts; i++) {
            const p0 = basePts[i];
            const p1 = basePts[(i + 1) % numPts];
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;

            // Determine if edge is Eave (gutter edge) or Rake (triangular end)
            let isEave = false;
            if (axis === 'x') {
                isEave = Math.abs(dx) >= Math.abs(dy); // North & South edges
            } else {
                isEave = Math.abs(dy) >= Math.abs(dx); // East & West edges
            }
            const role = isEave ? 'eave' : 'rake';
            const curMat = isEave ? this.eaveMat : this.rakeMat;

            const edgeGroup = new THREE.Group();
            edgeGroup.userData = { type: 'edge', role, edgeIndex: i };

            // Sleek CAD push/pull badge with outward and inward arrowheads
            const tabBody = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 8), curMat);
            tabBody.renderOrder = 9999;

            const arrowOut = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 8), curMat);
            arrowOut.rotation.x = Math.PI / 2;
            arrowOut.position.z = 6;
            arrowOut.renderOrder = 9999;

            const arrowIn = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 8), curMat);
            arrowIn.rotation.x = -Math.PI / 2;
            arrowIn.position.z = -6;
            arrowIn.renderOrder = 9999;

            const ring = new THREE.Mesh(new THREE.TorusGeometry(11, 1.8, 6, 16), this.ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.renderOrder = 9999;

            edgeGroup.add(tabBody, arrowOut, arrowIn, ring);
            this.handles.add(edgeGroup);
            this.edgeHandles.push(edgeGroup);
        }

        // 3. Corner Vertex Handles (Pink Octahedron Crystals)
        const corners = ['nw', 'ne', 'se', 'sw'];
        for (let i = 0; i < numPts; i++) {
            const cornerGroup = new THREE.Group();
            cornerGroup.userData = { 
                type: 'corner', 
                cornerIndex: i, 
                corner: (numPts === 4 && i < 4) ? corners[i] : `corner_${i}` 
            };

            const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(11, 0), this.cornerMat);
            diamond.renderOrder = 9999;

            const dRing = new THREE.Mesh(new THREE.TorusGeometry(13, 1.8, 6, 16), this.ringMat);
            dRing.rotation.x = Math.PI / 2;
            dRing.renderOrder = 9999;

            cornerGroup.add(diamond, dRing);
            this.handles.add(cornerGroup);
            this.cornerHandles.push(cornerGroup);
        }

        this.refreshHandleMaterials();
    }

    updateHandlePositions() {
        if (!this.target) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;
        let basePts = entity.points;
        if (!basePts || !Array.isArray(basePts) || basePts.length < 3) {
            basePts = [{ x: -100, y: -80 }, { x: 100, y: -80 }, { x: 100, y: 80 }, { x: -100, y: 80 }];
        }

        const numPts = basePts.length;
        const overhangs = conf.overhangs ? conf.overhangs : (conf.overhang !== undefined ? conf.overhang : 8);
        const pts = offsetPolygon(basePts, overhangs);

        let baseMinX = Infinity, baseMaxX = -Infinity, baseMinY = Infinity, baseMaxY = -Infinity;
        basePts.forEach(p => {
            baseMinX = Math.min(baseMinX, p.x); baseMaxX = Math.max(baseMaxX, p.x);
            baseMinY = Math.min(baseMinY, p.y); baseMaxY = Math.max(baseMaxY, p.y);
        });

        const baseCx = (baseMinX !== Infinity) ? (baseMinX + baseMaxX) / 2 : 0;
        const baseCz = (baseMinY !== Infinity) ? (baseMinY + baseMaxY) / 2 : 0;
        const baseW = (baseMinX !== Infinity) ? (baseMaxX - baseMinX) : 200;
        const baseD = (baseMinY !== Infinity) ? (baseMaxY - baseMinY) : 160;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pts.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });

        const axis = conf.ridgeAxis || 'x';
        const span = (axis === 'x' ? baseD : baseW);
        const pitch = conf.pitch !== undefined ? conf.pitch : 30;
        const rh = Math.tan(pitch * Math.PI / 180) * (span / 2);

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

        if (this.moveHandle) {
            this.moveHandle.position.set(0, baseY + rh + 2, 0);
        }
        if (this.spinHandle) {
            this.spinHandle.position.set(0, baseY + rh + 2, 0);
        }

        // Position Ridge Apex Peak Handle
        if (this.peakHandle) {
            this.peakHandle.position.set(0, baseY + rh, 0);
        }

        // Position Slope Curvature Handle (midpoint of roof slope)
        if (this.curveHandle) {
            const curveOffset = conf.curve || 0;
            const slopeY = baseY + (rh * 0.48) + curveOffset + 6;
            if (axis === 'x') {
                this.curveHandle.position.set(0, slopeY, -(baseD * 0.25));
            } else {
                this.curveHandle.position.set(-(baseW * 0.25), slopeY, 0);
            }
        }

        let signedArea = 0;
        for (let j = 0; j < basePts.length; j++) {
            let a = basePts[j];
            let b = basePts[(j + 1) % basePts.length];
            signedArea += (a.x * b.y - b.x * a.y);
        }

        // Position Edge Handles
        if (this.edgeHandles && this.edgeHandles.length > 0) {
            pts.forEach((p, idx) => {
                if (idx >= this.edgeHandles.length) return;
                const nextIdx = (idx + 1) % pts.length;
                const pNext = pts[nextIdx];

                const midX = (p.x + pNext.x) / 2;
                const midY = (p.y + pNext.y) / 2;

                let p0 = basePts[idx];
                let p1 = basePts[(idx + 1) % basePts.length];
                let dx = p1.x - p0.x;
                let dy = p1.y - p0.y;
                let len = Math.hypot(dx, dy);
                if (len > 0) { dx /= len; dy /= len; }

                let nx = -dy, ny = dx;
                if (signedArea > 0) { nx = dy; ny = -dx; }

                const handle = this.edgeHandles[idx];
                if (handle) {
                    const role = handle.userData?.role || 'eave';
                    // Eaves sit at the base roof trim line; Gable rakes sit halfway up the gable end
                    const edgeY = (role === 'eave') ? (baseY + 2) : (baseY + rh / 2);

                    handle.position.set(midX - baseCx, edgeY, midY - baseCz);
                    handle.rotation.y = -Math.atan2(ny, nx) + Math.PI / 2;
                    handle.userData.nx = nx;
                    handle.userData.ny = ny;
                    handle.userData.edgeIndex = idx;
                }
            });
        }

        // Position Corner Footprint Handles
        if (this.cornerHandles && this.cornerHandles.length > 0) {
            pts.forEach((p, idx) => {
                if (idx >= this.cornerHandles.length) return;
                const handle = this.cornerHandles[idx];
                if (handle) {
                    handle.position.set(p.x - baseCx, baseY + 2, p.y - baseCz);
                }
            });
        }
    }

    refreshHandleMaterials() {
        // Ridge Apex Handle
        if (this.peakHandle) {
            const isHover = (this.hoveredHandle === this.peakHandle);
            const isActive = (this.activeHandle === this.peakHandle);
            const curMat = isActive ? this.pitchMatActive : (isHover ? this.pitchMatHover : this.pitchMat);
            this.peakHandle.traverse(child => {
                if (child.isMesh && child.material !== this.ringMat && child.material !== this.ridgeTubeMat) {
                    child.material = curMat;
                }
            });
        }

        // Slope Curvature Handle
        if (this.curveHandle) {
            const isHover = (this.hoveredHandle === this.curveHandle);
            const isActive = (this.activeHandle === this.curveHandle);
            const curMat = isActive ? this.curveMatActive : (isHover ? this.curveMatHover : this.curveMat);
            this.curveHandle.traverse(child => {
                if (child.isMesh && child.material !== this.ringMat) {
                    child.material = curMat;
                }
            });
        }

        // Edge Handles (Eave vs Rake)
        this.edgeHandles.forEach(h => {
            const isHover = (this.hoveredHandle === h);
            const isActive = (this.activeHandle === h);
            const role = h.userData?.role || 'eave';
            let curMat = null;
            if (role === 'eave') {
                curMat = isActive ? this.eaveMatActive : (isHover ? this.eaveMatHover : this.eaveMat);
            } else {
                curMat = isActive ? this.rakeMatActive : (isHover ? this.rakeMatHover : this.rakeMat);
            }
            h.traverse(child => {
                if (child.isMesh && child.material !== this.ringMat) {
                    child.material = curMat;
                }
            });
        });

        // Corner Handles
        this.cornerHandles.forEach(h => {
            const isHover = (this.hoveredHandle === h);
            const isActive = (this.activeHandle === h);
            const curMat = isActive ? this.cornerMatActive : (isHover ? this.cornerMatHover : this.cornerMat);
            h.traverse(child => {
                if (child.isMesh && child.material !== this.ringMat) {
                    child.material = curMat;
                }
            });
        });

        // Move Handle
        if (this.moveHandle) {
            const isHover = (this.hoveredHandle === this.moveHandle);
            const isActive = (this.activeHandle === this.moveHandle);
            const curMat = isActive ? this.moveMatActive : (isHover ? this.moveMatHover : this.moveMat);
            this.moveHandle.traverse(child => {
                if (child.isMesh && child.material !== this.ringMat) {
                    child.material = curMat;
                }
            });
        }

        // Spin Handle
        if (this.spinHandle) {
            const isHover = (this.hoveredHandle === this.spinHandle);
            const isActive = (this.activeHandle === this.spinHandle);
            const curMat = isActive ? this.spinMatActive : (isHover ? this.spinMatHover : this.spinMat);
            this.spinHandle.traverse(child => {
                if (child.isMesh && child.material !== this.ringMat) {
                    child.material = curMat;
                }
            });
        }
    }

    dispose() {
        this.detach();
        if (this._unsubSync && typeof this._unsubSync === 'function') {
            this._unsubSync();
        }
        if (this.domBadge && this.domBadge.parentElement) {
            this.domBadge.parentElement.removeChild(this.domBadge);
        }
        if (this.domHUD && this.domHUD.parentElement) {
            this.domHUD.parentElement.removeChild(this.domHUD);
        }
        const dom = this.ctx.renderer?.domElement;
        if (dom && typeof dom.removeEventListener === 'function') {
            dom.removeEventListener('pointerdown', this._onPointerDown, true);
            dom.removeEventListener('pointermove', this._onPointerMove, false);
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('pointerup', this._onPointerUp, false);
        }
    }
}

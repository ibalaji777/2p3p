import * as THREE from 'three';
import { EVENTS } from '../../core/registry.js';
import { coreEventBus } from '../../core/EventBus.js';
import { offsetPolygon } from '../../core/registry.js';
import { RoofEngine } from '../../core/roof/RoofEngine.js';
import { RoofGeometryEngine } from '../../core/roof/RoofGeometryEngine.js';

/**
 * HalfGableRoofGizmo
 * 
 * Dedicated CAD-Style In-Viewport 3D Interactive Gizmo for Half-Gable (Shed / Mono-Pitch) Roofs.
 * Completely independent from full gable, flat, and generic pitched roof gizmos.
 * 
 * Capabilities:
 * 1. Dedicated High Ridge / Peak Handle:
 *    - Positioned along the high edge of the mono-pitch slope with orientation-aware beam tube.
 *    - Vertical drag accurately adjusts pitch degrees and peak height based on full half-gable span.
 *    - Live CAD dimension badge showing: `HALF-GABLE PITCH: 20° | Peak: 4' 1" (125cm)`.
 * 2. Dedicated Slope Curvature Handle:
 *    - Positioned directly in the center of the single slope face.
 *    - Vertical drag dynamically bows the pitch slopes inward (pagoda / concave) or outward (barrel / convex).
 * 3. Role-Differentiated Edge Overhang Handles:
 *    - Low Eave Handles (Cobalt Blue): Placed at the low gutter runoff edge (baseY + 2).
 *    - High Eave / Ridge Handles (Amber Gold): Placed at the high ridge overhang edge (baseY + rh + 2).
 *    - Side Rake Handles (Royal Purple): Placed halfway up the incline (baseY + rh / 2).
 *    - Single-edge modification by default; Shift-drag modifies all edges simultaneously.
 *    - 100% stationary opposite edges anchored to invariant building footprint center.
 * 4. Footprint Corner Vertex Handles:
 *    - Pink Octahedron crystals at the footprint corners for CAD sizing.
 * 5. In-Scene Floating HUD Toolbar:
 *    - Quick 1-click actions:
 *      - `⇄ Flip Slope (Low ↔ High)`
 *      - `⇄ Flip Axis (X / Y)`
 *      - `△ Auto Walls (ON / OFF)`
 *      - `🎨 Material`
 *      - `Pitch - / +`
 *      - `Curve: 0 (- / + / 0)`
 *      - `⇥ Flush (0")` and `↔ Overhang 8"`
 * 6. Full Mode Separation:
 *    - `corners`: Shape mode with high ridge, slope curve, eaves, rakes, and corners.
 *    - `move`: Emerald 4-way compass pan icon at roof center.
 *    - `spin`: Indigo rotation wheel with 15° snap increments.
 */
export class HalfGableRoofGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'HalfGableRoofGizmo';
        this.mode = 'corners'; // 'corners' | 'move' | 'spin'
        this.target = null;
        this.handles = new THREE.Group();
        this.handles.name = 'HalfGableRoofHandles';
        this.add(this.handles);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.visible = false;

        // Visual Materials (depthTest: false ensures handles render crisp and un-occluded)
        // High Ridge Pitch (Gold / Amber)
        this.pitchMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 });
        this.pitchMatHover = new THREE.MeshBasicMaterial({ color: 0xfde047, depthTest: false, transparent: true, opacity: 1.0 });
        this.pitchMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        // Low Eave Overhang (Cobalt Blue)
        this.lowEaveMat = new THREE.MeshBasicMaterial({ color: 0x2563eb, depthTest: false, transparent: true, opacity: 0.95 });
        this.lowEaveMatHover = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false, transparent: true, opacity: 1.0 });
        this.lowEaveMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        // High Eave / Ridge Overhang (Amber Gold)
        this.highEaveMat = new THREE.MeshBasicMaterial({ color: 0xd97706, depthTest: false, transparent: true, opacity: 0.95 });
        this.highEaveMatHover = new THREE.MeshBasicMaterial({ color: 0xfbbf24, depthTest: false, transparent: true, opacity: 1.0 });
        this.highEaveMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        // Side Gable End Rake Overhang (Royal Purple / Violet)
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

        // Handle registry
        this.peakHandle = null;
        this.curveHandle = null;
        this.edgeHandles = [];
        this.cornerHandles = [];
        this.moveHandle = null;
        this.spinHandle = null;

        this.initHUD();
        this.initDimensionBadge();

        this._onPointerDown = (e) => {
            if (!this.visible || !this.target) return;
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

                const entity = this.target.userData?.entity;
                if (!entity) return;

                if (this.ctx.controls) this.ctx.controls.enabled = false;
                this.activeHandle = handle;
                this.isDragging = true;
                entity._isDragging = true;
                const conf = entity.config || entity;
                const numEdges = entity.points?.length || 4;

                if (!conf.overhangs || !Array.isArray(conf.overhangs) || conf.overhangs.length !== numEdges) {
                    conf.overhangs = Array(numEdges).fill(conf.overhang !== undefined ? conf.overhang : 8);
                }
                this.initialOverhangs = [...conf.overhangs];
                this.initialPitch = conf.pitch !== undefined ? conf.pitch : 20;
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
                const axis = conf.ridgeAxis || 'x';
                const span = (axis === 'x' ? d : w);
                this.initialRh = Math.tan(this.initialPitch * Math.PI / 180) * span;

                const type = handle.userData?.type;
                if (type === 'pitch' || type === 'curve') {
                    // Vertical drag plane facing camera (safe against top-down NaN)
                    let camDir = this.ctx.camera.getWorldDirection(new THREE.Vector3()).setY(0);
                    if (camDir.lengthSq() < 1e-4) {
                        camDir.set(0, 0, 1);
                    } else {
                        camDir.normalize().negate();
                    }
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
                this.startClientX = e.clientX;
                this.startClientY = e.clientY;
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
            const hasIntersect = this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect);
            if (hasIntersect || (this.activeHandle && (this.activeHandle.userData?.type === 'pitch' || this.activeHandle.userData?.type === 'curve'))) {
                const entity = this.target.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const type = this.activeHandle.userData?.type;

                const rot = (entity.group && typeof entity.group.rotation === 'function') ? entity.group.rotation() : (entity.rotation || 0);
                const rad = rot * Math.PI / 180;
                const worldDeltaX = hasIntersect ? (this.planeIntersect.x - this.dragStartPos.x) : 0;
                const worldDeltaZ = hasIntersect ? (this.planeIntersect.z - this.dragStartPos.z) : 0;
                // Convert world-space delta into local roof coordinates (inverse rotation matrix)
                const localDeltaX = worldDeltaX * Math.cos(rad) + worldDeltaZ * Math.sin(rad);
                const localDeltaZ = -worldDeltaX * Math.sin(rad) + worldDeltaZ * Math.cos(rad);

                // World per pixel scaling for stable screen-space delta fallback
                const dist = this.ctx.camera.position.distanceTo(this.dragStartPos);
                const vFov = ((this.ctx.camera.fov || 45) * Math.PI) / 180;
                const domH = this.ctx.renderer?.domElement?.clientHeight || window.innerHeight || 800;
                const worldPerPixel = (2 * Math.tan(vFov / 2) * dist) / domH;
                const screenDeltaY = this.startClientY !== undefined ? -(e.clientY - this.startClientY) : 0;
                const screenY = screenDeltaY * worldPerPixel;

                if (type === 'pitch') {
                    // Dedicated Half-Gable High Ridge Pitch adjustment
                    const rayDeltaY = hasIntersect ? (this.planeIntersect.y - this.dragStartPos.y) : null;
                    const deltaY = (hasIntersect && Math.abs(rayDeltaY) < 3000) ? rayDeltaY : screenY;

                    let minX = this.initialMinX, maxX = this.initialMaxX;
                    let minY = this.initialMinY, maxY = this.initialMaxY;
                    if (minX === undefined || maxX === undefined || isNaN(minX)) {
                        minX = Infinity; maxX = -Infinity; minY = Infinity; maxY = -Infinity;
                        const pts = entity.points || [{ x: -100, y: -80 }, { x: 100, y: -80 }, { x: 100, y: 80 }, { x: -100, y: 80 }];
                        pts.forEach(p => {
                            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                        });
                    }
                    const w = maxX - minX;
                    const d = maxY - minY;
                    const axis = conf.ridgeAxis || 'x';
                    const span = Math.max(1, (axis === 'x' ? d : w));
                    const initPitch = this.initialPitch !== undefined ? this.initialPitch : (conf.pitch !== undefined ? conf.pitch : 20);
                    const initRh = this.initialRh !== undefined ? this.initialRh : Math.tan(initPitch * Math.PI / 180) * span;

                    let newRh = Math.max(0, initRh + deltaY);
                    let newPitch = Math.atan2(newRh, span) * (180 / Math.PI);
                    newPitch = Math.max(0, Math.min(88, Math.round(newPitch)));

                    // Prevent dead-zone: clamp accumulator so reversing mouse direction responds immediately
                    const clampedRh = Math.tan(newPitch * Math.PI / 180) * span;
                    if (hasIntersect && newRh !== clampedRh) {
                        this.dragStartPos.y = this.planeIntersect.y - (clampedRh - initRh);
                    }
                    if (this.startClientY !== undefined && worldPerPixel > 0) {
                        this.startClientY = e.clientY + (clampedRh - initRh) / worldPerPixel;
                    }

                    RoofEngine.setPitch(entity, newPitch, this.ctx.planner || this.ctx);
                    const pitchLabel = newPitch === 0 ? '0° (Flat)' : `${newPitch}°`;
                    this.showDimensionBadge(
                        `HALF-GABLE PITCH: ${pitchLabel} | Peak: ${this.formatDim(clampedRh)}`,
                        this.activeHandle.position
                    );
                } else if (type === 'curve') {
                    // Dedicated Half-Gable Slope Curvature adjustment
                    const rayDeltaY = hasIntersect ? (this.planeIntersect.y - this.dragStartPos.y) : null;
                    const deltaY = (hasIntersect && Math.abs(rayDeltaY) < 3000) ? rayDeltaY : screenY;
                    const initC = this.initialCurve !== undefined ? this.initialCurve : (conf.curve || 0);
                    let newCurve = initC + (deltaY * 0.4);
                    newCurve = Math.max(-80, Math.min(80, Math.round(newCurve)));

                    RoofEngine.setCurve(entity, newCurve, this.ctx.planner || this.ctx);
                    const label = newCurve > 0 ? `Convex +${newCurve}` : (newCurve < 0 ? `Pagoda ${newCurve}` : `Flat 0`);
                    this.showDimensionBadge(`SLOPE CURVATURE: ${label}`, this.activeHandle.position);
                } else if (type === 'edge') {
                    // Overhang push/pull on specific edge (up to 500 cm)
                    const edgeIdx = this.activeHandle.userData?.edgeIndex ?? 0;
                    const nx = this.activeHandle.userData?.nx || 0;
                    const ny = this.activeHandle.userData?.ny || 0;

                    let projDelta = localDeltaX * nx + localDeltaZ * ny;
                    if (isNaN(projDelta) || (nx === 0 && ny === 0)) {
                        if (edgeIdx === 0) projDelta = -localDeltaZ;
                        else if (edgeIdx === 1) projDelta = localDeltaX;
                        else if (edgeIdx === 2) projDelta = localDeltaZ;
                        else if (edgeIdx === 3) projDelta = -localDeltaX;
                    }

                    const initO = (this.initialOverhangs && this.initialOverhangs[edgeIdx] !== undefined)
                        ? this.initialOverhangs[edgeIdx]
                        : (this.initialOverhang !== undefined ? this.initialOverhang : (conf.overhang || 8));
                    let newOverhang = Math.max(0, Math.min(500, Math.round(initO + projDelta)));

                    if (e.shiftKey) {
                        RoofEngine.setOverhang(entity, newOverhang, null, this.ctx.planner || this.ctx);
                        this.showDimensionBadge(
                            `ALL OVERHANGS: ${this.formatDim(newOverhang)} (Shift-Locked)`,
                            this.activeHandle.position
                        );
                    } else {
                        RoofEngine.setOverhang(entity, newOverhang, edgeIdx, this.ctx.planner || this.ctx);
                        const role = this.activeHandle.userData?.role || 'edge';
                        const roleLabel = role === 'low_eave' ? 'LOW EAVE' : (role === 'high_eave' ? 'HIGH RIDGE' : 'SIDE RAKE');
                        this.showDimensionBadge(
                            `${roleLabel} OVERHANG (Side ${edgeIdx + 1}): ${this.formatDim(newOverhang)}`,
                            this.activeHandle.position
                        );
                    }
                } else if (type === 'corner') {
                    // Footprint corner vertex movement
                    const cIdx = this.activeHandle.userData?.cornerIndex ?? 0;
                    if (this.initialPoints && this.initialPoints.length === 4) {
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
                            { x: Math.round(minX), y: Math.round(minY) },
                            { x: Math.round(maxX), y: Math.round(minY) },
                            { x: Math.round(maxX), y: Math.round(maxY) },
                            { x: Math.round(minX), y: Math.round(maxY) }
                        ];
                        RoofEngine.setPoints(entity, newPts, this.ctx.planner || this.ctx);
                        const curW = Math.round(maxX - minX), curD = Math.round(maxY - minY);
                        this.showDimensionBadge(`HALF-GABLE FOOTPRINT: ${this.formatDim(curW)} × ${this.formatDim(curD)}`, this.activeHandle.position);
                    } else if (cIdx !== undefined && this.initialPoints && this.initialPoints[cIdx]) {
                        const newPts = this.initialPoints.map((p, idx) => {
                            if (idx === cIdx) {
                                return { x: Math.round(p.x + localDeltaX), y: Math.round(p.y + localDeltaZ) };
                            }
                            return { x: p.x, y: p.y };
                        });
                        RoofEngine.setPoints(entity, newPts, this.ctx.planner || this.ctx);
                        this.showDimensionBadge(`CORNER ${cIdx + 1} OFFSET`, this.activeHandle.position);
                    }
                } else if (type === 'move') {
                    // In-plane translation
                    const newX = Math.round(this.initialGroupX + worldDeltaX);
                    const newZ = Math.round(this.initialGroupZ + worldDeltaZ);
                    if (entity.group && typeof entity.group.position === 'function') {
                        entity.group.position({ x: newX, y: newZ });
                    } else {
                        entity.x = newX;
                        entity.y = newZ;
                    }
                    if (entity.planner?.stage) entity.planner.stage.batchDraw();
                    if (this.ctx.envBuilder?.updateRoofLive) this.ctx.envBuilder.updateRoofLive(entity);
                    this.showDimensionBadge(`POSITION: [${newX}, ${newZ}]`, this.activeHandle.position);
                } else if (type === 'spin') {
                    // Yaw rotation with 15° snapping
                    const worldCx = this.initialGroupX + this.initialCenterX;
                    const worldCz = this.initialGroupZ + this.initialCenterZ;
                    const curAngle = Math.atan2(this.planeIntersect.z - worldCz, this.planeIntersect.x - worldCx);
                    let angleDiff = (curAngle - this.initialAngle) * 180 / Math.PI;

                    let newRot = this.initialRotation - angleDiff;
                    if (!e.shiftKey) {
                        newRot = Math.round(newRot / 15) * 15;
                    } else {
                        newRot = Math.round(newRot);
                    }
                    newRot = ((newRot % 360) + 360) % 360;

                    if (entity.group && typeof entity.group.rotation === 'function') {
                        entity.group.rotation(newRot);
                    } else {
                        entity.rotation = newRot;
                    }
                    if (entity.planner?.stage) entity.planner.stage.batchDraw();
                    if (this.ctx.envBuilder?.updateRoofLive) this.ctx.envBuilder.updateRoofLive(entity);
                    this.showDimensionBadge(`ROTATION: ${newRot}°`, this.activeHandle.position);
                }

                this.updateHandlePositions();
                this.updateHUDPosition();
                if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
            }
        };

        this._onPointerUp = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.activeHandle = null;
                this.hideDimensionBadge();
                this.refreshHandleMaterials();
                const entity = this.target?.userData?.entity;
                if (entity) entity._isDragging = false;
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
            }
        };

        const dom = this.ctx.renderer?.domElement || window;
        dom.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
    }

    updateMouse(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    attach(targetMesh, mode = 'corners') {
        if (!targetMesh) return;
        this.target = targetMesh;
        this.mode = mode;
        this.visible = true;

        this.buildHandles();
        this.updateHandlePositions();
        this.showHUD();
        this.updateHUDPosition();

        if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.isDragging = false;
        this.activeHandle = null;
        this.hoveredHandle = null;
        this.clearHandles();
        this.hideHUD();
        this.hideDimensionBadge();

        if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
    }

    clearHandles() {
        while (this.handles.children.length > 0) {
            const obj = this.handles.children[0];
            this.handles.remove(obj);
        }
        this.peakHandle = null;
        this.curveHandle = null;
        this.edgeHandles = [];
        this.cornerHandles = [];
        this.moveHandle = null;
        this.spinHandle = null;
    }

    buildHandles() {
        this.clearHandles();
        if (!this.target) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;

        if (this.mode === 'move') {
            const moveGroup = new THREE.Group();
            moveGroup.userData = { type: 'move' };

            const moveDisc = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 4, 24), this.moveMat);
            moveDisc.renderOrder = 9999;
            const mRing = new THREE.Mesh(new THREE.TorusGeometry(18, 2.5, 8, 24), this.ringMat);
            mRing.rotation.x = Math.PI / 2;
            mRing.renderOrder = 9999;

            const crossX = new THREE.Mesh(new THREE.BoxGeometry(42, 3, 4), this.moveMat);
            crossX.renderOrder = 9999;
            const crossZ = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 42), this.moveMat);
            crossZ.renderOrder = 9999;

            const stemN = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 10, 8), this.moveMat);
            stemN.position.z = -18; stemN.renderOrder = 9999;
            const aN = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 16), this.moveMat);
            aN.rotation.x = -Math.PI / 2; aN.position.z = -26; aN.renderOrder = 9999;

            const stemS = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 10, 8), this.moveMat);
            stemS.position.z = 18; stemS.renderOrder = 9999;
            const aS = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 16), this.moveMat);
            aS.rotation.x = Math.PI / 2; aS.position.z = 26; aS.renderOrder = 9999;

            const stemE = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 10, 8), this.moveMat);
            stemE.rotation.z = -Math.PI / 2; stemE.position.x = 18; stemE.renderOrder = 9999;
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
        const flip = !!conf.flipSlope;

        // 1. Dedicated High Ridge Apex Peak Handle (Sims 4 Vertical Pitch Arrow)
        const peakGroup = new THREE.Group();
        peakGroup.userData = { type: 'pitch', role: 'peak' };

        const collar = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 2, 16), this.pitchMat);
        collar.position.y = 1;
        collar.renderOrder = 9999;

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 14, 16), this.pitchMat);
        stem.position.y = 9;
        stem.renderOrder = 9999;

        const head = new THREE.Mesh(new THREE.ConeGeometry(7, 14, 20), this.pitchMat);
        head.position.y = 23;
        head.renderOrder = 9999;

        peakGroup.add(collar, stem, head);
        this.handles.add(peakGroup);
        this.peakHandle = peakGroup;

        // 2. Dedicated Slope Curvature Handle (Sims 4 Clean Sphere on slope face)
        const curveGroup = new THREE.Group();
        curveGroup.userData = { type: 'curve', role: 'slope_curve' };

        const curveSphere = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 24), this.curveMat);
        curveSphere.renderOrder = 9999;

        curveGroup.add(curveSphere);
        this.handles.add(curveGroup);
        this.curveHandle = curveGroup;

        // 3. Differentiated Edge Handles: Low Eave (Cobalt Blue), High Eave (Amber Gold), Side Rakes (Royal Purple)
        for (let i = 0; i < numPts; i++) {
            const p0 = basePts[i];
            const p1 = basePts[(i + 1) % numPts];
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;

            let role = 'rake';
            let curMat = this.rakeMat;

            if (axis === 'x') {
                if (Math.abs(dx) >= Math.abs(dy)) {
                    // Horizontal edge (North or South)
                    const midY = (p0.y + p1.y) / 2;
                    let isHigh = false;
                    let baseMinY = Math.min(...basePts.map(p => p.y));
                    let baseMaxY = Math.max(...basePts.map(p => p.y));
                    let baseCy = (baseMinY + baseMaxY) / 2;

                    if (!flip) {
                        isHigh = midY >= baseCy; // South is high
                    } else {
                        isHigh = midY <= baseCy; // North is high
                    }
                    role = isHigh ? 'high_eave' : 'low_eave';
                    curMat = isHigh ? this.highEaveMat : this.lowEaveMat;
                } else {
                    role = 'rake';
                    curMat = this.rakeMat;
                }
            } else {
                if (Math.abs(dy) >= Math.abs(dx)) {
                    // Vertical edge (East or West)
                    const midX = (p0.x + p1.x) / 2;
                    let isHigh = false;
                    let baseMinX = Math.min(...basePts.map(p => p.x));
                    let baseMaxX = Math.max(...basePts.map(p => p.x));
                    let baseCx = (baseMinX + baseMaxX) / 2;

                    if (!flip) {
                        isHigh = midX >= baseCx; // East is high
                    } else {
                        isHigh = midX <= baseCx; // West is high
                    }
                    role = isHigh ? 'high_eave' : 'low_eave';
                    curMat = isHigh ? this.highEaveMat : this.lowEaveMat;
                } else {
                    role = 'rake';
                    curMat = this.rakeMat;
                }
            }

            const edgeGroup = new THREE.Group();
            edgeGroup.userData = { type: 'edge', role, edgeIndex: i };

            // Outward 3D Arrow (Sims 4 Eave / Rake Arrow)
            const eCollar = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 2, 16), curMat);
            eCollar.rotation.x = Math.PI / 2;
            eCollar.position.z = 1;
            eCollar.renderOrder = 9999;

            const eStem = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 14, 16), curMat);
            eStem.rotation.x = Math.PI / 2;
            eStem.position.z = 9;
            eStem.renderOrder = 9999;

            const eHead = new THREE.Mesh(new THREE.ConeGeometry(6.5, 13, 20), curMat);
            eHead.rotation.x = Math.PI / 2;
            eHead.position.z = 22.5;
            eHead.renderOrder = 9999;

            edgeGroup.add(eCollar, eStem, eHead);
            this.handles.add(edgeGroup);
            this.edgeHandles.push(edgeGroup);
        }

        // 4. Corner Vertex Handles (Sims 4 Diagonal Corner Arrows)
        const corners = ['nw', 'ne', 'se', 'sw'];
        for (let i = 0; i < numPts; i++) {
            const cornerGroup = new THREE.Group();
            cornerGroup.userData = { 
                type: 'corner', 
                cornerIndex: i, 
                corner: (numPts === 4 && i < 4) ? corners[i] : `corner_${i}` 
            };

            const cCollar = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 2, 16), this.cornerMat);
            cCollar.rotation.x = Math.PI / 2;
            cCollar.position.z = 1;
            cCollar.renderOrder = 9999;

            const cStem = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 10, 16), this.cornerMat);
            cStem.rotation.x = Math.PI / 2;
            cStem.position.z = 7;
            cStem.renderOrder = 9999;

            const cHead = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 18), this.cornerMat);
            cHead.rotation.x = Math.PI / 2;
            cHead.position.z = 18;
            cHead.renderOrder = 9999;

            cornerGroup.add(cCollar, cStem, cHead);
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
        const flip = !!conf.flipSlope;
        const span = (axis === 'x' ? baseD : baseW);
        const pitch = conf.pitch !== undefined ? conf.pitch : 20;
        const rh = Math.tan(pitch * Math.PI / 180) * span;

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

        // Position High Ridge Apex Peak Handle
        if (this.peakHandle) {
            if (axis === 'x') {
                const zHigh = flip ? (minY - baseCz) : (maxY - baseCz);
                this.peakHandle.position.set(0, baseY + rh, zHigh);
            } else {
                const xHigh = flip ? (minX - baseCx) : (maxX - baseCx);
                this.peakHandle.position.set(xHigh, baseY + rh, 0);
            }
        }

        // Position Slope Curvature Handle (midpoint of roof slope)
        if (this.curveHandle) {
            const curveOffset = conf.curve || 0;
            const slopeY = baseY + (rh * 0.5) + curveOffset + 6;
            this.curveHandle.position.set(0, slopeY, 0);
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
                    const role = handle.userData?.role || 'low_eave';
                    let edgeY = baseY + 2;
                    if (role === 'high_eave') {
                        edgeY = baseY + rh + 2;
                    } else if (role === 'rake') {
                        edgeY = baseY + rh / 2;
                    }

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
                    let cornerY = baseY + 2;
                    if (axis === 'x') {
                        const isHigh = !flip ? (p.y >= (baseMinY + baseD / 2)) : (p.y <= (baseMinY + baseD / 2));
                        if (isHigh) cornerY = baseY + rh + 2;
                    } else {
                        const isHigh = !flip ? (p.x >= (baseMinX + baseW / 2)) : (p.x <= (baseMinX + baseW / 2));
                        if (isHigh) cornerY = baseY + rh + 2;
                    }
                    const dx = p.x - baseCx;
                    const dy = p.y - baseCz;
                    handle.position.set(p.x - baseCx, cornerY, p.y - baseCz);
                    handle.rotation.y = -Math.atan2(dy, dx) + Math.PI / 2;
                }
            });
        }
    }

    refreshHandleMaterials() {
        // High Ridge Apex Handle
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

        // Edge Handles
        this.edgeHandles.forEach(h => {
            const isHover = (this.hoveredHandle === h);
            const isActive = (this.activeHandle === h);
            const role = h.userData?.role || 'low_eave';

            let baseMat = this.lowEaveMat;
            let hoverMat = this.lowEaveMatHover;
            if (role === 'high_eave') {
                baseMat = this.highEaveMat;
                hoverMat = this.highEaveMatHover;
            } else if (role === 'rake') {
                baseMat = this.rakeMat;
                hoverMat = this.rakeMatHover;
            }

            const curMat = isActive ? this.lowEaveMatActive : (isHover ? hoverMat : baseMat);
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

    initHUD() {
        this.domHUD = document.createElement('div');
        this.domHUD.id = 'half-gable-roof-gizmo-hud';
        this.domHUD.style.position = 'fixed';
        this.domHUD.style.zIndex = '999999';
        this.domHUD.style.display = 'none';
        this.domHUD.style.background = 'rgba(15, 23, 42, 0.94)';
        this.domHUD.style.backdropFilter = 'blur(10px)';
        this.domHUD.style.border = '1px solid rgba(255, 255, 255, 0.18)';
        this.domHUD.style.borderRadius = '8px';
        this.domHUD.style.padding = '5px 8px';
        this.domHUD.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 4px 10px -3px rgba(0, 0, 0, 0.4)';
        this.domHUD.style.color = '#f8fafc';
        this.domHUD.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        this.domHUD.style.fontSize = '11px';
        this.domHUD.style.userSelect = 'none';
        this.domHUD.style.pointerEvents = 'auto';
        this.domHUD.style.width = 'max-content';
        this.domHUD.style.maxWidth = '360px';

        this.domHUD.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 3px;">
                <div style="display: flex; align-items: center; gap: 3px;">
                    <button id="hg-btn-rot-ccw" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;" title="Rotate Counter-Clockwise 15° (Shift: 90°)">↶</button>
                    <button id="hg-btn-mode-move" style="background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(52, 211, 153, 0.4); color: #a7f3d0; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;" title="Move Roof (Toggle Move Compass)">✢</button>
                    <button id="hg-btn-rot-cw" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;" title="Rotate Clockwise 15° (Shift: 90°)">↷</button>
                    <button id="hg-btn-duplicate" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center;" title="Duplicate / Copy Roof">⧉</button>
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <span style="font-weight: 700; font-size: 10.5px; color: #fbbf24; letter-spacing: 0.5px;">• HALF-GABLE</span>
                    <span id="hg-hud-badge" style="font-size: 10px; color: #94a3b8; font-weight: 600;">20°</span>
                </div>
                <button id="hg-btn-mat" style="background: #059669; hover: #10b981; border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 3px;" title="Materials">🎨</button>
            </div>
            <div style="display: flex; align-items: center; gap: 4px; flex-wrap: nowrap;">
                <button id="hg-btn-flip-slope" style="background: #334155; border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer; white-space: nowrap;" title="Invert Low/High side">⇄ Slope</button>
                <button id="hg-btn-flip-axis" style="background: #334155; border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer; white-space: nowrap;" title="Toggle X / Y slope">⇄ Axis</button>
                <button id="hg-btn-auto-walls" style="background: #334155; border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer; white-space: nowrap;" title="Toggle automatic wall shaping">△ Walls: ON</button>
                <div style="display: flex; align-items: center; background: #1e293b; border-radius: 4px; padding: 1px 3px; border: 1px solid rgba(255,255,255,0.1);" title="Pagoda / Convex Curvature">
                    <button id="hg-btn-curve-sub" style="background: transparent; border: none; color: #38bdf8; font-weight: bold; cursor: pointer; padding: 1px 3px; font-size: 10px;">-</button>
                    <span id="hg-lbl-curve" style="font-size: 9.5px; color: #94a3b8; min-width: 16px; text-align: center;">0</span>
                    <button id="hg-btn-curve-add" style="background: transparent; border: none; color: #38bdf8; font-weight: bold; cursor: pointer; padding: 1px 3px; font-size: 10px;">+</button>
                    <button id="hg-btn-curve-reset" style="background: transparent; border: none; color: #64748b; cursor: pointer; padding: 1px 2px; font-size: 9px;" title="Reset">0</button>
                </div>
                <div style="display: flex; align-items: center; background: #1e293b; border-radius: 4px; padding: 1px 3px; border: 1px solid rgba(255,255,255,0.1);" title="Pitch degrees">
                    <button id="hg-btn-pitch-sub" style="background: transparent; border: none; color: #f59e0b; font-weight: bold; cursor: pointer; padding: 1px 3px; font-size: 10px;">-</button>
                    <span id="hg-lbl-pitch" style="font-size: 9.5px; color: #94a3b8; min-width: 22px; text-align: center;">20°</span>
                    <button id="hg-btn-pitch-add" style="background: transparent; border: none; color: #f59e0b; font-weight: bold; cursor: pointer; padding: 1px 3px; font-size: 10px;">+</button>
                </div>
                <div style="display: flex; align-items: center; background: #1e293b; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;">
                    <button id="hg-btn-flush" style="background: transparent; border: none; color: #cbd5e1; padding: 2px 5px; font-size: 9.5px; cursor: pointer; border-right: 1px solid rgba(255,255,255,0.1);" title="0 inch flush overhang">0"</button>
                    <button id="hg-btn-overhang" style="background: transparent; border: none; color: #cbd5e1; padding: 2px 5px; font-size: 9.5px; cursor: pointer;" title="8 inch standard overhang">8"</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.domHUD);

        // Bind HUD events
        this.domHUD.querySelector('#hg-btn-rot-ccw').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.target) return;
            const entity = this.target.userData?.entity;
            if (!entity) return;
            const step = e.shiftKey ? 90 : 15;
            const curRot = (entity.group && typeof entity.group.rotation === 'function') ? entity.group.rotation() : (entity.rotation || 0);
            const newRot = (((curRot - step) % 360) + 360) % 360;
            RoofEngine.setRotation(entity, newRot, this.ctx.planner || this.ctx);
            if (this.ctx.gizmoManager?.syncRoofSpinPanel) this.ctx.gizmoManager.syncRoofSpinPanel(entity);
            this.updateHandlePositions();
            this.updateHUDPosition();
            coreEventBus.emit(EVENTS.SYNC_ENGINE);
        });

        this.domHUD.querySelector('#hg-btn-rot-cw').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.target) return;
            const entity = this.target.userData?.entity;
            if (!entity) return;
            const step = e.shiftKey ? 90 : 15;
            const curRot = (entity.group && typeof entity.group.rotation === 'function') ? entity.group.rotation() : (entity.rotation || 0);
            const newRot = (((curRot + step) % 360) + 360) % 360;
            RoofEngine.setRotation(entity, newRot, this.ctx.planner || this.ctx);
            if (this.ctx.gizmoManager?.syncRoofSpinPanel) this.ctx.gizmoManager.syncRoofSpinPanel(entity);
            this.updateHandlePositions();
            this.updateHUDPosition();
            coreEventBus.emit(EVENTS.SYNC_ENGINE);
        });

        this.domHUD.querySelector('#hg-btn-mode-move').addEventListener('click', (e) => {
            e.stopPropagation();
            const nextMode = (this.mode === 'move') ? 'corners' : 'move';
            this.setMode(nextMode);
        });

        this.domHUD.querySelector('#hg-btn-duplicate').addEventListener('click', (e) => {
            e.stopPropagation();
            const entity = this.target?.userData?.entity;
            if (!entity || !this.ctx.planner) return;
            RoofEngine.duplicateRoof(this.ctx.planner, entity, { x: 30, y: 30 });
            coreEventBus.emit(EVENTS.SYNC_ENGINE);
        });

        this.domHUD.querySelector('#hg-btn-flip-slope').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.target) return;
            const entity = this.target.userData?.entity;
            if (!entity) return;
            const conf = entity.config || entity;
            conf.flipSlope = !conf.flipSlope;

            if (this.ctx.envBuilder?.updateRoofLive) this.ctx.envBuilder.updateRoofLive(entity);
            if (entity.planner?.stage) entity.planner.stage.batchDraw();

            this.buildHandles();
            this.updateHandlePositions();
            this.updateHUDPosition();
            if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
        });

        this.domHUD.querySelector('#hg-btn-flip-axis').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.target) return;
            const entity = this.target.userData?.entity;
            if (!entity) return;
            const conf = entity.config || entity;
            conf.ridgeAxis = (conf.ridgeAxis === 'x' || !conf.ridgeAxis) ? 'y' : 'x';

            if (this.ctx.envBuilder?.updateRoofLive) this.ctx.envBuilder.updateRoofLive(entity);
            if (entity.planner?.stage) entity.planner.stage.batchDraw();

            this.buildHandles();
            this.updateHandlePositions();
            this.updateHUDPosition();
            if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
        });

        this.domHUD.querySelector('#hg-btn-auto-walls').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.target) return;
            const entity = this.target.userData?.entity;
            if (!entity) return;
            const conf = entity.config || entity;
            conf.autoShapeWalls = !(conf.autoShapeWalls !== false);
            conf.showGableWalls = conf.autoShapeWalls;

            if (this.ctx.envBuilder?.updateRoofLive) this.ctx.envBuilder.updateRoofLive(entity);
            this.updateHUDPosition();
            if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
        });

        this.domHUD.querySelector('#hg-btn-curve-sub').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.target) return;
            const entity = this.target.userData?.entity;
            if (!entity) return;
            const conf = entity.config || entity;
            const cur = conf.curve || 0;
            RoofEngine.setCurve(entity, Math.max(-50, cur - 5), this.ctx.planner || this.ctx);
            this.updateHandlePositions();
            this.updateHUDPosition();
            if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
        });

        this.domHUD.querySelector('#hg-btn-curve-add').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.target) return;
            const entity = this.target.userData?.entity;
            if (!entity) return;
            const conf = entity.config || entity;
            const cur = conf.curve || 0;
            RoofEngine.setCurve(entity, Math.min(80, cur + 5), this.ctx.planner || this.ctx);
            this.updateHandlePositions();
            this.updateHUDPosition();
            if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
        });

        this.domHUD.querySelector('#hg-btn-curve-reset').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.target) return;
            const entity = this.target.userData?.entity;
            if (!entity) return;
            RoofEngine.setCurve(entity, 0, this.ctx.planner || this.ctx);
            this.updateHandlePositions();
            this.updateHUDPosition();
            if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
        });

        this.domHUD.querySelector('#hg-btn-pitch-sub').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.target) return;
            const entity = this.target.userData?.entity;
            if (!entity) return;
            const conf = entity.config || entity;
            const cur = conf.pitch !== undefined ? conf.pitch : 20;
            RoofEngine.setPitch(entity, Math.max(0, cur - 5), this.ctx.planner || this.ctx);
            this.updateHandlePositions();
            this.updateHUDPosition();
            if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
        });

        this.domHUD.querySelector('#hg-btn-pitch-add').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.target) return;
            const entity = this.target.userData?.entity;
            if (!entity) return;
            const conf = entity.config || entity;
            const cur = conf.pitch !== undefined ? conf.pitch : 20;
            RoofEngine.setPitch(entity, Math.min(85, cur + 5), this.ctx.planner || this.ctx);
            this.updateHandlePositions();
            this.updateHUDPosition();
            if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
        });

        this.domHUD.querySelector('#hg-btn-flush').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.target) return;
            const entity = this.target.userData?.entity;
            if (!entity) return;
            RoofEngine.setOverhang(entity, 0, this.ctx.planner || this.ctx);
            this.updateHandlePositions();
            if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
        });

        this.domHUD.querySelector('#hg-btn-overhang').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.target) return;
            const entity = this.target.userData?.entity;
            if (!entity) return;
            RoofEngine.setOverhang(entity, 8, this.ctx.planner || this.ctx);
            this.updateHandlePositions();
            if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
        });

        this.domHUD.querySelector('#hg-btn-mat').addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.ctx.interactions?.setTransformMode) {
                this.ctx.interactions.setTransformMode('material');
            } else if (this.ctx.setTransformMode) {
                this.ctx.setTransformMode('material');
            }
        });
    }

    showHUD() {
        if (this.domHUD) this.domHUD.style.display = 'block';
    }

    hideHUD() {
        if (this.domHUD) this.domHUD.style.display = 'none';
    }

    updateHUDPosition() {
        if (!this.domHUD || !this.target || !this.visible) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;

        const pitch = conf.pitch !== undefined ? conf.pitch : 20;
        const badge = this.domHUD.querySelector('#hg-hud-badge');
        if (badge) {
            badge.innerText = pitch === 0 ? '0°' : `${pitch}°`;
        }

        const lblPitch = this.domHUD.querySelector('#hg-lbl-pitch');
        if (lblPitch) {
            lblPitch.innerText = pitch === 0 ? '0° Flat' : `${pitch}°`;
        }

        const btnAutoWalls = this.domHUD.querySelector('#hg-btn-auto-walls');
        if (btnAutoWalls) {
            const isAuto = conf.autoShapeWalls !== false && conf.showGableWalls !== false;
            btnAutoWalls.innerText = `△ Walls: ${isAuto ? 'ON' : 'OFF'}`;
            btnAutoWalls.style.background = isAuto ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.2)';
            btnAutoWalls.style.borderColor = isAuto ? 'rgba(52, 211, 153, 0.5)' : 'rgba(248, 113, 113, 0.5)';
            btnAutoWalls.style.color = isAuto ? '#a7f3d0' : '#fecaca';
        }

        const curveLbl = this.domHUD.querySelector('#hg-lbl-curve');
        if (curveLbl) {
            const cVal = conf.curve || 0;
            curveLbl.innerText = cVal > 0 ? `+${cVal}` : (cVal < 0 ? `${cVal}` : `0`);
        }

        const worldPos = new THREE.Vector3();
        let targetGroup = this.target;
        while (targetGroup.parent && targetGroup.parent !== this.ctx.structureGroup && targetGroup.parent !== this.ctx.scene) {
            targetGroup = targetGroup.parent;
        }
        targetGroup.getWorldPosition(worldPos);

        const pos2D = worldPos.clone().setY(worldPos.y + 10).project(this.ctx.camera);
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();

        const x = ((pos2D.x + 1) * rect.width) / 2 + rect.left;
        const y = ((-pos2D.y + 1) * rect.height) / 2 + rect.top - 70;

        this.domHUD.style.left = `${Math.max(20, Math.min(window.innerWidth - 360, x - 170))}px`;
        this.domHUD.style.top = `${Math.max(20, y)}px`;
    }

    initDimensionBadge() {
        this.dimBadge = document.createElement('div');
        this.dimBadge.id = 'half-gable-roof-dim-badge';
        this.dimBadge.style.position = 'fixed';
        this.dimBadge.style.zIndex = '9999999';
        this.dimBadge.style.display = 'none';
        this.dimBadge.style.background = 'rgba(0, 0, 0, 0.85)';
        this.dimBadge.style.border = '1px solid #10b981';
        this.dimBadge.style.borderRadius = '4px';
        this.dimBadge.style.padding = '3px 8px';
        this.dimBadge.style.color = '#10b981';
        this.dimBadge.style.fontFamily = 'monospace';
        this.dimBadge.style.fontSize = '11px';
        this.dimBadge.style.fontWeight = 'bold';
        this.dimBadge.style.pointerEvents = 'none';
        document.body.appendChild(this.dimBadge);
    }

    showDimensionBadge(text, localPos) {
        if (!this.dimBadge) return;
        this.dimBadge.innerText = text;
        this.dimBadge.style.display = 'block';

        const worldP = localPos.clone().applyMatrix4(this.handles.matrixWorld);
        const pos2D = worldP.project(this.ctx.camera);
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();

        const x = ((pos2D.x + 1) * rect.width) / 2 + rect.left;
        const y = ((-pos2D.y + 1) * rect.height) / 2 + rect.top - 35;

        this.dimBadge.style.left = `${Math.max(16, x)}px`;
        this.dimBadge.style.top = `${Math.max(16, y)}px`;
    }

    hideDimensionBadge() {
        if (this.dimBadge) this.dimBadge.style.display = 'none';
    }

    formatDim(val) {
        const inches = Math.round(val);
        const feet = Math.floor(inches / 12);
        const remInches = inches % 12;
        const cm = Math.round(val * 2.54);
        if (feet > 0) {
            return `${feet}' ${remInches}" (${cm}cm)`;
        }
        return `${inches}" (${cm}cm)`;
    }

    dispose() {
        const dom = this.ctx.renderer?.domElement || window;
        dom.removeEventListener('pointerdown', this._onPointerDown);
        window.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerup', this._onPointerUp);

        if (this.domHUD && this.domHUD.parentNode) {
            this.domHUD.parentNode.removeChild(this.domHUD);
        }
        if (this.dimBadge && this.dimBadge.parentNode) {
            this.dimBadge.parentNode.removeChild(this.dimBadge);
        }
        this.clearHandles();
    }
}

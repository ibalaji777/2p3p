import * as THREE from 'three';
import { EVENTS } from '../../core/registry.js';
import { coreEventBus } from '../../core/EventBus.js';
import { offsetPolygon } from '../../core/registry.js';
import { RoofEngine } from '../../core/roof/RoofEngine.js';

/**
 * FlatRoofGizmo
 * 
 * Dedicated CAD-Style In-Viewport 3D Interactive Gizmo for Flat Roofs & Terraces.
 * Completely independent from pitched roof gizmos.
 * 
 * Capabilities:
 * 1. Dedicated Edge Push/Pull Handles (One per polygon edge):
 *    - Dragging an edge adjusts ONLY that specific edge's overhang along its outward normal.
 *    - Holding Shift adjusts all edges uniformly.
 *    - Real-time CAD dimension badge displaying current edge overhang.
 * 2. Corner Vertex Handles (Pink Octahedron Crystals):
 *    - Dedicated at each polygon corner to stretch/offset vertices directly.
 * 3. Vertical Slab Thickness Handle (Gold Cone/Shaft on top surface):
 *    - Dragging adjusts slab thickness in cm/inches directly in 3D.
 * 4. In-Scene Floating HUD Toolbar:
 *    - Quick actions: Flush (0"), Uniform 8" Overhang, Thickness +/-, and Delete.
 */
export class FlatRoofGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'FlatRoofGizmo';
        this.mode = 'corners'; // 'corners' | 'move' | 'spin'
        this.target = null;
        this.handles = new THREE.Group();
        this.handles.name = 'FlatRoofHandles';
        this.add(this.handles);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.visible = false;

        // Visual Materials (depthTest: false ensures handles render crisp and un-occluded)
        this.edgeMat = new THREE.MeshBasicMaterial({ color: 0x2563eb, depthTest: false, transparent: true, opacity: 0.95 });
        this.edgeMatHover = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false, transparent: true, opacity: 1.0 });
        this.edgeMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.cornerMat = new THREE.MeshBasicMaterial({ color: 0xec4899, depthTest: false, transparent: true, opacity: 0.95 });
        this.cornerMatHover = new THREE.MeshBasicMaterial({ color: 0xf472b6, depthTest: false, transparent: true, opacity: 1.0 });
        this.cornerMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.thickMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 });
        this.thickMatHover = new THREE.MeshBasicMaterial({ color: 0xfde047, depthTest: false, transparent: true, opacity: 1.0 });
        this.thickMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.moveMat = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.moveMatHover = new THREE.MeshBasicMaterial({ color: 0x34d399, depthTest: false, transparent: true, opacity: 1.0 });
        this.moveMatActive = new THREE.MeshBasicMaterial({ color: 0x059669, depthTest: false, transparent: true, opacity: 1.0 });

        this.spinMat = new THREE.MeshBasicMaterial({ color: 0x6366f1, depthTest: false, transparent: true, opacity: 0.95 });
        this.spinMatHover = new THREE.MeshBasicMaterial({ color: 0x818cf8, depthTest: false, transparent: true, opacity: 1.0 });
        this.spinMatActive = new THREE.MeshBasicMaterial({ color: 0x4f46e5, depthTest: false, transparent: true, opacity: 1.0 });

        this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.9 });

        this.activeHandle = null;
        this.hoveredHandle = null;
        this.isDragging = false;
        this.dragPlane = new THREE.Plane();
        this.dragStartPos = new THREE.Vector3();
        this.planeIntersect = new THREE.Vector3();

        this.initialOverhang = 8;
        this.initialOverhangs = [];
        this.initialThickness = 15;
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

        this.edgeHandles = [];
        this.cornerHandles = [];
        this.thicknessHandle = null;
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
                this.initialThickness = conf.thickness !== undefined ? conf.thickness : 15;
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

                const type = handle.userData?.type;
                if (type === 'edge') {
                    const edgeIdx = handle.userData?.edgeIndex ?? 0;
                    this.initialOverhang = this.initialOverhangs[edgeIdx] !== undefined ? this.initialOverhangs[edgeIdx] : (conf.overhang || 8);
                    // Horizontal drag plane (XZ)
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), intersects[0].point);
                } else if (type === 'thickness') {
                    // Vertical drag plane facing camera
                    const camDir = this.ctx.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate();
                    this.dragPlane.setFromNormalAndCoplanarPoint(camDir, intersects[0].point);
                } else {
                    // Corner stretch: horizontal drag plane (XZ)
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

                if (type === 'move') {
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

                    RoofEngine.setRotation(entity, newRot, this.ctx.planner || this.ctx);

                    if (this.ctx.gizmoManager && this.ctx.gizmoManager.syncRoofSpinPanel) {
                        this.ctx.gizmoManager.syncRoofSpinPanel(entity);
                    }

                    this._updateDOMBadge(`SPIN: ${newRot}&deg;`, { x: e.clientX, y: e.clientY });
                } else if (type === 'edge') {
                    // DEDICATED Edge Push/Pull: projects strictly along edge's outward normal
                    const edgeIdx = this.activeHandle.userData?.edgeIndex ?? 0;
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
                        RoofEngine.setOverhang(entity, newOverhang, null, this.ctx.planner || this.ctx);
                        this._updateDOMBadge(`ALL OVERHANGS: ${this._formatFeetInches(newOverhang)}`, { x: e.clientX, y: e.clientY });
                    } else {
                        // SINGLE SIDE dedicated modification
                        RoofEngine.setOverhang(entity, newOverhang, edgeIdx, this.ctx.planner || this.ctx);
                        this._updateDOMBadge(`SIDE ${edgeIdx + 1} OVERHANG: ${this._formatFeetInches(newOverhang)}`, { x: e.clientX, y: e.clientY });
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
                        this._updateDOMBadge(`SLAB FOOTPRINT: ${this._formatFeetInches(curW)} &times; ${this._formatFeetInches(curD)}`, { x: e.clientX, y: e.clientY });
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
                } else if (type === 'thickness') {
                    // Vertical Slab Thickness
                    const deltaY = this.planeIntersect.y - this.dragStartPos.y;
                    const newThickness = Math.max(2, Math.min(60, Math.round(this.initialThickness + deltaY)));
                    RoofEngine.setThickness(entity, newThickness, this.ctx.planner || this.ctx);
                    this._updateDOMBadge(`SLAB THICKNESS: ${this._formatFeetInches(newThickness)}`, { x: e.clientX, y: e.clientY });
                }

                this.updateHandlePositions();
                this._updateHUDPosition();
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
        this.domBadge.className = 'flat-roof-live-badge';
        this.domBadge.style.cssText = `
            position: absolute;
            display: none;
            pointer-events: none;
            transform: translate(-50%, -130%);
            padding: 7px 16px;
            border-radius: 18px;
            background: rgba(15, 23, 42, 0.95);
            border: 2px solid #38bdf8;
            box-shadow: 0 6px 22px rgba(0, 0, 0, 0.7), 0 0 16px rgba(56, 189, 248, 0.4);
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
        this.domHUD.className = 'flat-roof-floating-hud';
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
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 12px rgba(56, 189, 248, 0.3);
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
            <span style="font-size: 11px; font-weight: 800; color: #38bdf8; letter-spacing: 0.8px; padding-right: 4px; border-right: 1px solid rgba(255,255,255,0.2);">FLAT ROOF</span>
            <button id="fr-btn-flush" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.25); color: #fff; padding: 4px 10px; border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s;" title="Set all sides flush to wall baseline">⇥ Flush (0")</button>
            <button id="fr-btn-overhang8" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.25); color: #fff; padding: 4px 10px; border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s;" title="Apply uniform 8 inch overhang across all sides">↔ Overhang 8"</button>
            <button id="fr-btn-mat" style="background: rgba(99, 102, 241, 0.25); border: 1px solid rgba(129, 140, 248, 0.5); color: #c7d2fe; padding: 4px 10px; border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s;" title="Select and apply materials to terrace top or wall band">🎨 Material</button>
            <div style="display: flex; align-items: center; gap: 4px; padding-left: 4px; border-left: 1px solid rgba(255,255,255,0.2);">
                <span id="fr-lbl-thick" style="font-size: 11px; color: #94a3b8;">6" Slab</span>
                <button id="fr-btn-thick-sub" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 20px; height: 20px; border-radius: 10px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;">-</button>
                <button id="fr-btn-thick-add" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 20px; height: 20px; border-radius: 10px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;">+</button>
            </div>
        `;

        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domHUD);

        // Bind HUD buttons
        const btnFlush = this.domHUD.querySelector('#fr-btn-flush');
        if (btnFlush) {
            btnFlush.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                RoofEngine.setOverhang(entity, 0, null, this.ctx.planner || this.ctx);
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnOverhang8 = this.domHUD.querySelector('#fr-btn-overhang8');
        if (btnOverhang8) {
            btnOverhang8.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                RoofEngine.setOverhang(entity, 8, null, this.ctx.planner || this.ctx);
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnMat = this.domHUD.querySelector('#fr-btn-mat');
        if (btnMat) {
            btnMat.onclick = (e) => {
                e.stopPropagation();
                if (this.ctx.interactions) {
                    this.ctx.interactions.setTransformMode('material');
                }
            };
        }

        const btnThickSub = this.domHUD.querySelector('#fr-btn-thick-sub');
        if (btnThickSub) {
            btnThickSub.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const cur = conf.thickness !== undefined ? conf.thickness : 15;
                const next = Math.max(5, cur - 5);
                RoofEngine.setThickness(entity, next, this.ctx.planner || this.ctx);
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnThickAdd = this.domHUD.querySelector('#fr-btn-thick-add');
        if (btnThickAdd) {
            btnThickAdd.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const cur = conf.thickness !== undefined ? conf.thickness : 15;
                const next = Math.min(50, cur + 5);
                RoofEngine.setThickness(entity, next, this.ctx.planner || this.ctx);
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }
    }

    _updateHUDContent() {
        if (!this.domHUD || !this.target) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;
        const lbl = this.domHUD.querySelector('#fr-lbl-thick');
        if (lbl) {
            const thick = conf.thickness !== undefined ? conf.thickness : 15;
            lbl.innerText = `${this._formatFeetInches(thick)} Slab`;
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
        const slabThickness = conf.thickness !== undefined ? conf.thickness : 15;

        // Position directly above the slab center
        const worldPos = new THREE.Vector3();
        let targetGroup = this.target;
        while (targetGroup.parent && targetGroup.parent !== this.ctx.structureGroup && targetGroup.parent !== this.ctx.scene) {
            targetGroup = targetGroup.parent;
        }
        targetGroup.getWorldPosition(worldPos);

        const hudWorldPos = new THREE.Vector3(worldPos.x, worldPos.y + slabThickness + 20, worldPos.z);
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

    rebuildHandles() {
        while (this.handles.children.length > 0) {
            const child = this.handles.children[0];
            this.handles.remove(child);
        }

        this.edgeHandles = [];
        this.cornerHandles = [];
        this.thicknessHandle = null;
        this.moveHandle = null;
        this.spinHandle = null;

        if (!this.target) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;

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

        const basePts = entity.points || [];
        const numPts = basePts.length >= 3 ? basePts.length : 4;

        // 1. Dedicated Edge Push/Pull Handles (One per polygon edge)
        for (let i = 0; i < numPts; i++) {
            const tabGroup = new THREE.Group();
            tabGroup.userData = { type: 'edge', edgeIndex: i };

            // Sleek CAD push/pull badge with outward and inward arrowheads
            const tabBody = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 8), this.edgeMat);
            tabBody.renderOrder = 9999;

            const arrowOut = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 8), this.edgeMat);
            arrowOut.rotation.x = Math.PI / 2;
            arrowOut.position.z = 6;
            arrowOut.renderOrder = 9999;

            const arrowIn = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 8), this.edgeMat);
            arrowIn.rotation.x = -Math.PI / 2;
            arrowIn.position.z = -6;
            arrowIn.renderOrder = 9999;

            const ring = new THREE.Mesh(new THREE.TorusGeometry(11, 1.8, 6, 16), this.ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.renderOrder = 9999;

            tabGroup.add(tabBody, arrowOut, arrowIn, ring);
            this.handles.add(tabGroup);
            this.edgeHandles.push(tabGroup);
        }

        // 2. Corner Vertex Handles (Pink Octahedron Crystals)
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

        // 3. Vertical Slab Thickness Handle (Gold Double Arrow on top)
        const thickGroup = new THREE.Group();
        thickGroup.userData = { type: 'thickness' };

        const topCone = new THREE.Mesh(new THREE.ConeGeometry(8, 14, 16), this.thickMat);
        topCone.position.y = 8;
        topCone.renderOrder = 9999;

        const botCone = new THREE.Mesh(new THREE.ConeGeometry(8, 14, 16), this.thickMat);
        botCone.rotation.x = Math.PI;
        botCone.position.y = -8;
        botCone.renderOrder = 9999;

        const thickRing = new THREE.Mesh(new THREE.TorusGeometry(10, 1.8, 8, 20), this.ringMat);
        thickRing.rotation.x = Math.PI / 2;
        thickRing.renderOrder = 9999;

        thickGroup.add(topCone, botCone, thickRing);
        this.handles.add(thickGroup);
        this.thicknessHandle = thickGroup;

        this.refreshHandleMaterials();
    }

    updateHandlePositions() {
        if (!this.target) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;
        const basePts = entity.points || [];
        if (basePts.length < 3) return;

        const numPts = basePts.length;
        const overhangs = conf.overhangs ? conf.overhangs : (conf.overhang !== undefined ? conf.overhang : 8);
        const pts = offsetPolygon(basePts, overhangs);

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pts.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });

        const cx = (minX + maxX) / 2;
        const cz = (minY + maxY) / 2;

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
        const slabThickness = conf.thickness !== undefined ? conf.thickness : 15;
        const slabTopY = baseY + slabThickness + 2;

        if (this.moveHandle) {
            this.moveHandle.position.set(0, slabTopY + 2, 0);
        }
        if (this.spinHandle) {
            this.spinHandle.position.set(0, slabTopY + 2, 0);
        }

        // Position Vertical Slab Thickness handle at center
        if (this.thicknessHandle) {
            this.thicknessHandle.position.set(0, slabTopY + 8, 0);
        }

        let signedArea = 0;
        for (let j = 0; j < basePts.length; j++) {
            let a = basePts[j];
            let b = basePts[(j + 1) % basePts.length];
            signedArea += (a.x * b.y - b.x * a.y);
        }

        // Position Edge Push/Pull Handles
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
                    handle.position.set(midX - cx, slabTopY, midY - cz);
                    handle.rotation.y = -Math.atan2(ny, nx) + Math.PI / 2;
                    handle.userData.nx = nx;
                    handle.userData.ny = ny;
                    handle.userData.edgeIndex = idx;
                }
            });
        }

        // Position Corner Vertex Handles
        if (this.cornerHandles && this.cornerHandles.length > 0) {
            pts.forEach((p, idx) => {
                if (idx >= this.cornerHandles.length) return;
                const handle = this.cornerHandles[idx];
                if (handle) {
                    handle.position.set(p.x - cx, slabTopY, p.y - cz);
                    handle.userData.cornerIndex = idx;
                }
            });
        }
    }

    refreshHandleMaterials() {
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

        if (this.edgeHandles) {
            this.edgeHandles.forEach(h => {
                const isActive = this.activeHandle === h;
                const isHover = this.hoveredHandle === h;
                const m = isActive ? this.edgeMatActive : (isHover ? this.edgeMatHover : this.edgeMat);
                h.children.forEach(c => { if (c.material !== this.ringMat) c.material = m; });
            });
        }

        if (this.cornerHandles) {
            this.cornerHandles.forEach(h => {
                const isActive = this.activeHandle === h;
                const isHover = this.hoveredHandle === h;
                const m = isActive ? this.cornerMatActive : (isHover ? this.cornerMatHover : this.cornerMat);
                h.children.forEach(c => { if (c.material !== this.ringMat) c.material = m; });
            });
        }

        if (this.thicknessHandle) {
            const isActive = this.activeHandle === this.thicknessHandle;
            const isHover = this.hoveredHandle === this.thicknessHandle;
            const m = isActive ? this.thickMatActive : (isHover ? this.thickMatHover : this.thickMat);
            this.thicknessHandle.children.forEach(c => { if (c.material !== this.ringMat) c.material = m; });
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
        if (this.domHUD && this.domHUD.parentElement) {
            this.domHUD.parentElement.removeChild(this.domHUD);
        }
        if (typeof this._unsubSync === 'function') {
            this._unsubSync();
        } else if (this._onSyncEngine) {
            coreEventBus.off(EVENTS.SYNC_ENGINE, this._onSyncEngine);
        }
        if (this.edgeMat) this.edgeMat.dispose();
        if (this.cornerMat) this.cornerMat.dispose();
        if (this.thickMat) this.thickMat.dispose();
        if (this.moveMat) this.moveMat.dispose();
        if (this.moveMatHover) this.moveMatHover.dispose();
        if (this.moveMatActive) this.moveMatActive.dispose();
        if (this.spinMat) this.spinMat.dispose();
        if (this.spinMatHover) this.spinMatHover.dispose();
        if (this.spinMatActive) this.spinMatActive.dispose();
        if (this.ringMat) this.ringMat.dispose();
    }
}

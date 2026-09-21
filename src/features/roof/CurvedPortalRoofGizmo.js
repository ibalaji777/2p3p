import * as THREE from 'three';
import { EVENTS } from '../../core/registry.js';
import { coreEventBus } from '../../core/EventBus.js';
import { RoofEngine } from '../../core/roof/RoofEngine.js';

/**
 * CurvedPortalRoofGizmo
 * 
 * Dedicated CAD-Style In-Viewport 3D Interactive Gizmo for Modern Curved Portal / Wrap Roofs.
 * 
 * Capabilities:
 * 1. Interactive 3D Corner Fillet Gizmo:
 *    - Cyan curve handle placed directly at the roof-to-wall corner.
 *    - Dragging smoothly adjusts the corner radius R in real-time with 60 FPS feedback.
 *    - Live CAD dimension badge showing exact radius in inches & cm.
 * 2. In-Scene Floating HUD Toolbar:
 *    - 1-Click Wall Toggles: [Left Wall: ON/OFF], [Right Wall: ON/OFF], [Front Wall: ON/OFF], [Back Wall: ON/OFF].
 *    - Architectural Presets: [1-Wall Cantilever], [2-Wall Portal], [3-Wall Box], [4-Wall Cube], [Slab Only].
 *    - Curvature Presets: [Sharp (0")], [Soft (12")], [Deep (24")], and interactive slider.
 *    - Slab Thickness & Wall Drop Height controls.
 *    - Under-soffit Recessed LED Spotlights toggle.
 *    - Material selector trigger.
 * 3. Full Undo/Redo integration.
 */
export class CurvedPortalRoofGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'CurvedPortalRoofGizmo';
        this.mode = 'corners'; // 'corners' | 'move' | 'spin'
        this.target = null;
        this.handles = new THREE.Group();
        this.handles.name = 'CurvedPortalHandles';
        this.add(this.handles);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.visible = false;

        // Visual Materials (depthTest: false ensures handles render crisp and un-occluded)
        this.curveMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 0.95 });
        this.curveMatHover = new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false, transparent: true, opacity: 1.0 });
        this.curveMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.thickMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 });
        this.thickMatHover = new THREE.MeshBasicMaterial({ color: 0xfde047, depthTest: false, transparent: true, opacity: 1.0 });
        this.thickMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.cornerMat = new THREE.MeshBasicMaterial({ color: 0xec4899, depthTest: false, transparent: true, opacity: 0.95 });
        this.cornerMatHover = new THREE.MeshBasicMaterial({ color: 0xf472b6, depthTest: false, transparent: true, opacity: 1.0 });
        this.cornerMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.moveMat = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.moveMatHover = new THREE.MeshBasicMaterial({ color: 0x34d399, depthTest: false, transparent: true, opacity: 1.0 });

        this.spinMat = new THREE.MeshBasicMaterial({ color: 0x6366f1, depthTest: false, transparent: true, opacity: 0.95 });
        this.spinMatHover = new THREE.MeshBasicMaterial({ color: 0x818cf8, depthTest: false, transparent: true, opacity: 1.0 });

        this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });

        this.activeHandle = null;
        this.hoveredHandle = null;
        this.isDragging = false;
        this.dragPlane = new THREE.Plane();
        this.dragStartPos = new THREE.Vector3();

        this.initialRadius = 0;
        this.initialThickness = 15;
        this.initialPoints = [];
        this.initialMinX = 0;
        this.initialMaxX = 0;
        this.initialMinY = 0;
        this.initialMaxY = 0;
        this.curveHandles = [];
        this.thicknessHandle = null;
        this.cornerHandles = [];

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

                this.initialRadius = conf.radius !== undefined ? Number(conf.radius) : 0;
                this.initialThickness = conf.thickness !== undefined ? Number(conf.thickness) : 15;
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
                if (type === 'curve') {
                    // Horizontal drag plane (XZ)
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), intersects[0].point);
                } else if (type === 'thickness') {
                    let camDir = this.ctx.camera.getWorldDirection(new THREE.Vector3()).setY(0);
                    if (camDir.lengthSq() < 1e-4) camDir.set(0, 0, 1);
                    else camDir.normalize().negate();
                    this.dragPlane.setFromNormalAndCoplanarPoint(camDir, intersects[0].point);
                } else {
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), intersects[0].point);
                }

                this.dragStartPos.copy(intersects[0].point);
                if (this.ctx.controls) this.ctx.controls.enabled = false;
            }
        };

        this._onPointerMove = (e) => {
            if (!this.visible || !this.target) return;
            this.updateMouse(e);

            if (this.isDragging && this.activeHandle) {
                e.preventDefault();
                e.stopPropagation();

                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const planeIntersect = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, planeIntersect);

                if (planeIntersect) {
                    const type = this.activeHandle.userData?.type;
                    const entity = this.target.userData?.entity;
                    if (!entity) return;

                    if (type === 'curve') {
                        // Dragging adjusts corner radius R
                        const delta = planeIntersect.clone().sub(this.dragStartPos);
                        const dir = this.activeHandle.userData?.dir || { x: 1, z: 0 };
                        const dotDelta = delta.x * dir.x + delta.z * dir.z;

                        const newRadius = Math.max(0, Math.min(150, Math.round(this.initialRadius + dotDelta)));
                        RoofEngine.setCornerRadius(entity, newRadius, this.ctx.planner || this.ctx);

                        this._updateDOMBadge(
                            `Corner Radius: <b>${this._formatFeetInches(newRadius)}</b> (${Math.round(newRadius)} cm)`,
                            { x: e.clientX, y: e.clientY }
                        );
                        this._updateHUDContent();
                    } else if (type === 'thickness') {
                        const deltaY = planeIntersect.y - this.dragStartPos.y;
                        const newThick = Math.max(5, Math.min(100, Math.round(this.initialThickness + deltaY)));
                        RoofEngine.setThickness(entity, newThick, this.ctx.planner || this.ctx);

                        this._updateDOMBadge(
                            `Slab Thickness: <b>${this._formatFeetInches(newThick)}</b> (${Math.round(newThick)} cm)`,
                            { x: e.clientX, y: e.clientY }
                        );
                        this._updateHUDContent();
                    } else if (type === 'corner') {
                        const cIdx = this.activeHandle.userData?.cornerIndex ?? 0;
                        const deltaX = planeIntersect.x - this.dragStartPos.x;
                        const deltaZ = planeIntersect.z - this.dragStartPos.z;

                        if (this.initialPoints.length === 4) {
                            let minX = this.initialMinX, maxX = this.initialMaxX;
                            let minY = this.initialMinY, maxY = this.initialMaxY;

                            if (cIdx === 0) {
                                minX = Math.min(maxX - 40, this.initialMinX + deltaX);
                                minY = Math.min(maxY - 40, this.initialMinY + deltaZ);
                            } else if (cIdx === 1) {
                                maxX = Math.max(minX + 40, this.initialMaxX + deltaX);
                                minY = Math.min(maxY - 40, this.initialMinY + deltaZ);
                            } else if (cIdx === 2) {
                                maxX = Math.max(minX + 40, this.initialMaxX + deltaX);
                                maxY = Math.max(minY + 40, this.initialMaxY + deltaZ);
                            } else if (cIdx === 3) {
                                minX = Math.min(maxX - 40, this.initialMinX + deltaX);
                                maxY = Math.max(minY + 40, this.initialMaxY + deltaZ);
                            }

                            const newPts = [
                                { x: minX, y: minY },
                                { x: maxX, y: minY },
                                { x: maxX, y: maxY },
                                { x: minX, y: maxY }
                            ];
                            RoofEngine.setPoints(entity, newPts, this.ctx.planner || this.ctx);
                            const curW = maxX - minX, curD = maxY - minY;
                            this._updateDOMBadge(
                                `Portal Footprint: <b>${this._formatFeetInches(curW)} &times; ${this._formatFeetInches(curD)}</b>`,
                                { x: e.clientX, y: e.clientY }
                            );
                        } else if (cIdx !== undefined && this.initialPoints[cIdx]) {
                            const newPts = this.initialPoints.map((p, idx) => {
                                if (idx === cIdx) {
                                    return { x: Math.round(p.x + deltaX), y: Math.round(p.y + deltaZ) };
                                }
                                return { x: p.x, y: p.y };
                            });
                            RoofEngine.setPoints(entity, newPts, this.ctx.planner || this.ctx);
                        }
                    }

                    this.updateHandlePositions();
                    if (this.ctx && typeof this.ctx.requestRender === 'function') {
                        this.ctx.requestRender();
                    }
                }
            } else {
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const intersects = this.raycaster.intersectObjects(this.handles.children, true);
                if (intersects.length > 0) {
                    if (dom) dom.style.cursor = 'pointer';
                    let h = intersects[0].object;
                    while (h.parent && h.parent !== this.handles) h = h.parent;
                    if (this.hoveredHandle !== h) {
                        this._setHandleHover(h, true);
                        this.hoveredHandle = h;
                    }
                } else {
                    if (dom) dom.style.cursor = 'auto';
                    if (this.hoveredHandle) {
                        this._setHandleHover(this.hoveredHandle, false);
                        this.hoveredHandle = null;
                    }
                }
            }
        };

        this._onPointerUp = (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                this.activeHandle = null;
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                this._hideDOMBadge();

                const entity = this.target?.userData?.entity;
                if (entity) {
                    coreEventBus.emit(EVENTS.ROOF_CORNER_GIZMO_END, { entity });
                    if (this.ctx.planner?.debouncedSaveHistory) {
                        this.ctx.planner.debouncedSaveHistory();
                    }
                }
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            }
        };

        if (dom && typeof dom.addEventListener === 'function') {
            dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
            dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
            dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
        }

        if (this.ctx.controls) {
            this.ctx.controls.addEventListener('change', () => this._updateHUDPosition());
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', () => this._updateHUDPosition());
        }
    }

    _setHandleHover(handle, isHover) {
        if (!handle) return;
        const type = handle.userData?.type;
        handle.traverse(c => {
            if (c.isMesh && c.userData?.isMainMesh) {
                if (type === 'curve') c.material = isHover ? this.curveMatHover : this.curveMat;
                else if (type === 'thickness') c.material = isHover ? this.thickMatHover : this.thickMat;
                else if (type === 'corner') c.material = isHover ? this.cornerMatHover : this.cornerMat;
            }
        });
    }

    _createDOMBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'curved-portal-drag-badge';
        this.domBadge.style.cssText = `
            position: fixed;
            display: none;
            transform: translate(-50%, -100%);
            padding: 6px 14px;
            border-radius: 9999px;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 2px solid #00f0ff;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65), 0 0 16px rgba(0, 240, 255, 0.4);
            color: #ffffff;
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
            pointer-events: none;
            z-index: 100006;
            user-select: none;
        `;
        document.body.appendChild(this.domBadge);
    }

    _updateDOMBadge(text, screenPos) {
        if (!this.domBadge) return;
        if (!text || !screenPos) {
            this.domBadge.style.display = 'none';
            return;
        }
        this.domBadge.innerHTML = text;
        this.domBadge.style.left = `${screenPos.x}px`;
        this.domBadge.style.top = `${screenPos.y - 15}px`;
        this.domBadge.style.display = 'block';
    }

    _hideDOMBadge() {
        if (this.domBadge) this.domBadge.style.display = 'none';
    }

    _createDOMHUD() {
        if (typeof document === 'undefined') return;
        this.domHUD = document.createElement('div');
        this.domHUD.className = 'curved-portal-floating-hud';
        this.domHUD.style.cssText = `
            position: fixed;
            display: none;
            flex-direction: column;
            gap: 6px;
            padding: 10px 14px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(0, 240, 255, 0.35);
            border-radius: 12px;
            box-shadow: 0 12px 36px rgba(0,0,0,0.65), 0 0 20px rgba(0, 240, 255, 0.2);
            color: white;
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 11px;
            font-weight: 600;
            z-index: 99999;
            backdrop-filter: blur(12px);
            user-select: none;
            width: max-content;
            max-width: 360px;
        `;

        this.domHUD.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 4px;">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-weight: 800; font-size: 11px; color: #00f0ff; letter-spacing: 0.5px;">• CURVED PORTAL ROOF</span>
                </div>
                <div style="display: flex; align-items: center; gap: 3px;">
                    <button id="cp-btn-spotlights" style="background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.5); color: #fde047; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer;" title="Toggle under-soffit recessed LED spotlights">💡 Lights</button>
                    <button id="cp-btn-mat" style="background: rgba(99, 102, 241, 0.35); border: 1px solid rgba(129, 140, 248, 0.5); color: #c7d2fe; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer;" title="Apply Materials">🎨</button>
                    <button id="cp-btn-close" style="background: rgba(239, 68, 68, 0.25); border: 1px solid rgba(239, 68, 68, 0.5); color: #fca5a5; border-radius: 4px; width: 20px; height: 20px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Close Menu">✕</button>
                </div>
            </div>

            <!-- Wall Toggle Pills -->
            <div style="display: flex; align-items: center; gap: 4px; justify-content: space-between;">
                <span style="font-size: 10px; color: #94a3b8; width: 36px;">Walls:</span>
                <button id="cp-wall-left" class="cp-wall-btn" style="flex: 1; padding: 3px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white;">Left</button>
                <button id="cp-wall-right" class="cp-wall-btn" style="flex: 1; padding: 3px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white;">Right</button>
                <button id="cp-wall-front" class="cp-wall-btn" style="flex: 1; padding: 3px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white;">Front</button>
                <button id="cp-wall-back" class="cp-wall-btn" style="flex: 1; padding: 3px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white;">Back</button>
            </div>

            <!-- Architectural Presets -->
            <div style="display: flex; gap: 3px; justify-content: space-between; overflow-x: auto;">
                <button id="cp-preset-cantilever" style="flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; border-radius: 4px; padding: 2px 4px; font-size: 9.5px; cursor: pointer;" title="1-Wall Cantilever Canopy">Cantilever</button>
                <button id="cp-preset-portal" style="flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; border-radius: 4px; padding: 2px 4px; font-size: 9.5px; cursor: pointer;" title="2-Wall U-Portal Frame">Portal</button>
                <button id="cp-preset-box" style="flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; border-radius: 4px; padding: 2px 4px; font-size: 9.5px; cursor: pointer;" title="3-Wall Box Frame">Box</button>
                <button id="cp-preset-cube" style="flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; border-radius: 4px; padding: 2px 4px; font-size: 9.5px; cursor: pointer;" title="4-Wall Enclosed Cube">Cube</button>
                <button id="cp-preset-slab" style="flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; border-radius: 4px; padding: 2px 4px; font-size: 9.5px; cursor: pointer;" title="Roof Slab Only">Slab</button>
            </div>

            <!-- Corner Fillet Curvature Controls -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; background: rgba(0,0,0,0.25); padding: 4px 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
                <span style="font-size: 10px; color: #00f0ff; width: 42px;">Fillet R:</span>
                <button id="cp-r-sharp" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 1px 5px; font-size: 9.5px; cursor: pointer;">0" Sharp</button>
                <button id="cp-r-soft" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 1px 5px; font-size: 9.5px; cursor: pointer;">12" Soft</button>
                <button id="cp-r-deep" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 1px 5px; font-size: 9.5px; cursor: pointer;">24" Deep</button>
                <input type="range" id="cp-r-slider" min="0" max="100" step="2" style="flex: 1; accent-color: #00f0ff; cursor: pointer;">
                <span id="cp-r-label" style="font-size: 10px; color: #fde047; min-width: 24px; text-align: right;">0"</span>
            </div>

            <!-- Slab Thickness & Drop Height -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                <div style="display: flex; align-items: center; background: #1e293b; border-radius: 4px; padding: 1px 4px; border: 1px solid rgba(255,255,255,0.1);" title="Slab Thickness">
                    <span style="font-size: 9.5px; color: #94a3b8; margin-right: 4px;">Slab:</span>
                    <button id="cp-thick-sub" style="background: transparent; border: none; color: #38bdf8; font-weight: bold; cursor: pointer; padding: 1px 3px; font-size: 10px;">-</button>
                    <span id="cp-thick-lbl" style="font-size: 9.5px; color: #cbd5e1; min-width: 32px; text-align: center;">6"</span>
                    <button id="cp-thick-add" style="background: transparent; border: none; color: #38bdf8; font-weight: bold; cursor: pointer; padding: 1px 3px; font-size: 10px;">+</button>
                </div>

                <div style="display: flex; align-items: center; background: #1e293b; border-radius: 4px; padding: 1px 4px; border: 1px solid rgba(255,255,255,0.1);" title="Wall Drop Height">
                    <span style="font-size: 9.5px; color: #94a3b8; margin-right: 4px;">Drop:</span>
                    <button id="cp-drop-sub" style="background: transparent; border: none; color: #38bdf8; font-weight: bold; cursor: pointer; padding: 1px 3px; font-size: 10px;">-</button>
                    <span id="cp-drop-lbl" style="font-size: 9.5px; color: #cbd5e1; min-width: 36px; text-align: center;">Floor</span>
                    <button id="cp-drop-add" style="background: transparent; border: none; color: #38bdf8; font-weight: bold; cursor: pointer; padding: 1px 3px; font-size: 10px;">+</button>
                </div>
            </div>
        `;

        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domHUD);

        this._bindHUDEvents();
    }

    _bindHUDEvents() {
        if (!this.domHUD) return;

        // Wall Toggles
        const bindWallToggle = (btnId, sideKey) => {
            const btn = this.domHUD.querySelector(btnId);
            if (btn) {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const entity = this.target?.userData?.entity;
                    if (!entity) return;
                    const conf = entity.config || entity;
                    const curSides = conf.wallSides || { left: true, right: true, front: false, back: false };
                    const curVal = Boolean(curSides[sideKey]);
                    RoofEngine.setWallSide(entity, sideKey, !curVal, this.ctx.planner || this.ctx);
                    this._updateHUDContent();
                    this.updateHandlePositions();
                    coreEventBus.emit(EVENTS.SYNC_ENGINE);
                };
            }
        };

        bindWallToggle('#cp-wall-left', 'left');
        bindWallToggle('#cp-wall-right', 'right');
        bindWallToggle('#cp-wall-front', 'front');
        bindWallToggle('#cp-wall-back', 'back');

        // Presets
        const setSides = (sides) => {
            const entity = this.target?.userData?.entity;
            if (!entity) return;
            RoofEngine.setWallSides(entity, sides, this.ctx.planner || this.ctx);
            this._updateHUDContent();
            this.updateHandlePositions();
            coreEventBus.emit(EVENTS.SYNC_ENGINE);
        };

        const btnCantilever = this.domHUD.querySelector('#cp-preset-cantilever');
        if (btnCantilever) btnCantilever.onclick = (e) => { e.stopPropagation(); setSides({ left: true, right: false, front: false, back: false }); };

        const btnPortal = this.domHUD.querySelector('#cp-preset-portal');
        if (btnPortal) btnPortal.onclick = (e) => { e.stopPropagation(); setSides({ left: true, right: true, front: false, back: false }); };

        const btnBox = this.domHUD.querySelector('#cp-preset-box');
        if (btnBox) btnBox.onclick = (e) => { e.stopPropagation(); setSides({ left: true, right: true, front: false, back: true }); };

        const btnCube = this.domHUD.querySelector('#cp-preset-cube');
        if (btnCube) btnCube.onclick = (e) => { e.stopPropagation(); setSides({ left: true, right: true, front: true, back: true }); };

        const btnSlab = this.domHUD.querySelector('#cp-preset-slab');
        if (btnSlab) btnSlab.onclick = (e) => { e.stopPropagation(); setSides({ left: false, right: false, front: false, back: false }); };

        // Fillet Curvature Controls
        const setRadius = (r) => {
            const entity = this.target?.userData?.entity;
            if (!entity) return;
            RoofEngine.setCornerRadius(entity, r, this.ctx.planner || this.ctx);
            this._updateHUDContent();
            this.updateHandlePositions();
            coreEventBus.emit(EVENTS.SYNC_ENGINE);
        };

        const btnRSharp = this.domHUD.querySelector('#cp-r-sharp');
        if (btnRSharp) btnRSharp.onclick = (e) => { e.stopPropagation(); setRadius(0); };

        const btnRSoft = this.domHUD.querySelector('#cp-r-soft');
        if (btnRSoft) btnRSoft.onclick = (e) => { e.stopPropagation(); setRadius(30); };

        const btnRDeep = this.domHUD.querySelector('#cp-r-deep');
        if (btnRDeep) btnRDeep.onclick = (e) => { e.stopPropagation(); setRadius(60); };

        const rSlider = this.domHUD.querySelector('#cp-r-slider');
        if (rSlider) {
            rSlider.oninput = (e) => {
                e.stopPropagation();
                setRadius(Number(e.target.value));
            };
        }

        // Spotlights Toggle
        const btnSpotlights = this.domHUD.querySelector('#cp-btn-spotlights');
        if (btnSpotlights) {
            btnSpotlights.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const cur = conf.hasSpotlights !== false;
                RoofEngine.setSpotlights(entity, !cur, this.ctx.planner || this.ctx);
                this._updateHUDContent();
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        // Slab Thickness
        const btnThickSub = this.domHUD.querySelector('#cp-thick-sub');
        if (btnThickSub) {
            btnThickSub.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const cur = conf.thickness !== undefined ? conf.thickness : 15;
                RoofEngine.setThickness(entity, Math.max(5, cur - 5), this.ctx.planner || this.ctx);
                this._updateHUDContent();
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnThickAdd = this.domHUD.querySelector('#cp-thick-add');
        if (btnThickAdd) {
            btnThickAdd.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const cur = conf.thickness !== undefined ? conf.thickness : 15;
                RoofEngine.setThickness(entity, Math.min(100, cur + 5), this.ctx.planner || this.ctx);
                this._updateHUDContent();
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        // Wall Drop Height
        const btnDropSub = this.domHUD.querySelector('#cp-drop-sub');
        if (btnDropSub) {
            btnDropSub.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const cur = Number(conf.wallDropHeight) || 0;
                RoofEngine.setWallDropHeight(entity, Math.max(0, cur - 30), this.ctx.planner || this.ctx);
                this._updateHUDContent();
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        const btnDropAdd = this.domHUD.querySelector('#cp-drop-add');
        if (btnDropAdd) {
            btnDropAdd.onclick = (e) => {
                e.stopPropagation();
                const entity = this.target?.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const cur = Number(conf.wallDropHeight) || 0;
                RoofEngine.setWallDropHeight(entity, cur + 30, this.ctx.planner || this.ctx);
                this._updateHUDContent();
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            };
        }

        // Material Trigger
        const btnMat = this.domHUD.querySelector('#cp-btn-mat');
        if (btnMat) {
            btnMat.onclick = (e) => {
                e.stopPropagation();
                if (this.ctx.interactions) {
                    this.ctx.interactions.setTransformMode('material');
                }
            };
        }

        // Close
        const btnClose = this.domHUD.querySelector('#cp-btn-close');
        if (btnClose) {
            btnClose.onclick = (e) => {
                e.stopPropagation();
                this.detach();
                if (this.ctx.interactions) {
                    this.ctx.interactions.setTransformMode('none');
                }
            };
        }
    }

    _updateHUDContent() {
        if (!this.domHUD || !this.target) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;

        const sides = conf.wallSides || { left: true, right: true, front: false, back: false };
        const updateBtn = (id, active) => {
            const b = this.domHUD.querySelector(id);
            if (b) {
                b.style.background = active ? 'rgba(0, 240, 255, 0.3)' : 'rgba(255,255,255,0.08)';
                b.style.borderColor = active ? '#00f0ff' : 'rgba(255,255,255,0.15)';
                b.style.color = active ? '#ffffff' : '#94a3b8';
            }
        };

        updateBtn('#cp-wall-left', sides.left);
        updateBtn('#cp-wall-right', sides.right);
        updateBtn('#cp-wall-front', sides.front);
        updateBtn('#cp-wall-back', sides.back);

        const r = conf.radius !== undefined ? Number(conf.radius) : 0;
        const rLbl = this.domHUD.querySelector('#cp-r-label');
        if (rLbl) rLbl.innerText = `${this._formatFeetInches(r)}`;

        const rSlider = this.domHUD.querySelector('#cp-r-slider');
        if (rSlider) rSlider.value = r;

        const thick = conf.thickness !== undefined ? conf.thickness : 15;
        const thickLbl = this.domHUD.querySelector('#cp-thick-lbl');
        if (thickLbl) thickLbl.innerText = `${this._formatFeetInches(thick)}`;

        const dropH = Number(conf.wallDropHeight) || 0;
        const dropLbl = this.domHUD.querySelector('#cp-drop-lbl');
        if (dropLbl) dropLbl.innerText = dropH > 0 ? `${this._formatFeetInches(dropH)}` : 'Floor';

        const spotBtn = this.domHUD.querySelector('#cp-btn-spotlights');
        if (spotBtn) {
            const hasSpots = conf.hasSpotlights !== false;
            spotBtn.style.background = hasSpots ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.08)';
            spotBtn.style.color = hasSpots ? '#fde047' : '#94a3b8';
        }
    }

    _updateHUDPosition() {
        if (!this.domHUD || !this.target || !this.visible || this.mode !== 'corners') {
            if (this.domHUD) this.domHUD.style.display = 'none';
            return;
        }

        const entity = this.target.userData?.entity;
        if (!entity) return;

        const worldPos = new THREE.Vector3();
        let targetGroup = this.target;
        while (targetGroup.parent && targetGroup.parent !== this.ctx.structureGroup && targetGroup.parent !== this.ctx.scene) {
            targetGroup = targetGroup.parent;
        }
        targetGroup.getWorldPosition(worldPos);

        const hudWorldPos = new THREE.Vector3(worldPos.x, worldPos.y + 35, worldPos.z);
        const screenPos = hudWorldPos.clone().project(this.ctx.camera);

        if (screenPos.z > 1) {
            this.domHUD.style.display = 'none';
            return;
        }

        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();

        const x = (screenPos.x * 0.5 + 0.5) * rect.width + rect.left;
        const y = (-screenPos.y * 0.5 + 0.5) * rect.height + rect.top - 20;

        this.domHUD.style.left = `${Math.max(180, Math.min(window.innerWidth - 180, x))}px`;
        this.domHUD.style.top = `${Math.max(20, y)}px`;
        this.domHUD.style.display = 'flex';
    }

    _formatFeetInches(px) {
        const totalInches = Math.round((px / 20) * 12);
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        return feet > 0 ? `${feet}' ${inches}"` : `${inches}"`;
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

        this.visible = true;
        this.buildHandles();
        this.updateHandlePositions();
        this._updateHUDContent();
        this._updateHUDPosition();

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    detach() {
        this.target = null;
        this.visible = false;
        this._clearHandles();
        this._hideDOMBadge();
        if (this.domHUD) this.domHUD.style.display = 'none';

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    _clearHandles() {
        while (this.handles.children.length > 0) {
            const c = this.handles.children[0];
            this.handles.remove(c);
            c.traverse(node => {
                if (node.geometry) node.geometry.dispose();
            });
        }
        this.curveHandles = [];
        this.thicknessHandle = null;
    }

    buildHandles() {
        this._clearHandles();
        if (!this.target) return;

        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;
        const sides = conf.wallSides || { left: true, right: true, front: false, back: false };

        // 1. Curve Gizmo Handles (One for each active curved corner)
        const createCurveHandle = (side, dir) => {
            const hGroup = new THREE.Group();
            hGroup.userData = { type: 'curve', side, dir };

            // Cyan glowing torus arc
            const torusGeo = new THREE.TorusGeometry(8, 2.2, 16, 24, Math.PI / 2);
            if (side === 'right') torusGeo.rotateZ(-Math.PI / 2);
            const torusMesh = new THREE.Mesh(torusGeo, this.curveMat);
            torusMesh.userData = { isMainMesh: true };
            hGroup.add(torusMesh);

            // Diamond apex pill
            const pillGeo = new THREE.OctahedronGeometry(5, 0);
            const pillMesh = new THREE.Mesh(pillGeo, this.ringMat);
            pillMesh.position.set(0, 0, 0);
            hGroup.add(pillMesh);

            this.handles.add(hGroup);
            this.curveHandles.push(hGroup);
        };

        if (sides.left) createCurveHandle('left', { x: 1, z: 0 });
        if (sides.right) createCurveHandle('right', { x: -1, z: 0 });

        // 2. Vertical Slab Thickness Handle (Gold cone)
        const thickGroup = new THREE.Group();
        thickGroup.userData = { type: 'thickness' };

        const coneGeo = new THREE.ConeGeometry(5, 12, 16);
        coneGeo.translate(0, 6, 0);
        const coneMesh = new THREE.Mesh(coneGeo, this.thickMat);
        coneMesh.userData = { isMainMesh: true };
        thickGroup.add(coneMesh);

        const shaftGeo = new THREE.CylinderGeometry(1.5, 1.5, 10, 12);
        shaftGeo.translate(0, -5, 0);
        const shaftMesh = new THREE.Mesh(shaftGeo, this.ringMat);
        thickGroup.add(shaftMesh);

        this.handles.add(thickGroup);
        this.thicknessHandle = thickGroup;

        // 3. Footprint Corner Stretch Handles (Pink Octahedron Crystals)
        this.cornerHandles = [];
        const cornerGeo = new THREE.OctahedronGeometry(5.5, 0);
        const numCorners = entity.points?.length || 4;
        for (let i = 0; i < numCorners; i++) {
            const cGroup = new THREE.Group();
            cGroup.userData = { type: 'corner', cornerIndex: i };
            const cMesh = new THREE.Mesh(cornerGeo, this.cornerMat);
            cMesh.userData = { isMainMesh: true };
            cGroup.add(cMesh);
            this.handles.add(cGroup);
            this.cornerHandles.push(cGroup);
        }
    }

    updateHandlePositions() {
        if (!this.target || !this.visible) return;
        const entity = this.target.userData?.entity;
        if (!entity || !entity.points) return;
        const conf = entity.config || entity;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        entity.points.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });

        const cx = (minX + maxX) / 2;
        const cz = (minY + maxY) / 2;
        const R = conf.radius !== undefined ? Number(conf.radius) : 0;
        const T = conf.thickness !== undefined ? Number(conf.thickness) : 15;

        // Position Handles in World Space relative to target group
        let targetGroup = this.target;
        while (targetGroup.parent && targetGroup.parent !== this.ctx.structureGroup && targetGroup.parent !== this.ctx.scene) {
            targetGroup = targetGroup.parent;
        }

        const worldPos = new THREE.Vector3();
        targetGroup.getWorldPosition(worldPos);
        const h = worldPos.y;

        this.curveHandles.forEach(hGroup => {
            const side = hGroup.userData?.side;
            if (side === 'left') {
                hGroup.position.set(worldPos.x + (minX - cx) + R, h + 2, worldPos.z);
            } else if (side === 'right') {
                hGroup.position.set(worldPos.x + (maxX - cx) - R, h + 2, worldPos.z);
            }
        });

        if (this.thicknessHandle) {
            this.thicknessHandle.position.set(worldPos.x, h + 2, worldPos.z);
        }

        if (this.cornerHandles && this.cornerHandles.length > 0) {
            this.cornerHandles.forEach(ch => {
                const cIdx = ch.userData?.cornerIndex ?? 0;
                const pt = entity.points[cIdx];
                if (pt) {
                    ch.position.set(worldPos.x + (pt.x - cx), h + 2, worldPos.z + (pt.y - cz));
                }
            });
        }

        this._updateHUDPosition();
    }

    dispose() {
        const dom = this.ctx.renderer?.domElement;
        if (dom && typeof dom.removeEventListener === 'function') {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (this.domBadge && this.domBadge.parentElement) {
            this.domBadge.parentElement.removeChild(this.domBadge);
        }
        if (this.domHUD && this.domHUD.parentElement) {
            this.domHUD.parentElement.removeChild(this.domHUD);
        }
        this.detach();
    }
}

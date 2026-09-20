import * as THREE from 'three';
import { WallEngine } from '../wall/WallEngine.js';
import { WallGeometryEngine } from '../wall/WallGeometryEngine.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';

/**
 * WallCornerFilletGizmo
 * 
 * Professional CAD-Standard 3D Interactive Corner Fillet Gizmo.
 * 
 * Features:
 * - Non-Destructive Ghost Drag: Computes and renders a 60 FPS translucent 3D ghost
 *   arc and dashed cut lines during dragging without rebuilding wall topology.
 * - Single-Frame Transaction Commit: WallEngine.filletCorner / unfilletCorner is committed
 *   strictly once upon pointer release (_endDrag) with full Undo/Redo integration.
 * - Floating Quick-Pill Toolbar: Sleek CAD pill docked directly above the corner apex
 *   with 1-click presets ([Sharp], [50cm], [80cm], [100cm], [120cm], custom input, and close).
 * - Automatic OrbitControls camera lock during drag.
 * - Zero auto-camera jumps or focus changes.
 */
export class WallCornerFilletGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'WallCornerFilletGizmo';
        this.visible = false;

        this.targetAnchor = null;
        this.cornerData = null;

        // Visual handles container
        this.handlesGroup = new THREE.Group();
        this.handlesGroup.name = 'WallCornerFillet_Handles';
        this.add(this.handlesGroup);

        // Non-destructive 3D ghost arc container
        this.ghostGroup = new THREE.Group();
        this.ghostGroup.name = 'WallCornerFillet_GhostGroup';
        this.ghostGroup.visible = false;
        this.add(this.ghostGroup);

        this.interactiveMeshes = [];
        this.hoveredMesh = null;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.isDragging = false;
        this.dragPlane = new THREE.Plane();
        this.dragApexPos = { x: 0, y: 0 };
        this.bisectorVec = { x: 0, y: 0 };
        this.sinHalfTheta = Math.SQRT1_2;
        this.factorK = 0.4142;
        this.maxSafeRadius = 200;
        this.candidateRadius = null;
        this._snapshotCmd = null;

        // Shared materials
        this.matCurved = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.matSharp = new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 0.95 });
        this.matHover = new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false, transparent: true, opacity: 1.0 });
        this.matRing = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });

        // Ghost Arc materials
        this.matGhostWall = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
            depthTest: false
        });
        this.matGhostLines = new THREE.LineBasicMaterial({
            color: 0x34d399,
            transparent: true,
            opacity: 0.9,
            depthTest: false
        });
        this.matGhostCutLines = new THREE.LineDashedMaterial({
            color: 0xf59e0b,
            dashSize: 4,
            gapSize: 3,
            transparent: true,
            opacity: 0.85,
            depthTest: false
        });

        // Initialize ghost arc meshes
        this.ghostWallMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.matGhostWall);
        this.ghostWallMesh.renderOrder = 1020;
        this.ghostWallMesh.raycast = () => {};
        this.ghostGroup.add(this.ghostWallMesh);

        this.ghostLinesMesh = new THREE.LineSegments(new THREE.BufferGeometry(), this.matGhostLines);
        this.ghostLinesMesh.renderOrder = 1021;
        this.ghostLinesMesh.raycast = () => {};
        this.ghostGroup.add(this.ghostLinesMesh);

        this.ghostCutLinesMesh = new THREE.LineSegments(new THREE.BufferGeometry(), this.matGhostCutLines);
        this.ghostCutLinesMesh.renderOrder = 1022;
        this.ghostCutLinesMesh.raycast = () => {};
        this.ghostGroup.add(this.ghostCutLinesMesh);

        this._createLiveBadge();
        this._createQuickPill();

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onCameraChange = this._onCameraChange.bind(this);

        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
            dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
            dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
        }

        if (this.ctx.controls) {
            this.ctx.controls.addEventListener('change', this._onCameraChange);
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this._onCameraChange);
        }
    }

    _createLiveBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'wall-corner-drag-badge';
        this.domBadge.style.cssText = `
            position: fixed;
            display: none;
            transform: translate(-50%, -100%);
            padding: 6px 14px;
            border-radius: 9999px;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 2px solid #10b981;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65), 0 0 16px rgba(16, 185, 129, 0.4);
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

    _updateBadgeText(text, borderColor, clientX, clientY) {
        if (!this.domBadge) return;
        this.domBadge.textContent = text;
        this.domBadge.style.display = 'block';
        this.domBadge.style.borderColor = borderColor;
        this.domBadge.style.boxShadow = `0 8px 24px rgba(0, 0, 0, 0.65), 0 0 16px ${borderColor}66`;
        if (clientX !== undefined && clientY !== undefined) {
            this.domBadge.style.left = `${clientX}px`;
            this.domBadge.style.top = `${clientY - 22}px`;
        }
    }

    _hideBadge() {
        if (this.domBadge) {
            this.domBadge.style.display = 'none';
        }
    }

    _createQuickPill() {
        if (typeof document === 'undefined') return;
        this.domQuickPill = document.createElement('div');
        this.domQuickPill.className = 'wall-corner-quick-pill';
        this.domQuickPill.style.cssText = `
            position: fixed;
            display: none;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1.5px solid rgba(255, 255, 255, 0.16);
            border-radius: 9999px;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.75), 0 0 20px rgba(16, 185, 129, 0.25);
            color: #f8fafc;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 600;
            z-index: 100005;
            user-select: none;
            transform: translate(-50%, -100%);
            pointer-events: auto;
        `;

        ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend', 'contextmenu'].forEach(evt => {
            this.domQuickPill.addEventListener(evt, e => e.stopPropagation());
        });

        document.body.appendChild(this.domQuickPill);
    }

    _updateQuickPill() {
        if (!this.domQuickPill || !this.visible || this.isDragging || !this.targetAnchor || !this.cornerData?.isCorner) {
            this._hideQuickPill();
            return;
        }

        const cd = this.cornerData;
        const isFilleted = !!cd.isFilleted;
        const curRadius = isFilleted ? Math.round(cd.radius || 80) : 0;
        const maxR = this.maxSafeRadius || 200;

        // Build candidate presets: 50, 80, 100, 120 clamped to maxR
        const standardPresets = [50, 80, 100, 120];
        const validPresets = standardPresets.filter(p => p <= maxR);
        if (validPresets.length === 0 && maxR >= 25) {
            validPresets.push(Math.round(maxR * 0.6));
        }

        let presetsHtml = validPresets.map(p => {
            const isActive = isFilleted && curRadius === p;
            const style = isActive
                ? 'background: rgba(16, 185, 129, 0.3); border-color: #10b981; color: #34d399; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);'
                : 'background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.15); color: #cbd5e1;';
            return `
                <button type="button" class="quick-pill-preset" data-radius="${p}" style="
                    padding: 4px 10px;
                    border-radius: 9999px;
                    border: 1px solid;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    outline: none;
                    ${style}
                ">${p} cm</button>
            `;
        }).join('');

        const sharpStyle = !isFilleted
            ? 'background: rgba(0, 240, 255, 0.25); border-color: #00f0ff; color: #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);'
            : 'background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.15); color: #cbd5e1;';

        this.domQuickPill.innerHTML = `
            <div style="display: flex; align-items: center; gap: 4px; font-weight: 800; color: ${isFilleted ? '#10b981' : '#00f0ff'}; margin-right: 2px;">
                <span style="font-size: 14px;">${isFilleted ? '╭' : '◰'}</span>
            </div>
            <button type="button" class="quick-pill-sharp" style="
                padding: 4px 10px;
                border-radius: 9999px;
                border: 1px solid;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.15s ease;
                outline: none;
                ${sharpStyle}
            ">◰ Sharp</button>
            ${presetsHtml}
            <div style="width: 1px; height: 16px; background: rgba(255, 255, 255, 0.2); margin: 0 2px;"></div>
            <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #94a3b8;">
                <span>R:</span>
                <input type="number" class="quick-pill-input" min="20" max="${maxR}" step="5" value="${curRadius || 80}" style="
                    width: 46px;
                    padding: 3px 5px;
                    border-radius: 6px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(0, 0, 0, 0.45);
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: 700;
                    text-align: center;
                    outline: none;
                " />
                <span>cm</span>
            </div>
            <button type="button" class="quick-pill-close" title="Close" style="
                background: transparent;
                border: none;
                color: #94a3b8;
                font-size: 13px;
                padding: 2px 6px;
                cursor: pointer;
                line-height: 1;
                margin-left: 2px;
                border-radius: 50%;
            ">✕</button>
        `;

        // Bind events to buttons
        const sharpBtn = this.domQuickPill.querySelector('.quick-pill-sharp');
        if (sharpBtn) {
            sharpBtn.onclick = (e) => {
                e.stopPropagation();
                this._applySharp();
            };
        }

        const presetBtns = this.domQuickPill.querySelectorAll('.quick-pill-preset');
        presetBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const r = Number(btn.getAttribute('data-radius'));
                if (r > 0) this._applyFillet(r);
            };
        });

        const input = this.domQuickPill.querySelector('.quick-pill-input');
        if (input) {
            input.onkeydown = (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    input.blur();
                }
            };
            input.onchange = (e) => {
                e.stopPropagation();
                const val = Math.max(20, Math.min(maxR, Number(input.value) || 80));
                this._applyFillet(val);
            };
        }

        const closeBtn = this.domQuickPill.querySelector('.quick-pill-close');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.detach();
            };
        }

        this._updateQuickPillPosition();
    }

    _updateQuickPillPosition() {
        if (!this.domQuickPill || !this.visible || this.isDragging || !this.targetAnchor || !this.cornerData?.isCorner) {
            if (this.domQuickPill) this.domQuickPill.style.display = 'none';
            return;
        }

        const pC = this.dragApexPos;
        const cd = this.cornerData;
        const walls = cd.walls || [];
        const wallElev = walls.length > 0 ? Math.min(...walls.map(w => w.elevation || 0)) : 0;
        const wallH = walls.length > 0 ? Math.max(...walls.map(w => w.height !== undefined ? w.height : (w.config?.height || 120))) : 120;

        const worldPos = new THREE.Vector3(pC.x, wallElev + wallH + 16, pC.y);

        // Check if worldPos is in front of the camera plane
        if (this.ctx.camera) {
            const camDir = new THREE.Vector3();
            this.ctx.camera.getWorldDirection(camDir);
            const toPt = new THREE.Vector3().subVectors(worldPos, this.ctx.camera.position);
            if (camDir.dot(toPt) <= 0) {
                this.domQuickPill.style.display = 'none';
                return;
            }
        }

        const screenPos = worldPos.clone().project(this.ctx.camera);

        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();

        const screenX = (screenPos.x * 0.5 + 0.5) * rect.width + rect.left;
        const screenY = (-screenPos.y * 0.5 + 0.5) * rect.height + rect.top;

        const clampedX = Math.max(160, Math.min(window.innerWidth - 160, screenX));
        const clampedY = Math.max(70, Math.min(window.innerHeight - 50, screenY));

        this.domQuickPill.style.left = `${Math.round(clampedX)}px`;
        this.domQuickPill.style.top = `${Math.round(clampedY)}px`;
        this.domQuickPill.style.display = 'flex';
    }

    _hideQuickPill() {
        if (this.domQuickPill) {
            this.domQuickPill.style.display = 'none';
        }
    }

    _sync3DScene(wallsToRebuild = [], newArcWalls = [], wallsToRemove = []) {
        // 1. Remove obsolete 3D meshes from structureGroup & interactables
        wallsToRemove.forEach(w => {
            if (!w) return;
            if (w.mesh3D) {
                if (w.mesh3D.parent) w.mesh3D.parent.remove(w.mesh3D);
                else if (this.ctx.structureGroup) this.ctx.structureGroup.remove(w.mesh3D);
                w.mesh3D.traverse?.(c => { if (c.geometry) c.geometry.dispose(); });
                w.mesh3D = null;
            }
            if (this.ctx.interactables) {
                this.ctx.interactables = this.ctx.interactables.filter(m => m.userData?.entity !== w);
            }
        });

        // 2. Rebuild affected base walls in-place
        if (this.ctx.envBuilder?.buildWallGroup) {
            wallsToRebuild.forEach(w => {
                if (w && !w.hidden) {
                    this.ctx.envBuilder.buildWallGroup(w);
                }
            });

            // 3. Build new arc segment walls in-place
            newArcWalls.forEach(w => {
                if (w && !w.hidden) {
                    this.ctx.envBuilder.buildWallGroup(w);
                }
            });
        }

        // 4. Update room floors in-place
        if (typeof this.ctx.updateFloorsLive === 'function') {
            this.ctx.updateFloorsLive();
        } else if (typeof this.ctx.rebuildActiveFloors === 'function') {
            this.ctx.rebuildActiveFloors();
        }
    }

    _applySharp() {
        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        if (!planner || !this.targetAnchor) return;

        const cd = WallEngine.getCornerData(planner, this.targetAnchor);
        const filletData = this.targetAnchor.filletData || cd?.filletData;
        const oldArc = filletData?.arc;
        const oldWalls = oldArc?.walls ? [...oldArc.walls] : [];
        const w1 = filletData?.w1 || cd?.walls?.[0];
        const w2 = filletData?.w2 || cd?.walls?.[1];

        const cmd = (planner.commandManager && typeof planner.exportState === 'function') ? new SnapshotCommand(planner) : null;
        WallEngine.unfilletCorner(planner, this.targetAnchor);
        if (cmd && planner.commandManager) planner.commandManager.execute(cmd);

        if (planner.syncAll) planner.syncAll();
        if (planner.findRooms) planner.findRooms();

        this._sync3DScene([w1, w2], [], oldWalls);

        this.updateHandles();
        this._updateQuickPill();
        if (this.ctx.allWallCornersGizmo?.isActive) {
            this.ctx.allWallCornersGizmo.rebuild();
        }
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    _applyFillet(radius) {
        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        if (!planner || !this.targetAnchor) return;

        const cdBefore = WallEngine.getCornerData(planner, this.targetAnchor);
        const prevArc = cdBefore?.filletData?.arc || this.targetAnchor.filletData?.arc;
        const prevWalls = prevArc?.walls ? [...prevArc.walls] : [];

        const cmd = (planner.commandManager && typeof planner.exportState === 'function') ? new SnapshotCommand(planner) : null;
        const res = WallEngine.filletCorner(planner, this.targetAnchor, radius);
        if (cmd && planner.commandManager) planner.commandManager.execute(cmd);

        if (res && res.anchor) {
            this.targetAnchor = res.anchor;
        }

        if (planner.syncAll) planner.syncAll();
        if (planner.findRooms) planner.findRooms();

        const cdAfter = WallEngine.getCornerData(planner, this.targetAnchor);
        const w1 = res?.w1 || cdAfter?.walls?.[0];
        const w2 = res?.w2 || cdAfter?.walls?.[1];
        const newArc = res?.arc || cdAfter?.filletData?.arc;

        this._sync3DScene([w1, w2], newArc?.walls || [], prevWalls);

        this.updateHandles();
        this._updateQuickPill();
        if (this.ctx.allWallCornersGizmo?.isActive) {
            this.ctx.allWallCornersGizmo.rebuild();
        }
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    _onCameraChange() {
        if (this.visible && !this.isDragging) {
            this._updateQuickPillPosition();
        }
    }

    attach(anchor) {
        if (!anchor) {
            this.detach();
            return;
        }

        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        if (planner) {
            const cd = WallEngine.getCornerData(planner, anchor);
            if (cd && cd.isCorner) {
                this.targetAnchor = cd.anchor || anchor;
                this.cornerData = cd;
            } else {
                this.targetAnchor = anchor;
            }
        } else {
            this.targetAnchor = anchor;
        }

        this.updateHandles();
        this.visible = !!(this.cornerData && this.cornerData.isCorner);

        if (this.visible) {
            this._updateQuickPill();
        } else {
            this._hideQuickPill();
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    detach() {
        if (this.isDragging) {
            this._endDrag();
        }
        this.targetAnchor = null;
        this.cornerData = null;
        this.clearHandles();
        this.ghostGroup.visible = false;
        this.visible = false;
        this._hideBadge();
        this._hideQuickPill();
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    clearHandles() {
        while (this.handlesGroup.children.length > 0) {
            const child = this.handlesGroup.children[0];
            this.handlesGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
        }
        this.interactiveMeshes = [];
        this.hoveredMesh = null;
        this.activeHandleGroup = null;
    }

    updateHandles() {
        this.clearHandles();
        if (!this.targetAnchor) return;

        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        if (!planner) return;

        const cd = WallEngine.getCornerData(planner, this.targetAnchor);
        if (!cd || !cd.isCorner) {
            this.cornerData = null;
            this._hideQuickPill();
            return;
        }
        this.cornerData = cd;
        if (cd.anchor) this.targetAnchor = cd.anchor;

        const walls = cd.walls || [];
        if (walls.length < 2) return;

        const [w1, w2] = walls;
        const pC = cd.filletData?.apexPos || this.targetAnchor.filletData?.apexPos || WallGeometryEngine.getAnchorPosition(this.targetAnchor);
        this.dragApexPos = { x: pC.x, y: pC.y };

        const other1 = cd.filletData?.origEndpoint1 === 'start' ? w1.endAnchor : (w1.startAnchor === this.targetAnchor ? w1.endAnchor : w1.startAnchor);
        const other2 = cd.filletData?.origEndpoint2 === 'start' ? w2.endAnchor : (w2.startAnchor === this.targetAnchor ? w2.endAnchor : w2.startAnchor);
        const p1 = WallGeometryEngine.getAnchorPosition(other1);
        const p2 = WallGeometryEngine.getAnchorPosition(other2);

        const v1 = { x: p1.x - pC.x, y: p1.y - pC.y };
        const v2 = { x: p2.x - pC.x, y: p2.y - pC.y };
        const l1 = Math.hypot(v1.x, v1.y);
        const l2 = Math.hypot(v2.x, v2.y);
        if (l1 < 1 || l2 < 1) return;

        const u1 = { x: v1.x / l1, y: v1.y / l1 };
        const u2 = { x: v2.x / l2, y: v2.y / l2 };
        this.u1 = u1;
        this.u2 = u2;
        this.l1 = l1;
        this.l2 = l2;

        const dot = Math.max(-0.9999, Math.min(0.9999, u1.x * u2.x + u1.y * u2.y));
        const theta = Math.acos(dot);
        this.theta = theta;
        const sinHalf = Math.max(0.05, Math.sin(theta / 2));
        this.sinHalfTheta = sinHalf;
        this.factorK = Math.max(0.05, (1 / sinHalf) - 1);
        this.maxSafeRadius = cd.maxRadius || 200;

        const bx = u1.x + u2.x;
        const by = u1.y + u2.y;
        const bLen = Math.hypot(bx, by);
        if (bLen < 0.001) return;

        const b = { x: bx / bLen, y: by / bLen };
        this.bisectorVec = b;

        const wallElev = Math.min(...walls.map(w => w.elevation || 0));
        const wallH = Math.max(...walls.map(w => w.height !== undefined ? w.height : (w.config?.height || 120)));
        this.wallElev = wallElev;
        this.wallH = wallH;
        this.wallThickness = walls[0]?.thickness || 20;

        const isFilleted = cd.isFilleted;
        const curRadius = isFilleted ? (cd.radius || 80) : 0;
        const currentDist = curRadius > 0 ? (curRadius * this.factorK) : 18;

        const pMid = {
            x: pC.x + currentDist * b.x,
            y: pC.y + currentDist * b.y
        };

        // 1. Inward Track Laser Line
        const maxDist = this.maxSafeRadius * this.factorK;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(pC.x, wallElev + wallH / 2, pC.y),
            new THREE.Vector3(pC.x + maxDist * b.x, wallElev + wallH / 2, pC.y + maxDist * b.y)
        ]);
        const lineMat = new THREE.LineDashedMaterial({
            color: isFilleted ? 0x10b981 : 0x00f0ff,
            dashSize: 6,
            gapSize: 4,
            transparent: true,
            opacity: 0.7,
            depthTest: false
        });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        lineMesh.computeLineDistances();
        lineMesh.renderOrder = 1004;
        lineMesh.raycast = () => {};
        this.handlesGroup.add(lineMesh);

        // 2. Interactive Curvature Drag Handle
        this._createFilletHandle(pMid.x, wallElev + wallH / 2, pMid.y, isFilleted, curRadius);

        // 3. Refresh docked Quick-Pill
        this._updateQuickPill();
    }

    _createFilletHandle(x, y, z, isFilleted, radius) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.name = 'CornerFilletHandleGroup';
        group.renderOrder = 1010;

        // Generous invisible hit collider for effortless grabbing
        const hitGeo = new THREE.SphereGeometry(18, 12, 12);
        const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.userData = { isCornerFilletHandle: true, isFilleted, radius };
        group.add(hitMesh);
        this.interactiveMeshes.push(hitMesh);

        // Outer Radiant Torus Ring
        const ringGeo = new THREE.TorusGeometry(8.5, 2.0, 12, 24);
        ringGeo.rotateX(Math.PI / 2);
        const ringMat = isFilleted ? this.matCurved : this.matSharp;
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.renderOrder = 1011;
        ringMesh.raycast = () => {};
        group.add(ringMesh);
        hitMesh.userData.visualRing = ringMesh;

        // Inner White Accent Disc
        const discGeo = new THREE.CylinderGeometry(5.0, 5.0, 2.0, 16);
        const discMesh = new THREE.Mesh(discGeo, this.matRing);
        discMesh.renderOrder = 1012;
        discMesh.raycast = () => {};
        group.add(discMesh);

        // Center Indicator Symbol (Octahedron diamond)
        const coreGeo = new THREE.OctahedronGeometry(3.5);
        const coreMat = isFilleted ? this.matCurved : this.matSharp;
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        coreMesh.renderOrder = 1013;
        coreMesh.raycast = () => {};
        group.add(coreMesh);
        hitMesh.userData.visualCore = coreMesh;

        this.handlesGroup.add(group);
        this.activeHandleGroup = group;
    }

    /**
     * Rebuilds the 3D Ghost Arc preview in place at 60 FPS.
     * Generates a watertight curved wall segment ribbon, glowing contour lines,
     * and corner cut indicators without touching planner topology.
     */
    _updateGhostArc(radius) {
        if (!radius || radius <= 0 || !this.u1 || !this.u2) {
            this.ghostGroup.visible = false;
            return;
        }

        const pC = this.dragApexPos;
        const u1 = this.u1;
        const u2 = this.u2;
        const b = this.bisectorVec;
        const theta = this.theta;
        const sinHalf = this.sinHalfTheta;
        const wallW = this.wallThickness || 20;
        const wallElev = this.wallElev || 0;
        const wallH = this.wallH || 120;
        const yBot = wallElev;
        const yTop = wallElev + wallH;

        // Tangent setback: T = R * tan(deltaPhi / 2)
        const deltaPhi = Math.PI - theta;
        const tanHalfDelta = Math.tan(deltaPhi / 2);
        let T = radius * tanHalfDelta;
        const maxT = Math.min(this.l1, this.l2) * 0.85;
        if (T > maxT) {
            T = maxT;
            radius = T / tanHalfDelta;
        }

        // Tangent points on both walls
        const pT1 = { x: pC.x + T * u1.x, y: pC.y + T * u1.y };
        const pT2 = { x: pC.x + T * u2.x, y: pC.y + T * u2.y };

        // Circle center & arc midpoint
        const D_O = radius / Math.max(0.01, sinHalf);
        const O = { x: pC.x + D_O * b.x, y: pC.y + D_O * b.y };
        const pMid = { x: pC.x + (D_O - radius) * b.x, y: pC.y + (D_O - radius) * b.y };

        // Sample circular arc
        const v1 = { x: pT1.x - O.x, y: pT1.y - O.y };
        const v2 = { x: pT2.x - O.x, y: pT2.y - O.y };
        const vMid = { x: pMid.x - O.x, y: pMid.y - O.y };

        const a1 = Math.atan2(v1.y, v1.x);
        const a2 = Math.atan2(v2.y, v2.x);
        const aMid = Math.atan2(vMid.y, vMid.x);

        let d1 = aMid - a1;
        while (d1 <= -Math.PI) d1 += 2 * Math.PI;
        while (d1 > Math.PI) d1 -= 2 * Math.PI;

        let d2 = a2 - aMid;
        while (d2 <= -Math.PI) d2 += 2 * Math.PI;
        while (d2 > Math.PI) d2 -= 2 * Math.PI;

        const totalSweep = d1 + d2;
        const N = 24;

        const positions = [];
        const indices = [];
        const linePositions = [];

        const rOut = radius + wallW / 2;
        const rIn = Math.max(1, radius - wallW / 2);

        // Generate vertex columns along arc
        // For each segment i: v0(out, top), v1(in, top), v2(out, bot), v3(in, bot)
        for (let i = 0; i <= N; i++) {
            const t = i / N;
            const ang = a1 + t * totalSweep;
            const cosA = Math.cos(ang);
            const sinA = Math.sin(ang);

            const xOut = O.x + rOut * cosA;
            const zOut = O.y + rOut * sinA;
            const xIn = O.x + rIn * cosA;
            const zIn = O.y + rIn * sinA;

            // v0: Out Top
            positions.push(xOut, yTop, zOut);
            // v1: In Top
            positions.push(xIn, yTop, zIn);
            // v2: Out Bot
            positions.push(xOut, yBot, zOut);
            // v3: In Bot
            positions.push(xIn, yBot, zIn);

            if (i > 0) {
                const prev = (i - 1) * 4;
                const curr = i * 4;

                // 1. Top Face Quad
                indices.push(prev + 0, curr + 0, curr + 1);
                indices.push(prev + 0, curr + 1, prev + 1);

                // 2. Bottom Face Quad
                indices.push(prev + 3, curr + 3, curr + 2);
                indices.push(prev + 3, curr + 2, prev + 2);

                // 3. Outer Wall Face Quad
                indices.push(prev + 2, curr + 2, curr + 0);
                indices.push(prev + 2, curr + 0, prev + 0);

                // 4. Inner Wall Face Quad
                indices.push(prev + 1, curr + 1, curr + 3);
                indices.push(prev + 1, curr + 3, prev + 3);

                // Line contours (Top and Bot)
                linePositions.push(positions[(prev + 0) * 3], positions[(prev + 0) * 3 + 1], positions[(prev + 0) * 3 + 2]);
                linePositions.push(positions[(curr + 0) * 3], positions[(curr + 0) * 3 + 1], positions[(curr + 0) * 3 + 2]);

                linePositions.push(positions[(prev + 1) * 3], positions[(prev + 1) * 3 + 1], positions[(prev + 1) * 3 + 2]);
                linePositions.push(positions[(curr + 1) * 3], positions[(curr + 1) * 3 + 1], positions[(curr + 1) * 3 + 2]);

                linePositions.push(positions[(prev + 2) * 3], positions[(prev + 2) * 3 + 1], positions[(prev + 2) * 3 + 2]);
                linePositions.push(positions[(curr + 2) * 3], positions[(curr + 2) * 3 + 1], positions[(curr + 2) * 3 + 2]);

                linePositions.push(positions[(prev + 3) * 3], positions[(prev + 3) * 3 + 1], positions[(prev + 3) * 3 + 2]);
                linePositions.push(positions[(curr + 3) * 3], positions[(curr + 3) * 3 + 1], positions[(curr + 3) * 3 + 2]);
            }
        }

        // Start cap quad (i = 0)
        indices.push(0, 1, 3);
        indices.push(0, 3, 2);
        // End cap quad (i = N)
        const last = N * 4;
        indices.push(last + 1, last + 0, last + 2);
        indices.push(last + 1, last + 2, last + 3);

        // Cap contour lines
        linePositions.push(positions[0], positions[1], positions[2], positions[3], positions[4], positions[5]);
        linePositions.push(positions[6], positions[7], positions[8], positions[9], positions[10], positions[11]);
        linePositions.push(positions[0], positions[1], positions[2], positions[6], positions[7], positions[8]);
        linePositions.push(positions[3], positions[4], positions[5], positions[9], positions[10], positions[11]);

        linePositions.push(positions[last * 3], positions[last * 3 + 1], positions[last * 3 + 2], positions[(last + 1) * 3], positions[(last + 1) * 3 + 1], positions[(last + 1) * 3 + 2]);
        linePositions.push(positions[(last + 2) * 3], positions[(last + 2) * 3 + 1], positions[(last + 2) * 3 + 2], positions[(last + 3) * 3], positions[(last + 3) * 3 + 1], positions[(last + 3) * 3 + 2]);
        linePositions.push(positions[last * 3], positions[last * 3 + 1], positions[last * 3 + 2], positions[(last + 2) * 3], positions[(last + 2) * 3 + 1], positions[(last + 2) * 3 + 2]);
        linePositions.push(positions[(last + 1) * 3], positions[(last + 1) * 3 + 1], positions[(last + 1) * 3 + 2], positions[(last + 3) * 3], positions[(last + 3) * 3 + 1], positions[(last + 3) * 3 + 2]);

        // Cut indicator lines (from apex to tangent points at wall top)
        const cutPositions = [
            pC.x, yTop, pC.y, pT1.x, yTop, pT1.y,
            pC.x, yTop, pC.y, pT2.x, yTop, pT2.y
        ];

        // Update Wall Mesh
        const wallGeo = new THREE.BufferGeometry();
        wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        wallGeo.setIndex(indices);
        wallGeo.computeVertexNormals();
        if (this.ghostWallMesh.geometry) this.ghostWallMesh.geometry.dispose();
        this.ghostWallMesh.geometry = wallGeo;

        // Update Line Mesh
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        if (this.ghostLinesMesh.geometry) this.ghostLinesMesh.geometry.dispose();
        this.ghostLinesMesh.geometry = lineGeo;

        // Update Cut Line Mesh
        const cutGeo = new THREE.BufferGeometry();
        cutGeo.setAttribute('position', new THREE.Float32BufferAttribute(cutPositions, 3));
        if (this.ghostCutLinesMesh.geometry) this.ghostCutLinesMesh.geometry.dispose();
        this.ghostCutLinesMesh.geometry = cutGeo;
        this.ghostCutLinesMesh.computeLineDistances();

        this.ghostGroup.visible = true;
    }

    _onPointerMove(e) {
        if (!this.visible) return;

        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (this.isDragging) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const currentPoint = new THREE.Vector3();

            if (this.raycaster.ray.intersectPlane(this.dragPlane, currentPoint)) {
                const pC = this.dragApexPos;
                const b = this.bisectorVec;

                // Displacement along inward bisector vector
                const distAlongB = (currentPoint.x - pC.x) * b.x + (currentPoint.z - pC.y) * b.y;

                // Push outward snap threshold to sharp (d <= 12cm)
                if (distAlongB <= 12) {
                    this.candidateRadius = 0;
                    this.ghostGroup.visible = false;
                    this._updateBadgeText('◰ Snap to Sharp (90°)', '#00f0ff', e.clientX, e.clientY);

                    if (this.activeHandleGroup) {
                        this.activeHandleGroup.position.x = pC.x + 14 * b.x;
                        this.activeHandleGroup.position.z = pC.y + 14 * b.y;
                        if (this.activeHandleGroup.userData?.visualRing) {
                            this.activeHandleGroup.userData.visualRing.material = this.matSharp;
                        }
                    }
                } else {
                    // Compute prospective radius from physical bulge distance
                    const rawRadius = distAlongB / this.factorK;
                    const stepR = Math.max(20, Math.min(this.maxSafeRadius, Math.round(rawRadius / 5) * 5));
                    this.candidateRadius = stepR;

                    this._updateBadgeText(`╭ Radius: ${stepR} cm`, '#10b981', e.clientX, e.clientY);

                    if (this.activeHandleGroup) {
                        const actualDist = stepR * this.factorK;
                        this.activeHandleGroup.position.x = pC.x + actualDist * b.x;
                        this.activeHandleGroup.position.z = pC.y + actualDist * b.y;
                        if (this.activeHandleGroup.userData?.visualRing) {
                            this.activeHandleGroup.userData.visualRing.material = this.matCurved;
                        }
                    }

                    // Render smooth 60 FPS non-destructive ghost arc
                    this._updateGhostArc(stepR);
                }

                if (this.ctx.requestRender) this.ctx.requestRender();
            }
            return;
        }

        // Hover handling
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const intersects = this.raycaster.intersectObjects(this.interactiveMeshes, false);

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            if (this.hoveredMesh !== hit) {
                if (this.hoveredMesh && this.hoveredMesh.userData?.visualRing) {
                    this.hoveredMesh.userData.visualRing.material = this.hoveredMesh.userData.isFilleted ? this.matCurved : this.matSharp;
                    this.hoveredMesh.scale.set(1, 1, 1);
                }
                this.hoveredMesh = hit;
                if (hit.userData?.visualRing) {
                    hit.userData.visualRing.material = this.matHover;
                    hit.scale.set(1.25, 1.25, 1.25);
                }
                dom.style.cursor = 'grab';
                const rVal = hit.userData?.isFilleted ? `╭ Drag to adjust (${Math.round(hit.userData.radius)}cm)` : '╭ Drag inward to curve';
                this._updateBadgeText(rVal, '#facc15', e.clientX, e.clientY);
                if (this.ctx.requestRender) this.ctx.requestRender();
            }
        } else if (this.hoveredMesh) {
            if (this.hoveredMesh.userData?.visualRing) {
                this.hoveredMesh.userData.visualRing.material = this.hoveredMesh.userData.isFilleted ? this.matCurved : this.matSharp;
                this.hoveredMesh.scale.set(1, 1, 1);
            }
            this.hoveredMesh = null;
            dom.style.cursor = '';
            this._hideBadge();
            if (this.ctx.requestRender) this.ctx.requestRender();
        }
    }

    _onPointerDown(e) {
        if (!this.visible || e.button !== 0) return;

        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const intersects = this.raycaster.intersectObjects(this.interactiveMeshes, false);

        if (intersects.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            const hit = intersects[0];
            this.isDragging = true;

            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
            if (planner && planner.commandManager && typeof planner.exportState === 'function') {
                this._snapshotCmd = new SnapshotCommand(planner);
            }

            // CRITICAL: Freeze camera during direct drag
            if (this.ctx.controls) {
                this.ctx.controls.enabled = false;
            }

            const hitY = hit.point.y;
            this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, hitY, 0));

            // Hide quick pill during direct dragging
            this._hideQuickPill();

            dom.style.cursor = 'grabbing';
            this._updateBadgeText(hit.object.userData?.isFilleted ? `╭ Radius: ${hit.object.userData.radius} cm` : '╭ Drag inward to curve', '#10b981', e.clientX, e.clientY);

            window.addEventListener('pointerup', this._onPointerUp, { once: true });
        }
    }

    _onPointerUp(e) {
        if (!this.isDragging) return;
        this._endDrag();
    }

    _endDrag() {
        this.isDragging = false;
        window.removeEventListener('pointerup', this._onPointerUp);

        // Re-enable camera controls
        if (this.ctx.controls) {
            this.ctx.controls.enabled = true;
        }

        const dom = this.ctx.renderer?.domElement;
        if (dom) dom.style.cursor = '';
        this._hideBadge();
        this.ghostGroup.visible = false;

        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        if (planner && this.targetAnchor && this.candidateRadius !== null) {
            const cdBefore = WallEngine.getCornerData(planner, this.targetAnchor);
            const prevArc = cdBefore?.filletData?.arc || this.targetAnchor.filletData?.arc;
            const prevWalls = prevArc?.walls ? [...prevArc.walls] : [];
            let w1 = cdBefore?.walls?.[0];
            let w2 = cdBefore?.walls?.[1];
            let newArcWalls = [];

            if (this.candidateRadius === 0) {
                WallEngine.unfilletCorner(planner, this.targetAnchor);
            } else {
                const res = WallEngine.filletCorner(planner, this.targetAnchor, this.candidateRadius);
                if (res && res.anchor) {
                    this.targetAnchor = res.anchor;
                }
                w1 = res?.w1 || w1;
                w2 = res?.w2 || w2;
                newArcWalls = res?.arc?.walls || [];
            }

            if (this._snapshotCmd && planner.commandManager) {
                planner.commandManager.execute(this._snapshotCmd);
                this._snapshotCmd = null;
            }

            if (planner.syncAll) planner.syncAll();
            if (planner.findRooms) planner.findRooms();

            this._sync3DScene([w1, w2], newArcWalls, prevWalls);
        }

        this.candidateRadius = null;

        // Rebuild handles and quick-pill to sync with committed state
        this.updateHandles();
        this._updateQuickPill();
        if (this.ctx.allWallCornersGizmo?.isActive) {
            this.ctx.allWallCornersGizmo.rebuild();
        }
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    destroy() {
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (this.ctx.controls) {
            this.ctx.controls.removeEventListener('change', this._onCameraChange);
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._onCameraChange);
        }
        if (this.domBadge && this.domBadge.parentNode) {
            this.domBadge.parentNode.removeChild(this.domBadge);
        }
        if (this.domQuickPill && this.domQuickPill.parentNode) {
            this.domQuickPill.parentNode.removeChild(this.domQuickPill);
        }
        this.clearHandles();
    }
}

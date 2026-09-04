import * as THREE from 'three';
import { EVENTS } from '../constants/events.js';
import { coreEventBus } from '../EventBus.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { WallReformer } from '../engine2d/WallReformer.js';
import { advance_openings } from '../engine2d/advance_openings.js';
import { WallEngine } from '../wall/WallEngine.js';

/**
 * WallPushPullGizmo
 * 
 * Provides interactive Sims 4-style 3D push/pull handles directly on wall surfaces.
 * 
 * 3-Step Elevation Workflow:
 * 1. User selects specific area on wall face (Horizontal Left/Right & Vertical Top/Bottom handles + Glowing 2D Selection Box).
 * 2. User pulls outward freely to extrude a 100% solid wall block. Once increased, the Push arrow appears on the front face to adjust/push back.
 * 3. User clicks Done (✓) to bake or Cancel (✕) to discard.
 */
export class WallPushPullGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.target = null;
        this.visible = false;
        
        this.isDragging = false;
        this.activeHandle = null;
        this.activeFacing = 1;
        this.currentDragDist = 0;
        this.currentExtrudeDepth = 0;
        this.initialExtrudeDepth = 0;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dragPlane = new THREE.Plane();
        this.dragStartPoint = new THREE.Vector3();
        this.wallNormal2D = { x: 0, y: 1 };
        
        this.initialStart = { x: 0, y: 0 };
        this.initialEnd = { x: 0, y: 0 };
        this.initialThickness = 20;
        this._snapshotCmd = null;
        this._capturedPointerId = null;

        // Push/Pull Sub-Mode: 'thickness' (Face Push/Pull) vs 'baseline' (Move Room Baseline)
        this.mode = 'thickness';
        
        // Selected Region Bounds: Horizontal (tStart to tEnd: 0.0 to 1.0) and Vertical (elevBottom to elevTop: cm)
        this.tStart = 0.0;
        this.tEnd = 1.0;
        this.initialStartT = 0.0;
        this.initialEndT = 1.0;

        this.elevBottom = 0;
        this.elevTop = 120;
        this.initialElevBottom = 0;
        this.initialElevTop = 120;

        this.handles = new THREE.Group();
        this.handles.name = 'WallPushPull_Handles';
        this.add(this.handles);
        
        // Materials (Sims 4 Radiant Emerald, Cyan Neon & Gold Styling)
        this.matFront = new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 0.95 });
        this.matBack = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false, transparent: true, opacity: 0.95 });
        this.matGold = new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false, transparent: true, opacity: 0.95 });
        this.matHover = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 1.0 });
        this.matActive = new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false, transparent: true, opacity: 1.0 });
        
        // 1. Build Front and Back center arrow handles
        this.handleFront = this._buildSims4Handle('front', 0x00f0ff);
        this.handleBack = this._buildSims4Handle('back', 0x38bdf8);

        // 2. Build Width Boundary Handles (Left & Right - Vertical Cyan Laser Lines)
        this.startWidthHandle = this._buildBoundaryHandle('start', 0x00f0ff);
        this.endWidthHandle = this._buildBoundaryHandle('end', 0x00f0ff);

        // 3. Build Height & Elevation Boundary Handles (Bottom & Top - Horizontal Gold Laser Lines)
        this.bottomHeightHandle = this._buildHorizontalBoundaryHandle('bottom', 0xfacc15);
        this.topHeightHandle = this._buildHorizontalBoundaryHandle('top', 0xfacc15);

        // 4. Build 2D Selection Box on Wall Face
        this._buildSelectionRects();

        // 5. Build Real-time Solid Block Ghost Preview
        this._buildSolidBlockPreview();
        
        this.handles.add(this.handleFront);
        this.handles.add(this.handleBack);
        this.handles.add(this.startWidthHandle);
        this.handles.add(this.endWidthHandle);
        this.handles.add(this.bottomHeightHandle);
        this.handles.add(this.topHeightHandle);
        this.add(this.selectionRectGroup);
        this.add(this.solidBlockPreview);

        this._createConfirmHUDBar();
        
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        
        const dom = this.ctx.renderer.domElement;
        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
        dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
        window.addEventListener('keydown', this._onKeyDown);
    }

    _buildSelectionRects() {
        this.selectionRectGroup = new THREE.Group();
        this.selectionRectGroup.name = 'WallPushPull_SelectionRects';
        this.selectionRectGroup.visible = false;

        const baseGeo = new THREE.PlaneGeometry(1, 1);
        const edgesGeo = new THREE.EdgesGeometry(baseGeo);

        // Front Face Selection Box
        const matFillFront = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.18,
            depthTest: false,
            side: THREE.DoubleSide
        });
        const matEdgeFront = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.9
        });

        this.selectionPlaneFront = new THREE.Mesh(baseGeo, matFillFront);
        this.selectionOutlineFront = new THREE.LineSegments(edgesGeo, matEdgeFront);
        this.selectionPlaneFront.raycast = () => {};
        this.selectionOutlineFront.raycast = () => {};

        // Back Face Selection Box
        const matFillBack = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.18,
            depthTest: false,
            side: THREE.DoubleSide
        });
        const matEdgeBack = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.9
        });

        this.selectionPlaneBack = new THREE.Mesh(baseGeo, matFillBack);
        this.selectionOutlineBack = new THREE.LineSegments(edgesGeo, matEdgeBack);
        this.selectionPlaneBack.raycast = () => {};
        this.selectionOutlineBack.raycast = () => {};

        this.selectionRectGroup.add(this.selectionPlaneFront);
        this.selectionRectGroup.add(this.selectionOutlineFront);
        this.selectionRectGroup.add(this.selectionPlaneBack);
        this.selectionRectGroup.add(this.selectionOutlineBack);
    }

    _buildSolidBlockPreview() {
        this.solidBlockPreview = new THREE.Group();
        this.solidBlockPreview.name = 'WallPushPull_SolidBlockPreview';
        this.solidBlockPreview.visible = false;

        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.85,
            metalness: 0.05,
            transparent: true,
            opacity: 0.92
        });

        this.previewMesh = new THREE.Mesh(boxGeo, boxMat);
        this.previewMesh.castShadow = true;
        this.previewMesh.receiveShadow = true;
        this.previewMesh.raycast = () => {};

        this.previewEdgesMat = new THREE.LineBasicMaterial({
            color: 0x22c55e,
            linewidth: 2.5,
            depthTest: false
        });
        this.previewEdges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), this.previewEdgesMat);
        this.previewEdges.raycast = () => {};

        this.solidBlockPreview.add(this.previewMesh);
        this.solidBlockPreview.add(this.previewEdges);
    }

    _buildBoundaryHandle(side, color = 0x00f0ff) {
        const group = new THREE.Group();
        const partName = side === 'start' ? 'boundary_start' : 'boundary_end';
        group.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName };
        group.renderOrder = 1010;

        const hitBox = new THREE.Mesh(
            new THREE.BoxGeometry(28, 140, 24),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        hitBox.name = 'laserHitBox';
        hitBox.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName };
        group.add(hitBox);

        // 1. Vertical glowing laser cutting line
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -70, 0),
            new THREE.Vector3(0, 70, 0)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 3, depthTest: false, transparent: true, opacity: 0.95 });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        lineMesh.name = 'laserLine';
        lineMesh.renderOrder = 1009;
        group.add(lineMesh);

        // 2. Boundary central pill grip
        const discGeo = new THREE.CylinderGeometry(10, 10, 5, 20);
        discGeo.rotateX(Math.PI / 2);
        const discMesh = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: color, depthTest: false, transparent: true, opacity: 0.95 }));
        discMesh.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName };
        discMesh.renderOrder = 1010;
        group.add(discMesh);

        // 3. Accent ring
        const ringGeo = new THREE.TorusGeometry(6.5, 1.5, 12, 20);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        ringMesh.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName, isRing: true };
        ringMesh.renderOrder = 1011;
        group.add(ringMesh);

        // 4. Direction arrow cone along wall length
        const coneGeo = new THREE.ConeGeometry(7, 16, 16);
        coneGeo.rotateZ(side === 'start' ? -Math.PI / 2 : Math.PI / 2);
        const coneMesh = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false }));
        coneMesh.position.set(side === 'start' ? -10 : 10, 0, 0);
        coneMesh.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName };
        coneMesh.renderOrder = 1010;
        group.add(coneMesh);

        return group;
    }

    _buildHorizontalBoundaryHandle(side, color = 0xfacc15) {
        const group = new THREE.Group();
        const partName = side === 'bottom' ? 'boundary_bottom' : 'boundary_top';
        group.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName };
        group.renderOrder = 1010;

        const hitBox = new THREE.Mesh(
            new THREE.BoxGeometry(140, 28, 24),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        hitBox.name = 'laserHitBox';
        hitBox.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName };
        group.add(hitBox);

        // 1. Horizontal glowing laser cutting line
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-70, 0, 0),
            new THREE.Vector3(70, 0, 0)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: color, linewidth: 3, depthTest: false, transparent: true, opacity: 0.95 });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        lineMesh.name = 'laserLine';
        lineMesh.renderOrder = 1009;
        group.add(lineMesh);

        // 2. Boundary central pill grip
        const discGeo = new THREE.CylinderGeometry(10, 10, 5, 20);
        discGeo.rotateZ(Math.PI / 2);
        const discMesh = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: color, depthTest: false, transparent: true, opacity: 0.95 }));
        discMesh.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName };
        discMesh.renderOrder = 1010;
        group.add(discMesh);

        // 3. Accent ring
        const ringGeo = new THREE.TorusGeometry(6.5, 1.5, 12, 20);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        ringMesh.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName, isRing: true };
        ringMesh.renderOrder = 1011;
        group.add(ringMesh);

        // 4. Direction arrow cone along wall height
        const coneGeo = new THREE.ConeGeometry(7, 16, 16);
        coneGeo.rotateX(side === 'bottom' ? Math.PI : 0);
        const coneMesh = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: color, depthTest: false }));
        coneMesh.position.set(0, side === 'bottom' ? -10 : 10, 0);
        coneMesh.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName };
        coneMesh.renderOrder = 1010;
        group.add(coneMesh);

        return group;
    }

    _updateBoundaryLine(group, heightLen) {
        const lineMesh = group.getObjectByName('laserLine');
        if (lineMesh) {
            lineMesh.geometry.dispose();
            lineMesh.geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, -heightLen / 2, 0),
                new THREE.Vector3(0, heightLen / 2, 0)
            ]);
        }
        const hitBox = group.getObjectByName('laserHitBox');
        if (hitBox) {
            hitBox.geometry.dispose();
            hitBox.geometry = new THREE.BoxGeometry(28, heightLen + 20, 24);
        }
    }

    _updateHorizontalBoundaryLine(group, widthLen) {
        const lineMesh = group.getObjectByName('laserLine');
        if (lineMesh) {
            lineMesh.geometry.dispose();
            lineMesh.geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-widthLen / 2, 0, 0),
                new THREE.Vector3(widthLen / 2, 0, 0)
            ]);
        }
        const hitBox = group.getObjectByName('laserHitBox');
        if (hitBox) {
            hitBox.geometry.dispose();
            hitBox.geometry = new THREE.BoxGeometry(widthLen + 20, 28, 24);
        }
    }

    setMode(mode) {
        if (mode === 'thickness' || mode === 'baseline') {
            this.mode = mode;
            this.updateHandles();
            if (this.ctx.requestRender) this.ctx.requestRender();
        }
    }

    _onKeyDown(e) {
        if (!this.visible) return;
        if (e.key === 'Tab') {
            e.preventDefault();
            this.mode = this.mode === 'thickness' ? 'baseline' : 'thickness';
            this.updateHandles();
            if (this.domBadge) {
                this.domBadge.textContent = `Mode: ${this.mode === 'thickness' ? '🧱 Face Thickness' : '🏠 Move Baseline'} (Press Tab to toggle)`;
            }
            if (this.ctx.requestRender) this.ctx.requestRender();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.commit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.cancel();
        }
    }

    _createConfirmHUDBar() {
        if (typeof document === 'undefined') return;
        
        // If managed by WallInteractiveSuite, WallInteractiveSuite provides the single unified confirmation HUD
        if (this.ctx.interactions?.wallInteractiveSuite) {
            return;
        }

        this.domConfirmBar = document.createElement('div');
        this.domConfirmBar.className = 'sims4-pushpull-confirm-bar';
        this.domConfirmBar.style.cssText = `
            position: absolute;
            display: none;
            transform: translate(-50%, -100%);
            padding: 6px 14px;
            border-radius: 28px;
            background: rgba(15, 23, 42, 0.95);
            border: 2px solid #00f0ff;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 240, 255, 0.4);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
            z-index: 10001;
            user-select: none;
            gap: 8px;
            align-items: center;
            backdrop-filter: blur(8px);
            pointer-events: auto;
        `;

        this.domBadge = document.createElement('span');
        this.domBadge.style.cssText = `
            color: #00f0ff;
            font-weight: 800;
            font-size: 12px;
            padding-right: 4px;
        `;
        this.domConfirmBar.appendChild(this.domBadge);

        const btnCancel = document.createElement('button');
        btnCancel.textContent = '✕ Cancel';
        btnCancel.title = 'Cancel extrusion and revert (Esc)';
        btnCancel.style.cssText = `
            padding: 4px 10px;
            border-radius: 14px;
            border: 1px solid #ef4444;
            background: rgba(239, 68, 68, 0.15);
            color: #fca5a5;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        btnCancel.onmouseenter = () => { btnCancel.style.background = '#ef4444'; btnCancel.style.color = '#ffffff'; };
        btnCancel.onmouseleave = () => { btnCancel.style.background = 'rgba(239, 68, 68, 0.15)'; btnCancel.style.color = '#fca5a5'; };
        btnCancel.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.cancel();
        };
        this.domConfirmBar.appendChild(btnCancel);

        const btnDone = document.createElement('button');
        btnDone.textContent = '✓ Done';
        btnDone.title = 'Apply solid extrusion to wall (Enter)';
        btnDone.style.cssText = `
            padding: 4px 12px;
            border-radius: 14px;
            border: 1px solid #10b981;
            background: rgba(16, 185, 129, 0.25);
            color: #6ee7b7;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        btnDone.onmouseenter = () => { btnDone.style.background = '#10b981'; btnDone.style.color = '#ffffff'; };
        btnDone.onmouseleave = () => { btnDone.style.background = 'rgba(16, 185, 129, 0.25)'; btnDone.style.color = '#6ee7b7'; };
        btnDone.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.commit();
        };
        this.domConfirmBar.appendChild(btnDone);

        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domConfirmBar);
    }

    _buildSims4Handle(side, color) {
        const group = new THREE.Group();
        group.userData = { isWallPushPullHandle: true, side };
        group.renderOrder = 999;
        
        const hitGeo = new THREE.CylinderGeometry(28, 28, 48, 16);
        hitGeo.rotateX(Math.PI / 2);
        const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.userData = { isWallPushPullHandle: true, side, part: 'hitbox' };
        group.add(hitMesh);

        const baseGeo = new THREE.CylinderGeometry(14, 14, 6, 24);
        baseGeo.rotateX(Math.PI / 2);
        const baseMesh = new THREE.Mesh(baseGeo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }));
        baseMesh.userData = { isWallPushPullHandle: true, side, part: 'base' };
        baseMesh.renderOrder = 999;
        group.add(baseMesh);

        const ringGeo = new THREE.TorusGeometry(9, 1.8, 12, 24);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        ringMesh.userData = { isWallPushPullHandle: true, side, part: 'ring' };
        ringMesh.renderOrder = 1000;
        group.add(ringMesh);

        // Outward Pull Arrow (+Z)
        const arrowGeo = new THREE.ConeGeometry(11, 24, 20);
        arrowGeo.rotateX(Math.PI / 2);
        const arrowMesh = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
        arrowMesh.position.set(0, 0, 18);
        arrowMesh.userData = { isWallPushPullHandle: true, side, part: 'arrow' };
        arrowMesh.renderOrder = 999;
        group.add(arrowMesh);

        // Inward Push Arrow (-Z)
        const backArrowGeo = new THREE.ConeGeometry(9, 18, 20);
        backArrowGeo.rotateX(-Math.PI / 2);
        const backArrowMesh = new THREE.Mesh(backArrowGeo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.85 }));
        backArrowMesh.position.set(0, 0, -14);
        backArrowMesh.userData = { isWallPushPullHandle: true, side, part: 'backArrow' };
        backArrowMesh.renderOrder = 999;
        group.add(backArrowMesh);

        return group;
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
        this.currentExtrudeDepth = 0;
        this.initialExtrudeDepth = 0;
        
        const wall = this._getWallEntity();
        this.existingProtrusion = object.userData?.widget 
            || (object.userData?.isProtrusion ? (object.userData.entity?.type === 'solid_protrusion' ? object.userData.entity : null) : null)
            || (wall?.attachedWidgets?.find(w => (w.type === 'solid_protrusion' || w.configId === 'solid_protrusion') && (w.depth || w.width)));
        
        if (wall) {
            const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
            const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };
            const len = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
            const h = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));

            if (this.existingProtrusion && (this.existingProtrusion.type === 'solid_protrusion' || this.existingProtrusion.configId === 'solid_protrusion')) {
                const protW = this.existingProtrusion.width || len;
                const protH = this.existingProtrusion.height || h;
                const protElev = this.existingProtrusion.elevation || 0;
                const protT = this.existingProtrusion.t !== undefined ? this.existingProtrusion.t : 0.5;
                const halfT = (protW / 2) / len;

                this.tStart = Math.max(0, protT - halfT);
                this.tEnd = Math.min(1, protT + halfT);
                this.elevBottom = protElev;
                this.elevTop = protElev + protH;
                this.currentExtrudeDepth = this.existingProtrusion.depth || 0;
                this.initialExtrudeDepth = this.existingProtrusion.depth || 0;
                this.activeFacing = this.existingProtrusion.facing || 1;
                this.activeSide = this.activeFacing === -1 ? 'back' : 'front';
            } else {
                this.elevTop = h;
                this.elevBottom = 0;
                this.tStart = 0.0;
                this.tEnd = 1.0;
                this.activeSide = 'front';
                this.activeFacing = 1;
            }
        }

        if (this.solidBlockPreview) this.solidBlockPreview.visible = false;
        this.updateHandles();
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    detach() {
        this.target = null;
        this.existingProtrusion = null;
        this.visible = false;
        this.isDragging = false;
        this.activeHandle = null;
        this.currentExtrudeDepth = 0;
        if (this.solidBlockPreview) this.solidBlockPreview.visible = false;
        if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    _getWallEntity() {
        if (!this.target) return null;
        if (this.target.userData && this.target.userData.parentWall) {
            return this.target.userData.parentWall;
        }
        if (this.target.userData && this.target.userData.entity) {
            return this.target.userData.entity;
        }
        if (this.target.parent && this.target.parent.userData && this.target.parent.userData.entity) {
            return this.target.parent.userData.entity;
        }
        return null;
    }

    _getWallGroup() {
        const wall = this._getWallEntity();
        if (!wall) return null;
        if (wall.mesh3D) return wall.mesh3D;
        if (this.target && this.target.isGroup) return this.target;
        if (this.target && this.target.parent && this.target.parent.isGroup) return this.target.parent;
        return null;
    }

    updateHandles() {
        const wall = this._getWallEntity();
        const wallGroup = this._getWallGroup();
        if (!wall || !wallGroup) {
            this.visible = false;
            if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
            return;
        }

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;

        const h = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));
        const t = (wall.thickness !== undefined ? wall.thickness : 20);

        if (this.elevTop === undefined || this.elevTop > h) {
            this.elevTop = h;
        }
        if (this.elevBottom === undefined) {
            this.elevBottom = 0;
        }

        // Align Gizmo transform with the Wall Group in 3D scene space
        wallGroup.updateMatrixWorld(true);
        this.position.copy(wallGroup.getWorldPosition(new THREE.Vector3()));
        this.quaternion.copy(wallGroup.getWorldQuaternion(new THREE.Quaternion()));
        this.scale.copy(wallGroup.getWorldScale(new THREE.Vector3()));

        const midX = (this.tStart + this.tEnd) * 0.5 * len;
        const startX = this.tStart * len;
        const endX = this.tEnd * len;
        const spanW = Math.max(1, endX - startX);

        const midY = (this.elevBottom + this.elevTop) * 0.5;
        const spanH = Math.max(1, this.elevTop - this.elevBottom);

        const extrudeD = this.currentExtrudeDepth || 0;
        const frontOffset = t / 2 + extrudeD + 10;
        const backOffset = t / 2 + (extrudeD < 0 ? Math.abs(extrudeD) : 0) + 10;

        // Position Front Handle on front face of extruded solid block (local Z = +t/2 + extrudeD)
        this.handleFront.position.set(midX, midY, frontOffset);
        this.handleFront.rotation.set(0, 0, 0);

        // Position Back Handle at back face
        this.handleBack.position.set(midX, midY, -backOffset);
        this.handleBack.rotation.set(0, Math.PI, 0);

        // Position Width Selection Handles (Vertical lines)
        this.startWidthHandle.position.set(startX, midY, frontOffset + 2);
        this._updateBoundaryLine(this.startWidthHandle, spanH);

        this.endWidthHandle.position.set(endX, midY, frontOffset + 2);
        this._updateBoundaryLine(this.endWidthHandle, spanH);

        // Position Height/Elevation Selection Handles (Horizontal lines)
        this.bottomHeightHandle.position.set(midX, this.elevBottom, frontOffset + 2);
        this._updateHorizontalBoundaryLine(this.bottomHeightHandle, spanW);

        this.topHeightHandle.position.set(midX, this.elevTop, frontOffset + 2);
        this._updateHorizontalBoundaryLine(this.topHeightHandle, spanW);

        // Position & Scale the 2D Selection Box on Wall Faces
        const isSubRegion = (this.tStart > 0.02 || this.tEnd < 0.98 || this.elevBottom > 2 || this.elevTop < (h - 2));
        if (this.selectionRectGroup) {
            this.selectionRectGroup.visible = isSubRegion && extrudeD === 0;
            if (isSubRegion && extrudeD === 0) {
                this.selectionPlaneFront.scale.set(spanW, spanH, 1);
                this.selectionPlaneFront.position.set(midX, midY, t / 2 + 0.5);

                this.selectionOutlineFront.scale.set(spanW, spanH, 1);
                this.selectionOutlineFront.position.set(midX, midY, t / 2 + 0.6);

                this.selectionPlaneBack.scale.set(spanW, spanH, 1);
                this.selectionPlaneBack.position.set(midX, midY, -t / 2 - 0.5);

                this.selectionOutlineBack.scale.set(spanW, spanH, 1);
                this.selectionOutlineBack.position.set(midX, midY, -t / 2 - 0.6);
            }
        }

        // Show real-time 3D solid block (or niche) ghost preview during sub-region pull/push
        if (this.solidBlockPreview) {
            if (isSubRegion && extrudeD !== 0 && !this.existingProtrusion) {
                this.solidBlockPreview.visible = true;
                const facing = this.activeFacing || 1;
                const absD = Math.abs(extrudeD);
                this.previewMesh.scale.set(spanW, spanH, absD);
                this.previewEdges.scale.set(spanW, spanH, absD);

                if (extrudeD > 0) {
                    // Outward solid protrusion
                    this.previewMesh.position.set(midX, midY, (t / 2 + absD / 2) * facing);
                    this.previewEdges.position.copy(this.previewMesh.position);
                    this.previewEdgesMat.color.setHex(0x22c55e); // Emerald Green
                } else {
                    // Inward niche cavity
                    this.previewMesh.position.set(midX, midY, (t / 2 - absD / 2) * facing);
                    this.previewEdges.position.copy(this.previewMesh.position);
                    this.previewEdgesMat.color.setHex(0xa855f7); // Amethyst Purple
                }
            } else {
                this.solidBlockPreview.visible = false;
            }
        }

        this.visible = true;
        this._updateHUDDimensions(len, h);
    }

    _resetHandleMaterials() {
        this._setGroupMaterial(this.handleFront, this.matFront);
        this._setGroupMaterial(this.handleBack, this.matBack);
        this._setGroupMaterial(this.startWidthHandle, this.matFront);
        this._setGroupMaterial(this.endWidthHandle, this.matFront);
        this._setGroupMaterial(this.bottomHeightHandle, this.matGold);
        this._setGroupMaterial(this.topHeightHandle, this.matGold);
    }

    _setGroupMaterial(group, mat) {
        group.children.forEach(c => {
            if (c.userData && c.userData.isRing) return; // preserve white accent ring
            if (c.material && c.material.visible === false) return; // preserve invisible hit collider
            if (c.material) c.material = mat;
        });
    }

    _updateHUDDimensions(wallLen, wallH, depthText = null) {
        const selW = Math.round(wallLen * (this.tEnd - this.tStart));
        const selH = Math.round(this.elevTop - this.elevBottom);
        const selElev = Math.round(this.elevBottom);
        const extrudeD = this.currentExtrudeDepth || 0;

        let statusText = '';
        if (depthText) {
            statusText = `${depthText} · 📏 W: ${selW} cm · H: ${selH} cm · Elev: ${selElev} cm`;
        } else if (extrudeD > 0) {
            statusText = `🧱 Solid Block: +${extrudeD} cm · 📏 W: ${selW} cm · H: ${selH} cm`;
        } else if (extrudeD < 0) {
            statusText = `🪟 Niche: ${extrudeD} cm · 📏 W: ${selW} cm · H: ${selH} cm`;
        } else {
            statusText = `📏 Width: ${selW} cm · Height: ${selH} cm · Elev: ${selElev} cm`;
        }

        const suite = this.ctx.interactions?.wallInteractiveSuite;
        if (suite && suite.confirmStatusBadge && (suite.activeMode === 'push_pull' || suite.activeMode === 'extrude_recess')) {
            suite.confirmStatusBadge.textContent = statusText;
            if (suite.domConfirmBar && this.ctx.camera && this.ctx.renderer) {
                const dom = this.ctx.renderer.domElement;
                if (dom) {
                    const rect = dom.getBoundingClientRect();
                    const worldPos = new THREE.Vector3();
                    this.handleFront.getWorldPosition(worldPos);
                    worldPos.y += 24;
                    worldPos.project(this.ctx.camera);

                    if (worldPos.z <= 1) {
                        const rawScreenX = rect.left + ((worldPos.x + 1) * rect.width) / 2;
                        const rawScreenY = rect.top + ((-worldPos.y + 1) * rect.height) / 2;
                        const hudWidth = suite.domConfirmBar?.offsetWidth || 380;
                        const minX = rect.left + (hudWidth / 2) + 16;
                        const maxX = Math.max(minX, rect.right - (hudWidth / 2) - 16);
                        const screenX = Math.max(minX, Math.min(maxX, rawScreenX));
                        const screenY = Math.max(rect.top + 48, Math.min(rect.bottom - 48, rawScreenY));
                        suite.domConfirmBar.style.left = `${screenX}px`;
                        suite.domConfirmBar.style.top = `${screenY - 14}px`;
                        suite.domConfirmBar.style.display = 'flex';
                    }
                }
            }
            if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
            return;
        }

        if (!this.domConfirmBar || !this.ctx.camera || !this.ctx.renderer) return;
        const dom = this.ctx.renderer.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();

        const worldPos = new THREE.Vector3();
        this.handleFront.getWorldPosition(worldPos);
        worldPos.y += 24;
        worldPos.project(this.ctx.camera);

        const screenX = Math.max(120, Math.min(rect.width - 120, ((worldPos.x + 1) * rect.width) / 2));
        const screenY = Math.max(50, Math.min(rect.height - 40, ((-worldPos.y + 1) * rect.height) / 2));

        if (this.domBadge) this.domBadge.textContent = statusText;
        this.domConfirmBar.style.left = `${screenX}px`;
        this.domConfirmBar.style.top = `${screenY - 14}px`;
        this.domConfirmBar.style.display = 'flex';
    }

    _onPointerDown(e) {
        if (!this.visible) return;
        if (e.button !== 0) return;
        
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        
        const allHandleMeshes = [
            ...this.handleFront.children,
            ...this.handleBack.children,
            ...this.startWidthHandle.children,
            ...this.endWidthHandle.children,
            ...this.bottomHeightHandle.children,
            ...this.topHeightHandle.children
        ];
        const intersects = this.raycaster.intersectObjects(allHandleMeshes, true);
        
        if (intersects.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            
            let hitMesh = intersects[0].object;
            const originalHit = hitMesh;
            while (hitMesh && !hitMesh.userData.isWallPushPullHandle && hitMesh.parent) {
                hitMesh = hitMesh.parent;
            }
            
            const wall = this._getWallEntity();
            if (!wall) return;
            
            const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
            const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };
            this.initialStart = { x: p1.x, y: p1.y };
            this.initialEnd = { x: p2.x, y: p2.y };
            this.initialThickness = (wall.thickness !== undefined ? wall.thickness : (wall.config?.thickness || 20));
            this.initialStartT = this.tStart;
            this.initialEndT = this.tEnd;
            this.initialElevBottom = this.elevBottom;
            this.initialElevTop = this.elevTop;
            this.initialExtrudeDepth = this.currentExtrudeDepth || 0;
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);
            if (len === 0) return;

            const camDir = new THREE.Vector3();
            this.ctx.camera.getWorldDirection(camDir);

            const part = hitMesh?.userData?.part || originalHit?.userData?.part;
            const side = hitMesh?.userData?.side || originalHit?.userData?.side || (intersects[0].object.parent?.userData?.side) || 'front';

            if (part === 'boundary_start' || part === 'boundary_end') {
                this.activeHandle = part;
                const hitPoint = intersects[0].point;
                const axisW = new THREE.Vector3(dx / len, 0, dy / len);
                const cross = new THREE.Vector3().crossVectors(camDir, axisW);
                if (cross.lengthSq() > 0.001) {
                    const planeNorm = new THREE.Vector3().crossVectors(axisW, cross).normalize();
                    this.dragPlane.setFromNormalAndCoplanarPoint(planeNorm, hitPoint);
                } else {
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hitPoint);
                }
                this.dragStartPoint.copy(hitPoint);
            } else if (part === 'boundary_bottom' || part === 'boundary_top') {
                this.activeHandle = part;
                const hitPoint = intersects[0].point;
                const axisH = new THREE.Vector3(0, 1, 0);
                const cross = new THREE.Vector3().crossVectors(camDir, axisH);
                if (cross.lengthSq() > 0.001) {
                    const planeNorm = new THREE.Vector3().crossVectors(axisH, cross).normalize();
                    this.dragPlane.setFromNormalAndCoplanarPoint(planeNorm, hitPoint);
                } else {
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(camDir.x, 0, camDir.z).normalize(), hitPoint);
                }
                this.dragStartPoint.copy(hitPoint);
            } else {
                this.activeHandle = side;
                this.activeSide = side;
                this.activeFacing = side === 'back' ? -1 : 1;
                this.currentDragDist = 0;
                
                const hitGroup = side === 'front' ? this.handleFront : this.handleBack;
                this._resetHandleMaterials();
                this._setGroupMaterial(hitGroup, this.matActive);
                
                // Wall normal vector in 2D
                this.wallNormal2D = { x: -dy / len, y: dx / len };
                if (side === 'back') {
                    this.wallNormal2D.x *= -1;
                    this.wallNormal2D.y *= -1;
                }
                
                const hitPoint = intersects[0].point;
                const axisN = new THREE.Vector3(this.wallNormal2D.x, 0, this.wallNormal2D.y);
                const cross = new THREE.Vector3().crossVectors(camDir, axisN);
                if (cross.lengthSq() > 0.001) {
                    const planeNorm = new THREE.Vector3().crossVectors(axisN, cross).normalize();
                    this.dragPlane.setFromNormalAndCoplanarPoint(planeNorm, hitPoint);
                } else if (Math.abs(camDir.y) >= 0.2) {
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hitPoint);
                } else {
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(camDir.x, 0, camDir.z).normalize(), hitPoint);
                }
                this.dragStartPoint.copy(hitPoint);
            }
            
            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance || wall.planner;
            if (planner && planner.commandManager && typeof planner.exportState === 'function') {
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

    _updateWallAndSiblings(wall) {
        if (!wall) return;
        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance || wall.planner;

        const wallsToUpdate = new Set([wall]);
        if (planner && planner.walls) {
            const a1 = wall.startAnchor;
            const a2 = wall.endAnchor;
            planner.walls.forEach(w => {
                if (w !== wall && !w.hidden) {
                    if ((a1 && (w.startAnchor === a1 || w.endAnchor === a1)) ||
                        (a2 && (w.startAnchor === a2 || w.endAnchor === a2))) {
                        wallsToUpdate.add(w);
                    }
                }
            });
        }

        wallsToUpdate.forEach(w => {
            try {
                if (w.update) w.update();
                if (w.attachedMoldings) {
                    w.attachedMoldings.forEach(m => {
                        if (m.update) m.update();
                    });
                }
                if (typeof this.ctx.updateWallGeometryLive === 'function') {
                    this.ctx.updateWallGeometryLive(w);
                }
            } catch(err) {
                console.warn('[WallPushPullGizmo] Live wall update err:', err);
            }
        });

        if (planner) {
            if (typeof planner.syncAll === 'function') planner.syncAll();
            if (planner.wallLayer && typeof planner.wallLayer.batchDraw === 'function') planner.wallLayer.batchDraw();
            if (planner.widgetLayer && typeof planner.widgetLayer.batchDraw === 'function') planner.widgetLayer.batchDraw();
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
                const wall = this._getWallEntity();
                if (!wall) return;

                const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
                const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.hypot(dx, dy);
                if (len === 0) return;

                const wallH = wall.height !== undefined ? wall.height : (wall.config?.height || 120);
                const wallT = wall.thickness !== undefined ? wall.thickness : (wall.config?.thickness || 20);
                const dirX = dx / len;
                const dirZ = dy / len;
                const deltaWorldX = currentPoint.x - this.dragStartPoint.x;
                const deltaWorldZ = currentPoint.z - this.dragStartPoint.z;

                const planner = this.ctx.planner || window.planner?.value || window.plannerInstance || wall.planner;

                if (this.activeHandle === 'boundary_start') {
                    // --- DRAG START BOUNDARY (Adjust Selected Width) ---
                    const deltaAlongWall = deltaWorldX * dirX + deltaWorldZ * dirZ;
                    const deltaT = deltaAlongWall / len;
                    const newStartT = Math.max(0.0, Math.min(this.initialEndT - 0.05, this.initialStartT + deltaT));
                    this.tStart = Math.round(newStartT * 100) / 100;
                    this.updateHandles();
                } else if (this.activeHandle === 'boundary_end') {
                    // --- DRAG END BOUNDARY (Adjust Selected Width) ---
                    const deltaAlongWall = deltaWorldX * dirX + deltaWorldZ * dirZ;
                    const deltaT = deltaAlongWall / len;
                    const newEndT = Math.min(1.0, Math.max(this.initialStartT + 0.05, this.initialEndT + deltaT));
                    this.tEnd = Math.round(newEndT * 100) / 100;
                    this.updateHandles();
                } else if (this.activeHandle === 'boundary_bottom') {
                    // --- DRAG BOTTOM BOUNDARY (Adjust Bottom Elevation from Floor) ---
                    const deltaY = currentPoint.y - this.dragStartPoint.y;
                    const newElev = Math.max(0, Math.min(this.initialElevTop - 10, Math.round(this.initialElevBottom + deltaY)));
                    this.elevBottom = newElev;
                    this.updateHandles();
                } else if (this.activeHandle === 'boundary_top') {
                    // --- DRAG TOP BOUNDARY (Adjust Top Height Line) ---
                    const deltaY = currentPoint.y - this.dragStartPoint.y;
                    const newTop = Math.min(wallH, Math.max(this.initialElevBottom + 10, Math.round(this.initialElevTop + deltaY)));
                    this.elevTop = newTop;
                    this.updateHandles();
                } else {
                    // --- DRAG FACE PUSH / PULL (Depth: Outward Solid Block vs Inward Niche) ---
                    let dist = (deltaWorldX * this.wallNormal2D.x) + (deltaWorldZ * this.wallNormal2D.y);
                    const step = 1; // 1cm precision
                    this.currentDragDist = dist;

                    const isSubRegion = (this.tStart > 0.02 || this.tEnd < 0.98 || this.elevBottom > 2 || this.elevTop < (wallH - 2)) || !!this.existingProtrusion;

                    if (this.mode === 'baseline') {
                        // --- BASELINE MOVE MODE (Move whole wall perpendicularly via WallEngine) ---
                        const shiftDist = Math.round(dist / step) * step;
                        WallEngine.pushPull(wall, this.activeSide, shiftDist, {
                            mode: 'baseline',
                            initialStart: this.initialStart,
                            initialEnd: this.initialEnd
                        }, planner);

                        this._updateWallAndSiblings(wall);
                        if (typeof this.ctx.rebuildActiveFloors === 'function') {
                            try { this.ctx.rebuildActiveFloors(); } catch(err) {}
                        }

                        this.updateHandles();
                    } else if (isSubRegion) {
                        // --- SUB-REGION ELEVATION PUSH / PULL (Step 2: Freely Pull Solid Block & Adjust Inward Niche) ---
                        const deltaD = Math.round(dist);
                        const maxNiche = Math.max(1, (wall.thickness || 20) - 3);
                        const minDepth = this.existingProtrusion ? 0 : -maxNiche;
                        const newDepth = Math.max(minDepth, Math.round(this.initialExtrudeDepth + deltaD));
                        this.currentExtrudeDepth = newDepth;

                        if (this.existingProtrusion) {
                            this.existingProtrusion.depth = Math.max(0, newDepth);
                            this._updateWallAndSiblings(wall);
                        }

                        this.updateHandles();
                    } else {
                        // --- FULL WALL THICKNESS PUSH / PULL (Single-Sided: Pin Opposite Face via WallEngine) ---
                        const deltaThick = Math.round(dist / step) * step;
                        WallEngine.pushPull(wall, this.activeSide, deltaThick, {
                            mode: 'thickness',
                            initialThickness: this.initialThickness,
                            initialStart: this.initialStart,
                            initialEnd: this.initialEnd
                        }, planner);

                        this._updateWallAndSiblings(wall);
                        if (typeof this.ctx.rebuildActiveFloors === 'function') {
                            try { this.ctx.rebuildActiveFloors(); } catch(err) {}
                        }

                        this.updateHandles();
                    }
                }

                if (this.ctx.requestRender) this.ctx.requestRender();
            }
        } else {
            // Hover highlight
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const allHandleMeshes = [
                ...this.handleFront.children,
                ...this.handleBack.children,
                ...this.startWidthHandle.children,
                ...this.endWidthHandle.children,
                ...this.bottomHeightHandle.children,
                ...this.topHeightHandle.children
            ];
            const intersects = this.raycaster.intersectObjects(allHandleMeshes, true);
            this._resetHandleMaterials();
            
            if (intersects.length > 0) {
                let hitMesh = intersects[0].object;
                const part = hitMesh?.userData?.part;
                if (part === 'boundary_start' || part === 'boundary_end') {
                    const group = part === 'boundary_start' ? this.startWidthHandle : this.endWidthHandle;
                    this._setGroupMaterial(group, this.matHover);
                    this.ctx.renderer.domElement.style.cursor = 'ew-resize';
                } else if (part === 'boundary_bottom' || part === 'boundary_top') {
                    const group = part === 'boundary_bottom' ? this.bottomHeightHandle : this.topHeightHandle;
                    this._setGroupMaterial(group, this.matHover);
                    this.ctx.renderer.domElement.style.cursor = 'ns-resize';
                } else {
                    const side = hitMesh?.userData?.side || (intersects[0].object.parent?.userData?.side);
                    const hitGroup = side === 'front' ? this.handleFront : (side === 'back' ? this.handleBack : null);
                    if (hitGroup) {
                        this._setGroupMaterial(hitGroup, this.matHover);
                    }
                    this.ctx.renderer.domElement.style.cursor = 'grab';
                }
            } else {
                this.ctx.renderer.domElement.style.cursor = 'auto';
            }
        }
    }

    _onPointerUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.activeHandle = null;
            this._resetHandleMaterials();
            
            if (this._capturedPointerId !== null && e.target && typeof e.target.releasePointerCapture === 'function') {
                try { e.target.releasePointerCapture(this._capturedPointerId); } catch(err) {}
                this._capturedPointerId = null;
            }
            
            if (this.ctx.controls) this.ctx.controls.enabled = true;
            this.ctx.renderer.domElement.style.cursor = 'auto';

            if (this.existingProtrusion) {
                this.commit();
            }
            
            this.updateHandles();
            if (this.ctx.requestRender) this.ctx.requestRender();
        }
    }

    /**
     * Step 3: Apply / Commit changes (triggered by ✓ Done button or Enter key)
     */
    commit() {
        const wall = this._getWallEntity();
        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        if (!wall) {
            this.detach();
            return;
        }

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };
        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const wallH = wall.height !== undefined ? wall.height : (wall.config?.height || 120);

        const isSubRegion = (this.tStart > 0.02 || this.tEnd < 0.98 || this.elevBottom > 2 || this.elevTop < (wallH - 2)) || !!this.existingProtrusion;
        const extrudeD = this.currentExtrudeDepth || 0;

        if (this.existingProtrusion) {
            // Requirement 3 & 4: Re-adjust existing solid block in place without creating any separate walls
            const depthVal = Math.round(Math.abs(extrudeD));
            if (depthVal <= 0.5) {
                WallEngine.removeSolidProtrusion(wall, this.existingProtrusion, true, planner);
                this.existingProtrusion = null;
                this.currentExtrudeDepth = 0;
            } else {
                const newWidth = Math.max(10, Math.round(len * (this.tEnd - this.tStart)));
                const newHeight = Math.max(10, Math.round(this.elevTop - this.elevBottom));
                const newElev = Math.round(this.elevBottom);
                const newT = (this.tStart + this.tEnd) / 2;
                const newFacing = this.activeFacing || 1;

                WallEngine.updateSolidProtrusion(wall, this.existingProtrusion, {
                    depth: depthVal,
                    width: newWidth,
                    height: newHeight,
                    elevation: newElev,
                    t: newT,
                    facing: newFacing
                }, false, planner);
            }
            this._updateWallAndSiblings(wall);
        } else if (isSubRegion && Math.abs(extrudeD) >= 1) {
            const selW = Math.max(10, Math.round(len * (this.tEnd - this.tStart)));
            const selH = Math.max(10, Math.round(this.elevTop - this.elevBottom));
            const selElev = Math.round(this.elevBottom);
            const facing = this.activeFacing || 1;
            const protT = (this.tStart + this.tEnd) / 2;

            if (extrudeD > 0) {
                // Outward pull -> Solid Protrusion feature on existing host wall
                const depthVal = Math.round(extrudeD);
                let widgetObj = null;
                if (planner && planner.wallLayer && typeof advance_openings === 'function') {
                    try {
                        widgetObj = new advance_openings(planner, wall, protT, 'solid_protrusion');
                        widgetObj.width = selW;
                        widgetObj.height = selH;
                        widgetObj.elevation = selElev;
                        widgetObj.depth = depthVal;
                        widgetObj.facing = facing;
                        widgetObj.update();
                    } catch(e) {
                        widgetObj = null;
                    }
                }
                if (!widgetObj) {
                    widgetObj = WallEngine.addSolidProtrusion(wall, {
                        width: selW,
                        height: selH,
                        elevation: selElev,
                        depth: depthVal,
                        t: protT,
                        facing: facing
                    }, false, planner);
                } else {
                    if (!wall.attachedWidgets) wall.attachedWidgets = [];
                    if (!wall.attachedWidgets.includes(widgetObj)) {
                        wall.attachedWidgets.push(widgetObj);
                    }
                }
            } else {
                // Inward push -> Architectural Niche
                const maxNicheDepth = Math.max(1, (wall.thickness || 20) - 3);
                const nicheDepth = Math.min(Math.round(Math.abs(extrudeD)), maxNicheDepth);
                let widgetObj = null;
                if (planner && planner.wallLayer && typeof advance_openings === 'function') {
                    try {
                        widgetObj = new advance_openings(planner, wall, protT, 'niche_recess');
                        widgetObj.width = selW;
                        widgetObj.height = selH;
                        widgetObj.elevation = selElev;
                        widgetObj.depth = nicheDepth;
                        widgetObj.facing = facing;
                        widgetObj.update();
                    } catch(e) {
                        widgetObj = null;
                    }
                }
                if (!widgetObj) {
                    widgetObj = {
                        id: 'niche_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                        type: 'niche_recess',
                        configId: 'niche_recess',
                        t: protT,
                        width: selW,
                        height: selH,
                        elevation: selElev,
                        depth: nicheDepth,
                        thick: (wall.thickness || 20),
                        facing: facing,
                        wall: wall
                    };
                }
                if (!wall.attachedWidgets) wall.attachedWidgets = [];
                if (!wall.attachedWidgets.includes(widgetObj)) {
                    wall.attachedWidgets.push(widgetObj);
                }
            }

            this._updateWallAndSiblings(wall);
        } else {
            this._updateWallAndSiblings(wall);
        }

        if (planner) {
            if (typeof planner.findRooms === 'function') {
                try { planner.findRooms(); } catch(err) {}
            }
            if (typeof planner.syncAll === 'function') planner.syncAll();
        }
        if (typeof this.ctx.rebuildActiveFloors === 'function') {
            try { this.ctx.rebuildActiveFloors(); } catch(err) {}
        }
        if (planner && planner.commandManager && this._snapshotCmd) {
            if (typeof this._snapshotCmd.finalize === 'function') {
                this._snapshotCmd.finalize();
            }
            planner.commandManager.execute(this._snapshotCmd);
            this._snapshotCmd = null;
        }

        coreEventBus.emit(EVENTS.WALL_CHANGE, { entity: wall });
        
        if (this.ctx.interactions && this.ctx.interactions.gizmoManager) {
            try {
                this.ctx.interactions.gizmoManager.setTransformMode('select');
            } catch(e) {}
        }

        this.detach();
    }

    /**
     * Step 3: Cancel changes (triggered by ✕ Cancel button or Esc key)
     */
    cancel() {
        const wall = this._getWallEntity();
        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance || wall?.planner;
        if (wall && this.initialThickness !== undefined && this.initialStart) {
            wall.thickness = this.initialThickness;
            if (wall.config) wall.config.thickness = this.initialThickness;
            WallEngine.setEndpoints(wall, this.initialStart, this.initialEnd, true, planner);
            this._updateWallAndSiblings(wall);
        }
        this.currentExtrudeDepth = 0;
        if (this.solidBlockPreview) this.solidBlockPreview.visible = false;
        if (this._snapshotCmd && this._snapshotCmd.undo) {
            try { this._snapshotCmd.undo(); } catch(e) {}
        }
        this._snapshotCmd = null;
        
        if (this.ctx.interactions && this.ctx.interactions.gizmoManager) {
            try {
                this.ctx.interactions.gizmoManager.setTransformMode('select');
            } catch(e) {}
        }
        
        this.detach();
    }

    dispose() {
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this._onKeyDown);
        }
        if (this.domConfirmBar && this.domConfirmBar.parentElement) {
            this.domConfirmBar.parentElement.removeChild(this.domConfirmBar);
        }
        this.detach();
    }
}

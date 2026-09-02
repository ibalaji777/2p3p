import * as THREE from 'three';
import { EVENTS } from '../constants/events.js';
import { coreEventBus } from '../EventBus.js';
import { WallPushPullGizmo } from './WallPushPullGizmo.js';
import { WallCornerVertexGizmo } from './WallCornerVertexGizmo.js';
import { WallHeightGizmo } from './WallHeightGizmo.js';
import { WallReformer } from '../engine2d/WallReformer.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { WallEngine } from '../wall/WallEngine.js';

/**
 * WallInteractiveSuite
 * 
 * Central coordinator managing all Sims 4-style 3D interactive editing tools for walls:
 * 1. Floating 3D HUD Toolbar directly hovering over the selected wall
 * 2. Dedicated Single-Tool Modes: Push/Pull, Height, Corners, Split Cutter, Unified 3D Bay Extrude & Niche Recess
 * 3. Radiant Glowing Selection Outline Ribbon framing the wall in 3D
 * 4. Interactive 3D Split Cutter Plane tracking mouse along wall length
 * 5. Unified 3D Extrusion & Recess Controller with double-sided drag handles & live ghost volume
 */
export class WallInteractiveSuite extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'WallInteractiveSuite';

        this.pushPullGizmo = new WallPushPullGizmo(ctx);
        this.cornerGizmo = new WallCornerVertexGizmo(ctx);
        this.heightGizmo = new WallHeightGizmo(ctx);

        this.add(this.pushPullGizmo);
        this.add(this.cornerGizmo);
        this.add(this.heightGizmo);

        // 3D Split Cutter Laser Plane
        this.splitLaserPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthTest: false })
        );
        this.splitLaserPlane.renderOrder = 1005;
        this.splitLaserPlane.visible = false;
        this.add(this.splitLaserPlane);

        // 3D Extrusion / Recess Ghost Group & Bi-directional Drag Handles
        this.extrudeGroup = new THREE.Group();
        this.extrudeGroup.visible = false;
        this.add(this.extrudeGroup);

        this.matNeutralGhost = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.2, depthTest: false, side: THREE.DoubleSide });
        this.matExtrudeGhost = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.4, depthTest: false });
        this.matRecessGhost = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.4, depthTest: false });

        // Photorealistic 3D Wall Preview Group (Real return walls, front wall, floor slab)
        this.bayPreviewGroup = new THREE.Group();
        this.bayPreviewGroup.renderOrder = 1003;
        this.extrudeGroup.add(this.bayPreviewGroup);

        this.matBayWall = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });
        this.matBayFloor = new THREE.MeshStandardMaterial({ color: 0xede8df, roughness: 0.5, metalness: 0.05 });
        this.matBayVoid = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.12, depthTest: false, side: THREE.DoubleSide });

        this.extrudeGhostMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            this.matNeutralGhost
        );
        this.extrudeGhostMesh.renderOrder = 1003;
        this.extrudeGroup.add(this.extrudeGhostMesh);

        this.extrudeOutline = new THREE.LineSegments(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2, depthTest: false })
        );
        this.extrudeOutline.renderOrder = 1004;
        this.extrudeGroup.add(this.extrudeOutline);

        this.extrudeHandle = this._buildBiDirectionalExtrudeHandle();
        this.extrudeGroup.add(this.extrudeHandle);

        this.extrudeStartHandle = this._buildBoundaryHandle('start', 0x00f0ff);
        this.extrudeGroup.add(this.extrudeStartHandle);

        this.extrudeEndHandle = this._buildBoundaryHandle('end', 0x00f0ff);
        this.extrudeGroup.add(this.extrudeEndHandle);

        this.target = null;
        this.activeMode = 'push_pull'; // 'push_pull', 'corner', 'height', 'split', 'extrude_recess'
        this.isSplitMode = false;
        this.isExtrudeDragging = false;
        this.activeExtrudePart = null; // 'depth_out' | 'depth_in' | 'slide_center' | 'boundary_start' | 'boundary_end'
        this.extrudeCurrentDepth = 0; // Starts at 0 (neutral) instead of fixed 30
        this.extrudeStartT = 0.25;
        this.extrudeEndT = 0.75;
        this.initialStartT = 0.25;
        this.initialEndT = 0.75;
        this.splitCurrentT = 0.5;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dragPlane = new THREE.Plane();
        this.dragStartPoint = new THREE.Vector3();
        this.initialExtrudeDepth = 0;
        this._capturedPointerId = null;
        this._snapshotCmd = null;
        this._initialWallSnapshot = null;

        this._createDOMHUD();
        this._createConfirmBar();
        this._createLiveBadges();

        this._onCameraChange = this._onCameraChange.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);

        if (this.ctx.controls) {
            this.ctx.controls.addEventListener('change', this._onCameraChange);
        }

        const dom = this.ctx.renderer.domElement;
        dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
    }

    _buildBiDirectionalExtrudeHandle() {
        const group = new THREE.Group();
        group.userData = { isExtrudeHandle: true, part: 'depth_center' };
        group.renderOrder = 1010;

        // Invisible generous hit collider for center slide
        const slideHit = new THREE.Mesh(
            new THREE.CylinderGeometry(24, 24, 16, 16),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        slideHit.rotation.x = Math.PI / 2;
        slideHit.userData = { isExtrudeHandle: true, part: 'slide_center' };
        group.add(slideHit);

        // 1. Central radiant base disc
        const discGeo = new THREE.CylinderGeometry(15, 15, 5, 24);
        discGeo.rotateX(Math.PI / 2);
        const discMesh = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 0.9 }));
        discMesh.userData = { isExtrudeHandle: true, part: 'slide_center' };
        discMesh.renderOrder = 1010;
        group.add(discMesh);

        // 2. White inner accent ring
        const ringGeo = new THREE.TorusGeometry(10, 2, 12, 24);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        ringMesh.userData = { isExtrudeHandle: true, part: 'slide_center', isRing: true };
        ringMesh.renderOrder = 1011;
        group.add(ringMesh);

        // 3. Outward Arrow (Emerald Green +Z) -> Extrude Bay
        const outGroup = new THREE.Group();
        outGroup.userData = { isExtrudeHandle: true, part: 'depth_out' };
        
        // Invisible generous hit collider for out arrow
        const outHit = new THREE.Mesh(
            new THREE.CylinderGeometry(18, 18, 30, 12),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        outHit.rotation.x = Math.PI / 2;
        outHit.position.z = 16;
        outHit.userData = { isExtrudeHandle: true, part: 'depth_out' };
        outGroup.add(outHit);

        const outShaft = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 14, 16), new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false }));
        outShaft.rotation.x = Math.PI / 2;
        outShaft.position.z = 8;
        outShaft.userData = { isExtrudeHandle: true, part: 'depth_out' };
        outShaft.renderOrder = 1010;
        const outHead = new THREE.Mesh(new THREE.ConeGeometry(10, 20, 16), new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false }));
        outHead.rotation.x = Math.PI / 2;
        outHead.position.z = 20;
        outHead.userData = { isExtrudeHandle: true, part: 'depth_out' };
        outHead.renderOrder = 1010;
        outGroup.add(outShaft, outHead);
        group.add(outGroup);

        // 4. Inward Arrow (Amethyst Purple -Z) -> Recess Niche
        const inGroup = new THREE.Group();
        inGroup.userData = { isExtrudeHandle: true, part: 'depth_in' };

        // Invisible generous hit collider for in arrow
        const inHit = new THREE.Mesh(
            new THREE.CylinderGeometry(18, 18, 30, 12),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        inHit.rotation.x = -Math.PI / 2;
        inHit.position.z = -16;
        inHit.userData = { isExtrudeHandle: true, part: 'depth_in' };
        inGroup.add(inHit);

        const inShaft = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 14, 16), new THREE.MeshBasicMaterial({ color: 0xa855f7, depthTest: false }));
        inShaft.rotation.x = -Math.PI / 2;
        inShaft.position.z = -8;
        inShaft.userData = { isExtrudeHandle: true, part: 'depth_in' };
        inShaft.renderOrder = 1010;
        const inHead = new THREE.Mesh(new THREE.ConeGeometry(10, 20, 16), new THREE.MeshBasicMaterial({ color: 0xa855f7, depthTest: false }));
        inHead.rotation.x = -Math.PI / 2;
        inHead.position.z = -20;
        inHead.userData = { isExtrudeHandle: true, part: 'depth_in' };
        inHead.renderOrder = 1010;
        inGroup.add(inShaft, inHead);
        group.add(inGroup);

        return group;
    }

    _buildBoundaryHandle(side, color = 0x00f0ff) {
        const group = new THREE.Group();
        const partName = side === 'start' ? 'boundary_start' : 'boundary_end';
        group.userData = { isExtrudeHandle: true, part: partName };
        group.renderOrder = 1010;

        // Invisible generous hit collider along wall height and bracket
        const hitBox = new THREE.Mesh(
            new THREE.BoxGeometry(32, 120, 24),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        hitBox.name = 'laserHitBox';
        hitBox.userData = { isExtrudeHandle: true, part: partName };
        group.add(hitBox);

        // 1. Vertical glowing laser cutting line
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -60, 0),
            new THREE.Vector3(0, 60, 0)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 3, depthTest: false, transparent: true, opacity: 0.95 });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        lineMesh.name = 'laserLine';
        lineMesh.renderOrder = 1009;
        group.add(lineMesh);

        // 2. Boundary central pill grip
        const discGeo = new THREE.CylinderGeometry(11, 11, 6, 20);
        discGeo.rotateX(Math.PI / 2);
        const discMesh = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: color, depthTest: false, transparent: true, opacity: 0.95 }));
        discMesh.userData = { isExtrudeHandle: true, part: partName };
        discMesh.renderOrder = 1010;
        group.add(discMesh);

        // 3. Accent ring
        const ringGeo = new THREE.TorusGeometry(7, 1.6, 12, 20);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        ringMesh.userData = { isExtrudeHandle: true, part: partName, isRing: true };
        ringMesh.renderOrder = 1011;
        group.add(ringMesh);

        // 4. Direction arrow cone along wall length
        const coneGeo = new THREE.ConeGeometry(9, 20, 16);
        if (side === 'start') {
            coneGeo.rotateZ(Math.PI / 2); // points -X (left)
        } else {
            coneGeo.rotateZ(-Math.PI / 2); // points +X (right)
        }
        const coneMesh = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: color, depthTest: false }));
        coneMesh.position.set(side === 'start' ? -16 : 16, 0, 0);
        coneMesh.userData = { isExtrudeHandle: true, part: partName };
        coneMesh.renderOrder = 1010;
        group.add(coneMesh);

        return group;
    }

    _updateBoundaryLine(handleGroup, wallH) {
        const lineMesh = handleGroup.getObjectByName('laserLine');
        if (lineMesh) {
            lineMesh.geometry.dispose();
            lineMesh.geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, -wallH / 2, 0),
                new THREE.Vector3(0, wallH / 2, 0)
            ]);
        }
        const hitBox = handleGroup.getObjectByName('laserHitBox');
        if (hitBox) {
            hitBox.geometry.dispose();
            hitBox.geometry = new THREE.BoxGeometry(32, wallH, 24);
        }
    }

    _setHandleHighlight(activePart) {
        const isOutHover = activePart === 'depth_out';
        const isInHover = activePart === 'depth_in';
        const isSlideHover = activePart === 'slide_center';
        const isStartHover = activePart === 'boundary_start';
        const isEndHover = activePart === 'boundary_end';

        // Highlight Center Depth Handle
        this.extrudeHandle.traverse(child => {
            if (!child.isMesh) return;
            if (child.material && child.material.visible === false) return; // skip invisible hit colliders
            const part = child.userData?.part;
            if (part === 'depth_out') {
                child.material.color.setHex(isOutHover ? 0xfacc15 : 0x10b981);
            } else if (part === 'depth_in') {
                child.material.color.setHex(isInHover ? 0xfacc15 : 0xa855f7);
            } else if (part === 'slide_center' && child.userData?.isRing !== true) {
                child.material.color.setHex(isSlideHover ? 0xfacc15 : 0x00f0ff);
            }
        });

        // Highlight Start Boundary Handle
        this.extrudeStartHandle.traverse(child => {
            if (child.isMesh) {
                if (child.material && child.material.visible === false) return;
                if (child.userData?.isRing !== true) {
                    child.material.color.setHex(isStartHover ? 0xfacc15 : 0x00f0ff);
                }
            } else if (child.isLine) {
                child.material.color.setHex(isStartHover ? 0xfacc15 : 0x00f0ff);
                child.material.opacity = isStartHover ? 1.0 : 0.85;
            }
        });

        // Highlight End Boundary Handle
        this.extrudeEndHandle.traverse(child => {
            if (child.isMesh) {
                if (child.material && child.material.visible === false) return;
                if (child.userData?.isRing !== true) {
                    child.material.color.setHex(isEndHover ? 0xfacc15 : 0x00f0ff);
                }
            } else if (child.isLine) {
                child.material.color.setHex(isEndHover ? 0xfacc15 : 0x00f0ff);
                child.material.opacity = isEndHover ? 1.0 : 0.85;
            }
        });

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    _createDOMHUD() {
        if (typeof document === 'undefined') return;
        this.domHUD = document.createElement('div');
        this.domHUD.className = 'sims4-wall-3d-hud';
        this.domHUD.style.cssText = `
            position: absolute;
            display: none;
            transform: translate(-50%, -100%);
            padding: 5px 8px;
            border-radius: 24px;
            background: rgba(15, 23, 42, 0.94);
            border: 2px solid #00f0ff;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 240, 255, 0.4);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
            z-index: 9999;
            backdrop-filter: blur(10px);
            user-select: none;
            gap: 5px;
            align-items: center;
        `;

        this.hudButtons = [
            { id: 'push_pull', label: '↔️ Push / Pull', title: 'Select width on wall face and push/pull thickness with top ledge (Panel #1)' },
            { id: 'corner', label: '📍 Move', title: 'Move wall normal baseline, corner vertices, slopes & heights (Panel #2)' },
            { id: 'extrude_recess', label: '🏛️ Bay / Niche', title: 'Extrude bay window extension & niche recess cavity (Panels #5 & #6)' },
            { id: 'height', label: '📐 Height', title: 'Drag wall height & slopes (Panel #4)' },
            { id: 'split', label: '✂️ Split', title: 'Click to slice wall in 3D (Panel #3)' },
            { id: 'slope', label: '📐 Slope', title: 'Toggle flat / single / gable slope (Panel #7)' }
        ];

        this.buttonElements = {};

        this.hudButtons.forEach(btn => {
            const el = document.createElement('button');
            el.textContent = btn.label;
            el.title = btn.title;
            el.style.cssText = `
                padding: 5px 9px;
                border-radius: 14px;
                border: 1px solid rgba(255, 255, 255, 0.15);
                background: rgba(255, 255, 255, 0.08);
                color: #ffffff;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.15s ease;
                white-space: nowrap;
            `;
            el.onclick = (e) => {
                e.stopPropagation();
                this._handleHUDAction(btn.id);
            };
            this.buttonElements[btn.id] = el;
            this.domHUD.appendChild(el);
        });

        // Close button on menu
        const btnClose = document.createElement('button');
        btnClose.textContent = '✕';
        btnClose.title = 'Deselect wall';
        btnClose.style.cssText = `
            padding: 5px 8px;
            border-radius: 14px;
            border: 1px solid rgba(239, 68, 68, 0.4);
            background: rgba(239, 68, 68, 0.15);
            color: #fca5a5;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        btnClose.onclick = (e) => {
            e.stopPropagation();
            this.detach();
        };
        this.domHUD.appendChild(btnClose);

        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domHUD);
    }

    _createConfirmBar() {
        if (typeof document === 'undefined') return;
        this.domConfirmBar = document.createElement('div');
        this.domConfirmBar.className = 'sims4-wall-confirm-bar';
        this.domConfirmBar.style.cssText = `
            position: absolute;
            display: none;
            transform: translate(-50%, -100%);
            padding: 6px 12px;
            border-radius: 28px;
            background: rgba(15, 23, 42, 0.96);
            border: 2px solid #38bdf8;
            box-shadow: 0 8px 28px rgba(0, 0, 0, 0.7), 0 0 16px rgba(56, 189, 248, 0.4);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
            z-index: 10001;
            backdrop-filter: blur(12px);
            user-select: none;
            gap: 8px;
            align-items: center;
        `;

        this.confirmStatusBadge = document.createElement('span');
        this.confirmStatusBadge.style.cssText = `
            font-size: 12px;
            font-weight: 800;
            color: #38bdf8;
            padding-right: 4px;
        `;
        this.domConfirmBar.appendChild(this.confirmStatusBadge);

        // Sub-Mode Toggle for Push/Pull (Face Thickness vs Move Baseline)
        this.btnPushPullMode = document.createElement('button');
        this.btnPushPullMode.style.cssText = `
            display: none;
            padding: 4px 10px;
            border-radius: 14px;
            border: 1px solid #00f0ff;
            background: rgba(0, 240, 255, 0.2);
            color: #00f0ff;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        this.btnPushPullMode.onclick = (e) => {
            e.stopPropagation();
            const currentMode = this.pushPullGizmo.mode;
            const nextMode = currentMode === 'thickness' ? 'baseline' : 'thickness';
            this.pushPullGizmo.setMode(nextMode);
            this._updatePushPullModeButton();
        };
        this.domConfirmBar.appendChild(this.btnPushPullMode);

        // Cancel Button (Red outline/fill)
        const btnCancel = document.createElement('button');
        btnCancel.textContent = '✕ Cancel';
        btnCancel.title = 'Cancel editing and ignore changes';
        btnCancel.style.cssText = `
            padding: 5px 12px;
            border-radius: 16px;
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
            e.stopPropagation();
            this.cancelChanges();
        };
        this.domConfirmBar.appendChild(btnCancel);

        // Done Button (Emerald Green outline/fill)
        const btnDone = document.createElement('button');
        btnDone.textContent = '✓ Done';
        btnDone.title = 'Apply and keep changes';
        btnDone.style.cssText = `
            padding: 5px 14px;
            border-radius: 16px;
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
            e.stopPropagation();
            this.commitChanges();
        };
        this.domConfirmBar.appendChild(btnDone);

        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domConfirmBar);
    }

    _updatePushPullModeButton() {
        if (!this.btnPushPullMode) return;
        const mode = this.pushPullGizmo?.mode || 'thickness';
        if (mode === 'thickness') {
            this.btnPushPullMode.textContent = '🧱 Mode: Face Thickness (Panel #1)';
            this.btnPushPullMode.title = 'Click to switch to Room Baseline Move (or press Tab)';
            this.btnPushPullMode.style.borderColor = '#00f0ff';
            this.btnPushPullMode.style.color = '#00f0ff';
            this.btnPushPullMode.style.background = 'rgba(0, 240, 255, 0.2)';
        } else {
            this.btnPushPullMode.textContent = '🏠 Mode: Move Baseline (Room Resizing)';
            this.btnPushPullMode.title = 'Click to switch to Face Thickness Push/Pull (or press Tab)';
            this.btnPushPullMode.style.borderColor = '#facc15';
            this.btnPushPullMode.style.color = '#facc15';
            this.btnPushPullMode.style.background = 'rgba(250, 204, 21, 0.2)';
        }
    }

    _createLiveBadges() {
        if (typeof document === 'undefined') return;
        this.splitBadge = document.createElement('div');
        this.splitBadge.className = 'sims4-split-live-badge';
        this.splitBadge.style.cssText = `
            position: absolute;
            display: none;
            transform: translate(-50%, -100%);
            padding: 5px 12px;
            border-radius: 12px;
            background: rgba(239, 68, 68, 0.94);
            border: 2px solid #ffffff;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 14px rgba(239, 68, 68, 0.6);
            color: #ffffff;
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 800;
            white-space: nowrap;
            pointer-events: none;
            z-index: 10000;
            user-select: none;
        `;

        this.extrudeBadge = document.createElement('div');
        this.extrudeBadge.className = 'sims4-extrude-live-badge';
        this.extrudeBadge.style.cssText = `
            position: absolute;
            display: none;
            transform: translate(-50%, -100%);
            padding: 5px 12px;
            border-radius: 12px;
            background: rgba(16, 185, 129, 0.94);
            border: 2px solid #ffffff;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 14px rgba(16, 185, 129, 0.6);
            color: #ffffff;
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 800;
            white-space: nowrap;
            pointer-events: none;
            z-index: 10000;
            user-select: none;
        `;

        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.splitBadge);
        container.appendChild(this.extrudeBadge);
    }

    _refreshHUDButtonStates() {
        Object.keys(this.buttonElements).forEach(id => {
            const el = this.buttonElements[id];
            if (id === this.activeMode) {
                el.style.background = '#0ea5e9';
                el.style.borderColor = '#38bdf8';
                el.style.color = '#ffffff';
                el.style.boxShadow = '0 0 10px rgba(14, 165, 233, 0.5)';
            } else {
                el.style.background = 'rgba(255, 255, 255, 0.08)';
                el.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                el.style.color = '#cbd5e1';
                el.style.boxShadow = 'none';
            }
        });
    }

    _handleHUDAction(actionId) {
        if (!this.target) return;
        this.setMode(actionId);
    }

    setMode(mode) {
        mode = mode || 'menu';
        this.activeMode = mode;
        this.isSplitMode = (mode === 'split');

        if (mode === 'menu' || mode === 'neutral') {
            this.pushPullGizmo.detach();
            this.cornerGizmo.detach();
            this.heightGizmo.detach();
            this._hideSplitLaser();
            this._hideExtrudeGhost();
            if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
            if (this.domHUD) this.domHUD.style.display = 'flex';
            this._refreshHUDButtonStates();
            if (this.ctx.requestRender) this.ctx.requestRender();
            return;
        }

        // Active editing mode: Hide top menu HUD, show confirmation bar
        if (this.domHUD) this.domHUD.style.display = 'none';
        if (this.ctx.gizmoManager?.transformMenu) {
            this.ctx.gizmoManager.transformMenu.style.display = 'none';
        }
        if (this.domConfirmBar) {
            const labels = {
                push_pull: '↔️ Push / Pull',
                corner: '📍 Move (Wall Normal, Vertices, Heights & Slopes)',
                extrude_recess: '🏛️ Bay / Niche (Extrude Bay Window & Niche Recess)',
                height: '📐 Height & Slope',
                split: '✂️ Wall Split',
                slope: '📐 Slope Toggle'
            };
            this.confirmStatusBadge.textContent = labels[mode] || 'Editing';
            if (this.btnPushPullMode) this.btnPushPullMode.style.display = 'none';
            this.domConfirmBar.style.display = 'flex';
        }
        this._updateHUDPosition();

        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        if (planner && planner.commandManager) {
            this._snapshotCmd = new SnapshotCommand(planner);
        }

        const wall = this.target?.userData?.entity;
        if (wall) {
            this._initialWallSnapshot = {
                startX: wall.startX,
                startY: wall.startY,
                endX: wall.endX,
                endY: wall.endY,
                startAnchorPos: (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? { ...wall.startAnchor.position() } : null,
                endAnchorPos: (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? { ...wall.endAnchor.position() } : null,
                height: wall.height,
                thickness: wall.thickness,
                elevation: wall.elevation,
                topProfileType: wall.topProfileType,
                startHeight: wall.startHeight,
                endHeight: wall.endHeight,
                peakHeight: wall.peakHeight
            };
        }

        if (mode === 'push_pull') {
            this.pushPullGizmo.attach(this.target);
            this.cornerGizmo.detach();
            this.heightGizmo.detach();
            this._hideSplitLaser();
            this._hideExtrudeGhost();
        } else if (mode === 'extrude_recess') {
            this.pushPullGizmo.detach();
            this.cornerGizmo.detach();
            this.heightGizmo.detach();
            this._hideSplitLaser();
            this.extrudeCurrentDepth = 0; // Neutral 0cm start on entry
            this._showExtrudeGhost();
        } else if (mode === 'height') {
            this.pushPullGizmo.detach();
            this.cornerGizmo.detach();
            this.heightGizmo.attach(this.target);
            this._hideSplitLaser();
            this._hideExtrudeGhost();
        } else if (mode === 'corner') {
            this.pushPullGizmo.detach();
            this.cornerGizmo.attach(this.target);
            this.heightGizmo.detach();
            this._hideSplitLaser();
            this._hideExtrudeGhost();
        } else if (mode === 'split') {
            this.pushPullGizmo.detach();
            this.cornerGizmo.detach();
            this.heightGizmo.detach();
            this._showSplitLaser();
            this._hideExtrudeGhost();
        } else if (mode === 'slope') {
            if (wall) {
                const planner = this.ctx.planner || window.plannerInstance;
                const baseH = wall.height || 120;
                if (!wall.topProfileType || wall.topProfileType === 'normal') {
                    WallEngine.setTopProfile(wall, 'single', {
                        startHeight: baseH,
                        endHeight: baseH * 1.5
                    }, true, planner);
                } else if (wall.topProfileType === 'single') {
                    WallEngine.setTopProfile(wall, 'gable', {
                        peakHeight: baseH * 1.6
                    }, true, planner);
                } else {
                    WallEngine.setTopProfile(wall, 'normal', {}, true, planner);
                }
                if (typeof this.ctx.updateWallGeometryLive === 'function') {
                    this.ctx.updateWallGeometryLive(wall);
                }
            }
            this.pushPullGizmo.detach();
            this.cornerGizmo.detach();
            this.heightGizmo.attach(this.target);
            this._hideSplitLaser();
            this._hideExtrudeGhost();
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    commitChanges() {
        const mode = this.activeMode;
        if (this.target) this.target.visible = true;

        if (mode === 'push_pull' && this.pushPullGizmo) {
            this.pushPullGizmo.commit();
            this.detach();
            return;
        }

        if (mode === 'extrude_recess') {
            const depth = this.extrudeCurrentDepth;
            if (Math.abs(depth) >= 5) {
                const effectiveDepth = depth * (this.activeFacing || 1);
                this.extrudeWall(effectiveDepth, this.extrudeStartT, this.extrudeEndT);
                return;
            }
        } else if (mode === 'split' && this.splitCurrentHit) {
            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
            const wall = this.target?.userData?.entity;
            if (planner && wall) {
                const cmd = new SnapshotCommand(planner);
                const subWalls = WallReformer.splitWallAtPoint(planner, wall, { x: this.splitCurrentHit.x, y: this.splitCurrentHit.z });
                if (subWalls && planner.commandManager) {
                    planner.commandManager.execute(cmd);
                    if (this.ctx.buildScene) {
                        this.ctx.preventAutoFocus = true;
                        this.ctx.buildScene(
                            planner.walls,
                            planner.rooms,
                            planner.stairs,
                            planner.furniture,
                            planner.roofs,
                            planner.shapes,
                            planner.levels || [],
                            planner.activeLevelIndex || 0,
                            this.ctx.viewMode3D || 'full-edit',
                            true
                        );
                        this.ctx.preventAutoFocus = false;
                    }
                }
            }
            this.detach();
            return;
        }

        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        if (planner && this._snapshotCmd && planner.commandManager) {
            if (this._snapshotCmd.finalize()) {
                planner.commandManager.execute(this._snapshotCmd);
            }
        }
        this._snapshotCmd = null;
        this._initialWallSnapshot = null;

        const wall = this.target?.userData?.entity;
        if (wall) {
            coreEventBus.emit(EVENTS.WALL_CHANGE, { entity: wall });
        }

        // Clean finish without showing any leftover floating arrows
        this.detach();
    }

    cancelChanges() {
        if (this.target) this.target.visible = true;
        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;

        if (this.activeMode === 'push_pull' && this.pushPullGizmo) {
            this.pushPullGizmo.cancel();
        }

        if (this._snapshotCmd) {
            this._snapshotCmd.undo();
            this._snapshotCmd = null;

            if (this.ctx.buildScene && planner) {
                this.ctx.preventAutoFocus = true;
                this.ctx.buildScene(
                    planner.walls,
                    planner.rooms,
                    planner.stairs,
                    planner.furniture,
                    planner.roofs,
                    planner.shapes,
                    planner.levels || [],
                    planner.activeLevelIndex || 0,
                    this.ctx.viewMode3D || 'full-edit',
                    true
                );
                this.ctx.preventAutoFocus = false;
            }
        } else if (this.target?.userData?.entity && this._initialWallSnapshot) {
            const wall = this.target.userData.entity;
            const snap = this._initialWallSnapshot;
            const planner = this.ctx.planner || window.plannerInstance;

            if (wall.startAnchor && snap.startAnchorPos) {
                WallEngine.moveAnchor(wall.startAnchor, snap.startAnchorPos, planner, false);
            }
            if (wall.endAnchor && snap.endAnchorPos) {
                WallEngine.moveAnchor(wall.endAnchor, snap.endAnchorPos, planner, false);
            }

            WallEngine.batchUpdate(planner, [wall], {
                height: snap.height,
                thickness: snap.thickness,
                elevation: snap.elevation,
                topProfileType: snap.topProfileType,
                startHeight: snap.startHeight,
                endHeight: snap.endHeight,
                peakHeight: snap.peakHeight
            });

            if (typeof this.ctx.updateWallGeometryLive === 'function') {
                try { this.ctx.updateWallGeometryLive(wall); } catch(err) {}
            }
            if (typeof this.ctx.rebuildActiveFloors === 'function') {
                try { this.ctx.rebuildActiveFloors(); } catch(err) {}
            }
        }
        this._initialWallSnapshot = null;
        this.extrudeCurrentDepth = 0;
        this._hideExtrudeGhost();

        // Clean finish without showing any leftover floating arrows
        this.detach();
    }

    _showSplitLaser() {
        this.splitLaserPlane.visible = true;
        if (this.splitBadge) this.splitBadge.style.display = 'block';
    }

    _hideSplitLaser() {
        this.splitLaserPlane.visible = false;
        if (this.splitBadge) this.splitBadge.style.display = 'none';
    }

    _showExtrudeGhost() {
        this.extrudeGroup.visible = true;
        this._updateExtrudeGhostGeometry();
    }

    _hideExtrudeGhost() {
        this.extrudeGroup.visible = false;
        if (this.bayPreviewGroup) {
            while (this.bayPreviewGroup.children.length > 0) {
                const c = this.bayPreviewGroup.children[0];
                if (c.geometry) c.geometry.dispose();
                this.bayPreviewGroup.remove(c);
            }
        }
        if (this.extrudeBadge) this.extrudeBadge.style.display = 'none';
    }

    _updateExtrudeGhostGeometry() {
        const wall = this.target?.userData?.entity;
        if (!wall) return;

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
        const wallBaseY = (wall.elevation || 0);
        const wallH = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));
        const t = (wall.thickness !== undefined ? wall.thickness : 20);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const wallLen = Math.hypot(dx, dy);
        if (wallLen < 1) return;

        const angle = Math.atan2(dy, dx);

        // Place extrudeGroup in wall's local coordinate space
        this.extrudeGroup.position.set(p1.x, wallBaseY, p1.y);
        this.extrudeGroup.rotation.set(0, -angle, 0);

        const tStart = Math.min(this.extrudeStartT, this.extrudeEndT - 0.05);
        const tEnd = Math.max(this.extrudeEndT, this.extrudeStartT + 0.05);
        const bayLen = Math.max(10, wallLen * (tEnd - tStart));
        const depth = this.extrudeCurrentDepth;

        // Line-of-sight auto-facing detection
        const wallMidX = p1.x + (tStart + tEnd) * 0.5 * dx;
        const wallMidZ = p1.y + (tStart + tEnd) * 0.5 * dy;
        const camPos = this.ctx.camera ? this.ctx.camera.position : new THREE.Vector3();
        const nx = -dy / wallLen;
        const ny = dx / wallLen;
        const dot = (camPos.x - wallMidX) * nx + (camPos.z - wallMidZ) * ny;
        const facing = dot >= 0 ? 1 : -1;
        this.currentFacing = facing;

        const startX = tStart * wallLen;
        const endX = tEnd * wallLen;
        const midX = (tStart + tEnd) * 0.5 * wallLen;
        const midY = wallH / 2;
        const surfaceZ = (t / 2) * facing;

        // Ensure ghost meshes never block raycasting to handles
        this.extrudeGhostMesh.raycast = () => {};
        this.extrudeOutline.raycast = () => {};

        // Clear previous bay preview geometry
        while (this.bayPreviewGroup.children.length > 0) {
            const c = this.bayPreviewGroup.children[0];
            if (c.geometry) c.geometry.dispose();
            this.bayPreviewGroup.remove(c);
        }

        // Hide legacy flat ghost box and outline
        this.extrudeGhostMesh.visible = false;
        this.extrudeOutline.visible = false;

        if (depth !== 0) {
            // Temporarily hide original host wall so the middle cutout is completely open
            if (this.target) this.target.visible = false;

            // (1) Left Remaining Host Wall Wing
            if (startX > 2) {
                const leftWingGeo = new THREE.BoxGeometry(startX, wallH, t);
                const leftWingMesh = new THREE.Mesh(leftWingGeo, this.matBayWall);
                leftWingMesh.position.set(startX / 2, midY, 0);
                leftWingMesh.raycast = () => {};

                const leftWingEdges = new THREE.LineSegments(
                    new THREE.EdgesGeometry(leftWingGeo),
                    new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 1.5, depthTest: false })
                );
                leftWingEdges.position.copy(leftWingMesh.position);
                leftWingEdges.raycast = () => {};
                this.bayPreviewGroup.add(leftWingMesh, leftWingEdges);
            }

            // (2) Right Remaining Host Wall Wing
            const rightWingLen = wallLen - endX;
            if (rightWingLen > 2) {
                const rightWingGeo = new THREE.BoxGeometry(rightWingLen, wallH, t);
                const rightWingMesh = new THREE.Mesh(rightWingGeo, this.matBayWall);
                rightWingMesh.position.set(endX + rightWingLen / 2, midY, 0);
                rightWingMesh.raycast = () => {};

                const rightWingEdges = new THREE.LineSegments(
                    new THREE.EdgesGeometry(rightWingGeo),
                    new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 1.5, depthTest: false })
                );
                rightWingEdges.position.copy(rightWingMesh.position);
                rightWingEdges.raycast = () => {};
                this.bayPreviewGroup.add(rightWingMesh, rightWingEdges);
            }

            if (depth > 0) {
                // --- 1. Outward 3D Bay Window Assembly ---
                const bayThick = t;
                const extDepth = depth;

                // (a) Front Extruded Wall
                const frontGeo = new THREE.BoxGeometry(bayLen, wallH, bayThick);
                const frontMesh = new THREE.Mesh(frontGeo, this.matBayWall);
                frontMesh.position.set(midX, midY, (extDepth + bayThick / 2) * facing);
                frontMesh.raycast = () => {};

                const frontEdges = new THREE.LineSegments(
                    new THREE.EdgesGeometry(frontGeo),
                    new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2, depthTest: false })
                );
                frontEdges.position.copy(frontMesh.position);
                frontEdges.raycast = () => {};
                this.bayPreviewGroup.add(frontMesh, frontEdges);

                // (b) Left Return Wall (perpendicular 90 degrees)
                const leftReturnGeo = new THREE.BoxGeometry(bayThick, wallH, extDepth);
                const leftReturnMesh = new THREE.Mesh(leftReturnGeo, this.matBayWall);
                leftReturnMesh.position.set(startX + bayThick / 2, midY, (extDepth / 2) * facing);
                leftReturnMesh.raycast = () => {};

                const leftEdges = new THREE.LineSegments(
                    new THREE.EdgesGeometry(leftReturnGeo),
                    new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2, depthTest: false })
                );
                leftEdges.position.copy(leftReturnMesh.position);
                leftEdges.raycast = () => {};
                this.bayPreviewGroup.add(leftReturnMesh, leftEdges);

                // (c) Right Return Wall (perpendicular 90 degrees)
                const rightReturnGeo = new THREE.BoxGeometry(bayThick, wallH, extDepth);
                const rightReturnMesh = new THREE.Mesh(rightReturnGeo, this.matBayWall);
                rightReturnMesh.position.set(endX - bayThick / 2, midY, (extDepth / 2) * facing);
                rightReturnMesh.raycast = () => {};

                const rightEdges = new THREE.LineSegments(
                    new THREE.EdgesGeometry(rightReturnGeo),
                    new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2, depthTest: false })
                );
                rightEdges.position.copy(rightReturnMesh.position);
                rightEdges.raycast = () => {};
                this.bayPreviewGroup.add(rightReturnMesh, rightEdges);

                // (d) Bay Room Floor Extension Slab
                const innerW = Math.max(1, bayLen - bayThick * 2);
                const floorGeo = new THREE.BoxGeometry(innerW, 2, extDepth);
                const floorMesh = new THREE.Mesh(floorGeo, this.matBayFloor);
                floorMesh.position.set(midX, 1, (extDepth / 2) * facing);
                floorMesh.raycast = () => {};

                const floorEdges = new THREE.LineSegments(
                    new THREE.EdgesGeometry(floorGeo),
                    new THREE.LineBasicMaterial({ color: 0x34d399, linewidth: 1, depthTest: false })
                );
                floorEdges.position.copy(floorMesh.position);
                floorEdges.raycast = () => {};
                this.bayPreviewGroup.add(floorMesh, floorEdges);

                // (e) Luminous interior room void
                const voidGeo = new THREE.BoxGeometry(innerW, wallH, extDepth);
                const voidMesh = new THREE.Mesh(voidGeo, this.matBayVoid);
                voidMesh.position.set(midX, midY, (extDepth / 2) * facing);
                voidMesh.raycast = () => {};
                this.bayPreviewGroup.add(voidMesh);

            } else {
                // --- 2. Inward 3D Wall Niche Assembly ---
                const absDepth = Math.abs(depth);
                const recessDepth = Math.min(t - 1, absDepth);
                const remainingThick = Math.max(1, t - recessDepth);

                // (a) Recessed Back Wall Panel
                const backGeo = new THREE.BoxGeometry(bayLen, wallH, remainingThick);
                const backMesh = new THREE.Mesh(backGeo, this.matBayWall);
                backMesh.position.set(midX, midY, surfaceZ - (recessDepth + remainingThick / 2) * facing);
                backMesh.raycast = () => {};

                const backEdges = new THREE.LineSegments(
                    new THREE.EdgesGeometry(backGeo),
                    new THREE.LineBasicMaterial({ color: 0xa855f7, linewidth: 2, depthTest: false })
                );
                backEdges.position.copy(backMesh.position);
                backEdges.raycast = () => {};
                this.bayPreviewGroup.add(backMesh, backEdges);

                // (b) Niche Jamb Returns & Void Box
                const nicheVoidGeo = new THREE.BoxGeometry(bayLen, wallH, recessDepth);
                const nicheVoidMesh = new THREE.Mesh(nicheVoidGeo, new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.25, depthTest: false, side: THREE.DoubleSide }));
                nicheVoidMesh.position.set(midX, midY, surfaceZ - (recessDepth / 2) * facing);
                nicheVoidMesh.raycast = () => {};

                const nicheEdges = new THREE.LineSegments(
                    new THREE.EdgesGeometry(nicheVoidGeo),
                    new THREE.LineBasicMaterial({ color: 0xc084fc, linewidth: 2, depthTest: false })
                );
                nicheEdges.position.copy(nicheVoidMesh.position);
                nicheEdges.raycast = () => {};
                this.bayPreviewGroup.add(nicheVoidMesh, nicheEdges);
            }
        } else {
            // Restore host wall visibility when at neutral 0cm
            if (this.target) this.target.visible = true;

            // --- 3. Neutral 0cm Selection Boundary ---
            const neutralGeo = new THREE.BoxGeometry(bayLen, wallH, t + 0.8);
            const neutralMesh = new THREE.Mesh(neutralGeo, this.matNeutralGhost);
            neutralMesh.position.set(midX, midY, 0);
            neutralMesh.raycast = () => {};

            const neutralEdges = new THREE.LineSegments(
                new THREE.EdgesGeometry(neutralGeo),
                new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2, depthTest: false })
            );
            neutralEdges.position.copy(neutralMesh.position);
            neutralEdges.raycast = () => {};
            this.bayPreviewGroup.add(neutralMesh, neutralEdges);
        }

        // Update Center Depth Handle (Push/Pull Arrow) on the viewing face
        const handleZ = facing === 1
            ? (depth >= 0 ? (surfaceZ + depth + 8) : (surfaceZ + depth - 8))
            : (depth >= 0 ? (surfaceZ - depth - 8) : (surfaceZ - depth + 8));
        this.extrudeHandle.position.set(midX, midY, handleZ);
        this.extrudeHandle.rotation.set(0, facing === 1 ? 0 : Math.PI, 0);

        // Update Left Boundary Handle & Vertical Laser Cut Line
        this.extrudeStartHandle.position.set(startX, midY, surfaceZ + 2 * facing);
        this.extrudeStartHandle.rotation.set(0, facing === 1 ? 0 : Math.PI, 0);
        this._updateBoundaryLine(this.extrudeStartHandle, wallH);

        // Update Right Boundary Handle & Vertical Laser Cut Line
        this.extrudeEndHandle.position.set(endX, midY, surfaceZ + 2 * facing);
        this.extrudeEndHandle.rotation.set(0, facing === 1 ? 0 : Math.PI, 0);
        this._updateBoundaryLine(this.extrudeEndHandle, wallH);

        // Update Floating HUD Badge Position (Project 3D handle position to Screen)
        if (this.extrudeBadge) {
            const worldPos = new THREE.Vector3(midX, midY + wallH / 2 + 16, handleZ);
            this.extrudeGroup.localToWorld(worldPos);
            worldPos.project(this.ctx.camera);

            const dom = this.ctx.renderer.domElement;
            const rect = dom.getBoundingClientRect();
            const screenX = ((worldPos.x + 1) * rect.width) / 2;
            const screenY = ((-worldPos.y + 1) * rect.height) / 2;

            if (depth > 0) {
                this.extrudeBadge.style.background = 'rgba(16, 185, 129, 0.95)';
                this.extrudeBadge.style.borderColor = '#34d399';
                this.extrudeBadge.textContent = `🏛️ Bay Window (+${Math.round(depth)} cm) · Width: ${Math.round(bayLen)} cm — Click [✓ Done] to Apply or [✕ Cancel]`;
            } else if (depth < 0) {
                const remainingCore = Math.round(t - Math.abs(depth));
                if (remainingCore >= 0) {
                    this.extrudeBadge.style.background = 'rgba(168, 85, 247, 0.95)';
                    this.extrudeBadge.style.borderColor = '#c084fc';
                    this.extrudeBadge.textContent = `🔲 Wall Niche (${Math.round(depth)} cm) · Width: ${Math.round(bayLen)} cm · Core: ${remainingCore} cm — Click [✓ Done] to Apply or [✕ Cancel]`;
                } else {
                    this.extrudeBadge.style.background = 'rgba(239, 68, 68, 0.95)';
                    this.extrudeBadge.style.borderColor = '#fca5a5';
                    this.extrudeBadge.textContent = `⚠️ Niche (${Math.round(depth)} cm) Exceeds Wall Thickness (${t} cm) — Click [✓ Done] to Apply or [✕ Cancel]`;
                }
            } else {
                this.extrudeBadge.style.background = 'rgba(15, 23, 42, 0.95)';
                this.extrudeBadge.style.borderColor = '#00f0ff';
                this.extrudeBadge.textContent = `↔️ Drag Center Arrow (+Bay / -Niche) or Side Brackets · Width: ${Math.round(bayLen)} cm`;
            }

            this.extrudeBadge.style.left = `${screenX}px`;
            this.extrudeBadge.style.top = `${screenY - 24}px`;
            this.extrudeBadge.style.display = 'block';
        }
    }

    _onPointerMove(e) {
        if (!this.target) return;

        const dom = this.ctx.renderer.domElement;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (this.isSplitMode) {
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const wall = this.target.userData?.entity;
            if (!wall) return;

            const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
            const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
            const wallBaseY = (wall.elevation || 0);
            const wallH = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));
            const t = (wall.thickness !== undefined ? wall.thickness : 20);

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const wallLen = Math.hypot(dx, dy);
            if (wallLen < 1) return;

            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -wallBaseY);
            const hitPt = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(plane, hitPt)) {
                const projT = ((hitPt.x - p1.x) * dx + (hitPt.z - p1.y) * dy) / (wallLen * wallLen);
                const clampedT = Math.max(0.1, Math.min(0.9, projT));
                this.splitCurrentT = clampedT;

                const sliceX = p1.x + clampedT * dx;
                const sliceZ = p1.y + clampedT * dy;
                const sliceY = wallBaseY + wallH / 2;

                const wallAngle = Math.atan2(dy, dx);
                this.splitLaserPlane.geometry.dispose();
                this.splitLaserPlane.geometry = new THREE.PlaneGeometry(t + 14, wallH + 10);
                this.splitLaserPlane.position.set(sliceX, sliceY, sliceZ);
                this.splitLaserPlane.rotation.set(0, -wallAngle + Math.PI / 2, 0);
                this.splitLaserPlane.visible = true;

                if (this.splitBadge) {
                    const screenX = ((this.mouse.x + 1) * rect.width) / 2;
                    const screenY = ((-this.mouse.y + 1) * rect.height) / 2;
                    const splitDist = Math.round(wallLen * clampedT);
                    this.splitBadge.textContent = `✂️ Click to Split at ${splitDist} cm (Remaining: ${Math.round(wallLen - splitDist)} cm)`;
                    this.splitBadge.style.left = `${screenX}px`;
                    this.splitBadge.style.top = `${screenY - 24}px`;
                    this.splitBadge.style.display = 'block';
                }

                if (this.ctx.requestRender) this.ctx.requestRender();
            }
        } else if (this.isExtrudeDragging) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const currentPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragPlane, currentPoint)) {
                const wall = this.target?.userData?.entity;
                if (!wall) return;
                const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
                const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const wallLen = Math.hypot(dx, dy);
                if (wallLen < 1) return;

                const dirX = dx / wallLen;
                const dirZ = dy / wallLen;
                const nx = -dy / wallLen;
                const ny = dx / wallLen;
                const facing = this.activeFacing || 1;

                const deltaX = currentPoint.x - this.dragStartPoint.x;
                const deltaZ = currentPoint.z - this.dragStartPoint.z;

                const isFine = e.shiftKey;
                const snap = isFine ? 0.5 : 1.0; // 1cm precision snap for smooth CAD interaction

                if (this.activeExtrudePart === 'boundary_start') {
                    const deltaAlongWall = deltaX * dirX + deltaZ * dirZ;
                    const deltaT = deltaAlongWall / wallLen;
                    const minSpanT = Math.min(0.15, 20 / wallLen);
                    const newStartT = Math.max(0.02, Math.min(this.initialEndT - minSpanT, this.initialStartT + deltaT));
                    this.extrudeStartT = Math.round(newStartT * 100) / 100;
                } else if (this.activeExtrudePart === 'boundary_end') {
                    const deltaAlongWall = deltaX * dirX + deltaZ * dirZ;
                    const deltaT = deltaAlongWall / wallLen;
                    const minSpanT = Math.min(0.15, 20 / wallLen);
                    const newEndT = Math.min(0.98, Math.max(this.initialStartT + minSpanT, this.initialEndT + deltaT));
                    this.extrudeEndT = Math.round(newEndT * 100) / 100;
                } else if (this.activeExtrudePart === 'slide_center') {
                    const deltaAlongWall = deltaX * dirX + deltaZ * dirZ;
                    const deltaT = deltaAlongWall / wallLen;
                    const span = this.initialEndT - this.initialStartT;
                    let newStartT = this.initialStartT + deltaT;
                    let newEndT = this.initialEndT + deltaT;
                    if (newStartT < 0.02) {
                        newStartT = 0.02;
                        newEndT = 0.02 + span;
                    } else if (newEndT > 0.98) {
                        newEndT = 0.98;
                        newStartT = 0.98 - span;
                    }
                    this.extrudeStartT = Math.round(newStartT * 100) / 100;
                    this.extrudeEndT = Math.round(newEndT * 100) / 100;
                } else {
                    // Depth adjustment (Outward/Inward relative to camera-facing wall side)
                    let rawDist = (deltaX * nx + deltaZ * ny) * facing;
                    const steppedDelta = Math.round(rawDist / snap) * snap;
                    const newDepth = this.initialExtrudeDepth + steppedDelta;
                    // Clamp between -100cm (niche) and +150cm (bay)
                    this.extrudeCurrentDepth = Math.max(-100, Math.min(150, newDepth));
                }

                this._updateExtrudeGhostGeometry();
                if (this.ctx.requestRender) this.ctx.requestRender();
            }
        } else if (this.activeMode === 'push_pull' || this.activeMode === 'extrude_recess') {
            // Hover cursor and illumination feedback
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const handleObjects = [this.extrudeHandle, this.extrudeStartHandle, this.extrudeEndHandle];
            const intersects = this.raycaster.intersectObjects(handleObjects, true);
            if (intersects.length > 0) {
                let hitObj = intersects[0].object;
                let part = hitObj.userData?.part;
                while (hitObj && !part && hitObj.parent && hitObj.parent !== this.extrudeGroup) {
                    hitObj = hitObj.parent;
                    part = hitObj.userData?.part;
                }
                this._setHandleHighlight(part);
                if (part === 'boundary_start' || part === 'boundary_end') {
                    this.ctx.renderer.domElement.style.cursor = 'ew-resize';
                } else if (part === 'slide_center') {
                    this.ctx.renderer.domElement.style.cursor = 'grab';
                } else if (part === 'depth_out' || part === 'depth_in' || part === 'depth_center') {
                    this.ctx.renderer.domElement.style.cursor = 'ns-resize';
                }
            } else {
                this._setHandleHighlight(null);
                this.ctx.renderer.domElement.style.cursor = 'auto';
            }
        }
    }

    _onPointerDown(e) {
        if (!this.target) return;

        if (this.isSplitMode) {
            if (e.button !== 0) return;
            const wall = this.target.userData?.entity;
            if (!wall) return;

            const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
            const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;

            const splitX = p1.x + this.splitCurrentT * dx;
            const splitZ = p1.y + this.splitCurrentT * dy;

            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            this.splitWall({ x: splitX, y: 0, z: splitZ });
            return;
        }

        if (this.activeMode === 'push_pull' || this.activeMode === 'extrude_recess') {
            if (e.button !== 0) return;
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const handleObjects = [this.extrudeHandle, this.extrudeStartHandle, this.extrudeEndHandle];
            const intersects = this.raycaster.intersectObjects(handleObjects, true);
            if (intersects.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();

                let hitObj = intersects[0].object;
                let part = hitObj.userData?.part;
                while (hitObj && !part && hitObj.parent && hitObj.parent !== this.extrudeGroup) {
                    hitObj = hitObj.parent;
                    part = hitObj.userData?.part;
                }
                this.activeExtrudePart = part || 'depth_center';
                this.activeFacing = this.currentFacing || 1;

                const hitPoint = intersects[0].point;
                const camDir = new THREE.Vector3();
                this.ctx.camera.getWorldDirection(camDir);

                // Horizontal ground drag plane through the 3D hit point for smooth 1:1 cursor tracking
                this.dragPlane.setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 1, 0),
                    hitPoint
                );
                this.dragStartPoint.copy(hitPoint);
                this.initialExtrudeDepth = this.extrudeCurrentDepth;
                this.initialStartT = this.extrudeStartT;
                this.initialEndT = this.extrudeEndT;

                this.isExtrudeDragging = true;
                this._capturedPointerId = e.pointerId;
                if (e.target && typeof e.target.setPointerCapture === 'function') {
                    try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
                }
                if (this.ctx.controls) this.ctx.controls.enabled = false;
                this.ctx.renderer.domElement.style.cursor = 'grabbing';
            }
        }
    }

    _onPointerUp(e) {
        if (this.isExtrudeDragging) {
            this.isExtrudeDragging = false;
            this.activeExtrudePart = null;
            if (this._capturedPointerId !== null && e.target && typeof e.target.releasePointerCapture === 'function') {
                try { e.target.releasePointerCapture(this._capturedPointerId); } catch(err) {}
                this._capturedPointerId = null;
            }
            if (this.ctx.controls) this.ctx.controls.enabled = true;
            this.ctx.renderer.domElement.style.cursor = 'auto';
            this._setHandleHighlight(null);

            // Keep the exact 3D preview and Done/Cancel confirmation bar visible!
            // The wall is only committed when the user clicks [✓ Done].
            this._updateExtrudeGhostGeometry();
            this._updateHUDPosition();
            if (this.ctx.requestRender) this.ctx.requestRender();
        }
    }

    _onCameraChange() {
        this._updateHUDPosition();
        if (this.activeMode === 'push_pull' || this.activeMode === 'extrude_recess') {
            this._updateExtrudeGhostGeometry();
        }
    }

    _updateHUDPosition() {
        if ((!this.domHUD && !this.domConfirmBar) || !this.target || !this.ctx.camera || !this.ctx.renderer) return;

        const wall = this.target.userData?.entity;
        if (!wall) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
            return;
        }

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
        const wallBaseY = (wall.elevation || 0);
        const wallH = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));

        const mid3D = new THREE.Vector3(
            (p1.x + p2.x) / 2,
            wallBaseY + wallH + 18,
            (p1.y + p2.y) / 2
        );

        // Project 3D vector to screen 2D
        mid3D.project(this.ctx.camera);
        if (mid3D.z > 1) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
            return;
        }

        const dom = this.ctx.renderer.domElement;
        const rect = dom.getBoundingClientRect();
        const screenX = ((mid3D.x + 1) * rect.width) / 2;
        const screenY = ((-mid3D.y + 1) * rect.height) / 2;

        if (this.domHUD && this.activeMode === 'menu') {
            this.domHUD.style.left = `${screenX}px`;
            this.domHUD.style.top = `${screenY - 14}px`;
            this.domHUD.style.display = 'flex';
        }
        if (this.domConfirmBar && this.activeMode !== 'menu') {
            this.domConfirmBar.style.left = `${screenX}px`;
            this.domConfirmBar.style.top = `${screenY - 14}px`;
            this.domConfirmBar.style.display = 'flex';
        }
    }

    attach(wallMesh, mode = 'menu') {
        this.target = wallMesh;
        this.setMode(mode || 'menu');
        this._updateHUDPosition();
    }

    detach() {
        this.target = null;
        this.pushPullGizmo.detach();
        this.cornerGizmo.detach();
        this.heightGizmo.detach();
        this._hideSplitLaser();
        this._hideExtrudeGhost();
        if (this.domHUD) this.domHUD.style.display = 'none';
        if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
        this._snapshotCmd = null;
        this._initialWallSnapshot = null;
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    updateHandles() {
        if (this.pushPullGizmo.visible) this.pushPullGizmo.updateHandles();
        if (this.cornerGizmo.visible) this.cornerGizmo.updateHandles();
        if (this.heightGizmo.visible) this.heightGizmo.updateHandles();
        if (this.extrudeGroup.visible) this._updateExtrudeGhostGeometry();
        this._updateHUDPosition();
    }

    /**
     * Split selected wall at a 3D intersection point and retain clean state.
     */
    splitWall(hitPoint) {
        const wall = this.target?.userData?.entity;
        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        if (!wall || !planner) return null;

        const cmd = new SnapshotCommand(planner);
        const subWalls = WallReformer.splitWallAtPoint(planner, wall, { x: hitPoint.x, y: hitPoint.z });
        if (subWalls && planner.commandManager) {
            planner.commandManager.execute(cmd);
            if (this.ctx.buildScene) {
                this.ctx.preventAutoFocus = true;
                this.ctx.buildScene(
                    planner.walls,
                    planner.rooms,
                    planner.stairs,
                    planner.furniture,
                    planner.roofs,
                    planner.shapes,
                    planner.levels || [],
                    planner.activeLevelIndex || 0,
                    this.ctx.viewMode3D || 'full-edit',
                    true
                );
                this.ctx.preventAutoFocus = false;
            }

            // Cleanly finish split without leftover floating arrows
            this.detach();
            return subWalls;
        }
        return null;
    }

    /**
     * Extrude a section of selected wall outward/inward by depth and cleanly finish.
     */
    extrudeWall(depth = 30, tStart = 0.25, tEnd = 0.75) {
        const wall = this.target?.userData?.entity;
        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        if (!wall || !planner) return null;

        const cmd = new SnapshotCommand(planner);
        const newWalls = WallReformer.extrudeWallSegment(planner, wall, tStart, tEnd, depth);
        if (newWalls && planner.commandManager) {
            planner.commandManager.execute(cmd);
            if (this.ctx.buildScene) {
                this.ctx.preventAutoFocus = true;
                this.ctx.buildScene(
                    planner.walls,
                    planner.rooms,
                    planner.stairs,
                    planner.furniture,
                    planner.roofs,
                    planner.shapes,
                    planner.levels || [],
                    planner.activeLevelIndex || 0,
                    this.ctx.viewMode3D || 'full-edit',
                    true
                );
                this.ctx.preventAutoFocus = false;
            }

            // Cleanly finish placement without leaving misplaced floating arrows
            this.detach();
            return newWalls;
        }
        return null;
    }

    dispose() {
        if (this.ctx.controls) {
            this.ctx.controls.removeEventListener('change', this._onCameraChange);
        }
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (this.domHUD && this.domHUD.parentElement) {
            this.domHUD.parentElement.removeChild(this.domHUD);
        }
        if (this.splitBadge && this.splitBadge.parentElement) {
            this.splitBadge.parentElement.removeChild(this.splitBadge);
        }
        if (this.extrudeBadge && this.extrudeBadge.parentElement) {
            this.extrudeBadge.parentElement.removeChild(this.extrudeBadge);
        }
        this.pushPullGizmo.dispose();
        this.cornerGizmo.dispose();
        this.heightGizmo.dispose();
        if (this.splitLaserPlane.geometry) this.splitLaserPlane.geometry.dispose();
        if (this.extrudeGhostMesh.geometry) this.extrudeGhostMesh.geometry.dispose();
        this.detach();
    }
}

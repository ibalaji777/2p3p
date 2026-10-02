import * as THREE from 'three';
import { EVENTS } from '../constants/events.js';
import { coreEventBus } from '../EventBus.js';
import { WallExtenderGizmo } from './WallExtenderGizmo.js';
import { WallCornerVertexGizmo } from './WallCornerVertexGizmo.js';
import { WallHeightGizmo } from './WallHeightGizmo.js';
import { WallReformer } from '../engine2d/WallReformer.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { WallEngine } from '../wall/WallEngine.js';
import { WallGeometryEngine } from '../wall/WallGeometryEngine.js';
import { UnitConverter } from '../units/UnitConverter.js';
import { useSettingsStore } from '../../stores/useSettingsStore.js';

/**
 * WallInteractiveSuite
 * 
 * Central coordinator managing all sms 4-style 3D interactive editing tools for walls:
 * 1. Floating 3D HUD Toolbar directly hovering over the selected wall
 * 2. Dedicated Single-Tool Modes: Extender, Height, Corners, Split Cutter, Unified 3D Bay Extrude & Niche Recess
 * 3. Radiant Glowing Selection Outline Ribbon framing the wall in 3D
 * 4. Interactive 3D Split Cutter Plane tracking mouse along wall length
 * 5. Unified 3D Extrusion & Recess Controller with double-sided drag handles & live ghost volume
 */
export class WallInteractiveSuite extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'WallInteractiveSuite';

        this.extenderGizmo = new WallExtenderGizmo(ctx);
        this.pushPullGizmo = this.extenderGizmo; // backward-compatibility alias
        this.cornerGizmo = new WallCornerVertexGizmo(ctx);
        this.heightGizmo = new WallHeightGizmo(ctx);

        this.add(this.extenderGizmo);
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

        // 3D Wall Ghost Preview Group (for Extender, Vertices, Wall Corner highlights)
        this.wallGhostPreviewGroup = new THREE.Group();
        this.wallGhostPreviewGroup.name = 'WallGhostPreviewGroup';
        this.wallGhostPreviewGroup.renderOrder = 1003;
        this.wallGhostPreviewGroup.visible = false;
        this.add(this.wallGhostPreviewGroup);

        // 3D Extrusion / Recess Ghost Group & Bi-directional Drag Handles
        this.extrudeGroup = new THREE.Group();
        this.extrudeGroup.visible = false;
        this.add(this.extrudeGroup);

        this.matNeutralGhost = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.2, depthTest: false, side: THREE.DoubleSide });
        this.matExtrudeGhost = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.4, depthTest: false });
        this.matRecessGhost = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.4, depthTest: false });
        this.matInvalidGhost = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.45, depthTest: false, side: THREE.DoubleSide });
        this.matInvalidOutline = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2.5, depthTest: false });

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

        this.extrudeStartHandle = this._buildBoundaryHandle('start', 0xf8fafc);
        this.extrudeGroup.add(this.extrudeStartHandle);

        this.extrudeEndHandle = this._buildBoundaryHandle('end', 0xf8fafc);
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
        this.isSplitPinned = false;
        this.splitCurrentHit = null;
        this.isExtrudePinned = false;
        this.isExtenderPinned = false;
        this.isValidPlacement = true;
        this.invalidReason = '';

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
        this._createFloatingTooltip();

        this._onCameraChange = this._onCameraChange.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onInteractionStateChanged = this._onInteractionStateChanged.bind(this);

        if (coreEventBus) {
            coreEventBus.on('InteractionStateChanged', this._onInteractionStateChanged);
        }

        if (this.ctx.controls) {
            this.ctx.controls.addEventListener('change', this._onCameraChange);
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this._onCameraChange);
        }

        const dom = this.ctx.renderer.domElement;
        dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointerup', this._onPointerUp, { passive: false });

        this._onKeyDown = (e) => {
            if (!this.target || this.activeMode === 'menu' || this.activeMode === 'neutral') return;
            if (e.key === 'Enter') {
                e.preventDefault();
                this.commitChanges();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelChanges();
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', this._onKeyDown);
        }
    }

    _isActionActive() {
        const commonTools = this.ctx.commonTools || 
                            this.ctx.preview3D?.commonTools || 
                            this.ctx.interactions?.commonController || 
                            (typeof window !== 'undefined' ? (window.renderer3D?.commonTools || window.planner?.engine3d?.commonTools) : null);
        if (!commonTools) return false;
        if (typeof commonTools.isActionActive === 'function') {
            return commonTools.isActionActive();
        }
        return Boolean(commonTools.activeAction || commonTools.interactionState === 'action_active');
    }

    _onInteractionStateChanged(state) {
        if (state && (state.state === 'action_active' || state.activeAction)) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
            return;
        }
        if (!this.target || !this.visible) return;
        if (state && state.state === 'object_selected' && (state.selectedEntity === this.target.userData?.entity || state.selectedEntity?.id === this.target.userData?.entity?.id)) {
            this.update();
        } else if (state && state.state === 'idle') {
            this.detach();
        }
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
        const discMesh = new THREE.Mesh(discGeo, new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            metalness: 0.35,
            roughness: 0.22,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.95
        }));
        discMesh.userData = { isExtrudeHandle: true, part: 'slide_center' };
        discMesh.renderOrder = 1010;
        group.add(discMesh);

        // 2. White inner accent ring
        const ringGeo = new THREE.TorusGeometry(10, 2, 12, 24);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.35,
            roughness: 0.22,
            depthTest: false,
            depthWrite: false
        }));
        ringMesh.userData = { isExtrudeHandle: true, part: 'slide_center', isRing: true };
        ringMesh.renderOrder = 1011;
        group.add(ringMesh);

        // 3. Outward Arrow (Emerald Green +Z) -> Extrude Bay
        const outGroup = new THREE.Group();
        outGroup.userData = { isExtrudeHandle: true, part: 'depth_out' };
        
        // Invisible generous hit collider for out arrow
        const outHit = new THREE.Mesh(
            new THREE.CylinderGeometry(18, 18, 44, 16),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        outHit.rotation.x = Math.PI / 2;
        outHit.position.z = 24.5;
        outHit.userData = { isExtrudeHandle: true, part: 'depth_out' };
        outGroup.add(outHit);

        const matBay = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            metalness: 0.35,
            roughness: 0.22,
            depthTest: false,
            depthWrite: false
        });

        // 3D Cylindrical Stalk
        const outShaftGeo = new THREE.CylinderGeometry(2.8, 2.8, 24, 16);
        outShaftGeo.rotateX(Math.PI / 2);
        const outShaft = new THREE.Mesh(outShaftGeo, matBay);
        outShaft.position.z = 14.5;
        outShaft.userData = { isExtrudeHandle: true, part: 'depth_out' };
        outShaft.renderOrder = 1010;

        // 3D Flared Conical Arrowhead
        const outHeadGeo = new THREE.ConeGeometry(9.0, 18, 16);
        outHeadGeo.rotateX(Math.PI / 2);
        const outHead = new THREE.Mesh(outHeadGeo, matBay);
        outHead.position.z = 35;
        outHead.userData = { isExtrudeHandle: true, part: 'depth_out' };
        outHead.renderOrder = 1010;

        outGroup.add(outShaft, outHead);
        group.add(outGroup);

        // 4. Inward Arrow (Plain Raiser Pearl-White -Z) -> Recess Niche
        const inGroup = new THREE.Group();
        inGroup.userData = { isExtrudeHandle: true, part: 'depth_in' };

        // Invisible generous hit collider for in arrow
        const inHit = new THREE.Mesh(
            new THREE.CylinderGeometry(18, 18, 44, 16),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        inHit.rotation.x = -Math.PI / 2;
        inHit.position.z = -24.5;
        inHit.userData = { isExtrudeHandle: true, part: 'depth_in' };
        inGroup.add(inHit);

        const matNiche = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            metalness: 0.35,
            roughness: 0.22,
            depthTest: false,
            depthWrite: false
        });

        // 3D Cylindrical Stalk
        const inShaftGeo = new THREE.CylinderGeometry(2.8, 2.8, 24, 16);
        inShaftGeo.rotateX(-Math.PI / 2);
        const inShaft = new THREE.Mesh(inShaftGeo, matNiche);
        inShaft.position.z = -14.5;
        inShaft.userData = { isExtrudeHandle: true, part: 'depth_in' };
        inShaft.renderOrder = 1010;

        // 3D Flared Conical Arrowhead
        const inHeadGeo = new THREE.ConeGeometry(9.0, 18, 16);
        inHeadGeo.rotateX(-Math.PI / 2);
        const inHead = new THREE.Mesh(inHeadGeo, matNiche);
        inHead.position.z = -35;
        inHead.userData = { isExtrudeHandle: true, part: 'depth_in' };
        inHead.renderOrder = 1010;

        inGroup.add(inShaft, inHead);
        group.add(inGroup);

        return group;
    }

    _buildBoundaryHandle(side, color = 0xf8fafc) {
        const group = new THREE.Group();
        const partName = side === 'start' ? 'boundary_start' : 'boundary_end';
        group.userData = { isExtrudeHandle: true, part: partName };
        group.renderOrder = 1010;

        const isStart = side === 'start';
        const sign = isStart ? -1 : 1;

        // Invisible generous hit collider along wall height and bracket
        const hitBox = new THREE.Mesh(
            new THREE.BoxGeometry(44, 120, 24),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        hitBox.name = 'laserHitBox';
        hitBox.position.x = sign * 18;
        hitBox.userData = { isExtrudeHandle: true, part: partName };
        group.add(hitBox);

        // 1. Vertical laser cutting line
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -60, 0),
            new THREE.Vector3(0, 60, 0)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 2, depthTest: false, transparent: true, opacity: 0.75 });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        lineMesh.name = 'laserLine';
        lineMesh.renderOrder = 1009;
        group.add(lineMesh);

        // 2. Boundary central pill grip (Raiser pearl-white brushed chrome)
        const discGeo = new THREE.CylinderGeometry(11, 11, 6, 20);
        discGeo.rotateX(Math.PI / 2);
        const matBase = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.35,
            roughness: 0.22,
            depthTest: false,
            depthWrite: false
        });
        const discMesh = new THREE.Mesh(discGeo, matBase);
        discMesh.userData = { isExtrudeHandle: true, part: partName };
        discMesh.renderOrder = 1010;
        group.add(discMesh);

        // 3. Accent ring
        const ringGeo = new THREE.TorusGeometry(7, 1.6, 12, 20);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.35,
            roughness: 0.22,
            depthTest: false,
            depthWrite: false
        }));
        ringMesh.userData = { isExtrudeHandle: true, part: partName, isRing: true };
        ringMesh.renderOrder = 1011;
        group.add(ringMesh);

        // 4. Direction arrow (Stalk + Cone Head) along wall length (pointing outward away from bay)
        // 3D Stalk
        const stalkGeo = new THREE.CylinderGeometry(2.4, 2.4, 16, 16);
        if (isStart) {
            stalkGeo.rotateZ(Math.PI / 2); // points -X (left, outward)
        } else {
            stalkGeo.rotateZ(-Math.PI / 2); // points +X (right, outward)
        }
        const stalkMesh = new THREE.Mesh(stalkGeo, matBase);
        stalkMesh.position.set(sign * 16, 0, 0);
        stalkMesh.userData = { isExtrudeHandle: true, part: partName };
        stalkMesh.renderOrder = 1010;

        // 3D Flared Conical Arrowhead
        const coneGeo = new THREE.ConeGeometry(8.0, 16, 16);
        if (isStart) {
            coneGeo.rotateZ(Math.PI / 2); // points -X (left, outward)
        } else {
            coneGeo.rotateZ(-Math.PI / 2); // points +X (right, outward)
        }
        const coneMesh = new THREE.Mesh(coneGeo, matBase);
        coneMesh.position.set(sign * 31, 0, 0);
        coneMesh.userData = { isExtrudeHandle: true, part: partName };
        coneMesh.renderOrder = 1010;

        group.add(stalkMesh, coneMesh);

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
            hitBox.geometry = new THREE.BoxGeometry(44, wallH, 24);
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
                child.material.color.setHex(isOutHover ? 0xfacc15 : 0xf8fafc);
            } else if (part === 'depth_in') {
                child.material.color.setHex(isInHover ? 0xfacc15 : 0xf8fafc);
            } else if (part === 'slide_center' && child.userData?.isRing !== true) {
                child.material.color.setHex(isSlideHover ? 0xfacc15 : 0xf8fafc);
            }
        });

        // Highlight Start Boundary Handle
        this.extrudeStartHandle.traverse(child => {
            if (child.isMesh) {
                if (child.material && child.material.visible === false) return;
                if (child.userData?.isRing !== true) {
                    child.material.color.setHex(isStartHover ? 0xfacc15 : 0xf8fafc);
                }
            } else if (child.isLine) {
                child.material.color.setHex(isStartHover ? 0xfacc15 : 0x94a3b8);
                child.material.opacity = isStartHover ? 1.0 : 0.75;
            }
        });

        // Highlight End Boundary Handle
        this.extrudeEndHandle.traverse(child => {
            if (child.isMesh) {
                if (child.material && child.material.visible === false) return;
                if (child.userData?.isRing !== true) {
                    child.material.color.setHex(isEndHover ? 0xfacc15 : 0xf8fafc);
                }
            } else if (child.isLine) {
                child.material.color.setHex(isEndHover ? 0xfacc15 : 0x94a3b8);
                child.material.opacity = isEndHover ? 1.0 : 0.75;
            }
        });

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    _createDOMHUD() {
        if (typeof document === 'undefined') return;
        this.domHUD = document.createElement('div');
        this.domHUD.className = 'sms4-wall-3d-hud';
        this.domHUD.style.cssText = `
            position: fixed;
            display: none;
            transform: translate(-50%, -100%);
            padding: 3px 6px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.96);
            border: 1px solid rgba(226, 232, 240, 0.95);
            box-shadow: 0 10px 25px -4px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
            color: #0f172a;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 10.5px;
            font-weight: 600;
            white-space: nowrap;
            z-index: 100002;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            user-select: none;
            -webkit-user-select: none;
            gap: 4px;
            align-items: center;
            width: fit-content;
            max-width: min(calc(100vw - 24px), 520px);
            box-sizing: border-box;
            pointer-events: auto;
            line-height: 1;
        `;

        this.hudButtons = [
            {
                id: 'room_suite',
                label: 'Room',
                icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
                title: 'Room & Building Controls',
                subtitle: 'Open Room & Building Height / Foundation Controls'
            },
            {
                id: 'push_pull',
                label: 'Extender',
                icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l-5-5 5-5M17 7l5 5-5 5M2 12h20"/></svg>`,
                title: 'Extender',
                subtitle: 'Extend wall thickness & baseline (Panel #1)'
            },
            {
                id: 'corner',
                label: 'Vertices',
                icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M3 12h6M15 12h6M12 3v6M12 15v6"/></svg>`,
                title: 'Vertices, Height & Slope',
                subtitle: 'Adjust wall height, slope, baseline elevation & vertices (Panel #2)'
            },
            {
                id: 'extrude_recess',
                label: 'Bay/Niche',
                icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
                title: 'Bay Window & Niche',
                subtitle: 'Extrude bay window or recessed niche (Panels #5 & #6)'
            },
            {
                id: 'split',
                label: 'Split',
                icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/></svg>`,
                title: 'Slice Wall',
                subtitle: 'Slice wall in 3D (Panel #3)'
            }
        ];

        this.buttonElements = {};

        // Scrollable container for buttons so close button stays permanently fixed at the end
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'sms4-wall-hud-buttons';
        buttonsContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 3px;
            overflow-x: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
            min-width: 0;
            flex: 1 1 auto;
        `;

        this.hudButtons.forEach(btn => {
            const el = document.createElement('button');
            el.innerHTML = `${btn.icon}<span>${btn.label}</span>`;
            el.title = btn.title;
            el.style.cssText = `
                padding: 2.5px 7px;
                border-radius: 6px;
                border: 1px solid #e2e8f0;
                background: #f8fafc;
                color: #334155;
                font-size: 10.5px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.12s ease;
                white-space: nowrap;
                min-height: 22px;
                touch-action: manipulation;
                line-height: 1;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 3.5px;
                outline: none;
                flex-shrink: 0;
            `;
            el.onmouseenter = () => {
                if (btn.id !== this.activeMode) {
                    el.style.background = '#f1f5f9';
                    el.style.borderColor = '#cbd5e1';
                    el.style.color = '#0f172a';
                }
            };
            el.onmouseleave = () => {
                if (btn.id !== this.activeMode) {
                    el.style.background = '#f8fafc';
                    el.style.borderColor = '#e2e8f0';
                    el.style.color = '#334155';
                }
            };
            el.onclick = (e) => {
                e.stopPropagation();
                this._handleHUDAction(btn.id);
            };
            this._attachTooltip(el, btn.title, btn.subtitle);
            this.buttonElements[btn.id] = el;
            buttonsContainer.appendChild(el);
        });

        this.domHUD.appendChild(buttonsContainer);

        // Subtle divider separating scrollable buttons from fixed close button
        const divider = document.createElement('div');
        divider.style.cssText = `
            width: 1px;
            height: 14px;
            background: #e2e8f0;
            margin: 0 1px;
            flex-shrink: 0;
        `;
        this.domHUD.appendChild(divider);

        // Permanently fixed close button on menu (borderless sms 4 speech HUD style)
        const btnClose = document.createElement('button');
        btnClose.innerHTML = `✕`;
        btnClose.title = 'Deselect wall (Esc)';
        btnClose.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            border-radius: 6px;
            border: none;
            background: transparent;
            color: #94a3b8;
            cursor: pointer;
            font-size: 11px;
            font-weight: 800;
            transition: all 0.15s ease;
            outline: none;
            padding: 0;
            line-height: 1;
            flex-shrink: 0;
        `;
        btnClose.onmouseenter = () => {
            btnClose.style.background = '#fee2e2';
            btnClose.style.color = '#ef4444';
        };
        btnClose.onmouseleave = () => {
            btnClose.style.background = 'transparent';
            btnClose.style.color = '#94a3b8';
        };
        btnClose.onclick = (e) => {
            e.stopPropagation();
            this.detach();
        };
        this._attachTooltip(btnClose, 'Deselect Wall', 'Close editor and deselect (Esc)');
        this.domHUD.appendChild(btnClose);

        document.body.appendChild(this.domHUD);
    }

    _createConfirmBar() {
        if (typeof document === 'undefined') return;
        this.domConfirmBar = document.createElement('div');
        this.domConfirmBar.className = 'sms4-wall-confirm-bar';
        this.domConfirmBar.style.cssText = `
            position: fixed;
            display: none;
            transform: translate(-50%, -100%);
            flex-direction: column;
            align-items: center;
            gap: 3px;
            color: #0f172a;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 10.5px;
            font-weight: 600;
            z-index: 100002;
            user-select: none;
            -webkit-user-select: none;
            pointer-events: auto;
            width: fit-content;
            max-width: min(calc(100vw - 24px), 420px);
            box-sizing: border-box;
            background: transparent;
            line-height: 1;
            filter: drop-shadow(0 12px 28px rgba(0, 0, 0, 0.75));
        `;

        // Top Header Line: Badge docked at top-right corner
        const headerRow = document.createElement('div');
        headerRow.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: flex-end;
            align-self: flex-end;
            width: fit-content;
            background: transparent;
            margin-bottom: 2px;
            padding: 0 1px 1px 0;
            box-sizing: border-box;
            flex-shrink: 0;
        `;

        this.confirmStatusBadge = document.createElement('div');
        this.confirmStatusBadge.className = 'sms4-confirm-badge';
        this.confirmStatusBadge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-size: 9.5px;
            font-weight: 700;
            color: #334155;
            background: rgba(255, 255, 255, 0.94);
            border: 1px solid rgba(226, 232, 240, 0.9);
            border-radius: 6px;
            padding: 2.5px 7px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            white-space: nowrap;
            flex-shrink: 0;
            line-height: 1.2;
        `;
        headerRow.appendChild(this.confirmStatusBadge);

        this.domConfirmBar.appendChild(headerRow);

        // Bottom Controls Card: Presets + Actions
        const controlsCard = document.createElement('div');
        controlsCard.className = 'sms4-confirm-controls';
        controlsCard.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 3px;
            background: rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(226, 232, 240, 0.95);
            border-radius: 10px;
            padding: 3px 6px;
            box-shadow: 0 10px 25px -4px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
            width: fit-content;
            align-self: center;
            box-sizing: border-box;
            white-space: nowrap;
            flex-shrink: 0;
        `;

        // Done Button (Emerald Green pill with SVG checkmark)
        const btnDone = document.createElement('button');
        btnDone.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Done</span>`;
        btnDone.title = 'Apply and keep changes (Enter)';
        btnDone.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 3px 9px;
            border-radius: 9999px;
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #15803d;
            font-size: 10.5px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.15s ease;
            outline: none;
            min-height: 24px;
            line-height: 1;
            white-space: nowrap;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
            touch-action: manipulation;
        `;
        btnDone.onmouseenter = () => {
            btnDone.style.background = '#dcfce7';
            btnDone.style.transform = 'translateY(-1px)';
        };
        btnDone.onmouseleave = () => {
            btnDone.style.background = '#f0fdf4';
            btnDone.style.transform = 'translateY(0)';
        };
        btnDone.onclick = (e) => {
            e.stopPropagation();
            this.commitChanges();
        };
        this._attachTooltip(btnDone, 'Apply Changes', 'Save modifications to wall (Enter)');

        // Cancel Button (Red pill button with vector SVG icon and label)
        const btnCancel = document.createElement('button');
        btnCancel.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span>Cancel</span>`;
        btnCancel.title = 'Cancel editing and ignore changes (Esc)';
        btnCancel.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 3px 9px;
            border-radius: 9999px;
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #b91c1c;
            font-size: 10.5px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.15s ease;
            outline: none;
            min-height: 24px;
            line-height: 1;
            white-space: nowrap;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
            touch-action: manipulation;
        `;
        btnCancel.onmouseenter = () => {
            btnCancel.style.background = '#fee2e2';
            btnCancel.style.transform = 'translateY(-1px)';
        };
        btnCancel.onmouseleave = () => {
            btnCancel.style.background = '#fef2f2';
            btnCancel.style.transform = 'translateY(0)';
        };
        btnCancel.onclick = (e) => {
            e.stopPropagation();
            this.cancelChanges();
        };
        this._attachTooltip(btnCancel, 'Cancel Editing', 'Discard all modifications (Esc)');

        controlsCard.appendChild(btnDone);
        controlsCard.appendChild(btnCancel);

        // Speech bubble triangular tail pointing downward
        const tail = document.createElement('div');
        tail.style.cssText = `
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 5px solid rgba(255, 255, 255, 0.96);
            margin-top: -1px;
            filter: drop-shadow(0 2px 2px rgba(0,0,0,0.06));
        `;

        this.domConfirmBar.appendChild(controlsCard);
        this.domConfirmBar.appendChild(tail);

        document.body.appendChild(this.domConfirmBar);
    }

    /* -------------------------------------------------------------------------- */
    /*                         LIVE TOOLTIP BADGE                                 */
    /* -------------------------------------------------------------------------- */

    _createFloatingTooltip() {
        if (typeof document === 'undefined') return;

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'sms4-wall-tooltip';
        this.tooltip.style.cssText = `
            position: fixed;
            display: none;
            pointer-events: none;
            background: rgba(15, 23, 42, 0.94);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            font-weight: 500;
            padding: 5px 9px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 100010;
            white-space: nowrap;
            transition: opacity 0.12s ease;
            opacity: 0;
        `;
        document.body.appendChild(this.tooltip);
    }

    _showTooltip(title, clientX, clientY, subtitle = null) {
        if (!this.tooltip) return;
        let html = `<span style="font-weight:700; color:#ffffff;">${title}</span>`;
        if (subtitle) {
            html += `<span style="display:block; font-size:10px; color:#94a3b8; font-weight:400; margin-top:2px;">${subtitle}</span>`;
        }
        this.tooltip.innerHTML = html;
        this.tooltip.style.display = 'block';

        const tw = this.tooltip.offsetWidth || 140;
        const th = this.tooltip.offsetHeight || 30;
        let left = clientX;
        let top = clientY - th - 8;
        if (top < 10) top = clientY + 24;
        const maxW = typeof window !== 'undefined' ? window.innerWidth : 800;
        left = Math.max(tw / 2 + 10, Math.min(maxW - tw / 2 - 10, left));

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.transform = 'translate(-50%, 0)';
        this.tooltip.style.opacity = '1';
    }

    _hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.opacity = '0';
            this.tooltip.style.display = 'none';
        }
    }

    _attachTooltip(el, title, subtitle = null) {
        if (!el) return;
        let touchTimer = null;
        el.addEventListener('mouseenter', () => {
            const rect = el.getBoundingClientRect();
            this._showTooltip(title, rect.left + rect.width / 2, rect.top, subtitle);
        });
        el.addEventListener('mouseleave', () => {
            this._hideTooltip();
        });
        el.addEventListener('touchstart', () => {
            touchTimer = setTimeout(() => {
                const rect = el.getBoundingClientRect();
                this._showTooltip(title, rect.left + rect.width / 2, rect.top, subtitle);
            }, 250);
        }, { passive: true });
        const cancelTouch = () => {
            if (touchTimer) clearTimeout(touchTimer);
            setTimeout(() => this._hideTooltip(), 1500);
        };
        el.addEventListener('touchend', cancelTouch);
        el.addEventListener('touchcancel', cancelTouch);
    }

    _updatePresetButtonHighlights() {}

    _createLiveBadges() {
        if (typeof document === 'undefined') return;
        this.splitBadge = document.createElement('div');
        this.splitBadge.className = 'sms4-split-live-badge';
        this.splitBadge.style.cssText = `
            position: fixed;
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
            z-index: 100003;
            user-select: none;
        `;

        this.extrudeBadge = document.createElement('div');
        this.extrudeBadge.className = 'sms4-extrude-live-badge';
        this.extrudeBadge.style.cssText = `
            position: fixed;
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
            z-index: 100003;
            user-select: none;
        `;

        this.extenderBadge = document.createElement('div');
        this.extenderBadge.className = 'sms4-extender-live-badge';
        this.extenderBadge.style.cssText = `
            position: fixed;
            display: none;
            transform: translate(-50%, -100%);
            padding: 5px 12px;
            border-radius: 12px;
            background: rgba(59, 130, 246, 0.94);
            border: 2px solid #ffffff;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 14px rgba(59, 130, 246, 0.6);
            color: #ffffff;
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 800;
            white-space: nowrap;
            pointer-events: none;
            z-index: 100003;
            user-select: none;
        `;

        this.guideBadge = document.createElement('div');
        this.guideBadge.className = 'sms4-wall-guide-badge';
        this.guideBadge.style.cssText = `
            position: fixed;
            top: 72px;
            left: 50%;
            transform: translateX(-50%);
            display: none;
            padding: 8px 18px;
            border-radius: 20px;
            background: rgba(15, 23, 42, 0.92);
            border: 1.5px solid rgba(59, 130, 246, 0.6);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 12px rgba(59, 130, 246, 0.3);
            color: #ffffff;
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
            pointer-events: none;
            z-index: 100003;
            user-select: none;
            backdrop-filter: blur(8px);
            transition: opacity 0.2s ease, transform 0.2s ease;
        `;

        this.verticesBadge = document.createElement('div');
        this.verticesBadge.className = 'sms4-vertices-live-badge';
        this.verticesBadge.style.cssText = `
            position: fixed;
            display: none;
            transform: translate(-50%, -100%);
            padding: 5px 12px;
            border-radius: 12px;
            background: rgba(245, 158, 11, 0.94);
            border: 2px solid #ffffff;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 14px rgba(245, 158, 11, 0.6);
            color: #ffffff;
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 800;
            white-space: nowrap;
            pointer-events: none;
            z-index: 100003;
            user-select: none;
        `;

        this.cornerBadge = document.createElement('div');
        this.cornerBadge.className = 'sms4-corner-live-badge';
        this.cornerBadge.style.cssText = `
            position: fixed;
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
            z-index: 100003;
            user-select: none;
        `;

        document.body.appendChild(this.splitBadge);
        document.body.appendChild(this.extrudeBadge);
        document.body.appendChild(this.extenderBadge);
        document.body.appendChild(this.verticesBadge);
        document.body.appendChild(this.cornerBadge);
        document.body.appendChild(this.guideBadge);
    }

    showGuideBadge(text) {
        if (!this.guideBadge) return;
        this.guideBadge.textContent = text;
        this.guideBadge.style.display = 'block';
    }

    hideGuideBadge() {
        if (!this.guideBadge) return;
        this.guideBadge.style.display = 'none';
    }

    _clearGhostPreview() {
        if (!this.wallGhostPreviewGroup) return;
        while (this.wallGhostPreviewGroup.children.length > 0) {
            const child = this.wallGhostPreviewGroup.children[0];
            this.wallGhostPreviewGroup.remove(child);
            child.traverse?.(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) {
                    if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                    else c.material.dispose();
                }
            });
        }
        this.wallGhostPreviewGroup.visible = false;
        if (this.extenderBadge) this.extenderBadge.style.display = 'none';
        if (this.verticesBadge) this.verticesBadge.style.display = 'none';
        if (this.cornerBadge) this.cornerBadge.style.display = 'none';
    }

    _refreshHUDButtonStates() {
        Object.keys(this.buttonElements).forEach(id => {
            const el = this.buttonElements[id];
            if (id === this.activeMode) {
                el.style.background = '#eff6ff';
                el.style.borderColor = '#93c5fd';
                el.style.color = '#2563eb';
                el.style.boxShadow = '0 1px 3px rgba(37, 99, 235, 0.15)';
                el.style.fontWeight = '700';
            } else {
                el.style.background = '#f8fafc';
                el.style.borderColor = '#e2e8f0';
                el.style.color = '#334155';
                el.style.boxShadow = 'none';
                el.style.fontWeight = '600';
            }
        });
    }

    _handleHUDAction(actionId) {
        if (!this.target) return;
        this.setMode(actionId);
    }

    setMode(mode) {
        mode = mode || 'menu';
        if (mode === 'room_suite') {
            const targetObj = this.target;
            this.detach();
            if (this.ctx.interactions?.roomInteractiveSuite && targetObj) {
                this.ctx.interactions.roomInteractiveSuite.attach(targetObj);
            }
            return;
        }

        this.activeMode = mode;
        this.isSplitMode = (mode === 'split');

        const is2D = (this.ctx.viewMode === '2d' || this.ctx.planner?.viewMode === '2d');

        if (mode === 'menu' || mode === 'neutral') {
            this.extenderGizmo.detach();
            this.cornerGizmo.detach();
            this.heightGizmo.detach();
            this._hideSplitLaser();
            this._hideExtrudeGhost();
            if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
            if (this.domHUD) this.domHUD.style.display = (this._isActionActive() || is2D) ? 'none' : 'flex';
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
                push_pull: 'Extender',
                corner: 'Vertices',
                extrude_recess: 'Bay/Niche',
                height: 'Height',
                split: 'Split',
                slope: 'Slope',
                wall_corners: 'Wall Corners'
            };
            const icons = {
                push_pull: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l-5-5 5-5M17 7l5 5-5 5M2 12h20"/></svg>`,
                corner: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M3 12h6M15 12h6M12 3v6M12 15v6"/></svg>`,
                extrude_recess: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
                height: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M8 5l4-3 4 3M8 19l4 3 4-3"/></svg>`,
                split: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/></svg>`,
                slope: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 20 12 4 21 20 3 20"/></svg>`,
                wall_corners: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M3 21V3"/><circle cx="3" cy="21" r="2"/></svg>`
            };
            const iconSvg = icons[mode] || '';
            const labelTxt = labels[mode] || 'Editing';
            this.confirmStatusBadge.innerHTML = `${iconSvg}<span>${labelTxt}</span>`;
            const isPushPullOrBay = (mode === 'push_pull' || mode === 'extrude_recess');
            if (this.presetContainer) {
                this.presetContainer.style.display = isPushPullOrBay ? 'inline-flex' : 'none';
            }
            if (this.locationContainer) {
                this.locationContainer.style.display = isPushPullOrBay ? 'inline-flex' : 'none';
            }
            this.domConfirmBar.style.display = is2D ? 'none' : 'flex';
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
            this.extenderGizmo.attach(this.target, this.extenderTargetProtrusion);
            this.extenderGizmo.selectionScope = 'subregion';
            if (this.extenderStartT !== undefined && this.extenderEndT !== undefined) {
                this.extenderGizmo.tStart = this.extenderStartT;
                this.extenderGizmo.tEnd = this.extenderEndT;
            } else if (!this.extenderTargetProtrusion) {
                this.extenderGizmo.setPreset('middle_bay');
            }
            if (this.extenderFacing !== undefined) {
                this.extenderGizmo.activeFacing = this.extenderFacing;
                this.extenderGizmo.activeSide = this.extenderFacing === 1 ? 'front' : 'back';
            }
            this.extenderGizmo.currentExtrudeDepth = this.extenderDepth || (this.extenderGizmo.existingProtrusion ? this.extenderGizmo.existingProtrusion.depth : 30);
            this.extenderGizmo.updateHandles();
            this.extenderGizmo.visible = true;
            this.isExtenderPinned = true;
            this._updatePresetButtonHighlights();
            this.cornerGizmo.detach();
            this.heightGizmo.detach();
            this._hideSplitLaser();
            this._hideExtrudeGhost();
        } else if (mode === 'extrude_recess') {
            this.extenderGizmo.detach();
            this.cornerGizmo.detach();
            this.heightGizmo.detach();
            this._hideSplitLaser();
            this.extrudeCurrentDepth = 0; // Neutral 0cm start on entry
            this._showExtrudeGhost();
        } else if (mode === 'height' || mode === 'corner') {
            this.extenderGizmo.detach();
            this.cornerGizmo.attach(this.target);
            this.heightGizmo.detach();
            this._hideSplitLaser();
            this._hideExtrudeGhost();
        } else if (mode === 'split') {
            this.extenderGizmo.detach();
            this.cornerGizmo.detach();
            this.heightGizmo.detach();
            this._showSplitLaser();
            this._hideExtrudeGhost();
        } else if (mode === 'wall_corners') {
            this.extenderGizmo.detach();
            this.cornerGizmo.detach();
            this.heightGizmo.detach();
            this._hideSplitLaser();
            this._hideExtrudeGhost();
            if (this.ctx.interactions?.cornerFilletGizmo) {
                const wall = this.target?.userData?.entity;
                const anc = wall?.startAnchor || wall?.endAnchor;
                if (anc) {
                    this.ctx.interactions.cornerFilletGizmo.attach(anc);
                }
            }
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
            this.extenderGizmo.detach();
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

        if (mode === 'push_pull' && this.extenderGizmo) {
            if (!this.isValidPlacement) {
                this._shakeBadge(this.extenderBadge);
                return;
            }
            this.extenderGizmo.commit();
            this.detach();
            return;
        }

        if (mode === 'extrude_recess') {
            const wall = this.target?.userData?.entity;
            if (wall) {
                const validation = this._validatePlacementSpace(wall, this.extrudeStartT, this.extrudeEndT, 'extrude_recess');
                if (!validation.isValid) {
                    this.isValidPlacement = false;
                    this.invalidReason = validation.reason;
                    this._shakeBadge(this.extrudeBadge);
                    return;
                }
            }
            let depth = this.extrudeCurrentDepth;
            if (depth === 0) depth = 30;
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

        if (this.activeMode === 'push_pull' && this.extenderGizmo) {
            this.extenderGizmo.cancel();
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
        if (this.target) this.target.visible = true;
        if (this.extrudeBadge) this.extrudeBadge.style.display = 'none';
        this.isValidPlacement = true;
        this.invalidReason = '';
        if (this.ctx.renderer?.domElement && this.ctx.renderer.domElement.style.cursor === 'not-allowed') {
            this.ctx.renderer.domElement.style.cursor = 'default';
        }
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

        const validation = this._validatePlacementSpace(wall, tStart, tEnd, 'extrude_recess');
        this.isValidPlacement = validation.isValid;
        this.invalidReason = validation.reason;

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
            const isInvalid = !this.isValidPlacement;
            const ghostMat = isInvalid ? this.matInvalidGhost : this.matNeutralGhost;
            const neutralGeo = new THREE.BoxGeometry(bayLen, wallH, t + 0.8);
            const neutralMesh = new THREE.Mesh(neutralGeo, ghostMat);
            neutralMesh.position.set(midX, midY, 0);
            neutralMesh.raycast = () => {};

            const outlineMat = isInvalid ? this.matInvalidOutline : new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2, depthTest: false });
            const neutralEdges = new THREE.LineSegments(
                new THREE.EdgesGeometry(neutralGeo),
                outlineMat
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
        this.extrudeStartHandle.rotation.set(0, 0, 0);
        this._updateBoundaryLine(this.extrudeStartHandle, wallH);

        // Update Right Boundary Handle & Vertical Laser Cut Line
        this.extrudeEndHandle.position.set(endX, midY, surfaceZ + 2 * facing);
        this.extrudeEndHandle.rotation.set(0, 0, 0);
        this._updateBoundaryLine(this.extrudeEndHandle, wallH);

        if (!this.isValidPlacement) {
            this.extrudeHandle.visible = false;
            this.extrudeStartHandle.visible = false;
            this.extrudeEndHandle.visible = false;
        } else {
            this.extrudeHandle.visible = true;
            this.extrudeStartHandle.visible = true;
            this.extrudeEndHandle.visible = true;
        }

        // Update Floating HUD Status in single unified Confirm Bar
        let statusMsg = '';
        if (!this.isValidPlacement) {
            statusMsg = validation.message;
        } else if (depth > 0) {
            statusMsg = `🏛️ Bay Window: +${Math.round(depth)} cm · Width: ${Math.round(bayLen)} cm`;
        } else if (depth < 0) {
            const remainingCore = Math.round(t - Math.abs(depth));
            if (remainingCore >= 0) {
                statusMsg = `🔲 Niche: ${Math.round(depth)} cm · Width: ${Math.round(bayLen)} cm (Core: ${remainingCore} cm)`;
            } else {
                statusMsg = `⚠️ Niche: ${Math.round(depth)} cm exceeds wall thickness (${t} cm)`;
            }
        } else {
            statusMsg = `🏛️ Extrude Bay (+Z) / Recess Niche (-Z) · Width: ${Math.round(bayLen)} cm`;
        }

        if (this.confirmStatusBadge) {
            this.confirmStatusBadge.textContent = statusMsg;
        }
        if (this.extrudeBadge) {
            this.extrudeBadge.style.display = 'none'; // Suppress duplicate floating badge
        }
    }

    _onPointerMove(e) {
        if (!this.target) return;

        const dom = this.ctx.renderer.domElement;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (this.isSplitMode && !this.isSplitPinned) {
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
                    const screenX = rect.left + ((this.mouse.x + 1) * rect.width) / 2;
                    const screenY = rect.top + ((-this.mouse.y + 1) * rect.height) / 2;
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
                    const newStartT = Math.max(0, Math.min(this.initialEndT - minSpanT, this.initialStartT + deltaT));
                    this.extrudeStartT = Math.round(newStartT * 100) / 100;
                } else if (this.activeExtrudePart === 'boundary_end') {
                    const deltaAlongWall = deltaX * dirX + deltaZ * dirZ;
                    const deltaT = deltaAlongWall / wallLen;
                    const minSpanT = Math.min(0.15, 20 / wallLen);
                    const newEndT = Math.min(1.0, Math.max(this.initialStartT + minSpanT, this.initialEndT + deltaT));
                    this.extrudeEndT = Math.round(newEndT * 100) / 100;
                } else if (this.activeExtrudePart === 'slide_center') {
                    const deltaAlongWall = deltaX * dirX + deltaZ * dirZ;
                    const deltaT = deltaAlongWall / wallLen;
                    const span = this.initialEndT - this.initialStartT;
                    let newStartT = this.initialStartT + deltaT;
                    let newEndT = this.initialEndT + deltaT;
                    if (newStartT < 0) {
                        newStartT = 0;
                        newEndT = span;
                    } else if (newEndT > 1.0) {
                        newEndT = 1.0;
                        newStartT = 1.0 - span;
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
        } else if (this.activeMode === 'extrude_recess') {
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

            // Pin the cut point and show confirmation bar
            this.splitCurrentHit = { x: splitX, y: 0, z: splitZ };
            this.isSplitPinned = true;
            if (this.splitBadge) {
                const wallLen = Math.hypot(dx, dy);
                const splitDist = Math.round(wallLen * this.splitCurrentT);
                this.splitBadge.textContent = `✂️ Cut pinned at ${splitDist} cm · Click Done to Split or Cancel`;
            }
            if (this.domConfirmBar) {
                this.domConfirmBar.style.display = 'flex';
                this._updateHUDPosition();
            }
            if (this.ctx.requestRender) this.ctx.requestRender();
            return;
        }

        if (this.activeMode === 'extrude_recess') {
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

                // Adaptive drag plane: Horizontal ground plane if viewed from angle, camera-facing plane if viewed at eye-level
                if (Math.abs(camDir.y) >= 0.2) {
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hitPoint);
                } else {
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(camDir.x, 0, camDir.z).normalize(), hitPoint);
                }
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

        // View mode check: Never display 3D wall HUD in 2D view mode
        const viewMode = this.ctx.viewMode || this.ctx.planner?.viewMode || (typeof window !== 'undefined' && window.plannerInstance?.viewMode);
        if (viewMode === '2d') {
            if (this.domHUD) this.domHUD.style.display = 'none';
            if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
            return;
        }

        const wall = this.target.userData?.entity;
        if (!wall || this._isActionActive()) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
            return;
        }

        const dom = this.ctx.renderer.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        const rectLeft = (rect.left !== undefined) ? rect.left : 0;
        const rectTop = (rect.top !== undefined) ? rect.top : 0;
        const rectW = (rect.width !== undefined) ? rect.width : window.innerWidth;
        const rectH = (rect.height !== undefined) ? rect.height : window.innerHeight;
        const rectRight = (rect.right !== undefined) ? rect.right : (rectLeft + rectW);
        const rectBottom = (rect.bottom !== undefined) ? rect.bottom : (rectTop + rectH);

        const isMobile = (typeof window !== 'undefined' && window.innerWidth <= 768);
        const safeTop = rectTop + (isMobile ? 64 : 52);
        const safeBottom = rectBottom - 16;
        const safeLeft = rectLeft + (isMobile ? 68 : 58);
        const safeRight = rectRight - (isMobile ? 12 : 58);

        const activeHud = (this.domHUD && (this.activeMode === 'menu' || this.activeMode === 'neutral'))
            ? this.domHUD
            : (this.domConfirmBar && this.activeMode !== 'menu' && this.activeMode !== 'neutral')
                ? this.domConfirmBar
                : null;

        if (!activeHud) return;

        const hudW = activeHud.offsetWidth || 280;
        const hudH = activeHud.offsetHeight || 36;

        let screenX = rectLeft + rectW / 2;
        if (safeRight - safeLeft < hudW) {
            screenX = (safeLeft + safeRight) / 2;
        } else {
            const minX = safeLeft + hudW / 2;
            const maxX = safeRight - hudW / 2;
            screenX = Math.max(minX, Math.min(maxX, screenX));
        }

        // Clamp screenX to ensure HUD stays strictly within visible canvas bounds
        const minScreenX = rectLeft + 12 + hudW / 2;
        const maxScreenX = rectRight - 12 - hudW / 2;
        if (maxScreenX >= minScreenX) {
            screenX = Math.max(minScreenX, Math.min(maxScreenX, screenX));
        } else {
            screenX = rectLeft + rectW / 2;
        }

        let screenY = Math.max(safeTop, Math.min(safeBottom - hudH, safeTop));

        if (this.domHUD && (this.activeMode === 'menu' || this.activeMode === 'neutral')) {
            if (this.domHUD.parentElement !== document.body && !this.domHUD.parentElement) {
                document.body.appendChild(this.domHUD);
            }
            this.domHUD.style.left = `${screenX}px`;
            this.domHUD.style.top = `${screenY}px`;
            this.domHUD.style.transform = 'translate(-50%, 0)';
            this.domHUD.style.display = 'flex';
        }
        if (this.domConfirmBar && this.activeMode !== 'menu' && this.activeMode !== 'neutral') {
            if (this.domConfirmBar.parentElement !== document.body && !this.domConfirmBar.parentElement) {
                document.body.appendChild(this.domConfirmBar);
            }
            this.domConfirmBar.style.left = `${screenX}px`;
            this.domConfirmBar.style.top = `${screenY}px`;
            this.domConfirmBar.style.transform = 'translate(-50%, 0)';
            this.domConfirmBar.style.display = 'flex';
        }
    }

    _validatePlacementSpace(wall, startT, endT, toolMode = 'push_pull') {
        if (!wall) return { isValid: false, reason: 'no_wall', message: 'No Wall Selected', spanCm: 0, wallLenCm: 0 };

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
        const wallLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        const MIN_WALL_LEN = 40; // minimum 40 cm wall
        const MIN_SPAN = 30; // minimum 30 cm span for bay/niche or extender

        if (wallLen < MIN_WALL_LEN) {
            return {
                isValid: false,
                reason: 'wall_too_short',
                message: `🚫 Wall Too Short (${Math.round(wallLen)} cm · Min ${MIN_WALL_LEN} cm)`,
                spanCm: Math.round(wallLen * Math.abs(endT - startT)),
                wallLenCm: Math.round(wallLen)
            };
        }

        const t1 = Math.min(startT, endT);
        const t2 = Math.max(startT, endT);
        const spanCm = Math.round(wallLen * (t2 - t1));

        if (spanCm < MIN_SPAN) {
            return {
                isValid: false,
                reason: 'space_too_short',
                message: `🚫 Space Too Short (${spanCm} cm · Min ${MIN_SPAN} cm)`,
                spanCm,
                wallLenCm: Math.round(wallLen)
            };
        }

        // Corner & Wing Clearance Validation
        const distStart = Math.round(t1 * wallLen);
        const distEnd = Math.round((1 - t2) * wallLen);

        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        const allWalls = planner?.walls || [];
        const startNeighbors = allWalls.filter(w => w !== wall && !w.hidden && (w.startAnchor === wall.startAnchor || w.endAnchor === wall.startAnchor));
        const endNeighbors = allWalls.filter(w => w !== wall && !w.hidden && (w.startAnchor === wall.endAnchor || w.endAnchor === wall.endAnchor));

        // 1. Connected Corner Clearances (miter zones): minimum 25 cm from intersecting walls
        if (startNeighbors.length > 0 && distStart < 25) {
            return {
                isValid: false,
                reason: 'connected_corner',
                message: `🚫 Too Close to Connected Corner (${distStart} cm · Min 25 cm)`,
                spanCm,
                wallLenCm: Math.round(wallLen)
            };
        }
        if (endNeighbors.length > 0 && distEnd < 25) {
            return {
                isValid: false,
                reason: 'connected_corner',
                message: `🚫 Too Close to Connected Corner (${distEnd} cm · Min 25 cm)`,
                spanCm,
                wallLenCm: Math.round(wallLen)
            };
        }

        // 2. Minimum Wing Clearance for Bay/Niche cuts: minimum 20 cm on both sides to prevent degenerate wall slivers
        if (toolMode === 'extrude_recess') {
            if (distStart < 20) {
                return {
                    isValid: false,
                    reason: 'corner_clearance',
                    message: `🚫 Too Close to Corner (${distStart} cm · Min 20 cm)`,
                    spanCm,
                    wallLenCm: Math.round(wallLen)
                };
            }
            if (distEnd < 20) {
                return {
                    isValid: false,
                    reason: 'corner_clearance',
                    message: `🚫 Too Close to Corner (${distEnd} cm · Min 20 cm)`,
                    spanCm,
                    wallLenCm: Math.round(wallLen)
                };
            }
        }

        return {
            isValid: true,
            reason: 'ok',
            message: '',
            spanCm,
            wallLenCm: Math.round(wallLen)
        };
    }

    _shakeBadge(badge) {
        if (!badge || typeof document === 'undefined') return;
        badge.style.transition = 'transform 0.08s ease';
        badge.style.transform = 'translate(-46%, -100%) scale(1.04)';
        setTimeout(() => {
            if (badge) badge.style.transform = 'translate(-54%, -100%) scale(1.04)';
            setTimeout(() => {
                if (badge) badge.style.transform = 'translate(-50%, -100%) scale(1)';
            }, 80);
        }, 80);
    }

    attach(wallMesh, mode = 'menu', hitPoint = null) {
        this.hideGuideBadge();
        this._clearGhostPreview();
        if (this.target === wallMesh && this.activeMode === mode && (this.isOperationActive() || this.domConfirmBar?.style.display === 'flex')) {
            this._updateHUDPosition();
            return;
        }

        // Resolve existing protrusion if clicking directly on a protrusion hitbox
        if (wallMesh?.userData?.isProtrusion && (wallMesh.userData.widget || wallMesh.userData.entity)) {
            const prot = wallMesh.userData.widget || wallMesh.userData.entity;
            this.extenderTargetProtrusion = prot;
            const wall = wallMesh.userData.parentWall || wallMesh.userData.wall || prot.wall;
            const p1 = (wall?.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall?.startAnchor || { x: wall?.startX || 0, y: wall?.startY || 0 });
            const p2 = (wall?.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall?.endAnchor || { x: wall?.endX || 0, y: wall?.endY || 0 });
            const wallLen = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
            const protW = prot.width || 40;
            const protT = prot.t !== undefined ? prot.t : 0.5;
            const halfT = (protW / 2) / wallLen;
            this.extenderStartT = Math.max(0.02, protT - halfT);
            this.extenderEndT = Math.min(0.98, protT + halfT);
            this.extenderFacing = prot.facing || 1;
            this.extenderDepth = prot.depth || 30;
        }

        // Cross-device hitPoint resolution for direct touch / click placement
        if (wallMesh && hitPoint) {
            const wall = wallMesh.userData?.entity || wallMesh.userData?.parentWall || wallMesh.parent?.userData?.entity;
            if (wall) {
                const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
                const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
                const wallLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                if (wallLen >= 1) {
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const projT = ((hitPoint.x - p1.x) * dx + (hitPoint.z - p1.y) * dy) / (wallLen * wallLen);
                    if (mode === 'push_pull') {
                        let matchedProtrusion = null;
                        if (wallMesh.userData?.isProtrusion && (wallMesh.userData.widget || wallMesh.userData.entity)) {
                            matchedProtrusion = wallMesh.userData.widget || wallMesh.userData.entity;
                        } else if (wall.attachedWidgets && wall.attachedWidgets.length > 0) {
                            matchedProtrusion = wall.attachedWidgets.find(w => {
                                if (w.type !== 'solid_protrusion' && w.configId !== 'solid_protrusion') return false;
                                const pW = w.width || 40;
                                const pT = w.t !== undefined ? w.t : 0.5;
                                const halfT = (pW / 2) / wallLen;
                                const t1 = Math.max(0, pT - halfT);
                                const t2 = Math.min(1, pT + halfT);
                                return projT >= (t1 - 0.02) && projT <= (t2 + 0.02);
                            }) || null;
                        }

                        this.extenderTargetProtrusion = matchedProtrusion;
                        if (matchedProtrusion) {
                            const protW = matchedProtrusion.width || 40;
                            const protT = matchedProtrusion.t !== undefined ? matchedProtrusion.t : 0.5;
                            const halfT = (protW / 2) / wallLen;
                            this.extenderStartT = Math.max(0, protT - halfT);
                            this.extenderEndT = Math.min(1, protT + halfT);
                            this.extenderFacing = matchedProtrusion.facing || 1;
                            this.extenderDepth = matchedProtrusion.depth || 30;
                        } else if (this.extenderStartT === undefined) {
                            const halfSpan = Math.min(0.25, Math.max(0.08, 50 / wallLen));
                            const minCenter = halfSpan;
                            const maxCenter = Math.max(minCenter, 1 - halfSpan);
                            const clampedCenter = Math.max(minCenter, Math.min(maxCenter, projT));
                            this.extenderStartT = Math.max(0, clampedCenter - halfSpan);
                            this.extenderEndT = Math.min(1, clampedCenter + halfSpan);
                            const wallMidX = p1.x + (this.extenderStartT + this.extenderEndT) * 0.5 * dx;
                            const wallMidZ = p1.y + (this.extenderStartT + this.extenderEndT) * 0.5 * dy;
                            const camPos = this.ctx.camera ? this.ctx.camera.position : new THREE.Vector3();
                            const nx = -dy / wallLen;
                            const ny = dx / wallLen;
                            const dot = (camPos.x - wallMidX) * nx + (camPos.z - wallMidZ) * ny;
                            this.extenderFacing = dot >= 0 ? 1 : -1;
                            this.extenderDepth = 30;
                        }
                    } else if (mode === 'split') {
                        this.splitCurrentT = Math.max(0.02, Math.min(0.98, projT));
                    } else if (mode === 'extrude_recess' && this.extrudeStartT === undefined) {
                        const halfSpan = Math.min(0.25, Math.max(0.08, 50 / wallLen));
                        const minCenter = halfSpan;
                        const maxCenter = Math.max(minCenter, 1 - halfSpan);
                        const clampedCenter = Math.max(minCenter, Math.min(maxCenter, projT));
                        this.extrudeStartT = Math.max(0, clampedCenter - halfSpan);
                        this.extrudeEndT = Math.min(1, clampedCenter + halfSpan);
                    }
                }
            }
        }

        // Validate placement space before setting mode and pinning
        if (wallMesh && (mode === 'extrude_recess' || mode === 'push_pull')) {
            const wall = wallMesh.userData?.entity || wallMesh.userData?.parentWall || wallMesh.parent?.userData?.entity;
            if (wall && !this.extenderTargetProtrusion) {
                const tStart = mode === 'push_pull' 
                    ? (this.extenderStartT !== undefined ? this.extenderStartT : 0.25)
                    : (this.extrudeStartT !== undefined ? this.extrudeStartT : 0.25);
                const tEnd = mode === 'push_pull'
                    ? (this.extenderEndT !== undefined ? this.extenderEndT : 0.75)
                    : (this.extrudeEndT !== undefined ? this.extrudeEndT : 0.75);
                const validation = this._validatePlacementSpace(wall, tStart, tEnd, mode);
                if (!validation.isValid) {
                    this.isValidPlacement = false;
                    this.invalidReason = validation.reason;
                    this.isExtrudePinned = false;
                    this.isExtenderPinned = false;
                    this._shakeBadge(mode === 'extrude_recess' ? this.extrudeBadge : this.extenderBadge);
                    return;
                }
            }
        }

        this.target = wallMesh;
        this.setMode(mode || 'menu');
        if (mode === 'split' && wallMesh) {
            const wall = wallMesh.userData?.entity || wallMesh.userData?.parentWall || wallMesh.parent?.userData?.entity;
            if (wall) {
                const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
                const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const splitX = p1.x + this.splitCurrentT * dx;
                const splitZ = p1.y + this.splitCurrentT * dy;
                this.splitCurrentHit = { x: splitX, y: 0, z: splitZ };
                this.isSplitPinned = true;
                if (this.splitBadge) {
                    const wallLen = Math.hypot(dx, dy);
                    const splitDist = Math.round(wallLen * this.splitCurrentT);
                    this.splitBadge.textContent = `✂️ Cut pinned at ${splitDist} cm · Click Done to Split or Cancel`;
                }
            }
        } else if (mode === 'extrude_recess' && wallMesh) {
            const wall = wallMesh.userData?.entity || wallMesh.userData?.parentWall || wallMesh.parent?.userData?.entity;
            if (wall) {
                const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
                const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const wallLen = Math.hypot(dx, dy);
                if (wallLen >= 1) {
                    if (this.extrudeStartT === undefined || this.extrudeEndT === undefined) {
                        this.extrudeStartT = 0.25;
                        this.extrudeEndT = 0.75;
                    }
                    const validation = this._validatePlacementSpace(wall, this.extrudeStartT, this.extrudeEndT, 'extrude_recess');
                    if (!validation.isValid) {
                        this.isValidPlacement = false;
                        this.invalidReason = validation.reason;
                        this._shakeBadge(this.extrudeBadge);
                        return;
                    }
                    this.isExtrudePinned = true;
                    if (this.extrudeBadge) {
                        const bayLen = Math.round(wallLen * (this.extrudeEndT - this.extrudeStartT));
                        this.extrudeBadge.textContent = `🔲 Bay/Niche pinned (${bayLen} cm) · Drag arrow for depth, click Done`;
                    }
                }
            }
        } else if (mode === 'push_pull' && wallMesh) {
            const wall = wallMesh.userData?.entity || wallMesh.userData?.parentWall || wallMesh.parent?.userData?.entity;
            if (wall && this.extenderGizmo) {
                if (!this.extenderTargetProtrusion) {
                    const tStart = this.extenderStartT !== undefined ? this.extenderStartT : 0.25;
                    const tEnd = this.extenderEndT !== undefined ? this.extenderEndT : 0.75;
                    const validation = this._validatePlacementSpace(wall, tStart, tEnd, 'push_pull');
                    if (!validation.isValid) {
                        this.isValidPlacement = false;
                        this.invalidReason = validation.reason;
                        this._shakeBadge(this.extenderBadge);
                        return;
                    }
                }
                this.isExtenderPinned = true;
                if (this.extenderStartT !== undefined && this.extenderEndT !== undefined) {
                    this.extenderGizmo.tStart = this.extenderStartT;
                    this.extenderGizmo.tEnd = this.extenderEndT;
                }
                if (this.extenderFacing !== undefined) {
                    this.extenderGizmo.activeFacing = this.extenderFacing;
                    this.extenderGizmo.activeSide = this.extenderFacing === 1 ? 'front' : 'back';
                }
                if (!this.extenderGizmo.existingProtrusion && !this.extenderGizmo.currentExtrudeDepth) {
                    this.extenderGizmo.currentExtrudeDepth = this.extenderDepth || 30;
                } else if (this.extenderGizmo.existingProtrusion) {
                    this.extenderGizmo.currentExtrudeDepth = this.extenderDepth || this.extenderGizmo.existingProtrusion.depth || 30;
                }
                this.extenderGizmo.updateHandles(true);
                this.extenderGizmo.visible = true;
            }
            if (this.extenderBadge) this.extenderBadge.style.display = 'none';
        }
        this._updateHUDPosition();
    }

    detach() {
        if (this.target) this.target.visible = true;
        this.target = null;
        this.isSplitPinned = false;
        this.splitCurrentHit = null;
        this.isExtrudePinned = false;
        this.isExtenderPinned = false;
        this.isValidPlacement = true;
        this.invalidReason = '';
        if (this.ctx.renderer?.domElement && this.ctx.renderer.domElement.style.cursor === 'not-allowed') {
            this.ctx.renderer.domElement.style.cursor = 'default';
        }
        this.extenderStartT = undefined;
        this.extenderEndT = undefined;
        this.extenderFacing = undefined;
        this.extenderDepth = undefined;
        this.extenderTargetProtrusion = null;
        if (this.extenderBadge) this.extenderBadge.style.display = 'none';
        this.extenderGizmo.detach();
        this.cornerGizmo.detach();
        this.heightGizmo.detach();
        this._hideSplitLaser();
        this._hideExtrudeGhost();
        this._clearGhostPreview();
        if (this.domHUD) this.domHUD.style.display = 'none';
        if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
        this._snapshotCmd = null;
        this._initialWallSnapshot = null;

        if (this.ctx.interactions && !this.ctx.interactions._isDeselecting) {
            this.ctx.interactions.selectedObject = null;
            if (this.ctx.interactions.highlightRenderer) {
                if (typeof this.ctx.interactions.highlightRenderer.clearAll === 'function') {
                    this.ctx.interactions.highlightRenderer.clearAll();
                } else if (typeof this.ctx.interactions.highlightRenderer.clearSelectionHighlight === 'function') {
                    this.ctx.interactions.highlightRenderer.clearSelectionHighlight();
                }
            }
        }
        const commonCtrl = this.ctx.commonTools || this.ctx.interactions?.commonController;
        if (commonCtrl) {
            if (typeof commonCtrl.clearSelection === 'function') {
                commonCtrl.clearSelection();
            } else {
                commonCtrl.selectedEntity = null;
                commonCtrl.selectedMesh = null;
                commonCtrl.selectedType = null;
                commonCtrl.activeAction = null;
                commonCtrl.interactionState = 'IDLE';
                commonCtrl.hudMode = 'none';
            }
            if (coreEventBus) {
                coreEventBus.emit('InteractionStateChanged', typeof commonCtrl.getInteractionState === 'function' ? commonCtrl.getInteractionState() : { activeTool: commonCtrl.activeTool, state: 'IDLE' });
                coreEventBus.emit('CommonSelectionChanged', {
                    entity: null,
                    mesh: null,
                    capabilities: typeof commonCtrl.getCurrentCapabilities === 'function' ? commonCtrl.getCurrentCapabilities() : []
                });
            }
        }

        const activeTool = commonCtrl?.activeTool;
        const isTouch = typeof window !== 'undefined' && (
            'ontouchstart' in window || 
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
            window.matchMedia?.('(pointer: coarse)')?.matches
        );
        if (activeTool === 'push_pull' || activeTool === 'extender') {
            this.showGuideBadge(isTouch ? '👆 Tap any wall to extend' : '↔️ Hover any wall to preview, click to extend');
        } else if (activeTool === 'split') {
            this.showGuideBadge(isTouch ? '👆 Tap any wall to split' : '✂️ Hover any wall to preview cut, click to place');
        } else if (activeTool === 'extrude_recess' || activeTool === 'bay_niche') {
            this.showGuideBadge(isTouch ? '👆 Tap any wall to add bay/niche' : '🔲 Hover any wall to preview, click to place');
        } else if (activeTool === 'corner' || activeTool === 'vertices') {
            this.showGuideBadge(isTouch ? '👆 Tap any wall to edit corners' : '📐 Click any wall to edit corners');
        } else if (activeTool === 'wall_corners') {
            this.showGuideBadge(isTouch ? '👆 Tap any wall corner to configure' : '📐 Click any wall corner to configure');
        } else {
            this.hideGuideBadge();
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    isOperationActive() {
        if (!this.target) return false;
        if (this.isExtrudeDragging) return true;
        if (this.isSplitPinned) return true;
        if (this.isExtrudePinned) return true;
        if (this.isExtenderPinned) return true;
        if (this.extenderGizmo?.isDragging || this.cornerGizmo?.isDragging || this.heightGizmo?.isDragging) return true;
        if (this.domConfirmBar && this.domConfirmBar.style.display !== 'none' && this.activeMode && this.activeMode !== 'menu' && this.activeMode !== 'neutral') {
            return true;
        }
        return false;
    }


    previewExtender(wallMesh, hitPoint) {
        if (this.isOperationActive()) return;
        if (!wallMesh) {
            this._clearGhostPreview();
            if (this.extenderGizmo && !this.isOperationActive()) {
                this.extenderGizmo.detach();
            }
            if (this.extenderBadge) this.extenderBadge.style.display = 'none';
            this.isValidPlacement = true;
            this.invalidReason = '';
            if (this.ctx.renderer?.domElement && this.ctx.renderer.domElement.style.cursor === 'not-allowed') {
                this.ctx.renderer.domElement.style.cursor = 'default';
            }
            return;
        }
        const wall = wallMesh.userData?.entity || wallMesh.userData?.parentWall || wallMesh.parent?.userData?.entity;
        if (!wall) {
            this._clearGhostPreview();
            if (this.extenderGizmo && !this.isOperationActive()) {
                this.extenderGizmo.detach();
            }
            if (this.extenderBadge) this.extenderBadge.style.display = 'none';
            this.isValidPlacement = true;
            this.invalidReason = '';
            if (this.ctx.renderer?.domElement && this.ctx.renderer.domElement.style.cursor === 'not-allowed') {
                this.ctx.renderer.domElement.style.cursor = 'default';
            }
            return;
        }

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
        const wallLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (wallLen < 1) return;

        let projT = 0.5;
        if (hitPoint) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            projT = ((hitPoint.x - p1.x) * dx + (hitPoint.z - p1.y) * dy) / (wallLen * wallLen);
        }

        // Check if hitPoint is hovering over an existing solid protrusion on this wall
        let matchedProtrusion = null;
        if (wallMesh.userData?.isProtrusion && (wallMesh.userData.widget || wallMesh.userData.entity)) {
            matchedProtrusion = wallMesh.userData.widget || wallMesh.userData.entity;
        } else if (wall.attachedWidgets && wall.attachedWidgets.length > 0) {
            matchedProtrusion = wall.attachedWidgets.find(w => {
                if (w.type !== 'solid_protrusion' && w.configId !== 'solid_protrusion') return false;
                const pW = w.width || 40;
                const pT = w.t !== undefined ? w.t : 0.5;
                const halfT = (pW / 2) / wallLen;
                const t1 = Math.max(0, pT - halfT);
                const t2 = Math.min(1, pT + halfT);
                return projT >= (t1 - 0.02) && projT <= (t2 + 0.02);
            }) || null;
        }

        this._clearGhostPreview();
        this.extenderTargetProtrusion = matchedProtrusion;

        if (matchedProtrusion) {
            // Target the existing protrusion for editing
            this.extenderGizmo.attach(wallMesh, matchedProtrusion);
            this.extenderStartT = this.extenderGizmo.tStart;
            this.extenderEndT = this.extenderGizmo.tEnd;
            this.extenderFacing = this.extenderGizmo.activeFacing || 1;
            this.extenderDepth = this.extenderGizmo.currentExtrudeDepth || matchedProtrusion.depth || 30;
            this.isValidPlacement = true;
            this.invalidReason = '';
            this.extenderGizmo.updateHandles(true);
        } else {
            // Fresh sub-region extension on empty wall space
            const halfSpan = Math.min(0.25, Math.max(0.08, 50 / wallLen));
            const minCenter = halfSpan;
            const maxCenter = Math.max(minCenter, 1 - halfSpan);
            const clampedCenter = Math.max(minCenter, Math.min(maxCenter, projT));
            const tStart = Math.max(0, clampedCenter - halfSpan);
            const tEnd = Math.min(1, clampedCenter + halfSpan);

            this.extenderGizmo.attach(wallMesh, null);
            this.extenderGizmo.selectionScope = 'subregion';
            this.extenderGizmo.tStart = tStart;
            this.extenderGizmo.tEnd = tEnd;

            // Camera line-of-sight facing detection
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const wallMidX = p1.x + (tStart + tEnd) * 0.5 * dx;
            const wallMidZ = p1.y + (tStart + tEnd) * 0.5 * dy;
            const camPos = this.ctx.camera ? this.ctx.camera.position : new THREE.Vector3();
            const nx = -dy / wallLen;
            const ny = dx / wallLen;
            const dot = (camPos.x - wallMidX) * nx + (camPos.z - wallMidZ) * ny;
            const facing = dot >= 0 ? 1 : -1;
            this.extenderGizmo.activeFacing = facing;
            this.extenderGizmo.activeSide = facing === 1 ? 'front' : 'back';
            this.extenderGizmo.currentExtrudeDepth = 30;

            this.extenderStartT = tStart;
            this.extenderEndT = tEnd;
            this.extenderFacing = facing;
            this.extenderDepth = 30;

            const validation = this._validatePlacementSpace(wall, tStart, tEnd, 'push_pull');
            this.isValidPlacement = validation.isValid;
            this.invalidReason = validation.reason;
            this.extenderGizmo.updateHandles(this.isValidPlacement);
        }

        this.extenderGizmo.visible = true;

        if (this.extenderBadge) {
            const bayLenCm = Math.round(wallLen * (this.extenderGizmo.tEnd - this.extenderGizmo.tStart));
            const extDepth = Math.round(this.extenderGizmo.currentExtrudeDepth || 30);
            if (!this.isValidPlacement) {
                const validation = this._validatePlacementSpace(wall, this.extenderGizmo.tStart, this.extenderGizmo.tEnd, 'push_pull');
                this.extenderBadge.textContent = validation.message;
                this.extenderBadge.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.95))';
                this.extenderBadge.style.borderColor = 'rgba(254, 202, 202, 0.8)';
                this.extenderBadge.style.color = '#ffffff';
                this.extenderBadge.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.35)';
                if (this.ctx.renderer?.domElement) {
                    this.ctx.renderer.domElement.style.cursor = 'not-allowed';
                }
            } else {
                if (matchedProtrusion) {
                    this.extenderBadge.textContent = `↔️ Click to Edit Extension (+${extDepth} cm · Width: ${bayLenCm} cm)`;
                } else {
                    this.extenderBadge.textContent = `↔️ Click to Place Extension (+${extDepth} cm · Width: ${bayLenCm} cm)`;
                }
                this.extenderBadge.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.92))';
                this.extenderBadge.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                this.extenderBadge.style.color = '#f8fafc';
                this.extenderBadge.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.25)';
                if (this.ctx.renderer?.domElement) {
                    this.ctx.renderer.domElement.style.cursor = 'pointer';
                }
            }
            if (this.ctx.renderer && this.ctx.camera) {
                const dom = this.ctx.renderer.domElement;
                const rect = dom.getBoundingClientRect();
                const wallBaseY = (wall.elevation || 0);
                const wallH = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const wallMidX = p1.x + (this.extenderGizmo.tStart + this.extenderGizmo.tEnd) * 0.5 * dx;
                const wallMidZ = p1.y + (this.extenderGizmo.tStart + this.extenderGizmo.tEnd) * 0.5 * dy;
                const nx = -dy / wallLen;
                const ny = dx / wallLen;
                const facing = this.extenderGizmo.activeFacing || 1;
                const worldMidX = wallMidX + (extDepth / 2) * nx * facing;
                const worldMidZ = wallMidZ + (extDepth / 2) * ny * facing;
                const worldMidY = wallBaseY + wallH / 2;
                const v = new THREE.Vector3(worldMidX, worldMidY, worldMidZ).project(this.ctx.camera);
                const screenX = rect.left + ((v.x + 1) * rect.width) / 2;
                const screenY = rect.top + ((-v.y + 1) * rect.height) / 2;
                this.extenderBadge.style.left = `${screenX}px`;
                this.extenderBadge.style.top = `${screenY - 24}px`;
                this.extenderBadge.style.display = 'block';
            }
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    previewVertices(wallMesh, hitPoint) {
        if (this.isOperationActive()) return;
        if (!wallMesh) {
            this._clearGhostPreview();
            return;
        }
        const wall = wallMesh.userData?.entity || wallMesh.userData?.parentWall || wallMesh.parent?.userData?.entity;
        if (!wall) {
            this._clearGhostPreview();
            return;
        }

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
        const midX = wallLen * 0.5;
        const midY = wallH * 0.5;

        this._clearGhostPreview();

        this.wallGhostPreviewGroup.position.set(p1.x, wallBaseY, p1.y);
        this.wallGhostPreviewGroup.rotation.set(0, -angle, 0);
        this.wallGhostPreviewGroup.visible = true;

        // 1. Translucent 3D Wall Boundary Box (Warm Gold / Amber)
        const boxGeo = new THREE.BoxGeometry(wallLen, wallH, t + 1.2);
        const boxMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.20, depthTest: false, side: THREE.DoubleSide });
        const boxMesh = new THREE.Mesh(boxGeo, boxMat);
        boxMesh.position.set(midX, midY, 0);
        boxMesh.raycast = () => {};

        // 2. Glowing Amber/Gold Edges
        const edgesGeo = new THREE.EdgesGeometry(boxGeo);
        const edgesMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2, depthTest: false });
        const edges = new THREE.LineSegments(edgesGeo, edgesMat);
        edges.position.copy(boxMesh.position);
        edges.raycast = () => {};

        // 3. 4 Corner Vertex Spheres
        const sphereGeo = new THREE.SphereGeometry(3.5, 12, 12);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
        const cornerCoords = [
            [0, 0, 0],
            [wallLen, 0, 0],
            [0, wallH, 0],
            [wallLen, wallH, 0]
        ];
        const cornerPins = [];
        cornerCoords.forEach(([cx, cy, cz]) => {
            const pin = new THREE.Mesh(sphereGeo, sphereMat);
            pin.position.set(cx, cy, cz);
            pin.raycast = () => {};
            cornerPins.push(pin);
        });

        // 4. Top Edge Sloping Bar Indicator
        const topBarGeo = new THREE.BoxGeometry(wallLen * 0.4, 2.5, t + 2);
        const topBarMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false });
        const topBar = new THREE.Mesh(topBarGeo, topBarMat);
        topBar.position.set(midX, wallH, 0);
        topBar.raycast = () => {};

        this.wallGhostPreviewGroup.add(boxMesh, edges, ...cornerPins, topBar);

        // 5. Update Badge
        if (this.verticesBadge) {
            const wallLenCm = Math.round(wallLen);
            this.verticesBadge.textContent = `📐 Click to Edit Vertices & Slope (${wallLenCm} cm)`;
            if (this.ctx.renderer && this.ctx.camera) {
                const dom = this.ctx.renderer.domElement;
                const rect = dom.getBoundingClientRect();
                const worldMidX = (p1.x + p2.x) * 0.5;
                const worldMidZ = (p1.y + p2.y) * 0.5;
                const worldMidY = wallBaseY + wallH / 2;
                const v = new THREE.Vector3(worldMidX, worldMidY, worldMidZ).project(this.ctx.camera);
                const screenX = rect.left + ((v.x + 1) * rect.width) / 2;
                const screenY = rect.top + ((-v.y + 1) * rect.height) / 2;
                this.verticesBadge.style.left = `${screenX}px`;
                this.verticesBadge.style.top = `${screenY - 24}px`;
                this.verticesBadge.style.display = 'block';
            }
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    previewWallCorner(wallMesh, hitPoint) {
        if (this.isOperationActive()) return;
        if (!wallMesh) {
            this._clearGhostPreview();
            return;
        }
        const wall = wallMesh.userData?.entity || wallMesh.userData?.parentWall || wallMesh.parent?.userData?.entity;
        if (!wall) {
            this._clearGhostPreview();
            return;
        }

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
        const midX = wallLen * 0.5;
        const midY = wallH * 0.5;

        this._clearGhostPreview();

        this.wallGhostPreviewGroup.position.set(p1.x, wallBaseY, p1.y);
        this.wallGhostPreviewGroup.rotation.set(0, -angle, 0);
        this.wallGhostPreviewGroup.visible = true;

        // 1. Translucent 3D Wall Boundary Box (Emerald Green)
        const boxGeo = new THREE.BoxGeometry(wallLen, wallH, t + 1.2);
        const boxMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.20, depthTest: false, side: THREE.DoubleSide });
        const boxMesh = new THREE.Mesh(boxGeo, boxMat);
        boxMesh.position.set(midX, midY, 0);
        boxMesh.raycast = () => {};

        // 2. Glowing Emerald Edges
        const edgesGeo = new THREE.EdgesGeometry(boxGeo);
        const edgesMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2, depthTest: false });
        const edges = new THREE.LineSegments(edgesGeo, edgesMat);
        edges.position.copy(boxMesh.position);
        edges.raycast = () => {};

        // 3. Corner Junction Cylinders at start and end
        const cylRadius = Math.max(8, t / 2 + 1);
        const cylGeo = new THREE.CylinderGeometry(cylRadius, cylRadius, wallH, 16);
        const cylMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.35, depthTest: false });

        const startCyl = new THREE.Mesh(cylGeo, cylMat);
        startCyl.position.set(0, midY, 0);
        startCyl.raycast = () => {};

        const endCyl = new THREE.Mesh(cylGeo, cylMat);
        endCyl.position.set(wallLen, midY, 0);
        endCyl.raycast = () => {};

        // Base rings
        const ringGeo = new THREE.RingGeometry(cylRadius - 1, cylRadius + 2, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false });
        const startRing = new THREE.Mesh(ringGeo, ringMat);
        startRing.position.set(0, 1, 0);
        startRing.raycast = () => {};

        const endRing = new THREE.Mesh(ringGeo, ringMat);
        endRing.position.set(wallLen, 1, 0);
        endRing.raycast = () => {};

        this.wallGhostPreviewGroup.add(boxMesh, edges, startCyl, endCyl, startRing, endRing);

        // 4. Update Badge
        if (this.cornerBadge) {
            const wallLenCm = Math.round(wallLen);
            this.cornerBadge.textContent = `📐 Click to Configure Corner Joint (${wallLenCm} cm)`;
            if (this.ctx.renderer && this.ctx.camera) {
                const dom = this.ctx.renderer.domElement;
                const rect = dom.getBoundingClientRect();
                const worldMidX = (p1.x + p2.x) * 0.5;
                const worldMidZ = (p1.y + p2.y) * 0.5;
                const worldMidY = wallBaseY + wallH / 2;
                const v = new THREE.Vector3(worldMidX, worldMidY, worldMidZ).project(this.ctx.camera);
                const screenX = rect.left + ((v.x + 1) * rect.width) / 2;
                const screenY = rect.top + ((-v.y + 1) * rect.height) / 2;
                this.cornerBadge.style.left = `${screenX}px`;
                this.cornerBadge.style.top = `${screenY - 24}px`;
                this.cornerBadge.style.display = 'block';
            }
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    previewExtrude(wallMesh, hitPoint) {
        if (this.isOperationActive()) return;
        if (!wallMesh) {
            this._hideExtrudeGhost();
            if (!this.isOperationActive()) {
                this.target = null;
            }
            return;
        }
        const wall = wallMesh.userData?.entity || wallMesh.userData?.parentWall || wallMesh.parent?.userData?.entity;
        if (!wall) {
            this._hideExtrudeGhost();
            this.target = null;
            return;
        }

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
        const wallBaseY = (wall.elevation || 0);
        const wallH = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));
        const t = (wall.thickness !== undefined ? wall.thickness : 20);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const wallLen = Math.hypot(dx, dy);
        if (wallLen < 1) return;

        let projT = 0.5;
        if (hitPoint) {
            projT = ((hitPoint.x - p1.x) * dx + (hitPoint.z - p1.y) * dy) / (wallLen * wallLen);
        }
        const halfSpan = Math.min(0.25, Math.max(0.08, 50 / wallLen));
        const minCenter = halfSpan;
        const maxCenter = Math.max(minCenter, 1 - halfSpan);
        const clampedCenter = Math.max(minCenter, Math.min(maxCenter, projT));
        this.extrudeStartT = Math.max(0, clampedCenter - halfSpan);
        this.extrudeEndT = Math.min(1, clampedCenter + halfSpan);
        this.target = wallMesh;
        this.extrudeCurrentDepth = 0; // neutral ghost box preview
        this.extrudeGroup.visible = true;

        const validation = this._validatePlacementSpace(wall, this.extrudeStartT, this.extrudeEndT, 'extrude_recess');
        this.isValidPlacement = validation.isValid;
        this.invalidReason = validation.reason;

        this._updateExtrudeGhostGeometry();

        if (this.extrudeBadge) {
            const bayLen = Math.round(wallLen * (this.extrudeEndT - this.extrudeStartT));
            if (!this.isValidPlacement) {
                this.extrudeBadge.textContent = validation.message;
                this.extrudeBadge.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.95))';
                this.extrudeBadge.style.borderColor = 'rgba(254, 202, 202, 0.8)';
                this.extrudeBadge.style.color = '#ffffff';
                this.extrudeBadge.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.35)';
                if (this.ctx.renderer?.domElement) {
                    this.ctx.renderer.domElement.style.cursor = 'not-allowed';
                }
            } else {
                this.extrudeBadge.textContent = `🔲 Click to Place Bay/Niche (${bayLen} cm)`;
                this.extrudeBadge.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.92))';
                this.extrudeBadge.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                this.extrudeBadge.style.color = '#f8fafc';
                this.extrudeBadge.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.25)';
                if (this.ctx.renderer?.domElement) {
                    this.ctx.renderer.domElement.style.cursor = 'pointer';
                }
            }
            if (this.ctx.renderer && this.ctx.camera) {
                const dom = this.ctx.renderer.domElement;
                const rect = dom.getBoundingClientRect();
                const midT = (this.extrudeStartT + this.extrudeEndT) * 0.5;
                const midX = p1.x + midT * dx;
                const midZ = p1.y + midT * dy;
                const midY = wallBaseY + wallH / 2;
                const v = new THREE.Vector3(midX, midY, midZ).project(this.ctx.camera);
                const screenX = rect.left + ((v.x + 1) * rect.width) / 2;
                const screenY = rect.top + ((-v.y + 1) * rect.height) / 2;
                this.extrudeBadge.style.left = `${screenX}px`;
                this.extrudeBadge.style.top = `${screenY - 24}px`;
                this.extrudeBadge.style.display = 'block';
            }
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    previewSplit(wallMesh, hitPoint) {
        if (this.isOperationActive()) return;
        if (!wallMesh) {
            this._hideSplitLaser();
            return;
        }
        const wall = wallMesh.userData?.entity;
        if (!wall) {
            this._hideSplitLaser();
            return;
        }

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
        const wallBaseY = (wall.elevation || 0);
        const wallH = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));
        const t = (wall.thickness !== undefined ? wall.thickness : 20);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const wallLen = Math.hypot(dx, dy);
        if (wallLen < 1) return;

        let projT = 0.5;
        if (hitPoint) {
            projT = ((hitPoint.x - p1.x) * dx + (hitPoint.z - p1.y) * dy) / (wallLen * wallLen);
        }
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
            const splitDist = Math.round(wallLen * clampedT);
            this.splitBadge.textContent = `✂️ Click to Split at ${splitDist} cm (Remaining: ${Math.round(wallLen - splitDist)} cm)`;
            if (this.ctx.renderer && this.ctx.camera) {
                const dom = this.ctx.renderer.domElement;
                const rect = dom.getBoundingClientRect();
                const v = new THREE.Vector3(sliceX, sliceY, sliceZ).project(this.ctx.camera);
                const screenX = rect.left + ((v.x + 1) * rect.width) / 2;
                const screenY = rect.top + ((-v.y + 1) * rect.height) / 2;
                this.splitBadge.style.left = `${screenX}px`;
                this.splitBadge.style.top = `${screenY - 24}px`;
                this.splitBadge.style.display = 'block';
            }
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    updateHandles() {
        if (this.extenderGizmo.visible) this.extenderGizmo.updateHandles();
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

        if (this.target) this.target.visible = true;

        const cmd = new SnapshotCommand(planner);
        const wallThickness = wall.thickness !== undefined ? wall.thickness : (wall.config?.thickness || 20);

        // If inward recess is within wall thickness, create/attach an architectural niche widget
        if (depth < 0 && Math.abs(depth) <= wallThickness - 2) {
            const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
            const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
            const wallLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const selW = Math.max(10, Math.round(wallLen * (tEnd - tStart)));
            const selH = wall.height !== undefined ? wall.height : (wall.config?.height || 120);
            const facing = this.activeFacing || 1;
            const protT = (tStart + tEnd) / 2;
            const maxNicheDepth = Math.max(1, wallThickness - 3);
            const nicheDepth = Math.min(Math.round(Math.abs(depth)), maxNicheDepth);

            let widgetObj = null;
            if (planner && planner.wallLayer && typeof advance_openings === 'function') {
                try {
                    widgetObj = new advance_openings(planner, wall, protT, 'niche_recess');
                    widgetObj.width = selW;
                    widgetObj.height = selH;
                    widgetObj.elevation = 0;
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
                    elevation: 0,
                    depth: nicheDepth,
                    thick: wallThickness,
                    facing: facing,
                    wall: wall
                };
            }
            WallEngine.attachWidget(wall, widgetObj, true, planner);

            if (typeof cmd.finalize === 'function') cmd.finalize();
            if (planner.commandManager) planner.commandManager.execute(cmd);

            if (typeof this.ctx.updateWallGeometryLive === 'function') {
                this.ctx.updateWallGeometryLive(wall);
            }
            coreEventBus.emit(EVENTS.WALL_CHANGE, { entity: wall });
            this.detach();
            return widgetObj;
        }

        const newWalls = WallReformer.extrudeWallSegment(planner, wall, tStart, tEnd, depth);
        if (newWalls && planner.commandManager) {
            if (typeof cmd.finalize === 'function') cmd.finalize();
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
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._onCameraChange);
            if (this._onKeyDown) {
                window.removeEventListener('keydown', this._onKeyDown);
            }
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
        if (this.domConfirmBar && this.domConfirmBar.parentElement) {
            this.domConfirmBar.parentElement.removeChild(this.domConfirmBar);
        }
        if (this.tooltip && this.tooltip.parentElement) {
            this.tooltip.parentElement.removeChild(this.tooltip);
        }
        if (this.splitBadge && this.splitBadge.parentElement) {
            this.splitBadge.parentElement.removeChild(this.splitBadge);
        }
        if (this.extrudeBadge && this.extrudeBadge.parentElement) {
            this.extrudeBadge.parentElement.removeChild(this.extrudeBadge);
        }
        if (this.extenderBadge && this.extenderBadge.parentElement) {
            this.extenderBadge.parentElement.removeChild(this.extenderBadge);
        }
        if (this.verticesBadge && this.verticesBadge.parentElement) {
            this.verticesBadge.parentElement.removeChild(this.verticesBadge);
        }
        if (this.cornerBadge && this.cornerBadge.parentElement) {
            this.cornerBadge.parentElement.removeChild(this.cornerBadge);
        }
        if (this.guideBadge && this.guideBadge.parentElement) {
            this.guideBadge.parentElement.removeChild(this.guideBadge);
        }
        this.extenderGizmo.dispose();
        this.cornerGizmo.dispose();
        this.heightGizmo.dispose();
        if (this.splitLaserPlane.geometry) this.splitLaserPlane.geometry.dispose();
        if (this.extrudeGhostMesh.geometry) this.extrudeGhostMesh.geometry.dispose();
        if (coreEventBus) {
            coreEventBus.off('InteractionStateChanged', this._onInteractionStateChanged);
        }
        this.detach();
    }
}

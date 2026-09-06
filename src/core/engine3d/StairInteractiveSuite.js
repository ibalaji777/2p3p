import * as THREE from 'three';
import { StairHeightDetector } from '../../features/stairs/StairHeightDetector.js';
import { coreEventBus } from '../EventBus.js';

/**
 * StairInteractiveSuite
 * 
 * Central coordinator managing Sims 4-style 3D interactive editing for staircases:
 * 1. In-Scene 3D Control Handles:
 *    - Width Handles (Left & Right): Double-sided arrow handles to drag and resize width in 3D.
 *    - Landing / Bending Handle: At the landing / bend node to slide the landing up/down
 *      (redistributing step counts between Flight 1 & Flight 2) or bend the flight into L/U shapes.
 *    - Top Height Handle: Vertical arrow to raise/lower total height with auto IRC/IBC step sizing.
 * 2. Floating 3D HUD Action Bar (Sims 4 Style):
 *    - Shape Morphing Segment: Straight, L-Shape, U-Shape, T-Shape.
 *    - Turn Direction Flip: Toggle Left vs Right.
 *    - Width Steppers: Quick ±10cm adjustments.
 *    - Landing Position Steppers: Move landing up / down.
 *    - Stringer Type Switcher: Solid, Mono, Double, Side, Box.
 *    - Railing Layout Switcher: Both, None, Left, Right.
 *    - Auto-Height Detection trigger.
 *    - Delete (✕).
 */
export class StairInteractiveSuite extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'StairInteractiveSuite';

        this.target = null; // Root THREE.Group of staircase
        this.stair = null;  // Canonical stair entity instance (e.g. PremiumStaircase)
        this.visible = false;

        this.handlesGroup = new THREE.Group();
        this.handlesGroup.name = 'Stair_HandlesGroup';
        this.handlesGroup.visible = false;
        this.add(this.handlesGroup);

        this._create3DHandles();
        this._createDOMHUD();
        this._createFloatingTooltip();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Drag interaction states
        this.isDragging = false;
        this.activeDragPart = null; // 'width_left' | 'width_right' | 'landing' | 'height'
        this.dragPlane = new THREE.Plane();
        this.dragStartPoint = new THREE.Vector3();
        this.initialWidth = 100;
        this.initialHeight = 300;
        this.initialF1Steps = 8;
        this.initialF2Steps = 7;
        this.initialTotalSteps = 15;

        // Auto-Height detection
        this.autoHeightEnabled = true;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onCameraChange = this._onCameraChange.bind(this);
        this._onGeometryUpdated = this._onGeometryUpdated.bind(this);

        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
            dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
            dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
        }

        if (this.ctx.controls) {
            this.ctx.controls.addEventListener('change', this._onCameraChange);
        }

        if (coreEventBus) {
            coreEventBus.on('EntityGeometryUpdated', this._onGeometryUpdated);
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                              3D HANDLE MESHES                              */
    /* -------------------------------------------------------------------------- */

    _create3DHandles() {
        // Transparent material for invisible hit volumes that Three.js Raycaster will detect
        const hitVolumeMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

        // --- 1. Width Handles (Cyan / Emerald) ---
        this.matWidth = new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 0.9 });
        this.matWidthHover = new THREE.MeshBasicMaterial({ color: 0x34d399, depthTest: false, transparent: true, opacity: 1.0 });

        const createWidthArrowMesh = (side) => {
            const grp = new THREE.Group();
            grp.name = `Stair_WidthHandle_${side}`;
            grp.userData = { isStairWidthHandle: true, side };

            // Double-ended arrow shape along X
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 18, 12), this.matWidth);
            shaft.rotation.z = Math.PI / 2;
            shaft.renderOrder = 1010;
            shaft.userData = { isStairWidthHandle: true, side };

            const head1 = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 12), this.matWidth);
            head1.position.x = 9;
            head1.rotation.z = -Math.PI / 2;
            head1.renderOrder = 1010;
            head1.userData = { isStairWidthHandle: true, side };

            const head2 = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 12), this.matWidth);
            head2.position.x = -9;
            head2.rotation.z = Math.PI / 2;
            head2.renderOrder = 1010;
            head2.userData = { isStairWidthHandle: true, side };

            // Generous invisible hit volume for touch/cursor
            const hit = new THREE.Mesh(new THREE.BoxGeometry(32, 14, 18), hitVolumeMat);
            hit.userData = { isStairWidthHandle: true, side };

            grp.add(shaft, head1, head2, hit);
            return grp;
        };

        this.widthHandleLeft = createWidthArrowMesh('left');
        this.widthHandleRight = createWidthArrowMesh('right');
        this.handlesGroup.add(this.widthHandleLeft, this.widthHandleRight);

        // --- 2. Landing / Bend Handle (Amber / Purple) ---
        this.matLanding = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 });
        this.matLandingHover = new THREE.MeshBasicMaterial({ color: 0xfbbf24, depthTest: false, transparent: true, opacity: 1.0 });

        this.landingHandle = new THREE.Group();
        this.landingHandle.name = 'Stair_LandingHandle';
        this.landingHandle.userData = { isStairLandingHandle: true };

        const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 1.8, 12, 32), this.matLanding);
        ring.rotation.x = Math.PI / 2;
        ring.renderOrder = 1010;
        ring.userData = { isStairLandingHandle: true };

        const centerSphere = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 16), this.matLanding);
        centerSphere.renderOrder = 1010;
        centerSphere.userData = { isStairLandingHandle: true };

        // Slide indicator arrows along Z
        const arrowZ1 = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7, 12), this.matLanding);
        arrowZ1.position.z = 10;
        arrowZ1.rotation.x = Math.PI / 2;
        arrowZ1.renderOrder = 1010;
        arrowZ1.userData = { isStairLandingHandle: true };

        const arrowZ2 = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7, 12), this.matLanding);
        arrowZ2.position.z = -10;
        arrowZ2.rotation.x = -Math.PI / 2;
        arrowZ2.renderOrder = 1010;
        arrowZ2.userData = { isStairLandingHandle: true };

        const landingHit = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 12), hitVolumeMat);
        landingHit.userData = { isStairLandingHandle: true };

        this.landingHandle.add(ring, centerSphere, arrowZ1, arrowZ2, landingHit);
        this.handlesGroup.add(this.landingHandle);

        // --- 3. Top Height Handle (Emerald Green) ---
        this.matHeight = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.matHeightHover = new THREE.MeshBasicMaterial({ color: 0x6ee7b7, depthTest: false, transparent: true, opacity: 1.0 });

        this.heightHandle = new THREE.Group();
        this.heightHandle.name = 'Stair_HeightHandle';
        this.heightHandle.userData = { isStairHeightHandle: true };

        const hShaft = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 16, 12), this.matHeight);
        hShaft.position.y = 8;
        hShaft.renderOrder = 1010;
        hShaft.userData = { isStairHeightHandle: true };

        const hHead = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 12), this.matHeight);
        hHead.position.y = 22;
        hHead.renderOrder = 1010;
        hHead.userData = { isStairHeightHandle: true };

        const hHit = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 32, 12), hitVolumeMat);
        hHit.position.y = 16;
        hHit.userData = { isStairHeightHandle: true };

        this.heightHandle.add(hShaft, hHead, hHit);
        this.handlesGroup.add(this.heightHandle);
    }

    /* -------------------------------------------------------------------------- */
    /*                             FLOATING DOM HUD                               */
    /* -------------------------------------------------------------------------- */

    _createDOMHUD() {
        if (typeof document === 'undefined') return;

        this.domHUD = document.createElement('div');
        this.domHUD.className = 'sims4-staircase-3d-hud';
        this.domHUD.style.cssText = `
            position: absolute;
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            pointer-events: auto;
            transform: translate(-50%, -100%);
            z-index: 9999;
            user-select: none;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            filter: drop-shadow(0 12px 32px rgba(0,0,0,0.65));
        `;

        ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick'].forEach(ev => {
            this.domHUD.addEventListener(ev, (e) => e.stopPropagation());
        });

        // Main Toolbar Container
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 7px;
            background: rgba(15, 23, 42, 0.96);
            border: 1.5px solid rgba(56, 189, 248, 0.7);
            border-radius: 14px;
            padding: 8px 12px;
            box-shadow: 0 0 24px rgba(56, 189, 248, 0.25);
            backdrop-filter: blur(16px);
            min-width: 290px;
        `;

        // Row 1: Header + Spec Badge
        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px;';

        const titleBox = document.createElement('div');
        titleBox.style.cssText = 'display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 12px; color: #38bdf8;';
        titleBox.innerHTML = `
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#00f0ff; box-shadow:0 0 8px #00f0ff;"></span>
            <span>Staircase</span>
        `;

        this.hudSpecBadge = document.createElement('div');
        this.hudSpecBadge.style.cssText = 'font-size: 11px; font-weight: 600; color: #cbd5e1;';
        this.hudSpecBadge.textContent = '100 × 330 cm • 15 Steps';

        headerRow.appendChild(titleBox);
        headerRow.appendChild(this.hudSpecBadge);
        container.appendChild(headerRow);

        // Row 2: Sims 4 Shape Morpher Segmented Buttons
        const shapeRow = document.createElement('div');
        shapeRow.style.cssText = `
            display: flex;
            gap: 4px;
            background: rgba(30, 41, 59, 0.7);
            padding: 3px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;

        const shapes = [
            { id: 'straight', label: '─ Straight', icon: '─' },
            { id: 'L', label: '⌐ L-Turn', icon: '⌐' },
            { id: 'U', label: '⊂ U-Turn', icon: '⊂' },
            { id: 'T', label: '┳ T-Split', icon: '┳' }
        ];

        this.shapeButtons = {};
        shapes.forEach(s => {
            const btn = document.createElement('button');
            btn.textContent = s.label;
            btn.title = `Morph to ${s.label}`;
            btn.style.cssText = `
                flex: 1;
                height: 26px;
                border: 1px solid transparent;
                background: transparent;
                color: #94a3b8;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.12s ease;
                white-space: nowrap;
            `;
            btn.onclick = (e) => {
                e.stopPropagation();
                if (this.stair) {
                    this.stair.setShape(s.id);
                    this._syncRealtimeUpdate();
                    this.update();
                }
            };
            this.shapeButtons[s.id] = btn;
            shapeRow.appendChild(btn);
        });
        container.appendChild(shapeRow);

        // Row 3: Interactive Action Controls
        const actionRow = document.createElement('div');
        actionRow.style.cssText = 'display: flex; align-items: center; gap: 5px; margin-top: 2px;';

        // 3.1 Flip Turn Button (⇄)
        this.btnFlip = document.createElement('button');
        this.btnFlip.innerHTML = `⇄ Flip`;
        this.btnFlip.title = 'Flip Stair Turn Direction (Left ⇄ Right)';
        this._styleActionButton(this.btnFlip, '#a855f7', 'rgba(168, 85, 247, 0.2)');
        this.btnFlip.onclick = (e) => {
            e.stopPropagation();
            if (this.stair) {
                this.stair.flipTurnDirection();
                this._syncRealtimeUpdate();
                this.update();
            }
        };

        // 3.2 Width Stepper [-] [W: 100cm] [+]
        const widthGroup = document.createElement('div');
        widthGroup.style.cssText = 'display: flex; align-items: center; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; overflow: hidden;';

        const btnWidthMinus = document.createElement('button');
        btnWidthMinus.textContent = '−';
        btnWidthMinus.style.cssText = 'width: 22px; height: 26px; border: none; background: transparent; color: #cbd5e1; font-weight: 800; cursor: pointer;';
        btnWidthMinus.onclick = (e) => {
            e.stopPropagation();
            if (this.stair) {
                this.stair.setWidth(Math.max(40, (this.stair.width || 100) - 10));
                this._syncRealtimeUpdate();
                this.update();
            }
        };

        this.elWidthVal = document.createElement('div');
        this.elWidthVal.style.cssText = 'font-size: 11px; font-weight: 700; color: #f8fafc; padding: 0 4px; min-width: 48px; text-align: center;';
        this.elWidthVal.textContent = '100 cm';

        const btnWidthPlus = document.createElement('button');
        btnWidthPlus.textContent = '+';
        btnWidthPlus.style.cssText = 'width: 22px; height: 26px; border: none; background: transparent; color: #cbd5e1; font-weight: 800; cursor: pointer;';
        btnWidthPlus.onclick = (e) => {
            e.stopPropagation();
            if (this.stair) {
                this.stair.setWidth(Math.min(300, (this.stair.width || 100) + 10));
                this._syncRealtimeUpdate();
                this.update();
            }
        };

        widthGroup.appendChild(btnWidthMinus);
        widthGroup.appendChild(this.elWidthVal);
        widthGroup.appendChild(btnWidthPlus);

        // 3.3 Landing Step Stepper [▲ / ▼]
        this.landingStepGroup = document.createElement('div');
        this.landingStepGroup.style.cssText = 'display: flex; align-items: center; gap: 3px;';

        const btnLandingUp = document.createElement('button');
        btnLandingUp.textContent = '▲';
        btnLandingUp.title = 'Raise Landing (+1 Step to Flight 1)';
        this._styleActionButton(btnLandingUp, '#f59e0b', 'rgba(245, 158, 11, 0.2)');
        btnLandingUp.style.padding = '0 7px';
        btnLandingUp.onclick = (e) => {
            e.stopPropagation();
            if (this.stair) {
                this.stair.adjustLanding(1);
                this._syncRealtimeUpdate();
                this.update();
            }
        };

        const btnLandingDown = document.createElement('button');
        btnLandingDown.textContent = '▼';
        btnLandingDown.title = 'Lower Landing (-1 Step to Flight 1)';
        this._styleActionButton(btnLandingDown, '#f59e0b', 'rgba(245, 158, 11, 0.2)');
        btnLandingDown.style.padding = '0 7px';
        btnLandingDown.onclick = (e) => {
            e.stopPropagation();
            if (this.stair) {
                this.stair.adjustLanding(-1);
                this._syncRealtimeUpdate();
                this.update();
            }
        };

        this.landingStepGroup.appendChild(btnLandingUp);
        this.landingStepGroup.appendChild(btnLandingDown);

        // 3.4 Stringer Style Cycle Button
        this.btnStringer = document.createElement('button');
        this.btnStringer.title = 'Change Stringer Base Style (Solid / Mono / Double / Side / Box)';
        this._styleActionButton(this.btnStringer, '#38bdf8', 'rgba(56, 189, 248, 0.2)');
        this.btnStringer.textContent = 'Solid';
        this.btnStringer.onclick = (e) => {
            e.stopPropagation();
            this._cycleStringerType();
        };

        // 3.5 Auto-Height Snap Button
        this.btnAutoHeight = document.createElement('button');
        this.btnAutoHeight.textContent = '⚡ Auto';
        this.btnAutoHeight.title = 'Auto-detect floor or platform height';
        this._styleActionButton(this.btnAutoHeight, '#10b981', 'rgba(16, 185, 129, 0.2)');
        this.btnAutoHeight.onclick = (e) => {
            e.stopPropagation();
            this._autoFitHeight();
        };

        // 3.6 Delete Button (✕)
        const btnDelete = document.createElement('button');
        btnDelete.innerHTML = '✕';
        btnDelete.title = 'Delete Staircase';
        this._styleActionButton(btnDelete, '#ef4444', 'rgba(239, 68, 68, 0.25)');
        btnDelete.style.fontWeight = '800';
        btnDelete.style.padding = '0 9px';
        btnDelete.onclick = (e) => {
            e.stopPropagation();
            this._deleteStaircase();
        };

        actionRow.appendChild(this.btnFlip);
        actionRow.appendChild(widthGroup);
        actionRow.appendChild(this.landingStepGroup);
        actionRow.appendChild(this.btnStringer);
        actionRow.appendChild(this.btnAutoHeight);
        actionRow.appendChild(btnDelete);
        container.appendChild(actionRow);

        this.domHUD.appendChild(container);
        document.body.appendChild(this.domHUD);
    }

    _styleActionButton(btn, color, bg) {
        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 26px;
            padding: 0 8px;
            border-radius: 6px;
            border: 1px solid ${color};
            background: ${bg};
            color: #ffffff;
            cursor: pointer;
            font-size: 11px;
            font-weight: 700;
            transition: all 0.12s ease;
            outline: none;
            white-space: nowrap;
        `;
        btn.onmouseenter = () => {
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = `0 0 10px ${color}`;
        };
        btn.onmouseleave = () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = 'none';
        };
    }

    /* -------------------------------------------------------------------------- */
    /*                         LIVE TOOLTIP BADGE                                 */
    /* -------------------------------------------------------------------------- */

    _createFloatingTooltip() {
        if (typeof document === 'undefined') return;

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'sims4-stair-tooltip';
        this.tooltip.style.cssText = `
            position: fixed;
            display: none;
            pointer-events: none;
            background: rgba(15, 23, 42, 0.95);
            border: 1.5px solid #00f0ff;
            color: #00f0ff;
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 20px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.6);
            transform: translate(-50%, -140%);
            z-index: 100000;
            white-space: nowrap;
        `;
        document.body.appendChild(this.tooltip);
    }

    _showTooltip(text, clientX, clientY) {
        if (!this.tooltip) return;
        this.tooltip.textContent = text;
        this.tooltip.style.left = `${clientX}px`;
        this.tooltip.style.top = `${clientY}px`;
        this.tooltip.style.display = 'block';
    }

    _hideTooltip() {
        if (this.tooltip) this.tooltip.style.display = 'none';
    }

    /* -------------------------------------------------------------------------- */
    /*                               ATTACH / DETACH                              */
    /* -------------------------------------------------------------------------- */

    attach(object) {
        if (!object) return;
        this.target = object.isGroup ? object : (object.parent?.isGroup ? object.parent : object);
        this.stair = object.userData?.entity || (object.parent?.userData?.entity) || null;

        if (!this.stair) {
            this.detach();
            return;
        }

        this.visible = true;
        this.handlesGroup.visible = true;
        if (this.domHUD) this.domHUD.style.display = 'flex';

        this.update();
    }

    detach() {
        this.target = null;
        this.stair = null;
        this.visible = false;
        this.handlesGroup.visible = false;
        this.isDragging = false;
        this.activeDragPart = null;
        if (this.domHUD) this.domHUD.style.display = 'none';
        this._hideTooltip();
    }

    _onGeometryUpdated({ entity, object3D }) {
        if (this.stair && entity && (entity === this.stair || entity.id === this.stair.id)) {
            this.target = object3D;
            this.update();
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                             UPDATE & POSITIONING                           */
    /* -------------------------------------------------------------------------- */

    update() {
        if (!this.stair || !this.target || !this.ctx.camera || !this.ctx.renderer) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            return;
        }

        const shape = (this.stair.shape || 'straight').toString();
        const width = Number(this.stair.width) || 100;
        const stepDepth = Number(this.stair.stepDepth) || 28;
        const height = Number(this.stair.height) || 300;
        const f1Steps = Number(this.stair.flight1Steps) || Number(this.stair.totalSteps) || 12;
        const f2Steps = Number(this.stair.flight2Steps) || 0;
        const totalSteps = shape === 'straight' ? f1Steps : (f1Steps + f2Steps);
        const stepHeight = height / (totalSteps > 0 ? totalSteps : 1);
        const landingSize = Number(this.stair.landingSize) || width;
        const gapWidth = Number(this.stair.gapWidth) || 20;
        const turnDir = this.stair.turnDirection || 'right';

        const l1 = f1Steps * stepDepth;
        const l2 = f2Steps * stepDepth;

        // Sync matrix world of target stair
        this.target.updateMatrixWorld(true);
        const stairMatrix = this.target.matrixWorld;

        // 1. Position Width Handles (Left & Right along Flight 1)
        const midF1Z = l1 * 0.5;
        const midF1Y = (f1Steps * 0.5) * stepHeight;

        const leftLocal = new THREE.Vector3(-width / 2, midF1Y, midF1Z);
        const rightLocal = new THREE.Vector3(width / 2, midF1Y, midF1Z);

        this.widthHandleLeft.position.copy(leftLocal.applyMatrix4(stairMatrix));
        this.widthHandleRight.position.copy(rightLocal.applyMatrix4(stairMatrix));
        this.widthHandleLeft.rotation.y = this.target.rotation.y;
        this.widthHandleRight.rotation.y = this.target.rotation.y;

        // 2. Position Landing / Bend Handle
        let landingLocal = new THREE.Vector3();
        if (shape === 'straight') {
            landingLocal.set(0, f1Steps * stepHeight, l1);
        } else if (shape === 'L') {
            landingLocal.set(0, f1Steps * stepHeight, l1 + landingSize / 2);
        } else if (shape === 'U') {
            const lx = turnDir === 'right' ? (width + gapWidth) / 2 : -(width + gapWidth) / 2;
            landingLocal.set(lx, f1Steps * stepHeight, l1 + landingSize / 2);
        } else if (shape === 'T') {
            landingLocal.set(0, f1Steps * stepHeight, l1 + landingSize / 2);
        }
        const landingWorld = landingLocal.clone().applyMatrix4(stairMatrix);
        this.landingHandle.position.copy(landingWorld);
        this.landingHandle.rotation.y = this.target.rotation.y;

        // 3. Position Top Height Handle
        let topLocal = new THREE.Vector3();
        if (shape === 'straight') {
            topLocal.set(0, height, l1);
        } else if (shape === 'L') {
            const f2X = turnDir === 'right' ? width / 2 : -width / 2;
            const f2Rot = turnDir === 'right' ? Math.PI / 2 : -Math.PI / 2;
            topLocal.set(
                f2X + Math.sin(f2Rot) * l2,
                height,
                l1 + landingSize / 2 + Math.cos(f2Rot) * l2
            );
        } else if (shape === 'U') {
            const f2X = turnDir === 'right' ? width + gapWidth : -width - gapWidth;
            topLocal.set(f2X, height, l1 - l2);
        } else if (shape === 'T') {
            topLocal.set(0, height, l1 + landingSize);
        }
        this.heightHandle.position.copy(topLocal.applyMatrix4(stairMatrix));
        this.heightHandle.rotation.y = this.target.rotation.y;

        // 4. Update HUD State
        this._updateHUDContent(shape, width, height, totalSteps, f1Steps, f2Steps, turnDir);

        // 5. Position HUD in Screen Coordinates
        this._updateHUDPosition(landingWorld);

        if (this.ctx.requestRender) {
            this.ctx.requestRender();
        }
    }

    _updateHUDContent(shape, width, height, totalSteps, f1Steps, f2Steps, turnDir) {
        if (!this.domHUD) return;

        // Spec Badge
        if (this.hudSpecBadge) {
            this.hudSpecBadge.textContent = `${Math.round(width)} × ${Math.round(height)} cm • ${totalSteps} Steps`;
        }

        // Active Shape button styling
        if (this.shapeButtons) {
            Object.entries(this.shapeButtons).forEach(([id, btn]) => {
                const isActive = (id === shape);
                btn.style.background = isActive ? 'rgba(56, 189, 248, 0.25)' : 'transparent';
                btn.style.borderColor = isActive ? '#38bdf8' : 'transparent';
                btn.style.color = isActive ? '#38bdf8' : '#94a3b8';
            });
        }

        // Width value
        if (this.elWidthVal) {
            this.elWidthVal.textContent = `${Math.round(width)} cm`;
        }

        // Flip button & landing steppers visibility
        const hasTurn = (shape === 'L' || shape === 'U');
        if (this.btnFlip) {
            this.btnFlip.style.display = hasTurn ? 'flex' : 'none';
            this.btnFlip.innerHTML = `⇄ ${turnDir === 'right' ? 'Right' : 'Left'}`;
        }
        if (this.landingStepGroup) {
            this.landingStepGroup.style.display = (shape !== 'straight') ? 'flex' : 'none';
        }

        // Stringer style label
        if (this.btnStringer && this.stair) {
            const stMap = { solid: 'Solid', mono: 'Mono', double: 'Double', side: 'Side', box: 'Box' };
            this.btnStringer.textContent = stMap[this.stair.stringerType || 'solid'] || 'Solid';
        }
    }

    _updateHUDPosition(worldPos) {
        if (!this.domHUD || !this.ctx.camera || !this.ctx.renderer) return;

        // Place HUD 35cm above the landing / center point
        const elevatedPos = worldPos.clone().add(new THREE.Vector3(0, 35, 0));
        const v = elevatedPos.project(this.ctx.camera);

        // Behind camera check
        if (v.z > 1) {
            this.domHUD.style.display = 'none';
            return;
        }

        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        const screenX = ((v.x + 1) / 2) * rect.width + rect.left;
        const screenY = ((-v.y + 1) / 2) * rect.height + rect.top;

        this.domHUD.style.left = `${screenX}px`;
        this.domHUD.style.top = `${screenY - 10}px`;
        this.domHUD.style.display = 'flex';
    }

    _onCameraChange() {
        if (this.visible && this.stair) {
            this.update();
        }
    }

    _syncRealtimeUpdate() {
        if (!this.stair) return;
        if (this.ctx.realtimeUpdate) {
            this.ctx.realtimeUpdate.markDirty(this.stair, 'geometry');
        }
        const planner = this.ctx.planner || (this.ctx.appState && this.ctx.appState.planner) || window.planner?.value || window.planner;
        if (planner?.syncAll) {
            planner.syncAll();
        }
        if (planner?.debouncedSaveHistory) {
            planner.debouncedSaveHistory();
        }
    }

    _resolveHandleData(mesh) {
        let curr = mesh;
        while (curr && curr !== this.handlesGroup && curr !== this) {
            const uData = curr.userData;
            if (uData && (uData.isStairWidthHandle || uData.isStairLandingHandle || uData.isStairHeightHandle)) {
                return uData;
            }
            curr = curr.parent;
        }
        return {};
    }

    /* -------------------------------------------------------------------------- */
    /*                         POINTER & DRAG INTERACTIONS                        */
    /* -------------------------------------------------------------------------- */

    isHandlingPointer(mouseVec2, camera) {
        this.raycaster.setFromCamera(mouseVec2, camera);
        const hits = this.raycaster.intersectObjects(this.handlesGroup.children, true);
        if (hits.length === 0) return false;
        const uData = this._resolveHandleData(hits[0].object);
        return Boolean(uData.isStairWidthHandle || uData.isStairLandingHandle || uData.isStairHeightHandle);
    }

    _onPointerDown(e) {
        if (!this.visible || !this.stair) return;
        if (e.button !== 0 && e.button !== undefined) return;

        const dom = this.ctx.renderer?.domElement;
        if (!dom || !this.ctx.camera) return;
        const rect = dom.getBoundingClientRect();

        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const hits = this.raycaster.intersectObjects(this.handlesGroup.children, true);

        if (hits.length > 0) {
            const uData = this._resolveHandleData(hits[0].object);

            if (uData.isStairWidthHandle || uData.isStairLandingHandle || uData.isStairHeightHandle) {
                e.stopPropagation();

                // Disable OrbitControls immediately to prevent camera spin while dragging handles
                if (this.ctx.controls) this.ctx.controls.enabled = false;
                if (this.ctx.cameraController && typeof this.ctx.cameraController.disableOrbit === 'function') {
                    this.ctx.cameraController.disableOrbit();
                }

                if (uData.isStairWidthHandle) {
                    this.isDragging = true;
                    this.activeDragPart = uData.side === 'left' ? 'width_left' : 'width_right';
                    this.initialWidth = Number(this.stair.width) || 100;
                    this.dragStartPoint.copy(hits[0].point);
                    try { if (dom.setPointerCapture && e.pointerId !== undefined) dom.setPointerCapture(e.pointerId); } catch (_) {}
                } else if (uData.isStairLandingHandle) {
                    this.isDragging = true;
                    this.activeDragPart = 'landing';
                    this.initialF1Steps = Number(this.stair.flight1Steps) || 8;
                    this.initialF2Steps = Number(this.stair.flight2Steps) || 7;
                    this.initialTotalSteps = (Number(this.stair.flight1Steps) || 8) + (Number(this.stair.flight2Steps) || 7);
                    this.dragStartPoint.copy(hits[0].point);
                    try { if (dom.setPointerCapture && e.pointerId !== undefined) dom.setPointerCapture(e.pointerId); } catch (_) {}
                } else if (uData.isStairHeightHandle) {
                    this.isDragging = true;
                    this.activeDragPart = 'height';
                    this.initialHeight = Number(this.stair.height) || 300;
                    this.dragStartPoint.copy(hits[0].point);
                    try { if (dom.setPointerCapture && e.pointerId !== undefined) dom.setPointerCapture(e.pointerId); } catch (_) {}
                }
            }
        }
    }

    _onPointerMove(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom || !this.ctx.camera) return;
        const rect = dom.getBoundingClientRect();

        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (this.isDragging && this.stair) {
            e.stopPropagation();
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

            if (this.activeDragPart === 'width_left' || this.activeDragPart === 'width_right') {
                // Dragging width horizontally: project onto floor plane
                const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.dragStartPoint.y);
                const currentPt = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(groundPlane, currentPt);

                if (currentPt) {
                    // Stair local lateral axis
                    const rotY = this.target.rotation.y;
                    const lateralVec = new THREE.Vector3(Math.cos(rotY), 0, -Math.sin(rotY));
                    const deltaX = currentPt.clone().sub(this.dragStartPoint).dot(lateralVec);

                    const sign = this.activeDragPart === 'width_right' ? 1 : -1;
                    const newWidth = Math.max(40, Math.min(300, Math.round((this.initialWidth + deltaX * 2 * sign) / 5) * 5));

                    this.stair.setWidth(newWidth);
                    this._syncRealtimeUpdate();
                    this._showTooltip(`Width: ${newWidth} cm`, e.clientX, e.clientY);
                    this.update();
                }
            } else if (this.activeDragPart === 'landing') {
                // Slide landing along flight run: project onto horizontal run plane
                const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.dragStartPoint.y);
                const currentPt = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(groundPlane, currentPt);

                if (currentPt) {
                    const rotY = this.target.rotation.y;
                    const fwdVec = new THREE.Vector3(-Math.sin(rotY), 0, -Math.cos(rotY));
                    const deltaRun = currentPt.clone().sub(this.dragStartPoint).dot(fwdVec);
                    const stepDepth = Number(this.stair.stepDepth) || 28;

                    const deltaSteps = Math.round(deltaRun / stepDepth);
                    const minF1 = 2;
                    const maxF1 = this.initialTotalSteps - 2;
                    const newF1 = Math.max(minF1, Math.min(maxF1, this.initialF1Steps + deltaSteps));
                    const newF2 = this.initialTotalSteps - newF1;

                    this.stair.flight1Steps = newF1;
                    this.stair.flight2Steps = newF2;
                    this.stair.update();
                    this._syncRealtimeUpdate();

                    this._showTooltip(`Landing: Step ${newF1} of ${this.initialTotalSteps} (F1: ${newF1} | F2: ${newF2})`, e.clientX, e.clientY);
                    this.update();
                }
            } else if (this.activeDragPart === 'height') {
                // Dragging top height vertically
                const camFwd = this.ctx.camera.getWorldDirection(new THREE.Vector3());
                const vertPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(camFwd.x, 0, camFwd.z).normalize(), this.dragStartPoint);
                const currentPt = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(vertPlane, currentPt);

                if (currentPt) {
                    const deltaY = currentPt.y - this.dragStartPoint.y;
                    let newH = Math.max(30, Math.min(600, Math.round(this.initialHeight + deltaY)));

                    // Auto-height platform/wall snap
                    if (this.autoHeightEnabled) {
                        const planner = this.ctx.planner || (this.ctx.appState && this.ctx.appState.planner) || window.planner?.value || window.planner;
                        if (planner) {
                            const detection = StairHeightDetector.detect({
                                x: this.stair.x || 0,
                                z: this.stair.y || 0,
                                elevation: this.stair.elevation || 0,
                                rotation: this.stair.rotation || 0,
                                preset: this.stair,
                                planner,
                                isCenterAnchored: false
                            });
                            if (detection.hasTarget && Math.abs(newH - detection.detectedHeight) < 15) {
                                newH = detection.detectedHeight;
                            }
                        }
                    }

                    this.stair.setHeight(newH);
                    this._syncRealtimeUpdate();
                    this._showTooltip(`Height: ${newH} cm (${this.stair.totalSteps} Steps)`, e.clientX, e.clientY);
                    this.update();
                }
            }
            return;
        }

        // Hover feedback
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const hits = this.raycaster.intersectObjects(this.handlesGroup.children, true);
        if (hits.length > 0) {
            const uData = this._resolveHandleData(hits[0].object);
            if (uData.isStairWidthHandle) dom.style.cursor = 'ew-resize';
            else if (uData.isStairLandingHandle) dom.style.cursor = 'grab';
            else if (uData.isStairHeightHandle) dom.style.cursor = 'ns-resize';
            else if (!this.isDragging) dom.style.cursor = 'default';
        } else if (!this.isDragging) {
            dom.style.cursor = 'default';
        }
    }

    _onPointerUp(e) {
        if (this.isDragging) {
            e.stopPropagation();
            this.isDragging = false;
            this.activeDragPart = null;
            this._hideTooltip();

            // Re-enable camera controls
            if (this.ctx.controls) this.ctx.controls.enabled = true;
            if (this.ctx.cameraController && typeof this.ctx.cameraController.enableOrbit === 'function') {
                this.ctx.cameraController.enableOrbit();
            }

            const dom = this.ctx.renderer?.domElement;
            if (dom && dom.releasePointerCapture && e.pointerId !== undefined) {
                try { dom.releasePointerCapture(e.pointerId); } catch (err) {}
            }

            this._syncRealtimeUpdate();
            this.update();
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                              QUICK HUD ACTIONS                             */
    /* -------------------------------------------------------------------------- */

    _cycleStringerType() {
        if (!this.stair) return;
        const types = ['solid', 'mono', 'double', 'side', 'box'];
        const current = this.stair.stringerType || 'solid';
        const next = types[(types.indexOf(current) + 1) % types.length];
        this.stair.stringerType = next;
        this.stair.update();
        this._syncRealtimeUpdate();
        this.update();
    }

    _autoFitHeight() {
        if (!this.stair) return;
        const planner = this.ctx.planner || (this.ctx.appState && this.ctx.appState.planner) || window.planner?.value || window.planner;
        if (!planner) return;

        const detection = StairHeightDetector.detect({
            x: this.stair.x || 0,
            z: this.stair.y || 0,
            elevation: this.stair.elevation || 0,
            rotation: this.stair.rotation || 0,
            preset: this.stair,
            planner,
            isCenterAnchored: false
        });

        if (detection.hasTarget) {
            this.stair.setHeight(detection.detectedHeight);
            this._syncRealtimeUpdate();
            this.update();
        }
    }

    _deleteStaircase() {
        if (!this.stair) return;
        const planner = this.stair.planner || this.ctx.planner;
        this.detach();
        if (typeof this.stair.remove === 'function') {
            this.stair.remove();
        }
        if (planner) {
            planner.selectEntity(null);
            if (planner.syncAll) planner.syncAll();
            if (planner.debouncedSaveHistory) planner.debouncedSaveHistory();
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                                   CLEANUP                                  */
    /* -------------------------------------------------------------------------- */

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

        if (coreEventBus) {
            coreEventBus.off('EntityGeometryUpdated', this._onGeometryUpdated);
        }

        if (this.domHUD && this.domHUD.parentElement) {
            this.domHUD.parentElement.removeChild(this.domHUD);
        }
        if (this.tooltip && this.tooltip.parentElement) {
            this.tooltip.parentElement.removeChild(this.tooltip);
        }
    }
}

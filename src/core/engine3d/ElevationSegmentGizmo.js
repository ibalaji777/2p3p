import * as THREE from 'three';
import { 
    sproutBendAtEndpoint, 
    setNodeCornerStyle, 
    getConnectedWallCorner, 
    wrapElevationSegmentToAdjacentWall,
    snapEndpointToWallCorner,
    getEndpointCornerStatus,
    rotateElevationSegment,
    findNearbyElevationSegments,
    joinElevationSegments,
    splitElevationSegmentAtNode,
    sproutCornerPreset,
    initEntitySegments,
    setSegmentLength,
    setSegmentDimensions,
    getSegmentAngle,
    rotateSegmentArm,
    setSegmentPerpendicular,
    adjustArmElevation,
    setArmElevation
} from '../../features/elevation/elevationSegment.registry.js';
import { renderElevationSegment3D } from '../../features/elevation/elevationSegment.renderer3d.js';
import { ElevationFacadeEngine } from '../elevation/ElevationFacadeEngine.js';

/**
 * ElevationSegmentGizmo
 * 
 * Professional Lumion / SketchUp-Grade 3D Builder Suite for Elevation Segments:
 * 1. Dual-End Push/Pull Handles (◄ ● ►): Positioned at BOTH Start and End of the segment/chain.
 *    Smooth real-time continuous stretching with magnetic snaps to wall corners and floor levels.
 * 2. Pull-to-Extrude Arrows (↑ / ↓): Contextual directional arrows at both ends.
 *    Click or drag to smoothly extrude new connected vertical or horizontal arms in real time.
 * 3. Bend Junction Nodes (◆): Drag to reposition corners; click to toggle Sharp 45° vs Curved Fillet.
 * 4. Concentric Arc Fillets: Live radius adjustment with zero pinch points or texture distortion.
 * 5. Strict In-Place Updates: Geometry updates strictly in place, maintaining 100% stable selection.
 * 6. Continuous Lumion Highlight: Real-time glowing 3D wireframe contour tracking the active beam.
 * 7. Wall-to-Wall L-Bends: Automatic 90° corner wrap around adjacent connected building walls.
 */
export class ElevationSegmentGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.target = null;
        this.visible = false;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.isDragging = false;
        this.activeHandle = null;
        this.dragPlane = new THREE.Plane();
        this.dragStartPoint = new THREE.Vector3();
        this.initialPointPos = new THREE.Vector3();
        this.activeBendIndex = -1;

        this.handles = new THREE.Group();
        this.handles.name = 'ElevationSegment_Handles';
        this.add(this.handles);
        this.highlightMesh = null;

        // Materials (Vibrant Lumion / SketchUp Neon CAD Styling)
        this.matPushPull = new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 0.95 });
        this.matPushPullHover = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false, transparent: true, opacity: 1.0 });
        this.matArrowUp = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.matArrowDown = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 });
        this.matArrowSide = new THREE.MeshBasicMaterial({ color: 0x6366f1, depthTest: false, transparent: true, opacity: 0.95 });
        this.matBend = new THREE.MeshBasicMaterial({ color: 0xa855f7, depthTest: false, transparent: true, opacity: 0.95 });
        this.matBendActive = new THREE.MeshBasicMaterial({ color: 0xd946ef, depthTest: false, transparent: true, opacity: 1.0 });

        // Active Sub-Tool Mode ('stretch' | 'sprout' | 'extrude' | 'elevate_arm' | 'adjust_arm' | 'corners' | 'rotate' | 'angle' | 'dims' | 'all')
        this.activeMode = 'extrude';
        this.scopeMode = 'arm';
        this.activeSegmentIndex = 0;
        this.domHUD = null;
        this.tooltip = null;
        this.hudSpecBadge = null;
        this.modeButtons = {};

        this._createLiveBadge();
        this._createFloatingTooltip();
        this._createDOMHUD();

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onKeyDown = (e) => {
            if (!this.visible) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                this.commitChanges();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelChanges();
            }
        };
        this._onCameraChange = () => {
            if (this.visible && this.domHUD) {
                this._updateHUD();
            }
        };
        this._onExternalSetMode = (e) => {
            if (e.detail && e.detail.mode) {
                this.setMode(e.detail.mode);
            }
        };
        this._onExternalSelectArm = (e) => {
            if (e.detail && e.detail.armIndex !== undefined) {
                this.activeSegmentIndex = e.detail.armIndex;
                this.updateHandles();
                this._updateHUD();
            }
        };

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
            window.addEventListener('keydown', this._onKeyDown);
            window.addEventListener('elevation-segment-set-mode', this._onExternalSetMode);
            window.addEventListener('elevation-segment-select-arm', this._onExternalSelectArm);
        }
    }

    setMode(mode) {
        if (!['stretch', 'sprout', 'extrude', 'elevate_arm', 'adjust_arm', 'corners', 'rotate', 'angle', 'dims', 'all'].includes(mode)) return;
        this.activeMode = mode;
        this._updateHUDModeButtons();
        this.updateHandles();
        if (this.ctx.requestRender) this.ctx.requestRender('elevation_segment_mode_change', 2);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('elevation-segment-mode-change', {
                detail: { mode, entity: this._getEntity() }
            }));
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                         LIVE TOOLTIP BADGE (TOASTER)                       */
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
        el.addEventListener('touchend', cancelTouch, { passive: true });
        el.addEventListener('touchcancel', cancelTouch, { passive: true });
    }

    /* -------------------------------------------------------------------------- */
    /*                         WALL RAISER-STYLE 3D HUD MENU                      */
    /* -------------------------------------------------------------------------- */

    _createDOMHUD() {
        if (typeof document === 'undefined') return;

        this.domHUD = document.createElement('div');
        this.domHUD.className = 'sms4-room-speech-hud sms4-wall-3d-hud sms4-elevation-segment-3d-hud';
        this.domHUD.style.cssText = `
            position: fixed;
            display: none;
            flex-direction: column;
            align-items: center;
            pointer-events: auto;
            transform: translate(-50%, -100%);
            z-index: 100003;
            user-select: none;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            filter: drop-shadow(0 12px 28px rgba(0, 0, 0, 0.45));
        `;

        ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'touchstart', 'touchend', 'dblclick'].forEach(evt => {
            this.domHUD.addEventListener(evt, (e) => e.stopPropagation());
        });

        // Top Info Pill (Docked above bubble card)
        const headerRow = document.createElement('div');
        headerRow.className = 'sms4-room-header-row sms4-hud-header-row';
        headerRow.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: fit-content;
            margin-bottom: 2px;
            box-sizing: border-box;
            flex-shrink: 0;
        `;

        this.hudSpecBadge = document.createElement('div');
        this.hudSpecBadge.className = 'sms4-room-badge sms4-hud-spec-badge';
        this.hudSpecBadge.style.cssText = `
            font-size: 9.5px;
            font-weight: 700;
            color: #334155;
            background: rgba(255, 255, 255, 0.94);
            border: 1px solid rgba(226, 232, 240, 0.9);
            border-radius: 9999px;
            padding: 2.5px 8px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            white-space: nowrap;
            line-height: 1.2;
            box-sizing: border-box;
            width: fit-content;
            flex-shrink: 0;
        `;
        this.hudSpecBadge.textContent = 'Len 200cm • W:30 • D:40 • 1 Arm';
        headerRow.appendChild(this.hudSpecBadge);

        // Main Frosted Glass Bubble Card
        const bubble = document.createElement('div');
        bubble.className = 'sms4-hud-bubble';
        bubble.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 3px;
            background: rgba(255, 255, 255, 0.96);
            border: 1px solid rgba(226, 232, 240, 0.95);
            border-radius: 10px;
            padding: 3px 6px;
            box-shadow: 0 10px 25px -4px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            box-sizing: border-box;
            width: fit-content;
            max-width: min(calc(100vw - 24px), 380px);
            pointer-events: auto;
            user-select: none;
            -webkit-user-select: none;
            line-height: 1;
        `;

        // ROW 1: Scope Switcher + Mode Switcher + Steppers + Done/Close
        const mainRow = document.createElement('div');
        mainRow.className = 'sms4-hud-row-primary';
        mainRow.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            gap: 3px;
            flex-shrink: 0;
        `;
        this.hudRowPrimary = mainRow;

        // 1. Scope Switcher Capsule (Active Arm vs Entire Chain)
        const scopeContainer = document.createElement('div');
        scopeContainer.className = 'sms4-hud-scope-container';
        scopeContainer.style.cssText = `
            display: flex;
            align-items: center;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 9999px;
            padding: 1.5px;
            gap: 1.5px;
            flex-shrink: 0;
        `;

        this.btnScopeArm = document.createElement('button');
        this.btnScopeArm.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`;
        this.btnScopeArm.title = 'Select Segment (Arm)';
        this.btnScopeArm.style.cssText = `
            border: none;
            border-radius: 9999px;
            width: 22px;
            height: 22px;
            cursor: pointer;
            transition: all 0.15s ease;
            outline: none;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
            white-space: nowrap;
        `;
        this.btnScopeArm.onclick = (e) => {
            e.stopPropagation();
            this.setScopeMode('arm');
        };
        this._attachTooltip(this.btnScopeArm, 'Select Segment (Arm)', 'Highlight & adjust this arm (drag length, angle, dims)');

        this.btnScopeChain = document.createElement('button');
        this.btnScopeChain.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
        this.btnScopeChain.title = 'Edit Entire Chain';
        this.btnScopeChain.style.cssText = `
            border: none;
            border-radius: 9999px;
            width: 22px;
            height: 22px;
            cursor: pointer;
            transition: all 0.15s ease;
            outline: none;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
            white-space: nowrap;
        `;
        this.btnScopeChain.onclick = (e) => {
            e.stopPropagation();
            this.setScopeMode('chain');
        };
        this._attachTooltip(this.btnScopeChain, 'Whole Chain Scope', 'Adjust overall elevation, move, rotate, duplicate entire assembly');

        scopeContainer.appendChild(this.btnScopeArm);
        scopeContainer.appendChild(this.btnScopeChain);

        const makeDivider = () => {
            const d = document.createElement('div');
            d.style.cssText = `width: 1px; height: 14px; background: #e2e8f0; margin: 0 1px; flex-shrink: 0;`;
            return d;
        };

        // 2. Mode Switcher Capsule (Extrude, Angle, Elevate Arm, Corners, Dimensions)
        this.modeSwitcherContainer = document.createElement('div');
        this.modeSwitcherContainer.className = 'sms4-hud-mode-container';
        this.modeSwitcherContainer.style.cssText = `
            display: flex;
            align-items: center;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 9999px;
            padding: 1.5px;
            gap: 1.5px;
            flex-shrink: 0;
        `;

        this.hudButtons = [
            {
                id: 'extrude',
                icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l-5-5 5-5M17 7l5 5-5 5M2 12h20"/></svg>`,
                title: 'Extend & Sprouts',
                subtitle: 'Drag end handles (◄ ● ►) or sprout arrows to stretch & extrude'
            },
            {
                id: 'angle',
                icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
                title: 'Segment Angle',
                subtitle: 'Drag 3D rotation ring (⭮) to freely rotate arm on wall plane'
            },
            {
                id: 'elevate_arm',
                icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M8 7l4-4 4 4"/><path d="M8 17l4 4 4-4"/><rect x="3" y="10" width="18" height="4" rx="2"/></svg>`,
                title: 'Elevation Height',
                subtitle: 'Drag 3D elevation handle (▲ Elev ▼) up/down on wall'
            },
            {
                id: 'corners',
                icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V3h18"/><path d="M9 9l6 6"/></svg>`,
                title: 'Corners & Miters',
                subtitle: 'Drag corner junction grips (◆) or toggle sharp/fillet/bevel'
            },
            {
                id: 'dims',
                icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M6 8v8"/><path d="M12 9v6"/><path d="M18 8v8"/></svg>`,
                title: 'Dimensions (W & D)',
                subtitle: 'Drag thickness/drop & depth/overhang handles directly in 3D'
            }
        ];

        this.modeButtons = {};

        this.hudButtons.forEach(btn => {
            const el = document.createElement('button');
            el.innerHTML = btn.icon;
            el.title = btn.title;
            el.style.cssText = `
                border: none;
                border-radius: 9999px;
                width: 22px;
                height: 22px;
                cursor: pointer;
                transition: all 0.15s ease;
                outline: none;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                line-height: 1;
                white-space: nowrap;
            `;
            el.onclick = (e) => {
                e.stopPropagation();
                this.setMode(btn.id);
            };
            this._attachTooltip(el, btn.title, btn.subtitle);
            this.modeButtons[btn.id] = el;
            this.modeSwitcherContainer.appendChild(el);
        });

        // Add compatibility aliases for tests:
        this.modeButtons.adjust_arm = this.modeButtons.elevate_arm;
        this.modeButtons.stretch = this.modeButtons.extrude;
        this.modeButtons.sprout = this.modeButtons.extrude;
        this.modeButtons.all = this.modeButtons.extrude;
        this.modeButtons.rotate = this.modeButtons.angle;

        // 3. Steppers Container (↓ and ↑)
        this.btnStepDown = document.createElement('button');
        this.btnStepDown.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
        this.btnStepDown.title = 'Lower Value';
        this._styleBubbleButton(this.btnStepDown, '#f59e0b');
        this.btnStepDown.onclick = (e) => {
            e.stopPropagation();
            this.stepTargetDown();
        };
        this._attachTooltip(this.btnStepDown, 'Step Down', 'Decrease selected parameter (-10cm / -5cm)');

        this.btnStepUp = document.createElement('button');
        this.btnStepUp.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
        this.btnStepUp.title = 'Raise Value';
        this._styleBubbleButton(this.btnStepUp, '#10b981');
        this.btnStepUp.onclick = (e) => {
            e.stopPropagation();
            this.stepTargetUp();
        };
        this._attachTooltip(this.btnStepUp, 'Step Up', 'Increase selected parameter (+10cm / +5cm)');

        const steppersContainer = document.createElement('div');
        steppersContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 2px;
            flex-shrink: 0;
        `;
        steppersContainer.appendChild(this.btnStepDown);
        steppersContainer.appendChild(this.btnStepUp);

        // 4. Header Right: Done & Cancel Actions
        const headerRight = document.createElement('div');
        headerRight.style.cssText = `
            display: flex;
            align-items: center;
            gap: 2px;
            flex-shrink: 0;
        `;

        this.btnDone = document.createElement('button');
        this.btnDone.className = 'sms4-hud-btn-done';
        this.btnDone.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        this.btnDone.title = 'Finish & Exit (Enter)';
        this.btnDone.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            padding: 0;
            border-radius: 9999px;
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #15803d;
            cursor: pointer;
            transition: all 0.15s ease;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
            outline: none;
            line-height: 1;
            white-space: nowrap;
        `;
        this.btnDone.onmouseenter = () => {
            this.btnDone.style.background = '#dcfce7';
            this.btnDone.style.transform = 'translateY(-1px)';
        };
        this.btnDone.onmouseleave = () => {
            this.btnDone.style.background = '#f0fdf4';
            this.btnDone.style.transform = 'translateY(0)';
        };
        this.btnDone.onclick = (e) => {
            e.stopPropagation();
            this.commitChanges();
        };
        this._attachTooltip(this.btnDone, 'Done', 'Finish & apply changes (Enter)');

        this.btnCancel = document.createElement('button');
        this.btnCancel.className = 'sms4-hud-btn-cancel';
        this.btnCancel.innerHTML = `✕`;
        this.btnCancel.title = 'Close & Discard (Esc)';
        this.btnCancel.style.cssText = `
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
        this.btnCancel.onmouseenter = () => {
            this.btnCancel.style.background = '#fee2e2';
            this.btnCancel.style.color = '#ef4444';
        };
        this.btnCancel.onmouseleave = () => {
            this.btnCancel.style.background = 'transparent';
            this.btnCancel.style.color = '#94a3b8';
        };
        this.btnCancel.onclick = (e) => {
            e.stopPropagation();
            this.cancelChanges();
        };
        this._attachTooltip(this.btnCancel, 'Cancel', 'Revert modifications and close (Esc)');

        headerRight.appendChild(this.btnDone);
        headerRight.appendChild(this.btnCancel);

        // Assemble Row 1
        mainRow.appendChild(scopeContainer);
        mainRow.appendChild(makeDivider());
        mainRow.appendChild(this.modeSwitcherContainer);
        mainRow.appendChild(makeDivider());
        mainRow.appendChild(steppersContainer);
        mainRow.appendChild(makeDivider());
        mainRow.appendChild(headerRight);

        // ROW 2 & ROW 3: Bottom Submenu Container
        this.bottomSubmenuContainer = document.createElement('div');
        this.bottomSubmenuContainer.className = 'sms4-hud-row-secondary sms4-room-bottom-submenu';
        this.bottomSubmenuContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 3px;
            width: 100%;
            padding-top: 2px;
            border-top: 1px solid #f1f5f9;
        `;
        this.hudContextStrip = this.bottomSubmenuContainer;

        // Row 2: Presets Capsule
        this.presetsPills = document.createElement('div');
        this.presetsPills.className = 'sms4-room-height-pills';
        this.presetsPills.style.cssText = `
            display: flex;
            align-items: center;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 9999px;
            padding: 1.5px;
            gap: 1.5px;
            height: 18px;
            box-sizing: border-box;
        `;

        // Row 3: 5 Circular White Action Buttons (Rotate CCW, Rotate CW, Move, Copy, Delete)
        this.actionsContainer = document.createElement('div');
        this.actionsContainer.className = 'sms4-room-actions';
        this.actionsContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 2.5px;
            justify-content: center;
        `;

        const btnRotateCCW = document.createElement('button');
        btnRotateCCW.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
        btnRotateCCW.title = 'Rotate CCW (90°)';
        this._styleBubbleButton(btnRotateCCW, '#38bdf8');
        btnRotateCCW.onclick = (e) => { e.stopPropagation(); this.rotateSegment(-90); };
        this._attachTooltip(btnRotateCCW, 'Rotate CCW', 'Rotate 90° counter-clockwise');

        const btnRotateCW = document.createElement('button');
        btnRotateCW.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
        btnRotateCW.title = 'Rotate CW (90°)';
        this._styleBubbleButton(btnRotateCW, '#38bdf8');
        btnRotateCW.onclick = (e) => { e.stopPropagation(); this.rotateSegment(90); };
        this._attachTooltip(btnRotateCW, 'Rotate CW', 'Rotate 90° clockwise');

        this.btnMove = document.createElement('button');
        this.btnMove.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`;
        this.btnMove.title = 'Move Segment along wall';
        this._styleBubbleButton(this.btnMove, '#818cf8');
        this.btnMove.onclick = (e) => { e.stopPropagation(); this.activateMoveMode(); };
        this._attachTooltip(this.btnMove, 'Move Segment', 'Drag segment across wall');

        this.btnCopy = document.createElement('button');
        this.btnCopy.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        this.btnCopy.title = 'Duplicate Segment';
        this._styleBubbleButton(this.btnCopy, '#a78bfa');
        this.btnCopy.onclick = (e) => { e.stopPropagation(); this.duplicateSegment(); };
        this._attachTooltip(this.btnCopy, 'Duplicate Segment', 'Clone elevation segment on wall');

        this.btnDelete = document.createElement('button');
        this.btnDelete.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
        this.btnDelete.title = 'Delete Segment';
        this._styleBubbleButton(this.btnDelete, '#ef4444');
        this.btnDelete.onclick = (e) => { e.stopPropagation(); this.deleteSegment(); };
        this._attachTooltip(this.btnDelete, 'Delete Segment', 'Remove elevation feature from wall');

        this.actionsContainer.appendChild(btnRotateCCW);
        this.actionsContainer.appendChild(btnRotateCW);
        this.actionsContainer.appendChild(this.btnMove);
        this.actionsContainer.appendChild(this.btnCopy);
        this.actionsContainer.appendChild(this.btnDelete);

        // Assemble Submenu Container
        this.bottomSubmenuContainer.appendChild(this.presetsPills);
        this.bottomSubmenuContainer.appendChild(this.actionsContainer);

        // Assemble Card
        bubble.appendChild(mainRow);
        bubble.appendChild(this.bottomSubmenuContainer);

        // Speech bubble triangular tail pointing downward
        const tail = document.createElement('div');
        tail.className = 'sms4-hud-tail';
        tail.style.cssText = `
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 5px solid rgba(255, 255, 255, 0.96);
            margin-top: -1px;
            filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.06));
        `;

        this.domHUD.appendChild(headerRow);
        this.domHUD.appendChild(bubble);
        this.domHUD.appendChild(tail);

        document.body.appendChild(this.domHUD);
        this._updateHUDControls();
    }

    _styleScopeButton(btn, isActive) {
        if (!btn) return;
        if (isActive) {
            btn.style.background = '#ffffff';
            btn.style.color = '#2563eb';
            btn.style.fontWeight = '700';
            btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = '#64748b';
            btn.style.fontWeight = '600';
            btn.style.boxShadow = 'none';
        }
    }

    _styleModeButton(btn, isActive, accentColor = '#2563eb') {
        if (!btn) return;
        if (isActive) {
            btn.style.background = '#ffffff';
            btn.style.color = accentColor;
            btn.style.fontWeight = '700';
            btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = '#64748b';
            btn.style.fontWeight = '600';
            btn.style.boxShadow = 'none';
        }
    }

    _styleBubbleButton(btn, accentColor, isWide = false) {
        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${isWide ? '36px' : '22px'};
            height: 22px;
            border-radius: 9999px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            color: #334155;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
            outline: none;
            padding: 0;
            line-height: 1;
            white-space: nowrap;
            flex-shrink: 0;
        `;
        btn.onmouseenter = () => {
            btn.style.borderColor = '#cbd5e1';
            btn.style.background = '#f8fafc';
            btn.style.transform = 'translateY(-1px)';
        };
        btn.onmouseleave = () => {
            btn.style.borderColor = '#e2e8f0';
            btn.style.background = '#ffffff';
            btn.style.transform = 'translateY(0)';
        };
    }

    setScopeMode(mode) {
        this.scopeMode = mode;
        this._updateHUDControls();
        const entity = this._getEntity();
        if (entity) this._updateHUDContextStrip(entity);
        if (this.ctx.requestRender) this.ctx.requestRender('scope_mode_changed');
    }

    stepTargetDown() {
        if (this.scopeMode === 'chain') {
            this.stepElevation(-10);
            return;
        }
        if (this.activeMode === 'elevate_arm' || this.activeMode === 'adjust_arm') {
            this.stepArmElevation(-10);
        } else if (this.activeMode === 'dims') {
            this.stepDimWidth(-5);
        } else if (this.activeMode === 'corners') {
            this.stepCornerRadius(-5);
        } else {
            this.stepLength(-10);
        }
    }

    stepTargetUp() {
        if (this.scopeMode === 'chain') {
            this.stepElevation(10);
            return;
        }
        if (this.activeMode === 'elevate_arm' || this.activeMode === 'adjust_arm') {
            this.stepArmElevation(10);
        } else if (this.activeMode === 'dims') {
            this.stepDimWidth(5);
        } else if (this.activeMode === 'corners') {
            this.stepCornerRadius(5);
        } else {
            this.stepLength(10);
        }
    }

    stepElevation(deltaY) {
        const entity = this._getEntity();
        if (!entity || !entity.points || entity.points.length === 0) return;
        entity.points.forEach(p => {
            p.y = Math.max(0, (p.y || 0) + deltaY);
        });
        if (entity.nodes) {
            entity.nodes.forEach(n => {
                n.y = Math.max(0, (n.y || 0) + deltaY);
            });
        }
        entity.elevation = entity.points[0].y;
        this._rebuildEntityInPlace(entity);
        this.updateHandles();
        this._updateHUD();
        if (this.ctx.requestRender) this.ctx.requestRender('elevation_stepped', 2);
        if (typeof window !== 'undefined' && window.coreEventBus) {
            window.coreEventBus.emit('SAVE_HISTORY', { action: 'Step Elevation Height' });
        }
    }

    stepArmElevation(deltaY, armIndex = null) {
        const entity = this._getEntity();
        if (!entity || !entity.points || entity.points.length < 2) return;
        if (this.scopeMode === 'chain') {
            this.stepElevation(deltaY);
            return;
        }
        const numArms = entity.points.length - 1;
        const targetArm = (armIndex !== null && armIndex !== undefined)
            ? armIndex
            : Math.min(Math.max(0, this.activeSegmentIndex || 0), numArms - 1);

        adjustArmElevation(entity, targetArm, deltaY);

        this._rebuildEntityInPlace(entity);
        this.updateHandles();
        this._updateHUD();
        if (this.ctx.requestRender) this.ctx.requestRender('arm_elevation_stepped', 2);
        if (typeof window !== 'undefined' && window.coreEventBus) {
            window.coreEventBus.emit('SAVE_HISTORY', { action: 'Step Arm Height' });
        }
    }

    setArmElevation(targetY, armIndex = null) {
        const entity = this._getEntity();
        if (!entity || !entity.points || entity.points.length < 2) return;
        const numArms = entity.points.length - 1;
        const targetArm = (armIndex !== null && armIndex !== undefined)
            ? armIndex
            : Math.min(Math.max(0, this.activeSegmentIndex || 0), numArms - 1);

        setArmElevation(entity, targetArm, targetY);

        this._rebuildEntityInPlace(entity);
        this.updateHandles();
        this._updateHUD();
        if (this.ctx.requestRender) this.ctx.requestRender('arm_elevation_set', 2);
        if (typeof window !== 'undefined' && window.coreEventBus) {
            window.coreEventBus.emit('SAVE_HISTORY', { action: 'Set Arm Height' });
        }
    }

    stepLength(deltaLen) {
        const entity = this._getEntity();
        if (!entity || !entity.points || entity.points.length < 2) return;
        const numArms = entity.points.length - 1;
        const armIdx = Math.min(Math.max(0, this.activeSegmentIndex || 0), numArms - 1);
        const p1 = entity.points[armIdx];
        const p2 = entity.points[armIdx + 1];
        const curLen = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        if (curLen < 0.001) return;
        const newLen = Math.max(25, Math.round((curLen + deltaLen) / 5) * 5);
        const dir = {
            x: (p2.x - p1.x) / curLen,
            y: (p2.y - p1.y) / curLen,
            z: (p2.z - p1.z) / curLen
        };
        p2.x = Math.round(p1.x + dir.x * newLen);
        p2.y = Math.round(p1.y + dir.y * newLen);
        p2.z = Math.round(p1.z + dir.z * newLen);
        if (entity.nodes && entity.nodes[armIdx + 1]) {
            entity.nodes[armIdx + 1].x = p2.x;
            entity.nodes[armIdx + 1].y = p2.y;
            entity.nodes[armIdx + 1].z = p2.z;
        }
        initEntitySegments(entity);
        this._rebuildEntityInPlace(entity);
        this.updateHandles();
        this._updateHUD();
        if (this.ctx.requestRender) this.ctx.requestRender('length_stepped', 2);
        if (typeof window !== 'undefined' && window.coreEventBus) {
            window.coreEventBus.emit('SAVE_HISTORY', { action: 'Step Segment Length' });
        }
    }

    setLengthPreset(targetLen) {
        const entity = this._getEntity();
        if (!entity || !entity.points || entity.points.length < 2) return;
        const numArms = entity.points.length - 1;
        const armIdx = Math.min(Math.max(0, this.activeSegmentIndex || 0), numArms - 1);
        const p1 = entity.points[armIdx];
        const p2 = entity.points[armIdx + 1];
        const curLen = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        if (curLen < 0.001) return;
        const newLen = Math.max(25, targetLen);
        const dir = {
            x: (p2.x - p1.x) / curLen,
            y: (p2.y - p1.y) / curLen,
            z: (p2.z - p1.z) / curLen
        };
        p2.x = Math.round(p1.x + dir.x * newLen);
        p2.y = Math.round(p1.y + dir.y * newLen);
        p2.z = Math.round(p1.z + dir.z * newLen);
        if (entity.nodes && entity.nodes[armIdx + 1]) {
            entity.nodes[armIdx + 1].x = p2.x;
            entity.nodes[armIdx + 1].y = p2.y;
            entity.nodes[armIdx + 1].z = p2.z;
        }
        initEntitySegments(entity);
        this._rebuildEntityInPlace(entity);
        this.updateHandles();
        this._updateHUD();
        if (this.ctx.requestRender) this.ctx.requestRender('length_preset_set', 2);
        if (typeof window !== 'undefined' && window.coreEventBus) {
            window.coreEventBus.emit('SAVE_HISTORY', { action: 'Set Segment Length' });
        }
    }

    stepDimWidth(deltaW) {
        const entity = this._getEntity();
        if (!entity) return;
        initEntitySegments(entity);
        const curW = entity.width || 30;
        const newW = Math.max(15, Math.min(150, curW + deltaW));
        entity.width = newW;
        const armIdx = Math.min(Math.max(0, this.activeSegmentIndex || 0), (entity.points?.length || 2) - 2);
        setSegmentDimensions(entity, armIdx, { width: newW });
        this._rebuildEntityInPlace(entity);
        this.updateHandles();
        this._updateHUD();
    }

    stepCornerRadius(deltaR) {
        const entity = this._getEntity();
        if (!entity || !entity.points || entity.points.length < 3) return;
        const bendIdx = this.activeBendIndex >= 1 ? this.activeBendIndex : 1;
        const pt = entity.points[bendIdx];
        if (!pt) return;
        const curR = pt.radius || 25;
        const newR = Math.max(5, Math.min(100, curR + deltaR));
        setNodeCornerStyle(entity, bendIdx, pt.cornerStyle || 'fillet', newR);
        this._rebuildEntityInPlace(entity);
        this.updateHandles();
        this._updateHUD();
    }

    rotateSegment(deltaDeg) {
        const entity = this._getEntity();
        if (!entity || !entity.points || entity.points.length < 2) return;
        if (this.scopeMode === 'arm') {
            const numArms = entity.points.length - 1;
            const curArm = Math.min(Math.max(0, this.activeSegmentIndex || 0), numArms - 1);
            const curAngle = getSegmentAngle(entity, curArm);
            const newAngle = ((curAngle + deltaDeg) % 360 + 360) % 360;
            rotateSegmentArm(entity, curArm, newAngle);
        } else {
            const curAngle = entity.rotation || 0;
            rotateElevationSegment(entity, ((curAngle + deltaDeg) % 360 + 360) % 360);
        }
        this._rebuildEntityInPlace(entity);
        this.updateHandles();
        this._updateHUD();
        if (this.ctx.requestRender) this.ctx.requestRender('segment_rotated', 2);
        if (typeof window !== 'undefined' && window.coreEventBus) {
            window.coreEventBus.emit('SAVE_HISTORY', { action: 'Rotate Elevation Segment' });
        }
    }

    duplicateSegment() {
        const entity = this._getEntity();
        if (!entity || !entity.points) return;
        const planner = this.ctx.planner || window.planner?.value || window.planner;
        if (!planner) return;

        const newId = 'elevation_segment_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
        const cloned = JSON.parse(JSON.stringify(entity));
        cloned.id = newId;
        cloned.name = (entity.name || 'Elevation Segment') + ' (Copy)';
        delete cloned.mesh3D;

        cloned.points.forEach(p => {
            p.y = (p.y || 150) + 20;
        });
        if (cloned.nodes) {
            cloned.nodes.forEach(n => {
                n.y = (n.y || 150) + 20;
            });
        }
        cloned.elevation = (cloned.elevation || 150) + 20;

        if (!Array.isArray(planner.elevationSegments)) {
            planner.elevationSegments = [];
        }
        planner.elevationSegments.push(cloned);

        if (typeof planner.syncAll === 'function') {
            planner.syncAll();
        } else if (typeof planner.requestDraw === 'function') {
            planner.requestDraw();
        }

        this._rebuildEntityInPlace(cloned);
        this.attach(cloned);
        if (this.ctx.requestRender) this.ctx.requestRender('segment_duplicated', 2);
        if (typeof window !== 'undefined' && window.coreEventBus) {
            window.coreEventBus.emit('SAVE_HISTORY', { action: 'Duplicate Elevation Segment' });
        }
    }

    activateMoveMode() {
        const entity = this._getEntity();
        if (!entity) return;
        this.setMode('all');
        this._updateBadge('Drag along wall to reposition', entity.mesh3D?.position || new THREE.Vector3());
    }

    _updateHUDControls() {
        if (!this.domHUD) return;
        if (this.btnScopeArm && this.btnScopeChain) {
            this._styleScopeButton(this.btnScopeArm, this.scopeMode === 'arm');
            this._styleScopeButton(this.btnScopeChain, this.scopeMode === 'chain');
        }
        this._updateHUDModeButtons();
    }

    _updateHUDModeButtons() {
        if (!this.modeButtons) return;
        ['extrude', 'elevate_arm', 'corners', 'dims'].forEach(mId => {
            const btn = this.modeButtons[mId];
            if (!btn) return;
            const isActive = (mId === this.activeMode) ||
                (mId === 'extrude' && (this.activeMode === 'stretch' || this.activeMode === 'sprout')) ||
                (mId === 'elevate_arm' && (this.activeMode === 'adjust_arm')) ||
                (mId === 'corners' && this.activeMode === 'corners') ||
                (mId === 'dims' && this.activeMode === 'dims');
            this._styleModeButton(btn, isActive, '#2563eb');
        });
    }

    _updateHUDContextStrip(entity) {
        if (!this.bottomSubmenuContainer) return;
        this.bottomSubmenuContainer.innerHTML = '';
        let hasSubmenu = false;

        const planner = this.ctx.planner || window.planner?.value || window.planner;
        const n = entity.points?.length || 0;
        const numArms = Math.max(1, n - 1);
        const curArm = Math.min(Math.max(0, this.activeSegmentIndex || 0), numArms - 1);

        // 1. Arm Selectors Capsule (When multi-arm entity: [ Arm 1 ] [ Arm 2 ])
        if (numArms > 1 && (this.activeMode === 'elevate_arm' || this.activeMode === 'adjust_arm' || this.activeMode === 'dims' || this.activeMode === 'angle')) {
            const armCapsule = document.createElement('div');
            armCapsule.className = 'sms4-hud-arm-selectors';
            armCapsule.style.cssText = `
                display: flex;
                align-items: center;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                border-radius: 9999px;
                padding: 1.5px;
                gap: 1.5px;
                height: 18px;
                box-sizing: border-box;
                margin-bottom: 2px;
            `;
            for (let a = 0; a < numArms; a++) {
                const isSelected = (curArm === a);
                const armBtn = document.createElement('button');
                armBtn.textContent = `Arm ${a + 1}`;
                armBtn.title = `Select Arm ${a + 1} for editing`;
                armBtn.style.cssText = `
                    border: none;
                    background: ${isSelected ? '#ffffff' : 'transparent'};
                    color: ${isSelected ? '#2563eb' : '#64748b'};
                    font-weight: ${isSelected ? '700' : '600'};
                    box-shadow: ${isSelected ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};
                    font-size: 9px;
                    padding: 0 5px;
                    height: 15px;
                    border-radius: 9999px;
                    cursor: pointer;
                    transition: all 0.12s;
                    line-height: 1;
                    white-space: nowrap;
                `;
                armBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.activeSegmentIndex = a;
                    this.updateHandles();
                    this._updateHUD();
                };
                this._attachTooltip(armBtn, `Arm ${a + 1}`, `Select arm ${a + 1} for independent adjustment`);
                armCapsule.appendChild(armBtn);
            }
            this.bottomSubmenuContainer.appendChild(armCapsule);
            hasSubmenu = true;
        }

        // 2. Presets Capsule [ ▼   preset1   preset2   preset3   ▲ ]
        this.presetsPills = document.createElement('div');
        this.presetsPills.className = 'sms4-room-height-pills';
        this.presetsPills.style.cssText = `
            display: flex;
            align-items: center;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 9999px;
            padding: 1.5px;
            gap: 1.5px;
            height: 18px;
            box-sizing: border-box;
        `;

        const btnMinus = document.createElement('button');
        btnMinus.innerHTML = `▼`;
        btnMinus.style.cssText = `
            border: none;
            background: transparent;
            color: #64748b;
            font-size: 8px;
            font-weight: 800;
            padding: 0 3px;
            height: 15px;
            border-radius: 9999px;
            cursor: pointer;
            transition: all 0.12s;
            line-height: 1;
        `;
        btnMinus.onmouseenter = () => { btnMinus.style.color = '#2563eb'; };
        btnMinus.onmouseleave = () => { btnMinus.style.color = '#64748b'; };
        btnMinus.onclick = (e) => {
            e.stopPropagation();
            this.stepTargetDown();
        };
        this._attachTooltip(btnMinus, 'Decrease Value', '-10cm / -5cm');
        this.presetsPills.appendChild(btnMinus);

        const addPresetPill = (label, title, onClick, isActive = false) => {
            const pill = document.createElement('button');
            pill.textContent = label;
            pill.title = title;
            pill.style.cssText = `
                border: none;
                background: ${isActive ? '#ffffff' : 'transparent'};
                color: ${isActive ? '#2563eb' : '#64748b'};
                font-weight: ${isActive ? '700' : '600'};
                box-shadow: ${isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};
                font-size: 9px;
                padding: 0 4px;
                height: 15px;
                border-radius: 9999px;
                cursor: pointer;
                transition: all 0.12s;
                line-height: 1;
                white-space: nowrap;
            `;
            pill.onclick = (e) => {
                e.stopPropagation();
                onClick();
            };
            this._attachTooltip(pill, label, title);
            this.presetsPills.appendChild(pill);
        };

        if (this.activeMode === 'elevate_arm' || this.activeMode === 'adjust_arm') {
            const curY = Math.round((entity.points[curArm]?.y + entity.points[curArm + 1]?.y) / 2 || entity.elevation || 150);
            const presets = [120, 150, 180, 210, 240];
            presets.forEach(yVal => {
                const isActive = (curY === yVal);
                addPresetPill(`${yVal}`, `Set Arm Height to ${yVal}cm`, () => {
                    this.setArmElevation(yVal, curArm);
                }, isActive);
            });
            hasSubmenu = true;
        } else if (this.activeMode === 'corners') {
            const presets = [
                { id: 'square_90', label: '90°', desc: 'Square 90° corner' },
                { id: 'diagonal_45', label: '45°', desc: 'Diagonal 45° corner' },
                { id: 'fillet', label: 'Fillet', desc: 'Curved fillet corner' },
                { id: 'bevel', label: 'Bevel', desc: 'Beveled miter corner' }
            ];
            presets.forEach(pr => {
                addPresetPill(pr.label, pr.desc, () => {
                    if (pr.id === 'fillet' || pr.id === 'bevel' || pr.id === 'sharp') {
                        const bendIdx = this.activeBendIndex >= 1 ? this.activeBendIndex : (n > 2 ? 1 : 0);
                        setNodeCornerStyle(entity, bendIdx, pr.id, 25);
                        this._rebuildEntityInPlace(entity);
                        this.updateHandles();
                        this._updateHUD();
                    } else {
                        sproutCornerPreset(entity, n - 1, pr.id);
                        this._rebuildEntityInPlace(entity);
                        this.updateHandles();
                        this._updateHUD();
                    }
                });
            });
            hasSubmenu = true;
        } else if (this.activeMode === 'dims') {
            const currentSeg = entity.segments?.[curArm] || {};
            const curW = Math.round(currentSeg.width || entity.width || 30);
            const curD = Math.round(currentSeg.depth || entity.depth || 40);
            const presets = [
                { label: 'W:20', val: 20, type: 'w' },
                { label: 'W:30', val: 30, type: 'w' },
                { label: 'D:40', val: 40, type: 'd' },
                { label: 'D:60', val: 60, type: 'd' }
            ];
            presets.forEach(pr => {
                const isActive = (pr.type === 'w' ? curW === pr.val : curD === pr.val);
                addPresetPill(pr.label, `Set ${pr.type === 'w' ? 'Width' : 'Depth'} to ${pr.val}cm`, () => {
                    if (pr.type === 'w') {
                        setSegmentDimensions(entity, curArm, { width: pr.val });
                        entity.width = pr.val;
                    } else {
                        setSegmentDimensions(entity, curArm, { depth: pr.val });
                        entity.depth = pr.val;
                    }
                    this._rebuildEntityInPlace(entity);
                    this.updateHandles();
                    this._updateHUD();
                }, isActive);
            });
            hasSubmenu = true;
        } else {
            // Default extrude / length presets
            const pA = entity.points[curArm];
            const pB = entity.points[curArm + 1];
            const curLen = Math.round(pA && pB ? Math.hypot(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z) : 200);
            const presets = [100, 150, 200, 250];
            presets.forEach(lVal => {
                const isActive = Math.abs(curLen - lVal) <= 5;
                addPresetPill(`${lVal}`, `Set Arm Length to ${lVal}cm`, () => {
                    this.setLengthPreset(lVal);
                }, isActive);
            });
            hasSubmenu = true;
        }

        const btnPlus = document.createElement('button');
        btnPlus.innerHTML = `▲`;
        btnPlus.style.cssText = `
            border: none;
            background: transparent;
            color: #64748b;
            font-size: 8px;
            font-weight: 800;
            padding: 0 3px;
            height: 15px;
            border-radius: 9999px;
            cursor: pointer;
            transition: all 0.12s;
            line-height: 1;
        `;
        btnPlus.onmouseenter = () => { btnPlus.style.color = '#2563eb'; };
        btnPlus.onmouseleave = () => { btnPlus.style.color = '#64748b'; };
        btnPlus.onclick = (e) => {
            e.stopPropagation();
            this.stepTargetUp();
        };
        this._attachTooltip(btnPlus, 'Increase Value', '+10cm / +5cm');
        this.presetsPills.appendChild(btnPlus);

        this.bottomSubmenuContainer.appendChild(this.presetsPills);

        // 3. Context Action Pills: Corner Wrap & Auto-Join
        const connStart = getConnectedWallCorner(entity, 0, planner, 85);
        const connEnd = getConnectedWallCorner(entity, n - 1, planner, 85);
        const conn = connEnd || connStart;
        if (conn) {
            const endIdx = connEnd ? n - 1 : 0;
            const wrapBtn = document.createElement('button');
            wrapBtn.innerHTML = `↳ Wrap Corner (${conn.adjWall?.name || 'Wall'})`;
            wrapBtn.style.cssText = `
                border: 1px solid #bbf7d0;
                background: #f0fdf4;
                color: #15803d;
                font-size: 9px;
                font-weight: 700;
                padding: 1.5px 6px;
                border-radius: 9999px;
                cursor: pointer;
                transition: all 0.12s;
                line-height: 1;
                margin-top: 2px;
            `;
            wrapBtn.onclick = (e) => {
                e.stopPropagation();
                const res = wrapElevationSegmentToAdjacentWall(entity, endIdx, planner);
                if (res) {
                    this._rebuildEntityInPlace(entity);
                    this.updateHandles();
                    this._updateHUD();
                    if (this.ctx.requestRender) this.ctx.requestRender('corner_wrapped', 2);
                    if (typeof window !== 'undefined' && window.coreEventBus) {
                        window.coreEventBus.emit('SAVE_HISTORY', { action: 'Wrap Elevation Segment Around Corner' });
                    }
                }
            };
            this._attachTooltip(wrapBtn, 'Wrap Corner', `Extend onto adjacent ${conn.adjWall?.name || 'wall'} at 90°`);
            this.bottomSubmenuContainer.appendChild(wrapBtn);
            hasSubmenu = true;
        }

        const nearby = (planner && entity) ? findNearbyElevationSegments(planner, entity, 45) : [];
        if (nearby.length > 0) {
            const joinBtn = document.createElement('button');
            joinBtn.innerHTML = `🔗 Auto-Join (${nearby[0].distance}cm)`;
            joinBtn.style.cssText = `
                border: 1px solid #bfdbfe;
                background: #eff6ff;
                color: #1d4ed8;
                font-size: 9px;
                font-weight: 700;
                padding: 1.5px 6px;
                border-radius: 9999px;
                cursor: pointer;
                transition: all 0.12s;
                line-height: 1;
                margin-top: 2px;
            `;
            joinBtn.onclick = (e) => {
                e.stopPropagation();
                const merged = joinElevationSegments(planner, entity, nearby[0].segment, 45);
                if (merged) {
                    this._rebuildEntityInPlace(merged);
                    this.updateHandles();
                    this._updateHUD();
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('elevation-segment-updated', { detail: { entity: merged } }));
                    }
                }
            };
            this._attachTooltip(joinBtn, 'Auto-Join', `Merge with nearby ${nearby[0].segment?.name || 'segment'}`);
            this.bottomSubmenuContainer.appendChild(joinBtn);
            hasSubmenu = true;
        }

        // 4. Row 3: Always add the 5 white circular action buttons (Rotate CCW, Rotate CW, Move, Copy, Delete)
        if (this.actionsContainer) {
            this.bottomSubmenuContainer.appendChild(this.actionsContainer);
            hasSubmenu = true;
        }

        this.bottomSubmenuContainer.style.display = hasSubmenu ? 'flex' : 'none';
    }

    _updateHUD() {
        if (!this.domHUD) return;
        if (!this.visible || this.isDragging) {
            this.domHUD.style.display = 'none';
            if (this.hudContextStrip) this.hudContextStrip.style.display = 'none';
            return;
        }

        const entity = this._getEntity();
        if (!entity || !entity.points || entity.points.length < 2) {
            this.domHUD.style.display = 'none';
            if (this.hudContextStrip) this.hudContextStrip.style.display = 'none';
            return;
        }

        let sumX = 0, sumY = 0, sumZ = 0, maxY = -Infinity;
        entity.points.forEach(p => {
            sumX += p.x;
            sumY += p.y;
            sumZ += p.z;
            if (p.y > maxY) maxY = p.y;
        });
        const n = entity.points.length;
        const width = entity.width || 30;
        const depth = entity.depth || 40;

        let totalLen = 0;
        for (let i = 0; i < n - 1; i++) {
            totalLen += Math.hypot(
                entity.points[i + 1].x - entity.points[i].x,
                entity.points[i + 1].y - entity.points[i].y,
                entity.points[i + 1].z - entity.points[i].z
            );
        }
        if (this.hudSpecBadge) {
            this.hudSpecBadge.textContent = `${Math.round(totalLen)}cm • W:${Math.round(width)} • D:${Math.round(depth)}`;
        }

        const normal = entity.points[0].normal ? new THREE.Vector3(entity.points[0].normal.x, entity.points[0].normal.y, entity.points[0].normal.z).normalize() : new THREE.Vector3(0, 0, 1);
        const centerWorld = new THREE.Vector3(
            sumX / n + normal.x * (depth / 2),
            maxY + (width / 2) + 14,
            sumZ / n + normal.z * (depth / 2)
        );

        const screenPos = centerWorld.clone().project(this.ctx.camera);
        const dom = this.ctx.renderer?.domElement;
        const rect = dom ? dom.getBoundingClientRect() : { left: 0, top: 0, width: (typeof window !== 'undefined' ? window.innerWidth : 800), height: (typeof window !== 'undefined' ? window.innerHeight : 600) };

        let screenX = ((screenPos.x + 1) / 2) * rect.width + rect.left;
        let screenY = ((-screenPos.y + 1) / 2) * rect.height + rect.top;

        const hudW = this.domHUD.offsetWidth || 180;
        const hudH = this.domHUD.offsetHeight || 32;
        screenX = Math.max(rect.left + hudW / 2 + 10, Math.min(rect.left + rect.width - hudW / 2 - 10, screenX));
        screenY = Math.max(rect.top + hudH + 10, Math.min(rect.top + rect.height - 10, screenY));

        this.domHUD.style.left = `${screenX}px`;
        this.domHUD.style.top = `${screenY}px`;
        this.domHUD.style.transform = 'translate(-50%, -100%)';
        this.domHUD.style.display = 'flex';

        this._updateHUDModeButtons();
        this._updateHUDContextStrip(entity);
    }

    _createLiveBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'elevation-segment-badge';
        this.domBadge.style.cssText = `
            position: absolute;
            display: none;
            transform: translate(-50%, -100%);
            padding: 6px 14px;
            border-radius: 20px;
            background: rgba(15, 23, 42, 0.95);
            border: 2px solid #00f0ff;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 240, 255, 0.45);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
            pointer-events: none;
            z-index: 10000;
            user-select: none;
            letter-spacing: 0.3px;
        `;
        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domBadge);
    }

    _updateBadge(text, worldPos) {
        if (!this.domBadge) return;
        if (!text) {
            this.domBadge.style.display = 'none';
            return;
        }

        const screenPos = worldPos.clone().project(this.ctx.camera);
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        const x = ((screenPos.x + 1) / 2) * rect.width + rect.left;
        const y = ((-screenPos.y + 1) / 2) * rect.height + rect.top;

        this.domBadge.innerHTML = text;
        this.domBadge.style.left = `${x}px`;
        this.domBadge.style.top = `${y - 14}px`;
        this.domBadge.style.display = 'block';
    }

    updateMouse(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    attach(target) {
        if (!target) return;
        this.target = target;
        this.visible = true;
        this.isDragging = false;
        this.activeHandle = null;
        this.activeMode = this.activeMode || 'extrude';

        // Capture initial state snapshot for clean cancellation without deletion
        const entity = this._getEntity();
        if (entity && (!this._initialSnapshot || this._initialSnapshot.id !== entity.id)) {
            this._initialSnapshot = JSON.parse(JSON.stringify({
                id: entity.id,
                points: entity.points ? entity.points.map(p => ({ ...p })) : [],
                width: entity.width || 30,
                depth: entity.depth || 40,
                segments: entity.segments ? entity.segments.map(s => ({ ...s })) : [],
                rotation: entity.rotation || 0,
                wallId: entity.wallId,
                wallIds: entity.wallIds ? [...entity.wallIds] : (entity.wallId ? [entity.wallId] : [])
            }));
        }

        this.updateHandles();
        this._updateHUD();
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.isDragging = false;
        this.activeHandle = null;
        if (this.ctx.controls) this.ctx.controls.enabled = true;
        if (this.highlightMesh) {
            this.handles.remove(this.highlightMesh);
            if (this.highlightMesh.geometry) this.highlightMesh.geometry.dispose();
            this.highlightMesh = null;
        }
        this.handles.clear();
        if (this.domBadge) this.domBadge.style.display = 'none';
        if (this.domHUD) this.domHUD.style.display = 'none';
        if (this.hudContextStrip) this.hudContextStrip.style.display = 'none';
        this._hideTooltip();
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    /**
     * Commits all changes made to the elevation segment (Done button / Enter key).
     * Saves history, clears gizmo state, and cleanly deselects without destroying geometry.
     */
    commitChanges() {
        const entity = this._getEntity();
        if (!entity) {
            this.detach();
            return;
        }
        this._initialSnapshot = null;
        this.detach();
        if (this.ctx?.app?.stateManager?.saveSnapshot) {
            this.ctx.app.stateManager.saveSnapshot('Modify Elevation Segment');
        } else if (this.ctx?.saveHistory) {
            this.ctx.saveHistory('Modify Elevation Segment');
        } else if (this.ctx?.planner?.debouncedSaveHistory) {
            this.ctx.planner.debouncedSaveHistory();
        }
        const planner = this.ctx.planner || this.ctx.app?.planner || (typeof window !== 'undefined' ? window.planner : null);
        if (planner && typeof planner.selectEntity === 'function') {
            planner.selectEntity(null);
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('elevation-segment-committed', { detail: { entity } }));
        }
    }

    /**
     * Cancels editing and reverts the elevation segment to its initial snapshot (Cancel button / Esc key).
     * NEVER deletes the element; cleanly restores original points, dimensions, and wall bindings.
     */
    cancelChanges() {
        const entity = this._getEntity();
        if (entity && this._initialSnapshot) {
            if (this._initialSnapshot.points) {
                entity.points = this._initialSnapshot.points.map(p => ({ ...p }));
            }
            if (this._initialSnapshot.width !== undefined) entity.width = this._initialSnapshot.width;
            if (this._initialSnapshot.depth !== undefined) entity.depth = this._initialSnapshot.depth;
            if (this._initialSnapshot.segments !== undefined) {
                entity.segments = this._initialSnapshot.segments.map(s => ({ ...s }));
            }
            if (this._initialSnapshot.rotation !== undefined) entity.rotation = this._initialSnapshot.rotation;
            if (this._initialSnapshot.wallId !== undefined) entity.wallId = this._initialSnapshot.wallId;
            if (this._initialSnapshot.wallIds !== undefined) entity.wallIds = [...this._initialSnapshot.wallIds];

            if (entity.nodes && entity.points) {
                entity.nodes = entity.points.map((p, idx) => ({
                    id: entity.nodes[idx]?.id || `${entity.id}_n${idx}`,
                    ...p
                }));
            }

            this._rebuildEntityInPlace(entity);
            const planner = this.ctx.planner || this.ctx.app?.planner || (typeof window !== 'undefined' ? window.planner : null);
            if (planner && typeof planner.requestDraw === 'function') {
                planner.requestDraw();
            }
        }
        this._initialSnapshot = null;
        this.detach();
        const planner = this.ctx.planner || this.ctx.app?.planner || (typeof window !== 'undefined' ? window.planner : null);
        if (planner && typeof planner.selectEntity === 'function') {
            planner.selectEntity(null);
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('elevation-segment-cancelled', { detail: { entity } }));
        }
    }

    /**
     * Explicitly deletes the elevation segment from the wall upon user clicking the trash button.
     */
    deleteSegment() {
        const entity = this._getEntity();
        if (!entity) {
            this.detach();
            return;
        }
        this._initialSnapshot = null;
        const planner = this.ctx.planner || this.ctx.app?.planner || (typeof window !== 'undefined' ? window.planner : null);
        if (planner) {
            ElevationFacadeEngine.deleteElevationSegment(planner, entity, this.ctx);
        }
        this.detach();
    }

    _getEntity() {
        if (!this.target) return null;
        if (this.target.userData && this.target.userData.entity) return this.target.userData.entity;
        return this.target;
    }

    _getBodyMesh() {
        const entity = this._getEntity();
        if (!entity || !entity.mesh3D) return null;
        return entity.mesh3D.children.find(c => c.userData?.isElevationBody);
    }

    _updateHighlight(geo) {
        if (this.highlightMesh) {
            this.handles.remove(this.highlightMesh);
            if (this.highlightMesh.geometry) this.highlightMesh.geometry.dispose();
            this.highlightMesh = null;
        }
        if (!geo) return;

        const edgesGeo = new THREE.EdgesGeometry(geo, 20);
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.highlightMesh = new THREE.LineSegments(edgesGeo, lineMat);
        this.highlightMesh.renderOrder = 2490;
        this.highlightMesh.userData = { isHighlightLine: true };
        this.handles.add(this.highlightMesh);
    }

    updateHandles() {
        this.handles.clear();
        const entity = this._getEntity();
        if (!entity || !entity.points || entity.points.length < 2) return;

        const bodyMesh = this._getBodyMesh();
        if (bodyMesh && bodyMesh.geometry) {
            this._updateHighlight(bodyMesh.geometry);
        }

        const pts = entity.points;
        const n = pts.length;
        const depth = entity.depth || 40;
        const width = entity.width || 30;

        const showStretch = (this.activeMode === 'stretch' || this.activeMode === 'extrude' || this.activeMode === 'all');
        const showSprout = (this.activeMode === 'sprout' || this.activeMode === 'extrude' || this.activeMode === 'all');
        const showCorners = (this.activeMode === 'corners' || this.activeMode === 'all');
        const showAngle = (this.activeMode === 'angle' || this.activeMode === 'rotate' || this.activeMode === 'all');
        const showDims = (this.activeMode === 'dims' || this.activeMode === 'all');

        // 0. Body Drag Hitboxes for "Select and Drag Adjust":
        // Clicking and dragging anywhere on the beam slides it along the wall plane (elevation and horizontal position).
        for (let i = 0; i < n - 1; i++) {
            const pA = pts[i];
            const pB = pts[i + 1];
            const segDir = new THREE.Vector3(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);
            const segLen = segDir.length();
            if (segLen < 1) continue;

            const segMid = new THREE.Vector3((pA.x + pB.x) / 2, (pA.y + pB.y) / 2, (pA.z + pB.z) / 2);
            const norm = pA.normal ? new THREE.Vector3(pA.normal.x, pA.normal.y, pA.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const centerOff = norm.clone().multiplyScalar(depth / 2);
            const boxCenter = segMid.clone().add(centerOff);

            const bodyHitGeo = new THREE.BoxGeometry(segLen, width + 6, depth + 6);
            const bodyHitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
            const bodyHitMesh = new THREE.Mesh(bodyHitGeo, bodyHitMat);
            bodyHitMesh.position.copy(boxCenter);
            bodyHitMesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), segDir.clone().normalize());
            bodyHitMesh.userData = { isElevationHandle: true, handleType: 'body_drag', armIndex: i };
            bodyHitMesh.renderOrder = 2480;
            this.handles.add(bodyHitMesh);
        }

        // DUAL-END CONTROLS: Both Start (Index 0) and End (Index N - 1)
        [0, n - 1].forEach((ptIdx) => {
            const pt = pts[ptIdx];
            const neighborIdx = (ptIdx === 0) ? 1 : n - 2;
            const neighbor = pts[neighborIdx];

            const dir = new THREE.Vector3(pt.x - neighbor.x, pt.y - neighbor.y, pt.z - neighbor.z).normalize();
            const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const centerOffset = normal.clone().multiplyScalar(depth / 2);
            const capCenter = new THREE.Vector3(pt.x, pt.y, pt.z).add(centerOffset);
            const arrowDist = (width / 2) + 16;

            // 1. Dual-End Push/Pull Disc Handle (◄ ● ►)
            if (showStretch) {
                this._createPushPullHandle(ptIdx, capCenter.x, capCenter.y, capCenter.z, dir);
            }

            // 2. Contextual Directional Sprouts (Cleaned: NO redundant arrows along push/pull axis, NO perp)
            if (showSprout) {
                const isHorizontal = Math.abs(dir.y) < 0.7;

                if (isHorizontal) {
                    // For horizontal beams, push_pull handles tangent. Sprouts: Up, Down, Out, In
                    this._createExtrudeArrow(ptIdx, 'up', capCenter.x, capCenter.y + arrowDist, capCenter.z, 0x10b981, new THREE.Vector3(0, 1, 0));
                    this._createExtrudeArrow(ptIdx, 'down', capCenter.x, capCenter.y - arrowDist, capCenter.z, 0xf59e0b, new THREE.Vector3(0, -1, 0));
                } else {
                    // For vertical beams, push_pull handles Y. Sprouts: Left, Right, Out, In
                    const wallTangent = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
                    if (wallTangent.lengthSq() > 0.001) {
                        const leftPos = capCenter.clone().sub(wallTangent.clone().multiplyScalar(arrowDist));
                        const rightPos = capCenter.clone().add(wallTangent.clone().multiplyScalar(arrowDist));
                        this._createExtrudeArrow(ptIdx, 'left', leftPos.x, leftPos.y, leftPos.z, 0x6366f1, wallTangent.clone().negate());
                        this._createExtrudeArrow(ptIdx, 'right', rightPos.x, rightPos.y, rightPos.z, 0x8b5cf6, wallTangent.clone());
                    }
                }

                // Away (+N) and Toward (-N) relative to wall face
                const outPos = capCenter.clone().add(normal.clone().multiplyScalar(arrowDist));
                const inPos = capCenter.clone().sub(normal.clone().multiplyScalar(arrowDist));
                this._createExtrudeArrow(ptIdx, 'away_wall', outPos.x, outPos.y, outPos.z, 0x06b6d4, normal.clone());
                this._createExtrudeArrow(ptIdx, 'toward_wall', inPos.x, inPos.y, inPos.z, 0xf43f5e, normal.clone().negate());
            }

            // 3. Wall Corner Wrap Handle (↳): If near an adjacent connected wall corner
            const conn = getConnectedWallCorner(entity, ptIdx, this.ctx?.planner, 85);
            if (conn) {
                const { adjWall, adjCornerIsStart } = conn;
                const ap1 = (adjWall.startAnchor && typeof adjWall.startAnchor.position === 'function') ? adjWall.startAnchor.position() : (adjWall.startAnchor || { x: adjWall.startX || 0, y: adjWall.startY || 0 });
                const ap2 = (adjWall.endAnchor && typeof adjWall.endAnchor.position === 'function') ? adjWall.endAnchor.position() : (adjWall.endAnchor || { x: adjWall.endX || 0, y: adjWall.endY || 0 });
                const adjStart = adjCornerIsStart ? ap1 : ap2;
                const adjEnd = adjCornerIsStart ? ap2 : ap1;
                const awdx = adjEnd.x - adjStart.x;
                const awdy = adjEnd.y - adjStart.y;
                const awLen = Math.hypot(awdx, awdy) || 1;
                const adjDir = new THREE.Vector3(awdx / awLen, 0, awdy / awLen);

                const wrapOrigin = capCenter.clone().add(dir.clone().multiplyScalar(12));
                this._createCornerWrapHandle(ptIdx, wrapOrigin.x, wrapOrigin.y, wrapOrigin.z, dir, adjDir);
            }
        });

        // 4. Interior Bend Junction Nodes (1 to N - 2)
        if (showCorners) {
            for (let i = 1; i < n - 1; i++) {
                const pt = pts[i];
                const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
                const centerOffset = normal.clone().multiplyScalar(depth / 2);
                const bendCenter = new THREE.Vector3(pt.x, pt.y, pt.z).add(centerOffset);

                this._createBendJunctionGrip(i, bendCenter.x, bendCenter.y, bendCenter.z, pt.cornerStyle);
            }
        }

        // 5. Center Elevation Handle (▲ Elev ▼) on horizontal segments or in elevate_arm mode
        const showElevate = (this.activeMode === 'elevate_arm' || this.activeMode === 'adjust_arm');
        if (showStretch || showElevate) {
            const segIdx = Math.min(Math.max(0, this.activeSegmentIndex || 0), n - 2);
            if (showElevate) {
                const pA = pts[segIdx];
                const pB = pts[segIdx + 1];
                const normal = pA.normal ? new THREE.Vector3(pA.normal.x, pA.normal.y, pA.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
                const midPt = new THREE.Vector3(
                    (pA.x + pB.x) / 2 + normal.x * (depth / 2),
                    (pA.y + pB.y) / 2,
                    (pA.z + pB.z) / 2 + normal.z * (depth / 2)
                );
                this._createElevationSlideHandle(midPt.x, midPt.y, midPt.z, normal, segIdx);
            } else {
                for (let i = 0; i < n - 1; i++) {
                    const pA = pts[i];
                    const pB = pts[i + 1];
                    const segDir = new THREE.Vector3(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);
                    const segLen = segDir.length();
                    if (segLen >= 40 && Math.abs(segDir.y) < segLen * 0.35) {
                        const normal = pA.normal ? new THREE.Vector3(pA.normal.x, pA.normal.y, pA.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
                        const midPt = new THREE.Vector3(
                            (pA.x + pB.x) / 2 + normal.x * (depth / 2),
                            (pA.y + pB.y) / 2,
                            (pA.z + pB.z) / 2 + normal.z * (depth / 2)
                        );
                        this._createElevationSlideHandle(midPt.x, midPt.y, midPt.z, normal, i);
                        break;
                    }
                }
            }
        }

        // 6. Wall-Plane 3D Rotation Handle for Selected Segment Arm (⭮ Angle)
        if (showAngle) {
            const segIdx = Math.min(Math.max(0, this.activeSegmentIndex || 0), n - 2);
            let pivotPt;
            if (n === 2) {
                pivotPt = pts[0];
            } else if (segIdx === 0) {
                pivotPt = pts[1];
            } else {
                pivotPt = pts[segIdx];
            }

            const normal = pivotPt.normal ? new THREE.Vector3(pivotPt.normal.x, pivotPt.normal.y, pivotPt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const centerOffset = normal.clone().multiplyScalar((depth / 2) + 2);
            this._createRotationRing(pivotPt.x + centerOffset.x, pivotPt.y + centerOffset.y, pivotPt.z + centerOffset.z, normal);
        }

        // 7. Parametric Dimension Handles for Selected Segment Arm (📏 Dims)
        if (showDims) {
            initEntitySegments(entity);
            const segIdx = Math.min(Math.max(0, this.activeSegmentIndex || 0), n - 2);
            const pA = pts[segIdx];
            const pB = pts[segIdx + 1];
            const segDir = new THREE.Vector3(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z).normalize();
            const normal = pA.normal ? new THREE.Vector3(pA.normal.x, pA.normal.y, pA.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const midPt = new THREE.Vector3((pA.x + pB.x) / 2, (pA.y + pB.y) / 2, (pA.z + pB.z) / 2);

            const upWall = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
            let widthVec = new THREE.Vector3().crossVectors(normal, segDir).normalize();
            if (widthVec.dot(upWall) < 0) widthVec.negate();
            if (widthVec.lengthSq() < 0.001) widthVec.copy(upWall);

            const segW = entity.segments?.[segIdx]?.width || width;
            const segD = entity.segments?.[segIdx]?.depth || depth;

            // A. Thickness / Width Handle (Drop from centerline)
            const widthHandlePos = midPt.clone()
                .add(normal.clone().multiplyScalar(segD / 2))
                .add(widthVec.clone().multiplyScalar(segW / 2));
            this._createDimensionWidthHandle(widthHandlePos.x, widthHandlePos.y, widthHandlePos.z, widthVec, normal);

            // B. Depth (Overhang) Handle (Projection from wall surface)
            const depthHandlePos = midPt.clone().add(normal.clone().multiplyScalar(segD));
            this._createDimensionDepthHandle(depthHandlePos.x, depthHandlePos.y, depthHandlePos.z, normal);
        }
    }

    _createDimensionWidthHandle(x, y, z, widthVec, normal) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isElevationHandle: true, handleType: 'dim_width', widthVec, normal };
        group.renderOrder = 2505;

        // Reliable invisible hit collider
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(16, 12, 12), hitMat);
        hitMesh.userData = { isElevationHandle: true, handleType: 'dim_width', widthVec, normal };
        group.add(hitMesh);

        // Core grip: Amber diamond box
        const gripGeo = new THREE.BoxGeometry(6.5, 6.5, 6.5);
        const gripMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false });
        const gripMesh = new THREE.Mesh(gripGeo, gripMat);
        gripMesh.rotation.z = Math.PI / 4;
        gripMesh.userData = { isElevationHandle: true, handleType: 'dim_width', widthVec, normal };
        gripMesh.renderOrder = 2506;
        group.add(gripMesh);

        // Halo ring around grip
        const halo = new THREE.Mesh(new THREE.TorusGeometry(8.5, 1.2, 8, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), widthVec);
        halo.userData = { isElevationHandle: true, handleType: 'dim_width', widthVec, normal };
        halo.renderOrder = 2505;
        group.add(halo);

        // Cones indicating expand/contract
        const coneOut = new THREE.Mesh(new THREE.ConeGeometry(3.2, 6.5, 12), new THREE.MeshBasicMaterial({ color: 0xfbbf24, depthTest: false }));
        coneOut.position.copy(widthVec.clone().multiplyScalar(7.5));
        coneOut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), widthVec);
        coneOut.userData = { isElevationHandle: true, handleType: 'dim_width', widthVec, normal };
        coneOut.renderOrder = 2507;
        group.add(coneOut);

        const coneIn = new THREE.Mesh(new THREE.ConeGeometry(3.2, 6.5, 12), new THREE.MeshBasicMaterial({ color: 0xfbbf24, depthTest: false }));
        coneIn.position.copy(widthVec.clone().multiplyScalar(-7.5));
        coneIn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), widthVec.clone().negate());
        coneIn.userData = { isElevationHandle: true, handleType: 'dim_width', widthVec, normal };
        coneIn.renderOrder = 2507;
        group.add(coneIn);

        this.handles.add(group);
    }

    _createDimensionDepthHandle(x, y, z, normal) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isElevationHandle: true, handleType: 'dim_depth', normal };
        group.renderOrder = 2505;

        // Reliable invisible hit collider
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(16, 12, 12), hitMat);
        hitMesh.userData = { isElevationHandle: true, handleType: 'dim_depth', normal };
        group.add(hitMesh);

        // Prominent Emerald cone pointing outward along wall normal
        const cone = new THREE.Mesh(new THREE.ConeGeometry(5.0, 12, 16), new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false }));
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        cone.position.copy(normal.clone().multiplyScalar(6));
        cone.userData = { isElevationHandle: true, handleType: 'dim_depth', normal };
        cone.renderOrder = 2506;
        group.add(cone);

        // Collar ring at base
        const collar = new THREE.Mesh(new THREE.TorusGeometry(6.5, 1.4, 8, 20), new THREE.MeshBasicMaterial({ color: 0x34d399, depthTest: false }));
        collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        collar.userData = { isElevationHandle: true, handleType: 'dim_depth', normal };
        collar.renderOrder = 2505;
        group.add(collar);

        this.handles.add(group);
    }

    _createRotationRing(cx, cy, cz, normal) {
        const group = new THREE.Group();
        group.position.set(cx, cy, cz);
        group.userData = { isElevationHandle: true, handleType: 'rotation_ring' };
        group.renderOrder = 2510;

        // Reliable invisible hit collider for smooth dragging
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.TorusGeometry(32, 8, 8, 32), hitMat);
        hitMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        hitMesh.userData = { isElevationHandle: true, handleType: 'rotation_ring' };
        group.add(hitMesh);

        // Radiant Outer CAD Rotation Ring
        const ringGeo = new THREE.TorusGeometry(32, 1.6, 8, 48);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 0.95 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        ringMesh.userData = { isElevationHandle: true, handleType: 'rotation_ring' };
        ringMesh.renderOrder = 2511;
        group.add(ringMesh);

        // Center Pivot Bead
        const beadGeo = new THREE.SphereGeometry(4.0, 16, 16);
        const beadMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false });
        const beadMesh = new THREE.Mesh(beadGeo, beadMat);
        beadMesh.userData = { isElevationHandle: true, handleType: 'rotation_ring' };
        beadMesh.renderOrder = 2512;
        group.add(beadMesh);

        this.handles.add(group);
    }

    _createCornerWrapHandle(nodeIndex, x, y, z, dir, adjDir) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        group.renderOrder = 2505;

        const uIn = dir ? dir.clone().normalize() : new THREE.Vector3(1, 0, 0);
        const uOut = adjDir ? adjDir.clone().normalize() : uIn.clone();
        const yAxis = new THREE.Vector3(0, 1, 0);

        // 1. Invisible hit collider covering the entire turn arrow area
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(24, 12, 12), hitMat);
        const colliderOffset = uIn.clone().multiplyScalar(6).add(uOut.clone().multiplyScalar(12));
        hitMesh.position.copy(colliderOffset);
        hitMesh.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        group.add(hitMesh);

        // Materials: Vibrant emerald & mint with depthTest: false to remain visible above walls
        const matStem = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false });
        const matHead = new THREE.MeshBasicMaterial({ color: 0x34d399, depthTest: false });
        const matAccent = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });

        // 2. Base anchor ring at origin
        const baseRing = new THREE.Mesh(new THREE.TorusGeometry(4.5, 1.0, 8, 16), matAccent);
        baseRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), uIn);
        baseRing.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        baseRing.renderOrder = 2506;
        group.add(baseRing);

        // 3. Approach stem along uIn (length 8)
        const stemGeo = new THREE.CylinderGeometry(2.4, 2.4, 8, 14);
        const stemMesh = new THREE.Mesh(stemGeo, matStem);
        stemMesh.position.copy(uIn.clone().multiplyScalar(4));
        stemMesh.quaternion.setFromUnitVectors(yAxis, uIn);
        stemMesh.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        stemMesh.renderOrder = 2506;
        group.add(stemMesh);

        // 4. Elbow corner sphere at turn (position uIn * 8)
        const elbowPos = uIn.clone().multiplyScalar(8);
        const elbowMesh = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 12), matAccent);
        elbowMesh.position.copy(elbowPos);
        elbowMesh.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        elbowMesh.renderOrder = 2506;
        group.add(elbowMesh);

        // 5. Turn shaft along uOut (length 14)
        const shaftGeo = new THREE.CylinderGeometry(2.6, 2.6, 14, 14);
        const shaftMesh = new THREE.Mesh(shaftGeo, matStem);
        shaftMesh.position.copy(elbowPos.clone().add(uOut.clone().multiplyScalar(7)));
        shaftMesh.quaternion.setFromUnitVectors(yAxis, uOut);
        shaftMesh.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        shaftMesh.renderOrder = 2507;
        group.add(shaftMesh);

        // 6. Prominent 3D Arrowhead Cone pointing along uOut (radius 6.5, length 14)
        const coneGeo = new THREE.ConeGeometry(6.5, 14, 16);
        const coneMesh = new THREE.Mesh(coneGeo, matHead);
        coneMesh.position.copy(elbowPos.clone().add(uOut.clone().multiplyScalar(14 + 7)));
        coneMesh.quaternion.setFromUnitVectors(yAxis, uOut);
        coneMesh.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        coneMesh.renderOrder = 2508;
        group.add(coneMesh);

        this.handles.add(group);
    }

    _createElevationSlideHandle(x, y, z, normal, segmentIndex = 0) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isElevationHandle: true, handleType: 'elevation_slide', segmentIndex };
        group.renderOrder = 2505;

        // Reliable invisible hit collider
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(16, 12, 12), hitMat);
        hitMesh.userData = { isElevationHandle: true, handleType: 'elevation_slide', segmentIndex };
        group.add(hitMesh);

        // Center Pill Core
        const pillGeo = new THREE.CylinderGeometry(4.5, 4.5, 10, 16);
        const pillMesh = new THREE.Mesh(pillGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false }));
        pillMesh.userData = { isElevationHandle: true, handleType: 'elevation_slide', segmentIndex };
        pillMesh.renderOrder = 2505;
        group.add(pillMesh);

        // Up Arrow Cone (▲)
        const coneUp = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7, 12), new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false }));
        coneUp.position.set(0, 9, 0);
        coneUp.userData = { isElevationHandle: true, handleType: 'elevation_slide', segmentIndex };
        coneUp.renderOrder = 2506;
        group.add(coneUp);

        // Down Arrow Cone (▼)
        const coneDown = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7, 12), new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false }));
        coneDown.position.set(0, -9, 0);
        coneDown.rotation.x = Math.PI;
        coneDown.userData = { isElevationHandle: true, handleType: 'elevation_slide', segmentIndex };
        coneDown.renderOrder = 2506;
        group.add(coneDown);

        // Halo Ring around center
        const halo = new THREE.Mesh(new THREE.TorusGeometry(7.5, 1.2, 8, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        halo.rotation.x = Math.PI / 2;
        halo.userData = { isElevationHandle: true, handleType: 'elevation_slide', segmentIndex };
        halo.renderOrder = 2505;
        group.add(halo);

        this.handles.add(group);
    }

    _createPushPullHandle(nodeIndex, x, y, z, dir) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isElevationHandle: true, handleType: 'push_pull', nodeIndex, dir: dir.clone() };
        group.renderOrder = 2500;

        // Reliable invisible hit collider (transparent + zero opacity)
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(18, 12, 12), hitMat);
        hitMesh.userData = { isElevationHandle: true, handleType: 'push_pull', nodeIndex, dir: dir.clone() };
        group.add(hitMesh);

        // Radiant Outer Ring - oriented perpendicular to dir
        const ringGeo = new THREE.TorusGeometry(8.0, 1.4, 8, 24);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        ringMesh.userData = { isElevationHandle: true, handleType: 'push_pull', nodeIndex, dir: dir.clone() };
        ringMesh.renderOrder = 2501;
        group.add(ringMesh);

        // Center Radiant Core Bead (Glowing Cyan)
        const discGeo = new THREE.SphereGeometry(5.5, 16, 16);
        const discMesh = new THREE.Mesh(discGeo, this.matPushPull);
        discMesh.userData = { isElevationHandle: true, handleType: 'push_pull', nodeIndex, dir: dir.clone() };
        discMesh.renderOrder = 2502;
        group.add(discMesh);

        this.handles.add(group);
    }

    _createExtrudeArrow(nodeIndex, direction, x, y, z, color, dirVec = null) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isElevationHandle: true, handleType: 'extrude_arrow', nodeIndex, direction };
        group.renderOrder = 2503;

        // Reliable invisible hit collider
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 12), hitMat);
        hitMesh.userData = { isElevationHandle: true, handleType: 'extrude_arrow', nodeIndex, direction };
        group.add(hitMesh);

        // Compact Sprout Indicator Cone
        const cone = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7.5, 12), new THREE.MeshBasicMaterial({ color, depthTest: false }));
        if (dirVec) {
            cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec);
        } else {
            if (direction === 'down') cone.rotation.x = Math.PI;
            else if (direction === 'left') cone.rotation.z = Math.PI / 2;
            else if (direction === 'right') cone.rotation.z = -Math.PI / 2;
        }

        cone.userData = { isElevationHandle: true, handleType: 'extrude_arrow', nodeIndex, direction };
        cone.renderOrder = 2504;
        group.add(cone);

        this.handles.add(group);
    }

    _createBendJunctionGrip(nodeIndex, x, y, z, cornerStyle) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isElevationHandle: true, handleType: 'bend_junction', nodeIndex };
        group.renderOrder = 2500;

        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 12), hitMat);
        hitMesh.userData = { isElevationHandle: true, handleType: 'bend_junction', nodeIndex };
        group.add(hitMesh);

        // Octahedron Diamond for Sharp, Smooth Sphere for Fillet, Cylinder for Bevel/Chamfer
        let geo;
        if (cornerStyle === 'fillet') {
            geo = new THREE.SphereGeometry(5.5, 16, 16);
        } else if (cornerStyle === 'bevel' || cornerStyle === 'chamfer') {
            geo = new THREE.CylinderGeometry(5.0, 5.0, 6.0, 16);
        } else {
            geo = new THREE.OctahedronGeometry(6.5);
        }
        const mat = (nodeIndex === this.activeBendIndex) ? this.matBendActive : this.matBend;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData = { isElevationHandle: true, handleType: 'bend_junction', nodeIndex };
        mesh.renderOrder = 2501;
        group.add(mesh);

        // Accent Halo Ring
        const halo = new THREE.Mesh(new THREE.TorusGeometry(6.5, 1.0, 8, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        halo.userData = { isElevationHandle: true, handleType: 'bend_junction', nodeIndex };
        halo.renderOrder = 2502;
        group.add(halo);

        this.handles.add(group);
    }

    _onPointerDown(e) {
        if (!this.visible || e.button !== 0) return;
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        const intersects = this.raycaster.intersectObjects(this.handles.children, true);
        if (intersects.length === 0) return;

        const handleHits = [];
        for (const hit of intersects) {
            let curr = hit.object;
            while (curr && !curr.userData?.isElevationHandle && curr !== this.handles) {
                curr = curr.parent;
            }
            if (curr && curr.userData?.isElevationHandle) {
                handleHits.push(curr);
            }
        }

        if (handleHits.length === 0) return;

        // Prioritize specific control handles (push_pull, extrude_arrow, etc.) over body_drag
        const handleObj = handleHits.find(h => h.userData?.handleType !== 'body_drag') || handleHits[0];

        if (this.domHUD) this.domHUD.style.display = 'none';

        e.preventDefault();
        e.stopPropagation();

        const entity = this._getEntity();
        if (!entity || !entity.points || entity.points.length < 2) return;

        const handleType = handleObj.userData.handleType;
        const nodeIndex = handleObj.userData.nodeIndex;

        // 0. Body Drag (Select and Drag Adjust along Wall)
        if (handleType === 'body_drag') {
            if (handleObj.userData.armIndex !== undefined) {
                this.activeSegmentIndex = handleObj.userData.armIndex;
            }
            this.isDragging = true;
            if (this.ctx.controls) this.ctx.controls.enabled = false;

            const pt0 = entity.points[0];
            const normal = pt0.normal ? new THREE.Vector3(pt0.normal.x, pt0.normal.y, pt0.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            let wallTangent = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
            if (wallTangent.lengthSq() < 0.001) wallTangent.set(1, 0, 0);

            const midPt = new THREE.Vector3(
                entity.points.reduce((acc, p) => acc + p.x, 0) / entity.points.length,
                entity.points.reduce((acc, p) => acc + p.y, 0) / entity.points.length,
                entity.points.reduce((acc, p) => acc + p.z, 0) / entity.points.length
            );
            const handlePos = midPt.clone().add(normal.clone().multiplyScalar((entity.depth || 40) / 2));

            this.dragPlane.setFromNormalAndCoplanarPoint(normal, handlePos);
            this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);

            this.activeHandle = {
                handleType: 'body_drag',
                initialPoints: entity.points.map(p => ({ x: p.x, y: p.y, z: p.z })),
                normal,
                wallTangent,
                handlePos
            };

            this._updateBadge(`Drag to Move on Wall (Elevation & Position)`, handlePos);
            return;
        }

        // 1. Extrude Arrow: Sprout new segment and smoothly enter active pull drag mode
        if (handleType === 'extrude_arrow') {
            const dir = handleObj.userData.direction;
            const res = sproutBendAtEndpoint(entity, nodeIndex, dir, 100);

            if (res) {
                this._rebuildEntityInPlace(entity);
                this.updateHandles();

                // Transfer seamlessly into active axial dragging for the newly sprouted endpoint!
                const newPtIdx = (nodeIndex === 0) ? 0 : entity.points.length - 1;
                const neighborIdx = (newPtIdx === 0) ? 1 : entity.points.length - 2;

                const pt = entity.points[newPtIdx];
                const neighbor = entity.points[neighborIdx];

                const axis = new THREE.Vector3(pt.x - neighbor.x, pt.y - neighbor.y, pt.z - neighbor.z).normalize();
                const initialLen = Math.hypot(pt.x - neighbor.x, pt.y - neighbor.y, pt.z - neighbor.z);

                this.isDragging = true;
                if (this.ctx.controls) this.ctx.controls.enabled = false;

                this.activeHandle = {
                    handleType: 'push_pull',
                    nodeIndex: newPtIdx,
                    neighborIndex: neighborIdx,
                    axis,
                    initialLen,
                    neighborPos: new THREE.Vector3(neighbor.x, neighbor.y, neighbor.z),
                    initialPos: new THREE.Vector3(pt.x, pt.y, pt.z)
                };

                const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
                let planeNormal = normal;
                if (Math.abs(axis.dot(normal)) > 0.7) {
                    planeNormal = new THREE.Vector3(0, 1, 0);
                }

                const handlePos = new THREE.Vector3(pt.x, pt.y, pt.z).add(normal.clone().multiplyScalar((entity.depth || 40) / 2));
                this.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, handlePos);
                this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);

                this._updateBadge(`Sprouted ${dir.toUpperCase().replace('_', ' ')} (Drag to Extend)`, handlePos);
            }
            return;
        }

        // 2. Bend Junction: Setup drag to reposition corner, or click to toggle Sharp vs Fillet
        if (handleType === 'bend_junction') {
            this.activeBendIndex = nodeIndex;
            const pt = entity.points[nodeIndex];

            if (this.ctx.updateElevationPanel) {
                this.ctx.updateElevationPanel(entity, nodeIndex);
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('elevation-node-select', {
                    detail: { entity, nodeIndex }
                }));
            }

            this.isDragging = true;
            if (this.ctx.controls) this.ctx.controls.enabled = false;

            this.activeHandle = {
                handleType: 'bend_junction',
                nodeIndex,
                initialPos: new THREE.Vector3(pt.x, pt.y, pt.z),
                downTime: Date.now(),
                hasMoved: false
            };

            const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const centerOffset = normal.clone().multiplyScalar((entity.depth || 40) / 2);
            const handlePos = new THREE.Vector3(pt.x, pt.y, pt.z).add(centerOffset);

            this.dragPlane.setFromNormalAndCoplanarPoint(normal, handlePos);
            this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);
            return;
        }

        // 3. Dual-End Push/Pull Drag: Lock into smooth on-axis stretch
        if (handleType === 'push_pull') {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('elevation-node-select', {
                    detail: { entity, nodeIndex }
                }));
            }
            const pt = entity.points[nodeIndex];
            const neighborIdx = (nodeIndex === 0) ? 1 : entity.points.length - 2;
            const neighbor = entity.points[neighborIdx];

            const axis = new THREE.Vector3(pt.x - neighbor.x, pt.y - neighbor.y, pt.z - neighbor.z).normalize();
            const initialLen = Math.hypot(pt.x - neighbor.x, pt.y - neighbor.y, pt.z - neighbor.z);

            this.isDragging = true;
            if (this.ctx.controls) this.ctx.controls.enabled = false;

            this.activeHandle = {
                handleType: 'push_pull',
                nodeIndex,
                neighborIndex: neighborIdx,
                axis,
                initialLen,
                neighborPos: new THREE.Vector3(neighbor.x, neighbor.y, neighbor.z),
                initialPos: new THREE.Vector3(pt.x, pt.y, pt.z)
            };

            const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const centerOffset = normal.clone().multiplyScalar((entity.depth || 40) / 2);
            const handlePos = new THREE.Vector3(pt.x, pt.y, pt.z).add(centerOffset);

            this.dragPlane.setFromNormalAndCoplanarPoint(normal, handlePos);
            this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);
            return;
        }

        // 4. Center Elevation Slide Drag: Smoothly move the entire beam or single selected arm UP and DOWN
        if (handleType === 'elevation_slide') {
            this.isDragging = true;
            if (this.ctx.controls) this.ctx.controls.enabled = false;

            const segIdx = handleObj.userData?.segmentIndex ?? (this.activeSegmentIndex || 0);
            this.activeSegmentIndex = segIdx;

            this.activeHandle = {
                handleType: 'elevation_slide',
                segmentIndex: segIdx,
                initialY: entity.points[segIdx]?.y ?? entity.points[0].y,
                initialPointsY: entity.points.map(p => p.y),
                initialPoints: JSON.parse(JSON.stringify(entity.points)),
                initialNodes: entity.nodes ? JSON.parse(JSON.stringify(entity.nodes)) : null
            };

            const pt0 = entity.points[segIdx] || entity.points[0];
            const normal = pt0.normal ? new THREE.Vector3(pt0.normal.x, pt0.normal.y, pt0.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const handlePos = new THREE.Vector3(handleObj.position.x, handleObj.position.y, handleObj.position.z);

            this.dragPlane.setFromNormalAndCoplanarPoint(normal, handlePos);
            this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);
            this._updateBadge(`Drag Up/Down to Adjust Height`, handlePos);
            return;
        }

        // 5. Wall Corner Wrap: Wrap beam around 90° corner onto adjacent connected wall
        if (handleType === 'corner_wrap') {
            const res = wrapElevationSegmentToAdjacentWall(entity, nodeIndex, this.ctx.planner);
            if (res) {
                this._rebuildEntityInPlace(entity);
                this.updateHandles();
                if (this.ctx.requestRender) this.ctx.requestRender('corner_wrapped', 2);
                if (typeof window !== 'undefined' && window.coreEventBus) {
                    window.coreEventBus.emit('SAVE_HISTORY', { action: 'Wrap Elevation Segment Around Corner' });
                }
                const normal = res.endPt.normal ? new THREE.Vector3(res.endPt.normal.x, res.endPt.normal.y, res.endPt.normal.z) : new THREE.Vector3(0, 0, 1);
                const handlePos = new THREE.Vector3(res.endPt.x, res.endPt.y, res.endPt.z).add(normal.clone().multiplyScalar((entity.depth || 40) / 2));
                this._updateBadge(`Wrapped onto ${res.adjWall?.name || 'Adjacent Wall'} (L-Bend)`, handlePos);
            }
            return;
        }

        // 6. Wall-Plane Rotation Ring: Rotate selected segment arm around its pivot
        if (handleType === 'rotation_ring') {
            this.isDragging = true;
            if (this.ctx.controls) this.ctx.controls.enabled = false;

            const n = entity.points.length;
            const segIdx = Math.min(Math.max(0, this.activeSegmentIndex || 0), n - 2);

            let pivotPt;
            if (n === 2) {
                pivotPt = entity.points[0];
            } else if (segIdx === 0) {
                pivotPt = entity.points[1];
            } else {
                pivotPt = entity.points[segIdx];
            }

            const normal = pivotPt.normal ? new THREE.Vector3(pivotPt.normal.x, pivotPt.normal.y, pivotPt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const centerPt = new THREE.Vector3(pivotPt.x, pivotPt.y, pivotPt.z);
            const centerOffset = normal.clone().multiplyScalar(((entity.depth || 40) / 2) + 2);
            const handlePos = centerPt.clone().add(centerOffset);

            this.dragPlane.setFromNormalAndCoplanarPoint(normal, handlePos);
            this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);

            let vUp = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
            if (vUp.lengthSq() < 0.001) vUp = new THREE.Vector3(1, 0, 0).projectOnPlane(normal).normalize();
            const vRight = new THREE.Vector3().crossVectors(normal, vUp).normalize();

            const startRel = this.dragStartPoint.clone().sub(handlePos);
            const initialAngleRad = Math.atan2(startRel.dot(vRight), startRel.dot(vUp));
            const startSegmentAngle = getSegmentAngle(entity, segIdx);

            this.activeHandle = {
                handleType: 'rotation_ring',
                segmentIndex: segIdx,
                centerPt,
                normal,
                vUp,
                vRight,
                handlePos,
                initialAngleRad,
                startSegmentAngle
            };

            this._updateBadge(`Rotate Arm ${segIdx + 1} (15° & 45° Snaps)`, handlePos);
            return;
        }

        // 7. Thickness / Width Handle Drag (Beam Drop)
        if (handleType === 'dim_width') {
            this.isDragging = true;
            if (this.ctx.controls) this.ctx.controls.enabled = false;
            const widthVec = handleObj.userData.widthVec || new THREE.Vector3(0, 1, 0);
            const normal = handleObj.userData.normal || new THREE.Vector3(0, 0, 1);
            const handlePos = new THREE.Vector3(handleObj.position.x, handleObj.position.y, handleObj.position.z);

            this.dragPlane.setFromNormalAndCoplanarPoint(normal, handlePos);
            this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);

            initEntitySegments(entity);
            const segIdx = Math.min(Math.max(0, this.activeSegmentIndex || 0), entity.points.length - 2);
            const currentWidth = entity.segments?.[segIdx]?.width || entity.width || 30;

            this.activeHandle = {
                handleType: 'dim_width',
                segmentIndex: segIdx,
                initialWidth: currentWidth,
                widthVec,
                normal,
                handlePos
            };

            this._updateBadge(`Arm ${segIdx + 1} Thickness: ${currentWidth} cm (Drag to Resize)`, handlePos);
            return;
        }

        // 8. Depth (Overhang) Handle Drag (Projection from Wall)
        if (handleType === 'dim_depth') {
            this.isDragging = true;
            if (this.ctx.controls) this.ctx.controls.enabled = false;
            const normal = handleObj.userData.normal || new THREE.Vector3(0, 0, 1);
            const handlePos = new THREE.Vector3(handleObj.position.x, handleObj.position.y, handleObj.position.z);

            const camDir = this.ctx.camera ? this.ctx.camera.getWorldDirection(new THREE.Vector3()) : new THREE.Vector3(0, 0, -1);
            let planeNorm = new THREE.Vector3().crossVectors(normal, camDir).cross(normal).normalize();
            if (planeNorm.lengthSq() < 0.001) planeNorm.set(0, 1, 0);

            this.dragPlane.setFromNormalAndCoplanarPoint(planeNorm, handlePos);
            this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);

            initEntitySegments(entity);
            const segIdx = Math.min(Math.max(0, this.activeSegmentIndex || 0), entity.points.length - 2);
            const currentDepth = entity.segments?.[segIdx]?.depth || entity.depth || 40;

            this.activeHandle = {
                handleType: 'dim_depth',
                segmentIndex: segIdx,
                initialDepth: currentDepth,
                normal,
                handlePos
            };

            this._updateBadge(`Arm ${segIdx + 1} Depth: ${currentDepth} cm (Drag to Resize)`, handlePos);
            return;
        }
    }

    _onPointerMove(e) {
        if (!this.visible) return;
        this.updateMouse(e);

        if (!this.isDragging) {
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, true);
            const dom = this.ctx.renderer?.domElement;
            if (dom) {
                if (intersects.length > 0) {
                    let curr = intersects[0].object;
                    while (curr && !curr.userData?.isElevationHandle && curr !== this.handles) curr = curr.parent;
                    const hType = curr?.userData?.handleType;
                    const hPos = curr?.position || new THREE.Vector3();
                    if (hType === 'body_drag') {
                        dom.style.cursor = 'grab';
                        this._updateBadge('Drag to Adjust Position & Elevation on Wall', hPos);
                    } else if (hType === 'push_pull') {
                        dom.style.cursor = 'ew-resize';
                        this._updateBadge('Drag to Stretch / Shorten along Wall (Snaps to Corners)', hPos);
                    } else if (hType === 'elevation_slide') {
                        dom.style.cursor = 'ns-resize';
                        this._updateBadge('Drag Up/Down to Adjust Height', hPos);
                    } else if (hType === 'extrude_arrow') {
                        dom.style.cursor = 'crosshair';
                        const dir = curr?.userData?.direction || '';
                        let dirLabel = 'Sprout Arm';
                        if (dir === 'up') dirLabel = 'Sprout Up (↑)';
                        else if (dir === 'down') dirLabel = 'Sprout Down (↓)';
                        else if (dir === 'left') dirLabel = 'Sprout Left (←)';
                        else if (dir === 'right') dirLabel = 'Sprout Right (→)';
                        else if (dir === 'away_wall') dirLabel = 'Sprout Out / Away from Wall (↗ Out)';
                        else if (dir === 'toward_wall') dirLabel = 'Sprout In / Toward Wall (↙ In)';
                        this._updateBadge(`Click to ${dirLabel}`, hPos);
                    } else if (hType === 'bend_junction') {
                        dom.style.cursor = 'move';
                        this._updateBadge('Drag Corner | Click to Toggle Curve', hPos);
                    } else if (hType === 'corner_wrap') {
                        dom.style.cursor = 'pointer';
                        this._updateBadge('Click to Wrap Around Corner onto Next Wall (L-Bend ↳)', hPos);
                    } else if (hType === 'rotation_ring') {
                        dom.style.cursor = 'grab';
                        this._updateBadge('Drag to Rotate on Wall Plane (15° & 45° Snaps)', hPos);
                    } else if (hType === 'dim_width') {
                        dom.style.cursor = 'ns-resize';
                        this._updateBadge('Drag to Adjust Thickness (Beam Drop)', hPos);
                    } else if (hType === 'dim_depth') {
                        dom.style.cursor = 'ew-resize';
                        this._updateBadge('Drag to Adjust Depth (Overhang)', hPos);
                    } else {
                        dom.style.cursor = 'pointer';
                    }
                } else {
                    dom.style.cursor = 'auto';
                    if (this.domBadge && !this.isDragging) this.domBadge.style.display = 'none';
                }
            }
            return;
        }

        const entity = this._getEntity();
        if (!entity || !this.activeHandle) return;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const currentIntersection = new THREE.Vector3();
        if (!this.raycaster.ray.intersectPlane(this.dragPlane, currentIntersection)) return;

        // Handle Body Drag (Select and Drag Adjust along Wall)
        if (this.activeHandle.handleType === 'body_drag') {
            const mouseDelta = currentIntersection.clone().sub(this.dragStartPoint);

            // Delta Y (Elevation change)
            const rawDeltaY = mouseDelta.y;
            let deltaY = Math.round(rawDeltaY / 5) * 5;

            // Delta along Wall Tangent (Horizontal shift along the wall)
            const rawDeltaT = mouseDelta.dot(this.activeHandle.wallTangent);
            let deltaT = Math.round(rawDeltaT / 5) * 5;

            const tangentShift = this.activeHandle.wallTangent.clone().multiplyScalar(deltaT);

            // Check floor level magnetic snaps on base point Y
            const initY = this.activeHandle.initialPoints[0].y;
            let targetY = initY + deltaY;
            let snapMsg = '';
            [0, 80, 150, 210, 300, 380, 510, 600].forEach(levelY => {
                if (Math.abs(targetY - levelY) <= 8) {
                    deltaY = levelY - initY;
                    targetY = levelY;
                    snapMsg = levelY === 210 ? ' (Window Lintel)' : (levelY % 300 === 0 ? ` (Floor Level ${levelY}cm)` : '');
                }
            });

            entity.points.forEach((p, idx) => {
                const init = this.activeHandle.initialPoints[idx];
                p.x = Math.round(init.x + tangentShift.x);
                p.y = Math.round(init.y + deltaY);
                p.z = Math.round(init.z + tangentShift.z);
                if (entity.nodes && entity.nodes[idx]) {
                    entity.nodes[idx].x = p.x;
                    entity.nodes[idx].y = p.y;
                    entity.nodes[idx].z = p.z;
                }
            });

            this._rebuildEntityInPlace(entity);
            this.updateHandles();

            const badgePos = currentIntersection.clone();
            this._updateBadge(`Elev: ${Math.round(targetY)}cm | Shift: ${Math.round(deltaT)}cm${snapMsg}`, badgePos);
            return;
        }

        // Handle Dimension Width Drag (Thickness / Beam Drop for selected arm)
        if (this.activeHandle.handleType === 'dim_width') {
            const mouseDelta = currentIntersection.clone().sub(this.dragStartPoint);
            const wDelta = mouseDelta.dot(this.activeHandle.widthVec) * 2;
            let newWidth = Math.round((this.activeHandle.initialWidth + wDelta) / 5) * 5;
            newWidth = Math.max(15, Math.min(250, newWidth));
            const segIdx = this.activeHandle.segmentIndex ?? (this.activeSegmentIndex || 0);
            setSegmentDimensions(entity, segIdx, { width: newWidth });
            if (segIdx === 0 || !entity.segments || entity.segments.length <= 1) {
                entity.width = newWidth;
            }
            this._rebuildEntityInPlace(entity);
            this.updateHandles();
            this._updateBadge(`Arm ${segIdx + 1} Thickness: ${newWidth} cm`, currentIntersection);
            return;
        }

        // Handle Dimension Depth Drag (Overhang / Projection for selected arm)
        if (this.activeHandle.handleType === 'dim_depth') {
            const mouseDelta = currentIntersection.clone().sub(this.dragStartPoint);
            const dDelta = mouseDelta.dot(this.activeHandle.normal);
            let newDepth = Math.round((this.activeHandle.initialDepth + dDelta) / 5) * 5;
            newDepth = Math.max(10, Math.min(250, newDepth));
            const segIdx = this.activeHandle.segmentIndex ?? (this.activeSegmentIndex || 0);
            setSegmentDimensions(entity, segIdx, { depth: newDepth });
            if (segIdx === 0 || !entity.segments || entity.segments.length <= 1) {
                entity.depth = newDepth;
            }
            this._rebuildEntityInPlace(entity);
            this.updateHandles();
            this._updateBadge(`Arm ${segIdx + 1} Depth: ${newDepth} cm`, currentIntersection);
            return;
        }

        // Handle Rotation Ring Drag (Rotate selected arm around its pivot)
        if (this.activeHandle.handleType === 'rotation_ring') {
            const currentRel = currentIntersection.clone().sub(this.activeHandle.handlePos);
            const currentAngleRad = Math.atan2(currentRel.dot(this.activeHandle.vRight), currentRel.dot(this.activeHandle.vUp));
            const deltaRad = currentAngleRad - this.activeHandle.initialAngleRad;
            const deltaDeg = THREE.MathUtils.radToDeg(deltaRad);

            let rawAngle = (this.activeHandle.startSegmentAngle + deltaDeg) % 360;
            if (rawAngle < 0) rawAngle += 360;

            // Snap to 15 degrees, with magnetic 45-degree snap
            let snapDeg = Math.round(rawAngle / 15) * 15;
            let snapMsg = '';
            [0, 45, 90, 135, 180, 225, 270, 315, 360].forEach(cardinal => {
                const checkAngle = cardinal % 360;
                if (Math.abs(rawAngle - checkAngle) <= 6 || Math.abs(rawAngle - (checkAngle + 360)) <= 6) {
                    snapDeg = checkAngle;
                    snapMsg = ` (Magnetic Snap: ${cardinal}°)`;
                }
            });

            snapDeg = ((snapDeg % 360) + 360) % 360;

            rotateSegmentArm(entity, this.activeHandle.segmentIndex ?? (this.activeSegmentIndex || 0), snapDeg);
            this._rebuildEntityInPlace(entity);
            this.updateHandles();

            this._updateBadge(`Arm ${(this.activeHandle.segmentIndex ?? (this.activeSegmentIndex || 0)) + 1} Angle: ${Math.round(snapDeg)}°${snapMsg}`, this.activeHandle.handlePos);
            return;
        }

        // Handle Elevation Slide Drag (Up and Down on Wall)
        if (this.activeHandle.handleType === 'elevation_slide') {
            const deltaY = currentIntersection.y - this.dragStartPoint.y;
            const snap = 5;
            let targetY = Math.round((this.activeHandle.initialY + deltaY) / snap) * snap;
            targetY = Math.max(10, Math.min(600, targetY));

            let snapMsg = '';
            [0, 80, 150, 210, 300, 380, 510, 600].forEach(levelY => {
                if (Math.abs(targetY - levelY) <= 8) {
                    targetY = levelY;
                    snapMsg = levelY === 210 ? ' (Window Lintel)' : (levelY % 300 === 0 ? ` (Floor Level ${levelY}cm)` : '');
                }
            });

            const diffY = targetY - this.activeHandle.initialY;
            const segIdx = this.activeHandle.segmentIndex ?? (this.activeSegmentIndex || 0);

            if (this.scopeMode === 'arm' || this.activeMode === 'elevate_arm' || this.activeMode === 'adjust_arm') {
                if (this.activeHandle.initialPoints) {
                    entity.points = JSON.parse(JSON.stringify(this.activeHandle.initialPoints));
                    if (this.activeHandle.initialNodes) {
                        entity.nodes = JSON.parse(JSON.stringify(this.activeHandle.initialNodes));
                    }
                }
                adjustArmElevation(entity, segIdx, diffY);
                this._rebuildEntityInPlace(entity);
                this.updateHandles();

                const p0 = entity.points[segIdx] || entity.points[0];
                const p1 = entity.points[segIdx + 1] || entity.points[entity.points.length - 1];
                const normal = p0.normal ? new THREE.Vector3(p0.normal.x, p0.normal.y, p0.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
                const badgePt = new THREE.Vector3(
                    (p0.x + p1.x) / 2 + normal.x * ((entity.depth || 40) / 2),
                    targetY,
                    (p0.z + p1.z) / 2 + normal.z * ((entity.depth || 40) / 2)
                );
                this._updateBadge(`Arm ${segIdx + 1} Elev: ${Math.round(targetY)} cm${snapMsg}`, badgePt);
                return;
            }

            entity.points.forEach((p, idx) => {
                p.y = this.activeHandle.initialPointsY[idx] + diffY;
                if (entity.nodes && entity.nodes[idx]) {
                    entity.nodes[idx].y = p.y;
                }
            });

            this._rebuildEntityInPlace(entity);
            this.updateHandles();

            const normal = entity.points[0].normal ? new THREE.Vector3(entity.points[0].normal.x, entity.points[0].normal.y, entity.points[0].normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const badgePt = new THREE.Vector3(
                (entity.points[0].x + entity.points[1].x) / 2 + normal.x * ((entity.depth || 40) / 2),
                targetY,
                (entity.points[0].z + entity.points[1].z) / 2 + normal.z * ((entity.depth || 40) / 2)
            );
            this._updateBadge(`Elevation: ${Math.round(targetY)} cm${snapMsg}`, badgePt);
            return;
        }

        // Handle Bend Junction Corner Drag (Move corner along the wall plane)
        if (this.activeHandle.handleType === 'bend_junction') {
            const mouseDelta = currentIntersection.clone().sub(this.dragStartPoint);
            if (mouseDelta.length() > 3) {
                this.activeHandle.hasMoved = true;
            }

            if (!this.activeHandle.hasMoved) return;

            const ptIdx = this.activeHandle.nodeIndex;
            const pt = entity.points[ptIdx];
            const initPos = this.activeHandle.initialPos;

            // Compute target position on wall plane
            let targetX = initPos.x + mouseDelta.x;
            let targetY = initPos.y + mouseDelta.y;
            let targetZ = initPos.z + mouseDelta.z;

            // Snap to 5cm step
            targetX = Math.round(targetX / 5) * 5;
            targetY = Math.round(targetY / 5) * 5;
            targetZ = Math.round(targetZ / 5) * 5;

            // Orthogonal snap with adjacent neighbors if near horizontal or vertical
            const prevPt = entity.points[ptIdx - 1];
            const nextPt = entity.points[ptIdx + 1];
            let snapMsg = '';

            if (prevPt) {
                if (Math.abs(targetY - prevPt.y) <= 8) {
                    targetY = prevPt.y;
                    snapMsg = ' (Snap: Horizontal)';
                }
                if (Math.hypot(targetX - prevPt.x, targetZ - prevPt.z) <= 8) {
                    targetX = prevPt.x;
                    targetZ = prevPt.z;
                    snapMsg = ' (Snap: Vertical)';
                }
            }
            if (nextPt) {
                if (Math.abs(targetY - nextPt.y) <= 8) {
                    targetY = nextPt.y;
                    snapMsg = ' (Snap: Horizontal)';
                }
                if (Math.hypot(targetX - nextPt.x, targetZ - nextPt.z) <= 8) {
                    targetX = nextPt.x;
                    targetZ = nextPt.z;
                    snapMsg = ' (Snap: Vertical)';
                }
            }

            pt.x = targetX;
            pt.y = targetY;
            pt.z = targetZ;

            if (entity.nodes && entity.nodes[ptIdx]) {
                entity.nodes[ptIdx].x = targetX;
                entity.nodes[ptIdx].y = targetY;
                entity.nodes[ptIdx].z = targetZ;
            }

            this._rebuildEntityInPlace(entity);
            this.updateHandles();

            const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const centerOffset = normal.clone().multiplyScalar((entity.depth || 40) / 2);
            const badgePos = new THREE.Vector3(targetX, targetY, targetZ).add(centerOffset);
            this._updateBadge(`Corner Position: [${Math.round(targetX)}, ${Math.round(targetY)}]${snapMsg}`, badgePos);
            return;
        }

        const mouseDelta = currentIntersection.clone().sub(this.dragStartPoint);

        const axis = this.activeHandle.axis;
        const neighbor = this.activeHandle.neighborPos;
        const ptIdx = this.activeHandle.nodeIndex;
        const pt = entity.points[ptIdx];

        // 1D Axial projection: strictly onto the segment axis!
        const axialDelta = mouseDelta.dot(axis);

        let newLen = this.activeHandle.initialLen + axialDelta;
        // Minimum segment length 25cm
        newLen = Math.max(25, newLen);

        // Snap to 5cm step
        newLen = Math.round(newLen / 5) * 5;

        // Calculate candidate endpoint along axis
        let newPtX = Math.round(neighbor.x + axis.x * newLen);
        let newPtY = Math.round(neighbor.y + axis.y * newLen);
        let newPtZ = Math.round(neighbor.z + axis.z * newLen);

        let snapMsg = '';
        const planner = this.ctx.planner;

        // Intelligent Magnetic Snap to Adjacent Segments (Release to Auto-Join)
        this.activeHandle.snapAutoJoinTarget = null;
        if (planner && planner.elevationSegments) {
            const candPt = new THREE.Vector3(newPtX, newPtY, newPtZ);
            for (const other of planner.elevationSegments) {
                if (!other || other.id === entity.id || !other.points || other.points.length < 2) continue;
                const oEnds = [other.points[0], other.points[other.points.length - 1]];
                for (const oPt of oEnds) {
                    const dist = candPt.distanceTo(new THREE.Vector3(oPt.x, oPt.y, oPt.z));
                    if (dist <= 35) {
                        newPtX = oPt.x;
                        newPtY = oPt.y;
                        newPtZ = oPt.z;
                        newLen = Math.hypot(newPtX - neighbor.x, newPtY - neighbor.y, newPtZ - neighbor.z);
                        snapMsg = ` (🔗 Magnetic Snap: Release to Auto-Join)`;
                        this.activeHandle.snapAutoJoinTarget = other;
                        break;
                    }
                }
                if (this.activeHandle.snapAutoJoinTarget) break;
            }
        }

        // Intelligent On-Axis Snapping to Wall Corners and Floors
        if (!this.activeHandle.snapAutoJoinTarget && Math.abs(axis.y) < 0.35 && planner && planner.walls) {
            const hostWall = planner.walls.find(w => w.id === entity.wallId);
            const thick = hostWall?.thickness || 20;
            const surfaceOffset = (thick / 2) + 0.3;
            const norm = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);

            for (const w of planner.walls) {
                const p1 = (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position() : (w.startAnchor || { x: w.startX || 0, y: w.startY || 0 });
                const p2 = (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position() : (w.endAnchor || { x: w.endX || 0, y: w.endY || 0 });

                const anchors = [p1, p2];
                for (const anch of anchors) {
                    const anch_faceX = anch.x + norm.x * surfaceOffset;
                    const anch_faceZ = anch.y + norm.z * surfaceOffset;

                    // Axial distance along segment from neighbor to this corner anchor
                    const toAnchX = anch_faceX - neighbor.x;
                    const toAnchZ = anch_faceZ - neighbor.z;
                    const distAlongAxis = toAnchX * axis.x + toAnchZ * axis.z;

                    if (distAlongAxis > 20) {
                        const diff = newLen - distAlongAxis;
                        // Magnetic latch: approaching within 35cm OR overshooting up to 50cm
                        if (Math.abs(diff) <= 35 || (diff > 0 && diff <= 50)) {
                            newLen = Math.max(25, Math.round(distAlongAxis));
                            newPtX = Math.round(neighbor.x + axis.x * newLen);
                            newPtZ = Math.round(neighbor.z + axis.z * newLen);
                            snapMsg = ' (📍 Snapped Flush to Corner)';
                            break;
                        }
                    }
                }
                if (snapMsg) break;
            }
        } else if (!this.activeHandle.snapAutoJoinTarget && Math.abs(axis.y) > 0.8) {
            // Vertical segment: snap to floor levels
            [0, 300, 600, 900].forEach(levelY => {
                if (Math.abs(newPtY - levelY) <= 12) {
                    newPtY = levelY;
                    newLen = Math.abs(newPtY - neighbor.y);
                    snapMsg = ` (Snap: Level ${levelY}cm)`;
                }
            });
        }

        pt.x = newPtX;
        pt.y = newPtY;
        pt.z = newPtZ;

        if (entity.nodes && entity.nodes[ptIdx]) {
            entity.nodes[ptIdx].x = newPtX;
            entity.nodes[ptIdx].y = newPtY;
            entity.nodes[ptIdx].z = newPtZ;
        }

        this._rebuildEntityInPlace(entity);
        this.updateHandles();

        const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
        const centerOffset = normal.clone().multiplyScalar((entity.depth || 40) / 2);
        const badgePos = new THREE.Vector3(newPtX, newPtY, newPtZ).add(centerOffset);

        this._updateBadge(`Length: ${Math.round(newLen)} cm${snapMsg}`, badgePos);
    }

    _onPointerUp(e) {
        if (!this.isDragging) return;

        // Auto-Join upon releasing magnetic snap latch
        if (this.activeHandle && this.activeHandle.snapAutoJoinTarget) {
            const targetOther = this.activeHandle.snapAutoJoinTarget;
            const planner = this.ctx.planner || window.planner?.value || window.planner;
            if (planner) {
                const merged = joinElevationSegments(planner, this._getEntity(), targetOther, 45);
                if (merged) {
                    this.isDragging = false;
                    this.activeHandle = null;
                    if (this.ctx.controls) this.ctx.controls.enabled = true;
                    this._rebuildEntityInPlace(merged);
                    this.updateHandles();
                    this._updateHUD();
                    const badgePos = new THREE.Vector3(
                        merged.points[0].x,
                        merged.points[0].y,
                        merged.points[0].z
                    );
                    this._updateBadge('🔗 Auto-Joined into Continuous Assembly!', badgePos);
                    setTimeout(() => { if (!this.isDragging && this.domBadge) this.domBadge.style.display = 'none'; }, 2200);
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('elevation-segment-updated', { detail: { entity: merged } }));
                    }
                    return;
                }
            }
        }

        // If user tapped on a bend junction without dragging, cycle Sharp -> Fillet -> Bevel -> Sharp!
        if (this.activeHandle && this.activeHandle.handleType === 'bend_junction' && !this.activeHandle.hasMoved) {
            const nodeIndex = this.activeHandle.nodeIndex;
            const entity = this._getEntity();
            if (entity && entity.points && entity.points[nodeIndex]) {
                const pt = entity.points[nodeIndex];
                let nextStyle;
                if (pt.cornerStyle === 'fillet') {
                    nextStyle = 'bevel';
                } else if (pt.cornerStyle === 'bevel' || pt.cornerStyle === 'chamfer') {
                    nextStyle = 'sharp';
                } else {
                    nextStyle = 'fillet';
                }
                setNodeCornerStyle(entity, nodeIndex, nextStyle, pt.radius || 25);
                this._rebuildEntityInPlace(entity);
                this.updateHandles();

                if (this.ctx.updateElevationPanel) {
                    this.ctx.updateElevationPanel(entity, nodeIndex);
                }
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('elevation-node-select', {
                        detail: { entity, nodeIndex }
                    }));
                }

                const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
                const centerOffset = normal.clone().multiplyScalar((entity.depth || 40) / 2);
                const badgePos = new THREE.Vector3(pt.x, pt.y, pt.z).add(centerOffset);
                let styleLabel = 'Sharp 45° Miter';
                if (nextStyle === 'fillet') styleLabel = `Smooth Fillet (R: ${pt.radius || 25}cm)`;
                else if (nextStyle === 'bevel') styleLabel = `Diagonal Chamfer / Bevel (Cut: ${pt.radius || 25}cm)`;
                this._updateBadge(`Corner: ${styleLabel}`, badgePos);
                setTimeout(() => { if (!this.isDragging && this.domBadge) this.domBadge.style.display = 'none'; }, 1800);
            }
        }

        const wasDraggingRotation = (this.activeHandle?.handleType === 'rotation_ring');
        this.isDragging = false;
        this.activeHandle = null;
        if (this.ctx.controls) this.ctx.controls.enabled = true;
        if (this.domBadge) this.domBadge.style.display = 'none';

        const entity = this._getEntity();
        if (entity) {
            this._rebuildEntityInPlace(entity);
            this.updateHandles();
            if (this.ctx.planner?.debouncedSaveHistory) {
                this.ctx.planner.debouncedSaveHistory();
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('elevation-segment-updated', {
                    detail: { entity }
                }));
            }
        }
        this._updateHUD();
    }

    _rebuildEntityInPlace(entity) {
        if (!entity || !entity.mesh3D) return;
        // Strictly updates geometry in-place on existing mesh3D without removing group!
        renderElevationSegment3D(null, entity, this.ctx.helpers);
        const bodyMesh = this._getBodyMesh();
        if (bodyMesh && bodyMesh.geometry) {
            this._updateHighlight(bodyMesh.geometry);
        }
        this._updateHUD();
        if (this.ctx.requestRender) this.ctx.requestRender('elevation_segment_update', 2);
    }

    destroy() {
        if (this.ctx.controls) {
            this.ctx.controls.enabled = true;
            this.ctx.controls.removeEventListener('change', this._onCameraChange);
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._onCameraChange);
            window.removeEventListener('keydown', this._onKeyDown);
            window.removeEventListener('elevation-segment-set-mode', this._onExternalSetMode);
            window.removeEventListener('elevation-segment-select-arm', this._onExternalSelectArm);
        }
        if (this.highlightMesh) {
            this.handles.remove(this.highlightMesh);
            if (this.highlightMesh.geometry) this.highlightMesh.geometry.dispose();
            this.highlightMesh = null;
        }
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (this.domBadge && this.domBadge.parentNode) {
            this.domBadge.parentNode.removeChild(this.domBadge);
        }
        if (this.domHUD && this.domHUD.parentNode) {
            this.domHUD.parentNode.removeChild(this.domHUD);
        }
        if (this.hudContextStrip && this.hudContextStrip.parentNode) {
            this.hudContextStrip.parentNode.removeChild(this.hudContextStrip);
        }
        if (this.tooltip && this.tooltip.parentNode) {
            this.tooltip.parentNode.removeChild(this.tooltip);
        }
    }
}

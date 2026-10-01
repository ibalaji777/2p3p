import * as THREE from 'three';
import { PLATFORM_TRIM_STYLES } from '../engine2d/PremiumPlatform.js';
import { coreEventBus } from '../EventBus.js';

/**
 * PlatformInteractiveSuite
 * 
 * Central coordinator managing sms 4-style 3D interactive editing for platforms:
 * 1. Floating 3D HUD Toolbar directly hovering over the selected platform:
 *    - ▲ Raise Platform (+15cm / +1 Step)
 *    - ▼ Lower Platform (-15cm / -1 Step)
 *    - Live Step Count & Height badge
 *    - Quick Trim Style selector (Clean, Beveled, Bullnose, Molded, LED Reveal, Stone)
 *    - Rotate 90°
 *    - Duplicate
 *    - Delete (✕)
 * 2. In-Scene 3D Vertical Height Arrow Handle:
 *    - Interactive vertical drag handle to adjust height smoothly or in step snaps directly in 3D.
 */
export class PlatformInteractiveSuite extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'PlatformInteractiveSuite';

        this.target = null; // THREE.Mesh or THREE.Group of selected platform
        this.platform = null; // PremiumPlatform instance

        // 3D Height Arrow Handle
        this.heightHandleGroup = new THREE.Group();
        this.heightHandleGroup.name = 'Platform_HeightHandleGroup';
        this.heightHandleGroup.visible = false;
        this.add(this.heightHandleGroup);

        this._create3DHeightHandle();
        this._createDOMHUD();
        this._createFloatingTooltip();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isDraggingHeight = false;
        this.dragStartY = 0;
        this.initialHeight = 20;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onInteractionStateChanged = this._onInteractionStateChanged.bind(this);
        this._onCameraChange = () => { if (this.visible && this.platform) this.update(); };

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

        if (coreEventBus) {
            coreEventBus.on('InteractionStateChanged', this._onInteractionStateChanged);
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
            if (this.heightHandleGroup) this.heightHandleGroup.visible = false;
            return;
        }
        if (!this.platform || !this.visible) return;
        if (state && state.state === 'object_selected' && (state.selectedEntity === this.platform || state.selectedEntity?.id === this.platform.id)) {
            if (this.heightHandleGroup) this.heightHandleGroup.visible = true;
            this.update();
        } else if (state && state.state === 'idle') {
            this.detach();
        }
    }

    _create3DHeightHandle() {
        // Vertical Arrow (Emerald Green)
        const shaftGeo = new THREE.CylinderGeometry(1.8, 1.8, 16, 16);
        shaftGeo.translate(0, 8, 0);
        const headGeo = new THREE.ConeGeometry(5, 12, 16);
        headGeo.translate(0, 22, 0);

        this.matHandle = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false });
        this.matHandleHover = new THREE.MeshBasicMaterial({ color: 0x34d399, depthTest: false });

        const shaftMesh = new THREE.Mesh(shaftGeo, this.matHandle);
        shaftMesh.renderOrder = 1010;
        const headMesh = new THREE.Mesh(headGeo, this.matHandle);
        headMesh.renderOrder = 1010;

        // Invisible generous hit cylinder for easy picking
        const hitGeo = new THREE.CylinderGeometry(10, 10, 30, 12);
        hitGeo.translate(0, 15, 0);
        const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.userData = { isPlatformHeightHandle: true };

        this.heightHandleGroup.add(shaftMesh, headMesh, hitMesh);
    }

    _createDOMHUD() {
        if (typeof document === 'undefined') return;

        this.domHUD = document.createElement('div');
        this.domHUD.className = 'sms4-platform-3d-hud';
        this.domHUD.style.cssText = `
            position: absolute;
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            pointer-events: auto;
            transform: translate(-50%, -100%);
            z-index: 9999;
            user-select: none;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            filter: drop-shadow(0 8px 24px rgba(0,0,0,0.6));
        `;

        ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick'].forEach(ev => {
            this.domHUD.addEventListener(ev, (e) => e.stopPropagation());
        });

        // Inner HUD Container (Compact Pill Layout)
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
            background: rgba(255, 255, 255, 0.96);
            border: 1px solid rgba(226, 232, 240, 0.95);
            border-radius: 9999px;
            padding: 4px 6px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            max-width: min(94vw, 360px);
            box-sizing: border-box;
            overflow-x: auto;
            scrollbar-width: none;
        `;

        // 0. Move Button
        this.btnMove = document.createElement('button');
        this.btnMove.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg><span>Move</span>`;
        this.btnMove.title = 'Move Platform (Translate X/Z)';
        this._styleHUDButton(this.btnMove, '#e2e8f0', '#ffffff', '#334155');
        this.btnMove.onclick = (e) => {
            e.stopPropagation();
            const commonTools = this.ctx.commonTools || 
                                this.ctx.preview3D?.commonTools || 
                                this.ctx.interactions?.commonController || 
                                (typeof window !== 'undefined' ? (window.renderer3D?.commonTools || window.planner?.engine3d?.commonTools) : null);
            if (commonTools) {
                commonTools.activateAction('move');
            }
        };
        this._attachTooltip(this.btnMove, 'Move Platform', 'Translate in 3D scene (M / G)');

        // 0b. Spin Button
        this.btnSpin = document.createElement('button');
        this.btnSpin.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg><span>Spin</span>`;
        this.btnSpin.title = 'Rotate Platform';
        this._styleHUDButton(this.btnSpin, '#e2e8f0', '#ffffff', '#334155');
        this.btnSpin.onclick = (e) => {
            e.stopPropagation();
            const commonTools = this.ctx.commonTools || 
                                this.ctx.preview3D?.commonTools || 
                                this.ctx.interactions?.commonController || 
                                (typeof window !== 'undefined' ? (window.renderer3D?.commonTools || window.planner?.engine3d?.commonTools) : null);
            if (commonTools) {
                commonTools.activateAction('spin');
            }
        };
        this._attachTooltip(this.btnSpin, 'Rotate Platform', 'Rotate in 3D scene (R)');

        // 1. Raise Button (▲)
        const btnRaise = document.createElement('button');
        btnRaise.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
            <span style="font-size:11px;font-weight:700;margin-left:2px;">+15</span>
        `;
        btnRaise.title = 'Raise Platform (+15cm / 1 Step)';
        this._styleHUDButton(btnRaise, '#bbf7d0', '#f0fdf4', '#15803d');
        btnRaise.onclick = (e) => {
            e.stopPropagation();
            if (this.platform) {
                this.platform.raisePlatform(15);
                this.update();
                this._showMicroFeedback('Raised +15cm', e.clientX, e.clientY);
            }
        };
        this._attachTooltip(btnRaise, 'Raise Platform', '+15 cm (1 Step)');

        // 2. Lower Button (▼)
        const btnLower = document.createElement('button');
        btnLower.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <span style="font-size:11px;font-weight:700;margin-left:2px;">-15</span>
        `;
        btnLower.title = 'Lower Platform (-15cm / 1 Step)';
        this._styleHUDButton(btnLower, '#fed7aa', '#fff7ed', '#c2410c');
        btnLower.onclick = (e) => {
            e.stopPropagation();
            if (this.platform) {
                this.platform.lowerPlatform(15);
                this.update();
                this._showMicroFeedback('Lowered -15cm', e.clientX, e.clientY);
            }
        };
        this._attachTooltip(btnLower, 'Lower Platform', '-15 cm (1 Step)');

        // 3. Step Info Badge
        this.hudBadge = document.createElement('div');
        this.hudBadge.style.cssText = `
            color: #0f172a;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 7px;
            background: #f8fafc;
            border-radius: 8px;
            white-space: nowrap;
            letter-spacing: 0.1px;
            border: 1px solid #e2e8f0;
            flex-shrink: 0;
        `;
        this.hudBadge.textContent = 'Platform: 20cm (1 Step)';
        this._attachTooltip(this.hudBadge, 'Platform Specs', 'Current height & step count');

        // 4. Trim Profile Dropdown / Switcher Button
        const btnTrim = document.createElement('button');
        btnTrim.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
            </svg>
            <span style="font-size:11px;font-weight:600;margin-left:2px;">Trim</span>
        `;
        btnTrim.title = 'Change Platform Trim Profile';
        this._styleHUDButton(btnTrim, '#e2e8f0', '#ffffff', '#334155');
        btnTrim.onclick = (e) => {
            e.stopPropagation();
            this._cycleTrimStyle();
            const trimName = PLATFORM_TRIM_STYLES[this.platform?.trimStyle]?.name || 'Clean';
            this._showMicroFeedback(`Trim: ${trimName}`, e.clientX, e.clientY);
        };
        this._attachTooltip(btnTrim, 'Trim Profile Style', 'Cycle Flat, Bevel, Bullnose, Stepped, Crown');

        // 5. Rotate 90° Button
        const btnRotate = document.createElement('button');
        btnRotate.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
        `;
        btnRotate.title = 'Rotate Platform 90°';
        this._styleHUDButton(btnRotate, '#e2e8f0', '#ffffff', '#334155');
        btnRotate.onclick = (e) => {
            e.stopPropagation();
            if (this.platform) {
                this.platform.rotation = (this.platform.rotation + 90) % 360;
                if (this.platform.group) this.platform.group.rotation(this.platform.rotation);
                this.platform._sync3DTransform();
                if (this.platform.planner?.syncAll) this.platform.planner.syncAll();
                if (this.platform.planner?.debouncedSaveHistory) this.platform.planner.debouncedSaveHistory();
                this.update();
                this._showMicroFeedback(`Rotated to ${this.platform.rotation}°`, e.clientX, e.clientY);
            }
        };
        this._attachTooltip(btnRotate, 'Rotate 90°', 'Rotate platform clockwise');

        // 6. Delete Button (✕)
        const btnDelete = document.createElement('button');
        btnDelete.innerHTML = `✕`;
        btnDelete.title = 'Delete Platform';
        btnDelete.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
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
        btnDelete.onmouseenter = () => {
            btnDelete.style.background = '#fee2e2';
            btnDelete.style.color = '#ef4444';
        };
        btnDelete.onmouseleave = () => {
            btnDelete.style.background = 'transparent';
            btnDelete.style.color = '#94a3b8';
        };
        btnDelete.onclick = (e) => {
            e.stopPropagation();
            if (this.platform) {
                const planner = this.platform.planner;
                this.detach();
                this.platform.destroy();
                if (planner) {
                    planner.selectEntity(null);
                    if (planner.syncAll) planner.syncAll();
                    if (planner.debouncedSaveHistory) planner.debouncedSaveHistory();
                }
            }
        };
        this._attachTooltip(btnDelete, 'Delete Platform', 'Remove platform from scene (Del)');

        container.appendChild(this.btnMove);
        container.appendChild(this.btnSpin);
        container.appendChild(btnRaise);
        container.appendChild(btnLower);
        container.appendChild(this.hudBadge);
        container.appendChild(btnTrim);
        container.appendChild(btnRotate);
        container.appendChild(btnDelete);

        this.domHUD.appendChild(container);
        document.body.appendChild(this.domHUD);
    }

    _styleHUDButton(btn, borderColor = '#e2e8f0', bg = '#ffffff', textColor = '#334155') {
        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 24px;
            padding: 0 7px;
            border-radius: 12px;
            border: 1px solid ${borderColor};
            background: ${bg};
            color: ${textColor};
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            transition: all 0.15s ease;
            outline: none;
            white-space: nowrap;
            flex-shrink: 0;
            line-height: 1;
        `;
        btn.onmouseenter = () => {
            btn.style.transform = 'translateY(-1px)';
            btn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.06)';
        };
        btn.onmouseleave = () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = 'none';
        };
    }

    /* -------------------------------------------------------------------------- */
    /*                         LIVE TOOLTIP BADGE                                 */
    /* -------------------------------------------------------------------------- */

    _createFloatingTooltip() {
        if (typeof document === 'undefined') return;

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'sms4-platform-tooltip';
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

    _showMicroFeedback(msg, clientX, clientY) {
        if (!this.tooltip) return;
        this.tooltip.innerHTML = `<span style="color:#10b981; font-weight:800;">✓</span> <span style="color:#ffffff; font-weight:700;">${msg}</span>`;
        this.tooltip.style.display = 'block';
        const tw = this.tooltip.offsetWidth || 120;
        const th = this.tooltip.offsetHeight || 28;
        let left = clientX || (window.innerWidth / 2);
        let top = (clientY ? clientY - th - 8 : 100);
        if (top < 10) top = 80;
        const maxW = typeof window !== 'undefined' ? window.innerWidth : 800;
        left = Math.max(tw / 2 + 10, Math.min(maxW - tw / 2 - 10, left));

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.transform = 'translate(-50%, 0)';
        this.tooltip.style.opacity = '1';

        setTimeout(() => this._hideTooltip(), 1200);
    }

    _cycleTrimStyle() {
        if (!this.platform) return;
        const styles = Object.keys(PLATFORM_TRIM_STYLES);
        const curIdx = styles.indexOf(this.platform.trimStyle || 'flat');
        const nextStyle = styles[(curIdx + 1) % styles.length];
        this.platform.setTrimStyle(nextStyle);
        this.update();
    }

    attach(object) {
        if (!object) return;
        this.target = object;
        this.platform = object.userData?.entity || (object.parent?.userData?.entity) || null;

        if (!this.platform || this.platform.type !== 'platform') {
            this.detach();
            return;
        }

        this.visible = true;
        const actionActive = this._isActionActive();
        this.heightHandleGroup.visible = !actionActive;
        if (this.domHUD) this.domHUD.style.display = actionActive ? 'none' : 'flex';

        this.update();
    }

    detach() {
        this.target = null;
        this.platform = null;
        this.visible = false;
        this.heightHandleGroup.visible = false;
        this.isDraggingHeight = false;
        if (this.domHUD) this.domHUD.style.display = 'none';
    }

    update() {
        if (!this.platform || !this.target || !this.ctx.camera || !this.ctx.renderer) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            return;
        }

        if (this._isActionActive()) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            if (this.heightHandleGroup) this.heightHandleGroup.visible = false;
            return;
        } else {
            if (this.heightHandleGroup) this.heightHandleGroup.visible = true;
        }

        const absH = Math.max(1, Math.abs(this.platform.height || 20));
        const cy = (this.platform.elevation || 0) + (this.platform.height < 0 ? 0 : absH);

        // Position 3D height handle on top center of platform
        this.heightHandleGroup.position.set(this.platform.x, cy, this.platform.y);

        const isMobileScreen = (typeof window !== 'undefined' && window.innerWidth <= 768);

        // Hide redundant move/spin buttons on mobile
        if (this.btnMove) this.btnMove.style.display = isMobileScreen ? 'none' : 'flex';
        if (this.btnSpin) this.btnSpin.style.display = isMobileScreen ? 'none' : 'flex';

        // Update DOM Badge
        if (this.hudBadge) {
            const trimName = PLATFORM_TRIM_STYLES[this.platform.trimStyle]?.name || 'Clean';
            const label = typeof this.platform.getStepLabel === 'function' ? this.platform.getStepLabel() : `Platform: ${this.platform.height || 20}cm`;
            this.hudBadge.innerHTML = `<strong>${label}</strong> • <span style="color:#2563eb;">${trimName}</span>`;
        }

        // Project top center to screen coordinates for floating HUD
        const worldPos = new THREE.Vector3(this.platform.x, cy + 28, this.platform.y);
        const v = worldPos.clone().project(this.ctx.camera);

        // Behind camera check
        if (v.z > 1) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            return;
        }

        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        const rectW = rect.width || 800;
        const rectH = rect.height || 600;
        const rectLeft = rect.left || 0;
        const rectTop = rect.top || 0;
        const rectRight = (rect.right !== undefined) ? rect.right : (rectLeft + rectW);
        const rectBottom = (rect.bottom !== undefined) ? rect.bottom : (rectTop + rectH);

        const screenX = ((v.x + 1) / 2) * rectW + rectLeft;
        const screenY = ((-v.y + 1) / 2) * rectH + rectTop;

        const hudW = this.domHUD.offsetWidth || (isMobileScreen ? 280 : 340);
        const hudH = this.domHUD.offsetHeight || 38;

        const safeTop = rectTop + (isMobileScreen ? 64 : 52);
        const safeBottom = rectBottom - (isMobileScreen ? 76 : 30);
        const safeLeft = rectLeft + (isMobileScreen ? 68 : 58);
        const safeRight = rectRight - (isMobileScreen ? 12 : 58);

        const targetTopAbove = screenY - 14;
        let posTop;
        let transformY = '0';

        if (targetTopAbove - hudH < safeTop) {
            const targetTopBelow = screenY + 36;
            if (targetTopBelow >= safeTop && targetTopBelow + hudH <= safeBottom) {
                posTop = targetTopBelow;
                transformY = '0';
            } else {
                posTop = Math.max(safeTop, Math.min(safeBottom - hudH, targetTopAbove - hudH));
                transformY = '0';
            }
        } else {
            posTop = Math.max(safeTop, Math.min(safeBottom - hudH, targetTopAbove));
            transformY = '-100%';
        }
        posTop = Math.max(safeTop, Math.min(safeBottom - hudH, posTop));

        let clampedX;
        if (safeRight - safeLeft < hudW) {
            clampedX = (safeLeft + safeRight) / 2;
        } else {
            const halfW = hudW / 2;
            clampedX = Math.max(safeLeft + halfW, Math.min(safeRight - halfW, screenX));
        }

        if (this.domHUD) {
            this.domHUD.style.left = `${clampedX}px`;
            this.domHUD.style.top = `${posTop}px`;
            this.domHUD.style.transform = `translate(-50%, ${transformY})`;
            this.domHUD.style.display = 'flex';
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    _onPointerDown(e) {
        if (!this.platform || !this.heightHandleGroup.visible) return;

        const dom = this.ctx.renderer?.domElement;
        if (!dom || !this.ctx.camera) return;
        const rect = dom.getBoundingClientRect();

        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const hits = this.raycaster.intersectObjects(this.heightHandleGroup.children, true);

        if (hits.length > 0) {
            e.stopPropagation();
            this.isDraggingHeight = true;
            this.dragStartY = e.clientY;
            this.initialHeight = this.platform.height || 20;
            if (dom.setPointerCapture) dom.setPointerCapture(e.pointerId);
        }
    }

    _onPointerMove(e) {
        if (this.isDraggingHeight && this.platform) {
            e.stopPropagation();
            const deltaY = this.dragStartY - e.clientY; // Upward drag = positive height
            const stepH = this.platform.stepHeight || 15;
            const newHeight = this.initialHeight + (deltaY * 0.5);

            // Snap to steps if within 4cm of integer step
            const nearestStep = Math.round(newHeight / stepH) * stepH;
            const finalH = Math.abs(newHeight - nearestStep) < 4 ? nearestStep : Math.round(newHeight);

            this.platform.setHeight(finalH);
            this._showMicroFeedback(`Height: ${finalH} cm`, e.clientX, e.clientY);
            this.update();
            return;
        }

        // Update floating HUD position during camera orbit/pan
        if (this.platform && this.visible) {
            this.update();
        }
    }

    _onPointerUp(e) {
        if (this.isDraggingHeight) {
            e.stopPropagation();
            this.isDraggingHeight = false;
            const dom = this.ctx.renderer?.domElement;
            if (dom && dom.releasePointerCapture && e.pointerId) {
                try { dom.releasePointerCapture(e.pointerId); } catch(err) {}
            }
            if (this.platform?.planner?.debouncedSaveHistory) {
                this.platform.planner.debouncedSaveHistory();
            }
            this.update();
        }
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
        if (coreEventBus) {
            coreEventBus.off('InteractionStateChanged', this._onInteractionStateChanged);
        }
        if (this.domHUD && this.domHUD.parentElement) {
            this.domHUD.parentElement.removeChild(this.domHUD);
        }
        if (this.tooltip && this.tooltip.parentElement) {
            this.tooltip.parentElement.removeChild(this.tooltip);
        }
    }
}

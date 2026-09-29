import * as THREE from 'three';
import { StairHeightDetector } from '../../features/stairs/StairHeightDetector.js';
import { StairEngine } from '../stairs/StairEngine.js';
import { DeleteCommand } from '../commands/DeleteCommand.js';
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

        this._createDOMHUD();
        this._createFloatingTooltip();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Auto-Height detection
        this.autoHeightEnabled = true;

        this._onCameraChange = this._onCameraChange.bind(this);
        this._onGeometryUpdated = this._onGeometryUpdated.bind(this);
        this._onInteractionStateChanged = this._onInteractionStateChanged.bind(this);

        if (this.ctx.controls) {
            this.ctx.controls.addEventListener('change', this._onCameraChange);
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this._onCameraChange);
        }

        if (coreEventBus) {
            coreEventBus.on('EntityGeometryUpdated', this._onGeometryUpdated);
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
            if (this.handlesGroup) this.handlesGroup.visible = false;
            return;
        }
        if (!this.stair || !this.visible) return;
        if (state && state.state === 'object_selected' && (state.selectedEntity === this.stair || state.selectedEntity?.id === this.stair.id)) {
            if (this.handlesGroup) this.handlesGroup.visible = true;
            this.update();
        } else if (state && state.state === 'idle') {
            this.detach();
        }
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
            gap: 4px;
            pointer-events: auto;
            transform: translate(-50%, -100%);
            z-index: 9999;
            user-select: none;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            filter: drop-shadow(0 8px 24px rgba(0,0,0,0.65));
        `;

        ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick'].forEach(ev => {
            this.domHUD.addEventListener(ev, (e) => e.stopPropagation());
        });

        // Header Line: Dimension Badge & Delete Button (Transparent Single Line Docked Top-Right)
        const headerRow = document.createElement('div');
        headerRow.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 3px;
            width: fit-content;
            align-self: flex-end;
            background: transparent;
            padding: 0;
            margin-bottom: 1px;
            box-sizing: border-box;
        `;

        this.hudSpecBadge = document.createElement('div');
        this.hudSpecBadge.style.cssText = `
            font-size: 9.5px;
            font-weight: 700;
            color: #475569;
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid rgba(226, 232, 240, 0.9);
            padding: 2px 6px;
            border-radius: 6px;
            white-space: nowrap;
            line-height: 1;
            display: flex;
            align-items: center;
            gap: 2px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
        `;
        this.hudSpecBadge.textContent = '100×300';
        this._attachTooltip(this.hudSpecBadge, 'Staircase Dimensions', 'Width × Height • Step Count');

        const btnDelete = document.createElement('button');
        btnDelete.innerHTML = '✕';
        btnDelete.title = 'Delete Staircase';
        btnDelete.style.cssText = `
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
            this._deleteStaircase();
        };
        this.btnDelete = btnDelete;
        this._attachTooltip(btnDelete, 'Delete Staircase', 'Remove from scene (Del)');

        headerRow.appendChild(this.hudSpecBadge);
        headerRow.appendChild(btnDelete);

        // Controls Card: Compact Frosted Glass Housing Tools & Parameters (Centered, Width up to Content)
        const controlsCard = document.createElement('div');
        controlsCard.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 3.5px;
            background: rgba(255, 255, 255, 0.96);
            border: 1px solid rgba(226, 232, 240, 0.95);
            border-radius: 12px;
            padding: 4px 6px;
            box-shadow: 0 10px 25px -4px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            width: fit-content;
            align-self: center;
            max-width: min(calc(100vw - 32px), 320px);
            box-sizing: border-box;
        `;

        // Row 1: Tools Row (Move & Spin + Shapes, Centered)
        const toolsRow = document.createElement('div');
        toolsRow.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 3px;
            width: fit-content;
            box-sizing: border-box;
        `;

        // Section 1: Transform Manipulation Controls (✢ Move & ↻ Spin - Icon-Only Matching Shapes)
        const transformSection = document.createElement('div');
        transformSection.style.cssText = `
            display: flex;
            align-items: center;
            gap: 1.5px;
            background: #f1f5f9;
            padding: 1.5px;
            border-radius: 7px;
            border: 1px solid #e2e8f0;
            box-sizing: border-box;
            flex-shrink: 0;
        `;

        // 1.1 Move Action Button (Icon-Only Matching Shapes)
        this.btnMove = document.createElement('button');
        this.btnMove.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>`;
        this.btnMove.title = 'Move Staircase (Translate X/Z)';
        this._styleTopIconButton(this.btnMove);
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
        this._attachTooltip(this.btnMove, 'Move Staircase', 'Translate across floor (Key: M / G)');

        // 1.2 Spin Action Button (Icon-Only Matching Shapes)
        this.btnSpin = document.createElement('button');
        this.btnSpin.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;
        this.btnSpin.title = 'Rotate Staircase';
        this._styleTopIconButton(this.btnSpin);
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
        this._attachTooltip(this.btnSpin, 'Rotate Staircase', 'Rotate 90° or drag angle (Key: R)');

        transformSection.appendChild(this.btnMove);
        transformSection.appendChild(this.btnSpin);

        // Section 2: Segmented Shape Morpher SVGs (Straight, L, U, T)
        const shapeRow = document.createElement('div');
        shapeRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 1.5px;
            background: #f1f5f9;
            padding: 1.5px;
            border-radius: 7px;
            border: 1px solid #e2e8f0;
            box-sizing: border-box;
            flex-shrink: 0;
        `;

        const shapes = [
            {
                id: 'straight',
                label: 'Straight',
                svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 20h4v-4h4v-4h4v-4h4"/></svg>',
                sub: 'Continuous single-flight staircase'
            },
            {
                id: 'L',
                label: 'L-Turn',
                svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 20h6v-6h6V4h4"/></svg>',
                sub: '90° quarter-turn with landing'
            },
            {
                id: 'U',
                label: 'U-Turn',
                svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 20h4v-8a3 3 0 0 1 6 0v8h4"/></svg>',
                sub: '180° switchback with landing'
            },
            {
                id: 'T',
                label: 'T-Split',
                svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20v-8m-7-4h14M5 8v4m14-4v4"/></svg>',
                sub: 'Grand split dual-turn staircase'
            }
        ];

        this.shapeButtons = {};
        shapes.forEach(s => {
            const btn = document.createElement('button');
            btn.innerHTML = s.svg;
            btn.title = s.label;
            this._styleTopIconButton(btn);
            btn.onclick = (e) => {
                e.stopPropagation();
                if (this.stair) {
                    const planner = this.ctx.planner || this.stair.planner;
                    StairEngine.setShape(planner, this.stair, s.id);
                    this._syncRealtimeUpdate();
                    this.update();
                    this._showMicroFeedback(`Shape: ${s.label}`, e.clientX, e.clientY);
                }
            };
            this.shapeButtons[s.id] = btn;
            shapeRow.appendChild(btn);
            this._attachTooltip(btn, s.label, s.sub);
        });

        toolsRow.appendChild(transformSection);
        toolsRow.appendChild(shapeRow);
        controlsCard.appendChild(toolsRow);

        // Row 2: Interactive Action Controls (Centered & Reduced Whitespace, Width up to Content)
        const actionRow = document.createElement('div');
        actionRow.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 3px;
            width: fit-content;
            overflow-x: auto;
            scrollbar-width: none;
            box-sizing: border-box;
            padding: 1px 0;
        `;

        // 3.1 Flip Turn Button (⇄)
        this.btnFlip = document.createElement('button');
        this.btnFlip.innerHTML = `⇄ Flip`;
        this.btnFlip.title = 'Flip Stair Turn Direction (Left ⇄ Right)';
        this._styleActionButton(this.btnFlip, '#bfdbfe', '#eff6ff', '#1d4ed8');
        this.btnFlip.onclick = (e) => {
            e.stopPropagation();
            if (this.stair) {
                const planner = this.ctx.planner || this.stair.planner;
                StairEngine.flipTurnDirection(planner, this.stair);
                this._syncRealtimeUpdate();
                this.update();
                const dir = this.stair.turnDirection || 'right';
                this._showMicroFeedback(`Turn: ${dir.toUpperCase()}`, e.clientX, e.clientY);
            }
        };
        this._attachTooltip(this.btnFlip, 'Flip Turn Direction', 'Toggle turn Left ⇄ Right');

        // 3.2 Width Stepper [-] [100 cm] [+]
        const widthGroup = document.createElement('div');
        widthGroup.style.cssText = 'display: flex; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; height: 23px; flex-shrink: 0;';

        const btnWidthMinus = document.createElement('button');
        btnWidthMinus.textContent = '−';
        btnWidthMinus.style.cssText = 'width: 20px; height: 23px; border: none; background: transparent; color: #475569; font-weight: 700; font-size: 13px; cursor: pointer; padding: 0; line-height: 1; transition: background 0.15s ease;';
        btnWidthMinus.onmouseenter = () => btnWidthMinus.style.background = '#f1f5f9';
        btnWidthMinus.onmouseleave = () => btnWidthMinus.style.background = 'transparent';
        btnWidthMinus.onclick = (e) => {
            e.stopPropagation();
            if (this.stair) {
                const planner = this.ctx.planner || this.stair.planner;
                const newW = Math.max(40, (this.stair.width || 100) - 10);
                StairEngine.setWidth(planner, this.stair, newW);
                this._syncRealtimeUpdate();
                this.update();
                this._showMicroFeedback(`Width: ${newW} cm`, e.clientX, e.clientY);
            }
        };
        this._attachTooltip(btnWidthMinus, 'Decrease Width', '-10 cm');

        this.elWidthVal = document.createElement('div');
        this.elWidthVal.style.cssText = 'font-size: 10.5px; font-weight: 700; color: #0f172a; padding: 0 4px; min-width: 42px; text-align: center; white-space: nowrap;';
        this.elWidthVal.textContent = '100 cm';

        const btnWidthPlus = document.createElement('button');
        btnWidthPlus.textContent = '+';
        btnWidthPlus.style.cssText = 'width: 20px; height: 23px; border: none; background: transparent; color: #475569; font-weight: 700; font-size: 13px; cursor: pointer; padding: 0; line-height: 1; transition: background 0.15s ease;';
        btnWidthPlus.onmouseenter = () => btnWidthPlus.style.background = '#f1f5f9';
        btnWidthPlus.onmouseleave = () => btnWidthPlus.style.background = 'transparent';
        btnWidthPlus.onclick = (e) => {
            e.stopPropagation();
            if (this.stair) {
                const planner = this.ctx.planner || this.stair.planner;
                const newW = Math.min(300, (this.stair.width || 100) + 10);
                StairEngine.setWidth(planner, this.stair, newW);
                this._syncRealtimeUpdate();
                this.update();
                this._showMicroFeedback(`Width: ${newW} cm`, e.clientX, e.clientY);
            }
        };
        this._attachTooltip(btnWidthPlus, 'Increase Width', '+10 cm');

        widthGroup.appendChild(btnWidthMinus);
        widthGroup.appendChild(this.elWidthVal);
        widthGroup.appendChild(btnWidthPlus);

        // 3.3 Landing Step Stepper [▲ / ▼]
        this.landingStepGroup = document.createElement('div');
        this.landingStepGroup.style.cssText = 'display: flex; align-items: center; gap: 2px; flex-shrink: 0;';

        const btnLandingUp = document.createElement('button');
        btnLandingUp.textContent = '▲';
        btnLandingUp.title = 'Raise Landing (+1 Step to Flight 1)';
        this._styleActionButton(btnLandingUp, '#fed7aa', '#fff7ed', '#c2410c');
        btnLandingUp.style.padding = '0 5px';
        btnLandingUp.onclick = (e) => {
            e.stopPropagation();
            if (this.stair) {
                const planner = this.ctx.planner || this.stair.planner;
                StairEngine.adjustLanding(planner, this.stair, 1);
                this._syncRealtimeUpdate();
                this.update();
                this._showMicroFeedback('+1 Step to Flight 1', e.clientX, e.clientY);
            }
        };
        this._attachTooltip(btnLandingUp, 'Raise Landing', '+1 step to Flight 1');

        const btnLandingDown = document.createElement('button');
        btnLandingDown.textContent = '▼';
        btnLandingDown.title = 'Lower Landing (-1 Step to Flight 1)';
        this._styleActionButton(btnLandingDown, '#fed7aa', '#fff7ed', '#c2410c');
        btnLandingDown.style.padding = '0 5px';
        btnLandingDown.onclick = (e) => {
            e.stopPropagation();
            if (this.stair) {
                const planner = this.ctx.planner || this.stair.planner;
                StairEngine.adjustLanding(planner, this.stair, -1);
                this._syncRealtimeUpdate();
                this.update();
                this._showMicroFeedback('-1 Step to Flight 1', e.clientX, e.clientY);
            }
        };
        this._attachTooltip(btnLandingDown, 'Lower Landing', '-1 step to Flight 1');

        this.landingStepGroup.appendChild(btnLandingUp);
        this.landingStepGroup.appendChild(btnLandingDown);

        // 3.4 Stringer Style Cycle Button
        this.btnStringer = document.createElement('button');
        this.btnStringer.title = 'Change Stringer Base Style (Solid / Mono / Double / Side / Box)';
        this._styleActionButton(this.btnStringer, '#e2e8f0', '#ffffff', '#334155');
        this.btnStringer.textContent = 'Solid';
        this.btnStringer.onclick = (e) => {
            e.stopPropagation();
            this._cycleStringerType();
            this._showMicroFeedback(`Stringer: ${this.btnStringer.textContent}`, e.clientX, e.clientY);
        };
        this._attachTooltip(this.btnStringer, 'Stringer Base Style', 'Cycle Solid, Mono, Double, Side, Box');

        // 3.5 Auto-Height Snap Button
        this.btnAutoHeight = document.createElement('button');
        this.btnAutoHeight.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>Auto</span>`;
        this.btnAutoHeight.title = 'Auto-detect floor or platform height';
        this._styleActionButton(this.btnAutoHeight, '#bbf7d0', '#f0fdf4', '#15803d');
        this.btnAutoHeight.onclick = (e) => {
            e.stopPropagation();
            this._autoFitHeight();
        };
        this._attachTooltip(this.btnAutoHeight, 'Auto Snap Height', 'Match floor or platform height');

        actionRow.appendChild(widthGroup);
        actionRow.appendChild(this.btnFlip);
        actionRow.appendChild(this.landingStepGroup);
        actionRow.appendChild(this.btnStringer);
        actionRow.appendChild(this.btnAutoHeight);
        controlsCard.appendChild(actionRow);

        this.domHUD.appendChild(headerRow);
        this.domHUD.appendChild(controlsCard);
        document.body.appendChild(this.domHUD);
    }

    _styleTopIconButton(btn) {
        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 22px;
            padding: 0;
            border-radius: 5px;
            border: none;
            background: transparent;
            color: #64748b;
            cursor: pointer;
            transition: all 0.12s ease;
            outline: none;
            white-space: nowrap;
            flex-shrink: 0;
            line-height: 1;
        `;
        btn.onmouseenter = () => {
            if (btn.style.background === 'transparent' || !btn.style.background || btn.style.background.includes('rgba')) {
                btn.style.background = '#ffffff';
                btn.style.color = '#1d4ed8';
                btn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.08)';
            }
        };
        btn.onmouseleave = () => {
            if (btn.style.color === 'rgb(29, 78, 216)' || btn.style.color === '#1d4ed8') {
                btn.style.background = 'transparent';
                btn.style.color = '#64748b';
                btn.style.boxShadow = 'none';
            }
        };
    }

    _styleActionButton(btn, borderColor = '#e2e8f0', bg = '#ffffff', textColor = '#334155') {
        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 23px;
            padding: 0 6px;
            border-radius: 6px;
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
        this.tooltip.className = 'sims4-stair-tooltip';
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
        if (top < 10) top = clientY + 24; // flip below if off top
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

    /* -------------------------------------------------------------------------- */
    /*                               ATTACH / DETACH                              */
    /* -------------------------------------------------------------------------- */

    attach(object) {
        if (!object) return;
        this.target = object.isGroup ? object : (object.parent?.isGroup ? object.parent : object);
        this.stair = object.userData?.entity || (object.parent?.userData?.entity) || null;

        const isActualStair = Boolean(
            object.userData?.isStair ||
            object.parent?.userData?.isStair ||
            (this.stair && (
                this.stair.type === 'staircase' ||
                (typeof this.stair.type === 'string' && this.stair.type.startsWith('stair')) ||
                this.stair.constructor?.name === 'PremiumStaircase' ||
                this.stair.totalSteps !== undefined
            ))
        ) && !object.userData?.isFloor && !object.userData?.isPlatform && !object.userData?.isRoomFloor && !object.userData?.isWall && !object.userData?.isWallMesh && !object.userData?.isWallSide;

        if (!this.stair || !isActualStair) {
            this.detach();
            return;
        }

        this.visible = true;
        const actionActive = this._isActionActive();
        this.handlesGroup.visible = !actionActive;
        if (this.domHUD) {
            this.domHUD.style.display = actionActive ? 'none' : 'flex';
        }

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
        if (this.ctx?.viewMode === '2d' || this.ctx?.preview3D?.viewMode === '2d' || (typeof window !== 'undefined' && (window.planner?.viewMode === '2d' || window.plannerInstance?.viewMode === '2d'))) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            if (this.handlesGroup) this.handlesGroup.visible = false;
            return;
        }

        if (!this.stair || !this.target || !this.ctx.camera || !this.ctx.renderer) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            return;
        }

        // CRITICAL: Suppress floating properties HUD and handles during active Move/Spin action
        if (this._isActionActive()) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            if (this.handlesGroup) this.handlesGroup.visible = false;
            return;
        } else {
            if (this.handlesGroup) this.handlesGroup.visible = true;
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

        // Calculate center/landing reference point for DOM HUD positioning
        let landingLocal = new THREE.Vector3();
        if (shape === 'straight') {
            landingLocal.set(0, f1Steps * stepHeight, l1 * 0.5);
        } else if (shape === 'L') {
            landingLocal.set(0, f1Steps * stepHeight, l1 + landingSize / 2);
        } else if (shape === 'U') {
            const lx = turnDir === 'right' ? (width + gapWidth) / 2 : -(width + gapWidth) / 2;
            landingLocal.set(lx, f1Steps * stepHeight, l1 + landingSize / 2);
        } else if (shape === 'T') {
            landingLocal.set(0, f1Steps * stepHeight, l1 + landingSize / 2);
        }
        const landingWorld = landingLocal.clone().applyMatrix4(stairMatrix);

        // 1. Update HUD State
        this._updateHUDContent(shape, width, height, totalSteps, f1Steps, f2Steps, turnDir);

        // 2. Position HUD in Screen Coordinates
        this._updateHUDPosition(landingWorld);

        if (this.ctx.requestRender) {
            this.ctx.requestRender();
        }
    }

    _updateHUDContent(shape, width, height, totalSteps, f1Steps, f2Steps, turnDir) {
        if (!this.domHUD) return;

        const isMobile = (typeof window !== 'undefined' && window.innerWidth <= 768);

        // Spec Badge (Concise on mobile to prevent header overflow)
        if (this.hudSpecBadge) {
            this.hudSpecBadge.textContent = isMobile 
                ? `${Math.round(width)}×${Math.round(height)} • ${totalSteps}st`
                : `${Math.round(width)} × ${Math.round(height)} cm • ${totalSteps} Steps`;
        }

        // Active Shape button styling (Light segmented control)
        if (this.shapeButtons) {
            Object.entries(this.shapeButtons).forEach(([id, btn]) => {
                const isActive = (id === shape);
                btn.style.background = isActive ? '#ffffff' : 'transparent';
                btn.style.color = isActive ? '#2563eb' : '#64748b';
                btn.style.boxShadow = isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
            });
        }

        // Width value
        if (this.elWidthVal) {
            this.elWidthVal.textContent = `${Math.round(width)} cm`;
        }

        // Move and Spin buttons: Always visible in middle row
        if (this.btnMove) this.btnMove.style.display = 'flex';
        if (this.btnSpin) this.btnSpin.style.display = 'flex';

        // Flip button & landing steppers visibility
        const hasTurn = (shape === 'L' || shape === 'U');
        if (this.btnFlip) {
            this.btnFlip.style.display = hasTurn ? 'flex' : 'none';
            this.btnFlip.innerHTML = isMobile ? `⇄ ${turnDir === 'right' ? 'R' : 'L'}` : `⇄ ${turnDir === 'right' ? 'Right' : 'Left'}`;
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

        if (this.ctx?.viewMode === '2d' || this.ctx?.preview3D?.viewMode === '2d' || (typeof window !== 'undefined' && (window.planner?.viewMode === '2d' || window.plannerInstance?.viewMode === '2d'))) {
            this.domHUD.style.display = 'none';
            return;
        }

        if (this._isActionActive()) {
            this.domHUD.style.display = 'none';
            return;
        }

        // Place HUD anchor above the landing / center point
        const elevatedPos = worldPos.clone().add(new THREE.Vector3(0, 35, 0));
        const v = elevatedPos.project(this.ctx.camera);

        // Behind camera check
        if (v.z > 1) {
            this.domHUD.style.display = 'none';
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

        const isMobileScreen = (typeof window !== 'undefined' && window.innerWidth <= 768);
        const hudW = this.domHUD.offsetWidth || 220;
        const hudH = this.domHUD.offsetHeight || 62;

        // Viewport safe boundary insets:
        // Top clears topbar & ViewCube: 64px on mobile, 52px on desktop
        // Bottom clears bottom navigation capsule: 76px on mobile, 30px on desktop
        // Left clears left vertical tools (✢, ↻, etc.): 68px on mobile, 58px on desktop
        // Right clears right canvas border: 12px on mobile, 58px on desktop
        const safeTop = rectTop + (isMobileScreen ? 64 : 52);
        const safeBottom = rectBottom - (isMobileScreen ? 76 : 30);
        const safeLeft = rectLeft + (isMobileScreen ? 68 : 58);
        const safeRight = rectRight - (isMobileScreen ? 12 : 58);

        // Vertical position: Default sits above target; if headroom is insufficient, flip below
        const targetTopAbove = screenY - 14;
        let posTop;
        let transformY = '0';

        if (targetTopAbove - hudH < safeTop) {
            // Insufficient room above: flip below the staircase
            const targetTopBelow = screenY + 36;
            if (targetTopBelow >= safeTop && targetTopBelow + hudH <= safeBottom) {
                posTop = targetTopBelow;
                transformY = '0';
            } else {
                // If neither side fits freely, clamp firmly between safe bounds
                posTop = Math.max(safeTop, Math.min(safeBottom - hudH, targetTopAbove - hudH));
                transformY = '0';
            }
        } else {
            // Fits cleanly above
            posTop = Math.max(safeTop, Math.min(safeBottom - hudH, targetTopAbove));
            transformY = '-100%';
        }

        // Final guaranteed bound clamp: ensure posTop is always strictly within [safeTop, safeBottom - hudH]
        posTop = Math.max(safeTop, Math.min(safeBottom - hudH, posTop));

        // Horizontal position: Clamp within safe boundaries, centering if space is ultra-narrow
        let clampedX;
        if (safeRight - safeLeft < hudW) {
            clampedX = (safeLeft + safeRight) / 2;
        } else {
            const halfW = hudW / 2;
            clampedX = Math.max(safeLeft + halfW, Math.min(safeRight - halfW, screenX));
        }

        this.domHUD.style.left = `${clampedX}px`;
        this.domHUD.style.top = `${posTop}px`;
        this.domHUD.style.transform = `translate(-50%, ${transformY})`;
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

    isHandlingPointer() {
        return false;
    }

    /* -------------------------------------------------------------------------- */
    /*                              QUICK HUD ACTIONS                             */
    /* -------------------------------------------------------------------------- */

    _cycleStringerType() {
        if (!this.stair) return;
        const types = ['solid', 'mono', 'double', 'side', 'box'];
        const current = this.stair.stringerType || 'solid';
        const next = types[(types.indexOf(current) + 1) % types.length];
        const planner = this.ctx.planner || this.stair.planner;
        StairEngine.setStringerType(planner, this.stair, next);
        this._syncRealtimeUpdate();
        this.update();
    }

    _autoFitHeight() {
        if (!this.stair) return;
        const planner = this.ctx.planner || (this.ctx.appState && this.ctx.appState.planner) || window.planner?.value || window.planner;
        if (!planner) return;

        const changed = StairEngine.autoFitHeight(planner, this.stair);
        if (changed) {
            this._syncRealtimeUpdate();
            this.update();
        }
    }

    _deleteStaircase() {
        if (!this.stair) return;
        const planner = this.stair.planner || this.ctx.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null);
        const stairToDelete = this.stair;
        this.detach();
        if (this.ctx.interactions?.deselect) {
            this.ctx.interactions.deselect();
        }
        if (planner) {
            if (planner.commandManager) {
                planner.commandManager.execute(new DeleteCommand(planner, stairToDelete));
            } else {
                StairEngine.deleteStair(planner, stairToDelete);
            }
            if (planner.debouncedSaveHistory) planner.debouncedSaveHistory();
        }
        if (this.ctx.requestRender) {
            this.ctx.requestRender('Staircase Deleted', 5);
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                                   CLEANUP                                  */
    /* -------------------------------------------------------------------------- */

    destroy() {
        if (this.ctx.controls) {
            this.ctx.controls.removeEventListener('change', this._onCameraChange);
        }

        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._onCameraChange);
        }

        if (coreEventBus) {
            coreEventBus.off('EntityGeometryUpdated', this._onGeometryUpdated);
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

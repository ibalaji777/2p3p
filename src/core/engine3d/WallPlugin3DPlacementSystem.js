import * as THREE from 'three';
import { WIDGET_REGISTRY } from '../registry.js';
import { MOLDING_REGISTRY } from '../../features/wall/wall.registry.js';
import { DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT } from '../constants/units.js';
import { Molding3DBuilder } from './Molding3DBuilder.js';
import { coreEventBus } from '../EventBus.js';
import { EVENTS } from '../constants/events.js';
import { ComponentRegistry } from './ComponentRegistry.js';
import { getRoomForWallFace, getRoomWallsAndSides, getExteriorWallsAndSides } from './WallPaintSystem.js';
import { WallEngine } from '../wall/WallEngine.js';
import { createStarterElevationSegment } from '../../features/elevation/elevationSegment.registry.js';
import { renderElevationSegment3D } from '../../features/elevation/elevationSegment.renderer3d.js';

/**
 * WallPlugin3DPlacementSystem
 * 
 * Direct Sims 4-Style 3D Wall Placement & Real-Time Wall Aperture Highlighting.
 * Supports Mobile & Desktop:
 * - Doors, Windows, Jali Panels, and Custom Openings
 * - Curtains, Drapes, Roman & Roller Blinds
 * - Framed Canvas Wall Art & Photo Galleries
 * - Elevation Fascias & Facade Box Frames (Shape-Accurate C-shape, L-shape, Box)
 * - Sunshades / Chajjas (attached protruding from chosen wall face)
 * - Baseboards & Skirting (miter-sheared corner-to-corner along chosen wall face)
 * - Wall Trims, Chair Rails, Picture Rails (freeform or smart magnetic height)
 * - Crown Moldings & Friezes (miter-sheared corner-to-corner along top ceiling line)
 * - Elevation Corner Elements, Quoins & Pillars
 * - Sims 4 Scope Placement (Single Wall, Whole Room Loop, Exterior Perimeter Loop)
 */
export class WallPlugin3DPlacementSystem {
    constructor(ctx, interactionSystem) {
        this.ctx = ctx;
        this.interactions = interactionSystem;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.activeWall = null;
        this.activeT = null;
        this.activeSide = 'front';
        this.activeLocalX = 0;
        this.activeElevation = 0;
        this.isValidPlacement = true;
        this.placementScope = 'single'; // 'single', 'room', 'exterior'
        this.lastPointerEvent = null;

        this.molding3DBuilder = new Molding3DBuilder();

        // Container for all 3D Ghost and Highlight elements
        this.placementGroup = new THREE.Group();
        this.placementGroup.name = 'Sims4_WallPlacement_Group';
        this.placementGroup.visible = false;
        this.placementGroup.raycast = () => {};
        this.ctx.scene.add(this.placementGroup);

        // 1. Aperture Cutout Void / Ribbon Mesh
        this.apertureVoidMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.28,
            depthTest: false,
            side: THREE.DoubleSide
        });
        this.apertureVoidMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.apertureVoidMat);
        this.apertureVoidMesh.renderOrder = 1005;
        this.apertureVoidMesh.raycast = () => {};
        this.placementGroup.add(this.apertureVoidMesh);

        // 2. Aperture Glowing Outline Edges
        this.apertureEdgeMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.apertureEdgeMatInvalid = new THREE.LineBasicMaterial({
            color: 0xef4444,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.apertureEdges = new THREE.LineSegments(new THREE.BufferGeometry(), this.apertureEdgeMat);
        this.apertureEdges.renderOrder = 1006;
        this.apertureEdges.raycast = () => {};
        this.placementGroup.add(this.apertureEdges);

        // 3. Container for the Live 3D Model Preview
        this.modelPreviewGroup = new THREE.Group();
        this.modelPreviewGroup.raycast = () => {};
        this.placementGroup.add(this.modelPreviewGroup);

        // 4. Create Stable Static DOM HUD Action Bar
        this.createBadgeDOM();

        this.boundOnKeyDown = (e) => this.onKeyDown(e);
        this.boundOnKeyUp = (e) => this.onKeyUp(e);
        window.addEventListener('keydown', this.boundOnKeyDown);
        window.addEventListener('keyup', this.boundOnKeyUp);

        this._lastToolKey = null;
        this.isPinned = false;
    }

    createBadgeDOM() {
        this.badgeDom = document.createElement('div');
        this.badgeDom.id = 'sims4-wall-plugin-badge';
        this.badgeDom.style.cssText = `
            position: fixed;
            display: none;
            pointer-events: auto;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.94);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border: 1px solid rgba(0, 240, 255, 0.45);
            box-shadow: 0 14px 36px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 240, 255, 0.2);
            border-radius: 9999px;
            padding: 6px 14px;
            color: #f1f5f9;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 600;
            z-index: 995;
            user-select: none;
            -webkit-user-select: none;
            touch-action: manipulation;
            transition: all 0.15s ease;
        `;

        this.badgeDom.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span id="wall-ui-dot" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #00f0ff; box-shadow: 0 0 8px #00f0ff;"></span>
                    <span id="wall-ui-title" style="color: #38bdf8; font-weight: 700; font-size: 12px;">Door / Window</span>
                    <span id="wall-ui-level-badge" style="background: rgba(56, 189, 248, 0.18); border: 1px solid rgba(56, 189, 248, 0.5); color: #38bdf8; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: none;">FLOOR</span>
                </div>
                
                <div style="width: 1px; height: 20px; background: rgba(255, 255, 255, 0.15);"></div>

                <div id="wall-ui-specs" style="color: #cbd5e1; font-size: 11px; font-weight: 500;">
                    120 cm ← → 180 cm
                </div>
                <span id="wall-ui-side" style="color: #94a3b8; font-size: 11px;">Face: <strong id="wall-ui-facetxt" style="color: #38bdf8;">FRONT</strong></span>

                <div style="width: 1px; height: 20px; background: rgba(255, 255, 255, 0.15);"></div>

                <div style="display: flex; align-items: center; gap: 5px;">
                    <button id="wall-ui-btn-scope" type="button" style="display: none; align-items: center; justify-content: center; gap: 3px; background: rgba(147, 51, 234, 0.22); border: 1px solid #a855f7; color: #c084fc; border-radius: 8px; padding: 5px 8px; font-size: 11px; font-weight: 700; cursor: pointer; min-height: 30px;">
                        ⎘ Single Wall
                    </button>
                    <button id="wall-ui-btn-flip" type="button" title="Flip Face (Key: F / Tab)" style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #f1f5f9; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer; min-height: 30px;">
                        ⇄ Flip Face
                    </button>
                    <button id="wall-ui-btn-place" type="button" title="Confirm Placement (Key: Enter / Space)" style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: #22c55e; border: none; color: #0f172a; border-radius: 8px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 30px;">
                        ✓ Place
                    </button>
                    <button id="wall-ui-btn-cancel" type="button" title="Cancel Placement (Key: Esc)" style="display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.1); border: none; color: #94a3b8; border-radius: 50%; width: 28px; height: 28px; font-size: 12px; font-weight: 700; cursor: pointer;">
                        ✕
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(this.badgeDom);

        // Cache stable DOM references
        this.elDot = this.badgeDom.querySelector('#wall-ui-dot');
        this.elTitle = this.badgeDom.querySelector('#wall-ui-title');
        this.elLevelBadge = this.badgeDom.querySelector('#wall-ui-level-badge');
        this.elFaceTxt = this.badgeDom.querySelector('#wall-ui-facetxt');
        this.elSpecs = this.badgeDom.querySelector('#wall-ui-specs');
        this.btnScope = this.badgeDom.querySelector('#wall-ui-btn-scope');
        this.btnFlip = this.badgeDom.querySelector('#wall-ui-btn-flip');
        this.btnPlace = this.badgeDom.querySelector('#wall-ui-btn-place');
        this.btnCancel = this.badgeDom.querySelector('#wall-ui-btn-cancel');

        // Wire handlers with pointer & click support
        const onScopeToggle = (ev) => {
            if (ev) { ev.preventDefault(); ev.stopPropagation(); }
            if (this.placementScope === 'single') this.placementScope = 'room';
            else if (this.placementScope === 'room') this.placementScope = 'exterior';
            else this.placementScope = 'single';
            this.updateScopeButtonLabel();
            this._lastToolKey = null; // force preview rebuild
            if (this.lastPointerEvent) this.onPointerMove(this.lastPointerEvent);
        };
        this.btnScope.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnScope.addEventListener('click', onScopeToggle);

        const onFlip = (ev) => {
            if (ev) { ev.preventDefault(); ev.stopPropagation(); }
            this.flipFace();
        };
        this.btnFlip.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnFlip.addEventListener('click', onFlip);

        const onPlace = (ev) => {
            if (ev) { ev.preventDefault(); ev.stopPropagation(); }
            this.placePlugin();
        };
        this.btnPlace.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnPlace.addEventListener('click', onPlace);

        const onCancel = (ev) => {
            if (ev) { ev.preventDefault(); ev.stopPropagation(); }
            const pl = this.getPlanner();
            if (pl) {
                pl.tool = 'select';
                if (typeof pl.updateToolStates === 'function') pl.updateToolStates();
                pl.syncAll();
            }
            this.hideGhost();
        };
        this.btnCancel.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.btnCancel.addEventListener('click', onCancel);
    }

    updateScopeButtonLabel() {
        if (!this.btnScope) return;
        if (this.placementScope === 'room') {
            this.btnScope.textContent = '🏠 Room Loop';
            this.btnScope.style.borderColor = '#10b981';
            this.btnScope.style.color = '#34d399';
            this.btnScope.style.background = 'rgba(16, 185, 129, 0.25)';
        } else if (this.placementScope === 'exterior') {
            this.btnScope.textContent = '🌐 Exterior';
            this.btnScope.style.borderColor = '#f59e0b';
            this.btnScope.style.color = '#fbbf24';
            this.btnScope.style.background = 'rgba(245, 158, 11, 0.25)';
        } else {
            this.btnScope.textContent = '⎘ Single Wall';
            this.btnScope.style.borderColor = '#a855f7';
            this.btnScope.style.color = '#c084fc';
            this.btnScope.style.background = 'rgba(147, 51, 234, 0.22)';
        }
    }

    onKeyDown(e) {
        if (!this.isPlacementTool()) return;
        if (e.key === 'Shift' && this.placementScope !== 'room') {
            this.placementScope = 'room';
            this.updateScopeButtonLabel();
            this._lastToolKey = null;
            if (this.lastPointerEvent) this.onPointerMove(this.lastPointerEvent);
        } else if (e.key === 'Alt' && this.placementScope !== 'exterior') {
            this.placementScope = 'exterior';
            this.updateScopeButtonLabel();
            this._lastToolKey = null;
            if (this.lastPointerEvent) this.onPointerMove(this.lastPointerEvent);
        }
    }

    onKeyUp(e) {
        if (!this.isPlacementTool()) return;
        if ((e.key === 'Shift' || e.key === 'Alt') && this.placementScope !== 'single') {
            this.placementScope = 'single';
            this.updateScopeButtonLabel();
            this._lastToolKey = null;
            if (this.lastPointerEvent) this.onPointerMove(this.lastPointerEvent);
        }
    }

    isTouchDevice() {
        return window.innerWidth <= 768 || (('ontouchstart' in window) && (navigator.maxTouchPoints > 1) && window.innerWidth <= 1024);
    }

    flipFace() {
        if (!this.activeWall) return;
        this.activeSide = (this.activeSide === 'front') ? 'back' : 'front';
        if (this.elFaceTxt) this.elFaceTxt.textContent = this.activeSide.toUpperCase();
        this._lastToolKey = null; // force preview rebuild

        if (this.activeWall && this.activeT !== null) {
            const planner = this.getPlanner();
            const tool = planner?.tool;
            const wallEntity = this.activeWall;
            const t = this.activeT;
            const elev = this.activeElevation || 0;
            const facing = (this.activeSide === 'back') ? -1 : 1;
            const p1 = wallEntity.startAnchor.position();
            const p2 = wallEntity.endAnchor.position();
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const wallLen = Math.hypot(dx, dy);
            const thick = wallEntity.thickness || wallEntity.config?.thickness || 20;
            const wallH = wallEntity.height || wallEntity.config?.height || 180;
            const preset = planner?.activePresetParams || {};

            const isMolding = tool === 'molding' || tool === 'skirting' || tool === 'wall_trim' || tool.startsWith('molding_') || tool.startsWith('skirting_') || tool.startsWith('trim_') || tool.startsWith('chair_rail') || tool.startsWith('picture_rail') || !!MOLDING_REGISTRY[tool];
            const isElevationTrim = tool === 'elevation_frieze' || tool === 'elevation_foundation_trim';
            const isDoor = !isMolding && !isElevationTrim && (tool.startsWith('door') || preset.doorType !== undefined);
            const isWindow = !isMolding && !isElevationTrim && (tool.startsWith('window') || preset.windowType !== undefined);
            const isJali = !isMolding && !isElevationTrim && (tool === 'jali_panel' || tool.startsWith('jali_'));
            const isSunshade = !isMolding && !isElevationTrim && (tool === 'sunshade' || tool.startsWith('sunshade_') || tool === 'chajja');
            const isCurtain = !isMolding && !isElevationTrim && (tool === 'curtain' || tool.startsWith('curtain_'));
            const isWallArt = !isMolding && !isElevationTrim && (tool === 'wall_art' || tool.startsWith('decor_wall_') || tool.startsWith('decor_photo_'));
            const isFascia = !isMolding && !isElevationTrim && (tool === 'elevation_fascia' || tool.startsWith('fascia_'));
            const isElevSegment = tool === 'elevation_segment';
            const isDrapes = isCurtain && (!preset.curtainType || preset.curtainType.includes('drapes'));

            let itemW = (isMolding || isElevationTrim)
                ? wallLen
                : (isElevSegment ? (preset.length || 180) : (preset.width || (isDoor ? 40 : (isWindow ? 60 : (isJali ? 60 : (isSunshade ? 60 : (isFascia ? 100 : (isCurtain ? (isDrapes ? 80 : 50) : (isWallArt ? 50 : 80)))))))));
            let itemH = (isMolding || isElevationTrim)
                ? (preset.moldingHeight || (preset.height && preset.height <= 30 ? preset.height : 12))
                : (isElevSegment ? (preset.width || 30) : (preset.height || (isDoor ? DOOR_HEIGHT : (isWindow ? WINDOW_HEIGHT : (isJali ? 80 : (isSunshade ? 10 : (isFascia ? 120 : (isCurtain ? (isDrapes ? 95 : 50) : 35))))))));
            let depth = isElevSegment ? (preset.depth || 40) : (preset.depth || (isSunshade ? 30 : (isFascia ? 40 : (isCurtain ? 8 : 3))));
            const projDist = t * wallLen;

            this.updateApertureAndModel(tool, wallEntity, t, elev, facing, wallLen, dx, dy, p1, p2, thick, wallH, itemW, itemH, depth, this.isValidPlacement, isMolding || isElevationTrim, !isDoor && !isWindow && !isJali && !isFascia, isFascia, projDist, preset);
        }

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    isPlacementTool() {
        const planner = this.getPlanner();
        if (!planner) return false;
        const tool = planner.tool;
        if (!tool || tool === 'select' || tool === 'pan') return false;

        const preset = planner.activePresetParams || {};
        const isOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut', 'opening'].includes(tool);
        const isMolding = tool === 'molding' || tool === 'skirting' || tool === 'wall_trim' || tool.startsWith('molding_') || tool.startsWith('skirting_') || tool.startsWith('trim_') || tool.startsWith('chair_rail') || tool.startsWith('picture_rail') || tool === 'elevation_frieze' || tool === 'elevation_foundation_trim' || !!MOLDING_REGISTRY[tool] || (preset && (preset.type?.startsWith('molding_') || preset.profileType?.startsWith('skirting_') || preset.profileType === 'chair_rail' || preset.profileType === 'picture_rail'));
        const isWidget = !!WIDGET_REGISTRY[tool];
        const isDecorOrPlugin = tool === 'elevation_segment' || tool.startsWith('door') || tool.startsWith('window') || tool === 'jali_panel' || tool === 'sunshade' || tool === 'curtain' || tool === 'wall_art' || tool === 'elevation_fascia' || tool.startsWith('jali_') || tool.startsWith('sunshade_') || tool.startsWith('curtain_') || tool.startsWith('decor_wall_') || tool.startsWith('decor_photo_') || tool.startsWith('fascia_');

        return isOpening || isMolding || isWidget || isDecorOrPlugin;
    }

    getPlanner() {
        return this.ctx.planner || window.planner?.value || window.planner || (this.ctx.appState && this.ctx.appState.planner);
    }

    /**
     * Create exact Shape-Accurate 3D Geometry for Elevation Fascias (C-shape, L-shape, Box frame, Towers & Wraps)
     */
    createFasciaShapeGeometry(profileType, width, height, depth, thick, topArm, bottomArm, towerHeight, towerWidth) {
        const w = width;
        const h = height;
        const t = thick || 10;
        const tArm = topArm !== undefined ? topArm : w;
        const bArm = bottomArm !== undefined ? bottomArm : w;
        const towerH = towerHeight || 350;
        const towerW = towerWidth || 60;

        const shape = new THREE.Shape();

        if (profileType === 'tower_corner_wrap_left') {
            shape.moveTo(-w/2, 0);
            shape.lineTo(w/2, 0);
            shape.lineTo(w/2, h);
            shape.lineTo(-w/2 + towerW, h);
            shape.lineTo(-w/2 + towerW, towerH);
            shape.lineTo(-w/2, towerH);
            shape.closePath();
        } else if (profileType === 'tower_corner_wrap_right') {
            shape.moveTo(-w/2, 0);
            shape.lineTo(w/2, 0);
            shape.lineTo(w/2, towerH);
            shape.lineTo(w/2 - towerW, towerH);
            shape.lineTo(w/2 - towerW, h);
            shape.lineTo(-w/2, h);
            shape.closePath();
        } else if (profileType === 'corner_wrap_left' || profileType === 'corner_wrap_right') {
            shape.moveTo(-w/2, 0);
            shape.lineTo(w/2, 0);
            shape.lineTo(w/2, h);
            shape.lineTo(-w/2, h);
            shape.closePath();
        } else if (profileType === 'c_wrap_terrace_frame') {
            shape.moveTo(-w/2, 0);
            shape.lineTo(w/2, 0);
            shape.lineTo(w/2, h);
            shape.lineTo(-w/2 + towerW, h);
            shape.lineTo(-w/2 + towerW, towerH - t);
            shape.lineTo(-w/2 + tArm, towerH - t);
            shape.lineTo(-w/2 + tArm, towerH);
            shape.lineTo(-w/2, towerH);
            shape.closePath();
        } else if (profileType === 'l_shape_left') {
            shape.moveTo(-w/2, 0);
            shape.lineTo(w/2, 0);
            shape.lineTo(w/2, t);
            shape.lineTo(-w/2 + t, t);
            shape.lineTo(-w/2 + t, h);
            shape.lineTo(-w/2, h);
            shape.closePath();
        } else if (profileType === 'l_shape_right') {
            shape.moveTo(-w/2, 0);
            shape.lineTo(w/2, 0);
            shape.lineTo(w/2, h);
            shape.lineTo(w/2 - t, h);
            shape.lineTo(w/2 - t, t);
            shape.lineTo(-w/2, t);
            shape.closePath();
        } else if (profileType === 'l_shape_top_left') {
            shape.moveTo(-w/2, 0);
            shape.lineTo(-w/2 + t, 0);
            shape.lineTo(-w/2 + t, h - t);
            shape.lineTo(w/2, h - t);
            shape.lineTo(w/2, h);
            shape.lineTo(-w/2, h);
            shape.closePath();
        } else if (profileType === 'l_shape_top_right') {
            shape.moveTo(w/2 - t, 0);
            shape.lineTo(w/2, 0);
            shape.lineTo(w/2, h);
            shape.lineTo(-w/2, h);
            shape.lineTo(-w/2, h - t);
            shape.lineTo(w/2 - t, h - t);
            shape.closePath();
        } else if (profileType === 'c_shape_left') {
            shape.moveTo(-w/2, 0);
            shape.lineTo(-w/2 + bArm, 0);
            shape.lineTo(-w/2 + bArm, t);
            shape.lineTo(-w/2 + t, t);
            shape.lineTo(-w/2 + t, h - t);
            shape.lineTo(-w/2 + tArm, h - t);
            shape.lineTo(-w/2 + tArm, h);
            shape.lineTo(-w/2, h);
            shape.closePath();
        } else if (profileType === 'c_shape_right') {
            shape.moveTo(w/2 - bArm, 0);
            shape.lineTo(w/2, 0);
            shape.lineTo(w/2, h);
            shape.lineTo(w/2 - tArm, h);
            shape.lineTo(w/2 - tArm, h - t);
            shape.lineTo(w/2 - t, h - t);
            shape.lineTo(w/2 - t, t);
            shape.lineTo(w/2 - bArm, t);
            shape.closePath();
        } else if (profileType === 'box' || profileType === 'full_box') {
            shape.moveTo(-w/2, 0);
            shape.lineTo(w/2, 0);
            shape.lineTo(w/2, h);
            shape.lineTo(-w/2, h);
            shape.closePath();

            const hole = new THREE.Path();
            hole.moveTo(-w/2 + t, t);
            hole.lineTo(w/2 - t, t);
            hole.lineTo(w/2 - t, h - t);
            hole.lineTo(-w/2 + t, h - t);
            hole.closePath();
            shape.holes.push(hole);
        } else {
            shape.moveTo(-w/2, 0);
            shape.lineTo(-w/2 + bArm, 0);
            shape.lineTo(-w/2 + bArm, t);
            shape.lineTo(-w/2 + t, t);
            shape.lineTo(-w/2 + t, h - t);
            shape.lineTo(-w/2 + tArm, h - t);
            shape.lineTo(-w/2 + tArm, h);
            shape.lineTo(-w/2, h);
            shape.closePath();
        }

        const extrudeSettings = {
            depth: depth,
            bevelEnabled: false
        };

        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.translate(0, 0, -depth / 2);
        return geo;
    }

    onPointerMove(e) {
        if (!this.isPlacementTool()) {
            this.hideGhost();
            return false;
        }

        this.lastPointerEvent = e;

        // If position is pinned and user is not dragging, preserve the pinned preview
        if (this.isPinned && e.buttons === 0) {
            return true;
        }

        // If user drags, unpin and follow pointer dynamically
        if (this.isPinned && e.buttons !== 0) {
            this.isPinned = false;
        }

        const planner = this.getPlanner();
        const tool = planner.tool;
        const dom = this.ctx.renderer.domElement;
        const rect = dom.getBoundingClientRect();

        // Canvas boundary validation
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            return false;
        }

        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        // Raycast against wall meshes, ignoring preview and hitbox objects
        const interactables = this.ctx.interactables || [];
        const intersects = this.raycaster.intersectObjects(interactables, true);
        const wallHit = intersects.find(i => {
            const obj = i.object;
            if (!obj || !obj.visible) return false;
            if (obj.userData?.isHitbox) return false;
            return obj.userData?.isWallSide || obj.userData?.entity?.type === 'outer' || obj.userData?.entity?.type === 'inner' || obj.userData?.entity?.type === 'wall' || obj.userData?.parentWall;
        });

        if (!wallHit) {
            this.hideGhost();
            return false;
        }

        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = false;
        }

        const hitMesh = wallHit.object;
        const wallEntity = hitMesh.userData.parentWall || hitMesh.userData.entity || (hitMesh.parent && hitMesh.parent.userData?.entity);

        if (!wallEntity || !wallEntity.startAnchor || !wallEntity.endAnchor) {
            this.hideGhost();
            return false;
        }

        const p1 = wallEntity.startAnchor.position();
        const p2 = wallEntity.endAnchor.position();
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const wallLen = Math.hypot(dx, dy);
        if (wallLen < 1) {
            this.hideGhost();
            return false;
        }

        // Project 3D hit point into wall 2D local space
        const hitPt = wallHit.point;
        const wallDirX = dx / wallLen;
        const wallDirY = dy / wallLen;
        const relX = hitPt.x - p1.x;
        const relY = hitPt.z - p1.y;
        let projDist = relX * wallDirX + relY * wallDirY;

        // Detect Wall Side (front vs back) using camera line-of-sight
        const camPos = this.ctx.camera.position;
        const toCamX = camPos.x - hitPt.x;
        const toCamZ = camPos.z - hitPt.z;
        const dotCam = toCamX * (-wallDirY) + toCamZ * wallDirX;
        const side = dotCam >= 0 ? 'front' : 'back';
        const facing = (side === 'back') ? -1 : 1;

        // 100% Shared CAD Host Wall Highlight
        const hr = this.ctx.interactions?.highlightRenderer;
        if (hr) {
            const wallSideMesh = hitMesh.userData?.isWallSide ? hitMesh : 
                (wallEntity?.mesh3D?.children?.find(c => c.userData?.isWallSide && c.userData?.side === side) || hitMesh);
            hr.setHoverHighlight(wallSideMesh);
        }

        // Dimensions & Elevation calculations
        const preset = planner.activePresetParams || {};
        const thick = wallEntity.thickness || wallEntity.config?.thickness || 20;
        const wallH = wallEntity.height || wallEntity.config?.height || 180;

        const isMolding = tool === 'molding' || tool === 'skirting' || tool === 'wall_trim' || tool.startsWith('molding_') || tool.startsWith('skirting_') || tool.startsWith('trim_') || tool.startsWith('chair_rail') || tool.startsWith('picture_rail') || !!MOLDING_REGISTRY[tool] || (preset && (preset.type?.startsWith('molding_') || preset.profileType?.startsWith('skirting_')));
        const isElevationTrim = tool === 'elevation_frieze' || tool === 'elevation_foundation_trim';
        const isAdvOpening = !isMolding && !isElevationTrim && (tool === 'arch_opening' || tool === 'circular_opening' || tool === 'custom_shape_opening' || tool === 'niche_recess' || tool === 'pattern_opening' || tool === 'boolean_cut' || tool === 'opening' || (preset && ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut', 'opening'].includes(preset.type)));
        const isDoor = !isMolding && !isElevationTrim && !isAdvOpening && (tool.startsWith('door') || (!tool.startsWith('window') && !tool.startsWith('sunshade') && !tool.startsWith('jali_') && !tool.startsWith('curtain') && !tool.startsWith('decor_') && preset.doorType !== undefined));
        const isWindow = !isMolding && !isElevationTrim && !isAdvOpening && (tool.startsWith('window') || (!tool.startsWith('door') && !tool.startsWith('sunshade') && !tool.startsWith('jali_') && !tool.startsWith('curtain') && !tool.startsWith('decor_') && preset.windowType !== undefined));
        const isJali = !isMolding && !isElevationTrim && !isAdvOpening && (tool === 'jali_panel' || tool.startsWith('jali_') || (!tool.startsWith('door') && !tool.startsWith('window') && (preset.patternStyle !== undefined || preset.jaliPattern !== undefined)));
        const isSunshade = !isMolding && !isElevationTrim && !isAdvOpening && (tool === 'sunshade' || tool.startsWith('sunshade_') || tool === 'chajja' || (!tool.startsWith('door') && !tool.startsWith('window') && preset.chajjaType !== undefined));
        const isCurtain = !isMolding && !isElevationTrim && !isAdvOpening && (tool === 'curtain' || tool.startsWith('curtain_'));
        const isWallArt = !isMolding && !isElevationTrim && !isAdvOpening && (tool === 'wall_art' || tool.startsWith('decor_wall_') || tool.startsWith('decor_photo_'));
        const isFascia = !isMolding && !isElevationTrim && !isAdvOpening && (tool === 'elevation_fascia' || tool.startsWith('fascia_'));
        const isElevSegment = tool === 'elevation_segment';

        const isDrapes = isCurtain && (!preset.curtainType || preset.curtainType.includes('drapes'));

        let itemW = isMolding || isElevationTrim ? wallLen : (preset.width || 80);
        let itemH = (isMolding || isElevationTrim) ? (preset.moldingHeight || 12) : (preset.height || 20);
        let depth = preset.depth || 10;

        if (isElevSegment) {
            itemW = preset.length || 180;
            itemH = preset.width || 30;
            depth = preset.depth || 40;
        } else if (isDoor) {
            itemW = preset.width || 40;
            itemH = preset.height || DOOR_HEIGHT;
            depth = preset.depth || 10;
        } else if (isWindow) {
            itemW = preset.width || 60;
            itemH = preset.height || WINDOW_HEIGHT;
            depth = preset.depth || 10;
        } else if (isJali) {
            itemW = preset.width || 60;
            itemH = preset.height || 80;
            depth = preset.depth || 10;
        } else if (isSunshade) {
            itemW = preset.width || 60;
            itemH = preset.height || 10;
            depth = preset.depth || 40;
        } else if (isFascia) {
            itemW = preset.width || 100;
            itemH = preset.height || 120;
            depth = preset.depth || 40;
        } else if (isCurtain) {
            itemW = preset.width || (isDrapes ? 80 : 50);
            itemH = preset.height || (isDrapes ? 95 : 50);
            depth = preset.depth || (isDrapes ? 8 : 4);
        } else if (isWallArt) {
            itemW = preset.width || (tool.includes('gallery') || preset.artType?.includes('gallery') ? 60 : 50);
            itemH = preset.height || 35;
            depth = preset.depth || 3;
        } else if (isAdvOpening) {
            itemW = (tool === 'circular_opening' || preset.type === 'circular_opening' ? 40 : (tool === 'niche_recess' || preset.type === 'niche_recess' ? 40 : 50));
            itemH = (tool === 'circular_opening' || preset.type === 'circular_opening' ? 40 : (tool === 'arch_opening' || preset.type === 'arch_opening' || tool === 'opening' || preset.type === 'opening' ? DOOR_HEIGHT : 60));
            depth = (tool === 'niche_recess' || preset.type === 'niche_recess' ? 6 : 10);
        } else if (tool === 'elevation_corner_element') {
            itemW = 26;
            itemH = wallH;
            depth = preset.depth || 10;
        } else if (tool === 'elevation_frieze') {
            itemW = wallLen;
            itemH = 18;
            depth = preset.depth || 10;
        } else if (tool === 'elevation_foundation_trim') {
            itemW = wallLen;
            itemH = 45;
            depth = preset.depth || 10;
        }
        let elev = 0;

        let t = projDist / wallLen;

        const wallBaseY = wallEntity.elevation || (wallEntity.level && wallEntity.level.elevation) || 0;
        const localHitY = Math.max(0, hitPt.y - wallBaseY);

        let levelLabel = '';
        if (isMolding || isElevationTrim) {
            // Baseboards, Moldings & Wall Trims span the entire wall length
            itemW = wallLen;
            t = 0.5;
            projDist = wallLen / 2;

            const rawElev = Math.max(0, Math.min(wallH - itemH, Math.round(localHitY - itemH / 2)));
            
            // 1. Check for Connected Wall Trims Snap
            let connectedSnapElev = null;
            const allWalls = planner?.walls || [];
            const startA = wallEntity.startAnchor;
            const endA = wallEntity.endAnchor;
            const p1 = startA?.position ? startA.position() : (startA || { x: 0, y: 0 });
            const p2 = endA?.position ? endA.position() : (endA || { x: 0, y: 0 });

            for (const w of allWalls) {
                if (w === wallEntity || w.id === wallEntity.id) continue;
                const wp1 = w.startAnchor?.position ? w.startAnchor.position() : (w.startAnchor || { x: 0, y: 0 });
                const wp2 = w.endAnchor?.position ? w.endAnchor.position() : (w.endAnchor || { x: 0, y: 0 });
                
                const isConnected = (startA && (w.startAnchor === startA || w.endAnchor === startA)) ||
                                    (endA && (w.startAnchor === endA || w.endAnchor === endA)) ||
                                    (Math.hypot(wp1.x - p1.x, wp1.y - p1.y) < 5) ||
                                    (Math.hypot(wp1.x - p2.x, wp1.y - p2.y) < 5) ||
                                    (Math.hypot(wp2.x - p1.x, wp2.y - p1.y) < 5) ||
                                    (Math.hypot(wp2.x - p2.x, wp2.y - p2.y) < 5);

                if (isConnected && Array.isArray(w.attachedMoldings)) {
                    for (const m of w.attachedMoldings) {
                        const mElev = m.heightOffset !== undefined ? m.heightOffset : (m.elevation || 0);
                        if (Math.abs(rawElev - mElev) <= 15) {
                            connectedSnapElev = mElev;
                            break;
                        }
                    }
                }
                if (connectedSnapElev !== null) break;
            }

            if (connectedSnapElev !== null) {
                elev = connectedSnapElev;
                levelLabel = `CONNECTED WALL SNAP (${Math.round(elev)} cm)`;
            } else if (rawElev <= 10) {
                // 2. Bottom Snap (Floor)
                elev = 0;
                levelLabel = 'FLOOR (0 cm)';
            } else if (rawElev >= (wallH - itemH - 10)) {
                // 3. Top Snap (Ceiling)
                elev = Math.max(0, wallH - itemH);
                levelLabel = `CEILING (${Math.round(elev)} cm)`;
            } else if (Math.abs(rawElev - 90) <= 8) {
                // 4. Middle Snap (Chair Rail / Standard Mid-Wall ~90cm)
                elev = 90;
                levelLabel = 'MID / CHAIR RAIL (90 cm)';
            } else {
                // 5. User-Controlled Free Placement Anywhere
                elev = rawElev;
                levelLabel = `ELEV ${Math.round(elev)} cm`;
            }
        } else if (tool === 'elevation_corner_element') {
            t = (t < 0.5) ? 0 : 1;
            projDist = t * wallLen;
            elev = preset.elevation !== undefined ? preset.elevation : 0;
            itemH = wallH;
        } else if (isDoor) {
            // Doors are strictly floor-anchored: elevation is ALWAYS 0
            elev = 0;
            t = Math.max(0, Math.min(1, t));
            projDist = t * wallLen;
        } else if (isWindow) {
            // Allow placing anywhere along wall length
            t = Math.max(0, Math.min(1, t));
            projDist = t * wallLen;

            // Follow cursor height with smart snap to standard sill (80cm)
            let winElev = Math.max(0, Math.min(wallH - itemH, Math.round(localHitY - itemH / 2)));
            if (Math.abs(winElev - 80) < 15) winElev = 80;
            elev = (preset.isFixedElevation && preset.elevation !== undefined) ? preset.elevation : winElev;
        } else if (isJali) {
            // Allow placing anywhere along the wall length
            t = Math.max(0, Math.min(1, t));
            projDist = t * wallLen;
            
            // Allow placing anywhere vertically on the wall (follows cursor height)
            let jaliElev = Math.max(0, Math.min(wallH - itemH, Math.round(localHitY - itemH / 2)));
            elev = (preset.isFixedElevation && preset.elevation !== undefined) ? preset.elevation : jaliElev;
        } else if (isAdvOpening) {
            t = Math.max(0, Math.min(1, t));
            projDist = t * wallLen;
            const isArch = tool === 'arch_opening' || preset.type === 'arch_opening';
            if (isArch && (localHitY <= 30 || preset.elevation === 0)) {
                elev = 0;
            } else {
                elev = (preset.isFixedElevation && preset.elevation !== undefined) ? preset.elevation : Math.max(0, Math.min(wallH - itemH, Math.round(localHitY - itemH / 2)));
            }
        } else if (isSunshade) {
            // Allow placing anywhere along the wall length
            t = Math.max(0, Math.min(1, t));
            projDist = t * wallLen;
            
            // Allow placing anywhere vertically on the wall (follows cursor height) with smart lintel snap
            let sunshadeElev = Math.max(0, Math.min(wallH, Math.round(localHitY)));
            
            // Smart window/door lintel snap if pointing near an aperture
            if (wallEntity.attachedWidgets && wallEntity.attachedWidgets.length > 0) {
                for (let w of wallEntity.attachedWidgets) {
                    const wCenter = (w.t !== undefined ? w.t : 0.5) * wallLen;
                    const halfW = (w.width || 60) / 2;
                    if (Math.abs(projDist - wCenter) <= halfW + 15) {
                        const lintelY = (w.elevation !== undefined ? w.elevation : (w.type === 'window' ? 80 : 0)) + (w.height !== undefined ? w.height : (w.type === 'window' ? 120 : 210));
                        if (Math.abs(localHitY - lintelY) < 25) {
                            sunshadeElev = lintelY;
                            break;
                        }
                    }
                }
            }
            
            elev = (preset.isFixedElevation && preset.elevation !== undefined) ? preset.elevation : sunshadeElev;
        } else if (isFascia) {
            t = Math.max(0, Math.min(1, t));
            projDist = t * wallLen;
            let fasciaElev = Math.max(0, Math.min(wallH - itemH, Math.round(localHitY - itemH / 2)));
            elev = (preset.isFixedElevation && preset.elevation !== undefined) ? preset.elevation : fasciaElev;
        } else if (isCurtain) {
            t = Math.max(0, Math.min(1, t));
            projDist = t * wallLen;
            
            let curtainElev = Math.max(0, Math.min(wallH - itemH, Math.round(localHitY - itemH / 2)));
            // Smart snap to attached window top if pointing near a window
            if (wallEntity.attachedWidgets && wallEntity.attachedWidgets.length > 0) {
                for (let w of wallEntity.attachedWidgets) {
                    if (w.type === 'window') {
                        const wCenter = (w.t !== undefined ? w.t : 0.5) * wallLen;
                        const halfW = (w.width || 60) / 2;
                        if (Math.abs(projDist - wCenter) <= halfW + 15) {
                            const winTop = (w.elevation !== undefined ? w.elevation : 80) + (w.height || 120);
                            if (Math.abs(localHitY - winTop) < 25) {
                                curtainElev = Math.max(0, winTop - itemH + 10);
                                break;
                            }
                        }
                    }
                }
            }
            elev = (preset.isFixedElevation && preset.elevation !== undefined) ? preset.elevation : curtainElev;
        } else if (isWallArt) {
            t = Math.max(0, Math.min(1, t));
            projDist = t * wallLen;
            let artElev = Math.max(0, Math.min(wallH - itemH, Math.round(localHitY - itemH / 2)));
            elev = (preset.isFixedElevation && preset.elevation !== undefined) ? preset.elevation : artElev;
        } else if (isElevSegment) {
            // Smart Snapping along wall length
            const halfW = itemW / 2;
            let rawProjDist = t * wallLen;

            if (rawProjDist <= halfW + 18) {
                projDist = halfW;
                levelLabel = 'SNAP: WALL START';
            } else if (rawProjDist >= wallLen - halfW - 18) {
                projDist = wallLen - halfW;
                levelLabel = 'SNAP: WALL END';
            } else if (Math.abs(rawProjDist - wallLen / 2) <= 15) {
                projDist = wallLen / 2;
                levelLabel = 'SNAP: WALL CENTER';
            } else {
                projDist = Math.max(0, Math.min(wallLen, rawProjDist));
            }
            t = wallLen > 0 ? (projDist / wallLen) : 0.5;

            // Smart Snapping along wall height
            let rawElev = Math.max(0, Math.min(wallH - itemH, Math.round(localHitY - itemH / 2)));
            if (rawElev <= 12) {
                elev = 0;
                levelLabel = levelLabel ? `${levelLabel} | FLOOR` : 'FLOOR (0 cm)';
            } else if (Math.abs(rawElev - 80) <= 10) {
                elev = 80;
                levelLabel = levelLabel ? `${levelLabel} | SILL 80cm` : 'WINDOW SILL (80 cm)';
            } else if (Math.abs(rawElev - 90) <= 10) {
                elev = 90;
                levelLabel = levelLabel ? `${levelLabel} | MID 90cm` : 'MID-WALL (90 cm)';
            } else if (Math.abs(rawElev - 210) <= 12) {
                elev = 210;
                levelLabel = levelLabel ? `${levelLabel} | LINTEL 210cm` : 'LINTEL (210 cm)';
            } else if (rawElev >= wallH - itemH - 15) {
                elev = Math.max(0, wallH - itemH);
                levelLabel = levelLabel ? `${levelLabel} | CEILING` : `CEILING (${Math.round(elev)} cm)`;
            } else {
                elev = (preset.isFixedElevation && preset.elevation !== undefined) ? preset.elevation : rawElev;
            }
        } else {
            elev = preset.elevation !== undefined ? preset.elevation : Math.max(0, localHitY);
            t = Math.max(0, Math.min(1, t));
            projDist = t * wallLen;
        }

        // Overlap Validation Check (only for entities that cut the wall: doors, windows, jali)
        let isValid = true;
        const cutsWall = !isMolding && !isElevationTrim && !isSunshade && !isCurtain && !isWallArt && !isFascia && !isElevSegment && (WIDGET_REGISTRY[tool]?.cutsWall !== false);
        if (cutsWall && wallEntity.attachedWidgets && wallEntity.attachedWidgets.length > 0) {
            const pMin = projDist - itemW / 2;
            const pMax = projDist + itemW / 2;
            const pElevMin = elev;
            const pElevMax = elev + itemH;

            for (let w of wallEntity.attachedWidgets) {
                const isProtrusion = w.type === 'solid_protrusion' || w.configId === 'solid_protrusion';
                if (!isProtrusion && (w.config?.cutsWall === false || w.cutsWall === false || w.type === 'sunshade' || w.type === 'curtain' || w.type === 'wall_art' || w.type === 'elevation_fascia' || w.type === 'elevation_segment' || w.configId === 'sunshade')) continue;
                
                const wW = w.width || 40;
                const wH = w.height || (w.type === 'window' ? 120 : (w.type === 'door' ? 210 : 100));
                const wElev = w.elevation !== undefined ? w.elevation : (w.type === 'window' ? 80 : 0);
                const wElevMin = wElev;
                const wElevMax = wElev + wH;
                
                const wT = w.t !== undefined ? w.t : 0.5;
                const wMin = wT * wallLen - wW / 2;
                const wMax = wT * wallLen + wW / 2;
                
                // Only invalid if both horizontal AND vertical intervals overlap
                const xOverlap = (pMax > wMin + 1 && pMin < wMax - 1);
                const yOverlap = (pElevMax > wElevMin + 1 && pElevMin < wElevMax - 1);
                if (xOverlap && yOverlap) {
                    isValid = false;
                    break;
                }
            }
        }

        this.activeWall = wallEntity;
        this.activeT = t;
        this.activeSide = side;
        this.activeLocalX = projDist;
        this.activeElevation = elev;
        this.isValidPlacement = isValid;

        const isAttachedSurfaceElement = isSunshade || isCurtain || isWallArt || isElevSegment;

        // Position & Update Aperture Highlight & 3D Model
        this.updateApertureAndModel(tool, wallEntity, t, elev, facing, wallLen, dx, dy, p1, p2, thick, wallH, itemW, itemH, depth, isValid, isMolding || isElevationTrim, isAttachedSurfaceElement, isFascia, projDist, preset);

        // Update HUD Badge
        const toolLabel = WIDGET_REGISTRY[tool]?.label || MOLDING_REGISTRY[tool]?.label || tool.toUpperCase().replace(/_/g, ' ');
        const distFromStart = Math.round(t * wallLen);
        const distFromEnd = Math.round((1 - t) * wallLen);
        const statusColor = isValid ? '#00f0ff' : '#ef4444';
        const statusText = (isMolding || isElevationTrim) 
            ? `Full Length ${Math.round(wallLen)} cm` 
            : (isValid ? `${distFromStart} cm ← → ${distFromEnd} cm` : 'Space Occupied');

        if (this.elDot) {
            this.elDot.style.background = statusColor;
            this.elDot.style.boxShadow = `0 0 10px ${statusColor}`;
        }
        if (this.elTitle) this.elTitle.textContent = toolLabel;
        if (this.elFaceTxt) this.elFaceTxt.textContent = side.toUpperCase();
        if (this.elSpecs) this.elSpecs.textContent = statusText;

        const isMobileScreen = this.isTouchDevice();
        this.badgeDom.style.left = '50%';
        this.badgeDom.style.top = 'auto';
        this.badgeDom.style.bottom = isMobileScreen ? '64px' : '24px';
        this.badgeDom.style.transform = 'translateX(-50%)';

        this.badgeDom.style.borderColor = statusColor;
        this.badgeDom.style.display = 'block';

        dom.style.cursor = isValid ? 'crosshair' : 'not-allowed';
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
        return true;
    }

    /**
     * Position the glowing Sims 4 wall cutout aperture or molding ribbon and live 3D preview model
     * Supports mitered corner joints for seamless wall span!
     */
    updateApertureAndModel(tool, wallEntity, t, elev, facing, wallLen, dx, dy, p1, p2, thick, wallH, itemW, itemH, depth, isValid, isMoldingOrTrim, isAttachedSurfaceElement, isFascia, projDist, preset) {
        const angleY = -Math.atan2(dy, dx);

        // Anchor Master Group at the Wall Start (p1.x, 0, p1.y) rotated by angleY
        this.placementGroup.position.set(p1.x, 0, p1.y);
        this.placementGroup.rotation.y = angleY;
        this.placementGroup.visible = true;

        // Miter joint coordinates from wall polygon
        const pts = (typeof wallEntity.poly?.points === 'function') 
            ? wallEntity.poly.points() 
            : (Array.isArray(wallEntity.poly) ? wallEntity.poly : (wallEntity.poly?.attrs?.points || null));

        let localSL_x = 0, localSR_x = 0, localEL_x = wallLen, localER_x = wallLen;
        const angle = Math.atan2(dy, dx);
        if (pts && pts.length === 8) {
            const toLocalX = (ptX, ptY) => {
                const dx_pt = ptX - p1.x;
                const dy_pt = ptY - p1.y;
                return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
            };
            localSL_x = toLocalX(pts[0], pts[1]);
            localEL_x = toLocalX(pts[2], pts[3]);
            localER_x = toLocalX(pts[4], pts[5]);
            localSR_x = toLocalX(pts[6], pts[7]);
        }

        if (isMoldingOrTrim) {
            let targetWalls = [{ wall: wallEntity, side: (facing === 1 ? 'front' : 'back') }];
            const planner = this.getPlanner();
            if (this.placementScope === 'room') {
                const room = getRoomForWallFace(wallEntity, (facing === 1 ? 'front' : 'back'), planner, this.ctx);
                if (room) {
                    const rTargets = getRoomWallsAndSides(room, planner, this.ctx);
                    if (rTargets.length > 0) targetWalls = rTargets;
                }
            } else if (this.placementScope === 'exterior') {
                const extTargets = getExteriorWallsAndSides(planner, this.ctx);
                if (extTargets.length > 0) targetWalls = extTargets;
            }

            const isCrown = tool === 'molding' || tool.includes('crown') || tool === 'elevation_frieze' || (preset?.profileType && preset?.profileType.includes('crown')) || (preset?.type && preset?.type.includes('crown'));

            const ribbonGeo = new THREE.BufferGeometry();
            const posList = [];
            const indexList = [];
            let vertOffset = 0;

            if (targetWalls.length > 1) {
                // Multi-wall world space ribbon rendering for entire room / exterior loop
                this.placementGroup.position.set(0, 0, 0);
                this.placementGroup.rotation.y = 0;

                for (const tWall of targetWalls) {
                    const wEnt = tWall.wall;
                    const wSide = tWall.side;
                    const wFacing = (wSide === 'back') ? -1 : 1;
                    const wp1 = wEnt.startAnchor.position();
                    const wp2 = wEnt.endAnchor.position();
                    const wdx = wp2.x - wp1.x;
                    const wdy = wp2.y - wp1.y;
                    const wLen = Math.hypot(wdx, wdy);
                    if (wLen < 1) continue;
                    const wAngle = Math.atan2(wdy, wdx);
                    const wThick = wEnt.thickness || wEnt.config?.thickness || 20;
                    const wH = wEnt.height || wEnt.config?.height || 180;
                    const yBottom = elev;
                    const yTop = yBottom + itemH;
                    const zOffset = ((wThick / 2) + 0.3) * wFacing;

                    const wPts = (typeof wEnt.poly?.points === 'function') ? wEnt.poly.points() : (Array.isArray(wEnt.poly) ? wEnt.poly : null);
                    let wSL_x = 0, wSR_x = 0, wEL_x = wLen, wER_x = wLen;
                    if (wPts && wPts.length === 8) {
                        const toLocalX = (ptX, ptY) => (ptX - wp1.x) * Math.cos(wAngle) + (ptY - wp1.y) * Math.sin(wAngle);
                        wSL_x = toLocalX(wPts[0], wPts[1]);
                        wEL_x = toLocalX(wPts[2], wPts[3]);
                        wER_x = toLocalX(wPts[4], wPts[5]);
                        wSR_x = toLocalX(wPts[6], wPts[7]);
                    }

                    const segments = this.molding3DBuilder.getMoldingSegments(wLen, yBottom, itemH, wEnt);
                    for (const seg of segments) {
                        const startX = (seg.start <= 0.1) ? ((wFacing === 1) ? wSL_x : wSR_x) : seg.start;
                        const endX = (seg.end >= wLen - 0.1) ? ((wFacing === 1) ? wEL_x : wER_x) : seg.end;

                        // Transform wall local coords (X_loc, Z_loc) into world (X_world, Z_world)
                        const toWldX = (lx, lz) => wp1.x + lx * Math.cos(wAngle) - lz * Math.sin(wAngle);
                        const toWldZ = (lx, lz) => wp1.y + lx * Math.sin(wAngle) + lz * Math.cos(wAngle);

                        const p1X = toWldX(startX, zOffset), p1Z = toWldZ(startX, zOffset);
                        const p2X = toWldX(endX, zOffset),   p2Z = toWldZ(endX, zOffset);

                        posList.push(
                            p1X, yBottom, p1Z,
                            p2X, yBottom, p2Z,
                            p2X, yTop,    p2Z,
                            p1X, yTop,    p1Z
                        );

                        if (wFacing === 1) {
                            indexList.push(
                                vertOffset, vertOffset + 1, vertOffset + 2,
                                vertOffset, vertOffset + 2, vertOffset + 3
                            );
                        } else {
                            indexList.push(
                                vertOffset, vertOffset + 2, vertOffset + 1,
                                vertOffset, vertOffset + 3, vertOffset + 2
                            );
                        }
                        vertOffset += 4;
                    }
                }
            } else {
                // Single wall local space ribbon
                const yBottom = elev;
                const yTop = yBottom + itemH;
                const zOffset = ((thick / 2) + 0.3) * facing;
                const segments = this.molding3DBuilder.getMoldingSegments(wallLen, yBottom, itemH, wallEntity);

                for (const seg of segments) {
                    const startX = (seg.start <= 0.1) 
                        ? ((facing === 1) ? localSL_x : localSR_x)
                        : seg.start;
                    const endX = (seg.end >= wallLen - 0.1)
                        ? ((facing === 1) ? localEL_x : localER_x)
                        : seg.end;

                    posList.push(
                        startX, yBottom, zOffset,
                        endX,   yBottom, zOffset,
                        endX,   yTop,    zOffset,
                        startX, yTop,    zOffset
                    );

                    if (facing === 1) {
                        indexList.push(
                            vertOffset, vertOffset + 1, vertOffset + 2,
                            vertOffset, vertOffset + 2, vertOffset + 3
                        );
                    } else {
                        indexList.push(
                            vertOffset, vertOffset + 2, vertOffset + 1,
                            vertOffset, vertOffset + 3, vertOffset + 2
                        );
                    }
                    vertOffset += 4;
                }
            }

            ribbonGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posList), 3));
            ribbonGeo.setIndex(indexList);
            ribbonGeo.computeVertexNormals();

            this.apertureVoidMesh.geometry.dispose();
            this.apertureVoidMesh.geometry = ribbonGeo;
            this.apertureVoidMesh.position.set(0, 0, 0);

            this.apertureVoidMat.color.setHex(0x00f0ff);
            this.apertureVoidMat.opacity = 0.35;
            this.apertureVoidMat.side = THREE.DoubleSide;

            this.apertureEdges.geometry.dispose();
            this.apertureEdges.geometry = new THREE.EdgesGeometry(ribbonGeo);
            this.apertureEdges.position.set(0, 0, 0);
            this.apertureEdges.material = this.apertureEdgeMat;
        } else if (isFascia) {
            // For Elevation Fascias: Shape-Accurate glowing C-shape, L-shape, or Box geometry
            const pType = preset?.profileType || 'c_shape_left';
            const fThick = preset?.thick || 10;
            const wallOffset = ((thick / 2) + (depth / 2)) * facing;

            this.apertureVoidMesh.geometry.dispose();
            this.apertureVoidMesh.geometry = this.createFasciaShapeGeometry(pType, itemW, itemH, depth, fThick, preset?.topArm, preset?.bottomArm, preset?.towerHeight, preset?.towerWidth);
            this.apertureVoidMesh.position.set(projDist, elev, wallOffset);

            this.apertureVoidMat.color.setHex(0x00f0ff);
            this.apertureVoidMat.opacity = 0.35;

            this.apertureEdges.geometry.dispose();
            this.apertureEdges.geometry = new THREE.EdgesGeometry(this.apertureVoidMesh.geometry);
            this.apertureEdges.position.copy(this.apertureVoidMesh.position);
            this.apertureEdges.material = this.apertureEdgeMat;
        } else if (isAttachedSurfaceElement) {
            // For Sunshades, Curtains, Wall Art: protruding footprint box attached flush to chosen wall face
            const wallOffset = ((thick / 2) + (depth / 2)) * facing;
            const cutoutY = elev + itemH / 2;

            this.apertureVoidMesh.geometry.dispose();
            this.apertureVoidMesh.geometry = new THREE.BoxGeometry(itemW, itemH, depth);
            this.apertureVoidMesh.position.set(projDist, cutoutY, wallOffset);

            this.apertureVoidMat.color.setHex(0x00f0ff);
            this.apertureVoidMat.opacity = 0.35;

            this.apertureEdges.geometry.dispose();
            this.apertureEdges.geometry = new THREE.EdgesGeometry(this.apertureVoidMesh.geometry);
            this.apertureEdges.position.copy(this.apertureVoidMesh.position);
            this.apertureEdges.material = this.apertureEdgeMat;
        } else {
            // For doors, windows, jali panels, and advanced wall openings:
            const cutoutThick = thick + 4;
            const opType = preset?.type || tool;

            this.apertureVoidMesh.geometry.dispose();

            if (opType === 'arch_opening') {
                const shape = new THREE.Shape();
                const hw = itemW / 2;
                const radius = hw;
                const straightH = Math.max(0, itemH - radius);
                shape.moveTo(-hw, 0);
                shape.lineTo(hw, 0);
                shape.lineTo(hw, straightH);
                if (radius > 0) shape.absarc(0, straightH, radius, 0, Math.PI, false);
                shape.lineTo(-hw, 0);

                const geo = new THREE.ExtrudeGeometry(shape, { depth: cutoutThick, bevelEnabled: false });
                geo.translate(0, 0, -cutoutThick / 2);
                this.apertureVoidMesh.geometry = geo;
                this.apertureVoidMesh.position.set(projDist, elev, 0);
            } else if (opType === 'circular_opening') {
                const geo = new THREE.CylinderGeometry(itemW / 2, itemW / 2, cutoutThick, 32);
                geo.rotateX(Math.PI / 2);
                this.apertureVoidMesh.geometry = geo;
                this.apertureVoidMesh.position.set(projDist, elev + itemH / 2, 0);
            } else if (opType === 'niche_recess') {
                const recessDepth = Math.min(depth, thick - 2);
                const wallOffset = ((thick / 2) - (recessDepth / 2)) * facing;
                this.apertureVoidMesh.geometry = new THREE.BoxGeometry(itemW, itemH, recessDepth);
                this.apertureVoidMesh.position.set(projDist, elev + itemH / 2, wallOffset);
            } else {
                const cutoutH = itemH;
                const cutoutY = elev + cutoutH / 2;
                this.apertureVoidMesh.geometry = new THREE.BoxGeometry(itemW, cutoutH, cutoutThick);
                this.apertureVoidMesh.position.set(projDist, cutoutY, 0);
            }

            this.apertureVoidMat.color.setHex(isValid ? 0x00f0ff : 0xef4444);
            this.apertureVoidMat.opacity = isValid ? 0.25 : 0.45;

            this.apertureEdges.geometry.dispose();
            this.apertureEdges.geometry = new THREE.EdgesGeometry(this.apertureVoidMesh.geometry);
            this.apertureEdges.position.copy(this.apertureVoidMesh.position);
            this.apertureEdges.material = isValid ? this.apertureEdgeMat : this.apertureEdgeMatInvalid;
        }

        // Rebuild Real 3D Model in Preview Group
        const wallId = wallEntity.id || wallEntity.uid || `${p1.x}_${p1.y}_${p2.x}_${p2.y}`;
        const toolKey = isMoldingOrTrim 
            ? `${wallId}_${tool}_${itemW}_${itemH}_${elev}_${facing}_${this.placementScope}_${localSL_x}_${localEL_x}_${localSR_x}_${localER_x}`
            : `${wallId}_${tool}_${itemW}_${itemH}_${depth}_${elev}_${facing}_${projDist}_${preset?.profileType || ''}`;

        if (this._lastToolKey !== toolKey) {
            this._lastToolKey = toolKey;
            this.rebuild3DModelPreview(tool, wallEntity, itemW, itemH, depth, elev, facing, thick, isMoldingOrTrim, isAttachedSurfaceElement, projDist, localSL_x, localSR_x, localEL_x, localER_x, wallLen);
        }
    }

    /**
     * Render the authentic 3D model (Doors, Windows, Jali, Sunshades, Fascia, Curtains, Wall Art, Baseboards, Moldings)
     */
    rebuild3DModelPreview(tool, wallEntity, itemW, itemH, depth, elev, facing, thick, isMoldingOrTrim, isAttachedSurfaceElement, projDist, localSL_x, localSR_x, localEL_x, localER_x, wallLen) {
        while (this.modelPreviewGroup.children.length > 0) {
            const child = this.modelPreviewGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            this.modelPreviewGroup.remove(child);
        }

        const planner = this.getPlanner();
        const preset = planner?.activePresetParams || {};

        if (isMoldingOrTrim) {
            let targetWalls = [{ wall: wallEntity, side: (facing === 1 ? 'front' : 'back') }];
            if (this.placementScope === 'room') {
                const room = getRoomForWallFace(wallEntity, (facing === 1 ? 'front' : 'back'), planner, this.ctx);
                if (room) {
                    const rTargets = getRoomWallsAndSides(room, planner, this.ctx);
                    if (rTargets.length > 0) targetWalls = rTargets;
                }
            } else if (this.placementScope === 'exterior') {
                const extTargets = getExteriorWallsAndSides(planner, this.ctx);
                if (extTargets.length > 0) targetWalls = extTargets;
            }

            const shearMoldingGeo = (geo, slX, srX, elX, erX, wLen, wThick) => {
                const pos = geo.attributes.position;
                if (!pos) return;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i);
                    const z = pos.getZ(i);
                    const tZ = (z + wThick / 2) / wThick;
                    const startX = srX + tZ * (slX - srX);
                    const endX = erX + tZ * (elX - erX);
                    
                    if (x <= 0.1) {
                        pos.setX(i, startX);
                    } else if (x >= wLen - 0.1) {
                        pos.setX(i, endX);
                    }
                }
                geo.computeVertexNormals();
                pos.needsUpdate = true;
            };

            const isCrown = tool === 'molding' || tool.includes('crown') || tool === 'elevation_frieze' || (preset?.profileType && preset?.profileType.includes('crown')) || (preset?.type && preset?.type.includes('crown'));
            const isSkirting = tool === 'skirting' || tool.startsWith('skirting_') || tool === 'elevation_foundation_trim' || (preset?.profileType && preset?.profileType.includes('skirting'));
            const pType = preset.profileType || (isCrown ? 'crown' : (isSkirting ? 'skirting_flat' : 'chair_rail'));
            const mHeight = itemH;

            for (const tWall of targetWalls) {
                const wEnt = tWall.wall;
                const wSide = tWall.side;
                const wp1 = wEnt.startAnchor.position();
                const wp2 = wEnt.endAnchor.position();
                const wdx = wp2.x - wp1.x;
                const wdy = wp2.y - wp1.y;
                const wLen = Math.hypot(wdx, wdy);
                if (wLen < 1) continue;
                const wAngle = -Math.atan2(wdy, wdx);
                const wThick = wEnt.thickness || wEnt.config?.thickness || 20;
                const wH = wEnt.height || wEnt.config?.height || 180;
                const heightOffset = elev;

                const wPts = (typeof wEnt.poly?.points === 'function') ? wEnt.poly.points() : (Array.isArray(wEnt.poly) ? wEnt.poly : null);
                const angle2D = Math.atan2(wdy, wdx);
                let wSL_x = 0, wSR_x = 0, wEL_x = wLen, wER_x = wLen;
                if (wPts && wPts.length === 8) {
                    const toLocalX = (ptX, ptY) => (ptX - wp1.x) * Math.cos(angle2D) + (ptY - wp1.y) * Math.sin(angle2D);
                    wSL_x = toLocalX(wPts[0], wPts[1]);
                    wEL_x = toLocalX(wPts[2], wPts[3]);
                    wER_x = toLocalX(wPts[4], wPts[5]);
                    wSR_x = toLocalX(wPts[6], wPts[7]);
                }

                const moldMesh = this.molding3DBuilder.buildMolding({
                    side: wSide === 'front' ? 'left' : 'right',
                    width: wLen,
                    t: 0.5,
                    moldingHeight: mHeight,
                    depth: preset.depth || 2,
                    heightOffset: heightOffset,
                    profileType: pType,
                    material: preset.material || 'white_paint'
                }, wLen, wThick, this.ctx.helpers, wEnt);

                if (moldMesh) {
                    if (moldMesh.isGroup && moldMesh.children.length > 0) {
                        moldMesh.children.forEach(c => {
                            if (c.geometry) shearMoldingGeo(c.geometry, wSL_x, wSR_x, wEL_x, wER_x, wLen, wThick);
                        });
                    } else if (moldMesh.geometry) {
                        shearMoldingGeo(moldMesh.geometry, wSL_x, wSR_x, wEL_x, wER_x, wLen, wThick);
                    }

                    moldMesh.traverse(c => { c.raycast = () => {}; });

                    if (targetWalls.length > 1) {
                        moldMesh.position.set(wp1.x, 0, wp1.y);
                        moldMesh.rotation.y = wAngle;
                    }
                    this.modelPreviewGroup.add(moldMesh);
                }
            }
            return;
        }

        if (tool === 'elevation_segment') {
            const wallOffset = ((thick / 2) + (depth / 2)) * facing;
            const cutoutY = elev + itemH / 2;
            const geo = new THREE.BoxGeometry(itemW, itemH, depth);
            let mat = new THREE.MeshStandardMaterial({
                color: 0x8b5a2b,
                roughness: 0.6
            });
            if (this.ctx.helpers && this.ctx.helpers.getDynamicMaterial) {
                mat = this.ctx.helpers.getDynamicMaterial(preset.material || 'wood', 'fascia') || mat;
            }
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(projDist, cutoutY, wallOffset);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.raycast = () => {};
            this.modelPreviewGroup.add(mesh);
            return;
        }

        const isDoor = tool.startsWith('door') || (preset && (preset.doorType !== undefined || preset.doorStyle !== undefined));
        const isWindow = tool.startsWith('window') || (preset && preset.windowType !== undefined);
        const isSunshade = tool === 'sunshade' || tool.startsWith('sunshade_') || tool === 'chajja' || (preset && preset.chajjaType !== undefined);
        const isJali = tool === 'jali_panel' || tool.startsWith('jali_') || (preset && (preset.patternStyle !== undefined || preset.jaliPattern !== undefined));
        const isCurtain = tool === 'curtain' || tool.startsWith('curtain_');
        const isWallArt = tool === 'wall_art' || tool.startsWith('decor_wall_') || tool.startsWith('decor_photo_');
        const isFascia = tool === 'elevation_fascia' || tool.startsWith('fascia_');
        
        const widgetConfigId = isDoor ? 'door' : (isWindow ? 'window' : (isSunshade ? 'sunshade' : (isJali ? 'jali_panel' : (isFascia ? 'elevation_fascia' : (isCurtain ? 'curtain' : (isWallArt ? 'wall_art' : tool))))));

        const fakeEntity = {
            id: 'ghost_preview',
            type: widgetConfigId,
            configId: widgetConfigId,
            width: itemW,
            height: itemH,
            depth: depth,
            thick: thick,
            elevation: elev,
            facing: facing,
            side: 1,
            wall: wallEntity,
            localX: projDist,
            ...JSON.parse(JSON.stringify(preset))
        };
        fakeEntity.type = widgetConfigId;
        fakeEntity.configId = widgetConfigId;
        fakeEntity.width = itemW;
        fakeEntity.height = itemH;
        fakeEntity.depth = depth;
        fakeEntity.wall = wallEntity;
        fakeEntity.wallThick = thick;
        fakeEntity.thick = preset.thick || thick;
        fakeEntity.facing = facing;
        fakeEntity.elevation = elev;
        fakeEntity.localX = projDist;

        const config = WIDGET_REGISTRY[widgetConfigId] || WIDGET_REGISTRY[tool] || MOLDING_REGISTRY[tool];
        if (config && config.render3D) {
            const helpers = this.ctx.helpers || {
                getDynamicMaterial: (id, slot) => {
                    return new THREE.MeshStandardMaterial({
                        color: 0x93c5fd,
                        roughness: 0.4,
                        transparent: true,
                        opacity: 0.85
                    });
                }
            };

            const tempContainer = new THREE.Group();
            config.render3D(tempContainer, fakeEntity, helpers);
            tempContainer.traverse(c => { c.raycast = () => {}; });
            this.modelPreviewGroup.add(tempContainer);
        }
    }

    onPointerDown(e) {
        if (!this.isPlacementTool()) return false;

        const planner = this.getPlanner();
        const tool = planner?.tool;

        // Instant 1-Click Direct Placement for Elevation Segment (Professional Lumion CAD standard)
        if (tool === 'elevation_segment') {
            this.onPointerMove(e);
            if (this.activeWall && this.isValidPlacement) {
                this.placePlugin();
                return true;
            }
            return false;
        }

        this.isPinned = false;
        this.onPointerMove(e);

        if (this.activeWall && this.isValidPlacement) {
            this.isPinned = true;
            if (this.elSpecs) this.elSpecs.textContent = `📍 Position Locked · Click "✓ Place" to apply`;
            if (this.ctx && typeof this.ctx.requestRender === 'function') {
                this.ctx.requestRender();
            }
            return true;
        }

        return true;
    }

    placePlugin() {
        if (!this.isPlacementTool() || !this.activeWall || this.activeT === null) return false;
        if (!this.isValidPlacement) return false;

        this.isPinned = false;

        const planner = this.getPlanner();
        if (!planner) return false;
        const tool = planner.tool;
        const wall = this.activeWall;
        const side = this.activeSide;
        const t = this.activeT;
        const elev = this.activeElevation;

        const preset = planner.activePresetParams || {};
        const isMolding = tool === 'molding' || tool === 'skirting' || tool === 'wall_trim' || tool.startsWith('molding_') || tool.startsWith('skirting_') || tool.startsWith('trim_') || tool.startsWith('chair_rail') || tool.startsWith('picture_rail') || !!MOLDING_REGISTRY[tool] || (preset && (preset.type?.startsWith('molding_') || preset.profileType?.startsWith('skirting_')));
        const isCurtain = tool === 'curtain' || tool.startsWith('curtain_');
        const isWallArt = tool === 'wall_art' || tool.startsWith('decor_wall_') || tool.startsWith('decor_photo_');
        const isFascia = tool === 'elevation_fascia' || tool.startsWith('fascia_');
        const isWidget = !!WIDGET_REGISTRY[tool] || isCurtain || isWallArt || isFascia;

        let createdEntity = null;

        if (tool === 'elevation_segment') {
            const facing = (side === 'back') ? -1 : 1;
            const startAnchor = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
            const endAnchor = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
            const wallLen = Math.hypot(endAnchor.x - startAnchor.x, endAnchor.y - startAnchor.y);
            const localX = t * wallLen;
            const itemH = preset.width || 30;
            const beamCenterY = (elev !== undefined && elev !== null) ? (elev + itemH / 2) : 150;
            createdEntity = createStarterElevationSegment(wall, localX, beamCenterY, facing, preset);

            if (!planner.elevationSegments) planner.elevationSegments = [];
            planner.elevationSegments.push(createdEntity);

            const targetGroup = this.ctx?.structureGroup || this.ctx?.scene;
            if (targetGroup) {
                renderElevationSegment3D(targetGroup, createdEntity, this.ctx.helpers);
                if (createdEntity.mesh3D && this.ctx.interactables) {
                    if (!this.ctx.interactables.includes(createdEntity.mesh3D)) {
                        this.ctx.interactables.push(createdEntity.mesh3D);
                    }
                    createdEntity.mesh3D.traverse(child => {
                        if (child.isMesh && !this.ctx.interactables.includes(child)) {
                            this.ctx.interactables.push(child);
                        }
                    });
                }
            }

            this.hideGhost();

            if (coreEventBus) {
                coreEventBus.emit(EVENTS.SAVE_HISTORY, { action: `Place ${tool} in 3D` });
            }

            if (planner.tool === 'elevation_segment') {
                planner.tool = 'select';
                if (planner.onToolChange) planner.onToolChange('select');
                if (typeof planner.updateToolStates === 'function') planner.updateToolStates();
            }

            planner.selectEntity(createdEntity, 'elevation_segment');
            if (this.interactions && createdEntity.mesh3D) {
                this.interactions.selectObject(createdEntity.mesh3D, null, true);
            }

            if (planner.syncAll) {
                planner.syncAll();
            }

            if (this.ctx.requestRender) {
                this.ctx.requestRender('elevation_segment_placed', 2);
            }

            return createdEntity;
        } else if (isMolding) {
            let targetWalls = [{ wall, side }];
            if (this.placementScope === 'room') {
                const room = getRoomForWallFace(wall, side, planner, this.ctx);
                if (room) {
                    const rTargets = getRoomWallsAndSides(room, planner, this.ctx);
                    if (rTargets.length > 0) targetWalls = rTargets;
                }
            } else if (this.placementScope === 'exterior') {
                const extTargets = getExteriorWallsAndSides(planner, this.ctx);
                if (extTargets.length > 0) targetWalls = extTargets;
            }

            const moldType = MOLDING_REGISTRY[tool] ? tool : (preset.type || (tool === 'molding' ? 'molding_crown' : (tool === 'skirting' ? 'molding_skirting_flat' : 'molding_chair_rail')));
            const isCrown = tool === 'molding' || moldType.includes('crown') || moldType.includes('frieze') || (preset.profileType && preset.profileType.includes('crown'));
            const isSkirting = tool === 'skirting' || tool.startsWith('skirting_') || (preset.profileType && preset.profileType.includes('skirting'));
            const mH = preset.moldingHeight || (preset.height && preset.height <= 30 ? preset.height : (isSkirting ? 12 : (isCrown ? 10 : 8)));
            const pType = preset.profileType || (isCrown ? 'crown' : (isSkirting ? 'skirting_flat' : 'chair_rail'));

            const createdEntities = [];
            targetWalls.forEach(tWall => {
                const wEnt = tWall.wall;
                const wSide = tWall.side;
                const start = wEnt.startAnchor.position();
                const end = wEnt.endAnchor.position();
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const wallLen = Math.hypot(dx, dy);
                const wallH = wEnt.height || wEnt.config?.height || 180;
                const heightOffset = (elev !== undefined) ? elev : (preset.heightOffset || 0);

                const side = (wSide === 'front') ? 'left' : 'right';
                const moldOptions = {
                    ...(preset ? JSON.parse(JSON.stringify(preset)) : {}),
                    side,
                    width: wallLen,
                    moldingHeight: mH,
                    depth: preset?.depth || 2,
                    heightOffset,
                    profileType: pType,
                    material: preset?.material,
                    color: preset?.color,
                    attach: true,
                    shouldSync: false
                };
                moldOptions.side = side;
                moldOptions.width = wallLen;
                moldOptions.heightOffset = heightOffset;
                moldOptions.moldingHeight = mH;

                const mold = WallEngine.createMolding(planner, wEnt, 0.5, moldType, moldOptions);
                wEnt.wallShapeData = null;
                createdEntities.push(mold);
            });

            createdEntity = createdEntities[0] || null;
            if (createdEntity) planner.selectEntity(createdEntity, 'molding');
        } else if (isWidget) {
            const isAdvOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut', 'opening'].includes(tool) || (preset && ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut', 'opening'].includes(preset.type));
            const isDoor = !isAdvOpening && (tool.startsWith('door') || (preset && (preset.doorType !== undefined || preset.doorStyle !== undefined)));
            const isWindow = !isAdvOpening && (tool.startsWith('window') || (preset && preset.windowType !== undefined));
            const isSunshade = !isAdvOpening && (tool === 'sunshade' || tool.startsWith('sunshade_') || tool === 'chajja' || (preset && preset.chajjaType !== undefined));
            const isJali = !isAdvOpening && (tool === 'jali_panel' || tool.startsWith('jali_') || (preset && (preset.patternStyle !== undefined || preset.jaliPattern !== undefined)));
            const isCurtain = !isAdvOpening && (tool === 'curtain' || tool.startsWith('curtain_'));
            const isWallArt = !isAdvOpening && (tool === 'wall_art' || tool.startsWith('decor_wall_') || tool.startsWith('decor_photo_'));
            const isFascia = !isAdvOpening && (tool === 'elevation_fascia' || tool.startsWith('fascia_'));

            const widgetType = isDoor ? 'door' : (isWindow ? 'window' : (isSunshade ? 'sunshade' : (isJali ? 'jali_panel' : (isFascia ? 'elevation_fascia' : (isCurtain ? 'curtain' : (isWallArt ? 'wall_art' : (isAdvOpening ? (preset?.type || tool) : tool)))))));
            
            const itemW = preset.width || (isDoor ? 40 : (isWindow ? 60 : (isJali ? 60 : (isSunshade ? 60 : (isFascia ? 100 : (isCurtain ? 80 : (isAdvOpening ? (widgetType === 'circular_opening' ? 40 : 50) : 50)))))));
            const itemH = preset.height || (isDoor ? DOOR_HEIGHT : (isWindow ? WINDOW_HEIGHT : (isJali ? 80 : (isSunshade ? 12 : (isFascia ? 120 : (isCurtain ? 95 : (isAdvOpening ? (widgetType === 'circular_opening' ? 40 : (widgetType === 'arch_opening' || widgetType === 'opening' ? DOOR_HEIGHT : 60)) : 35)))))));
            const depth = preset.depth || (isSunshade ? 40 : (isFascia ? 40 : (isCurtain ? 8 : (isWallArt ? 3 : (widgetType === 'niche_recess' ? 6 : 10)))));

            const widgetOptions = {
                ...(planner.activePresetParams ? JSON.parse(JSON.stringify(planner.activePresetParams)) : {}),
                type: widgetType,
                configId: widgetType,
                facing: (side === 'back') ? -1 : 1,
                elevation: elev,
                width: itemW,
                height: itemH,
                depth: depth,
                attach: true,
                shouldSync: false
            };
            createdEntity = WallEngine.createWidget(planner, wall, t, widgetType, widgetOptions);
            wall.wallShapeData = null;
            planner.selectEntity(createdEntity, isDoor ? 'door' : (isWindow ? 'window' : (isSunshade ? 'sunshade' : (isJali ? 'jali_panel' : (isAdvOpening ? 'advance_openings' : 'widget')))));
        }

        // Save history
        if (coreEventBus) {
            coreEventBus.emit(EVENTS.SAVE_HISTORY, { action: `Place ${tool} in 3D` });
        }

        this.ctx.preventAutoFocus = true;

        // In-Place CAD Rebuild: update the specific wall or rebuild scene cleanly
        if (this.activeWall && typeof this.ctx.updateWallGeometryLive === 'function') {
            try {
                this.ctx.updateWallGeometryLive(this.activeWall);
            } catch(e) {
                console.warn('[WallPlugin3DPlacementSystem] In-place wall update fallback:', e);
            }
        } else if (this.ctx.buildScene && planner) {
            const levelsConfigArray = (planner.levels || []).map(l => ({ data: l.data, isVisible: l.isVisible !== false }));
            this.ctx.buildScene(
                planner.walls,
                planner.rooms,
                planner.stairs || [],
                planner.furniture || [],
                planner.roofs || [],
                planner.shapes || [],
                levelsConfigArray,
                planner.activeLevelIndex || 0,
                this.ctx.viewMode3D || 'full-edit',
                true,
                planner.outdoorZones || []
            );
        }

        planner.tool = 'select';
        if (typeof planner.updateToolStates === 'function') planner.updateToolStates();
        planner.syncAll();

        // Select new 3D entity smoothly without moving the camera
        if (createdEntity && createdEntity.mesh3D && this.interactions) {
            createdEntity.mesh3D.updateWorldMatrix(true, true);
            this.interactions.selectObject(createdEntity.mesh3D, null, true);
        }

        this.ctx.preventAutoFocus = false;

        if (this.ctx.requestRender) {
            this.ctx.requestRender('3D Placement Complete', 5);
        }

        this.hideGhost();
        return true;
    }

    hideGhost() {
        this.isPinned = false;
        let changed = false;
        if (this.placementGroup && this.placementGroup.visible) {
            this.placementGroup.visible = false;
            changed = true;
        }
        if (this.badgeDom) this.badgeDom.style.display = 'none';
        this.activeWall = null;
        this.activeT = null;
        this._lastToolKey = null;
        const hr = this.ctx.interactions?.highlightRenderer;
        if (hr) {
            hr.clearHoverHighlight();
        }
        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = (this.interactions?.mode === 'camera');
        }
        if (changed && this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    dispose() {
        this.hideGhost();
        if (this.boundOnKeyDown) window.removeEventListener('keydown', this.boundOnKeyDown);
        if (this.boundOnKeyUp) window.removeEventListener('keyup', this.boundOnKeyUp);
        if (this.badgeDom && this.badgeDom.parentNode) {
            this.badgeDom.parentNode.removeChild(this.badgeDom);
        }
        if (this.placementGroup) {
            this.ctx.scene.remove(this.placementGroup);
        }
    }
}

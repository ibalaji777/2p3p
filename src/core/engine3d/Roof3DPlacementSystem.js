import * as THREE from 'three';
import { SNAP_DIST, ROOF_DECOR_REGISTRY, WALL_DECOR_REGISTRY } from '../registry.js';
import { PremiumHipRoof } from '../../features/roof/roof.renderer2d.js';
import { Roof3DBuilder } from '../../features/roof/builders/Roof3DBuilder.js';
import { RoofEngine } from '../roof/index.js';

/**
 * Roof3DPlacementSystem
 * 
 * Direct Sims 4-Style 3D Roof Placement & Drawing System:
 * - Drag-to-Draw: Click on wall top/surface -> drag diagonal -> release to place Gable, Hip, or Flat roof piece.
 * - Room Snap: Hover over a closed room or wall loop to preview and click-to-fit roof over that specific room.
 * - Live 3D Ghost: Real-time extruded roof geometry with pitch, ridge, overhangs, and materials.
 * - Live Dimension Badge: Shows Width x Depth and Pitch in architectural units.
 * - Instant CAD In-Place Selection: After placement, selects the roof and activates interactive editing handles.
 */
export class Roof3DPlacementSystem {
    constructor(ctx, interactionSystem) {
        this.ctx = ctx;
        this.interactions = interactionSystem;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.drawing = false;
        this.startPoint = null;
        this.currentPoint = null;

        // Ghost Container in 3D Scene
        this.ghostGroup = new THREE.Group();
        this.ghostGroup.name = 'Roof3DPlacement_GhostGroup';
        this.ghostGroup.visible = false;
        this.ghostGroup.raycast = () => {}; // Zero-occlusion
        this.ctx.scene.add(this.ghostGroup);

        // Snap Indicator Group (Interactive circle dot cursor + pulsing ring)
        this.snapIndicatorGroup = new THREE.Group();
        this.snapIndicatorGroup.name = 'Roof3DPlacement_SnapIndicator';
        this.snapIndicatorGroup.visible = false;
        this.snapIndicatorGroup.raycast = () => {};

        const outerRingGeo = new THREE.RingGeometry(8, 14, 32);
        outerRingGeo.rotateX(-Math.PI / 2);
        this.snapRingMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            depthTest: false,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide
        });
        this.snapRing = new THREE.Mesh(outerRingGeo, this.snapRingMat);
        this.snapRing.renderOrder = 10002;
        this.snapRing.raycast = () => {};
        this.snapIndicatorGroup.add(this.snapRing);

        const innerDotGeo = new THREE.CircleGeometry(6, 32);
        innerDotGeo.rotateX(-Math.PI / 2);
        this.snapDotMat = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            depthTest: false,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide
        });
        this.snapDot = new THREE.Mesh(innerDotGeo, this.snapDotMat);
        this.snapDot.renderOrder = 10003;
        this.snapDot.raycast = () => {};
        this.snapIndicatorGroup.add(this.snapDot);

        // Start Anchor Marker (displayed at startPoint during drawing)
        this.startAnchorGroup = new THREE.Group();
        this.startAnchorGroup.name = 'Roof3DPlacement_StartAnchor';
        this.startAnchorGroup.visible = false;
        this.startAnchorGroup.raycast = () => {};

        const startRingGeo = new THREE.RingGeometry(8, 14, 32);
        startRingGeo.rotateX(-Math.PI / 2);
        const startDotGeo = new THREE.CircleGeometry(6, 32);
        startDotGeo.rotateX(-Math.PI / 2);

        this.startRing = new THREE.Mesh(startRingGeo, new THREE.MeshBasicMaterial({
            color: 0x10b981,
            depthTest: false,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        }));
        this.startRing.renderOrder = 10002;
        this.startRing.raycast = () => {};
        this.startAnchorGroup.add(this.startRing);

        this.startDot = new THREE.Mesh(startDotGeo, new THREE.MeshBasicMaterial({
            color: 0x059669,
            depthTest: false,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide
        }));
        this.startDot.renderOrder = 10003;
        this.startDot.raycast = () => {};
        this.startAnchorGroup.add(this.startDot);

        // Snap Halo Group (highlights snapped wall or roof edge)
        this.snapHaloGroup = new THREE.Group();
        this.snapHaloGroup.name = 'Roof3DPlacement_SnapHalo';
        this.snapHaloGroup.visible = false;
        this.snapHaloGroup.raycast = () => {};

        this.haloMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 3,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });

        this.ctx.scene.add(this.snapIndicatorGroup);
        this.ctx.scene.add(this.startAnchorGroup);
        this.ctx.scene.add(this.snapHaloGroup);

        // Polyline Drawing State (Option B)
        this.drawMode = 'box'; // 'box' | 'polygon'
        this.polygonPoints = [];
        this.polygonElevation = null;
        this.lastClickTime = 0;

        // Visual group for polyline vertex markers
        this.polygonMarkersGroup = new THREE.Group();
        this.polygonMarkersGroup.name = 'Roof3DPlacement_PolygonMarkers';
        this.polygonMarkersGroup.visible = false;
        this.polygonMarkersGroup.raycast = () => {};
        this.ctx.scene.add(this.polygonMarkersGroup);

        // Visual group for polyline edge lines & closing guide
        this.polygonLineGroup = new THREE.Group();
        this.polygonLineGroup.name = 'Roof3DPlacement_PolygonLines';
        this.polygonLineGroup.visible = false;
        this.polygonLineGroup.raycast = () => {};
        this.ctx.scene.add(this.polygonLineGroup);

        // Grid Snap Plane (XZ)
        this.placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        this._createDOMBadge();
        this._createModeHUD();

        this._onKeyDown = this._onKeyDown.bind(this);
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', this._onKeyDown);
        }
    }

    _createDOMBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'roof3d-live-dimension-badge';
        this.domBadge.style.cssText = `display: none; pointer-events: none;`;
        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domBadge);
    }

    _updateDOMBadge(text, screenPos) {
        if (this.modeHUD) {
            const statusEl = this.modeHUD.querySelector('#roof-hud-status');
            if (statusEl && text) {
                statusEl.innerHTML = text;
            }
        }
        // Zero mouse-tracking DOM element to prevent cursor interruption and viewport clutter
        if (this.domBadge) {
            this.domBadge.style.display = 'none';
        }
    }

    _hideDOMBadge() {
        if (this.modeHUD) {
            const statusEl = this.modeHUD.querySelector('#roof-hud-status');
            if (statusEl) {
                statusEl.innerText = 'Click 1st corner';
            }
        }
        if (this.domBadge) this.domBadge.style.display = 'none';
    }

    _createModeHUD() {
        if (typeof document === 'undefined') return;
        this.modeHUD = document.createElement('div');
        this.modeHUD.className = 'roof3d-draw-mode-hud';
        this.modeHUD.title = 'Roof Drawing | [P] Switch Mode • [Enter] Close Polygon • [Esc] Cancel';
        this.modeHUD.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            display: none;
            align-items: center;
            gap: 8px;
            padding: 5px 12px;
            height: auto;
            box-sizing: border-box;
            background: rgba(15, 23, 42, 0.94);
            border: 1px solid rgba(0, 240, 255, 0.45);
            border-radius: 9999px;
            box-shadow: 0 14px 36px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 240, 255, 0.2);
            color: #ffffff;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 600;
            z-index: 995;
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            user-select: none;
            pointer-events: auto;
            width: max-content;
            max-width: calc(100vw - 32px);
        `;
        this.modeHUD.innerHTML = `
            <div style="display: inline-flex; align-items: center; gap: 2px; background: rgba(30, 41, 59, 0.7); padding: 2px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08);">
                <button id="roof-btn-mode-box" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 10px; border: none; background: ${this.drawMode === 'box' ? '#0284c7' : 'transparent'}; color: ${this.drawMode === 'box' ? '#fff' : '#94a3b8'}; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s ease;">
                    <span>◻</span> Box
                </button>
                <button id="roof-btn-mode-polygon" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 10px; border: none; background: ${this.drawMode === 'polygon' ? '#0284c7' : 'transparent'}; color: ${this.drawMode === 'polygon' ? '#fff' : '#94a3b8'}; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s ease;">
                    <span>✏</span> Polyline
                </button>
            </div>
            <div id="roof-hud-status" style="display: inline-flex; align-items: center; gap: 4px; color: #38bdf8; font-size: 11px; font-weight: 600; padding: 2px 8px; background: rgba(56, 189, 248, 0.1); border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.2); white-space: nowrap;">
                Click 1st corner
            </div>
            <button id="roof-btn-mode-done" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.15); background: rgba(239, 68, 68, 0.2); color: #fca5a5; font-size: 10px; font-weight: 700; cursor: pointer; padding: 0; transition: all 0.15s ease;" title="Done / Cancel (Esc)">
                ✕
            </button>
        `;

        // Prevent click/touch events on HUD from bleeding through into 3D scene raycaster
        const stopProp = (e) => e.stopPropagation();
        ['pointerdown', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend'].forEach(evt => {
            this.modeHUD.addEventListener(evt, stopProp);
        });

        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.modeHUD);

        const btnBox = this.modeHUD.querySelector('#roof-btn-mode-box');
        const btnPoly = this.modeHUD.querySelector('#roof-btn-mode-polygon');
        const btnDone = this.modeHUD.querySelector('#roof-btn-mode-done');

        if (btnBox) {
            btnBox.onclick = (e) => {
                e.stopPropagation();
                this.setDrawMode('box');
            };
        }
        if (btnPoly) {
            btnPoly.onclick = (e) => {
                e.stopPropagation();
                this.setDrawMode('polygon');
            };
        }
        if (btnDone) {
            btnDone.onclick = (e) => {
                e.stopPropagation();
                this.drawing = false;
                this.startPoint = null;
                this.currentPoint = null;
                if (this.startAnchorGroup) this.startAnchorGroup.visible = false;
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                const planner = this.getPlanner();
                if (planner) {
                    planner.tool = 'select';
                    if (planner.updateToolStates) planner.updateToolStates();
                    if (planner.onToolChange) planner.onToolChange('select');
                }
                this.resetPolygon();
                this.hideGhost();
                this._hideModeHUD();
            };
        }
    }

    _updateModeHUD() {
        if (!this.modeHUD) return;
        const btnBox = this.modeHUD.querySelector('#roof-btn-mode-box');
        const btnPoly = this.modeHUD.querySelector('#roof-btn-mode-polygon');
        if (btnBox) {
            btnBox.style.background = this.drawMode === 'box' ? '#0284c7' : 'transparent';
            btnBox.style.color = this.drawMode === 'box' ? '#ffffff' : '#94a3b8';
        }
        if (btnPoly) {
            btnPoly.style.background = this.drawMode === 'polygon' ? '#0284c7' : 'transparent';
            btnPoly.style.color = this.drawMode === 'polygon' ? '#ffffff' : '#94a3b8';
        }
    }

    _showModeHUD() {
        if (!this.modeHUD) this._createModeHUD();
        if (this.modeHUD) {
            this.modeHUD.style.display = 'flex';
            this._updateModeHUD();
        }
    }

    _hideModeHUD() {
        if (this.modeHUD) {
            this.modeHUD.style.display = 'none';
        }
    }

    setDrawMode(mode) {
        if (mode !== 'box' && mode !== 'polygon') return;
        this.drawMode = mode;
        this.resetPolygon();
        this.hideGhost();
        this._showModeHUD();
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    _snapAngle(fromPt, toPt) {
        const dx = toPt.x - fromPt.x;
        const dz = toPt.z - fromPt.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 8) return { x: toPt.x, z: toPt.z, snappedAngle: null };

        const angleRad = Math.atan2(dz, dx);
        let angleDeg = (angleRad * 180) / Math.PI;

        const snapAngles = [0, 45, 90, 135, 180, -45, -90, -135, -180];
        const THRESHOLD = 5; // degrees

        for (const sa of snapAngles) {
            let diff = Math.abs(angleDeg - sa);
            if (diff > 180) diff = 360 - diff;
            if (diff <= THRESHOLD) {
                const snapRad = (sa * Math.PI) / 180;
                return {
                    x: Math.round(fromPt.x + Math.cos(snapRad) * dist),
                    z: Math.round(fromPt.z + Math.sin(snapRad) * dist),
                    snappedAngle: sa,
                    angleLabel: `${Math.abs(sa)}° Ortho`
                };
            }
        }

        return { x: toPt.x, z: toPt.z, snappedAngle: null };
    }

    getPlanner() {
        return this.ctx.planner || window.planner?.value || window.planner || (this.ctx.appState && this.ctx.appState.planner) || window.plannerInstance;
    }

    isPlacementTool() {
        const planner = this.getPlanner();
        const tool = planner?.tool;
        if (!tool) return false;

        // Explicitly exclude any roof attachment / plugin / sculpture / skylight tools
        if (tool === 'roof_cresting' || tool === 'roof_finial' || tool === 'roof_chimney' || 
            tool === 'roof_sculptures' || tool === 'roof_sculpture' || tool === 'skylight' ||
            (typeof tool === 'string' && (
                tool.startsWith('ridge_cresting') || 
                tool.startsWith('finial_') || 
                tool.startsWith('chimney_') || 
                tool.startsWith('skylight_')
            ))) {
            return false;
        }

        const preset = planner?.activePresetParams;
        if (preset?.sculptureCategory || 
            ['roof_cresting', 'roof_finial', 'roof_chimney', 'roof_sculptures', 'skylight'].includes(preset?.toolId) ||
            preset?.type?.startsWith('ridge_cresting') || 
            preset?.type?.startsWith('finial_') || 
            preset?.type?.startsWith('chimney_') || 
            preset?.type?.startsWith('skylight_')) {
            return false;
        }

        if (preset?.drawMode === 'polygon' || tool === 'roof_polygon' || tool === 'roof_polyline') {
            if (this.drawMode !== 'polygon') {
                this.drawMode = 'polygon';
                this._updateModeHUD();
            }
        } else if (preset?.drawMode === 'box' || tool === 'roof_box') {
            if (this.drawMode !== 'box') {
                this.drawMode = 'box';
                this._updateModeHUD();
            }
        }

        const isTool = tool === 'roof' || tool === 'roof_presets' || tool === 'roof_box' || tool === 'roof_polygon' || tool === 'roof_polyline' || tool === 'curved_portal' || tool === 'curved_portal_roof' || (typeof tool === 'string' && (tool.startsWith('roof_type_') || tool.startsWith('preset_roof_')));
        if (isTool) {
            this._showModeHUD();
            if (this.interactions && this.interactions.selectedObject) {
                this.interactions.deselect();
            }
        } else {
            this._hideModeHUD();
        }
        return isTool;
    }

    getActiveRoofParams() {
        const planner = this.getPlanner();
        const presetParams = planner?.activePresetParams || {};
        const isPortal = presetParams.roofType === 'curved_portal' || presetParams.toolId === 'curved_portal' || planner?.tool === 'curved_portal';
        const isFlat = presetParams.roofType === 'flat' || presetParams.toolId === 'roof_flat' || planner?.tool === 'roof_flat';
        return {
            roofType: isPortal ? 'curved_portal' : (presetParams.roofType || 'gable'),
            pitch: presetParams.pitch !== undefined ? presetParams.pitch : (isFlat ? 0 : 30),
            curve: presetParams.curve !== undefined ? presetParams.curve : (presetParams.roofType === 'curved' ? -20 : 0),
            radius: presetParams.radius !== undefined ? presetParams.radius : 0,
            wallSides: presetParams.wallSides || { left: true, right: true, front: false, back: false },
            wallDropHeight: presetParams.wallDropHeight !== undefined ? presetParams.wallDropHeight : 0,
            hasSpotlights: presetParams.hasSpotlights !== undefined ? presetParams.hasSpotlights : true,
            material: presetParams.material || ((isPortal || isFlat) ? 'white_plaster_wall' : 'terracotta_tiles_roof'),
            overhang: presetParams.overhang !== undefined ? presetParams.overhang : ((isPortal || isFlat) ? 0 : 8),
            thick: presetParams.thick || 15
        };
    }

    getBaseRoofElevation() {
        const planner = this.getPlanner();
        let maxH = 120;
        if (planner && planner.walls && planner.walls.length > 0) {
            planner.walls.forEach(w => {
                const top = Number((w.elevation || 0) + (w.height !== undefined ? w.height : (w.config?.height || 120)));
                if (top > maxH) maxH = top;
            });
        }
        return maxH;
    }

    _formatFeetInches(px) {
        const totalInches = Math.round((px / 20) * 12);
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        return `${feet}' ${inches}"`;
    }

    updateMouse(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.lastClientX = e.clientX;
        this.lastClientY = e.clientY;
    }

    _updateSnapHalo(points) {
        if (!this.snapHaloGroup) return;
        while (this.snapHaloGroup.children.length > 0) {
            const c = this.snapHaloGroup.children[0];
            if (c.geometry) c.geometry.dispose();
            this.snapHaloGroup.remove(c);
        }
        if (!points || points.length < 2) {
            this.snapHaloGroup.visible = false;
            return;
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geo, this.haloMat);
        line.renderOrder = 10001;
        line.raycast = () => {};
        this.snapHaloGroup.add(line);
        this.snapHaloGroup.visible = true;
    }

    _findMagneticSnap(planePt, targetElevation, entity, planner) {
        const px = planePt.x;
        const pz = planePt.z;
        const SNAP_RADIUS = 25; // 25cm magnetic snap radius

        // Priority 0: Polygon Start Vertex (Loop Closing Snap for Option B)
        if (this.drawMode === 'polygon' && this.polygonPoints.length >= 3) {
            const startV = this.polygonPoints[0];
            const dStart = Math.hypot(startV.x - px, startV.z - pz);
            if (dStart < SNAP_RADIUS) {
                return {
                    x: Math.round(startV.x),
                    y: startV.y,
                    z: Math.round(startV.z),
                    snapType: 'polygon_close',
                    snapLabel: '🧲 CLICK TO CLOSE POLYGON ROOF',
                    color: 0x10b981,
                    haloPoints: null,
                    isClosing: true,
                    hitEntity: startV.hitEntity
                };
            }
        }

        // Priority 0b: Intermediate Placed Polyline Vertices
        if (this.drawMode === 'polygon' && this.polygonPoints.length > 1) {
            for (let i = 1; i < this.polygonPoints.length - 1; i++) {
                const vi = this.polygonPoints[i];
                const dvi = Math.hypot(vi.x - px, vi.z - pz);
                if (dvi < 18) {
                    return {
                        x: Math.round(vi.x),
                        y: vi.y,
                        z: Math.round(vi.z),
                        snapType: 'polygon_vertex',
                        snapLabel: `🧲 VERTEX ${i + 1} ALIGNED`,
                        color: 0x06b6d4,
                        haloPoints: null,
                        hitEntity: vi.hitEntity
                    };
                }
            }
        }

        // Priority 1: Wall Corners (Start and End endpoints of all active planner walls)
        let closestCornerDist = Infinity;
        let bestCornerSnap = null;

        if (planner?.walls && planner.walls.length > 0) {
            for (const w of planner.walls) {
                if (w.hidden || w.isAutoGable || w.parentRoofId) continue;
                const p1 = w.startAnchor?.position ? w.startAnchor.position() : { x: w.x1 || w.startX || 0, y: w.y1 || w.startY || 0 };
                const p2 = w.endAnchor?.position ? w.endAnchor.position() : { x: w.x2 || w.endX || 0, y: w.y2 || w.endY || 0 };
                const wallBaseY = w.elevation || 0;
                const wallH = w.height !== undefined ? w.height : (w.config?.height || 120);
                const wallTop = wallBaseY + wallH;

                const d1 = Math.hypot(p1.x - px, p1.y - pz);
                if (d1 < SNAP_RADIUS && d1 < closestCornerDist) {
                    closestCornerDist = d1;
                    bestCornerSnap = {
                        x: Math.round(p1.x),
                        y: wallTop,
                        z: Math.round(p1.y),
                        snapType: 'wall_corner',
                        snapLabel: '🧲 SNAPPED TO WALL CORNER',
                        color: 0x10b981,
                        haloPoints: null,
                        hitEntity: w
                    };
                }

                const d2 = Math.hypot(p2.x - px, p2.y - pz);
                if (d2 < SNAP_RADIUS && d2 < closestCornerDist) {
                    closestCornerDist = d2;
                    bestCornerSnap = {
                        x: Math.round(p2.x),
                        y: wallTop,
                        z: Math.round(p2.y),
                        snapType: 'wall_corner',
                        snapLabel: '🧲 SNAPPED TO WALL CORNER',
                        color: 0x10b981,
                        haloPoints: null,
                        hitEntity: w
                    };
                }
            }
        }

        // Priority 2: Existing Roof Corners (all vertices of existing roofs)
        if (planner?.roofs && planner.roofs.length > 0) {
            for (const r of planner.roofs) {
                if (!r.points || r.points.length < 3) continue;
                const rElev = r.elevation !== undefined ? r.elevation : 120;
                const rThick = r.config?.thickness !== undefined ? r.config.thickness : 15;
                const rTop = rElev + rThick;

                for (const pt of r.points) {
                    const d = Math.hypot(pt.x - px, pt.y - pz);
                    if (d < SNAP_RADIUS && d < closestCornerDist) {
                        closestCornerDist = d;
                        bestCornerSnap = {
                            x: Math.round(pt.x),
                            y: rTop,
                            z: Math.round(pt.y),
                            snapType: 'roof_corner',
                            snapLabel: '🧲 SNAPPED TO ROOF CORNER',
                            color: 0x06b6d4,
                            haloPoints: null,
                            hitEntity: r
                        };
                    }
                }
            }
        }

        if (bestCornerSnap) {
            return bestCornerSnap;
        }

        // Priority 3: Wall Baseline / Edge Snapping (Project onto wall centerline segment)
        let closestEdgeDist = Infinity;
        let bestEdgeSnap = null;

        if (planner?.walls && planner.walls.length > 0) {
            for (const w of planner.walls) {
                if (w.hidden || w.isAutoGable || w.parentRoofId) continue;
                const p1 = w.startAnchor?.position ? w.startAnchor.position() : { x: w.x1 || w.startX || 0, y: w.y1 || w.startY || 0 };
                const p2 = w.endAnchor?.position ? w.endAnchor.position() : { x: w.x2 || w.endX || 0, y: w.y2 || w.endY || 0 };
                const len2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
                if (len2 < 1) continue;

                const t = Math.max(0, Math.min(1, ((px - p1.x) * (p2.x - p1.x) + (pz - p1.y) * (p2.y - p1.y)) / len2));
                const projX = p1.x + t * (p2.x - p1.x);
                const projZ = p1.y + t * (p2.y - p1.y);
                const dist = Math.hypot(px - projX, pz - projZ);
                const wallBaseY = w.elevation || 0;
                const wallH = w.height !== undefined ? w.height : (w.config?.height || 120);
                const wallTop = wallBaseY + wallH;
                const snapThresh = (w.thickness || 15) + 12;

                if (dist < snapThresh && dist < closestEdgeDist) {
                    closestEdgeDist = dist;
                    bestEdgeSnap = {
                        x: Math.round(projX * 10) / 10,
                        y: wallTop,
                        z: Math.round(projZ * 10) / 10,
                        snapType: 'wall_edge',
                        snapLabel: '🧱 SNAPPED TO WALL TOP',
                        color: 0x00f0ff,
                        haloPoints: [new THREE.Vector3(p1.x, wallTop + 0.3, p1.y), new THREE.Vector3(p2.x, wallTop + 0.3, p2.y)],
                        hitEntity: w
                    };
                }
            }
        }

        // Priority 4: Roof Outer Edges Snapping
        if (planner?.roofs && planner.roofs.length > 0) {
            for (const r of planner.roofs) {
                if (!r.points || r.points.length < 3) continue;
                const rElev = r.elevation !== undefined ? r.elevation : 120;
                const rThick = r.config?.thickness !== undefined ? r.config.thickness : 15;
                const rTop = rElev + rThick;

                for (let i = 0; i < r.points.length; i++) {
                    const j = (i + 1) % r.points.length;
                    const p1 = r.points[i];
                    const p2 = r.points[j];
                    const len2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
                    if (len2 < 1) continue;

                    const t = Math.max(0, Math.min(1, ((px - p1.x) * (p2.x - p1.x) + (pz - p1.y) * (p2.y - p1.y)) / len2));
                    const projX = p1.x + t * (p2.x - p1.x);
                    const projZ = p1.y + t * (p2.y - p1.y);
                    const dist = Math.hypot(px - projX, pz - projZ);

                    if (dist < 18 && dist < closestEdgeDist) {
                        closestEdgeDist = dist;
                        bestEdgeSnap = {
                            x: Math.round(projX * 10) / 10,
                            y: rTop,
                            z: Math.round(projZ * 10) / 10,
                            snapType: 'roof_edge',
                            snapLabel: '🏠 SNAPPED TO ROOF EDGE',
                            color: 0x38bdf8,
                            haloPoints: [new THREE.Vector3(p1.x, rTop + 0.3, p1.y), new THREE.Vector3(p2.x, rTop + 0.3, p2.y)],
                            hitEntity: r
                        };
                    }
                }
            }
        }

        if (bestEdgeSnap) {
            return bestEdgeSnap;
        }

        // Priority 5: Surface / Slab Snapping (if ray hit a surface or elevated element)
        if (entity || targetElevation > 5) {
            const snap = 5;
            return {
                x: Math.round(px / snap) * snap,
                y: targetElevation,
                z: Math.round(pz / snap) * snap,
                snapType: 'surface',
                snapLabel: '🏢 SURFACE / SLAB',
                color: 0x60a5fa,
                haloPoints: null,
                hitEntity: entity
            };
        }

        // Priority 6: Ground Plane Fallback
        const snap = 10;
        return {
            x: Math.round(px / snap) * snap,
            y: targetElevation,
            z: Math.round(pz / snap) * snap,
            snapType: 'ground',
            snapLabel: '🏕️ GROUND LEVEL',
            color: 0xffffff,
            haloPoints: null,
            hitEntity: null
        };
    }

    _getRaycastIntersection(e) {
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        const planner = this.getPlanner();
        let targetElevation = this.getBaseRoofElevation();

        // 1. Direct 3D Raycasting against actual wall, floor slab, terrain, and roof meshes (Sims 4 Placement)
        const structureObjects = [];
        const scanGroup = (grp) => {
            if (!grp) return;
            grp.traverse(child => {
                if (child.isMesh && child.userData && (
                    child.userData.isWallSide || 
                    child.userData.entity || 
                    child.userData.isRoof || 
                    child.userData.componentType === 'roof_top' ||
                    child.userData.isFloor ||
                    child.userData.isSlab ||
                    child.userData.isPlatform ||
                    child.userData.isTerrain
                )) {
                    structureObjects.push(child);
                }
            });
        };

        scanGroup(this.ctx.structureGroup);
        if (this.ctx.scene && structureObjects.length === 0) {
            scanGroup(this.ctx.scene);
        }

        let hitEntity = null;
        let planePt = new THREE.Vector3();
        let hasHit = false;

        if (structureObjects.length > 0) {
            const hits = this.raycaster.intersectObjects(structureObjects, false);
            if (hits.length > 0) {
                const hit = hits[0];
                hitEntity = hit.object.userData?.entity;
                if (!hitEntity && hit.object.parent) hitEntity = hit.object.parent.userData?.entity;

                if (this.drawMode === 'polygon' && this.polygonElevation !== null) {
                    targetElevation = this.polygonElevation;
                } else if (hitEntity && hitEntity.startAnchor && hitEntity.endAnchor) {
                    const wallBaseY = hitEntity.elevation || 0;
                    const wallH = hitEntity.height !== undefined ? hitEntity.height : (hitEntity.config?.height || 120);
                    targetElevation = wallBaseY + wallH;
                } else if (hit.point && hit.point.y !== undefined) {
                    targetElevation = Math.round(hit.point.y * 10) / 10;
                }

                // Direct physical mesh surface hit point (x, z) at targetElevation to eliminate parallax distortion
                planePt.set(hit.point.x, targetElevation, hit.point.z);
                hasHit = true;
            }
        }

        if (!hasHit) {
            // 2. Fallback to Ground / Active Level Elevation Plane (y = 0 for flat ground roof)
            const groundElev = (this.drawMode === 'polygon' && this.polygonElevation !== null)
                ? this.polygonElevation
                : (this.ctx?.activeLevelElevation || 0);
            targetElevation = groundElev;
            this.placementPlane.constant = -groundElev;
            if (this.raycaster.ray.intersectPlane(this.placementPlane, planePt)) {
                hasHit = true;
            }
        }

        if (hasHit && planePt) {
            const snap = this._findMagneticSnap(planePt, targetElevation, hitEntity, planner);

            // Update interactive snap indicator cursor position, scale, and colors
            if (this.snapIndicatorGroup) {
                this.snapIndicatorGroup.position.set(snap.x, snap.y + 0.6, snap.z);
                if (this.ctx?.camera) {
                    const camDist = this.ctx.camera.position.distanceTo(this.snapIndicatorGroup.position);
                    const scale = Math.max(0.8, Math.min(4.5, camDist / 400));
                    this.snapIndicatorGroup.scale.setScalar(scale);
                }
                if (this.snapRingMat) this.snapRingMat.color.setHex(snap.color);
                if (this.snapDotMat) this.snapDotMat.color.setHex(snap.color);
                this.snapIndicatorGroup.visible = true;
            }

            if (this.startAnchorGroup && this.startAnchorGroup.visible && this.ctx?.camera) {
                const camDist = this.ctx.camera.position.distanceTo(this.startAnchorGroup.position);
                const scale = Math.max(0.8, Math.min(4.5, camDist / 400));
                this.startAnchorGroup.scale.setScalar(scale);
            }

            // Update snap halo line
            this._updateSnapHalo(snap.haloPoints);

            return {
                x: snap.x,
                y: snap.y,
                z: snap.z,
                snapType: snap.snapType,
                snapLabel: snap.snapLabel,
                color: snap.color,
                rawPoint: planePt,
                hitEntity: snap.hitEntity || hitEntity
            };
        }

        return null;
    }

    onPointerDown(e) {
        if (!this.isPlacementTool()) return false;
        if (e.button !== 0) return false;

        const hit = this._getRaycastIntersection(e);
        if (!hit) return false;

        const now = Date.now();
        const isDblClick = (this.lastClickTime && (now - this.lastClickTime < 450)) || (e.detail && e.detail >= 2);
        this.lastClickTime = now;

        e.preventDefault();
        e.stopPropagation();

        // 1. OPTION B: Polyline Polygon Draw Mode
        if (this.drawMode === 'polygon') {
            // Check double-click completion
            if (isDblClick && this.polygonPoints.length >= 3) {
                this.finishPolygon();
                return true;
            }

            // Check click on start vertex to close loop
            if (this.polygonPoints.length >= 3) {
                const startV = this.polygonPoints[0];
                const dStart = Math.hypot(hit.x - startV.x, hit.z - startV.z);
                if (dStart < 25 || hit.isClosing) {
                    this.finishPolygon();
                    return true;
                }
            }

            const newPt = {
                x: hit.x,
                y: this.polygonElevation !== null ? this.polygonElevation : hit.y,
                z: hit.z,
                hitEntity: hit.hitEntity,
                snapType: hit.snapType
            };

            if (this.polygonPoints.length === 0) {
                this.polygonElevation = newPt.y;
            } else {
                const lastP = this.polygonPoints[this.polygonPoints.length - 1];
                if (Math.hypot(newPt.x - lastP.x, newPt.z - lastP.z) < 5) {
                    return true;
                }
            }

            this.polygonPoints.push(newPt);
            this._updatePolygonVisuals();
            this.ghostGroup.visible = true;
            if (this.ctx.controls) this.ctx.controls.enabled = false;

            if (this.ctx && typeof this.ctx.requestRender === 'function') {
                this.ctx.requestRender();
            }
            return true;
        }

        // 2. OPTION A: Box Mode (Supports Click-Move-Click AND Click-Drag-Release)
        if (this.drawing && this.startPoint) {
            // Second click in Click-Move-Click mode!
            const p1 = this.startPoint;
            const p2 = { x: hit.x, z: hit.z, y: hit.y, hitEntity: hit.hitEntity, snapType: hit.snapType };

            let minX = Math.min(p1.x, p2.x);
            let maxX = Math.max(p1.x, p2.x);
            let minZ = Math.min(p1.z, p2.z);
            let maxZ = Math.max(p1.z, p2.z);

            const w = maxX - minX;
            const d = maxZ - minZ;

            if (w >= 10 && d >= 10) {
                const roofPoints = [
                    { x: minX, y: minZ },
                    { x: maxX, y: minZ },
                    { x: maxX, y: maxZ },
                    { x: minX, y: maxZ }
                ];
                const roofElevation = p1.y;
                const extraConfig = {};
                if (p1.hitEntity?.id) extraConfig.connectedWallId = p1.hitEntity.id;

                this.drawing = false;
                this.startPoint = null;
                this.currentPoint = null;
                if (this.startAnchorGroup) this.startAnchorGroup.visible = false;
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                this.hideGhost();
                this._commitRoof(roofPoints, roofElevation, extraConfig);
                return true;
            }
        }

        // Start drawing: Click 1 (locks Corner 1)
        this.lastHit = hit;
        this.drawing = true;
        this.startPoint = { x: hit.x, z: hit.z, y: hit.y, hitEntity: hit.hitEntity, snapType: hit.snapType };
        this.currentPoint = { x: hit.x, z: hit.z, y: hit.y, hitEntity: hit.hitEntity, snapType: hit.snapType };

        // Position stationary start anchor marker
        if (this.startAnchorGroup) {
            this.startAnchorGroup.position.set(hit.x, hit.y + 0.7, hit.z);
            this.startAnchorGroup.visible = true;
        }

        this.ghostGroup.visible = true;
        if (this.ctx.controls) this.ctx.controls.enabled = false;

        this._renderGhost();
        return true;
    }

    onPointerMove(e) {
        if (!this.isPlacementTool()) return false;
        this._showModeHUD();

        const hit = this._getRaycastIntersection(e);
        if (!hit) return false;

        this.lastHit = hit;

        // 1. OPTION B: Polyline Polygon Draw Mode
        if (this.drawMode === 'polygon') {
            if (this.polygonPoints.length === 0) {
                this.ghostGroup.visible = false;
                if (this.startAnchorGroup) this.startAnchorGroup.visible = false;
                const snapBadge = hit.snapLabel ? `${hit.snapLabel} &bull; ` : '';
                this._updateDOMBadge(
                    `${snapBadge}Click 1st corner`,
                    { x: this.lastClientX || 0, y: this.lastClientY || 0 }
                );
                if (this.ctx && typeof this.ctx.requestRender === 'function') {
                    this.ctx.requestRender();
                }
                return true;
            }

            let currX = hit.x;
            let currZ = hit.z;
            const lastP = this.polygonPoints[this.polygonPoints.length - 1];
            let angleInfo = null;

            // Ortho / Angle snap relative to last placed vertex
            if (!hit.isClosing && !hit.snapType?.startsWith('wall_corner') && !hit.snapType?.startsWith('roof_corner')) {
                const angleSnap = this._snapAngle(lastP, { x: currX, z: currZ });
                currX = angleSnap.x;
                currZ = angleSnap.z;
                angleInfo = angleSnap.angleLabel;
            }

            const currentPt = {
                x: currX,
                y: this.polygonElevation !== null ? this.polygonElevation : hit.y,
                z: currZ,
                hitEntity: hit.hitEntity
            };

            this._updatePolygonVisuals(currentPt);

            // Render live 3D extruded ghost when >= 2 points placed
            if (this.polygonPoints.length >= 2) {
                const previewPts = [...this.polygonPoints.map(p => ({ x: p.x, y: p.z })), { x: currX, y: currZ }];
                this._buildGhost3DMesh(previewPts, this.polygonElevation !== null ? this.polygonElevation : hit.y);
                this.ghostGroup.visible = true;
            }

            // Live HUD badge
            const segDist = Math.hypot(currX - lastP.x, currZ - lastP.z);
            const segDistStr = this._formatFeetInches(segDist);
            const count = this.polygonPoints.length;
            const angleBadge = angleInfo ? ` &bull; <span style="color: #38bdf8;">${angleInfo}</span>` : '';
            const snapBadge = hit.snapLabel ? `<span style="color: #10b981;">${hit.snapLabel}</span> &bull; ` : '';

            if (hit.isClosing) {
                this._updateDOMBadge(
                    `Click to close (${count} pts)`,
                    { x: this.lastClientX || 0, y: this.lastClientY || 0 }
                );
            } else {
                const snapBadge = hit.snapLabel ? `${hit.snapLabel} &bull; ` : '';
                const angleBadge = angleInfo ? ` (${angleInfo})` : '';
                this._updateDOMBadge(
                    `${snapBadge}Pt ${count + 1}: ${segDistStr}${angleBadge}`,
                    { x: this.lastClientX || 0, y: this.lastClientY || 0 }
                );
            }

            if (this.ctx && typeof this.ctx.requestRender === 'function') {
                this.ctx.requestRender();
            }
            return true;
        }

        // 2. OPTION A: Box Mode (Click-Move-Click OR Click-Drag-Release)
        if (!this.drawing) {
            this.currentPoint = { x: hit.x, z: hit.z, y: hit.y, hitEntity: hit.hitEntity, snapType: hit.snapType };
            this.ghostGroup.visible = false;
            if (this.startAnchorGroup) this.startAnchorGroup.visible = false;
            const snapBadge = hit.snapLabel ? `${hit.snapLabel} &bull; ` : '';
            this._updateDOMBadge(
                `${snapBadge}Click 1st corner`,
                { x: this.lastClientX || 0, y: this.lastClientY || 0 }
            );
            if (this.ctx && typeof this.ctx.requestRender === 'function') {
                this.ctx.requestRender();
            }
            return true;
        }

        this.currentPoint = { x: hit.x, z: hit.z, y: hit.y, hitEntity: hit.hitEntity, snapType: hit.snapType };
        this._renderGhost();
        return true;
    }

    _pointInPolygon(pt, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    _getAutoRoofShape(hit) {
        const planner = this.getPlanner();
        const pt = { x: hit.x, y: hit.z };
        const cursorElev = hit.y !== undefined ? hit.y : this.getBaseRoofElevation();
        const params = this.getActiveRoofParams();
        const isCurvedPortal = params.roofType === 'curved_portal';
        let hitEntity = hit.hitEntity || this.lastHit?.hitEntity || this.startPoint?.hitEntity;

        if (isCurvedPortal && !hitEntity && planner?.walls) {
            // Find if cursor is directly on or close to any wall
            for (const w of planner.walls) {
                if (w.hidden || w.isAutoGable || w.parentRoofId) continue;
                const p1 = w.startAnchor?.position ? w.startAnchor.position() : { x: w.x1 || w.startX || 0, y: w.y1 || w.startY || 0 };
                const p2 = w.endAnchor?.position ? w.endAnchor.position() : { x: w.x2 || w.endX || 0, y: w.y2 || w.endY || 0 };
                const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
                if (l2 < 10) continue;
                const t = Math.max(0, Math.min(1, ((pt.x - p1.x) * (p2.x - p1.x) + (pt.y - p1.y) * (p2.y - p1.y)) / l2));
                const projX = p1.x + t * (p2.x - p1.x);
                const projY = p1.y + t * (p2.y - p1.y);
                const dist = Math.hypot(pt.x - projX, pt.y - projY);
                if (dist < (w.thickness || 15) + 20) {
                    hitEntity = w;
                    break;
                }
            }
        }

        // 0. Dedicated Wall-Attached Curved Portal Canopy Snapping
        if (isCurvedPortal && hitEntity && (hitEntity.startAnchor || hitEntity.x1 !== undefined)) {
            const hitW = hitEntity;
            const p1 = hitW.startAnchor?.position ? hitW.startAnchor.position() : { x: hitW.x1 || hitW.startX || 0, y: hitW.y1 || hitW.startY || 0 };
            const p2 = hitW.endAnchor?.position ? hitW.endAnchor.position() : { x: hitW.x2 || hitW.endX || 0, y: hitW.y2 || hitW.endY || 0 };
            const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);

            if (len > 10) {
                const ux = (p2.x - p1.x) / len;
                const uy = (p2.y - p1.y) / len;
                let nx = -uy;
                let ny = ux;

                // Outward normal detection using camera line of sight
                const camPos = this.ctx?.camera?.position;
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                if (camPos) {
                    const toCamX = camPos.x - midX;
                    const toCamZ = camPos.z - midY;
                    if (toCamX * nx + toCamZ * ny < 0) {
                        nx = -nx;
                        ny = -ny;
                    }
                } else if ((pt.x - midX) * nx + (pt.y - midY) * ny < 0) {
                    nx = -nx;
                    ny = -ny;
                }

                const depth = 180; // Standard modern portal canopy depth (cm)
                const wallBaseY = hitW.elevation || 0;
                const wallH = hitW.height !== undefined ? hitW.height : (hitW.config?.height || 120);
                const topElev = wallBaseY + wallH;
                const wallThick = hitW.thickness !== undefined ? hitW.thickness : (hitW.config?.thickness || 15);

                const poly = [
                    { x: Math.round(p1.x), y: Math.round(p1.y) },
                    { x: Math.round(p2.x), y: Math.round(p2.y) },
                    { x: Math.round(p2.x + depth * nx), y: Math.round(p2.y + depth * ny) },
                    { x: Math.round(p1.x + depth * nx), y: Math.round(p1.y + depth * ny) }
                ];

                return {
                    points: poly,
                    type: 'wall_attached',
                    width: Math.round(len),
                    depth: depth,
                    elevation: topElev,
                    connectedWall: hitW,
                    connectedWallId: hitW.id,
                    thickness: wallThick,
                    wallSides: { left: false, right: true, front: false, back: false }
                };
            }
        }

        // Helper to compute polygon area
        const getPolyArea = (poly) => {
            let area = 0;
            for (let i = 0; i < poly.length; i++) {
                const j = (i + 1) % poly.length;
                area += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
            }
            return Math.abs(area / 2);
        };

        // Helper to compute top elevation of a room polygon from planner walls
        const getRoomTopElevation = (poly) => {
            let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity;
            poly.forEach(p => {
                rMinX = Math.min(rMinX, p.x); rMaxX = Math.max(rMaxX, p.x);
                rMinY = Math.min(rMinY, p.y); rMaxY = Math.max(rMaxY, p.y);
            });

            let topY = 120;
            if (planner.walls && planner.walls.length > 0) {
                const boundaryWalls = planner.walls.filter(w => {
                    const p1 = w.startAnchor?.position ? w.startAnchor.position() : { x: w.x1 || 0, y: w.y1 || 0 };
                    const p2 = w.endAnchor?.position ? w.endAnchor.position() : { x: w.x2 || 0, y: w.y2 || 0 };
                    return (p1.x >= rMinX - 15 && p1.x <= rMaxX + 15 && p1.y >= rMinY - 15 && p1.y <= rMaxY + 15) ||
                           (p2.x >= rMinX - 15 && p2.x <= rMaxX + 15 && p2.y >= rMinY - 15 && p2.y <= rMaxY + 15);
                });
                if (boundaryWalls.length > 0) {
                    topY = Math.max(...boundaryWalls.map(w => (w.elevation || 0) + (w.height !== undefined ? w.height : (w.config?.height || 120))));
                }
            }
            return topY;
        };

        // 1. Collect all matching candidate rooms (from roomPaths or planner.rooms)
        const candidates = [];
        if (planner && planner.roomPaths && planner.roomPaths.length > 0) {
            for (const path of planner.roomPaths) {
                if (path && path.length >= 3) {
                    let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity;
                    path.forEach(p => {
                        rMinX = Math.min(rMinX, p.x); rMaxX = Math.max(rMaxX, p.x);
                        rMinY = Math.min(rMinY, p.y); rMaxY = Math.max(rMaxY, p.y);
                    });

                    const isInside = this._pointInPolygon(pt, path);
                    const isNear = (pt.x >= rMinX - 25 && pt.x <= rMaxX + 25 && pt.y >= rMinY - 25 && pt.y <= rMaxY + 25);

                    if (isInside || isNear) {
                        const topElevation = getRoomTopElevation(path);
                        const area = getPolyArea(path);
                        candidates.push({
                            points: path.map(p => ({ x: p.x, y: p.y })),
                            type: 'room',
                            width: rMaxX - rMinX,
                            depth: rMaxY - rMinY,
                            elevation: topElevation,
                            area: area,
                            isDirectInside: isInside,
                            elevDiff: Math.abs(topElevation - cursorElev)
                        });
                    }
                }
            }
        }

        // 2. Check if hovering over a specific wall or upper-level connected wall loop
        if (hit.hitEntity && planner.walls) {
            const hitW = hit.hitEntity;
            const hitWallElev = (hitW.elevation || 0);
            const hitWallTop = hitWallElev + (hitW.height || 120);

            // Find all walls at the same elevation level connected to this wall
            const levelWalls = planner.walls.filter(w => Math.abs((w.elevation || 0) - hitWallElev) < 10);
            if (levelWalls.length >= 3) {
                let wMinX = Infinity, wMaxX = -Infinity, wMinY = Infinity, wMaxY = -Infinity;
                levelWalls.forEach(w => {
                    const p1 = w.startAnchor?.position ? w.startAnchor.position() : { x: w.x1 || 0, y: w.y1 || 0 };
                    const p2 = w.endAnchor?.position ? w.endAnchor.position() : { x: w.x2 || 0, y: w.y2 || 0 };
                    wMinX = Math.min(wMinX, p1.x, p2.x); wMaxX = Math.max(wMaxX, p1.x, p2.x);
                    wMinY = Math.min(wMinY, p1.y, p2.y); wMaxY = Math.max(wMaxY, p1.y, p2.y);
                });

                if (pt.x >= wMinX - 30 && pt.x <= wMaxX + 30 && pt.y >= wMinY - 30 && pt.y <= wMaxY + 30) {
                    const width = wMaxX - wMinX;
                    const depth = wMaxY - wMinY;
                    candidates.push({
                        points: [
                            { x: wMinX, y: wMinY },
                            { x: wMaxX, y: wMinY },
                            { x: wMaxX, y: wMaxY },
                            { x: wMinX, y: wMaxY }
                        ],
                        type: 'room',
                        width: width,
                        depth: depth,
                        elevation: hitWallTop,
                        area: width * depth,
                        isDirectInside: true,
                        elevDiff: Math.abs(hitWallTop - cursorElev)
                    });
                }
            }
        }

        // If we found candidates, sort by:
        // A) Elevation closeness (matching cursor height in 3D)
        // B) Direct inside vs near
        // C) Smallest area (most specific room, preventing parent room from stealing 2nd floor dormer)
        if (candidates.length > 0) {
            candidates.sort((a, b) => {
                if (Math.abs(a.elevDiff - b.elevDiff) > 20) {
                    return a.elevDiff - b.elevDiff;
                }
                if (a.isDirectInside !== b.isDirectInside) {
                    return a.isDirectInside ? -1 : 1;
                }
                return a.area - b.area;
            });

            return candidates[0];
        }

        // 3. Fallback: Whole building bounding box (only if no room matches)
        if (planner && planner.walls && planner.walls.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            let maxTopY = 120;
            planner.walls.forEach(w => {
                const p1 = w.startAnchor?.position ? w.startAnchor.position() : (w.p1 || { x: w.x1 || 0, y: w.y1 || 0 });
                const p2 = w.endAnchor?.position ? w.endAnchor.position() : (w.p2 || { x: w.x2 || 0, y: w.y2 || 0 });
                const topY = (w.elevation || 0) + (w.height !== undefined ? w.height : (w.config?.height || 120));
                if (topY > maxTopY) maxTopY = topY;
                minX = Math.min(minX, p1.x, p2.x); maxX = Math.max(maxX, p1.x, p2.x);
                minY = Math.min(minY, p1.y, p2.y); maxY = Math.max(maxY, p1.y, p2.y);
            });
            if (minX !== Infinity && maxX !== -Infinity) {
                if (pt.x >= minX - 60 && pt.x <= maxX + 60 && pt.y >= minY - 60 && pt.y <= maxY + 60) {
                    return {
                        points: [
                            { x: minX, y: minY },
                            { x: maxX, y: minY },
                            { x: maxX, y: maxY },
                            { x: minX, y: maxY }
                        ],
                        type: 'building',
                        width: maxX - minX,
                        depth: maxY - minY,
                        elevation: maxTopY
                    };
                }
            }
        }

        // 4. Default proportional stamp centered at cursor
        const hw = 100, hd = 75;
        return {
            points: [
                { x: hit.x - hw, y: hit.z - hd },
                { x: hit.x + hw, y: hit.z - hd },
                { x: hit.x + hw, y: hit.z + hd },
                { x: hit.x - hw, y: hit.z + hd }
            ],
            type: 'custom',
            width: 200,
            depth: 150,
            elevation: hit.y
        };
    }

    onPointerUp(e) {
        if (!this.isPlacementTool()) return false;
        if (e.button !== 0) return false;

        // In polygon mode, clicks add vertices; onPointerUp doesn't finish the shape
        if (this.drawMode === 'polygon') {
            return true;
        }

        if (!this.drawing || !this.startPoint) return false;

        const p1 = this.startPoint;
        const p2 = this.currentPoint || { x: p1.x, z: p1.z, y: p1.y };
        const dragDist = Math.hypot(p2.x - p1.x, p2.z - p1.z);

        if (dragDist < 15) {
            // User performed a single click (Corner 1).
            // Do NOT commit! Keep this.drawing = true for Click-Move-Click CAD workflow.
            // Move cursor to expand the box, then click Corner 2 to confirm the exact area.
            if (this.ctx.controls) this.ctx.controls.enabled = false;
            return true;
        }

        // Drag release with distance >= 15: Commit the exact drawn rectangle!
        e.preventDefault();
        e.stopPropagation();

        this.drawing = false;
        if (this.ctx.controls) this.ctx.controls.enabled = true;

        let minX = Math.min(p1.x, p2.x);
        let maxX = Math.max(p1.x, p2.x);
        let minZ = Math.min(p1.z, p2.z);
        let maxZ = Math.max(p1.z, p2.z);

        const w = maxX - minX;
        const d = maxZ - minZ;

        const roofPoints = [
            { x: minX, y: minZ },
            { x: minX + w, y: minZ },
            { x: minX + w, y: minZ + d },
            { x: minX, y: minZ + d }
        ];
        const roofElevation = p1.y;
        const extraConfig = {};
        if (p1.hitEntity?.id) extraConfig.connectedWallId = p1.hitEntity.id;

        this.startPoint = null;
        this.currentPoint = null;
        if (this.startAnchorGroup) this.startAnchorGroup.visible = false;
        this.hideGhost();
        this._commitRoof(roofPoints, roofElevation, extraConfig);
        return true;
    }

    _commitRoof(points, elevation, extraConfig = {}) {
        const planner = this.getPlanner();
        if (!planner) return;

        const params = this.getActiveRoofParams();
        const roofElev = elevation !== undefined ? elevation : this.getBaseRoofElevation();
        const isCurvedPortal = params.roofType === 'curved_portal';
        const isFlat = params.roofType === 'flat';
        const defaultThickness = (isCurvedPortal || isFlat) ? (extraConfig.thickness || params.thick || 15) : (params.thick !== undefined ? params.thick : 10);
        const defaultOverhang = (isCurvedPortal || isFlat) ? 0 : (params.overhang !== undefined ? params.overhang : 8);

        planner.executeWithSnapshot(() => {
            const roofConfig = {
                roofType: params.roofType || 'gable',
                pitch: params.pitch !== undefined ? params.pitch : 30,
                curve: params.curve !== undefined ? params.curve : 0,
                radius: params.radius !== undefined ? params.radius : 0,
                wallSides: extraConfig.wallSides || (params.wallSides ? { ...params.wallSides } : undefined),
                wallDropHeight: params.wallDropHeight !== undefined ? params.wallDropHeight : undefined,
                hasSpotlights: params.hasSpotlights !== undefined ? params.hasSpotlights : undefined,
                material: params.material,
                overhang: defaultOverhang,
                thickness: defaultThickness,
                connectedWallId: extraConfig.connectedWallId || undefined
            };

            const newRoof = RoofEngine.createRoof(planner, points, roofConfig, {
                elevation: roofElev
            });

            if (this.ctx.buildScene) {
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
                    true,
                    planner.outdoorZones || []
                );
            }

            planner.selectEntity(newRoof, 'roof');
            if (newRoof.mesh3D && this.interactions) {
                const targetMesh = newRoof.mesh3D.children.find(c => c.userData?.isRoof) || newRoof.mesh3D;
                this.interactions.selectObject(targetMesh, null, true);
            }
        });
    }

    finishPolygon() {
        if (!this.polygonPoints || this.polygonPoints.length < 3) return;

        const points2D = this.polygonPoints.map(p => ({ x: Math.round(p.x), y: Math.round(p.z) }));
        const baseElevation = this.polygonElevation !== null ? this.polygonElevation : (this.polygonPoints[0].y || this.getBaseRoofElevation());

        const extraConfig = {};
        if (this.polygonPoints[0].hitEntity?.id) {
            extraConfig.connectedWallId = this.polygonPoints[0].hitEntity.id;
        }

        this._commitRoof(points2D, baseElevation, extraConfig);
        this.resetPolygon();
        this.hideGhost();
    }

    resetPolygon() {
        this.polygonPoints = [];
        this.polygonElevation = null;
        this._clearPolygonVisuals();
        if (this.ctx.controls) this.ctx.controls.enabled = true;
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    _clearPolygonVisuals() {
        if (this.polygonMarkersGroup) {
            while (this.polygonMarkersGroup.children.length > 0) {
                const c = this.polygonMarkersGroup.children[0];
                this.polygonMarkersGroup.remove(c);
                if (c.geometry) c.geometry.dispose();
                if (c.children) {
                    c.children.forEach(ch => { if (ch.geometry) ch.geometry.dispose(); });
                }
            }
            this.polygonMarkersGroup.visible = false;
        }
        if (this.polygonLineGroup) {
            while (this.polygonLineGroup.children.length > 0) {
                const c = this.polygonLineGroup.children[0];
                this.polygonLineGroup.remove(c);
                if (c.geometry) c.geometry.dispose();
            }
            this.polygonLineGroup.visible = false;
        }
    }

    _updatePolygonVisuals(currentPt = null) {
        if (!this.polygonMarkersGroup || !this.polygonLineGroup) return;

        this._clearPolygonVisuals();
        if (this.polygonPoints.length === 0) return;

        const elev = this.polygonElevation !== null ? this.polygonElevation : (this.polygonPoints[0].y || 0);

        // 1. Rebuild Placed Vertex Markers
        this.polygonPoints.forEach((p, idx) => {
            const isStart = idx === 0;
            const markerGroup = new THREE.Group();
            markerGroup.position.set(p.x, elev + 0.8, p.z);
            markerGroup.raycast = () => {};

            const ringGeo = new THREE.RingGeometry(isStart ? 6 : 4.5, isStart ? 9.5 : 7.5, 32);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({
                color: isStart ? 0x10b981 : 0x06b6d4,
                depthTest: false,
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.renderOrder = 10004;
            ringMesh.raycast = () => {};
            markerGroup.add(ringMesh);

            const dotGeo = new THREE.CircleGeometry(isStart ? 4.5 : 3.5, 32);
            dotGeo.rotateX(-Math.PI / 2);
            const dotMat = new THREE.MeshBasicMaterial({
                color: isStart ? 0x059669 : 0x0284c7,
                depthTest: false,
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide
            });
            const dotMesh = new THREE.Mesh(dotGeo, dotMat);
            dotMesh.renderOrder = 10005;
            dotMesh.raycast = () => {};
            markerGroup.add(dotMesh);

            this.polygonMarkersGroup.add(markerGroup);
        });
        this.polygonMarkersGroup.visible = true;

        // 2. Rebuild Perimeter Lines
        const linePoints = this.polygonPoints.map(p => new THREE.Vector3(p.x, elev + 0.5, p.z));

        if (currentPt) {
            linePoints.push(new THREE.Vector3(currentPt.x, elev + 0.5, currentPt.z));
        }

        if (linePoints.length >= 2) {
            const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
            const lineMat = new THREE.LineBasicMaterial({
                color: 0x00f0ff,
                linewidth: 3,
                depthTest: false,
                transparent: true,
                opacity: 0.95
            });
            const line = new THREE.Line(lineGeo, lineMat);
            line.renderOrder = 10001;
            line.raycast = () => {};
            this.polygonLineGroup.add(line);

            // Closing guide line from currentPt to start vertex if >= 2 points
            if (this.polygonPoints.length >= 2 && currentPt) {
                const closeGuidePoints = [
                    new THREE.Vector3(currentPt.x, elev + 0.5, currentPt.z),
                    new THREE.Vector3(this.polygonPoints[0].x, elev + 0.5, this.polygonPoints[0].z)
                ];
                const closeGeo = new THREE.BufferGeometry().setFromPoints(closeGuidePoints);
                const closeMat = new THREE.LineDashedMaterial({
                    color: 0x38bdf8,
                    dashSize: 8,
                    gapSize: 4,
                    linewidth: 2,
                    depthTest: false,
                    transparent: true,
                    opacity: 0.75
                });
                const closeLine = new THREE.Line(closeGeo, closeMat);
                closeLine.computeLineDistances();
                closeLine.renderOrder = 10000;
                closeLine.raycast = () => {};
                this.polygonLineGroup.add(closeLine);
            }
        }
        this.polygonLineGroup.visible = true;
    }

    _renderGhost() {
        if (!this.startPoint || !this.currentPoint) return;

        const p1 = this.startPoint;
        const p2 = this.currentPoint;

        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minZ = Math.min(p1.z, p2.z);
        const maxZ = Math.max(p1.z, p2.z);

        const w = Math.max(8, maxX - minX);
        const d = Math.max(8, maxZ - minZ);

        const points = [
            { x: minX, y: minZ },
            { x: minX + w, y: minZ },
            { x: minX + w, y: minZ + d },
            { x: minX, y: minZ + d }
        ];

        this._buildGhost3DMesh(points, p1.y);

        const snapBadge = this.lastHit?.snapLabel ? `${this.lastHit.snapLabel} &bull; ` : '';
        this._updateDOMBadge(
            `${snapBadge}${this._formatFeetInches(w)} &times; ${this._formatFeetInches(d)}`,
            { x: this.lastClientX || 0, y: this.lastClientY || 0 }
        );

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    _renderGhostStamp(hit) {
        const autoShape = this._getAutoRoofShape(hit);
        if (!autoShape || !autoShape.points || autoShape.points.length < 3) {
            this.hideGhost();
            return;
        }

        const roofElev = autoShape.elevation !== undefined ? autoShape.elevation : hit.y;
        this._buildGhost3DMesh(autoShape.points, roofElev, true);

        const dimStr = `${this._formatFeetInches(autoShape.width)} \u00d7 ${this._formatFeetInches(autoShape.depth)}`;
        this._updateDOMBadge(
            dimStr,
            { x: this.lastClientX || 0, y: this.lastClientY || 0 }
        );

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    _buildGhost3DMesh(points, elevation, isRoomSnap = false) {
        while (this.ghostGroup.children.length > 0) {
            const child = this.ghostGroup.children[0];
            this.ghostGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        if (!points || points.length < 3) return;

        const glowColor = isRoomSnap ? 0x10b981 : 0x00f0ff;
        const fillColor = isRoomSnap ? 0x059669 : 0x0284c7;

        // 1. Glowing Footprint Perimeter Outline
        const outlinePoints = points.map(p => new THREE.Vector3(p.x, elevation + 0.6, p.y));
        outlinePoints.push(outlinePoints[0].clone()); // Close loop
        const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints);
        const outlineMat = new THREE.LineBasicMaterial({
            color: glowColor,
            linewidth: 3,
            transparent: true,
            opacity: 0.95,
            depthTest: false
        });
        const outlineLine = new THREE.Line(outlineGeo, outlineMat);
        outlineLine.raycast = () => {};
        outlineLine.renderOrder = 999;
        this.ghostGroup.add(outlineLine);

        // 2. Translucent Glowing Ceiling / Footprint Plane (Direct 3D triangulation matching outline)
        try {
            const flatPoints = points.map(p => new THREE.Vector2(p.x, p.y));
            const triangles = THREE.ShapeUtils.triangulateShape(flatPoints, []);

            const positions = [];
            for (const tri of triangles) {
                for (const idx of tri) {
                    const p = points[idx];
                    positions.push(p.x, elevation + 0.4, p.y);
                }
            }

            if (positions.length >= 9) {
                const fillGeo = new THREE.BufferGeometry();
                fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                fillGeo.computeVertexNormals();

                const fillMat = new THREE.MeshBasicMaterial({
                    color: fillColor,
                    transparent: true,
                    opacity: 0.28,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                    depthTest: false
                });
                const fillMesh = new THREE.Mesh(fillGeo, fillMat);
                fillMesh.raycast = () => {};
                fillMesh.renderOrder = 998;
                this.ghostGroup.add(fillMesh);
            }
        } catch (err) {}

        // 3. Corner Snap Diamond Indicators
        const diamondGeo = new THREE.OctahedronGeometry(2.4);
        const diamondMat = new THREE.MeshBasicMaterial({
            color: isRoomSnap ? 0x34d399 : 0xfbbf24,
            depthTest: false
        });
        points.forEach(p => {
            const diamond = new THREE.Mesh(diamondGeo, diamondMat);
            diamond.position.set(p.x, elevation + 1.2, p.y);
            diamond.raycast = () => {};
            diamond.renderOrder = 1000;
            this.ghostGroup.add(diamond);
        });

        // 4. Ghost 3D Extruded Roof Mesh
        const params = this.getActiveRoofParams();
        const dummyRoof = {
            points,
            config: {
                roofType: params.roofType,
                pitch: params.pitch,
                curve: params.curve,
                radius: params.radius,
                wallSides: params.wallSides,
                wallDropHeight: params.wallDropHeight,
                hasSpotlights: params.hasSpotlights,
                material: params.material,
                overhang: params.overhang,
                thickness: params.thick
            },
            elevation: elevation
        };

        try {
            const builder = new Roof3DBuilder(this.ctx);
            builder.buildRoofs([dummyRoof], 0, false, this.ghostGroup);

            this.ghostGroup.traverse(child => {
                if (child.isMesh && child !== outlineLine) {
                    child.raycast = () => {};
                    if (child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach(m => {
                            m.transparent = true;
                            m.opacity = 0.72;
                        });
                    }
                }
            });
        } catch (e) {}
    }

    hideGhost() {
        this.drawing = false;
        this.startPoint = null;
        this.currentPoint = null;
        this.ghostGroup.visible = false;
        if (this.snapIndicatorGroup) this.snapIndicatorGroup.visible = false;
        if (this.startAnchorGroup) this.startAnchorGroup.visible = false;
        if (this.snapHaloGroup) this.snapHaloGroup.visible = false;
        this._clearPolygonVisuals();
        while (this.ghostGroup.children.length > 0) {
            const c = this.ghostGroup.children[0];
            if (c.geometry) c.geometry.dispose();
            this.ghostGroup.remove(c);
        }
        this._hideDOMBadge();
        if (!this.isPlacementTool()) {
            this._hideModeHUD();
        }
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    _onKeyDown(e) {
        if (!this.isPlacementTool()) return;

        if (e.key === 'p' || e.key === 'P' || e.key === 'm' || e.key === 'M') {
            const nextMode = this.drawMode === 'polygon' ? 'box' : 'polygon';
            this.setDrawMode(nextMode);
            return;
        }

        if (e.key === 'Enter' || e.key === ' ') {
            if (this.drawMode === 'polygon' && this.polygonPoints.length >= 3) {
                e.preventDefault();
                this.finishPolygon();
                return;
            }
        }

        if (e.key === 'Backspace' || e.key === 'Delete') {
            if (this.drawMode === 'polygon' && this.polygonPoints.length > 0) {
                e.preventDefault();
                this.polygonPoints.pop();
                if (this.polygonPoints.length === 0) {
                    this.resetPolygon();
                } else {
                    this._updatePolygonVisuals();
                }
                if (this.ctx && typeof this.ctx.requestRender === 'function') {
                    this.ctx.requestRender();
                }
                return;
            }
        }

        if (e.key === 'Escape') {
            if (this.drawing) {
                this.drawing = false;
                this.startPoint = null;
                this.currentPoint = null;
                if (this.startAnchorGroup) this.startAnchorGroup.visible = false;
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                this.hideGhost();
                this._hideDOMBadge();
                return;
            }
            if (this.drawMode === 'polygon' && this.polygonPoints.length > 0) {
                this.resetPolygon();
                this.hideGhost();
                this._hideDOMBadge();
                return;
            }
            this.hideGhost();
            this._hideDOMBadge();
            this._hideModeHUD();
            const planner = this.getPlanner();
            if (planner) {
                planner.tool = 'select';
                planner.updateToolStates();
                if (planner.onToolChange) planner.onToolChange('select');
            }
        }
    }

    dispose() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this._onKeyDown);
        }
        if (this.domBadge && this.domBadge.parentElement) {
            this.domBadge.parentElement.removeChild(this.domBadge);
        }
        if (this.modeHUD && this.modeHUD.parentElement) {
            this.modeHUD.parentElement.removeChild(this.modeHUD);
        }
        if (this.snapIndicatorGroup && this.snapIndicatorGroup.parent) {
            this.snapIndicatorGroup.parent.remove(this.snapIndicatorGroup);
        }
        if (this.startAnchorGroup && this.startAnchorGroup.parent) {
            this.startAnchorGroup.parent.remove(this.startAnchorGroup);
        }
        if (this.snapHaloGroup && this.snapHaloGroup.parent) {
            this.snapHaloGroup.parent.remove(this.snapHaloGroup);
        }
        if (this.polygonMarkersGroup && this.polygonMarkersGroup.parent) {
            this.polygonMarkersGroup.parent.remove(this.polygonMarkersGroup);
        }
        if (this.polygonLineGroup && this.polygonLineGroup.parent) {
            this.polygonLineGroup.parent.remove(this.polygonLineGroup);
        }
        this.hideGhost();
    }
}

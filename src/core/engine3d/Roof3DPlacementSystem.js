import * as THREE from 'three';
import { SNAP_DIST, ROOF_DECOR_REGISTRY, WALL_DECOR_REGISTRY } from '../registry.js';
import { PremiumHipRoof } from '../../features/roof/roof.renderer2d.js';
import { Roof3DBuilder } from '../../features/roof/builders/Roof3DBuilder.js';

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

        // Grid Snap Plane (XZ)
        this.placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        this._createDOMBadge();

        this._onKeyDown = this._onKeyDown.bind(this);
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', this._onKeyDown);
        }
    }

    _createDOMBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'roof3d-live-dimension-badge';
        this.domBadge.style.cssText = `
            position: absolute;
            display: none;
            pointer-events: none;
            transform: translate(-50%, -100%);
            padding: 7px 16px;
            border-radius: 20px;
            background: rgba(15, 23, 42, 0.94);
            border: 2px solid #38bdf8;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(56, 189, 248, 0.35);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.5px;
            white-space: nowrap;
            z-index: 9999;
            backdrop-filter: blur(10px);
            user-select: none;
            transition: border-color 0.12s ease, color 0.12s ease;
        `;
        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domBadge);
    }

    _updateDOMBadge(text, screenPos) {
        if (!this.domBadge) return;
        if (!text || !screenPos) {
            this.domBadge.style.display = 'none';
            return;
        }
        this.domBadge.innerHTML = text;
        this.domBadge.style.left = `${screenPos.x}px`;
        this.domBadge.style.top = `${screenPos.y - 18}px`;
        this.domBadge.style.display = 'block';
    }

    _hideDOMBadge() {
        if (this.domBadge) this.domBadge.style.display = 'none';
    }

    getPlanner() {
        return this.ctx.planner || window.planner?.value || window.planner || (this.ctx.appState && this.ctx.appState.planner) || window.plannerInstance;
    }

    isPlacementTool() {
        const planner = this.getPlanner();
        const tool = planner?.tool;
        if (!tool) return false;
        return tool === 'roof' || tool.startsWith('roof_') || tool === 'roof_presets';
    }

    getActiveRoofParams() {
        const planner = this.getPlanner();
        const presetParams = planner?.activePresetParams || {};
        return {
            roofType: presetParams.roofType || 'gable',
            pitch: presetParams.pitch !== undefined ? presetParams.pitch : 30,
            curve: presetParams.curve !== undefined ? presetParams.curve : (presetParams.roofType === 'curved' ? -20 : 0),
            material: presetParams.material || 'terracotta_tiles_roof',
            overhang: presetParams.overhang !== undefined ? presetParams.overhang : 8,
            thick: presetParams.thick || 15
        };
    }

    getBaseRoofElevation() {
        const planner = this.getPlanner();
        let maxH = 120;
        if (planner && planner.walls && planner.walls.length > 0) {
            planner.walls.forEach(w => {
                const h = Number(w.height !== undefined ? w.height : (w.config?.height || 120));
                if (h > maxH) maxH = h;
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

    _getRaycastIntersection(e) {
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        const roofH = this.getBaseRoofElevation();
        this.placementPlane.constant = -roofH;

        const planePt = new THREE.Vector3();
        const hitPlane = this.raycaster.ray.intersectPlane(this.placementPlane, planePt);

        if (hitPlane) {
            // Snap to 10px architectural grid
            const snap = 10;
            const sx = Math.round(planePt.x / snap) * snap;
            const sz = Math.round(planePt.z / snap) * snap;
            return { x: sx, y: roofH, z: sz, rawPoint: planePt };
        }

        return null;
    }

    onPointerDown(e) {
        if (!this.isPlacementTool()) return false;
        if (e.button !== 0) return false;

        const hit = this._getRaycastIntersection(e);
        if (!hit) return false;

        e.preventDefault();
        e.stopPropagation();

        this.drawing = true;
        this.startPoint = { x: hit.x, z: hit.z, y: hit.y };
        this.currentPoint = { x: hit.x, z: hit.z, y: hit.y };

        this.ghostGroup.visible = true;
        if (this.ctx.controls) this.ctx.controls.enabled = false;

        this._renderGhost();
        return true;
    }

    onPointerMove(e) {
        if (!this.isPlacementTool()) return false;
        const hit = this._getRaycastIntersection(e);
        if (!hit) return false;

        if (!this.drawing) {
            this.currentPoint = { x: hit.x, z: hit.z, y: hit.y };
            this.ghostGroup.visible = true;
            this._renderGhostStamp(hit);
            return true;
        }

        this.currentPoint = { x: hit.x, z: hit.z, y: hit.y };
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

        // 1. Check if hovering inside any closed room path
        if (planner && planner.roomPaths && planner.roomPaths.length > 0) {
            for (const path of planner.roomPaths) {
                if (path && path.length >= 3) {
                    if (this._pointInPolygon(pt, path)) {
                        let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity;
                        path.forEach(p => {
                            rMinX = Math.min(rMinX, p.x); rMaxX = Math.max(rMaxX, p.x);
                            rMinY = Math.min(rMinY, p.y); rMaxY = Math.max(rMaxY, p.y);
                        });
                        return {
                            points: path.map(p => ({ x: p.x, y: p.y })),
                            type: 'room',
                            width: rMaxX - rMinX,
                            depth: rMaxY - rMinY
                        };
                    }
                }
            }
        }

        // 2. Check if near any room's bounding box
        if (planner && planner.roomPaths && planner.roomPaths.length > 0) {
            for (const path of planner.roomPaths) {
                if (path && path.length >= 3) {
                    let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity;
                    path.forEach(p => {
                        rMinX = Math.min(rMinX, p.x); rMaxX = Math.max(rMaxX, p.x);
                        rMinY = Math.min(rMinY, p.y); rMaxY = Math.max(rMaxY, p.y);
                    });
                    if (pt.x >= rMinX - 30 && pt.x <= rMaxX + 30 && pt.y >= rMinY - 30 && pt.y <= rMaxY + 30) {
                        return {
                            points: path.map(p => ({ x: p.x, y: p.y })),
                            type: 'room',
                            width: rMaxX - rMinX,
                            depth: rMaxY - rMinY
                        };
                    }
                }
            }
        }

        // 3. Check if near the whole building (all walls bounding box)
        if (planner && planner.walls && planner.walls.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            planner.walls.forEach(w => {
                const p1 = w.startAnchor?.position ? w.startAnchor.position() : (w.p1 || { x: w.x1 || 0, y: w.y1 || 0 });
                const p2 = w.endAnchor?.position ? w.endAnchor.position() : (w.p2 || { x: w.x2 || 0, y: w.y2 || 0 });
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
                        depth: maxY - minY
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
            depth: 150
        };
    }

    onPointerUp(e) {
        if (!this.isPlacementTool() || !this.drawing) return false;
        if (e.button !== 0) return false;

        e.preventDefault();
        e.stopPropagation();

        this.drawing = false;
        if (this.ctx.controls) this.ctx.controls.enabled = true;

        const p1 = this.startPoint;
        const p2 = this.currentPoint;

        let minX = Math.min(p1.x, p2.x);
        let maxX = Math.max(p1.x, p2.x);
        let minZ = Math.min(p1.z, p2.z);
        let maxZ = Math.max(p1.z, p2.z);

        const w = maxX - minX;
        const d = maxZ - minZ;

        let roofPoints = [];
        if (w < 40 || d < 40) {
            const autoShape = this._getAutoRoofShape({ x: p1.x, z: p1.z });
            roofPoints = autoShape.points;
        } else {
            roofPoints = [
                { x: minX, y: minZ },
                { x: maxX, y: minZ },
                { x: maxX, y: maxZ },
                { x: minX, y: maxZ }
            ];
        }

        this._commitRoof(roofPoints);
        this.hideGhost();
        return true;
    }

    _commitRoof(points) {
        const planner = this.getPlanner();
        if (!planner) return;

        const params = this.getActiveRoofParams();
        planner.executeWithSnapshot(() => {
            if (!planner.roofs) planner.roofs = [];

            const newRoof = new PremiumHipRoof(planner, points);
            newRoof.elevation = this.getBaseRoofElevation();
            if (params.roofType) newRoof.config.roofType = params.roofType;
            if (params.pitch !== undefined) newRoof.config.pitch = params.pitch;
            if (params.curve !== undefined) newRoof.config.curve = params.curve;
            if (params.material) {
                newRoof.config.material = params.material;
                newRoof.configId = params.material;
            }
            if (params.overhang !== undefined) newRoof.config.overhang = params.overhang;
            if (params.thick !== undefined) newRoof.config.thickness = params.thick;
            if (newRoof.update) newRoof.update();

            planner.roofs.push(newRoof);

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
                this.interactions.selectObject(targetMesh);
            }

            planner.tool = 'select';
            planner.updateToolStates();
            if (planner.onToolChange) planner.onToolChange('select');
        });
    }

    _renderGhost() {
        if (!this.startPoint || !this.currentPoint) return;

        const p1 = this.startPoint;
        const p2 = this.currentPoint;

        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minZ = Math.min(p1.z, p2.z);
        const maxZ = Math.max(p1.z, p2.z);

        const w = Math.max(20, maxX - minX);
        const d = Math.max(20, maxZ - minZ);

        const points = [
            { x: minX, y: minZ },
            { x: maxX, y: minZ },
            { x: maxX, y: maxZ },
            { x: minX, y: maxZ }
        ];

        this._buildGhost3DMesh(points, p1.y);

        const params = this.getActiveRoofParams();
        const roofTypeName = params.roofType.toUpperCase();
        this._updateDOMBadge(
            `${roofTypeName} ROOF | ${this._formatFeetInches(w)} x ${this._formatFeetInches(d)} | ${params.pitch}&deg; Pitch`,
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

        this._buildGhost3DMesh(autoShape.points, hit.y);

        const params = this.getActiveRoofParams();
        const typeLabel = params.roofType.toUpperCase();
        const targetLabel = autoShape.type === 'room' ? 'Room' : (autoShape.type === 'building' ? 'Building' : 'Custom');
        const dimStr = `${this._formatFeetInches(autoShape.width)} \u00d7 ${this._formatFeetInches(autoShape.depth)}`;

        this._updateDOMBadge(
            `Click to snap ${typeLabel} Roof to ${targetLabel} (${dimStr}) | Drag to draw custom area`,
            { x: this.lastClientX || 0, y: this.lastClientY || 0 }
        );

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    _buildGhost3DMesh(points, elevation) {
        while (this.ghostGroup.children.length > 0) {
            const child = this.ghostGroup.children[0];
            this.ghostGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        const params = this.getActiveRoofParams();
        const dummyRoof = {
            points,
            config: {
                roofType: params.roofType,
                pitch: params.pitch,
                curve: params.curve,
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
                if (child.isMesh) {
                    child.raycast = () => {};
                    if (child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach(m => {
                            m.transparent = true;
                            m.opacity = 0.7;
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
        while (this.ghostGroup.children.length > 0) {
            const c = this.ghostGroup.children[0];
            if (c.geometry) c.geometry.dispose();
            this.ghostGroup.remove(c);
        }
        this._hideDOMBadge();
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    _onKeyDown(e) {
        if (e.key === 'Escape' && this.isPlacementTool()) {
            this.hideGhost();
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
        this.hideGhost();
    }
}

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

        return tool === 'roof' || tool === 'roof_presets' || tool.startsWith('roof_type_') || tool.startsWith('preset_roof_');
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

    _getRaycastIntersection(e) {
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        const planner = this.getPlanner();
        let targetElevation = this.getBaseRoofElevation();

        // 1. Direct 3D Raycasting against actual wall, floor slab, terrain, and roof meshes (Sims 4 Placement)
        const structureObjects = [];
        if (this.ctx.structureGroup) {
            this.ctx.structureGroup.traverse(child => {
                if (child.isMesh && child.userData && (
                    child.userData.isWallSide || 
                    child.userData.entity || 
                    child.userData.isRoof || 
                    child.userData.componentType === 'roof_top' ||
                    child.userData.isFloor ||
                    child.userData.isTerrain
                )) {
                    structureObjects.push(child);
                }
            });
        }

        if (structureObjects.length > 0) {
            const hits = this.raycaster.intersectObjects(structureObjects, false);
            if (hits.length > 0) {
                const hit = hits[0];
                let entity = hit.object.userData?.entity;
                if (!entity && hit.object.parent) entity = hit.object.parent.userData?.entity;

                if (entity && entity.startAnchor && entity.endAnchor) {
                    const wallBaseY = entity.elevation || 0;
                    const wallH = entity.height !== undefined ? entity.height : (entity.config?.height || 120);
                    targetElevation = wallBaseY + wallH;
                } else if (hit.point && hit.point.y !== undefined) {
                    targetElevation = Math.round(hit.point.y * 10) / 10;
                }

                // Project hit point onto horizontal plane at targetElevation
                this.placementPlane.constant = -targetElevation;
                const planePt = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.placementPlane, planePt)) {
                    // Check for wall anchor snap
                    let finalX = planePt.x;
                    let finalZ = planePt.z;
                    if (planner && planner.anchors) {
                        for (const anc of planner.anchors) {
                            const apos = typeof anc.position === 'function' ? anc.position() : anc;
                            if (Math.hypot(apos.x - planePt.x, apos.y - planePt.z) < 25) {
                                finalX = apos.x;
                                finalZ = apos.y;
                                break;
                            }
                        }
                    } else {
                        const snap = 10;
                        finalX = Math.round(planePt.x / snap) * snap;
                        finalZ = Math.round(planePt.z / snap) * snap;
                    }

                    return { x: finalX, y: targetElevation, z: finalZ, rawPoint: planePt, hitEntity: entity };
                }
            }
        }

        // 2. Fallback to Ground / Active Level Elevation Plane (y = 0 for flat ground roof)
        const groundElev = this.ctx?.activeLevelElevation || 0;
        this.placementPlane.constant = -groundElev;
        const planePt = new THREE.Vector3();
        const hitPlane = this.raycaster.ray.intersectPlane(this.placementPlane, planePt);

        if (hitPlane) {
            let finalX = planePt.x;
            let finalZ = planePt.z;
            if (planner && planner.anchors) {
                for (const anc of planner.anchors) {
                    const apos = typeof anc.position === 'function' ? anc.position() : anc;
                    if (Math.hypot(apos.x - planePt.x, apos.y - planePt.z) < 25) {
                        finalX = apos.x;
                        finalZ = apos.y;
                        break;
                    }
                }
            } else {
                const snap = 10;
                finalX = Math.round(planePt.x / snap) * snap;
                finalZ = Math.round(planePt.z / snap) * snap;
            }
            return { x: finalX, y: groundElev, z: finalZ, rawPoint: planePt };
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
        const cursorElev = hit.y !== undefined ? hit.y : this.getBaseRoofElevation();

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
        let roofElevation = p1.y;
        if (w < 40 || d < 40) {
            const autoShape = this._getAutoRoofShape({ x: p1.x, z: p1.z, y: p1.y });
            roofPoints = autoShape.points;
            if (autoShape.elevation !== undefined) roofElevation = autoShape.elevation;
        } else {
            roofPoints = [
                { x: minX, y: minZ },
                { x: maxX, y: minZ },
                { x: maxX, y: maxZ },
                { x: minX, y: maxZ }
            ];
        }

        this._commitRoof(roofPoints, roofElevation);
        this.hideGhost();
        return true;
    }

    _commitRoof(points, elevation) {
        const planner = this.getPlanner();
        if (!planner) return;

        const params = this.getActiveRoofParams();
        const roofElev = elevation !== undefined ? elevation : this.getBaseRoofElevation();

        planner.executeWithSnapshot(() => {
            if (!planner.roofs) planner.roofs = [];

            const newRoof = new PremiumHipRoof(planner, points);
            newRoof.elevation = roofElev;
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

        const roofElev = autoShape.elevation !== undefined ? autoShape.elevation : hit.y;
        this._buildGhost3DMesh(autoShape.points, roofElev, true);

        const params = this.getActiveRoofParams();
        const typeLabel = params.roofType.toUpperCase();
        const isGround = (roofElev <= 5);
        const targetLabel = isGround ? 'FLAT GROUND' : (autoShape.type === 'room' ? 'ROOM' : (autoShape.type === 'building' ? 'BUILDING' : 'CUSTOM'));
        const dimStr = `${this._formatFeetInches(autoShape.width)} \u00d7 ${this._formatFeetInches(autoShape.depth)}`;
        const icon = isGround ? '🏕️' : '🏠';
        const color = isGround ? '#38bdf8' : '#34d399';

        this._updateDOMBadge(
            `<span style="color: ${color};">${icon} ${targetLabel}</span> &bull; ${typeLabel} ROOF (${params.pitch}&deg;) &bull; ${dimStr}`,
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

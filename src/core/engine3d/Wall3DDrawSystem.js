import * as THREE from 'three';
import { WALL_REGISTRY, SNAP_DIST } from '../registry.js';
import { WallFactory } from '../../features/wall/wall.factory.js';
import { Railing } from '../../features/railing/objects/Railing.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { PremiumOutdoorZone, OUTDOOR_ZONE_TYPES } from '../engine2d/PremiumOutdoorZone.js';
import { computeCorridorPolygon } from '../engine2d/corridorUtils.js';
import { DEFAULT_UNIVERSAL_TILE_SIZE } from '../registries/material.registry.js';
import { WallReformer } from '../engine2d/WallReformer.js';
import { coreEventBus } from '../EventBus.js';
import { EVENTS } from '../constants/events.js';

/**
 * Wall3DDrawSystem
 * 
 * Enables direct Sims 4-style 3D Wall and Room Box drawing in the 3D scene.
 * Features:
 * - Direct 3D wall mesh raycasting
 * - Midpoint (50%) & Quarter-point Snap with Amber Diamond indicator
 * - Smart Orthogonal & Parallel Corner Alignment Guides (Inference Lines to form perfect squares/rectangles)
 * - Native DOM Floating Vector Badge (100% Crisp, zero blurriness at any zoom distance)
 * - Dynamic Camera-Distance-Aware 3D Sprite
 * - 45° / Orthogonal Alignment Guide Lines
 * - Real-time 3D Snap Halos & Dimension Badges
 */
export class Wall3DDrawSystem {
    constructor(ctx, interactionSystem) {
        this.ctx = ctx;
        this.interactions = interactionSystem;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.drawing = false;
        this.startAnchor = null;
        this.lastAnchor = null;
        this.startPoint = null;
        this.currentSessionEntities = [];
        this._snapshotCmd = null;
        this.hoveredWallMesh = null;
        this.activeSnapWall = null;
        
        // Ghost Preview Container in 3D Scene
        this.ghostGroup = new THREE.Group();
        this.ghostGroup.name = 'Wall3DDraw_GhostGroup';
        this.ghostGroup.visible = false;
        this.ctx.scene.add(this.ghostGroup);
        
        // Snap Indicator Mesh (Outer ring + Inner glowing dot / diamond)
        this.snapIndicatorGroup = new THREE.Group();
        this.snapIndicatorGroup.visible = false;
        
        const outerRingGeo = new THREE.RingGeometry(8, 13, 32);
        outerRingGeo.rotateX(-Math.PI / 2);
        this.snapRing = new THREE.Mesh(
            outerRingGeo,
            new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
        );
        this.snapRing.renderOrder = 1002;
        this.snapIndicatorGroup.add(this.snapRing);

        const innerDotGeo = new THREE.CircleGeometry(4.5, 32);
        innerDotGeo.rotateX(-Math.PI / 2);
        this.snapDot = new THREE.Mesh(
            innerDotGeo,
            new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
        );
        this.snapDot.renderOrder = 1003;
        this.snapIndicatorGroup.add(this.snapDot);

        // Midpoint Amber Diamond Indicator
        const diamondShape = new THREE.Shape();
        diamondShape.moveTo(0, 8);
        diamondShape.lineTo(8, 0);
        diamondShape.lineTo(0, -8);
        diamondShape.lineTo(-8, 0);
        diamondShape.closePath();
        const diamondGeo = new THREE.ShapeGeometry(diamondShape);
        diamondGeo.rotateX(-Math.PI / 2);
        this.snapDiamond = new THREE.Mesh(
            diamondGeo,
            new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
        );
        this.snapDiamond.renderOrder = 1003;
        this.snapDiamond.visible = false;
        this.snapIndicatorGroup.add(this.snapDiamond);

        this.ghostGroup.add(this.snapIndicatorGroup);

        // Wall Snap Halo Group (Highlights existing wall(s) when snapped)
        this.snapHaloGroup = new THREE.Group();
        this.snapHaloGroup.visible = false;
        this.ghostGroup.add(this.snapHaloGroup);

        this.haloMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.35,
            depthTest: false,
            side: THREE.DoubleSide
        });

        this.haloEdgeMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            linewidth: 3,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });

        this.snapHalos = [];
        for (let i = 0; i < 6; i++) {
            this.snapHalos.push(this._createSnapHaloMesh());
        }
        this.snapHalos.forEach(h => this.snapHaloGroup.add(h));

        // 45° / 90° Wall Direction Guide Line
        const guideGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 0)
        ]);
        this.guideLine = new THREE.Line(
            guideGeo,
            new THREE.LineDashedMaterial({
                color: 0x38bdf8,
                dashSize: 15,
                gapSize: 10,
                depthTest: false,
                transparent: true,
                opacity: 0.85,
                linewidth: 2
            })
        );
        this.guideLine.computeLineDistances();
        this.guideLine.renderOrder = 997;
        this.guideLine.visible = false;
        this.ghostGroup.add(this.guideLine);

        // Smart Parallel & Perpendicular Corner Alignment Inference Guide Line (Dashed Emerald)
        const alignGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 0)
        ]);
        this.alignmentLine = new THREE.Line(
            alignGeo,
            new THREE.LineDashedMaterial({
                color: 0x10b981,
                dashSize: 10,
                gapSize: 8,
                depthTest: false,
                transparent: true,
                opacity: 1.0,
                linewidth: 3
            })
        );
        this.alignmentLine.computeLineDistances();
        this.alignmentLine.renderOrder = 1008;
        this.alignmentLine.visible = false;
        this.ghostGroup.add(this.alignmentLine);

        // Alignment Reference Corner Target Ring
        const alignMarkerGeo = new THREE.RingGeometry(6, 12, 32);
        alignMarkerGeo.rotateX(-Math.PI / 2);
        this.alignmentMarker = new THREE.Mesh(
            alignMarkerGeo,
            new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
        );
        this.alignmentMarker.renderOrder = 1009;
        this.alignmentMarker.visible = false;
        this.ghostGroup.add(this.alignmentMarker);

        // Ghost Wall Mesh Material
        this.ghostMat = new THREE.MeshBasicMaterial({
            color: 0x0ea5e9,
            transparent: true,
            opacity: 0.55,
            depthTest: false,
            side: THREE.DoubleSide
        });
        
        this.ghostEdgeMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });

        // Ghost Floor Material for Room Box mode
        this.ghostFloorMat = new THREE.MeshBasicMaterial({
            color: 0x0ea5e9,
            transparent: true,
            opacity: 0.25,
            depthTest: false,
            side: THREE.DoubleSide
        });

        // 3D Ghost Wall Single Box
        const baseBoxGeo = new THREE.BoxGeometry(1, 1, 1);
        this.ghostWallMesh = new THREE.Mesh(baseBoxGeo, this.ghostMat);
        this.ghostWallMesh.renderOrder = 999;
        this.ghostWallEdges = new THREE.LineSegments(new THREE.EdgesGeometry(baseBoxGeo), this.ghostEdgeMat);
        this.ghostWallEdges.renderOrder = 1000;
        this.ghostWallMesh.add(this.ghostWallEdges);
        this.ghostWallMesh.visible = false;
        this.ghostGroup.add(this.ghostWallMesh);

        // 3D Ghost Room Box (4 walls + floor)
        this.ghostRoomWalls = [
            this._createGhostWallPiece(),
            this._createGhostWallPiece(),
            this._createGhostWallPiece(),
            this._createGhostWallPiece()
        ];
        this.ghostRoomWalls.forEach(w => this.ghostGroup.add(w));
        
        const planeGeo = new THREE.PlaneGeometry(1, 1);
        planeGeo.rotateX(-Math.PI / 2);
        this.ghostRoomFloor = new THREE.Mesh(planeGeo, this.ghostFloorMat);
        this.ghostRoomFloor.renderOrder = 998;
        this.ghostRoomFloor.visible = false;
        this.ghostGroup.add(this.ghostRoomFloor);

        // 3D Ghost Polygon Mesh & Edges for Pavements / Outdoor Zones
        this.ghostPolygonMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostFloorMat);
        this.ghostPolygonMesh.renderOrder = 998;
        this.ghostPolygonMesh.visible = false;
        this.ghostGroup.add(this.ghostPolygonMesh);

        this.ghostPolygonLine = new THREE.Line(new THREE.BufferGeometry(), this.ghostEdgeMat);
        this.ghostPolygonLine.renderOrder = 999;
        this.ghostPolygonLine.visible = false;
        this.ghostGroup.add(this.ghostPolygonLine);

        this.ghostCenterline = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineDashedMaterial({ color: 0x0284c7, dashSize: 10, gapSize: 6, depthTest: false, transparent: true, opacity: 0.9, linewidth: 2 })
        );
        this.ghostCenterline.renderOrder = 1000;
        this.ghostCenterline.visible = false;
        this.ghostGroup.add(this.ghostCenterline);

        this.outdoorNodeMarkers = [];
        this.drawingOutdoorPoints = null;

        // Floating Vector DOM Badge (100% Crisp Screen-Space HTML Overlay)
        this._createDOMBadge();

        this._onKeyDown = this._onKeyDown.bind(this);
        window.addEventListener('keydown', this._onKeyDown);
    }

    _createDOMBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'wall3d-live-dimension-badge';
        this.domBadge.style.cssText = `
            position: absolute;
            display: none;
            pointer-events: none;
            transform: translate(-50%, -100%);
            padding: 8px 18px;
            border-radius: 24px;
            background: rgba(15, 23, 42, 0.94);
            border: 2.5px solid #00f0ff;
            box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6), 0 0 18px rgba(0, 240, 255, 0.35);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.5px;
            white-space: nowrap;
            z-index: 9999;
            backdrop-filter: blur(10px);
            user-select: none;
            transition: border-color 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
        `;
        
        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domBadge);
    }

    _createSnapHaloMesh() {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mesh = new THREE.Mesh(geo, this.haloMat);
        mesh.renderOrder = 996;
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), this.haloEdgeMat);
        edges.renderOrder = 997;
        mesh.add(edges);
        mesh.visible = false;
        return mesh;
    }

    _createGhostWallPiece() {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mesh = new THREE.Mesh(geo, this.ghostMat);
        mesh.renderOrder = 999;
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), this.ghostEdgeMat);
        edges.renderOrder = 1000;
        mesh.add(edges);
        mesh.visible = false;
        return mesh;
    }

    _updateDimensionBadge(text, worldPosition, isSpecial = false, specialColor = '#00f0ff') {
        // Update Native Crisp Screen-Space DOM Badge
        if (this.domBadge && this.ctx.renderer && this.ctx.camera) {
            const screenPos = worldPosition.clone().project(this.ctx.camera);
            const rect = this.ctx.renderer.domElement.getBoundingClientRect();
            const screenX = ((screenPos.x + 1) / 2) * rect.width;
            const screenY = ((-screenPos.y + 1) / 2) * rect.height;

            if (screenPos.z > 1) {
                this.domBadge.style.display = 'none';
            } else {
                this.domBadge.style.display = 'block';
                this.domBadge.style.left = `${screenX}px`;
                this.domBadge.style.top = `${screenY - 14}px`;
                this.domBadge.textContent = text;
                this.domBadge.style.borderColor = specialColor;
                this.domBadge.style.color = isSpecial ? specialColor : '#ffffff';
                this.domBadge.style.boxShadow = `0 6px 24px rgba(0, 0, 0, 0.6), 0 0 20px ${specialColor}55`;
            }
        }
    }

    _getOrCreateNodeMarker(idx) {
        if (!this.outdoorNodeMarkers[idx]) {
            const sphereGeo = new THREE.SphereGeometry(3.5, 16, 16);
            const m = new THREE.Mesh(
                sphereGeo,
                new THREE.MeshBasicMaterial({ color: 0x0284c7, depthTest: false, transparent: true, opacity: 0.95 })
            );
            m.renderOrder = 1004;
            m.visible = false;
            this.ghostGroup.add(m);
            this.outdoorNodeMarkers[idx] = m;
        }
        return this.outdoorNodeMarkers[idx];
    }

    get planner() {
        return this.ctx.planner || window.planner?.value || window.plannerInstance || window.planner;
    }

    get activeTool() {
        return this.planner?.tool || 'select';
    }

    isOutdoorZoneDrawingTool() {
        const t = this.activeTool;
        return ['outdoor_pavement', 'pavement', 'outdoor_walkway', 'walkway', 'outdoor_driveway', 'driveway', 'outdoor_patio', 'outdoor_pool', 'outdoor_lawn', 'outdoor_deck', 'outdoor_other', 'outdoor_zone'].some(k => t === k || (typeof t === 'string' && t.startsWith('outdoor_')));
    }

    isWallDrawingTool() {
        const t = this.activeTool;
        return ['wall', 'outer', 'inner', 'compound', 'railing', 'room_box'].includes(t) || this.isOutdoorZoneDrawingTool();
    }

    getFloorElevation() {
        const planner = this.planner;
        if (planner && planner.levels && planner.activeLevelIndex !== undefined) {
            const lvl = planner.levels[planner.activeLevelIndex];
            if (lvl && lvl.elevation !== undefined) return lvl.elevation;
        }
        return 0;
    }

    getWallConfig() {
        const tool = this.activeTool;
        if (tool === 'room_box') return WALL_REGISTRY['outer'] || { thickness: 16, height: 180 };
        return WALL_REGISTRY[tool] || WALL_REGISTRY['outer'] || { thickness: 16, height: 180 };
    }

    /**
     * Raycasts cursor ray:
     * 1. Direct 3D intersection with any existing wall mesh in the scene
     * 2. Floor plane intersection (y = elevation)
     */
    getSceneIntersection(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const elev = this.getFloorElevation();

        // 1. Direct 3D Raycasting against actual wall and roof meshes (Sims 4 Roof & Upper Wall placement)
        const structureObjects = [];
        if (this.ctx.structureGroup) {
            this.ctx.structureGroup.traverse(child => {
                if (child.isMesh && child.userData && (child.userData.isWallSide || child.userData.entity || child.userData.isRoof || child.userData.isGable || child.userData.componentType === 'roof_top')) {
                    structureObjects.push(child);
                }
            });
        }

        if (structureObjects.length > 0) {
            const hits = this.raycaster.intersectObjects(structureObjects, false);
            if (hits.length > 0) {
                const hit = hits[0];
                const isRoofHit = hit.object.userData?.isRoof || hit.object.userData?.isGable || hit.object.userData?.componentType === 'roof_top';
                let entity = hit.object.userData?.entity;
                if (!entity && hit.object.parent) {
                    entity = hit.object.parent.userData?.entity;
                }

                if (isRoofHit) {
                    const roofBaseElev = entity?.elevation !== undefined ? entity.elevation : (this.getFloorElevation() + 120);
                    return {
                        hitPoint3D: hit.point,
                        directWallHit: null,
                        directRoofHit: entity,
                        elevation: roofBaseElev,
                        isFloor: false,
                        isRoof: true
                    };
                }

                if (entity && entity.startAnchor && entity.endAnchor) {
                    const wallBaseY = entity.elevation || 0;
                    const wallHeight = entity.height || 120;
                    const isNearTop = hit.point.y >= (wallBaseY + wallHeight * 0.5);
                    const wallElev = isNearTop ? (wallBaseY + wallHeight) : wallBaseY;

                    return {
                        hitPoint3D: hit.point,
                        directWallHit: entity,
                        elevation: wallElev,
                        isFloor: false,
                        isRoof: false
                    };
                }
            }
        }

        // 2. Intersect Floor Plane (y = elevation)
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elev);
        const floorHit = new THREE.Vector3();

        if (this.raycaster.ray.intersectPlane(floorPlane, floorHit)) {
            return {
                hitPoint3D: floorHit,
                directWallHit: null,
                elevation: elev,
                isFloor: true
            };
        }

        return null;
    }

    /**
     * Smart High-Precision Snapping Hierarchy:
     * 1. Direct Wall Hit Projection (mouse is over a 3D wall)
     * 2. Corner Anchors (Radius: 35 units)
     * 3. Midpoint (50%) & Quarter Point (25%, 75%) Symmetry Magnet
     * 4. Wall Edge T-Joints (Radius: 32 units)
     * 5. Smart Parallel / Orthogonal Alignment to Start Corner & Room Anchors (Inference Guides)
     * 6. 45°/90° Global Angle Snapping
     * 7. Grid Snapping (5cm increments)
     */
    getSnappedPoint(intersectionResult, shiftKey = false) {
        const planner = this.planner;
        const elev = intersectionResult?.elevation !== undefined ? intersectionResult.elevation : this.getFloorElevation();
        if (!intersectionResult || !planner) return { point: new THREE.Vector3(0, elev, 0), isAnchor: false, isWallEdge: false, connectedWalls: [] };

        const { hitPoint3D, directWallHit } = intersectionResult;
        let pos2D = { x: hitPoint3D.x, y: hitPoint3D.z };

        // If directly hovering over a 3D wall mesh, project coordinate directly onto the wall baseline
        if (directWallHit) {
            const p1 = directWallHit.startAnchor.position ? directWallHit.startAnchor.position() : { x: directWallHit.startAnchor.x, y: directWallHit.startAnchor.y };
            const p2 = directWallHit.endAnchor.position ? directWallHit.endAnchor.position() : { x: directWallHit.endAnchor.x, y: directWallHit.endAnchor.y };
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;

            if (lenSq > 1) {
                let t = ((pos2D.x - p1.x) * dx + (pos2D.y - p1.y) * dy) / lenSq;
                t = Math.max(0, Math.min(1, t));

                // Corner snap near ends of the wall (within 12% of ends)
                if (t < 0.12) {
                    pos2D = { x: p1.x, y: p1.y };
                    const attached = (planner.walls || []).filter(w => !w.hidden && (w.startAnchor === directWallHit.startAnchor || w.endAnchor === directWallHit.startAnchor));
                    return {
                        point: new THREE.Vector3(p1.x, elev, p1.y),
                        isAnchor: true,
                        isWallEdge: false,
                        isMidpoint: false,
                        anchor: directWallHit.startAnchor,
                        connectedWalls: attached
                    };
                } else if (t > 0.88) {
                    pos2D = { x: p2.x, y: p2.y };
                    const attached = (planner.walls || []).filter(w => !w.hidden && (w.startAnchor === directWallHit.endAnchor || w.endAnchor === directWallHit.endAnchor));
                    return {
                        point: new THREE.Vector3(p2.x, elev, p2.y),
                        isAnchor: true,
                        isWallEdge: false,
                        isMidpoint: false,
                        anchor: directWallHit.endAnchor,
                        connectedWalls: attached
                    };
                } else {
                    // Midpoint Snap Magnet (t approx 0.5)
                    let isMid = Math.abs(t - 0.5) < 0.09;
                    if (isMid) t = 0.5;

                    const projX = p1.x + t * dx;
                    const projY = p1.y + t * dy;
                    return {
                        point: new THREE.Vector3(projX, elev, projY),
                        isAnchor: false,
                        isWallEdge: true,
                        isMidpoint: isMid,
                        wall: directWallHit,
                        connectedWalls: [directWallHit]
                    };
                }
            }
        }

        // 1. Proximity Snap to Corner Anchors in 2D
        const snapDist = SNAP_DIST || 35;
        let bestAnchor = null;
        let minDist = snapDist;

        (planner.anchors || []).forEach(a => {
            const p = a.position ? a.position() : { x: a.x, y: a.y };
            const d = Math.hypot(pos2D.x - p.x, pos2D.y - p.y);
            if (d < minDist) {
                minDist = d;
                bestAnchor = { x: p.x, y: p.y, anchor: a };
            }
        });

        if (bestAnchor) {
            const attached = (planner.walls || []).filter(w => !w.hidden && (w.startAnchor === bestAnchor.anchor || w.endAnchor === bestAnchor.anchor));
            return {
                point: new THREE.Vector3(bestAnchor.x, elev, bestAnchor.y),
                isAnchor: true,
                isWallEdge: false,
                isMidpoint: false,
                anchor: bestAnchor.anchor,
                connectedWalls: attached
            };
        }

        // 2. Snap to Wall Edges (T-Joints) & Midpoints along existing walls
        let bestWallPoint = null;
        let bestWall = null;
        let minWallDist = snapDist * 0.95;
        let isMidpointSnap = false;

        (planner.walls || []).forEach(w => {
            if (w.hidden || !w.startAnchor || !w.endAnchor) return;
            const p1 = w.startAnchor.position ? w.startAnchor.position() : { x: w.startAnchor.x, y: w.startAnchor.y };
            const p2 = w.endAnchor.position ? w.endAnchor.position() : { x: w.endAnchor.x, y: w.endAnchor.y };

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq < 1) return;

            let t = ((pos2D.x - p1.x) * dx + (pos2D.y - p1.y) * dy) / lenSq;
            t = Math.max(0.04, Math.min(0.96, t));

            // Midpoint snap magnet (50%)
            let isMid = Math.abs(t - 0.5) < 0.09;
            if (isMid) {
                t = 0.5;
            }

            const projX = p1.x + t * dx;
            const projY = p1.y + t * dy;
            const dist = Math.hypot(pos2D.x - projX, pos2D.y - projY);

            if (dist < minWallDist) {
                minWallDist = dist;
                bestWallPoint = { x: projX, y: projY };
                bestWall = w;
                isMidpointSnap = isMid;
            }
        });

        if (bestWallPoint) {
            return {
                point: new THREE.Vector3(bestWallPoint.x, elev, bestWallPoint.y),
                isAnchor: false,
                isWallEdge: true,
                isMidpoint: isMidpointSnap,
                wall: bestWall,
                connectedWalls: [bestWall]
            };
        }

        let finalX = pos2D.x;
        let finalY = pos2D.y;
        let isAngleSnapped = false;
        let isAlignedWithCorner = false;
        let alignedCornerPos = null;

        // 3. Smart Parallel & Perpendicular Alignment (Inference Guides) to form perfect squares/rectangles
        if (this.drawing && this.lastAnchor) {
            const p1 = this.lastAnchor.position ? this.lastAnchor.position() : { x: this.lastAnchor.x, y: this.lastAnchor.y };
            const dx = finalX - p1.x;
            const dy = finalY - p1.y;
            const len = Math.hypot(dx, dy);

            if (len > 10) {
                let angle = Math.atan2(dy, dx);
                const step = Math.PI / 4; // 45 degrees
                const snapAngle = Math.round(angle / step) * step;
                const angleDiff = Math.abs(angle - snapAngle);

                // Auto-snap if close to orthogonal/45° or if Shift is held
                if (shiftKey || angleDiff < 0.22) {
                    finalX = p1.x + Math.cos(snapAngle) * len;
                    finalY = p1.y + Math.sin(snapAngle) * len;
                    isAngleSnapped = true;
                }

                // Check Alignment to Start Anchor or any Existing Room Corner
                const candidates = [];
                if (this.startAnchor && this.startAnchor !== this.lastAnchor) {
                    const sp = this.startAnchor.position ? this.startAnchor.position() : { x: this.startAnchor.x, y: this.startAnchor.y };
                    candidates.push(sp);
                }
                (planner.anchors || []).forEach(a => {
                    if (a !== this.lastAnchor && a !== this.startAnchor) {
                        const ap = a.position ? a.position() : { x: a.x, y: a.y };
                        candidates.push(ap);
                    }
                });

                // Classify movement direction:
                // isHoriz: moving left/right along X axis (angle is near 0 or PI / -PI)
                // isVert: moving up/down along Y axis (angle is near PI/2 or -PI/2)
                const sinVal = Math.abs(Math.sin(snapAngle));
                const cosVal = Math.abs(Math.cos(snapAngle));
                const isHoriz = sinVal < 0.25; // Mostly moving along X
                const isVert = cosVal < 0.25;  // Mostly moving along Y

                const alignTolerance = 35; // Generous snap tolerance to lock alignment cleanly

                for (const cand of candidates) {
                    if (isHoriz) {
                        // Moving horizontally along X: lock X when it aligns with reference corner cand.x!
                        if (Math.abs(finalX - cand.x) < alignTolerance) {
                            finalX = cand.x;
                            isAlignedWithCorner = true;
                            alignedCornerPos = cand;
                            break;
                        }
                    } else if (isVert) {
                        // Moving vertically along Y: lock Y when it aligns with reference corner cand.y!
                        if (Math.abs(finalY - cand.y) < alignTolerance) {
                            finalY = cand.y;
                            isAlignedWithCorner = true;
                            alignedCornerPos = cand;
                            break;
                        }
                    }
                }
            }
        }

        // 4. Grid Snapping (5cm increments) if not already aligned
        if (!isAlignedWithCorner) {
            const gridStep = 5;
            finalX = Math.round(finalX / gridStep) * gridStep;
            finalY = Math.round(finalY / gridStep) * gridStep;
        }

        return {
            point: new THREE.Vector3(finalX, elev, finalY),
            isAnchor: false,
            isWallEdge: false,
            isMidpoint: false,
            isAngleSnapped,
            isAlignedWithCorner,
            alignedCornerPos,
            connectedWalls: []
        };
    }

    onPointerMove(e) {
        if (!this.isWallDrawingTool()) {
            this.hideGhostMeshes();
            return;
        }

        const sceneHit = this.getSceneIntersection(e);
        if (!sceneHit) return;

        const snapResult = this.getSnappedPoint(sceneHit, e.shiftKey);
        const pt = snapResult.point;
        const elev = this.drawing ? (this.drawingElevation !== undefined ? this.drawingElevation : pt.y) : pt.y;

        // 1. Render Sims 4-Style Glowing Snap Halo around Snapped Wall(s)
        if (snapResult.connectedWalls && snapResult.connectedWalls.length > 0) {
            this.snapHaloGroup.visible = true;
            this.snapHalos.forEach((h, idx) => {
                if (idx < snapResult.connectedWalls.length) {
                    const w = snapResult.connectedWalls[idx];
                    const p1 = w.startAnchor.position ? w.startAnchor.position() : { x: w.startAnchor.x, y: w.startAnchor.y };
                    const p2 = w.endAnchor.position ? w.endAnchor.position() : { x: w.endAnchor.x, y: w.endAnchor.y };
                    const hVal = w.height || 180;
                    const tVal = (w.thickness || 16) + 3.0;

                    this._positionWallPiece(h, p1.x, p1.y, p2.x, p2.y, hVal + 2, tVal, elev - 1);
                    h.visible = true;
                } else {
                    h.visible = false;
                }
            });
        } else {
            this.snapHaloGroup.visible = false;
            this.snapHalos.forEach(h => h.visible = false);
        }

        // 2. Visual Snap Ring & Indicator (Corner / Midpoint Diamond / Edge)
        if (snapResult.isAnchor || snapResult.isWallEdge) {
            this.snapIndicatorGroup.position.set(pt.x, elev + 0.6, pt.z);
            
            if (snapResult.isMidpoint) {
                this.snapDiamond.visible = true;
                this.snapDot.visible = false;
                this.snapRing.material.color.setHex(0xf59e0b);
            } else {
                this.snapDiamond.visible = false;
                this.snapDot.visible = true;
                this.snapRing.material.color.setHex(snapResult.isAnchor ? 0x10b981 : 0x00f0ff);
                this.snapDot.material.color.setHex(snapResult.isAnchor ? 0x34d399 : 0x38bdf8);
            }

            this.snapIndicatorGroup.visible = true;
            this.ctx.renderer.domElement.style.cursor = 'crosshair';
        } else {
            this.snapIndicatorGroup.visible = false;
            this.ctx.renderer.domElement.style.cursor = 'crosshair';
        }

        this.ghostGroup.visible = true;

        if (this.isOutdoorZoneDrawingTool()) {
            const isCorridor = (this.activeTool === 'outdoor_driveway' || this.activeTool === 'outdoor_walkway' || this.activeTool === 'driveway' || this.activeTool === 'walkway');
            const subType = (this.activeTool === 'outdoor_walkway' || this.activeTool === 'walkway') ? 'walkway' : ((this.activeTool === 'outdoor_driveway' || this.activeTool === 'driveway') ? 'driveway' : 'pavement');
            const corridorWidth = subType === 'walkway' ? 60 : 160;

            if (this.drawing && this.drawingOutdoorPoints && this.drawingOutdoorPoints.length > 0) {
                const currentPts = [...this.drawingOutdoorPoints, { x: pt.x, y: pt.z }];

                // 1. Update node markers
                this.outdoorNodeMarkers.forEach(m => m.visible = false);
                currentPts.forEach((p, idx) => {
                    const m = this._getOrCreateNodeMarker(idx);
                    m.position.set(p.x, elev + 0.3, p.y);
                    m.visible = true;
                });

                if (isCorridor) {
                    const polyPts = computeCorridorPolygon(currentPts, corridorWidth);
                    if (polyPts && polyPts.length >= 3) {
                        const shape = new THREE.Shape();
                        shape.moveTo(polyPts[0].x, polyPts[0].y);
                        for (let i = 1; i < polyPts.length; i++) {
                            shape.lineTo(polyPts[i].x, polyPts[i].y);
                        }
                        shape.closePath();

                        if (this.ghostPolygonMesh.geometry) this.ghostPolygonMesh.geometry.dispose();
                        const geo = new THREE.ShapeGeometry(shape);
                        geo.rotateX(-Math.PI / 2);
                        this.ghostPolygonMesh.geometry = geo;
                        this.ghostPolygonMesh.position.set(0, elev + 0.15, 0);
                        this.ghostPolygonMesh.visible = true;

                        const linePositions = new Float32Array(polyPts.flatMap(p => [p.x, elev + 0.2, p.y]));
                        this.ghostPolygonLine.geometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
                        this.ghostPolygonLine.geometry.attributes.position.needsUpdate = true;
                        this.ghostPolygonLine.visible = true;
                    }
                } else {
                    if (currentPts.length >= 3) {
                        const shape = new THREE.Shape();
                        shape.moveTo(currentPts[0].x, currentPts[0].y);
                        for (let i = 1; i < currentPts.length; i++) {
                            shape.lineTo(currentPts[i].x, currentPts[i].y);
                        }
                        shape.closePath();

                        if (this.ghostPolygonMesh.geometry) this.ghostPolygonMesh.geometry.dispose();
                        const geo = new THREE.ShapeGeometry(shape);
                        geo.rotateX(-Math.PI / 2);
                        this.ghostPolygonMesh.geometry = geo;
                        this.ghostPolygonMesh.position.set(0, elev + 0.15, 0);
                        this.ghostPolygonMesh.visible = true;
                    }

                    const linePositions = new Float32Array(currentPts.flatMap(p => [p.x, elev + 0.2, p.y]));
                    this.ghostPolygonLine.geometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
                    this.ghostPolygonLine.geometry.attributes.position.needsUpdate = true;
                    this.ghostPolygonLine.visible = true;
                }

                // Dimension readout for current segment & finish hint
                const lastP = this.drawingOutdoorPoints[this.drawingOutdoorPoints.length - 1];
                const segLen = Math.hypot(pt.x - lastP.x, pt.z - lastP.y);
                const startP = this.drawingOutdoorPoints[0];
                const distToStart = Math.hypot(pt.x - startP.x, pt.z - startP.y);

                let label = `${(segLen / 100).toFixed(2)} m`;
                let isSpecial = false;
                let badgeColor = '#00f0ff';

                if (!isCorridor && this.drawingOutdoorPoints.length >= 3 && distToStart < SNAP_DIST * 2) {
                    label = `✓ CLICK TO CLOSE POLYGON • ${(segLen / 100).toFixed(2)}m`;
                    isSpecial = true;
                    badgeColor = '#10b981';
                } else if (isCorridor && this.drawingOutdoorPoints.length >= 2) {
                    label = `✓ CLICK LAST NODE TO FINISH • ${(segLen / 100).toFixed(2)}m`;
                }

                this._updateDimensionBadge(label, new THREE.Vector3((lastP.x + pt.x) / 2, elev + 24, (lastP.y + pt.z) / 2), isSpecial, badgeColor);
            }
            if (this.ctx.requestRender) this.ctx.requestRender('outdoor3d_move', 2);
            return;
        }

        if (this.drawing && (this.lastAnchor || this.startPoint)) {
            const config = this.getWallConfig();
            const h = config.height || 180;
            const t = config.thickness || 16;

            if (this.activeTool === 'room_box') {
                // Ghost Room Box Preview (4 walls + floor)
                const p1 = this.startPoint;
                const p2 = { x: pt.x, y: pt.z };

                const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x);
                const minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y);
                const width = maxX - minX;
                const depth = maxY - minY;

                if (width > 5 && depth > 5) {
                    // Top Wall
                    this._positionWallPiece(this.ghostRoomWalls[0], minX, minY, maxX, minY, h, t, elev);
                    // Right Wall
                    this._positionWallPiece(this.ghostRoomWalls[1], maxX, minY, maxX, maxY, h, t, elev);
                    // Bottom Wall
                    this._positionWallPiece(this.ghostRoomWalls[2], maxX, maxY, minX, maxY, h, t, elev);
                    // Left Wall
                    this._positionWallPiece(this.ghostRoomWalls[3], minX, maxY, minX, minY, h, t, elev);

                    // Floor Slab
                    this.ghostRoomFloor.position.set((minX + maxX) / 2, elev + 0.2, (minY + maxY) / 2);
                    this.ghostRoomFloor.scale.set(width, depth, 1);
                    this.ghostRoomFloor.visible = true;

                    // Dimension Badge
                    const areaSqm = ((width * depth) / 10000).toFixed(2);
                    const label = `📐 ${(width / 100).toFixed(2)}m × ${(depth / 100).toFixed(2)}m  •  ${areaSqm} m²`;
                    this._updateDimensionBadge(label, new THREE.Vector3((minX + maxX) / 2, elev + h + 24, (minY + maxY) / 2));
                }
            } else {
                // Ghost Single Wall Preview
                const p1 = this.lastAnchor.position ? this.lastAnchor.position() : { x: this.lastAnchor.x, y: this.lastAnchor.y };
                const p2 = { x: pt.x, y: pt.z };
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.hypot(dx, dy);

                if (len > 5) {
                    this._positionWallPiece(this.ghostWallMesh, p1.x, p1.y, p2.x, p2.y, h, t, elev);
                    this.ghostWallMesh.visible = true;

                    // Direction Alignment Guide Line
                    const guidePositions = new Float32Array([
                        p1.x, elev + 1, p1.y,
                        p2.x + dx * 0.5, elev + 1, p2.y + dy * 0.5
                    ]);
                    this.guideLine.geometry.setAttribute('position', new THREE.BufferAttribute(guidePositions, 3));
                    this.guideLine.geometry.attributes.position.needsUpdate = true;
                    this.guideLine.computeLineDistances();
                    this.guideLine.visible = true;

                    // Smart Parallel & Perpendicular Alignment Guide Line to Reference Corner
                    if (snapResult.isAlignedWithCorner && snapResult.alignedCornerPos) {
                        const refP = snapResult.alignedCornerPos;
                        const alignPositions = new Float32Array([
                            refP.x, elev + 1.2, refP.y,
                            p2.x, elev + 1.2, p2.y
                        ]);
                        this.alignmentLine.geometry.setAttribute('position', new THREE.BufferAttribute(alignPositions, 3));
                        this.alignmentLine.geometry.attributes.position.needsUpdate = true;
                        this.alignmentLine.computeLineDistances();
                        this.alignmentLine.visible = true;

                        this.alignmentMarker.position.set(refP.x, elev + 1.3, refP.y);
                        this.alignmentMarker.visible = true;
                    } else {
                        this.alignmentLine.visible = false;
                        this.alignmentMarker.visible = false;
                    }

                    // Dimension Badge: Special Midpoint / Alignment indicator or length readout
                    let label = `${(len / 100).toFixed(2)} m`;
                    let isSpecial = false;
                    let badgeColor = '#00f0ff';

                    if (snapResult.isAlignedWithCorner) {
                        label = `📐 ALIGNED WITH CORNER • ${(len / 100).toFixed(2)}m`;
                        isSpecial = true;
                        badgeColor = '#10b981';
                    } else if (snapResult.isMidpoint) {
                        label = `🔶 MIDPOINT (50%) • ${(len / 100).toFixed(2)}m`;
                        isSpecial = true;
                        badgeColor = '#f59e0b';
                    }

                    this._updateDimensionBadge(label, new THREE.Vector3((p1.x + p2.x) / 2, elev + h + 24, (p1.y + p2.y) / 2), isSpecial, badgeColor);
                } else {
                    this.ghostWallMesh.visible = false;
                    this.guideLine.visible = false;
                    this.alignmentLine.visible = false;
                    this.alignmentMarker.visible = false;
                    if (this.domBadge) this.domBadge.style.display = 'none';
                }
            }
        }

        if (this.ctx.requestRender) this.ctx.requestRender('wall3d_move', 2);
    }

    _positionWallPiece(mesh, x1, y1, x2, y2, h, t, elev) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        mesh.scale.set(len, h, t);
        mesh.position.set((x1 + x2) / 2, elev + h / 2, (y1 + y2) / 2);
        mesh.rotation.set(0, -angle, 0);
        mesh.visible = true;
    }

    _finish3DOutdoorCorridor() {
        const planner = this.planner;
        if (!planner || !this.drawingOutdoorPoints || this.drawingOutdoorPoints.length < 2) {
            this.finishDrawing();
            return;
        }
        const tool = this.activeTool;
        const subType = (tool === 'outdoor_walkway' || tool === 'walkway') ? 'walkway' : 'driveway';
        const corridorWidth = subType === 'walkway' ? 60 : 160;
        const zoneDefaults = OUTDOOR_ZONE_TYPES[subType] || OUTDOOR_ZONE_TYPES.pavement;
        const corridorPoly = computeCorridorPolygon(this.drawingOutdoorPoints, corridorWidth);
        if (!corridorPoly || corridorPoly.length < 3) {
            this.finishDrawing();
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        corridorPoly.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const relPts = corridorPoly.map(p => ({ x: p.x - cx, y: p.y - cy }));

        const newZone = new PremiumOutdoorZone(planner, 'outdoor_zone', {
            x: cx, y: cy, points: relPts, subType: subType,
            material: (planner.activePresetParams?.material || zoneDefaults.defaultMaterial),
            height3D: 0.3,
            width: corridorWidth,
            materialScale: DEFAULT_UNIVERSAL_TILE_SIZE,
            centerline: this.drawingOutdoorPoints.map(p => ({ x: p.x - cx, y: p.y - cy }))
        });

        if (!planner.outdoorZones) planner.outdoorZones = [];
        planner.outdoorZones.push(newZone);
        if (!planner.currentSessionEntities) planner.currentSessionEntities = [];
        planner.currentSessionEntities.push(newZone);

        this.finishDrawing();

        planner.tool = 'select';
        if (planner.updateToolStates) planner.updateToolStates();
        if (planner.onToolChange) planner.onToolChange('select');
        planner.syncAll();
        planner.selectEntity(newZone, 'outdoor_zone');
    }

    _finish3DOutdoorPolygon() {
        const planner = this.planner;
        if (!planner || !this.drawingOutdoorPoints || this.drawingOutdoorPoints.length < 3) {
            this.finishDrawing();
            return;
        }
        const tool = this.activeTool;
        const subType = tool === 'outdoor_other' ? 'other_space' : (typeof tool === 'string' && tool.startsWith('outdoor_') ? tool.replace('outdoor_', '') : (tool || 'pavement'));
        const zoneDefaults = OUTDOOR_ZONE_TYPES[subType] || OUTDOOR_ZONE_TYPES.pavement;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.drawingOutdoorPoints.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const relPts = this.drawingOutdoorPoints.map(p => ({ x: p.x - cx, y: p.y - cy }));

        const newZone = new PremiumOutdoorZone(planner, 'outdoor_zone', {
            x: cx, y: cy, points: relPts, subType: subType,
            material: (planner.activePresetParams?.material || zoneDefaults.defaultMaterial),
            height3D: 0.3,
            materialScale: DEFAULT_UNIVERSAL_TILE_SIZE
        });

        if (!planner.outdoorZones) planner.outdoorZones = [];
        planner.outdoorZones.push(newZone);
        if (!planner.currentSessionEntities) planner.currentSessionEntities = [];
        planner.currentSessionEntities.push(newZone);

        this.finishDrawing();

        planner.tool = 'select';
        if (planner.updateToolStates) planner.updateToolStates();
        if (planner.onToolChange) planner.onToolChange('select');
        planner.syncAll();
        planner.selectEntity(newZone, 'outdoor_zone');
    }

    _finish3DRoomBox(pt) {
        if (!this.drawing || !this.startPoint) return;
        const planner = this.planner;
        if (!planner) return;

        const p1 = this.startPoint;
        const p2 = { x: pt.x, y: pt.z };
        const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y);
        const width = maxX - minX;
        const depth = maxY - minY;

        if (width > 20 && depth > 20) {
            const wallConfig = this.getWallConfig();
            const wallHeight = wallConfig.height || 120;
            const wallThick = wallConfig.thickness || 16;

            const roomSegments = [
                { p1: { x: minX, y: minY }, p2: { x: maxX, y: minY } }, // Top
                { p1: { x: maxX, y: minY }, p2: { x: maxX, y: maxY } }, // Right
                { p1: { x: maxX, y: maxY }, p2: { x: minX, y: maxY } }, // Bottom
                { p1: { x: minX, y: maxY }, p2: { x: minX, y: minY } }
            ];

            const created = WallReformer.reformAndAddWallSegments(planner, roomSegments, 'outer', {
                height: wallHeight,
                thickness: wallThick,
                elevation: this.drawingElevation !== undefined ? this.drawingElevation : pt.y,
                params: planner.activePresetParams
            });

            if (created && created.length > 0) {
                this.currentSessionEntities.push(...created);
            }
        }

        this.finishDrawing();
    }

    onPointerUp(e) {
        if (!this.isWallDrawingTool()) return false;
        if (this.activeTool === 'room_box' && this.drawing && this.startPoint) {
            const sceneHit = this.getSceneIntersection(e);
            if (sceneHit) {
                const snapResult = this.getSnappedPoint(sceneHit, e.shiftKey);
                const pt = snapResult.point;
                const p1 = this.startPoint;
                const minX = Math.min(p1.x, pt.x), maxX = Math.max(p1.x, pt.x);
                const minY = Math.min(p1.y, pt.z), maxY = Math.max(p1.y, pt.z);
                if (maxX - minX > 20 && maxY - minY > 20) {
                    this._finish3DRoomBox(pt);
                    return true;
                }
            }
        }
        return false;
    }

    onPointerDown(e) {
        if (!this.isWallDrawingTool()) return false;
        if (e.button !== 0) {
            // Right click finishes drawing
            if (this.isOutdoorZoneDrawingTool() && this.drawingOutdoorPoints) {
                const isCorridor = (this.activeTool === 'outdoor_driveway' || this.activeTool === 'outdoor_walkway' || this.activeTool === 'driveway' || this.activeTool === 'walkway');
                if (isCorridor && this.drawingOutdoorPoints.length >= 2) this._finish3DOutdoorCorridor();
                else if (!isCorridor && this.drawingOutdoorPoints.length >= 3) this._finish3DOutdoorPolygon();
                else this.finishDrawing();
                return true;
            }
            this.finishDrawing();
            return true;
        }

        const sceneHit = this.getSceneIntersection(e);
        if (!sceneHit) return false;

        const snapResult = this.getSnappedPoint(sceneHit, e.shiftKey);
        const pt = snapResult.point;
        const planner = this.planner;
        if (!planner) return false;

        e.preventDefault();
        e.stopPropagation();

        if (this.isOutdoorZoneDrawingTool()) {
            const isCorridor = (this.activeTool === 'outdoor_driveway' || this.activeTool === 'outdoor_walkway' || this.activeTool === 'driveway' || this.activeTool === 'walkway');
            if (!this.drawing) {
                this.drawing = true;
                this.drawingOutdoorPoints = [{ x: pt.x, y: pt.z }];
                if (planner.commandManager) this._snapshotCmd = new SnapshotCommand(planner);
                if (planner.onDrawingChange) planner.onDrawingChange(true);
            } else {
                const lastP = this.drawingOutdoorPoints[this.drawingOutdoorPoints.length - 1];
                const startP = this.drawingOutdoorPoints[0];

                if (isCorridor && (Math.hypot(pt.x - lastP.x, pt.z - lastP.y) < SNAP_DIST * 1.5 || (Math.hypot(pt.x - startP.x, pt.z - startP.y) < SNAP_DIST * 1.5 && this.drawingOutdoorPoints.length >= 2))) {
                    this._finish3DOutdoorCorridor();
                    return true;
                }

                if (!isCorridor && Math.hypot(pt.x - startP.x, pt.z - startP.y) < SNAP_DIST * 2 && this.drawingOutdoorPoints.length >= 3) {
                    this._finish3DOutdoorPolygon();
                    return true;
                }

                this.drawingOutdoorPoints.push({ x: pt.x, y: pt.z });
            }
            return true;
        }

        if (!this.drawing) {
            // Start Drawing Session
            this.drawing = true;
            this.drawingElevation = pt.y;
            this.startPoint = { x: pt.x, y: pt.z };
            this.currentSessionEntities = [];

            if (planner.commandManager) {
                this._snapshotCmd = new SnapshotCommand(planner);
            }

            if (this.activeTool !== 'room_box') {
                const currentAnchor = planner.getOrCreateAnchor(pt.x, pt.z);
                this.startAnchor = currentAnchor;
                this.lastAnchor = currentAnchor;
                currentAnchor.show();
            }

            if (planner.onDrawingChange) planner.onDrawingChange(true);
        } else {
            // Continue Drawing Session / Place Corner / Partition Finish
            const rawTool = this.activeTool;
            const wallType = rawTool === 'wall' ? 'outer' : rawTool;

            if (rawTool === 'room_box') {
                this._finish3DRoomBox(pt);
            } else {
                // Wall Chain Mode
                const currentAnchor = planner.getOrCreateAnchor(pt.x, pt.z);
                const isWallEdgeHit = snapResult.isWallEdge && snapResult.wall;

                if (this.lastAnchor && this.lastAnchor !== currentAnchor) {
                    let w;
                    if (rawTool === 'railing') {
                        w = new Railing(planner, this.lastAnchor, currentAnchor);
                        w.elevation = this.drawingElevation !== undefined ? this.drawingElevation : pt.y;
                        planner.walls.push(w);
                        planner.lastDrawnEntity = w;
                        this.currentSessionEntities.push(w);
                    } else {
                        w = WallFactory.createWall(planner, {
                            startAnchor: this.lastAnchor,
                            endAnchor: currentAnchor,
                            type: wallType,
                            elevation: this.drawingElevation !== undefined ? this.drawingElevation : pt.y,
                            sync: false
                        });
                        this.currentSessionEntities.push(w);
                    }

                    // Check if closed back on startAnchor (Room loop) or hit opposite wall T-joint (Partition complete)
                    if (currentAnchor === this.startAnchor || isWallEdgeHit) {
                        this.finishDrawing();
                        return true;
                    }
                }

                this.lastAnchor = currentAnchor;
                currentAnchor.show();
            }

            planner.syncAll();
            coreEventBus.emit(EVENTS.WALL_PUSH_PULL_END);
            if (this.ctx.requestRender) this.ctx.requestRender('wall3d_place', 2);
        }

        return true;
    }

    _onKeyDown(e) {
        if (e.key === 'Escape' || e.key === 'Enter') {
            if (this.drawing) {
                if (this.isOutdoorZoneDrawingTool() && this.drawingOutdoorPoints) {
                    const isCorridor = (this.activeTool === 'outdoor_driveway' || this.activeTool === 'outdoor_walkway' || this.activeTool === 'driveway' || this.activeTool === 'walkway');
                    if (isCorridor && this.drawingOutdoorPoints.length >= 2) {
                        this._finish3DOutdoorCorridor();
                        return;
                    } else if (!isCorridor && this.drawingOutdoorPoints.length >= 3) {
                        this._finish3DOutdoorPolygon();
                        return;
                    }
                }
                this.finishDrawing();
            }
        }
    }

    finishDrawing() {
        const planner = this.planner;
        this.hideGhostMeshes();

        if (this._snapshotCmd && this._snapshotCmd.finalize && planner && planner.commandManager) {
            planner.commandManager.execute(this._snapshotCmd);
        }
        this._snapshotCmd = null;

        this.drawing = false;
        this.drawingElevation = null;
        this.startAnchor = null;
        this.lastAnchor = null;
        this.startPoint = null;
        this.drawingOutdoorPoints = null;
        this.currentSessionEntities = [];

        if (this.hoveredWallMesh && this.interactions) {
            this.interactions.setHighlight(this.hoveredWallMesh, false);
            this.hoveredWallMesh = null;
        }

        if (planner) {
            if (planner.onDrawingChange) planner.onDrawingChange(false);
            planner.syncAll();
        }

        coreEventBus.emit(EVENTS.WALL_PUSH_PULL_END);
        coreEventBus.emit(EVENTS.DRAWING_END);
    }

    hideGhostMeshes() {
        this.ghostGroup.visible = false;
        this.ghostWallMesh.visible = false;
        this.ghostRoomWalls.forEach(w => w.visible = false);
        this.ghostRoomFloor.visible = false;
        if (this.ghostPolygonMesh) this.ghostPolygonMesh.visible = false;
        if (this.ghostPolygonLine) this.ghostPolygonLine.visible = false;
        if (this.ghostCenterline) this.ghostCenterline.visible = false;
        if (this.outdoorNodeMarkers) this.outdoorNodeMarkers.forEach(m => m.visible = false);
        this.snapIndicatorGroup.visible = false;
        this.snapHaloGroup.visible = false;
        this.snapHalos.forEach(h => h.visible = false);
        this.guideLine.visible = false;
        this.alignmentLine.visible = false;
        this.alignmentMarker.visible = false;
        if (this.domBadge) this.domBadge.style.display = 'none';
        if (this.hoveredWallMesh && this.interactions) {
            this.interactions.setHighlight(this.hoveredWallMesh, false);
            this.hoveredWallMesh = null;
        }
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        this.hideGhostMeshes();
        if (this.domBadge && this.domBadge.parentElement) {
            this.domBadge.parentElement.removeChild(this.domBadge);
        }
        if (this.ghostGroup.parent) this.ghostGroup.parent.remove(this.ghostGroup);
    }
}

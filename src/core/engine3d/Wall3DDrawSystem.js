import * as THREE from 'three';
import { WALL_REGISTRY, SNAP_DIST } from '../registry.js';
import { PremiumWall } from '../../features/wall/wall.renderer2d.js';
import { Railing } from '../../features/railing/objects/Railing.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
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

    get planner() {
        return this.ctx.planner || window.planner?.value || window.plannerInstance || window.planner;
    }

    get activeTool() {
        return this.planner?.tool || 'select';
    }

    isWallDrawingTool() {
        const t = this.activeTool;
        return ['wall', 'outer', 'inner', 'compound', 'railing', 'room_box'].includes(t);
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

        // 1. Direct 3D Raycasting against actual wall meshes
        const wallObjects = [];
        if (this.ctx.structureGroup) {
            this.ctx.structureGroup.traverse(child => {
                if (child.isMesh && child.userData && (child.userData.isWallSide || child.userData.entity)) {
                    wallObjects.push(child);
                }
            });
        }

        if (wallObjects.length > 0) {
            const wallHits = this.raycaster.intersectObjects(wallObjects, false);
            if (wallHits.length > 0) {
                const hit = wallHits[0];
                let wallEntity = hit.object.userData?.entity;
                if (!wallEntity && hit.object.parent) {
                    wallEntity = hit.object.parent.userData?.entity;
                }

                if (wallEntity && wallEntity.startAnchor && wallEntity.endAnchor) {
                    return {
                        hitPoint3D: hit.point,
                        directWallHit: wallEntity,
                        isFloor: false
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
        const elev = this.getFloorElevation();
        if (!intersectionResult || !planner) return { point: new THREE.Vector3(), isAnchor: false, isWallEdge: false, connectedWalls: [] };

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
        const elev = this.getFloorElevation();

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
                    const label = `${(width / 100).toFixed(2)}m × ${(depth / 100).toFixed(2)}m`;
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

    onPointerDown(e) {
        if (!this.isWallDrawingTool()) return false;
        if (e.button !== 0) {
            // Right click finishes drawing
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

        if (!this.drawing) {
            // Start Drawing Session
            this.drawing = true;
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
                // Create 4-Wall Rectangular Room
                const p1 = this.startPoint;
                const p2 = { x: pt.x, y: pt.z };

                const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x);
                const minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y);

                if (maxX - minX > 20 && maxY - minY > 20) {
                    const a1 = planner.getOrCreateAnchor(minX, minY);
                    const a2 = planner.getOrCreateAnchor(maxX, minY);
                    const a3 = planner.getOrCreateAnchor(maxX, maxY);
                    const a4 = planner.getOrCreateAnchor(minX, maxY);

                    const w1 = new PremiumWall(planner, a1, a2, 'outer');
                    const w2 = new PremiumWall(planner, a2, a3, 'outer');
                    const w3 = new PremiumWall(planner, a3, a4, 'outer');
                    const w4 = new PremiumWall(planner, a4, a1, 'outer');

                    planner.walls.push(w1, w2, w3, w4);
                    planner.lastDrawnEntity = w4;
                    this.currentSessionEntities.push(w1, w2, w3, w4);
                }

                this.finishDrawing();
            } else {
                // Wall Chain Mode
                const currentAnchor = planner.getOrCreateAnchor(pt.x, pt.z);
                const isWallEdgeHit = snapResult.isWallEdge && snapResult.wall;

                if (this.lastAnchor && this.lastAnchor !== currentAnchor) {
                    let w;
                    if (rawTool === 'railing') {
                        w = new Railing(planner, this.lastAnchor, currentAnchor);
                    } else {
                        w = new PremiumWall(planner, this.lastAnchor, currentAnchor, wallType);
                    }

                    planner.walls.push(w);
                    planner.lastDrawnEntity = w;
                    this.currentSessionEntities.push(w);

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
        this.startAnchor = null;
        this.lastAnchor = null;
        this.startPoint = null;
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

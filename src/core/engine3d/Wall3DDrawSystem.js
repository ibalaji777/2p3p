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
 * Provides real-time translucent 3D ghost previews, smart corner & wall edge snapping (T-joints),
 * 45° angle guide lines, floating 3D dimension badges, glowing wall snap halos, and full 2D/3D synchronization.
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
        
        // Ghost Preview Container in 3D Scene
        this.ghostGroup = new THREE.Group();
        this.ghostGroup.name = 'Wall3DDraw_GhostGroup';
        this.ghostGroup.visible = false;
        this.ctx.scene.add(this.ghostGroup);
        
        // Snap Indicator Mesh (Outer ring + Inner glowing dot)
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

        this.ghostGroup.add(this.snapIndicatorGroup);

        // Wall Snap Halo Group (Highlights existing wall(s) when snapped)
        this.snapHaloGroup = new THREE.Group();
        this.snapHaloGroup.visible = false;
        this.ghostGroup.add(this.snapHaloGroup);

        this.haloMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.32,
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

        // 45° / Orthogonal Alignment Guide Line
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

        // Floating 3D Dimension Badge Sprite
        this.dimensionSprite = this._createDimensionSprite();
        this.dimensionSprite.visible = false;
        this.ghostGroup.add(this.dimensionSprite);

        this._onKeyDown = this._onKeyDown.bind(this);
        window.addEventListener('keydown', this._onKeyDown);
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

    _createDimensionSprite() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(60, 15, 1);
        sprite.renderOrder = 1004;
        sprite.userData = { canvas, texture };
        return sprite;
    }

    _updateDimensionBadge(text, position) {
        if (!this.dimensionSprite) return;
        const { canvas, texture } = this.dimensionSprite.userData;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw badge background (Sims 4 sleek dark blue CAD badge)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.beginPath();
        ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 12);
        ctx.fill();

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Text
        ctx.font = 'bold 22px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        texture.needsUpdate = true;
        this.dimensionSprite.position.copy(position);
        this.dimensionSprite.visible = true;
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
     * Raycasts cursor ray onto the current active floor plane (y = elevation)
     */
    getFloorIntersection(e) {
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const elev = this.getFloorElevation();
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elev);
        const hit = new THREE.Vector3();

        if (this.raycaster.ray.intersectPlane(floorPlane, hit)) {
            return hit;
        }
        return null;
    }

    /**
     * Smart Snapping: Corner Anchors, Wall Edges (T-Joints), Angle Snapping, and Grid
     */
    getSnappedPoint(raw3DPoint, shiftKey = false) {
        const planner = this.planner;
        const elev = this.getFloorElevation();
        if (!raw3DPoint || !planner) return { point: raw3DPoint, isAnchor: false, isWallEdge: false, connectedWalls: [] };

        const pos2D = { x: raw3DPoint.x, y: raw3DPoint.z };
        let snapDist = SNAP_DIST || 28;
        let bestAnchor = null;
        let minDist = snapDist;

        // 1. Snap to existing corner anchors in 2D
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
                anchor: bestAnchor.anchor,
                connectedWalls: attached
            };
        }

        // 2. Snap to Wall Edges (T-Joints) along existing walls
        let bestWallPoint = null;
        let bestWall = null;
        let minWallDist = snapDist * 0.85;

        (planner.walls || []).forEach(w => {
            if (w.hidden || !w.startAnchor || !w.endAnchor) return;
            const p1 = w.startAnchor.position ? w.startAnchor.position() : { x: w.startAnchor.x, y: w.startAnchor.y };
            const p2 = w.endAnchor.position ? w.endAnchor.position() : { x: w.endAnchor.x, y: w.endAnchor.y };

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq < 1) return;

            let t = ((pos2D.x - p1.x) * dx + (pos2D.y - p1.y) * dy) / lenSq;
            t = Math.max(0.05, Math.min(0.95, t)); // Keep away from corners (corners are caught by anchor snap)

            const projX = p1.x + t * dx;
            const projY = p1.y + t * dy;
            const dist = Math.hypot(pos2D.x - projX, pos2D.y - projY);

            if (dist < minWallDist) {
                minWallDist = dist;
                bestWallPoint = { x: projX, y: projY };
                bestWall = w;
            }
        });

        if (bestWallPoint) {
            return {
                point: new THREE.Vector3(bestWallPoint.x, elev, bestWallPoint.y),
                isAnchor: false,
                isWallEdge: true,
                wall: bestWall,
                connectedWalls: [bestWall]
            };
        }

        let finalX = pos2D.x;
        let finalY = pos2D.y;
        let isAngleSnapped = false;

        // 3. Angle Snapping to 45°/90° increments if chaining from last anchor
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
                if (shiftKey || angleDiff < 0.14) {
                    finalX = p1.x + Math.cos(snapAngle) * len;
                    finalY = p1.y + Math.sin(snapAngle) * len;
                    isAngleSnapped = true;
                }
            }
        }

        // 4. Grid Snapping (5cm increments)
        const gridStep = 5;
        finalX = Math.round(finalX / gridStep) * gridStep;
        finalY = Math.round(finalY / gridStep) * gridStep;

        return {
            point: new THREE.Vector3(finalX, elev, finalY),
            isAnchor: false,
            isWallEdge: false,
            isAngleSnapped,
            connectedWalls: []
        };
    }

    onPointerMove(e) {
        if (!this.isWallDrawingTool()) {
            this.hideGhostMeshes();
            return;
        }

        const rawHit = this.getFloorIntersection(e);
        if (!rawHit) return;

        const snapResult = this.getSnappedPoint(rawHit, e.shiftKey);
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
                    const tVal = (w.thickness || 16) + 2.5; // Slight expansion for halo effect

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

        // 2. Visual Snap Ring & Dot Indicator
        if (snapResult.isAnchor || snapResult.isWallEdge) {
            this.snapIndicatorGroup.position.set(pt.x, elev + 0.6, pt.z);
            this.snapRing.material.color.setHex(snapResult.isAnchor ? 0x10b981 : 0x00f0ff);
            this.snapDot.material.color.setHex(snapResult.isAnchor ? 0x34d399 : 0x38bdf8);
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
                    this._updateDimensionBadge(label, new THREE.Vector3((minX + maxX) / 2, elev + h + 20, (minY + maxY) / 2));
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

                    // Angle Alignment Guide Line
                    const guidePositions = new Float32Array([
                        p1.x, elev + 1, p1.y,
                        p2.x + dx * 0.5, elev + 1, p2.y + dy * 0.5
                    ]);
                    this.guideLine.geometry.setAttribute('position', new THREE.BufferAttribute(guidePositions, 3));
                    this.guideLine.geometry.attributes.position.needsUpdate = true;
                    this.guideLine.computeLineDistances();
                    this.guideLine.visible = true;

                    // Dimension Badge
                    const label = `${(len / 100).toFixed(2)} m`;
                    this._updateDimensionBadge(label, new THREE.Vector3((p1.x + p2.x) / 2, elev + h + 20, (p1.y + p2.y) / 2));
                } else {
                    this.ghostWallMesh.visible = false;
                    this.guideLine.visible = false;
                    this.dimensionSprite.visible = false;
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

        const rawHit = this.getFloorIntersection(e);
        if (!rawHit) return false;

        const snapResult = this.getSnappedPoint(rawHit, e.shiftKey);
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
            // Continue Drawing Session / Place Corner
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

                    // Check if closed back on startAnchor (Completed Room Loop!)
                    if (currentAnchor === this.startAnchor) {
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
        this.dimensionSprite.visible = false;
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        this.hideGhostMeshes();
        if (this.ghostGroup.parent) this.ghostGroup.parent.remove(this.ghostGroup);
    }
}

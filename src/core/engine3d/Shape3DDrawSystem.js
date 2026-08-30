import * as THREE from 'three';
import { SNAP_DIST } from '../registry.js';
import { PremiumShape } from '../engine2d/PremiumShape.js';

/**
 * Shape3DDrawSystem
 * 
 * Enables direct 3D interactive drawing of shapes in the 3D scene:
 * - shape_rect: 3D Box / Cuboid with live W × D × H preview and dimension badge
 * - shape_circle: 3D Cylinder with live Radius and Height preview
 * - shape_triangle: 3D Triangular Prism with point-by-point vertex snapping
 * - shape_polygon: 3D Freeform Extruded Polygon with vertex chain
 * - shape_floor_cut: 3D Floor Cutout Hole with instant floor slab void subtraction
 */
export class Shape3DDrawSystem {
    constructor(ctx, interactionSystem) {
        this.ctx = ctx;
        this.interactions = interactionSystem;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.drawing = false;
        this.startPoint = null;
        this.currentPoint = null;
        this.drawingPoints = []; // For triangle / polygon modes

        // Ghost Container in 3D Scene
        this.ghostGroup = new THREE.Group();
        this.ghostGroup.name = 'Shape3DDraw_GhostGroup';
        this.ghostGroup.visible = false;
        this.ghostGroup.raycast = () => {}; // Zero-occlusion
        this.ctx.scene.add(this.ghostGroup);

        // Materials
        this.ghostMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.5,
            depthTest: false,
            side: THREE.DoubleSide
        });

        this.ghostFloorCutMat = new THREE.MeshBasicMaterial({
            color: 0xef4444,
            transparent: true,
            opacity: 0.45,
            depthTest: false,
            side: THREE.DoubleSide
        });

        this.ghostEdgeMat = new THREE.LineBasicMaterial({
            color: 0x0284c7,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });

        this.ghostFloorCutEdgeMat = new THREE.LineBasicMaterial({
            color: 0xdc2626,
            linewidth: 2.5,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });

        // 3D Ghost Box
        const baseBoxGeo = new THREE.BoxGeometry(1, 1, 1);
        this.ghostBoxMesh = new THREE.Mesh(baseBoxGeo, this.ghostMat);
        this.ghostBoxMesh.renderOrder = 1000;
        this.ghostBoxMesh.raycast = () => {};
        this.ghostBoxEdges = new THREE.LineSegments(new THREE.EdgesGeometry(baseBoxGeo), this.ghostEdgeMat);
        this.ghostBoxEdges.renderOrder = 1001;
        this.ghostBoxEdges.raycast = () => {};
        this.ghostBoxMesh.add(this.ghostBoxEdges);
        this.ghostBoxMesh.visible = false;
        this.ghostGroup.add(this.ghostBoxMesh);

        // 3D Ghost Cylinder
        const baseCylGeo = new THREE.CylinderGeometry(1, 1, 1, 32);
        this.ghostCylMesh = new THREE.Mesh(baseCylGeo, this.ghostMat);
        this.ghostCylMesh.renderOrder = 1000;
        this.ghostCylMesh.raycast = () => {};
        this.ghostCylEdges = new THREE.LineSegments(new THREE.EdgesGeometry(baseCylGeo), this.ghostEdgeMat);
        this.ghostCylEdges.renderOrder = 1001;
        this.ghostCylEdges.raycast = () => {};
        this.ghostCylMesh.add(this.ghostCylEdges);
        this.ghostCylMesh.visible = false;
        this.ghostGroup.add(this.ghostCylMesh);

        // 3D Ghost Polygon / Prism
        this.ghostPrismMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMat);
        this.ghostPrismMesh.renderOrder = 1000;
        this.ghostPrismMesh.raycast = () => {};
        this.ghostPrismMesh.visible = false;
        this.ghostGroup.add(this.ghostPrismMesh);

        this.ghostPrismEdges = new THREE.LineSegments(new THREE.BufferGeometry(), this.ghostEdgeMat);
        this.ghostPrismEdges.renderOrder = 1001;
        this.ghostPrismEdges.raycast = () => {};
        this.ghostPrismEdges.visible = false;
        this.ghostGroup.add(this.ghostPrismEdges);

        // Rubberband Guide Line
        this.guideLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
            new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2, depthTest: false, transparent: true, opacity: 0.9 })
        );
        this.guideLine.renderOrder = 1002;
        this.guideLine.raycast = () => {};
        this.guideLine.visible = false;
        this.ghostGroup.add(this.guideLine);

        // Vertex Marker Ring
        const ringGeo = new THREE.RingGeometry(2.5, 4.5, 32);
        ringGeo.rotateX(-Math.PI / 2);
        this.vertexMarker = new THREE.Mesh(
            ringGeo,
            new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
        );
        this.vertexMarker.renderOrder = 1003;
        this.vertexMarker.raycast = () => {};
        this.vertexMarker.visible = false;
        this.ghostGroup.add(this.vertexMarker);

        this._createDOMBadge();

        this._onKeyDown = this._onKeyDown.bind(this);
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', this._onKeyDown);
        }
    }

    _createDOMBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'shape3d-live-dimension-badge';
        this.domBadge.style.cssText = `
            position: absolute;
            display: none;
            pointer-events: none;
            transform: translate(-50%, -100%);
            padding: 7px 16px;
            border-radius: 20px;
            background: rgba(15, 23, 42, 0.94);
            border: 2px solid #00f0ff;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 240, 255, 0.35);
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

    _updateDOMBadge(text, screenPos, isFloorCut = false) {
        if (!this.domBadge) return;
        if (!text || !screenPos) {
            this.domBadge.style.display = 'none';
            return;
        }
        this.domBadge.innerHTML = text;
        this.domBadge.style.borderColor = isFloorCut ? '#ef4444' : '#00f0ff';
        this.domBadge.style.boxShadow = isFloorCut
            ? '0 6px 20px rgba(0,0,0,0.6), 0 0 16px rgba(239,68,68,0.4)'
            : '0 6px 20px rgba(0,0,0,0.6), 0 0 16px rgba(0,240,255,0.35)';
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

    isShapeDrawingTool(customTool) {
        const planner = this.getPlanner();
        const tool = customTool || planner?.tool;
        if (!tool) return false;
        return (
            tool === 'shape_rect' ||
            tool === 'shape_circle' ||
            tool === 'shape_triangle' ||
            tool === 'shape_polygon' ||
            tool === 'shape_floor_cut' ||
            tool === 'shape_box' ||
            tool === 'shape_cyl' ||
            tool === 'shape_prism' ||
            tool === 'shape_catalog'
        );
    }

    getNormalizedTool() {
        const planner = this.getPlanner();
        const tool = planner?.tool;
        if (tool === 'shape_box' || tool === 'shape_catalog') return 'shape_rect';
        if (tool === 'shape_cyl') return 'shape_circle';
        if (tool === 'shape_prism') return 'shape_triangle';
        return tool || 'shape_rect';
    }

    getElevation() {
        const planner = this.getPlanner();
        if (!planner) return 0;
        if (planner.levelManager && typeof planner.levelManager.getCurrentLevelElevation === 'function') {
            return planner.levelManager.getCurrentLevelElevation();
        }
        if (planner.activeLevelIndex !== undefined && planner.levels && planner.levels[planner.activeLevelIndex]) {
            return Number(planner.levels[planner.activeLevelIndex].elevation) || 0;
        }
        return 0;
    }

    getRaycastHit(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom || !this.ctx.camera) return null;
        const rect = dom.getBoundingClientRect();
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const elev = this.getElevation();

        // 1. Raycast against floor plane at level elevation
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elev);
        const hitPoint = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
            return { point: hitPoint, screenX: clientX - rect.left, screenY: clientY - rect.top };
        }

        // 2. Fallback: Raycast against existing 3D floor slabs
        const interactables = this.ctx.interactables || [];
        const floorMeshes = interactables.filter(m => m.userData?.isFloor || m.userData?.isFloorCutProxy);
        if (floorMeshes.length > 0) {
            const hits = this.raycaster.intersectObjects(floorMeshes, true);
            if (hits.length > 0) {
                const pt = hits[0].point;
                return { point: pt, screenX: clientX - rect.left, screenY: clientY - rect.top };
            }
        }

        return null;
    }

    toScreenSpace(worldPos) {
        if (!this.ctx.camera || !this.ctx.renderer) return { x: 0, y: 0 };
        const v = worldPos.clone().project(this.ctx.camera);
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        return {
            x: ((v.x + 1) / 2) * rect.width,
            y: ((-v.y + 1) / 2) * rect.height
        };
    }

    onPointerMove(e) {
        if (!this.isShapeDrawingTool()) {
            this.hideGhost();
            return false;
        }

        const hit = this.getRaycastHit(e);
        if (!hit) {
            this.hideGhost();
            return false;
        }

        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = false;
        }
        if (this.ctx && this.ctx.renderer) {
            this.ctx.renderer.domElement.style.cursor = 'crosshair';
        }

        const tool = this.getNormalizedTool();
        const pt = hit.point;
        this.currentPoint = pt;

        // Position vertex ring
        this.vertexMarker.position.copy(pt);
        this.vertexMarker.position.y += 0.2;
        this.vertexMarker.visible = true;
        this.ghostGroup.visible = true;

        const planner = this.getPlanner();
        const isFloorCut = tool === 'shape_floor_cut';
        const height3D = planner?.activePresetParams?.height3D || 100;
        const cy = this.getElevation();

        if (this.drawing && this.startPoint) {
            if (tool === 'shape_rect' || (isFloorCut && this.drawingPoints.length === 0)) {
                // Box Preview
                const minX = Math.min(this.startPoint.x, pt.x);
                const maxX = Math.max(this.startPoint.x, pt.x);
                const minZ = Math.min(this.startPoint.z, pt.z);
                const maxZ = Math.max(this.startPoint.z, pt.z);

                const w = Math.max(1, maxX - minX);
                const d = Math.max(1, maxZ - minZ);
                const cx = (minX + maxX) / 2;
                const cz = (minZ + maxZ) / 2;

                this.ghostBoxMesh.material = isFloorCut ? this.ghostFloorCutMat : this.ghostMat;
                this.ghostBoxEdges.material = isFloorCut ? this.ghostFloorCutEdgeMat : this.ghostEdgeMat;

                this.ghostBoxMesh.scale.set(w, isFloorCut ? 4 : height3D, d);
                this.ghostBoxMesh.position.set(cx, cy + (isFloorCut ? 2 : height3D / 2), cz);
                this.ghostBoxMesh.visible = true;
                this.ghostCylMesh.visible = false;
                this.ghostPrismMesh.visible = false;
                this.ghostPrismEdges.visible = false;

                const centerScreen = this.toScreenSpace(new THREE.Vector3(cx, cy + (isFloorCut ? 4 : height3D), cz));
                const label = isFloorCut ? 'Floor Cut' : 'Box';
                const badgeText = `<strong>${label}</strong>: ${w.toFixed(0)} × ${d.toFixed(0)}${!isFloorCut ? ` (H: ${height3D})` : ''}`;
                this._updateDOMBadge(badgeText, centerScreen, isFloorCut);

            } else if (tool === 'shape_circle') {
                // Cylinder Preview
                const dx = pt.x - this.startPoint.x;
                const dz = pt.z - this.startPoint.z;
                const r = Math.max(1, Math.hypot(dx, dz));

                this.ghostCylMesh.scale.set(r, height3D, r);
                this.ghostCylMesh.position.set(this.startPoint.x, cy + height3D / 2, this.startPoint.z);
                this.ghostCylMesh.visible = true;
                this.ghostBoxMesh.visible = false;
                this.ghostPrismMesh.visible = false;
                this.ghostPrismEdges.visible = false;

                const centerScreen = this.toScreenSpace(new THREE.Vector3(this.startPoint.x, cy + height3D, this.startPoint.z));
                const badgeText = `<strong>Cylinder</strong>: Radius ${r.toFixed(0)} (H: ${height3D})`;
                this._updateDOMBadge(badgeText, centerScreen, false);

            } else if (tool === 'shape_triangle' || tool === 'shape_polygon' || (isFloorCut && this.drawingPoints.length > 0)) {
                // Point chain preview
                const startP = this.drawingPoints[0];
                const distToStartWorld = startP ? Math.hypot(pt.x - startP.x, pt.z - startP.z) : Infinity;
                const startScreen = startP ? this.toScreenSpace(new THREE.Vector3(startP.x, cy, startP.z)) : { x: -999, y: -999 };
                const distToStartScreen = Math.hypot(hit.screenX - startScreen.x, hit.screenY - startScreen.y);
                const isNearStart = this.drawingPoints.length >= 3 && (distToStartWorld < 35 || distToStartScreen < 35);
                const targetPt = isNearStart ? startP.clone() : pt;

                const allPts = [...this.drawingPoints, targetPt];
                this._updatePolygonGhost(allPts, height3D, isFloorCut);

                if (isNearStart) {
                    this.vertexMarker.position.set(startP.x, cy + 0.3, startP.z);
                    this.vertexMarker.material.color.setHex(0x10b981); // Emerald green for close snap
                } else {
                    this.vertexMarker.material.color.setHex(0x00f0ff);
                }

                const centerScreen = this.toScreenSpace(new THREE.Vector3(targetPt.x, cy + height3D, targetPt.z));
                const count = this.drawingPoints.length;
                const label = tool === 'shape_triangle' ? `Prism (Point ${count}/3)` : `Polygon (${count} points)`;
                const actionHint = isNearStart ? 'Click to close shape' : 'Click next point • <em>Double-click</em> to finish';
                this._updateDOMBadge(`<strong>${label}</strong>: ${actionHint}`, centerScreen, isFloorCut);
            }
        } else {
            // Hovering before first click
            const label = tool === 'shape_rect' ? 'Box: Click to start drawing' :
                          tool === 'shape_circle' ? 'Cylinder: Click center' :
                          tool === 'shape_triangle' ? 'Prism: Click point 1' :
                          tool === 'shape_floor_cut' ? 'Floor Cut: Click to draw hole' : 'Polygon: Click to start points';
            const screenPos = this.toScreenSpace(pt);
            this._updateDOMBadge(label, screenPos, isFloorCut);
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
        return true;
    }

    _updatePolygonGhost(pts, height3D, isFloorCut) {
        if (pts.length < 2) return;
        const cy = this.getElevation();

        if (pts.length === 2) {
            // Rubberband guide line
            const posAttr = this.guideLine.geometry.attributes.position;
            posAttr.setXYZ(0, pts[0].x, cy + 0.5, pts[0].z);
            posAttr.setXYZ(1, pts[1].x, cy + 0.5, pts[1].z);
            posAttr.needsUpdate = true;
            this.guideLine.visible = true;
            this.ghostPrismMesh.visible = false;
            this.ghostPrismEdges.visible = false;
            return;
        }

        this.guideLine.visible = false;

        // Construct 2D Shape for extrusion
        const shape2d = new THREE.Shape();
        shape2d.moveTo(pts[0].x, -pts[0].z);
        for (let i = 1; i < pts.length; i++) {
            shape2d.lineTo(pts[i].x, -pts[i].z);
        }
        shape2d.closePath();

        const depth = isFloorCut ? 4 : height3D;
        const geo = new THREE.ExtrudeGeometry(shape2d, { depth: depth, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, cy, 0);

        if (this.ghostPrismMesh.geometry) this.ghostPrismMesh.geometry.dispose();
        if (this.ghostPrismEdges.geometry) this.ghostPrismEdges.geometry.dispose();

        this.ghostPrismMesh.geometry = geo;
        this.ghostPrismMesh.material = isFloorCut ? this.ghostFloorCutMat : this.ghostMat;
        this.ghostPrismMesh.visible = true;

        this.ghostPrismEdges.geometry = new THREE.EdgesGeometry(geo);
        this.ghostPrismEdges.material = isFloorCut ? this.ghostFloorCutEdgeMat : this.ghostEdgeMat;
        this.ghostPrismEdges.visible = true;
    }

    _finishPolygon(planner, height3D, isFloorCut, currentElev) {
        if (!this.drawingPoints || this.drawingPoints.length < 3) return;

        // Clean up duplicate or near-collinear closing points
        const rawPts = this.drawingPoints.map(p => ({ x: p.x, y: p.z }));
        const pts = [];
        for (let i = 0; i < rawPts.length; i++) {
            if (pts.length === 0 || Math.hypot(rawPts[i].x - pts[pts.length - 1].x, rawPts[i].y - pts[pts.length - 1].y) > 0.5) {
                pts.push(rawPts[i]);
            }
        }
        if (pts.length > 2 && Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) < 1.0) {
            pts.pop();
        }
        if (pts.length < 3) return;

        let cx = 0, cz = 0;
        pts.forEach(p => { cx += p.x; cz += p.y; });
        cx /= pts.length; cz /= pts.length;
        const relPts = pts.map(p => ({ x: p.x - cx, y: p.y - cz }));

        if (isFloorCut) {
            const newShape = new PremiumShape(planner, 'shape_floor_cut', {
                x: cx,
                y: cz,
                points: relPts,
                stroke: '#ef4444',
                fill: 'rgba(239, 68, 68, 0.2)'
            });
            newShape.elevation = currentElev;
            if (!planner.shapes) planner.shapes = [];
            planner.shapes.push(newShape);
            planner.selectEntity(newShape, 'shape');
        } else {
            const newShape = new PremiumShape(planner, 'shape_polygon', {
                x: cx,
                y: cz,
                points: relPts,
                height3D: height3D
            });
            newShape.elevation = currentElev;
            if (!planner.shapes) planner.shapes = [];
            planner.shapes.push(newShape);
            planner.selectEntity(newShape, 'shape');
        }
        this._commitAndFinish(planner);
    }

    onPointerDown(e) {
        if (!this.isShapeDrawingTool()) return false;
        if (e.button !== 0) return false;

        const hit = this.getRaycastHit(e);
        if (!hit) return false;

        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = false;
        }

        const tool = this.getNormalizedTool();
        const pt = hit.point;
        const planner = this.getPlanner();
        if (!planner) return false;

        const height3D = planner.activePresetParams?.height3D || 100;
        const isFloorCut = tool === 'shape_floor_cut';
        const currentElev = this.getElevation();

        const now = Date.now();
        const isDblClick = (this.lastTapTime && now - this.lastTapTime < 450) || (e.detail && e.detail >= 2);
        this.lastTapTime = now;

        if (!this.drawing) {
            // First Click
            this.drawing = true;
            this.startPoint = pt.clone();

            if (tool === 'shape_triangle' || tool === 'shape_polygon') {
                this.drawingPoints = [pt.clone()];
            } else if (isFloorCut) {
                this.drawingPoints = []; // will use box cut if released/2nd clicked, or polygon if clicked points
            }

            if (this.ctx.requestRender) this.ctx.requestRender();
            return true;
        } else {
            // Check double click completion for polygon or polygon floor cut
            if (isDblClick && (tool === 'shape_polygon' || (isFloorCut && this.drawingPoints.length >= 2))) {
                if (this.drawingPoints.length >= 3) {
                    this._finishPolygon(planner, height3D, isFloorCut, currentElev);
                    return true;
                }
            }

            // Second / Subsequent Click
            if (tool === 'shape_rect' || (isFloorCut && this.drawingPoints.length === 0)) {
                const minX = Math.min(this.startPoint.x, pt.x);
                const maxX = Math.max(this.startPoint.x, pt.x);
                const minZ = Math.min(this.startPoint.z, pt.z);
                const maxZ = Math.max(this.startPoint.z, pt.z);

                const w = maxX - minX;
                const d = maxZ - minZ;

                if (w > 2 && d > 2) {
                    const cx = (minX + maxX) / 2;
                    const cz = (minZ + maxZ) / 2;

                    if (isFloorCut) {
                        const newShape = new PremiumShape(planner, 'shape_floor_cut', {
                            x: cx,
                            y: cz,
                            width: w,
                            height: d,
                            stroke: '#ef4444',
                            fill: 'rgba(239, 68, 68, 0.2)'
                        });
                        newShape.elevation = currentElev;
                        if (!planner.shapes) planner.shapes = [];
                        planner.shapes.push(newShape);
                        planner.selectEntity(newShape, 'shape');
                    } else {
                        const newShape = new PremiumShape(planner, 'shape_rect', {
                            x: cx,
                            y: cz,
                            width: w,
                            height: d,
                            height3D: height3D
                        });
                        newShape.elevation = currentElev;
                        if (!planner.shapes) planner.shapes = [];
                        planner.shapes.push(newShape);
                        planner.selectEntity(newShape, 'shape');
                    }
                    this._commitAndFinish(planner);
                }
                return true;

            } else if (tool === 'shape_circle') {
                const dx = pt.x - this.startPoint.x;
                const dz = pt.z - this.startPoint.z;
                const r = Math.hypot(dx, dz);

                if (r > 2) {
                    const newShape = new PremiumShape(planner, 'shape_circle', {
                        x: this.startPoint.x,
                        y: this.startPoint.z,
                        radius: r,
                        height3D: height3D
                    });
                    newShape.elevation = currentElev;
                    if (!planner.shapes) planner.shapes = [];
                    planner.shapes.push(newShape);
                    planner.selectEntity(newShape, 'shape');
                    this._commitAndFinish(planner);
                }
                return true;

            } else if (tool === 'shape_triangle') {
                this.drawingPoints.push(pt.clone());
                if (this.drawingPoints.length === 3) {
                    const pts = this.drawingPoints.map(p => ({ x: p.x, y: p.z }));
                    let cx = 0, cz = 0;
                    pts.forEach(p => { cx += p.x; cz += p.y; });
                    cx /= 3; cz /= 3;
                    const relPts = pts.map(p => ({ x: p.x - cx, y: p.y - cz }));

                    const newShape = new PremiumShape(planner, 'shape_polygon', {
                        x: cx,
                        y: cz,
                        points: relPts,
                        height3D: height3D
                    });
                    newShape.elevation = currentElev;
                    if (!planner.shapes) planner.shapes = [];
                    planner.shapes.push(newShape);
                    planner.selectEntity(newShape, 'shape');
                    this._commitAndFinish(planner);
                }
                return true;

            } else if (tool === 'shape_polygon' || (isFloorCut && this.drawingPoints.length > 0)) {
                const startP = this.drawingPoints[0];
                const distToStartWorld = Math.hypot(pt.x - startP.x, pt.z - startP.z);
                const startScreen = this.toScreenSpace(new THREE.Vector3(startP.x, currentElev, startP.z));
                const distToStartScreen = Math.hypot(hit.screenX - startScreen.x, hit.screenY - startScreen.y);

                if (this.drawingPoints.length >= 3 && (distToStartWorld < 35 || distToStartScreen < 35)) {
                    // Close polygon at start vertex
                    this._finishPolygon(planner, height3D, isFloorCut, currentElev);
                } else {
                    this.drawingPoints.push(pt.clone());
                }
                return true;
            }
        }

        return false;
    }

    onPointerUp(e) {
        if (!this.isShapeDrawingTool() || !this.drawing || !this.startPoint) return false;
        const tool = this.getNormalizedTool();
        if (tool === 'shape_triangle' || tool === 'shape_polygon') return false; // Multi-click tools

        const hit = this.getRaycastHit(e);
        if (!hit) return false;
        const pt = hit.point;
        const planner = this.getPlanner();
        if (!planner) return false;

        const isFloorCut = tool === 'shape_floor_cut';
        const height3D = planner.activePresetParams?.height3D || 100;
        const currentElev = this.getElevation();

        if (tool === 'shape_rect' || isFloorCut) {
            const minX = Math.min(this.startPoint.x, pt.x);
            const maxX = Math.max(this.startPoint.x, pt.x);
            const minZ = Math.min(this.startPoint.z, pt.z);
            const maxZ = Math.max(this.startPoint.z, pt.z);

            const w = maxX - minX;
            const d = maxZ - minZ;

            // Complete on pointerUp if dragged significantly (>= 3 units)
            if (w >= 3 && d >= 3) {
                const cx = (minX + maxX) / 2;
                const cz = (minZ + maxZ) / 2;

                if (isFloorCut) {
                    const newShape = new PremiumShape(planner, 'shape_floor_cut', {
                        x: cx,
                        y: cz,
                        width: w,
                        height: d,
                        stroke: '#ef4444',
                        fill: 'rgba(239, 68, 68, 0.2)'
                    });
                    newShape.elevation = currentElev;
                    if (!planner.shapes) planner.shapes = [];
                    planner.shapes.push(newShape);
                    planner.selectEntity(newShape, 'shape');
                } else {
                    const newShape = new PremiumShape(planner, 'shape_rect', {
                        x: cx,
                        y: cz,
                        width: w,
                        height: d,
                        height3D: height3D
                    });
                    newShape.elevation = currentElev;
                    if (!planner.shapes) planner.shapes = [];
                    planner.shapes.push(newShape);
                    planner.selectEntity(newShape, 'shape');
                }
                this._commitAndFinish(planner);
                return true;
            }
        } else if (tool === 'shape_circle') {
            const dx = pt.x - this.startPoint.x;
            const dz = pt.z - this.startPoint.z;
            const r = Math.hypot(dx, dz);

            if (r >= 3) {
                const newShape = new PremiumShape(planner, 'shape_circle', {
                    x: this.startPoint.x,
                    y: this.startPoint.z,
                    radius: r,
                    height3D: height3D
                });
                newShape.elevation = currentElev;
                if (!planner.shapes) planner.shapes = [];
                planner.shapes.push(newShape);
                planner.selectEntity(newShape, 'shape');
                this._commitAndFinish(planner);
                return true;
            }
        }

        return false;
    }

    _commitAndFinish(planner) {
        this.drawing = false;
        this.startPoint = null;
        this.drawingPoints = [];
        this.hideGhost();

        if (planner.tool !== 'select') {
            planner.tool = 'select';
            planner.updateToolStates();
            if (planner.onToolChange) planner.onToolChange('select');
        }

        if (planner.syncAll) planner.syncAll();
        
        // Trigger In-Place CAD 3D Scene Rebuild with preserved camera
        if (this.ctx.buildScene && planner) {
            const levelsConfigArray = (planner.levels || []).map(l => ({ data: l.data, isVisible: l.isVisible !== false }));
            this.ctx.buildScene(
                planner.walls || [],
                planner.rooms || [],
                planner.stairs || [],
                planner.furniture || [],
                planner.roofs || [],
                planner.shapes || [],
                levelsConfigArray,
                planner.activeLevelIndex || 0,
                this.ctx.viewMode3D || 'full-edit',
                true, // Preserve camera orientation & zoom
                planner.outdoorZones || []
            );
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    _onKeyDown(e) {
        if (e.key === 'Escape' && this.drawing) {
            this.cancelDrawing();
        } else if ((e.key === 'Enter' || e.key === ' ') && this.drawing && this.drawingPoints.length >= 3) {
            const planner = this.getPlanner();
            if (planner) {
                const height3D = planner.activePresetParams?.height3D || 100;
                const isFloorCut = this.getNormalizedTool() === 'shape_floor_cut';
                const currentElev = this.getElevation();
                this._finishPolygon(planner, height3D, isFloorCut, currentElev);
            }
        }
    }

    cancelDrawing() {
        this.drawing = false;
        this.startPoint = null;
        this.drawingPoints = [];
        this.hideGhost();
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    hideGhost() {
        this.ghostGroup.visible = false;
        this.ghostBoxMesh.visible = false;
        this.ghostCylMesh.visible = false;
        this.ghostPrismMesh.visible = false;
        this.ghostPrismEdges.visible = false;
        this.guideLine.visible = false;
        this.vertexMarker.visible = false;
        this._hideDOMBadge();

        if (this.ctx && this.ctx.controls) {
            this.ctx.controls.enableRotate = (this.interactions?.mode === 'camera');
        }
        if (this.ctx && this.ctx.renderer) {
            this.ctx.renderer.domElement.style.cursor = (this.interactions?.mode === 'camera') ? 'grab' : 'auto';
        }
    }

    destroy() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this._onKeyDown);
        }
        if (this.domBadge && this.domBadge.parentElement) {
            this.domBadge.parentElement.removeChild(this.domBadge);
        }
        if (this.ghostGroup && this.ghostGroup.parent) {
            this.ghostGroup.parent.remove(this.ghostGroup);
        }
    }
}

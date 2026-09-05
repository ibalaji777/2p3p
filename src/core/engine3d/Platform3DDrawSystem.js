import * as THREE from 'three';
import { PremiumPlatform } from '../engine2d/PremiumPlatform.js';
import { Platform3DBuilder } from './Platform3DBuilder.js';

/**
 * Platform3DDrawSystem
 * 
 * Direct 3D interactive drawing and placement system for Sims 4-style platforms:
 * - platform / platform_rect: Click & drag to place a rectangular platform with live 3D preview and step badge.
 * - platform_polygon: Click point-by-point to draw custom polygonal platforms in 3D.
 */
export class Platform3DDrawSystem {
    constructor(ctx, interactionSystem) {
        this.ctx = ctx;
        this.interactions = interactionSystem;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.drawing = false;
        this.startPoint = null;
        this.currentPoint = null;
        this.drawingPoints = []; // For polygon mode

        this.builder = new Platform3DBuilder(ctx);

        // Ghost Container in 3D Scene
        this.ghostGroup = new THREE.Group();
        this.ghostGroup.name = 'Platform3DDraw_GhostGroup';
        this.ghostGroup.visible = false;
        this.ghostGroup.raycast = () => {}; // Zero-occlusion
        this.ctx.scene.add(this.ghostGroup);

        // Ghost Materials
        this.ghostMat = new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            transparent: true,
            opacity: 0.5,
            depthTest: false,
            side: THREE.DoubleSide
        });

        this.ghostEdgeMat = new THREE.LineBasicMaterial({
            color: 0xd97706,
            linewidth: 2,
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

        // 3D Ghost Polygon Mesh & Edges
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
            new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2, depthTest: false, transparent: true, opacity: 0.9 })
        );
        this.guideLine.renderOrder = 1002;
        this.guideLine.raycast = () => {};
        this.guideLine.visible = false;
        this.ghostGroup.add(this.guideLine);

        // Vertex Marker Ring (for polygon snap closing)
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
        this.domBadge.className = 'platform3d-live-dimension-badge';
        this.domBadge.style.cssText = `
            position: absolute;
            display: none;
            pointer-events: none;
            transform: translate(-50%, -100%);
            padding: 8px 18px;
            border-radius: 20px;
            background: rgba(15, 23, 42, 0.95);
            border: 2px solid #f59e0b;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(245, 158, 11, 0.4);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.5px;
            white-space: nowrap;
            z-index: 9999;
            backdrop-filter: blur(10px);
            user-select: none;
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

    isPlatformDrawingTool(customTool) {
        const planner = this.getPlanner();
        const tool = customTool || planner?.tool;
        if (!tool) return false;
        return (
            tool === 'platform' ||
            tool === 'platform_rect' ||
            tool === 'platform_polygon' ||
            tool === 'platform_catalog'
        );
    }

    getNormalizedTool() {
        const planner = this.getPlanner();
        const tool = planner?.tool;
        if (tool === 'platform_catalog' || tool === 'platform') return 'platform_rect';
        return tool || 'platform_rect';
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

        // 1. Raycast against existing platforms (for stacking)
        const interactables = this.ctx.interactables || [];
        const platformTopMeshes = interactables.filter(m => m.userData?.isPlatformTop || m.userData?.isPlatform);
        if (platformTopMeshes.length > 0) {
            const hits = this.raycaster.intersectObjects(platformTopMeshes, true);
            if (hits.length > 0) {
                const pt = hits[0].point;
                return { point: pt, screenX: clientX - rect.left, screenY: clientY - rect.top, hitPlatform: hits[0].object.userData?.entity };
            }
        }

        // 2. Raycast against floor plane at level elevation
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elev);
        const hitPoint = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
            return { point: hitPoint, screenX: clientX - rect.left, screenY: clientY - rect.top };
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
        if (!this.isPlatformDrawingTool()) {
            this.hideGhost();
            return false;
        }

        const hit = this.getRaycastHit(e);
        if (!hit) {
            this.hideGhost();
            return false;
        }

        const pt = hit.point;
        this.currentPoint = pt;
        this.ghostGroup.visible = true;

        const tool = this.getNormalizedTool();
        const planner = this.getPlanner();
        const height = Number(planner?.activePresetParams?.height) || 20;
        const cy = hit.hitPlatform ? hit.point.y : this.getElevation();

        if (this.drawing && this.startPoint) {
            if (tool === 'platform_rect') {
                // Box Preview
                const minX = Math.min(this.startPoint.x, pt.x);
                const maxX = Math.max(this.startPoint.x, pt.x);
                const minZ = Math.min(this.startPoint.z, pt.z);
                const maxZ = Math.max(this.startPoint.z, pt.z);

                const w = Math.max(1, maxX - minX);
                const d = Math.max(1, maxZ - minZ);
                const cx = (minX + maxX) / 2;
                const cz = (minZ + maxZ) / 2;

                const stepCount = Math.max(1, Math.round(Math.abs(height) / 15));
                const stepsLabel = stepCount === 1 ? '1 Step' : `${stepCount} Steps`;

                this.ghostBoxMesh.scale.set(w, Math.abs(height), d);
                this.ghostBoxMesh.position.set(cx, cy + Math.abs(height) / 2, cz);
                this.ghostBoxMesh.visible = true;
                this.ghostPrismMesh.visible = false;
                this.ghostPrismEdges.visible = false;

                const centerScreen = this.toScreenSpace(new THREE.Vector3(cx, cy + Math.abs(height), cz));
                const badgeText = `<strong>Platform</strong>: ${w.toFixed(0)} × ${d.toFixed(0)} cm (H: ${height}cm, ${stepsLabel})`;
                this._updateDOMBadge(badgeText, centerScreen);

            } else if (tool === 'platform_polygon') {
                // Point chain preview
                const startP = this.drawingPoints[0];
                const distToStartWorld = startP ? Math.hypot(pt.x - startP.x, pt.z - startP.z) : Infinity;
                const startScreen = startP ? this.toScreenSpace(new THREE.Vector3(startP.x, cy, startP.z)) : { x: -999, y: -999 };
                const distToStartScreen = Math.hypot(hit.screenX - startScreen.x, hit.screenY - startScreen.y);
                const isNearStart = this.drawingPoints.length >= 3 && (distToStartWorld < 35 || distToStartScreen < 35);
                const targetPt = isNearStart ? startP.clone() : pt;

                const allPts = [...this.drawingPoints, targetPt];
                this._updatePolygonGhost(allPts, height);

                if (isNearStart) {
                    this.vertexMarker.position.set(startP.x, cy + 0.3, startP.z);
                    this.vertexMarker.material.color.setHex(0x10b981);
                } else {
                    this.vertexMarker.material.color.setHex(0x00f0ff);
                }

                const centerScreen = this.toScreenSpace(new THREE.Vector3(targetPt.x, cy + height, targetPt.z));
                const count = this.drawingPoints.length;
                const actionHint = isNearStart ? 'Click to close platform' : 'Click next point • <em>Double-click</em> to finish';
                this._updateDOMBadge(`<strong>Custom Platform (${count} points)</strong>: ${actionHint}`, centerScreen);
            }
        } else {
            // Hovering before first click
            const label = tool === 'platform_rect' 
                ? 'Platform: Click & drag to draw (or single click to place 120×120)' 
                : 'Custom Platform: Click to place points';
            const screenPos = this.toScreenSpace(pt);
            this._updateDOMBadge(label, screenPos);
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
        return true;
    }

    _updatePolygonGhost(pts, height) {
        if (pts.length < 2) return;
        const cy = this.getElevation();

        if (pts.length === 2) {
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

        const shape2d = new THREE.Shape();
        shape2d.moveTo(pts[0].x, -pts[0].z);
        for (let i = 1; i < pts.length; i++) {
            shape2d.lineTo(pts[i].x, -pts[i].z);
        }
        shape2d.closePath();

        const geo = new THREE.ExtrudeGeometry(shape2d, { depth: Math.abs(height), bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, cy, 0);

        if (this.ghostPrismMesh.geometry) this.ghostPrismMesh.geometry.dispose();
        if (this.ghostPrismEdges.geometry) this.ghostPrismEdges.geometry.dispose();

        this.ghostPrismMesh.geometry = geo;
        this.ghostPrismMesh.visible = true;

        this.ghostPrismEdges.geometry = new THREE.EdgesGeometry(geo);
        this.ghostPrismEdges.visible = true;
    }

    onPointerDown(e) {
        if (!this.isPlatformDrawingTool()) return false;
        const hit = this.getRaycastHit(e);
        if (!hit) return false;

        const tool = this.getNormalizedTool();
        const pt = hit.point;

        if (tool === 'platform_rect') {
            this.drawing = true;
            this.startPoint = pt.clone();
            this.startHitPlatform = hit.hitPlatform || null;
            return true;
        } else if (tool === 'platform_polygon') {
            const cy = this.getElevation();
            if (!this.drawing) {
                this.drawing = true;
                this.drawingPoints = [pt.clone()];
                this.vertexMarker.position.set(pt.x, cy + 0.3, pt.z);
                this.vertexMarker.visible = true;
            } else {
                const startP = this.drawingPoints[0];
                const dist = Math.hypot(pt.x - startP.x, pt.z - startP.z);
                if (this.drawingPoints.length >= 3 && dist < 35) {
                    // Close polygon
                    this._finishPolygon();
                } else {
                    this.drawingPoints.push(pt.clone());
                }
            }
            return true;
        }
        return false;
    }

    onPointerUp(e) {
        if (!this.drawing) return false;
        const tool = this.getNormalizedTool();

        if (tool === 'platform_rect' && this.startPoint) {
            const hit = this.getRaycastHit(e);
            const pt = hit ? hit.point : (this.currentPoint || this.startPoint);

            let w = Math.abs(pt.x - this.startPoint.x);
            let d = Math.abs(pt.z - this.startPoint.z);
            let cx = (this.startPoint.x + pt.x) / 2;
            let cz = (this.startPoint.z + pt.z) / 2;

            // If clicked without dragging (or < 10cm), place standard preset platform
            if (w < 10 && d < 10) {
                w = 120;
                d = 120;
                cx = this.startPoint.x;
                cz = this.startPoint.z;
            }

            const planner = this.getPlanner();
            const params = planner?.activePresetParams || {};
            const height = Number(params.height) || 20;
            const elevation = this.startHitPlatform ? (this.startHitPlatform.elevation || 0) + (this.startHitPlatform.height || 0) : 0;

            const newPlatform = new PremiumPlatform(planner, 'platform', {
                x: Math.round(cx),
                y: Math.round(cz),
                width: Math.round(w),
                depth: Math.round(d),
                height: height,
                stepHeight: params.stepHeight || 15,
                elevation: elevation,
                trimStyle: params.trimStyle || 'flat',
                materials: params.materials || null
            });

            if (!planner.platforms) planner.platforms = [];
            planner.platforms.push(newPlatform);

            // Build 3D mesh
            this.builder.buildPlatform(newPlatform, this.ctx.structureGroup);

            // Select in planner
            planner.tool = 'select';
            if (planner.updateToolStates) planner.updateToolStates();
            if (planner.onToolChange) planner.onToolChange('select');
            planner.selectEntity(newPlatform, 'platform');
            if (this.interactions) {
                this.interactions.selectObject(newPlatform.mesh3D, null, true);
            }

            this.hideGhost();
            this.drawing = false;
            this.startPoint = null;
            if (planner.debouncedSaveHistory) planner.debouncedSaveHistory();
            if (this.ctx.requestRender) this.ctx.requestRender();
            return true;
        }

        return false;
    }

    _finishPolygon() {
        if (!this.drawingPoints || this.drawingPoints.length < 3) return;
        const planner = this.getPlanner();
        const params = planner?.activePresetParams || {};
        const height = Number(params.height) || 20;

        // Clean collinear / close points
        const rawPts = this.drawingPoints.map(p => ({ x: p.x, y: p.z }));
        let cx = 0, cz = 0;
        rawPts.forEach(p => { cx += p.x; cz += p.y; });
        cx /= rawPts.length;
        cz /= rawPts.length;

        const relPts = rawPts.map(p => ({ x: p.x - cx, y: p.y - cz }));

        const newPlatform = new PremiumPlatform(planner, 'platform', {
            x: Math.round(cx),
            y: Math.round(cz),
            shapeType: 'polygon',
            points: relPts,
            height: height,
            stepHeight: params.stepHeight || 15,
            trimStyle: params.trimStyle || 'flat',
            materials: params.materials || null
        });

        if (!planner.platforms) planner.platforms = [];
        planner.platforms.push(newPlatform);

        this.builder.buildPlatform(newPlatform, this.ctx.structureGroup);

        planner.tool = 'select';
        if (planner.updateToolStates) planner.updateToolStates();
        if (planner.onToolChange) planner.onToolChange('select');
        planner.selectEntity(newPlatform, 'platform');
        if (this.interactions) {
            this.interactions.selectObject(newPlatform.mesh3D, null, true);
        }

        this.hideGhost();
        this.drawing = false;
        this.drawingPoints = [];
        if (planner.debouncedSaveHistory) planner.debouncedSaveHistory();
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    _onKeyDown(e) {
        if (e.key === 'Escape') {
            this.hideGhost();
            this.drawing = false;
            this.drawingPoints = [];
            this.startPoint = null;
            const planner = this.getPlanner();
            if (planner && this.isPlatformDrawingTool()) {
                planner.tool = 'select';
                if (planner.updateToolStates) planner.updateToolStates();
                if (planner.onToolChange) planner.onToolChange('select');
            }
        }
    }

    hideGhost() {
        this.ghostGroup.visible = false;
        this.ghostBoxMesh.visible = false;
        this.ghostPrismMesh.visible = false;
        this.ghostPrismEdges.visible = false;
        this.guideLine.visible = false;
        this.vertexMarker.visible = false;
        this._hideDOMBadge();
        if (this.ctx.requestRender) this.ctx.requestRender();
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

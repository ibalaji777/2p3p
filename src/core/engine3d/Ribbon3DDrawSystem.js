import * as THREE from 'three';
import { buildRibbon3DGeometry } from '../../features/facade/facadeRibbon.geometry.js';
import { renderFacadeRibbon3D } from '../../features/facade/facadeRibbon.renderer3d.js';
import { FACADE_RIBBON_CONFIG } from '../../features/facade/facadeRibbon.registry.js';

/**
 * Ribbon3DDrawSystem
 * 
 * Enables direct interactive point-by-point drawing of continuous facade ribbons in 3D:
 * Click 1 (Start) -> Click 2 (Corner Snap) -> Click 3 (Side Wall) -> Click 4 (Terrace) -> Finish
 */
export class Ribbon3DDrawSystem {
    constructor(ctx, interactionSystem) {
        this.ctx = ctx;
        this.interactions = interactionSystem;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.drawing = false;
        this.drawingPoints = [];
        this.lastTapTime = 0;

        // Container in 3D Scene
        this.ghostGroup = new THREE.Group();
        this.ghostGroup.name = 'Ribbon3DDraw_GhostGroup';
        this.ghostGroup.visible = false;
        this.ghostGroup.raycast = () => {};
        if (this.ctx && this.ctx.scene) {
            this.ctx.scene.add(this.ghostGroup);
        }

        // Materials
        this.ghostMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            roughness: 0.5,
            transparent: true,
            opacity: 0.7,
            depthTest: false,
            side: THREE.DoubleSide
        });

        this.ghostEdgeMat = new THREE.LineBasicMaterial({
            color: 0x0284c7,
            linewidth: 2.5,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });

        // Ghost Mesh & Edges
        this.ghostMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMat);
        this.ghostMesh.renderOrder = 1500;
        this.ghostMesh.raycast = () => {};
        this.ghostGroup.add(this.ghostMesh);

        this.ghostEdges = new THREE.LineSegments(new THREE.BufferGeometry(), this.ghostEdgeMat);
        this.ghostEdges.renderOrder = 1501;
        this.ghostEdges.raycast = () => {};
        this.ghostGroup.add(this.ghostEdges);

        // Snap Marker (glowing green/cyan dot)
        const markerGeo = new THREE.SphereGeometry(3.5, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false });
        this.snapMarker = new THREE.Mesh(markerGeo, markerMat);
        this.snapMarker.renderOrder = 2000;
        this.snapMarker.raycast = () => {};
        this.snapMarker.visible = false;
        this.ghostGroup.add(this.snapMarker);

        // Glowing Corner Edge Line (for edge clamping highlight)
        const edgeGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 300, 0)
        ]);
        const edgeMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 3.5,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.cornerEdgeLine = new THREE.Line(edgeGeo, edgeMat);
        this.cornerEdgeLine.renderOrder = 2500;
        this.cornerEdgeLine.raycast = () => {};
        this.cornerEdgeLine.visible = false;
        this.ghostGroup.add(this.cornerEdgeLine);

        // Auto-Bend Corner Junction Marker
        const bendMarkerGeo = new THREE.SphereGeometry(4.5, 16, 16);
        const bendMarkerMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false });
        this.autoBendMarker = new THREE.Mesh(bendMarkerGeo, bendMarkerMat);
        this.autoBendMarker.renderOrder = 2600;
        this.autoBendMarker.raycast = () => {};
        this.autoBendMarker.visible = false;
        this.ghostGroup.add(this.autoBendMarker);

        // Ortho Guide Line (straight horizontal/vertical drawing guide)
        const orthoGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 0)
        ]);
        const orthoMat = new THREE.LineDashedMaterial({
            color: 0x00f0ff,
            linewidth: 3,
            dashSize: 8,
            gapSize: 4,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.orthoGuideLine = new THREE.Line(orthoGeo, orthoMat);
        this.orthoGuideLine.renderOrder = 2550;
        this.orthoGuideLine.raycast = () => {};
        this.orthoGuideLine.visible = false;
        this.ghostGroup.add(this.orthoGuideLine);

        this.activeAutoCorner = null;

        // HUD Action Bar
        this.createBadgeDOM();

        // Keyboard shortcuts
        this.boundOnKeyDown = (e) => this.onKeyDown(e);
        window.addEventListener('keydown', this.boundOnKeyDown);
    }

    getPlanner() {
        return this.ctx?.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null);
    }

    isRibbonTool() {
        const planner = this.getPlanner();
        const tool = planner?.tool;
        return tool === 'facade_ribbon_draw' || tool === 'facade_ribbon';
    }

    createBadgeDOM() {
        this.badgeDom = document.createElement('div');
        this.badgeDom.id = 'sims4-ribbon-draw-badge';
        this.badgeDom.style.cssText = `
            position: fixed;
            display: none;
            pointer-events: auto;
            top: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(16px);
            border: 1.5px solid rgba(56, 189, 248, 0.85);
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
            border-radius: 12px;
            padding: 9px 16px;
            color: #f8fafc;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 600;
            z-index: 100000;
            user-select: none;
        `;

        this.badgeDom.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 6px; min-width: 250px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 7px;">
                        <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 10px #38bdf8;"></span>
                        <span style="color: #38bdf8; font-weight: 700; font-size: 12px;">3D Facade Ribbon</span>
                    </div>
                    <span id="ribbon-ui-pointcount" style="background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.5); color: #38bdf8; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">Click 1: Start</span>
                </div>
                <div id="ribbon-ui-specs" style="color: #cbd5e1; font-size: 11px; font-weight: 500;">
                    Click wall to start ribbon
                </div>
                <div style="display: flex; align-items: center; gap: 6px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.12); margin-top: 2px;">
                    <button id="ribbon-ui-btn-finish" type="button" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; background: #059669; border: 1.5px solid #10b981; color: #ffffff; border-radius: 7px; padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer;">
                        ✓ Finish
                    </button>
                    <button id="ribbon-ui-btn-cancel" type="button" style="display: flex; align-items: center; justify-content: center; background: rgba(239, 68, 68, 0.22); border: 1.5px solid rgba(239, 68, 68, 0.6); color: #f87171; border-radius: 7px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer;">
                        ✕
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.badgeDom);

        this.badgeFinishBtn = this.badgeDom.querySelector('#ribbon-ui-btn-finish');
        this.badgeCancelBtn = this.badgeDom.querySelector('#ribbon-ui-btn-cancel');
        this.badgeSpecs = this.badgeDom.querySelector('#ribbon-ui-specs');
        this.badgeCount = this.badgeDom.querySelector('#ribbon-ui-pointcount');

        if (this.badgeFinishBtn) {
            this.badgeFinishBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.finishRibbon();
            });
        }
        if (this.badgeCancelBtn) {
            this.badgeCancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.cancelDrawing();
            });
        }
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

        const interactables = this.ctx.interactables || [];
        const intersects = this.raycaster.intersectObjects(interactables, true);

        const planner = this.getPlanner();
        const existingRibbons = planner?.facadeRibbons || [];

        // 1. Check direct snap to existing ribbon endpoints
        if (intersects.length > 0) {
            const rawPt = intersects[0].point;
            for (const rib of existingRibbons) {
                if (!rib.points || rib.points.length < 2) continue;
                const pStart = new THREE.Vector3(rib.points[0].x, rib.points[0].y, rib.points[0].z);
                const pEnd = new THREE.Vector3(rib.points[rib.points.length - 1].x, rib.points[rib.points.length - 1].y, rib.points[rib.points.length - 1].z);
                if (rawPt.distanceTo(pStart) < 32) {
                    const snapPt = pStart.clone();
                    snapPt.normal = rib.points[0].normal;
                    return {
                        point: snapPt,
                        screenX: clientX,
                        screenY: clientY,
                        isSnappedCorner: true,
                        isRibbonSnap: true,
                        snappedRibbon: rib,
                        snappedEndType: 'start'
                    };
                }
                if (rawPt.distanceTo(pEnd) < 32) {
                    const snapPt = pEnd.clone();
                    snapPt.normal = rib.points[rib.points.length - 1].normal;
                    return {
                        point: snapPt,
                        screenX: clientX,
                        screenY: clientY,
                        isSnappedCorner: true,
                        isRibbonSnap: true,
                        snappedRibbon: rib,
                        snappedEndType: 'end'
                    };
                }
            }
        }

        // 2. Strict Wall Filter: Only raycast against wall meshes (reject floor/air/ground)
        const wallHit = intersects.find(i => {
            const obj = i.object;
            if (!obj || !obj.visible) return false;
            if (obj.userData?.isHitbox) return false;
            return obj.userData?.isWallSide || obj.userData?.isWall || obj.userData?.isWallMesh ||
                   obj.userData?.entity?.type === 'outer' || obj.userData?.entity?.type === 'inner' || 
                   obj.userData?.entity?.type === 'wall' || obj.userData?.parentWall;
        });

        if (!wallHit) return null;

        const hitObj = wallHit.object;
        const wallEntity = hitObj.userData?.parentWall || hitObj.userData?.entity || (hitObj.parent && hitObj.parent.userData?.entity);
        if (!wallEntity) return null;

        const p1 = wallEntity.startAnchor ? wallEntity.startAnchor.position() : { x: wallEntity.startX || 0, y: wallEntity.startY || 0 };
        const p2 = wallEntity.endAnchor ? wallEntity.endAnchor.position() : { x: wallEntity.endX || 0, y: wallEntity.endY || 0 };
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const wallLen = Math.hypot(dx, dy);
        if (wallLen < 1) return null;

        const wallDirX = dx / wallLen;
        const wallDirY = dy / wallLen;

        // Line-of-sight wall face detection
        const rawHit = wallHit.point;
        const camPos = this.ctx.camera.position;
        const toCamX = camPos.x - rawHit.x;
        const toCamZ = camPos.z - rawHit.z;
        const dotCam = toCamX * (-wallDirY) + toCamZ * wallDirX;
        const facing = dotCam >= 0 ? 1 : -1;

        // Outward normal facing away from the wall
        const normal = new THREE.Vector3(-wallDirY * facing, 0, wallDirX * facing).normalize();
        const thick = wallEntity.thickness || 20;

        // Project raw hit directly onto the exterior wall surface
        const relX = rawHit.x - p1.x;
        const relY = rawHit.z - p1.y;
        const rawT = (relX * wallDirX + relY * wallDirY) / wallLen;

        let t = Math.max(0, Math.min(1, rawT));
        let isSnappedCorner = false;
        let clampedCornerCoords = null;

        const distToStart = rawT * wallLen;
        const distToEnd = (1 - rawT) * wallLen;

        // Snapping & Clamping to Wall Corner Edges (prevent overshooting into empty space)
        if (distToStart <= 28 || rawT <= 0.05) {
            t = 0;
            isSnappedCorner = true;
            clampedCornerCoords = {
                x: p1.x + normal.x * (thick / 2),
                z: p1.y + normal.z * (thick / 2)
            };
        } else if (distToEnd <= 28 || rawT >= 0.95) {
            t = 1.0;
            isSnappedCorner = true;
            clampedCornerCoords = {
                x: p2.x + normal.x * (thick / 2),
                z: p2.y + normal.z * (thick / 2)
            };
        }

        const surfX = clampedCornerCoords ? clampedCornerCoords.x : (p1.x + t * dx + normal.x * (thick / 2));
        const surfZ = clampedCornerCoords ? clampedCornerCoords.z : (p1.y + t * dy + normal.z * (thick / 2));
        const wallElev = wallEntity.elevation || 0;
        const wallH = wallEntity.height || 280;
        let surfY = Math.max(wallElev, Math.min(wallElev + wallH, rawHit.y));

        // Snap to parapet top edge if within 22 cm
        if (Math.abs(rawHit.y - (wallElev + wallH)) < 22) {
            surfY = wallElev + wallH;
            isSnappedCorner = true;
        }

        let hitPoint = new THREE.Vector3(surfX, surfY, surfZ);
        hitPoint.normal = { x: normal.x, y: normal.y, z: normal.z };
        hitPoint.wall = wallEntity;

        return {
            point: hitPoint,
            screenX: clientX,
            screenY: clientY,
            isSnappedCorner,
            isRibbonSnap: false,
            snappedRibbon: null,
            snappedEndType: null,
            wall: wallEntity,
            normal
        };
    }

    findSharedCorner(wallA, wallB, normalA, normalB, elevY) {
        if (!wallA || !wallB || wallA === wallB) return null;

        const aStart = wallA.startAnchor ? wallA.startAnchor.position() : { x: wallA.startX, y: wallA.startY };
        const aEnd = wallA.endAnchor ? wallA.endAnchor.position() : { x: wallA.endX, y: wallA.endY };
        const bStart = wallB.startAnchor ? wallB.startAnchor.position() : { x: wallB.startX, y: wallB.startY };
        const bEnd = wallB.endAnchor ? wallB.endAnchor.position() : { x: wallB.endX, y: wallB.endY };

        const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

        let shared = null;
        if (dist(aStart, bStart) < 35) shared = aStart;
        else if (dist(aStart, bEnd) < 35) shared = aStart;
        else if (dist(aEnd, bStart) < 35) shared = aEnd;
        else if (dist(aEnd, bEnd) < 35) shared = aEnd;

        if (!shared) {
            shared = this.getLineLineIntersection(aStart, aEnd, bStart, bEnd);
        }

        if (!shared) return null;

        // Corner outward bisector normal
        const nA = normalA ? new THREE.Vector3(normalA.x, 0, normalA.z).normalize() : new THREE.Vector3(0, 0, 1);
        const nB = normalB ? new THREE.Vector3(normalB.x, 0, normalB.z).normalize() : new THREE.Vector3(0, 0, 1);
        const bisector = nA.clone().add(nB).normalize();
        if (bisector.lengthSq() < 0.001) {
            bisector.copy(nA);
        }

        const dot = Math.max(-0.8, Math.min(0.99, nA.dot(nB)));
        const miterScale = Math.min(2.5, 1 / Math.sqrt((1 + dot) / 2));
        const thick = Math.max(wallA.thickness || 20, wallB.thickness || 20);
        const cornerOffset = (thick / 2) * miterScale;

        const cornerPt = new THREE.Vector3(
            shared.x + bisector.x * cornerOffset,
            elevY,
            shared.y + bisector.z * cornerOffset
        );
        cornerPt.normal = { x: bisector.x, y: 0, z: bisector.z };
        cornerPt.isAutoCorner = true;
        cornerPt.wall = wallB;
        return cornerPt;
    }

    getLineLineIntersection(p1, p2, p3, p4) {
        const d12x = p2.x - p1.x;
        const d12y = p2.y - p1.y;
        const d34x = p4.x - p3.x;
        const d34y = p4.y - p3.y;

        const denom = d12x * d34y - d12y * d34x;
        if (Math.abs(denom) < 0.0001) return null;

        const t = ((p3.x - p1.x) * d34y - (p3.y - p1.y) * d34x) / denom;
        return { x: p1.x + t * d12x, y: p1.y + t * d12y };
    }

    clonePointWithMeta(pt) {
        if (!pt) return null;
        const p = new THREE.Vector3(pt.x, pt.y, pt.z);
        if (pt.normal) {
            p.normal = { x: pt.normal.x, y: pt.normal.y, z: pt.normal.z };
        }
        p.wall = pt.wall || null;
        p.isAutoCorner = !!pt.isAutoCorner;
        return p;
    }

    onPointerDown(e) {
        if (!this.isRibbonTool()) return false;
        const hit = this.getRaycastHit(e);
        if (!hit) return false;

        const now = Date.now();
        const isDblClick = (this.lastTapTime && now - this.lastTapTime < 400) || (e.detail && e.detail >= 2);
        this.lastTapTime = now;

        if (!this.drawing) {
            // Click 1: Anchor Start Point
            this.drawing = true;
            const startPt = this.clonePointWithMeta(hit.point);
            this.drawingPoints = [startPt];
            this.activeStartConnection = hit.isRibbonSnap ? { ribbon: hit.snappedRibbon, endType: hit.snappedEndType } : null;
            this.activeEndConnection = null;
            this.activeAutoCorner = null;
            this.ghostGroup.visible = true;

            const msg = hit.isRibbonSnap 
                ? `🔗 Connected to existing ribbon! Click next corner.`
                : `Point 1 anchored. Click next corner or wall.`;
            this.updateBadge(msg);
            if (this.ctx && this.ctx.requestRender) this.ctx.requestRender();
            return true;
        } else {
            // If double click: Finish
            if (isDblClick && this.drawingPoints.length >= 2) {
                this.finishRibbon();
                return true;
            }

            // If closing box frame to start point
            if (hit.isBoxClosing && this.drawingPoints.length >= 3) {
                const closedPt = this.clonePointWithMeta(this.drawingPoints[0]);
                this.drawingPoints.push(closedPt);
                this.finishRibbon();
                return true;
            }

            // If auto-corner was computed (cross-wall 90° or same-wall L-bend), insert it first!
            if (this.activeAutoCorner) {
                const cornerClone = this.clonePointWithMeta(this.activeAutoCorner);
                this.drawingPoints.push(cornerClone);
                this.activeAutoCorner = null;
            }

            // Click 2, 3, etc: Anchor Next Joint
            const lastP = this.drawingPoints[this.drawingPoints.length - 1];
            if (hit.point.distanceTo(lastP) > 5) {
                const nextPt = this.clonePointWithMeta(hit.point);
                this.drawingPoints.push(nextPt);
                if (hit.isRibbonSnap) {
                    this.activeEndConnection = { ribbon: hit.snappedRibbon, endType: hit.snappedEndType };
                    this.finishRibbon();
                    return true;
                }
                const count = this.drawingPoints.length;
                this.updateBadge(`Point ${count} anchored. Click next or double-click to finish.`);
                this.updateGhostMesh(hit.point);
                if (this.ctx && this.ctx.requestRender) this.ctx.requestRender();
            }
            return true;
        }
    }

    onPointerMove(e) {
        if (!this.isRibbonTool()) {
            this.hideGhost();
            return false;
        }

        const hit = this.getRaycastHit(e);
        if (!hit) {
            if (this.snapMarker) this.snapMarker.visible = false;
            if (this.cornerEdgeLine) this.cornerEdgeLine.visible = false;
            if (this.autoBendMarker) this.autoBendMarker.visible = false;
            if (this.orthoGuideLine) this.orthoGuideLine.visible = false;
            return false;
        }

        // Update snap marker
        if (hit.isRibbonSnap) {
            this.snapMarker.material.color.setHex(0xf59e0b); // Amber for ribbon snap
            this.snapMarker.position.copy(hit.point);
            this.snapMarker.visible = true;
            this.updateBadge(`🔗 Snap to Existing Ribbon · Click to Connect`);
        } else if (hit.isSnappedCorner) {
            this.snapMarker.material.color.setHex(0x10b981); // Emerald for wall corner
            this.snapMarker.position.copy(hit.point);
            this.snapMarker.visible = true;
        } else {
            this.snapMarker.visible = false;
        }

        if (this.drawing && this.drawingPoints.length >= 1) {
            const lastP = this.drawingPoints[this.drawingPoints.length - 1];

            // 1. Check Snap to Start Point (Close Rectangular Box / Portal Frame)
            if (this.drawingPoints.length >= 3) {
                const startP = this.drawingPoints[0];
                if (hit.point.distanceTo(startP) < 35) {
                    hit.point.copy(startP);
                    hit.isBoxClosing = true;
                    hit.isSnappedCorner = true;
                    this.snapMarker.material.color.setHex(0x10b981);
                    this.snapMarker.position.copy(startP);
                    this.snapMarker.visible = true;
                    this.autoBendMarker.visible = false;
                    this.orthoGuideLine.visible = false;
                    this.activeAutoCorner = null;
                    this.updateBadge(`🔁 Snap to Start Point · Click to Close Box Frame`);
                    this.ghostGroup.visible = true;
                    this.updateGhostMesh(hit.point);
                    if (this.ctx && this.ctx.requestRender) this.ctx.requestRender();
                    return true;
                }
            }

            let autoCorner = null;
            let isOrthoLocked = false;

            // 2. Cross-Wall Transition -> 90° Shared Corner Auto-Bend
            if (lastP.wall && hit.wall && lastP.wall !== hit.wall) {
                autoCorner = this.findSharedCorner(lastP.wall, hit.wall, lastP.normal, hit.normal, (lastP.y + hit.point.y) / 2);
                this.orthoGuideLine.visible = false;
            } 
            // 3. Same-Wall Drawing -> Straight Ortho Snapping & 90° L-Bends
            else if (lastP.wall && hit.wall && lastP.wall === hit.wall) {
                const wallEntity = hit.wall;
                const p1 = wallEntity.startAnchor ? wallEntity.startAnchor.position() : { x: wallEntity.startX || 0, y: wallEntity.startY || 0 };
                const p2 = wallEntity.endAnchor ? wallEntity.endAnchor.position() : { x: wallEntity.endX || 0, y: wallEntity.endY || 0 };
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const wallLen = Math.hypot(dx, dy) || 1;
                const uX = dx / wallLen;
                const uZ = dy / wallLen;

                const relX = hit.point.x - lastP.x;
                const relZ = hit.point.z - lastP.z;
                const deltaH = relX * uX + relZ * uZ;
                const deltaV = hit.point.y - lastP.y;
                const absH = Math.abs(deltaH);
                const absV = Math.abs(deltaV);

                // A. Strict Horizontal Snapping (Straight horizontal line along wall)
                if (absV <= 25 || (absH > 2.5 * absV && absV < 50)) {
                    hit.point.x = lastP.x + uX * deltaH;
                    hit.point.y = lastP.y;
                    hit.point.z = lastP.z + uZ * deltaH;
                    isOrthoLocked = true;

                    const posArr = this.orthoGuideLine.geometry.attributes.position;
                    posArr.setXYZ(0, lastP.x, lastP.y, lastP.z);
                    posArr.setXYZ(1, hit.point.x, hit.point.y, hit.point.z);
                    posArr.needsUpdate = true;
                    this.orthoGuideLine.computeLineDistances();
                    this.orthoGuideLine.visible = true;
                    this.updateBadge(`📏 Horizontal Lock: ${Math.round(absH)} cm · Click to Anchor`);
                }
                // B. Strict Vertical Snapping (Straight vertical line, e.g. ground to top floor)
                else if (absH <= 25 || (absV > 2.5 * absH && absH < 50)) {
                    hit.point.x = lastP.x;
                    hit.point.z = lastP.z;
                    isOrthoLocked = true;

                    const posArr = this.orthoGuideLine.geometry.attributes.position;
                    posArr.setXYZ(0, lastP.x, lastP.y, lastP.z);
                    posArr.setXYZ(1, hit.point.x, hit.point.y, hit.point.z);
                    posArr.needsUpdate = true;
                    this.orthoGuideLine.computeLineDistances();
                    this.orthoGuideLine.visible = true;
                    this.updateBadge(`📏 Vertical Lock: ${Math.round(absV)} cm · Click to Anchor`);
                }
                // C. Diagonal movement across wall -> 90° L-BEND Auto-Creation!
                else if (absH > 30 && absV > 30) {
                    let C;
                    if (absH >= absV) {
                        // Horizontal first, then Vertical:
                        C = new THREE.Vector3(lastP.x + uX * deltaH, lastP.y, lastP.z + uZ * deltaH);
                    } else {
                        // Vertical first, then Horizontal:
                        C = new THREE.Vector3(lastP.x, lastP.y + deltaV, lastP.z);
                    }
                    C.normal = { ...lastP.normal };
                    C.isAutoCorner = true;
                    C.wall = hit.wall;
                    autoCorner = C;

                    const posArr = this.orthoGuideLine.geometry.attributes.position;
                    posArr.setXYZ(0, lastP.x, lastP.y, lastP.z);
                    posArr.setXYZ(1, C.x, C.y, C.z);
                    posArr.needsUpdate = true;
                    this.orthoGuideLine.computeLineDistances();
                    this.orthoGuideLine.visible = true;
                    this.updateBadge(`↪ 90° L-Bend Auto-Detected (${Math.round(absH)}x${Math.round(absV)} cm) · Click to Lock`);
                }
            } else {
                this.orthoGuideLine.visible = false;
            }

            this.activeAutoCorner = autoCorner;

            // Highlight auto-corner marker
            if (autoCorner) {
                this.autoBendMarker.position.copy(autoCorner);
                this.autoBendMarker.visible = true;
            } else {
                this.autoBendMarker.visible = false;
            }

            // Update corner edge glowing line when clamped to a corner
            if (hit.isSnappedCorner && hit.wall && !hit.isBoxClosing) {
                const wallElev = hit.wall.elevation || 0;
                const wallH = hit.wall.height || 280;
                const posArr = this.cornerEdgeLine.geometry.attributes.position;
                posArr.setXYZ(0, hit.point.x, wallElev, hit.point.z);
                posArr.setXYZ(1, hit.point.x, wallElev + wallH, hit.point.z);
                posArr.needsUpdate = true;
                this.cornerEdgeLine.visible = true;
                if (!autoCorner && !hit.isRibbonSnap && !isOrthoLocked) {
                    this.updateBadge(`📐 Wall Edge Clamped · Move to adjacent wall to auto-bend`);
                }
            } else {
                this.cornerEdgeLine.visible = false;
            }

            this.ghostGroup.visible = true;
            this.updateGhostMesh(hit.point, autoCorner);

            if (!autoCorner && !hit.isRibbonSnap && !hit.isSnappedCorner && !isOrthoLocked) {
                const currentLen = Math.round(lastP.distanceTo(hit.point));
                const count = this.drawingPoints.length;
                this.updateBadge(`Segment ${count}: ${currentLen} cm | Click to lock`);
            }
        } else if (!hit.isRibbonSnap && !hit.isSnappedCorner) {
            this.updateBadge(`Click on wall surface to start ribbon`);
        }

        if (this.ctx && this.ctx.requestRender) this.ctx.requestRender();
        return true;
    }

    onPointerUp(e) {
        if (!this.isRibbonTool()) return false;
        return false;
    }

    onKeyDown(e) {
        if (!this.isRibbonTool()) return;
        if (e.key === 'Enter') {
            if (this.drawing && this.drawingPoints.length >= 2) {
                this.finishRibbon();
            }
        } else if (e.key === 'Escape') {
            this.cancelDrawing();
        }
    }

    updateGhostMesh(currentCursorPt, autoCorner = null) {
        if (!this.drawing || this.drawingPoints.length === 0) return;

        let previewPoints;
        if (autoCorner) {
            previewPoints = [
                ...this.drawingPoints.map(p => this.clonePointWithMeta(p)),
                this.clonePointWithMeta(autoCorner),
                this.clonePointWithMeta(currentCursorPt)
            ];
        } else {
            previewPoints = [
                ...this.drawingPoints.map(p => this.clonePointWithMeta(p)),
                this.clonePointWithMeta(currentCursorPt)
            ];
        }
        if (previewPoints.length < 2) return;

        const planner = this.getPlanner();
        const width = planner?.activePresetParams?.width || FACADE_RIBBON_CONFIG.defaultParams.width;
        const depth = planner?.activePresetParams?.depth || FACADE_RIBBON_CONFIG.defaultParams.depth;

        const ribbonData = buildRibbon3DGeometry(previewPoints, {
            width,
            depth,
            hasSpotlights: false
        });

        if (ribbonData && ribbonData.geometry) {
            this.ghostMesh.geometry.dispose();
            this.ghostMesh.geometry = ribbonData.geometry;

            this.ghostEdges.geometry.dispose();
            this.ghostEdges.geometry = new THREE.EdgesGeometry(ribbonData.geometry);
        }
    }

    updateBadge(specsText) {
        if (!this.badgeDom) return;
        this.badgeDom.style.display = 'block';

        if (this.badgeSpecs) this.badgeSpecs.textContent = specsText;
        if (this.badgeCount) {
            const pts = this.drawingPoints.length;
            this.badgeCount.textContent = pts > 0 ? `${pts} Points Locked` : 'Click 1: Start';
        }
    }

    startDrawingFromRibbon(ribbonEntity, endType = 'end') {
        if (!ribbonEntity || !ribbonEntity.points || ribbonEntity.points.length === 0) return;
        this.drawing = true;
        this.editingRibbon = ribbonEntity;
        if (endType === 'start') {
            this.drawingPoints = [...ribbonEntity.points].reverse().map(p => new THREE.Vector3(p.x, p.y, p.z));
        } else {
            this.drawingPoints = ribbonEntity.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        }
        this.updateBadge(`Continuing from Point ${this.drawingPoints.length}. Click next corner.`);
        if (this.ctx && this.ctx.requestRender) this.ctx.requestRender();
    }

    finishRibbon() {
        if (!this.drawing || this.drawingPoints.length < 2) {
            this.cancelDrawing();
            return;
        }

        const planner = this.getPlanner();
        if (!planner) return;

        const width = planner.activePresetParams?.width || FACADE_RIBBON_CONFIG.defaultParams.width;
        const depth = planner.activePresetParams?.depth || FACADE_RIBBON_CONFIG.defaultParams.depth;
        const material = planner.activePresetParams?.material || FACADE_RIBBON_CONFIG.defaultParams.material;
        const hasSpotlights = planner.activePresetParams?.hasSpotlights !== false;
        const spotlightSpacing = planner.activePresetParams?.spotlightSpacing || FACADE_RIBBON_CONFIG.defaultParams.spotlightSpacing;

        const formattedPoints = this.drawingPoints.map(p => ({
            x: Math.round(p.x),
            y: Math.round(p.y),
            z: Math.round(p.z),
            normal: p.normal || null
        }));

        let targetRibbon = null;

        // If user was continuing an existing ribbon directly
        if (this.editingRibbon) {
            this.editingRibbon.points = formattedPoints;
            targetRibbon = this.editingRibbon;
        } else if (this.activeStartConnection && this.activeStartConnection.ribbon) {
            // Merge into connected existing ribbon
            const connRib = this.activeStartConnection.ribbon;
            if (this.activeStartConnection.endType === 'end') {
                // Append points (skip the first point since it shares coordinate with last)
                connRib.points.push(...formattedPoints.slice(1));
            } else {
                // Prepend reversed points
                connRib.points.unshift(...formattedPoints.slice(1).reverse());
            }
            targetRibbon = connRib;
        } else if (this.activeEndConnection && this.activeEndConnection.ribbon) {
            // Ended on another ribbon
            const connRib = this.activeEndConnection.ribbon;
            if (this.activeEndConnection.endType === 'start') {
                connRib.points.unshift(...formattedPoints.slice(0, -1));
            } else {
                connRib.points.push(...formattedPoints.slice(0, -1).reverse());
            }
            targetRibbon = connRib;
        } else {
            // Brand new ribbon
            targetRibbon = {
                id: 'facade_ribbon_' + Date.now(),
                type: 'facade_ribbon',
                points: formattedPoints,
                width,
                depth,
                material,
                hasSpotlights,
                spotlightSpacing
            };

            if (!planner.facadeRibbons) planner.facadeRibbons = [];
            planner.facadeRibbons.push(targetRibbon);
        }

        // Rebuild 3D mesh in scene
        if (targetRibbon.mesh3D && targetRibbon.mesh3D.parent) {
            targetRibbon.mesh3D.parent.remove(targetRibbon.mesh3D);
        }

        if (this.ctx && this.ctx.structureGroup) {
            renderFacadeRibbon3D(this.ctx.structureGroup, targetRibbon, this.ctx.helpers);
            if (targetRibbon.mesh3D && this.ctx.interactables) {
                if (!this.ctx.interactables.includes(targetRibbon.mesh3D)) {
                    this.ctx.interactables.push(targetRibbon.mesh3D);
                }
                targetRibbon.mesh3D.traverse(child => {
                    if (child.isMesh && !this.ctx.interactables.includes(child)) {
                        this.ctx.interactables.push(child);
                    }
                });
            }
        }

        this.cancelDrawing();
        this.editingRibbon = null;
        this.activeStartConnection = null;
        this.activeEndConnection = null;

        if (planner.tool === 'facade_ribbon_draw') {
            planner.tool = 'select';
            if (planner.onToolChange) planner.onToolChange('select');
        }

        if (planner.selectEntity) {
            planner.selectEntity(targetRibbon, 'facade_ribbon');
        }

        if (this.ctx && this.ctx.requestRender) this.ctx.requestRender('ribbon_placed', 3);
    }

    cancelDrawing() {
        this.drawing = false;
        this.drawingPoints = [];
        this.editingRibbon = null;
        this.activeStartConnection = null;
        this.activeEndConnection = null;
        this.hideGhost();
        if (this.ctx && this.ctx.requestRender) this.ctx.requestRender();
    }

    hideGhost() {
        if (this.ghostGroup) this.ghostGroup.visible = false;
        if (this.snapMarker) this.snapMarker.visible = false;
        if (this.cornerEdgeLine) this.cornerEdgeLine.visible = false;
        if (this.autoBendMarker) this.autoBendMarker.visible = false;
        if (this.orthoGuideLine) this.orthoGuideLine.visible = false;
        if (this.badgeDom) this.badgeDom.style.display = 'none';
    }

    destroy() {
        if (this.boundOnKeyDown) {
            window.removeEventListener('keydown', this.boundOnKeyDown);
        }
        if (this.badgeDom && this.badgeDom.parentNode) {
            this.badgeDom.parentNode.removeChild(this.badgeDom);
        }
        if (this.ghostGroup && this.ctx?.scene) {
            this.ctx.scene.remove(this.ghostGroup);
        }
    }
}

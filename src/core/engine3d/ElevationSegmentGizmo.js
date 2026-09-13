import * as THREE from 'three';
import { 
    sproutBendAtEndpoint, 
    setNodeCornerStyle, 
    getConnectedWallCorner, 
    wrapElevationSegmentToAdjacentWall,
    snapEndpointToWallCorner,
    getEndpointCornerStatus
} from '../../features/elevation/elevationSegment.registry.js';
import { renderElevationSegment3D } from '../../features/elevation/elevationSegment.renderer3d.js';

/**
 * ElevationSegmentGizmo
 * 
 * Professional Lumion / SketchUp-Grade 3D Builder Suite for Elevation Segments:
 * 1. Dual-End Push/Pull Handles (◄ ● ►): Positioned at BOTH Start and End of the segment/chain.
 *    Smooth real-time continuous stretching with magnetic snaps to wall corners and floor levels.
 * 2. Pull-to-Extrude Arrows (↑ / ↓): Contextual directional arrows at both ends.
 *    Click or drag to smoothly extrude new connected vertical or horizontal arms in real time.
 * 3. Bend Junction Nodes (◆): Drag to reposition corners; click to toggle Sharp 45° vs Curved Fillet.
 * 4. Concentric Arc Fillets: Live radius adjustment with zero pinch points or texture distortion.
 * 5. Strict In-Place Updates: Geometry updates strictly in place, maintaining 100% stable selection.
 * 6. Continuous Lumion Highlight: Real-time glowing 3D wireframe contour tracking the active beam.
 * 7. Wall-to-Wall L-Bends: Automatic 90° corner wrap around adjacent connected building walls.
 */
export class ElevationSegmentGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.target = null;
        this.visible = false;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.isDragging = false;
        this.activeHandle = null;
        this.dragPlane = new THREE.Plane();
        this.dragStartPoint = new THREE.Vector3();
        this.initialPointPos = new THREE.Vector3();
        this.activeBendIndex = -1;

        this.handles = new THREE.Group();
        this.handles.name = 'ElevationSegment_Handles';
        this.add(this.handles);
        this.highlightMesh = null;

        // Materials (Vibrant Lumion / SketchUp Neon CAD Styling)
        this.matPushPull = new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 0.95 });
        this.matPushPullHover = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false, transparent: true, opacity: 1.0 });
        this.matArrowUp = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.matArrowDown = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 });
        this.matArrowSide = new THREE.MeshBasicMaterial({ color: 0x6366f1, depthTest: false, transparent: true, opacity: 0.95 });
        this.matBend = new THREE.MeshBasicMaterial({ color: 0xa855f7, depthTest: false, transparent: true, opacity: 0.95 });
        this.matBendActive = new THREE.MeshBasicMaterial({ color: 0xd946ef, depthTest: false, transparent: true, opacity: 1.0 });

        this._createLiveBadge();

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);

        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
            dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
            dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
        }
    }

    _createLiveBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'elevation-segment-badge';
        this.domBadge.style.cssText = `
            position: absolute;
            display: none;
            transform: translate(-50%, -100%);
            padding: 6px 14px;
            border-radius: 20px;
            background: rgba(15, 23, 42, 0.95);
            border: 2px solid #00f0ff;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 240, 255, 0.45);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
            pointer-events: none;
            z-index: 10000;
            user-select: none;
            letter-spacing: 0.3px;
        `;
        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domBadge);
    }

    _updateBadge(text, worldPos) {
        if (!this.domBadge) return;
        if (!text) {
            this.domBadge.style.display = 'none';
            return;
        }

        const screenPos = worldPos.clone().project(this.ctx.camera);
        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        const x = ((screenPos.x + 1) / 2) * rect.width + rect.left;
        const y = ((-screenPos.y + 1) / 2) * rect.height + rect.top;

        this.domBadge.innerHTML = text;
        this.domBadge.style.left = `${x}px`;
        this.domBadge.style.top = `${y - 14}px`;
        this.domBadge.style.display = 'block';
    }

    updateMouse(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    attach(target) {
        if (!target) return;
        this.target = target;
        this.visible = true;
        this.isDragging = false;
        this.activeHandle = null;
        this.updateHandles();
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.isDragging = false;
        this.activeHandle = null;
        if (this.ctx.controls) this.ctx.controls.enabled = true;
        if (this.highlightMesh) {
            this.handles.remove(this.highlightMesh);
            if (this.highlightMesh.geometry) this.highlightMesh.geometry.dispose();
            this.highlightMesh = null;
        }
        this.handles.clear();
        if (this.domBadge) this.domBadge.style.display = 'none';
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    _getEntity() {
        if (!this.target) return null;
        if (this.target.userData && this.target.userData.entity) return this.target.userData.entity;
        return this.target;
    }

    _getBodyMesh() {
        const entity = this._getEntity();
        if (!entity || !entity.mesh3D) return null;
        return entity.mesh3D.children.find(c => c.userData?.isElevationBody);
    }

    _updateHighlight(geo) {
        if (this.highlightMesh) {
            this.handles.remove(this.highlightMesh);
            if (this.highlightMesh.geometry) this.highlightMesh.geometry.dispose();
            this.highlightMesh = null;
        }
        if (!geo) return;

        const edgesGeo = new THREE.EdgesGeometry(geo, 20);
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.highlightMesh = new THREE.LineSegments(edgesGeo, lineMat);
        this.highlightMesh.renderOrder = 2490;
        this.highlightMesh.userData = { isHighlightLine: true };
        this.handles.add(this.highlightMesh);
    }

    updateHandles() {
        this.handles.clear();
        const entity = this._getEntity();
        if (!entity || !entity.points || entity.points.length < 2) return;

        const bodyMesh = this._getBodyMesh();
        if (bodyMesh && bodyMesh.geometry) {
            this._updateHighlight(bodyMesh.geometry);
        }

        const pts = entity.points;
        const n = pts.length;
        const depth = entity.depth || 40;
        const width = entity.width || 30;

        // DUAL-END CONTROLS: Both Start (Index 0) and End (Index N - 1)
        [0, n - 1].forEach((ptIdx) => {
            const pt = pts[ptIdx];
            const neighborIdx = (ptIdx === 0) ? 1 : n - 2;
            const neighbor = pts[neighborIdx];

            const dir = new THREE.Vector3(pt.x - neighbor.x, pt.y - neighbor.y, pt.z - neighbor.z).normalize();
            const isHorizontal = Math.abs(dir.y) < 0.35;

            const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            // Center handle at 3D end-cap center: pt + normal * (depth / 2)
            const centerOffset = normal.clone().multiplyScalar(depth / 2);
            const capCenter = new THREE.Vector3(pt.x, pt.y, pt.z).add(centerOffset);

            // 1. Dual-End Push/Pull Disc Handle (◄ ● ►)
            this._createPushPullHandle(ptIdx, capCenter.x, capCenter.y, capCenter.z, dir);

            // 2. Dual-End Extrude Arrows
            const arrowDist = (width / 2) + 14;
            if (isHorizontal) {
                // Show Extrude UP and Extrude DOWN
                this._createExtrudeArrow(ptIdx, 'up', capCenter.x, capCenter.y + arrowDist, capCenter.z, 0x10b981, new THREE.Vector3(0, 1, 0));
                this._createExtrudeArrow(ptIdx, 'down', capCenter.x, capCenter.y - arrowDist, capCenter.z, 0xf59e0b, new THREE.Vector3(0, -1, 0));
            } else {
                // Vertical arm: Show Extrude LEFT and Extrude RIGHT along wall plane
                const wallTangent = new THREE.Vector3(0, 1, 0).cross(normal).normalize();

                const leftPos = capCenter.clone().sub(wallTangent.clone().multiplyScalar(arrowDist));
                const rightPos = capCenter.clone().add(wallTangent.clone().multiplyScalar(arrowDist));

                this._createExtrudeArrow(ptIdx, 'left', leftPos.x, leftPos.y, leftPos.z, 0x10b981, wallTangent.clone().negate());
                this._createExtrudeArrow(ptIdx, 'right', rightPos.x, rightPos.y, rightPos.z, 0x6366f1, wallTangent.clone());
            }

            // 3. Wall Corner Wrap Handle (↳): If near an adjacent connected wall corner
            const conn = getConnectedWallCorner(entity, ptIdx, this.ctx?.planner, 80);
            if (conn) {
                const { adjWall, adjCornerIsStart } = conn;
                const ap1 = (adjWall.startAnchor && typeof adjWall.startAnchor.position === 'function') ? adjWall.startAnchor.position() : (adjWall.startAnchor || { x: adjWall.startX || 0, y: adjWall.startY || 0 });
                const ap2 = (adjWall.endAnchor && typeof adjWall.endAnchor.position === 'function') ? adjWall.endAnchor.position() : (adjWall.endAnchor || { x: adjWall.endX || 0, y: adjWall.endY || 0 });
                const adjStart = adjCornerIsStart ? ap1 : ap2;
                const adjEnd = adjCornerIsStart ? ap2 : ap1;
                const awdx = adjEnd.x - adjStart.x;
                const awdy = adjEnd.y - adjStart.y;
                const awLen = Math.hypot(awdx, awdy) || 1;
                const adjDir = new THREE.Vector3(awdx / awLen, 0, awdy / awLen);

                const wrapOrigin = capCenter.clone().add(dir.clone().multiplyScalar(12));
                this._createCornerWrapHandle(ptIdx, wrapOrigin.x, wrapOrigin.y, wrapOrigin.z, dir, adjDir);
            }
        });



        // 4. Interior Bend Junction Nodes (1 to N - 2)
        for (let i = 1; i < n - 1; i++) {
            const pt = pts[i];
            const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const centerOffset = normal.clone().multiplyScalar(depth / 2);
            const bendCenter = new THREE.Vector3(pt.x, pt.y, pt.z).add(centerOffset);

            this._createBendJunctionGrip(i, bendCenter.x, bendCenter.y, bendCenter.z, pt.cornerStyle === 'fillet');
        }

        // 5. Center Elevation Handle (▲ Elev ▼) on horizontal segments
        // Allows sliding the beam smoothly UP and DOWN the wall height
        for (let i = 0; i < n - 1; i++) {
            const pA = pts[i];
            const pB = pts[i + 1];
            const segDir = new THREE.Vector3(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);
            const segLen = segDir.length();
            if (segLen >= 40 && Math.abs(segDir.y) < segLen * 0.35) {
                const normal = pA.normal ? new THREE.Vector3(pA.normal.x, pA.normal.y, pA.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
                const midPt = new THREE.Vector3(
                    (pA.x + pB.x) / 2 + normal.x * (depth / 2),
                    (pA.y + pB.y) / 2,
                    (pA.z + pB.z) / 2 + normal.z * (depth / 2)
                );
                this._createElevationSlideHandle(midPt.x, midPt.y, midPt.z, normal);
                break;
            }
        }
    }

    _createCornerWrapHandle(nodeIndex, x, y, z, dir, adjDir) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        group.renderOrder = 2505;

        const uIn = dir ? dir.clone().normalize() : new THREE.Vector3(1, 0, 0);
        const uOut = adjDir ? adjDir.clone().normalize() : uIn.clone();
        const yAxis = new THREE.Vector3(0, 1, 0);

        // 1. Invisible hit collider covering the entire turn arrow area
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(24, 12, 12), hitMat);
        const colliderOffset = uIn.clone().multiplyScalar(6).add(uOut.clone().multiplyScalar(12));
        hitMesh.position.copy(colliderOffset);
        hitMesh.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        group.add(hitMesh);

        // Materials: Vibrant emerald & mint with depthTest: false to remain visible above walls
        const matStem = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false });
        const matHead = new THREE.MeshBasicMaterial({ color: 0x34d399, depthTest: false });
        const matAccent = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });

        // 2. Base anchor ring at origin
        const baseRing = new THREE.Mesh(new THREE.TorusGeometry(4.5, 1.0, 8, 16), matAccent);
        baseRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), uIn);
        baseRing.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        baseRing.renderOrder = 2506;
        group.add(baseRing);

        // 3. Approach stem along uIn (length 8)
        const stemGeo = new THREE.CylinderGeometry(2.4, 2.4, 8, 14);
        const stemMesh = new THREE.Mesh(stemGeo, matStem);
        stemMesh.position.copy(uIn.clone().multiplyScalar(4));
        stemMesh.quaternion.setFromUnitVectors(yAxis, uIn);
        stemMesh.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        stemMesh.renderOrder = 2506;
        group.add(stemMesh);

        // 4. Elbow corner sphere at turn (position uIn * 8)
        const elbowPos = uIn.clone().multiplyScalar(8);
        const elbowMesh = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 12), matAccent);
        elbowMesh.position.copy(elbowPos);
        elbowMesh.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        elbowMesh.renderOrder = 2506;
        group.add(elbowMesh);

        // 5. Turn shaft along uOut (length 14)
        const shaftGeo = new THREE.CylinderGeometry(2.6, 2.6, 14, 14);
        const shaftMesh = new THREE.Mesh(shaftGeo, matStem);
        shaftMesh.position.copy(elbowPos.clone().add(uOut.clone().multiplyScalar(7)));
        shaftMesh.quaternion.setFromUnitVectors(yAxis, uOut);
        shaftMesh.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        shaftMesh.renderOrder = 2507;
        group.add(shaftMesh);

        // 6. Prominent 3D Arrowhead Cone pointing along uOut (radius 6.5, length 14)
        const coneGeo = new THREE.ConeGeometry(6.5, 14, 16);
        const coneMesh = new THREE.Mesh(coneGeo, matHead);
        coneMesh.position.copy(elbowPos.clone().add(uOut.clone().multiplyScalar(14 + 7)));
        coneMesh.quaternion.setFromUnitVectors(yAxis, uOut);
        coneMesh.userData = { isElevationHandle: true, handleType: 'corner_wrap', nodeIndex };
        coneMesh.renderOrder = 2508;
        group.add(coneMesh);

        this.handles.add(group);
    }

    _createElevationSlideHandle(x, y, z, normal) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isElevationHandle: true, handleType: 'elevation_slide' };
        group.renderOrder = 2505;

        // Reliable invisible hit collider
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(16, 12, 12), hitMat);
        hitMesh.userData = { isElevationHandle: true, handleType: 'elevation_slide' };
        group.add(hitMesh);

        // Center Pill Core
        const pillGeo = new THREE.CylinderGeometry(4.5, 4.5, 10, 16);
        const pillMesh = new THREE.Mesh(pillGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false }));
        pillMesh.userData = { isElevationHandle: true, handleType: 'elevation_slide' };
        pillMesh.renderOrder = 2505;
        group.add(pillMesh);

        // Up Arrow Cone (▲)
        const coneUp = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7, 12), new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false }));
        coneUp.position.set(0, 9, 0);
        coneUp.userData = { isElevationHandle: true, handleType: 'elevation_slide' };
        coneUp.renderOrder = 2506;
        group.add(coneUp);

        // Down Arrow Cone (▼)
        const coneDown = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7, 12), new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false }));
        coneDown.position.set(0, -9, 0);
        coneDown.rotation.x = Math.PI;
        coneDown.userData = { isElevationHandle: true, handleType: 'elevation_slide' };
        coneDown.renderOrder = 2506;
        group.add(coneDown);

        // Halo Ring around center
        const halo = new THREE.Mesh(new THREE.TorusGeometry(7.5, 1.2, 8, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        halo.rotation.x = Math.PI / 2;
        halo.userData = { isElevationHandle: true, handleType: 'elevation_slide' };
        halo.renderOrder = 2505;
        group.add(halo);

        this.handles.add(group);
    }

    _createPushPullHandle(nodeIndex, x, y, z, dir) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isElevationHandle: true, handleType: 'push_pull', nodeIndex, dir: dir.clone() };
        group.renderOrder = 2500;

        // Reliable invisible hit collider (transparent + zero opacity)
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(18, 12, 12), hitMat);
        hitMesh.userData = { isElevationHandle: true, handleType: 'push_pull', nodeIndex, dir: dir.clone() };
        group.add(hitMesh);

        // Radiant Outer Ring - oriented perpendicular to dir
        const ringGeo = new THREE.TorusGeometry(8.0, 1.4, 8, 24);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        ringMesh.userData = { isElevationHandle: true, handleType: 'push_pull', nodeIndex, dir: dir.clone() };
        ringMesh.renderOrder = 2501;
        group.add(ringMesh);

        // Center Radiant Core Bead (Glowing Cyan)
        const discGeo = new THREE.SphereGeometry(5.5, 16, 16);
        const discMesh = new THREE.Mesh(discGeo, this.matPushPull);
        discMesh.userData = { isElevationHandle: true, handleType: 'push_pull', nodeIndex, dir: dir.clone() };
        discMesh.renderOrder = 2502;
        group.add(discMesh);

        this.handles.add(group);
    }

    _createExtrudeArrow(nodeIndex, direction, x, y, z, color, dirVec = null) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isElevationHandle: true, handleType: 'extrude_arrow', nodeIndex, direction };
        group.renderOrder = 2503;

        // Reliable invisible hit collider
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 12), hitMat);
        hitMesh.userData = { isElevationHandle: true, handleType: 'extrude_arrow', nodeIndex, direction };
        group.add(hitMesh);

        // Compact Sprout Indicator Cone
        const cone = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7.5, 12), new THREE.MeshBasicMaterial({ color, depthTest: false }));
        if (dirVec) {
            cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec);
        } else {
            if (direction === 'down') cone.rotation.x = Math.PI;
            else if (direction === 'left') cone.rotation.z = Math.PI / 2;
            else if (direction === 'right') cone.rotation.z = -Math.PI / 2;
        }

        cone.userData = { isElevationHandle: true, handleType: 'extrude_arrow', nodeIndex, direction };
        cone.renderOrder = 2504;
        group.add(cone);

        this.handles.add(group);
    }

    _createBendJunctionGrip(nodeIndex, x, y, z, isFillet) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isElevationHandle: true, handleType: 'bend_junction', nodeIndex };
        group.renderOrder = 2500;

        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 12), hitMat);
        hitMesh.userData = { isElevationHandle: true, handleType: 'bend_junction', nodeIndex };
        group.add(hitMesh);

        // Octahedron Diamond for Sharp, Smooth Sphere for Fillet
        const geo = isFillet ? new THREE.SphereGeometry(5.5, 16, 16) : new THREE.OctahedronGeometry(6.5);
        const mat = (nodeIndex === this.activeBendIndex) ? this.matBendActive : this.matBend;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData = { isElevationHandle: true, handleType: 'bend_junction', nodeIndex };
        mesh.renderOrder = 2501;
        group.add(mesh);

        // Accent Halo Ring
        const halo = new THREE.Mesh(new THREE.TorusGeometry(6.5, 1.0, 8, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        halo.userData = { isElevationHandle: true, handleType: 'bend_junction', nodeIndex };
        halo.renderOrder = 2502;
        group.add(halo);

        this.handles.add(group);
    }

    _onPointerDown(e) {
        if (!this.visible || e.button !== 0) return;
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        const intersects = this.raycaster.intersectObjects(this.handles.children, true);
        if (intersects.length === 0) return;

        let handleObj = null;
        for (const hit of intersects) {
            let curr = hit.object;
            while (curr && !curr.userData?.isElevationHandle && curr !== this.handles) {
                curr = curr.parent;
            }
            if (curr && curr.userData?.isElevationHandle) {
                handleObj = curr;
                break;
            }
        }

        if (!handleObj) return;

        e.preventDefault();
        e.stopPropagation();

        const entity = this._getEntity();
        if (!entity || !entity.points || entity.points.length < 2) return;

        const handleType = handleObj.userData.handleType;
        const nodeIndex = handleObj.userData.nodeIndex;

        // 1. Extrude Arrow: Sprout new segment and smoothly enter active pull drag mode
        if (handleType === 'extrude_arrow') {
            const dir = handleObj.userData.direction;
            const res = sproutBendAtEndpoint(entity, nodeIndex, dir, 100);

            if (res) {
                this._rebuildEntityInPlace(entity);
                this.updateHandles();

                // Transfer seamlessly into active axial dragging for the newly sprouted endpoint!
                const newPtIdx = (nodeIndex === 0) ? 0 : entity.points.length - 1;
                const neighborIdx = (newPtIdx === 0) ? 1 : entity.points.length - 2;

                const pt = entity.points[newPtIdx];
                const neighbor = entity.points[neighborIdx];

                const axis = new THREE.Vector3(pt.x - neighbor.x, pt.y - neighbor.y, pt.z - neighbor.z).normalize();
                const initialLen = Math.hypot(pt.x - neighbor.x, pt.y - neighbor.y, pt.z - neighbor.z);

                this.isDragging = true;
                if (this.ctx.controls) this.ctx.controls.enabled = false;

                this.activeHandle = {
                    handleType: 'push_pull',
                    nodeIndex: newPtIdx,
                    neighborIndex: neighborIdx,
                    axis,
                    initialLen,
                    neighborPos: new THREE.Vector3(neighbor.x, neighbor.y, neighbor.z),
                    initialPos: new THREE.Vector3(pt.x, pt.y, pt.z)
                };

                const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
                const centerOffset = normal.clone().multiplyScalar((entity.depth || 40) / 2);
                const handlePos = new THREE.Vector3(pt.x, pt.y, pt.z).add(centerOffset);

                this.dragPlane.setFromNormalAndCoplanarPoint(normal, handlePos);
                this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);

                this._updateBadge(`Sprouted ${dir.toUpperCase()} (Drag to Extend)`, handlePos);
            }
            return;
        }

        // 2. Bend Junction: Setup drag to reposition corner, or click to toggle Sharp vs Fillet
        if (handleType === 'bend_junction') {
            this.activeBendIndex = nodeIndex;
            const pt = entity.points[nodeIndex];

            if (this.ctx.updateElevationPanel) {
                this.ctx.updateElevationPanel(entity, nodeIndex);
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('elevation-node-select', {
                    detail: { entity, nodeIndex }
                }));
            }

            this.isDragging = true;
            if (this.ctx.controls) this.ctx.controls.enabled = false;

            this.activeHandle = {
                handleType: 'bend_junction',
                nodeIndex,
                initialPos: new THREE.Vector3(pt.x, pt.y, pt.z),
                downTime: Date.now(),
                hasMoved: false
            };

            const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const centerOffset = normal.clone().multiplyScalar((entity.depth || 40) / 2);
            const handlePos = new THREE.Vector3(pt.x, pt.y, pt.z).add(centerOffset);

            this.dragPlane.setFromNormalAndCoplanarPoint(normal, handlePos);
            this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);
            return;
        }

        // 3. Dual-End Push/Pull Drag: Lock into smooth on-axis stretch
        if (handleType === 'push_pull') {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('elevation-node-select', {
                    detail: { entity, nodeIndex }
                }));
            }
            const pt = entity.points[nodeIndex];
            const neighborIdx = (nodeIndex === 0) ? 1 : entity.points.length - 2;
            const neighbor = entity.points[neighborIdx];

            const axis = new THREE.Vector3(pt.x - neighbor.x, pt.y - neighbor.y, pt.z - neighbor.z).normalize();
            const initialLen = Math.hypot(pt.x - neighbor.x, pt.y - neighbor.y, pt.z - neighbor.z);

            this.isDragging = true;
            if (this.ctx.controls) this.ctx.controls.enabled = false;

            this.activeHandle = {
                handleType: 'push_pull',
                nodeIndex,
                neighborIndex: neighborIdx,
                axis,
                initialLen,
                neighborPos: new THREE.Vector3(neighbor.x, neighbor.y, neighbor.z),
                initialPos: new THREE.Vector3(pt.x, pt.y, pt.z)
            };

            const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const centerOffset = normal.clone().multiplyScalar((entity.depth || 40) / 2);
            const handlePos = new THREE.Vector3(pt.x, pt.y, pt.z).add(centerOffset);

            this.dragPlane.setFromNormalAndCoplanarPoint(normal, handlePos);
            this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);
            return;
        }

        // 4. Center Elevation Slide Drag: Smoothly move the entire beam UP and DOWN the wall
        if (handleType === 'elevation_slide') {
            this.isDragging = true;
            if (this.ctx.controls) this.ctx.controls.enabled = false;

            this.activeHandle = {
                handleType: 'elevation_slide',
                initialY: entity.points[0].y,
                initialPointsY: entity.points.map(p => p.y)
            };

            const pt0 = entity.points[0];
            const normal = pt0.normal ? new THREE.Vector3(pt0.normal.x, pt0.normal.y, pt0.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const handlePos = new THREE.Vector3(handleObj.position.x, handleObj.position.y, handleObj.position.z);

            this.dragPlane.setFromNormalAndCoplanarPoint(normal, handlePos);
            this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);
            this._updateBadge(`Drag Up/Down to Adjust Height`, handlePos);
            return;
        }

        // 5. Wall Corner Wrap: Wrap beam around 90° corner onto adjacent connected wall
        if (handleType === 'corner_wrap') {
            const res = wrapElevationSegmentToAdjacentWall(entity, nodeIndex, this.ctx.planner);
            if (res) {
                this._rebuildEntityInPlace(entity);
                this.updateHandles();
                if (this.ctx.requestRender) this.ctx.requestRender('corner_wrapped', 2);
                if (typeof window !== 'undefined' && window.coreEventBus) {
                    window.coreEventBus.emit('SAVE_HISTORY', { action: 'Wrap Elevation Segment Around Corner' });
                }
                const normal = res.endPt.normal ? new THREE.Vector3(res.endPt.normal.x, res.endPt.normal.y, res.endPt.normal.z) : new THREE.Vector3(0, 0, 1);
                const handlePos = new THREE.Vector3(res.endPt.x, res.endPt.y, res.endPt.z).add(normal.clone().multiplyScalar((entity.depth || 40) / 2));
                this._updateBadge(`Wrapped onto ${res.adjWall?.name || 'Adjacent Wall'} (L-Bend)`, handlePos);
            }
            return;
        }
    }

    _onPointerMove(e) {
        if (!this.visible) return;
        this.updateMouse(e);

        if (!this.isDragging) {
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, true);
            const dom = this.ctx.renderer?.domElement;
            if (dom) {
                if (intersects.length > 0) {
                    let curr = intersects[0].object;
                    while (curr && !curr.userData?.isElevationHandle && curr !== this.handles) curr = curr.parent;
                    const hType = curr?.userData?.handleType;
                    const hPos = curr?.position || new THREE.Vector3();
                    if (hType === 'push_pull') {
                        dom.style.cursor = 'ew-resize';
                        this._updateBadge('Drag to Stretch / Shorten along Wall (Snaps to Corners)', hPos);
                    } else if (hType === 'elevation_slide') {
                        dom.style.cursor = 'ns-resize';
                        this._updateBadge('Drag Up/Down to Adjust Height', hPos);
                    } else if (hType === 'extrude_arrow') {
                        dom.style.cursor = 'crosshair';
                        this._updateBadge('Click to Sprout 90° Arm', hPos);
                    } else if (hType === 'bend_junction') {
                        dom.style.cursor = 'move';
                        this._updateBadge('Drag Corner | Click to Toggle Curve', hPos);
                    } else if (hType === 'corner_wrap') {
                        dom.style.cursor = 'pointer';
                        this._updateBadge('Click to Wrap Around Corner onto Next Wall (L-Bend ↳)', hPos);
                    } else {
                        dom.style.cursor = 'pointer';
                    }
                } else {
                    dom.style.cursor = 'auto';
                    if (this.domBadge && !this.isDragging) this.domBadge.style.display = 'none';
                }
            }
            return;
        }

        const entity = this._getEntity();
        if (!entity || !this.activeHandle) return;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const currentIntersection = new THREE.Vector3();
        if (!this.raycaster.ray.intersectPlane(this.dragPlane, currentIntersection)) return;

        // Handle Elevation Slide Drag (Up and Down on Wall)
        if (this.activeHandle.handleType === 'elevation_slide') {
            const deltaY = currentIntersection.y - this.dragStartPoint.y;
            const snap = 5;
            let targetY = Math.round((this.activeHandle.initialY + deltaY) / snap) * snap;
            targetY = Math.max(10, Math.min(600, targetY));

            let snapMsg = '';
            [0, 80, 150, 210, 300, 380, 510, 600].forEach(levelY => {
                if (Math.abs(targetY - levelY) <= 8) {
                    targetY = levelY;
                    snapMsg = levelY === 210 ? ' (Window Lintel)' : (levelY % 300 === 0 ? ` (Floor Level ${levelY}cm)` : '');
                }
            });

            const diffY = targetY - this.activeHandle.initialY;
            entity.points.forEach((p, idx) => {
                p.y = this.activeHandle.initialPointsY[idx] + diffY;
                if (entity.nodes && entity.nodes[idx]) {
                    entity.nodes[idx].y = p.y;
                }
            });

            this._rebuildEntityInPlace(entity);
            this.updateHandles();

            const normal = entity.points[0].normal ? new THREE.Vector3(entity.points[0].normal.x, entity.points[0].normal.y, entity.points[0].normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const badgePt = new THREE.Vector3(
                (entity.points[0].x + entity.points[1].x) / 2 + normal.x * ((entity.depth || 40) / 2),
                targetY,
                (entity.points[0].z + entity.points[1].z) / 2 + normal.z * ((entity.depth || 40) / 2)
            );
            this._updateBadge(`Elevation: ${Math.round(targetY)} cm${snapMsg}`, badgePt);
            return;
        }

        // Handle Bend Junction Corner Drag (Move corner along the wall plane)
        if (this.activeHandle.handleType === 'bend_junction') {
            const mouseDelta = currentIntersection.clone().sub(this.dragStartPoint);
            if (mouseDelta.length() > 3) {
                this.activeHandle.hasMoved = true;
            }

            if (!this.activeHandle.hasMoved) return;

            const ptIdx = this.activeHandle.nodeIndex;
            const pt = entity.points[ptIdx];
            const initPos = this.activeHandle.initialPos;

            // Compute target position on wall plane
            let targetX = initPos.x + mouseDelta.x;
            let targetY = initPos.y + mouseDelta.y;
            let targetZ = initPos.z + mouseDelta.z;

            // Snap to 5cm step
            targetX = Math.round(targetX / 5) * 5;
            targetY = Math.round(targetY / 5) * 5;
            targetZ = Math.round(targetZ / 5) * 5;

            // Orthogonal snap with adjacent neighbors if near horizontal or vertical
            const prevPt = entity.points[ptIdx - 1];
            const nextPt = entity.points[ptIdx + 1];
            let snapMsg = '';

            if (prevPt) {
                if (Math.abs(targetY - prevPt.y) <= 8) {
                    targetY = prevPt.y;
                    snapMsg = ' (Snap: Horizontal)';
                }
                if (Math.hypot(targetX - prevPt.x, targetZ - prevPt.z) <= 8) {
                    targetX = prevPt.x;
                    targetZ = prevPt.z;
                    snapMsg = ' (Snap: Vertical)';
                }
            }
            if (nextPt) {
                if (Math.abs(targetY - nextPt.y) <= 8) {
                    targetY = nextPt.y;
                    snapMsg = ' (Snap: Horizontal)';
                }
                if (Math.hypot(targetX - nextPt.x, targetZ - nextPt.z) <= 8) {
                    targetX = nextPt.x;
                    targetZ = nextPt.z;
                    snapMsg = ' (Snap: Vertical)';
                }
            }

            pt.x = targetX;
            pt.y = targetY;
            pt.z = targetZ;

            if (entity.nodes && entity.nodes[ptIdx]) {
                entity.nodes[ptIdx].x = targetX;
                entity.nodes[ptIdx].y = targetY;
                entity.nodes[ptIdx].z = targetZ;
            }

            this._rebuildEntityInPlace(entity);
            this.updateHandles();

            const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
            const centerOffset = normal.clone().multiplyScalar((entity.depth || 40) / 2);
            const badgePos = new THREE.Vector3(targetX, targetY, targetZ).add(centerOffset);
            this._updateBadge(`Corner Position: [${Math.round(targetX)}, ${Math.round(targetY)}]${snapMsg}`, badgePos);
            return;
        }

        const mouseDelta = currentIntersection.clone().sub(this.dragStartPoint);

        const axis = this.activeHandle.axis;
        const neighbor = this.activeHandle.neighborPos;
        const ptIdx = this.activeHandle.nodeIndex;
        const pt = entity.points[ptIdx];

        // 1D Axial projection: strictly onto the segment axis!
        const axialDelta = mouseDelta.dot(axis);

        let newLen = this.activeHandle.initialLen + axialDelta;
        // Minimum segment length 25cm
        newLen = Math.max(25, newLen);

        // Snap to 5cm step
        newLen = Math.round(newLen / 5) * 5;

        // Calculate candidate endpoint along axis
        let newPtX = Math.round(neighbor.x + axis.x * newLen);
        let newPtY = Math.round(neighbor.y + axis.y * newLen);
        let newPtZ = Math.round(neighbor.z + axis.z * newLen);

        let snapMsg = '';
        const planner = this.ctx.planner;

        // Intelligent On-Axis Snapping
        if (Math.abs(axis.y) < 0.35 && planner && planner.walls) {
            const hostWall = planner.walls.find(w => w.id === entity.wallId);
            const thick = hostWall?.thickness || 20;
            const surfaceOffset = (thick / 2) + 0.3;
            const norm = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);

            for (const w of planner.walls) {
                const p1 = (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position() : (w.startAnchor || { x: w.startX || 0, y: w.startY || 0 });
                const p2 = (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position() : (w.endAnchor || { x: w.endX || 0, y: w.endY || 0 });

                const anchors = [p1, p2];
                for (const anch of anchors) {
                    const anch_faceX = anch.x + norm.x * surfaceOffset;
                    const anch_faceZ = anch.y + norm.z * surfaceOffset;

                    // Axial distance along segment from neighbor to this corner anchor
                    const toAnchX = anch_faceX - neighbor.x;
                    const toAnchZ = anch_faceZ - neighbor.z;
                    const distAlongAxis = toAnchX * axis.x + toAnchZ * axis.z;

                    if (distAlongAxis > 20) {
                        const diff = newLen - distAlongAxis;
                        // Magnetic latch: approaching within 35cm OR overshooting up to 50cm
                        if (Math.abs(diff) <= 35 || (diff > 0 && diff <= 50)) {
                            newLen = Math.max(25, Math.round(distAlongAxis));
                            newPtX = Math.round(neighbor.x + axis.x * newLen);
                            newPtZ = Math.round(neighbor.z + axis.z * newLen);
                            snapMsg = ' (📍 Snapped Flush to Corner)';
                            break;
                        }
                    }
                }
                if (snapMsg) break;
            }
        } else if (Math.abs(axis.y) > 0.8) {
            // Vertical segment: snap to floor levels
            [0, 300, 600, 900].forEach(levelY => {
                if (Math.abs(newPtY - levelY) <= 12) {
                    newPtY = levelY;
                    newLen = Math.abs(newPtY - neighbor.y);
                    snapMsg = ` (Snap: Level ${levelY}cm)`;
                }
            });
        }

        pt.x = newPtX;
        pt.y = newPtY;
        pt.z = newPtZ;

        if (entity.nodes && entity.nodes[ptIdx]) {
            entity.nodes[ptIdx].x = newPtX;
            entity.nodes[ptIdx].y = newPtY;
            entity.nodes[ptIdx].z = newPtZ;
        }

        this._rebuildEntityInPlace(entity);
        this.updateHandles();

        const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
        const centerOffset = normal.clone().multiplyScalar((entity.depth || 40) / 2);
        const badgePos = new THREE.Vector3(newPtX, newPtY, newPtZ).add(centerOffset);

        this._updateBadge(`Length: ${Math.round(newLen)} cm${snapMsg}`, badgePos);
    }

    _onPointerUp(e) {
        if (!this.isDragging) return;

        // If user tapped on a bend junction without dragging, toggle Sharp vs Fillet!
        if (this.activeHandle && this.activeHandle.handleType === 'bend_junction' && !this.activeHandle.hasMoved) {
            const nodeIndex = this.activeHandle.nodeIndex;
            const entity = this._getEntity();
            if (entity && entity.points && entity.points[nodeIndex]) {
                const pt = entity.points[nodeIndex];
                const nextStyle = (pt.cornerStyle === 'fillet') ? 'sharp' : 'fillet';
                setNodeCornerStyle(entity, nodeIndex, nextStyle, pt.radius || 25);
                this._rebuildEntityInPlace(entity);
                this.updateHandles();

                if (this.ctx.updateElevationPanel) {
                    this.ctx.updateElevationPanel(entity, nodeIndex);
                }
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('elevation-node-select', {
                        detail: { entity, nodeIndex }
                    }));
                }

                const normal = pt.normal ? new THREE.Vector3(pt.normal.x, pt.normal.y, pt.normal.z).normalize() : new THREE.Vector3(0, 0, 1);
                const centerOffset = normal.clone().multiplyScalar((entity.depth || 40) / 2);
                const badgePos = new THREE.Vector3(pt.x, pt.y, pt.z).add(centerOffset);
                this._updateBadge(`Corner: ${nextStyle === 'fillet' ? `Smooth Fillet (R: ${pt.radius || 25}cm)` : 'Sharp 45° Miter'}`, badgePos);
                setTimeout(() => { if (!this.isDragging && this.domBadge) this.domBadge.style.display = 'none'; }, 1800);
            }
        }

        this.isDragging = false;
        this.activeHandle = null;
        if (this.ctx.controls) this.ctx.controls.enabled = true;
        if (this.domBadge) this.domBadge.style.display = 'none';

        const entity = this._getEntity();
        if (entity) {
            this._rebuildEntityInPlace(entity);
            this.updateHandles();
            if (this.ctx.planner?.debouncedSaveHistory) {
                this.ctx.planner.debouncedSaveHistory();
            }
        }
    }

    _rebuildEntityInPlace(entity) {
        if (!entity || !entity.mesh3D) return;
        // Strictly updates geometry in-place on existing mesh3D without removing group!
        renderElevationSegment3D(null, entity, this.ctx.helpers);
        const bodyMesh = this._getBodyMesh();
        if (bodyMesh && bodyMesh.geometry) {
            this._updateHighlight(bodyMesh.geometry);
        }
        if (this.ctx.requestRender) this.ctx.requestRender('elevation_segment_update', 2);
    }

    destroy() {
        if (this.ctx.controls) this.ctx.controls.enabled = true;
        if (this.highlightMesh) {
            this.handles.remove(this.highlightMesh);
            if (this.highlightMesh.geometry) this.highlightMesh.geometry.dispose();
            this.highlightMesh = null;
        }
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (this.domBadge && this.domBadge.parentNode) {
            this.domBadge.parentNode.removeChild(this.domBadge);
        }
    }
}

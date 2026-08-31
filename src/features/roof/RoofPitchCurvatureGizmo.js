import * as THREE from 'three';
import { EVENTS } from '../../core/registry.js';
import { coreEventBus } from '../../core/EventBus.js';
import { offsetPolygon } from '../../core/registry.js';

/**
 * RoofPitchCurvatureGizmo
 * 
 * Complete Sims 4 In-Viewport 3D Interactive Roof Gizmo with Dedicated, Non-Overlapping Icons:
 * 
 * 1. Apex Pitch Dual-Arrow (Gold ↕): Dedicated at the Ridge Apex Top.
 * 2. Slope Curvature Orb (Cyan ◯): Dedicated in the middle of the Roof Slope Face.
 * 3. Eave Overhang Pull-Tabs (Blue ↔): Dedicated at the 4 Eave Center Trim Edges.
 * 4. Boundary Corner Stretch Crystals (Pink ⬡): Dedicated at the 4 Outer Footprint Corners.
 */
export class RoofPitchCurvatureGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'RoofPitchCurvatureGizmo';
        this.target = null;
        this.handles = new THREE.Group();
        this.handles.name = 'RoofGizmoHandles';
        this.add(this.handles);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.visible = false;

        // High-visibility materials (depthTest: false ensures handles are always rendered on top)
        this.pitchMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 });
        this.pitchMatHover = new THREE.MeshBasicMaterial({ color: 0xfde047, depthTest: false, transparent: true, opacity: 1.0 });
        this.pitchMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.curveMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, depthTest: false, transparent: true, opacity: 0.95 });
        this.curveMatHover = new THREE.MeshBasicMaterial({ color: 0x67e8f9, depthTest: false, transparent: true, opacity: 1.0 });
        this.curveMatActive = new THREE.MeshBasicMaterial({ color: 0xa855f7, depthTest: false, transparent: true, opacity: 1.0 });

        this.overhangMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, depthTest: false, transparent: true, opacity: 0.95 });
        this.overhangMatHover = new THREE.MeshBasicMaterial({ color: 0x93c5fd, depthTest: false, transparent: true, opacity: 1.0 });
        this.overhangMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.stretchMat = new THREE.MeshBasicMaterial({ color: 0xec4899, depthTest: false, transparent: true, opacity: 0.95 });
        this.stretchMatHover = new THREE.MeshBasicMaterial({ color: 0xf472b6, depthTest: false, transparent: true, opacity: 1.0 });
        this.stretchMatActive = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 1.0 });

        this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.9 });
        this.darkMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, depthTest: false, transparent: true, opacity: 0.9 });

        this.activeHandle = null;
        this.isDragging = false;
        this.dragPlane = new THREE.Plane();
        this.dragStartPos = new THREE.Vector3();
        this.planeIntersect = new THREE.Vector3();
        this.initialPitch = 30;
        this.initialRh = 30;
        this.initialCurve = 0;
        this.initialOverhang = 8;
        this.initialPoints = [];
        this.initialMinX = 0;
        this.initialMaxX = 0;
        this.initialMinY = 0;
        this.initialMaxY = 0;
        this.hoveredHandle = null;

        this._createDOMBadge();

        const dom = this.ctx.renderer?.domElement;

        this._onPointerDown = (e) => {
            if (!this.visible || !this.target) return;
            if (e.button !== 0) return;
            this.updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, true);
            if (intersects.length > 0) {
                e.preventDefault();
                e.stopPropagation();

                let handle = intersects[0].object;
                while (handle.parent && handle.parent !== this.handles) {
                    handle = handle.parent;
                }

                this.activeHandle = handle;
                this.isDragging = true;

                const entity = this.target.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                this.initialPitch = conf.pitch !== undefined ? conf.pitch : 30;
                this.initialCurve = conf.curve !== undefined ? conf.curve : 0;
                this.initialOverhang = conf.overhang !== undefined ? conf.overhang : 8;
                this.initialPoints = (entity.points || []).map(p => ({ x: p.x, y: p.y }));

                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                this.initialPoints.forEach(p => {
                    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                });
                this.initialMinX = minX;
                this.initialMaxX = maxX;
                this.initialMinY = minY;
                this.initialMaxY = maxY;

                const w = maxX - minX, d = maxY - minY;
                const span = Math.min(w, d);
                this.initialRh = Math.tan(this.initialPitch * Math.PI / 180) * (span / 2);

                const type = handle.userData?.type;
                if (type === 'pitch' || type === 'curve') {
                    // Vertical drag plane facing camera
                    const camDir = this.ctx.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate();
                    this.dragPlane.setFromNormalAndCoplanarPoint(camDir, intersects[0].point);
                } else {
                    // Horizontal drag plane (XZ)
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), intersects[0].point);
                }

                this.dragStartPos.copy(intersects[0].point);

                this.refreshHandleMaterials();
                if (this.ctx.controls) this.ctx.controls.enabled = false;
            }
        };

        this._onPointerMove = (e) => {
            if (!this.visible || !this.target) return;
            this.updateMouse(e);

            if (this.isDragging && this.activeHandle) {
                e.preventDefault();
                e.stopPropagation();

                const entity = this.target.userData?.entity;
                if (!entity) return;
                const conf = entity.config || entity;
                const type = this.activeHandle.userData?.type;

                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const hit = this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect);
                if (!hit) return;

                const w = this.initialMaxX - this.initialMinX;
                const d = this.initialMaxY - this.initialMinY;
                const span = Math.min(w, d);

                if (type === 'pitch') {
                    // Vertical Height / Pitch adjustment
                    const deltaY = this.planeIntersect.y - this.dragStartPos.y;
                    const newRh = Math.max(2, this.initialRh + deltaY);
                    const newPitch = Math.max(0, Math.min(65, Math.round(Math.atan2(newRh, span / 2) * (180 / Math.PI))));
                    conf.pitch = newPitch;

                    this._updateDOMBadge(`PITCH: ${newPitch}&deg; | Peak: ${this._formatFeetInches(newRh)}`, { x: e.clientX, y: e.clientY });
                } else if (type === 'curve') {
                    // Slope Curvature adjustment
                    const deltaY = this.planeIntersect.y - this.dragStartPos.y;
                    const newCurve = Math.max(-50, Math.min(50, Math.round(this.initialCurve + deltaY * 0.4)));
                    conf.curve = newCurve;

                    const curveLabel = newCurve > 0 ? `Convex (+${newCurve})` : (newCurve < 0 ? `Pagoda (${newCurve})` : 'Flat (0)');
                    this._updateDOMBadge(`CURVATURE: ${curveLabel}`, { x: e.clientX, y: e.clientY });
                } else if (type === 'overhang') {
                    // Eave Overhang adjustment
                    const edgeIdx = this.activeHandle.userData?.edgeIndex;
                    let delta = 0;
                    if (edgeIdx === 0) delta = this.dragStartPos.z - this.planeIntersect.z; // North
                    else if (edgeIdx === 1) delta = this.planeIntersect.x - this.dragStartPos.x; // East
                    else if (edgeIdx === 2) delta = this.planeIntersect.z - this.dragStartPos.z; // South
                    else if (edgeIdx === 3) delta = this.dragStartPos.x - this.planeIntersect.x; // West

                    const newOverhang = Math.max(0, Math.min(60, Math.round(this.initialOverhang + delta)));
                    conf.overhang = newOverhang;
                    if (conf.overhangs) conf.overhangs.fill(newOverhang);

                    this._updateDOMBadge(`OVERHANG: ${this._formatFeetInches(newOverhang)}`, { x: e.clientX, y: e.clientY });
                } else if (type === 'stretch') {
                    // Corner Footprint Stretch in 3D
                    const corner = this.activeHandle.userData?.corner;
                    const deltaX = this.planeIntersect.x - this.dragStartPos.x;
                    const deltaZ = this.planeIntersect.z - this.dragStartPos.z;

                    let minX = this.initialMinX, maxX = this.initialMaxX;
                    let minY = this.initialMinY, maxY = this.initialMaxY;

                    if (corner === 'nw') {
                        minX = Math.min(maxX - 40, this.initialMinX + deltaX);
                        minY = Math.min(maxY - 40, this.initialMinY + deltaZ);
                    } else if (corner === 'ne') {
                        maxX = Math.max(minX + 40, this.initialMaxX + deltaX);
                        minY = Math.min(maxY - 40, this.initialMinY + deltaZ);
                    } else if (corner === 'se') {
                        maxX = Math.max(minX + 40, this.initialMaxX + deltaX);
                        maxY = Math.max(minY + 40, this.initialMaxY + deltaZ);
                    } else if (corner === 'sw') {
                        minX = Math.min(maxX - 40, this.initialMinX + deltaX);
                        maxY = Math.max(minY + 40, this.initialMaxY + deltaZ);
                    }

                    entity.points = [
                        { x: minX, y: minY },
                        { x: maxX, y: minY },
                        { x: maxX, y: maxY },
                        { x: minX, y: maxY }
                    ];

                    const curW = maxX - minX, curD = maxY - minY;
                    this._updateDOMBadge(`FOOTPRINT: ${this._formatFeetInches(curW)} &times; ${this._formatFeetInches(curD)}`, { x: e.clientX, y: e.clientY });
                }

                // Granular In-Place CAD Rebuild via EnvironmentBuilder
                if (this.ctx.envBuilder && this.ctx.envBuilder.updateRoofLive) {
                    this.ctx.envBuilder.updateRoofLive(entity);
                } else if (this.ctx.updateRoofLive) {
                    this.ctx.updateRoofLive(entity);
                }

                // Two-way sync to 2D Konva stage
                if (entity.update) entity.update();
                if (this.ctx.planner?.stage?.batchDraw) this.ctx.planner.stage.batchDraw();

                this.updateHandlePositions();
                if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
                return;
            }

            // Hover effects
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const intersects = this.raycaster.intersectObjects(this.handles.children, true);
            let newHover = null;
            if (intersects.length > 0) {
                let handle = intersects[0].object;
                while (handle.parent && handle.parent !== this.handles) {
                    handle = handle.parent;
                }
                newHover = handle;
            }

            if (this.hoveredHandle !== newHover) {
                this.hoveredHandle = newHover;
                this.refreshHandleMaterials();
                if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
            }
        };

        this._onPointerUp = (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                this.activeHandle = null;
                this._hideDOMBadge();
                this.refreshHandleMaterials();
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                
                const entity = this.target?.userData?.entity;
                if (entity) {
                    coreEventBus.emit(EVENTS.ROOF_CORNER_GIZMO_END, { entity });
                }
                coreEventBus.emit(EVENTS.SYNC_ENGINE);
            }
        };

        if (dom && typeof dom.addEventListener === 'function') {
            dom.addEventListener('pointerdown', this._onPointerDown, true);
            dom.addEventListener('pointermove', this._onPointerMove, false);
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('pointerup', this._onPointerUp, false);
        }
    }

    _createDOMBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'roof-gizmo-live-badge';
        this.domBadge.style.cssText = `
            position: absolute;
            display: none;
            pointer-events: none;
            transform: translate(-50%, -120%);
            padding: 7px 16px;
            border-radius: 18px;
            background: rgba(15, 23, 42, 0.95);
            border: 2px solid #f59e0b;
            box-shadow: 0 6px 22px rgba(0, 0, 0, 0.7), 0 0 16px rgba(245, 158, 11, 0.4);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.5px;
            white-space: nowrap;
            z-index: 999999;
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
        this.domBadge.style.top = `${screenPos.y}px`;
        this.domBadge.style.display = 'block';
    }

    _hideDOMBadge() {
        if (this.domBadge) this.domBadge.style.display = 'none';
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
    }

    attach(target) {
        this.target = target;
        if (!target) {
            this.detach();
            return;
        }

        const entity = target.userData?.entity;
        if (!entity || (entity.type !== 'roof' && !target.userData?.isRoof)) {
            this.detach();
            return;
        }

        this.visible = true;
        this.rebuildHandles();
        this.updateHandlePositions();
        if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.activeHandle = null;
        this.hoveredHandle = null;
        this._hideDOMBadge();
        while (this.handles.children.length > 0) {
            const child = this.handles.children[0];
            this.handles.remove(child);
        }
        if (this.ctx && typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
    }

    rebuildHandles() {
        while (this.handles.children.length > 0) {
            const child = this.handles.children[0];
            this.handles.remove(child);
        }

        if (!this.target) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;

        // 1. Vertical Ridge Peak Cone Handle (Dedicated Gold ↕ Dual-Cone & Ring at Apex)
        const peakGroup = new THREE.Group();
        peakGroup.userData = { type: 'pitch' };
        
        const topCone = new THREE.Mesh(new THREE.ConeGeometry(13, 24, 16), this.pitchMat);
        topCone.position.y = 12;
        topCone.renderOrder = 9999;
        
        const botCone = new THREE.Mesh(new THREE.ConeGeometry(13, 24, 16), this.pitchMat);
        botCone.position.y = -12;
        botCone.rotation.x = Math.PI;
        botCone.renderOrder = 9999;
        
        const centerRod = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 16, 12), this.pitchMat);
        centerRod.renderOrder = 9999;

        const ring = new THREE.Mesh(new THREE.TorusGeometry(15, 2.2, 8, 24), this.ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.renderOrder = 9999;

        peakGroup.add(topCone, botCone, centerRod, ring);
        this.handles.add(peakGroup);
        this.peakHandle = peakGroup;

        // 2. Slope Curvature Handle (Dedicated Cyan ◯ Orbital Sphere resting on Slope Face)
        if (['gable', 'shed', 'curved', 'hip'].includes(conf.roofType)) {
            const curveGroup = new THREE.Group();
            curveGroup.userData = { type: 'curve' };

            const sphere = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 16), this.curveMat);
            sphere.renderOrder = 9999;

            const cRing = new THREE.Mesh(new THREE.TorusGeometry(14, 2, 8, 24), this.ringMat);
            cRing.rotation.x = Math.PI / 4;
            cRing.renderOrder = 9999;

            curveGroup.add(sphere, cRing);
            this.handles.add(curveGroup);
            this.curveHandle = curveGroup;
        }

        // 3. Eave Overhang Pull-Tabs (Dedicated Blue ↔ Pull-Tabs at 4 Eave Edges)
        this.overhangHandles = [];
        for (let i = 0; i < 4; i++) {
            const tabGroup = new THREE.Group();
            tabGroup.userData = { type: 'overhang', edgeIndex: i };

            const badge = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 12), this.overhangMat);
            badge.renderOrder = 9999;

            const outArrow = new THREE.Mesh(new THREE.ConeGeometry(9, 14, 12), this.overhangMat);
            outArrow.rotation.x = Math.PI / 2;
            outArrow.position.z = 11;
            outArrow.renderOrder = 9999;

            tabGroup.add(badge, outArrow);

            if (i === 0) tabGroup.rotation.y = Math.PI;          // North
            else if (i === 1) tabGroup.rotation.y = Math.PI / 2; // East
            else if (i === 2) tabGroup.rotation.y = 0;              // South
            else if (i === 3) tabGroup.rotation.y = -Math.PI / 2;   // West

            this.handles.add(tabGroup);
            this.overhangHandles.push(tabGroup);
        }

        // 4. Boundary Corner Stretch Crystals (Dedicated Pink ⬡ Octahedron Diamonds at 4 Footprint Corners)
        this.stretchHandles = [];
        const corners = ['nw', 'ne', 'se', 'sw'];
        for (let i = 0; i < 4; i++) {
            const stretchGroup = new THREE.Group();
            stretchGroup.userData = { type: 'stretch', corner: corners[i] };

            const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(11, 0), this.stretchMat);
            diamond.renderOrder = 9999;

            const dRing = new THREE.Mesh(new THREE.TorusGeometry(13, 1.8, 6, 16), this.ringMat);
            dRing.rotation.x = Math.PI / 2;
            dRing.renderOrder = 9999;

            stretchGroup.add(diamond, dRing);

            this.handles.add(stretchGroup);
            this.stretchHandles.push(stretchGroup);
        }

        this.refreshHandleMaterials();
    }

    updateHandlePositions() {
        if (!this.target) return;
        const entity = this.target.userData?.entity;
        if (!entity) return;
        const conf = entity.config || entity;
        const pts = entity.points || [];
        if (pts.length < 3) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pts.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });

        const groupX = (entity.group && typeof entity.group.x === 'function') ? entity.group.x() : 0;
        const groupZ = (entity.group && typeof entity.group.y === 'function') ? entity.group.y() : 0;

        const worldMinX = groupX + minX;
        const worldMaxX = groupX + maxX;
        const worldMinY = groupZ + minY;
        const worldMaxY = groupZ + maxY;

        const cx = (worldMinX + worldMaxX) / 2;
        const cz = (worldMinY + worldMaxY) / 2;
        const w = worldMaxX - worldMinX;
        const d = worldMaxY - worldMinY;
        const span = Math.min(w, d);

        const pitch = conf.pitch !== undefined ? conf.pitch : 30;
        const rh = Math.tan(pitch * Math.PI / 180) * (span / 2);

        // Find actual world elevation of the roof
        let baseY = 120;
        if (this.target.parent && this.target.parent.position && this.target.parent.position.y > 0) {
            baseY = this.target.parent.position.y;
        } else if (entity.elevation !== undefined) {
            baseY = entity.elevation;
        }

        const overhang = conf.overhang !== undefined ? conf.overhang : 8;

        // 1. Apex Pitch Cone (Dedicated at the highest point of the ridge)
        if (this.peakHandle) {
            this.peakHandle.position.set(cx, baseY + rh + 16, cz);
        }

        // 2. Slope Curvature Orb (Dedicated on the middle of the North roof slope face)
        if (this.curveHandle) {
            const curveOffset = (conf.curve || 0);
            const slopeFaceY = baseY + (rh * 0.45) + curveOffset + 8;
            const slopeFaceZ = cz - (d * 0.28);
            this.curveHandle.position.set(cx, slopeFaceY, slopeFaceZ);
        }

        // 3. Eave Overhang Pull-Tabs (Dedicated at the 4 center eave edges)
        if (this.overhangHandles && this.overhangHandles.length >= 4) {
            const eaveY = baseY + 4;
            this.overhangHandles[0].position.set(cx, eaveY, worldMinY - overhang - 4); // North Eave
            this.overhangHandles[1].position.set(worldMaxX + overhang + 4, eaveY, cz);  // East Eave
            this.overhangHandles[2].position.set(cx, eaveY, worldMaxY + overhang + 4); // South Eave
            this.overhangHandles[3].position.set(worldMinX - overhang - 4, eaveY, cz);  // West Eave
        }

        // 4. Boundary Corner Stretch Crystals (Dedicated at the 4 outer footprint corners)
        if (this.stretchHandles && this.stretchHandles.length >= 4) {
            const cornerY = baseY + 4;
            const cornerOffset = overhang + 6;
            this.stretchHandles[0].position.set(worldMinX - cornerOffset, cornerY, worldMinY - cornerOffset); // NW Corner
            this.stretchHandles[1].position.set(worldMaxX + cornerOffset, cornerY, worldMinY - cornerOffset); // NE Corner
            this.stretchHandles[2].position.set(worldMaxX + cornerOffset, cornerY, worldMaxY + cornerOffset); // SE Corner
            this.stretchHandles[3].position.set(worldMinX - cornerOffset, cornerY, worldMaxY + cornerOffset); // SW Corner
        }
    }

    refreshHandleMaterials() {
        if (this.peakHandle) {
            const isActive = this.activeHandle === this.peakHandle;
            const isHover = this.hoveredHandle === this.peakHandle;
            const m = isActive ? this.pitchMatActive : (isHover ? this.pitchMatHover : this.pitchMat);
            this.peakHandle.children.forEach(c => { if (c.material !== this.ringMat) c.material = m; });
        }

        if (this.curveHandle) {
            const isActive = this.activeHandle === this.curveHandle;
            const isHover = this.hoveredHandle === this.curveHandle;
            const m = isActive ? this.curveMatActive : (isHover ? this.curveMatHover : this.curveMat);
            this.curveHandle.children.forEach(c => { if (c.material !== this.ringMat) c.material = m; });
        }

        if (this.overhangHandles) {
            this.overhangHandles.forEach(h => {
                const isActive = this.activeHandle === h;
                const isHover = this.hoveredHandle === h;
                const m = isActive ? this.overhangMatActive : (isHover ? this.overhangMatHover : this.overhangMat);
                h.children.forEach(c => { c.material = m; });
            });
        }

        if (this.stretchHandles) {
            this.stretchHandles.forEach(h => {
                const isActive = this.activeHandle === h;
                const isHover = this.hoveredHandle === h;
                const m = isActive ? this.stretchMatActive : (isHover ? this.stretchMatHover : this.stretchMat);
                h.children.forEach(c => { if (c.material !== this.ringMat) c.material = m; });
            });
        }
    }

    dispose() {
        this.detach();
        const dom = this.ctx.renderer?.domElement;
        if (dom && typeof dom.removeEventListener === 'function') {
            dom.removeEventListener('pointerdown', this._onPointerDown, true);
            dom.removeEventListener('pointermove', this._onPointerMove, false);
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('pointerup', this._onPointerUp, false);
        }
        if (this.domBadge && this.domBadge.parentElement) {
            this.domBadge.parentElement.removeChild(this.domBadge);
        }
        if (this.pitchMat) this.pitchMat.dispose();
        if (this.curveMat) this.curveMat.dispose();
        if (this.overhangMat) this.overhangMat.dispose();
        if (this.stretchMat) this.stretchMat.dispose();
    }
}

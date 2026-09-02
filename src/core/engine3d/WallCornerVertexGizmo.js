import * as THREE from 'three';
import { EVENTS } from '../constants/events.js';
import { coreEventBus } from '../EventBus.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { WallEngine } from '../wall/WallEngine.js';

/**
 * WallCornerVertexGizmo (Edge / Point Move - Panel #2)
 * 
 * Provides unified Sims 4 & CAD-style 3D Edge & Point manipulation:
 * 1. Top Corner Vertical Arrows (↑): Drag individual top vertices up/down to create custom sloped or stepped walls.
 * 2. Top Edge Center Bar (↕): Drag top edge up/down to adjust overall wall height.
 * 3. Corner Nodes (↔): Drag corner anchor vertices horizontally in (X, Z) to reshape walls and joint angles.
 */
export class WallCornerVertexGizmo extends THREE.Group {
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
        this._capturedPointerId = null;
        
        this.handles = new THREE.Group();
        this.handles.name = 'WallCornerVertex_Handles';
        this.add(this.handles);
        
        // Materials (Sims 4 Radiant Emerald, Amber, Cyan Neon & Gold Styling)
        this.matDefault = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false, transparent: true, opacity: 0.95 });
        this.matHeight = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.matSlope = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 });
        this.matHover = new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false, transparent: true, opacity: 1.0 });
        this.matActive = new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false, transparent: true, opacity: 1.0 });

        this._createLiveBadge();
        
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        
        const dom = this.ctx.renderer.domElement;
        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
        dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
    }

    _createLiveBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'sims4-edgepoint-badge';
        this.domBadge.style.cssText = `
            position: absolute;
            display: none;
            transform: translate(-50%, -100%);
            padding: 4px 10px;
            border-radius: 12px;
            background: rgba(15, 23, 42, 0.94);
            border: 2px solid #38bdf8;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6), 0 0 12px rgba(56, 189, 248, 0.5);
            color: #ffffff;
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 800;
            white-space: nowrap;
            pointer-events: none;
            z-index: 10000;
            user-select: none;
        `;
        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domBadge);
    }

    updateMouse(e) {
        const dom = this.ctx.renderer.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    attach(object) {
        if (!object) return;
        this.target = object;
        this.visible = true;
        this.isDragging = false;
        this.activeHandle = null;
        this.updateHandles();
    }

    detach() {
        this.target = null;
        this.visible = false;
        this.isDragging = false;
        this.activeHandle = null;
        while (this.handles.children.length > 0) {
            const c = this.handles.children[0];
            this.handles.remove(c);
            if (c.geometry) c.geometry.dispose();
        }
        if (this.domBadge) this.domBadge.style.display = 'none';
    }

    _getWallEntity() {
        if (!this.target) return null;
        if (this.target.userData?.entity) return this.target.userData.entity;
        if (this.target.userData?.isWallSide || this.target.userData?.isWall) return this.target.userData.entity;
        if (this.target.parent?.userData?.entity) return this.target.parent.userData.entity;
        return null;
    }

    updateHandles() {
        while (this.handles.children.length > 0) {
            const c = this.handles.children[0];
            this.handles.remove(c);
            if (c.geometry) c.geometry.dispose();
        }

        const wall = this._getWallEntity();
        if (!wall) return;

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
        const wallBaseY = (wall.elevation || 0);
        const wallH = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));
        const startH = (wall.startHeight !== undefined ? wall.startHeight : wallH);
        const endH = (wall.endHeight !== undefined ? wall.endHeight : wallH);
        const maxH = Math.max(startH, endH, wallH);

        const midX = (p1.x + p2.x) / 2;
        const midZ = (p1.y + p2.y) / 2;

        // 1. Bottom Corner Nodes (Planar X, Z movement)
        this._createCornerNode('start_pos', p1.x, wallBaseY, p1.y, wall.startAnchor, 0x38bdf8);
        this._createCornerNode('end_pos', p2.x, wallBaseY, p2.y, wall.endAnchor, 0x38bdf8);

        // 2. Top Corner Nodes (Planar X, Z movement at top)
        this._createCornerNode('start_top_pos', p1.x, wallBaseY + startH, p1.y, wall.startAnchor, 0x00f0ff);
        this._createCornerNode('end_top_pos', p2.x, wallBaseY + endH, p2.y, wall.endAnchor, 0x00f0ff);

        // 3. Top Corner Vertical Height/Slope Arrows (Panel #2 ↑ / ↓)
        this._createVerticalArrow('start_slope_height', p1.x, wallBaseY + startH + 6, p1.y, 0xf59e0b);
        this._createVerticalArrow('end_slope_height', p2.x, wallBaseY + endH + 6, p2.y, 0xf59e0b);

        // 4. Center Top Edge Lift Bar (↕ overall height)
        this._createTopEdgeBar('top_edge_height', midX, wallBaseY + maxH + 6, midZ, 0x10b981);

        // 5. Wall Normal Move Handles (Previous Push/Pull logic: Move entire wall along normal vector)
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const t = (wall.thickness !== undefined ? wall.thickness : 20);
        if (len > 0) {
            const normX = -dy / len;
            const normZ = dx / len;
            const frontOffset = t / 2 + 10;
            this._createWallMoveHandle('front', midX + normX * frontOffset, wallBaseY + maxH / 2, midZ + normZ * frontOffset, 0x00f0ff);
            this._createWallMoveHandle('back', midX - normX * frontOffset, wallBaseY + maxH / 2, midZ - normZ * frontOffset, 0x38bdf8);
        }
    }

    _createWallMoveHandle(side, x, y, z, color = 0x00f0ff) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isWallCornerHandle: true, handleType: 'wall_normal_move', side, isWallMove: true };
        group.renderOrder = 1005;

        // Generous invisible hit collider
        const hitGeo = new THREE.CylinderGeometry(20, 20, 24, 16);
        hitGeo.rotateX(Math.PI / 2);
        const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.userData = { isWallCornerHandle: true, handleType: 'wall_normal_move', side, isWallMove: true };
        group.add(hitMesh);

        // Center radiant disc
        const discGeo = new THREE.CylinderGeometry(11, 11, 4, 20);
        discGeo.rotateX(Math.PI / 2);
        const discMesh = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }));
        discMesh.userData = { isWallCornerHandle: true, handleType: 'wall_normal_move', side, isWallMove: true };
        discMesh.renderOrder = 1005;
        group.add(discMesh);

        // Accent ring
        const ringGeo = new THREE.TorusGeometry(7, 1.4, 8, 20);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        ringMesh.renderOrder = 1006;
        group.add(ringMesh);

        // Dual Directional Move Arrows (Out & In)
        const wall = this._getWallEntity();
        if (wall) {
            const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
            const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            group.rotation.y = -angle + (side === 'back' ? Math.PI : 0);
        }

        const arrowGeo = new THREE.ConeGeometry(7, 16, 16);
        arrowGeo.rotateX(Math.PI / 2);
        const arrowMesh = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color, depthTest: false }));
        arrowMesh.position.set(0, 0, 12);
        arrowMesh.userData = { isWallCornerHandle: true, handleType: 'wall_normal_move', side, isWallMove: true };
        arrowMesh.renderOrder = 1005;
        group.add(arrowMesh);

        this.handles.add(group);
    }

    _createCornerNode(type, x, y, z, anchor, color = 0x38bdf8) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isWallCornerHandle: true, handleType: type, anchor: anchor, isPlanar: true };
        group.renderOrder = 1001;

        // Invisible generous hit collider
        const hitGeo = new THREE.SphereGeometry(7, 12, 12);
        const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.userData = { isWallCornerHandle: true, handleType: type, anchor: anchor, isPlanar: true };
        group.add(hitMesh);

        // Outer Diamond / Octahedron
        const geo = new THREE.OctahedronGeometry(4.5);
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
        mesh.userData = { isWallCornerHandle: true, handleType: type, anchor: anchor, isPlanar: true };
        mesh.renderOrder = 1001;
        group.add(mesh);

        // Center ring accent
        const ringGeo = new THREE.TorusGeometry(3.5, 0.8, 8, 16);
        ringGeo.rotateX(Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        ringMesh.renderOrder = 1002;
        group.add(ringMesh);

        this.handles.add(group);
    }

    _createVerticalArrow(type, x, y, z, color = 0xf59e0b) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isWallCornerHandle: true, handleType: type, isVertical: true };
        group.renderOrder = 1003;

        // Invisible hit collider
        const hitGeo = new THREE.CylinderGeometry(8, 8, 24, 12);
        const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.userData = { isWallCornerHandle: true, handleType: type, isVertical: true };
        group.add(hitMesh);

        // Arrow Cone pointing UP
        const coneGeo = new THREE.ConeGeometry(4.5, 12, 16);
        const coneMesh = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
        coneMesh.position.set(0, 6, 0);
        coneMesh.userData = { isWallCornerHandle: true, handleType: type, isVertical: true };
        coneMesh.renderOrder = 1003;
        group.add(coneMesh);

        // Arrow Shaft
        const stemGeo = new THREE.CylinderGeometry(1.4, 1.4, 10, 12);
        const stemMesh = new THREE.Mesh(stemGeo, new THREE.MeshBasicMaterial({ color, depthTest: false }));
        stemMesh.position.set(0, -1, 0);
        stemMesh.userData = { isWallCornerHandle: true, handleType: type, isVertical: true };
        stemMesh.renderOrder = 1003;
        group.add(stemMesh);

        this.handles.add(group);
    }

    _createTopEdgeBar(type, x, y, z, color = 0x10b981) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData = { isWallCornerHandle: true, handleType: type, isTopEdge: true };
        group.renderOrder = 1004;

        // Invisible hit collider
        const hitGeo = new THREE.BoxGeometry(20, 18, 16);
        const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.userData = { isWallCornerHandle: true, handleType: type, isTopEdge: true };
        group.add(hitMesh);

        // Center pill grip
        const pillGeo = new THREE.CylinderGeometry(3.5, 3.5, 14, 16);
        pillGeo.rotateZ(Math.PI / 2);
        const pillMesh = new THREE.Mesh(pillGeo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
        pillMesh.userData = { isWallCornerHandle: true, handleType: type, isTopEdge: true };
        pillMesh.renderOrder = 1004;
        group.add(pillMesh);

        // Up arrow cone
        const upConeGeo = new THREE.ConeGeometry(3.5, 8, 12);
        const upCone = new THREE.Mesh(upConeGeo, new THREE.MeshBasicMaterial({ color, depthTest: false }));
        upCone.position.set(0, 7, 0);
        upCone.userData = { isWallCornerHandle: true, handleType: type, isTopEdge: true };
        upCone.renderOrder = 1004;
        group.add(upCone);

        this.handles.add(group);
    }

    _onPointerDown(e) {
        if (!this.visible) return;
        if (e.button !== 0) return;

        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        
        const meshes = [];
        this.handles.traverse(c => {
            if (c.isMesh && c.userData.isWallCornerHandle) meshes.push(c);
        });

        const intersects = this.raycaster.intersectObjects(meshes, false);
        if (intersects.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            const hitMesh = intersects[0].object;
            this.activeHandle = hitMesh.userData;

            const wall = this._getWallEntity();
            if (!wall) return;

            const wallH = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));
            this.initialH = wallH;
            this.initialStartH = (wall.startHeight !== undefined ? wall.startHeight : wallH);
            this.initialEndH = (wall.endHeight !== undefined ? wall.endHeight : wallH);

            const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX || 0, y: wall.startY || 0 });
            const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX || 0, y: wall.endY || 0 });
            this.initialStartPos = { x: p1.x, y: p1.y };
            this.initialEndPos = { x: p2.x, y: p2.y };

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);

            if (this.activeHandle.handleType === 'wall_normal_move' && len > 0) {
                this.wallNormal2D = { x: -dy / len, y: dx / len };
                if (this.activeHandle.side === 'back') {
                    this.wallNormal2D.x *= -1;
                    this.wallNormal2D.y *= -1;
                }
                const hitPoint = intersects[0].point;
                this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hitPoint);
            } else if (this.activeHandle.isVertical || this.activeHandle.isTopEdge) {
                // Vertical drag plane facing the camera
                const camDir = new THREE.Vector3();
                this.ctx.camera.getWorldDirection(camDir);
                this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(camDir.x, 0, camDir.z).normalize(), intersects[0].point);
            } else {
                // Horizontal planar drag plane at wall base elevation
                const wallElev = (wall.elevation || 0);
                this.dragPlane.set(new THREE.Vector3(0, 1, 0), -wallElev);
            }
            
            const hitPoint = intersects[0].point;
            this.dragStartPoint.copy(hitPoint);

            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
            if (planner && planner.commandManager) {
                this._snapshotCmd = new SnapshotCommand(planner);
            }

            this.isDragging = true;
            this._capturedPointerId = e.pointerId;
            if (e.target && typeof e.target.setPointerCapture === 'function') {
                try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
            }
            if (this.ctx.controls) this.ctx.controls.enabled = false;
        }
    }

    _onPointerMove(e) {
        if (!this.visible) return;
        this.updateMouse(e);

        if (this.isDragging && this.activeHandle) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const currentPoint = new THREE.Vector3();

            if (this.raycaster.ray.intersectPlane(this.dragPlane, currentPoint)) {
                const wall = this._getWallEntity();
                if (!wall) return;

                const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;

                if (this.activeHandle.handleType === 'wall_normal_move') {
                    // --- PREVIOUS PUSH / PULL LOGIC: MOVE WALL ALONG NORMAL VECTOR ---
                    const deltaWorldX = currentPoint.x - this.dragStartPoint.x;
                    const deltaWorldZ = currentPoint.z - this.dragStartPoint.z;
                    const dist = Math.round((deltaWorldX * this.wallNormal2D.x) + (deltaWorldZ * this.wallNormal2D.y));

                    const newP1 = {
                        x: Math.round(this.initialStartPos.x + this.wallNormal2D.x * dist),
                        y: Math.round(this.initialStartPos.y + this.wallNormal2D.y * dist)
                    };
                    const newP2 = {
                        x: Math.round(this.initialEndPos.x + this.wallNormal2D.x * dist),
                        y: Math.round(this.initialEndPos.y + this.wallNormal2D.y * dist)
                    };

                    wall.startX = newP1.x;
                    wall.startY = newP1.y;
                    wall.endX = newP2.x;
                    wall.endY = newP2.y;

                    WallEngine.setEndpoints(wall, newP1, newP2, false, planner);

                    if (planner) {
                        if (typeof planner.syncAll === 'function') planner.syncAll();
                        if (typeof planner.findRooms === 'function') {
                            try { planner.findRooms(); } catch(err) {}
                        }
                    }

                    if (planner && planner.walls) {
                        const attachedWalls = planner.walls.filter(w => 
                            w === wall || 
                            (w.startAnchor && (w.startAnchor === wall.startAnchor || w.startAnchor === wall.endAnchor)) ||
                            (w.endAnchor && (w.endAnchor === wall.startAnchor || w.endAnchor === wall.endAnchor))
                        );
                        attachedWalls.forEach(w => {
                            if (typeof this.ctx.updateWallGeometryLive === 'function') {
                                try { this.ctx.updateWallGeometryLive(w); } catch(err) {}
                            }
                        });
                    }

                    if (typeof this.ctx.rebuildActiveFloors === 'function') {
                        try { this.ctx.rebuildActiveFloors(); } catch(err) {}
                    }

                    if (this.domBadge) {
                        this._updateBadgeText(`🏠 Move Wall: ${dist >= 0 ? '+' : ''}${dist} cm`);
                    }
                } else if (this.activeHandle.isVertical || this.activeHandle.isTopEdge) {
                    // --- VERTICAL HEIGHT & SLOPE DRAG (Panel #2 Vertical Arrows & Top Edge) ---
                    const deltaY = currentPoint.y - this.dragStartPoint.y;
                    const step = 5; // 5cm CAD step

                    if (this.activeHandle.handleType === 'top_edge_height') {
                        // Dragging top edge: Uniform overall height
                        const newH = Math.max(20, Math.round((this.initialH + deltaY) / step) * step);
                        WallEngine.setHeight(wall, newH, false, planner);
                        if (wall.startHeight !== undefined) wall.startHeight = newH;
                        if (wall.endHeight !== undefined) wall.endHeight = newH;

                        if (this.domBadge) {
                            this._updateBadgeText(`📐 Wall Height: ${newH} cm (${deltaY >= 0 ? '+' : ''}${Math.round(deltaY)} cm)`);
                        }
                    } else if (this.activeHandle.handleType === 'start_slope_height') {
                        // Dragging start corner top vertex: Adjust startHeight
                        const newStartH = Math.max(10, Math.round((this.initialStartH + deltaY) / step) * step);
                        WallEngine.setTopProfile(wall, 'single', {
                            startHeight: newStartH,
                            endHeight: wall.endHeight !== undefined ? wall.endHeight : this.initialH
                        }, false, planner);

                        if (this.domBadge) {
                            this._updateBadgeText(`📐 Start Height: ${newStartH} cm (${deltaY >= 0 ? '+' : ''}${Math.round(deltaY)} cm)`);
                        }
                    } else if (this.activeHandle.handleType === 'end_slope_height') {
                        // Dragging end corner top vertex: Adjust endHeight
                        const newEndH = Math.max(10, Math.round((this.initialEndH + deltaY) / step) * step);
                        WallEngine.setTopProfile(wall, 'single', {
                            startHeight: wall.startHeight !== undefined ? wall.startHeight : this.initialH,
                            endHeight: newEndH
                        }, false, planner);

                        if (this.domBadge) {
                            this._updateBadgeText(`📐 End Height: ${newEndH} cm (${deltaY >= 0 ? '+' : ''}${Math.round(deltaY)} cm)`);
                        }
                    }

                    if (planner && typeof planner.syncAll === 'function') planner.syncAll();
                    if (typeof this.ctx.updateWallGeometryLive === 'function') {
                        try { this.ctx.updateWallGeometryLive(wall); } catch(err) {}
                    }
                } else {
                    // --- HORIZONTAL CORNER POSITION DRAG (Panel #2 & #9 Corner / Edge Reshape) ---
                    const snap = 2.5; // 2.5cm CAD snap
                    const newX = Math.round(currentPoint.x / snap) * snap;
                    const newY = Math.round(currentPoint.z / snap) * snap; // 3D Z maps to 2D Y

                    const anchor = this.activeHandle.anchor;
                    const isStart = this.activeHandle.handleType.startsWith('start');

                    if (anchor) {
                        WallEngine.moveAnchor(anchor, { x: newX, y: newY }, planner, false);
                    } else {
                        if (isStart) {
                            wall.startX = newX;
                            wall.startY = newY;
                        } else {
                            wall.endX = newX;
                            wall.endY = newY;
                        }
                    }

                    if (planner && typeof planner.syncAll === 'function') planner.syncAll();

                    // Live rebuild connected walls
                    if (planner && planner.walls) {
                        const attachedWalls = planner.walls.filter(w => 
                            w === wall || 
                            w.startAnchor === anchor || 
                            w.endAnchor === anchor
                        );
                        attachedWalls.forEach(w => {
                            if (typeof this.ctx.updateWallGeometryLive === 'function') {
                                try { this.ctx.updateWallGeometryLive(w); } catch(err) {}
                            }
                        });
                    }

                    if (this.domBadge) {
                        this._updateBadgeText(`📍 Corner (${isStart ? 'Start' : 'End'}): X: ${Math.round(newX)}, Y: ${Math.round(newY)}`);
                    }
                }

                this.updateHandles();

                if (this.ctx.requestRender) {
                    this.ctx.requestRender('wall_edge_point_drag', 2);
                }

                coreEventBus.emit(EVENTS.WALL_CHANGE, { entity: wall });
            }
        } else {
            // Hover highlight
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const meshes = [];
            this.handles.traverse(c => {
                if (c.isMesh && c.userData.isWallCornerHandle) meshes.push(c);
            });

            const intersects = this.raycaster.intersectObjects(meshes, false);
            if (intersects.length > 0) {
                this.ctx.renderer.domElement.style.cursor = 'grab';
            } else {
                this.ctx.renderer.domElement.style.cursor = 'auto';
            }
        }
    }

    _updateBadgeText(text) {
        if (!this.domBadge) return;
        const dom = this.ctx.renderer.domElement;
        const rect = dom.getBoundingClientRect();
        const screenX = ((this.mouse.x + 1) * rect.width) / 2;
        const screenY = ((-this.mouse.y + 1) * rect.height) / 2;
        this.domBadge.textContent = text;
        this.domBadge.style.left = `${screenX}px`;
        this.domBadge.style.top = `${screenY - 24}px`;
        this.domBadge.style.display = 'block';
    }

    _onPointerUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.activeHandle = null;

            if (this.domBadge) this.domBadge.style.display = 'none';

            if (this._capturedPointerId !== null && e.target && typeof e.target.releasePointerCapture === 'function') {
                try { e.target.releasePointerCapture(this._capturedPointerId); } catch(err) {}
                this._capturedPointerId = null;
            }

            if (this.ctx.controls) this.ctx.controls.enabled = true;
            this.ctx.renderer.domElement.style.cursor = 'auto';

            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
            if (planner) {
                if (typeof planner.syncAll === 'function') planner.syncAll();
                if (planner.commandManager && this._snapshotCmd) {
                    planner.commandManager.execute(this._snapshotCmd);
                    this._snapshotCmd = null;
                }
            }

            const wall = this._getWallEntity();
            if (wall) {
                coreEventBus.emit(EVENTS.WALL_CHANGE, { entity: wall });
            }

            this.updateHandles();
            if (this.ctx.requestRender) this.ctx.requestRender();
        }
    }

    dispose() {
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (this.domBadge && this.domBadge.parentElement) {
            this.domBadge.parentElement.removeChild(this.domBadge);
        }
        this.detach();
    }
}

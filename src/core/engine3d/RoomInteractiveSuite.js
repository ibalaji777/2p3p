import * as THREE from 'three';
import { EVENTS } from '../constants/events.js';
import { coreEventBus } from '../EventBus.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { WallEngine } from '../wall/WallEngine.js';
import { getRoomWallsAndSides, getRoomForWallFace, getRoomsList } from './WallPaintSystem.js';
import { PremiumPlatform } from '../engine2d/PremiumPlatform.js';
import { Platform3DBuilder } from './Platform3DBuilder.js';

/**
 * RoomInteractiveSuite
 * 
 * Central coordinator managing Sims 4-style 3D room interactions & building rise:
 * 1. 3D In-Scene Room Lift Gizmo (Suspended mid-air in the room volume like in Sims 4):
 *    - Vertical Up Arrow Cone: Drag to lift room platform elevation
 *    - Vertical Down Arrow Cone: Drag to lower room platform elevation
 *    - Angled 45° Diagonal Cone: Drag to adjust room wall height
 *    - Center Cube Block: Drag to translate the entire room across the grid
 * 2. 3D Room Perimeter Cage / Glowing Highlight:
 *    - Radiant white/cyan double outline framing the top and bottom contour of the room
 * 3. 3D Wall Push/Pull Outward Arrows:
 *    - Horizontal cylindrical stems with cone arrowheads extending from each wall
 * 4. Floating Speech-Bubble HUD (Sims 4 Top Menu):
 *    - ⬇ / ⬆ Platform elevation step (-15cm / +15cm)
 *    - ↺ / ↻ 90° Rotation (CCW / CW)
 *    - ✥ Move room
 *    - ❐ Duplicate room
 *    - 🗑️ Delete room
 *    - Short (240) / Medium (300) / Tall (360) wall height toggles
 * 5. Building Rise Mode (All Walls at Same Time):
 *    - Batch height & foundation elevation controls for all building walls simultaneously
 */
export class RoomInteractiveSuite extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'RoomInteractiveSuite';

        this.target = null; // Floor THREE.Mesh
        this.room = null;   // Canonical room entity
        this.isBuildingRiseMode = false;
        this.scopeMode = 'room'; // 'room' | 'building'
        this.targetAdjustMode = 'wall'; // 'wall' | 'foundation' | 'platform'
        this.downX = 0;
        this.downY = 0;
        this.dragDistance = 0;

        // 1. Central Room Lift Handle Group (Sims 4 Style)
        this.liftHandleGroup = new THREE.Group();
        this.liftHandleGroup.name = 'Room_LiftHandleGroup';
        this.liftHandleGroup.visible = false;
        this.add(this.liftHandleGroup);

        // 2. Room 3D Highlight Cage (Perimeter outline)
        this.roomCage = new THREE.Group();
        this.roomCage.name = 'Room_HighlightCage';
        this.roomCage.visible = false;
        this.add(this.roomCage);

        // 3. Room Edge Push/Pull Arrows Group
        this.edgeArrowsGroup = new THREE.Group();
        this.edgeArrowsGroup.name = 'Room_EdgeArrowsGroup';
        this.edgeArrowsGroup.visible = false;
        this.add(this.edgeArrowsGroup);

        // Create 3D Gizmo Meshes
        this._create3DLiftGizmo();

        // Create Floating HTML HUDs & Tooltip
        this._createLiveTooltip();
        this._createRoomDOMHUD();
        this._createBuildingRiseHUD();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Dragging states
        this.activeDragMode = null; // 'lift_up' | 'lift_down' | 'wall_height' | 'room_move' | 'edge_pushpull'
        this.dragStartY = 0;
        this.dragStartX = 0;
        this.initialElev = 0;
        this.initialWallHeight = 300;
        this.initialRoomCenter = { x: 0, y: 0 };
        this._snapshotCmd = null;

        // Edge push-pull state
        this.activeEdge = null;
        this.dragPlane = new THREE.Plane();
        this.dragStartPoint = new THREE.Vector3();

        this._bindEvents();
    }

    _bindEvents() {
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onCameraChange = this._onCameraChange.bind(this);
        this._onKeyDown = (e) => {
            if ((this.visible || this.isBuildingRiseMode) && (e.key === 'Enter' || e.key === 'Escape')) {
                this.finishAndExit();
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', this._onKeyDown);
        }

        if (this.ctx.controls) {
            this.ctx.controls.addEventListener('change', this._onCameraChange);
        }

        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
            dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
            dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
        }
    }

    get planner() {
        return this.ctx.planner 
            || this.ctx.engine3d?.planner 
            || this.ctx.interactions?.planner 
            || (this.ctx.appState && this.ctx.appState.planner)
            || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null)
            || this.room?.planner;
    }

    /**
     * Changes active target adjustment mode ('wall' | 'foundation' | 'platform').
     */
    setTargetAdjustMode(mode) {
        if (mode !== 'wall' && mode !== 'foundation' && mode !== 'platform') return;
        this.targetAdjustMode = mode;
        this._updateHUDControls();
        this._setGizmoPartHighlight(null);
        if (this.ctx.requestRender) this.ctx.requestRender('target_mode_changed');
    }

    /**
     * Steps the active target parameter upwards.
     */
    stepTargetUp() {
        if (this.targetAdjustMode === 'wall') {
            this.stepWallHeight(10);
        } else if (this.targetAdjustMode === 'foundation') {
            this.stepElevation(15);
        } else if (this.targetAdjustMode === 'platform') {
            this.stepRoomPlatform(15);
        }
    }

    /**
     * Steps the active target parameter downwards.
     */
    stepTargetDown() {
        if (this.targetAdjustMode === 'wall') {
            this.stepWallHeight(-10);
        } else if (this.targetAdjustMode === 'foundation') {
            this.stepElevation(-15);
        } else if (this.targetAdjustMode === 'platform') {
            this.stepRoomPlatform(-15);
        }
    }

    /**
     * Constructs the Sims 4-style 3D Room Lift Gizmo.
     * Streamlined vertical handle with Top Up arrow and Bottom Down arrow.
     */
    _create3DLiftGizmo() {
        while (this.liftHandleGroup.children.length > 0) {
            const c = this.liftHandleGroup.children[0];
            this.liftHandleGroup.remove(c);
            if (c.geometry) c.geometry.dispose();
        }

        // Authentic Sims 4 pearl-white / brushed chrome base material
        this.matBase = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            metalness: 0.35,
            roughness: 0.22,
            depthTest: false,
            depthWrite: false
        });

        // Dynamic Mode Highlight Materials
        this.matHighlight = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.45,
            metalness: 0.3,
            roughness: 0.2,
            depthTest: false,
            depthWrite: false
        });
        this.matHighlightWall = this.matHighlight;
        this.matHighlightFoundation = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            emissive: 0x059669,
            emissiveIntensity: 0.5,
            metalness: 0.3,
            roughness: 0.2,
            depthTest: false,
            depthWrite: false
        });
        this.matHighlightPlatform = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            emissive: 0xd97706,
            emissiveIntensity: 0.5,
            metalness: 0.3,
            roughness: 0.2,
            depthTest: false,
            depthWrite: false
        });

        // 1. Central Column Stem (Centered around y = 0)
        const stemGeo = new THREE.CylinderGeometry(3.5, 3.5, 68, 24);
        this.stemMesh = new THREE.Mesh(stemGeo, this.matBase);
        this.stemMesh.renderOrder = 3010;
        this.stemMesh.userData = { isRoomLiftHandle: true, part: 'stem' };
        this.liftHandleGroup.add(this.stemMesh);

        // 2. Top Flange Collar Disk & Cone Arrow (UP)
        const topCollarGeo = new THREE.CylinderGeometry(13, 13, 2.8, 24);
        this.topCollarMesh = new THREE.Mesh(topCollarGeo, this.matBase);
        this.topCollarMesh.position.y = 33;
        this.topCollarMesh.renderOrder = 3012;
        this.topCollarMesh.userData = { isRoomLiftHandle: true, part: 'up' };
        this.liftHandleGroup.add(this.topCollarMesh);

        const topConeGeo = new THREE.ConeGeometry(11, 22, 24);
        this.topConeMesh = new THREE.Mesh(topConeGeo, this.matBase);
        this.topConeMesh.position.y = 46.5;
        this.topConeMesh.renderOrder = 3013;
        this.topConeMesh.userData = { isRoomLiftHandle: true, part: 'up' };
        this.liftHandleGroup.add(this.topConeMesh);

        // 3. Bottom Flange Collar Disk & Cone Arrow (DOWN)
        const btmCollarGeo = new THREE.CylinderGeometry(13, 13, 2.8, 24);
        this.btmCollarMesh = new THREE.Mesh(btmCollarGeo, this.matBase);
        this.btmCollarMesh.position.y = -33;
        this.btmCollarMesh.renderOrder = 3012;
        this.btmCollarMesh.userData = { isRoomLiftHandle: true, part: 'down' };
        this.liftHandleGroup.add(this.btmCollarMesh);

        const btmConeGeo = new THREE.ConeGeometry(11, 22, 24);
        btmConeGeo.rotateX(Math.PI);
        this.btmConeMesh = new THREE.Mesh(btmConeGeo, this.matBase);
        this.btmConeMesh.position.y = -46.5;
        this.btmConeMesh.renderOrder = 3013;
        this.btmConeMesh.userData = { isRoomLiftHandle: true, part: 'down' };
        this.liftHandleGroup.add(this.btmConeMesh);

        // 4. Raycastable Invisible Colliders
        const matCollider = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false
        });

        // Hitbox Up (generous cylinder covering top collar + cone)
        const hitUp = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 42, 16), matCollider);
        hitUp.position.y = 43;
        hitUp.userData = { isRoomLiftHandle: true, part: 'up' };
        this.liftHandleGroup.add(hitUp);

        // Hitbox Down (generous cylinder covering bottom collar + cone)
        const hitDown = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 42, 16), matCollider);
        hitDown.position.y = -43;
        hitDown.userData = { isRoomLiftHandle: true, part: 'down' };
        this.liftHandleGroup.add(hitDown);
    }

    /**
     * Toggles hover highlight materials on gizmo parts.
     */
    _setGizmoPartHighlight(part) {
        if (!this.topConeMesh || !this.matBase) return;

        let activeHighlight = this.matHighlightWall;
        if (this.targetAdjustMode === 'foundation') {
            activeHighlight = this.matHighlightFoundation;
        } else if (this.targetAdjustMode === 'platform') {
            activeHighlight = this.matHighlightPlatform;
        }

        // Up arrow & collar
        const isUp = (part === 'up');
        if (this.topConeMesh) this.topConeMesh.material = isUp ? activeHighlight : this.matBase;
        if (this.topCollarMesh) this.topCollarMesh.material = isUp ? activeHighlight : this.matBase;

        // Down arrow & collar
        const isDown = (part === 'down');
        if (this.btmConeMesh) this.btmConeMesh.material = isDown ? activeHighlight : this.matBase;
        if (this.btmCollarMesh) this.btmCollarMesh.material = isDown ? activeHighlight : this.matBase;

        if (this.ctx.requestRender) this.ctx.requestRender('gizmo_hover');
    }

    /**
     * Builds the 3D glowing selection cage around the room boundaries.
     * Solid crisp white double-rail framing matching Sims 4 (media_1789179003661.png).
     */
    _updateRoomCage() {
        while (this.roomCage.children.length > 0) {
            const c = this.roomCage.children[0];
            this.roomCage.remove(c);
            if (c.geometry) c.geometry.dispose();
        }

        if (!this.room || !this.room.path || this.room.path.length < 3) return;

        const path = this.room.path;
        const isBuilding = (this.scopeMode === 'building');
        const planner = this.planner;
        const bldgWall = isBuilding ? planner?.walls?.find(w => !w.hidden && w.type !== 'railing') : null;
        const elev = isBuilding 
            ? (Number(bldgWall?.elevation) || Number(this.room.elevation) || 0)
            : (Number(this.room.elevation) || 0);
        const wallH = this._getRoomWallHeight();

        const linePoints = [];

        // Bottom Perimeter Loop
        for (let i = 0; i < path.length; i++) {
            const p1 = path[i];
            const p2 = path[(i + 1) % path.length];
            linePoints.push(
                new THREE.Vector3(p1.x, elev + 0.8, p1.y),
                new THREE.Vector3(p2.x, elev + 0.8, p2.y)
            );
        }

        // Top Double Wireframe Loop (Sims 4 Style)
        for (let i = 0; i < path.length; i++) {
            const p1 = path[i];
            const p2 = path[(i + 1) % path.length];
            linePoints.push(
                new THREE.Vector3(p1.x, elev + wallH + 0.8, p1.y),
                new THREE.Vector3(p2.x, elev + wallH + 0.8, p2.y),
                new THREE.Vector3(p1.x, elev + wallH - 5, p1.y),
                new THREE.Vector3(p2.x, elev + wallH - 5, p2.y)
            );
        }

        // Vertical Corner Posts
        for (let i = 0; i < path.length; i++) {
            const p = path[i];
            linePoints.push(
                new THREE.Vector3(p.x, elev + 0.8, p.y),
                new THREE.Vector3(p.x, elev + wallH + 0.8, p.y)
            );
        }

        const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
        const mat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 3,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.95
        });

        const lines = new THREE.LineSegments(geo, mat);
        lines.renderOrder = 3005;
        this.roomCage.add(lines);

        // 2. Semi-transparent luminous cyan glowing floor footprint highlight
        try {
            const shape = new THREE.Shape();
            path.forEach((p, idx) => {
                if (idx === 0) shape.moveTo(p.x, p.y);
                else shape.lineTo(p.x, p.y);
            });
            shape.closePath();

            const floorGeo = new THREE.ShapeGeometry(shape);
            floorGeo.rotateX(Math.PI / 2);

            const floorMat = new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.28,
                depthTest: false,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const floorMesh = new THREE.Mesh(floorGeo, floorMat);
            floorMesh.position.y = elev + 0.4;
            floorMesh.renderOrder = 3004;
            floorMesh.raycast = () => {};
            this.roomCage.add(floorMesh);
        } catch (err) {
            console.warn('[RoomInteractiveSuite] Could not build floor highlight shape:', err);
        }

        // 3. Highlight each boundary wall of the room with glowing 3D top cap outline
        const roomWalls = this._getRoomBoundingWalls();
        const wallOutlinePoints = [];
        roomWalls.forEach(w => {
            const s = typeof w.startAnchor?.position === 'function' ? w.startAnchor.position() : (w.startAnchor || { x: w.startX, y: w.startY });
            const e = typeof w.endAnchor?.position === 'function' ? w.endAnchor.position() : (w.endAnchor || { x: w.endX, y: w.endY });
            if (!s || !e) return;
            const dx = e.x - s.x;
            const dy = e.y - s.y;
            const len = Math.hypot(dx, dy);
            if (len < 1) return;
            const nx = -dy / len;
            const ny = dx / len;
            const halfT = (Number(w.thickness) || 20) / 2;
            const wH = Number(w.height) || wallH;
            const wElev = Number(w.elevation) || elev;

            const p1L = { x: s.x + nx * halfT, y: s.y + ny * halfT };
            const p1R = { x: s.x - nx * halfT, y: s.y - ny * halfT };
            const p2L = { x: e.x + nx * halfT, y: e.y + ny * halfT };
            const p2R = { x: e.x - nx * halfT, y: e.y - ny * halfT };

            // Wall Top Cap Outline (Glowing Cyan)
            wallOutlinePoints.push(
                new THREE.Vector3(p1L.x, wElev + wH + 0.9, p1L.y), new THREE.Vector3(p2L.x, wElev + wH + 0.9, p2L.y),
                new THREE.Vector3(p2L.x, wElev + wH + 0.9, p2L.y), new THREE.Vector3(p2R.x, wElev + wH + 0.9, p2R.y),
                new THREE.Vector3(p2R.x, wElev + wH + 0.9, p2R.y), new THREE.Vector3(p1R.x, wElev + wH + 0.9, p1R.y),
                new THREE.Vector3(p1R.x, wElev + wH + 0.9, p1R.y), new THREE.Vector3(p1L.x, wElev + wH + 0.9, p1L.y)
            );
        });

        if (wallOutlinePoints.length > 0) {
            const wallGeo = new THREE.BufferGeometry().setFromPoints(wallOutlinePoints);
            const wallMat = new THREE.LineBasicMaterial({
                color: 0x00f0ff,
                linewidth: 3,
                depthTest: false,
                depthWrite: false,
                transparent: true,
                opacity: 0.95
            });
            const wallLines = new THREE.LineSegments(wallGeo, wallMat);
            wallLines.renderOrder = 3006;
            this.roomCage.add(wallLines);
        }

        this.roomCage.visible = true;
    }

    /**
     * Builds outward horizontal push/pull arrows along each wall bounding the room.
     * Matches the white cylindrical arm and cone arrowhead in the screenshot.
     */
    _updateEdgeArrows() {
        while (this.edgeArrowsGroup.children.length > 0) {
            const c = this.edgeArrowsGroup.children[0];
            this.edgeArrowsGroup.remove(c);
            if (c.geometry) c.geometry.dispose();
        }

        if (!this.room || !this.room.path || this.room.path.length < 3) return;

        const path = this.room.path;
        const isBuilding = (this.scopeMode === 'building');
        const planner = this.planner;
        const bldgWall = isBuilding ? planner?.walls?.find(w => !w.hidden && w.type !== 'railing') : null;
        const elev = isBuilding 
            ? (Number(bldgWall?.elevation) || Number(this.room.elevation) || 0)
            : (Number(this.room.elevation) || 0);
        const wallH = this._getRoomWallHeight();
        const arrowY = elev + wallH * 0.72; // Near top of wall, like screenshot

        const matCollider = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false
        });

        for (let i = 0; i < path.length; i++) {
            const p1 = path[i];
            const p2 = path[(i + 1) % path.length];

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);
            if (len < 10) continue;

            const midX = (p1.x + p2.x) / 2;
            const midZ = (p1.y + p2.y) / 2;

            // Compute outward normal relative to room interior
            let nx = -dy / len;
            let nz = dx / len;

            const testPt = { x: midX + nx * 5, y: midZ + nz * 5 };
            if (this._isPointInPolygon(testPt, path)) {
                nx = -nx;
                nz = -nz;
            }

            const arrowGroup = new THREE.Group();
            arrowGroup.position.set(midX, arrowY, midZ);

            const angle = Math.atan2(nx, nz);
            arrowGroup.rotation.y = angle;

            // 1. Horizontal Stem projecting outward (+Z local)
            const stalkGeo = new THREE.CylinderGeometry(2.8, 2.8, 28, 16);
            stalkGeo.rotateX(Math.PI / 2);
            const stalk = new THREE.Mesh(stalkGeo, this.matBase);
            stalk.position.z = 14;
            stalk.renderOrder = 3014;

            // 2. Sharp 3D Arrowhead Cone
            const coneGeo = new THREE.ConeGeometry(9.0, 18, 16);
            coneGeo.rotateX(Math.PI / 2);
            const cone = new THREE.Mesh(coneGeo, this.matBase);
            cone.position.z = 36;
            cone.renderOrder = 3015;

            // 3. Raycastable Invisible Pick Hitbox (transparent: true, opacity: 0)
            const hit = new THREE.Mesh(new THREE.BoxGeometry(26, 26, 48), matCollider);
            hit.position.z = 25;
            hit.userData = { isRoomEdgeArrow: true, edgeIndex: i, p1, p2, normal: { x: nx, y: nz } };

            arrowGroup.add(stalk, cone, hit);
            arrowGroup.userData = { isRoomEdgeArrow: true, edgeIndex: i, p1, p2, normal: { x: nx, y: nz } };
            this.edgeArrowsGroup.add(arrowGroup);
        }

        this.edgeArrowsGroup.visible = true;
    }

    /**
     * Floating measurement tooltip that follows mouse cursor during drag.
     */
    _createLiveTooltip() {
        if (typeof document === 'undefined') return;
        this.domTooltip = document.createElement('div');
        this.domTooltip.className = 'sims4-room-drag-tooltip';
        this.domTooltip.style.cssText = `
            position: fixed;
            display: none;
            padding: 4px 10px;
            border-radius: 9999px;
            background: rgba(15, 23, 42, 0.95);
            border: 1.5px solid #38bdf8;
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            font-weight: 800;
            white-space: nowrap;
            z-index: 100005;
            pointer-events: none;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            transform: translate(14px, 14px);
        `;
        document.body.appendChild(this.domTooltip);
    }

    _showTooltip(text, x, y) {
        if (!this.domTooltip) return;
        this.domTooltip.textContent = text;
        this.domTooltip.style.left = `${x}px`;
        this.domTooltip.style.top = `${y}px`;
        this.domTooltip.style.display = 'block';
    }

    _hideTooltip() {
        if (this.domTooltip) this.domTooltip.style.display = 'none';
    }

    /**
     * Creates the floating speech-bubble style HUD (Sims 4 style with Scope Switcher & Dedicated Done).
     */
    _createRoomDOMHUD() {
        if (typeof document === 'undefined') return;

        this.domRoomHUD = document.createElement('div');
        this.domRoomHUD.className = 'sims4-room-speech-hud';
        this.domRoomHUD.style.cssText = `
            position: fixed;
            display: none;
            flex-direction: column;
            align-items: center;
            pointer-events: auto;
            transform: translate(-50%, -100%);
            z-index: 100003;
            user-select: none;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            filter: drop-shadow(0 12px 28px rgba(0, 0, 0, 0.75));
        `;

        ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'touchstart', 'touchend'].forEach(evt => {
            this.domRoomHUD.addEventListener(evt, (e) => e.stopPropagation());
        });

        // Card Container (Balanced Compact Dark Theme with glassmorphism)
        const bubble = document.createElement('div');
        bubble.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
            background: rgba(15, 23, 42, 0.94);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            padding: 5px 9px;
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            box-sizing: border-box;
        `;

        // Row 1: Scope Switcher + Action Icons + Done/Close
        const mainRow = document.createElement('div');
        mainRow.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            gap: 5px;
        `;

        // Scope Switcher Container
        const scopeContainer = document.createElement('div');
        scopeContainer.style.cssText = `
            display: flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 9999px;
            padding: 1.5px;
            gap: 1.5px;
            flex-shrink: 0;
        `;

        this.btnScopeRoom = document.createElement('button');
        this.btnScopeRoom.innerHTML = `🏠`;
        this.btnScopeRoom.title = 'Edit Selected Room';
        this.btnScopeRoom.style.cssText = `
            border: none;
            border-radius: 9999px;
            width: 24px;
            height: 24px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
            outline: none;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
            white-space: nowrap;
        `;
        this.btnScopeRoom.onclick = (e) => {
            e.stopPropagation();
            this.setScopeMode('room');
        };

        this.btnScopeBuilding = document.createElement('button');
        this.btnScopeBuilding.innerHTML = `🏢`;
        this.btnScopeBuilding.title = 'Edit All Building Walls';
        this.btnScopeBuilding.style.cssText = `
            border: none;
            border-radius: 9999px;
            width: 24px;
            height: 24px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
            outline: none;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
            white-space: nowrap;
        `;
        this.btnScopeBuilding.onclick = (e) => {
            e.stopPropagation();
            this.setScopeMode('building');
        };

        scopeContainer.appendChild(this.btnScopeRoom);
        scopeContainer.appendChild(this.btnScopeBuilding);

        // Room Action Buttons Container
        this.roomActionsContainer = document.createElement('div');
        this.roomActionsContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 3px;
            justify-content: center;
        `;

        // 3-Mode Switcher Container (Wall, Foundation, Platform)
        this.modeSwitcherContainer = document.createElement('div');
        this.modeSwitcherContainer.style.cssText = `
            display: flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 9999px;
            padding: 1.5px;
            gap: 1.5px;
            flex-shrink: 0;
        `;

        this.btnModeWall = document.createElement('button');
        this.btnModeWall.innerHTML = `🧱`;
        this.btnModeWall.title = 'Adjust Wall Height';
        this.btnModeWall.style.cssText = `
            border: none;
            border-radius: 9999px;
            width: 24px;
            height: 24px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
            outline: none;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
            white-space: nowrap;
        `;
        this.btnModeWall.onclick = (e) => {
            e.stopPropagation();
            this.setTargetAdjustMode('wall');
        };

        this.btnModeFoundation = document.createElement('button');
        this.btnModeFoundation.innerHTML = `🏛️`;
        this.btnModeFoundation.title = 'Adjust Foundation Elevation';
        this.btnModeFoundation.style.cssText = `
            border: none;
            border-radius: 9999px;
            width: 24px;
            height: 24px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
            outline: none;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
            white-space: nowrap;
        `;
        this.btnModeFoundation.onclick = (e) => {
            e.stopPropagation();
            this.setTargetAdjustMode('foundation');
        };

        this.btnModePlatform = document.createElement('button');
        this.btnModePlatform.innerHTML = `🪜`;
        this.btnModePlatform.title = 'Adjust Platform Height';
        this.btnModePlatform.style.cssText = `
            border: none;
            border-radius: 9999px;
            width: 24px;
            height: 24px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
            outline: none;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
            white-space: nowrap;
        `;
        this.btnModePlatform.onclick = (e) => {
            e.stopPropagation();
            this.setTargetAdjustMode('platform');
        };

        this.modeSwitcherContainer.appendChild(this.btnModeWall);
        this.modeSwitcherContainer.appendChild(this.btnModeFoundation);
        this.modeSwitcherContainer.appendChild(this.btnModePlatform);

        // Single Up and Down Pair
        this.btnStepDown = document.createElement('button');
        this.btnStepDown.innerHTML = `⬇`;
        this.btnStepDown.title = 'Lower Value';
        this._styleBubbleButton(this.btnStepDown, '#f59e0b');
        this.btnStepDown.onclick = (e) => {
            e.stopPropagation();
            this.stepTargetDown();
        };

        this.btnStepUp = document.createElement('button');
        this.btnStepUp.innerHTML = `⬆`;
        this.btnStepUp.title = 'Raise Value';
        this._styleBubbleButton(this.btnStepUp, '#10b981');
        this.btnStepUp.onclick = (e) => {
            e.stopPropagation();
            this.stepTargetUp();
        };

        const btnRotateCCW = document.createElement('button');
        btnRotateCCW.innerHTML = `↺`;
        btnRotateCCW.title = 'Rotate Counter-Clockwise (90°)';
        this._styleBubbleButton(btnRotateCCW, '#38bdf8');
        btnRotateCCW.onclick = (e) => { e.stopPropagation(); this.rotateRoom(-90); };

        const btnRotateCW = document.createElement('button');
        btnRotateCW.innerHTML = `↻`;
        btnRotateCW.title = 'Rotate Clockwise (90°)';
        this._styleBubbleButton(btnRotateCW, '#38bdf8');
        btnRotateCW.onclick = (e) => { e.stopPropagation(); this.rotateRoom(90); };

        const btnMove = document.createElement('button');
        btnMove.innerHTML = `✥`;
        btnMove.title = 'Move / Translate Room across floor';
        this._styleBubbleButton(btnMove, '#818cf8');
        btnMove.onclick = (e) => {
            e.stopPropagation();
            if (this.ctx.interactions?.universalMoveGizmo && this.target) {
                this.ctx.interactions.universalMoveGizmo.attach(this.target);
            }
        };

        const btnCopy = document.createElement('button');
        btnCopy.innerHTML = `❐`;
        btnCopy.title = 'Duplicate Room Enclosure';
        this._styleBubbleButton(btnCopy, '#a78bfa');
        btnCopy.onclick = (e) => { e.stopPropagation(); this.duplicateRoom(); };

        const btnDelete = document.createElement('button');
        btnDelete.innerHTML = `🗑️`;
        btnDelete.title = 'Delete Room & Walls';
        this._styleBubbleButton(btnDelete, '#ef4444');
        btnDelete.onclick = (e) => { e.stopPropagation(); this.deleteRoom(); };

        this.roomActionsContainer.appendChild(btnRotateCCW);
        this.roomActionsContainer.appendChild(btnRotateCW);
        this.roomActionsContainer.appendChild(btnMove);
        this.roomActionsContainer.appendChild(btnCopy);
        this.roomActionsContainer.appendChild(btnDelete);

        // Building Mode Container (deprecated, modeSwitcher & up/down handles work universally)
        this.buildingActionsContainer = document.createElement('div');
        this.buildingActionsContainer.style.display = 'none';

        // Header Right: Done & Close
        const headerRight = document.createElement('div');
        headerRight.style.cssText = `
            display: flex;
            align-items: center;
            gap: 3px;
            flex-shrink: 0;
        `;

        const btnDone = document.createElement('button');
        btnDone.innerHTML = `✓`;
        btnDone.title = 'Finish & Exit (Enter / Esc)';
        btnDone.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            padding: 0;
            border-radius: 9999px;
            border: 1px solid #10b981;
            background: #10b981;
            color: #ffffff;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.15s ease;
            box-shadow: 0 1px 4px rgba(16, 185, 129, 0.4);
            outline: none;
            line-height: 1;
            white-space: nowrap;
        `;
        btnDone.onmouseenter = () => {
            btnDone.style.transform = 'translateY(-1px) scale(1.08)';
            btnDone.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.6)';
        };
        btnDone.onmouseleave = () => {
            btnDone.style.transform = 'translateY(0) scale(1)';
            btnDone.style.boxShadow = '0 1px 4px rgba(16, 185, 129, 0.4)';
        };
        btnDone.onclick = (e) => {
            e.stopPropagation();
            this.finishAndExit();
        };

        const btnClose = document.createElement('button');
        btnClose.textContent = '✕';
        btnClose.title = 'Close (Esc)';
        btnClose.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 9999px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: rgba(255, 255, 255, 0.08);
            color: #94a3b8;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.15s ease;
            outline: none;
            padding: 0;
            line-height: 1;
            flex-shrink: 0;
        `;
        btnClose.onmouseenter = () => {
            btnClose.style.borderColor = '#ef4444';
            btnClose.style.background = 'rgba(239, 68, 68, 0.2)';
            btnClose.style.color = '#fca5a5';
            btnClose.style.transform = 'scale(1.08)';
        };
        btnClose.onmouseleave = () => {
            btnClose.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            btnClose.style.background = 'rgba(255, 255, 255, 0.08)';
            btnClose.style.color = '#94a3b8';
            btnClose.style.transform = 'scale(1)';
        };
        btnClose.onclick = (e) => {
            e.stopPropagation();
            this.finishAndExit();
        };

        headerRight.appendChild(btnDone);
        headerRight.appendChild(btnClose);

        mainRow.appendChild(scopeContainer);
        mainRow.appendChild(this.modeSwitcherContainer);
        mainRow.appendChild(this.btnStepDown);
        mainRow.appendChild(this.btnStepUp);
        mainRow.appendChild(this.roomActionsContainer);
        mainRow.appendChild(headerRight);

        // Row 2: Live Badge & Wall Height Presets
        const metaRow = document.createElement('div');
        metaRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
            justify-content: space-between;
            padding-top: 3px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
        `;

        this.roomBadge = document.createElement('div');
        this.roomBadge.style.cssText = `
            font-size: 10px;
            font-weight: 700;
            color: #e2e8f0;
            white-space: nowrap;
            line-height: 16px;
        `;
        this.roomBadge.textContent = 'Room: +0cm';

        this.heightPills = document.createElement('div');
        this.heightPills.style.cssText = `
            display: flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 9999px;
            padding: 1.5px;
            gap: 1.5px;
            height: 19px;
        `;

        const heights = [
            { label: '240', val: 240, title: 'Short Wall (240 cm)' },
            { label: '300', val: 300, title: 'Medium Wall (300 cm)' },
            { label: '360', val: 360, title: 'Tall Wall (360 cm)' }
        ];

        const btnMinus = document.createElement('button');
        btnMinus.innerHTML = `▼`;
        btnMinus.title = 'Decrease Wall Height (-10cm)';
        btnMinus.style.cssText = `
            border: none;
            background: transparent;
            color: #94a3b8;
            font-size: 8.5px;
            font-weight: 800;
            padding: 0 3px;
            height: 16px;
            border-radius: 9999px;
            cursor: pointer;
            transition: all 0.12s;
        `;
        btnMinus.onmouseenter = () => { btnMinus.style.color = '#38bdf8'; };
        btnMinus.onmouseleave = () => { btnMinus.style.color = '#94a3b8'; };
        btnMinus.onclick = (e) => {
            e.stopPropagation();
            this.stepWallHeight(-10);
        };
        this.heightPills.appendChild(btnMinus);

        heights.forEach(h => {
            const pill = document.createElement('button');
            pill.textContent = h.label;
            pill.title = h.title;
            pill.dataset.val = String(h.val);
            pill.style.cssText = `
                border: none;
                background: transparent;
                color: #94a3b8;
                font-size: 9.5px;
                font-weight: 700;
                padding: 0 4px;
                height: 16px;
                border-radius: 9999px;
                cursor: pointer;
                transition: all 0.12s;
            `;
            pill.onclick = (e) => {
                e.stopPropagation();
                this.setWallHeight(h.val);
            };
            this.heightPills.appendChild(pill);
        });

        const btnPlus = document.createElement('button');
        btnPlus.innerHTML = `▲`;
        btnPlus.title = 'Increase Wall Height (+10cm)';
        btnPlus.style.cssText = `
            border: none;
            background: transparent;
            color: #94a3b8;
            font-size: 8.5px;
            font-weight: 800;
            padding: 0 3px;
            height: 16px;
            border-radius: 9999px;
            cursor: pointer;
            transition: all 0.12s;
        `;
        btnPlus.onmouseenter = () => { btnPlus.style.color = '#38bdf8'; };
        btnPlus.onmouseleave = () => { btnPlus.style.color = '#94a3b8'; };
        btnPlus.onclick = (e) => {
            e.stopPropagation();
            this.stepWallHeight(10);
        };
        this.heightPills.appendChild(btnPlus);

        metaRow.appendChild(this.roomBadge);
        metaRow.appendChild(this.heightPills);

        bubble.appendChild(mainRow);
        bubble.appendChild(metaRow);

        // Speech bubble triangular tail pointing downward
        const tail = document.createElement('div');
        tail.style.cssText = `
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid rgba(15, 23, 42, 0.94);
            margin-top: -1px;
            filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
        `;

        this.domRoomHUD.appendChild(bubble);
        this.domRoomHUD.appendChild(tail);
        document.body.appendChild(this.domRoomHUD);

        this._updateHUDControls();
    }

    _styleScopeButton(btn, isActive) {
        if (!btn) return;
        if (isActive) {
            btn.style.background = '#0284c7';
            btn.style.color = '#ffffff';
            btn.style.fontWeight = '800';
            btn.style.boxShadow = '0 1px 6px rgba(2, 132, 199, 0.5)';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = '#94a3b8';
            btn.style.fontWeight = '700';
            btn.style.boxShadow = 'none';
        }
    }

    _styleModeButton(btn, isActive, accentColor = '#38bdf8') {
        if (!btn) return;
        if (isActive) {
            btn.style.background = accentColor;
            btn.style.color = '#ffffff';
            btn.style.fontWeight = '800';
            btn.style.boxShadow = `0 1px 6px ${accentColor}80`;
        } else {
            btn.style.background = 'transparent';
            btn.style.color = '#94a3b8';
            btn.style.fontWeight = '700';
            btn.style.boxShadow = 'none';
        }
    }

    _updateHUDControls() {
        if (!this.domRoomHUD) return;
        const isBuilding = (this.scopeMode === 'building');

        // Update Scope Switcher button styles
        if (this.btnScopeRoom && this.btnScopeBuilding) {
            this._styleScopeButton(this.btnScopeRoom, !isBuilding);
            this._styleScopeButton(this.btnScopeBuilding, isBuilding);
        }

        // Update Target Adjust Mode button styles
        if (this.btnModeWall && this.btnModeFoundation && this.btnModePlatform) {
            this._styleModeButton(this.btnModeWall, this.targetAdjustMode === 'wall', '#0284c7');
            this._styleModeButton(this.btnModeFoundation, this.targetAdjustMode === 'foundation', '#059669');
            this._styleModeButton(this.btnModePlatform, this.targetAdjustMode === 'platform', '#d97706');
        }

        // Update single Up/Down step buttons tooltips based on active mode & scope
        if (this.btnStepDown && this.btnStepUp) {
            const scopeLabel = isBuilding ? 'Building' : 'Room';
            if (this.targetAdjustMode === 'wall') {
                this.btnStepDown.title = `Lower ${scopeLabel} Wall Height (-10cm)`;
                this.btnStepUp.title = `Raise ${scopeLabel} Wall Height (+10cm)`;
            } else if (this.targetAdjustMode === 'foundation') {
                this.btnStepDown.title = `Lower ${isBuilding ? 'Building' : 'Room'} Foundation (-15cm)`;
                this.btnStepUp.title = `Lift ${isBuilding ? 'Building' : 'Room'} Foundation (+15cm)`;
            } else if (this.targetAdjustMode === 'platform') {
                this.btnStepDown.title = 'Lower Platform Height (-15cm)';
                this.btnStepUp.title = 'Raise Platform Height (+15cm)';
            }
        }

        // Toggle room-specific transform operations (Rotate, Move, Copy, Delete)
        if (this.roomActionsContainer) {
            this.roomActionsContainer.style.display = isBuilding ? 'none' : 'flex';
        }
        if (this.buildingActionsContainer) {
            this.buildingActionsContainer.style.display = 'none';
        }

        // Update active height pill styling
        const planner = this.planner;
        const curH = isBuilding
            ? (planner?.walls?.find(w => !w.hidden && w.type !== 'railing')?.height || 300)
            : this._getRoomWallHeight();

        if (this.heightPills) {
            Array.from(this.heightPills.children).forEach(pill => {
                if (!pill.dataset?.val) return;
                const val = Number(pill.dataset.val);
                if (val === curH) {
                    pill.style.background = '#0ea5e9';
                    pill.style.color = '#ffffff';
                    pill.style.fontWeight = '800';
                    pill.style.boxShadow = '0 1px 4px rgba(14, 165, 233, 0.4)';
                } else {
                    pill.style.background = 'transparent';
                    pill.style.color = '#94a3b8';
                    pill.style.fontWeight = '700';
                    pill.style.boxShadow = 'none';
                }
            });
        }

        // Update Live Room Info Badge
        if (this.roomBadge) {
            if (isBuilding) {
                const walls = planner?.walls?.filter(w => !w.hidden && w.type !== 'railing') || [];
                const elev = walls.length > 0 ? (Number(walls[0].elevation) || 0) : (Number(this.room?.elevation) || 0);
                this.roomBadge.innerHTML = `Building <span style="color:#10b981;">+${elev}cm</span> • Wall <span style="color:#38bdf8;">${curH}cm</span>`;
            } else if (this.room) {
                const elev = Number(this.room.elevation) || 0;
                const pltH = Number(this.room.platformHeight) || 0;
                const areaM2 = (this._getRoomArea(this.room.path) / 10000).toFixed(1);
                this.roomBadge.innerHTML = `Fnd <span style="color:#10b981;">+${elev}cm</span> • Plt <span style="color:#34d399;">${pltH >= 0 ? '+' : ''}${pltH}cm</span> • Wall <span style="color:#38bdf8;">${curH}cm</span> • <span style="color:#94a3b8;">${areaM2}m²</span>`;
            }
        }
    }

    _styleBubbleButton(btn, accentColor, isWide = false) {
        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 9999px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: rgba(255, 255, 255, 0.07);
            color: #e2e8f0;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.15s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            outline: none;
            padding: 0;
            line-height: 1;
            white-space: nowrap;
        `;
        btn.onmouseenter = () => {
            btn.style.borderColor = accentColor;
            btn.style.color = '#ffffff';
            btn.style.background = 'rgba(255, 255, 255, 0.16)';
            btn.style.transform = 'scale(1.08)';
            btn.style.boxShadow = `0 2px 8px rgba(0,0,0,0.4), 0 0 6px ${accentColor}60`;
        };
        btn.onmouseleave = () => {
            btn.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            btn.style.color = '#e2e8f0';
            btn.style.background = 'rgba(255, 255, 255, 0.07)';
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
        };
    }

    /**
     * Creates the Building Rise HUD (All Walls at Same Time).
     */
    _createBuildingRiseHUD() {
        if (typeof document === 'undefined') return;

        this.domBuildingHUD = document.createElement('div');
        this.domBuildingHUD.className = 'sims4-building-rise-hud';
        this.domBuildingHUD.style.cssText = `
            position: fixed;
            top: 75px;
            left: 50%;
            transform: translateX(-50%);
            display: none;
            align-items: center;
            gap: 8px;
            background: rgba(15, 23, 42, 0.95);
            border: 2px solid #38bdf8;
            border-radius: 9999px;
            padding: 6px 14px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 25px rgba(56, 189, 248, 0.35);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 700;
            z-index: 100003;
            user-select: none;
            pointer-events: auto;
        `;

        const titleTag = document.createElement('div');
        titleTag.style.cssText = `
            display: flex;
            align-items: center;
            gap: 5px;
            color: #38bdf8;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding-right: 6px;
            border-right: 1px solid rgba(255, 255, 255, 0.15);
        `;
        titleTag.innerHTML = `<span>🏢 Building Rise (All Walls)</span>`;

        const hLabel = document.createElement('span');
        hLabel.textContent = 'Height:';
        hLabel.style.cssText = `color: #94a3b8; font-size: 11px;`;

        const btnShort = document.createElement('button');
        btnShort.textContent = 'Short 240';
        this._styleHUDButton(btnShort, '#38bdf8', 'rgba(56, 189, 248, 0.15)');
        btnShort.onclick = () => this.setAllWallsHeight(240);

        const btnMedium = document.createElement('button');
        btnMedium.textContent = 'Medium 300';
        this._styleHUDButton(btnMedium, '#38bdf8', 'rgba(56, 189, 248, 0.15)');
        btnMedium.onclick = () => this.setAllWallsHeight(300);

        const btnTall = document.createElement('button');
        btnTall.textContent = 'Tall 360';
        this._styleHUDButton(btnTall, '#38bdf8', 'rgba(56, 189, 248, 0.15)');
        btnTall.onclick = () => this.setAllWallsHeight(360);

        const btnStepUp = document.createElement('button');
        btnStepUp.innerHTML = `▲ +10`;
        this._styleHUDButton(btnStepUp, '#10b981', 'rgba(16, 185, 129, 0.2)');
        btnStepUp.onclick = () => this.stepAllWallsHeight(10);

        const btnStepDown = document.createElement('button');
        btnStepDown.innerHTML = `▼ -10`;
        this._styleHUDButton(btnStepDown, '#f59e0b', 'rgba(245, 158, 11, 0.2)');
        btnStepDown.onclick = () => this.stepAllWallsHeight(-10);

        const fLabel = document.createElement('span');
        fLabel.textContent = 'Foundation:';
        fLabel.style.cssText = `color: #94a3b8; font-size: 11px; margin-left: 6px; padding-left: 6px; border-left: 1px solid rgba(255, 255, 255, 0.15);`;

        const btnFoundUp = document.createElement('button');
        btnFoundUp.innerHTML = `▲ +15`;
        this._styleHUDButton(btnFoundUp, '#10b981', 'rgba(16, 185, 129, 0.2)');
        btnFoundUp.title = 'Lift Building Foundation (+15cm)';
        btnFoundUp.onclick = () => this.stepAllWallsElevation(15);

        const btnFoundDown = document.createElement('button');
        btnFoundDown.innerHTML = `▼ -15`;
        this._styleHUDButton(btnFoundDown, '#f59e0b', 'rgba(245, 158, 11, 0.2)');
        btnFoundDown.title = 'Lower Building Foundation (-15cm)';
        btnFoundDown.onclick = () => this.stepAllWallsElevation(-15);

        const btnDone = document.createElement('button');
        btnDone.innerHTML = `✓ Done`;
        btnDone.title = 'Finish & Exit Rise Controls (Enter / Esc)';
        this._styleHUDButton(btnDone, '#10b981', '#10b981');
        btnDone.style.fontWeight = '800';
        btnDone.style.padding = '0 14px';
        btnDone.style.boxShadow = '0 2px 10px rgba(16, 185, 129, 0.4)';
        btnDone.onclick = () => {
            this.finishAndExit();
        };

        const btnClose = document.createElement('button');
        btnClose.textContent = '✕';
        btnClose.title = 'Close Building Rise Controls';
        this._styleHUDButton(btnClose, '#ef4444', 'rgba(239, 68, 68, 0.25)');
        btnClose.onclick = () => {
            this.finishAndExit();
        };

        this.domBuildingHUD.appendChild(titleTag);
        this.domBuildingHUD.appendChild(hLabel);
        this.domBuildingHUD.appendChild(btnShort);
        this.domBuildingHUD.appendChild(btnMedium);
        this.domBuildingHUD.appendChild(btnTall);
        this.domBuildingHUD.appendChild(btnStepUp);
        this.domBuildingHUD.appendChild(btnStepDown);
        this.domBuildingHUD.appendChild(fLabel);
        this.domBuildingHUD.appendChild(btnFoundUp);
        this.domBuildingHUD.appendChild(btnFoundDown);
        this.domBuildingHUD.appendChild(btnDone);
        this.domBuildingHUD.appendChild(btnClose);

        document.body.appendChild(this.domBuildingHUD);
    }

    _styleHUDButton(btn, color, bg) {
        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 28px;
            padding: 0 9px;
            border-radius: 9999px;
            border: 1px solid ${color};
            background: ${bg};
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.12s ease;
            outline: none;
            white-space: nowrap;
        `;
        btn.onmouseenter = () => {
            btn.style.transform = 'scale(1.06)';
            btn.style.boxShadow = `0 0 10px ${color}`;
        };
        btn.onmouseleave = () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = 'none';
        };
    }

    /**
     * Attaches to a selected room mesh, room entity, or enclosing wall.
     */
    attach(object) {
        if (!object) return;

        let room = null;
        if (object && Array.isArray(object.path) && object.path.length >= 3) {
            room = object;
        } else if (object?.userData?.entity && Array.isArray(object.userData.entity.path)) {
            room = object.userData.entity;
        } else if (object?.userData?.isFloor && object.userData.entity) {
            room = object.userData.entity;
        } else if (object?.userData?.isWallSide || object?.userData?.isWallMesh || object?.userData?.entity?.type === 'wall' || object?.userData?.entity?.type === 'inner' || object?.userData?.entity?.type === 'outer') {
            const wall = object.userData.parentWall || object.userData.entity;
            const side = object.userData.side || 'front';
            const planner = this.planner;
            room = getRoomForWallFace(wall, side, planner, this.ctx.engine3d || this.ctx);
            if (!room) {
                const allRooms = getRoomsList(planner, this.ctx.engine3d || this.ctx);
                room = allRooms.find(r => r.walls && r.walls.includes(wall));
            }
            if (!room && wall) {
                const allRooms = getRoomsList(planner, this.ctx.engine3d || this.ctx);
                const midX = (wall.startX + wall.endX) / 2;
                const midY = (wall.startY + wall.endY) / 2;
                let bestRoom = null;
                let bestDist = Infinity;
                allRooms.forEach(r => {
                    if (r.path && r.path.length >= 3) {
                        const d = this._getDistancePointToPolygon(midX, midY, r.path);
                        if (d < bestDist && d < 60) {
                            bestDist = d;
                            bestRoom = r;
                        }
                    }
                });
                room = bestRoom;
            }
        }

        if (!room || !Array.isArray(room.path) || room.path.length < 3) {
            if (!this.isBuildingRiseMode) this.detach();
            return;
        }

        // Ensure room center coordinates cx and cy are computed accurately
        if (room.cx === undefined || room.cy === undefined || isNaN(room.cx) || isNaN(room.cy)) {
            let sumX = 0, sumY = 0;
            room.path.forEach(p => { sumX += p.x; sumY += p.y; });
            room.cx = sumX / room.path.length;
            room.cy = sumY / room.path.length;
        }

        // Synchronize room elevation and wall height with bounding walls
        const walls = this._getRoomBoundingWalls(room);
        const wallElev = walls.length > 0 ? (Number(walls[0].elevation) || 0) : 0;
        const rElev = Number(room.elevation) || 0;
        const targetElev = Math.max(wallElev, rElev);
        room.elevation = targetElev;

        const heights = walls.map(w => Number(w.height)).filter(h => !isNaN(h) && h > 0);
        const wallH = room.wallHeight !== undefined 
            ? Number(room.wallHeight) 
            : (heights.length > 0 ? Math.max(...heights) : 300);
        room.wallHeight = wallH;

        const planner = this.planner;
        if (targetElev > 0 && walls.length > 0 && wallElev !== targetElev) {
            if (planner) {
                WallEngine.batchUpdate(planner, walls, { elevation: targetElev });
            } else {
                walls.forEach(w => {
                    w.elevation = targetElev;
                    if (w.mesh3D) w.mesh3D.position.y = targetElev;
                });
            }
        }

        if (walls.length > 0 && walls.some(w => Number(w.height) !== wallH)) {
            if (planner) {
                WallEngine.batchUpdate(planner, walls, { height: wallH }, false);
            } else {
                walls.forEach(w => {
                    w.height = wallH;
                    if (w.config) w.config.height = wallH;
                    if (!w.topProfileType || w.topProfileType === 'normal') {
                        if (w.startHeight !== undefined) w.startHeight = wallH;
                        if (w.endHeight !== undefined) w.endHeight = wallH;
                    }
                });
            }
            this._syncWalls3D(walls);
        }
        if (room.mesh3D) room.mesh3D.position.y = targetElev + 0.05;
        if (object?.isMesh) object.position.y = targetElev + 0.05;

        // Rebind to canonical planner room if available
        if (planner && Array.isArray(planner.rooms)) {
            const canonical = planner.rooms.find(r => r === room)
                || planner.rooms.find(r => Math.hypot((r.cx ?? 0) - (room.cx ?? 0), (r.cy ?? 0) - (room.cy ?? 0)) < 30);
            if (canonical) {
                canonical.elevation = targetElev;
                canonical.wallHeight = wallH;
                room = canonical;
            }
        }

        this.room = room;
        this.target = object?.isMesh ? object : (room.mesh3D || null);

        if (!this.isBuildingRiseMode) {
            this.scopeMode = 'room';
        }

        this.visible = true;
        this.liftHandleGroup.visible = true;
        this.roomCage.visible = true;
        this.edgeArrowsGroup.visible = true;
        if (this.domRoomHUD) this.domRoomHUD.style.display = 'flex';

        this.update();
        if (this.ctx.requestRender) this.ctx.requestRender('room_suite_attached');
    }

    /**
     * Detaches from the active room.
     */
    detach() {
        this.target = null;
        this.room = null;
        this.visible = false;
        this.liftHandleGroup.visible = false;
        this.roomCage.visible = false;
        this.edgeArrowsGroup.visible = false;
        this.activeDragMode = null;
        this._hideTooltip();
        if (this.domRoomHUD) this.domRoomHUD.style.display = 'none';
        if (this.domBuildingHUD) this.domBuildingHUD.style.display = 'none';
    }

    activateBuildingRiseMode() {
        this.isBuildingRiseMode = true;
        this.scopeMode = 'building';
        if (this.domBuildingHUD) this.domBuildingHUD.style.display = 'none';

        // Auto-detect and attach to active room or first room in scene
        const planner = this.planner;
        let rooms = getRoomsList(planner, this.ctx.engine3d || this.ctx);
        if ((!rooms || rooms.length === 0) && planner && typeof planner.detectRooms === 'function') {
            planner.detectRooms();
            rooms = getRoomsList(planner, this.ctx.engine3d || this.ctx);
        }

        const walls = planner?.walls?.filter(w => !w.hidden && w.type !== 'railing')
            || this.ctx?.walls?.filter(w => !w.hidden && w.type !== 'railing')
            || [];
        const existingElev = walls.length > 0 ? (Number(walls[0].elevation) || 0) : 0;

        if (rooms && rooms.length > 0) {
            const selectedEntity = this.ctx.interactions?.selectedObject?.userData?.entity;
            let targetRoom = (selectedEntity && selectedEntity.path) 
                ? selectedEntity 
                : (selectedEntity ? (getRoomForWallFace(selectedEntity, 'front', planner, this.ctx.engine3d || this.ctx) || rooms[0]) : rooms[0]);
            
            if (existingElev > 0) {
                rooms.forEach(r => {
                    r.elevation = existingElev;
                    if (r.mesh3D) r.mesh3D.position.y = existingElev + 0.05;
                });
            }
            targetRoom.elevation = existingElev;
            if (targetRoom.mesh3D) targetRoom.mesh3D.position.y = existingElev + 0.05;
            this.attach(targetRoom);
        } else if (walls.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            walls.forEach(w => {
                const s = typeof w.startAnchor?.position === 'function' ? w.startAnchor.position() : w.startAnchor || { x: w.startX, y: w.startY };
                const e = typeof w.endAnchor?.position === 'function' ? w.endAnchor.position() : w.endAnchor || { x: w.endX, y: w.endY };
                if (s) { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y); }
                if (e) { minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x); minY = Math.min(minY, e.y); maxY = Math.max(maxY, e.y); }
            });
            if (minX !== Infinity) {
                const syntheticRoom = {
                    path: [
                        { x: minX, y: minY },
                        { x: maxX, y: minY },
                        { x: maxX, y: maxY },
                        { x: minX, y: maxY }
                    ],
                    cx: (minX + maxX) / 2,
                    cy: (minY + maxY) / 2,
                    elevation: existingElev
                };
                this.attach(syntheticRoom);
            }
        }

        this._updateHUDControls();
        if (this.ctx.requestRender) this.ctx.requestRender('activate_building_rise');
    }

    deactivateBuildingRiseMode() {
        this.isBuildingRiseMode = false;
        this.scopeMode = 'room';
        if (this.domBuildingHUD) this.domBuildingHUD.style.display = 'none';
        if (!this.room) {
            this.detach();
        } else {
            this._updateHUDControls();
        }
    }

    setScopeMode(mode) {
        this.scopeMode = mode;
        this.isBuildingRiseMode = (mode === 'building');
        const planner = this.planner;
        const bldgWalls = planner?.walls?.filter(w => !w.hidden && w.type !== 'railing')
            || this.ctx?.walls?.filter(w => !w.hidden && w.type !== 'railing')
            || [];

        if (mode === 'building') {
            const wallElev = bldgWalls.length > 0 ? (Number(bldgWalls[0].elevation) || 0) : 0;
            const rElev = Number(this.room?.elevation) || 0;
            const existingElev = Math.max(wallElev, rElev);
            if (existingElev > 0) {
                if (this.room) {
                    this.room.elevation = existingElev;
                    if (this.room.mesh3D) this.room.mesh3D.position.y = existingElev + 0.05;
                }
                bldgWalls.forEach(w => {
                    w.elevation = existingElev;
                    if (w.mesh3D) w.mesh3D.position.y = existingElev;
                });
                (planner?.rooms || []).forEach(r => {
                    r.elevation = existingElev;
                    if (r.mesh3D) r.mesh3D.position.y = existingElev + 0.05;
                });
            }
        } else {
            // Room mode: synchronize existing elevation & wall height from room/walls
            const roomWalls = this._getRoomBoundingWalls();
            const wallElev = roomWalls.length > 0 ? (Number(roomWalls[0].elevation) || 0) : 0;
            const rElev = Number(this.room?.elevation) || 0;
            const targetElev = Math.max(wallElev, rElev);
            if (this.room) {
                this.room.elevation = targetElev;
                if (this.room.mesh3D) this.room.mesh3D.position.y = targetElev + 0.05;
            }
        }
        this._updateHUDControls();
        this.update();
        if (this.ctx.requestRender) {
            this.ctx.requestRender('room_suite_scope_changed');
        }
    }

    /**
     * Dedicated Done action: cleanly applies all changes, deactivates rise mode,
     * hides in-scene handles, and returns tool to standard selection.
     */
    finishAndExit() {
        this.deactivateBuildingRiseMode();
        this.detach();
        const controller = this.ctx.interactions?.commonController || this.ctx.commonController;
        if (controller && typeof controller.setTool === 'function') {
            controller.setTool('select');
        }
        if (this.ctx.interactions?.deselect) {
            this.ctx.interactions.deselect();
        }
        if (this.ctx.requestRender) {
            this.ctx.requestRender('room_suite_finished');
        }
    }

    /**
     * Projects room top center to screen coordinates for the floating speech bubble HUD.
     */
    updateHUDPosition() {
        if (!this.room || !this.ctx.camera || !this.ctx.renderer || !this.domRoomHUD) return;
        if (!this.visible) {
            this.domRoomHUD.style.display = 'none';
            return;
        }

        const isBuilding = (this.scopeMode === 'building');
        const planner = this.planner;
        const bldgWall = isBuilding ? planner?.walls?.find(w => !w.hidden && w.type !== 'railing') : null;
        const elev = isBuilding 
            ? (Number(bldgWall?.elevation) || Number(this.room.elevation) || 0)
            : (Number(this.room.elevation) || 0);
        const cx = this.room.cx || 0;
        const cy = this.room.cy || 0;
        const wallH = this._getRoomWallHeight();

        const worldPos = new THREE.Vector3(cx, elev + wallH + 16, cy);
        const v = worldPos.clone().project(this.ctx.camera);

        if (v.z > 1) {
            this.domRoomHUD.style.display = 'none';
            return;
        }

        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        const screenX = Math.max(160, Math.min(rect.width - 160, ((v.x + 1) / 2) * rect.width)) + rect.left;
        const screenY = Math.max(70, Math.min(rect.height - 30, ((-v.y + 1) / 2) * rect.height)) + rect.top;

        this.domRoomHUD.style.left = `${screenX}px`;
        this.domRoomHUD.style.top = `${screenY - 10}px`;
        this.domRoomHUD.style.display = 'flex';
    }

    /**
     * Updates 3D handle positions, cages, and floating HUD projection.
     */
    update() {
        if (!this.room || !this.ctx.camera || !this.ctx.renderer) {
            if (this.domRoomHUD) this.domRoomHUD.style.display = 'none';
            return;
        }

        const isBuilding = (this.scopeMode === 'building');
        const planner = this.planner;
        const bldgWall = isBuilding ? planner?.walls?.find(w => !w.hidden && w.type !== 'railing') : null;
        const elev = isBuilding 
            ? (Number(bldgWall?.elevation) || Number(this.room.elevation) || 0)
            : (Number(this.room.elevation) || 0);
        const cx = this.room.cx || 0;
        const cy = this.room.cy || 0;
        const wallH = this._getRoomWallHeight();

        // Position 3D Central Lift Gizmo in mid-air in the center of the room volume
        const centerVolY = elev + wallH * 0.45;
        this.liftHandleGroup.position.set(cx, centerVolY, cy);
        this._updateGizmoFacing();

        // Update 3D Cage and Edge Arrows
        this._updateRoomCage();
        this._updateEdgeArrows();

        // Update Live Controls & Info Badge
        this._updateHUDControls();

        this.updateHUDPosition();
        if (this.ctx.requestRender) this.ctx.requestRender('room_suite_update');
    }

    _onCameraChange() {
        if (this.room && this.visible) {
            this._updateGizmoFacing();
            this.updateHUDPosition();
        }
    }

    _updateGizmoFacing() {
        if (this.ctx.camera && this.liftHandleGroup) {
            const camPos = this.ctx.camera.position;
            const pos = this.liftHandleGroup.position;
            const angleY = Math.atan2(camPos.x - pos.x, camPos.z - pos.z);
            this.liftHandleGroup.rotation.y = angleY;
        }
    }

    _getPlatformBuilder() {
        if (this.ctx.envBuilder?.platformBuilder) return this.ctx.envBuilder.platformBuilder;
        if (this.ctx.platformBuilder) return this.ctx.platformBuilder;
        if (this.ctx.engine3d?.platformBuilder) return this.ctx.engine3d.platformBuilder;
        if (!this.platformBuilder) {
            try {
                this.platformBuilder = new Platform3DBuilder(this.ctx);
            } catch (err) {
                console.warn('[RoomInteractiveSuite] Could not instantiate Platform3DBuilder:', err);
            }
        }
        return this.platformBuilder;
    }

    /**
     * Automatically creates, updates, or removes foundation platforms
     * underneath rooms or the whole building when raised above ground.
     */
    _syncFoundationPlatforms(newElev) {
        const planner = this.planner;
        if (!planner) return;
        if (!planner.platforms) planner.platforms = [];

        // Determine target rooms or building bounding footprint
        let targetRooms = [];
        if (this.scopeMode === 'building') {
            if (Array.isArray(planner.rooms) && planner.rooms.length > 0) {
                targetRooms = planner.rooms.filter(r => r.path && r.path.length >= 3);
            } else if (this.room && this.room.path && this.room.path.length >= 3) {
                targetRooms = [this.room];
            }
        } else {
            // Room mode
            if (this.room && this.room.path && this.room.path.length >= 3) {
                targetRooms = [this.room];
            } else if (Array.isArray(planner.rooms) && planner.rooms.length > 0) {
                targetRooms = planner.rooms.filter(r => r.path && r.path.length >= 3);
            }
        }

        // Fallback to building bounding box from walls if targetRooms is empty
        if (targetRooms.length === 0) {
            const walls = planner.walls?.filter(w => !w.hidden && w.type !== 'railing') || [];
            if (walls.length > 0) {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                walls.forEach(w => {
                    const s = typeof w.startAnchor?.position === 'function' ? w.startAnchor.position() : w.startAnchor || { x: w.startX, y: w.startY };
                    const e = typeof w.endAnchor?.position === 'function' ? w.endAnchor.position() : w.endAnchor || { x: w.endX, y: w.endY };
                    if (s) { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y); }
                    if (e) { minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x); minY = Math.min(minY, e.y); maxY = Math.max(maxY, e.y); }
                });
                if (minX !== Infinity && maxX > minX && maxY > minY) {
                    targetRooms = [{
                        id: 'bldg_foundation_bounds',
                        path: [
                            { x: minX, y: minY },
                            { x: maxX, y: minY },
                            { x: maxX, y: maxY },
                            { x: minX, y: maxY }
                        ],
                        cx: (minX + maxX) / 2,
                        cy: (minY + maxY) / 2
                    }];
                }
            }
        }

        const builder = this._getPlatformBuilder();
        const targetGroup = this.ctx.structureGroup || this.ctx.scene;

        if (newElev <= 0) {
            // Clean up foundation platforms
            const targetIds = new Set(targetRooms.map(r => r.id || r._id).filter(Boolean));
            const toRemove = planner.platforms.filter(p => p.isBuildingFoundation && (this.scopeMode === 'building' || targetIds.has(p.associatedRoomId)));

            toRemove.forEach(p => {
                const idx = planner.platforms.indexOf(p);
                if (idx !== -1) planner.platforms.splice(idx, 1);
                if (p.mesh3D) {
                    if (p.mesh3D.parent) p.mesh3D.parent.remove(p.mesh3D);
                    p.mesh3D.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                            else child.material.dispose();
                        }
                    });
                    p.mesh3D = null;
                }
                if (typeof p.destroy === 'function') {
                    try { p.destroy(); } catch (err) {}
                }
            });
            return;
        }

        // newElev > 0: create or update foundation platforms
        targetRooms.forEach(r => {
            if (!r.path || r.path.length < 3) return;
            const rId = r.id || r._id || ('room_' + Math.round(r.cx ?? 0) + '_' + Math.round(r.cy ?? 0));
            let platform = planner.platforms.find(p => p.isBuildingFoundation && p.associatedRoomId === rId);

            let cx = 0, cy = 0;
            r.path.forEach(pt => { cx += pt.x; cy += pt.y; });
            cx /= r.path.length;
            cy /= r.path.length;

            if (platform) {
                platform.height = newElev;
                platform.elevation = 0;
                platform.x = cx;
                platform.y = cy;
                platform.points = r.path.map(pt => ({ x: pt.x - cx, y: pt.y - cy }));

                if (builder && targetGroup) {
                    try { builder.buildPlatform(platform, targetGroup); } catch (err) {}
                }
            } else {
                try {
                    const pParams = {
                        shapeType: 'polygon',
                        x: cx,
                        y: cy,
                        points: r.path.map(pt => ({ x: pt.x - cx, y: pt.y - cy })),
                        height: newElev,
                        elevation: 0,
                        trimStyle: 'stone',
                        materials: {
                            top: { id: r.material || r.configId || 'wood_golden_teak' },
                            side: { id: 'stone_ashlar_grey' }
                        }
                    };
                    platform = new PremiumPlatform(planner, 'platform', pParams);
                    platform.associatedRoomId = rId;
                    platform.isBuildingFoundation = true;
                    planner.platforms.push(platform);

                    if (builder && targetGroup) {
                        builder.buildPlatform(platform, targetGroup);
                    }
                } catch (err) {
                    console.warn('[RoomInteractiveSuite] Could not create foundation platform:', err);
                }
            }
        });

        if (this.ctx.requestRender) {
            this.ctx.requestRender('foundation_platforms_synced');
        }
    }

    /**
     * Automatically creates, updates, or removes interior room platforms
     * (Sims 4 split-level stage or sunken conversation pit).
     */
    _syncInteriorPlatforms(pltH = (this.room?.platformHeight || 0)) {
        const planner = this.planner;
        if (!planner || !this.room) return;
        if (!planner.platforms) planner.platforms = [];

        const r = this.room;
        if (!r.path || r.path.length < 3) return;
        const rId = r.id || r._id || ('room_' + Math.round(r.cx ?? 0) + '_' + Math.round(r.cy ?? 0));
        const builder = this._getPlatformBuilder();
        const targetGroup = this.ctx.structureGroup || this.ctx.scene;
        const roomElev = Number(r.elevation) || 0;

        let platform = planner.platforms.find(p => p.isRoomInteriorPlatform && p.associatedRoomId === rId);

        if (pltH === 0) {
            if (platform) {
                const idx = planner.platforms.indexOf(platform);
                if (idx !== -1) planner.platforms.splice(idx, 1);
                if (platform.mesh3D) {
                    if (platform.mesh3D.parent) platform.mesh3D.parent.remove(platform.mesh3D);
                    platform.mesh3D.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                            else child.material.dispose();
                        }
                    });
                    platform.mesh3D = null;
                }
                if (typeof platform.destroy === 'function') {
                    try { platform.destroy(); } catch (err) {}
                }
            }
            if (this.ctx.requestRender) this.ctx.requestRender('interior_platforms_synced');
            return;
        }

        let cx = 0, cy = 0;
        r.path.forEach(pt => { cx += pt.x; cy += pt.y; });
        cx /= r.path.length;
        cy /= r.path.length;

        if (platform) {
            platform.height = pltH;
            platform.elevation = roomElev;
            platform.x = cx;
            platform.y = cy;
            platform.points = r.path.map(pt => ({ x: pt.x - cx, y: pt.y - cy }));

            if (builder && targetGroup) {
                try { builder.buildPlatform(platform, targetGroup); } catch (err) {}
            }
        } else {
            try {
                const pParams = {
                    shapeType: 'polygon',
                    x: cx,
                    y: cy,
                    points: r.path.map(pt => ({ x: pt.x - cx, y: pt.y - cy })),
                    height: pltH,
                    elevation: roomElev,
                    trimStyle: 'wood_bevel',
                    materials: {
                        top: { id: r.material || r.configId || 'wood_golden_teak' },
                        side: { id: 'wood_oak_natural' }
                    }
                };
                platform = new PremiumPlatform(planner, 'platform', pParams);
                platform.associatedRoomId = rId;
                platform.isRoomInteriorPlatform = true;
                planner.platforms.push(platform);

                if (builder && targetGroup) {
                    builder.buildPlatform(platform, targetGroup);
                }
            } catch (err) {
                console.warn('[RoomInteractiveSuite] Could not create interior platform:', err);
            }
        }

        if (this.ctx.requestRender) {
            this.ctx.requestRender('interior_platforms_synced');
        }
    }

    /**
     * Steps the active room interior platform height up or down (15cm increment).
     * Walls and roofs DO NOT move when changing interior platform height!
     */
    stepRoomPlatform(delta = 15) {
        if (!this.room) return;
        const currentPltH = Number(this.room.platformHeight) || 0;
        const newPltH = Math.max(-150, Math.min(300, currentPltH + delta));
        this.setRoomPlatformHeight(newPltH);
    }

    setRoomPlatformHeight(newPltH) {
        if (!this.room) return;
        const planner = this.planner;
        if (planner && planner.commandManager) {
            const cmd = new SnapshotCommand(planner);
            this._applyRoomPlatformInternal(newPltH, planner);
            cmd.finalize();
            planner.commandManager.execute(cmd);
        } else {
            this._applyRoomPlatformInternal(newPltH, planner);
        }
    }

    _applyRoomPlatformLive(newPltH, planner = this.planner) {
        if (!this.room) return;
        this.room.platformHeight = newPltH;
        this._syncInteriorPlatforms(newPltH);
        this._updateHUDControls();
        this.updateHUDPosition();
        if (this.ctx.requestRender) this.ctx.requestRender('room_platform_drag');
    }

    _applyRoomPlatformInternal(newPltH, planner = this.planner) {
        if (!this.room) return;
        this.room.platformHeight = newPltH;
        this._syncInteriorPlatforms(newPltH);
        this.update();
        coreEventBus.emit(EVENTS.WALL_CHANGE, { room: this.room, platformOnly: true });
    }

    /**
     * Steps the active room elevation up or down.
     */
    stepRoomElevation(delta = 15) {
        if (!this.room) return;
        const currentElev = Number(this.room.elevation) || 0;
        const newElev = Math.max(0, Math.min(600, currentElev + delta));
        this.setRoomElevation(newElev);
    }

    setRoomElevation(newElev) {
        if (!this.room) return;
        const planner = this.planner;
        if (planner && planner.commandManager) {
            const cmd = new SnapshotCommand(planner);
            this._applyRoomElevationInternal(newElev, planner);
            cmd.finalize();
            planner.commandManager.execute(cmd);
        } else {
            this._applyRoomElevationInternal(newElev, planner);
        }
    }

    _applyRoomElevationLive(newElev, planner = this.planner) {
        if (!this.room) return;
        this.room.elevation = newElev;
        if (this.room.mesh3D) {
            this.room.mesh3D.position.y = newElev + 0.05;
        }
        if (this.target && this.target.isMesh) {
            this.target.position.y = newElev + 0.05;
        }

        const roomWalls = this._getRoomBoundingWalls();
        if (roomWalls.length > 0) {
            if (planner) {
                WallEngine.batchUpdate(planner, roomWalls, { elevation: newElev }, false);
            }
            roomWalls.forEach(w => {
                w.elevation = newElev;
                if (w.mesh3D) {
                    w.mesh3D.position.y = newElev;
                }
            });
        }

        // Move roof meshes live in 3D
        const engine = this.ctx.engine3d || this.ctx;
        if (engine.structureGroup) {
            const elevDiff = newElev - this.initialElev;
            engine.structureGroup.children.forEach(c => {
                if (c.userData && c.userData.isRoof) {
                    if (c.userData._baseRoofY === undefined) {
                        c.userData._baseRoofY = c.position.y;
                    }
                    c.position.y = c.userData._baseRoofY + elevDiff;
                }
            });
        }

        // Synchronize foundation platforms live under raised room
        this._syncFoundationPlatforms(newElev);
        // Synchronize interior platform elevation with room floor
        this._syncInteriorPlatforms(this.room?.platformHeight || 0);

        // Live in-place update of gizmo and HUD without heavy geometry recreation
        const wallH = this._getRoomWallHeight();
        const centerVolY = newElev + wallH * 0.45;
        this.liftHandleGroup.position.set(this.room.cx, centerVolY, this.room.cy);
        this._updateGizmoFacing();
        this.updateHUDPosition();
        this._updateHUDControls();
        if (this.ctx.requestRender) this.ctx.requestRender('room_lift_drag');
    }

    _applyRoomElevationInternal(newElev, planner = this.planner) {
        if (!this.room) return;
        const prevElev = Number(this.room.elevation) || 0;
        const deltaElev = newElev - prevElev;

        this.room.elevation = newElev;
        if (this.room.mesh3D) {
            this.room.mesh3D.position.y = newElev + 0.05;
        }
        if (this.target && this.target.isMesh) {
            this.target.position.y = newElev + 0.05;
        }

        const roomWalls = this._getRoomBoundingWalls();
        if (roomWalls.length > 0) {
            if (planner) {
                WallEngine.batchUpdate(planner, roomWalls, { elevation: newElev });
            }
            roomWalls.forEach(w => {
                w.elevation = newElev;
                if (w.mesh3D) {
                    w.mesh3D.position.y = newElev;
                }
            });
            this._syncWalls3D(roomWalls);
        }

        // Update roofs in planner to follow raised room
        const allRoofs = planner.roofs || this.ctx.engine3d?.roofs || [];
        allRoofs.forEach(rf => {
            if (rf.elevation !== undefined && deltaElev !== 0) {
                rf.elevation = Math.max(0, (Number(rf.elevation) || 0) + deltaElev);
            }
        });
        this._syncRoofs();

        if (typeof this.ctx.rebuildActiveFloors === 'function') {
            try { this.ctx.rebuildActiveFloors(); } catch (err) {}
        } else if (typeof this.ctx.buildActiveFloor === 'function') {
            try { this.ctx.buildActiveFloor(); } catch (err) {}
        }

        // Synchronize foundation platforms under raised room
        this._syncFoundationPlatforms(newElev);
        // Synchronize interior platform elevation with room floor
        this._syncInteriorPlatforms(this.room?.platformHeight || 0);

        this.update();
        coreEventBus.emit(EVENTS.WALL_CHANGE, { room: this.room });
    }

    setRoomWallHeight(height) {
        if (!this.room) return;
        const planner = this.planner;
        const roomWalls = this._getRoomBoundingWalls();
        this.room.wallHeight = height;

        if (roomWalls.length > 0) {
            if (planner && planner.commandManager) {
                const cmd = new SnapshotCommand(planner);
                WallEngine.batchUpdate(planner, roomWalls, { height });
                cmd.finalize();
                planner.commandManager.execute(cmd);
            } else if (planner) {
                WallEngine.batchUpdate(planner, roomWalls, { height });
            }

            roomWalls.forEach(w => {
                w.height = height;
                if (w.config) w.config.height = height;
                if (!w.topProfileType || w.topProfileType === 'normal') {
                    if (w.startHeight !== undefined) w.startHeight = height;
                    if (w.endHeight !== undefined) w.endHeight = height;
                }
            });
            this._syncWalls3D(roomWalls);
            this._syncRoofs();
        }

        // Rebind room to canonical room in planner.rooms if needed
        if (planner && Array.isArray(planner.rooms)) {
            const canonical = planner.rooms.find(r => r === this.room)
                || (this.room && planner.rooms.find(r => Math.hypot((r.cx ?? 0) - (this.room.cx ?? 0), (r.cy ?? 0) - (this.room.cy ?? 0)) < 30));
            if (canonical) {
                canonical.wallHeight = height;
                this.room = canonical;
            }
        }

        this.update();
        coreEventBus.emit(EVENTS.WALL_CHANGE, { room: this.room });
    }

    rotateRoom(degrees = 90) {
        if (!this.room || !this.room.path) return;
        const planner = this.planner;
        const rad = (degrees * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const cx = this.room.cx || 0;
        const cy = this.room.cy || 0;

        const roomWalls = this._getRoomBoundingWalls();
        if (roomWalls.length === 0 || !planner) return;

        if (planner.commandManager) {
            const cmd = new SnapshotCommand(planner);
            const anchorSet = new Set();
            roomWalls.forEach(w => {
                if (w.startAnchor) anchorSet.add(w.startAnchor);
                if (w.endAnchor) anchorSet.add(w.endAnchor);
            });

            anchorSet.forEach(a => {
                const pos = typeof a.position === 'function' ? a.position() : a;
                const rx = cx + (pos.x - cx) * cos - (pos.y - cy) * sin;
                const ry = cy + (pos.x - cx) * sin + (pos.y - cy) * cos;
                WallEngine.moveAnchor(a, { x: rx, y: ry }, planner, false);
            });

            planner.syncAll();
            if (planner.update3D) planner.update3D();
            cmd.finalize();
            planner.commandManager.execute(cmd);
        }

        this.update();
    }

    duplicateRoom() {
        if (!this.room || !this.room.path) return;
        const planner = this.planner;
        if (!planner) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.room.path.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });
        const width = maxX - minX;
        const offset = width + 50;

        const cmd = planner.commandManager ? new SnapshotCommand(planner) : null;
        const wallH = this._getRoomWallHeight();
        const elev = Number(this.room.elevation) || 0;

        WallEngine.createRoomBox(planner, {
            minX: minX + offset,
            minY: minY,
            maxX: maxX + offset,
            maxY: maxY,
            thickness: 20,
            height: wallH,
            elevation: elev
        });

        if (planner.detectRooms) planner.detectRooms();
        if (planner.syncAll) planner.syncAll();
        if (planner.update3D) planner.update3D();
        if (cmd) {
            cmd.finalize();
            planner.commandManager.execute(cmd);
        }
    }

    deleteRoom() {
        if (!this.room) return;
        const planner = this.planner;
        if (!planner) return;

        const roomWalls = this._getRoomBoundingWalls();
        if (roomWalls.length === 0) return;

        const cmd = planner.commandManager ? new SnapshotCommand(planner) : null;
        this.detach();

        roomWalls.forEach(w => {
            WallEngine.deleteWall(planner, w);
        });

        if (planner.detectRooms) planner.detectRooms();
        if (planner.syncAll) planner.syncAll();
        if (planner.update3D) planner.update3D();
        if (cmd) {
            cmd.finalize();
            planner.commandManager.execute(cmd);
        }
    }

    // ==========================================
    // BUILDING RISE ACTIONS (ALL WALLS AT ONCE)
    // ==========================================

    setAllWallsHeight(height) {
        const planner = this.planner;
        if (!planner || !planner.walls || planner.walls.length === 0) return;

        const targetWalls = planner.walls.filter(w => !w.hidden && w.type !== 'railing');
        if (targetWalls.length === 0) return;

        if (this.room) {
            this.room.wallHeight = height;
        }

        if (planner.commandManager) {
            const cmd = new SnapshotCommand(planner);
            WallEngine.batchUpdate(planner, targetWalls, { height });
            cmd.finalize();
            planner.commandManager.execute(cmd);
        } else {
            WallEngine.batchUpdate(planner, targetWalls, { height });
        }

        targetWalls.forEach(w => {
            w.height = height;
            if (w.config) w.config.height = height;
            if (!w.topProfileType || w.topProfileType === 'normal') {
                if (w.startHeight !== undefined) w.startHeight = height;
                if (w.endHeight !== undefined) w.endHeight = height;
            }
        });

        // Synchronize all planner rooms
        (planner.rooms || []).forEach(r => {
            r.wallHeight = height;
        });

        this._syncWalls3D(targetWalls);
        this._syncRoofs();

        if (planner && Array.isArray(planner.rooms)) {
            const canonical = planner.rooms.find(r => r === this.room)
                || (this.room && planner.rooms.find(r => Math.hypot((r.cx ?? 0) - (this.room.cx ?? 0), (r.cy ?? 0) - (this.room.cy ?? 0)) < 30));
            if (canonical) {
                canonical.wallHeight = height;
                this.room = canonical;
            }
        }

        this.update();
        coreEventBus.emit(EVENTS.WALL_CHANGE, { building: true });
    }

    stepAllWallsHeight(delta = 10) {
        const planner = this.planner;
        if (!planner || !planner.walls) return;
        const firstWall = planner.walls.find(w => !w.hidden && w.type !== 'railing');
        const curH = firstWall ? (firstWall.height !== undefined ? firstWall.height : 300) : 300;
        const newH = Math.max(40, Math.min(600, curH + delta));
        this.setAllWallsHeight(newH);
    }

    stepRoomWallHeight(delta = 10) {
        const curH = this._getRoomWallHeight();
        const newH = Math.max(40, Math.min(600, curH + delta));
        this.setRoomWallHeight(newH);
    }

    stepWallHeight(delta = 10) {
        if (this.scopeMode === 'building') {
            this.stepAllWallsHeight(delta);
        } else {
            this.stepRoomWallHeight(delta);
        }
    }

    setAllWallsElevation(newElev) {
        const planner = this.planner;
        if (!planner || !planner.walls) return;
        const targetWalls = planner.walls.filter(w => !w.hidden && w.type !== 'railing');
        if (targetWalls.length === 0) return;

        const prevElev = Number(targetWalls[0].elevation) || 0;
        const deltaElev = newElev - prevElev;

        if (planner.commandManager) {
            const cmd = new SnapshotCommand(planner);
            WallEngine.batchUpdate(planner, targetWalls, { elevation: newElev });
            cmd.finalize();
            planner.commandManager.execute(cmd);
        } else {
            WallEngine.batchUpdate(planner, targetWalls, { elevation: newElev });
        }

        targetWalls.forEach(w => {
            w.elevation = newElev;
            if (w.mesh3D) w.mesh3D.position.y = newElev;
        });
        this._syncWalls3D(targetWalls);

        // Update all rooms in planner
        (planner.rooms || []).forEach(r => {
            r.elevation = newElev;
            if (r.mesh3D) r.mesh3D.position.y = newElev + 0.05;
        });
        if (this.room) {
            this.room.elevation = newElev;
            if (this.room.mesh3D) this.room.mesh3D.position.y = newElev + 0.05;
        }

        // Directly move interactable floor meshes in 3D (skip platform meshes as they anchor at ground)
        if (this.ctx.interactables) {
            this.ctx.interactables.forEach(m => {
                if (m.userData && m.userData.isFloor && !m.userData.isOutdoorZone && !m.userData.isPlatform) {
                    m.position.y = newElev + 0.05;
                }
            });
        }

        // Update roofs in planner to follow raised walls
        const allRoofs = planner.roofs || this.ctx.engine3d?.roofs || [];
        allRoofs.forEach(rf => {
            if (rf.elevation !== undefined && deltaElev !== 0) {
                rf.elevation = Math.max(0, (Number(rf.elevation) || 0) + deltaElev);
            }
        });
        this._syncRoofs();

        // Rebuild active floors so meshes stay fully synchronized
        if (typeof this.ctx.rebuildActiveFloors === 'function') {
            try { this.ctx.rebuildActiveFloors(); } catch(err) {}
        } else if (typeof this.ctx.engine3d?.rebuildActiveFloors === 'function') {
            try { this.ctx.engine3d.rebuildActiveFloors(); } catch(err) {}
        }

        // Synchronize foundation platforms under raised building
        this._syncFoundationPlatforms(newElev);

        // Synchronize interior platform elevation under raised rooms
        (planner.rooms || []).forEach(r => {
            if (r.platformHeight) {
                const rId = r.id || r._id || ('room_' + Math.round(r.cx ?? 0) + '_' + Math.round(r.cy ?? 0));
                const p = (planner.platforms || []).find(plt => plt.isRoomInteriorPlatform && plt.associatedRoomId === rId);
                if (p) {
                    p.elevation = newElev;
                    const builder = this._getPlatformBuilder();
                    const targetGroup = this.ctx.structureGroup || this.ctx.scene;
                    if (builder && targetGroup) {
                        try { builder.buildPlatform(p, targetGroup); } catch (err) {}
                    }
                }
            }
        });

        this.update();
        coreEventBus.emit(EVENTS.WALL_CHANGE, { building: true });
    }

    stepAllWallsElevation(delta = 15) {
        const planner = this.planner;
        if (!planner || !planner.walls) return;
        const targetWalls = planner.walls.filter(w => !w.hidden && w.type !== 'railing');
        if (targetWalls.length === 0) return;

        const curElev = Number(targetWalls[0].elevation) || 0;
        const newElev = Math.max(0, Math.min(600, curElev + delta));
        this.setAllWallsElevation(newElev);
    }

    stepElevation(delta = 15) {
        if (this.scopeMode === 'building') {
            this.stepAllWallsElevation(delta);
        } else {
            this.stepRoomElevation(delta);
        }
    }

    _applyBuildingElevationLive(newElev, planner = this.planner) {
        if (!planner) return;
        const targetWalls = planner.walls?.filter(w => !w.hidden && w.type !== 'railing') || [];
        if (targetWalls.length > 0) {
            WallEngine.batchUpdate(planner, targetWalls, { elevation: newElev }, false);
            targetWalls.forEach(w => {
                w.elevation = newElev;
                if (w.mesh3D) w.mesh3D.position.y = newElev;
            });
        }

        // Update all rooms in planner
        (planner.rooms || []).forEach(r => {
            r.elevation = newElev;
            if (r.mesh3D) r.mesh3D.position.y = newElev + 0.05;
        });
        if (this.room) {
            this.room.elevation = newElev;
            if (this.room.mesh3D) this.room.mesh3D.position.y = newElev + 0.05;
        }

        // Directly move any interactable floor meshes in 3D
        if (this.ctx.interactables) {
            this.ctx.interactables.forEach(m => {
                if (m.userData && m.userData.isFloor && !m.userData.isOutdoorZone && !m.userData.isPlatform) {
                    m.position.y = newElev + 0.05;
                }
            });
        }

        // Move roof meshes live in 3D
        const engine = this.ctx.engine3d || this.ctx;
        if (engine.structureGroup) {
            const elevDiff = newElev - this.initialElev;
            engine.structureGroup.children.forEach(c => {
                if (c.userData && c.userData.isRoof) {
                    if (c.userData._baseRoofY === undefined) {
                        c.userData._baseRoofY = c.position.y;
                    }
                    c.position.y = c.userData._baseRoofY + elevDiff;
                }
            });
        }

        // Synchronize foundation platforms live
        this._syncFoundationPlatforms(newElev);

        // Synchronize interior platform elevation live under raised rooms
        (planner.rooms || []).forEach(r => {
            if (r.platformHeight) {
                const rId = r.id || r._id || ('room_' + Math.round(r.cx ?? 0) + '_' + Math.round(r.cy ?? 0));
                const p = (planner.platforms || []).find(plt => plt.isRoomInteriorPlatform && plt.associatedRoomId === rId);
                if (p) {
                    p.elevation = newElev;
                    const builder = this._getPlatformBuilder();
                    const targetGroup = this.ctx.structureGroup || this.ctx.scene;
                    if (builder && targetGroup) {
                        try { builder.buildPlatform(p, targetGroup); } catch (err) {}
                    }
                }
            }
        });

        const wallH = this._getRoomWallHeight();
        const centerVolY = newElev + wallH * 0.45;
        if (this.room) {
            this.liftHandleGroup.position.set(this.room.cx, centerVolY, this.room.cy);
        }
        this._updateGizmoFacing();
        this.updateHUDPosition();
        this._updateHUDControls();
        if (this.ctx.requestRender) this.ctx.requestRender('building_elevation_drag');
    }

    setWallHeight(height) {
        if (this.scopeMode === 'building') {
            this.setAllWallsHeight(height);
        } else {
            this.setRoomWallHeight(height);
        }
    }

    cycleWallHeight() {
        const isBuilding = (this.scopeMode === 'building');
        const planner = this.planner;
        const curH = isBuilding
            ? (planner?.walls?.find(w => !w.hidden && w.type !== 'railing')?.height || 300)
            : this._getRoomWallHeight();

        let nextH = 300;
        if (curH < 270) {
            nextH = 300;
        } else if (curH < 330) {
            nextH = 360;
        } else {
            nextH = 240;
        }
        this.setWallHeight(nextH);
    }

    // ==========================================
    // POINTER & DRAGGING HANDLERS
    // ==========================================

    _onPointerDown(e) {
        if (!this.visible && !this.isBuildingRiseMode) return;
        if (e.button !== 0) return;

        const dom = this.ctx.renderer?.domElement;
        if (!dom || !this.ctx.camera) return;

        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        // 1. Hit-test Room Lift Center Gizmo
        if (this.room && this.liftHandleGroup.visible) {
            const liftHits = this.raycaster.intersectObjects(this.liftHandleGroup.children, true);
            if (liftHits.length > 0) {
                let chosenHit = liftHits[0];
                const specificHit = liftHits.find(h => {
                    let obj = h.object;
                    while (obj && !obj.userData?.part) obj = obj.parent;
                    const p = obj?.userData?.part;
                    return p === 'up' || p === 'down';
                });
                if (specificHit) chosenHit = specificHit;

                let hitObj = chosenHit.object;
                while (hitObj && !hitObj.userData?.part) {
                    hitObj = hitObj.parent;
                }
                const part = hitObj?.userData?.part || 'up';

                e.stopPropagation();
                e.preventDefault();
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();

                const isBuilding = (this.scopeMode === 'building');
                const planner = this.planner;
                const bldgWall = isBuilding ? planner?.walls?.find(w => !w.hidden && w.type !== 'railing') : null;

                const roomWalls = this._getRoomBoundingWalls();
                const roomWallElev = roomWalls.length > 0 ? (Number(roomWalls[0].elevation) || 0) : 0;
                const roomElev = Number(this.room?.elevation) || 0;

                this.activeDragMode = part;
                this.dragStartY = e.clientY;
                this.dragStartX = e.clientX;
                this.downX = e.clientX;
                this.downY = e.clientY;
                this.dragDistance = 0;
                this.initialElev = isBuilding
                    ? Math.max(Number(bldgWall?.elevation) || 0, roomElev)
                    : Math.max(roomWallElev, roomElev);
                this.initialWallHeight = this._getRoomWallHeight();
                this.initialPlatformHeight = Number(this.room?.platformHeight) || 0;
                this._lastLiveWallHeight = null;
                this.initialRoomCenter = { x: this.room.cx || 0, y: this.room.cy || 0 };

                if (planner && planner.commandManager) {
                    this._snapshotCmd = new SnapshotCommand(planner);
                }

                if (dom.setPointerCapture) {
                    try { dom.setPointerCapture(e.pointerId); } catch(err) {}
                }
                if (this.ctx.controls) this.ctx.controls.enabled = false;
                return;
            }
        }

        // 2. Hit-test Room Edge Push/Pull Arrows
        if (this.room && this.edgeArrowsGroup.visible) {
            const arrowHits = this.raycaster.intersectObjects(this.edgeArrowsGroup.children, true);
            if (arrowHits.length > 0) {
                let hitObj = arrowHits[0].object;
                while (hitObj && !hitObj.userData?.isRoomEdgeArrow) {
                    hitObj = hitObj.parent;
                }
                if (hitObj && hitObj.userData?.isRoomEdgeArrow) {
                    e.stopPropagation();
                    e.preventDefault();
                    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

                    this.activeDragMode = 'edge_pushpull';
                    this.activeEdge = hitObj.userData;
                    this.dragStartPoint.copy(arrowHits[0].point);
                    this.dragStartY = e.clientY;
                    this.dragStartX = e.clientX;
                    this.downX = e.clientX;
                    this.downY = e.clientY;
                    this.dragDistance = 0;

                    const n = this.activeEdge.normal;
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(n.x, 0, n.y).normalize(), arrowHits[0].point);

                    const planner = this.planner;
                    if (planner && planner.commandManager) {
                        this._snapshotCmd = new SnapshotCommand(planner);
                    }

                    if (dom.setPointerCapture) {
                        try { dom.setPointerCapture(e.pointerId); } catch(err) {}
                    }
                    if (this.ctx.controls) this.ctx.controls.enabled = false;
                    return;
                }
            }
        }
    }

    _onPointerMove(e) {
        if (!this.room) return;

        if (this.activeDragMode) {
            this.dragDistance = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
            if (this.dragDistance < 6) {
                return; // Suppress continuous drag modifications during subtle clicks
            }
        }

        // 1. Dragging: Up / Down Cones -> Adjust based on targetAdjustMode
        if (this.activeDragMode === 'up' || this.activeDragMode === 'down') {
            if (e.stopPropagation) e.stopPropagation();
            if (e.preventDefault) e.preventDefault();

            const deltaPixelsY = this.dragStartY - e.clientY;

            if (this.targetAdjustMode === 'wall') {
                const deltaCm = deltaPixelsY * 0.6;
                const newWallH = Math.max(80, Math.min(600, Math.round((this.initialWallHeight + deltaCm) / 10) * 10));

                if (this.scopeMode === 'building') {
                    if (newWallH !== this._lastLiveWallHeight) {
                        this._lastLiveWallHeight = newWallH;
                        if (this.room) this.room.wallHeight = newWallH;
                        const planner = this.planner;
                        const targetWalls = planner?.walls?.filter(w => !w.hidden && w.type !== 'railing') || [];
                        if (targetWalls.length > 0) {
                            WallEngine.batchUpdate(planner, targetWalls, { height: newWallH }, false);
                            this._syncWalls3D(targetWalls);
                        }
                        (planner?.rooms || []).forEach(r => { r.wallHeight = newWallH; });
                        this._updateGizmoLive(newWallH);
                    }
                    this._showTooltip(`Building Wall Height: ${newWallH} cm`, e.clientX, e.clientY);
                } else {
                    if (newWallH !== this._lastLiveWallHeight) {
                        this._lastLiveWallHeight = newWallH;
                        if (this.room) this.room.wallHeight = newWallH;
                        const roomWalls = this._getRoomBoundingWalls();
                        const planner = this.planner;
                        if (roomWalls.length > 0) {
                            WallEngine.batchUpdate(planner, roomWalls, { height: newWallH }, false);
                            this._syncWalls3D(roomWalls);
                        }
                        this._updateGizmoLive(newWallH);
                    }
                    this._showTooltip(`Room Wall Height: ${newWallH} cm`, e.clientX, e.clientY);
                }
            } else if (this.targetAdjustMode === 'foundation') {
                const deltaCm = deltaPixelsY * 0.6;
                const newElev = Math.max(0, Math.min(600, Math.round((this.initialElev + deltaCm) / 15) * 15));

                if (this.scopeMode === 'building') {
                    this._applyBuildingElevationLive(newElev);
                    this._showTooltip(`Building Elevation: +${newElev} cm`, e.clientX, e.clientY);
                } else {
                    this._applyRoomElevationLive(newElev);
                    this._showTooltip(`Room Elevation: +${newElev} cm`, e.clientX, e.clientY);
                }
            } else if (this.targetAdjustMode === 'platform') {
                const deltaCm = deltaPixelsY * 0.6;
                const newPltH = Math.max(-150, Math.min(300, Math.round((this.initialPlatformHeight + deltaCm) / 15) * 15));

                this._applyRoomPlatformLive(newPltH);
                this._showTooltip(`Room Platform: ${newPltH >= 0 ? '+' : ''}${newPltH} cm`, e.clientX, e.clientY);
            }
            return;
        }

        // 2. Dragging: Wall Edge Push/Pull Arrows
        if (this.activeDragMode === 'edge_pushpull' && this.activeEdge) {
            e.stopPropagation();
            e.preventDefault();

            const dom = this.ctx.renderer?.domElement;
            if (!dom || !this.ctx.camera) return;
            const rect = dom.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

            const hitPt = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragPlane, hitPt)) {
                const n = this.activeEdge.normal;
                const dotDist = (hitPt.x - this.dragStartPoint.x) * n.x + (hitPt.z - this.dragStartPoint.z) * n.y;
                const stepDist = Math.round(dotDist / 10) * 10;

                if (Math.abs(stepDist) >= 10) {
                    const roomWalls = this._getRoomBoundingWalls();
                    const wall = roomWalls[this.activeEdge.edgeIndex % roomWalls.length];
                    if (wall) {
                        const planner = this.planner;
                        WallEngine.pushPull(wall, 'front', stepDist, { mode: 'baseline' }, planner);
                        this.dragStartPoint.copy(hitPt);
                        this._syncWalls3D([wall]);
                        this.update();
                    }
                }
                this._showTooltip(`Wall Push/Pull: ${stepDist >= 0 ? '+' : ''}${stepDist} cm`, e.clientX, e.clientY);
            }
            return;
        }

        // Hover Highlight
        if (this.liftHandleGroup.visible && this.ctx.camera && this.ctx.renderer) {
            const dom = this.ctx.renderer.domElement;
            const rect = dom.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

            const liftHits = this.raycaster.intersectObjects(this.liftHandleGroup.children, true);
            if (liftHits.length > 0) {
                let chosenHit = liftHits[0];
                const specificHit = liftHits.find(h => {
                    let obj = h.object;
                    while (obj && !obj.userData?.part) obj = obj.parent;
                    const p = obj?.userData?.part;
                    return p === 'up' || p === 'down';
                });
                if (specificHit) chosenHit = specificHit;

                let hitObj = chosenHit.object;
                while (hitObj && !hitObj.userData?.part) hitObj = hitObj.parent;
                const part = hitObj?.userData?.part;

                this._setGizmoPartHighlight(part);

                if (part === 'up' || part === 'down') {
                    dom.style.cursor = 'ns-resize';
                } else {
                    dom.style.cursor = 'auto';
                }
                this.liftHandleGroup.scale.set(1.08, 1.08, 1.08);
            } else {
                this._setGizmoPartHighlight(null);
                const edgeHits = this.raycaster.intersectObjects(this.edgeArrowsGroup.children, true);
                if (edgeHits.length > 0) {
                    dom.style.cursor = 'ew-resize';
                } else {
                    dom.style.cursor = 'auto';
                    this.liftHandleGroup.scale.set(1, 1, 1);
                }
            }
        }
    }

    _onPointerUp(e) {
        if (this.activeDragMode) {
            this._hideTooltip();
            const planner = this.planner;
            const isSingleClick = (this.dragDistance < 6);
            const mode = this.activeDragMode;

            if (isSingleClick) {
                this._snapshotCmd = null; // Single clicks use their own atomic SnapshotCommands
                if (mode === 'up') {
                    this.stepTargetUp();
                } else if (mode === 'down') {
                    this.stepTargetDown();
                }
            } else {
                if (mode === 'up' || mode === 'down') {
                    const deltaPixelsY = this.dragStartY - e.clientY;
                    if (this.targetAdjustMode === 'wall') {
                        const roomWalls = (this.scopeMode === 'building')
                            ? (planner?.walls?.filter(w => !w.hidden && w.type !== 'railing') || [])
                            : this._getRoomBoundingWalls();
                        if (planner && typeof planner.syncAll === 'function') {
                            planner.syncAll();
                        }
                        this._syncWalls3D(roomWalls);
                        this._syncRoofs();
                        coreEventBus.emit(EVENTS.WALL_CHANGE, { room: this.room, building: (this.scopeMode === 'building') });
                    } else if (this.targetAdjustMode === 'foundation') {
                        const deltaCm = deltaPixelsY * 0.6;
                        const newElev = Math.max(0, Math.min(600, Math.round((this.initialElev + deltaCm) / 15) * 15));
                        if (this.scopeMode === 'building') {
                            this.setAllWallsElevation(newElev);
                        } else {
                            this.setRoomElevation(newElev);
                        }
                    } else if (this.targetAdjustMode === 'platform') {
                        const deltaCm = deltaPixelsY * 0.6;
                        const newPltH = Math.max(-150, Math.min(300, Math.round((this.initialPlatformHeight + deltaCm) / 15) * 15));
                        this.setRoomPlatformHeight(newPltH);
                    }
                }

                if (planner && planner.commandManager && this._snapshotCmd) {
                    this._snapshotCmd.finalize();
                    planner.commandManager.execute(this._snapshotCmd);
                    this._snapshotCmd = null;
                }
            }

            // Reset any live roof drag base position
            const engine = this.ctx.engine3d || this.ctx;
            if (engine.structureGroup) {
                engine.structureGroup.children.forEach(c => {
                    if (c.userData && c.userData.isRoof) {
                        delete c.userData._baseRoofY;
                    }
                });
            }

            const dom = this.ctx.renderer?.domElement;
            if (dom && dom.releasePointerCapture) {
                try { dom.releasePointerCapture(e.pointerId); } catch(err) {}
            }
            if (this.ctx.controls) this.ctx.controls.enabled = true;
            this.activeDragMode = null;
            this.activeEdge = null;
            this._lastLiveWallHeight = null;
            this._setGizmoPartHighlight(null);
            this.update();
        }
    }

    // ==========================================
    // UTILITY HELPERS
    // ==========================================

    _updateGizmoLive(newWallH) {
        const isBuilding = (this.scopeMode === 'building');
        const planner = this.planner;
        const bldgWall = isBuilding ? planner?.walls?.find(w => !w.hidden && w.type !== 'railing') : null;
        const elev = isBuilding 
            ? (Number(bldgWall?.elevation) || Number(this.room?.elevation) || 0)
            : (Number(this.room?.elevation) || 0);
        const cx = this.room?.cx || 0;
        const cy = this.room?.cy || 0;

        const centerVolY = elev + newWallH * 0.45;
        this.liftHandleGroup.position.set(cx, centerVolY, cy);
        this._updateGizmoFacing();
        this._updateHUDControls();
        this.updateHUDPosition();
        if (this.ctx.requestRender) this.ctx.requestRender('live_wall_height_drag');
    }

    _syncRoofs() {
        if (this.ctx.envBuilder && typeof this.ctx.envBuilder.buildRoofs === 'function') {
            try {
                const engine = this.ctx.engine3d || this.ctx;
                if (engine.roofs && engine.roofs.length > 0) {
                    const currentRoofMeshes = engine.structureGroup?.children.filter(c => c.userData && c.userData.isRoof) || [];
                    currentRoofMeshes.forEach(m => {
                        if (typeof engine.deepDispose === 'function') engine.deepDispose(m);
                        engine.structureGroup?.remove(m);
                    });
                    this.ctx.envBuilder.buildRoofs(
                        engine.roofs,
                        engine.activeIndex || 0,
                        engine.walls || this.planner?.walls || [],
                        engine.structureGroup,
                        engine.shapes || this.planner?.shapes || []
                    );
                }
            } catch (err) {
                console.error('[RoomInteractiveSuite] Error syncing roofs:', err);
            }
        }
    }

    _syncWalls3D(walls) {
        if (!walls || walls.length === 0) return;
        const engine = this.ctx.engine3d || (this.ctx.updateWallGeometryLive ? this.ctx : null);
        const updateFn = (engine && typeof engine.updateWallGeometryLive === 'function')
            ? engine.updateWallGeometryLive.bind(engine)
            : (this.ctx.renderer3D && typeof this.ctx.renderer3D.updateWallGeometryLive === 'function')
                ? this.ctx.renderer3D.updateWallGeometryLive.bind(this.ctx.renderer3D)
                : (typeof this.ctx.updateWallGeometryLive === 'function')
                    ? this.ctx.updateWallGeometryLive.bind(this.ctx)
                    : null;

        walls.forEach(w => {
            if (updateFn) {
                try {
                    updateFn(w);
                } catch (err) {
                    console.error('[RoomInteractiveSuite] Error updating wall 3D geometry:', err);
                }
            } else if (this.ctx.envBuilder && typeof this.ctx.envBuilder.buildWallGroup === 'function') {
                try {
                    if (w.mesh3D && this.ctx.structureGroup) {
                        this.ctx.structureGroup.remove(w.mesh3D);
                        if (w.mesh3D.geometry) w.mesh3D.geometry.dispose();
                    }
                    this.ctx.envBuilder.buildWallGroup(w);
                } catch (err) {
                    console.error('[RoomInteractiveSuite] Fallback buildWallGroup error:', err);
                }
            }
        });

        if (this.ctx.requestRender) {
            this.ctx.requestRender('walls_3d_synced');
        }
    }

    _getRoomBoundingWalls(targetRoom = this.room) {
        if (!targetRoom || !targetRoom.path || targetRoom.path.length < 3) return [];
        const planner = this.planner;
        const allWalls = planner?.walls?.filter(w => !w.hidden && w.type !== 'railing') || [];
        const path = targetRoom.path;

        // 1. If room entity already stores its bounding walls and they belong to this room
        if (Array.isArray(targetRoom.walls) && targetRoom.walls.length > 0) {
            const validWalls = targetRoom.walls.filter(w => !w.isDeleted && allWalls.includes(w));
            if (validWalls.length > 0) {
                return validWalls;
            }
        }

        // 2. Query RoomWalls strictly corresponding to each perimeter segment of the room
        const matchedWalls = [];

        for (let i = 0; i < path.length; i++) {
            const p1 = path[i];
            const p2 = path[(i + 1) % path.length];
            const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (segLen < 1) continue;

            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            let bestWall = null;
            let bestScore = Infinity;

            for (const w of allWalls) {
                const s = typeof w.startAnchor?.position === 'function' ? w.startAnchor.position() : (w.startAnchor || { x: w.startX, y: w.startY });
                const e = typeof w.endAnchor?.position === 'function' ? w.endAnchor.position() : (w.endAnchor || { x: w.endX, y: w.endY });
                if (!s || !e) continue;

                const wallLen = Math.hypot(e.x - s.x, e.y - s.y);
                const wallMidX = (s.x + e.x) / 2;
                const wallMidY = (s.y + e.y) / 2;

                const distToSegMid = Math.hypot(wallMidX - midX, wallMidY - midY);
                const lenDiff = Math.abs(wallLen - segLen);

                const d1 = this._getDistancePointToSegment(s.x, s.y, p1, p2);
                const d2 = this._getDistancePointToSegment(e.x, e.y, p1, p2);

                const isDedicatedWall = (Math.hypot(s.x - p1.x, s.y - p1.y) < 35 && Math.hypot(e.x - p2.x, e.y - p2.y) < 35) ||
                                       (Math.hypot(s.x - p2.x, s.y - p2.y) < 35 && Math.hypot(e.x - p1.x, e.y - p1.y) < 35);

                if (isDedicatedWall) {
                    bestWall = w;
                    break;
                }

                if (distToSegMid < 35 && lenDiff < 50 && d1 < 35 && d2 < 35) {
                    if (distToSegMid + lenDiff < bestScore) {
                        bestScore = distToSegMid + lenDiff;
                        bestWall = w;
                    }
                }
            }

            if (bestWall && !matchedWalls.includes(bestWall)) {
                matchedWalls.push(bestWall);
            }
        }

        // Fallback: If segment loop matching found at least one wall, use it
        if (matchedWalls.length > 0) {
            targetRoom.walls = matchedWalls;
            return matchedWalls;
        }

        // Fallback to getRoomWallsAndSides
        const results = getRoomWallsAndSides(targetRoom, planner, this.ctx.engine3d || this.ctx);
        if (results && results.length > 0) {
            const walls = results.map(r => r.wall);
            targetRoom.walls = walls;
            return walls;
        }

        return [];
    }

    _getDistancePointToSegment(px, py, p1, p2) {
        const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
        if (l2 === 0) return Math.hypot(px - p1.x, py - p1.y);
        let t = ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (p1.x + t * (p2.x - p1.x)), py - (p1.y + t * (p2.y - p1.y)));
    }

    _getDistancePointToPolygon(px, py, path) {
        if (!path || path.length < 2) return Infinity;
        let minDist = Infinity;
        for (let i = 0; i < path.length; i++) {
            const p1 = path[i];
            const p2 = path[(i + 1) % path.length];
            const d = this._getDistancePointToSegment(px, py, p1, p2);
            if (d < minDist) minDist = d;
        }
        return minDist;
    }

    _getRoomWallHeight(targetRoom = this.room) {
        if (this.scopeMode === 'building') {
            const planner = this.planner;
            const w = planner?.walls?.find(w => !w.hidden && w.type !== 'railing');
            if (w && w.height !== undefined) return Number(w.height);
        }
        const walls = this._getRoomBoundingWalls(targetRoom);
        if (walls.length > 0 && walls[0].height !== undefined) {
            return Number(walls[0].height);
        }
        if (targetRoom && targetRoom.wallHeight !== undefined) {
            return Number(targetRoom.wallHeight);
        }
        return 300;
    }

    _getRoomArea(path) {
        if (!path || path.length < 3) return 0;
        let sum = 0;
        for (let i = 0; i < path.length; i++) {
            const p1 = path[i];
            const p2 = path[(i + 1) % path.length];
            sum += (p2.x - p1.x) * (p2.y + p1.y);
        }
        return Math.abs(sum / 2);
    }

    _isPointInPolygon(pt, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    dispose() {
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (this._onKeyDown && typeof window !== 'undefined') {
            window.removeEventListener('keydown', this._onKeyDown);
        }
        if (this.ctx.controls) {
            this.ctx.controls.removeEventListener('change', this._onCameraChange);
        }
        if (this.domRoomHUD && this.domRoomHUD.parentNode) {
            this.domRoomHUD.parentNode.removeChild(this.domRoomHUD);
        }
        if (this.domBuildingHUD && this.domBuildingHUD.parentNode) {
            this.domBuildingHUD.parentNode.removeChild(this.domBuildingHUD);
        }
        if (this.domTooltip && this.domTooltip.parentNode) {
            this.domTooltip.parentNode.removeChild(this.domTooltip);
        }
        this.detach();
    }
}

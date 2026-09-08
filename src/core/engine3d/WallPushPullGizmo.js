import * as THREE from 'three';
import { EVENTS } from '../constants/events.js';
import { coreEventBus } from '../EventBus.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { WallReformer } from '../engine2d/WallReformer.js';
import { advance_openings } from '../engine2d/advance_openings.js';
import { WallEngine } from '../wall/WallEngine.js';
import { UnitConverter } from '../units/UnitConverter.js';
import { useSettingsStore } from '../../stores/useSettingsStore.js';

function _createBadgeShape(width = 24, height = 13, radius = 6.5) {
    const shape = new THREE.Shape();
    const halfW = width / 2;
    const halfH = height / 2;
    const r = Math.min(radius, halfW, halfH);
    shape.moveTo(-halfW + r, -halfH);
    shape.lineTo(halfW - r, -halfH);
    shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
    shape.lineTo(halfW, halfH - r);
    shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
    shape.lineTo(-halfW + r, halfH);
    shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
    shape.lineTo(-halfW, -halfH + r);
    shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);
    shape.closePath();
    return shape;
}

function _createBadgeBorderShape(width = 24, height = 13, radius = 6.5, borderWidth = 1.5) {
    const shape = _createBadgeShape(width, height, radius);
    const innerW = width - borderWidth * 2;
    const innerH = height - borderWidth * 2;
    const innerR = Math.max(1, radius - borderWidth);
    const hole = _createBadgeShape(innerW, innerH, innerR);
    shape.holes.push(hole);
    return shape;
}

function _createArrowheadShape(dir, size = 10, width = 8) {
    const shape = new THREE.Shape();
    if (dir === 'left') {
        shape.moveTo(0, 0);
        shape.lineTo(size, width / 2);
        shape.lineTo(size * 0.7, 0);
        shape.lineTo(size, -width / 2);
        shape.closePath();
    } else if (dir === 'right') {
        shape.moveTo(0, 0);
        shape.lineTo(-size, width / 2);
        shape.lineTo(-size * 0.7, 0);
        shape.lineTo(-size, -width / 2);
        shape.closePath();
    } else if (dir === 'up') {
        shape.moveTo(0, 0);
        shape.lineTo(-width / 2, -size);
        shape.lineTo(0, -size * 0.7);
        shape.lineTo(width / 2, -size);
        shape.closePath();
    } else if (dir === 'down') {
        shape.moveTo(0, 0);
        shape.lineTo(-width / 2, size);
        shape.lineTo(0, size * 0.7);
        shape.lineTo(width / 2, size);
        shape.closePath();
    }
    return shape;
}

function _createDoubleArrowShape(length = 14, stemW = 3.0, headL = 3.8, headW = 7.0) {
    const shape = new THREE.Shape();
    const halfL = length / 2;
    const halfW = stemW / 2;
    const halfHW = headW / 2;

    shape.moveTo(0, halfL);
    shape.lineTo(-halfHW, halfL - headL);
    shape.lineTo(-halfW, halfL - headL);
    shape.lineTo(-halfW, -halfL + headL);
    shape.lineTo(-halfHW, -halfL + headL);
    shape.lineTo(0, -halfL);
    shape.lineTo(halfHW, -halfL + headL);
    shape.lineTo(halfW, -halfL + headL);
    shape.lineTo(halfW, halfL - headL);
    shape.lineTo(halfHW, halfL - headL);
    shape.closePath();
    return shape;
}

function _createFourWayArrowShape(size = 18, stemW = 3.2, headL = 4.2, headW = 8.0) {
    const shape = new THREE.Shape();
    const halfS = size / 2;
    const halfW = stemW / 2;
    const halfHW = headW / 2;

    shape.moveTo(0, halfS);
    shape.lineTo(halfHW, halfS - headL);
    shape.lineTo(halfW, halfS - headL);
    shape.lineTo(halfW, halfW);
    shape.lineTo(halfS - headL, halfW);
    shape.lineTo(halfS - headL, halfHW);
    shape.lineTo(halfS, 0);
    shape.lineTo(halfS - headL, -halfHW);
    shape.lineTo(halfS - headL, -halfW);
    shape.lineTo(halfW, -halfW);
    shape.lineTo(halfW, -halfS + headL);
    shape.lineTo(halfHW, -halfS + headL);
    shape.lineTo(0, -halfS);
    shape.lineTo(-halfHW, -halfS + headL);
    shape.lineTo(-halfW, -halfS + headL);
    shape.lineTo(-halfW, -halfW);
    shape.lineTo(-halfS + headL, -halfW);
    shape.lineTo(-halfS + headL, -halfHW);
    shape.lineTo(-halfS, 0);
    shape.lineTo(-halfS + headL, halfHW);
    shape.lineTo(-halfS + headL, halfW);
    shape.lineTo(-halfW, halfW);
    shape.lineTo(-halfW, halfS - headL);
    shape.lineTo(-halfHW, halfS - headL);
    shape.closePath();
    return shape;
}

const _badgeTextureCache = new Map();

function _getDimensionBadgeTexture(text) {
    if (_badgeTextureCache.has(text)) {
        return _badgeTextureCache.get(text);
    }
    if (typeof document === 'undefined') {
        const tex = new THREE.Texture();
        const res = { texture: tex, worldW: 36, worldH: 14 };
        _badgeTextureCache.set(text, res);
        return res;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const font = 'bold 36px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.font = font;
    const textMetrics = ctx.measureText(text);
    const textW = Math.ceil(textMetrics.width);
    const padX = 36;
    const badgeW = Math.max(120, textW + padX * 2);
    const badgeH = 68;
    const r = badgeH / 2;
    const margin = 16;

    canvas.width = badgeW + margin * 2;
    canvas.height = badgeH + margin * 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const _drawPill = () => {
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, badgeW, badgeH, r);
            ctx.closePath();
        } else if (typeof ctx.arcTo === 'function') {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + badgeW - r, y);
            ctx.arcTo(x + badgeW, y, x + badgeW, y + badgeH, r);
            ctx.arcTo(x + badgeW, y + badgeH, x, y + badgeH, r);
            ctx.arcTo(x, y + badgeH, x, y, r);
            ctx.arcTo(x, y, x + badgeW, y, r);
            ctx.closePath();
        } else if (typeof ctx.quadraticCurveTo === 'function') {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + badgeW - r, y);
            ctx.quadraticCurveTo(x + badgeW, y, x + badgeW, y + r);
            ctx.lineTo(x + badgeW, y + badgeH - r);
            ctx.quadraticCurveTo(x + badgeW, y + badgeH, x + badgeW - r, y + badgeH);
            ctx.lineTo(x + r, y + badgeH);
            ctx.quadraticCurveTo(x, y + badgeH, x, y + badgeH - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        } else {
            ctx.beginPath();
            if (typeof ctx.rect === 'function') ctx.rect(x, y, badgeW, badgeH);
            ctx.closePath();
        }
    };

    // 1. Cyan Glow Drop Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 240, 255, 0.65)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    // Rounded Pill
    const x = margin;
    const y = margin;
    _drawPill();

    // 2. Royal Blue Fill (#0070f3)
    ctx.fillStyle = '#0070f3';
    ctx.fill();
    ctx.restore();

    // 3. Crisp Pure White Border
    ctx.save();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ffffff';
    _drawPill();
    ctx.stroke();
    ctx.restore();

    // 4. Pure White Text
    ctx.font = font;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    const result = {
        texture,
        aspect: canvas.width / canvas.height,
        worldH: 14,
        worldW: 14 * (canvas.width / canvas.height)
    };
    _badgeTextureCache.set(text, result);
    return result;
}

/**
 * WallPushPullGizmo
 * 
 * Provides interactive Sims 4-style 3D push/pull handles directly on wall surfaces.
 * 
 * 3-Step Elevation Workflow:
 * 1. User selects specific area on wall face (Horizontal Left/Right & Vertical Top/Bottom handles + Glowing 2D Selection Box).
 * 2. User pulls outward freely to extrude a 100% solid wall block. Once increased, the Push arrow appears on the front face to adjust/push back.
 * 3. User clicks Done (✓) to bake or Cancel (✕) to discard.
 */
export class WallPushPullGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.target = null;
        this.visible = false;
        
        this.isDragging = false;
        this.activeHandle = null;
        this.activeFacing = 1;
        this.currentDragDist = 0;
        this.currentExtrudeDepth = 0;
        this.initialExtrudeDepth = 0;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dragPlane = new THREE.Plane();
        this.dragStartPoint = new THREE.Vector3();
        this.wallNormal2D = { x: 0, y: 1 };
        
        this.initialStart = { x: 0, y: 0 };
        this.initialEnd = { x: 0, y: 0 };
        this.initialThickness = 20;
        this._snapshotCmd = null;
        this._capturedPointerId = null;

        // Push/Pull Sub-Mode: 'thickness' (Face Push/Pull) vs 'baseline' (Move Room Baseline)
        this.mode = 'thickness';

        // Area Selection Scope: 'full' (Whole Wall) vs 'subregion' (Custom Area, Bay, Niche, Wainscot, Cladding)
        this.selectionScope = 'full';
        
        // Selected Region Bounds: Horizontal (tStart to tEnd: 0.0 to 1.0) and Vertical (elevBottom to elevTop: cm)
        this.tStart = 0.0;
        this.tEnd = 1.0;
        this.initialStartT = 0.0;
        this.initialEndT = 1.0;

        this.elevBottom = 0;
        this.elevTop = 120;
        this.initialElevBottom = 0;
        this.initialElevTop = 120;

        this.handles = new THREE.Group();
        this.handles.name = 'WallPushPull_Handles';
        this.add(this.handles);
        
        // Materials (Unified Modern CAD/BIM Aesthetic: Dark Royal Blue, Bright Cyan Hover, Pure White)
        this.matRoyalBlue = new THREE.MeshBasicMaterial({ color: 0x0070f3, depthTest: false, side: THREE.DoubleSide });
        this.matActiveCyan = new THREE.MeshBasicMaterial({ color: 0x00d2ff, depthTest: false, side: THREE.DoubleSide });
        this.matWhite = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, side: THREE.DoubleSide });
        this.matCyanGlow = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.65, depthTest: false, side: THREE.DoubleSide });
        this.matReticleDisc = new THREE.MeshBasicMaterial({ color: 0x0070f3, transparent: true, opacity: 0.18, depthTest: false, side: THREE.DoubleSide });
        this.matSky = this.matActiveCyan;
        this.matDarkSky = this.matRoyalBlue;
        this.matHover = this.matActiveCyan;
        this.matActive = new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 1.0 });
        this.matGreen = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.matPurple = new THREE.MeshBasicMaterial({ color: 0xa855f7, depthTest: false, transparent: true, opacity: 0.95 });
        
        // 1. Build Front and Back center arrow handles with circular halo rings
        this.handleFront = this._buildSims4Handle('front', 0x0070f3);
        this.handleBack = this._buildSims4Handle('back', 0x0070f3);

        // 2. Build Width Boundary Handles (Left & Right - Subtle Guide Lines with Circular Grips)
        this.startWidthHandle = this._buildBoundaryHandle('start', 0x0070f3);
        this.endWidthHandle = this._buildBoundaryHandle('end', 0x0070f3);

        // 3. Build Height & Elevation Boundary Handles (Bottom & Top - Subtle Guide Lines with Circular Grips)
        this.bottomHeightHandle = this._buildHorizontalBoundaryHandle('bottom', 0x0070f3);
        this.topHeightHandle = this._buildHorizontalBoundaryHandle('top', 0x0070f3);

        // 4. Build 4 Corner Circular Handles (Smooth 2D box resizing in 3D)
        this.cornerBL = this._buildCornerHandle('corner_bl', 0x0070f3);
        this.cornerBR = this._buildCornerHandle('corner_br', 0x0070f3);
        this.cornerTL = this._buildCornerHandle('corner_tl', 0x0070f3);
        this.cornerTR = this._buildCornerHandle('corner_tr', 0x0070f3);

        // 5. Build 2D Selection Box on Wall Face
        this._buildSelectionRects();

        // 6. Build Real-time Solid Block Ghost Preview
        this._buildSolidBlockPreview();

        // 7. Build Dimension Lines & Blue Pill Badges
        this._buildDimensionLines();
        
        this.handles.add(this.handleFront);
        this.handles.add(this.handleBack);
        this.handles.add(this.startWidthHandle);
        this.handles.add(this.endWidthHandle);
        this.handles.add(this.bottomHeightHandle);
        this.handles.add(this.topHeightHandle);
        this.handles.add(this.cornerBL);
        this.handles.add(this.cornerBR);
        this.handles.add(this.cornerTL);
        this.handles.add(this.cornerTR);
        this.add(this.selectionRectGroup);
        this.add(this.solidBlockPreview);

        this._createConfirmHUDBar();
        
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        
        const dom = this.ctx.renderer.domElement;
        dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
        dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
        window.addEventListener('keydown', this._onKeyDown);
    }

    _buildSelectionRects() {
        this.selectionRectGroup = new THREE.Group();
        this.selectionRectGroup.name = 'WallPushPull_SelectionRects';
        this.selectionRectGroup.visible = false;

        const baseGeo = new THREE.PlaneGeometry(1, 1);
        const edgesGeo = new THREE.EdgesGeometry(baseGeo);

        // 1. Translucent Soft Luminous Sky-Blue Fill
        const matFill = new THREE.MeshBasicMaterial({
            color: 0x00d2ff,
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        // 2. Single Simple Solid Glowing Outline (Item 4: Single line, no duplicate layers or dashed lines)
        const matSingleOutline = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 2.5,
            transparent: true,
            opacity: 0.95
        });

        // Front Face
        this.selectionPlaneFront = new THREE.Mesh(baseGeo, matFill);
        this.selectionPlaneFront.userData = { isWallPushPullHandle: true, isSelectionPlane: true, part: 'slide_center', side: 'front' };
        this.selectionOutlineFront = new THREE.LineSegments(edgesGeo, matSingleOutline);
        this.selectionOutlineFront.raycast = () => {};
        this.selectionOutlineFront.renderOrder = 999980;

        // Back Face
        this.selectionPlaneBack = new THREE.Mesh(baseGeo, matFill);
        this.selectionPlaneBack.userData = { isWallPushPullHandle: true, isSelectionPlane: true, part: 'slide_center', side: 'back' };
        this.selectionOutlineBack = new THREE.LineSegments(edgesGeo, matSingleOutline);
        this.selectionOutlineBack.raycast = () => {};
        this.selectionOutlineBack.renderOrder = 999980;

        this.selectionRectGroup.add(this.selectionPlaneFront);
        this.selectionRectGroup.add(this.selectionOutlineFront);

        this.selectionRectGroup.add(this.selectionPlaneBack);
        this.selectionRectGroup.add(this.selectionOutlineBack);
    }

    _buildSolidBlockPreview() {
        this.solidBlockPreview = new THREE.Group();
        this.solidBlockPreview.name = 'WallPushPull_SolidBlockPreview';
        this.solidBlockPreview.visible = false;

        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        const boxMat = new THREE.MeshBasicMaterial({
            color: 0x00d2ff,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            side: THREE.FrontSide
        });

        this.previewMesh = new THREE.Mesh(boxGeo, boxMat);
        this.previewMesh.renderOrder = 999980;
        this.previewMesh.raycast = () => {};

        this.previewEdgesMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 2.5,
            depthTest: false
        });
        this.previewEdges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), this.previewEdgesMat);
        this.previewEdges.raycast = () => {};
        this.previewEdges.renderOrder = 999985;

        // Dynamic 3D Depth Leader Line
        this.depthLeaderLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 2.5,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        }));
        this.depthLeaderLine.raycast = () => {};
        this.depthLeaderLine.renderOrder = 999990;

        // Floating 3D Depth Measurement Badge
        this.badgeDepth = this._createBadgeMesh();
        this.badgeDepth.renderOrder = 999995;

        this.solidBlockPreview.add(this.previewMesh);
        this.solidBlockPreview.add(this.previewEdges);
        this.solidBlockPreview.add(this.depthLeaderLine);
        this.solidBlockPreview.add(this.badgeDepth);
    }

    _createBadgeMesh() {
        const mat = new THREE.MeshBasicMaterial({
            transparent: true,
            depthTest: false,
            side: THREE.DoubleSide
        });
        const geo = new THREE.PlaneGeometry(1, 1);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 999995;
        mesh.raycast = () => {};
        return mesh;
    }

    _buildDimensionLines() {
        this.dimensionLinesGroup = new THREE.Group();
        this.dimensionLinesGroup.name = 'WallPushPull_DimensionLines';
        this.dimensionLinesGroup.renderOrder = 999990;

        const lineMat = new THREE.LineBasicMaterial({
            color: 0x0050c8,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });

        this.dimLinesMesh = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat);
        this.dimLinesMesh.raycast = () => {};
        this.dimensionLinesGroup.add(this.dimLinesMesh);

        // 2D Flat Vector Arrowheads (Royal Blue `#0050c8`)
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x0050c8, depthTest: false, side: THREE.DoubleSide });
        const createArrow = (dir) => {
            const shape = _createArrowheadShape(dir, 10, 8);
            const geo = new THREE.ShapeGeometry(shape);
            const mesh = new THREE.Mesh(geo, arrowMat);
            mesh.raycast = () => {};
            mesh.renderOrder = 999992;
            return mesh;
        };

        this.arrowTopL = createArrow('left');   // points left
        this.arrowTopR = createArrow('right');  // points right
        this.arrowBottomL = createArrow('left'); // points left
        this.arrowBottomR = createArrow('right');// points right
        this.arrowLeftB = createArrow('down');  // points down
        this.arrowLeftT = createArrow('up');    // points up
        this.arrowRightB = createArrow('down'); // points down
        this.arrowRightT = createArrow('up');   // points up

        this.dimensionLinesGroup.add(this.arrowTopL);
        this.dimensionLinesGroup.add(this.arrowTopR);
        this.dimensionLinesGroup.add(this.arrowBottomL);
        this.dimensionLinesGroup.add(this.arrowBottomR);
        this.dimensionLinesGroup.add(this.arrowLeftB);
        this.dimensionLinesGroup.add(this.arrowLeftT);
        this.dimensionLinesGroup.add(this.arrowRightB);
        this.dimensionLinesGroup.add(this.arrowRightT);

        // 3D Badges (CanvasTexture planes)
        this.badgeTop = this._createBadgeMesh();
        this.badgeBottom = this._createBadgeMesh();
        this.badgeLeft = this._createBadgeMesh();
        this.badgeRight = this._createBadgeMesh();

        this.dimensionLinesGroup.add(this.badgeTop);
        this.dimensionLinesGroup.add(this.badgeBottom);
        this.dimensionLinesGroup.add(this.badgeLeft);
        this.dimensionLinesGroup.add(this.badgeRight);

        this.add(this.dimensionLinesGroup);
    }

    _buildCornerHandle(cornerId, color = 0x0070f3) {
        const group = new THREE.Group();
        group.userData = { isWallPushPullHandle: true, isCorner: true, part: cornerId };
        group.renderOrder = 999990;

        const hitMesh = new THREE.Mesh(
            new THREE.CircleGeometry(16, 16),
            new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
        );
        hitMesh.name = 'cornerHit';
        hitMesh.userData = { isWallPushPullHandle: true, isCorner: true, part: cornerId };
        group.add(hitMesh);

        // 1. Single Pure White Solid Outer Ring Disc (Radius 7.0) (Single round shape)
        const donutGeo = new THREE.CircleGeometry(7.0, 24);
        const donutMesh = new THREE.Mesh(donutGeo, this.matWhite);
        donutMesh.position.z = 0.04;
        donutMesh.userData = { isWallPushPullHandle: true, isCorner: true, part: cornerId, isDonut: true, isRing: true, isHalo: true };
        donutMesh.renderOrder = 999991;
        group.add(donutMesh);

        // 2. Inner Vibrant Dark Royal Blue Core Disc (Radius 4.8)
        const discGeo = new THREE.CircleGeometry(4.8, 24);
        const discMesh = new THREE.Mesh(discGeo, this.matRoyalBlue);
        discMesh.position.z = 0.06;
        discMesh.userData = { isWallPushPullHandle: true, isCorner: true, part: cornerId, isBase: true };
        discMesh.renderOrder = 999992;
        group.add(discMesh);

        // 3. Center Pure White Pinpoint Pip Dot (Radius 2.0)
        const pipGeo = new THREE.CircleGeometry(2.0, 16);
        const pipMesh = new THREE.Mesh(pipGeo, this.matWhite);
        pipMesh.position.z = 0.08;
        pipMesh.userData = { isWallPushPullHandle: true, isCorner: true, part: cornerId, isPip: true };
        pipMesh.renderOrder = 999993;
        group.add(pipMesh);

        // 4. Center Core Dot (Radius 1.0, Royal Blue)
        const coreGeo = new THREE.CircleGeometry(1.0, 16);
        const coreMesh = new THREE.Mesh(coreGeo, this.matRoyalBlue);
        coreMesh.position.z = 0.10;
        coreMesh.userData = { isWallPushPullHandle: true, isCorner: true, part: cornerId, isCore: true };
        coreMesh.renderOrder = 999994;
        group.add(coreMesh);

        return group;
    }

    _buildBoundaryHandle(side, color = 0x0070f3) {
        const group = new THREE.Group();
        const partName = side === 'start' ? 'boundary_start' : (side === 'end' ? 'boundary_end' : (side === 'top' ? 'boundary_top' : 'boundary_bottom'));
        const isTop = (side === 'top');
        group.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName };
        group.renderOrder = 999990;

        const hitBox = new THREE.Mesh(
            new THREE.BoxGeometry(32, 32, 24),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        hitBox.name = 'laserHitBox';
        hitBox.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName };
        group.add(hitBox);

        // 1. Subtle Boundary Guide Line
        const isVerticalSide = (side === 'start' || side === 'end');
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            isVerticalSide ? new THREE.Vector3(0, -70, 0) : new THREE.Vector3(-70, 0, 0),
            isVerticalSide ? new THREE.Vector3(0, 70, 0) : new THREE.Vector3(70, 0, 0)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2, depthTest: false, transparent: true, opacity: 0.45 });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        lineMesh.name = 'laserLine';
        lineMesh.renderOrder = 999980;
        group.add(lineMesh);

        // 2. Solid Pure White Border Contour around Double-Arrow
        const borderShape = _createDoubleArrowShape(18, 4.8, 5.0, 10.5);
        const borderGeo = new THREE.ShapeGeometry(borderShape);
        if (isTop) {
            borderGeo.rotateZ(Math.PI / 2);
        }
        const borderMesh = new THREE.Mesh(borderGeo, this.matWhite);
        borderMesh.position.z = 0.04;
        borderMesh.renderOrder = 999991;
        borderMesh.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName, isRing: true, isHalo: true };
        group.add(borderMesh);

        // 3. Dark Royal Blue Base Double-Arrow Fill (#0070f3) with High Visible Z-Index 999999
        const baseShape = _createDoubleArrowShape(15, 3.2, 4.2, 7.8);
        const baseGeo = new THREE.ShapeGeometry(baseShape);
        if (isTop) {
            baseGeo.rotateZ(Math.PI / 2);
        }
        const discMesh = new THREE.Mesh(baseGeo, this.matRoyalBlue);
        discMesh.position.z = 0.06;
        discMesh.renderOrder = 999999;
        discMesh.userData = { isWallPushPullHandle: true, isBoundary: true, side, part: partName, isBase: true, isArrowFill: true };
        group.add(discMesh);

        return group;
    }

    _buildHorizontalBoundaryHandle(side, color = 0x0070f3) {
        return this._buildBoundaryHandle(side, color);
    }

    _updateBoundaryLine(group, heightLen) {
        const lineMesh = group.getObjectByName('laserLine');
        if (lineMesh) {
            lineMesh.geometry.dispose();
            lineMesh.geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, -heightLen / 2, 0),
                new THREE.Vector3(0, heightLen / 2, 0)
            ]);
        }
        const hitBox = group.getObjectByName('laserHitBox');
        if (hitBox) {
            hitBox.geometry.dispose();
            hitBox.geometry = new THREE.BoxGeometry(28, heightLen + 20, 24);
        }
    }

    _updateHorizontalBoundaryLine(group, widthLen) {
        const lineMesh = group.getObjectByName('laserLine');
        if (lineMesh) {
            lineMesh.geometry.dispose();
            lineMesh.geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-widthLen / 2, 0, 0),
                new THREE.Vector3(widthLen / 2, 0, 0)
            ]);
        }
        const hitBox = group.getObjectByName('laserHitBox');
        if (hitBox) {
            hitBox.geometry.dispose();
            hitBox.geometry = new THREE.BoxGeometry(widthLen + 20, 28, 24);
        }
    }

    setMode(mode) {
        if (mode === 'thickness' || mode === 'baseline') {
            this.mode = mode;
            this.updateHandles();
            if (this.ctx.requestRender) this.ctx.requestRender();
        }
    }

    setPreset(presetName) {
        const wall = this._getWallEntity();
        const wallH = wall ? (wall.height !== undefined ? wall.height : (wall.config?.height || 120)) : 120;
        
        if (presetName === 'full') {
            this.selectionScope = 'full';
            this.tStart = 0.0;
            this.tEnd = 1.0;
            this.elevBottom = 0;
            this.elevTop = wallH;
        } else if (presetName === 'middle_bay') {
            this.selectionScope = 'subregion';
            this.tStart = 0.25;
            this.tEnd = 0.75;
            this.elevBottom = 0;
            this.elevTop = wallH;
        } else if (presetName === 'bottom') {
            this.selectionScope = 'subregion';
            this.tStart = 0.0;
            this.tEnd = 1.0;
            this.elevBottom = 0;
            this.elevTop = Math.min(100, Math.round(wallH * 0.4));
        } else if (presetName === 'top') {
            this.selectionScope = 'subregion';
            this.tStart = 0.0;
            this.tEnd = 1.0;
            const hSpan = Math.min(100, Math.round(wallH * 0.4));
            this.elevBottom = Math.max(0, wallH - hSpan);
            this.elevTop = wallH;
        } else if (presetName === 'center_box') {
            this.selectionScope = 'subregion';
            this.tStart = 0.25;
            this.tEnd = 0.75;
            const hSpan = Math.round(wallH * 0.5);
            this.elevBottom = Math.max(0, Math.round((wallH - hSpan) / 2));
            this.elevTop = this.elevBottom + hSpan;
        }
        this.updateHandles();
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    alignLocation(loc) {
        const wall = this._getWallEntity();
        const wallH = wall ? (wall.height !== undefined ? wall.height : (wall.config?.height || 120)) : 120;
        const spanH = Math.max(10, this.elevTop - this.elevBottom);
        const spanT = Math.max(0.05, this.tEnd - this.tStart);

        if (loc === 'bottom') {
            this.elevBottom = 0;
            this.elevTop = Math.min(wallH, spanH);
        } else if (loc === 'middle_v') {
            this.elevBottom = Math.max(0, Math.round((wallH - spanH) / 2));
            this.elevTop = this.elevBottom + spanH;
        } else if (loc === 'top') {
            this.elevTop = wallH;
            this.elevBottom = Math.max(0, wallH - spanH);
        } else if (loc === 'left') {
            this.tStart = 0.0;
            this.tEnd = Math.min(1.0, spanT);
        } else if (loc === 'center_h') {
            this.tStart = Math.max(0, Math.round(((1 - spanT) / 2) * 100) / 100);
            this.tEnd = Math.min(1.0, Math.round((this.tStart + spanT) * 100) / 100);
        } else if (loc === 'right') {
            this.tEnd = 1.0;
            this.tStart = Math.max(0, Math.round((1 - spanT) * 100) / 100);
        }
        this.selectionScope = 'subregion';
        this.updateHandles();
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    _onKeyDown(e) {
        if (!this.visible) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            this.commit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.cancel();
        }
    }

    _createConfirmHUDBar() {
        if (typeof document === 'undefined') return;
        
        // If managed by WallInteractiveSuite, WallInteractiveSuite provides the single unified confirmation HUD
        if (this.ctx.interactions?.wallInteractiveSuite) {
            return;
        }

        this.domConfirmBar = document.createElement('div');
        this.domConfirmBar.className = 'sims4-pushpull-confirm-bar';
        this.domConfirmBar.style.cssText = `
            position: absolute;
            display: none;
            transform: translate(-50%, -100%);
            padding: 6px 14px;
            border-radius: 9999px;
            background: rgba(15, 23, 42, 0.92);
            border: 1.5px solid rgba(56, 189, 248, 0.5);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.3);
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
            z-index: 10001;
            user-select: none;
            gap: 6px;
            align-items: center;
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            pointer-events: auto;
            max-width: calc(100vw - 24px);
            box-sizing: border-box;
            flex-wrap: wrap;
        `;

        this.domBadge = document.createElement('span');
        this.domBadge.style.cssText = `
            color: #38bdf8;
            font-weight: 700;
            font-size: 12px;
            padding-right: 4px;
        `;
        this.domConfirmBar.appendChild(this.domBadge);

        const btnCancel = document.createElement('button');
        btnCancel.textContent = '✕ Cancel';
        btnCancel.title = 'Cancel extrusion and revert (Esc)';
        btnCancel.style.cssText = `
            padding: 5px 12px;
            border-radius: 9999px;
            border: 1px solid rgba(239, 68, 68, 0.6);
            background: rgba(239, 68, 68, 0.15);
            color: #fca5a5;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.15s ease;
            min-height: 28px;
        `;
        btnCancel.onmouseenter = () => { btnCancel.style.background = '#ef4444'; btnCancel.style.color = '#ffffff'; };
        btnCancel.onmouseleave = () => { btnCancel.style.background = 'rgba(239, 68, 68, 0.15)'; btnCancel.style.color = '#fca5a5'; };
        btnCancel.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.cancel();
        };
        this.domConfirmBar.appendChild(btnCancel);

        const btnDone = document.createElement('button');
        btnDone.textContent = '✓ Done';
        btnDone.title = 'Apply solid extrusion to wall (Enter)';
        btnDone.style.cssText = `
            padding: 5px 14px;
            border-radius: 9999px;
            border: 1px solid rgba(16, 185, 129, 0.7);
            background: rgba(16, 185, 129, 0.25);
            color: #6ee7b7;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.15s ease;
            min-height: 28px;
        `;
        btnDone.onmouseenter = () => { btnDone.style.background = '#10b981'; btnDone.style.color = '#ffffff'; };
        btnDone.onmouseleave = () => { btnDone.style.background = 'rgba(16, 185, 129, 0.25)'; btnDone.style.color = '#6ee7b7'; };
        btnDone.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.commit();
        };
        this.domConfirmBar.appendChild(btnDone);

        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domConfirmBar);
    }

    _buildSims4Handle(side, color = 0x0070f3) {
        const group = new THREE.Group();
        group.userData = { isWallPushPullHandle: true, side, part: side };
        group.renderOrder = 999990;
        
        // Raycast hit plane/circle
        const hitGeo = new THREE.CircleGeometry(28, 24);
        const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitMesh.userData = { isWallPushPullHandle: true, side, part: 'base' };
        group.add(hitMesh);

        // 1. Single Clean Royal Blue Disc (Radius 14) (Single round disc, no duplicate outer rounds)
        const innerDiscGeo = new THREE.CircleGeometry(14, 36);
        const innerDisc = new THREE.Mesh(innerDiscGeo, this.matRoyalBlue);
        innerDisc.position.z = 0.04;
        innerDisc.renderOrder = 999992;
        innerDisc.userData = { isWallPushPullHandle: true, side, part: side, isInnerDisc: true, isBase: true, isReticle: true };
        group.add(innerDisc);

        // 2. Pure White Border Ring around Disc (Radius 14, thickness 1.4)
        const innerRingGeo = new THREE.TorusGeometry(14, 1.4, 12, 36);
        const innerRing = new THREE.Mesh(innerRingGeo, this.matWhite);
        innerRing.position.z = 0.06;
        innerRing.renderOrder = 999993;
        innerRing.userData = { isWallPushPullHandle: true, side, part: side, isRing: true, isHalo: true };
        group.add(innerRing);

        // 3. Center Pure White 4-Way Arrow Symbol ✥ (High Visible Z-Index 999999)
        const arrowShape = _createFourWayArrowShape(18, 3.2, 4.2, 8.0);
        const shapeGeo = new THREE.ShapeGeometry(arrowShape);
        const arrowMesh = new THREE.Mesh(shapeGeo, this.matWhite);
        arrowMesh.position.z = 0.08;
        arrowMesh.renderOrder = 999999;
        arrowMesh.userData = { isWallPushPullHandle: true, side, part: side, isArrowFill: true, isTicks: true };
        group.add(arrowMesh);

        return group;
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
        this.currentExtrudeDepth = 0;
        this.initialExtrudeDepth = 0;
        
        const wall = this._getWallEntity();
        this.existingProtrusion = object.userData?.widget 
            || (object.userData?.isProtrusion ? (object.userData.entity?.type === 'solid_protrusion' ? object.userData.entity : null) : null)
            || (wall?.attachedWidgets?.find(w => (w.type === 'solid_protrusion' || w.configId === 'solid_protrusion') && (w.depth || w.width)));
        
        if (wall) {
            const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
            const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };
            const len = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
            const h = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));

            if (this.existingProtrusion && (this.existingProtrusion.type === 'solid_protrusion' || this.existingProtrusion.configId === 'solid_protrusion')) {
                const protW = this.existingProtrusion.width || len;
                const protH = this.existingProtrusion.height || h;
                const protElev = this.existingProtrusion.elevation || 0;
                const protT = this.existingProtrusion.t !== undefined ? this.existingProtrusion.t : 0.5;
                const halfT = (protW / 2) / len;

                this.tStart = Math.max(0, protT - halfT);
                this.tEnd = Math.min(1, protT + halfT);
                this.elevBottom = protElev;
                this.elevTop = protElev + protH;
                this.currentExtrudeDepth = this.existingProtrusion.depth || 0;
                this.initialExtrudeDepth = this.existingProtrusion.depth || 0;
                this.activeFacing = this.existingProtrusion.facing || 1;
                this.activeSide = this.activeFacing === -1 ? 'back' : 'front';
                this.selectionScope = 'subregion';

                this.origProtrusionState = {
                    width: this.existingProtrusion.width,
                    height: this.existingProtrusion.height,
                    elevation: this.existingProtrusion.elevation,
                    depth: this.existingProtrusion.depth,
                    t: this.existingProtrusion.t,
                    facing: this.existingProtrusion.facing
                };
            } else {
                this.elevTop = h;
                this.elevBottom = 0;
                this.tStart = 0.25;
                this.tEnd = 0.75;
                this.activeSide = 'front';
                this.activeFacing = 1;
                this.mode = 'thickness';
                this.selectionScope = 'subregion';
                this.origProtrusionState = null;
            }
        }

        if (this.solidBlockPreview) this.solidBlockPreview.visible = false;
        this.updateHandles();
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    detach() {
        this.target = null;
        this.existingProtrusion = null;
        this.origProtrusionState = null;
        this._snapshotCmd = null;
        this.visible = false;
        this.isDragging = false;
        this.activeHandle = null;
        this.currentExtrudeDepth = 0;
        if (this.solidBlockPreview) this.solidBlockPreview.visible = false;
        if (this.badgeDepth) this.badgeDepth.visible = false;
        if (this.depthLeaderLine) this.depthLeaderLine.visible = false;
        if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
        this._hideDimensionBadges();
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    _getWallEntity() {
        if (!this.target) return null;
        if (this.target.userData && this.target.userData.parentWall) {
            return this.target.userData.parentWall;
        }
        if (this.target.userData && this.target.userData.entity) {
            return this.target.userData.entity;
        }
        if (this.target.parent && this.target.parent.userData && this.target.parent.userData.entity) {
            return this.target.parent.userData.entity;
        }
        return null;
    }

    _getWallGroup() {
        const wall = this._getWallEntity();
        if (!wall) return null;
        if (wall.mesh3D) return wall.mesh3D;
        if (this.target && this.target.isGroup) return this.target;
        if (this.target && this.target.parent && this.target.parent.isGroup) return this.target.parent;
        return null;
    }

    updateHandles() {
        const wall = this._getWallEntity();
        const wallGroup = this._getWallGroup();
        if (!wall || !wallGroup) {
            this.visible = false;
            if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
            this._hideDimensionBadges();
            return;
        }

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;

        const h = (wall.height !== undefined ? wall.height : (wall.config?.height || 120));
        const t = (wall.thickness !== undefined ? wall.thickness : 20);

        if (this.elevTop === undefined || this.elevTop > h) {
            this.elevTop = h;
        }
        if (this.elevBottom === undefined) {
            this.elevBottom = 0;
        }

        // Align Gizmo transform with the Wall Group in 3D scene space
        wallGroup.updateMatrixWorld(true);
        this.position.copy(wallGroup.getWorldPosition(new THREE.Vector3()));
        this.quaternion.copy(wallGroup.getWorldQuaternion(new THREE.Quaternion()));
        this.scale.copy(wallGroup.getWorldScale(new THREE.Vector3()));

        const midX = (this.tStart + this.tEnd) * 0.5 * len;
        const startX = this.tStart * len;
        const endX = this.tEnd * len;
        const spanW = Math.max(1, endX - startX);

        const midY = (this.elevBottom + this.elevTop) * 0.5;
        const spanH = Math.max(1, this.elevTop - this.elevBottom);

        const extrudeD = this.currentExtrudeDepth || 0;
        const frontOffset = t / 2 + extrudeD + 10;
        const backOffset = t / 2 + (extrudeD < 0 ? Math.abs(extrudeD) : 0) + 10;

        const isSubRegion = (this.selectionScope === 'subregion') || (this.tStart > 0.02 || this.tEnd < 0.98 || this.elevBottom > 2 || this.elevTop < (h - 2)) || !!this.existingProtrusion;

        // Detect camera line-of-sight face direction
        const camPos = this.ctx.camera ? this.ctx.camera.position : new THREE.Vector3();
        const wallWorldCenter = new THREE.Vector3(midX, midY, 0).applyMatrix4(wallGroup.matrixWorld);
        const wallWorldNormal = new THREE.Vector3(0, 0, 1).transformDirection(wallGroup.matrixWorld);
        const camToWall = new THREE.Vector3().subVectors(camPos, wallWorldCenter);
        const isFrontFacing = camToWall.dot(wallWorldNormal) >= 0;
        const facing = isFrontFacing ? 1 : -1;
        this.activeFacing = facing;
        this.activeSide = isFrontFacing ? 'front' : 'back';

        // Position Front Handle on front face (local Z = +t/2 + extrudeD)
        this.handleFront.position.set(midX, midY, frontOffset);
        this.handleFront.rotation.set(0, 0, 0);
        this.handleFront.visible = isFrontFacing;

        // Position Back Handle at back face
        this.handleBack.position.set(midX, midY, -backOffset);
        this.handleBack.rotation.set(0, Math.PI, 0);
        this.handleBack.visible = !isFrontFacing;

        // Boundary selection handles: Visible during Sub-Region Selection / Bay Window mode!
        this.startWidthHandle.visible = isSubRegion;
        this.endWidthHandle.visible = isSubRegion;
        this.bottomHeightHandle.visible = isSubRegion;
        this.topHeightHandle.visible = isSubRegion;

        const activeOffset = isFrontFacing ? (frontOffset + 2) : (-backOffset - 2);

        if (isSubRegion) {
            this.startWidthHandle.position.set(startX, midY, activeOffset);
            this.startWidthHandle.rotation.set(0, isFrontFacing ? 0 : Math.PI, 0);
            this._updateBoundaryLine(this.startWidthHandle, spanH);

            this.endWidthHandle.position.set(endX, midY, activeOffset);
            this.endWidthHandle.rotation.set(0, isFrontFacing ? 0 : Math.PI, 0);
            this._updateBoundaryLine(this.endWidthHandle, spanH);

            this.bottomHeightHandle.position.set(midX, this.elevBottom, activeOffset);
            this.bottomHeightHandle.rotation.set(0, isFrontFacing ? 0 : Math.PI, 0);
            this._updateHorizontalBoundaryLine(this.bottomHeightHandle, spanW);

            this.topHeightHandle.position.set(midX, this.elevTop, activeOffset);
            this.topHeightHandle.rotation.set(0, isFrontFacing ? 0 : Math.PI, 0);
            this._updateHorizontalBoundaryLine(this.topHeightHandle, spanW);

            // 4 Circular Corner Handles (Smooth 2D box resizing in 3D)
            this.cornerBL.position.set(startX, this.elevBottom, activeOffset);
            this.cornerBL.rotation.set(0, isFrontFacing ? 0 : Math.PI, 0);
            this.cornerBL.visible = true;

            this.cornerBR.position.set(endX, this.elevBottom, activeOffset);
            this.cornerBR.rotation.set(0, isFrontFacing ? 0 : Math.PI, 0);
            this.cornerBR.visible = true;

            this.cornerTL.position.set(startX, this.elevTop, activeOffset);
            this.cornerTL.rotation.set(0, isFrontFacing ? 0 : Math.PI, 0);
            this.cornerTL.visible = true;

            this.cornerTR.position.set(endX, this.elevTop, activeOffset);
            this.cornerTR.rotation.set(0, isFrontFacing ? 0 : Math.PI, 0);
            this.cornerTR.visible = true;
        } else {
            this.cornerBL.visible = false;
            this.cornerBR.visible = false;
            this.cornerTL.visible = false;
            this.cornerTR.visible = false;
        }

        // Position & Scale the 2D Selection Box on Wall Faces (Always visible for subregion, zero flicker)
        // Position & Scale the 2D Selection Box on Wall Faces (Shown when flat at extrudeD == 0)
        if (this.selectionRectGroup) {
            const isFlat = Math.abs(extrudeD) < 0.5;
            this.selectionRectGroup.visible = isSubRegion && isFlat;
            if (isSubRegion && isFlat) {
                this.selectionPlaneFront.scale.set(spanW, spanH, 1);
                this.selectionPlaneFront.position.set(midX, midY, t / 2 + 0.5);

                this.selectionOutlineFront.scale.set(spanW, spanH, 1);
                this.selectionOutlineFront.position.set(midX, midY, t / 2 + 0.6);

                this.selectionPlaneBack.scale.set(spanW, spanH, 1);
                this.selectionPlaneBack.position.set(midX, midY, -t / 2 - 0.5);

                this.selectionOutlineBack.scale.set(spanW, spanH, 1);
                this.selectionOutlineBack.position.set(midX, midY, -t / 2 - 0.6);
            }
        }

        // Show real-time 3D solid block ghost preview during sub-region pull/push (Consistent 1st time, 2nd time, and any time)
        if (this.solidBlockPreview) {
            const hasDepth = extrudeD >= 0.5;
            if (isSubRegion && hasDepth) {
                this.solidBlockPreview.visible = true;
                const absD = extrudeD;
                this.previewMesh.scale.set(spanW, spanH, absD);
                this.previewEdges.scale.set(spanW, spanH, absD);
                this.previewMesh.visible = true;

                const startZ = (t / 2) * facing;
                const endZ = (t / 2 + absD) * facing;

                // Outward solid protrusion (Luminous Sky-Blue / Cyan Glow)
                this.previewMesh.position.set(midX, midY, (t / 2 + absD / 2) * facing);
                this.previewEdges.position.copy(this.previewMesh.position);
                this.previewEdgesMat.color.setHex(0x00f0ff); // Luminous Cyan
                if (this.previewMesh.material) {
                    this.previewMesh.material.color.setHex(0x00d2ff);
                    this.previewMesh.material.opacity = 0.35;
                }

                // Update 3D Depth Leader Line & Floating Depth Badge (Option 1 & Option 2)
                if (this.depthLeaderLine) {
                    const linePts = [
                        new THREE.Vector3(midX, this.elevTop + 6, startZ),
                        new THREE.Vector3(midX, this.elevTop + 6, endZ)
                    ];
                    this.depthLeaderLine.geometry.dispose();
                    this.depthLeaderLine.geometry = new THREE.BufferGeometry().setFromPoints(linePts);
                    this.depthLeaderLine.visible = true;
                }

                if (this.badgeDepth) {
                    let currentUnit = 'feet_inches';
                    try {
                        const settingsStore = useSettingsStore();
                        currentUnit = settingsStore?.floorPlanSettings?.measurementUnit || 'feet_inches';
                    } catch (e) {}

                    const depthFormatted = '+ ' + UnitConverter.formatLabel(absD, currentUnit);
                    const badgeData = _getDimensionBadgeTexture(depthFormatted);
                    this.badgeDepth.material.map = badgeData.texture;
                    this.badgeDepth.material.needsUpdate = true;
                    this.badgeDepth.scale.set(badgeData.worldW, badgeData.worldH, 1);
                    this.badgeDepth.position.set(midX, this.elevTop + 18, (startZ + endZ) / 2);
                    this.badgeDepth.rotation.set(0, isFrontFacing ? 0 : Math.PI, 0);
                    this.badgeDepth.visible = true;
                }
            } else {
                this.solidBlockPreview.visible = false;
                if (this.badgeDepth) this.badgeDepth.visible = false;
                if (this.depthLeaderLine) this.depthLeaderLine.visible = false;
            }
        }

        // Update Dimension Lines & Floating Pill Badges (2D Width & Height lines shown when flat, Depth badge shown when extruded)
        if (isSubRegion && Math.abs(extrudeD) < 0.5) {
            this._updateDimensionLinesAndBadges(spanW, spanH, startX, endX, midX, midY, this.elevBottom, this.elevTop, activeOffset, wallGroup);
        } else {
            this._hideDimensionBadges();
        }

        this.visible = true;
        this._updateHUDDimensions(len, h);
    }

    _updateDimensionLinesAndBadges(spanW, spanH, startX, endX, midX, midY, elevBottom, elevTop, activeOffset, wallGroup) {
        if (!this.dimensionLinesGroup) return;

        const isFrontFacing = this.activeFacing >= 0;
        const offsetD = 20;
        const tickExtra = 6;
        const linePoints = [
            // Top Dimension Line, Corner Extensions, and Center Connecting Tick
            new THREE.Vector3(startX, elevTop, activeOffset), new THREE.Vector3(startX, elevTop + offsetD + tickExtra, activeOffset),
            new THREE.Vector3(endX, elevTop, activeOffset), new THREE.Vector3(endX, elevTop + offsetD + tickExtra, activeOffset),
            new THREE.Vector3(startX, elevTop + offsetD, activeOffset), new THREE.Vector3(endX, elevTop + offsetD, activeOffset),
            new THREE.Vector3(midX, elevTop, activeOffset), new THREE.Vector3(midX, elevTop + offsetD, activeOffset),

            // Bottom Dimension Line, Corner Extensions, and Center Connecting Tick
            new THREE.Vector3(startX, elevBottom, activeOffset), new THREE.Vector3(startX, elevBottom - offsetD - tickExtra, activeOffset),
            new THREE.Vector3(endX, elevBottom, activeOffset), new THREE.Vector3(endX, elevBottom - offsetD - tickExtra, activeOffset),
            new THREE.Vector3(startX, elevBottom - offsetD, activeOffset), new THREE.Vector3(endX, elevBottom - offsetD, activeOffset),
            new THREE.Vector3(midX, elevBottom, activeOffset), new THREE.Vector3(midX, elevBottom - offsetD, activeOffset),

            // Left Dimension Line, Corner Extensions, and Center Connecting Tick
            new THREE.Vector3(startX, elevBottom, activeOffset), new THREE.Vector3(startX - offsetD - tickExtra, elevBottom, activeOffset),
            new THREE.Vector3(startX, elevTop, activeOffset), new THREE.Vector3(startX - offsetD - tickExtra, elevTop, activeOffset),
            new THREE.Vector3(startX - offsetD, elevBottom, activeOffset), new THREE.Vector3(startX - offsetD, elevTop, activeOffset),
            new THREE.Vector3(startX, midY, activeOffset), new THREE.Vector3(startX - offsetD, midY, activeOffset),

            // Right Dimension Line, Corner Extensions, and Center Connecting Tick
            new THREE.Vector3(endX, elevBottom, activeOffset), new THREE.Vector3(endX + offsetD + tickExtra, elevBottom, activeOffset),
            new THREE.Vector3(endX, elevTop, activeOffset), new THREE.Vector3(endX + offsetD + tickExtra, elevTop, activeOffset),
            new THREE.Vector3(endX + offsetD, elevBottom, activeOffset), new THREE.Vector3(endX + offsetD, elevTop, activeOffset),
            new THREE.Vector3(endX, midY, activeOffset), new THREE.Vector3(endX + offsetD, midY, activeOffset)
        ];

        this.dimLinesMesh.geometry.dispose();
        this.dimLinesMesh.geometry = new THREE.BufferGeometry().setFromPoints(linePoints);

        this.arrowTopL.position.set(startX, elevTop + offsetD, activeOffset);
        this.arrowTopR.position.set(endX, elevTop + offsetD, activeOffset);
        this.arrowBottomL.position.set(startX, elevBottom - offsetD, activeOffset);
        this.arrowBottomR.position.set(endX, elevBottom - offsetD, activeOffset);

        this.arrowLeftB.position.set(startX - offsetD, elevBottom, activeOffset);
        this.arrowLeftT.position.set(startX - offsetD, elevTop, activeOffset);
        this.arrowRightB.position.set(endX + offsetD, elevBottom, activeOffset);
        this.arrowRightT.position.set(endX + offsetD, elevTop, activeOffset);

        // Update 3D CanvasTexture Badges
        let currentUnit = 'feet_inches';
        try {
            const settingsStore = useSettingsStore();
            currentUnit = settingsStore?.floorPlanSettings?.measurementUnit || 'feet_inches';
        } catch (e) {}

        const widthLabel = UnitConverter.formatLabel(spanW, currentUnit);
        const heightLabel = UnitConverter.formatLabel(spanH, currentUnit);

        const updateBadgeMesh = (mesh, localPos, text) => {
            if (!mesh || !text) return;
            const data = _getDimensionBadgeTexture(text);
            mesh.material.map = data.texture;
            mesh.material.needsUpdate = true;
            mesh.scale.set(data.worldW, data.worldH, 1);
            mesh.position.copy(localPos);
            mesh.rotation.set(0, isFrontFacing ? 0 : Math.PI, 0);
            mesh.visible = true;
        };

        updateBadgeMesh(this.badgeTop, new THREE.Vector3(midX, elevTop + offsetD + 10, activeOffset + 0.3), widthLabel);
        updateBadgeMesh(this.badgeBottom, new THREE.Vector3(midX, elevBottom - offsetD - 10, activeOffset + 0.3), widthLabel);
        updateBadgeMesh(this.badgeLeft, new THREE.Vector3(startX - offsetD - 16, midY, activeOffset + 0.3), heightLabel);
        updateBadgeMesh(this.badgeRight, new THREE.Vector3(endX + offsetD + 16, midY, activeOffset + 0.3), heightLabel);

        this.dimensionLinesGroup.visible = true;
    }

    _hideDimensionBadges() {
        if (this.badgeTop) this.badgeTop.visible = false;
        if (this.badgeBottom) this.badgeBottom.visible = false;
        if (this.badgeLeft) this.badgeLeft.visible = false;
        if (this.badgeRight) this.badgeRight.visible = false;
        if (this.dimensionLinesGroup) this.dimensionLinesGroup.visible = false;
    }

    _resetHandleMaterials() {
        // Reset center handles
        [this.handleFront, this.handleBack].forEach(grp => {
            if (!grp) return;
            grp.children.forEach(c => {
                if (c.userData.isBase || c.userData.isReticle || c.userData.isInnerDisc) c.material = this.matRoyalBlue;
                else if (c.userData.isRing || c.userData.isArrowFill || c.userData.isTicks || c.userData.isHalo) c.material = this.matWhite;
            });
        });

        // Reset boundary handles (Top, Bottom, Start, End)
        [this.startWidthHandle, this.endWidthHandle, this.bottomHeightHandle, this.topHeightHandle].forEach(grp => {
            if (!grp) return;
            grp.children.forEach(c => {
                if (c.userData.isBase || c.userData.isArrowFill) c.material = this.matRoyalBlue;
                else if (c.userData.isRing || c.userData.isHalo) c.material = this.matWhite;
            });
        });

        // Reset corner handles (BL, BR, TL, TR)
        [this.cornerBL, this.cornerBR, this.cornerTL, this.cornerTR].forEach(grp => {
            if (!grp) return;
            grp.children.forEach(c => {
                if (c.userData.isBase || c.userData.isCore) c.material = this.matRoyalBlue;
                else if (c.userData.isDonut || c.userData.isPip || c.userData.isRing || c.userData.isHalo) c.material = this.matWhite;
            });
        });
    }

    _setHandleHover(group) {
        if (!group) return;
        group.children.forEach(c => {
            if (c.userData && c.userData.isBase) {
                c.material = this.matActiveCyan;
            }
        });
    }

    _getAllHandleMeshes() {
        return [
            ...this.handleFront.children,
            ...this.handleBack.children,
            ...this.startWidthHandle.children,
            ...this.endWidthHandle.children,
            ...this.bottomHeightHandle.children,
            ...this.topHeightHandle.children,
            ...this.cornerBL.children,
            ...this.cornerBR.children,
            ...this.cornerTL.children,
            ...this.cornerTR.children,
            this.selectionPlaneFront,
            this.selectionPlaneBack
        ].filter(Boolean);
    }

    _setGroupMaterial(group, mat) {
        if (!group) return;
        group.children.forEach(c => {
            if (c.userData && (c.userData.isRing || c.userData.isDonut || c.userData.isPip || c.userData.isHalo || c.userData.isArrowFill || c.userData.isInnerDisc || c.userData.isReticle || c.userData.isTicks)) return;
            if (c.material && c.material.visible === false) return; // preserve invisible hit collider
            if (c.material) c.material = mat;
        });
    }

    _updateHUDDimensions(wallLen, wallH, depthText = null) {
        const wall = this._getWallEntity();
        const wallT = wall ? (wall.thickness !== undefined ? Math.round(wall.thickness) : 20) : 20;
        const isSubRegion = (this.selectionScope === 'subregion') || (this.tStart > 0.02 || this.tEnd < 0.98 || this.elevBottom > 2 || this.elevTop < (wallH - 2)) || !!this.existingProtrusion;
        const selW = Math.round(wallLen * (this.tEnd - this.tStart));
        const selH = Math.round(this.elevTop - this.elevBottom);
        const selElev = Math.round(this.elevBottom);
        const extrudeD = this.currentExtrudeDepth || 0;

        let statusText = '';
        if (depthText) {
            statusText = `${depthText} · 📏 W: ${selW} cm · H: ${selH} cm · Elev: ${selElev} cm`;
        } else if (extrudeD > 0) {
            statusText = `🧱 Solid Block: +${extrudeD} cm · 📏 W: ${selW} cm · H: ${selH} cm · Elev: ${selElev} cm`;
        } else if (extrudeD < 0) {
            statusText = `🪟 Niche: ${extrudeD} cm · 📏 W: ${selW} cm · H: ${selH} cm · Elev: ${selElev} cm`;
        } else if (!isSubRegion && this.mode === 'thickness') {
            statusText = `🧱 Thickness: ${wallT} cm (Baseline: ${this.initialThickness} cm) · 📏 Length: ${Math.round(wallLen)} cm`;
        } else {
            statusText = `📏 Width: ${selW} cm · Height: ${selH} cm · Elev: ${selElev} cm`;
        }

        const suite = this.ctx.interactions?.wallInteractiveSuite;
        if (suite && suite.confirmStatusBadge && (suite.activeMode === 'push_pull' || suite.activeMode === 'extrude_recess')) {
            suite.confirmStatusBadge.textContent = statusText;
            if (suite.domConfirmBar && this.ctx.renderer) {
                const dom = this.ctx.renderer.domElement;
                if (dom) {
                    const rect = dom.getBoundingClientRect();
                    const screenX = rect.left + rect.width / 2;
                    const screenY = rect.top + 24;
                    suite.domConfirmBar.style.left = `${screenX}px`;
                    suite.domConfirmBar.style.top = `${screenY}px`;
                    suite.domConfirmBar.style.transform = 'translate(-50%, 0)';
                    suite.domConfirmBar.style.display = 'flex';
                }
            }
            if (this.domConfirmBar) this.domConfirmBar.style.display = 'none';
            return;
        }

        if (!this.domConfirmBar || !this.ctx.renderer) return;
        const dom = this.ctx.renderer.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        const screenX = rect.left + rect.width / 2;
        const screenY = rect.top + 24;

        if (this.domBadge) this.domBadge.textContent = statusText;
        this.domConfirmBar.style.left = `${screenX}px`;
        this.domConfirmBar.style.top = `${screenY}px`;
        this.domConfirmBar.style.transform = 'translate(-50%, 0)';
        this.domConfirmBar.style.display = 'flex';
    }

    _onPointerDown(e) {
        if (!this.visible) return;
        if (e.button !== 0) return;
        
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        
        const allHandleMeshes = this._getAllHandleMeshes();
        const intersects = this.raycaster.intersectObjects(allHandleMeshes, true);
        
        if (intersects.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            
            let hitMesh = intersects[0].object;
            const originalHit = hitMesh;
            while (hitMesh && !hitMesh.userData.isWallPushPullHandle && hitMesh.parent) {
                hitMesh = hitMesh.parent;
            }
            
            const wall = this._getWallEntity();
            if (!wall) return;
            
            const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
            const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };
            this.initialStart = { x: p1.x, y: p1.y };
            this.initialEnd = { x: p2.x, y: p2.y };
            this.initialThickness = (wall.thickness !== undefined ? wall.thickness : (wall.config?.thickness || 20));
            this.initialStartT = this.tStart;
            this.initialEndT = this.tEnd;
            this.initialElevBottom = this.elevBottom;
            this.initialElevTop = this.elevTop;
            this.initialExtrudeDepth = this.currentExtrudeDepth || 0;
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);
            if (len === 0) return;

            const camDir = new THREE.Vector3();
            this.ctx.camera.getWorldDirection(camDir);

            const part = hitMesh?.userData?.part || originalHit?.userData?.part;
            const side = hitMesh?.userData?.side || originalHit?.userData?.side || (intersects[0]?.object?.parent?.userData?.side) || 'front';

            const hitPoint = intersects[0].point;
            const wallGroup = this._getWallGroup();
            if (wallGroup) {
                const invMat = new THREE.Matrix4().copy(wallGroup.matrixWorld).invert();
                this.dragStartLocal = hitPoint.clone().applyMatrix4(invMat);
            } else {
                this.dragStartLocal = hitPoint.clone();
            }

            if (part === 'boundary_start' || part === 'boundary_end') {
                this.activeHandle = part;
                this.selectionScope = 'subregion';
                const axisW = new THREE.Vector3(dx / len, 0, dy / len);
                const cross = new THREE.Vector3().crossVectors(camDir, axisW);
                if (cross.lengthSq() > 0.001) {
                    const planeNorm = new THREE.Vector3().crossVectors(axisW, cross).normalize();
                    this.dragPlane.setFromNormalAndCoplanarPoint(planeNorm, hitPoint);
                } else {
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hitPoint);
                }
                this.dragStartPoint.copy(hitPoint);
            } else if (part === 'boundary_bottom' || part === 'boundary_top') {
                this.activeHandle = part;
                this.selectionScope = 'subregion';
                const axisH = new THREE.Vector3(0, 1, 0);
                const cross = new THREE.Vector3().crossVectors(camDir, axisH);
                if (cross.lengthSq() > 0.001) {
                    const planeNorm = new THREE.Vector3().crossVectors(axisH, cross).normalize();
                    this.dragPlane.setFromNormalAndCoplanarPoint(planeNorm, hitPoint);
                } else {
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(camDir.x, 0, camDir.z).normalize(), hitPoint);
                }
                this.dragStartPoint.copy(hitPoint);
            } else if (part && part.startsWith('corner_')) {
                // 4 Circular Corner Handles (Simultaneous 2D Width & Height resizing)
                this.activeHandle = part;
                this.selectionScope = 'subregion';
                this.activeSide = side;
                this.activeFacing = side === 'back' ? -1 : 1;
                
                this.wallNormal2D = { x: -dy / len, y: dx / len };
                if (side === 'back') {
                    this.wallNormal2D.x *= -1;
                    this.wallNormal2D.y *= -1;
                }
                const axisN = new THREE.Vector3(this.wallNormal2D.x, 0, this.wallNormal2D.y);
                this.dragPlane.setFromNormalAndCoplanarPoint(axisN, hitPoint);
                this.dragStartPoint.copy(hitPoint);
            } else if (part === 'slide_center') {
                // 2D Pan / Move Area across wall face (Left/Right & Top/Bottom)
                this.activeHandle = 'slide_center';
                this.selectionScope = 'subregion';
                this.activeSide = side;
                this.activeFacing = side === 'back' ? -1 : 1;
                
                // Wall normal vector in 2D
                this.wallNormal2D = { x: -dy / len, y: dx / len };
                if (side === 'back') {
                    this.wallNormal2D.x *= -1;
                    this.wallNormal2D.y *= -1;
                }
                const axisN = new THREE.Vector3(this.wallNormal2D.x, 0, this.wallNormal2D.y);
                this.dragPlane.setFromNormalAndCoplanarPoint(axisN, hitPoint);
                this.dragStartPoint.copy(hitPoint);
            } else {
                this.activeHandle = side;
                this.activeSide = side;
                this.activeFacing = side === 'back' ? -1 : 1;
                this.currentDragDist = 0;
                
                const hitGroup = side === 'front' ? this.handleFront : this.handleBack;
                this._resetHandleMaterials();
                this._setGroupMaterial(hitGroup, this.matActive);
                
                // Wall normal vector in 2D
                this.wallNormal2D = { x: -dy / len, y: dx / len };
                if (side === 'back') {
                    this.wallNormal2D.x *= -1;
                    this.wallNormal2D.y *= -1;
                }
                
                const axisN = new THREE.Vector3(this.wallNormal2D.x, 0, this.wallNormal2D.y);
                const cross = new THREE.Vector3().crossVectors(camDir, axisN);
                if (cross.lengthSq() > 0.001) {
                    const planeNorm = new THREE.Vector3().crossVectors(axisN, cross).normalize();
                    this.dragPlane.setFromNormalAndCoplanarPoint(planeNorm, hitPoint);
                } else if (Math.abs(camDir.y) >= 0.2) {
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hitPoint);
                } else {
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(camDir.x, 0, camDir.z).normalize(), hitPoint);
                }
                this.dragStartPoint.copy(hitPoint);
            }
            
            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance || wall.planner;
            if (planner && planner.commandManager && typeof planner.exportState === 'function' && !this._snapshotCmd) {
                this._snapshotCmd = new SnapshotCommand(planner);
            }
            
            this.isDragging = true;
            this._capturedPointerId = e.pointerId;
            if (e.target && typeof e.target.setPointerCapture === 'function') {
                try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
            }
            if (this.ctx.controls) this.ctx.controls.enabled = false;
        } else {
            // Check if clicking directly on the wall surface to drag and select a new area in 3D
            const wall = this._getWallEntity();
            const wallGroup = this._getWallGroup();
            if (wall && wallGroup) {
                const wallIntersects = this.raycaster.intersectObject(wallGroup, true);
                if (wallIntersects.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

                    const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
                    const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const len = Math.hypot(dx, dy);
                    const wallH = wall.height !== undefined ? wall.height : (wall.config?.height || 120);
                    if (len === 0) return;

                    const hitPoint = wallIntersects[0].point;
                    const invMat = new THREE.Matrix4().copy(wallGroup.matrixWorld).invert();
                    const localHit = hitPoint.clone().applyMatrix4(invMat);
                    this.dragStartLocal = localHit.clone();

                    const downT = Math.max(0.0, Math.min(1.0, localHit.x / len));
                    const downElev = Math.max(0, Math.min(wallH, localHit.y));

                    this.activeHandle = 'marquee_select';
                    this.marqueeStartT = downT;
                    this.marqueeStartElev = downElev;
                    this.marqueeLen = len;
                    this.marqueeWallH = wallH;
                    this.tStart = Math.max(0.0, downT - 0.01);
                    this.tEnd = Math.min(1.0, downT + 0.01);
                    this.elevBottom = Math.max(0, downElev - 1);
                    this.elevTop = Math.min(wallH, downElev + 1);
                    this.selectionScope = 'subregion';
                    this.currentExtrudeDepth = 0;

                    this.wallNormal2D = { x: -dy / len, y: dx / len };
                    if (this.activeFacing === -1) {
                        this.wallNormal2D.x *= -1;
                        this.wallNormal2D.y *= -1;
                    }

                    const axisN = new THREE.Vector3(this.wallNormal2D.x, 0, this.wallNormal2D.y);
                    this.dragPlane.setFromNormalAndCoplanarPoint(axisN, hitPoint);
                    this.dragStartPoint.copy(hitPoint);

                    this.isDragging = true;
                    this._capturedPointerId = e.pointerId;
                    if (e.target && typeof e.target.setPointerCapture === 'function') {
                        try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
                    }
                    if (this.ctx.controls) this.ctx.controls.enabled = false;

                    this.updateHandles();
                    if (this.ctx.requestRender) this.ctx.requestRender();
                }
            }
        }
    }

    _updateWallAndSiblings(wall) {
        if (!wall) return;
        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance || wall.planner;

        const wallsToUpdate = new Set([wall]);
        if (planner && planner.walls) {
            const a1 = wall.startAnchor;
            const a2 = wall.endAnchor;
            planner.walls.forEach(w => {
                if (w !== wall && !w.hidden) {
                    if ((a1 && (w.startAnchor === a1 || w.endAnchor === a1)) ||
                        (a2 && (w.startAnchor === a2 || w.endAnchor === a2))) {
                        wallsToUpdate.add(w);
                    }
                }
            });
        }

        wallsToUpdate.forEach(w => {
            try {
                w.wallShapeData = null;
                if (w.update) w.update();
                if (w.attachedMoldings) {
                    w.attachedMoldings.forEach(m => {
                        if (m.update) m.update();
                    });
                }
                if (typeof this.ctx.updateWallGeometryLive === 'function') {
                    this.ctx.updateWallGeometryLive(w);
                }
            } catch(err) {
                console.warn('[WallPushPullGizmo] Live wall update err:', err);
            }
        });

        if (planner) {
            if (typeof planner.syncAll === 'function') planner.syncAll();
            if (planner.wallLayer && typeof planner.wallLayer.batchDraw === 'function') planner.wallLayer.batchDraw();
            if (planner.widgetLayer && typeof planner.widgetLayer.batchDraw === 'function') planner.widgetLayer.batchDraw();
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
                const wallGroup = this._getWallGroup();
                if (!wall || !wallGroup) return;

                const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
                const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.hypot(dx, dy);
                if (len === 0) return;

                const wallH = wall.height !== undefined ? wall.height : (wall.config?.height || 120);
                const dirX = dx / len;
                const dirZ = dy / len;
                const deltaWorldX = currentPoint.x - this.dragStartPoint.x;
                const deltaWorldZ = currentPoint.z - this.dragStartPoint.z;

                const invMat = new THREE.Matrix4().copy(wallGroup.matrixWorld).invert();
                const localCurrent = currentPoint.clone().applyMatrix4(invMat);
                const deltaLocalX = this.dragStartLocal ? (localCurrent.x - this.dragStartLocal.x) : (deltaWorldX * dirX + deltaWorldZ * dirZ);
                const deltaLocalY = this.dragStartLocal ? (localCurrent.y - this.dragStartLocal.y) : (currentPoint.y - this.dragStartPoint.y);

                const planner = this.ctx.planner || window.planner?.value || window.plannerInstance || wall.planner;

                if (this.activeHandle === 'marquee_select') {
                    // --- DRAG TO DRAW / SELECT 2D REGION RECTANGLE ON WALL SURFACE IN 3D ---
                    const mLen = this.marqueeLen || len;
                    const mWallH = this.marqueeWallH || wallH;

                    const currentT = Math.max(0.0, Math.min(1.0, localCurrent.x / mLen));
                    const currentElev = Math.max(0, Math.min(mWallH, localCurrent.y));

                    this.tStart = Math.round(Math.min(this.marqueeStartT, currentT) * 100) / 100;
                    this.tEnd = Math.round(Math.max(this.marqueeStartT, currentT) * 100) / 100;
                    this.elevBottom = Math.round(Math.min(this.marqueeStartElev, currentElev));
                    this.elevTop = Math.round(Math.max(this.marqueeStartElev, currentElev));

                    this.selectionScope = 'subregion';
                    this.updateHandles();
                } else if (this.activeHandle === 'boundary_start') {
                    // --- DRAG START BOUNDARY (Adjust Selected Width) ---
                    const deltaT = deltaLocalX / len;
                    const newStartT = Math.max(0.0, Math.min(this.initialEndT - 0.05, this.initialStartT + deltaT));
                    this.tStart = Math.round(newStartT * 100) / 100;
                    this.selectionScope = 'subregion';
                    this.updateHandles();
                } else if (this.activeHandle === 'boundary_end') {
                    // --- DRAG END BOUNDARY (Adjust Selected Width) ---
                    const deltaT = deltaLocalX / len;
                    const newEndT = Math.min(1.0, Math.max(this.initialStartT + 0.05, this.initialEndT + deltaT));
                    this.tEnd = Math.round(newEndT * 100) / 100;
                    this.selectionScope = 'subregion';
                    this.updateHandles();
                } else if (this.activeHandle === 'boundary_bottom') {
                    // --- DRAG BOTTOM BOUNDARY (Adjust Bottom Elevation from Floor) ---
                    const newElev = Math.max(0, Math.min(this.initialElevTop - 10, Math.round(this.initialElevBottom + deltaLocalY)));
                    this.elevBottom = newElev;
                    this.selectionScope = 'subregion';
                    this.updateHandles();
                } else if (this.activeHandle === 'boundary_top') {
                    // --- DRAG TOP BOUNDARY (Adjust Top Height Line) ---
                    const newTop = Math.min(wallH, Math.max(this.initialElevBottom + 10, Math.round(this.initialElevTop + deltaLocalY)));
                    this.elevTop = newTop;
                    this.selectionScope = 'subregion';
                    this.updateHandles();
                } else if (this.activeHandle === 'corner_bl') {
                    // --- DRAG BOTTOM-LEFT CORNER CIRCLE (Adjust Left Width & Bottom Elevation) ---
                    const deltaT = deltaLocalX / len;
                    const newStartT = Math.max(0.0, Math.min(this.initialEndT - 0.05, this.initialStartT + deltaT));
                    const newElev = Math.max(0, Math.min(this.initialElevTop - 10, Math.round(this.initialElevBottom + deltaLocalY)));
                    this.tStart = Math.round(newStartT * 100) / 100;
                    this.elevBottom = newElev;
                    this.selectionScope = 'subregion';
                    this.updateHandles();
                } else if (this.activeHandle === 'corner_br') {
                    // --- DRAG BOTTOM-RIGHT CORNER CIRCLE (Adjust Right Width & Bottom Elevation) ---
                    const deltaT = deltaLocalX / len;
                    const newEndT = Math.min(1.0, Math.max(this.initialStartT + 0.05, this.initialEndT + deltaT));
                    const newElev = Math.max(0, Math.min(this.initialElevTop - 10, Math.round(this.initialElevBottom + deltaLocalY)));
                    this.tEnd = Math.round(newEndT * 100) / 100;
                    this.elevBottom = newElev;
                    this.selectionScope = 'subregion';
                    this.updateHandles();
                } else if (this.activeHandle === 'corner_tl') {
                    // --- DRAG TOP-LEFT CORNER CIRCLE (Adjust Left Width & Top Height) ---
                    const deltaT = deltaLocalX / len;
                    const newStartT = Math.max(0.0, Math.min(this.initialEndT - 0.05, this.initialStartT + deltaT));
                    const newTop = Math.min(wallH, Math.max(this.initialElevBottom + 10, Math.round(this.initialElevTop + deltaLocalY)));
                    this.tStart = Math.round(newStartT * 100) / 100;
                    this.elevTop = newTop;
                    this.selectionScope = 'subregion';
                    this.updateHandles();
                } else if (this.activeHandle === 'corner_tr') {
                    // --- DRAG TOP-RIGHT CORNER CIRCLE (Adjust Right Width & Top Height) ---
                    const deltaT = deltaLocalX / len;
                    const newEndT = Math.min(1.0, Math.max(this.initialStartT + 0.05, this.initialEndT + deltaT));
                    const newTop = Math.min(wallH, Math.max(this.initialElevBottom + 10, Math.round(this.initialElevTop + deltaLocalY)));
                    this.tEnd = Math.round(newEndT * 100) / 100;
                    this.elevTop = newTop;
                    this.selectionScope = 'subregion';
                    this.updateHandles();
                } else if (this.activeHandle === 'slide_center') {
                    // --- DRAG 2D SELECTION BOX (Move Area across wall & elevation) ---
                    const deltaT = deltaLocalX / len;
                    const spanT = this.initialEndT - this.initialStartT;
                    let newStartT = this.initialStartT + deltaT;
                    newStartT = Math.max(0.0, Math.min(1.0 - spanT, newStartT));
                    let newEndT = newStartT + spanT;

                    const spanH = this.initialElevTop - this.initialElevBottom;
                    let newElevBottom = Math.round(this.initialElevBottom + deltaLocalY);
                    newElevBottom = Math.max(0, Math.min(wallH - spanH, newElevBottom));
                    let newElevTop = newElevBottom + spanH;

                    this.tStart = Math.round(newStartT * 100) / 100;
                    this.tEnd = Math.round(newEndT * 100) / 100;
                    this.elevBottom = newElevBottom;
                    this.elevTop = newElevTop;
                    this.selectionScope = 'subregion';
                    this.updateHandles();
                }

                if (this.existingProtrusion && this.activeHandle !== 'marquee_select' && this.activeHandle !== 'front' && this.activeHandle !== 'back') {
                    const selW = Math.max(10, Math.round(len * (this.tEnd - this.tStart)));
                    const selH = Math.max(10, Math.round(this.elevTop - this.elevBottom));
                    const selElev = Math.round(this.elevBottom);
                    const protT = (this.tStart + this.tEnd) / 2;
                    this.existingProtrusion.width = selW;
                    this.existingProtrusion.height = selH;
                    this.existingProtrusion.elevation = selElev;
                    this.existingProtrusion.t = protT;
                    this._updateWallAndSiblings(wall);
                    this.updateHandles();
                } else if (this.activeHandle === 'front' || this.activeHandle === 'back') {
                    // --- DRAG FACE PUSH / PULL (Depth: Outward Solid Block vs Inward Niche) ---
                    let dist = (deltaWorldX * this.wallNormal2D.x) + (deltaWorldZ * this.wallNormal2D.y);
                    const step = 1; // 1cm precision
                    this.currentDragDist = dist;

                    const isSubRegion = (this.selectionScope === 'subregion') || (this.tStart > 0.02 || this.tEnd < 0.98 || this.elevBottom > 2 || this.elevTop < (wallH - 2)) || !!this.existingProtrusion;

                    if (isSubRegion) {
                        // --- SUB-REGION ELEVATION PUSH / PULL (Freely Pull Solid Block & Push Back up to Wall Face) ---
                        const deltaD = Math.round(dist);
                        const minDepth = 0; // Push is strictly allowed back up to base wall face (0cm); no negative/red background
                        const newDepth = Math.max(minDepth, Math.round(this.initialExtrudeDepth + deltaD));
                        this.currentExtrudeDepth = newDepth;

                        if (this.existingProtrusion) {
                            this.existingProtrusion.depth = newDepth;
                            this._updateWallAndSiblings(wall);
                        }

                        this.updateHandles();
                    } else if (this.mode === 'baseline') {
                        // --- BASELINE MOVE MODE (Move whole wall perpendicularly via WallEngine) ---
                        const shiftDist = Math.round(dist / step) * step;
                        WallEngine.pushPull(wall, this.activeSide, shiftDist, {
                            mode: 'baseline',
                            initialStart: this.initialStart,
                            initialEnd: this.initialEnd
                        }, planner);

                        this._updateWallAndSiblings(wall);
                        if (typeof this.ctx.rebuildActiveFloors === 'function') {
                            try { this.ctx.rebuildActiveFloors(); } catch(err) {}
                        }

                        this.updateHandles();
                    } else {
                        // --- FULL WALL THICKNESS PUSH / PULL (Single-Sided: Pin Opposite Face via WallEngine) ---
                        const deltaThick = Math.round(dist / step) * step;
                        WallEngine.pushPull(wall, this.activeSide, deltaThick, {
                            mode: 'thickness',
                            initialThickness: this.initialThickness,
                            initialStart: this.initialStart,
                            initialEnd: this.initialEnd
                        }, planner);

                        this._updateWallAndSiblings(wall);
                        if (typeof this.ctx.rebuildActiveFloors === 'function') {
                            try { this.ctx.rebuildActiveFloors(); } catch(err) {}
                        }

                        this.updateHandles();
                    }
                }

                if (this.ctx.requestRender) this.ctx.requestRender();
            }
        } else {
            // Hover highlight
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
            const allHandleMeshes = this._getAllHandleMeshes();
            const intersects = this.raycaster.intersectObjects(allHandleMeshes, true);
            this._resetHandleMaterials();
            
            if (intersects.length > 0) {
                let hitMesh = intersects[0].object;
                const part = hitMesh?.userData?.part;
                if (part === 'boundary_start' || part === 'boundary_end') {
                    const group = part === 'boundary_start' ? this.startWidthHandle : this.endWidthHandle;
                    this._setHandleHover(group);
                    this.ctx.renderer.domElement.style.cursor = 'ew-resize';
                } else if (part === 'boundary_bottom' || part === 'boundary_top') {
                    const group = part === 'boundary_bottom' ? this.bottomHeightHandle : this.topHeightHandle;
                    this._setHandleHover(group);
                    this.ctx.renderer.domElement.style.cursor = 'ns-resize';
                } else if (part === 'corner_bl' || part === 'corner_tr') {
                    const group = part === 'corner_bl' ? this.cornerBL : this.cornerTR;
                    this._setHandleHover(group);
                    this.ctx.renderer.domElement.style.cursor = 'nesw-resize';
                } else if (part === 'corner_br' || part === 'corner_tl') {
                    const group = part === 'corner_br' ? this.cornerBR : this.cornerTL;
                    this._setHandleHover(group);
                    this.ctx.renderer.domElement.style.cursor = 'nwse-resize';
                } else if (part === 'slide_center') {
                    if (!hitMesh?.userData?.isSelectionPlane) {
                        this._setHandleHover(this.handleFront);
                        this._setHandleHover(this.handleBack);
                    }
                    this.ctx.renderer.domElement.style.cursor = 'move';
                } else {
                    const side = hitMesh?.userData?.side || (intersects[0].object.parent?.userData?.side);
                    const hitGroup = side === 'front' ? this.handleFront : (side === 'back' ? this.handleBack : null);
                    if (hitGroup) {
                        this._setHandleHover(hitGroup);
                    }
                    this.ctx.renderer.domElement.style.cursor = 'grab';
                }
            } else {
                const wallGroup = this._getWallGroup();
                if (wallGroup) {
                    const wallIntersects = this.raycaster.intersectObject(wallGroup, true);
                    if (wallIntersects.length > 0) {
                        this.ctx.renderer.domElement.style.cursor = 'crosshair';
                    } else {
                        this.ctx.renderer.domElement.style.cursor = 'auto';
                    }
                } else {
                    this.ctx.renderer.domElement.style.cursor = 'auto';
                }
            }
        }
    }

    _onPointerUp(e) {
        if (this.isDragging) {
            if (this.activeHandle === 'marquee_select') {
                const wall = this._getWallEntity();
                const wallH = wall ? (wall.height !== undefined ? wall.height : (wall.config?.height || 120)) : 120;
                const len = this.marqueeLen || 100;
                const spanW = (this.tEnd - this.tStart) * len;
                const spanH = this.elevTop - this.elevBottom;

                // If user just tapped/clicked on wall without dragging, create a neat 100cm box centered at the click point
                if (spanW < 15 || spanH < 15) {
                    const defaultW = Math.min(len * 0.5, 100);
                    const halfT = (defaultW / 2) / len;
                    const centerT = this.marqueeStartT;
                    this.tStart = Math.max(0.0, Math.round((centerT - halfT) * 100) / 100);
                    this.tEnd = Math.min(1.0, Math.round((centerT + halfT) * 100) / 100);

                    const defaultH = Math.min(wallH * 0.6, 100);
                    this.elevBottom = Math.max(0, Math.round(this.marqueeStartElev - defaultH / 2));
                    this.elevTop = Math.min(wallH, this.elevBottom + defaultH);
                }
                this.selectionScope = 'subregion';
                this.updateHandles();
            }

            this.isDragging = false;
            this.activeHandle = null;
            this._resetHandleMaterials();
            
            if (this._capturedPointerId !== null && e.target && typeof e.target.releasePointerCapture === 'function') {
                try { e.target.releasePointerCapture(this._capturedPointerId); } catch(err) {}
                this._capturedPointerId = null;
            }
            
            if (this.ctx.controls) this.ctx.controls.enabled = true;
            this.ctx.renderer.domElement.style.cursor = 'auto';
            
            this.updateHandles();
            if (this.ctx.requestRender) this.ctx.requestRender();
        }
    }

    /**
     * Step 3: Apply / Commit changes (triggered by ✓ Done button or Enter key)
     */
    commit() {
        const wall = this._getWallEntity();
        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        if (!wall) {
            this.detach();
            return;
        }

        const p1 = (wall.startAnchor && typeof wall.startAnchor.position === 'function') ? wall.startAnchor.position() : { x: wall.startX || 0, y: wall.startY || 0 };
        const p2 = (wall.endAnchor && typeof wall.endAnchor.position === 'function') ? wall.endAnchor.position() : { x: wall.endX || 0, y: wall.endY || 0 };
        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const wallH = wall.height !== undefined ? wall.height : (wall.config?.height || 120);

        const isSubRegion = (this.tStart > 0.02 || this.tEnd < 0.98 || this.elevBottom > 2 || this.elevTop < (wallH - 2)) || !!this.existingProtrusion;
        const extrudeD = this.currentExtrudeDepth || 0;

        if (this.existingProtrusion) {
            // Requirement 3 & 4: Re-adjust existing solid block in place without creating any separate walls
            const depthVal = Math.round(Math.abs(extrudeD));
            if (depthVal <= 0.5) {
                WallEngine.removeSolidProtrusion(wall, this.existingProtrusion, true, planner);
                this.existingProtrusion = null;
                this.currentExtrudeDepth = 0;
            } else {
                const newWidth = Math.max(10, Math.round(len * (this.tEnd - this.tStart)));
                const newHeight = Math.max(10, Math.round(this.elevTop - this.elevBottom));
                const newElev = Math.round(this.elevBottom);
                const newT = (this.tStart + this.tEnd) / 2;
                const newFacing = this.activeFacing || 1;

                WallEngine.updateSolidProtrusion(wall, this.existingProtrusion, {
                    depth: depthVal,
                    width: newWidth,
                    height: newHeight,
                    elevation: newElev,
                    t: newT,
                    facing: newFacing
                }, false, planner);
            }
            this.origProtrusionState = null;
            this._updateWallAndSiblings(wall);
        } else if (isSubRegion && Math.abs(extrudeD) >= 1) {
            const selW = Math.max(10, Math.round(len * (this.tEnd - this.tStart)));
            const selH = Math.max(10, Math.round(this.elevTop - this.elevBottom));
            const selElev = Math.round(this.elevBottom);
            const facing = this.activeFacing || 1;
            const protT = (this.tStart + this.tEnd) / 2;

            if (extrudeD > 0) {
                // Outward pull -> Solid Protrusion feature on existing host wall
                const depthVal = Math.round(extrudeD);
                let widgetObj = null;
                if (planner && planner.wallLayer && typeof advance_openings === 'function') {
                    try {
                        widgetObj = new advance_openings(planner, wall, protT, 'solid_protrusion');
                        widgetObj.width = selW;
                        widgetObj.height = selH;
                        widgetObj.elevation = selElev;
                        widgetObj.depth = depthVal;
                        widgetObj.facing = facing;
                        widgetObj.update();
                    } catch(e) {
                        widgetObj = null;
                    }
                }
                if (!widgetObj) {
                    widgetObj = WallEngine.addSolidProtrusion(wall, {
                        width: selW,
                        height: selH,
                        elevation: selElev,
                        depth: depthVal,
                        t: protT,
                        facing: facing
                    }, false, planner);
                } else {
                    WallEngine.attachWidget(wall, widgetObj, false, planner);
                }
            } else {
                // Inward push -> Architectural Niche
                const maxNicheDepth = Math.max(1, (wall.thickness || 20) - 3);
                const nicheDepth = Math.min(Math.round(Math.abs(extrudeD)), maxNicheDepth);
                let widgetObj = null;
                if (planner && planner.wallLayer && typeof advance_openings === 'function') {
                    try {
                        widgetObj = new advance_openings(planner, wall, protT, 'niche_recess');
                        widgetObj.width = selW;
                        widgetObj.height = selH;
                        widgetObj.elevation = selElev;
                        widgetObj.depth = nicheDepth;
                        widgetObj.facing = facing;
                        widgetObj.update();
                    } catch(e) {
                        widgetObj = null;
                    }
                }
                if (!widgetObj) {
                    widgetObj = {
                        id: 'niche_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                        type: 'niche_recess',
                        configId: 'niche_recess',
                        t: protT,
                        width: selW,
                        height: selH,
                        elevation: selElev,
                        depth: nicheDepth,
                        thick: (wall.thickness || 20),
                        facing: facing,
                        wall: wall
                    };
                }
                WallEngine.attachWidget(wall, widgetObj, false, planner);
            }

            this._updateWallAndSiblings(wall);
        } else {
            this._updateWallAndSiblings(wall);
        }

        if (planner) {
            if (typeof planner.findRooms === 'function') {
                try { planner.findRooms(); } catch(err) {}
            }
            if (typeof planner.syncAll === 'function') planner.syncAll();
        }
        if (typeof this.ctx.rebuildActiveFloors === 'function') {
            try { this.ctx.rebuildActiveFloors(); } catch(err) {}
        }
        if (planner && planner.commandManager && this._snapshotCmd) {
            if (typeof this._snapshotCmd.finalize === 'function') {
                this._snapshotCmd.finalize();
            }
            planner.commandManager.execute(this._snapshotCmd);
            this._snapshotCmd = null;
        }

        coreEventBus.emit(EVENTS.WALL_CHANGE, { entity: wall });
        
        if (this.ctx.interactions && this.ctx.interactions.gizmoManager) {
            try {
                this.ctx.interactions.gizmoManager.setTransformMode('select');
            } catch(e) {}
        }

        this.detach();
    }

    /**
     * Step 3: Cancel changes (triggered by ✕ Cancel button or Esc key)
     */
    cancel() {
        const wall = this._getWallEntity();
        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance || wall?.planner;
        if (this.existingProtrusion && this.origProtrusionState) {
            this.existingProtrusion.width = this.origProtrusionState.width;
            this.existingProtrusion.height = this.origProtrusionState.height;
            this.existingProtrusion.elevation = this.origProtrusionState.elevation;
            this.existingProtrusion.depth = this.origProtrusionState.depth;
            this.existingProtrusion.t = this.origProtrusionState.t;
            this.existingProtrusion.facing = this.origProtrusionState.facing;
            this.origProtrusionState = null;
            this._updateWallAndSiblings(wall);
        } else if (wall && this.initialThickness !== undefined && this.initialStart) {
            WallEngine.setThickness(wall, this.initialThickness, false, planner);
            WallEngine.setEndpoints(wall, this.initialStart, this.initialEnd, true, planner);
            this._updateWallAndSiblings(wall);
        }
        this.currentExtrudeDepth = 0;
        if (this.solidBlockPreview) this.solidBlockPreview.visible = false;
        if (this._snapshotCmd && this._snapshotCmd.undo) {
            try { this._snapshotCmd.undo(); } catch(e) {}
        }
        this._snapshotCmd = null;
        
        if (this.ctx.interactions && this.ctx.interactions.gizmoManager) {
            try {
                this.ctx.interactions.gizmoManager.setTransformMode('select');
            } catch(e) {}
        }
        
        this.detach();
    }

    dispose() {
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this._onKeyDown);
        }
        if (this.domConfirmBar && this.domConfirmBar.parentElement) {
            this.domConfirmBar.parentElement.removeChild(this.domConfirmBar);
        }
        if (this.domDimTop && this.domDimTop.parentElement) {
            this.domDimTop.parentElement.removeChild(this.domDimTop);
        }
        if (this.domDimBottom && this.domDimBottom.parentElement) {
            this.domDimBottom.parentElement.removeChild(this.domDimBottom);
        }
        if (this.domDimLeft && this.domDimLeft.parentElement) {
            this.domDimLeft.parentElement.removeChild(this.domDimLeft);
        }
        if (this.domDimRight && this.domDimRight.parentElement) {
            this.domDimRight.parentElement.removeChild(this.domDimRight);
        }
        this.detach();
    }
}

/**
 * UniversalMoveGizmo.js
 * Universal 3D Move & Translation System (CAD / Sims 4 Style).
 * 
 * Key Features:
 * 1. Adaptive 3D Ground Translation Pad with center planar grab disc, cardinal X/Z axes, and vertical Y handle.
 * 2. Click-and-drag anywhere on the object or gizmo for instant, smooth 60fps placement.
 * 3. 100% locked synchronization between object mesh, selection highlight, floor footprint, and dimension lines.
 * 4. Cross-platform pointer & touch raycasting with CAD magnetic grid snapping (1cm, 10cm, 50cm, Free).
 * 5. Ultra-sleek, compact, draggable Move HUD dock with 4-way precision D-Pad steppers, live XYZ inputs, and snap pills.
 * 6. Full in-place transformation and single-source-of-truth syncing across 2D/3D.
 */

import * as THREE from 'three';
import { ObjectCapabilityEvaluator } from './tools/ObjectCapabilityEvaluator.js';
import { WallEngine, isFloorAnchoredDoor } from '../wall/WallEngine.js';
import { StairHeightDetector } from '../../features/stairs/StairHeightDetector.js';
import { StairEngine } from '../stairs/StairEngine.js';
import { globalSpatialDependencyEngine } from '../spatial/SpatialDependencyEngine.js';
import { TransformEngine } from '../transform/TransformEngine.js';
import { coreEventBus } from '../EventBus.js';
import { WallCollisionEngine } from '../wall/WallCollisionEngine.js';
import { SnapEngine } from '../snap/SnapEngine.js';
import { VerticalPropagationEngine } from '../vertical/VerticalPropagationEngine.js';

export class UniversalMoveGizmo extends THREE.Group {
    /**
     * @param {Object} ctx - 3D Engine context (scene, camera, renderer, etc.)
     */
    constructor(ctx) {
        super();
        this.name = 'UniversalMoveGizmo';
        this.ctx = ctx;

        this.attachedObject = null;
        this.attachedEntity = null;

        // Interaction State
        this.isDragging = false;
        this.activeHandle = null; // 'center' | 'x' | 'z' | 'y'
        this.dragPlane = new THREE.Plane();
        this.startIntersection = new THREE.Vector3();
        this.startOrigin = new THREE.Vector3();
        this.startMeshPos = new THREE.Vector3();
        this.startGizmoPos = new THREE.Vector3();
        this.startEntityPosition = { x: 0, y: 0, z: 0, elevation: 0, t: 0.5 };
        this.snapMode = 10; // 10cm default CAD snap
        this.wallCollisionEnabled = true;
        this.wallSnapEnabled = true;
        this._activePointerId = null;

        // Visual Components
        this.gizmoVisuals = new THREE.Group();
        this.gizmoVisuals.name = 'UniversalMove_Visuals';
        this.add(this.gizmoVisuals);

        this.dynamicLeaderLine = null;

        // Materials (High visibility, non-clipping, crisp rendering)
        this.matCenter = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
        this.matCenterHover = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, side: THREE.DoubleSide });

        this.matAxisX = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }); // Coral Red
        this.matAxisZ = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }); // Sky Cyan
        this.matAxisY = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }); // Emerald Green

        this.matGuideLine = new THREE.LineDashedMaterial({ color: 0x00f0ff, dashSize: 4, gapSize: 3, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false });

        // Raycasting
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Luminous Move Mode & Styling state (Exact parity with placement)
        this.isMoveModeActive = false;
        this._isLuminousActive = false;
        this._savedMaterials = new Map();
        this._grabOffset = new THREE.Vector3(0, 0, 0);
        this._hasSetGrabOffset = false;
        this.luminousFootprintMesh = null;
        this.luminousFootprintMat = null;
        this.snapGuideMesh = null;
        this.snapGuideMat = null;
        this.apertureVoidMesh = null;
        this.apertureVoidMat = null;
        this.apertureEdgesMesh = null;
        this.apertureEdgeMat = null;

        // Build DOM Badges & HUD Panel
        this._createHUDPanel();

        // Event Listeners
        this._bindEvents();
    }

    /* -------------------------------------------------------------------------- */
    /*                               ATTACH & DETACH                              */
    /* -------------------------------------------------------------------------- */

    /**
     * Attaches Move Gizmo to target 3D object or entity.
     * @param {THREE.Object3D} targetObject
     */
    attach(targetObject) {
        if (!targetObject) return;

        // Resolve mesh and entity
        const entity = targetObject.userData?.entity || targetObject.userData?.parentWall || null;
        let mesh = targetObject.isMesh || targetObject.isGroup ? targetObject : (entity?.mesh3D || null);

        if (entity && entity.mesh3D && mesh !== entity.mesh3D) {
            mesh = entity.mesh3D;
        }

        if (!mesh) return;

        // Check movability capability
        const caps = ObjectCapabilityEvaluator.getCapabilities(entity, mesh);
        if (!caps.movable) {
            this.detach();
            return;
        }

        // Strict Scope Authority:
        // Centralized Move Gizmo ONLY attaches to GLB models, Furniture/Objects, Staircases, Shapes, and Rooms.
        // Dedicated systems (Doors, Windows, Roofs, Wall Plugins, Base Walls) MUST NOT use UniversalMoveGizmo.
        const entType = entity?.type || mesh.userData?.type || '';
        const isRoof = Boolean(mesh.userData?.isRoof || entType === 'roof' || entity?.config?.roofType);
        const isOpening = Boolean(mesh.userData?.isWidget || mesh.userData?.isOpening || ['door', 'window', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(entType));
        const isWallPlugin = Boolean(['sunshade', 'jali_panel', 'curtain', 'wall_art', 'elevation_fascia', 'molding'].includes(entType) || entType.startsWith('molding_') || entType.startsWith('sunshade_') || entType.startsWith('jali_') || entType.startsWith('curtain_') || entType.startsWith('decor_wall_'));
        const isSolidProtrusion = Boolean(mesh.userData?.isProtrusion || entType === 'solid_protrusion' || mesh.userData?.widget?.type === 'solid_protrusion');
        const isRoom = Boolean(mesh.userData?.isFloor || mesh.userData?.isRoomFloor || (entity && entity.path));
        const isBaseWall = !isRoom && Boolean(mesh.userData?.isWallSide || mesh.userData?.isWallMesh || ['outer', 'inner', 'compound', 'wall', 'wallDecor', 'arc'].includes(entType) || entity?.startX !== undefined);

        if (isRoof || isOpening || isWallPlugin || isSolidProtrusion || isBaseWall) {
            this.detach();
            return;
        }

        this.attachedObject = mesh;
        this.attachedEntity = entity;

        // Calculate world position & bounding box
        mesh.updateMatrixWorld(true);
        const bbox = new THREE.Box3().setFromObject(mesh);
        const center = new THREE.Vector3();
        if (!bbox.isEmpty() && isFinite(bbox.min.x)) {
            bbox.getCenter(center);
            this.position.set(center.x, bbox.min.y + 0.05, center.z);
        } else {
            this.position.set(mesh.position.x, mesh.position.y + 0.05, mesh.position.z);
        }

        this.startOrigin.copy(this.position);
        this.startMeshPos.copy(mesh.position);
        this.startGizmoPos.copy(this.position);

        if (entity) {
            this.startEntityPosition = {
                x: entity.x !== undefined ? Number(entity.x) : mesh.position.x,
                y: entity.y !== undefined ? Number(entity.y) : mesh.position.z,
                z: entity.elevation !== undefined ? Number(entity.elevation) : mesh.position.y,
                elevation: entity.elevation !== undefined ? Number(entity.elevation) : mesh.position.y,
                t: entity.t !== undefined ? entity.t : 0.5
            };
        }

        if (isRoom && entity) {
            this.isRoomMove = true;
            const planner = this.ctx.planner || window.planner?.value || window.planner || window.plannerInstance;
            const allWalls = planner?.walls?.filter(w => !w.hidden && w.type !== 'railing') || [];
            const suite = this.ctx.interactions?.roomInteractiveSuite;
            const matchedWalls = (suite && typeof suite._getRoomBoundingWalls === 'function')
                ? suite._getRoomBoundingWalls(entity)
                : allWalls.filter(w => {
                    const s = typeof w.startAnchor?.position === 'function' ? w.startAnchor.position() : (w.startAnchor || { x: w.startX, y: w.startY });
                    const e = typeof w.endAnchor?.position === 'function' ? w.endAnchor.position() : (w.endAnchor || { x: w.endX, y: w.endY });
                    return (entity.path || []).some(p => Math.hypot(p.x - s.x, p.y - s.y) < 2 || Math.hypot(p.x - e.x, p.y - e.y) < 2);
                });

            const anchorSet = new Set();
            matchedWalls.forEach(w => {
                if (w.startAnchor) anchorSet.add(w.startAnchor);
                if (w.endAnchor) anchorSet.add(w.endAnchor);
            });

            const rId = entity.id || entity._id;

            // Fix 6: Collect contained furniture, stairs, and shapes inside the room polygon
            const isPtInPoly = (pt, poly) => {
                if (!poly || poly.length < 3) return false;
                let inside = false;
                for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                    const xi = poly[i].x, yi = poly[i].y;
                    const xj = poly[j].x, yj = poly[j].y;
                    const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
                    if (intersect) inside = !inside;
                }
                return inside;
            };

            const roomPoly = entity.path || [];
            const containedList = [];
            const candidates = [
                ...(planner?.furniture || []),
                ...(planner?.stairs || []),
                ...(planner?.shapes || [])
            ];
            candidates.forEach(item => {
                if (item && isPtInPoly({ x: item.x, y: item.y }, roomPoly)) {
                    containedList.push({
                        entity: item,
                        startX: item.x,
                        startY: item.y
                    });
                }
            });

            this.roomMoveData = {
                room: entity,
                walls: matchedWalls,
                anchors: Array.from(anchorSet).map(a => {
                    const p = typeof a.position === 'function' ? a.position() : a;
                    return { anchor: a, startX: p.x, startY: p.y };
                }),
                platforms: (planner?.platforms || []).filter(p => p.associatedRoomId === rId).map(p => ({
                    platform: p,
                    startX: p.x,
                    startY: p.y
                })),
                containedEntities: containedList
            };
        } else {
            this.isRoomMove = false;
            this.roomMoveData = null;
        }

        // Build 3D Move Handles
        this._buildGizmoGeometry(bbox);
        this.gizmoVisuals.visible = true;

        this.visible = true;
        this.syncHUD();

        // SC Logic: Immediately enter luminous pick-and-move mode on attach
        this.startMoveMode();

        if (this.ctx.requestRender) this.ctx.requestRender('universal_move_attach');
    }

    /**
     * Detaches Move Gizmo and cleans up visual elements.
     */
    detach() {
        if (this.isMoveModeActive) {
            this.cancelMoveMode();
        } else if (this._isLuminousActive) {
            this._restoreOriginalMaterials();
        }
        this.attachedObject = null;
        this.attachedEntity = null;
        this.isDragging = false;
        this.activeHandle = null;
        this.visible = false;

        this._clearVisuals();
        this.hideHUD();

        if (this.ctx.requestRender) this.ctx.requestRender('universal_move_detach');
    }

    _clearVisuals() {
        while (this.gizmoVisuals.children.length > 0) {
            const child = this.gizmoVisuals.children[0];
            if (child.geometry) child.geometry.dispose();
            this.gizmoVisuals.remove(child);
        }
        if (this.dynamicLeaderLine && this.dynamicLeaderLine.parent) {
            this.dynamicLeaderLine.parent.remove(this.dynamicLeaderLine);
            this.dynamicLeaderLine.geometry.dispose();
            this.dynamicLeaderLine = null;
        }
        if (this.luminousFootprintMesh) {
            if (this.luminousFootprintMesh.parent) this.luminousFootprintMesh.parent.remove(this.luminousFootprintMesh);
            if (this.luminousFootprintMesh.geometry) this.luminousFootprintMesh.geometry.dispose();
            this.luminousFootprintMesh = null;
        }
        if (this.apertureVoidMesh) {
            if (this.apertureVoidMesh.parent) this.apertureVoidMesh.parent.remove(this.apertureVoidMesh);
            if (this.apertureVoidMesh.geometry) this.apertureVoidMesh.geometry.dispose();
            this.apertureVoidMesh = null;
        }
        if (this.apertureEdgesMesh) {
            if (this.apertureEdgesMesh.parent) this.apertureEdgesMesh.parent.remove(this.apertureEdgesMesh);
            if (this.apertureEdgesMesh.geometry) this.apertureEdgesMesh.geometry.dispose();
            this.apertureEdgesMesh = null;
        }
        if (this.snapGuideMesh) {
            if (this.snapGuideMesh.parent) this.snapGuideMesh.parent.remove(this.snapGuideMesh);
            if (this.snapGuideMesh.geometry) this.snapGuideMesh.geometry.dispose();
            this.snapGuideMesh = null;
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                         3D GIZMO GEOMETRY GENERATION                       */
    /* -------------------------------------------------------------------------- */

    _buildGizmoGeometry(bbox) {
        this._clearVisuals();

        let halfW = 20;
        let halfD = 20;
        if (bbox && !bbox.isEmpty() && isFinite(bbox.min.x)) {
            halfW = Math.max(14, (bbox.max.x - bbox.min.x) / 2);
            halfD = Math.max(14, (bbox.max.z - bbox.min.z) / 2);
        }

        // Synchronize Gizmo footprint rotation with object orientation
        const rotY = this.attachedObject?.rotation?.y || 0;
        this.gizmoVisuals.rotation.y = rotY;

        // 1. Shape-Accurate Floor Pad (Rounded Rectangle matching object physical footprint)
        const padMargin = 3;
        const w = halfW + padMargin;
        const d = halfD + padMargin;
        const cr = Math.max(2.5, Math.min(w, d) * 0.1);

        const padShape = new THREE.Shape();
        padShape.moveTo(-w + cr, -d);
        padShape.lineTo(w - cr, -d);
        padShape.quadraticCurveTo(w, -d, w, -d + cr);
        padShape.lineTo(w, d - cr);
        padShape.quadraticCurveTo(w, d, w - cr, d);
        padShape.lineTo(-w + cr, d);
        padShape.quadraticCurveTo(-w, d, -w, d - cr);
        padShape.lineTo(-w, -d + cr);
        padShape.quadraticCurveTo(-w, -d, -w + cr, -d);

        // Filled Translucent Planar Shape Base
        const shapeGeo = new THREE.ShapeGeometry(padShape);
        shapeGeo.rotateX(-Math.PI / 2);
        const basePad = new THREE.Mesh(shapeGeo, this.matCenter);
        basePad.position.y = 0.01;
        basePad.name = 'handle_center';
        basePad.renderOrder = 9998;
        this.gizmoVisuals.add(basePad);

        // Glowing Perimeter Border Line Contour
        const padPoints = padShape.getPoints(24);
        const perimeterPoints = padPoints.map(p => new THREE.Vector3(p.x, 0.02, p.y));
        if (perimeterPoints.length > 0) perimeterPoints.push(perimeterPoints[0].clone());
        const borderGeo = new THREE.BufferGeometry().setFromPoints(perimeterPoints);
        const borderLine = new THREE.Line(borderGeo, this.matAxisZ);
        borderLine.name = 'handle_center';
        borderLine.renderOrder = 9999;
        this.gizmoVisuals.add(borderLine);

        // 2. 4 Precision CAD Corner L-Brackets at the True Shape Vertices
        const tick = Math.min(w * 0.25, d * 0.25, 10);
        const cornerPoints = [
            // Top-left corner bracket
            new THREE.Vector3(-w + tick, 0.03, -d), new THREE.Vector3(-w, 0.03, -d),
            new THREE.Vector3(-w, 0.03, -d), new THREE.Vector3(-w, 0.03, -d + tick),

            // Top-right corner bracket
            new THREE.Vector3(w - tick, 0.03, -d), new THREE.Vector3(w, 0.03, -d),
            new THREE.Vector3(w, 0.03, -d), new THREE.Vector3(w, 0.03, -d + tick),

            // Bottom-right corner bracket
            new THREE.Vector3(w - tick, 0.03, d), new THREE.Vector3(w, 0.03, d),
            new THREE.Vector3(w, 0.03, d), new THREE.Vector3(w, 0.03, d - tick),

            // Bottom-left corner bracket
            new THREE.Vector3(-w + tick, 0.03, d), new THREE.Vector3(-w, 0.03, d),
            new THREE.Vector3(-w, 0.03, d), new THREE.Vector3(-w, 0.03, d - tick),
        ];
        const cornerGeo = new THREE.BufferGeometry().setFromPoints(cornerPoints);
        const cornerMesh = new THREE.LineSegments(cornerGeo, this.matAxisZ);
        cornerMesh.name = 'handle_center';
        cornerMesh.renderOrder = 9999;
        this.gizmoVisuals.add(cornerMesh);

        // 3. 4 Directional Chevron Translation Handles at the Outer Edges of the Shape
        const arrowW = Math.max(3, Math.min(w, d) * 0.16);
        const arrowLen = Math.max(5, Math.min(w, d) * 0.24);

        const createEdgeArrow = (posX, posZ, angle, name, mat) => {
            const arrowShape = new THREE.Shape();
            arrowShape.moveTo(0, arrowLen);
            arrowShape.lineTo(arrowW, 0);
            arrowShape.lineTo(arrowW * 0.35, 0);
            arrowShape.lineTo(arrowW * 0.35, -arrowLen * 0.35);
            arrowShape.lineTo(-arrowW * 0.35, -arrowLen * 0.35);
            arrowShape.lineTo(-arrowW * 0.35, 0);
            arrowShape.lineTo(-arrowW, 0);
            arrowShape.closePath();

            const aGeo = new THREE.ShapeGeometry(arrowShape);
            aGeo.rotateX(-Math.PI / 2);
            aGeo.rotateY(angle);

            const arrowMesh = new THREE.Mesh(aGeo, mat);
            arrowMesh.position.set(posX, 0.035, posZ);
            arrowMesh.name = name;
            arrowMesh.renderOrder = 9999;
            return arrowMesh;
        };

        // +X (East Edge) & -X (West Edge)
        this.gizmoVisuals.add(createEdgeArrow(w + 2, 0, Math.PI / 2, 'handle_x', this.matAxisX));
        this.gizmoVisuals.add(createEdgeArrow(-w - 2, 0, -Math.PI / 2, 'handle_x', this.matAxisX));

        // +Z (North Edge) & -Z (South Edge)
        this.gizmoVisuals.add(createEdgeArrow(0, d + 2, 0, 'handle_z', this.matAxisZ));
        this.gizmoVisuals.add(createEdgeArrow(0, -d - 2, Math.PI, 'handle_z', this.matAxisZ));

        // 4. Subtle Vertical Y Elevation Cone (Only if entity supports vertical elevation, doors are strictly floor-anchored)
        const isDoor = isFloorAnchoredDoor(this.attachedEntity);
        const supportsElevation = !isDoor && (this.attachedEntity?.elevation !== undefined || this.attachedEntity?.wall);
        if (supportsElevation) {
            const yHeight = Math.max(w, d) * 0.8;
            const yLineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0.05, 0),
                new THREE.Vector3(0, yHeight, 0)
            ]);
            const yLine = new THREE.Line(yLineGeo, this.matAxisY);
            yLine.renderOrder = 9998;
            this.gizmoVisuals.add(yLine);

            const coneGeo = new THREE.ConeGeometry(arrowW * 0.7, arrowLen, 16);
            const coneMesh = new THREE.Mesh(coneGeo, this.matAxisY);
            coneMesh.position.set(0, yHeight, 0);
            coneMesh.name = 'handle_y';
            coneMesh.renderOrder = 9999;
            this.gizmoVisuals.add(coneMesh);
        }

        this.gizmoVisuals.visible = true;
    }

    /* -------------------------------------------------------------------------- */
    /*                         LUMINOUS MOVE & STYLING ENGINE                     */
    /* -------------------------------------------------------------------------- */

    _applyLuminousHighlight(object) {
        if (!object || this._isLuminousActive) return;
        this._isLuminousActive = true;
        this._savedMaterials = new Map();

        // 1. Check if wall plugin / opening
        const ent = this.attachedEntity;
        if (ent && ent.wall && ent.wall.mesh3D) {
            this._updateApertureHighlight();
        }

        // 2. Apply Sims 4 glowing cyan holographic highlight to actual 3D model meshes
        object.traverse(c => {
            if (c.isMesh && !c.userData?.isHitbox && c.material && c.material.visible !== false) {
                this._savedMaterials.set(c, c.material);
                const ghostMat = new THREE.MeshStandardMaterial({
                    color: 0x38bdf8,
                    transparent: true,
                    opacity: 0.88,
                    roughness: 0.3,
                    metalness: 0.1,
                    side: THREE.DoubleSide
                });
                if (ghostMat.emissive) {
                    ghostMat.emissive.setHex(0x0284c7);
                    ghostMat.emissiveIntensity = 0.5;
                }
                    c.material = ghostMat;
            }
        });

        // 3. Show luminous cyan floor footprint
        this._updateLuminousFootprint();

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender('luminous_highlight_applied');
        }
    }

    _restoreOriginalMaterials() {
        if (!this._isLuminousActive) return;
        this._isLuminousActive = false;

        if (this._savedMaterials) {
            this._savedMaterials.forEach((origMat, mesh) => {
                if (mesh) {
                    if (mesh.material) {
                        if (Array.isArray(mesh.material)) {
                            mesh.material.forEach(m => m && m.dispose && m.dispose());
                        } else if (mesh.material.dispose) {
                            mesh.material.dispose();
                        }
                    }
                    mesh.material = origMat;
                }
            });
            this._savedMaterials.clear();
        }

        if (this.luminousFootprintMesh) {
            this.luminousFootprintMesh.visible = false;
        }
        if (this.apertureVoidMesh) {
            this.apertureVoidMesh.visible = false;
        }
        if (this.apertureEdgesMesh) {
            this.apertureEdgesMesh.visible = false;
        }
        if (this.snapGuideMesh) {
            this.snapGuideMesh.visible = false;
        }

        if (this.ctx.interactions?.highlightRenderer && this.attachedObject) {
            this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
        }
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender('luminous_materials_restored');
        }
    }

    _updateLuminousFootprint() {
        if (!this.attachedObject) return;

        if (!this.luminousFootprintMesh) {
            this.luminousFootprintMat = new THREE.LineBasicMaterial({
                color: 0x00f0ff,
                linewidth: 2.5,
                depthTest: false,
                transparent: true,
                opacity: 0.95
            });
            this.luminousFootprintMesh = new THREE.LineSegments(new THREE.BufferGeometry(), this.luminousFootprintMat);
            this.luminousFootprintMesh.renderOrder = 1008;
            this.luminousFootprintMesh.raycast = () => {};
            this.ctx.scene.add(this.luminousFootprintMesh);
        }

        const ent = this.attachedEntity;
        const mesh = this.attachedObject;
        mesh.updateMatrixWorld(true);
        const bbox = new THREE.Box3().setFromObject(mesh);
        if (bbox.isEmpty() || !isFinite(bbox.min.x)) {
            this.luminousFootprintMesh.visible = false;
            return;
        }

        let linePoints = null;
        const isStair = Boolean(
            ent?.type === 'staircase' ||
            (typeof ent?.type === 'string' && ent.type.startsWith('stair')) ||
            ent?.constructor?.name === 'PremiumStaircase'
        );
        if (isStair) {
            const pts = StairEngine.getCutoutPolygon(ent);
            if (pts && pts.length >= 3) {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                pts.forEach(p => {
                    if (p.x < minX) minX = p.x;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.y > maxY) maxY = p.y;
                });
                const cx = (minX + maxX) / 2;
                const cz = (minY + maxY) / 2;
                linePoints = [];
                for (let i = 0; i < pts.length; i++) {
                    const p1 = pts[i];
                    const p2 = pts[(i + 1) % pts.length];
                    linePoints.push(new THREE.Vector3(p1.x - cx, 0.5, p1.y - cz));
                    linePoints.push(new THREE.Vector3(p2.x - cx, 0.5, p2.y - cz));
                }
            }
        }

        if (!linePoints) {
            const width = Number(ent?.width) || (bbox.max.x - bbox.min.x);
            const depth = Number(ent?.depth || ent?.length) || (bbox.max.z - bbox.min.z);
            const halfW = width / 2;
            const halfD = depth / 2;

            linePoints = [
                new THREE.Vector3(-halfW, 0.5, -halfD),
                new THREE.Vector3(halfW, 0.5, -halfD),
                new THREE.Vector3(halfW, 0.5, -halfD),
                new THREE.Vector3(halfW, 0.5, halfD),
                new THREE.Vector3(halfW, 0.5, halfD),
                new THREE.Vector3(-halfW, 0.5, halfD),
                new THREE.Vector3(-halfW, 0.5, halfD),
                new THREE.Vector3(-halfW, 0.5, -halfD)
            ];
        }

        if (this.luminousFootprintMesh.geometry) this.luminousFootprintMesh.geometry.dispose();
        this.luminousFootprintMesh.geometry = new THREE.BufferGeometry().setFromPoints(linePoints);

        const groundY = bbox.min.y;
        this.luminousFootprintMesh.position.set(this.position.x, groundY, this.position.z);
        this.luminousFootprintMesh.rotation.y = mesh.rotation.y;
        this.luminousFootprintMesh.visible = false;
    }

    _updateApertureHighlight() {
        const ent = this.attachedEntity;
        if (!ent || !ent.wall || !ent.wall.mesh3D) return;

        if (!this.apertureVoidMesh) {
            this.apertureVoidMat = new THREE.MeshBasicMaterial({
                color: 0x00f0ff,
                transparent: true,
                opacity: 0.28,
                depthTest: false,
                side: THREE.DoubleSide
            });
            this.apertureVoidMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.apertureVoidMat);
            this.apertureVoidMesh.renderOrder = 1005;
            this.apertureVoidMesh.raycast = () => {};
            this.ctx.scene.add(this.apertureVoidMesh);

            this.apertureEdgeMat = new THREE.LineBasicMaterial({
                color: 0x00f0ff,
                linewidth: 2,
                depthTest: false,
                transparent: true,
                opacity: 0.95
            });
            this.apertureEdgesMesh = new THREE.LineSegments(new THREE.BufferGeometry(), this.apertureEdgeMat);
            this.apertureEdgesMesh.renderOrder = 1006;
            this.apertureEdgesMesh.raycast = () => {};
            this.ctx.scene.add(this.apertureEdgesMesh);
        }

        const w = Number(ent.width) || 80;
        const h = Number(ent.height) || (ent.type === 'door' ? 210 : 120);
        const wallThick = Number(ent.wall.thickness) || 20;

        // Position void box centered at opening
        this.attachedObject.updateMatrixWorld(true);
        const center = new THREE.Vector3();
        this.attachedObject.getWorldPosition(center);

        this.apertureVoidMesh.geometry.dispose();
        this.apertureVoidMesh.geometry = new THREE.BoxGeometry(w, h, wallThick + 4);
        this.apertureVoidMesh.position.set(center.x, center.y + h / 2, center.z);
        this.apertureVoidMesh.rotation.copy(this.attachedObject.rotation);
        this.apertureVoidMesh.visible = true;

        const edgeGeo = new THREE.EdgesGeometry(this.apertureVoidMesh.geometry);
        if (this.apertureEdgesMesh.geometry) this.apertureEdgesMesh.geometry.dispose();
        this.apertureEdgesMesh.geometry = edgeGeo;
        this.apertureEdgesMesh.position.copy(this.apertureVoidMesh.position);
        this.apertureEdgesMesh.rotation.copy(this.apertureVoidMesh.rotation);
        this.apertureEdgesMesh.visible = true;
    }

    _updateSnapGuideLine(segment, elev = 0) {
        if (!this.snapGuideMesh) {
            this.snapGuideMat = new THREE.LineBasicMaterial({
                color: 0x10b981,
                linewidth: 3,
                depthTest: false,
                transparent: true,
                opacity: 0.95
            });
            this.snapGuideMesh = new THREE.LineSegments(new THREE.BufferGeometry(), this.snapGuideMat);
            this.snapGuideMesh.name = 'UniversalMoveGizmo_SnapGuide';
            this.snapGuideMesh.renderOrder = 1010;
            this.snapGuideMesh.raycast = () => {};
            this.snapGuideMesh.visible = false;
            if (this.ctx?.scene?.add) {
                this.ctx.scene.add(this.snapGuideMesh);
            }
        }

        if (!segment || !segment.p1 || !segment.p2) {
            this.snapGuideMesh.visible = false;
            return;
        }

        const p1 = segment.p1;
        const p2 = segment.p2;
        const y = (elev || 0) + 0.3;

        const vertices = new Float32Array([
            p1.x, y, (p1.z !== undefined ? p1.z : p1.y),
            p2.x, y, (p2.z !== undefined ? p2.z : p2.y)
        ]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        if (this.snapGuideMesh.geometry) this.snapGuideMesh.geometry.dispose();
        this.snapGuideMesh.geometry = geo;
        this.snapGuideMesh.visible = true;
    }

    _raycastFloor(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return null;
        const rect = dom.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            return null;
        }
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        const elev = this.attachedEntity?.elevation !== undefined ? Number(this.attachedEntity.elevation) : 0;
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elev);
        const hitPoint = new THREE.Vector3();
        if (!this.raycaster.ray.intersectPlane(floorPlane, hitPoint)) return null;

        const isFine = e.shiftKey;
        const gridStep = this.snapMode === 0 || isFine ? 1 : this.snapMode;
        const snapped = SnapEngine.snapToGrid({ x: hitPoint.x, z: hitPoint.z }, gridStep);
        const snappedX = snapped.x !== undefined ? snapped.x : hitPoint.x;
        const snappedZ = snapped.z !== undefined ? snapped.z : hitPoint.z;

        const planner = this.ctx.planner || (this.ctx.appState && this.ctx.appState.planner) || window.planner?.value || window.planner;
        let targetElev = elev;
        let hostPlatformId = null;
        if (planner && planner.platforms) {
            for (const p of planner.platforms) {
                if (VerticalPropagationEngine.isPointInPlatform(snappedX, snappedZ, p)) {
                    const pTop = (Number(p.elevation) || 0) + (Number(p.height) > 0 ? Number(p.height) : 0);
                    targetElev = pTop;
                    hostPlatformId = p.id;
                    break;
                }
            }
        }

        return {
            x: snappedX,
            z: snappedZ,
            elev: targetElev,
            hostPlatformId
        };
    }

    _isHitOnFootprint(e) {
        if (!this.attachedObject) return false;
        const floor = this._raycastFloor(e);
        if (!floor) return false;

        const curX = this.position.x;
        const curZ = this.position.z;
        const rotY = this.attachedObject.rotation?.y || 0;

        const dx = floor.x - curX;
        const dz = floor.z - curZ;
        const cos = Math.cos(rotY);
        const sin = Math.sin(rotY);
        const localX = dx * cos + dz * sin;
        const localZ = -dx * sin + dz * cos;

        const bbox = new THREE.Box3().setFromObject(this.attachedObject);
        const halfW = (!bbox.isEmpty() && isFinite(bbox.min.x)) ? Math.max(20, (bbox.max.x - bbox.min.x) / 2 + 15) : 35;
        const halfD = (!bbox.isEmpty() && isFinite(bbox.min.x)) ? Math.max(20, (bbox.max.z - bbox.min.z) / 2 + 15) : 35;

        return Math.abs(localX) <= halfW && Math.abs(localZ) <= halfD;
    }

    startMoveMode(initialPointerEvent = null) {
        if (!this.attachedObject || !this.attachedEntity) return;
        if (this.isMoveModeActive) return; // Idempotent: already in SC move mode
        this.isMoveModeActive = true;

        const ent = this.attachedEntity;
        this.startOrigin.copy(this.position);
        this.startMeshPos.copy(this.attachedObject.position);
        this.startGizmoPos.copy(this.position);

        this.startEntityPosition = {
            x: ent.x !== undefined ? Number(ent.x) : this.startMeshPos.x,
            y: ent.y !== undefined ? Number(ent.y) : this.startMeshPos.z,
            z: ent.elevation !== undefined ? Number(ent.elevation) : this.startMeshPos.y,
            elevation: ent.elevation !== undefined ? Number(ent.elevation) : this.startMeshPos.y,
            t: ent.t !== undefined ? ent.t : 0.5,
            rotation: ent.rotation !== undefined ? Number(ent.rotation) : 0
        };

        if (!TransformEngine.isSessionActive() && !this.isRoomMove) {
            TransformEngine.startSession(ent, 'move');
        }

        // Apply Sims 4 luminous holographic styling
        this._applyLuminousHighlight(this.attachedObject);

        // Compute grab offset if pointer event available
        if (initialPointerEvent) {
            const floor = this._raycastFloor(initialPointerEvent);
            if (floor) {
                this._grabOffset.set(
                    this.startMeshPos.x - floor.x,
                    0,
                    this.startMeshPos.z - floor.z
                );
                this._hasSetGrabOffset = true;
            } else {
                this._grabOffset.set(0, 0, 0);
                this._hasSetGrabOffset = false;
            }
        } else {
            this._grabOffset.set(0, 0, 0);
            this._hasSetGrabOffset = false;
        }

        // Update HUD
        if (coreEventBus) {
            coreEventBus.emit('InteractionStateChanged', {
                state: 'ACTION_ACTIVE',
                activeAction: 'move',
                hudMode: 'action_minimal',
                selectedEntity: ent
            });
            coreEventBus.emit('UniversalMoveChanged', {
                x: Math.round(this.startEntityPosition.x),
                z: Math.round(this.startEntityPosition.y),
                rotation: this.startEntityPosition.rotation,
                wallSnap: this.wallSnapEnabled,
                snapMode: this.snapMode
            });
        }

        // Show DOM HUD panel (coordinate inputs, D-pad, snap pills)
        this.showHUD();

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender('start_move_mode');
        }
    }

    commitMoveMode() {
        if (!this.isMoveModeActive && !this.isDragging) return;
        this.isMoveModeActive = false;
        this.isDragging = false;
        this.activeHandle = null;
        this._hasSetGrabOffset = false;

        this._restoreOriginalMaterials();
        this._commitTranslationToPlanner();

        if (this.dynamicLeaderLine && this.dynamicLeaderLine.parent) {
            this.dynamicLeaderLine.parent.remove(this.dynamicLeaderLine);
        }

        if (this.ctx.controls) this.ctx.controls.enabled = true;
        if (this.ctx.cameraController?.controls) this.ctx.cameraController.controls.enabled = true;
        if (this.ctx.cameraController && typeof this.ctx.cameraController.enableOrbit === 'function') {
            this.ctx.cameraController.enableOrbit();
        }

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender('commit_move_mode');
        }
    }

    cancelMoveMode() {
        if (!this.isMoveModeActive && !this.isDragging) return;
        this.isMoveModeActive = false;
        this.isDragging = false;
        this.activeHandle = null;
        this._hasSetGrabOffset = false;

        // Revert entity to starting position
        const ent = this.attachedEntity;
        if (ent && this.startEntityPosition) {
            if (TransformEngine.isSessionActive()) {
                TransformEngine.cancelSession();
            }

            if (ent.wall && ent.wall.mesh3D) {
                ent.t = this.startEntityPosition.t;
                ent.elevation = this.startEntityPosition.elevation;
                if (this.ctx.realtimeUpdate) this.ctx.realtimeUpdate.markDirty(ent, 'geometry');
            } else {
                ent.x = this.startEntityPosition.x;
                ent.y = this.startEntityPosition.y;
                if (this.startEntityPosition.elevation !== undefined) {
                    ent.elevation = this.startEntityPosition.elevation;
                }
                if (this.startEntityPosition.rotation !== undefined) {
                    ent.rotation = this.startEntityPosition.rotation;
                }
                if (this.attachedObject) {
                    this.attachedObject.position.set(this.startEntityPosition.x, this.startEntityPosition.elevation || 0, this.startEntityPosition.y);
                    if (this.startEntityPosition.rotation !== undefined) {
                        this.attachedObject.rotation.y = -(this.startEntityPosition.rotation * Math.PI / 180);
                    }
                    this.attachedObject.updateMatrixWorld(true);
                }
                if (this.ctx.realtimeUpdate) this.ctx.realtimeUpdate.markDirty(ent, 'transform');
            }

            this.position.copy(this.startGizmoPos);
        }

        this._restoreOriginalMaterials();

        if (this.dynamicLeaderLine && this.dynamicLeaderLine.parent) {
            this.dynamicLeaderLine.parent.remove(this.dynamicLeaderLine);
        }

        if (this.ctx.controls) this.ctx.controls.enabled = true;
        if (this.ctx.cameraController?.controls) this.ctx.cameraController.controls.enabled = true;
        if (this.ctx.cameraController && typeof this.ctx.cameraController.enableOrbit === 'function') {
            this.ctx.cameraController.enableOrbit();
        }

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender('cancel_move_mode');
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                         CROSS-PLATFORM POINTER EVENTS                      */
    /* -------------------------------------------------------------------------- */

    _bindEvents() {
        const dom = this.ctx.renderer?.domElement || window;

        this._onPointerDown = (e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') {
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                return;
            }
            if (this.ctx.viewMode3D === 'preview') return;
            if (!this.visible || !this.attachedObject) return;

            // Don't drag if clicking on HUD/toolbar elements
            if (e.target && (e.target.closest?.('.contextual-action-hud-container') || e.target.closest?.('.action-hud-card') || e.target.closest?.('.universal-move-hud-panel') || e.target.closest?.('.common-toolbar-3d') || e.target.closest?.('.sims4-staircase-3d-hud'))) {
                return;
            }

            this._updateMouseCoords(e);
            this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

            let handleName = null;

            // 1. Check Gizmo Handles
            if (this.gizmoVisuals.children.length > 0) {
                const gizmoIntersects = this.raycaster.intersectObjects(this.gizmoVisuals.children, true);
                if (gizmoIntersects.length > 0) {
                    handleName = gizmoIntersects[0].object.name;
                }
            }

            // 2. Check if clicked anywhere on the currently Attached Object
            if (!handleName && this.attachedObject) {
                const objIntersects = this.raycaster.intersectObject(this.attachedObject, true);
                if (objIntersects.length > 0) {
                    handleName = 'handle_center';
                }
            }

            // 3. Fallback: Check floor footprint hit (especially helpful on touch devices & ghost models)
            if (!handleName && this._isHitOnFootprint(e)) {
                handleName = 'handle_center';
            }

            if (handleName && this.attachedObject) {
                this.isDragging = true;
                this.activeHandle = handleName.replace('handle_', ''); // 'center' | 'x' | 'z' | 'y'

                // Disable camera controls immediately during object translation
                if (this.ctx.controls) this.ctx.controls.enabled = false;
                if (this.ctx.cameraController?.controls) this.ctx.cameraController.controls.enabled = false;
                if (this.ctx.cameraController && typeof this.ctx.cameraController.disableOrbit === 'function') {
                    this.ctx.cameraController.disableOrbit();
                }

                // Compute initial intersection plane & grab offset
                const floor = this._raycastFloor(e);
                if (floor) {
                    this._grabOffset.set(
                        this.startMeshPos.x - floor.x,
                        0,
                        this.startMeshPos.z - floor.z
                    );
                    this._hasSetGrabOffset = true;
                }
                if (this.ctx.renderer?.domElement) {
                    this.ctx.renderer.domElement.style.cursor = 'grabbing';
                }
                e.stopPropagation();
            } else {
                // Clicked outside gizmo and object: camera orbit remains enabled, DO NOT drag, DO NOT drop/commit!
                this.isDragging = false;
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                if (this.ctx.cameraController?.controls) this.ctx.cameraController.controls.enabled = true;
                if (this.ctx.cameraController && typeof this.ctx.cameraController.enableOrbit === 'function') {
                    this.ctx.cameraController.enableOrbit();
                }
            }
        };

        this._onPointerMove = (e) => {
            if (this.ctx.viewMode3D === 'preview') return;
            this._updateMouseCoords(e);

            if (!this.isDragging) {
                // Update cursor when hovering over gizmo or object
                this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
                const hasHover = (this.gizmoVisuals.children.length > 0 && this.raycaster.intersectObjects(this.gizmoVisuals.children, true).length > 0) ||
                                 (this.attachedObject && this.raycaster.intersectObject(this.attachedObject, true).length > 0) ||
                                 this._isHitOnFootprint(e);
                if (this.ctx.renderer?.domElement) {
                    this.ctx.renderer.domElement.style.cursor = hasHover ? 'grab' : 'auto';
                }
                return;
            }

            // Actively dragging!
            if (this.ctx.renderer?.domElement) {
                this.ctx.renderer.domElement.style.cursor = 'grabbing';
            }

            const floor = this._raycastFloor(e);
            if (floor && this.attachedObject) {
                let targetX = floor.x + this._grabOffset.x;
                let targetZ = floor.z + this._grabOffset.z;

                if (this.activeHandle === 'x') {
                    targetZ = this.startMeshPos.z;
                } else if (this.activeHandle === 'z') {
                    targetX = this.startMeshPos.x;
                }

                const delta = new THREE.Vector3(
                    targetX - this.startMeshPos.x,
                    (floor.elev !== undefined ? (floor.elev - this.startMeshPos.y) : 0),
                    targetZ - this.startMeshPos.z
                );

                this._applyTranslation(delta, { x: targetX, z: targetZ, elev: floor.elev, hostPlatformId: floor.hostPlatformId });
                this._updateLeaderLine(this.startGizmoPos, this.position);
                this.syncHUD();

                if (this.ctx.interactions?.highlightRenderer) {
                    this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
                }
                if (this.ctx.interactions?._updateSims4Footprint) {
                    this.ctx.interactions._updateSims4Footprint(this.attachedObject);
                }
                if (this.ctx.interactions?.dimensionManager) {
                    this.ctx.interactions.dimensionManager.update();
                }

                if (this.ctx.requestRender) this.ctx.requestRender('universal_move_drag');
            }
        };

        this._onPointerUp = (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                this.activeHandle = null;

                // Re-enable camera controls
                if (this.ctx.controls) this.ctx.controls.enabled = true;
                if (this.ctx.cameraController?.controls) this.ctx.cameraController.controls.enabled = true;
                if (this.ctx.cameraController && typeof this.ctx.cameraController.enableOrbit === 'function') {
                    this.ctx.cameraController.enableOrbit();
                }
                if (this.ctx.renderer?.domElement) {
                    this.ctx.renderer.domElement.style.cursor = 'grab';
                }
                this._commitTranslationToPlanner();
                if (this.ctx.requestRender) this.ctx.requestRender('universal_move_end');
            }
        };

        this._onKeyDown = (e) => {
            if (!this.attachedObject || !this.visible) return;
            if (this.ctx.viewMode3D === 'preview') return;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
            if (e.key === 'Escape') {
                if (this.isMoveModeActive) {
                    this.cancelMoveMode();
                    e.preventDefault();
                    return;
                }
            }
            if (e.key === 'Enter' || e.key === ' ') {
                if (this.isMoveModeActive) {
                    this.commitMoveMode();
                    e.preventDefault();
                    return;
                }
            }
            if (e.key === 'r' || e.key === 'R' || e.key === ']' || e.key === '.') {
                const step = e.shiftKey ? -90 : 90;
                this.rotate(step);
                e.preventDefault();
            } else if (e.key === '[' || e.key === ',') {
                this.rotate(-90);
                e.preventDefault();
            }
        };

        dom.addEventListener('pointerdown', this._onPointerDown, { capture: true, passive: false });
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
        window.addEventListener('keydown', this._onKeyDown);
    }

    _updateMouseCoords(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    /* -------------------------------------------------------------------------- */
    /*                         TRANSLATION ENGINE EXECUTION                       */
    /* -------------------------------------------------------------------------- */

    _applyTranslation(delta, targetWorldPos = null) {
        if (!this.attachedObject || !this.attachedEntity) return;

        const ent = this.attachedEntity;

        // 1. Wall-Mounted Opening / Plugin Translation along Host Wall
        if (ent.wall && ent.wall.mesh3D) {
            if (!TransformEngine.isSessionActive()) {
                TransformEngine.startSession(ent, 'move');
            }

            const isDoor = isFloorAnchoredDoor(ent);
            const wall = ent.wall;
            const p1 = wall.startAnchor ? (typeof wall.startAnchor.position === 'function' ? wall.startAnchor.position() : wall.startAnchor) : { x: wall.startX || 0, y: wall.startY || 0 };
            const p2 = wall.endAnchor ? (typeof wall.endAnchor.position === 'function' ? wall.endAnchor.position() : wall.endAnchor) : { x: wall.endX || 0, y: wall.endY || 0 };
            const dxW = p2.x - p1.x;
            const dzW = p2.y - p1.y;
            const len = Math.hypot(dxW, dzW);
            const ux = len > 0.001 ? (dxW / len) : 1;
            const uz = len > 0.001 ? (dzW / len) : 0;
            const alongWall = delta.x * ux + delta.z * uz;

            TransformEngine.previewMove(ent, {
                x: delta.x,
                y: isDoor ? 0 : delta.y,
                z: delta.z,
                alongWall
            }, {
                planner: this.ctx.planner || (this.ctx.appState && this.ctx.appState.planner) || window.planner?.value || window.planner,
                realtimeUpdate: this.ctx.realtimeUpdate
            });

            // Keep gizmo centered on opening
            this.attachedObject.updateMatrixWorld(true);
            const bbox = new THREE.Box3().setFromObject(this.attachedObject);
            const center = new THREE.Vector3();
            if (!bbox.isEmpty() && isFinite(bbox.min.x)) {
                bbox.getCenter(center);
                this.position.set(center.x, bbox.min.y + 0.05, center.z);
            }

            if (this._isLuminousActive) {
                this._updateApertureHighlight();
            }
        } else if (this.isRoomMove && this.roomMoveData) {
            const dx = delta.x;
            const dy = delta.z;
            const planner = this.ctx.planner || window.planner?.value || window.planner || window.plannerInstance;

            // Translate all unique bounding wall anchors
            this.roomMoveData.anchors.forEach(a => {
                WallEngine.moveAnchor(a.anchor, { x: Math.round(a.startX + dx), y: Math.round(a.startY + dy) }, planner, false);
            });

            // Translate associated room platforms
            this.roomMoveData.platforms.forEach(p => {
                p.platform.x = Math.round(p.startX + dx);
                p.platform.y = Math.round(p.startY + dy);
                if (p.platform.mesh3D) {
                    p.platform.mesh3D.position.x = p.platform.x;
                    p.platform.mesh3D.position.z = p.platform.y;
                }
            });

            // Fix 6: Translate contained furniture, stairs, and shapes
            if (Array.isArray(this.roomMoveData.containedEntities)) {
                this.roomMoveData.containedEntities.forEach(c => {
                    c.entity.x = Math.round(c.startX + dx);
                    c.entity.y = Math.round(c.startY + dy);
                    if (c.entity.mesh3D) {
                        c.entity.mesh3D.position.x = c.entity.x;
                        c.entity.mesh3D.position.z = c.entity.y;
                        if (typeof c.entity.mesh3D.updateMatrixWorld === 'function') {
                            c.entity.mesh3D.updateMatrixWorld(true);
                        }
                    }
                    if (c.entity.group && typeof c.entity.group.position === 'function') {
                        c.entity.group.position({ x: c.entity.x, y: c.entity.y });
                    }
                    if (this.ctx.realtimeUpdate) {
                        this.ctx.realtimeUpdate.markDirty(c.entity, 'transform');
                    }
                });
            }

            // Live-update 3D wall meshes
            if (this.ctx.interactions?.roomInteractiveSuite) {
                this.ctx.interactions.roomInteractiveSuite._syncWalls3D(this.roomMoveData.walls);
            }

            // Translate floor mesh position live
            this.attachedObject.position.x = this.startMeshPos.x + dx;
            this.attachedObject.position.z = this.startMeshPos.z + dy;
            this.attachedObject.updateMatrixWorld(true);

            // Keep gizmo centered
            this.position.set(this.startGizmoPos.x + dx, this.startGizmoPos.y, this.startGizmoPos.z + dy);
            return;
        }

        // 2. Free Planar Objects (Furniture, Shapes, Stairs, Roofs, Elevation Elements)
        else {
            // Fix 9: Rotated Coordinate Inversion for Roofs
            let moveDeltaX = delta.x;
            let moveDeltaZ = delta.z;
            if ((ent.type === 'roof' || ent.isRoof) && ent.rotation) {
                const rotRad = (ent.rotation * Math.PI) / 180;
                const cosR = Math.cos(rotRad);
                const sinR = Math.sin(rotRad);
                moveDeltaX = delta.x * cosR + delta.z * sinR;
                moveDeltaZ = -delta.x * sinR + delta.z * cosR;
            }

            let newX = targetWorldPos?.x !== undefined ? targetWorldPos.x : (this.startMeshPos.x + moveDeltaX);
            let newZ = targetWorldPos?.z !== undefined ? targetWorldPos.z : (this.startMeshPos.z + moveDeltaZ);
            let newY = targetWorldPos?.elev !== undefined ? targetWorldPos.elev : (this.startMeshPos.y + (delta.y || 0));

            // Platform height detection if not already provided in targetWorldPos
            const planner = this.ctx.planner || (this.ctx.appState && this.ctx.appState.planner) || window.planner?.value || window.planner;
            if (targetWorldPos?.elev === undefined && planner && planner.platforms && !ent.isRoof && ent.type !== 'roof') {
                for (const p of planner.platforms) {
                    if (VerticalPropagationEngine.isPointInPlatform(newX, newZ, p)) {
                        const pTop = (Number(p.elevation) || 0) + (Number(p.height) > 0 ? Number(p.height) : 0);
                        newY = pTop;
                        break;
                    }
                }
            }

            // Wall Collision & Wall Snap Resolution (Fix 5: only if actively dragged to avoid instant click-teleportation)
            const dragMag = Math.hypot(delta.x, delta.z);
            if (planner && (this.wallCollisionEnabled || this.wallSnapEnabled) && !this.isRoomMove && (dragMag > 0.05 || this.isMoveModeActive)) {
                const w = Number(ent.width) || 80;
                const d = Number(ent.depth || ent.length) || 80;
                const rot = Number(ent.rotation) || 0;
                const resolved = SnapEngine.resolvePosition({
                    x: newX,
                    z: newZ,
                    rotation: rot,
                    width: w,
                    depth: d
                }, { planner }, {
                    enableCollision: this.wallCollisionEnabled !== false,
                    enableWallSnap: this.wallSnapEnabled !== false,
                    enableWallContour: true,
                    enableWallAlign: false,
                    snapDistance: 20,
                    enableGridSnap: false
                });
                newX = resolved.x;
                newZ = resolved.z;

                if (resolved.isSnapped && resolved.snappedSegment) {
                    this._updateSnapGuideLine(resolved.snappedSegment, newY);
                } else if (this.snapGuideMesh) {
                    this.snapGuideMesh.visible = false;
                }
            } else if (this.snapGuideMesh) {
                this.snapGuideMesh.visible = false;
            }

            if (!TransformEngine.isSessionActive()) {
                TransformEngine.startSession(ent, 'move');
            }

            TransformEngine.previewMove(ent, {
                absoluteX: newX,
                absoluteY: newZ,
                absoluteElevation: (this.activeHandle === 'handle_y' || this.activeHandle === 'y' || targetWorldPos?.elev !== undefined || (delta.y !== undefined && delta.y !== 0)) ? newY : undefined
            }, {
                planner,
                realtimeUpdate: this.ctx.realtimeUpdate
            });

            if (planner) {
                globalSpatialDependencyEngine.onHostTransformed(ent, planner);
            }

            // Always lock gizmo position strictly to the object's bottom center
            const bbox = new THREE.Box3().setFromObject(this.attachedObject);
            const center = new THREE.Vector3();
            if (!bbox.isEmpty() && isFinite(bbox.min.x)) {
                bbox.getCenter(center);
                this.position.set(center.x, bbox.min.y + 0.05, center.z);
            } else {
                this.position.set(newX, newY + 0.05, newZ);
            }

            if (this._isLuminousActive) {
                this._updateLuminousFootprint();
            }
        }
    }

    _updateLeaderLine(fromPos, toPos) {
        if (this.dynamicLeaderLine && this.dynamicLeaderLine.parent) {
            this.dynamicLeaderLine.parent.remove(this.dynamicLeaderLine);
        }

        const points = [fromPos.clone(), toPos.clone()];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        this.dynamicLeaderLine = new THREE.Line(geo, this.matGuideLine);
        this.dynamicLeaderLine.renderOrder = 9998;
        if (this.parent) this.parent.add(this.dynamicLeaderLine);
    }

    _commitTranslationToPlanner() {
        if (!this.attachedEntity) return;
        const ent = this.attachedEntity;

        if (this.isRoomMove && this.roomMoveData) {
            const planner = this.ctx.planner || window.planner?.value || window.planner || window.plannerInstance;
            const dx = Math.round(this.position.x - this.startGizmoPos.x);
            const dy = Math.round(this.position.z - this.startGizmoPos.z);

            if (this.roomMoveData.room && Array.isArray(this.roomMoveData.room.path) && (dx !== 0 || dy !== 0)) {
                this.roomMoveData.room.path = this.roomMoveData.room.path.map(p => ({
                    x: p.x + dx,
                    y: p.y + dy
                }));
                if (typeof this.roomMoveData.room.cx === 'number') this.roomMoveData.room.cx += dx;
                if (typeof this.roomMoveData.room.cy === 'number') this.roomMoveData.room.cy += dy;
            }

            // Reset floor mesh translation so rebuilt floor geometry does not receive double offset
            if (this.attachedObject) {
                this.attachedObject.position.x = 0;
                this.attachedObject.position.z = 0;
            }

            if (planner) {
                WallEngine.sync(planner);
                planner.syncAll();
                if (typeof planner.detectRooms === 'function') planner.detectRooms();
            }

            if (typeof this.ctx.rebuildActiveFloors === 'function') {
                this.ctx.rebuildActiveFloors();
            } else if (typeof this.ctx.updateFloorsLive === 'function') {
                this.ctx.updateFloorsLive();
            } else if (this.ctx.envBuilder?.buildActiveFloor) {
                this.ctx.envBuilder.buildActiveFloor(planner.walls, planner.rooms, planner.shapes);
            }

            // Update start anchors & platforms for consecutive moves without re-attaching
            this.startGizmoPos.copy(this.position);
            this.startMeshPos.copy(this.attachedObject.position);
            this.roomMoveData.anchors.forEach(a => {
                const p = typeof a.anchor?.position === 'function' ? a.anchor.position() : a.anchor;
                if (p) {
                    a.startX = p.x;
                    a.startY = p.y;
                }
            });
            this.roomMoveData.platforms.forEach(p => {
                p.startX = p.platform.x;
                p.startY = p.platform.y;
            });
            if (Array.isArray(this.roomMoveData.containedEntities)) {
                this.roomMoveData.containedEntities.forEach(c => {
                    c.startX = c.entity.x;
                    c.startY = c.entity.y;
                });
            }

            if (this.ctx.interactions?.roomInteractiveSuite) {
                const suite = this.ctx.interactions.roomInteractiveSuite;
                const rElev = Number(this.roomMoveData.room?.elevation) || 0;
                if (rElev > 0 && typeof suite._syncFoundationPlatforms === 'function') {
                    suite._syncFoundationPlatforms(rElev);
                }
                suite.update();
            }
            if (this.ctx.requestRender) this.ctx.requestRender('room_moved');
            return;
        }

        const id = ent.id || (ent.group && typeof ent.group.id === 'function' ? ent.group.id() : null);
        const plannerInst = this.ctx.planner || window.planner?.value || window.planner || window.plannerInstance;

        if (plannerInst) {
            if (TransformEngine.isSessionActive()) {
                const s = TransformEngine.getSession();
                if (s && s.currentState) {
                    s.currentState.x = ent.x;
                    s.currentState.y = ent.y;
                    if (ent.elevation !== undefined) s.currentState.elevation = ent.elevation;
                }
                TransformEngine.commitSession(plannerInst);
            } else if (typeof plannerInst.move === 'function' && id && this.startEntityPosition && (this.startEntityPosition.x !== ent.x || this.startEntityPosition.y !== ent.y)) {
                plannerInst.move(id, ent.x, ent.y, this.startEntityPosition);
            } else {
                TransformEngine.executeDiscreteStep(plannerInst, ent, {
                    absolutePosition: { x: ent.x, y: ent.y, elevation: ent.elevation },
                    t: ent.t
                });
            }

            // Fix 12: Trigger dynamic stair recalculation if platform elevation was changed
            if (ent && (ent.isPlatform || ent.type === 'platform')) {
                VerticalPropagationEngine.onPlatformHeightChanged(ent, ent.height || 20, ent.height || 20, plannerInst);
            }

            // Update startEntityPosition for consecutive drags without re-attaching
            if (this.startEntityPosition) {
                this.startEntityPosition.x = ent.x;
                this.startEntityPosition.y = ent.y;
                this.startEntityPosition.z = ent.elevation || 0;
                this.startEntityPosition.elevation = ent.elevation || 0;
                this.startEntityPosition.t = ent.t;
            }
            if (this.attachedObject) {
                this.startMeshPos.copy(this.attachedObject.position);
            }
            this.startGizmoPos.copy(this.position);
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                    RESPONSIVE CROSS-DEVICE MOVE HUD DOCK                   */
    /* -------------------------------------------------------------------------- */

    _createHUDPanel() {
        this._isHUDExpanded = false;
        this.hudPanel = document.createElement('div');
        this.hudPanel.className = 'universal-move-hud-panel';
        this.hudPanel.style.cssText = `
            position: fixed; top: 130px; left: 50%; transform: translateX(-50%);
            display: none; flex-direction: column; align-items: center; gap: 6px;
            background: rgba(15, 23, 42, 0.94); color: white; padding: 8px 10px;
            border-radius: 14px; border: 1px solid rgba(0, 240, 255, 0.45);
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 240, 255, 0.2);
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            z-index: 100000; font-family: 'Inter', system-ui, -apple-system, sans-serif;
            pointer-events: auto; user-select: none; transition: all 0.2s ease;
        `;

        this.hudPanel.innerHTML = `
            <!-- Detail Panel Body (Precision Controls) -->
            <div id="move-hud-expanded-body" style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 185px;">
                <!-- Header: Draggable Grip Bar & Close -->
                <div id="move-hud-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: grab; touch-action: none;">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span style="color: #64748b; font-size: 12px; letter-spacing: -1px; user-select: none;">⠿</span>
                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; background: rgba(0, 240, 255, 0.15); color: #00f0ff; font-size: 9.5px;">⬌</span>
                        <span style="font-size: 10.5px; font-weight: 800; color: #f1f5f9; letter-spacing: 0.5px;">MOVE PRECISION</span>
                    </div>
                    <button id="move-btn-close-hud" style="background: transparent; border: none; color: #64748b; font-size: 12px; cursor: pointer; padding: 0 2px; line-height: 1; transition: color 0.15s;" title="Close">✕</button>
                </div>

                <!-- Precision 4-Way D-Pad Steppers -->
                <div style="display: grid; grid-template-columns: repeat(3, 36px); grid-template-rows: repeat(3, 28px); gap: 3px; align-items: center; justify-content: center; margin: 3px 0;">
                    <div></div>
                    <button id="move-btn-dpad-n" class="move-dpad-btn" style="width: 36px; height: 28px; border-radius: 6px; background: rgba(56, 189, 248, 0.18); border: 1px solid rgba(56, 189, 248, 0.45); color: #38bdf8; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;" title="Move North (+Z)">▲</button>
                    <div></div>

                    <button id="move-btn-dpad-w" class="move-dpad-btn" style="width: 36px; height: 28px; border-radius: 6px; background: rgba(244, 63, 94, 0.18); border: 1px solid rgba(244, 63, 94, 0.45); color: #f43f5e; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;" title="Move West (-X)">◀</button>
                    <button id="move-btn-center-reset" style="width: 36px; height: 28px; border-radius: 6px; background: rgba(0, 240, 255, 0.18); border: 1px solid rgba(0, 240, 255, 0.45); color: #00f0ff; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;" title="Recenter to (0,0)">🎯</button>
                    <button id="move-btn-dpad-e" class="move-dpad-btn" style="width: 36px; height: 28px; border-radius: 6px; background: rgba(244, 63, 94, 0.18); border: 1px solid rgba(244, 63, 94, 0.45); color: #f43f5e; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;" title="Move East (+X)">▶</button>

                    <div></div>
                    <button id="move-btn-dpad-s" class="move-dpad-btn" style="width: 36px; height: 28px; border-radius: 6px; background: rgba(56, 189, 248, 0.18); border: 1px solid rgba(56, 189, 248, 0.45); color: #38bdf8; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;" title="Move South (-Z)">▼</button>
                    <div></div>
                </div>

                <!-- Direct Numeric Coordinates (X, Z) -->
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 4px; padding: 2px 0;">
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <span style="font-size: 9px; font-weight: 800; color: #f43f5e;">X:</span>
                        <input type="number" id="move-hud-input-x" step="10" value="0" style="width: 42px; background: rgba(0,0,0,0.45); border: 1px solid rgba(244,63,94,0.35); color: white; border-radius: 4px; padding: 2px 3px; font-size: 9.5px; font-weight: 700; text-align: right; outline: none;">
                    </div>
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <span style="font-size: 9px; font-weight: 800; color: #38bdf8;">Z:</span>
                        <input type="number" id="move-hud-input-z" step="10" value="0" style="width: 42px; background: rgba(0,0,0,0.45); border: 1px solid rgba(38,189,248,0.35); color: white; border-radius: 4px; padding: 2px 3px; font-size: 9.5px; font-weight: 700; text-align: right; outline: none;">
                    </div>
                </div>

                <!-- Snap Pills Strip -->
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding-top: 3px; border-top: 1px solid rgba(255,255,255,0.08);">
                    <span style="font-size: 8px; color: #94a3b8; font-weight: 700;">SNAP</span>
                    <div style="display: flex; gap: 2px; align-items: center; background: rgba(0,0,0,0.35); padding: 1px 3px; border-radius: 4px;">
                        <button class="move-snap-mode-btn" data-snap="1" style="padding: 1.5px 3.5px; font-size: 7.5px; font-weight: 700; border-radius: 3px; background: transparent; color: #94a3b8; border: none; cursor: pointer;">1cm</button>
                        <button class="move-snap-mode-btn active" data-snap="10" style="padding: 1.5px 3.5px; font-size: 7.5px; font-weight: 700; border-radius: 3px; background: #00f0ff; color: #0f172a; border: none; cursor: pointer;">10cm</button>
                        <button class="move-snap-mode-btn" data-snap="50" style="padding: 1.5px 3.5px; font-size: 7.5px; font-weight: 700; border-radius: 3px; background: transparent; color: #94a3b8; border: none; cursor: pointer;">50cm</button>
                        <button class="move-snap-mode-btn" data-snap="0" style="padding: 1.5px 3.5px; font-size: 7.5px; font-weight: 700; border-radius: 3px; background: transparent; color: #94a3b8; border: none; cursor: pointer;">FREE</button>
                    </div>
                </div>
            </div>
        `;

        this.hudPanel.addEventListener('pointerdown', e => e.stopPropagation());
        document.body.appendChild(this.hudPanel);

        this._initHUDPanelEvents();
    }

    _setHUDExpanded(expanded) {
        this._isHUDExpanded = !!expanded;
        if (!expanded && this.hudPanel) {
            this.hudPanel.style.display = 'none';
        }
    }

    _initHUDPanelEvents() {
        if (!this.hudPanel) return;

        // Close Button
        const btnClose = this.hudPanel.querySelector('#move-btn-close-hud');
        if (btnClose) {
            btnClose.onclick = (e) => {
                e.stopPropagation();
                this.hideHUD();
            };
            btnClose.onmouseenter = () => { btnClose.style.color = '#ef4444'; };
            btnClose.onmouseleave = () => { btnClose.style.color = '#64748b'; };
        }

        // 1. Draggable Window Logic
        const headerEl = this.hudPanel.querySelector('#move-hud-header');
        if (headerEl) {
            let isDraggingHUD = false;
            let dragOffsetX = 0;
            let dragOffsetY = 0;

            const onHeaderPointerDown = (e) => {
                if (e.target.closest('button')) return;
                isDraggingHUD = true;
                headerEl.style.cursor = 'grabbing';
                const rect = this.hudPanel.getBoundingClientRect();
                dragOffsetX = e.clientX - rect.left;
                dragOffsetY = e.clientY - rect.top;
                this.hudPanel.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 24px rgba(0, 240, 255, 0.4)';
                e.preventDefault();
            };

            const onWindowPointerMove = (e) => {
                if (!isDraggingHUD) return;
                let x = e.clientX - dragOffsetX;
                let y = e.clientY - dragOffsetY;

                const pad = 8;
                x = Math.max(pad, Math.min(window.innerWidth - this.hudPanel.offsetWidth - pad, x));
                y = Math.max(pad, Math.min(window.innerHeight - this.hudPanel.offsetHeight - pad, y));

                this.hudPanel.style.left = `${x}px`;
                this.hudPanel.style.top = `${y}px`;
                this.hudPanel.style.bottom = 'auto';
                this.hudPanel.style.transform = 'none';
            };

            const onWindowPointerUp = () => {
                if (isDraggingHUD) {
                    isDraggingHUD = false;
                    headerEl.style.cursor = 'grab';
                    this.hudPanel.style.boxShadow = '0 14px 36px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 240, 255, 0.2)';
                }
            };

            headerEl.addEventListener('pointerdown', onHeaderPointerDown);
            window.addEventListener('pointermove', onWindowPointerMove);
            window.addEventListener('pointerup', onWindowPointerUp);
        }

        // D-Pad Steppers (N, S, W, E)
        const step = (dx, dz, shouldCommit = true) => {
            if (!this.attachedObject) return;
            const stepDist = this.snapMode > 0 ? this.snapMode : 10;
            const delta = new THREE.Vector3(dx * stepDist, 0, dz * stepDist);
            this.startMeshPos.copy(this.attachedObject.position);
            this.startGizmoPos.copy(this.position);
            this._applyTranslation(delta);
            if (shouldCommit) {
                this._commitTranslationToPlanner();
            }
            this.syncHUD();
            if (this.ctx.interactions?.highlightRenderer) {
                this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
            }
            if (this.ctx.interactions?._updateSims4Footprint) {
                this.ctx.interactions._updateSims4Footprint(this.attachedObject);
            }
            if (this.ctx.requestRender) this.ctx.requestRender('move_dpad_step');
        };

        const btnN = this.hudPanel.querySelector('#move-btn-dpad-n');
        const btnS = this.hudPanel.querySelector('#move-btn-dpad-s');
        const btnW = this.hudPanel.querySelector('#move-btn-dpad-w');
        const btnE = this.hudPanel.querySelector('#move-btn-dpad-e');

        const bindButtonHold = (btn, dx, dz) => {
            if (!btn) return;
            let timer = null;
            let interval = null;
            let holding = false;
            let handledByPointer = false;

            const start = (e) => {
                if (e.button !== 0 && e.pointerType === 'mouse') return;
                handledByPointer = true;
                holding = true;
                if (!TransformEngine.isSessionActive() && this.attachedEntity) {
                    TransformEngine.startSession(this.attachedEntity, 'move');
                }
                step(dx, dz, false);
                timer = setTimeout(() => {
                    interval = setInterval(() => {
                        step(dx, dz, false);
                    }, 80);
                }, 250);
            };

            const stop = () => {
                if (timer) { clearTimeout(timer); timer = null; }
                if (interval) { clearInterval(interval); interval = null; }
                if (holding) {
                    holding = false;
                    this._commitTranslationToPlanner();
                    this.syncHUD();
                }
                setTimeout(() => { handledByPointer = false; }, 50);
            };

            btn.addEventListener('pointerdown', start);
            btn.addEventListener('pointerup', stop);
            btn.addEventListener('pointerleave', stop);
            btn.addEventListener('pointercancel', stop);

            btn.addEventListener('click', () => {
                if (handledByPointer) return;
                step(dx, dz, true);
            });
        };

        bindButtonHold(btnN, 0, 1);
        bindButtonHold(btnS, 0, -1);
        bindButtonHold(btnW, -1, 0);
        bindButtonHold(btnE, 1, 0);

        // Center / Reset Button (Fix 3: single TransformCommand without double execution)
        const btnCenter = this.hudPanel.querySelector('#move-btn-center-reset');
        if (btnCenter) {
            btnCenter.onclick = () => {
                if (this.attachedEntity && this.attachedObject) {
                    const planner = this.ctx.planner || (this.ctx.appState && this.ctx.appState.planner) || window.planner?.value || window.planner;
                    if (planner) {
                        TransformEngine.executeDiscreteStep(planner, this.attachedEntity, {
                            absolutePosition: { x: 0, y: 0, elevation: this.attachedEntity.elevation || 0 }
                        });
                    } else {
                        this.attachedEntity.x = 0;
                        this.attachedEntity.y = 0;
                        this.attachedObject.position.x = 0;
                        this.attachedObject.position.z = 0;
                        this.attachedObject.updateMatrixWorld(true);

                        if (this.attachedEntity.group && typeof this.attachedEntity.group.x === 'function') {
                            this.attachedEntity.group.x(0);
                            this.attachedEntity.group.y(0);
                        }
                        if (typeof this.attachedEntity.update2D === 'function') {
                            this.attachedEntity.update2D();
                        }
                    }

                    this.startMeshPos.set(0, this.attachedObject.position.y, 0);
                    const bbox = new THREE.Box3().setFromObject(this.attachedObject);
                    const center = new THREE.Vector3();
                    if (!bbox.isEmpty() && isFinite(bbox.min.x)) {
                        bbox.getCenter(center);
                        this.position.set(center.x, bbox.min.y + 0.05, center.z);
                    } else {
                        this.position.set(0, this.position.y, 0);
                    }
                    this.startGizmoPos.copy(this.position);

                    if (this.startEntityPosition) {
                        this.startEntityPosition.x = 0;
                        this.startEntityPosition.y = 0;
                    }

                    this.syncHUD();
                    if (this.ctx.interactions?.highlightRenderer) {
                        this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
                    }
                    if (this.ctx.interactions?._updateSims4Footprint) {
                        this.ctx.interactions._updateSims4Footprint(this.attachedObject);
                    }
                    if (this.ctx.requestRender) this.ctx.requestRender('move_center_reset');
                }
            };
        }

        // Direct Coordinate Inputs (X, Z)
        const inputX = this.hudPanel.querySelector('#move-hud-input-x');
        const inputZ = this.hudPanel.querySelector('#move-hud-input-z');

        if (inputX) {
            inputX.onchange = (e) => {
                const valX = parseFloat(e.target.value) || 0;
                if (this.attachedEntity && this.attachedObject) {
                    const deltaX = valX - (this.attachedEntity.x !== undefined ? this.attachedEntity.x : this.attachedObject.position.x);
                    this.startMeshPos.copy(this.attachedObject.position);
                    this.startGizmoPos.copy(this.position);
                    this._applyTranslation(new THREE.Vector3(deltaX, 0, 0));
                    this._commitTranslationToPlanner();
                    this.syncHUD();
                    if (this.ctx.interactions?.highlightRenderer) {
                        this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
                    }
                    if (this.ctx.interactions?._updateSims4Footprint) {
                        this.ctx.interactions._updateSims4Footprint(this.attachedObject);
                    }
                    if (this.ctx.requestRender) this.ctx.requestRender('move_input_x');
                }
            };
        }

        if (inputZ) {
            inputZ.onchange = (e) => {
                const valZ = parseFloat(e.target.value) || 0;
                if (this.attachedEntity && this.attachedObject) {
                    const deltaZ = valZ - (this.attachedEntity.y !== undefined ? this.attachedEntity.y : this.attachedObject.position.z);
                    this.startMeshPos.copy(this.attachedObject.position);
                    this.startGizmoPos.copy(this.position);
                    this._applyTranslation(new THREE.Vector3(0, 0, deltaZ));
                    this._commitTranslationToPlanner();
                    this.syncHUD();
                    if (this.ctx.interactions?.highlightRenderer) {
                        this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
                    }
                    if (this.ctx.interactions?._updateSims4Footprint) {
                        this.ctx.interactions._updateSims4Footprint(this.attachedObject);
                    }
                    if (this.ctx.requestRender) this.ctx.requestRender('move_input_z');
                }
            };
        }

        // Snap Mode Buttons
        const snapBtns = this.hudPanel.querySelectorAll('.move-snap-mode-btn');
        snapBtns.forEach(btn => {
            btn.onclick = () => {
                snapBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.color = '#94a3b8';
                });
                btn.classList.add('active');
                btn.style.background = '#00f0ff';
                btn.style.color = '#0f172a';
                this.snapMode = parseInt(btn.getAttribute('data-snap'), 10) || 0;
            };
        });
    }

    step(dx, dz) {
        if (!this.attachedObject) return;
        const stepDist = this.snapMode > 0 ? this.snapMode : 10;
        const delta = new THREE.Vector3(dx * stepDist, 0, dz * stepDist);
        this.startMeshPos.copy(this.attachedObject.position);
        this.startGizmoPos.copy(this.position);
        this._applyTranslation(delta);
        this._commitTranslationToPlanner();
        this.syncHUD();
        if (this.ctx.interactions?.highlightRenderer) {
            this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
        }
        if (this.ctx.interactions?._updateSims4Footprint) {
            this.ctx.interactions._updateSims4Footprint(this.attachedObject);
        }
        if (this.ctx.requestRender) this.ctx.requestRender('move_dpad_step');
    }

    setCoordinates(valX, valZ) {
        if (!this.attachedEntity || !this.attachedObject) return;
        const curX = this.attachedEntity.x !== undefined ? this.attachedEntity.x : this.attachedObject.position.x;
        const curZ = this.attachedEntity.y !== undefined ? this.attachedEntity.y : this.attachedObject.position.z;
        const deltaX = (valX !== undefined && valX !== null) ? (valX - curX) : 0;
        const deltaZ = (valZ !== undefined && valZ !== null) ? (valZ - curZ) : 0;
        this.startMeshPos.copy(this.attachedObject.position);
        this.startGizmoPos.copy(this.position);
        this._applyTranslation(new THREE.Vector3(deltaX, 0, deltaZ));
        this._commitTranslationToPlanner();
        this.syncHUD();
        if (this.ctx.interactions?.highlightRenderer) {
            this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
        }
        if (this.ctx.interactions?._updateSims4Footprint) {
            this.ctx.interactions._updateSims4Footprint(this.attachedObject);
        }
        if (this.ctx.requestRender) this.ctx.requestRender('move_set_coords');
    }

    setSnapMode(snap) {
        this.snapMode = snap;
    }

    showHUD() {
        if (this.hudPanel) {
            // Badges not required — when unified ContextualActionHUD or commonTools is present, suppress floating HUD completely
            const isUnifiedHUDActive = Boolean(
                this.ctx?.commonTools ||
                this.ctx?.preview3D?.commonTools ||
                (typeof window !== 'undefined' && (window.renderer3D?.commonTools || window.planner?.engine3d?.commonTools)) ||
                (typeof document !== 'undefined' && (
                    document.querySelector('.contextual-action-hud-container') ||
                    document.querySelector('.action-hud-card') ||
                    document.querySelector('.common-toolbar-3d')
                ))
            );
            if (isUnifiedHUDActive) {
                this.hudPanel.style.display = 'none';
                return;
            }
            this.hudPanel.style.display = 'flex';
        }
    }

    hideHUD() {
        if (this.hudPanel) {
            this.hudPanel.style.display = 'none';
        }
    }

    rotateStep(deltaDeg = 90) {
        this.rotate(deltaDeg);
    }

    rotate(deltaDeg = 90) {
        if (!this.attachedEntity || !this.attachedObject) return;
        const ent = this.attachedEntity;
        const planner = this.ctx.planner || (this.ctx.appState && this.ctx.appState.planner) || window.planner?.value || window.planner;

        if (planner) {
            TransformEngine.executeDiscreteStep(planner, ent, {
                deltaRotation: deltaDeg
            });
        } else {
            const curRot = Number(ent.rotation) || 0;
            const newRot = ((curRot + deltaDeg) % 360 + 360) % 360;
            ent.rotation = newRot;

            if (this.attachedObject) {
                this.attachedObject.rotation.y = -newRot * Math.PI / 180;
                this.attachedObject.updateMatrixWorld(true);
            }

            if (typeof ent.update2D === 'function') ent.update2D();
            if (this.ctx.realtimeUpdate) this.ctx.realtimeUpdate.markDirty(ent, 'transform');
        }

        // Re-resolve wall collision and snap contour if applicable
        if (planner && (this.wallCollisionEnabled || this.wallSnapEnabled) && !this.isRoomMove && !ent.wall) {
            const w = Number(ent.width) || 80;
            const d = Number(ent.depth || ent.length) || 80;
            const rot = Number(ent.rotation) || 0;
            const curX = ent.x !== undefined ? Number(ent.x) : this.attachedObject.position.x;
            const curZ = ent.y !== undefined ? Number(ent.y) : this.attachedObject.position.z;
            const resolved = SnapEngine.resolvePosition({
                x: curX,
                z: curZ,
                rotation: rot,
                width: w,
                depth: d
            }, { planner }, {
                enableCollision: this.wallCollisionEnabled !== false,
                enableWallSnap: this.wallSnapEnabled !== false,
                enableWallContour: true,
                enableWallAlign: false,
                snapDistance: 20,
                enableGridSnap: false
            });
            if (resolved.x !== curX || resolved.z !== curZ) {
                ent.x = resolved.x;
                ent.y = resolved.z;
                if (this.attachedObject) {
                    this.attachedObject.position.x = resolved.x;
                    this.attachedObject.position.z = resolved.z;
                    this.attachedObject.updateMatrixWorld(true);
                }
                if (this.ctx.realtimeUpdate) this.ctx.realtimeUpdate.markDirty(ent, 'transform');
            }
            if (resolved.isSnapped && resolved.snappedSegment) {
                this._updateSnapGuideLine(resolved.snappedSegment, this.attachedObject?.position?.y || 0);
            } else if (this.snapGuideMesh) {
                this.snapGuideMesh.visible = false;
            }
        } else if (this.snapGuideMesh) {
            this.snapGuideMesh.visible = false;
        }

        if (this._isLuminousActive) {
            this._updateLuminousFootprint();
            if (ent.wall) this._updateApertureHighlight();
        }

        this.syncHUD();
        if (this.ctx.interactions?.highlightRenderer) {
            this.ctx.interactions.highlightRenderer.refresh(this.attachedObject);
        }
        if (this.ctx.interactions?._updateSims4Footprint) {
            this.ctx.interactions._updateSims4Footprint(this.attachedObject);
        }
        if (this.ctx.requestRender) this.ctx.requestRender('universal_move_rotate');
    }

    toggleWallSnap() {
        this.wallSnapEnabled = !this.wallSnapEnabled;
        this.syncHUD();
        return this.wallSnapEnabled;
    }

    syncHUD() {
        if (!this.attachedObject) return;

        const curX = Math.round(this.attachedEntity?.x !== undefined ? this.attachedEntity.x : this.attachedObject.position.x);
        const curZ = Math.round(this.attachedEntity?.y !== undefined ? this.attachedEntity.y : this.attachedObject.position.z);
        const curRot = Math.round(this.attachedEntity?.rotation || 0);

        coreEventBus.emit('UniversalMoveChanged', {
            x: curX,
            z: curZ,
            rotation: curRot,
            wallSnap: this.wallSnapEnabled,
            snapMode: this.snapMode
        });

        if (!this.hudPanel) return;

        const inputX = this.hudPanel.querySelector('#move-hud-input-x');
        const inputZ = this.hudPanel.querySelector('#move-hud-input-z');

        if (inputX && document.activeElement !== inputX) inputX.value = curX;
        if (inputZ && document.activeElement !== inputZ) inputZ.value = curZ;
    }

    /* -------------------------------------------------------------------------- */
    /*                              CLEANUP & DISPOSE                             */
    /* -------------------------------------------------------------------------- */

    dispose() {
        this.detach();
        const dom = this.ctx.renderer?.domElement || window;
        if (this._onPointerDown && dom.removeEventListener) {
            dom.removeEventListener('pointerdown', this._onPointerDown, { capture: true });
        }
        if (this._onPointerMove) window.removeEventListener('pointermove', this._onPointerMove);
        if (this._onPointerUp) window.removeEventListener('pointerup', this._onPointerUp);
        if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
        if (this.hudPanel && this.hudPanel.parentNode) {
            this.hudPanel.parentNode.removeChild(this.hudPanel);
        }
        if (this.snapGuideMesh) {
            if (this.snapGuideMesh.parent) this.snapGuideMesh.parent.remove(this.snapGuideMesh);
            if (this.snapGuideMesh.geometry) this.snapGuideMesh.geometry.dispose();
            if (this.snapGuideMat) this.snapGuideMat.dispose();
            this.snapGuideMesh = null;
            this.snapGuideMat = null;
        }
    }
}

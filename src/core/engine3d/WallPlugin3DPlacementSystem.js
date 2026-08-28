import * as THREE from 'three';
import { WIDGET_REGISTRY, MOLDING_REGISTRY, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT } from '../registry.js';
import { PremiumWidget } from '../engine2d/PremiumWidget.js';
import { PremiumMolding } from '../engine2d/PremiumMolding.js';
import { Molding3DBuilder } from './Molding3DBuilder.js';
import { coreEventBus } from '../EventBus.js';
import { EVENTS } from '../constants/events.js';
import { ComponentRegistry } from './ComponentRegistry.js';

/**
 * WallPlugin3DPlacementSystem
 * 
 * Direct Sims 4-Style 3D Wall Placement & Real-Time Wall Aperture Highlighting.
 * Supports:
 * - Doors, Windows, Jali Panels, and Custom Openings
 * - Curtains, Drapes, Roman & Roller Blinds
 * - Framed Canvas Wall Art & Photo Galleries
 * - Elevation Fascias & Facade Box Frames (Shape-Accurate C-shape, L-shape, Box)
 * - Sunshades / Chajjas (attached protruding from chosen wall face)
 * - Baseboards & Skirting (miter-sheared corner-to-corner along chosen wall face)
 * - Crown Moldings & Friezes (miter-sheared corner-to-corner along top ceiling line)
 * - Elevation Corner Elements, Quoins & Pillars
 */
export class WallPlugin3DPlacementSystem {
    constructor(ctx, interactionSystem) {
        this.ctx = ctx;
        this.interactions = interactionSystem;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.activeWall = null;
        this.activeT = null;
        this.activeSide = 'front';
        this.activeLocalX = 0;
        this.activeElevation = 0;
        this.isValidPlacement = true;

        this.molding3DBuilder = new Molding3DBuilder();

        // Container for all 3D Ghost and Highlight elements
        this.placementGroup = new THREE.Group();
        this.placementGroup.name = 'Sims4_WallPlacement_Group';
        this.placementGroup.visible = false;
        this.placementGroup.raycast = () => {};
        this.ctx.scene.add(this.placementGroup);

        // 1. Aperture Cutout Void / Ribbon Mesh
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
        this.placementGroup.add(this.apertureVoidMesh);

        // 2. Aperture Glowing Outline Edges
        this.apertureEdgeMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.apertureEdgeMatInvalid = new THREE.LineBasicMaterial({
            color: 0xef4444,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.apertureEdges = new THREE.LineSegments(new THREE.BufferGeometry(), this.apertureEdgeMat);
        this.apertureEdges.renderOrder = 1006;
        this.apertureEdges.raycast = () => {};
        this.placementGroup.add(this.apertureEdges);

        // 3. Container for the Live 3D Model Preview
        this.modelPreviewGroup = new THREE.Group();
        this.modelPreviewGroup.raycast = () => {};
        this.placementGroup.add(this.modelPreviewGroup);

        // Floating DOM HUD Badge
        this.badgeDom = document.createElement('div');
        this.badgeDom.id = 'sims4-wall-plugin-badge';
        this.badgeDom.style.cssText = `
            position: fixed;
            display: none;
            pointer-events: none;
            background: rgba(15, 23, 42, 0.92);
            backdrop-filter: blur(10px);
            border: 1.5px solid rgba(56, 189, 248, 0.8);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
            border-radius: 8px;
            padding: 6px 14px;
            color: #f8fafc;
            font-family: 'Segoe UI', system-ui, sans-serif;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.3px;
            z-index: 9999;
            transform: translate(-50%, -135%);
            white-space: nowrap;
            transition: border-color 0.15s ease, background 0.15s ease;
        `;
        document.body.appendChild(this.badgeDom);

        this._lastToolKey = null;
    }

    isPlacementTool() {
        const planner = this.getPlanner();
        if (!planner) return false;
        const tool = planner.tool;
        if (!tool || tool === 'select' || tool === 'pan') return false;

        const preset = planner.activePresetParams || {};
        const isOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut', 'opening'].includes(tool);
        const isMolding = tool === 'molding' || tool === 'skirting' || tool.startsWith('molding_') || tool.startsWith('skirting_') || !!MOLDING_REGISTRY[tool] || (preset && (preset.type?.startsWith('molding_') || preset.profileType?.startsWith('skirting_')));
        const isWidget = !!WIDGET_REGISTRY[tool];
        const isDecorOrPlugin = tool.startsWith('door') || tool.startsWith('window') || tool === 'jali_panel' || tool === 'sunshade' || tool === 'curtain' || tool === 'wall_art' || tool === 'elevation_fascia' || tool.startsWith('jali_') || tool.startsWith('sunshade_') || tool.startsWith('curtain_') || tool.startsWith('decor_wall_') || tool.startsWith('decor_photo_') || tool.startsWith('fascia_');

        return isOpening || isMolding || isWidget || isDecorOrPlugin;
    }

    getPlanner() {
        return this.ctx.planner || window.planner || (this.ctx.appState && this.ctx.appState.planner);
    }

    /**
     * Create exact Shape-Accurate 3D Geometry for Elevation Fascias (C-shape, L-shape, Box frame)
     */
    createFasciaShapeGeometry(profileType, width, height, depth, thick, topArm, bottomArm) {
        const w = width;
        const h = height;
        const t = thick || 10;
        const tArm = topArm !== undefined ? topArm : w;
        const bArm = bottomArm !== undefined ? bottomArm : w;

        const shape = new THREE.Shape();

        if (profileType === 'c_shape_left') {
            shape.moveTo(-w/2, 0);
            shape.lineTo(-w/2 + bArm, 0);
            shape.lineTo(-w/2 + bArm, t);
            shape.lineTo(-w/2 + t, t);
            shape.lineTo(-w/2 + t, h - t);
            shape.lineTo(-w/2 + tArm, h - t);
            shape.lineTo(-w/2 + tArm, h);
            shape.lineTo(-w/2, h);
            shape.closePath();
        } else if (profileType === 'c_shape_right') {
            shape.moveTo(w/2 - bArm, 0);
            shape.lineTo(w/2, 0);
            shape.lineTo(w/2, h);
            shape.lineTo(w/2 - tArm, h);
            shape.lineTo(w/2 - tArm, h - t);
            shape.lineTo(w/2 - t, h - t);
            shape.lineTo(w/2 - t, t);
            shape.lineTo(w/2 - bArm, t);
            shape.closePath();
        } else if (profileType === 'l_shape_left') {
            shape.moveTo(-w/2, 0);
            shape.lineTo(-w/2 + t, 0);
            shape.lineTo(-w/2 + t, h - t);
            shape.lineTo(-w/2 + tArm, h - t);
            shape.lineTo(-w/2 + tArm, h);
            shape.lineTo(-w/2, h);
            shape.closePath();
        } else if (profileType === 'l_shape_right') {
            shape.moveTo(w/2 - t, 0);
            shape.lineTo(w/2, 0);
            shape.lineTo(w/2, h);
            shape.lineTo(w/2 - tArm, h);
            shape.lineTo(w/2 - tArm, h - t);
            shape.lineTo(w/2 - t, h - t);
            shape.closePath();
        } else {
            // full_box or default
            shape.moveTo(-w/2, 0);
            shape.lineTo(w/2, 0);
            shape.lineTo(w/2, h);
            shape.lineTo(-w/2, h);
            shape.closePath();

            const hole = new THREE.Path();
            hole.moveTo(-w/2 + t, t);
            hole.lineTo(w/2 - t, t);
            hole.lineTo(w/2 - t, h - t);
            hole.lineTo(-w/2 + t, h - t);
            hole.closePath();
            shape.holes.push(hole);
        }

        const geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
        geo.translate(0, 0, -depth / 2);
        return geo;
    }

    onPointerMove(e) {
        if (!this.isPlacementTool()) {
            this.hideGhost();
            return false;
        }

        const planner = this.getPlanner();
        const tool = planner.tool;
        const dom = this.ctx.renderer.domElement;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        // Raycast against wall meshes, ignoring preview and hitbox objects
        const interactables = this.ctx.interactables || [];
        const intersects = this.raycaster.intersectObjects(interactables, true);
        const wallHit = intersects.find(i => {
            const obj = i.object;
            if (!obj || !obj.visible) return false;
            if (obj.userData?.isHitbox) return false;
            return obj.userData?.isWallSide || obj.userData?.entity?.type === 'outer' || obj.userData?.entity?.type === 'inner' || obj.userData?.entity?.type === 'wall' || obj.userData?.parentWall;
        });

        if (!wallHit) {
            this.hideGhost();
            return false;
        }

        const hitMesh = wallHit.object;
        const wallEntity = hitMesh.userData.parentWall || hitMesh.userData.entity || (hitMesh.parent && hitMesh.parent.userData?.entity);

        if (!wallEntity || !wallEntity.startAnchor || !wallEntity.endAnchor) {
            this.hideGhost();
            return false;
        }

        const p1 = wallEntity.startAnchor.position();
        const p2 = wallEntity.endAnchor.position();
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const wallLen = Math.hypot(dx, dy);
        if (wallLen < 1) {
            this.hideGhost();
            return false;
        }

        // Project 3D hit point into wall 2D local space
        const hitPt = wallHit.point;
        const wallDirX = dx / wallLen;
        const wallDirY = dy / wallLen;
        const relX = hitPt.x - p1.x;
        const relY = hitPt.z - p1.y;
        let projDist = relX * wallDirX + relY * wallDirY;

        // Detect Wall Side (front vs back) using camera line-of-sight
        const camPos = this.ctx.camera.position;
        const toCamX = camPos.x - hitPt.x;
        const toCamZ = camPos.z - hitPt.z;
        const dotCam = toCamX * (-wallDirY) + toCamZ * wallDirX;
        const side = dotCam >= 0 ? 'front' : 'back';
        const facing = (side === 'back') ? -1 : 1;

        // Dimensions & Elevation calculations
        const preset = planner.activePresetParams || {};
        const thick = wallEntity.thickness || wallEntity.config?.thickness || 20;
        const wallH = wallEntity.height || wallEntity.config?.height || 180;

        const isMolding = tool === 'molding' || tool === 'skirting' || tool.startsWith('molding_') || tool.startsWith('skirting_') || !!MOLDING_REGISTRY[tool] || (preset && (preset.type?.startsWith('molding_') || preset.profileType?.startsWith('skirting_')));
        const isElevationTrim = tool === 'elevation_frieze' || tool === 'elevation_foundation_trim';
        const isDoor = tool.startsWith('door');
        const isWindow = tool.startsWith('window');
        const isJali = tool === 'jali_panel' || tool.startsWith('jali_');
        const isSunshade = tool === 'sunshade' || tool.startsWith('sunshade_') || tool === 'chajja';
        const isCurtain = tool === 'curtain' || tool.startsWith('curtain_');
        const isWallArt = tool === 'wall_art' || tool.startsWith('decor_wall_') || tool.startsWith('decor_photo_');
        const isFascia = tool === 'elevation_fascia' || tool.startsWith('fascia_');

        const isDrapes = isCurtain && (!preset.curtainType || preset.curtainType.includes('drapes'));

        let itemW = isMolding || isElevationTrim
            ? wallLen
            : (preset.width || (isDoor ? 40 : (isWindow ? 60 : (isJali ? 40 : (isSunshade ? 60 : (isFascia ? 100 : (isCurtain ? (isDrapes ? 80 : 50) : (isWallArt ? (tool.includes('gallery') || preset.artType?.includes('gallery') ? 60 : 50) : (tool === 'elevation_corner_element' ? 26 : 80)))))))));
        
        let itemH = isMolding 
            ? (preset.moldingHeight || (preset.height && preset.height <= 30 ? preset.height : 12))
            : (isDoor ? DOOR_HEIGHT : (isWindow ? WINDOW_HEIGHT : (isJali ? 100 : (isSunshade ? 6 : (isFascia ? 120 : (isCurtain ? (isDrapes ? 95 : 50) : (isWallArt ? (tool.includes('gallery') || preset.artType?.includes('gallery') ? 25 : 35) : (tool === 'elevation_corner_element' ? wallH : (tool === 'elevation_frieze' ? 18 : (tool === 'elevation_foundation_trim' ? 45 : (preset.height || 20)))))))))));

        let depth = preset.depth || (isSunshade ? 40 : (isFascia ? 40 : (isCurtain ? (isDrapes ? 8 : 4) : (isWallArt ? 3 : 2))));
        let elev = 0;

        let t = projDist / wallLen;

        if (isMolding || isElevationTrim) {
            // Baseboards, Moldings & Wall Trims span the entire wall length
            itemW = wallLen;
            t = 0.5;
            projDist = wallLen / 2;
            const isCrown = tool === 'molding' || tool.includes('crown') || tool === 'elevation_frieze' || (preset.profileType && preset.profileType.includes('crown')) || (preset.type && preset.type.includes('crown'));
            elev = isCrown ? Math.max(0, wallH - itemH) : (preset.heightOffset || 0);
        } else if (tool === 'elevation_corner_element') {
            t = (t < 0.5) ? 0 : 1;
            projDist = t * wallLen;
            elev = preset.elevation !== undefined ? preset.elevation : 0;
            itemH = wallH;
        } else if (isDoor) {
            elev = 0;
            const halfWT = (itemW / 2) / wallLen;
            t = Math.max(halfWT, Math.min(1 - halfWT, t));
            projDist = t * wallLen;
        } else if (isWindow) {
            elev = preset.elevation !== undefined ? preset.elevation : (preset.sillHeight || WINDOW_SILL || 80);
            const halfWT = (itemW / 2) / wallLen;
            t = Math.max(halfWT, Math.min(1 - halfWT, t));
            projDist = t * wallLen;
        } else if (isJali) {
            elev = preset.elevation !== undefined ? preset.elevation : 40;
            const halfWT = (itemW / 2) / wallLen;
            t = Math.max(halfWT, Math.min(1 - halfWT, t));
            projDist = t * wallLen;
        } else if (isSunshade) {
            elev = preset.elevation !== undefined ? preset.elevation : 120;
            const halfWT = (itemW / 2) / wallLen;
            t = Math.max(halfWT, Math.min(1 - halfWT, t));
            projDist = t * wallLen;
        } else if (isFascia) {
            elev = preset.elevation !== undefined ? preset.elevation : 0;
            const halfWT = (itemW / 2) / wallLen;
            t = Math.max(halfWT, Math.min(1 - halfWT, t));
            projDist = t * wallLen;
        } else if (isCurtain) {
            elev = preset.elevation !== undefined ? preset.elevation : (isDrapes ? 5 : 45);
            const halfWT = (itemW / 2) / wallLen;
            t = Math.max(halfWT, Math.min(1 - halfWT, t));
            projDist = t * wallLen;
        } else if (isWallArt) {
            elev = preset.elevation !== undefined ? preset.elevation : 45;
            const halfWT = (itemW / 2) / wallLen;
            t = Math.max(halfWT, Math.min(1 - halfWT, t));
            projDist = t * wallLen;
        } else {
            elev = preset.elevation !== undefined ? preset.elevation : Math.max(0, hitPt.y);
            t = Math.max(0.02, Math.min(0.98, t));
            projDist = t * wallLen;
        }

        // Overlap Validation Check (only for entities that cut the wall: doors, windows, jali)
        let isValid = true;
        const cutsWall = !isMolding && !isElevationTrim && !isSunshade && !isCurtain && !isWallArt && !isFascia && (WIDGET_REGISTRY[tool]?.cutsWall !== false);
        if (cutsWall && wallEntity.attachedWidgets && wallEntity.attachedWidgets.length > 0) {
            const pMin = projDist - itemW / 2;
            const pMax = projDist + itemW / 2;
            for (let w of wallEntity.attachedWidgets) {
                if (w.config?.cutsWall === false || w.cutsWall === false) continue;
                const wW = w.width || 40;
                const wT = w.t !== undefined ? w.t : 0.5;
                const wMin = wT * wallLen - wW / 2;
                const wMax = wT * wallLen + wW / 2;
                if (pMax > wMin + 1 && pMin < wMax - 1) {
                    isValid = false;
                    break;
                }
            }
        }

        this.activeWall = wallEntity;
        this.activeT = t;
        this.activeSide = side;
        this.activeLocalX = projDist;
        this.activeElevation = elev;
        this.isValidPlacement = isValid;

        const isAttachedSurfaceElement = isSunshade || isCurtain || isWallArt;

        // Position & Update Aperture Highlight & 3D Model
        this.updateApertureAndModel(tool, wallEntity, t, elev, facing, wallLen, dx, dy, p1, p2, thick, wallH, itemW, itemH, depth, isValid, isMolding || isElevationTrim, isAttachedSurfaceElement, isFascia, projDist, preset);

        // Update HUD Badge
        const toolLabel = WIDGET_REGISTRY[tool]?.label || MOLDING_REGISTRY[tool]?.label || tool.toUpperCase().replace(/_/g, ' ');
        const distFromStart = Math.round(t * wallLen);
        const distFromEnd = Math.round((1 - t) * wallLen);
        const statusColor = isValid ? '#00f0ff' : '#ef4444';
        const statusText = (isMolding || isElevationTrim) 
            ? `Side: ${side.toUpperCase()} (Full Length ${Math.round(wallLen)}cm)` 
            : (isValid ? `${distFromStart}cm ← → ${distFromEnd}cm` : 'Space Occupied');

        this.badgeDom.style.borderColor = statusColor;
        this.badgeDom.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: ${statusColor}; box-shadow: 0 0 10px ${statusColor};"></span>
                <span style="color: ${statusColor}; font-weight: 700;">${toolLabel}</span>
                <span style="color: #64748b;">|</span>
                <span style="color: #e2e8f0;">${statusText}</span>
            </div>
        `;
        this.badgeDom.style.left = `${e.clientX}px`;
        this.badgeDom.style.top = `${e.clientY}px`;
        this.badgeDom.style.display = 'block';

        dom.style.cursor = isValid ? 'crosshair' : 'not-allowed';
        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
        return true;
    }

    /**
     * Position the glowing Sims 4 wall cutout aperture or molding ribbon and live 3D preview model
     * Supports mitered corner joints for seamless wall span!
     */
    updateApertureAndModel(tool, wallEntity, t, elev, facing, wallLen, dx, dy, p1, p2, thick, wallH, itemW, itemH, depth, isValid, isMoldingOrTrim, isAttachedSurfaceElement, isFascia, projDist, preset) {
        const angleY = -Math.atan2(dy, dx);

        // Anchor Master Group at the Wall Start (p1.x, 0, p1.y) rotated by angleY
        this.placementGroup.position.set(p1.x, 0, p1.y);
        this.placementGroup.rotation.y = angleY;
        this.placementGroup.visible = true;

        // Miter joint coordinates from wall polygon
        const pts = (typeof wallEntity.poly?.points === 'function') 
            ? wallEntity.poly.points() 
            : (Array.isArray(wallEntity.poly) ? wallEntity.poly : (wallEntity.poly?.attrs?.points || null));

        let localSL_x = 0, localSR_x = 0, localEL_x = wallLen, localER_x = wallLen;
        const angle = Math.atan2(dy, dx);
        if (pts && pts.length === 8) {
            const toLocalX = (ptX, ptY) => {
                const dx_pt = ptX - p1.x;
                const dy_pt = ptY - p1.y;
                return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
            };
            localSL_x = toLocalX(pts[0], pts[1]);
            localEL_x = toLocalX(pts[2], pts[3]);
            localER_x = toLocalX(pts[4], pts[5]);
            localSR_x = toLocalX(pts[6], pts[7]);
        }

        if (isMoldingOrTrim) {
            const mDepth = 2.5;
            const wallOffset = ((thick / 2) + (mDepth / 2)) * facing;
            const cutoutY = elev + itemH / 2;

            const ribbonGeo = new THREE.BoxGeometry(wallLen, itemH, mDepth);
            ribbonGeo.translate(wallLen / 2, cutoutY, wallOffset);

            if (pts && pts.length === 8) {
                const pos = ribbonGeo.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i);
                    const z = pos.getZ(i);
                    const tZ = (z + thick / 2) / thick;
                    const startX = localSR_x + tZ * (localSL_x - localSR_x);
                    const endX = localER_x + tZ * (localEL_x - localER_x);

                    if (x <= 0.1) {
                        pos.setX(i, startX);
                    } else if (x >= wallLen - 0.1) {
                        pos.setX(i, endX);
                    }
                }
                ribbonGeo.computeVertexNormals();
            }

            this.apertureVoidMesh.geometry.dispose();
            this.apertureVoidMesh.geometry = ribbonGeo;
            this.apertureVoidMesh.position.set(0, 0, 0);

            this.apertureVoidMat.color.setHex(0x00f0ff);
            this.apertureVoidMat.opacity = 0.3;

            this.apertureEdges.geometry.dispose();
            this.apertureEdges.geometry = new THREE.EdgesGeometry(ribbonGeo);
            this.apertureEdges.position.set(0, 0, 0);
            this.apertureEdges.material = this.apertureEdgeMat;
        } else if (isFascia) {
            // For Elevation Fascias: Shape-Accurate glowing C-shape, L-shape, or Box geometry
            const pType = preset?.profileType || 'c_shape_left';
            const fThick = preset?.thick || 10;
            const wallOffset = ((thick / 2) + (depth / 2)) * facing;

            this.apertureVoidMesh.geometry.dispose();
            this.apertureVoidMesh.geometry = this.createFasciaShapeGeometry(pType, itemW, itemH, depth, fThick, preset?.topArm, preset?.bottomArm);
            this.apertureVoidMesh.position.set(projDist, elev, wallOffset);

            this.apertureVoidMat.color.setHex(0x00f0ff);
            this.apertureVoidMat.opacity = 0.35;

            this.apertureEdges.geometry.dispose();
            this.apertureEdges.geometry = new THREE.EdgesGeometry(this.apertureVoidMesh.geometry);
            this.apertureEdges.position.copy(this.apertureVoidMesh.position);
            this.apertureEdges.material = this.apertureEdgeMat;
        } else if (isAttachedSurfaceElement) {
            // For Sunshades, Curtains, Wall Art: protruding footprint box attached flush to chosen wall face
            const wallOffset = ((thick / 2) + (depth / 2)) * facing;
            const cutoutY = elev + itemH / 2;

            this.apertureVoidMesh.geometry.dispose();
            this.apertureVoidMesh.geometry = new THREE.BoxGeometry(itemW, itemH, depth);
            this.apertureVoidMesh.position.set(projDist, cutoutY, wallOffset);

            this.apertureVoidMat.color.setHex(0x00f0ff);
            this.apertureVoidMat.opacity = 0.35;

            this.apertureEdges.geometry.dispose();
            this.apertureEdges.geometry = new THREE.EdgesGeometry(this.apertureVoidMesh.geometry);
            this.apertureEdges.position.copy(this.apertureVoidMesh.position);
            this.apertureEdges.material = this.apertureEdgeMat;
        } else {
            // For doors, windows, and jali panels: render a cutout void box cutting through the wall at localX = projDist
            const cutoutThick = thick + 4;
            const cutoutH = itemH;
            const cutoutY = elev + cutoutH / 2;

            this.apertureVoidMesh.geometry.dispose();
            this.apertureVoidMesh.geometry = new THREE.BoxGeometry(itemW, cutoutH, cutoutThick);
            this.apertureVoidMesh.position.set(projDist, cutoutY, 0);

            this.apertureVoidMat.color.setHex(isValid ? 0x00f0ff : 0xef4444);
            this.apertureVoidMat.opacity = isValid ? 0.25 : 0.45;

            this.apertureEdges.geometry.dispose();
            this.apertureEdges.geometry = new THREE.EdgesGeometry(this.apertureVoidMesh.geometry);
            this.apertureEdges.position.copy(this.apertureVoidMesh.position);
            this.apertureEdges.material = isValid ? this.apertureEdgeMat : this.apertureEdgeMatInvalid;
        }

        // Rebuild Real 3D Model in Preview Group
        const wallId = wallEntity.id || wallEntity.uid || `${p1.x}_${p1.y}_${p2.x}_${p2.y}`;
        const toolKey = isMoldingOrTrim 
            ? `${wallId}_${tool}_${itemW}_${itemH}_${elev}_${facing}_${localSL_x}_${localEL_x}_${localSR_x}_${localER_x}`
            : `${wallId}_${tool}_${itemW}_${itemH}_${depth}_${elev}_${facing}_${projDist}_${preset?.profileType || ''}`;

        if (this._lastToolKey !== toolKey) {
            this._lastToolKey = toolKey;
            this.rebuild3DModelPreview(tool, wallEntity, itemW, itemH, depth, elev, facing, thick, isMoldingOrTrim, isAttachedSurfaceElement, projDist, localSL_x, localSR_x, localEL_x, localER_x, wallLen);
        }
    }

    /**
     * Render the authentic 3D model (Doors, Windows, Jali, Sunshades, Fascia, Curtains, Wall Art, Baseboards, Moldings)
     */
    rebuild3DModelPreview(tool, wallEntity, itemW, itemH, depth, elev, facing, thick, isMoldingOrTrim, isAttachedSurfaceElement, projDist, localSL_x, localSR_x, localEL_x, localER_x, wallLen) {
        while (this.modelPreviewGroup.children.length > 0) {
            const child = this.modelPreviewGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            this.modelPreviewGroup.remove(child);
        }

        const planner = this.getPlanner();
        const preset = planner.activePresetParams || {};

        if (isMoldingOrTrim) {
            const moldMesh = this.molding3DBuilder.buildMolding({
                side: facing === 1 ? 'left' : 'right',
                width: itemW,
                t: 0.5,
                moldingHeight: itemH,
                depth: preset.depth || 2,
                heightOffset: elev,
                profileType: preset.profileType || (tool === 'molding' || tool.includes('crown') ? 'crown' : 'skirting_flat'),
                material: preset.material || 'white_paint'
            }, itemW, thick, this.ctx.helpers);

            if (moldMesh) {
                // Apply miter shear to preview mesh so corners match wall perfectly
                const shearMoldingGeo = (geo) => {
                    const pos = geo.attributes.position;
                    if (!pos) return;
                    for (let i = 0; i < pos.count; i++) {
                        const x = pos.getX(i);
                        const z = pos.getZ(i);
                        const tZ = (z + thick / 2) / thick;
                        const startX = localSR_x + tZ * (localSL_x - localSR_x);
                        const endX = localER_x + tZ * (localEL_x - localER_x);
                        
                        if (x <= 0.1) {
                            pos.setX(i, startX);
                        } else if (x >= wallLen - 0.1) {
                            pos.setX(i, endX);
                        }
                    }
                    geo.computeVertexNormals();
                };

                if (moldMesh.isGroup && moldMesh.children.length > 0 && moldMesh.children[0].geometry) {
                    shearMoldingGeo(moldMesh.children[0].geometry);
                } else if (moldMesh.geometry) {
                    shearMoldingGeo(moldMesh.geometry);
                }

                moldMesh.traverse(c => { c.raycast = () => {}; });
                this.modelPreviewGroup.add(moldMesh);
            }
            return;
        }

        const isCurtain = tool === 'curtain' || tool.startsWith('curtain_');
        const isWallArt = tool === 'wall_art' || tool.startsWith('decor_wall_') || tool.startsWith('decor_photo_');
        const isFascia = tool === 'elevation_fascia' || tool.startsWith('fascia_');
        const widgetConfigId = isFascia ? 'elevation_fascia' : (isCurtain ? 'curtain' : (isWallArt ? 'wall_art' : tool));

        const fakeEntity = {
            id: 'ghost_preview',
            type: widgetConfigId,
            configId: widgetConfigId,
            width: itemW,
            height: itemH,
            depth: depth,
            thick: preset.thick || 10,
            elevation: elev,
            facing: facing,
            side: 1,
            wall: wallEntity,
            localX: projDist,
            ...JSON.parse(JSON.stringify(preset))
        };

        const config = WIDGET_REGISTRY[widgetConfigId] || WIDGET_REGISTRY[tool] || MOLDING_REGISTRY[tool];
        if (config && config.render3D) {
            const helpers = this.ctx.helpers || {
                getDynamicMaterial: (id, slot) => {
                    return new THREE.MeshStandardMaterial({
                        color: 0x93c5fd,
                        roughness: 0.4,
                        transparent: true,
                        opacity: 0.85
                    });
                }
            };

            const tempContainer = new THREE.Group();
            config.render3D(tempContainer, fakeEntity, helpers);
            tempContainer.traverse(c => { c.raycast = () => {}; });
            this.modelPreviewGroup.add(tempContainer);
        }
    }

    onPointerDown(e) {
        if (!this.isPlacementTool() || !this.activeWall || this.activeT === null) return false;
        if (e.button !== 0) return false;
        if (!this.isValidPlacement) return false;

        const planner = this.getPlanner();
        if (!planner) return false;
        const tool = planner.tool;
        const wall = this.activeWall;
        const side = this.activeSide;
        const t = this.activeT;
        const elev = this.activeElevation;

        const preset = planner.activePresetParams || {};
        const isMolding = tool === 'molding' || tool === 'skirting' || tool.startsWith('molding_') || tool.startsWith('skirting_') || !!MOLDING_REGISTRY[tool] || (preset && (preset.type?.startsWith('molding_') || preset.profileType?.startsWith('skirting_')));
        const isCurtain = tool === 'curtain' || tool.startsWith('curtain_');
        const isWallArt = tool === 'wall_art' || tool.startsWith('decor_wall_') || tool.startsWith('decor_photo_');
        const isFascia = tool === 'elevation_fascia' || tool.startsWith('fascia_');
        const isWidget = !!WIDGET_REGISTRY[tool] || isCurtain || isWallArt || isFascia;

        let createdEntity = null;

        if (isMolding) {
            const moldType = MOLDING_REGISTRY[tool] ? tool : (preset.type || (tool === 'molding' ? 'molding_crown' : 'molding_skirting_flat'));
            createdEntity = new PremiumMolding(planner, wall, 0.5, moldType);
            const start = wall.startAnchor.position();
            const end = wall.endAnchor.position();
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const wallLen = Math.hypot(dx, dy);
            const wallH = wall.height || wall.config?.height || 180;
            const mH = preset.moldingHeight || (preset.height && preset.height <= 30 ? preset.height : 12);
            const isCrown = tool === 'molding' || moldType.includes('crown') || moldType.includes('frieze') || (preset.profileType && preset.profileType.includes('crown'));
            const heightOffset = isCrown ? Math.max(0, wallH - mH) : (preset.heightOffset || 0);

            createdEntity.side = (side === 'front') ? 'left' : 'right';
            createdEntity.width = wallLen;
            createdEntity.moldingHeight = mH;
            createdEntity.depth = preset.depth || 2;
            createdEntity.heightOffset = heightOffset;
            createdEntity.profileType = preset.profileType || (isCrown ? 'crown' : 'skirting_flat');
            if (preset.material) createdEntity.material = preset.material;

            if (preset) {
                Object.assign(createdEntity, JSON.parse(JSON.stringify(preset)));
                createdEntity.side = (side === 'front') ? 'left' : 'right';
                createdEntity.width = wallLen;
                createdEntity.heightOffset = heightOffset;
            }
            createdEntity.update();
            if (!wall.attachedMoldings) wall.attachedMoldings = [];
            wall.attachedMoldings.push(createdEntity);
            planner.selectEntity(createdEntity, 'molding');
        } else if (isWidget) {
            const widgetType = isFascia ? 'elevation_fascia' : (isCurtain ? 'curtain' : (isWallArt ? 'wall_art' : tool));
            createdEntity = new PremiumWidget(planner, wall, t, widgetType);
            createdEntity.facing = (side === 'back') ? -1 : 1;
            createdEntity.elevation = elev;
            if (planner.activePresetParams) {
                Object.assign(createdEntity, JSON.parse(JSON.stringify(planner.activePresetParams)));
                createdEntity.facing = (side === 'back') ? -1 : 1;
                createdEntity.elevation = elev;
                createdEntity.update();
            }
            if (!wall.attachedWidgets) wall.attachedWidgets = [];
            if (!wall.attachedWidgets.includes(createdEntity)) {
                wall.attachedWidgets.push(createdEntity);
            }
            planner.selectEntity(createdEntity, 'widget');
        }

        // Save history
        if (coreEventBus) {
            coreEventBus.emit(EVENTS.SAVE_HISTORY, { action: `Place ${tool} in 3D` });
        }
        planner.syncAll();

        // 3D In-Place CAD Rebuild
        if (this.ctx.envBuilder && this.ctx.envBuilder.buildWallGroup) {
            this.ctx.envBuilder.buildWallGroup(wall);
        }

        if (this.ctx.buildScene && planner) {
            const levelsConfigArray = (planner.levels || []).map(l => ({ data: l.data, isVisible: l.isVisible !== false }));
            this.ctx.buildScene(
                planner.walls,
                planner.rooms,
                planner.stairs || [],
                planner.furniture || [],
                planner.roofs || [],
                planner.shapes || [],
                levelsConfigArray,
                planner.activeLevelIndex || 0,
                this.ctx.viewMode3D || 'full-edit',
                true,
                planner.outdoorZones || []
            );
        }

        if (this.ctx.requestRender) {
            this.ctx.requestRender('3D Placement Complete', 5);
        }

        // Select new 3D entity smoothly without abruptly moving the camera
        if (createdEntity && createdEntity.mesh3D && this.interactions) {
            createdEntity.mesh3D.updateWorldMatrix(true, true);
            this.interactions.selectObject(createdEntity.mesh3D, null, true);
        }

        this.hideGhost();
        return true;
    }

    hideGhost() {
        let changed = false;
        if (this.placementGroup && this.placementGroup.visible) {
            this.placementGroup.visible = false;
            changed = true;
        }
        if (this.badgeDom) this.badgeDom.style.display = 'none';
        this.activeWall = null;
        this.activeT = null;
        this._lastToolKey = null;
        if (changed && this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    dispose() {
        this.hideGhost();
        if (this.badgeDom && this.badgeDom.parentNode) {
            this.badgeDom.parentNode.removeChild(this.badgeDom);
        }
        if (this.placementGroup) {
            this.ctx.scene.remove(this.placementGroup);
        }
    }
}

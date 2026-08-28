import * as THREE from 'three';
import { WIDGET_REGISTRY, MOLDING_REGISTRY, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT } from '../registry.js';
import { PremiumWidget } from '../engine2d/PremiumWidget.js';
import { PremiumMolding } from '../engine2d/PremiumMolding.js';
import { coreEventBus } from '../EventBus.js';
import { EVENTS } from '../constants/events.js';
import { ComponentRegistry } from './ComponentRegistry.js';

/**
 * WallPlugin3DPlacementSystem
 * 
 * True Sims 4-Style 3D Wall Placement & Real-Time Wall Aperture Highlighting.
 * Features:
 * - Exact Wall Aperture Cutout Highlight & Footprint Glow
 * - Real 3D Model Preview (Door/Window/Plugin rendering in-place)
 * - Collision & Overlap Detection (Valid Cyan vs Invalid Red Aperture)
 * - 1-Click Placement with instant CAD opening rebuild and Gizmo selection
 * - Distance HUD Tooltip
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

        // Container for all 3D Ghost and Highlight elements
        this.placementGroup = new THREE.Group();
        this.placementGroup.name = 'Sims4_WallPlacement_Group';
        this.placementGroup.visible = false;
        this.ctx.scene.add(this.placementGroup);

        // 1. Aperture Cutout Void Box (Semi-transparent cutout volume)
        this.apertureVoidMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.22,
            depthTest: false,
            side: THREE.DoubleSide
        });
        this.apertureVoidMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.apertureVoidMat);
        this.apertureVoidMesh.renderOrder = 1005;
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
        this.placementGroup.add(this.apertureEdges);

        // 3. Container for the Actual 3D Model Preview
        this.modelPreviewGroup = new THREE.Group();
        this.placementGroup.add(this.modelPreviewGroup);

        // Floating DOM HUD Badge
        this.badgeDom = document.createElement('div');
        this.badgeDom.id = 'sims4-wall-plugin-badge';
        this.badgeDom.style.cssText = `
            position: fixed;
            display: none;
            pointer-events: none;
            background: rgba(15, 23, 42, 0.9);
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

        const isOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut', 'opening'].includes(tool);
        const isMolding = tool === 'molding' || tool === 'skirting' || !!MOLDING_REGISTRY[tool];
        const isWidget = !!WIDGET_REGISTRY[tool];
        const isDoorWindow = tool.startsWith('door') || tool.startsWith('window');

        return isOpening || isMolding || isWidget || isDoorWindow;
    }

    getPlanner() {
        return this.ctx.planner || window.planner || (this.ctx.appState && this.ctx.appState.planner);
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

        // Intersect wall side meshes
        const interactables = this.ctx.interactables || [];
        const intersects = this.raycaster.intersectObjects(interactables, true);
        const wallHit = intersects.find(i => {
            const obj = i.object;
            return obj && (obj.userData?.isWallSide || obj.userData?.entity?.type === 'outer' || obj.userData?.entity?.type === 'inner' || obj.userData?.entity?.type === 'wall' || obj.userData?.parentWall);
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

        // Detect Wall Side (front vs back)
        const hitNormal = wallHit.face ? wallHit.face.normal.clone().applyQuaternion(hitMesh.getWorldQuaternion(new THREE.Quaternion())) : new THREE.Vector3(0, 0, 1);
        const wallNormal2D = new THREE.Vector2(-wallDirY, wallDirX);
        const dotSide = hitNormal.x * wallNormal2D.x + hitNormal.z * wallNormal2D.y;
        const side = dotSide > 0 ? 'front' : 'back';
        const facing = (side === 'back') ? -1 : 1;

        // Dimensions & Elevation calculations
        const preset = planner.activePresetParams || {};
        const thick = wallEntity.thickness || wallEntity.config?.thickness || 20;
        const wallH = wallEntity.height || wallEntity.config?.height || 180;

        let itemW = preset.width || (tool.startsWith('door') ? 40 : (tool.startsWith('window') ? 60 : (tool === 'elevation_corner_element' ? 26 : 80)));
        let itemH = preset.height || (tool.startsWith('door') ? DOOR_HEIGHT : (tool.startsWith('window') ? WINDOW_HEIGHT : (tool === 'elevation_corner_element' ? wallH : 20)));
        let elev = 0;

        let t = projDist / wallLen;

        if (tool === 'elevation_corner_element') {
            t = (t < 0.5) ? 0 : 1;
            projDist = t * wallLen;
            elev = preset.elevation !== undefined ? preset.elevation : 0;
            itemH = wallH;
        } else if (tool === 'elevation_frieze') {
            const fH = preset.height || 18;
            elev = Math.max(0, wallH - fH);
            t = Math.max(0, Math.min(1, t));
        } else if (tool === 'elevation_foundation_trim') {
            elev = 0;
            t = Math.max(0, Math.min(1, t));
        } else if (tool.startsWith('door')) {
            elev = 0;
            const halfWT = (itemW / 2) / wallLen;
            t = Math.max(halfWT, Math.min(1 - halfWT, t));
            projDist = t * wallLen;
        } else if (tool.startsWith('window')) {
            elev = preset.elevation !== undefined ? preset.elevation : (preset.sillHeight || WINDOW_SILL || 80);
            const halfWT = (itemW / 2) / wallLen;
            t = Math.max(halfWT, Math.min(1 - halfWT, t));
            projDist = t * wallLen;
        } else {
            elev = preset.elevation !== undefined ? preset.elevation : Math.max(0, hitPt.y);
            t = Math.max(0.02, Math.min(0.98, t));
            projDist = t * wallLen;
        }

        // Overlap Validation Check
        let isValid = true;
        if (wallEntity.attachedWidgets && wallEntity.attachedWidgets.length > 0) {
            const pMin = projDist - itemW / 2;
            const pMax = projDist + itemW / 2;
            for (let w of wallEntity.attachedWidgets) {
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

        // Position & Update Aperture Highlight & 3D Model
        this.updateApertureAndModel(tool, wallEntity, t, elev, facing, wallLen, dx, dy, p1, p2, thick, wallH, itemW, itemH, isValid);

        // Update HUD Badge
        const toolLabel = WIDGET_REGISTRY[tool]?.label || MOLDING_REGISTRY[tool]?.label || tool.toUpperCase().replace(/_/g, ' ');
        const distFromStart = Math.round(t * wallLen);
        const distFromEnd = Math.round((1 - t) * wallLen);
        const statusColor = isValid ? '#00f0ff' : '#ef4444';
        const statusText = isValid ? `${distFromStart}cm ← → ${distFromEnd}cm` : 'Space Occupied';

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
        return true;
    }

    /**
     * Position the glowing Sims 4 wall cutout aperture and live 3D preview model
     */
    updateApertureAndModel(tool, wallEntity, t, elev, facing, wallLen, dx, dy, p1, p2, thick, wallH, itemW, itemH, isValid) {
        const angleY = -Math.atan2(dy, dx);
        const posX = p1.x + dx * t;
        const posZ = p1.y + dy * t;
        const wallOffset = (thick / 2) * facing;

        // Position Master Group at wall placement center
        this.placementGroup.position.set(posX, 0, posZ);
        this.placementGroup.rotation.y = angleY;
        this.placementGroup.visible = true;

        // Update Aperture Cutout Void Geometry
        const cutoutThick = thick + 4;
        const cutoutH = itemH;
        const cutoutY = elev + cutoutH / 2;

        this.apertureVoidMesh.geometry.dispose();
        this.apertureVoidMesh.geometry = new THREE.BoxGeometry(itemW, cutoutH, cutoutThick);
        this.apertureVoidMesh.position.set(0, cutoutY, 0);

        this.apertureVoidMat.color.setHex(isValid ? 0x00f0ff : 0xef4444);
        this.apertureVoidMat.opacity = isValid ? 0.25 : 0.45;

        // Update Glowing Edges
        this.apertureEdges.geometry.dispose();
        const edgeGeo = new THREE.EdgesGeometry(this.apertureVoidMesh.geometry);
        this.apertureEdges.geometry = edgeGeo;
        this.apertureEdges.position.copy(this.apertureVoidMesh.position);
        this.apertureEdges.material = isValid ? this.apertureEdgeMat : this.apertureEdgeMatInvalid;

        // Rebuild Real 3D Model in Preview Group
        const toolKey = `${tool}_${itemW}_${itemH}_${elev}_${facing}`;
        if (this._lastToolKey !== toolKey) {
            this._lastToolKey = toolKey;
            this.rebuild3DModelPreview(tool, wallEntity, itemW, itemH, elev, facing, thick);
        }
    }

    /**
     * Render the authentic 3D model (Doors, Windows, Quoins, Friezes) in the preview group
     */
    rebuild3DModelPreview(tool, wallEntity, itemW, itemH, elev, facing, thick) {
        while (this.modelPreviewGroup.children.length > 0) {
            const child = this.modelPreviewGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            this.modelPreviewGroup.remove(child);
        }

        const planner = this.getPlanner();
        const preset = planner.activePresetParams || {};

        const fakeEntity = {
            id: 'ghost_preview',
            type: tool,
            configId: tool,
            width: itemW,
            height: itemH,
            elevation: elev,
            facing: facing,
            side: 1,
            wall: wallEntity,
            thick: thick,
            localX: 0,
            ...JSON.parse(JSON.stringify(preset))
        };

        const config = WIDGET_REGISTRY[tool] || MOLDING_REGISTRY[tool];
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

        const isAdvancedOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(tool);
        const isMolding = tool === 'molding' || tool === 'skirting' || !!MOLDING_REGISTRY[tool];
        const isWidget = !!WIDGET_REGISTRY[tool];

        let createdEntity = null;

        if (isWidget) {
            createdEntity = new PremiumWidget(planner, wall, t, tool);
            createdEntity.facing = (side === 'back') ? -1 : 1;
            if (planner.activePresetParams) {
                Object.assign(createdEntity, JSON.parse(JSON.stringify(planner.activePresetParams)));
                createdEntity.facing = (side === 'back') ? -1 : 1;
                createdEntity.update();
            }
            if (!wall.attachedWidgets) wall.attachedWidgets = [];
            if (!wall.attachedWidgets.includes(createdEntity)) {
                wall.attachedWidgets.push(createdEntity);
            }
            planner.selectEntity(createdEntity, 'widget');
        } else if (isMolding) {
            const moldType = MOLDING_REGISTRY[tool] ? tool : (planner.activePresetParams?.type || 'molding_skirting_flat');
            createdEntity = new PremiumMolding(planner, wall, 0.5, moldType);
            const start = wall.startAnchor.position();
            const end = wall.endAnchor.position();
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            createdEntity.side = (side === 'front') ? 'left' : 'right';
            createdEntity.width = Math.hypot(dx, dy);
            if (planner.activePresetParams) {
                Object.assign(createdEntity, JSON.parse(JSON.stringify(planner.activePresetParams)));
                createdEntity.side = (side === 'front') ? 'left' : 'right';
                createdEntity.width = Math.hypot(dx, dy);
            }
            createdEntity.update();
            if (!wall.attachedMoldings) wall.attachedMoldings = [];
            wall.attachedMoldings.push(createdEntity);
            planner.selectEntity(createdEntity, 'molding');
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
        if (this.placementGroup) this.placementGroup.visible = false;
        if (this.badgeDom) this.badgeDom.style.display = 'none';
        this.activeWall = null;
        this.activeT = null;
        this._lastToolKey = null;
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

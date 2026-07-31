import * as THREE from 'three';
import { coreEventBus } from '../EventBus.js';
import { EVENTS } from '../constants/events.js';

export const HIGHLIGHT_CONFIG = {
    SURFACE_OFFSET: 0.2, // Increased from 0.05 to prevent z-fighting
    SELECTION_OPACITY: 0.35,
    SELECTION_OPACITY_MATERIAL_MODE: 0.15,
    HOVER_OPACITY: 0.25,
    POLYGON_OFFSET_FACTOR: -4, // Stronger pull towards camera
    POLYGON_OFFSET_UNITS: -4, // Stronger pull towards camera
    SELECTION_COLOR: 0x3b82f6,
    HOVER_COLOR: 0x93c5fd,
    BIM_HIGHLIGHT_COLOR: 0x00ff00
};

/**
 * Universal HighlightRenderer for 3D Selection & Hover Visualizations.
 * Handles editor-only highlight geometry creation, depth/renderOrder management,
 * capability-driven universal refresh, and clean resource disposal.
 */
export class HighlightRenderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.selectedObject = null;
        this.hoveredObject = null;
        this.currentMode = 'normal'; // 'normal', 'material', 'transform'

        // Shared editor-only highlight meshes for walls
        const geoSelect = new THREE.PlaneGeometry(1, 1);
        const matSelect = new THREE.MeshBasicMaterial({
            color: HIGHLIGHT_CONFIG.SELECTION_COLOR,
            transparent: true,
            opacity: HIGHLIGHT_CONFIG.SELECTION_OPACITY,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: HIGHLIGHT_CONFIG.POLYGON_OFFSET_FACTOR,
            polygonOffsetUnits: HIGHLIGHT_CONFIG.POLYGON_OFFSET_UNITS
        });
        this.wallSelectionMesh = new THREE.Mesh(geoSelect, matSelect);
        this.wallSelectionMesh.raycast = function() {};
        this.wallSelectionMesh.visible = false;
        this.wallSelectionMesh.renderOrder = 998;

        const geoHover = new THREE.PlaneGeometry(1, 1);
        const matHover = new THREE.MeshBasicMaterial({
            color: HIGHLIGHT_CONFIG.HOVER_COLOR,
            transparent: true,
            opacity: HIGHLIGHT_CONFIG.HOVER_OPACITY,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: HIGHLIGHT_CONFIG.POLYGON_OFFSET_FACTOR,
            polygonOffsetUnits: HIGHLIGHT_CONFIG.POLYGON_OFFSET_UNITS
        });
        this.wallHoverMesh = new THREE.Mesh(geoHover, matHover);
        this.wallHoverMesh.raycast = function() {};
        this.wallHoverMesh.visible = false;
        this.wallHoverMesh.renderOrder = 997;

        // Active emissive tracking map to prevent material pollution
        this._activeEmissiveTargets = new Set();

        // Subscribe to event bus for automatic scene/entity updates
        this._onEntityModified = (data) => {
            if (this.selectedObject) {
                const targetEnt = data?.entity;
                if (!targetEnt || (this.selectedObject.userData?.entity === targetEnt)) {
                    this.refresh(this.selectedObject);
                }
            }
        };
        this._onSceneChanged = () => {
            if (this.selectedObject) {
                this.refresh(this.selectedObject);
            }
        };

        this._unsubModified = coreEventBus.on(EVENTS.ENTITY_MODIFIED, this._onEntityModified);
        this._unsubObjectUpdated = coreEventBus.on(EVENTS.OBJECT_UPDATED, this._onEntityModified);
        this._unsubSceneChanged = coreEventBus.on(EVENTS.SCENE_CHANGED, this._onSceneChanged);
    }

    setMode(mode) {
        this.currentMode = mode || 'normal';
        if (this.selectedObject) {
            this.setSelectionHighlight(this.selectedObject, this.currentMode);
        }
    }

    setSelectionHighlight(object, mode = 'normal') {
        if (!object) {
            this.clearSelectionHighlight();
            return;
        }

        // If switching to material mode, update opacity or hide depending on selection state
        if (this.selectedObject && this.selectedObject !== object) {
            this.clearSelectionHighlight();
        }

        this.selectedObject = object;
        this.currentMode = mode;

        if (mode === 'material') {
            // In material mode, hide standard wall selection highlight so face highlights operate cleanly
            if (object.userData && object.userData.isWallSide) {
                this._detachMesh(this.wallSelectionMesh);
                return;
            }
        }

        if (object.userData && object.userData.isWallSide) {
            this._buildWallHighlight(object, this.wallSelectionMesh, mode);
        } else {
            this._applyEmissiveHighlight(object, true, HIGHLIGHT_CONFIG.SELECTION_COLOR, mode);
        }

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    setHoverHighlight(object) {
        if (!object || object === this.selectedObject) {
            this.clearHoverHighlight();
            return;
        }

        if (this.hoveredObject && this.hoveredObject !== object) {
            this.clearHoverHighlight();
        }

        this.hoveredObject = object;

        if (object.userData && object.userData.isWallSide) {
            this._buildWallHighlight(object, this.wallHoverMesh, 'hover');
        } else {
            this._applyEmissiveHighlight(object, true, HIGHLIGHT_CONFIG.HOVER_COLOR, 'hover');
        }

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    refresh(selectedObject = null) {
        const objToRefresh = selectedObject || this.selectedObject;
        if (!objToRefresh) return;

        if (objToRefresh.userData && objToRefresh.userData.isWallSide) {
            this._buildWallHighlight(objToRefresh, this.wallSelectionMesh, this.currentMode);
        } else {
            this._applyEmissiveHighlight(objToRefresh, true, HIGHLIGHT_CONFIG.SELECTION_COLOR, this.currentMode);
        }

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    clearSelectionHighlight() {
        if (this.wallSelectionMesh.parent) {
            this.wallSelectionMesh.parent.remove(this.wallSelectionMesh);
        }
        this.wallSelectionMesh.visible = false;

        if (this.selectedObject && (!this.selectedObject.userData || !this.selectedObject.userData.isWallSide)) {
            this._applyEmissiveHighlight(this.selectedObject, false);
        }

        this.selectedObject = null;

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    clearHoverHighlight() {
        if (this.wallHoverMesh.parent) {
            this.wallHoverMesh.parent.remove(this.wallHoverMesh);
        }
        this.wallHoverMesh.visible = false;

        if (this.hoveredObject && (!this.hoveredObject.userData || !this.hoveredObject.userData.isWallSide)) {
            this._applyEmissiveHighlight(this.hoveredObject, false);
        }

        this.hoveredObject = null;

        if (this.ctx && typeof this.ctx.requestRender === 'function') {
            this.ctx.requestRender();
        }
    }

    clearAll() {
        this.clearHoverHighlight();
        this.clearSelectionHighlight();

        // Clear any residual emissive targets
        this._activeEmissiveTargets.forEach(mat => {
            if (mat && mat.userData && mat.userData.origEmissive !== undefined) {
                mat.emissive.setHex(mat.userData.origEmissive);
                mat.emissiveIntensity = mat.userData.origEmissiveIntensity || 0;
                delete mat.userData.origEmissive;
                delete mat.userData.origEmissiveIntensity;
                mat.needsUpdate = true;
            }
        });
        this._activeEmissiveTargets.clear();
    }

    _detachMesh(mesh) {
        if (mesh.parent) mesh.parent.remove(mesh);
        mesh.visible = false;
    }

    _buildWallHighlight(object, targetMesh, mode = 'normal') {
        const side = object.userData.side;
        const wallGroup = object.parent;
        if (!wallGroup || !wallGroup.userData || !wallGroup.userData.entity) return;
        const w = wallGroup.userData.entity;

        wallGroup.add(targetMesh);

        let maxDepth = 0;
        if (w.attachedDecor) {
            w.attachedDecor.forEach(d => {
                if (d.side === side && d.depth > maxDepth) maxDepth = d.depth;
            });
        }

        const isRailing = w.type === 'railing';
        let currentH = w.height !== undefined ? w.height : (w.config?.height || (isRailing ? 0 : 300));
        const currentT = w.thickness !== undefined ? w.thickness : (w.config?.thickness || (isRailing ? 4 : 8));
        const totalH = isRailing ? currentH + 40 : currentH;

        const profileType = w.topProfileType || 'normal';
        const startH = w.startHeight !== undefined ? w.startHeight : totalH;
        const endH = w.endHeight !== undefined ? w.endHeight : totalH;
        const peakH = w.peakHeight !== undefined ? w.peakHeight : totalH;

        // ZERO PADDING: hlWidth and hlHeight match exact wall dimensions
        const hlWidth = w.length3D + (maxDepth * 2);
        const hlHeight = totalH;
        const halfW = hlWidth / 2;

        const shape = new THREE.Shape();
        shape.moveTo(-halfW, -hlHeight / 2);
        shape.lineTo(halfW, -hlHeight / 2);

        if (profileType === 'single') {
            shape.lineTo(halfW, endH - (totalH / 2));
            shape.lineTo(-halfW, startH - (totalH / 2));
        } else if (profileType === 'gable') {
            shape.lineTo(halfW, endH - (totalH / 2));
            shape.lineTo(0, peakH - (totalH / 2));
            shape.lineTo(-halfW, startH - (totalH / 2));
        } else {
            shape.lineTo(halfW, hlHeight / 2);
            shape.lineTo(-halfW, hlHeight / 2);
        }
        shape.lineTo(-halfW, -hlHeight / 2);

        // Openings Cutouts
        if (w.attachedWidgets) {
            w.attachedWidgets.forEach(widg => {
                const type = widg.type || widg.configId;
                const isOpening = ['door', 'window', 'jali_panel', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(type);
                if (!isOpening) return;

                const wCenter = w.length3D * widg.t;
                const halfOpeningW = widg.width / 2;
                const cx = w.length3D / 2;
                const cy = totalH / 2;
                const hx_min = (wCenter - halfOpeningW) - cx;
                const hx_max = (wCenter + halfOpeningW) - cx;

                let elev = widg.elevation;
                if (elev === undefined) elev = (type === 'window') ? 35 : 0;
                let h_opening = widg.height;
                if (h_opening === undefined) h_opening = (type === 'door') ? 80 : ((type === 'window') ? 45 : 200);
                elev = Math.max(0, Math.min(elev, currentH));
                h_opening = Math.max(0, Math.min(h_opening, currentH - elev));
                const w_y_min = elev;
                const w_y_max = elev + h_opening;

                if (w_y_max > w_y_min) {
                    const hy_min = w_y_min - cy;
                    const hy_max = w_y_max - cy;
                    const hole = new THREE.Path();
                    const hCenter = wCenter - cx;

                    if (type === 'arch_opening') {
                        const radius = halfOpeningW;
                        const straightH = Math.max(0, (hy_max - hy_min) - radius);
                        hole.moveTo(hx_min, hy_min);
                        hole.lineTo(hx_max, hy_min);
                        hole.lineTo(hx_max, hy_min + straightH);
                        if (radius > 0) hole.absarc(hCenter, hy_min + straightH, radius, 0, Math.PI, false);
                        hole.lineTo(hx_min, hy_min);
                        shape.holes.push(hole);
                    } else if (type === 'circular_opening') {
                        hole.moveTo(hx_max, hy_min + (hy_max - hy_min) / 2);
                        hole.absellipse(hCenter, hy_min + (hy_max - hy_min) / 2, halfOpeningW, (hy_max - hy_min) / 2, 0, Math.PI * 2, false, 0);
                        shape.holes.push(hole);
                    } else if (type === 'custom_shape_opening') {
                        hole.moveTo(hCenter, hy_min);
                        hole.lineTo(hx_max, hy_min + (hy_max - hy_min) / 2);
                        hole.lineTo(hCenter, hy_max);
                        hole.lineTo(hx_min, hy_min + (hy_max - hy_min) / 2);
                        hole.lineTo(hCenter, hy_min);
                        shape.holes.push(hole);
                    } else {
                        hole.moveTo(hx_min, hy_min);
                        hole.lineTo(hx_max, hy_min);
                        hole.lineTo(hx_max, hy_max);
                        hole.lineTo(hx_min, hy_max);
                        hole.lineTo(hx_min, hy_min);
                        shape.holes.push(hole);
                    }
                }
            });
        }

        if (targetMesh.geometry) targetMesh.geometry.dispose();
        targetMesh.geometry = new THREE.ShapeGeometry(shape);
        targetMesh.scale.set(1, 1, 1);

        // Precise zOffset sitting flush against wall face
        const zOffset = side === 'front' ? (currentT / 2 + maxDepth + HIGHLIGHT_CONFIG.SURFACE_OFFSET) : (-currentT / 2 - maxDepth - HIGHLIGHT_CONFIG.SURFACE_OFFSET);

        // Shearing logic for miter joints
        const startProfile = w.wallShapeData ? w.wallShapeData.startProfile : w.startProfile;
        const endProfile = w.wallShapeData ? w.wallShapeData.endProfile : w.endProfile;
        const pts = (w.poly && typeof w.poly.points === 'function') ? w.poly.points() : w.pts;

        if (startProfile && endProfile && !isRailing) {
            const p1 = w.startAnchor ? w.startAnchor.position() : { x: w.startX, y: w.startY };
            const p2 = w.endAnchor ? w.endAnchor.position() : { x: w.endX, y: w.endY };
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

            const toLocal = (ptX, ptY) => {
                const dx = ptX - p1.x;
                const dy = ptY - p1.y;
                const c = Math.cos(angle);
                const s = Math.sin(angle);
                return { x: dx * c + dy * s, z: -dx * s + dy * c };
            };
            const startProfileLocal = startProfile.map(p => toLocal(p.x, p.y)).sort((a, b) => a.z - b.z);
            const endProfileLocal = endProfile.map(p => toLocal(p.x, p.y)).sort((a, b) => a.z - b.z);

            const interpolateX = (profile, zTarget) => {
                if (profile.length === 1) return profile[0].x;
                if (zTarget <= profile[0].z) return profile[0].x;
                if (zTarget >= profile[profile.length - 1].z) return profile[profile.length - 1].x;
                for (let j = 0; j < profile.length - 1; j++) {
                    const pr1 = profile[j];
                    const pr2 = profile[j + 1];
                    if (zTarget >= pr1.z && zTarget <= pr2.z) {
                        if (pr2.z === pr1.z) return pr1.x;
                        const tr = (zTarget - pr1.z) / (pr2.z - pr1.z);
                        return pr1.x + tr * (pr2.x - pr1.x);
                    }
                }
                return profile[0].x;
            };

            const pos = targetMesh.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const vx = pos.getX(i);
                const wallX = (w.length3D / 2) + vx;
                const startX = interpolateX(startProfileLocal, zOffset);
                const endX = interpolateX(endProfileLocal, zOffset);

                let shearedWallX = wallX;
                if (wallX <= 0.1) {
                    shearedWallX = startX;
                } else if (wallX >= w.length3D - 0.1) {
                    shearedWallX = endX;
                }
                pos.setX(i, shearedWallX - w.length3D / 2);
            }
            targetMesh.geometry.computeVertexNormals();
            targetMesh.geometry.computeBoundingBox();
            targetMesh.geometry.computeBoundingSphere();
        } else if (pts && pts.length === 8 && !isRailing) {
            const p1 = w.startAnchor ? w.startAnchor.position() : { x: w.startX, y: w.startY };
            const p2 = w.endAnchor ? w.endAnchor.position() : { x: w.endX, y: w.endY };
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

            const toLocalX = (ptX, ptY) => {
                const dx_pt = ptX - p1.x;
                const dy_pt = ptY - p1.y;
                return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
            };
            const localSL_x = toLocalX(pts[0], pts[1]);
            const localEL_x = toLocalX(pts[2], pts[3]);
            const localER_x = toLocalX(pts[4], pts[5]);
            const localSR_x = toLocalX(pts[6], pts[7]);

            const pos = targetMesh.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const vx = pos.getX(i);
                const wallX = (w.length3D / 2) + vx;
                const tZ = (zOffset + currentT / 2) / currentT;
                const startX = localSR_x + tZ * (localSL_x - localSR_x);
                const endX = localER_x + tZ * (localEL_x - localER_x);

                let shearedWallX = wallX;
                if (wallX <= 0.1) {
                    shearedWallX = startX;
                } else if (wallX >= w.length3D - 0.1) {
                    shearedWallX = endX;
                }
                pos.setX(i, shearedWallX - w.length3D / 2);
            }
            targetMesh.geometry.computeVertexNormals();
            targetMesh.geometry.computeBoundingBox();
            targetMesh.geometry.computeBoundingSphere();
        }

        if (isRailing) {
            const p1 = w.startAnchor ? w.startAnchor.position() : { x: w.startX, y: w.startY };
            const p2 = w.endAnchor ? w.endAnchor.position() : { x: w.endX, y: w.endY };
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            targetMesh.position.set(p1.x, totalH / 2, p1.y);
            targetMesh.rotation.set(0, -angle, 0);
            targetMesh.translateX(w.length3D / 2);
            targetMesh.translateZ(zOffset);
        } else {
            targetMesh.position.set(w.length3D / 2, totalH / 2, zOffset);
            targetMesh.rotation.set(0, 0, 0);
        }

        // Adjust opacity according to mode
        const targetOpacity = (mode === 'material')
            ? HIGHLIGHT_CONFIG.SELECTION_OPACITY_MATERIAL_MODE
            : (mode === 'hover' ? HIGHLIGHT_CONFIG.HOVER_OPACITY : HIGHLIGHT_CONFIG.SELECTION_OPACITY);
        targetMesh.material.opacity = targetOpacity;
        targetMesh.visible = true;
    }

    _applyEmissiveHighlight(group, active, color = HIGHLIGHT_CONFIG.SELECTION_COLOR, mode = 'normal') {
        if (!group || typeof group.traverse !== 'function') return;

        const targetIntensity = (mode === 'hover') ? 0.25 : (mode === 'material' ? 0.15 : 0.5);

        group.traverse((child) => {
            if (child.isMesh && !child.userData?.isHitbox && child.material && child.material.type !== 'MeshBasicMaterial') {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    if (mat && mat.emissive !== undefined) {
                        if (active) {
                            if (mat.userData.origEmissive === undefined) {
                                mat.userData.origEmissive = mat.emissive.getHex();
                                mat.userData.origEmissiveIntensity = mat.emissiveIntensity || 0;
                            }
                            mat.emissive.setHex(color);
                            mat.emissiveIntensity = targetIntensity;
                            mat.needsUpdate = true;
                            this._activeEmissiveTargets.add(mat);
                        } else {
                            if (mat.userData.origEmissive !== undefined) {
                                mat.emissive.setHex(mat.userData.origEmissive);
                                mat.emissiveIntensity = mat.userData.origEmissiveIntensity;
                                delete mat.userData.origEmissive;
                                delete mat.userData.origEmissiveIntensity;
                                mat.needsUpdate = true;
                            }
                            this._activeEmissiveTargets.delete(mat);
                        }
                    }
                });
            }
        });
    }

    dispose() {
        if (this._unsubModified) this._unsubModified();
        if (this._unsubObjectUpdated) this._unsubObjectUpdated();
        if (this._unsubSceneChanged) this._unsubSceneChanged();

        this.clearAll();

        if (this.wallSelectionMesh.geometry) this.wallSelectionMesh.geometry.dispose();
        if (this.wallSelectionMesh.material) this.wallSelectionMesh.material.dispose();

        if (this.wallHoverMesh.geometry) this.wallHoverMesh.geometry.dispose();
        if (this.wallHoverMesh.material) this.wallHoverMesh.material.dispose();
    }
}

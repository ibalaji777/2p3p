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
        this.matSelect = new THREE.MeshBasicMaterial({
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
        this.wallSelectionMesh = new THREE.Mesh(geoSelect, this.matSelect);
        this.wallSelectionMesh.raycast = function() {};
        this.wallSelectionMesh.visible = false;
        this.wallSelectionMesh.renderOrder = 998;

        const geoHover = new THREE.PlaneGeometry(1, 1);
        this.matHover = new THREE.MeshBasicMaterial({
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
        this.wallHoverMesh = new THREE.Mesh(geoHover, this.matHover);
        this.wallHoverMesh.raycast = function() {};
        this.wallHoverMesh.visible = false;
        this.wallHoverMesh.renderOrder = 997;

        // Pools for curved wall multi-segment highlighting
        this.arcSelectionMeshes = [];
        this.arcHoverMeshes = [];

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

    _getOrCreateArcSelectionMesh(index) {
        if (!this.arcSelectionMeshes[index]) {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.matSelect);
            mesh.raycast = function() {};
            mesh.renderOrder = 998;
            mesh.visible = false;
            this.arcSelectionMeshes[index] = mesh;
        }
        return this.arcSelectionMeshes[index];
    }

    _getOrCreateArcHoverMesh(index) {
        if (!this.arcHoverMeshes[index]) {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.matHover);
            mesh.raycast = function() {};
            mesh.renderOrder = 997;
            mesh.visible = false;
            this.arcHoverMeshes[index] = mesh;
        }
        return this.arcHoverMeshes[index];
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

        if (this.selectedObject && this.selectedObject !== object) {
            this.clearSelectionHighlight();
        }

        this.selectedObject = object;
        this.currentMode = mode;

        if (mode === 'material') {
            // In material mode, hide standard wall selection highlight so face highlights operate cleanly
            if (object.userData && object.userData.isWallSide) {
                this._detachMesh(this.wallSelectionMesh);
                if (this.arcSelectionMeshes) this.arcSelectionMeshes.forEach(m => this._detachMesh(m));
                return;
            }
        }

        if (object.userData && object.userData.isWallSide) {
            const wallEntity = object.userData?.entity || object.parent?.userData?.entity;
            const side = object.userData.side || 'front';
            
            if (wallEntity?.parentArc && wallEntity.parentArc.walls && wallEntity.parentArc.walls.length > 0) {
                this._detachMesh(this.wallSelectionMesh);
                wallEntity.parentArc.walls.forEach((siblingWall, idx) => {
                    const sideMesh = siblingWall.mesh3D?.children?.find(c => c.userData?.isWallSide && c.userData?.side === side)
                        || siblingWall.mesh3D?.children?.find(c => c.userData?.isWallSide)
                        || (siblingWall.mesh3D ? { userData: { side, entity: siblingWall }, parent: siblingWall.mesh3D } : null);
                    
                    if (sideMesh && sideMesh.parent) {
                        const hMesh = this._getOrCreateArcSelectionMesh(idx);
                        this._buildWallHighlight(sideMesh, hMesh, mode);
                    }
                });
            } else {
                this._buildWallHighlight(object, this.wallSelectionMesh, mode);
            }
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
            const wallEntity = object.userData?.entity || object.parent?.userData?.entity;
            const side = object.userData.side || 'front';
            
            if (wallEntity?.parentArc && wallEntity.parentArc.walls && wallEntity.parentArc.walls.length > 0) {
                this._detachMesh(this.wallHoverMesh);
                wallEntity.parentArc.walls.forEach((siblingWall, idx) => {
                    const sideMesh = siblingWall.mesh3D?.children?.find(c => c.userData?.isWallSide && c.userData?.side === side)
                        || siblingWall.mesh3D?.children?.find(c => c.userData?.isWallSide)
                        || (siblingWall.mesh3D ? { userData: { side, entity: siblingWall }, parent: siblingWall.mesh3D } : null);
                    
                    if (sideMesh && sideMesh.parent) {
                        const hMesh = this._getOrCreateArcHoverMesh(idx);
                        this._buildWallHighlight(sideMesh, hMesh, 'hover');
                    }
                });
            } else {
                this._buildWallHighlight(object, this.wallHoverMesh, 'hover');
            }
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
            const wallEntity = objToRefresh.userData?.entity || objToRefresh.parent?.userData?.entity;
            const side = objToRefresh.userData.side || 'front';
            
            if (wallEntity?.parentArc && wallEntity.parentArc.walls && wallEntity.parentArc.walls.length > 0) {
                this._detachMesh(this.wallSelectionMesh);
                wallEntity.parentArc.walls.forEach((siblingWall, idx) => {
                    const sideMesh = siblingWall.mesh3D?.children?.find(c => c.userData?.isWallSide && c.userData?.side === side)
                        || siblingWall.mesh3D?.children?.find(c => c.userData?.isWallSide)
                        || (siblingWall.mesh3D ? { userData: { side, entity: siblingWall }, parent: siblingWall.mesh3D } : null);
                    
                    if (sideMesh && sideMesh.parent) {
                        const hMesh = this._getOrCreateArcSelectionMesh(idx);
                        this._buildWallHighlight(sideMesh, hMesh, this.currentMode);
                    }
                });
            } else {
                this._buildWallHighlight(objToRefresh, this.wallSelectionMesh, this.currentMode);
            }
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

        if (this.arcSelectionMeshes && this.arcSelectionMeshes.length > 0) {
            this.arcSelectionMeshes.forEach(mesh => {
                this._detachMesh(mesh);
            });
        }

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

        if (this.arcHoverMeshes && this.arcHoverMeshes.length > 0) {
            this.arcHoverMeshes.forEach(mesh => {
                this._detachMesh(mesh);
            });
        }

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
        const side = object.userData?.side || 'front';
        const wallGroup = object.isGroup ? object : (object.parent || object);
        if (!wallGroup || !wallGroup.userData || !wallGroup.userData.entity) return;
        const w = wallGroup.userData.entity;

        wallGroup.add(targetMesh);

        // Find the authoritative wall skin mesh (hitFront / hitBack)
        const skinMesh = (object.geometry && object.userData?.isWallSide)
            ? object
            : (wallGroup.children?.find(c => c.userData?.isWallSide && c.userData?.side === side)
               || wallGroup.children?.find(c => c.userData?.isWallSide));

        if (skinMesh && skinMesh.geometry) {
            if (targetMesh.geometry) targetMesh.geometry.dispose();
            targetMesh.geometry = skinMesh.geometry.clone();
            targetMesh.position.set(0, 0, 0);
            targetMesh.rotation.set(0, 0, 0);
            targetMesh.scale.set(1, 1, 1);
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
                            this._activeEmissiveTargets.add(mat);
                        } else {
                            if (mat.userData.origEmissive !== undefined) {
                                mat.emissive.setHex(mat.userData.origEmissive);
                                mat.emissiveIntensity = mat.userData.origEmissiveIntensity;
                                delete mat.userData.origEmissive;
                                delete mat.userData.origEmissiveIntensity;
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

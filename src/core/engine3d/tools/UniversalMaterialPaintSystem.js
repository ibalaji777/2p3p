/**
 * UniversalMaterialPaintSystem.js
 * Universal face-based Material Painting System for 3D Scenes.
 * 
 * Implements continuous face-level painting across all 3D assets:
 * Walls, Doors, Windows, Furniture, Roofs, Stairs, Railings, Shapes, and Elevation Widgets.
 */

import * as THREE from 'three';
import { BIMMaterialSystem } from '../BIMMaterialSystem.js';
import { ComponentRegistry } from '../ComponentRegistry.js';
import { MaterialManager } from '../MaterialManager.js';
import { WallEngine } from '../../wall/WallEngine.js';
import { applyWallPaintWithScope } from '../WallPaintSystem.js';
import { coreEventBus } from '../../EventBus.js';
import { EVENTS } from '../../registry.js';

export class UniversalMaterialPaintSystem {
    constructor(ctx, controller) {
        this.ctx = ctx;
        this.controller = controller;
        
        this.activeMaterial = null; // Currently selected paint material config or id
        this.hoveredDescriptor = null;
        this.activeTargetDescriptor = null;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.pointerDownPos = new THREE.Vector2();
        this.isDragging = false;
        this.enabled = false;
    }

    /**
     * Activates or deactivates universal material painting mode.
     * @param {boolean} active
     */
    setActive(active) {
        this.enabled = active;
        if (!active) {
            this.clearHoverHighlight();
            this.hoveredDescriptor = null;
        }
    }

    /**
     * Sets the active material brush (the material to apply on click).
     * @param {string|Object} materialConfig
     */
    setActiveMaterial(materialConfig) {
        this.activeMaterial = materialConfig;
    }

    /**
     * Handles pointer move in Material mode (Face detection & preview highlight).
     * @param {PointerEvent|MouseEvent} e
     */
    onPointerMove(e) {
        if (!this.enabled) return;
        this.updateMouse(e);

        if (this.pointerDownPos.distanceTo(this.mouse) > 0.02) {
            this.isDragging = true;
        }

        const descriptor = this.raycastFace(this.mouse);

        if (descriptor) {
            this.ctx.renderer.domElement.style.cursor = 'crosshair';

            // Check if hovered target changed
            if (!this.hoveredDescriptor || 
                this.hoveredDescriptor.mesh !== descriptor.mesh || 
                this.hoveredDescriptor.targetMatIndex !== descriptor.targetMatIndex ||
                this.hoveredDescriptor.slotName !== descriptor.slotName) {
                
                this.clearHoverHighlight();
                this.hoveredDescriptor = descriptor;
                this.setHighlight(descriptor, true, 0x38bdf8); // Soft cyan/blue hover glow
            }
        } else {
            this.ctx.renderer.domElement.style.cursor = 'auto';
            this.clearHoverHighlight();
            this.hoveredDescriptor = null;
        }
    }

    /**
     * Handles pointer down in Material mode.
     * @param {PointerEvent|MouseEvent} e
     */
    onPointerDown(e) {
        if (!this.enabled) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        this.updateMouse(e);
        this.pointerDownPos.copy(this.mouse);
        this.isDragging = false;
    }

    /**
     * Handles pointer up in Material mode (Applies material or sets active face target).
     * @param {PointerEvent|MouseEvent} e
     */
    onPointerUp(e) {
        if (!this.enabled || this.isDragging) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        this.updateMouse(e);
        const descriptor = this.raycastFace(this.mouse);

        if (descriptor) {
            e.preventDefault();
            e.stopPropagation();

            this.activeTargetDescriptor = descriptor;

            console.info(`%c[UniversalMaterialPaint] %cTarget face selected: %c${descriptor.faceName} %c(Slot: ${descriptor.slotName || 'N/A'}, Entity: ${descriptor.entity?.id || 'N/A'})`,
                'color: #3b82f6; font-weight: bold;', 'color: #9ca3af;', 'color: #10b981; font-weight: bold;', 'color: #f59e0b;');

            // If we have an active brush material, paint immediately!
            if (this.activeMaterial) {
                this.applyMaterialToDescriptor(this.activeMaterial, descriptor);
            } else {
                // Open material library palette for this target
                if (this.ctx.gizmoManager && this.ctx.gizmoManager.onMaterialFaceSelected) {
                    this.ctx.gizmoManager.onMaterialFaceSelected(
                        descriptor.faceName,
                        descriptor.subMeshIndex,
                        descriptor.mesh,
                        descriptor.targetMatIndex,
                        null,
                        descriptor
                    );
                }
            }

            // Keep face selected/highlighted
            this.setHighlight(descriptor, true, 0x10b981); // Solid green commit highlight
        }
    }

    /**
     * Raycasts the scene interactables to find the exact face descriptor.
     * @param {THREE.Vector2} mouseCoords
     * @returns {Object|null}
     */
    raycastFace(mouseCoords) {
        this.raycaster.setFromCamera(mouseCoords, this.ctx.camera);
        const intersects = this.raycaster.intersectObjects(this.ctx.interactables || [], true);

        const validHits = intersects.filter(i => {
            const obj = i.object;
            if (!obj || obj.userData?.isHitbox || obj.userData?.paintable === false) return false;
            const mat = obj.material;
            if (mat && mat.type === 'MeshBasicMaterial' && mat.opacity === 0) return false;
            return true;
        });

        if (validHits.length === 0) return null;

        const hit = validHits[0];
        const mesh = hit.object;

        let localNormal = null;
        if (hit.face && hit.face.normal) {
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
            const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
            const rootNormalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld).invert();
            localNormal = worldNormal.clone().applyMatrix3(rootNormalMatrix).normalize();
        }

        const entity = mesh.userData?.entity || this.findParentEntity(mesh);
        return BIMMaterialSystem.resolveBIMTarget(mesh, hit.face?.materialIndex, localNormal, entity);
    }

    /**
     * Finds the parent domain entity from a child mesh.
     * @param {THREE.Object3D} mesh
     * @returns {Object|null}
     */
    findParentEntity(mesh) {
        let cur = mesh;
        while (cur) {
            if (cur.userData?.entity) return cur.userData.entity;
            if (cur.userData?.parentWall) return cur.userData.parentWall;
            cur = cur.parent;
        }
        return null;
    }

    /**
     * Applies a material to the given BIM target descriptor across any object type.
     * @param {string|Object} materialConfig - Material id or config object.
     * @param {Object} descriptor - Target descriptor resolved by BIMMaterialSystem.
     */
    applyMaterialToDescriptor(materialConfig, descriptor = this.activeTargetDescriptor) {
        if (!descriptor || !descriptor.entity) return;

        const matKey = typeof materialConfig === 'string' ? materialConfig : materialConfig.id || materialConfig.key;
        const entity = descriptor.entity;
        const type = entity.type || '';
        const faceName = descriptor.faceName || 'front';
        const slotName = descriptor.slotName;

        console.info(`%c[UniversalMaterialPaint] %cApplying ${matKey} to %c${type} -> ${faceName} (${slotName})`,
            'color: #10b981; font-weight: bold;', 'color: #9ca3af;', 'color: #3b82f6; font-weight: bold;');

        // 1. Base Wall (outer, inner, compound, wall, arc)
        if (type === 'outer' || type === 'inner' || type === 'compound' || type === 'wall' || type === 'wallDecor' || type === 'arc' || entity.parentArc) {
            const targetWall = entity.parentArc ? entity.parentArc : entity;
            if (targetWall.walls && Array.isArray(targetWall.walls)) {
                // Curved wall arc
                targetWall.walls.forEach(w => {
                    WallEngine.applyMaterial(w, { target: faceName, key: matKey, ctx: this.ctx }, this.ctx.planner);
                });
            } else {
                WallEngine.applyMaterial(entity, { target: faceName, key: matKey, ctx: this.ctx }, this.ctx.planner);
            }
        }
        // 2. Component Slot-Based Asset (Doors, Windows, Stairs, Railings, Moldings, Elevation Elements, Furniture)
        else if (slotName && entity.materials) {
            MaterialManager.updateEntityMaterialSlot(entity, slotName, matKey, this.ctx);
        }
        // 3. Roofs
        else if (type === 'roof' || entity.config?.roofType) {
            if (descriptor.isGable || faceName === 'gable') {
                entity.config = entity.config || {};
                entity.config.gableMaterial = matKey;
            } else if (faceName === 'fascia') {
                entity.config = entity.config || {};
                entity.config.fasciaMaterial = matKey;
            } else {
                entity.config = entity.config || {};
                entity.config.material = matKey;
            }
            if (this.ctx.envBuilder?.updateRoofLive) {
                this.ctx.envBuilder.updateRoofLive(entity);
            }
        }
        // 4. Floors & Rooms
        else if (type === 'room' || type === 'floor' || entity.isFloor || entity.isRoom) {
            entity.configId = matKey;
            if (this.ctx.updateMaterialLive) {
                this.ctx.updateMaterialLive(entity);
            }
        }
        // 5. Shapes & Protrusions
        else {
            if (!entity.params) entity.params = {};
            if (faceName === 'all' || !faceName) {
                entity.params.texture = matKey;
            } else {
                const paramName = 'texture' + faceName.charAt(0).toUpperCase() + faceName.slice(1);
                entity.params[paramName] = matKey;
            }
            if (this.ctx.updateMaterialLive) {
                this.ctx.updateMaterialLive(entity);
            }
        }

        // Notify scene & history
        if (this.ctx.requestRender) this.ctx.requestRender('material_painted');
        coreEventBus.emit(EVENTS.MATERIAL_GIZMO_APPLY, { entity, face: faceName, material: matKey });
        
        if (window.plannerInstance && window.plannerInstance.syncAll) {
            window.plannerInstance.syncAll();
        }
    }

    setHighlight(descriptor, active, color = 0x38bdf8) {
        if (!descriptor) return;

        if (descriptor.entity?.id && descriptor.slotName) {
            ComponentRegistry.setSlotHighlight(descriptor.entity.id, descriptor.slotName, active, color, this.ctx);
        } else if (descriptor.mesh) {
            BIMMaterialSystem.setBIMHighlight(descriptor, active, color, this.ctx);
        }

        if (this.ctx.requestRender) this.ctx.requestRender('material_hover_highlight');
    }

    clearHoverHighlight() {
        if (this.hoveredDescriptor) {
            this.setHighlight(this.hoveredDescriptor, false);
            this.hoveredDescriptor = null;
        }
    }

    updateMouse(e) {
        const dom = this.ctx.renderer.domElement;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
}

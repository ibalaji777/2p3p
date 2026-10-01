/**
 * UniversalMaterialPaintSystem.js
 * Universal face-based Material Painting System for 3D Scenes (sms 4 Style).
 * 
 * Implements:
 * 1. Space-saving controls & Active Material Brush workflow
 * 2. 60 FPS in-place Live Hover Preview on walls, room loops, and components
 * 3. Continuous painting across any wall or side without interrupting the session
 * 4. Eyedropper tool to sample existing materials
 */

import * as THREE from 'three';
import { BIMMaterialSystem } from '../BIMMaterialSystem.js';
import { ComponentRegistry } from '../ComponentRegistry.js';
import { MaterialManager } from '../MaterialManager.js';
import { MaterialFactory } from '../MaterialFactory.js';
import { UniversalMaterialManager } from '../UniversalMaterialManager.js';
import { WallEngine } from '../../wall/WallEngine.js';
import { RoofEngine } from '../../roof/RoofEngine.js';
import { MaterialEngine } from '../../materials/MaterialEngine.js';
import { applyWallPaintWithScope, getRoomForWallFace, getRoomWallsAndSides, getExteriorWallsAndSides } from '../WallPaintSystem.js';
import { coreEventBus } from '../../EventBus.js';
import { EVENTS } from '../../registry.js';

export function resolveEntityKind(entity) {
    if (!entity) return null;
    const type = entity.type || '';
    if (type === 'outer' || type === 'inner' || type === 'compound' || type === 'wall' || type === 'half_wall' || type === 'foundation' || type === 'arc' || entity.walls || entity.parentArc || entity.startX !== undefined || entity.isWall) {
        return 'wall';
    }
    if (type === 'roof' || entity.isRoof || entity.config?.roofType) return 'roof';
    if (type === 'door' || type.startsWith('door_') || type === 'door_opening') return 'door';
    if (type === 'window' || type.startsWith('window_') || type === 'window_opening') return 'window';
    if (type === 'room' || type === 'floor' || type === 'outdoor_zone' || type === 'balcony' || entity.isFloor || entity.isOutdoorZone) return 'floor';
    if (type === 'stair' || type === 'staircase' || type.startsWith('stair_') || entity.isStair || entity.flight1Steps !== undefined || entity.constructor?.name === 'PremiumStaircase') return 'stair';
    if (type === 'furniture' || type.startsWith('furniture_') || entity.isFurniture) return 'furniture';
    return type || null;
}

export class UniversalMaterialPaintSystem {
    constructor(ctx, controller) {
        this.ctx = ctx;
        this.controller = controller;
        
        this.activeMaterial = null; // Currently selected paint material config or id (Active Brush)
        this.lockedCategory = null; // Locked entity kind: 'wall' | 'roof' | 'door' | 'window' | 'floor' | 'stair' | 'furniture'
        this.materialScope = 'selectedFace'; // 'selectedFace' | 'room' | 'exterior' | 'entireObject'
        this.isEyedropper = false;
        
        this.hoveredDescriptor = null;
        this.activeTargetDescriptor = null;
        this._previewBackups = []; // Tracks { mesh, index, origMat } for in-place live hover preview
        this._lastPreviewScope = null;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.pointerDownPos = new THREE.Vector2();
        this.isDragging = false;
        this.enabled = false;

        this.isSessionActive = false;
        this._sessionOriginalStates = new Map(); // entity.id -> snapshot
        this._touchCapturedSurface = false;
    }

    /**
     * Determines whether the given target descriptor matches the locked material category.
     * @param {Object} descriptor
     * @returns {boolean}
     */
    isTargetCompatible(descriptor) {
        if (!descriptor || !descriptor.entity) return false;
        if (!this.lockedCategory) return true;
        const targetKind = resolveEntityKind(descriptor.entity);
        return targetKind === this.lockedCategory;
    }

    /**
     * Starts a transactional material painting session.
     * @param {Object} initialEntity
     */
    startSession(initialEntity = null) {
        this.isSessionActive = true;
        this._sessionOriginalStates = new Map();
        this.lockedCategory = initialEntity ? resolveEntityKind(initialEntity) : null;
        if (initialEntity) {
            this.recordEntitySnapshot(initialEntity);
        }
    }

    /**
     * Records a pristine pre-mutation snapshot of an entity's material configuration.
     * @param {Object} entity
     */
    recordEntitySnapshot(entity) {
        if (!entity || !entity.id || this._sessionOriginalStates.has(entity.id)) return;

        const isWall = entity.type === 'outer' || entity.type === 'inner' || entity.type === 'compound' || entity.type === 'wall' || entity.type === 'arc' || entity.startX !== undefined;
        const isRoof = entity.type === 'roof' || entity.isRoof || entity.config?.roofType;

        if (isWall) {
            this._sessionOriginalStates.set(entity.id, {
                kind: 'wall',
                entity: entity,
                texture: entity.params?.texture || entity.texture || null,
                textureFront: entity.params?.textureFront || entity.textureFront || null,
                textureBack: entity.params?.textureBack || entity.textureBack || null,
                textureSides: entity.params?.textureSides || entity.textureSides || null,
                params: entity.params ? { ...entity.params } : {},
                attachedDecor: entity.attachedDecor ? JSON.parse(JSON.stringify(entity.attachedDecor)) : []
            });
        } else if (isRoof) {
            this._sessionOriginalStates.set(entity.id, {
                kind: 'roof',
                entity: entity,
                materials: entity.materials ? JSON.parse(JSON.stringify(entity.materials)) : {},
                params: entity.params ? JSON.parse(JSON.stringify(entity.params)) : {},
                texture: entity.texture || entity.params?.texture || null
            });
        } else {
            this._sessionOriginalStates.set(entity.id, {
                kind: 'component',
                entity: entity,
                materials: entity.materials ? JSON.parse(JSON.stringify(entity.materials)) : {},
                params: entity.params ? JSON.parse(JSON.stringify(entity.params)) : {},
                texture: entity.params?.texture || entity.texture || null
            });
        }
    }

    /**
     * Commits all material changes made during this session.
     * Saves history and closes session.
     */
    commitSession() {
        this.clearPreviewBackups();
        this.clearHoverHighlight();
        const planner = this.ctx?.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner) : null);
        if (this._sessionOriginalStates.size > 0 && planner && typeof planner.saveHistory === 'function') {
            planner.saveHistory();
        }
        if (typeof window !== 'undefined' && window.plannerInstance && window.plannerInstance.syncAll) {
            window.plannerInstance.syncAll();
        }
        this._sessionOriginalStates.clear();
        this.isSessionActive = false;
        this.lockedCategory = null;
        this.activeMaterial = null;
        this.activeTargetDescriptor = null;
        this.hoveredDescriptor = null;
        this.setActive(false);
        coreEventBus.emit('ShowToast', { message: 'Material changes applied', type: 'success' });
        if (this.controller) {
            this.controller.setTool('select');
        }
        if (this.ctx?.gizmoManager?.closeMaterialPanel) {
            this.ctx.gizmoManager.closeMaterialPanel(true);
        }
    }

    /**
     * Cancels the session and reverts all applied materials to their pristine pre-session states.
     */
    cancelSession() {
        this.clearPreviewBackups();
        this.clearHoverHighlight();
        const planner = this.ctx?.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner) : null);

        if (this._sessionOriginalStates.size > 0) {
            for (const [entityId, snap] of this._sessionOriginalStates.entries()) {
                const ent = snap.entity;
                if (!ent) continue;

                if (snap.kind === 'wall') {
                    if (ent.params) {
                        ent.params.texture = snap.texture;
                        ent.params.textureFront = snap.textureFront;
                        ent.params.textureBack = snap.textureBack;
                        ent.params.textureSides = snap.textureSides;
                    }
                    ent.texture = snap.texture;
                    ent.textureFront = snap.textureFront;
                    ent.textureBack = snap.textureBack;

                    // Remove any decor attached during this session
                    const origDecorIds = new Set((snap.attachedDecor || []).map(d => d.id));
                    if (ent.attachedDecor) {
                        const addedDecors = ent.attachedDecor.filter(d => !origDecorIds.has(d.id));
                        for (const ad of addedDecors) {
                            WallEngine.removeDecor(ent, ad.id, false, planner);
                        }
                    }
                    ent.attachedDecor = snap.attachedDecor ? JSON.parse(JSON.stringify(snap.attachedDecor)) : [];

                    WallEngine.applyMaterial(ent, { target: 'front', key: snap.textureFront || snap.texture, ctx: this.ctx }, planner);
                    WallEngine.applyMaterial(ent, { target: 'back', key: snap.textureBack || snap.texture, ctx: this.ctx }, planner);
                    if (this.ctx.envBuilder && typeof this.ctx.envBuilder.buildWallGroup === 'function') {
                        this.ctx.envBuilder.buildWallGroup(ent);
                    }
                } else if (snap.kind === 'roof') {
                    ent.materials = snap.materials;
                    if (ent.params) Object.assign(ent.params, snap.params);
                    ent.texture = snap.texture;
                    if (this.ctx.envBuilder && typeof this.ctx.envBuilder.updateRoofLive === 'function') {
                        this.ctx.envBuilder.updateRoofLive(ent);
                    }
                } else {
                    ent.materials = snap.materials;
                    if (ent.params) Object.assign(ent.params, snap.params);
                    ent.texture = snap.texture;
                    if (ent.materials) {
                        for (const [slot, matVal] of Object.entries(ent.materials)) {
                            const k = matVal?.id || matVal?.key || matVal;
                            if (k) {
                                MaterialEngine.applyMaterial(ent, slot, k, { ctx: this.ctx, planner });
                            }
                        }
                    }
                    if (this.ctx.updateEntityLive) {
                        this.ctx.updateEntityLive(ent);
                    }
                }
            }
            if (typeof window !== 'undefined' && window.plannerInstance && window.plannerInstance.syncAll) {
                window.plannerInstance.syncAll();
            }
            coreEventBus.emit('ShowToast', { message: 'Material changes discarded', type: 'info' });
        }

        this._sessionOriginalStates.clear();
        this.isSessionActive = false;
        this.lockedCategory = null;
        this.activeMaterial = null;
        this.activeTargetDescriptor = null;
        this.hoveredDescriptor = null;
        this.setActive(false);
        if (this.ctx?.requestRender) this.ctx.requestRender('material_cancelled');
        if (this.controller) {
            this.controller.setTool('select');
        }
        if (this.ctx?.gizmoManager?.closeMaterialPanel) {
            this.ctx.gizmoManager.closeMaterialPanel(true);
        }
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
            this.activeTargetDescriptor = null;
            this.isEyedropper = false;
        }
    }

    /**
     * Sets the active material brush (the material to apply on click).
     * @param {string|Object} materialConfig
     * @param {string|null} [category=null]
     */
    setActiveMaterial(materialConfig, category = null) {
        this.activeMaterial = materialConfig;
        if (!materialConfig) {
            this.lockedCategory = null;
        } else if (category) {
            this.lockedCategory = category;
        } else if (!this.lockedCategory && this.activeTargetDescriptor?.entity) {
            this.lockedCategory = resolveEntityKind(this.activeTargetDescriptor.entity);
        }

        // Selecting a material clears previous hover and target references so initial entity is not modified
        this.clearPreviewBackups();
        this.clearHoverHighlight();
        this.hoveredDescriptor = null;
        this.activeTargetDescriptor = null;

        if (this.ctx?.gizmoManager?.updateActiveBrushUI) {
            this.ctx.gizmoManager.updateActiveBrushUI(materialConfig);
        }
    }

    /**
     * Sets the paint application mode / scope.
     * @param {string} scope - 'selectedFace' | 'room' | 'exterior' | 'entireObject'
     */
    setMaterialScope(scope) {
        this.materialScope = scope || 'selectedFace';
        if (this.hoveredDescriptor && this.activeMaterial) {
            this.applyHoverPreview(this.hoveredDescriptor, this.materialScope);
        }
    }

    /**
     * Toggles Eyedropper mode to sample materials from scene faces.
     * @param {boolean} active
     */
    setEyedropper(active) {
        this.isEyedropper = active;
        if (this.ctx?.renderer?.domElement) {
            this.ctx.renderer.domElement.style.cursor = active ? 'copy' : 'auto';
        }
        if (this.ctx?.gizmoManager?.updateEyedropperUI) {
            this.ctx.gizmoManager.updateEyedropperUI(active);
        }
    }

    /**
     * Retrieves a suitable THREE.Material for previewing the given material key.
     * @param {string|Object} materialConfig
     * @param {string} category
     * @returns {THREE.Material|null}
     */
    getPreviewMaterial(materialConfig, category = 'wall') {
        const matKey = typeof materialConfig === 'string' ? materialConfig : (materialConfig?.id || materialConfig?.key);
        if (!matKey) return null;
        if (matKey === '__default__' || matKey === 'default') {
            const isWall = (category === 'wall' || category === 'outer' || category === 'inner' || category === 'front' || category === 'back' || category === 'wall_face');
            if (isWall) {
                return new THREE.MeshStandardMaterial({ color: 0xefede5, roughness: 0.9, metalness: 0.0 });
            }
            return new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8, metalness: 0.1 });
        }
        let mat = null;
        if (this.ctx?.helpers?.getDynamicMaterial) {
            mat = this.ctx.helpers.getDynamicMaterial(matKey, category);
        }
        if (!mat) {
            mat = MaterialEngine.getThreeMaterial(matKey, category);
        }
        if (mat) {
            const isWall = (category === 'wall' || category === 'outer' || category === 'inner' || category === 'front' || category === 'back' || category === 'wall_face');
            const conf = UniversalMaterialManager.getMaterial(matKey) || MaterialManager.resolveMaterialConfig(matKey);
            if (conf) {
                MaterialFactory.buildPBRMaterial({
                    material: mat,
                    config: conf,
                    ctx: this.ctx,
                    dimensions: { width: 100, height: 100, isWorldUV: isWall },
                    faceName: category
                }).then(() => {
                    if (this.ctx?.requestRender) this.ctx.requestRender('preview_mat_loaded', 2);
                });
            }
        }
        return mat;
    }

    /**
     * Applies in-place 60 FPS live hover preview to target face or room loop.
     * @param {Object} descriptor
     * @param {string} effectiveScope
     */
    applyHoverPreview(descriptor, effectiveScope = 'selectedFace') {
        if (!descriptor || !this.activeMaterial) return;

        const entity = descriptor.entity;
        const isWall = entity && (entity.type === 'outer' || entity.type === 'inner' || entity.type === 'compound' || entity.type === 'wall' || entity.type === 'half_wall' || entity.type === 'foundation' || entity.startX !== undefined);
        const compType = isWall ? 'wall' : (entity?.type || 'furniture');
        const previewMat = this.getPreviewMaterial(this.activeMaterial, compType);
        if (!previewMat) return;

        // Clear any prior hover preview backups before applying new ones
        this.clearPreviewBackups();

        if (isWall) {
            const planner = this.ctx?.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner) : null);
            const side = descriptor.faceName === 'back' ? 'back' : 'front';

            if (effectiveScope === 'room') {
                const room = getRoomForWallFace(entity, side, planner, this.ctx);
                if (room) {
                    const targets = getRoomWallsAndSides(room, planner, this.ctx);
                    targets.forEach(t => {
                        const targetWall = t.wall;
                        const wMesh = targetWall.wallMesh3D 
                            || targetWall.mesh3D?.userData?.wallMesh 
                            || (targetWall.mesh3D?.children ? targetWall.mesh3D.children.find(c => c.userData?.isWallMesh) : null);
                        if (wMesh && Array.isArray(wMesh.material)) {
                            const idx = t.side === 'back' ? 5 : 4;
                            this._previewBackups.push({ mesh: wMesh, index: idx, origMat: wMesh.material[idx] });
                            wMesh.material[idx] = previewMat;
                        }
                    });
                } else if (descriptor.mesh && Array.isArray(descriptor.mesh.material)) {
                    this._previewBackups.push({ mesh: descriptor.mesh, index: descriptor.targetMatIndex, origMat: descriptor.mesh.material[descriptor.targetMatIndex] });
                    descriptor.mesh.material[descriptor.targetMatIndex] = previewMat;
                }
            } else if (effectiveScope === 'exterior') {
                const targets = getExteriorWallsAndSides(planner, this.ctx);
                targets.forEach(t => {
                    const targetWall = t.wall;
                    const wMesh = targetWall.wallMesh3D 
                        || targetWall.mesh3D?.userData?.wallMesh 
                        || (targetWall.mesh3D?.children ? targetWall.mesh3D.children.find(c => c.userData?.isWallMesh) : null);
                    if (wMesh && Array.isArray(wMesh.material)) {
                        const idx = t.side === 'back' ? 5 : 4;
                        this._previewBackups.push({ mesh: wMesh, index: idx, origMat: wMesh.material[idx] });
                        wMesh.material[idx] = previewMat;
                    }
                });
            } else if (effectiveScope === 'entireObject') {
                if (descriptor.mesh && Array.isArray(descriptor.mesh.material)) {
                    this._previewBackups.push({ mesh: descriptor.mesh, index: 4, origMat: descriptor.mesh.material[4] });
                    this._previewBackups.push({ mesh: descriptor.mesh, index: 5, origMat: descriptor.mesh.material[5] });
                    descriptor.mesh.material[4] = previewMat;
                    descriptor.mesh.material[5] = previewMat;
                }
            } else {
                // Single face mode
                if (descriptor.mesh && Array.isArray(descriptor.mesh.material)) {
                    this._previewBackups.push({ mesh: descriptor.mesh, index: descriptor.targetMatIndex, origMat: descriptor.mesh.material[descriptor.targetMatIndex] });
                    descriptor.mesh.material[descriptor.targetMatIndex] = previewMat;
                }
            }
        } else if (descriptor.mesh) {
            // Non-wall components (doors, windows, floors, roofs, furniture)
            const targetMesh = descriptor.mesh;
            if (Array.isArray(targetMesh.material)) {
                const idx = descriptor.targetMatIndex >= 0 ? descriptor.targetMatIndex : 0;
                this._previewBackups.push({ mesh: targetMesh, index: idx, origMat: targetMesh.material[idx] });
                targetMesh.material[idx] = previewMat;
            } else if (targetMesh.material) {
                this._previewBackups.push({ mesh: targetMesh, index: -1, origMat: targetMesh.material });
                targetMesh.material = previewMat;
            }
        }

        if (this.ctx?.requestRender) {
            this.ctx.requestRender('material_hover_preview');
        }
    }

    /**
     * Clears all in-place live hover preview material assignments and restores originals.
     */
    clearPreviewBackups() {
        if (!this._previewBackups || this._previewBackups.length === 0) return;
        for (const backup of this._previewBackups) {
            if (!backup.mesh) continue;
            if (backup.index >= 0 && Array.isArray(backup.mesh.material)) {
                backup.mesh.material[backup.index] = backup.origMat;
            } else if (backup.origMat) {
                backup.mesh.material = backup.origMat;
            }
        }
        this._previewBackups = [];
        if (this.ctx?.requestRender) {
            this.ctx.requestRender('material_restore_preview');
        }
    }

    /**
     * Samples the material key from a raycasted target face (Eyedropper function).
     * @param {Object} descriptor
     * @returns {string|null}
     */
    sampleMaterialFromDescriptor(descriptor) {
        if (!descriptor || !descriptor.entity) return null;
        const entity = descriptor.entity;
        const isWall = entity.type === 'outer' || entity.type === 'inner' || entity.type === 'compound' || entity.type === 'wall' || entity.startX !== undefined;
        if (isWall) {
            const side = descriptor.faceName === 'back' ? 'back' : 'front';
            return side === 'back' ? (entity.params?.textureBack || entity.params?.textureSides || entity.params?.texture) : (entity.params?.textureFront || entity.params?.textureSides || entity.params?.texture);
        }
        if (descriptor.slotName && entity.materials?.[descriptor.slotName]) {
            const mat = entity.materials[descriptor.slotName];
            return mat.id || mat.key || mat;
        }
        if (entity.params) {
            return entity.params.texture || entity.params.textureFront || entity.params.material || entity.configId;
        }
        return null;
    }

    /**
     * Handles pointer move in Material mode (Face detection & preview highlight).
     * @param {PointerEvent|MouseEvent} e
     */
    onPointerMove(e) {
        if (!this.enabled) return;
        this.updateMouse(e);

        if (this.pointerDownPos.distanceTo(this.mouse) > 0.04) {
            this.isDragging = true;
            if (e.pointerType === 'touch' && this.ctx?.controls && !this.ctx.controls.enabled) {
                this.ctx.controls.enabled = true;
            }
        }

        const descriptor = this.raycastFace(this.mouse);

        if (descriptor) {
            if (this.isEyedropper) {
                if (this.ctx?.renderer?.domElement) {
                    this.ctx.renderer.domElement.style.cursor = 'copy';
                }
                if (!this.hoveredDescriptor || this.hoveredDescriptor.mesh !== descriptor.mesh || this.hoveredDescriptor.targetMatIndex !== descriptor.targetMatIndex) {
                    this.clearHoverHighlight();
                    this.hoveredDescriptor = descriptor;
                    this.setHighlight(descriptor, true, 0x06b6d4); // Cyan eyedropper glow
                }
                return;
            }

            // If an active material is selected, verify compatibility with the locked category
            if (this.activeMaterial && !this.isTargetCompatible(descriptor)) {
                if (this.ctx?.renderer?.domElement) {
                    this.ctx.renderer.domElement.style.cursor = 'not-allowed';
                }
                this.clearHoverHighlight();
                this.hoveredDescriptor = null;
                this.activeTargetDescriptor = null;
                this._lastPreviewScope = null;
                return;
            }

            if (this.ctx?.renderer?.domElement) {
                this.ctx.renderer.domElement.style.cursor = 'crosshair';
            }

            const effectiveScope = e.shiftKey ? 'room' : (e.altKey ? 'exterior' : (this.materialScope || 'selectedFace'));

            // Check if hovered target changed or scope modifier changed
            if (!this.hoveredDescriptor || 
                this.hoveredDescriptor.mesh !== descriptor.mesh || 
                this.hoveredDescriptor.targetMatIndex !== descriptor.targetMatIndex ||
                this.hoveredDescriptor.slotName !== descriptor.slotName ||
                this._lastPreviewScope !== effectiveScope) {
                
                this.clearHoverHighlight();
                this.hoveredDescriptor = descriptor;
                this.activeTargetDescriptor = descriptor;
                this._lastPreviewScope = effectiveScope;

                if (this.activeMaterial) {
                    this.applyHoverPreview(descriptor, effectiveScope);
                } else {
                    this.setHighlight(descriptor, true, 0x38bdf8); // Soft cyan/blue hover glow
                }
            }
        } else {
            if (this.ctx?.renderer?.domElement) {
                this.ctx.renderer.domElement.style.cursor = 'auto';
            }
            this.clearHoverHighlight();
            this.hoveredDescriptor = null;
            this.activeTargetDescriptor = null;
            this._lastPreviewScope = null;
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

        const descriptor = this.raycastFace(this.mouse);
        if (descriptor) {
            // Check compatibility if material is active
            if (this.activeMaterial && !this.isTargetCompatible(descriptor)) {
                this._touchCapturedSurface = false;
                if (e.pointerType === 'touch' && this.ctx?.controls) {
                    this.ctx.controls.enabled = true;
                }
                return;
            }

            this.activeTargetDescriptor = descriptor;
            if (this.activeMaterial) {
                this.applyHoverPreview(descriptor, this.materialScope);
            }
            this.setHighlight(descriptor, true, 0x38bdf8);
            if (e.pointerType === 'touch' && this.ctx?.controls) {
                this._touchCapturedSurface = true;
                this.ctx.controls.enabled = false;
            }
        } else {
            this._touchCapturedSurface = false;
            if (e.pointerType === 'touch' && this.ctx?.controls) {
                this.ctx.controls.enabled = true;
            }
        }
    }

    /**
     * Handles pointer up in Material mode (Applies material or sets active face target).
     * @param {PointerEvent|MouseEvent} e
     */
    onPointerUp(e) {
        if (this.ctx?.controls) {
            this.ctx.controls.enabled = true;
        }
        if (!this.enabled) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (this.isDragging) return;

        this.updateMouse(e);
        const descriptor = this.raycastFace(this.mouse) || (e.pointerType === 'touch' ? this.activeTargetDescriptor : null);

        if (descriptor) {
            e.preventDefault();
            e.stopPropagation();

            if (this.isEyedropper) {
                const sampled = this.sampleMaterialFromDescriptor(descriptor);
                if (sampled) {
                    this.lockedCategory = resolveEntityKind(descriptor.entity);
                    this.setActiveMaterial(sampled);
                    this.setEyedropper(false);
                    if (this.ctx?.gizmoManager?.updateActiveBrushUI) {
                        this.ctx.gizmoManager.updateActiveBrushUI(sampled);
                    }
                }
                return;
            }

            // If we have an active brush material, paint immediately if compatible
            if (this.activeMaterial) {
                if (!this.isTargetCompatible(descriptor)) {
                    console.info(`[UniversalMaterialPaint] Incompatible target: ${resolveEntityKind(descriptor.entity)} does not match locked ${this.lockedCategory}`);
                    this.clearHoverHighlight();
                    this.activeTargetDescriptor = null;
                    return;
                }

                this.activeTargetDescriptor = descriptor;

                console.info(`%c[UniversalMaterialPaint] %cTarget face clicked: %c${descriptor.faceName} %c(Slot: ${descriptor.slotName || 'N/A'}, Entity: ${descriptor.entity?.id || 'N/A'})`,
                    'color: #3b82f6; font-weight: bold;', 'color: #9ca3af;', 'color: #10b981; font-weight: bold;', 'color: #f59e0b;');

                // Restore preview backups before applying so canonical state handles mutation cleanly
                this.clearPreviewBackups();

                const effectiveScope = e.shiftKey ? 'room' : (e.altKey ? 'exterior' : (this.materialScope || 'selectedFace'));
                this.applyMaterialWithScope(this.activeMaterial, descriptor, effectiveScope);

                // Keep face selected/highlighted with commit flash
                this.setHighlight(descriptor, true, 0x10b981);
            } else {
                // If no active material, selecting this object switches the category
                const newKind = resolveEntityKind(descriptor.entity);
                this.lockedCategory = newKind;
                this.activeTargetDescriptor = descriptor;
                if (descriptor.entity) {
                    this.recordEntitySnapshot(descriptor.entity);
                }

                if (this.controller) {
                    this.controller.selectObject(descriptor.mesh, descriptor.entity);
                }
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
                this.setHighlight(descriptor, true, 0x38bdf8);
            }
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
     * Applies a material to the given BIM target descriptor with scope support.
     * @param {string|Object} materialConfig - Material id or config object.
     * @param {Object} descriptor - Target descriptor resolved by BIMMaterialSystem.
     * @param {string} scope - Paint scope ('selectedFace' | 'room' | 'exterior' | 'entireObject').
     */
    async applyMaterialWithScope(materialConfig, descriptor = this.activeTargetDescriptor, scope = 'selectedFace') {
        if (!descriptor || !descriptor.entity) return;

        const rawMatKey = typeof materialConfig === 'string' ? materialConfig : (materialConfig?.id || materialConfig?.key);
        const isDefaultClear = (rawMatKey === '__default__' || rawMatKey === 'default' || rawMatKey === '');
        const matKey = isDefaultClear ? null : rawMatKey;
        const entity = descriptor.entity;
        const isWall = entity && (entity.type === 'outer' || entity.type === 'inner' || entity.type === 'compound' || entity.type === 'wall' || entity.type === 'half_wall' || entity.type === 'foundation' || entity.startX !== undefined);
        const planner = this.ctx?.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner) : null);

        if (!this.isSessionActive) {
            this.startSession(entity);
        }
        this.recordEntitySnapshot(entity);

        if (isWall) {
            const side = descriptor.faceName === 'back' ? 'back' : 'front';

            if (scope === 'room' || scope === 'exterior') {
                if (scope === 'room') {
                    const room = getRoomForWallFace(entity, side, planner, this.ctx);
                    if (room) {
                        const targets = getRoomWallsAndSides(room, planner, this.ctx);
                        targets.forEach(t => this.recordEntitySnapshot(t.wall));
                    }
                } else if (scope === 'exterior') {
                    const targets = getExteriorWallsAndSides(planner, this.ctx);
                    targets.forEach(t => this.recordEntitySnapshot(t.wall));
                }

                applyWallPaintWithScope({
                    wall: entity,
                    side: side,
                    configId: matKey,
                    scope: scope,
                    planner: planner,
                    renderer3D: this.ctx
                });
            } else if (scope === 'entireObject') {
                WallEngine.applyMaterial(entity, { target: 'all', key: matKey, ctx: this.ctx }, planner);
                entity.texture = matKey;
                entity.textureFront = matKey;
                entity.textureBack = matKey;
                if (entity.params) {
                    entity.params.texture = matKey;
                    entity.params.textureFront = matKey;
                    entity.params.textureBack = matKey;
                }
            } else {
                // Single face
                WallEngine.applyMaterial(entity, { target: side, key: matKey, ctx: this.ctx }, planner);
                if (side === 'front') {
                    entity.textureFront = matKey;
                    if (entity.params) entity.params.textureFront = matKey;
                } else if (side === 'back') {
                    entity.textureBack = matKey;
                    if (entity.params) entity.params.textureBack = matKey;
                }
            }
        } else {
            // Non-wall entities (doors, windows, roofs, floors, furniture)
            const targetSlotOrFace = (descriptor.isGable || descriptor.faceName === 'gable') ? 'gable' : (descriptor.slotName || descriptor.faceName);
            await MaterialEngine.applyMaterial(entity, targetSlotOrFace, matKey, {
                ctx: this.ctx,
                planner: planner
            });
        }

        // Notify scene & history (only save immediate history if outside a batch session)
        if (!this.isSessionActive && planner && typeof planner.saveHistory === 'function') {
            planner.saveHistory();
        }
        if (this.ctx?.requestRender) this.ctx.requestRender('material_painted');
        coreEventBus.emit(EVENTS.MATERIAL_GIZMO_APPLY, { entity, face: descriptor.faceName, material: matKey });

        if (typeof window !== 'undefined' && window.plannerInstance && window.plannerInstance.syncAll) {
            window.plannerInstance.syncAll();
        }
    }

    /**
     * Backward-compatible delegation to applyMaterialWithScope.
     */
    async applyMaterialToDescriptor(materialConfig, descriptor = this.activeTargetDescriptor) {
        return this.applyMaterialWithScope(materialConfig, descriptor, this.materialScope || 'selectedFace');
    }

    setHighlight(descriptor, active, color = 0x38bdf8) {
        if (!descriptor) return;

        if (descriptor.entity?.id && descriptor.slotName) {
            ComponentRegistry.setSlotHighlight(descriptor.entity.id, descriptor.slotName, active, color, this.ctx);
        } else if (descriptor.mesh) {
            BIMMaterialSystem.setBIMHighlight(descriptor, active, color, this.ctx);
        }

        if (this.ctx?.requestRender) this.ctx.requestRender('material_hover_highlight');
    }

    clearHoverHighlight() {
        this.clearPreviewBackups();
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

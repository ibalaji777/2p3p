import * as THREE from 'three';
import { MaterialFactory } from './MaterialFactory.js';
import { coreEventBus } from '../EventBus.js';
import { EVENTS } from '../constants/events.js';
import { 
    DOOR_MATERIALS_REGISTRY, 
    WALL_DECOR_REGISTRY, 
    FLOOR_REGISTRY, 
    FABRIC_REGISTRY, 
    ROOF_DECOR_REGISTRY, 
    WINDOW_GLASS_MATERIALS, 
    MARBLE_REGISTRY, 
    STONE_REGISTRY, 
    METAL_REGISTRY, 
    PLASTIC_REGISTRY, 
    LEATHER_REGISTRY 
} from '../registry.js';

/**
 * Universal 3D Material Highlight & Face Application Engine.
 * Provides a 100% exact match contract between 3D face highlighting and PBR material application
 * across all 3D entities (Walls, Doors, Windows, Widgets, Moldings, Roofs, Floors, Furniture, and GLB Models).
 */
const FACE_TO_INDEX = {
    'right': 0,
    'left': 1,
    'top': 2,
    'bottom': 3,
    'front': 4,
    'back': 5
};

export class UniversalMaterialEngine {
    /**
     * Computes a unified MaterialTargetDescriptor for any raycasted 3D mesh face.
     * @param {THREE.Mesh} mesh - The target 3D mesh.
     * @param {number} matIndex - The material array index from raycaster face.
     * @param {THREE.Vector3} localNormal - Normal vector of the face in local space.
     * @param {Object} entity - Parent entity attached to userData.
     * @returns {Object} Unified MaterialTargetDescriptor.
     */
    static resolveTargetDescriptor(mesh, matIndex = -1, localNormal = null, entity = null) {
        if (!mesh) return null;

        const targetEntity = entity || mesh.userData?.entity || UniversalMaterialEngine._findParentEntity(mesh);
        
        let faceName = 'front';
        if (localNormal) {
            const absX = Math.abs(localNormal.x);
            const absY = Math.abs(localNormal.y);
            const absZ = Math.abs(localNormal.z);
            if (absX > absY && absX > absZ) faceName = localNormal.x > 0 ? 'right' : 'left';
            else if (absY > absX && absY > absZ) faceName = localNormal.y > 0 ? 'top' : 'bottom';
            else faceName = localNormal.z > 0 ? 'front' : 'back';
        }

        const isExtrudeGeo = Boolean(mesh.geometry && mesh.geometry.type === 'ExtrudeGeometry');
        let targetMatIndex = 0;

        if (isExtrudeGeo) {
            // ExtrudeGeometry: 0 = front/back cap face, 1 = bevel side face
            targetMatIndex = (faceName === 'front' || faceName === 'back') ? 0 : 1;
        } else if (Array.isArray(mesh.material) && mesh.material.length === 6) {
            // Standard 6-side BoxGeometry
            targetMatIndex = FACE_TO_INDEX[faceName] !== undefined ? FACE_TO_INDEX[faceName] : 4;
        } else if (matIndex !== undefined && matIndex !== null && matIndex !== -1) {
            targetMatIndex = matIndex;
        } else {
            targetMatIndex = FACE_TO_INDEX[faceName] !== undefined ? FACE_TO_INDEX[faceName] : 0;
        }

        let subMeshIndex = -1;
        if (targetEntity && targetEntity.mesh3D && targetEntity.mesh3D.isGroup) {
            const validChildren = targetEntity.mesh3D.children.filter(c => !c.userData?.isHitbox);
            subMeshIndex = validChildren.indexOf(mesh);
        }

        return {
            entity: targetEntity,
            mesh: mesh,
            activeMatIndex: matIndex,
            targetMatIndex: targetMatIndex,
            faceName: faceName,
            isExtrudeGeo: isExtrudeGeo,
            subMeshIndex: subMeshIndex
        };
    }

    /**
     * Applies a green emissive highlight strictly to the targeted face/mesh material or assembly.
     * @param {Object|THREE.Mesh} target - Target descriptor or mesh.
     * @param {boolean} active - True to activate highlight, false to clear.
     */
    static setHighlight(target, active = true) {
        let mesh = target?.mesh || target;
        if (!mesh || !mesh.material) return;

        const isFrameTarget = Boolean(mesh.userData?.isFrame);
        const entity = target?.entity || UniversalMaterialEngine._findParentEntity(mesh);

        const highlightSingleMesh = (m) => {
            if (!m || !m.material) return;
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            const matIndex = (target?.targetMatIndex !== undefined && target?.targetMatIndex !== -1) 
                ? target.targetMatIndex 
                : 0;

            const targetMat = mats[matIndex] || mats[0];
            if (targetMat && targetMat.type !== 'MeshBasicMaterial' && targetMat.emissive !== undefined) {
                if (active) {
                    if (targetMat.userData.origEmissive === undefined) { 
                        targetMat.userData.origEmissive = targetMat.emissive.getHex(); 
                        targetMat.userData.origEmissiveIntensity = targetMat.emissiveIntensity || 0; 
                    }
                    targetMat.emissive.setHex(0x00ff00); 
                    targetMat.emissiveIntensity = 0.8;
                } else {
                    if (targetMat.userData.origEmissive !== undefined) { 
                        targetMat.emissive.setHex(targetMat.userData.origEmissive); 
                        targetMat.emissiveIntensity = targetMat.userData.origEmissiveIntensity; 
                    }
                }
                targetMat.needsUpdate = true;
            }
        };

        // If target is part of a door or composite assembly, highlight strictly within the entity's own mesh3D group
        if (entity && (entity.type === 'door' || entity.type === 'window' || entity.isWidget)) {
            const rootObj = entity.mesh3D || mesh;
            if (rootObj && typeof rootObj.traverse === 'function') {
                rootObj.traverse(child => {
                    if (child && child.isMesh && !child.userData?.isGlass && !child.userData?.isHandle) {
                        if (isFrameTarget && child.userData?.isFrame) {
                            highlightSingleMesh(child);
                        } else if (!isFrameTarget && !child.userData?.isFrame) {
                            highlightSingleMesh(child);
                        }
                    }
                });
                return;
            }
        }

        highlightSingleMesh(mesh);
    }

    /**
     * Clears highlight from a mesh or target descriptor.
     */
    static clearHighlight(target) {
        UniversalMaterialEngine.setHighlight(target, false);
    }

    /**
     * Central Universal Material Application for all face selections.
     * @param {Object} descriptor - Target descriptor resolved from face selection.
     * @param {Object|string} matConfig - Material configuration object or key from Material Library.
     * @param {Object} ctx - Global 3D context containing renderer, assets, updateMaterialLive.
     */
    static async applyMaterial(descriptor, matConfig, ctx) {
        if (!descriptor || !matConfig) return;

        const { entity, mesh, targetMatIndex, faceName } = descriptor;
        const config = UniversalMaterialEngine.resolveMaterialConfig(matConfig);
        const matKey = typeof matConfig === 'string' 
            ? matConfig 
            : (config?.id || config?.key || matConfig?.id || matConfig?.key || matConfig);
        const isFrameTarget = Boolean(mesh?.userData?.isFrame);

        // 1. Update Entity State Parameters - Strictly Scoped to Entity Type
        if (entity) {
            if (entity.type === 'outer' || entity.type === 'inner' || entity.type === 'wall') {
                if (entity.params) {
                    const p = entity.params;
                    const keyStr = typeof matKey === 'string' ? matKey : (matKey?.id || matKey?.key || config?.id || config?.key || '');
                    if (faceName === 'front') p.textureFront = keyStr;
                    else if (faceName === 'back') p.textureBack = keyStr;
                    else if (faceName === 'left') p.textureLeft = keyStr;
                    else if (faceName === 'right') p.textureRight = keyStr;
                    else if (faceName === 'top') p.textureTop = keyStr;
                    else if (faceName === 'bottom') p.textureBottom = keyStr;
                }
            } else if (entity.type === 'door') {
                if (isFrameTarget) {
                    entity.frameMat = matKey;
                } else {
                    entity.doorMat = matKey;
                }
            } else if (entity.type === 'window') {
                if (mesh?.userData?.isGlass) {
                    entity.glassMat = matKey;
                } else {
                    entity.frameMat = matKey;
                }
            } else if (entity.type === 'furniture' || entity.isFurniture) {
                if (entity.params) {
                    entity.params.materialOverrides = entity.params.materialOverrides || {};
                    const meshName = mesh?.name || mesh?.userData?.subMeshKey || '';
                    if (meshName) {
                        entity.params.materialOverrides[meshName] = matKey;
                        if (targetMatIndex !== -1) {
                            entity.params.materialOverrides[`${meshName}::mat_${targetMatIndex}`] = matKey;
                        }
                    }
                }
            }
        }

        // 2. Traversal & In-Place Assembly Application - Strictly Bounded to Target Entity's mesh3D
        const isAssembly = entity && (entity.type === 'door' || entity.type === 'window' || entity.isWidget || entity.isFurniture || entity.type === 'furniture');
        const matIdxToApply = isAssembly ? -1 : targetMatIndex;

        const applyToMesh = (targetMesh) => {
            if (!targetMesh || !targetMesh.isMesh) return;
            // Keep glass panes & metal handles distinct while painting structural wood/metal/pbr materials
            if (targetMesh.userData?.isGlass || targetMesh.userData?.isHandle) return;
            
            if (entity && entity.type === 'door') {
                if (isFrameTarget && !targetMesh.userData?.isFrame) return;
                if (!isFrameTarget && targetMesh.userData?.isFrame) return;
            }
            MaterialFactory.applyPBRMaterial(targetMesh, config, ctx, matIdxToApply);
        };

        if (isAssembly) {
            // Strictly use the entity's own mesh3D group to avoid climbing into parent wall or scene groups
            const rootObj = entity.mesh3D || mesh;
            if (rootObj && typeof rootObj.traverse === 'function') {
                rootObj.traverse(child => applyToMesh(child));
            } else {
                applyToMesh(mesh);
            }
        } else {
            applyToMesh(mesh);
        }

        // 3. Trigger Live Structural Rebuild for Target Entity Only
        if (entity) {
            if (entity.supportsLiveMaterialPipeline || entity.type === 'door' || entity.type === 'window' || entity.isWidget || entity.type === 'outer' || entity.type === 'inner') {
                if (ctx && typeof ctx.updateMaterialLive === 'function') {
                    ctx.updateMaterialLive(entity);
                } else if (ctx && typeof ctx.updateShapeLive === 'function') {
                    ctx.updateShapeLive(entity);
                }
            }
            coreEventBus.emit(EVENTS.ENTITY_MODIFIED, { entity });
        }

        if (ctx && ctx.interactions && typeof ctx.interactions.refreshSelectionHighlight === 'function') {
            ctx.interactions.refreshSelectionHighlight();
        }

        if (ctx && typeof ctx.requestRender === 'function') {
            ctx.requestRender();
        }
    }

    /**
     * Resolves material configuration object from key or registry.
     */
    static resolveMaterialConfig(matKey) {
        if (!matKey) return null;
        if (typeof matKey === 'object') return matKey;
        return FABRIC_REGISTRY[matKey] ||
               DOOR_MATERIALS_REGISTRY[matKey] ||
               WINDOW_GLASS_MATERIALS[matKey] ||
               MARBLE_REGISTRY[matKey] ||
               STONE_REGISTRY[matKey] ||
               METAL_REGISTRY[matKey] ||
               PLASTIC_REGISTRY[matKey] ||
               LEATHER_REGISTRY[matKey] ||
               WALL_DECOR_REGISTRY[matKey] ||
               ROOF_DECOR_REGISTRY[matKey] ||
               FLOOR_REGISTRY[matKey] ||
               { texture: matKey, id: matKey };
    }

    static _findParentEntity(mesh) {
        let current = mesh;
        let foundEntity = null;
        while (current) {
            if (current.userData?.entity) {
                const ent = current.userData.entity;
                // Prioritize door, window, widget, furniture, or shape entity over parent wall
                if (ent.type === 'door' || ent.type === 'window' || ent.isWidget || ent.isFurniture || ent.type === 'furniture') {
                    return ent;
                }
                if (!foundEntity) foundEntity = ent;
            }
            current = current.parent;
        }
        return foundEntity;
    }
}

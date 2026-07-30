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
 * Professional CAD/BIM Architectural Material Engine (BIMMaterialSystem).
 * Implements BIM Sub-Component Parameter Isolation, Face Material Slot Mapping,
 * Exact Target Contract Highlighting, and Real-World Texel Density Projection
 * across all 3D Elements (Walls, Doors, Windows, Widgets, Moldings, Roofs, Floors, Furniture, and GLBs).
 */
const FACE_TO_INDEX = {
    'right': 0,
    'left': 1,
    'top': 2,
    'bottom': 3,
    'front': 4,
    'back': 5
};

export class BIMMaterialSystem {
    /**
     * Resolves an unambiguous BIMTargetDescriptor for any raycasted mesh or face.
     * @param {THREE.Mesh} mesh - Raycasted 3D mesh.
     * @param {number} matIndex - Material array index from raycaster face.
     * @param {THREE.Vector3} localNormal - Normal vector of the face in local space.
     * @param {Object} entity - Parent entity.
     * @returns {Object} BIMTargetDescriptor.
     */
    static resolveBIMTarget(mesh, matIndex = -1, localNormal = null, entity = null) {
        if (!mesh) return null;

        const targetEntity = entity || mesh.userData?.entity || BIMMaterialSystem._findBIMEntity(mesh);
        
        let faceName = 'front';
        if (mesh.userData && mesh.userData.side) {
            faceName = mesh.userData.side;
        } else if (localNormal) {
            const absX = Math.abs(localNormal.x);
            const absY = Math.abs(localNormal.y);
            const absZ = Math.abs(localNormal.z);
            if (absX > absY && absX > absZ) faceName = localNormal.x > 0 ? 'right' : 'left';
            else if (absY > absX && absY > absZ) faceName = localNormal.y > 0 ? 'top' : 'bottom';
            else faceName = localNormal.z > 0 ? 'front' : 'back';
        }

        const isExtrudeGeo = Boolean(mesh.geometry && mesh.geometry.type === 'ExtrudeGeometry' && (!Array.isArray(mesh.material) || mesh.material.length !== 6));
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

        // Determine BIM Sub-Component Type & Slot Name
        let componentType = 'submesh';
        let slotName = 'texture';

        if (targetEntity) {
            const type = targetEntity.type;
            if (type === 'door') {
                if (mesh.userData?.isFrame) {
                    componentType = 'frame';
                    slotName = 'frameMat';
                } else if (mesh.userData?.isGlass) {
                    componentType = 'glass';
                    slotName = 'glassMat';
                } else if (mesh.userData?.isHandle) {
                    componentType = 'hardware';
                    slotName = 'hardwareMat';
                } else {
                    componentType = 'leaf';
                    slotName = 'doorMat';
                }
            } else if (type === 'window') {
                if (mesh.userData?.isGlass) {
                    componentType = 'glass';
                    slotName = 'glassMat';
                } else {
                    componentType = 'frame';
                    slotName = 'frameMat';
                }
            } else if (type === 'outer' || type === 'inner' || type === 'wall') {
                componentType = 'wall_face';
                slotName = `texture${faceName.charAt(0).toUpperCase() + faceName.slice(1)}`;
            } else if (type === 'furniture' || targetEntity.isFurniture) {
                componentType = 'furniture_part';
                slotName = 'materialOverrides';
            }
        }

        let subMeshIndex = -1;
        if (targetEntity && targetEntity.mesh3D && targetEntity.mesh3D.isGroup) {
            const validChildren = targetEntity.mesh3D.children.filter(c => !c.userData?.isHitbox);
            subMeshIndex = validChildren.indexOf(mesh);
        }

        const result = {
            entity: targetEntity,
            mesh: mesh,
            activeMatIndex: matIndex,
            targetMatIndex: targetMatIndex,
            faceName: faceName,
            componentType: componentType,
            slotName: slotName,
            isExtrudeGeo: isExtrudeGeo,
            subMeshIndex: subMeshIndex
        };

        return result;
    }

    /**
     * Applies an emissive green highlight overlay strictly to the targeted BIM sub-component or face slot.
     * @param {Object|THREE.Mesh} target - Target descriptor or mesh.
     * @param {boolean} active - True to activate highlight, false to clear.
     */
    static setBIMHighlight(target, active = true) {
        let mesh = target?.mesh || target;
        if (!mesh || !mesh.material) return;

        const descriptor = target?.componentType ? target : BIMMaterialSystem.resolveBIMTarget(mesh);
        let { entity, componentType, targetMatIndex } = descriptor;
        
        if (componentType === 'wall_face' && entity && entity.mesh3D) {
            const wallMesh = entity.mesh3D.children.find(c => !c.userData?.isHitbox && !c.userData?.isWallSide && c.isMesh);
            if (wallMesh) {
                mesh = wallMesh;
                // Make sure to use the correct material index for the wall mesh (4 for front, 5 for back)
                targetMatIndex = FACE_TO_INDEX[descriptor.faceName] !== undefined ? FACE_TO_INDEX[descriptor.faceName] : 4;
            }
        }

        const highlightSingleMesh = (m) => {
            if (!m || !m.material) return;
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            const matIndex = (targetMatIndex !== undefined && targetMatIndex !== -1) ? targetMatIndex : 0;

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

        // If target is part of a BIM composite assembly (Door, Window), highlight all matching sub-component meshes
        if (entity && (componentType === 'leaf' || componentType === 'frame' || componentType === 'glass')) {
            const rootObj = entity.mesh3D || mesh;
            if (rootObj && typeof rootObj.traverse === 'function') {
                rootObj.traverse(child => {
                    if (child && child.isMesh && !child.userData?.isGlass && !child.userData?.isHandle) {
                        if (componentType === 'frame' && child.userData?.isFrame) {
                            highlightSingleMesh(child);
                        } else if (componentType === 'leaf' && !child.userData?.isFrame) {
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
     * Clears BIM highlight from a mesh or descriptor.
     */
    static clearBIMHighlight(target) {
        BIMMaterialSystem.setBIMHighlight(target, false);
    }

    /**
     * Applies a material strictly to the target BIM sub-component parameter slot or face slot.
     * @param {Object} descriptor - Target descriptor resolved from BIM raycasting.
     * @param {Object|string} matConfig - Material configuration object or key from Material Library.
     * @param {Object} ctx - Global 3D context containing renderer, assets, updateMaterialLive.
     */
    static async applyBIMMaterial(descriptor, matConfig, ctx) {
        if (!descriptor || !matConfig) return;

        const { entity, mesh, targetMatIndex, faceName, componentType, slotName } = descriptor;
        const config = BIMMaterialSystem.resolveMaterialConfig(matConfig);
        const matKey = typeof matConfig === 'string' 
            ? matConfig 
            : (config?.id || config?.key || matConfig?.id || matConfig?.key || matConfig);
        const keyStr = typeof matKey === 'string' ? matKey : (matKey?.id || matKey?.key || '');

        // 1. Write Strictly to Target BIM Sub-Component Parameter Slot
        if (entity) {
            if (componentType === 'wall_face' && entity.params) {
                entity.params[slotName] = keyStr;
                console.warn(`%c[BIM Applied Area] %cMapped ${faceName} -> Param Property: %c${slotName} %c= %c${keyStr}`, 
                    'color: #10b981; font-weight: bold;', 'color: #9ca3af;', 'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #8b5cf6; font-weight: bold;');
            } else if (componentType === 'leaf') {
                if (entity.type === 'door' && !entity.frameMat) {
                    entity.frameMat = entity.doorMat || 'wood_golden_teak';
                }
                entity.doorMat = matKey;
                console.warn(`%c[BIM Applied Area] %cMapped ${faceName} -> Root Property: %cdoorMat %c= %c${matKey}`, 
                    'color: #10b981; font-weight: bold;', 'color: #9ca3af;', 'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #8b5cf6; font-weight: bold;');
            } else if (componentType === 'frame') {
                entity.frameMat = matKey;
                console.warn(`%c[BIM Applied Area] %cMapped ${faceName} -> Root Property: %cframeMat %c= %c${matKey}`, 
                    'color: #10b981; font-weight: bold;', 'color: #9ca3af;', 'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #8b5cf6; font-weight: bold;');
            } else if (componentType === 'glass') {
                entity.glassMat = matKey;
                console.warn(`%c[BIM Applied Area] %cMapped ${faceName} -> Root Property: %cglassMat %c= %c${matKey}`, 
                    'color: #10b981; font-weight: bold;', 'color: #9ca3af;', 'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #8b5cf6; font-weight: bold;');
            } else if (componentType === 'furniture_part' && entity.params) {
                entity.params.materialOverrides = entity.params.materialOverrides || {};
                const meshName = mesh?.name || mesh?.userData?.subMeshKey || '';
                if (meshName) {
                    entity.params.materialOverrides[meshName] = matKey;
                    if (targetMatIndex !== -1) {
                        entity.params.materialOverrides[`${meshName}::mat_${targetMatIndex}`] = matKey;
                    }
                    console.warn(`%c[BIM Applied Area] %cMapped ${faceName} -> Param Property: %cmaterialOverrides[${meshName}] %c= %c${matKey}`, 
                        'color: #10b981; font-weight: bold;', 'color: #9ca3af;', 'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #8b5cf6; font-weight: bold;');
                }
            } else if (entity.params) {
                entity.params.texture = keyStr;
                console.warn(`%c[BIM Applied Area] %cGlobal Override -> Param Property: %ctexture %c= %c${keyStr}`, 
                    'color: #ef4444; font-weight: bold;', 'color: #9ca3af;', 'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #8b5cf6; font-weight: bold;');
            }
        }

        // 2. Traversal & In-Place PBR Assembly Painting
        const isAssembly = entity && (componentType === 'leaf' || componentType === 'frame' || componentType === 'glass');
        let matIdxToApply = isAssembly ? -1 : targetMatIndex;

        const applyToMesh = (targetMesh) => {
            if (!targetMesh || !targetMesh.isMesh) return;
            if (targetMesh.userData?.isGlass || targetMesh.userData?.isHandle) return;
            
            if (entity && entity.type === 'door') {
                if (componentType === 'frame' && !targetMesh.userData?.isFrame) return;
                if (componentType === 'leaf' && targetMesh.userData?.isFrame) return;
            }
            MaterialFactory.applyPBRMaterial(targetMesh, config, ctx, matIdxToApply);
        };

        if (componentType === 'wall_face' && entity && entity.mesh3D) {
            const wallMesh = entity.mesh3D.children.find(c => !c.userData?.isHitbox && !c.userData?.isWallSide && c.isMesh);
            if (wallMesh) {
                matIdxToApply = FACE_TO_INDEX[faceName] !== undefined ? FACE_TO_INDEX[faceName] : 4;
                applyToMesh(wallMesh);
            } else {
                applyToMesh(mesh);
            }
        } else if (isAssembly) {
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
     * Resolves material configuration object from key or registry across all libraries.
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

    static _findBIMEntity(mesh) {
        let current = mesh;
        let foundEntity = null;
        while (current) {
            if (current.userData?.entity) {
                const ent = current.userData.entity;
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

window.BIMMaterialSystem = BIMMaterialSystem;

import * as THREE from 'three';
import { MaterialFactory } from './MaterialFactory.js';
import { MaterialManager } from './MaterialManager.js';
import { ComponentRegistry } from './ComponentRegistry.js';
import { MaterialSlots } from '../constants/materialSlots.js';

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
            targetMatIndex = (faceName === 'front' || faceName === 'back') ? 0 : 1;
        } else if (Array.isArray(mesh.material) && mesh.material.length === 6) {
            targetMatIndex = FACE_TO_INDEX[faceName] !== undefined ? FACE_TO_INDEX[faceName] : 4;
        } else if (matIndex !== undefined && matIndex !== null && matIndex !== -1) {
            targetMatIndex = matIndex;
        } else {
            targetMatIndex = FACE_TO_INDEX[faceName] !== undefined ? FACE_TO_INDEX[faceName] : 0;
        }

        // Determine BIM Sub-Component Type & Material Slot
        let slotName = mesh.userData?.materialSlot || MaterialSlots.CUSTOM;
        let componentType = mesh.userData?.componentType || 'submesh';

        if (targetEntity) {
            const type = targetEntity.type;
            if (type === 'door') {
                if (mesh.userData?.isFrame || slotName === MaterialSlots.FRAME) {
                    componentType = 'frame';
                    slotName = MaterialSlots.FRAME;
                } else if (mesh.userData?.isGlass || slotName === MaterialSlots.GLASS) {
                    componentType = 'glass';
                    slotName = MaterialSlots.GLASS;
                } else if (mesh.userData?.isHandle || slotName === MaterialSlots.HARDWARE) {
                    componentType = 'hardware';
                    slotName = MaterialSlots.HARDWARE;
                } else {
                    componentType = 'leaf';
                    slotName = MaterialSlots.LEAF;
                }
            } else if (type === 'window') {
                if (mesh.userData?.isGlass || slotName === MaterialSlots.GLASS) {
                    componentType = 'glass';
                    slotName = MaterialSlots.GLASS;
                } else {
                    componentType = 'frame';
                    slotName = MaterialSlots.FRAME;
                }
            } else if (type === 'outer' || type === 'inner' || type === 'compound' || type === 'wall') {
                componentType = 'wall_face';
                slotName = `wall_${faceName}`;
            } else if (type === 'roof') {
                componentType = mesh.userData?.componentType || 'roof_top';
                slotName = mesh.userData?.materialSlot || 'top';
            } else if (type === 'furniture' || targetEntity.isFurniture) {
                componentType = mesh.userData?.componentType || (mesh.userData?.materialSlot ? String(mesh.userData.materialSlot) : 'furniture_part');
                slotName = mesh.userData?.materialSlot || MaterialSlots.CUSTOM;
            }
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
            componentType: componentType,
            slotName: slotName,
            isExtrudeGeo: isExtrudeGeo,
            subMeshIndex: subMeshIndex
        };
    }

    /**
     * Applies an emissive highlight overlay across all meshes registered to the targeted component slot in real time.
     * @param {Object|THREE.Mesh} target - Target descriptor or mesh.
     * @param {boolean} [active=true] - True to activate highlight, false to clear.
     * @param {number} [color=0x00ff00] - Highlight emissive hex color.
     * @param {Object} [ctx=null] - 3D engine context.
     */
    static setBIMHighlight(target, active = true, color = 0x00ff00, ctx = null) {
        let mesh = target?.mesh || target;
        if (!mesh || !mesh.material) return;

        const descriptor = target?.componentType ? target : BIMMaterialSystem.resolveBIMTarget(mesh);
        const { entity, slotName } = descriptor;

        if (entity && entity.id && slotName) {
            ComponentRegistry.setSlotHighlight(entity.id, slotName, active, color, ctx);
            return;
        }

        // Fallback single mesh highlight
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
            if (!mat || mat.type === 'MeshBasicMaterial' || mat.emissive === undefined) continue;
            if (active) {
                if (mat.userData.origEmissive === undefined) {
                    mat.userData.origEmissive = mat.emissive.getHex();
                    mat.userData.origEmissiveIntensity = mat.emissiveIntensity || 0;
                }
                mat.emissive.setHex(color);
                mat.emissiveIntensity = 0.8;
            } else {
                if (mat.userData.origEmissive !== undefined) {
                    mat.emissive.setHex(mat.userData.origEmissive);
                    mat.emissiveIntensity = mat.userData.origEmissiveIntensity;
                }
            }
        }

        if (ctx && typeof ctx.requestRender === 'function') {
            ctx.requestRender();
        } else if (typeof window !== 'undefined' && window.app3d && typeof window.app3d.requestRender === 'function') {
            window.app3d.requestRender();
        }
    }

    /**
     * Clears BIM highlight.
     */
    static clearBIMHighlight(target, ctx = null) {
        BIMMaterialSystem.setBIMHighlight(target, false, 0x00ff00, ctx);
    }

    /**
     * Applies a material through the central JSON-first MaterialManager pipeline.
     * @param {Object} descriptor - Target descriptor.
     * @param {Object|string} matConfig - Material configuration object or key.
     * @param {Object} ctx - 3D engine context.
     */
    static async applyBIMMaterial(descriptor, matConfig, ctx) {
        if (!descriptor) return;

        const { entity, slotName } = descriptor;
        if (!entity) return;

        // matConfig may be falsy (empty string) for "Clear Material" — updateEntityMaterialSlot handles that
        await MaterialManager.updateEntityMaterialSlot(entity, slotName, matConfig, ctx);

        if (ctx && ctx.interactions && typeof ctx.interactions.refreshSelectionHighlight === 'function') {
            ctx.interactions.refreshSelectionHighlight();
        }

        if (ctx && typeof ctx.requestRender === 'function') {
            ctx.requestRender();
        }
    }

    /**
     * Resolves material configuration object across registries.
     */
    static resolveMaterialConfig(matKey) {
        return MaterialManager.resolveMaterialConfig(matKey);
    }

    static _findBIMEntity(mesh) {
        let current = mesh;
        let foundEntity = null;
        while (current) {
            if (current.userData?.entity) {
                const ent = current.userData.entity;
                if (ent.type === 'door' || ent.type === 'window' || ent.isWidget || ent.isFurniture || ent.type === 'furniture' || ent.isStair || (ent.type && ent.type.startsWith('stair'))) {
                    return ent;
                }
                if (!foundEntity) foundEntity = ent;
            }
            current = current.parent;
        }
        return foundEntity;
    }
}

if (typeof window !== 'undefined') {
    window.BIMMaterialSystem = BIMMaterialSystem;
}

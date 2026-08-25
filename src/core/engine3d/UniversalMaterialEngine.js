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

export class UniversalMaterialEngine {
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
            targetMatIndex = (faceName === 'front' || faceName === 'back') ? 0 : 1;
        } else if (Array.isArray(mesh.material) && mesh.material.length === 6) {
            targetMatIndex = FACE_TO_INDEX[faceName] !== undefined ? FACE_TO_INDEX[faceName] : 4;
        } else if (matIndex !== undefined && matIndex !== null && matIndex !== -1) {
            targetMatIndex = matIndex;
        } else {
            targetMatIndex = FACE_TO_INDEX[faceName] !== undefined ? FACE_TO_INDEX[faceName] : 0;
        }

        let slotName = mesh.userData?.materialSlot || MaterialSlots.CUSTOM;
        if (targetEntity) {
            if (targetEntity.type === 'door') {
                if (mesh.userData?.isFrame) slotName = MaterialSlots.FRAME;
                else if (mesh.userData?.isGlass) slotName = MaterialSlots.GLASS;
                else if (mesh.userData?.isHandle) slotName = MaterialSlots.HARDWARE;
                else slotName = MaterialSlots.LEAF;
            } else if (targetEntity.type === 'window') {
                if (mesh.userData?.isGlass) slotName = MaterialSlots.GLASS;
                else slotName = MaterialSlots.FRAME;
            } else if (targetEntity.type === 'outer' || targetEntity.type === 'inner' || targetEntity.type === 'compound' || targetEntity.type === 'wall') {
                slotName = `wall_${faceName}`;
            }
        }

        return {
            entity: targetEntity,
            mesh: mesh,
            activeMatIndex: matIndex,
            targetMatIndex: targetMatIndex,
            faceName: faceName,
            slotName: slotName,
            isExtrudeGeo: isExtrudeGeo
        };
    }

    static setHighlight(target, active = true) {
        let mesh = target?.mesh || target;
        if (!mesh || !mesh.material) return;

        const descriptor = target?.slotName ? target : UniversalMaterialEngine.resolveTargetDescriptor(mesh);
        const { entity, slotName } = descriptor;

        if (entity && entity.id && slotName) {
            ComponentRegistry.setSlotHighlight(entity.id, slotName, active);
            return;
        }

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
            if (!mat || mat.type === 'MeshBasicMaterial' || mat.emissive === undefined) continue;
            if (active) {
                if (mat.userData.origEmissive === undefined) {
                    mat.userData.origEmissive = mat.emissive.getHex();
                    mat.userData.origEmissiveIntensity = mat.emissiveIntensity || 0;
                }
                mat.emissive.setHex(0x00ff00);
                mat.emissiveIntensity = 0.8;
            } else {
                if (mat.userData.origEmissive !== undefined) {
                    mat.emissive.setHex(mat.userData.origEmissive);
                    mat.emissiveIntensity = mat.userData.origEmissiveIntensity;
                }
            }
            mat.needsUpdate = true;
        }
    }

    static clearHighlight(target) {
        UniversalMaterialEngine.setHighlight(target, false);
    }

    static async applyMaterial(descriptor, matConfig, ctx) {
        if (!descriptor || !matConfig) return;
        const { entity, slotName } = descriptor;
        if (!entity) return;

        await MaterialManager.updateEntityMaterialSlot(entity, slotName, matConfig, ctx);
    }

    static resolveMaterialConfig(matKey) {
        return MaterialManager.resolveMaterialConfig(matKey);
    }

    static _findParentEntity(mesh) {
        let current = mesh;
        while (current) {
            if (current.userData?.entity) return current.userData.entity;
            current = current.parent;
        }
        return null;
    }
}

if (typeof window !== 'undefined') {
    window.UniversalMaterialEngine = UniversalMaterialEngine;
}

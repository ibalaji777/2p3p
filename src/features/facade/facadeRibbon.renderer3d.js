import * as THREE from 'three';
import { buildRibbon3DGeometry, normalizeRibbonUVs } from './facadeRibbon.geometry.js';
import { ComponentRegistry } from '../../core/engine3d/ComponentRegistry.js';
import { MaterialSlots, ComponentTypes } from '../../core/constants/materialSlots.js';
import { FACADE_RIBBON_MATERIALS } from './facadeRibbon.registry.js';

/**
 * Builds and renders the 3D Continuous Facade Ribbon mesh group with 3-Layer BIM Material Slots.
 */
export const renderFacadeRibbon3D = (sceneGroup, entity, helpers = null) => {
    if (!entity || !entity.points || entity.points.length < 2) return null;

    const group = new THREE.Group();
    group.name = `FacadeRibbon_${entity.id || Date.now()}`;
    group.userData = {
        isFacadeRibbon: true,
        entity,
        componentType: ComponentTypes.FASCIA || 'fascia'
    };

    const width = entity.width || 40;
    const depth = entity.depth || 50;
    const matPreset = FACADE_RIBBON_MATERIALS[entity.material] || FACADE_RIBBON_MATERIALS.wood;

    const ribbonData = buildRibbon3DGeometry(entity.points, {
        width,
        depth,
        hasSpotlights: entity.hasSpotlights !== false,
        spotlightSpacing: entity.spotlightSpacing || 80
    });

    if (!ribbonData || !ribbonData.geometry) return null;

    const geo = normalizeRibbonUVs(ribbonData.geometry, ribbonData.totalLength, width * 2 + depth * 2);

    // Default Material
    const defaultColor = matPreset.color || 0x8b5a2b;
    const fallbackMat = new THREE.MeshStandardMaterial({
        color: defaultColor,
        roughness: matPreset.roughness || 0.6
    });

    let mainMat = fallbackMat;
    if (helpers && helpers.getDynamicMaterial) {
        mainMat = helpers.getDynamicMaterial(entity.material || 'wood', 'fascia') || fallbackMat;
    }

    // Main 3D Ribbon Mesh
    const ribbonMesh = new THREE.Mesh(geo, mainMat);
    ribbonMesh.castShadow = true;
    ribbonMesh.receiveShadow = true;
    ribbonMesh.userData = {
        entity,
        materialSlot: MaterialSlots.FASCIA_FRONT,
        componentId: `${entity.id || 'ribbon'}_body`,
        componentType: ComponentTypes.FASCIA || 'fascia'
    };

    ComponentRegistry.registerMesh(entity, MaterialSlots.FASCIA_FRONT, ribbonMesh, {
        componentId: `${entity.id || 'ribbon'}_body`,
        componentType: ComponentTypes.FASCIA || 'fascia'
    });
    group.add(ribbonMesh);

    // Render Under-Soffit Recessed Spotlights
    if (ribbonData.spotlights && ribbonData.spotlights.length > 0) {
        const spotGeo = new THREE.CylinderGeometry(3.5, 3.5, 1, 16);
        const spotSlot = MaterialSlots.LIGHT_LENS || 'light_lens';
        const spotMat = new THREE.MeshStandardMaterial({
            color: 0xfffbeb,
            emissive: 0xfef08a,
            emissiveIntensity: 0.8,
            roughness: 0.2
        });

        ribbonData.spotlights.forEach((spot, idx) => {
            const spotMesh = new THREE.Mesh(spotGeo, spotMat);
            spotMesh.position.set(spot.x, spot.y, spot.z);
            spotMesh.userData = {
                entity,
                materialSlot: spotSlot,
                componentId: `${entity.id || 'ribbon'}_spotlight_${idx}`,
                componentType: ComponentTypes.FASCIA || 'fascia'
            };

            ComponentRegistry.registerMesh(entity, spotSlot, spotMesh, {
                componentId: `${entity.id || 'ribbon'}_spotlight_${idx}`,
                componentType: ComponentTypes.FASCIA || 'fascia'
            });
            group.add(spotMesh);
        });
    }

    // Interactive 3D Node Markers for Corner Points
    const nodeGeo = new THREE.SphereGeometry(3.5, 16, 16);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false });
    entity.points.forEach((pt, idx) => {
        const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
        nodeMesh.position.set(pt.x, pt.y, pt.z);
        nodeMesh.renderOrder = 2000;
        nodeMesh.userData = {
            isNodeHandle: true,
            pointIndex: idx,
            entity
        };
        group.add(nodeMesh);
    });

    // Universal Registration Verification Pass
    group.traverse((child) => {
        if (child.isMesh && !child.userData.isNodeHandle) {
            child.userData.entity = entity;
            if (!child.userData.materialSlot) {
                child.userData.materialSlot = MaterialSlots.FASCIA_FRONT;
            }
            ComponentRegistry.registerMesh(entity, child.userData.materialSlot, child, {
                componentId: child.userData.componentId || `${entity.id || 'ribbon'}_${child.userData.materialSlot}`,
                componentType: ComponentTypes.FASCIA || 'fascia'
            });
        }
    });

    entity.mesh3D = group;

    if (sceneGroup) {
        sceneGroup.add(group);
    }
    return group;
};

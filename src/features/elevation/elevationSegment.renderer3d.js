import * as THREE from 'three';
import { buildElevationSegmentGeometry } from './elevationSegment.geometry.js';
import { ComponentRegistry } from '../../core/engine3d/ComponentRegistry.js';
import { MaterialSlots, ComponentTypes } from '../../core/constants/materialSlots.js';
import { ELEVATION_SEGMENT_MATERIALS } from './elevationSegment.registry.js';
import { normalizeRibbonUVs } from '../facade/facadeRibbon.geometry.js';

/**
 * Builds and renders the 3D Elevation Segment & connected Facade Ribbon mesh group
 * strictly adhering to the Universal In-Place Update Rule, 3-Layer CAD/BIM Component Architecture,
 * and Material Independence Rule.
 */
export const renderElevationSegment3D = (sceneGroup, entity, helpers = null) => {
    if (!entity || !entity.points || entity.points.length < 2) return null;

    const width = entity.width || 30;
    const depth = entity.depth || 40;
    const matPreset = ELEVATION_SEGMENT_MATERIALS[entity.material] || ELEVATION_SEGMENT_MATERIALS.wood;

    const assembly = buildElevationSegmentGeometry(entity.points, {
        width,
        depth,
        hasSpotlights: entity.hasSpotlights !== false,
        spotlightSpacing: entity.spotlightSpacing || 80
    });

    if (!assembly || !assembly.geometry) return null;

    const hasFillet = Boolean(assembly.expandedPath && assembly.expandedPath.some(p => p.isFilletSample));
    const geo = hasFillet
        ? assembly.geometry
        : normalizeRibbonUVs(assembly.geometry, assembly.totalLength, width * 2 + depth * 2);

    const defaultColor = matPreset.color || 0x8b5a2b;
    const fallbackMat = new THREE.MeshStandardMaterial({
        color: defaultColor,
        roughness: matPreset.roughness || 0.6
    });

    let mainMat = fallbackMat;
    if (helpers && helpers.getDynamicMaterial) {
        mainMat = helpers.getDynamicMaterial(entity.material || 'wood', 'fascia') || fallbackMat;
    }

    if (mainMat) {
        mainMat.polygonOffset = true;
        mainMat.polygonOffsetFactor = -1.0;
        mainMat.polygonOffsetUnits = -2.0;
        mainMat.side = THREE.FrontSide;
    }

    // Check for existing group to execute STRICT IN-PLACE UPDATE
    let group = entity.mesh3D;
    const isUpdateInPlace = Boolean(group && group.isGroup);

    if (!isUpdateInPlace) {
        group = new THREE.Group();
        group.name = `ElevationSegment_${entity.id || Date.now()}`;
        group.userData = {
            isElevationSegment: true,
            entity,
            componentType: ComponentTypes.FASCIA || 'fascia'
        };
        entity.mesh3D = group;
        if (sceneGroup) sceneGroup.add(group);
    } else {
        if (sceneGroup && group.parent !== sceneGroup) {
            sceneGroup.add(group);
        }
    }

    // Locate or create the main ribbon body mesh
    let bodyMesh = group.children.find(c => c.userData?.isElevationBody);
    if (!bodyMesh) {
        bodyMesh = new THREE.Mesh(geo, mainMat);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        bodyMesh.userData = {
            isElevationSegment: true,
            isElevationBody: true,
            entity,
            materialSlot: MaterialSlots.FASCIA_FRONT,
            componentId: `${entity.id || 'elev_seg'}_body`,
            componentType: ComponentTypes.FASCIA || 'fascia'
        };
        group.add(bodyMesh);

        ComponentRegistry.registerMesh(entity, MaterialSlots.FASCIA_FRONT, bodyMesh, {
            componentId: `${entity.id || 'elev_seg'}_body`,
            componentType: ComponentTypes.FASCIA || 'fascia'
        });
    } else {
        // IN-PLACE GEOMETRY REPLACEMENT (Preserves stable mesh identity, interactables & selection)
        if (bodyMesh.geometry) bodyMesh.geometry.dispose();
        bodyMesh.geometry = geo;
        bodyMesh.material = mainMat;
    }

    // Clean up old spotlights and branches before rebuilding children
    const toRemove = [];
    group.children.forEach(child => {
        if (child !== bodyMesh) toRemove.push(child);
    });
    toRemove.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        group.remove(child);
    });

    // Under-Soffit Spotlights
    if (assembly.spotlights && assembly.spotlights.length > 0) {
        const spotGeo = new THREE.CylinderGeometry(3.5, 3.5, 1, 16);
        const spotSlot = MaterialSlots.LIGHT_LENS || 'light_lens';
        const spotMat = new THREE.MeshStandardMaterial({
            color: 0xfffbeb,
            emissive: 0xfef08a,
            emissiveIntensity: 0.8,
            roughness: 0.2
        });

        assembly.spotlights.forEach((spot, idx) => {
            const spotMesh = new THREE.Mesh(spotGeo, spotMat);
            spotMesh.position.set(spot.x, spot.y, spot.z);
            spotMesh.userData = {
                isElevationSegment: true,
                entity,
                materialSlot: spotSlot,
                componentId: `${entity.id || 'elev_seg'}_spot_${idx}`,
                componentType: ComponentTypes.FASCIA || 'fascia'
            };

            ComponentRegistry.registerMesh(entity, spotSlot, spotMesh, {
                componentId: `${entity.id || 'elev_seg'}_spot_${idx}`,
                componentType: ComponentTypes.FASCIA || 'fascia'
            });
            group.add(spotMesh);
        });
    }

    // Render optional T-branches if any
    if (entity.branches && entity.branches.length > 0) {
        entity.branches.forEach((branch, bIdx) => {
            if (branch.points && branch.points.length >= 2) {
                const branchAssembly = buildElevationSegmentGeometry(branch.points, {
                    width,
                    depth,
                    hasSpotlights: false
                });
                if (branchAssembly && branchAssembly.geometry) {
                    const branchHasFillet = Boolean(branchAssembly.expandedPath && branchAssembly.expandedPath.some(p => p.isFilletSample));
                    const branchGeo = branchHasFillet
                        ? branchAssembly.geometry
                        : normalizeRibbonUVs(branchAssembly.geometry, branchAssembly.totalLength, width * 2 + depth * 2);
                    const branchMesh = new THREE.Mesh(branchGeo, mainMat);
                    branchMesh.castShadow = true;
                    branchMesh.receiveShadow = true;
                    branchMesh.userData = {
                        isElevationSegment: true,
                        entity,
                        materialSlot: MaterialSlots.FASCIA_FRONT,
                        componentId: `${entity.id || 'elev_seg'}_branch_${bIdx}`,
                        componentType: ComponentTypes.FASCIA || 'fascia'
                    };
                    ComponentRegistry.registerMesh(entity, MaterialSlots.FASCIA_FRONT, branchMesh, {
                        componentId: `${entity.id || 'elev_seg'}_branch_${bIdx}`,
                        componentType: ComponentTypes.FASCIA || 'fascia'
                    });
                    group.add(branchMesh);
                }
            }
        });
    }

    return group;
};

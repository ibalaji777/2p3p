import * as THREE from 'three';
import { MaterialSlots, ComponentTypes } from '../../core/constants/materialSlots.js';
import { ComponentRegistry } from '../../core/engine3d/ComponentRegistry.js';
import { generateMoldingProfileShape, calculateMoldingSegments } from './molding.geometry.js';

const defaultMaterials = {
    white_paint: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    wall_material: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.8 }),
    wood_dark: new THREE.MeshStandardMaterial({ color: 0x4a3b32, roughness: 0.6 }),
    wood_white_oak: new THREE.MeshStandardMaterial({ color: 0xc8b293, roughness: 0.6 }),
    wood_golden_teak: new THREE.MeshStandardMaterial({ color: 0x9b6b38, roughness: 0.6 }),
    black_metal: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.8 })
};
Object.values(defaultMaterials).forEach(m => m.userData = { isShared: true });

export const getMoldingMaterial = (matName) => {
    return defaultMaterials[matName] || defaultMaterials.white_paint;
};

/**
 * Builds the complete 3D Three.js Group for a molding / trim / skirting segment.
 */
export const buildMoldingMesh3D = (moldData, wallLength, wallThickness, helpers = null, wallEntity = null) => {
    const depth = moldData.depth || 2;
    const moldingHeight = moldData.moldingHeight || moldData.height || 10;
    const isTopAnchored = moldData.anchorMode === 'top' || (!moldData.anchorMode && (moldData.type?.includes('crown') || moldData.type?.includes('frieze') || moldData.type?.includes('cornice')));
    const wallH = wallEntity?.height || moldData.wall?.height || 180;
    const heightOffset = isTopAnchored ? Math.max(0, wallH - moldingHeight) : (moldData.heightOffset !== undefined ? moldData.heightOffset : 0);
    moldData.heightOffset = heightOffset;
    const profileType = moldData.profileType || 'skirting_flat';
    const isGroove = moldData.type === 'molding_groove' || profileType === 'groove';

    const isFullLength = !moldData.isCustomWidth || !moldData.width || Math.abs(moldData.width - wallLength) < 5;
    const actualLength = isFullLength ? wallLength : (moldData.width || wallLength);
    moldData.width = actualLength;

    const finalShape = generateMoldingProfileShape(profileType, depth, moldingHeight, moldData);

    const segments = calculateMoldingSegments(actualLength, heightOffset, moldingHeight, wallEntity || moldData.wall);

    const group = new THREE.Group();
    const zOffset = (wallThickness / 2) * (moldData.side === 'right' ? -1 : 1);
    const rotY = (moldData.side === 'right') ? Math.PI / 2 : -Math.PI / 2;

    let finalMat = getMoldingMaterial(moldData.material);

    const sharpProfiles = ['skirting_flat', 'flat_baseboard', 'skirting_craftsman', 'craftsman_baseboard', 'skirting_shadow', 'craftsman', 'dentil', 'layered', 'frame', 'flat', 'groove', 'foundation_trim', 'beveled_trim', 'fluted_band'];
    if (sharpProfiles.includes(profileType)) {
        finalMat = finalMat.clone();
        finalMat.flatShading = true;
        finalMat.needsUpdate = true;
    }

    const isSkirting = (moldData.type && moldData.type.includes('skirting')) || (profileType && profileType.includes('skirting'));
    const slotName = isSkirting ? (MaterialSlots.SKIRTING || 'skirting') : (MaterialSlots.MOLDING || 'molding');
    const entityId = moldData.id || `molding_${Date.now()}`;
    const componentType = isSkirting ? (ComponentTypes.SKIRTING || 'skirting') : (ComponentTypes.MOLDING || 'molding');

    group.userData = { 
        isMolding: true, 
        isSkirting,
        type: profileType, 
        moldData, 
        entity: moldData,
        materialSlot: slotName,
        componentId: `${entityId}_${slotName}`,
        componentType
    };

    const protrusions = (wallEntity?.attachedWidgets || []).filter(w => (w.type === 'solid_protrusion' || w.configId === 'solid_protrusion') && w.depth);
    const relevantProtrusions = protrusions.filter(p => {
        const pFacing = p.facing !== undefined ? p.facing : 1;
        const matchSide = (moldData.side === 'right' && pFacing === -1) || (moldData.side !== 'right' && pFacing === 1);
        if (!matchSide) return false;
        const pElev = p.elevation !== undefined ? p.elevation : 0;
        const pH = p.height !== undefined ? p.height : 120;
        const mElev = heightOffset !== undefined ? heightOffset : 0;
        const mH = moldingHeight || 10;
        return Math.max(mElev, pElev) < Math.min(mElev + mH, pElev + pH);
    });

    const refinedSegments = [];
    for (const seg of segments) {
        let currentX = seg.start;
        const intersecting = relevantProtrusions.map(p => {
            const wCenter = (p.localX !== undefined ? p.localX : (p.t !== undefined ? p.t : 0.5) * wallLength);
            const halfW = (p.width || 40) / 2;
            return {
                start: Math.max(seg.start, wCenter - halfW),
                end: Math.min(seg.end, wCenter + halfW),
                depth: p.depth || 10
            };
        }).filter(p => p.end > p.start + 0.1).sort((a, b) => a.start - b.start);

        if (intersecting.length === 0) {
            refinedSegments.push({ start: seg.start, end: seg.end, extraZ: 0 });
        } else {
            for (const p of intersecting) {
                if (p.start > currentX + 0.5) {
                    refinedSegments.push({ start: currentX, end: p.start, extraZ: 0 });
                }
                refinedSegments.push({ start: p.start, end: p.end, extraZ: p.depth, isProtrusionFace: true });
                currentX = p.end;
            }
            if (currentX < seg.end - 0.5) {
                refinedSegments.push({ start: currentX, end: seg.end, extraZ: 0 });
            }
        }
    }

    const signZ = moldData.side === 'right' ? -1 : 1;

    for (let sIdx = 0; sIdx < refinedSegments.length; sIdx++) {
        const seg = refinedSegments[sIdx];
        const prevSeg = refinedSegments[sIdx - 1];
        const nextSeg = refinedSegments[sIdx + 1];
        const segLen = seg.end - seg.start;
        if (segLen < 0.5) continue;

        const extrudeSteps = Math.max(1, Math.floor(segLen / 10));
        const segGeo = new THREE.ExtrudeGeometry(finalShape, { 
            depth: segLen, 
            bevelEnabled: false, 
            curveSegments: 12, 
            steps: extrudeSteps 
        });

        const posAttr = segGeo.attributes.position;
        const uvs = new Float32Array(posAttr.count * 2);
        for (let i = 0; i < posAttr.count; i++) {
            uvs[i*2] = (posAttr.getZ(i) + seg.start) / 100;
            uvs[i*2+1] = posAttr.getY(i) / 100;
        }
        segGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        segGeo.rotateY(rotY);
        const extraZOffset = (moldData.side === 'right') ? -(seg.extraZ || 0) : (seg.extraZ || 0);
        if (moldData.side === 'right') {
            segGeo.translate(seg.start, heightOffset, zOffset + extraZOffset);
        } else {
            segGeo.translate(seg.end, heightOffset, zOffset + extraZOffset);
        }

        if (isGroove || depth < 0) {
            segGeo.translate(0, 0, moldData.side === 'right' ? depth : -depth);
        }

        const zBase = zOffset + extraZOffset;
        const miterStartInside = !seg.isProtrusionFace && prevSeg?.isProtrusionFace && Math.abs(prevSeg.end - seg.start) < 0.5;
        const miterEndInside = !seg.isProtrusionFace && nextSeg?.isProtrusionFace && Math.abs(nextSeg.start - seg.end) < 0.5;
        const miterStartOutside = seg.isProtrusionFace;
        const miterEndOutside = seg.isProtrusionFace;

        const pos = segGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const distZ = (z - zBase) * signZ;

            if (miterStartInside && x <= seg.start + 0.1) {
                pos.setX(i, seg.start + distZ);
            } else if (miterStartOutside && x <= seg.start + 0.1) {
                pos.setX(i, seg.start - distZ);
            }

            if (miterEndInside && x >= seg.end - 0.1) {
                pos.setX(i, seg.end - distZ);
            } else if (miterEndOutside && x >= seg.end - 0.1) {
                pos.setX(i, seg.end + distZ);
            }
        }
        pos.needsUpdate = true;
        segGeo.computeVertexNormals();

        let materials = finalMat;
        if (helpers && helpers.getFaceMaterials) {
            const multiMat = helpers.getFaceMaterials(moldData, finalMat, { width: segLen, height: moldingHeight });
            materials = multiMat.extrude;
        }

        const segMesh = new THREE.Mesh(segGeo, materials);
        segMesh.castShadow = true;
        segMesh.receiveShadow = true;
        segMesh.userData = { ...group.userData };
        ComponentRegistry.registerMesh(moldData, slotName, segMesh, {
            componentId: `${entityId}_${slotName}`,
            componentType
        });
        group.add(segMesh);

        if (seg.isProtrusionFace && seg.extraZ > 0.5) {
            const returnSteps = Math.max(1, Math.floor(seg.extraZ / 10));
            const z0 = zOffset;
            const z1 = zOffset + seg.extraZ * signZ;
            
            const startRetGeo = new THREE.ExtrudeGeometry(finalShape, {
                depth: seg.extraZ,
                bevelEnabled: false,
                curveSegments: 12,
                steps: returnSteps
            });
            
            if (moldData.side === 'right') {
                startRetGeo.rotateY(Math.PI);
                startRetGeo.translate(seg.start, heightOffset, zOffset);
            } else {
                startRetGeo.rotateY(Math.PI);
                startRetGeo.translate(seg.start, heightOffset, zOffset + seg.extraZ);
            }

            const startPos = startRetGeo.attributes.position;
            for (let i = 0; i < startPos.count; i++) {
                const x = startPos.getX(i);
                const z = startPos.getZ(i);
                const distX = seg.start - x;

                if (Math.abs(z - z0) <= 0.1) {
                    startPos.setZ(i, z0 + distX * signZ);
                } else if (Math.abs(z - z1) <= 0.1) {
                    startPos.setZ(i, z1 + distX * signZ);
                }
            }
            startPos.needsUpdate = true;
            startRetGeo.computeVertexNormals();
            
            const startRetMesh = new THREE.Mesh(startRetGeo, materials);
            startRetMesh.castShadow = true;
            startRetMesh.receiveShadow = true;
            startRetMesh.userData = { ...group.userData };
            ComponentRegistry.registerMesh(moldData, slotName, startRetMesh, {
                componentId: `${entityId}_${slotName}`,
                componentType
            });
            group.add(startRetMesh);

            const endRetGeo = new THREE.ExtrudeGeometry(finalShape, {
                depth: seg.extraZ,
                bevelEnabled: false,
                curveSegments: 12,
                steps: returnSteps
            });
            if (moldData.side === 'right') {
                endRetGeo.translate(seg.end, heightOffset, zOffset - seg.extraZ);
            } else {
                endRetGeo.translate(seg.end, heightOffset, zOffset);
            }

            const endPos = endRetGeo.attributes.position;
            for (let i = 0; i < endPos.count; i++) {
                const x = endPos.getX(i);
                const z = endPos.getZ(i);
                const distX = x - seg.end;

                if (Math.abs(z - z1) <= 0.1) {
                    endPos.setZ(i, z1 + distX * signZ);
                } else if (Math.abs(z - z0) <= 0.1) {
                    endPos.setZ(i, z0 + distX * signZ);
                }
            }
            endPos.needsUpdate = true;
            endRetGeo.computeVertexNormals();
            
            const endRetMesh = new THREE.Mesh(endRetGeo, materials);
            endRetMesh.castShadow = true;
            endRetMesh.receiveShadow = true;
            endRetMesh.userData = { ...group.userData };
            ComponentRegistry.registerMesh(moldData, slotName, endRetMesh, {
                componentId: `${entityId}_${slotName}`,
                componentType
            });
            group.add(endRetMesh);
        }
    }

    group.traverse(child => {
        if (child.isMesh) {
            child.userData = { ...group.userData };
            ComponentRegistry.registerMesh(moldData, slotName, child, {
                componentId: `${entityId}_${slotName}`,
                componentType
            });
        }
    });
    
    return group;
};

/**
 * Renders an isometric 3D preview thumbnail for catalog / gallery cards.
 */
export const renderMolding3D = (sceneGroup, entity, helpers, configKey) => {
    const moldData = { ...(entity?.params || entity || {}) };
    const length = 36;
    const moldGroup = buildMoldingMesh3D({ ...moldData, width: length, depth: moldData.depth || 3, type: configKey }, length, 10, helpers);
    
    moldGroup.rotation.y = Math.PI / 4.5;
    moldGroup.rotation.x = Math.PI / 14;

    const glossyMat = new THREE.MeshStandardMaterial({
        color: moldData.material === 'wood_dark' ? 0x4a3b32 : (moldData.material === 'black_metal' ? 0x222222 : 0xf1f5f9),
        roughness: 0.4,
        metalness: 0.1
    });
    moldGroup.traverse(child => {
        if (child.isMesh) child.material = glossyMat;
    });

    sceneGroup.add(moldGroup);
    return moldGroup;
};

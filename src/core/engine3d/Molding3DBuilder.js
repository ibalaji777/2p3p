import * as THREE from 'three';
import { ComponentRegistry } from './ComponentRegistry.js';
import { MaterialSlots, ComponentTypes } from '../constants/materialSlots.js';

export class Molding3DBuilder {
    constructor() {
        this.materials = {
            white_paint: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
            wall_material: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.8 }),
            wood_dark: new THREE.MeshStandardMaterial({ color: 0x4a3b32, roughness: 0.6 }),
            wood_white_oak: new THREE.MeshStandardMaterial({ color: 0xc8b293, roughness: 0.6 }),
            wood_golden_teak: new THREE.MeshStandardMaterial({ color: 0x9b6b38, roughness: 0.6 }),
            black_metal: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.8 })
        };
        Object.values(this.materials).forEach(m => m.userData = { isShared: true });
    }

    getMaterial(matName) {
        return this.materials[matName] || this.materials.white_paint;
    }

    buildMolding(moldData, wallLength, wallThickness, helpers = null) {
        const t = moldData.t || 0.5;
        const width = moldData.width || 50; // This is the length along the wall
        const depth = moldData.depth || 2;  // Projection from the wall
        const heightOffset = moldData.heightOffset !== undefined ? moldData.heightOffset : 0;
        const profileType = moldData.profileType || 'skirting_flat';
        const isGroove = moldData.type === 'molding_groove' || profileType === 'groove';
        
        const actualLength = width; 
        
        const finalShape = new THREE.Shape();
        const d = depth;
        const moldingHeight = moldData.moldingHeight || moldData.height || 10; // Dynamic height of the profile
        
        // Shape is drawn in X,Y where X = depth (Z axis), Y = height (Y axis).
        let hasOrnaments = false;
        
        // ====== BASEBOARD & SKIRTING PROFILES ======
        if (profileType === 'skirting_flat' || profileType === 'flat_baseboard') {
            // Modern Flat Baseboard: Crisp rectangular profile
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            finalShape.lineTo(d, moldingHeight);
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'skirting_beveled' || profileType === 'skirting_chamfer' || profileType === 'chamfered_baseboard') {
            // Modern Chamfered / Beveled Top Baseboard
            const chamferH = Math.min(moldingHeight * 0.25, d * 0.85);
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            finalShape.lineTo(d, moldingHeight - chamferH);
            finalShape.lineTo(d * 0.2, moldingHeight);
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'skirting_torus' || profileType === 'skirting_bullnose' || profileType === 'torus_baseboard') {
            // Torus / Bullnose Skirting: Flat base with semi-convex bullnose upper section
            const torusH = Math.min(moldingHeight * 0.35, d * 1.2);
            const flatH = moldingHeight - torusH;
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            finalShape.lineTo(d, flatH);
            finalShape.bezierCurveTo(d * 1.05, flatH + torusH * 0.4, d * 0.7, moldingHeight, 0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'skirting_ogee' || profileType === 'ogee_baseboard') {
            // Classic Victorian / Colonial Ogee Skirting: Plinth base, step quirk, then cyma reversa S-curve
            const plinthH = moldingHeight * 0.45;
            const ogeeH = moldingHeight - plinthH;
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            finalShape.lineTo(d, plinthH);
            finalShape.lineTo(d * 0.9, plinthH + ogeeH * 0.1); // subtle step quirk
            finalShape.bezierCurveTo(d * 0.95, plinthH + ogeeH * 0.35, d * 0.55, plinthH + ogeeH * 0.65, d * 0.35, moldingHeight * 0.9);
            finalShape.bezierCurveTo(d * 0.25, moldingHeight * 0.98, d * 0.1, moldingHeight, 0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'skirting_craftsman' || profileType === 'skirting_step' || profileType === 'craftsman_baseboard') {
            // Stepped Craftsman Skirting: Multi-tier architectural relief tiers
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            finalShape.lineTo(d, moldingHeight * 0.55);
            finalShape.lineTo(d * 0.7, moldingHeight * 0.55);
            finalShape.lineTo(d * 0.7, moldingHeight * 0.82);
            finalShape.lineTo(d * 0.4, moldingHeight * 0.82);
            finalShape.lineTo(d * 0.4, moldingHeight);
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'skirting_shadow' || profileType === 'skirting_recess' || profileType === 'shadow_gap_baseboard') {
            // Modern Minimalist Shadow Gap / Recessed Reglet Skirting
            const revealH = Math.min(moldingHeight * 0.2, 2);
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            finalShape.lineTo(d, moldingHeight - revealH);
            finalShape.lineTo(d * 0.2, moldingHeight - revealH);
            finalShape.lineTo(d * 0.2, moldingHeight);
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'skirting_scotia' || profileType === 'skirting_cove' || profileType === 'scotia_baseboard') {
            // Scotia / Cove Baseboard: Flat base with concave upper scoop
            const coveH = moldingHeight * 0.45;
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            finalShape.lineTo(d, moldingHeight - coveH);
            finalShape.bezierCurveTo(d * 0.4, moldingHeight - coveH * 0.6, d * 0.2, moldingHeight - coveH * 0.2, 0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'skirting_shoe' || profileType === 'skirting_quarter_round' || profileType === 'quarter_round_shoe') {
            // Quarter Round Floor Shoe Trim
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            finalShape.bezierCurveTo(d, moldingHeight * 0.55, d * 0.55, moldingHeight, 0, moldingHeight);
            finalShape.lineTo(0, 0);
            
        // ====== CROWN, CORNICE, AND WALL MOLDINGS ======
        } else if (profileType === 'egg_and_dart') {
            hasOrnaments = true;
            // Background is a recessed slant
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d * 0.2, 0);
            finalShape.lineTo(d * 0.2, moldingHeight * 0.1);
            finalShape.lineTo(d * 0.5, moldingHeight * 0.8);
            finalShape.lineTo(d, moldingHeight * 0.8);
            finalShape.lineTo(d, moldingHeight);
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'dentil') {
            hasOrnaments = true;
            // Base profile: A simple flat band with a lip above and below, and a recessed track for the dentils
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d * 0.6, 0);
            finalShape.lineTo(d * 0.6, moldingHeight * 0.2);
            finalShape.lineTo(d * 0.3, moldingHeight * 0.2); // Recess back
            finalShape.lineTo(d * 0.3, moldingHeight * 0.8); // Vertical recessed track
            finalShape.lineTo(d, moldingHeight * 0.8); // Top lip projects further
            finalShape.lineTo(d, moldingHeight);
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'craftsman') {
            const mb = Math.min(d * 0.05, moldingHeight * 0.02);
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d * 0.2 - mb, 0);
            finalShape.lineTo(d * 0.2, mb);
            finalShape.lineTo(d * 0.2, moldingHeight * 0.35 - mb); 
            finalShape.lineTo(d * 0.45 - mb, moldingHeight * 0.35);
            finalShape.lineTo(d * 0.45, moldingHeight * 0.35 + mb);
            finalShape.lineTo(d * 0.45, moldingHeight * 0.6 - mb);
            finalShape.lineTo(d * 0.75 - mb, moldingHeight * 0.6);
            finalShape.lineTo(d * 0.75, moldingHeight * 0.6 + mb);
            finalShape.lineTo(d * 0.75, moldingHeight * 0.8 - mb);
            finalShape.lineTo(d - mb, moldingHeight * 0.8);
            finalShape.lineTo(d, moldingHeight * 0.8 + mb);
            finalShape.lineTo(d, moldingHeight);
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'ogee') {
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d * 0.15, 0); 
            finalShape.lineTo(d * 0.15, moldingHeight * 0.1);
            finalShape.bezierCurveTo(d * 0.5, moldingHeight * 0.1, d * 0.55, moldingHeight * 0.3, d * 0.55, moldingHeight * 0.5);
            finalShape.bezierCurveTo(d * 0.55, moldingHeight * 0.7, d * 0.6, moldingHeight * 0.9, d * 0.95, moldingHeight * 0.9);
            finalShape.lineTo(d, moldingHeight * 0.9);
            finalShape.lineTo(d, moldingHeight);
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'crown') {
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d * 0.2, 0);
            finalShape.lineTo(d * 0.2, moldingHeight * 0.1);
            finalShape.bezierCurveTo(d * 0.8, moldingHeight * 0.3, d * 0.9, moldingHeight * 0.8, d, moldingHeight * 0.9);
            finalShape.lineTo(d, moldingHeight);
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'layered') {
            const layers = moldData.layers || 4;
            const stepH = moldingHeight / layers;
            const stepD = d / layers;
            finalShape.moveTo(0, 0);
            for (let i = 0; i < layers; i++) {
                finalShape.lineTo((i + 1) * stepD, i * stepH);
                finalShape.lineTo((i + 1) * stepD, (i + 1) * stepH);
            }
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'frame') {
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            finalShape.lineTo(d, moldingHeight * 0.6);
            finalShape.lineTo(d * 0.6, moldingHeight * 0.8);
            finalShape.lineTo(d * 0.6, moldingHeight);
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'groove') {
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            finalShape.lineTo(d, moldingHeight * 0.2);
            finalShape.lineTo(d * 0.5, moldingHeight * 0.5);
            finalShape.lineTo(d, moldingHeight * 0.8);
            finalShape.lineTo(d, moldingHeight);
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        } else {
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            finalShape.lineTo(d, moldingHeight);
            finalShape.lineTo(0, moldingHeight);
            finalShape.lineTo(0, 0);
        }

        // Subdivide extrusion along its length to prevent stretched triangles with shearGeo
        const extrudeSteps = Math.max(1, Math.floor(actualLength / 10));
        const finalGeo = new THREE.ExtrudeGeometry(finalShape, { 
            depth: actualLength, 
            bevelEnabled: false, 
            curveSegments: 12, 
            steps: extrudeSteps 
        });
        
        // Correct UVs BEFORE transformations
        const posAttr = finalGeo.attributes.position;
        const uvs = new Float32Array(posAttr.count * 2);
        for (let i = 0; i < posAttr.count; i++) {
            uvs[i*2] = posAttr.getZ(i) / 100; // Z is length along wall
            uvs[i*2+1] = posAttr.getY(i) / 100; // Y is height
        }
        finalGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        let zOffset = (wallThickness / 2);
        let xOff = 0;
        let rotY = 0;
        
        if (moldData.side === 'right') {
            rotY = Math.PI / 2;
            xOff = -actualLength / 2;
            zOffset = -zOffset;
        } else {
            rotY = -Math.PI / 2;
            xOff = actualLength / 2;
        }
        
        const xPos = t * wallLength;
        
        // Mutate base geometry so it is in Wall Local Space (required for shearGeo)
        finalGeo.rotateY(rotY);
        finalGeo.translate(xPos + xOff, heightOffset, zOffset);
        
        let finalMat = this.getMaterial(moldData.material);

        if (isGroove || depth < 0) {
            // World Z translation in Wall Local Space
            finalGeo.translate(0, 0, moldData.side === 'right' ? depth : -depth);
            finalMat = this.materials.black_metal;
        }

        // Sharp geometric profiles MUST use flatShading for crisp edges
        const sharpProfiles = ['skirting_flat', 'flat_baseboard', 'skirting_craftsman', 'craftsman_baseboard', 'skirting_shadow', 'craftsman', 'dentil', 'layered', 'frame', 'flat', 'groove'];
        if (sharpProfiles.includes(profileType)) {
            finalMat = finalMat.clone();
            finalMat.flatShading = true;
            finalMat.needsUpdate = true;
        }

        let materials = finalMat;
        if (helpers && helpers.getFaceMaterials) {
            const multiMat = helpers.getFaceMaterials(moldData, finalMat, { width: actualLength, height: moldingHeight });
            materials = multiMat.extrude;
        }

        const mesh = new THREE.Mesh(finalGeo, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        const group = new THREE.Group();
        group.add(mesh);

        // Procedural Ornaments
        if (hasOrnaments) {
            const ornamentGroup = new THREE.Group();
            const dummy = new THREE.Object3D();
            
            if (profileType === 'egg_and_dart') {
                const radius = moldingHeight * 0.22;
                const spacing = radius * 3.5;
                const count = Math.max(1, Math.floor(actualLength / spacing));
                
                const eggGeo = new THREE.SphereGeometry(radius, 16, 16);
                eggGeo.scale(0.8, 1.2, 0.4); 
                const dartGeo = new THREE.ConeGeometry(radius * 0.3, radius * 1.6, 4);
                dartGeo.rotateX(Math.PI);
                dartGeo.scale(1, 1, 0.4);

                const eggInst = new THREE.InstancedMesh(eggGeo, finalMat, count);
                const dartInst = new THREE.InstancedMesh(dartGeo, finalMat, count);
                eggInst.castShadow = true; eggInst.receiveShadow = true;
                dartInst.castShadow = true; dartInst.receiveShadow = true;

                const slantAngle = Math.atan2(moldingHeight * 0.7, d * 0.3);
                
                for (let i = 0; i < count; i++) {
                    const zPos = (i + 0.5) * spacing;
                    dummy.position.set(d * 0.45, moldingHeight * 0.45, zPos);
                    dummy.rotation.set(0, 0, -(Math.PI / 2 - slantAngle));
                    dummy.updateMatrix();
                    eggInst.setMatrixAt(i, dummy.matrix);
                    
                    if (i < count - 1) {
                        const dartZ = zPos + spacing / 2;
                        dummy.position.set(d * 0.45, moldingHeight * 0.45, dartZ);
                        dummy.rotation.set(0, 0, -(Math.PI / 2 - slantAngle));
                        dummy.updateMatrix();
                        dartInst.setMatrixAt(i, dummy.matrix);
                    }
                }
                ornamentGroup.add(eggInst, dartInst);
            } else if (profileType === 'dentil') {
                const blockHeight = moldingHeight * 0.5;
                const blockDepth = d * 0.4;
                const blockWidth = moldingHeight * 0.4;
                const gap = moldingHeight * 0.25;
                const spacing = blockWidth + gap;
                const count = Math.max(1, Math.floor(actualLength / spacing));
                
                const dentilGeo = new THREE.BoxGeometry(blockDepth, blockHeight, blockWidth);
                const dentilInst = new THREE.InstancedMesh(dentilGeo, finalMat, count);
                dentilInst.castShadow = true; dentilInst.receiveShadow = true;
                
                for (let i = 0; i < count; i++) {
                    const zPos = (i + 0.5) * spacing;
                    dummy.position.set(d * 0.3 + blockDepth / 2, moldingHeight * 0.5, zPos);
                    dummy.rotation.set(0, 0, 0);
                    dummy.updateMatrix();
                    dentilInst.setMatrixAt(i, dummy.matrix);
                }
                ornamentGroup.add(dentilInst);
            }
            
            ornamentGroup.rotation.y = rotY;
            ornamentGroup.position.set(xPos + xOff, heightOffset, zOffset);
            group.add(ornamentGroup);
        }
        
        // Semantic CAD/BIM Component Registration
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

        mesh.userData = { ...group.userData };
        ComponentRegistry.registerMesh(moldData, slotName, mesh, {
            componentId: `${entityId}_${slotName}`,
            componentType
        });

        group.traverse(child => {
            if (child.isMesh && child !== mesh) {
                child.userData = { ...group.userData };
                ComponentRegistry.registerMesh(moldData, slotName, child, {
                    componentId: `${entityId}_${slotName}`,
                    componentType
                });
            }
        });
        
        return group;
    }
}

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

    getMoldingSegments(wallLength, heightOffset, moldingHeight, wallEntity) {
        const mElev = heightOffset !== undefined ? heightOffset : 0;
        const mH = moldingHeight || 10;
        const mTop = mElev + mH;
        const cuts = [];

        const widgets = wallEntity?.attachedWidgets || wallEntity?.widgets || [];
        for (const widg of widgets) {
            const type = (widg.type === 'window' || widg.windowType || (widg.config && widg.config.widget === 'window') || widg.configId === 'window') ? 'window' :
                         (widg.type === 'door' || widg.doorType || (widg.config && widg.config.widget === 'door') || widg.configId === 'door') ? 'door' :
                         (widg.type === 'opening' || widg.configId === 'opening') ? 'opening' :
                         (widg.type === 'jali_panel' || widg.configId === 'jali_panel') ? 'jali_panel' :
                         (widg.type || widg.configId);

            const isCutout = type === 'door' || type === 'window' || type === 'opening' || type === 'jali_panel' || type === 'arch_opening';
            if (!isCutout) continue;

            const wCenter = (widg.localX !== undefined ? widg.localX : (widg.t !== undefined ? widg.t : 0.5) * wallLength);
            const isDoor = type === 'door' || widg.doorType || (widg.config && widg.config.widget === 'door') || widg.configId === 'door';
            const casingExt = isDoor ? (3.8 - 1.25) : 0; // archW (3.8) - jambW (1.25) = 2.55 units outer casing trim
            const halfW = ((widg.width || 60) / 2) + casingExt;
            const wElev = widg.elevation !== undefined ? widg.elevation : (type === 'window' ? 80 : 0);
            const wH = widg.height !== undefined ? widg.height : (type === 'door' ? 210 : (type === 'window' ? 120 : 100));
            const wTop = wElev + wH;

            // Check if cutout overlaps with molding height range
            if (Math.max(mElev, wElev) < Math.min(mTop, wTop)) {
                const cutStart = Math.max(0, wCenter - halfW);
                const cutEnd = Math.min(wallLength, wCenter + halfW);
                if (cutEnd > cutStart) {
                    cuts.push({ start: cutStart, end: cutEnd });
                }
            }
        }

        if (cuts.length === 0) {
            return [{ start: 0, end: wallLength }];
        }

        cuts.sort((a, b) => a.start - b.start);
        const mergedCuts = [];
        for (const c of cuts) {
            if (mergedCuts.length === 0) {
                mergedCuts.push({ start: c.start, end: c.end });
            } else {
                const last = mergedCuts[mergedCuts.length - 1];
                if (c.start <= last.end + 0.1) {
                    last.end = Math.max(last.end, c.end);
                } else {
                    mergedCuts.push({ start: c.start, end: c.end });
                }
            }
        }

        const segments = [];
        let currentX = 0;
        for (const cut of mergedCuts) {
            if (cut.start > currentX + 0.5) {
                segments.push({ start: currentX, end: cut.start });
            }
            currentX = Math.max(currentX, cut.end);
        }
        if (currentX < wallLength - 0.5) {
            segments.push({ start: currentX, end: wallLength });
        }

        return segments.length > 0 ? segments : [{ start: 0, end: wallLength }];
    }

    buildMolding(moldData, wallLength, wallThickness, helpers = null, wallEntity = null) {
        const t = moldData.t || 0.5;
        const width = moldData.width || 50; // This is the length along the wall
        const depth = moldData.depth || 2;  // Projection from the wall
        const heightOffset = moldData.heightOffset !== undefined ? moldData.heightOffset : 0;
        const profileType = moldData.profileType || 'skirting_flat';
        const isGroove = moldData.type === 'molding_groove' || profileType === 'groove';
        
        const isFullLength = !moldData.isCustomWidth || !moldData.width || Math.abs(moldData.width - wallLength) < 5;
        const actualLength = isFullLength ? wallLength : (moldData.width || wallLength);
        moldData.width = actualLength; 
        
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
        // ====== WALL TRIMS, CHAIR RAILS & PICTURE RAILS ======
        } else if (profileType === 'chair_rail' || profileType === 'dado_rail' || profileType === 'molding_chair_rail') {
            // Classical Chair Rail: Ogee top lip, prominent beaded center, and cove bottom plinth
            const h = moldingHeight;
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d * 0.35, 0);
            // Lower scoop cove
            finalShape.bezierCurveTo(d * 0.45, h * 0.15, d * 0.3, h * 0.35, d * 0.65, h * 0.45);
            // Center prominent rounded bead
            finalShape.bezierCurveTo(d * 1.05, h * 0.52, d * 1.05, h * 0.68, d * 0.65, h * 0.75);
            // Upper cyma reversa curve to top lip
            finalShape.bezierCurveTo(d * 0.55, h * 0.85, d * 0.85, h * 0.95, d, h * 0.95);
            finalShape.lineTo(d, h);
            finalShape.lineTo(0, h);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'picture_rail' || profileType === 'molding_picture_rail') {
            // Picture Rail: Slender hook profile with top bead and scooped bottom
            const h = moldingHeight;
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d * 0.3, 0);
            finalShape.bezierCurveTo(d * 0.35, h * 0.3, d * 0.5, h * 0.5, d * 0.8, h * 0.7);
            // Top hook rounded roll
            finalShape.bezierCurveTo(d * 1.05, h * 0.85, d * 0.9, h, d * 0.4, h);
            finalShape.lineTo(0, h);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'fluted_band' || profileType === 'molding_fluted_band') {
            // Architectural Fluted Horizontal Band: 3 parallel vertical flutes
            const h = moldingHeight;
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            const fluteH = h / 4;
            for (let f = 0; f < 3; f++) {
                const yBase = fluteH * (f + 0.5);
                finalShape.lineTo(d, yBase - fluteH * 0.3);
                finalShape.bezierCurveTo(d * 0.6, yBase - fluteH * 0.2, d * 0.6, yBase + fluteH * 0.2, d, yBase + fluteH * 0.3);
            }
            finalShape.lineTo(d, h);
            finalShape.lineTo(0, h);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'double_bead' || profileType === 'molding_double_bead') {
            // Double Beaded Horizontal Trim
            const h = moldingHeight;
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d * 0.4, 0);
            // Lower bead
            finalShape.bezierCurveTo(d * 1.0, h * 0.15, d * 1.0, h * 0.4, d * 0.4, h * 0.48);
            // Quirk notch
            finalShape.lineTo(d * 0.25, h * 0.5);
            finalShape.lineTo(d * 0.4, h * 0.52);
            // Upper bead
            finalShape.bezierCurveTo(d * 1.0, h * 0.6, d * 1.0, h * 0.85, d * 0.4, h);
            finalShape.lineTo(0, h);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'frieze_exterior' || profileType === 'frieze' || profileType === 'elevation_frieze' || profileType === 'molding_frieze') {
            // Exterior Architectural Frieze: Stepped bottom drip plinth, wide flat fascia band, projecting top crown
            const h = moldingHeight;
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d * 0.4, 0);
            finalShape.lineTo(d * 0.4, h * 0.12);
            finalShape.lineTo(d * 0.6, h * 0.12);
            finalShape.lineTo(d * 0.6, h * 0.75);
            // Top crown cantilever projection
            finalShape.bezierCurveTo(d * 0.8, h * 0.82, d * 0.95, h * 0.9, d, h * 0.92);
            finalShape.lineTo(d, h);
            finalShape.lineTo(0, h);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'foundation_trim' || profileType === 'elevation_foundation_trim' || profileType === 'molding_foundation') {
            // Heavy Exterior Masonry Foundation Plinth with 45-degree water-table drip wash
            const h = moldingHeight;
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d, 0);
            finalShape.lineTo(d, h * 0.6);
            finalShape.lineTo(d * 0.3, h * 0.88); // 45-degree water-shedding wash slope
            finalShape.lineTo(d * 0.3, h);
            finalShape.lineTo(0, h);
            finalShape.lineTo(0, 0);
        } else if (profileType === 'beveled_trim' || profileType === 'chamfer_trim') {
            // Modern Double-Chamfered Accent Trim
            const h = moldingHeight;
            const chamfer = Math.min(h * 0.25, d * 0.6);
            finalShape.moveTo(0, 0);
            finalShape.lineTo(d * 0.2, 0);
            finalShape.lineTo(d, chamfer);
            finalShape.lineTo(d, h - chamfer);
            finalShape.lineTo(d * 0.2, h);
            finalShape.lineTo(0, h);
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

        // Calculate solid segments around doors and floor-level openings
        const segments = this.getMoldingSegments(actualLength, heightOffset, moldingHeight, wallEntity || moldData.wall);

        const group = new THREE.Group();
        const zOffset = (wallThickness / 2) * (moldData.side === 'right' ? -1 : 1);
        const rotY = (moldData.side === 'right') ? Math.PI / 2 : -Math.PI / 2;

        let finalMat = this.getMaterial(moldData.material);

        // Sharp geometric profiles MUST use flatShading for crisp edges
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

        for (const seg of segments) {
            const segLen = seg.end - seg.start;
            if (segLen < 0.5) continue;

            const extrudeSteps = Math.max(1, Math.floor(segLen / 10));
            const segGeo = new THREE.ExtrudeGeometry(finalShape, { 
                depth: segLen, 
                bevelEnabled: false, 
                curveSegments: 12, 
                steps: extrudeSteps 
            });

            // Correct UVs across continuous wall length
            const posAttr = segGeo.attributes.position;
            const uvs = new Float32Array(posAttr.count * 2);
            for (let i = 0; i < posAttr.count; i++) {
                uvs[i*2] = (posAttr.getZ(i) + seg.start) / 100;
                uvs[i*2+1] = posAttr.getY(i) / 100;
            }
            segGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

            // Mutate base geometry so it is in Wall Local Space (required for shearGeo)
            segGeo.rotateY(rotY);
            if (moldData.side === 'right') {
                segGeo.translate(seg.start, heightOffset, zOffset);
            } else {
                segGeo.translate(seg.end, heightOffset, zOffset);
            }

            if (isGroove || depth < 0) {
                segGeo.translate(0, 0, moldData.side === 'right' ? depth : -depth);
            }

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
    }
}

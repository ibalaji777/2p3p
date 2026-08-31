import * as THREE from 'three';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';

/**
 * RoofSculpture3DBuilder
 * 
 * Precision 3D parametric builder for Sims 4-style architectural roof sculptures:
 * 1. Wrought Iron Ridge Cresting (Victorian lace ironwork, gothic spikes, modern metal cap strips)
 * 2. Apex Finials & Weather Vanes (Victorian iron spires, copper turret spires, globe orbs, weather rooster vanes)
 * 3. Chimney Stacks (Traditional red brick, Tudor stone, modern metal flue pipes, double brick stacks)
 * 
 * Adheres strictly to the 3-Layer CAD/BIM Component, Highlight & Material Pipeline standard.
 */
export class RoofSculpture3DBuilder {
    constructor(ctx) {
        this.ctx = ctx;
    }

    /**
     * Helper to resolve materials cleanly with unified fallback
     */
    getMaterial(matKey, fallbackColor = 0x24272c, roughness = 0.4, metalness = 0.8) {
        if (this.ctx?.helpers?.getDynamicMaterial) {
            const mat = this.ctx.helpers.getDynamicMaterial(matKey, 'metal') || this.ctx.helpers.getDynamicMaterial(matKey, 'wall');
            if (mat) return mat;
        }

        // Standard procedural material fallbacks
        const colorMap = {
            'metal_dark_steel': 0x18181b,
            'metal_wrought_iron': 0x1c1917,
            'metal_bronze': 0x452a19,
            'copper': 0xb45309,
            'copper_patina': 0x2dd4bf,
            'galvanized_steel': 0x94a3b8,
            'white_paint': 0xf8fafc,
            'antique_gold': 0xd97706,
            'red_brick': 0x991b1b,
            'white_brick': 0xe2e8f0,
            'rough_stone': 0x64748b,
            'dark_slate': 0x334155,
            'terracotta_clay': 0xc2410c,
            'limestone': 0xe2e8f0
        };

        const resolvedColor = colorMap[matKey] || fallbackColor;
        const isMetallic = (matKey && (matKey.includes('metal') || matKey.includes('copper') || matKey.includes('steel') || matKey.includes('gold') || matKey.includes('iron')));

        return new THREE.MeshStandardMaterial({
            color: resolvedColor,
            roughness: isMetallic ? roughness : 0.75,
            metalness: isMetallic ? metalness : 0.1,
            side: THREE.DoubleSide
        });
    }

    // =========================================================================
    // 1. WROUGHT IRON RIDGE CRESTING (Along roof ridge line)
    // =========================================================================

    /**
     * Builds a continuous or segmented ridge cresting strip along a ridge line
     * @param {Object} item - Cresting config object
     * @param {number} ridgeLength - Length of the ridge line in cm
     * @param {Object} roof - Parent roof entity
     * @returns {THREE.Group} Cresting 3D group centered at X=0, Y=0 (Y=0 is top surface of ridge)
     */
    buildRidgeCresting(item, ridgeLength = 300, roof = null) {
        const group = new THREE.Group();
        group.name = `cresting_${item.id || 'ridge'}`;
        group.userData = { isRoofSculpture: true, isRoofAddon: true, sculptureType: 'cresting', addonType: 'cresting', entity: item, parentRoof: roof, sculptureData: item };

        const type = item.type || 'ridge_cresting_victorian_lace';
        const height = Number(item.height) || (type === 'ridge_cresting_metal_cap' ? 8 : 18);
        const matKey = item.material || (type === 'ridge_cresting_metal_cap' ? 'galvanized_steel' : 'metal_wrought_iron');
        const mainMat = this.getMaterial(matKey, 0x18181b, 0.4, 0.85);

        const len = (item.length && item.length !== 'auto') ? Number(item.length) : ridgeLength;
        const halfLen = len / 2;

        if (type === 'ridge_cresting_metal_cap') {
            // Modern Standing Seam Metal Ridge Cap (Inverted V / Trapeze Cap with standing seam spine)
            const capGroup = new THREE.Group();

            // 1. Inverted V metal cap strip
            const capWidth = 14;
            const capHeight = height;
            const capShape = new THREE.Shape();
            capShape.moveTo(-capWidth / 2, 0);
            capShape.lineTo(-capWidth / 2 + 1, -2);
            capShape.lineTo(0, capHeight);
            capShape.lineTo(capWidth / 2 - 1, -2);
            capShape.lineTo(capWidth / 2, 0);
            capShape.lineTo(1, capHeight - 1);
            capShape.lineTo(-1, capHeight - 1);
            capShape.closePath();

            const extrudeSettings = { depth: len, bevelEnabled: false };
            const capGeo = new THREE.ExtrudeGeometry(capShape, extrudeSettings);
            capGeo.center();
            // Orient along Z
            const capMesh = new THREE.Mesh(capGeo, mainMat);
            capMesh.position.set(0, capHeight / 2, 0);
            capMesh.castShadow = true;
            capMesh.receiveShadow = true;
            capMesh.userData = { isRoofSculpture: true, entity: roof, materialSlot: 'sculpture', componentType: 'roof_cresting' };
            capGroup.add(capMesh);

            // 2. Standing seam central ridge fin
            const finGeo = new THREE.BoxGeometry(0.8, 4, len);
            const finMesh = new THREE.Mesh(finGeo, mainMat);
            finMesh.position.set(0, capHeight + 2, 0);
            finMesh.castShadow = true;
            capGroup.add(finMesh);

            // 3. Repeating seam clips every 60 cm
            const numClips = Math.max(2, Math.floor(len / 60) + 1);
            const clipGeo = new THREE.BoxGeometry(3, 5, 2.5);
            for (let i = 0; i < numClips; i++) {
                const zPos = -halfLen + (i / (numClips - 1)) * len;
                const clipMesh = new THREE.Mesh(clipGeo, mainMat);
                clipMesh.position.set(0, capHeight + 1.5, zPos);
                capGroup.add(clipMesh);
            }

            group.add(capGroup);
        } else if (type === 'ridge_cresting_gothic_spikes') {
            // Gothic Spikes Wrought Iron Cresting
            const crestGroup = new THREE.Group();

            // 1. Bottom mounting angle rails (running full length along ridge)
            const railGeo = new THREE.BoxGeometry(3.0, 2.0, len);
            const bottomRail = new THREE.Mesh(railGeo, mainMat);
            bottomRail.position.set(0, 1.0, 0);
            bottomRail.castShadow = true;
            crestGroup.add(bottomRail);

            // 2. Mid horizontal reinforcing runner
            const midRailGeo = new THREE.BoxGeometry(1.6, 1.2, len);
            const midRail = new THREE.Mesh(midRailGeo, mainMat);
            midRail.position.set(0, height * 0.45, 0);
            midRail.castShadow = true;
            crestGroup.add(midRail);

            // 3. Repeating Gothic Pickets with Spiked Spearheads
            const spacing = Number(item.spacing) || 16;
            const count = Math.max(3, Math.floor(len / spacing));
            const actualSpacing = len / count;

            const picketGeo = new THREE.CylinderGeometry(0.6, 0.6, height, 8);
            const spikeGeo = new THREE.ConeGeometry(1.8, height * 0.35, 4); // 4-sided gothic spear pyramid
            spikeGeo.rotateY(Math.PI / 4);

            const trefoilRingGeo = new THREE.TorusGeometry(2.2, 0.4, 6, 12);
            trefoilRingGeo.rotateY(Math.PI / 2);

            for (let i = 0; i <= count; i++) {
                const z = -halfLen + i * actualSpacing;
                const isMajor = (i % 2 === 0);
                const picketH = isMajor ? height : height * 0.8;

                // Vertical picket rod
                const picket = new THREE.Mesh(picketGeo, mainMat);
                picket.scale.set(1, picketH / height, 1);
                picket.position.set(0, picketH / 2, z);
                picket.castShadow = true;
                crestGroup.add(picket);

                // Spiked spearhead
                const spike = new THREE.Mesh(spikeGeo, mainMat);
                spike.scale.set(isMajor ? 1.0 : 0.75, isMajor ? 1.0 : 0.75, isMajor ? 1.0 : 0.75);
                spike.position.set(0, picketH + (height * 0.35) / 2, z);
                spike.castShadow = true;
                crestGroup.add(spike);

                // Gothic trefoil / circle accent on major pickets
                if (isMajor && height >= 14) {
                    const ring = new THREE.Mesh(trefoilRingGeo, mainMat);
                    ring.position.set(0, height * 0.65, z);
                    crestGroup.add(ring);
                }
            }

            // 4. Sturdy End Finial Posts
            const endPostGeo = new THREE.BoxGeometry(3.5, height + 8, 3.5);
            const endSphereGeo = new THREE.SphereGeometry(3.0, 12, 12);

            [-halfLen, halfLen].forEach(z => {
                const post = new THREE.Mesh(endPostGeo, mainMat);
                post.position.set(0, (height + 8) / 2, z);
                post.castShadow = true;
                crestGroup.add(post);

                const ball = new THREE.Mesh(endSphereGeo, mainMat);
                ball.position.set(0, height + 8 + 2.5, z);
                ball.castShadow = true;
                crestGroup.add(ball);
            });

            group.add(crestGroup);
        } else {
            // Victorian Lace Wrought Iron Cresting (Default - ornate scrolls, arches, fleur-de-lis)
            const laceGroup = new THREE.Group();

            // 1. Bottom structural mounting channel
            const baseRailGeo = new THREE.BoxGeometry(3.2, 2.2, len);
            const baseRail = new THREE.Mesh(baseRailGeo, mainMat);
            baseRail.position.set(0, 1.1, 0);
            baseRail.castShadow = true;
            laceGroup.add(baseRail);

            // 2. Top connecting horizontal bead rail
            const topRailGeo = new THREE.BoxGeometry(1.8, 1.2, len);
            const topRail = new THREE.Mesh(topRailGeo, mainMat);
            topRail.position.set(0, height * 0.68, 0);
            topRail.castShadow = true;
            laceGroup.add(topRail);

            // 3. Repeating Victorian Lace Scrollwork Panels & Fleur-de-lis
            const moduleWidth = Number(item.spacing) || 22;
            const numModules = Math.max(2, Math.floor(len / moduleWidth));
            const step = len / numModules;

            // Geometry shapes for scrollwork
            const archTorusGeo = new THREE.TorusGeometry(moduleWidth / 3.8, 0.45, 6, 16, Math.PI);
            archTorusGeo.rotateY(Math.PI / 2);
            archTorusGeo.rotateZ(Math.PI);

            const fleurConeGeo = new THREE.ConeGeometry(1.6, height * 0.32, 6);
            const fleurPetalGeo = new THREE.SphereGeometry(1.2, 8, 8);
            fleurPetalGeo.scale(0.5, 1.5, 0.5);

            for (let i = 0; i < numModules; i++) {
                const zCenter = -halfLen + (i + 0.5) * step;

                // Open filigree arch
                const arch = new THREE.Mesh(archTorusGeo, mainMat);
                arch.position.set(0, height * 0.42, zCenter);
                laceGroup.add(arch);

                // Central vertical lace upright
                const uprightGeo = new THREE.CylinderGeometry(0.5, 0.5, height, 8);
                const upright = new THREE.Mesh(uprightGeo, mainMat);
                upright.position.set(0, height / 2, zCenter);
                upright.castShadow = true;
                laceGroup.add(upright);

                // Fleur-de-lis peak ornament atop the top rail
                const fleurCenter = new THREE.Mesh(fleurConeGeo, mainMat);
                fleurCenter.position.set(0, height + (height * 0.32) / 2, zCenter);
                fleurCenter.castShadow = true;
                laceGroup.add(fleurCenter);

                // Left & Right scrolled petals for fleur-de-lis
                const petalL = new THREE.Mesh(fleurPetalGeo, mainMat);
                petalL.position.set(0, height + 2.0, zCenter - 2.0);
                petalL.rotation.x = -Math.PI / 6;
                laceGroup.add(petalL);

                const petalR = new THREE.Mesh(fleurPetalGeo, mainMat);
                petalR.position.set(0, height + 2.0, zCenter + 2.0);
                petalR.rotation.x = Math.PI / 6;
                laceGroup.add(petalR);

                // Decorative sphere nodule
                const noduleGeo = new THREE.SphereGeometry(0.9, 8, 8);
                const nodule = new THREE.Mesh(noduleGeo, mainMat);
                nodule.position.set(0, height * 0.68, zCenter);
                laceGroup.add(nodule);
            }

            // 4. Ornate Victorian End Terminal Spires
            [-halfLen, halfLen].forEach(z => {
                const endColGeo = new THREE.CylinderGeometry(1.6, 1.8, height + 6, 8);
                const endCol = new THREE.Mesh(endColGeo, mainMat);
                endCol.position.set(0, (height + 6) / 2, z);
                endCol.castShadow = true;
                laceGroup.add(endCol);

                const ballGeo = new THREE.SphereGeometry(2.6, 12, 12);
                const ball = new THREE.Mesh(ballGeo, mainMat);
                ball.position.set(0, height + 7, z);
                ball.castShadow = true;
                laceGroup.add(ball);

                const needleGeo = new THREE.ConeGeometry(1.2, 8, 8);
                const needle = new THREE.Mesh(needleGeo, mainMat);
                needle.position.set(0, height + 12, z);
                needle.castShadow = true;
                laceGroup.add(needle);
            });

            group.add(laceGroup);
        }

        // Register with CAD/BIM ComponentRegistry
        group.traverse(child => {
            if (child.isMesh) {
                child.userData = {
                    isRoofSculpture: true,
                    isRoofAddon: true,
                    addonType: 'cresting',
                    entity: item,
                    parentRoof: roof,
                    materialSlot: 'sculpture',
                    componentType: 'roof_cresting',
                    sculptureId: item.id
                };
                if (roof) ComponentRegistry.registerMesh(roof, 'sculpture', child);
            }
        });

        return group;
    }

    // =========================================================================
    // 2. APEX FINIALS & WEATHER VANES (At apex points and turret peaks)
    // =========================================================================

    /**
     * Builds a decorative apex finial or weather vane
     * @param {Object} item - Finial configuration object
     * @param {Object} roof - Parent roof entity
     * @returns {THREE.Group} Finial 3D group
     */
    buildApexFinial(item, roof = null) {
        const group = new THREE.Group();
        group.name = `finial_${item.id || 'apex'}`;
        group.userData = { isRoofSculpture: true, isRoofAddon: true, sculptureType: 'finial', addonType: 'finial', entity: item, parentRoof: roof, sculptureData: item };

        const type = item.type || 'finial_victorian_spire';
        const height = Number(item.height) || 45;
        const scale = Number(item.scale) || 1.0;
        const matKey = item.material || (type === 'finial_copper_spire' ? 'copper' : (type === 'finial_globe_orb' ? 'limestone' : 'metal_wrought_iron'));
        const mainMat = this.getMaterial(matKey, 0x18181b, 0.35, 0.85);

        if (type === 'finial_weather_rooster') {
            // Weather Rooster Vane (Compass N/S/E/W cross + Rotating Rooster Silhouette & Arrow)
            const vaneGroup = new THREE.Group();

            // 1. Base roof mounting collar / sleeve
            const baseGeo = new THREE.CylinderGeometry(2.4, 3.8, 6, 12);
            const baseMesh = new THREE.Mesh(baseGeo, mainMat);
            baseMesh.position.y = 3;
            baseMesh.castShadow = true;
            vaneGroup.add(baseMesh);

            // 2. Central vertical steel spindle rod
            const rodGeo = new THREE.CylinderGeometry(0.7, 0.7, height, 10);
            const rodMesh = new THREE.Mesh(rodGeo, mainMat);
            rodMesh.position.y = height / 2;
            rodMesh.castShadow = true;
            vaneGroup.add(rodMesh);

            // 3. Lower & upper decorative spheres
            const sphereGeo = new THREE.SphereGeometry(2.8, 14, 14);
            const lowerSphere = new THREE.Mesh(sphereGeo, mainMat);
            lowerSphere.position.y = height * 0.35;
            vaneGroup.add(lowerSphere);

            const upperSphereGeo = new THREE.SphereGeometry(2.0, 12, 12);
            const upperSphere = new THREE.Mesh(upperSphereGeo, mainMat);
            upperSphere.position.y = height * 0.65;
            vaneGroup.add(upperSphere);

            // 4. Directional Compass Cross Arms (N, S, E, W)
            const armLen = 22;
            const armGeo = new THREE.CylinderGeometry(0.4, 0.4, armLen, 8);
            armGeo.rotateZ(Math.PI / 2);

            const armNS = new THREE.Mesh(armGeo, mainMat);
            armNS.position.y = height * 0.48;
            vaneGroup.add(armNS);

            const armEW = new THREE.Mesh(armGeo.clone(), mainMat);
            armEW.rotation.y = Math.PI / 2;
            armEW.position.y = height * 0.48;
            vaneGroup.add(armEW);

            // 5. Directional Letter Indicator Badges (N, S, E, W plates)
            const plateGeo = new THREE.BoxGeometry(3.5, 3.5, 0.6);
            [
                { x: armLen / 2, z: 0, rot: 0 },
                { x: -armLen / 2, z: 0, rot: 0 },
                { x: 0, z: armLen / 2, rot: Math.PI / 2 },
                { x: 0, z: -armLen / 2, rot: Math.PI / 2 }
            ].forEach(p => {
                const plate = new THREE.Mesh(plateGeo, mainMat);
                plate.position.set(p.x, height * 0.48, p.z);
                plate.rotation.y = p.rot;
                vaneGroup.add(plate);
            });

            // 6. Directional Arrow & Rooster Silhouette on top
            const roosterGroup = new THREE.Group();
            roosterGroup.position.y = height * 0.72;

            // Arrow shaft
            const arrowShaftGeo = new THREE.CylinderGeometry(0.5, 0.5, 30, 8);
            arrowShaftGeo.rotateZ(Math.PI / 2);
            const arrowShaft = new THREE.Mesh(arrowShaftGeo, mainMat);
            roosterGroup.add(arrowShaft);

            // Arrow head
            const arrowHeadGeo = new THREE.ConeGeometry(2.5, 6, 4);
            arrowHeadGeo.rotateZ(-Math.PI / 2);
            const arrowHead = new THREE.Mesh(arrowHeadGeo, mainMat);
            arrowHead.position.x = 15;
            roosterGroup.add(arrowHead);

            // Arrow fletching feathers
            const fletchShape = new THREE.Shape();
            fletchShape.moveTo(0, 0);
            fletchShape.lineTo(-6, 3);
            fletchShape.lineTo(-10, 3);
            fletchShape.lineTo(-7, 0);
            fletchShape.lineTo(-10, -3);
            fletchShape.lineTo(-6, -3);
            fletchShape.closePath();
            const fletchGeo = new THREE.ExtrudeGeometry(fletchShape, { depth: 0.6, bevelEnabled: false });
            fletchGeo.center();
            const fletch = new THREE.Mesh(fletchGeo, mainMat);
            fletch.position.x = -13;
            roosterGroup.add(fletch);

            // Rooster Silhouette cutout shape
            const roosterShape = new THREE.Shape();
            roosterShape.moveTo(-3, 0);
            // Tail feathers
            roosterShape.bezierCurveTo(-9, 4, -10, 14, -4, 16);
            roosterShape.bezierCurveTo(-5, 12, -2, 10, 0, 9);
            // Back to neck & head
            roosterShape.lineTo(2, 12);
            roosterShape.lineTo(3, 15);
            // Comb
            roosterShape.lineTo(4, 17);
            roosterShape.lineTo(5, 15);
            roosterShape.lineTo(6, 17);
            roosterShape.lineTo(7, 14);
            // Beak
            roosterShape.lineTo(9, 13);
            roosterShape.lineTo(7, 11);
            // Wattle & chest
            roosterShape.lineTo(6, 9);
            roosterShape.bezierCurveTo(7, 6, 6, 2, 2, 0);
            // Legs & perch
            roosterShape.lineTo(0, 0);
            roosterShape.closePath();

            const roosterGeo = new THREE.ExtrudeGeometry(roosterShape, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2 });
            roosterGeo.center();
            const rooster = new THREE.Mesh(roosterGeo, mainMat);
            rooster.position.set(0, 8, 0);
            rooster.castShadow = true;
            roosterGroup.add(rooster);

            // Apply custom rotation or default pointing
            roosterGroup.rotation.y = ((item.rotation || 35) * Math.PI) / 180;
            vaneGroup.add(roosterGroup);

            group.add(vaneGroup);
        } else if (type === 'finial_copper_spire') {
            // Classical Flared Copper Spire / Turret Spire
            const spireGroup = new THREE.Group();

            // 1. Octagonal / circular pedestal base
            const baseGeo = new THREE.CylinderGeometry(3.6, 5.0, 7, 12);
            const baseMesh = new THREE.Mesh(baseGeo, mainMat);
            baseMesh.position.y = 3.5;
            spireGroup.add(baseMesh);

            // 2. Copper lower globe
            const lowerGlobeGeo = new THREE.SphereGeometry(4.2, 16, 16);
            lowerGlobeGeo.scale(1, 0.85, 1);
            const lowerGlobe = new THREE.Mesh(lowerGlobeGeo, mainMat);
            lowerGlobe.position.y = 10;
            lowerGlobe.castShadow = true;
            spireGroup.add(lowerGlobe);

            // 3. Middle collar ring
            const collarGeo = new THREE.TorusGeometry(3.0, 0.6, 8, 20);
            collarGeo.rotateX(Math.PI / 2);
            const collar = new THREE.Mesh(collarGeo, mainMat);
            collar.position.y = 14;
            spireGroup.add(collar);

            // 4. Middle slender sphere
            const midSphereGeo = new THREE.SphereGeometry(2.4, 14, 14);
            const midSphere = new THREE.Mesh(midSphereGeo, mainMat);
            midSphere.position.y = 18;
            spireGroup.add(midSphere);

            // 5. Tall flared needle spire
            const spireH = height - 20;
            const needleGeo = new THREE.ConeGeometry(2.2, spireH, 12);
            const needle = new THREE.Mesh(needleGeo, mainMat);
            needle.position.y = 20 + spireH / 2;
            needle.castShadow = true;
            spireGroup.add(needle);

            // 6. Pinnacle needle tip
            const tipGeo = new THREE.CylinderGeometry(0.3, 0.3, 6, 8);
            const tip = new THREE.Mesh(tipGeo, mainMat);
            tip.position.y = 20 + spireH + 3;
            spireGroup.add(tip);

            group.add(spireGroup);
        } else if (type === 'finial_globe_orb') {
            // Classical Stone / Metal Globe Orb Finial
            const orbGroup = new THREE.Group();

            // 1. Stepped square plinth base
            const plinthGeo = new THREE.BoxGeometry(8, 3, 8);
            const plinth = new THREE.Mesh(plinthGeo, mainMat);
            plinth.position.y = 1.5;
            orbGroup.add(plinth);

            // 2. Round molded pedestal
            const pedGeo = new THREE.CylinderGeometry(3.5, 4.2, 5, 16);
            const ped = new THREE.Mesh(pedGeo, mainMat);
            ped.position.y = 5.5;
            orbGroup.add(ped);

            // 3. Scalloped waist collar
            const waistGeo = new THREE.CylinderGeometry(2.4, 3.2, 3, 16);
            const waist = new THREE.Mesh(waistGeo, mainMat);
            waist.position.y = 9.5;
            orbGroup.add(waist);

            // 4. Main Ornamental Sphere / Orb
            const orbRadius = height * 0.32;
            const orbGeo = new THREE.SphereGeometry(orbRadius, 20, 20);
            const orbMesh = new THREE.Mesh(orbGeo, mainMat);
            orbMesh.position.y = 12 + orbRadius;
            orbMesh.castShadow = true;
            orbGroup.add(orbMesh);

            // 5. Crown acorn / finial pin on top
            const crownGeo = new THREE.ConeGeometry(1.4, 4, 8);
            const crown = new THREE.Mesh(crownGeo, mainMat);
            crown.position.y = 12 + 2 * orbRadius + 2;
            orbGroup.add(crown);

            group.add(orbGroup);
        } else {
            // Victorian Iron Spire (Default - ornate multi-tiered turned spire)
            const victorianGroup = new THREE.Group();

            // 1. Flanged mounting base
            const bGeo = new THREE.CylinderGeometry(2.2, 4.0, 5, 12);
            const bMesh = new THREE.Mesh(bGeo, mainMat);
            bMesh.position.y = 2.5;
            victorianGroup.add(bMesh);

            // 2. Tier 1 Sphere
            const s1Geo = new THREE.SphereGeometry(3.2, 14, 14);
            const s1 = new THREE.Mesh(s1Geo, mainMat);
            s1.position.y = 7.5;
            victorianGroup.add(s1);

            // 3. Fluted stem
            const stemGeo = new THREE.CylinderGeometry(1.2, 1.6, 8, 10);
            const stem = new THREE.Mesh(stemGeo, mainMat);
            stem.position.y = 14;
            victorianGroup.add(stem);

            // 4. Tier 2 Sphere
            const s2Geo = new THREE.SphereGeometry(2.2, 12, 12);
            const s2 = new THREE.Mesh(s2Geo, mainMat);
            s2.position.y = 19;
            victorianGroup.add(s2);

            // 5. Tapering conical spire
            const coneH = height - 21;
            const coneGeo = new THREE.ConeGeometry(1.6, coneH, 10);
            const cone = new THREE.Mesh(coneGeo, mainMat);
            cone.position.y = 20 + coneH / 2;
            cone.castShadow = true;
            victorianGroup.add(cone);

            // 6. Needle tip
            const tipGeo = new THREE.CylinderGeometry(0.3, 0.4, 5, 8);
            const tip = new THREE.Mesh(tipGeo, mainMat);
            tip.position.y = 20 + coneH + 2.5;
            victorianGroup.add(tip);

            group.add(victorianGroup);
        }

        group.scale.set(scale, scale, scale);

        // Register with CAD/BIM ComponentRegistry
        group.traverse(child => {
            if (child.isMesh) {
                child.userData = {
                    isRoofSculpture: true,
                    isRoofAddon: true,
                    addonType: 'finial',
                    entity: item,
                    parentRoof: roof,
                    materialSlot: 'sculpture',
                    componentType: 'roof_finial',
                    sculptureId: item.id
                };
                if (roof) ComponentRegistry.registerMesh(roof, 'sculpture', child);
            }
        });

        return group;
    }

    // =========================================================================
    // 3. CHIMNEY STACKS (Snaps directly onto roof slopes)
    // =========================================================================

    /**
     * Builds an architectural chimney stack with slope pitch compensation
     * @param {Object} item - Chimney config object
     * @param {Object} roof - Parent roof entity
     * @returns {THREE.Group} Chimney 3D group centered at X=0, Z=0
     */
    buildChimneyStack(item, roof = null) {
        const group = new THREE.Group();
        group.name = `chimney_${item.id || 'stack'}`;
        group.userData = { isRoofSculpture: true, isRoofAddon: true, sculptureType: 'chimney', addonType: 'chimney', entity: item, parentRoof: roof, sculptureData: item };

        const type = item.type || 'chimney_brick_traditional';
        const width = Number(item.width) || (type === 'chimney_double_brick' ? 70 : (type === 'chimney_metal_flue' ? 24 : 45));
        const depth = Number(item.depth) || (type === 'chimney_double_brick' ? 45 : (type === 'chimney_metal_flue' ? 24 : 45));
        const height = Number(item.height) || (type === 'chimney_metal_flue' ? 110 : 90);

        const matKey = item.material || (type === 'chimney_metal_flue' ? 'metal_dark_steel' : (type === 'chimney_stone_tudor' ? 'rough_stone' : 'red_brick'));
        const bodyMat = this.getMaterial(matKey, 0x991b1b, 0.8, 0.1);
        const stoneMat = this.getMaterial(item.capMaterial || 'limestone', 0xe2e8f0, 0.7, 0.05);
        const potMat = this.getMaterial(item.potMaterial || 'terracotta_clay', 0xc2410c, 0.6, 0.1);
        const darkMetalMat = this.getMaterial('metal_dark_steel', 0x18181b, 0.35, 0.8);

        if (type === 'chimney_metal_flue') {
            // Modern Metal Stove Flue Pipe (Stainless Steel / Matte Black with flashing cone, storm collar, rain cap)
            const flueGroup = new THREE.Group();
            const radius = width / 2;

            // 1. Slope roof flashing skirt / collar cone
            const flashGeo = new THREE.ConeGeometry(radius * 2.2, 12, 16, 1, true);
            const flashMesh = new THREE.Mesh(flashGeo, darkMetalMat);
            flashMesh.position.y = 4;
            flueGroup.add(flashMesh);

            // 2. Storm collar bead ring
            const collarGeo = new THREE.TorusGeometry(radius * 1.25, 1.0, 8, 16);
            collarGeo.rotateX(Math.PI / 2);
            const collarMesh = new THREE.Mesh(collarGeo, darkMetalMat);
            collarMesh.position.y = 12;
            flueGroup.add(collarMesh);

            // 3. Main cylindrical insulated flue pipe (extending into roof for clean intersection)
            const pipeGeo = new THREE.CylinderGeometry(radius, radius, height + 20, 16);
            const pipeMesh = new THREE.Mesh(pipeGeo, bodyMat);
            pipeMesh.position.y = (height - 20) / 2;
            pipeMesh.castShadow = true;
            flueGroup.add(pipeMesh);

            // 4. Upper pipe segment joint ring
            const jointGeo = new THREE.TorusGeometry(radius * 1.08, 0.6, 8, 16);
            jointGeo.rotateX(Math.PI / 2);
            const jointMesh = new THREE.Mesh(jointGeo, darkMetalMat);
            jointMesh.position.y = height * 0.7;
            flueGroup.add(jointMesh);

            // 5. Spark arrestor / screen mesh band
            const screenGeo = new THREE.CylinderGeometry(radius * 1.15, radius * 1.15, 8, 16, 1, true);
            const screenMesh = new THREE.Mesh(screenGeo, darkMetalMat);
            screenMesh.position.y = height - 6;
            flueGroup.add(screenMesh);

            // 6. Conical Rain Cap (Spark arrestor top hood)
            const capGeo = new THREE.ConeGeometry(radius * 1.6, 10, 16);
            const capMesh = new THREE.Mesh(capGeo, darkMetalMat);
            capMesh.position.y = height + 4;
            capMesh.castShadow = true;
            flueGroup.add(capMesh);

            group.add(flueGroup);
        } else if (type === 'chimney_stone_tudor') {
            // Tudor / Gothic Stone Chimney Stack with octagonal stone flues
            const stoneGroup = new THREE.Group();

            // 1. Main stone masonry stack (extends downward by 30cm to penetrate roof pitch cleanly)
            const stackGeo = new THREE.BoxGeometry(width, height + 30, depth);
            const stackMesh = new THREE.Mesh(stackGeo, bodyMat);
            stackMesh.position.y = (height - 30) / 2;
            stackMesh.castShadow = true;
            stackMesh.receiveShadow = true;
            stoneGroup.add(stackMesh);

            // 2. Corbelled stone crown cornice
            const crownGeo = new THREE.BoxGeometry(width + 8, 6, depth + 8);
            const crownMesh = new THREE.Mesh(crownGeo, stoneMat);
            crownMesh.position.y = height - 3;
            crownMesh.castShadow = true;
            stoneGroup.add(crownMesh);

            // 3. Molded stone drip cap
            const dripGeo = new THREE.BoxGeometry(width + 12, 3, depth + 12);
            const dripMesh = new THREE.Mesh(dripGeo, stoneMat);
            dripMesh.position.y = height + 1.5;
            dripMesh.castShadow = true;
            stoneGroup.add(dripMesh);

            // 4. Two octagonal stone chimney shafts / pots
            const potR = Math.min(width, depth) * 0.22;
            const potH = 22;
            const octPotGeo = new THREE.CylinderGeometry(potR, potR * 1.15, potH, 8);
            const octCapGeo = new THREE.CylinderGeometry(potR * 1.3, potR, 4, 8);
            const potHoleMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
            const holeGeo = new THREE.CylinderGeometry(potR * 0.65, potR * 0.65, 2, 8);

            [-width * 0.22, width * 0.22].forEach(xOffset => {
                const pot = new THREE.Mesh(octPotGeo, stoneMat);
                pot.position.set(xOffset, height + 3 + potH / 2, 0);
                pot.castShadow = true;
                stoneGroup.add(pot);

                const potCap = new THREE.Mesh(octCapGeo, stoneMat);
                potCap.position.set(xOffset, height + 3 + potH + 2, 0);
                potCap.castShadow = true;
                stoneGroup.add(potCap);

                const hole = new THREE.Mesh(holeGeo, potHoleMat);
                hole.position.set(xOffset, height + 3 + potH + 4.1, 0);
                stoneGroup.add(hole);
            });

            group.add(stoneGroup);
        } else if (type === 'chimney_double_brick') {
            // Wide Double Flue Classical Brick Chimney
            const doubleGroup = new THREE.Group();

            // 1. Brick main shaft (with 30cm downward slope extension)
            const stackGeo = new THREE.BoxGeometry(width, height + 30, depth);
            const stackMesh = new THREE.Mesh(stackGeo, bodyMat);
            stackMesh.position.y = (height - 30) / 2;
            stackMesh.castShadow = true;
            stackMesh.receiveShadow = true;
            doubleGroup.add(stackMesh);

            // 2. Middle horizontal limestone decorative banding
            const bandGeo = new THREE.BoxGeometry(width + 3, 4, depth + 3);
            const bandMesh = new THREE.Mesh(bandGeo, stoneMat);
            bandMesh.position.y = height * 0.55;
            doubleGroup.add(bandMesh);

            // 3. Classical limestone crown coping
            const crownGeo = new THREE.BoxGeometry(width + 8, 5, depth + 8);
            const crownMesh = new THREE.Mesh(crownGeo, stoneMat);
            crownMesh.position.y = height - 2.5;
            crownMesh.castShadow = true;
            doubleGroup.add(crownMesh);

            // 4. Stepped upper drip stone
            const dripGeo = new THREE.BoxGeometry(width + 12, 3, depth + 12);
            const dripMesh = new THREE.Mesh(dripGeo, stoneMat);
            dripMesh.position.y = height + 1.5;
            dripMesh.castShadow = true;
            doubleGroup.add(dripMesh);

            // 5. Dual classical terracotta flue pots with rolled lips
            const potR = depth * 0.28;
            const potH = 20;
            const potGeo = new THREE.CylinderGeometry(potR * 0.9, potR, potH, 14);
            const lipGeo = new THREE.TorusGeometry(potR * 0.95, 1.2, 8, 16);
            lipGeo.rotateX(Math.PI / 2);
            const holeMat = new THREE.MeshBasicMaterial({ color: 0x080808 });
            const holeGeo = new THREE.CylinderGeometry(potR * 0.7, potR * 0.7, 2, 12);

            [-width * 0.24, width * 0.24].forEach(xOffset => {
                const pot = new THREE.Mesh(potGeo, potMat);
                pot.position.set(xOffset, height + 3 + potH / 2, 0);
                pot.castShadow = true;
                doubleGroup.add(pot);

                const lip = new THREE.Mesh(lipGeo, potMat);
                lip.position.set(xOffset, height + 3 + potH, 0);
                doubleGroup.add(lip);

                const hole = new THREE.Mesh(holeGeo, holeMat);
                hole.position.set(xOffset, height + 3 + potH + 0.5, 0);
                doubleGroup.add(hole);
            });

            group.add(doubleGroup);
        } else {
            // Traditional Red Brick Chimney Stack (Default)
            const brickGroup = new THREE.Group();

            // 1. Brick shaft with 35cm penetration extension for slope pitching
            const stackGeo = new THREE.BoxGeometry(width, height + 35, depth);
            const stackMesh = new THREE.Mesh(stackGeo, bodyMat);
            stackMesh.position.y = (height - 35) / 2;
            stackMesh.castShadow = true;
            stackMesh.receiveShadow = true;
            brickGroup.add(stackMesh);

            // 2. Corbelled limestone coping cap
            const copingGeo = new THREE.BoxGeometry(width + 6, 4, depth + 6);
            const copingMesh = new THREE.Mesh(copingGeo, stoneMat);
            copingMesh.position.y = height - 2;
            copingMesh.castShadow = true;
            brickGroup.add(copingMesh);

            // 3. Beveled rain drip cap slab
            const dripGeo = new THREE.BoxGeometry(width + 10, 3, depth + 10);
            const dripMesh = new THREE.Mesh(dripGeo, stoneMat);
            dripMesh.position.y = height + 1.5;
            dripMesh.castShadow = true;
            brickGroup.add(dripMesh);

            // 4. Cylindrical Terracotta Clay Flue Pots with smoke voids
            const potR = Math.min(width, depth) * 0.24;
            const potH = 18;
            const potGeo = new THREE.CylinderGeometry(potR * 0.9, potR, potH, 16);
            const lipGeo = new THREE.TorusGeometry(potR * 0.92, 1.0, 8, 16);
            lipGeo.rotateX(Math.PI / 2);
            const holeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
            const holeGeo = new THREE.CylinderGeometry(potR * 0.68, potR * 0.68, 2, 12);

            const isSquare = Math.abs(width - depth) < 5;
            const offsets = isSquare ? [{ x: 0, z: 0 }] : [{ x: -width * 0.22, z: 0 }, { x: width * 0.22, z: 0 }];

            offsets.forEach(p => {
                const pot = new THREE.Mesh(potGeo, potMat);
                pot.position.set(p.x, height + 3 + potH / 2, p.z);
                pot.castShadow = true;
                brickGroup.add(pot);

                const lip = new THREE.Mesh(lipGeo, potMat);
                lip.position.set(p.x, height + 3 + potH, p.z);
                brickGroup.add(lip);

                const hole = new THREE.Mesh(holeGeo, holeMat);
                hole.position.set(p.x, height + 3 + potH + 0.6, p.z);
                brickGroup.add(hole);
            });

            group.add(brickGroup);
        }

        // Apply custom rotation if specified
        if (item.rotation) {
            group.rotation.y = (item.rotation * Math.PI) / 180;
        }

        // Register with CAD/BIM ComponentRegistry
        group.traverse(child => {
            if (child.isMesh) {
                child.userData = {
                    isRoofSculpture: true,
                    isRoofAddon: true,
                    addonType: 'chimney',
                    entity: item,
                    parentRoof: roof,
                    materialSlot: 'sculpture',
                    componentType: 'roof_chimney',
                    sculptureId: item.id
                };
                if (roof) ComponentRegistry.registerMesh(roof, 'sculpture', child);
            }
        });

        return group;
    }
}

import * as THREE from 'three';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';
import { ROOF_DECOR_REGISTRY } from '../roof.registry.js';

/**
 * RoofDormer3DBuilder
 * 
 * Precision 3D parametric builder for Sims 4-style architectural roof dormers:
 * 1. Gable Dormer (Peaked A-frame roof, bargeboards, pediment, double-hung window)
 * 2. Shed Dormer (Flat/slanted roof, front fascia overhang, wide window)
 * 3. Eyebrow Dormer (Graceful curved wave arch roof, fanlight arched window)
 * 4. Hip Dormer (3-sided hipped mini roof, framed window)
 * 5. Barrel Vault Dormer (Semicircular arch roof, arched window)
 * 
 * Adheres strictly to the 3-Layer CAD/BIM Component, Highlight & Material Pipeline standard.
 */
export class RoofDormer3DBuilder {
    constructor(ctx) {
        this.ctx = ctx;
    }

    /**
     * Sets world-space UV coordinates (1 unit = 100cm) for BoxGeometry faces
     */
    applyPhysicalBoxUVs(geo, width, height, depth) {
        const uvs = [
            // +X: depth x height
            0, 0,  depth/100, 0,  0, height/100,  depth/100, height/100,
            // -X: depth x height
            0, 0,  depth/100, 0,  0, height/100,  depth/100, height/100,
            // +Y (Top Main Surface): width x depth
            0, 0,  width/100, 0,  0, depth/100,  width/100, depth/100,
            // -Y (Bottom): width x depth
            0, 0,  width/100, 0,  0, depth/100,  width/100, depth/100,
            // +Z (Front): width x height
            0, 0,  width/100, 0,  0, height/100,  width/100, height/100,
            // -Z (Back): width x height
            0, 0,  width/100, 0,  0, height/100,  width/100, height/100,
        ];
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    }

    /**
     * Helper to resolve materials cleanly with unified fallback
     */
    getMaterial(matKey, fallbackColor = 0xf8fafc, roughness = 0.5, metalness = 0.05, type = 'wall') {
        const colorMap = {
            'wood_siding': 0xf1f5f9,
            'white_paint': 0xf8fafc,
            'cream_siding': 0xfef08a,
            'dark_wood': 0x3e2723,
            'red_brick': 0x991b1b,
            'rough_stone': 0x64748b,
            'metal_dark_steel': 0x18181b,
            'metal_wrought_iron': 0x1c1917,
            'copper': 0xb45309,
            'dark_slate': 0x1e293b,
            'grey_slate_roof': 0x1e293b,
            'asphalt_shingles': 0x334155,
            'dark_asphalt_roof': 0x334155,
            'terracotta_tiles_roof': 0xc2410c,
            'terracotta_green_roof': 0x2e7d32,
            'terracotta_red_roof': 0xb71c1c,
            'blue_ceramic_tiles_roof': 0x1565c0,
            'terracotta_tiles': 0xc2410c,
            'terracotta_clay': 0xc2410c,
            'standing_seam_metal': 0x475569,
            'wood_shake': 0x78350f,
            'limestone': 0xe2e8f0
        };

        if (type === 'roof' && ROOF_DECOR_REGISTRY && ROOF_DECOR_REGISTRY[matKey]) {
            const decor = ROOF_DECOR_REGISTRY[matKey];
            const m = new THREE.MeshStandardMaterial({
                color: decor.color || 0xffffff,
                roughness: decor.roughness !== undefined ? decor.roughness : 0.65,
                metalness: decor.metalness !== undefined ? decor.metalness : 0.05,
                side: THREE.DoubleSide
            });
            if (this.ctx?.assets?.getTexture && (decor.texture || decor.dataUri)) {
                const texSrc = decor.dataUri || decor.texture;
                this.ctx.assets.getTexture(texSrc).then(tex => {
                    if (!tex) return;
                    const texClone = tex.clone();
                    texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                    const tSize = 100 * (decor.scaleRatio || 1);
                    texClone.repeat.set(100 / tSize, 100 / tSize);
                    m.map = texClone;
                    m.needsUpdate = true;
                });
            }
            return m;
        }

        if (this.ctx?.helpers?.getDynamicMaterial) {
            const mat = this.ctx.helpers.getDynamicMaterial(matKey, type);
            if (mat) return mat;
        }

        const resolvedColor = colorMap[matKey] || fallbackColor;
        const isMetallic = (matKey && (matKey.includes('metal') || matKey.includes('copper') || matKey.includes('steel') || matKey.includes('iron')));

        return new THREE.MeshStandardMaterial({
            color: resolvedColor,
            roughness: isMetallic ? roughness : 0.65,
            metalness: isMetallic ? metalness : 0.05,
            side: THREE.DoubleSide
        });
    }

    /**
     * Helper to get high-quality glass material
     */
    getGlassMaterial() {
        return new THREE.MeshPhysicalMaterial({
            color: 0x88ccff,
            transmission: 0.85,
            opacity: 0.4,
            transparent: true,
            roughness: 0.1,
            metalness: 0.1,
            ior: 1.5,
            side: THREE.DoubleSide
        });
    }

    /**
     * Builds a solid 3D Cheek Sidewall prism matching the main roof slope pitch.
     * Starts at Z=0 (front wall) and extends BACKWARDS into -Z, rising to meet the parent roof slope.
     */
    buildCheekWallGeometry(isLeft, width, height, cheekDepth, wallThick) {
        const geo = new THREE.BufferGeometry();
        const halfW = width / 2;
        const xOuter = isLeft ? -halfW : halfW;
        const xInner = isLeft ? -halfW + wallThick : halfW - wallThick;

        // Vertices for Outer Triangle (0, 1, 2) and Inner Triangle (3, 4, 5)
        // 0: Front-Bottom Outer, 1: Front-Top Outer, 2: Back-Apex Outer
        // 3: Front-Bottom Inner, 4: Front-Top Inner, 5: Back-Apex Inner
        const verts = [
            // Outer Face: 0, 1, 2
            xOuter, 0, 0,
            xOuter, height, 0,
            xOuter, height, -cheekDepth,

            // Inner Face: 3, 4, 5
            xInner, 0, 0,
            xInner, height, 0,
            xInner, height, -cheekDepth
        ];

        let indices = [];
        if (isLeft) {
            indices = [
                // Outer face (-X normal)
                0, 2, 1,
                // Inner face (+X normal)
                3, 4, 5,
                // Front edge (Z=0, +Z normal)
                0, 1, 4,  0, 4, 3,
                // Top edge (Y=height, +Y normal)
                1, 2, 5,  1, 5, 4,
                // Bottom slope (following main roof)
                0, 3, 5,  0, 5, 2
            ];
        } else {
            indices = [
                // Outer face (+X normal)
                0, 1, 2,
                // Inner face (-X normal)
                3, 5, 4,
                // Front edge (Z=0, +Z normal)
                0, 4, 1,  0, 3, 4,
                // Top edge (Y=height, +Y normal)
                1, 4, 5,  1, 5, 2,
                // Bottom slope
                0, 5, 3,  0, 2, 5
            ];
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const uvs = [];
        for (let i = 0; i < verts.length; i += 3) {
            const vy = verts[i + 1];
            const vz = verts[i + 2];
            uvs.push(-vz / 100, vy / 100);
        }
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

        return geo;
    }

    /**
     * Builds a solid 3D Cheek Sidewall prism specifically for SHED dormers.
     * The top edge slopes downward at angle -shedPitchRad, matching the slanted shed roof slab.
     */
    buildShedCheekWallGeometry(isLeft, width, height, shedDepth, tanShed, wallThick) {
        const geo = new THREE.BufferGeometry();
        const halfW = width / 2;
        const xOuter = isLeft ? -halfW : halfW;
        const xInner = isLeft ? -halfW + wallThick : halfW - wallThick;
        const backY = Math.max(0, height - shedDepth * tanShed);

        // Vertices for Outer Triangle (0, 1, 2) and Inner Triangle (3, 4, 5)
        // 0: Front-Bottom Outer (Z=0, Y=0)
        // 1: Front-Top Outer (Z=0, Y=height)
        // 2: Back-Apex Outer (Z=-shedDepth, Y=backY where shed slope meets parent roof slope)
        const verts = [
            // Outer Face: 0, 1, 2
            xOuter, 0, 0,
            xOuter, height, 0,
            xOuter, backY, -shedDepth,

            // Inner Face: 3, 4, 5
            xInner, 0, 0,
            xInner, height, 0,
            xInner, backY, -shedDepth
        ];

        let indices = [];
        if (isLeft) {
            indices = [
                0, 2, 1,
                3, 4, 5,
                0, 1, 4,  0, 4, 3,
                1, 2, 5,  1, 5, 4,
                0, 3, 5,  0, 5, 2
            ];
        } else {
            indices = [
                0, 1, 2,
                3, 5, 4,
                0, 4, 1,  0, 3, 4,
                1, 4, 5,  1, 5, 2,
                0, 5, 3,  0, 2, 5
            ];
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const uvs = [];
        for (let i = 0; i < verts.length; i += 3) {
            const vy = verts[i + 1];
            const vz = verts[i + 2];
            uvs.push(-vz / 100, vy / 100);
        }
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

        return geo;
    }

    /**
     * Builds a detailed architectural double-hung or casement window assembly.
     * Guaranteed transparent glass, hollow frame casing, protruding sill, and delicate muntins.
     */
    buildDoubleHungWindow(winW, winH, frameMat, glassMat, trimMat, numPanesX = 2) {
        const winGroup = new THREE.Group();
        const borderW = 3.2; // Casing trim width
        const casingThick = 2.4;
        const muntinThick = 1.2;

        // 1. Transparent Glazing Glass Pane
        const glassGeo = new THREE.PlaneGeometry(winW, winH);
        glassGeo.translate(0, winH / 2, 0);
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.userData.materialSlot = 'glass';
        winGroup.add(glassMesh);

        // 2. Outer Window Frame Casing (Hollow border perimeter: Left, Right, Top Header)
        const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(borderW, winH + borderW, casingThick), frameMat);
        leftJamb.userData.materialSlot = 'frame';
        leftJamb.position.set(-winW / 2 - borderW / 2 + 1, winH / 2, 0.4);
        winGroup.add(leftJamb);

        const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(borderW, winH + borderW, casingThick), frameMat);
        rightJamb.userData.materialSlot = 'frame';
        rightJamb.position.set(winW / 2 + borderW / 2 - 1, winH / 2, 0.4);
        winGroup.add(rightJamb);

        const topHeader = new THREE.Mesh(new THREE.BoxGeometry(winW + borderW * 2, borderW, casingThick + 0.6), frameMat);
        topHeader.userData.materialSlot = 'frame';
        topHeader.position.set(0, winH + borderW / 2, 0.7);
        winGroup.add(topHeader);

        // 3. Protruding Architectural Window Sill Ledge (Trim Material)
        const sillGeo = new THREE.BoxGeometry(winW + borderW * 2 + 6, 3.8, 6.5);
        const sillMesh = new THREE.Mesh(sillGeo, trimMat);
        sillMesh.userData.materialSlot = 'dormer_trim';
        sillMesh.position.set(0, -1.9, 2.2);
        winGroup.add(sillMesh);

        // 4. Double-Hung Meeting Rail (Horizontal sash divider in the middle)
        const meetingRail = new THREE.Mesh(new THREE.BoxGeometry(winW, 2.6, casingThick + 0.8), frameMat);
        meetingRail.userData.materialSlot = 'frame';
        meetingRail.position.set(0, winH * 0.52, 0.6);
        winGroup.add(meetingRail);

        // 5. Delicate Muntins / Glazing Grilles
        const numCols = Math.max(2, numPanesX || 2);
        for (let col = 1; col < numCols; col++) {
            const mx = -winW / 2 + (col / numCols) * winW;
            const vMuntin = new THREE.Mesh(new THREE.BoxGeometry(muntinThick, winH, muntinThick), frameMat);
            vMuntin.userData.materialSlot = 'frame';
            vMuntin.position.set(mx, winH / 2, 0.3);
            winGroup.add(vMuntin);
        }

        const upperH = new THREE.Mesh(new THREE.BoxGeometry(winW, muntinThick, muntinThick), frameMat);
        upperH.userData.materialSlot = 'frame';
        upperH.position.set(0, winH * 0.76, 0.3);
        winGroup.add(upperH);

        const lowerH = new THREE.Mesh(new THREE.BoxGeometry(winW, muntinThick, muntinThick), frameMat);
        lowerH.userData.materialSlot = 'frame';
        lowerH.position.set(0, winH * 0.26, 0.3);
        winGroup.add(lowerH);

        return winGroup;
    }

    /**
     * Builds a continuous 3D solid roof slab for one slope (Left or Right) of a Gable Dormer.
     * Starts at front overhang (Z = +overhangFront) and slopes back to meet the main roof
     * at Z = -cheekDepth (at eaves) and Z = -ridgeDepth (at ridge apex).
     * The entire slab is covered with the dormer's ROOF material.
     */
    buildGableRoofPlaneGeometry(isLeft, width, height, totalFrontH, cheekDepth, ridgeDepth, overhangFront = 6, overhangSide = 6, roofThick = 3.5) {
        const geo = new THREE.BufferGeometry();
        const halfW = width / 2;
        const xEave = isLeft ? -(halfW + overhangSide) : (halfW + overhangSide);
        const zFront = overhangFront;
        const zEaveBack = -cheekDepth;
        const zRidgeBack = -ridgeDepth;

        const pitchAngle = Math.atan2(totalFrontH - height, halfW);
        const yLift = roofThick / Math.max(0.1, Math.cos(pitchAngle));

        let verts = [];
        let indices = [];

        if (isLeft) {
            verts = [
                // Top Surface:
                0, totalFrontH + yLift, zFront,
                xEave, height + yLift, zFront,
                xEave, height + yLift, zEaveBack,
                0, totalFrontH + yLift, zRidgeBack,

                // Bottom Surface:
                0, totalFrontH, zFront,
                xEave, height, zFront,
                xEave, height, zEaveBack,
                0, totalFrontH, zRidgeBack
            ];

            indices = [
                // Top Roof Face
                0, 1, 2,  0, 2, 3,
                // Bottom Soffit Face
                4, 6, 5,  4, 7, 6,
                // Front Overhang Face
                0, 4, 5,  0, 5, 1,
                // Side Eave Fascia Face
                1, 5, 6,  1, 6, 2,
                // Back Valley Face (meeting main roof)
                2, 6, 7,  2, 7, 3,
                // Ridge Joint Face
                0, 3, 7,  0, 7, 4
            ];
        } else {
            verts = [
                // Top Surface:
                0, totalFrontH + yLift, zFront,
                xEave, height + yLift, zFront,
                xEave, height + yLift, zEaveBack,
                0, totalFrontH + yLift, zRidgeBack,

                // Bottom Surface:
                0, totalFrontH, zFront,
                xEave, height, zFront,
                xEave, height, zEaveBack,
                0, totalFrontH, zRidgeBack
            ];

            indices = [
                // Top Roof Face
                0, 2, 1,  0, 3, 2,
                // Bottom Soffit Face
                4, 5, 6,  4, 6, 7,
                // Front Overhang Face
                0, 1, 5,  0, 5, 4,
                // Side Eave Fascia Face
                1, 2, 6,  1, 6, 5,
                // Back Valley Face
                2, 3, 7,  2, 7, 6,
                // Ridge Joint Face
                0, 4, 7,  0, 7, 3
            ];
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        // Physical metric UVs
        const uvs = [];
        for (let i = 0; i < verts.length; i += 3) {
            const vx = verts[i];
            const vy = verts[i + 1];
            const vz = verts[i + 2];
            const slopeDist = Math.hypot(vx, vy - height);
            uvs.push((isLeft ? -slopeDist : slopeDist) / 100, -vz / 100);
        }
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

        return geo;
    }

    /**
     * Builds a planar rear closure quad wall for Shed/Hip dormers.
     */
    buildBackWallQuadGeometry(width, topY, bottomY, depth) {
        const geo = new THREE.BufferGeometry();
        const halfW = width / 2;
        const verts = [
            -halfW, bottomY, -depth,
            halfW, bottomY, -depth,
            halfW, topY, -depth,
            -halfW, topY, -depth
        ];
        const indices = [
            0, 1, 2,
            0, 2, 3,
            0, 2, 1,
            0, 3, 2
        ];
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const uvs = [
            0, 0,
            1, 0,
            1, 1,
            0, 1
        ];
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        return geo;
    }

    /**
     * Builds a complete parametric 3D Dormer assembly
     * @param {Object} item - Dormer config object
     * @param {Object} roof - Parent roof entity
     * @param {number} roofPitchDeg - Main roof slope pitch in degrees (default 35)
     * @returns {THREE.Group} Dormer 3D group centered at bottom-front-center (Z=0 is front face, Y=0 is base sill)
     */
    buildDormer(item, roof = null, roofPitchDeg = 35) {
        const group = new THREE.Group();
        group.name = `dormer_${item.id || 'assembly'}`;
        group.userData = { isRoofSculpture: true, isRoofAddon: true, isRoofDormer: true, sculptureType: 'dormer', addonType: 'dormer', entity: item, parentRoof: roof, sculptureData: item };

        // Normalize type
        let type = item.type || item.dormerType || 'dormer_gable';
        if (type.startsWith('preset_')) type = type.replace('preset_', '');
        if (!type.startsWith('dormer_')) type = `dormer_${type}`;

        const width = Number(item.width) || (type === 'dormer_shed' ? 140 : 100);
        const height = Number(item.height) || (type === 'dormer_eyebrow' ? 55 : 85);
        const roofPitch = Math.max(10, Math.min(65, Number(roofPitchDeg) || 35));
        const pitchRad = (roofPitch * Math.PI) / 180;
        const tanPitch = Math.tan(pitchRad);

        // Window inclusion toggle (defaults to true)
        const hasWindow = item.hasWindow !== false && item.showWindow !== false && item.window !== false;

        // Resolve materials cleanly with authoritative inheritance from parent roof & walls
        const parentRoofMat = roof?.config?.material || roof?.material || 'terracotta_tiles_roof';
        const sidingKey = item.materials?.dormer_siding || item.materials?.wall || item.sidingMaterial || item.wallMaterial || 'wood_siding';
        const trimKey = item.materials?.dormer_trim || item.materials?.trim || item.trimMaterial || 'white_paint';
        const rawRoofKey = item.materials?.dormer_roof || item.materials?.roof || item.roofMaterial;
        const roofKey = (rawRoofKey && rawRoofKey !== '' && rawRoofKey !== 'match_roof') ? rawRoofKey : parentRoofMat;
        const frameKey = item.materials?.frame || item.frameMaterial || 'white_paint';
        const glassKey = item.materials?.glass || item.glassMaterial || 'glass';

        const sidingMat = this.getMaterial(sidingKey, 0xf1f5f9, 0.6, 0.05, 'wall');
        const trimMat = this.getMaterial(trimKey, 0xf8fafc, 0.5, 0.05, 'wall');
        const roofMat = this.getMaterial(roofKey, 0x334155, 0.7, 0.05, 'roof');
        const frameMat = this.getMaterial(frameKey, 0xf8fafc, 0.4, 0.05, 'wall');
        const glassMat = this.getGlassMaterial();

        const halfW = width / 2;
        const wallThick = 4;
        const cheekDepth = height / Math.max(0.15, tanPitch);

        if (type === 'dormer_eyebrow') {
            // =================================================================
            // 1. EYEBROW DORMER (Curved wave arch roof + arched fanlight window)
            // =================================================================
            const eyebrowGroup = new THREE.Group();
            const browDepth = height / Math.max(0.15, tanPitch);

            // 1. Front Wall with Arched Window Opening
            const frontShape = new THREE.Shape();
            frontShape.moveTo(-halfW, 0);
            frontShape.lineTo(-halfW, height * 0.15);
            // Graceful eyebrow arch across the top
            frontShape.bezierCurveTo(-halfW * 0.5, height * 1.05, halfW * 0.5, height * 1.05, halfW, height * 0.15);
            frontShape.lineTo(halfW, 0);
            frontShape.closePath();

            const winW = width * 0.7;
            const winH = height * 0.75;
            const holePath = new THREE.Path();

            if (hasWindow) {
                // Window opening hole
                holePath.moveTo(-winW / 2, 4);
                holePath.lineTo(-winW / 2, winH * 0.25);
                holePath.bezierCurveTo(-winW * 0.45, winH * 1.0, winW * 0.45, winH * 1.0, winW / 2, winH * 0.25);
                holePath.lineTo(winW / 2, 4);
                holePath.closePath();
                frontShape.holes.push(holePath);
            }

            const frontGeo = new THREE.ExtrudeGeometry(frontShape, { depth: wallThick, bevelEnabled: false });
            frontGeo.translate(0, 0, -wallThick);
            const frontMesh = new THREE.Mesh(frontGeo, sidingMat);
            frontMesh.userData.materialSlot = 'dormer_siding';
            frontMesh.castShadow = true;
            eyebrowGroup.add(frontMesh);

            // 2. Arched Window Assembly (Frame, Sill, Mullions & Glass)
            if (hasWindow) {
                const winGroup = new THREE.Group();
                winGroup.position.set(0, 0, -wallThick / 2);

                // Glass
                const glassShape = new THREE.Shape();
                glassShape.moveTo(-winW / 2, 4);
                glassShape.lineTo(-winW / 2, winH * 0.25);
                glassShape.bezierCurveTo(-winW * 0.45, winH * 1.0, winW * 0.45, winH * 1.0, winW / 2, winH * 0.25);
                glassShape.lineTo(winW / 2, 4);
                glassShape.closePath();
                const glassMesh = new THREE.Mesh(new THREE.ShapeGeometry(glassShape), glassMat);
                glassMesh.userData.materialSlot = 'glass';
                winGroup.add(glassMesh);

                // Mullions
                const vertMull = new THREE.Mesh(new THREE.BoxGeometry(1.4, winH * 0.85, 1.4), frameMat);
                vertMull.userData.materialSlot = 'frame';
                vertMull.position.set(0, winH * 0.45, 0.3);
                winGroup.add(vertMull);

                [-winW * 0.25, winW * 0.25].forEach(x => {
                    const subM = new THREE.Mesh(new THREE.BoxGeometry(1.2, winH * 0.6, 1.2), frameMat);
                    subM.userData.materialSlot = 'frame';
                    subM.position.set(x, winH * 0.35, 0.3);
                    winGroup.add(subM);
                });

                const horizM = new THREE.Mesh(new THREE.BoxGeometry(winW, 1.4, 1.4), frameMat);
                horizM.userData.materialSlot = 'frame';
                horizM.position.set(0, winH * 0.38, 0.3);
                winGroup.add(horizM);

                // Protruding Window Sill
                const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 8, 3.5, 6), trimMat);
                sill.userData.materialSlot = 'dormer_trim';
                sill.position.set(0, 2, 2);
                winGroup.add(sill);

                eyebrowGroup.add(winGroup);
            }

            // 3. Lofted Curved Wave Roof Canopy
            const uSegments = 32;
            const vSegments = 24;
            const roofGeo = new THREE.BufferGeometry();
            const verts = [];
            const indices = [];
            const uvs = [];

            for (let j = 0; j <= vSegments; j++) {
                const vT = j / vSegments;
                const z = -vT * browDepth;
                const yBaseRoof = vT * browDepth * tanPitch;
                const remainingArchH = Math.max(0, height - yBaseRoof);

                for (let i = 0; i <= uSegments; i++) {
                    const uT = i / uSegments;
                    const x = -halfW - 3 + uT * (width + 6);
                    const normalizedX = (x / (halfW + 3));

                    const cosTerm = Math.cos(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (normalizedX * Math.PI) / 2)));
                    const y = yBaseRoof + Math.max(0, cosTerm * cosTerm * remainingArchH);

                    verts.push(x, y, z);
                    uvs.push((x + halfW + 3) / 100, -z / 100);
                }
            }

            for (let j = 0; j < vSegments; j++) {
                for (let i = 0; i < uSegments; i++) {
                    const a = j * (uSegments + 1) + i;
                    const b = (j + 1) * (uSegments + 1) + i;
                    const c = (j + 1) * (uSegments + 1) + (i + 1);
                    const d = j * (uSegments + 1) + (i + 1);

                    indices.push(a, b, d);
                    indices.push(b, c, d);
                }
            }

            roofGeo.setIndex(indices);
            roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
            roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            roofGeo.computeVertexNormals();

            const eyebrowRoof = new THREE.Mesh(roofGeo, roofMat);
            eyebrowRoof.name = 'eyebrow_roof_canopy';
            eyebrowRoof.userData.materialSlot = 'dormer_roof';
            eyebrowRoof.castShadow = true;
            eyebrowRoof.receiveShadow = true;
            eyebrowGroup.add(eyebrowRoof);

            // Front Brow Trim Eaves Lip
            const browShape = new THREE.Shape();
            browShape.moveTo(-halfW - 4, height * 0.12);
            browShape.bezierCurveTo(-halfW * 0.5, height * 1.08, halfW * 0.5, height * 1.08, halfW + 4, height * 0.12);
            browShape.lineTo(halfW + 4, height * 0.18);
            browShape.bezierCurveTo(halfW * 0.5, height * 1.14, -halfW * 0.5, height * 1.14, -halfW - 4, height * 0.18);
            browShape.closePath();
            const browGeo = new THREE.ExtrudeGeometry(browShape, { depth: 3.5, bevelEnabled: false });
            browGeo.translate(0, 0, 0);
            const browTrim = new THREE.Mesh(browGeo, trimMat);
            browTrim.userData.materialSlot = 'dormer_trim';
            browTrim.castShadow = true;
            eyebrowGroup.add(browTrim);

            group.add(eyebrowGroup);
        } else if (type === 'dormer_shed') {
            // =================================================================
            // 2. SHED DORMER (Flat/slanted roof with front overhang fascia)
            // =================================================================
            const shedGroup = new THREE.Group();
            const shedPitchDeg = Math.max(5, Math.min(20, roofPitch * 0.4));
            const shedPitchRad = (shedPitchDeg * Math.PI) / 180;
            const tanShed = Math.tan(shedPitchRad);

            const shedDepth = height / Math.max(0.15, tanPitch + tanShed);

            // 1. Cheek Sidewalls
            const leftCheek = new THREE.Mesh(
                this.buildShedCheekWallGeometry(true, width, height, shedDepth, tanShed, wallThick),
                sidingMat
            );
            leftCheek.userData.materialSlot = 'dormer_siding';
            leftCheek.castShadow = true;
            shedGroup.add(leftCheek);

            const rightCheek = new THREE.Mesh(
                this.buildShedCheekWallGeometry(false, width, height, shedDepth, tanShed, wallThick),
                sidingMat
            );
            rightCheek.userData.materialSlot = 'dormer_siding';
            rightCheek.castShadow = true;
            shedGroup.add(rightCheek);

            // 2. Front Wall with Siding Apron
            const apronH = Math.max(16, height * 0.20);
            const winW = width - 20;
            const winH = height - apronH - 10;

            const frontShape = new THREE.Shape();
            frontShape.moveTo(-halfW, 0);
            frontShape.lineTo(-halfW, height);
            frontShape.lineTo(halfW, height);
            frontShape.lineTo(halfW, 0);
            frontShape.closePath();

            if (hasWindow) {
                const hole = new THREE.Path();
                hole.moveTo(-winW / 2, apronH);
                hole.lineTo(winW / 2, apronH);
                hole.lineTo(winW / 2, apronH + winH);
                hole.lineTo(-winW / 2, apronH + winH);
                hole.closePath();
                frontShape.holes.push(hole);
            }

            const frontGeo = new THREE.ExtrudeGeometry(frontShape, { depth: wallThick, bevelEnabled: false });
            frontGeo.translate(0, 0, -wallThick);
            const frontMesh = new THREE.Mesh(frontGeo, sidingMat);
            frontMesh.userData.materialSlot = 'dormer_siding';
            frontMesh.castShadow = true;
            shedGroup.add(frontMesh);

            // 3. Multi-Pane Casement Window Assembly
            if (hasWindow) {
                const winGroup = this.buildDoubleHungWindow(winW, winH, frameMat, glassMat, trimMat, width > 130 ? 3 : 2);
                winGroup.position.set(0, apronH, -wallThick / 2);
                shedGroup.add(winGroup);
            }

            // 4. Slanted Shed Roof Slab
            const roofLen = (shedDepth + 8) / Math.cos(shedPitchRad);
            const roofW = width + 6;
            const roofThick = 3.5;
            const shedRoofGeo = new THREE.BoxGeometry(roofW, roofThick, roofLen);
            this.applyPhysicalBoxUVs(shedRoofGeo, roofW, roofThick, roofLen);
            const shedRoofMesh = new THREE.Mesh(shedRoofGeo, roofMat);
            shedRoofMesh.userData.materialSlot = 'dormer_roof';
            shedRoofMesh.rotation.x = -shedPitchRad;
            const centerDist = (shedDepth + 8) / 2 - 4;
            shedRoofMesh.position.set(0, height + roofThick / 2 - centerDist * tanShed, -centerDist);
            shedRoofMesh.castShadow = true;
            shedRoofMesh.receiveShadow = true;
            shedGroup.add(shedRoofMesh);

            // Front Fascia Trim
            const fasciaGeo = new THREE.BoxGeometry(roofW + 2, 5, 2.5);
            const fasciaMesh = new THREE.Mesh(fasciaGeo, trimMat);
            fasciaMesh.userData.materialSlot = 'dormer_trim';
            fasciaMesh.position.set(0, height + 1, 4.2);
            shedGroup.add(fasciaMesh);

            // 5. Rear Back Wall Enclosure
            const backY = Math.max(0, height - shedDepth * tanShed);
            const rearShedGeo = this.buildBackWallQuadGeometry(width, backY, 0, shedDepth);
            const rearShedMesh = new THREE.Mesh(rearShedGeo, sidingMat);
            rearShedMesh.userData.materialSlot = 'dormer_siding';
            rearShedMesh.castShadow = true;
            shedGroup.add(rearShedMesh);

            group.add(shedGroup);
        } else if (type === 'dormer_hip') {
            // =================================================================
            // 3. HIP DORMER (3-Sided Hipped Mini Roof)
            // =================================================================
            const hipGroup = new THREE.Group();

            // 1. Cheek Sidewalls
            const leftCheek = new THREE.Mesh(
                this.buildCheekWallGeometry(true, width, height, cheekDepth, wallThick),
                sidingMat
            );
            leftCheek.userData.materialSlot = 'dormer_siding';
            leftCheek.castShadow = true;
            hipGroup.add(leftCheek);

            const rightCheek = new THREE.Mesh(
                this.buildCheekWallGeometry(false, width, height, cheekDepth, wallThick),
                sidingMat
            );
            rightCheek.userData.materialSlot = 'dormer_siding';
            rightCheek.castShadow = true;
            hipGroup.add(rightCheek);

            // 2. Front Wall with Siding Apron & Window
            const apronH = Math.max(16, height * 0.22);
            const winW = width - 24;
            const winH = height - apronH - 12;

            const frontShape = new THREE.Shape();
            frontShape.moveTo(-halfW, 0);
            frontShape.lineTo(-halfW, height);
            frontShape.lineTo(halfW, height);
            frontShape.lineTo(halfW, 0);
            frontShape.closePath();

            if (hasWindow) {
                const hole = new THREE.Path();
                hole.moveTo(-winW / 2, apronH);
                hole.lineTo(winW / 2, apronH);
                hole.lineTo(winW / 2, apronH + winH);
                hole.lineTo(-winW / 2, apronH + winH);
                hole.closePath();
                frontShape.holes.push(hole);
            }

            const frontGeo = new THREE.ExtrudeGeometry(frontShape, { depth: wallThick, bevelEnabled: false });
            frontGeo.translate(0, 0, -wallThick);
            const frontMesh = new THREE.Mesh(frontGeo, sidingMat);
            frontMesh.userData.materialSlot = 'dormer_siding';
            frontMesh.castShadow = true;
            hipGroup.add(frontMesh);

            if (hasWindow) {
                const winGroup = this.buildDoubleHungWindow(winW, winH, frameMat, glassMat, trimMat, 2);
                winGroup.position.set(0, apronH, -wallThick / 2);
                hipGroup.add(winGroup);
            }

            // 3. 3-Sided Hip Roof Cap
            const hipPitchRad = (30 * Math.PI) / 180;
            const hipH = (halfW) * Math.tan(hipPitchRad);
            const hipRidgeEnd = Math.min(-cheekDepth, -halfW - 5);

            const hipGeo = new THREE.BufferGeometry();
            const hipVerts = [
                // Front Hip Triangle
                -halfW - 4, height, 4,
                halfW + 4, height, 4,
                0, height + hipH, -halfW,

                // Left Hip Slope
                -halfW - 4, height, 4,
                0, height + hipH, -halfW,
                0, height + hipH, hipRidgeEnd,
                -halfW - 4, height, -cheekDepth,

                // Right Hip Slope
                halfW + 4, height, 4,
                halfW + 4, height, -cheekDepth,
                0, height + hipH, hipRidgeEnd,
                0, height + hipH, -halfW
            ];

            const hipIndices = [
                0, 1, 2,
                3, 4, 6, 4, 5, 6,
                7, 9, 8, 7, 10, 9
            ];

            const hipUVs = [];
            for (let i = 0; i < hipVerts.length; i += 3) {
                hipUVs.push(hipVerts[i] / 100, hipVerts[i + 2] / 100);
            }

            hipGeo.setIndex(hipIndices);
            hipGeo.setAttribute('position', new THREE.Float32BufferAttribute(hipVerts, 3));
            hipGeo.setAttribute('uv', new THREE.Float32BufferAttribute(hipUVs, 2));
            hipGeo.computeVertexNormals();

            const hipRoofMesh = new THREE.Mesh(hipGeo, roofMat);
            hipRoofMesh.userData.materialSlot = 'dormer_roof';
            hipRoofMesh.castShadow = true;
            hipRoofMesh.receiveShadow = true;
            hipGroup.add(hipRoofMesh);

            // Eaves Cornice Trim
            const eaveGeo = new THREE.BoxGeometry(width + 8, 3.5, 4);
            const eaveMesh = new THREE.Mesh(eaveGeo, trimMat);
            eaveMesh.userData.materialSlot = 'dormer_trim';
            eaveMesh.position.set(0, height + 1, 2);
            hipGroup.add(eaveMesh);

            // 4. Rear Back Wall Enclosure
            const rearHipGeo = this.buildBackWallQuadGeometry(width, height, 0, cheekDepth);
            const rearHipMesh = new THREE.Mesh(rearHipGeo, sidingMat);
            rearHipMesh.userData.materialSlot = 'dormer_siding';
            rearHipMesh.castShadow = true;
            hipGroup.add(rearHipMesh);

            group.add(hipGroup);
        } else if (type === 'dormer_barrel') {
            // =================================================================
            // 4. BARREL VAULT DORMER (Semicircular arch roof)
            // =================================================================
            const barrelGroup = new THREE.Group();
            const radius = halfW;
            const barrelDepth = (height + radius) / Math.max(0.15, tanPitch);

            // 1. Cheek Sidewalls
            const leftCheek = new THREE.Mesh(
                this.buildCheekWallGeometry(true, width, height, cheekDepth, wallThick),
                sidingMat
            );
            leftCheek.userData.materialSlot = 'dormer_siding';
            leftCheek.castShadow = true;
            barrelGroup.add(leftCheek);

            const rightCheek = new THREE.Mesh(
                this.buildCheekWallGeometry(false, width, height, cheekDepth, wallThick),
                sidingMat
            );
            rightCheek.userData.materialSlot = 'dormer_siding';
            rightCheek.castShadow = true;
            barrelGroup.add(rightCheek);

            // 2. Front Wall with Arched Cutout
            const frontShape = new THREE.Shape();
            frontShape.moveTo(-halfW, 0);
            frontShape.lineTo(-halfW, height);
            frontShape.absarc(0, height, radius, Math.PI, 0, true);
            frontShape.lineTo(halfW, 0);
            frontShape.closePath();

            const winW = width - 16;
            const winH = height + radius - 14;

            if (hasWindow) {
                const hole = new THREE.Path();
                hole.moveTo(-winW / 2, 4);
                hole.lineTo(-winW / 2, height - 4);
                hole.absarc(0, height - 4, winW / 2, Math.PI, 0, true);
                hole.lineTo(winW / 2, 4);
                hole.closePath();
                frontShape.holes.push(hole);
            }

            const frontGeo = new THREE.ExtrudeGeometry(frontShape, { depth: wallThick, bevelEnabled: false });
            frontGeo.translate(0, 0, -wallThick);
            const frontMesh = new THREE.Mesh(frontGeo, sidingMat);
            frontMesh.userData.materialSlot = 'dormer_siding';
            frontMesh.castShadow = true;
            barrelGroup.add(frontMesh);

            // 3. Arched Window Assembly
            if (hasWindow) {
                const winGroup = new THREE.Group();
                winGroup.position.set(0, 0, -wallThick / 2);

                const glassShape = new THREE.Shape();
                glassShape.moveTo(-winW / 2, 4);
                glassShape.lineTo(-winW / 2, height - 4);
                glassShape.absarc(0, height - 4, winW / 2, Math.PI, 0, true);
                glassShape.lineTo(winW / 2, 4);
                glassShape.closePath();
                const glassMesh = new THREE.Mesh(new THREE.ShapeGeometry(glassShape), glassMat);
                glassMesh.userData.materialSlot = 'glass';
                winGroup.add(glassMesh);

                const vM = new THREE.Mesh(new THREE.BoxGeometry(1.4, winH, 1.4), frameMat);
                vM.userData.materialSlot = 'frame';
                vM.position.set(0, winH / 2, 0.3);
                winGroup.add(vM);
                const hM = new THREE.Mesh(new THREE.BoxGeometry(winW, 1.4, 1.4), frameMat);
                hM.userData.materialSlot = 'frame';
                hM.position.set(0, height - 4, 0.3);
                winGroup.add(hM);

                const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 8, 3.5, 6), trimMat);
                sill.userData.materialSlot = 'dormer_trim';
                sill.position.set(0, 2, 2);
                winGroup.add(sill);
                barrelGroup.add(winGroup);
            }

            // 4. Semicircular Barrel Roof Cylinder
            const roofLen = barrelDepth + 6;
            const barrelRadius = radius + 2;
            const barrelGeo = new THREE.CylinderGeometry(barrelRadius, barrelRadius, roofLen, 24, 1, false, 0, Math.PI);
            barrelGeo.rotateZ(Math.PI / 2);
            barrelGeo.rotateY(Math.PI / 2);

            const barrelPos = barrelGeo.attributes.position;
            const barrelUVs = [];
            for (let i = 0; i < barrelPos.count; i++) {
                const bx = barrelPos.getX(i);
                const by = barrelPos.getY(i);
                const bz = barrelPos.getZ(i);
                const angle = Math.atan2(by, bx);
                barrelUVs.push((angle * barrelRadius) / 100, -bz / 100);
            }
            barrelGeo.setAttribute('uv', new THREE.Float32BufferAttribute(barrelUVs, 2));

            const barrelMesh = new THREE.Mesh(barrelGeo, roofMat);
            barrelMesh.userData.materialSlot = 'dormer_roof';
            barrelMesh.position.set(0, height, -roofLen / 2 + 4);
            barrelMesh.castShadow = true;
            barrelMesh.receiveShadow = true;
            barrelGroup.add(barrelMesh);

            // 5. Rear Arched Wall Enclosure
            const rearBarrelShape = new THREE.Shape();
            rearBarrelShape.moveTo(-halfW, 0);
            rearBarrelShape.lineTo(-halfW, height);
            rearBarrelShape.absarc(0, height, radius, Math.PI, 0, true);
            rearBarrelShape.lineTo(halfW, 0);
            rearBarrelShape.closePath();
            const rearBarrelGeo = new THREE.ExtrudeGeometry(rearBarrelShape, { depth: wallThick, bevelEnabled: false });
            rearBarrelGeo.translate(0, 0, -barrelDepth);
            const rearBarrelMesh = new THREE.Mesh(rearBarrelGeo, sidingMat);
            rearBarrelMesh.userData.materialSlot = 'dormer_siding';
            rearBarrelMesh.castShadow = true;
            barrelGroup.add(rearBarrelMesh);

            group.add(barrelGroup);
        } else {
            // =================================================================
            // 5. GABLE DORMER (Classic Peaked A-Frame Roof, Bargeboards & Window)
            // =================================================================
            const gableGroup = new THREE.Group();
            const dormerPitchDeg = Number(item.pitch) || 35;
            const dormerPitchRad = (dormerPitchDeg * Math.PI) / 180;
            const gableApexH = halfW * Math.tan(dormerPitchRad);
            const totalFrontH = height + gableApexH;

            const ridgeDepth = totalFrontH / Math.max(0.15, tanPitch);

            // 1. Cheek Sidewalls
            const leftCheek = new THREE.Mesh(
                this.buildCheekWallGeometry(true, width, height, cheekDepth, wallThick),
                sidingMat
            );
            leftCheek.userData.materialSlot = 'dormer_siding';
            leftCheek.castShadow = true;
            gableGroup.add(leftCheek);

            const rightCheek = new THREE.Mesh(
                this.buildCheekWallGeometry(false, width, height, cheekDepth, wallThick),
                sidingMat
            );
            rightCheek.userData.materialSlot = 'dormer_siding';
            rightCheek.castShadow = true;
            gableGroup.add(rightCheek);

            // 2. Front Wall with Triangular Pediment & Siding Apron
            const apronH = Math.max(16, height * 0.22);
            const winW = width - 24;
            const winH = height - apronH - 12;

            const frontShape = new THREE.Shape();
            frontShape.moveTo(-halfW, 0);
            frontShape.lineTo(-halfW, height);
            frontShape.lineTo(0, totalFrontH);
            frontShape.lineTo(halfW, height);
            frontShape.lineTo(halfW, 0);
            frontShape.closePath();

            if (hasWindow) {
                const hole = new THREE.Path();
                hole.moveTo(-winW / 2, apronH);
                hole.lineTo(winW / 2, apronH);
                hole.lineTo(winW / 2, apronH + winH);
                hole.lineTo(-winW / 2, apronH + winH);
                hole.closePath();
                frontShape.holes.push(hole);
            }

            const frontGeo = new THREE.ExtrudeGeometry(frontShape, { depth: wallThick, bevelEnabled: false });
            frontGeo.translate(0, 0, -wallThick);
            const frontMesh = new THREE.Mesh(frontGeo, sidingMat);
            frontMesh.userData.materialSlot = 'dormer_siding';
            frontMesh.castShadow = true;
            gableGroup.add(frontMesh);

            // 3. Double-Hung Window Assembly
            if (hasWindow) {
                const winGroup = this.buildDoubleHungWindow(winW, winH, frameMat, glassMat, trimMat, 2);
                winGroup.position.set(0, apronH, -wallThick / 2);
                gableGroup.add(winGroup);
            }

            // 4. Peaked Gable Roof Slopes (Continuous 3D Solid Roof Slabs with full roof coverage)
            const leftRoofGeo = this.buildGableRoofPlaneGeometry(true, width, height, totalFrontH, cheekDepth, ridgeDepth, 6, 6, 3.5);
            const leftRoof = new THREE.Mesh(leftRoofGeo, roofMat);
            leftRoof.userData.materialSlot = 'dormer_roof';
            leftRoof.castShadow = true;
            leftRoof.receiveShadow = true;
            gableGroup.add(leftRoof);

            const rightRoofGeo = this.buildGableRoofPlaneGeometry(false, width, height, totalFrontH, cheekDepth, ridgeDepth, 6, 6, 3.5);
            const rightRoof = new THREE.Mesh(rightRoofGeo, roofMat);
            rightRoof.userData.materialSlot = 'dormer_roof';
            rightRoof.castShadow = true;
            rightRoof.receiveShadow = true;
            gableGroup.add(rightRoof);

            // 5. Front Decorative Gable Bargeboard Trims (A-Frame Fascia)
            const bargeShape = new THREE.Shape();
            bargeShape.moveTo(-halfW - 6, height - 2);
            bargeShape.lineTo(0, totalFrontH + 4);
            bargeShape.lineTo(halfW + 6, height - 2);
            bargeShape.lineTo(halfW + 6, height + 4);
            bargeShape.lineTo(0, totalFrontH + 10);
            bargeShape.lineTo(-halfW - 6, height + 4);
            bargeShape.closePath();
            const bargeGeo = new THREE.ExtrudeGeometry(bargeShape, { depth: 3.5, bevelEnabled: false });
            bargeGeo.translate(0, 0, 4.5);
            const bargeMesh = new THREE.Mesh(bargeGeo, trimMat);
            bargeMesh.userData.materialSlot = 'dormer_trim';
            bargeMesh.castShadow = true;
            gableGroup.add(bargeMesh);

            group.add(gableGroup);
        }

        // Register with CAD/BIM ComponentRegistry preserving specific material slots
        group.traverse(child => {
            if (child.isMesh) {
                const slot = child.userData.materialSlot || 'dormer_siding';
                child.userData = {
                    ...child.userData,
                    isRoofSculpture: true,
                    isRoofAddon: true,
                    isRoofDormer: true,
                    addonType: 'dormer',
                    entity: item,
                    parentRoof: roof,
                    materialSlot: slot,
                    slotName: slot,
                    componentType: 'roof_dormer',
                    sculptureId: item.id
                };
                if (roof) ComponentRegistry.registerMesh(roof, slot, child);
            }
        });

        return group;
    }
}

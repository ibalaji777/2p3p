import * as THREE from 'three';
import { ROOF_DECOR_REGISTRY } from '../roof.registry.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';

/**
 * Skylight3DBuilder
 * 
 * Constructs precision 3D architectural skylights matching the architectural reference:
 * - DARK CHARCOAL SATIN STEEL frames (#18181b / #1e293b)
 * - Weather flashing apron collar (6cm tile overlap, completely eliminating white border gaps)
 * - White inner sash lining on Velux roof windows (#f8fafc)
 * - Exact Victorian Leaded Diamond Came lattice (100% mathematically trimmed with zero overshoots)
 * - 4-Pane Structural Cross Grid with crisp metal mullions
 * - Highly reflective, transmissive PBR sky glass with real-time user-customizable transparency & tinting
 * - Deep interior shadow void backing beneath glass
 */
export class Skylight3DBuilder {
    constructor(ctx) {
        this.ctx = ctx;
    }

    /**
     * Builds a 3D skylight window mesh group in slope-local coordinate space (Y=0 is slope surface).
     * @param {Object} skylight - Skylight configuration object
     * @param {Object} roof - Parent roof entity
     * @returns {THREE.Group}
     */
    buildSkylight(skylight, roof) {
        const group = new THREE.Group();
        group.name = `skylight_${skylight.id || 'window'}`;

        const width = Number(skylight.width) || 100;
        const length = Number(skylight.length) || 150;
        const frameThick = Number(skylight.frameThickness) || 6.0;
        const style = skylight.type || 'skylight_velux_frame';

        const glassMatKey = skylight.material || 'glass_roof_square_grid';
        const frameMatKey = skylight.frameMaterial || 'metal_dark_steel';

        // 1. Frame Material — Charcoal steel (#18181b / #1e293b)
        let frameColor = 0x18181b;
        if (frameMatKey === 'bronze' || style === 'skylight_diamond_lattice') frameColor = 0x24272c;
        if (frameMatKey === 'white' || skylight.frameColor === 'white') frameColor = 0xf8fafc;
        if (skylight.frameColor && typeof skylight.frameColor === 'string' && skylight.frameColor.startsWith('#')) {
            frameColor = parseInt(skylight.frameColor.replace('#', '0x'));
        }

        const frameMat = new THREE.MeshStandardMaterial({
            color: frameColor,
            metalness: 0.85,
            roughness: 0.22,
            side: THREE.DoubleSide,
            envMapIntensity: 1.2
        });

        // 2. Flashing Apron Material (Dark weather-seal flashing collar resting flat on surrounding tiles)
        const flashingMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            metalness: 0.75,
            roughness: 0.35,
            side: THREE.DoubleSide
        });

        // 3. Interior Aperture Void Material (Attic shadow depth beneath glass)
        const interiorVoidMat = new THREE.MeshStandardMaterial({
            color: 0x05070d,
            roughness: 0.98,
            metalness: 0.0,
            side: THREE.DoubleSide
        });

        // 4. Physical PBR Glass Material with user-customizable transparency & tinting
        let rawTransmission = 0.92;
        if (skylight.transparency !== undefined) rawTransmission = Number(skylight.transparency);
        else if (skylight.transmission !== undefined) rawTransmission = Number(skylight.transmission);
        else if (skylight.opacity !== undefined && skylight.opacity <= 1.0) rawTransmission = Number(skylight.opacity);

        let glassRoughness = 0.02;
        if (skylight.glassRoughness !== undefined) glassRoughness = Number(skylight.glassRoughness);
        else if (skylight.roughness !== undefined) glassRoughness = Number(skylight.roughness);

        let glassTint = new THREE.Color(0x88ccee); // Default sky blue tint
        if (skylight.tint) {
            glassTint = new THREE.Color(skylight.tint);
        } else if (skylight.glassTint) {
            glassTint = new THREE.Color(skylight.glassTint);
        } else if (skylight.color) {
            glassTint = new THREE.Color(skylight.color);
        } else if (glassMatKey === 'glass_roof_solid_clear') {
            glassTint = new THREE.Color(0xdbeafe);
        } else if (glassMatKey === 'glass_roof_diamond_lattice') {
            glassTint = new THREE.Color(0x88ccee);
        }

        const glassMat = new THREE.MeshPhysicalMaterial({
            color: glassTint,
            transmission: Math.max(0.05, Math.min(0.99, rawTransmission)),
            opacity: 1.0,
            transparent: true,
            roughness: glassRoughness,
            metalness: 0.0,
            ior: 1.52,
            thickness: 2.0,
            reflectivity: 0.6,
            clearcoat: 1.0,
            clearcoatRoughness: 0.04,
            side: THREE.DoubleSide,
            depthWrite: false,
            envMapIntensity: 2.2
        });

        // ============================================================
        // A. WEATHER FLASHING APRON (6cm Tile Overlap - No White Gaps)
        // ============================================================
        const flangeMargin = 6.0; // 6cm overlap over roof tiles on all 4 sides
        const flangeW = width + 2 * flangeMargin;
        const flangeL = length + 2 * flangeMargin;
        const flangeH = 0.6; // 6mm thick dark flashing skirt

        const flangeGeo = new THREE.BoxGeometry(flangeW, flangeH, flangeL);
        const flangeMesh = new THREE.Mesh(flangeGeo, flashingMat);
        flangeMesh.position.set(0, flangeH / 2, 0);
        flangeMesh.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
        group.add(flangeMesh);

        // ============================================================
        // B. INTERIOR APERTURE VOID (Dark shadow depth beneath glass)
        // ============================================================
        const voidGeo = new THREE.PlaneGeometry(width - 4, length - 4);
        voidGeo.rotateX(-Math.PI / 2);
        const voidMesh = new THREE.Mesh(voidGeo, interiorVoidMat);
        voidMesh.position.set(0, -0.8, 0);
        group.add(voidMesh);

        // ============================================================
        // C. PERIMETER PROMINENT FRAME (Height 3.2 cm)
        // ============================================================
        const frameH = 3.2;
        const barW = frameThick;

        // Left Jamb
        const leftJambGeo = new THREE.BoxGeometry(barW, frameH, length);
        const leftJamb = new THREE.Mesh(leftJambGeo, frameMat);
        leftJamb.position.set(-width / 2 + barW / 2, frameH / 2, 0);
        leftJamb.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
        group.add(leftJamb);

        // Right Jamb
        const rightJamb = new THREE.Mesh(leftJambGeo, frameMat);
        rightJamb.position.set(width / 2 - barW / 2, frameH / 2, 0);
        rightJamb.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
        group.add(rightJamb);

        // Top Jamb
        const topJambGeo = new THREE.BoxGeometry(width - 2 * barW, frameH, barW);
        const topJamb = new THREE.Mesh(topJambGeo, frameMat);
        topJamb.position.set(0, frameH / 2, -length / 2 + barW / 2);
        topJamb.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
        group.add(topJamb);

        // Bottom Jamb
        const bottomJamb = new THREE.Mesh(topJambGeo, frameMat);
        bottomJamb.position.set(0, frameH / 2, length / 2 - barW / 2);
        bottomJamb.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
        group.add(bottomJamb);

        // ============================================================
        // D. INNER SASH & STRUCTURAL MULLIONS
        // ============================================================
        const innerW = width - 2 * barW;
        const innerL = length - 2 * barW;

        if (style === 'skylight_velux_frame') {
            // Model 1: Velux Pivot Window with White Architectural Sash Liner
            const sashMat = new THREE.MeshStandardMaterial({
                color: 0xf8fafc,
                metalness: 0.1,
                roughness: 0.35,
                side: THREE.DoubleSide
            });
            const sashThick = 2.8;
            const sashH = frameH * 0.85;

            const lSash = new THREE.Mesh(new THREE.BoxGeometry(sashThick, sashH, innerL), sashMat);
            lSash.position.set(-innerW / 2 + sashThick / 2, sashH / 2, 0);
            group.add(lSash);

            const rSash = new THREE.Mesh(new THREE.BoxGeometry(sashThick, sashH, innerL), sashMat);
            rSash.position.set(innerW / 2 - sashThick / 2, sashH / 2, 0);
            group.add(rSash);

            const tSash = new THREE.Mesh(new THREE.BoxGeometry(innerW - 2 * sashThick, sashH, sashThick), sashMat);
            tSash.position.set(0, sashH / 2, -innerL / 2 + sashThick / 2);
            group.add(tSash);

            const bSash = new THREE.Mesh(new THREE.BoxGeometry(innerW - 2 * sashThick, sashH, sashThick), sashMat);
            bSash.position.set(0, sashH / 2, innerL / 2 - sashThick / 2);
            group.add(bSash);

        } else if (style === 'skylight_diamond_lattice' || glassMatKey === 'glass_roof_diamond_lattice') {
            // Model 2: Victorian Conservatory Leaded Diamond Came Lattice
            // Exact trigonometry: center diamond connecting midpoints + corner diagonal rays
            const W = innerW;
            const L = innerL;
            const mullionH = frameH * 0.85;
            const barThick = 2.6;

            const diagLen = Math.hypot(W, L);
            const diagAngle = Math.atan2(W, L); // Precise angle from Z axis toward X axis

            // 1. Full Diagonal 1: Top-Left to Bottom-Right
            const d1Geo = new THREE.BoxGeometry(barThick, mullionH, diagLen);
            const d1 = new THREE.Mesh(d1Geo, frameMat);
            d1.rotation.y = diagAngle;
            d1.position.set(0, mullionH / 2, 0);
            d1.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
            group.add(d1);

            // 2. Full Diagonal 2: Top-Right to Bottom-Left
            const d2Geo = new THREE.BoxGeometry(barThick, mullionH, diagLen);
            const d2 = new THREE.Mesh(d2Geo, frameMat);
            d2.rotation.y = -diagAngle;
            d2.position.set(0, mullionH / 2, 0);
            d2.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
            group.add(d2);

            // 3. Center Diamond connecting (0, -L/2), (W/2, 0), (0, L/2), (-W/2, 0)
            const edgeLen = diagLen / 2;
            const edgeGeo = new THREE.BoxGeometry(barThick, mullionH, edgeLen);

            // Side 1: Top-Mid (0, -L/2) to Right-Mid (W/2, 0)
            const b1 = new THREE.Mesh(edgeGeo, frameMat);
            b1.rotation.y = diagAngle;
            b1.position.set(W / 4, mullionH / 2, -L / 4);
            b1.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
            group.add(b1);

            // Side 2: Top-Mid (0, -L/2) to Left-Mid (-W/2, 0)
            const b2 = new THREE.Mesh(edgeGeo, frameMat);
            b2.rotation.y = -diagAngle;
            b2.position.set(-W / 4, mullionH / 2, -L / 4);
            b2.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
            group.add(b2);

            // Side 3: Bottom-Mid (0, L/2) to Right-Mid (W/2, 0)
            const b3 = new THREE.Mesh(edgeGeo, frameMat);
            b3.rotation.y = -diagAngle;
            b3.position.set(W / 4, mullionH / 2, L / 4);
            b3.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
            group.add(b3);

            // Side 4: Bottom-Mid (0, L/2) to Left-Mid (-W/2, 0)
            const b4 = new THREE.Mesh(edgeGeo, frameMat);
            b4.rotation.y = diagAngle;
            b4.position.set(-W / 4, mullionH / 2, L / 4);
            b4.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
            group.add(b4);

        } else if (style === 'skylight_square_grid_inset' || glassMatKey === 'glass_roof_square_grid') {
            // Model 3: 4-Pane Structural Cross Grid (Modern Atrium)
            const mullionW = 3.6;
            const mullionH = frameH * 0.9;

            const vBarGeo = new THREE.BoxGeometry(mullionW, mullionH, innerL);
            const vBar = new THREE.Mesh(vBarGeo, frameMat);
            vBar.position.set(0, mullionH / 2, 0);
            vBar.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
            group.add(vBar);

            const hBarGeo = new THREE.BoxGeometry(innerW, mullionH, mullionW);
            const hBar = new THREE.Mesh(hBarGeo, frameMat);
            hBar.position.set(0, mullionH / 2, 0);
            hBar.userData = { isSkylightPart: true, materialSlot: 'skylight_frame', entity: skylight };
            group.add(hBar);
        }

        // ============================================================
        // E. GLASS PANE — Transparent sky-reflecting glazing
        // ============================================================
        let glassMesh;
        if (style === 'skylight_pyramid_dome') {
            const pyrGeo = new THREE.ConeGeometry(innerW * 0.68, 20, 4);
            pyrGeo.rotateY(Math.PI / 4);
            glassMesh = new THREE.Mesh(pyrGeo, glassMat);
            glassMesh.position.set(0, 10, 0);
        } else {
            const glassGeo = new THREE.PlaneGeometry(innerW, innerL);
            glassGeo.rotateX(-Math.PI / 2);
            glassMesh = new THREE.Mesh(glassGeo, glassMat);
            glassMesh.position.set(0, 0.9, 0);
            glassMesh.renderOrder = 999;
        }
        glassMesh.userData = { isSkylightPart: true, materialSlot: 'skylight_glass', entity: skylight };
        group.add(glassMesh);

        group.userData = {
            isSkylight: true,
            entity: skylight,
            parentRoof: roof,
            componentType: 'roof_skylight'
        };

        if (roof && skylight.id) {
            ComponentRegistry.registerMesh(roof, 'skylight_frame', leftJamb);
            ComponentRegistry.registerMesh(roof, 'skylight_glass', glassMesh);
        }

        return group;
    }
}

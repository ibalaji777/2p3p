import * as THREE from 'three';

/**
 * Normalizes UV coordinates on ExtrudeGeometry to [0, 1] range to prevent extreme texture tiling.
 */
export const normalizeExtrudeUVs = (geo, w, h, depth, minX, minY) => {
    if (!geo || !geo.attributes || !geo.attributes.uv || !geo.attributes.position) return geo;
    const uvs = geo.attributes.uv;
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;

    if (!geo.boundingBox) geo.computeBoundingBox();
    const bbox = geo.boundingBox;
    const bMinX = minX !== undefined ? minX : bbox.min.x;
    const bMinY = minY !== undefined ? minY : bbox.min.y;
    const bMinZ = bbox.min.z;
    const spanX = Math.max(0.001, bbox.max.x - bbox.min.x);
    const spanY = Math.max(0.001, bbox.max.y - bbox.min.y);
    const spanZ = Math.max(0.001, bbox.max.z - bbox.min.z);

    for (let i = 0; i < uvs.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const nz = norm ? norm.getZ(i) : 1;

        if (Math.abs(nz) > 0.5) {
            // Front / Back Caps (XY projection)
            const u = (vx - bMinX) / spanX;
            const v = (vy - bMinY) / spanY;
            uvs.setXY(i, u, v);
        } else {
            // Extruded side bevels
            const u = (vz - bMinZ) / spanZ;
            const v = (vy - bMinY) / spanY;
            uvs.setXY(i, u, v);
        }
    }
    uvs.needsUpdate = true;
    return geo;
};

/**
 * Generates the 2D architectural profile shape in the local coordinate system (X=depth, Y=height).
 * @param {string} profileType
 * @param {number} depth
 * @param {number} moldingHeight
 * @param {Object} [moldData={}]
 * @returns {THREE.Shape}
 */
export const generateMoldingProfileShape = (profileType, depth, moldingHeight, moldData = {}) => {
    const finalShape = new THREE.Shape();
    const d = depth;
    const h = moldingHeight;

    // ====== BASEBOARD & SKIRTING PROFILES ======
    if (profileType === 'skirting_flat' || profileType === 'flat_baseboard') {
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d, 0);
        finalShape.lineTo(d, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'skirting_beveled' || profileType === 'skirting_chamfer' || profileType === 'chamfered_baseboard') {
        const chamferH = Math.min(h * 0.25, d * 0.85);
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d, 0);
        finalShape.lineTo(d, h - chamferH);
        finalShape.lineTo(d * 0.2, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'skirting_torus' || profileType === 'skirting_bullnose' || profileType === 'torus_baseboard') {
        const torusH = Math.min(h * 0.35, d * 1.2);
        const flatH = h - torusH;
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d, 0);
        finalShape.lineTo(d, flatH);
        finalShape.bezierCurveTo(d * 1.05, flatH + torusH * 0.4, d * 0.7, h, 0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'skirting_ogee' || profileType === 'ogee_baseboard') {
        const plinthH = h * 0.45;
        const ogeeH = h - plinthH;
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d, 0);
        finalShape.lineTo(d, plinthH);
        finalShape.lineTo(d * 0.9, plinthH + ogeeH * 0.1);
        finalShape.bezierCurveTo(d * 0.95, plinthH + ogeeH * 0.35, d * 0.55, plinthH + ogeeH * 0.65, d * 0.35, h * 0.9);
        finalShape.bezierCurveTo(d * 0.25, h * 0.98, d * 0.1, h, 0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'skirting_craftsman' || profileType === 'skirting_step' || profileType === 'craftsman_baseboard') {
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d, 0);
        finalShape.lineTo(d, h * 0.55);
        finalShape.lineTo(d * 0.7, h * 0.55);
        finalShape.lineTo(d * 0.7, h * 0.82);
        finalShape.lineTo(d * 0.4, h * 0.82);
        finalShape.lineTo(d * 0.4, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'skirting_shadow' || profileType === 'skirting_recess' || profileType === 'shadow_gap_baseboard') {
        const revealH = Math.min(h * 0.2, 2);
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d, 0);
        finalShape.lineTo(d, h - revealH);
        finalShape.lineTo(d * 0.2, h - revealH);
        finalShape.lineTo(d * 0.2, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'skirting_scotia' || profileType === 'skirting_cove' || profileType === 'scotia_baseboard') {
        const coveH = h * 0.45;
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d, 0);
        finalShape.lineTo(d, h - coveH);
        finalShape.bezierCurveTo(d * 0.4, h - coveH * 0.6, d * 0.2, h - coveH * 0.2, 0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'skirting_shoe' || profileType === 'skirting_quarter_round' || profileType === 'quarter_round_shoe') {
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d, 0);
        finalShape.bezierCurveTo(d, h * 0.55, d * 0.55, h, 0, h);
        finalShape.lineTo(0, 0);
        
    // ====== CROWN, CORNICE, AND WALL MOLDINGS ======
    } else if (profileType === 'egg_and_dart') {
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d * 0.2, 0);
        finalShape.lineTo(d * 0.2, h * 0.1);
        finalShape.lineTo(d * 0.5, h * 0.8);
        finalShape.lineTo(d, h * 0.8);
        finalShape.lineTo(d, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'dentil') {
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d * 0.6, 0);
        finalShape.lineTo(d * 0.6, h * 0.2);
        finalShape.lineTo(d * 0.3, h * 0.2);
        finalShape.lineTo(d * 0.3, h * 0.8);
        finalShape.lineTo(d, h * 0.8);
        finalShape.lineTo(d, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'craftsman') {
        const mb = Math.min(d * 0.05, h * 0.02);
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d * 0.2 - mb, 0);
        finalShape.lineTo(d * 0.2, mb);
        finalShape.lineTo(d * 0.2, h * 0.35 - mb); 
        finalShape.lineTo(d * 0.45 - mb, h * 0.35);
        finalShape.lineTo(d * 0.45, h * 0.35 + mb);
        finalShape.lineTo(d * 0.45, h * 0.6 - mb);
        finalShape.lineTo(d * 0.75 - mb, h * 0.6);
        finalShape.lineTo(d * 0.75, h * 0.6 + mb);
        finalShape.lineTo(d * 0.75, h * 0.8 - mb);
        finalShape.lineTo(d - mb, h * 0.8);
        finalShape.lineTo(d, h * 0.8 + mb);
        finalShape.lineTo(d, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'ogee') {
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d * 0.15, 0); 
        finalShape.lineTo(d * 0.15, h * 0.1);
        finalShape.bezierCurveTo(d * 0.5, h * 0.1, d * 0.55, h * 0.3, d * 0.55, h * 0.5);
        finalShape.bezierCurveTo(d * 0.55, h * 0.7, d * 0.6, h * 0.9, d * 0.95, h * 0.9);
        finalShape.lineTo(d, h * 0.9);
        finalShape.lineTo(d, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'crown') {
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d * 0.2, 0);
        finalShape.lineTo(d * 0.2, h * 0.1);
        finalShape.bezierCurveTo(d * 0.8, h * 0.3, d * 0.9, h * 0.8, d, h * 0.9);
        finalShape.lineTo(d, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'layered') {
        const layers = moldData.layers || 4;
        const stepH = h / layers;
        const stepD = d / layers;
        finalShape.moveTo(0, 0);
        for (let i = 0; i < layers; i++) {
            finalShape.lineTo((i + 1) * stepD, i * stepH);
            finalShape.lineTo((i + 1) * stepD, (i + 1) * stepH);
        }
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    // ====== WALL TRIMS, CHAIR RAILS & PICTURE RAILS ======
    } else if (profileType === 'chair_rail' || profileType === 'dado_rail' || profileType === 'molding_chair_rail') {
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d * 0.35, 0);
        finalShape.bezierCurveTo(d * 0.45, h * 0.15, d * 0.3, h * 0.35, d * 0.65, h * 0.45);
        finalShape.bezierCurveTo(d * 1.05, h * 0.52, d * 1.05, h * 0.68, d * 0.65, h * 0.75);
        finalShape.bezierCurveTo(d * 0.55, h * 0.85, d * 0.85, h * 0.95, d, h * 0.95);
        finalShape.lineTo(d, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'picture_rail' || profileType === 'molding_picture_rail') {
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d * 0.3, 0);
        finalShape.bezierCurveTo(d * 0.35, h * 0.3, d * 0.5, h * 0.5, d * 0.8, h * 0.7);
        finalShape.bezierCurveTo(d * 1.05, h * 0.85, d * 0.9, h, d * 0.4, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'fluted_band' || profileType === 'molding_fluted_band') {
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
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d * 0.4, 0);
        finalShape.bezierCurveTo(d * 1.0, h * 0.15, d * 1.0, h * 0.4, d * 0.4, h * 0.48);
        finalShape.lineTo(d * 0.25, h * 0.5);
        finalShape.lineTo(d * 0.4, h * 0.52);
        finalShape.bezierCurveTo(d * 1.0, h * 0.6, d * 1.0, h * 0.85, d * 0.4, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'frieze_exterior' || profileType === 'frieze' || profileType === 'elevation_frieze' || profileType === 'molding_frieze') {
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d * 0.4, 0);
        finalShape.lineTo(d * 0.4, h * 0.12);
        finalShape.lineTo(d * 0.6, h * 0.12);
        finalShape.lineTo(d * 0.6, h * 0.75);
        finalShape.bezierCurveTo(d * 0.8, h * 0.82, d * 0.95, h * 0.9, d, h * 0.92);
        finalShape.lineTo(d, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'foundation_trim' || profileType === 'elevation_foundation_trim' || profileType === 'molding_foundation') {
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d, 0);
        finalShape.lineTo(d, h * 0.6);
        finalShape.lineTo(d * 0.3, h * 0.88);
        finalShape.lineTo(d * 0.3, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'beveled_trim' || profileType === 'chamfer_trim') {
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
        finalShape.lineTo(d, h * 0.6);
        finalShape.lineTo(d * 0.6, h * 0.8);
        finalShape.lineTo(d * 0.6, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else if (profileType === 'groove') {
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d, 0);
        finalShape.lineTo(d, h * 0.2);
        finalShape.lineTo(d * 0.5, h * 0.5);
        finalShape.lineTo(d, h * 0.8);
        finalShape.lineTo(d, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    } else {
        // Default flat band
        finalShape.moveTo(0, 0);
        finalShape.lineTo(d, 0);
        finalShape.lineTo(d, h);
        finalShape.lineTo(0, h);
        finalShape.lineTo(0, 0);
    }

    return finalShape;
};

/**
 * Calculates molding segmentation along the wall length to avoid doors and cutouts.
 * @param {number} wallLength
 * @param {number} heightOffset
 * @param {number} moldingHeight
 * @param {Object} wallEntity
 * @returns {Array<{start: number, end: number}>}
 */
export const calculateMoldingSegments = (wallLength, heightOffset, moldingHeight, wallEntity) => {
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
        const casingExt = isDoor ? (3.8 - 1.25) : 0; // 2.55 casing trim clearance
        const halfW = ((widg.width || 60) / 2) + casingExt;
        const wElev = widg.elevation !== undefined ? widg.elevation : (type === 'window' ? 80 : 0);
        const wH = widg.height !== undefined ? widg.height : (type === 'door' ? 210 : (type === 'window' ? 120 : 100));
        const wTop = wElev + wH;

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
};

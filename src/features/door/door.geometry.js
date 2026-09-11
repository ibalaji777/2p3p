import * as THREE from 'three';
import { MaterialSlots } from '../../core/constants/materialSlots.js';

/**
 * Creates 2D door shape outlines for square, radius arch, segment arch, and gothic arch.
 * @param {number} w - Door width
 * @param {number} h - Door height
 * @param {string} type - 'square' | 'radius' | 'arch' | 'segment' | 'gothic'
 * @param {number} halfSide - 0: full, -1: left half, 1: right half
 * @returns {THREE.Shape}
 */
export const createDoorShape = (w, h, type = 'square', halfSide = 0) => {
    const shape = new THREE.Shape();
    const hw = w / 2;
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    
    if (type === 'radius' || type === 'arch') {
        if (halfSide === 0) {
            const straightH = Math.max(0, h - hw);
            shape.lineTo(hw, straightH);
            if (hw > 0) shape.absarc(0, straightH, hw, 0, Math.PI, false);
        } else if (halfSide === -1) {
            const r = w;
            const straightH = Math.max(0, h - r);
            shape.lineTo(hw, h);
            if (r > 0) shape.absarc(hw, straightH, r, Math.PI / 2, Math.PI, false);
        } else if (halfSide === 1) {
            const r = w;
            const straightH = Math.max(0, h - r);
            shape.lineTo(hw, straightH);
            if (r > 0) shape.absarc(-hw, straightH, r, 0, Math.PI / 2, false);
        }
    } else if (type === 'segment') {
        if (halfSide === 0) {
            const rise = w * 0.15;
            const straightH = Math.max(0, h - rise);
            shape.lineTo(hw, straightH);
            shape.quadraticCurveTo(0, h + rise * 0.5, -hw, straightH);
        } else if (halfSide === -1) {
            const fullW = w * 2;
            const rise = fullW * 0.15;
            const straightH = Math.max(0, h - rise);
            shape.lineTo(hw, h);
            shape.quadraticCurveTo(0, (straightH + h) / 2 + rise * 0.25, -hw, straightH);
        } else if (halfSide === 1) {
            const fullW = w * 2;
            const rise = fullW * 0.15;
            const straightH = Math.max(0, h - rise);
            shape.lineTo(hw, straightH);
            shape.quadraticCurveTo(0, (straightH + h) / 2 + rise * 0.25, -hw, h);
        }
    } else if (type === 'gothic') {
        if (halfSide === 0) {
            const straightH = Math.max(0, h - (w * 0.7));
            shape.lineTo(hw, straightH);
            shape.quadraticCurveTo(hw * 0.2, h, 0, h);
            shape.quadraticCurveTo(-hw * 0.2, h, -hw, straightH);
        } else if (halfSide === -1) {
            const straightH = Math.max(0, h - (w * 1.4));
            shape.lineTo(hw, h);
            shape.quadraticCurveTo(w * 0.1, h, -hw, straightH);
        } else if (halfSide === 1) {
            const straightH = Math.max(0, h - (w * 1.4));
            shape.lineTo(hw, straightH);
            shape.quadraticCurveTo(-w * 0.1, h, -hw, h);
        }
    } else {
        shape.lineTo(hw, h);
        shape.lineTo(-hw, h);
    }
    shape.lineTo(-hw, 0);
    return shape;
};

/**
 * Calculates the top arch height at a given local X position on a door leaf.
 * @param {number} x - Local X in [-w/2, w/2]
 * @param {number} w - Leaf width
 * @param {number} h - Leaf height
 * @param {string} shapeType - 'square' | 'radius' | 'arch' | 'segment' | 'gothic'
 * @param {number} halfSide - 0: full, -1: left half, 1: right half
 * @returns {number} Top boundary Y at x
 */
export const getDoorArchHeightAtX = (x, w, h, shapeType = 'square', halfSide = 0) => {
    if (!shapeType || shapeType === 'square') return h;
    
    if (shapeType === 'radius' || shapeType === 'arch') {
        if (halfSide === 0) {
            const r = w / 2;
            const strH = Math.max(0, h - r);
            const dx = Math.min(r, Math.abs(x));
            return strH + Math.sqrt(Math.max(0, r * r - dx * dx));
        } else if (halfSide === -1) {
            const r = w;
            const strH = Math.max(0, h - r);
            const dx = Math.min(r, Math.max(0, w / 2 - x));
            return strH + Math.sqrt(Math.max(0, r * r - dx * dx));
        } else if (halfSide === 1) {
            const r = w;
            const strH = Math.max(0, h - r);
            const dx = Math.min(r, Math.max(0, x + w / 2));
            return strH + Math.sqrt(Math.max(0, r * r - dx * dx));
        }
    } else if (shapeType === 'segment') {
        const fullW = halfSide === 0 ? w : w * 2;
        const rise = fullW * 0.15;
        const strH = Math.max(0, h - rise);
        if (halfSide === 0) {
            const normX = x / (w / 2);
            return strH + rise * (1 - normX * normX);
        } else if (halfSide === -1) {
            const normX = (w / 2 - x) / w;
            return strH + rise * (1 - normX * normX);
        } else if (halfSide === 1) {
            const normX = (x + w / 2) / w;
            return strH + rise * (1 - normX * normX);
        }
    } else if (shapeType === 'gothic') {
        const fullW = halfSide === 0 ? w : w * 2;
        const strH = Math.max(0, h - (fullW * 0.7));
        const r = fullW * 0.7;
        if (halfSide === 0) {
            const dx = Math.abs(x);
            return strH + Math.sqrt(Math.max(0, r * r - dx * dx));
        } else if (halfSide === -1) {
            const dx = Math.max(0, w / 2 - x);
            return strH + Math.sqrt(Math.max(0, r * r - dx * dx));
        } else if (halfSide === 1) {
            const dx = Math.max(0, x + w / 2);
            return strH + Math.sqrt(Math.max(0, r * r - dx * dx));
        }
    }
    return h;
};

/**
 * Creates an arched hole path (clockwise winding) in leaf coordinates.
 */
export const createArchedHolePath = (xLeft, xRight, yStart, h, w, shapeType = 'square', halfSide = 0, frameW = 4.0) => {
    const hole = new THREE.Path();
    hole.moveTo(xLeft, yStart);

    if (shapeType === 'radius' || shapeType === 'arch') {
        if (halfSide === 0) {
            const r = w / 2;
            const rInner = Math.max(0.1, r - frameW);
            const strH = Math.max(yStart, h - r);
            hole.lineTo(xLeft, strH);
            hole.absarc(0, strH, rInner, Math.PI, 0, true);
            hole.lineTo(xRight, yStart);
        } else if (halfSide === -1) {
            const r = w;
            const rInner = Math.max(0.1, r - frameW);
            const strH = Math.max(yStart, h - r);
            const dxRight = Math.max(0, w / 2 - xRight);
            const thetaEnd = Math.PI / 2 + Math.asin(Math.min(1, Math.max(0, dxRight / rInner)));
            hole.lineTo(xLeft, strH);
            hole.absarc(w / 2, h - r, rInner, Math.PI, thetaEnd, true);
            hole.lineTo(xRight, yStart);
        } else if (halfSide === 1) {
            const r = w;
            const rInner = Math.max(0.1, r - frameW);
            const strH = Math.max(yStart, h - r);
            const dxLeft = Math.max(0, xLeft - (-w / 2));
            const thetaStart = Math.PI / 2 - Math.asin(Math.min(1, Math.max(0, dxLeft / rInner)));
            hole.lineTo(xLeft, (h - r) + rInner * Math.sin(thetaStart));
            hole.absarc(-w / 2, h - r, rInner, thetaStart, 0, true);
            hole.lineTo(xRight, yStart);
        }
    } else if (shapeType === 'segment') {
        const fullW = halfSide === 0 ? w : w * 2;
        const rise = fullW * 0.15;
        const strH = Math.max(yStart, h - rise);
        if (halfSide === 0) {
            hole.lineTo(xLeft, strH);
            hole.quadraticCurveTo(0, h - frameW + rise * 0.5, xRight, strH);
            hole.lineTo(xRight, yStart);
        } else if (halfSide === -1) {
            hole.lineTo(xLeft, strH);
            hole.quadraticCurveTo(0, (strH + h - frameW) / 2 + rise * 0.25, xRight, h - frameW);
            hole.lineTo(xRight, yStart);
        } else if (halfSide === 1) {
            hole.lineTo(xLeft, h - frameW);
            hole.quadraticCurveTo(0, (strH + h - frameW) / 2 + rise * 0.25, xRight, strH);
            hole.lineTo(xRight, yStart);
        }
    } else if (shapeType === 'gothic') {
        const fullW = halfSide === 0 ? w : w * 2;
        const strH = Math.max(yStart, h - (fullW * 0.7));
        if (halfSide === 0) {
            hole.lineTo(xLeft, strH);
            hole.quadraticCurveTo(-xLeft * 0.2, h - frameW, 0, h - frameW);
            hole.quadraticCurveTo(xRight * 0.2, h - frameW, xRight, strH);
            hole.lineTo(xRight, yStart);
        } else if (halfSide === -1) {
            hole.lineTo(xLeft, strH);
            hole.quadraticCurveTo(w * 0.1, h - frameW, xRight, h - frameW);
            hole.lineTo(xRight, yStart);
        } else if (halfSide === 1) {
            hole.lineTo(xLeft, h - frameW);
            hole.quadraticCurveTo(-w * 0.1, h - frameW, xRight, strH);
            hole.lineTo(xRight, yStart);
        }
    } else {
        hole.lineTo(xLeft, h - frameW);
        hole.lineTo(xRight, h - frameW);
        hole.lineTo(xRight, yStart);
    }
    hole.lineTo(xLeft, yStart);
    return hole;
};

/**
 * Creates an arched panel shape (counter-clockwise winding) in leaf coordinates.
 */
export const createArchedPanelShape = (xLeft, xRight, yStart, h, w, shapeType = 'square', halfSide = 0, frameW = 4.0) => {
    const shape = new THREE.Shape();
    shape.moveTo(xLeft, yStart);
    shape.lineTo(xRight, yStart);

    if (shapeType === 'radius' || shapeType === 'arch') {
        if (halfSide === 0) {
            const r = w / 2;
            const rInner = Math.max(0.1, r - frameW);
            const strH = Math.max(yStart, h - r);
            shape.lineTo(xRight, strH);
            shape.absarc(0, strH, rInner, 0, Math.PI, false);
            shape.lineTo(xLeft, yStart);
        } else if (halfSide === -1) {
            const r = w;
            const rInner = Math.max(0.1, r - frameW);
            const strH = Math.max(yStart, h - r);
            const dxRight = Math.max(0, w / 2 - xRight);
            const thetaEnd = Math.PI / 2 + Math.asin(Math.min(1, Math.max(0, dxRight / rInner)));
            shape.lineTo(xRight, (h - r) + rInner * Math.sin(thetaEnd));
            shape.absarc(w / 2, h - r, rInner, thetaEnd, Math.PI, false);
            shape.lineTo(xLeft, yStart);
        } else if (halfSide === 1) {
            const r = w;
            const rInner = Math.max(0.1, r - frameW);
            const strH = Math.max(yStart, h - r);
            const dxLeft = Math.max(0, xLeft - (-w / 2));
            const thetaStart = Math.PI / 2 - Math.asin(Math.min(1, Math.max(0, dxLeft / rInner)));
            shape.lineTo(xRight, strH);
            shape.absarc(-w / 2, h - r, rInner, 0, thetaStart, false);
            shape.lineTo(xLeft, yStart);
        }
    } else if (shapeType === 'segment') {
        const fullW = halfSide === 0 ? w : w * 2;
        const rise = fullW * 0.15;
        const strH = Math.max(yStart, h - rise);
        if (halfSide === 0) {
            shape.lineTo(xRight, strH);
            shape.quadraticCurveTo(0, h - frameW + rise * 0.5, xLeft, strH);
            shape.lineTo(xLeft, yStart);
        } else if (halfSide === -1) {
            shape.lineTo(xRight, h - frameW);
            shape.quadraticCurveTo(0, (strH + h - frameW) / 2 + rise * 0.25, xLeft, strH);
            shape.lineTo(xLeft, yStart);
        } else if (halfSide === 1) {
            shape.lineTo(xRight, strH);
            shape.quadraticCurveTo(0, (strH + h - frameW) / 2 + rise * 0.25, xLeft, h - frameW);
            shape.lineTo(xLeft, yStart);
        }
    } else if (shapeType === 'gothic') {
        const fullW = halfSide === 0 ? w : w * 2;
        const strH = Math.max(yStart, h - (fullW * 0.7));
        if (halfSide === 0) {
            shape.lineTo(xRight, strH);
            shape.quadraticCurveTo(xRight * 0.2, h - frameW, 0, h - frameW);
            shape.quadraticCurveTo(-xLeft * 0.2, h - frameW, xLeft, strH);
            shape.lineTo(xLeft, yStart);
        } else if (halfSide === -1) {
            shape.lineTo(xRight, h - frameW);
            shape.quadraticCurveTo(w * 0.1, h - frameW, xLeft, strH);
            shape.lineTo(xLeft, yStart);
        } else if (halfSide === 1) {
            shape.lineTo(xRight, strH);
            shape.quadraticCurveTo(-w * 0.1, h - frameW, xLeft, h - frameW);
            shape.lineTo(xLeft, yStart);
        }
    } else {
        shape.lineTo(xRight, h - frameW);
        shape.lineTo(xLeft, h - frameW);
        shape.lineTo(xLeft, yStart);
    }
    return shape;
};

/**
 * Creates beveled rectangular extruded geometry with normalized UVs.
 */
export const createBeveledRect = (w, h, depth) => {
    const shape = new THREE.Shape();
    const hw = w / 2, hh = h / 2;
    shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
    const bSize = 0.08; const bThick = 0.06;
    const d = Math.max(0.01, depth - bThick * 2);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: bSize, bevelThickness: bThick });
    geo.translate(0, 0, -d / 2);
    const uvs = geo.attributes.uv; const pos = geo.attributes.position;
    if (uvs && pos) {
        for (let i = 0; i < uvs.count; i++) {
            uvs.setXY(i, (pos.getX(i) + hw) / w, (pos.getY(i) + hh) / h);
        }
        uvs.needsUpdate = true;
    }
    return geo;
};

/**
 * Creates beveled extruded geometry with configurable bevel size.
 */
export const createBeveledExtrude = (w, h, d, b = 0.04) => {
    const wAdj = Math.max(0.01, w - b * 2);
    const hAdj = Math.max(0.01, h - b * 2);
    const shape = new THREE.Shape(); const hw = wAdj / 2, hh = hAdj / 2;
    shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
    const dAdj = Math.max(0.01, d - b * 2);
    const ex = new THREE.ExtrudeGeometry(shape, { depth: dAdj, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: b, bevelThickness: b });
    ex.translate(0, 0, -dAdj / 2);
    const uvs = ex.attributes.uv, pos = ex.attributes.position;
    if (uvs && pos) {
        for (let i = 0; i < uvs.count; i++) {
            uvs.setXY(i, (pos.getX(i) + hw) / wAdj, (pos.getY(i) + hh) / hAdj);
        }
        uvs.needsUpdate = true;
    }
    return ex;
};

/**
 * Normalizes UV coordinates on ExtrudeGeometry to [0, 1] range to prevent extreme texture tiling.
 */
export const normalizeExtrudeUVs = (geo, w, h, depth, minX, minY) => {
    if (!geo || !geo.attributes || !geo.attributes.uv || !geo.attributes.position) return geo;
    const uvs = geo.attributes.uv;
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;

    let bMinX = minX;
    let bMinY = minY;
    let width = w;
    let height = h;
    let d = depth;

    if (width === undefined || height === undefined || bMinX === undefined || bMinY === undefined) {
        if (!geo.boundingBox) geo.computeBoundingBox();
        const bbox = geo.boundingBox;
        bMinX = bMinX !== undefined ? bMinX : bbox.min.x;
        bMinY = bMinY !== undefined ? bMinY : bbox.min.y;
        width = width !== undefined ? width : Math.max(0.01, bbox.max.x - bbox.min.x);
        height = height !== undefined ? height : Math.max(0.01, bbox.max.y - bbox.min.y);
        d = d !== undefined ? d : Math.max(0.01, bbox.max.z - bbox.min.z);
    }

    const halfD = (d || 1) / 2;

    for (let i = 0; i < uvs.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const nz = norm ? norm.getZ(i) : 1;

        if (Math.abs(nz) > 0.3) {
            // Cap faces (front and back)
            uvs.setXY(i, (vx - bMinX) / width, (vy - bMinY) / height);
        } else {
            // Side extrusion / bevel faces
            uvs.setXY(i, (vz + halfD) / (d || 1), (vy - bMinY) / height);
        }
    }
    uvs.needsUpdate = true;
    return geo;
};

/**
 * Rotates UV coordinates 90 degrees for procedural horizontal grain alignment.
 */
export const rotateUVs = (geo) => {
    const uvs = geo.attributes.uv;
    if (uvs) {
        for (let i = 0; i < uvs.count; i++) {
            const u = uvs.getX(i) - 0.5; const v = uvs.getY(i) - 0.5;
            uvs.setXY(i, -v + 0.5, u + 0.5); // 90 degree rotation
        }
        uvs.needsUpdate = true;
    }
    return geo;
};

/**
 * Builds detailed 3D door panels according to architectural styles.
 */
export function buildDetailedDoorPanel(entity, width, height, thickness, material, type, isGlass, signX = 1, helpers, builder) {
    const mats = (helpers && helpers.getFaceMaterials) ? helpers.getFaceMaterials(entity, material, { width, height, thick: thickness }).box : material;
    const group = new THREE.Group();
    const style = entity && entity.doorStyle ? entity.doorStyle : 'flat';
    const shapeType = entity && entity.doorShape ? entity.doorShape : 'square';
    const isArched = shapeType !== 'square';
    const halfSide = (entity && ['double', 'french', 'double_french'].includes(entity.doorType)) ? -signX : 0;

    const matsExtrude = Array.isArray(mats) ? [mats[4], mats[1]] : mats;

    if (isArched) {
        const hAdjust = 0.05;
        const leafH = Math.max(0.1, height - hAdjust);

        if (isGlass || ['french', 'double_french'].includes(entity.doorType) || style === 'door_glass' || style === 'patio_french_glass' || style === 'glass_grid') {
            const frameW = Math.min(4.0, width * 0.15);
            const yStart = 6.0;
            const xLeft = -width / 2 + frameW;
            const xRight = width / 2 - frameW;

            const frameShape = createDoorShape(width, leafH, shapeType, halfSide);
            const glassHole = createArchedHolePath(xLeft, xRight, yStart, leafH, width, shapeType, halfSide, frameW);
            frameShape.holes.push(glassHole);

            const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
                depth: thickness,
                bevelEnabled: true,
                bevelSegments: 3,
                steps: 1,
                bevelSize: 0.04,
                bevelThickness: 0.04
            });
            frameGeo.translate(0, 0, -thickness / 2);
            normalizeExtrudeUVs(frameGeo, width, leafH, thickness, -width / 2, 0);
            builder.addNode({ geometry: frameGeo, materialOverride: matsExtrude, parent: group, castShadow: true, receiveShadow: true });

            const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';
            const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
            const glassShape = createArchedPanelShape(xLeft, xRight, yStart, leafH, width, shapeType, halfSide, frameW);
            const glassGeo = new THREE.ExtrudeGeometry(glassShape, { depth: 0.4, bevelEnabled: false });
            glassGeo.translate(0, 0, -0.2);
            normalizeExtrudeUVs(glassGeo, xRight - xLeft, leafH - yStart, 0.4, xLeft, yStart);
            builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, position: new THREE.Vector3(0, 0, 0), isGlass: true, slot: MaterialSlots.GLASS });

            if (style === 'glass_grid' || style === 'patio_french_glass' || entity.doorType === 'french') {
                const glassW = xRight - xLeft;
                const numRows = 4;
                const barSize = 1.0;
                const totalGlassH = leafH - yStart - frameW;
                for (let r = 1; r < numRows; r++) {
                    const rowY = yStart + (totalGlassH / numRows) * r;
                    const barGeo = rotateUVs(createBeveledRect(glassW, barSize, thickness * 0.65));
                    builder.addNode({ geometry: barGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, rowY, 0), castShadow: true, receiveShadow: true });
                }
                const colH = totalGlassH * 0.95;
                const barGeo = createBeveledRect(barSize, colH, thickness * 0.65);
                builder.addNode({ geometry: barGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, yStart + colH / 2, 0), castShadow: true, receiveShadow: true });
            }
        } else if (style === 'classic_2_panel' || style === 'classic_4_horizontal' || style === 'shaker_multi_panel' || style === 'door_pvc' || style === 'door_wpc' || style === 'door_composite') {
            const frameW = Math.min(4.0, width * 0.16);
            const botRailH = 6.0;
            const midRailH = 4.5;
            const midY = height * 0.42;

            const xLeft = -width / 2 + frameW;
            const xRight = width / 2 - frameW;
            const yBot = botRailH;
            const yMidBot = midY - midRailH / 2;
            const yStart = midY + midRailH / 2;

            // Frame with holes
            const frameShape = createDoorShape(width, leafH, shapeType, halfSide);
            const botHole = new THREE.Path();
            botHole.moveTo(xLeft, yMidBot);
            botHole.lineTo(xRight, yMidBot);
            botHole.lineTo(xRight, yBot);
            botHole.lineTo(xLeft, yBot);
            botHole.lineTo(xLeft, yMidBot);

            const topHole = createArchedHolePath(xLeft, xRight, yStart, leafH, width, shapeType, halfSide, frameW);
            frameShape.holes.push(botHole, topHole);

            const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
                depth: thickness,
                bevelEnabled: true,
                bevelSegments: 3,
                steps: 1,
                bevelSize: 0.04,
                bevelThickness: 0.04
            });
            frameGeo.translate(0, 0, -thickness / 2);
            normalizeExtrudeUVs(frameGeo, width, leafH, thickness, -width / 2, 0);
            builder.addNode({ geometry: frameGeo, materialOverride: matsExtrude, parent: group, castShadow: true, receiveShadow: true });

            // Recessed Bottom Panel
            const botPanelH = yMidBot - yBot;
            const botPanelW = xRight - xLeft;
            const botGeo = createBeveledRect(botPanelW, botPanelH, thickness * 0.55);
            builder.addNode({ geometry: botGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, yBot + botPanelH / 2, 0), castShadow: true, receiveShadow: true });

            // Recessed Top Arched Panel
            const topPanelShape = createArchedPanelShape(xLeft, xRight, yStart, leafH, width, shapeType, halfSide, frameW);
            const topGeo = new THREE.ExtrudeGeometry(topPanelShape, {
                depth: thickness * 0.55,
                bevelEnabled: true,
                bevelSegments: 3,
                steps: 1,
                bevelSize: 0.04,
                bevelThickness: 0.04
            });
            topGeo.translate(0, 0, -thickness * 0.55 / 2);
            normalizeExtrudeUVs(topGeo, botPanelW, leafH - yStart, thickness * 0.55, xLeft, yStart);
            builder.addNode({ geometry: topGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, 0, 0), castShadow: true, receiveShadow: true });
        } else if (style === 'classic_4_panel' || style === 'door_frp') {
            const frameW = Math.min(3.5, width * 0.14);
            const midStileW = 3.0;
            const botRailH = 6.0;
            const midRailH = 4.5;
            const midY = height * 0.42;

            const xLeft1 = -width / 2 + frameW;
            const xRight1 = -midStileW / 2;
            const xLeft2 = midStileW / 2;
            const xRight2 = width / 2 - frameW;
            const yBot = botRailH;
            const yMidBot = midY - midRailH / 2;
            const yStart = midY + midRailH / 2;

            const frameShape = createDoorShape(width, leafH, shapeType, halfSide);
            const botHole1 = new THREE.Path();
            botHole1.moveTo(xLeft1, yMidBot); botHole1.lineTo(xRight1, yMidBot); botHole1.lineTo(xRight1, yBot); botHole1.lineTo(xLeft1, yBot); botHole1.lineTo(xLeft1, yMidBot);
            const botHole2 = new THREE.Path();
            botHole2.moveTo(xLeft2, yMidBot); botHole2.lineTo(xRight2, yMidBot); botHole2.lineTo(xRight2, yBot); botHole2.lineTo(xLeft2, yBot); botHole2.lineTo(xLeft2, yMidBot);

            const topHole = createArchedHolePath(-width / 2 + frameW, width / 2 - frameW, yStart, leafH, width, shapeType, halfSide, frameW);
            frameShape.holes.push(botHole1, botHole2, topHole);

            const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
                depth: thickness,
                bevelEnabled: true,
                bevelSegments: 3,
                steps: 1,
                bevelSize: 0.04,
                bevelThickness: 0.04
            });
            frameGeo.translate(0, 0, -thickness / 2);
            normalizeExtrudeUVs(frameGeo, width, leafH, thickness, -width / 2, 0);
            builder.addNode({ geometry: frameGeo, materialOverride: matsExtrude, parent: group, castShadow: true, receiveShadow: true });

            const pW = xRight1 - xLeft1;
            const pH = yMidBot - yBot;
            const botGeo1 = createBeveledRect(pW, pH, thickness * 0.55);
            builder.addNode({ geometry: botGeo1, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3((xLeft1 + xRight1) / 2, yBot + pH / 2, 0), castShadow: true, receiveShadow: true });
            const botGeo2 = createBeveledRect(pW, pH, thickness * 0.55);
            builder.addNode({ geometry: botGeo2, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3((xLeft2 + xRight2) / 2, yBot + pH / 2, 0), castShadow: true, receiveShadow: true });

            const topPanelShape = createArchedPanelShape(-width / 2 + frameW, width / 2 - frameW, yStart, leafH, width, shapeType, halfSide, frameW);
            const topGeo = new THREE.ExtrudeGeometry(topPanelShape, { depth: thickness * 0.55, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 });
            topGeo.translate(0, 0, -thickness * 0.55 / 2);
            normalizeExtrudeUVs(topGeo, width - frameW * 2, leafH - yStart, thickness * 0.55, -width / 2 + frameW, yStart);
            builder.addNode({ geometry: topGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, 0, 0), castShadow: true, receiveShadow: true });

            const topOpenH = leafH - yStart - frameW;
            const mulGeo = createBeveledRect(midStileW, topOpenH * 0.9, thickness);
            builder.addNode({ geometry: mulGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, yStart + topOpenH * 0.45, 0), castShadow: true, receiveShadow: true });
        } else if (style === 'entry_grand_panel') {
            const frameW = Math.min(4.5, width * 0.15);
            const xLeft = -width / 2 + frameW;
            const xRight = width / 2 - frameW;
            const yStart = 6.0;

            const frameShape = createDoorShape(width, leafH, shapeType, halfSide);
            const grandHole = createArchedHolePath(xLeft, xRight, yStart, leafH, width, shapeType, halfSide, frameW);
            frameShape.holes.push(grandHole);

            const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: thickness, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 });
            frameGeo.translate(0, 0, -thickness / 2);
            normalizeExtrudeUVs(frameGeo, width, leafH, thickness, -width / 2, 0);
            builder.addNode({ geometry: frameGeo, materialOverride: matsExtrude, parent: group, castShadow: true, receiveShadow: true });

            const grandPanelShape = createArchedPanelShape(xLeft, xRight, yStart, leafH, width, shapeType, halfSide, frameW);
            const grandGeo = new THREE.ExtrudeGeometry(grandPanelShape, { depth: thickness * 0.55, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 });
            grandGeo.translate(0, 0, -thickness * 0.55 / 2);
            normalizeExtrudeUVs(grandGeo, xRight - xLeft, leafH - yStart, thickness * 0.55, xLeft, yStart);
            builder.addNode({ geometry: grandGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, 0, 0), castShadow: true, receiveShadow: true });

            const raisedW = frameW + 3.0;
            const raisedShape = createArchedPanelShape(-width / 2 + raisedW, width / 2 - raisedW, yStart + 4.0, leafH - 4.0, width, shapeType, halfSide, raisedW);
            const raisedGeo = new THREE.ExtrudeGeometry(raisedShape, { depth: thickness * 0.85, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.05, bevelThickness: 0.05 });
            raisedGeo.translate(0, 0, -thickness * 0.85 / 2);
            normalizeExtrudeUVs(raisedGeo, width - raisedW * 2, leafH - yStart - 4.0, thickness * 0.85, -width / 2 + raisedW, yStart + 4.0);
            builder.addNode({ geometry: raisedGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, 0, 0), castShadow: true, receiveShadow: true });
        } else if (style === 'glass_bottom_panel' || style === 'back_half_lite' || style === 'office_glass_lite' || style === 'entry_craftsman') {
            const frameW = Math.min(4.0, width * 0.15);
            const botRailH = 6.0;
            const midRailH = 4.5;
            const midY = height * 0.45;

            const xLeft = -width / 2 + frameW;
            const xRight = width / 2 - frameW;
            const yBot = botRailH;
            const yMidBot = midY - midRailH / 2;
            const yStart = midY + midRailH / 2;

            const frameShape = createDoorShape(width, leafH, shapeType, halfSide);
            const botHole = new THREE.Path();
            botHole.moveTo(xLeft, yMidBot); botHole.lineTo(xRight, yMidBot); botHole.lineTo(xRight, yBot); botHole.lineTo(xLeft, yBot); botHole.lineTo(xLeft, yMidBot);
            const topGlassHole = createArchedHolePath(xLeft, xRight, yStart, leafH, width, shapeType, halfSide, frameW);
            frameShape.holes.push(botHole, topGlassHole);

            const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
                depth: thickness,
                bevelEnabled: true,
                bevelSegments: 3,
                steps: 1,
                bevelSize: 0.04,
                bevelThickness: 0.04
            });
            frameGeo.translate(0, 0, -thickness / 2);
            normalizeExtrudeUVs(frameGeo, width, leafH, thickness, -width / 2, 0);
            builder.addNode({ geometry: frameGeo, materialOverride: matsExtrude, parent: group, castShadow: true, receiveShadow: true });

            const botPanelH = yMidBot - yBot;
            const botPanelW = xRight - xLeft;
            const botGeo = createBeveledRect(botPanelW, botPanelH, thickness * 0.55);
            builder.addNode({ geometry: botGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, yBot + botPanelH / 2, 0), castShadow: true, receiveShadow: true });

            const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';
            const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
            const glassShape = createArchedPanelShape(xLeft, xRight, yStart, leafH, width, shapeType, halfSide, frameW);
            const glassGeo = new THREE.ExtrudeGeometry(glassShape, { depth: 0.4, bevelEnabled: false });
            glassGeo.translate(0, 0, -0.2);
            normalizeExtrudeUVs(glassGeo, xRight - xLeft, leafH - yStart, 0.4, xLeft, yStart);
            builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, position: new THREE.Vector3(0, 0, 0), isGlass: true, slot: MaterialSlots.GLASS });
        } else if (style === 'modern_grooved') {
            const doorOutline = createDoorShape(width, leafH, shapeType, halfSide);
            const coreGeo = new THREE.ExtrudeGeometry(doorOutline, {
                depth: thickness,
                bevelEnabled: true,
                bevelSegments: 3,
                steps: 1,
                bevelSize: 0.06,
                bevelThickness: 0.06
            });
            coreGeo.translate(0, 0, -thickness / 2);
            normalizeExtrudeUVs(coreGeo, width, leafH, thickness, -width / 2, 0);
            builder.addNode({ geometry: coreGeo, materialOverride: matsExtrude, parent: group, castShadow: true, receiveShadow: true });

            const numPanels = 5;
            const grooveH = 0.6;
            const panelH = (leafH - grooveH * (numPanels - 1)) / numPanels;
            for (let i = 1; i < numPanels; i++) {
                const grooveY = i * (panelH + grooveH);
                const grooveGeo = rotateUVs(createBeveledRect(width * 0.95, grooveH, thickness * 1.08));
                builder.addNode({ geometry: grooveGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, grooveY, 0), castShadow: true, receiveShadow: true });
            }
        } else {
            // Default Arched Solid Body
            const doorOutline = createDoorShape(width, leafH, shapeType, halfSide);
            const coreGeo = new THREE.ExtrudeGeometry(doorOutline, {
                depth: thickness,
                bevelEnabled: true,
                bevelSegments: 3,
                steps: 1,
                bevelSize: 0.06,
                bevelThickness: 0.06
            });
            coreGeo.translate(0, 0, -thickness / 2);
            normalizeExtrudeUVs(coreGeo, width, leafH, thickness, -width / 2, 0);
            builder.addNode({ geometry: coreGeo, materialOverride: matsExtrude, parent: group, castShadow: true, receiveShadow: true });
        }
    } else if (style === 'modern_grooved') {
        const numPanels = 5;
        const grooveSize = 0.4;
        const panelH = (height - (grooveSize * (numPanels - 1))) / numPanels;
        for (let i = 0; i < numPanels; i++) {
            const geoPanel = createBeveledRect(width, panelH, thickness);
            const yPos = panelH / 2 + i * (panelH + grooveSize);
            builder.addNode({ geometry: geoPanel, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, yPos, 0), castShadow: true, receiveShadow: true });
        }
        const coreGeo = new THREE.BoxGeometry(width - 1, height - 1, thickness - 0.4);
        builder.addNode({ geometry: coreGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height / 2, 0) });
    } else if (style === 'louvered_half') {
        const frameW = 4; const topRailH = 4; const midRailH = 4; const botRailH = 6;
        const geoStile = createBeveledRect(frameW, height, thickness); 
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness)); 
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width - frameW * 2, midRailH, thickness));
        
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height / 2, 0), castShadow: true, receiveShadow: true });
        
        const botPanelH = (height / 2 - midRailH / 2) - botRailH;
        const panelGeo = createBeveledRect(width - frameW * 2, botPanelH, thickness * 0.6);
        builder.addNode({ geometry: panelGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + botPanelH / 2, 0), castShadow: true, receiveShadow: true });
        
        const topOpeningH = (height - topRailH) - (height / 2 + midRailH / 2);
        const louverW = width - frameW * 2 + 0.5;
        const louverGeo = rotateUVs(createBeveledRect(louverW, 0.4, thickness * 0.5));
        const numLouvers = Math.floor(topOpeningH / 1.2);
        const louverSpacing = topOpeningH / numLouvers;
        const louverStartY = height / 2 + midRailH / 2 + louverSpacing / 2;
        
        for (let i = 0; i < numLouvers; i++) {
            builder.addNode({ geometry: louverGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, louverStartY + i * louverSpacing, 0), rotation: new THREE.Euler(Math.PI / 6, 0, 0), castShadow: true, receiveShadow: true });
        }
    } else if (style === 'office_glass_lite') {
        const frameW = 4.5; const topRailH = 4.5; const botRailH = 6; const mullionH = 2; const numLites = 4;
        const geoStile = createBeveledRect(frameW, height, thickness); 
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness)); 
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));
        const geoMullion = rotateUVs(createBeveledRect(width - frameW * 2, mullionH, thickness));
        
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });
        
        const totalGlassH = height - topRailH - botRailH - mullionH * (numLites - 1);
        const liteH = totalGlassH / numLites;
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        
        for (let i = 0; i < numLites; i++) {
            const liteY = botRailH + liteH / 2 + i * (liteH + mullionH);
            const glassGeo = new THREE.BoxGeometry(width - frameW * 2, liteH, 0.4);
            builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, position: new THREE.Vector3(0, liteY, 0), isGlass: true, slot: MaterialSlots.GLASS });
            if (i < numLites - 1) {
                const mulY = botRailH + liteH * (i + 1) + mullionH * i + mullionH / 2;
                builder.addNode({ geometry: geoMullion, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, mulY, 0), castShadow: true, receiveShadow: true });
            }
        }
    } else if (style === 'shaker_multi_panel') {
        const frameW = 4.5; const topRailH = 4.5; const botRailH = 6; const numPanels = 5; const mullionH = 2.5;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));
        const geoMullion = rotateUVs(createBeveledRect(width - frameW * 2, mullionH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });

        const totalPanelH = height - topRailH - botRailH - mullionH * (numPanels - 1);
        const pHeight = totalPanelH / numPanels;

        for (let i = 0; i < numPanels; i++) {
            const pY = botRailH + pHeight / 2 + i * (pHeight + mullionH);
            const pGeo = createBeveledRect(width - frameW * 2, pHeight, thickness * 0.5);
            builder.addNode({ geometry: pGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, pY, 0), castShadow: true, receiveShadow: true });
            if (i < numPanels - 1) {
                const mY = botRailH + pHeight * (i + 1) + mullionH * i + mullionH / 2;
                builder.addNode({ geometry: geoMullion, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, mY, 0), castShadow: true, receiveShadow: true });
            }
        }
    } else if (style === 'utility_vision') {
        const frameW = 4; const topRailH = 4; const botRailH = 6;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });

        const midH = height - topRailH - botRailH;
        const panelGeo = createBeveledRect(width - frameW * 2, midH, thickness * 0.6);
        builder.addNode({ geometry: panelGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + midH / 2, 0), castShadow: true, receiveShadow: true });

        const slitW = 4; const slitH = 25;
        const slitX = (width / 2 - frameW - slitW / 2 - 4) * signX;
        const slitY = height * 0.65;
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const glassGeo = new THREE.BoxGeometry(slitW, slitH, 0.4);
        builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, position: new THREE.Vector3(slitX, slitY, 0), isGlass: true, slot: MaterialSlots.GLASS });

        const slitBevel = createBeveledRect(slitW + 1, slitH + 1, thickness * 0.8);
        builder.addNode({ geometry: slitBevel, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(slitX, slitY, 0), castShadow: true, receiveShadow: true });
    } else if (style === 'classic_4_horizontal') {
        const frameW = 4.5; const topRailH = 4.5; const botRailH = 6; const numPanels = 4; const mullionH = 3;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));
        const geoMullion = rotateUVs(createBeveledRect(width - frameW * 2, mullionH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });

        const totalPanelH = height - topRailH - botRailH - mullionH * (numPanels - 1);
        const pHeight = totalPanelH / numPanels;

        for (let i = 0; i < numPanels; i++) {
            const pY = botRailH + pHeight / 2 + i * (pHeight + mullionH);
            const pGeo = createBeveledRect(width - frameW * 2, pHeight, thickness * 0.6);
            builder.addNode({ geometry: pGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, pY, 0), castShadow: true, receiveShadow: true });
            if (i < numPanels - 1) {
                const mY = botRailH + pHeight * (i + 1) + mullionH * i + mullionH / 2;
                builder.addNode({ geometry: geoMullion, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, mY, 0), castShadow: true, receiveShadow: true });
            }
        }
    } else if (style === 'classic_2_panel') {
        const frameW = 4.5; const topRailH = 4.5; const botRailH = 6; const midRailH = 5;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width - frameW * 2, midRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height * 0.4, 0), castShadow: true, receiveShadow: true });

        const botPanelH = height * 0.4 - midRailH / 2 - botRailH;
        const topPanelH = height - topRailH - (height * 0.4 + midRailH / 2);

        const geoBotP = createBeveledRect(width - frameW * 2, botPanelH, thickness * 0.6);
        const geoTopP = createBeveledRect(width - frameW * 2, topPanelH, thickness * 0.6);

        builder.addNode({ geometry: geoBotP, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + botPanelH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoTopP, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height * 0.4 + midRailH / 2 + topPanelH / 2, 0), castShadow: true, receiveShadow: true });
    } else if (style === 'classic_4_panel') {
        const frameW = 4.5; const topRailH = 4.5; const botRailH = 6; const midRailH = 4.5; const midStileW = 3.5;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width - frameW * 2, midRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height * 0.42, 0), castShadow: true, receiveShadow: true });

        const botPanelH = height * 0.42 - midRailH / 2 - botRailH;
        const topPanelH = height - topRailH - (height * 0.42 + midRailH / 2);
        const panelW = (width - frameW * 2 - midStileW) / 2;

        const geoMidStileB = createBeveledRect(midStileW, botPanelH, thickness);
        const geoMidStileT = createBeveledRect(midStileW, topPanelH, thickness);
        builder.addNode({ geometry: geoMidStileB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + botPanelH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoMidStileT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height * 0.42 + midRailH / 2 + topPanelH / 2, 0), castShadow: true, receiveShadow: true });

        const geoBotP = createBeveledRect(panelW, botPanelH, thickness * 0.6);
        const geoTopP = createBeveledRect(panelW, topPanelH, thickness * 0.6);

        const xLeft = -panelW / 2 - midStileW / 2;
        const xRight = panelW / 2 + midStileW / 2;

        builder.addNode({ geometry: geoBotP, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(xLeft, botRailH + botPanelH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoBotP, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(xRight, botRailH + botPanelH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoTopP, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(xLeft, height * 0.42 + midRailH / 2 + topPanelH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoTopP, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(xRight, height * 0.42 + midRailH / 2 + topPanelH / 2, 0), castShadow: true, receiveShadow: true });
    } else if (style === 'grid_panel') {
        const frameW = 4; const topRailH = 4; const botRailH = 5; const gridRows = 5; const gridCols = 2; const barSize = 1.5;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });

        const openW = width - frameW * 2;
        const openH = height - topRailH - botRailH;
        const pW = (openW - barSize * (gridCols - 1)) / gridCols;
        const pH = (openH - barSize * (gridRows - 1)) / gridRows;

        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                const px = -openW / 2 + pW / 2 + c * (pW + barSize);
                const py = botRailH + pH / 2 + r * (pH + barSize);
                const pGeo = createBeveledRect(pW, pH, thickness * 0.55);
                builder.addNode({ geometry: pGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(px, py, 0), castShadow: true, receiveShadow: true });
            }
        }
        for (let r = 1; r < gridRows; r++) {
            const barGeo = rotateUVs(createBeveledRect(openW, barSize, thickness));
            builder.addNode({ geometry: barGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + r * (pH + barSize) - barSize / 2, 0), castShadow: true, receiveShadow: true });
        }
        for (let c = 1; c < gridCols; c++) {
            const barGeo = createBeveledRect(barSize, openH, thickness);
            builder.addNode({ geometry: barGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-openW / 2 + c * (pW + barSize) - barSize / 2, botRailH + openH / 2, 0), castShadow: true, receiveShadow: true });
        }
    } else if (style === 'glass_bottom_panel') {
        const frameW = 4.5; const topRailH = 4.5; const botRailH = 6; const midRailH = 4.5;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width - frameW * 2, midRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height * 0.35, 0), castShadow: true, receiveShadow: true });

        const botPanelH = height * 0.35 - midRailH / 2 - botRailH;
        const geoBotP = createBeveledRect(width - frameW * 2, botPanelH, thickness * 0.6);
        builder.addNode({ geometry: geoBotP, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + botPanelH / 2, 0), castShadow: true, receiveShadow: true });

        const glassH = height - topRailH - (height * 0.35 + midRailH / 2);
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const glassGeo = new THREE.BoxGeometry(width - frameW * 2, glassH, 0.4);
        builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, position: new THREE.Vector3(0, height * 0.35 + midRailH / 2 + glassH / 2, 0), isGlass: true, slot: MaterialSlots.GLASS });
    } else if (style === 'glass_grid') {
        const frameW = 4; const topRailH = 4; const botRailH = 5; const gridRows = 4; const gridCols = 2; const barSize = 1.2;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });

        const openW = width - frameW * 2;
        const openH = height - topRailH - botRailH;
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const glassGeo = new THREE.BoxGeometry(openW, openH, 0.4);
        builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, position: new THREE.Vector3(0, botRailH + openH / 2, 0), isGlass: true, slot: MaterialSlots.GLASS });

        const pH = openH / gridRows;
        for (let r = 1; r < gridRows; r++) {
            const barGeo = rotateUVs(createBeveledRect(openW, barSize, thickness * 0.7));
            builder.addNode({ geometry: barGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + r * pH, 0), castShadow: true, receiveShadow: true });
        }
        const pW = openW / gridCols;
        for (let c = 1; c < gridCols; c++) {
            const barGeo = createBeveledRect(barSize, openH, thickness * 0.7);
            builder.addNode({ geometry: barGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-openW / 2 + c * pW, botRailH + openH / 2, 0), castShadow: true, receiveShadow: true });
        }
    } else if (style === 'entry_grand_panel') {
        const frameW = 5; const topRailH = 5; const botRailH = 7;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });

        const openW = width - frameW * 2;
        const openH = height - topRailH - botRailH;
        const pCenter = createBeveledRect(openW, openH, thickness * 0.7);
        builder.addNode({ geometry: pCenter, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + openH / 2, 0), castShadow: true, receiveShadow: true });

        const raisedGeo = createBeveledRect(openW * 0.7, openH * 0.75, thickness * 1.15);
        builder.addNode({ geometry: raisedGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + openH / 2, 0), castShadow: true, receiveShadow: true });
    } else if (style === 'entry_modern_slit') {
        const frameW = 3; const topRailH = 3; const botRailH = 4;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });

        const midH = height - topRailH - botRailH;
        const fullMid = createBeveledRect(width - frameW * 2, midH, thickness * 0.85);
        builder.addNode({ geometry: fullMid, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + midH / 2, 0), castShadow: true, receiveShadow: true });

        const slitW = 3; const slitH = midH * 0.85;
        const slitX = (width / 2 - frameW - slitW / 2 - 4) * signX;
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const glassGeo = new THREE.BoxGeometry(slitW, slitH, 0.4);
        builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, position: new THREE.Vector3(slitX, botRailH + midH / 2, 0), isGlass: true, slot: MaterialSlots.GLASS });
    } else if (style === 'entry_craftsman') {
        const frameW = 4.5; const topRailH = 4.5; const botRailH = 6; const midRailH = 4.5;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width - frameW * 2, midRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height * 0.65, 0), castShadow: true, receiveShadow: true });

        const botPanelH = height * 0.65 - midRailH / 2 - botRailH;
        const geoBotP = createBeveledRect(width - frameW * 2, botPanelH, thickness * 0.6);
        builder.addNode({ geometry: geoBotP, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + botPanelH / 2, 0), castShadow: true, receiveShadow: true });

        const glassH = height - topRailH - (height * 0.65 + midRailH / 2);
        const openW = width - frameW * 2;
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const glassGeo = new THREE.BoxGeometry(openW, glassH, 0.4);
        builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, position: new THREE.Vector3(0, height * 0.65 + midRailH / 2 + glassH / 2, 0), isGlass: true, slot: MaterialSlots.GLASS });

        const numLites = 3;
        const liteW = openW / numLites;
        for (let i = 1; i < numLites; i++) {
            const barGeo = createBeveledRect(1.2, glassH, thickness * 0.7);
            builder.addNode({ geometry: barGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-openW / 2 + i * liteW, height * 0.65 + midRailH / 2 + glassH / 2, 0), castShadow: true, receiveShadow: true });
        }
    } else if (style === 'back_half_lite') {
        const frameW = 4.5; const topRailH = 4.5; const botRailH = 6; const midRailH = 4.5;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));
        const geoRailM = rotateUVs(createBeveledRect(width - frameW * 2, midRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailM, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height * 0.5, 0), castShadow: true, receiveShadow: true });

        const botPanelH = height * 0.5 - midRailH / 2 - botRailH;
        const geoBotP = createBeveledRect(width - frameW * 2, botPanelH, thickness * 0.6);
        builder.addNode({ geometry: geoBotP, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + botPanelH / 2, 0), castShadow: true, receiveShadow: true });

        const glassH = height - topRailH - (height * 0.5 + midRailH / 2);
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const glassGeo = new THREE.BoxGeometry(width - frameW * 2, glassH, 0.4);
        builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, position: new THREE.Vector3(0, height * 0.5 + midRailH / 2 + glassH / 2, 0), isGlass: true, slot: MaterialSlots.GLASS });
    } else if (style === 'back_dutch') {
        const frameW = 4.5; const topRailH = 4.5; const botRailH = 6; const splitH = height * 0.48;
        const geoStileB = createBeveledRect(frameW, splitH, thickness);
        const geoStileT = createBeveledRect(frameW, height - splitH - 1, thickness);
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoShelf = rotateUVs(createBeveledRect(width + 2, 2.5, thickness + 4));

        builder.addNode({ geometry: geoStileB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, splitH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStileB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, splitH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });

        builder.addNode({ geometry: geoStileT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, splitH + 1 + (height - splitH - 1) / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStileT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, splitH + 1 + (height - splitH - 1) / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });

        builder.addNode({ geometry: geoShelf, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, splitH, 0), castShadow: true, receiveShadow: true });

        const pBot = createBeveledRect(width - frameW * 2, splitH - botRailH - 2, thickness * 0.6);
        const pTop = createBeveledRect(width - frameW * 2, height - splitH - topRailH - 3, thickness * 0.6);
        builder.addNode({ geometry: pBot, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + (splitH - botRailH - 2) / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: pTop, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, splitH + 1.5 + (height - splitH - topRailH - 3) / 2, 0), castShadow: true, receiveShadow: true });
    } else if (style === 'service_steel_flush') {
        const coreGeo = createBeveledRect(width, height, thickness);
        builder.addNode({ geometry: coreGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height / 2, 0), castShadow: true, receiveShadow: true });
    } else if (style === 'service_louvered') {
        const frameW = 4; const topRailH = 4; const botRailH = 5;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });

        const openH = height - topRailH - botRailH;
        const louverW = width - frameW * 2 + 0.5;
        const louverGeo = rotateUVs(createBeveledRect(louverW, 0.4, thickness * 0.5));
        const numLouvers = Math.floor(openH / 1.4);
        const spacing = openH / numLouvers;

        for (let i = 0; i < numLouvers; i++) {
            builder.addNode({ geometry: louverGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + spacing / 2 + i * spacing, 0), rotation: new THREE.Euler(Math.PI / 6, 0, 0), castShadow: true, receiveShadow: true });
        }
    } else if (style === 'garage_sectional') {
        const numPanels = 4;
        const grooveSize = 0.5;
        const panelH = (height - (grooveSize * (numPanels - 1))) / numPanels;
        for (let i = 0; i < numPanels; i++) {
            const geoPanel = createBeveledRect(width, panelH, thickness);
            const yPos = panelH / 2 + i * (panelH + grooveSize);
            builder.addNode({ geometry: geoPanel, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, yPos, 0), castShadow: true, receiveShadow: true });
            const raisedP = createBeveledRect(width * 0.88, panelH * 0.7, thickness * 1.15);
            builder.addNode({ geometry: raisedP, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, yPos, 0), castShadow: true, receiveShadow: true });
        }
    } else if (style === 'garage_modern_glass') {
        const numPanels = 4; const numCols = 4; const frameW = 3; const barSize = 1.5;
        const geoStile = createBeveledRect(frameW, height, thickness);
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });

        const openW = width - frameW * 2;
        const pH = height / numPanels;
        const pW = openW / numCols;
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');

        for (let r = 0; r < numPanels; r++) {
            for (let c = 0; c < numCols; c++) {
                const px = -openW / 2 + pW / 2 + c * pW;
                const py = pH / 2 + r * pH;
                const glassGeo = new THREE.BoxGeometry(pW - barSize, pH - barSize, 0.4);
                builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, position: new THREE.Vector3(px, py, 0), isGlass: true, slot: MaterialSlots.GLASS });
            }
        }
        for (let r = 0; r <= numPanels; r++) {
            const hBar = rotateUVs(createBeveledRect(openW, barSize, thickness));
            builder.addNode({ geometry: hBar, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, Math.min(height - barSize / 2, Math.max(barSize / 2, r * pH)), 0), castShadow: true, receiveShadow: true });
        }
        for (let c = 1; c < numCols; c++) {
            const vBar = createBeveledRect(barSize, height, thickness);
            builder.addNode({ geometry: vBar, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-openW / 2 + c * pW, height / 2, 0), castShadow: true, receiveShadow: true });
        }
    } else if (style === 'garage_carriage') {
        const frameW = 4; const topRailH = 4; const botRailH = 5;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });

        const openW = width - frameW * 2;
        const openH = height - topRailH - botRailH;
        const pBack = createBeveledRect(openW, openH, thickness * 0.6);
        builder.addNode({ geometry: pBack, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + openH / 2, 0), castShadow: true, receiveShadow: true });

        // Cross X Brace
        const diagLen = Math.hypot(openW, openH);
        const diagAngle = Math.atan2(openH, openW);
        const diagGeo1 = createBeveledRect(3, diagLen, thickness * 0.85);
        const diagGeo2 = createBeveledRect(3, diagLen, thickness * 0.85);

        builder.addNode({ geometry: diagGeo1, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + openH / 2, 0), rotation: new THREE.Euler(0, 0, diagAngle - Math.PI / 2), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: diagGeo2, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH + openH / 2, 0), rotation: new THREE.Euler(0, 0, -diagAngle + Math.PI / 2), castShadow: true, receiveShadow: true });
    } else if (style === 'patio_multi_slide' || style === 'patio_bifold') {
        const frameW = 3; const topRailH = 3; const botRailH = 4;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, topRailH, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, botRailH, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - topRailH / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, botRailH / 2, 0), castShadow: true, receiveShadow: true });

        const openW = width - frameW * 2;
        const openH = height - topRailH - botRailH;
        const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';
        const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
        const glassGeo = new THREE.BoxGeometry(openW, openH, 0.4);
        builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, position: new THREE.Vector3(0, botRailH + openH / 2, 0), isGlass: true, slot: MaterialSlots.GLASS });
    } else if (style === 'gate_slat_modern') {
        const frameW = 3.5;
        const frameMatKey = entity.materials?.[MaterialSlots.FRAME]?.id || 'upvc_white';
        const matFrameObj = helpers?.getDynamicMaterial ? helpers.getDynamicMaterial(frameMatKey, 'door') : material;
        const matsFrameBox = (helpers && helpers.getFaceMaterials) ? helpers.getFaceMaterials(entity, matFrameObj, { width, height, thick: thickness }).box : matFrameObj;
        const matsFrameExtrude = Array.isArray(matsFrameBox) ? [matsFrameBox[4] || matsFrameBox[0], matsFrameBox[1] || matsFrameBox[0]] : matsFrameBox;

        const panelMatKey = entity.materials?.custom?.id || entity.materials?.panel?.id;
        const matPanelObj = panelMatKey && helpers?.getDynamicMaterial ? helpers.getDynamicMaterial(panelMatKey, 'door') : null;
        const matsPanelBox = matPanelObj ? ((helpers && helpers.getFaceMaterials) ? helpers.getFaceMaterials(entity, matPanelObj, { width, height, thick: thickness }).box : matPanelObj) : null;
        const matsPanelExtrude = matsPanelBox ? (Array.isArray(matsPanelBox) ? [matsPanelBox[4] || matsPanelBox[0], matsPanelBox[1] || matsPanelBox[0]] : matsPanelBox) : null;

        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, frameW, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, frameW, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsFrameExtrude, parent: group, slot: MaterialSlots.FRAME, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsFrameExtrude, parent: group, slot: MaterialSlots.FRAME, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsFrameExtrude, parent: group, slot: MaterialSlots.FRAME, position: new THREE.Vector3(0, height - frameW / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsFrameExtrude, parent: group, slot: MaterialSlots.FRAME, position: new THREE.Vector3(0, frameW / 2, 0), castShadow: true, receiveShadow: true });

        const openW = width - frameW * 2;
        const openH = height - frameW * 2;

        if (width > 80 && matsPanelExtrude) {
            const bayW = (openW - frameW) / 2;
            const midStileGeo = createBeveledRect(frameW, openH, thickness);
            builder.addNode({ geometry: midStileGeo, materialOverride: matsFrameExtrude, parent: group, slot: MaterialSlots.FRAME, position: new THREE.Vector3(0, height / 2, 0), castShadow: true, receiveShadow: true });

            const outerBayX = signX === 1 ? (-openW / 2 + bayW / 2) : (openW / 2 - bayW / 2);
            const innerBayX = signX === 1 ? (openW / 2 - bayW / 2) : (-openW / 2 + bayW / 2);

            const accentGeo = createBeveledRect(bayW - 1, openH - 1, thickness * 0.7);
            builder.addNode({ geometry: accentGeo, materialOverride: matsPanelExtrude, parent: group, slot: MaterialSlots.CUSTOM, position: new THREE.Vector3(outerBayX, height / 2, 0), castShadow: true, receiveShadow: true });

            const slatH = 4.5; const slatGap = 1.5;
            const numSlats = Math.floor(openH / (slatH + slatGap));
            const actualSpacing = openH / numSlats;
            for (let i = 0; i < numSlats; i++) {
                const slatGeo = rotateUVs(createBeveledRect(bayW, slatH, thickness * 0.6));
                builder.addNode({ geometry: slatGeo, materialOverride: matsExtrude, parent: group, slot: MaterialSlots.LEAF, position: new THREE.Vector3(innerBayX, frameW + actualSpacing * i + slatH / 2, 0), castShadow: true, receiveShadow: true });
            }
        } else {
            const slatH = 5; const slatGap = 1.2;
            const numSlats = Math.floor(openH / (slatH + slatGap));
            const actualSpacing = openH / numSlats;

            for (let i = 0; i < numSlats; i++) {
                const slatGeo = rotateUVs(createBeveledRect(openW, slatH, thickness * 0.7));
                builder.addNode({ geometry: slatGeo, materialOverride: matsExtrude, parent: group, slot: MaterialSlots.LEAF, position: new THREE.Vector3(0, frameW + actualSpacing * i + slatH / 2, 0), castShadow: true, receiveShadow: true });
            }
        }
    } else if (style === 'gate_wrought_iron') {
        const frameW = 3;
        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, frameW, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, frameW, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, height - frameW / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(0, frameW / 2, 0), castShadow: true, receiveShadow: true });

        const openW = width - frameW * 2;
        const numPickets = Math.max(3, Math.floor(openW / 7));
        const pSpacing = openW / (numPickets + 1);

        for (let i = 1; i <= numPickets; i++) {
            const pX = -openW / 2 + i * pSpacing;
            const barGeo = new THREE.CylinderGeometry(0.5, 0.5, height - frameW * 2, 12);
            builder.addNode({ geometry: barGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(pX, height / 2, 0), castShadow: true, receiveShadow: true });
            const spearGeo = new THREE.ConeGeometry(0.8, 2.5, 12);
            builder.addNode({ geometry: spearGeo, materialOverride: matsExtrude, parent: group, position: new THREE.Vector3(pX, height - frameW + 1.25, 0), castShadow: true, receiveShadow: true });
        }
    } else if (style === 'gate_pedestrian_wicket' || style === 'gate_driveway_sliding' || style === 'gate_garden_picket') {
        const frameW = 3.5;
        const frameMatKey = entity.materials?.[MaterialSlots.FRAME]?.id;
        const matFrameObj = frameMatKey && helpers?.getDynamicMaterial ? helpers.getDynamicMaterial(frameMatKey, 'door') : null;
        const matsFrameBox = matFrameObj ? ((helpers && helpers.getFaceMaterials) ? helpers.getFaceMaterials(entity, matFrameObj, { width, height, thick: thickness }).box : matFrameObj) : null;
        const matsFrameExtrude = matsFrameBox ? (Array.isArray(matsFrameBox) ? [matsFrameBox[4] || matsFrameBox[0], matsFrameBox[1] || matsFrameBox[0]] : matsFrameBox) : matsExtrude;

        const geoStile = createBeveledRect(frameW, height, thickness);
        const geoRailT = rotateUVs(createBeveledRect(width - frameW * 2, frameW, thickness));
        const geoRailB = rotateUVs(createBeveledRect(width - frameW * 2, frameW, thickness));

        builder.addNode({ geometry: geoStile, materialOverride: matsFrameExtrude, parent: group, slot: MaterialSlots.FRAME, position: new THREE.Vector3(-width / 2 + frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoStile, materialOverride: matsFrameExtrude, parent: group, slot: MaterialSlots.FRAME, position: new THREE.Vector3(width / 2 - frameW / 2, height / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailT, materialOverride: matsFrameExtrude, parent: group, slot: MaterialSlots.FRAME, position: new THREE.Vector3(0, height - frameW / 2, 0), castShadow: true, receiveShadow: true });
        builder.addNode({ geometry: geoRailB, materialOverride: matsFrameExtrude, parent: group, slot: MaterialSlots.FRAME, position: new THREE.Vector3(0, frameW / 2, 0), castShadow: true, receiveShadow: true });

        const openW = width - frameW * 2;
        const openH = height - frameW * 2;

        if (style === 'gate_pedestrian_wicket') {
            const pWidth = 6.0;
            const numPickets = Math.max(1, Math.round(openW / pWidth));
            const actualW = openW / numPickets;
            for (let i = 0; i < numPickets; i++) {
                const pX = -openW / 2 + actualW / 2 + i * actualW;
                const pGeo = createBeveledRect(actualW - 0.2, openH, thickness * 0.75);
                builder.addNode({ geometry: pGeo, materialOverride: matsExtrude, parent: group, slot: MaterialSlots.LEAF, position: new THREE.Vector3(pX, height / 2, 0), castShadow: true, receiveShadow: true });
            }
        } else {
            const pWidth = 4.5; const pGap = 2;
            const numPickets = Math.floor(openW / (pWidth + pGap));
            const spacing = openW / numPickets;

            for (let i = 0; i < numPickets; i++) {
                const pX = -openW / 2 + spacing / 2 + i * spacing;
                const pGeo = createBeveledRect(pWidth, height - frameW * 2, thickness * 0.7);
                builder.addNode({ geometry: pGeo, materialOverride: matsExtrude, parent: group, slot: MaterialSlots.LEAF, position: new THREE.Vector3(pX, height / 2, 0), castShadow: true, receiveShadow: true });
            }
        }
    } else {
        // Fallback: Default Flat / Arched Door Leaf Body
        const shapeType = entity && entity.doorShape ? entity.doorShape : 'square';
        const halfSide = (entity.doorType === 'double' || entity.doorType === 'french' || entity.doorType === 'double_french') ? -signX : 0;
        const hAdjust = 0.05;

        if (isGlass) {
            const glassMatKey = entity.materials?.[MaterialSlots.GLASS]?.id || 'clear';
            const glassMat = helpers.getDynamicMaterial(glassMatKey, 'door');
            const glassOutline = createDoorShape(width, Math.max(0.1, height - hAdjust), shapeType, halfSide);
            const glassGeo = new THREE.ExtrudeGeometry(glassOutline, { depth: 0.6, bevelEnabled: false });
            glassGeo.translate(0, 0, -0.3);
            normalizeExtrudeUVs(glassGeo, width, height, 0.6, -width / 2, 0);
            builder.addNode({ geometry: glassGeo, materialOverride: glassMat, parent: group, isGlass: true, slot: MaterialSlots.GLASS });
        } else {
            const doorOutline = createDoorShape(width, Math.max(0.1, height - hAdjust), shapeType, halfSide);
            const coreGeo = new THREE.ExtrudeGeometry(doorOutline, {
                depth: thickness,
                bevelEnabled: true,
                bevelSegments: 3,
                steps: 1,
                bevelSize: 0.06,
                bevelThickness: 0.06
            });
            coreGeo.translate(0, 0, -thickness / 2);
            normalizeExtrudeUVs(coreGeo, width, height, thickness, -width / 2, 0);
            builder.addNode({ geometry: coreGeo, materialOverride: matsExtrude, parent: group, castShadow: true, receiveShadow: true });
        }
    }

    // Hardware: Hinges, Lever Handle, Lock Rosette, Keyhole, and Latches
    const handleY = height * 0.46; // ~95cm standard handle height
    const hZF = thickness / 2;
    const hZB = -thickness / 2;
    const leverX = (width / 2 - 4.2) * signX;
    const hwMatKey = entity.materials?.[MaterialSlots.HARDWARE]?.id || 'brass';
    const hwMat = helpers.getDynamicMaterial(hwMatKey, 'door_handle');
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.25 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.15 });

    if (['single', 'double', 'french', 'folding_main'].includes(type) && !Boolean(style && style.startsWith('gate_'))) {
        // Lever Rosette Backplate
        const roseGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.25, 24); roseGeo.rotateX(Math.PI / 2);
        builder.addNode({ geometry: roseGeo, materialOverride: hwMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3(leverX, handleY, hZF + 0.12), castShadow: true, userData: { isHandle: true }, paintable: false });
        builder.addNode({ geometry: roseGeo, materialOverride: hwMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3(leverX, handleY, hZB - 0.12), castShadow: true, userData: { isHandle: true }, paintable: false });

        // Handle Stem Collar
        const stemGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.2, 16); stemGeo.rotateX(Math.PI / 2);
        builder.addNode({ geometry: stemGeo, materialOverride: hwMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3(leverX, handleY, hZF + 0.7), castShadow: true, userData: { isHandle: true }, paintable: false });
        builder.addNode({ geometry: stemGeo, materialOverride: hwMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3(leverX, handleY, hZB - 0.7), castShadow: true, userData: { isHandle: true }, paintable: false });

        // Lever Handle Bar (7.5 units = 4.5 inches architectural lever)
        const handleLGeo = new THREE.CylinderGeometry(0.32, 0.38, 7.5, 16); handleLGeo.rotateZ(Math.PI / 2);
        const handleDir = -signX;
        builder.addNode({ geometry: handleLGeo, materialOverride: hwMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3(leverX + 3.4 * handleDir, handleY, hZF + 1.25), castShadow: true, userData: { isHandle: true }, paintable: false });
        builder.addNode({ geometry: handleLGeo, materialOverride: hwMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3(leverX + 3.4 * handleDir, handleY, hZB - 1.25), castShadow: true, userData: { isHandle: true }, paintable: false });

        // Keyhole Escutcheon Rosette
        const keyRoseGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.2, 24); keyRoseGeo.rotateX(Math.PI / 2);
        builder.addNode({ geometry: keyRoseGeo, materialOverride: hwMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3(leverX, handleY - 4.2, hZF + 0.1), castShadow: true, userData: { isHandle: true }, paintable: false });
        builder.addNode({ geometry: keyRoseGeo, materialOverride: hwMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3(leverX, handleY - 4.2, hZB - 0.1), castShadow: true, userData: { isHandle: true }, paintable: false });

        // Keyhole Slot
        const keyHoleMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
        const keyHoleGeo = new THREE.BoxGeometry(0.22, 0.9, 0.22);
        builder.addNode({ geometry: keyHoleGeo, materialOverride: keyHoleMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3(leverX, handleY - 4.2, hZF + 0.11), userData: { isHandle: true }, paintable: false });
        builder.addNode({ geometry: keyHoleGeo, materialOverride: keyHoleMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3(leverX, handleY - 4.2, hZB - 0.11), userData: { isHandle: true }, paintable: false });

        const latchGeo = new THREE.BoxGeometry(0.6, 1.0, 0.6);
        builder.addNode({ geometry: latchGeo, materialOverride: silverMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3((width / 2 + 0.15) * signX, handleY, 0), castShadow: true, userData: { isHandle: true }, paintable: false });
        const faceplateGeo = new THREE.BoxGeometry(0.1, 3.5, 1.0);
        builder.addNode({ geometry: faceplateGeo, materialOverride: hwMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3((width / 2 + 0.05) * signX, handleY, 0), castShadow: true, userData: { isHandle: true }, paintable: false });

    } else if (Boolean(style && style.startsWith('gate_')) && ['single', 'double', 'french'].includes(type)) {
        // Heavy-duty sliding bolt latch on gate
        const latchX = (width / 2 - 4.5) * signX;
        const latchBackplateGeo = new THREE.BoxGeometry(3.0, 10.0, 0.4);
        const boltRodGeo = new THREE.CylinderGeometry(0.35, 0.35, 12.0, 16);
        boltRodGeo.rotateZ(Math.PI / 2);
        const boltKnobGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.8, 12);
        boltKnobGeo.rotateX(Math.PI / 2);

        [-thickness / 2 - 0.2, thickness / 2 + 0.2].forEach(zPos => {
            builder.addNode({ geometry: latchBackplateGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(latchX, handleY, zPos), castShadow: true, userData: { isHandle: true } });
            builder.addNode({ geometry: boltRodGeo, materialOverride: silverMat, parent: group, position: new THREE.Vector3(latchX + 1.5 * signX, handleY, zPos + (zPos > 0 ? 0.3 : -0.3)), castShadow: true, userData: { isHandle: true } });
            builder.addNode({ geometry: boltKnobGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(latchX, handleY, zPos + (zPos > 0 ? 0.9 : -0.9)), castShadow: true, userData: { isHandle: true } });
        });

        // Vertical ground drop-bolt on double gates
        if (type === 'double' && signX === 1) {
            const dropRodGeo = new THREE.CylinderGeometry(0.35, 0.35, 20.0, 16);
            const dropGuideGeo = new THREE.BoxGeometry(2.0, 3.0, 1.5);
            builder.addNode({ geometry: dropRodGeo, materialOverride: silverMat, parent: group, position: new THREE.Vector3(width / 2 - 2, 8, thickness / 2 + 0.3), castShadow: true, userData: { isHandle: true } });
            builder.addNode({ geometry: dropGuideGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(width / 2 - 2, 5, thickness / 2 + 0.3), castShadow: true, userData: { isHandle: true } });
            builder.addNode({ geometry: dropGuideGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3(width / 2 - 2, 14, thickness / 2 + 0.3), castShadow: true, userData: { isHandle: true } });
        }
    }

    if (['single', 'double', 'french', 'folding_main'].includes(type) && signX !== 0 && !Boolean(style && style.startsWith('gate_'))) {
        const hingeW = 0.8, hingeD = 4.2;
        const hingeGeo = new THREE.BoxGeometry(hingeW, hingeD, 0.15);
        const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, hingeD, 16);
        [height * 0.88, height * 0.5, height * 0.12].forEach(y => {
            const hG = new THREE.Group();
            builder.addNode({ geometry: hingeGeo, materialOverride: metalMat, parent: hG, position: new THREE.Vector3((width / 2 - 0.05) * -signX, 0, 0), rotation: new THREE.Euler(0, signX === 1 ? Math.PI / 2 : -Math.PI / 2, 0), userData: { isHandle: true } });
            builder.addNode({ geometry: barrelGeo, materialOverride: metalMat, parent: hG, position: new THREE.Vector3((width / 2 + 0.15) * -signX, 0, thickness / 2 + 0.1), userData: { isHandle: true } });
            hG.position.set(0, y, 0);
            hG.castShadow = true; group.add(hG);
        });

        const strikeGeo = new THREE.BoxGeometry(0.1, 6, 2.5);
        builder.addNode({ geometry: strikeGeo, materialOverride: metalMat, parent: group, position: new THREE.Vector3((width / 2 - 0.01) * signX, height * 0.5, 0), userData: { isHandle: true } });
    }

    // Door Bottom Sweep (weatherstrip/brush seal)
    if (!Boolean(style && style.startsWith('gate_'))) {
        const sweepH = 0.6;
        const sweepThick = thickness * 0.9;
        const sweepGeo = new THREE.BoxGeometry(width - 0.2, sweepH, sweepThick);
        const sweepMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8, metalness: 0.2 });
        builder.addNode({ geometry: sweepGeo, materialOverride: sweepMat, parent: group, slot: MaterialSlots.HARDWARE, position: new THREE.Vector3(0, sweepH / 2, 0), userData: { isSweep: true }, paintable: false });
    }

    return group;
}

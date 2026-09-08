import * as THREE from 'three';

/**
 * Creates 2D window shape outlines for square, radius arch, segment, and gothic shapes.
 * @param {number} w - Window width
 * @param {number} h - Window height
 * @param {string} type - 'square' | 'radius' | 'segment' | 'gothic'
 * @returns {THREE.Shape}
 */
export const createWindowShape = (w, h, type = 'square') => {
    const shape = new THREE.Shape();
    const hw = w / 2;
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);

    if (type === 'radius' || type === 'arch' || type === 'arched') {
        const straightH = Math.max(0, h - hw);
        shape.lineTo(hw, straightH);
        if (hw > 0) shape.absarc(0, straightH, hw, 0, Math.PI, false);
    } else if (type === 'segment') {
        const rise = w * 0.15;
        const straightH = Math.max(0, h - rise);
        shape.lineTo(hw, straightH);
        shape.quadraticCurveTo(0, h + rise * 0.5, -hw, straightH);
    } else if (type === 'gothic') {
        const straightH = Math.max(0, h - (w * 0.7));
        shape.lineTo(hw, straightH);
        shape.quadraticCurveTo(hw * 0.2, h, 0, h);
        shape.quadraticCurveTo(-hw * 0.2, h, -hw, straightH);
    } else {
        shape.lineTo(hw, h);
        shape.lineTo(-hw, h);
    }
    shape.lineTo(-hw, 0);
    return shape;
};

/**
 * Creates beveled rectangular extruded geometry with normalized UVs.
 */
export const createBeveledRect = (w, h, depth, bSize = 0.25, bThick = 0.25) => {
    const shape = new THREE.Shape();
    const hw = w / 2, hh = h / 2;
    shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
    const d = Math.max(0.01, depth - bThick * 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: d,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: Math.min(bSize, w * 0.15, h * 0.15),
        bevelThickness: Math.min(bThick, depth * 0.2)
    });
    geo.translate(0, 0, -d / 2);
    const uvs = geo.attributes.uv;
    const pos = geo.attributes.position;
    if (uvs && pos) {
        for (let i = 0; i < uvs.count; i++) {
            uvs.setXY(i, (pos.getX(i) + hw) / w, (pos.getY(i) + hh) / h);
        }
        uvs.needsUpdate = true;
    }
    return geo;
};

/**
 * Rotates UV coordinates 90 degrees for procedural horizontal grain alignment.
 */
export const rotateUVs = (geo) => {
    const uvs = geo.attributes.uv;
    if (uvs) {
        for (let i = 0; i < uvs.count; i++) {
            const u = uvs.getX(i) - 0.5;
            const v = uvs.getY(i) - 0.5;
            uvs.setXY(i, -v + 0.5, u + 0.5);
        }
        uvs.needsUpdate = true;
    }
    return geo;
};

/**
 * 45-degree mitered top rail geometry.
 */
export const createMiterRailTopGeo = (length, memberW, depth, bSize = 0.15, bThick = 0.15) => {
    const shape = new THREE.Shape();
    const hl = length / 2, hw = memberW / 2;
    shape.moveTo(-hl, hw);
    shape.lineTo(hl, hw);
    shape.lineTo(hl - memberW, -hw);
    shape.lineTo(-hl + memberW, -hw);
    shape.lineTo(-hl, hw);
    const d = Math.max(0.01, depth - bThick * 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1,
        bevelSize: Math.min(bSize, memberW * 0.12, length * 0.05),
        bevelThickness: Math.min(bThick, depth * 0.15)
    });
    geo.translate(0, 0, -d / 2);
    const uvs = geo.attributes.uv, pos = geo.attributes.position;
    if (uvs && pos) {
        for (let i = 0; i < uvs.count; i++) {
            uvs.setXY(i, (pos.getX(i) + hl) / length, (pos.getY(i) + hw) / memberW);
        }
        uvs.needsUpdate = true;
    }
    return geo;
};

/**
 * 45-degree mitered bottom rail geometry.
 */
export const createMiterRailBotGeo = (length, memberW, depth, bSize = 0.15, bThick = 0.15) => {
    const shape = new THREE.Shape();
    const hl = length / 2, hw = memberW / 2;
    shape.moveTo(-hl, -hw);
    shape.lineTo(hl, -hw);
    shape.lineTo(hl - memberW, hw);
    shape.lineTo(-hl + memberW, hw);
    shape.lineTo(-hl, -hw);
    const d = Math.max(0.01, depth - bThick * 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1,
        bevelSize: Math.min(bSize, memberW * 0.12, length * 0.05),
        bevelThickness: Math.min(bThick, depth * 0.15)
    });
    geo.translate(0, 0, -d / 2);
    const uvs = geo.attributes.uv, pos = geo.attributes.position;
    if (uvs && pos) {
        for (let i = 0; i < uvs.count; i++) {
            uvs.setXY(i, (pos.getX(i) + hl) / length, (pos.getY(i) + hw) / memberW);
        }
        uvs.needsUpdate = true;
    }
    return geo;
};

/**
 * 45-degree mitered left stile geometry.
 */
export const createMiterStileLeftGeo = (length, memberW, depth, bSize = 0.15, bThick = 0.15) => {
    const shape = new THREE.Shape();
    const hl = length / 2, hw = memberW / 2;
    shape.moveTo(-hw, -hl);
    shape.lineTo(-hw, hl);
    shape.lineTo(hw, hl - memberW);
    shape.lineTo(hw, -hl + memberW);
    shape.lineTo(-hw, -hl);
    const d = Math.max(0.01, depth - bThick * 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1,
        bevelSize: Math.min(bSize, memberW * 0.12, length * 0.05),
        bevelThickness: Math.min(bThick, depth * 0.15)
    });
    geo.translate(0, 0, -d / 2);
    const uvs = geo.attributes.uv, pos = geo.attributes.position;
    if (uvs && pos) {
        for (let i = 0; i < uvs.count; i++) {
            uvs.setXY(i, (pos.getX(i) + hw) / memberW, (pos.getY(i) + hl) / length);
        }
        uvs.needsUpdate = true;
    }
    return geo;
};

/**
 * 45-degree mitered right stile geometry.
 */
export const createMiterStileRightGeo = (length, memberW, depth, bSize = 0.15, bThick = 0.15) => {
    const shape = new THREE.Shape();
    const hl = length / 2, hw = memberW / 2;
    shape.moveTo(hw, -hl);
    shape.lineTo(hw, hl);
    shape.lineTo(-hw, hl - memberW);
    shape.lineTo(-hw, -hl + memberW);
    shape.lineTo(hw, -hl);
    const d = Math.max(0.01, depth - bThick * 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1,
        bevelSize: Math.min(bSize, memberW * 0.12, length * 0.05),
        bevelThickness: Math.min(bThick, depth * 0.15)
    });
    geo.translate(0, 0, -d / 2);
    const uvs = geo.attributes.uv, pos = geo.attributes.position;
    if (uvs && pos) {
        for (let i = 0; i < uvs.count; i++) {
            uvs.setXY(i, (pos.getX(i) + hw) / memberW, (pos.getY(i) + hl) / length);
        }
        uvs.needsUpdate = true;
    }
    return geo;
};

/**
 * Generates thin security bar geometries (round rods or rectangular flats).
 */
export const createThinBarGeo = (w, h, depth, isRotated = false, isRound = false, barWidth = 0.8) => {
    if (isRound) {
        const len = isRotated ? w : h;
        const geo = new THREE.CylinderGeometry(barWidth / 2, barWidth / 2, len, 12);
        if (isRotated) geo.rotateZ(Math.PI / 2);
        return geo;
    }
    const shape = new THREE.Shape();
    const hw = w / 2, hh = h / 2;
    shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -depth / 2);
    if (isRotated) rotateUVs(geo);
    return geo;
};

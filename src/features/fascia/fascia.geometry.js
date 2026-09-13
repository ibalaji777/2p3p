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
            uvs.setXY(i, (vx - bMinX) / spanX, (vy - bMinY) / spanY);
        } else {
            uvs.setXY(i, (vz - bMinZ) / spanZ, (vy - bMinY) / spanY);
        }
    }
    uvs.needsUpdate = true;
    return geo;
};

/**
 * Creates a rounded or sharp cuboid geometry for fascia arms.
 */
export const createBlockGeometry = (w, h, d, blockRadii = [0, 0, 0, 0]) => {
    if (!blockRadii.some(r => r > 0)) {
        return new THREE.BoxGeometry(w, h, d);
    }

    const shape = new THREE.Shape();
    const [rBL, rBR, rTR, rTL] = blockRadii;
    if (rBL > 0) { shape.moveTo(rBL, 0); shape.absarc(rBL, rBL, rBL, Math.PI, Math.PI * 1.5, false); } else shape.moveTo(0, 0);
    if (rBR > 0) { shape.lineTo(w - rBR, 0); shape.absarc(w - rBR, rBR, rBR, Math.PI * 1.5, Math.PI * 2, false); } else shape.lineTo(w, 0);
    if (rTR > 0) { shape.lineTo(w, h - rTR); shape.absarc(w - rTR, h - rTR, rTR, 0, Math.PI * 0.5, false); } else shape.lineTo(w, h);
    if (rTL > 0) { shape.lineTo(rTL, h); shape.absarc(rTL, h - rTL, rTL, Math.PI * 0.5, Math.PI, false); } else shape.lineTo(0, h);
    shape.lineTo(0, rBL > 0 ? rBL : 0);

    const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 8 });
    extrudeGeo.translate(-w / 2, -h / 2, -d / 2);
    normalizeExtrudeUVs(extrudeGeo, w, h, d, -w / 2, -h / 2);
    return extrudeGeo;
};

/**
 * Creates inner corner fillet curve geometry.
 */
export const createInnerFilletGeometry = (r, d, quad) => {
    if (!r || r <= 0) return null;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    if (quad === 1) { shape.lineTo(r, 0); shape.absarc(r, r, r, Math.PI * 1.5, Math.PI, true); shape.lineTo(0, r); }
    else if (quad === 2) { shape.lineTo(0, r); shape.absarc(-r, r, r, 0, Math.PI * 1.5, true); shape.lineTo(-r, 0); }
    else if (quad === 3) { shape.lineTo(-r, 0); shape.absarc(-r, -r, r, Math.PI * 0.5, 0, true); shape.lineTo(0, -r); }
    else if (quad === 4) { shape.lineTo(0, -r); shape.absarc(r, -r, r, Math.PI, Math.PI * 0.5, true); shape.lineTo(r, 0); }
    shape.lineTo(0, 0);

    const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 8 });
    extrudeGeo.translate(0, 0, -d / 2);
    normalizeExtrudeUVs(extrudeGeo, r, r, d, -r / 2, -r / 2);
    return extrudeGeo;
};

/**
 * Calculates the assembly blocks and fillets for a given fascia configuration.
 */
export const calculateFasciaAssembly = (entity) => {
    const width = entity.width || 100;
    const height = entity.height || 120;
    const depth = entity.depth || 40;
    const thick = entity.thick || 10;
    const profileType = entity.profileType || 'c_shape_left';

    const wallThick = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || 16) : 16;
    const facing = entity.facing !== undefined ? entity.facing : 1;
    const zOffset = (facing === -1) ? -(wallThick / 2 + depth / 2) : (wallThick / 2 + depth / 2);

    const topArm = entity.topArm !== undefined ? entity.topArm : width;
    const bottomArm = entity.bottomArm !== undefined ? entity.bottomArm : width;

    const radii = entity.cornerRadii || [];
    const getR = (idx) => Math.max(0, radii[idx] || 0);

    const returnLength = entity.returnLength !== undefined ? entity.returnLength : 120;
    const towerHeight = entity.towerHeight !== undefined ? entity.towerHeight : 350;
    const towerWidth = entity.towerWidth !== undefined ? entity.towerWidth : 60;
    const towerDepth = entity.towerDepth !== undefined ? entity.towerDepth : depth;
    const hasSpotlights = entity.hasSpotlights !== false;
    const spotlightCount = entity.spotlightCount !== undefined ? entity.spotlightCount : 4;

    const blocks = [];
    const fillets = [];
    const spotlights = [];
    let computedPts = [];

    if (profileType === 'c_shape_left') {
        blocks.push({ w: topArm, h: thick, d: depth, x: -width / 2 + topArm / 2, y: height - thick, z: zOffset, radii: [0, getR(5), getR(6), getR(7)], slot: 'fascia_frame' });
        blocks.push({ w: thick, h: height - 2 * thick, d: depth, x: -width / 2 + thick / 2, y: thick, z: zOffset, radii: [0, 0, 0, 0], slot: 'fascia_side' });
        blocks.push({ w: bottomArm, h: thick, d: depth, x: -width / 2 + bottomArm / 2, y: 0, z: zOffset, radii: [getR(0), getR(1), getR(2), 0], slot: 'fascia_frame' });
        fillets.push({ r: getR(3), d: depth, x: -width / 2 + thick, y: thick, z: zOffset, quad: 1 });
        fillets.push({ r: getR(4), d: depth, x: -width / 2 + thick, y: height - thick, z: zOffset, quad: 4 });
        computedPts = [
            new THREE.Vector2(-width / 2, 0),
            new THREE.Vector2(-width / 2 + bottomArm, 0),
            new THREE.Vector2(-width / 2 + bottomArm, thick),
            new THREE.Vector2(-width / 2 + thick, thick),
            new THREE.Vector2(-width / 2 + thick, height - thick),
            new THREE.Vector2(-width / 2 + topArm, height - thick),
            new THREE.Vector2(-width / 2 + topArm, height),
            new THREE.Vector2(-width / 2, height)
        ];
    } else if (profileType === 'c_shape_right') {
        blocks.push({ w: topArm, h: thick, d: depth, x: width / 2 - topArm / 2, y: height - thick, z: zOffset, radii: [getR(4), 0, getR(2), getR(3)], slot: 'fascia_frame' });
        blocks.push({ w: thick, h: height - 2 * thick, d: depth, x: width / 2 - thick / 2, y: thick, z: zOffset, radii: [0, 0, 0, 0], slot: 'fascia_side' });
        blocks.push({ w: bottomArm, h: thick, d: depth, x: width / 2 - bottomArm / 2, y: 0, z: zOffset, radii: [getR(0), getR(1), 0, getR(7)], slot: 'fascia_frame' });
        fillets.push({ r: getR(5), d: depth, x: width / 2 - thick, y: height - thick, z: zOffset, quad: 3 });
        fillets.push({ r: getR(6), d: depth, x: width / 2 - thick, y: thick, z: zOffset, quad: 2 });
        computedPts = [
            new THREE.Vector2(width / 2 - bottomArm, 0),
            new THREE.Vector2(width / 2, 0),
            new THREE.Vector2(width / 2, height),
            new THREE.Vector2(width / 2 - topArm, height),
            new THREE.Vector2(width / 2 - topArm, height - thick),
            new THREE.Vector2(width / 2 - thick, height - thick),
            new THREE.Vector2(width / 2 - thick, thick),
            new THREE.Vector2(width / 2 - bottomArm, thick)
        ];
    } else if (profileType === 'l_shape_left') {
        blocks.push({ w: topArm, h: thick, d: depth, x: -width / 2 + topArm / 2, y: height - thick, z: zOffset, radii: [0, getR(3), getR(4), getR(5)], slot: 'fascia_frame' });
        blocks.push({ w: thick, h: height - thick, d: depth, x: -width / 2 + thick / 2, y: 0, z: zOffset, radii: [getR(0), getR(1), 0, 0], slot: 'fascia_side' });
        fillets.push({ r: getR(2), d: depth, x: -width / 2 + thick, y: height - thick, z: zOffset, quad: 4 });
        computedPts = [
            new THREE.Vector2(-width / 2, 0),
            new THREE.Vector2(-width / 2 + thick, 0),
            new THREE.Vector2(-width / 2 + thick, height - thick),
            new THREE.Vector2(-width / 2 + topArm, height - thick),
            new THREE.Vector2(-width / 2 + topArm, height),
            new THREE.Vector2(-width / 2, height)
        ];
    } else if (profileType === 'l_shape_right') {
        blocks.push({ w: topArm, h: thick, d: depth, x: width / 2 - topArm / 2, y: height - thick, z: zOffset, radii: [getR(4), 0, 0, getR(3)], slot: 'fascia_frame' });
        blocks.push({ w: thick, h: height - thick, d: depth, x: width / 2 - thick / 2, y: 0, z: zOffset, radii: [0, getR(1), getR(2), 0], slot: 'fascia_side' });
        fillets.push({ r: getR(5), d: depth, x: width / 2 - thick, y: height - thick, z: zOffset, quad: 3 });
        computedPts = [
            new THREE.Vector2(width / 2 - thick, 0),
            new THREE.Vector2(width / 2, 0),
            new THREE.Vector2(width / 2, height),
            new THREE.Vector2(width / 2 - topArm, height),
            new THREE.Vector2(width / 2 - topArm, height - thick),
            new THREE.Vector2(width / 2 - thick, height - thick)
        ];
    } else if (profileType === 'full_box') {
        blocks.push({ w: width, h: thick, d: depth, x: 0, y: height - thick, z: zOffset, radii: [0, 0, getR(2), getR(3)], slot: 'fascia_frame' });
        blocks.push({ w: width, h: thick, d: depth, x: 0, y: 0, z: zOffset, radii: [getR(0), getR(1), 0, 0], slot: 'fascia_frame' });
        blocks.push({ w: thick, h: height - 2 * thick, d: depth, x: -width / 2 + thick / 2, y: thick, z: zOffset, radii: [0, 0, 0, 0], slot: 'fascia_side' });
        blocks.push({ w: thick, h: height - 2 * thick, d: depth, x: width / 2 - thick / 2, y: thick, z: zOffset, radii: [0, 0, 0, 0], slot: 'fascia_side' });
        fillets.push({ r: getR(4), d: depth, x: -width / 2 + thick, y: thick, z: zOffset, quad: 1 });
        fillets.push({ r: getR(5), d: depth, x: -width / 2 + thick, y: height - thick, z: zOffset, quad: 4 });
        fillets.push({ r: getR(6), d: depth, x: width / 2 - thick, y: height - thick, z: zOffset, quad: 3 });
        fillets.push({ r: getR(7), d: depth, x: width / 2 - thick, y: thick, z: zOffset, quad: 2 });
        computedPts = [
            new THREE.Vector2(-width / 2, 0),
            new THREE.Vector2(width / 2, 0),
            new THREE.Vector2(width / 2, height),
            new THREE.Vector2(-width / 2, height),
            new THREE.Vector2(-width / 2 + thick, thick),
            new THREE.Vector2(-width / 2 + thick, height - thick),
            new THREE.Vector2(width / 2 - thick, height - thick),
            new THREE.Vector2(width / 2 - thick, thick)
        ];
    } else if (profileType === 'tower_corner_wrap_left') {
        // Front Cantilever Beam
        blocks.push({ w: width, h: height, d: depth, x: 0, y: 0, z: zOffset, radii: [0, 0, 0, 0], slot: 'fascia_frame' });
        // Side Return Cantilever Beam (wrapping around left corner onto side wall)
        blocks.push({ w: depth, h: height, d: returnLength, x: -width / 2 + depth / 2, y: 0, z: zOffset - (returnLength / 2) * facing, radii: [0, 0, 0, 0], slot: 'fascia_side' });
        // Vertical Accent Tower (extending up to terrace level)
        blocks.push({ w: towerWidth, h: towerHeight, d: towerDepth, x: -width / 2 + towerWidth / 2, y: 0, z: zOffset + ((towerDepth - depth) / 2) * facing, radii: [0, 0, 0, 0], slot: 'fascia_front' });

        computedPts = [
            new THREE.Vector2(-width / 2, 0),
            new THREE.Vector2(width / 2, 0),
            new THREE.Vector2(width / 2, height),
            new THREE.Vector2(-width / 2 + towerWidth, height),
            new THREE.Vector2(-width / 2 + towerWidth, towerHeight),
            new THREE.Vector2(-width / 2, towerHeight)
        ];
    } else if (profileType === 'tower_corner_wrap_right') {
        // Front Cantilever Beam
        blocks.push({ w: width, h: height, d: depth, x: 0, y: 0, z: zOffset, radii: [0, 0, 0, 0], slot: 'fascia_frame' });
        // Side Return Cantilever Beam (wrapping around right corner onto side wall)
        blocks.push({ w: depth, h: height, d: returnLength, x: width / 2 - depth / 2, y: 0, z: zOffset - (returnLength / 2) * facing, radii: [0, 0, 0, 0], slot: 'fascia_side' });
        // Vertical Accent Tower (extending up to terrace level)
        blocks.push({ w: towerWidth, h: towerHeight, d: towerDepth, x: width / 2 - towerWidth / 2, y: 0, z: zOffset + ((towerDepth - depth) / 2) * facing, radii: [0, 0, 0, 0], slot: 'fascia_front' });

        computedPts = [
            new THREE.Vector2(-width / 2, 0),
            new THREE.Vector2(width / 2, 0),
            new THREE.Vector2(width / 2, towerHeight),
            new THREE.Vector2(width / 2 - towerWidth, towerHeight),
            new THREE.Vector2(width / 2 - towerWidth, height),
            new THREE.Vector2(-width / 2, height)
        ];
    } else if (profileType === 'corner_wrap_left') {
        // Front Cantilever Beam
        blocks.push({ w: width, h: height, d: depth, x: 0, y: 0, z: zOffset, radii: [0, 0, 0, 0], slot: 'fascia_frame' });
        // Side Return Cantilever Beam
        blocks.push({ w: depth, h: height, d: returnLength, x: -width / 2 + depth / 2, y: 0, z: zOffset - (returnLength / 2) * facing, radii: [0, 0, 0, 0], slot: 'fascia_side' });

        computedPts = [
            new THREE.Vector2(-width / 2, 0),
            new THREE.Vector2(width / 2, 0),
            new THREE.Vector2(width / 2, height),
            new THREE.Vector2(-width / 2, height)
        ];
    } else if (profileType === 'corner_wrap_right') {
        // Front Cantilever Beam
        blocks.push({ w: width, h: height, d: depth, x: 0, y: 0, z: zOffset, radii: [0, 0, 0, 0], slot: 'fascia_frame' });
        // Side Return Cantilever Beam
        blocks.push({ w: depth, h: height, d: returnLength, x: width / 2 - depth / 2, y: 0, z: zOffset - (returnLength / 2) * facing, radii: [0, 0, 0, 0], slot: 'fascia_side' });

        computedPts = [
            new THREE.Vector2(-width / 2, 0),
            new THREE.Vector2(width / 2, 0),
            new THREE.Vector2(width / 2, height),
            new THREE.Vector2(-width / 2, height)
        ];
    } else if (profileType === 'c_wrap_terrace_frame') {
        // Lower Front Cantilever Beam
        blocks.push({ w: width, h: height, d: depth, x: 0, y: 0, z: zOffset, radii: [0, 0, 0, 0], slot: 'fascia_frame' });
        // Side Return Cantilever Beam
        blocks.push({ w: depth, h: height, d: returnLength, x: -width / 2 + depth / 2, y: 0, z: zOffset - (returnLength / 2) * facing, radii: [0, 0, 0, 0], slot: 'fascia_side' });
        // Vertical Accent Tower to Terrace
        blocks.push({ w: towerWidth, h: towerHeight, d: towerDepth, x: -width / 2 + towerWidth / 2, y: 0, z: zOffset + ((towerDepth - depth) / 2) * facing, radii: [0, 0, 0, 0], slot: 'fascia_front' });
        // Upper Terrace Overhang Return Arm
        const tArm = topArm !== undefined ? topArm : width;
        blocks.push({ w: tArm, h: thick, d: depth, x: -width / 2 + tArm / 2, y: towerHeight - thick, z: zOffset, radii: [0, 0, 0, 0], slot: 'fascia_frame' });

        computedPts = [
            new THREE.Vector2(-width / 2, 0),
            new THREE.Vector2(width / 2, 0),
            new THREE.Vector2(width / 2, height),
            new THREE.Vector2(-width / 2 + towerWidth, height),
            new THREE.Vector2(-width / 2 + towerWidth, towerHeight - thick),
            new THREE.Vector2(-width / 2 + tArm, towerHeight - thick),
            new THREE.Vector2(-width / 2 + tArm, towerHeight),
            new THREE.Vector2(-width / 2, towerHeight)
        ];
    }

    // Generate Recessed Under-Soffit Spotlights for continuous wraps and towers
    if (hasSpotlights && (profileType.includes('wrap') || profileType.includes('tower'))) {
        const count = Math.max(1, spotlightCount);
        const frontMargin = 25;
        const span = Math.max(10, width - 2 * frontMargin);
        for (let i = 0; i < count; i++) {
            const t = count > 1 ? i / (count - 1) : 0.5;
            const spX = -width / 2 + frontMargin + t * span;
            spotlights.push({
                x: spX,
                y: 0.5,
                z: zOffset,
                r: 4,
                h: 1.5,
                slot: 'light_lens'
            });
        }

        // Return arm spotlights
        const isLeft = profileType.includes('left') || profileType === 'c_wrap_terrace_frame';
        const retCount = Math.max(1, Math.floor(returnLength / 60));
        const cornerX = isLeft ? (-width / 2 + depth / 2) : (width / 2 - depth / 2);
        for (let j = 0; j < retCount; j++) {
            const tRet = (j + 0.5) / retCount;
            const retZ = zOffset - (tRet * returnLength) * facing;
            spotlights.push({
                x: cornerX,
                y: 0.5,
                z: retZ,
                r: 4,
                h: 1.5,
                slot: 'light_lens'
            });
        }
    }

    return {
        width,
        height,
        depth,
        thick,
        zOffset,
        blocks,
        fillets,
        spotlights,
        computedPts
    };
};

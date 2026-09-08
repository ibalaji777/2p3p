import Konva from 'konva';

/**
 * Passive 2D Renderer for Moldings, Wall Trims, and Baseboards.
 * Computes 2D ribbon offset polygon relative to host wall geometry and updates Konva visual nodes.
 */
export const renderMolding2D = (moldingEntity, visualGroup, moldingPoly, hitBox) => {
    const wall = moldingEntity.wall;
    if (!wall || !wall.startAnchor || !wall.endAnchor) return;

    const start = typeof wall.startAnchor.position === 'function' ? wall.startAnchor.position() : wall.startAnchor;
    const end = typeof wall.endAnchor.position === 'function' ? wall.endAnchor.position() : wall.endAnchor;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const wallLen = Math.hypot(dx, dy);

    if (!moldingEntity.isCustomWidth || moldingEntity.width === undefined || Math.abs(moldingEntity.width - wallLen) < 5) {
        moldingEntity.width = wallLen;
        moldingEntity.t = 0.5;
    }

    const t = moldingEntity.t !== undefined ? moldingEntity.t : 0.5;
    const cx = start.x + dx * t;
    const cy = start.y + dy * t;
    const th = wall.thickness || wall.config?.thickness || 8;
    const wallAngle = Math.atan2(dy, dx);

    let nx = -Math.sin(wallAngle);
    let ny = Math.cos(wallAngle);

    if (moldingEntity.side === 'right') {
        nx = -nx;
        ny = -ny;
    }

    let px, py;
    let currentWidth = moldingEntity.width || wallLen;
    const isFullLength = !moldingEntity.isCustomWidth || Math.abs(currentWidth - wallLen) < 5;

    if (isFullLength && wall.wallShapeData) {
        const startTrue = wall.wallShapeData.startData.trueCorners || wall.wallShapeData.startData.corners;
        const endTrue = wall.wallShapeData.endData.trueCorners || wall.wallShapeData.endData.corners;
        const edgeStart = moldingEntity.side === 'right' ? startTrue[1] : startTrue[0];
        const edgeEnd = moldingEntity.side === 'right' ? endTrue[1] : endTrue[0];

        currentWidth = Math.hypot(edgeEnd.x - edgeStart.x, edgeEnd.y - edgeStart.y);
        const edgeCx = (edgeStart.x + edgeEnd.x) / 2;
        const edgeCy = (edgeStart.y + edgeEnd.y) / 2;

        const depthOffset = Math.max(2, (moldingEntity.depth || 2) / 2);
        px = edgeCx + nx * depthOffset;
        py = edgeCy + ny * depthOffset;
    } else {
        const offsetDist = th / 2 + Math.max(2, (moldingEntity.depth || 2) / 2);
        px = cx + nx * offsetDist;
        py = cy + ny * offsetDist;
    }

    if (visualGroup) {
        visualGroup.position({ x: px, y: py });
        visualGroup.rotation((wallAngle * 180) / Math.PI);
    }

    const visualDepth = Math.max(4, Math.abs(moldingEntity.depth || 2));

    if (moldingPoly) {
        if (isFullLength && wall.wallShapeData) {
            const baseVerts = (moldingEntity.side === 'right' ? wall.wallShapeData.backVerts : wall.wallShapeData.frontVerts) || [];
            const toLocal = (p) => {
                const lx = p.x - px;
                const ly = p.y - py;
                const cos = Math.cos(-wallAngle);
                const sin = Math.sin(-wallAngle);
                return { x: lx * cos - ly * sin, y: lx * sin + ly * cos };
            };

            if (baseVerts.length > 2) {
                const innerPts = baseVerts.map(toLocal);
                const outerPts = baseVerts.map(v => toLocal({ x: v.x + nx * visualDepth, y: v.y + ny * visualDepth })).reverse();
                const moldPts = [];
                innerPts.forEach(p => moldPts.push(p.x, p.y));
                outerPts.forEach(p => moldPts.push(p.x, p.y));
                moldingPoly.points(moldPts);
            } else {
                const startTrue = wall.wallShapeData.startData.trueCorners || wall.wallShapeData.startData.corners;
                const endTrue = wall.wallShapeData.endData.trueCorners || wall.wallShapeData.endData.corners;
                const edgeStart = moldingEntity.side === 'right' ? startTrue[1] : startTrue[0];
                const edgeEnd = moldingEntity.side === 'right' ? endTrue[1] : endTrue[0];

                const pStart = start;
                const vStart = { x: edgeStart.x - pStart.x, y: edgeStart.y - pStart.y };
                const pEnd = end;
                const vEnd = { x: edgeEnd.x - pEnd.x, y: edgeEnd.y - pEnd.y };

                const scaleOuter = (th / 2 + visualDepth) / (th / 2);
                const outerStart = { x: pStart.x + vStart.x * scaleOuter, y: pStart.y + vStart.y * scaleOuter };
                const outerEnd = { x: pEnd.x + vEnd.x * scaleOuter, y: pEnd.y + vEnd.y * scaleOuter };

                const ls = toLocal(edgeStart);
                const le = toLocal(edgeEnd);
                const loe = toLocal(outerEnd);
                const los = toLocal(outerStart);

                moldingPoly.points([ls.x, ls.y, le.x, le.y, loe.x, loe.y, los.x, los.y]);
            }
        } else {
            moldingPoly.points([
                -currentWidth / 2, -visualDepth / 2,
                currentWidth / 2, -visualDepth / 2,
                currentWidth / 2, visualDepth / 2,
                -currentWidth / 2, visualDepth / 2
            ]);
        }
    }

    if (hitBox) {
        hitBox.width(currentWidth);
        hitBox.height(visualDepth + 10);
        hitBox.x(-currentWidth / 2);
        hitBox.y(-visualDepth / 2 - 5);
    }
};

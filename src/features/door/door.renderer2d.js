import Konva from 'konva';

/**
 * 2D CAD architectural representation for doors.
 * Renders door swing arcs, leaves, thresholds, sidelights, and opening mechanisms on Konva groups.
 * 
 * @param {Konva.Group} group - Parent Konva container
 * @param {Object} entity - Door entity instance
 */
export function renderDoor2D(group, entity) {
    if (!group || !entity) return;

    const hw = entity.width / 2;
    const thick = entity.wall?.thickness || entity.wall?.config?.thickness || entity.thick || 20;
    const slWidth = (entity.hasSidelights && (!entity.doorShape || entity.doorShape === 'square') && !['pocket', 'sliding'].includes(entity.doorType)) ? Math.min(60, entity.width * 0.22) : 0;
    const doorW = entity.width - (slWidth * 2);
    const doorHW = doorW / 2;
    const pivotBase = hw - slWidth;

    // Sidelights glass panels
    if (slWidth > 0) {
        group.add(new Konva.Rect({ x: -hw, y: -thick / 2, width: slWidth, height: thick, fill: '#bae6fd', opacity: 0.3, stroke: '#9ca3af' }));
        group.add(new Konva.Rect({ x: hw - slWidth, y: -thick / 2, width: slWidth, height: thick, fill: '#bae6fd', opacity: 0.3, stroke: '#9ca3af' }));
    }

    if (entity.doorType === 'single' || !entity.doorType) {
        const hingeX = (entity.side === 1) ? pivotBase : -pivotBase;
        const arcRot = (entity.side === 1) ? ((entity.facing === 1) ? 180 : 90) : ((entity.facing === 1) ? 270 : 0);
        group.add(
            new Konva.Arc({ x: hingeX, y: 0, innerRadius: doorW, outerRadius: doorW, angle: 90, stroke: '#9ca3af', dash: [4, 4], rotation: arcRot }),
            new Konva.Line({ points: [hingeX, 0, hingeX, -doorW * (entity.facing || 1)], stroke: '#374151', strokeWidth: 3 })
        );
    } else if (entity.doorType === 'double' || entity.doorType === 'french') {
        const arcRotL = entity.facing === 1 ? 270 : 0;
        const arcRotR = entity.facing === 1 ? 180 : 90;
        group.add(
            new Konva.Arc({ x: -pivotBase, y: 0, innerRadius: doorHW, outerRadius: doorHW, angle: 90, rotation: arcRotL, stroke: '#9ca3af', dash: [4, 4] }),
            new Konva.Line({ points: [-pivotBase, 0, -pivotBase, -doorHW * (entity.facing || 1)], stroke: '#374151', strokeWidth: 3 }),
            new Konva.Arc({ x: pivotBase, y: 0, innerRadius: doorHW, outerRadius: doorHW, angle: 90, rotation: arcRotR, stroke: '#9ca3af', dash: [4, 4] }),
            new Konva.Line({ points: [pivotBase, 0, pivotBase, -doorHW * (entity.facing || 1)], stroke: '#374151', strokeWidth: 3 })
        );
    } else if (entity.doorType === 'sliding' || entity.doorType === 'double_sliding') {
        const off = thick * 0.2;
        group.add(
            new Konva.Line({ points: [-doorHW, -off, 0, -off], stroke: '#374151', strokeWidth: 3 }),
            new Konva.Line({ points: [0, off, doorHW, off], stroke: '#374151', strokeWidth: 3 })
        );
    } else if (entity.doorType === 'pocket') {
        const slideDir = entity.facing === 1 ? 1 : -1;
        group.add(new Konva.Line({ points: [-doorHW, 0, doorHW, 0], stroke: '#374151', strokeWidth: 3 }));
        const trackStart = slideDir === 1 ? doorHW : -doorHW;
        const trackEnd = trackStart + (doorW * slideDir);
        group.add(new Konva.Line({ points: [trackStart, 0, trackEnd, 0], stroke: '#374151', strokeWidth: 3, dash: [4, 4] }));
    } else if (entity.doorType === 'pivot') {
        const pivotX = entity.side === 1 ? pivotBase - 10 : -pivotBase + 10;
        const arcRot = entity.side === 1 ? (entity.facing === 1 ? 180 : 90) : (entity.facing === 1 ? 270 : 0);
        group.add(
            new Konva.Line({ points: [pivotX, doorW * 0.2 * (entity.facing || 1), pivotX, -doorW * 0.8 * (entity.facing || 1)], stroke: '#374151', strokeWidth: 3 }),
            new Konva.Arc({ x: pivotX, y: 0, innerRadius: doorW * 0.8, outerRadius: doorW * 0.8, angle: 90, rotation: arcRot, stroke: '#9ca3af', dash: [4, 4] })
        );
    } else if (entity.doorType === 'folding') {
        const qw = doorW / 4;
        group.add(
            new Konva.Line({ points: [-doorHW, 0, -doorHW + qw, -qw * (entity.facing || 1)], stroke: '#374151', strokeWidth: 3 }),
            new Konva.Line({ points: [-doorHW + qw, -qw * (entity.facing || 1), 0, 0], stroke: '#374151', strokeWidth: 3 })
        );
    }
}

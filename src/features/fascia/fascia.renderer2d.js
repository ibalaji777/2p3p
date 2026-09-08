import Konva from 'konva';

/**
 * Passive 2D Renderer for Elevation Fascias.
 * Renders the wall-bound rectangle and dashed projection overhang on Konva 2D plan.
 */
export const renderFascia2D = (group, entity) => {
    const hw = (entity.width || 100) / 2;
    const thick = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || 4) : (entity.thick || 4);
    const w = entity.width || 100;
    const h = thick;

    const rect = new Konva.Rect({
        x: -hw,
        y: -h / 2,
        width: w,
        height: h,
        fill: '#60a5fa',
        stroke: '#2563eb',
        strokeWidth: 2,
        opacity: 0.5
    });
    group.add(rect);

    const d = entity.depth || 40;
    const projDir = entity.facing === 1 ? 1 : -1;
    const projY = projDir === 1 ? h / 2 : -h / 2 - d;
    const projRect = new Konva.Rect({
        x: -hw,
        y: projY,
        width: w,
        height: d,
        stroke: '#2563eb',
        strokeWidth: 1,
        dash: [4, 4]
    });
    group.add(projRect);
};

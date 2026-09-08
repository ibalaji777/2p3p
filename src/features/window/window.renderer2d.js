import Konva from 'konva';
import { WINDOW_TYPES } from './window.registry.js';

/**
 * 2D CAD architectural representation for windows.
 * Renders jamb caps, sill boundaries, soft blue glass tint, sliding sashes, casement swing arcs,
 * louver slats, bay projections, and security grille indicators on Konva groups.
 * 
 * @param {Konva.Group} group - Parent Konva container
 * @param {Object} entity - Window entity instance
 */
export function renderWindow2D(group, entity) {
    if (!group || !entity) return;

    const hw = entity.width / 2;
    const thick = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || entity.thick || 20) : (entity.thick || 20);
    const halfThick = thick / 2;
    const wConf = WINDOW_TYPES[entity.windowType] || WINDOW_TYPES.sliding_std;

    // 1. Wall Cutout End Cap Lines (Left & Right Jamb Termination Caps)
    group.add(new Konva.Line({ points: [-hw, -halfThick, -hw, halfThick], stroke: '#374151', strokeWidth: 2.5 }));
    group.add(new Konva.Line({ points: [hw, -halfThick, hw, halfThick], stroke: '#374151', strokeWidth: 2.5 }));

    // 2. Wall Sill Edge Boundary Lines (Outer & Inner Sill Limits)
    group.add(new Konva.Line({ points: [-hw, -halfThick, hw, -halfThick], stroke: '#6b7280', strokeWidth: 1.5 }));
    group.add(new Konva.Line({ points: [-hw, halfThick, hw, halfThick], stroke: '#6b7280', strokeWidth: 1.5 }));

    // 3. Glass Pane Body (Soft Architectural Blue Fill)
    group.add(new Konva.Rect({
        x: -hw + 3,
        y: -thick * 0.2,
        width: entity.width - 6,
        height: thick * 0.4,
        fill: '#e0f2fe',
        opacity: 0.45,
        stroke: '#38bdf8',
        strokeWidth: 1
    }));

    // 4. Window Type Specific Architectural Symbols
    if (wConf.type === 'sliding') {
        const off = thick * 0.16;
        group.add(new Konva.Line({ points: [-hw + 4, -off, 2, -off], stroke: '#1f2937', strokeWidth: 3, lineCap: 'round' }));
        group.add(new Konva.Line({ points: [-2, off, hw - 4, off], stroke: '#1f2937', strokeWidth: 3, lineCap: 'round' }));
    } else if (wConf.type === 'casement' || wConf.type === 'traditional') {
        const hingeX = (entity.side === 1) ? hw : -hw;
        const arcRot = (entity.side === 1) ? ((entity.facing === 1) ? 180 : 90) : ((entity.facing === 1) ? 270 : 0);
        group.add(new Konva.Arc({ x: hingeX, y: 0, innerRadius: entity.width * 0.8, outerRadius: entity.width * 0.8, angle: 60, stroke: '#9ca3af', dash: [4, 4], rotation: arcRot }));
        group.add(new Konva.Line({ points: [hingeX, 0, hingeX, -entity.width * 0.7 * (entity.facing || 1)], stroke: '#1f2937', strokeWidth: 3, lineCap: 'round' }));
    } else if (wConf.type === 'louver') {
        const numSlats = 4;
        const step = (entity.width - 8) / numSlats;
        for (let i = 0; i < numSlats; i++) {
            const x = -hw + 4 + i * step;
            group.add(new Konva.Line({ points: [x, -thick * 0.25, x + step * 0.8, thick * 0.25], stroke: '#374151', strokeWidth: 2 }));
        }
    } else if (wConf.type === 'bay') {
        const offset = 14 * (entity.facing === 1 ? 1 : -1);
        group.add(new Konva.Line({ points: [-hw, 0, -hw + 10, offset, hw - 10, offset, hw, 0], stroke: '#1f2937', strokeWidth: 3, lineCap: 'round' }));
    } else { // Fixed
        group.add(new Konva.Line({ points: [-hw + 4, 0, hw - 4, 0], stroke: '#1f2937', strokeWidth: 3 }));
    }

    // 5. Grill Pattern Line Indicator (4-Column Iron Grid Indicators)
    const grillePattern = entity.grillePattern || 'grid';
    if (grillePattern && grillePattern !== 'none') {
        const numCols = 4;
        const colStep = (entity.width - 8) / numCols;
        for (let k = 1; k < numCols; k++) {
            const xTick = -hw + 4 + k * colStep;
            group.add(new Konva.Line({ points: [xTick, -halfThick * 0.6, xTick, halfThick * 0.6], stroke: '#1c1c1c', strokeWidth: 2, dash: [2, 2] }));
        }
    }
}

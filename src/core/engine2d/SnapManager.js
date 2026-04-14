import { SNAP_DIST } from '../registry.js';

// ==========================================
// SOLID Snapping Strategies
// ==========================================

class SnapStrategy {
    snap(pos, planner, config) { return null; }
}

export class AnchorSnapStrategy extends SnapStrategy {
    snap(pos, planner, config) {
        if (!config.anchors || !planner.anchors) return null;
        let bestDist = config.threshold;
        let result = null;
        for (let a of planner.anchors) {
            let dist = Math.hypot(a.x - pos.x, a.y - pos.y);
            if (dist < bestDist) {
                bestDist = dist;
                result = { x: a.x, y: a.y, distance: dist, target: a, type: 'anchor' };
            }
        }
        return result;
    }
}

export class ReferenceWallSnapStrategy extends SnapStrategy {
    snap(pos, planner, config) {
        if (!config.referenceWalls || !planner.referenceGroup) return null;
        let bestDist = config.threshold;
        let result = null;
        let allReferenceWalls = planner.referenceGroup.getChildren();
        for (let line of allReferenceWalls) {
            let pts = line.points();
            if (pts && pts.length === 4) {
                let d1 = Math.hypot(pos.x - pts[0], pos.y - pts[1]);
                let d2 = Math.hypot(pos.x - pts[2], pos.y - pts[3]);
                if (d1 < 40 && d1 < bestDist) { bestDist = 0; result = { x: pts[0], y: pts[1], distance: 0, target: line, type: 'reference_endpoint' }; }
                else if (d2 < 40 && d2 < bestDist) { bestDist = 0; result = { x: pts[2], y: pts[3], distance: 0, target: line, type: 'reference_endpoint' }; }
                else {
                    let proj = planner.getClosestPointOnSegment(pos, { x: pts[0], y: pts[1] }, { x: pts[2], y: pts[3] });
                    let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    if (dist < bestDist) { bestDist = dist; result = { x: proj.x, y: proj.y, distance: dist, target: line, type: 'reference_wall' }; }
                }
            }
        }
        return result;
    }
}

export class ShapeSnapStrategy extends SnapStrategy {
    snap(pos, planner, config) {
        if (!config.shapes || !planner.shapes) return null;
        let bestDist = config.threshold;
        let result = null;
        for (let s of planner.shapes) {
            if (config.ignoreShapes.includes(s)) continue;
            if (s.type !== 'shape_rect' && s.type !== 'shape_polygon') continue;
            
            let pts = []; 
            if (s.type === 'shape_rect') { 
                const w = s.params.width; const h = s.params.height; 
                pts = [ {x: -w/2, y: -h/2}, {x: w/2, y: -h/2}, {x: w/2, y: h/2}, {x: -w/2, y: h/2} ]; 
            } else { 
                pts = s.params.points; 
            }
            if (!pts) continue;

            const transform = s.group.getTransform();
            for (let i = 0; i < pts.length; i++) {
                const p1 = transform.point(pts[i]); 
                const p2 = transform.point(pts[(i + 1) % pts.length]);
                
                let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y);
                if (d1 < bestDist) { bestDist = d1; result = { x: p1.x, y: p1.y, distance: d1, target: s, type: 'shape_endpoint' }; }
                
                const proj = planner.getClosestPointOnSegment(pos, p1, p2);
                const dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                if (dist < bestDist) { bestDist = dist; result = { x: proj.x, y: proj.y, distance: dist, target: s, type: 'shape_edge' }; }
            }
        }
        return result;
    }
}

export class WallSnapStrategy extends SnapStrategy {
    snap(pos, planner, config) {
        if (!config.walls || !planner.walls) return null;
        let bestDist = config.threshold;
        let result = null;
        for (let w of planner.walls) {
            if (config.ignoreWalls.includes(w)) continue;
            let proj = planner.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
            
            if (w.type === 'railing') {
                const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                const vdx = p2.x - p1.x, vdy = p2.y - p1.y, vlen = Math.hypot(vdx, vdy);
                if (vlen > 0) {
                    const n = { x: -vdy/vlen, y: vdx/vlen }, ht = (w.thickness || w.config.thickness) / 2;
                    const e1 = { x: proj.x + n.x * ht, y: proj.y + n.y * ht };
                    const e2 = { x: proj.x - n.x * ht, y: proj.y - n.y * ht };
                    const d1 = Math.hypot(pos.x - e1.x, pos.y - e1.y);
                    const d2 = Math.hypot(pos.x - e2.x, pos.y - e2.y);
                    if (d1 < bestDist) { bestDist = d1; result = { x: e1.x, y: e1.y, distance: d1, target: w, type: 'wall_edge' }; }
                    if (d2 < bestDist) { bestDist = d2; result = { x: e2.x, y: e2.y, distance: d2, target: w, type: 'wall_edge' }; }
                }
                continue;
            }

            let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
            if (dist < bestDist) {
                bestDist = dist;
                result = { x: proj.x, y: proj.y, distance: dist, target: w, type: 'wall_center' };
            }
        }
        return result;
    }
}

// ==========================================
// SnapManager Core
// ==========================================

export class SnapManager {
    constructor(planner) {
        this.planner = planner;
        this.strategies = [
            new AnchorSnapStrategy(),
            new ReferenceWallSnapStrategy(),
            new ShapeSnapStrategy(),
            new WallSnapStrategy()
        ];
    }

    resolveSnap(pos, options = {}) {
        const config = { grid: false, anchors: true, walls: true, shapes: true, referenceWalls: true, threshold: SNAP_DIST, ignoreWalls: [], ignoreShapes: [], ...options };
        let result = { x: pos.x, y: pos.y, snapped: false, target: null, type: 'none', distance: config.threshold };

        if (config.grid) {
            result.x = this.planner.snap(pos.x);
            result.y = this.planner.snap(pos.y);
        }

        for (const strategy of this.strategies) {
            const snapResult = strategy.snap(pos, this.planner, config);
            if (snapResult && snapResult.distance <= result.distance) {
                result = { ...snapResult, snapped: true };
                if (result.type === 'anchor') break; // Anchors hold absolute snapping priority
            }
        }
        if (result.snapped) console.log(`[SnapManager] Event: Snapped to [${result.type.toUpperCase()}] at (${result.x.toFixed(1)}, ${result.y.toFixed(1)}) | Target:`, result.target);
        return result;
    }
}
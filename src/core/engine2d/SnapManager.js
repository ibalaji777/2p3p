import { SNAP_DIST, GRID } from '../registry.js';

// ==========================================
// SOLID Snapping Strategies
// ==========================================

class SnapStrategy {
    snap(pos, planner, config) { return null; }
}

export class GridSnapStrategy extends SnapStrategy {
    // 1. Grid Snapping
    snap(pos, planner, config) {
        if (!config.grid) return null;
        const gridSize = config.gridSize || GRID || 20;
        const snappedX = Math.round(pos.x / gridSize) * gridSize;
        const snappedY = Math.round(pos.y / gridSize) * gridSize;
        const dist = Math.hypot(snappedX - pos.x, snappedY - pos.y);
        
        if (dist <= config.threshold) {
            return { x: snappedX, y: snappedY, distance: dist, target: null, type: 'grid' };
        }
        return null;
    }
}

export class AlignmentSnapStrategy extends SnapStrategy {
    // 2. Alignment Snapping (Smart Guides)
    snap(pos, planner, config) {
        if (!config.smartGuides) return null;
        let bestX = pos.x, bestY = pos.y;
        let bestDistX = config.threshold, bestDistY = config.threshold;
        let snappedX = false, snappedY = false, targetX = null, targetY = null;

        const nodes = [...(planner.furniture || []), ...(planner.shapes || []), ...(planner.widgetLayer ? planner.widgetLayer.getChildren() : [])];

        for (const node of nodes) {
            if ((config.ignoreNodes && config.ignoreNodes.includes(node)) || !node.group) continue;
            
            const rect = node.group.getClientRect({ skipShadow: true });
            if (rect.width === 0 || rect.height === 0) continue;

            const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            const targetsX = [rect.x, center.x, rect.x + rect.width];
            const targetsY = [rect.y, center.y, rect.y + rect.height];

            for (let tx of targetsX) { const dx = Math.abs(pos.x - tx); if (dx < bestDistX) { bestDistX = dx; bestX = tx; snappedX = true; targetX = node; } }
            for (let ty of targetsY) { const dy = Math.abs(pos.y - ty); if (dy < bestDistY) { bestDistY = dy; bestY = ty; snappedY = true; targetY = node; } }
        }

        if (snappedX || snappedY) {
            const dist = Math.hypot(pos.x - bestX, pos.y - bestY);
            return { x: bestX, y: bestY, distance: dist, target: targetX || targetY, type: 'alignment_guide', guides: { x: snappedX ? bestX : null, y: snappedY ? bestY : null } };
        }

        return null;
    }
}

export class AnchorSnapStrategy extends SnapStrategy {
    // 3. Object Snapping (OSnap - Corner/Endpoint)
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
    // 4. Object Snapping (Blueprint Reference Lines)
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
    // 5. Edge / Surface Snapping (Custom Shapes)
    snap(pos, planner, config) {
        if (!config.shapes || !planner.shapes) return null;
        let bestDist = config.threshold;
        let result = null;
        for (let s of planner.shapes) {
            if (config.ignoreShapes && config.ignoreShapes.includes(s)) continue;
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
    // 6. Edge / Surface Snapping (Walls & Railings)
    snap(pos, planner, config) {
        if (!config.walls || !planner.walls) return null;
        let bestDist = config.threshold;
        let result = null;
        for (let w of planner.walls) {
            if (config.ignoreWalls && config.ignoreWalls.includes(w)) continue;
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
            new WallSnapStrategy(),
            new AlignmentSnapStrategy(), // Smart Guides Priority
            new GridSnapStrategy()       // Grid Fallback Priority
        ];
    }

    /**
     * Resolves the best snap point using layered strategies.
     * Includes Axis Constraint, Grid Snap, Smart Guides, and Magnetic Snapping.
     */
    resolveSnap(pos, options = {}) {
        const config = { 
            grid: false, gridSize: GRID || 20, 
            anchors: true, walls: true, shapes: true, referenceWalls: true, smartGuides: true, 
            threshold: SNAP_DIST || 25, 
            ignoreWalls: [], ignoreShapes: [], ignoreNodes: [],
            axisLock: false, startPos: null, // Constraint-Based Interactions
            ...options 
        };
        
        // Constraint-Based Interaction: Axis Locking (Shift Key emulation)
        let currentPos = { x: pos.x, y: pos.y };
        if (config.axisLock && config.startPos) {
            const dx = Math.abs(currentPos.x - config.startPos.x), dy = Math.abs(currentPos.y - config.startPos.y);
            if (dx > dy) currentPos.y = config.startPos.y; else currentPos.x = config.startPos.x;
        }

        let result = { x: currentPos.x, y: currentPos.y, snapped: false, target: null, type: 'none', distance: config.threshold, guides: null };

        for (const strategy of this.strategies) {
            const snapResult = strategy.snap(currentPos, this.planner, config);
            if (snapResult && snapResult.distance < result.distance) {
                result = { ...snapResult, snapped: true };
                // Magnetic Snapping Hard Lock: Priority objects capture exactly
                if (result.type === 'anchor' || result.type === 'reference_endpoint') break; 
            }
        }
        
        // Post-Process: Re-apply Axis Constraint if snapping pulled the object off-axis
        if (config.axisLock && config.startPos) {
            const dx = Math.abs(result.x - config.startPos.x), dy = Math.abs(result.y - config.startPos.y);
            if (dx > dy) result.y = config.startPos.y; else result.x = config.startPos.x;
        }

        // if (result.snapped) console.log(`[SnapManager] Snapped to [${result.type.toUpperCase()}]`);
        return result;
    }
}
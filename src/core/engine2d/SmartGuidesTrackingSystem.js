import Konva from 'konva';
import { SNAP_DIST, GRID } from '../registry.js';

// ==========================================
// SOLID Snapping Strategies
// ==========================================

class SnapStrategy {
    snap(pos, planner, config) { return null; }
}

export class GridSnapStrategy extends SnapStrategy {
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

export class SmartGuidesTrackingSystem {
    constructor(planner) {
        this.planner = planner;
        this.layer = planner.uiLayer;
        this.guideGroup = new Konva.Group({ listening: false });
        this.layer.add(this.guideGroup);
        
        this.config = {
            alignThreshold: 20,          // Distance to show dashed guides
            snapThreshold: 8,            // Distance to snap/lock position
            solidColor: '#3498db',       // Solid blue for locked reference
            dashedColor: '#2ecc71',      // Green for potential reference
            guideColor: '#2ecc71',       // Green alignment line
            crosshairColor: '#2ecc71'    // Green dynamic crosshairs
        };

        this.lastPointer = { x: 0, y: 0 };
        this.lastValidDx = 0;
        this.lastValidDy = 0;
        this.activeSnap = null;

        this.strategies = [
            new AnchorSnapStrategy(),
            new ReferenceWallSnapStrategy(),
            new ShapeSnapStrategy(),
            new WallSnapStrategy(),
            new AlignmentSnapStrategy(), // Smart Guides Priority
            new GridSnapStrategy()       // Grid Fallback Priority
        ];
    }

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

        return result;
    }

    clear() {
        this.guideGroup.destroyChildren();
        this.layer.batchDraw();
        this.activeSnap = null;
    }

    projectPointOntoLine(P, A, B) {
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq === 0) return { x: A.x, y: A.y }; 

        let t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / lengthSq;
        // Clamp to segment so it behaves exactly like the HTML demo
        t = Math.max(0, Math.min(1, t));

        return {
            x: A.x + t * dx,
            y: A.y + t * dy
        };
    }

    distance(p1, p2) {
        return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }

    snapAndAlign(dragNode, isTransforming = false) {
        this.guideGroup.destroyChildren();

        if (this.planner.tool !== 'select' || dragNode.isWallPoly || dragNode.isStairNodeHandle || (dragNode.name() && dragNode.name().includes('anchor'))) {
            this.layer.batchDraw();
            return;
        }

        const scale = this.planner.stage.scaleX();
        const alignThresh = this.config.alignThreshold / scale;
        const snapThresh = this.config.snapThreshold / scale;

        // 1. Update Hysteresis / Velocity Tracking
        const pointer = this.planner.getPointerPos ? this.planner.getPointerPos() : this.planner.stage.getPointerPosition();
        if (pointer) {
            const dx = pointer.x - this.lastPointer.x;
            const dy = pointer.y - this.lastPointer.y;
            if (Math.abs(dx) > 1.5 / scale) this.lastValidDx = dx;
            if (Math.abs(dy) > 1.5 / scale) this.lastValidDy = dy;
            this.lastPointer = { ...pointer };
        }

        // Get Object Bounds (Absolute coords)
        // Include stroke so the tracking and guides align perfectly with the visual outer border (corner)
        const dragRect = dragNode.getClientRect({ skipShadow: true });
        if (dragRect.width === 0 || dragRect.height === 0) return;

        // Pixel-Perfect Rendering: Round values to prevent half-pixel shifts
        const rX = Math.round(dragRect.x);
        const rY = Math.round(dragRect.y);
        const rW = Math.round(dragRect.width);
        const rH = Math.round(dragRect.height);

        // 2. Calculate Dynamic Leading Corner (Handles Top-Left and Center origins via absolute bounds)
        const centerX = rX + rW / 2;
        const centerY = rY + rH / 2;
        let leadPoint = { x: centerX, y: centerY };

        // Determine leading corner based on movement direction
        if (this.lastValidDx > 0) leadPoint.x = rX + rW;      // Moving Right
        else if (this.lastValidDx < 0) leadPoint.x = rX;                  // Moving Left

        if (this.lastValidDy > 0) leadPoint.y = rY + rH;     // Moving Down
        else if (this.lastValidDy < 0) leadPoint.y = rY;                  // Moving Up

        // Force exact pixel coordinate for the leading point
        leadPoint.x = Math.round(leadPoint.x);
        leadPoint.y = Math.round(leadPoint.y);

        // Transform absolute leadPoint to local UI Layer coordinates for drawing
        const inverseTransform = this.layer.getAbsoluteTransform().copy().invert();

        // 3. Gather Geometry (Lines)
        let segments = [];

        // Add Walls
        if (this.planner.walls) {
            this.planner.walls.forEach(w => {
                if (w.wallGroup === dragNode || w.poly === dragNode) return;
                const p1 = w.startAnchor.node.getAbsolutePosition();
                const p2 = w.endAnchor.node.getAbsolutePosition();
                segments.push({ 
                    p1: { x: Math.round(p1.x), y: Math.round(p1.y) }, 
                    p2: { x: Math.round(p2.x), y: Math.round(p2.y) } 
                });
            });
        }

        // Add Bounding Boxes of other elements
        const extraNodes = [...(this.planner.furnitureLayer ? this.planner.furnitureLayer.getChildren() : []), 
                            ...(this.planner.widgetLayer ? this.planner.widgetLayer.getChildren() : [])];
        if (this.planner.shapes) extraNodes.push(...this.planner.shapes.map(s => s.group));
        if (this.planner.stairs) extraNodes.push(...this.planner.stairs.map(s => s.group).filter(Boolean));
        if (this.planner.roofs) extraNodes.push(...this.planner.roofs.map(r => r.group).filter(Boolean));
        
        extraNodes.forEach(node => {
            if (!node || node === dragNode || node === dragNode.parent || node.isAncestorOf(dragNode) || dragNode.isAncestorOf(node)) return;
            const targetRect = node.getClientRect({ skipShadow: true });
            if (targetRect.width === 0 || targetRect.height === 0) return;
            
            // Limit checks to nearby
            const distSq = Math.pow(centerX - (targetRect.x + targetRect.width/2), 2) + Math.pow(centerY - (targetRect.y + targetRect.height/2), 2);
            if (distSq > Math.pow(3000, 2)) return;
            
            const trX = Math.round(targetRect.x);
            const trY = Math.round(targetRect.y);
            const trW = Math.round(targetRect.width);
            const trH = Math.round(targetRect.height);
            
            const tl = { x: trX, y: trY };
            const tr = { x: trX + trW, y: trY };
            const br = { x: trX + trW, y: trY + trH };
            const bl = { x: trX, y: trY + trH };
            
            segments.push({ p1: tl, p2: tr });
            segments.push({ p1: tr, p2: br });
            segments.push({ p1: br, p2: bl });
            segments.push({ p1: bl, p2: tl });
        });

        // 4. Snapping Detection
        let bestDistanceX = Infinity;
        let bestCandidateX = null;

        let bestDistanceY = Infinity;
        let bestCandidateY = null;

        // The HTML demo checks distance to ANY line. 
        // To allow sliding along horizontal and vertical walls simultaneously (corner snapping),
        // we separate the candidates into horizontal and vertical constraints.
        
        segments.forEach(segment => {
            let proj = this.projectPointOntoLine(leadPoint, segment.p1, segment.p2);
            // Ensure snap target is perfectly rounded to avoid subpixel tolerance
            proj.x = Math.round(proj.x);
            proj.y = Math.round(proj.y);

            const dist = this.distance(leadPoint, proj);

            if (dist < alignThresh) {
                // Determine if segment is roughly horizontal or vertical
                const isHorizontal = Math.abs(segment.p1.y - segment.p2.y) < 1;
                const isVertical = Math.abs(segment.p1.x - segment.p2.x) < 1;

                if (isVertical && dist < bestDistanceX) {
                    bestDistanceX = dist;
                    bestCandidateX = { wall: segment, proj, dist };
                } else if (isHorizontal && dist < bestDistanceY) {
                    bestDistanceY = dist;
                    bestCandidateY = { wall: segment, proj, dist };
                } else if (!isHorizontal && !isVertical) {
                    // Diagonal walls can lock both
                    if (dist < bestDistanceX && dist < bestDistanceY) {
                        bestDistanceX = dist;
                        bestDistanceY = dist;
                        bestCandidateX = { wall: segment, proj, dist };
                    }
                }
            }
        });

        // 5. Apply State (Snap or Align)
        let activeGuideX = null;
        let activeGuideY = null;
        let newAbsPos = dragNode.getAbsolutePosition();
        let finalLeadX = leadPoint.x;
        let finalLeadY = leadPoint.y;

        if (!isTransforming) {
            // Apply X Snapping
            if (bestCandidateX) {
                if (bestCandidateX.dist < snapThresh) {
                    // LOCK AND SNAP X
                    newAbsPos.x = Math.round(bestCandidateX.proj.x - (leadPoint.x - newAbsPos.x));
                    finalLeadX = bestCandidateX.proj.x;
                    activeGuideX = { type: 'SOLID', wall: bestCandidateX.wall, proj: bestCandidateX.proj };
                } else {
                    activeGuideX = { type: 'DASHED', wall: bestCandidateX.wall, proj: bestCandidateX.proj };
                }
            }

            // Apply Y Snapping
            if (bestCandidateY && bestCandidateY !== bestCandidateX) {
                if (bestCandidateY.dist < snapThresh) {
                    // LOCK AND SNAP Y
                    newAbsPos.y = Math.round(bestCandidateY.proj.y - (leadPoint.y - newAbsPos.y));
                    finalLeadY = bestCandidateY.proj.y;
                    activeGuideY = { type: 'SOLID', wall: bestCandidateY.wall, proj: bestCandidateY.proj };
                } else {
                    activeGuideY = { type: 'DASHED', wall: bestCandidateY.wall, proj: bestCandidateY.proj };
                }
            } else if (bestCandidateX && bestCandidateY === bestCandidateX && bestCandidateX.dist < snapThresh) {
                // Handle diagonal wall snapping (both X and Y locked to same projection)
                newAbsPos.y = Math.round(bestCandidateX.proj.y - (leadPoint.y - newAbsPos.y));
                finalLeadY = bestCandidateX.proj.y;
            }

            if ((activeGuideX && activeGuideX.type === 'SOLID') || (activeGuideY && activeGuideY.type === 'SOLID')) {
                dragNode.setAbsolutePosition(newAbsPos);
                this.activeSnap = { ...newAbsPos };
            } else {
                this.activeSnap = null;
            }
        }

        // 6. Draw Visual Guides
        const drawActiveGuide = (guide, isX) => {
            if (!guide) return;
            const projP = inverseTransform.point(guide.proj);

            // Visual Debug Mode: Infinite guide lines crossing entirely over the workspace to verify perfect alignment
            this.guideGroup.add(new Konva.Line({
                points: isX ? [projP.x, -99999, projP.x, 99999] : [-99999, projP.y, 99999, projP.y],
                stroke: guide.type === 'SOLID' ? this.config.solidColor : this.config.dashedColor,
                strokeWidth: 1 / scale, // Perfect 1px line scaling
                dash: [4 / scale, 4 / scale],
                opacity: 0.8,
                perfectDrawEnabled: false,
                listening: false
            }));
        };

        drawActiveGuide(activeGuideX, true);
        if (activeGuideY !== activeGuideX) {
            drawActiveGuide(activeGuideY, false);
        }

        this.layer.batchDraw();
    }
}

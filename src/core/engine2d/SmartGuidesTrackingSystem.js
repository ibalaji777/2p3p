import Konva from 'konva';

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
            dashedColor: '#555555',      // Gray for potential reference
            guideColor: '#2ecc71',       // Green alignment line
            crosshairColor: 'rgba(59, 130, 246, 0.3)'
        };

        this.lastPointer = { x: 0, y: 0 };
        this.lastValidDx = 0;
        this.lastValidDy = 0;
        this.activeSnap = null;
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
        const dragRect = dragNode.getClientRect({ skipShadow: true });
        if (dragRect.width === 0 || dragRect.height === 0) return;

        // 2. Calculate Dynamic Leading Corner
        const centerX = dragRect.x + dragRect.width / 2;
        const centerY = dragRect.y + dragRect.height / 2;
        let leadPoint = { x: centerX, y: centerY };

        // Determine leading corner based on movement direction
        if (this.lastValidDx > 0) leadPoint.x = dragRect.x + dragRect.width;      // Moving Right
        else if (this.lastValidDx < 0) leadPoint.x = dragRect.x;                  // Moving Left

        if (this.lastValidDy > 0) leadPoint.y = dragRect.y + dragRect.height;     // Moving Down
        else if (this.lastValidDy < 0) leadPoint.y = dragRect.y;                  // Moving Up

        // Transform absolute leadPoint to local UI Layer coordinates for drawing
        const inverseTransform = this.layer.getAbsoluteTransform().copy().invert();
        const leadLocal = inverseTransform.point(leadPoint);

        // Draw Faint Dynamic Crosshairs (Visual indicator of leading edge)
        const crossSize = 5000;
        this.guideGroup.add(new Konva.Line({
            points: [leadLocal.x, leadLocal.y - crossSize, leadLocal.x, leadLocal.y + crossSize],
            stroke: this.config.crosshairColor,
            strokeWidth: 1 / scale,
            dash: [4 / scale, 4 / scale]
        }));
        this.guideGroup.add(new Konva.Line({
            points: [leadLocal.x - crossSize, leadLocal.y, leadLocal.x + crossSize, leadLocal.y],
            stroke: this.config.crosshairColor,
            strokeWidth: 1 / scale,
            dash: [4 / scale, 4 / scale]
        }));

        // 3. Gather Geometry (Lines)
        let segments = [];

        // Add Walls
        if (this.planner.walls) {
            this.planner.walls.forEach(w => {
                if (w.wallGroup === dragNode || w.poly === dragNode) return;
                const p1 = w.startAnchor.node.getAbsolutePosition();
                const p2 = w.endAnchor.node.getAbsolutePosition();
                segments.push({ p1, p2 });
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
            
            const tl = { x: targetRect.x, y: targetRect.y };
            const tr = { x: targetRect.x + targetRect.width, y: targetRect.y };
            const br = { x: targetRect.x + targetRect.width, y: targetRect.y + targetRect.height };
            const bl = { x: targetRect.x, y: targetRect.y + targetRect.height };
            
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
            const proj = this.projectPointOntoLine(leadPoint, segment.p1, segment.p2);
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
                    newAbsPos.x = bestCandidateX.proj.x - (leadPoint.x - newAbsPos.x);
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
                    newAbsPos.y = bestCandidateY.proj.y - (leadPoint.y - newAbsPos.y);
                    finalLeadY = bestCandidateY.proj.y;
                    activeGuideY = { type: 'SOLID', wall: bestCandidateY.wall, proj: bestCandidateY.proj };
                } else {
                    activeGuideY = { type: 'DASHED', wall: bestCandidateY.wall, proj: bestCandidateY.proj };
                }
            } else if (bestCandidateX && bestCandidateY === bestCandidateX && bestCandidateX.dist < snapThresh) {
                // Handle diagonal wall snapping (both X and Y locked to same projection)
                newAbsPos.y = bestCandidateX.proj.y - (leadPoint.y - newAbsPos.y);
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

            // Reference Wall Outline (Solid Blue or Dashed Gray)
            const wP1 = inverseTransform.point(guide.wall.p1);
            const wP2 = inverseTransform.point(guide.wall.p2);
            
            this.guideGroup.add(new Konva.Line({
                points: [wP1.x, wP1.y, wP2.x, wP2.y],
                stroke: guide.type === 'SOLID' ? this.config.solidColor : this.config.dashedColor,
                strokeWidth: (guide.type === 'SOLID' ? 4 : 3) / scale
            }));

            // Green Alignment Line from Leading Corner to Projection
            const leadP = inverseTransform.point({ x: isX ? finalLeadX : leadLocal.x, y: isX ? leadLocal.y : finalLeadY });
            const projP = inverseTransform.point(guide.proj);

            this.guideGroup.add(new Konva.Line({
                points: [leadLocal.x, leadLocal.y, projP.x, projP.y],
                stroke: this.config.guideColor,
                strokeWidth: 2 / scale,
                dash: [5 / scale, 5 / scale]
            }));
        };

        drawActiveGuide(activeGuideX, true);
        if (activeGuideY !== activeGuideX) {
            drawActiveGuide(activeGuideY, false);
        }

        // Leading Point Indicator (Red Dot)
        if (activeGuideX || activeGuideY) {
            const finalLeadLocal = inverseTransform.point({ x: finalLeadX, y: finalLeadY });
            this.guideGroup.add(new Konva.Circle({
                x: finalLeadLocal.x,
                y: finalLeadLocal.y,
                radius: 5 / scale,
                fill: '#e74c3c'
            }));
        }

        this.layer.batchDraw();
    }
}

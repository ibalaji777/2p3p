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
            solidColor: '#2ecc71',       // Solid green for locked reference
            dashedColor: '#3498db',      // Blue for potential reference
            indicatorColor: '#2ecc71'    // Green indicator point
        };

        this.lastPointer = { x: 0, y: 0 };
        this.lastValidDx = 0;
        this.lastValidDy = 0;
        this.activeSnap = null;
        this.lastGuideX = null;
        this.lastGuideY = null;
        this.lastDragNode = null;
        this.lastDashedSnapX = null;
        this.lastDashedSnapY = null;
    }

    calculateAngleSnap(center, movingPoint, referenceAngle = 0) {
        const dx = movingPoint.x - center.x;
        const dy = movingPoint.y - center.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 10) return movingPoint;

        let rawAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        let relativeAngle = rawAngle - referenceAngle;
        while (relativeAngle > 180) relativeAngle -= 360;
        while (relativeAngle <= -180) relativeAngle += 360;

        const snapIncrements = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, -15, -30, -45, -60, -75, -90, -105, -120, -135, -150, -165, -180];
        for (let a of snapIncrements) {
            if (Math.abs(relativeAngle - a) < 5) {
                let snappedAngle = referenceAngle + a;
                let rad = snappedAngle * Math.PI / 180;
                return {
                    x: center.x + dist * Math.cos(rad),
                    y: center.y + dist * Math.sin(rad),
                    snapped: true
                };
            }
        }
        return movingPoint;
    }

    drawAngleGuide(center, movingPoint, referenceAngle = 0, hideLines = false, append = false) {
        if (!append) {
            this.guideGroup.destroyChildren();
        }

        const scale = this.planner.stage.scaleX() || 1;
        
        // 1. Get wall endpoints: startPoint (P1) and endPoint (P2)
        // 2. Use P1 (or shared junction point) as vertex
        const p1 = center; 
        const p2 = movingPoint;
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 10) {
            this.layer.batchDraw();
            return;
        }

        // 3. Compute direction vectors
        // v1 = normalize(P2 - P1)
        const v1 = { x: dx / dist, y: dy / dist };
        
        // v2 = normalize(P3 - P1)
        const refRad = referenceAngle * Math.PI / 180;
        const v2 = { x: Math.cos(refRad), y: Math.sin(refRad) };

        // 4. Angle = acos(dot(v1, v2))
        let dot = v1.x * v2.x + v1.y * v2.y;
        dot = Math.max(-1, Math.min(1, dot)); // clamp to avoid NaN
        const angleRad = Math.acos(dot);
        const exactAngle = angleRad * 180 / Math.PI;
        const displayAngle = Math.round(exactAngle);

        // Compute cross product (v1 x v2) to determine orientation (clockwise / anticlockwise)
        const cross = v1.x * v2.y - v1.y * v2.x;

        let arcStart = referenceAngle;
        let arcAngle = exactAngle;
        
        // Render angle on the smaller angle side (usually interior)
        // Avoid showing reflex angle (>180)
        if (cross > 0) {
            arcStart = referenceAngle - exactAngle;
        }

        // Calculate interior corner for "real physical world" angle placement
        // Assume default wall thickness is 16 (half thickness is 8)
        const h = 8; 
        let origin = { x: p1.x, y: p1.y };
        let offsetDist = 0;
        
        // Offset origin along the bisector into the interior angle 
        if (angleRad > 0.05 && angleRad < Math.PI - 0.05) {
            const bisector = { x: v1.x + v2.x, y: v1.y + v2.y };
            const bLen = Math.hypot(bisector.x, bisector.y);
            if (bLen > 0.001) {
                const bisectorNorm = { x: bisector.x / bLen, y: bisector.y / bLen };
                const computedOffset = h / Math.sin(angleRad / 2);
                offsetDist = Math.min(dist * 0.8, computedOffset); // Clamp to prevent origin from flying away at extremely acute angles
                origin = {
                    x: p1.x + bisectorNorm.x * offsetDist,
                    y: p1.y + bisectorNorm.y * offsetDist
                };
            }
        }

        const availableDist = Math.max(15, dist - offsetDist);
        const radius = Math.min(45, availableDist * 0.4);

        // 5. Render arc using the calculated inner corner as center
        const arc = new Konva.Arc({
            x: origin.x,
            y: origin.y,
            innerRadius: 0,
            outerRadius: radius,
            angle: arcAngle,
            rotation: arcStart,
            fill: '#2ecc71',
            opacity: 0.3,
            listening: false
        });

        // Boundary stroke for the arc (CAD-like edge clarity)
        const arcStroke = new Konva.Arc({
            x: origin.x,
            y: origin.y,
            innerRadius: radius,
            outerRadius: radius + (1.5 / scale),
            angle: arcAngle,
            rotation: arcStart,
            fill: '#2ecc71',
            opacity: 0.8,
            listening: false
        });

        // Text
        const midRad = (arcStart + arcAngle / 2) * Math.PI / 180;
        const textDist = radius + (20 / scale);
        
        const text = new Konva.Text({
            x: origin.x + Math.cos(midRad) * textDist,
            y: origin.y + Math.sin(midRad) * textDist,
            text: `${displayAngle}°`,
            fontSize: 13 / scale,
            fill: '#111827',
            fontStyle: 'bold',
            align: 'center'
        });

        text.offsetX(text.width() / 2);
        text.offsetY(text.height() / 2);

        const labelBg = new Konva.Rect({
            x: text.x() - text.offsetX() - (4 / scale),
            y: text.y() - text.offsetY() - (2 / scale),
            width: text.width() + (8 / scale),
            height: text.height() + (4 / scale),
            fill: '#ffffff',
            stroke: '#e5e7eb',
            strokeWidth: 1 / scale,
            cornerRadius: 12 / scale,
            opacity: 0.95
        });

        this.guideGroup.add(arc, arcStroke, labelBg, text);

        if (!hideLines) {
            const baseLine = new Konva.Line({
                points: [
                    origin.x, origin.y,
                    origin.x + v2.x * availableDist,
                    origin.y + v2.y * availableDist
                ],
                stroke: '#9ca3af',
                strokeWidth: 1.5 / scale,
                dash: [4 / scale, 4 / scale],
                listening: false
            });

            const currentLine = new Konva.Line({
                points: [
                    origin.x, origin.y,
                    origin.x + v1.x * availableDist,
                    origin.y + v1.y * availableDist
                ],
                stroke: this.config.dashedColor,
                strokeWidth: 2 / scale,
                listening: false
            });
            this.guideGroup.add(baseLine, currentLine);
            baseLine.moveToBottom();
            currentLine.moveToBottom();
        }

        this.layer.batchDraw();
    }

    clear() {
        // Final placement lock: Snap to the dashed preview line when the mouse is released
        if (this.lastDragNode && (this.lastDashedSnapX !== null || this.lastDashedSnapY !== null)) {
            let pos = this.lastDragNode.getAbsolutePosition();
            if (this.lastDashedSnapX !== null) pos.x = this.lastDashedSnapX;
            if (this.lastDashedSnapY !== null) pos.y = this.lastDashedSnapY;
            this.lastDragNode.setAbsolutePosition(pos);
            if (this.planner && typeof this.planner.syncAll === 'function') this.planner.syncAll();
        }

        this.guideGroup.destroyChildren();
        this.layer.batchDraw();
        this.activeSnap = null;
        this.lastDragNode = null;
        this.lastDashedSnapX = null;
        this.lastDashedSnapY = null;
    }

    projectPointOntoLine(P, A, B, infinite = false) {
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq === 0) return { x: A.x, y: A.y }; 

        let t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / lengthSq;
        if (!infinite) {
            t = Math.max(0, Math.min(1, t));
        }

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

        // Get Object Bounds (Absolute coords)
        const dragRect = dragNode.getClientRect({ skipShadow: true });
        if (dragRect.width === 0 || dragRect.height === 0) return;

        const rX = Math.round(dragRect.x);
        const rY = Math.round(dragRect.y);
        const rW = Math.round(dragRect.width);
        const rH = Math.round(dragRect.height);

        const dragPoints = [
            { x: rX, y: rY, id: 'tl' },
            { x: rX + rW / 2, y: rY, id: 'tc' },
            { x: rX + rW, y: rY, id: 'tr' },
            { x: rX, y: rY + rH / 2, id: 'ml' },
            { x: rX + rW / 2, y: rY + rH / 2, id: 'mc' },
            { x: rX + rW, y: rY + rH / 2, id: 'mr' },
            { x: rX, y: rY + rH, id: 'bl' },
            { x: rX + rW / 2, y: rY + rH, id: 'bc' },
            { x: rX + rW, y: rY + rH, id: 'br' }
        ];

        const centerX = rX + rW / 2;
        const centerY = rY + rH / 2;

        const inverseTransform = this.layer.getAbsoluteTransform().copy().invert();

        const PRIORITY = {
            CORNER: 1,
            EDGE: 2,
            CENTER: 3,
            GRID: 4
        };

        let guides = [];

        const addPointGuides = (pt, priority) => {
            guides.push({
                p1: pt, p2: pt,
                lineP1: pt, lineP2: { x: pt.x, y: pt.y + 1 },
                priority: priority,
                isVertical: true, isHorizontal: false
            });
            guides.push({
                p1: pt, p2: pt,
                lineP1: pt, lineP2: { x: pt.x + 1, y: pt.y },
                priority: priority,
                isVertical: false, isHorizontal: true
            });
        };

        const addSegmentGuide = (p1, p2, priority) => {
            const isHorizontal = Math.abs(p1.y - p2.y) < 1;
            const isVertical = Math.abs(p1.x - p2.x) < 1;
            guides.push({
                p1, p2,
                lineP1: p1, lineP2: p2,
                priority,
                isVertical, isHorizontal
            });
        };

        if (this.planner.walls) {
            this.planner.walls.forEach(w => {
                if (w.wallGroup === dragNode || w.poly === dragNode) return;
                const p1 = w.startAnchor.node.getAbsolutePosition();
                const p2 = w.endAnchor.node.getAbsolutePosition();
                const p1R = { x: Math.round(p1.x), y: Math.round(p1.y) };
                const p2R = { x: Math.round(p2.x), y: Math.round(p2.y) };
                
                addPointGuides(p1R, PRIORITY.CORNER);
                addPointGuides(p2R, PRIORITY.CORNER);

                const thick = (w.thickness || (w.config && w.config.thickness) || 10) * scale;
                const dx = p2R.x - p1R.x;
                const dy = p2R.y - p1R.y;
                const len = Math.hypot(dx, dy);
                if (len > 0) {
                    const nx = (-dy / len) * (thick / 2);
                    const ny = (dx / len) * (thick / 2);
                    const edge1P1 = { x: Math.round(p1R.x + nx), y: Math.round(p1R.y + ny) };
                    const edge1P2 = { x: Math.round(p2R.x + nx), y: Math.round(p2R.y + ny) };
                    const edge2P1 = { x: Math.round(p1R.x - nx), y: Math.round(p1R.y - ny) };
                    const edge2P2 = { x: Math.round(p2R.x - nx), y: Math.round(p2R.y - ny) };
                    
                    addSegmentGuide(edge1P1, edge1P2, PRIORITY.EDGE);
                    addSegmentGuide(edge2P1, edge2P2, PRIORITY.EDGE);
                    
                    addPointGuides(edge1P1, PRIORITY.CORNER);
                    addPointGuides(edge1P2, PRIORITY.CORNER);
                    addPointGuides(edge2P1, PRIORITY.CORNER);
                    addPointGuides(edge2P2, PRIORITY.CORNER);
                }
            });
        }

        const extraNodes = [...(this.planner.furnitureLayer ? this.planner.furnitureLayer.getChildren() : []), 
                            ...(this.planner.widgetLayer ? this.planner.widgetLayer.getChildren() : [])];
        if (this.planner.shapes) extraNodes.push(...this.planner.shapes.map(s => s.group));
        if (this.planner.stairs) extraNodes.push(...this.planner.stairs.map(s => s.group).filter(Boolean));
        if (this.planner.roofs) extraNodes.push(...this.planner.roofs.map(r => r.group).filter(Boolean));
        
        extraNodes.forEach(node => {
            if (!node || node === dragNode || node === dragNode.parent || node.isAncestorOf(dragNode) || dragNode.isAncestorOf(node)) return;
            const targetRect = node.getClientRect({ skipShadow: true });
            if (targetRect.width === 0 || targetRect.height === 0) return;
            
            const distSq = Math.pow(centerX - (targetRect.x + targetRect.width/2), 2) + Math.pow(centerY - (targetRect.y + targetRect.height/2), 2);
            if (distSq > Math.pow(2000, 2)) return;
            
            const trX = Math.round(targetRect.x);
            const trY = Math.round(targetRect.y);
            const trW = Math.round(targetRect.width);
            const trH = Math.round(targetRect.height);
            
            const tl = { x: trX, y: trY };
            const tr = { x: trX + trW, y: trY };
            const br = { x: trX + trW, y: trY + trH };
            const bl = { x: trX, y: trY + trH };
            const center = { x: Math.round(trX + trW/2), y: Math.round(trY + trH/2) };
            
            addPointGuides(tl, PRIORITY.CORNER);
            addPointGuides(tr, PRIORITY.CORNER);
            addPointGuides(br, PRIORITY.CORNER);
            addPointGuides(bl, PRIORITY.CORNER);
            
            addPointGuides(center, PRIORITY.CENTER);
            addPointGuides({ x: center.x, y: tl.y }, PRIORITY.CENTER);
            addPointGuides({ x: center.x, y: bl.y }, PRIORITY.CENTER);
            addPointGuides({ x: tl.x, y: center.y }, PRIORITY.CENTER);
            addPointGuides({ x: tr.x, y: center.y }, PRIORITY.CENTER);
            
            addSegmentGuide(tl, tr, PRIORITY.EDGE);
            addSegmentGuide(tr, br, PRIORITY.EDGE);
            addSegmentGuide(br, bl, PRIORITY.EDGE);
            addSegmentGuide(bl, tl, PRIORITY.EDGE);
            
            addSegmentGuide({ x: center.x, y: trY }, { x: center.x, y: trY + trH }, PRIORITY.CENTER);
            addSegmentGuide({ x: trX, y: center.y }, { x: trX + trW, y: center.y }, PRIORITY.CENTER);
        });

        let bestCandidateX = null;
        let bestCandidateY = null;

        const HYSTERESIS_BONUS = 2;

        const isSameGuide = (g1, g2) => {
            if (!g1 || !g2) return false;
            return g1.lineP1.x === g2.lineP1.x && g1.lineP1.y === g2.lineP1.y && 
                   g1.lineP2.x === g2.lineP2.x && g1.lineP2.y === g2.lineP2.y;
        };

        const evaluateCandidate = (best, current, lastGuide) => {
            if (!best) return current;
            if (current.guide.priority < best.guide.priority) return current;
            if (current.guide.priority > best.guide.priority) return best;
            
            let distBest = best.dist;
            let distCurr = current.dist;
            
            if (lastGuide) {
                if (isSameGuide(best.guide, lastGuide)) distBest -= HYSTERESIS_BONUS;
                if (isSameGuide(current.guide, lastGuide)) distCurr -= HYSTERESIS_BONUS;
            }

            if (current.physicalDist < best.physicalDist - 5) return current;
            if (current.physicalDist > best.physicalDist + 5) return best;

            if (distCurr < distBest) return current;
            return best;
        };

        dragPoints.forEach(dragPoint => {
            guides.forEach(guide => {
                let proj = this.projectPointOntoLine(dragPoint, guide.lineP1, guide.lineP2, true);
                
                proj.x = Math.round(proj.x);
                proj.y = Math.round(proj.y);

                const dist = this.distance(dragPoint, proj);
                
                const physicalProj = this.projectPointOntoLine(dragPoint, guide.p1, guide.p2, false);
                const physicalDist = this.distance(proj, physicalProj);

                if (dist < alignThresh && physicalDist < 1000) {
                    const candidate = { guide, proj, dist, physicalDist, physicalProj, dragPoint };
                    
                    if (guide.isVertical) {
                        bestCandidateX = evaluateCandidate(bestCandidateX, candidate, this.lastGuideX);
                    } else if (guide.isHorizontal) {
                        bestCandidateY = evaluateCandidate(bestCandidateY, candidate, this.lastGuideY);
                    } else {
                        bestCandidateX = evaluateCandidate(bestCandidateX, candidate, this.lastGuideX);
                        bestCandidateY = evaluateCandidate(bestCandidateY, candidate, this.lastGuideY);
                    }
                }
            });
        });

        let activeGuideX = null;
        let activeGuideY = null;
        let newAbsPos = dragNode.getAbsolutePosition();
        const originalAbsPos = { ...newAbsPos };

        this.lastDragNode = dragNode;
        this.lastDashedSnapX = null;
        this.lastDashedSnapY = null;

        if (!isTransforming) {
            if (bestCandidateX) {
                const targetX = Math.round(bestCandidateX.proj.x - (bestCandidateX.dragPoint.x - originalAbsPos.x));
                if (bestCandidateX.dist < snapThresh) {
                    newAbsPos.x = targetX;
                    activeGuideX = { type: 'SOLID', guide: bestCandidateX.guide, proj: bestCandidateX.proj, physicalProj: bestCandidateX.physicalProj };
                } else {
                    activeGuideX = { type: 'DASHED', guide: bestCandidateX.guide, proj: bestCandidateX.proj };
                    this.lastDashedSnapX = targetX;
                }
            }

            if (bestCandidateY && bestCandidateY !== bestCandidateX) {
                const targetY = Math.round(bestCandidateY.proj.y - (bestCandidateY.dragPoint.y - originalAbsPos.y));
                if (bestCandidateY.dist < snapThresh) {
                    newAbsPos.y = targetY;
                    activeGuideY = { type: 'SOLID', guide: bestCandidateY.guide, proj: bestCandidateY.proj, physicalProj: bestCandidateY.physicalProj };
                } else {
                    activeGuideY = { type: 'DASHED', guide: bestCandidateY.guide, proj: bestCandidateY.proj };
                    this.lastDashedSnapY = targetY;
                }
            } else if (bestCandidateX && bestCandidateY === bestCandidateX) {
                const targetY = Math.round(bestCandidateX.proj.y - (bestCandidateX.dragPoint.y - originalAbsPos.y));
                if (bestCandidateX.dist < snapThresh) {
                    newAbsPos.y = targetY;
                } else {
                    this.lastDashedSnapY = targetY;
                }
            }

            if ((activeGuideX && activeGuideX.type === 'SOLID') || (activeGuideY && activeGuideY.type === 'SOLID')) {
                dragNode.setAbsolutePosition(newAbsPos);
                this.activeSnap = { ...newAbsPos };
            } else {
                this.activeSnap = null;
            }
            
            this.lastGuideX = activeGuideX && activeGuideX.type === 'SOLID' ? activeGuideX.guide : null;
            this.lastGuideY = activeGuideY && activeGuideY.type === 'SOLID' ? activeGuideY.guide : null;
        }

        const drawActiveGuide = (active, isX) => {
            if (!active) return;
            const projP = inverseTransform.point(active.proj);
            const guide = active.guide;
            const color = active.type === 'SOLID' ? this.config.solidColor : this.config.dashedColor;

            if (!guide.isHorizontal && !guide.isVertical) {
                const lineP1 = inverseTransform.point(guide.lineP1);
                const lineP2 = inverseTransform.point(guide.lineP2);
                const dx = lineP2.x - lineP1.x;
                const dy = lineP2.y - lineP1.y;
                
                this.guideGroup.add(new Konva.Line({
                    points: [lineP1.x - dx*1000, lineP1.y - dy*1000, lineP2.x + dx*1000, lineP2.y + dy*1000],
                    stroke: color,
                    strokeWidth: 1 / scale,
                    dash: [4 / scale, 4 / scale],
                    opacity: 0.8,
                    listening: false
                }));
            } else {
                this.guideGroup.add(new Konva.Line({
                    points: isX ? [projP.x, -99999, projP.x, 99999] : [-99999, projP.y, 99999, projP.y],
                    stroke: color,
                    strokeWidth: 1 / scale,
                    dash: [4 / scale, 4 / scale],
                    opacity: 0.8,
                    perfectDrawEnabled: false,
                    listening: false
                }));
            }

            if (active.type === 'SOLID') {
                const p1Local = inverseTransform.point(guide.p1);
                const p2Local = inverseTransform.point(guide.p2);
                
                this.guideGroup.add(new Konva.Line({
                    points: [p1Local.x, p1Local.y, p2Local.x, p2Local.y],
                    stroke: color,
                    strokeWidth: 2 / scale,
                    listening: false
                }));

                if (active.physicalProj) {
                    const physP = inverseTransform.point(active.physicalProj);
                    this.guideGroup.add(new Konva.Circle({
                        x: physP.x,
                        y: physP.y,
                        radius: 4 / scale,
                        fill: color,
                        listening: false
                    }));
                }
            }
        };

        drawActiveGuide(activeGuideX, true);
        if (activeGuideY !== activeGuideX) {
            drawActiveGuide(activeGuideY, false);
        }

        this.layer.batchDraw();
    }
}

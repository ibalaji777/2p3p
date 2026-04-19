import Konva from 'konva';

export class SmartGuidesTrackingSystem {
    constructor(planner) {
        this.planner = planner;
        this.layer = planner.uiLayer;
        this.guideGroup = new Konva.Group({ listening: false });
        this.layer.add(this.guideGroup);
        
        this.config = {
            snapThreshold: 10,
            guideColor: '#10b981',       // Green dashed alignment guide
            projectionColor: '#000000',  // Black dashed projection line
            dashArray: [4, 4]
        };
    }

    clear() {
        this.guideGroup.destroyChildren();
        this.layer.batchDraw();
    }

    snapAndAlign(dragNode, isTransforming = false) {
        this.guideGroup.destroyChildren();

        if (this.planner.tool !== 'select' || dragNode.isWallPoly || dragNode.isStairNodeHandle || (dragNode.name() && dragNode.name().includes('anchor'))) {
            this.layer.batchDraw();
            return;
        }

        const scale = 1 / this.planner.stage.scaleX();
        const threshold = this.config.snapThreshold / this.planner.stage.scaleX();

        // 1. Get Object Bounds
        const dragRect = dragNode.getClientRect({ skipShadow: true });
        if (dragRect.width === 0 || dragRect.height === 0) return;

        const dragCenter = { x: dragRect.x + dragRect.width / 2, y: dragRect.y + dragRect.height / 2 };
        
        const dragPointsX = [
            { val: dragRect.x, type: 'left', y: dragCenter.y }, 
            { val: dragCenter.x, type: 'center', y: dragCenter.y }, 
            { val: dragRect.x + dragRect.width, type: 'right', y: dragCenter.y }
        ];
        
        const dragPointsY = [
            { val: dragRect.y, type: 'top', x: dragCenter.x }, 
            { val: dragCenter.y, type: 'center', x: dragCenter.x }, 
            { val: dragRect.y + dragRect.height, type: 'bottom', x: dragCenter.x }
        ];

        // 2. Gather references (Nodes, Walls, Shapes, Furniture)
        let nodes = [...(this.planner.furnitureLayer ? this.planner.furnitureLayer.getChildren() : []), 
                     ...(this.planner.widgetLayer ? this.planner.widgetLayer.getChildren() : [])];
                     
        if (this.planner.shapes) nodes.push(...this.planner.shapes.map(s => s.group));
        if (this.planner.walls) {
            this.planner.walls.forEach(w => {
                if (w.group) nodes.push(w.group);
                else if (w.poly) nodes.push(w.poly);
            });
        }

        let bestSnapX = null;
        let bestSnapY = null;
        let guideLineX = null;
        let guideLineY = null;
        
        let projXStart = null;
        let projXEnd = null;
        let projYStart = null;
        let projYEnd = null;

        let activeAnchor = (isTransforming && this.planner.shapeTransformer) ? this.planner.shapeTransformer.getActiveAnchor() : null;
        let checkLeft = !activeAnchor || activeAnchor.includes('left');
        let checkRight = !activeAnchor || activeAnchor.includes('right');
        let checkTop = !activeAnchor || activeAnchor.includes('top');
        let checkBottom = !activeAnchor || activeAnchor.includes('bottom');
        let checkCenterX = !activeAnchor;
        let checkCenterY = !activeAnchor;

        // 3. Find closest alignment
        nodes.forEach(node => {
            if (!node || node === dragNode || node === dragNode.parent || node.isAncestorOf(dragNode) || dragNode.isAncestorOf(node) || (node.name() && node.name().includes('anchor'))) return;

            const targetRect = node.getClientRect({ skipShadow: true });
            if (targetRect.width === 0 || targetRect.height === 0) return;
            
            // Performance: Limit checks to nearby objects
            const distSq = Math.pow(dragCenter.x - (targetRect.x + targetRect.width/2), 2) + Math.pow(dragCenter.y - (targetRect.y + targetRect.height/2), 2);
            if (distSq > Math.pow(2000, 2)) return; // Only process within 2000px radius

            const targetCenter = { x: targetRect.x + targetRect.width / 2, y: targetRect.y + targetRect.height / 2 };
            
            const tPointsX = [
                { val: targetRect.x, y: targetCenter.y }, 
                { val: targetCenter.x, y: targetCenter.y }, 
                { val: targetRect.x + targetRect.width, y: targetCenter.y }
            ];
            
            const tPointsY = [
                { val: targetRect.y, x: targetCenter.x }, 
                { val: targetCenter.y, x: targetCenter.x }, 
                { val: targetRect.y + targetRect.height, x: targetCenter.x }
            ];

            // Check X Alignments
            if (bestSnapX === null) {
                for (let sp of dragPointsX) {
                    if ((sp.type === 'left' && !checkLeft) || (sp.type === 'right' && !checkRight) || (sp.type === 'center' && !checkCenterX)) continue;
                    for (let tp of tPointsX) {
                        if (Math.abs(sp.val - tp.val) < threshold) {
                            bestSnapX = tp.val - sp.val;
                            guideLineX = tp.val;
                            projXStart = { x: tp.val, y: sp.y };
                            projXEnd = { x: tp.val, y: tp.y };
                            break;
                        }
                    }
                    if (bestSnapX !== null) break;
                }
            }

            // Check Y Alignments
            if (bestSnapY === null) {
                for (let sp of dragPointsY) {
                    if ((sp.type === 'top' && !checkTop) || (sp.type === 'bottom' && !checkBottom) || (sp.type === 'center' && !checkCenterY)) continue;
                    for (let tp of tPointsY) {
                        if (Math.abs(sp.val - tp.val) < threshold) {
                            bestSnapY = tp.val - sp.val;
                            guideLineY = tp.val;
                            projYStart = { x: sp.x, y: tp.val };
                            projYEnd = { x: tp.x, y: tp.val };
                            break;
                        }
                    }
                    if (bestSnapY !== null) break;
                }
            }
        });

        // 4. Apply Snapping Translation
        if (!isTransforming) {
            let newAbsPos = dragNode.getAbsolutePosition();
            if (bestSnapX !== null) newAbsPos.x += bestSnapX * this.planner.stage.scaleX();
            if (bestSnapY !== null) newAbsPos.y += bestSnapY * this.planner.stage.scaleY();
            if (bestSnapX !== null || bestSnapY !== null) {
                dragNode.setAbsolutePosition(newAbsPos);
            }
        }

        // 5. Draw Visual Feedback (Green Alignment Guides + Black Projection Lines)
        const inverseTransform = this.layer.getAbsoluteTransform().copy().invert();
        
        if (guideLineX !== null) {
            // Full infinite green dashed guide line
            const p1 = inverseTransform.point({ x: guideLineX, y: -5000 });
            const p2 = inverseTransform.point({ x: guideLineX, y: 5000 });
            this.guideGroup.add(new Konva.Line({ 
                points: [p1.x, p1.y, p2.x, p2.y], 
                stroke: this.config.guideColor, 
                strokeWidth: scale, 
                dash: [4 * scale, 4 * scale] 
            }));
            
            // Black dashed projection line connecting object to reference
            const s = inverseTransform.point({ x: projXStart.x, y: projXStart.y });
            const t = inverseTransform.point({ x: projXEnd.x, y: projXEnd.y });
            this.guideGroup.add(new Konva.Line({ 
                points: [s.x, s.y, t.x, t.y], 
                stroke: this.config.projectionColor, 
                strokeWidth: 1 * scale, 
                dash: [4 * scale, 4 * scale], 
                opacity: 0.5 
            }));
        }
        
        if (guideLineY !== null) {
            // Full infinite green dashed guide line
            const p1 = inverseTransform.point({ x: -5000, y: guideLineY });
            const p2 = inverseTransform.point({ x: 5000, y: guideLineY });
            this.guideGroup.add(new Konva.Line({ 
                points: [p1.x, p1.y, p2.x, p2.y], 
                stroke: this.config.guideColor, 
                strokeWidth: scale, 
                dash: [4 * scale, 4 * scale] 
            }));

            // Black dashed projection line connecting object to reference
            const s = inverseTransform.point({ x: projYStart.x, y: projYStart.y });
            const t = inverseTransform.point({ x: projYEnd.x, y: projYEnd.y });
            this.guideGroup.add(new Konva.Line({ 
                points: [s.x, s.y, t.x, t.y], 
                stroke: this.config.projectionColor, 
                strokeWidth: 1 * scale, 
                dash: [4 * scale, 4 * scale], 
                opacity: 0.5 
            }));
        }

        this.layer.batchDraw();
    }
}

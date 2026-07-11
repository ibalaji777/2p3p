 
        planner.stage.on('dragstart', (e) => {
            if (e.target === planner.stage) planner.stage.container().style.cursor = 'grabbing';
        });
        
        planner.stage.on('dragmove', (e) => {
            if (e.target === planner.stage) return;
            if (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape') {
                if ((planner.tool === 'select' || planner.tool === 'pan') && !e.target.isWallPoly && !e.target.isStairNodeHandle && !(e.target.name() && e.target.name().includes('anchor'))) {
                    planner.snapAndAlign(e.target);
                }
            }
        });

        let dragStartData2D = null;
        
        planner.stage.on('dragstart', (e) => {
            if (e.target === planner.stage) {
                planner.stage.container().style.cursor = 'grabbing';
            } else if (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape') {
                const id = e.target.id() || (e.target.parent && e.target.parent.id());
                const entity = planner.getEntities().find(ent => ent.id === id || (ent.group && ent.group.id() === id));
                if (entity && entity.group) {
                    dragStartData2D = { id: id, x: entity.group.x(), y: entity.group.y() };
                }
            }
        });
        
        planner.stage.on('dragend', (e) => {
            if (e.target === planner.stage) planner.stage.container().style.cursor = planner.tool === 'select' ? 'grab' : 'crosshair';
            if (planner.alignmentLines) {
                planner.alignmentLines.destroyChildren();
            }
            if (planner.smartGuides) {
                planner.smartGuides.clear();
            }
            
            if (dragStartData2D && (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape')) {
                const id = e.target.id() || (e.target.parent && e.target.parent.id());
                if (dragStartData2D.id === id) {
                    const entity = planner.getEntities().find(ent => ent.id === id || (ent.group && ent.group.id() === id));
                    if (entity && entity.group) {
                        const endX = entity.group.x();
                        const endY = entity.group.y();
                        if (Math.abs(endX - dragStartData2D.x) > 0.001 || Math.abs(endY - dragStartData2D.y) > 0.001) {
                            // Revert the 2D position temporarily so the Command executes the change
                            entity.group.position({ x: dragStartData2D.x, y: dragStartData2D.y });
                            planner.move(id, endX, endY);
                        }
                    }
                }
                dragStartData2D = null;
            }
            planner.uiLayer.batchDraw();
        });

        planner.stage.on("mousedown touchstart", (e) => {
            if (e.evt && e.evt.touches && e.evt.touches.length > 1) return;
            const isTouch = e.evt && (e.evt.touches || e.evt.pointerType === 'touch');
            
            if (isTouch && e.type === 'touchstart') {
                const isWallTool = ['outer', 'inner', 'railing', 'roof'].includes(planner.tool);
                if (isWallTool) {
                    if (planner.gestureManager && planner.gestureManager.isActive()) return;
                    const clonedPos = planner.getPointerPos(e);
                    if (!clonedPos) return;
                    planner.lastTouchDownPos = { x: clonedPos.x, y: clonedPos.y };
                    if (planner.mobileDrawState === 'ChainWaiting') {
                        let distToLast = Infinity;
                        if (planner.lastAnchor) {
                            distToLast = Math.hypot(clonedPos.x - planner.lastAnchor.x, clonedPos.y - planner.lastAnchor.y);
                        }
                        let distToStart = Infinity;
                        if (planner.startAnchor) {
                            distToStart = Math.hypot(clonedPos.x - planner.startAnchor.x, clonedPos.y - planner.startAnchor.y);
                        }
                        const scale = planner.stage.scaleX() || 1;
                        
                        // Prioritize startAnchor tap if it's closer than the drag handle
                        if (distToStart < distToLast && distToStart < 40 / scale) {
                            planner.mobileIsPanning = true;
                        } else if (distToLast < 40 / scale) {
                            planner.mobileDrawState = 'PreviewDrawing';
                            planner.mobileIsPanning = false;
                        } else {
                            planner.mobileIsPanning = true;
                        }
                    } else {
                        planner.mobileIsPanning = false;
                        planner.mobileDrawState = 'PreviewDrawing';
                        planner._executePointerDownLogic(e, clonedPos, isTouch);
                    }
                    return;
                }

                if (planner._touchDrawTimer) clearTimeout(planner._touchDrawTimer);
                planner._touchDrawCancelled = false;
                
                const clonedPos = planner.getPointerPos(e);
                if (!clonedPos) return;

                planner._touchDrawTimer = planner.registerTimeout(() => {
                    planner._touchDrawTimer = null;
                    if (planner._touchDrawCancelled) return;
                    if (planner.gestureManager && planner.gestureManager.isActive()) return;
                    planner._executePointerDownLogic(e, clonedPos, isTouch);
                }, 150);
                return;
            }
            
            if (planner.gestureManager && planner.gestureManager.isActive()) return;
            const pos = planner.getPointerPos(e);
            if (!pos) return;
            planner._executePointerDownLogic(e, pos, isTouch);
        });

        planner._executePointerDownLogic = (e, pos, isTouch) => {
            let cmd = null;
            if (planner.commandManager) cmd = new SnapshotCommand(this);
            planner.__executePointerDownLogic(e, pos, isTouch);
            if (cmd && cmd.finalize()) {
                planner.commandManager.execute(cmd);
            }
        };

        planner.__executePointerDownLogic = (e, pos, isTouch) => {
            if (planner.gestureManager && planner.gestureManager.isActive()) return;
 
            if (planner.tool === 'roof') {
                planner._executeRoofPointerDownLogic(pos);
                return;
            }
            if (planner.lastPlacementTime && Date.now() - planner.lastPlacementTime < 500) {
                return;
            }
            
            if (e.type !== 'touchend' && (e.target === planner.stage || e.target === planner.bgLayer || e.target === planner.mainLayer)) {
                planner.deselectAll(); 
            }
            const wallConfig = WALL_REGISTRY[planner.tool]; 
            
            
            // Handle Smart Snapping Placement for Moldings and Openings
            const isAdvancedOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(planner.tool);
            const isMolding = !!MOLDING_REGISTRY[planner.tool];
            const isWidget = !!WIDGET_REGISTRY[planner.tool];
            const isPlacementTool = isWidget || isAdvancedOpening || isMolding;

            if (isPlacementTool) {
                let targetWall = null;
                let targetFace = null;
                
                if (e.target && e.target.isWallPoly) {
                    targetWall = e.target.parentWall;
                    const start = targetWall.startAnchor.position();
                    const end = targetWall.endAnchor.position();
                    const dx = end.x - start.x;
                    const dy = end.y - start.y;
                    const cp = (pos.x - start.x) * dy - (pos.y - start.y) * dx;
                    targetFace = cp > 0 ? 'back' : 'front';
                } else {
                    let minWallDist = 60 / (planner.stage.scaleX() || 1);
                    for (let w of planner.walls) {
                        if (w.hidden || w.type === 'railing') continue;
                        const start = w.startAnchor.position();
                        const end = w.endAnchor.position();
                        const proj = planner.getClosestPointOnSegment(pos, start, end);
                        const dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                        
                        if (dist < minWallDist) {
                            targetWall = w;
                            minWallDist = dist;
                            const dx = end.x - start.x;
                            const dy = end.y - start.y;
                            const cp = (pos.x - start.x) * dy - (pos.y - start.y) * dx;
                            targetFace = cp > 0 ? 'back' : 'front';
                        }
                    }
                }
                
                if (targetWall && targetWall.placeItemFromSnapping) {
                    planner.walls.forEach(w => {
                        if (w.frontHighlight) w.frontHighlight.visible(false);
                        if (w.backHighlight) w.backHighlight.visible(false);
                    });
                    planner.mainLayer.batchDraw();
                    targetWall.placeItemFromSnapping(planner.tool, targetFace, pos);
                }
                return;
            }
            
            let targetPos = { x: planner.snap(pos.x), y: planner.snap(pos.y) };
            if (planner.tool === 'stair_v4_flight') {
                const rootId = 'stairv4_' + Math.random().toString(36).substr(2, 9);
                const flightData = { id: rootId, x: targetPos.x, y: targetPos.y };
                const flight = new StairV4Flight(this, flightData);
                planner.stairs.push(flight);
                planner.tool = 'select';
                planner.updateToolStates();
                planner.selectEntity(flight, 'stair');
                planner.syncAll();
                return;
            }
            if (planner.tool === 'stair_v4_landing') {
                const rootId = 'stairv4_landing_' + Math.random().toString(36).substr(2, 9);
                const landingData = { id: rootId, x: targetPos.x, y: targetPos.y };
                const landing = new StairV4Landing(this, landingData);
                planner.stairs.push(landing);
                planner.tool = 'select';
                planner.updateToolStates();
                planner.selectEntity(landing, 'stair');
                planner.syncAll();
                return;
            }
            if (planner.tool === 'stair_v4_landing_curve') {
                const rootId = 'stairv4_landing_' + Math.random().toString(36).substr(2, 9);
                const landingData = { id: rootId, x: targetPos.x, y: targetPos.y, shape: 'u_curve', length: 100, innerRadius: 40 };
                const landing = new StairV4Landing(this, landingData);
                planner.stairs.push(landing);
                planner.tool = 'select';
                planner.updateToolStates();
                planner.selectEntity(landing, 'stair');
                planner.syncAll();
                return;
            }
            if (planner.tool.startsWith('stair_v5_')) {
                const shape = planner.tool.split('_').pop(); // straight, L, U, T
                const stair = new PremiumStaircase(this, shape, { x: targetPos.x, y: targetPos.y });
                planner.stairs.push(stair);
                planner.tool = 'select';
                planner.updateToolStates();
                planner.selectEntity(stair, 'stair');
                planner.syncAll();
                return;
            }
            
            if (planner.tool === 'arc') {
                const scale = planner.stage.scaleX() || 1;
                let activeSnapDist = isTouch ? (SNAP_DIST * 1.5) / scale : SNAP_DIST / scale;
                
                let snap = targetPos;
                let closestDist = activeSnapDist;
                
                let a = planner.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < closestDist);
                if (a) { snap = { x: a.x, y: a.y }; closestDist = Math.hypot(a.x - pos.x, a.y - pos.y); }

                for (let w of planner.walls) {
                    let proj = planner.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                    let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    if (dist < closestDist) { closestDist = dist; snap = proj; }
                }
                
                if (planner.drawingArc) {
                    if (planner.drawingArc.isFrozen) {
                        snap = planner.drawingArc.frozenPos;
                    } else if (e.type !== 'touchstart' && planner.arcMousePos) {
                        snap = planner.arcMousePos;
                    } else {
                        planner.arcMousePos = snap;
                    }
                }

                if (!planner.drawingArc) {
                    planner.drawingArc = { p1: snap, p2: null, state: 1 };
                    planner.arcMousePos = snap;
                    
                    planner.arcPreview = new Konva.Group();
                    planner.arcPreview.ghostCircle = new Konva.Circle({ stroke: '#cbd5e1', dash: [4,4], strokeWidth: 1, listening: false, visible: false });
                    planner.arcPreview.angleFill = new Konva.Shape({ fill: 'rgba(59, 130, 246, 0.15)', listening: false, visible: false });
                    planner.arcPreview.radiusLines = new Konva.Line({ stroke: '#9ca3af', dash: [4,4], strokeWidth: 1, listening: false, visible: false });
                    planner.arcPreview.lineBase = new Konva.Line({ stroke: '#9ca3af', dash: [5,5], strokeWidth: 2, listening: false, visible: false });
                    planner.arcPreview.guideLine = new Konva.Line({ stroke: '#38bdf8', dash: [4,4], strokeWidth: 1, listening: false, visible: false });
                    planner.arcPreview.arcCurve = new Konva.Shape({ stroke: '#3b82f6', strokeWidth: 4, listening: false, visible: false });
                    planner.arcPreview.p1Dot = new Konva.Circle({ radius: 6, fill: '#22c55e', listening: false, x: snap.x, y: snap.y });
                    planner.arcPreview.p2Dot = new Konva.Circle({ radius: 6, fill: '#22c55e', listening: false, visible: false });
                    planner.arcPreview.bendDot = new Konva.Circle({ radius: 18, fill: '#3b82f6', draggable: true, visible: false });
                    planner.arcPreview.bendDot.on('dragmove', (e) => {
                        planner.arcMousePos = { x: e.target.x(), y: e.target.y() };
                        planner.updateArcPreviewState2(planner.arcMousePos);
                    });

                    planner.arcPreview.add(planner.arcPreview.ghostCircle, planner.arcPreview.angleFill, planner.arcPreview.radiusLines, planner.arcPreview.lineBase, planner.arcPreview.guideLine, planner.arcPreview.arcCurve, planner.arcPreview.p1Dot, planner.arcPreview.p2Dot, planner.arcPreview.bendDot);
                    planner.uiLayer.add(planner.arcPreview);
                    planner.uiLayer.batchDraw();
                    if (planner.onDrawingChange) planner.onDrawingChange(true);
                } else if (planner.drawingArc.state === 1) {
                    if (Math.hypot(snap.x - planner.drawingArc.p1.x, snap.y - planner.drawingArc.p1.y) > 5) {
                        planner.drawingArc.p2 = snap;
                        planner.drawingArc.state = 2;
                        planner.stage.draggable(true);
                        
                        const dx = snap.x - planner.drawingArc.p1.x;
                        const dy = snap.y - planner.drawingArc.p1.y;
                        const L = Math.hypot(dx, dy), n = { x: -dy/L, y: dx/L };
                        planner.arcMousePos = { x: planner.drawingArc.p1.x + dx/2 + n.x * (L/4), y: planner.drawingArc.p1.y + dy/2 + n.y * (L/4) };
                        planner.arcPreview.p2Dot.position(snap);
                        planner.arcPreview.p2Dot.visible(true);
                        planner.arcPreview.bendDot.position(planner.arcMousePos);
                        planner.arcPreview.bendDot.visible(true);
                        planner.updateArcPreviewState2(planner.arcMousePos);
                        planner.uiLayer.batchDraw();
                    }
                }
                return;
            }
            
            if (planner.tool.startsWith('shape_')) {
                let snapPos = targetPos;
                let closestDist = SNAP_DIST;
                let a = planner.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < closestDist);
                if (a) { snapPos = { x: a.x, y: a.y }; }
                else {
                    for (let w of planner.walls) {
                        let proj = planner.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                        let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                        if (dist < closestDist) { closestDist = dist; snapPos = proj; }
                    }
                }
                if (planner.tool === 'shape_rect' || planner.tool === 'shape_circle') {
                    planner.drawingShapeType = planner.tool; planner.shapeStartPos = snapPos;
                    if (planner.tool === 'shape_rect') { planner.shapePreviewRect.position(snapPos); planner.shapePreviewRect.width(0); planner.shapePreviewRect.height(0); planner.shapePreviewRect.visible(true); }
                    else if (planner.tool === 'shape_circle') { planner.shapePreviewCircle.position(snapPos); planner.shapePreviewCircle.radius(0); planner.shapePreviewCircle.visible(true); }
                    if (planner.onDrawingChange) planner.onDrawingChange(true);
                    planner.uiLayer.batchDraw();
                } else if (planner.tool === 'shape_triangle') {
                    if (!planner.drawingTriangle) { 
                        planner.drawingTriangle = [snapPos]; 
                        if (planner.onDrawingChange) planner.onDrawingChange(true);
                    }
                    else {
                        planner.drawingTriangle.push(snapPos);
                        if (planner.drawingTriangle.length === 3) { const newShape = new PremiumShape(this, 'shape_triangle', { points: [...planner.drawingTriangle] }); if(!planner.shapes) planner.shapes = []; planner.shapes.push(newShape); planner.drawingTriangle = null; planner.shapePreviewTriangle.visible(false); planner.tool = 'select'; planner.updateToolStates(); if (planner.onToolChange) planner.onToolChange('select'); planner.selectEntity(newShape, 'shape'); if (planner.onDrawingChange) planner.onDrawingChange(false); planner.syncAll(); }
                    }
                }
                return;
            }
            if (!wallConfig) return; 

            let targetSnapWall = null; 
            const scale = planner.stage.scaleX() || 1;
            const activeSnapDist = isTouch ? 20 / scale : SNAP_DIST / scale;

            if (wallConfig && wallConfig.events.includes("snap_to_wall")) { 
                let closestDist = activeSnapDist;
                
                if (isTouch && planner.lastStickySnap && Math.hypot(pos.x - planner.lastStickySnap.rawPos.x, pos.y - planner.lastStickySnap.rawPos.y) < activeSnapDist * 1.1) {
                    targetPos = { x: planner.lastStickySnap.snapPos.x, y: planner.lastStickySnap.snapPos.y };
                    targetSnapWall = planner.lastStickySnap.wall;
                    closestDist = 0;
                } else if (isTouch && planner.drawing && planner.startAnchor && Math.hypot(pos.x - planner.startAnchor.x, pos.y - planner.startAnchor.y) < activeSnapDist * 3) {
                    targetPos = planner.startAnchor.position();
                    closestDist = 0;
                } else {
                    planner.lastStickySnap = null;
                }

                if (closestDist > 0) {
                    const anchorSnapMult = isTouch ? 1.5 : 1;
                    let a = planner.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < activeSnapDist * anchorSnapMult); 
                    if (a) { targetPos = { x: a.x, y: a.y }; targetSnapWall = planner.walls.find(w => w.startAnchor === a || w.endAnchor === a); } 
                    else { 
                        let closestPoint = null; 
    
                        let allReferenceWalls = planner.referenceGroup ? planner.referenceGroup.getChildren() : [];
                        for (let line of allReferenceWalls) {
                            let pts = line.getAttr('refPts') || line.points();
                            if (pts && pts.length === 4) {
                                let d1 = Math.hypot(pos.x - pts[0], pos.y - pts[1]); let d2 = Math.hypot(pos.x - pts[2], pos.y - pts[3]);
                                if (d1 < 40 && d1 < closestDist) { closestDist = 0; closestPoint = {x: pts[0], y: pts[1]}; targetSnapWall = null; }
                                else if (d2 < 40 && d2 < closestDist) { closestDist = 0; closestPoint = {x: pts[2], y: pts[3]}; targetSnapWall = null; }
                                else { let proj = planner.getClosestPointOnSegment(pos, {x: pts[0], y: pts[1]}, {x: pts[2], y: pts[3]}); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); if (dist < closestDist) { closestDist = dist; closestPoint = proj; targetSnapWall = null; } }
                            }
                        }
    
                        if (planner.shapes) {
                            for (let s of planner.shapes) {
                                if (s.type !== 'shape_rect' && s.type !== 'shape_floor_cut' && s.type !== 'shape_polygon') continue;
                                let pts = []; if (s.type === 'shape_rect') { const w = s.params.width; const h = s.params.height; pts = [ {x: -w/2, y: -h/2}, {x: w/2, y: -h/2}, {x: w/2, y: h/2}, {x: -w/2, y: h/2} ]; } else { pts = s.params.points; }
                                if (!pts) continue;
                                const transform = s.group.getTransform();
                                for (let i = 0; i < pts.length; i++) {
                                    const p1 = transform.point(pts[i]); const p2 = transform.point(pts[(i + 1) % pts.length]);
                                    let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y);
                                    if (d1 < closestDist) { closestDist = d1; closestPoint = p1; targetSnapWall = null; }
                                    const proj = planner.getClosestPointOnSegment(pos, p1, p2);
                                    const dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                                    if (dist < closestDist) { closestDist = dist; closestPoint = proj; targetSnapWall = null; }
                                }
                            }
                        }
    
                        for (let w of planner.walls) { 
                            let proj = planner.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position()); 
                            let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); 
                            if (dist < closestDist) { closestDist = dist; closestPoint = proj; targetSnapWall = w; } 
                        } 
                        if (closestPoint) targetPos = closestPoint; 
                    } 
                }
            } 
            
            // Removed to allow placing walls without collision restrictions, per user request.
            // if (planner.drawing && wallConfig && wallConfig.events.includes("stop_collision") && planner.checkWallIntersection(planner.lastAnchor.position(), targetPos, [targetSnapWall])) return; 
            
            
            const currentAnchor = planner.getOrCreateAnchor(targetPos.x, targetPos.y); 
            if (!planner.drawing) { 
                planner.drawing = true; 
                planner.lastAnchor = currentAnchor; 
                planner.startAnchor = currentAnchor; 
                planner.currentSessionEntities = []; 
                currentAnchor.show(); 
                if (planner.onDrawingChange) planner.onDrawingChange(true); 
                planner.mainLayer.batchDraw();
            } 
            else { 
                let reachedArcEnd = false;
                let sharedArc = null;
                if (planner.lastAnchor !== currentAnchor) { 
                    sharedArc = (planner.arcs || []).find(arc => {
                        let arcNodes = [arc.p1, ...arc.intermediateAnchors, arc.p2];
                        return arcNodes.includes(planner.lastAnchor) && arcNodes.includes(currentAnchor);
                    });
                    
                    if (sharedArc) {
                        let arcNodes = [sharedArc.p1, ...sharedArc.intermediateAnchors, sharedArc.p2];
                        let i1 = arcNodes.indexOf(planner.lastAnchor);
                        let i2 = arcNodes.indexOf(currentAnchor);
                        let step = i1 < i2 ? 1 : -1;
                        
                        let prev = arcNodes[i1];
                        for(let i = i1 + step; i !== i2 + step; i += step) {
                            let curr = arcNodes[i];
                            let w;
                            if (planner.tool === 'railing') {
                                w = new PremiumRailing(this, prev, curr);
                                w.parentArc = sharedArc;
                                w.labelGroup.visible(false);
                                w.poly.off('mousedown touchstart');
                                w.poly.on('mousedown touchstart', (e) => { 
                                    if (planner.tool === 'select') { 
                                        e.cancelBubble = true; 
                                        planner.selectEntity(w, 'wall'); 
                                    } 
                                });
                                w.poly.draggable(false); 
                                w.poly.on('dragstart dragmove dragend', (e) => e.cancelBubble = true);
                            } else {
                                w = new PremiumWall(this, prev, curr, planner.tool);
                            }
                            planner.walls.push(w);
                            planner.lastDrawnEntity = w;
                            planner.currentSessionEntities.push(w);
                            prev = curr;
                        }
                        
                        if (i2 === 0 || i2 === arcNodes.length - 1) reachedArcEnd = true;
                        if (planner.tool === 'railing' && ((i1 === 0 && i2 === arcNodes.length - 1) || (i2 === 0 && i1 === arcNodes.length - 1))) {
                            sharedArc.hasRailing = true;
                        }
                    } else {
                        if (planner.tool === 'railing') {
                            const w = new PremiumRailing(this, planner.lastAnchor, currentAnchor);
                            planner.walls.push(w);
                            planner.lastDrawnEntity = w;
                            planner.currentSessionEntities.push(w);
                        } else {
                            const w = new PremiumWall(this, planner.lastAnchor, currentAnchor, planner.tool);
                            planner.walls.push(w); 
                            planner.lastDrawnEntity = w;
                            planner.currentSessionEntities.push(w);
                        }
                    }
                }
                planner.lastAnchor = currentAnchor; 
                currentAnchor.show();
                if (isTouch) {
                    planner.mobileDrawState = 'ChainWaiting';
                }

                if (reachedArcEnd && planner.tool === 'railing') { 
                    planner.finishChain(); 
                    planner.tool = 'select'; planner.updateToolStates();
                    if (planner.onToolChange) planner.onToolChange('select');
                    
                    if (sharedArc) {
                        const attachedRailing = planner.walls.filter(w => w.type === 'railing' && w.parentArc === sharedArc);
                        if (attachedRailing.length > 0) {
                            planner.selectEntity(attachedRailing[0], 'wall');
                        }
                    }
                }
            }
            planner.lastPlacementTime = Date.now();
            planner.syncAll(); 
    };

        planner.stage.on("click tap", (e) => {
            if (planner.gestureManager && planner.gestureManager.isActive()) return;
            let pos = planner.getPointerPos(e) || planner.lastRawTouchPos;
            if (!pos) return;
            let snapPos = { x: planner.snap(pos.x), y: planner.snap(pos.y) };

            if (planner.tool.startsWith('preset_') && PRESET_REGISTRY[planner.tool] && planner.activePresetParams) {
                const preset = PRESET_REGISTRY[planner.tool];
                const alignData = autoAlign(this, snapPos, planner.activePresetParams.elevation, planner.activePresetParams.depth);
                const group = preset.generate(this, snapPos, planner.activePresetParams, alignData);
                planner.syncAll();
                planner.updateToolStates();
                planner.tool = 'select';
                if (planner.presetPreview) { planner.presetPreview.visible(false); }
                if (planner.onToolChange) planner.onToolChange('select');
                if (group) {
                    planner.selectEntity(group, 'preset_group');
                }
                return;
            }

            const isTouch = e.evt && (e.evt.changedTouches || e.evt.pointerType === 'touch');
            const isWallTool = ['outer', 'inner', 'railing', 'roof'].includes(planner.tool);

            if (isTouch && isWallTool && planner.mobileDrawState === 'ChainWaiting') {
                const scale = planner.stage.scaleX() || 1;
                const activeSnapDist = 20 / scale;
                let tappedEntity = false;

                // Don't treat a tap on the lastAnchor (red handle) as a room closure
                if (planner.lastAnchor && Math.hypot(pos.x - planner.lastAnchor.x, pos.y - planner.lastAnchor.y) < activeSnapDist * 2) {
                    return; 
                }

                if (planner.startAnchor && Math.hypot(pos.x - planner.startAnchor.x, pos.y - planner.startAnchor.y) < activeSnapDist * 3) {
                    tappedEntity = true;
                } else if (planner.anchors.some(a => a !== planner.lastAnchor && Math.hypot(a.x - pos.x, a.y - pos.y) < activeSnapDist * 1.5)) {
                    tappedEntity = true;
                } else {
                    for (let w of planner.walls) {
                        let proj = planner.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                        if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < activeSnapDist) {
                            tappedEntity = true; break;
                        }
                    }
                }

                let isTap = planner.lastTouchDownPos && Math.hypot(pos.x - planner.lastTouchDownPos.x, pos.y - planner.lastTouchDownPos.y) < 10 / scale;
                if (tappedEntity || isTap) {
                    planner._executePointerDownLogic(e, pos, true);
                    planner.preview?.destroy(); planner.preview = null;
                    planner.hideInfoBadge();
                    planner.hideSnapGlow();
                    if (planner.smartGuides) planner.smartGuides.clear();
                    if (planner.drawing) {
                        planner.mobileDrawState = 'ChainWaiting';
                    } else {
                        planner.mobileDrawState = 'Idle';
                    }
                    planner.uiLayer.batchDraw();
                    return;
                }
            }
        });

        planner.stage.on("mousemove touchmove", (e) => {
            const _isTouchMove = e.evt && (e.evt.touches || e.evt.pointerType === 'touch');
            if (_isTouchMove && planner._touchDrawTimer) { planner._touchDrawCancelled = true; }
            if (e.evt && e.evt.touches && e.evt.touches.length > 1) return;
            if (planner.gestureManager && planner.gestureManager.isActive()) return;
            
            const isWallTool = ['outer', 'inner', 'railing', 'roof'].includes(planner.tool);
            if (_isTouchMove && isWallTool && (planner.mobileDrawState === 'ChainWaiting' || planner.mobileIsPanning)) return;

            if (e.target === planner.stage || e.target === planner.bgLayer || e.target === planner.mainLayer) {
                document.body.style.cursor = ''; 
                planner.stage.container().style.cursor = planner.tool === 'select' ? (planner.stage.isDragging() ? 'grabbing' : 'grab') : 'crosshair';
            }

            let pos = planner.getPointerPos(e);
            if (!pos) return;
            let rawPos = { x: planner.snap(pos.x), y: planner.snap(pos.y) };
            // Smart Snapping Edge-Specific Highlight for Placement Tools
            const isAdvancedOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(planner.tool);
            const isMolding = !!MOLDING_REGISTRY[planner.tool];
            const isWidget = !!WIDGET_REGISTRY[planner.tool];
            const isPlacementTool = isWidget || isAdvancedOpening || isMolding;

            if (isPlacementTool) {
                let closestWall = null;
                let minWallDist = 60 / (planner.stage.scaleX() || 1); // Dynamic snap distance based on zoom
                let closestFace = null;
                
                // Hide all highlights first
                planner.walls.forEach(w => {
                    if (w.frontHighlight) w.frontHighlight.visible(false);
                    if (w.backHighlight) w.backHighlight.visible(false);
                });
                
                for (let w of planner.walls) {
                    const start = w.startAnchor.position();
                    const end = w.endAnchor.position();
                    const proj = planner.getClosestPointOnSegment(pos, start, end);
                    const dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    
                    if (dist < minWallDist) {
                        closestWall = w;
                        minWallDist = dist;
                        const dx = end.x - start.x;
                        const dy = end.y - start.y;
                        const cp = (pos.x - start.x) * dy - (pos.y - start.y) * dx;
                        closestFace = cp > 0 ? 'back' : 'front';
                    }
                }
                
                if (closestWall) {
                    if (closestFace === 'front' && closestWall.frontHighlight) closestWall.frontHighlight.visible(true);
                    else if (closestWall.backHighlight) closestWall.backHighlight.visible(true);
                }
                planner.mainLayer.batchDraw();
                return;
            }
            if (planner.drawingShapeType === 'shape_rect' && planner.shapeStartPos) {
                const w = pos.x - planner.shapeStartPos.x; const h = pos.y - planner.shapeStartPos.y;
                planner.shapePreviewRect.width(w); planner.shapePreviewRect.height(h);
                planner.updateInfoBadge(pos.x, pos.y + 30, `W: ${planner.formatLength(Math.abs(w))}\nH: ${planner.formatLength(Math.abs(h))}`, "", false);
                planner.uiLayer.batchDraw(); return;
            } else if (planner.drawingShapeType === 'shape_circle' && planner.shapeStartPos) {
                const r = Math.hypot(pos.x - planner.shapeStartPos.x, pos.y - planner.shapeStartPos.y);
                planner.shapePreviewCircle.radius(r);
                planner.updateInfoBadge(pos.x, pos.y + 30, `R: ${planner.formatLength(r)}`, "", false);
                planner.uiLayer.batchDraw(); return;
            } else if (planner.tool === 'shape_triangle' && planner.drawingTriangle) {
                const pts = planner.drawingTriangle.flatMap(p => [p.x, p.y]); pts.push(pos.x, pos.y);
                planner.shapePreviewTriangle.points(pts); planner.shapePreviewTriangle.visible(true);
                planner.updateInfoBadge(pos.x, pos.y + 30, `Point ${planner.drawingTriangle.length + 1}`, "", false);
                planner.uiLayer.batchDraw(); return;
            }

            if (planner.tool.startsWith('preset_') && PRESET_REGISTRY[planner.tool] && planner.activePresetParams) {
                if (!planner.presetPreview) {
                    planner.presetPreview = new Konva.Shape({ stroke: '#4f46e5', strokeWidth: 2, fill: 'rgba(79, 70, 229, 0.2)', dash: [5, 5] });
                    planner.presetPreview.sceneFunc((ctx, shape) => {
                        const preset = PRESET_REGISTRY[planner.tool];
                        if (preset && preset.icon2d && planner.activePresetParams) {
                            preset.icon2d(ctx, planner.activePresetParams.width || 200, planner.activePresetParams.depth || 200);
                        }
                    });
                    planner.uiLayer.add(planner.presetPreview);
                }
                const alignData = autoAlign(this, rawPos, planner.activePresetParams.elevation, planner.activePresetParams.depth);
                planner.presetPreview.position(rawPos);
                planner.presetPreview.rotation(alignData.rotation);
                
                planner.presetPreview.visible(true);
                planner.presetPreview.sceneFunc((ctx, shape) => {
                    const preset = PRESET_REGISTRY[planner.tool];
                    if (preset && preset.icon2d && planner.activePresetParams) {
                        preset.icon2d(ctx, planner.activePresetParams.width || 200, planner.activePresetParams.depth || 200);
                    }
                });
                planner.uiLayer.batchDraw();
                return;
            } else if (planner.presetPreview && planner.presetPreview.visible()) {
                planner.presetPreview.visible(false);
                planner.uiLayer.batchDraw();
            }

            if (planner.tool === 'split') {
                const hitThreshold = 20 / (planner.stage.scaleX() || 1);
                let foundGlow = false;
                for (let w of planner.walls) {
                    if (!WALL_REGISTRY[w.type] || !WALL_REGISTRY[w.type].events.includes('split_edge')) continue;
                    const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                    const proj = planner.getClosestPointOnSegment(pos, p1, p2);
                    if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < hitThreshold) {
                        planner.splitPreviewGlow.position(proj); planner.splitPreviewGlow.show();
                        foundGlow = true; break;
                    }
                }
                if (!foundGlow && planner.balconies) {
                    for (let b of planner.balconies) {
                        if (!WIDGET_REGISTRY['balcony'] || !WIDGET_REGISTRY['balcony'].events.includes('split_edge')) continue;
                        const pts = b.vertices || b.points; if (!pts || pts.length < 3) continue;
                        const transform = b.group.getTransform();
                        for (let i = 0; i < pts.length; i++) {
                            const p1 = transform.point(pts[i]); const p2 = transform.point(pts[(i + 1) % pts.length]);
                            const proj = planner.getClosestPointOnSegment(pos, p1, p2);
                            if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < hitThreshold) { planner.splitPreviewGlow.position(proj); planner.splitPreviewGlow.show(); foundGlow = true; break; }
                        }
                    }
                }
                if (!foundGlow && planner.shapes) {
                    for (let s of planner.shapes) {
                        if (s.type !== 'shape_rect' && s.type !== 'shape_floor_cut' && s.type !== 'shape_polygon') continue;
                        let pts = []; if (s.type === 'shape_rect') { const w = s.params.width; const h = s.params.height; pts = [ {x: -w/2, y: -h/2}, {x: w/2, y: -h/2}, {x: w/2, y: h/2}, {x: -w/2, y: h/2} ]; } else { pts = s.params.points; }
                        const transform = s.group.getTransform();
                        for (let i = 0; i < pts.length; i++) {
                            const p1 = transform.point(pts[i]); const p2 = transform.point(pts[(i + 1) % pts.length]); const proj = planner.getClosestPointOnSegment(pos, p1, p2);
                            if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < hitThreshold) { planner.splitPreviewGlow.position(proj); planner.splitPreviewGlow.show(); foundGlow = true; break; }
                        }
                    }
                }
                if (!foundGlow && planner.splitPreviewGlow) planner.splitPreviewGlow.hide(); planner.uiLayer.batchDraw(); return;
            } else { if (planner.splitPreviewGlow) planner.splitPreviewGlow.hide(); }

            if (planner.tool === 'arc') {
                if (planner.drawingArc && planner.drawingArc.isFrozen) return;
                const isTouch = e.evt && (e.evt.touches || e.evt.pointerType === 'touch');
                const scale = planner.stage.scaleX() || 1;
                let activeSnapDist = isTouch ? (SNAP_DIST * 1.5) / scale : SNAP_DIST / scale;
                
                let snap = rawPos;
                let closestDist = activeSnapDist;
                let snappedObj = false;
                let targetSnapWall = null;

                if (isTouch && planner.lastStickyArcSnap) {
                    const dragDist = Math.hypot(pos.x - planner.lastStickyArcSnap.rawPos.x, pos.y - planner.lastStickyArcSnap.rawPos.y);
                    if (dragDist < 25) {
                        snap = { x: planner.lastStickyArcSnap.snapPos.x, y: planner.lastStickyArcSnap.snapPos.y };
                        snappedObj = true;
                        targetSnapWall = planner.lastStickyArcSnap.wall;
                        closestDist = 0;
                    } else {
                        planner.lastStickyArcSnap = null;
                    }
                }

                let snappedToAxis = false;
                if (planner.drawingArc && planner.drawingArc.state === 1) {
                    const p1 = planner.drawingArc.p1;
                    let dxAxis = rawPos.x - p1.x, dyAxis = rawPos.y - p1.y;
                    let rawAngle = Math.atan2(dyAxis, dxAxis) * 180 / Math.PI;
                    let distAxis = Math.hypot(dxAxis, dyAxis);
                    for (let a of [0, 45, 90, 135, 180, -45, -90, -135, -180]) {
                        if (Math.abs(rawAngle - a) < 5) { 
                            let rad = a * Math.PI / 180; 
                            rawPos.x = p1.x + distAxis * Math.cos(rad); 
                            rawPos.y = p1.y + distAxis * Math.sin(rad); 
                            snappedToAxis = true; 
                            planner.drawGuideLine(p1.x, p1.y, rawPos.x, rawPos.y, true); 
                            break; 
                        }
                    }
                    if (!snappedToAxis) planner.drawGuideLine(0,0,0,0, false);
                    if (!snappedObj) snap = rawPos;
                }

                if (closestDist > 0) {
                    let a = planner.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < activeSnapDist);
                    if (a) { snap = { x: a.x, y: a.y }; closestDist = Math.hypot(a.x - pos.x, a.y - pos.y); snappedObj = true; }

                    for (let w of planner.walls) {
                        let proj = planner.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                        let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                        if (dist < closestDist) { closestDist = dist; snap = proj; snappedObj = true; targetSnapWall = w; }
                    }
                }
                
                if (isTouch && snappedObj && !planner.lastStickyArcSnap) {
                    planner.lastStickyArcSnap = { rawPos: { x: pos.x, y: pos.y }, snapPos: { x: snap.x, y: snap.y }, wall: targetSnapWall };
                }

                if (snappedObj && (!planner.drawingArc || planner.drawingArc.state === 1)) {
                    planner.showSnapGlow(snap.x, snap.y);
                } else {
                    planner.hideSnapGlow();
                }
                
                planner.walls.forEach(w => w.setHighlight(w === planner.selectedEntity || (w.parentArc && w.parentArc === planner.selectedEntity)));
                
                if (planner.drawingArc && planner.drawingArc.state === 1) {
                    planner.arcMousePos = snap;
                }
                
                if (planner.drawingArc && planner.arcPreview) {
                    if (planner.drawingArc.state === 1) {
                        planner.arcPreview.lineBase.points([planner.drawingArc.p1.x, planner.drawingArc.p1.y, snap.x, snap.y]);
                        planner.arcPreview.lineBase.visible(true);
                        planner.arcPreview.ghostCircle.visible(false);
                        planner.arcPreview.angleFill.visible(false);
                        planner.arcPreview.radiusLines.visible(false);
                        planner.arcPreview.guideLine.visible(false);
                        planner.arcPreview.arcCurve.visible(false);
                        
                        let dxBadge = snap.x - planner.drawingArc.p1.x, dyBadge = snap.y - planner.drawingArc.p1.y;
                        let lenBadge = planner.formatLength(Math.hypot(dxBadge, dyBadge));
                        let angBadge = Math.abs(Math.atan2(dyBadge, dxBadge) * 180 / Math.PI).toFixed(1);
                        planner.updateInfoBadge(snap.x, snap.y, lenBadge, angBadge, snappedObj);
                    } else if (planner.drawingArc.state === 2) {
                        planner.updateArcPreviewState2(planner.arcMousePos);
                    }
                    planner.uiLayer.batchDraw();
                }
                
                document.body.style.cursor = 'crosshair';
                return;
            }
            const wallConfig = WALL_REGISTRY[planner.tool]; 
            
            let refAngle = 0;
            let isWallReference = false;
            if (planner.drawing && planner.lastAnchor) {
                const connectedWalls = planner.walls.filter(w => w.endAnchor === planner.lastAnchor || w.startAnchor === planner.lastAnchor);
                if (connectedWalls.length > 0) {
                    const w = connectedWalls[0];
                    const otherAnc = w.startAnchor === planner.lastAnchor ? w.endAnchor : w.startAnchor;
                    refAngle = Math.atan2(otherAnc.y - planner.lastAnchor.y, otherAnc.x - planner.lastAnchor.x) * 180 / Math.PI;
                    isWallReference = true;
                } else {
                    for (let w of planner.walls) {
                        const p1 = w.startAnchor.position();
                        const p2 = w.endAnchor.position();
                        const lastPos = { x: planner.lastAnchor.x, y: planner.lastAnchor.y };
                        const proj = planner.getClosestPointOnSegment(lastPos, p1, p2);
                        if (Math.hypot(lastPos.x - proj.x, lastPos.y - proj.y) < 2) {
                            let distToP1 = Math.hypot(lastPos.x - p1.x, lastPos.y - p1.y);
                            let distToP2 = Math.hypot(lastPos.x - p2.x, lastPos.y - p2.y);
                            if (distToP1 > distToP2) {
                                refAngle = Math.atan2(p1.y - lastPos.y, p1.x - lastPos.x) * 180 / Math.PI;
                            } else {
                                refAngle = Math.atan2(p2.y - lastPos.y, p2.x - lastPos.x) * 180 / Math.PI;
                            }
                            isWallReference = true;
                            break;
                        }
                    }
                }
                if (planner.smartGuides && planner.smartGuides.calculateAngleSnap) {
                    rawPos = planner.smartGuides.calculateAngleSnap(planner.lastAnchor.position(), rawPos, refAngle);
                }
            }

            let snapPos = rawPos; let targetSnapWall = null; let snappedObj = false;
            const isTouch = e && e.type && (e.type.startsWith('touch') || e.pointerType === 'touch');
            const activeSnapDist = isTouch ? SNAP_DIST * 1.4 : SNAP_DIST;

            if (wallConfig && wallConfig.events.includes("snap_to_wall")) { 
                let closestDist = activeSnapDist;

                if (isTouch && planner.lastStickySnap && Math.hypot(pos.x - planner.lastStickySnap.rawPos.x, pos.y - planner.lastStickySnap.rawPos.y) < activeSnapDist * 1.1) {
                    snapPos = { x: planner.lastStickySnap.snapPos.x, y: planner.lastStickySnap.snapPos.y };
                    targetSnapWall = planner.lastStickySnap.wall;
                    snappedObj = true;
                    closestDist = 0;
                } else {
                    planner.lastStickySnap = null;
                }

                if (closestDist > 0) {
                    let a = planner.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < activeSnapDist); 
                    if (a) { snapPos = { x: a.x, y: a.y }; targetSnapWall = planner.walls.find(w => w.startAnchor === a || w.endAnchor === a); snappedObj = true; } 
                    else { 
                        let closestPoint = null; 
    
                        let allReferenceWalls = planner.referenceGroup ? planner.referenceGroup.getChildren() : [];
                        for (let line of allReferenceWalls) {
                            let pts = line.getAttr('refPts') || line.points();
                            if (pts && pts.length === 4) {
                                let d1 = Math.hypot(pos.x - pts[0], pos.y - pts[1]);
                                let d2 = Math.hypot(pos.x - pts[2], pos.y - pts[3]);
                                if (d1 < 40 && d1 < closestDist) { closestDist = 0; closestPoint = {x: pts[0], y: pts[1]}; snappedObj = true; targetSnapWall = null; }
                                else if (d2 < 40 && d2 < closestDist) { closestDist = 0; closestPoint = {x: pts[2], y: pts[3]}; snappedObj = true; targetSnapWall = null; }
                                else {
                                    let proj = planner.getClosestPointOnSegment(pos, {x: pts[0], y: pts[1]}, {x: pts[2], y: pts[3]});
                                    let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                                    if (dist < closestDist) { closestDist = dist; closestPoint = proj; snappedObj = true; targetSnapWall = null; }
                                }
                            }
                        }
    
                        if (planner.shapes) {
                            for (let s of planner.shapes) {
                                if (s.type !== 'shape_rect' && s.type !== 'shape_floor_cut' && s.type !== 'shape_polygon') continue;
                                let pts = []; if (s.type === 'shape_rect') { const w = s.params.width; const h = s.params.height; pts = [ {x: -w/2, y: -h/2}, {x: w/2, y: -h/2}, {x: w/2, y: h/2}, {x: -w/2, y: h/2} ]; } else { pts = s.params.points; }
                                if (!pts) continue;
                                const transform = s.group.getTransform();
                                for (let i = 0; i < pts.length; i++) {
                                    const p1 = transform.point(pts[i]); const p2 = transform.point(pts[(i + 1) % pts.length]);
                                    let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y);
                                    if (d1 < closestDist) { closestDist = d1; closestPoint = p1; snappedObj = true; targetSnapWall = null; }
                                    const proj = planner.getClosestPointOnSegment(pos, p1, p2);
                                    const dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                                    if (dist < closestDist) { closestDist = dist; closestPoint = proj; snappedObj = true; targetSnapWall = null; }
                                }
                            }
                        }
    
                        for (let w of planner.walls) { 
                            let proj = planner.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position()); 
                            let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y); 
                            if (dist < closestDist) { closestDist = dist; closestPoint = proj; targetSnapWall = w; snappedObj = true; } 
                        } 
                        if (closestPoint) snapPos = closestPoint; 
                    } 
                }

                if (isTouch && snappedObj) {
                    planner.lastStickySnap = { rawPos: { x: pos.x, y: pos.y }, snapPos: { x: snapPos.x, y: snapPos.y }, wall: targetSnapWall };
                }
            }

            let endRefAngle = 0;
            let isEndWallReference = false;
            if (planner.drawing && targetSnapWall) {
                const p1 = targetSnapWall.startAnchor.position();
                const p2 = targetSnapWall.endAnchor.position();
                let distToP1 = Math.hypot(snapPos.x - p1.x, snapPos.y - p1.y);
                let distToP2 = Math.hypot(snapPos.x - p2.x, snapPos.y - p2.y);
                if (distToP1 > distToP2) {
                    endRefAngle = Math.atan2(p1.y - snapPos.y, p1.x - snapPos.x) * 180 / Math.PI;
                } else {
                    endRefAngle = Math.atan2(p2.y - snapPos.y, p2.x - snapPos.x) * 180 / Math.PI;
                }
                isEndWallReference = true;
            }
            
            if (planner.lastAnchor) {
                let dxBadge = snapPos.x - planner.lastAnchor.x, dyBadge = snapPos.y - planner.lastAnchor.y;
                let lenBadge = planner.formatLength(Math.hypot(dxBadge, dyBadge));
                let angBadge = Math.abs(Math.atan2(dyBadge, dxBadge) * 180 / Math.PI).toFixed(1);
                planner.updateInfoBadge(snapPos.x, snapPos.y, lenBadge, angBadge, snappedObj);
            } else {
                planner.hideInfoBadge();
            }

            if (snappedObj) { planner.showSnapGlow(snapPos.x, snapPos.y, isTouch); } else { planner.hideSnapGlow(); }

            planner.walls.forEach(w => {
                let isHigh = (w === planner.selectedEntity || (w.parentArc && w.parentArc === planner.selectedEntity));
                const isDrawingTool = ['wall', 'room', 'railing', 'arc', 'shape_rect', 'shape_circle', 'shape_triangle', 'roof'].includes(planner.tool);
                if (!isHigh && w === targetSnapWall && !isDrawingTool) {
                    isHigh = true;
                }
                w.setHighlight(isHigh);
            });

            if (!planner.drawing) {
                planner.uiLayer.batchDraw();
                return;
            }

            let isColliding = false; 
            if (wallConfig && (wallConfig.events.includes("collision_detected") || wallConfig.events.includes("stop_collision"))) { isColliding = planner.checkWallIntersection(planner.lastAnchor.position(), snapPos, [targetSnapWall]); } 
            
            planner.preview?.destroy(); 
            const isClosing = (planner.startAnchor && Math.hypot(planner.startAnchor.x - snapPos.x, planner.startAnchor.y - snapPos.y) < 15); 
            let drawColor = (isColliding && wallConfig && wallConfig.events.includes("stop_collision")) ? "#ef4444" : (isClosing ? "#10b981" : "#3b82f6"); 
            
            let previewPoints = [planner.lastAnchor.x, planner.lastAnchor.y, snapPos.x, snapPos.y];
            if (!isColliding && planner.drawing && (planner.tool === 'railing' || planner.tool === 'outer' || planner.tool === 'inner')) {
                let a2 = planner.anchors.find(a => Math.hypot(a.x - snapPos.x, a.y - snapPos.y) < 1);
                if (a2) {
                    let sharedArc = (planner.arcs || []).find(arc => {
                        let arcNodes = [arc.p1, ...arc.intermediateAnchors, arc.p2];
                        return arcNodes.includes(planner.lastAnchor) && arcNodes.includes(a2);
                    });
                    if (sharedArc) {
                        let arcNodes = [sharedArc.p1, ...sharedArc.intermediateAnchors, sharedArc.p2];
                        let i1 = arcNodes.indexOf(planner.lastAnchor);
                        let i2 = arcNodes.indexOf(a2);
                        let step = i1 < i2 ? 1 : -1;
                        previewPoints = [];
                        for(let i = i1; i !== i2 + step; i += step) previewPoints.push(arcNodes[i].x, arcNodes[i].y);
                    }
                }
            }
            
            let previewThickness = wallConfig && wallConfig.thickness ? wallConfig.thickness : 2;
            if (isTouch) previewThickness = Math.max(previewThickness, 8);
            planner.preview = new Konva.Line({ points: previewPoints, stroke: drawColor, strokeWidth: previewThickness, lineCap: 'square', opacity: 0.6 }); 
            planner.uiLayer.add(planner.preview); 
            planner.preview.moveToBottom();
            
            if (planner.drawing && planner.lastAnchor && planner.smartGuides && planner.smartGuides.drawAngleGuide) {
                let drawnStart = false;
                if (isWallReference) {
                    planner.smartGuides.drawAngleGuide(planner.lastAnchor.position(), snapPos, refAngle, true);
                    drawnStart = true;
                } else {
                    planner.smartGuides.clear();
                }
                if (isEndWallReference) {
                    planner.smartGuides.drawAngleGuide(snapPos, planner.lastAnchor.position(), endRefAngle, true, drawnStart);
                }
            } else if (planner.smartGuides && planner.smartGuides.clear) {
                planner.smartGuides.clear();
            }

            planner.uiLayer.batchDraw(); 
        }); 

        planner._handleGlobalKeyDown = (e) => {
            if (e.key === 'Escape') planner.finishChain();
        };
        window.addEventListener('keydown', planner._handleGlobalKeyDown);

        planner.stage.on('mouseup touchend', (e) => {
            if (e.evt && e.evt.touches && e.evt.touches.length > 0) return;
            const wasPanning = planner.mobileIsPanning;
            planner.mobileIsPanning = false;
            
            const isTouchRelease = e.evt && (e.evt.changedTouches || e.evt.pointerType === 'touch');
            const isWallTool = ['outer', 'inner', 'railing', 'roof'].includes(planner.tool);

            const pos = planner.getPointerPos(e) || planner.lastRawTouchPos;

            if (isTouchRelease && isWallTool && planner.mobileDrawState === 'PreviewDrawing') {
                if (pos && planner.lastAnchor) {
                    const dist = Math.hypot(pos.x - planner.lastAnchor.x, pos.y - planner.lastAnchor.y);
                    const scale = planner.stage.scaleX() || 1;
                    if (dist < 25 / scale) {
                        planner.mobileDrawState = 'ChainWaiting';
                        planner.preview?.destroy();
                        planner.preview = null;
                        planner.hideInfoBadge();
                        planner.hideSnapGlow();
                        planner.uiLayer.batchDraw();
                        return;
                    }
                    planner._executePointerDownLogic(e, pos, true);
                    planner.preview?.destroy(); planner.preview = null;
                    planner.hideInfoBadge();
                    planner.hideSnapGlow();
                    if (planner.smartGuides) planner.smartGuides.clear();
                    if (planner.drawing) {
                        planner.mobileDrawState = 'ChainWaiting';
                    }
                } else {
                    if (planner.drawing) {
                        planner.mobileDrawState = 'ChainWaiting';
                    }
                }
                return;
            }

            if (planner.tool === 'arc' && planner.drawingArc && planner.drawingArc.state === 2) {
                if (isTouchRelease) {
                    planner.drawingArc.isFrozen = true;
                    planner.drawingArc.frozenPos = { ...planner.arcMousePos };
                }
            }

            if (planner.drawingShapeType) {
                if (planner.drawingShapeType === 'shape_rect') {
                    const targetPos = planner.getPointerPos(e);
                    const cx = (planner.shapeStartPos.x + targetPos.x) / 2;
                    const cy = (planner.shapeStartPos.y + targetPos.y) / 2;
                    const w = targetPos.x - planner.shapeStartPos.x;
                    const h = targetPos.y - planner.shapeStartPos.y;
                    if (Math.abs(w) > 5 && Math.abs(h) > 5) {
                        const newShape = new PremiumShape(this, 'shape_rect', { 
                            x: cx, y: cy, width: Math.abs(w), height: Math.abs(h)
                        });
                        if (!planner.shapes) planner.shapes = []; planner.shapes.push(newShape); planner.tool = 'select'; planner.updateToolStates(); if (planner.onToolChange) planner.onToolChange('select'); planner.selectEntity(newShape, 'shape');
                    }
                    planner.shapePreviewRect.visible(false);
                } else if (planner.drawingShapeType === 'shape_circle') {
                    const r = planner.shapePreviewCircle.radius();
                    if (r > 5) {
                        const newShape = new PremiumShape(this, 'shape_circle', { x: planner.shapeStartPos.x, y: planner.shapeStartPos.y, radius: r });
                        if(!planner.shapes) planner.shapes = []; planner.shapes.push(newShape); planner.tool = 'select'; planner.updateToolStates(); if (planner.onToolChange) planner.onToolChange('select'); planner.selectEntity(newShape, 'shape');
                    }
                    planner.shapePreviewCircle.visible(false);
                }
                planner.drawingShapeType = null; planner.shapeStartPos = null; planner.hideInfoBadge(); planner.uiLayer.batchDraw(); planner.syncAll();
            }
        });

        // --- Hip Roof Drawing Mode Logic ---
        planner.getOuterEdgePointsForRoofSnapping = (w) => {
            if (w.type !== 'outer' || !w.wallShapeData) return typeof w.getExactPolygonPoints === 'function' ? w.getExactPolygonPoints() : [];
            const { startL, endL, endR, startR, startData, endData } = w.wallShapeData;
            const midL = { x: (startL.x + endL.x)/2, y: (startL.y + endL.y)/2 };
            const midR = { x: (startR.x + endR.x)/2, y: (startR.y + endR.y)/2 };
            
            let crossesL = 0, crossesR = 0;
            for (let otherW of planner.walls) {
                if (otherW === w || otherW.type !== 'outer') continue;
                let p1 = otherW.startAnchor, p2 = otherW.endAnchor;
                if (((p1.y > midL.y) !== (p2.y > midL.y)) && (midL.x < (p2.x - p1.x) * (midL.y - p1.y) / (p2.y - p1.y) + p1.x)) crossesL++;
                if (((p1.y > midR.y) !== (p2.y > midR.y)) && (midR.x < (p2.x - p1.x) * (midR.y - p1.y) / (p2.y - p1.y) + p1.x)) crossesR++;
            }
            const isLOutside = crossesL % 2 === 0;
            const isROutside = crossesR % 2 === 0;
            
            let pts = [];
            if (isLOutside && !isROutside) {
                if (startData.bevelL) pts.push(startData.bevelL.x, startData.bevelL.y);
                pts.push(startL.x, startL.y, endL.x, endL.y);
                if (endData.bevelL) pts.push(endData.bevelL.x, endData.bevelL.y);
            } else if (isROutside && !isLOutside) {
                if (startData.bevelR) pts.push(startData.bevelR.x, startData.bevelR.y);
                pts.push(startR.x, startR.y, endR.x, endR.y);
                if (endData.bevelR) pts.push(endData.bevelR.x, endData.bevelR.y);
            } else {
                return typeof w.getExactPolygonPoints === 'function' ? w.getExactPolygonPoints() : [];
            }
            return pts;
        };

        planner._executeRoofPointerDownLogic = (pos) => {
            if (planner.tool !== 'roof' && planner.tool !== 'shape_floor_cut') return;
            planner.drawing = true;
            
            let snap = pos;
            let closestDist = SNAP_DIST * 2.5; // Stronger snapping for roof outer edges
            
            let allReferenceWalls = planner.referenceGroup ? planner.referenceGroup.getChildren() : [];
            if (planner.tool === 'shape_floor_cut') {
                for (let line of allReferenceWalls) {
                    let pts = line.getAttr('refPts') || line.points();
                    if (pts && pts.length >= 4) {
                        for (let i = 0; i < pts.length; i += 2) {
                            let cx = pts[i], cy = pts[i+1];
                            if (Math.hypot(pos.x - cx, pos.y - cy) < closestDist) { closestDist = Math.hypot(pos.x - cx, pos.y - cy); snap = {x: cx, y: cy}; }
                            let nx = pts[(i+2)%pts.length], ny = pts[(i+3)%pts.length];
                            let proj = planner.getClosestPointOnSegment(pos, {x: cx, y: cy}, {x: nx, y: ny});
                            let distSeg = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                            if (distSeg < closestDist) { closestDist = distSeg; snap = proj; }
                        }
                    }
                }
            }

            // ADD WALL SNAPPING TO MOUSEDOWN
            let isValidPlacement = (planner.tool !== 'roof');
            
            for (let w of planner.walls) {
                if (planner.tool === 'roof' && w.type !== 'outer') continue;
                if (typeof w.getExactPolygonPoints === 'function') {
                    const pts = planner.tool === 'roof' ? planner.getOuterEdgePointsForRoofSnapping(w) : w.getExactPolygonPoints();
                    if (pts && pts.length >= 4) {
                        for (let i = 0; i < pts.length; i += 2) {
                            let cx = pts[i], cy = pts[i+1];
                            let distCorner = Math.hypot(pos.x - cx, pos.y - cy);
                            if (distCorner < closestDist) { closestDist = distCorner; snap = {x: cx, y: cy}; isValidPlacement = true; }
                            
                            let nx = pts[(i+2)%pts.length], ny = pts[(i+3)%pts.length];
                            let proj = planner.getClosestPointOnSegment(pos, {x: cx, y: cy}, {x: nx, y: ny});
                            let distSeg = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                            if (distSeg < closestDist) { closestDist = distSeg; snap = proj; isValidPlacement = true; }
                        }
                    }
                } else if (planner.tool !== 'roof') {
                    const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                    let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y); let d2 = Math.hypot(pos.x - p2.x, pos.y - p2.y);
                    if (d1 < closestDist) { closestDist = d1; snap = p1; }
                    if (d2 < closestDist) { closestDist = d2; snap = p2; }
                    let proj = planner.getClosestPointOnSegment(pos, p1, p2); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                    if (dist < closestDist) { closestDist = dist; snap = proj; }
                }
            }
            
            if (!planner.drawingRoofPoints) {
                if (planner.currentSessionEntities && planner.currentSessionEntities.length > 0) {
                    if (planner.roofCloseTick && Math.hypot(pos.x - planner.roofCloseTick.x(), pos.y - planner.roofCloseTick.y()) < SNAP_DIST * 3) {
                        planner.finishChain();
                        return;
                    }
                    planner.drawing = false; // Prevent drawing state from getting stuck
                    planner.updateInfoBadge(pos.x, pos.y + 40, "Tap the green tick or Finish button", "", false);
                    return;
                }
                if (planner.tool === 'roof' && !isValidPlacement) {
                    planner.drawing = false;
                    return;
                }
                planner.currentSessionEntities = [];
                planner.drawingRoofPoints = [snap];
                planner.startAnchor = { x: snap.x, y: snap.y, position: () => ({ x: snap.x, y: snap.y }) };
                planner.lastAnchor = { x: snap.x, y: snap.y, position: () => ({ x: snap.x, y: snap.y }) };
                if (planner.onDrawingChange) planner.onDrawingChange(true);
                planner.roofPreviewGroup = new Konva.Group();
                planner.roofPreview = new Konva.Line({ 
                    points: [snap.x, snap.y, snap.x, snap.y], 
                    stroke: planner.tool === 'shape_floor_cut' ? '#ef4444' : 'rgba(148, 163, 184, 0.5)', 
                    strokeWidth: planner.tool === 'shape_floor_cut' ? 4 : 2, 
                    fill: planner.tool === 'shape_floor_cut' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(226, 232, 240, 0.4)',
                    closed: true
                });
                planner.roofPreviewGroup.add(planner.roofPreview);
                const startCircle = new Konva.Circle({ x: snap.x, y: snap.y, radius: 6, fill: '#334155', stroke: 'white', strokeWidth: 1.5 });
                planner.roofPreviewGroup.add(startCircle);
                planner.uiLayer.add(planner.roofPreviewGroup);
                planner.uiLayer.batchDraw();
            } else {
                const startP = planner.drawingRoofPoints[0];
                if (Math.hypot(snap.x - startP.x, snap.y - startP.y) < SNAP_DIST && planner.drawingRoofPoints.length > 2) {
                    
                    if (planner.tool === 'shape_floor_cut') {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        planner.drawingRoofPoints.forEach(p => {
                            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                        });
                        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
                        const w = maxX - minX, h = maxY - minY;
                        
                        const relPts = planner.drawingRoofPoints.map(p => ({ x: p.x - cx, y: p.y - cy }));
                        
                        const newShape = new PremiumShape(this, 'shape_floor_cut', { 
                            x: cx, y: cy, width: w, height: h, points: relPts,
                            stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.2)'
                        });
                        if (!planner.shapes) planner.shapes = []; planner.shapes.push(newShape);
                        if (!planner.currentSessionEntities) planner.currentSessionEntities = [];
                        planner.currentSessionEntities.push(newShape);
                        planner.selectEntity(newShape, 'shape');
                    } else {
                        const roof = new PremiumHipRoof(this, planner.drawingRoofPoints);
                        roof.config.roofType = planner.currentRoofToolType || 'hip';
                        planner.roofs.push(roof);
                        if (!planner.currentSessionEntities) planner.currentSessionEntities = [];
                        planner.currentSessionEntities.push(roof);
                        planner.selectEntity(roof, 'roof');
                    }
                    
                    planner.drawingRoofPoints = null; 
                    planner.startAnchor = null;
                    planner.lastAnchor = null;
                    planner.drawing = false; // Set to false to prevent mousemove crash, but do NOT call onDrawingChange(false) yet!
                    // Do NOT call onDrawingChange(false) or set tool = 'select'. Wait for explicit Finish/Cancel!
                    if (planner.roofPreviewGroup) { planner.roofPreviewGroup.destroy(); planner.roofPreviewGroup = null; }
                    else if (planner.roofPreview) { planner.roofPreview.destroy(); }
                    planner.roofPreview = null;
                    planner.hideSnapGlow();
                    if (planner.smartGuides) planner.smartGuides.clear();
                    // Do NOT destroy roofCloseTick here, keep it visible as a finish button!
                    planner.uiLayer.batchDraw();
                } else {
                    if (planner.tool === 'roof' && !isValidPlacement) return;
                    
                    const lastP = planner.drawingRoofPoints[planner.drawingRoofPoints.length - 1];
                    if (lastP && lastP.x === snap.x && lastP.y === snap.y) return;

                    planner.drawingRoofPoints.push(snap);
                    planner.lastAnchor = { x: snap.x, y: snap.y, position: () => ({ x: snap.x, y: snap.y }) };
                    if (planner.roofPreviewGroup) {
                        const newCircle = new Konva.Circle({ x: snap.x, y: snap.y, radius: 4, fill: '#64748b' });
                        planner.roofPreviewGroup.add(newCircle);
                    }
                    const pts = planner.drawingRoofPoints.flatMap(p => [p.x, p.y]); pts.push(snap.x, snap.y);
                    planner.roofPreview.points(pts);
                    planner.uiLayer.batchDraw();
                }
            }
        };

        planner.stage.on("mousemove.roof touchmove.roof", (e) => {
            if (e && e.evt && e.evt.touches && e.evt.touches.length > 1) return;

            if (planner.tool === 'roof' || planner.tool === 'shape_floor_cut') {
                const _isTouchMove = e && e.evt && (e.evt.touches || e.evt.pointerType === 'touch');
                if (_isTouchMove && (planner.mobileDrawState === 'ChainWaiting' || planner.mobileIsPanning)) return;
                
                const pos = planner.getPointerPos(e);
                if (!pos) return;
                
                let snap = pos; 
                let closestDist = SNAP_DIST * 2.5; // Stronger snapping for roof outer edges
                let snappedObj = false;
                let targetSnapWall = null;

                let allReferenceWalls = planner.referenceGroup ? planner.referenceGroup.getChildren() : [];
                if (planner.tool === 'shape_floor_cut') {
                    for (let line of allReferenceWalls) {
                        let pts = line.getAttr('refPts') || line.points();
                        if (pts && pts.length >= 4) {
                            for (let i = 0; i < pts.length; i += 2) {
                                let cx = pts[i], cy = pts[i+1];
                                if (Math.hypot(pos.x - cx, pos.y - cy) < closestDist) { closestDist = Math.hypot(pos.x - cx, pos.y - cy); snap = {x: cx, y: cy}; snappedObj = true; }
                                
                                let nx = pts[(i+2)%pts.length], ny = pts[(i+3)%pts.length];
                                let proj = planner.getClosestPointOnSegment(pos, {x: cx, y: cy}, {x: nx, y: ny});
                                let distSeg = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                                if (distSeg < closestDist) { closestDist = distSeg; snap = proj; snappedObj = true; }
                            }
                        }
                    }
                }

                if (!snappedObj) {
                    for (let w of planner.walls) {
                        if (planner.tool === 'roof' && w.type !== 'outer') continue;
                        if (typeof w.getExactPolygonPoints === 'function') {
                            const pts = planner.tool === 'roof' ? planner.getOuterEdgePointsForRoofSnapping(w) : w.getExactPolygonPoints();
                            if (pts && pts.length >= 4) {
                                for (let i = 0; i < pts.length; i += 2) {
                                    let cx = pts[i], cy = pts[i+1];
                                    if (Math.hypot(pos.x - cx, pos.y - cy) < closestDist) { closestDist = Math.hypot(pos.x - cx, pos.y - cy); snap = {x: cx, y: cy}; snappedObj = true; }
                                    let nx = pts[(i+2)%pts.length], ny = pts[(i+3)%pts.length];
                                    let proj = planner.getClosestPointOnSegment(pos, {x: cx, y: cy}, {x: nx, y: ny});
                                    if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < closestDist) { closestDist = Math.hypot(pos.x - proj.x, pos.y - proj.y); snap = proj; snappedObj = true; }
                                }
                            }
                        } else if (planner.tool !== 'roof') {
                            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
                            let d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y); let d2 = Math.hypot(pos.x - p2.x, pos.y - p2.y);
                            if (d1 < closestDist) { closestDist = d1; snap = p1; snappedObj = true; }
                            if (d2 < closestDist) { closestDist = d2; snap = p2; snappedObj = true; }
                            let proj = planner.getClosestPointOnSegment(pos, p1, p2); let dist = Math.hypot(pos.x - proj.x, pos.y - proj.y);
                            if (dist < closestDist) { closestDist = dist; snap = proj; snappedObj = true; }
                        }
                    }
                    if (!snappedObj) {
                        let a = planner.anchors.find(a => Math.hypot(a.x - pos.x, a.y - pos.y) < closestDist);
                        if (a) { snap = { x: a.x, y: a.y }; snappedObj = true; }
                    }
                }
                let isClosing = false;
                if (planner.drawingRoofPoints && planner.drawingRoofPoints.length > 2) {
                    const startP = planner.drawingRoofPoints[0];
                    if (Math.hypot(pos.x - startP.x, pos.y - startP.y) < SNAP_DIST) {
                        snap = { x: startP.x, y: startP.y };
                        snappedObj = true;
                        isClosing = true;
                    }
                }
                
                if (isClosing) {
                    if (!planner.roofCloseTick) {
                        planner.roofCloseTick = new Konva.Group({ visible: false });
                        planner.roofCloseTick.add(new Konva.Circle({ radius: 12, fill: '#10b981', stroke: 'white', strokeWidth: 2, shadowColor: 'black', shadowBlur: 4, shadowOpacity: 0.3 }));
                        planner.roofCloseTick.add(new Konva.Path({ data: 'M-4,1 L-1,4 L5,-3', stroke: 'white', strokeWidth: 2.5, lineCap: 'round', lineJoin: 'round' }));
                        planner.uiLayer.add(planner.roofCloseTick);
                    }
                    planner.roofCloseTick.position({ x: snap.x, y: snap.y });
                    planner.roofCloseTick.visible(true);
                    planner.roofCloseTick.moveToTop();
                    planner.hideSnapGlow();
                } else if (!planner.drawingRoofPoints && planner.currentSessionEntities && planner.currentSessionEntities.length > 0) {
                    // They closed the loop. Keep the tick mark visible!
                    if (planner.roofCloseTick) planner.roofCloseTick.visible(true);
                    planner.hideSnapGlow();
                } else {
                    if (planner.roofCloseTick) planner.roofCloseTick.visible(false);
                    if (snappedObj) { planner.showSnapGlow(snap.x, snap.y); } else { planner.hideSnapGlow(); }
                }

                if (planner.drawingRoofPoints && planner.roofPreview) {
                    const pts = planner.drawingRoofPoints.flatMap(p => [p.x, p.y]); pts.push(snap.x, snap.y);
                    planner.roofPreview.points(pts);
                }
                
                document.body.style.cursor = 'crosshair'; planner.mainLayer.batchDraw(); planner.uiLayer.batchDraw();
            } else {
                if (planner.drawingRoofPoints) { planner.drawingRoofPoints = null; if (planner.roofPreviewGroup) { planner.roofPreviewGroup.destroy(); planner.roofPreviewGroup = null; } else if (planner.roofPreview) { planner.roofPreview.destroy(); } planner.roofPreview = null; }
                if (planner.roofCloseTick) { planner.roofCloseTick.destroy(); planner.roofCloseTick = null; }
                if (document.body.style.cursor === 'crosshair') { document.body.style.cursor = 'default'; }
            }
        });
    
import Konva from 'konva';
import { WALL_REGISTRY, WIDGET_REGISTRY, MOLDING_REGISTRY, SNAP_DIST } from '../registry.js';
import { PRESET_REGISTRY } from './presetRegistry.js';
import { PremiumShape } from './PremiumShape.js';

/**
 * Handles core pointer events (mousedown, mousemove, mouseup) for the 2D Engine.
 * @param {Object} planner - The FloorPlanner instance.
 */
export function setupPointerEvents(planner) {
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
                
                let projPos = pos;
                let wallAngle = 0;
                
                if (closestWall) {
                    if (closestFace === 'front' && closestWall.frontHighlight) closestWall.frontHighlight.visible(true);
                    else if (closestWall.backHighlight) closestWall.backHighlight.visible(true);
                    
                    const start = closestWall.startAnchor.position();
                    const end = closestWall.endAnchor.position();
                    projPos = planner.getClosestPointOnSegment(pos, start, end);
                    wallAngle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
                }
                
                if (!planner.widgetPreview) {
                    planner.widgetPreview = new Konva.Group({
                        listening: false, visible: false
                    });
                    planner.uiLayer.add(planner.widgetPreview);
                }
                
                if (closestWall && (isWidget || isAdvancedOpening)) {
                    planner.widgetPreview.destroyChildren();
                    let fakeEntity = {
                        width: 40,
                        facing: 1,
                        side: 1,
                        wall: closestWall,
                        thick: closestWall.thickness || closestWall.config.thickness
                    };
                    
                    if (isAdvancedOpening) {
                        fakeEntity.width = 100;
                        planner.widgetPreview.add(new Konva.Rect({
                            width: 100, height: 10,
                            fill: 'rgba(59, 130, 246, 0.4)', stroke: '#2563eb', strokeWidth: 2,
                            offsetX: 50, offsetY: 5
                        }));
                    } else if (isWidget) {
                        if (WIDGET_REGISTRY[planner.tool].defaultConfig) {
                            Object.assign(fakeEntity, WIDGET_REGISTRY[planner.tool].defaultConfig);
                        }
                        if (planner.activePresetParams) {
                            Object.assign(fakeEntity, planner.activePresetParams);
                        }
                        // Render actual 2D widget
                        if (WIDGET_REGISTRY[planner.tool].render2D) {
                            WIDGET_REGISTRY[planner.tool].render2D(planner.widgetPreview, fakeEntity);
                            // Add a subtle transparent highlight over the real shape
                            planner.widgetPreview.add(new Konva.Rect({
                                width: fakeEntity.width, height: fakeEntity.thick + 4,
                                fill: 'rgba(59, 130, 246, 0.2)', stroke: '#2563eb', strokeWidth: 1,
                                offsetX: fakeEntity.width / 2, offsetY: (fakeEntity.thick + 4) / 2
                            }));
                        } else {
                            planner.widgetPreview.add(new Konva.Rect({
                                width: fakeEntity.width, height: 10,
                                fill: 'rgba(59, 130, 246, 0.4)', stroke: '#2563eb', strokeWidth: 2,
                                offsetX: fakeEntity.width / 2, offsetY: 5
                            }));
                        }
                    }
                    
                    planner.widgetPreview.position(projPos);
                    planner.widgetPreview.rotation(wallAngle);
                    planner.widgetPreview.visible(true);
                } else if (planner.widgetPreview && planner.widgetPreview.visible()) {
                    planner.widgetPreview.visible(false);
                }
                
                planner.mainLayer.batchDraw();
                planner.uiLayer.batchDraw();
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
                const alignData = autoAlign(planner, rawPos, planner.activePresetParams.elevation, planner.activePresetParams.depth);
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
                        const newShape = new PremiumShape(planner, 'shape_rect', { 
                            x: cx, y: cy, width: Math.abs(w), height: Math.abs(h)
                        });
                        if (!planner.shapes) planner.shapes = []; planner.shapes.push(newShape); planner.tool = 'select'; planner.updateToolStates(); if (planner.onToolChange) planner.onToolChange('select'); planner.selectEntity(newShape, 'shape');
                    }
                    planner.shapePreviewRect.visible(false);
                } else if (planner.drawingShapeType === 'shape_circle') {
                    const r = planner.shapePreviewCircle.radius();
                    if (r > 5) {
                        const newShape = new PremiumShape(planner, 'shape_circle', { x: planner.shapeStartPos.x, y: planner.shapeStartPos.y, radius: r });
                        if(!planner.shapes) planner.shapes = []; planner.shapes.push(newShape); planner.tool = 'select'; planner.updateToolStates(); if (planner.onToolChange) planner.onToolChange('select'); planner.selectEntity(newShape, 'shape');
                    }
                    planner.shapePreviewCircle.visible(false);
                }
                planner.drawingShapeType = null; planner.shapeStartPos = null; planner.hideInfoBadge(); planner.uiLayer.batchDraw(); planner.syncAll();
            }
        });

        // --- Hip Roof Drawing Mode Logic ---
}

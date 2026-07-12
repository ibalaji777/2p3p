
import { WALL_REGISTRY, MOLDING_REGISTRY, WIDGET_REGISTRY, SNAP_DIST } from '../registry.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { PremiumWall } from '../../features/wall/wall.renderer2d.js';
import Konva from 'konva';
import { PremiumStaircase } from '../../features/stairs/stairs.renderer2d.js';
import { PremiumShape } from './PremiumShape.js';
import { PremiumRailing } from './PremiumRailing.js';
import { PremiumHipRoof } from '../../features/roof/roof.renderer2d.js';

/**
 * Handles drawing-specific logic and complex placement algorithms.
 * @param {Object} planner - The FloorPlanner instance.
 */
export function setupDrawingEvents(planner) {

        planner._executePointerDownLogic = (e, pos, isTouch) => {
            let cmd = null;
            if (planner.commandManager) cmd = new SnapshotCommand(planner);
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
            const isMolding = planner.tool === 'molding' || !!MOLDING_REGISTRY[planner.tool];
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
                    if (isMolding) {
                        const moldType = planner.activePresetParams?.type || planner.tool;
                        targetWall.placeItemFromSnapping(moldType, targetFace, pos);
                    } else {
                        targetWall.placeItemFromSnapping(planner.tool, targetFace, pos);
                    }
                }
                return;
            }
            
            let targetPos = { x: planner.snap(pos.x), y: planner.snap(pos.y) };
            if (planner.tool === 'stair_v4_flight') {
                const rootId = 'stairv4_' + Math.random().toString(36).substr(2, 9);
                const flightData = { id: rootId, x: targetPos.x, y: targetPos.y };
                const flight = new StairV4Flight(planner, flightData);
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
                const landing = new StairV4Landing(planner, landingData);
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
                const landing = new StairV4Landing(planner, landingData);
                planner.stairs.push(landing);
                planner.tool = 'select';
                planner.updateToolStates();
                planner.selectEntity(landing, 'stair');
                planner.syncAll();
                return;
            }
            if (planner.tool === 'staircase' || planner.tool.startsWith('stair_v5_')) {
                const params = planner.tool === 'staircase' ? (planner.activePresetParams || { type: 'stair_v5_straight' }) : { type: planner.tool };
                const shape = params.type.split('stair_v5_')[1] || 'straight';
                const targetPos = getAlignedPointForObject(pos.x, pos.y);
                const stair = new PremiumStaircase(planner, shape, { x: targetPos.x, y: targetPos.y });
                
                if (planner.tool === 'staircase' && planner.activePresetParams) {
                    Object.assign(stair, planner.activePresetParams);
                }
                
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
                        if (planner.drawingTriangle.length === 3) { const newShape = new PremiumShape(planner, 'shape_triangle', { points: [...planner.drawingTriangle] }); if(!planner.shapes) planner.shapes = []; planner.shapes.push(newShape); planner.drawingTriangle = null; planner.shapePreviewTriangle.visible(false); planner.tool = 'select'; planner.updateToolStates(); if (planner.onToolChange) planner.onToolChange('select'); planner.selectEntity(newShape, 'shape'); if (planner.onDrawingChange) planner.onDrawingChange(false); planner.syncAll(); }
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
                                w = new PremiumRailing(planner, prev, curr);
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
                                w = new PremiumWall(planner, prev, curr, planner.tool);
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
                            const w = new PremiumRailing(planner, planner.lastAnchor, currentAnchor);
                            planner.walls.push(w);
                            planner.lastDrawnEntity = w;
                            planner.currentSessionEntities.push(w);
                        } else {
                            const w = new PremiumWall(planner, planner.lastAnchor, currentAnchor, planner.tool);
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
                        
                        const newShape = new PremiumShape(planner, 'shape_floor_cut', { 
                            x: cx, y: cy, width: w, height: h, points: relPts,
                            stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.2)'
                        });
                        if (!planner.shapes) planner.shapes = []; planner.shapes.push(newShape);
                        if (!planner.currentSessionEntities) planner.currentSessionEntities = [];
                        planner.currentSessionEntities.push(newShape);
                        planner.selectEntity(newShape, 'shape');
                    } else {
                        const roof = new PremiumHipRoof(planner, planner.drawingRoofPoints);
                        roof.config.roofType = planner.activePresetParams?.roofType || planner.currentRoofToolType || 'hip';
                        if (planner.activePresetParams) Object.assign(roof.config, planner.activePresetParams);
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
    
}

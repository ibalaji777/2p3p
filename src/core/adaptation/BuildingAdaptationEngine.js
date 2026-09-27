/**
 * src/core/adaptation/BuildingAdaptationEngine.js
 * 
 * Master Orchestrator for the Building Adaptation & Conversion System.
 * Adapts building layouts (with or without site boundary/setbacks) to target areas,
 * maintaining physical BIM invariants, structural connectivity, and 2D/3D in-place synchronization.
 */

import { SiteEngine } from '../site/SiteEngine.js';
import { SiteGeometryEngine } from '../site/SiteGeometryEngine.js';
import { WallEngine } from '../wall/WallEngine.js';
import { RoofEngine } from '../roof/RoofEngine.js';
import { ElevationFacadeEngine } from '../elevation/ElevationFacadeEngine.js';
import { DesignIntentAnalyzer } from './DesignIntentAnalyzer.js';
import { FootprintOptimizer } from './FootprintOptimizer.js';
import { RoomBudgetEngine } from './RoomBudgetEngine.js';
import { coreEventBus } from '../EventBus.js';
import { EVENTS } from '../constants/events.js';

export class BuildingAdaptationEngine {
    /**
     * Adapts the building on the planner to target area and/or buildable site envelope.
     * 
     * Supports:
     * - Workflow A: Building Only (no site)
     * - Workflow B: Site + Building
     * - Workflow C: Site + Optional Setbacks + Building
     * - Workflow D: Target Area + Site
     * 
     * @param {Object} planner - Canonical FloorPlanner instance
     * @param {Object} [options={}] - Adaptation options
     * @param {number} [options.targetAreaSqFt] - Target building area in sq ft (e.g. 870)
     * @param {boolean} [options.preserveAspectRatio=true] - Preserve building W/D aspect ratio
     * @param {boolean} [options.alignRoadFrontage=true] - Align front facade towards road frontage
     * @param {number} [options.safetyMarginCm=0] - Buffer distance inside buildable envelope
     * @param {boolean} [options.sync=true] - Trigger in-place 2D and 3D sync
     * @returns {Object} Result summary { success: boolean, status: 'exact'|'valid_approximation'|'impossible', error?: string, metrics?: Object, warnings?: string[], reasons?: string[] }
     */
    static adapt(planner, options = {}) {
        if (!planner) {
            return { success: false, status: 'impossible', error: 'No planner instance provided.' };
        }

        // 1. Obtain site and buildable envelope (OPTIONAL: Workflow A runs without a site)
        const site = SiteEngine.getSite(planner);
        let envelope = site ? SiteEngine.getBuildableEnvelope(planner) : null;
        let isCompoundEnvelope = false;

        if (!envelope) {
            // Check if closed compound boundary enclosure exists (Scenarios 2, 5, 7, 10, 15, 17)
            const compoundBoundary = DesignIntentAnalyzer.getCompoundBoundary(planner);
            if (compoundBoundary && compoundBoundary.polygon) {
                envelope = compoundBoundary.polygon;
                isCompoundEnvelope = true;
            }
        }

        const roadFrontageIndex = site?.roadFrontageIndex || 0;
        const roadFrontages = site?.roadFrontages || (site?.roadFrontageIndex !== undefined ? [site.roadFrontageIndex] : [0]);

        // 2. Analyze current building layout, footprint perimeter, and wall spans
        const analysis = DesignIntentAnalyzer.analyze(planner);
        if (!analysis || analysis.anchorCount === 0) {
            return { success: false, status: 'impossible', error: 'No building walls or anchors found to adapt.' };
        }

        const origBounds = analysis.bounds;
        if (origBounds.width <= 0 || origBounds.depth <= 0) {
            return { success: false, status: 'impossible', error: 'Invalid building dimensions.' };
        }

        const footprint = DesignIntentAnalyzer.getBuildingFootprint(planner);
        const spans = DesignIntentAnalyzer.analyzeSpans(planner);
        const currentBuildingAreaSqFt = (footprint && footprint.areaSqFt > 0) ? footprint.areaSqFt : origBounds.areaSqFt;

        // 3. Pre-flight Constraint Checks against Site
        if (envelope && options.targetAreaSqFt) {
            const envelopeAreaUnits2 = SiteGeometryEngine.getArea(envelope);
            const envelopeAreaSqFt = SiteGeometryEngine.units2ToSqFt(envelopeAreaUnits2);
            if (options.targetAreaSqFt > envelopeAreaSqFt + 5) {
                return {
                    success: false,
                    status: 'impossible',
                    error: `Requested building area (${options.targetAreaSqFt} sq ft) exceeds buildable site envelope (${Math.round(envelopeAreaSqFt)} sq ft).`,
                    reasons: [`Target area exceeds buildable envelope by ${Math.round(options.targetAreaSqFt - envelopeAreaSqFt)} sq ft.`]
                };
            }
        }

        // 4. Optimize footprint transformation (monotonic span redistribution, zero shearing)
        const optOptions = {
            targetAreaSqFt: options.targetAreaSqFt,
            preserveAspectRatio: options.preserveAspectRatio !== false,
            alignRoadFrontage: options.alignRoadFrontage !== false,
            roadFrontageIndex: roadFrontageIndex,
            roadFrontages: roadFrontages,
            placementMode: options.placementMode || (options.alignRoadFrontage ? 'road_frontage' : 'preserve_offset'),
            safetyMarginCm: Number(options.safetyMarginCm) || 0,
            plotVertices: site?.vertices || (isCompoundEnvelope ? envelope : null),
            spans,
            footprint
        };

        const optimization = FootprintOptimizer.optimize(origBounds, envelope, optOptions);
        if (!optimization) {
            return {
                success: false,
                status: 'impossible',
                error: 'Failed to calculate optimal transformation for the requested constraints.'
            };
        }

        const transformPoint = optimization.transformPoint;

        // 5. Pre-Commit Validation: Audit prospective candidate BEFORE mutating domain state
        const buildingWalls = (planner.walls && Array.isArray(planner.walls))
            ? planner.walls.filter(w => DesignIntentAnalyzer.isBuildingWall(w))
            : [];

        const roomAudit = RoomBudgetEngine.auditRoomDimensions(planner.rooms || [], transformPoint);
        const openingAudit = RoomBudgetEngine.auditOpenings(buildingWalls, transformPoint, 10);
        const stairAudit = RoomBudgetEngine.auditStairs(planner.stairs || [], planner.rooms || [], transformPoint);

        const warnings = [...roomAudit.warnings, ...openingAudit.warnings, ...stairAudit.warnings];

        if (envelope && footprint.points.length >= 3) {
            const candidateFootprint = footprint.points.map(p => transformPoint(p));
            const fitsInsideEnvelope = SiteGeometryEngine.isPolygonContained(candidateFootprint, envelope, 0.5);
            if (!fitsInsideEnvelope) {
                return {
                    success: false,
                    status: 'impossible',
                    error: 'Adapted building footprint does not fit within the site buildable envelope.',
                    reasons: ['Adapted building footprint boundary crosses or exceeds buildable setback envelope.']
                };
            }
        }

        // Verify stair footprint validity
        if (!stairAudit.valid && stairAudit.warnings.length > 0) {
            return {
                success: false,
                status: 'impossible',
                error: 'Target building area is too small to accommodate existing staircase configuration.',
                reasons: stairAudit.warnings
            };
        }

        // Determine result status
        let status = 'exact';
        if (options.targetAreaSqFt) {
            const diff = Math.abs(optimization.adaptedAreaSqFt - options.targetAreaSqFt);
            const tolerance = Math.max(5, options.targetAreaSqFt * 0.03); // 3% tolerance
            status = diff <= tolerance ? 'exact' : 'valid_approximation';
        }

        // 6. Cache spatial constraints relative to nearest walls for furniture, stairs, and shapes
        const objectConstraints = new Map();

        const cacheConstraint = (obj, pos, rotation, isStairPathNode = false) => {
            if (!pos) return;
            const constraint = { origPos: { ...pos }, origRot: rotation || 0, isStairPathNode };

            if (planner.walls && planner.walls.length > 0) {
                let minDist = Infinity;
                let bestWall = null;

                planner.walls.forEach(w => {
                    if (!w.startAnchor || !w.endAnchor) return;
                    const A = typeof w.startAnchor.position === 'function' ? w.startAnchor.position() : w.startAnchor;
                    const B = typeof w.endAnchor.position === 'function' ? w.endAnchor.position() : w.endAnchor;

                    const dx = B.x - A.x;
                    const dy = B.y - A.y;
                    const lenSq = dx * dx + dy * dy;

                    let t = 0;
                    if (lenSq !== 0) {
                        t = ((pos.x - A.x) * dx + (pos.y - A.y) * dy) / lenSq;
                        t = Math.max(0, Math.min(1, t));
                    }

                    const projX = A.x + t * dx;
                    const projY = A.y + t * dy;

                    const distSq = (pos.x - projX) ** 2 + (pos.y - projY) ** 2;
                    if (distSq < minDist) {
                        minDist = distSq;
                        const wallAngle = Math.atan2(dy, dx);
                        const len = Math.sqrt(lenSq);
                        const dirX = len > 0 ? dx / len : 0;
                        const dirY = len > 0 ? dy / len : 0;

                        const vX = pos.x - projX;
                        const vY = pos.y - projY;

                        // Local perpendicular distance
                        const localY = vX * (-dirY) + vY * dirX;
                        const relAngle = constraint.origRot - (wallAngle * 180 / Math.PI);

                        bestWall = {
                            wall: w,
                            t,
                            localY,
                            relAngle,
                            wallAngle: wallAngle * 180 / Math.PI
                        };
                    }
                });

                if (bestWall) {
                    constraint.nearestWall = bestWall;
                }
            }

            objectConstraints.set(obj, constraint);
        };

        if (planner.furniture && Array.isArray(planner.furniture)) {
            planner.furniture.forEach(f => {
                const pos = f.group && typeof f.group.position === 'function' 
                    ? f.group.position() 
                    : (f.x !== undefined ? { x: f.x, y: f.y } : null);
                const rot = f.rotation !== undefined 
                    ? f.rotation 
                    : (f.group && typeof f.group.rotation === 'function' ? f.group.rotation() : 0);
                cacheConstraint(f, pos, rot);
            });
        }

        if (planner.stairs && Array.isArray(planner.stairs)) {
            planner.stairs.forEach(s => {
                if (s.group && typeof s.group.position === 'function') {
                    const pos = s.group.position();
                    const rot = s.rotation !== undefined 
                        ? s.rotation 
                        : (typeof s.group.rotation === 'function' ? s.group.rotation() : 0);
                    cacheConstraint(s, pos, rot);
                } else if (s.path && Array.isArray(s.path)) {
                    s.path.forEach(p => {
                        cacheConstraint(p, p, 0, true);
                    });
                }
            });
        }

        if (planner.shapes && Array.isArray(planner.shapes)) {
            planner.shapes.forEach(sh => {
                if (sh.group && typeof sh.group.position === 'function') {
                    const pos = sh.group.position();
                    const rot = sh.rotation !== undefined 
                        ? sh.rotation 
                        : (typeof sh.group.rotation === 'function' ? sh.group.rotation() : 0);
                    cacheConstraint(sh, pos, rot);
                }
            });
        }

        const getLocalTransform = (origX, origY) => {
            const eps = 1.0;
            const p0 = transformPoint({ x: origX, y: origY });
            const px = transformPoint({ x: origX + eps, y: origY });
            const py = transformPoint({ x: origX, y: origY + eps });

            const J11 = (px.x - p0.x) / eps;
            const J21 = (px.y - p0.y) / eps;
            const J12 = (py.x - p0.x) / eps;
            const J22 = (py.y - p0.y) / eps;

            const angleRad = Math.atan2(J21 - J12, J11 + J22);
            const scaleX = Math.hypot(J11, J21);
            const scaleY = Math.hypot(J12, J22);

            return {
                pos: p0,
                angleDeg: angleRad * (180 / Math.PI),
                scaleX,
                scaleY,
                avgScale: (scaleX + scaleY) / 2
            };
        };

        const getRelocatedTransform = (obj, fallbackT) => {
            const constraint = objectConstraints.get(obj);
            if (!constraint || !constraint.nearestWall) return fallbackT;

            const nw = constraint.nearestWall;
            const w = nw.wall;
            if (!w.startAnchor || !w.endAnchor) return fallbackT;

            const A = typeof w.startAnchor.position === 'function' ? w.startAnchor.position() : w.startAnchor;
            const B = typeof w.endAnchor.position === 'function' ? w.endAnchor.position() : w.endAnchor;

            const dx = B.x - A.x;
            const dy = B.y - A.y;
            const len = Math.hypot(dx, dy);

            const dirX = len > 0 ? dx / len : 0;
            const dirY = len > 0 ? dy / len : 0;

            const projX = A.x + nw.t * dx;
            const projY = A.y + nw.t * dy;

            // Preserve offset from wall surface
            const scaledLocalY = nw.localY;
            const newX = projX + scaledLocalY * (-dirY);
            const newY = projY + scaledLocalY * dirX;

            const newWallAngle = Math.atan2(dy, dx) * 180 / Math.PI;
            const newRot = newWallAngle + nw.relAngle;
            const deltaRot = newWallAngle - nw.wallAngle;

            return {
                pos: { x: newX, y: newY },
                angleDeg: deltaRot,
                absAngle: newRot,
                scaleX: fallbackT.scaleX,
                scaleY: fallbackT.scaleY,
                avgScale: fallbackT.avgScale
            };
        };

        // 7. Execute Anchor Movements strictly through WallEngine (batch with sync deferred)
        // Strictly filter to building wall anchors (compound boundary wall anchors must remain 100% stationary)
        let targetAnchors = [];
        if (buildingWalls.length >= 3) {
            const bAnchorSet = new Set();
            buildingWalls.forEach(w => {
                if (w.startAnchor) bAnchorSet.add(w.startAnchor);
                if (w.endAnchor) bAnchorSet.add(w.endAnchor);
            });
            targetAnchors = Array.from(bAnchorSet);
        } else {
            // Anchor-only or incomplete wall mock test plans fallback
            targetAnchors = planner.anchors || [];
        }

        targetAnchors.forEach(anchor => {
            const currentPos = typeof anchor.position === 'function' ? anchor.position() : { x: anchor.x, y: anchor.y };
            const newPos = transformPoint(currentPos);
            WallEngine.moveAnchor(anchor, newPos, planner, false);
        });

        // 8. Adjust Arcs if present
        if (planner.arcs && Array.isArray(planner.arcs)) {
            planner.arcs.forEach(arc => {
                if (arc.pos) {
                    arc.pos = transformPoint(arc.pos);
                    if (arc.controlHandle && typeof arc.controlHandle.position === 'function') {
                        arc.controlHandle.position(arc.pos);
                    }
                }
            });
        }

        // 9. Update attached doors/windows $t$ parameters to prevent miter collision
        if (openingAudit.widgetAdjustments && openingAudit.widgetAdjustments.size > 0) {
            openingAudit.widgetAdjustments.forEach((adj, widget) => {
                widget.t = adj.t;
            });
        }

        // 10. Relocate Furniture locked to nearest wall orientation & offset
        if (planner.furniture && Array.isArray(planner.furniture)) {
            planner.furniture.forEach(f => {
                const constraint = objectConstraints.get(f);
                if (!constraint) return;

                const orig = constraint.origPos;
                const fallbackT = getLocalTransform(orig.x, orig.y);
                const t = getRelocatedTransform(f, fallbackT);

                if (f.group && typeof f.group.position === 'function') {
                    f.group.position(t.pos);
                }
                if (f.x !== undefined) f.x = t.pos.x;
                if (f.y !== undefined) f.y = t.pos.y;

                const currentRot = f.rotation !== undefined 
                    ? f.rotation 
                    : (f.group && typeof f.group.rotation === 'function' ? f.group.rotation() : 0);
                if (t.absAngle !== undefined) {
                    f.rotation = t.absAngle;
                } else {
                    f.rotation = currentRot + t.angleDeg;
                }
                if (f.group && typeof f.group.rotation === 'function') {
                    f.group.rotation(f.rotation);
                }

                if (typeof f.update === 'function') f.update();
            });
        }

        // 11. Relocate Staircases locked to nearest wall structure (preserving physical tread/flight width)
        if (planner.stairs && Array.isArray(planner.stairs)) {
            planner.stairs.forEach(s => {
                if (s.group && typeof s.group.position === 'function') {
                    const constraint = objectConstraints.get(s);
                    if (!constraint) return;

                    const orig = constraint.origPos;
                    const fallbackT = getLocalTransform(orig.x, orig.y);
                    const t = getRelocatedTransform(s, fallbackT);

                    s.group.position(t.pos);

                    const currentRot = s.rotation !== undefined 
                        ? s.rotation 
                        : (typeof s.group.rotation === 'function' ? s.group.rotation() : 0);
                    if (t.absAngle !== undefined) {
                        s.rotation = t.absAngle;
                    } else {
                        s.rotation = currentRot + t.angleDeg;
                    }
                    if (typeof s.group.rotation === 'function') {
                        s.group.rotation(s.rotation);
                    }

                    if (typeof s.update === 'function') s.update();
                } else if (s.path && Array.isArray(s.path)) {
                    s.path.forEach(p => {
                        const constraint = objectConstraints.get(p);
                        if (constraint) {
                            const orig = constraint.origPos;
                            const fallbackT = getLocalTransform(orig.x, orig.y);
                            const t = getRelocatedTransform(p, fallbackT);
                            p.x = t.pos.x;
                            p.y = t.pos.y;
                        } else {
                            const np = transformPoint(p);
                            p.x = np.x;
                            p.y = np.y;
                        }
                    });
                    if (typeof s.initHandles === 'function') s.initHandles();
                    if (typeof s.update === 'function') s.update();
                }
            });
        }

        // 12. Update Platforms if present
        if (planner.platforms && Array.isArray(planner.platforms)) {
            planner.platforms.forEach(plat => {
                if (plat.points && Array.isArray(plat.points)) {
                    plat.points = plat.points.map(pt => transformPoint(pt));
                    if (typeof plat.update === 'function') plat.update();
                }
            });
        }

        // 13. Update Balconies structural points if present
        if (planner.balconies && Array.isArray(planner.balconies)) {
            planner.balconies.forEach(b => {
                if (b.vertices && Array.isArray(b.vertices)) {
                    b.vertices.forEach(v => {
                        const np = transformPoint(v);
                        v.x = np.x;
                        v.y = np.y;
                    });
                }
                if (typeof b.update === 'function') b.update();
            });
        }

        // 14. Update Shapes if present
        if (planner.shapes && Array.isArray(planner.shapes)) {
            planner.shapes.forEach(s => {
                const constraint = objectConstraints.get(s);
                if (!constraint) return;

                const orig = constraint.origPos;
                const fallbackT = getLocalTransform(orig.x, orig.y);
                const t = getRelocatedTransform(s, fallbackT);

                if (s.group && typeof s.group.position === 'function') {
                    s.group.position(t.pos);
                }
                if (t.absAngle !== undefined) {
                    s.rotation = t.absAngle;
                } else {
                    s.rotation = (s.rotation !== undefined ? s.rotation : (s.group && typeof s.group.rotation === 'function' ? s.group.rotation() : 0)) + t.angleDeg;
                }
                if (s.group && typeof s.group.rotation === 'function') {
                    s.group.rotation(s.rotation);
                }
                if (typeof s.update === 'function') s.update();
            });
        }

        // 15. Update Roofs through authoritative RoofEngine
        if (planner.roofs && Array.isArray(planner.roofs)) {
            planner.roofs.forEach(roof => {
                if (roof.points && Array.isArray(roof.points)) {
                    const newPoints = roof.points.map(pt => transformPoint(pt));
                    RoofEngine.setPoints(roof, newPoints, planner);
                }
            });
        }

        // 16. Update Elevation Segments if present
        if (planner.elevationSegments && Array.isArray(planner.elevationSegments)) {
            planner.elevationSegments.forEach(seg => {
                if (seg.points && Array.isArray(seg.points)) {
                    seg.points = seg.points.map(pt => transformPoint(pt));
                }
                if (seg.nodes && Array.isArray(seg.nodes)) {
                    seg.nodes.forEach(node => {
                        if (node.pos) {
                            const np = transformPoint(node.pos);
                            node.pos.x = np.x;
                            node.pos.y = np.y;
                        }
                    });
                }
            });
        }

        // 17. Finalize Wall Polygons & Attached Widgets
        if (planner.walls && Array.isArray(planner.walls)) {
            planner.walls.forEach(w => {
                if (w.attachedWidgets && Array.isArray(w.attachedWidgets)) {
                    w.attachedWidgets.forEach(widget => {
                        if (typeof widget.update === 'function') widget.update();
                    });
                }
                if (typeof w.update === 'function') {
                    w.update();
                } else if (w.poly && typeof w.poly.update === 'function') {
                    w.poly.update();
                }

                // Re-sync elevation segments attached to wall
                ElevationFacadeEngine.syncSegmentsWithWall(w, planner);
            });
        }

        if (planner.arcs && Array.isArray(planner.arcs)) {
            planner.arcs.forEach(a => {
                if (typeof a.rebuild === 'function') a.rebuild();
            });
        }

        // 18. Re-detect rooms so planner.rooms reflect adapted layout
        if (typeof planner.detectRooms === 'function') {
            planner.detectRooms();
        }

        // 19. In-Place 2D & 3D Synchronization
        if (options.sync !== false) {
            this.sync(planner);
        }

        return {
            success: true,
            status,
            originalBounds: origBounds,
            adaptedBounds: optimization.adaptedBounds,
            metrics: {
                originalAreaSqFt: Math.round(currentBuildingAreaSqFt * 10) / 10,
                adaptedAreaSqFt: optimization.adaptedAreaSqFt,
                envelopeAreaSqFt: optimization.envelopeAreaSqFt,
                targetAreaSqFt: options.targetAreaSqFt || null,
                scaleX: Math.round(optimization.scaleX * 1000) / 1000,
                scaleY: Math.round(optimization.scaleY * 1000) / 1000
            },
            warnings
        };
    }

    /**
     * Executes in-place CAD redraw and graph update without full-scene canvas wipes.
     * @param {Object} planner 
     */
    static sync(planner) {
        if (!planner) return;

        if (typeof planner.syncAll === 'function') {
            planner.syncAll();
        }

        if (typeof planner.update3D === 'function') {
            planner.update3D({ requiresFullRebuild: true, source: 'building_adaptation' });
        }

        coreEventBus.emit(EVENTS.SCENE_CHANGED, { source: 'building_adaptation', requiresFullRebuild: true });

        if (typeof planner.requestDraw === 'function') {
            planner.requestDraw();
        } else if (planner.mainLayer && typeof planner.mainLayer.batchDraw === 'function') {
            planner.mainLayer.batchDraw();
        }
    }
}

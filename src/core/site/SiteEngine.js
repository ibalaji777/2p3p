/**
 * src/core/site/SiteEngine.js
 * 
 * Central Domain Façade for Site Boundaries, Setbacks, and Buildable Envelopes.
 * Sole authority for mutating site parameters and evaluating property envelope constraints.
 */

import { SiteGeometryEngine } from './SiteGeometryEngine.js';
import { SiteSerializer } from './SiteSerializer.js';
import { coreEventBus } from '../EventBus.js';
import { EVENTS } from '../constants/events.js';

export class SiteEngine {
    /**
     * Initializes or updates an authoritative site boundary on the planner.
     * 
     * @param {Object} planner - Canonical FloorPlanner instance
     * @param {Array<{x: number, y: number}>} vertices - 4 plot vertices in cm
     * @param {Object} [options={}] - Optional configuration
     * @param {Object} [options.setbacks={ front: 300, rear: 150, left: 150, right: 150 }] - Setback distances in cm
     * @param {number} [options.orientation=0] - North orientation angle in degrees
     * @param {number} [options.roadFrontageIndex=0] - Index of edge facing primary access road (0 = edge V0->V1)
     * @param {string} [options.unit='ft'] - Display unit preference ('ft' | 'm')
     * @param {boolean} [options.sync=true] - Trigger 2D redraw and sync
     * @returns {Object|null} The canonical site instance or null if validation fails
     */
    static createSite(planner, vertices, options = {}) {
        if (!planner) return null;

        if (vertices.length === 4) {
            const validation = SiteGeometryEngine.validateQuadrilateral(vertices);
            if (!validation.valid) {
                console.warn(`[SiteEngine] Invalid plot vertices: ${validation.error}`);
                return null;
            }
        } else if (!vertices || vertices.length < 3) {
            console.warn('[SiteEngine] Plot boundary must have at least 3 vertices.');
            return null;
        }

        let setbacks = null;
        if (options.setbacks === null || options.setbacks === false) {
            setbacks = null;
        } else if (options.setbacks !== undefined) {
            setbacks = {
                front: options.setbacks.front !== undefined && options.setbacks.front !== null ? Math.max(0, Number(options.setbacks.front)) : 0,
                rear: options.setbacks.rear !== undefined && options.setbacks.rear !== null ? Math.max(0, Number(options.setbacks.rear)) : 0,
                left: options.setbacks.left !== undefined && options.setbacks.left !== null ? Math.max(0, Number(options.setbacks.left)) : 0,
                right: options.setbacks.right !== undefined && options.setbacks.right !== null ? Math.max(0, Number(options.setbacks.right)) : 0
            };
        } else {
            // Default when setbacks property is not specified in options
            setbacks = {
                front: 200,
                rear: 100,
                left: 100,
                right: 100
            };
        }

        const roadFrontages = Array.isArray(options.roadFrontages)
            ? options.roadFrontages.map(Number)
            : (options.roadFrontageIndex !== undefined ? [Number(options.roadFrontageIndex) || 0] : [0]);

        const site = {
            id: options.id || 'site_boundary',
            vertices: [...vertices],
            setbacks,
            orientation: Number(options.orientation) || 0,
            roadFrontageIndex: (options.roadFrontageIndex !== undefined && options.roadFrontageIndex !== null) ? Number(options.roadFrontageIndex) : (roadFrontages[0] !== undefined ? roadFrontages[0] : 0),
            roadFrontages,
            unit: options.unit || planner.currentUnit || 'ft',
            name: options.name || 'Plot Boundary',
            visible: options.visible !== false
        };

        planner.site = site;

        if (options.sync !== false) {
            this.sync(planner);
        }

        return site;
    }

    /**
     * Returns the active site object on the planner.
     * @param {Object} planner 
     * @returns {Object|null}
     */
    static getSite(planner) {
        return planner?.site || null;
    }

    /**
     * Updates the plot vertices.
     * @param {Object} planner 
     * @param {Array<{x: number, y: number}>} vertices 
     * @param {Object} [options={ sync: true }] 
     * @returns {boolean}
     */
    static setPlotVertices(planner, vertices, options = {}) {
        if (!planner || !planner.site) {
            return Boolean(this.createSite(planner, vertices, options));
        }

        if (vertices.length === 4) {
            const validation = SiteGeometryEngine.validateQuadrilateral(vertices);
            if (!validation.valid) {
                console.warn(`[SiteEngine] setPlotVertices rejected: ${validation.error}`);
                return false;
            }
        } else if (!vertices || vertices.length < 3) {
            console.warn('[SiteEngine] setPlotVertices rejected: at least 3 vertices required.');
            return false;
        }

        planner.site.vertices = [...vertices];

        if (options.sync !== false) {
            this.sync(planner);
        }
        return true;
    }

    /**
     * Updates individual setback distances.
     * @param {Object} planner 
     * @param {{ front?: number, rear?: number, left?: number, right?: number }|null} setbacks 
     * @param {Object} [options={ sync: true }] 
     */
    static setSetbacks(planner, setbacks = {}, options = {}) {
        if (!planner || !planner.site) return;

        if (setbacks === null) {
            planner.site.setbacks = null;
        } else {
            if (!planner.site.setbacks) {
                planner.site.setbacks = { front: 0, rear: 0, left: 0, right: 0 };
            }
            if (setbacks.front !== undefined && setbacks.front !== null) planner.site.setbacks.front = Math.max(0, Number(setbacks.front));
            if (setbacks.rear !== undefined && setbacks.rear !== null) planner.site.setbacks.rear = Math.max(0, Number(setbacks.rear));
            if (setbacks.left !== undefined && setbacks.left !== null) planner.site.setbacks.left = Math.max(0, Number(setbacks.left));
            if (setbacks.right !== undefined && setbacks.right !== null) planner.site.setbacks.right = Math.max(0, Number(setbacks.right));
        }

        if (options.sync !== false) {
            this.sync(planner);
        }
    }

    /**
     * Updates site orientation angle and road frontage edge index.
     * @param {Object} planner 
     * @param {number} orientationDegrees 
     * @param {number} [roadFrontageIndex=0] 
     * @param {Object} [options={ sync: true }] 
     */
    static setOrientation(planner, orientationDegrees, roadFrontageIndex = 0, options = {}) {
        if (!planner || !planner.site) return;

        planner.site.orientation = ((Number(orientationDegrees) % 360) + 360) % 360;
        const rIdx = Math.max(0, Math.min(3, Math.floor(Number(roadFrontageIndex) || 0)));
        planner.site.roadFrontageIndex = rIdx;
        if (!planner.site.roadFrontages || planner.site.roadFrontages.length <= 1) {
            planner.site.roadFrontages = [rIdx];
        }

        if (options.sync !== false) {
            this.sync(planner);
        }
    }

    /**
     * Updates road frontage edge indices (for multi-road frontage / corner plots).
     * @param {Object} planner 
     * @param {Array<number>|number} roadFrontages 
     * @param {Object} [options={ sync: true }] 
     */
    static setRoadFrontages(planner, roadFrontages, options = {}) {
        if (!planner || !planner.site) return;

        const frontages = Array.isArray(roadFrontages) 
            ? roadFrontages.map(Number) 
            : [Number(roadFrontages) || 0];

        planner.site.roadFrontages = frontages;
        planner.site.roadFrontageIndex = frontages[0] || 0;

        if (options.sync !== false) {
            this.sync(planner);
        }
    }

    /**
     * Calculates the derived buildable envelope polygon inset from the plot edges.
     * If no setbacks are configured (setbacks === null), returns the site boundary vertices.
     * @param {Object} planner 
     * @returns {Array<{x: number, y: number}>|null}
     */
    static getBuildableEnvelope(planner) {
        const site = this.getSite(planner);
        if (!site || !site.vertices || site.vertices.length < 3) return null;

        const roadFrontages = Array.isArray(site.roadFrontages)
            ? site.roadFrontages
            : [site.roadFrontageIndex !== undefined ? site.roadFrontageIndex : 0];

        return SiteGeometryEngine.computeBuildableEnvelope(site.vertices, site.setbacks, roadFrontages);
    }

    /**
     * Gathers all calculated architectural site metrics.
     * @param {Object} planner 
     * @returns {Object|null}
     */
    static getMetrics(planner) {
        const site = this.getSite(planner);
        if (!site || !site.vertices || site.vertices.length < 3) return null;

        const pts = site.vertices;
        const totalAreaUnits2 = SiteGeometryEngine.getArea(pts);
        const totalAreaSqFt = SiteGeometryEngine.units2ToSqFt(totalAreaUnits2);

        const envelope = this.getBuildableEnvelope(planner);
        const buildableAreaUnits2 = envelope ? SiteGeometryEngine.getArea(envelope) : 0;
        const buildableAreaSqFt = envelope ? SiteGeometryEngine.units2ToSqFt(buildableAreaUnits2) : 0;

        const edgeLengths = SiteGeometryEngine.getEdgeLengths(pts);
        const cornerAngles = SiteGeometryEngine.getCornerAngles(pts);

        // Building coverage metrics
        let buildingAreaSqFt = 0;
        if (planner.rooms && Array.isArray(planner.rooms) && planner.rooms.length > 0) {
            planner.rooms.forEach(r => {
                if (r.path && r.path.length >= 3 && !r.isDeleted && !r.isHidden) {
                    let a = 0;
                    for (let i = 0; i < r.path.length; i++) {
                        const p1 = r.path[i];
                        const p2 = r.path[(i + 1) % r.path.length];
                        a += (p1.x * p2.y - p2.x * p1.y);
                    }
                    buildingAreaSqFt += SiteGeometryEngine.units2ToSqFt(Math.abs(a / 2));
                }
            });
        }

        // Fallback for Wall-Only plans: compute bounding footprint from walls & anchors
        if (buildingAreaSqFt <= 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            if (planner.walls && Array.isArray(planner.walls) && planner.walls.length > 0) {
                planner.walls.forEach(w => {
                    if (w.hidden) return;
                    const p1 = (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position() : (w.startAnchor || { x: w.startX, y: w.startY });
                    const p2 = (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position() : (w.endAnchor || { x: w.endX, y: w.endY });
                    if (p1 && typeof p1.x === 'number' && typeof p1.y === 'number') {
                        minX = Math.min(minX, p1.x); maxX = Math.max(maxX, p1.x);
                        minY = Math.min(minY, p1.y); maxY = Math.max(maxY, p1.y);
                    }
                    if (p2 && typeof p2.x === 'number' && typeof p2.y === 'number') {
                        minX = Math.min(minX, p2.x); maxX = Math.max(maxX, p2.x);
                        minY = Math.min(minY, p2.y); maxY = Math.max(maxY, p2.y);
                    }
                });
            } else if (planner.anchors && Array.isArray(planner.anchors) && planner.anchors.length > 0) {
                planner.anchors.forEach(a => {
                    const pos = typeof a.position === 'function' ? a.position() : a;
                    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                        minX = Math.min(minX, pos.x); maxX = Math.max(maxX, pos.x);
                        minY = Math.min(minY, pos.y); maxY = Math.max(maxY, pos.y);
                    }
                });
            }

            if (minX !== Infinity && maxX !== -Infinity && maxX > minX && maxY > minY) {
                const wallAreaUnits2 = (maxX - minX) * (maxY - minY);
                buildingAreaSqFt = SiteGeometryEngine.units2ToSqFt(wallAreaUnits2);
            }
        }

        const coverageRatio = totalAreaSqFt > 0 ? (buildingAreaSqFt / totalAreaSqFt) : 0;

        return {
            totalAreaUnits2: Math.round(totalAreaUnits2),
            totalAreaCm2: Math.round(SiteGeometryEngine.sqFtToCm2(totalAreaSqFt)),
            totalAreaSqFt: Math.round(totalAreaSqFt * 10) / 10,
            buildableAreaUnits2: Math.round(buildableAreaUnits2),
            buildableAreaCm2: Math.round(SiteGeometryEngine.sqFtToCm2(buildableAreaSqFt)),
            buildableAreaSqFt: Math.round(buildableAreaSqFt * 10) / 10,
            buildingAreaSqFt: Math.round(buildingAreaSqFt * 10) / 10,
            coveragePercentage: Math.round(coverageRatio * 1000) / 10,
            edgeLengths: edgeLengths.map(l => Math.round(l * 10) / 10),
            cornerAngles: cornerAngles,
            hasEnvelope: Boolean(envelope),
            orientation: site.orientation,
            roadFrontageIndex: site.roadFrontageIndex
        };
    }

    /**
     * Checks if a point lies within the outer plot boundary.
     * @param {Object} planner 
     * @param {{x: number, y: number}} pt 
     * @returns {boolean}
     */
    static isInsidePlot(planner, pt) {
        const site = this.getSite(planner);
        if (!site || !site.vertices) return true;
        return SiteGeometryEngine.isPointInsidePolygon(pt, site.vertices);
    }

    /**
     * Checks if a point lies within the buildable envelope.
     * @param {Object} planner 
     * @param {{x: number, y: number}} pt 
     * @returns {boolean}
     */
    static isInsideBuildableEnvelope(planner, pt) {
        const envelope = this.getBuildableEnvelope(planner);
        if (!envelope) return false;
        return SiteGeometryEngine.isPointInsidePolygon(pt, envelope);
    }

    /**
     * Clears the site boundary from the planner.
     * @param {Object} planner 
     */
    static clearSite(planner) {
        if (!planner) return;
        planner.site = null;
        this.sync(planner);
    }

    /**
     * Triggers 2D redraw and updates any registered site renderer.
     * @param {Object} planner 
     */
    static sync(planner) {
        if (!planner) return;
        if (typeof planner.syncSite2D === 'function') {
            planner.syncSite2D();
        }
        if (typeof planner.update3D === 'function') {
            planner.update3D({ requiresFullRebuild: true, source: 'site' });
        }
        coreEventBus.emit(EVENTS.SCENE_CHANGED, { source: 'site', requiresFullRebuild: true });
        if (typeof planner.requestDraw === 'function') {
            planner.requestDraw();
        } else if (planner.mainLayer && typeof planner.mainLayer.batchDraw === 'function') {
            planner.mainLayer.batchDraw();
        }
    }

    /**
     * Serializes site to Schema v2.0 clean JSON.
     * @param {Object} site 
     * @returns {Object|null}
     */
    static serialize(site) {
        return SiteSerializer.serialize(site);
    }

    /**
     * Deserializes site into planner context.
     * @param {Object} planner 
     * @param {Object} data 
     * @returns {Object|null}
     */
    static deserialize(planner, data) {
        return SiteSerializer.deserialize(planner, data);
    }
}

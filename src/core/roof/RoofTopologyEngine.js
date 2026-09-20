/**
 * RoofTopologyEngine.js
 * 
 * Manages Roof Entity Lifecycle, Topology, and Planner Graph registration:
 * - Canonical creation of roof entities
 * - Normalization and point validation
 * - Destruction and cascading cleanup (auto-gables, 2D Konva, 3D meshes)
 * - Spatial queries (point-in-roof detection)
 */

import { RoofGeometryEngine } from './RoofGeometryEngine.js';
import { PremiumHipRoof } from '../../features/roof/roof.renderer2d.js';
import { WallEngine } from '../wall/WallEngine.js';
import { RoofMutationEngine } from './RoofMutationEngine.js';

export class RoofTopologyEngine {
    /**
     * Cleans and validates a points array for roof geometry.
     * @param {Array<{x: number, y: number}>} points 
     * @returns {Array<{x: number, y: number}>}
     */
    static cleanPoints(points) {
        return RoofGeometryEngine.cleanPoints(points);
    }

    /**
     * Canonical factory to instantiate a new roof entity.
     * @param {Object} planner - The 2D planner context
     * @param {Array<{x: number, y: number}>} points - Polygon points
     * @param {Object} [config={}] - Roof configuration options
     * @param {Object} [options={}] - Options (id, elevation, rotation, addToPlanner, select)
     * @returns {Object|null} The created roof entity
     */
    static createRoof(planner, points, config = {}, options = {}) {
        const cleaned = this.cleanPoints(points);
        if (cleaned.length < 3) return null;

        const baseWallHeight = (planner && planner.walls && planner.walls.length > 0)
            ? Math.max(...planner.walls.map(w => w.height !== undefined ? w.height : (w.config?.height || 120)))
            : 120;

        const defaultRoofType = config.roofType || 'gable';
        const defaultMaterial = config.material || (defaultRoofType === 'flat' ? 'white_gravel_roof' : 'terracotta_tiles_roof');

        const mergedConfig = {
            pitch: 30,
            overhang: 8,
            thickness: 10,
            ridgeOffset: 0,
            roofType: defaultRoofType,
            material: defaultMaterial,
            wallGap: 0,
            ridgeAxis: RoofGeometryEngine.getEffectiveRidgeAxis(cleaned, config.ridgeAxis, config.manualRidge),
            manualRidge: !!config.manualRidge,
            gableMaterial: 'white_plaster_wall',
            autoShapeWalls: true,
            skylights: [],
            crestings: [],
            finials: [],
            chimneys: [],
            ...config
        };

        const roof = new PremiumHipRoof(planner, cleaned);
        if (options.id) roof.id = options.id;
        roof.rotation = options.rotation !== undefined ? options.rotation : 0;
        const wallsTop = (planner && planner.walls && planner.walls.length > 0)
            ? RoofGeometryEngine.getMaxWallTopUnderRoof(roof, planner.walls)
            : 0;
        const initialElev = options.elevation !== undefined ? options.elevation : (wallsTop > 0 ? wallsTop : baseWallHeight);
        roof.elevation = initialElev;
        roof._lastSyncedWallTop = wallsTop > 0 ? wallsTop : initialElev;
        roof._restingOnWalls = (options.elevation === undefined) || (wallsTop > 0 && Math.abs(options.elevation - wallsTop) < 2);
        roof.config = mergedConfig;
        roof.configId = mergedConfig.material;
        if (options.description !== undefined) roof.description = options.description;
        if (mergedConfig.tileSize !== undefined) roof.tileSize = mergedConfig.tileSize;

        if (options.x !== undefined && options.y !== undefined && roof.group && typeof roof.group.position === 'function') {
            roof.group.position({ x: options.x, y: options.y });
        }

        if (roof.update) roof.update();

        if (options.addToPlanner !== false && planner) {
            if (!planner.roofs) planner.roofs = [];
            if (!planner.roofs.includes(roof)) {
                planner.roofs.push(roof);
            }
        }

        if (options.select && planner && typeof planner.selectEntity === 'function') {
            planner.selectEntity(roof, 'roof');
        }

        return roof;
    }

    /**
     * Duplicates an existing roof entity with deep structural cloning and an offset.
     * @param {Object} planner 
     * @param {Object|string} roofOrId 
     * @param {{x: number, y: number}} [offset={x: 30, y: 30}] 
     * @returns {Object|null}
     */
    static duplicateRoof(planner, roofOrId, offset = { x: 30, y: 30 }) {
        if (!planner) return null;
        const roof = (typeof roofOrId === 'string')
            ? (planner.roofs && planner.roofs.find(r => r.id === roofOrId))
            : roofOrId;
        if (!roof || !roof.points || !Array.isArray(roof.points)) return null;

        const ox = offset?.x !== undefined ? offset.x : 30;
        const oy = offset?.y !== undefined ? offset.y : 30;

        // Deep clone points
        const clonedPoints = roof.points.map(p => ({ x: p.x, y: p.y }));

        // Deep clone config
        const origConf = roof.config || {};
        const clonedConfig = {
            ...origConf,
            pitch: origConf.pitch !== undefined ? origConf.pitch : 30,
            curve: origConf.curve || 0,
            overhang: origConf.overhang !== undefined ? origConf.overhang : 8,
            overhangs: origConf.overhangs ? [...origConf.overhangs] : undefined,
            thickness: origConf.thickness !== undefined ? origConf.thickness : 10,
            ridgeOffset: origConf.ridgeOffset || 0,
            roofType: origConf.roofType || 'hip',
            material: origConf.material || 'dark_asphalt_roof',
            wallGap: origConf.wallGap || 0,
            ridgeAxis: origConf.ridgeAxis || 'x',
            manualRidge: !!origConf.manualRidge,
            gableMaterial: origConf.gableMaterial || 'white_plaster_wall',
            fasciaMaterial: origConf.fasciaMaterial,
            autoShapeWalls: !!origConf.autoShapeWalls,
            flipSlope: !!origConf.flipSlope,
            autoPlacementMode: origConf.autoPlacementMode || 'manual',
            slopes: origConf.slopes ? JSON.parse(JSON.stringify(origConf.slopes)) : undefined,
            skylights: origConf.skylights ? origConf.skylights.map(s => ({
                ...JSON.parse(JSON.stringify(s)),
                id: `sky_${Date.now()}_${Math.floor(Math.random() * 1000)}`
            })) : [],
            crestings: origConf.crestings ? origConf.crestings.map(c => ({
                ...JSON.parse(JSON.stringify(c)),
                id: `crest_${Date.now()}_${Math.floor(Math.random() * 1000)}`
            })) : [],
            finials: origConf.finials ? origConf.finials.map(f => ({
                ...JSON.parse(JSON.stringify(f)),
                id: `finial_${Date.now()}_${Math.floor(Math.random() * 1000)}`
            })) : [],
            chimneys: origConf.chimneys ? origConf.chimneys.map(ch => ({
                ...JSON.parse(JSON.stringify(ch)),
                id: `chimney_${Date.now()}_${Math.floor(Math.random() * 1000)}`
            })) : []
        };

        const gx = roof.group && typeof roof.group.x === 'function' ? roof.group.x() : (roof.x || 0);
        const gy = roof.group && typeof roof.group.y === 'function' ? roof.group.y() : (roof.y || 0);

        const newId = `roof_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        const newRoof = this.createRoof(planner, clonedPoints, clonedConfig, {
            id: newId,
            x: gx + ox,
            y: gy + oy,
            elevation: roof.elevation !== undefined ? roof.elevation : 120,
            rotation: roof.rotation || 0,
            description: roof.description ? `${roof.description} (Copy)` : undefined,
            addToPlanner: true,
            select: true
        });

        if (newRoof) {
            if (roof.tileSize !== undefined) newRoof.tileSize = roof.tileSize;
            if (roof.configId) newRoof.configId = roof.configId;
            
            RoofMutationEngine.notifyRoofUpdated(newRoof, planner, 'create');
        }

        return newRoof;
    }

    /**
     * Completely removes a roof and cascades cleanup to auto-gable walls,
     * parent preset groups, 2D Konva display groups, and 3D meshes.
     * @param {Object} planner 
     * @param {Object} roof 
     * @returns {boolean}
     */
    static deleteRoof(planner, roof) {
        if (!roof) return false;

        // 1. Remove from parent preset group if attached
        if (roof.parentGroup && roof.parentGroup.roofs) {
            roof.parentGroup.roofs = roof.parentGroup.roofs.filter(r => r !== roof);
        }

        // 2. Remove from planner.roofs
        if (planner && planner.roofs) {
            planner.roofs = planner.roofs.filter(r => r !== roof);
        }

        // 3. Cascade cleanup of auto-gable walls generated for this roof
        if (planner && planner.walls) {
            const autoGables = planner.walls.filter(w => w.isAutoGable && w.parentRoofId === roof.id);
            autoGables.forEach(w => {
                WallEngine.deleteWall(planner, w);
            });
        }

        // 4. Remove 2D Konva group
        if (roof.group && typeof roof.group.destroy === 'function') {
            roof.group.destroy();
        }

        // 5. Remove 3D mesh & thoroughly dispose GPU resources
        if (roof.mesh3D) {
            if (typeof roof.mesh3D.traverse === 'function') {
                roof.mesh3D.traverse(child => {
                    if (child.geometry && typeof child.geometry.dispose === 'function') {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => {
                                if (m?.map?.dispose) m.map.dispose();
                                if (m?.dispose) m.dispose();
                            });
                        } else {
                            if (child.material.map?.dispose) child.material.map.dispose();
                            if (child.material.dispose) child.material.dispose();
                        }
                    }
                });
            }
            if (roof.mesh3D.parent) {
                roof.mesh3D.parent.remove(roof.mesh3D);
            }
        }

        // 6. Detach active 3D gizmos and clear 3D selection
        const ctx = planner?.ctx || planner?.envBuilder?.ctx;
        if (ctx) {
            const interactions = ctx.interactions;
            if (interactions) {
                if (interactions.roofPitchGizmo?.target?.userData?.entity === roof) {
                    if (typeof interactions.roofPitchGizmo.detach === 'function') interactions.roofPitchGizmo.detach();
                    else interactions.roofPitchGizmo.visible = false;
                }
                if (interactions.roofCornerGizmo?.target?.userData?.entity === roof) {
                    if (typeof interactions.roofCornerGizmo.detach === 'function') interactions.roofCornerGizmo.detach();
                    else interactions.roofCornerGizmo.visible = false;
                }
                if (interactions.roofOverhangGizmo?.target?.userData?.entity === roof) {
                    if (typeof interactions.roofOverhangGizmo.detach === 'function') interactions.roofOverhangGizmo.detach();
                    else interactions.roofOverhangGizmo.visible = false;
                }
                if (interactions.selectedObject?.userData?.entity === roof || interactions.selectedObject === roof.mesh3D) {
                    interactions.selectedObject = null;
                }
            }
            if (typeof ctx.requestRender === 'function') {
                ctx.requestRender();
            }
        }

        // 7. Clear 2D selection if selected
        if (planner && planner.selectedEntity === roof) {
            if (typeof planner.selectEntity === 'function') planner.selectEntity(null);
        }

        if (planner && typeof planner.syncAll === 'function') {
            planner.syncAll();
        }

        return true;
    }

    /**
     * Checks if a 2D world point lies inside a roof's footprint polygon.
     * @param {Object} roof 
     * @param {number} x 
     * @param {number} y 
     * @returns {boolean}
     */
    static isPointInsideRoof(roof, x, y) {
        if (!roof || !roof.points || roof.points.length < 3) return false;
        const gx = roof.group ? roof.group.x() : (roof.x || 0);
        const gy = roof.group ? roof.group.y() : (roof.y || 0);
        const pts = roof.points.map(p => ({ x: p.x + gx, y: p.y + gy }));

        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x, yi = pts[i].y;
            const xj = pts[j].x, yj = pts[j].y;
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
}

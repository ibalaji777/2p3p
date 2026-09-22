/**
 * RoofMutationEngine.js
 * 
 * Centralized Mutation Authority for Roofs:
 * - Single source of truth for all property modifications
 * - History and undo/redo recording
 * - 2D Konva and 3D in-place synchronization
 * - Safe auto-gable wall synchronization via WallEngine
 */

import { RoofGeometryEngine } from './RoofGeometryEngine.js';
import { WallEngine } from '../wall/WallEngine.js';

export class RoofMutationEngine {
    /**
     * Centralized notification for any roof state change.
     * Updates 2D display, 3D live mesh in place, and debounces history snapshot.
     * @param {Object} roof 
     * @param {Object} [plannerOrCtx] 
     * @param {string} [aspect='geometry'] - 'geometry' | 'material' | 'structure'
     */
    static notifyRoofUpdated(roof, plannerOrCtx, aspect = 'geometry') {
        if (!roof) return;

        // Resolve 2D planner and 3D engine context robustly
        let planner = null;
        let ctx3d = null;

        if (plannerOrCtx) {
            if (plannerOrCtx.camera || (plannerOrCtx.scene && plannerOrCtx.renderer)) {
                // Passed an Engine3D instance
                ctx3d = plannerOrCtx;
                planner = plannerOrCtx.planner || roof.planner;
            } else {
                // Passed a 2D planner (or mock planner)
                planner = plannerOrCtx;
                ctx3d = plannerOrCtx.engine3d || plannerOrCtx.ctx || (plannerOrCtx.envBuilder ? plannerOrCtx : null);
            }
        }

        if (!planner && roof.planner) {
            planner = roof.planner;
        }

        // Global fallbacks if running in browser and unresolved
        if (typeof window !== 'undefined') {
            if (!planner) {
                planner = window.plannerInstance || window.planner?.value || window.planner;
            }
            if (!ctx3d) {
                ctx3d = planner?.engine3d || window.engine3d || window.renderer3D?.value || window.preview3D;
            }
        }

        // 1. Sync auto-gables if active
        const walls = planner?.walls || ctx3d?.walls;
        if (roof.config?.autoShapeWalls && walls) {
            this.syncGableWalls(roof, planner || { walls });
        }

        // 2. Update 2D representation
        if (typeof roof.update === 'function') {
            roof.update();
        }

        // 3. Update 3D live mesh in place
        const env = ctx3d?.envBuilder || planner?.envBuilder || planner?.ctx?.envBuilder;
        if (env && typeof env.updateRoofLive === 'function') {
            env.updateRoofLive(roof);
        } else if (ctx3d && typeof ctx3d.updateRoofLive === 'function') {
            ctx3d.updateRoofLive(roof);
        } else if (planner?.ctx && typeof planner.ctx.updateRoofLive === 'function') {
            planner.ctx.updateRoofLive(roof);
        }

        // 4. Batch redraw 2D
        if (planner?.stage && typeof planner.stage.batchDraw === 'function') {
            planner.stage.batchDraw();
        }

        // 5. Request 3D frame render
        if (ctx3d && typeof ctx3d.requestRender === 'function') {
            ctx3d.requestRender();
        } else if (env?.ctx && typeof env.ctx.requestRender === 'function') {
            env.ctx.requestRender();
        } else if (planner?.ctx && typeof planner.ctx.requestRender === 'function') {
            planner.ctx.requestRender();
        }

        // 6. Debounced history save
        if (planner && typeof planner.debouncedSaveHistory === 'function') {
            planner.debouncedSaveHistory();
        }
    }

    /**
     * Sets the slope pitch in degrees.
     * @param {Object} roof 
     * @param {number} pitch [0..88]
     * @param {Object} [planner]
     */
    static setPitch(roof, pitch, planner = null) {
        if (!roof) return;
        roof.config = roof.config || {};
        roof.config.pitch = Math.max(0, Math.min(88, Number(pitch) || 0));
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets the peak height in cm, recalculating the pitch degrees.
     * @param {Object} roof 
     * @param {number} peakHeight 
     * @param {Object} [planner] 
     */
    static setPeakHeight(roof, peakHeight, planner = null) {
        if (!roof) return;
        const newPitch = RoofGeometryEngine.getPitchFromHeight(roof, peakHeight);
        this.setPitch(roof, newPitch, planner);
    }

    /**
     * Sets the roof overhangs (master or per-edge).
     * @param {Object} roof 
     * @param {number} overhang 
     * @param {number|null} [edgeIndex=null] 
     * @param {Object} [planner] 
     */
    static setOverhang(roof, overhang, edgeIndex = null, planner = null) {
        if (!roof) return;
        if (edgeIndex !== null && typeof edgeIndex === 'object') {
            planner = edgeIndex;
            edgeIndex = null;
        }
        roof.config = roof.config || {};
        const val = Math.max(0, Math.min(500, Number(overhang) || 0));
        const numEdges = roof.points?.length || 4;

        if (!roof.config.overhangs || !Array.isArray(roof.config.overhangs) || roof.config.overhangs.length !== numEdges) {
            roof.config.overhangs = Array(numEdges).fill(roof.config.overhang !== undefined ? roof.config.overhang : 8);
        }

        if (edgeIndex === null || edgeIndex === undefined) {
            roof.config.overhang = val;
            roof.config.overhangs.fill(val);
        } else {
            roof.config.overhangs[edgeIndex] = val;
        }

        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets per-edge overhang depths array.
     * @param {Object} roof 
     * @param {Array<number>} overhangsArray 
     * @param {Object} [planner] 
     */
    static setOverhangs(roof, overhangsArray, planner = null) {
        if (!roof || !Array.isArray(overhangsArray)) return;
        roof.config = roof.config || {};
        const numEdges = roof.points?.length || 4;
        roof.config.overhangs = overhangsArray.slice(0, numEdges).map(v => Math.max(0, Math.min(500, Number(v) || 0)));
        while (roof.config.overhangs.length < numEdges) {
            roof.config.overhangs.push(roof.config.overhang !== undefined ? roof.config.overhang : 8);
        }
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets the roof type ('gable', 'hip', 'shed', 'flat', 'mansard', 'gambrel', etc.).
     * @param {Object} roof 
     * @param {string} roofType 
     * @param {Object} [planner] 
     */
    static setRoofType(roof, roofType, planner = null) {
        if (!roof || !roofType) return;
        roof.config = roof.config || {};
        roof.config.roofType = roofType;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'structure');
    }

    /**
     * Updates the polygon footprint vertices.
     * @param {Object} roof 
     * @param {Array<{x: number, y: number}>} points 
     * @param {Object} [planner] 
     */
    static setPoints(roof, points, planner = null) {
        if (!roof || !points || points.length < 3) return;
        roof.points = RoofGeometryEngine.cleanPoints(points);
        if (typeof roof.updateGeometry === 'function') {
            roof.updateGeometry();
        }
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets roof 2D group position.
     * @param {Object} roof 
     * @param {number} x 
     * @param {number} y 
     * @param {Object} [planner] 
     */
    static setPosition(roof, x, y, planner = null) {
        if (!roof) return;
        roof.x = Number(x) || 0;
        roof.y = Number(y) || 0;
        if (roof.group && typeof roof.group.position === 'function') {
            roof.group.position({ x: roof.x, y: roof.y });
        }
        this.notifyRoofUpdated(roof, planner || roof.planner, 'transform');
    }

    /**
     * Sets roof rotation in degrees.
     * @param {Object} roof 
     * @param {number} angleDeg 
     * @param {Object} [planner] 
     */
    static setRotation(roof, angleDeg, planner = null) {
        if (!roof) return;
        const rot = ((Math.round(angleDeg) % 360) + 360) % 360;
        roof.rotation = rot;
        if (roof.group && typeof roof.group.rotation === 'function') {
            roof.group.rotation(rot);
        }
        this.notifyRoofUpdated(roof, planner || roof.planner, 'transform');
    }

    /**
     * Sets base elevation of the roof above floor level.
     * @param {Object} roof 
     * @param {number} elevation 
     * @param {Object} [planner] 
     * @param {Object} [options={}]
     */
    static setElevation(roof, elevation, planner = null, options = {}) {
        if (!roof) return;
        roof.elevation = Number(elevation) || 0;
        if (!options.fromWallSync) {
            roof._restingOnWalls = false;
        }
        this.notifyRoofUpdated(roof, planner || roof.planner, 'transform');
    }

    /**
     * Sets roof thickness in cm.
     * @param {Object} roof 
     * @param {number} thickness 
     * @param {Object} [planner] 
     */
    static setThickness(roof, thickness, planner = null) {
        if (!roof) return;
        roof.config = roof.config || {};
        roof.config.thickness = Math.max(1, Number(thickness) || 10);
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets ridge axis ('x' | 'y') and marks whether it was manually forced by user.
     * @param {Object} roof 
     * @param {'x' | 'y'} axis 
     * @param {Object} [planner] 
     * @param {boolean} [isManual=true] 
     */
    static setRidgeAxis(roof, axis, planner = null, isManual = true) {
        if (!roof || (axis !== 'x' && axis !== 'y')) return;
        roof.config = roof.config || {};
        roof.config.ridgeAxis = axis;
        if (isManual) roof.config.manualRidge = true;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets slope curvature (-50 to +50 for pagoda / convex).
     * @param {Object} roof 
     * @param {number} curve 
     * @param {Object} [planner] 
     */
    static setCurve(roof, curve, planner = null) {
        if (!roof) return;
        roof.config = roof.config || {};
        roof.config.curve = Math.max(-80, Math.min(80, Number(curve) || 0));
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets vertical wall gap / soffit offset.
     * @param {Object} roof 
     * @param {number} wallGap 
     * @param {Object} [planner] 
     */
    static setWallGap(roof, wallGap, planner = null) {
        if (!roof) return;
        roof.config = roof.config || {};
        roof.config.wallGap = Number(wallGap) || 0;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets corner fillet curvature radius (cm) for modern curved portal/wrap roof.
     * 0 = sharp 90-degree corner, >0 = smooth circular arc fillet.
     * @param {Object} roof 
     * @param {number} radius 
     * @param {number|null} [cornerIndex=null] 
     * @param {Object} [planner] 
     */
    static setCornerRadius(roof, radius, cornerIndex = null, planner = null) {
        if (!roof) return;
        if (cornerIndex !== null && typeof cornerIndex === 'object') {
            planner = cornerIndex;
            cornerIndex = null;
        }
        roof.config = roof.config || {};
        const val = Math.max(0, Math.min(250, Number(radius) || 0));
        const numCorners = roof.points?.length || 4;

        if (!roof.config.cornerRadii || !Array.isArray(roof.config.cornerRadii) || roof.config.cornerRadii.length !== numCorners) {
            roof.config.cornerRadii = Array(numCorners).fill(roof.config.radius !== undefined ? roof.config.radius : 0);
        }

        if (cornerIndex === null || cornerIndex === undefined) {
            roof.config.radius = val;
            roof.radius = val;
            roof.config.cornerRadii.fill(val);
        } else {
            roof.config.cornerRadii[cornerIndex] = val;
        }
        roof.cornerRadii = [...roof.config.cornerRadii];

        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets per-corner fillet curvature radii array [r0, r1, r2, r3, ...] (cm).
     * @param {Object} roof 
     * @param {Array<number>} radiiArray 
     * @param {Object} [planner] 
     */
    static setCornerRadii(roof, radiiArray, planner = null) {
        if (!roof || !Array.isArray(radiiArray)) return;
        roof.config = roof.config || {};
        const numCorners = roof.points?.length || 4;
        roof.config.cornerRadii = radiiArray.slice(0, numCorners).map(r => Math.max(0, Math.min(250, Number(r) || 0)));
        while (roof.config.cornerRadii.length < numCorners) {
            roof.config.cornerRadii.push(roof.config.radius !== undefined ? roof.config.radius : 0);
        }
        roof.cornerRadii = [...roof.config.cornerRadii];
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Toggles a specific wall side (left, right, front, back) for curved portal/wrap roof.
     * @param {Object} roof 
     * @param {'left'|'right'|'front'|'back'} side 
     * @param {boolean} enabled 
     * @param {Object} [planner] 
     */
    static setWallSide(roof, side, enabled, planner = null) {
        if (!roof || !side) return;
        roof.config = roof.config || {};
        roof.config.wallSides = roof.config.wallSides ? { ...roof.config.wallSides } : { left: true, right: true, front: false, back: false };
        roof.config.wallSides[side] = Boolean(enabled);
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets all wall sides simultaneously (e.g. for presets like Cantilever, Portal, Box Frame).
     * @param {Object} roof 
     * @param {{ left?: boolean, right?: boolean, front?: boolean, back?: boolean }} sidesObj 
     * @param {Object} [planner] 
     */
    static setWallSides(roof, sidesObj, planner = null) {
        if (!roof || !sidesObj) return;
        roof.config = roof.config || {};
        roof.config.wallSides = {
            ...(roof.config.wallSides || { left: true, right: true, front: false, back: false }),
            ...sidesObj
        };
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets downward wall drop height in cm (or 0 for floor-level drop).
     * @param {Object} roof 
     * @param {number} height 
     * @param {Object} [planner] 
     */
    static setWallDropHeight(roof, height, planner = null) {
        if (!roof) return;
        roof.config = roof.config || {};
        roof.config.wallDropHeight = Math.max(0, Number(height) || 0);
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Toggles under-soffit recessed LED spotlights (downlights).
     * @param {Object} roof 
     * @param {boolean} enabled 
     * @param {Object} [planner] 
     */
    static setSpotlights(roof, enabled, planner = null) {
        if (!roof) return;
        roof.config = roof.config || {};
        roof.config.hasSpotlights = Boolean(enabled);
        this.notifyRoofUpdated(roof, planner || roof.planner, 'structure');
    }

    /**
     * Sets material texture assignment.
     * Supports Sims 4-style scope ('single' vs 'all') and per-slope slots.
     * @param {Object} roof 
     * @param {string} materialKey 
     * @param {'single'|'all'|'fascia'|'gable'} [scope='single'] 
     * @param {string|null} [slopeKey=null] 
     * @param {Object} [planner] 
     */
    static setMaterial(roof, materialKey, scope = 'single', slopeKey = null, planner = null) {
        if (!roof || !materialKey) return;
        const p = planner || roof.planner;

        const applyToRoof = (r) => {
            r.config = r.config || {};
            if (slopeKey === 'fascia' || scope === 'fascia') {
                r.config.fasciaMaterial = materialKey;
            } else if (slopeKey === 'gable' || scope === 'gable') {
                r.config.gableMaterial = materialKey;
            } else if (slopeKey) {
                r.config.slopes = r.config.slopes || {};
                r.config.slopes[slopeKey] = materialKey;
            } else {
                r.config.material = materialKey;
                r.configId = materialKey;
                if (r.config.slopes) delete r.config.slopes;
            }
            this.notifyRoofUpdated(r, p, 'material');
        };

        if (scope === 'all' && p && p.roofs) {
            p.roofs.forEach(r => applyToRoof(r));
        } else {
            applyToRoof(roof);
        }
    }

    /**
     * Toggles auto-shaping of walls into gable ends under this roof.
     * @param {Object} roof 
     * @param {boolean} enabled 
     * @param {Object} [planner] 
     */
    static setAutoShapeWalls(roof, enabled, planner = null) {
        if (!roof) return;
        roof.config = roof.config || {};
        roof.config.autoShapeWalls = Boolean(enabled);
        roof.config.showGableWalls = Boolean(enabled);
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Adds an aperture skylight to the roof slope.
     * @param {Object} roof 
     * @param {Object} skylightParams 
     * @param {Object} [planner] 
     * @returns {Object} Created skylight entry
     */
    static addSkylight(roof, skylightParams = {}, planner = null) {
        if (!roof) return null;
        roof.config = roof.config || {};
        if (!Array.isArray(roof.config.skylights)) roof.config.skylights = [];

        const newSkylight = {
            id: skylightParams.id || `sky_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            type: skylightParams.type || 'skylight_flush_flat',
            material: skylightParams.material || 'glass_roof_square_grid',
            frameMaterial: skylightParams.frameMaterial || 'metal_dark_steel',
            width: skylightParams.width || 120,
            length: skylightParams.length || 180,
            depth: skylightParams.depth || 10,
            u: skylightParams.u !== undefined ? skylightParams.u : 0.5,
            v: skylightParams.v !== undefined ? skylightParams.v : 0.5,
            coverage: skylightParams.coverage || 'custom'
        };

        roof.config.skylights.push(newSkylight);
        roof.skylights = roof.config.skylights;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'plugins');
        return newSkylight;
    }

    /**
     * Removes a skylight by id or index.
     * @param {Object} roof 
     * @param {string|number} idOrIndex 
     * @param {Object} [planner] 
     */
    static removeSkylight(roof, idOrIndex, planner = null) {
        if (!roof || !roof.config?.skylights) return;
        if (typeof idOrIndex === 'number') {
            roof.config.skylights.splice(idOrIndex, 1);
        } else if (typeof idOrIndex === 'object' && idOrIndex !== null) {
            roof.config.skylights = roof.config.skylights.filter(s => s !== idOrIndex && s.id !== idOrIndex.id);
        } else {
            roof.config.skylights = roof.config.skylights.filter(s => s.id !== idOrIndex);
        }
        roof.skylights = roof.config.skylights;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'plugins');
    }

    /**
     * Adds ridge cresting to the roof.
     * @param {Object} roof 
     * @param {Object} params 
     * @param {Object} [planner] 
     */
    static addCresting(roof, params = {}, planner = null) {
        if (!roof) return;
        roof.config = roof.config || {};
        if (!Array.isArray(roof.config.crestings)) roof.config.crestings = [];
        const entry = {
            id: params.id || `crest_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            type: params.type || 'ridge_cresting_victorian_lace',
            material: params.material || 'metal_wrought_iron',
            height: params.height || 25
        };
        roof.config.crestings.push(entry);
        roof.crestings = roof.config.crestings;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'plugins');
        return entry;
    }

    /**
     * Removes ridge cresting by id or index.
     */
    static removeCresting(roof, idOrIndex, planner = null) {
        if (!roof || !roof.config?.crestings) return;
        if (typeof idOrIndex === 'number') {
            roof.config.crestings.splice(idOrIndex, 1);
        } else if (typeof idOrIndex === 'object' && idOrIndex !== null) {
            roof.config.crestings = roof.config.crestings.filter(c => c !== idOrIndex && c.id !== idOrIndex.id);
        } else {
            roof.config.crestings = roof.config.crestings.filter(c => c.id !== idOrIndex);
        }
        roof.crestings = roof.config.crestings;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'plugins');
    }

    /**
     * Adds an apex finial.
     */
    static addFinial(roof, params = {}, planner = null) {
        if (!roof) return;
        roof.config = roof.config || {};
        if (!Array.isArray(roof.config.finials)) roof.config.finials = [];
        const entry = {
            id: params.id || `finial_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            type: params.type || 'finial_victorian_spire',
            material: params.material || 'metal_wrought_iron',
            apexLocation: params.apexLocation || 'both',
            scale: params.scale || 1.0
        };
        roof.config.finials.push(entry);
        roof.finials = roof.config.finials;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'plugins');
        return entry;
    }

    /**
     * Removes an apex finial.
     */
    static removeFinial(roof, idOrIndex, planner = null) {
        if (!roof || !roof.config?.finials) return;
        if (typeof idOrIndex === 'number') {
            roof.config.finials.splice(idOrIndex, 1);
        } else if (typeof idOrIndex === 'object' && idOrIndex !== null) {
            roof.config.finials = roof.config.finials.filter(f => f !== idOrIndex && f.id !== idOrIndex.id);
        } else {
            roof.config.finials = roof.config.finials.filter(f => f.id !== idOrIndex);
        }
        roof.finials = roof.config.finials;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'plugins');
    }

    /**
     * Adds a chimney stack.
     */
    static addChimney(roof, params = {}, planner = null) {
        if (!roof) return;
        roof.config = roof.config || {};
        if (!Array.isArray(roof.config.chimneys)) roof.config.chimneys = [];
        const entry = {
            id: params.id || `chimney_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            type: params.type || 'chimney_brick_traditional',
            material: params.material || 'red_brick',
            width: params.width || 60,
            depth: params.depth || 60,
            height: params.height || 120,
            u: params.u !== undefined ? params.u : 0.7,
            v: params.v !== undefined ? params.v : 0.3
        };
        roof.config.chimneys.push(entry);
        roof.chimneys = roof.config.chimneys;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'plugins');
        return entry;
    }

    /**
     * Removes a chimney stack.
     */
    static removeChimney(roof, idOrIndex, planner = null) {
        if (!roof || !roof.config?.chimneys) return;
        if (typeof idOrIndex === 'number') {
            roof.config.chimneys.splice(idOrIndex, 1);
        } else if (typeof idOrIndex === 'object' && idOrIndex !== null) {
            roof.config.chimneys = roof.config.chimneys.filter(c => c !== idOrIndex && c.id !== idOrIndex.id);
        } else {
            roof.config.chimneys = roof.config.chimneys.filter(c => c.id !== idOrIndex);
        }
        roof.chimneys = roof.config.chimneys;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'plugins');
    }

    /**
     * Synchronizes gable walls underneath this roof strictly routing through WallEngine.
     * @param {Object} roof 
     * @param {Object} planner 
     */
    static syncGableWalls(roof, planner) {
        if (!planner || !planner.walls) return;

        if (!roof.config?.autoShapeWalls || roof.config?.roofType !== 'gable') {
            const toDelete = planner.walls.filter(w => w.isAutoGable && w.parentRoofId === roof.id);
            toDelete.forEach(w => {
                try {
                    WallEngine.deleteWall(planner, w);
                } catch (e) {
                    console.warn('[RoofMutationEngine] Failed to delete auto-gable wall:', e);
                }
            });
            return;
        }

        const gx = (roof.group && typeof roof.group.x === 'function') ? roof.group.x() : (roof.x || 0);
        const gy = (roof.group && typeof roof.group.y === 'function') ? roof.group.y() : (roof.y || 0);
        const bounds = RoofGeometryEngine.getBounds(roof.points, { x: gx, y: gy });
        const roofH = RoofGeometryEngine.getPeakHeight(roof);

        planner.walls.forEach(w => {
            if (w.isAutoGable || w.parentRoofId) return;

            const p1 = (w.startAnchor && typeof w.startAnchor.position === 'function')
                ? w.startAnchor.position()
                : (w.startAnchor || { x: w.startX || 0, y: w.startY || 0 });
            const p2 = (w.endAnchor && typeof w.endAnchor.position === 'function')
                ? w.endAnchor.position()
                : (w.endAnchor || { x: w.endX || 0, y: w.endY || 0 });

            const cx = (p1.x + p2.x) / 2;
            const cy = (p1.y + p2.y) / 2;

            if (cx >= bounds.minX - 20 && cx <= bounds.maxX + 20 && cy >= bounds.minY - 20 && cy <= bounds.maxY + 20) {
                const wDx = Math.abs(p2.x - p1.x);
                const wDy = Math.abs(p2.y - p1.y);

                const isGable = (roof.config.ridgeAxis === 'y') ? (wDx > wDy) : (wDy > wDx);
                let isOuter = false;
                if (isGable) {
                    if (roof.config.ridgeAxis === 'y') {
                        isOuter = Math.abs(cy - bounds.minY) < 20 || Math.abs(cy - bounds.maxY) < 20;
                    } else {
                        isOuter = Math.abs(cx - bounds.minX) < 20 || Math.abs(cx - bounds.maxX) < 20;
                    }
                }

                if (isGable && isOuter) {
                    let gableWall = planner.walls.find(cw => cw.isAutoGable && cw.parentWallId === w.id && cw.parentRoofId === roof.id);
                    const baseHeight = w.height !== undefined ? w.height : (w.config?.height || 180);
                    const elevation = (w.elevation || 0) + baseHeight;
                    const thickness = w.thickness !== undefined ? w.thickness : (w.config?.thickness || 16);
                    const gMat = roof.config?.gableMaterial || 'white_plaster_wall';

                    if (!gableWall) {
                        gableWall = WallEngine.createWall(planner, {
                            startAnchor: w.startAnchor,
                            endAnchor: w.endAnchor,
                            type: w.type || 'outer',
                            thickness: thickness,
                            height: 0,
                            elevation: elevation,
                            topProfileType: 'gable',
                            startHeight: 0,
                            endHeight: 0,
                            peakHeight: roofH,
                            isAutoGable: true,
                            parentWallId: w.id,
                            parentRoofId: roof.id,
                            params: {
                                texture: gMat,
                                textureFront: gMat,
                                textureBack: gMat
                            },
                            addToPlanner: true
                        });
                        if (gableWall) {
                            gableWall.isAutoGable = true;
                            gableWall.parentWallId = w.id;
                            gableWall.parentRoofId = roof.id;
                            gableWall.description = "Auto Gable Wall";
                            if (gableWall.wallGroup) gableWall.wallGroup.visible(false);
                            if (gableWall.labelGroup) gableWall.labelGroup.visible(false);
                        }
                    } else {
                        WallEngine.setElevation(gableWall, elevation, false, planner);
                        WallEngine.setThickness(gableWall, thickness, false, planner);
                        WallEngine.setHeight(gableWall, 0, false, planner);
                        WallEngine.setTopProfile(gableWall, 'gable', {
                            startHeight: 0,
                            endHeight: 0,
                            peakHeight: roofH
                        }, false, planner);

                        // Sync gable material if changed
                        if (gableWall.params?.textureFront !== gMat || gableWall.params?.texture !== gMat) {
                            WallEngine.applyMaterial(gableWall, {
                                target: 'all',
                                key: gMat,
                                ctx: planner?.engine3d || (typeof window !== 'undefined' ? window.engine3d : null)
                            }, planner);
                        }
                    }
                    if (gableWall && typeof gableWall.updateGeometry === 'function') {
                        gableWall.updateGeometry();
                    }
                } else {
                    const gableWall = planner.walls.find(cw => cw.isAutoGable && cw.parentWallId === w.id && cw.parentRoofId === roof.id);
                    if (gableWall) {
                        WallEngine.deleteWall(planner, gableWall);
                    }
                }
            }
        });
    }

    /**
     * Sets flip slope for shed roof orientation.
     * @param {Object} roof 
     * @param {boolean} flipSlope 
     * @param {Object} [planner] 
     */
    static setFlipSlope(roof, flipSlope, planner = null) {
        if (!roof) return;
        roof.config = roof.config || {};
        roof.config.flipSlope = Boolean(flipSlope);
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets automatic wall boundary placement mode ('inner' | 'center' | 'outer' | 'manual').
     * @param {Object} roof 
     * @param {string} mode 
     * @param {Object} [planner] 
     */
    static setAutoPlacementMode(roof, mode, planner = null) {
        if (!roof) return;
        if (mode !== 'inner' && mode !== 'center' && mode !== 'outer' && mode !== 'manual') return;
        roof.config = roof.config || {};
        roof.config.autoPlacementMode = mode;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'geometry');
    }

    /**
     * Sets texture repeat tile size for procedural materials.
     * @param {Object} roof 
     * @param {number} tileSize 
     * @param {Object} [planner] 
     */
    static setTileSize(roof, tileSize, planner = null) {
        if (!roof) return;
        const size = Math.max(10, Math.min(1000, Number(tileSize) || 100));
        roof.tileSize = size;
        if (roof.config) roof.config.tileSize = size;
        this.notifyRoofUpdated(roof, planner || roof.planner, 'material');
    }

    /**
     * Updates an attached roof addon (skylight, chimney, cresting, or finial) parameters.
     * @param {Object} roof 
     * @param {string} addonType - 'skylight' | 'cresting' | 'finial' | 'chimney'
     * @param {string|number|Object} idOrIndex 
     * @param {Object} params 
     * @param {Object} [planner] 
     * @returns {boolean}
     */
    static updateAddon(roof, addonType, idOrIndex, params = {}, planner = null) {
        if (!roof || !addonType || !params) return false;
        roof.config = roof.config || {};
        
        let key = '';
        if (addonType.startsWith('skylight') || addonType === 'skylights') key = 'skylights';
        else if (addonType.startsWith('cresting') || addonType === 'crestings' || addonType === 'ridge_cresting') key = 'crestings';
        else if (addonType.startsWith('finial') || addonType === 'finials') key = 'finials';
        else if (addonType.startsWith('chimney') || addonType === 'chimneys') key = 'chimneys';
        else key = addonType;

        if (!Array.isArray(roof.config[key])) roof.config[key] = [];
        const list = roof.config[key];

        let target = null;
        if (typeof idOrIndex === 'number') {
            target = list[idOrIndex];
        } else if (typeof idOrIndex === 'object' && idOrIndex !== null) {
            target = list.find(item => item === idOrIndex || (item.id && item.id === idOrIndex.id));
        } else {
            target = list.find(item => item.id === idOrIndex);
        }

        if (!target) return false;

        // Domain validation & parameter merging
        for (const [k, v] of Object.entries(params)) {
            if (v === undefined) continue;
            if (k === 'width' || k === 'depth' || k === 'height' || k === 'length') {
                target[k] = Math.max(5, Number(v) || target[k] || 10);
            } else if (k === 'u' || k === 'v') {
                target[k] = Math.max(0.01, Math.min(0.99, Number(v)));
            } else {
                target[k] = v;
            }
        }

        this.notifyRoofUpdated(roof, planner || roof.planner, 'plugins');
        return true;
    }

    /**
     * Atomically validates and applies multiple property updates with a single synchronization cycle.
     * @param {Object} roof 
     * @param {Object} updates 
     * @param {Object} [planner] 
     */
    static batchUpdate(roof, updates = {}, planner = null) {
        if (!roof || typeof updates !== 'object') return;
        roof.config = roof.config || {};

        let changedAspect = 'geometry';

        for (const [key, val] of Object.entries(updates)) {
            if (val === undefined) continue;
            if (key === 'pitch') {
                roof.config.pitch = Math.max(0, Math.min(88, Number(val) || 0));
            } else if (key === 'peakHeight') {
                const newPitch = RoofGeometryEngine.getPitchFromHeight(roof, val);
                roof.config.pitch = newPitch;
            } else if (key === 'curve') {
                roof.config.curve = Math.max(-80, Math.min(80, Number(val) || 0));
            } else if (key === 'overhang') {
                const o = Math.max(0, Math.min(500, Number(val) || 0));
                roof.config.overhang = o;
                if (roof.config.overhangs && Array.isArray(roof.config.overhangs)) {
                    roof.config.overhangs.fill(o);
                }
            } else if (key === 'overhangs' && Array.isArray(val)) {
                roof.config.overhangs = [...val];
            } else if (key === 'thickness') {
                roof.config.thickness = Math.max(1, Number(val) || 10);
            } else if (key === 'wallGap') {
                roof.config.wallGap = Number(val) || 0;
            } else if (key === 'roofType') {
                roof.config.roofType = val;
                changedAspect = 'structure';
            } else if (key === 'ridgeAxis' && (val === 'x' || val === 'y')) {
                roof.config.ridgeAxis = val;
                roof.config.manualRidge = true;
            } else if (key === 'flipSlope') {
                roof.config.flipSlope = Boolean(val);
            } else if (key === 'autoShapeWalls') {
                roof.config.autoShapeWalls = Boolean(val);
            } else if (key === 'autoPlacementMode') {
                roof.config.autoPlacementMode = val;
            } else if (key === 'cornerRadii' && Array.isArray(val)) {
                roof.config.cornerRadii = [...val];
                roof.cornerRadii = [...val];
            } else if (key === 'radius') {
                const r = Math.max(0, Math.min(250, Number(val) || 0));
                roof.config.radius = r;
                roof.radius = r;
                if (roof.config.cornerRadii && Array.isArray(roof.config.cornerRadii)) {
                    roof.config.cornerRadii.fill(r);
                }
            } else if (key === 'elevation') {
                roof.elevation = Number(val) || 0;
            } else if (key === 'rotation') {
                const rot = ((Math.round(val) % 360) + 360) % 360;
                roof.rotation = rot;
                if (roof.group && typeof roof.group.rotation === 'function') roof.group.rotation(rot);
            } else if (key === 'material') {
                roof.config.material = val;
                roof.configId = val;
            } else if (key === 'gableMaterial') {
                roof.config.gableMaterial = val;
            } else if (key === 'fasciaMaterial') {
                roof.config.fasciaMaterial = val;
            } else if (key === 'slopes') {
                roof.config.slopes = val ? JSON.parse(JSON.stringify(val)) : undefined;
                changedAspect = 'material';
            } else if (key === 'tileSize') {
                const size = Math.max(10, Math.min(1000, Number(val) || 100));
                roof.tileSize = size;
                roof.config.tileSize = size;
                changedAspect = 'material';
            }
        }

        this.notifyRoofUpdated(roof, planner || roof.planner, changedAspect);
    }

    /**
     * Synchronizes any roofs that rest on or cover the given walls.
     * When wall height or elevation increases/changes, roofs automatically move upward
     * to remain physically attached to the top of the building walls.
     * @param {Array<Object>|Object} walls 
     * @param {Object} [plannerOrCtx] 
     * @param {Object} [ctx3d] 
     */
    static syncRoofsWithWalls(walls, plannerOrCtx = null, ctx3d = null) {
        let planner = null;
        let c3d = ctx3d;

        if (plannerOrCtx) {
            if (plannerOrCtx.camera || (plannerOrCtx.scene && plannerOrCtx.renderer)) {
                c3d = plannerOrCtx;
                planner = plannerOrCtx.planner;
            } else {
                planner = plannerOrCtx;
                if (!c3d) c3d = plannerOrCtx.engine3d || plannerOrCtx.ctx || (plannerOrCtx.envBuilder ? plannerOrCtx : null);
            }
        }

        if (typeof window !== 'undefined') {
            if (!planner) planner = window.plannerInstance || window.planner?.value || window.planner;
            if (!c3d) c3d = planner?.engine3d || window.engine3d || window.renderer3D?.value || window.preview3D;
        }

        if (!planner || !planner.roofs || planner.roofs.length === 0) return;

        const wallList = Array.isArray(walls) ? walls : (walls ? [walls] : (planner.walls || []));
        if (wallList.length === 0) return;

        const allPlannerWalls = planner.walls || [];

        planner.roofs.forEach(rf => {
            // Check if any of the target walls is under this roof
            const coversTargetWall = wallList.some(w => {
                const wallsUnder = RoofGeometryEngine.getWallsUnderRoof(rf, [w]);
                return wallsUnder.length > 0;
            });

            if (!coversTargetWall) return;

            // Get max top of ALL walls under this roof
            const maxWallTop = RoofGeometryEngine.getMaxWallTopUnderRoof(rf, allPlannerWalls);
            if (maxWallTop <= 0) return;

            const curElev = rf.elevation !== undefined ? Number(rf.elevation) : 0;

            // If the user explicitly detached this roof, do not force it back to wall height
            if (rf._restingOnWalls === false) return;

            const wasResting = rf._restingOnWalls === true || (rf._lastSyncedWallTop && Math.abs(curElev - rf._lastSyncedWallTop) < 2) || (rf._restingOnWalls === undefined && curElev <= maxWallTop);

            if (curElev < maxWallTop || wasResting) {
                if (curElev !== maxWallTop) {
                    rf.elevation = maxWallTop;
                    rf._lastSyncedWallTop = maxWallTop;
                    rf._restingOnWalls = true;
                    this.notifyRoofUpdated(rf, c3d || planner, 'transform');
                } else {
                    // Elevation is already at maxWallTop, but 3D mesh might need updating in place
                    const env = c3d?.envBuilder || planner?.envBuilder || c3d;
                    if (env && typeof env.updateRoofLive === 'function' && rf.mesh3D) {
                        env.updateRoofLive(rf);
                    }
                }
            }
        });
    }
}

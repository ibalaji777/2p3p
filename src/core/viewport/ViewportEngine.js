/**
 * ViewportEngine
 * 
 * Central canonical authority for 2D and 3D Viewports, Cameras, Lighting,
 * Environment Presets, and Wall Cutaway Modes.
 * 
 * Provides unified, cross-platform APIs for:
 * - 2D & 3D discrete zoom in / zoom out
 * - Reset and framing (fit scene, fit object)
 * - Preset view projections (4-quadrant Isometric, Top-Down blueprint, Front/Back/Left/Right elevations)
 * - Stepped 45° rotation
 * - Studio & architectural sky/ground lighting environments
 * - Dynamic Sims 4-style wall cutaway modes ('walls_up', 'cutaway', 'walls_down')
 */

export const VIEW_PRESETS = Object.freeze({
    ISO: 'iso',
    ISO_NE: 'iso_ne',
    ISO_SE: 'iso_se',
    ISO_SW: 'iso_sw',
    ISO_NW: 'iso_nw',
    TOP: 'top',
    BLUEPRINT: 'blueprint',
    FRONT: 'front',
    BACK: 'back',
    LEFT: 'left',
    RIGHT: 'right'
});

export const CUTAWAY_MODES = Object.freeze({
    WALLS_UP: 'walls_up',
    CUTAWAY: 'cutaway',
    WALLS_DOWN: 'walls_down'
});

export class ViewportEngine {

    // ==========================================
    // 1. Unified Zoom & Pan APIs
    // ==========================================

    /**
     * Discrete zoom in across 2D or 3D viewports.
     * 
     * @param {string} viewMode - '2d' or '3d'
     * @param {Object} ctx - Context object containing planner and/or renderer3D
     * @param {number} [factor=1.0] - Multiplier factor
     */
    static zoomIn(viewMode, ctx, factor = 1.0) {
        if (!ctx) return;

        if (viewMode === '2d') {
            const planner = ctx.planner || ctx;
            const cam2D = planner.cameraController;
            if (cam2D && typeof cam2D.getNextZoomLevel === 'function' && typeof cam2D.zoomAt === 'function') {
                const nextScale = cam2D.getNextZoomLevel(true);
                const stage = planner.stage;
                const center = stage
                    ? { x: stage.width() / 2, y: stage.height() / 2 }
                    : { x: 0, y: 0 };
                cam2D.zoomAt(center, nextScale, true);
            } else if (planner.stage) {
                // Fallback stage zoom
                const stage = planner.stage;
                const oldScale = stage.scaleX();
                const newScale = oldScale * 1.15 * factor;
                stage.scale({ x: newScale, y: newScale });
                stage.batchDraw();
            }
        } else {
            const renderer3D = ctx.renderer3D || ctx;
            const cam3D = renderer3D.cameraController;
            if (cam3D && typeof cam3D.zoomBy === 'function') {
                cam3D.zoomBy(-150 * factor);
            }
            if (renderer3D.requestRender) {
                renderer3D.requestRender('viewport_zoom_in');
            }
        }
    }

    /**
     * Discrete zoom out across 2D or 3D viewports.
     * 
     * @param {string} viewMode - '2d' or '3d'
     * @param {Object} ctx - Context object containing planner and/or renderer3D
     * @param {number} [factor=1.0] - Multiplier factor
     */
    static zoomOut(viewMode, ctx, factor = 1.0) {
        if (!ctx) return;

        if (viewMode === '2d') {
            const planner = ctx.planner || ctx;
            const cam2D = planner.cameraController;
            if (cam2D && typeof cam2D.getNextZoomLevel === 'function' && typeof cam2D.zoomAt === 'function') {
                const prevScale = cam2D.getNextZoomLevel(false);
                const stage = planner.stage;
                const center = stage
                    ? { x: stage.width() / 2, y: stage.height() / 2 }
                    : { x: 0, y: 0 };
                cam2D.zoomAt(center, prevScale, true);
            } else if (planner.stage) {
                // Fallback stage zoom
                const stage = planner.stage;
                const oldScale = stage.scaleX();
                const newScale = oldScale / (1.15 * factor);
                stage.scale({ x: newScale, y: newScale });
                stage.batchDraw();
            }
        } else {
            const renderer3D = ctx.renderer3D || ctx;
            const cam3D = renderer3D.cameraController;
            if (cam3D && typeof cam3D.zoomBy === 'function') {
                cam3D.zoomBy(150 * factor);
            }
            if (renderer3D.requestRender) {
                renderer3D.requestRender('viewport_zoom_out');
            }
        }
    }

    /**
     * Resets zoom / camera framing to initial canonical perspective.
     * 
     * @param {string} viewMode - '2d' or '3d'
     * @param {Object} ctx - Context object containing planner and/or renderer3D
     */
    static resetZoom(viewMode, ctx) {
        if (!ctx) return;

        if (viewMode === '2d') {
            const planner = ctx.planner || ctx;
            const cam2D = planner.cameraController;
            if (cam2D && typeof cam2D.reset === 'function') {
                cam2D.reset();
            } else if (planner.stage) {
                planner.stage.scale({ x: 1, y: 1 });
                planner.stage.position({ x: 0, y: 0 });
                planner.stage.batchDraw();
            }
        } else {
            const renderer3D = ctx.renderer3D || ctx;
            const cam3D = renderer3D.cameraController;
            if (cam3D && typeof cam3D.resetCamera === 'function') {
                cam3D.resetCamera();
            }
            if (renderer3D.requestRender) {
                renderer3D.requestRender('viewport_reset_zoom');
            }
        }
    }

    // ==========================================
    // 2. Preset Views & Camera Projections
    // ==========================================

    /**
     * Sets a standard architectural camera preset view.
     * 
     * @param {string} preset - One of VIEW_PRESETS
     * @param {Object} ctx - Context object containing renderer3D
     */
    static setPresetView(preset, ctx) {
        const renderer3D = ctx.renderer3D || ctx;
        const cam3D = renderer3D?.cameraController;
        if (!cam3D) return;

        switch (preset) {
            case VIEW_PRESETS.ISO:
            case VIEW_PRESETS.ISO_NE:
                if (typeof cam3D.setSims4IsometricView === 'function') cam3D.setSims4IsometricView(0);
                break;
            case VIEW_PRESETS.ISO_SE:
                if (typeof cam3D.setSims4IsometricView === 'function') cam3D.setSims4IsometricView(1);
                break;
            case VIEW_PRESETS.ISO_SW:
                if (typeof cam3D.setSims4IsometricView === 'function') cam3D.setSims4IsometricView(2);
                break;
            case VIEW_PRESETS.ISO_NW:
                if (typeof cam3D.setSims4IsometricView === 'function') cam3D.setSims4IsometricView(3);
                break;
            case VIEW_PRESETS.TOP:
            case VIEW_PRESETS.BLUEPRINT:
                if (typeof cam3D.setTopDownView === 'function') cam3D.setTopDownView();
                break;
            case VIEW_PRESETS.FRONT:
                if (typeof cam3D.setFrontElevationView === 'function') cam3D.setFrontElevationView();
                break;
            case VIEW_PRESETS.BACK:
                if (typeof cam3D.setBackElevationView === 'function') cam3D.setBackElevationView();
                break;
            case VIEW_PRESETS.LEFT:
                if (typeof cam3D.setLeftElevationView === 'function') cam3D.setLeftElevationView();
                break;
            case VIEW_PRESETS.RIGHT:
                if (typeof cam3D.setRightElevationView === 'function') cam3D.setRightElevationView();
                break;
            default:
                if (typeof cam3D.resetCamera === 'function') cam3D.resetCamera();
        }

        if (renderer3D.requestRender) {
            renderer3D.requestRender('preset_view_changed', 35);
        }
    }

    /**
     * Rotates camera in 45° step around target pivot (Sims 4 style).
     * 
     * @param {number} [direction=1] - +1 clockwise, -1 counter-clockwise
     * @param {Object} ctx - Context object containing renderer3D
     */
    static rotateView(direction = 1, ctx) {
        const renderer3D = ctx.renderer3D || ctx;
        const cam3D = renderer3D?.cameraController;
        if (cam3D && typeof cam3D.rotateSims4Isometric === 'function') {
            cam3D.rotateSims4Isometric(direction);
        }
        if (renderer3D.requestRender) {
            renderer3D.requestRender('viewport_rotate', 35);
        }
    }

    /**
     * Smoothly toggles between Top-Down plan view and 45° Isometric perspective.
     * 
     * @param {Object} ctx - Context object containing renderer3D
     */
    static toggleTopDown(ctx) {
        const renderer3D = ctx.renderer3D || ctx;
        const cam3D = renderer3D?.cameraController;
        if (cam3D && typeof cam3D.toggleSims4TopDown === 'function') {
            cam3D.toggleSims4TopDown();
        }
        if (renderer3D.requestRender) {
            renderer3D.requestRender('viewport_toggle_topdown', 35);
        }
    }

    // ==========================================
    // 3. Framing & Object Focusing
    // ==========================================

    /**
     * Frames entire project scene cleanly in the viewport.
     * 
     * @param {string} viewMode - '2d' or '3d'
     * @param {Object} ctx - Context object containing planner and/or renderer3D
     */
    static fitScene(viewMode, ctx) {
        if (!ctx) return;

        if (viewMode === '2d') {
            const planner = ctx.planner || ctx;
            if (planner.cameraController && typeof planner.cameraController.fitScene === 'function') {
                planner.cameraController.fitScene();
            }
        } else {
            const renderer3D = ctx.renderer3D || ctx;
            if (renderer3D.cameraController && typeof renderer3D.cameraController.resetCamera === 'function') {
                renderer3D.cameraController.resetCamera();
            }
            if (renderer3D.requestRender) {
                renderer3D.requestRender('viewport_fit_scene');
            }
        }
    }

    /**
     * Focuses camera on a specific object/entity.
     * 
     * @param {string} viewMode - '2d' or '3d'
     * @param {Object} entity - Domain entity to focus on
     * @param {Object} ctx - Context object
     */
    static fitObject(viewMode, entity, ctx) {
        if (!ctx || !entity) return;

        if (viewMode === '2d') {
            const planner = ctx.planner || ctx;
            if (planner.cameraController && typeof planner.cameraController.fitObject === 'function') {
                planner.cameraController.fitObject(entity);
            }
        } else {
            const renderer3D = ctx.renderer3D || ctx;
            const targetMesh = entity.mesh3D || entity.wallMesh3D || (entity.isMesh ? entity : null);
            if (renderer3D.cameraController && typeof renderer3D.cameraController.focusOnObject === 'function' && targetMesh) {
                renderer3D.cameraController.focusOnObject(targetMesh);
            }
            if (renderer3D.requestRender) {
                renderer3D.requestRender('viewport_fit_object');
            }
        }
    }

    // ==========================================
    // 4. Environment & Lighting Configuration
    // ==========================================

    /**
     * Applies sky and ground presets to the 3D scene.
     * 
     * @param {Object} preview3D - Preview3D engine instance
     * @param {string} skyKey - Sky configuration key (e.g. 'arch_viz_sunny', 'venice_sunset')
     * @param {string} groundKey - Ground configuration key (e.g. 'grass', 'studio_dark', 'grid')
     */
    static setEnvironment(preview3D, skyKey, groundKey) {
        if (!preview3D) return;

        if (preview3D.envBuilder && typeof preview3D.envBuilder.setEnvironment === 'function') {
            preview3D.envBuilder.setEnvironment(skyKey, groundKey);
        }
        if (typeof preview3D.requestRender === 'function') {
            preview3D.requestRender('environment_preset_changed', 4);
        }
    }

    /**
     * Updates ground elevation to align with basements or foundation levels.
     * 
     * @param {Object} preview3D - Preview3D engine instance
     * @param {number} activeLevelElev - Active level baseline elevation
     * @param {number} minElev - Minimum project elevation
     * @param {Object} activeLevelConfig - Active level configuration
     */
    static updateGroundElevation(preview3D, activeLevelElev = 0, minElev = 0, activeLevelConfig = null) {
        if (preview3D?.envBuilder && typeof preview3D.envBuilder.updateGroundElevation === 'function') {
            preview3D.envBuilder.updateGroundElevation(activeLevelElev, minElev, activeLevelConfig);
        }
        if (typeof preview3D?.requestRender === 'function') {
            preview3D.requestRender('ground_elevation_updated', 2);
        }
    }

    // ==========================================
    // 5. Wall Cutaway & Visibility Modes
    // ==========================================

    /**
     * Sets wall cutaway mode ('walls_up' | 'cutaway' | 'walls_down').
     * 
     * @param {Object} preview3D - Preview3D engine instance
     * @param {string} mode - 'walls_up', 'cutaway', or 'walls_down'
     */
    static setWallCutawayMode(preview3D, mode) {
        if (!preview3D || !preview3D.cutawaySystem) return;
        preview3D.cutawaySystem.setMode(mode);
        if (typeof preview3D.requestRender === 'function') {
            preview3D.requestRender('wall_cutaway_mode_changed', 2);
        }
    }

    /**
     * Cycles through wall cutaway modes: walls_up -> cutaway -> walls_down -> walls_up.
     * 
     * @param {Object} preview3D - Preview3D engine instance
     * @returns {string} The newly active cutaway mode
     */
    static cycleWallCutawayMode(preview3D) {
        if (!preview3D || !preview3D.cutawaySystem) return CUTAWAY_MODES.WALLS_UP;
        const newMode = preview3D.cutawaySystem.cycleMode();
        if (typeof preview3D.requestRender === 'function') {
            preview3D.requestRender('wall_cutaway_cycle', 2);
        }
        return newMode;
    }

    /**
     * Gets current wall cutaway mode.
     * 
     * @param {Object} preview3D - Preview3D engine instance
     * @returns {string}
     */
    static getWallCutawayMode(preview3D) {
        return preview3D?.cutawaySystem?.getMode() || CUTAWAY_MODES.WALLS_UP;
    }
}

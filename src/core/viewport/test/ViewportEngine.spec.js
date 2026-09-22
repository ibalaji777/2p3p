import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ViewportEngine, VIEW_PRESETS, CUTAWAY_MODES } from '../ViewportEngine.js';
import { WorkspaceControls } from '../../engine3d/WorkspaceControls.js';

describe('ViewportEngine Canonical Subsystem', () => {

    describe('1. Unified Zoom & Pan Controls', () => {
        it('should advance 2D zoom level using 2D CameraController', () => {
            const getNextZoomLevel = vi.fn().mockReturnValue(2.0);
            const zoomAt = vi.fn();
            const planner = {
                cameraController: { getNextZoomLevel, zoomAt },
                stage: {
                    width: () => 1000,
                    height: () => 800
                }
            };

            ViewportEngine.zoomIn('2d', { planner });
            expect(getNextZoomLevel).toHaveBeenCalledWith(true);
            expect(zoomAt).toHaveBeenCalledWith({ x: 500, y: 400 }, 2.0, true);
        });

        it('should fallback to 2D stage scaling if cameraController has no discrete levels', () => {
            let scaleVal = 1.0;
            const stage = {
                scaleX: () => scaleVal,
                scale: ({ x }) => { scaleVal = x; },
                batchDraw: vi.fn()
            };
            const planner = { stage };

            ViewportEngine.zoomIn('2d', { planner }, 1.0);
            expect(scaleVal).toBeCloseTo(1.15, 0.01);
            expect(stage.batchDraw).toHaveBeenCalled();
        });

        it('should step 2D zoom out using 2D CameraController', () => {
            const getNextZoomLevel = vi.fn().mockReturnValue(0.5);
            const zoomAt = vi.fn();
            const planner = {
                cameraController: { getNextZoomLevel, zoomAt },
                stage: {
                    width: () => 800,
                    height: () => 600
                }
            };

            ViewportEngine.zoomOut('2d', { planner });
            expect(getNextZoomLevel).toHaveBeenCalledWith(false);
            expect(zoomAt).toHaveBeenCalledWith({ x: 400, y: 300 }, 0.5, true);
        });

        it('should zoom in 3D camera and request render', () => {
            const zoomBy = vi.fn();
            const requestRender = vi.fn();
            const renderer3D = {
                cameraController: { zoomBy },
                requestRender
            };

            ViewportEngine.zoomIn('3d', { renderer3D }, 1.2);
            expect(zoomBy).toHaveBeenCalledWith(-150 * 1.2);
            expect(requestRender).toHaveBeenCalledWith('viewport_zoom_in');
        });

        it('should zoom out 3D camera and request render', () => {
            const zoomBy = vi.fn();
            const requestRender = vi.fn();
            const renderer3D = {
                cameraController: { zoomBy },
                requestRender
            };

            ViewportEngine.zoomOut('3d', { renderer3D });
            expect(zoomBy).toHaveBeenCalledWith(150);
            expect(requestRender).toHaveBeenCalledWith('viewport_zoom_out');
        });

        it('should reset zoom in 2D and 3D', () => {
            const reset2D = vi.fn();
            const planner = { cameraController: { reset: reset2D } };
            ViewportEngine.resetZoom('2d', { planner });
            expect(reset2D).toHaveBeenCalled();

            const resetCamera3D = vi.fn();
            const requestRender = vi.fn();
            const renderer3D = {
                cameraController: { resetCamera: resetCamera3D },
                requestRender
            };
            ViewportEngine.resetZoom('3d', { renderer3D });
            expect(resetCamera3D).toHaveBeenCalled();
            expect(requestRender).toHaveBeenCalledWith('viewport_reset_zoom');
        });
    });

    describe('2. Preset Projections & Camera Orientations', () => {
        let cam3D;
        let renderer3D;

        beforeEach(() => {
            cam3D = {
                setSims4IsometricView: vi.fn(),
                setTopDownView: vi.fn(),
                setFrontElevationView: vi.fn(),
                setBackElevationView: vi.fn(),
                setLeftElevationView: vi.fn(),
                setRightElevationView: vi.fn(),
                resetCamera: vi.fn(),
                rotateSims4Isometric: vi.fn(),
                toggleSims4TopDown: vi.fn()
            };
            renderer3D = {
                cameraController: cam3D,
                requestRender: vi.fn()
            };
        });

        it('should dispatch all 4 isometric quadrants', () => {
            ViewportEngine.setPresetView(VIEW_PRESETS.ISO, { renderer3D });
            expect(cam3D.setSims4IsometricView).toHaveBeenCalledWith(0);

            ViewportEngine.setPresetView(VIEW_PRESETS.ISO_SE, { renderer3D });
            expect(cam3D.setSims4IsometricView).toHaveBeenCalledWith(1);

            ViewportEngine.setPresetView(VIEW_PRESETS.ISO_SW, { renderer3D });
            expect(cam3D.setSims4IsometricView).toHaveBeenCalledWith(2);

            ViewportEngine.setPresetView(VIEW_PRESETS.ISO_NW, { renderer3D });
            expect(cam3D.setSims4IsometricView).toHaveBeenCalledWith(3);
        });

        it('should dispatch top-down blueprint view', () => {
            ViewportEngine.setPresetView(VIEW_PRESETS.TOP, { renderer3D });
            expect(cam3D.setTopDownView).toHaveBeenCalled();

            ViewportEngine.setPresetView(VIEW_PRESETS.BLUEPRINT, { renderer3D });
            expect(cam3D.setTopDownView).toHaveBeenCalledTimes(2);
        });

        it('should dispatch Front, Back, Left, Right architectural elevations', () => {
            ViewportEngine.setPresetView(VIEW_PRESETS.FRONT, { renderer3D });
            expect(cam3D.setFrontElevationView).toHaveBeenCalled();

            ViewportEngine.setPresetView(VIEW_PRESETS.BACK, { renderer3D });
            expect(cam3D.setBackElevationView).toHaveBeenCalled();

            ViewportEngine.setPresetView(VIEW_PRESETS.LEFT, { renderer3D });
            expect(cam3D.setLeftElevationView).toHaveBeenCalled();

            ViewportEngine.setPresetView(VIEW_PRESETS.RIGHT, { renderer3D });
            expect(cam3D.setRightElevationView).toHaveBeenCalled();
        });

        it('should rotate view stepped 45 degrees left and right', () => {
            ViewportEngine.rotateView(-1, { renderer3D });
            expect(cam3D.rotateSims4Isometric).toHaveBeenCalledWith(-1);

            ViewportEngine.rotateView(1, { renderer3D });
            expect(cam3D.rotateSims4Isometric).toHaveBeenCalledWith(1);
        });

        it('should toggle top-down view smoothly', () => {
            ViewportEngine.toggleTopDown({ renderer3D });
            expect(cam3D.toggleSims4TopDown).toHaveBeenCalled();
        });
    });

    describe('3. Framing & Object Focusing', () => {
        it('should fit scene in 2D and 3D', () => {
            const fitScene2D = vi.fn();
            const planner = { cameraController: { fitScene: fitScene2D } };
            ViewportEngine.fitScene('2d', { planner });
            expect(fitScene2D).toHaveBeenCalled();

            const resetCamera = vi.fn();
            const renderer3D = { cameraController: { resetCamera }, requestRender: vi.fn() };
            ViewportEngine.fitScene('3d', { renderer3D });
            expect(resetCamera).toHaveBeenCalled();
        });

        it('should focus on object in 2D and 3D', () => {
            const entity = { id: 'obj1', mesh3D: new THREE.Mesh() };

            const fitObject2D = vi.fn();
            const planner = { cameraController: { fitObject: fitObject2D } };
            ViewportEngine.fitObject('2d', entity, { planner });
            expect(fitObject2D).toHaveBeenCalledWith(entity);

            const focusOnObject3D = vi.fn();
            const renderer3D = { cameraController: { focusOnObject: focusOnObject3D }, requestRender: vi.fn() };
            ViewportEngine.fitObject('3d', entity, { renderer3D });
            expect(focusOnObject3D).toHaveBeenCalledWith(entity.mesh3D);
        });
    });

    describe('4. Lighting & Environment Configuration', () => {
        it('should delegate setEnvironment and updateGroundElevation to preview3D.envBuilder', () => {
            const setEnvironment = vi.fn();
            const updateGroundElevation = vi.fn();
            const requestRender = vi.fn();

            const preview3D = {
                envBuilder: { setEnvironment, updateGroundElevation },
                requestRender
            };

            ViewportEngine.setEnvironment(preview3D, 'venice_sunset', 'studio_dark');
            expect(setEnvironment).toHaveBeenCalledWith('venice_sunset', 'studio_dark');
            expect(requestRender).toHaveBeenCalledWith('environment_preset_changed', 4);

            ViewportEngine.updateGroundElevation(preview3D, -300, -300, { type: 'basement' });
            expect(updateGroundElevation).toHaveBeenCalledWith(-300, -300, { type: 'basement' });
            expect(requestRender).toHaveBeenCalledWith('ground_elevation_updated', 2);
        });
    });

    describe('5. Wall Cutaway & Visibility Modes', () => {
        it('should set, cycle, and get wall cutaway mode', () => {
            let currentMode = 'walls_up';
            const cutawaySystem = {
                setMode: vi.fn((m) => { currentMode = m; }),
                cycleMode: vi.fn(() => {
                    currentMode = currentMode === 'walls_up' ? 'cutaway' : (currentMode === 'cutaway' ? 'walls_down' : 'walls_up');
                    return currentMode;
                }),
                getMode: vi.fn(() => currentMode)
            };
            const preview3D = { cutawaySystem, requestRender: vi.fn() };

            expect(ViewportEngine.getWallCutawayMode(preview3D)).toBe('walls_up');

            ViewportEngine.setWallCutawayMode(preview3D, CUTAWAY_MODES.CUTAWAY);
            expect(cutawaySystem.setMode).toHaveBeenCalledWith('cutaway');

            const nextMode = ViewportEngine.cycleWallCutawayMode(preview3D);
            expect(nextMode).toBe('walls_down');
            expect(preview3D.requestRender).toHaveBeenCalled();
        });
    });

    describe('6. WorkspaceControls Adapter Compatibility', () => {
        it('should seamlessly execute 2D and 3D zoom methods through WorkspaceControls', () => {
            const zoomAt = vi.fn();
            const getNextZoomLevel = vi.fn().mockReturnValue(1.5);
            const reset2D = vi.fn();
            const planner = {
                cameraController: { zoomAt, getNextZoomLevel, reset: reset2D },
                stage: { width: () => 500, height: () => 500 }
            };

            const zoomBy = vi.fn();
            const resetCamera = vi.fn();
            const preview3D = {
                cameraController: { zoomBy, resetCamera },
                requestRender: vi.fn()
            };

            const controls = new WorkspaceControls(preview3D, planner);

            // 2D operations
            controls.zoomIn2D();
            expect(zoomAt).toHaveBeenCalled();
            controls.zoomOut2D();
            expect(zoomAt).toHaveBeenCalledTimes(2);
            controls.resetZoom2D();
            expect(reset2D).toHaveBeenCalled();

            // 3D operations (previously missing, now working)
            controls.zoomIn3D(1.0);
            expect(zoomBy).toHaveBeenCalledWith(-150);
            controls.zoomOut3D(1.0);
            expect(zoomBy).toHaveBeenCalledWith(150);
            controls.resetZoom3D();
            expect(resetCamera).toHaveBeenCalled();
        });
    });
});

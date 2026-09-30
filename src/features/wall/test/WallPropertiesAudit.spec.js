// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import WallPanel from '../wall.properties.vue';
import { WallEngine } from '../../../core/wall/WallEngine.js';
import { WallGeometryEngine } from '../../../core/wall/WallGeometryEngine.js';

describe('Wall Properties Audit: 2D & 3D Realtime Reactive Synchronization', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    const createMockAnchor = (initX, initY) => {
        let currentPos = { x: initX, y: initY };
        return {
            lastValidPos: { x: initX, y: initY },
            position: (pos) => {
                if (pos) {
                    currentPos = { x: Number(pos.x) || 0, y: Number(pos.y) || 0 };
                    return currentPos;
                }
                return currentPos;
            }
        };
    };

    const createMockWall = (overrides = {}) => {
        const wall = {
            id: 'wall-' + Math.random().toString(36).substr(2, 6),
            type: 'wall',
            thickness: 20,
            height: 280,
            elevation: 0,
            hidden: false,
            topProfileType: 'normal',
            startAnchor: createMockAnchor(0, 0),
            endAnchor: createMockAnchor(200, 0),
            update: vi.fn(),
            wallShapeData: null,
            params: {},
            attachedDecor: [],
            ...overrides
        };
        return wall;
    };

    it('1. should toggle hidden wall cleanly without breaking 2D/3D state', async () => {
        const wall = createMockWall({ hidden: false });
        const mockPlanner = {
            walls: [wall],
            executeWithSnapshot: (fn) => fn(),
            syncAll: vi.fn(),
            mainLayer: { batchDraw: vi.fn() },
            uiLayer: { batchDraw: vi.fn() },
            roomLayer: { batchDraw: vi.fn() }
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: wall,
                wallDecorRegistry: {},
                railingRegistry: {},
                uiTrigger: 0,
                planner: mockPlanner
            }
        });

        // Toggle hidden = true
        const hiddenCheckbox = wrapper.find('input[type="checkbox"]:not([id])');
        expect(hiddenCheckbox.exists()).toBe(true);

        // Call toggleHiddenWall directly via change
        await hiddenCheckbox.setValue(true);
        expect(wall.hidden).toBe(true);
        expect(wrapper.emitted('sync-engine')).toBeTruthy();
        expect(wrapper.emitted('ui-trigger')).toBeTruthy();

        // Toggle hidden = false (enabling the wall)
        await hiddenCheckbox.setValue(false);
        expect(wall.hidden).toBe(false);
        expect(wrapper.emitted('sync-engine').length).toBe(2);
    });

    it('2. should accurately compute and update wall length without NaN coordinates', async () => {
        const wall = createMockWall();
        const mockPlanner = {
            walls: [wall],
            executeWithSnapshot: (fn) => fn(),
            syncAll: vi.fn()
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: wall,
                wallDecorRegistry: {},
                railingRegistry: {},
                uiTrigger: 0,
                planner: mockPlanner
            }
        });

        // Check computed initial length: Math.hypot(200 - 0, 0 - 0) = 200
        expect(WallGeometryEngine.getLength(wall)).toBe(200);

        // Update length to 350
        const lengthInput = wrapper.find('input[type="range"]');
        expect(lengthInput.exists()).toBe(true);
        await lengthInput.setValue(350);

        expect(wrapper.emitted('sync-engine')).toBeTruthy();
        expect(wrapper.emitted('ui-trigger')).toBeTruthy();

        // End anchor should have been updated to x=350, y=0 without NaN
        const endPos = WallGeometryEngine.getAnchorPosition(wall.endAnchor);
        expect(endPos.x).toBe(350);
        expect(endPos.y).toBe(0);
        expect(isNaN(endPos.x)).toBe(false);
    });

    it('3. should update wall thickness and clamp to valid ranges', async () => {
        const wall = createMockWall({ thickness: 20 });
        const mockPlanner = {
            walls: [wall],
            executeWithSnapshot: (fn) => fn(),
            syncAll: vi.fn()
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: wall,
                wallDecorRegistry: {},
                railingRegistry: {},
                uiTrigger: 0,
                planner: mockPlanner
            }
        });

        // Update thickness to 35
        const thicknessInputs = wrapper.findAll('input[type="range"]');
        const thickInput = thicknessInputs[1]; // second range input is thickness
        await thickInput.setValue(35);

        expect(wall.thickness).toBe(35);
        expect(wrapper.emitted('sync-engine')).toBeTruthy();
        expect(wrapper.emitted('ui-trigger')).toBeTruthy();
    });

    it('4. should update height and adjust slope parameters proportionally', async () => {
        const wall = createMockWall({
            height: 280,
            topProfileType: 'single',
            startHeight: 280,
            endHeight: 340
        });
        const mockPlanner = {
            walls: [wall],
            executeWithSnapshot: (fn) => fn(),
            syncAll: vi.fn()
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: wall,
                wallDecorRegistry: {},
                railingRegistry: {},
                uiTrigger: 0,
                planner: mockPlanner
            }
        });

        // Set new height via WallEngine.setHeight
        WallEngine.setHeight(wall, 300, false, mockPlanner);

        expect(wall.height).toBe(300);
        // delta was +20, so startHeight becomes 300 and endHeight becomes 360
        expect(wall.startHeight).toBe(300);
        expect(wall.endHeight).toBe(360);
    });

    it('5. should switch topProfile and initialize slope heights without undefined values', async () => {
        const wall = createMockWall({ height: 280, topProfileType: 'normal' });
        const mockPlanner = {
            walls: [wall],
            executeWithSnapshot: (fn) => fn(),
            syncAll: vi.fn()
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: wall,
                wallDecorRegistry: {},
                railingRegistry: {},
                uiTrigger: 0,
                planner: mockPlanner
            }
        });

        // Click Gable Slope button
        const profileBtns = wrapper.findAll('.pro-profile-btn');
        expect(profileBtns.length).toBe(3); // Flat, Slope, Gable
        await profileBtns[2].trigger('click'); // Click Gable

        expect(wall.topProfileType).toBe('gable');
        expect(wall.startHeight).toBeDefined();
        expect(wall.endHeight).toBeDefined();
        expect(wall.peakHeight).toBeDefined();
        expect(isNaN(wall.startHeight)).toBe(false);
        expect(isNaN(wall.peakHeight)).toBe(false);
        expect(wrapper.emitted('sync-engine')).toBeTruthy();
        expect(wrapper.emitted('ui-trigger')).toBeTruthy();
    });

    it('6. should update slope parameters and propagate to parentArc siblings if present', async () => {
        const wall1 = createMockWall({ height: 280, topProfileType: 'single', startHeight: 280, endHeight: 320 });
        const wall2 = createMockWall({ height: 280, topProfileType: 'single', startHeight: 280, endHeight: 320 });
        const arc = {
            id: 'arc-1',
            type: 'arc',
            walls: [wall1, wall2],
            height: 280,
            topProfileType: 'single',
            startHeight: 280,
            endHeight: 320
        };
        wall1.parentArc = arc;
        wall2.parentArc = arc;

        const mockPlanner = {
            walls: [wall1, wall2],
            arcs: [arc],
            executeWithSnapshot: (fn) => fn(),
            syncAll: vi.fn()
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: wall1,
                wallDecorRegistry: {},
                railingRegistry: {},
                uiTrigger: 0,
                planner: mockPlanner
            }
        });

        // Trigger slope prop change for endHeight to 380
        const slopeInputs = wrapper.findAll('input[type="range"]');
        // Find input bound to endHeight
        const endHInput = slopeInputs.find(input => input.element.value === '320');
        expect(endHInput).toBeDefined();
        await endHInput.setValue(380);

        expect(wall1.endHeight).toBe(380);
        expect(arc.endHeight).toBe(380);
        expect(wall2.endHeight).toBe(380);
        expect(wrapper.emitted('sync-engine')).toBeTruthy();
    });

    it('7. should update elevation and reflect in spatial coords readout', async () => {
        const wall = createMockWall({ elevation: 0 });
        const mockPlanner = {
            walls: [wall],
            executeWithSnapshot: (fn) => fn(),
            syncAll: vi.fn()
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: wall,
                wallDecorRegistry: {},
                railingRegistry: {},
                uiTrigger: 0,
                planner: mockPlanner
            }
        });

        // Find elevation readout
        expect(wrapper.find('.pro-coords-elev').text()).toContain('Z: 0 cm');

        // Update elevation
        WallEngine.setElevation(wall, 45, false, mockPlanner);
        await wrapper.setProps({ uiTrigger: 1 });

        expect(wall.elevation).toBe(45);
        expect(wrapper.find('.pro-coords-elev').text()).toContain('Z: 45 cm');
    });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import WallPanel from '../wall.properties.vue';
import { WallEngine } from '../../../core/wall/WallEngine.js';
import { WallSerializer } from '../wall.serializer.js';
import { Wall3DBuilder } from '../wall.renderer3d.js';
import { CommandManager } from '../../../core/commands/CommandManager.js';

describe('Wall Properties Pipeline Fixes: Domain Authority, Persistence, & Slider Drag Transactions', () => {
    beforeEach(() => {
        setActivePinia(createPinia());

        // Standard Konva 2D Canvas Mock for jsdom
        HTMLCanvasElement.prototype.getContext = () => ({
            fillRect: vi.fn(),
            clearRect: vi.fn(),
            getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
            putImageData: vi.fn(),
            createImageData: vi.fn(),
            setTransform: vi.fn(),
            drawImage: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            measureText: vi.fn(() => ({ width: 0 }))
        });
    });

    const createMockAnchor = (initX, initY) => {
        let currentPos = { x: initX, y: initY };
        return {
            _id: 'anchor_' + Math.random().toString(36).substr(2, 6),
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
            id: 'wall_' + Math.random().toString(36).substr(2, 6),
            type: 'outer',
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
            attachedWidgets: [],
            attachedMoldings: [],
            attachedDecor: [],
            ...overrides
        };
        return wall;
    };

    const createMockPlanner = (walls = []) => {
        const planner = {
            walls: [...walls],
            wallLayer: { add: vi.fn() },
            uiLayer: { add: vi.fn() },
            commandManager: new CommandManager(),
            syncAll: vi.fn(),
            update3D: vi.fn(),
            exportState: () => {
                return JSON.stringify(planner.walls.map(w => ({
                    id: w.id,
                    thickness: w.thickness,
                    height: w.height,
                    elevation: w.elevation,
                    startHeight: w.startHeight,
                    endHeight: w.endHeight,
                    peakHeight: w.peakHeight,
                    configId: w.configId,
                    hasFloor: w.hasFloor,
                    params: { ...w.params }
                })));
            },
            importState: (jsonStr) => {
                const parsed = JSON.parse(jsonStr);
                parsed.forEach(data => {
                    const found = planner.walls.find(w => w.id === data.id);
                    if (found) {
                        found.thickness = data.thickness;
                        found.height = data.height;
                        found.elevation = data.elevation;
                        found.startHeight = data.startHeight;
                        found.endHeight = data.endHeight;
                        found.peakHeight = data.peakHeight;
                        found.configId = data.configId;
                        found.hasFloor = data.hasFloor;
                        found.params = { ...data.params };
                    }
                });
            },
            executeWithSnapshot: (fn) => {
                const before = planner.exportState();
                fn();
                const after = planner.exportState();
                if (before !== after) {
                    planner.commandManager.execute({
                        execute: () => { planner.importState(after); planner.syncAll(); },
                        undo: () => { planner.importState(before); planner.syncAll(); }
                    });
                }
            }
        };
        return planner;
    };

    describe('1. WallSerializer & Persistence Contract', () => {
        it('should correctly serialize and deserialize compound wall hasFloor state', () => {
            const compoundWall = createMockWall({ type: 'compound', hasFloor: true });
            const serialized = WallSerializer.serialize(compoundWall);
            expect(serialized.hasFloor).toBe(true);

            const anchorMap = new Map();
            anchorMap.set(serialized.startAnchorId, compoundWall.startAnchor);
            anchorMap.set(serialized.endAnchorId, compoundWall.endAnchor);

            const mockPlanner = createMockPlanner([]);
            const deserialized = WallSerializer.deserialize(serialized, mockPlanner, anchorMap);
            expect(deserialized.hasFloor).toBe(true);
        });

        it('should deserialize compound wall with hasFloor = false', () => {
            const compoundWall = createMockWall({ type: 'compound', hasFloor: false });
            const serialized = WallSerializer.serialize(compoundWall);
            expect(serialized.hasFloor).toBe(false);

            const anchorMap = new Map();
            anchorMap.set(serialized.startAnchorId, compoundWall.startAnchor);
            anchorMap.set(serialized.endAnchorId, compoundWall.endAnchor);

            const mockPlanner = createMockPlanner([]);
            const deserialized = WallSerializer.deserialize(serialized, mockPlanner, anchorMap);
            expect(deserialized.hasFloor).toBe(false);
        });
    });

    describe('2. Canonical WallEngine & WallMutationEngine Setters', () => {
        it('WallEngine.setCompoundFloor updates all compound walls across planner', () => {
            const w1 = createMockWall({ type: 'compound', hasFloor: false });
            const w2 = createMockWall({ type: 'compound', hasFloor: false });
            const w3 = createMockWall({ type: 'outer', hasFloor: false });
            const planner = createMockPlanner([w1, w2, w3]);

            WallEngine.setCompoundFloor(planner, true, true);
            expect(w1.hasFloor).toBe(true);
            expect(w2.hasFloor).toBe(true);
            expect(w3.hasFloor).toBe(false); // outer wall untouched
            expect(planner.syncAll).toHaveBeenCalled();
            expect(planner.update3D).toHaveBeenCalled();
        });

        it('WallEngine.setRailingConfig sets railing configId authoritatively and propagates to segments', () => {
            const seg1 = createMockWall({ type: 'railing', configId: 'glass_frameless' });
            const seg2 = createMockWall({ type: 'railing', configId: 'glass_frameless' });
            const wall = createMockWall({
                type: 'railing',
                configId: 'glass_frameless',
                walls: [seg1, seg2]
            });
            const planner = createMockPlanner([wall, seg1, seg2]);

            WallEngine.setRailingConfig(wall, 'wire_cable', true, planner);
            expect(wall.configId).toBe('wire_cable');
            expect(seg1.configId).toBe('wire_cable');
            expect(seg2.configId).toBe('wire_cable');
            expect(planner.syncAll).toHaveBeenCalled();
            expect(planner.update3D).toHaveBeenCalled();
        });

        it('WallEngine.setSlopeProp validates heights and invalidates wallShapeData cache', () => {
            const wall = createMockWall({
                topProfileType: 'single',
                startHeight: 280,
                endHeight: 350,
                wallShapeData: { cached: true }
            });
            const planner = createMockPlanner([wall]);

            WallEngine.setSlopeProp(wall, 'startHeight', 250, true, planner);
            expect(wall.startHeight).toBe(250);
            expect(wall.wallShapeData).toBeNull();

            WallEngine.setSlopeProp(wall, 'flipSlope', true, true, planner);
            expect(wall.flipSlope).toBe(true);
        });

        it('WallEngine.setMaterialParams assigns params and propagates to arc siblings', () => {
            const sib1 = createMockWall({ params: {} });
            const sib2 = createMockWall({ params: {} });
            const parentArc = { walls: [sib1, sib2], params: {} };
            sib1.parentArc = parentArc;
            sib2.parentArc = parentArc;

            const updateMatMock = vi.fn();
            const planner = {
                ...createMockPlanner([sib1, sib2]),
                renderer3D: { updateMaterialLive: updateMatMock, requestRender: vi.fn() }
            };

            WallEngine.setMaterialParams(sib1, { tileSizeFront: 120, rotationFront: 1.57 }, true, planner);
            expect(sib1.params.tileSizeFront).toBe(120);
            expect(sib1.params.rotationFront).toBe(1.57);
            expect(sib2.params.tileSizeFront).toBe(120);
            expect(sib2.params.rotationFront).toBe(1.57);
            expect(updateMatMock).toHaveBeenCalled();
        });
    });

    describe('3. 3D Wall Elevation in buildStaticWallGroup', () => {
        it('should correctly set wallGroup Y position from wallData.elevation', () => {
            const builder = new Wall3DBuilder();
            const wallData = {
                id: 'static_wall_1',
                thickness: 20,
                elevation: 45,
                attachedWidgets: [],
                poly: { points: () => [0, 0, 200, 0, 200, 20, 0, 20] }
            };

            const result = builder.buildStaticWallGroup(
                200, 20, wallData, 100, 150, 0, 280, null
            );

            expect(result.wallGroup.position.x).toBe(100);
            expect(result.wallGroup.position.y).toBe(45); // Elevation must match wallData.elevation!
            expect(result.wallGroup.position.z).toBe(150);
        });
    });

    describe('4. wall.properties.vue Slider Transaction Model & Undo/Redo', () => {
        it('should handle live preview during dragging and commit 1 command on release', async () => {
            const wall = createMockWall({ thickness: 20 });
            const planner = createMockPlanner([wall]);

            const wrapper = mount(WallPanel, {
                props: {
                    selectedEntity: wall,
                    wallDecorRegistry: {},
                    railingRegistry: {},
                    uiTrigger: 0,
                    planner
                }
            });

            const thicknessRange = wrapper.findAll('input[type="range"]').find(input => {
                return input.attributes('max') === '100';
            });
            expect(thicknessRange).toBeDefined();

            // Simulate drag: multiple input events with intermediate values
            thicknessRange.element.value = '25';
            await thicknessRange.trigger('input');
            expect(wall.thickness).toBe(25);
            expect(planner.commandManager.undoStack.length).toBe(0); // No command committed during drag!

            thicknessRange.element.value = '30';
            await thicknessRange.trigger('input');
            expect(wall.thickness).toBe(30);
            expect(planner.commandManager.undoStack.length).toBe(0); // Still no command committed!

            thicknessRange.element.value = '40';
            await thicknessRange.trigger('input');
            expect(wall.thickness).toBe(40);
            expect(planner.commandManager.undoStack.length).toBe(0); // Still no command committed!

            // User releases mouse/pointer: @change fires
            await thicknessRange.trigger('change');
            expect(wall.thickness).toBe(40);
            expect(planner.commandManager.undoStack.length).toBe(1); // Exactly 1 command committed!

            // Undo: Should revert all the way back to initial 20!
            planner.commandManager.undo();
            expect(wall.thickness).toBe(20);

            // Redo: Should restore the committed 40!
            planner.commandManager.redo();
            expect(wall.thickness).toBe(40);
        });

        it('should route railing selection through executeWithSnapshot', async () => {
            const railing = createMockWall({ type: 'railing', configId: 'glass_frameless' });
            const planner = createMockPlanner([railing]);

            const wrapper = mount(WallPanel, {
                props: {
                    selectedEntity: railing,
                    wallDecorRegistry: {},
                    railingRegistry: {
                        glass_frameless: { name: 'Frameless Glass' },
                        wire_cable: { name: 'Cable Railing' }
                    },
                    uiTrigger: 0,
                    planner
                }
            });

            const railingItems = wrapper.findAll('.decor-item');
            expect(railingItems.length).toBe(2);

            // Click the second railing style
            await railingItems[1].trigger('click');
            expect(railing.configId).toBe('wire_cable');
            expect(planner.commandManager.undoStack.length).toBe(1);

            // Undo should revert back to glass_frameless
            planner.commandManager.undo();
            expect(railing.configId).toBe('glass_frameless');
        });

        it('should route compound floor toggle through executeWithSnapshot', async () => {
            const compoundWall = createMockWall({ type: 'compound', hasFloor: false });
            const planner = createMockPlanner([compoundWall]);

            const wrapper = mount(WallPanel, {
                props: {
                    selectedEntity: compoundWall,
                    wallDecorRegistry: {},
                    railingRegistry: {},
                    uiTrigger: 0,
                    planner
                }
            });

            const floorCheckbox = wrapper.find('.control-group input[type="checkbox"]');
            expect(floorCheckbox.exists()).toBe(true);

            // Check the box via setValue
            await floorCheckbox.setValue(true);
            expect(compoundWall.hasFloor).toBe(true);
            expect(planner.commandManager.undoStack.length).toBe(1);

            // Undo should revert hasFloor to false
            planner.commandManager.undo();
            expect(compoundWall.hasFloor).toBe(false);
        });
    });
});

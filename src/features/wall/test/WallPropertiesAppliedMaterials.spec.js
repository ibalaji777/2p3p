// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import WallPanel from '../wall.properties.vue';

describe('Wall Properties: Applied Materials List & Parametric Inspector', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('should correctly discover all applied materials including base surfaces and attached pattern layers', async () => {
        const mockWall = {
            id: 'wall-101',
            type: 'wall',
            thickness: 15,
            height: 280,
            params: {
                textureFront: 'dark_wood_tiles',
                tileSizeFront: 120,
                rotationFront: 0,
                textureBack: 'modern_brick',
                tileSizeBack: 80,
                rotationBack: 1.570796 // ~90 deg
            },
            attachedDecor: [
                {
                    id: 'decor-1',
                    configId: 'wood_slat_panel',
                    side: 'front',
                    depth: 2.5,
                    tileSize: 60,
                    width: 50,
                    height: 80,
                    localX: 25,
                    localY: 10,
                    faces: { left: true, right: true }
                }
            ]
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: mockWall,
                selectedWallSide: 'front',
                wallDecorRegistry: {
                    wood_slat_panel: { name: 'Wood Slat Panel', thumbnail: 'thumb_slat.jpg' },
                    dark_wood_tiles: { name: 'Dark Wood Tiles', thumbnail: 'thumb_wood.jpg' },
                    modern_brick: { name: 'Modern Brick', thumbnail: 'thumb_brick.jpg' }
                },
                railingRegistry: {},
                uiTrigger: 0,
                viewMode: '3d'
            }
        });

        // 1. Should have rendered 3 total applied materials: Base Front, Base Back, Decor 1
        const listCards = wrapper.findAll('.pro-mat-list-card');
        expect(listCards.length).toBe(3);

        // 2. Count badges: All = 3, Inner = 2, Outer = 1
        const switchButtons = wrapper.findAll('.pro-switch-btn');
        expect(switchButtons.length).toBe(3);
        expect(switchButtons[0].text()).toContain('All');
        expect(switchButtons[0].text()).toContain('3');
        expect(switchButtons[1].text()).toContain('Inner');
        expect(switchButtons[1].text()).toContain('2');
        expect(switchButtons[2].text()).toContain('Outer');
        expect(switchButtons[2].text()).toContain('1');

        // 3. Switch filter to Inner Face
        await switchButtons[1].trigger('click');
        const innerCards = wrapper.findAll('.pro-mat-list-card');
        expect(innerCards.length).toBe(2);

        // 4. Switch filter to Outer Face
        await switchButtons[2].trigger('click');
        const outerCards = wrapper.findAll('.pro-mat-list-card');
        expect(outerCards.length).toBe(1);
    });

    it('should open parametric inspector when editing a pattern layer and allow editing thickness, width, offsets', async () => {
        const mockWall = {
            id: 'wall-102',
            type: 'wall',
            thickness: 20,
            height: 300,
            params: {},
            attachedDecor: [
                {
                    id: 'decor-accent',
                    configId: 'marble_panel',
                    side: 'front',
                    depth: 1.5,
                    tileSize: 90,
                    width: 100,
                    height: 50,
                    localX: 50,
                    localY: 25,
                    faces: { left: false, right: false }
                }
            ]
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: mockWall,
                selectedWallSide: 'front',
                wallDecorRegistry: {
                    marble_panel: { name: 'Carrara Marble Accent', thumbnail: 'marble.jpg' }
                },
                railingRegistry: {},
                uiTrigger: 0,
                viewMode: '3d'
            }
        });

        // Click Edit on the pattern layer card
        const editBtn = wrapper.find('.pro-btn-action.edit');
        expect(editBtn.exists()).toBe(true);
        await editBtn.trigger('click');

        // Inspector box should now be visible
        const inspector = wrapper.find('.pro-inspector-box');
        expect(inspector.exists()).toBe(true);
        expect(inspector.text()).toContain('Carrara Marble Accent');
        expect(inspector.text()).toContain('Thickness');
        expect(inspector.text()).toContain('1.5 cm');
        expect(inspector.text()).toContain('Width');
        expect(inspector.text()).toContain('100%');
        expect(inspector.text()).toContain('Height');
        expect(inspector.text()).toContain('50%');

        // Clicking Done closes inspector
        const doneBtn = wrapper.find('.pro-inspector-btn-done');
        await doneBtn.trigger('click');
        expect(wrapper.find('.pro-inspector-box').exists()).toBe(false);
    });

    it('should open parametric inspector when editing base material and allow adjusting tile size and rotation', async () => {
        const mockWall = {
            id: 'wall-104',
            type: 'wall',
            thickness: 20,
            height: 280,
            params: {
                textureFront: 'slate_tile',
                tileSizeFront: 100,
                rotationFront: 0
            },
            attachedDecor: []
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: mockWall,
                selectedWallSide: 'front',
                wallDecorRegistry: {
                    slate_tile: { name: 'Slate Tile', thumbnail: 'slate.jpg' }
                },
                railingRegistry: {},
                uiTrigger: 0,
                viewMode: '3d'
            }
        });

        const listCards = wrapper.findAll('.pro-mat-list-card');
        expect(listCards.length).toBe(1);
        expect(listCards[0].text()).toContain('Slate Tile');
        expect(listCards[0].text()).toContain('Base Finish');

        // Click Edit
        await listCards[0].find('.pro-btn-action.edit').trigger('click');
        const inspector = wrapper.find('.pro-inspector-box');
        expect(inspector.exists()).toBe(true);
        expect(inspector.text()).toContain('Tile Size');
        expect(inspector.text()).toContain('100 cm');
        expect(inspector.text()).toContain('Rotation');
        expect(inspector.text()).toContain('0°');
        expect(inspector.text()).toContain('Width');
        expect(inspector.text()).toContain('Height');
        expect(inspector.text()).toContain('Offset X');
        expect(inspector.text()).toContain('Offset Y');

        // Click 90 deg rotation preset
        const rotButtons = inspector.findAll('.pro-track-btn');
        const rot90 = rotButtons.find(b => b.text() === '90°');
        expect(rot90).toBeDefined();
        await rot90.trigger('click');
        expect(mockWall.params.rotationFront).toBeCloseTo(1.570796, 4);
    });

    it('should display empty state card when a wall has no custom materials applied', async () => {
        const mockWall = {
            id: 'wall-103',
            type: 'wall',
            thickness: 20,
            height: 280,
            params: {},
            attachedDecor: []
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: mockWall,
                selectedWallSide: 'front',
                wallDecorRegistry: {},
                railingRegistry: {},
                uiTrigger: 0,
                viewMode: '3d'
            }
        });

        expect(wrapper.findAll('.pro-mat-list-card').length).toBe(0);
        const emptyCard = wrapper.find('.pro-empty-card');
        expect(emptyCard.exists()).toBe(true);
        expect(emptyCard.text()).toContain('Default Plaster Finish');
    });

    it('should display wall length, elevation, and placement coordinates card', async () => {
        const mockWall = {
            id: 'wall-201',
            type: 'wall',
            thickness: 20,
            height: 300,
            elevation: 45,
            startX: 100,
            startY: 200,
            endX: 500,
            endY: 200, // length = 400
            params: {},
            attachedDecor: []
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: mockWall,
                selectedWallSide: 'front',
                wallDecorRegistry: {},
                railingRegistry: {},
                uiTrigger: 0,
                viewMode: '3d'
            }
        });

        // 1. Should show Length (Width)
        expect(wrapper.text()).toContain('Length (Width)');
        expect(wrapper.text()).toContain('Elevation');

        // 2. Should show Placement & Coordinates card
        const coordsCard = wrapper.find('.pro-coords-card');
        expect(coordsCard.exists()).toBe(true);
        expect(coordsCard.text()).toContain('Placement & Coordinates');
        expect(coordsCard.text()).toContain('Z: 45 cm');
        expect(coordsCard.text()).toContain('Center (X, Y)');
        expect(coordsCard.text()).toContain('X: 300 cm, Y: 200 cm');
        expect(coordsCard.text()).toContain('(100, 200) ➔ (500, 200)');
    });

    it('should provide dual-unit controls (% and cm) for pattern layer width, height, and offsets', async () => {
        const mockWall = {
            id: 'wall-202',
            type: 'wall',
            thickness: 15,
            height: 200,
            startX: 0,
            startY: 0,
            endX: 400,
            endY: 0, // length = 400 cm
            params: {},
            attachedDecor: [
                {
                    id: 'decor-dual',
                    configId: 'wood_panel',
                    side: 'front',
                    depth: 2,
                    tileSize: 70,
                    width: 50,  // 50% = 200 cm
                    height: 50, // 50% = 100 cm
                    localX: 25, // 25% = 100 cm
                    localY: 10  // 10% = 20 cm
                }
            ]
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: mockWall,
                selectedWallSide: 'front',
                wallDecorRegistry: {
                    wood_panel: { name: 'Teak Wood Panel', thumbnail: 'teak.jpg' }
                },
                railingRegistry: {},
                uiTrigger: 0,
                viewMode: '3d'
            }
        });

        // Card summary should show dual units
        const card = wrapper.find('.pro-mat-list-card');
        expect(card.text()).toContain('50% (200cm) × 50% (100cm)');
        expect(card.text()).toContain('Offset: (100, 20)cm');

        // Open edit inspector
        await card.find('.pro-btn-action.edit').trigger('click');
        const inspector = wrapper.find('.pro-inspector-box');
        expect(inspector.exists()).toBe(true);

        // Check dual unit labels
        expect(inspector.text()).toContain('50% (200 cm)');
        expect(inspector.text()).toContain('50% (100 cm)');
        expect(inspector.text()).toContain('25% (100 cm)');
        expect(inspector.text()).toContain('10% (20 cm)');

        // Check Rotation exists on decor layer
        expect(inspector.text()).toContain('Rotation');

        // Check dual DimensionInput rows exist
        const dualRows = inspector.findAll('.pro-dual-input-row');
        expect(dualRows.length).toBe(4); // Width, Height, Offset X, Offset Y
    });

    it('should step decor thickness, width, height, and offsets with live 3D sync', async () => {
        let updateLiveCalled = false;
        let requestRenderCalled = false;
        window.renderer3D = {
            updateWallDecorLive: (decor) => { updateLiveCalled = true; },
            requestRender: () => { requestRenderCalled = true; }
        };

        const mockWall = {
            id: 'wall-stepper-test',
            type: 'wall',
            thickness: 15,
            height: 200,
            startX: 0,
            startY: 0,
            endX: 400,
            endY: 0,
            params: {},
            attachedDecor: [
                {
                    id: 'decor-step',
                    configId: 'wood_panel',
                    side: 'front',
                    depth: 2.0,
                    tileSize: 70,
                    width: 50,
                    height: 50,
                    localX: 50,
                    localY: 50
                }
            ]
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: mockWall,
                selectedWallSide: 'front',
                wallDecorRegistry: {
                    wood_panel: { name: 'Teak Wood Panel', thumbnail: 'teak.jpg' }
                },
                railingRegistry: {},
                uiTrigger: 0,
                viewMode: '3d'
            }
        });

        // Open edit inspector
        const card = wrapper.find('.pro-mat-list-card');
        await card.find('.pro-btn-action.edit').trigger('click');
        const inspector = wrapper.find('.pro-inspector-box');
        expect(inspector.exists()).toBe(true);

        // Find steppers in inspector
        const steppers = inspector.findAll('.pro-cad-stepper');
        expect(steppers.length).toBeGreaterThanOrEqual(10); // thickness (-/+), w (-/+), h (-/+), x (-/+), y (-/+)

        // Test Thickness step +
        const depthPlusBtn = steppers[1];
        await depthPlusBtn.trigger('click');
        expect(mockWall.attachedDecor[0].depth).toBe(2.1);
        expect(updateLiveCalled).toBe(true);
        expect(requestRenderCalled).toBe(true);

        // Reset spy flags
        updateLiveCalled = false;
        requestRenderCalled = false;

        // Test Width step -
        const widthMinusBtn = steppers[2];
        await widthMinusBtn.trigger('click');
        expect(mockWall.attachedDecor[0].width).toBe(49);
        expect(updateLiveCalled).toBe(true);
        expect(requestRenderCalled).toBe(true);

        // Reset spy flags
        updateLiveCalled = false;
        requestRenderCalled = false;

        // Test Height step +
        const heightPlusBtn = steppers[5];
        await heightPlusBtn.trigger('click');
        expect(mockWall.attachedDecor[0].height).toBe(51);
        expect(updateLiveCalled).toBe(true);
        expect(requestRenderCalled).toBe(true);

        delete window.renderer3D;
    });

    it('should support 1-click CAD alignments (Left, Center, Right, Floor, Mid, Top, Full) in wall inspector', async () => {
        let updateLiveCalled = false;
        window.renderer3D = {
            updateWallDecorLive: () => { updateLiveCalled = true; },
            requestRender: () => {}
        };

        const mockWall = {
            id: 'wall-align-test',
            type: 'wall',
            thickness: 15,
            height: 250,
            startX: 0,
            startY: 0,
            endX: 400,
            endY: 0,
            params: {},
            attachedDecor: [
                {
                    id: 'decor-align',
                    configId: 'wood_panel',
                    side: 'front',
                    depth: 2.0,
                    tileSize: 70,
                    width: 40,
                    height: 60,
                    localX: 20,
                    localY: 30
                }
            ]
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: mockWall,
                selectedWallSide: 'front',
                wallDecorRegistry: { wood_panel: { name: 'Wood Panel', thumbnail: 'wood.jpg' } },
                railingRegistry: {},
                uiTrigger: 0,
                viewMode: '3d'
            }
        });

        // Open edit inspector
        await wrapper.find('.pro-mat-list-card .pro-btn-action.edit').trigger('click');
        const inspector = wrapper.find('.pro-inspector-box');
        expect(inspector.exists()).toBe(true);

        const alignButtons = inspector.findAll('.pro-cad-align-btn');
        expect(alignButtons.length).toBe(7); // Left, Center, Right, Floor, Mid, Top, Full

        const decor = mockWall.attachedDecor[0];

        // 1. Align Left: localX = width / 2 = 20
        await alignButtons[0].trigger('click');
        expect(decor.localX).toBe(20);

        // 2. Align Center: localX = 50
        await alignButtons[1].trigger('click');
        expect(decor.localX).toBe(50);

        // 3. Align Right: localX = 100 - 40 / 2 = 80
        await alignButtons[2].trigger('click');
        expect(decor.localX).toBe(80);

        // 4. Align Floor: localY = height / 2 = 30
        await alignButtons[3].trigger('click');
        expect(decor.localY).toBe(30);

        // 5. Align Mid: localY = 50
        await alignButtons[4].trigger('click');
        expect(decor.localY).toBe(50);

        // 6. Align Top: localY = 100 - 60 / 2 = 70
        await alignButtons[5].trigger('click');
        expect(decor.localY).toBe(70);

        // 7. Full Wall: width=100, height=100, localX=50, localY=50
        await alignButtons[6].trigger('click');
        expect(decor.width).toBe(100);
        expect(decor.height).toBe(100);
        expect(decor.localX).toBe(50);
        expect(decor.localY).toBe(50);

        delete window.renderer3D;
    });

    it('should support Flip H and Flip Face in wall inspector', async () => {
        let updateLiveCalled = false;
        window.renderer3D = {
            updateWallDecorLive: () => { updateLiveCalled = true; },
            requestRender: () => {}
        };

        const mockWall = {
            id: 'wall-flip-test',
            type: 'wall',
            thickness: 15,
            height: 250,
            startX: 0,
            startY: 0,
            endX: 400,
            endY: 0,
            params: {},
            attachedDecor: [
                {
                    id: 'decor-flip',
                    configId: 'wood_panel',
                    side: 'front',
                    depth: 2.0,
                    width: 30,
                    height: 50,
                    localX: 20,
                    localY: 40
                }
            ]
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: mockWall,
                selectedWallSide: 'front',
                wallDecorRegistry: { wood_panel: { name: 'Wood Panel', thumbnail: 'wood.jpg' } },
                railingRegistry: {},
                uiTrigger: 0,
                viewMode: '3d'
            }
        });

        // Open edit inspector
        await wrapper.find('.pro-mat-list-card .pro-btn-action.edit').trigger('click');
        const inspector = wrapper.find('.pro-inspector-box');

        const actionButtons = inspector.findAll('.pro-cad-action-btn');
        expect(actionButtons.length).toBe(2); // Flip H, Flip Face

        const decor = mockWall.attachedDecor[0];

        // 1. Flip H: localX mirrors from 20 to 80
        await actionButtons[0].trigger('click');
        expect(decor.localX).toBe(80);

        // 2. Flip Face: side toggles from 'front' to 'back'
        await actionButtons[1].trigger('click');
        expect(decor.side).toBe('back');

        delete window.renderer3D;
    });

    it('should support switching X and Y reference modes (Left/Right, Floor/Ceiling) in wall inspector', async () => {
        const mockWall = {
            id: 'wall-ref-test',
            type: 'wall',
            thickness: 15,
            height: 200,
            startX: 0,
            startY: 0,
            endX: 400, // length = 400cm
            endY: 0,
            params: {},
            attachedDecor: [
                {
                    id: 'decor-ref',
                    configId: 'wood_panel',
                    side: 'front',
                    width: 50, // 200cm
                    height: 50, // 100cm
                    localX: 25, // flush with left: 25 - 25 = 0%
                    localY: 25  // flush with floor: 25 - 25 = 0%
                }
            ]
        };

        const wrapper = mount(WallPanel, {
            props: {
                selectedEntity: mockWall,
                selectedWallSide: 'front',
                wallDecorRegistry: { wood_panel: { name: 'Wood Panel', thumbnail: 'wood.jpg' } },
                railingRegistry: {},
                uiTrigger: 0,
                viewMode: '3d'
            }
        });

        // Open edit inspector
        await wrapper.find('.pro-mat-list-card .pro-btn-action.edit').trigger('click');
        const inspector = wrapper.find('.pro-inspector-box');

        const refToggles = inspector.findAll('.pro-cad-ref-toggle');
        expect(refToggles.length).toBe(2);

        // Toggle X to Right
        await refToggles[0].trigger('click');
        expect(refToggles[0].text()).toContain('Right');

        // Toggle Y to Top (Ceiling)
        await refToggles[1].trigger('click');
        expect(refToggles[1].text()).toContain('Top');
    });
});


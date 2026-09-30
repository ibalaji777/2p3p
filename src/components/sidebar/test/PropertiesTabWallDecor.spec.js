// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PropertiesTab from '../PropertiesTab.vue';

describe('PropertiesTab: Wall Pattern Layer Dual Unit Controls', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    const mockWall = {
        id: 'wall-1',
        type: 'wall',
        height: 280,
        startX: 0,
        startY: 0,
        endX: 500,
        endY: 0,
        attachedDecor: []
    };

    const mockDecor = {
        id: 'decor-1',
        type: 'wallDecor',
        configId: 'wood_slat',
        side: 'front',
        depth: 3.5,
        tileSize: 60,
        width: 50, // 50% of 500cm = 250cm
        height: 80, // 80% of 280cm = 224cm
        localX: 20, // 20% of 500cm = 100cm
        localY: 10, // 10% of 280cm = 28cm
        faces: { left: true, right: false },
        parentWall: mockWall
    };

    mockWall.attachedDecor.push(mockDecor);

    const mockPlanner = {
        walls: [mockWall]
    };

    const createWrapper = (customDecor = mockDecor, customPlanner = mockPlanner) => {
        return mount(PropertiesTab, {
            props: {
                selectedType: 'wallDecor',
                selectedEntity: customDecor,
                planner: customPlanner,
                wallDecorRegistry: {
                    wood_slat: { name: 'Wood Slat', thumbnail: 'thumb.jpg' }
                },
                viewMode: '3d'
            }
        });
    };

    it('should correctly render all dual-unit badges with percent and calculated cm', () => {
        const wrapper = createWrapper();
        const badges = wrapper.findAll('.decor-val-badge');
        expect(badges.length).toBeGreaterThanOrEqual(7);

        // 1. Tile Size: 60 cm
        expect(badges[0].text()).toContain('60 cm');

        // 2. Rotation: 0°
        expect(badges[1].text()).toContain('0°');

        // 3. Thickness: 3.5 cm
        expect(badges[2].text()).toContain('3.5 cm');

        // 4. Width: 50% (250 cm)
        expect(badges[3].text()).toContain('50% (250 cm)');

        // 5. Height: 80% (224 cm)
        expect(badges[4].text()).toContain('80% (224 cm)');

        // 6. Offset X: 20% (100 cm)
        expect(badges[5].text()).toContain('20% (100 cm)');

        // 7. Offset Y: 10% (28 cm)
        expect(badges[6].text()).toContain('10% (28 cm)');
    });

    it('should update tile size when preset chips or dimension inputs change', async () => {
        const decor = { ...mockDecor, parentWall: mockWall };
        const wrapper = createWrapper(decor);

        const tileChips = wrapper.findAll('.decor-chip.tile-chip');
        expect(tileChips.length).toBe(4); // 50, 70, 100, 150

        await tileChips[2].trigger('click'); // 100cm
        expect(decor.tileSize).toBe(100);
        expect(wrapper.emitted('decor-update')).toBeTruthy();
    });

    it('should update rotation when preset button or slider changes', async () => {
        const decor = { ...mockDecor, parentWall: mockWall };
        const wrapper = createWrapper(decor);

        const rotBtns = wrapper.findAll('.decor-chip.rot-chip');
        expect(rotBtns.length).toBe(5); // 0, 45, 90, 180, 270

        await rotBtns[2].trigger('click'); // 90°
        expect(decor.rotationDeg).toBe(90);
        expect(decor.rotation).toBeCloseTo(Math.PI / 2);
        expect(wrapper.emitted('decor-update')).toBeTruthy();
    });

    it('should update width when physical dimension input changes', async () => {
        const decor = { ...mockDecor, parentWall: mockWall };
        const wrapper = createWrapper(decor);

        // Wall length is 500cm. Changing width to 400cm should set width to 80%
        const widthControl = wrapper.findAll('.decor-dual-control')[3];
        const dimInput = widthControl.findComponent({ name: 'DimensionInput' });
        expect(dimInput.exists()).toBe(true);

        await dimInput.vm.$emit('update:modelValue', 400);

        expect(decor.width).toBe(80);
        expect(wrapper.emitted('decor-update')).toBeTruthy();
        expect(wrapper.emitted('decor-update')[0][0].id).toBe(decor.id);
        expect(wrapper.emitted('decor-update')[0][0].width).toBe(80);
    });

    it('should update height when physical dimension input changes', async () => {
        const decor = { ...mockDecor, parentWall: mockWall };
        const wrapper = createWrapper(decor);

        // Wall height is 280cm. Changing height to 140cm should set height to 50%
        const heightControl = wrapper.findAll('.decor-dual-control')[4];
        const dimInput = heightControl.findComponent({ name: 'DimensionInput' });
        expect(dimInput.exists()).toBe(true);

        await dimInput.vm.$emit('update:modelValue', 140);

        expect(decor.height).toBe(50);
        expect(wrapper.emitted('decor-update')).toBeTruthy();
    });

    it('should update Offset X and Offset Y when physical dimension inputs change', async () => {
        const decor = { ...mockDecor, parentWall: mockWall };
        const wrapper = createWrapper(decor);

        // Wall length is 500cm. Setting Offset X to 250cm -> 50%
        const xControl = wrapper.findAll('.decor-dual-control')[5];
        const xDimInput = xControl.findComponent({ name: 'DimensionInput' });
        await xDimInput.vm.$emit('update:modelValue', 250);
        expect(decor.localX).toBe(50);

        // Wall height is 280cm. Setting Offset Y to 70cm -> 25%
        const yControl = wrapper.findAll('.decor-dual-control')[6];
        const yDimInput = yControl.findComponent({ name: 'DimensionInput' });
        await yDimInput.vm.$emit('update:modelValue', 70);
        expect(decor.localY).toBe(25);
    });

    it('should handle unattached decor gracefully using fallback dimensions', () => {
        const orphanDecor = {
            id: 'orphan-1',
            type: 'wallDecor',
            width: 50,
            height: 50,
            localX: 50,
            localY: 50
        };

        const wrapper = mount(PropertiesTab, {
            props: {
                selectedType: 'wallDecor',
                selectedEntity: orphanDecor,
                planner: { walls: [] },
                wallDecorRegistry: {},
                viewMode: '3d'
            }
        });

        // Default fallbacks are length=100, height=280
        // 50% of 100 = 50cm, 50% of 280 = 140cm
        const badges = wrapper.findAll('.decor-val-badge');
        expect(badges[3].text()).toContain('50% (50 cm)');
        expect(badges[4].text()).toContain('50% (140 cm)');
    });

    it('should increment and decrement width percentage using stepper buttons', async () => {
        const decor = { ...mockDecor, parentWall: mockWall, width: 50 };
        const wrapper = createWrapper(decor);

        const widthControl = wrapper.findAll('.decor-dual-control')[3];
        const steppers = widthControl.findAll('.decor-cad-stepper');
        expect(steppers.length).toBe(2);

        // Click '+' button -> 50% + 1% = 51%
        await steppers[1].trigger('click');
        expect(decor.width).toBe(51);
        expect(wrapper.emitted('decor-update')).toBeTruthy();

        // Click '-' button -> 51% - 1% = 50%
        await steppers[0].trigger('click');
        expect(decor.width).toBe(50);
    });

    it('should update width percentage when typing directly into percentage input', async () => {
        const decor = { ...mockDecor, parentWall: mockWall, width: 50 };
        const wrapper = createWrapper(decor);

        const widthControl = wrapper.findAll('.decor-dual-control')[3];
        const pctInput = widthControl.find('.decor-cad-pct-input');
        expect(pctInput.exists()).toBe(true);

        await pctInput.setValue(75);
        expect(decor.width).toBe(75);
        expect(wrapper.emitted('decor-update')).toBeTruthy();
    });

    it('should increment and decrement thickness using steppers', async () => {
        const decor = { ...mockDecor, parentWall: mockWall, depth: 0.2 };
        const wrapper = createWrapper(decor);

        const thicknessControl = wrapper.findAll('.decor-dual-control')[2];
        const steppers = thicknessControl.findAll('.decor-cad-stepper');
        expect(steppers.length).toBe(2);

        // Click '+' -> 0.2 + 0.1 = 0.3
        await steppers[1].trigger('click');
        expect(decor.depth).toBe(0.3);
        expect(wrapper.emitted('decor-update')).toBeTruthy();

        // Click '-' -> 0.3 - 0.1 = 0.2
        await steppers[0].trigger('click');
        expect(decor.depth).toBe(0.2);
    });

    it('should increment and decrement tile size using steppers', async () => {
        const decor = { ...mockDecor, parentWall: mockWall, tileSize: 70 };
        const wrapper = createWrapper(decor);

        const tileControl = wrapper.findAll('.decor-dual-control')[0];
        const steppers = tileControl.findAll('.decor-cad-stepper');
        expect(steppers.length).toBe(2);

        // Click '+' -> 70 + 5 = 75
        await steppers[1].trigger('click');
        expect(decor.tileSize).toBe(75);
        expect(wrapper.emitted('decor-update')).toBeTruthy();

        // Click '-' -> 75 - 5 = 70
        await steppers[0].trigger('click');
        expect(decor.tileSize).toBe(70);
    });
});

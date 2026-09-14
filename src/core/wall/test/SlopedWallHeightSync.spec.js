import { describe, it, expect } from 'vitest';
import { WallEngine } from '../WallEngine.js';

describe('Sloped & Gable Wall Height Synchronization', () => {
    it('synchronizes single slope wall startHeight and endHeight proportionally when overall height changes', () => {
        const wall = {
            id: 'wall_slope',
            thickness: 20,
            height: 200,
            topProfileType: 'single',
            startHeight: 200,
            endHeight: 300,
            elevation: 0
        };

        // Raise overall height by +50cm (from 200 to 250)
        WallEngine.setHeight(wall, 250, false);

        expect(wall.height).toBe(250);
        expect(wall.startHeight).toBe(250);
        expect(wall.endHeight).toBe(350); // Preserves +100cm slope differential!
    });

    it('synchronizes gable wall startHeight, endHeight, and peakHeight proportionally', () => {
        const wall = {
            id: 'wall_gable',
            thickness: 20,
            height: 200,
            topProfileType: 'gable',
            startHeight: 200,
            endHeight: 200,
            peakHeight: 320,
            elevation: 0
        };

        // Raise overall height by +60cm (from 200 to 260)
        WallEngine.setHeight(wall, 260, false);

        expect(wall.height).toBe(260);
        expect(wall.startHeight).toBe(260);
        expect(wall.endHeight).toBe(260);
        expect(wall.peakHeight).toBe(380); // Preserves +120cm peak differential!
    });

    it('sets uniform startHeight and endHeight on normal walls', () => {
        const wall = {
            id: 'wall_normal',
            thickness: 20,
            height: 200,
            topProfileType: 'normal',
            startHeight: 180,
            endHeight: 180,
            elevation: 0
        };

        WallEngine.setHeight(wall, 300, false);

        expect(wall.height).toBe(300);
        expect(wall.startHeight).toBe(300);
        expect(wall.endHeight).toBe(300);
    });
});

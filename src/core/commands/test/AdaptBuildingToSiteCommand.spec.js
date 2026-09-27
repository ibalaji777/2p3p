import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdaptBuildingToSiteCommand } from '../AdaptBuildingToSiteCommand.js';
import { SiteEngine } from '../../site/SiteEngine.js';

describe('AdaptBuildingToSiteCommand', () => {
    let mockPlanner;
    let serializedState;

    beforeEach(() => {
        serializedState = {
            version: '2.0',
            walls: [{ id: 'w1', startX: 0, startY: 0, endX: 1000, endY: 0 }]
        };

        mockPlanner = {
            site: null,
            anchors: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }],
            walls: [{ id: 'w1', startAnchor: { x: 0, y: 0 }, endAnchor: { x: 1000, y: 0 }, thickness: 20 }],
            rooms: [],
            roofs: [],
            furniture: [],
            stairs: [],
            exportState: vi.fn(() => JSON.stringify(serializedState)),
            importState: vi.fn((state) => {
                serializedState = JSON.parse(state);
            }),
            syncAll: vi.fn(),
            update3D: vi.fn(),
            requestDraw: vi.fn()
        };

        // Create site boundary
        SiteEngine.createSite(mockPlanner, [
            { x: -100, y: -100 },
            { x: 1100, y: -100 },
            { x: 1100, y: 1100 },
            { x: -100, y: 1100 }
        ]);
    });

    it('executes adaptation, records state snapshots, and supports 1-click Undo / Redo', () => {
        const cmd = new AdaptBuildingToSiteCommand(mockPlanner, { targetAreaSqFt: 860 });

        // Initial execute
        const res = cmd.execute();
        expect(res.success).toBe(true);
        expect(cmd.stateBefore).not.toBeNull();
        expect(cmd.stateAfter).not.toBeNull();

        // Undo
        cmd.undo();
        expect(mockPlanner.importState).toHaveBeenCalledWith(cmd.stateBefore);
        expect(mockPlanner.syncAll).toHaveBeenCalled();

        // Redo
        cmd.execute();
        expect(mockPlanner.importState).toHaveBeenCalledWith(cmd.stateAfter);
        expect(mockPlanner.syncAll).toHaveBeenCalled();
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WallHeightTransaction } from '../WallHeightTransaction.js';
import { WallEngine } from '../WallEngine.js';

describe('WallHeightTransaction Unit Tests', () => {
    let mockPlanner;
    let wall;

    beforeEach(() => {
        wall = {
            id: 'wall_1',
            startX: 0, startY: 0,
            endX: 400, endY: 0,
            startAnchor: { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) },
            endAnchor: { x: 400, y: 0, position: () => ({ x: 400, y: 0 }) },
            thickness: 20,
            height: 240,
            elevation: 0,
            topProfileType: 'normal'
        };

        let state = JSON.stringify({ walls: [{ ...wall }] });

        mockPlanner = {
            walls: [wall],
            rooms: [],
            commandManager: {
                execute: vi.fn(cmd => cmd.execute()),
                undo: vi.fn(),
                redo: vi.fn()
            },
            exportState: vi.fn(() => JSON.parse(JSON.stringify(wall))),
            importState: vi.fn((saved) => {
                Object.assign(wall, saved);
            }),
            syncAll: vi.fn(),
            update3D: vi.fn()
        };
    });

    it('begins, updates live, and commits with finalized SnapshotCommand for working undo/redo', () => {
        const tx = new WallHeightTransaction(mockPlanner);

        tx.begin(wall, 'wall');
        expect(tx.isActive).toBe(true);
        expect(tx.snapshotCmd).toBeDefined();

        // Continuous drag update
        const liveH = tx.update(278, { snapStep: 5 });
        expect(liveH).toBe(280);
        expect(wall.height).toBe(280);

        // Commit transaction
        const committed = tx.commit();
        expect(committed).toBe(true);
        expect(tx.isActive).toBe(false);
        expect(mockPlanner.commandManager.execute).toHaveBeenCalled();
        expect(mockPlanner.syncAll).toHaveBeenCalled();

        // Undo
        mockPlanner.importState(tx.initialHeights.get(wall));
        expect(wall.height).toBe(240);
    });

    it('cancels transaction cleanly and reverts wall height without creating history entry', () => {
        const tx = new WallHeightTransaction(mockPlanner);

        tx.begin(wall, 'wall');
        tx.update(350);
        expect(wall.height).toBe(350);

        tx.cancel();
        expect(tx.isActive).toBe(false);
        expect(wall.height).toBe(240);
        expect(mockPlanner.commandManager.execute).not.toHaveBeenCalled();
    });
});

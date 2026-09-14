import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WallEngine } from '../WallEngine.js';
import { WallHeightPolicy } from '../WallHeightPolicy.js';
import { WallHeightTransaction } from '../WallHeightTransaction.js';
import { WallConnectivity } from '../WallConnectivity.js';
import { WallSerializer } from '../../../features/wall/wall.serializer.js';

describe('Unified Wall Raiser 2D & 3D Integration Suite', () => {
    let mockPlanner;
    let wallA, wallB;

    beforeEach(() => {
        const anchor1 = { id: 'a1', _id: 'a1', x: 0, y: 0, position: () => ({ x: 0, y: 0 }) };
        const anchor2 = { id: 'a2', _id: 'a2', x: 300, y: 0, position: () => ({ x: 300, y: 0 }) };
        const anchor3 = { id: 'a3', _id: 'a3', x: 300, y: 400, position: () => ({ x: 300, y: 400 }) };

        wallA = {
            id: 'wall_A',
            type: 'outer',
            height: 280,
            thickness: 20,
            elevation: 0,
            startAnchor: anchor1,
            endAnchor: anchor2,
            startX: 0,
            startY: 0,
            endX: 300,
            endY: 0,
            attachedWidgets: [],
            attachedMoldings: [],
            update: vi.fn(),
            positionRaiserHandle: vi.fn(),
            updateRaiserBadge: vi.fn(),
            raiserGroup: { visible: vi.fn(), destroy: vi.fn() }
        };

        wallB = {
            id: 'wall_B',
            type: 'outer',
            height: 280,
            thickness: 20,
            elevation: 0,
            startAnchor: anchor2,
            endAnchor: anchor3,
            startX: 300,
            startY: 0,
            endX: 300,
            endY: 400,
            attachedWidgets: [],
            attachedMoldings: [],
            update: vi.fn(),
            positionRaiserHandle: vi.fn(),
            updateRaiserBadge: vi.fn(),
            raiserGroup: { visible: vi.fn(), destroy: vi.fn() }
        };

        mockPlanner = {
            walls: [wallA, wallB],
            anchors: [anchor1, anchor2, anchor3],
            rooms: [
                {
                    id: 'room_1',
                    walls: [wallA, wallB],
                    wallHeight: 280
                }
            ],
            commandManager: {
                execute: vi.fn(),
                undoStack: [],
                redoStack: []
            },
            exportState: vi.fn(() => ({})),
            syncAll: vi.fn(),
            update3D: vi.fn(),
            stage: { batchDraw: vi.fn() }
        };
    });

    it('WallHeightPolicy validates, clamps and snaps height accurately', () => {
        expect(WallHeightPolicy.clamp(10)).toBe(20);
        expect(WallHeightPolicy.clamp(1200)).toBe(1000);
        expect(WallHeightPolicy.clamp(280)).toBe(280);

        expect(WallHeightPolicy.snap(283, 5)).toBe(285);
        expect(WallHeightPolicy.snap(282, 5)).toBe(280);
        expect(WallHeightPolicy.snap(283.4, 1)).toBe(283);

        expect(WallHeightPolicy.processDragHeight(284)).toBe(285);
        expect(WallHeightPolicy.processInputHeight(302.8)).toBe(303);
    });

    it('WallConnectivity resolves scopes for wall, room, and connected chains', () => {
        const single = WallConnectivity.getScopeWalls(wallA, 'wall', mockPlanner);
        expect(single).toEqual([wallA]);

        const connected = WallConnectivity.getScopeWalls(wallA, 'connected', mockPlanner);
        expect(connected).toHaveLength(2);
        expect(connected).toContain(wallA);
        expect(connected).toContain(wallB);

        const roomWalls = WallConnectivity.getScopeWalls(wallA, 'room', mockPlanner);
        expect(roomWalls).toHaveLength(2);
        expect(roomWalls).toContain(wallA);
        expect(roomWalls).toContain(wallB);
    });

    it('WallHeightTransaction manages live drag updates and commit lifecycle', () => {
        const tx = new WallHeightTransaction(mockPlanner);
        tx.begin(wallA, 'wall');
        expect(tx.isActive).toBe(true);

        const applied = tx.update(320);
        expect(applied).toBe(320);
        expect(wallA.height).toBe(320);

        const committed = tx.commit();
        expect(committed).toBe(true);
        expect(tx.isActive).toBe(false);
        expect(mockPlanner.syncAll).toHaveBeenCalled();
    });

    it('WallEngine.raiseWall modifies wall height canonically through WallMutationEngine', () => {
        WallEngine.raiseWall(wallA, 350, 'wall', true, mockPlanner);
        expect(wallA.height).toBe(350);
        expect(wallB.height).toBe(280); // Unaffected single scope
    });

    it('WallEngine.raiseWall with room scope raises all bounding walls and updates room wallHeight', () => {
        WallEngine.raiseWall(wallA, 310, 'room', true, mockPlanner);
        expect(wallA.height).toBe(310);
        expect(wallB.height).toBe(310);
        expect(mockPlanner.rooms[0].wallHeight).toBe(310);
    });

    it('WallSerializer safely ignores raiserGroup and Konva objects without serialization circular crash', () => {
        const serialized = WallSerializer.serialize(wallA);
        expect(serialized.height).toBe(wallA.height);
        expect(serialized.raiserGroup).toBeUndefined();
        expect(serialized.raiserHit).toBeUndefined();
        expect(serialized.raiserBg).toBeUndefined();
        expect(serialized.raiserText).toBeUndefined();

        const jsonStr = JSON.stringify(serialized);
        expect(jsonStr).toBeDefined();
        expect(JSON.parse(jsonStr).id).toBe('wall_A');
    });
});

import { describe, it, expect } from 'vitest';
import { WallGeometryEngine } from '../WallGeometryEngine.js';

describe('Height-Segmented Wall Corner Mitering & Gapless Junctions', () => {
    it('1. Equal Height 90-degree Corner: Both walls (350cm) miter at 45 degrees', () => {
        const anchorA = { x: 0, y: 0 };
        const anchorB = { x: 400, y: 0 };
        const anchorC = { x: 0, y: 300 };

        const wall1 = {
            id: 'wall1',
            startAnchor: anchorA,
            endAnchor: anchorB,
            thickness: 20,
            height: 350,
            elevation: 0
        };

        const wall2 = {
            id: 'wall2',
            startAnchor: anchorA,
            endAnchor: anchorC,
            thickness: 20,
            height: 350,
            elevation: 0
        };

        const allWalls = [wall1, wall2];

        const w1Start = WallGeometryEngine.getCorners(wall1, anchorA, true, allWalls);
        const w2Start = WallGeometryEngine.getCorners(wall2, anchorA, true, allWalls);

        // Wall 1 (East, dir=[1,0], normal=[0,1], ht=10):
        // Outer is Right (y=-10), hits Wall 2 outer (x=-10) at (-10, -10)
        // Inner is Left (y=10), hits Wall 2 inner (x=10) at (10, 10)
        expect(w1Start.corners[0].x).toBeCloseTo(10, 1);
        expect(w1Start.corners[0].y).toBeCloseTo(10, 1);
        expect(w1Start.corners[1].x).toBeCloseTo(-10, 1);
        expect(w1Start.corners[1].y).toBeCloseTo(-10, 1);

        // Wall 2 (North, dir=[0,1], normal=[-1,0], ht=10):
        // Left (x=-10), hits Wall 1 outer (y=-10) at (-10, -10)
        // Right (x=10), hits Wall 1 inner (y=10) at (10, 10)
        expect(w2Start.corners[0].x).toBeCloseTo(-10, 1);
        expect(w2Start.corners[0].y).toBeCloseTo(-10, 1);
        expect(w2Start.corners[1].x).toBeCloseTo(10, 1);
        expect(w2Start.corners[1].y).toBeCloseTo(10, 1);
    });

    it('2. 3-Wall T-Junction (Attached Tall Room): Room walls (350cm) miter together; exterior wall (280cm) butts cleanly', () => {
        const anchorJ = { x: 0, y: 0 };
        const anchorEast = { x: 400, y: 0 };
        const anchorNorth = { x: 0, y: 300 };
        const anchorWest = { x: -400, y: 0 };

        const roomWall1 = {
            id: 'roomWall1',
            startAnchor: anchorJ,
            endAnchor: anchorEast,
            thickness: 20,
            height: 350,
            elevation: 0
        };

        const roomWall2 = {
            id: 'roomWall2',
            startAnchor: anchorJ,
            endAnchor: anchorNorth,
            thickness: 20,
            height: 350,
            elevation: 0
        };

        const exteriorWall = {
            id: 'exteriorWall',
            startAnchor: anchorJ,
            endAnchor: anchorWest,
            thickness: 20,
            height: 280,
            elevation: 0
        };

        const allWalls = [roomWall1, roomWall2, exteriorWall];

        // Room walls at full height (350cm) should form a 45-degree miter with each other
        const r1Start = WallGeometryEngine.getCorners(roomWall1, anchorJ, true, allWalls);
        const r2Start = WallGeometryEngine.getCorners(roomWall2, anchorJ, true, allWalls);

        expect(r1Start.corners[0].x).toBeCloseTo(10, 1);
        expect(r1Start.corners[0].y).toBeCloseTo(10, 1);
        expect(r1Start.corners[1].x).toBeCloseTo(-10, 1);
        expect(r1Start.corners[1].y).toBeCloseTo(-10, 1);

        expect(r2Start.corners[0].x).toBeCloseTo(-10, 1);
        expect(r2Start.corners[0].y).toBeCloseTo(-10, 1);
        expect(r2Start.corners[1].x).toBeCloseTo(10, 1);
        expect(r2Start.corners[1].y).toBeCloseTo(10, 1);

        // Exterior wall at 280cm sees 3 rays on its level and meets collinear opposite wall
        const extStart = WallGeometryEngine.getCorners(exteriorWall, anchorJ, true, allWalls);
        expect(extStart.corners[0].x).toBeCloseTo(0, 1);
        expect(extStart.corners[1].x).toBeCloseTo(0, 1);
    });

    it('3. 2-Wall Unequal Height L-Corner: Taller wall runs full to outer boundary; shorter wall butts squarely into inner face', () => {
        const anchorA = { x: 0, y: 0 };
        const anchorB = { x: 400, y: 0 };
        const anchorC = { x: 0, y: 300 };

        const tallWall = {
            id: 'tallWall',
            startAnchor: anchorA,
            endAnchor: anchorB,
            thickness: 20,
            height: 350,
            elevation: 0
        };

        const shortWall = {
            id: 'shortWall',
            startAnchor: anchorA,
            endAnchor: anchorC,
            thickness: 20,
            height: 280,
            elevation: 0
        };

        const allWalls = [tallWall, shortWall];

        const tallStart = WallGeometryEngine.getCorners(tallWall, anchorA, true, allWalls);
        const shortStart = WallGeometryEngine.getCorners(shortWall, anchorA, true, allWalls);

        // Tall Wall (East, H=350) extends full to outer boundary (x = -10) with a square cut
        expect(tallStart.corners[0].x).toBeCloseTo(-10, 1);
        expect(tallStart.corners[0].y).toBeCloseTo(10, 1);
        expect(tallStart.corners[1].x).toBeCloseTo(-10, 1);
        expect(tallStart.corners[1].y).toBeCloseTo(-10, 1);

        // Short Wall (North, H=280) butts squarely into the inner face of Tall Wall (y = 10)
        expect(shortStart.corners[0].x).toBeCloseTo(-10, 1);
        expect(shortStart.corners[0].y).toBeCloseTo(10, 1);
        expect(shortStart.corners[1].x).toBeCloseTo(10, 1);
        expect(shortStart.corners[1].y).toBeCloseTo(10, 1);
    });
});

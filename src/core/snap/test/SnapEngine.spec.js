import { describe, it, expect, beforeEach } from 'vitest';
import { SnapEngine } from '../SnapEngine.js';

describe('SnapEngine: Centralized Snap Service Architecture', () => {
    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Grid Snapping
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Grid Snapping', () => {
        it('snaps 2D coordinates to default 10cm grid', () => {
            const res = SnapEngine.snapToGrid({ x: 23.4, y: 47.8 });
            expect(res.x).toBe(20);
            expect(res.y).toBe(50);
            expect(res.isSnapped).toBe(true);
        });

        it('snaps 3D coordinates (x, y, z) with custom grid size', () => {
            const res = SnapEngine.snapToGrid({ x: 12, y: 34, z: 56 }, 25);
            expect(res.x).toBe(0);
            expect(res.y).toBe(25);
            expect(res.z).toBe(50);
            expect(res.isSnapped).toBe(true);
        });

        it('preserves exact grid points without false snap flag', () => {
            const res = SnapEngine.snapToGrid({ x: 100, y: 200 }, 10);
            expect(res.x).toBe(100);
            expect(res.y).toBe(200);
            expect(res.isSnapped).toBe(false);
        });

        it('handles negative coordinates accurately', () => {
            const res = SnapEngine.snapToGrid({ x: -14.2, y: -28.9 }, 10);
            expect(res.x).toBe(-10);
            expect(res.y).toBe(-30);
            expect(res.isSnapped).toBe(true);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Angle Snapping
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Angle Snapping', () => {
        it('snaps angles within the 3.5° magnetic latch zone to 15° increments', () => {
            // 13.2° is within 1.8° of 15° -> snaps to 15°
            const res1 = SnapEngine.resolveAngle(13.2);
            expect(res1.angle).toBe(15);
            expect(res1.isSnapped).toBe(true);

            // 16.5° is within 1.5° of 15° -> snaps to 15°
            const res2 = SnapEngine.resolveAngle(16.5);
            expect(res2.angle).toBe(15);
            expect(res2.isSnapped).toBe(true);
        });

        it('leaves angles outside the 3.5° magnetic zone unsnapped', () => {
            // 7.5° is 7.5° away from 0° and 15° -> stays 7.5°
            const res = SnapEngine.resolveAngle(7.5);
            expect(res.angle).toBe(7.5);
            expect(res.isSnapped).toBe(false);
        });

        it('forces 45° CAD locking when lock45 (Shift key) is enabled', () => {
            const res = SnapEngine.resolveAngle(35, { lock45: true });
            expect(res.angle).toBe(45);
            expect(res.isSnapped).toBe(true);
        });

        it('supports continuous free rotation when free (Alt key) is enabled', () => {
            const res = SnapEngine.resolveAngle(14.8, { free: true });
            expect(res.angle).toBe(14.8);
            expect(res.isSnapped).toBe(false);
        });

        it('normalizes angles within 0° to 360° range', () => {
            const resNear360 = SnapEngine.resolveAngle(-2); // -2° is 358° (2° away from 360°/0°)
            expect(resNear360.angle).toBe(0); // 360° mod 360 = 0°
            expect(resNear360.isSnapped).toBe(true);

            const resNear345 = SnapEngine.resolveAngle(-12); // -12° is 348° (3° away from 345°)
            expect(resNear345.angle).toBe(345);
            expect(resNear345.isSnapped).toBe(true);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Wall Endpoint & Anchor Snapping
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Wall Endpoint Snapping', () => {
        const mockWalls = [
            {
                id: 'w1',
                startAnchor: { x: 100, y: 100 },
                endAnchor: { x: 300, y: 100 }
            },
            {
                id: 'w2',
                startAnchor: { x: 300, y: 100 },
                endAnchor: { x: 300, y: 400 }
            }
        ];

        it('snaps to nearest wall endpoint within threshold', () => {
            const query = { x: 105, y: 98 };
            const res = SnapEngine.snapToWallEndpoints(query, mockWalls, 20);
            expect(res.isSnapped).toBe(true);
            expect(res.x).toBe(100);
            expect(res.y).toBe(100);
            expect(res.distance).toBeCloseTo(Math.hypot(5, -2));
        });

        it('does not snap if beyond the threshold distance', () => {
            const query = { x: 150, y: 150 };
            const res = SnapEngine.snapToWallEndpoints(query, mockWalls, 20);
            expect(res.isSnapped).toBe(false);
            expect(res.x).toBe(150);
            expect(res.y).toBe(150);
        });

        it('works transparently with 3D (x, z) input coordinates', () => {
            const query3D = { x: 295, z: 102 };
            const res = SnapEngine.snapToWallEndpoints(query3D, mockWalls, 20);
            expect(res.isSnapped).toBe(true);
            expect(res.x).toBe(300);
            expect(res.z).toBe(100);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. Object-to-Object Bounds Snapping (Smart Guides)
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Object-to-Object Bounds Snapping', () => {
        const referenceBoxes = [
            { x: 200, y: 200, width: 100, height: 100 }
        ];

        it('snaps edge-to-edge alignment within threshold', () => {
            // Drag box at x: 203 (center-to-center diff = 3cm < threshold 8cm)
            const dragBox = { x: 203, y: 50, width: 100, height: 100 };
            const res = SnapEngine.snapToObjectBounds(dragBox, referenceBoxes, { threshold: 8 });

            expect(res.isSnappedX).toBe(true);
            expect(res.deltaX).toBe(-3);
            expect(dragBox.x + res.deltaX).toBe(200);
        });

        it('ignores reference boxes outside threshold', () => {
            const dragBox = { x: 373, y: 50, width: 100, height: 100 };
            const res = SnapEngine.snapToObjectBounds(dragBox, referenceBoxes, { threshold: 8 });

            expect(res.isSnappedX).toBe(false);
            expect(res.deltaX).toBe(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. Hierarchical Position Resolution & 2D/3D Parity
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Hierarchical Position Resolution & Parity', () => {
        const mockPlanner = {
            walls: [
                {
                    id: 'wall_north',
                    thickness: 20,
                    startAnchor: { x: 0, y: 200 },
                    endAnchor: { x: 500, y: 200 },
                    startX: 0, startY: 200, endX: 500, endY: 200
                }
            ]
        };

        it('prioritizes endpoint snap over grid snap when endpoint snap is enabled', () => {
            // Point (7, 196) is near anchor (0, 200) within 15cm
            // Grid snap to 10 would produce (10, 200)
            const res = SnapEngine.resolvePosition(
                { x: 7, y: 196 },
                { planner: mockPlanner },
                { enableWallEndpoints: true, enableGridSnap: true, gridSize: 10 }
            );

            expect(res.isSnapped).toBe(true);
            expect(res.snapType).toBe('wall_endpoint');
            expect(res.x).toBe(0);
            expect(res.y).toBe(200);
        });

        it('falls back to grid snap when no wall or object snap matches', () => {
            const res = SnapEngine.resolvePosition(
                { x: 123.4, y: 456.7 },
                { planner: mockPlanner },
                { enableWallEndpoints: false, enableWallSnap: false, enableGridSnap: true, gridSize: 10 }
            );

            expect(res.isSnapped).toBe(true);
            expect(res.snapType).toBe('grid');
            expect(res.x).toBe(120);
            expect(res.y).toBe(460);
        });

        it('guarantees identical planar outputs for 2D (x, y) and 3D (x, z) queries', () => {
            const res2D = SnapEngine.resolvePosition(
                { x: 123.4, y: 456.7 },
                { planner: mockPlanner },
                { enableWallEndpoints: false, enableWallSnap: false, enableGridSnap: true, gridSize: 10 }
            );

            const res3D = SnapEngine.resolvePosition(
                { x: 123.4, z: 456.7, elevation: 15 },
                { planner: mockPlanner },
                { enableWallEndpoints: false, enableWallSnap: false, enableGridSnap: true, gridSize: 10 }
            );

            expect(res2D.x).toBe(res3D.x);
            expect(res2D.y).toBe(res3D.z); // 2D Y matches 3D Z
            expect(res3D.elevation).toBe(15);
            expect(res2D.snapType).toBe(res3D.snapType);
        });
    });
});

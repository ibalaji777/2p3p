import { describe, it, expect } from 'vitest';
import { SnapEngine } from '../SnapEngine.js';
import { WallCollisionEngine } from '../../wall/WallCollisionEngine.js';

describe('WallContourSnap: Wall Outer Contour Snapping & Alignment', () => {
    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Wall Contour Segment Extraction
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Wall Contour Segment Extraction', () => {
        const horizontalWall = {
            id: 'wall_h',
            thickness: 20,
            startX: 0,
            startY: 200,
            endX: 500,
            endY: 200,
            startAnchor: { x: 0, y: 200 },
            endAnchor: { x: 500, y: 200 }
        };

        it('extracts front face, back face, and end caps with correct outward normals', () => {
            const segments = WallCollisionEngine.getWallContourSegments(horizontalWall);
            expect(segments.length).toBeGreaterThanOrEqual(2);

            const frontSeg = segments.find(s => s.side === 'front');
            const backSeg = segments.find(s => s.side === 'back');

            expect(frontSeg).toBeDefined();
            expect(backSeg).toBeDefined();

            // Wall runs along +X: (0, 200) -> (500, 200)
            // Left/Front (+n) normal should point in +Y: (0, 1)
            expect(frontSeg.normal.x).toBeCloseTo(0, 1);
            expect(frontSeg.normal.y).toBeCloseTo(1, 1);
            expect(frontSeg.p1.y).toBeCloseTo(210, 1); // 200 + 20/2

            // Right/Back (-n) normal should point in -Y: (0, -1)
            expect(backSeg.normal.x).toBeCloseTo(0, 1);
            expect(backSeg.normal.y).toBeCloseTo(-1, 1);
            expect(backSeg.p1.y).toBeCloseTo(190, 1); // 200 - 20/2
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Direct Contour Snapping Math
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Direct Contour Snapping Math', () => {
        const wall = {
            id: 'wall_1',
            thickness: 20,
            startX: 0,
            startY: 200,
            endX: 500,
            endY: 200,
            startAnchor: { x: 0, y: 200 },
            endAnchor: { x: 500, y: 200 }
        };

        it('snaps object flush to front face (+n) without penetration or gap', () => {
            // Object: width 80, depth 60, rotation 0
            // Front face is at y = 210.
            // Half-depth is 30.
            // Object placed nearby at y = 250 (gap = 250 - 30 - 210 = 10cm <= snapDistance 20cm)
            const query = { x: 250, y: 250, width: 80, depth: 60, rotation: 0 };
            const res = SnapEngine.snapToWallContour(query, [wall], { snapDistance: 20 });

            expect(res.isSnapped).toBe(true);
            expect(res.snappedWall.id).toBe('wall_1');
            expect(res.snappedSegment.side).toBe('front');

            // Snapped center y should be exactly: face_y (210) + half_depth (30) = 240
            expect(res.y).toBe(240);
            expect(res.x).toBe(250);
        });

        it('snaps object flush to back face (-n) without penetration or gap', () => {
            // Back face is at y = 190.
            // Object placed nearby at y = 150 (gap = 190 - (150 + 30) = 10cm <= snapDistance 20cm)
            const query = { x: 250, y: 150, width: 80, depth: 60, rotation: 0 };
            const res = SnapEngine.snapToWallContour(query, [wall], { snapDistance: 20 });

            expect(res.isSnapped).toBe(true);
            expect(res.snappedWall.id).toBe('wall_1');
            expect(res.snappedSegment.side).toBe('back');

            // Snapped center y should be exactly: face_y (190) - half_depth (30) = 160
            expect(res.y).toBe(160);
            expect(res.x).toBe(250);
        });

        it('auto-aligns object rotation parallel to wall face when within 35° threshold', () => {
            // Object at rotation 18° near horizontal wall (0°)
            const query = { x: 250, y: 245, width: 80, depth: 60, rotation: 18 };
            const res = SnapEngine.snapToWallContour(query, [wall], { snapDistance: 20, enableWallAlign: true });

            expect(res.isSnapped).toBe(true);
            // Snaps rotation to 0°
            expect(res.rotation).toBe(0);
        });

        it('does not snap if beyond the snap distance', () => {
            // Object at y = 300 (gap = 300 - 30 - 210 = 60cm > 20cm)
            const query = { x: 250, y: 300, width: 80, depth: 60, rotation: 0 };
            const res = SnapEngine.snapToWallContour(query, [wall], { snapDistance: 20 });

            expect(res.isSnapped).toBe(false);
            expect(res.y).toBe(300);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Hierarchical Integration & 3D Parity
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Hierarchical Integration & 3D Parity', () => {
        const wall = {
            id: 'wall_1',
            thickness: 20,
            startX: 0,
            startY: 200,
            endX: 500,
            endY: 200,
            startAnchor: { x: 0, y: 200 },
            endAnchor: { x: 500, y: 200 }
        };

        it('resolves contour snap with priority over grid snap', () => {
            // Query (250, 245) with grid snap 50
            // Without contour snap, grid snap to 50 would push to (250, 250)
            // With contour snap, face contact is at (250, 240)
            const res = SnapEngine.resolvePosition(
                { x: 250, y: 245, width: 80, depth: 60 },
                { walls: [wall] },
                { enableWallSnap: true, enableWallContour: true, enableGridSnap: true, gridSize: 50 }
            );

            expect(res.isSnapped).toBe(true);
            expect(res.snapType).toBe('wall_surface');
            expect(res.y).toBe(240);
        });

        it('preserves 3D elevation and maps planar Z coordinates identically to 2D Y', () => {
            const res3D = SnapEngine.resolvePosition(
                { x: 250, z: 245, elevation: 35, width: 80, depth: 60 },
                { walls: [wall] },
                { enableWallSnap: true, enableWallContour: true, enableGridSnap: true, gridSize: 50 }
            );

            expect(res3D.isSnapped).toBe(true);
            expect(res3D.snapType).toBe('wall_surface');
            expect(res3D.z).toBe(240); // 3D Z is planar axis
            expect(res3D.elevation).toBe(35); // 3D Elevation is untouched
            expect(res3D.y).toBe(35); // In 3D, y is elevation
        });
    });
});

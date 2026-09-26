import { describe, it, expect } from 'vitest';
import { WallCollisionEngine } from '../WallCollisionEngine.js';

describe('WallCollisionEngine: Collision & Magnetic Wall Snapping', () => {
    // Standard horizontal wall from (0, 0) to (500, 0) with thickness 20cm
    const horizontalWall = {
        id: 'wall_1',
        startX: 0,
        startY: 0,
        endX: 500,
        endY: 0,
        thickness: 20
    };

    const planner = {
        walls: [horizontalWall]
    };

    it('1. should not alter position when object is far from walls', () => {
        const result = WallCollisionEngine.resolvePlacement({
            x: 250,
            z: 200,
            rotation: 0,
            width: 100,
            depth: 60,
            planner,
            options: { snapDistance: 20 }
        });

        expect(result.x).toBe(250);
        expect(result.z).toBe(200);
        expect(result.isColliding).toBe(false);
        expect(result.isSnapped).toBe(false);
    });

    it('2. should magnetically snap flush against wall face when within snapDistance', () => {
        // Wall centerline is at z=0, thickness=20 (halfThick = 10).
        // Object depth=60, rotation=0 -> halfDepth = 30.
        // Minimum clearance Dmin = 10 + 30 = 40.
        // If object is at z=50 (gap of 10cm, <= snapDistance of 20cm):
        const result = WallCollisionEngine.resolvePlacement({
            x: 250,
            z: 50,
            rotation: 0,
            width: 100,
            depth: 60,
            planner,
            options: { enableWallSnap: true, snapDistance: 20 }
        });

        expect(result.isSnapped).toBe(true);
        expect(result.z).toBe(40); // Snapped flush to front wall face!
        expect(result.x).toBe(250);
    });

    it('3. should prevent penetrating through wall and resolve collision', () => {
        // Object placed at z=15 (inside the wall, since Dmin=40)
        const result = WallCollisionEngine.resolvePlacement({
            x: 250,
            z: 15,
            rotation: 0,
            width: 100,
            depth: 60,
            planner,
            options: { enableCollision: true }
        });

        expect(result.isColliding).toBe(true);
        expect(result.z).toBe(40); // Pushed out flush to wall surface!
    });

    it('4. should push out to back face when object center is on back side of wall', () => {
        // Object at z=-15 (penetrating back face)
        const result = WallCollisionEngine.resolvePlacement({
            x: 250,
            z: -15,
            rotation: 0,
            width: 100,
            depth: 60,
            planner,
            options: { enableCollision: true }
        });

        expect(result.isColliding).toBe(true);
        expect(result.z).toBe(-40); // Pushed out to back face!
    });

    it('5. should auto-align rotation when snapping to wall', () => {
        // Wall angle is 0°. Object is at rotation 15° (close to 0°).
        const result = WallCollisionEngine.resolvePlacement({
            x: 250,
            z: 52,
            rotation: 15,
            width: 100,
            depth: 60,
            planner,
            options: { enableWallSnap: true, enableWallAlign: true, snapDistance: 20 }
        });

        expect(result.isSnapped).toBe(true);
        expect(result.rotation).toBe(0); // Auto-aligned to 0°!
    });

    it('6. should resolve corner pinch between two intersecting walls', () => {
        // Add vertical wall from (0, 0) to (0, 500)
        const verticalWall = {
            id: 'wall_2',
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 500,
            thickness: 20
        };

        const cornerPlanner = {
            walls: [horizontalWall, verticalWall]
        };

        // Object placed at corner (10, 10), penetrating both walls
        const result = WallCollisionEngine.resolvePlacement({
            x: 10,
            z: 10,
            rotation: 0,
            width: 80,
            depth: 80,
            planner: cornerPlanner,
            options: { enableCollision: true }
        });

        // For 80x80 object, halfExtent=40, Dmin = 10 + 40 = 50.
        expect(result.isColliding).toBe(true);
        expect(result.x).toBe(50);
        expect(result.z).toBe(50);
    });

    it('7. should respect enableCollision: false and enableWallSnap: false', () => {
        const result = WallCollisionEngine.resolvePlacement({
            x: 250,
            z: 15,
            rotation: 0,
            width: 100,
            depth: 60,
            planner,
            options: { enableCollision: false, enableWallSnap: false }
        });

        expect(result.isColliding).toBe(false);
        expect(result.isSnapped).toBe(false);
    });

    it('8. should converge into acute corner using corner bisector clamping (Fix 8)', () => {
        // Two walls meeting at (0, 0): Wall 1 along X, Wall 2 at 45 degrees
        const acuteWall1 = {
            id: 'wall_a1',
            startX: 0, startY: 0, endX: 500, endY: 0, thickness: 20
        };
        const acuteWall2 = {
            id: 'wall_a2',
            startX: 0, startY: 0, endX: 353, endY: 353, thickness: 20
        };
        const acutePlanner = { walls: [acuteWall1, acuteWall2] };

        const result = WallCollisionEngine.resolvePlacement({
            x: 20,
            z: 10,
            rotation: 0,
            width: 60,
            depth: 60,
            planner: acutePlanner,
            options: { enableCollision: true }
        });

        expect(result.isColliding).toBe(true);
        // Both x and z should be pushed outward along the bisector away from (0, 0)
        expect(result.x).toBeGreaterThan(30);
        expect(result.z).toBeGreaterThan(30);
    });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { StairHeightDetector, STAIR_PROXIMITY_CONFIG } from '../../../features/stairs/StairHeightDetector.js';

describe('Sims 4 Staircase Height Auto-Detection Engine', () => {
    let mockPlanner;

    beforeEach(() => {
        mockPlanner = {
            walls: [],
            platforms: [],
            levels: [{ elevation: 0, name: 'Ground Floor' }],
            activeLevelIndex: 0
        };
    });

    describe('1. Platform Detection & Auto-Height Adjustment', () => {
        it('auto-detects a 40cm platform and computes 2 ergonomic steps', () => {
            mockPlanner.platforms.push({
                id: 'plat_1',
                name: 'Entry Porch',
                x: 200,
                y: 0,
                width: 150,
                depth: 150,
                elevation: 0,
                height: 40,
                shapeType: 'rect'
            });

            // Stair placed 50cm in front of platform edge (x=200, z=-100)
            const result = StairHeightDetector.detect({
                x: 200,
                z: -100,
                elevation: 0,
                rotation: 0,
                preset: { shape: 'straight', stepDepth: 28, width: 100, totalSteps: 12 },
                planner: mockPlanner,
                isCenterAnchored: true
            });

            expect(result.hasTarget).toBe(true);
            expect(result.targetType).toBe('platform');
            expect(result.targetName).toBe('Entry Porch');
            expect(result.detectedHeight).toBe(40);
            expect(result.optimalSteps).toBe(2);
            expect(result.stepHeight).toBe(20);
        });

        it('auto-detects a 60cm platform and computes 3 steps', () => {
            mockPlanner.platforms.push({
                id: 'plat_2',
                name: 'Living Room Stage',
                x: 0,
                y: 200,
                width: 200,
                depth: 200,
                elevation: 0,
                height: 60,
                shapeType: 'rect'
            });

            const result = StairHeightDetector.detect({
                x: 0,
                z: 80,
                elevation: 0,
                rotation: 0,
                preset: { shape: 'straight', stepDepth: 28 },
                planner: mockPlanner,
                isCenterAnchored: true
            });

            expect(result.hasTarget).toBe(true);
            expect(result.detectedHeight).toBe(60);
            expect(result.optimalSteps).toBe(3);
            expect(result.stepHeight).toBe(20);
        });

        it('supports polygonal platforms with custom vertices', () => {
            mockPlanner.platforms.push({
                id: 'plat_poly',
                name: 'Curved Deck',
                x: 300,
                y: 300,
                shapeType: 'polygon',
                elevation: 0,
                height: 85,
                points: [
                    { x: -100, y: -100 },
                    { x: 100, y: -100 },
                    { x: 100, y: 100 },
                    { x: -100, y: 100 }
                ]
            });

            const result = StairHeightDetector.detect({
                x: 300,
                z: 180,
                elevation: 0,
                rotation: 0,
                preset: { shape: 'straight' },
                planner: mockPlanner,
                isCenterAnchored: true
            });

            expect(result.hasTarget).toBe(true);
            expect(result.detectedHeight).toBe(85);
            expect(result.optimalSteps).toBe(5); // 85 / 17.5 = 4.85 -> 5 steps (17cm riser)
            expect(result.stepHeight).toBe(17);
        });
    });

    describe('2. Wall Proximity & Custom Wall Height Detection', () => {
        it('auto-detects a 120cm half-wall and scales steps accordingly', () => {
            mockPlanner.walls.push({
                id: 'wall_half_1',
                startX: 0,
                startY: 100,
                endX: 300,
                endY: 100,
                height: 120,
                elevation: 0
            });

            // Stair placed at (150, 60), ~40cm away from wall
            const result = StairHeightDetector.detect({
                x: 150,
                z: 60,
                elevation: 0,
                rotation: 0,
                preset: { shape: 'straight' },
                planner: mockPlanner,
                isCenterAnchored: true
            });

            expect(result.hasTarget).toBe(true);
            expect(result.targetType).toBe('wall');
            expect(result.targetName).toBe('Half Wall');
            expect(result.detectedHeight).toBe(120);
            expect(result.optimalSteps).toBe(7); // 120 / 17.5 = 6.85 -> 7 steps
            expect(result.stepHeight).toBeCloseTo(17.14, 1);
        });

        it('auto-detects a full story 300cm wall', () => {
            mockPlanner.walls.push({
                id: 'wall_full_1',
                startX: -200,
                startY: 0,
                endX: 200,
                endY: 0,
                height: 300,
                elevation: 0
            });

            const result = StairHeightDetector.detect({
                x: 0,
                z: -50,
                elevation: 0,
                rotation: 0,
                preset: { shape: 'straight' },
                planner: mockPlanner,
                isCenterAnchored: true
            });

            expect(result.hasTarget).toBe(true);
            expect(result.targetType).toBe('wall');
            expect(result.targetName).toBe('Wall');
            expect(result.detectedHeight).toBe(300);
            expect(result.optimalSteps).toBe(17); // 300 / 17.5 = 17.1 -> 17 steps
            expect(result.stepHeight).toBeCloseTo(17.65, 1);
        });
    });

    describe('3. Multi-Level Height Difference Detection', () => {
        it('detects floor-to-floor elevation difference in multi-story buildings', () => {
            mockPlanner.levels = [
                { elevation: 0, name: 'Ground Floor' },
                { elevation: 320, name: 'First Floor' }
            ];
            mockPlanner.activeLevelIndex = 0;

            const result = StairHeightDetector.getDefaultResult({ shape: 'straight' }, 0, 320);

            expect(result.detectedHeight).toBe(320);
            expect(result.optimalSteps).toBe(18); // 320 / 17.5 = 18.2 -> 18 steps
            expect(result.stepHeight).toBeCloseTo(17.78, 1);
        });
    });

    describe('4. Fallback to Story Height in Open Space', () => {
        it('smoothly defaults to story height (300cm) when placed in free space', () => {
            mockPlanner.walls.push({
                id: 'wall_far',
                startX: -500,
                startY: -500,
                endX: -400,
                endY: -500,
                height: 280
            });

            // Placed at (1000, 1000) - far from any wall
            const result = StairHeightDetector.detect({
                x: 1000,
                z: 1000,
                elevation: 0,
                rotation: 0,
                preset: { shape: 'straight' },
                planner: mockPlanner,
                isCenterAnchored: true
            });

            expect(result.hasTarget).toBe(false);
            expect(result.targetType).toBe('default');
            expect(result.detectedHeight).toBe(280); // Inherits active level wall height
        });
    });

    describe('5. Multi-Flight Shapes (L, U, T) Step Balancing', () => {
        it('correctly splits steps between Flight 1 and Flight 2 for L-shaped stairs', () => {
            const optimal = StairHeightDetector.calculateOptimalSteps(300, 'L');

            expect(optimal.totalSteps).toBe(17);
            expect(optimal.flight1Steps).toBe(9); // ceil(17/2)
            expect(optimal.flight2Steps).toBe(8); // 17 - 9
            expect(optimal.flight1Steps + optimal.flight2Steps).toBe(17);
        });

        it('correctly balances steps for small platform L-shaped stairs', () => {
            const optimal = StairHeightDetector.calculateOptimalSteps(60, 'L');

            expect(optimal.totalSteps).toBe(3);
            expect(optimal.flight1Steps).toBe(2);
            expect(optimal.flight2Steps).toBe(1);
        });
    });

    describe('6. Edge Flush Snapping & Alignment Math', () => {
        it('computes snapped center position and perpendicular alignment when close to edge', () => {
            mockPlanner.platforms.push({
                id: 'plat_snap',
                name: 'Landing Stage',
                x: 0,
                y: 100,
                width: 200,
                depth: 100, // Top edge at y=150, bottom edge at y=50
                elevation: 0,
                height: 60,
                shapeType: 'rect'
            });

            // Stair placed at (0, 35) — 15cm from platform bottom edge at y=50
            const result = StairHeightDetector.detect({
                x: 0,
                z: 35,
                elevation: 0,
                rotation: 0,
                preset: { shape: 'straight', stepDepth: 28, totalSteps: 3 },
                planner: mockPlanner,
                isCenterAnchored: true
            });

            expect(result.hasTarget).toBe(true);
            expect(result.distance).toBeLessThanOrEqual(STAIR_PROXIMITY_CONFIG.EDGE_SNAP_DISTANCE);
            expect(result.snappedPos).not.toBeNull();
            expect(result.snappedPos.x).toBe(0);
        });
    });
});

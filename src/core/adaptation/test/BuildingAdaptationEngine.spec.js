import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildingAdaptationEngine } from '../BuildingAdaptationEngine.js';
import { SiteEngine } from '../../site/SiteEngine.js';

describe('BuildingAdaptationEngine', () => {
    let mockPlanner;

    beforeEach(() => {
        // 750 sq ft building: 500 x 600 units (25 ft x 30 ft)
        const a0 = { x: 100, y: 100 };
        const a1 = { x: 600, y: 100 };
        const a2 = { x: 600, y: 700 };
        const a3 = { x: 100, y: 700 };

        const wallPolyUpdateMock = vi.fn();
        const wallUpdateMock = vi.fn();

        const wall1 = {
            id: 'w1',
            startAnchor: a0,
            endAnchor: a1,
            thickness: 20,
            attachedWidgets: [{ t: 0.5, update: vi.fn() }],
            poly: { update: wallPolyUpdateMock },
            update: wallUpdateMock
        };
        const wall2 = {
            id: 'w2',
            startAnchor: a1,
            endAnchor: a2,
            thickness: 20,
            attachedWidgets: [],
            poly: { update: wallPolyUpdateMock },
            update: wallUpdateMock
        };

        const furnitureUpdateMock = vi.fn();
        const furniturePos = { x: 350, y: 120 }; // Close to wall1 (y=100)
        let fRot = 0;
        const mockFurniture = {
            id: 'f1',
            x: furniturePos.x,
            y: furniturePos.y,
            rotation: fRot,
            group: {
                position: vi.fn((newPos) => {
                    if (newPos) {
                        mockFurniture.x = newPos.x;
                        mockFurniture.y = newPos.y;
                    }
                    return { x: mockFurniture.x, y: mockFurniture.y };
                }),
                rotation: vi.fn((newRot) => {
                    if (newRot !== undefined) fRot = newRot;
                    return fRot;
                })
            },
            update: furnitureUpdateMock
        };

        mockPlanner = {
            site: null,
            anchors: [a0, a1, a2, a3],
            walls: [wall1, wall2],
            rooms: [],
            roofs: [],
            furniture: [mockFurniture],
            stairs: [],
            balconies: [],
            shapes: [],
            syncAll: vi.fn(),
            update3D: vi.fn(),
            requestDraw: vi.fn()
        };

        // Create site boundary matching the 750 sq ft plot with zero setbacks
        SiteEngine.createSite(mockPlanner, [
            { x: 100, y: 100 },
            { x: 600, y: 100 },
            { x: 600, y: 700 },
            { x: 100, y: 700 }
        ], {
            setbacks: { front: 0, right: 0, rear: 0, left: 0 }
        });
    });

    it('adapts building to target 690 sq ft and updates wall polygons and furniture tracking', () => {
        const result = BuildingAdaptationEngine.adapt(mockPlanner, {
            targetAreaSqFt: 690,
            preserveAspectRatio: true,
            sync: true
        });

        expect(result.success).toBe(true);
        expect(result.metrics.adaptedAreaSqFt).toBe(690);

        // Verify wall update was called so walls remain visible in 2D and 3D
        expect(mockPlanner.walls[0].update).toHaveBeenCalled();
        expect(mockPlanner.walls[0].attachedWidgets[0].update).toHaveBeenCalled();

        // Verify furniture was relocated and updated
        expect(mockPlanner.furniture[0].update).toHaveBeenCalled();

        // Verify 2D and 3D sync was triggered
        expect(mockPlanner.syncAll).toHaveBeenCalled();
        expect(mockPlanner.update3D).toHaveBeenCalledWith({
            requiresFullRebuild: true,
            source: 'building_adaptation'
        });
    });
});

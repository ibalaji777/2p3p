import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SiteEngine } from '../SiteEngine.js';

describe('SiteEngine', () => {
    let mockPlanner;

    beforeEach(() => {
        mockPlanner = {
            site: null,
            currentUnit: 'ft',
            rooms: [],
            syncSite2D: vi.fn(),
            requestDraw: vi.fn()
        };
    });

    // 1000 sq ft approx rectangle: 1000 cm x 929 cm (~32.8 ft x 30.5 ft)
    const validSquarePlot = [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 }
    ];

    it('creates a canonical site on planner with defaults', () => {
        const site = SiteEngine.createSite(mockPlanner, validSquarePlot, {
            setbacks: { front: 300, rear: 150, left: 150, right: 150 }
        });

        expect(site).not.toBeNull();
        expect(mockPlanner.site).toBe(site);
        expect(site.vertices.length).toBe(4);
        expect(site.setbacks.front).toBe(300);
        expect(site.setbacks.rear).toBe(150);
        expect(mockPlanner.syncSite2D).toHaveBeenCalled();
        expect(mockPlanner.requestDraw).toHaveBeenCalled();
    });

    it('rejects invalid or self-intersecting plot geometries', () => {
        const bowTiePlot = [
            { x: 0, y: 0 },
            { x: 1000, y: 1000 },
            { x: 1000, y: 0 },
            { x: 0, y: 1000 }
        ];

        const site = SiteEngine.createSite(mockPlanner, bowTiePlot);
        expect(site).toBeNull();
        expect(mockPlanner.site).toBeNull();
    });

    it('updates plot vertices dynamically with normalization', () => {
        SiteEngine.createSite(mockPlanner, validSquarePlot);
        
        // Trapezoid in clockwise order
        const trapezoidCW = [
            { x: 0, y: 0 },
            { x: 0, y: 1000 },
            { x: 800, y: 1000 },
            { x: 1000, y: 0 }
        ];

        const success = SiteEngine.setPlotVertices(mockPlanner, trapezoidCW);
        expect(success).toBe(true);
        expect(mockPlanner.site.vertices.length).toBe(4);
    });

    it('updates setbacks with negative clamp protection', () => {
        SiteEngine.createSite(mockPlanner, validSquarePlot);
        
        SiteEngine.setSetbacks(mockPlanner, {
            front: 400,
            rear: -50, // Should clamp to 0
            left: 200
        });

        expect(mockPlanner.site.setbacks.front).toBe(400);
        expect(mockPlanner.site.setbacks.rear).toBe(0);
        expect(mockPlanner.site.setbacks.left).toBe(200);
        expect(mockPlanner.site.setbacks.right).toBe(100); // Unchanged default
    });

    it('updates orientation and road frontage index with wrapping/clamping', () => {
        SiteEngine.createSite(mockPlanner, validSquarePlot);

        SiteEngine.setOrientation(mockPlanner, 450, 5); // 450 deg -> 90 deg, index 5 -> clamped to 3
        expect(mockPlanner.site.orientation).toBe(90);
        expect(mockPlanner.site.roadFrontageIndex).toBe(3);

        SiteEngine.setOrientation(mockPlanner, -30, 1); // -30 deg -> 330 deg
        expect(mockPlanner.site.orientation).toBe(330);
        expect(mockPlanner.site.roadFrontageIndex).toBe(1);
    });

    it('computes buildable envelope correctly', () => {
        // 1000x1000 with 100cm setbacks all around -> 800x800 envelope
        SiteEngine.createSite(mockPlanner, validSquarePlot, {
            setbacks: { front: 100, rear: 100, left: 100, right: 100 }
        });

        const envelope = SiteEngine.getBuildableEnvelope(mockPlanner);
        expect(envelope).not.toBeNull();
        expect(envelope.length).toBe(4);
        
        // Check bounds approximately (800x800)
        const xs = envelope.map(p => p.x);
        const ys = envelope.map(p => p.y);
        expect(Math.min(...xs)).toBeCloseTo(100, 1);
        expect(Math.max(...xs)).toBeCloseTo(900, 1);
        expect(Math.min(...ys)).toBeCloseTo(100, 1);
        expect(Math.max(...ys)).toBeCloseTo(900, 1);
    });

    it('calculates comprehensive site metrics including coverage ratio', () => {
        // 1000 units x 1000 units = 1,000,000 units² = 2500 sq ft (at 20 units/ft)
        SiteEngine.createSite(mockPlanner, validSquarePlot, {
            setbacks: { front: 100, rear: 100, left: 100, right: 100 }
        });

        // Add mock room: 500 units x 500 units = 250,000 units² = 625 sq ft
        mockPlanner.rooms = [
            {
                path: [
                    { x: 200, y: 200 },
                    { x: 700, y: 200 },
                    { x: 700, y: 700 },
                    { x: 200, y: 700 }
                ]
            }
        ];

        const metrics = SiteEngine.getMetrics(mockPlanner);
        expect(metrics).not.toBeNull();
        expect(metrics.totalAreaSqFt).toBeCloseTo(2500, 1);
        expect(metrics.buildableAreaSqFt).toBeCloseTo(1600, 1); // 800x800 = 640,000 units² = 1600 sq ft
        expect(metrics.buildingAreaSqFt).toBeCloseTo(625, 1); // 250,000 units² = 625 sq ft
        expect(metrics.coveragePercentage).toBeCloseTo(25.0, 1); // ~25% coverage
        expect(metrics.edgeLengths.length).toBe(4);
        expect(metrics.cornerAngles.length).toBe(4);
    });

    it('detects point inclusion for plot and buildable envelope', () => {
        SiteEngine.createSite(mockPlanner, validSquarePlot, {
            setbacks: { front: 100, rear: 100, left: 100, right: 100 }
        });

        // (500, 500) is inside both
        expect(SiteEngine.isInsidePlot(mockPlanner, { x: 500, y: 500 })).toBe(true);
        expect(SiteEngine.isInsideBuildableEnvelope(mockPlanner, { x: 500, y: 500 })).toBe(true);

        // (50, 50) is inside plot but in setback zone (outside envelope)
        expect(SiteEngine.isInsidePlot(mockPlanner, { x: 50, y: 50 })).toBe(true);
        expect(SiteEngine.isInsideBuildableEnvelope(mockPlanner, { x: 50, y: 50 })).toBe(false);

        // (1500, 1500) is outside plot entirely
        expect(SiteEngine.isInsidePlot(mockPlanner, { x: 1500, y: 1500 })).toBe(false);
        expect(SiteEngine.isInsideBuildableEnvelope(mockPlanner, { x: 1500, y: 1500 })).toBe(false);
    });

    it('clears site cleanly', () => {
        SiteEngine.createSite(mockPlanner, validSquarePlot);
        expect(mockPlanner.site).not.toBeNull();

        SiteEngine.clearSite(mockPlanner);
        expect(mockPlanner.site).toBeNull();
        expect(mockPlanner.syncSite2D).toHaveBeenCalledTimes(2);
    });

    it('serializes and deserializes cleanly matching Schema v2.0', () => {
        const site = SiteEngine.createSite(mockPlanner, validSquarePlot, {
            setbacks: { front: 300, rear: 150, left: 150, right: 150 },
            orientation: 45,
            roadFrontageIndex: 0
        });

        const serialized = SiteEngine.serialize(site);
        expect(serialized).not.toBeNull();
        expect(serialized.vertices.length).toBe(4);
        expect(serialized.setbacks.front).toBe(300);
        expect(serialized.orientation).toBe(45);

        const newPlanner = { site: null };
        const deserialized = SiteEngine.deserialize(newPlanner, serialized);
        expect(deserialized).not.toBeNull();
        expect(newPlanner.site).toBe(deserialized);
        expect(deserialized.orientation).toBe(45);
        expect(deserialized.vertices[0].x).toBe(serialized.vertices[0].x);
    });
});

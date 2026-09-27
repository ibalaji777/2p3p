import { describe, it, expect } from 'vitest';
import { FootprintOptimizer } from '../FootprintOptimizer.js';
import { SiteGeometryEngine } from '../../site/SiteGeometryEngine.js';

describe('FootprintOptimizer', () => {
    // 750 sq ft building: 25 ft x 30 ft = 500 units x 600 units
    // Area = 300,000 units^2 = 750 sq ft
    const origBounds750 = {
        minX: 100,
        maxX: 600,
        minY: 100,
        maxY: 700,
        width: 500,
        depth: 600,
        cx: 350,
        cy: 400,
        areaCm2: 300000,
        areaSqFt: 750
    };

    // Envelope for 750 sq ft plot (25 ft x 30 ft) with zero setbacks
    const envelope750 = [
        { x: 100, y: 100 },
        { x: 600, y: 100 },
        { x: 600, y: 700 },
        { x: 100, y: 700 }
    ];

    it('adapts a 750 sq ft building to exactly 690 sq ft when targetAreaSqFt: 690 is requested', () => {
        const result = FootprintOptimizer.optimize(origBounds750, envelope750, {
            targetAreaSqFt: 690,
            preserveAspectRatio: true
        });

        expect(result).not.toBeNull();
        expect(result.adaptedAreaSqFt).toBe(690);

        // Aspect ratio preserved: scaleX should equal scaleY
        expect(result.scaleX).toBeCloseTo(Math.sqrt(690 / 750), 4);
        expect(result.scaleY).toBeCloseTo(Math.sqrt(690 / 750), 4);

        // Building should be centered within envelope
        expect(result.targetCenter.x).toBe(350);
        expect(result.targetCenter.y).toBe(400);

        // Check adapted width and depth
        const expectedW = 500 * Math.sqrt(690 / 750);
        const expectedD = 600 * Math.sqrt(690 / 750);
        expect(result.adaptedWidth).toBeCloseTo(expectedW, 1);
        expect(result.adaptedDepth).toBeCloseTo(expectedD, 1);
    });

    it('does not over-shrink on rectangular envelopes (0 extra shrink iterations)', () => {
        const result = FootprintOptimizer.optimize(origBounds750, envelope750, {
            preserveAspectRatio: true
        });

        expect(result).not.toBeNull();
        // Since original building matches envelope, scale should be 1.0 (not 0.6676)
        expect(result.scaleX).toBeCloseTo(1.0, 3);
        expect(result.scaleY).toBeCloseTo(1.0, 3);
        expect(result.adaptedAreaSqFt).toBe(750);
    });

    it('transforms interior points bilinearly and centers properly', () => {
        const result = FootprintOptimizer.optimize(origBounds750, envelope750, {
            targetAreaSqFt: 690,
            preserveAspectRatio: true
        });

        const centerPt = { x: 350, y: 400 };
        const transformedCenter = result.transformPoint(centerPt);
        expect(transformedCenter.x).toBeCloseTo(350, 1);
        expect(transformedCenter.y).toBeCloseTo(400, 1);

        const tlPt = { x: 100, y: 100 };
        const transformedTL = result.transformPoint(tlPt);
        expect(transformedTL.x).toBe(result.matrix.TL.x);
        expect(transformedTL.y).toBe(result.matrix.TL.y);
    });

    it('aligns front facade to road frontage setback when alignRoadFrontage is true', () => {
        const result = FootprintOptimizer.optimize(origBounds750, envelope750, {
            targetAreaSqFt: 690,
            preserveAspectRatio: true,
            alignRoadFrontage: true,
            roadFrontageIndex: 0
        });

        expect(result).not.toBeNull();
        const expectedD = 600 * Math.sqrt(690 / 750);
        // Road at edge 0 (top/minY): front edge aligned at envMinY (100)
        expect(result.targetCenter.y).toBeCloseTo(100 + expectedD / 2, 4);
    });
});

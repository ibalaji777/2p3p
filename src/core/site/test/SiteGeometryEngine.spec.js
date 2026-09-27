import { describe, it, expect } from 'vitest';
import { SiteGeometryEngine } from '../SiteGeometryEngine.js';

describe('SiteGeometryEngine', () => {
    describe('Area & Unit Conversions', () => {
        it('should compute exact area for a standard 40ft x 25ft (1000 sq ft) rectangular plot', () => {
            // 40 ft = 800 units, 25 ft = 500 units (at 20 units/ft)
            // Area in units² = 800 * 500 = 400,000
            // In sq ft = 1000 sq ft exactly
            const w = 800;
            const h = 500;
            const rect = [
                { x: 0, y: 0 },
                { x: w, y: 0 },
                { x: w, y: h },
                { x: 0, y: h }
            ];

            const areaUnits2 = SiteGeometryEngine.getArea(rect);
            expect(areaUnits2).toBeCloseTo(400000, 1);

            const areaSqFt = SiteGeometryEngine.units2ToSqFt(areaUnits2);
            expect(areaSqFt).toBeCloseTo(1000, 1);
        });

        it('should correctly convert sq ft to cm² and back', () => {
            const sqft = 860;
            const cm2 = SiteGeometryEngine.sqFtToCm2(sqft);
            expect(SiteGeometryEngine.cm2ToSqFt(cm2)).toBeCloseTo(860, 4);
        });
    });

    describe('Orientation & Normalization', () => {
        it('should detect CCW vs CW in screen coordinates and normalize to CCW', () => {
            // In screen coordinates (Y down):
            // (0,0) -> (100,0) -> (100,100) -> (0,100) is CW (positive signed area)
            // (0,0) -> (0,100) -> (100,100) -> (100,0) is CCW (negative signed area)
            const cw = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 }
            ];
            expect(SiteGeometryEngine.isCCW(cw)).toBe(false);

            const ccw = SiteGeometryEngine.normalizeCCW(cw);
            expect(SiteGeometryEngine.isCCW(ccw)).toBe(true);
            expect(ccw.length).toBe(4);
        });
    });

    describe('Edge Lengths and Corner Angles', () => {
        it('should compute exact 4 edge lengths for an irregular quadrilateral', () => {
            const quad = [
                { x: 0, y: 0 },
                { x: 1000, y: 0 },     // Edge 0 = 1000 cm
                { x: 900, y: 600 },    // Edge 1 = hypot(100, 600) ≈ 608.28 cm
                { x: 100, y: 700 }     // Edge 2 = hypot(800, 100) ≈ 806.23 cm
                // Edge 3 = hypot(100, 700) ≈ 707.11 cm back to (0,0)
            ];

            const lengths = SiteGeometryEngine.getEdgeLengths(quad);
            expect(lengths).toHaveLength(4);
            expect(lengths[0]).toBeCloseTo(1000, 1);
            expect(lengths[1]).toBeCloseTo(608.28, 1);
            expect(lengths[2]).toBeCloseTo(806.23, 1);
            expect(lengths[3]).toBeCloseTo(707.11, 1);
        });

        it('should compute exact 90-degree corner angles for a rectangle', () => {
            const rect = [
                { x: 0, y: 0 },
                { x: 1000, y: 0 },
                { x: 1000, y: 800 },
                { x: 0, y: 800 }
            ];
            const angles = SiteGeometryEngine.getCornerAngles(rect);
            expect(angles).toHaveLength(4);
            angles.forEach(ang => {
                expect(ang).toBeCloseTo(90, 0.5);
            });
        });
    });

    describe('Quadrilateral Validation', () => {
        it('should accept a valid 4-vertex quadrilateral', () => {
            const validQuad = [
                { x: 0, y: 0 },
                { x: 1200, y: 0 },
                { x: 1100, y: 800 },
                { x: 50, y: 800 }
            ];
            const res = SiteGeometryEngine.validateQuadrilateral(validQuad);
            expect(res.valid).toBe(true);
        });

        it('should reject a self-intersecting polygon (hourglass shape)', () => {
            const selfIntersecting = [
                { x: 0, y: 0 },
                { x: 1000, y: 800 },
                { x: 1000, y: 0 },
                { x: 0, y: 800 }
            ];
            const res = SiteGeometryEngine.validateQuadrilateral(selfIntersecting);
            expect(res.valid).toBe(false);
            expect(res.error).toContain('self-intersecting');
        });

        it('should reject polygons with fewer or more than 4 vertices', () => {
            expect(SiteGeometryEngine.validateQuadrilateral([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]).valid).toBe(false);
        });

        it('should reject a plot smaller than 100 sq ft', () => {
            const tiny = [
                { x: 0, y: 0 },
                { x: 50, y: 0 },
                { x: 50, y: 50 },
                { x: 0, y: 50 }
            ];
            const res = SiteGeometryEngine.validateQuadrilateral(tiny);
            expect(res.valid).toBe(false);
            expect(res.error).toContain('below minimum required');
        });
    });

    describe('Rigid Quadrilateral Construction', () => {
        it('should construct a rigid 4-sided polygon from 4 sides and a diagonal', () => {
            // Rectangle 1200 x 800 has diagonal = hypot(1200, 800) ≈ 1442.22
            const quad = SiteGeometryEngine.constructFromSidesAndDiagonal({
                sideA: 1200,
                sideB: 800,
                sideC: 1200,
                sideD: 800,
                diagonalAC: Math.hypot(1200, 800)
            });

            expect(quad).not.toBeNull();
            expect(quad).toHaveLength(4);

            const lengths = SiteGeometryEngine.getEdgeLengths(quad);
            expect(lengths[0]).toBeCloseTo(1200, 0.5);
            expect(lengths[1]).toBeCloseTo(800, 0.5);
            expect(lengths[2]).toBeCloseTo(1200, 0.5);
            expect(lengths[3]).toBeCloseTo(800, 0.5);

            const diag = Math.hypot(quad[2].x - quad[0].x, quad[2].y - quad[0].y);
            expect(diag).toBeCloseTo(Math.hypot(1200, 800), 0.5);
        });

        it('should construct an irregular quadrilateral from 4 sides and corner angle A', () => {
            // Trapezoid with corner angle A = 80 degrees
            const quad = SiteGeometryEngine.constructFromSidesAndAngle({
                sideA: 1000,
                sideB: 600,
                sideC: 800,
                sideD: 700,
                angleA: 80
            });

            expect(quad).not.toBeNull();
            expect(quad).toHaveLength(4);

            const lengths = SiteGeometryEngine.getEdgeLengths(quad);
            expect(lengths[0]).toBeCloseTo(1000, 1);
            expect(lengths[1]).toBeCloseTo(600, 1);
            expect(lengths[2]).toBeCloseTo(800, 1);
            expect(lengths[3]).toBeCloseTo(700, 1);
        });
    });

    describe('Buildable Envelope Calculation (Setbacks Inset)', () => {
        it('should calculate exact buildable envelope for a rectangular plot with setbacks', () => {
            // Plot: 1200 x 800 cm (approx 40ft x 26.2ft)
            // Setbacks: Front 300cm, Rear 150cm, Sides 150cm
            // Buildable width: 1200 - 150 - 150 = 900 cm
            // Buildable depth: 800 - 300 - 150 = 350 cm
            const plot = [
                { x: 0, y: 0 },
                { x: 1200, y: 0 },
                { x: 1200, y: 800 },
                { x: 0, y: 800 }
            ];

            const setbacks = { front: 300, rear: 150, left: 150, right: 150 };
            const envelope = SiteGeometryEngine.computeBuildableEnvelope(plot, setbacks);

            expect(envelope).not.toBeNull();
            expect(envelope).toHaveLength(4);

            const lengths = SiteGeometryEngine.getEdgeLengths(envelope);
            expect(lengths[0]).toBeCloseTo(900, 1); // Front edge
            expect(lengths[1]).toBeCloseTo(350, 1); // Right edge
            expect(lengths[2]).toBeCloseTo(900, 1); // Rear edge
            expect(lengths[3]).toBeCloseTo(350, 1); // Left edge

            const envArea = SiteGeometryEngine.getArea(envelope);
            expect(envArea).toBeCloseTo(900 * 350, 1);
        });

        it('should compute a clean buildable envelope for a trapezoidal plot', () => {
            // Trapezoidal plot: wider front (1200 cm), narrower rear (800 cm)
            const trapezoid = [
                { x: 0, y: 0 },
                { x: 1200, y: 0 },
                { x: 1000, y: 800 },
                { x: 200, y: 800 }
            ];

            const setbacks = { front: 200, rear: 100, left: 100, right: 100 };
            const envelope = SiteGeometryEngine.computeBuildableEnvelope(trapezoid, setbacks);

            expect(envelope).not.toBeNull();
            expect(envelope).toHaveLength(4);

            const origArea = SiteGeometryEngine.getArea(trapezoid);
            const envArea = SiteGeometryEngine.getArea(envelope);
            expect(envArea).toBeLessThan(origArea);
            expect(envArea).toBeGreaterThan(0);
        });

        it('should return null when setbacks exceed plot dimensions (collapsed envelope)', () => {
            const plot = [
                { x: 0, y: 0 },
                { x: 500, y: 0 },
                { x: 500, y: 500 },
                { x: 0, y: 500 }
            ];
            // Setbacks front 300 + rear 300 = 600 > 500 cm height!
            const excessiveSetbacks = { front: 300, rear: 300, left: 100, right: 100 };
            const envelope = SiteGeometryEngine.computeBuildableEnvelope(plot, excessiveSetbacks);
            expect(envelope).toBeNull();
        });
    });

    describe('Point in Polygon Query', () => {
        it('should detect if a point lies inside or outside the plot polygon', () => {
            const plot = [
                { x: 0, y: 0 },
                { x: 1000, y: 0 },
                { x: 1000, y: 1000 },
                { x: 0, y: 1000 }
            ];

            expect(SiteGeometryEngine.isPointInsidePolygon({ x: 500, y: 500 }, plot)).toBe(true);
            expect(SiteGeometryEngine.isPointInsidePolygon({ x: -10, y: 500 }, plot)).toBe(false);
            expect(SiteGeometryEngine.isPointInsidePolygon({ x: 1200, y: 500 }, plot)).toBe(false);
        });
    });
});

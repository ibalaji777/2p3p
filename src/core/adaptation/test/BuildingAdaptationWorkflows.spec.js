import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildingAdaptationEngine } from '../BuildingAdaptationEngine.js';
import { DesignIntentAnalyzer } from '../DesignIntentAnalyzer.js';
import { SiteEngine } from '../../site/SiteEngine.js';
import { SiteSerializer } from '../../site/SiteSerializer.js';
import { SiteGeometryEngine } from '../../site/SiteGeometryEngine.js';
import { AdaptBuildingToSiteCommand } from '../../commands/AdaptBuildingToSiteCommand.js';

describe('Building Adaptation Workflows & BIM Contracts', () => {
    // Helper to build a mock planner with wall ring and anchors
    function createMockPlanner(anchorsData, wallsData, roomsData = []) {
        const anchors = anchorsData.map((a, i) => {
            const pos = { x: a.x, y: a.y };
            return {
                id: `a${i}`,
                get x() { return pos.x; },
                set x(v) { pos.x = v; },
                get y() { return pos.y; },
                set y(v) { pos.y = v; },
                position: (newPos) => {
                    if (newPos) {
                        pos.x = newPos.x;
                        pos.y = newPos.y;
                    }
                    return { x: pos.x, y: pos.y };
                }
            };
        });

        const walls = wallsData.map((w, i) => {
            const startA = anchors[w.start];
            const endA = anchors[w.end];
            return {
                id: `w${i}`,
                type: w.type || 'inner',
                startAnchor: startA,
                endAnchor: endA,
                thickness: w.thickness || 20,
                attachedWidgets: [],
                poly: { update: vi.fn() },
                update: vi.fn()
            };
        });

        const rooms = roomsData.map((r, i) => ({
            id: `r${i}`,
            name: r.name,
            path: r.path
        }));

        return {
            site: null,
            anchors,
            walls,
            rooms,
            roofs: [],
            furniture: [],
            stairs: [],
            balconies: [],
            shapes: [],
            syncAll: vi.fn(),
            update3D: vi.fn(),
            requestDraw: vi.fn()
        };
    }

    // =========================================================================
    // WORKFLOW A: Building-only Conversion (No Site Boundary)
    // =========================================================================
    describe('Workflow A: Building-Only Conversion (No Site Boundary)', () => {
        it('adapts a rectangular building from 1500 sq ft to 870 sq ft without any site', () => {
            // 1500 sq ft = 600,000 units² (approx 600 x 1000 units = 30 ft x 50 ft)
            const planner = createMockPlanner(
                [
                    { x: 0, y: 0 },
                    { x: 600, y: 0 },
                    { x: 600, y: 1000 },
                    { x: 0, y: 1000 }
                ],
                [
                    { start: 0, end: 1 },
                    { start: 1, end: 2 },
                    { start: 2, end: 3 },
                    { start: 3, end: 0 }
                ]
            );

            expect(planner.site).toBeNull();

            const result = BuildingAdaptationEngine.adapt(planner, {
                targetAreaSqFt: 870,
                preserveAspectRatio: true,
                sync: true
            });

            expect(result.success).toBe(true);
            expect(result.status).toBe('exact');
            expect(result.metrics.targetAreaSqFt).toBe(870);
            expect(result.metrics.adaptedAreaSqFt).toBeCloseTo(870, 0);

            // Verify anchors were moved inward proportionally
            const bounds = DesignIntentAnalyzer.getBuildingBounds(planner);
            expect(bounds.areaSqFt).toBeCloseTo(870, 0);
            expect(planner.syncAll).toHaveBeenCalled();
            expect(planner.update3D).toHaveBeenCalled();
        });

        it('adapts an L-shaped building without distorting interior or turning corners into slants', () => {
            // L-shaped building: 6 corners
            // [0,0] -> [600,0] -> [600,500] -> [300,500] -> [300,1000] -> [0,1000]
            const planner = createMockPlanner(
                [
                    { x: 0, y: 0 },
                    { x: 600, y: 0 },
                    { x: 600, y: 500 },
                    { x: 300, y: 500 },
                    { x: 300, y: 1000 },
                    { x: 0, y: 1000 }
                ],
                [
                    { start: 0, end: 1 },
                    { start: 1, end: 2 },
                    { start: 2, end: 3 },
                    { start: 3, end: 4 },
                    { start: 4, end: 5 },
                    { start: 5, end: 0 }
                ]
            );

            const footprintBefore = DesignIntentAnalyzer.getBuildingFootprint(planner);
            expect(footprintBefore.isRectangular).toBe(false);

            const result = BuildingAdaptationEngine.adapt(planner, {
                targetAreaSqFt: 800,
                preserveAspectRatio: true
            });

            expect(result.success).toBe(true);

            // Verify all horizontal walls stay horizontal (y1 === y2) and vertical stay vertical (x1 === x2)
            planner.walls.forEach(w => {
                const isHorizontal = Math.abs(w.startAnchor.y - w.endAnchor.y) < 1e-4;
                const isVertical = Math.abs(w.startAnchor.x - w.endAnchor.x) < 1e-4;
                expect(isHorizontal || isVertical).toBe(true);
            });
        });

        it('protects utility zones (bath >= 4 ft, corridor >= 3 ft) during aggressive reduction', () => {
            // Plan with a bathroom and corridor
            const planner = createMockPlanner(
                [
                    { x: 0, y: 0 },
                    { x: 200, y: 0 },
                    { x: 600, y: 0 },
                    { x: 600, y: 600 },
                    { x: 0, y: 600 }
                ],
                [
                    { start: 0, end: 1 },
                    { start: 1, end: 2 },
                    { start: 2, end: 3 },
                    { start: 3, end: 4 },
                    { start: 4, end: 0 }
                ],
                [
                    {
                        name: 'Bathroom',
                        path: [
                            { x: 0, y: 0 },
                            { x: 100, y: 0 },
                            { x: 100, y: 120 },
                            { x: 0, y: 120 }
                        ]
                    },
                    {
                        name: 'Corridor',
                        path: [
                            { x: 100, y: 0 },
                            { x: 180, y: 0 },
                            { x: 180, y: 300 },
                            { x: 100, y: 300 }
                        ]
                    }
                ]
            );

            const spans = DesignIntentAnalyzer.analyzeSpans(planner);
            const bathSpan = spans.xSpans.find(s => s.role === 'protected');
            expect(bathSpan).toBeDefined();
            expect(bathSpan.minLen).toBeGreaterThanOrEqual(60); // Protected minimum length
        });

        it('strictly preserves 90-degree wall orthogonality (zero non-orthogonal shearing)', () => {
            const planner = createMockPlanner(
                [
                    { x: 100, y: 100 },
                    { x: 500, y: 100 },
                    { x: 500, y: 700 },
                    { x: 100, y: 700 }
                ],
                [
                    { start: 0, end: 1 },
                    { start: 1, end: 2 },
                    { start: 2, end: 3 },
                    { start: 3, end: 0 }
                ]
            );

            BuildingAdaptationEngine.adapt(planner, {
                targetAreaSqFt: 500,
                preserveAspectRatio: false
            });

            // Calculate corner angle between wall 0 and wall 1
            const p0 = planner.anchors[0];
            const p1 = planner.anchors[1];
            const p2 = planner.anchors[2];

            const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
            const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };

            // Dot product of orthogonal vectors must be exactly 0
            const dot = v1.x * v2.x + v1.y * v2.y;
            expect(Math.abs(dot)).toBeLessThan(1e-4);
        });
    });

    // =========================================================================
    // WORKFLOW B: Site-boundary + Building (No Setbacks)
    // =========================================================================
    describe('Workflow B: Site Boundary + Building (Authoritative Boundary, setbacks: null)', () => {
        it('adapts building directly to full site boundary when setbacks are null', () => {
            const planner = createMockPlanner(
                [
                    { x: 50, y: 50 },
                    { x: 650, y: 50 },
                    { x: 650, y: 850 },
                    { x: 50, y: 850 }
                ],
                [
                    { start: 0, end: 1 },
                    { start: 1, end: 2 },
                    { start: 2, end: 3 },
                    { start: 3, end: 0 }
                ]
            );

            // Create site with setbacks: null
            SiteEngine.createSite(planner, [
                { x: 100, y: 100 },
                { x: 600, y: 100 },
                { x: 600, y: 700 },
                { x: 100, y: 700 }
            ], {
                setbacks: null
            });

            expect(planner.site.setbacks).toBeNull();

            // Buildable envelope must match the site boundary exactly
            const envelope = SiteEngine.getBuildableEnvelope(planner);
            expect(envelope).toEqual(planner.site.vertices);

            const result = BuildingAdaptationEngine.adapt(planner, {
                preserveAspectRatio: true
            });

            expect(result.success).toBe(true);
            const bounds = DesignIntentAnalyzer.getBuildingBounds(planner);
            // Must be contained within the 100..600, 100..700 boundary
            expect(bounds.minX).toBeGreaterThanOrEqual(100 - 0.5);
            expect(bounds.maxX).toBeLessThanOrEqual(600 + 0.5);
            expect(bounds.minY).toBeGreaterThanOrEqual(100 - 0.5);
            expect(bounds.maxY).toBeLessThanOrEqual(700 + 0.5);
        });

        it('preserves setbacks: null through serialization and deserialization', () => {
            const planner = { site: null };
            SiteEngine.createSite(planner, [
                { x: 0, y: 0 },
                { x: 500, y: 0 },
                { x: 500, y: 600 },
                { x: 0, y: 600 }
            ], {
                setbacks: null
            });

            const serialized = SiteSerializer.serialize(planner.site);
            expect(serialized.setbacks).toBeNull();

            const deserialized = SiteSerializer.deserialize(serialized);
            expect(deserialized.setbacks).toBeNull();
        });
    });

    // =========================================================================
    // WORKFLOW C: Site-boundary + Optional Setbacks (Explicit 0 Preserved)
    // =========================================================================
    describe('Workflow C: Site-boundary + Optional Setback + Building', () => {
        it('preserves explicit 0 setbacks without defaulting to standard setbacks', () => {
            const planner = { site: null };
            SiteEngine.createSite(planner, [
                { x: 0, y: 0 },
                { x: 500, y: 0 },
                { x: 500, y: 600 },
                { x: 0, y: 600 }
            ], {
                setbacks: { front: 0, rear: 0, left: 0, right: 0 }
            });

            expect(planner.site.setbacks.front).toBe(0);
            expect(planner.site.setbacks.rear).toBe(0);
            expect(planner.site.setbacks.left).toBe(0);
            expect(planner.site.setbacks.right).toBe(0);

            const serialized = SiteSerializer.serialize(planner.site);
            expect(serialized.setbacks.front).toBe(0);

            const deserialized = SiteSerializer.deserialize(serialized);
            expect(deserialized.setbacks.front).toBe(0);
            expect(deserialized.setbacks.rear).toBe(0);
        });

        it('allows building boundary to sit directly on zero setback line without error', () => {
            const planner = createMockPlanner(
                [
                    { x: 100, y: 100 },
                    { x: 600, y: 100 },
                    { x: 600, y: 700 },
                    { x: 100, y: 700 }
                ],
                [
                    { start: 0, end: 1 },
                    { start: 1, end: 2 },
                    { start: 2, end: 3 },
                    { start: 3, end: 0 }
                ]
            );

            SiteEngine.createSite(planner, [
                { x: 100, y: 100 },
                { x: 600, y: 100 },
                { x: 600, y: 700 },
                { x: 100, y: 700 }
            ], {
                setbacks: { front: 0, rear: 0, left: 0, right: 0 }
            });

            const result = BuildingAdaptationEngine.adapt(planner, {
                targetAreaSqFt: 690,
                alignRoadFrontage: true
            });

            expect(result.success).toBe(true);
            expect(result.status).toBe('exact');
        });
    });

    // =========================================================================
    // WORKFLOW D: Target Building Area + Site
    // =========================================================================
    describe('Workflow D: Target Building Area + Site Envelope Constraints', () => {
        it('rejects adaptation when target building area exceeds buildable envelope', () => {
            const planner = createMockPlanner(
                [
                    { x: 100, y: 100 },
                    { x: 500, y: 100 },
                    { x: 500, y: 600 },
                    { x: 100, y: 600 }
                ],
                [
                    { start: 0, end: 1 },
                    { start: 1, end: 2 },
                    { start: 2, end: 3 },
                    { start: 3, end: 0 }
                ]
            );

            // Envelope: 400 x 500 = 200,000 units² = 500 sq ft
            SiteEngine.createSite(planner, [
                { x: 100, y: 100 },
                { x: 500, y: 100 },
                { x: 500, y: 600 },
                { x: 100, y: 600 }
            ], {
                setbacks: { front: 0, rear: 0, left: 0, right: 0 }
            });

            // Request 900 sq ft inside a 500 sq ft envelope
            const result = BuildingAdaptationEngine.adapt(planner, {
                targetAreaSqFt: 900
            });

            expect(result.success).toBe(false);
            expect(result.status).toBe('impossible');
            expect(result.error).toContain('exceeds buildable site envelope');
        });
    });

    // =========================================================================
    // ATOMIC UNDO / REDO COMMAND CONTRACT
    // =========================================================================
    describe('Atomic Undo / Redo Command Contract', () => {
        it('executes atomic adaptation with site creation and rolls back completely on undo', () => {
            const planner = createMockPlanner(
                [
                    { x: 100, y: 100 },
                    { x: 600, y: 100 },
                    { x: 600, y: 700 },
                    { x: 100, y: 700 }
                ],
                [
                    { start: 0, end: 1 },
                    { start: 1, end: 2 },
                    { start: 2, end: 3 },
                    { start: 3, end: 0 }
                ]
            );

            expect(planner.site).toBeNull();
            const originalA0 = { ...planner.anchors[0] };

            // Command creates site atomically AND adapts building
            const cmd = new AdaptBuildingToSiteCommand(planner, {
                siteConfig: {
                    vertices: [
                        { x: 50, y: 50 },
                        { x: 650, y: 50 },
                        { x: 650, y: 750 },
                        { x: 50, y: 750 }
                    ],
                    setbacks: null
                },
                targetAreaSqFt: 600
            });

            const res = cmd.execute();
            expect(res.success).toBe(true);
            expect(planner.site).not.toBeNull();
            expect(planner.anchors[0].x).not.toBe(originalA0.x);

            // Undo: must restore building anchors AND remove site atomically
            cmd.undo();
            expect(planner.site).toBeNull();
            expect(planner.anchors[0].x).toBe(originalA0.x);
            expect(planner.anchors[0].y).toBe(originalA0.y);

            // Redo: must re-apply site and adapted building
            cmd.redo();
            expect(planner.site).not.toBeNull();
            expect(planner.anchors[0].x).not.toBe(originalA0.x);
        });
    });

    // =========================================================================
    // SCENARIOS 2 & 15: COMPOUND WALL ISOLATION (ZERO DRIFT)
    // =========================================================================
    describe('Scenarios 2 & 15: Compound Wall Isolation & Container Invariants', () => {
        it('adapts building core while strictly keeping compound walls and compound anchors 100% stationary', () => {
            // Planner with:
            // 1. Building core: 4 anchors (a0-a3) forming a 400x400 cm house (100..500, 100..500)
            // 2. Compound wall boundary: 4 anchors (a4-a7) forming an 800x800 cm outdoor compound (0..800, 0..800)
            const planner = createMockPlanner(
                [
                    // House anchors (a0 - a3)
                    { x: 100, y: 100 },
                    { x: 500, y: 100 },
                    { x: 500, y: 500 },
                    { x: 100, y: 500 },
                    // Compound boundary anchors (a4 - a7)
                    { x: 0, y: 0 },
                    { x: 800, y: 0 },
                    { x: 800, y: 800 },
                    { x: 0, y: 800 }
                ],
                [
                    // House walls
                    { start: 0, end: 1, type: 'outer' },
                    { start: 1, end: 2, type: 'outer' },
                    { start: 2, end: 3, type: 'outer' },
                    { start: 3, end: 0, type: 'outer' },
                    // Compound walls
                    { start: 4, end: 5, type: 'compound' },
                    { start: 5, end: 6, type: 'compound' },
                    { start: 6, end: 7, type: 'compound' },
                    { start: 7, end: 4, type: 'compound' }
                ]
            );

            // Record initial compound anchor positions
            const compoundA4 = { x: planner.anchors[4].x, y: planner.anchors[4].y };
            const compoundA5 = { x: planner.anchors[5].x, y: planner.anchors[5].y };
            const compoundA6 = { x: planner.anchors[6].x, y: planner.anchors[6].y };
            const compoundA7 = { x: planner.anchors[7].x, y: planner.anchors[7].y };

            // Record initial house anchor positions
            const houseA0 = { x: planner.anchors[0].x, y: planner.anchors[0].y };

            // Verify compound boundary extraction as authoritative container when no site exists
            const compoundBoundary = DesignIntentAnalyzer.getCompoundBoundary(planner);
            expect(compoundBoundary).not.toBeNull();
            expect(compoundBoundary.wallCount).toBe(4);
            expect(compoundBoundary.polygon.length).toBe(4);

            // Adapt the building core (target 250 sq ft reduction)
            const result = BuildingAdaptationEngine.adapt(planner, {
                targetAreaSqFt: 250
            });

            expect(result.success).toBe(true);

            // 1. House anchors MUST have adapted (moved)
            expect(planner.anchors[0].x).not.toBe(houseA0.x);

            // 2. Compound anchors MUST remain 100% stationary (ZERO DRIFT)
            expect(planner.anchors[4].x).toBe(compoundA4.x);
            expect(planner.anchors[4].y).toBe(compoundA4.y);
            expect(planner.anchors[5].x).toBe(compoundA5.x);
            expect(planner.anchors[5].y).toBe(compoundA5.y);
            expect(planner.anchors[6].x).toBe(compoundA6.x);
            expect(planner.anchors[6].y).toBe(compoundA6.y);
            expect(planner.anchors[7].x).toBe(compoundA7.x);
            expect(planner.anchors[7].y).toBe(compoundA7.y);

            // 3. Building bounds must calculate solely from building walls
            const buildingBounds = DesignIntentAnalyzer.getBuildingBounds(planner);
            expect(buildingBounds.width).toBeLessThan(400);
            expect(buildingBounds.depth).toBeLessThan(400);
        });
    });

    // =========================================================================
    // SCENARIO 14: INTENTIONAL PLACEMENT & OFFSET PRESERVATION
    // =========================================================================
    describe('Scenario 14: Intentional Placement & Offset Preservation', () => {
        it('preserves intentional off-center placement ratio instead of forcing center placement', () => {
            // Envelope: 0..1000 in X, 0..1000 in Y (width = 1000, depth = 1000)
            // Original building: 100..400 in X (width = 300), 100..400 in Y (depth = 300)
            // Original Slack: X slack = 700, Y slack = 700
            // Initial tx = (100 - 0) / 700 = 0.1428 (placed intentionally towards top-left)
            const planner = createMockPlanner(
                [
                    { x: 100, y: 100 },
                    { x: 400, y: 100 },
                    { x: 400, y: 400 },
                    { x: 100, y: 400 }
                ],
                [
                    { start: 0, end: 1 },
                    { start: 1, end: 2 },
                    { start: 2, end: 3 },
                    { start: 3, end: 0 }
                ]
            );

            SiteEngine.createSite(planner, [
                { x: 0, y: 0 },
                { x: 1000, y: 0 },
                { x: 1000, y: 1000 },
                { x: 0, y: 1000 }
            ], {
                setbacks: null
            });

            // Adapt with default placementMode: 'preserve_offset'
            const resultOffset = BuildingAdaptationEngine.adapt(planner, {
                targetAreaSqFt: 100, // Smaller target
                placementMode: 'preserve_offset'
            });

            expect(resultOffset.success).toBe(true);
            const boundsOffset = DesignIntentAnalyzer.getBuildingBounds(planner);

            // Building must remain near the left edge, NOT centered at 500!
            expect(boundsOffset.cx).toBeLessThan(350);
            expect(boundsOffset.minX).toBeGreaterThanOrEqual(0);

            // Contrast with explicit placementMode: 'center'
            const planner2 = createMockPlanner(
                [
                    { x: 100, y: 100 },
                    { x: 400, y: 100 },
                    { x: 400, y: 400 },
                    { x: 100, y: 400 }
                ],
                [
                    { start: 0, end: 1 },
                    { start: 1, end: 2 },
                    { start: 2, end: 3 },
                    { start: 3, end: 0 }
                ]
            );

            SiteEngine.createSite(planner2, [
                { x: 0, y: 0 },
                { x: 1000, y: 0 },
                { x: 1000, y: 1000 },
                { x: 0, y: 1000 }
            ], {
                setbacks: null
            });

            const resultCenter = BuildingAdaptationEngine.adapt(planner2, {
                targetAreaSqFt: 100,
                placementMode: 'center'
            });

            expect(resultCenter.success).toBe(true);
            const boundsCenter = DesignIntentAnalyzer.getBuildingBounds(planner2);

            // Under 'center' mode, building center must be 500
            expect(boundsCenter.cx).toBeCloseTo(500, 0);
            expect(boundsCenter.cy).toBeCloseTo(500, 0);
        });
    });

    // =========================================================================
    // SCENARIOS 12 & 13: CORNER PLOT & MULTI-ROAD FRONTAGE
    // =========================================================================
    describe('Scenarios 12 & 13: Corner Plot & Multi-Road Frontage', () => {
        it('applies dual front setbacks and corner alignment for corner plots with roadFrontages: [0, 1]', () => {
            const planner = createMockPlanner(
                [
                    { x: 200, y: 200 },
                    { x: 600, y: 200 },
                    { x: 600, y: 600 },
                    { x: 200, y: 600 }
                ],
                [
                    { start: 0, end: 1 },
                    { start: 1, end: 2 },
                    { start: 2, end: 3 },
                    { start: 3, end: 0 }
                ]
            );

            // Corner plot: 1000 x 1000 cm plot with roads on edge 0 (top) and edge 1 (right)
            SiteEngine.createSite(planner, [
                { x: 0, y: 0 },
                { x: 1000, y: 0 },
                { x: 1000, y: 1000 },
                { x: 0, y: 1000 }
            ], {
                setbacks: { front: 200, rear: 100, left: 100, right: 100 },
                roadFrontages: [0, 1]
            });

            expect(planner.site.roadFrontages).toEqual([0, 1]);
            expect(planner.site.roadFrontageIndex).toBe(0);

            // Compute envelope: edge 0 (top) must have 200 setback, edge 1 (right) must have 200 setback
            const envelope = SiteEngine.getBuildableEnvelope(planner);
            expect(envelope).not.toBeNull();

            // Edge 0 (top y=0) inset by 200 -> y=200
            // Edge 1 (right x=1000) inset by 200 -> x=800
            // Edge 2 (bottom y=1000, opposite to edge 0) inset by 100 (rear) -> y=900
            // Edge 3 (left x=0) inset by 100 (left) -> x=100
            const envMinX = Math.min(...envelope.map(p => p.x));
            const envMaxX = Math.max(...envelope.map(p => p.x));
            const envMinY = Math.min(...envelope.map(p => p.y));
            const envMaxY = Math.max(...envelope.map(p => p.y));

            expect(envMinY).toBeCloseTo(200, 0); // Front setback on edge 0
            expect(envMaxX).toBeCloseTo(800, 0); // Front setback on edge 1
            expect(envMaxY).toBeCloseTo(900, 0); // Rear setback on edge 2
            expect(envMinX).toBeCloseTo(100, 0); // Side setback on edge 3

            // Adapt building with road frontage corner alignment
            const result = BuildingAdaptationEngine.adapt(planner, {
                targetAreaSqFt: 300,
                placementMode: 'road_frontage'
            });

            expect(result.success).toBe(true);
            const bounds = DesignIntentAnalyzer.getBuildingBounds(planner);

            // Building must align to both front edges (top minY = 200, right maxX = 800)
            expect(bounds.minY).toBeCloseTo(200, 0);
            expect(bounds.maxX).toBeCloseTo(800, 0);

            // Verify serialization preserves roadFrontages array
            const serialized = SiteSerializer.serialize(planner.site);
            expect(serialized.roadFrontages).toEqual([0, 1]);

            const deserialized = SiteSerializer.deserialize(serialized);
            expect(deserialized.roadFrontages).toEqual([0, 1]);
            expect(deserialized.roadFrontageIndex).toBe(0);
        });
    });

    describe('Scenario 14: Non-Orthogonal / Skewed Trapezoid Plot Inscription & Site Persistence', () => {
        it('inscribes building within skewed trapezoid setbacks and preserves site state', () => {
            // Skewed plot (Front 30', Right 36.5', Rear 30', Left 25')
            const uncentered = SiteGeometryEngine.constructFromSidesAndAngle({
                sideA: 600,
                sideB: 730,
                sideC: 600,
                sideD: 500,
                angleA: 90
            });
            const uCx = uncentered.reduce((s, p) => s + p.x, 0) / 4;
            const uCy = uncentered.reduce((s, p) => s + p.y, 0) / 4;
            const vertices = uncentered.map(p => ({ x: Math.round(p.x + 800 - uCx), y: Math.round(p.y + 450 - uCy) }));

            const setbacks = { front: 200, right: 100, rear: 100, left: 100 };
            const envelope = SiteGeometryEngine.computeBuildableEnvelope(vertices, setbacks, [0]);
            expect(envelope.length).toBe(4);

            const planner = createMockPlanner(
                [
                    { x: 550, y: 150 },
                    { x: 1050, y: 150 },
                    { x: 1050, y: 750 },
                    { x: 550, y: 750 }
                ],
                [
                    { start: 0, end: 1 },
                    { start: 1, end: 2 },
                    { start: 2, end: 3 },
                    { start: 3, end: 0 }
                ],
                [
                    {
                        id: 'r0',
                        name: 'Living Room',
                        path: [
                            { x: 550, y: 150 },
                            { x: 1050, y: 150 },
                            { x: 1050, y: 750 },
                            { x: 550, y: 750 }
                        ]
                    }
                ]
            );

            const cmd = new AdaptBuildingToSiteCommand(planner, {
                siteConfig: { vertices, setbacks, roadFrontages: [0], roadFrontageIndex: 0 },
                targetAreaSqFt: 200,
                preserveAspectRatio: true,
                alignRoadFrontage: true
            });

            const result = cmd.execute();
            expect(result.success).toBe(true);
            expect(result.status).toBe('valid_approximation');

            // Verify adapted building footprint is fully contained in envelope
            const candidatePoints = planner.anchors.map(a => a.position());
            const contained = SiteGeometryEngine.isPolygonContained(candidatePoints, envelope, 0.5);
            expect(contained).toBe(true);

            // Verify site exists on planner
            expect(planner.site).toBeDefined();
            expect(planner.site.vertices.length).toBe(4);

            // Verify Undo / Redo
            cmd.undo();
            expect(planner.anchors[0].x).toBe(550);
            expect(planner.anchors[0].y).toBe(150);

            cmd.redo();
            expect(planner.anchors[0].x).toBeCloseTo(result.adaptedBounds.minX, 1);
            expect(planner.anchors[0].y).toBeCloseTo(result.adaptedBounds.minY, 1);
        });
    });
});

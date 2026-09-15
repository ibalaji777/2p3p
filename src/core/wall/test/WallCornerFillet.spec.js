import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { WallEngine } from '../WallEngine.js';
import { WallGeometryEngine } from '../WallGeometryEngine.js';
import { WallTopologyEngine } from '../WallTopologyEngine.js';

beforeAll(() => {
    if (typeof HTMLCanvasElement !== 'undefined') {
        HTMLCanvasElement.prototype.getContext = () => ({
            clearRect: () => {},
            fillRect: () => {},
            getImageData: () => ({ data: new Uint8ClampedArray(4) }),
            putImageData: () => {},
            createImageData: () => ({ data: new Uint8ClampedArray(4) }),
            setTransform: () => {},
            drawImage: () => {},
            save: () => {},
            fillText: () => {},
            restore: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            stroke: () => {},
            fill: () => {},
            measureText: () => ({ width: 50 }),
            transform: () => {},
            rect: () => {},
            clip: () => {},
        });
    }
});

describe('WallCornerFillet - Modern Curved Wall Corner Architecture', () => {
    let mockPlanner;

    const createMockAnchor = (x, y) => ({
        x, y,
        isCornerApex: false,
        filletData: null,
        position: function(p) {
            if (p) { this.x = p.x; this.y = p.y; return this; }
            return { x: this.x, y: this.y };
        },
        hide: function() { this.hidden = true; },
        show: function() { this.hidden = false; }
    });

    beforeEach(() => {
        const anchors = [];
        const walls = [];

        mockPlanner = {
            walls,
            anchors,
            arcs: [],
            furniture: [],
            stairs: [],
            roofs: [],
            balconies: [],
            shapes: [],
            wallLayer: { add: () => {} },
            uiLayer: { add: () => {}, batchDraw: () => {} },
            mainLayer: { batchDraw: () => {} },
            stage: { batchDraw: () => {} },
            getOrCreateAnchor: (x, y) => {
                let existing = anchors.find(a => Math.hypot(a.x - x, a.y - y) < 1.0);
                if (existing) return existing;
                const newA = createMockAnchor(x, y);
                anchors.push(newA);
                return newA;
            },
            selectEntity: () => {},
            syncAll: () => {},
            findRooms: () => {},
            update3D: () => {}
        };
    });

    it('should correctly detect a 90-degree corner at an anchor', () => {
        const a1 = mockPlanner.getOrCreateAnchor(0, 100);
        const aCorner = mockPlanner.getOrCreateAnchor(100, 100);
        const a3 = mockPlanner.getOrCreateAnchor(100, 200);

        const w1 = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: aCorner });
        const w2 = WallEngine.createWall(mockPlanner, { startAnchor: aCorner, endAnchor: a3 });

        const cornerData = WallEngine.getCornerData(mockPlanner, aCorner);
        expect(cornerData).not.toBeNull();
        expect(cornerData.isCorner).toBe(true);
        expect(cornerData.isFilleted).toBe(false);
        expect(cornerData.angleDeg).toBe(90);
        expect(cornerData.walls).toHaveLength(2);
    });

    it('should fillet a 90-degree corner with radius 40cm and compute exact tangent setback', () => {
        const a1 = mockPlanner.getOrCreateAnchor(0, 100);
        const aCorner = mockPlanner.getOrCreateAnchor(100, 100);
        const a3 = mockPlanner.getOrCreateAnchor(100, 200);

        const w1 = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: aCorner, thickness: 20, height: 280 });
        const w2 = WallEngine.createWall(mockPlanner, { startAnchor: aCorner, endAnchor: a3, thickness: 20, height: 280 });

        // For a 90-deg corner: T = R * tan(45 deg) = R = 40cm
        const result = WallEngine.filletCorner(mockPlanner, aCorner, 40);
        expect(result.success).toBe(true);
        expect(result.radius).toBe(40);
        expect(aCorner.isCornerApex).toBe(true);

        // Wall 1 should now end at (60, 100)
        const pEnd1 = WallGeometryEngine.getAnchorPosition(w1.endAnchor);
        expect(pEnd1.x).toBeCloseTo(60, 1);
        expect(pEnd1.y).toBeCloseTo(100, 1);

        // Wall 2 should now start at (100, 140)
        const pStart2 = WallGeometryEngine.getAnchorPosition(w2.startAnchor);
        expect(pStart2.x).toBeCloseTo(100, 1);
        expect(pStart2.y).toBeCloseTo(140, 1);

        // The arc should be created and in planner.arcs
        expect(mockPlanner.arcs).toHaveLength(1);
        const arc = mockPlanner.arcs[0];
        expect(arc.isCornerFillet).toBe(true);
        expect(arc.walls.length).toBeGreaterThan(0);
    });

    it('should unfillet corner and restore both walls back to original apex anchor', () => {
        const a1 = mockPlanner.getOrCreateAnchor(0, 100);
        const aCorner = mockPlanner.getOrCreateAnchor(100, 100);
        const a3 = mockPlanner.getOrCreateAnchor(100, 200);

        const w1 = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: aCorner });
        const w2 = WallEngine.createWall(mockPlanner, { startAnchor: aCorner, endAnchor: a3 });

        WallEngine.filletCorner(mockPlanner, aCorner, 50);
        expect(mockPlanner.arcs).toHaveLength(1);

        // Unfillet
        const unfilletSuccess = WallEngine.unfilletCorner(mockPlanner, aCorner);
        expect(unfilletSuccess).toBe(true);
        expect(mockPlanner.arcs).toHaveLength(0);

        // Both walls should share aCorner again
        expect(w1.endAnchor).toBe(aCorner);
        expect(w2.startAnchor).toBe(aCorner);
        expect(aCorner.isCornerApex).toBe(false);

        const pEnd1 = WallGeometryEngine.getAnchorPosition(w1.endAnchor);
        expect(pEnd1.x).toBe(100);
        expect(pEnd1.y).toBe(100);
    });

    it('should dynamically update fillet radius via setCornerFilletRadius', () => {
        const a1 = mockPlanner.getOrCreateAnchor(0, 100);
        const aCorner = mockPlanner.getOrCreateAnchor(100, 100);
        const a3 = mockPlanner.getOrCreateAnchor(100, 200);

        const w1 = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: aCorner });
        const w2 = WallEngine.createWall(mockPlanner, { startAnchor: aCorner, endAnchor: a3 });

        WallEngine.filletCorner(mockPlanner, aCorner, 30);
        expect(WallGeometryEngine.getAnchorPosition(w1.endAnchor).x).toBeCloseTo(70, 1);

        // Update to radius 60
        WallEngine.setCornerFilletRadius(mockPlanner, aCorner, 60);
        expect(WallGeometryEngine.getAnchorPosition(w1.endAnchor).x).toBeCloseTo(40, 1);
        expect(WallGeometryEngine.getAnchorPosition(w2.startAnchor).y).toBeCloseTo(160, 1);
    });

    it('should clamp radius gracefully if requested radius is larger than walls', () => {
        const a1 = mockPlanner.getOrCreateAnchor(0, 100);
        const aCorner = mockPlanner.getOrCreateAnchor(50, 100); // length 50cm
        const a3 = mockPlanner.getOrCreateAnchor(50, 150); // length 50cm

        const w1 = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: aCorner });
        const w2 = WallEngine.createWall(mockPlanner, { startAnchor: aCorner, endAnchor: a3 });

        // Requesting 100cm radius on 50cm walls should clamp T <= 50 * 0.85 = 42.5cm
        const result = WallEngine.filletCorner(mockPlanner, aCorner, 100);
        expect(result.success).toBe(true);
        expect(result.radius).toBeLessThan(50);
        expect(WallGeometryEngine.getAnchorPosition(w1.endAnchor).x).toBeGreaterThan(0);
    });

    it('should seamlessly adjust radius when filletCorner is called on an already filleted corner', () => {
        const a1 = mockPlanner.getOrCreateAnchor(0, 100);
        const aCorner = mockPlanner.getOrCreateAnchor(100, 100);
        const a3 = mockPlanner.getOrCreateAnchor(100, 200);

        WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: aCorner });
        WallEngine.createWall(mockPlanner, { startAnchor: aCorner, endAnchor: a3 });

        // First fillet with radius 40
        const res1 = WallEngine.filletCorner(mockPlanner, aCorner, 40);
        expect(res1.success).toBe(true);
        expect(res1.radius).toBe(40);

        // Call filletCorner again with radius 60 on the apex anchor
        const res2 = WallEngine.filletCorner(mockPlanner, aCorner, 60);
        expect(res2.success).toBe(true);
        expect(res2.radius).toBe(60);

        // Call filletCorner on one of the tangent anchors (e.g. res2.a1)
        const res3 = WallEngine.filletCorner(mockPlanner, res2.a1, 80);
        expect(res3.success).toBe(true);
        expect(res3.radius).toBe(80);
    });

    it('should clean up 3D meshes of arc walls on unfillet', () => {
        const a1 = mockPlanner.getOrCreateAnchor(0, 100);
        const aCorner = mockPlanner.getOrCreateAnchor(100, 100);
        const a3 = mockPlanner.getOrCreateAnchor(100, 200);

        WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: aCorner });
        WallEngine.createWall(mockPlanner, { startAnchor: aCorner, endAnchor: a3 });

        const res = WallEngine.filletCorner(mockPlanner, aCorner, 50);
        expect(res.success).toBe(true);
        const arc = res.arc;
        expect(arc.walls.length).toBeGreaterThan(0);

        // Mock 3D meshes on arc walls
        const mockParent = { remove: vi.fn() };
        arc.walls.forEach(w => {
            w.mesh3D = { parent: mockParent, traverse: vi.fn() };
        });

        const unfilletOk = WallEngine.unfilletCorner(mockPlanner, aCorner);
        expect(unfilletOk).toBe(true);
        expect(mockParent.remove).toHaveBeenCalledTimes(arc.walls.length);
        arc.walls.forEach(w => {
            expect(w.mesh3D).toBeNull();
        });
    });
});

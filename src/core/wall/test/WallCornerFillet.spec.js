import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { Anchor } from '../../engine2d/Anchor.js';
import { AllWallCornersGizmo } from '../../engine3d/AllWallCornersGizmo.js';
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

        const mockContainer = { style: { cursor: 'default' } };
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
            stage: { batchDraw: () => {}, container: () => mockContainer, isDragging: () => false },
            getOrCreateAnchor: (x, y) => {
                let existing = anchors.find(a => Math.hypot(a.x - x, a.y - y) < 1.0);
                if (existing) return existing;
                const newA = createMockAnchor(x, y);
                anchors.push(newA);
                return newA;
            },
            selectEntity: vi.fn((entity, type) => {
                mockPlanner.selectedEntity = entity;
                mockPlanner.selectedType = type;
            }),
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
        const segmentWalls = [...arc.walls];
        const numSegments = segmentWalls.length;
        segmentWalls.forEach(w => {
            w.mesh3D = { parent: mockParent, traverse: vi.fn() };
        });

        const unfilletOk = WallEngine.unfilletCorner(mockPlanner, aCorner);
        expect(unfilletOk).toBe(true);
        expect(mockParent.remove).toHaveBeenCalledTimes(numSegments);
        segmentWalls.forEach(w => {
            expect(w.mesh3D).toBeNull();
        });
    });

    describe('Wall Corner Hover & Selection Mechanics', () => {
        it('should change cursor to pointer and highlight inner circle on 2D mouseenter', () => {
            const anchor = new Anchor(mockPlanner, 100, 100);
            expect(anchor.innerCircle.fill()).toBe('#111827');

            // Simulate mouseenter in select mode
            mockPlanner.tool = 'select';
            anchor.node.fire('mouseenter');

            expect(anchor.innerCircle.fill()).toBe('#0284c7');
            expect(anchor.innerCircle.stroke()).toBe('#38bdf8');
            expect(anchor.innerCircle.strokeWidth()).toBe(3);
            expect(mockPlanner.stage.container().style.cursor).toBe('pointer');

            // Simulate mouseleave
            anchor.node.fire('mouseleave');
            expect(anchor.innerCircle.fill()).toBe('#111827');
            expect(anchor.innerCircle.stroke()).toBe('white');
            expect(anchor.innerCircle.strokeWidth()).toBe(2);
            expect(mockPlanner.stage.container().style.cursor).toBe('grab');
        });

        it('should allow selection and hover when planner tool is "corner"', () => {
            mockPlanner.tool = 'corner';
            const anchor = new Anchor(mockPlanner, 100, 100);

            // Hover in corner mode
            anchor.node.fire('mouseenter');
            expect(anchor.innerCircle.fill()).toBe('#0284c7');
            expect(mockPlanner.stage.container().style.cursor).toBe('pointer');

            // Click in corner mode
            anchor.node.fire('click', { cancelBubble: false });
            expect(mockPlanner.selectEntity).toHaveBeenCalledWith(anchor, 'anchor');
            expect(mockPlanner.selectedEntity).toBe(anchor);
        });

        it('should only show fillet handle on the actively selected anchor', () => {
            const a1 = new Anchor(mockPlanner, 0, 0);
            const a2 = new Anchor(mockPlanner, 200, 0);
            const a3 = new Anchor(mockPlanner, 200, 200);
            mockPlanner.anchors.push(a1, a2, a3);

            const w1 = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: a2 });
            const w2 = WallEngine.createWall(mockPlanner, { startAnchor: a2, endAnchor: a3 });

            // Select a2
            mockPlanner.selectedEntity = a2;
            a2.setHighlight(true);
            expect(a2.filletGroup.visible()).toBe(true);

            // Unselected a1 should not show fillet handle even if highlighted in corner batch
            mockPlanner.selectedEntity = a2;
            a1.setHighlight(true);
            expect(a1.filletGroup.visible()).toBe(false);
        });

        it('should build interactive corner handles in AllWallCornersGizmo in 3D', () => {
            const domElement = {
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                style: { cursor: '' }
            };

            const a1 = { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) };
            const a2 = { x: 200, y: 0, position: () => ({ x: 200, y: 0 }) };
            const a3 = { x: 200, y: 200, position: () => ({ x: 200, y: 200 }) };

            const w1 = { startAnchor: a1, endAnchor: a2, startX: 0, startY: 0, endX: 200, endY: 0, height: 120, elevation: 0, thickness: 20 };
            const w2 = { startAnchor: a2, endAnchor: a3, startX: 200, startY: 0, endX: 200, endY: 200, height: 120, elevation: 0, thickness: 20 };

            mockPlanner.anchors = [a1, a2, a3];
            mockPlanner.walls = [w1, w2];

            const ctx = {
                renderer: { domElement },
                camera: new THREE.PerspectiveCamera(),
                planner: mockPlanner,
                requestRender: vi.fn(),
                interactions: {
                    commonController: { setSelection: vi.fn() },
                    selectObject: vi.fn()
                },
                onEntitySelect: vi.fn()
            };

            const gizmo = new AllWallCornersGizmo(ctx);
            gizmo.show(true);

            expect(gizmo.interactiveMeshes.length).toBeGreaterThan(0);

            // Verify a2 (corner) has hit handles
            const cornerHandles = gizmo.interactiveMeshes.filter(m => m.userData?.anchor === a2);
            expect(cornerHandles.length).toBe(2);

            gizmo.destroy();
        });
    });
});

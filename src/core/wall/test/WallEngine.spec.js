import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { WallEngine } from '../WallEngine.js';
import { WallGeometryEngine } from '../WallGeometryEngine.js';
import { WallTopologyEngine } from '../WallTopologyEngine.js';
import { WallMutationEngine } from '../WallMutationEngine.js';

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

describe('WallEngine - Single Source of Truth Architecture', () => {
    let mockPlanner;

    beforeEach(() => {
        const anchors = [];
        const walls = [];

        mockPlanner = {
            walls,
            anchors,
            furniture: [],
            stairs: [],
            roofs: [],
            balconies: [],
            arcs: [],
            shapes: [],
            wallLayer: { add: () => {} },
            uiLayer: { add: () => {}, batchDraw: () => {} },
            mainLayer: { batchDraw: () => {} },
            stage: { batchDraw: () => {} },
            getOrCreateAnchor: (x, y) => {
                let existing = anchors.find(a => Math.hypot(a.x - x, a.y - y) < 2.0);
                if (existing) return existing;
                const newA = {
                    x, y,
                    position: function(p) {
                        if (p) { this.x = p.x; this.y = p.y; return this; }
                        return { x: this.x, y: this.y };
                    }
                };
                anchors.push(newA);
                return newA;
            },
            selectEntity: () => {},
            formatLength: (len) => `${Math.round(len)} cm`,
            syncAll: function() {
                WallEngine.sync(this);
            }
        };
    });

    describe('1. Canonical Geometry Authority (WallGeometryEngine)', () => {
        it('calculates length, angle, direction, and normal accurately', () => {
            const a1 = { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) };
            const a2 = { x: 100, y: 0, position: () => ({ x: 100, y: 0 }) };
            const wall = { startAnchor: a1, endAnchor: a2, thickness: 20 };

            expect(WallEngine.getLength(wall)).toBe(100);
            expect(WallEngine.getAngle(wall)).toBe(0);
            expect(WallEngine.getDirection(wall)).toEqual({ x: 1, y: 0 });
            expect(WallEngine.getNormal(wall)).toEqual({ x: -0, y: 1 });
        });

        it('solves 90-degree corner miters correctly for 2 intersecting walls', () => {
            const corner = { x: 100, y: 100, position: () => ({ x: 100, y: 100 }) };
            const a1 = { x: 0, y: 100, position: () => ({ x: 0, y: 100 }) };
            const a2 = { x: 100, y: 200, position: () => ({ x: 100, y: 200 }) };

            const w1 = { startAnchor: a1, endAnchor: corner, thickness: 20 };
            const w2 = { startAnchor: corner, endAnchor: a2, thickness: 20 };
            const allWalls = [w1, w2];

            const endCorners1 = WallEngine.getCorners(w1, corner, false, allWalls);
            const startCorners2 = WallEngine.getCorners(w2, corner, true, allWalls);

            expect(endCorners1.corners).toBeDefined();
            expect(startCorners2.corners).toBeDefined();
            expect(endCorners1.hasCap).toBe(false);
            expect(startCorners2.hasCap).toBe(false);
        });

        it('handles acute angle corner joints cleanly with bevels and aligned frontVerts/backVerts', () => {
            // Wall 1 from (200, 0) to (0, 0), Wall 2 from (0, 0) to (200, 30) meeting at an acute angle (~8.5 degrees)
            const corner = { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) };
            const a1 = { x: 200, y: 0, position: () => ({ x: 200, y: 0 }) };
            const a2 = { x: 200, y: 30, position: () => ({ x: 200, y: 30 }) };

            const w1 = { startAnchor: a1, endAnchor: corner, thickness: 20, attachedWidgets: [] };
            const w2 = { startAnchor: corner, endAnchor: a2, thickness: 20, attachedWidgets: [] };
            const allWalls = [w1, w2];

            WallEngine.recalculateGeometry(w1, allWalls);
            WallEngine.recalculateGeometry(w2, allWalls);

            expect(w1.wallShapeData).toBeDefined();
            expect(w2.wallShapeData).toBeDefined();

            // frontVerts and backVerts must start and end at startL, endL, endR, startR
            expect(w1.wallShapeData.frontVerts[0]).toEqual({ x: w1.wallShapeData.startL.x, y: w1.wallShapeData.startL.y });
            expect(w1.wallShapeData.frontVerts[w1.wallShapeData.frontVerts.length - 1]).toEqual({ x: w1.wallShapeData.endL.x, y: w1.wallShapeData.endL.y });
            expect(w1.wallShapeData.backVerts[0]).toEqual({ x: w1.wallShapeData.endR.x, y: w1.wallShapeData.endR.y });
            expect(w1.wallShapeData.backVerts[w1.wallShapeData.backVerts.length - 1]).toEqual({ x: w1.wallShapeData.startR.x, y: w1.wallShapeData.startR.y });

            expect(w2.wallShapeData.frontVerts[0]).toEqual({ x: w2.wallShapeData.startL.x, y: w2.wallShapeData.startL.y });
            expect(w2.wallShapeData.frontVerts[w2.wallShapeData.frontVerts.length - 1]).toEqual({ x: w2.wallShapeData.endL.x, y: w2.wallShapeData.endL.y });
            expect(w2.wallShapeData.backVerts[0]).toEqual({ x: w2.wallShapeData.endR.x, y: w2.wallShapeData.endR.y });
            expect(w2.wallShapeData.backVerts[w2.wallShapeData.backVerts.length - 1]).toEqual({ x: w2.wallShapeData.startR.x, y: w2.wallShapeData.startR.y });
        });

        it('retains flush square seam for collinear through-walls meeting a 3-way T-junction', () => {
            const joint = { x: 100, y: 100, position: () => ({ x: 100, y: 100 }) };
            const west = { x: 0, y: 100, position: () => ({ x: 0, y: 100 }) };
            const east = { x: 200, y: 100, position: () => ({ x: 200, y: 100 }) };
            const north = { x: 100, y: 0, position: () => ({ x: 100, y: 0 }) };

            const wWest = { startAnchor: west, endAnchor: joint, thickness: 20 };
            const wEast = { startAnchor: joint, endAnchor: east, thickness: 20 };
            const wBranch = { startAnchor: north, endAnchor: joint, thickness: 20 };
            const allWalls = [wWest, wEast, wBranch];

            const throughCorners = WallEngine.getCorners(wWest, joint, false, allWalls);
            expect(throughCorners.corners[0].x).toBe(100);
            expect(throughCorners.corners[1].x).toBe(100);
            expect(throughCorners.corners[0].y).toBe(110);
            expect(throughCorners.corners[1].y).toBe(90);
        });

        it('extracts canonical aperture voids cleanly', () => {
            const a1 = { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) };
            const a2 = { x: 200, y: 0, position: () => ({ x: 200, y: 0 }) };
            const wall = {
                startAnchor: a1,
                endAnchor: a2,
                thickness: 20,
                attachedWidgets: [
                    { id: 'door_1', type: 'door', t: 0.5, width: 90, height: 210, elevation: 0 }
                ]
            };

            const voids = WallEngine.getApertureVoids(wall);
            expect(voids.length).toBe(1);
            expect(voids[0].isDoor).toBe(true);
            expect(voids[0].centerLocalX).toBe(100);
            expect(voids[0].startX).toBe(55);
            expect(voids[0].endX).toBe(145);
        });
    });

    describe('2. Canonical Topology Authority (WallTopologyEngine)', () => {
        it('creates a 4-wall rectangular room box sharing 4 corner anchors', () => {
            const walls = WallEngine.createRoomBox(mockPlanner, {
                minX: 0, minY: 0, maxX: 200, maxY: 150, thickness: 16, height: 120
            });

            expect(walls.length).toBe(4);
            expect(mockPlanner.walls.length).toBe(4);
            expect(mockPlanner.anchors.length).toBe(4);

            expect(walls[0].endAnchor).toBe(walls[1].startAnchor);
            expect(walls[1].endAnchor).toBe(walls[2].startAnchor);
            expect(walls[2].endAnchor).toBe(walls[3].startAnchor);
            expect(walls[3].endAnchor).toBe(walls[0].startAnchor);
        });

        it('splits a wall into two connected segments and transfers attached widgets', () => {
            const a1 = mockPlanner.getOrCreateAnchor(0, 0);
            const a2 = mockPlanner.getOrCreateAnchor(200, 0);
            const wall = WallEngine.createWall(mockPlanner, {
                startAnchor: a1, endAnchor: a2, thickness: 20, height: 120
            });

            const widget = { id: 'win_1', type: 'window', t: 0.75, width: 60 };
            wall.attachedWidgets = [widget];

            const [w1, w2] = WallEngine.splitWall(mockPlanner, wall, { x: 100, y: 0 });

            expect(w1.startAnchor.x).toBe(0);
            expect(w1.endAnchor.x).toBe(100);
            expect(w2.startAnchor.x).toBe(100);
            expect(w2.endAnchor.x).toBe(200);

            expect(w1.attachedWidgets.length).toBe(0);
            expect(w2.attachedWidgets.length).toBe(1);
            expect(w2.attachedWidgets[0].t).toBeCloseTo(0.5, 2);
        });

        it('merges two collinear adjacent walls sharing an anchor into one', () => {
            const a1 = mockPlanner.getOrCreateAnchor(0, 0);
            const aMid = mockPlanner.getOrCreateAnchor(100, 0);
            const a2 = mockPlanner.getOrCreateAnchor(200, 0);

            const w1 = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: aMid, thickness: 20 });
            const w2 = WallEngine.createWall(mockPlanner, { startAnchor: aMid, endAnchor: a2, thickness: 20 });

            const merged = WallEngine.mergeWalls(mockPlanner, w1, w2);

            expect(merged).toBe(w1);
            expect(merged.startAnchor.x).toBe(0);
            expect(merged.endAnchor.x).toBe(200);
            expect(mockPlanner.walls.length).toBe(1);
        });

        it('deletes a wall with cascading removal of render nodes', () => {
            const a1 = mockPlanner.getOrCreateAnchor(0, 0);
            const a2 = mockPlanner.getOrCreateAnchor(100, 0);
            const wall = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: a2 });

            expect(mockPlanner.walls.length).toBe(1);
            WallEngine.deleteWall(mockPlanner, wall);
            expect(mockPlanner.walls.length).toBe(0);
        });
    });

    describe('3. Canonical Mutation Authority (WallMutationEngine)', () => {
        it('sets thickness and height canonically with clamp bounds', () => {
            const a1 = mockPlanner.getOrCreateAnchor(0, 0);
            const a2 = mockPlanner.getOrCreateAnchor(100, 0);
            const wall = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: a2 });

            WallEngine.setThickness(wall, 35, true, mockPlanner);
            expect(wall.thickness).toBe(35);
            expect(wall.config.thickness).toBe(35);

            WallEngine.setHeight(wall, 240, true, mockPlanner);
            expect(wall.height).toBe(240);
            expect(wall.config.height).toBe(240);
        });

        it('executes outward pull by increasing thickness and pinning the opposite face', () => {
            const a1 = { x: 0, y: 0, position: (p) => { if(p){a1.x=p.x;a1.y=p.y;} return {x: a1.x, y: a1.y}; } };
            const a2 = { x: 100, y: 0, position: (p) => { if(p){a2.x=p.x;a2.y=p.y;} return {x: a2.x, y: a2.y}; } };
            const wall = {
                startAnchor: a1,
                endAnchor: a2,
                thickness: 20,
                config: { thickness: 20 }
            };

            // Pull front face outward by +10cm -> thickness becomes 30cm, centerline shifts along normal (+Y) by +5cm
            WallEngine.pull(wall, 'front', 10, {
                mode: 'thickness',
                initialThickness: 20,
                initialStart: { x: 0, y: 0 },
                initialEnd: { x: 100, y: 0 }
            }, mockPlanner);

            expect(wall.thickness).toBe(30);
            expect(a1.y).toBeCloseTo(5, 1);
            expect(a2.y).toBeCloseTo(5, 1);
        });

        it('executes baseline room resizing by shifting the entire wall perpendicularly', () => {
            const a1 = { x: 0, y: 0, position: (p) => { if(p){a1.x=p.x;a1.y=p.y;} return {x: a1.x, y: a1.y}; } };
            const a2 = { x: 100, y: 0, position: (p) => { if(p){a2.x=p.x;a2.y=p.y;} return {x: a2.x, y: a2.y}; } };
            const wall = {
                startAnchor: a1,
                endAnchor: a2,
                thickness: 20,
                config: { thickness: 20 }
            };

            // Baseline mode shifts the wall by 15cm along normal without changing thickness
            WallEngine.pushPull(wall, 'front', 15, {
                mode: 'baseline',
                initialStart: { x: 0, y: 0 },
                initialEnd: { x: 100, y: 0 }
            }, mockPlanner);

            expect(wall.thickness).toBe(20);
            expect(a1.y).toBeCloseTo(15, 1);
            expect(a2.y).toBeCloseTo(15, 1);
        });

        it('applies materials canonically across faces', () => {
            const a1 = mockPlanner.getOrCreateAnchor(0, 0);
            const a2 = mockPlanner.getOrCreateAnchor(100, 0);
            const wall = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: a2 });

            WallEngine.applyMaterial(wall, { target: 'front', key: 'brick_red_1' }, mockPlanner);
            expect(wall.params.textureFront).toBe('brick_red_1');

            WallEngine.applyMaterial(wall, { target: 'all', key: 'stone_granite_2' }, mockPlanner);
            expect(wall.params.texture).toBe('stone_granite_2');
            expect(wall.params.textureFront).toBe('stone_granite_2');
            expect(wall.params.textureBack).toBe('stone_granite_2');
        });

        it('batch updates multiple walls atomically', () => {
            const a1 = mockPlanner.getOrCreateAnchor(0, 0);
            const a2 = mockPlanner.getOrCreateAnchor(100, 0);
            const a3 = mockPlanner.getOrCreateAnchor(200, 0);

            const w1 = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: a2, thickness: 16, height: 120 });
            const w2 = WallEngine.createWall(mockPlanner, { startAnchor: a2, endAnchor: a3, thickness: 16, height: 120 });

            WallEngine.batchUpdate(mockPlanner, [w1, w2], { thickness: 24, height: 280 });

            expect(w1.thickness).toBe(24);
            expect(w1.height).toBe(280);
            expect(w2.thickness).toBe(24);
            expect(w2.height).toBe(280);
        });

        it('sets single-slope and dual-slope top profiles canonically', () => {
            const a1 = mockPlanner.getOrCreateAnchor(0, 0);
            const a2 = mockPlanner.getOrCreateAnchor(100, 0);
            const wall = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: a2, height: 120 });

            WallEngine.setTopProfile(wall, 'single', { startHeight: 80, endHeight: 160 }, true, mockPlanner);
            expect(wall.topProfileType).toBe('single');
            expect(wall.startHeight).toBe(80);
            expect(wall.endHeight).toBe(160);

            WallEngine.setTopProfile(wall, 'dual', { peakHeight: 200, peakPos: 0.5 }, true, mockPlanner);
            expect(wall.topProfileType).toBe('dual');
            expect(wall.peakHeight).toBe(200);
            expect(wall.peakPos).toBe(0.5);
        });

        it('moves anchors and updates connected walls cleanly', () => {
            const a1 = mockPlanner.getOrCreateAnchor(0, 0);
            const a2 = mockPlanner.getOrCreateAnchor(100, 0);
            const wall = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: a2 });

            WallEngine.moveAnchor(a2, { x: 150, y: 50 }, mockPlanner);

            expect(a2.x).toBe(150);
            expect(a2.y).toBe(50);
            expect(WallEngine.getLength(wall)).toBeCloseTo(Math.hypot(150, 50), 1);
        });

        it('reforms planar graph when drawing crossing wall segments', () => {
            // Create an initial horizontal wall from (0, 100) to (200, 100)
            const a1 = mockPlanner.getOrCreateAnchor(0, 100);
            const a2 = mockPlanner.getOrCreateAnchor(200, 100);
            const wall1 = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: a2, thickness: 20 });

            // Draw a crossing vertical segment from (100, 0) to (100, 200)
            const inputSegments = [
                { p1: { x: 100, y: 0 }, p2: { x: 100, y: 200 } }
            ];

            const createdWalls = WallEngine.reformAndAddWallSegments(mockPlanner, inputSegments, 'outer', { thickness: 20, height: 120 });

            // The crossing wall should split the existing horizontal wall at (100, 100)
            // and create 2 new vertical wall segments meeting at (100, 100)
            expect(mockPlanner.walls.length).toBe(4);
            const intersectionAnchor = mockPlanner.anchors.find(a => Math.hypot(a.x - 100, a.y - 100) < 2.0);
            expect(intersectionAnchor).toBeDefined();
        });
    });
});


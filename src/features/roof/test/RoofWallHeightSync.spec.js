import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { WallEngine } from '../../../core/wall/WallEngine.js';
import { RoofEngine } from '../../../core/roof/RoofEngine.js';
import { RoofMutationEngine } from '../../../core/roof/RoofMutationEngine.js';
import { RoofGeometryEngine } from '../../../core/roof/RoofGeometryEngine.js';

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

describe('Roof and Wall Height Synchronization', () => {
    let mockPlanner;
    let anchors;
    let walls;

    beforeEach(() => {
        anchors = [];
        walls = [];
        mockPlanner = {
            walls,
            anchors,
            rooms: [],
            roofs: [],
            furniture: [],
            stairs: [],
            balconies: [],
            arcs: [],
            shapes: [],
            wallLayer: { add: () => {} },
            uiLayer: { add: () => {}, batchDraw: () => {} },
            mainLayer: { batchDraw: () => {} },
            stage: { batchDraw: () => {} },
            syncAll: vi.fn(),
            update3D: vi.fn(),
            debouncedSaveHistory: vi.fn(),
            selectEntity: vi.fn(),
            getOrCreateAnchor: (x, y) => {
                let existing = anchors.find(a => Math.hypot(a.x - x, a.y - y) < 2.0);
                if (existing) return existing;
                const newA = {
                    x, y,
                    position: function(pos) {
                        if (pos) { this.x = pos.x; this.y = pos.y; }
                        return { x: this.x, y: this.y };
                    }
                };
                anchors.push(newA);
                return newA;
            }
        };
    });

    it('automatically raises flat roof elevation when a single wall is raised via WallEngine.setHeight', () => {
        // 1. Create a 4-wall room (1000x1000 cm) with height 120 cm
        const w1 = WallEngine.createWall(mockPlanner, {
            startX: 0, startY: 0, endX: 1000, endY: 0,
            thickness: 20, height: 120, elevation: 0, addToPlanner: true
        });
        const w2 = WallEngine.createWall(mockPlanner, {
            startX: 1000, startY: 0, endX: 1000, endY: 1000,
            thickness: 20, height: 120, elevation: 0, addToPlanner: true
        });
        const w3 = WallEngine.createWall(mockPlanner, {
            startX: 1000, startY: 1000, endX: 0, endY: 1000,
            thickness: 20, height: 120, elevation: 0, addToPlanner: true
        });
        const w4 = WallEngine.createWall(mockPlanner, {
            startX: 0, startY: 1000, endX: 0, endY: 0,
            thickness: 20, height: 120, elevation: 0, addToPlanner: true
        });

        // 2. Place a flat roof over this room
        const roofPts = [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
            { x: 1000, y: 1000 },
            { x: 0, y: 1000 }
        ];
        const flatRoof = RoofEngine.createRoof(mockPlanner, roofPts, {
            roofType: 'flat',
            thickness: 15
        }, { addToPlanner: true });

        expect(flatRoof.elevation).toBe(120);

        // 3. User selects a wall and raises its height to 280 cm (the exact user scenario)
        WallEngine.setHeight(w1, 280, true, mockPlanner);

        // 4. Roof elevation must automatically update to 280 cm!
        expect(flatRoof.elevation).toBe(280);
    });

    it('automatically raises roof elevation when walls are updated via batchUpdate', () => {
        const w1 = WallEngine.createWall(mockPlanner, {
            startX: 0, startY: 0, endX: 800, endY: 0,
            thickness: 20, height: 120, elevation: 0, addToPlanner: true
        });
        const w2 = WallEngine.createWall(mockPlanner, {
            startX: 800, startY: 0, endX: 800, endY: 800,
            thickness: 20, height: 120, elevation: 0, addToPlanner: true
        });
        const w3 = WallEngine.createWall(mockPlanner, {
            startX: 800, startY: 800, endX: 0, endY: 800,
            thickness: 20, height: 120, elevation: 0, addToPlanner: true
        });
        const w4 = WallEngine.createWall(mockPlanner, {
            startX: 0, startY: 800, endX: 0, endY: 0,
            thickness: 20, height: 120, elevation: 0, addToPlanner: true
        });

        const roofPts = [
            { x: 0, y: 0 },
            { x: 800, y: 0 },
            { x: 800, y: 800 },
            { x: 0, y: 800 }
        ];
        const roof = RoofEngine.createRoof(mockPlanner, roofPts, {
            roofType: 'gable',
            pitch: 30
        }, { addToPlanner: true });

        expect(roof.elevation).toBe(120);

        // Batch update all walls to height 350
        WallEngine.batchUpdate(mockPlanner, [w1, w2, w3, w4], { height: 350 });

        expect(roof.elevation).toBe(350);

        // Batch update all walls to height 240 (lowering)
        WallEngine.batchUpdate(mockPlanner, [w1, w2, w3, w4], { height: 240 });

        expect(roof.elevation).toBe(240);
    });

    it('automatically raises roof elevation when wall elevation is lifted (e.g. room lift / foundation)', () => {
        const w1 = WallEngine.createWall(mockPlanner, {
            startX: 0, startY: 0, endX: 500, endY: 0,
            thickness: 20, height: 280, elevation: 0, addToPlanner: true
        });
        const w2 = WallEngine.createWall(mockPlanner, {
            startX: 500, startY: 0, endX: 500, endY: 500,
            thickness: 20, height: 280, elevation: 0, addToPlanner: true
        });
        const w3 = WallEngine.createWall(mockPlanner, {
            startX: 500, startY: 500, endX: 0, endY: 500,
            thickness: 20, height: 280, elevation: 0, addToPlanner: true
        });
        const w4 = WallEngine.createWall(mockPlanner, {
            startX: 0, startY: 500, endX: 0, endY: 0,
            thickness: 20, height: 280, elevation: 0, addToPlanner: true
        });

        const roofPts = [
            { x: 0, y: 0 },
            { x: 500, y: 0 },
            { x: 500, y: 500 },
            { x: 0, y: 500 }
        ];
        const roof = RoofEngine.createRoof(mockPlanner, roofPts, {
            roofType: 'flat'
        }, { addToPlanner: true });

        expect(roof.elevation).toBe(280);

        // Increase wall elevation to 30 (e.g. plinth / room step)
        WallEngine.batchUpdate(mockPlanner, [w1, w2, w3, w4], { elevation: 30 });

        // Total wall top is 30 + 280 = 310
        expect(roof.elevation).toBe(310);
    });

    it('calls envBuilder.updateRoofLive when 3D engine context is provided', () => {
        const mockEnvBuilder = { updateRoofLive: vi.fn() };
        mockPlanner.envBuilder = mockEnvBuilder;
        mockPlanner.engine3d = { envBuilder: mockEnvBuilder, requestRender: vi.fn() };

        const w1 = WallEngine.createWall(mockPlanner, {
            startX: 0, startY: 0, endX: 600, endY: 0,
            thickness: 20, height: 120, elevation: 0, addToPlanner: true
        });
        const w2 = WallEngine.createWall(mockPlanner, {
            startX: 600, startY: 0, endX: 600, endY: 600,
            thickness: 20, height: 120, elevation: 0, addToPlanner: true
        });

        const roofPts = [
            { x: 0, y: 0 },
            { x: 600, y: 0 },
            { x: 600, y: 600 },
            { x: 0, y: 600 }
        ];
        const roof = RoofEngine.createRoof(mockPlanner, roofPts, {
            roofType: 'flat'
        }, { addToPlanner: true });
        roof.mesh3D = { position: { y: 120, copy: vi.fn() }, children: [{ userData: { isRoof: true }, position: { copy: vi.fn() } }] };

        // Change height
        WallEngine.setHeight(w1, 300, true, mockPlanner);

        expect(roof.elevation).toBe(300);
        expect(mockEnvBuilder.updateRoofLive).toHaveBeenCalledWith(roof);
    });
});

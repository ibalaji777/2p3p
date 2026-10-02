import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { WallPlugin3DPlacementSystem } from '../WallPlugin3DPlacementSystem.js';
import { createStarterElevationSegment } from '../../../features/elevation/elevationSegment.registry.js';

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
            measureText: () => ({ width: 50 })
        });
    }
});

describe('WallPlugin3DPlacementSystem - Elevation Segment & Wall Placement', () => {
    let mockCtx;
    let mockPlanner;
    let placementSystem;
    let mockWall;

    beforeEach(() => {
        document.body.innerHTML = '';

        mockWall = {
            id: 'wall_test_1',
            startX: 0,
            startY: 0,
            endX: 300,
            endY: 0,
            thickness: 20,
            height: 280,
            elevation: 0,
            startAnchor: { position: () => ({ x: 0, y: 0 }) },
            endAnchor: { position: () => ({ x: 300, y: 0 }) },
            poly: { points: () => [0, 10, 300, 10, 300, -10, 0, -10] },
            attachedWidgets: []
        };

        mockPlanner = {
            tool: 'elevation_segment',
            activePresetParams: {
                length: 180,
                width: 30,
                depth: 10,
                material: 'wood'
            },
            walls: [mockWall],
            elevationSegments: [],
            selectEntity: vi.fn(),
            syncAll: vi.fn(),
            onToolChange: vi.fn(),
            updateToolStates: vi.fn()
        };

        const domElem = document.createElement('canvas');
        domElem.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: 800,
            bottom: 600,
            width: 800,
            height: 600
        });

        mockCtx = {
            renderer: { domElement: domElem },
            container: document.createElement('div'),
            camera: new THREE.PerspectiveCamera(),
            scene: new THREE.Scene(),
            structureGroup: new THREE.Group(),
            interactables: [],
            planner: mockPlanner,
            requestRender: vi.fn(),
            helpers: {
                getDynamicMaterial: () => new THREE.MeshBasicMaterial()
            }
        };

        placementSystem = new WallPlugin3DPlacementSystem(mockCtx);
    });

    it('should recognize elevation_segment as an active placement tool', () => {
        mockPlanner.tool = 'elevation_segment';
        expect(placementSystem.isPlacementTool()).toBe(true);
    });

    it('should anchor placementGroup to wallBaseY when wall is elevated (elevation = 300)', () => {
        const elevatedWall = {
            ...mockWall,
            id: 'wall_elevated_second_floor',
            elevation: 300
        };

        placementSystem.updateApertureAndModel(
            'elevation_segment',
            elevatedWall,
            0.5,
            100, // elev
            1,   // facing
            300, // wallLen
            300, 0, // dx, dy
            { x: 0, y: 0 }, { x: 300, y: 0 },
            20, 280,
            180, 30, 10,
            true, false, true, false,
            150,
            mockPlanner.activePresetParams
        );

        // Master group must be anchored at wall.elevation = 300
        expect(placementSystem.placementGroup.position.y).toBe(300);
        expect(placementSystem.placementGroup.visible).toBe(true);
    });

    it('should place elevation segment with correct world beamCenterY on elevated upper walls', () => {
        const elevatedWall = {
            ...mockWall,
            id: 'wall_elevated_300',
            elevation: 300
        };

        placementSystem.activeWall = elevatedWall;
        placementSystem.activeT = 0.5;
        placementSystem.activeSide = 'front';
        placementSystem.activeElevation = 80;
        placementSystem.activeLocalX = 150;
        placementSystem.activeUStart = 60;
        placementSystem.activeUEnd = 240;
        placementSystem.isValidPlacement = true;

        const placed = placementSystem.placePlugin();
        expect(placed).toBeTruthy();
        expect(mockPlanner.elevationSegments.length).toBe(1);

        const created = mockPlanner.elevationSegments[0];
        expect(created.type).toBe('elevation_segment');
        // World Y must be wallBaseY (300) + elev (80) + height/2 (15) = 395
        expect(created.points[0].y).toBe(395);
        expect(created.points[1].y).toBe(395);
        expect(created.elevation).toBe(395);
        expect(created.points[0].u).toBe(60);
        expect(created.points[1].u).toBe(240);
    });

    it('should place correctly flush to start edge (u=0) and end edge (u=wallLen)', () => {
        mockPlanner.tool = 'elevation_segment';
        mockPlanner.elevationSegments = [];
        placementSystem.activeWall = mockWall;
        placementSystem.activeT = 0;
        placementSystem.activeSide = 'front';
        placementSystem.activeElevation = 0;
        placementSystem.activeLocalX = 90;
        placementSystem.activeUStart = 0;
        placementSystem.activeUEnd = 180;
        placementSystem.isValidPlacement = true;

        const placed = placementSystem.placePlugin();
        expect(placed).toBeTruthy();

        const created = mockPlanner.elevationSegments[0];
        expect(created.points[0].u).toBe(0);
        expect(created.points[1].u).toBe(180);
        expect(created.points[0].t).toBe(0);
    });

    it('should center-align cleanly on a short wall where segment occupies most of the wall', () => {
        const shortWall = {
            id: 'short_wall',
            startX: 0,
            startY: 0,
            endX: 200,
            endY: 0,
            thickness: 20,
            height: 280,
            elevation: 0,
            startAnchor: { position: () => ({ x: 0, y: 0 }) },
            endAnchor: { position: () => ({ x: 200, y: 0 }) }
        };

        const seg = createStarterElevationSegment(shortWall, 100, 150, 1, { length: 180 });
        expect(seg.points[0].u).toBe(10);
        expect(seg.points[1].u).toBe(190);
        expect((seg.points[0].u + seg.points[1].u) / 2).toBe(100);
    });
});

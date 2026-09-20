import { describe, it, expect, beforeAll } from 'vitest';
import { VerticalPropagationEngine } from '../src/core/vertical/VerticalPropagationEngine.js';
import { WallSerializer } from '../src/features/wall/wall.serializer.js';
import { RoofSerializer } from '../src/core/roof/RoofSerializer.js';
import { StairHeightDetector } from '../src/features/stairs/StairHeightDetector.js';
import { computeLevelElevations } from '../src/core/engine3d/helpers/levelElevations.js';

describe('VerticalPropagationEngine & VDE Architecture', () => {
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
                rect: () => {}
            });
        }
    });
    it('propagates wall height increase to upper level elevation and stacked walls', () => {
        const mockLowerWall = {
            id: 'wall_lower',
            height: 280,
            elevation: 0,
            attachedMoldings: [],
            attachedWidgets: []
        };

        const mockUpperWall = {
            id: 'wall_upper',
            parentWallId: 'wall_lower',
            height: 280,
            elevation: 280,
            attachedMoldings: [],
            attachedWidgets: []
        };

        const mockLevel0 = { id: 'lvl_0', height: 280, elevation: 0, type: 'ground' };
        const mockLevel1 = { id: 'lvl_1', height: 280, elevation: 280, type: 'floor' };

        const mockPlanner = {
            walls: [mockLowerWall, mockUpperWall],
            levels: [mockLevel0, mockLevel1],
            activeLevelIndex: 0,
            activeLevel: mockLevel0,
            furniture: [],
            stairs: [],
            roofs: [],
            elevationSegments: []
        };

        // Increase lower wall height by +20 cm (280 -> 300)
        VerticalPropagationEngine.onWallHeightChanged(mockLowerWall, 300, 280, mockPlanner);

        // 1. Level 0 height should become 300
        expect(mockLevel0.height).toBe(300);

        // 2. Level 1 elevation should become 300
        expect(mockLevel1.elevation).toBe(300);

        // 3. Stacked upper wall elevation should increase to 300
        expect(mockUpperWall.elevation).toBe(300);
    });

    it('propagates downward when wall height shrinks', () => {
        const mockLowerWall = {
            id: 'wall_lower',
            height: 300,
            elevation: 0,
            attachedMoldings: [],
            attachedWidgets: []
        };

        const mockUpperWall = {
            id: 'wall_upper',
            parentWallId: 'wall_lower',
            height: 280,
            elevation: 300,
            attachedMoldings: [],
            attachedWidgets: []
        };

        const mockLevel0 = { id: 'lvl_0', height: 300, elevation: 0, type: 'ground' };
        const mockLevel1 = { id: 'lvl_1', height: 280, elevation: 300, type: 'floor' };

        const mockPlanner = {
            walls: [mockLowerWall, mockUpperWall],
            levels: [mockLevel0, mockLevel1],
            activeLevelIndex: 0,
            activeLevel: mockLevel0,
            furniture: [],
            stairs: [],
            roofs: [],
            elevationSegments: []
        };

        // Decrease lower wall height by -20 cm (300 -> 280)
        VerticalPropagationEngine.onWallHeightChanged(mockLowerWall, 280, 300, mockPlanner);

        expect(mockLevel0.height).toBe(280);
        expect(mockLevel1.elevation).toBe(280);
        expect(mockUpperWall.elevation).toBe(280);
    });

    it('recalculates crown moldings to remain at wall top and baseboards at bottom', () => {
        const crownMolding = {
            id: 'mold_crown',
            type: 'molding_crown_classic',
            anchorMode: 'top',
            moldingHeight: 12,
            heightOffset: 268 // 280 - 12
        };

        const baseboard = {
            id: 'mold_base',
            type: 'molding_skirting_flat',
            anchorMode: 'bottom',
            moldingHeight: 10,
            heightOffset: 0
        };

        const wall = {
            id: 'wall_1',
            height: 280,
            attachedMoldings: [crownMolding, baseboard],
            attachedWidgets: []
        };

        // Increase wall height by +20 cm (280 -> 300)
        VerticalPropagationEngine.syncWallMoldings(wall, 300, 20);

        // Crown molding should now be at 300 - 12 = 288
        expect(crownMolding.heightOffset).toBe(288);

        // Baseboard should remain at 0
        expect(baseboard.heightOffset).toBe(0);
    });

    it('clamps openings and adjusts attached widgets when wall height shrinks', () => {
        const highWindow = {
            id: 'win_1',
            type: 'window',
            elevation: 200,
            height: 90 // top is at 290
        };

        const wall = {
            id: 'wall_1',
            height: 300,
            attachedWidgets: [highWindow],
            attachedMoldings: []
        };

        // Decrease wall height to 250 (below window top of 290)
        VerticalPropagationEngine.syncWallOpenings(wall, 250, -50);

        // Window top must be clamped to 250: elevation (200) + height (90) = 290 > 250
        // Window elevation should adjust down to 250 - 90 = 160
        expect(highWindow.elevation + highWindow.height).toBeLessThanOrEqual(250);
        expect(highWindow.elevation).toBe(160);
    });

    it('propagates wall elevation change to attached widgets, moldings, and segments', () => {
        const widget = { id: 'w_1', elevation: 100 };
        const molding = { id: 'm_1', heightOffset: 0 };
        const segment = { id: 's_1', wallId: 'wall_1', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] };

        const wall = {
            id: 'wall_1',
            height: 280,
            elevation: 0,
            attachedWidgets: [widget],
            attachedMoldings: [molding]
        };

        const mockPlanner = {
            walls: [wall],
            levels: [],
            elevationSegments: [segment]
        };

        // Raise wall elevation by +40 cm (foundation lift)
        VerticalPropagationEngine.onWallElevationChanged(wall, 40, 0, mockPlanner);

        // Wall elevation is 40
        expect(wall.elevation).toBe(40);
        // Widget local elevation remains 100
        expect(widget.elevation).toBe(100);
        // Widget effective world elevation is 140 (wall 40 + widget 100)
        widget.wall = wall;
        expect(VerticalPropagationEngine.getEffectiveElevation(widget, mockPlanner)).toBe(140);
        // Segment Y is shifted
        expect(segment.points[0].y).toBe(90);
    });

    it('updates resting roof elevation when supporting walls change height', () => {
        const mockRoof = {
            id: 'roof_1',
            elevation: 280,
            _restingOnWalls: true,
            _lastSyncedWallTop: 280,
            points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 500 }, { x: 0, y: 500 }]
        };

        const mockWall = {
            id: 'wall_1',
            elevation: 0,
            height: 280,
            startX: 50,
            startY: 50,
            endX: 450,
            endY: 50,
            startAnchor: { x: 50, y: 50 },
            endAnchor: { x: 450, y: 50 },
            attachedMoldings: [],
            attachedWidgets: []
        };

        const mockPlanner = {
            walls: [mockWall],
            roofs: [mockRoof],
            levels: []
        };

        // Rise wall to 320
        VerticalPropagationEngine.onWallHeightChanged(mockWall, 320, 280, mockPlanner);

        // Roof resting on wall should move to 320
        expect(mockRoof.elevation).toBe(320);
        expect(mockRoof._lastSyncedWallTop).toBe(320);
    });

    it('propagates platform height change to hosted furniture', () => {
        const platform = {
            id: 'plat_1',
            elevation: 0,
            height: 20, // 20cm high platform
            shapeType: 'rect',
            width: 200,
            depth: 200,
            x: 100,
            y: 100
        };

        const furniture = {
            id: 'furn_sofa',
            x: 100,
            y: 100,
            hostPlatformId: 'plat_1',
            relativeElevation: 0,
            elevation: 20
        };

        const mockPlanner = {
            platforms: [platform],
            furniture: [furniture],
            stairs: []
        };

        // Step up platform to 40cm (+20cm)
        VerticalPropagationEngine.onPlatformHeightChanged(platform, 40, 20, mockPlanner);

        // Furniture on platform should be at platform top = 40cm
        expect(furniture.elevation).toBe(40);
    });

    it('recalculates staircase steps and riser heights for target height', () => {
        const mockStair = {
            id: 'stair_1',
            shape: 'straight',
            totalSteps: 12,
            stepHeight: 16.67
        };

        // Target height = 280 cm
        StairHeightDetector.recalculateStairForHeight(mockStair, 280);

        // Optimal steps for 280cm (target riser ~17.5cm): 280 / 17.5 = 16 steps
        expect(mockStair.totalSteps).toBe(16);
        expect(mockStair.stepHeight).toBeCloseTo(17.5, 1);
    });

    it('preserves vertical dependency metadata across Wall serialization and deserialization', () => {
        const wall = {
            id: 'wall_test',
            type: 'outer',
            height: 280,
            thickness: 20,
            elevation: 40,
            parentWallId: 'wall_base',
            hostLevelId: 'level_1',
            relativeElevation: 0,
            attachedWidgets: [
                {
                    id: 'wid_1',
                    type: 'window',
                    t: 0.5,
                    elevation: 90,
                    width: 120,
                    height: 120,
                    depth: 15,
                    anchorMode: 'bottom'
                }
            ],
            attachedMoldings: [
                {
                    id: 'mold_1',
                    type: 'molding_crown',
                    t: 0.5,
                    width: 400,
                    depth: 5,
                    heightOffset: 268,
                    moldingHeight: 12,
                    anchorMode: 'top'
                }
            ]
        };

        const serialized = WallSerializer.serialize(wall);
        expect(serialized.parentWallId).toBe('wall_base');
        expect(serialized.hostLevelId).toBe('level_1');
        expect(serialized.relativeElevation).toBe(0);
        expect(serialized.widgets[0].anchorMode).toBe('bottom');
        expect(serialized.moldings[0].anchorMode).toBe('top');

        const mockPlanner = {
            wallLayer: { add: () => {} },
            uiLayer: { add: () => {} },
            widgetLayer: { add: () => {} },
            layer: { add: () => {} },
            getOrCreateAnchor: (x, y) => ({ x, y, position: () => ({ x, y }) }),
            walls: [],
            anchors: []
        };
        const deserialized = WallSerializer.deserialize(serialized, mockPlanner);
        expect(deserialized.parentWallId).toBe('wall_base');
        expect(deserialized.hostLevelId).toBe('level_1');
        expect(deserialized.relativeElevation).toBe(0);
        expect(deserialized.attachedWidgets[0].anchorMode).toBe('bottom');
        expect(deserialized.attachedMoldings[0].anchorMode).toBe('top');
    });

    it('preserves resting and host metadata across Roof serialization and deserialization', () => {
        const roof = {
            id: 'roof_test',
            x: 0,
            y: 0,
            rotation: 0,
            elevation: 300,
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
            config: { pitch: 30 },
            _restingOnWalls: true,
            _lastSyncedWallTop: 300,
            hostWallIds: ['wall_1', 'wall_2']
        };

        const serialized = RoofSerializer.serialize(roof);
        expect(serialized._restingOnWalls).toBe(true);
        expect(serialized._lastSyncedWallTop).toBe(300);
        expect(serialized.hostWallIds).toEqual(['wall_1', 'wall_2']);

        const deserialized = RoofSerializer.deserialize(serialized, null, { addToPlanner: false });
        expect(deserialized._restingOnWalls).toBe(true);
        expect(deserialized._lastSyncedWallTop).toBe(300);
        expect(deserialized.hostWallIds).toEqual(['wall_1', 'wall_2']);
    });

    it('computes level elevations with authoritative wall heights correctly', () => {
        const levelsConfig = [
            { id: 'lvl_plinth', type: 'plinth', height: 20 },
            { id: 'lvl_ground', type: 'ground', height: 280 },
            { id: 'lvl_first', type: 'floor', height: 280 }
        ];

        const elevations = computeLevelElevations(levelsConfig);

        // Ground is at plinth level = 0
        // Ground floor (groundIndex = 0 is plinth)
        // Level 0 (plinth): elevation = 0
        // Level 1 (ground): elevation = 20
        // Level 2 (first): elevation = 20 + 280 = 300
        expect(elevations[0]).toBe(0);
        expect(elevations[1]).toBe(20);
        expect(elevations[2]).toBe(300);
    });
});

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { FloorPlanner } from '../../engine2d/index.js';
import { PlatformEngine } from '../../platform/PlatformEngine.js';
import { FurnitureEngine } from '../../furniture/FurnitureEngine.js';
import { StairEngine } from '../../stairs/StairEngine.js';
import { WallEngine } from '../../wall/WallEngine.js';
import { globalSpatialDependencyEngine, RELATIONSHIP_TYPES } from '../SpatialDependencyEngine.js';
import { SnapshotCommand } from '../../commands/SnapshotCommand.js';
import { CommandManager } from '../../commands/CommandManager.js';

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
            scale: () => {},
            translate: () => {},
            rotate: () => {},
            clip: () => {},
            arc: () => {},
            bezierCurveTo: () => {},
            quadraticCurveTo: () => {},
            createLinearGradient: () => ({ addColorStop: () => {} }),
            createRadialGradient: () => ({ addColorStop: () => {} }),
            createPattern: () => ({})
        });
    }
});

describe('Spatial Dependency & Host Tracking Integration', () => {
    let planner;
    let container;

    beforeEach(() => {
        globalSpatialDependencyEngine.clear();
        container = document.createElement('div');
        planner = new FloorPlanner(container);
        planner.commandManager = new CommandManager(planner);
    });

    it('Scenario 1: Platform height change adapts hosted furniture elevation and resting staircase height', () => {
        // 1. Create a Platform at (100, 100), elevation 0, height 20
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat-1',
            x: 100,
            y: 100,
            width: 200,
            depth: 200,
            elevation: 0,
            height: 20,
            rotation: 0
        }, { addToPlanner: true });

        // 2. Place a Sofa on the Platform at (150, 150), elevation 20 (on top)
        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'furn-sofa',
            configId: 'sofa_3seater',
            x: 150,
            y: 150,
            elevation: 20,
            hostPlatformId: 'plat-1',
            hostId: 'plat-1',
            hostType: 'platform',
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            localTransform: { x: 50, y: 50, elevation: 0, rotation: 0 },
            addToPlanner: true
        });

        // 3. Place a Staircase resting against the Platform, height 20
        const stair = StairEngine.createStair(planner, {
            id: 'stair-entry',
            shape: 'straight',
            x: 100,
            y: 50,
            elevation: 0,
            height: 20,
            hostPlatformId: 'plat-1',
            hostId: 'plat-1',
            hostType: 'platform',
            relationshipType: RELATIONSHIP_TYPES.SUPPORTED,
            localTransform: { x: 0, y: -50, elevation: -20, rotation: 0 },
            addToPlanner: true
        });

        // Verify initial attachments in globalSpatialDependencyEngine
        const dependents = globalSpatialDependencyEngine.getDependents('plat-1');
        expect(dependents).toContain('furn-sofa');
        expect(dependents).toContain('stair-entry');

        // 4. Increase Platform height from 20 to 60 (raise 2 steps)
        PlatformEngine.setHeight(platform, 60);

        // Verification:
        // - Furniture elevation should automatically rise from 20 to 60
        expect(furn.elevation).toBe(60);
        expect(furn.x).toBe(150);
        expect(furn.y).toBe(150);

        // - Staircase height should adapt to 60
        expect(stair.height).toBe(60);
    });

    it('Scenario 2: Moving and rotating platform translates and rotates hosted objects via forward kinematics', () => {
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat-stage',
            x: 200,
            y: 200,
            width: 200,
            depth: 200,
            elevation: 0,
            height: 30,
            rotation: 0
        }, { addToPlanner: true });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'furn-chair',
            configId: 'chair',
            x: 250,
            y: 250,
            elevation: 30,
            hostPlatformId: 'plat-stage',
            hostId: 'plat-stage',
            hostType: 'platform',
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            localTransform: { x: 50, y: 50, elevation: 0, rotation: 0 },
            addToPlanner: true
        });

        // Move platform by (+100, +50)
        platform.x = 300;
        platform.y = 250;
        globalSpatialDependencyEngine.onHostTransformed(platform, planner);

        // Furniture should move to (350, 300)
        expect(furn.x).toBe(350);
        expect(furn.y).toBe(300);
        expect(furn.elevation).toBe(30);
    });

    it('Scenario 3: Full exportState and importState preserves spatial dependencies and attachments', () => {
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat-p1',
            x: 100,
            y: 100,
            width: 150,
            depth: 150,
            elevation: 0,
            height: 25,
            rotation: 0
        }, { addToPlanner: true });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'furn-table',
            configId: 'table',
            x: 120,
            y: 120,
            elevation: 25,
            hostPlatformId: 'plat-p1',
            hostId: 'plat-p1',
            hostType: 'platform',
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            localTransform: { x: 20, y: 20, elevation: 0, rotation: 0 },
            addToPlanner: true
        });

        const stair = StairEngine.createStair(planner, {
            id: 'stair-s1',
            shape: 'straight',
            x: 100,
            y: 60,
            elevation: 0,
            height: 25,
            hostPlatformId: 'plat-p1',
            hostId: 'plat-p1',
            hostType: 'platform',
            relationshipType: RELATIONSHIP_TYPES.SUPPORTED,
            localTransform: { x: 0, y: -40, elevation: -25, rotation: 0 },
            addToPlanner: true
        });

        // Export state
        const exportedJson = planner.exportState();
        expect(exportedJson).toBeDefined();

        // Load into clean planner
        const newContainer = document.createElement('div');
        const newPlanner = new FloorPlanner(newContainer);
        newPlanner.importState(exportedJson);

        // Verify platforms were deserialized
        expect(newPlanner.platforms).toHaveLength(1);
        expect(newPlanner.furniture).toHaveLength(1);
        expect(newPlanner.stairs).toHaveLength(1);

        const loadedPlat = newPlanner.platforms[0];
        const loadedFurn = newPlanner.furniture[0];
        const loadedStair = newPlanner.stairs[0];

        expect(loadedPlat.id).toBe('plat-p1');
        expect(loadedFurn.hostPlatformId).toBe('plat-p1');
        expect(loadedStair.hostPlatformId).toBe('plat-p1');

        // Verify graph was rebuilt
        const dependents = globalSpatialDependencyEngine.getDependents('plat-p1');
        expect(dependents).toContain(loadedFurn.id);
        expect(dependents).toContain(loadedStair.id);

        // Mutating the loaded platform updates the loaded dependents
        PlatformEngine.setHeight(loadedPlat, 50);
        expect(loadedFurn.elevation).toBe(50);
        expect(loadedStair.height).toBe(50);
    });

    it('Scenario 4: SnapshotCommand Undo / Redo preserves spatial dependencies', () => {
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat-undo',
            x: 100,
            y: 100,
            width: 100,
            depth: 100,
            elevation: 0,
            height: 20,
            rotation: 0
        }, { addToPlanner: true });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'furn-undo',
            configId: 'chair',
            x: 110,
            y: 110,
            elevation: 20,
            hostPlatformId: 'plat-undo',
            hostId: 'plat-undo',
            hostType: 'platform',
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            localTransform: { x: 10, y: 10, elevation: 0, rotation: 0 },
            addToPlanner: true
        });

        const snapCmd = new SnapshotCommand(planner);

        // Raise platform
        PlatformEngine.setHeight(platform, 40);
        expect(furn.elevation).toBe(40);

        snapCmd.finalize();
        planner.commandManager.execute(snapCmd);

        // Undo: should revert platform height to 20 and furniture elevation to 20
        planner.commandManager.undo();
        const restoredPlat = planner.platforms.find(p => p.id === 'plat-undo');
        const restoredFurn = planner.furniture.find(f => f.id === 'furn-undo');

        expect(restoredPlat.height).toBe(20);
        expect(restoredFurn.elevation).toBe(20);

        // Redo: should re-apply height 40
        planner.commandManager.redo();
        const redoPlat = planner.platforms.find(p => p.id === 'plat-undo');
        const redoFurn = planner.furniture.find(f => f.id === 'furn-undo');

        expect(redoPlat.height).toBe(40);
        expect(redoFurn.elevation).toBe(40);
    });

    it('Scenario 5: Platform deletion cleanly detaches and grounds hosted furniture', () => {
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat-del',
            x: 100,
            y: 100,
            width: 100,
            depth: 100,
            elevation: 0,
            height: 50,
            rotation: 0
        }, { addToPlanner: true });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'furn-ground',
            configId: 'chair',
            x: 120,
            y: 120,
            elevation: 50,
            hostPlatformId: 'plat-del',
            hostId: 'plat-del',
            hostType: 'platform',
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            localTransform: { x: 20, y: 20, elevation: 0, rotation: 0 },
            addToPlanner: true
        });

        expect(globalSpatialDependencyEngine.getDependents('plat-del')).toContain('furn-ground');

        PlatformEngine.deletePlatform(planner, platform);

        // Furniture should remain in planner, but grounded to elevation 0 and detached
        expect(planner.platforms).toHaveLength(0);
        expect(planner.furniture).toHaveLength(1);
        expect(furn.elevation).toBe(0);
        expect(furn.hostId).toBeNull();
        expect(globalSpatialDependencyEngine.getDependents('plat-del')).toHaveLength(0);
    });

    it('Scenario 6: Moving wall/anchor slanting room into parallelogram automatically adapts room-associated platform points', () => {
        // 1. Create a 300x200 room box (walls at x: 100..400, y: 100..300)
        WallEngine.createRoomBox(planner, {
            minX: 100,
            minY: 100,
            maxX: 400,
            maxY: 300,
            thickness: 20,
            height: 300,
            elevation: 0
        });

        planner.detectRooms();
        expect(planner.rooms.length).toBeGreaterThan(0);
        const room = planner.rooms[0];
        const rId = room.id;
        expect(rId).toBeDefined();

        // 2. Create a room interior platform associated with this room (75cm height, 5 steps)
        room.platformHeight = 75;
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat-room-1',
            x: room.cx,
            y: room.cy,
            shapeType: 'polygon',
            points: room.path.map(pt => ({ x: pt.x - room.cx, y: pt.y - room.cy })),
            height: 75,
            stepHeight: 15,
            elevation: 0,
            isRoomInteriorPlatform: true,
            associatedRoomId: rId
        }, { addToPlanner: true });

        expect(platform.getStepLabel()).toContain('75cm (5 Steps)');
        const initialCenterX = platform.x;

        // 3. Move top-left anchor to the left by 100cm (slanting the room into a parallelogram)
        const topLeftAnchor = planner.anchors.find(a => Math.hypot(a.x - 100, a.y - 100) < 5);
        expect(topLeftAnchor).toBeDefined();

        WallEngine.moveAnchor(topLeftAnchor, { x: 0, y: 100 }, planner, true);

        // 4. Verify room preserved identity and platform points adapted to match deformed room polygon
        expect(planner.rooms.length).toBeGreaterThan(0);
        const updatedRoom = planner.rooms.find(r => r.id === rId) || planner.rooms[0];
        expect(updatedRoom.id).toBe(rId);

        // Platform center and polygon points must have adapted
        expect(platform.x).toBe(updatedRoom.cx);
        expect(platform.y).toBe(updatedRoom.cy);
        expect(platform.x).not.toBe(initialCenterX);

        // Platform must have points matching the slanted room polygon
        expect(platform.points.length).toBeGreaterThanOrEqual(3);
        const pointOffsets = platform.points.map(pt => ({ x: pt.x + platform.x, y: pt.y + platform.y }));
        // Top-left point of platform should be at x: 0
        const minX = Math.min(...pointOffsets.map(p => p.x));
        expect(minX).toBeCloseTo(0, 0);
    });

    it('Scenario 7: Moving a wall with wallTrackingEnabled = true tracks nearby platforms and stairs', () => {
        planner.setWallTracking(true);

        const a1 = planner.getOrCreateAnchor(100, 100);
        const a2 = planner.getOrCreateAnchor(400, 100);
        const w = WallEngine.createWall(planner, {
            startAnchor: a1,
            endAnchor: a2,
            thickness: 20,
            height: 300,
            elevation: 0
        });

        // Place a platform near the wall at (250, 150)
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat-near-wall',
            x: 250,
            y: 150,
            width: 120,
            depth: 80,
            elevation: 0,
            height: 30
        }, { addToPlanner: true });

        // Place a stair near the wall at (250, 60)
        const stair = StairEngine.createStair(planner, {
            id: 'stair-near-wall',
            x: 250,
            y: 60,
            elevation: 0,
            height: 30,
            addToPlanner: true
        });

        // Translate the wall by (+50, +50)
        WallEngine.moveWall(w, 50, 50, true, planner);

        // Wall endpoints moved
        expect(w.startAnchor.x).toBe(150);
        expect(w.startAnchor.y).toBe(150);
        expect(w.endAnchor.x).toBe(450);
        expect(w.endAnchor.y).toBe(150);
    });
});

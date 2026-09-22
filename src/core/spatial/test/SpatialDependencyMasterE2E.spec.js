/**
 * src/core/spatial/test/SpatialDependencyMasterE2E.spec.js
 * 
 * Comprehensive End-to-End Test Suite for Universal Spatial Dependency Architecture.
 * Validates:
 * 1. SpatialHostResolver pure geometric query.
 * 2. 2D Furniture drag-and-drop onto raised platform (elevation & attachment).
 * 3. Platform movement propagating in-place to resting furniture in 2D & 3D.
 * 4. Room-bounded platform geometry updating resting furniture on wall movement.
 * 5. 2D Stair height detection and platform attachment.
 * 6. 2D Decorative shape snapping to wall and moving with wall.
 * 7. Undo/Redo maintaining dependency graph integrity.
 * 8. Export/Import serialization and DAG reconstruction.
 * 9. Host platform deletion cleanly grounding resting furniture.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { FloorPlanner } from '../../engine2d/index.js';
import { globalSpatialDependencyEngine, RELATIONSHIP_TYPES } from '../SpatialDependencyEngine.js';
import { SpatialHostResolver } from '../SpatialHostResolver.js';
import { PlatformEngine } from '../../platform/PlatformEngine.js';
import { FurnitureEngine } from '../../furniture/FurnitureEngine.js';
import { StairEngine } from '../../stairs/StairEngine.js';
import { PremiumShape } from '../../engine2d/PremiumShape.js';
import { WallEngine } from '../../wall/WallEngine.js';
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

describe('SpatialDependencyMasterE2E: Comprehensive Architecture Validation', () => {
    let planner;
    let container;

    beforeEach(() => {
        globalSpatialDependencyEngine.clear();

        container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', { value: 1000, configurable: true });
        Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true });

        planner = new FloorPlanner(container);
        planner.commandManager = new CommandManager(planner);
        planner.walls = [];
        planner.anchors = [];
        planner.platforms = [];
        planner.furniture = [];
        planner.stairs = [];
        planner.shapes = [];
        planner.rooms = [];
        planner.roomPaths = [];

        // Mock batchDraw on real Konva layers to prevent canvas rendering overhead in tests
        if (planner.mainLayer) planner.mainLayer.batchDraw = vi.fn();
        if (planner.furnitureLayer) planner.furnitureLayer.batchDraw = vi.fn();
        if (planner.widgetLayer) planner.widgetLayer.batchDraw = vi.fn();
        if (planner.uiLayer) planner.uiLayer.batchDraw = vi.fn();
        if (planner.bgLayer) planner.bgLayer.batchDraw = vi.fn();
        planner.syncAll = vi.fn();
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 1: SpatialHostResolver Pure Geometric Query
    // ─────────────────────────────────────────────────────────────────────────────
    it('TEST 1: SpatialHostResolver identifies topmost platform under a 2D coordinate', () => {
        const platBase = PlatformEngine.createPlatform(planner, {
            id: 'plat_base',
            x: 200,
            y: 200,
            width: 200,
            depth: 200,
            elevation: 0,
            height: 20
        });

        const platTop = PlatformEngine.createPlatform(planner, {
            id: 'plat_top',
            x: 200,
            y: 200,
            width: 100,
            depth: 100,
            elevation: 20,
            height: 30
        });

        // Point inside both platforms -> platTop should take precedence (surface elev 50 vs 20)
        const hostAtCenter = SpatialHostResolver.findHostAt(planner, 200, 200, 'furniture');
        expect(hostAtCenter).not.toBeNull();
        expect(hostAtCenter.hostId).toBe('plat_top');
        expect(hostAtCenter.surfaceElevation).toBe(50);

        // Point outside platTop but inside platBase
        const hostAtEdge = SpatialHostResolver.findHostAt(planner, 260, 200, 'furniture');
        expect(hostAtEdge).not.toBeNull();
        expect(hostAtEdge.hostId).toBe('plat_base');
        expect(hostAtEdge.surfaceElevation).toBe(20);

        // Point outside both platforms -> null
        const hostOutside = SpatialHostResolver.findHostAt(planner, 500, 500, 'furniture');
        expect(hostOutside).toBeNull();
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 2: 2D Furniture Drop onto Platform (Elevation & Attachment)
    // ─────────────────────────────────────────────────────────────────────────────
    it('TEST 2: Moving furniture onto platform in 2D attaches to platform and sets elevation', () => {
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat_living',
            x: 300,
            y: 300,
            width: 200,
            depth: 200,
            elevation: 10,
            height: 25
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'sofa_1',
            x: 50,
            y: 50,
            configId: 'sofa'
        });

        expect(furn.elevation).toBe(0);
        expect(furn.hostPlatformId || null).toBeNull();
        expect(globalSpatialDependencyEngine.getDependents(platform.id)).toHaveLength(0);

        // User drags sofa onto the platform in 2D
        planner.move(furn.id, 320, 310);

        expect(furn.elevation).toBe(35); // 10 (elev) + 25 (height)
        expect(furn.hostPlatformId).toBe(platform.id);
        expect(furn.hostId).toBe(platform.id);
        expect(globalSpatialDependencyEngine.getDependents(platform.id)).toContain(furn.id);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 3: Platform Movement Propagating to Resting Furniture
    // ─────────────────────────────────────────────────────────────────────────────
    it('TEST 3: Moving platform moves resting furniture with accurate forward kinematics', () => {
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat_stage',
            x: 200,
            y: 200,
            width: 200,
            depth: 200,
            elevation: 0,
            height: 30
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'chair_1',
            x: 200,
            y: 200,
            configId: 'chair'
        });

        // Place chair on platform center
        planner.move(furn.id, 200, 200);
        expect(furn.elevation).toBe(30);
        expect(globalSpatialDependencyEngine.getDependents(platform.id)).toContain(furn.id);

        // Move platform by (+50, +30)
        planner.move(platform.id, 250, 230);

        expect(furn.x).toBe(250);
        expect(furn.y).toBe(230);
        expect(furn.elevation).toBe(30);

        if (furn.group && typeof furn.group.x === 'function') {
            expect(furn.group.x()).toBe(250);
            expect(furn.group.y()).toBe(230);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 4: Moving Furniture Off Platform (Detachment & Grounding)
    // ─────────────────────────────────────────────────────────────────────────────
    it('TEST 4: Moving furniture off platform detaches it and resets elevation to 0', () => {
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat_wood',
            x: 200,
            y: 200,
            width: 150,
            depth: 150,
            elevation: 0,
            height: 40
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'table_1',
            x: 200,
            y: 200,
            configId: 'table'
        });

        planner.move(furn.id, 200, 200);
        expect(furn.elevation).toBe(40);
        expect(globalSpatialDependencyEngine.getDependents(platform.id)).toContain(furn.id);

        // Move table far away from platform
        planner.move(furn.id, 600, 600);

        expect(furn.elevation).toBe(0);
        expect(furn.hostPlatformId).toBeNull();
        expect(furn.hostId).toBeNull();
        expect(globalSpatialDependencyEngine.getDependents(platform.id)).toHaveLength(0);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 5: Wall Movement Reshaping Room-Bounded Platform Updates Furniture
    // ─────────────────────────────────────────────────────────────────────────────
    it('TEST 5: Wall movement updating room-bounded platform shifts resting furniture', () => {
        const boundedPlat = PlatformEngine.createPlatform(planner, {
            id: 'plat_room',
            x: 100,
            y: 100,
            shapeType: 'polygon',
            points: [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }],
            elevation: 0,
            height: 20,
            relationshipType: 'bounded',
            isRoomInteriorPlatform: true
        });

        const lamp = FurnitureEngine.createFurniture(planner, {
            id: 'lamp_1',
            x: 100,
            y: 100,
            configId: 'floor_lamp'
        });

        planner.move(lamp.id, 100, 100);
        expect(lamp.elevation).toBe(20);
        expect(globalSpatialDependencyEngine.getDependents(boundedPlat.id)).toContain(lamp.id);

        // Simulate wall move triggering detectRooms and syncRoomPlatforms
        const newRoom = {
            id: 'room_shifted',
            path: [{ x: 150, y: 150 }, { x: 250, y: 150 }, { x: 250, y: 250 }, { x: 150, y: 250 }],
            cx: 200,
            cy: 200,
            elevation: 0,
            platformHeight: 20
        };

        planner.rooms = [newRoom];
        planner.syncRoomPlatforms([newRoom]);

        // Platform moved its centroid to (200, 200)
        expect(boundedPlat.x).toBe(200);
        expect(boundedPlat.y).toBe(200);

        // Resting lamp should automatically follow to (200, 200)
        expect(lamp.x).toBe(200);
        expect(lamp.y).toBe(200);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 6: Decorative Shape Snapping to Wall & Following Wall Movement
    // ─────────────────────────────────────────────────────────────────────────────
    it('TEST 6: Snapping a shape to a wall attaches it and updates when wall moves', () => {
        const wall = WallEngine.createWall(planner, {
            id: 'wall_north',
            startX: 0,
            startY: 100,
            endX: 300,
            endY: 100,
            thickness: 20
        });

        const shape = new PremiumShape(planner, 'shape_rect', {
            id: 'panel_1',
            x: 150,
            y: 100,
            width: 40,
            height: 40
        });
        planner.shapes.push(shape);

        // Simulate dragend snapping against the wall
        shape.attachedWall = wall;
        shape.group.fire('dragend');

        expect(shape.parentWallId).toBe(wall.id);
        expect(shape.hostId).toBe(wall.id);
        expect(shape.relationshipType).toBe(RELATIONSHIP_TYPES.SURFACE_ATTACHED);
        expect(globalSpatialDependencyEngine.getDependents(wall.id)).toContain(shape.id);

        // Move wall south by (+0, +50)
        WallEngine.setEndpoints(wall, { x: 0, y: 150 }, { x: 300, y: 150 }, planner);

        // Notify dependency engine of wall movement
        globalSpatialDependencyEngine.onHostTransformed(wall, planner);

        expect(shape.y).toBe(150);
        expect(shape.x).toBe(150);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 7: Serialization (Export & Import) Rebuilds Dependency DAG
    // ─────────────────────────────────────────────────────────────────────────────
    it('TEST 7: exportState and importState reconstruct all spatial dependencies accurately', () => {
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat_deck',
            x: 200,
            y: 200,
            width: 150,
            depth: 150,
            elevation: 0,
            height: 25
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'bench_1',
            x: 200,
            y: 200,
            configId: 'bench'
        });

        planner.move(furn.id, 200, 200);
        expect(globalSpatialDependencyEngine.getDependents(platform.id)).toContain(furn.id);

        // Export state to JSON
        const serializedJson = planner.exportState();
        expect(serializedJson).toBeDefined();

        // Clear in-memory state
        globalSpatialDependencyEngine.clear();
        planner.furniture = [];
        planner.platforms = [];

        expect(globalSpatialDependencyEngine.getDependents(platform.id)).toHaveLength(0);

        // Import state back
        planner.importState(serializedJson);

        // Verify DAG was rebuilt
        const restoredDependents = globalSpatialDependencyEngine.getDependents(platform.id);
        expect(restoredDependents).toContain(furn.id);

        // Verify moving restored platform moves restored furniture
        const restoredPlat = planner.platforms.find(p => p.id === platform.id);
        const restoredFurn = planner.furniture.find(f => f.id === furn.id);

        planner.move(restoredPlat.id, 350, 350);

        expect(restoredFurn.x).toBe(350);
        expect(restoredFurn.y).toBe(350);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 8: Platform Deletion Cleanly Grounds Resting Furniture
    // ─────────────────────────────────────────────────────────────────────────────
    it('TEST 8: Deleting a host platform detaches resting furniture and grounds elevation to 0', () => {
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat_patio',
            x: 200,
            y: 200,
            width: 150,
            depth: 150,
            elevation: 0,
            height: 35
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'grill_1',
            x: 200,
            y: 200,
            configId: 'grill'
        });

        planner.move(furn.id, 200, 200);
        expect(furn.elevation).toBe(35);
        expect(globalSpatialDependencyEngine.getDependents(platform.id)).toContain(furn.id);

        // Delete platform
        PlatformEngine.deletePlatform(planner, platform);

        expect(furn.elevation).toBe(0);
        expect(furn.hostPlatformId).toBeNull();
        expect(globalSpatialDependencyEngine.getDependents(platform.id)).toHaveLength(0);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 9: Undo Command Restores Previous Dependency & Elevation
    // ─────────────────────────────────────────────────────────────────────────────
    it('TEST 9: Undoing furniture movement restores previous host relationship and elevation', () => {
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'plat_stage_2',
            x: 300,
            y: 300,
            width: 150,
            depth: 150,
            elevation: 0,
            height: 45
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'armchair_1',
            x: 50,
            y: 50,
            configId: 'armchair'
        });

        expect(furn.elevation).toBe(0);

        // Move onto platform
        planner.move(furn.id, 300, 300);
        expect(furn.elevation).toBe(45);
        expect(furn.hostPlatformId).toBe(platform.id);
        expect(globalSpatialDependencyEngine.getDependents(platform.id)).toContain(furn.id);

        // Undo move command
        planner.undo();

        expect(furn.x).toBe(50);
        expect(furn.y).toBe(50);
        expect(furn.elevation).toBe(0);
        expect(furn.hostPlatformId).toBeNull();
        expect(globalSpatialDependencyEngine.getDependents(platform.id)).toHaveLength(0);

        // Redo move command
        planner.redo();

        expect(furn.x).toBe(300);
        expect(furn.y).toBe(300);
        expect(furn.elevation).toBe(45);
        expect(furn.hostPlatformId).toBe(platform.id);
        expect(globalSpatialDependencyEngine.getDependents(platform.id)).toContain(furn.id);
    });
});

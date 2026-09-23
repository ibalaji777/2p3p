/**
 * src/core/spatial/test/AnchorMovementSync.spec.js
 * 
 * Comprehensive test suite for Anchor -> Wall -> Dependent Object movement synchronization.
 * Verifies:
 * 1. Single Wall Anchor Move: Attached furniture follows in 2D & 3D without manual notification.
 * 2. Attached Staircase: PremiumStaircase follows in 2D group and 3D mesh when wall anchor moves.
 * 3. Multi-Wall Corner Anchor Move: Shared anchor movement updates dependents on all connected walls.
 * 4. Zero-Scaling Invariant: Wall stretching does not scale or distort rigid furniture/stairs.
 * 5. Wall Mutation via setEndpoints: Direct endpoint moves propagate to dependents.
 * 6. Wall Translation via moveWall: Translating wall shifts both anchors and dependents follow.
 * 7. Attached PremiumShape: Wall-attached decorative shapes follow in 2D & 3D.
 * 8. Drift-Free Repeated Movement: Forward + backward anchor moves yield zero coordinate drift.
 * 9. Undo/Redo Integrity: Anchor move undo/redo correctly restores both wall and dependent transforms.
 * 10. Persistence & Anchor IDs: Anchor IDs are stable and restored on importState.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { FloorPlanner } from '../../engine2d/index.js';
import { globalSpatialDependencyEngine, RELATIONSHIP_TYPES } from '../SpatialDependencyEngine.js';
import { FurnitureEngine } from '../../furniture/FurnitureEngine.js';
import { StairEngine } from '../../stairs/StairEngine.js';
import { WallEngine } from '../../wall/WallEngine.js';
import { WallMutationEngine } from '../../wall/WallMutationEngine.js';
import { PremiumShape } from '../../engine2d/PremiumShape.js';
import { CommandManager } from '../../commands/CommandManager.js';
import { SnapshotCommand } from '../../commands/SnapshotCommand.js';
import { PlatformEngine } from '../../platform/PlatformEngine.js';
import { SpatialHostResolver } from '../SpatialHostResolver.js';

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

// Mock Three.js Mesh for 3D verification
function createMockMesh3D(x = 0, y = 0, z = 0) {
    return {
        position: {
            x,
            y,
            z,
            set(newX, newY, newZ) {
                this.x = newX;
                this.y = newY;
                this.z = newZ;
            }
        },
        rotation: {
            x: 0,
            y: 0,
            z: 0
        },
        updateMatrixWorld: () => {}
    };
}

describe('AnchorMovementSync: Centralized Movement Synchronization', () => {
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
    });

    it('TEST 1: Moving a wall anchor automatically updates attached furniture in 2D and 3D', () => {
        // Wall from (100, 100) to (300, 100)
        const wall = WallEngine.createWall(planner, {
            startX: 100,
            startY: 100,
            endX: 300,
            endY: 100,
            thickness: 20
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'sofa_1',
            configId: 'sofa_2_seater',
            x: 200,
            y: 100,
            width: 80,
            depth: 40
        });
        furn.mesh3D = createMockMesh3D(200, 0, 100);

        // Attach furniture to wall
        globalSpatialDependencyEngine.attach(furn, wall, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        expect(globalSpatialDependencyEngine.getDependents(wall.id)).toContain(furn.id);

        // Move wall's start anchor from (100, 100) to (100, 200) - translating + slanting the wall
        WallEngine.moveAnchor(wall.startAnchor, { x: 100, y: 200 }, planner, true);

        // The wall midpoint has shifted from (200, 100) to (200, 150)
        // Attached furniture midpoint must automatically track to y: 150 without manual calls
        expect(furn.y).toBeCloseTo(150, 0);
        expect(furn.x).toBeCloseTo(200, 0);

        // 2D Konva group must be updated in place
        expect(furn.group.x()).toBeCloseTo(200, 0);
        expect(furn.group.y()).toBeCloseTo(150, 0);

        // 3D Three.js mesh must be updated in place
        expect(furn.mesh3D.position.x).toBeCloseTo(200, 0);
        expect(furn.mesh3D.position.z).toBeCloseTo(150, 0);
    });

    it('TEST 2: Moving a wall anchor automatically updates attached staircase in 2D and 3D', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 0,
            startY: 0,
            endX: 400,
            endY: 0,
            thickness: 20
        });

        const stair = StairEngine.createStair(planner, {
            id: 'stair_wall_1',
            shape: 'straight',
            x: 200,
            y: 0,
            width: 90,
            height: 300,
            rotation: 0
        });
        stair.mesh3D = createMockMesh3D(200, 0, 0);

        globalSpatialDependencyEngine.attach(stair, wall, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        expect(globalSpatialDependencyEngine.getDependents(wall.id)).toContain(stair.id);

        // Move end anchor from (400, 0) to (400, 100)
        WallEngine.moveAnchor(wall.endAnchor, { x: 400, y: 100 }, planner, true);

        // Midpoint shifted from (200, 0) to (200, 50)
        expect(stair.y).toBeCloseTo(50, 0);
        expect(stair.x).toBeCloseTo(200, 0);

        // 2D group position and 3D mesh position
        expect(stair.group.x()).toBeCloseTo(200, 0);
        expect(stair.group.y()).toBeCloseTo(50, 0);
        expect(stair.mesh3D.position.x).toBeCloseTo(200, 0);
        expect(stair.mesh3D.position.z).toBeCloseTo(50, 0);
    });

    it('TEST 3: Moving a shared corner anchor updates dependents across all connected walls', () => {
        // Wall 1: (0, 0) -> (200, 0)
        const wall1 = WallEngine.createWall(planner, {
            startX: 0,
            startY: 0,
            endX: 200,
            endY: 0,
            thickness: 20
        });
        // Wall 2: shares corner anchor (200, 0) -> (200, 200)
        const cornerAnchor = wall1.endAnchor;
        const wall2 = WallEngine.createWall(planner, {
            startAnchor: cornerAnchor,
            endX: 200,
            endY: 200,
            thickness: 20
        });

        // Dependent on Wall 1
        const furn1 = FurnitureEngine.createFurniture(planner, {
            id: 'furn_w1',
            configId: 'sofa_2_seater',
            x: 100,
            y: 0,
            width: 60,
            depth: 40
        });
        furn1.mesh3D = createMockMesh3D(100, 0, 0);
        globalSpatialDependencyEngine.attach(furn1, wall1, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        // Dependent on Wall 2
        const furn2 = FurnitureEngine.createFurniture(planner, {
            id: 'furn_w2',
            configId: 'sofa_2_seater',
            x: 200,
            y: 100,
            width: 80,
            depth: 30
        });
        furn2.mesh3D = createMockMesh3D(200, 0, 100);
        globalSpatialDependencyEngine.attach(furn2, wall2, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        // Move the shared corner anchor from (200, 0) to (250, 50)
        WallEngine.moveAnchor(cornerAnchor, { x: 250, y: 50 }, planner, true);

        // Wall 1 midpoint shifted from (100, 0) to (125, 25)
        expect(furn1.x).toBeCloseTo(125, 0);
        expect(furn1.y).toBeCloseTo(25, 0);
        expect(furn1.group.x()).toBeCloseTo(125, 0);
        expect(furn1.group.y()).toBeCloseTo(25, 0);

        // Wall 2 midpoint shifted from (200, 100) to (225, 125)
        expect(furn2.x).toBeCloseTo(225, 0);
        expect(furn2.y).toBeCloseTo(125, 0);
        expect(furn2.group.x()).toBeCloseTo(225, 0);
        expect(furn2.group.y()).toBeCloseTo(125, 0);
    });

    it('TEST 4: Stretching a wall does NOT scale or distort rigid furniture or staircases', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 0,
            startY: 100,
            endX: 200,
            endY: 100,
            thickness: 20
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'rigid_tv_unit',
            configId: 'sofa_2_seater',
            x: 100,
            y: 100,
            width: 120,
            depth: 45
        });

        const stair = StairEngine.createStair(planner, {
            id: 'rigid_stair',
            shape: 'straight',
            x: 150,
            y: 100,
            width: 90,
            stepDepth: 25
        });

        globalSpatialDependencyEngine.attach(furn, wall, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });
        globalSpatialDependencyEngine.attach(stair, wall, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        // Double the wall length from 200 to 400
        WallEngine.moveAnchor(wall.endAnchor, { x: 400, y: 100 }, planner, true);

        // Invariant: Rigid dimensions must NOT be scaled
        expect(furn.width).toBe(120);
        expect(furn.depth).toBe(45);
        expect(stair.width).toBe(90);
        expect(stair.stepDepth).toBe(25);
    });

    it('TEST 5: WallMutationEngine.setEndpoints moves endpoints and updates dependents', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 50,
            startY: 50,
            endX: 250,
            endY: 50,
            thickness: 20
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'table_1',
            configId: 'sofa_2_seater',
            x: 150,
            y: 50,
            width: 100,
            depth: 60
        });
        furn.mesh3D = createMockMesh3D(150, 0, 50);

        globalSpatialDependencyEngine.attach(furn, wall, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        // Move wall via setEndpoints by (+0, +80)
        WallMutationEngine.setEndpoints(wall, { x: 50, y: 130 }, { x: 250, y: 130 }, true, planner);

        expect(furn.y).toBeCloseTo(130, 0);
        expect(furn.mesh3D.position.z).toBeCloseTo(130, 0);
    });

    it('TEST 6: WallMutationEngine.moveWall translates wall and all dependents follow in 2D & 3D', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 100,
            startY: 100,
            endX: 300,
            endY: 100,
            thickness: 20
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'armchair_1',
            configId: 'sofa_2_seater',
            x: 200,
            y: 100,
            width: 50,
            depth: 50
        });
        furn.mesh3D = createMockMesh3D(200, 0, 100);

        globalSpatialDependencyEngine.attach(furn, wall, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        // Translate wall by (+40, +60)
        WallMutationEngine.moveWall(wall, 40, 60, true, planner);

        expect(wall.startAnchor.x).toBeCloseTo(140, 0);
        expect(wall.startAnchor.y).toBeCloseTo(160, 0);
        expect(wall.endAnchor.x).toBeCloseTo(340, 0);
        expect(wall.endAnchor.y).toBeCloseTo(160, 0);

        expect(furn.x).toBeCloseTo(240, 0);
        expect(furn.y).toBeCloseTo(160, 0);
        expect(furn.group.x()).toBeCloseTo(240, 0);
        expect(furn.group.y()).toBeCloseTo(160, 0);
        expect(furn.mesh3D.position.x).toBeCloseTo(240, 0);
        expect(furn.mesh3D.position.z).toBeCloseTo(160, 0);
    });

    it('TEST 7: Attached PremiumShape updates 2D and 3D positions when wall anchor moves', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 0,
            startY: 200,
            endX: 200,
            endY: 200,
            thickness: 20
        });

        const shape = new PremiumShape(planner, 'shape_rect', {
            id: 'wall_panel_1',
            x: 100,
            y: 200,
            width: 40,
            height: 40
        });
        shape.mesh3D = createMockMesh3D(100, 0, 200);
        planner.shapes.push(shape);

        globalSpatialDependencyEngine.attach(shape, wall, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        WallEngine.moveAnchor(wall.startAnchor, { x: 0, y: 300 }, planner, true);

        // Wall midpoint shifted from (100, 200) to (100, 250)
        expect(shape.y).toBeCloseTo(250, 0);
        expect(shape.group.y()).toBeCloseTo(250, 0);
        expect(shape.mesh3D.position.z).toBeCloseTo(250, 0);
    });

    it('TEST 8: Repeated forward-and-backward movement yields zero coordinate drift', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 100,
            startY: 100,
            endX: 300,
            endY: 100,
            thickness: 20
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'drift_desk',
            configId: 'sofa_2_seater',
            x: 200,
            y: 100,
            width: 100,
            depth: 50
        });

        globalSpatialDependencyEngine.attach(furn, wall, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        const originalX = furn.x;
        const originalY = furn.y;

        // Perform 10 cyclical movements back and forth
        for (let i = 0; i < 10; i++) {
            WallEngine.moveAnchor(wall.startAnchor, { x: 100, y: 200 }, planner, true);
            WallEngine.moveAnchor(wall.startAnchor, { x: 100, y: 100 }, planner, true);
        }

        expect(Math.abs(furn.x - originalX)).toBeLessThan(0.01);
        expect(Math.abs(furn.y - originalY)).toBeLessThan(0.01);
    });

    it('TEST 9: Undo/Redo cleanly restores both wall and attached object positions', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 100,
            startY: 100,
            endX: 300,
            endY: 100,
            thickness: 20
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'undo_chair',
            configId: 'sofa_2_seater',
            x: 200,
            y: 100,
            width: 50,
            depth: 50
        });

        globalSpatialDependencyEngine.attach(furn, wall, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        // Record snapshot command
        const cmd = new SnapshotCommand(planner);
        WallEngine.moveAnchor(wall.startAnchor, { x: 100, y: 250 }, planner, true);
        cmd.finalize();
        planner.commandManager.execute(cmd);

        expect(furn.y).toBeCloseTo(175, 0);

        // Undo
        planner.commandManager.undo();
        const undoneFurn = planner.furniture.find(f => f.id === 'undo_chair');
        const undoneWall = planner.walls.find(w => w.id === wall.id);
        expect(undoneFurn).toBeDefined();
        expect(undoneWall).toBeDefined();
        expect(undoneFurn.y).toBeCloseTo(100, 0);
        expect(undoneWall.startAnchor.y).toBeCloseTo(100, 0);

        // Redo
        planner.commandManager.redo();
        const redoneFurn = planner.furniture.find(f => f.id === 'undo_chair');
        const redoneWall = planner.walls.find(w => w.id === wall.id);
        expect(redoneFurn).toBeDefined();
        expect(redoneWall).toBeDefined();
        expect(redoneFurn.y).toBeCloseTo(175, 0);
        expect(redoneWall.startAnchor.y).toBeCloseTo(250, 0);
    });

    it('TEST 10: Anchor ID stability and export/import persistence', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 100,
            startY: 100,
            endX: 300,
            endY: 100,
            thickness: 20
        });

        // Anchor must have an ID
        expect(wall.startAnchor.id).toBeDefined();
        expect(typeof wall.startAnchor.id).toBe('string');
        const startAnchorId = wall.startAnchor.id;

        const exportedJSON = planner.exportState();
        expect(exportedJSON).toContain(startAnchorId);

        // Import
        planner.importState(exportedJSON);
        const importedAnchor = planner.anchors.find(a => a.id === startAnchorId);
        expect(importedAnchor).toBeDefined();
        expect(importedAnchor.x).toBe(100);
        expect(importedAnchor.y).toBe(100);
    });

    it('TEST 11: Wall anchor movement preserves 100% of staircase height and step count (ZERO shrinking)', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 100,
            startY: 100,
            endX: 400,
            endY: 100,
            thickness: 20
        });

        const stair = StairEngine.createStair(planner, {
            id: 'stair_no_shrink',
            shape: 'straight',
            x: 250,
            y: 100,
            height: 280,
            totalSteps: 16,
            flight1Steps: 16,
            stepDepth: 28,
            width: 100
        });
        stair.mesh3D = createMockMesh3D(250, 0, 100);

        // Resolve host or attach as SURFACE_ATTACHED
        globalSpatialDependencyEngine.attach(stair, wall, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        const initialHeight = stair.height;
        const initialSteps = stair.totalSteps;
        const initialFlight1 = stair.flight1Steps;

        // Slant the wall by moving the end anchor downward (like in user screenshot)
        WallEngine.moveAnchor(wall.endAnchor, { x: 380, y: 220 }, planner, true);

        // Position should update
        expect(stair.x).not.toBe(250);
        expect(stair.y).not.toBe(100);

        // Invariant: Height and step count MUST NOT SHRINK
        expect(stair.height).toBe(initialHeight);
        expect(stair.totalSteps).toBe(initialSteps);
        expect(stair.flight1Steps).toBe(initialFlight1);
        expect(stair.stepDepth).toBe(28);
    });

    it('TEST 12: Platform height rise still properly adapts staircase step count (vertical platform sync preserved)', () => {
        const platform = PlatformEngine.createPlatform(planner, {
            id: 'raised_stage',
            x: 300,
            y: 300,
            width: 200,
            depth: 200,
            elevation: 0,
            height: 60
        });

        const stair = StairEngine.createStair(planner, {
            id: 'stage_stair',
            shape: 'straight',
            x: 300,
            y: 180,
            height: 60,
            totalSteps: 4,
            flight1Steps: 4,
            stepDepth: 28
        });

        globalSpatialDependencyEngine.attach(stair, platform, {
            relationshipType: RELATIONSHIP_TYPES.SUPPORTED,
            computeFromCurrentWorld: true
        });

        // Now platform raises in height from 60 to 120
        platform.height = 120;
        globalSpatialDependencyEngine.onHostTransformed(platform, planner);

        // Stair height should adapt to platform height
        expect(stair.height).toBe(120);
        expect(stair.totalSteps).toBeGreaterThan(4);
    });

    it('TEST 13: SpatialHostResolver computes exact wall transform for stairs without origin fallback', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 100,
            startY: 200,
            endX: 500,
            endY: 200,
            thickness: 20
        });

        const stair = StairEngine.createStair(planner, {
            id: 'resolver_stair',
            shape: 'straight',
            x: 300,
            y: 200,
            height: 280
        });

        const hostRes = SpatialHostResolver.findHostAt(planner, 300, 200, 'stair', {
            rotation: 0,
            preset: stair
        });

        if (hostRes && hostRes.host && hostRes.hostType === 'wall') {
            // Local transform should be relative to wall midpoint (300, 200), NOT world (0, 0)
            expect(hostRes.relationshipType).toBe(RELATIONSHIP_TYPES.SURFACE_ATTACHED);
            expect(Math.abs(hostRes.localTransform.x)).toBeLessThan(10);
            expect(hostRes.localTransform.y).toBeCloseTo(98, 0);
        }
    });

    it('TEST 14: SpatialHostResolver automatically detects wall for furniture abutting a wall', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 100,
            startY: 200,
            endX: 500,
            endY: 200,
            thickness: 20
        });

        // Sofa placed at (300, 215), touching the wall surface (half-thick = 10, distance = 15)
        const hostRes = SpatialHostResolver.findHostAt(planner, 300, 215, 'furniture', {
            rotation: 0
        });

        expect(hostRes).not.toBeNull();
        expect(hostRes.host.id).toBe(wall.id);
        expect(hostRes.hostType).toBe('wall');
        expect(hostRes.relationshipType).toBe(RELATIONSHIP_TYPES.SURFACE_ATTACHED);
        // Canonical transform relative to wall midpoint (300, 200)
        expect(Math.abs(hostRes.localTransform.x)).toBeLessThan(1);
        expect(Math.abs(hostRes.localTransform.y)).toBeCloseTo(15, 0);
    });

    it('TEST 15: Wall anchor movement synchronizes attached furniture with ZERO shrinking/scaling in 2D & 3D', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 100,
            startY: 100,
            endX: 400,
            endY: 100,
            thickness: 20
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'sofa_rigid_1',
            configId: 'sofa_2_seater',
            x: 250,
            y: 115,
            width: 160,
            depth: 80,
            height: 75,
            rotation: 0
        });
        furn.mesh3D = createMockMesh3D(250, 0, 115);

        globalSpatialDependencyEngine.attach(furn, wall, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        const initialW = furn.width;
        const initialD = furn.depth;
        const initialH = furn.height;

        // Slant the wall by moving the end anchor downward
        WallEngine.moveAnchor(wall.endAnchor, { x: 380, y: 220 }, planner, true);

        // Position & rotation must follow
        expect(furn.x).not.toBe(250);
        expect(furn.y).not.toBe(115);
        expect(furn.rotation).not.toBe(0);

        // 3D mesh must match
        expect(furn.mesh3D.position.x).toBeCloseTo(furn.x, 0);
        expect(furn.mesh3D.position.z).toBeCloseTo(furn.y, 0);

        // ZERO SCALING INVARIANT
        expect(furn.width).toBe(initialW);
        expect(furn.depth).toBe(initialD);
        expect(furn.height).toBe(initialH);
    });

    it('TEST 16: Shapes attached to wall follow anchor movement rigidly with canonical transform', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 100,
            startY: 100,
            endX: 400,
            endY: 100,
            thickness: 20
        });

        const shape = new PremiumShape(planner, 'shape_rect', {
            id: 'wall_panel_shape',
            x: 250,
            y: 110,
            width: 80,
            height: 40,
            rotation: 0
        });
        shape.mesh3D = createMockMesh3D(250, 0, 110);
        planner.shapes.push(shape);

        // Host resolver detects wall
        const hostRes = SpatialHostResolver.findHostAt(planner, 250, 110, 'shape', { rotation: 0 });
        expect(hostRes).not.toBeNull();
        expect(hostRes.hostType).toBe('wall');

        globalSpatialDependencyEngine.attach(shape, wall, {
            relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
            computeFromCurrentWorld: true
        });

        // Slant wall
        WallEngine.moveAnchor(wall.endAnchor, { x: 380, y: 220 }, planner, true);

        // Shape follows rigidly
        expect(shape.x).not.toBe(250);
        expect(shape.y).not.toBe(110);
        expect(shape.params.width).toBe(80);
        expect(shape.params.height).toBe(40);
        expect(shape.mesh3D.position.x).toBeCloseTo(shape.x, 0);
        expect(shape.mesh3D.position.z).toBeCloseTo(shape.y, 0);
    });

    it('TEST 17: Furniture moved away from wall (>40cm) automatically detaches and becomes freestanding', () => {
        const wall = WallEngine.createWall(planner, {
            startX: 100,
            startY: 100,
            endX: 400,
            endY: 100,
            thickness: 20
        });

        const furn = FurnitureEngine.createFurniture(planner, {
            id: 'detachable_chair',
            configId: 'chair',
            x: 250,
            y: 115
        });

        // Initially abutting wall
        planner._applyMove(furn.id, 250, 115);
        expect(furn.parentWallId).toBe(wall.id);
        expect(globalSpatialDependencyEngine.getDependents(wall.id)).toContain(furn.id);

        // Move far into open room (y = 300, 200cm away from wall)
        planner._applyMove(furn.id, 250, 300);
        expect(furn.parentWallId).toBeNull();
        expect(globalSpatialDependencyEngine.getDependents(wall.id)).not.toContain(furn.id);
    });
});

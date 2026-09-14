import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { COMMON_TOOLS, COMMON_TOOL_DEFINITIONS, getToolDefinition } from '../tools/CommonToolRegistry.js';
import { CommonInteractionController } from '../tools/CommonInteractionController.js';
import { RoomInteractiveSuite } from '../RoomInteractiveSuite.js';
import { WallEngine } from '../../wall/WallEngine.js';

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

describe('Sims 4 Building Rise Tool & Specific Room Lift Suite', () => {
    let mockPlanner;
    let mockCtx;
    let mockCamera;
    let mockRenderer;
    let suite;

    beforeEach(() => {
        // Mock 3D scene & context
        mockCamera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
        mockCamera.position.set(0, 200, 300);
        mockCamera.lookAt(0, 0, 0);

        const canvas = document.createElement('canvas');
        mockRenderer = {
            domElement: canvas,
            setSize: vi.fn(),
            render: vi.fn()
        };

        const anchors = [];
        const walls = [];

        mockPlanner = {
            walls,
            anchors,
            rooms: [],
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
            selectEntity: vi.fn(),
            formatLength: (len) => `${Math.round(len)} cm`,
            syncAll: vi.fn(),
            update3D: vi.fn(),
            detectRooms: vi.fn()
        };

        mockCtx = {
            camera: mockCamera,
            renderer: mockRenderer,
            scene: new THREE.Scene(),
            planner: mockPlanner,
            controls: { enabled: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
            requestRender: vi.fn(),
            gizmoManager: { setTransformMode: vi.fn() },
            updateWallGeometryLive: vi.fn()
        };
        suite = new RoomInteractiveSuite(mockCtx);
        mockCtx.scene.add(suite);
    });

    it('registers COMMON_TOOLS.BUILDING_RISE in CommonToolRegistry', () => {
        expect(COMMON_TOOLS.BUILDING_RISE).toBe('building_rise');

        const def = getToolDefinition(COMMON_TOOLS.BUILDING_RISE);
        expect(def).toBeDefined();
        expect(def.label).toBe('Rise Tool');
        expect(def.hotkey).toBe('U');
        expect(def.requiresSelection).toBe(false);
    });

    it('CommonInteractionController activates BUILDING_RISE tool, opens building rise controls, and auto-attaches active room', () => {
        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0
        };
        mockPlanner.rooms = [room];

        const controller = new CommonInteractionController({
            ...mockCtx,
            interactions: { roomInteractiveSuite: suite }
        });

        const activateSpy = vi.spyOn(suite, 'activateBuildingRiseMode');
        controller.setTool(COMMON_TOOLS.BUILDING_RISE);

        expect(controller.activeTool).toBe(COMMON_TOOLS.BUILDING_RISE);
        expect(activateSpy).toHaveBeenCalled();
        expect(suite.isBuildingRiseMode).toBe(true);

        // Verify the 3D in-scene gizmo, cage, and arrows immediately appeared!
        expect(suite.visible).toBe(true);
        expect(suite.room).toBe(room);
        expect(suite.liftHandleGroup.visible).toBe(true);
        expect(suite.roomCage.visible).toBe(true);
        expect(suite.edgeArrowsGroup.visible).toBe(true);
    });

    it('attaches directly when passed a raw room entity without a floor mesh wrapper', () => {
        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 300, y: 0 },
                { x: 300, y: 200 },
                { x: 0, y: 200 }
            ],
            cx: 150,
            cy: 100,
            elevation: 10
        };

        suite.attach(room);

        expect(suite.visible).toBe(true);
        expect(suite.room).toBe(room);
        expect(suite.liftHandleGroup.visible).toBe(true);
        expect(suite.roomCage.visible).toBe(true);
        expect(suite.edgeArrowsGroup.visible).toBe(true);
    });

    it('Building Rise: adjusts height for all walls simultaneously via WallEngine.batchUpdate', () => {
        // Create 4 walls forming a building
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 280, elevation: 0
        });
        expect(mockPlanner.walls.length).toBe(4);

        // Call setAllWallsHeight on suite
        suite.setAllWallsHeight(360);

        mockPlanner.walls.forEach(w => {
            expect(w.height).toBe(360);
        });

        // Step height
        suite.stepAllWallsHeight(-60);
        mockPlanner.walls.forEach(w => {
            expect(w.height).toBe(300);
        });
    });

    it('Building Rise: adjusts elevation (foundation lift) for all walls simultaneously', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
        });

        suite.stepAllWallsElevation(15);
        mockPlanner.walls.forEach(w => {
            expect(w.elevation).toBe(15);
        });

        suite.stepAllWallsElevation(30);
        mockPlanner.walls.forEach(w => {
            expect(w.elevation).toBe(45);
        });
    });

    it('Specific Room Lift: attaches to room and creates 3D lift handle, perimeter cage, and edge arrows', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
        });

        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0
        };

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.userData = { isFloor: true, entity: room };

        suite.attach(floorMesh);

        expect(suite.visible).toBe(true);
        expect(suite.liftHandleGroup.visible).toBe(true);
        expect(suite.roomCage.visible).toBe(true);
        expect(suite.edgeArrowsGroup.visible).toBe(true);

        // Check 3D lift gizmo position at room volumetric center
        expect(suite.liftHandleGroup.position.x).toBe(200);
        expect(suite.liftHandleGroup.position.z).toBe(150);
        expect(suite.liftHandleGroup.position.y).toBe(135); // 0 + 300 * 0.45

        // Check handle parts (stem, up cone, down cone)
        const parts = suite.liftHandleGroup.children.map(c => c.userData?.part).filter(Boolean);
        expect(parts).toContain('stem');
        expect(parts).toContain('up');
        expect(parts).toContain('down');
        expect(parts).not.toContain('cube');
        expect(parts).not.toContain('diagonal');

        // Check perimeter cage line count
        expect(suite.roomCage.children.length).toBeGreaterThan(0);
        // Check edge push/pull arrows count (4 walls = 4 arrows)
        expect(suite.edgeArrowsGroup.children.length).toBe(4);
    });

    it('Specific Room Lift: stepRoomElevation lifts room elevation and updates enclosing walls', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
        });

        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0
        };

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.userData = { isFloor: true, entity: room };

        suite.attach(floorMesh);
        suite.stepRoomElevation(15);

        expect(room.elevation).toBe(15);
        expect(suite.liftHandleGroup.position.y).toBe(150); // 15 + 300 * 0.45

        // Enclosing walls elevation should now match
        mockPlanner.walls.forEach(w => {
            expect(w.elevation).toBe(15);
        });

        // Lift again by +30cm
        suite.stepRoomElevation(30);
        expect(room.elevation).toBe(45);
        mockPlanner.walls.forEach(w => {
            expect(w.elevation).toBe(45);
        });
    });

    it('Specific Room Lift: setRoomWallHeight updates wall height for bounding walls', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 280, elevation: 0
        });

        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0
        };

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.userData = { isFloor: true, entity: room };

        suite.attach(floorMesh);
        suite.setRoomWallHeight(360);

        mockPlanner.walls.forEach(w => {
            expect(w.height).toBe(360);
        });
    });

    it('Specific Room Lift: detaches cleanly and hides 3D elements', () => {
        const room = {
            path: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
            cx: 50, cy: 50, elevation: 0
        };
        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.userData = { isFloor: true, entity: room };

        suite.attach(floorMesh);
        expect(suite.visible).toBe(true);

        suite.detach();
        expect(suite.room).toBeNull();
        expect(suite.liftHandleGroup.visible).toBe(false);
        expect(suite.roomCage.visible).toBe(false);
        expect(suite.edgeArrowsGroup.visible).toBe(false);
    });

    it('Dedicated Done: finishAndExit cleanly deactivates rise mode, detaches, and switches back to select', () => {
        const room = {
            path: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
            cx: 50, cy: 50, elevation: 0
        };
        mockPlanner.rooms = [room];

        const controller = new CommonInteractionController(mockCtx);
        mockCtx.interactions = { roomInteractiveSuite: suite, commonController: controller, deselect: vi.fn() };
        controller.interactions = mockCtx.interactions;

        controller.setTool(COMMON_TOOLS.BUILDING_RISE);
        expect(suite.isBuildingRiseMode).toBe(true);
        expect(suite.visible).toBe(true);

        // Click Dedicated Done
        suite.finishAndExit();

        expect(suite.isBuildingRiseMode).toBe(false);
        expect(suite.visible).toBe(false);
        expect(suite.room).toBeNull();
        expect(controller.activeTool).toBe(COMMON_TOOLS.SELECT);
    });

    it('Scope Mode: toggles between room and building scope and routes elevation and height accordingly', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
        });

        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0
        };

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.userData = { isFloor: true, entity: room };

        suite.attach(floorMesh);
        expect(suite.scopeMode).toBe('room');

        // Step elevation in room mode
        suite.stepElevation(15);
        expect(room.elevation).toBe(15);
        mockPlanner.walls.forEach(w => expect(w.elevation).toBe(15));

        // Switch to building mode
        suite.setScopeMode('building');
        expect(suite.scopeMode).toBe('building');
        expect(suite.isBuildingRiseMode).toBe(true);

        // Step elevation in building mode
        suite.stepElevation(30);
        mockPlanner.walls.forEach(w => expect(w.elevation).toBe(45));

        // Set wall height in building mode
        suite.setWallHeight(360);
        mockPlanner.walls.forEach(w => expect(w.height).toBe(360));

        // Switch back to room mode
        suite.setScopeMode('room');
        expect(suite.scopeMode).toBe('room');
        expect(suite.isBuildingRiseMode).toBe(false);
    });

    it('Click-to-Step Hybrid: single click on Up and Down immediately steps values based on mode', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
        });

        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0
        };

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.userData = { isFloor: true, entity: room };
        suite.attach(floorMesh);

        // 1. In 'wall' mode: simulate single click on Up Cone (delta distance = 0)
        suite.setTargetAdjustMode('wall');
        suite.activeDragMode = 'up';
        suite.dragDistance = 2; // < 6px implies single click
        suite._onPointerUp({ clientX: 100, clientY: 100 });

        expect(room.wallHeight).toBe(310);
        mockPlanner.walls.forEach(w => expect(w.height).toBe(310));

        // 2. In 'wall' mode: simulate single click on Down Cone (delta distance = 0)
        suite.activeDragMode = 'down';
        suite.dragDistance = 1; // < 6px implies single click
        suite._onPointerUp({ clientX: 100, clientY: 100 });

        expect(room.wallHeight).toBe(300);
        mockPlanner.walls.forEach(w => expect(w.height).toBe(300));

        // 3. Switch to 'foundation' mode: single click on Up steps elevation +15cm and forms platform
        suite.setTargetAdjustMode('foundation');
        suite.activeDragMode = 'up';
        suite.dragDistance = 0; // single click
        suite._onPointerUp({ clientX: 100, clientY: 100 });

        expect(room.elevation).toBe(15);
        expect(mockPlanner.platforms.length).toBeGreaterThan(0);
        expect(mockPlanner.platforms[0].height).toBe(15);
    });

    it('Keyboard Shortcuts: Escape or Enter key finishes and exits cleanly', () => {
        const room = {
            path: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
            cx: 50, cy: 50, elevation: 0
        };
        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.userData = { isFloor: true, entity: room };

        const controller = new CommonInteractionController(mockCtx);
        mockCtx.interactions = { roomInteractiveSuite: suite, commonController: controller, deselect: vi.fn() };
        controller.interactions = mockCtx.interactions;

        suite.attach(floorMesh);
        expect(suite.visible).toBe(true);

        // Press Escape
        suite._onKeyDown({ key: 'Escape' });
        expect(suite.visible).toBe(false);
        expect(suite.room).toBeNull();
        expect(controller.activeTool).toBe(COMMON_TOOLS.SELECT);
    });

    it('Sims 4 Gizmo: all colliders are raycastable in Three.js (transparent: true, opacity: 0, visible !== false)', () => {
        const room = {
            path: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
            cx: 100, cy: 100, elevation: 0
        };
        suite.attach(room);

        // Check lift handle colliders (Top Up and Bottom Down colliders)
        const colliders = suite.liftHandleGroup.children.filter(c => c.material && c.material.transparent && c.material.opacity === 0);
        expect(colliders.length).toBe(2);

        colliders.forEach(c => {
            // In Three.js, raycast aborts if material.visible === false.
            // Our colliders must have visible !== false (i.e. visible: true)
            expect(c.material.visible).not.toBe(false);
            expect(c.material.opacity).toBe(0);
        });

        // Check edge arrow colliders
        expect(suite.edgeArrowsGroup.children.length).toBe(4);
        suite.edgeArrowsGroup.children.forEach(arrowGroup => {
            const edgeCollider = arrowGroup.children.find(c => c.material && c.material.opacity === 0);
            expect(edgeCollider).toBeDefined();
            expect(edgeCollider.material.visible).not.toBe(false);
        });
    });

    it('Sims 4 Styling: includes top and bottom collar disks, pearl-white base, and white double-rail cage', () => {
        const room = {
            path: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
            cx: 100, cy: 100, elevation: 0
        };
        suite.attach(room);

        // Verify collar disks exist
        expect(suite.topCollarMesh).toBeDefined();
        expect(suite.btmCollarMesh).toBeDefined();
        expect(suite.topConeMesh).toBeDefined();
        expect(suite.btmConeMesh).toBeDefined();

        // Verify base material is pearl-white
        expect(suite.matBase.color.getHex()).toBe(0xf8fafc);

        // Verify room cage uses pure white (0xffffff) lines
        expect(suite.roomCage.children.length).toBeGreaterThan(0);
        const lineMesh = suite.roomCage.children[0];
        expect(lineMesh.material.color.getHex()).toBe(0xffffff);
    });

    it('Live Drag: _applyRoomElevationLive smoothly updates floor position and wall elevations in-place without detectRooms()', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 200, maxY: 200, thickness: 20, height: 300, elevation: 0
        });

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.position.y = 0.05;
        const room = {
            path: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
            cx: 100, cy: 100, elevation: 0,
            mesh3D: floorMesh
        };
        floorMesh.userData = { isFloor: true, entity: room };
        suite.attach(floorMesh);

        mockPlanner.detectRooms.mockClear();

        // Apply live elevation during drag
        suite._applyRoomElevationLive(45, mockPlanner);

        expect(room.elevation).toBe(45);
        expect(floorMesh.position.y).toBeCloseTo(45.05);
        mockPlanner.walls.forEach(w => expect(w.elevation).toBe(45));

        // CRITICAL: detectRooms() should NOT be called during live drag
        expect(mockPlanner.detectRooms).not.toHaveBeenCalled();
    });

    it('Hover Highlights: _setGizmoPartHighlight applies luminescent material to active part and restores on unhover', () => {
        const room = {
            path: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
            cx: 100, cy: 100, elevation: 0
        };
        suite.attach(room);

        // Initially base material
        expect(suite.topConeMesh.material).toBe(suite.matBase);
        expect(suite.topCollarMesh.material).toBe(suite.matBase);

        // Hover over up cone
        suite._setGizmoPartHighlight('up');
        expect(suite.topConeMesh.material).toBe(suite.matHighlight);
        expect(suite.topCollarMesh.material).toBe(suite.matHighlight);
        expect(suite.btmConeMesh.material).toBe(suite.matBase);

        // Hover over down cone
        suite._setGizmoPartHighlight('down');
        expect(suite.topConeMesh.material).toBe(suite.matBase);
        expect(suite.btmConeMesh.material).toBe(suite.matHighlight);
        expect(suite.btmCollarMesh.material).toBe(suite.matHighlight);

        // Unhover (null)
        suite._setGizmoPartHighlight(null);
        expect(suite.topConeMesh.material).toBe(suite.matBase);
        expect(suite.btmConeMesh.material).toBe(suite.matBase);
    });

    it('3D Wall Synchronization: setRoomWallHeight triggers updateWallGeometryLive on all room bounding walls', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 280, elevation: 0
        });

        // Give each wall a mock mesh3D
        mockPlanner.walls.forEach(w => {
            w.mesh3D = new THREE.Group();
        });

        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0
        };

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.userData = { isFloor: true, entity: room };
        suite.attach(floorMesh);

        mockCtx.updateWallGeometryLive.mockClear();

        suite.setRoomWallHeight(360);

        // All 4 walls should have height 360
        mockPlanner.walls.forEach(w => {
            expect(w.height).toBe(360);
        });

        // updateWallGeometryLive must be called for each bounding wall
        expect(mockCtx.updateWallGeometryLive).toHaveBeenCalledTimes(4);
        mockPlanner.walls.forEach(w => {
            expect(mockCtx.updateWallGeometryLive).toHaveBeenCalledWith(w);
        });
    });

    it('3D Wall Synchronization: setAllWallsHeight triggers updateWallGeometryLive on all building walls', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 280, elevation: 0
        });

        mockCtx.updateWallGeometryLive.mockClear();

        suite.setAllWallsHeight(300);

        mockPlanner.walls.forEach(w => {
            expect(w.height).toBe(300);
        });
        expect(mockCtx.updateWallGeometryLive).toHaveBeenCalledTimes(4);
    });

    it('3D Wall Synchronization: setAllWallsElevation updates w.mesh3D.position.y and syncs geometry', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
        });

        mockPlanner.walls.forEach(w => {
            w.mesh3D = new THREE.Group();
            w.mesh3D.position.y = 0;
        });

        mockCtx.updateWallGeometryLive.mockClear();

        suite.setAllWallsElevation(60);

        mockPlanner.walls.forEach(w => {
            expect(w.elevation).toBe(60);
            expect(w.mesh3D.position.y).toBe(60);
        });
        expect(mockCtx.updateWallGeometryLive).toHaveBeenCalledTimes(4);
    });

    it('3D Wall Synchronization: _applyRoomElevationLive and _applyRoomElevationInternal dynamically move w.mesh3D.position.y', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
        });

        mockPlanner.walls.forEach(w => {
            w.mesh3D = new THREE.Group();
            w.mesh3D.position.y = 0;
        });

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.position.y = 0.05;
        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0,
            mesh3D: floorMesh
        };
        floorMesh.userData = { isFloor: true, entity: room };
        suite.attach(floorMesh);

        // 1. Live drag elevation
        suite._applyRoomElevationLive(120, mockPlanner);
        expect(room.elevation).toBe(120);
        expect(floorMesh.position.y).toBeCloseTo(120.05);
        mockPlanner.walls.forEach(w => {
            expect(w.elevation).toBe(120);
            expect(w.mesh3D.position.y).toBe(120);
        });

        // 2. Commit elevation internal
        mockCtx.updateWallGeometryLive.mockClear();
        suite._applyRoomElevationInternal(150, mockPlanner);
        expect(room.elevation).toBe(150);
        expect(floorMesh.position.y).toBeCloseTo(150.05);
        mockPlanner.walls.forEach(w => {
            expect(w.elevation).toBe(150);
            expect(w.mesh3D.position.y).toBe(150);
        });
        expect(mockCtx.updateWallGeometryLive).toHaveBeenCalledTimes(4);
    });

    it('3D Wall Synchronization: up height drag invokes updateWallGeometryLive during live movement', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
        });

        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0
        };

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.userData = { isFloor: true, entity: room };
        suite.attach(floorMesh);

        mockCtx.updateWallGeometryLive.mockClear();

        // Simulate pointer down on up cone
        suite.activeDragMode = 'up';
        suite.dragStartY = 200;
        suite.initialWallHeight = 300;
        suite.downX = 100;
        suite.downY = 200;

        // Move pointer upwards by 100 pixels: deltaCm = 100 * 0.6 = +60cm -> 360cm
        suite._onPointerMove({
            clientX: 100,
            clientY: 100,
            stopPropagation: vi.fn(),
            preventDefault: vi.fn()
        });

        mockPlanner.walls.forEach(w => {
            expect(w.height).toBe(360);
        });
        expect(mockCtx.updateWallGeometryLive).toHaveBeenCalledTimes(4);
    });

    it('Raiser Controls: foundation mode adjusts elevation and forms foundation platform on drag', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
        });

        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0
        };

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.userData = { isFloor: true, entity: room };
        suite.attach(floorMesh);

        // Switch to foundation mode and simulate drag on up handle
        suite.setTargetAdjustMode('foundation');
        suite.activeDragMode = 'up';
        suite.dragStartY = 200;
        suite.initialElev = 0;
        suite.downX = 100;
        suite.downY = 200;

        suite._onPointerMove({
            clientX: 100,
            clientY: 100,
            stopPropagation: vi.fn(),
            preventDefault: vi.fn()
        });

        expect(room.elevation).toBe(60);
        expect(mockPlanner.platforms.length).toBeGreaterThan(0);
        expect(mockPlanner.platforms[0].height).toBe(60);
    });

    it('stepWallHeight: increases and decreases wall height by delta in both building and room scope', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
        });

        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0
        };

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.userData = { isFloor: true, entity: room };
        suite.attach(floorMesh);

        // Room mode: step +10 -> 310
        suite.scopeMode = 'room';
        suite.stepWallHeight(10);
        mockPlanner.walls.forEach(w => expect(w.height).toBe(310));

        // Room mode: step -10 -> 300
        suite.stepWallHeight(-10);
        mockPlanner.walls.forEach(w => expect(w.height).toBe(300));

        // Building mode: step +10 -> 310
        suite.scopeMode = 'building';
        suite.stepWallHeight(10);
        mockPlanner.walls.forEach(w => expect(w.height).toBe(310));

        // Building mode: step -10 -> 300
        suite.stepWallHeight(-10);
        mockPlanner.walls.forEach(w => expect(w.height).toBe(300));
    });

    it('Building Foundation Drag: _applyBuildingElevationLive synchronizes walls, all room entities, and 3D floor meshes', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
        });

        mockPlanner.walls.forEach(w => {
            w.mesh3D = new THREE.Group();
            w.mesh3D.position.y = 0;
        });

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.position.y = 0.05;
        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0,
            mesh3D: floorMesh
        };
        floorMesh.userData = { isFloor: true, entity: room };
        mockPlanner.rooms = [room];
        mockCtx.interactables = [floorMesh];

        suite.activateBuildingRiseMode();
        mockPlanner.detectRooms.mockClear();

        // Drag foundation to +60cm
        suite._applyBuildingElevationLive(60, mockPlanner);

        // 1. All walls must be at elevation 60
        mockPlanner.walls.forEach(w => {
            expect(w.elevation).toBe(60);
            expect(w.mesh3D.position.y).toBe(60);
        });

        // 2. All rooms and floor meshes must be at elevation 60 + 0.05
        expect(room.elevation).toBe(60);
        expect(floorMesh.position.y).toBeCloseTo(60.05);

        // 3. detectRooms() must NEVER be called during live drag
        expect(mockPlanner.detectRooms).not.toHaveBeenCalled();
    });

    it('State Retention: re-entering building rise mode or attaching after Done preserves existing elevation and height', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 120, elevation: 60
        });

        mockPlanner.walls.forEach(w => {
            w.mesh3D = new THREE.Group();
            w.mesh3D.position.y = 60;
        });

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.position.y = 60.05;
        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 60,
            mesh3D: floorMesh
        };
        floorMesh.userData = { isFloor: true, entity: room };
        mockPlanner.rooms = [room];

        // 1. Activate Building Rise Mode
        suite.activateBuildingRiseMode();

        // Verify initial drag baseline reads existing wall elevation and height, not 0 and 300
        expect(suite.room.elevation).toBe(60);
        expect(suite._getRoomWallHeight()).toBe(120);

        // 2. Click Done / finishAndExit
        suite.finishAndExit();
        expect(suite.visible).toBe(false);

        // 3. Reactivate building rise mode again
        suite.activateBuildingRiseMode();

        // Must retain 60cm elevation and 120cm height!
        expect(suite.room.elevation).toBe(60);
        expect(suite._getRoomWallHeight()).toBe(120);
        expect(room.mesh3D.position.y).toBeCloseTo(60.05);
    });

    it('reproduces user scenario: Room mode elevation +90cm and wall height growth via buttons and drag', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 120, elevation: 0
        });

        mockPlanner.walls.forEach(w => {
            w.mesh3D = new THREE.Group();
            w.mesh3D.position.y = 0;
        });

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.position.y = 0.05;
        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0,
            mesh3D: floorMesh
        };
        floorMesh.userData = { isFloor: true, entity: room };
        mockPlanner.rooms = [room];

        // 1. User selects room
        suite.attach(floorMesh);
        expect(suite.scopeMode).toBe('room');
        expect(suite.room.elevation).toBe(0);
        expect(suite._getRoomWallHeight()).toBe(120);

        // 2. User raises platform 6 times (+15 * 6 = +90cm)
        for (let i = 0; i < 6; i++) {
            suite.stepRoomElevation(15);
        }
        expect(suite.room.elevation).toBe(90);
        mockPlanner.walls.forEach(w => {
            expect(w.elevation).toBe(90);
            expect(w.mesh3D.position.y).toBe(90);
        });

        // 3. User clicks ▲ to increase wall height from 120 to 130
        suite.stepWallHeight(10);
        expect(suite._getRoomWallHeight()).toBe(130);
        mockPlanner.walls.forEach(w => {
            expect(w.height).toBe(130);
        });

        // 4. User clicks pill '240' to grow wall to 240
        suite.setWallHeight(240);
        expect(suite._getRoomWallHeight()).toBe(240);
        mockPlanner.walls.forEach(w => {
            expect(w.height).toBe(240);
        });

        // 5. User clicks Done
        suite.finishAndExit();
        expect(suite.visible).toBe(false);

        // 6. User re-attaches the room (clicks again)
        suite.attach(floorMesh);
        // Elevation MUST still be 90, NOT reset to 0!
        expect(suite.room.elevation).toBe(90);
        expect(suite._getRoomWallHeight()).toBe(240);
    });

    it('Foundation Drag: stretches room foundation elevation smoothly and preserves it after finishAndExit', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 500, maxY: 400, thickness: 20, height: 120, elevation: 60
        });

        mockPlanner.walls.forEach(w => {
            w.mesh3D = new THREE.Group();
            w.mesh3D.position.y = 60;
        });

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.position.y = 60.05;
        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 500, y: 0 },
                { x: 500, y: 400 },
                { x: 0, y: 400 }
            ],
            cx: 250,
            cy: 200,
            elevation: 60,
            wallHeight: 120,
            mesh3D: floorMesh
        };
        floorMesh.userData = { isFloor: true, entity: room };
        mockPlanner.rooms = [room];

        suite.attach(floorMesh);
        expect(suite.room.elevation).toBe(60);
        expect(suite._getRoomWallHeight()).toBe(120);

        // Switch to foundation mode and simulate pointer down on up cone handle
        suite.setTargetAdjustMode('foundation');
        suite.activeDragMode = 'up';
        suite.dragStartY = 400;
        suite.dragStartX = 300;
        suite.downX = 300;
        suite.downY = 400;
        suite.initialWallHeight = 120;
        suite.initialElev = 60;

        // Simulate dragging upward by 100 pixels (deltaPixels = 100 -> deltaCm = 60 -> newElev = 120)
        suite._onPointerMove({
            clientX: 300,
            clientY: 300,
            stopPropagation: vi.fn(),
            preventDefault: vi.fn()
        });

        // Verify elevation grew during live drag and platform was created
        expect(suite.room.elevation).toBe(120);
        expect(mockPlanner.platforms.length).toBeGreaterThan(0);
        expect(mockPlanner.platforms[0].height).toBe(120);

        // Finalize pointer up
        suite._onPointerUp({
            clientX: 300,
            clientY: 300,
            pointerId: 1
        });
        expect(suite.activeDragMode).toBeNull();
        expect(suite.room.elevation).toBe(120);
        expect(mockPlanner.platforms[0].height).toBe(120);

        // Deselect & Done
        suite.finishAndExit();
        expect(suite.visible).toBe(false);

        // Re-attach: must remain at elevation 120
        suite.attach(floorMesh);
        expect(suite.room.elevation).toBe(120);
    });

    it('Building Rise Mode: lifting foundation and changing wall height keeps walls and all floors synchronized', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 600, maxY: 400, thickness: 20, height: 120, elevation: 0
        });

        mockPlanner.walls.forEach(w => {
            w.mesh3D = new THREE.Group();
            w.mesh3D.position.y = 0;
        });

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.position.y = 0.05;
        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 600, y: 0 },
                { x: 600, y: 400 },
                { x: 0, y: 400 }
            ],
            cx: 300,
            cy: 200,
            elevation: 0,
            wallHeight: 120,
            mesh3D: floorMesh
        };
        floorMesh.userData = { isFloor: true, entity: room };
        mockPlanner.rooms = [room];

        suite.activateBuildingRiseMode();
        expect(suite.isBuildingRiseMode).toBe(true);
        expect(suite.scopeMode).toBe('building');

        // Step foundation up by 60cm (+15 * 4)
        suite.stepAllWallsElevation(15);
        suite.stepAllWallsElevation(15);
        suite.stepAllWallsElevation(15);
        suite.stepAllWallsElevation(15);

        // Both all walls AND all rooms must be at 60
        expect(mockPlanner.walls[0].elevation).toBe(60);
        mockPlanner.walls.forEach(w => {
            expect(w.elevation).toBe(60);
            expect(w.mesh3D.position.y).toBe(60);
        });
        expect(room.elevation).toBe(60);
        expect(room.mesh3D.position.y).toBeCloseTo(60.05);

        // Step all walls height to 300cm
        suite.setAllWallsHeight(300);
        expect(suite._getRoomWallHeight()).toBe(300);
        mockPlanner.walls.forEach(w => {
            expect(w.height).toBe(300);
        });

        // Finish and exit
        suite.finishAndExit();
        expect(suite.isBuildingRiseMode).toBe(false);

        // Re-activate building rise mode: values must NOT reset to 0!
        suite.activateBuildingRiseMode();
        expect(suite._getRoomWallHeight()).toBe(300);
        expect(suite.room.elevation).toBe(60);
    });

    it('Wall Height Presets & Step Buttons: clicking 240, 300, 360, ▲, and ▼ immediately updates walls and room', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
        });

        mockPlanner.walls.forEach(w => {
            w.mesh3D = new THREE.Group();
        });

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 0,
            wallHeight: 300,
            mesh3D: floorMesh
        };
        floorMesh.userData = { isFloor: true, entity: room };
        mockPlanner.rooms = [room];

        suite.attach(floorMesh);
        expect(suite._getRoomWallHeight()).toBe(300);

        // Click preset 240
        suite.setWallHeight(240);
        expect(suite._getRoomWallHeight()).toBe(240);
        mockPlanner.walls.forEach(w => expect(w.height).toBe(240));
        expect(suite.room.wallHeight).toBe(240);

        // Click preset 360
        suite.setWallHeight(360);
        expect(suite._getRoomWallHeight()).toBe(360);
        mockPlanner.walls.forEach(w => expect(w.height).toBe(360));
        expect(suite.room.wallHeight).toBe(360);

        // Step wall height down by 10 (▼ button)
        suite.stepWallHeight(-10);
        expect(suite._getRoomWallHeight()).toBe(350);
        mockPlanner.walls.forEach(w => expect(w.height).toBe(350));

        // Step wall height up by 10 (▲ button)
        suite.stepWallHeight(10);
        expect(suite._getRoomWallHeight()).toBe(360);
        mockPlanner.walls.forEach(w => expect(w.height).toBe(360));
    });

    it('Re-attach Preservation: deselecting and re-attaching retains existing elevation and height without resetting', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 360, elevation: 90
        });

        mockPlanner.walls.forEach(w => {
            w.mesh3D = new THREE.Group();
            w.mesh3D.position.y = 90;
        });

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.position.y = 90.05;
        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 90,
            wallHeight: 360,
            mesh3D: floorMesh
        };
        floorMesh.userData = { isFloor: true, entity: room };
        mockPlanner.rooms = [room];

        // First attach
        suite.attach(floorMesh);
        expect(suite.room.elevation).toBe(90);
        expect(suite._getRoomWallHeight()).toBe(360);

        // Detach (Done)
        suite.finishAndExit();
        expect(suite.visible).toBe(false);

        // Re-attach
        suite.attach(floorMesh);
        expect(suite.room.elevation).toBe(90);
        expect(suite._getRoomWallHeight()).toBe(360);
        expect(floorMesh.position.y).toBeCloseTo(90.05);
    });

    it('Scope Mode Switch Preservation: toggling Room <-> Building preserves elevation seamlessly', () => {
        WallEngine.createRoomBox(mockPlanner, {
            minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 90
        });

        mockPlanner.walls.forEach(w => {
            w.mesh3D = new THREE.Group();
            w.mesh3D.position.y = 90;
        });

        const floorMesh = new THREE.Mesh(new THREE.BufferGeometry());
        floorMesh.position.y = 90.05;
        const room = {
            path: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            cx: 200,
            cy: 150,
            elevation: 90,
            wallHeight: 300,
            mesh3D: floorMesh
        };
        floorMesh.userData = { isFloor: true, entity: room };
        mockPlanner.rooms = [room];

        suite.attach(floorMesh);
        expect(suite.scopeMode).toBe('room');
        expect(suite.room.elevation).toBe(90);

        // Switch to Building mode: elevation must NOT be zeroed!
        suite.setScopeMode('building');
        expect(suite.scopeMode).toBe('building');
        expect(suite.room.elevation).toBe(90);
        expect(mockPlanner.walls[0].elevation).toBe(90);

        // Switch back to Room mode: elevation preserved!
        suite.setScopeMode('room');
        expect(suite.scopeMode).toBe('room');
        expect(suite.room.elevation).toBe(90);
    });

    describe('Foundation Platform Generation & Center of Raiser Interactions', () => {
        it('automatically creates a 3D foundation platform when building elevation is raised', () => {
            WallEngine.createRoomBox(mockPlanner, {
                minX: 0, minY: 0, maxX: 400, maxY: 300, thickness: 20, height: 300, elevation: 0
            });
            const room = {
                id: 'room_test_foundation',
                path: [
                    { x: 0, y: 0 },
                    { x: 400, y: 0 },
                    { x: 400, y: 300 },
                    { x: 0, y: 300 }
                ],
                cx: 200,
                cy: 150,
                elevation: 0
            };
            mockPlanner.rooms = [room];
            suite.attach(room);
            suite.setScopeMode('building');

            // Initially no platform at elevation 0
            expect(mockPlanner.platforms?.length || 0).toBe(0);

            // Raise building elevation by +30cm
            suite.stepAllWallsElevation(30);

            expect(mockPlanner.platforms.length).toBe(1);
            const p = mockPlanner.platforms[0];
            expect(p.height).toBe(30);
            expect(p.elevation).toBe(0);
            expect(p.isBuildingFoundation).toBe(true);
            expect(p.trimStyle).toBe('stone');
            expect(p.materials.side.id).toBe('stone_ashlar_grey');

            // Raise further by +15cm -> height becomes 45cm
            suite.stepAllWallsElevation(15);
            expect(mockPlanner.platforms.length).toBe(1);
            expect(p.height).toBe(45);

            // Lower back to 0 -> foundation platform is cleanly removed
            suite.setAllWallsElevation(0);
            expect(mockPlanner.platforms.length).toBe(0);
        });

        it('in foundation mode, single click on up arrow raises elevation and adds foundation platform', () => {
            WallEngine.createRoomBox(mockPlanner, {
                minX: 0, minY: 0, maxX: 300, maxY: 300, thickness: 20, height: 280, elevation: 0
            });
            const room = {
                id: 'room_center_click',
                path: [
                    { x: 0, y: 0 },
                    { x: 300, y: 0 },
                    { x: 300, y: 300 },
                    { x: 0, y: 300 }
                ],
                cx: 150,
                cy: 150,
                elevation: 0
            };
            mockPlanner.rooms = [room];
            suite.attach(room);
            suite.setScopeMode('building');
            suite.setTargetAdjustMode('foundation');

            // Simulate clicking up arrow
            suite.activeDragMode = 'up';
            suite.dragDistance = 2; // single click < 6px
            suite._onPointerUp({ clientX: 100, clientY: 100 });

            // Building elevation raised by +15cm
            expect(mockPlanner.walls[0].elevation).toBe(15);
            expect(room.elevation).toBe(15);

            // Platform automatically added underneath
            expect(mockPlanner.platforms.length).toBe(1);
            expect(mockPlanner.platforms[0].height).toBe(15);
            expect(mockPlanner.platforms[0].isBuildingFoundation).toBe(true);
        });

        it('in building mode with foundation active, stepTargetUp also raises elevation and adds platform', () => {
            WallEngine.createRoomBox(mockPlanner, {
                minX: 0, minY: 0, maxX: 300, maxY: 300, thickness: 20, height: 280, elevation: 0
            });
            const room = {
                id: 'room_diag_bldg',
                path: [
                    { x: 0, y: 0 },
                    { x: 300, y: 0 },
                    { x: 300, y: 300 },
                    { x: 0, y: 300 }
                ],
                cx: 150,
                cy: 150,
                elevation: 0
            };
            mockPlanner.rooms = [room];
            suite.attach(room);
            suite.setScopeMode('building');
            suite.setTargetAdjustMode('foundation');

            // Single click step target up
            suite.stepTargetUp();

            expect(mockPlanner.walls[0].elevation).toBe(15);
            expect(mockPlanner.platforms.length).toBe(1);
            expect(mockPlanner.platforms[0].height).toBe(15);
        });

        it('dragging up arrow vertically in foundation mode raises building elevation and live updates platform', () => {
            WallEngine.createRoomBox(mockPlanner, {
                minX: 0, minY: 0, maxX: 400, maxY: 400, thickness: 20, height: 300, elevation: 0
            });
            const room = {
                id: 'room_vert_drag',
                path: [
                    { x: 0, y: 0 },
                    { x: 400, y: 0 },
                    { x: 400, y: 400 },
                    { x: 0, y: 400 }
                ],
                cx: 200,
                cy: 200,
                elevation: 0
            };
            mockPlanner.rooms = [room];
            suite.attach(room);
            suite.setScopeMode('building');
            suite.setTargetAdjustMode('foundation');

            suite.activeDragMode = 'up';
            suite.initialElev = 0;
            suite.dragStartY = 200;
            suite.dragStartX = 100;
            suite.downX = 100;
            suite.downY = 200;

            // Drag up by 100 pixels (clientY = 100)
            suite._onPointerMove({ clientX: 100, clientY: 100 });

            // 100px * 0.6 = 60cm
            expect(mockPlanner.walls[0].elevation).toBe(60);
            expect(mockPlanner.platforms.length).toBe(1);
            expect(mockPlanner.platforms[0].height).toBe(60);

            // Finalize drag
            suite.dragDistance = 100;
            suite._onPointerUp({ clientX: 100, clientY: 100 });

            expect(mockPlanner.walls[0].elevation).toBe(60);
            expect(mockPlanner.platforms[0].height).toBe(60);
        });

        it('raising room elevation in room mode creates platform for that specific room', () => {
            WallEngine.createRoomBox(mockPlanner, {
                minX: 0, minY: 0, maxX: 300, maxY: 300, thickness: 20, height: 280, elevation: 0
            });
            const room = {
                id: 'room_specific_lift',
                path: [
                    { x: 0, y: 0 },
                    { x: 300, y: 0 },
                    { x: 300, y: 300 },
                    { x: 0, y: 300 }
                ],
                cx: 150,
                cy: 150,
                elevation: 0
            };
            mockPlanner.rooms = [room];
            suite.attach(room);
            expect(suite.scopeMode).toBe('room');

            suite.stepRoomElevation(15);
            expect(room.elevation).toBe(15);
            expect(mockPlanner.platforms.length).toBe(1);
            expect(mockPlanner.platforms[0].height).toBe(15);
            expect(mockPlanner.platforms[0].associatedRoomId).toBe('room_specific_lift');
        });
    });

    describe('Sims 4 Dual Foundation and Interior Platform Pipeline', () => {
        it('should have unified Up and Down handles with mode-based highlighting', () => {
            expect(suite.topConeMesh).toBeDefined();
            expect(suite.btmConeMesh).toBeDefined();
            expect(suite.stemMesh).toBeDefined();

            // Default mode is 'wall'
            expect(suite.targetAdjustMode).toBe('wall');

            // In wall mode: highlight color is matHighlightWall (cyan 0x38bdf8)
            suite._setGizmoPartHighlight('up');
            expect(suite.topConeMesh.material).toBe(suite.matHighlightWall);
            expect(suite.matHighlightWall.color.getHex()).toBe(0x38bdf8);

            // In foundation mode: highlight color is matHighlightFoundation (emerald 0x10b981)
            suite.setTargetAdjustMode('foundation');
            suite._setGizmoPartHighlight('up');
            expect(suite.topConeMesh.material).toBe(suite.matHighlightFoundation);
            expect(suite.matHighlightFoundation.color.getHex()).toBe(0x10b981);

            // In platform mode: highlight color is matHighlightPlatform (amber 0xf59e0b)
            suite.setTargetAdjustMode('platform');
            suite._setGizmoPartHighlight('up');
            expect(suite.topConeMesh.material).toBe(suite.matHighlightPlatform);
            expect(suite.matHighlightPlatform.color.getHex()).toBe(0xf59e0b);

            suite._setGizmoPartHighlight(null);
            expect(suite.topConeMesh.material).toBe(suite.matBase);
        });

        it('clicking up arrow in platform mode raises room platform height (+15cm) without moving walls or roofs', () => {
            WallEngine.createRoomBox(mockPlanner, {
                minX: 0, minY: 0, maxX: 300, maxY: 300, thickness: 20, height: 300, elevation: 0
            });
            const room = {
                id: 'room_plt_test',
                path: [
                    { x: 0, y: 0 },
                    { x: 300, y: 0 },
                    { x: 300, y: 300 },
                    { x: 0, y: 300 }
                ],
                cx: 150,
                cy: 150,
                elevation: 0,
                platformHeight: 0
            };
            mockPlanner.rooms = [room];
            mockPlanner.roofs = [{ id: 'roof_1', elevation: 300 }];
            suite.attach(room);

            // Verify initial state
            expect(room.platformHeight).toBe(0);
            expect(mockPlanner.walls[0].elevation).toBe(0);
            expect(mockPlanner.walls[0].height).toBe(300);
            expect(mockPlanner.roofs[0].elevation).toBe(300);

            // Switch to platform mode
            suite.setTargetAdjustMode('platform');

            // Single click on up arrow
            suite.activeDragMode = 'up';
            suite.dragDistance = 2; // < 6px is single click
            suite._onPointerUp({ clientX: 100, clientY: 100 });

            // Platform height is raised by 15cm
            expect(room.platformHeight).toBe(15);

            // CRITICAL: Walls and roofs MUST NOT MOVE!
            expect(mockPlanner.walls[0].elevation).toBe(0);
            expect(mockPlanner.walls[0].height).toBe(300);
            expect(mockPlanner.roofs[0].elevation).toBe(300);

            // Interior platform created inside the room
            expect(mockPlanner.platforms.length).toBe(1);
            const interiorPlt = mockPlanner.platforms[0];
            expect(interiorPlt.isRoomInteriorPlatform).toBe(true);
            expect(interiorPlt.height).toBe(15);
            expect(interiorPlt.elevation).toBe(0);
            expect(interiorPlt.trimStyle).toBe('wood_bevel');
            expect(interiorPlt.associatedRoomId).toBe('room_plt_test');
        });

        it('raising foundation elevation subsequently keeps interior platform stacked on top of room floor', () => {
            WallEngine.createRoomBox(mockPlanner, {
                minX: 0, minY: 0, maxX: 300, maxY: 300, thickness: 20, height: 300, elevation: 0
            });
            const room = {
                id: 'room_stacked_test',
                path: [
                    { x: 0, y: 0 },
                    { x: 300, y: 0 },
                    { x: 300, y: 300 },
                    { x: 0, y: 300 }
                ],
                cx: 150,
                cy: 150,
                elevation: 0,
                platformHeight: 0
            };
            mockPlanner.rooms = [room];
            suite.attach(room);

            // 1. Add 30cm interior stage inside room
            suite.setTargetAdjustMode('platform');
            suite.stepRoomPlatform(30);
            expect(room.platformHeight).toBe(30);
            expect(mockPlanner.platforms.length).toBe(1);
            const interiorPlt = mockPlanner.platforms.find(p => p.isRoomInteriorPlatform);
            expect(interiorPlt).toBeDefined();
            expect(interiorPlt.elevation).toBe(0);
            expect(interiorPlt.height).toBe(30);

            // 2. Now raise foundation elevation by +45cm
            suite.setTargetAdjustMode('foundation');
            suite.stepRoomElevation(45);
            expect(room.elevation).toBe(45);
            expect(mockPlanner.walls[0].elevation).toBe(45);

            // There are now 2 platforms: Foundation Plinth (exterior) + Stage (interior)
            expect(mockPlanner.platforms.length).toBe(2);

            const foundationPlt = mockPlanner.platforms.find(p => p.isBuildingFoundation);
            expect(foundationPlt).toBeDefined();
            expect(foundationPlt.elevation).toBe(0);
            expect(foundationPlt.height).toBe(45);
            expect(foundationPlt.trimStyle).toBe('stone');

            // Interior platform should now have its base elevated to 45cm so it stacks on top
            expect(interiorPlt.elevation).toBe(45);
            expect(interiorPlt.height).toBe(30);
        });

        it('dragging up arrow vertically in platform mode live-adjusts room platform height', () => {
            WallEngine.createRoomBox(mockPlanner, {
                minX: 0, minY: 0, maxX: 300, maxY: 300, thickness: 20, height: 300, elevation: 0
            });
            const room = {
                id: 'room_drag_plt',
                path: [
                    { x: 0, y: 0 },
                    { x: 300, y: 0 },
                    { x: 300, y: 300 },
                    { x: 0, y: 300 }
                ],
                cx: 150,
                cy: 150,
                elevation: 0,
                platformHeight: 0
            };
            mockPlanner.rooms = [room];
            suite.attach(room);

            suite.setTargetAdjustMode('platform');
            suite.activeDragMode = 'up';
            suite.initialPlatformHeight = 0;
            suite.dragStartY = 200;
            suite.dragStartX = 100;
            suite.downX = 100;
            suite.downY = 200;

            // Drag up by 75px (clientY = 125) -> 75 * 0.6 = 45cm
            suite._onPointerMove({ clientX: 100, clientY: 125 });
            expect(room.platformHeight).toBe(45);
            expect(mockPlanner.platforms.length).toBe(1);
            expect(mockPlanner.platforms[0].height).toBe(45);

            // Finalize drag
            suite.dragDistance = 75;
            suite._onPointerUp({ clientX: 100, clientY: 125 });

            expect(room.platformHeight).toBe(45);
            expect(mockPlanner.platforms.length).toBe(1);
            expect(mockPlanner.platforms[0].height).toBe(45);
        });

        it('stepping platform down to 0 cleanly removes interior platform', () => {
            WallEngine.createRoomBox(mockPlanner, {
                minX: 0, minY: 0, maxX: 300, maxY: 300, thickness: 20, height: 300, elevation: 0
            });
            const room = {
                id: 'room_zero_plt',
                path: [
                    { x: 0, y: 0 },
                    { x: 300, y: 0 },
                    { x: 300, y: 300 },
                    { x: 0, y: 300 }
                ],
                cx: 150,
                cy: 150,
                elevation: 0,
                platformHeight: 15
            };
            mockPlanner.rooms = [room];
            suite.attach(room);

            // Set up platform at 15
            suite.setRoomPlatformHeight(15);
            expect(mockPlanner.platforms.length).toBe(1);

            // Step down by 15cm -> 0
            suite.stepRoomPlatform(-15);
            expect(room.platformHeight).toBe(0);
            expect(mockPlanner.platforms.length).toBe(0);
        });

        it('HUD badge displays both Foundation and Platform metrics clearly', () => {
            WallEngine.createRoomBox(mockPlanner, {
                minX: 0, minY: 0, maxX: 300, maxY: 300, thickness: 20, height: 300, elevation: 0
            });
            const room = {
                id: 'room_hud_badge',
                path: [
                    { x: 0, y: 0 },
                    { x: 300, y: 0 },
                    { x: 300, y: 300 },
                    { x: 0, y: 300 }
                ],
                cx: 150,
                cy: 150,
                elevation: 30,
                platformHeight: 15
            };
            mockPlanner.rooms = [room];
            suite.attach(room);

            suite._updateHUDControls();
            expect(suite.roomBadge.innerHTML).toContain('Fnd <span style="color:#10b981;">+30cm</span>');
            expect(suite.roomBadge.innerHTML).toContain('Plt <span style="color:#34d399;">+15cm</span>');
            expect(suite.roomBadge.innerHTML).toContain('Wall <span style="color:#38bdf8;">300cm</span>');
        });

        it('HUD 3-icon mode switcher and single up/down arrow buttons dynamically update titles and behavior', () => {
            expect(suite.btnModeWall).toBeDefined();
            expect(suite.btnModeFoundation).toBeDefined();
            expect(suite.btnModePlatform).toBeDefined();
            expect(suite.btnStepDown).toBeDefined();
            expect(suite.btnStepUp).toBeDefined();

            // 1. Default mode: 'wall'
            suite.setTargetAdjustMode('wall');
            expect(suite.targetAdjustMode).toBe('wall');
            expect(suite.btnStepDown.title).toContain('Wall Height');
            expect(suite.btnStepUp.title).toContain('Wall Height');

            // 2. Foundation mode
            suite.setTargetAdjustMode('foundation');
            expect(suite.targetAdjustMode).toBe('foundation');
            expect(suite.btnStepDown.title).toContain('Foundation');
            expect(suite.btnStepUp.title).toContain('Foundation');

            // 3. Platform mode
            suite.setTargetAdjustMode('platform');
            expect(suite.targetAdjustMode).toBe('platform');
            expect(suite.btnStepDown.title).toContain('Platform');
            expect(suite.btnStepUp.title).toContain('Platform');
        });

        it('HUD buttons are compact pure icons with no text labels', () => {
            // Check that button labels contain only the icons without text words
            expect(suite.btnScopeRoom.innerHTML).toBe('🏠');
            expect(suite.btnScopeBuilding.innerHTML).toBe('🏢');
            expect(suite.btnModeWall.innerHTML).toBe('🧱');
            expect(suite.btnModeFoundation.innerHTML).toBe('🏛️');
            expect(suite.btnModePlatform.innerHTML).toBe('🪜');
            expect(suite.btnStepDown.innerHTML).toBe('⬇');
            expect(suite.btnStepUp.innerHTML).toBe('⬆');
        });

        it('StairInteractiveSuite strictly rejects floor, platform, and room meshes', async () => {
            const { StairInteractiveSuite } = await import('../StairInteractiveSuite.js');
            const stairSuite = new StairInteractiveSuite(mockCtx);

            // A floor mesh with Konva 2D shape must NEVER attach to stair suite
            const floorMesh = new THREE.Mesh();
            floorMesh.userData = {
                isFloor: true,
                entity: { id: 'floor_1', type: 'floor', shape: { dummy: 'konva_shape' } }
            };

            stairSuite.attach(floorMesh);
            expect(stairSuite.visible).toBe(false);
            expect(stairSuite.target).toBeNull();
            expect(stairSuite.stair).toBeNull();

            // A platform mesh must also NEVER attach to stair suite
            const platformMesh = new THREE.Mesh();
            platformMesh.userData = {
                isPlatform: true,
                entity: { id: 'plt_1', type: 'platform', shape: { dummy: 'konva_shape' } }
            };

            stairSuite.attach(platformMesh);
            expect(stairSuite.visible).toBe(false);
            expect(stairSuite.target).toBeNull();
        });
    });
});



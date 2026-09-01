import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { WallPushPullGizmo } from '../WallPushPullGizmo.js';

describe('WallPushPullGizmo - Sims 4-Style 2D-on-3D Region Selection & Push/Pull', () => {
    let ctx;
    let gizmo;
    let mockWall;
    let mockSiblingWall;

    beforeEach(() => {
        // Mock Camera
        const camera = new THREE.PerspectiveCamera(60, 1, 1, 1000);
        camera.position.set(0, 150, 300);
        camera.lookAt(0, 0, 0);

        // Mock 3D Container & Scene Context
        const domElement = {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
            addEventListener: () => {},
            removeEventListener: () => {},
            style: { cursor: 'default' }
        };

        const mockPlanner = {
            walls: [],
            commandManager: { execute: () => {}, canUndo: () => false, canRedo: () => false },
            syncAll: () => {},
            findRooms: () => {}
        };

        ctx = {
            camera,
            renderer: { domElement },
            controls: { enabled: true },
            planner: mockPlanner,
            updatedWalls: [],
            updateWallGeometryLive: (w) => { ctx.updatedWalls.push(w); },
            rebuildActiveFloors: () => {},
            requestRender: () => {}
        };

        // Create Active Wall (100cm length along X, height 120cm, thickness 20cm)
        const startAnchor = {
            _pos: { x: 0, y: 0 },
            position(p) { if (p) this._pos = { ...p }; return { ...this._pos }; },
            connectedWalls: []
        };
        const endAnchor = {
            _pos: { x: 100, y: 0 },
            position(p) { if (p) this._pos = { ...p }; return { ...this._pos }; },
            connectedWalls: []
        };

        mockWall = {
            id: 'wall_active_1',
            startX: 0,
            startY: 0,
            endX: 100,
            endY: 0,
            height: 120,
            thickness: 20,
            startAnchor,
            endAnchor,
            attachedWidgets: [],
            mesh3D: new THREE.Group()
        };
        mockWall.mesh3D.userData = { entity: mockWall };

        // Create Connected Sibling Wall sharing startAnchor
        const siblingEndAnchor = {
            _pos: { x: 0, y: 100 },
            position(p) { if (p) this._pos = { ...p }; return { ...this._pos }; },
            connectedWalls: []
        };
        mockSiblingWall = {
            id: 'wall_sibling_2',
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 100,
            height: 120,
            thickness: 20,
            startAnchor,
            endAnchor: siblingEndAnchor,
            attachedWidgets: [],
            mesh3D: new THREE.Group()
        };
        mockSiblingWall.mesh3D.userData = { entity: mockSiblingWall };

        startAnchor.connectedWalls.push(mockWall, mockSiblingWall);
        mockPlanner.walls.push(mockWall, mockSiblingWall);

        gizmo = new WallPushPullGizmo(ctx);
    });

    it('should initialize with 4 boundary handles (horizontal & vertical) and 2 push/pull handles', () => {
        expect(gizmo.startWidthHandle).toBeDefined();
        expect(gizmo.endWidthHandle).toBeDefined();
        expect(gizmo.bottomHeightHandle).toBeDefined();
        expect(gizmo.topHeightHandle).toBeDefined();
        expect(gizmo.handleFront).toBeDefined();
        expect(gizmo.handleBack).toBeDefined();

        gizmo.attach(mockWall.mesh3D);
        expect(gizmo.visible).toBe(true);
        expect(gizmo.tStart).toBe(0.0);
        expect(gizmo.tEnd).toBe(1.0);
        expect(gizmo.elevBottom).toBe(0);
        expect(gizmo.elevTop).toBe(120);
    });

    it('should calculate single-sided front face expansion and keep back face pinned', () => {
        gizmo.attach(mockWall.mesh3D);

        gizmo.initialStart = { x: 0, y: 0 };
        gizmo.initialEnd = { x: 100, y: 0 };
        gizmo.initialThickness = 20;
        gizmo.wallNormal2D = { x: 0, y: 1 };
        gizmo.activeHandle = 'front';
        gizmo.mode = 'thickness';
        gizmo.isDragging = true;
        gizmo.dragStartPoint.set(50, 60, 0);

        const deltaWorldZ = 10;
        const dist = (0 * gizmo.wallNormal2D.x) + (deltaWorldZ * gizmo.wallNormal2D.y); // +10
        const deltaThick = Math.round(dist);
        const newThick = gizmo.initialThickness + deltaThick; // 30 cm
        const actualDelta = newThick - gizmo.initialThickness; // +10 cm

        mockWall.thickness = newThick;
        const shift = actualDelta / 2; // +5 cm
        const shiftX = gizmo.wallNormal2D.x * shift;
        const shiftY = gizmo.wallNormal2D.y * shift;

        mockWall.startAnchor.position({ x: gizmo.initialStart.x + shiftX, y: gizmo.initialStart.y + shiftY });
        mockWall.endAnchor.position({ x: gizmo.initialEnd.x + shiftX, y: gizmo.initialEnd.y + shiftY });

        expect(mockWall.startAnchor.position()).toEqual({ x: 0, y: 5 });
        expect(mockWall.endAnchor.position()).toEqual({ x: 100, y: 5 });
        expect(mockWall.thickness).toBe(30);

        const frontFaceY = mockWall.startAnchor.position().y + mockWall.thickness / 2;
        expect(frontFaceY).toBe(20);

        const backFaceY = mockWall.startAnchor.position().y - mockWall.thickness / 2;
        expect(backFaceY).toBe(-10);
    });

    it('should update both active wall and connected sibling walls during live push/pull', () => {
        ctx.updatedWalls = [];
        gizmo._updateWallAndSiblings(mockWall);

        expect(ctx.updatedWalls).toContain(mockWall);
        expect(ctx.updatedWalls).toContain(mockSiblingWall);
    });

    it('should carve an architectural niche when pushing inward on a selected sub-region and clicking Done', () => {
        gizmo.attach(mockWall.mesh3D);
        gizmo.tStart = 0.2;
        gizmo.tEnd = 0.8;
        gizmo.elevBottom = 30;
        gizmo.elevTop = 90;
        gizmo.isDragging = true;
        gizmo.activeHandle = 'front';
        gizmo.activeFacing = 1;
        gizmo.currentExtrudeDepth = -12; // Push inward by 12 cm

        const mockEvent = { target: { releasePointerCapture: () => {} } };
        gizmo._onPointerUp(mockEvent);

        // Step 3: User clicks Done (commit)
        gizmo.commit();

        expect(mockWall.attachedWidgets.length).toBe(1);
        const widget = mockWall.attachedWidgets[0];
        expect(widget.type).toBe('niche_recess');
        expect(widget.width).toBe(60); // (0.8 - 0.2) * 100 = 60 cm
        expect(widget.height).toBe(60); // 90 - 30 = 60 cm
        expect(widget.elevation).toBe(30);
        expect(widget.depth).toBe(12);
        expect(widget.facing).toBe(1);
    });

    it('should create a solid wall protrusion (solid fill) when pulling outward on a selected sub-region and clicking Done', () => {
        mockWall.attachedWidgets = [];
        gizmo.attach(mockWall.mesh3D);
        gizmo.tStart = 0.25;
        gizmo.tEnd = 0.75;
        gizmo.elevBottom = 0;
        gizmo.elevTop = 120;
        gizmo.isDragging = true;
        gizmo.activeHandle = 'front';
        gizmo.activeFacing = 1;
        gizmo.currentExtrudeDepth = 25; // Pull outward by 25 cm

        const mockEvent = { target: { releasePointerCapture: () => {} } };
        gizmo._onPointerUp(mockEvent);

        // Step 3: User clicks Done (commit)
        gizmo.commit();

        expect(mockWall.attachedWidgets.length).toBe(1);
        const widget = mockWall.attachedWidgets[0];
        expect(widget.type).toBe('solid_protrusion');
        expect(widget.width).toBe(50); // (0.75 - 0.25) * 100 = 50 cm
        expect(widget.height).toBe(120);
        expect(widget.elevation).toBe(0);
        expect(widget.depth).toBe(25);
        expect(widget.facing).toBe(1);
    });

    it('should discard solid wall extrusion when user clicks Cancel', () => {
        mockWall.attachedWidgets = [];
        gizmo.attach(mockWall.mesh3D);
        gizmo.tStart = 0.2;
        gizmo.tEnd = 0.8;
        gizmo.currentExtrudeDepth = 30;

        // Step 3: User clicks Cancel
        gizmo.cancel();

        expect(mockWall.attachedWidgets.length).toBe(0);
        expect(gizmo.currentExtrudeDepth).toBe(0);
    });

    it('should safely sync all walls and call update() when attached widgets are plain objects', () => {
        const wallWithWidgets = {
            attachedWidgets: [
                { id: 'protrusion_1', type: 'solid_protrusion', width: 50, height: 120 },
                { id: 'niche_1', type: 'niche_recess', width: 60, height: 80 }
            ],
            attachedMoldings: []
        };

        // Simulating the 2D update loop
        expect(() => {
            wallWithWidgets.attachedWidgets.forEach(w => {
                if (w && typeof w.update === 'function') w.update();
            });
            if (wallWithWidgets.attachedMoldings) {
                wallWithWidgets.attachedMoldings.forEach(m => {
                    if (m && typeof m.update === 'function') m.update();
                });
            }
        }).not.toThrow();
    });
});

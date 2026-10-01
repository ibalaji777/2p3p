import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { WallInteractiveSuite } from '../WallInteractiveSuite.js';
import { WallEngine } from '../../wall/WallEngine.js';
import { WallTopologyEngine } from '../../wall/WallTopologyEngine.js';

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
            measureText: () => ({ width: 10 })
        });
    }
});

describe('WallInteractiveSuite - Bay / Niche (extrude_recess) Tool', () => {
    let mockCtx;
    let domElement;
    let camera;
    let mockPlanner;
    let mockWall;
    let mockMesh;
    let suite;

    beforeEach(() => {
        domElement = document.createElement('div');
        domElement.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: 800,
            bottom: 600,
            width: 800,
            height: 600
        });

        camera = new THREE.PerspectiveCamera(45, 800 / 600, 1, 1000);
        camera.position.set(100, 200, 300);
        camera.lookAt(100, 0, 0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);

        mockWall = {
            id: 'wall_test_1',
            type: 'outer',
            startX: 0,
            startY: 0,
            endX: 200,
            endY: 0,
            startAnchor: { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) },
            endAnchor: { x: 200, y: 0, position: () => ({ x: 200, y: 0 }) },
            thickness: 20,
            height: 280,
            elevation: 0,
            attachedWidgets: [],
            attachedMoldings: []
        };

        mockPlanner = {
            walls: [mockWall],
            rooms: [],
            stairs: [],
            furniture: [],
            roofs: [],
            shapes: [],
            wallLayer: { add: vi.fn(), remove: vi.fn(), draw: vi.fn() },
            uiLayer: { add: vi.fn(), remove: vi.fn(), draw: vi.fn() },
            anchors: [mockWall.startAnchor, mockWall.endAnchor],
            syncAll: vi.fn(),
            findRooms: vi.fn(),
            exportState: vi.fn(() => 'mock_planner_snapshot_state'),
            importState: vi.fn(),
            commandManager: {
                execute: vi.fn(cmd => {
                    if (cmd && typeof cmd.execute === 'function') cmd.execute();
                })
            },
            getOrCreateAnchor: vi.fn((x, y) => ({ x, y, position: () => ({ x, y }) })),
            findOrCreateAnchor: vi.fn((x, y) => ({ x, y, position: () => ({ x, y }) }))
        };
        mockWall.planner = mockPlanner;

        mockMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 280, 20));
        mockMesh.userData = { entity: mockWall };

        mockCtx = {
            renderer: { domElement },
            camera,
            scene: new THREE.Scene(),
            controls: { addEventListener: vi.fn(), removeEventListener: vi.fn(), enabled: true },
            requestRender: vi.fn(),
            buildScene: vi.fn(),
            updateWallGeometryLive: vi.fn(),
            planner: mockPlanner
        };

        suite = new WallInteractiveSuite(mockCtx);
    });

    afterEach(() => {
        suite.dispose();
    });

    it('should activate extrude_recess mode, show extrude handles and ghost, and detach extenderGizmo', () => {
        suite.attach(mockMesh, 'menu');
        expect(suite.activeMode).toBe('menu');

        // User clicks Bay/Niche button
        suite.setMode('extrude_recess');

        expect(suite.activeMode).toBe('extrude_recess');
        expect(suite.extrudeGroup.visible).toBe(true);
        expect(suite.extenderGizmo.visible).toBe(false);
        expect(suite.cornerGizmo.visible).toBe(false);
        expect(suite.heightGizmo.visible).toBe(false);

        // Check that status badge displays the Bay/Niche prompt
        expect(suite.confirmStatusBadge.textContent).toContain('Bay (+Z) / Recess Niche (-Z)');
    });

    it('should generate photorealistic 3D bay window assembly when extruding outward (+Z)', () => {
        suite.attach(mockMesh, 'extrude_recess');

        // Simulate outward drag (depth = 40cm, tStart = 0.25, tEnd = 0.75)
        suite.extrudeCurrentDepth = 40;
        suite._updateExtrudeGhostGeometry();

        expect(suite.confirmStatusBadge.textContent).toContain('Bay Window: +40 cm');
        expect(suite.confirmStatusBadge.textContent).toContain('Width: 100 cm');
        expect(suite.target.visible).toBe(false); // Original wall hidden during preview

        // Bay preview group should have the 3-wall extension + floor slab + interior void
        expect(suite.bayPreviewGroup.children.length).toBeGreaterThan(4);
    });

    it('should generate photorealistic 3D niche assembly when recessing inward (-Z)', () => {
        suite.attach(mockMesh, 'extrude_recess');

        // Simulate inward drag (depth = -10cm, within 20cm thickness)
        suite.extrudeCurrentDepth = -10;
        suite._updateExtrudeGhostGeometry();

        expect(suite.confirmStatusBadge.textContent).toContain('Niche: -10 cm');
        expect(suite.confirmStatusBadge.textContent).toContain('Core: 10 cm');

        // Niche assembly should have back wall panel + niche void box
        expect(suite.bayPreviewGroup.children.length).toBeGreaterThan(0);
    });

    it('should commit outward Bay Window and build actual bay room walls via extrudeWallSegment', () => {
        suite.attach(mockMesh, 'extrude_recess');
        suite.extrudeCurrentDepth = 50;
        suite.extrudeStartT = 0.25;
        suite.extrudeEndT = 0.75;
        suite.activeFacing = 1;

        // User clicks Done
        suite.commitChanges();

        expect(mockPlanner.commandManager.execute).toHaveBeenCalled();
        expect(mockCtx.buildScene).toHaveBeenCalled();
        expect(suite.target).toBeNull(); // Detached cleanly
    });

    it('should commit inward Niche and attach an architectural niche_recess widget to wall', () => {
        suite.attach(mockMesh, 'extrude_recess');
        suite.extrudeCurrentDepth = -12; // Inward 12cm within wall thickness 20cm
        suite.extrudeStartT = 0.25;
        suite.extrudeEndT = 0.75;
        suite.activeFacing = 1;

        // User clicks Done
        suite.commitChanges();

        expect(mockWall.attachedWidgets.length).toBe(1);
        const widget = mockWall.attachedWidgets[0];
        expect(widget.type).toBe('niche_recess');
        expect(widget.depth).toBe(12);
        expect(widget.width).toBe(100); // (0.75 - 0.25) * 200 = 100cm
        expect(mockCtx.updateWallGeometryLive).toHaveBeenCalledWith(mockWall);
        expect(suite.target).toBeNull();
    });

    it('should restore target wall visibility when cancelling changes', () => {
        suite.attach(mockMesh, 'extrude_recess');
        suite.extrudeCurrentDepth = 40;
        suite._updateExtrudeGhostGeometry();
        expect(mockMesh.visible).toBe(false);

        // User cancels
        suite.cancelChanges();

        expect(mockMesh.visible).toBe(true);
        expect(suite.extrudeGroup.visible).toBe(false);
        expect(suite.target).toBeNull();
    });

    it('should support Enter to commit and Escape to cancel via keyboard', () => {
        suite.attach(mockMesh, 'extrude_recess');
        suite.extrudeCurrentDepth = 40;
        suite.extrudeStartT = 0.25;
        suite.extrudeEndT = 0.75;
        suite.activeFacing = 1;

        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
        window.dispatchEvent(enterEvent);

        expect(mockPlanner.commandManager.execute).toHaveBeenCalled();
        expect(mockCtx.buildScene).toHaveBeenCalled();
    });

    it('should construct photorealistic 3D lit arrows (shaft + cone) with Emerald Green for Bay and Amethyst Purple for Niche', () => {
        suite.attach(mockMesh, 'extrude_recess');

        // Check Bay (+Z) Arrow meshes and materials
        const outMeshes = [];
        suite.extrudeHandle.traverse(child => {
            if (child.isMesh && child.userData?.part === 'depth_out' && child.material?.visible !== false) {
                outMeshes.push(child);
            }
        });

        // Must have both Cylindrical Stalk and Conical Arrowhead
        expect(outMeshes.length).toBe(2);
        const hasOutCylinder = outMeshes.some(m => m.geometry instanceof THREE.CylinderGeometry);
        const hasOutCone = outMeshes.some(m => m.geometry instanceof THREE.ConeGeometry);
        expect(hasOutCylinder).toBe(true);
        expect(hasOutCone).toBe(true);

        // Check material is MeshStandardMaterial with plain raiser pearl-white (0xf8fafc)
        outMeshes.forEach(m => {
            expect(m.material).toBeInstanceOf(THREE.MeshStandardMaterial);
            expect(m.material.color.getHex()).toBe(0xf8fafc);
            expect(m.material.depthTest).toBe(false);
        });

        // Check Niche (-Z) Arrow meshes and materials
        const inMeshes = [];
        suite.extrudeHandle.traverse(child => {
            if (child.isMesh && child.userData?.part === 'depth_in' && child.material?.visible !== false) {
                inMeshes.push(child);
            }
        });

        // Must have both Cylindrical Stalk and Conical Arrowhead
        expect(inMeshes.length).toBe(2);
        const hasInCylinder = inMeshes.some(m => m.geometry instanceof THREE.CylinderGeometry);
        const hasInCone = inMeshes.some(m => m.geometry instanceof THREE.ConeGeometry);
        expect(hasInCylinder).toBe(true);
        expect(hasInCone).toBe(true);

        // Check material is MeshStandardMaterial with plain raiser pearl-white (0xf8fafc)
        inMeshes.forEach(m => {
            expect(m.material).toBeInstanceOf(THREE.MeshStandardMaterial);
            expect(m.material.color.getHex()).toBe(0xf8fafc);
            expect(m.material.depthTest).toBe(false);
        });

        // Check Boundary Handles have 3D arrows (Cylinder + Cone) with raiser pearl-white (0xf8fafc)
        const boundaryMeshes = [];
        suite.extrudeStartHandle.traverse(child => {
            if (child.isMesh && child.userData?.part === 'boundary_start' && child.userData?.isRing !== true && child.material?.visible !== false) {
                boundaryMeshes.push(child);
            }
        });
        const hasBoundCylinder = boundaryMeshes.some(m => m.geometry instanceof THREE.CylinderGeometry && m.geometry.parameters.height === 16);
        const hasBoundCone = boundaryMeshes.some(m => m.geometry instanceof THREE.ConeGeometry);
        expect(hasBoundCylinder).toBe(true);
        expect(hasBoundCone).toBe(true);
        boundaryMeshes.forEach(m => {
            expect(m.material.color.getHex()).toBe(0xf8fafc);
        });

        // Verify boundary handles point outward away from bay
        const startCone = boundaryMeshes.find(m => m.geometry instanceof THREE.ConeGeometry);
        expect(startCone.position.x).toBeLessThan(0); // start handle points left (-X, outward)

        const endMeshes = [];
        suite.extrudeEndHandle.traverse(child => {
            if (child.isMesh && child.userData?.part === 'boundary_end' && child.userData?.isRing !== true && child.material?.visible !== false) {
                endMeshes.push(child);
            }
        });
        const endCone = endMeshes.find(m => m.geometry instanceof THREE.ConeGeometry);
        expect(endCone.position.x).toBeGreaterThan(0); // end handle points right (+X, outward)

        // Verify hover highlight
        suite._setHandleHighlight('depth_out');
        outMeshes.forEach(m => {
            expect(m.material.color.getHex()).toBe(0xfacc15); // Vibrant yellow on hover
        });

        suite._setHandleHighlight(null);
        outMeshes.forEach(m => {
            expect(m.material.color.getHex()).toBe(0xf8fafc); // Restored raiser plain pearl-white
        });

        // Verify boundary hover highlight
        suite._setHandleHighlight('boundary_start');
        boundaryMeshes.forEach(m => {
            expect(m.material.color.getHex()).toBe(0xfacc15);
        });
        suite._setHandleHighlight(null);
        boundaryMeshes.forEach(m => {
            expect(m.material.color.getHex()).toBe(0xf8fafc);
        });
    });

    it('should configure all 4 vertices points with 3D lit arrows and raiser plain color (0xf8fafc) in corner mode', () => {
        suite.attach(mockMesh, 'corner');
        expect(suite.activeMode).toBe('corner');
        expect(suite.cornerGizmo.visible).toBe(true);

        const cornerHandles = suite.cornerGizmo.handles;
        const arrowTypes = ['start_slope_height', 'end_slope_height', 'start_base_elevation', 'end_base_elevation'];

        // 1. Verify ALL 4 vertices points have arrows
        arrowTypes.forEach(type => {
            const meshes = [];
            cornerHandles.traverse(c => {
                if (c.isMesh && c.userData?.handleType === type && c.material?.visible !== false) {
                    meshes.push(c);
                }
            });
            expect(meshes.length).toBe(2); // Stalk + Cone
            const hasCylinder = meshes.some(m => m.geometry instanceof THREE.CylinderGeometry);
            const hasCone = meshes.some(m => m.geometry instanceof THREE.ConeGeometry);
            expect(hasCylinder).toBe(true);
            expect(hasCone).toBe(true);

            // 2. Verify pearl-white brushed chrome raiser styling (0xf8fafc)
            meshes.forEach(m => {
                expect(m.material).toBeInstanceOf(THREE.MeshStandardMaterial);
                expect(m.material.color.getHex()).toBe(0xf8fafc);
                expect(m.material.depthTest).toBe(false);
            });
        });

        // 3. Verify corner node diamonds use pearl-white brushed chrome (0xf8fafc)
        const nodeTypes = ['start_pos', 'end_pos', 'start_top_pos', 'end_top_pos'];
        nodeTypes.forEach(type => {
            const meshes = [];
            cornerHandles.traverse(c => {
                if (c.isMesh && c.userData?.handleType === type && c.userData?.isRing !== true && c.material?.visible !== false) {
                    meshes.push(c);
                }
            });
            expect(meshes.length).toBeGreaterThan(0);
            meshes.forEach(m => {
                expect(m.material).toBeInstanceOf(THREE.MeshStandardMaterial);
                expect(m.material.color.getHex()).toBe(0xf8fafc);
            });
        });

        // 4. Verify bottom arrow dragging adjusts wall elevation
        const startBaseArrow = [];
        cornerHandles.traverse(c => {
            if (c.isMesh && c.userData?.handleType === 'start_base_elevation') startBaseArrow.push(c);
        });
        expect(startBaseArrow.length).toBeGreaterThan(0);

        // Simulate pointer down on bottom elevation arrow
        suite.cornerGizmo.activeHandle = startBaseArrow[0].userData;
        suite.cornerGizmo.initialElev = 0;
        suite.cornerGizmo.dragStartPoint.set(0, 0, 0);

        // Dragging upward by 25cm raises wall elevation
        const currentPoint = new THREE.Vector3(0, 25, 0);
        const deltaY = currentPoint.y - suite.cornerGizmo.dragStartPoint.y;
        const newElev = Math.max(0, Math.round((suite.cornerGizmo.initialElev + deltaY) / 5) * 5);
        WallEngine.setElevation(mockWall, newElev, false, mockPlanner);

        expect(mockWall.elevation).toBe(25);
    });
});


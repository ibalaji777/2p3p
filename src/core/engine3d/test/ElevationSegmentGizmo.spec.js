import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { ElevationSegmentGizmo } from '../ElevationSegmentGizmo.js';
import { 
    createStarterElevationSegment,
    sproutCornerPreset,
    rotateElevationSegment,
    findNearbyElevationSegments,
    joinElevationSegments,
    setNodeCornerStyle,
    splitElevationSegmentAtNode,
    wrapElevationSegmentToAdjacentWall,
    adjustArmElevation,
    setArmElevation,
    initEntitySegments
} from '../../../features/elevation/elevationSegment.registry.js';

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

describe('ElevationSegmentGizmo Phase 1: Dedicated 3D Scene Menus & Gizmo Decluttering', () => {
    let mockCtx;
    let domElement;
    let camera;
    let gizmo;
    let mockWall;
    let mockSegment;

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
        camera.position.set(0, 300, 600);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);

        mockWall = {
            id: 'wall_1',
            startX: 0,
            startY: 0,
            endX: 300,
            endY: 0,
            thickness: 20,
            height: 300,
            elevation: 0,
            startAnchor: { position: () => ({ x: 0, y: 0 }) },
            endAnchor: { position: () => ({ x: 300, y: 0 }) }
        };

        mockCtx = {
            renderer: { domElement },
            camera,
            scene: new THREE.Scene(),
            controls: { addEventListener: vi.fn(), removeEventListener: vi.fn(), enabled: true },
            requestRender: vi.fn(),
            planner: {
                walls: [mockWall],
                elevationSegments: [],
                debouncedSaveHistory: vi.fn()
            },
            helpers: {
                getMaterial: () => new THREE.MeshBasicMaterial()
            }
        };

        mockSegment = createStarterElevationSegment(mockWall, 150, 150, 1, { length: 200, width: 30, depth: 40 });
        mockSegment.mesh3D = new THREE.Group();
        const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 30, 40), new THREE.MeshBasicMaterial());
        bodyMesh.userData = { isElevationBody: true };
        mockSegment.mesh3D.add(bodyMesh);

        gizmo = new ElevationSegmentGizmo(mockCtx);
    });

    afterEach(() => {
        if (gizmo) {
            gizmo.destroy();
        }
    });

    it('initializes with default "extrude" mode (unified extend & sprout) and keeps HUD hidden before attach', () => {
        expect(gizmo.activeMode).toBe('extrude');
        expect(gizmo.domHUD).toBeDefined();
        expect(gizmo.domHUD.style.display).toBe('none');
        expect(gizmo.tooltip).toBeDefined();
        expect(gizmo.modeButtons.stretch).toBeDefined();
        expect(gizmo.modeButtons.sprout).toBeDefined();
        expect(gizmo.modeButtons.corners).toBeDefined();
        expect(gizmo.modeButtons.all).toBeDefined();
    });

    it('attaches to elevation segment, renders Wall Raiser-style icon HUD and handles on the segment', () => {
        gizmo.attach(mockSegment);

        expect(gizmo.visible).toBe(true);
        expect(gizmo.domHUD.style.display).toBe('flex');
        expect(gizmo.domHUD.className).toContain('sms4-wall-3d-hud');

        const handleTypes = gizmo.handles.children.map(c => c.userData?.handleType).filter(Boolean);

        // In unified extrude mode: should have push_pull, extrude_arrow, elevation_slide, and body_drag
        expect(handleTypes.includes('push_pull')).toBe(true);
        expect(handleTypes.includes('extrude_arrow')).toBe(true);
        expect(handleTypes.includes('elevation_slide')).toBe(true);
        expect(handleTypes.includes('body_drag')).toBe(true);
    });

    it('switches to "stretch" mode and displays only stretch handles in the 3D scene', () => {
        gizmo.attach(mockSegment);
        gizmo.setMode('stretch');

        expect(gizmo.activeMode).toBe('stretch');
        const handleTypes = gizmo.handles.children.map(c => c.userData?.handleType).filter(Boolean);

        expect(handleTypes.includes('push_pull')).toBe(true);
        expect(handleTypes.includes('elevation_slide')).toBe(true);
        expect(handleTypes.includes('extrude_arrow')).toBe(false);
    });

    it('switches to "sprout" mode and displays only sprout arrows in the 3D scene', () => {
        gizmo.attach(mockSegment);
        gizmo.setMode('sprout');

        expect(gizmo.activeMode).toBe('sprout');
        const handleTypes = gizmo.handles.children.map(c => c.userData?.handleType).filter(Boolean);

        // In sprout mode: should have extrude_arrow and not push_pull
        expect(handleTypes.includes('extrude_arrow')).toBe(true);
        expect(handleTypes.includes('push_pull')).toBe(false);
        expect(handleTypes.includes('elevation_slide')).toBe(false);
        expect(handleTypes.includes('corner_wrap')).toBe(false);
    });

    it('switches to "corners" mode and displays only corner/bend grips', () => {
        // Add an interior bend node so we test bend_junction
        mockSegment.points.splice(1, 0, {
            x: 100, y: 150, z: 10,
            normal: { x: 0, y: 0, z: 1 },
            cornerStyle: 'sharp',
            radius: 0
        });

        gizmo.attach(mockSegment);
        gizmo.setMode('corners');

        expect(gizmo.activeMode).toBe('corners');
        const handleTypes = gizmo.handles.children.map(c => c.userData?.handleType).filter(Boolean);

        // In corners mode: should only have bend_junction
        expect(handleTypes.includes('bend_junction')).toBe(true);
        expect(handleTypes.includes('push_pull')).toBe(false);
        expect(handleTypes.includes('extrude_arrow')).toBe(false);
        expect(handleTypes.includes('elevation_slide')).toBe(false);
    });

    it('switches to "all" mode and displays all handles simultaneously', () => {
        // Add an interior bend node
        mockSegment.points.splice(1, 0, {
            x: 100, y: 150, z: 10,
            normal: { x: 0, y: 0, z: 1 },
            cornerStyle: 'sharp',
            radius: 0
        });

        gizmo.attach(mockSegment);
        gizmo.setMode('all');

        expect(gizmo.activeMode).toBe('all');
        const handleTypes = gizmo.handles.children.map(c => c.userData?.handleType).filter(Boolean);

        expect(handleTypes.includes('push_pull')).toBe(true);
        expect(handleTypes.includes('extrude_arrow')).toBe(true);
        expect(handleTypes.includes('bend_junction')).toBe(true);
        expect(handleTypes.includes('elevation_slide')).toBe(true);
        expect(handleTypes.includes('body_drag')).toBe(true);
    });

    it('dispatches elevation-segment-mode-change event when mode is set', () => {
        const eventListener = vi.fn();
        window.addEventListener('elevation-segment-mode-change', eventListener);

        gizmo.attach(mockSegment);
        gizmo.setMode('sprout');

        expect(eventListener).toHaveBeenCalled();
        const lastCallDetail = eventListener.mock.calls[0][0].detail;
        expect(lastCallDetail.mode).toBe('sprout');

        window.removeEventListener('elevation-segment-mode-change', eventListener);
    });

    it('responds to external elevation-segment-set-mode window events', () => {
        gizmo.attach(mockSegment);
        expect(gizmo.activeMode).toBe('extrude');

        window.dispatchEvent(new CustomEvent('elevation-segment-set-mode', {
            detail: { mode: 'corners' }
        }));

        expect(gizmo.activeMode).toBe('corners');
    });

    it('switches to unified "extrude" mode and displays push_pull and directional sprouts', () => {
        gizmo.attach(mockSegment);
        gizmo.setMode('extrude');

        expect(gizmo.activeMode).toBe('extrude');
        const handleTypes = gizmo.handles.children.map(c => c.userData?.handleType).filter(Boolean);

        // Extrude combines both push_pull stretch handles AND sprout extrude arrows!
        expect(handleTypes.includes('push_pull')).toBe(true);
        expect(handleTypes.includes('extrude_arrow')).toBe(true);

        // Verify contextual sprouts on horizontal segment (Up, Down, Out, In)
        const arrowDirections = gizmo.handles.children
            .filter(c => c.userData?.handleType === 'extrude_arrow')
            .map(c => c.userData?.direction);

        expect(arrowDirections.includes('up')).toBe(true);
        expect(arrowDirections.includes('down')).toBe(true);
        expect(arrowDirections.includes('away_wall')).toBe(true);
        expect(arrowDirections.includes('toward_wall')).toBe(true);
        // Tangent left/right sprouts omitted because axial push_pull handles tangent
        expect(arrowDirections.includes('left')).toBe(false);
        expect(arrowDirections.includes('right')).toBe(false);
    });

    it('provides select and drag adjust on the elevation beam body', () => {
        gizmo.attach(mockSegment);
        const bodyCollider = gizmo.handles.children.find(c => c.userData?.handleType === 'body_drag');
        expect(bodyCollider).toBeDefined();

        gizmo.raycaster.intersectObjects = vi.fn().mockReturnValue([
            { object: bodyCollider }
        ]);

        const mockEvent = {
            button: 0,
            clientX: 400,
            clientY: 300,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        gizmo._onPointerDown(mockEvent);
        expect(gizmo.isDragging).toBe(true);
        expect(gizmo.activeHandle?.handleType).toBe('body_drag');
    });

    it('switches to "angle" mode and displays rotation ring on the active arm pivot', () => {
        gizmo.attach(mockSegment);
        gizmo.setMode('angle');

        expect(gizmo.activeMode).toBe('angle');
        const handleTypes = gizmo.handles.children.map(c => c.userData?.handleType).filter(Boolean);
        expect(handleTypes.includes('rotation_ring')).toBe(true);
    });

    it('switches to "dims" mode and displays independent dimension handles', () => {
        gizmo.attach(mockSegment);
        gizmo.setMode('dims');

        expect(gizmo.activeMode).toBe('dims');
        const handleTypes = gizmo.handles.children.map(c => c.userData?.handleType).filter(Boolean);
        expect(handleTypes.includes('dim_width')).toBe(true);
        expect(handleTypes.includes('dim_depth')).toBe(true);
    });

    it('handles external elevation-segment-select-arm event to switch active segment arm', () => {
        gizmo.attach(mockSegment);
        expect(gizmo.activeSegmentIndex).toBe(0);

        window.dispatchEvent(new CustomEvent('elevation-segment-select-arm', {
            detail: { armIndex: 1 }
        }));

        expect(gizmo.activeSegmentIndex).toBe(1);
    });

    it('switches mode when clicking an icon in the Wall Raiser HUD menu', () => {
        gizmo.attach(mockSegment);
        expect(gizmo.activeMode).toBe('extrude');

        const cornersBtn = gizmo.modeButtons.corners;
        expect(cornersBtn).toBeDefined();

        // Simulate click on HUD icon button
        cornersBtn.click();
        expect(gizmo.activeMode).toBe('corners');
    });

    it('cleans up handles and keeps floating HUD hidden on detach', () => {
        gizmo.attach(mockSegment);
        expect(gizmo.visible).toBe(true);
        expect(gizmo.domHUD.style.display).toBe('flex');

        gizmo.detach();
        expect(gizmo.visible).toBe(false);
        expect(gizmo.domHUD.style.display).toBe('none');
        expect(gizmo.handles.children.length).toBe(0);
    });
});

describe('ElevationSegment Phase 2: Corner & Connection Tool', () => {
    let mockWall;
    let mockSegment;

    beforeEach(() => {
        mockWall = {
            id: 'wall_1',
            startX: 0,
            startY: 0,
            endX: 300,
            endY: 0,
            thickness: 20,
            height: 300,
            elevation: 0,
            startAnchor: { position: () => ({ x: 0, y: 0 }) },
            endAnchor: { position: () => ({ x: 300, y: 0 }) }
        };
        mockSegment = createStarterElevationSegment(mockWall, 150, 150, 1, { length: 200, width: 30, depth: 40 });
        mockSegment.mesh3D = new THREE.Group();
    });

    it('creates 90° square corner preset via sproutCornerPreset', () => {
        const initialCount = mockSegment.points.length;
        const res = sproutCornerPreset(mockSegment, initialCount - 1, 'square_90', { direction: 'up', distance: 100 });

        expect(res).toBeDefined();
        expect(mockSegment.points.length).toBe(initialCount + 1);
        const lastPt = mockSegment.points[mockSegment.points.length - 1];
        expect(lastPt.y).toBe(mockSegment.points[initialCount - 1].y + 100);
    });

    it('creates 45° diagonal chamfer preset via sproutCornerPreset', () => {
        const initialCount = mockSegment.points.length;
        const res = sproutCornerPreset(mockSegment, initialCount - 1, 'diagonal_45', { direction: 'up', distance: 100 });

        expect(res).toBeDefined();
        expect(mockSegment.points.length).toBe(initialCount + 1);
        const bendPt = mockSegment.points[initialCount - 1];
        expect(bendPt.cornerStyle).toBe('bevel');
    });

    it('creates custom V-angle corner preset (60° and 120°)', () => {
        const initialCount = mockSegment.points.length;
        const res = sproutCornerPreset(mockSegment, initialCount - 1, 'v_angle', { angleDeg: 60, distance: 120 });

        expect(res).toBeDefined();
        expect(mockSegment.points.length).toBe(initialCount + 1);
    });

    it('sets bevel / chamfer corner style on node with radius cutoff', () => {
        // Add an interior node
        mockSegment.points.splice(1, 0, {
            x: 100, y: 150, z: 10,
            normal: { x: 0, y: 0, z: 1 },
            cornerStyle: 'sharp',
            radius: 0
        });

        const success = setNodeCornerStyle(mockSegment, 1, 'bevel', 30);
        expect(success).toBe(true);
        expect(mockSegment.points[1].cornerStyle).toBe('bevel');
        expect(mockSegment.points[1].radius).toBe(30);
    });

    it('detects nearby elevation segments within threshold and joins them cleanly', () => {
        const segB = createStarterElevationSegment(mockWall, 150, 150, 1, { length: 150, width: 30, depth: 40 });
        segB.id = 'elev_seg_b';
        // Position segB start near mockSegment end
        const lastA = mockSegment.points[mockSegment.points.length - 1];
        segB.points[0].x = lastA.x + 15;
        segB.points[0].y = lastA.y;
        segB.points[0].z = lastA.z;
        segB.points[1].x = lastA.x + 115;
        segB.points[1].y = lastA.y;
        segB.points[1].z = lastA.z;

        const planner = {
            elevationSegments: [mockSegment, segB],
            syncAll: vi.fn()
        };

        const nearby = findNearbyElevationSegments(planner, mockSegment, 45);
        expect(nearby.length).toBe(1);
        expect(nearby[0].segment.id).toBe('elev_seg_b');
        expect(nearby[0].distance).toBeLessThanOrEqual(15);

        const joined = joinElevationSegments(planner, mockSegment, segB, 45);
        expect(joined).toBeDefined();
        expect(planner.elevationSegments.find(s => s.id === 'elev_seg_b')).toBeUndefined();
        // Points should now be merged
        expect(mockSegment.points.length).toBe(3);
    });
});

describe('ElevationSegment Phase 3: Rotate Any Angle on Wall Plane', () => {
    let mockWall;
    let mockSegment;
    let mockCtx;
    let gizmo;

    beforeEach(() => {
        const domElement = document.createElement('div');
        domElement.getBoundingClientRect = () => ({
            left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600
        });
        const camera = new THREE.PerspectiveCamera(45, 800 / 600, 1, 1000);
        camera.position.set(0, 300, 600);
        camera.lookAt(0, 0, 0);

        mockWall = {
            id: 'wall_1',
            startX: 0, startY: 0, endX: 300, endY: 0,
            thickness: 20, height: 300, elevation: 0,
            startAnchor: { position: () => ({ x: 0, y: 0 }) },
            endAnchor: { position: () => ({ x: 300, y: 0 }) }
        };

        mockCtx = {
            renderer: { domElement },
            camera,
            scene: new THREE.Scene(),
            controls: { addEventListener: vi.fn(), removeEventListener: vi.fn(), enabled: true },
            requestRender: vi.fn(),
            planner: { walls: [mockWall], elevationSegments: [], debouncedSaveHistory: vi.fn() },
            helpers: { getMaterial: () => new THREE.MeshBasicMaterial() }
        };

        mockSegment = createStarterElevationSegment(mockWall, 150, 150, 1, { length: 200, width: 30, depth: 40 });
        mockSegment.mesh3D = new THREE.Group();
        const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 30, 40), new THREE.MeshBasicMaterial());
        bodyMesh.userData = { isElevationBody: true };
        mockSegment.mesh3D.add(bodyMesh);

        gizmo = new ElevationSegmentGizmo(mockCtx);
    });

    afterEach(() => {
        if (gizmo) gizmo.destroy();
    });

    it('displays rotation ring handle in "rotate" mode', () => {
        gizmo.attach(mockSegment);
        gizmo.setMode('rotate');

        expect(gizmo.activeMode).toBe('rotate');
        const handleTypes = gizmo.handles.children.map(c => c.userData?.handleType).filter(Boolean);
        expect(handleTypes.includes('rotation_ring')).toBe(true);
        expect(handleTypes.includes('push_pull')).toBe(false);
        expect(handleTypes.includes('extrude_arrow')).toBe(false);
    });

    it('rotates elevation segment 90° on wall plane while keeping normal invariant', () => {
        const p0 = { ...mockSegment.points[0] };
        const p1 = { ...mockSegment.points[1] };
        const origLength = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);

        const rotated = rotateElevationSegment(mockSegment, 90);
        expect(rotated).toBe(true);
        expect(mockSegment.rotation).toBe(90);

        // Segment length must be preserved under rigid rotation
        const newP0 = mockSegment.points[0];
        const newP1 = mockSegment.points[1];
        const newLength = Math.hypot(newP1.x - newP0.x, newP1.y - newP0.y, newP1.z - newP0.z);
        expect(Math.abs(newLength - origLength)).toBeLessThanOrEqual(2);

        // Rotation around wall normal (0, 0, 1) means delta-x becomes delta-y!
        // Originally horizontal (y constant, dx = 200). After 90°, dy ~ 200!
        expect(Math.abs(newP1.y - newP0.y)).toBeGreaterThan(150);
    });

    it('rotates 180° flipping start and end points symmetrically', () => {
        const cx = (mockSegment.points[0].x + mockSegment.points[1].x) / 2;
        const cy = (mockSegment.points[0].y + mockSegment.points[1].y) / 2;

        rotateElevationSegment(mockSegment, 180);
        expect(mockSegment.rotation).toBe(180);

        const newCx = (mockSegment.points[0].x + mockSegment.points[1].x) / 2;
        const newCy = (mockSegment.points[0].y + mockSegment.points[1].y) / 2;
        expect(Math.abs(newCx - cx)).toBeLessThanOrEqual(1);
        expect(Math.abs(newCy - cy)).toBeLessThanOrEqual(1);
    });
});

describe('ElevationSegmentGizmo Phase 4: Auto-Join Connected Segments Engine in 3D', () => {
    let mockCtx;
    let domElement;
    let camera;
    let gizmo;
    let mockWall;
    let mockSegmentA;
    let mockSegmentB;
    let mockPlanner;

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
        camera.position.set(0, 300, 600);
        camera.lookAt(0, 0, 0);

        mockWall = {
            id: 'wall_join_1',
            startX: 0,
            startY: 0,
            endX: 600,
            endY: 0,
            thickness: 20,
            height: 300
        };

        mockSegmentA = createStarterElevationSegment(mockWall, 100, 150, 1, { length: 180, width: 30, depth: 40 });
        mockSegmentA.id = 'seg_A';
        mockSegmentA.mesh3D = new THREE.Group();
        const bodyA = new THREE.Mesh(new THREE.BoxGeometry(180, 30, 40), new THREE.MeshBasicMaterial());
        bodyA.userData = { isElevationBody: true };
        mockSegmentA.mesh3D.add(bodyA);

        mockSegmentB = createStarterElevationSegment(mockWall, 300, 150, 1, { length: 180, width: 30, depth: 40 });
        mockSegmentB.id = 'seg_B';
        mockSegmentB.mesh3D = new THREE.Group();
        const bodyB = new THREE.Mesh(new THREE.BoxGeometry(180, 30, 40), new THREE.MeshBasicMaterial());
        bodyB.userData = { isElevationBody: true };
        mockSegmentB.mesh3D.add(bodyB);

        mockPlanner = {
            walls: [mockWall],
            elevationSegments: [mockSegmentA, mockSegmentB],
            syncAll: vi.fn(),
            debouncedSaveHistory: vi.fn()
        };

        mockCtx = {
            renderer: { domElement },
            camera,
            controls: { enabled: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
            planner: mockPlanner,
            requestRender: vi.fn(),
            helpers: { getMaterial: () => new THREE.MeshBasicMaterial() }
        };

        gizmo = new ElevationSegmentGizmo(mockCtx);
    });

    afterEach(() => {
        if (gizmo) gizmo.destroy();
    });

    it('splits an interior bend node into two independent elevation segments', () => {
        // Build a 3-point L-shape segment
        mockSegmentA.points = [
            { x: 0, y: 150, z: 10.3, normal: { x: 0, y: 0, z: 1 } },
            { x: 100, y: 150, z: 10.3, normal: { x: 0, y: 0, z: 1 }, cornerStyle: 'fillet', radius: 25 },
            { x: 100, y: 250, z: 10.3, normal: { x: 0, y: 0, z: 1 } }
        ];
        mockSegmentA.nodes = mockSegmentA.points.map((p, i) => ({ id: `n_${i}`, ...p }));

        const res = splitElevationSegmentAtNode(mockPlanner, mockSegmentA, 1);
        expect(res).not.toBeNull();
        expect(res.segA).toBe(mockSegmentA);
        expect(res.segA.points.length).toBe(2);
        expect(res.segB.points.length).toBe(2);

        // SegA points: 0 to 1
        expect(res.segA.points[0].x).toBe(0);
        expect(res.segA.points[1].x).toBe(100);
        expect(res.segA.points[1].y).toBe(150);

        // SegB points: 1 to 2
        expect(res.segB.points[0].x).toBe(100);
        expect(res.segB.points[0].y).toBe(150);
        expect(res.segB.points[1].y).toBe(250);

        // Planner now has both segments registered
        expect(mockPlanner.elevationSegments.find(s => s.id === res.segB.id)).toBeDefined();

        // Modifying segA doesn't affect segB (independent editing preserved!)
        res.segA.points[0].x = -50;
        expect(res.segB.points[0].x).toBe(100);
    });

    it('detects proximity and enables in-scene auto-join button', () => {
        // Place segA end within 20cm of segB start
        const endA = mockSegmentA.points[mockSegmentA.points.length - 1];
        mockSegmentB.points[0].x = endA.x + 15;
        mockSegmentB.points[0].y = endA.y;
        mockSegmentB.points[0].z = endA.z;

        gizmo.attach(mockSegmentA);
        expect(gizmo.hudContextStrip).toBeDefined();

        const nearby = findNearbyElevationSegments(mockPlanner, mockSegmentA, 45);
        expect(nearby.length).toBe(1);
        expect(nearby[0].segment.id).toBe('seg_B');
        expect(nearby[0].distance).toBeLessThanOrEqual(20);
    });

    it('auto-joins two nearby segments into one continuous assembly upon release', () => {
        const endA = mockSegmentA.points[mockSegmentA.points.length - 1];
        mockSegmentB.points[0].x = endA.x + 10;
        mockSegmentB.points[0].y = endA.y;
        mockSegmentB.points[0].z = endA.z;

        gizmo.attach(mockSegmentA);

        // Simulate magnetic snap latch during push_pull
        gizmo.isDragging = true;
        gizmo.activeHandle = {
            handleType: 'push_pull',
            nodeIndex: 1,
            snapAutoJoinTarget: mockSegmentB
        };

        gizmo._onPointerUp({});

        // SegB was merged into SegA and removed from planner
        expect(mockPlanner.elevationSegments.length).toBe(1);
        expect(mockSegmentA.points.length).toBeGreaterThanOrEqual(3);
        expect(gizmo.isDragging).toBe(false);
    });
});

describe('ElevationSegmentGizmo Phase 5: Direct 3D Dimension Controls & In-Scene W/H/D Adjustments', () => {
    let mockCtx;
    let domElement;
    let camera;
    let gizmo;
    let mockWall;
    let mockSegment;

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
        camera.position.set(0, 300, 600);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);

        mockWall = {
            id: 'wall_dims_1',
            startX: 0,
            startY: 0,
            endX: 500,
            endY: 0,
            thickness: 20,
            height: 300
        };

        mockSegment = createStarterElevationSegment(mockWall, 150, 150, 1, { length: 200, width: 30, depth: 40 });
        mockSegment.mesh3D = new THREE.Group();
        const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 30, 40), new THREE.MeshBasicMaterial());
        bodyMesh.userData = { isElevationBody: true };
        mockSegment.mesh3D.add(bodyMesh);

        mockCtx = {
            renderer: { domElement },
            camera,
            controls: { enabled: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
            planner: { walls: [mockWall], elevationSegments: [mockSegment] },
            requestRender: vi.fn(),
            helpers: { getMaterial: () => new THREE.MeshBasicMaterial() }
        };

        gizmo = new ElevationSegmentGizmo(mockCtx);
    });

    afterEach(() => {
        if (gizmo) gizmo.destroy();
    });

    it('creates width and depth handles exclusively in "dims" mode', () => {
        gizmo.attach(mockSegment);
        gizmo.setMode('dims');

        expect(gizmo.activeMode).toBe('dims');
        const handleTypes = gizmo.handles.children.map(c => c.userData?.handleType).filter(Boolean);
        expect(handleTypes.includes('dim_width')).toBe(true);
        expect(handleTypes.includes('dim_depth')).toBe(true);
        expect(handleTypes.includes('push_pull')).toBe(false);
        expect(handleTypes.includes('extrude_arrow')).toBe(false);
        expect(handleTypes.includes('rotation_ring')).toBe(false);
    });

    it('updates thickness (entity.width) live when dragging dim_width handle', () => {
        gizmo.attach(mockSegment);
        gizmo.setMode('dims');

        const widthHandle = gizmo.handles.children.find(c => c.userData?.handleType === 'dim_width');
        expect(widthHandle).toBeDefined();

        // Simulate pointer down on width handle
        gizmo.isDragging = true;
        gizmo.dragStartPoint.set(150, 165, 30.3);
        gizmo.activeHandle = {
            handleType: 'dim_width',
            initialWidth: 30,
            widthVec: new THREE.Vector3(0, 1, 0),
            normal: new THREE.Vector3(0, 0, 1),
            handlePos: widthHandle.position.clone()
        };

        // Dragging upward by 10cm expands width by 20cm (symmetric drop)
        vi.spyOn(gizmo.raycaster.ray, 'intersectPlane').mockImplementation((plane, target) => {
            target.set(150, 175, 30.3);
            return target;
        });

        gizmo._onPointerMove({ clientX: 400, clientY: 250 });

        expect(mockSegment.width).toBe(50);
    });

    it('updates overhang (entity.depth) live when dragging dim_depth handle', () => {
        gizmo.attach(mockSegment);
        gizmo.setMode('dims');

        const depthHandle = gizmo.handles.children.find(c => c.userData?.handleType === 'dim_depth');
        expect(depthHandle).toBeDefined();

        gizmo.isDragging = true;
        gizmo.dragStartPoint.set(150, 150, 50.3);
        gizmo.activeHandle = {
            handleType: 'dim_depth',
            initialDepth: 40,
            normal: new THREE.Vector3(0, 0, 1),
            handlePos: depthHandle.position.clone()
        };

        // Dragging outward along normal (+Z) by 20cm expands depth to 60cm
        vi.spyOn(gizmo.raycaster.ray, 'intersectPlane').mockImplementation((plane, target) => {
            target.set(150, 150, 70.3);
            return target;
        });

        gizmo._onPointerMove({ clientX: 400, clientY: 250 });

        expect(mockSegment.depth).toBe(60);
    });

    it('renders spec badge with length, width and depth in HUD', () => {
        gizmo.attach(mockSegment);
        expect(gizmo.hudSpecBadge.textContent).toContain('W:30');
        expect(gizmo.hudSpecBadge.textContent).toContain('D:40');
        expect(gizmo.hudSpecBadge.textContent).toContain('200cm');
    });
});

describe('ElevationSegmentGizmo Phase 6: Done, Cancel, and Corner Wrap Integrity', () => {
    let mockCtx;
    let domElement;
    let camera;
    let gizmo;
    let wallA;
    let wallB;
    let mockSegment;

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
        camera.position.set(0, 300, 600);
        camera.lookAt(0, 0, 0);

        wallA = {
            id: 'wall_A',
            name: 'Wall A',
            startX: 0,
            startY: 0,
            endX: 300,
            endY: 0,
            thickness: 20,
            height: 300
        };

        wallB = {
            id: 'wall_B',
            name: 'Wall B',
            startX: 300,
            startY: 0,
            endX: 300,
            endY: 300,
            thickness: 20,
            height: 300
        };

        mockSegment = createStarterElevationSegment(wallA, 250, 150, 1, { length: 80, width: 30, depth: 40 });
        mockSegment.mesh3D = new THREE.Group();
        const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(80, 30, 40), new THREE.MeshBasicMaterial());
        bodyMesh.userData = { isElevationBody: true };
        mockSegment.mesh3D.add(bodyMesh);

        mockCtx = {
            renderer: { domElement },
            camera,
            controls: { enabled: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
            planner: {
                walls: [wallA, wallB],
                elevationSegments: [mockSegment],
                selectEntity: vi.fn()
            },
            requestRender: vi.fn(),
            helpers: { getMaterial: () => new THREE.MeshBasicMaterial() }
        };

        gizmo = new ElevationSegmentGizmo(mockCtx);
    });

    afterEach(() => {
        if (gizmo) gizmo.destroy();
    });

    it('commitChanges preserves modifications and detaches without deleting entity', () => {
        gizmo.attach(mockSegment);
        expect(gizmo.visible).toBe(true);

        // Modify length
        mockSegment.points[1].x = 280;
        mockSegment.width = 45;

        gizmo.commitChanges();

        expect(gizmo.visible).toBe(false);
        expect(mockSegment.points[1].x).toBe(280);
        expect(mockSegment.width).toBe(45);
        expect(mockCtx.planner.elevationSegments).toContain(mockSegment);
        expect(mockCtx.planner.selectEntity).toHaveBeenCalledWith(null);
    });

    it('cancelChanges reverts points and dimensions to initial snapshot without deleting entity', () => {
        gizmo.attach(mockSegment);
        const originalX = mockSegment.points[1].x;
        const originalWidth = mockSegment.width;

        // User makes changes during editing
        mockSegment.points[1].x = 295;
        mockSegment.width = 60;
        mockSegment.depth = 55;

        // User clicks Cancel
        gizmo.cancelChanges();

        expect(gizmo.visible).toBe(false);
        expect(mockSegment.points[1].x).toBe(originalX);
        expect(mockSegment.width).toBe(originalWidth);
        expect(mockSegment.depth).toBe(40);
        expect(mockCtx.planner.elevationSegments).toContain(mockSegment);
        expect(mockCtx.planner.selectEntity).toHaveBeenCalledWith(null);
    });

    it('deleteSegment removes elevation segment from planner and scene', () => {
        gizmo.attach(mockSegment);
        gizmo.deleteSegment();

        expect(gizmo.visible).toBe(false);
        expect(mockCtx.planner.elevationSegments).not.toContain(mockSegment);
    });

    it('displays 3D Corner Wrap Handle in default extrude mode when near connected wall corner', () => {
        // Place segment endpoint within 50cm of corner (300, 0)
        mockSegment.points[1].x = 290;
        mockSegment.points[1].z = 10.3;

        gizmo.attach(mockSegment);
        expect(gizmo.activeMode).toBe('extrude');

        const cornerWrapHandle = gizmo.handles.children.find(c => c.userData?.handleType === 'corner_wrap');
        expect(cornerWrapHandle).toBeDefined();
    });

    it('wrapElevationSegmentToAdjacentWall creates flush endpoint along adjacent wall', () => {
        mockSegment.points[1].x = 295;
        mockSegment.points[1].z = 10.3;

        const res = wrapElevationSegmentToAdjacentWall(mockSegment, 1, mockCtx.planner);
        expect(res).not.toBeNull();
        expect(res.adjWall.id).toBe('wall_B');

        // cornerPt should be on the miter
        expect(res.cornerPt.x).toBe(290);
        // endPt should extend along wall B (+Z direction)
        expect(res.endPt.z).toBeGreaterThan(50);
        // Segments should be updated and valid
        expect(mockSegment.segments.length).toBe(mockSegment.points.length - 1);
    });
});

describe('ElevationSegmentGizmo Phase 7: Floating Speech Bubble HUD & Single-Arm Y-Elevation Adjustment', () => {
    let mockCtx;
    let domElement;
    let camera;
    let gizmo;
    let mockWall;
    let mockSegment;

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
        camera.position.set(0, 300, 600);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);

        mockWall = {
            id: 'wall_1',
            startX: 0,
            startY: 0,
            endX: 300,
            endY: 0,
            thickness: 20,
            height: 300,
            elevation: 0,
            startAnchor: { position: () => ({ x: 0, y: 0 }) },
            endAnchor: { position: () => ({ x: 300, y: 0 }) }
        };

        mockCtx = {
            renderer: { domElement },
            camera,
            scene: new THREE.Scene(),
            controls: { addEventListener: vi.fn(), removeEventListener: vi.fn(), enabled: true },
            requestRender: vi.fn(),
            planner: {
                walls: [mockWall],
                elevationSegments: [],
                debouncedSaveHistory: vi.fn(),
                selectEntity: vi.fn()
            },
            helpers: {
                getMaterial: () => new THREE.MeshBasicMaterial()
            }
        };

        mockSegment = createStarterElevationSegment(mockWall, 150, 150, 1, { length: 200, width: 30, depth: 40 });
        mockSegment.mesh3D = new THREE.Group();
        const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 30, 40), new THREE.MeshBasicMaterial());
        bodyMesh.userData = { isElevationBody: true };
        mockSegment.mesh3D.add(bodyMesh);

        gizmo = new ElevationSegmentGizmo(mockCtx);
    });

    afterEach(() => {
        if (gizmo) gizmo.destroy();
    });

    it('DOM HUD structure strictly adheres to speech bubble layout (media_1790996752151.png)', () => {
        expect(gizmo.domHUD).toBeDefined();
        expect(gizmo.domHUD.classList.contains('sms4-room-speech-hud')).toBe(true);

        // Top info spec badge
        expect(gizmo.hudSpecBadge).toBeDefined();
        expect(gizmo.hudSpecBadge.textContent).toContain('200cm');

        // Row 1 elements
        expect(gizmo.btnScopeArm).toBeDefined();
        expect(gizmo.btnScopeChain).toBeDefined();
        expect(gizmo.modeButtons.extrude).toBeDefined();
        expect(gizmo.modeButtons.elevate_arm).toBeDefined();
        expect(gizmo.modeButtons.corners).toBeDefined();
        expect(gizmo.modeButtons.dims).toBeDefined();
        expect(gizmo.btnStepDown).toBeDefined();
        expect(gizmo.btnStepUp).toBeDefined();
        expect(gizmo.btnDone).toBeDefined();
        expect(gizmo.btnCancel).toBeDefined();

        // Downward tail
        const tail = gizmo.domHUD.querySelector('.sms4-hud-tail');
        expect(tail).not.toBeNull();

        // Row 3 Action buttons (5 circular buttons)
        expect(gizmo.actionsContainer).toBeDefined();
        expect(gizmo.actionsContainer.children.length).toBe(5);
    });

    it('Scope switcher toggles between Active Arm (arm) and Entire Chain (chain)', () => {
        expect(gizmo.scopeMode).toBe('arm');

        gizmo.setScopeMode('chain');
        expect(gizmo.scopeMode).toBe('chain');

        gizmo.attach(mockSegment);
        const y0 = mockSegment.points[0].y;
        const y1 = mockSegment.points[1].y;

        gizmo.stepElevation(20);
        expect(mockSegment.points[0].y).toBe(y0 + 20);
        expect(mockSegment.points[1].y).toBe(y1 + 20);

        gizmo.setScopeMode('arm');
        expect(gizmo.scopeMode).toBe('arm');
    });

    it('Mode elevate_arm (Adjust Arm Height) activates and displays elevation_slide handle', () => {
        gizmo.attach(mockSegment);
        gizmo.setMode('elevate_arm');
        expect(gizmo.activeMode).toBe('elevate_arm');

        const elevHandle = gizmo.handles.children.find(c => c.userData?.handleType === 'elevation_slide');
        expect(elevHandle).toBeDefined();
        expect(elevHandle.userData.segmentIndex).toBe(0);
    });

    it('adjustArmElevation moves only the targeted segment arm in Y and keeps other connected segments in place', () => {
        // Multi-arm segment: 3 points (2 arms)
        const multiSeg = {
            id: 'multi_seg_1',
            name: 'Facade Molding',
            wallId: 'wall_1',
            width: 30,
            depth: 40,
            points: [
                { x: 50, y: 150, z: 10, normal: { x: 0, y: 0, z: 1 } },
                { x: 150, y: 150, z: 10, normal: { x: 0, y: 0, z: 1 } },
                { x: 250, y: 150, z: 10, normal: { x: 0, y: 0, z: 1 } }
            ]
        };
        initEntitySegments(multiSeg);
        expect(multiSeg.segments.length).toBe(2);

        // Adjust Arm 0 by +30cm: Arm 0 is (50, 150) -> (150, 150).
        // Since Arm 1 is also horizontal at y=150, step nodes are inserted so Arm 1 stays at y=150.
        adjustArmElevation(multiSeg, 0, 30);

        // Arm 0 endpoints should now be at y=180
        expect(multiSeg.points[0].y).toBe(180);
        expect(multiSeg.points[1].y).toBe(180);

        // The remaining segment (Arm 1) should remain at y=150
        const lastPt = multiSeg.points[multiSeg.points.length - 1];
        expect(lastPt.y).toBe(150);
    });

    it('setArmElevation adjusts single selected arm to target height via Gizmo HUD', () => {
        const multiSeg = {
            id: 'multi_seg_2',
            name: 'Miter Trim',
            wallId: 'wall_1',
            width: 30,
            depth: 40,
            points: [
                { x: 50, y: 120, z: 10, normal: { x: 0, y: 0, z: 1 } },
                { x: 150, y: 120, z: 10, normal: { x: 0, y: 0, z: 1 } },
                { x: 250, y: 120, z: 10, normal: { x: 0, y: 0, z: 1 } }
            ]
        };
        initEntitySegments(multiSeg);
        multiSeg.mesh3D = new THREE.Group();

        gizmo.attach(multiSeg);
        gizmo.activeSegmentIndex = 1; // Select Arm 2 (segment between point 1 and 2)

        gizmo.setArmElevation(200, 1);

        // Points corresponding to Arm 2 should have been elevated
        const pts = multiSeg.points;
        const lastPt = pts[pts.length - 1];
        expect(lastPt.y).toBe(200);

        // Arm 1 start point (point 0) should remain at 120
        expect(pts[0].y).toBe(120);
    });

    it('Elevation slide drag in arm scope updates selected arm while keeping other arms in place', () => {
        const multiSeg = {
            id: 'multi_seg_3',
            name: 'Dual Arm Segment',
            wallId: 'wall_1',
            width: 30,
            depth: 40,
            points: [
                { x: 50, y: 150, z: 10, normal: { x: 0, y: 0, z: 1 } },
                { x: 150, y: 150, z: 10, normal: { x: 0, y: 0, z: 1 } },
                { x: 250, y: 150, z: 10, normal: { x: 0, y: 0, z: 1 } }
            ]
        };
        initEntitySegments(multiSeg);
        multiSeg.mesh3D = new THREE.Group();

        gizmo.attach(multiSeg);
        gizmo.setMode('elevate_arm');
        gizmo.activeSegmentIndex = 0;

        // Find elevation slide handle
        const slideHandle = gizmo.handles.children.find(c => c.userData?.handleType === 'elevation_slide');
        expect(slideHandle).toBeDefined();

        // Simulate onPointerDown
        gizmo.activeHandle = {
            handleType: 'elevation_slide',
            segmentIndex: 0,
            initialY: 150,
            initialPointsY: multiSeg.points.map(p => p.y),
            initialPoints: JSON.parse(JSON.stringify(multiSeg.points)),
            initialNodes: null
        };
        gizmo.dragStartPoint = new THREE.Vector3(100, 150, 10);
        gizmo.isDragging = true;

        // Simulate onPointerMove with mouse moving up to y=200 (+50cm)
        const currentIntersection = new THREE.Vector3(100, 200, 10);
        gizmo.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -10);

        // Raycast mock
        gizmo.raycaster.ray.intersectPlane = vi.fn().mockImplementation((plane, target) => {
            target.copy(currentIntersection);
            return target;
        });

        const fakeEvent = {
            clientX: 400,
            clientY: 200,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };
        gizmo._onPointerMove(fakeEvent);

        // Arm 0 should be at 200
        expect(multiSeg.points[0].y).toBe(200);
        // The last point of Arm 1 should remain at 150
        const lastPt = multiSeg.points[multiSeg.points.length - 1];
        expect(lastPt.y).toBe(150);
    });
});



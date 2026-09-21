import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { RoofEngine } from '../../../core/roof/RoofEngine.js';
import { RoofMutationEngine } from '../../../core/roof/RoofMutationEngine.js';
import { Roof3DBuilder } from '../builders/Roof3DBuilder.js';
import { CurvedPortal3DBuilder } from '../builders/CurvedPortal3DBuilder.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';
import { Roof3DPlacementSystem } from '../../../core/engine3d/Roof3DPlacementSystem.js';

describe('CurvedPortalRoof Pipeline & 3D Assembly', () => {
    let mockPlanner;
    let mockCtx;

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
                restore: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                closePath: () => {},
                stroke: () => {},
                fill: () => {},
                scale: () => {},
                translate: () => {},
                rotate: () => {},
                arc: () => {},
                measureText: () => ({ width: 0 })
            });
        }
    });

    beforeEach(() => {
        mockPlanner = {
            roofs: [],
            walls: [],
            roomPaths: [],
            stage: { width: () => 1000, height: () => 800, batchDraw: vi.fn() },
            roofLayer: { add: vi.fn() },
            executeWithSnapshot: (fn) => fn(),
            debouncedSaveHistory: vi.fn(),
            syncAll: vi.fn(),
            selectEntity: vi.fn((entity, type) => {
                mockPlanner.selectedEntity = entity;
                mockPlanner.selectedType = type;
            }),
            updateToolStates: vi.fn(),
            tool: 'select'
        };

        mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: new THREE.Group(),
            camera: new THREE.PerspectiveCamera(),
            renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } },
            helpers: {
                getDynamicMaterial: vi.fn((key) => new THREE.MeshStandardMaterial({ name: key })),
            },
            assets: {
                getTexture: vi.fn().mockResolvedValue(null)
            },
            planner: mockPlanner,
            requestRender: vi.fn(),
            interactables: []
        };
    });

    it('1. should create a curved_portal roof entity with default sharp corners', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = RoofEngine.createRoof(mockPlanner, points, {
            roofType: 'curved_portal',
            radius: 0,
            wallSides: { left: true, right: true, front: false, back: false },
            thickness: 15,
            overhang: 0
        });

        expect(roof).toBeDefined();
        expect(roof.config.roofType).toBe('curved_portal');
        expect(roof.config.radius).toBe(0);
        expect(roof.config.wallSides.left).toBe(true);
        expect(roof.config.wallSides.right).toBe(true);
        expect(roof.config.wallSides.front).toBe(false);
    });

    it('2. should build 3D mesh with sharp 90-degree corners when radius is 0', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = {
            id: 'test_curved_portal_1',
            points,
            config: {
                roofType: 'curved_portal',
                radius: 0,
                wallSides: { left: true, right: true, front: false, back: false },
                thickness: 15,
                hasSpotlights: true
            }
        };

        const resolveRoofMat = () => ({
            mat: new THREE.MeshStandardMaterial({ color: 0xffffff }),
            isGlass: false,
            decor: null,
            key: 'white_plaster_wall'
        });

        const meshGroup = CurvedPortal3DBuilder.build(roof, roof.config, points, 280, mockCtx, resolveRoofMat);

        expect(meshGroup).toBeDefined();
        expect(meshGroup.userData.componentType).toBe('curved_portal');

        // Check sub-meshes
        const submeshes = meshGroup.children;
        expect(submeshes.length).toBeGreaterThan(0);

        const outerMesh = submeshes.find(c => c.userData?.materialSlot === 'outer');
        const ceilMesh = submeshes.find(c => c.userData?.materialSlot === 'ceiling');
        const fasciaMesh = submeshes.find(c => c.userData?.materialSlot === 'fascia');
        const spotGroup = submeshes.find(c => c.name === 'CurvedPortal_Spotlights');

        expect(outerMesh).toBeDefined();
        expect(ceilMesh).toBeDefined();
        expect(fasciaMesh).toBeDefined();
        expect(spotGroup).toBeDefined();
    });

    it('3. should build 3D mesh with smooth fillet arcs when radius > 0', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = {
            id: 'test_curved_portal_2',
            points,
            config: {
                roofType: 'curved_portal',
                radius: 40,
                wallSides: { left: true, right: true, front: false, back: false },
                thickness: 15,
                hasSpotlights: false
            }
        };

        const resolveRoofMat = () => ({
            mat: new THREE.MeshStandardMaterial({ color: 0xffffff }),
            isGlass: false,
            decor: null,
            key: 'white_plaster_wall'
        });

        const meshGroup = CurvedPortal3DBuilder.build(roof, roof.config, points, 280, mockCtx, resolveRoofMat);

        const outerMesh = meshGroup.children.find(c => c.userData?.materialSlot === 'outer');
        expect(outerMesh).toBeDefined();

        // With radius > 0, outerMesh geometry must have more vertices due to arc subdivisions
        const posAttr = outerMesh.geometry.getAttribute('position');
        expect(posAttr.count).toBeGreaterThan(6); // More than just a single flat quad
    });

    it('4. should mutate corner radius via RoofEngine.setCornerRadius', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = RoofEngine.createRoof(mockPlanner, points, {
            roofType: 'curved_portal',
            radius: 0
        });

        RoofEngine.setCornerRadius(roof, 45, mockPlanner);
        expect(roof.config.radius).toBe(45);

        RoofEngine.setCornerRadius(roof, 0, mockPlanner);
        expect(roof.config.radius).toBe(0);
    });

    it('5. should mutate wall sides and presets via RoofEngine', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = RoofEngine.createRoof(mockPlanner, points, {
            roofType: 'curved_portal',
            wallSides: { left: true, right: true, front: false, back: false }
        });

        // Toggle individual wall
        RoofEngine.setWallSide(roof, 'left', false, mockPlanner);
        expect(roof.config.wallSides.left).toBe(false);

        // Apply 1-Wall Cantilever preset
        RoofEngine.setWallSides(roof, { left: true, right: false, front: false, back: false }, mockPlanner);
        expect(roof.config.wallSides.left).toBe(true);
        expect(roof.config.wallSides.right).toBe(false);

        // Apply 4-Wall Enclosed Cube preset
        RoofEngine.setWallSides(roof, { left: true, right: true, front: true, back: true }, mockPlanner);
        expect(roof.config.wallSides.front).toBe(true);
        expect(roof.config.wallSides.back).toBe(true);
    });

    it('6. should mutate wall drop height and spotlights via RoofEngine', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = RoofEngine.createRoof(mockPlanner, points, {
            roofType: 'curved_portal'
        });

        RoofEngine.setWallDropHeight(roof, 180, mockPlanner);
        expect(roof.config.wallDropHeight).toBe(180);

        RoofEngine.setSpotlights(roof, false, mockPlanner);
        expect(roof.config.hasSpotlights).toBe(false);

        RoofEngine.setSpotlights(roof, true, mockPlanner);
        expect(roof.config.hasSpotlights).toBe(true);
    });

    it('7. should integrate cleanly into Roof3DBuilder.buildRoofs', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = {
            id: 'test_curved_portal_integration',
            points,
            config: {
                roofType: 'curved_portal',
                radius: 25,
                wallSides: { left: true, right: true, front: false, back: false },
                thickness: 15
            },
            elevation: 280
        };

        const targetGroup = new THREE.Group();
        const builder = new Roof3DBuilder(mockCtx);
        builder.buildRoofs([roof], 0, false, targetGroup);

        expect(targetGroup.children.length).toBe(1);
        const roofGroup = targetGroup.children[0];
        expect(roofGroup.userData.isRoof).toBe(true);

        const portalMesh = roofGroup.children.find(c => c.userData?.isCurvedPortal);
        expect(portalMesh).toBeDefined();
    });

    it('8. should connect roof wall flush to below wall without duplicate drop down to floor', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        // An existing below wall at y = 0 from x: 0 to 300, height 120, elevation 0
        const belowWall = {
            id: 'below_wall_1',
            startX: 0, startY: 0,
            endX: 300, endY: 0,
            elevation: 0,
            height: 120,
            thickness: 15
        };
        mockCtx.walls = [belowWall];

        const roof = {
            id: 'test_curved_portal_below_wall',
            points,
            elevation: 120,
            config: {
                roofType: 'curved_portal',
                radius: 0,
                connectedWallId: 'below_wall_1',
                wallSides: { back: true, right: true, left: false, front: false },
                thickness: 15
            }
        };

        const resolveRoofMat = () => ({
            mat: new THREE.MeshStandardMaterial({ color: 0xffffff }),
            isGlass: false,
            decor: null,
            key: 'white_plaster_wall'
        });

        const meshGroup = CurvedPortal3DBuilder.build(roof, roof.config, points, 120, mockCtx, resolveRoofMat);
        expect(meshGroup).toBeDefined();

        const outerMesh = meshGroup.children.find(c => c.userData?.materialSlot === 'outer');
        expect(outerMesh).toBeDefined();

        // Check vertex positions in outerMesh
        const pos = outerMesh.geometry.attributes.position.array;
        let minVertY = Infinity;
        let maxVertY = -Infinity;
        for (let i = 1; i < pos.length; i += 3) {
            minVertY = Math.min(minVertY, pos[i]);
            maxVertY = Math.max(maxVertY, pos[i]);
        }

        // The open right wall drops down to ground (-120)
        expect(minVertY).toBe(-120);
        // The top slab is at 0
        expect(maxVertY).toBe(0);
    });

    it('9. should generate Front and Back fillet arcs and drop walls', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = {
            id: 'test_curved_portal_front_back',
            points,
            elevation: 120,
            config: {
                roofType: 'curved_portal',
                radius: 20,
                wallSides: { front: true, back: true, left: false, right: false },
                thickness: 15
            }
        };

        const resolveRoofMat = () => ({
            mat: new THREE.MeshStandardMaterial({ color: 0xffffff }),
            isGlass: false,
            decor: null,
            key: 'white_plaster_wall'
        });

        const meshGroup = CurvedPortal3DBuilder.build(roof, roof.config, points, 120, mockCtx, resolveRoofMat);
        expect(meshGroup).toBeDefined();

        const outerMesh = meshGroup.children.find(c => c.userData?.materialSlot === 'outer');
        const ceilMesh = meshGroup.children.find(c => c.userData?.materialSlot === 'ceiling');
        const fasciaMesh = meshGroup.children.find(c => c.userData?.materialSlot === 'fascia');

        expect(outerMesh).toBeDefined();
        expect(ceilMesh).toBeDefined();
        expect(fasciaMesh).toBeDefined();

        // Verify that vertices span in Z towards minY (0) and maxY (200)
        const pos = outerMesh.geometry.attributes.position.array;
        let minZ = Infinity, maxZ = -Infinity;
        for (let i = 2; i < pos.length; i += 3) {
            minZ = Math.min(minZ, pos[i]);
            maxZ = Math.max(maxZ, pos[i]);
        }
        expect(minZ).toBeCloseTo(0, 0);
        expect(maxZ).toBeCloseTo(200, 0);
    });

    it('10. should snap and align to wall in Roof3DPlacementSystem', () => {
        const belowWall = {
            id: 'wall_snap_test',
            x1: 100, y1: 50,
            x2: 400, y2: 50,
            elevation: 0,
            height: 120,
            thickness: 16,
            startAnchor: { position: () => ({ x: 100, y: 50 }) },
            endAnchor: { position: () => ({ x: 400, y: 50 }) }
        };
        mockPlanner.walls = [belowWall];
        mockPlanner.tool = 'curved_portal';
        mockPlanner.activePresetParams = { roofType: 'curved_portal' };

        const placementSystem = new Roof3DPlacementSystem(mockCtx, null);
        const hit = { x: 250, y: 120, z: 50, hitEntity: belowWall };
        const autoShape = placementSystem._getAutoRoofShape(hit);

        expect(autoShape).toBeDefined();
        expect(autoShape.type).toBe('wall_attached');
        expect(autoShape.connectedWallId).toBe('wall_snap_test');
        expect(autoShape.elevation).toBe(120);
        expect(autoShape.thickness).toBe(16);
        expect(autoShape.points.length).toBe(4);
    });

    it('11. Option A: should initialize circle dot snap cursor and anchor groups in Roof3DPlacementSystem', () => {
        const placementSystem = new Roof3DPlacementSystem(mockCtx, null);

        expect(placementSystem.snapIndicatorGroup).toBeDefined();
        expect(placementSystem.snapRing).toBeDefined();
        expect(placementSystem.snapDot).toBeDefined();
        expect(placementSystem.startAnchorGroup).toBeDefined();
        expect(placementSystem.snapHaloGroup).toBeDefined();

        // Cursor should have depthTest: false and high renderOrder for CAD clarity
        expect(placementSystem.snapRing.renderOrder).toBe(10002);
        expect(placementSystem.snapDot.renderOrder).toBe(10003);
        expect(placementSystem.snapRingMat.depthTest).toBe(false);
        expect(placementSystem.snapDotMat.depthTest).toBe(false);

        placementSystem.dispose();
    });

    it('12. Option A: should perform multi-level magnetic snapping to wall corners, roof corners, wall tops, and surfaces', () => {
        const wall = {
            id: 'wall_magnetic_1',
            x1: 200, y1: 100,
            x2: 600, y2: 100,
            elevation: 0,
            height: 140,
            thickness: 20,
            startAnchor: { position: () => ({ x: 200, y: 100 }) },
            endAnchor: { position: () => ({ x: 600, y: 100 }) }
        };
        const existingRoof = {
            id: 'roof_existing_1',
            elevation: 140,
            config: { thickness: 15 },
            points: [
                { x: 1000, y: 500 },
                { x: 1400, y: 500 },
                { x: 1400, y: 800 },
                { x: 1000, y: 800 }
            ]
        };

        mockPlanner.walls = [wall];
        mockPlanner.roofs = [existingRoof];
        const placementSystem = new Roof3DPlacementSystem(mockCtx, null);

        // 1. Near wall corner (200, 100) -> snaps to wall corner
        const nearCorner = new THREE.Vector3(208, 0, 106); // 10cm away
        const snapCorner = placementSystem._findMagneticSnap(nearCorner, 140, wall, mockPlanner);
        expect(snapCorner.snapType).toBe('wall_corner');
        expect(snapCorner.x).toBe(200);
        expect(snapCorner.z).toBe(100);
        expect(snapCorner.y).toBe(140);
        expect(snapCorner.color).toBe(0x10b981); // Emerald green

        // 2. Near existing roof corner (1400, 800) -> snaps to roof corner
        const nearRoofCorner = new THREE.Vector3(1405, 0, 796);
        const snapRoofCorner = placementSystem._findMagneticSnap(nearRoofCorner, 155, null, mockPlanner);
        expect(snapRoofCorner.snapType).toBe('roof_corner');
        expect(snapRoofCorner.x).toBe(1400);
        expect(snapRoofCorner.z).toBe(800);
        expect(snapRoofCorner.y).toBe(155);
        expect(snapRoofCorner.color).toBe(0x06b6d4); // Cyan

        // 3. Along wall baseline (400, 104) -> snaps to wall centerline edge
        const nearEdge = new THREE.Vector3(400, 0, 104);
        const snapEdge = placementSystem._findMagneticSnap(nearEdge, 140, wall, mockPlanner);
        expect(snapEdge.snapType).toBe('wall_edge');
        expect(snapEdge.x).toBe(400);
        expect(snapEdge.z).toBe(100);
        expect(snapEdge.y).toBe(140);
        expect(snapEdge.color).toBe(0x00f0ff);

        // 4. On surface (e.g. flat roof slab at y=200) -> 5cm grid snap
        const onSurface = new THREE.Vector3(302, 0, 304);
        const snapSurface = placementSystem._findMagneticSnap(onSurface, 200, { isFloor: true }, mockPlanner);
        expect(snapSurface.snapType).toBe('surface');
        expect(snapSurface.x).toBe(300);
        expect(snapSurface.z).toBe(305);
        expect(snapSurface.y).toBe(200);
        expect(snapSurface.color).toBe(0x60a5fa);

        placementSystem.dispose();
    });

    it('13. Option A: should allow any size drawing (small or big) without arbitrary 40cm override', () => {
        mockPlanner.tool = 'roof';
        mockPlanner.activePresetParams = { roofType: 'flat' };
        const placementSystem = new Roof3DPlacementSystem(mockCtx, null);

        // Simulate dragging a small 20cm x 15cm canopy
        placementSystem.drawing = true;
        placementSystem.startPoint = { x: 100, z: 100, y: 120 };
        placementSystem.currentPoint = { x: 120, z: 115, y: 120 };

        const fakeUpEvent = { button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() };
        placementSystem.onPointerUp(fakeUpEvent);

        // Created roof must preserve the exact 20 x 15 cm dimensions
        expect(mockPlanner.roofs.length).toBe(1);
        const placed = mockPlanner.roofs[0];
        const w = placed.points[1].x - placed.points[0].x;
        const d = placed.points[2].y - placed.points[1].y;
        expect(w).toBe(20);
        expect(d).toBe(15);

        placementSystem.dispose();
    });

    it('14. Option A: should provide in-place corner editing handles in CurvedPortalRoofGizmo', async () => {
        const { CurvedPortalRoofGizmo } = await import('../CurvedPortalRoofGizmo.js');
        const gizmo = new CurvedPortalRoofGizmo(mockCtx);

        const entity = {
            id: 'portal_test_gizmo',
            config: {
                roofType: 'curved_portal',
                radius: 12,
                thickness: 15,
                wallSides: { left: true, right: true, front: false, back: false }
            },
            points: [
                { x: 0, y: 0 },
                { x: 200, y: 0 },
                { x: 200, y: 150 },
                { x: 0, y: 150 }
            ]
        };

        const targetMesh = new THREE.Mesh(new THREE.BufferGeometry());
        targetMesh.userData = { entity };
        const parentGroup = new THREE.Group();
        parentGroup.position.set(50, 120, 50);
        parentGroup.add(targetMesh);
        mockCtx.scene.add(parentGroup);

        gizmo.attach(targetMesh, 'corners');

        expect(gizmo.visible).toBe(true);
        expect(gizmo.cornerHandles.length).toBe(4);
        expect(gizmo.curveHandles.length).toBe(2);
        expect(gizmo.thicknessHandle).toBeDefined();

        // Corner handles must be positioned at the 4 footprint corners
        const h0 = gizmo.cornerHandles[0];
        const h1 = gizmo.cornerHandles[1];
        const h2 = gizmo.cornerHandles[2];
        const h3 = gizmo.cornerHandles[3];

        expect(h0.position.x).toBeCloseTo(50 - 100, 0); // minX - cx
        expect(h0.position.z).toBeCloseTo(50 - 75, 0);  // minY - cz
        expect(h1.position.x).toBeCloseTo(50 + 100, 0); // maxX - cx
        expect(h2.position.z).toBeCloseTo(50 + 75, 0);  // maxY - cz

        gizmo.dispose?.();
    });

    it('15. Option B: should build arbitrary polygon curved portal roof (L-shaped footprint) with multi-slot materials and corner handles', async () => {
        const { CurvedPortal3DBuilder } = await import('../builders/CurvedPortal3DBuilder.js');
        const { CurvedPortalRoofGizmo } = await import('../CurvedPortalRoofGizmo.js');

        // L-shaped footprint with 6 vertices
        const lPoints = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 150 },
            { x: 150, y: 150 },
            { x: 150, y: 300 },
            { x: 0, y: 300 }
        ];

        const roofEntity = {
            id: 'l_portal_roof',
            points: lPoints,
            elevation: 120,
            config: {
                roofType: 'curved_portal',
                thickness: 15,
                material: 'white_plaster_wall',
                ceilingMaterial: 'white_plaster_wall',
                fasciaMaterial: 'metal_dark_steel'
            }
        };

        const group = CurvedPortal3DBuilder.build(
            roofEntity,
            roofEntity.config,
            lPoints,
            120,
            mockCtx,
            (matId) => ({ mat: new THREE.MeshStandardMaterial(), info: { name: matId } })
        );

        expect(group).toBeDefined();
        // Meshes for outer slab, underside ceiling, perimeter fascia
        const meshes = group.children.filter(c => c.isMesh);
        expect(meshes.length).toBeGreaterThanOrEqual(3);

        // Corner handles for all 6 vertices
        const gizmo = new CurvedPortalRoofGizmo(mockCtx);
        const targetMesh = meshes[0];
        targetMesh.userData = { entity: roofEntity };
        group.add(targetMesh);
        mockCtx.scene.add(group);

        gizmo.attach(targetMesh, 'corners');
        expect(gizmo.cornerHandles.length).toBe(6);

        gizmo.dispose?.();
    });

    it('16. Option B: should not generate bounding-box drop walls or fillet arcs on N > 4 polygon roofs', async () => {
        const { CurvedPortal3DBuilder } = await import('../builders/CurvedPortal3DBuilder.js');

        const poly6 = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 150 },
            { x: 150, y: 150 },
            { x: 150, y: 300 },
            { x: 0, y: 300 }
        ];

        const entity = {
            id: 'poly6_roof',
            points: poly6,
            elevation: 120,
            config: {
                roofType: 'curved_portal',
                radius: 15,
                thickness: 15,
                wallSides: { left: true, right: true, front: true, back: true }
            }
        };

        const group = CurvedPortal3DBuilder.build(
            entity,
            entity.config,
            poly6,
            120,
            mockCtx,
            (matId) => ({ mat: new THREE.MeshStandardMaterial(), info: { name: matId } })
        );

        expect(group).toBeDefined();
        // Meshes: outer top slab, underside ceiling, perimeter fascia
        const outerMesh = group.children.find(c => c.userData?.materialSlot === 'outer');
        const ceilingMesh = group.children.find(c => c.userData?.materialSlot === 'ceiling');
        const fasciaMesh = group.children.find(c => c.userData?.materialSlot === 'fascia');

        expect(outerMesh).toBeDefined();
        expect(ceilingMesh).toBeDefined();
        expect(fasciaMesh).toBeDefined();

        // Fascia positions should strictly follow the 6 polygon segments (6 * 2 triangles * 3 vertices = 36 vertices)
        const fasciaPos = fasciaMesh.geometry.getAttribute('position');
        expect(fasciaPos.count).toBe(36);
    });
});


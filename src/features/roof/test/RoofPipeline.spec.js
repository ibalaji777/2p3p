import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { Roof3DBuilder } from '../builders/Roof3DBuilder.js';
import { PremiumHipRoof } from '../roof.renderer2d.js';
import { ROOF_REGISTRY } from '../roof.components.registry.js';

describe('Roof Pipeline & 3D Addition', () => {
    let mockPlanner;

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
            stage: { width: () => 1000, height: () => 800 },
            roofLayer: { add: vi.fn() },
            executeWithSnapshot: (fn) => fn(),
            syncAll: vi.fn(),
            selectEntity: vi.fn((entity, type) => {
                mockPlanner.selectedEntity = entity;
                mockPlanner.selectedType = type;
            }),
            updateToolStates: vi.fn(),
            tool: 'select'
        };
    });

    it('1. should verify ROOF_REGISTRY contains roof components', () => {
        expect(ROOF_REGISTRY['roof']).toBeDefined();
        expect(ROOF_REGISTRY['roof'].defaultConfig.roofType).toBe('gable');
        expect(typeof ROOF_REGISTRY['roof'].render3D).toBe('function');
    });

    it('2. should instantiate PremiumHipRoof with default and custom configurations', () => {
        const points = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }];
        const roof = new PremiumHipRoof(mockPlanner, points);

        expect(roof.points.length).toBe(4);
        expect(roof.config.roofType).toBe('hip');
        expect(roof.config.pitch).toBe(30);
        expect(roof.config.overhang).toBe(8);
    });

    it('3. should generate 3D mesh for Gable, Hip, and Flat roofs via Roof3DBuilder', () => {
        const targetGroup = new THREE.Group();
        const mockCtx = {
            structureGroup: targetGroup,
            interactables: [],
            helpers: {
                getDynamicMaterial: vi.fn().mockReturnValue(new THREE.MeshStandardMaterial({ color: 0x888888 }))
            },
            assets: {
                getTexture: vi.fn().mockResolvedValue(new THREE.Texture())
            }
        };

        const builder = new Roof3DBuilder(mockCtx);
        const points = [{ x: -100, y: -75 }, { x: 100, y: -75 }, { x: 100, y: 75 }, { x: -100, y: 75 }];

        // Test Gable Roof
        const gableRoof = {
            points,
            config: { roofType: 'gable', pitch: 30, overhang: 8, material: 'terracotta_tiles_roof' },
            elevation: 100
        };
        builder.buildRoofs([gableRoof], 0, false, targetGroup);
        expect(targetGroup.children.length).toBe(1);
        expect(gableRoof.mesh3D).toBeDefined();

        // Test Flat Roof
        const flatGroup = new THREE.Group();
        mockCtx.structureGroup = flatGroup;
        const flatRoof = {
            points,
            config: { roofType: 'flat', thick: 15, material: 'white_gravel_roof' },
            elevation: 100
        };
        builder.buildRoofs([flatRoof], 0, false, flatGroup);
        expect(flatGroup.children.length).toBe(1);
        expect(flatRoof.mesh3D).toBeDefined();
    });

    it('4. should apply custom parameters and live updates in addAutoRoof', async () => {
        const { FloorPlanner } = await import('../../../core/engine2d/index.js');
        // Test addAutoRoof method logic on mock instance
        const plannerInstance = {
            roofs: [],
            walls: [],
            roomPaths: [],
            stage: { width: () => 1000, height: () => 800 },
            roofLayer: { add: vi.fn() },
            executeWithSnapshot: (fn) => fn(),
            syncAll: vi.fn(),
            selectEntity: vi.fn((entity, type) => {
                plannerInstance.selectedEntity = entity;
                plannerInstance.selectedType = type;
            }),
            updateToolStates: vi.fn(),
            tool: 'select'
        };

        FloorPlanner.prototype.addAutoRoof.call(plannerInstance, { roofType: 'flat', thick: 15, material: 'white_gravel_roof' });
        expect(plannerInstance.roofs.length).toBe(1);
        expect(plannerInstance.roofs[0].config.roofType).toBe('flat');
        expect(plannerInstance.roofs[0].config.material).toBe('white_gravel_roof');
        expect(plannerInstance.selectedEntity).toBe(plannerInstance.roofs[0]);

        // Test in-place update when roof is selected
        FloorPlanner.prototype.addAutoRoof.call(plannerInstance, { roofType: 'gable', pitch: 35, material: 'terracotta_tiles_roof' });
        expect(plannerInstance.roofs.length).toBe(1); // Same roof updated in place
        expect(plannerInstance.roofs[0].config.roofType).toBe('gable');
        expect(plannerInstance.roofs[0].config.pitch).toBe(35);
        expect(plannerInstance.roofs[0].config.material).toBe('terracotta_tiles_roof');
    });

    it('5. should handle Sims 4 style interactive 3D roof placement and drag-to-draw', async () => {
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        
        const mockPlanner = {
            tool: 'roof',
            activePresetParams: { roofType: 'gable', pitch: 30, material: 'terracotta_tiles_roof', overhang: 8 },
            walls: [{ height: 120, startAnchor: { position: () => ({ x: 0, y: 0 }) }, endAnchor: { position: () => ({ x: 200, y: 0 }) } }],
            roomPaths: [[{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }]],
            roofs: [],
            executeWithSnapshot: (fn) => fn(),
            selectEntity: vi.fn(),
            updateToolStates: vi.fn()
        };

        const mockScene = new THREE.Group();
        const mockCamera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
        mockCamera.position.set(100, 300, 300);
        mockCamera.lookAt(100, 120, 75);

        const mockCtx = {
            scene: mockScene,
            camera: mockCamera,
            renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } },
            controls: { enabled: true },
            planner: mockPlanner,
            helpers: {
                getDynamicMaterial: () => new THREE.MeshStandardMaterial({ color: 0x888888 })
            },
            assets: {
                getTexture: vi.fn().mockResolvedValue(new THREE.Texture())
            },
            requestRender: vi.fn(),
            buildScene: vi.fn()
        };

        const mockInteractions = {
            selectObject: vi.fn()
        };

        const placementSystem = new Roof3DPlacementSystem(mockCtx, mockInteractions);
        expect(placementSystem.isPlacementTool()).toBe(true);

        // 1. Pointer Down at (x=0, z=0)
        placementSystem._getRaycastIntersection = vi.fn(() => ({ x: 0, y: 120, z: 0 }));
        const eventDown = { button: 0, clientX: 200, clientY: 200, preventDefault: vi.fn(), stopPropagation: vi.fn() };
        placementSystem.onPointerDown(eventDown);
        expect(placementSystem.drawing).toBe(true);

        // 2. Pointer Move at (x=200, z=150)
        placementSystem._getRaycastIntersection = vi.fn(() => ({ x: 200, y: 120, z: 150 }));
        const eventMove = { button: 0, clientX: 400, clientY: 350, preventDefault: vi.fn(), stopPropagation: vi.fn() };
        placementSystem.onPointerMove(eventMove);
        expect(placementSystem.ghostGroup.visible).toBe(true);

        // 3. Pointer Up to commit roof
        const eventUp = { button: 0, clientX: 400, clientY: 350, preventDefault: vi.fn(), stopPropagation: vi.fn() };
        placementSystem.onPointerUp(eventUp);
        expect(placementSystem.drawing).toBe(false);
        expect(mockPlanner.roofs.length).toBe(1);
        expect(mockPlanner.roofs[0].config.roofType).toBe('gable');

        placementSystem.dispose();
    });

    it('6. should build 3D mesh for Shed (Half-Gable), Half-Hip, and Curved Pagoda roofs with gable infill', async () => {
        const { Roof3DBuilder } = await import('../builders/Roof3DBuilder.js');
        const mockCtx = {
            helpers: {
                getDynamicMaterial: (key, type) => new THREE.MeshStandardMaterial({ color: 0x888888 })
            },
            assets: {
                getTexture: vi.fn().mockResolvedValue(new THREE.Texture())
            },
            structureGroup: new THREE.Group()
        };

        const builder = new Roof3DBuilder(mockCtx);
        const sceneGroup = new THREE.Group();

        // 1. Build Shed (Half-Gable / Mono-pitch) roof
        const shedRoof = {
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
            config: { roofType: 'shed', pitch: 25, material: 'grey_slate_roof', overhang: 8, gableMaterial: 'white_plaster_wall' },
            elevation: 120
        };
        builder.buildRoofs([shedRoof], 0, false, sceneGroup);
        expect(sceneGroup.children.length).toBe(1);
        const shedMeshGroup = sceneGroup.children[0];
        expect(shedMeshGroup.children.length).toBeGreaterThanOrEqual(1);

        // 2. Build Half-Hip roof
        const halfHipRoof = {
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
            config: { roofType: 'half_hip', pitch: 30, material: 'terracotta_red_roof', overhang: 8 },
            elevation: 120
        };
        builder.buildRoofs([halfHipRoof], 0, false, sceneGroup);
        expect(sceneGroup.children.length).toBe(2);

        // 3. Build Curved Pagoda roof
        const curvedRoof = {
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
            config: { roofType: 'curved', pitch: 30, curve: -25, material: 'blue_ceramic_tiles_roof', overhang: 8 },
            elevation: 120
        };
        builder.buildRoofs([curvedRoof], 0, false, sceneGroup);
        expect(sceneGroup.children.length).toBe(3);
    });

    it('7. should attach and update RoofPitchCurvatureGizmo on selected roofs', async () => {
        const { RoofPitchCurvatureGizmo } = await import('../RoofPitchCurvatureGizmo.js');
        const mockCtx = {
            renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: null } },
            camera: new THREE.PerspectiveCamera(45, 1, 1, 1000),
            scene: new THREE.Group(),
            controls: { enabled: true },
            requestRender: vi.fn()
        };

        const gizmo = new RoofPitchCurvatureGizmo(mockCtx);
        expect(gizmo.visible).toBe(false);

        const mockRoofEntity = {
            type: 'roof',
            id: 'roof_test_gizmo',
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
            config: { roofType: 'gable', pitch: 30, curve: -15, overhang: 8 },
            elevation: 120,
            updateGeometry: vi.fn()
        };

        const mockTargetMesh = new THREE.Mesh();
        mockTargetMesh.userData = { isRoof: true, entity: mockRoofEntity };

        // Attach to selected roof
        gizmo.attach(mockTargetMesh);
        expect(gizmo.visible).toBe(true);
        expect(gizmo.handles.children.length).toBeGreaterThanOrEqual(2); // Pitch cone + curve sphere + overhang tabs

        // Check handle types
        const types = gizmo.handles.children.map(h => h.userData.type);
        expect(types).toContain('pitch');
        expect(types).toContain('curve');
        expect(types).toContain('overhang');

        // Detach
        gizmo.detach();
        expect(gizmo.visible).toBe(false);
        expect(gizmo.handles.children.length).toBe(0);

        gizmo.dispose();
    });

    it('7b. should interactively adjust pitch, curvature, overhang, and footprint stretch in RoofPitchCurvatureGizmo', async () => {
        const { RoofPitchCurvatureGizmo } = await import('../RoofPitchCurvatureGizmo.js');
        const mockEnvBuilder = { updateRoofLive: vi.fn() };
        const mockCtx = {
            renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: null, style: {} } },
            camera: new THREE.PerspectiveCamera(45, 1, 1, 1000),
            scene: new THREE.Group(),
            controls: { enabled: true },
            envBuilder: mockEnvBuilder,
            requestRender: vi.fn()
        };

        const gizmo = new RoofPitchCurvatureGizmo(mockCtx);
        const mockRoofEntity = {
            type: 'roof',
            id: 'roof_test_gizmo_drag',
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
            config: { roofType: 'gable', pitch: 30, curve: 0, overhang: 8 },
            elevation: 120,
            updateGeometry: vi.fn()
        };

        const mockTargetMesh = new THREE.Mesh();
        mockTargetMesh.userData = { isRoof: true, entity: mockRoofEntity };
        gizmo.attach(mockTargetMesh);

        // 1. Simulate pitch drag
        gizmo.isDragging = true;
        gizmo.activeHandle = gizmo.peakHandle;
        gizmo.dragStartPos.set(100, 100, 75);
        gizmo.planeIntersect.set(100, 140, 75); // deltaY = +40
        gizmo.initialRh = 43.3;
        gizmo.initialMaxX = 200; gizmo.initialMinX = 0;
        gizmo.initialMaxY = 150; gizmo.initialMinY = 0;

        // Mock raycaster intersectPlane to return our simulated intersection
        gizmo.raycaster.ray.intersectPlane = (plane, target) => {
            target.copy(gizmo.planeIntersect);
            return target;
        };

        gizmo._onPointerMove({ clientX: 400, clientY: 300, preventDefault: () => {}, stopPropagation: () => {} });

        expect(mockRoofEntity.config.pitch).toBeGreaterThan(30);
        expect(mockEnvBuilder.updateRoofLive).toHaveBeenCalledWith(mockRoofEntity);
        expect(mockCtx.requestRender).toHaveBeenCalled();

        // 2. Simulate curvature drag
        gizmo.activeHandle = gizmo.curveHandle;
        gizmo.initialCurve = 0;
        gizmo.dragStartPos.set(100, 50, 75);
        gizmo.planeIntersect.set(100, 80, 75); // deltaY = +30 -> newCurve = 12
        gizmo._onPointerMove({ clientX: 400, clientY: 280, preventDefault: () => {}, stopPropagation: () => {} });

        expect(mockRoofEntity.config.curve).toBe(12);

        // 3. Simulate overhang drag
        const overhangTab = gizmo.overhangHandles[1]; // East
        gizmo.activeHandle = overhangTab;
        gizmo.initialOverhang = 8;
        gizmo.dragStartPos.set(208, 124, 75);
        gizmo.planeIntersect.set(220, 124, 75); // localDeltaX = +12
        gizmo._onPointerMove({ clientX: 420, clientY: 300, preventDefault: () => {}, stopPropagation: () => {} });

        expect(mockRoofEntity.config.overhang).toBe(20);

        // 4. Simulate corner stretch drag
        const stretchDiamond = gizmo.stretchHandles[1]; // NE Corner
        gizmo.activeHandle = stretchDiamond;
        gizmo.initialMinX = 0; gizmo.initialMaxX = 200;
        gizmo.initialMinY = 0; gizmo.initialMaxY = 150;
        gizmo.dragStartPos.set(200, 124, 0);
        gizmo.planeIntersect.set(230, 124, -20); // deltaX = +30, deltaZ = -20
        gizmo._onPointerMove({ clientX: 430, clientY: 280, preventDefault: () => {}, stopPropagation: () => {} });

        expect(mockRoofEntity.points[1].x).toBe(230);
        expect(mockRoofEntity.points[1].y).toBe(-20);

        gizmo.dispose();
    });

    it('7c. should interactively adjust corner points in RoofCornerGizmo and overhangs in RoofOverhangGizmo', async () => {
        const { RoofCornerGizmo } = await import('../RoofCornerGizmo.js');
        const { RoofOverhangGizmo } = await import('../RoofOverhangGizmo.js');

        const mockEnvBuilder = { updateRoofLive: vi.fn() };
        const mockCtx = {
            renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: null, style: {}, addEventListener: vi.fn(), removeEventListener: vi.fn() } },
            camera: new THREE.PerspectiveCamera(45, 1, 1, 1000),
            scene: new THREE.Group(),
            controls: { enabled: true },
            envBuilder: mockEnvBuilder,
            requestRender: vi.fn(),
            currentTransformMode: 'roof_corners'
        };

        const cornerGizmo = new RoofCornerGizmo(mockCtx);
        const mockRoofEntity = {
            type: 'roof',
            id: 'roof_corners_test',
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
            config: { roofType: 'gable', pitch: 30, overhang: 8 },
            elevation: 120,
            updateGeometry: vi.fn()
        };

        const mockTargetMesh = new THREE.Mesh();
        mockTargetMesh.userData = { isRoof: true, entity: mockRoofEntity };
        cornerGizmo.attach(mockTargetMesh);

        cornerGizmo.isDragging = true;
        cornerGizmo.activeDragIndex = 1;
        cornerGizmo.selectedIndices.add(1);
        cornerGizmo.initialPoints = mockRoofEntity.points.map(p => ({ x: p.x, y: p.y }));
        cornerGizmo.dragStartPos.set(200, 0, 0);

        // Raycast mock intersection
        cornerGizmo.raycaster.ray.intersectPlane = (plane, target) => {
            target.set(225, 0, -15);
            return target;
        };

        cornerGizmo._onPointerMove({ clientX: 425, clientY: 285, preventDefault: () => {}, stopPropagation: () => {} });

        expect(mockRoofEntity.points[1].x).toBe(225);
        expect(mockRoofEntity.points[1].y).toBe(-15);
        expect(mockEnvBuilder.updateRoofLive).toHaveBeenCalledWith(mockRoofEntity);
        expect(mockCtx.requestRender).toHaveBeenCalled();

        cornerGizmo.dispose();

        // Now test RoofOverhangGizmo
        mockCtx.currentTransformMode = 'roof_overhang';
        const overhangGizmo = new RoofOverhangGizmo(mockCtx);
        overhangGizmo.attach(mockTargetMesh);

        overhangGizmo.isDragging = true;
        overhangGizmo.activeDragIndex = 0;
        overhangGizmo.initialOverhangs = [8, 8, 8, 8];
        overhangGizmo.dragStartPos.set(100, 0, -8);
        overhangGizmo.raycaster.ray.intersectPlane = (plane, target) => {
            target.set(100, 0, -28);
            return target;
        };

        overhangGizmo._onPointerMove({ clientX: 400, clientY: 200, preventDefault: () => {}, stopPropagation: () => {}, shiftKey: true });
        expect(mockRoofEntity.config.overhang).toBeGreaterThan(8);
        expect(mockEnvBuilder.updateRoofLive).toHaveBeenCalled();

        overhangGizmo.dispose();
    });

    it('8. should build 3D geometry for Round, Octagonal, and Hexagonal Turret roofs', async () => {
        const { Roof3DBuilder } = await import('../builders/Roof3DBuilder.js');
        const sceneGroup = new THREE.Group();
        const mockCtx = {
            helpers: {
                getDynamicMaterial: (key, type) => new THREE.MeshStandardMaterial({ color: 0x888888 })
            },
            assets: {
                getTexture: vi.fn().mockResolvedValue(new THREE.Texture())
            },
            structureGroup: sceneGroup
        };

        const builder = new Roof3DBuilder(mockCtx);
        const points = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }];

        // 1. Round Turret
        const roundTurret = {
            points,
            config: { roofType: 'turret_round', pitch: 40, curve: -15, material: 'blue_ceramic_tiles_roof', overhang: 8 },
            elevation: 120
        };
        builder.buildRoofs([roundTurret], 0, false, sceneGroup);
        expect(sceneGroup.children.length).toBe(1);
        expect(roundTurret.mesh3D).toBeDefined();

        // 2. Octagonal Turret
        const octTurret = {
            points,
            config: { roofType: 'turret_octagonal', pitch: 45, material: 'grey_slate_roof', overhang: 8 },
            elevation: 120
        };
        builder.buildRoofs([octTurret], 0, false, sceneGroup);
        expect(sceneGroup.children.length).toBe(2);
        expect(octTurret.mesh3D).toBeDefined();

        // 3. Hexagonal Turret
        const hexTurret = {
            points,
            config: { roofType: 'turret_hexagonal', pitch: 40, material: 'terracotta_green_roof', overhang: 8 },
            elevation: 120
        };
        builder.buildRoofs([hexTurret], 0, false, sceneGroup);
        expect(sceneGroup.children.length).toBe(3);
        expect(hexTurret.mesh3D).toBeDefined();
    });

    it('9. should build 3D geometry for Gambrel, Mansard, Dutch Gable, and Jerkinhead roofs', async () => {
        const { Roof3DBuilder } = await import('../builders/Roof3DBuilder.js');
        const sceneGroup = new THREE.Group();
        const mockCtx = {
            helpers: {
                getDynamicMaterial: (key, type) => new THREE.MeshStandardMaterial({ color: 0x888888 })
            },
            assets: {
                getTexture: vi.fn().mockResolvedValue(new THREE.Texture())
            },
            structureGroup: sceneGroup
        };

        const builder = new Roof3DBuilder(mockCtx);
        const points = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }];

        // 1. Gambrel (Barn) Roof
        const gambrelRoof = {
            points,
            config: { roofType: 'gambrel', pitch: 45, material: 'dark_asphalt_roof', gableMaterial: 'white_plaster_wall' },
            elevation: 120
        };
        builder.buildRoofs([gambrelRoof], 0, false, sceneGroup);
        expect(sceneGroup.children.length).toBe(1);
        expect(gambrelRoof.mesh3D).toBeDefined();

        // 2. Mansard (French) Roof
        const mansardRoof = {
            points,
            config: { roofType: 'mansard', pitch: 60, material: 'grey_slate_roof' },
            elevation: 120
        };
        builder.buildRoofs([mansardRoof], 0, false, sceneGroup);
        expect(sceneGroup.children.length).toBe(2);
        expect(mansardRoof.mesh3D).toBeDefined();

        // 3. Dutch Gable Roof
        const dutchGableRoof = {
            points,
            config: { roofType: 'dutch_gable', pitch: 30, material: 'terracotta_tiles_roof', gableMaterial: 'white_plaster_wall' },
            elevation: 120
        };
        builder.buildRoofs([dutchGableRoof], 0, false, sceneGroup);
        expect(sceneGroup.children.length).toBe(3);
        expect(dutchGableRoof.mesh3D).toBeDefined();

        // 4. Jerkinhead (Clipped Gable) Roof
        const jerkinheadRoof = {
            points,
            config: { roofType: 'jerkinhead', pitch: 30, material: 'terracotta_red_roof', gableMaterial: 'white_plaster_wall' },
            elevation: 120
        };
        builder.buildRoofs([jerkinheadRoof], 0, false, sceneGroup);
        expect(sceneGroup.children.length).toBe(4);
        expect(jerkinheadRoof.mesh3D).toBeDefined();
    });

    it('10. should provide dedicated single-side overhang controls for flat roofs and omit pitch/curve handles', async () => {
        const { RoofPitchCurvatureGizmo } = await import('../RoofPitchCurvatureGizmo.js');
        const mockEnvBuilder = { updateRoofLive: vi.fn() };
        const mockCtx = {
            renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: null, style: {} } },
            camera: new THREE.PerspectiveCamera(45, 1, 1, 1000),
            scene: new THREE.Group(),
            controls: { enabled: true },
            envBuilder: mockEnvBuilder,
            requestRender: vi.fn()
        };

        const gizmo = new RoofPitchCurvatureGizmo(mockCtx);
        const flatRoofEntity = {
            type: 'roof',
            id: 'roof_flat_dedicated_test',
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
            config: { roofType: 'flat', overhang: 8, thickness: 15 },
            elevation: 120,
            updateGeometry: vi.fn()
        };

        const mockTargetMesh = new THREE.Mesh();
        mockTargetMesh.userData = { isRoof: true, entity: flatRoofEntity };

        // 1. Attach to flat roof
        gizmo.attach(mockTargetMesh);
        expect(gizmo.visible).toBe(true);

        // Center apex pitch cone and slope curvature orb MUST NOT exist on flat roof
        expect(gizmo.peakHandle).toBeNull();
        expect(gizmo.curveHandle).toBeNull();

        const types = gizmo.handles.children.map(h => h.userData.type);
        expect(types).not.toContain('pitch');
        expect(types).not.toContain('curve');
        expect(types).toContain('overhang');
        expect(types).toContain('stretch');
        expect(gizmo.overhangHandles.length).toBe(4);

        // 2. Simulate dragging a single edge overhang (Side 2 / East, edgeIndex: 1) without Shift
        gizmo.isDragging = true;
        const side2Handle = gizmo.overhangHandles[1];
        gizmo.activeHandle = side2Handle;
        gizmo.initialOverhangs = [8, 8, 8, 8];
        gizmo.initialOverhang = 8;
        gizmo.dragStartPos.set(208, 137, 75);
        gizmo.planeIntersect.set(224, 137, 75); // deltaX = +16

        gizmo.raycaster.ray.intersectPlane = (plane, target) => {
            target.copy(gizmo.planeIntersect);
            return target;
        };

        gizmo._onPointerMove({ clientX: 420, clientY: 300, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });

        // Verify ONLY Side 2 (index 1) overhang increased, other sides remain 8!
        expect(flatRoofEntity.config.overhangs).toBeDefined();
        expect(flatRoofEntity.config.overhangs[1]).toBe(24);
        expect(flatRoofEntity.config.overhangs[0]).toBe(8);
        expect(flatRoofEntity.config.overhangs[2]).toBe(8);
        expect(flatRoofEntity.config.overhangs[3]).toBe(8);

        // 3. Simulate dragging with Shift key (all sides scale together)
        gizmo.initialOverhangs = [...flatRoofEntity.config.overhangs];
        gizmo.planeIntersect.set(220, 137, 75); // deltaX = +12
        gizmo._onPointerMove({ clientX: 420, clientY: 300, shiftKey: true, preventDefault: () => {}, stopPropagation: () => {} });

        expect(flatRoofEntity.config.overhang).toBe(36);
        expect(flatRoofEntity.config.overhangs[0]).toBe(36);
        expect(flatRoofEntity.config.overhangs[1]).toBe(36);
        expect(flatRoofEntity.config.overhangs[2]).toBe(36);
        expect(flatRoofEntity.config.overhangs[3]).toBe(36);

        gizmo.dispose();
    });

    it('11. FlatRoofGizmo: should provide dedicated per-edge push/pull, slab thickness, and mode-separated controls', async () => {
        const { FlatRoofGizmo } = await import('../FlatRoofGizmo.js');
        const mockEnvBuilder = { updateRoofLive: vi.fn() };
        const mockCtx = {
            renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: null, style: {} } },
            camera: new THREE.PerspectiveCamera(45, 1, 1, 1000),
            scene: new THREE.Group(),
            controls: { enabled: true },
            envBuilder: mockEnvBuilder,
            requestRender: vi.fn()
        };

        const flatRoofEntity = {
            type: 'roof',
            id: 'roof_flat_dedicated_gizmo_test',
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
            config: { roofType: 'flat', overhang: 8, thickness: 15 },
            elevation: 120,
            updateGeometry: vi.fn()
        };

        const mockTargetMesh = new THREE.Mesh();
        mockTargetMesh.userData = { isRoof: true, entity: flatRoofEntity };

        const gizmo = new FlatRoofGizmo(mockCtx);

        // 1. Attach in default 'corners' mode
        gizmo.attach(mockTargetMesh, 'corners');
        expect(gizmo.visible).toBe(true);

        // Assert handles: 4 edge push/pull handles, 4 corner handles, 1 thickness handle
        expect(gizmo.edgeHandles.length).toBe(4);
        expect(gizmo.cornerHandles.length).toBe(4);
        expect(gizmo.thicknessHandle).not.toBeNull();
        expect(gizmo.moveHandle).toBeNull();
        expect(gizmo.spinHandle).toBeNull();

        const types = gizmo.handles.children.map(h => h.userData.type);
        expect(types).not.toContain('pitch');
        expect(types).not.toContain('curve');
        expect(types).toContain('edge');
        expect(types).toContain('corner');
        expect(types).toContain('thickness');

        // 2. Drag a single edge handle (Side 1 / North, edgeIndex: 0) without Shift
        gizmo.isDragging = true;
        const side0Handle = gizmo.edgeHandles[0];
        gizmo.activeHandle = side0Handle;
        gizmo.initialOverhangs = [8, 8, 8, 8];
        gizmo.initialOverhang = 8;
        gizmo.dragStartPos.set(100, 137, -8);
        gizmo.planeIntersect.set(100, 137, -20); // delta = +12 outward

        gizmo.raycaster.ray.intersectPlane = (plane, target) => {
            target.copy(gizmo.planeIntersect);
            return target;
        };

        gizmo._onPointerMove({ clientX: 400, clientY: 250, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });

        // ONLY Side 1 (index 0) overhang is adjusted! All other 3 edges remain at 8
        expect(flatRoofEntity.config.overhangs[0]).toBe(20);
        expect(flatRoofEntity.config.overhangs[1]).toBe(8);
        expect(flatRoofEntity.config.overhangs[2]).toBe(8);
        expect(flatRoofEntity.config.overhangs[3]).toBe(8);

        // 3. Drag with Shift key -> updates all overhangs
        gizmo.initialOverhangs = [...flatRoofEntity.config.overhangs];
        gizmo.planeIntersect.set(100, 137, -25); // delta = +17 outward (init 20 + 17 = 37)
        gizmo._onPointerMove({ clientX: 400, clientY: 250, shiftKey: true, preventDefault: () => {}, stopPropagation: () => {} });

        expect(flatRoofEntity.config.overhang).toBe(37);
        expect(flatRoofEntity.config.overhangs[0]).toBe(37);
        expect(flatRoofEntity.config.overhangs[1]).toBe(37);
        expect(flatRoofEntity.config.overhangs[2]).toBe(37);
        expect(flatRoofEntity.config.overhangs[3]).toBe(37);

        // 4. Drag thickness handle -> updates slab thickness
        gizmo.activeHandle = gizmo.thicknessHandle;
        gizmo.initialThickness = 15;
        gizmo.dragStartPos.set(100, 145, 75);
        gizmo.planeIntersect.set(100, 155, 75); // deltaY = +10
        gizmo._onPointerMove({ clientX: 400, clientY: 200, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });

        expect(flatRoofEntity.config.thickness).toBe(25);

        // 5. Switch to 'move' mode -> only move handle is visible
        gizmo.attach(mockTargetMesh, 'move');
        expect(gizmo.moveHandle).not.toBeNull();
        expect(gizmo.edgeHandles.length).toBe(0);
        expect(gizmo.thicknessHandle).toBeNull();
        expect(gizmo.handles.children.length).toBe(1);
        expect(gizmo.handles.children[0].userData.type).toBe('move');

        // 6. Switch to 'spin' mode -> only spin handle is visible
        gizmo.attach(mockTargetMesh, 'spin');
        expect(gizmo.spinHandle).not.toBeNull();
        expect(gizmo.moveHandle).toBeNull();
        expect(gizmo.edgeHandles.length).toBe(0);
        expect(gizmo.handles.children.length).toBe(1);
        expect(gizmo.handles.children[0].userData.type).toBe('spin');

        gizmo.dispose();
    });

    it('12. InteractionSystem: should route flat roof selection directly to FlatRoofGizmo and pitch roof to RoofPitchCurvatureGizmo', async () => {
        const { createPinia, setActivePinia } = await import('pinia');
        setActivePinia(createPinia());
        const { InteractionSystem } = await import('../../../core/engine3d/InteractionSystem.js');
        const mockEnvBuilder = { updateRoofLive: vi.fn(), buildWallGroup: vi.fn() };
        const mockCtx = {
            renderer: { domElement: { addEventListener: vi.fn(), removeEventListener: vi.fn(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: null, style: {} } },
            camera: new THREE.PerspectiveCamera(45, 1, 1, 1000),
            scene: new THREE.Group(),
            controls: { enabled: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
            envBuilder: mockEnvBuilder,
            requestRender: vi.fn(),
            onEntitySelect: vi.fn(),
            currentTransformMode: 'none'
        };

        const interactions = new InteractionSystem(mockCtx);
        expect(interactions.flatRoofGizmo).toBeDefined();
        expect(interactions.roofPitchGizmo).toBeDefined();

        // 1. Select flat roof
        const flatRoof = new THREE.Mesh();
        flatRoof.userData = { isRoof: true, entity: { type: 'roof', id: 'flat_roof_1', config: { roofType: 'flat', overhang: 8, thickness: 15 } } };

        interactions.selectObject(flatRoof);
        expect(interactions.flatRoofGizmo.visible).toBe(true);
        expect(interactions.roofPitchGizmo.visible).toBe(false);

        // 2. Select pitched gable roof
        const gableRoof = new THREE.Mesh();
        gableRoof.userData = { isRoof: true, entity: { type: 'roof', id: 'gable_roof_1', config: { roofType: 'gable', pitch: 25, overhang: 8 } } };

        interactions.selectObject(gableRoof);
        expect(interactions.flatRoofGizmo.visible).toBe(false);
        expect(interactions.roofPitchGizmo.visible).toBe(true);

        // 3. Deselect
        interactions.deselect();
        expect(interactions.flatRoofGizmo.visible).toBe(false);
        expect(interactions.roofPitchGizmo.visible).toBe(false);

        interactions.dispose();
    });

    it('13. Roof3DBuilder: Flat roof generates dual materials [topMat, fasciaMat] with wall appearance for perimeter fascia', async () => {
        const { Roof3DBuilder } = await import('../builders/Roof3DBuilder.js');
        const targetGroup = new THREE.Group();
        const mockEnvBuilder = { updateRoofLive: vi.fn() };
        const mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: targetGroup,
            interactables: [],
            envBuilder: mockEnvBuilder,
            assets: { getTexture: vi.fn().mockResolvedValue(null) },
            helpers: {
                getDynamicMaterial: (matId, category) => new THREE.MeshStandardMaterial({ name: `${category}_${matId}` })
            }
        };

        const flatRoofEntity = {
            id: 'test_flat_roof_mat',
            type: 'roof',
            points: [
                { x: 0, y: 0 },
                { x: 200, y: 0 },
                { x: 200, y: 150 },
                { x: 0, y: 150 }
            ],
            config: {
                roofType: 'flat',
                thickness: 15,
                material: 'white_plaster_wall',
                fasciaMaterial: 'wall_plaster_white'
            }
        };

        const builder = new Roof3DBuilder(mockCtx);
        builder.buildRoofs([flatRoofEntity], 0, [], targetGroup);

        expect(targetGroup.children.length).toBe(1);
        const roofGroup = targetGroup.children[0];
        const flatMesh = roofGroup.children.find(c => c.userData?.isRoof);

        expect(flatMesh).toBeDefined();
        expect(flatMesh.userData.isFlatRoof).toBe(true);
        expect(Array.isArray(flatMesh.material)).toBe(true);
        expect(flatMesh.material.length).toBe(2);

        // Index 0 = Top / Bottom terrace cap
        expect(flatMesh.material[0].name).toBe('wall_white_plaster_wall');
        // Index 1 = Perimeter sides (wall band / fascia)
        expect(flatMesh.material[1].name).toBe('wall_wall_plaster_white');
    });

    it('14. BIMMaterialSystem: Accurately resolves flat roof top face vs perimeter wall fascia slot', async () => {
        const { BIMMaterialSystem } = await import('../../../core/engine3d/BIMMaterialSystem.js');

        const flatRoofEntity = {
            id: 'flat_roof_bim_test',
            type: 'roof',
            config: {
                roofType: 'flat',
                thickness: 15,
                material: 'terracotta_tiles_roof',
                fasciaMaterial: 'white_plaster_wall'
            }
        };

        const mockFlatMesh = new THREE.Mesh(
            new THREE.BoxGeometry(100, 15, 100),
            [new THREE.MeshStandardMaterial({ name: 'top' }), new THREE.MeshStandardMaterial({ name: 'fascia' })]
        );
        mockFlatMesh.userData = {
            isRoof: true,
            isFlatRoof: true,
            entity: flatRoofEntity
        };

        // 1. Raycast on top face (upward normal)
        const topNormal = new THREE.Vector3(0, 1, 0);
        const topDescriptor = BIMMaterialSystem.resolveBIMTarget(mockFlatMesh, 0, topNormal, flatRoofEntity);
        expect(topDescriptor.slotName).toBe('top');
        expect(topDescriptor.targetMatIndex).toBe(0);
        expect(topDescriptor.componentType).toBe('roof_top');

        // 2. Raycast on perimeter side edge (horizontal normal)
        const sideNormal = new THREE.Vector3(1, 0, 0);
        const sideDescriptor = BIMMaterialSystem.resolveBIMTarget(mockFlatMesh, 1, sideNormal, flatRoofEntity);
        expect(sideDescriptor.slotName).toBe('fascia');
        expect(sideDescriptor.targetMatIndex).toBe(1);
        expect(sideDescriptor.componentType).toBe('fascia');
    });

    it('15. RoofEngine & FlatRoofGizmo: Supports dual slot material application and HUD Material trigger', async () => {
        const { RoofEngine } = await import('../../../core/roof/index.js');
        const mockEnvBuilder = { updateRoofLive: vi.fn() };
        const mockPlanner = {
            envBuilder: mockEnvBuilder,
            stage: { batchDraw: vi.fn() }
        };

        const flatRoofEntity = {
            id: 'flat_roof_apply_test',
            type: 'roof',
            planner: mockPlanner,
            config: {
                roofType: 'flat',
                thickness: 15,
                material: 'concrete_flat',
                fasciaMaterial: 'white_plaster_wall'
            }
        };

        // 1. Apply wall material to perimeter fascia
        RoofEngine.setMaterial(flatRoofEntity, 'brick_red', 'fascia', 'fascia', mockPlanner);
        expect(flatRoofEntity.config.fasciaMaterial).toBe('brick_red');
        expect(mockEnvBuilder.updateRoofLive).toHaveBeenCalledWith(flatRoofEntity);

        // 2. Apply wall/terrace material to top surface
        RoofEngine.setMaterial(flatRoofEntity, 'stone_granite', 'single', null, mockPlanner);
        expect(flatRoofEntity.config.material).toBe('stone_granite');
        expect(mockEnvBuilder.updateRoofLive).toHaveBeenCalledTimes(2);

        // 3. Verify FlatRoofGizmo HUD Material button triggers setTransformMode('material')
        const { FlatRoofGizmo } = await import('../FlatRoofGizmo.js');
        const setTransformMode = vi.fn();
        const mockCtx = {
            renderer: { domElement: { addEventListener: vi.fn(), removeEventListener: vi.fn(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: null, style: {} } },
            camera: new THREE.PerspectiveCamera(45, 1, 1, 1000),
            scene: new THREE.Group(),
            controls: { enabled: true },
            interactions: { setTransformMode },
            planner: mockPlanner,
            requestRender: vi.fn()
        };

        const gizmo = new FlatRoofGizmo(mockCtx);
        const btnMat = gizmo.domHUD.querySelector('#fr-btn-mat');
        expect(btnMat).not.toBeNull();

        btnMat.click();
        expect(setTransformMode).toHaveBeenCalledWith('material');

        gizmo.dispose();
    });
});

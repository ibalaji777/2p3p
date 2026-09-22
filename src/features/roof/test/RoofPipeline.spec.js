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

        const oppHandleBeforeX = gizmo.overhangHandles[3].position.x;
        gizmo._onPointerMove({ clientX: 420, clientY: 300, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });

        // Verify ONLY Side 2 (index 1) overhang increased, other sides remain 8!
        expect(flatRoofEntity.config.overhangs).toBeDefined();
        expect(flatRoofEntity.config.overhangs[1]).toBe(24);
        expect(flatRoofEntity.config.overhangs[0]).toBe(8);
        expect(flatRoofEntity.config.overhangs[2]).toBe(8);
        expect(flatRoofEntity.config.overhangs[3]).toBe(8);

        // Verify opposite side handle (Side 4 / West, index 3) remained 100% stationary!
        expect(gizmo.overhangHandles[3].position.x).toBeCloseTo(oppHandleBeforeX, 2);

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

        const oppZBefore = gizmo.edgeHandles[2].position.z;
        const oppCorner2ZBefore = gizmo.cornerHandles[2].position.z;
        const oppCorner3ZBefore = gizmo.cornerHandles[3].position.z;

        gizmo._onPointerMove({ clientX: 400, clientY: 250, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });

        // ONLY Side 1 (index 0) overhang is adjusted! All other 3 edges remain at 8
        expect(flatRoofEntity.config.overhangs[0]).toBe(20);
        expect(flatRoofEntity.config.overhangs[1]).toBe(8);
        expect(flatRoofEntity.config.overhangs[2]).toBe(8);
        expect(flatRoofEntity.config.overhangs[3]).toBe(8);

        // Verify opposite edge handle (Side 3 / South, index 2) and opposite corners remained 100% stationary!
        expect(gizmo.edgeHandles[2].position.z).toBeCloseTo(oppZBefore, 2);
        expect(gizmo.cornerHandles[2].position.z).toBeCloseTo(oppCorner2ZBefore, 2);
        expect(gizmo.cornerHandles[3].position.z).toBeCloseTo(oppCorner3ZBefore, 2);

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

    it('12. InteractionSystem: should route flat roof selection directly to FlatRoofGizmo, gable roof to GableRoofGizmo, and other pitch roofs to RoofPitchCurvatureGizmo', async () => {
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
        expect(interactions.gableRoofGizmo).toBeDefined();
        expect(interactions.halfGableRoofGizmo).toBeDefined();
        expect(interactions.roofPitchGizmo).toBeDefined();

        // 1. Select flat roof
        const flatRoof = new THREE.Mesh();
        flatRoof.userData = { isRoof: true, entity: { type: 'roof', id: 'flat_roof_1', config: { roofType: 'flat', overhang: 8, thickness: 15 } } };

        interactions.selectObject(flatRoof);
        expect(interactions.flatRoofGizmo.visible).toBe(true);
        expect(interactions.gableRoofGizmo.visible).toBe(false);
        expect(interactions.halfGableRoofGizmo.visible).toBe(false);
        expect(interactions.roofPitchGizmo.visible).toBe(false);

        // 2. Select pitched gable roof -> routes to dedicated GableRoofGizmo
        const gableRoof = new THREE.Mesh();
        gableRoof.userData = { isRoof: true, entity: { type: 'roof', id: 'gable_roof_1', config: { roofType: 'gable', pitch: 25, overhang: 8 } } };

        interactions.selectObject(gableRoof);
        expect(interactions.flatRoofGizmo.visible).toBe(false);
        expect(interactions.gableRoofGizmo.visible).toBe(true);
        expect(interactions.halfGableRoofGizmo.visible).toBe(false);
        expect(interactions.roofPitchGizmo.visible).toBe(false);

        // 2b. Select shed / half_gable roof -> routes to dedicated HalfGableRoofGizmo
        const shedRoof = new THREE.Mesh();
        shedRoof.userData = { isRoof: true, entity: { type: 'roof', id: 'shed_roof_1', config: { roofType: 'shed', pitch: 20, overhang: 8 } } };

        interactions.selectObject(shedRoof);
        expect(interactions.flatRoofGizmo.visible).toBe(false);
        expect(interactions.gableRoofGizmo.visible).toBe(false);
        expect(interactions.halfGableRoofGizmo.visible).toBe(true);
        expect(interactions.roofPitchGizmo.visible).toBe(false);

        const halfGableRoof = new THREE.Mesh();
        halfGableRoof.userData = { isRoof: true, entity: { type: 'roof', id: 'half_gable_roof_1', config: { roofType: 'half_gable', pitch: 20, overhang: 8 } } };

        interactions.selectObject(halfGableRoof);
        expect(interactions.flatRoofGizmo.visible).toBe(false);
        expect(interactions.gableRoofGizmo.visible).toBe(false);
        expect(interactions.halfGableRoofGizmo.visible).toBe(true);
        expect(interactions.roofPitchGizmo.visible).toBe(false);

        // 3. Select other pitched roof (e.g. hip) -> routes to RoofPitchCurvatureGizmo
        const hipRoof = new THREE.Mesh();
        hipRoof.userData = { isRoof: true, entity: { type: 'roof', id: 'hip_roof_1', config: { roofType: 'hip', pitch: 30, overhang: 8 } } };

        interactions.selectObject(hipRoof);
        expect(interactions.flatRoofGizmo.visible).toBe(false);
        expect(interactions.gableRoofGizmo.visible).toBe(false);
        expect(interactions.halfGableRoofGizmo.visible).toBe(false);
        expect(interactions.roofPitchGizmo.visible).toBe(true);

        // 4. Deselect
        interactions.deselect();
        expect(interactions.flatRoofGizmo.visible).toBe(false);
        expect(interactions.gableRoofGizmo.visible).toBe(false);
        expect(interactions.halfGableRoofGizmo.visible).toBe(false);
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

    it('13b. Flat Roof: faithfully inherits host wall material when resting on painted wall, and replicates canonical plaster specs on unpainted wall', async () => {
        const targetGroup = new THREE.Group();
        const mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: targetGroup,
            interactables: [],
            assets: { getTexture: vi.fn().mockResolvedValue(null) },
            helpers: {
                getDynamicMaterial: (matId, category) => new THREE.MeshStandardMaterial({ name: `${category}_${matId}` })
            }
        };

        const hostWall = {
            id: 'wall_1',
            startX: 0, startY: 0, endX: 200, endY: 0,
            thickness: 20, height: 300,
            params: { textureFront: 'brick_red_terracotta' }
        };

        const flatRoofEntity = {
            id: 'test_flat_roof_inherit',
            type: 'roof',
            points: [
                { x: 0, y: 0 },
                { x: 200, y: 0 },
                { x: 200, y: 150 },
                { x: 0, y: 150 }
            ],
            config: {
                roofType: 'flat',
                thickness: 15
            }
        };

        const builder = new Roof3DBuilder(mockCtx);
        builder.buildRoofs([flatRoofEntity], 0, [hostWall], targetGroup);

        const roofGroup = targetGroup.children[0];
        const flatMesh = roofGroup.children.find(c => c.userData?.isRoof);

        expect(flatMesh).toBeDefined();
        // Both terrace cap and fascia inherit the host wall material
        expect(flatMesh.material[0].name).toBe('wall_brick_red_terracotta');
        expect(flatMesh.material[1].name).toBe('wall_brick_red_terracotta');
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

    it('16. GableRoofGizmo: Dedicated 3D interactive handles for Ridge Peak, Eaves, Gable Rakes, Corners, Flip Axis, and Auto-Walls', async () => {
        const { GableRoofGizmo } = await import('../GableRoofGizmo.js');
        const mockEnvBuilder = { updateRoofLive: vi.fn(), buildWallGroup: vi.fn() };
        const setTransformMode = vi.fn();
        const mockPlanner = {
            activeFloor: 0,
            walls: [],
            roofs: [],
            envBuilder: mockEnvBuilder,
            stage: { batchDraw: vi.fn() }
        };
        const mockCtx = {
            renderer: { domElement: { addEventListener: vi.fn(), removeEventListener: vi.fn(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: null, style: {} } },
            camera: new THREE.PerspectiveCamera(45, 1, 1, 1000),
            scene: new THREE.Group(),
            controls: { enabled: true },
            envBuilder: mockEnvBuilder,
            interactions: { setTransformMode },
            planner: mockPlanner,
            requestRender: vi.fn()
        };

        const gizmo = new GableRoofGizmo(mockCtx);
        expect(gizmo.visible).toBe(false);

        const gableRoofEntity = {
            type: 'roof',
            id: 'test_gable_gizmo_dedicated',
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
            config: {
                roofType: 'gable',
                pitch: 30,
                overhangs: [8, 8, 8, 8],
                ridgeAxis: 'x',
                autoShapeWalls: true
            },
            elevation: 120,
            updateGeometry: vi.fn()
        };

        const mockTargetMesh = new THREE.Mesh();
        mockTargetMesh.userData = { isRoof: true, entity: gableRoofEntity };

        // 1. Attach to gable roof in default 'corners' mode
        gizmo.attach(mockTargetMesh, 'corners');
        expect(gizmo.visible).toBe(true);

        // Peak handle (ridge arrow + ridge tube)
        expect(gizmo.peakHandle).not.toBeNull();
        expect(gizmo.peakHandle.userData.type).toBe('pitch');

        // Curve handle (Slope Curvature sphere)
        expect(gizmo.curveHandle).not.toBeNull();
        expect(gizmo.curveHandle.userData.type).toBe('curve');

        // Edge handles (Eaves vs Gable Rakes)
        expect(gizmo.edgeHandles.length).toBe(4);
        // With ridgeAxis: 'x', North & South (dx >= dy) are eaves, East & West are rakes
        expect(gizmo.edgeHandles[0].userData.role).toBe('eave'); // Edge 0: (0,0) -> (200,0)
        expect(gizmo.edgeHandles[1].userData.role).toBe('rake'); // Edge 1: (200,0) -> (200,150)
        expect(gizmo.edgeHandles[2].userData.role).toBe('eave'); // Edge 2: (200,150) -> (0,150)
        expect(gizmo.edgeHandles[3].userData.role).toBe('rake'); // Edge 3: (0,150) -> (0,0)

        // Corner handles
        expect(gizmo.cornerHandles.length).toBe(4);

        // 2. Simulate dragging an Eave edge handle independently
        gizmo.isDragging = true;
        const eaveHandle = gizmo.edgeHandles[0];
        gizmo.activeHandle = eaveHandle;
        gizmo.initialOverhangs = [8, 8, 8, 8];
        gizmo.dragStartPos.set(100, 120, 0);
        gizmo.planeIntersect.set(100, 120, -15); // Delta outward = +15

        gizmo.raycaster.ray.intersectPlane = (plane, target) => {
            target.copy(gizmo.planeIntersect);
            return target;
        };

        const oppHandle2BeforeZ = gizmo.edgeHandles[2].position.z;
        const oppCorner2BeforeZ = gizmo.cornerHandles[2].position.z;
        const oppCorner3BeforeZ = gizmo.cornerHandles[3].position.z;

        gizmo._onPointerMove({ clientX: 400, clientY: 300, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });
        expect(gableRoofEntity.config.overhangs[0]).toBe(23); // 8 + 15
        expect(gableRoofEntity.config.overhangs[1]).toBe(8);  // untouched rake
        expect(gableRoofEntity.config.overhangs[2]).toBe(8);
        expect(gableRoofEntity.config.overhangs[3]).toBe(8);

        // Verify opposite eave handle (South, index 2) and opposite corners remained 100% stationary!
        expect(gizmo.edgeHandles[2].position.z).toBeCloseTo(oppHandle2BeforeZ, 2);
        expect(gizmo.cornerHandles[2].position.z).toBeCloseTo(oppCorner2BeforeZ, 2);
        expect(gizmo.cornerHandles[3].position.z).toBeCloseTo(oppCorner3BeforeZ, 2);

        // 3. Simulate dragging Ridge Peak handle to adjust pitch
        gizmo.activeHandle = gizmo.peakHandle;
        gizmo.initialPitch = 30;
        gizmo.dragStartPos.set(100, 163.3, 75);
        gizmo.planeIntersect.set(100, 180, 75); // deltaY = +16.7
        gizmo._onPointerMove({ clientX: 400, clientY: 200, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });
        expect(gableRoofEntity.config.pitch).toBeGreaterThan(30);

        // 3b. Simulate dragging Slope Curvature handle to adjust curvature
        gizmo.activeHandle = gizmo.curveHandle;
        gizmo.initialCurve = 0;
        gizmo.dragStartPos.set(0, 140, -37.5);
        gizmo.planeIntersect.set(0, 165, -37.5); // deltaY = +25 -> curve = +10
        gizmo._onPointerMove({ clientX: 400, clientY: 200, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });
        expect(gableRoofEntity.config.curve).toBe(10);

        // 4. Test Floating HUD buttons
        // Curve buttons
        const btnCurveReset = gizmo.domHUD.querySelector('#gr-btn-curve-reset');
        expect(btnCurveReset).not.toBeNull();
        btnCurveReset.click();
        expect(gableRoofEntity.config.curve).toBe(0);

        const btnCurveSub = gizmo.domHUD.querySelector('#gr-btn-curve-sub');
        expect(btnCurveSub).not.toBeNull();
        btnCurveSub.click();
        expect(gableRoofEntity.config.curve).toBe(-5);

        const btnCurveAdd = gizmo.domHUD.querySelector('#gr-btn-curve-add');
        expect(btnCurveAdd).not.toBeNull();
        btnCurveAdd.click();
        expect(gableRoofEntity.config.curve).toBe(0);

        // Flip Ridge Axis button
        const btnFlip = gizmo.domHUD.querySelector('#gr-btn-flip-axis');
        expect(btnFlip).not.toBeNull();
        btnFlip.click();
        expect(gableRoofEntity.config.ridgeAxis).toBe('y');
        expect(mockEnvBuilder.updateRoofLive).toHaveBeenCalledWith(gableRoofEntity);

        // Auto-Gable Walls toggle button
        const btnAuto = gizmo.domHUD.querySelector('#gr-btn-auto-walls');
        expect(btnAuto).not.toBeNull();
        btnAuto.click();
        expect(gableRoofEntity.config.autoShapeWalls).toBe(false);

        // Material Mode button
        const btnMat = gizmo.domHUD.querySelector('#gr-btn-mat');
        expect(btnMat).not.toBeNull();
        btnMat.click();
        expect(setTransformMode).toHaveBeenCalledWith('material');

        // 5. Test mode switching: 'move' and 'spin'
        gizmo.attach(mockTargetMesh, 'move');
        expect(gizmo.moveHandle).not.toBeNull();
        expect(gizmo.peakHandle).toBeNull();
        expect(gizmo.curveHandle).toBeNull();
        expect(gizmo.edgeHandles.length).toBe(0);

        gizmo.attach(mockTargetMesh, 'spin');
        expect(gizmo.spinHandle).not.toBeNull();
        expect(gizmo.moveHandle).toBeNull();
        expect(gizmo.curveHandle).toBeNull();

        // Detach
        gizmo.detach();
        expect(gizmo.visible).toBe(false);
        gizmo.dispose();
    });

    it('17. Roof3DBuilder: Gable roof locks ridge line to building centerline when single-side eave overhang increases', () => {
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
        // Base points: 200 wide (X: 0 to 200), 150 deep (Y: 0 to 150)
        // Centerline Y (baseCy) = 75
        const points = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }];

        // Single side eave overhang increased on North (index 0): 30, while others remain 8
        const asymmetricGableRoof = {
            points,
            config: {
                roofType: 'gable',
                pitch: 30,
                overhangs: [30, 8, 8, 8],
                ridgeAxis: 'x',
                material: 'terracotta_tiles_roof'
            },
            elevation: 100
        };

        builder.buildRoofs([asymmetricGableRoof], 0, false, targetGroup);
        expect(targetGroup.children.length).toBe(1);

        const roofGroup = targetGroup.children[0];
        const roofMesh = roofGroup.children.find(c => c.userData?.isRoof);
        expect(roofMesh).toBeDefined();

        // The vertices of the mesh in local space are offset by (-baseCx, 0, -baseCz)
        // baseCx = 100, baseCz = 75.
        // Therefore, the ridge line (world/geometry Z = baseCy = 75) in mesh local space is Z = 75 - 75 = 0!
        const geo = roofMesh.geometry;
        const pos = geo.attributes.position;
        let foundRidgeVertexAtZero = false;
        let maxLocalY = -Infinity;

        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            const z = pos.getZ(i);
            if (y > maxLocalY) maxLocalY = y;
            if (Math.abs(z - 75) < 0.01 && Math.abs(y - 43.3) < 1.0) { // rh = tan(30) * 75 ~= 43.3
                foundRidgeVertexAtZero = true;
            }
        }

        expect(foundRidgeVertexAtZero).toBe(true);
        // Peak height should be determined by building span baseD (150) / 2 * tan(30) = 43.3
        expect(maxLocalY).toBeCloseTo(Math.tan(30 * Math.PI / 180) * 75, 1);
    });

    it('18. HalfGableRoofGizmo: Dedicated 3D interactive handles for High Ridge Peak, Curvature, Low Eave, High Eave, Side Rakes, Corners, Flip Slope/Axis, and In-place HUD', async () => {
        const { HalfGableRoofGizmo } = await import('../HalfGableRoofGizmo.js');
        const mockEnvBuilder = { updateRoofLive: vi.fn(), buildWallGroup: vi.fn() };
        const setTransformMode = vi.fn();
        const mockCtx = {
            renderer: { domElement: { addEventListener: vi.fn(), removeEventListener: vi.fn(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: null, style: {} } },
            camera: new THREE.PerspectiveCamera(45, 1, 1, 1000),
            scene: new THREE.Group(),
            controls: { enabled: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
            envBuilder: mockEnvBuilder,
            requestRender: vi.fn(),
            setTransformMode: setTransformMode,
            planner: { executeWithSnapshot: (fn) => fn(), syncAll: vi.fn(), walls: [] }
        };

        const gizmo = new HalfGableRoofGizmo(mockCtx);
        expect(gizmo.visible).toBe(false);

        const halfGableRoofEntity = {
            id: 'roof_half_gable_test',
            type: 'roof',
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
            config: {
                roofType: 'half_gable',
                pitch: 20,
                curve: 0,
                overhangs: [8, 8, 8, 8],
                ridgeAxis: 'x',
                flipSlope: false,
                autoShapeWalls: true
            },
            elevation: 120,
            updateGeometry: vi.fn()
        };

        const mockTargetMesh = new THREE.Mesh();
        mockTargetMesh.userData = { isRoof: true, entity: halfGableRoofEntity };

        // 1. Attach to half_gable roof in default 'corners' mode
        gizmo.attach(mockTargetMesh, 'corners');
        expect(gizmo.visible).toBe(true);

        // Peak handle (High Ridge beam tube + dual-cone arrow)
        expect(gizmo.peakHandle).not.toBeNull();
        expect(gizmo.peakHandle.userData.type).toBe('pitch');
        expect(gizmo.peakHandle.userData.role).toBe('peak');

        // Slope Curvature handle (Cyan / Teal sphere)
        expect(gizmo.curveHandle).not.toBeNull();
        expect(gizmo.curveHandle.userData.type).toBe('curve');
        expect(gizmo.curveHandle.userData.role).toBe('slope_curve');

        // Edge handles (Low Eave vs High Eave vs Side Rakes)
        expect(gizmo.edgeHandles.length).toBe(4);
        // With ridgeAxis: 'x', flipSlope: false:
        // Edge 0 (North, dy=0, y=0) is Low Eave (Cobalt Blue)
        // Edge 2 (South, dy=0, y=150) is High Eave (Amber Gold)
        // Edge 1 (East) & Edge 3 (West) are Side Rakes (Purple)
        expect(gizmo.edgeHandles[0].userData.role).toBe('low_eave');
        expect(gizmo.edgeHandles[1].userData.role).toBe('rake');
        expect(gizmo.edgeHandles[2].userData.role).toBe('high_eave');
        expect(gizmo.edgeHandles[3].userData.role).toBe('rake');

        // Corner handles (4 corner crystals)
        expect(gizmo.cornerHandles.length).toBe(4);
        // Heights conform to low vs high eave
        const lowCornerY = gizmo.cornerHandles[0].position.y;
        const highCornerY = gizmo.cornerHandles[2].position.y;
        expect(highCornerY).toBeGreaterThan(lowCornerY);

        // 2. Simulate dragging Low Eave handle independently
        gizmo.isDragging = true;
        const lowEaveHandle = gizmo.edgeHandles[0];
        gizmo.activeHandle = lowEaveHandle;
        gizmo.initialOverhangs = [8, 8, 8, 8];
        gizmo.dragStartPos.set(100, 120, 0);
        gizmo.planeIntersect.set(100, 120, -15); // Delta outward = +15

        gizmo.raycaster.ray.intersectPlane = (plane, target) => {
            target.copy(gizmo.planeIntersect);
            return target;
        };

        const oppHandle2BeforeZ = gizmo.edgeHandles[2].position.z;
        const oppCorner2BeforeZ = gizmo.cornerHandles[2].position.z;
        const oppCorner3BeforeZ = gizmo.cornerHandles[3].position.z;

        gizmo._onPointerMove({ clientX: 400, clientY: 300, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });
        expect(halfGableRoofEntity.config.overhangs[0]).toBe(23); // 8 + 15
        expect(halfGableRoofEntity.config.overhangs[1]).toBe(8);  // untouched
        expect(halfGableRoofEntity.config.overhangs[2]).toBe(8);  // untouched
        expect(halfGableRoofEntity.config.overhangs[3]).toBe(8);  // untouched

        // Verify opposite high eave handle (South, index 2) and opposite corners remained 100% stationary!
        expect(gizmo.edgeHandles[2].position.z).toBeCloseTo(oppHandle2BeforeZ, 2);
        expect(gizmo.cornerHandles[2].position.z).toBeCloseTo(oppCorner2BeforeZ, 2);
        expect(gizmo.cornerHandles[3].position.z).toBeCloseTo(oppCorner3BeforeZ, 2);

        // 2b. Simulate dragging corner handle 2 (SE corner)
        const cornerHandle2 = gizmo.cornerHandles[2];
        gizmo.activeHandle = cornerHandle2;
        gizmo.initialPoints = halfGableRoofEntity.points.map(p => ({ x: p.x, y: p.y }));
        gizmo.initialMinX = 0; gizmo.initialMaxX = 200;
        gizmo.initialMinY = 0; gizmo.initialMaxY = 150;
        gizmo.dragStartPos.set(200, 120, 150);
        gizmo.planeIntersect.set(230, 120, 180);
        gizmo._onPointerMove({ clientX: 500, clientY: 400, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });
        expect(halfGableRoofEntity.points[2].x).toBe(230);
        expect(halfGableRoofEntity.points[2].y).toBe(180);

        // 3. Simulate dragging Ridge Peak handle to adjust pitch
        gizmo.activeHandle = gizmo.peakHandle;
        gizmo.initialPitch = 20;
        gizmo.dragStartPos.set(100, 174.6, 150);
        gizmo.planeIntersect.set(100, 195, 150); // deltaY = +20.4
        gizmo._onPointerMove({ clientX: 400, clientY: 200, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });
        expect(halfGableRoofEntity.config.pitch).toBeGreaterThan(20);

        // 3b. Simulate dragging Slope Curvature handle to adjust curvature
        gizmo.activeHandle = gizmo.curveHandle;
        gizmo.initialCurve = 0;
        gizmo.dragStartPos.set(100, 140, 75);
        gizmo.planeIntersect.set(100, 165, 75); // deltaY = +25 -> curve = +10
        gizmo._onPointerMove({ clientX: 400, clientY: 200, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });
        expect(halfGableRoofEntity.config.curve).toBe(10);

        // 3c. Simulate dragging pitch down to 0 (flat roof)
        gizmo.activeHandle = gizmo.peakHandle;
        gizmo.initialPitch = 20;
        gizmo.initialRh = Math.tan(20 * Math.PI / 180) * 150;
        gizmo.dragStartPos.set(100, 174.6, 150);
        gizmo.planeIntersect.set(100, 0, 150); // deltaY = -174.6
        gizmo._onPointerMove({ clientX: 400, clientY: 600, shiftKey: false, preventDefault: () => {}, stopPropagation: () => {} });
        expect(halfGableRoofEntity.config.pitch).toBe(0);
        expect(gizmo.dimBadge.innerText).toContain('0° (Flat)');

        // 4. Test Floating HUD buttons
        // Pitch buttons
        const btnPitchSub = gizmo.domHUD.querySelector('#hg-btn-pitch-sub');
        expect(btnPitchSub).not.toBeNull();
        halfGableRoofEntity.config.pitch = 5;
        btnPitchSub.click();
        expect(halfGableRoofEntity.config.pitch).toBe(0);
        const lblPitch = gizmo.domHUD.querySelector('#hg-lbl-pitch');
        expect(lblPitch.innerText).toBe('0° Flat');

        // Curve buttons
        const btnCurveReset = gizmo.domHUD.querySelector('#hg-btn-curve-reset');
        expect(btnCurveReset).not.toBeNull();
        btnCurveReset.click();
        expect(halfGableRoofEntity.config.curve).toBe(0);

        const btnCurveSub = gizmo.domHUD.querySelector('#hg-btn-curve-sub');
        expect(btnCurveSub).not.toBeNull();
        btnCurveSub.click();
        expect(halfGableRoofEntity.config.curve).toBe(-5);

        const btnCurveAdd = gizmo.domHUD.querySelector('#hg-btn-curve-add');
        expect(btnCurveAdd).not.toBeNull();
        btnCurveAdd.click();
        expect(halfGableRoofEntity.config.curve).toBe(0);

        // Flip Slope button
        const btnFlipSlope = gizmo.domHUD.querySelector('#hg-btn-flip-slope');
        expect(btnFlipSlope).not.toBeNull();
        btnFlipSlope.click();
        expect(halfGableRoofEntity.config.flipSlope).toBe(true);
        // After flipSlope, Edge 0 becomes High Eave and Edge 2 becomes Low Eave!
        expect(gizmo.edgeHandles[0].userData.role).toBe('high_eave');
        expect(gizmo.edgeHandles[2].userData.role).toBe('low_eave');

        // Flip Ridge Axis button
        const btnFlipAxis = gizmo.domHUD.querySelector('#hg-btn-flip-axis');
        expect(btnFlipAxis).not.toBeNull();
        btnFlipAxis.click();
        expect(halfGableRoofEntity.config.ridgeAxis).toBe('y');
        expect(mockEnvBuilder.updateRoofLive).toHaveBeenCalledWith(halfGableRoofEntity);

        // Auto-Walls toggle button: default kept on, toggles off and on
        const btnAuto = gizmo.domHUD.querySelector('#hg-btn-auto-walls');
        expect(btnAuto).not.toBeNull();
        btnAuto.click();
        expect(halfGableRoofEntity.config.autoShapeWalls).toBe(false);
        btnAuto.click();
        expect(halfGableRoofEntity.config.autoShapeWalls).toBe(true);

        // Material Mode button
        const btnMat = gizmo.domHUD.querySelector('#hg-btn-mat');
        expect(btnMat).not.toBeNull();
        btnMat.click();
        expect(setTransformMode).toHaveBeenCalledWith('material');

        // 5. Test mode switching: 'move' and 'spin'
        gizmo.attach(mockTargetMesh, 'move');
        expect(gizmo.moveHandle).not.toBeNull();
        expect(gizmo.peakHandle).toBeNull();
        expect(gizmo.curveHandle).toBeNull();
        expect(gizmo.edgeHandles.length).toBe(0);

        gizmo.attach(mockTargetMesh, 'spin');
        expect(gizmo.spinHandle).not.toBeNull();
        expect(gizmo.moveHandle).toBeNull();
        expect(gizmo.curveHandle).toBeNull();

        // Detach
        gizmo.detach();
        expect(gizmo.visible).toBe(false);
        gizmo.dispose();
    });

    it('19. Roof3DBuilder: builds half_gable roof with mono-pitch slope, gable end walls, and curved subdivisions', () => {
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
        const points = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }];

        // 1. Build half_gable roof with default config (auto wall kept on)
        const halfGableRoof = {
            points,
            config: {
                roofType: 'half_gable',
                pitch: 25,
                curve: 15,
                overhang: 8,
                ridgeAxis: 'x',
                material: 'terracotta_tiles_roof'
            },
            elevation: 100
        };

        builder.buildRoofs([halfGableRoof], 0, false, targetGroup);
        expect(targetGroup.children.length).toBe(1);

        const roofGroup = targetGroup.children[0];
        const roofMesh = roofGroup.children.find(c => c.userData?.isRoof);
        expect(roofMesh).toBeDefined();

        // Check that geometry was created with curve subdivisions (32 subdivisions)
        const pos = roofMesh.geometry.attributes.position;
        expect(pos.count).toBeGreaterThan(100);

        // Verify gable end walls and high eave wall are generated and do not exceed roof underside
        const gableEndMeshes = roofMesh.children.filter(c => c.userData?.isGableWall || c.userData?.isGable);
        expect(gableEndMeshes.length).toBeGreaterThanOrEqual(1);
        const gableWallPos = gableEndMeshes[0].geometry.attributes.position;
        let maxWallY = -Infinity;
        for (let i = 0; i < gableWallPos.count; i++) {
            maxWallY = Math.max(maxWallY, gableWallPos.getY(i));
        }
        const span = 150;
        const rh = Math.tan(25 * Math.PI / 180) * span;
        expect(maxWallY).toBeLessThanOrEqual(rh);

        // 2. Build half_gable roof with autoShapeWalls: false -> ZERO gable end walls
        const targetGroupNoWalls = new THREE.Group();
        mockCtx.structureGroup = targetGroupNoWalls;
        const halfGableRoofNoWalls = {
            points,
            config: {
                roofType: 'half_gable',
                pitch: 25,
                overhang: 8,
                ridgeAxis: 'x',
                autoShapeWalls: false,
                material: 'terracotta_tiles_roof'
            },
            elevation: 100
        };

        builder.buildRoofs([halfGableRoofNoWalls], 0, false, targetGroupNoWalls);
        const roofGroupNoWalls = targetGroupNoWalls.children[0];
        const roofMeshNoWalls = roofGroupNoWalls.children.find(c => c.userData?.isRoof);
        const gableEndMeshesNoWalls = roofMeshNoWalls.children.filter(c => c.userData?.isGableWall || c.userData?.isGable);
        expect(gableEndMeshesNoWalls.length).toBe(0);

        // 3. Build half_gable roof with pitch 0 (flat) -> zero gable end walls even if autoShapeWalls: true
        const targetGroupFlat = new THREE.Group();
        mockCtx.structureGroup = targetGroupFlat;
        const flatHalfGable = {
            points,
            config: {
                roofType: 'half_gable',
                pitch: 0,
                overhang: 8,
                ridgeAxis: 'x',
                autoShapeWalls: true
            },
            elevation: 100
        };
        builder.buildRoofs([flatHalfGable], 0, false, targetGroupFlat);
        const flatRoofMesh = targetGroupFlat.children[0].children.find(c => c.userData?.isRoof);
        const flatGableWalls = flatRoofMesh.children.filter(c => c.userData?.isGableWall || c.userData?.isGable);
        expect(flatGableWalls.length).toBe(0);

        // 4. Build shed roof alias
        const shedGroup = new THREE.Group();
        mockCtx.structureGroup = shedGroup;
        const shedRoof = {
            points,
            config: {
                roofType: 'shed',
                pitch: 20,
                overhang: 8,
                ridgeAxis: 'y',
                material: 'terracotta_tiles_roof'
            },
            elevation: 100
        };

        builder.buildRoofs([shedRoof], 0, false, shedGroup);
        expect(shedGroup.children.length).toBe(1);
        const shedMesh = shedGroup.children[0].children.find(c => c.userData?.isRoof);
        expect(shedMesh).toBeDefined();

        // 5. CRITICAL: Build half_gable roof on top of REAL room walls in the 3D scene (walls array passed!)
        const sceneGroupWithWalls = new THREE.Group();
        mockCtx.structureGroup = sceneGroupWithWalls;
        const roomWalls = [
            { id: 'w1', startAnchor: { x: 0, y: 0 }, endAnchor: { x: 200, y: 0 }, height: 240, thickness: 15 },
            { id: 'w2', startAnchor: { x: 200, y: 0 }, endAnchor: { x: 200, y: 150 }, height: 240, thickness: 15 },
            { id: 'w3', startAnchor: { x: 200, y: 150 }, endAnchor: { x: 0, y: 150 }, height: 240, thickness: 15 },
            { id: 'w4', startAnchor: { x: 0, y: 150 }, endAnchor: { x: 0, y: 0 }, height: 240, thickness: 15 }
        ];
        const halfGableRoofOnWalls = {
            id: 'half_gable_on_walls',
            points,
            config: {
                roofType: 'half_gable',
                pitch: 20,
                overhang: 8,
                ridgeAxis: 'x',
                material: 'terracotta_tiles_roof'
            }
        };

        builder.buildRoofs([halfGableRoofOnWalls], 0, roomWalls, sceneGroupWithWalls);
        expect(sceneGroupWithWalls.children.length).toBe(1);
        const roofGroupWalls = sceneGroupWithWalls.children[0];
        const roofMeshWalls = roofGroupWalls.children.find(c => c.userData?.isRoof);
        expect(roofMeshWalls).toBeDefined();

        // Verify that auto walls ARE generated and shown on top of the room walls in the 3D scene!
        const autoGablesOnWalls = roofMeshWalls.children.filter(c => c.userData?.isGableWall || c.userData?.isGable);
        expect(autoGablesOnWalls.length).toBeGreaterThanOrEqual(1);
    });

    it('17. Gable Roof Rotation & Overhang: should never trigger erroneous wall cutouts or erase the roof during rotation, dragging, or overhang adjustments', () => {
        const sceneGroup = new THREE.Group();
        const mockCtx = {
            structureGroup: sceneGroup,
            interactables: [],
            helpers: {
                getDynamicMaterial: vi.fn().mockReturnValue(new THREE.MeshStandardMaterial({ color: 0x888888 }))
            },
            assets: {
                getTexture: vi.fn().mockResolvedValue(new THREE.Texture())
            }
        };
        const builder = new Roof3DBuilder(mockCtx);
        const pts = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }];
        const walls = [
            { id: 'w1', startAnchor: { x: 0, y: 0 }, endAnchor: { x: 300, y: 0 }, height: 120 },
            { id: 'w2', startAnchor: { x: 300, y: 0 }, endAnchor: { x: 300, y: 200 }, height: 120 },
            { id: 'w3', startAnchor: { x: 300, y: 200 }, endAnchor: { x: 0, y: 200 }, height: 120 },
            { id: 'w4', startAnchor: { x: 0, y: 200 }, endAnchor: { x: 0, y: 0 }, height: 120 },
            // Auto-gable walls generated under the roof
            { id: 'gw1', startAnchor: { x: 0, y: 0 }, endAnchor: { x: 0, y: 200 }, elevation: 120, height: 0, isAutoGable: true, parentRoofId: 'gable_1' },
            { id: 'gw2', startAnchor: { x: 300, y: 0 }, endAnchor: { x: 300, y: 200 }, elevation: 120, height: 0, isAutoGable: true, parentRoofId: 'gable_1' }
        ];

        const gableRoof = {
            id: 'gable_1',
            points: pts,
            elevation: 120,
            rotation: 45, // Rotated roof
            _isDragging: true, // While dragging
            config: {
                roofType: 'gable',
                pitch: 30,
                overhang: 8,
                ridgeAxis: 'x',
                autoShapeWalls: true,
                showGableWalls: true
            }
        };

        builder.buildRoofs([gableRoof], 0, walls, sceneGroup);
        expect(sceneGroup.children.length).toBe(1);
        const roofGroup = sceneGroup.children[0];
        const roofMesh = roofGroup.children.find(c => c.userData?.isRoof);
        expect(roofMesh).toBeDefined();

        // The roof positions count must NOT be hollowed out or 0
        const posAttr = roofMesh.geometry.getAttribute('position');
        expect(posAttr.count).toBeGreaterThan(100);

        // 3D gable wall triangles are rendered and present
        const gableEndMeshes = roofMesh.children.filter(c => c.userData?.isGable);
        expect(gableEndMeshes.length).toBeGreaterThanOrEqual(1);
    });

    it('23. Option A: should allow piecewise multi-roof placement with magnetic snapping between roofs', async () => {
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const mockCtx = {
            renderer: { domElement: { addEventListener: vi.fn(), removeEventListener: vi.fn(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: null, style: {} } },
            camera: new THREE.PerspectiveCamera(45, 1, 1, 1000),
            scene: new THREE.Scene(),
            structureGroup: new THREE.Group(),
            controls: { enabled: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
            planner: mockPlanner,
            requestRender: vi.fn()
        };

        mockPlanner.tool = 'roof';
        mockPlanner.activePresetParams = { roofType: 'flat' };
        const placement = new Roof3DPlacementSystem(mockCtx, null);

        // Place Roof 1 (300 x 200 cm)
        placement.drawing = true;
        placement.startPoint = { x: 0, z: 0, y: 120 };
        placement.currentPoint = { x: 300, z: 200, y: 120 };
        placement.onPointerUp({ button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() });

        expect(mockPlanner.roofs.length).toBe(1);
        const r1 = mockPlanner.roofs[0];
        expect(r1.points[1].x).toBe(300);
        expect(r1.points[2].y).toBe(200);

        // Place Roof 2: snap starting point near Roof 1's corner (300, 200)
        mockPlanner.tool = 'roof';
        const nearR1Corner = new THREE.Vector3(308, 0, 205);
        const snap = placement._findMagneticSnap(nearR1Corner, 120, null, mockPlanner);
        expect(snap.snapType).toBe('roof_corner');
        expect(snap.x).toBe(300);
        expect(snap.z).toBe(200);

        // Draw Roof 2 extending from (300, 200) to (500, 350)
        placement.drawing = true;
        placement.startPoint = { x: snap.x, z: snap.z, y: 120 };
        placement.currentPoint = { x: 500, z: 350, y: 120 };
        placement.onPointerUp({ button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() });

        // Both roofs exist independently in piecewise assembly
        expect(mockPlanner.roofs.length).toBe(2);
        const r2 = mockPlanner.roofs[1];
        expect(r2.points[0].x).toBe(300);
        expect(r2.points[0].y).toBe(200);
        expect(r2.points[1].x).toBe(500);
        expect(r2.points[2].y).toBe(350);

        placement.dispose();
    });

    it('24. Option A: should route curved_portal roof selection in InteractionSystem directly to CurvedPortalRoofGizmo', async () => {
        const { createPinia, setActivePinia } = await import('pinia');
        setActivePinia(createPinia());
        const { InteractionSystem } = await import('../../../core/engine3d/InteractionSystem.js');
        const mockCtx = {
            renderer: { domElement: { addEventListener: vi.fn(), removeEventListener: vi.fn(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: null, style: {} } },
            camera: new THREE.PerspectiveCamera(45, 1, 1, 1000),
            scene: new THREE.Scene(),
            controls: { enabled: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
            envBuilder: { updateRoofLive: vi.fn(), buildWallGroup: vi.fn() },
            requestRender: vi.fn(),
            onEntitySelect: vi.fn(),
            currentTransformMode: 'none',
            planner: mockPlanner
        };

        const interactionSystem = new InteractionSystem(mockCtx);
        const portalMesh = new THREE.Mesh(new THREE.BufferGeometry());
        portalMesh.userData = {
            isRoof: true,
            entity: {
                id: 'curved_portal_route_test',
                type: 'roof',
                config: { roofType: 'curved_portal', radius: 10 }
            }
        };

        interactionSystem.select(portalMesh);

        expect(interactionSystem.curvedPortalRoofGizmo.visible).toBe(true);
        expect(interactionSystem.curvedPortalRoofGizmo.target).toBe(portalMesh);
        expect(interactionSystem.roofPitchGizmo.visible).toBe(false);
        expect(interactionSystem.flatRoofGizmo.visible).toBe(false);

        interactionSystem.deselect();
        expect(interactionSystem.curvedPortalRoofGizmo.visible).toBe(false);
        expect(interactionSystem.curvedPortalRoofGizmo.target).toBeNull();
        interactionSystem.dispose();
    });

    const createPlacementMockCtx = () => ({
        renderer: { domElement: { addEventListener: vi.fn(), removeEventListener: vi.fn(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), parentElement: null, style: {} } },
        camera: new THREE.PerspectiveCamera(45, 1, 1, 1000),
        scene: new THREE.Scene(),
        structureGroup: new THREE.Group(),
        controls: { enabled: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
        planner: mockPlanner,
        helpers: {
            getDynamicMaterial: vi.fn((key, type) => new THREE.MeshStandardMaterial({ color: 0xcccccc }))
        },
        assets: {
            getTexture: vi.fn(() => Promise.resolve(null))
        },
        requestRender: vi.fn()
    });

    it('25. Option B: should toggle draw mode between box and polygon', async () => {
        mockPlanner.tool = 'roof';
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const placement = new Roof3DPlacementSystem(createPlacementMockCtx(), null);

        expect(placement.drawMode).toBe('box');

        placement.setDrawMode('polygon');
        expect(placement.drawMode).toBe('polygon');

        // Test keyboard toggle 'p'
        placement._onKeyDown({ key: 'p' });
        expect(placement.drawMode).toBe('box');

        placement._onKeyDown({ key: 'P' });
        expect(placement.drawMode).toBe('polygon');

        placement.dispose();
    });

    it('26. Option B: should accumulate vertices and update visual indicators in polygon mode', async () => {
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const placement = new Roof3DPlacementSystem(createPlacementMockCtx(), null);
        placement.setDrawMode('polygon');

        mockPlanner.tool = 'roof';

        // Point 1
        placement.polygonPoints.push({ x: 100, y: 120, z: 100, hitEntity: null, snapType: 'ground' });
        placement.polygonElevation = 120;
        placement._updatePolygonVisuals();

        expect(placement.polygonPoints.length).toBe(1);
        expect(placement.polygonMarkersGroup.children.length).toBe(1);

        // Point 2
        placement.polygonPoints.push({ x: 300, y: 120, z: 100, hitEntity: null, snapType: 'ground' });
        placement._updatePolygonVisuals();
        expect(placement.polygonPoints.length).toBe(2);
        expect(placement.polygonMarkersGroup.children.length).toBe(2);

        // Point 3
        placement.polygonPoints.push({ x: 300, y: 120, z: 250, hitEntity: null, snapType: 'ground' });
        placement._updatePolygonVisuals();
        expect(placement.polygonPoints.length).toBe(3);

        // Point 4
        placement.polygonPoints.push({ x: 100, y: 120, z: 250, hitEntity: null, snapType: 'ground' });
        placement._updatePolygonVisuals();
        expect(placement.polygonPoints.length).toBe(4);
        expect(placement.polygonMarkersGroup.children.length).toBe(4);
        expect(placement.polygonLineGroup.visible).toBe(true);

        placement.dispose();
    });

    it('27. Option B: should accurately snap angles to orthogonal 0, 45, 90, 180 degrees', async () => {
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const placement = new Roof3DPlacementSystem(createPlacementMockCtx(), null);

        const fromPt = { x: 0, z: 0 };

        // Test near 0 deg (horizontal right)
        const snap0 = placement._snapAngle(fromPt, { x: 100, z: 3 });
        expect(snap0.snappedAngle).toBe(0);
        expect(snap0.z).toBe(0);

        // Test near 90 deg (vertical down)
        const snap90 = placement._snapAngle(fromPt, { x: 3, z: 100 });
        expect(snap90.snappedAngle).toBe(90);
        expect(snap90.x).toBe(0);

        // Test near 45 deg (diagonal)
        const snap45 = placement._snapAngle(fromPt, { x: 100, z: 97 });
        expect(snap45.snappedAngle).toBe(45);

        // Test non-orthogonal angle (e.g. 25 deg - beyond 5 deg threshold)
        const noSnap = placement._snapAngle(fromPt, { x: 100, z: 46 });
        expect(noSnap.snappedAngle).toBeNull();

        placement.dispose();
    });

    it('28. Option B: should detect magnetic closing snap when hovering near start vertex V1', async () => {
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const placement = new Roof3DPlacementSystem(createPlacementMockCtx(), null);
        placement.setDrawMode('polygon');

        // Populate 3 existing points
        placement.polygonPoints = [
            { x: 100, y: 120, z: 100, hitEntity: null },
            { x: 300, y: 120, z: 100, hitEntity: null },
            { x: 300, y: 120, z: 300, hitEntity: null }
        ];

        // Raycast hit near start point (100, 100) within 25 cm (e.g. at 108, 106)
        const nearV1 = new THREE.Vector3(108, 0, 106);
        const snap = placement._findMagneticSnap(nearV1, 120, null, mockPlanner);

        expect(snap.isClosing).toBe(true);
        expect(snap.snapType).toBe('polygon_close');
        expect(snap.x).toBe(100);
        expect(snap.z).toBe(100);
        expect(snap.color).toBe(0x10b981); // Neon emerald green

        placement.dispose();
    });

    it('29. Option B: should complete polygon via Enter key and commit arbitrary N-sided roof', async () => {
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const placement = new Roof3DPlacementSystem(createPlacementMockCtx(), null);
        placement.setDrawMode('polygon');

        mockPlanner.roofs = [];
        mockPlanner.tool = 'roof';

        // L-shaped roof footprint (6 vertices)
        placement.polygonPoints = [
            { x: 0, y: 120, z: 0, hitEntity: null },
            { x: 300, y: 120, z: 0, hitEntity: null },
            { x: 300, y: 120, z: 150, hitEntity: null },
            { x: 150, y: 120, z: 150, hitEntity: null },
            { x: 150, y: 120, z: 300, hitEntity: null },
            { x: 0, y: 120, z: 300, hitEntity: null }
        ];
        placement.polygonElevation = 120;

        // Press Enter to finish
        placement._onKeyDown({ key: 'Enter', preventDefault: vi.fn() });

        // Roof committed to planner
        expect(mockPlanner.roofs.length).toBe(1);
        const roof = mockPlanner.roofs[0];
        expect(roof.points.length).toBe(6);
        expect(roof.points[0].x).toBe(0);
        expect(roof.points[1].x).toBe(300);
        expect(roof.points[4].y).toBe(300);

        // Placement state reset cleanly
        expect(placement.polygonPoints.length).toBe(0);

        placement.dispose();
    });

    it('30. Option B: should remove last vertex via Backspace key', async () => {
        mockPlanner.tool = 'roof';
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const placement = new Roof3DPlacementSystem(createPlacementMockCtx(), null);
        placement.setDrawMode('polygon');

        placement.polygonPoints = [
            { x: 100, y: 120, z: 100 },
            { x: 200, y: 120, z: 100 },
            { x: 200, y: 120, z: 200 }
        ];
        placement.polygonElevation = 120;
        placement._updatePolygonVisuals();
        expect(placement.polygonPoints.length).toBe(3);

        // Press Backspace once
        placement._onKeyDown({ key: 'Backspace', preventDefault: vi.fn() });
        expect(placement.polygonPoints.length).toBe(2);
        expect(placement.polygonPoints[1].x).toBe(200);
        expect(placement.polygonPoints[1].z).toBe(100);

        // Press Backspace twice more
        placement._onKeyDown({ key: 'Backspace', preventDefault: vi.fn() });
        expect(placement.polygonPoints.length).toBe(1);

        placement._onKeyDown({ key: 'Backspace', preventDefault: vi.fn() });
        expect(placement.polygonPoints.length).toBe(0);
        expect(placement.polygonElevation).toBeNull();

        placement.dispose();
    });

    it('31. Option A & B: should eliminate parallax distortion by using physical mesh surface hit point (x, z)', async () => {
        mockPlanner.tool = 'roof';
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const ctx = createPlacementMockCtx();

        // Create a wall mesh in structureGroup at x=150, z=250, elevation top = 280
        const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(100, 280, 20));
        wallMesh.position.set(150, 140, 250);
        wallMesh.userData = {
            isWall: true,
            entity: { id: 'wall_test_parallax', startAnchor: 'a1', endAnchor: 'a2', elevation: 0, height: 280 }
        };
        ctx.structureGroup.add(wallMesh);

        const placement = new Roof3DPlacementSystem(ctx, null);

        // Mock raycaster to hit this wall directly at (150, 280, 250)
        placement.raycaster = {
            setFromCamera: vi.fn(),
            ray: {
                origin: new THREE.Vector3(150, 500, 500),
                direction: new THREE.Vector3(0, -0.7071, -0.7071).normalize(),
                intersectPlane: vi.fn((plane, target) => {
                    target.set(999, 999, 999);
                    return target;
                })
            },
            intersectObjects: vi.fn(() => [{
                point: new THREE.Vector3(150, 280, 250),
                object: wallMesh
            }])
        };

        const hit = placement._getRaycastIntersection({ clientX: 400, clientY: 300 });

        expect(hit).toBeDefined();
        // Exact physical coordinates must be preserved - ZERO parallax shift
        expect(hit.x).toBe(150);
        expect(hit.z).toBe(250);
        expect(hit.y).toBe(280);

        placement.dispose();
    });

    it('32. Option A & B: should scale snap indicator dynamically with camera distance', async () => {
        mockPlanner.tool = 'roof';
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const ctx = createPlacementMockCtx();
        const placement = new Roof3DPlacementSystem(ctx, null);

        // Position camera 1200cm away
        ctx.camera.position.set(0, 1200, 0);

        placement.raycaster = {
            setFromCamera: vi.fn(),
            ray: {
                origin: new THREE.Vector3(0, 1200, 0),
                direction: new THREE.Vector3(0, -1, 0),
                intersectPlane: vi.fn((plane, target) => {
                    target.set(0, 0, 0);
                    return target;
                })
            },
            intersectObjects: vi.fn(() => [])
        };

        placement._getRaycastIntersection({ clientX: 400, clientY: 300 });

        // Indicator group should have scale > 1.0 (specifically ~3.0 for 1200cm distance)
        expect(placement.snapIndicatorGroup.scale.x).toBeGreaterThan(2.0);
        expect(placement.snapIndicatorGroup.visible).toBe(true);

        placement.dispose();
    });

    it('33. Mode HUD: should provide persistent display, isolated click events, and Done button', async () => {
        mockPlanner.tool = 'roof';
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const ctx = createPlacementMockCtx();
        const placement = new Roof3DPlacementSystem(ctx, null);

        placement._createModeHUD();
        expect(placement.modeHUD).toBeDefined();

        const btnDone = placement.modeHUD.querySelector('#roof-btn-mode-done');
        expect(btnDone).toBeDefined();

        // Clicking Done should switch tool to 'select' and hide HUD
        const stopProp = vi.fn();
        btnDone.onclick({ stopPropagation: stopProp });
        expect(stopProp).toHaveBeenCalled();
        expect(mockPlanner.tool).toBe('select');

        placement.dispose();
    });

    it('34. Continuous Placement: should keep roof tool active after placing a roof', async () => {
        mockPlanner.tool = 'roof';
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const ctx = createPlacementMockCtx();
        const placement = new Roof3DPlacementSystem(ctx, null);

        const rectPoints = [
            { x: 0, y: 0 },
            { x: 200, y: 0 },
            { x: 200, y: 150 },
            { x: 0, y: 150 }
        ];

        placement._commitRoof(rectPoints, 120, {});

        // Tool remains active as 'roof' for continuous drawing
        expect(mockPlanner.tool).toBe('roof');

        placement.dispose();
    });

    it('35. Zero Phantom Hover: should NOT render 3D roof ghost before user clicks start point', async () => {
        mockPlanner.tool = 'roof';
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const ctx = createPlacementMockCtx();
        const placement = new Roof3DPlacementSystem(ctx, null);

        // Hover over scene without clicking
        placement.raycaster = {
            setFromCamera: vi.fn(),
            ray: {
                origin: new THREE.Vector3(100, 500, 100),
                direction: new THREE.Vector3(0, -1, 0),
                intersectPlane: vi.fn((plane, target) => {
                    target.set(100, 0, 100);
                    return target;
                })
            },
            intersectObjects: vi.fn(() => [])
        };

        placement.onPointerMove({ clientX: 200, clientY: 200 });

        // Zero 3D ghost roof should be visible on idle hover
        expect(placement.drawing).toBe(false);
        expect(placement.ghostGroup.visible).toBe(false);
        expect(placement.ghostGroup.children.length).toBe(0);

        placement.dispose();
    });

    it('36. User-Controlled Decided Area: should support Click-Move-Click without accidental auto-commit on single click', async () => {
        mockPlanner.tool = 'roof';
        mockPlanner.roofs = [];
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const ctx = createPlacementMockCtx();
        const placement = new Roof3DPlacementSystem(ctx, null);

        const mockHit1 = { x: 100, y: 120, z: 100, snapType: null, hitEntity: null };
        const mockHit2 = { x: 400, y: 120, z: 350, snapType: null, hitEntity: null };

        placement._getRaycastIntersection = vi.fn()
            .mockReturnValueOnce(mockHit1)  // onPointerDown 1 (Corner 1)
            .mockReturnValueOnce(mockHit2); // onPointerDown 2 (Corner 2)

        // 1. Click Corner 1 (down and up without drag)
        placement.onPointerDown({ button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(placement.drawing).toBe(true);
        expect(placement.startPoint.x).toBe(100);
        expect(placement.startPoint.z).toBe(100);

        placement.onPointerUp({ button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() });
        // Must NOT commit any roof yet - waiting for Corner 2!
        expect(mockPlanner.roofs.length).toBe(0);
        expect(placement.drawing).toBe(true);

        // 2. Click Corner 2 (opposite corner at 400, 350)
        placement.onPointerDown({ button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() });

        // Exactly 1 roof committed covering strictly the user's decided 300x250cm area!
        expect(mockPlanner.roofs.length).toBe(1);
        const roof = mockPlanner.roofs[0];
        expect(roof.points[0]).toEqual({ x: 100, y: 100 });
        expect(roof.points[1]).toEqual({ x: 400, y: 100 });
        expect(roof.points[2]).toEqual({ x: 400, y: 350 });
        expect(roof.points[3]).toEqual({ x: 100, y: 350 });
        expect(placement.drawing).toBe(false);

        placement.dispose();
    });

    it('37. Escape Cancellation: should cancel active box drawing without creating any roof', async () => {
        mockPlanner.tool = 'roof';
        mockPlanner.roofs = [];
        const { Roof3DPlacementSystem } = await import('../../../core/engine3d/Roof3DPlacementSystem.js');
        const ctx = createPlacementMockCtx();
        const placement = new Roof3DPlacementSystem(ctx, null);

        placement._getRaycastIntersection = vi.fn().mockReturnValue({ x: 100, y: 120, z: 100 });

        // Start drawing Corner 1
        placement.onPointerDown({ button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(placement.drawing).toBe(true);

        // User changes mind and presses Escape
        placement._onKeyDown({ key: 'Escape', preventDefault: vi.fn() });

        // Drawing cancelled cleanly with zero roofs created
        expect(placement.drawing).toBe(false);
        expect(placement.startPoint).toBeNull();
        expect(mockPlanner.roofs.length).toBe(0);

        placement.dispose();
    });
});


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

    it('1. should verify ROOF_REGISTRY contains roof and dormer components', () => {
        expect(ROOF_REGISTRY['roof']).toBeDefined();
        expect(ROOF_REGISTRY['roof'].defaultConfig.roofType).toBe('gable');
        expect(ROOF_REGISTRY['dormer']).toBeDefined();
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
});

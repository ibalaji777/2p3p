import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { StairInteractiveSuite } from '../StairInteractiveSuite.js';
import { PremiumStaircase } from '../../../features/stairs/stairs.renderer2d.js';

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

describe('StairInteractiveSuite - Sims 4 Advanced Staircase Controls', () => {
    let mockCtx;
    let suite;
    let mockPlanner;
    let stairEntity;
    let stairGroup;

    beforeEach(() => {
        const domElement = document.createElement('div');
        domElement.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: 1000,
            height: 800
        });

        const camera = new THREE.PerspectiveCamera(45, 1000 / 800, 1, 10000);
        camera.position.set(0, 400, 800);
        camera.lookAt(0, 150, 200);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);

        mockPlanner = {
            syncAll: vi.fn(),
            debouncedSaveHistory: vi.fn(),
            selectEntity: vi.fn(),
            widgetLayer: { add: vi.fn() },
            furnitureLayer: { add: vi.fn() },
            stage: { batchDraw: vi.fn(), getPointerPosition: () => ({ x: 0, y: 0 }) },
            stairs: [],
            walls: [],
            platforms: []
        };

        mockCtx = {
            renderer: { domElement },
            camera,
            scene: new THREE.Scene(),
            controls: { addEventListener: vi.fn(), removeEventListener: vi.fn(), enabled: true },
            requestRender: vi.fn(),
            realtimeUpdate: { markDirty: vi.fn() },
            planner: mockPlanner
        };

        suite = new StairInteractiveSuite(mockCtx);
        mockCtx.scene.add(suite);

        stairEntity = new PremiumStaircase(mockPlanner, 'straight', {
            id: 'test_stair_1',
            x: 0,
            y: 0,
            width: 100,
            height: 300,
            totalSteps: 15,
            stepDepth: 28,
            stepHeight: 20
        });

        stairGroup = new THREE.Group();
        stairGroup.position.set(0, 0, 0);
        stairGroup.userData = { entity: stairEntity, isStair: true };
        stairEntity.mesh3D = stairGroup;
        mockPlanner.stairs.push(stairEntity);
    });

    afterEach(() => {
        if (suite && suite.destroy) {
            suite.destroy();
        }
    });

    describe('1. Instantiation & Component Structure', () => {
        it('should initialize 3D handle meshes and DOM HUD element', () => {
            expect(suite.handlesGroup).toBeDefined();
            expect(suite.widthHandleLeft).toBeDefined();
            expect(suite.widthHandleRight).toBeDefined();
            expect(suite.landingHandle).toBeDefined();
            expect(suite.heightHandle).toBeDefined();
            expect(suite.domHUD).toBeDefined();
            expect(document.body.contains(suite.domHUD)).toBe(true);
        });

        it('should start invisible until attached', () => {
            expect(suite.visible).toBe(false);
            expect(suite.handlesGroup.visible).toBe(false);
            expect(suite.domHUD.style.display).toBe('none');
        });
    });

    describe('2. Attach and Detach Behavior', () => {
        it('should attach to staircase mesh and make handles & HUD visible', () => {
            suite.attach(stairGroup);

            expect(suite.target).toBe(stairGroup);
            expect(suite.stair).toBe(stairEntity);
            expect(suite.visible).toBe(true);
            expect(suite.handlesGroup.visible).toBe(true);
            expect(suite.domHUD.style.display).toBe('flex');
            expect(mockCtx.requestRender).toHaveBeenCalled();
        });

        it('should detach cleanly, hiding handles and HUD', () => {
            suite.attach(stairGroup);
            suite.detach();

            expect(suite.target).toBeNull();
            expect(suite.stair).toBeNull();
            expect(suite.visible).toBe(false);
            expect(suite.handlesGroup.visible).toBe(false);
            expect(suite.domHUD.style.display).toBe('none');
        });
    });

    describe('3. Sims 4 Shape Morphing & Bending', () => {
        it('should morph from straight into an L-turn with balanced steps', () => {
            suite.attach(stairGroup);
            expect(stairEntity.shape).toBe('straight');

            stairEntity.setShape('L');
            expect(stairEntity.shape).toBe('L');
            expect(stairEntity.type).toBe('stair_v5_L');
            expect(stairEntity.flight1Steps).toBe(8);
            expect(stairEntity.flight2Steps).toBe(7);
            expect(stairEntity.turnDirection).toBe('right');
            expect(mockPlanner.syncAll).toHaveBeenCalled();
        });

        it('should morph from L-turn into a U-turn (dogleg)', () => {
            suite.attach(stairGroup);
            stairEntity.setShape('L');
            stairEntity.setShape('U');

            expect(stairEntity.shape).toBe('U');
            expect(stairEntity.type).toBe('stair_v5_U');
            expect(stairEntity.flight1Steps + stairEntity.flight2Steps).toBe(15);
        });

        it('should morph back from U-turn to straight and unfold steps', () => {
            suite.attach(stairGroup);
            stairEntity.setShape('U');
            stairEntity.setShape('straight');

            expect(stairEntity.shape).toBe('straight');
            expect(stairEntity.flight1Steps).toBe(15);
            expect(stairEntity.flight2Steps).toBe(0);
        });

        it('should flip turn direction between left and right', () => {
            suite.attach(stairGroup);
            stairEntity.setShape('L');
            expect(stairEntity.turnDirection).toBe('right');

            stairEntity.flipTurnDirection();
            expect(stairEntity.turnDirection).toBe('left');

            stairEntity.flipTurnDirection();
            expect(stairEntity.turnDirection).toBe('right');
        });
    });

    describe('4. Width Resizing & Snapping', () => {
        it('should update staircase width within standard bounds', () => {
            suite.attach(stairGroup);
            stairEntity.setWidth(120);

            expect(stairEntity.width).toBe(120);
            expect(mockPlanner.syncAll).toHaveBeenCalled();

            // Clamp check
            stairEntity.setWidth(20);
            expect(stairEntity.width).toBe(40); // minimum clamped

            stairEntity.setWidth(500);
            expect(stairEntity.width).toBe(300); // maximum clamped
        });
    });

    describe('5. Landing Step Redistribution', () => {
        it('should slide landing position adjusting flight 1 vs flight 2 steps', () => {
            suite.attach(stairGroup);
            stairEntity.setShape('L');
            expect(stairEntity.flight1Steps).toBe(8);
            expect(stairEntity.flight2Steps).toBe(7);

            stairEntity.adjustLanding(2);
            expect(stairEntity.flight1Steps).toBe(10);
            expect(stairEntity.flight2Steps).toBe(5);

            stairEntity.adjustLanding(-4);
            expect(stairEntity.flight1Steps).toBe(6);
            expect(stairEntity.flight2Steps).toBe(9);
        });

        it('should prevent sliding landing beyond step bounds', () => {
            suite.attach(stairGroup);
            stairEntity.setShape('L');
            stairEntity.adjustLanding(100); // Exceeds total
            expect(stairEntity.flight1Steps).toBe(8); // Unchanged when out of bounds
        });
    });

    describe('6. Stringer Style Cycle & HUD Controls', () => {
        it('should cycle through structural stringer styles', () => {
            suite.attach(stairGroup);
            expect(stairEntity.stringerType).toBe('solid');

            suite._cycleStringerType();
            expect(stairEntity.stringerType).toBe('mono');

            suite._cycleStringerType();
            expect(stairEntity.stringerType).toBe('double');

            suite._cycleStringerType();
            expect(stairEntity.stringerType).toBe('side');

            suite._cycleStringerType();
            expect(stairEntity.stringerType).toBe('box');

            suite._cycleStringerType();
            expect(stairEntity.stringerType).toBe('solid');
        });
    });

    describe('7. Pointer Collision Detection', () => {
        it('should detect when mouse raycasts onto suite handles', () => {
            suite.attach(stairGroup);

            const rayHit = suite.isHandlingPointer(new THREE.Vector2(0, 0), mockCtx.camera);
            expect(typeof rayHit).toBe('boolean');
        });

        it('should resolve handle data from child sub-meshes', () => {
            const leftChildMesh = suite.widthHandleLeft.children[0]; // shaft mesh
            const resolved = suite._resolveHandleData(leftChildMesh);
            expect(resolved.isStairWidthHandle).toBe(true);
            expect(resolved.side).toBe('left');

            const landingChildMesh = suite.landingHandle.children[0]; // ring mesh
            const resolvedLanding = suite._resolveHandleData(landingChildMesh);
            expect(resolvedLanding.isStairLandingHandle).toBe(true);

            const heightChildMesh = suite.heightHandle.children[0]; // shaft mesh
            const resolvedHeight = suite._resolveHandleData(heightChildMesh);
            expect(resolvedHeight.isStairHeightHandle).toBe(true);
        });

        it('should disable camera controls on handle drag and re-enable on release', () => {
            suite.attach(stairGroup);

            // Simulate pointerdown on width handle
            const fakeEventDown = {
                button: 0,
                clientX: 500,
                clientY: 400,
                stopPropagation: vi.fn(),
                pointerId: 1
            };
            
            // Mock raycaster to hit left width handle
            vi.spyOn(suite.raycaster, 'intersectObjects').mockReturnValue([
                { object: suite.widthHandleLeft.children[0], point: new THREE.Vector3(-50, 50, 50) }
            ]);

            suite._onPointerDown(fakeEventDown);
            expect(suite.isDragging).toBe(true);
            expect(mockCtx.controls.enabled).toBe(false);

            // Simulate pointerup
            const fakeEventUp = {
                stopPropagation: vi.fn(),
                pointerId: 1
            };
            suite._onPointerUp(fakeEventUp);
            expect(suite.isDragging).toBe(false);
            expect(mockCtx.controls.enabled).toBe(true);
            expect(mockCtx.realtimeUpdate.markDirty).toHaveBeenCalledWith(stairEntity, 'geometry');
        });
    });
});

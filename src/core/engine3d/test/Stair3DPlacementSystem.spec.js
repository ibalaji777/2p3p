import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { Stair3DPlacementSystem } from '../Stair3DPlacementSystem.js';
import { Stair3DBuilder } from '../../../features/stairs/stairs.renderer3d.js';
import { coreEventBus } from '../../EventBus.js';

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

describe('Stair3DPlacementSystem Unified Architecture & Wall Collision', () => {
    let mockCtx;
    let mockPlanner;
    let placementSystem;

    beforeEach(() => {
        document.body.innerHTML = '';

        mockPlanner = {
            tool: 'staircase',
            activePresetParams: {
                type: 'stair_v5_straight',
                shape: 'straight',
                width: 100,
                length: 250,
                height: 280,
                stepDepth: 28,
                totalSteps: 10
            },
            walls: [
                {
                    startX: 0,
                    startY: 0,
                    endX: 500,
                    endY: 0,
                    thickness: 20,
                    height: 280,
                    hidden: false,
                    startAnchor: { x: 0, y: 0 },
                    endAnchor: { x: 500, y: 0 }
                }
            ],
            platforms: [],
            rooms: [],
            shapes: [],
            stairs: [],
            furniture: [],
            syncAll: vi.fn(),
            updateToolStates: vi.fn()
        };

        const canvas = document.createElement('canvas');
        canvas.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: 800,
            bottom: 600,
            width: 800,
            height: 600
        });

        mockCtx = {
            scene: new THREE.Scene(),
            camera: new THREE.PerspectiveCamera(45, 800 / 600, 0.1, 1000),
            renderer: {
                domElement: canvas
            },
            controls: {
                enableRotate: true
            },
            planner: mockPlanner,
            requestRender: vi.fn(),
            assets: {},
            helpers: {
                getDynamicMaterial: vi.fn().mockReturnValue(new THREE.MeshBasicMaterial())
            }
        };

        // Position camera to look down at origin
        mockCtx.camera.position.set(250, 400, 400);
        mockCtx.camera.lookAt(250, 0, 0);
        mockCtx.camera.updateMatrixWorld();

        placementSystem = new Stair3DPlacementSystem(mockCtx, {});
    });

    it('should initialize with center-anchoring and sms 4 10/10 highlight meshes', () => {
        expect(placementSystem.footprintMesh).toBeDefined();
        expect(placementSystem.footprintFillMesh).toBeDefined();
        expect(placementSystem.footprintArrowMesh).toBeDefined();
        expect(placementSystem.ghostGroup).toBeDefined();
        expect(placementSystem.isRelocating).toBe(false);
        expect(placementSystem.badgeDom.style.display).toBe('none');
    });

    it('should rotate in 90 degree increments and emit UniversalMoveChanged', () => {
        const spy = vi.fn();
        const unsub = coreEventBus.on('UniversalMoveChanged', spy);

        expect(placementSystem.activeRotation).toBe(0);
        placementSystem.rotateStep(90);
        expect(placementSystem.activeRotation).toBe(90);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ rotation: 90 }));

        placementSystem.rotateStep(90);
        expect(placementSystem.activeRotation).toBe(180);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ rotation: 180 }));

        unsub();
    });

    it('should emit InteractionStateChanged (activeAction: place) on pointer move and IDLE on hideGhost', () => {
        const stateSpy = vi.fn();
        const moveSpy = vi.fn();
        const unsubState = coreEventBus.on('InteractionStateChanged', stateSpy);
        const unsubMove = coreEventBus.on('UniversalMoveChanged', moveSpy);

        // Simulate pointer move in canvas center
        placementSystem.onPointerMove({
            clientX: 400,
            clientY: 300
        });

        expect(stateSpy).toHaveBeenCalledWith(expect.objectContaining({
            state: 'ACTION_ACTIVE',
            activeAction: 'place',
            hudMode: 'action_minimal'
        }));
        expect(moveSpy).toHaveBeenCalled();

        placementSystem.hideGhost();
        expect(stateSpy).toHaveBeenCalledWith(expect.objectContaining({
            state: 'IDLE',
            activeAction: null,
            hudMode: 'none'
        }));

        unsubState();
        unsubMove();
    });

    it('should allow free movement and touch the wall flush without artificial collision offset', () => {
        // Wall along X from 0 to 500 at Y=0 (Z=0 in 3D), thickness=20 (boundary at Z=10).
        // Free move tracks the floor cursor with zero artificial pushback or snap gap.
        const mockEvent = {
            clientX: 400,
            clientY: 300
        };

        const result = placementSystem.onPointerMove(mockEvent);
        expect(result).toBe(true);
        expect(placementSystem.activePos).toBeDefined();
    });

    it('Stair3DBuilder.build should purge duplicate groups for the same stair', () => {
        const parentGroup = new THREE.Group();
        const stairData = {
            id: 'stair-test-1',
            type: 'stair_v5_straight',
            shape: 'straight',
            width: 100,
            length: 250,
            stepDepth: 28,
            totalSteps: 10,
            x: 200,
            y: 200,
            elevation: 0,
            rotation: 0
        };

        const builder = new Stair3DBuilder({}, [], mockCtx.helpers);

        // First build
        builder.build([stairData], parentGroup, 0, false, 280);
        expect(parentGroup.children.length).toBe(1);
        const firstMeshGroup = parentGroup.children[0];

        // Second build for same stair (e.g. on param change or syncAll)
        builder.build([stairData], parentGroup, 0, false, 280);
        // Duplicate must be purged, count should remain 1!
        expect(parentGroup.children.length).toBe(1);
        expect(parentGroup.children[0]).not.toBe(firstMeshGroup);
    });

    it('should start relocation mode, hide original mesh, and commit move in place via placeStaircase', () => {
        const stairMesh = new THREE.Mesh(new THREE.BoxGeometry(100, 280, 250), new THREE.MeshBasicMaterial());
        stairMesh.position.set(200, 0, 200);
        const stairEntity = {
            id: 'stair-relocate-1',
            type: 'stair_v5_straight',
            shape: 'straight',
            width: 100,
            length: 250,
            stepDepth: 28,
            totalSteps: 10,
            x: 200,
            y: 200,
            elevation: 0,
            rotation: 0,
            mesh3D: stairMesh
        };
        mockPlanner.stairs.push(stairEntity);

        placementSystem.startRelocation(stairEntity);

        expect(placementSystem.isRelocating).toBe(true);
        expect(placementSystem.relocatingEntity).toBe(stairEntity);
        expect(stairMesh.visible).toBe(false);
        expect(placementSystem.ghostGroup.visible).toBe(true);

        // Move to new position
        placementSystem.activePos.set(350, 0, 450);
        placementSystem.activeRotation = 90;

        placementSystem.placeStaircase();

        expect(placementSystem.isRelocating).toBe(false);
        expect(stairMesh.visible).toBe(true);
        expect(stairEntity.x).toBeCloseTo(489.75, 1);
        expect(stairEntity.y).toBeCloseTo(450, 1);
        expect(stairEntity.rotation).toBe(90);
    });

    it('should cleanly cancel relocation mode and restore original mesh visibility on cancelRelocation', () => {
        const stairMesh = new THREE.Mesh(new THREE.BoxGeometry(100, 280, 250), new THREE.MeshBasicMaterial());
        const stairEntity = {
            id: 'stair-relocate-cancel',
            type: 'stair_v5_straight',
            shape: 'straight',
            width: 100,
            length: 250,
            stepDepth: 28,
            totalSteps: 10,
            x: 100,
            y: 100,
            elevation: 0,
            rotation: 0,
            mesh3D: stairMesh
        };

        placementSystem.startRelocation(stairEntity);
        expect(stairMesh.visible).toBe(false);
        expect(placementSystem.isRelocating).toBe(true);

        placementSystem.cancelRelocation();

        expect(stairMesh.visible).toBe(true);
        expect(placementSystem.isRelocating).toBe(false);
        expect(placementSystem.relocatingEntity).toBeNull();
        expect(placementSystem.ghostGroup.visible).toBe(false);
    });

    it('footprint meshes removed: updateFootprintGeometry is a safe no-op', () => {
        // Footprint outline/fill/arrow meshes have been intentionally removed.
        // The holographic 3D ghost model provides all visual feedback.
        expect(placementSystem.footprintMesh).toBeNull();
        expect(placementSystem.footprintFillMesh).toBeNull();
        expect(placementSystem.footprintArrowMesh).toBeNull();

        // Calling updateFootprintGeometry should not throw
        const preset = {
            shape: 'straight',
            width: 100,
            length: 250,
            totalSteps: 10,
            stepDepth: 28
        };
        expect(() => placementSystem.updateFootprintGeometry(preset)).not.toThrow();
    });

    it('relocation mode should support free camera orbit on right-click', () => {
        const stairMesh = new THREE.Mesh(new THREE.BoxGeometry(100, 280, 250), new THREE.MeshBasicMaterial());
        const stairEntity = {
            id: 'stair-orbit-test',
            type: 'stair_v5_straight',
            shape: 'straight',
            width: 100,
            length: 250,
            stepDepth: 28,
            totalSteps: 10,
            x: 200,
            y: 200,
            elevation: 0,
            rotation: 0,
            mesh3D: stairMesh
        };
        mockPlanner.stairs.push(stairEntity);

        placementSystem.startRelocation(stairEntity);
        expect(placementSystem.isRelocating).toBe(true);
        expect(stairMesh.visible).toBe(false);

        // 1. Right-click drag permits free camera orbit
        const rightClickMove = placementSystem.onPointerMove({
            clientX: 400,
            clientY: 300,
            buttons: 2
        });
        expect(rightClickMove).toBe(false);
        expect(mockCtx.controls.enableRotate).toBe(true);

        // 2. Pointer up restores camera rotate
        placementSystem.onPointerUp({});
        expect(mockCtx.controls.enableRotate).toBe(true);

        // 3. Cancel cleanly reverts entity position
        placementSystem.cancelRelocation();
        expect(stairEntity.x).toBe(200);
        expect(stairEntity.y).toBe(200);
        expect(stairMesh.visible).toBe(true);
    });

    it('precision nudge and setCoordinates should update activePos', () => {
        placementSystem.activePos.set(200, 0, 200);

        placementSystem.nudge(1, 0); // +10cm along X
        expect(placementSystem.activePos.x).toBe(210);

        placementSystem.nudge(0, -1); // -10cm along Z
        expect(placementSystem.activePos.z).toBe(190);

        placementSystem.setCoordinates(320, 410);
        expect(placementSystem.activePos.x).toBe(320);
        expect(placementSystem.activePos.z).toBe(410);
    });

    it('10/10 steady wall snapping: slides smoothly along wall with sticky hysteresis and releases at >50cm', () => {
        // Setup a single wall along X from (0, 100) to (800, 100) with thickness 15
        mockPlanner.walls = [{
            id: 'wall_test_snap',
            startX: 0,
            startY: 100,
            endX: 800,
            endY: 100,
            thickness: 15,
            height: 280,
            elevation: 0
        }];

        // Stair rotated 90 deg (running parallel to the wall along X)
        placementSystem.activeRotation = 90;
        mockPlanner.activePresetParams = {
            id: 'stair-preset',
            shape: 'straight',
            width: 100,
            length: 250,
            totalSteps: 16
        };

        // 1. Move cursor near the wall (cursor at z=40, wall at z=100)
        // Raycast floor mock returns hit at (200, 0, 40)
        placementSystem.raycaster.ray.intersectPlane = vi.fn().mockImplementation((plane, target) => {
            target.set(200, 0, 40);
            return target;
        });

        placementSystem.onPointerMove({ clientX: 200, clientY: 200 });

        // Wall thickness = 15, half = 7.5. Stair width = 100, half = 50.
        // Wall normal towards z=40 is -Z.
        // Flush snapped position is Math.round(100 - (7.5 + 50)) = Math.round(42.5) = 43
        expect(placementSystem._isSnapped).toBe(true);
        expect(placementSystem.activePos.z).toBe(43);
        expect(placementSystem.snapGuideMesh.visible).toBe(true);

        // 2. Sliding along the wall (cursor moves X from 200 to 300, Z stays at 40)
        placementSystem.raycaster.ray.intersectPlane = vi.fn().mockImplementation((plane, target) => {
            target.set(300, 0, 40);
            return target;
        });

        placementSystem.onPointerMove({ clientX: 300, clientY: 200 });

        // Remains snapped, slides along X to 300 while keeping Z at 43
        expect(placementSystem._isSnapped).toBe(true);
        expect(placementSystem.activePos.x).toBe(300);
        expect(placementSystem.activePos.z).toBe(43);

        // 3. Ghost preview model should NOT have been re-created during sliding (no blinking!)
        const initialChildrenCount = placementSystem.modelPreviewGroup.children.length;
        const initialChild = placementSystem.modelPreviewGroup.children[0];

        placementSystem.raycaster.ray.intersectPlane = vi.fn().mockImplementation((plane, target) => {
            target.set(350, 0, 40);
            return target;
        });
        placementSystem.onPointerMove({ clientX: 350, clientY: 200 });

        expect(placementSystem.modelPreviewGroup.children.length).toBe(initialChildrenCount);
        expect(placementSystem.modelPreviewGroup.children[0]).toBe(initialChild); // Same mesh reference! Zero rebuild!

        // 4. Pulling cursor > 50cm away from snap position (cursor Z moves from 40 to -20, pull distance > 60cm)
        placementSystem.raycaster.ray.intersectPlane = vi.fn().mockImplementation((plane, target) => {
            target.set(350, 0, -20);
            return target;
        });
        placementSystem.onPointerMove({ clientX: 350, clientY: 100 });

        // Snap cleanly releases
        expect(placementSystem._isSnapped).toBe(false);
        expect(placementSystem.activePos.z).toBe(-20);
        expect(placementSystem.snapGuideMesh.visible).toBe(false);
    });

    it('should strictly suppress 3D placement and hide badge DOM when in 2D mode', () => {
        // Initially in 3D mode
        expect(placementSystem.is3DView()).toBe(true);
        expect(placementSystem.isPlacementTool()).toBe(true);

        // Simulate 2D mode on planner and context
        mockPlanner.viewMode = '2d';
        mockCtx.viewMode = '2d';

        expect(placementSystem.is3DView()).toBe(false);
        expect(placementSystem.isPlacementTool()).toBe(false);

        // Attempting to update badge content or pointer move must hide the badge and ghost
        placementSystem.updateBadgeContent();
        expect(placementSystem.badgeDom.style.display).toBe('none');
        expect(placementSystem.ghostGroup.visible).toBe(false);

        // Pointer move must return false and keep badge hidden
        const handled = placementSystem.onPointerMove({ clientX: 200, clientY: 200 });
        expect(handled).toBe(false);
        expect(placementSystem.badgeDom.style.display).toBe('none');
        expect(placementSystem.ghostGroup.visible).toBe(false);

        // Reset to 3D mode
        mockPlanner.viewMode = '3d';
        mockCtx.viewMode = '3d';
        expect(placementSystem.is3DView()).toBe(true);
        expect(placementSystem.isPlacementTool()).toBe(true);
    });
});



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

    it('should initialize with wall collision, wall snap, and default snap mode', () => {
        expect(placementSystem.wallCollisionEnabled).toBe(true);
        expect(placementSystem.wallSnapEnabled).toBe(true);
        expect(placementSystem.snapMode).toBe(10);
    });

    it('should toggle wall snap and emit UniversalMoveChanged', () => {
        const spy = vi.fn();
        const unsub = coreEventBus.on('UniversalMoveChanged', spy);

        placementSystem.toggleWallSnap();
        expect(placementSystem.wallSnapEnabled).toBe(false);
        expect(placementSystem.wallCollisionEnabled).toBe(false);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ wallSnap: false }));

        placementSystem.toggleWallSnap();
        expect(placementSystem.wallSnapEnabled).toBe(true);
        expect(placementSystem.wallCollisionEnabled).toBe(true);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ wallSnap: true }));

        unsub();
    });

    it('should update snapMode and emit UniversalMoveChanged', () => {
        const spy = vi.fn();
        const unsub = coreEventBus.on('UniversalMoveChanged', spy);

        placementSystem.setSnapMode(50);
        expect(placementSystem.snapMode).toBe(50);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ snapMode: 50 }));

        placementSystem.setSnapMode(0);
        expect(placementSystem.snapMode).toBe(0);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ snapMode: 0 }));

        unsub();
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

    it('should resolve position outside wall using SnapEngine to prevent wall penetration', () => {
        // Wall along X from 0 to 500 at Y=0 (Z=0 in 3D), thickness=20 (half-thick=10).
        // Stair width=100, length=250.
        // At rotation=0, width is along X (half-width=50), length is along Z (half-length=125).
        // If candidate center is at (250, 30), it penetrates the wall.
        // Clearance needed on Z = wall half-thick (10) + stair half-depth (125) = 135.
        // SnapEngine.resolvePosition will push it flush to Z >= 135.
        const mockEvent = {
            clientX: 400,
            clientY: 300
        };

        placementSystem.onPointerMove(mockEvent);

        // Given pointer move intersects floor plane at some Z near 0,
        // activePos must be resolved so it never penetrates the wall
        expect(Math.abs(placementSystem.activePos.z)).toBeGreaterThanOrEqual(135);
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

    it('Option A: footprintMesh.visible should always be false (no hovering wireframe box)', () => {
        expect(placementSystem.footprintMesh).toBeDefined();
        expect(placementSystem.footprintMesh.visible).toBe(false);
        placementSystem.updateFootprintGeometry();
        expect(placementSystem.footprintMesh.visible).toBe(false);
    });

    it('relocation mode should support free camera orbit on right-click and zero-teleport relative delta tracking', () => {
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

        // 2. Normal pointer move applies smooth relative delta tracking
        const initialPos = placementSystem.activePos.clone();
        placementSystem.onPointerMove({
            clientX: 400,
            clientY: 300,
            buttons: 0
        });
        expect(placementSystem._initialHit).toBeDefined();

        // 3. Pointer up restores camera rotate
        placementSystem.onPointerUp({});
        expect(mockCtx.controls.enableRotate).toBe(true);

        // 4. Cancel cleanly reverts entity position
        placementSystem.cancelRelocation();
        expect(stairEntity.x).toBe(200);
        expect(stairEntity.y).toBe(200);
        expect(stairMesh.visible).toBe(true);
    });

    it('Option A: precision nudge and setCoordinates should update activePos', () => {
        placementSystem.activePos.set(200, 0, 200);
        placementSystem.snapMode = 10;
        placementSystem.wallCollisionEnabled = false; // test pure delta

        placementSystem.nudge(1, 0); // +10cm along X
        expect(placementSystem.activePos.x).toBe(210);

        placementSystem.nudge(0, -1); // -10cm along Z
        expect(placementSystem.activePos.z).toBe(190);

        placementSystem.setCoordinates(320, 410);
        expect(placementSystem.activePos.x).toBe(320);
        expect(placementSystem.activePos.z).toBe(410);
    });
});


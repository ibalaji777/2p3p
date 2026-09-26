import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { Furniture3DPlacementSystem } from '../Furniture3DPlacementSystem.js';

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

describe('Furniture3DPlacementSystem Unified HUD & Wall Collision', () => {
    let mockCtx;
    let mockPlanner;
    let placementSystem;

    beforeEach(() => {
        // Set up document body
        document.body.innerHTML = '';

        mockPlanner = {
            tool: 'furniture',
            activePresetParams: {
                type: 'sofa_3seater',
                width: 120,
                depth: 80,
                height: 75
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
            furniture: [],
            furnitureLayer: {
                add: vi.fn(),
                batchDraw: vi.fn()
            },
            mainLayer: {
                batchDraw: vi.fn()
            },
            stage: {
                width: () => 1000,
                height: () => 1000
            },
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
            camera: new THREE.PerspectiveCamera(),
            renderer: {
                domElement: canvas
            },
            controls: {
                enableRotate: true
            },
            planner: mockPlanner,
            requestRender: vi.fn(),
            furnitureManager: {
                load: vi.fn().mockResolvedValue({})
            }
        };

        placementSystem = new Furniture3DPlacementSystem(mockCtx, {});
    });

    it('should initialize unified HUD with coordinate inputs, snap pills, and wall snap', () => {
        expect(placementSystem.wallCollisionEnabled).toBe(true);
        expect(placementSystem.wallSnapEnabled).toBe(true);
        expect(placementSystem.snapMode).toBe(10);

        const badge = document.getElementById('sims4-furniture-placement-badge');
        expect(badge).toBeTruthy();

        // Coordinates
        const inputX = badge.querySelector('#furn-ui-coord-x');
        const inputZ = badge.querySelector('#furn-ui-coord-z');
        const elRot = badge.querySelector('#furn-ui-rot');
        expect(inputX).toBeTruthy();
        expect(inputZ).toBeTruthy();
        expect(elRot).toBeTruthy();

        // Snap Pills (0, 1, 10, 50)
        const pills = badge.querySelectorAll('.furn-snap-pill');
        expect(pills.length).toBe(4);
        const snapValues = Array.from(pills).map(p => Number(p.getAttribute('data-snap')));
        expect(snapValues).toEqual([0, 1, 10, 50]);

        // Wall Snap Button
        const wallSnapBtn = badge.querySelector('#furn-ui-btn-wallsnap');
        expect(wallSnapBtn).toBeTruthy();
        expect(badge.querySelector('#furn-ui-wallsnap-status').textContent).toBe('ON');

        // Rotate, Place, Cancel
        expect(badge.querySelector('#furn-ui-btn-rot')).toBeTruthy();
        expect(badge.querySelector('#furn-ui-btn-place')).toBeTruthy();
        expect(badge.querySelector('#furn-ui-btn-cancel')).toBeTruthy();
    });

    it('should update snapMode when a snap pill is selected', () => {
        placementSystem.setSnapMode(50);
        expect(placementSystem.snapMode).toBe(50);

        placementSystem.setSnapMode(0);
        expect(placementSystem.snapMode).toBe(0);
    });

    it('should toggle wall snap and wall collision state', () => {
        expect(placementSystem.wallSnapEnabled).toBe(true);
        expect(placementSystem.wallCollisionEnabled).toBe(true);

        placementSystem.toggleWallSnap();
        expect(placementSystem.wallSnapEnabled).toBe(false);
        expect(placementSystem.wallCollisionEnabled).toBe(false);
        expect(document.querySelector('#furn-ui-wallsnap-status').textContent).toBe('OFF');

        placementSystem.toggleWallSnap();
        expect(placementSystem.wallSnapEnabled).toBe(true);
        expect(placementSystem.wallCollisionEnabled).toBe(true);
        expect(document.querySelector('#furn-ui-wallsnap-status').textContent).toBe('ON');
    });

    it('should rotate in 90 degree steps and update HUD', () => {
        expect(placementSystem.activeRotation).toBe(0);
        placementSystem.rotateStep(90);
        expect(placementSystem.activeRotation).toBe(90);
        expect(document.querySelector('#furn-ui-rot').textContent).toBe('90°');

        placementSystem.rotateStep(90);
        expect(placementSystem.activeRotation).toBe(180);
        expect(document.querySelector('#furn-ui-rot').textContent).toBe('180°');
    });

    it('should prevent collision by pushing object flush outside wall', () => {
        // Wall is along Y=0 (Z=0 in 3D) from X=0 to X=500, thickness=20 (half-thick=10).
        // Depth = 80, half-depth = 40.
        // If candidate position is at (250, 15), clearance needed is 10 + 40 = 50.
        // It should be pushed out to Z >= 50.
        placementSystem.inputX.value = '250';
        placementSystem.inputZ.value = '15';
        placementSystem._onCoordInputChange();

        expect(placementSystem.activePos.z).toBeGreaterThanOrEqual(50);
    });

    it('should snap flush to wall face when within snapDistance via SnapEngine', () => {
        // Wall face is at Z = 50 (wall half-thick 10 + furn half-depth 40).
        // If candidate position is at (250, 58) which is within snapDistance (20),
        // it should snap flush to Z = 50.
        placementSystem.inputX.value = '250';
        placementSystem.inputZ.value = '58';
        placementSystem._onCoordInputChange();

        expect(placementSystem.activePos.z).toBe(50);
    });

    it('should place furniture via FurnitureEngine and sync planner', () => {
        placementSystem.activePos.set(250, 0, 150);
        placementSystem.activeRotation = 90;

        const result = placementSystem.placeFurniture();
        expect(result).not.toBe(false);
        expect(mockPlanner.furniture.length).toBe(1);

        const placed = mockPlanner.furniture[0];
        expect(placed.x).toBe(250);
        expect(placed.y).toBe(150);
        expect(placed.rotation).toBe(90);
        expect(placed.width).toBe(120);
        expect(placed.depth).toBe(80);
        expect(mockPlanner.syncAll).toHaveBeenCalled();
    });

    it('should start relocation mode, hide original mesh, and commit move in place via placeFurniture', () => {
        const furnMesh = new THREE.Mesh(new THREE.BoxGeometry(120, 75, 80), new THREE.MeshBasicMaterial());
        furnMesh.position.set(200, 0, 200);
        const furnEntity = {
            id: 'furn-relocate-1',
            type: 'furniture',
            configId: 'sofa_3seater',
            width: 120,
            depth: 80,
            height: 75,
            x: 200,
            y: 200,
            elevation: 0,
            rotation: 0,
            mesh3D: furnMesh
        };
        mockPlanner.furniture.push(furnEntity);

        placementSystem.startRelocation(furnEntity);

        expect(placementSystem.isRelocating).toBe(true);
        expect(placementSystem.relocatingEntity).toBe(furnEntity);
        expect(furnMesh.visible).toBe(false);
        expect(placementSystem.ghostGroup.visible).toBe(true);

        // Move to new position
        placementSystem.activePos.set(350, 0, 450);
        placementSystem.activeRotation = 90;

        placementSystem.placeFurniture();

        expect(placementSystem.isRelocating).toBe(false);
        expect(furnMesh.visible).toBe(true);
        expect(furnEntity.x).toBe(350);
        expect(furnEntity.y).toBe(450);
        expect(furnEntity.rotation).toBe(90);
    });

    it('should cleanly cancel relocation mode and restore original mesh visibility on cancelRelocation', () => {
        const furnMesh = new THREE.Mesh(new THREE.BoxGeometry(120, 75, 80), new THREE.MeshBasicMaterial());
        const furnEntity = {
            id: 'furn-relocate-cancel',
            type: 'furniture',
            configId: 'sofa_3seater',
            width: 120,
            depth: 80,
            height: 75,
            x: 100,
            y: 100,
            elevation: 0,
            rotation: 0,
            mesh3D: furnMesh
        };

        placementSystem.startRelocation(furnEntity);
        expect(furnMesh.visible).toBe(false);
        expect(placementSystem.isRelocating).toBe(true);

        placementSystem.cancelRelocation();

        expect(furnMesh.visible).toBe(true);
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
        const furnMesh = new THREE.Mesh(new THREE.BoxGeometry(120, 75, 80), new THREE.MeshBasicMaterial());
        const furnEntity = {
            id: 'furn-orbit-test',
            type: 'furniture',
            configId: 'sofa_3seater',
            width: 120,
            depth: 80,
            height: 75,
            x: 200,
            y: 200,
            elevation: 0,
            rotation: 0,
            mesh3D: furnMesh
        };
        mockPlanner.furniture.push(furnEntity);

        placementSystem.startRelocation(furnEntity);
        expect(placementSystem.isRelocating).toBe(true);
        expect(furnMesh.visible).toBe(false);

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
        expect(furnEntity.x).toBe(200);
        expect(furnEntity.y).toBe(200);
        expect(furnMesh.visible).toBe(true);
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


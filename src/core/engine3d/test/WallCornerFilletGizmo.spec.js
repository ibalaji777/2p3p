import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { WallCornerFilletGizmo } from '../WallCornerFilletGizmo.js';
import { WallEngine } from '../../wall/WallEngine.js';

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
            clip: () => {},
        });
    }
});

describe('WallCornerFilletGizmo 3D & UI Interaction Stabilization', () => {
    let mockCtx;
    let mockPlanner;
    let gizmo;

    beforeEach(() => {
        const domElement = document.createElement('div');
        domElement.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: 1000,
            height: 800
        });

        const camera = new THREE.PerspectiveCamera(45, 1000 / 800, 1, 10000);
        camera.position.set(0, 300, 500);
        camera.lookAt(100, 0, 100);

        mockPlanner = {
            walls: [],
            anchors: [],
            arcs: [],
            rooms: [],
            furniture: [],
            stairs: [],
            roofs: [],
            balconies: [],
            shapes: [],
            wallLayer: { add: () => {} },
            uiLayer: { add: () => {}, batchDraw: () => {} },
            mainLayer: { batchDraw: () => {} },
            dimensionLayer: { add: () => {} },
            stage: { batchDraw: () => {} },
            commandManager: { execute: vi.fn(cmd => cmd && cmd.execute && cmd.execute()) },
            syncAll: vi.fn(),
            findRooms: vi.fn(),
            selectEntity: vi.fn(),
            getOrCreateAnchor(x, y) {
                const a = {
                    x, y,
                    position: () => ({ x, y }),
                    connectedWalls: []
                };
                mockPlanner.anchors.push(a);
                return a;
            }
        };

        mockCtx = {
            planner: mockPlanner,
            renderer: { domElement },
            camera,
            scene: new THREE.Scene(),
            structureGroup: new THREE.Group(),
            interactables: [],
            controls: { enabled: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
            requestRender: vi.fn(),
            updateFloorsLive: vi.fn(),
            envBuilder: {
                buildWallGroup: vi.fn(wall => {
                    const group = new THREE.Group();
                    group.userData = { entity: wall };
                    wall.mesh3D = group;
                    mockCtx.structureGroup.add(group);
                    return group;
                })
            },
            allWallCornersGizmo: { isActive: false, rebuild: vi.fn() }
        };

        gizmo = new WallCornerFilletGizmo(mockCtx);
    });

    it('should initialize cleanly and create the Quick-Pill DOM component', () => {
        expect(gizmo).toBeDefined();
        expect(gizmo.domQuickPill).toBeDefined();
        expect(gizmo.domQuickPill.classList.contains('wall-corner-quick-pill')).toBe(true);
    });

    it('should attach to a 90-degree corner anchor, build handles, and show Quick-Pill', () => {
        const a1 = mockPlanner.getOrCreateAnchor(0, 100);
        const aCorner = mockPlanner.getOrCreateAnchor(100, 100);
        const a3 = mockPlanner.getOrCreateAnchor(100, 200);

        const w1 = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: aCorner, thickness: 20, height: 280 });
        const w2 = WallEngine.createWall(mockPlanner, { startAnchor: aCorner, endAnchor: a3, thickness: 20, height: 280 });

        gizmo.attach(aCorner);
        expect(gizmo.visible).toBe(true);
        expect(gizmo.targetAnchor).toBe(aCorner);
        expect(gizmo.interactiveMeshes.length).toBeGreaterThan(0);
        expect(gizmo.domQuickPill.style.display).toBe('flex');
    });

    it('should rebuild w1, w2, and arc.walls in 3D when _applyFillet is invoked', () => {
        const a1 = mockPlanner.getOrCreateAnchor(0, 100);
        const aCorner = mockPlanner.getOrCreateAnchor(100, 100);
        const a3 = mockPlanner.getOrCreateAnchor(100, 200);

        const w1 = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: aCorner, thickness: 20, height: 280 });
        const w2 = WallEngine.createWall(mockPlanner, { startAnchor: aCorner, endAnchor: a3, thickness: 20, height: 280 });

        gizmo.attach(aCorner);
        mockCtx.envBuilder.buildWallGroup.mockClear();
        mockCtx.updateFloorsLive.mockClear();

        gizmo._applyFillet(60);

        // Should invoke buildWallGroup for w1, w2, and all arc.walls
        expect(mockCtx.envBuilder.buildWallGroup).toHaveBeenCalled();
        expect(mockCtx.updateFloorsLive).toHaveBeenCalled();
        expect(mockPlanner.arcs).toHaveLength(1);
        const arc = mockPlanner.arcs[0];
        expect(arc.walls.length).toBeGreaterThan(0);

        // Quick pill must remain visible and active
        expect(gizmo.domQuickPill.style.display).toBe('flex');
    });

    it('should rebuild w1 and w2 in 3D and dispose arc wall meshes when _applySharp is invoked', () => {
        const a1 = mockPlanner.getOrCreateAnchor(0, 100);
        const aCorner = mockPlanner.getOrCreateAnchor(100, 100);
        const a3 = mockPlanner.getOrCreateAnchor(100, 200);

        const w1 = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: aCorner, thickness: 20, height: 280 });
        const w2 = WallEngine.createWall(mockPlanner, { startAnchor: aCorner, endAnchor: a3, thickness: 20, height: 280 });

        gizmo.attach(aCorner);
        gizmo._applyFillet(60);

        const arc = mockPlanner.arcs[0];
        const arcWalls = [...arc.walls];

        mockCtx.envBuilder.buildWallGroup.mockClear();
        mockCtx.updateFloorsLive.mockClear();

        // Click Sharp
        gizmo._applySharp();

        // Obsolete arc wall meshes should be removed
        arcWalls.forEach(w => {
            expect(w.mesh3D).toBeNull();
        });

        // w1 and w2 should be rebuilt in 3D
        expect(mockCtx.envBuilder.buildWallGroup).toHaveBeenCalledWith(w1);
        expect(mockCtx.envBuilder.buildWallGroup).toHaveBeenCalledWith(w2);
        expect(mockCtx.updateFloorsLive).toHaveBeenCalled();

        // Quick pill must remain open
        expect(gizmo.domQuickPill.style.display).toBe('flex');
    });

    it('should lock camera controls during drag and rebuild 3D on _endDrag', () => {
        const a1 = mockPlanner.getOrCreateAnchor(0, 100);
        const aCorner = mockPlanner.getOrCreateAnchor(100, 100);
        const a3 = mockPlanner.getOrCreateAnchor(100, 200);

        WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: aCorner, thickness: 20, height: 280 });
        WallEngine.createWall(mockPlanner, { startAnchor: aCorner, endAnchor: a3, thickness: 20, height: 280 });

        gizmo.attach(aCorner);

        // Simulate start of drag
        gizmo.isDragging = true;
        mockCtx.controls.enabled = false;
        gizmo.candidateRadius = 80;

        // End drag
        gizmo._endDrag();

        // Controls re-enabled
        expect(mockCtx.controls.enabled).toBe(true);
        expect(mockCtx.envBuilder.buildWallGroup).toHaveBeenCalled();
        expect(mockCtx.updateFloorsLive).toHaveBeenCalled();
        expect(gizmo.domQuickPill.style.display).toBe('flex');
    });
});

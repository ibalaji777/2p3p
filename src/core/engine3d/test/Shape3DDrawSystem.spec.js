import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { Shape3DDrawSystem } from '../Shape3DDrawSystem.js';

describe('Shape3DDrawSystem - Direct 3D Shape Drawing Pipeline', () => {
    let ctx, mockPlanner, drawSystem, domElement;

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
        domElement = {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
            style: {},
            parentElement: {
                appendChild: vi.fn(),
                removeChild: vi.fn()
            }
        };

        mockPlanner = {
            tool: 'shape_rect',
            shapes: [],
            baseLayer: { add: vi.fn() },
            furnitureLayer: { add: vi.fn() },
            roofLayer: { add: vi.fn() },
            selectEntity: vi.fn(),
            updateToolStates: vi.fn(),
            onToolChange: vi.fn(),
            syncAll: vi.fn(),
            activePresetParams: { height3D: 100 }
        };

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000);
        camera.position.set(0, 200, 300);
        camera.lookAt(0, 0, 0);

        ctx = {
            scene: scene,
            camera: camera,
            renderer: { domElement: domElement },
            planner: mockPlanner,
            interactables: [],
            requestRender: vi.fn(),
            envBuilder: { buildEnvironment: vi.fn() }
        };

        drawSystem = new Shape3DDrawSystem(ctx, {});
    });

    it('1. should identify all supported shape tools and aliases', () => {
        expect(drawSystem.isShapeDrawingTool('shape_rect')).toBe(true);
        expect(drawSystem.isShapeDrawingTool('shape_circle')).toBe(true);
        expect(drawSystem.isShapeDrawingTool('shape_triangle')).toBe(true);
        expect(drawSystem.isShapeDrawingTool('shape_polygon')).toBe(true);
        expect(drawSystem.isShapeDrawingTool('shape_floor_cut')).toBe(true);
        expect(drawSystem.isShapeDrawingTool('shape_box')).toBe(true);
        expect(drawSystem.isShapeDrawingTool('shape_cyl')).toBe(true);
        expect(drawSystem.isShapeDrawingTool('shape_prism')).toBe(true);

        expect(drawSystem.isShapeDrawingTool('wall')).toBe(false);
        expect(drawSystem.isShapeDrawingTool('door')).toBe(false);
        expect(drawSystem.isShapeDrawingTool('select')).toBe(false);
    });

    it('2. should handle 3D Box (shape_rect) drawing via click and drag', () => {
        mockPlanner.tool = 'shape_rect';

        // 1. Pointer Down at (x=10, z=10)
        drawSystem.getRaycastHit = vi.fn(() => ({
            point: new THREE.Vector3(10, 0, 10),
            screenX: 400,
            screenY: 300
        }));
        const downHandled = drawSystem.onPointerDown({ button: 0 });
        expect(downHandled).toBe(true);
        expect(drawSystem.drawing).toBe(true);
        expect(drawSystem.startPoint.x).toBe(10);
        expect(drawSystem.startPoint.z).toBe(10);

        // 2. Pointer Move to (x=60, z=80)
        drawSystem.getRaycastHit = vi.fn(() => ({
            point: new THREE.Vector3(60, 0, 80),
            screenX: 450,
            screenY: 350
        }));
        const moveHandled = drawSystem.onPointerMove({ clientX: 450, clientY: 350 });
        expect(moveHandled).toBe(true);
        expect(drawSystem.ghostBoxMesh.visible).toBe(true);
        expect(drawSystem.ghostBoxMesh.scale.x).toBe(50); // width = 60 - 10
        expect(drawSystem.ghostBoxMesh.scale.z).toBe(70); // depth = 80 - 10

        // 3. Pointer Up to complete shape
        const upHandled = drawSystem.onPointerUp({ button: 0 });
        expect(upHandled).toBe(true);
        expect(drawSystem.drawing).toBe(false);
        expect(mockPlanner.shapes.length).toBe(1);

        const createdShape = mockPlanner.shapes[0];
        expect(createdShape.type).toBe('shape_rect');
        expect(createdShape.params.x).toBe(35); // cx = (10 + 60)/2
        expect(createdShape.params.y).toBe(45); // cy = (10 + 80)/2
        expect(createdShape.params.width).toBe(50);
        expect(createdShape.params.height).toBe(70);
        expect(createdShape.params.height3D).toBe(100);
        expect(mockPlanner.selectEntity).toHaveBeenCalledWith(createdShape, 'shape');
    });

    it('3. should handle 3D Cylinder (shape_circle) drawing', () => {
        mockPlanner.tool = 'shape_circle';

        // 1. Pointer Down at center (x=0, z=0)
        drawSystem.getRaycastHit = vi.fn(() => ({
            point: new THREE.Vector3(0, 0, 0),
            screenX: 400,
            screenY: 300
        }));
        drawSystem.onPointerDown({ button: 0 });
        expect(drawSystem.drawing).toBe(true);

        // 2. Pointer Move to (x=30, z=40) -> Radius = hypot(30, 40) = 50
        drawSystem.getRaycastHit = vi.fn(() => ({
            point: new THREE.Vector3(30, 0, 40),
            screenX: 430,
            screenY: 340
        }));
        drawSystem.onPointerMove({ clientX: 430, clientY: 340 });
        expect(drawSystem.ghostCylMesh.visible).toBe(true);
        expect(drawSystem.ghostCylMesh.scale.x).toBe(50);

        // 3. Pointer Up
        drawSystem.onPointerUp({ button: 0 });
        expect(mockPlanner.shapes.length).toBe(1);

        const createdShape = mockPlanner.shapes[0];
        expect(createdShape.type).toBe('shape_circle');
        expect(createdShape.params.x).toBe(0);
        expect(createdShape.params.y).toBe(0);
        expect(createdShape.params.radius).toBe(50);
        expect(createdShape.params.height3D).toBe(100);
    });

    it('4. should handle 3D Triangular Prism (shape_triangle) point-by-point drawing', () => {
        mockPlanner.tool = 'shape_triangle';

        // Click 1: Point (0, 0)
        drawSystem.getRaycastHit = vi.fn(() => ({
            point: new THREE.Vector3(0, 0, 0),
            screenX: 400,
            screenY: 300
        }));
        drawSystem.onPointerDown({ button: 0 });
        expect(drawSystem.drawing).toBe(true);
        expect(drawSystem.drawingPoints.length).toBe(1);

        // Click 2: Point (100, 0)
        drawSystem.getRaycastHit = vi.fn(() => ({
            point: new THREE.Vector3(100, 0, 0),
            screenX: 500,
            screenY: 300
        }));
        drawSystem.onPointerDown({ button: 0 });
        expect(drawSystem.drawingPoints.length).toBe(2);

        // Click 3: Point (50, 80) -> Triangle finishes!
        drawSystem.getRaycastHit = vi.fn(() => ({
            point: new THREE.Vector3(50, 0, 80),
            screenX: 450,
            screenY: 380
        }));
        drawSystem.onPointerDown({ button: 0 });
        expect(drawSystem.drawing).toBe(false);
        expect(mockPlanner.shapes.length).toBe(1);

        const createdShape = mockPlanner.shapes[0];
        expect(createdShape.type).toBe('shape_polygon');
        expect(createdShape.params.points.length).toBe(3);
        expect(mockPlanner.selectEntity).toHaveBeenCalledWith(createdShape, 'shape');
    });

    it('5. should handle 3D Floor Cut (shape_floor_cut) drawing', () => {
        mockPlanner.tool = 'shape_floor_cut';

        // 1. Pointer Down at (x=20, z=20)
        drawSystem.getRaycastHit = vi.fn(() => ({
            point: new THREE.Vector3(20, 0, 20),
            screenX: 420,
            screenY: 320
        }));
        drawSystem.onPointerDown({ button: 0 });

        // 2. Pointer Move to (x=80, z=90)
        drawSystem.getRaycastHit = vi.fn(() => ({
            point: new THREE.Vector3(80, 0, 90),
            screenX: 480,
            screenY: 390
        }));
        drawSystem.onPointerMove({ clientX: 480, clientY: 390 });

        // 3. Pointer Up
        drawSystem.onPointerUp({ button: 0 });
        expect(mockPlanner.shapes.length).toBe(1);

        const createdShape = mockPlanner.shapes[0];
        expect(createdShape.type).toBe('shape_floor_cut');
        expect(createdShape.params.width).toBe(60);
        expect(createdShape.params.height).toBe(70);
        expect(createdShape.params.stroke).toBe('#ef4444');
    });

    it('6. should cancel drawing on Escape key and reset ghost preview', () => {
        mockPlanner.tool = 'shape_rect';

        drawSystem.getRaycastHit = vi.fn(() => ({
            point: new THREE.Vector3(10, 0, 10),
            screenX: 400,
            screenY: 300
        }));
        drawSystem.onPointerDown({ button: 0 });
        expect(drawSystem.drawing).toBe(true);

        drawSystem.cancelDrawing();
        expect(drawSystem.drawing).toBe(false);
        expect(drawSystem.startPoint).toBeNull();
        expect(drawSystem.ghostGroup.visible).toBe(false);
    });
});

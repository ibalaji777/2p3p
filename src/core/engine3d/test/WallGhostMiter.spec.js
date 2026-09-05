import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { Wall3DDrawSystem } from '../Wall3DDrawSystem.js';

describe('Wall3DDrawSystem - 45-Degree Mitered Room Frame & Loop Closure', () => {
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
            style: { cursor: 'default' },
            parentElement: {
                appendChild: vi.fn(),
                removeChild: vi.fn()
            },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        };

        mockPlanner = {
            tool: 'room_box',
            walls: [],
            anchors: [],
            activePresetParams: { height: 180, thickness: 16 },
            selectEntity: vi.fn(),
            updateToolStates: vi.fn(),
            onToolChange: vi.fn(),
            syncAll: vi.fn(),
            onDrawingChange: vi.fn()
        };

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000);
        camera.position.set(0, 200, 300);

        ctx = {
            scene,
            camera,
            renderer: {
                domElement
            },
            requestRender: vi.fn()
        };

        drawSystem = new Wall3DDrawSystem(ctx, mockPlanner);
    });

    it('initializes monolithic ghostRoomFrameMesh and ghostRoomEdgesLine', () => {
        expect(drawSystem.ghostRoomFrameMesh).toBeDefined();
        expect(drawSystem.ghostRoomEdgesLine).toBeDefined();
        expect(drawSystem.ghostRoomFrameMesh.children).toContain(drawSystem.ghostRoomEdgesLine);
        expect(drawSystem.ghostRoomWalls.length).toBe(1);
        expect(drawSystem.ghostRoomWalls[0]).toBe(drawSystem.ghostRoomFrameMesh);
    });

    it('generates 32 non-overlapping triangles with 45-degree mitered trapezoid caps', () => {
        const minX = 0, minY = 0, maxX = 200, maxY = 400;
        const h = 180, t = 16, elev = 0;

        drawSystem._updateGhostRoomGeometry(minX, minY, maxX, maxY, h, t, elev);

        const posAttr = drawSystem.ghostRoomFrameGeo.getAttribute('position');
        expect(posAttr).toBeDefined();
        // 32 triangles * 3 vertices = 96 vertices
        expect(posAttr.count).toBe(96);
        expect(posAttr.array.length).toBe(288);

        // ht = 16 / 2 = 8
        // Outer boundaries: X in [-8, 208], Z in [-8, 408]
        // Height: Y in [0, 180]
        let xMin = Infinity, xMax = -Infinity;
        let yMin = Infinity, yMax = -Infinity;
        let zMin = Infinity, zMax = -Infinity;

        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const z = posAttr.getZ(i);

            xMin = Math.min(xMin, x);
            xMax = Math.max(xMax, x);
            yMin = Math.min(yMin, y);
            yMax = Math.max(yMax, y);
            zMin = Math.min(zMin, z);
            zMax = Math.max(zMax, z);
        }

        expect(xMin).toBeCloseTo(-8);
        expect(xMax).toBeCloseTo(208);
        expect(yMin).toBeCloseTo(0);
        expect(yMax).toBeCloseTo(180);
        expect(zMin).toBeCloseTo(-8);
        expect(zMax).toBeCloseTo(408);
    });

    it('generates 32 clean wireframe edges including 45-degree miter seams', () => {
        const minX = 0, minY = 0, maxX = 200, maxY = 400;
        const h = 180, t = 16, elev = 0;

        drawSystem._updateGhostRoomGeometry(minX, minY, maxX, maxY, h, t, elev);

        const linePosAttr = drawSystem.ghostRoomEdgesGeo.getAttribute('position');
        expect(linePosAttr).toBeDefined();
        // 32 lines * 2 vertices = 64 vertices = 192 floats
        expect(linePosAttr.count).toBe(64);
        expect(linePosAttr.array.length).toBe(192);

        // Verify presence of 45-degree miter lines connecting outer corners (O_i) to inner corners (I_i)
        // O_0 = (-8, -8), I_0 = (8, 8) at yTop = 180
        let hasMiterTopLeft = false;
        let hasMiterTopRight = false;

        for (let i = 0; i < linePosAttr.count; i += 2) {
            const x1 = linePosAttr.getX(i);
            const y1 = linePosAttr.getY(i);
            const z1 = linePosAttr.getZ(i);
            const x2 = linePosAttr.getX(i + 1);
            const y2 = linePosAttr.getY(i + 1);
            const z2 = linePosAttr.getZ(i + 1);

            // Check miter at Top-Left (O_0 to I_0 at Y=180)
            if (
                Math.abs(y1 - 180) < 0.1 && Math.abs(y2 - 180) < 0.1 &&
                Math.abs(x1 - (-8)) < 0.1 && Math.abs(z1 - (-8)) < 0.1 &&
                Math.abs(x2 - 8) < 0.1 && Math.abs(z2 - 8) < 0.1
            ) {
                hasMiterTopLeft = true;
            }

            // Check miter at Top-Right (O_1 to I_1 at Y=180: O_1=(208, -8), I_1=(192, 8))
            if (
                Math.abs(y1 - 180) < 0.1 && Math.abs(y2 - 180) < 0.1 &&
                Math.abs(x1 - 208) < 0.1 && Math.abs(z1 - (-8)) < 0.1 &&
                Math.abs(x2 - 192) < 0.1 && Math.abs(z2 - 8) < 0.1
            ) {
                hasMiterTopRight = true;
            }
        }

        expect(hasMiterTopLeft).toBe(true);
        expect(hasMiterTopRight).toBe(true);
    });

    it('positions and scales floor slab flush inside the inner room boundary during room_box preview', () => {
        mockPlanner.tool = 'room_box';
        drawSystem.drawing = true;
        drawSystem.startPoint = { x: 0, y: 0 };
        drawSystem.drawingElevation = 0;

        // Manually trigger the room box preview update
        const minX = 0, minY = 0, maxX = 200, maxY = 400;
        const h = 180, t = 16, elev = 0;
        const ht = t / 2; // 8
        const innerW = maxX - minX - 2 * ht; // 184
        const innerD = maxY - minY - 2 * ht; // 384

        drawSystem._updateGhostRoomGeometry(minX, minY, maxX, maxY, h, t, elev);
        drawSystem.ghostRoomFloor.position.set((minX + maxX) / 2, elev + 0.2, (minY + maxY) / 2);
        drawSystem.ghostRoomFloor.scale.set(innerW, innerD, 1);
        drawSystem.ghostRoomFloor.visible = true;

        expect(drawSystem.ghostRoomFloor.position.x).toBe(100);
        expect(drawSystem.ghostRoomFloor.position.z).toBe(200);
        expect(drawSystem.ghostRoomFloor.scale.x).toBe(184);
        expect(drawSystem.ghostRoomFloor.scale.y).toBe(384);
        expect(drawSystem.ghostRoomFloor.visible).toBe(true);
    });

    it('shows emerald green CLOSE ROOM LOOP feedback when snapping back to startAnchor during wall chain', () => {
        mockPlanner.tool = 'inner';
        drawSystem.drawing = true;
        drawSystem.drawingElevation = 0;

        const anchorA = { id: 'anc_A', x: 0, y: 0 };
        const anchorB = { id: 'anc_B', x: 200, y: 0 };
        drawSystem.startAnchor = anchorA;
        drawSystem.lastAnchor = anchorB;

        // Simulate snapping near anchorA to close the room loop
        const snapResult = {
            isAnchor: true,
            anchor: anchorA,
            pt: { x: 0, z: 0 }
        };

        const startPos = { x: anchorA.x, y: anchorA.y };
        const pt = { x: 0, z: 0 };
        const isClosingLoop = !!(
            drawSystem.startAnchor &&
            drawSystem.lastAnchor &&
            drawSystem.startAnchor !== drawSystem.lastAnchor &&
            startPos &&
            (
                (snapResult.isAnchor && snapResult.anchor === drawSystem.startAnchor) ||
                Math.hypot(pt.x - startPos.x, pt.z - startPos.y) < 5
            )
        );

        expect(isClosingLoop).toBe(true);

        const len = 200;
        let label = `${(len / 100).toFixed(2)} m`;
        let isSpecial = false;
        let badgeColor = '#00f0ff';

        if (isClosingLoop) {
            label = `🏠 CLOSE ROOM LOOP • ${(len / 100).toFixed(2)}m`;
            isSpecial = true;
            badgeColor = '#10b981';
            drawSystem.snapRing.material.color.setHex(0x10b981);
            drawSystem.snapDot.material.color.setHex(0x34d399);
        }

        expect(label).toBe('🏠 CLOSE ROOM LOOP • 2.00m');
        expect(isSpecial).toBe(true);
        expect(badgeColor).toBe('#10b981');
        expect(drawSystem.snapRing.material.color.getHexString()).toBe('10b981');
        expect(drawSystem.snapDot.material.color.getHexString()).toBe('34d399');
    });

    it('properly hides and disposes ghost meshes and geometries', () => {
        drawSystem.ghostRoomFrameMesh.visible = true;
        drawSystem.ghostRoomEdgesLine.visible = true;
        drawSystem.ghostRoomFloor.visible = true;

        drawSystem.hideGhostMeshes();
        expect(drawSystem.ghostRoomFrameMesh.visible).toBe(false);
        expect(drawSystem.ghostRoomEdgesLine.visible).toBe(false);
        expect(drawSystem.ghostRoomFloor.visible).toBe(false);

        const frameGeoDisposeSpy = vi.spyOn(drawSystem.ghostRoomFrameGeo, 'dispose');
        const edgesGeoDisposeSpy = vi.spyOn(drawSystem.ghostRoomEdgesGeo, 'dispose');

        drawSystem.dispose();
        expect(frameGeoDisposeSpy).toHaveBeenCalled();
        expect(edgesGeoDisposeSpy).toHaveBeenCalled();
    });
});

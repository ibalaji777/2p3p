import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { WallGeometryEngine } from '../WallGeometryEngine.js';
import { WallEngine } from '../WallEngine.js';
import { DeleteEntityCommand } from '../../commands/DeleteEntityCommand.js';
import { DuplicateEntityCommand } from '../../commands/DuplicateEntityCommand.js';
import { CreateOpeningCommand } from '../../commands/CreateOpeningCommand.js';

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
            arc: () => {},
            rect: () => {},
            measureText: () => ({ width: 0 }),
            transform: () => {},
            resetTransform: () => {}
        });
    }
});

describe('Door & Window Centralization Remediation Suite', () => {
    let mockPlanner;
    let mockWall;

    beforeEach(() => {
        mockWall = {
            id: 'wall_test_1',
            type: 'outer',
            thickness: 20,
            height: 280,
            elevation: 0,
            startX: 0,
            startY: 0,
            endX: 400,
            endY: 0,
            attachedWidgets: [],
            getLength() { return 400; }
        };
        mockPlanner = {
            walls: [mockWall],
            furniture: [],
            stairs: [],
            selectedEntity: null,
            syncAll() {},
            getEntities() {
                const attached = [];
                if (this.walls) {
                    this.walls.forEach(w => {
                        if (w.attachedWidgets) attached.push(...w.attachedWidgets);
                    });
                }
                return [...this.walls, ...this.furniture, ...this.stairs, ...attached];
            },
            getDoors() {
                let doors = [];
                if (this.walls) {
                    this.walls.forEach(w => {
                        if (w.attachedWidgets) {
                            w.attachedWidgets.forEach(o => {
                                if (o.type === 'door' || o.doorType || o.type?.startsWith('door_')) doors.push(o);
                            });
                        }
                    });
                }
                return doors;
            },
            getWindows() {
                let windows = [];
                if (this.walls) {
                    this.walls.forEach(w => {
                        if (w.attachedWidgets) {
                            w.attachedWidgets.forEach(o => {
                                if (o.type === 'window' || o.windowType || o.type?.startsWith('window_')) windows.push(o);
                            });
                        }
                    });
                }
                return windows;
            }
        };
    });

    describe('1. WallGeometryEngine.createApertureVoidPath SSOT', () => {
        it('should generate standard rectangular door cutout path', () => {
            const doorWidget = {
                id: 'd1',
                type: 'door',
                width: 90,
                height: 210,
                elevation: 0,
                t: 0.5
            };
            const path = WallGeometryEngine.createApertureVoidPath(doorWidget, 400, 280, 0, THREE);
            expect(path).toBeDefined();
            expect(path).toBeInstanceOf(THREE.Path);
            expect(path.curves.length).toBeGreaterThan(0);
        });

        it('should generate arched door cutout path with absarc', () => {
            const archedDoor = {
                id: 'd_arch',
                type: 'door',
                doorShape: 'arch',
                width: 100,
                height: 220,
                elevation: 0,
                t: 0.5
            };
            const path = WallGeometryEngine.createApertureVoidPath(archedDoor, 400, 280, 0, THREE);
            expect(path).toBeDefined();
            expect(path).toBeInstanceOf(THREE.Path);
            expect(path.curves.some(c => c.isArcCurve || c.isEllipseCurve)).toBe(true);
        });

        it('should generate gothic arched window cutout path with quadratic curves', () => {
            const gothicWindow = {
                id: 'w_gothic',
                type: 'window',
                windowShape: 'gothic',
                width: 120,
                height: 140,
                elevation: 90,
                t: 0.3
            };
            const path = WallGeometryEngine.createApertureVoidPath(gothicWindow, 400, 280, 0, THREE);
            expect(path).toBeDefined();
            expect(path).toBeInstanceOf(THREE.Path);
            expect(path.curves.some(c => c.isQuadraticBezierCurve || c.v1)).toBe(true);
        });

        it('should generate circular opening path with full 360 ellipse', () => {
            const circularOpening = {
                id: 'c_open',
                type: 'circular_opening',
                width: 60,
                height: 60,
                elevation: 100,
                t: 0.7
            };
            const path = WallGeometryEngine.createApertureVoidPath(circularOpening, 400, 280, 0, THREE);
            expect(path).toBeDefined();
            expect(path).toBeInstanceOf(THREE.Path);
        });

        it('should return null for solid_protrusion to prevent punching holes', () => {
            const protrusion = {
                id: 'prot_1',
                type: 'solid_protrusion',
                width: 60,
                height: 200,
                t: 0.5
            };
            const path = WallGeometryEngine.createApertureVoidPath(protrusion, 400, 280, 0, THREE);
            expect(path).toBeNull();
        });
    });

    describe('2. DeleteEntityCommand attached widget undo/redo', () => {
        it('should remove attached door on execute and restore it on undo', () => {
            const door = {
                id: 'door_to_delete',
                type: 'door',
                width: 90,
                height: 210,
                elevation: 0,
                t: 0.4,
                wall: mockWall
            };
            WallEngine.attachWidget(mockWall, door, false, mockPlanner);
            expect(mockWall.attachedWidgets).toContain(door);

            const cmd = new DeleteEntityCommand(mockPlanner, 'door_to_delete');
            cmd.execute();
            expect(mockWall.attachedWidgets).not.toContain(door);

            cmd.undo();
            expect(mockWall.attachedWidgets.some(w => w.id === 'door_to_delete')).toBe(true);
        });
    });

    describe('3. DuplicateEntityCommand attached widget support', () => {
        it('should clone window with offset t onto host wall', () => {
            const windowObj = {
                id: 'orig_win',
                type: 'window',
                width: 120,
                height: 120,
                elevation: 90,
                t: 0.3,
                wall: mockWall,
                params: { frameWidth: 5 }
            };
            WallEngine.attachWidget(mockWall, windowObj, false, mockPlanner);

            const cmd = new DuplicateEntityCommand(mockPlanner, 'orig_win', 'dupe_win_1');
            cmd.execute();

            expect(mockWall.attachedWidgets.length).toBe(2);
            const dupe = mockWall.attachedWidgets.find(w => w.id === 'dupe_win_1');
            expect(dupe).toBeDefined();
            expect(dupe.type).toBe('window');
            expect(dupe.width).toBe(120);
            expect(dupe.t).toBeCloseTo(0.45, 2);
            expect(dupe.params.frameWidth).toBe(5);

            cmd.undo();
            expect(mockWall.attachedWidgets.find(w => w.id === 'dupe_win_1')).toBeUndefined();
            expect(mockWall.attachedWidgets.length).toBe(1);
        });
    });

    describe('4. Engine2D Query API alignment', () => {
        it('should query doors and windows accurately from attachedWidgets', () => {
            const door = { id: 'd1', type: 'door', width: 90, height: 210, t: 0.2, wall: mockWall };
            const win = { id: 'w1', type: 'window', width: 120, height: 120, t: 0.7, wall: mockWall };
            WallEngine.attachWidget(mockWall, door, false, mockPlanner);
            WallEngine.attachWidget(mockWall, win, false, mockPlanner);

            const doors = mockPlanner.getDoors();
            const windows = mockPlanner.getWindows();

            expect(doors).toContain(door);
            expect(doors.length).toBe(1);
            expect(windows).toContain(win);
            expect(windows.length).toBe(1);
        });
    });

    describe('5. WallEngine Widget Lifecycle Authority', () => {
        it('should create and attach widget with normalized t', () => {
            const wid = WallEngine.createWidget(mockPlanner, mockWall, 200, 'door', {
                id: 'wid_123',
                width: 90,
                height: 210,
                elevation: 40 // Should be forced to 0 for floor-anchored door
            });

            expect(wid).toBeDefined();
            expect(wid.id).toBe('wid_123');
            expect(wid.t).toBeCloseTo(0.5, 2);
            expect(wid.elevation).toBe(0);
            expect(mockWall.attachedWidgets).toContain(wid);
        });

        it('should serialize and deserialize widget correctly', () => {
            const wid = WallEngine.createWidget(mockPlanner, mockWall, 0.3, 'window', {
                id: 'wid_win',
                width: 120,
                height: 140,
                elevation: 90,
                params: { frameMat: 'aluminum_black' }
            });

            const serialized = WallEngine.serializeWidget(wid);
            expect(serialized).toBeDefined();
            expect(serialized.id).toBe('wid_win');
            expect(serialized.width).toBe(120);
            expect(serialized.elevation).toBe(90);
            expect(serialized.params.frameMat).toBe('aluminum_black');

            const restored = WallEngine.deserializeWidget(mockPlanner, mockWall, serialized);
            expect(restored).toBeDefined();
            expect(restored.id).toBe('wid_win');
            expect(restored.width).toBe(120);
            expect(restored.params.frameMat).toBe('aluminum_black');
            expect(restored.wall).toBe(mockWall);
        });

        it('should delete widget cleanly from wall', () => {
            const wid = WallEngine.createWidget(mockPlanner, mockWall, 0.4, 'door', { id: 'wid_del' });
            expect(mockWall.attachedWidgets).toContain(wid);

            WallEngine.deleteWidget(mockPlanner, mockWall, wid, false);
            expect(mockWall.attachedWidgets).not.toContain(wid);
        });
    });

    describe('6. CreateOpeningCommand Execute -> Undo -> Redo Lifecycle', () => {
        it('should create widget on execute, remove on undo, and recreate fresh instance on redo', () => {
            const cmd = new CreateOpeningCommand(mockPlanner, 'door', 'wall_test_1', 0.5, 'door', 'cmd_door_1');
            cmd.execute();

            expect(mockWall.attachedWidgets.length).toBe(1);
            const firstInstance = mockWall.attachedWidgets[0];
            expect(firstInstance.id).toBe('cmd_door_1');
            expect(firstInstance.elevation).toBe(0);

            cmd.undo();
            expect(mockWall.attachedWidgets.length).toBe(0);

            cmd.execute();
            expect(mockWall.attachedWidgets.length).toBe(1);
            const secondInstance = mockWall.attachedWidgets[0];
            expect(secondInstance.id).toBe('cmd_door_1');
            expect(secondInstance.elevation).toBe(0);
        });
    });
});

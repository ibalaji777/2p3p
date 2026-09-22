import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { OutdoorZoneEngine } from '../OutdoorZoneEngine.js';
import { OUTDOOR_ZONE_TYPES, PremiumOutdoorZone } from '../../engine2d/PremiumOutdoorZone.js';
import { DeleteEntityCommand } from '../../commands/DeleteEntityCommand.js';
import { DuplicateEntityCommand } from '../../commands/DuplicateEntityCommand.js';

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

class MockStage {
    constructor() {
        this._w = 1000;
        this._h = 800;
    }
    width() { return this._w; }
    height() { return this._h; }
    batchDraw() {}
}

function createMockPlanner() {
    return {
        stage: new MockStage(),
        mainLayer: {
            batchDraw: () => {},
            add: () => {}
        },
        baseLayer: {
            batchDraw: () => {},
            add: () => {}
        },
        uiLayer: {
            batchDraw: () => {},
            add: () => {}
        },
        outdoorZones: [],
        walls: [],
        furniture: [],
        stairs: [],
        roofs: [],
        platforms: [],
        selectedEntity: null,
        selectedType: null,
        tool: 'select',
        currentUnit: 'cm',
        selectEntity(entity, type = null) {
            this.selectedEntity = entity;
            this.selectedType = type;
        },
        syncAll() {}
    };
}

describe('OutdoorZoneEngine - Canonical Domain Architecture', () => {
    let mockPlanner;

    beforeEach(() => {
        mockPlanner = createMockPlanner();
    });

    describe('1. Canonical Entity Creation (createOutdoorZone)', () => {
        it('should create a polygon outdoor zone with auto-centering and relative points', () => {
            const rawPoints = [
                { x: 100, y: 100 },
                { x: 300, y: 100 },
                { x: 300, y: 300 },
                { x: 100, y: 300 }
            ];

            const zone = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                subType: 'patio',
                points: rawPoints
            }, { addToPlanner: true });

            expect(zone).toBeDefined();
            expect(zone.subType).toBe('patio');
            expect(zone.x).toBe(200);
            expect(zone.y).toBe(200);
            expect(zone.points.length).toBe(4);
            expect(zone.points[0]).toEqual({ x: -100, y: -100 });
            expect(mockPlanner.outdoorZones).toContain(zone);
        });

        it('should create a linear corridor zone (walkway) with default width 60 and centerline', () => {
            const centerline = [
                { x: 0, y: 0 },
                { x: 200, y: 0 }
            ];

            const zone = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                subType: 'walkway',
                centerline: centerline
            }, { addToPlanner: true });

            expect(zone).toBeDefined();
            expect(zone.subType).toBe('walkway');
            expect(zone.width).toBe(60);
            expect(zone.centerline).toBeDefined();
            expect(zone.points.length).toBeGreaterThanOrEqual(4);
            expect(mockPlanner.outdoorZones).toContain(zone);
        });

        it('should apply custom parameters and select entity if requested', () => {
            const zone = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                id: 'custom_zone_1',
                name: 'Custom Garden',
                subType: 'softscape',
                x: 150,
                y: 250,
                elevation: 15,
                height3D: 0.5,
                points: [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }]
            }, { addToPlanner: true, select: true });

            expect(zone.id).toBe('custom_zone_1');
            expect(zone.name).toBe('Custom Garden');
            expect(zone.elevation).toBe(15);
            expect(zone.height3D).toBe(0.5);
            expect(mockPlanner.selectedEntity).toBe(zone);
            expect(mockPlanner.selectedType).toBe('outdoor_zone');
        });
    });

    describe('2. Serialization & Deserialization Fidelity', () => {
        it('should serialize an outdoor zone preserving all critical BIM attributes', () => {
            const zone = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                id: 'zone_serial_test',
                subType: 'driveway',
                width: 160,
                x: 350,
                y: 450,
                elevation: 5,
                height3D: 0.4,
                centerline: [{ x: -100, y: 0 }, { x: 100, y: 0 }],
                points: [{ x: -100, y: -80 }, { x: 100, y: -80 }, { x: 100, y: 80 }, { x: -100, y: 80 }]
            });

            const serialized = OutdoorZoneEngine.serialize(zone);

            expect(serialized.id).toBe('zone_serial_test');
            expect(serialized.type).toBe('outdoor_zone');
            expect(serialized.subType).toBe('driveway');
            expect(serialized.width).toBe(160);
            expect(serialized.x).toBe(350);
            expect(serialized.y).toBe(450);
            expect(serialized.elevation).toBe(5);
            expect(serialized.height3D).toBe(0.4);
            expect(serialized.centerline).toHaveLength(2);
            expect(serialized.points).toHaveLength(4);
        });

        it('should deserialize serialized data into a pristine, functional outdoor zone with preserved ID', () => {
            const original = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                id: 'zone_preserve_id',
                subType: 'pavement',
                x: 120,
                y: 180,
                points: [{ x: -40, y: -40 }, { x: 40, y: -40 }, { x: 40, y: 40 }, { x: -40, y: 40 }]
            });

            const serialized = OutdoorZoneEngine.serialize(original);
            const restored = OutdoorZoneEngine.deserialize(mockPlanner, serialized, { addToPlanner: true });

            expect(restored).toBeDefined();
            expect(restored.id).toBe('zone_preserve_id');
            expect(restored.subType).toBe('pavement');
            expect(restored.x).toBe(120);
            expect(restored.y).toBe(180);
            expect(restored.points).toEqual(original.points);
            expect(mockPlanner.outdoorZones).toContain(restored);
        });
    });

    describe('3. Deletion & Zombie-Proof Undo Restoration (DeleteEntityCommand)', () => {
        it('should delete outdoor zone cleanly via OutdoorZoneEngine.deleteOutdoorZone', () => {
            const zone = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                id: 'zone_del_1',
                subType: 'softscape',
                points: [{ x: -20, y: -20 }, { x: 20, y: -20 }, { x: 20, y: 20 }, { x: -20, y: 20 }]
            }, { addToPlanner: true });

            expect(mockPlanner.outdoorZones).toContain(zone);

            const deleted = OutdoorZoneEngine.deleteOutdoorZone(mockPlanner, zone);
            expect(deleted).toBe(true);
            expect(mockPlanner.outdoorZones).not.toContain(zone);
            expect(zone.group).toBeNull();
        });

        it('should execute DeleteEntityCommand and restore pristine entity on undo without data loss', () => {
            const zone = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                id: 'zone_undo_test',
                subType: 'patio',
                x: 220,
                y: 330,
                points: [{ x: -60, y: -60 }, { x: 60, y: -60 }, { x: 60, y: 60 }, { x: -60, y: 60 }]
            }, { addToPlanner: true });

            expect(mockPlanner.outdoorZones.find(z => z.id === 'zone_undo_test')).toBeDefined();

            // Execute DeleteEntityCommand
            const cmd = new DeleteEntityCommand(mockPlanner, 'zone_undo_test');
            cmd.execute();

            expect(mockPlanner.outdoorZones.find(z => z.id === 'zone_undo_test')).toBeUndefined();

            // Undo DeleteEntityCommand - MUST restore entity to outdoorZones
            cmd.undo();

            const restored = mockPlanner.outdoorZones.find(z => z.id === 'zone_undo_test');
            expect(restored).toBeDefined();
            expect(restored.id).toBe('zone_undo_test');
            expect(restored.subType).toBe('patio');
            expect(restored.x).toBe(220);
            expect(restored.y).toBe(330);
            expect(restored.group).not.toBeNull();
        });
    });

    describe('4. Duplication Support (DuplicateEntityCommand)', () => {
        it('should duplicate an outdoor zone with offset via OutdoorZoneEngine.duplicateOutdoorZone', () => {
            const zone = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                id: 'zone_source',
                subType: 'walkway',
                width: 60,
                x: 100,
                y: 100,
                centerline: [{ x: -50, y: 0 }, { x: 50, y: 0 }],
                points: [{ x: -50, y: -30 }, { x: 50, y: -30 }, { x: 50, y: 30 }, { x: -50, y: 30 }]
            }, { addToPlanner: true });

            const dup = OutdoorZoneEngine.duplicateOutdoorZone(mockPlanner, zone, { x: 50, y: 50 });

            expect(dup).toBeDefined();
            expect(dup.id).not.toBe('zone_source');
            expect(dup.x).toBe(150);
            expect(dup.y).toBe(150);
            expect(dup.subType).toBe('walkway');
            expect(dup.width).toBe(60);
            expect(mockPlanner.outdoorZones).toContain(dup);
        });

        it('should execute DuplicateEntityCommand for outdoor zone with full undo/redo cycle', () => {
            const zone = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                id: 'zone_dup_cmd_test',
                subType: 'pavement',
                x: 200,
                y: 200,
                points: [{ x: -30, y: -30 }, { x: 30, y: -30 }, { x: 30, y: 30 }, { x: -30, y: 30 }]
            }, { addToPlanner: true });

            const cmd = new DuplicateEntityCommand(mockPlanner, 'zone_dup_cmd_test', 'zone_dup_cmd_test_copy');
            cmd.execute();

            const copy = mockPlanner.outdoorZones.find(z => z.id === 'zone_dup_cmd_test_copy');
            expect(copy).toBeDefined();
            expect(copy.x).toBe(230);
            expect(copy.y).toBe(230);

            // Undo duplication
            cmd.undo();
            expect(mockPlanner.outdoorZones.find(z => z.id === 'zone_dup_cmd_test_copy')).toBeUndefined();

            // Redo duplication
            cmd.execute();
            const reCopy = mockPlanner.outdoorZones.find(z => z.id === 'zone_dup_cmd_test_copy');
            expect(reCopy).toBeDefined();
            expect(reCopy.x).toBe(230);
            expect(reCopy.group).not.toBeNull();
        });
    });

    describe('5. Standard 2D Scene Contracts (update2D & remove)', () => {
        it('should provide update2D method conforming to standard entity contract', () => {
            const zone = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                subType: 'softscape',
                points: [{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }]
            });

            expect(typeof zone.update2D).toBe('function');
            expect(() => zone.update2D()).not.toThrow();
        });

        it('should provide remove method unhooking from planner.outdoorZones and destroying', () => {
            const zone = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                id: 'zone_remove_test',
                subType: 'other_space',
                points: [{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }]
            }, { addToPlanner: true });

            expect(mockPlanner.outdoorZones).toContain(zone);

            zone.remove();

            expect(mockPlanner.outdoorZones).not.toContain(zone);
            expect(zone.group).toBeNull();
        });
    });

    describe('6. Corridor Operations & Ribbon Mathematics', () => {
        it('should compute corridor offsets and polygons accurately', () => {
            const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
            const width = 40;

            const offsets = OutdoorZoneEngine.computeCorridorOffsets(points, width);
            expect(offsets).toBeDefined();
            expect(offsets.leftPts).toHaveLength(2);
            expect(offsets.rightPts).toHaveLength(2);

            const poly = OutdoorZoneEngine.computeCorridorPolygon(points, width);
            expect(poly).toBeDefined();
            expect(poly).toHaveLength(4);
            // Check width is 40 (-20 to +20 along Y for a horizontal line)
            expect(poly[0].y).toBe(20);
            expect(poly[3].y).toBe(-20);
        });

        it('should support parametric width adjustment via setWidth', () => {
            const zone = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                subType: 'walkway',
                width: 60,
                centerline: [{ x: 0, y: 0 }, { x: 100, y: 0 }]
            });

            OutdoorZoneEngine.setWidth(zone, 120);

            expect(zone.width).toBe(120);
        });

        it('should support straightenPath and reversePath', () => {
            const centerline = [
                { x: 0, y: 0 },
                { x: 50, y: 50 },
                { x: 100, y: 0 }
            ];

            const zone = OutdoorZoneEngine.createOutdoorZone(mockPlanner, {
                subType: 'walkway',
                width: 60,
                centerline: centerline
            });

            expect(zone.centerline).toHaveLength(3);
            const firstPt = { ...zone.centerline[0] };
            const lastPt = { ...zone.centerline[2] };

            OutdoorZoneEngine.straightenPath(zone);
            expect(zone.centerline).toHaveLength(2);
            expect(zone.centerline[0]).toEqual(firstPt);
            expect(zone.centerline[1]).toEqual(lastPt);

            OutdoorZoneEngine.reversePath(zone);
            expect(zone.centerline[0]).toEqual(lastPt);
            expect(zone.centerline[1]).toEqual(firstPt);
        });
    });
});

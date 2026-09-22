import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { PlatformEngine } from '../PlatformEngine.js';
import { PremiumPlatform, PLATFORM_TRIM_STYLES } from '../../engine2d/PremiumPlatform.js';
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
        platforms: [],
        walls: [],
        furniture: [],
        stairs: [],
        roofs: [],
        outdoorZones: [],
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

describe('PlatformEngine - Canonical Domain Architecture', () => {
    let mockPlanner;

    beforeEach(() => {
        mockPlanner = createMockPlanner();
    });

    describe('1. Canonical Entity Creation (createPlatform)', () => {
        it('should create a rectangular platform with defaults and register to planner', () => {
            const platform = PlatformEngine.createPlatform(mockPlanner, {
                x: 200,
                y: 150,
                width: 160,
                depth: 140,
                height: 30,
                elevation: 10,
                trimStyle: 'bullnose'
            }, { addToPlanner: true, select: true });

            expect(platform).toBeDefined();
            expect(platform.shapeType).toBe('rect');
            expect(platform.width).toBe(160);
            expect(platform.depth).toBe(140);
            expect(platform.height).toBe(30);
            expect(platform.elevation).toBe(10);
            expect(platform.trimStyle).toBe('bullnose');
            expect(mockPlanner.platforms).toContain(platform);
            expect(mockPlanner.selectedEntity).toBe(platform);
            expect(mockPlanner.selectedType).toBe('platform');
        });

        it('should create a polygon platform with auto-centering', () => {
            const rawPoints = [
                { x: 100, y: 100 },
                { x: 300, y: 100 },
                { x: 300, y: 300 },
                { x: 100, y: 300 }
            ];

            const platform = PlatformEngine.createPlatform(mockPlanner, {
                shapeType: 'polygon',
                points: rawPoints,
                height: 20
            });

            expect(platform.shapeType).toBe('polygon');
            // Center should be (200, 200)
            expect(platform.x).toBe(200);
            expect(platform.y).toBe(200);
            // Relative points should be centered around origin
            expect(platform.points[0]).toEqual({ x: -100, y: -100 });
            expect(platform.points[2]).toEqual({ x: 100, y: 100 });
            expect(mockPlanner.platforms).toContain(platform);
        });

        it('should configure building foundation platform as hidden 2D geometry', () => {
            const platform = PlatformEngine.createPlatform(mockPlanner, {
                x: 300,
                y: 300,
                width: 200,
                depth: 200,
                height: 45,
                isBuildingFoundation: true,
                associatedRoomId: 'room_abc'
            });

            expect(platform.isBuildingFoundation).toBe(true);
            expect(platform.associatedRoomId).toBe('room_abc');
            if (platform.group) {
                expect(platform.group.visible()).toBe(false);
                expect(platform.group.listening()).toBe(false);
            }
        });

        it('should configure room interior split-level platform', () => {
            const platform = PlatformEngine.createPlatform(mockPlanner, {
                x: 150,
                y: 150,
                width: 100,
                depth: 100,
                height: 15,
                isRoomInteriorPlatform: true,
                associatedRoomId: 'room_living'
            });

            expect(platform.isRoomInteriorPlatform).toBe(true);
            expect(platform.associatedRoomId).toBe('room_living');
        });
    });

    describe('2. Authoritative JSON Serialization & Deserialization', () => {
        it('should serialize and deserialize a platform with 100% parameter fidelity', () => {
            const original = PlatformEngine.createPlatform(mockPlanner, {
                name: 'Living Stage',
                x: 250,
                y: 180,
                width: 220,
                depth: 180,
                height: 45,
                stepHeight: 15,
                elevation: 15,
                trimStyle: 'classical',
                materials: {
                    top: { id: 'marble_nero_marquina' },
                    side: { id: 'wood_dark_walnut' }
                }
            });

            const serialized = PlatformEngine.serialize(original);
            expect(serialized.id).toBe(original.id);
            expect(serialized.type).toBe('platform');
            expect(serialized.name).toBe('Living Stage');
            expect(serialized.width).toBe(220);
            expect(serialized.depth).toBe(180);
            expect(serialized.height).toBe(45);
            expect(serialized.elevation).toBe(15);
            expect(serialized.trimStyle).toBe('classical');
            expect(serialized.materials.top.id).toBe('marble_nero_marquina');
            expect(serialized.materials.side.id).toBe('wood_dark_walnut');

            // Deserialize into clean planner
            const cleanPlanner = createMockPlanner();
            const restored = PlatformEngine.deserialize(cleanPlanner, serialized, { addToPlanner: true });

            expect(restored.id).toBe(original.id);
            expect(restored.name).toBe('Living Stage');
            expect(restored.width).toBe(220);
            expect(restored.depth).toBe(180);
            expect(restored.height).toBe(45);
            expect(restored.elevation).toBe(15);
            expect(restored.trimStyle).toBe('classical');
            expect(restored.materials.top.id).toBe('marble_nero_marquina');
            expect(cleanPlanner.platforms).toContain(restored);
        });
    });

    describe('3. Deletion & Undo Restoration (DeleteEntityCommand)', () => {
        it('should delete a platform and cleanly remove it from planner', () => {
            const platform = PlatformEngine.createPlatform(mockPlanner, {
                x: 100, y: 100, width: 100, depth: 100
            });
            expect(mockPlanner.platforms).toContain(platform);

            const result = PlatformEngine.deletePlatform(mockPlanner, platform);
            expect(result).toBe(true);
            expect(mockPlanner.platforms).not.toContain(platform);
        });

        it('should support undo and redo via DeleteEntityCommand without data loss', () => {
            const platform = PlatformEngine.createPlatform(mockPlanner, {
                id: 'plat_undo_test',
                x: 150,
                y: 150,
                width: 200,
                depth: 160,
                height: 30,
                trimStyle: 'bullnose'
            });

            const deleteCmd = new DeleteEntityCommand(mockPlanner, 'plat_undo_test');
            deleteCmd.execute();

            expect(mockPlanner.platforms.length).toBe(0);

            // Undo restoration
            deleteCmd.undo();
            expect(mockPlanner.platforms.length).toBe(1);
            const restored = mockPlanner.platforms[0];
            expect(restored.id).toBe('plat_undo_test');
            expect(restored.width).toBe(200);
            expect(restored.depth).toBe(160);
            expect(restored.height).toBe(30);
            expect(restored.trimStyle).toBe('bullnose');
        });
    });

    describe('4. Duplication & Undo/Redo (DuplicateEntityCommand)', () => {
        it('should duplicate a platform with spatial offset and new ID', () => {
            const original = PlatformEngine.createPlatform(mockPlanner, {
                x: 100,
                y: 100,
                width: 140,
                depth: 120,
                height: 25,
                trimStyle: 'stone'
            });

            const duplicated = PlatformEngine.duplicatePlatform(mockPlanner, original, { x: 40, y: 40 });

            expect(duplicated).toBeDefined();
            expect(duplicated.id).not.toBe(original.id);
            expect(duplicated.x).toBe(140);
            expect(duplicated.y).toBe(140);
            expect(duplicated.width).toBe(140);
            expect(duplicated.height).toBe(25);
            expect(duplicated.trimStyle).toBe('stone');
            expect(mockPlanner.platforms).toContain(duplicated);
        });

        it('should support undo and redo via DuplicateEntityCommand', () => {
            const original = PlatformEngine.createPlatform(mockPlanner, {
                id: 'plat_source',
                x: 100,
                y: 100,
                width: 120,
                depth: 120
            });

            const dupCmd = new DuplicateEntityCommand(mockPlanner, 'plat_source');
            dupCmd.execute();

            expect(mockPlanner.platforms.length).toBe(2);
            const duplicated = dupCmd.createdEntity;
            expect(duplicated).toBeDefined();
            expect(mockPlanner.platforms).toContain(duplicated);

            // Undo duplication
            dupCmd.undo();
            expect(mockPlanner.platforms.length).toBe(1);
            expect(mockPlanner.platforms).not.toContain(duplicated);

            // Redo duplication
            dupCmd.execute();
            expect(mockPlanner.platforms.length).toBe(2);
            expect(dupCmd.createdEntity).toBeDefined();
            expect(mockPlanner.platforms).toContain(dupCmd.createdEntity);
        });
    });

    describe('5. Parametric Adjustments & 2D Contracts', () => {
        it('should update platform height, elevation, and dimensions parametrically', () => {
            const platform = PlatformEngine.createPlatform(mockPlanner, {
                x: 200, y: 200, width: 120, depth: 120, height: 20, elevation: 0
            });

            PlatformEngine.setHeight(platform, 45);
            expect(platform.height).toBe(45);

            PlatformEngine.setElevation(platform, 15);
            expect(platform.elevation).toBe(15);

            PlatformEngine.setDimensions(platform, { width: 180, depth: 160 });
            expect(platform.width).toBe(180);
            expect(platform.depth).toBe(160);

            PlatformEngine.setTrimStyle(platform, 'recessed_led');
            expect(platform.trimStyle).toBe('recessed_led');

            PlatformEngine.setMaterial(platform, 'top', 'wood_golden_teak');
            expect(platform.materials.top.id).toBe('wood_golden_teak');
        });

        it('should raise and lower platform in discrete step increments (Sims 4 style)', () => {
            const platform = PlatformEngine.createPlatform(mockPlanner, {
                x: 200, y: 200, height: 15, stepHeight: 15
            });

            PlatformEngine.raisePlatform(platform);
            expect(platform.height).toBe(30);

            PlatformEngine.raisePlatform(platform);
            expect(platform.height).toBe(45);

            PlatformEngine.lowerPlatform(platform);
            expect(platform.height).toBe(30);
        });

        it('should provide update2D() and remove() on PremiumPlatform fulfilling universal contracts', () => {
            const platform = PlatformEngine.createPlatform(mockPlanner, {
                x: 100, y: 100, width: 100, depth: 100
            });

            expect(typeof platform.update2D).toBe('function');
            expect(typeof platform.remove).toBe('function');

            // Call update2D
            expect(() => platform.update2D()).not.toThrow();

            // Call remove
            platform.remove();
            expect(mockPlanner.platforms).not.toContain(platform);
        });
    });
});

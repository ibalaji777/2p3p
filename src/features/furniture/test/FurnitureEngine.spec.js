import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { FurnitureEngine } from '../../../core/furniture/FurnitureEngine.js';
import { CreateFurnitureCommand } from '../../../core/commands/CreateFurnitureCommand.js';
import { DeleteEntityCommand } from '../../../core/commands/DeleteEntityCommand.js';
import { DuplicateEntityCommand } from '../../../core/commands/DuplicateEntityCommand.js';
import { FloorPlanner } from '../../../core/engine2d/index.js';

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

// Mock minimal Konva container for FloorPlanner if needed
class MockStage {
    constructor() {
        this._w = 800;
        this._h = 600;
    }
    width() { return this._w; }
    height() { return this._h; }
    getPointerPosition() { return { x: 100, y: 100 }; }
    batchDraw() {}
}

function createMockPlanner() {
    return {
        stage: new MockStage(),
        furnitureLayer: {
            add: () => {},
            batchDraw: () => {},
            getChildren: () => []
        },
        mainLayer: {
            batchDraw: () => {}
        },
        furniture: [],
        walls: [],
        stairs: [],
        roofs: [],
        platforms: [],
        anchors: [],
        selectedEntity: null,
        selectedType: null,
        tool: 'select',
        selectEntity(entity, type = null) {
            this.selectedEntity = entity;
            this.selectedType = type;
        },
        syncAll() {}
    };
}

describe('FurnitureEngine - Canonical Domain Architecture', () => {
    let mockPlanner;

    beforeEach(() => {
        mockPlanner = createMockPlanner();
    });

    describe('1. Entity Creation & Configuration', () => {
        it('should create furniture with default parameters', () => {
            const furn = FurnitureEngine.createFurniture(mockPlanner, {
                x: 150,
                y: 250,
                configId: 'chair',
                addToPlanner: true
            });

            expect(furn).toBeDefined();
            expect(furn.id).toBeDefined();
            expect(furn.type).toBe('furniture');
            expect(furn.configId).toBe('chair');
            expect(mockPlanner.furniture.length).toBe(1);
            expect(mockPlanner.furniture[0]).toBe(furn);
        });

        it('should honor explicit ID, custom dimensions, materials, and vertical hosts', () => {
            const customId = 'test_furn_custom_007';
            const furn = FurnitureEngine.createFurniture(mockPlanner, {
                id: customId,
                x: 200,
                y: 300,
                configId: 'sofa_modern',
                width: 220,
                depth: 90,
                height: 85,
                elevation: 15,
                rotation: 45,
                materials: { upholstery: 'fabric_velvet_navy', legs: 'wood_walnut' },
                params: { firmness: 'soft' },
                hostPlatformId: 'plat_123',
                hostFurnitureId: 'table_456',
                relativeElevation: 10,
                description: 'Luxury Living Room Sofa',
                addToPlanner: true,
                select: true
            });

            expect(furn.id).toBe(customId);
            expect(furn.width).toBe(220);
            expect(furn.depth).toBe(90);
            expect(furn.height).toBe(85);
            expect(furn.elevation).toBe(15);
            expect(furn.rotation).toBe(45);
            expect(furn.materials.upholstery).toBe('fabric_velvet_navy');
            expect(furn.params.firmness).toBe('soft');
            expect(furn.hostPlatformId).toBe('plat_123');
            expect(furn.hostFurnitureId).toBe('table_456');
            expect(furn.relativeElevation).toBe(10);
            expect(furn.description).toBe('Luxury Living Room Sofa');
            expect(mockPlanner.selectedEntity).toBe(furn);
        });

        it('should not add to planner if addToPlanner is false', () => {
            const furn = FurnitureEngine.createFurniture(mockPlanner, {
                configId: 'chair',
                addToPlanner: false
            });

            expect(furn).toBeDefined();
            expect(mockPlanner.furniture.length).toBe(0);
        });
    });

    describe('2. Standard 2D Scene Contract (update2D)', () => {
        it('should provide update2D method conforming to standard entity contract', () => {
            const furn = FurnitureEngine.createFurniture(mockPlanner, {
                width: 100,
                depth: 100
            });

            expect(typeof furn.update2D).toBe('function');
            furn.width = 180;
            furn.depth = 90;
            furn.update2D();

            expect(furn.group.width()).toBe(180);
            expect(furn.group.height()).toBe(90);
        });
    });

    describe('3. Serialization & Deserialization Integrity', () => {
        it('should serialize furniture completely preserving id, materials, and host metadata', () => {
            const original = FurnitureEngine.createFurniture(mockPlanner, {
                id: 'furn_authoritative_99',
                x: 350,
                y: 450,
                configId: 'desk_executive',
                width: 160,
                depth: 80,
                height: 75,
                elevation: 5,
                rotation: 90,
                materials: { top: 'wood_dark_walnut', legs: 'metal_black_matte' },
                params: { drawerCount: 3 },
                hostPlatformId: 'platform_main',
                hostFurnitureId: 'rug_under_desk',
                relativeElevation: 5,
                description: 'Executive Work Desk'
            });

            const serialized = FurnitureEngine.serialize(original);

            expect(serialized).toBeDefined();
            expect(serialized.id).toBe('furn_authoritative_99');
            expect(serialized.type).toBe('furniture');
            expect(serialized.configId).toBe('desk_executive');
            expect(serialized.x).toBe(350);
            expect(serialized.y).toBe(450);
            expect(serialized.rotation).toBe(90);
            expect(serialized.width).toBe(160);
            expect(serialized.depth).toBe(80);
            expect(serialized.height).toBe(75);
            expect(serialized.elevation).toBe(5);
            expect(serialized.materials.top).toBe('wood_dark_walnut');
            expect(serialized.params.drawerCount).toBe(3);
            expect(serialized.hostPlatformId).toBe('platform_main');
            expect(serialized.hostFurnitureId).toBe('rug_under_desk');
            expect(serialized.relativeElevation).toBe(5);
        });

        it('should deserialize serialized data restoring the exact entity without data loss', () => {
            const data = {
                id: 'furn_restored_101',
                type: 'furniture',
                configId: 'table_dining',
                x: 400,
                y: 500,
                rotation: 180,
                width: 200,
                depth: 100,
                height: 78,
                elevation: 0,
                materials: { surface: 'marble_carrara_white' },
                params: { extendable: true },
                hostPlatformId: 'patio_deck',
                hostFurnitureId: null,
                relativeElevation: 0,
                description: 'Grand Marble Dining Table'
            };

            const restored = FurnitureEngine.deserialize(mockPlanner, data, { addToPlanner: true });

            expect(restored).toBeDefined();
            expect(restored.id).toBe('furn_restored_101');
            expect(restored.width).toBe(200);
            expect(restored.depth).toBe(100);
            expect(restored.height).toBe(78);
            expect(restored.rotation).toBe(180);
            expect(restored.materials.surface).toBe('marble_carrara_white');
            expect(restored.params.extendable).toBe(true);
            expect(restored.hostPlatformId).toBe('patio_deck');
            expect(mockPlanner.furniture).toContain(restored);
        });

        it('should generate fallback ID when deserializing legacy data missing ID', () => {
            const legacyData = {
                configId: 'decor_plant_monstera',
                x: 100,
                y: 100,
                width: 60,
                depth: 60,
                height: 120
            };

            const restored = FurnitureEngine.deserialize(mockPlanner, legacyData);
            expect(restored.id).toBeDefined();
            expect(restored.id.startsWith('furn_')).toBe(true);
        });
    });

    describe('4. Entity Deletion & Cleanup', () => {
        it('should safely remove entity, dispose 3D mesh, destroy Konva group, and clear selection', () => {
            const furn = FurnitureEngine.createFurniture(mockPlanner, {
                id: 'furn_to_delete',
                addToPlanner: true,
                select: true
            });

            // Mock 3D mesh
            const mockParent = {
                remove: (child) => { mockParent.children = mockParent.children.filter(c => c !== child); },
                children: []
            };
            furn.mesh3D = { parent: mockParent };
            mockParent.children.push(furn.mesh3D);

            let groupDestroyed = false;
            furn.group.destroy = () => { groupDestroyed = true; };

            expect(mockPlanner.furniture.length).toBe(1);
            expect(mockPlanner.selectedEntity).toBe(furn);

            const result = FurnitureEngine.deleteFurniture(mockPlanner, furn);

            expect(result).toBe(true);
            expect(mockPlanner.furniture.length).toBe(0);
            expect(mockPlanner.selectedEntity).toBeNull();
            expect(mockParent.children.length).toBe(0);
            expect(groupDestroyed).toBe(true);
        });
    });

    describe('5. Duplication with Offset', () => {
        it('should duplicate furniture with offset, fresh ID, and deep-cloned properties', () => {
            const source = FurnitureEngine.createFurniture(mockPlanner, {
                id: 'original_sofa',
                x: 100,
                y: 100,
                configId: 'sofa_modern',
                width: 200,
                depth: 90,
                materials: { fabric: 'leather_brown' }
            });

            const duplicated = FurnitureEngine.duplicateFurniture(mockPlanner, source, { x: 30, y: 40 });

            expect(duplicated).toBeDefined();
            expect(duplicated.id).not.toBe(source.id);
            expect(duplicated.id.startsWith('furn_')).toBe(true);
            expect(duplicated.group.x()).toBe(130);
            expect(duplicated.group.y()).toBe(140);
            expect(duplicated.width).toBe(200);
            expect(duplicated.depth).toBe(90);
            expect(duplicated.materials.fabric).toBe('leather_brown');
            expect(mockPlanner.furniture.length).toBe(2);
        });
    });

    describe('6. Elimination of Zombie Entity Bugs in Commands', () => {
        it('CreateFurnitureCommand: should execute, undo, and redo without zombie nodes', () => {
            const cmd = new CreateFurnitureCommand(mockPlanner, 120, 180, 'chair', 'cmd_chair_1');

            // 1. Initial Execute
            cmd.execute();
            expect(mockPlanner.furniture.length).toBe(1);
            const initialEntity = mockPlanner.furniture[0];
            expect(initialEntity.id).toBe('cmd_chair_1');

            // 2. Undo - should remove and clean up
            cmd.undo();
            expect(mockPlanner.furniture.length).toBe(0);
            expect(cmd.createdEntity).toBeNull();

            // 3. Redo - should safely recreate active entity from serialized state, retaining ID
            cmd.execute();
            expect(mockPlanner.furniture.length).toBe(1);
            const recreatedEntity = mockPlanner.furniture[0];
            expect(recreatedEntity.id).toBe('cmd_chair_1');
            expect(recreatedEntity.group).toBeDefined();
            expect(typeof recreatedEntity.group.show).toBe('function');
        });

        it('DeleteEntityCommand: should delete, restore on undo, and re-delete on redo without zombie nodes', () => {
            const furn = FurnitureEngine.createFurniture(mockPlanner, {
                id: 'del_furn_1',
                x: 200,
                y: 200,
                configId: 'table_dining'
            });
            expect(mockPlanner.furniture.length).toBe(1);

            const cmd = new DeleteEntityCommand(mockPlanner, 'del_furn_1');

            // 1. Execute Delete
            cmd.execute();
            expect(mockPlanner.furniture.length).toBe(0);

            // 2. Undo Delete - should restore with full Konva group and identical ID
            cmd.undo();
            expect(mockPlanner.furniture.length).toBe(1);
            const restored = mockPlanner.furniture[0];
            expect(restored.id).toBe('del_furn_1');
            expect(restored.configId).toBe('table_dining');
            expect(restored.group).toBeDefined();

            // 3. Redo Delete
            cmd.execute();
            expect(mockPlanner.furniture.length).toBe(0);
        });

        it('DuplicateEntityCommand: should duplicate, undo, and redo without zombie nodes', () => {
            const source = FurnitureEngine.createFurniture(mockPlanner, {
                id: 'source_chair',
                x: 100,
                y: 100,
                configId: 'chair'
            });
            expect(mockPlanner.furniture.length).toBe(1);

            const cmd = new DuplicateEntityCommand(mockPlanner, 'source_chair', 'dup_chair_id');

            // 1. Execute Duplicate
            cmd.execute();
            expect(mockPlanner.furniture.length).toBe(2);
            const duplicated = mockPlanner.furniture.find(f => f.id === 'dup_chair_id');
            expect(duplicated).toBeDefined();

            // 2. Undo Duplicate - should clean up duplicated instance
            cmd.undo();
            expect(mockPlanner.furniture.length).toBe(1);
            expect(mockPlanner.furniture[0].id).toBe('source_chair');

            // 3. Redo Duplicate - should restore duplicated instance safely
            cmd.execute();
            expect(mockPlanner.furniture.length).toBe(2);
            const reduplicated = mockPlanner.furniture.find(f => f.id === 'dup_chair_id');
            expect(reduplicated).toBeDefined();
            expect(reduplicated.group).toBeDefined();
        });
    });

    describe('7. ExportState & LoadState Integrity', () => {
        it('should preserve entity id, materials, and vertical hosts across exportState and loadState', () => {
            const container1 = document.createElement('div');
            const planner = new FloorPlanner(container1);
            
            // Create furniture using FurnitureEngine
            const furn1 = FurnitureEngine.createFurniture(planner, {
                id: 'chair_persistent_123',
                x: 100,
                y: 150,
                configId: 'chair',
                width: 60,
                depth: 60,
                height: 85,
                elevation: 10,
                rotation: 45,
                materials: { cushion: 'fabric_linen_gray' },
                hostPlatformId: 'plat_001',
                hostFurnitureId: 'table_001',
                relativeElevation: 10,
                description: 'Dining Chair'
            });

            // Export state
            const exported = JSON.parse(planner.exportState());
            expect(exported.furniture).toBeDefined();
            expect(exported.furniture.length).toBe(1);

            const exportedFurn = exported.furniture[0];
            expect(exportedFurn.id).toBe('chair_persistent_123');
            expect(exportedFurn.materials.cushion).toBe('fabric_linen_gray');
            expect(exportedFurn.hostPlatformId).toBe('plat_001');
            expect(exportedFurn.hostFurnitureId).toBe('table_001');

            // Clear and load state into a new planner
            const container2 = document.createElement('div');
            const newPlanner = new FloorPlanner(container2);
            newPlanner.importState(exported);

            expect(newPlanner.furniture.length).toBe(1);
            const loadedFurn = newPlanner.furniture[0];
            expect(loadedFurn.id).toBe('chair_persistent_123');
            expect(loadedFurn.width).toBe(60);
            expect(loadedFurn.depth).toBe(60);
            expect(loadedFurn.height).toBe(85);
            expect(loadedFurn.elevation).toBe(10);
            expect(loadedFurn.rotation).toBe(45);
            expect(loadedFurn.materials.cushion).toBe('fabric_linen_gray');
            expect(loadedFurn.hostPlatformId).toBe('plat_001');
            expect(loadedFurn.hostFurnitureId).toBe('table_001');
            expect(loadedFurn.relativeElevation).toBe(10);
            expect(loadedFurn.description).toBe('Dining Chair');
        });
    });
});

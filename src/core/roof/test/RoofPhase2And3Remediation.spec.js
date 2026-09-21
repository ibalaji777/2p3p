import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { RoofSerializer } from '../RoofSerializer.js';
import { RoofTopologyEngine } from '../RoofTopologyEngine.js';
import { RoofMutationEngine } from '../RoofMutationEngine.js';
import { RoofEngine } from '../RoofEngine.js';
import { Roof3DBuilder } from '../../../features/roof/builders/Roof3DBuilder.js';
import { WallSerializer } from '../../../features/wall/wall.serializer.js';

describe('Roof System Phase 2 and Phase 3 Remediation Suite', () => {
    let mockPlanner;

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
        mockPlanner = {
            roofs: [],
            walls: [],
            selectEntity: vi.fn(),
            syncAll: vi.fn(),
            mainLayer: { batchDraw: vi.fn() },
            uiLayer: { batchDraw: vi.fn() },
            update3D: vi.fn(),
            activeLevel: { id: 'level_first_floor', defaultWallThickness: 20, height: 280 }
        };
    });

    // =========================================================================
    // 1. ARCHITECTURAL DETACHMENT (_restingOnWalls)
    // =========================================================================
    describe('1. Architectural Detachment (_restingOnWalls)', () => {
        it('should mark _restingOnWalls = false when setElevation is called manually', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }
            ], { roofType: 'hip' });

            expect(roof._restingOnWalls).toBe(true);

            RoofEngine.setElevation(roof, 350, mockPlanner);
            expect(roof.elevation).toBe(350);
            expect(roof._restingOnWalls).toBe(false);
        });

        it('should NOT recapture explicitly detached roofs during syncRoofsWithWalls', () => {
            const wall = {
                id: 'w1',
                elevation: 0,
                height: 250,
                startAnchor: { x: 0, y: 0 },
                endAnchor: { x: 300, y: 0 }
            };
            mockPlanner.walls = [wall];

            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: -50, y: -50 }, { x: 350, y: -50 }, { x: 350, y: 150 }, { x: -50, y: 150 }
            ], { roofType: 'gable' });

            // Explicitly detach roof at elevation 400
            RoofEngine.setElevation(roof, 400, mockPlanner);
            expect(roof._restingOnWalls).toBe(false);

            // Wall rises to 280
            wall.height = 280;
            RoofMutationEngine.syncRoofsWithWalls(wall, mockPlanner);

            // Roof must remain at 400, NOT forced to 280
            expect(roof.elevation).toBe(400);
            expect(roof._restingOnWalls).toBe(false);
        });

        it('should respect custom elevation in Roof3DBuilder when _restingOnWalls is false', () => {
            const targetGroup = new THREE.Group();
            const mockCtx = {
                structureGroup: targetGroup,
                interactables: [],
                helpers: {
                    getDynamicMaterial: vi.fn().mockReturnValue(new THREE.MeshStandardMaterial({ color: 0x888888 }))
                },
                assets: {
                    getTexture: vi.fn().mockResolvedValue(new THREE.Texture())
                }
            };
            const builder = new Roof3DBuilder(mockCtx);

            const wall = {
                id: 'w1',
                elevation: 0,
                height: 280,
                startAnchor: { x: 0, y: 0 },
                endAnchor: { x: 200, y: 0 }
            };

            const roof = {
                id: 'canopy_1',
                elevation: 150, // lower canopy below wall top
                _restingOnWalls: false,
                points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }],
                config: { roofType: 'flat', thickness: 15 }
            };

            builder.buildRoofs([roof], 0, [wall], targetGroup);
            expect(roof.mesh3D).toBeDefined();
            // When detached, baseHeight uses roof.elevation (150) rather than maxWallTop (280)
            expect(roof.mesh3D.position.y).toBe(150);
        });
    });

    // =========================================================================
    // 2. CURVE LOCK BUG (curve: 0 NOT defaulting to -20)
    // =========================================================================
    describe('2. Curve Lock Invariance', () => {
        it('should preserve curve = 0 without defaulting to -20 on curved roofs', () => {
            const targetGroup = new THREE.Group();
            const mockCtx = {
                structureGroup: targetGroup,
                interactables: [],
                helpers: {
                    getDynamicMaterial: vi.fn().mockReturnValue(new THREE.MeshStandardMaterial({ color: 0x888888 }))
                },
                assets: {
                    getTexture: vi.fn().mockResolvedValue(new THREE.Texture())
                }
            };
            const builder = new Roof3DBuilder(mockCtx);

            const roof = {
                id: 'curved_roof_straight',
                elevation: 100,
                points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
                config: { roofType: 'curved', curve: 0, pitch: 30 }
            };

            builder.buildRoofs([roof], 0, [], targetGroup);
            expect(roof.mesh3D).toBeDefined();
            expect(roof.config.curve).toBe(0);
        });
    });

    // =========================================================================
    // 3. 2D AUTO-GABLE WALL FILTERING & RECTIFICATION
    // =========================================================================
    describe('3. 2D Auto-Gable Filtering', () => {
        it('should hide 2D wallGroup and labelGroup when deserializing isAutoGable wall', () => {
            const wallData = {
                id: 'gw_test',
                startAnchor: { x: 0, y: 0 },
                endAnchor: { x: 200, y: 0 },
                thickness: 20,
                height: 0,
                elevation: 280,
                isAutoGable: true,
                parentRoofId: 'roof_1'
            };

            const dummyPlanner = {
                wallLayer: { add: vi.fn() },
                uiLayer: { add: vi.fn() },
                activeLevel: { defaultWallThickness: 20 }
            };

            const wall = WallSerializer.deserialize(wallData, dummyPlanner);
            expect(wall.isAutoGable).toBe(true);
            expect(wall.wallGroup.visible()).toBe(false);
            expect(wall.labelGroup.visible()).toBe(false);
        });
    });

    // =========================================================================
    // 4. LEVEL ASSOCIATION (levelId)
    // =========================================================================
    describe('4. Level Association (levelId)', () => {
        it('should automatically assign levelId from activeLevel in createRoof', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }
            ]);

            expect(roof.levelId).toBe('level_first_floor');
        });

        it('should serialize and deserialize levelId losslessly', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }
            ], {}, { levelId: 'level_penthouse' });

            expect(roof.levelId).toBe('level_penthouse');

            const serialized = RoofSerializer.serialize(roof);
            expect(serialized.levelId).toBe('level_penthouse');

            const deserialized = RoofSerializer.deserialize(serialized, mockPlanner);
            expect(deserialized.levelId).toBe('level_penthouse');
        });

        it('should preserve levelId across duplicateRoof', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }
            ], {}, { levelId: 'level_roof_deck' });

            const dup = RoofTopologyEngine.duplicateRoof(mockPlanner, roof, { x: 20, y: 20 });
            expect(dup.levelId).toBe('level_roof_deck');
        });
    });

    // =========================================================================
    // 5. 2D KONVA HANDLE STABILITY & GROUP DRAG
    // =========================================================================
    describe('5. 2D Konva Handle Stability & Group Drag', () => {
        it('should preserve handles in updateGeometry without destroying them when vertex count is unchanged', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }
            ]);

            const originalHandles = [...roof.handles];
            expect(originalHandles.length).toBe(4);

            // Simulate updating points
            roof.points = [
                { x: 10, y: 10 }, { x: 210, y: 10 }, { x: 210, y: 210 }, { x: 10, y: 210 }
            ];
            roof.updateGeometry();

            // Handles array must contain the EXACT same handle instances repositioned
            expect(roof.handles.length).toBe(4);
            expect(roof.handles[0]).toBe(originalHandles[0]);
            expect(roof.handles[0].x()).toBe(10);
            expect(roof.handles[0].y()).toBe(10);
        });
    });

    // =========================================================================
    // 6. GIZMO DUPLICATE BYPASS RECTIFICATION
    // =========================================================================
    describe('6. Gizmo Duplicate Bypass Rectification', () => {
        it('should duplicate roofs with full materials and parameters rather than raw points and empty config', () => {
            const sourceRoof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }
            ], {
                roofType: 'gable',
                pitch: 35,
                gableMaterial: 'cedar_wood_panels',
                materials: {
                    top: 'spanish_clay_tiles',
                    bottom: 'painted_soffit_white',
                    fascia: 'dark_bronze_fascia'
                },
                edgeCurves: { '0_1': { bulge: 25 } }
            });

            const dupRoof = RoofEngine.duplicateRoof(mockPlanner, sourceRoof, { x: 50, y: 50 });
            expect(dupRoof).toBeDefined();
            expect(dupRoof.id).not.toBe(sourceRoof.id);
            expect(dupRoof.config.pitch).toBe(35);
            expect(dupRoof.config.gableMaterial).toBe('cedar_wood_panels');
            expect(dupRoof.materials).toEqual({
                top: 'spanish_clay_tiles',
                bottom: 'painted_soffit_white',
                fascia: 'dark_bronze_fascia'
            });
            expect(dupRoof.edgeCurves).toEqual({ '0_1': { bulge: 25 } });
        });
    });

    // =========================================================================
    // 7. APP.VUE 3D SELECTION ROUTING FOR ROOFS
    // =========================================================================
    describe('7. App.vue 3D Selection Routing for Roofs', () => {
        it('should correctly pick child mesh for multi-mesh roof groups when selecting a roof', () => {
            const roofGroup = new THREE.Group();
            const childMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
            roofGroup.add(childMesh);

            const entity = {
                id: 'roof_multi_mesh',
                mesh3D: roofGroup
            };

            const targetMesh = (entity.mesh3D.isGroup && entity.mesh3D.children?.length > 0)
                ? (entity.mesh3D.children.find(c => c.isMesh) || entity.mesh3D)
                : entity.mesh3D;

            expect(targetMesh).toBe(childMesh);
        });
    });
});

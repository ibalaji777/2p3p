import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { RoofSerializer } from '../RoofSerializer.js';
import { RoofTopologyEngine } from '../RoofTopologyEngine.js';
import { RoofEngine } from '../RoofEngine.js';
import { WallEngine } from '../../wall/WallEngine.js';

describe('Roof System Phase 1 Remediation (Priority P0 Quality Gate)', () => {
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
            update3D: vi.fn()
        };
    });

    // =========================================================================
    // 1. PARAMETRIC PERSISTENCE & SERIALIZATION ROUNDTRIP (BUG 02)
    // =========================================================================
    describe('1. Parametric Persistence & Serialization Roundtrip', () => {
        it('should losslessly serialize and deserialize all modern curved portal and fillet properties', () => {
            const initialPoints = [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ];

            const initialConfig = {
                roofType: 'curved_portal',
                pitch: 0,
                thickness: 20,
                overhang: 15,
                radius: 65,
                wallSides: { front: false, back: true, left: true, right: true },
                wallDropHeight: 90,
                connectedWallId: 'wall_host_999',
                hasSpotlights: true,
                spotlightCount: 8,
                spotlightSpacing: 75,
                edgeCurves: [{ edgeIndex: 0, curve: 12 }],
                materials: {
                    outer: 'concrete_modern',
                    ceiling: 'wood_soffit_oak',
                    fascia: 'metal_dark_trim'
                }
            };

            const createdRoof = RoofTopologyEngine.createRoof(
                mockPlanner,
                initialPoints,
                initialConfig,
                { id: 'roof_test_portal_1', elevation: 280, rotation: 45 }
            );

            expect(createdRoof).toBeDefined();
            expect(createdRoof.id).toBe('roof_test_portal_1');

            // Serialize
            const serialized = RoofSerializer.serialize(createdRoof);
            expect(serialized).toBeDefined();
            expect(serialized.id).toBe('roof_test_portal_1');
            expect(serialized.radius).toBe(65);
            expect(serialized.wallSides).toEqual({ front: false, back: true, left: true, right: true });
            expect(serialized.wallDropHeight).toBe(90);
            expect(serialized.connectedWallId).toBe('wall_host_999');
            expect(serialized.hasSpotlights).toBe(true);
            expect(serialized.spotlightCount).toBe(8);
            expect(serialized.spotlightSpacing).toBe(75);
            expect(serialized.edgeCurves).toEqual([{ edgeIndex: 0, curve: 12 }]);
            expect(serialized.materials).toEqual({
                outer: 'concrete_modern',
                ceiling: 'wood_soffit_oak',
                fascia: 'metal_dark_trim'
            });

            // Clean planner and deserialize
            const planner2 = { roofs: [], selectEntity: vi.fn() };
            const restoredRoof = RoofSerializer.deserialize(serialized, planner2);

            expect(restoredRoof).toBeDefined();
            expect(restoredRoof.id).toBe('roof_test_portal_1');
            expect(restoredRoof.elevation).toBe(280);
            expect(restoredRoof.rotation).toBe(45);
            expect(restoredRoof.radius).toBe(65);
            expect(restoredRoof.wallSides).toEqual({ front: false, back: true, left: true, right: true });
            expect(restoredRoof.wallDropHeight).toBe(90);
            expect(restoredRoof.connectedWallId).toBe('wall_host_999');
            expect(restoredRoof.hasSpotlights).toBe(true);
            expect(restoredRoof.spotlightCount).toBe(8);
            expect(restoredRoof.spotlightSpacing).toBe(75);
            expect(restoredRoof.edgeCurves).toEqual([{ edgeIndex: 0, curve: 12 }]);
            expect(restoredRoof.materials).toEqual({
                outer: 'concrete_modern',
                ceiling: 'wood_soffit_oak',
                fascia: 'metal_dark_trim'
            });
        });
    });

    // =========================================================================
    // 2. STRUCTURAL DUPLICATION (BUG 02)
    // =========================================================================
    describe('2. Structural Duplication with Deep Parameter Cloning', () => {
        it('should clone all modern parameters independently without shared reference leakage', () => {
            const originalRoof = RoofTopologyEngine.createRoof(
                mockPlanner,
                [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }],
                {
                    roofType: 'curved_portal',
                    radius: 50,
                    wallSides: { front: true, back: false, left: true, right: false },
                    wallDropHeight: 60,
                    hasSpotlights: true,
                    materials: { outer: 'tile_stone' }
                },
                { id: 'roof_orig_1', elevation: 250 }
            );

            const clone = RoofTopologyEngine.duplicateRoof(mockPlanner, originalRoof, { x: 50, y: 50 });

            expect(clone).toBeDefined();
            expect(clone.id).not.toBe(originalRoof.id);
            expect(clone.x).toBe(50);
            expect(clone.y).toBe(50);
            expect(clone.radius).toBe(50);
            expect(clone.wallDropHeight).toBe(60);
            expect(clone.hasSpotlights).toBe(true);
            expect(clone.wallSides).toEqual({ front: true, back: false, left: true, right: false });

            // Mutate clone and assert original is completely untouched (deep independence)
            clone.radius = 80;
            clone.wallSides.front = false;
            clone.materials.outer = 'metal_zinc';

            expect(originalRoof.radius).toBe(50);
            expect(originalRoof.config.wallSides.front).toBe(true);
            expect(originalRoof.config.materials.outer).toBe('tile_stone');
        });
    });

    // =========================================================================
    // 3. ROTATION INVARIANCE TRANSFORMATION MATH (BUG 03)
    // =========================================================================
    describe('3. Rotation Invariance Transformation Math across 3D Angles', () => {
        /**
         * Mathematical verification of the inverse transformation:
         * In Three.js: roofGroup.rotation.y = -rot * Math.PI / 180
         * To transform a world-space delta (worldDeltaX, worldDeltaZ) to local coordinates:
         * localDeltaX = worldDeltaX * cos(rad) + worldDeltaZ * sin(rad)
         * localDeltaZ = -worldDeltaX * sin(rad) + worldDeltaZ * cos(rad)
         */
        const transformWorldToLocal = (worldDeltaX, worldDeltaZ, rotDeg) => {
            const rad = rotDeg * Math.PI / 180;
            const localDeltaX = worldDeltaX * Math.cos(rad) + worldDeltaZ * Math.sin(rad);
            const localDeltaZ = -worldDeltaX * Math.sin(rad) + worldDeltaZ * Math.cos(rad);
            return {
                x: Math.round(localDeltaX * 1e6) / 1e6,
                z: Math.round(localDeltaZ * 1e6) / 1e6
            };
        };

        it('should produce identical deltas at 0 degrees yaw', () => {
            const res = transformWorldToLocal(10, 20, 0);
            expect(res.x).toBe(10);
            expect(res.z).toBe(20);
        });

        it('should correctly map world +Z to local +X at 90 degrees yaw (NO INVERSION)', () => {
            // At 90 deg yaw: Three.js rotation = -90 deg around Y.
            // Local +X rotated by -90 deg points along World +Z.
            // Therefore, a pointer drag along World +Z (0, 1) MUST produce Local +X (1, 0).
            const res = transformWorldToLocal(0, 1, 90);
            expect(res.x).toBe(1);
            expect(res.z).toBe(0);
        });

        it('should correctly map world -X to local +X at 180 degrees yaw', () => {
            // At 180 deg yaw: Local +X points along World -X.
            // A pointer drag along World -X (-1, 0) MUST produce Local +X (1, 0).
            const res = transformWorldToLocal(-1, 0, 180);
            expect(res.x).toBe(1);
            expect(res.z).toBe(0);
        });

        it('should correctly map world -Z to local +X at 270 degrees yaw', () => {
            // At 270 deg yaw: Local +X points along World -Z.
            // A pointer drag along World -Z (0, -1) MUST produce Local +X (1, 0).
            const res = transformWorldToLocal(0, -1, 270);
            expect(res.x).toBe(1);
            expect(res.z).toBe(0);
        });
    });

    // =========================================================================
    // 4. CASCADE AUTO-GABLE DELETION RESILIENCE (BUG 06)
    // =========================================================================
    describe('4. Cascade Auto-Gable Deletion Resilience', () => {
        it('should cleanly remove associated auto-gable walls when roof is deleted', () => {
            const roof = RoofTopologyEngine.createRoof(
                mockPlanner,
                [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }],
                { roofType: 'gable', autoShapeWalls: true },
                { id: 'gable_roof_test_1' }
            );

            // Simulate auto-gable wall created for this roof
            const autoGableWall = {
                id: 'gable_wall_1',
                isAutoGable: true,
                parentRoofId: roof.id,
                wallGroup: { destroy: vi.fn() },
                mesh3D: { traverse: vi.fn(), parent: { remove: vi.fn() } }
            };
            mockPlanner.walls.push(autoGableWall);

            expect(mockPlanner.walls.length).toBe(1);
            expect(mockPlanner.roofs.length).toBe(1);

            // Execute deleteRoof
            const deleted = RoofTopologyEngine.deleteRoof(mockPlanner, roof);

            expect(deleted).toBe(true);
            expect(mockPlanner.roofs.length).toBe(0);
            // The auto-gable wall must be removed from planner.walls
            expect(mockPlanner.walls.length).toBe(0);
        });
    });

    // =========================================================================
    // 5. IN-PLACE LIVE UPDATE ON MULTI-MESH GROUPS (BUG 01)
    // =========================================================================
    describe('5. In-Place Live Update on Multi-Mesh Groups (EnvironmentBuilder.updateRoofLive)', () => {
        it('should update multi-mesh Groups in place without geometry/material property errors', async () => {
            const { EnvironmentBuilder } = await import('../../engine3d/EnvironmentBuilder.js');
            const { ComponentRegistry } = await import('../../engine3d/ComponentRegistry.js');

            const mockCtx = {
                walls: [],
                shapes: [],
                interactables: [],
                requestRender: vi.fn(),
                interactions: { selectedObject: null },
                deepDispose: vi.fn()
            };

            const envBuilder = new EnvironmentBuilder(mockCtx);

            const roof = {
                id: 'roof_group_test',
                type: 'roof',
                config: { roofType: 'curved_portal' },
                points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }]
            };

            // Setup existing realRoofGroup containing a THREE.Group for curved_portal
            const realRoofGroup = new THREE.Group();
            realRoofGroup.userData = { isRoof: true, isRoofGroup: true, entity: roof, roofId: roof.id };

            const oldPortalGroup = new THREE.Group();
            oldPortalGroup.userData = { isRoof: true, entity: roof, componentType: 'curved_portal' };

            const oldChildMesh = new THREE.Mesh(
                new THREE.BoxGeometry(10, 10, 10),
                new THREE.MeshBasicMaterial()
            );
            oldChildMesh.userData = { isRoof: true, entity: roof, materialSlot: 'outer' };
            oldPortalGroup.add(oldChildMesh);
            realRoofGroup.add(oldPortalGroup);

            roof.mesh3D = realRoofGroup;
            mockCtx.interactions.selectedObject = oldPortalGroup;
            mockCtx.interactables.push(oldChildMesh);

            // Mock envBuilder.buildRoofs to simulate procedural rebuild into tempTarget
            envBuilder.buildRoofs = vi.fn((roofs, idx, walls, targetGroup) => {
                const tempRoofGroup = new THREE.Group();
                tempRoofGroup.position.set(10, 20, 30);
                tempRoofGroup.rotation.set(0, 0.5, 0);

                const newPortalGroup = new THREE.Group();
                newPortalGroup.userData = { isRoof: true, entity: roof, componentType: 'curved_portal' };

                const newChildMesh = new THREE.Mesh(
                    new THREE.BoxGeometry(20, 20, 20),
                    new THREE.MeshBasicMaterial()
                );
                newChildMesh.userData = { isRoof: true, entity: roof, materialSlot: 'outer' };
                newPortalGroup.add(newChildMesh);
                tempRoofGroup.add(newPortalGroup);

                targetGroup.add(tempRoofGroup);
            });

            // Execute updateRoofLive
            expect(() => envBuilder.updateRoofLive(roof)).not.toThrow();

            // Verification
            expect(realRoofGroup.position.x).toBe(10);
            expect(realRoofGroup.position.y).toBe(20);
            expect(realRoofGroup.position.z).toBe(30);

            // The persistent oldPortalGroup must now have the updated child geometry
            expect(oldPortalGroup.children.length).toBe(1);
            expect(oldPortalGroup.children[0].geometry.parameters.width).toBe(20);

            // Selection reference must remain intact and pointing to active target
            expect(mockCtx.interactions.selectedObject).toBe(oldPortalGroup);

            // Interactables must be synchronized
            expect(mockCtx.interactables.length).toBe(1);
            expect(mockCtx.interactables[0]).toBe(oldPortalGroup.children[0]);
        });

        it('should handle transition between single Mesh and multi-mesh Group without errors', async () => {
            const { EnvironmentBuilder } = await import('../../engine3d/EnvironmentBuilder.js');

            const mockCtx = {
                walls: [],
                shapes: [],
                interactables: [],
                requestRender: vi.fn(),
                interactions: { selectedObject: null },
                deepDispose: vi.fn()
            };

            const envBuilder = new EnvironmentBuilder(mockCtx);

            const roof = {
                id: 'roof_transition_test',
                type: 'roof',
                config: { roofType: 'flat' }
            };

            // Starts as a single Mesh (flat roof)
            const realRoofGroup = new THREE.Group();
            const oldSingleMesh = new THREE.Mesh(
                new THREE.BoxGeometry(100, 15, 100),
                new THREE.MeshBasicMaterial()
            );
            oldSingleMesh.userData = { isRoof: true, entity: roof };
            realRoofGroup.add(oldSingleMesh);
            roof.mesh3D = realRoofGroup;

            // Rebuild produces a multi-part Group (transition to curved_portal)
            envBuilder.buildRoofs = vi.fn((roofs, idx, walls, targetGroup) => {
                const tempRoofGroup = new THREE.Group();
                const newPortalGroup = new THREE.Group();
                newPortalGroup.userData = { isRoof: true, entity: roof, componentType: 'curved_portal' };

                const child1 = new THREE.Mesh(new THREE.BoxGeometry(50, 50, 50), new THREE.MeshBasicMaterial());
                child1.userData = { isRoof: true, entity: roof, materialSlot: 'outer' };
                newPortalGroup.add(child1);
                tempRoofGroup.add(newPortalGroup);

                targetGroup.add(tempRoofGroup);
            });

            expect(() => envBuilder.updateRoofLive(roof)).not.toThrow();

            // The single mesh must have been replaced with the new group inside realRoofGroup
            expect(realRoofGroup.children.length).toBe(1);
            expect(realRoofGroup.children[0].isGroup).toBe(true);
            expect(realRoofGroup.children[0].children.length).toBe(1);
        });
    });
});

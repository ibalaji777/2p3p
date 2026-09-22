import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialDependencyEngine, RELATIONSHIP_TYPES } from '../SpatialDependencyEngine.js';

describe('SpatialDependencyEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new SpatialDependencyEngine();
    });

    describe('Kinematics (Forward & Inverse)', () => {
        it('should compute world transform correctly with pure translation', () => {
            const host = { x: 100, y: 200, elevation: 0, height: 20, rotation: 0 };
            const local = { x: 15, y: 25, elevation: 5, rotation: 0 };

            const world = SpatialDependencyEngine.computeWorldTransform(host, local);
            expect(world.x).toBe(115);
            expect(world.y).toBe(225);
            expect(world.elevation).toBe(25); // 0 + 20 + 5
            expect(world.rotation).toBe(0);
        });

        it('should compute world transform correctly with 90 degree host rotation', () => {
            const host = { x: 100, y: 200, elevation: 10, height: 15, rotation: 90 };
            const local = { x: 50, y: 0, elevation: 0, rotation: 45 };

            const world = SpatialDependencyEngine.computeWorldTransform(host, local);
            // Rotated 90 deg counter-clockwise: (50, 0) -> (0, 50)
            expect(world.x).toBe(100);
            expect(world.y).toBe(250);
            expect(world.elevation).toBe(25); // 10 + 15 + 0
            expect(world.rotation).toBe(135); // 90 + 45
        });

        it('should invert world transform back to local transform (Inverse Kinematics)', () => {
            const host = { x: 200, y: 300, elevation: 20, height: 30, rotation: 45 };
            const localExpected = { x: 40, y: -20, elevation: 10, rotation: 30 };

            const world = SpatialDependencyEngine.computeWorldTransform(host, localExpected);
            const localCalculated = SpatialDependencyEngine.computeLocalTransform(world, host);

            expect(localCalculated.x).toBeCloseTo(localExpected.x, 1);
            expect(localCalculated.y).toBeCloseTo(localExpected.y, 1);
            expect(localCalculated.elevation).toBeCloseTo(localExpected.elevation, 1);
            expect(localCalculated.rotation).toBeCloseTo(localExpected.rotation, 1);
        });
    });

    describe('Attachment, Detachment & Cycle Prevention', () => {
        it('should attach dependent to host and record relationship metadata', () => {
            const host = { id: 'platform-1', type: 'platform', x: 100, y: 100, elevation: 0, height: 20, rotation: 0 };
            const dependent = { id: 'sofa-1', type: 'furniture', x: 120, y: 130, elevation: 20, rotation: 0 };

            const success = engine.attach(dependent, host, {
                relationshipType: RELATIONSHIP_TYPES.SURFACE_ATTACHED,
                computeFromCurrentWorld: true
            });

            expect(success).toBe(true);
            expect(dependent.hostId).toBe('platform-1');
            expect(dependent.hostPlatformId).toBe('platform-1');
            expect(dependent.hostType).toBe('platform');
            expect(dependent.relationshipType).toBe(RELATIONSHIP_TYPES.SURFACE_ATTACHED);
            expect(dependent.localTransform).toBeDefined();
            expect(dependent.localTransform.x).toBe(20);
            expect(dependent.localTransform.y).toBe(30);
            expect(dependent.localTransform.elevation).toBe(0); // 20 - (0 + 20) = 0

            expect(engine.getDependents('platform-1')).toContain('sofa-1');
            expect(engine.getHostRecord('sofa-1')?.hostId).toBe('platform-1');
        });

        it('should detach dependent cleanly', () => {
            const host = { id: 'platform-1', type: 'platform', x: 100, y: 100, elevation: 0, height: 20, rotation: 0 };
            const dependent = { id: 'sofa-1', type: 'furniture', x: 120, y: 130, elevation: 20, rotation: 0 };

            engine.attach(dependent, host, { computeFromCurrentWorld: true });
            expect(engine.getDependents('platform-1')).toHaveLength(1);

            const detached = engine.detach(dependent);
            expect(detached).toBe(true);
            expect(dependent.hostId).toBeNull();
            expect(dependent.hostPlatformId).toBeNull();
            expect(dependent.localTransform).toBeNull();
            expect(engine.getDependents('platform-1')).toHaveLength(0);
            expect(engine.getHostRecord('sofa-1')).toBeNull();
        });

        it('should prevent self-attachment cycle (A -> A)', () => {
            const entity = { id: 'ent-1', type: 'platform' };
            const result = engine.attach(entity, entity);
            expect(result).toBe(false);
        });

        it('should prevent 2-node circular attachment (A -> B -> A)', () => {
            const a = { id: 'node-A', type: 'platform' };
            const b = { id: 'node-B', type: 'platform' };

            expect(engine.attach(b, a)).toBe(true);
            expect(engine.hasCycle('node-B', 'node-A')).toBe(true);
            expect(engine.attach(a, b)).toBe(false);
        });

        it('should prevent multi-node indirect circular attachment (A -> B -> C -> A)', () => {
            const a = { id: 'A', type: 'level' };
            const b = { id: 'B', type: 'platform' };
            const c = { id: 'C', type: 'stair' };

            expect(engine.attach(b, a)).toBe(true);
            expect(engine.attach(c, b)).toBe(true);
            expect(engine.hasCycle('C', 'A')).toBe(true);
            expect(engine.attach(a, c)).toBe(false);
        });
    });

    describe('Mutation Propagation (Forward Kinematics)', () => {
        it('should propagate host movement and rotation to dependents in 2D and 3D', () => {
            const host = {
                id: 'platform-1',
                type: 'platform',
                x: 100,
                y: 100,
                elevation: 0,
                height: 20,
                rotation: 0
            };

            const mockKonvaGroup = {
                _x: 120,
                _y: 130,
                _rot: 0,
                position(pos) {
                    if (pos) { this._x = pos.x; this._y = pos.y; }
                    return { x: this._x, y: this._y };
                },
                rotation(rot) {
                    if (rot !== undefined) this._rot = rot;
                    return this._rot;
                }
            };

            const mockMesh3D = {
                position: { x: 120, y: 20, z: 130, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
                rotation: { y: 0 },
                updateMatrixWorld: () => {}
            };

            const dependent = {
                id: 'furniture-1',
                type: 'furniture',
                x: 120,
                y: 130,
                elevation: 20,
                rotation: 0,
                group: mockKonvaGroup,
                mesh3D: mockMesh3D
            };

            const planner = {
                platforms: [host],
                furniture: [dependent],
                renderer3D: { realtimeUpdate: { markDirty: () => {} } }
            };

            engine.attach(dependent, host, { computeFromCurrentWorld: true });

            // Move host platform by dx: +50, dy: +50, dElev: +10, dRot: 90
            host.x = 150;
            host.y = 150;
            host.elevation = 10;
            host.rotation = 90;

            engine.onHostTransformed(host, planner);

            // Host is at (150, 150), rot 90, top = 10 + 20 = 30.
            // Local offset was (20, 30, elev: 0, rot: 0).
            // Rotated by 90 deg: deltaX = -30, deltaY = 20.
            // World pos: (150 - 30, 150 + 20) = (120, 170).
            // Elevation: 30 + 0 = 30.
            // Rotation: 90 + 0 = 90.
            expect(dependent.x).toBe(120);
            expect(dependent.y).toBe(170);
            expect(dependent.elevation).toBe(30);
            expect(dependent.rotation).toBe(90);

            // In-place 2D Konva sync
            expect(mockKonvaGroup.position().x).toBe(120);
            expect(mockKonvaGroup.position().y).toBe(170);
            expect(mockKonvaGroup.rotation()).toBe(90);

            // In-place 3D Three.js sync (x, elevation, y)
            expect(mockMesh3D.position.x).toBe(120);
            expect(mockMesh3D.position.y).toBe(30);
            expect(mockMesh3D.position.z).toBe(170);
            expect(mockMesh3D.rotation.y).toBeCloseTo((-90 * Math.PI) / 180);
        });

        it('should adapt staircase height when supporting platform height changes', () => {
            const hostPlatform = {
                id: 'plat-1',
                type: 'platform',
                x: 0,
                y: 0,
                elevation: 0,
                height: 40,
                rotation: 0
            };

            let stairUpdated = false;
            const stair = {
                id: 'stair-1',
                type: 'staircase_straight',
                shape: 'straight',
                x: 0,
                y: 100,
                elevation: 0,
                height: 40,
                baseElevation: 0,
                update() { stairUpdated = true; }
            };

            const planner = {
                platforms: [hostPlatform],
                stairs: [stair]
            };

            engine.attach(stair, hostPlatform, {
                relationshipType: RELATIONSHIP_TYPES.SUPPORTED,
                computeFromCurrentWorld: true
            });

            // Platform height rises from 40 to 90
            hostPlatform.height = 90;
            engine.onHostTransformed(hostPlatform, planner);

            expect(stair.height).toBe(90);
            expect(stairUpdated).toBe(true);
        });

        it('should support multi-level cascading propagation (Platform -> SubPlatform -> Furniture)', () => {
            const parentPlat = { id: 'p1', type: 'platform', x: 100, y: 100, elevation: 0, height: 20, rotation: 0 };
            const childPlat = { id: 'p2', type: 'platform', x: 120, y: 120, elevation: 20, height: 15, rotation: 0 };
            const grandChildFurn = { id: 'f1', type: 'furniture', x: 130, y: 130, elevation: 35, rotation: 0 };

            const planner = {
                platforms: [parentPlat, childPlat],
                furniture: [grandChildFurn]
            };

            engine.attach(childPlat, parentPlat, { computeFromCurrentWorld: true });
            engine.attach(grandChildFurn, childPlat, { computeFromCurrentWorld: true });

            // Move root parent platform by (+50, +100)
            parentPlat.x = 150;
            parentPlat.y = 200;
            engine.onHostTransformed(parentPlat, planner);

            // Child platform should move
            expect(childPlat.x).toBe(170);
            expect(childPlat.y).toBe(220);

            // Grandchild furniture should cascade-move
            expect(grandChildFurn.x).toBe(180);
            expect(grandChildFurn.y).toBe(230);
        });
    });

    describe('Host Deletion & Orphan Handling', () => {
        it('should ground surface-attached objects to elevation 0 when host is deleted', () => {
            const host = { id: 'plat-1', type: 'platform', x: 100, y: 100, elevation: 0, height: 50 };
            const furn = {
                id: 'furn-1',
                type: 'furniture',
                x: 100,
                y: 100,
                elevation: 50,
                mesh3D: { position: { y: 50 } }
            };

            const planner = { platforms: [host], furniture: [furn] };

            engine.attach(furn, host, { computeFromCurrentWorld: true });
            expect(furn.hostId).toBe('plat-1');

            engine.onHostDeleted(host, planner);

            expect(furn.hostId).toBeNull();
            expect(furn.elevation).toBe(0);
            expect(furn.mesh3D.position.y).toBe(0);
            expect(engine.getDependents('plat-1')).toHaveLength(0);
        });
    });

    describe('Rebuild from Planner State', () => {
        it('should rebuild graph correctly from planner entities with hostPlatformId', () => {
            const hostPlatform = { id: 'plat-10', type: 'platform', x: 200, y: 200, elevation: 0, height: 30, rotation: 0 };
            const childStair = {
                id: 'stair-10',
                type: 'staircase_straight',
                hostPlatformId: 'plat-10',
                localTransform: { x: 0, y: 50, elevation: 0, rotation: 0 }
            };
            const childFurn = {
                id: 'furn-10',
                type: 'furniture',
                hostId: 'plat-10',
                hostType: 'platform',
                localTransform: { x: 20, y: 20, elevation: 0, rotation: 0 }
            };

            const planner = {
                platforms: [hostPlatform],
                stairs: [childStair],
                furniture: [childFurn]
            };

            engine.rebuildFromPlanner(planner);

            const dependents = engine.getDependents('plat-10');
            expect(dependents).toContain('stair-10');
            expect(dependents).toContain('furn-10');
            expect(childStair.hostId).toBe('plat-10');
            expect(childFurn.hostId).toBe('plat-10');
        });
    });
});

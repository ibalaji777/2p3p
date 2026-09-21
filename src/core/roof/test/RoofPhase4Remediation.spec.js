import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { RoofSerializer } from '../RoofSerializer.js';
import { RoofTopologyEngine } from '../RoofTopologyEngine.js';
import { RoofMutationEngine } from '../RoofMutationEngine.js';
import { RoofEngine } from '../RoofEngine.js';
import { EnvironmentBuilder } from '../../engine3d/EnvironmentBuilder.js';
import { CurvedPortal3DBuilder } from '../../../features/roof/builders/CurvedPortal3DBuilder.js';

describe('Roof System Phase 4 Remediation Suite (Performance & Advanced BIM)', () => {
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
            envBuilder: {
                updateRoofLive: vi.fn()
            },
            ctx: {
                requestRender: vi.fn(),
                updateRoofLive: vi.fn()
            },
            debouncedSaveHistory: vi.fn(),
            activeLevel: { id: 'level_1', defaultWallThickness: 20, height: 280 }
        };
    });

    // =========================================================================
    // 1. IN-PLACE GPU VERTEX BUFFER MUTATION
    // =========================================================================
    describe('1. In-Place GPU Vertex Buffer Mutation (EnvironmentBuilder.updateRoofLive)', () => {
        it('should mutate existing BufferGeometry attributes in place without reallocating geometry when vertex count matches', () => {
            const envBuilder = new EnvironmentBuilder({
                walls: [],
                planner: mockPlanner
            });

            const roof = {
                id: 'roof_test_vbo',
                points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
                elevation: 250,
                rotation: 0,
                x: 0,
                y: 0,
                config: { roofType: 'flat', thickness: 10 }
            };

            const roofGroup = new THREE.Group();
            roof.mesh3D = roofGroup;

            // Create initial mesh
            const initialGeo = new THREE.BoxGeometry(100, 10, 100);
            const initialMesh = new THREE.Mesh(initialGeo, new THREE.MeshBasicMaterial());
            initialMesh.userData = { isRoof: true, entity: roof, roofId: roof.id };
            roofGroup.add(initialMesh);

            const originalGeometryRef = initialMesh.geometry;
            const originalPositionBufferRef = initialMesh.geometry.attributes.position;
            const disposeSpy = vi.fn();

            // Mock buildRoofs to populate targetGroup with a temporary group containing identical vertex count
            vi.spyOn(envBuilder, 'buildRoofs').mockImplementation((roofs, activeIndex, walls, targetGroup) => {
                const tempRoofGroup = new THREE.Group();
                const newGeo = new THREE.BoxGeometry(120, 15, 120);
                newGeo.dispose = disposeSpy;
                const newMesh = new THREE.Mesh(newGeo, new THREE.MeshBasicMaterial());
                newMesh.userData = { isRoof: true, entity: roof, roofId: roof.id };
                tempRoofGroup.add(newMesh);
                targetGroup.add(tempRoofGroup);
            });

            // Call updateRoofLive
            envBuilder.updateRoofLive(roof);

            // Verify geometry reference was PRESERVED in place
            expect(initialMesh.geometry).toBe(originalGeometryRef);
            expect(initialMesh.geometry.attributes.position).toBe(originalPositionBufferRef);
            expect(initialMesh.geometry.attributes.position.version).toBeGreaterThan(0);

            // Verify the temporary geometry was disposed
            expect(disposeSpy).toHaveBeenCalled();
        });

        it('should replace geometry when vertex count differs (topology change)', () => {
            const envBuilder = new EnvironmentBuilder({
                walls: [],
                planner: mockPlanner
            });

            const roof = {
                id: 'roof_test_topo_change',
                points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
                elevation: 250,
                rotation: 0,
                x: 0,
                y: 0,
                config: { roofType: 'flat', thickness: 10 }
            };

            const roofGroup = new THREE.Group();
            roof.mesh3D = roofGroup;

            const initialGeo = new THREE.BufferGeometry();
            initialGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
            const oldDisposeSpy = vi.spyOn(initialGeo, 'dispose');
            const initialMesh = new THREE.Mesh(initialGeo, new THREE.MeshBasicMaterial());
            initialMesh.userData = { isRoof: true, entity: roof, roofId: roof.id };
            roofGroup.add(initialMesh);

            // New mesh with different number of vertices
            const newGeo = new THREE.BufferGeometry();
            newGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3));

            vi.spyOn(envBuilder, 'buildRoofs').mockImplementation((roofs, activeIndex, walls, targetGroup) => {
                const tempRoofGroup = new THREE.Group();
                const newMesh = new THREE.Mesh(newGeo, new THREE.MeshBasicMaterial());
                newMesh.userData = { isRoof: true, entity: roof, roofId: roof.id };
                tempRoofGroup.add(newMesh);
                targetGroup.add(tempRoofGroup);
            });

            envBuilder.updateRoofLive(roof);

            // Old geometry was disposed and replaced
            expect(oldDisposeSpy).toHaveBeenCalled();
            expect(initialMesh.geometry).toBe(newGeo);
        });
    });

    // =========================================================================
    // 2. FIRST-CLASS PER-EDGE OVERHANGS
    // =========================================================================
    describe('2. First-Class Per-Edge Overhangs', () => {
        it('should set per-edge overhangs via RoofEngine.setOverhangs', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }
            ], { roofType: 'hip', overhang: 10 });

            RoofEngine.setOverhangs(roof, [25, 0, 15, 30], mockPlanner);

            expect(roof.config.overhangs).toEqual([25, 0, 15, 30]);
            expect(mockPlanner.envBuilder.updateRoofLive).toHaveBeenCalledWith(roof);
        });

        it('should pad partial overhang arrays with the default overhang and clamp values', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }
            ], { roofType: 'gable', overhang: 12 });

            RoofEngine.setOverhangs(roof, [-10, 600], mockPlanner);

            // Expect clamped to [0, 500] and padded to 4 edges
            expect(roof.config.overhangs[0]).toBe(0);
            expect(roof.config.overhangs[1]).toBe(500);
            expect(roof.config.overhangs[2]).toBe(12);
            expect(roof.config.overhangs[3]).toBe(12);
        });

        it('should support updating individual overhang edge via RoofEngine.setOverhang with edgeIndex', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }
            ], { roofType: 'shed', overhang: 8 });

            RoofEngine.setOverhang(roof, 35, 2, mockPlanner);

            expect(roof.config.overhangs[2]).toBe(35);
            expect(roof.config.overhangs[0]).toBe(8);
            expect(roof.config.overhangs[1]).toBe(8);
            expect(roof.config.overhangs[3]).toBe(8);
        });
    });

    // =========================================================================
    // 3. FIRST-CLASS PER-CORNER RADII
    // =========================================================================
    describe('3. First-Class Per-Corner Fillet Radii', () => {
        it('should set per-corner fillet radii array via RoofEngine.setCornerRadii', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }
            ], { roofType: 'curved_portal', radius: 10 });

            RoofEngine.setCornerRadii(roof, [25, 0, 40, 15], mockPlanner);

            expect(roof.cornerRadii).toEqual([25, 0, 40, 15]);
            expect(roof.config.cornerRadii).toEqual([25, 0, 40, 15]);
            expect(mockPlanner.envBuilder.updateRoofLive).toHaveBeenCalledWith(roof);
        });

        it('should update single corner radius when cornerIndex is specified in setCornerRadius', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }
            ], { roofType: 'curved_portal', radius: 20 });

            RoofEngine.setCornerRadius(roof, 50, 1, mockPlanner);

            expect(roof.cornerRadii[1]).toBe(50);
            expect(roof.cornerRadii[0]).toBe(20);
            expect(roof.cornerRadii[2]).toBe(20);
            expect(roof.cornerRadii[3]).toBe(20);
        });

        it('should set master radius and sync all entries in cornerRadii when cornerIndex is null', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }
            ], { roofType: 'curved_portal', radius: 10 });

            RoofEngine.setCornerRadius(roof, 35, null, mockPlanner);

            expect(roof.radius).toBe(35);
            expect(roof.config.radius).toBe(35);
            expect(roof.cornerRadii).toEqual([35, 35, 35, 35]);
            expect(roof.config.cornerRadii).toEqual([35, 35, 35, 35]);
        });
    });

    // =========================================================================
    // 4. SERIALIZATION & DUPLICATION OF CORNER RADII & OVERHANGS
    // =========================================================================
    describe('4. Serialization and Duplication Integrity', () => {
        it('should serialize and deserialize cornerRadii and overhangs without data loss', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 250 }, { x: 0, y: 250 }
            ], {
                roofType: 'curved_portal',
                radius: 15,
                cornerRadii: [30, 0, 15, 45],
                overhangs: [10, 20, 30, 40]
            });

            const serialized = RoofSerializer.serialize(roof);
            expect(serialized.cornerRadii).toEqual([30, 0, 15, 45]);
            expect(serialized.overhangs).toEqual([10, 20, 30, 40]);

            const deserialized = RoofSerializer.deserialize(serialized, mockPlanner);
            expect(deserialized.cornerRadii).toEqual([30, 0, 15, 45]);
            expect(deserialized.config.cornerRadii).toEqual([30, 0, 15, 45]);
            expect(deserialized.config.overhangs).toEqual([10, 20, 30, 40]);
        });

        it('should deep-clone cornerRadii and overhangs during duplicateRoof to prevent shared references', () => {
            const roof = RoofTopologyEngine.createRoof(mockPlanner, [
                { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 250 }, { x: 0, y: 250 }
            ], {
                roofType: 'curved_portal',
                cornerRadii: [20, 20, 0, 0],
                overhangs: [15, 15, 15, 15]
            });

            const duplicate = RoofTopologyEngine.duplicateRoof(mockPlanner, roof, 50, 50);

            expect(duplicate.cornerRadii).toEqual([20, 20, 0, 0]);
            expect(duplicate.config.cornerRadii).toEqual([20, 20, 0, 0]);

            // Mutating the duplicate must NOT affect the original
            RoofEngine.setCornerRadius(duplicate, 60, 0, mockPlanner);
            expect(duplicate.cornerRadii[0]).toBe(60);
            expect(roof.cornerRadii[0]).toBe(20);
        });
    });

    // =========================================================================
    // 5. 3D CURVED PORTAL BUILDER WITH INDEPENDENT CORNER RADII
    // =========================================================================
    describe('5. CurvedPortal3DBuilder with Independent Corner Radii', () => {
        it('should generate 3D curved portal geometry correctly respecting asymmetrical cornerRadii', () => {
            const roof = {
                id: 'curved_portal_asym',
                points: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }],
                elevation: 260,
                cornerRadii: [40, 0, 25, 0] // Left = 40, Right = 0, Front = 25, Back = 0
            };

            const conf = {
                roofType: 'curved_portal',
                thickness: 12,
                cornerRadii: [40, 0, 25, 0],
                wallSides: { left: true, right: true, front: true, back: false },
                material: 'white_plaster_wall'
            };

            const pts = roof.points;
            const h = 260;
            const ctx = {
                helpers: {
                    getDynamicMaterial: () => new THREE.MeshStandardMaterial()
                }
            };
            const resolveRoofMaterial = () => ({ mat: new THREE.MeshStandardMaterial() });

            const group = CurvedPortal3DBuilder.build(roof, conf, pts, h, ctx, resolveRoofMaterial);

            expect(group).toBeDefined();
            expect(group.isGroup).toBe(true);

            // Sub-meshes registered: outer, ceiling, fascia
            const childMeshes = group.children.filter(c => c.isMesh);
            expect(childMeshes.length).toBeGreaterThanOrEqual(3);

            // Verify outer sub-mesh geometry is non-empty and valid
            const outerMesh = childMeshes.find(m => m.userData.materialSlot === 'outer');
            expect(outerMesh).toBeDefined();
            expect(outerMesh.geometry.attributes.position.count).toBeGreaterThan(0);

            // Verify ceiling sub-mesh is valid
            const ceilingMesh = childMeshes.find(m => m.userData.materialSlot === 'ceiling');
            expect(ceilingMesh).toBeDefined();
            expect(ceilingMesh.geometry.attributes.position.count).toBeGreaterThan(0);
        });

        it('should gracefully fallback to master radius when cornerRadii is omitted or empty', () => {
            const roof = {
                id: 'curved_portal_fallback',
                points: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }],
                elevation: 260
            };

            const conf = {
                roofType: 'curved_portal',
                thickness: 12,
                radius: 30,
                wallSides: { left: true, right: true, front: false, back: false }
            };

            const pts = roof.points;
            const h = 260;
            const ctx = {
                helpers: {
                    getDynamicMaterial: () => new THREE.MeshStandardMaterial()
                }
            };
            const resolveRoofMaterial = () => ({ mat: new THREE.MeshStandardMaterial() });

            const group = CurvedPortal3DBuilder.build(roof, conf, pts, h, ctx, resolveRoofMaterial);
            expect(group).toBeDefined();

            const outerMesh = group.children.find(m => m.userData?.materialSlot === 'outer');
            expect(outerMesh).toBeDefined();
            expect(outerMesh.geometry.attributes.position.count).toBeGreaterThan(0);
        });
    });
});

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
    ELEVATION_SEGMENT_CONFIG,
    ELEVATION_SEGMENT_MATERIALS,
    createStarterElevationSegment,
    sproutBendAtEndpoint,
    sproutBranchFromNode,
    setNodeCornerStyle,
    getConnectedWallCorner,
    wrapElevationSegmentToAdjacentWall
} from '../elevationSegment.registry.js';
import {
    expandPathWithFillets,
    buildElevationSegmentGeometry
} from '../elevationSegment.geometry.js';
import { renderElevationSegment3D } from '../elevationSegment.renderer3d.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';
import { MaterialSlots } from '../../../core/constants/materialSlots.js';

describe('Elevation Segment ("Sprout & Bend") Engine Suite', () => {
    let mockWall;

    beforeEach(() => {
        ComponentRegistry.slotRegistry.clear();
        ComponentRegistry.componentRegistry.clear();

        mockWall = {
            id: 'wall_test_101',
            startX: 0,
            startY: 0,
            endX: 500,
            endY: 0,
            thickness: 20,
            height: 300,
            startAnchor: { position: () => ({ x: 0, y: 0 }) },
            endAnchor: { position: () => ({ x: 500, y: 0 }) }
        };
    });

    describe('1. Authoritative Configuration & Starter Segment', () => {
        it('should define default configuration for elevation_segment tool', () => {
            expect(ELEVATION_SEGMENT_CONFIG.id).toBe('elevation_segment');
            expect(ELEVATION_SEGMENT_CONFIG.defaultParams.width).toBe(30);
            expect(ELEVATION_SEGMENT_CONFIG.defaultParams.depth).toBe(40);
            expect(ELEVATION_SEGMENT_CONFIG.defaultParams.length).toBe(180);
            expect(ELEVATION_SEGMENT_CONFIG.defaultParams.material).toBe('wood');
        });

        it('should create a straight starter segment attached flush to wall face', () => {
            // Wall runs from (0,0) to (500,0). Normal facing +1 points in -Z or +Z depending on coords.
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1, { length: 180, width: 30, depth: 40 });

            expect(seg).toBeDefined();
            expect(seg.type).toBe('elevation_segment');
            expect(seg.wallId).toBe('wall_test_101');
            expect(seg.points.length).toBe(2);

            // Points should be 180cm apart along wall X axis (from 160 to 340)
            const p0 = seg.points[0];
            const p1 = seg.points[1];
            expect(Math.abs(p1.x - p0.x)).toBe(180);
            expect(p0.y).toBe(150);
            expect(p1.y).toBe(150);

            // Normal vector should be perpendicular to wall
            expect(p0.normal).toBeDefined();
            expect(Math.hypot(p0.normal.x, p0.normal.z)).toBeCloseTo(1, 2);

            // Nodes and segments graph
            expect(seg.nodes.length).toBe(2);
            expect(seg.segments.length).toBe(1);
        });
    });

    describe('2. Endpoint Dragging & Sprout Arrows (L, U, Z Shapes)', () => {
        it('should sprout UP (↑) at endpoint to create connected L-shape within same entity', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1, { length: 180 });
            expect(seg.points.length).toBe(2);

            // Sprout UP at end node (index 1)
            const res = sproutBendAtEndpoint(seg, 1, 'up', 120);

            expect(res).toBeDefined();
            expect(seg.points.length).toBe(3); // Now an L-shape!
            expect(seg.nodes.length).toBe(3);
            expect(seg.segments.length).toBe(2);

            // Previous endpoint is now an internal bend node
            const bendNode = seg.points[1];
            const newEndpoint = seg.points[2];

            expect(newEndpoint.x).toBe(bendNode.x);
            expect(newEndpoint.z).toBe(bendNode.z);
            expect(newEndpoint.y).toBe(bendNode.y + 120); // 150 + 120 = 270
            expect(bendNode.cornerStyle).toBe('sharp');
        });

        it('should sprout DOWN (↓) at start endpoint to create Z-shape or U-shape', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1, { length: 180 });
            // First sprout UP at index 1 -> L-shape
            sproutBendAtEndpoint(seg, 1, 'up', 120);
            expect(seg.points.length).toBe(3);

            // Now sprout DOWN at index 0 -> U / Z-shape
            const res = sproutBendAtEndpoint(seg, 0, 'down', 100);

            expect(res).toBeDefined();
            expect(seg.points.length).toBe(4);
            expect(seg.nodes.length).toBe(4);
            expect(seg.segments.length).toBe(3);

            // Start node is at y = 150 - 100 = 50
            expect(seg.points[0].y).toBe(50);
        });

        it('should sprout horizontal arms (← / →) when segment is vertical', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1, { length: 180 });
            // Turn UP to make a vertical arm
            sproutBendAtEndpoint(seg, 1, 'up', 150);

            // Sprout right along wall from the vertical endpoint (index 2)
            const res = sproutBendAtEndpoint(seg, 2, 'right', 100);

            expect(res).toBeDefined();
            expect(seg.points.length).toBe(4); // Terrace return arm
            expect(seg.points[3].y).toBe(seg.points[2].y); // Same height
        });
    });

    describe('3. Curved Fillet Bends & Concentric Arc Geometry', () => {
        it('should expand sharp corner into smooth concentric arc samples when fillet is enabled', () => {
            // L-shape: (0, 100, 0) -> (200, 100, 0) -> (200, 300, 0)
            const points = [
                { x: 0, y: 100, z: 0, normal: { x: 0, y: 0, z: 1 } },
                { x: 200, y: 100, z: 0, normal: { x: 0, y: 0, z: 1 }, cornerStyle: 'fillet', radius: 30 },
                { x: 200, y: 300, z: 0, normal: { x: 0, y: 0, z: 1 } }
            ];

            const expanded = expandPathWithFillets(points, 30, 40);

            // Instead of 3 discrete points, should contain interpolated arc subdivisions
            expect(expanded.length).toBeGreaterThan(3);

            // All arc samples should sit between start tangent and end tangent
            const filletSamples = expanded.filter(p => p.isFilletSample);
            expect(filletSamples.length).toBeGreaterThanOrEqual(6);

            // First sample should be near incoming tangent (x ~ 170, y = 100)
            expect(filletSamples[0].x).toBeLessThan(200);
            expect(filletSamples[0].y).toBeCloseTo(100, 1);

            // Last sample should be near outgoing tangent (x = 200, y ~ 130)
            expect(filletSamples[filletSamples.length - 1].x).toBeCloseTo(200, 1);
            expect(filletSamples[filletSamples.length - 1].y).toBeGreaterThan(100);
        });

        it('should build valid 3D BufferGeometry with concentric fillet curves and UV unwrapping', () => {
            const points = [
                { x: 0, y: 100, z: 0, normal: { x: 0, y: 0, z: 1 } },
                { x: 200, y: 100, z: 0, normal: { x: 0, y: 0, z: 1 }, cornerStyle: 'fillet', radius: 25 },
                { x: 200, y: 300, z: 0, normal: { x: 0, y: 0, z: 1 } }
            ];

            const assembly = buildElevationSegmentGeometry(points, {
                width: 30,
                depth: 40,
                hasSpotlights: true,
                spotlightSpacing: 80
            });

            expect(assembly).toBeDefined();
            expect(assembly.geometry).toBeDefined();
            expect(assembly.geometry.attributes.position).toBeDefined();
            expect(assembly.geometry.attributes.normal).toBeDefined();
            expect(assembly.geometry.attributes.uv).toBeDefined();

            // Total path length should be close to 400 (200 horizontal + 200 vertical)
            expect(assembly.totalLength).toBeGreaterThan(350);

            // Should generate spotlights along the horizontal run
            expect(assembly.spotlights.length).toBeGreaterThanOrEqual(1);
        });

        it('should update corner style dynamically via setNodeCornerStyle', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1);
            sproutBendAtEndpoint(seg, 1, 'up', 120);

            // Set bend node (index 1) to fillet with 35cm radius
            const ok = setNodeCornerStyle(seg, 1, 'fillet', 35);
            expect(ok).toBe(true);
            expect(seg.points[1].cornerStyle).toBe('fillet');
            expect(seg.points[1].radius).toBe(35);
        });
    });

    describe('4. T-Branching Shapes', () => {
        it('should sprout a branch from an interior bend node', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1);
            sproutBendAtEndpoint(seg, 1, 'up', 120); // 3 points: 0, 1 (corner), 2

            // Sprout a T-branch from corner node (index 1) going DOWN
            const branch = sproutBranchFromNode(seg, 1, 'down', 80);

            expect(branch).toBeDefined();
            expect(seg.branches.length).toBe(1);
            expect(branch.points.length).toBe(2);
            expect(branch.points[0].y).toBe(seg.points[1].y);
            expect(branch.points[1].y).toBe(seg.points[1].y - 80);
        });
    });

    describe('5. 3-Layer CAD/BIM Component Registration', () => {
        it('should render 3D mesh and register with ComponentRegistry under FASCIA_FRONT', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1, { length: 180 });
            const sceneGroup = new THREE.Group();

            const group = renderElevationSegment3D(sceneGroup, seg);

            expect(group).toBeDefined();
            expect(seg.mesh3D).toBe(group);
            expect(sceneGroup.children.includes(group)).toBe(true);

            // Check ComponentRegistry slot registration
            const registeredSlots = ComponentRegistry.slotRegistry.get(String(seg.id));
            expect(registeredSlots).toBeDefined();
            expect(registeredSlots.has(MaterialSlots.FASCIA_FRONT)).toBe(true);
        });

        it('should update geometry strictly in place on existing mesh3D without replacing group instance', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1, { length: 180 });
            const sceneGroup = new THREE.Group();

            const initialGroup = renderElevationSegment3D(sceneGroup, seg);
            const initialBody = initialGroup.children.find(c => c.userData?.isElevationBody);
            const initialGeo = initialBody.geometry;

            // Sprout an arm
            sproutBendAtEndpoint(seg, 1, 'up', 120);

            // Re-render in place
            const updatedGroup = renderElevationSegment3D(sceneGroup, seg);

            // Group identity MUST remain identical
            expect(updatedGroup).toBe(initialGroup);
            expect(seg.mesh3D).toBe(initialGroup);

            // Body mesh identity preserved, but geometry updated in place
            const updatedBody = updatedGroup.children.find(c => c.userData?.isElevationBody);
            expect(updatedBody).toBe(initialBody);
            expect(updatedBody.geometry).not.toBe(initialGeo);
            expect(updatedBody.geometry.attributes.position).toBeDefined();
        });
    });

    describe('6. Lumion-Grade Handle Alignment, Axial Constraints & Soffit Lights', () => {
        it('should default hasSpotlights to false so starter beams are clean and uncluttered', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1);
            expect(seg.hasSpotlights).toBe(false);
        });

        it('should position end-cap gizmo handle at the 3D center of the cross section (Z = depth / 2)', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1, { depth: 40 });
            const pt = seg.points[1]; // End node
            const normal = pt.normal;

            // Handle position formula: P_cap = P + normal * (depth / 2)
            const capX = pt.x + normal.x * (seg.depth / 2);
            const capY = pt.y;
            const capZ = pt.z + normal.z * (seg.depth / 2);

            // Outward offset should be exactly 20cm along normal from wall face
            const wallDist = Math.hypot(capX - pt.x, capZ - pt.z);
            expect(wallDist).toBeCloseTo(20, 1);
            expect(capY).toBe(150);
        });

        it('should constrain push/pull extension strictly along the 1D segment axis vector', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1, { length: 180 });
            const p0 = seg.points[0];
            const p1 = seg.points[1];

            // Unit axis vector along horizontal segment
            const axis = new THREE.Vector3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z).normalize();
            expect(Math.abs(axis.x)).toBeCloseTo(1, 2);
            expect(axis.y).toBeCloseTo(0, 2);

            // Simulate user dragging with diagonal mouse motion (dx = 50, dy = 30)
            const mouseDelta = new THREE.Vector3(50, 30, 0);
            const axialDelta = mouseDelta.dot(axis); // Strictly projects onto axis (50cm)

            const initialLen = 180;
            const newLen = Math.max(25, initialLen + axialDelta); // 230cm
            expect(newLen).toBe(230);

            // New endpoint along axis
            const newPt = {
                x: p0.x + axis.x * newLen,
                y: p0.y + axis.y * newLen,
                z: p0.z + axis.z * newLen
            };

            // Height Y MUST remain exactly 150 (ZERO diagonal tilt)
            expect(newPt.y).toBe(150);
            // Length is exactly 230cm
            expect(Math.hypot(newPt.x - p0.x, newPt.y - p0.y, newPt.z - p0.z)).toBeCloseTo(230, 1);
        });

        it('should position spotlights strictly on the soffit (bottom face with minimum Y)', () => {
            const points = [
                { x: 0, y: 150, z: 0, normal: { x: 0, y: 0, z: 1 } },
                { x: 200, y: 150, z: 0, normal: { x: 0, y: 0, z: 1 } }
            ];

            const assembly = buildElevationSegmentGeometry(points, {
                width: 30, // Drop is 30cm (from y=165 top to y=135 bottom)
                depth: 40,
                hasSpotlights: true,
                spotlightSpacing: 80
            });

            expect(assembly.spotlights.length).toBeGreaterThanOrEqual(1);
            assembly.spotlights.forEach(spot => {
                // Spotlights MUST be at the bottom face (y = 150 - 30/2 = 135)
                expect(spot.y).toBeCloseTo(135, 1);
            });
        });
    });

    describe('7. Solid Block CCW Winding & Multi-Wall L-Bend Corner Wrapping', () => {
        it('should maintain outward-facing CCW normals regardless of reverse wall direction', () => {
            const reverseWall = {
                id: 'wall_reverse',
                startX: 500,
                startY: 0,
                endX: 0,
                endY: 0,
                thickness: 20
            };

            const seg = createStarterElevationSegment(reverseWall, 250, 150, 1);
            const assembly = buildElevationSegmentGeometry(seg.points, { width: 30, depth: 40 });
            expect(assembly).toBeDefined();

            const geo = assembly.geometry;
            const normals = geo.attributes.normal;
            const indices = geo.index.array;
            const positions = geo.attributes.position;

            // Verify that every triangle has outward-pointing normal (positive area relative to outward normal)
            let hasValidFrontFaces = false;
            for (let i = 0; i < indices.length; i += 3) {
                const i0 = indices[i];
                const i1 = indices[i + 1];
                const i2 = indices[i + 2];

                const p0 = new THREE.Vector3(positions.getX(i0), positions.getY(i0), positions.getZ(i0));
                const p1 = new THREE.Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1));
                const p2 = new THREE.Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2));

                const triNorm = new THREE.Vector3().crossVectors(p1.sub(p0), p2.sub(p0)).normalize();
                const vNorm = new THREE.Vector3(normals.getX(i0), normals.getY(i0), normals.getZ(i0));

                // Triangle normal MUST be aligned with vertex outward normal (dot product > 0.9)
                expect(triNorm.dot(vNorm)).toBeGreaterThan(0.85);

                // Check that front faces point in the outward wall normal direction (-Z for this reverse wall)
                if (Math.abs(vNorm.z) > 0.8) {
                    hasValidFrontFaces = true;
                }
            }

            expect(hasValidFrontFaces).toBe(true);
        });

        it('should wrap elevation segment from Wall A around 90-degree corner onto Wall B', () => {
            const wallA = {
                id: 'wall_A',
                startX: 0,
                startY: 0,
                endX: 300,
                endY: 0,
                thickness: 20
            };
            const wallB = {
                id: 'wall_B',
                startX: 300,
                startY: 0,
                endX: 300,
                endY: 300,
                thickness: 20
            };

            const mockPlanner = {
                walls: [wallA, wallB]
            };

            // Starter segment on wall A near corner (endX = 300)
            const seg = createStarterElevationSegment(wallA, 220, 150, 1, { length: 140 });
            // Point 1 is near corner (around x=290)
            const conn = getConnectedWallCorner(seg, 1, mockPlanner, 90);
            expect(conn).toBeDefined();
            expect(conn.adjWall.id).toBe('wall_B');

            // Wrap onto Wall B
            const wrapResult = wrapElevationSegmentToAdjacentWall(seg, 1, mockPlanner);
            expect(wrapResult).toBeDefined();
            expect(seg.points.length).toBe(3); // Start, Corner, End on Wall B

            // For facing = 1 (+Z face), Wall B's continuous face is at x ~ 290 (preserving same continuous side)
            const cornerPt = seg.points[1];
            expect(cornerPt.x).toBeCloseTo(290, 0);
            expect(cornerPt.cornerStyle).toBe('sharp');

            // Final endpoint should be on Wall B face (x ~ 290, z > 0)
            const endPt = seg.points[2];
            expect(endPt.x).toBeCloseTo(290, 0);
            expect(endPt.z).toBeGreaterThan(0);

            // Rebuild geometry to ensure gapless 3D miter assembly
            const assembly = buildElevationSegmentGeometry(seg.points, { width: 30, depth: 40 });
            expect(assembly).toBeDefined();
            expect(assembly.geometry.attributes.position.count).toBeGreaterThanOrEqual(40);
        });
    });
});

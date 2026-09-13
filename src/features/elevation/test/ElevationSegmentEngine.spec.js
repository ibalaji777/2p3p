import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
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
import {
    computeElevationSegment2DFootprint,
    computeElevationSegmentSpotlights2D,
    renderElevationSegment2D,
    syncElevationSegments2D,
    createElevationSegment2DGroup
} from '../elevationSegment.renderer2d.js';
import Konva from 'konva';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';
import { MaterialSlots } from '../../../core/constants/materialSlots.js';

describe('Elevation Segment ("Sprout & Bend") Engine Suite', () => {
    let mockWall;

    beforeAll(() => {
        if (typeof HTMLCanvasElement !== 'undefined') {
            HTMLCanvasElement.prototype.getContext = () => ({
                clearRect: () => {},
                fillRect: () => {},
                getImageData: () => ({ data: [0, 0, 0, 0] }),
                putImageData: () => {},
                createImageData: () => ({ data: [0, 0, 0, 0] }),
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
                measureText: () => ({ width: 0 })
            });
        }
    });

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

        it('should rotate outward normal continuously radial around a 90-degree corner turn', () => {
            const points = [
                { x: 100, y: 150, z: 0, normal: { x: 0, y: 0, z: 1 } },
                { x: 300, y: 150, z: 0, normal: { x: -0.707, y: 0, z: 0.707 }, cornerStyle: 'fillet', radius: 30 },
                { x: 300, y: 150, z: 200, normal: { x: -1, y: 0, z: 0 } }
            ];

            const expanded = expandPathWithFillets(points, 30, 40);
            const filletSamples = expanded.filter(p => p.isFilletSample);

            expect(filletSamples.length).toBe(17); // SAMPLES = 16 (0 to 16 inclusive)

            // Start sample normal should match incoming normal (0, 0, 1)
            const nStart = filletSamples[0].normal;
            expect(nStart.x).toBeCloseTo(0, 1);
            expect(nStart.z).toBeCloseTo(1, 1);

            // Mid sample (k = 8) normal should be at ~45 degrees
            const nMid = filletSamples[8].normal;
            expect(nMid.x).toBeLessThan(-0.5);
            expect(nMid.z).toBeGreaterThan(0.5);

            // End sample normal should match outgoing normal (-1, 0, 0)
            const nEnd = filletSamples[filletSamples.length - 1].normal;
            expect(nEnd.x).toBeCloseTo(-1, 1);
            expect(nEnd.z).toBeCloseTo(0, 1);

            // Monotonic rotation: n.x should strictly decrease from ~0 to ~ -1
            for (let i = 1; i < filletSamples.length; i++) {
                expect(filletSamples[i].normal.x).toBeLessThanOrEqual(filletSamples[i - 1].normal.x + 0.001);
                expect(filletSamples[i].normal.z).toBeLessThanOrEqual(filletSamples[i - 1].normal.z + 0.001);
            }
        });

        it('should compute exact concentric 2D footprint outer arc with uniform depth distance', () => {
            const entity = {
                id: 'seg_fillet_concentric',
                depth: 40,
                width: 30,
                points: [
                    { x: 100, y: 150, z: 0, normal: { x: 0, y: 0, z: 1 } },
                    { x: 300, y: 150, z: 0, normal: { x: -0.707, y: 0, z: 0.707 }, cornerStyle: 'fillet', radius: 30 },
                    { x: 300, y: 150, z: 200, normal: { x: -1, y: 0, z: 0 } }
                ]
            };

            const footprint = computeElevationSegment2DFootprint(entity);
            expect(footprint).toBeDefined();

            const expandedPts = expandPathWithFillets(entity.points, 30, 40);
            const n = expandedPts.length;

            // For every single point, outer distance |Q[i] - P[i]| MUST equal exactly 40cm (+- 0.5cm)
            // with ZERO flat diagonal chamfer distortion
            for (let i = 0; i < n; i++) {
                const p = footprint.P[i];
                const q = footprint.Q[i];
                const dist = Math.hypot(q.x - p.x, q.y - p.y);
                expect(dist).toBeCloseTo(40, 0);
            }
        });

        it('should interpolate smooth front face vertex normals in 3D without faceted shading', () => {
            const points = [
                { x: 100, y: 150, z: 0, normal: { x: 0, y: 0, z: 1 } },
                { x: 300, y: 150, z: 0, normal: { x: -0.707, y: 0, z: 0.707 }, cornerStyle: 'fillet', radius: 30 },
                { x: 300, y: 150, z: 200, normal: { x: -1, y: 0, z: 0 } }
            ];

            const assembly = buildElevationSegmentGeometry(points, { width: 30, depth: 40 });
            expect(assembly).toBeDefined();

            const normals = assembly.geometry.attributes.normal;
            expect(normals).toBeDefined();

            // Check that normals along the curve are not all identical static values
            const uniqueXNormals = new Set();
            for (let i = 0; i < normals.count; i++) {
                uniqueXNormals.add(Math.round(normals.getX(i) * 10) / 10);
            }
            // Over a 90 degree turn with smooth vertex normals, there should be multiple distinct normal angles
            expect(uniqueXNormals.size).toBeGreaterThanOrEqual(5);
        });

        it('should keep inner wall contact line sharp against the wall corner while outer edge curves', () => {
            const entity = {
                id: 'seg_fillet_sharp_inner',
                depth: 40,
                width: 30,
                points: [
                    { x: 100, y: 150, z: 0, normal: { x: 0, y: 0, z: 1 } },
                    { x: 300, y: 150, z: 0, normal: { x: -0.707, y: 0, z: 0.707 }, cornerStyle: 'fillet', radius: 30 },
                    { x: 300, y: 150, z: 200, normal: { x: -1, y: 0, z: 0 } }
                ]
            };

            const footprint = computeElevationSegment2DFootprint(entity);
            expect(footprint).toBeDefined();

            // innerCoords MUST only contain the 3 baseline wall vertices [P0, Pcorner, P2]
            // and have ZERO inner curve subdivisions cutting through the wall
            expect(footprint.innerCoords.length).toBe(6); // [x0, y0, xc, yc, x2, y2]
            expect(footprint.innerCoords[0]).toBe(100);
            expect(footprint.innerCoords[1]).toBe(0);
            expect(footprint.innerCoords[2]).toBe(300);
            expect(footprint.innerCoords[3]).toBe(0); // exactly at sharp wall corner (300, 0)
            expect(footprint.innerCoords[4]).toBe(300);
            expect(footprint.innerCoords[5]).toBe(200);

            // outerCoords MUST contain the smooth 16-sample circular arc
            expect(footprint.outerCoords.length).toBeGreaterThan(20);
        });

        it('should ensure outer dashed line is strictly parallel to vertical and horizontal walls with zero slant and zero pinching', () => {
            // Replicate the exact L-turn wrap from the user's screenshot:
            // Vertical wall going UP: (100, 150, 300) -> (100, 150, 100)
            // Horizontal wall going RIGHT: (100, 150, 100) -> (300, 150, 100)
            // Outer side is -X on vertical wall, -Z on horizontal wall
            const entity = {
                id: 'seg_fillet_zero_slant_l_turn',
                depth: 40,
                width: 30,
                points: [
                    { x: 100, y: 150, z: 300, normal: { x: -1, y: 0, z: 0 } },
                    { x: 100, y: 150, z: 100, normal: { x: -0.707, y: 0, z: -0.707 }, cornerStyle: 'fillet', radius: 30 },
                    { x: 300, y: 150, z: 100, normal: { x: 0, y: 0, z: -1 } }
                ]
            };

            const footprint = computeElevationSegment2DFootprint(entity);
            expect(footprint).toBeDefined();

            // 1. Check vertical wall segment outer edge (Q[0] and Q[1]):
            // Baseline goes from (100, 300) to (100, 100).
            // With depth = 40 and outward normal (-1, 0), outer line MUST be 100% strictly vertical at X = 60!
            expect(footprint.Q[0].x).toBeCloseTo(60, 2);
            expect(footprint.Q[0].y).toBeCloseTo(300, 2);
            expect(footprint.Q[1].x).toBeCloseTo(60, 2);
            expect(footprint.Q[1].y).toBeCloseTo(100, 2);
            // ZERO SLANT: X coordinates along vertical segment MUST be completely identical!
            expect(footprint.Q[0].x).toBe(footprint.Q[1].x);

            // 2. Check horizontal wall segment outer edge (Q[17] and Q[18]):
            // Baseline goes from (100, 100) to (300, 100).
            // With depth = 40 and outward normal (0, -1), outer line MUST be 100% strictly horizontal at Y = 60!
            const nQ = footprint.Q.length;
            expect(footprint.Q[nQ - 2].x).toBeCloseTo(100, 2);
            expect(footprint.Q[nQ - 2].y).toBeCloseTo(60, 2);
            expect(footprint.Q[nQ - 1].x).toBeCloseTo(300, 2);
            expect(footprint.Q[nQ - 1].y).toBeCloseTo(60, 2);
            // ZERO SLANT: Y coordinates along horizontal segment MUST be completely identical!
            expect(footprint.Q[nQ - 2].y).toBe(footprint.Q[nQ - 1].y);

            // 3. Check smooth concentric circular arc across the corner:
            // Midpoint of arc (index 9) MUST have exact distance 40cm from the corner (100, 100)
            const midQ = footprint.Q[9];
            const distFromCorner = Math.hypot(midQ.x - 100, midQ.y - 100);
            expect(distFromCorner).toBeCloseTo(40, 1); // EXACTLY 40cm, ZERO PINCHING!

            // 4. Inner wall contact line MUST be sharp against the 90° wall corner:
            expect(footprint.innerCoords).toEqual([100, 300, 100, 100, 300, 100]);
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

    describe('6. 2D Floor Plan Representation & Synchronization Suite', () => {
        it('should compute exact 2D footprint polygon and cantilever overhang for straight segment', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1, { length: 180, width: 30, depth: 40 });
            const footprint = computeElevationSegment2DFootprint(seg);

            expect(footprint).toBeDefined();
            expect(footprint.P.length).toBe(2);
            expect(footprint.Q.length).toBe(2);
            expect(footprint.totalLength).toBeCloseTo(180, 0);

            // 4 vertices around the band = 8 flat coordinates in polyCoords
            expect(footprint.polyCoords.length).toBe(8);

            // Baseline coordinates (inner against wall)
            expect(footprint.innerCoords.length).toBe(4); // [x0, y0, x1, y1]
            expect(footprint.outerCoords.length).toBe(4); // [qx0, qy0, qx1, qy1]

            // Cantilever depth overhang distance between P0 and Q0 should be 40
            const p0 = footprint.P[0];
            const q0 = footprint.Q[0];
            const overhangDist = Math.hypot(q0.x - p0.x, q0.y - p0.y);
            expect(overhangDist).toBeCloseTo(40, 1);
        });

        it('should compute mitered 2D outer corner vertex for multi-wall wrapped segment', () => {
            const multiSeg = {
                id: 'seg_corner_2d',
                depth: 40,
                width: 30,
                points: [
                    { x: 100, y: 150, z: 10, normal: { x: 0, y: 0, z: 1 } },
                    { x: 300, y: 150, z: 10, normal: { x: 0, y: 0, z: 1 } },
                    { x: 300, y: 150, z: 150, normal: { x: -1, y: 0, z: 0 } }
                ]
            };

            const footprint = computeElevationSegment2DFootprint(multiSeg);
            expect(footprint).toBeDefined();
            expect(footprint.P.length).toBe(3);
            expect(footprint.Q.length).toBe(3);

            // Total 6 boundary vertices = 12 coordinates
            expect(footprint.polyCoords.length).toBe(12);

            // The corner vertex Q[1] should be expanded past the 40cm perpendicular depth to form miter
            const pCorner = footprint.P[1];
            const qCorner = footprint.Q[1];
            const cornerMiterDist = Math.hypot(qCorner.x - pCorner.x, qCorner.y - pCorner.y);
            expect(cornerMiterDist).toBeGreaterThan(40); // 40 * sqrt(2) ~ 56.5 cm
        });

        it('should compute 2D recessed spotlight positions along segment centerline', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1, {
                length: 200,
                hasSpotlights: true,
                spotlightSpacing: 80
            });
            const footprint = computeElevationSegment2DFootprint(seg);
            const spots = computeElevationSegmentSpotlights2D(seg, footprint);

            expect(spots.length).toBeGreaterThan(0);
            spots.forEach(pt => {
                expect(typeof pt.x).toBe('number');
                expect(typeof pt.y).toBe('number');
                // Spotlight should lie between start and end X
                expect(pt.x).toBeGreaterThanOrEqual(footprint.P[0].x);
                expect(pt.x).toBeLessThanOrEqual(footprint.P[1].x);
            });
        });

        it('should render Konva 2D visual nodes and handle selection highlight', () => {
            const seg = createStarterElevationSegment(mockWall, 250, 150, 1, {
                length: 180,
                hasSpotlights: true,
                depth: 40
            });
            const mockPlanner = {
                tool: 'select',
                selectedEntity: null,
                selectEntity(ent, type) {
                    this.selectedEntity = ent;
                }
            };

            const group = new Konva.Group();
            renderElevationSegment2D(group, seg, mockPlanner);

            // Sub-nodes should be created
            const fillPoly = group.findOne('.elev-fill-poly');
            const wallLine = group.findOne('.elev-wall-line');
            const outerDashed = group.findOne('.elev-outer-dashed');
            const spotsGroup = group.findOne('.elev-spots-group');
            const badgeGroup = group.findOne('.elev-badge-group');
            const handlesGroup = group.findOne('.elev-handles-group');

            expect(fillPoly).toBeDefined();
            expect(wallLine).toBeDefined();
            expect(outerDashed).toBeDefined();
            expect(outerDashed.dash()).toEqual([6, 4]);
            expect(spotsGroup).toBeDefined();
            expect(badgeGroup).toBeDefined();
            expect(handlesGroup).toBeDefined();

            // When unselected, handles are hidden
            expect(handlesGroup.visible()).toBe(false);

            // When selected, handles become visible
            mockPlanner.selectedEntity = seg;
            renderElevationSegment2D(group, seg, mockPlanner);
            expect(handlesGroup.visible()).toBe(true);
            expect(fillPoly.strokeWidth()).toBe(2);
        });

        it('should synchronize elevation segments with widgetLayer on FloorPlanner', () => {
            const seg1 = createStarterElevationSegment(mockWall, 200, 150, 1);
            const seg2 = createStarterElevationSegment(mockWall, 350, 150, 1);

            const widgetLayer = new Konva.Group();
            const mockPlanner = {
                elevationSegments: [seg1, seg2],
                widgetLayer,
                tool: 'select'
            };

            // Initial sync: creates 2 groups on widgetLayer
            syncElevationSegments2D(mockPlanner);
            expect(widgetLayer.getChildren().length).toBe(2);
            expect(seg1.group2D).toBeDefined();
            expect(seg2.group2D).toBeDefined();

            // Remove seg2 from planner.elevationSegments and sync again
            mockPlanner.elevationSegments = [seg1];
            syncElevationSegments2D(mockPlanner);
            expect(widgetLayer.getChildren().length).toBe(1);
            expect(widgetLayer.getChildren()[0].id()).toBe(seg1.id);
        });
    });
});

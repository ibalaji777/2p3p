import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { FloorSlabEngine } from '../FloorSlabEngine.js';
import { VerticalPropagationEngine } from '../../vertical/VerticalPropagationEngine.js';

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
            clip: () => {},
        });
    }
});

describe('FloorSlabEngine CAD/BIM Compliance & Architecture Suite', () => {
    let sampleRoom;

    beforeEach(() => {
        sampleRoom = {
            id: 'room_101',
            configId: 'hardwood',
            thickness: 5,
            path: [
                { x: 0, y: 0 },
                { x: 500, y: 0 },
                { x: 500, y: 400 },
                { x: 0, y: 400 }
            ]
        };
    });

    describe('Geometry & Extrusion Authority', () => {
        it('generates an ExtrudeGeometry floor slab mesh with correct dimensions and elevation offset', () => {
            const mesh = FloorSlabEngine.buildFloorSlabMesh(sampleRoom);
            expect(mesh).toBeDefined();
            expect(mesh).toBeInstanceOf(THREE.Mesh);
            expect(mesh.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
            expect(mesh.userData.entity).toBe(sampleRoom);
            expect(mesh.userData.isRoom).toBe(true);
            expect(mesh.userData.isFloor).toBe(true);

            // Bounds check: bounding box should span 500 in X and 400 in Z (due to rotateX(Math.PI/2))
            mesh.geometry.computeBoundingBox();
            const bbox = mesh.geometry.boundingBox;
            expect(Math.round(bbox.max.x - bbox.min.x)).toBe(500);
            expect(Math.round(bbox.max.z - bbox.min.z)).toBe(400);
            // Slabs translate by 0.2 in Y
            expect(bbox.min.y).toBeCloseTo(0.2 - 5, 1);
            expect(bbox.max.y).toBeCloseTo(0.2, 1);
        });

        it('supports substructure plinth / foundation slabs when isSub is true', () => {
            const subMesh = FloorSlabEngine.buildFloorSlabMesh(sampleRoom, { isSub: true, subH: 25 });
            expect(subMesh).toBeDefined();
            expect(subMesh.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);

            subMesh.geometry.computeBoundingBox();
            const bbox = subMesh.geometry.boundingBox;
            // subMesh translates by (subH - 0.01)
            expect(bbox.max.y).toBeCloseTo(25 - 0.01, 1);
            expect(bbox.min.y).toBeCloseTo(-0.01, 1);
        });

        it('safely returns null for deleted, hidden, or degenerate rooms', () => {
            expect(FloorSlabEngine.buildFloorSlabMesh(null)).toBeNull();
            expect(FloorSlabEngine.buildFloorSlabMesh({ ...sampleRoom, isDeleted: true })).toBeNull();
            expect(FloorSlabEngine.buildFloorSlabMesh({ ...sampleRoom, isHidden: true })).toBeNull();
            expect(FloorSlabEngine.buildFloorSlabMesh({ ...sampleRoom, path: [{ x: 0, y: 0 }, { x: 10, y: 10 }] })).toBeNull();
        });
    });

    describe('Stair Void Extraction (StairGeometryEngine Integration)', () => {
        it('extracts stair holes from stairs on the level below', () => {
            const stairsBelow = [
                {
                    type: 'stair_v5_straight',
                    width: 100,
                    stepDepth: 25,
                    totalSteps: 10,
                    x: 200,
                    y: 200,
                    rotation: 0
                }
            ];

            const holes = FloorSlabEngine.extractStairHoles(stairsBelow);
            expect(holes.length).toBe(1);
            expect(holes[0]).toBeInstanceOf(THREE.Path);

            // Mesh built with stairsBelow includes the void in its shape
            const mesh = FloorSlabEngine.buildFloorSlabMesh(sampleRoom, { stairsBelow });
            expect(mesh).toBeDefined();
            expect(mesh.geometry).toBeDefined();
        });

        it('gracefully handles empty or invalid stairsBelow input', () => {
            expect(FloorSlabEngine.extractStairHoles([])).toEqual([]);
            expect(FloorSlabEngine.extractStairHoles(null)).toEqual([]);
            expect(FloorSlabEngine.extractStairHoles(undefined)).toEqual([]);
        });
    });

    describe('Ceiling / Floor Cutout Void Extraction (shape_floor_cut)', () => {
        it('extracts rectangular cutout holes from shape_floor_cut entities', () => {
            const shapes = [
                {
                    type: 'shape_floor_cut',
                    x: 250,
                    y: 200,
                    rotation: 0,
                    params: { width: 120, height: 80 }
                }
            ];

            const holes = FloorSlabEngine.extractCutoutHoles(shapes);
            expect(holes.length).toBe(1);
            expect(holes[0]).toBeInstanceOf(THREE.Path);

            const mesh = FloorSlabEngine.buildFloorSlabMesh(sampleRoom, { shapes });
            expect(mesh).toBeDefined();
        });

        it('extracts arbitrary polygonal cutout holes from shape_floor_cut with params.points', () => {
            const shapes = [
                {
                    type: 'shape_floor_cut',
                    x: 200,
                    y: 200,
                    rotation: 45,
                    params: {
                        points: [
                            { x: -50, y: -50 },
                            { x: 50, y: -50 },
                            { x: 50, y: 50 },
                            { x: -50, y: 50 }
                        ]
                    }
                }
            ];

            const holes = FloorSlabEngine.extractCutoutHoles(shapes);
            expect(holes.length).toBe(1);
        });

        it('ignores unrelated shapes', () => {
            const shapes = [
                { type: 'shape_rect', x: 100, y: 100 },
                { type: 'shape_circle', x: 200, y: 200 }
            ];
            const holes = FloorSlabEngine.extractCutoutHoles(shapes);
            expect(holes.length).toBe(0);
        });
    });

    describe('World-Space Tri-Planar UV Mapping', () => {
        it('applies world-space UV coordinates scaled by 1/100', () => {
            const geom = new THREE.BoxGeometry(200, 20, 300);
            FloorSlabEngine.applyWorldUVs(geom);

            const uvs = geom.attributes.uv;
            expect(uvs).toBeDefined();
            expect(uvs.version).toBeGreaterThan(0);

            // Top face normal is (0, 1, 0), so |Ny| > 0.5 -> UV is (X/100, Z/100)
            const pos = geom.attributes.position;
            const norms = geom.attributes.normal;
            for (let i = 0; i < geom.attributes.position.count; i++) {
                if (norms.getY(i) > 0.5) {
                    const expectedU = pos.getX(i) / 100;
                    const expectedV = pos.getZ(i) / 100;
                    expect(uvs.getX(i)).toBeCloseTo(expectedU, 4);
                    expect(uvs.getY(i)).toBeCloseTo(expectedV, 4);
                }
            }
        });
    });

    describe('Vertical Propagation & Stacked Wall Single-Elevation Rule', () => {
        it('updates cross-level stacked wall elevation relative to active level elevation without double-counting', () => {
            const groundWall = {
                id: 'w_ground',
                hostLevelId: 'lvl_0',
                elevation: 0,
                height: 280
            };

            const upperWall = {
                id: 'w_upper',
                parentWallId: 'w_ground',
                hostLevelId: 'lvl_1',
                relativeElevation: 0,
                elevation: 0,
                mesh3D: { position: { y: 0 } }
            };

            const mockPlanner = {
                walls: [groundWall, upperWall],
                levels: [
                    { id: 'lvl_0', elevation: 0, height: 280 },
                    { id: 'lvl_1', elevation: 280, height: 280 }
                ],
                activeLevelIndex: 1
            };

            // Ground wall rises to 300
            groundWall.height = 300;
            VerticalPropagationEngine.propagateToUpperLevels(groundWall, 20, mockPlanner);

            // Active level 1 has elevation 280.
            // Source world top is 0 + 0 + 300 = 300.
            // Upper wall is inside level 1 group (which is positioned at y = 280 in world space).
            // Therefore, upperWall.elevation in local level space MUST be 300 - 280 = 20 (NOT 300 + 280 = 580).
            expect(upperWall.elevation).toBe(20);
            expect(upperWall.mesh3D.position.y).toBe(20);
        });
    });

    describe('Courtyard Hole Extraction & Nested Room Voids', () => {
        it('extracts nested courtyard voids when a smaller room is enclosed inside a larger room', () => {
            const containerRoom = {
                id: 'room_courtyard_container',
                elevation: 0,
                path: [
                    { x: 0, y: 0 },
                    { x: 1000, y: 0 },
                    { x: 1000, y: 1000 },
                    { x: 0, y: 1000 }
                ]
            };

            const innerCourtyard = {
                id: 'room_inner_courtyard',
                elevation: 0,
                path: [
                    { x: 300, y: 300 },
                    { x: 700, y: 300 },
                    { x: 700, y: 700 },
                    { x: 300, y: 700 }
                ]
            };

            const holes = FloorSlabEngine.extractCourtyardHoles(containerRoom, [containerRoom, innerCourtyard]);
            expect(holes.length).toBe(1);
            expect(holes[0]).toBeInstanceOf(THREE.Path);

            const mesh = FloorSlabEngine.buildFloorSlabMesh(containerRoom, { allRooms: [containerRoom, innerCourtyard] });
            expect(mesh).toBeDefined();
            expect(mesh.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
        });

        it('ignores nested rooms if their elevation differs by 5cm or more', () => {
            const containerRoom = {
                id: 'room_container',
                elevation: 0,
                path: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }]
            };
            const upperRoom = {
                id: 'room_upper',
                elevation: 280,
                path: [{ x: 300, y: 300 }, { x: 700, y: 300 }, { x: 700, y: 700 }, { x: 300, y: 700 }]
            };

            const holes = FloorSlabEngine.extractCourtyardHoles(containerRoom, [containerRoom, upperRoom]);
            expect(holes.length).toBe(0);
        });
    });

    describe('CAD-Style In-Place Geometry Updates', () => {
        it('updates floor mesh geometry in place without creating a new mesh reference', () => {
            const mesh = FloorSlabEngine.buildFloorSlabMesh(sampleRoom);
            const originalMeshRef = mesh;
            const originalGeo = mesh.geometry;

            // Enlarge the room
            sampleRoom.path = [
                { x: 0, y: 0 },
                { x: 800, y: 0 },
                { x: 800, y: 600 },
                { x: 0, y: 600 }
            ];

            const updated = FloorSlabEngine.updateFloorMeshGeometry(mesh, sampleRoom);
            expect(updated).toBe(true);
            expect(mesh).toBe(originalMeshRef);
            expect(mesh.geometry).not.toBe(originalGeo);

            mesh.geometry.computeBoundingBox();
            const bbox = mesh.geometry.boundingBox;
            expect(Math.round(bbox.max.x - bbox.min.x)).toBe(800);
            expect(Math.round(bbox.max.z - bbox.min.z)).toBe(600);
        });
    });
});

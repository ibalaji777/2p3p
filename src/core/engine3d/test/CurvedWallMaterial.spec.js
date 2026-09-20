import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { WallEngine } from '../../wall/WallEngine.js';
import { ApplyMaterialCommand } from '../../commands/ApplyMaterialCommand.js';
import { WallCornerFilletGizmo } from '../WallCornerFilletGizmo.js';
import { AllWallCornersGizmo } from '../AllWallCornersGizmo.js';

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

describe('Curved Wall Material Application & Raycast Transparency', () => {
    let mockPlanner;
    let mockEngine3D;
    let arc;
    let wall1;
    let wall2;
    let wall3;

    beforeEach(() => {
        mockPlanner = {
            walls: [],
            anchors: [],
            arcs: [],
            furniture: [],
            stairs: [],
            roofs: [],
            balconies: [],
            shapes: [],
            platforms: [],
            outdoorZones: [],
            moldings: [],
            syncAll: vi.fn(),
            saveHistory: vi.fn(),
        };

        // Create curved wall (arc) with 3 wall segments
        arc = {
            id: 'arc_test_101',
            type: 'arc',
            params: {},
            walls: [],
            planner: mockPlanner
        };

        const createMockSegment = (id) => {
            const wallMesh = new THREE.Mesh(
                new THREE.BoxGeometry(100, 280, 20),
                [
                    new THREE.MeshBasicMaterial(),
                    new THREE.MeshBasicMaterial(),
                    new THREE.MeshBasicMaterial(),
                    new THREE.MeshBasicMaterial(),
                    new THREE.MeshBasicMaterial(),
                    new THREE.MeshBasicMaterial()
                ]
            );
            wallMesh.userData = { isWallMesh: true };

            const wallGroup = new THREE.Group();
            wallGroup.userData = { isWallGroup: true };
            wallGroup.add(wallMesh);

            const w = {
                id,
                type: 'outer',
                params: {},
                height: 280,
                length3D: 100,
                mesh3D: wallGroup,
                wallMesh3D: wallMesh,
                parentArc: arc,
                planner: mockPlanner
            };
            wallMesh.userData.entity = w;
            wallGroup.userData.entity = w;
            return w;
        };

        wall1 = createMockSegment('wall_seg_1');
        wall2 = createMockSegment('wall_seg_2');
        wall3 = createMockSegment('wall_seg_3');

        arc.walls = [wall1, wall2, wall3];
        mockPlanner.walls.push(wall1, wall2, wall3);
        mockPlanner.arcs.push(arc);

        // Mock 3D Engine with helpers and updateMaterialLive
        mockEngine3D = {
            planner: mockPlanner,
            isUpdatingFrom3D: false,
            interactables: [],
            helpers: {
                getFaceMaterials: vi.fn((entity, baseMat, dims) => {
                    const ep = Object.assign({}, entity.parentArc ? entity.parentArc.params : null, entity.params || {});
                    const mats = [
                        new THREE.MeshBasicMaterial({ name: ep.textureRight || 'default' }),
                        new THREE.MeshBasicMaterial({ name: ep.textureLeft || 'default' }),
                        new THREE.MeshBasicMaterial({ name: ep.textureTop || 'default' }),
                        new THREE.MeshBasicMaterial({ name: ep.textureBottom || 'default' }),
                        new THREE.MeshBasicMaterial({ name: ep.textureFront || 'default' }),
                        new THREE.MeshBasicMaterial({ name: ep.textureBack || 'default' }),
                    ];
                    return { box: mats, extrude: [mats[2], mats[0]] };
                })
            },
            requestRender: vi.fn(),
            updateMaterialLive: vi.fn(function(entity) {
                if (!entity || this.isUpdatingFrom3D) return false;
                let obj = entity.mesh3D;
                if (!obj && (entity.type === 'arc' || (entity.walls && Array.isArray(entity.walls)))) {
                    const firstWall = entity.walls && entity.walls[0];
                    if (firstWall && firstWall.mesh3D) {
                        obj = firstWall.mesh3D;
                    }
                }
                if (!obj) return false;

                const wallsToUpdate = (entity.parentArc && entity.parentArc.walls)
                    ? entity.parentArc.walls
                    : ((entity.walls && Array.isArray(entity.walls)) ? entity.walls : [entity]);
                let anyUpdated = false;

                if (entity.params && wallsToUpdate) {
                    wallsToUpdate.forEach(w => {
                        w.params = Object.assign({}, w.params || {}, entity.params);
                    });
                }

                wallsToUpdate.forEach(w => {
                    const mats = this.helpers.getFaceMaterials(w, null, { width: 100, height: 280 }).box;
                    const wallMesh = w.wallMesh3D;
                    if (wallMesh) {
                        wallMesh.material = mats;
                        anyUpdated = true;
                    }
                });

                if (anyUpdated) {
                    this.requestRender();
                    return true;
                }
                return false;
            })
        };
        mockPlanner.engine3d = mockEngine3D;
    });

    it('propagates material from a curved wall segment to all sibling segments and parent arc', () => {
        WallEngine.applyMaterial(wall1, {
            target: 'front',
            key: 'stone_slate_black',
            ctx: mockEngine3D
        }, mockPlanner);

        // Verify parent arc params updated
        expect(arc.params.textureFront).toBe('stone_slate_black');

        // Verify all 3 segments updated params
        expect(wall1.params.textureFront).toBe('stone_slate_black');
        expect(wall2.params.textureFront).toBe('stone_slate_black');
        expect(wall3.params.textureFront).toBe('stone_slate_black');

        // Verify updateMaterialLive was called and updated meshes in-place
        expect(mockEngine3D.updateMaterialLive).toHaveBeenCalled();
        expect(wall1.wallMesh3D.material[4].name).toBe('stone_slate_black');
        expect(wall2.wallMesh3D.material[4].name).toBe('stone_slate_black');
        expect(wall3.wallMesh3D.material[4].name).toBe('stone_slate_black');
    });

    it('propagates material applied directly to parent arc to all constituent segments', () => {
        WallEngine.applyMaterial(arc, {
            target: 'back',
            key: 'wood_cherry',
            ctx: mockEngine3D
        }, mockPlanner);

        expect(arc.params.textureBack).toBe('wood_cherry');
        expect(wall1.params.textureBack).toBe('wood_cherry');
        expect(wall2.params.textureBack).toBe('wood_cherry');
        expect(wall3.params.textureBack).toBe('wood_cherry');

        expect(wall1.wallMesh3D.material[5].name).toBe('wood_cherry');
        expect(wall2.wallMesh3D.material[5].name).toBe('wood_cherry');
        expect(wall3.wallMesh3D.material[5].name).toBe('wood_cherry');
    });

    it('supports full undo and redo via ApplyMaterialCommand on curved walls', () => {
        const cmd = new ApplyMaterialCommand(mockPlanner, 'arc_test_101', 'front', 'brick_red', 'white_paint');

        cmd.execute();
        expect(arc.params.textureFront).toBe('brick_red');
        expect(wall1.params.textureFront).toBe('brick_red');
        expect(wall2.params.textureFront).toBe('brick_red');
        expect(wall3.params.textureFront).toBe('brick_red');

        cmd.undo();
        expect(arc.params.textureFront).toBe('white_paint');
        expect(wall1.params.textureFront).toBe('white_paint');
        expect(wall2.params.textureFront).toBe('white_paint');
        expect(wall3.params.textureFront).toBe('white_paint');
    });

    it('ensures gizmo helper meshes do not intercept raycasts (raycast neutrality)', () => {
        const domElement = document.createElement('div');
        const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
        const ctx = {
            planner: mockPlanner,
            renderer: { domElement },
            camera,
            scene: new THREE.Scene(),
            structureGroup: new THREE.Group(),
            interactables: [],
            controls: { enabled: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
            requestRender: vi.fn()
        };

        const filletGizmo = new WallCornerFilletGizmo(ctx);
        const cornersGizmo = new AllWallCornersGizmo(ctx);

        // Test WallCornerFilletGizmo ghost meshes
        const raycaster = new THREE.Raycaster();
        raycaster.set(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));

        const intersectsGhostWall = [];
        filletGizmo.ghostWallMesh.raycast(raycaster, intersectsGhostWall);
        expect(intersectsGhostWall.length).toBe(0);

        const intersectsGhostLines = [];
        filletGizmo.ghostLinesMesh.raycast(raycaster, intersectsGhostLines);
        expect(intersectsGhostLines.length).toBe(0);

        const intersectsGhostCutLines = [];
        filletGizmo.ghostCutLinesMesh.raycast(raycaster, intersectsGhostCutLines);
        expect(intersectsGhostCutLines.length).toBe(0);
    });
});

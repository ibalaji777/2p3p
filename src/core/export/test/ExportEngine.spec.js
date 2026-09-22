import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ExportEngine } from '../ExportEngine.js';
import { FileManager } from '../../io.js';
import { ServerClass } from '../../ServerClass.js';

describe('ExportEngine - Canonical Domain Authority for Export, Import, Printing & File Formats', () => {
    let mockPlanner;
    let mockLevelData;

    beforeEach(() => {
        if (typeof HTMLCanvasElement !== 'undefined') {
            vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
                createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
                fillStyle: '',
                fillRect: vi.fn()
            });
        }

        mockLevelData = JSON.stringify({
            walls: [{ id: 'wall_1', startX: 0, startY: 0, endX: 200, endY: 0 }],
            anchors: [{ id: 0, x: 0, y: 0 }, { id: 1, x: 200, y: 0 }],
            furniture: [{ id: 'sofa_1', type: 'furniture', x: 50, y: 50 }]
        });

        mockPlanner = {
            exportState: vi.fn(() => mockLevelData),
            importState: vi.fn(),
            syncAll: vi.fn(),
            settings: { wallTracking: true },
            stage: {
                toDataURL: vi.fn(({ pixelRatio, mimeType }) => `data:${mimeType};base64,mockStageImage_ratio_${pixelRatio}`)
            }
        };
    });

    describe('1. Schema Creation & Versioning', () => {
        it('creates a canonical Version 2.0 project manifest', () => {
            const levels = [
                { id: 'level_0', name: 'Ground Floor', elevation: 0, height: 280, data: mockLevelData },
                { id: 'level_1', name: 'First Floor', elevation: 280, height: 280, data: mockLevelData }
            ];

            const manifest = ExportEngine.createProjectPackage({
                levels,
                activeLevelIndex: 1,
                metadata: { name: 'Modern Villa', author: 'Architect' },
                settings: { wallHeight: 280 }
            });

            expect(manifest.version).toBe('2.0');
            expect(manifest.app).toBe('2P3P Planner');
            expect(manifest.timestamp).toBeDefined();
            expect(manifest.metadata.name).toBe('Modern Villa');
            expect(manifest.metadata.author).toBe('Architect');
            expect(manifest.metadata.levelCount).toBe(2);
            expect(manifest.activeLevelIndex).toBe(1);
            expect(manifest.levels.length).toBe(2);
            expect(manifest.settings.wallHeight).toBe(280);
        });

        it('clamps activeLevelIndex to valid bounds', () => {
            const manifest = ExportEngine.createProjectPackage({
                levels: [{ id: 'lvl_0', name: 'Ground', data: mockLevelData }],
                activeLevelIndex: 99
            });

            expect(manifest.activeLevelIndex).toBe(0);
        });
    });

    describe('2. Validation & Normalization', () => {
        it('validates multi-level v2.0 projects', () => {
            const project = {
                version: '2.0',
                levels: [{ id: 'lvl_1', data: '{}' }],
                activeLevelIndex: 0
            };

            const result = ExportEngine.validateProjectJSON(project);
            expect(result.valid).toBe(true);
            expect(result.version).toBe('2.0');
            expect(result.isMultiLevel).toBe(true);
        });

        it('validates legacy single-level v1.0 plans', () => {
            const legacy = {
                walls: [{ id: 'w1' }],
                anchors: [{ id: 0, x: 0, y: 0 }]
            };

            const result = ExportEngine.validateProjectJSON(legacy);
            expect(result.valid).toBe(true);
            expect(result.version).toBe('1.0');
            expect(result.isMultiLevel).toBe(false);
        });

        it('rejects corrupted or empty input', () => {
            expect(ExportEngine.validateProjectJSON(null).valid).toBe(false);
            expect(ExportEngine.validateProjectJSON('{ corrupt json').valid).toBe(false);
            expect(ExportEngine.validateProjectJSON({ foo: 'bar' }).valid).toBe(false);
        });

        it('parses and upgrades legacy v1.0 projects into v2.0 multi-level structure', () => {
            const legacyPlan = JSON.stringify({
                walls: [{ id: 'w1' }],
                anchors: [{ id: 0, x: 0, y: 0 }]
            });

            const upgraded = ExportEngine.parseProjectJSON(legacyPlan);
            expect(upgraded.version).toBe('2.0');
            expect(upgraded.levels.length).toBe(1);
            expect(upgraded.levels[0].name).toBe('Ground Floor');
            expect(upgraded.levels[0].elevation).toBe(0);
            expect(upgraded.metadata.upgradedFromVersion).toBe('1.0');
        });

        it('throws error when parsing invalid project payloads', () => {
            expect(() => ExportEngine.parseProjectJSON('invalid')).toThrow();
        });
    });

    describe('3. Safe Circular-Proof Stringification', () => {
        it('strips circular references and internal Three.js / Konva structures', () => {
            const circularObj = {
                id: 'obj_1',
                name: 'Room 1'
            };
            circularObj.self = circularObj; // circular cycle
            circularObj.mesh3D = new THREE.Mesh(); // Three.js mesh
            circularObj.wall = { id: 'parent_wall' }; // parent ref

            const json = ExportEngine.safeStringify(circularObj);
            const parsed = JSON.parse(json);

            expect(parsed.id).toBe('obj_1');
            expect(parsed.name).toBe('Room 1');
            expect(parsed.self).toBeUndefined();
            expect(parsed.mesh3D).toBeUndefined();
            expect(parsed.wall).toBeUndefined();
        });
    });

    describe('4. 2D Plan Image Export', () => {
        it('captures 2D plan blueprint with requested pixel ratio', () => {
            const dataUrl = ExportEngine.export2DPlanImage(mockPlanner, { pixelRatio: 3, mimeType: 'image/png' });

            expect(mockPlanner.stage.toDataURL).toHaveBeenCalledWith({ pixelRatio: 3, mimeType: 'image/png' });
            expect(dataUrl).toContain('mockStageImage_ratio_3');
        });

        it('gracefully returns null if stage is unavailable', () => {
            expect(ExportEngine.export2DPlanImage(null)).toBeNull();
            expect(ExportEngine.export2DPlanImage({})).toBeNull();
        });
    });

    describe('5. 3D Architectural Bounding Box', () => {
        it('computes tight bounding box and ignores hitboxes and invisible items', () => {
            const structureGroup = new THREE.Group();

            // Real wall mesh
            const wallGeo = new THREE.BoxGeometry(200, 100, 20);
            wallGeo.computeBoundingBox();
            const wallMesh = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial());
            wallMesh.position.set(100, 50, 10);
            structureGroup.add(wallMesh);

            // Technical hitbox mesh (should be ignored)
            const hitboxGeo = new THREE.BoxGeometry(1000, 1000, 1000);
            hitboxGeo.computeBoundingBox();
            const hitboxMesh = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial());
            hitboxMesh.userData.isHitbox = true;
            structureGroup.add(hitboxMesh);

            // Fully transparent mesh (should be ignored)
            const transparentMesh = new THREE.Mesh(hitboxGeo, new THREE.MeshStandardMaterial({ transparent: true, opacity: 0 }));
            structureGroup.add(transparentMesh);

            const preview3D = {
                structureGroup,
                staticStructureGroup: new THREE.Group()
            };

            const box = ExportEngine.getBuildingBoundingBox(preview3D);
            const size = new THREE.Vector3();
            box.getSize(size);

            expect(size.x).toBeCloseTo(200, 1);
            expect(size.y).toBeCloseTo(100, 1);
            expect(size.z).toBeCloseTo(20, 1);
        });
    });

    describe('6. 3D Studio Elevation Captures', () => {
        it('renders architectural views and cleans up temporary studio lighting', async () => {
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
            const domElement = {
                clientWidth: 800,
                clientHeight: 600,
                toDataURL: vi.fn(() => 'data:image/png;base64,mock3DView')
            };

            const renderer = {
                domElement,
                render: vi.fn(),
                getClearColor: vi.fn(() => new THREE.Color(0xffffff)),
                getClearAlpha: vi.fn(() => 1),
                setClearColor: vi.fn()
            };

            const preview3D = {
                scene,
                camera,
                renderer,
                structureGroup: new THREE.Group(),
                staticStructureGroup: new THREE.Group(),
                sceneSetup: {}
            };

            const initialChildrenCount = scene.children.length;
            const dataUrl = await ExportEngine.capture3DView(preview3D, 'front');

            expect(renderer.render).toHaveBeenCalled();
            expect(dataUrl).toBe('data:image/png;base64,mock3DView');
            // Verifies temporary studio lights & ground were cleanly disposed and removed from scene
            expect(scene.children.length).toBe(initialChildrenCount);
        });

        it('batch generates multi-angle previews asynchronously', async () => {
            const preview3D = {
                scene: new THREE.Scene(),
                camera: new THREE.PerspectiveCamera(),
                renderer: {
                    domElement: { toDataURL: vi.fn(() => 'data:image/png;base64,preview') },
                    render: vi.fn(),
                    getClearColor: vi.fn(() => new THREE.Color()),
                    getClearAlpha: vi.fn(() => 1),
                    setClearColor: vi.fn()
                },
                structureGroup: new THREE.Group(),
                staticStructureGroup: new THREE.Group()
            };

            const previews = await ExportEngine.generate3DPreviews(preview3D, ['top', 'front']);
            expect(previews.topPreview).toBe('data:image/png;base64,preview');
            expect(previews.frontPreview).toBe('data:image/png;base64,preview');
        });
    });

    describe('7. Backward-Compatible FileManager & ServerClass Integration', () => {
        it('exports and imports project data via FileManager delegating to ExportEngine', () => {
            const projectData = {
                levels: [{ id: 'lvl_0', data: mockLevelData }],
                activeLevelIndex: 0
            };

            // FileManager.exportJSON
            const jsonStr = FileManager.exportJSON(projectData);
            expect(jsonStr).toBeDefined();
            const parsed = JSON.parse(jsonStr);
            expect(parsed.version).toBe('2.0');

            // FileManager.importJSON
            FileManager.importJSON(mockPlanner, jsonStr);
            expect(mockPlanner.importState).toHaveBeenCalledWith(mockLevelData);
            expect(mockPlanner.syncAll).toHaveBeenCalled();
        });

        it('ServerClass delegates bounding box, views, and exports to ExportEngine', async () => {
            const preview3D = {
                scene: new THREE.Scene(),
                camera: new THREE.PerspectiveCamera(),
                renderer: {
                    domElement: { toDataURL: vi.fn(() => 'data:image/png;base64,serverPreview') },
                    render: vi.fn(),
                    getClearColor: vi.fn(() => new THREE.Color()),
                    getClearAlpha: vi.fn(() => 1),
                    setClearColor: vi.fn()
                },
                structureGroup: new THREE.Group(),
                staticStructureGroup: new THREE.Group()
            };

            const server = new ServerClass(preview3D, mockPlanner, () => ({ customState: 123 }), {
                baseUrl: 'http://test-server:5000'
            });

            expect(server.baseUrl).toBe('http://test-server:5000');

            // Bounding box
            const box = server.getBuildingBoundingBox();
            expect(box).toBeInstanceOf(THREE.Box3);

            // Export JSON
            const jsonStr = server.exportProjectJson();
            expect(JSON.parse(jsonStr).customState).toBe(123);

            // Capture view
            const viewData = await server.captureView('front');
            expect(viewData).toBe('data:image/png;base64,serverPreview');
        });
    });
});

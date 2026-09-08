import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import Konva from 'konva';
import { 
    DOOR_TYPES, 
    DOOR_STYLES_REGISTRY, 
    DOOR_SHAPES_REGISTRY, 
    DoorRegistry 
} from '../door.registry.js';
import { createDoorShape } from '../door.geometry.js';
import { renderDoor2D } from '../door.renderer2d.js';
import { renderDoor3D } from '../door.renderer3d.js';
import { MaterialSlots } from '../../../core/constants/materialSlots.js';

describe('Door Feature Engine & Architecture Suite', () => {
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

    const mockHelpers = {
        getDynamicMaterial: (matKey, type) => new THREE.MeshStandardMaterial({ color: 0x888888, name: `${type}_${matKey}` }),
        getFaceMaterials: () => ({ box: [new THREE.MeshStandardMaterial()] })
    };

    describe('Door Shapes & Geometry', () => {
        it('should generate valid THREE.Shape outlines for all geometric styles', () => {
            const squareShape = createDoorShape(60, 80, 'square');
            expect(squareShape).toBeInstanceOf(THREE.Shape);
            expect(squareShape.curves.length).toBeGreaterThanOrEqual(3);

            const radiusShape = createDoorShape(60, 80, 'radius', 0);
            expect(radiusShape).toBeInstanceOf(THREE.Shape);

            const segmentShape = createDoorShape(60, 80, 'segment', 0);
            expect(segmentShape).toBeInstanceOf(THREE.Shape);

            const gothicShape = createDoorShape(60, 80, 'gothic', 0);
            expect(gothicShape).toBeInstanceOf(THREE.Shape);

            const halfLeftShape = createDoorShape(30, 80, 'radius', -1);
            expect(halfLeftShape).toBeInstanceOf(THREE.Shape);

            const halfRightShape = createDoorShape(30, 80, 'radius', 1);
            expect(halfRightShape).toBeInstanceOf(THREE.Shape);
        });

        it('should have all 25+ door styles registered in DOOR_STYLES_REGISTRY', () => {
            expect(Object.keys(DOOR_STYLES_REGISTRY).length).toBeGreaterThanOrEqual(25);
            expect(DOOR_STYLES_REGISTRY.flat).toBeDefined();
            expect(DOOR_STYLES_REGISTRY.modern_grooved).toBeDefined();
            expect(DOOR_STYLES_REGISTRY.french || DOOR_STYLES_REGISTRY.glass_grid).toBeDefined();
            expect(DOOR_STYLES_REGISTRY.shaker_multi_panel).toBeDefined();
            expect(DOOR_STYLES_REGISTRY.classic_4_panel).toBeDefined();
        });
    });

    describe('2D CAD Plan View Rendering', () => {
        it('should render single swing door with Konva arc and line', () => {
            const group = new Konva.Group();
            const entity = {
                width: 60,
                doorType: 'single',
                facing: 1,
                side: 1,
                wall: { thickness: 20 }
            };

            renderDoor2D(group, entity);
            expect(group.children.length).toBeGreaterThanOrEqual(2);
        });

        it('should render double door with dual swing arcs', () => {
            const group = new Konva.Group();
            const entity = {
                width: 72,
                doorType: 'double',
                facing: 1,
                side: 1,
                wall: { thickness: 20 }
            };

            renderDoor2D(group, entity);
            expect(group.children.length).toBeGreaterThanOrEqual(4);
        });

        it('should render pocket door with track line', () => {
            const group = new Konva.Group();
            const entity = {
                width: 60,
                doorType: 'pocket',
                facing: 1,
                side: 1,
                wall: { thickness: 20 }
            };

            renderDoor2D(group, entity);
            expect(group.children.length).toBeGreaterThanOrEqual(2);
        });

        it('should render sidelights when hasSidelights is true', () => {
            const group = new Konva.Group();
            const entity = {
                width: 120,
                doorType: 'single',
                hasSidelights: true,
                facing: 1,
                side: 1,
                wall: { thickness: 20 }
            };

            renderDoor2D(group, entity);
            expect(group.children.length).toBeGreaterThanOrEqual(4);
        });
    });

    describe('3D BIM Assembly & Material Slot Pipeline', () => {
        it('should assemble 3D door with correct ComponentRegistry material slot tagging', () => {
            const entity = {
                id: 'door_unit_test_1',
                type: 'door',
                width: 60,
                height: 80,
                thick: 4,
                doorType: 'single',
                doorStyle: 'classic_4_panel',
                materials: {
                    leaf: { id: 'wood_golden_teak' },
                    frame: { id: 'wood_golden_teak' }
                },
                facing: 1,
                side: 1,
                elevation: 0,
                openAngle: 45
            };

            const sceneGroup = new THREE.Group();
            const doorGroup = renderDoor3D(sceneGroup, entity, mockHelpers);

            expect(doorGroup).toBeDefined();
            expect(doorGroup.isGroup).toBe(true);

            let hasFrame = false;
            let hasLeaf = false;
            let hasHandle = false;

            doorGroup.traverse(child => {
                if (child.userData?.materialSlot === MaterialSlots.FRAME || child.userData?.isFrame) hasFrame = true;
                if (child.userData?.materialSlot === MaterialSlots.LEAF) hasLeaf = true;
                if (child.userData?.materialSlot === MaterialSlots.HARDWARE || child.userData?.isHandle) hasHandle = true;
            });

            expect(hasFrame).toBe(true);
            expect(hasLeaf).toBe(true);
            expect(hasHandle).toBe(true);
        });

        it('should support double doors with dual rotating leaves in 3D', () => {
            const entity = {
                id: 'door_unit_test_2',
                type: 'door',
                width: 72,
                height: 80,
                thick: 4,
                doorType: 'double',
                doorStyle: 'flat',
                materials: {
                    leaf: { id: 'wood_golden_teak' },
                    frame: { id: 'wood_golden_teak' }
                },
                facing: 1,
                side: 1,
                elevation: 0,
                openAngle: 60
            };

            const sceneGroup = new THREE.Group();
            const doorGroup = renderDoor3D(sceneGroup, entity, mockHelpers);

            const movingParts = [];
            doorGroup.traverse(child => {
                if (child.userData?.isMovingPart) movingParts.push(child);
            });

            expect(movingParts.length).toBe(2);
        });

        it('should render Arched Double Doors (entry_arched_double) without rectangular corner protrusions', () => {
            const entity = {
                id: 'entry_arched_double_test',
                type: 'door',
                width: 80,
                height: 84,
                thick: 4,
                doorType: 'double',
                doorStyle: 'classic_2_panel',
                doorShape: 'radius',
                materials: {
                    leaf: { id: 'wood_golden_teak' },
                    frame: { id: 'wood_golden_teak' }
                },
                facing: 1,
                side: 1,
                elevation: 0,
                openAngle: 0
            };

            const sceneGroup = new THREE.Group();
            const doorGroup = renderDoor3D(sceneGroup, entity, mockHelpers);
            doorGroup.updateMatrixWorld(true);

            expect(doorGroup).toBeDefined();

            // Find all leaf panel meshes
            const leafMeshes = [];
            doorGroup.traverse(child => {
                if (child.isMesh && (child.userData?.materialSlot === MaterialSlots.LEAF || (!child.userData?.isFrame && !child.userData?.isHandle && !child.userData?.isShadow && !child.userData?.isThreshold && !child.userData?.isSillPlate))) {
                    leafMeshes.push(child);
                }
            });

            // 2 leaves with cut frame + recessed bottom panel + recessed top arched panel
            expect(leafMeshes.length).toBeGreaterThanOrEqual(4);

            leafMeshes.forEach(mesh => {
                if (mesh.geometry) {
                    mesh.geometry.computeBoundingBox();
                    const bbox = mesh.geometry.boundingBox;
                    if (bbox && !isNaN(bbox.max.y) && isFinite(bbox.max.y)) {
                        expect(bbox.max.y).toBeLessThanOrEqual(84.5);
                    }

                    // Verify UVs are properly normalized to [0, 1] range (not un-normalized shape coordinates)
                    const uvs = mesh.geometry.attributes?.uv;
                    if (uvs && uvs.count > 0) {
                        for (let i = 0; i < uvs.count; i++) {
                            const u = uvs.getX(i);
                            const v = uvs.getY(i);
                            expect(u).toBeGreaterThanOrEqual(-0.05);
                            expect(u).toBeLessThanOrEqual(1.05);
                            expect(v).toBeGreaterThanOrEqual(-0.05);
                            expect(v).toBeLessThanOrEqual(1.05);
                        }
                    }
                }
            });
        });

        it('should properly render single arched doors with styles (classic_4_panel, entry_grand_panel, modern_grooved)', () => {
            const styles = ['classic_4_panel', 'entry_grand_panel', 'modern_grooved', 'glass_bottom_panel', 'french'];
            styles.forEach(doorStyle => {
                const entity = {
                    id: `test_arch_${doorStyle}`,
                    type: 'door',
                    width: 40,
                    height: 84,
                    thick: 4,
                    doorType: doorStyle === 'french' ? 'french' : 'single',
                    doorStyle: doorStyle,
                    doorShape: 'radius',
                    materials: {
                        leaf: { id: 'wood_golden_teak' },
                        frame: { id: 'wood_golden_teak' }
                    },
                    facing: 1,
                    side: 1,
                    elevation: 0,
                    openAngle: 0
                };

                const sceneGroup = new THREE.Group();
                const doorGroup = renderDoor3D(sceneGroup, entity, mockHelpers);
                expect(doorGroup).toBeDefined();
                expect(doorGroup.children.length).toBeGreaterThan(0);
            });
        });
    });
});

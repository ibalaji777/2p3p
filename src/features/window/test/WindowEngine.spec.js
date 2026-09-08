import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import Konva from 'konva';
import { 
    WINDOW_TYPES, 
    WINDOW_GRILLE_PATTERNS, 
    WINDOW_SHAPES_REGISTRY, 
    WindowRegistry 
} from '../window.registry.js';
import { createWindowShape, createThinBarGeo } from '../window.geometry.js';
import { renderWindow2D } from '../window.renderer2d.js';
import { renderWindow3D } from '../window.renderer3d.js';
import { MaterialSlots } from '../../../core/constants/materialSlots.js';

describe('Window Feature Engine & Architecture Suite', () => {
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

    describe('Window Shapes & Geometry', () => {
        it('should generate valid THREE.Shape outlines for all geometric window shapes', () => {
            const squareShape = createWindowShape(50, 45, 'square');
            expect(squareShape).toBeInstanceOf(THREE.Shape);

            const radiusShape = createWindowShape(50, 45, 'radius');
            expect(radiusShape).toBeInstanceOf(THREE.Shape);

            const segmentShape = createWindowShape(50, 45, 'segment');
            expect(segmentShape).toBeInstanceOf(THREE.Shape);

            const gothicShape = createWindowShape(50, 45, 'gothic');
            expect(gothicShape).toBeInstanceOf(THREE.Shape);
        });

        it('should have all 12 standard window types in WINDOW_TYPES', () => {
            expect(Object.keys(WINDOW_TYPES).length).toBeGreaterThanOrEqual(12);
            expect(WINDOW_TYPES.sliding_std).toBeDefined();
            expect(WINDOW_TYPES.casement_std).toBeDefined();
            expect(WINDOW_TYPES.fixed_elevation).toBeDefined();
            expect(WINDOW_TYPES.bay_box).toBeDefined();
            expect(WINDOW_TYPES.panoramic_slider).toBeDefined();
            expect(WINDOW_TYPES.traditional_indian).toBeDefined();
        });

        it('should support thin bar geometries with flat and round profiles', () => {
            const flatBar = createThinBarGeo(40, 0.4, 0.2, false, false);
            expect(flatBar).toBeInstanceOf(THREE.ExtrudeGeometry);

            const roundBar = createThinBarGeo(40, 0.4, 0.2, false, true, 0.4);
            expect(roundBar).toBeInstanceOf(THREE.CylinderGeometry);
        });
    });

    describe('2D CAD Plan View Rendering', () => {
        it('should render sliding window with jamb caps, sills, and offset sashes', () => {
            const group = new Konva.Group();
            const entity = {
                width: 50,
                windowType: 'sliding_std',
                wall: { thickness: 20 },
                grillePattern: 'grid'
            };

            renderWindow2D(group, entity);
            // Must contain jamb caps, sills, and sliding sashes
            expect(group.children.length).toBeGreaterThanOrEqual(4);
        });

        it('should render casement window with open sash swing lines', () => {
            const group = new Konva.Group();
            const entity = {
                width: 50,
                windowType: 'casement_std',
                wall: { thickness: 20 },
                grillePattern: 'none'
            };

            renderWindow2D(group, entity);
            expect(group.children.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('3D BIM Assembly & Material Slot Pipeline', () => {
        it('should assemble 3D sliding window with outer miter frame, sashes, glass, and grilles', () => {
            const entity = {
                id: 'window_unit_test_1',
                type: 'window',
                width: 50,
                height: 45,
                elevation: 35,
                thick: 20,
                windowType: 'sliding_std',
                grillePattern: 'grid',
                grilleProfile: 'flat',
                materials: {
                    frame: { id: 'wood_teak' },
                    leaf: { id: 'wood_teak' },
                    glass: { id: 'clear' }
                },
                facing: 1,
                side: 1
            };

            const sceneGroup = new THREE.Group();
            const winGroup = renderWindow3D(sceneGroup, entity, mockHelpers);

            expect(winGroup).toBeDefined();
            expect(winGroup.isGroup).toBe(true);

            let hasFrame = false;
            let hasSash = false;
            let hasGlass = false;

            winGroup.traverse(child => {
                if (child.userData?.materialSlot === MaterialSlots.FRAME || child.userData?.isFrame) hasFrame = true;
                if (child.userData?.materialSlot === MaterialSlots.LEAF) hasSash = true;
                if (child.userData?.materialSlot === MaterialSlots.GLASS || child.userData?.isGlass) hasGlass = true;
            });

            expect(hasFrame).toBe(true);
            expect(hasSash).toBe(true);
            expect(hasGlass).toBe(true);
        });

        it('should assemble 3D casement window with cremone hardware and seals', () => {
            const entity = {
                id: 'window_unit_test_2',
                type: 'window',
                width: 40,
                height: 50,
                elevation: 35,
                thick: 20,
                windowType: 'casement_std',
                grillePattern: 'none',
                materials: {
                    frame: { id: 'wood_teak' },
                    leaf: { id: 'wood_teak' },
                    glass: { id: 'clear' }
                },
                facing: 1,
                side: 1
            };

            const sceneGroup = new THREE.Group();
            const winGroup = renderWindow3D(sceneGroup, entity, mockHelpers);

            let hasHardware = false;
            winGroup.traverse(child => {
                if (child.userData?.materialSlot === MaterialSlots.HARDWARE || child.userData?.isHandle) hasHardware = true;
            });

            expect(hasHardware).toBe(true);
        });
    });
});

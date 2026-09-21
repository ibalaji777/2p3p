import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { RoofEngine } from '../../../core/roof/RoofEngine.js';
import { RoofMutationEngine } from '../../../core/roof/RoofMutationEngine.js';
import { Roof3DBuilder } from '../builders/Roof3DBuilder.js';
import { CurvedPortal3DBuilder } from '../builders/CurvedPortal3DBuilder.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';

describe('CurvedPortalRoof Pipeline & 3D Assembly', () => {
    let mockPlanner;
    let mockCtx;

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
            roomPaths: [],
            stage: { width: () => 1000, height: () => 800, batchDraw: vi.fn() },
            roofLayer: { add: vi.fn() },
            executeWithSnapshot: (fn) => fn(),
            debouncedSaveHistory: vi.fn(),
            syncAll: vi.fn(),
            selectEntity: vi.fn((entity, type) => {
                mockPlanner.selectedEntity = entity;
                mockPlanner.selectedType = type;
            }),
            updateToolStates: vi.fn(),
            tool: 'select'
        };

        mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: new THREE.Group(),
            camera: new THREE.PerspectiveCamera(),
            renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } },
            helpers: {
                getDynamicMaterial: vi.fn((key) => new THREE.MeshStandardMaterial({ name: key })),
            },
            assets: {
                getTexture: vi.fn().mockResolvedValue(null)
            },
            planner: mockPlanner,
            requestRender: vi.fn(),
            interactables: []
        };
    });

    it('1. should create a curved_portal roof entity with default sharp corners', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = RoofEngine.createRoof(mockPlanner, points, {
            roofType: 'curved_portal',
            radius: 0,
            wallSides: { left: true, right: true, front: false, back: false },
            thickness: 15,
            overhang: 0
        });

        expect(roof).toBeDefined();
        expect(roof.config.roofType).toBe('curved_portal');
        expect(roof.config.radius).toBe(0);
        expect(roof.config.wallSides.left).toBe(true);
        expect(roof.config.wallSides.right).toBe(true);
        expect(roof.config.wallSides.front).toBe(false);
    });

    it('2. should build 3D mesh with sharp 90-degree corners when radius is 0', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = {
            id: 'test_curved_portal_1',
            points,
            config: {
                roofType: 'curved_portal',
                radius: 0,
                wallSides: { left: true, right: true, front: false, back: false },
                thickness: 15,
                hasSpotlights: true
            }
        };

        const resolveRoofMat = () => ({
            mat: new THREE.MeshStandardMaterial({ color: 0xffffff }),
            isGlass: false,
            decor: null,
            key: 'white_plaster_wall'
        });

        const meshGroup = CurvedPortal3DBuilder.build(roof, roof.config, points, 280, mockCtx, resolveRoofMat);

        expect(meshGroup).toBeDefined();
        expect(meshGroup.userData.componentType).toBe('curved_portal');

        // Check sub-meshes
        const submeshes = meshGroup.children;
        expect(submeshes.length).toBeGreaterThan(0);

        const outerMesh = submeshes.find(c => c.userData?.materialSlot === 'outer');
        const ceilMesh = submeshes.find(c => c.userData?.materialSlot === 'ceiling');
        const fasciaMesh = submeshes.find(c => c.userData?.materialSlot === 'fascia');
        const spotGroup = submeshes.find(c => c.name === 'CurvedPortal_Spotlights');

        expect(outerMesh).toBeDefined();
        expect(ceilMesh).toBeDefined();
        expect(fasciaMesh).toBeDefined();
        expect(spotGroup).toBeDefined();
    });

    it('3. should build 3D mesh with smooth fillet arcs when radius > 0', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = {
            id: 'test_curved_portal_2',
            points,
            config: {
                roofType: 'curved_portal',
                radius: 40,
                wallSides: { left: true, right: true, front: false, back: false },
                thickness: 15,
                hasSpotlights: false
            }
        };

        const resolveRoofMat = () => ({
            mat: new THREE.MeshStandardMaterial({ color: 0xffffff }),
            isGlass: false,
            decor: null,
            key: 'white_plaster_wall'
        });

        const meshGroup = CurvedPortal3DBuilder.build(roof, roof.config, points, 280, mockCtx, resolveRoofMat);

        const outerMesh = meshGroup.children.find(c => c.userData?.materialSlot === 'outer');
        expect(outerMesh).toBeDefined();

        // With radius > 0, outerMesh geometry must have more vertices due to arc subdivisions
        const posAttr = outerMesh.geometry.getAttribute('position');
        expect(posAttr.count).toBeGreaterThan(6); // More than just a single flat quad
    });

    it('4. should mutate corner radius via RoofEngine.setCornerRadius', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = RoofEngine.createRoof(mockPlanner, points, {
            roofType: 'curved_portal',
            radius: 0
        });

        RoofEngine.setCornerRadius(roof, 45, mockPlanner);
        expect(roof.config.radius).toBe(45);

        RoofEngine.setCornerRadius(roof, 0, mockPlanner);
        expect(roof.config.radius).toBe(0);
    });

    it('5. should mutate wall sides and presets via RoofEngine', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = RoofEngine.createRoof(mockPlanner, points, {
            roofType: 'curved_portal',
            wallSides: { left: true, right: true, front: false, back: false }
        });

        // Toggle individual wall
        RoofEngine.setWallSide(roof, 'left', false, mockPlanner);
        expect(roof.config.wallSides.left).toBe(false);

        // Apply 1-Wall Cantilever preset
        RoofEngine.setWallSides(roof, { left: true, right: false, front: false, back: false }, mockPlanner);
        expect(roof.config.wallSides.left).toBe(true);
        expect(roof.config.wallSides.right).toBe(false);

        // Apply 4-Wall Enclosed Cube preset
        RoofEngine.setWallSides(roof, { left: true, right: true, front: true, back: true }, mockPlanner);
        expect(roof.config.wallSides.front).toBe(true);
        expect(roof.config.wallSides.back).toBe(true);
    });

    it('6. should mutate wall drop height and spotlights via RoofEngine', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = RoofEngine.createRoof(mockPlanner, points, {
            roofType: 'curved_portal'
        });

        RoofEngine.setWallDropHeight(roof, 180, mockPlanner);
        expect(roof.config.wallDropHeight).toBe(180);

        RoofEngine.setSpotlights(roof, false, mockPlanner);
        expect(roof.config.hasSpotlights).toBe(false);

        RoofEngine.setSpotlights(roof, true, mockPlanner);
        expect(roof.config.hasSpotlights).toBe(true);
    });

    it('7. should integrate cleanly into Roof3DBuilder.buildRoofs', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 }
        ];

        const roof = {
            id: 'test_curved_portal_integration',
            points,
            config: {
                roofType: 'curved_portal',
                radius: 25,
                wallSides: { left: true, right: true, front: false, back: false },
                thickness: 15
            },
            elevation: 280
        };

        const targetGroup = new THREE.Group();
        const builder = new Roof3DBuilder(mockCtx);
        builder.buildRoofs([roof], 0, false, targetGroup);

        expect(targetGroup.children.length).toBe(1);
        const roofGroup = targetGroup.children[0];
        expect(roofGroup.userData.isRoof).toBe(true);

        const portalMesh = roofGroup.children.find(c => c.userData?.isCurvedPortal);
        expect(portalMesh).toBeDefined();
    });
});

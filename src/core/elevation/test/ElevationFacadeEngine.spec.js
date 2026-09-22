import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ElevationFacadeEngine } from '../ElevationFacadeEngine.js';

describe('ElevationFacadeEngine Canonical Subsystem', () => {
    let mockWall;
    let mockPlanner;

    beforeEach(() => {
        HTMLCanvasElement.prototype.getContext = () => ({
            fillRect: () => {},
            clearRect: () => {},
            getImageData: () => ({ data: new Array(4) }),
            putImageData: () => {},
            createImageData: () => [],
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
            fill: () => {}
        });

        mockWall = {
            id: 'wall_test_1',
            startX: 0,
            startY: 0,
            endX: 300,
            endY: 0,
            height: 280,
            elevation: 0,
            thickness: 20,
            attachedWidgets: []
        };

        mockPlanner = {
            elevationSegments: [],
            wallLayer: {
                batchDraw: vi.fn(),
                add: vi.fn()
            },
            widgetLayer: {
                batchDraw: vi.fn(),
                add: vi.fn()
            },
            uiLayer: {
                batchDraw: vi.fn(),
                add: vi.fn()
            },
            syncAll: vi.fn(),
            requestDraw: vi.fn(),
            selectEntity: vi.fn()
        };
    });

    describe('1. Elevation Segment Lifecycle & Creation', () => {
        it('should create an authoritative elevation segment attached to wall and planner', () => {
            const segment = ElevationFacadeEngine.createElevationSegment(
                mockWall,
                150, // localHitX
                140, // hitY
                1,   // facing (+1 front)
                { width: 35, depth: 45, material: 'wood', hasSpotlights: true },
                mockPlanner
            );

            expect(segment).toBeDefined();
            expect(segment.id).toContain('elevation_segment_');
            expect(segment.wallId).toBe('wall_test_1');
            expect(segment.wallFacing).toBe(1);
            expect(segment.width).toBe(35);
            expect(segment.depth).toBe(45);
            expect(segment.material).toBe('wood');
            expect(segment.hasSpotlights).toBe(true);
            expect(segment.points).toHaveLength(2);
            expect(segment.nodes).toHaveLength(2);
            expect(mockPlanner.elevationSegments).toContain(segment);
            expect(mockPlanner.syncAll).toHaveBeenCalled();
        });

        it('should safely delete elevation segment, cleaning 2D display and 3D meshes', () => {
            const segment = ElevationFacadeEngine.createElevationSegment(
                mockWall, 150, 140, 1, {}, mockPlanner
            );
            expect(mockPlanner.elevationSegments).toHaveLength(1);

            const destroyChildren = vi.fn();
            const destroy = vi.fn();
            segment.group = { destroyChildren, destroy };

            const preview3D = {
                interactables: [],
                requestRender: vi.fn()
            };

            ElevationFacadeEngine.deleteElevationSegment(mockPlanner, segment.id, preview3D);

            expect(mockPlanner.elevationSegments).toHaveLength(0);
            expect(destroyChildren).toHaveBeenCalled();
            expect(destroy).toHaveBeenCalled();
            expect(preview3D.requestRender).toHaveBeenCalledWith('elevation_segment_deleted');
        });
    });

    describe('2. Graph Manipulations (Sprouting, Nodes, Bends)', () => {
        it('should sprout bend at segment endpoint', () => {
            const segment = ElevationFacadeEngine.createElevationSegment(
                mockWall, 150, 140, 1, {}, mockPlanner
            );

            const result = ElevationFacadeEngine.sproutBend(segment, 1, 'up', 100);
            expect(result).toBeDefined();
            expect(segment.points.length).toBe(3);
            expect(segment.nodes.length).toBe(3);
        });

        it('should sprout T-branch from interior node', () => {
            const segment = ElevationFacadeEngine.createElevationSegment(
                mockWall, 150, 140, 1, {}, mockPlanner
            );
            ElevationFacadeEngine.sproutBend(segment, 1, 'up', 100);
            expect(segment.points.length).toBe(3);

            // Sprout branch from middle node (index 1)
            const branchResult = ElevationFacadeEngine.sproutBranch(segment, 1, 'forward', 80);
            expect(branchResult).toBeDefined();
            expect(segment.branches.length).toBeGreaterThan(0);
        });

        it('should move and delete nodes', () => {
            const segment = ElevationFacadeEngine.createElevationSegment(
                mockWall, 150, 140, 1, {}, mockPlanner
            );
            const originalY = segment.points[0].y;

            ElevationFacadeEngine.moveNode(segment, 0, 10, 25, 0);
            expect(segment.points[0].y).toBe(originalY + 25);
            expect(segment.nodes[0].y).toBe(originalY + 25);

            // Add node and delete
            ElevationFacadeEngine.sproutBend(segment, 1, 'up', 100);
            expect(segment.points.length).toBe(3);

            ElevationFacadeEngine.deleteNode(segment, 2);
            expect(segment.points.length).toBe(2);
        });

        it('should update corner style and radius', () => {
            const segment = ElevationFacadeEngine.createElevationSegment(
                mockWall, 150, 140, 1, {}, mockPlanner
            );
            ElevationFacadeEngine.sproutBend(segment, 1, 'up', 100);

            ElevationFacadeEngine.setCornerStyle(segment, 1, 'fillet', 15);
            expect(segment.points[1].cornerStyle).toBe('fillet');
            expect(segment.points[1].radius).toBe(15);
        });
    });

    describe('3. Parameters & Spotlights', () => {
        it('should update dimensions, material, and spotlights', () => {
            const segment = ElevationFacadeEngine.createElevationSegment(
                mockWall, 150, 140, 1, {}, mockPlanner
            );

            ElevationFacadeEngine.setWidth(segment, 50);
            expect(segment.width).toBe(50);

            ElevationFacadeEngine.setDepth(segment, 60);
            expect(segment.depth).toBe(60);

            ElevationFacadeEngine.setMaterial(segment, 'travertine');
            expect(segment.material).toBe('travertine');

            ElevationFacadeEngine.toggleSpotlights(segment, true, 60);
            expect(segment.hasSpotlights).toBe(true);
            expect(segment.spotlightSpacing).toBe(60);
        });
    });

    describe('4. Serialization & Deserialization', () => {
        it('should round-trip serialize and deserialize cleanly', () => {
            const original = ElevationFacadeEngine.createElevationSegment(
                mockWall, 150, 140, 1, { width: 40, depth: 55, material: 'bronze', hasSpotlights: true }, mockPlanner
            );
            ElevationFacadeEngine.sproutBend(original, 1, 'up', 120);

            const jsonState = ElevationFacadeEngine.serializeElevationSegment(original);
            expect(jsonState).toBeDefined();
            expect(jsonState.type).toBe('elevation_segment');
            expect(jsonState.width).toBe(40);
            expect(jsonState.depth).toBe(55);
            expect(jsonState.points).toHaveLength(3);

            const restoredPlanner = { elevationSegments: [] };
            const restored = ElevationFacadeEngine.deserializeElevationSegment(restoredPlanner, jsonState);

            expect(restored).toBeDefined();
            expect(restored.id).toBe(original.id);
            expect(restored.material).toBe('bronze');
            expect(restored.points).toHaveLength(3);
            expect(restoredPlanner.elevationSegments).toContain(restored);
        });
    });

    describe('5. Facade Ribbons & Fascia Catalogs', () => {
        it('should expose facade ribbon config and materials', () => {
            const config = ElevationFacadeEngine.getFacadeRibbonConfig();
            expect(config.id).toBe('facade_ribbon_draw');
            expect(config.defaultParams.width).toBe(40);

            const mats = ElevationFacadeEngine.getFacadeRibbonMaterials();
            expect(mats.wood).toBeDefined();
            expect(mats.travertine).toBeDefined();
            expect(mats.marble).toBeDefined();
        });

        it('should expose fascia registry, types, materials, and catalog', () => {
            const types = ElevationFacadeEngine.getFasciaTypes();
            expect(types.c_shape_left).toBeDefined();
            expect(types.tower_corner_wrap_left).toBeDefined();

            const mats = ElevationFacadeEngine.getFasciaMaterials();
            expect(mats.white).toBeDefined();
            expect(mats.wood).toBeDefined();

            const catalog = ElevationFacadeEngine.getFasciaCatalog();
            expect(Array.isArray(catalog)).toBe(true);
            expect(catalog.length).toBeGreaterThan(0);
        });

        it('should create an elevation_fascia widget via createFascia delegating to WallEngine', () => {
            const fascia = ElevationFacadeEngine.createFascia(
                mockPlanner,
                mockWall,
                0.5,
                'c_shape_left',
                { width: 120, height: 140, depth: 45, fasciaMat: 'dark_grey' }
            );

            expect(fascia).toBeDefined();
            expect(fascia.type).toBe('elevation_fascia');
            expect(fascia.profileType || fascia.params?.profileType).toBe('c_shape_left');
            expect(fascia.width || fascia.params?.width).toBe(120);
            expect(fascia.depth || fascia.params?.depth).toBe(45);
            expect(mockWall.attachedWidgets).toContain(fascia);
        });
    });

    describe('6. Vertical Elevation Coordination', () => {
        it('should coordinate elevation segments when host wall rises or shifts', () => {
            const segment = ElevationFacadeEngine.createElevationSegment(
                mockWall, 150, 140, 1, {}, mockPlanner
            );
            segment.anchorMode = 'top';

            const startY = segment.points[0].y;

            // Wall height increases by 50cm
            ElevationFacadeEngine.syncSegmentsWithWall(mockWall, mockPlanner, null, 50, 0);

            expect(segment.points[0].y).toBe(startY + 50);
            expect(segment.nodes[0].y).toBe(startY + 50);
        });
    });
});

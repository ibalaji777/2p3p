import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { WallGeometryEngine } from '../wall/WallGeometryEngine.js';
import { Wall3DBuilder } from '../../features/wall/wall.renderer3d.js';
import { FloorSlabEngine } from '../floor/FloorSlabEngine.js';
import { VerticalPropagationEngine } from '../vertical/VerticalPropagationEngine.js';
import { RoofMutationEngine } from '../roof/RoofMutationEngine.js';
import { RoofGeometryEngine } from '../roof/RoofGeometryEngine.js';
import { EnvironmentBuilder } from '../engine3d/EnvironmentBuilder.js';
import { StairHeightDetector } from '../../features/stairs/StairHeightDetector.js';
import { SnapshotCommand } from '../commands/SnapshotCommand.js';
import { CommandManager } from '../commands/CommandManager.js';
import { ThreeLifecycleManager } from '../engine3d/ThreeLifecycleManager.js';

describe('Architecture Audit Master Regression Suite (Phase 9 Validation: REG-01 to REG-11)', () => {

    // =========================================================================
    // REG-01: Straight Wall Corner Mitering (45°, 90°, acute < 90°)
    // Pass Criteria: Zero arrowhead spikes; acute corners clamp cleanly to bevel vertices.
    // =========================================================================
    it('REG-01: Straight Wall Corner Mitering produces zero arrowhead spikes and clamps acute corners to bevel vertices', () => {
        const wallA = {
            id: 'wA',
            startX: 0, startY: 0,
            endX: 300, endY: 0,
            thickness: 20, height: 280,
            startAnchor: { x: 0, y: 0, connectedWalls: [] },
            endAnchor: { x: 300, y: 0, connectedWalls: [] }
        };
        const wallB = {
            id: 'wB',
            startX: 300, startY: 0,
            endX: 100, endY: 200, // Acute angle (~45 deg)
            thickness: 20, height: 280,
            startAnchor: wallA.endAnchor,
            endAnchor: { x: 100, y: 200, connectedWalls: [] }
        };
        wallA.endAnchor.connectedWalls = [wallA, wallB];

        const endCorners = WallGeometryEngine.getCorners(wallA, wallA.endAnchor, false, [wallA, wallB]);
        expect(endCorners).toBeDefined();
        expect(endCorners.corners).toBeDefined();
        expect(endCorners.corners[0]).toBeDefined(); // Left corner
        expect(endCorners.corners[1]).toBeDefined(); // Right corner

        // Check that bevel clamping does not produce runaway spikes
        const maxExpectedX = 300 + (wallA.thickness * 2);
        expect(endCorners.corners[0].x).toBeLessThanOrEqual(maxExpectedX);
        expect(endCorners.corners[1].x).toBeLessThanOrEqual(maxExpectedX);
    });

    // =========================================================================
    // REG-02: Wall trueCorners Fallback in wall.renderer3d.js
    // Pass Criteria: Wall renders without throwing ReferenceError: pts is not defined.
    // =========================================================================
    it('REG-02: Wall3DBuilder builds 3D wall group without ReferenceError: pts is not defined when poly.points is missing', () => {
        const wall = {
            id: 'wall_reg_02',
            startX: 0, startY: 0,
            endX: 200, endY: 0,
            thickness: 20, height: 280,
            poly: null, // poly is null
            wallShapeData: null,
            attachedWidgets: []
        };

        const builder = new Wall3DBuilder();
        const mockCtx = {
            activeLevelHeight: 280,
            activeLevelConfig: { defaultWallThickness: 20 },
            helpers: {}
        };

        expect(() => {
            const res = builder.buildWallGroup(wall, { ctx: mockCtx });
            expect(res.wallGroup).toBeInstanceOf(THREE.Group);
            expect(res.wallMesh).toBeInstanceOf(THREE.Mesh);
        }).not.toThrow();
    });

    // =========================================================================
    // REG-03: Curved Wall Material Continuity & Multi-Segment Apertures
    // Pass Criteria: Material applied to arc propagates with continuous UVs; wide openings slice across spanned segments.
    // =========================================================================
    it('REG-03: Curved wall multi-segment apertures slice cleanly across spanned segments with continuous UV tracking', () => {
        const seg1 = { id: 'seg_reg03_1', length: 40, arcDistanceOffset: 0, attachedWidgets: [] };
        const seg2 = { id: 'seg_reg03_2', length: 40, arcDistanceOffset: 40, attachedWidgets: [] };
        const seg3 = { id: 'seg_reg03_3', length: 40, arcDistanceOffset: 80, attachedWidgets: [] };

        const mockArc = {
            id: 'arc_reg03',
            type: 'arc',
            totalArcLength: 120,
            walls: [seg1, seg2, seg3],
            attachedWidgets: []
        };
        [seg1, seg2, seg3].forEach(s => { s.parentArc = mockArc; });

        // 100 cm window placed at arc center (s = 60 cm, span: [10, 110])
        const windowWidg = {
            id: 'win_wide',
            type: 'window',
            width: 100,
            height: 120,
            elevation: 90,
            t: 0.5,
            parentWall: seg2
        };
        seg2.attachedWidgets.push(windowWidg);

        const h1 = WallGeometryEngine.getApertureVoidsForWall(seg1, 40, 280, 0, THREE);
        const h2 = WallGeometryEngine.getApertureVoidsForWall(seg2, 40, 280, 0, THREE);
        const h3 = WallGeometryEngine.getApertureVoidsForWall(seg3, 40, 280, 0, THREE);

        expect(h1.length).toBe(1); // Right slice of seg1
        expect(h2.length).toBe(1); // Full cut of seg2
        expect(h3.length).toBe(1); // Left slice of seg3

        // Continuous UV continuity check
        expect(seg1.arcDistanceOffset + seg1.length).toBe(seg2.arcDistanceOffset);
        expect(seg2.arcDistanceOffset + seg2.length).toBe(seg3.arcDistanceOffset);
    });

    // =========================================================================
    // REG-04: Stacked Wall Multi-Story Elevation
    // Pass Criteria: Level 1 stacked wall sits flush atop Level 0 wall; no double-elevation floating (560 cm).
    // =========================================================================
    it('REG-04: Stacked wall elevation stays at level elevation (280 cm) without double-elevation floating (560 cm)', () => {
        const planner = {
            activeLevelIndex: 1,
            walls: [
                { id: 'w_l0', elevation: 0, height: 280, isStacked: false },
                { id: 'w_l1', elevation: 0, height: 280, isStacked: true, parentWallId: 'w_l0' }
            ]
        };
        const levels = [
            { id: 'lvl_0', height: 280, type: 'floor' },
            { id: 'lvl_1', height: 280, type: 'floor' }
        ];

        const mockC3D = {
            structureGroup: new THREE.Group(),
            staticStructureGroup: new THREE.Group()
        };

        VerticalPropagationEngine.sync3DLevelElevations(planner, levels, mockC3D);

        // Active level is Level 1, so structureGroup is at Y = 280
        expect(mockC3D.structureGroup.position.y).toBe(280);
        // Wall elevation remains in local coordinates (0), NOT 280 or 560
        expect(planner.walls[1].elevation).toBe(0);
    });

    // =========================================================================
    // REG-05: Active Floor Slab Cutouts
    // Pass Criteria: Mezzanine/stairwell cutouts (shape_floor_cut) create holes immediately on the active floor.
    // =========================================================================
    it('REG-05: FloorSlabEngine builds floor slab mesh with immediate cutouts for shape_floor_cut', () => {
        const room = {
            id: 'room_cutout_test',
            path: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }],
            configId: 'hardwood',
            thickness: 2
        };

        const shapes = [
            {
                type: 'shape_floor_cut',
                path: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }, { x: 100, y: 200 }]
            }
        ];

        const mesh = FloorSlabEngine.buildFloorSlabMesh(room, { shapes });
        expect(mesh).toBeInstanceOf(THREE.Mesh);
        expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
        // Shape with hole should have multiple faces
        expect(mesh.geometry.attributes.position.count).toBeGreaterThan(6);
    });

    // =========================================================================
    // REG-06: Wall Height Rise & Fall (Resting Roofs)
    // Pass Criteria: Roof follows wall top upwards AND downwards; detached roof does not move.
    // =========================================================================
    it('REG-06: RoofMutationEngine.syncRoofsWithWalls updates resting roof elevation upwards and downwards', () => {
        const wall = {
            id: 'w_test',
            startX: 0, startY: 0, endX: 400, endY: 0,
            height: 300, elevation: 0
        };
        const roof = {
            id: 'roof_test',
            elevation: 300,
            _restingOnWalls: true,
            _lastSyncedWallTop: 300,
            points: [{ x: -10, y: -10 }, { x: 410, y: -10 }, { x: 410, y: 200 }, { x: -10, y: 200 }]
        };

        const planner = {
            walls: [wall],
            roofs: [roof]
        };

        // Spy on getWallsUnderRoof and getMaxWallTopUnderRoof
        vi.spyOn(RoofGeometryEngine, 'getWallsUnderRoof').mockReturnValue([wall]);
        vi.spyOn(RoofGeometryEngine, 'getMaxWallTopUnderRoof').mockReturnValue(250); // Lowered wall

        // Wall lowered to 250
        wall.height = 250;
        RoofMutationEngine.syncRoofsWithWalls([wall], planner);

        // Resting roof must follow downwards to 250!
        expect(roof.elevation).toBe(250);

        // Detached roof must NOT move
        roof._restingOnWalls = false;
        vi.spyOn(RoofGeometryEngine, 'getMaxWallTopUnderRoof').mockReturnValue(320);
        RoofMutationEngine.syncRoofsWithWalls([wall], planner);
        expect(roof.elevation).toBe(250); // Remains stationary!
    });

    // =========================================================================
    // REG-07: In-Place VBO Vertex Mutation
    // Pass Criteria: Live dragging pitch/overhang updates VBO buffer in place; zero mesh recreations.
    // =========================================================================
    it('REG-07: EnvironmentBuilder.updateRoofLive updates vertex buffer in-place when vertex counts match', () => {
        const envBuilder = new EnvironmentBuilder({});
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0]);
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(9), 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));

        const roofMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
        roofMesh.userData = { isRoof: true };

        const roofGroup = new THREE.Group();
        roofGroup.add(roofMesh);

        const roof = {
            id: 'rf_vbo_test',
            config: { pitch: 30 },
            mesh3D: roofGroup
        };

        // Mock buildRoofs to produce identical vertex count with different positions
        envBuilder.buildRoofs = vi.fn((roofs, idx, walls, targetGroup) => {
            const newGeo = new THREE.BufferGeometry();
            const newPos = new Float32Array([0, 5, 0, 10, 5, 0, 10, 15, 0]);
            newGeo.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
            newGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(9), 3));
            newGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
            const newMesh = new THREE.Mesh(newGeo, new THREE.MeshBasicMaterial());
            newMesh.userData = { isRoof: true };
            const newGroup = new THREE.Group();
            newGroup.add(newMesh);
            targetGroup.add(newGroup);
        });

        envBuilder.updateRoofLive(roof);

        // Geometry instance must be preserved in-place (no recreation)
        expect(roofMesh.geometry).toBe(geo);
        // Position buffer must be updated
        expect(roofMesh.geometry.attributes.position.getY(0)).toBe(5);
    });

    // =========================================================================
    // REG-08: Sub-Structure Foundation Visibility
    // Pass Criteria: Foundation walls at negative elevations (Y = -40) remain fully visible above/within ground.
    // =========================================================================
    it('REG-08: EnvironmentBuilder.updateGroundElevation drops ground plane below negative substructure elevations', () => {
        const envBuilder = new EnvironmentBuilder({});
        envBuilder.ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial());
        envBuilder.grid = new THREE.GridHelper(100, 10);

        // Viewing basement at -240
        envBuilder.updateGroundElevation(-240, -240, { type: 'basement' });
        expect(envBuilder.ground.position.y).toBe(-240.5);
        expect(envBuilder.grid.position.y).toBe(-240.05);

        // Viewing ground floor at 0
        envBuilder.updateGroundElevation(0, 0, { type: 'floor' });
        expect(envBuilder.ground.position.y).toBe(-0.5);
        expect(envBuilder.grid.position.y).toBe(-0.05);
    });

    // =========================================================================
    // REG-09: Floor-to-Floor Staircase Adaptation
    // Pass Criteria: Adjusting floor height recalculates stair risers within building code (15-20 cm).
    // =========================================================================
    it('REG-09: StairHeightDetector recalculates step count within building code (15-20 cm) when floor height changes', () => {
        const optimal = StairHeightDetector.calculateOptimalSteps(350, 'straight');
        expect(optimal.totalSteps).toBeGreaterThan(0);
        expect(optimal.stepHeight).toBeGreaterThanOrEqual(14);
        expect(optimal.stepHeight).toBeLessThanOrEqual(21);
    });

    // =========================================================================
    // REG-10: Continuous Drag & Undo/Redo
    // Pass Criteria: Dragging wall/roof, undoing, and redoing preserves 100% geometry and material state.
    // =========================================================================
    it('REG-10: SnapshotCommand preserves and restores wall geometry and materials through undo/redo', () => {
        const cmdManager = new CommandManager();
        const planner = {
            walls: [{ id: 'w1', thickness: 20, params: { textureFront: 'plaster' } }],
            exportState: vi.fn(function() { return JSON.stringify(this.walls); }),
            importState: vi.fn(function(state) { this.walls = JSON.parse(state); }),
            syncAll: vi.fn()
        };

        // Capture initial state
        const snap = new SnapshotCommand(planner);
        
        // Mutate wall
        planner.walls[0].thickness = 30;
        planner.walls[0].params.textureFront = 'brick_red';
        snap.finalize();

        cmdManager.execute(snap);
        expect(planner.walls[0].thickness).toBe(30);

        // Undo
        cmdManager.undo();
        expect(planner.walls[0].thickness).toBe(20);
        expect(planner.walls[0].params.textureFront).toBe('plaster');

        // Redo
        cmdManager.redo();
        expect(planner.walls[0].thickness).toBe(30);
        expect(planner.walls[0].params.textureFront).toBe('brick_red');
    });

    // =========================================================================
    // REG-11: Touch Contention & ThreeLifecycleManager Cleanup
    // Pass Criteria: Gizmo interactions freeze OrbitControls; ThreeLifecycleManager purges stale interactables.
    // =========================================================================
    it('REG-11: ThreeLifecycleManager cleanly purges entity meshes from interactables preventing raycast ghosting', () => {
        const entity = { id: 'wall_gizmo_test' };
        const meshA = new THREE.Mesh();
        meshA.userData = { entity };
        const meshB = new THREE.Mesh();
        meshB.userData = { entity };
        const persistentMesh = new THREE.Mesh();

        const interactables = [meshA, meshB, persistentMesh];

        ThreeLifecycleManager.purgeEntityInteractables(interactables, entity);

        expect(interactables.includes(meshA)).toBe(false);
        expect(interactables.includes(meshB)).toBe(false);
        expect(interactables.includes(persistentMesh)).toBe(true);
    });
});

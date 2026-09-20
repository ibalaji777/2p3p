import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { WallEngine } from '../WallEngine.js';
import { WallTopologyEngine } from '../WallTopologyEngine.js';
import { WallMutationEngine } from '../WallMutationEngine.js';
import { PremiumArc } from '../../engine2d/PremiumArc.js';
import { SelectionManager } from '../../engine3d/SelectionManager.js';
import { MaterialGizmo } from '../../engine3d/MaterialGizmo.js';
import { RoomInteractiveSuite } from '../../engine3d/RoomInteractiveSuite.js';


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

describe('Curved Wall Architecture Compliance', () => {
    let mockPlanner;
    let a1, a2, arc;

    beforeEach(() => {
        const anchors = [];
        const walls = [];

        mockPlanner = {
            walls,
            anchors,
            arcs: [],
            wallLayer: { add: vi.fn(), batchDraw: vi.fn() },
            uiLayer: { add: vi.fn(), batchDraw: vi.fn() },
            mainLayer: { batchDraw: vi.fn() },
            stage: { batchDraw: vi.fn() },
            selectedEntity: null,
            selectedType: null,
            tool: 'select',
            syncAll: vi.fn(),
            update3D: vi.fn(),
            saveHistory: vi.fn(),
            selectEntity: vi.fn(function(ent, type) {
                this.selectedEntity = ent;
                this.selectedType = type;
            }),
            getOrCreateAnchor: function(x, y) {
                const aList = this.anchors || anchors;
                const wList = this.walls || walls;
                let existing = aList.find(a => Math.hypot(a.x - x, a.y - y) < 2.0);
                if (existing) return existing;
                const newA = {
                    x, y,
                    position: function(p) {
                        if (p) { this.x = p.x; this.y = p.y; return this; }
                        return { x: this.x, y: this.y };
                    },
                    node: { destroy: vi.fn() },
                    hide: vi.fn(),
                    show: vi.fn(),
                    getConnectedWalls: () => (this.walls || wList).filter(w => w.startAnchor === newA || w.endAnchor === newA)
                };
                aList.push(newA);
                return newA;
            }
        };

        a1 = mockPlanner.getOrCreateAnchor(0, 0);
        a2 = mockPlanner.getOrCreateAnchor(100, 0);
        arc = new PremiumArc(mockPlanner, a1, a2, { x: 50, y: 30 }, {
            thickness: 20,
            height: 280,
            elevation: 0
        });
        mockPlanner.arcs.push(arc);
    });

    it('1. Single Entity Selection in 2D & 3D: clicking any segment selects the canonical arc', () => {
        expect(arc.walls.length).toBeGreaterThan(1);

        // 2D: clicking sub-segment poly delegates to parent arc
        const firstSegment = arc.walls[0];
        expect(firstSegment.parentArc).toBe(arc);

        mockPlanner.selectEntity(firstSegment.parentArc, 'arc');
        expect(mockPlanner.selectedEntity).toBe(arc);
        expect(mockPlanner.selectedType).toBe('arc');

        // 3D: SelectionManager resolves hit on sub-segment mesh to 'arc'
        const mockCtx = { currentTransformMode: 'normal' };
        const mockSystem = { highlightRenderer: null, wallHighlight: new THREE.Mesh() };
        const selManager = new SelectionManager(mockCtx, mockSystem);

        const mockGroup = new THREE.Group();
        mockGroup.userData = { isWallGroup: true, entity: firstSegment };
        const mockMesh = new THREE.Mesh();
        mockMesh.userData = { isWallMesh: true, entity: firstSegment };
        mockGroup.add(mockMesh);
        firstSegment.mesh3D = mockGroup;
        firstSegment.wallMesh3D = mockMesh;

        const res = selManager.select(mockMesh);
        expect(res.type).toBe('arc');
    });

    it('2. Uniform Thickness Mutation: setThickness on arc or segment propagates to 100% of constituent walls', () => {
        WallEngine.setThickness(arc, 35, true, mockPlanner);
        expect(arc.thickness).toBe(35);
        arc.walls.forEach(seg => {
            expect(seg.thickness).toBe(35);
        });

        // Also if called on an individual segment
        const midSeg = arc.walls[1];
        WallEngine.setThickness(midSeg, 42, true, mockPlanner);
        expect(arc.thickness).toBe(42);
        arc.walls.forEach(seg => {
            expect(seg.thickness).toBe(42);
        });
    });

    it('3. Uniform Height & Elevation Mutation: setHeight and setElevation synchronize across all segments', () => {
        WallEngine.setHeight(arc, 320, true, mockPlanner);
        expect(arc.height).toBe(320);
        arc.walls.forEach(seg => {
            expect(seg.height).toBe(320);
        });

        WallEngine.setElevation(arc, 50, true, mockPlanner);
        expect(arc.elevation).toBe(50);
        arc.walls.forEach(seg => {
            expect(seg.elevation).toBe(50);
        });
    });

    it('4. Uniform Top Profile Mutation: setTopProfile synchronizes across all segments', () => {
        WallEngine.setTopProfile(arc, 'gable', { peakHeight: 400 }, true, mockPlanner);
        expect(arc.topProfileType).toBe('gable');
        arc.walls.forEach(seg => {
            expect(seg.topProfileType).toBe('gable');
            expect(seg.peakHeight).toBe(400);
        });
    });

    it('5. Push/Pull in Thickness Mode: expands thickness uniformly without tearing sub-segment lines', () => {
        const initialCount = arc.walls.length;
        WallEngine.pushPull(arc, 'front', 15, { mode: 'thickness', initialThickness: 20 }, mockPlanner);

        expect(arc.thickness).toBe(35);
        arc.walls.forEach(seg => {
            expect(seg.thickness).toBe(35);
        });
        expect(arc.walls.length).toBe(initialCount);
    });

    it('6. Push/Pull in Baseline Mode: shifts apex position along radial normal and rebuilds cleanly', () => {
        const initialPosY = arc.pos.y;
        WallEngine.pushPull(arc, 'front', 20, { mode: 'baseline', initialArcPos: { x: 50, y: 30 } }, mockPlanner);

        expect(arc.pos.y).not.toBe(initialPosY);
        expect(arc.walls.length).toBeGreaterThan(0);
        arc.walls.forEach(seg => {
            expect(seg.parentArc).toBe(arc);
        });
    });

    it('7. Synchronous Translation (moveWall): translates all anchors, control apex, and rebuilds', () => {
        const initialP1 = { ...a1.position() };
        const initialPos = { ...arc.pos };

        WallEngine.moveWall(arc, 25, -15, true, mockPlanner);

        expect(a1.position().x).toBe(initialP1.x + 25);
        expect(a1.position().y).toBe(initialP1.y - 15);
        expect(arc.pos.x).toBe(initialPos.x + 25);
        expect(arc.pos.y).toBe(initialPos.y - 15);
    });

    it('8. Material Application: paints front/back/sides uniformly across all constituent segments', () => {
        // Setup mock 3D meshes for constituent segments
        arc.walls.forEach(w => {
            const wallMesh = new THREE.Mesh(
                new THREE.BoxGeometry(20, 280, 20),
                [
                    new THREE.MeshBasicMaterial(),
                    new THREE.MeshBasicMaterial(),
                    new THREE.MeshBasicMaterial(),
                    new THREE.MeshBasicMaterial(),
                    new THREE.MeshBasicMaterial(),
                    new THREE.MeshBasicMaterial()
                ]
            );
            wallMesh.userData = { isWallMesh: true, entity: w };
            const wallGroup = new THREE.Group();
            wallGroup.userData = { isWallGroup: true, entity: w };
            wallGroup.add(wallMesh);
            w.mesh3D = wallGroup;
            w.wallMesh3D = wallMesh;
        });

        WallEngine.applyMaterial(arc, { target: 'front', key: 'stone_slate' }, mockPlanner);

        expect(arc.params.textureFront).toBe('stone_slate');
        arc.walls.forEach(w => {
            expect(w.params.textureFront).toBe('stone_slate');
        });
    });

    it('9. Lossless Persistence: serialization and deserialization retain ID and all arc properties', () => {
        arc.params = { textureFront: 'granite_dark', textureBack: 'white_paint' };
        arc.thickness = 28;
        arc.height = 300;

        // Export state
        const exportedArc = {
            id: arc.id,
            p1: { x: arc.p1.x, y: arc.p1.y },
            p2: { x: arc.p2.x, y: arc.p2.y },
            pos: arc.pos,
            thickness: arc.thickness,
            height: arc.height,
            elevation: arc.elevation,
            params: arc.params
        };

        // Import into fresh planner
        const newPlanner = {
            walls: [],
            anchors: [],
            arcs: [],
            wallLayer: { add: vi.fn(), batchDraw: vi.fn() },
            uiLayer: { add: vi.fn(), batchDraw: vi.fn() },
            mainLayer: { batchDraw: vi.fn() },
            stage: { batchDraw: vi.fn() },
            getOrCreateAnchor: (x, y) => {
                const a = {
                    x, y,
                    position: function() { return { x: this.x, y: this.y }; },
                    node: { destroy: vi.fn() },
                    hide: vi.fn(),
                    show: vi.fn()
                };
                return a;
            }
        };

        const a1New = newPlanner.getOrCreateAnchor(exportedArc.p1.x, exportedArc.p1.y);
        const a2New = newPlanner.getOrCreateAnchor(exportedArc.p2.x, exportedArc.p2.y);
        const restoredArc = new PremiumArc(newPlanner, a1New, a2New, exportedArc.pos, {
            id: exportedArc.id,
            thickness: exportedArc.thickness,
            height: exportedArc.height,
            elevation: exportedArc.elevation,
            params: exportedArc.params
        });

        expect(restoredArc.id).toBe(arc.id);
        expect(restoredArc.thickness).toBe(28);
        expect(restoredArc.height).toBe(300);
        expect(restoredArc.params.textureFront).toBe('granite_dark');
        expect(restoredArc.walls.length).toBeGreaterThan(1);
    });

    it('10. Cascading Deletion: deleteWall on arc removes all sub-walls and intermediate anchors', () => {
        expect(mockPlanner.walls.length).toBeGreaterThan(0);
        expect(mockPlanner.anchors.length).toBeGreaterThan(2); // Start, end + intermediate

        WallTopologyEngine.deleteWall(mockPlanner, arc);

        expect(mockPlanner.walls.length).toBe(0);
        expect(mockPlanner.arcs.length).toBe(0);
        // Only degree-0 endpoints might remain or intermediate anchors destroyed
        expect(arc.walls.length).toBe(0);
        expect(arc.intermediateAnchors.length).toBe(0);
    });

    it('11. 2D Single Raiser Badge: child wall segments suppress individual raiser badges when parentArc is present', () => {
        expect(arc.walls.length).toBeGreaterThan(1);

        arc.walls.forEach(seg => {
            expect(seg.parentArc).toBe(arc);
            // Calling setHighlight(true) on a child segment should not show individual raiserGroup
            if (seg.renderer2d) {
                seg.renderer2d.setHighlight(true);
                if (seg.renderer2d.raiserGroup) {
                    expect(seg.renderer2d.raiserGroup.visible()).toBe(false);
                }
            }
        });
    });

    it('12. 3D Room Suite Representation: RoomInteractiveSuite groups curved segments into single edge push/pull arrow', () => {
        const mockCtx = {
            scene: new THREE.Scene(),
            camera: new THREE.PerspectiveCamera(),
            renderer: { domElement: { addEventListener: vi.fn(), removeEventListener: vi.fn() } },
            requestRender: vi.fn(),
            planner: mockPlanner
        };

        const suite = new RoomInteractiveSuite(mockCtx);
        
        // Construct a closed room path consisting of 1 straight wall and the arc's path
        const roomPath = [
            { x: 0, y: 0 },
            ...arc.walls.map(w => ({ x: w.endAnchor.x, y: w.endAnchor.y })),
            { x: 0, y: 0 }
        ];

        const mockRoom = {
            id: 'room_1',
            path: roomPath,
            elevation: 0,
            planner: mockPlanner,
            walls: [...arc.walls]
        };

        suite.room = mockRoom;
        suite._updateEdgeArrows();

        // Count arc arrows vs total arrows
        const arcArrows = suite.edgeArrowsGroup.children.filter(c => c.userData?.isArcArrow);
        expect(arcArrows.length).toBe(1);
    });

    it('13. Dynamic Safe Radius Clamping & Corner Restrictions: moving anchor clamps fillet radius and safely collapses when room/wall is too short', () => {
        // Setup 2 walls forming a 90-degree corner at apex (100, 100)
        const apex = mockPlanner.getOrCreateAnchor(100, 100);
        const startPt = mockPlanner.getOrCreateAnchor(0, 100);
        const endPt = mockPlanner.getOrCreateAnchor(100, 200);

        const w1 = WallTopologyEngine.createWall(mockPlanner, { startAnchor: startPt, endAnchor: apex, thickness: 20 });
        const w2 = WallTopologyEngine.createWall(mockPlanner, { startAnchor: apex, endAnchor: endPt, thickness: 20 });

        // Apply a 50cm corner fillet
        const cornerRes = WallEngine.filletCorner(mockPlanner, apex, 50);
        expect(cornerRes.success).toBe(true);
        expect(mockPlanner.arcs.length).toBeGreaterThan(0);
        const cornerArc = mockPlanner.arcs.find(a => a.isCornerFillet);
        expect(cornerArc).toBeDefined();

        // Move the startPt closer to apex so wall length is 30cm (less than 50cm radius clearance)
        WallMutationEngine.moveAnchor(startPt, { x: 70, y: 100 }, mockPlanner);

        // The arc radius should be dynamically clamped to safe radius
        const currentArc = mockPlanner.arcs.find(a => a.isCornerFillet);
        expect(currentArc).toBeDefined();
        expect(currentArc.filletRadius).toBeLessThanOrEqual(50);
        expect(currentArc.walls.length).toBeGreaterThan(0);

        // Move startPt very close (< 25cm to apex) so it triggers safe collapse back to sharp corner
        WallMutationEngine.moveAnchor(startPt, { x: 90, y: 100 }, mockPlanner);
        // The arc should be safely collapsed and removed
        expect(mockPlanner.arcs.some(a => a.isCornerFillet)).toBe(false);
        // Original corner restored
        expect(mockPlanner.walls.some(w => w.startAnchor === apex || w.endAnchor === apex)).toBe(true);
    });
});




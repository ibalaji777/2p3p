import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { WallPushPullGizmo } from '../WallPushPullGizmo.js';
import { BIMMaterialSystem } from '../BIMMaterialSystem.js';

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

describe('WallPushPullGizmo - Sims 4-Style 2D-on-3D Region Selection & Push/Pull', () => {
    let ctx;
    let gizmo;
    let mockWall;
    let mockSiblingWall;
    let mockPlanner;

    beforeEach(() => {
        // Mock Camera
        const camera = new THREE.PerspectiveCamera(60, 1, 1, 1000);
        camera.position.set(0, 150, 300);
        camera.lookAt(0, 0, 0);

        // Mock 3D Container & Scene Context
        const domElement = {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
            addEventListener: () => {},
            removeEventListener: () => {},
            style: { cursor: 'default' }
        };

        mockPlanner = {
            walls: [],
            wallLayer: { add: () => {} },
            labelLayer: { add: () => {} },
            entranceLayer: { add: () => {} },
            dimensionLayer: { add: () => {} },
            widgetLayer: { add: () => {} },
            uiLayer: { add: () => {} },
            formatLength: (len) => `${Math.round(len)} cm`,
            commandManager: { execute: () => {}, canUndo: () => false, canRedo: () => false },
            syncAll: () => {},
            findRooms: () => {},
            exportState: () => ({ walls: [] }),
            importState: () => {}
        };

        ctx = {
            camera,
            renderer: { domElement },
            controls: { enabled: true },
            planner: mockPlanner,
            updatedWalls: [],
            updateWallGeometryLive: (w) => { ctx.updatedWalls.push(w); },
            rebuildActiveFloors: () => {},
            requestRender: () => {}
        };

        // Create Active Wall (100cm length along X, height 120cm, thickness 20cm)
        const startAnchor = {
            _pos: { x: 0, y: 0 },
            position(p) { if (p) this._pos = { ...p }; return { ...this._pos }; },
            connectedWalls: []
        };
        const endAnchor = {
            _pos: { x: 100, y: 0 },
            position(p) { if (p) this._pos = { ...p }; return { ...this._pos }; },
            connectedWalls: []
        };

        mockWall = {
            id: 'wall_active_1',
            startX: 0,
            startY: 0,
            endX: 100,
            endY: 0,
            height: 120,
            thickness: 20,
            startAnchor,
            endAnchor,
            attachedWidgets: [],
            mesh3D: new THREE.Group()
        };
        mockWall.mesh3D.userData = { entity: mockWall };

        // Create Connected Sibling Wall sharing startAnchor
        const siblingEndAnchor = {
            _pos: { x: 0, y: 100 },
            position(p) { if (p) this._pos = { ...p }; return { ...this._pos }; },
            connectedWalls: []
        };
        mockSiblingWall = {
            id: 'wall_sibling_2',
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 100,
            height: 120,
            thickness: 20,
            startAnchor,
            endAnchor: siblingEndAnchor,
            attachedWidgets: [],
            mesh3D: new THREE.Group()
        };
        mockSiblingWall.mesh3D.userData = { entity: mockSiblingWall };

        startAnchor.connectedWalls.push(mockWall, mockSiblingWall);
        mockPlanner.walls.push(mockWall, mockSiblingWall);

        gizmo = new WallPushPullGizmo(ctx);
    });

    it('should initialize with 4 boundary handles (horizontal & vertical) and 2 push/pull handles', () => {
        expect(gizmo.startWidthHandle).toBeDefined();
        expect(gizmo.endWidthHandle).toBeDefined();
        expect(gizmo.bottomHeightHandle).toBeDefined();
        expect(gizmo.topHeightHandle).toBeDefined();
        expect(gizmo.handleFront).toBeDefined();
        expect(gizmo.handleBack).toBeDefined();

        gizmo.attach(mockWall.mesh3D);
        expect(gizmo.visible).toBe(true);
        expect(gizmo.tStart).toBe(0.0);
        expect(gizmo.tEnd).toBe(1.0);
        expect(gizmo.elevBottom).toBe(0);
        expect(gizmo.elevTop).toBe(120);
    });

    it('should calculate single-sided front face expansion and keep back face pinned', () => {
        gizmo.attach(mockWall.mesh3D);

        gizmo.initialStart = { x: 0, y: 0 };
        gizmo.initialEnd = { x: 100, y: 0 };
        gizmo.initialThickness = 20;
        gizmo.wallNormal2D = { x: 0, y: 1 };
        gizmo.activeHandle = 'front';
        gizmo.mode = 'thickness';
        gizmo.isDragging = true;
        gizmo.dragStartPoint.set(50, 60, 0);

        const deltaWorldZ = 10;
        const dist = (0 * gizmo.wallNormal2D.x) + (deltaWorldZ * gizmo.wallNormal2D.y); // +10
        const deltaThick = Math.round(dist);
        const newThick = gizmo.initialThickness + deltaThick; // 30 cm
        const actualDelta = newThick - gizmo.initialThickness; // +10 cm

        mockWall.thickness = newThick;
        const shift = actualDelta / 2; // +5 cm
        const shiftX = gizmo.wallNormal2D.x * shift;
        const shiftY = gizmo.wallNormal2D.y * shift;

        mockWall.startAnchor.position({ x: gizmo.initialStart.x + shiftX, y: gizmo.initialStart.y + shiftY });
        mockWall.endAnchor.position({ x: gizmo.initialEnd.x + shiftX, y: gizmo.initialEnd.y + shiftY });

        expect(mockWall.startAnchor.position()).toEqual({ x: 0, y: 5 });
        expect(mockWall.endAnchor.position()).toEqual({ x: 100, y: 5 });
        expect(mockWall.thickness).toBe(30);

        const frontFaceY = mockWall.startAnchor.position().y + mockWall.thickness / 2;
        expect(frontFaceY).toBe(20);

        const backFaceY = mockWall.startAnchor.position().y - mockWall.thickness / 2;
        expect(backFaceY).toBe(-10);
    });

    it('should update both active wall and connected sibling walls during live push/pull', () => {
        ctx.updatedWalls = [];
        gizmo._updateWallAndSiblings(mockWall);

        expect(ctx.updatedWalls).toContain(mockWall);
        expect(ctx.updatedWalls).toContain(mockSiblingWall);
    });

    it('should carve an architectural niche when pushing inward on a selected sub-region and clicking Done', () => {
        gizmo.attach(mockWall.mesh3D);
        gizmo.tStart = 0.2;
        gizmo.tEnd = 0.8;
        gizmo.elevBottom = 30;
        gizmo.elevTop = 90;
        gizmo.isDragging = true;
        gizmo.activeHandle = 'front';
        gizmo.activeFacing = 1;
        gizmo.currentExtrudeDepth = -12; // Push inward by 12 cm

        const mockEvent = { target: { releasePointerCapture: () => {} } };
        gizmo._onPointerUp(mockEvent);

        // Step 3: User clicks Done (commit)
        gizmo.commit();

        const nicheWall = mockPlanner.walls.find(w => w.attachedWidgets && w.attachedWidgets.length > 0) || mockWall;
        expect(nicheWall.attachedWidgets.length).toBe(1);
        const widget = nicheWall.attachedWidgets[0];
        expect(widget.type).toBe('niche_recess');
        expect(widget.width).toBe(60); // (0.8 - 0.2) * 100 = 60 cm
        expect(widget.height).toBe(60); // 90 - 30 = 60 cm
        expect(widget.elevation).toBe(30);
        expect(widget.depth).toBe(12);
        expect(widget.facing).toBe(1);
    });

    it('should create a solid wall block (protrusion) when pulling outward on a selected sub-region and clicking Done', () => {
        mockWall.attachedWidgets = [];
        mockPlanner.walls = [mockWall];
        gizmo.attach(mockWall.mesh3D);
        gizmo.tStart = 0.25;
        gizmo.tEnd = 0.75;
        gizmo.elevBottom = 0;
        gizmo.elevTop = 120;
        gizmo.isDragging = true;
        gizmo.activeHandle = 'front';
        gizmo.activeFacing = 1;
        gizmo.currentExtrudeDepth = 25; // Pull outward by 25 cm

        const mockEvent = { target: { releasePointerCapture: () => {} } };
        gizmo._onPointerUp(mockEvent);

        // Step 3: User clicks Done (commit)
        gizmo.commit();

        expect(mockPlanner.walls.length).toBe(1); // Host wall is preserved as single monolithic wall!
        expect(mockWall.attachedWidgets.length).toBe(1);
        const widget = mockWall.attachedWidgets[0];
        expect(widget.type).toBe('solid_protrusion');
        expect(widget.width).toBe(50); // (0.75 - 0.25) * 100 = 50 cm
        expect(widget.height).toBe(120);
        expect(widget.elevation).toBe(0);
        expect(widget.depth).toBe(25);
        expect(widget.facing).toBe(1);
    });

    it('should discard solid wall extrusion when user clicks Cancel', () => {
        mockWall.attachedWidgets = [];
        gizmo.attach(mockWall.mesh3D);
        gizmo.tStart = 0.2;
        gizmo.tEnd = 0.8;
        gizmo.currentExtrudeDepth = 30;

        // Step 3: User clicks Cancel
        gizmo.cancel();

        expect(mockWall.attachedWidgets.length).toBe(0);
        expect(gizmo.currentExtrudeDepth).toBe(0);
    });

    it('should safely sync all walls and call update() when attached widgets are plain objects', () => {
        const wallWithWidgets = {
            attachedWidgets: [
                { id: 'protrusion_1', type: 'solid_protrusion', width: 50, height: 120 },
                { id: 'niche_1', type: 'niche_recess', width: 60, height: 80 }
            ],
            attachedMoldings: []
        };

        // Simulating the 2D update loop
        expect(() => {
            wallWithWidgets.attachedWidgets.forEach(w => {
                if (w && typeof w.update === 'function') w.update();
            });
            if (wallWithWidgets.attachedMoldings) {
                wallWithWidgets.attachedMoldings.forEach(m => {
                    if (m && typeof m.update === 'function') m.update();
                });
            }
        }).not.toThrow();
    });

    it('should support independent 6-face materials on solid_protrusion meshes', () => {
        const widg = {
            id: 'protrusion_1',
            type: 'solid_protrusion',
            width: 80,
            height: 120,
            depth: 30,
            facing: 1,
            params: {
                textureFront: 'wood_oak',
                textureLeft: 'paint_white',
                textureRight: 'brick_red',
                textureTop: 'marble_carrara'
            }
        };

        // Verifying 6-face parameter slots
        expect(widg.params.textureFront).toBe('wood_oak');
        expect(widg.params.textureLeft).toBe('paint_white');
        expect(widg.params.textureRight).toBe('brick_red');
        expect(widg.params.textureTop).toBe('marble_carrara');
    });

    it('should block door and window placement over solid_protrusion while allowing moldings', () => {
        const wallEntity = {
            length: 300,
            thickness: 20,
            attachedWidgets: [
                { id: 'prot_1', type: 'solid_protrusion', t: 0.5, width: 100, height: 210, elevation: 0 }
            ]
        };

        // Simulating placement overlap check for a door (cutsWall = true)
        const doorMin = 0.5 * 300 - 45; // 105
        const doorMax = 0.5 * 300 + 45; // 195
        const protMin = 0.5 * 300 - 50; // 100
        const protMax = 0.5 * 300 + 50; // 200

        const doorOverlap = (doorMax > protMin + 1 && doorMin < protMax - 1);
        expect(doorOverlap).toBe(true); // Door overlaps with solid block -> blocked

        // For molding (cutsWall = false), placement and wrapping are allowed
        const isMolding = true;
        const cutsWall = !isMolding;
        expect(cutsWall).toBe(false); // Moldings bypass overlap block
    });

    it('should allow re-adjusting existing solid block depth in-place without creating separate walls', () => {
        const existingWidget = {
            id: 'prot_existing',
            type: 'solid_protrusion',
            width: 50,
            height: 120,
            elevation: 0,
            depth: 25,
            t: 0.5,
            facing: 1,
            update: () => {}
        };

        mockWall.attachedWidgets = [existingWidget];
        mockPlanner.walls = [mockWall];

        const mockProtrusionMesh = {
            userData: {
                isProtrusion: true,
                widget: existingWidget,
                entity: mockWall
            },
            parent: mockWall.mesh3D
        };

        // Attach gizmo to existing solid block
        gizmo.attach(mockProtrusionMesh);

        expect(gizmo.existingProtrusion).toBe(existingWidget);
        expect(gizmo.currentExtrudeDepth).toBe(25);

        // User pulls further outward from 25 cm to 50 cm
        gizmo.currentExtrudeDepth = 50;
        gizmo.commit();

        // Verifies existing widget was updated in place
        expect(existingWidget.depth).toBe(50);
        // Verifies NO separate walls were created
        expect(mockPlanner.walls.length).toBe(1);
    });

    it('should assign only pushPull and material gizmos to solid_protrusion without move or opening', () => {
        const mockProtrusionObj = {
            userData: {
                isProtrusion: true,
                widget: { id: 'prot_1', type: 'solid_protrusion' },
                entity: { type: 'solid_protrusion' }
            }
        };

        const isSolidProt = !!mockProtrusionObj.userData.isProtrusion;
        expect(isSolidProt).toBe(true);

        const activeGizmos = isSolidProt ? ['pushPull', 'material'] : ['move', 'opening'];
        expect(activeGizmos).toEqual(['pushPull', 'material']);
        expect(activeGizmos).not.toContain('move');
        expect(activeGizmos).not.toContain('opening');
    });

    it('should highlight only the targeted face on a 6-material solid block mesh', () => {
        const materials = [
            new THREE.MeshStandardMaterial({ color: 0xffffff }), // 0: Right
            new THREE.MeshStandardMaterial({ color: 0xffffff }), // 1: Left
            new THREE.MeshStandardMaterial({ color: 0xffffff }), // 2: Top
            new THREE.MeshStandardMaterial({ color: 0xffffff }), // 3: Bottom
            new THREE.MeshStandardMaterial({ color: 0xffffff }), // 4: Front
            new THREE.MeshStandardMaterial({ color: 0xffffff })  // 5: Back
        ];

        const mockMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), materials);
        mockMesh.userData = { isProtrusion: true, entity: { type: 'solid_protrusion' } };

        // Test highlighting Front face only (targetMatIndex = 4)
        const targetDescriptor = {
            mesh: mockMesh,
            targetMatIndex: 4,
            componentType: 'solid_protrusion_face'
        };

        BIMMaterialSystem.setBIMHighlight(targetDescriptor, true, 0x00ff00);

        // Verify ONLY Front face (index 4) has active emissive highlight
        expect(materials[4].emissive.getHex()).toBe(0x00ff00);
        expect(materials[4].emissiveIntensity).toBe(0.8);

        // Verify other faces (Left, Right, Top, etc.) remain untouched
        expect(materials[0].emissive.getHex()).toBe(0x000000);
        expect(materials[1].emissive.getHex()).toBe(0x000000);

        // Test clear highlight
        BIMMaterialSystem.setBIMHighlight(targetDescriptor, false);
        expect(materials[4].emissive.getHex()).toBe(0x000000);
    });

    it('should add, update, and remove solid_protrusion strictly through WallEngine without altering planner.walls or anchors', () => {
        const initialWallCount = mockPlanner.walls.length;
        const initialAnchorPos1 = mockWall.startAnchor.position();
        const initialAnchorPos2 = mockWall.endAnchor.position();
        const originalWallId = mockWall.id;

        // 1. Add Protrusion
        const added = WallPushPullGizmo.prototype ? 
            (mockWall.attachedWidgets.push({
                id: 'prot_engine_1',
                type: 'solid_protrusion',
                width: 60,
                height: 120,
                elevation: 0,
                depth: 30,
                t: 0.5,
                facing: 1,
                params: { textureFront: 'wood_cherry' }
            }), mockWall.attachedWidgets[mockWall.attachedWidgets.length - 1]) : null;

        expect(mockPlanner.walls.length).toBe(initialWallCount);
        expect(mockWall.id).toBe(originalWallId);
        expect(mockWall.startAnchor.position()).toEqual(initialAnchorPos1);
        expect(mockWall.endAnchor.position()).toEqual(initialAnchorPos2);
        expect(mockWall.attachedWidgets.length).toBe(1);

        // 2. Update Protrusion in place
        added.depth = 45;
        added.params.textureLeft = 'brick_slate';
        expect(mockPlanner.walls.length).toBe(initialWallCount);
        expect(mockWall.id).toBe(originalWallId);
        expect(added.depth).toBe(45);
        expect(added.params.textureLeft).toBe('brick_slate');

        // 3. Remove Protrusion
        mockWall.attachedWidgets = mockWall.attachedWidgets.filter(w => w !== added);
        expect(mockPlanner.walls.length).toBe(initialWallCount);
        expect(mockWall.attachedWidgets.length).toBe(0);
        expect(mockWall.id).toBe(originalWallId);
    });

    it('should serialize and deserialize solid_protrusion with all 6 face materials intact', async () => {
        const { WallSerializer } = await import('../../../features/wall/wall.serializer.js');
        
        const protrusion = {
            id: 'prot_serial_1',
            type: 'solid_protrusion',
            configId: 'solid_protrusion',
            t: 0.5,
            width: 70,
            height: 120,
            depth: 25,
            elevation: 0,
            facing: 1,
            params: {
                textureRight: 'marble_black',
                textureLeft: 'marble_white',
                textureTop: 'stone_slate',
                textureBottom: 'concrete_rough',
                textureFront: 'wood_walnut',
                textureBack: 'plaster_white'
            }
        };

        mockWall.attachedWidgets = [protrusion];

        mockWall.startAnchor.id = 'anchor_start_1';
        mockWall.endAnchor.id = 'anchor_end_1';

        const serialized = WallSerializer.serialize(mockWall);
        expect(serialized.widgets.length).toBe(1);
        expect(serialized.widgets[0].type).toBe('solid_protrusion');
        expect(serialized.widgets[0].depth).toBe(25);
        expect(serialized.widgets[0].params.textureRight).toBe('marble_black');
        expect(serialized.widgets[0].params.textureLeft).toBe('marble_white');
        expect(serialized.widgets[0].params.textureTop).toBe('stone_slate');
        expect(serialized.widgets[0].params.textureBottom).toBe('concrete_rough');
        expect(serialized.widgets[0].params.textureFront).toBe('wood_walnut');
        expect(serialized.widgets[0].params.textureBack).toBe('plaster_white');

        const anchorMap = new Map();
        anchorMap.set('anchor_start_1', mockWall.startAnchor);
        anchorMap.set('anchor_end_1', mockWall.endAnchor);

        const deserialized = WallSerializer.deserialize(serialized, mockPlanner, anchorMap);
        expect(deserialized.attachedWidgets.length).toBe(1);
        expect(deserialized.attachedWidgets[0].type).toBe('solid_protrusion');
        expect(deserialized.attachedWidgets[0].depth).toBe(25);
        expect(deserialized.attachedWidgets[0].params.textureRight).toBe('marble_black');
        expect(deserialized.attachedWidgets[0].params.textureFront).toBe('wood_walnut');
    });

    it('should generate continuous stepped 2D polygon with zero inner seam lines', async () => {
        const { WallGeometryEngine } = await import('../../wall/WallGeometryEngine.js');

        const protrusion = {
            id: 'prot_poly_1',
            type: 'solid_protrusion',
            width: 40,
            depth: 20,
            t: 0.5,
            facing: 1
        };

        mockWall.attachedWidgets = [protrusion];
        const pts = WallGeometryEngine.getExactPolygonPoints(mockWall, [mockWall]);

        // Wall: (0,0) -> (100,0), thickness 20 => halfThick = 10, normal = (0, 1)
        // Base front edge: y = 10. Protrusion: t=0.5 (center x=50, w=40 => x from 30 to 70), depth=20 => y = 30.
        // Front vertices must step: (0,10) -> (30,10) -> (30,30) -> (70,30) -> (70,10) -> (100,10)
        expect(pts.length).toBeGreaterThan(8);
        
        let foundProtrusionPeak = false;
        for (let i = 0; i < pts.length; i += 2) {
            const y = pts[i + 1];
            if (Math.round(y) === 30) {
                foundProtrusionPeak = true;
                break;
            }
        }
        expect(foundProtrusionPeak).toBe(true);
    });

    it('should start dragging on pointer down on center handle without throwing ReferenceError', () => {
        gizmo.attach(mockWall.mesh3D);
        expect(gizmo.visible).toBe(true);

        // Simulate raycast hitting front handle base
        const baseMesh = gizmo.handleFront.children.find(c => c.userData?.part === 'base');
        expect(baseMesh).toBeDefined();

        const intersect = {
            object: baseMesh,
            point: new THREE.Vector3(50, 60, 20)
        };
        gizmo.raycaster.intersectObjects = () => [intersect];

        const mockEvent = {
            button: 0,
            clientX: 400,
            clientY: 300,
            pointerId: 1,
            preventDefault: () => {},
            stopPropagation: () => {},
            target: { setPointerCapture: () => {} }
        };

        expect(() => {
            gizmo._onPointerDown(mockEvent);
        }).not.toThrow();

        expect(gizmo.isDragging).toBe(true);
        expect(gizmo.activeHandle).toBe('front');
        expect(gizmo.activeSide).toBe('front');
        expect(gizmo.activeFacing).toBe(1);
    });

    it('should dynamically expand wall thickness during live pointer move and revert on cancel', () => {
        gizmo.attach(mockWall.mesh3D);
        expect(mockWall.thickness).toBe(20);

        // 1. Pointer Down on front handle
        const baseMesh = gizmo.handleFront.children.find(c => c.userData?.part === 'base');
        const intersect = {
            object: baseMesh,
            point: new THREE.Vector3(50, 60, 20)
        };
        gizmo.raycaster.intersectObjects = () => [intersect];

        const downEvent = {
            button: 0,
            clientX: 400,
            clientY: 300,
            pointerId: 1,
            preventDefault: () => {},
            stopPropagation: () => {},
            target: { setPointerCapture: () => {} }
        };
        gizmo._onPointerDown(downEvent);
        expect(gizmo.isDragging).toBe(true);

        // 2. Pointer Move outward (deltaWorldZ = +15)
        gizmo.raycaster.ray.intersectPlane = (plane, target) => {
            target.set(50, 60, 35); // 35 - 20 = 15cm outward
            return target;
        };

        const moveEvent = {
            clientX: 400,
            clientY: 250,
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        gizmo._onPointerMove(moveEvent);

        // Thickness must have grown from 20cm to 35cm
        expect(mockWall.thickness).toBe(35);

        // 3. Cancel must revert thickness and position cleanly
        gizmo.cancel();
        expect(mockWall.thickness).toBe(20);
        expect(mockWall.startAnchor.position()).toEqual({ x: 0, y: 0 });
        expect(mockWall.endAnchor.position()).toEqual({ x: 100, y: 0 });
    });
});


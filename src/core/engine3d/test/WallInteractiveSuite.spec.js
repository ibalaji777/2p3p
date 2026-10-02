import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { createPinia, setActivePinia } from 'pinia';
import { WallInteractiveSuite } from '../WallInteractiveSuite.js';
import { InteractionSystem } from '../InteractionSystem.js';
import { WallEngine } from '../../wall/WallEngine.js';
import { WallTopologyEngine } from '../../wall/WallTopologyEngine.js';

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
            measureText: () => ({ width: 10 })
        });
    }
});

describe('WallInteractiveSuite - Bay / Niche (extrude_recess) Tool', () => {
    let mockCtx;
    let domElement;
    let camera;
    let mockPlanner;
    let mockWall;
    let mockMesh;
    let suite;

    beforeEach(() => {
        setActivePinia(createPinia());
        domElement = document.createElement('div');
        domElement.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: 800,
            bottom: 600,
            width: 800,
            height: 600
        });

        camera = new THREE.PerspectiveCamera(45, 800 / 600, 1, 1000);
        camera.position.set(100, 200, 300);
        camera.lookAt(100, 0, 0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);

        mockWall = {
            id: 'wall_test_1',
            type: 'outer',
            startX: 0,
            startY: 0,
            endX: 200,
            endY: 0,
            startAnchor: { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) },
            endAnchor: { x: 200, y: 0, position: () => ({ x: 200, y: 0 }) },
            thickness: 20,
            height: 280,
            elevation: 0,
            attachedWidgets: [],
            attachedMoldings: []
        };

        mockPlanner = {
            walls: [mockWall],
            rooms: [],
            stairs: [],
            furniture: [],
            roofs: [],
            shapes: [],
            wallLayer: { add: vi.fn(), remove: vi.fn(), draw: vi.fn() },
            uiLayer: { add: vi.fn(), remove: vi.fn(), draw: vi.fn() },
            anchors: [mockWall.startAnchor, mockWall.endAnchor],
            syncAll: vi.fn(),
            findRooms: vi.fn(),
            exportState: vi.fn(() => 'mock_planner_snapshot_state'),
            importState: vi.fn(),
            commandManager: {
                execute: vi.fn(cmd => {
                    if (cmd && typeof cmd.execute === 'function') cmd.execute();
                })
            },
            getOrCreateAnchor: vi.fn((x, y) => ({ x, y, position: () => ({ x, y }) })),
            findOrCreateAnchor: vi.fn((x, y) => ({ x, y, position: () => ({ x, y }) })),
            selectEntity: vi.fn(),
            selectedEntity: null
        };
        mockWall.planner = mockPlanner;

        mockMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 280, 20));
        mockMesh.userData = { entity: mockWall };

        mockCtx = {
            renderer: { domElement },
            camera,
            scene: new THREE.Scene(),
            controls: { addEventListener: vi.fn(), removeEventListener: vi.fn(), enabled: true },
            requestRender: vi.fn(),
            buildScene: vi.fn(),
            updateWallGeometryLive: vi.fn(),
            planner: mockPlanner
        };

        suite = new WallInteractiveSuite(mockCtx);
    });

    afterEach(() => {
        suite.dispose();
    });

    it('should activate extrude_recess mode, show extrude handles and ghost, and detach extenderGizmo', () => {
        suite.attach(mockMesh, 'menu');
        expect(suite.activeMode).toBe('menu');

        // User clicks Bay/Niche button
        suite.setMode('extrude_recess');

        expect(suite.activeMode).toBe('extrude_recess');
        expect(suite.extrudeGroup.visible).toBe(true);
        expect(suite.extenderGizmo.visible).toBe(false);
        expect(suite.cornerGizmo.visible).toBe(false);
        expect(suite.heightGizmo.visible).toBe(false);

        // Check that status badge displays the Bay/Niche prompt
        expect(suite.confirmStatusBadge.textContent).toContain('Bay (+Z) / Recess Niche (-Z)');
    });

    it('should generate photorealistic 3D bay window assembly when extruding outward (+Z)', () => {
        suite.attach(mockMesh, 'extrude_recess');

        // Simulate outward drag (depth = 40cm, tStart = 0.25, tEnd = 0.75)
        suite.extrudeCurrentDepth = 40;
        suite._updateExtrudeGhostGeometry();

        expect(suite.confirmStatusBadge.textContent).toContain('Bay Window: +40 cm');
        expect(suite.confirmStatusBadge.textContent).toContain('Width: 100 cm');
        expect(suite.target.visible).toBe(false); // Original wall hidden during preview

        // Bay preview group should have the 3-wall extension + floor slab + interior void
        expect(suite.bayPreviewGroup.children.length).toBeGreaterThan(4);
    });

    it('should generate photorealistic 3D niche assembly when recessing inward (-Z)', () => {
        suite.attach(mockMesh, 'extrude_recess');

        // Simulate inward drag (depth = -10cm, within 20cm thickness)
        suite.extrudeCurrentDepth = -10;
        suite._updateExtrudeGhostGeometry();

        expect(suite.confirmStatusBadge.textContent).toContain('Niche: -10 cm');
        expect(suite.confirmStatusBadge.textContent).toContain('Core: 10 cm');

        // Niche assembly should have back wall panel + niche void box
        expect(suite.bayPreviewGroup.children.length).toBeGreaterThan(0);
    });

    it('should commit outward Bay Window and build actual bay room walls via extrudeWallSegment', () => {
        suite.attach(mockMesh, 'extrude_recess');
        suite.extrudeCurrentDepth = 50;
        suite.extrudeStartT = 0.25;
        suite.extrudeEndT = 0.75;
        suite.activeFacing = 1;

        // User clicks Done
        suite.commitChanges();

        expect(mockPlanner.commandManager.execute).toHaveBeenCalled();
        expect(mockCtx.buildScene).toHaveBeenCalled();
        expect(suite.target).toBeNull(); // Detached cleanly
    });

    it('should commit inward Niche and attach an architectural niche_recess widget to wall', () => {
        suite.attach(mockMesh, 'extrude_recess');
        suite.extrudeCurrentDepth = -12; // Inward 12cm within wall thickness 20cm
        suite.extrudeStartT = 0.25;
        suite.extrudeEndT = 0.75;
        suite.activeFacing = 1;

        // User clicks Done
        suite.commitChanges();

        expect(mockWall.attachedWidgets.length).toBe(1);
        const widget = mockWall.attachedWidgets[0];
        expect(widget.type).toBe('niche_recess');
        expect(widget.depth).toBe(12);
        expect(widget.width).toBe(100); // (0.75 - 0.25) * 200 = 100cm
        expect(mockCtx.updateWallGeometryLive).toHaveBeenCalledWith(mockWall);
        expect(suite.target).toBeNull();
    });

    it('should restore target wall visibility when cancelling changes', () => {
        suite.attach(mockMesh, 'extrude_recess');
        suite.extrudeCurrentDepth = 40;
        suite._updateExtrudeGhostGeometry();
        expect(mockMesh.visible).toBe(false);

        // User cancels
        suite.cancelChanges();

        expect(mockMesh.visible).toBe(true);
        expect(suite.extrudeGroup.visible).toBe(false);
        expect(suite.target).toBeNull();
    });

    it('should support Enter to commit and Escape to cancel via keyboard', () => {
        suite.attach(mockMesh, 'extrude_recess');
        suite.extrudeCurrentDepth = 40;
        suite.extrudeStartT = 0.25;
        suite.extrudeEndT = 0.75;
        suite.activeFacing = 1;

        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
        window.dispatchEvent(enterEvent);

        expect(mockPlanner.commandManager.execute).toHaveBeenCalled();
        expect(mockCtx.buildScene).toHaveBeenCalled();
    });

    it('should construct photorealistic 3D lit arrows (shaft + cone) with Emerald Green for Bay and Amethyst Purple for Niche', () => {
        suite.attach(mockMesh, 'extrude_recess');

        // Check Bay (+Z) Arrow meshes and materials
        const outMeshes = [];
        suite.extrudeHandle.traverse(child => {
            if (child.isMesh && child.userData?.part === 'depth_out' && child.material?.visible !== false) {
                outMeshes.push(child);
            }
        });

        // Must have both Cylindrical Stalk and Conical Arrowhead
        expect(outMeshes.length).toBe(2);
        const hasOutCylinder = outMeshes.some(m => m.geometry instanceof THREE.CylinderGeometry);
        const hasOutCone = outMeshes.some(m => m.geometry instanceof THREE.ConeGeometry);
        expect(hasOutCylinder).toBe(true);
        expect(hasOutCone).toBe(true);

        // Check material is MeshStandardMaterial with plain raiser pearl-white (0xf8fafc)
        outMeshes.forEach(m => {
            expect(m.material).toBeInstanceOf(THREE.MeshStandardMaterial);
            expect(m.material.color.getHex()).toBe(0xf8fafc);
            expect(m.material.depthTest).toBe(false);
        });

        // Check Niche (-Z) Arrow meshes and materials
        const inMeshes = [];
        suite.extrudeHandle.traverse(child => {
            if (child.isMesh && child.userData?.part === 'depth_in' && child.material?.visible !== false) {
                inMeshes.push(child);
            }
        });

        // Must have both Cylindrical Stalk and Conical Arrowhead
        expect(inMeshes.length).toBe(2);
        const hasInCylinder = inMeshes.some(m => m.geometry instanceof THREE.CylinderGeometry);
        const hasInCone = inMeshes.some(m => m.geometry instanceof THREE.ConeGeometry);
        expect(hasInCylinder).toBe(true);
        expect(hasInCone).toBe(true);

        // Check material is MeshStandardMaterial with plain raiser pearl-white (0xf8fafc)
        inMeshes.forEach(m => {
            expect(m.material).toBeInstanceOf(THREE.MeshStandardMaterial);
            expect(m.material.color.getHex()).toBe(0xf8fafc);
            expect(m.material.depthTest).toBe(false);
        });

        // Check Boundary Handles have 3D arrows (Cylinder + Cone) with raiser pearl-white (0xf8fafc)
        const boundaryMeshes = [];
        suite.extrudeStartHandle.traverse(child => {
            if (child.isMesh && child.userData?.part === 'boundary_start' && child.userData?.isRing !== true && child.material?.visible !== false) {
                boundaryMeshes.push(child);
            }
        });
        const hasBoundCylinder = boundaryMeshes.some(m => m.geometry instanceof THREE.CylinderGeometry && m.geometry.parameters.height === 16);
        const hasBoundCone = boundaryMeshes.some(m => m.geometry instanceof THREE.ConeGeometry);
        expect(hasBoundCylinder).toBe(true);
        expect(hasBoundCone).toBe(true);
        boundaryMeshes.forEach(m => {
            expect(m.material.color.getHex()).toBe(0xf8fafc);
        });

        // Verify boundary handles point outward away from bay
        const startCone = boundaryMeshes.find(m => m.geometry instanceof THREE.ConeGeometry);
        expect(startCone.position.x).toBeLessThan(0); // start handle points left (-X, outward)

        const endMeshes = [];
        suite.extrudeEndHandle.traverse(child => {
            if (child.isMesh && child.userData?.part === 'boundary_end' && child.userData?.isRing !== true && child.material?.visible !== false) {
                endMeshes.push(child);
            }
        });
        const endCone = endMeshes.find(m => m.geometry instanceof THREE.ConeGeometry);
        expect(endCone.position.x).toBeGreaterThan(0); // end handle points right (+X, outward)

        // Verify hover highlight
        suite._setHandleHighlight('depth_out');
        outMeshes.forEach(m => {
            expect(m.material.color.getHex()).toBe(0xfacc15); // Vibrant yellow on hover
        });

        suite._setHandleHighlight(null);
        outMeshes.forEach(m => {
            expect(m.material.color.getHex()).toBe(0xf8fafc); // Restored raiser plain pearl-white
        });

        // Verify boundary hover highlight
        suite._setHandleHighlight('boundary_start');
        boundaryMeshes.forEach(m => {
            expect(m.material.color.getHex()).toBe(0xfacc15);
        });
        suite._setHandleHighlight(null);
        boundaryMeshes.forEach(m => {
            expect(m.material.color.getHex()).toBe(0xf8fafc);
        });
    });

    it('should configure all 4 vertices points with 3D lit arrows and raiser plain color (0xf8fafc) in corner mode', () => {
        suite.attach(mockMesh, 'corner');
        expect(suite.activeMode).toBe('corner');
        expect(suite.cornerGizmo.visible).toBe(true);

        const cornerHandles = suite.cornerGizmo.handles;
        const arrowTypes = ['start_slope_height', 'end_slope_height', 'start_base_elevation', 'end_base_elevation'];

        // 1. Verify ALL 4 vertices points have arrows
        arrowTypes.forEach(type => {
            const meshes = [];
            cornerHandles.traverse(c => {
                if (c.isMesh && c.userData?.handleType === type && c.material?.visible !== false) {
                    meshes.push(c);
                }
            });
            expect(meshes.length).toBe(2); // Stalk + Cone
            const hasCylinder = meshes.some(m => m.geometry instanceof THREE.CylinderGeometry);
            const hasCone = meshes.some(m => m.geometry instanceof THREE.ConeGeometry);
            expect(hasCylinder).toBe(true);
            expect(hasCone).toBe(true);

            // 2. Verify pearl-white brushed chrome raiser styling (0xf8fafc)
            meshes.forEach(m => {
                expect(m.material).toBeInstanceOf(THREE.MeshStandardMaterial);
                expect(m.material.color.getHex()).toBe(0xf8fafc);
                expect(m.material.depthTest).toBe(false);
            });
        });

        // 3. Verify corner node diamonds use pearl-white brushed chrome (0xf8fafc)
        const nodeTypes = ['start_pos', 'end_pos', 'start_top_pos', 'end_top_pos'];
        nodeTypes.forEach(type => {
            const meshes = [];
            cornerHandles.traverse(c => {
                if (c.isMesh && c.userData?.handleType === type && c.userData?.isRing !== true && c.material?.visible !== false) {
                    meshes.push(c);
                }
            });
            expect(meshes.length).toBeGreaterThan(0);
            meshes.forEach(m => {
                expect(m.material).toBeInstanceOf(THREE.MeshStandardMaterial);
                expect(m.material.color.getHex()).toBe(0xf8fafc);
            });
        });

        // 4. Verify bottom arrow dragging adjusts wall elevation
        const startBaseArrow = [];
        cornerHandles.traverse(c => {
            if (c.isMesh && c.userData?.handleType === 'start_base_elevation') startBaseArrow.push(c);
        });
        expect(startBaseArrow.length).toBeGreaterThan(0);

        // Simulate pointer down on bottom elevation arrow
        suite.cornerGizmo.activeHandle = startBaseArrow[0].userData;
        suite.cornerGizmo.initialElev = 0;
        suite.cornerGizmo.dragStartPoint.set(0, 0, 0);

        // Dragging upward by 25cm raises wall elevation
        const currentPoint = new THREE.Vector3(0, 25, 0);
        const deltaY = currentPoint.y - suite.cornerGizmo.dragStartPoint.y;
        const newElev = Math.max(0, Math.round((suite.cornerGizmo.initialElev + deltaY) / 5) * 5);
        WallEngine.setElevation(mockWall, newElev, false, mockPlanner);

        expect(mockWall.elevation).toBe(25);
    });

    describe('Wall Operation Lifecycle & Selection Lockout', () => {
        it('reports isOperationActive correctly across lifecycle states', () => {
            // 1. Initially detached: false
            suite.detach();
            expect(suite.isOperationActive()).toBe(false);

            // 2. Attached in neutral menu mode: false (allows clicking other objects)
            suite.attach(mockMesh, 'menu');
            expect(suite.isOperationActive()).toBe(false);

            // 3. Attached in Extender (push_pull) mode: true (locks out background selection)
            suite.attach(mockMesh, 'push_pull');
            expect(suite.isOperationActive()).toBe(true);

            // 4. Committing changes resets lock
            suite.commitChanges();
            expect(suite.isOperationActive()).toBe(false);
            expect(suite.target).toBeNull();

            // 5. Attached in Split mode: true (pinned cut with Done/Cancel bar)
            suite.attach(mockMesh, 'split');
            expect(suite.isOperationActive()).toBe(true);
            expect(suite.isSplitPinned).toBe(true);

            // 6. Canceling changes resets lock
            suite.cancelChanges();
            expect(suite.isOperationActive()).toBe(false);
            expect(suite.target).toBeNull();
        });

        it('tracks previewSplit dynamically on hovered wall', () => {
            // Hover at mid-point (T = 0.5)
            suite.previewSplit(mockMesh, new THREE.Vector3(100, 0, 0));
            expect(suite.splitLaserPlane.visible).toBe(true);
            expect(suite.splitCurrentT).toBeCloseTo(0.5, 1);

            // Hover at 25% along wall (T = 0.25)
            suite.previewSplit(mockMesh, new THREE.Vector3(50, 0, 0));
            expect(suite.splitCurrentT).toBeCloseTo(0.25, 1);

            // Hover away from walls: hides laser
            suite.previewSplit(null);
            expect(suite.splitLaserPlane.visible).toBe(false);
        });

        it('tracks previewExtrude dynamically on hovered wall', () => {
            // Hover at mid-point (T = 0.5)
            suite.previewExtrude(mockMesh, new THREE.Vector3(100, 0, 0));
            expect(suite.extrudeGroup.visible).toBe(true);
            expect(suite.extrudeStartT).toBeLessThan(0.5);
            expect(suite.extrudeEndT).toBeGreaterThan(0.5);
            expect(suite.extrudeBadge.style.display).toBe('block');

            // Hover away from walls: hides extrude ghost
            suite.previewExtrude(null);
            expect(suite.extrudeGroup.visible).toBe(false);
            expect(suite.extrudeBadge.style.display).toBe('none');
        });

        it('attaches in extrude_recess mode, pins operation, and reports isOperationActive', () => {
            suite.attach(mockMesh, 'extrude_recess');
            expect(suite.isOperationActive()).toBe(true);
            expect(suite.isExtrudePinned).toBe(true);

            // Committing changes resets lock and detaches
            suite.commitChanges();
            expect(suite.isOperationActive()).toBe(false);
            expect(suite.target).toBeNull();
        });

        it('clears selection in InteractionSystem and CommonInteractionController on detach while retaining active tool', () => {
            const mockCommonCtrl = {
                activeTool: 'push_pull',
                selectedEntity: mockWall,
                selectedMesh: mockMesh,
                selectedType: 'wall',
                interactionState: 'SELECTING',
                hudMode: 'confirm',
                getInteractionState: () => ({ activeTool: 'push_pull', state: 'IDLE' }),
                getCurrentCapabilities: () => []
            };
            suite.ctx.interactions = {
                selectedObject: mockMesh,
                highlightRenderer: { clearAll: vi.fn() },
                _isDeselecting: false
            };
            suite.ctx.commonTools = mockCommonCtrl;

            suite.attach(mockMesh, 'push_pull');
            expect(suite.target).toBe(mockMesh);

            suite.detach();

            expect(suite.target).toBeNull();
            expect(suite.ctx.interactions.selectedObject).toBeNull();
            expect(mockCommonCtrl.selectedEntity).toBeNull();
            expect(mockCommonCtrl.selectedMesh).toBeNull();
            expect(mockCommonCtrl.activeTool).toBe('push_pull'); // tool retained!
            expect(suite.ctx.interactions.highlightRenderer.clearAll).toHaveBeenCalled();
        });

        it('previews wall extender using WallExtenderGizmo applied design and extenderBadge, and clears on null', () => {
            suite.previewExtender(mockMesh, { x: 50, y: 60, z: 50 });
            expect(suite.extenderBadge.style.display).toBe('block');
            expect(suite.extenderBadge.textContent).toContain('Click to Place Extension');
            expect(suite.extenderGizmo.visible).toBe(true);
            expect(suite.extenderGizmo.currentExtrudeDepth).toBe(30);

            // Hover away from wall
            suite.previewExtender(null);
            expect(suite.extenderBadge.style.display).toBe('none');
            expect(suite.extenderGizmo.visible).toBe(false);
        });

        it('previews wall vertices with 3D amber ghost box, corner pins, slope bar, and verticesBadge, and clears on null', () => {
            suite.previewVertices(mockMesh, { x: 50, y: 60, z: 50 });
            expect(suite.verticesBadge.style.display).toBe('block');
            expect(suite.verticesBadge.textContent).toContain('Click to Edit Vertices & Slope');
            expect(suite.wallGhostPreviewGroup.children.length).toBeGreaterThan(0);
            expect(suite.wallGhostPreviewGroup.visible).toBe(true);

            // Hover away from wall
            suite.previewVertices(null);
            expect(suite.verticesBadge.style.display).toBe('none');
            expect(suite.wallGhostPreviewGroup.children.length).toBe(0);
        });

        it('previews wall corner with 3D emerald ghost box, junction cylinders, and cornerBadge, and clears on null', () => {
            suite.previewWallCorner(mockMesh, { x: 50, y: 60, z: 50 });
            expect(suite.cornerBadge.style.display).toBe('block');
            expect(suite.cornerBadge.textContent).toContain('Click to Configure Corner Joint');
            expect(suite.wallGhostPreviewGroup.children.length).toBeGreaterThan(0);
            expect(suite.wallGhostPreviewGroup.visible).toBe(true);

            // Hover away from wall
            suite.previewWallCorner(null);
            expect(suite.cornerBadge.style.display).toBe('none');
            expect(suite.wallGhostPreviewGroup.children.length).toBe(0);
        });

        it('shows and hides mobile guide badge correctly', () => {
            suite.showGuideBadge('👆 Tap any wall to extend');
            expect(suite.guideBadge.style.display).toBe('block');
            expect(suite.guideBadge.textContent).toBe('👆 Tap any wall to extend');

            suite.hideGuideBadge();
            expect(suite.guideBadge.style.display).toBe('none');

            // Attaching automatically hides guide badge
            suite.showGuideBadge('👆 Tap any wall to extend');
            suite.attach(mockMesh, 'push_pull');
            expect(suite.guideBadge.style.display).toBe('none');
        });

        it('pins extender at exact preview coordinates on click and activates operation with Done/Cancel', () => {
            // 1. Hover preview
            suite.previewExtender(mockMesh, { x: 50, y: 0, z: 50 });
            expect(suite.extenderStartT).toBeDefined();
            expect(suite.extenderEndT).toBeDefined();
            const prevStart = suite.extenderStartT;
            const prevEnd = suite.extenderEndT;
            const prevFacing = suite.extenderFacing;

            // 2. Click on wall to place/pin
            suite.attach(mockMesh, 'push_pull');
            expect(suite.isExtenderPinned).toBe(true);
            expect(suite.isOperationActive()).toBe(true);
            expect(suite.extenderGizmo.tStart).toBe(prevStart);
            expect(suite.extenderGizmo.tEnd).toBe(prevEnd);
            expect(suite.extenderGizmo.activeFacing).toBe(prevFacing);
            expect(suite.domConfirmBar.style.display).toBe('flex');
            expect(suite.extenderBadge.style.display).toBe('none');

            // 3. While pinned, operation blocks further hovering/switching
            suite.previewExtender(mockMesh, { x: 10, y: 0, z: 10 });
            expect(suite.extenderGizmo.tStart).toBe(prevStart); // unchanged
        });

        it('commits extender changes on Done and detaches cleanly allowing subsequent selection', () => {
            suite.previewExtender(mockMesh, { x: 50, y: 0, z: 50 });
            suite.attach(mockMesh, 'push_pull');
            expect(suite.isOperationActive()).toBe(true);

            // Spy on extenderGizmo.commit
            const commitSpy = vi.spyOn(suite.extenderGizmo, 'commit');
            suite.commitChanges();

            expect(commitSpy).toHaveBeenCalled();
            expect(suite.isExtenderPinned).toBe(false);
            expect(suite.isOperationActive()).toBe(false);
            expect(suite.target).toBeNull();
            expect(suite.domConfirmBar.style.display).toBe('none');
        });

        it('cancels extender changes on Cancel and detaches cleanly allowing subsequent selection', () => {
            suite.previewExtender(mockMesh, { x: 50, y: 0, z: 50 });
            suite.attach(mockMesh, 'push_pull');
            expect(suite.isOperationActive()).toBe(true);

            // Spy on extenderGizmo.cancel
            const cancelSpy = vi.spyOn(suite.extenderGizmo, 'cancel');
            suite.cancelChanges();

            expect(cancelSpy).toHaveBeenCalled();
            expect(suite.isExtenderPinned).toBe(false);
            expect(suite.isOperationActive()).toBe(false);
            expect(suite.target).toBeNull();
            expect(suite.domConfirmBar.style.display).toBe('none');
        });

        it('supports mobile touch tap with hitPoint to calculate coordinates directly without prior hover', () => {
            // Direct attach with hitPoint (mobile tap simulation)
            suite.attach(mockMesh, 'push_pull', { x: 100, y: 0, z: 100 });

            expect(suite.isExtenderPinned).toBe(true);
            expect(suite.isOperationActive()).toBe(true);
            expect(suite.extenderGizmo.tStart).toBeDefined();
            expect(suite.extenderGizmo.tEnd).toBeDefined();
            expect(suite.domConfirmBar.style.display).toBe('flex');
        });

        it('should use clean default depth (+30 cm) when previewing on empty wall space and not inherit existing protrusion depth (+108 cm)', () => {
            const existingProt = {
                id: 'prot_1',
                type: 'solid_protrusion',
                configId: 'solid_protrusion',
                t: 0.25,
                width: 40,
                height: 280,
                depth: 108,
                facing: 1
            };
            mockWall.attachedWidgets = [existingProt];

            // Hover over empty space at t = 0.75 (x = 150)
            suite.previewExtender(mockMesh, { x: 150, y: 140, z: 0 });

            expect(suite.extenderTargetProtrusion).toBeNull();
            expect(suite.extenderGizmo.currentExtrudeDepth).toBe(30);
            expect(suite.extenderBadge.textContent).toContain('+30 cm');
            expect(suite.extenderBadge.textContent).toContain('Click to Place Extension');
        });

        it('should target existing protrusion for editing and show its depth (+108 cm) when hovering over it', () => {
            const existingProt = {
                id: 'prot_1',
                type: 'solid_protrusion',
                configId: 'solid_protrusion',
                t: 0.25,
                width: 40,
                height: 280,
                depth: 108,
                facing: 1
            };
            mockWall.attachedWidgets = [existingProt];

            // Hover over existing protrusion at t = 0.25 (x = 50)
            suite.previewExtender(mockMesh, { x: 50, y: 140, z: 0 });

            expect(suite.extenderTargetProtrusion).toBe(existingProt);
            expect(suite.extenderGizmo.currentExtrudeDepth).toBe(108);
            expect(suite.extenderBadge.textContent).toContain('+108 cm');
            expect(suite.extenderBadge.textContent).toContain('Click to Edit Extension');
        });

        it('should place multiple independent protrusions on a single wall with distinct depths', () => {
            mockWall.attachedWidgets = [];

            // 1. Place first protrusion at t = 0.25 (x = 50) with depth 40
            suite.previewExtender(mockMesh, { x: 50, y: 140, z: 0 });
            suite.attach(mockMesh, 'push_pull', { x: 50, y: 140, z: 0 });
            suite.extenderGizmo.currentExtrudeDepth = 40;
            suite.commitChanges();

            expect(mockWall.attachedWidgets.length).toBe(1);
            expect(mockWall.attachedWidgets[0].depth).toBe(40);

            // 2. Place second protrusion at t = 0.75 (x = 150) with depth 60
            suite.previewExtender(mockMesh, { x: 150, y: 140, z: 0 });
            expect(suite.extenderTargetProtrusion).toBeNull();
            expect(suite.extenderGizmo.currentExtrudeDepth).toBe(30); // Clean depth, NOT 40

            suite.attach(mockMesh, 'push_pull', { x: 150, y: 140, z: 0 });
            suite.extenderGizmo.currentExtrudeDepth = 60;
            suite.commitChanges();

            expect(mockWall.attachedWidgets.length).toBe(2);
            expect(mockWall.attachedWidgets[0].depth).toBe(40);
            expect(mockWall.attachedWidgets[1].depth).toBe(60);
        });

        it('should easily allow selecting and editing an existing protrusion directly via its hitbox', () => {
            const existingProt = {
                id: 'prot_edit',
                type: 'solid_protrusion',
                configId: 'solid_protrusion',
                t: 0.5,
                width: 50,
                height: 200,
                depth: 35,
                facing: 1
            };
            mockWall.attachedWidgets = [existingProt];

            const mockHitbox = new THREE.Mesh(new THREE.BoxGeometry(50, 200, 35));
            mockHitbox.userData = {
                isProtrusion: true,
                widget: existingProt,
                parentWall: mockWall
            };

            // Direct selection of the protrusion hitbox
            suite.attach(mockHitbox, 'push_pull');

            expect(suite.isExtenderPinned).toBe(true);
            expect(suite.extenderTargetProtrusion).toBe(existingProt);
            expect(suite.extenderGizmo.existingProtrusion).toBe(existingProt);
            expect(suite.extenderGizmo.currentExtrudeDepth).toBe(35);

            // Adjust depth to 55 and commit
            suite.extenderGizmo.currentExtrudeDepth = 55;
            suite.commitChanges();

            expect(existingProt.depth).toBe(55);
            expect(mockWall.attachedWidgets.length).toBe(1);
        });
    });

    describe('Small Area / Angled Wall Validation & Red Highlight', () => {
        let shortWall;
        let shortMesh;

        beforeEach(() => {
            shortWall = {
                id: 'wall_short',
                type: 'outer',
                startX: 0,
                startY: 0,
                endX: 30,
                endY: 0,
                startAnchor: { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) },
                endAnchor: { x: 30, y: 0, position: () => ({ x: 30, y: 0 }) },
                thickness: 20,
                height: 280,
                elevation: 0,
                attachedWidgets: [],
                attachedMoldings: []
            };
            shortMesh = new THREE.Mesh(new THREE.BoxGeometry(30, 280, 20));
            shortMesh.userData = { entity: shortWall };
            shortWall.mesh3D = shortMesh;
        });

        it('should mark previewExtrude invalid, render red ghost, and format warning badge on short wall (< 40 cm)', () => {
            suite.previewExtrude(shortMesh, new THREE.Vector3(15, 0, 0));

            expect(suite.isValidPlacement).toBe(false);
            expect(suite.invalidReason).toBe('wall_too_short');
            expect(suite.extrudeBadge.textContent).toContain('Wall Too Short');
            expect(suite.extrudeBadge.style.background).toContain('239, 68, 68');
            expect(domElement.style.cursor).toBe('not-allowed');

            // 3D Neutral Ghost volume should be crimson red (0xef4444)
            expect(suite.bayPreviewGroup.children.length).toBeGreaterThan(0);
            const neutralMesh = suite.bayPreviewGroup.children[0];
            const neutralEdges = suite.bayPreviewGroup.children[1];
            expect(neutralMesh.material.color.getHex()).toBe(0xef4444);
            expect(neutralEdges.material.color.getHex()).toBe(0xef4444);

            // Drag handles suppressed in invalid state
            expect(suite.extrudeHandle.visible).toBe(false);
            expect(suite.extrudeStartHandle.visible).toBe(false);
            expect(suite.extrudeEndHandle.visible).toBe(false);
        });

        it('should block Bay/Niche attach / pinning on invalid small space and prevent deformed geometry', () => {
            suite.previewExtrude(shortMesh, new THREE.Vector3(15, 0, 0));
            expect(suite.isValidPlacement).toBe(false);

            // Attempt to click to place on short wall
            suite.attach(shortMesh, 'extrude_recess', new THREE.Vector3(15, 0, 0));

            expect(suite.isExtrudePinned).toBe(false);
            expect(suite.isValidPlacement).toBe(false);
        });

        it('should mark previewExtender invalid and render red solid block preview on short wall', () => {
            suite.previewExtender(shortMesh, { x: 15, y: 0, z: 0 });

            expect(suite.isValidPlacement).toBe(false);
            expect(suite.invalidReason).toBe('wall_too_short');
            expect(suite.extenderBadge.textContent).toContain('Wall Too Short');
            expect(suite.extenderBadge.style.background).toContain('239, 68, 68');
            expect(domElement.style.cursor).toBe('not-allowed');

            // Solid block preview should be crimson red (0xef4444)
            expect(suite.extenderGizmo.previewMesh.material.color.getHex()).toBe(0xef4444);
            expect(suite.extenderGizmo.previewEdgesMat.color.getHex()).toBe(0xef4444);
            expect(suite.extenderGizmo.previewMesh.material.opacity).toBe(0.50);
            expect(suite.extenderGizmo.depthLeaderLine.visible).toBe(false);
        });

        it('should block extender pinning on invalid small wall', () => {
            suite.previewExtender(shortMesh, { x: 15, y: 0, z: 0 });
            expect(suite.isValidPlacement).toBe(false);

            // Attempt to click to place
            suite.attach(shortMesh, 'push_pull', { x: 15, y: 0, z: 0 });

            expect(suite.isExtenderPinned).toBe(false);
            expect(suite.isValidPlacement).toBe(false);
        });

        it('should mark placement invalid when span is < 30 cm on tight wall space (e.g. 13 cm bay)', () => {
            // Test 50 cm wall near extreme edge where span drops below 30 cm
            const tightWall = {
                id: 'wall_tight',
                type: 'outer',
                startX: 0,
                startY: 0,
                endX: 50,
                endY: 0,
                startAnchor: { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) },
                endAnchor: { x: 50, y: 0, position: () => ({ x: 50, y: 0 }) },
                thickness: 20,
                height: 280,
                elevation: 0,
                attachedWidgets: [],
                attachedMoldings: []
            };
            const tightMesh = new THREE.Mesh(new THREE.BoxGeometry(50, 280, 20));
            tightMesh.userData = { entity: tightWall };

            // Hover at extreme start t ~ 0.05
            suite.previewExtrude(tightMesh, new THREE.Vector3(2.5, 0, 0));

            expect(suite.isValidPlacement).toBe(false);
            expect(suite.invalidReason).toBe('space_too_short');
            expect(suite.extrudeBadge.textContent).toContain('Space Too Short');
        });

        it('should restore clean cyan / green highlight and allow placement when moving back to valid wall', () => {
            // 1. First hover on short wall -> red invalid
            suite.previewExtrude(shortMesh, new THREE.Vector3(15, 0, 0));
            expect(suite.isValidPlacement).toBe(false);
            expect(suite.extrudeBadge.textContent).toContain('Wall Too Short');

            // 2. Move to spacious 200 cm wall -> restored to valid cyan
            suite.previewExtrude(mockMesh, new THREE.Vector3(100, 0, 0));
            expect(suite.isValidPlacement).toBe(true);
            expect(suite.extrudeBadge.textContent).toContain('Click to Place Bay/Niche');
            expect(suite.extrudeBadge.textContent).toContain('(100 cm)');
            expect(suite.bayPreviewGroup.children[0].material.color.getHex()).toBe(0x00f0ff);
            expect(domElement.style.cursor).toBe('pointer');

            // 3. Click to place succeeds
            suite.attach(mockMesh, 'extrude_recess', new THREE.Vector3(100, 0, 0));
            expect(suite.isExtrudePinned).toBe(true);
        });

        it('should mark placement invalid when too close to an intersecting connected wall corner (< 25 cm)', () => {
            const cornerAnchor = { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) };
            const endAnchor = { x: 200, y: 0, position: () => ({ x: 200, y: 0 }) };
            const adjoiningEnd = { x: 0, y: 150, position: () => ({ x: 0, y: 150 }) };

            const hostWall = {
                id: 'host_wall_corner',
                type: 'outer',
                startAnchor: cornerAnchor,
                endAnchor: endAnchor,
                thickness: 20,
                height: 280,
                elevation: 0,
                attachedWidgets: [],
                attachedMoldings: []
            };
            const adjoiningWall = {
                id: 'adjoining_wall',
                type: 'outer',
                startAnchor: cornerAnchor,
                endAnchor: adjoiningEnd,
                thickness: 20,
                height: 280,
                elevation: 0
            };
            mockPlanner.walls = [hostWall, adjoiningWall];

            const hostMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 280, 20));
            hostMesh.userData = { entity: hostWall };

            // Hover close to corner anchor (x = 35 cm, with 50cm halfSpan -> tStart ~ 0.05 = 10 cm < 25 cm)
            suite.previewExtrude(hostMesh, new THREE.Vector3(35, 0, 0));

            expect(suite.isValidPlacement).toBe(false);
            expect(suite.invalidReason).toBe('connected_corner');
            expect(suite.extrudeBadge.textContent).toContain('Too Close to Connected Corner');
            expect(domElement.style.cursor).toBe('not-allowed');

            // Clicks to place should be rejected
            suite.attach(hostMesh, 'extrude_recess', new THREE.Vector3(35, 0, 0));
            expect(suite.isExtrudePinned).toBe(false);
        });

        it('should mark placement invalid when wing clearance is < 20 cm for bay/niche cuts', () => {
            // Standalone wall without connected walls, but previewed with left wing < 20 cm
            const a1 = { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) };
            const a2 = { x: 200, y: 0, position: () => ({ x: 200, y: 0 }) };
            const testWall = {
                id: 'test_wall_wing',
                type: 'outer',
                startAnchor: a1,
                endAnchor: a2,
                thickness: 20,
                height: 280,
                elevation: 0,
                attachedWidgets: [],
                attachedMoldings: []
            };
            mockPlanner.walls = [testWall];
            const testMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 280, 20));
            testMesh.userData = { entity: testWall };

            // Hover near start such that distStart is < 20 cm (e.g. at x = 40 with span extending to 10 cm from start)
            suite.previewExtrude(testMesh, new THREE.Vector3(38, 0, 0));
            // Force startT to 0.05 (10 cm wing) and endT to 0.50 (100 cm)
            suite.extrudeStartT = 0.05;
            suite.extrudeEndT = 0.50;
            const validation = suite._validatePlacementSpace(testWall, suite.extrudeStartT, suite.extrudeEndT, 'extrude_recess');

            expect(validation.isValid).toBe(false);
            expect(validation.reason).toBe('corner_clearance');
            expect(validation.message).toContain('Too Close to Corner');
        });

        it('should reject commitChanges when placement is invalid', () => {
            suite.attach(mockMesh, 'extrude_recess', new THREE.Vector3(100, 0, 0));
            expect(suite.isExtrudePinned).toBe(true);

            // Force invalid placement state (e.g. startT dragged to corner)
            suite.extrudeStartT = 0.02; // 4 cm wing < 20 cm
            suite.extrudeEndT = 0.50;

            mockPlanner.commandManager.execute.mockClear();
            suite.commitChanges();

            // commitChanges must NOT execute command
            expect(mockPlanner.commandManager.execute).not.toHaveBeenCalled();
            expect(suite.isValidPlacement).toBe(false);
        });

        it('tracks cursor symmetrically to both left and right corners in previewExtrude, showing red invalid status', () => {
            const longWall = {
                id: 'long_wall',
                startX: 0,
                startY: 0,
                endX: 500,
                endY: 0,
                startAnchor: { x: 0, y: 0, position: () => ({ x: 0, y: 0 }) },
                endAnchor: { x: 500, y: 0, position: () => ({ x: 500, y: 0 }) },
                thickness: 20,
                height: 280
            };
            const longMesh = new THREE.Mesh(new THREE.BoxGeometry(500, 280, 20));
            longMesh.userData = { entity: longWall };

            // 1. Far left hover (x = 5 cm, t ~ 0.01)
            suite.previewExtrude(longMesh, new THREE.Vector3(5, 0, 0));
            expect(suite.extrudeStartT).toBe(0);
            expect(suite.isValidPlacement).toBe(false);
            expect(suite.invalidReason).toBe('corner_clearance');

            // 2. Center hover (x = 250 cm, t ~ 0.5)
            suite.previewExtrude(longMesh, new THREE.Vector3(250, 0, 0));
            expect(suite.isValidPlacement).toBe(true);
            expect(suite.extrudeStartT).toBeGreaterThan(0.2);
            expect(suite.extrudeEndT).toBeLessThan(0.8);

            // 3. Far right hover (x = 495 cm, t ~ 0.99)
            suite.previewExtrude(longMesh, new THREE.Vector3(495, 0, 0));
            expect(suite.extrudeEndT).toBe(1);
            expect(suite.isValidPlacement).toBe(false);
            expect(suite.invalidReason).toBe('corner_clearance');
        });

        it('initializes default tStart and tEnd and sets isExtrudePinned when entering extrude_recess via setMode', () => {
            suite.target = mockMesh;
            suite.extrudeStartT = undefined;
            suite.extrudeEndT = undefined;
            suite.setMode('extrude_recess');

            expect(suite.extrudeStartT).toBe(0.25);
            expect(suite.extrudeEndT).toBe(0.75);
            expect(suite.isExtrudePinned).toBe(true);
            expect(suite.isOperationActive()).toBe(true);
            expect(suite.extrudeGroup.visible).toBe(true);
        });

        it('synchronizes ghost geometry and badges on camera change during preview and active modes', () => {
            suite.target = mockMesh;
            suite.previewExtrude(mockMesh, new THREE.Vector3(50, 0, 50));
            expect(suite.extrudeGroup.visible).toBe(true);
            expect(suite.extrudeBadge.style.display).toBe('block');

            // Move camera
            suite.ctx.camera.position.set(0, 500, -200);
            suite._onCameraChange();

            // Facing and badge position updated without error
            expect(suite.currentFacing).toBeDefined();
            expect(suite.extrudeBadge.style.left).toBeDefined();
            expect(suite.extrudeBadge.style.top).toBeDefined();
        });

        it('attaches common tools to wallInteractiveSuite via InteractionSystem.select with intersect.point without ReferenceError', () => {
            const interactions = new InteractionSystem(suite.ctx);
            interactions.wallInteractiveSuite = suite;
            interactions.commonController = { activeTool: 'extrude_recess', setSelection: vi.fn(), clearSelection: vi.fn(), select: vi.fn() };

            const attachSpy = vi.spyOn(suite, 'attach');
            const mockIntersect = { point: new THREE.Vector3(50, 10, 20) };

            expect(() => {
                interactions.select(mockMesh, null, null, true, mockIntersect);
            }).not.toThrow();

            expect(attachSpy).toHaveBeenCalledWith(mockMesh, 'extrude_recess', mockIntersect.point);
        });

        it('attaches protrusion to wallInteractiveSuite in push_pull via InteractionSystem.select without ReferenceError', () => {
            const interactions = new InteractionSystem(suite.ctx);
            interactions.wallInteractiveSuite = suite;
            interactions.commonController = { activeTool: 'select', setSelection: vi.fn(), clearSelection: vi.fn() };

            const protMesh = new THREE.Mesh();
            protMesh.userData = { isProtrusion: true, widget: { id: 'prot_1', width: 40, depth: 30, wall: mockWall } };

            const attachSpy = vi.spyOn(suite, 'attach');
            const mockIntersect = { point: new THREE.Vector3(40, 0, 10) };

            expect(() => {
                interactions.select(protMesh, null, null, true, mockIntersect);
            }).not.toThrow();

            expect(attachSpy).toHaveBeenCalledWith(protMesh, 'push_pull', mockIntersect.point);
        });
    });
});



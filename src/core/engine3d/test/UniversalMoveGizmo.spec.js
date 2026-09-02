import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { UniversalMoveGizmo } from '../UniversalMoveGizmo.js';
import { CommonTransformEngine } from '../tools/CommonTransformEngine.js';

describe('Universal 3D Move & Translation Gizmo System', () => {
    let mockCtx;
    let gizmo;
    let mockEntity;
    let mockMesh;

    beforeEach(() => {
        // Mock DOM element
        const domElement = document.createElement('div');
        domElement.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: 1000,
            height: 800
        });

        const camera = new THREE.PerspectiveCamera(45, 1000 / 800, 1, 10000);
        camera.position.set(0, 150, 300);
        camera.lookAt(0, 0, 0);

        mockCtx = {
            renderer: { domElement },
            camera,
            scene: new THREE.Scene(),
            controls: { enabled: true },
            requestRender: vi.fn(),
            realtimeUpdate: { markDirty: vi.fn() },
            interactions: {}
        };

        const transformEngine = new CommonTransformEngine(mockCtx);
        mockCtx.commonController = {
            transformEngine
        };

        gizmo = new UniversalMoveGizmo(mockCtx);
        mockCtx.interactions.universalMoveGizmo = gizmo;

        mockMesh = new THREE.Mesh(
            new THREE.BoxGeometry(60, 40, 80),
            new THREE.MeshBasicMaterial()
        );
        mockMesh.position.set(100, 20, 100);

        mockEntity = {
            id: 'furniture_table_1',
            type: 'furniture',
            x: 100,
            y: 100,
            mesh3D: mockMesh
        };
        mockMesh.userData = { entity: mockEntity };
    });

    describe('1. Instantiation & Dynamic Geometry Sizing', () => {
        it('should initialize with correct default properties and visual group', () => {
            expect(gizmo.name).toBe('UniversalMoveGizmo');
            expect(gizmo.gizmoVisuals).toBeDefined();
            expect(gizmo.snapMode).toBe(10);
            expect(gizmo.isDragging).toBe(false);
        });

        it('should build 3D ground handles when attached to movable object', () => {
            gizmo.attach(mockMesh);
            expect(gizmo.attachedObject).toBe(mockMesh);
            expect(gizmo.attachedEntity).toBe(mockEntity);
            expect(gizmo.visible).toBe(true);

            // Verify Center Grab Disc, X-Axis line/handles, Z-Axis line/handles
            const handles = gizmo.gizmoVisuals.children.map(c => c.name).filter(Boolean);
            expect(handles).toContain('handle_center');
            expect(handles).toContain('handle_x');
            expect(handles).toContain('handle_z');
        });

        it('should add vertical Y handle if entity supports elevation', () => {
            const elevEntity = {
                id: 'curtain_1',
                type: 'curtain',
                elevation: 100,
                mesh3D: mockMesh
            };
            mockMesh.userData = { entity: elevEntity };

            gizmo.attach(mockMesh);
            const handles = gizmo.gizmoVisuals.children.map(c => c.name).filter(Boolean);
            expect(handles).toContain('handle_y');
        });
    });

    describe('2. In-Place Translation & Single Source of Truth', () => {
        it('should translate entity and mesh in place without recreating groups', () => {
            gizmo.attach(mockMesh);

            const initialPos = { x: mockEntity.x, y: mockEntity.y };
            const delta = new THREE.Vector3(20, 0, 30);
            const targetPos = new THREE.Vector3(120, 0.05, 130);

            gizmo._applyTranslation(delta, targetPos);

            expect(mockEntity.x).toBe(initialPos.x + 20);
            expect(mockEntity.y).toBe(initialPos.y + 30);
            expect(mockMesh.position.x).toBe(120);
            expect(mockMesh.position.z).toBe(130);
            expect(mockCtx.realtimeUpdate.markDirty).toHaveBeenCalledWith(mockEntity, 'transform');
        });

        it('should slide wall plugin along host wall baseline (t coordinate)', () => {
            const wallPluginEntity = {
                id: 'door_1',
                type: 'door',
                t: 0.5,
                elevation: 0,
                wall: {
                    length3D: 200,
                    height: 280,
                    mesh3D: new THREE.Mesh(new THREE.BoxGeometry(200, 280, 20))
                },
                mesh3D: mockMesh
            };
            mockMesh.userData = { entity: wallPluginEntity };

            gizmo.attach(mockMesh);

            // Move by +20cm along wall
            gizmo._applyTranslation(new THREE.Vector3(20, 0, 0), new THREE.Vector3(120, 0, 100));

            // Initial localX = 0.5 * 200 = 100cm. New localX = 120cm => t = 120/200 = 0.6
            expect(wallPluginEntity.t).toBeCloseTo(0.6);
            expect(mockCtx.realtimeUpdate.markDirty).toHaveBeenCalledWith(wallPluginEntity, 'geometry');
        });

        it('should allow clicking anywhere on the object to initiate drag', () => {
            gizmo.attach(mockMesh);
            mockCtx.interactables = [mockMesh];

            // Trigger pointerdown directly on the mesh
            const fakeEvent = {
                button: 0,
                pointerType: 'mouse',
                clientX: 500,
                clientY: 400,
                stopPropagation: vi.fn(),
                preventDefault: vi.fn()
            };

            // Raycaster intersects the mock mesh
            vi.spyOn(gizmo.raycaster, 'intersectObject').mockReturnValue([{ object: mockMesh, point: new THREE.Vector3(100, 0, 100) }]);
            gizmo._onPointerDown(fakeEvent);

            expect(gizmo.isDragging).toBe(true);
            expect(gizmo.activeHandle).toBe('center');
            expect(mockCtx.controls.enabled).toBe(false);
        });

        it('should keep gizmo locked to bottom-center of the object during translation', () => {
            gizmo.attach(mockMesh);
            const delta = new THREE.Vector3(50, 0, 80);
            gizmo._applyTranslation(delta);

            expect(mockMesh.position.x).toBe(150);
            expect(mockMesh.position.z).toBe(180);
            expect(gizmo.position.x).toBe(150);
            expect(gizmo.position.z).toBe(180);
        });
    });

    describe('3. Move HUD Panel Interaction & Precision Controls', () => {
        it('should render compact draggable HUD panel with live coordinate inputs and D-Pad', () => {
            gizmo.attach(mockMesh);

            expect(gizmo.hudPanel).toBeDefined();
            expect(gizmo.hudPanel.style.display).toBe('flex');

            const inputX = gizmo.hudPanel.querySelector('#move-hud-input-x');
            const inputZ = gizmo.hudPanel.querySelector('#move-hud-input-z');
            expect(inputX).toBeDefined();
            expect(inputZ).toBeDefined();
            expect(inputX.value).toBe('100');
            expect(inputZ.value).toBe('100');
        });

        it('should update entity position when D-Pad buttons are clicked', () => {
            gizmo.attach(mockMesh);

            const btnE = gizmo.hudPanel.querySelector('#move-btn-dpad-e'); // +X
            const btnN = gizmo.hudPanel.querySelector('#move-btn-dpad-n'); // +Z

            // Snap mode is 10cm by default
            btnE.click();
            expect(mockEntity.x).toBe(110);

            btnN.click();
            expect(mockEntity.y).toBe(110);
        });

        it('should center entity position when Center button is clicked', () => {
            gizmo.attach(mockMesh);

            const btnCenter = gizmo.hudPanel.querySelector('#move-btn-center-reset');
            btnCenter.click();

            expect(mockEntity.x).toBe(0);
            expect(mockEntity.y).toBe(0);
            expect(mockMesh.position.x).toBe(0);
            expect(mockMesh.position.z).toBe(0);
        });

        it('should change snap increments when snap mode pills are clicked', () => {
            gizmo.attach(mockMesh);

            const snap50Btn = gizmo.hudPanel.querySelector('.move-snap-mode-btn[data-snap="50"]');
            snap50Btn.click();

            expect(gizmo.snapMode).toBe(50);
            expect(snap50Btn.classList.contains('active')).toBe(true);
        });
    });

    describe('4. Detach & Cleanup', () => {
        it('should hide HUD and clear visuals on detach', () => {
            gizmo.attach(mockMesh);
            expect(gizmo.visible).toBe(true);

            gizmo.detach();
            expect(gizmo.visible).toBe(false);
            expect(gizmo.attachedObject).toBeNull();
            expect(gizmo.hudPanel.style.display).toBe('none');
        });

        it('should remove DOM HUD elements on dispose', () => {
            gizmo.attach(mockMesh);
            const hud = gizmo.hudPanel;
            expect(document.body.contains(hud)).toBe(true);

            gizmo.dispose();
            expect(document.body.contains(hud)).toBe(false);
        });
    });
});

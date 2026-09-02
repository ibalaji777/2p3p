import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { UniversalSpinGizmo } from '../UniversalSpinGizmo.js';
import { CommonTransformEngine } from '../tools/CommonTransformEngine.js';

describe('Universal 3D Spin & Protractor Turntable Gizmo System', () => {
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

        gizmo = new UniversalSpinGizmo(mockCtx);
        mockCtx.interactions.universalSpinGizmo = gizmo;

        mockMesh = new THREE.Mesh(
            new THREE.BoxGeometry(40, 40, 80),
            new THREE.MeshBasicMaterial()
        );
        mockMesh.position.set(100, 20, 100);

        mockEntity = {
            id: 'furniture_sofa_1',
            type: 'furniture',
            rotation: 0,
            mesh3D: mockMesh
        };
        mockMesh.userData = { entity: mockEntity };
    });

    describe('1. Instantiation & Dynamic Geometry Sizing', () => {
        it('should initialize with correct default properties and child groups', () => {
            expect(gizmo.name).toBe('UniversalSpinGizmo');
            expect(gizmo.visible).toBe(false);
            expect(gizmo.handles).toBeDefined();
            expect(gizmo.staticVisuals).toBeDefined();
            expect(gizmo.dynamicVisuals).toBeDefined();
        });

        it('should adapt turntable radius dynamically based on object bounding box', () => {
            gizmo.attach(mockMesh);
            expect(gizmo.visible).toBe(true);
            expect(gizmo.currentRadius).toBeGreaterThanOrEqual(32);

            // Bounding box horizontal span for 40x80 box: hypot(40, 80) = ~89.4. (89.4 / 2) * 1.35 = ~60.3
            expect(gizmo.currentRadius).toBeCloseTo(60.3, 0);
            expect(gizmo.position.x).toBe(100);
            expect(gizmo.position.z).toBe(100);
        });

        it('should build outer grab ring, 4 cardinal grab knobs, and forward heading arrow', () => {
            gizmo.attach(mockMesh);

            const ringMesh = gizmo.handles.children.find(c => c.userData?.type === 'ring');
            expect(ringMesh).toBeDefined();
            expect(ringMesh.isMesh).toBe(true);

            const knobHandles = gizmo.handles.children.filter(c => c.userData?.type === 'cardinalKnob');
            expect(knobHandles.length).toBe(4);

            expect(gizmo.headingArrowGroup).toBeDefined();
            expect(gizmo.headingArrowGroup.name).toBe('HeadingArrowGroup');
        });
    });

    describe('2. Tactile Magnetic Snapping Engine', () => {
        it('should magnetically latch to 15-degree CAD increments when close', () => {
            gizmo.snapMode = 15;

            // 14.2 degrees is within 3.5 deg threshold of 15 deg
            const angle1 = gizmo._applyMagneticSnapping(14.2, { altKey: false });
            expect(angle1).toBe(15);
            expect(gizmo.isMagneticSnapped).toBe(true);

            // 31.8 degrees is within 3.5 deg threshold of 30 deg
            const angle2 = gizmo._applyMagneticSnapping(31.8, { altKey: false });
            expect(angle2).toBe(30);
            expect(gizmo.isMagneticSnapped).toBe(true);

            // 20.0 degrees is beyond 3.5 deg threshold of 15 and 30 deg -> remains continuous
            const angle3 = gizmo._applyMagneticSnapping(20.0, { altKey: false });
            expect(angle3).toBe(20.0);
            expect(gizmo.isMagneticSnapped).toBe(false);
        });

        it('should support continuous 0.1 deg free rotation when Alt key is held', () => {
            gizmo.snapMode = 15;
            const freeAngle = gizmo._applyMagneticSnapping(14.8, { altKey: true });
            expect(freeAngle).toBe(14.8);
            expect(gizmo.isMagneticSnapped).toBe(false);
        });

        it('should lock strictly to 45/90 degree cardinal axes when Shift key is held', () => {
            gizmo.snapMode = 15;
            const shiftAngle = gizmo._applyMagneticSnapping(52, { shiftKey: true });
            expect(shiftAngle).toBe(45);
            expect(gizmo.isMagneticSnapped).toBe(true);
        });
    });

    describe('3. Real-Time In-Place Rotation Execution & Sync', () => {
        it('should rotate entity mesh3D in-place without replacing object or resetting selection', () => {
            gizmo.attach(mockMesh);

            gizmo._applyRotationToEntity(90);
            expect(mockEntity.rotation).toBe(90);
            expect(mockMesh.rotation.y).toBeCloseTo(-Math.PI / 2, 4);

            gizmo._applyRotationToEntity(180);
            expect(mockEntity.rotation).toBe(180);
            expect(mockMesh.rotation.y).toBeCloseTo(-Math.PI, 4);
        });

        it('should dynamically update swept angle wedge and heading arrow during rotation', () => {
            gizmo.attach(mockMesh);
            gizmo._updateDynamicSweptArc(0, 90);

            expect(gizmo.dynamicVisuals.children.length).toBeGreaterThan(0);
            const wedgeMesh = gizmo.dynamicVisuals.children[0];
            expect(wedgeMesh.isMesh).toBe(true);
            expect(wedgeMesh.renderOrder).toBe(9993);

            gizmo._updateHeadingArrowRotation(90);
            expect(gizmo.headingArrowGroup.rotation.y).toBeCloseTo(-Math.PI / 2, 4);
        });

        it('should sync rotation two-way when CommonTransformEngine.executeSpin is invoked', () => {
            gizmo.attach(mockMesh);

            mockCtx.commonController.transformEngine.executeSpin(mockEntity, 45);
            expect(mockEntity.rotation).toBe(45);
            expect(gizmo.currentRotation).toBe(45);
            expect(gizmo.headingArrowGroup.rotation.y).toBeCloseTo(-45 * Math.PI / 180, 4);
        });
    });

    describe('4. Floating HUD Dock Integration & Disposal', () => {
        it('should show and sync HUD angle and cardinal tag', () => {
            gizmo.attach(mockMesh);
            expect(gizmo.hudPanel).toBeDefined();

            gizmo.currentRotation = 90;
            gizmo.syncHUD();

            const angleDisplay = gizmo.hudPanel.querySelector('#spin-hud-angle-display');
            const cardinalTag = gizmo.hudPanel.querySelector('#spin-hud-cardinal-tag');

            expect(angleDisplay.innerText).toBe('90°');
            expect(cardinalTag.innerText).toContain('RIGHT');
        });

        it('should cleanly detach and dispose DOM nodes and meshes', () => {
            gizmo.attach(mockMesh);
            expect(gizmo.visible).toBe(true);

            gizmo.detach();
            expect(gizmo.visible).toBe(false);
            expect(gizmo.target).toBeNull();
            expect(gizmo.dynamicVisuals.children.length).toBe(0);

            gizmo.dispose();
            expect(gizmo.hudPanel.parentNode).toBeNull();
            expect(gizmo.badge.parentNode).toBeNull();
        });
    });
});

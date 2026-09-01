import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { WallCutawaySystem } from '../WallCutawaySystem.js';

describe('Sims 4 3-Way 3D Wall Visibility & Cutaway Viewport System', () => {
    let mockCtx;
    let cutawaySystem;
    let frontWallGroup;
    let backWallGroup;

    beforeEach(() => {
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
        camera.position.set(0, 100, 300); // Camera positioned at +Z looking towards origin (0, 0, 0)

        const controls = {
            target: new THREE.Vector3(0, 0, 0)
        };

        const structureGroup = new THREE.Group();

        // 1. Front Wall (at Z = 100, between camera at Z = 300 and origin at Z = 0)
        frontWallGroup = new THREE.Group();
        frontWallGroup.userData = {
            isWallGroup: true,
            entity: {
                id: 'wall_front',
                startX: -100,
                startY: 100,
                endX: 100,
                endY: 100,
                height: 120,
                elevation: 0
            }
        };
        const frontMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 120, 10), new THREE.MeshBasicMaterial());
        frontMesh.userData = { isWallMesh: true };
        frontWallGroup.add(frontMesh);
        frontWallGroup.userData.wallMesh = frontMesh;

        // Attached upper molding on front wall
        const frontMolding = new THREE.Mesh(new THREE.BoxGeometry(200, 10, 2), new THREE.MeshBasicMaterial());
        frontMolding.userData = { moldData: { heightOffset: 100 } };
        frontWallGroup.add(frontMolding);

        // 2. Back Wall (at Z = -100, behind origin at Z = 0)
        backWallGroup = new THREE.Group();
        backWallGroup.userData = {
            isWallGroup: true,
            entity: {
                id: 'wall_back',
                startX: -100,
                startY: -100,
                endX: 100,
                endY: -100,
                height: 120,
                elevation: 0
            }
        };
        const backMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 120, 10), new THREE.MeshBasicMaterial());
        backMesh.userData = { isWallMesh: true };
        backWallGroup.add(backMesh);
        backWallGroup.userData.wallMesh = backMesh;

        structureGroup.add(frontWallGroup);
        structureGroup.add(backWallGroup);

        mockCtx = {
            camera,
            controls,
            structureGroup,
            requestRender: () => {}
        };

        cutawaySystem = new WallCutawaySystem(mockCtx);
    });

    it('1. should initialize in walls_up mode with full wall height', () => {
        expect(cutawaySystem.getMode()).toBe('walls_up');
        cutawaySystem.update(true);

        const frontMesh = frontWallGroup.userData.wallMesh;
        const backMesh = backWallGroup.userData.wallMesh;

        expect(frontMesh.scale.y).toBe(1.0);
        expect(backMesh.scale.y).toBe(1.0);
    });

    it('2. should collapse all walls to low cutlines in walls_down mode', () => {
        cutawaySystem.setMode('walls_down');
        expect(cutawaySystem.getMode()).toBe('walls_down');

        const frontMesh = frontWallGroup.userData.wallMesh;
        const backMesh = backWallGroup.userData.wallMesh;

        // 15cm cutline / 120cm height = 0.125
        expect(frontMesh.scale.y).toBeCloseTo(15 / 120, 0.01);
        expect(backMesh.scale.y).toBeCloseTo(15 / 120, 0.01);

        // Upper attached molding should be hidden
        const molding = frontWallGroup.children.find(c => c.userData?.moldData);
        expect(molding.visible).toBe(false);
    });

    it('3. should dynamically cut front blocking walls and keep back walls in cutaway mode', () => {
        cutawaySystem.setMode('cutaway');
        expect(cutawaySystem.getMode()).toBe('cutaway');

        const frontMesh = frontWallGroup.userData.wallMesh;
        const backMesh = backWallGroup.userData.wallMesh;

        // Front wall (between camera at Z=300 and origin) is in foreground -> cut down
        expect(frontMesh.scale.y).toBeCloseTo(15 / 120, 0.01);

        // Back wall (behind origin at Z=-100) is in background -> full height
        expect(backMesh.scale.y).toBe(1.0);
    });

    it('4. should dynamically swap cut walls when camera orbits 180 degrees', () => {
        cutawaySystem.setMode('cutaway');

        // Move camera to opposite side: Z = -300 (looking at origin)
        mockCtx.camera.position.set(0, 100, -300);
        cutawaySystem.update(true);

        const frontMesh = frontWallGroup.userData.wallMesh;
        const backMesh = backWallGroup.userData.wallMesh;

        // Now back wall (at Z=-100) is in foreground -> cut down
        expect(backMesh.scale.y).toBeCloseTo(15 / 120, 0.01);

        // Front wall (at Z=100) is now in background -> full height
        expect(frontMesh.scale.y).toBe(1.0);
    });

    it('5. should cycle cleanly through walls_up -> cutaway -> walls_down -> walls_up', () => {
        expect(cutawaySystem.getMode()).toBe('walls_up');

        expect(cutawaySystem.cycleMode()).toBe('cutaway');
        expect(cutawaySystem.getMode()).toBe('cutaway');

        expect(cutawaySystem.cycleMode()).toBe('walls_down');
        expect(cutawaySystem.getMode()).toBe('walls_down');

        expect(cutawaySystem.cycleMode()).toBe('walls_up');
        expect(cutawaySystem.getMode()).toBe('walls_up');
    });
});

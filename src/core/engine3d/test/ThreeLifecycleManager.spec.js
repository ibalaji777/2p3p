import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { ThreeLifecycleManager } from '../ThreeLifecycleManager.js';
import { ComponentRegistry } from '../ComponentRegistry.js';

describe('ThreeLifecycleManager (Phase 8 Architecture)', () => {
    describe('1. disposeHierarchy', () => {
        it('disposes geometries and materials, removes from parent, and purges interactables', () => {
            const root = new THREE.Group();
            const parent = new THREE.Group();
            parent.add(root);

            const geo = new THREE.BoxGeometry(10, 10, 10);
            const mat = new THREE.MeshBasicMaterial();
            const disposeGeoSpy = vi.spyOn(geo, 'dispose');
            const disposeMatSpy = vi.spyOn(mat, 'dispose');

            const mesh = new THREE.Mesh(geo, mat);
            root.add(mesh);

            const interactables = [mesh, new THREE.Mesh()];

            ThreeLifecycleManager.disposeHierarchy(root, { interactables });

            expect(disposeGeoSpy).toHaveBeenCalled();
            expect(disposeMatSpy).toHaveBeenCalled();
            expect(parent.children.includes(root)).toBe(false);
            expect(interactables.includes(mesh)).toBe(false);
            expect(interactables.length).toBe(1);
        });

        it('preserves objects and geometries tagged with userData.keepAlive', () => {
            const root = new THREE.Group();
            const geo = new THREE.BoxGeometry(10, 10, 10);
            geo.userData = { keepAlive: true };
            const mat = new THREE.MeshBasicMaterial();
            mat.userData = { keepAlive: true };

            const disposeGeoSpy = vi.spyOn(geo, 'dispose');
            const disposeMatSpy = vi.spyOn(mat, 'dispose');

            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData = { keepAlive: true };
            root.add(mesh);

            ThreeLifecycleManager.disposeHierarchy(root);

            expect(disposeGeoSpy).not.toHaveBeenCalled();
            expect(disposeMatSpy).not.toHaveBeenCalled();
        });
    });

    describe('2. purgeEntityInteractables', () => {
        it('purges all stale hitboxes and meshes belonging to an entity', () => {
            const mockWall = { id: 'wall_abc', type: 'wall' };

            const hitFront = new THREE.Mesh();
            hitFront.userData = { isWallSide: true, wallId: 'wall_abc' };

            const hitBack = new THREE.Mesh();
            hitBack.userData = { isWallSide: true, entity: mockWall };

            const otherMesh = new THREE.Mesh();
            otherMesh.userData = { isWallSide: true, wallId: 'wall_xyz' };

            const interactables = [hitFront, hitBack, otherMesh];

            ThreeLifecycleManager.purgeEntityInteractables(interactables, mockWall);

            expect(interactables).not.toContain(hitFront);
            expect(interactables).not.toContain(hitBack);
            expect(interactables).toContain(otherMesh);
            expect(interactables.length).toBe(1);
        });
    });

    describe('3. disposeEntity', () => {
        it('disposes 3D mesh, purges interactables, and unregisters from ComponentRegistry', () => {
            const mockEntity = { id: 'wall_lifecycle_test', type: 'wall' };
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
            mesh.userData = { entity: mockEntity, materialSlot: 'outer' };
            mockEntity.mesh3D = mesh;

            ComponentRegistry.registerMesh(mockEntity, 'outer', mesh);
            expect(ComponentRegistry.getMeshesForSlot(mockEntity, 'outer')).toContain(mesh);

            const interactables = [mesh];
            const mockCtx = { interactables };

            ThreeLifecycleManager.disposeEntity(mockEntity, mockCtx);

            expect(mockEntity.mesh3D).toBeNull();
            expect(interactables.length).toBe(0);
            expect(ComponentRegistry.getMeshesForSlot(mockEntity, 'outer')).toEqual([]);
        });
    });

    describe('4. syncEntityInteractables', () => {
        it('purges previous meshes and inserts active meshes without duplicates', () => {
            const mockEntity = { id: 'wall_sync_test' };
            const oldMesh = new THREE.Mesh();
            oldMesh.userData = { entity: mockEntity };

            const newMesh = new THREE.Mesh();
            newMesh.userData = { entity: mockEntity };

            const unrelatedMesh = new THREE.Mesh();

            const interactables = [oldMesh, unrelatedMesh];

            ThreeLifecycleManager.syncEntityInteractables(interactables, mockEntity, [newMesh, newMesh]);

            expect(interactables).not.toContain(oldMesh);
            expect(interactables).toContain(newMesh);
            expect(interactables).toContain(unrelatedMesh);
            expect(interactables.filter(m => m === newMesh).length).toBe(1);
        });
    });
});

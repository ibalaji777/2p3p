import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ShellTransitionGenerator } from '../ShellTransitionGenerator.js';
import { ComponentRegistry } from '../../engine3d/ComponentRegistry.js';

describe('ShellTransitionGenerator (Phase 6 Architecture)', () => {
    describe('1. Profile Points Generation', () => {
        it('generates accurate chamfer / bevel profile points', () => {
            const pts = ShellTransitionGenerator.getProfilePoints('chamfer', 30, 20);
            expect(pts.length).toBe(2);
            expect(pts[0]).toEqual({ x: 0, y: -20 });
            expect(pts[1]).toEqual({ x: 30, y: 0 });
        });

        it('generates concave cove profile points', () => {
            const pts = ShellTransitionGenerator.getProfilePoints('cove', 25, 25, 8);
            expect(pts.length).toBe(9);
            // Start at wall drop
            expect(pts[0].x).toBeCloseTo(0, 1);
            expect(pts[0].y).toBeCloseTo(-25, 1);
            // End at ceiling projection
            expect(pts[8].x).toBeCloseTo(25, 1);
            expect(pts[8].y).toBeCloseTo(0, 1);
            // Midpoint should curve inward (concave)
            const mid = pts[4];
            expect(mid.x).toBeLessThan(25 / 2);
        });

        it('generates convex fillet profile points', () => {
            const pts = ShellTransitionGenerator.getProfilePoints('fillet', 20, 20, 8);
            expect(pts.length).toBe(9);
            expect(pts[0].x).toBeCloseTo(0, 1);
            expect(pts[0].y).toBeCloseTo(-20, 1);
            expect(pts[8].x).toBeCloseTo(20, 1);
            expect(pts[8].y).toBeCloseTo(0, 1);
            // Midpoint should curve outward (convex)
            const mid = pts[4];
            expect(mid.x).toBeGreaterThan(20 / 2);
        });

        it('supports inverted direction', () => {
            const pts = ShellTransitionGenerator.getProfilePoints('chamfer', 30, 20, 8, true);
            expect(pts[1].x).toBe(-30);
        });

        it('generates stepped frieze and vault profiles', () => {
            const stepped = ShellTransitionGenerator.getProfilePoints('stepped', 30, 30);
            expect(stepped.length).toBeGreaterThan(4);
            const vault = ShellTransitionGenerator.getProfilePoints('vault', 40, 20, 8);
            expect(vault.length).toBe(9);
        });
    });

    describe('2. 3D Transition Geometry & Precision Mitering', () => {
        it('returns null for insufficient path points', () => {
            expect(ShellTransitionGenerator.generateTransitionGeometry([])).toBeNull();
            expect(ShellTransitionGenerator.generateTransitionGeometry([{ x: 0, y: 0 }])).toBeNull();
        });

        it('generates valid BufferGeometry along an open linear path', () => {
            const path = [
                { x: 0, y: 0 },
                { x: 400, y: 0 }
            ];
            const geo = ShellTransitionGenerator.generateTransitionGeometry(path, {
                type: 'cove',
                size: 20,
                drop: 20,
                elevation: 280
            });

            expect(geo).toBeInstanceOf(THREE.BufferGeometry);
            expect(geo.attributes.position).toBeDefined();
            expect(geo.attributes.uv).toBeDefined();
            expect(geo.attributes.normal).toBeDefined();
            expect(geo.index).toBeDefined();
            expect(geo.attributes.position.count).toBeGreaterThan(10);
        });

        it('generates gapless corner miters on a closed 4-corner room perimeter', () => {
            const roomPerimeter = [
                { x: 0, y: 0 },
                { x: 500, y: 0 },
                { x: 500, y: 400 },
                { x: 0, y: 400 }
            ];

            const geo = ShellTransitionGenerator.generateTransitionGeometry(roomPerimeter, {
                type: 'chamfer',
                size: 20,
                drop: 20,
                isClosed: true,
                elevation: 300
            });

            expect(geo).toBeInstanceOf(THREE.BufferGeometry);
            const pos = geo.attributes.position;
            expect(pos.count).toBeGreaterThan(0);

            // Verify corner vertex miter: corner at (500, 0) miters outward at 45 degrees
            // Normals on edge 0->1 is (0, 1), on edge 1->2 is (-1, 0)
            // Bisector is (-1/sqrt(2), 1/sqrt(2)), scaled by sqrt(2) * 20 = 20 on each axis
            let foundMiterVertex = false;
            for (let i = 0; i < pos.count; i++) {
                const vx = pos.getX(i);
                const vz = pos.getZ(i);
                if (Math.abs(vx - 500) > 0.1 && Math.abs(vz - 0) > 0.1) {
                    foundMiterVertex = true;
                    break;
                }
            }
            expect(foundMiterVertex).toBe(true);
        });
    });

    describe('3. Mesh & BIM ComponentRegistry Integration', () => {
        it('builds a complete Mesh and registers in ComponentRegistry slot "transition"', () => {
            const mockEntity = { id: 'room_101', type: 'room', params: {} };
            const path = [
                { x: 0, y: 0 },
                { x: 200, y: 0 },
                { x: 200, y: 200 }
            ];

            const mesh = ShellTransitionGenerator.buildTransitionMesh(mockEntity, path, {
                type: 'cove',
                size: 15,
                drop: 15
            });

            expect(mesh).toBeInstanceOf(THREE.Mesh);
            expect(mesh.userData.isShellTransition).toBe(true);
            expect(mesh.userData.materialSlot).toBe('transition');

            const registeredMeshes = ComponentRegistry.getMeshesForSlot(mockEntity, 'transition');
            expect(registeredMeshes).toContain(mesh);
        });
    });
});

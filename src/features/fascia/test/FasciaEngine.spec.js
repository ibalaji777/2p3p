import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { FASCIA_TYPES, FASCIA_REGISTRY, FASCIA_CATALOG } from '../fascia.registry.js';
import { calculateFasciaAssembly, createBlockGeometry, normalizeExtrudeUVs } from '../fascia.geometry.js';
import { renderFascia3D } from '../fascia.renderer3d.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';
import { MaterialSlots, ComponentTypes } from '../../../core/constants/materialSlots.js';

describe('Elevation Fascia Feature Centralization Suite', () => {
    beforeEach(() => {
        ComponentRegistry.slotRegistry.clear();
        ComponentRegistry.componentRegistry.clear();
    });

    describe('1. Authoritative Registry & Catalog', () => {
        it('should define all canonical fascia and continuous ribbon profile types', () => {
            const types = [
                'c_shape_left', 'c_shape_right', 'l_shape_left', 'l_shape_right', 'full_box',
                'tower_corner_wrap_left', 'tower_corner_wrap_right', 'corner_wrap_left', 'corner_wrap_right', 'c_wrap_terrace_frame'
            ];
            types.forEach(t => {
                expect(FASCIA_TYPES[t]).toBeDefined();
            });
        });

        it('should export authoritative FASCIA_CATALOG presets including ribbon and tower wraps', () => {
            expect(FASCIA_CATALOG.length).toBe(10);
            const towerItem = FASCIA_CATALOG.find(c => c.id === 'fascia_tower_wrap_left');
            expect(towerItem).toBeDefined();
            expect(towerItem.params.profileType).toBe('tower_corner_wrap_left');
            expect(towerItem.badge).toBe('RIBBON');

            const boxItem = FASCIA_CATALOG.find(c => c.id === 'fascia_box');
            expect(boxItem).toBeDefined();
            expect(boxItem.params.profileType).toBe('full_box');
        });
    });

    describe('2. Authoritative Geometry & Assembly', () => {
        it('should calculate assembly blocks for C-shape fascia', () => {
            const entity = {
                width: 120,
                height: 150,
                depth: 30,
                thick: 10,
                profileType: 'c_shape_left',
                topArm: 100,
                bottomArm: 80,
                facing: 1
            };

            const assembly = calculateFasciaAssembly(entity);
            expect(assembly.blocks.length).toBe(3); // top arm, spine, bottom arm
            expect(assembly.computedPts.length).toBe(8);
        });

        it('should calculate assembly blocks for Full Box fascia', () => {
            const entity = {
                width: 140,
                height: 180,
                depth: 40,
                thick: 12,
                profileType: 'full_box',
                facing: 1
            };

            const assembly = calculateFasciaAssembly(entity);
            expect(assembly.blocks.length).toBe(4); // top, bottom, left, right
            expect(assembly.computedPts.length).toBe(8);
        });

        it('should generate UV-normalized block geometries', () => {
            const geo = createBlockGeometry(100, 10, 30);
            expect(geo).toBeDefined();
            expect(geo.attributes.position).toBeDefined();
            expect(geo.attributes.uv).toBeDefined();
        });

        it('should calculate assembly for tower_corner_wrap_left with front beam, return arm, vertical tower, and spotlights', () => {
            const entity = {
                width: 140,
                height: 40,
                depth: 50,
                thick: 10,
                returnLength: 120,
                towerHeight: 350,
                towerWidth: 60,
                profileType: 'tower_corner_wrap_left',
                hasSpotlights: true,
                spotlightCount: 4,
                facing: 1
            };

            const assembly = calculateFasciaAssembly(entity);
            // 3 blocks: front beam, side return, and vertical tower
            expect(assembly.blocks.length).toBe(3);

            const frontBeam = assembly.blocks.find(b => b.w === 140);
            expect(frontBeam).toBeDefined();
            expect(frontBeam.h).toBe(40);
            expect(frontBeam.d).toBe(50);

            const sideReturn = assembly.blocks.find(b => b.d === 120);
            expect(sideReturn).toBeDefined();
            expect(sideReturn.w).toBe(50);

            const tower = assembly.blocks.find(b => b.h === 350);
            expect(tower).toBeDefined();
            expect(tower.w).toBe(60);

            // Spotlights on front beam + return arm
            expect(assembly.spotlights.length).toBeGreaterThanOrEqual(5);
            expect(assembly.computedPts.length).toBe(6);
        });

        it('should calculate assembly for continuous terrace frame (c_wrap_terrace_frame)', () => {
            const entity = {
                width: 150,
                height: 40,
                depth: 50,
                thick: 10,
                returnLength: 120,
                towerHeight: 350,
                towerWidth: 60,
                topArm: 120,
                profileType: 'c_wrap_terrace_frame',
                hasSpotlights: true,
                facing: 1
            };

            const assembly = calculateFasciaAssembly(entity);
            // 4 blocks: front beam, side return, vertical tower, and terrace return arm
            expect(assembly.blocks.length).toBe(4);
            const terraceArm = assembly.blocks.find(b => b.y === 350 - 10);
            expect(terraceArm).toBeDefined();
            expect(terraceArm.w).toBe(120);
        });
    });

    describe('3. 3D Mesh Assembly & Material Slots', () => {
        it('should build 3D mesh and register with ComponentRegistry with Fascia Material Slots', () => {
            const entity = {
                id: 'test_fascia_01',
                type: 'elevation_fascia',
                profileType: 'c_shape_left',
                width: 120,
                height: 160,
                depth: 35,
                thick: 10,
                elevation: 0,
                facing: 1
            };

            const sceneGroup = new THREE.Group();
            const group = renderFascia3D(sceneGroup, entity);
            expect(group).toBeDefined();
            expect(group.isGroup).toBe(true);

            const frameMeshes = ComponentRegistry.getMeshesForSlot(entity.id, MaterialSlots.FASCIA_FRAME);
            const sideMeshes = ComponentRegistry.getMeshesForSlot(entity.id, MaterialSlots.FASCIA_SIDE);

            expect(frameMeshes.length + sideMeshes.length).toBeGreaterThanOrEqual(3);
            expect(frameMeshes[0].userData.componentType).toBe(ComponentTypes.FASCIA);
        });

        it('should build 3D continuous ribbon with vertical tower and spotlights registered in ComponentRegistry', () => {
            const entity = {
                id: 'test_ribbon_tower_01',
                type: 'elevation_fascia',
                profileType: 'tower_corner_wrap_left',
                width: 140,
                height: 40,
                depth: 50,
                thick: 10,
                returnLength: 120,
                towerHeight: 350,
                towerWidth: 60,
                elevation: 100,
                hasSpotlights: true,
                spotlightCount: 4,
                facing: 1
            };

            const sceneGroup = new THREE.Group();
            const group = renderFascia3D(sceneGroup, entity);
            expect(group).toBeDefined();

            const frontMeshes = ComponentRegistry.getMeshesForSlot(entity.id, MaterialSlots.FASCIA_FRONT);
            const frameMeshes = ComponentRegistry.getMeshesForSlot(entity.id, MaterialSlots.FASCIA_FRAME);
            const sideMeshes = ComponentRegistry.getMeshesForSlot(entity.id, MaterialSlots.FASCIA_SIDE);
            const lightMeshes = ComponentRegistry.getMeshesForSlot(entity.id, MaterialSlots.LIGHT_LENS || 'light_lens');

            expect(frontMeshes.length).toBeGreaterThanOrEqual(1); // vertical tower
            expect(frameMeshes.length).toBeGreaterThanOrEqual(1); // front beam
            expect(sideMeshes.length).toBeGreaterThanOrEqual(1);  // side return
            expect(lightMeshes.length).toBeGreaterThanOrEqual(5); // spotlights

            // Verify universal registration coverage
            let unregisteredCount = 0;
            group.traverse(child => {
                if (child.isMesh && !child.userData.isHitbox) {
                    if (!child.userData.entity || !child.userData.materialSlot) {
                        unregisteredCount++;
                    }
                }
            });
            expect(unregisteredCount).toBe(0);
        });

        it('should support slot-wide highlighting across fascia parts', () => {
            const entity = {
                id: 'test_fascia_highlight',
                type: 'elevation_fascia',
                profileType: 'full_box',
                width: 100,
                height: 100,
                depth: 30,
                thick: 8,
                elevation: 0,
                facing: 1
            };

            const sceneGroup = new THREE.Group();
            renderFascia3D(sceneGroup, entity);

            const frameMeshes = ComponentRegistry.getMeshesForSlot(entity.id, MaterialSlots.FASCIA_FRAME);
            expect(frameMeshes.length).toBeGreaterThanOrEqual(2);

            ComponentRegistry.setSlotHighlight(entity.id, MaterialSlots.FASCIA_FRAME, true, 0x3b82f6);
            frameMeshes.forEach(m => {
                expect(m.material.emissive.getHex()).toBe(0x3b82f6);
            });

            ComponentRegistry.setSlotHighlight(entity.id, MaterialSlots.FASCIA_FRAME, false);
            frameMeshes.forEach(m => {
                expect(m.material.emissive.getHex()).toBe(0x000000);
            });
        });
    });
});

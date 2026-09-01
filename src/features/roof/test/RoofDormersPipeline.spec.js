import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RoofDormer3DBuilder } from '../builders/RoofDormer3DBuilder.js';
import { Roof3DBuilder } from '../builders/Roof3DBuilder.js';
import { ROOF_REGISTRY } from '../roof.components.registry.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';

describe('Sims 4 Direct 3D Roof Dormers Pipeline', () => {
    const mockCtx = {
        scene: new THREE.Scene(),
        structureGroup: new THREE.Group(),
        helpers: {
            getDynamicMaterial: (key, type) => new THREE.MeshStandardMaterial({ color: 0x334155 })
        },
        assets: {
            getTexture: () => Promise.resolve(new THREE.Texture())
        }
    };

    it('1. should build a Classic Gable Dormer with A-frame roof, cheeks, and double-hung window', () => {
        const builder = new RoofDormer3DBuilder(mockCtx);
        const dormer = builder.buildDormer({
            id: 'dor_gable_test',
            type: 'dormer_gable',
            width: 100,
            height: 85,
            depth: 120,
            pitch: 35
        }, null, 35);

        expect(dormer).toBeDefined();
        expect(dormer.userData.isRoofDormer).toBe(true);
        expect(dormer.userData.sculptureType).toBe('dormer');

        // Check for submeshes: front wall, cheeks, window glass, mullions, roof slopes, bargeboards
        let meshCount = 0;
        dormer.traverse(child => {
            if (child.isMesh) meshCount++;
        });
        expect(meshCount).toBeGreaterThanOrEqual(6);
    });

    it('2. should build a Modern Shed Dormer with slanted single-slope roof and front overhang', () => {
        const builder = new RoofDormer3DBuilder(mockCtx);
        const dormer = builder.buildDormer({
            id: 'dor_shed_test',
            type: 'dormer_shed',
            width: 140,
            height: 85,
            depth: 120,
            pitch: 15
        }, null, 35);

        expect(dormer).toBeDefined();
        expect(dormer.userData.isRoofDormer).toBe(true);

        let meshCount = 0;
        dormer.traverse(child => {
            if (child.isMesh) meshCount++;
        });
        expect(meshCount).toBeGreaterThanOrEqual(5);
    });

    it('3. should build a Heritage Hip Dormer with 3-sided hipped mini roof cap', () => {
        const builder = new RoofDormer3DBuilder(mockCtx);
        const dormer = builder.buildDormer({
            id: 'dor_hip_test',
            type: 'dormer_hip',
            width: 100,
            height: 85,
            depth: 120
        }, null, 35);

        expect(dormer).toBeDefined();
        expect(dormer.userData.isRoofDormer).toBe(true);

        let meshCount = 0;
        dormer.traverse(child => {
            if (child.isMesh) meshCount++;
        });
        expect(meshCount).toBeGreaterThanOrEqual(5);
    });

    it('4. should build an Arched Barrel Vault Dormer with semicircular roof cylinder', () => {
        const builder = new RoofDormer3DBuilder(mockCtx);
        const dormer = builder.buildDormer({
            id: 'dor_barrel_test',
            type: 'dormer_barrel',
            width: 100,
            height: 80,
            depth: 120
        }, null, 35);

        expect(dormer).toBeDefined();
        expect(dormer.userData.isRoofDormer).toBe(true);

        let meshCount = 0;
        dormer.traverse(child => {
            if (child.isMesh) meshCount++;
        });
        expect(meshCount).toBeGreaterThanOrEqual(5);
    });

    it('5. should integrate with Roof3DBuilder and attach dormers directly onto a gable roof slope', () => {
        const roofBuilder = new Roof3DBuilder(mockCtx);
        const targetGroup = new THREE.Group();

        const dummyRoof = {
            points: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 400 }, { x: 0, y: 400 }],
            config: {
                roofType: 'gable',
                pitch: 35,
                ridgeAxis: 'x',
                material: 'terracotta_tiles_roof',
                dormers: [
                    { id: 'dor_1', type: 'dormer_gable', u: 0.3, v: 0.35, width: 90, height: 80 },
                    { id: 'dor_2', type: 'dormer_shed', u: 0.7, v: 0.35, width: 100, height: 80 }
                ]
            },
            x: 0, y: 0, elevation: 120
        };

        roofBuilder.buildRoofs([dummyRoof], 0, [], targetGroup);
        const roofGroup = targetGroup.children[0];
        expect(roofGroup).toBeDefined();

        const attachedDormers = roofGroup.children.filter(c => c.userData && c.userData.isRoofDormer);
        expect(attachedDormers.length).toBe(2);
        expect(attachedDormers[0].name).toContain('dormer_');
        expect(attachedDormers[1].name).toContain('dormer_');
    });

    it('6. should register dormers properly in ROOF_REGISTRY and ComponentRegistry', () => {
        expect(ROOF_REGISTRY['dormer']).toBeDefined();
        const testGroup = new THREE.Group();
        ROOF_REGISTRY['dormer'].render3D(testGroup, { type: 'dormer_gable' }, { ctx: mockCtx });

        expect(testGroup.children.length).toBeGreaterThanOrEqual(1);
        const dormerAssembly = testGroup.children[0];
        expect(dormerAssembly.userData.isRoofDormer).toBe(true);
    });

    it('7. should verify that cheek sidewall vertices strictly extend backwards (-Z <= 0) and NEVER protrude forward (+Z > 0)', () => {
        const builder = new RoofDormer3DBuilder(mockCtx);
        const cheekLeft = builder.buildCheekWallGeometry(true, 100, 85, 120, 4);
        const posAttr = cheekLeft.getAttribute('position');

        for (let i = 0; i < posAttr.count; i++) {
            const z = posAttr.getZ(i);
            expect(z).toBeLessThanOrEqual(0.001); // All Z coordinates must be <= 0 (extending backwards into the roof)
        }
    });

    it('8. should support toggle of window assembly (hasWindow: false) to render solid wall dormer', () => {
        const builder = new RoofDormer3DBuilder(mockCtx);
        const dormerWithWin = builder.buildDormer({ id: 'd_win', type: 'dormer_gable', hasWindow: true });
        const dormerSolid = builder.buildDormer({ id: 'd_solid', type: 'dormer_gable', hasWindow: false });

        let meshesWithWin = 0;
        let meshesSolid = 0;
        let hasGlass = false;

        dormerWithWin.traverse(c => { if (c.isMesh) meshesWithWin++; });
        dormerSolid.traverse(c => {
            if (c.isMesh) {
                meshesSolid++;
                if (c.userData.materialSlot === 'glass') hasGlass = true;
            }
        });

        expect(meshesWithWin).toBeGreaterThan(meshesSolid);
        expect(hasGlass).toBe(false);
    });

    it('9. should tag sub-meshes with distinct CAD/BIM material slots (dormer_siding, dormer_roof, dormer_trim, frame, glass)', () => {
        const builder = new RoofDormer3DBuilder(mockCtx);
        const dormer = builder.buildDormer({
            id: 'd_slots',
            type: 'dormer_gable',
            sidingMaterial: 'red_brick',
            roofMaterial: 'terracotta_tiles_roof',
            trimMaterial: 'white_paint'
        });

        const slotsFound = new Set();
        dormer.traverse(child => {
            if (child.isMesh && child.userData.materialSlot) {
                slotsFound.add(child.userData.materialSlot);
            }
        });

        expect(slotsFound.has('dormer_siding')).toBe(true);
        expect(slotsFound.has('dormer_roof')).toBe(true);
        expect(slotsFound.has('dormer_trim')).toBe(true);
        expect(slotsFound.has('frame')).toBe(true);
        expect(slotsFound.has('glass')).toBe(true);
    });

    it('10. should generate physical world UV coordinates on dormer roof meshes matching main roof tiling scale', () => {
        const builder = new RoofDormer3DBuilder(mockCtx);
        const dormer = builder.buildDormer({
            id: 'd_uv_test',
            type: 'dormer_gable',
            width: 120,
            height: 90
        });

        let foundDormerRoof = false;
        dormer.traverse(child => {
            if (child.isMesh && child.userData.materialSlot === 'dormer_roof') {
                foundDormerRoof = true;
                const uvAttr = child.geometry.attributes.uv;
                expect(uvAttr).toBeDefined();
                expect(uvAttr.count).toBeGreaterThan(0);
                // Verify UV coordinates are scaled proportionally rather than 0 to 1
                let hasScaledUV = false;
                for (let i = 0; i < uvAttr.count; i++) {
                    if (uvAttr.getX(i) > 0.5 || uvAttr.getY(i) > 0.5) hasScaledUV = true;
                }
                expect(hasScaledUV).toBe(true);
            }
        });
        expect(foundDormerRoof).toBe(true);
    });

    it('11. should open the parent roof slope underneath dormer footprint with aperture void', () => {
        const roofBuilder = new Roof3DBuilder(mockCtx);
        const groupNoDormer = new THREE.Group();
        const groupWithDormer = new THREE.Group();

        const baseRoof = {
            points: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 400 }, { x: 0, y: 400 }],
            config: { roofType: 'gable', pitch: 35, ridgeAxis: 'x', material: 'terracotta_tiles_roof' },
            x: 0, y: 0, elevation: 120
        };

        const roofWithDormer = {
            ...baseRoof,
            config: {
                ...baseRoof.config,
                dormers: [{ id: 'dor_cut_1', type: 'dormer_gable', u: 0.5, v: 0.25, width: 100, height: 85 }]
            }
        };

        roofBuilder.buildRoofs([baseRoof], 0, [], groupNoDormer);
        roofBuilder.buildRoofs([roofWithDormer], 0, [], groupWithDormer);

        const meshNoDormer = groupNoDormer.children[0].children.find(c => c.isMesh && c.userData?.isRoof);
        const meshWithDormer = groupWithDormer.children[0].children.find(c => c.isMesh && c.userData?.isRoof);

        expect(meshNoDormer).toBeDefined();
        expect(meshWithDormer).toBeDefined();

        // The roof with dormer will have segmented geometry with cutout aperture vertices
        const vertCountNoDormer = meshNoDormer.geometry.attributes.position.count;
        const vertCountWithDormer = meshWithDormer.geometry.attributes.position.count;
        expect(vertCountWithDormer).toBeGreaterThan(vertCountNoDormer);
    });
});

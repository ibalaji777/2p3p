import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ROOF_DECOR_REGISTRY } from '../roof.registry.js';
import { Roof3DBuilder } from '../builders/Roof3DBuilder.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';

describe('Sims 4 Glass Roofs & Skylight Mullions Pipeline', () => {
    it('registers all 4 Sims 4 glass roof finishes in ROOF_DECOR_REGISTRY', () => {
        const expectedGlassKeys = [
            'glass_roof_square_grid',
            'glass_roof_diamond_lattice',
            'glass_roof_hexagonal_honeycomb',
            'glass_roof_solid_clear'
        ];

        expectedGlassKeys.forEach(key => {
            const decor = ROOF_DECOR_REGISTRY[key];
            expect(decor).toBeDefined();
            expect(decor.isGlass).toBe(true);
            expect(decor.category).toBe('glass');
            expect(decor.transmission).toBeGreaterThanOrEqual(0.9);
            expect(decor.roughness).toBeLessThanOrEqual(0.1);
            expect(decor.ior).toBeCloseTo(1.52);
            expect(decor.clearcoat).toBe(1.0);
            expect(decor.texture).toContain(key);
        });
    });

    it('builds a Modern Glass Atrium Gable Roof with proper material groups and double-sided glass transparency', () => {
        const targetGroup = new THREE.Group();
        const mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: targetGroup,
            interactables: [],
            helpers: {
                getDynamicMaterial: (id, type) => {
                    const decor = ROOF_DECOR_REGISTRY[id];
                    if (decor && decor.isGlass) {
                        return new THREE.MeshPhysicalMaterial({
                            transmission: decor.transmission,
                            opacity: decor.opacity,
                            transparent: true,
                            roughness: decor.roughness,
                            metalness: decor.metalness,
                            side: THREE.DoubleSide
                        });
                    }
                    return new THREE.MeshStandardMaterial({ color: 0x333333 });
                }
            },
            assets: {
                getTexture: () => Promise.resolve(new THREE.Texture())
            }
        };

        const builder = new Roof3DBuilder(mockCtx);
        const roofEntity = {
            id: 'roof_atrium_1',
            type: 'roof',
            points: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            config: {
                roofType: 'gable',
                pitch: 25,
                material: 'glass_roof_square_grid',
                fasciaMaterial: 'metal_dark_steel'
            }
        };

        builder.buildRoofs([roofEntity], targetGroup);

        expect(targetGroup.children.length).toBeGreaterThan(0);
        const roofGroup = targetGroup.children[0];
        const roofMesh = roofGroup.children.find(c => c.userData.isRoof && c.userData.materialSlot === 'top');
        expect(roofMesh).toBeDefined();

        // Check geometry and groups
        const geo = roofMesh.geometry;
        expect(geo.groups.length).toBe(3); // Group 0 (top glass), Group 1 (bottom glass), Group 2 (fascia metal)
        expect(geo.groups[0].materialIndex).toBe(0);
        expect(geo.groups[1].materialIndex).toBe(0); // Underside also uses glass!
        expect(geo.groups[2].materialIndex).toBe(1); // Perimeter edges use fascia metal

        // Check material
        const [glassMat, fasciaMat] = roofMesh.material;
        expect(glassMat.transparent).toBe(true);
        expect(glassMat.side).toBe(THREE.DoubleSide);
        expect(glassMat.transmission).toBeGreaterThan(0.85);

        // Check slot registration
        const slotMeshes = ComponentRegistry.getMeshesForSlot(roofEntity, 'top');
        expect(slotMeshes.includes(roofMesh)).toBe(true);
    });

    it('builds a Victorian Conservatory Hip Roof with diamond lattice glass', () => {
        const targetGroup = new THREE.Group();
        const mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: targetGroup,
            interactables: [],
            helpers: {
                getDynamicMaterial: (id) => new THREE.MeshPhysicalMaterial({
                    transparent: true,
                    opacity: 0.93,
                    side: THREE.DoubleSide
                })
            },
            assets: {
                getTexture: () => Promise.resolve(new THREE.Texture())
            }
        };

        const builder = new Roof3DBuilder(mockCtx);
        const roofEntity = {
            id: 'roof_conservatory_1',
            type: 'roof',
            points: [
                { x: 0, y: 0 },
                { x: 500, y: 0 },
                { x: 500, y: 400 },
                { x: 0, y: 400 }
            ],
            config: {
                roofType: 'hip',
                pitch: 30,
                material: 'glass_roof_diamond_lattice'
            }
        };

        builder.buildRoofs([roofEntity], targetGroup);

        const roofGroup = targetGroup.children[0];
        const roofMesh = roofGroup.children.find(c => c.userData.isRoof && c.userData.materialSlot === 'top');
        expect(roofMesh).toBeDefined();
        expect(roofMesh.geometry.groups.length).toBe(3);
        expect(roofMesh.geometry.groups[0].materialIndex).toBe(0);
        expect(roofMesh.geometry.groups[1].materialIndex).toBe(0);
        expect(roofMesh.geometry.groups[2].materialIndex).toBe(1);
    });

    it('builds a Futuristic Solarium Turret Roof with hexagonal honeycomb glass', () => {
        const targetGroup = new THREE.Group();
        const mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: targetGroup,
            interactables: [],
            helpers: {
                getDynamicMaterial: () => new THREE.MeshPhysicalMaterial({ transparent: true, side: THREE.DoubleSide })
            },
            assets: {
                getTexture: () => Promise.resolve(new THREE.Texture())
            }
        };

        const builder = new Roof3DBuilder(mockCtx);
        const roofEntity = {
            id: 'roof_solarium_1',
            type: 'roof',
            points: [
                { x: 0, y: 0 },
                { x: 300, y: 0 },
                { x: 300, y: 300 },
                { x: 0, y: 300 }
            ],
            config: {
                roofType: 'turret_round',
                pitch: 40,
                material: 'glass_roof_hexagonal_honeycomb'
            }
        };

        builder.buildRoofs([roofEntity], targetGroup);

        const roofGroup = targetGroup.children[0];
        const roofMesh = roofGroup.children.find(c => c.userData.isRoof && c.userData.materialSlot === 'top');
        expect(roofMesh).toBeDefined();
        expect(roofMesh.geometry.groups.length).toBe(3);
    });

    it('builds a Frameless Skylight Shed Roof with solid clear float glass', () => {
        const targetGroup = new THREE.Group();
        const mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: targetGroup,
            interactables: [],
            helpers: {
                getDynamicMaterial: () => new THREE.MeshPhysicalMaterial({ transparent: true, side: THREE.DoubleSide })
            },
            assets: {
                getTexture: () => Promise.resolve(new THREE.Texture())
            }
        };

        const builder = new Roof3DBuilder(mockCtx);
        const roofEntity = {
            id: 'roof_skylight_1',
            type: 'roof',
            points: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 200 },
                { x: 0, y: 200 }
            ],
            config: {
                roofType: 'shed',
                pitch: 15,
                material: 'glass_roof_solid_clear'
            }
        };

        builder.buildRoofs([roofEntity], targetGroup);

        const roofGroup = targetGroup.children[0];
        const roofMesh = roofGroup.children.find(c => c.userData.isRoof && c.userData.materialSlot === 'top');
        expect(roofMesh).toBeDefined();
        expect(roofMesh.geometry.groups.length).toBe(3);
    });

    it('supports Flat Glass Terrace / Skylight with multi-material array [flatMat, fasciaMat]', () => {
        const targetGroup = new THREE.Group();
        const mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: targetGroup,
            interactables: [],
            helpers: {
                getDynamicMaterial: () => new THREE.MeshPhysicalMaterial({ transparent: true, side: THREE.DoubleSide })
            },
            assets: {
                getTexture: () => Promise.resolve(new THREE.Texture())
            }
        };

        const builder = new Roof3DBuilder(mockCtx);
        const roofEntity = {
            id: 'roof_flat_glass_1',
            type: 'roof',
            points: [
                { x: 0, y: 0 },
                { x: 300, y: 0 },
                { x: 300, y: 300 },
                { x: 0, y: 300 }
            ],
            config: {
                roofType: 'flat',
                material: 'glass_roof_square_grid'
            }
        };

        builder.buildRoofs([roofEntity], targetGroup);

        const roofGroup = targetGroup.children[0];
        const roofMesh = roofGroup.children.find(c => c.userData.isRoof && c.userData.materialSlot === 'top');
        expect(roofMesh).toBeDefined();
        expect(Array.isArray(roofMesh.material)).toBe(true);
        expect(roofMesh.material.length).toBe(2);
    });

    it('supports Per-Slope Dual Glazing on Gable (Slope 1 = Glass, Slope 2 = Tiles)', () => {
        const targetGroup = new THREE.Group();
        const mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: targetGroup,
            interactables: [],
            helpers: {
                getDynamicMaterial: (id) => {
                    const decor = ROOF_DECOR_REGISTRY[id];
                    const isGlass = Boolean(decor?.isGlass);
                    return isGlass 
                        ? new THREE.MeshPhysicalMaterial({ transmission: 0.92, transparent: true, side: THREE.DoubleSide })
                        : new THREE.MeshStandardMaterial({ color: 0xaa3333, side: THREE.DoubleSide });
                }
            },
            assets: {
                getTexture: () => Promise.resolve(new THREE.Texture())
            }
        };

        const builder = new Roof3DBuilder(mockCtx);
        const roofEntity = {
            id: 'roof_perslope_gable',
            type: 'roof',
            points: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 300 },
                { x: 0, y: 300 }
            ],
            config: {
                roofType: 'gable',
                pitch: 30,
                material: 'terracotta_tiles_roof',
                slopes: {
                    slope1: 'glass_roof_square_grid',
                    slope2: 'terracotta_tiles_roof'
                }
            }
        };

        builder.buildRoofs([roofEntity], targetGroup);

        const roofGroup = targetGroup.children[0];
        const roofMesh = roofGroup.children.find(c => c.userData.isRoof && c.userData.materialSlot === 'top');
        expect(roofMesh).toBeDefined();
        expect(Array.isArray(roofMesh.material)).toBe(true);
        expect(roofMesh.material.length).toBe(3); // [matSlope1, matSlope2, fasciaMat]

        const [mat1, mat2, fascia] = roofMesh.material;
        expect(mat1.transparent).toBe(true);
        expect(mat1.transmission).toBeGreaterThan(0.85); // Glass
        expect(mat2.transparent).toBe(false); // Solid Tile

        // Check geometry groups
        const groups = roofMesh.geometry.groups;
        expect(groups.length).toBe(5);
        expect(groups[0].materialIndex).toBe(0); // Slope 1 Top (Glass)
        expect(groups[1].materialIndex).toBe(1); // Slope 2 Top (Tile)
        expect(groups[2].materialIndex).toBe(0); // Slope 1 Underside (Glass transparency)
        expect(groups[3].materialIndex).toBe(2); // Slope 2 Underside (White Plaster)
        expect(groups[4].materialIndex).toBe(2); // Fascia sides (Metal/Plaster)
    });

    it('supports Embedded 3D Skylight Windows attached to Roof slopes with pitch angle alignment', () => {
        const targetGroup = new THREE.Group();
        const mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: targetGroup,
            interactables: [],
            helpers: {
                getDynamicMaterial: (id) => new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide })
            },
            assets: {
                getTexture: () => Promise.resolve(new THREE.Texture())
            }
        };

        const builder = new Roof3DBuilder(mockCtx);
        const roofEntity = {
            id: 'roof_with_skylights',
            type: 'roof',
            points: [
                { x: 0, y: 0 },
                { x: 500, y: 0 },
                { x: 500, y: 400 },
                { x: 0, y: 400 }
            ],
            config: {
                roofType: 'gable',
                pitch: 30,
                material: 'dark_asphalt_roof',
                skylights: [
                    {
                        id: 'sky_1',
                        type: 'skylight_velux_frame',
                        material: 'glass_roof_square_grid',
                        frameMaterial: 'metal_dark_steel',
                        width: 90,
                        length: 130,
                        u: 0.5,
                        v: 0.25
                    },
                    {
                        id: 'sky_2',
                        type: 'skylight_pyramid_dome',
                        material: 'glass_roof_hexagonal_honeycomb',
                        frameMaterial: 'metal_dark_steel',
                        width: 100,
                        length: 100,
                        u: 0.5,
                        v: 0.75
                    }
                ]
            }
        };

        builder.buildRoofs([roofEntity], targetGroup);

        const roofGroup = targetGroup.children[0];
        const skylightGroups = roofGroup.children.filter(c => c.userData.isSkylight);
        expect(skylightGroups.length).toBe(2);

        // Verify first skylight (Velux frame)
        const sk1 = skylightGroups[0];
        expect(sk1.userData.entity.id).toBe('sky_1');
        expect(sk1.rotation.x).not.toBe(0); // Aligned with roof pitch angle
        
        // Verify frame and glass sub-meshes
        const frameMesh = sk1.children.find(c => c.userData.materialSlot === 'skylight_frame' || c.userData.materialSlot === 'frame');
        const glassMesh = sk1.children.find(c => c.userData.materialSlot === 'skylight_glass' || c.userData.materialSlot === 'glass');
        expect(frameMesh).toBeDefined();
        expect(glassMesh).toBeDefined();
    });

    it('supports [ Full Width ] and [ Full Slope ] coverage modes on roof glass insets', () => {
        const targetGroup = new THREE.Group();
        const mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: targetGroup,
            interactables: [],
            helpers: {
                getDynamicMaterial: () => new THREE.MeshStandardMaterial({ color: 0x222222, side: THREE.DoubleSide })
            },
            assets: {
                getTexture: () => Promise.resolve(new THREE.Texture())
            }
        };

        const builder = new Roof3DBuilder(mockCtx);
        const roofEntity = {
            id: 'roof_coverage_test',
            type: 'roof',
            points: [
                { x: 0, y: 0 },
                { x: 600, y: 0 },
                { x: 600, y: 400 },
                { x: 0, y: 400 }
            ],
            config: {
                roofType: 'gable',
                pitch: 30,
                ridgeAxis: 'x',
                material: 'terracotta_tiles_roof',
                skylights: [
                    {
                        id: 'sky_ribbon_fullwidth',
                        type: 'skylight_flush_flat',
                        material: 'glass_roof_square_grid',
                        coverage: 'full_width',
                        length: 80,
                        v: 0.3
                    },
                    {
                        id: 'sky_strip_fullslope',
                        type: 'skylight_flush_flat',
                        material: 'glass_roof_solid_clear',
                        coverage: 'full_slope',
                        width: 100,
                        u: 0.2
                    }
                ]
            }
        };

        builder.buildRoofs([roofEntity], targetGroup);

        const roofGroup = targetGroup.children[0];
        const skylightGroups = roofGroup.children.filter(c => c.userData.isSkylight);
        expect(skylightGroups.length).toBe(2);

        // 1. Full width ribbon should have glass width matching total roof width (600 - 2*frameThick)
        const ribbonGroup = skylightGroups[0];
        const ribbonGlass = ribbonGroup.children.find(c => c.userData.materialSlot === 'skylight_glass');
        expect(ribbonGlass).toBeDefined();
        expect(ribbonGlass.geometry.parameters.width).toBeGreaterThan(580);

        // 2. Full slope strip should span from eave to ridge (slopeHypot = (400/2)/cos(30°) = 200/0.866 = ~230.9)
        const stripGroup = skylightGroups[1];
        const stripGlass = stripGroup.children.find(c => c.userData.materialSlot === 'skylight_glass');
        expect(stripGlass).toBeDefined();
        expect(stripGlass.geometry.parameters.height).toBeGreaterThan(215); // Length along slope
    });
});


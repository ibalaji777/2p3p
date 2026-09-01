import { Roof3DBuilder } from './builders/Roof3DBuilder.js';
import { RoofSculpture3DBuilder } from './builders/RoofSculpture3DBuilder.js';
import { Skylight3DBuilder } from './builders/Skylight3DBuilder.js';
import * as THREE from 'three';

export const ROOF_REGISTRY = {
    'roof': {
        widget: "roof",
        label: "ROOF",
        defaultConfig: { roofType: 'gable', material: 'terracotta_tiles_roof', overhang: 8 },
        render3D: (sceneGroup, entity, helpers) => {
            const w = 150, d = 100, wallH = 120;
            const dummyRoof = {
                points: [{x: -w/2, y: -d/2}, {x: w/2, y: -d/2}, {x: w/2, y: d/2}, {x: -w/2, y: d/2}],
                config: { ...entity, roofType: entity.roofType || 'gable', material: entity.material || 'terracotta_tiles_roof', overhang: entity.overhang !== undefined ? entity.overhang : 8 },
                x: 0, y: 0, elevation: wallH, rotation: 0,
                isThumbnail: true
            };
            
            try {
                const builder = new Roof3DBuilder(helpers.ctx);
                builder.buildRoofs([dummyRoof], 0, false, sceneGroup);
            } catch(e) {
                const errMesh = new THREE.Mesh(new THREE.BoxGeometry(w, 20, d), new THREE.MeshBasicMaterial({color: 0xff0000}));
                errMesh.position.y = wallH + 10;
                sceneGroup.add(errMesh);
            }
        }
    },
    'skylight': {
        widget: "skylight",
        label: "SKYLIGHT",
        defaultConfig: { type: 'skylight_velux_frame', width: 80, length: 120, material: 'glass_roof_square_grid', frameMaterial: 'metal_dark_steel' },
        render3D: (sceneGroup, entity, helpers) => {
            try {
                const builder = new Skylight3DBuilder(helpers.ctx);
                const dummyRoof = { config: { pitch: 35 } };
                const skGroup = builder.buildSkylight(entity, dummyRoof);
                sceneGroup.add(skGroup);
            } catch(e) {
                console.error("Skylight preview error", e);
            }
        }
    },
    'roof_sculptures': {
        widget: "roof_sculptures",
        label: "ROOF SCULPTURE",
        defaultConfig: { type: 'ridge_cresting_victorian_lace', material: 'metal_wrought_iron' },
        render3D: (sceneGroup, entity, helpers) => {
            try {
                const builder = new RoofSculpture3DBuilder(helpers.ctx);
                const type = entity.type || 'ridge_cresting_victorian_lace';
                
                if (type.startsWith('ridge_cresting') || entity.sculptureCategory === 'cresting' || entity.toolId === 'roof_cresting') {
                    const crestGroup = builder.buildRidgeCresting(entity, 120);
                    sceneGroup.add(crestGroup);
                } else if (type.startsWith('finial_') || entity.sculptureCategory === 'finial' || entity.toolId === 'roof_finial') {
                    const finialGroup = builder.buildApexFinial(entity);
                    sceneGroup.add(finialGroup);
                } else if (type.startsWith('chimney_') || entity.sculptureCategory === 'chimney' || entity.toolId === 'roof_chimney') {
                    const chimneyGroup = builder.buildChimneyStack(entity);
                    sceneGroup.add(chimneyGroup);
                } else {
                    const crestGroup = builder.buildRidgeCresting(entity, 120);
                    sceneGroup.add(crestGroup);
                }
            } catch(e) {
                console.error("Roof sculpture preview error", e);
            }
        }
    }
};

// Aliases for direct registry lookups
ROOF_REGISTRY['roof_cresting'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['roof_finial'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['roof_chimney'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['ridge_cresting_victorian_lace'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['ridge_cresting_gothic_spikes'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['ridge_cresting_metal_cap'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['finial_victorian_spire'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['finial_copper_spire'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['finial_globe_orb'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['finial_weather_rooster'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['chimney_brick_traditional'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['chimney_stone_tudor'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['chimney_metal_flue'] = ROOF_REGISTRY['roof_sculptures'];
ROOF_REGISTRY['chimney_double_brick'] = ROOF_REGISTRY['roof_sculptures'];

ROOF_REGISTRY['skylight_square_grid_inset'] = ROOF_REGISTRY['skylight'];
ROOF_REGISTRY['skylight_diamond_lattice_inset'] = ROOF_REGISTRY['skylight'];
ROOF_REGISTRY['skylight_hexagonal_inset'] = ROOF_REGISTRY['skylight'];
ROOF_REGISTRY['skylight_solid_clear_inset'] = ROOF_REGISTRY['skylight'];
ROOF_REGISTRY['skylight_velux_frame'] = ROOF_REGISTRY['skylight'];
ROOF_REGISTRY['skylight_pyramid_dome'] = ROOF_REGISTRY['skylight'];
ROOF_REGISTRY['skylight_flush_flat'] = ROOF_REGISTRY['skylight'];

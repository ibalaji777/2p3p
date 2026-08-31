import { Roof3DBuilder } from './builders/Roof3DBuilder.js';
import { RoofSculpture3DBuilder } from './builders/RoofSculpture3DBuilder.js';
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
    'dormer': {
        widget: "dormer",
        label: "DORMER",
        defaultConfig: { type: 'gable', width: 60, height: 60, depth: 80 },
        render3D: (sceneGroup, entity, helpers) => {
            try {
                const builder = new Roof3DBuilder(helpers.ctx);
                const group = builder.buildDormerModel({
                    id: 'dummy',
                    x: 0, y: 0, z: 0, rotation: 0,
                    config: { ...entity }
                });
                sceneGroup.add(group);
            } catch(e) {
                console.error("Dormer preview error", e);
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
                    
                    // Add a small pitched mini roof section base
                    const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
                    const baseGeo = new THREE.ConeGeometry(45, 20, 4);
                    baseGeo.rotateY(Math.PI / 4);
                    baseGeo.scale(0.8, 1, 2.6);
                    const baseMesh = new THREE.Mesh(baseGeo, roofMat);
                    baseMesh.position.y = -10;
                    
                    const wrapper = new THREE.Group();
                    wrapper.add(baseMesh);
                    wrapper.add(crestGroup);
                    sceneGroup.add(wrapper);
                } else if (type.startsWith('finial_') || entity.sculptureCategory === 'finial' || entity.toolId === 'roof_finial') {
                    const finialGroup = builder.buildApexFinial(entity);
                    
                    const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
                    const baseGeo = new THREE.ConeGeometry(24, 18, 4);
                    baseGeo.rotateY(Math.PI / 4);
                    const baseMesh = new THREE.Mesh(baseGeo, roofMat);
                    baseMesh.position.y = -9;
                    
                    const wrapper = new THREE.Group();
                    wrapper.add(baseMesh);
                    wrapper.add(finialGroup);
                    sceneGroup.add(wrapper);
                } else if (type.startsWith('chimney_') || entity.sculptureCategory === 'chimney' || entity.toolId === 'roof_chimney') {
                    const chimneyGroup = builder.buildChimneyStack(entity);
                    
                    const roofMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
                    const slopeGeo = new THREE.BoxGeometry(90, 6, 75);
                    slopeGeo.rotateZ(25 * Math.PI / 180);
                    const slopeMesh = new THREE.Mesh(slopeGeo, roofMat);
                    slopeMesh.position.set(0, -6, 0);
                    
                    const wrapper = new THREE.Group();
                    wrapper.add(slopeMesh);
                    wrapper.add(chimneyGroup);
                    sceneGroup.add(wrapper);
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

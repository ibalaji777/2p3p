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
                x: 0, y: 0, elevation: wallH, rotation: 0
            };
            
            if (dummyRoof.config.roofType === 'gable') {
                const roofH = (w / 2) * Math.tan((dummyRoof.config.pitch || 30) * Math.PI / 180);
                const shape = new THREE.Shape();
                shape.moveTo(-w/2, 0);
                shape.lineTo(w/2, 0);
                shape.lineTo(0, roofH);
                shape.lineTo(-w/2, 0);
                
                const gableMat = new THREE.MeshStandardMaterial({color: 0xffffff, side: THREE.DoubleSide});
                const gableGeo = new THREE.ShapeGeometry(shape);
                
                const frontGable = new THREE.Mesh(gableGeo, gableMat);
                frontGable.position.set(0, wallH, d/2);
                sceneGroup.add(frontGable);
                
                const backGable = new THREE.Mesh(gableGeo, gableMat);
                backGable.position.set(0, wallH, -d/2);
                sceneGroup.add(backGable);
            }

            try {
                if (helpers && helpers.ctx && helpers.ctx.envBuilder) {
                    helpers.ctx.envBuilder.buildRoofs([dummyRoof], 0, false, sceneGroup);
                }
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
                if (helpers && helpers.ctx && helpers.ctx.envBuilder) {
                    const group = helpers.ctx.envBuilder.buildDormerModel({
                        id: 'dummy',
                        x: 0, y: 0, z: 0, rotation: 0,
                        config: { ...entity }
                    });
                    sceneGroup.add(group);
                }
            } catch(e) {
                console.error("Dormer preview error", e);
            }
        }
    }
};

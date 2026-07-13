// src/features/railing/generators/HandrailGenerator.js
import * as THREE from 'three';
import { ProfileGenerator } from './ProfileGenerator.js';

export class HandrailGenerator {
    static generate(path, config, material) {
        if (!config || !material || !config.handrail) return null;
        
        const hrConfig = config.handrail;
        const profile = ProfileGenerator.generate(hrConfig.shape, hrConfig.width, hrConfig.height);

        // Extrude along the Path3D
        let geo;
        
        if (path.type === 'linear') {
            geo = new THREE.ExtrudeGeometry(profile, {
                depth: path.length,
                bevelEnabled: false
            });
            // Center the rail
            geo.translate(0, config.height - (hrConfig.height / 2), 0);
            
            const mesh = new THREE.Mesh(geo, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Position and rotate
            mesh.position.copy(path.start);
            const angle = Math.atan2(path.direction.x, path.direction.z);
            mesh.rotation.y = angle;
            
            return mesh;
        } else {
            // For curved paths, use TubeGeometry or ExtrudeGeometry with path
            const curve = new THREE.CatmullRomCurve3([path.start, path.end]); // Mock for curve extraction
            geo = new THREE.ExtrudeGeometry(profile, {
                extrudePath: curve,
                bevelEnabled: false
            });
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.y = config.height - (hrConfig.height / 2);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            return mesh;
        }
    }
}

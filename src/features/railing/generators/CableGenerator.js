// src/features/railing/generators/CableGenerator.js
import * as THREE from 'three';

export class CableGenerator {
    static generate(path, config, material) {
        if (!config || !material || !config.cable) return null;

        const cConfig = config.cable;
        const group = new THREE.Group();

        // Calculate how many cables fit vertically
        const availableHeight = config.height - (config.handrail?.height || 0) - (config.bottomRail?.height || 2);
        const count = Math.floor(availableHeight / cConfig.spacing);
        
        if (count <= 0) return null;

        // Use a single TubeGeometry or thin Cylinder for the cables
        const profile = new THREE.Shape();
        profile.absellipse(0, 0, cConfig.diameter / 2, cConfig.diameter / 2, 0, Math.PI * 2, false, 0);

        let geo;
        if (path.type === 'linear') {
            geo = new THREE.CylinderGeometry(cConfig.diameter / 2, cConfig.diameter / 2, path.length, 8);
            geo.rotateX(Math.PI / 2);
            geo.translate(0, 0, path.length / 2);
        } else {
            const curve = new THREE.CatmullRomCurve3([path.start, path.end]); // Mock for curve extraction
            geo = new THREE.TubeGeometry(curve, 20, cConfig.diameter / 2, 8, false);
        }

        // Instance the cables vertically
        const mesh = new THREE.InstancedMesh(geo, material, count);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            if (path.type === 'linear') {
                dummy.position.copy(path.start);
                dummy.position.y += (config.bottomRail?.height || 2) + (i + 1) * cConfig.spacing;
                
                const angle = Math.atan2(path.direction.x, path.direction.z);
                dummy.rotation.set(0, angle, 0);
            } else {
                dummy.position.set(0, (config.bottomRail?.height || 2) + (i + 1) * cConfig.spacing, 0);
            }
            
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);

        return group;
    }
}

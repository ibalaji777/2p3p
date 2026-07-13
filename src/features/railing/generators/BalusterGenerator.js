// src/features/railing/generators/BalusterGenerator.js
import * as THREE from 'three';
import { ConstraintSolver } from '../utils/ConstraintSolver.js';

export class BalusterGenerator {
    static generate(path, config, material) {
        if (!config || !material || !config.baluster) return null;

        const bConfig = config.baluster;
        const positions = ConstraintSolver.solveBalusterPositions(path.length, bConfig.spacing, bConfig.width);
        if (positions.length === 0) return null;

        const bottomElevation = config.bottomRail?.elevation || 0;
        const topElevation = config.height - (config.handrail?.height || 0);
        const balusterHeight = topElevation - bottomElevation;

        const geo = new THREE.BoxGeometry(bConfig.width, balusterHeight, bConfig.depth);
        geo.translate(0, bottomElevation + balusterHeight / 2, 0);

        const mesh = new THREE.InstancedMesh(geo, material, positions.length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const dummy = new THREE.Object3D();

        for (let i = 0; i < positions.length; i++) {
            const t = positions[i];
            const pt = path.getPointAt(t);
            const tangent = path.getTangentAt(t);

            dummy.position.copy(pt);
            
            const angle = Math.atan2(tangent.x, tangent.z);
            dummy.rotation.set(0, angle, 0);
            
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        return mesh;
    }
}

// src/features/railing/generators/PostGenerator.js
import * as THREE from 'three';
import { ConstraintSolver } from '../utils/ConstraintSolver.js';

/**
 * Generates vertical posts using InstancedMesh for performance.
 */
export class PostGenerator {
    static generate(path, config, material) {
        if (!config || !material) return null;

        const pConfig = config.post;
        if (!pConfig) return null;

        const positions = ConstraintSolver.solvePostPositions(path.length, pConfig.spacing);
        if (positions.length === 0) return null;

        const geo = new THREE.BoxGeometry(pConfig.width, config.height, pConfig.depth);
        // Translate so origin is at the bottom center of the post
        geo.translate(0, config.height / 2, 0);

        const mesh = new THREE.InstancedMesh(geo, material, positions.length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const dummy = new THREE.Object3D();

        for (let i = 0; i < positions.length; i++) {
            const t = positions[i];
            const pt = path.getPointAt(t);
            const tangent = path.getTangentAt(t);

            dummy.position.copy(pt);
            
            // Align rotation with the path
            const angle = Math.atan2(tangent.x, tangent.z);
            dummy.rotation.set(0, angle, 0);
            
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        return mesh;
    }
}

// src/features/railing/generators/GlassGenerator.js
import * as THREE from 'three';
import { ConstraintSolver } from '../utils/ConstraintSolver.js';

export class GlassGenerator {
    static generate(path, config, material) {
        if (!config || !material || !config.glass) return null;

        const gConfig = config.glass;
        const group = new THREE.Group();

        // Solve segmentation
        const { count, width } = ConstraintSolver.solveEqualSegments(path.length, gConfig.maxWidth);

        const glassHeight = config.height - gConfig.bottomGap - (config.handrail?.height || 0);

        const geo = new THREE.BoxGeometry(gConfig.thickness, glassHeight, width - 0.5); // -0.5 for small gap between panels
        geo.translate(0, glassHeight / 2 + gConfig.bottomGap, width / 2);

        for (let i = 0; i < count; i++) {
            const t = (i * width) / path.length;
            const pt = path.getPointAt(t);
            const tangent = path.getTangentAt(t);

            const mesh = new THREE.Mesh(geo, material);
            mesh.position.copy(pt);
            
            const angle = Math.atan2(tangent.x, tangent.z);
            mesh.rotation.y = angle;

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
        }

        return group;
    }
}

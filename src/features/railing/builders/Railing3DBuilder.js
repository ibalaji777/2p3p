// src/features/railing/builders/Railing3DBuilder.js
import * as THREE from 'three';
import { PathGenerator } from '../generators/PathGenerator.js';
import { HandrailGenerator } from '../generators/HandrailGenerator.js';
import { PostGenerator } from '../generators/PostGenerator.js';
import { GlassGenerator } from '../generators/GlassGenerator.js';
import { BalusterGenerator } from '../generators/BalusterGenerator.js';
import { CableGenerator } from '../generators/CableGenerator.js';
import { UniversalStairGenerator } from '../generators/UniversalStairGenerator.js';
import { MaterialManager } from '../materials/MaterialManager.js';

/**
 * Orchestrates the procedural generation of a railing in 3D.
 */
export class Railing3DBuilder {
    static build(entity) {
        const group = new THREE.Group();
        if (!entity || !entity.points) return group;

        const pts = entity.points; // [x1, y1, x2, y2]
        if (pts.length < 4) return group;

        // Map 2D coordinates (x, y) to 3D (x, 0, z)
        const start = new THREE.Vector3(pts[0], 0, pts[1]);
        const end = new THREE.Vector3(pts[2], 0, pts[3]);

        return this.build3D(start, end, entity.config);
    }

    /**
     * Builds a railing strictly along a 3D path.
     * @param {THREE.Vector3} start 
     * @param {THREE.Vector3} end 
     * @param {Object} config 
     */
    static build3D(start, end, config) {
        const group = new THREE.Group();
        
        // 1. Normalize Path
        const path = PathGenerator.normalizeLinear(start, end);

        // 2. Fetch Materials
        const getMat = (subConfig, defaultMat) => {
            return MaterialManager.getMaterial(subConfig?.material || defaultMat);
        };

        const postMat = getMat(config.post, 'metal_black');
        const handrailMat = getMat(config.handrail, 'metal_black');
        const glassMat = getMat(config.glass, 'glass_clear');
        const balusterMat = getMat(config.baluster, 'metal_black');
        const cableMat = getMat(config.cable, 'metal_stainless');

        if (config.isStairStyle) {
            return UniversalStairGenerator.generate(path, config, {
                handrail: handrailMat,
                baluster: balusterMat,
                glass: glassMat,
                cable: cableMat,
                post: postMat
            });
        }

        // 3. Generate Components
        const handrail = HandrailGenerator.generate(path, config, handrailMat);
        if (handrail) group.add(handrail);

        const posts = PostGenerator.generate(path, config, postMat);
        if (posts) group.add(posts);

        const glass = GlassGenerator.generate(path, config, glassMat);
        if (glass) group.add(glass);

        const balusters = BalusterGenerator.generate(path, config, balusterMat);
        if (balusters) group.add(balusters);

        const cables = CableGenerator.generate(path, config, cableMat);
        if (cables) group.add(cables);

        // Optional bottom rail
        if (config.bottomRail) {
            const bConfig = { handrail: config.bottomRail, height: config.bottomRail.elevation || 2 };
            const bottomRail = HandrailGenerator.generate(path, bConfig, getMat(config.bottomRail, 'metal_black'));
            if (bottomRail) group.add(bottomRail);
        }

        return group;
    }
}

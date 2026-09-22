// src/features/railing/builders/Railing3DBuilder.js
import * as THREE from 'three';
import { PathGenerator } from '../generators/PathGenerator.js';
import { UniversalRailingGenerator } from '../generators/UniversalRailingGenerator.js';
import { MaterialManager } from '../materials/MaterialManager.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';
import { RAILING_REGISTRY } from '../registry/railing.registry.js';

/**
 * Orchestrates the procedural generation of a railing in 3D.
 */
export class Railing3DBuilder {
    static build(entity) {
        const group = new THREE.Group();
        if (!entity) return group;

        let pts = entity.points;
        if (!pts && entity.startAnchor && entity.endAnchor) {
            const p1 = typeof entity.startAnchor.position === 'function' ? entity.startAnchor.position() : entity.startAnchor;
            const p2 = typeof entity.endAnchor.position === 'function' ? entity.endAnchor.position() : entity.endAnchor;
            if (p1 && p2) pts = [p1.x, p1.y, p2.x, p2.y];
        } else if (!pts && entity.startX !== undefined) {
            pts = [entity.startX, entity.startY, entity.endX, entity.endY];
        }
        if (!pts || pts.length < 4) return group;

        // Map 2D coordinates (x, y) to 3D (x, 0, z)
        const start = new THREE.Vector3(pts[0], 0, pts[1]);
        const end = new THREE.Vector3(pts[2], 0, pts[3]);

        const config = (entity.configId && RAILING_REGISTRY[entity.configId])
            || (entity.config && (entity.config.handrail !== undefined || entity.config.glass !== undefined || entity.config.baluster !== undefined) ? entity.config : null)
            || RAILING_REGISTRY['glass_stainless'];
        return this.build3D(start, end, config, entity);
    }

    /**
     * Builds a railing strictly along a 3D path.
     * @param {THREE.Vector3} start 
     * @param {THREE.Vector3} end 
     * @param {Object} config 
     * @param {Object} entity
     */
    static build3D(start, end, config, entity = null) {
        let group;
        
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

        // Delegate to dedicated UniversalRailingGenerator
        group = UniversalRailingGenerator.generate(path, config, {
            handrail: handrailMat,
            baluster: balusterMat,
            glass: glassMat,
            cable: cableMat,
            post: postMat
        }, entity);

        // 4. Component Registration (3-Layer BIM Architecture)
        group.traverse(child => {
            if (child.isMesh) {
                let slot = child.userData.materialSlot;
                if (!slot) {
                    if (child.material === glassMat) slot = 'glass';
                    else if (child.material === postMat) slot = 'posts';
                    else if (child.material === balusterMat || child.material === cableMat) slot = 'balusters';
                    else if (config._bottomRailMat && child.material === config._bottomRailMat) slot = 'bottom_rail';
                    else slot = 'handrail';
                    child.userData.materialSlot = slot;
                }
                
                if (entity) {
                    child.userData.entity = entity;
                    ComponentRegistry.registerMesh(entity, slot, child, { componentType: 'railing' });
                }
            }
        });

        return group;
    }
}

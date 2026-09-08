import * as THREE from 'three';
import { ComponentRegistry } from './ComponentRegistry.js';
import { MaterialSlots, ComponentTypes } from '../constants/materialSlots.js';
import { calculateMoldingSegments, generateMoldingProfileShape } from '../../features/molding/molding.geometry.js';
import { buildMoldingMesh3D, getMoldingMaterial } from '../../features/molding/molding.renderer3d.js';

/**
 * Molding3DBuilder (Legacy Compatibility Wrapper)
 * Authoritative implementation now resides in src/features/molding/
 */
export class Molding3DBuilder {
    constructor() {
        this.materials = {
            white_paint: getMoldingMaterial('white_paint'),
            wall_material: getMoldingMaterial('wall_material'),
            wood_dark: getMoldingMaterial('wood_dark'),
            wood_white_oak: getMoldingMaterial('wood_white_oak'),
            wood_golden_teak: getMoldingMaterial('wood_golden_teak'),
            black_metal: getMoldingMaterial('black_metal')
        };
    }

    getMaterial(matName) {
        return getMoldingMaterial(matName);
    }

    getMoldingSegments(wallLength, heightOffset, moldingHeight, wallEntity) {
        return calculateMoldingSegments(wallLength, heightOffset, moldingHeight, wallEntity);
    }

    buildMolding(moldData, wallLength, wallThickness, helpers = null, wallEntity = null) {
        return buildMoldingMesh3D(moldData, wallLength, wallThickness, helpers, wallEntity);
    }
}

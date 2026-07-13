// src/features/railing/generators/ProfileGenerator.js
import * as THREE from 'three';

/**
 * Generates 2D cross-section profiles to be extruded along railing paths.
 */
export class ProfileGenerator {
    static generate(shapeType, width, height) {
        const shape = new THREE.Shape();
        const hw = width / 2;
        const hh = height / 2;

        switch (shapeType) {
            case 'round':
            case 'oval': {
                const radiusX = hw;
                const radiusY = hh;
                // Generate an oval/ellipse shape
                shape.absellipse(0, 0, radiusX, radiusY, 0, Math.PI * 2, false, 0);
                break;
            }
            case 'rectangle':
            case 'square':
            default: {
                shape.moveTo(-hw, -hh);
                shape.lineTo(hw, -hh);
                shape.lineTo(hw, hh);
                shape.lineTo(-hw, hh);
                shape.lineTo(-hw, -hh);
                break;
            }
        }

        return shape;
    }
}

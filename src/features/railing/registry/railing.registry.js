// src/features/railing/registry/railing.registry.js

/**
 * Registry defining parametric configurations for different railing styles.
 */
export const RAILING_REGISTRY = {
    'glass_frameless': {
        name: 'Frameless Glass',
        height: 40, // inches
        thickness: 0.5,
        post: null, // No vertical posts
        handrail: null, // No top handrail
        baluster: null,
        glass: {
            thickness: 0.5,
            material: 'glass_clear',
            bottomGap: 0,
            maxWidth: 48 // Segment glass panels into 48" max pieces
        },
        bottomRail: {
            width: 2,
            height: 2,
            material: 'metal_aluminum'
        }
    },
    'glass_stainless': {
        name: 'Stainless Glass Railing',
        height: 40,
        thickness: 2,
        post: {
            width: 2,
            depth: 2,
            spacing: 48,
            material: 'metal_stainless'
        },
        handrail: {
            width: 2,
            height: 1,
            shape: 'rectangle',
            material: 'metal_stainless'
        },
        glass: {
            thickness: 0.5,
            material: 'glass_clear',
            bottomGap: 4,
            maxWidth: 48
        }
    },
    'metal_vertical': {
        name: 'Modern Vertical Metal',
        height: 40,
        thickness: 2,
        post: {
            width: 2,
            depth: 2,
            spacing: 48,
            material: 'metal_black'
        },
        handrail: {
            width: 2,
            height: 1,
            shape: 'rectangle',
            material: 'metal_black'
        },
        bottomRail: {
            width: 2,
            height: 1,
            material: 'metal_black',
            elevation: 4
        },
        baluster: {
            width: 0.75,
            depth: 0.75,
            spacing: 4, // 4 inches between balusters
            material: 'metal_black'
        }
    },
    'wood_classic': {
        name: 'Classic Wood Balusters',
        height: 36,
        thickness: 4,
        post: {
            width: 4,
            depth: 4,
            spacing: 72,
            material: 'wood_oak'
        },
        handrail: {
            width: 3,
            height: 2,
            shape: 'oval',
            material: 'wood_oak'
        },
        bottomRail: {
            width: 3,
            height: 1.5,
            material: 'wood_oak',
            elevation: 2
        },
        baluster: {
            width: 1.5,
            depth: 1.5,
            spacing: 5,
            material: 'wood_painted_white'
        }
    },
    'cable_stainless': {
        name: 'Stainless Cable Railing',
        height: 40,
        thickness: 2,
        post: {
            width: 2,
            depth: 2,
            spacing: 48,
            material: 'metal_stainless'
        },
        handrail: {
            width: 3,
            height: 1.5,
            shape: 'rectangle',
            material: 'wood_oak'
        },
        cable: {
            diameter: 0.25,
            spacing: 4, // Horizontal cables every 4 inches vertically
            material: 'metal_stainless'
        }
    }
};

export function getRailingConfig(id) {
    return RAILING_REGISTRY[id] || RAILING_REGISTRY['glass_stainless'];
}

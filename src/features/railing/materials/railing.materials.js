// src/features/railing/materials/railing.materials.js
import * as THREE from 'three';

/**
 * Centralized definition of physically-based materials used in the railing system.
 */
export const RAILING_MATERIAL_DEFS = {
    'glass_clear': {
        type: 'MeshPhysicalMaterial',
        params: {
            color: 0xffffff,
            transmission: 0.9,
            opacity: 1,
            metalness: 0,
            roughness: 0,
            ior: 1.5,
            thickness: 0.5,
            clearcoat: 1,
            transparent: true
        }
    },
    'glass_frosted': {
        type: 'MeshPhysicalMaterial',
        params: {
            color: 0xffffff,
            transmission: 0.8,
            opacity: 1,
            metalness: 0,
            roughness: 0.5,
            ior: 1.5,
            thickness: 0.5,
            transparent: true
        }
    },
    'metal_stainless': {
        type: 'MeshStandardMaterial',
        params: {
            color: 0xd0d0d0,
            metalness: 0.9,
            roughness: 0.3
        }
    },
    'metal_aluminum': {
        type: 'MeshStandardMaterial',
        params: {
            color: 0xcccccc,
            metalness: 0.8,
            roughness: 0.4
        }
    },
    'metal_black': {
        type: 'MeshStandardMaterial',
        params: {
            color: 0x111111,
            metalness: 0.8,
            roughness: 0.2
        }
    },
    'wood_oak': {
        type: 'MeshStandardMaterial',
        params: {
            color: 0x8b5a2b, // Fallback color; actual system uses textures
            metalness: 0.0,
            roughness: 0.8
        }
    },
    'wood_painted_white': {
        type: 'MeshStandardMaterial',
        params: {
            color: 0xf3f4f6,
            metalness: 0.0,
            roughness: 0.5
        }
    }
};

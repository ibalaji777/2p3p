import { MaterialSlots } from '../../core/constants/materialSlots.js';
import { renderFascia2D } from './fascia.renderer2d.js';
import { renderFascia3D } from './fascia.renderer3d.js';

export const FASCIA_TYPES = {
    c_shape_left: { id: 'c_shape_left', label: 'C-Shape (Left)', description: 'Wraps left edge and extends top & bottom cantilever arms.' },
    c_shape_right: { id: 'c_shape_right', label: 'C-Shape (Right)', description: 'Wraps right edge and extends top & bottom cantilever arms.' },
    l_shape_left: { id: 'l_shape_left', label: 'L-Shape (Left)', description: 'Wraps left edge and top cantilever arm.' },
    l_shape_right: { id: 'l_shape_right', label: 'L-Shape (Right)', description: 'Wraps right edge and top cantilever arm.' },
    full_box: { id: 'full_box', label: 'Full Box Wrap', description: 'Surrounds all 4 edges forming a complete facade box frame.' }
};

export const FASCIA_MATERIALS = {
    white: { id: 'white', name: 'White Paint', color: 0xffffff, roughness: 0.8 },
    dark_grey: { id: 'dark_grey', name: 'Dark Grey Composite', color: 0x333333, roughness: 0.6 },
    stone: { id: 'stone', name: 'Stone Cladding', color: 0xa8a29e, roughness: 0.8 },
    wood: { id: 'wood', name: 'Wood Panel', color: 0x8b5a2b, roughness: 0.6 }
};

export const FASCIA_REGISTRY = {
    'elevation_fascia': {
        widget: "elevation_fascia",
        type: "elevation_fascia",
        label: "ELEVATION FASCIA",
        cutsWall: false,
        events: ["drag_along_wall", "snap_to_corners", "resize_handles_along_wall_axis"],
        defaultConfig: {
            width: 100,
            height: 120,
            depth: 40,
            thick: 10,
            elevation: 0,
            profileType: 'c_shape_left',
            fasciaMat: 'white',
            facing: 1
        },
        render2D: renderFascia2D,
        render3D: renderFascia3D
    }
};

/**
 * Authoritative Catalog Presets for UI Galleries
 */
export const FASCIA_CATALOG = [
    { id: 'fascia_c_left', name: 'C-Shape (Left)', badge: 'FACADE', material: 'Aluminium Composite', image: '', params: { type: 'elevation_fascia', profileType: 'c_shape_left', width: 100, height: 120, depth: 40, thick: 10, elevation: 0 } },
    { id: 'fascia_c_right', name: 'C-Shape (Right)', badge: 'FACADE', material: 'Aluminium Composite', image: '', params: { type: 'elevation_fascia', profileType: 'c_shape_right', width: 100, height: 120, depth: 40, thick: 10, elevation: 0 } },
    { id: 'fascia_l_left', name: 'L-Shape (Left)', badge: 'CORNER', material: 'Anodized Steel', image: '', params: { type: 'elevation_fascia', profileType: 'l_shape_left', width: 100, height: 120, depth: 40, thick: 10, elevation: 0 } },
    { id: 'fascia_l_right', name: 'L-Shape (Right)', badge: 'CORNER', material: 'Anodized Steel', image: '', params: { type: 'elevation_fascia', profileType: 'l_shape_right', width: 100, height: 120, depth: 40, thick: 10, elevation: 0 } },
    { id: 'fascia_box', name: 'Full Box Frame', badge: 'BOX', material: 'Powder-Coated Metal', image: '', params: { type: 'elevation_fascia', profileType: 'full_box', width: 100, height: 120, depth: 40, thick: 10, elevation: 0 } }
];

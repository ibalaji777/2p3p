import * as THREE from 'three';
import { MaterialSlots } from '../../core/constants/materialSlots.js';
import { renderMolding3D } from './molding.renderer3d.js';

/**
 * Authoritative Molding, Wall Trim & Skirting Registry
 */
export const MOLDING_PROFILES = {
    // Baseboards & Skirting
    skirting_flat: { id: 'skirting_flat', name: 'Flat Modern Baseboard', category: 'skirting', defaultHeight: 12, defaultDepth: 2.0, defaultMaterial: 'white_paint' },
    skirting_beveled: { id: 'skirting_beveled', name: 'Chamfered Baseboard', category: 'skirting', defaultHeight: 12, defaultDepth: 2.0, defaultMaterial: 'wood_white_oak' },
    skirting_torus: { id: 'skirting_torus', name: 'Torus / Bullnose Skirting', category: 'skirting', defaultHeight: 14, defaultDepth: 2.2, defaultMaterial: 'wood_golden_teak' },
    skirting_ogee: { id: 'skirting_ogee', name: 'Classic Ogee Skirting', category: 'skirting', defaultHeight: 15, defaultDepth: 2.5, defaultMaterial: 'wood_dark' },
    skirting_craftsman: { id: 'skirting_craftsman', name: 'Stepped Craftsman Skirting', category: 'skirting', defaultHeight: 14, defaultDepth: 2.2, defaultMaterial: 'wood_dark' },
    skirting_shadow: { id: 'skirting_shadow', name: 'Shadow Gap / Reglet Skirting', category: 'skirting', defaultHeight: 10, defaultDepth: 2.0, defaultMaterial: 'black_metal' },
    skirting_scotia: { id: 'skirting_scotia', name: 'Scotia Cove Baseboard', category: 'skirting', defaultHeight: 10, defaultDepth: 2.0, defaultMaterial: 'white_paint' },
    skirting_shoe: { id: 'skirting_shoe', name: 'Quarter Round Shoe Trim', category: 'skirting', defaultHeight: 3, defaultDepth: 1.8, defaultMaterial: 'white_paint' },

    // Chair Rails & Wall Trims
    chair_rail: { id: 'chair_rail', name: 'Classic Chair Rail (Dado)', category: 'chair_rail', defaultHeight: 8, defaultDepth: 2.5, defaultOffset: 90, defaultMaterial: 'white_paint' },
    picture_rail: { id: 'picture_rail', name: 'Picture Rail Trim', category: 'chair_rail', defaultHeight: 6, defaultDepth: 2.2, defaultOffset: 140, defaultMaterial: 'white_paint' },
    fluted_band: { id: 'fluted_band', name: 'Fluted Architectural Band', category: 'chair_rail', defaultHeight: 10, defaultDepth: 2.5, defaultOffset: 90, defaultMaterial: 'white_paint' },
    double_bead: { id: 'double_bead', name: 'Double Bead Trim', category: 'chair_rail', defaultHeight: 8, defaultDepth: 2.2, defaultOffset: 90, defaultMaterial: 'white_paint' },
    beveled_trim: { id: 'beveled_trim', name: 'Beveled Accent Band', category: 'chair_rail', defaultHeight: 8, defaultDepth: 2.0, defaultOffset: 90, defaultMaterial: 'wood_white_oak' },
    flat: { id: 'flat', name: 'Flat Wall Band (Modern)', category: 'chair_rail', defaultHeight: 10, defaultDepth: 2.0, defaultOffset: 90, defaultMaterial: 'white_paint' },
    frame: { id: 'frame', name: 'Beveled Frame Trim', category: 'chair_rail', defaultHeight: 8, defaultDepth: 3.0, defaultOffset: 90, defaultMaterial: 'white_paint' },
    groove: { id: 'groove', name: 'Recessed Groove', category: 'chair_rail', defaultHeight: 2, defaultDepth: -2.0, defaultOffset: 50, defaultMaterial: 'wall_material' },
    frieze_exterior: { id: 'frieze_exterior', name: 'Exterior Architectural Frieze', category: 'exterior', defaultHeight: 18, defaultDepth: 4.5, defaultOffset: 165, defaultMaterial: 'white_paint' },
    foundation_trim: { id: 'foundation_trim', name: 'Foundation Plinth Trim', category: 'exterior', defaultHeight: 25, defaultDepth: 4.5, defaultOffset: 0, defaultMaterial: 'white_paint' },

    // Crown & Cornice Moldings
    crown: { id: 'crown', name: 'Crown Molding (Cove)', category: 'crown', defaultHeight: 10, defaultDepth: 5.0, defaultOffset: 170, defaultMaterial: 'white_paint' },
    ogee: { id: 'ogee', name: 'Ogee (Cyma) Molding', category: 'crown', defaultHeight: 10, defaultDepth: 6.0, defaultOffset: 170, defaultMaterial: 'white_paint' },
    egg_and_dart: { id: 'egg_and_dart', name: 'Egg and Dart Molding', category: 'crown', defaultHeight: 10, defaultDepth: 6.0, defaultOffset: 170, defaultMaterial: 'white_paint' },
    dentil: { id: 'dentil', name: 'Dentil Molding', category: 'crown', defaultHeight: 10, defaultDepth: 6.0, defaultOffset: 170, defaultMaterial: 'white_paint' },
    craftsman: { id: 'craftsman', name: 'Step / Craftsman Molding', category: 'crown', defaultHeight: 10, defaultDepth: 6.0, defaultOffset: 170, defaultMaterial: 'white_paint' },
    layered: { id: 'layered', name: 'Layered Projection', category: 'crown', defaultHeight: 10, defaultDepth: 5.0, defaultOffset: 50, defaultMaterial: 'white_paint' }
};

export const MOLDING_REGISTRY = {
    // Baseboards & Skirting
    'molding_skirting_flat': { type: 'molding_skirting_flat', label: 'Flat Modern Baseboard', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2, heightOffset: 0, moldingHeight: 12, profileType: 'skirting_flat', material: 'white_paint', color: '#ffffff' } },
    'molding_skirting_beveled': { type: 'molding_skirting_beveled', label: 'Chamfered Baseboard', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2, heightOffset: 0, moldingHeight: 12, profileType: 'skirting_beveled', material: 'wood_white_oak', color: '#ffffff' } },
    'molding_skirting_torus': { type: 'molding_skirting_torus', label: 'Torus / Bullnose Skirting', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2.2, heightOffset: 0, moldingHeight: 14, profileType: 'skirting_torus', material: 'wood_golden_teak', color: '#ffffff' } },
    'molding_skirting_ogee': { type: 'molding_skirting_ogee', label: 'Classic Ogee Skirting', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2.5, heightOffset: 0, moldingHeight: 15, profileType: 'skirting_ogee', material: 'wood_dark', color: '#ffffff' } },
    'molding_skirting_craftsman': { type: 'molding_skirting_craftsman', label: 'Stepped Craftsman Skirting', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2.2, heightOffset: 0, moldingHeight: 14, profileType: 'skirting_craftsman', material: 'wood_dark', color: '#ffffff' } },
    'molding_skirting_shadow': { type: 'molding_skirting_shadow', label: 'Shadow Gap / Reglet Skirting', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2, heightOffset: 0, moldingHeight: 10, profileType: 'skirting_shadow', material: 'black_metal', color: '#111111' } },
    'molding_skirting_scotia': { type: 'molding_skirting_scotia', label: 'Scotia Cove Baseboard', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 2, heightOffset: 0, moldingHeight: 10, profileType: 'skirting_scotia', material: 'white_paint', color: '#ffffff' } },
    'molding_skirting_shoe': { type: 'molding_skirting_shoe', label: 'Quarter Round Shoe Trim', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 100, depth: 1.8, heightOffset: 0, moldingHeight: 3, profileType: 'skirting_shoe', material: 'white_paint', color: '#ffffff' } },

    // Crown Moldings, Cornices, & Trims
    'molding_band': { type: 'molding_band', label: 'Horizontal Band', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 3, heightOffset: 90, moldingHeight: 8, profileType: 'flat', material: 'white_paint', color: '#ffffff' } },
    'molding_chair_rail': { type: 'molding_chair_rail', label: 'Classic Chair Rail (Dado)', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 2.5, heightOffset: 90, moldingHeight: 8, profileType: 'chair_rail', material: 'white_paint', color: '#ffffff' } },
    'molding_picture_rail': { type: 'molding_picture_rail', label: 'Picture Rail Trim', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 2, heightOffset: 150, moldingHeight: 6, profileType: 'picture_rail', material: 'white_paint', color: '#ffffff' } },
    'molding_fluted_band': { type: 'molding_fluted_band', label: 'Fluted Wall Band', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 2.5, heightOffset: 90, moldingHeight: 10, profileType: 'fluted_band', material: 'white_paint', color: '#ffffff' } },
    'molding_double_bead': { type: 'molding_double_bead', label: 'Double Bead Trim', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 2, heightOffset: 90, moldingHeight: 8, profileType: 'double_bead', material: 'white_paint', color: '#ffffff' } },
    'molding_beveled_trim': { type: 'molding_beveled_trim', label: 'Beveled Accent Trim', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 2, heightOffset: 90, moldingHeight: 8, profileType: 'beveled_trim', material: 'white_paint', color: '#ffffff' } },
    'molding_crown': { type: 'molding_crown', label: 'Crown Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 5, heightOffset: 110, moldingHeight: 10, profileType: 'crown', material: 'white_paint', color: '#ffffff' } },
    'molding_ogee': { type: 'molding_ogee', label: 'Ogee (Cyma) Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 6, heightOffset: 110, moldingHeight: 10, profileType: 'ogee', material: 'white_paint', color: '#ffffff' } },
    'molding_egg_and_dart': { type: 'molding_egg_and_dart', label: 'Egg and Dart Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 6, heightOffset: 110, moldingHeight: 10, profileType: 'egg_and_dart', material: 'white_paint', color: '#ffffff' } },
    'molding_dentil': { type: 'molding_dentil', label: 'Dentil Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 6, heightOffset: 110, moldingHeight: 10, profileType: 'dentil', material: 'white_paint', color: '#ffffff' } },
    'molding_craftsman': { type: 'molding_craftsman', label: 'Step / Craftsman Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 6, heightOffset: 110, moldingHeight: 10, profileType: 'craftsman', material: 'white_paint', color: '#ffffff' } },
    'molding_frieze_exterior': { type: 'molding_frieze_exterior', label: 'Exterior Frieze Band', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 4, heightOffset: 160, moldingHeight: 18, profileType: 'frieze_exterior', material: 'white_paint', color: '#ffffff' } },
    'molding_foundation_trim': { type: 'molding_foundation_trim', label: 'Foundation Plinth Trim', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 4, heightOffset: 0, moldingHeight: 25, profileType: 'foundation_trim', material: 'white_paint', color: '#ffffff' } },
    'molding_window': { type: 'molding_window', label: 'Window Frame', events: ['snap_to_wall', 'drag_along_wall'], defaultConfig: { width: 45, depth: 4, heightOffset: 35, moldingHeight: 5, profileType: 'frame', material: 'white_paint', color: '#ffffff', frameWidth: 5 } },
    'molding_door': { type: 'molding_door', label: 'Door Frame', events: ['snap_to_wall', 'drag_along_wall'], defaultConfig: { width: 40, depth: 4, heightOffset: 0, moldingHeight: 5, profileType: 'frame', material: 'white_paint', color: '#ffffff', frameWidth: 5 } },
    'molding_groove': { type: 'molding_groove', label: 'Decorative Groove', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: -2, heightOffset: 50, moldingHeight: 2, profileType: 'groove', material: 'wall_material', color: '#000000', grooveWidth: 2 } },
    'molding_layered': { type: 'molding_layered', label: 'Layered Projection', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 5, heightOffset: 50, moldingHeight: 10, profileType: 'layered', material: 'white_paint', color: '#ffffff', layers: 3, layerGap: 1 } }
};

// Map direct alias keys
[
    'skirting_flat', 'skirting_beveled', 'skirting_torus', 'skirting_ogee', 
    'skirting_craftsman', 'skirting_shadow', 'skirting_scotia', 'skirting_shoe',
    'chair_rail', 'picture_rail', 'fluted_band', 'double_bead', 'beveled_trim',
    'frieze_exterior', 'foundation_trim', 'wall_trim'
].forEach(k => {
    if (k === 'wall_trim') {
        MOLDING_REGISTRY[k] = MOLDING_REGISTRY['molding_chair_rail'];
    } else {
        MOLDING_REGISTRY[k] = MOLDING_REGISTRY['molding_' + k] || MOLDING_REGISTRY['molding_skirting_' + k];
    }
});

// Attach standard render3D preview generator for catalog & gallery
Object.keys(MOLDING_REGISTRY).forEach(key => {
    MOLDING_REGISTRY[key].render3D = (sceneGroup, entity, helpers) => {
        return renderMolding3D(sceneGroup, entity, helpers, key);
    };
});

/**
 * Authoritative Catalog Presets for UI Galleries
 */
export const SKIRTING_CATALOG = [
    { isDivider: true, id: 'div_modern_skirting', name: 'Modern & Minimalist Baseboards' },
    { id: 'molding_skirting_flat', name: 'Modern Flat Baseboard', badge: 'POPULAR', material: 'White Plaster / Paint', specs: '120 × 20 mm', image: '', toolId: 'skirting', params: { type: 'molding_skirting_flat', profileType: 'skirting_flat', heightOffset: 0, moldingHeight: 12, depth: 2, material: 'white_paint' } },
    { id: 'molding_skirting_beveled', name: 'Chamfered Baseboard', badge: 'MODERN', material: 'Solid White Oak', specs: '120 × 20 mm', image: '', toolId: 'skirting', params: { type: 'molding_skirting_beveled', profileType: 'skirting_beveled', heightOffset: 0, moldingHeight: 12, depth: 2, material: 'wood_white_oak' } },
    { id: 'molding_skirting_shadow', name: 'Shadow Gap / Reglet Skirting', badge: 'LUXURY', material: 'Matte Black Metal Reveal', specs: '100 × 20 mm', image: '', toolId: 'skirting', params: { type: 'molding_skirting_shadow', profileType: 'skirting_shadow', heightOffset: 0, moldingHeight: 10, depth: 2, material: 'black_metal' } },
    
    { isDivider: true, id: 'div_classic_skirting', name: 'Classic & Heritage Baseboards' },
    { id: 'molding_skirting_torus', name: 'Torus / Bullnose Skirting', badge: 'CLASSIC', material: 'Golden Teak Wood', specs: '140 × 22 mm', image: '', toolId: 'skirting', params: { type: 'molding_skirting_torus', profileType: 'skirting_torus', heightOffset: 0, moldingHeight: 14, depth: 2.2, material: 'wood_golden_teak' } },
    { id: 'molding_skirting_ogee', name: 'Classic Ogee Victorian', badge: 'VICTORIAN', material: 'Dark Walnut Timber', specs: '150 × 25 mm', image: '', toolId: 'skirting', params: { type: 'molding_skirting_ogee', profileType: 'skirting_ogee', heightOffset: 0, moldingHeight: 15, depth: 2.5, material: 'wood_dark' } },
    { id: 'molding_skirting_craftsman', name: 'Stepped Craftsman Skirting', badge: 'STEPPED', material: 'Hardwood Trim', specs: '140 × 22 mm', image: '', toolId: 'skirting', params: { type: 'molding_skirting_craftsman', profileType: 'skirting_craftsman', heightOffset: 0, moldingHeight: 14, depth: 2.2, material: 'wood_dark' } },
    
    { isDivider: true, id: 'div_shoe_cove_skirting', name: 'Coves & Shoe Trims' },
    { id: 'molding_skirting_scotia', name: 'Scotia Cove Baseboard', badge: 'COVE', material: 'Painted Gypsum Plaster', specs: '100 × 20 mm', image: '', toolId: 'skirting', params: { type: 'molding_skirting_scotia', profileType: 'skirting_scotia', heightOffset: 0, moldingHeight: 10, depth: 2, material: 'white_paint' } },
    { id: 'molding_skirting_shoe', name: 'Quarter Round Shoe Trim', badge: 'SHOE TRIM', material: 'White Pine Trim', specs: '30 × 18 mm', image: '', toolId: 'skirting', params: { type: 'molding_skirting_shoe', profileType: 'skirting_shoe', heightOffset: 0, moldingHeight: 3, depth: 1.8, material: 'white_paint' } }
];

export const CROWN_MOLDING_CATALOG = [
    { isDivider: true, id: 'div_crowns', name: 'Crown Moldings & Cornices' },
    { id: 'molding_crown', name: 'Crown Molding', badge: 'CLASSIC', material: 'Carved Wood', image: '', toolId: 'molding', params: { type: 'molding_crown', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_ogee', name: 'Ogee (Cyma)', badge: 'PROFILE', material: 'Polyurethane', image: '', toolId: 'molding', params: { type: 'molding_ogee', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_egg_and_dart', name: 'Egg and Dart', badge: 'DECORATIVE', material: 'Gypsum Plaster', image: '', toolId: 'molding', params: { type: 'molding_egg_and_dart', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_dentil', name: 'Dentil Molding', badge: 'HERITAGE', material: 'Cast Stone', image: '', toolId: 'molding', params: { type: 'molding_dentil', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_craftsman', name: 'Step / Craftsman', badge: 'MODERN', material: 'Hardwood', image: '', toolId: 'molding', params: { type: 'molding_craftsman', materials: { frame: { id: 'white_paint' } } } },
    
    { isDivider: true, id: 'div_trims', name: 'Wall Bands & Framing Trims' },
    { id: 'molding_band', name: 'Horizontal Band', badge: 'FLAT', material: 'Painted Plaster', image: '', toolId: 'molding', params: { type: 'molding_band', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_window', name: 'Window Frame', badge: 'TRIM', material: 'White Vinyl', image: '', toolId: 'molding', params: { type: 'molding_window', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_door', name: 'Door Frame', badge: 'TRIM', material: 'Oak Trim', image: '', toolId: 'molding', params: { type: 'molding_door', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_groove', name: 'Decorative Groove', badge: 'RECESSED', material: 'Grooved Panel', image: '', toolId: 'molding', params: { type: 'molding_groove', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_layered', name: 'Layered Projection', badge: 'LAYERED', material: 'Composite', image: '', toolId: 'molding', params: { type: 'molding_layered', materials: { frame: { id: 'white_paint' } } } }
];

export const WALL_TRIM_CATALOG = [
    { isDivider: true, id: 'div_chair_rails', name: 'Chair Rails & Wall Bands (Dado)' },
    { id: 'molding_chair_rail', name: 'Classic Chair Rail (Dado)', badge: 'CLASSIC', material: 'Painted Wood / Plaster', specs: 'Cyma Top & Beaded Waist', image: '', toolId: 'wall_trim', params: { type: 'molding_chair_rail', profileType: 'chair_rail', heightOffset: 90, moldingHeight: 8, depth: 2.5, material: 'white_paint' } },
    { id: 'molding_picture_rail', name: 'Picture Rail Trim', badge: 'HERITAGE', material: 'Hardwood Trim', specs: 'Hook Bead & Scoop Cove', image: '', toolId: 'wall_trim', params: { type: 'molding_picture_rail', profileType: 'picture_rail', heightOffset: 140, moldingHeight: 6, depth: 2.2, material: 'white_paint' } },
    { id: 'molding_fluted_band', name: 'Fluted Architectural Band', badge: 'FLUTED', material: 'Milled Hardwood', specs: 'Triple Fluted Grooves', image: '', toolId: 'wall_trim', params: { type: 'molding_fluted_band', profileType: 'fluted_band', heightOffset: 90, moldingHeight: 10, depth: 2.5, material: 'white_paint' } },
    { id: 'molding_double_bead', name: 'Double Bead Trim', badge: 'CLASSIC', material: 'Carved Wood', specs: 'Dual Half-Round Bead Relief', image: '', toolId: 'wall_trim', params: { type: 'molding_double_bead', profileType: 'double_bead', heightOffset: 90, moldingHeight: 8, depth: 2.2, material: 'white_paint' } },
    { id: 'molding_beveled_trim', name: 'Beveled Accent Band', badge: 'MODERN', material: 'Solid White Oak', specs: 'Double Chamfered Relief', image: '', toolId: 'wall_trim', params: { type: 'molding_beveled_trim', profileType: 'beveled_trim', heightOffset: 90, moldingHeight: 8, depth: 2.0, material: 'wood_white_oak' } },
    { id: 'molding_band', name: 'Flat Wall Band (Modern)', badge: 'MINIMAL', material: 'Painted Plaster', specs: 'Clean Rectangular Ribbon Band', image: '', toolId: 'wall_trim', params: { type: 'molding_band', profileType: 'band', heightOffset: 90, moldingHeight: 10, depth: 2.0, material: 'white_paint' } },

    { isDivider: true, id: 'div_skirting_sub', name: 'Baseboards & Skirting (Floor Level)' },
    { id: 'molding_skirting_flat', name: 'Modern Flat Baseboard', badge: 'POPULAR', material: 'White Plaster / Paint', specs: '120 × 20 mm', image: '', toolId: 'wall_trim', params: { type: 'molding_skirting_flat', profileType: 'skirting_flat', heightOffset: 0, moldingHeight: 12, depth: 2, material: 'white_paint' } },
    { id: 'molding_skirting_beveled', name: 'Chamfered Baseboard', badge: 'MODERN', material: 'Solid White Oak', specs: '120 × 20 mm', image: '', toolId: 'wall_trim', params: { type: 'molding_skirting_beveled', profileType: 'skirting_beveled', heightOffset: 0, moldingHeight: 12, depth: 2, material: 'wood_white_oak' } },
    { id: 'molding_skirting_torus', name: 'Torus / Bullnose Skirting', badge: 'CLASSIC', material: 'Golden Teak Wood', specs: '140 × 22 mm', image: '', toolId: 'wall_trim', params: { type: 'molding_skirting_torus', profileType: 'skirting_torus', heightOffset: 0, moldingHeight: 14, depth: 2.2, material: 'wood_golden_teak' } },
    { id: 'molding_skirting_ogee', name: 'Classic Ogee Victorian', badge: 'VICTORIAN', material: 'Dark Walnut Timber', specs: '150 × 25 mm', image: '', toolId: 'wall_trim', params: { type: 'molding_skirting_ogee', profileType: 'skirting_ogee', heightOffset: 0, moldingHeight: 15, depth: 2.5, material: 'wood_dark' } },
    { id: 'molding_skirting_shadow', name: 'Shadow Gap / Reglet Skirting', badge: 'LUXURY', material: 'Matte Black Metal Reveal', specs: '100 × 20 mm', image: '', toolId: 'wall_trim', params: { type: 'molding_skirting_shadow', profileType: 'skirting_shadow', heightOffset: 0, moldingHeight: 10, depth: 2, material: 'black_metal' } },

    { isDivider: true, id: 'div_crown_sub', name: 'Crown Moldings, Cornices & Friezes' },
    { id: 'molding_crown', name: 'Classic Crown Molding', badge: 'CEILING', material: 'Carved Wood / Plaster', specs: 'Ceiling Line Cornice Projection', image: '', toolId: 'wall_trim', params: { type: 'molding_crown', profileType: 'crown', heightOffset: 170, moldingHeight: 10, depth: 5, material: 'white_paint' } },
    { id: 'molding_ogee', name: 'Ogee Cyma Molding', badge: 'PROFILE', material: 'Polyurethane Cornice', specs: 'Graceful S-Curve Ceiling Trim', image: '', toolId: 'wall_trim', params: { type: 'molding_ogee', profileType: 'ogee', heightOffset: 170, moldingHeight: 10, depth: 5, material: 'white_paint' } },
    { id: 'molding_dentil', name: 'Dentil Blocks Molding', badge: 'HERITAGE', material: 'Cast Stone Cornice', specs: 'Classical Tooth Block Relief', image: '', toolId: 'wall_trim', params: { type: 'molding_dentil', profileType: 'dentil', heightOffset: 170, moldingHeight: 12, depth: 6, material: 'white_paint' } },
    { id: 'molding_frieze_exterior', name: 'Exterior Architectural Frieze', badge: 'EXTERIOR', material: 'Limestone Masonry', specs: 'Wide Exterior Upper Band & Drip Lip', image: '', toolId: 'wall_trim', params: { type: 'molding_frieze_exterior', profileType: 'frieze_exterior', heightOffset: 165, moldingHeight: 15, depth: 4.5, material: 'limestone' } },
    { id: 'molding_foundation_trim', name: 'Exterior Foundation Plinth Trim', badge: 'PLINTH', material: 'Rustic Ashlar Masonry', specs: 'Heavy Base Water-Table 45° Drip', image: '', toolId: 'wall_trim', params: { type: 'molding_foundation_trim', profileType: 'foundation_trim', heightOffset: 0, moldingHeight: 35, depth: 5.0, material: 'rough_stone' } }
];

export const MOLDING_CATALOG = WALL_TRIM_CATALOG;

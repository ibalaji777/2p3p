import { WINDOW_SILL, WINDOW_HEIGHT } from '../../core/constants/units.js';
import { renderWindow2D } from './window.renderer2d.js';
import { renderWindow3D } from './window.renderer3d.js';

export const WINDOW_TYPES = { 
    sliding_std: { label: "Standard Sliding Window", type: "sliding", hasChajja: false }, 
    casement_std: { label: "Casement / Hinged Window", type: "casement", hasChajja: false }, 
    casement_chajja: { label: "Window with Concrete Sunshade", type: "casement", hasChajja: true }, 
    fixed_elevation: { label: "Fixed Elevation Glass", type: "fixed", hasChajja: false }, 
    modern_split: { label: "Modern Asymmetric", type: "split_asymmetric", hasChajja: false }, 
    bay_box: { label: "Box Bay Window (Villa Style)", type: "bay", hasChajja: true }, 
    window_seat: { label: "Double Picture Window", type: "window_seat", hasChajja: false }, 
    garden_open: { label: "Open Garden Window", type: "garden_open", hasChajja: true }, 
    panoramic_slider: { label: "Panoramic Slider", type: "panoramic_slider", hasChajja: false }, 
    shutter_double: { label: "Double Louvered Shutter", type: "shutter_double", hasChajja: false }, 
    louver_vent: { label: "Vent / Louver (Bathroom)", type: "louver", hasChajja: false }, 
    traditional_indian: { label: "Traditional Wooden Shutter", type: "traditional", hasChajja: true } 
};

export const WINDOW_FRAME_MATERIALS = {};

export const WINDOW_GRILLE_PATTERNS = { 
    grid: { label: "Standard Grid" }, 
    horizontal: { label: "Horizontal Bars" }, 
    vertical: { label: "Vertical Bars" }, 
    diamond: { label: "Diamond Pattern" }, 
    none: { label: "No Safety Grille" } 
};

export const WINDOW_SHAPES_REGISTRY = {
    'square': { id: 'square', name: 'Square Top' },
    'radius': { id: 'radius', name: 'Radius Arch' },
    'segment': { id: 'segment', name: 'Segment Arch' },
    'gothic': { id: 'gothic', name: 'Gothic Pointed Arch' }
};

export const WindowRegistry = {
    widget: "window",
    label: "WINDOW",
    events: ["drag_along_wall", "elevation_change", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
    defaultConfig: {
        width: 50,
        height: WINDOW_HEIGHT,
        elevation: WINDOW_SILL,
        windowType: 'sliding_std',
        materials: {
            frame: { id: 'wood_teak' },
            leaf: { id: 'wood_teak' },
            glass: { id: 'clear' },
            hardware: { id: 'steel' },
            seal: { id: 'pvc' },
            grille: { id: 'alum_powder' }
        },
        grillePattern: 'grid',
        facing: 1,
        side: 1
    },
    render2D: renderWindow2D,
    render3D: renderWindow3D
};

export const DOOR_TYPES = { 
    single: { label: "Single Hinged Door" }, 
    double: { label: "Double Door" }, 
    sliding: { label: "Sliding Door" }, 
    double_sliding: { label: "Double Sliding Door" }, 
    folding: { label: "Folding / Bi-fold" }, 
    pivot: { label: "Pivot Door" }, 
    pocket: { label: "Pocket Door" }, 
    french: { label: "French Door (Glass)" } 
};

export const DOOR_MATERIALS = {};

export const DOOR_MATERIALS_REGISTRY = {
    // Moved to UNIVERSAL_SURFACE_REGISTRY in material.registry.js
};

export const DOOR_STYLES_REGISTRY = {
    'flat': { id: 'flat', name: 'Flat Panel', icon: 'solid #64748b' },
    'modern_grooved': { id: 'modern_grooved', name: 'Modern Grooved (Bedroom)', icon: 'repeating-linear-gradient(180deg, #64748b, #64748b 20px, #475569 20px, #475569 22px)' },
    'louvered_half': { id: 'louvered_half', name: 'Half Louvered (Bathroom)', icon: 'repeating-linear-gradient(180deg, #64748b, #64748b 4px, #1e293b 4px, #1e293b 8px)' },
    'office_glass_lite': { id: 'office_glass_lite', name: 'Glass Lite (Office)', icon: 'linear-gradient(180deg, #bae6fd 0%, #bae6fd 20%, #475569 20%, #475569 25%, #bae6fd 25%, #bae6fd 45%, #475569 45%, #475569 50%, #bae6fd 50%, #bae6fd 70%, #475569 70%, #475569 75%, #bae6fd 75%, #bae6fd 100%)' },
    'shaker_multi_panel': { id: 'shaker_multi_panel', name: 'Shaker 5-Panel (Closet)', icon: 'repeating-linear-gradient(180deg, #94a3b8, #94a3b8 15%, #475569 15%, #475569 20%)' },
    'utility_vision': { id: 'utility_vision', name: 'Vision Panel (Utility)', icon: 'linear-gradient(90deg, #64748b 0%, #64748b 40%, #bae6fd 40%, #bae6fd 60%, #64748b 60%, #64748b 100%)' },
    'classic_4_horizontal': { id: 'classic_4_horizontal', name: 'Classic 4-Panel (Horiz)', icon: 'repeating-linear-gradient(180deg, #64748b, #64748b 20%, #475569 20%, #475569 25%)' },
    'classic_2_panel': { id: 'classic_2_panel', name: 'Classic 2-Panel', icon: 'linear-gradient(180deg, #64748b 0%, #64748b 60%, #475569 60%, #475569 65%, #64748b 65%, #64748b 100%)' },
    'classic_4_panel': { id: 'classic_4_panel', name: 'Classic 4-Panel', icon: 'conic-gradient(at 50% 50%, #64748b 25%, #475569 25%, #475569 50%, #64748b 50%, #64748b 75%, #475569 75%)' },
    'grid_panel': { id: 'grid_panel', name: 'Grid Panel', icon: 'repeating-conic-gradient(#64748b 0% 25%, #475569 0% 50%) 50% / 10px 10px' },
    'glass_bottom_panel': { id: 'glass_bottom_panel', name: 'Glass & Bottom Panel', icon: 'linear-gradient(180deg, #bae6fd 0%, #bae6fd 70%, #64748b 70%, #64748b 100%)' },
    'glass_grid': { id: 'glass_grid', name: 'Glass with Grid', icon: 'repeating-linear-gradient(90deg, #bae6fd, #bae6fd 40%, #1e293b 40%, #1e293b 60%, #bae6fd 60%, #bae6fd 100%)' },
    'entry_grand_panel': { id: 'entry_grand_panel', name: 'Grand Entry (Main)', icon: 'repeating-conic-gradient(#a0522d 0% 25%, #8b4513 0% 50%) 50% / 10px 10px' },
    'entry_modern_slit': { id: 'entry_modern_slit', name: 'Modern Slit Pivot (Main)', icon: 'linear-gradient(90deg, #64748b 0%, #64748b 70%, #bae6fd 70%, #bae6fd 75%, #64748b 75%, #64748b 100%)' },
    'entry_craftsman': { id: 'entry_craftsman', name: 'Craftsman Entry (Main)', icon: 'repeating-linear-gradient(180deg, #bae6fd, #bae6fd 20%, #475569 20%, #475569 30%, #64748b 30%, #64748b 100%)' }
};

export const DOOR_SHAPES_REGISTRY = {
    'square': { id: 'square', name: 'Square Top' },
    'radius': { id: 'radius', name: 'Radius Arch' },
    'segment': { id: 'segment', name: 'Segment Arch' },
    'gothic': { id: 'gothic', name: 'Gothic Arch' }
};

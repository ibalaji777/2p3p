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
    'entry_craftsman': { id: 'entry_craftsman', name: 'Craftsman Entry (Main)', icon: 'repeating-linear-gradient(180deg, #bae6fd, #bae6fd 20%, #475569 20%, #475569 30%, #64748b 30%, #64748b 100%)' },
    'back_half_lite': { id: 'back_half_lite', name: 'Half-Lite (Back Door)', icon: 'linear-gradient(180deg, #bae6fd 0%, #bae6fd 50%, #475569 50%, #475569 100%)' },
    'back_dutch': { id: 'back_dutch', name: 'Dutch Stable Door', icon: 'linear-gradient(180deg, #64748b 0%, #64748b 48%, #1e293b 48%, #1e293b 52%, #64748b 52%, #64748b 100%)' },
    'service_steel_flush': { id: 'service_steel_flush', name: 'Steel Flush (Service)', icon: 'linear-gradient(180deg, #94a3b8 0%, #64748b 80%, #334155 80%, #334155 100%)' },
    'service_louvered': { id: 'service_louvered', name: 'Full Louver (Service)', icon: 'repeating-linear-gradient(180deg, #64748b, #64748b 3px, #1e293b 3px, #1e293b 6px)' },
    'garage_sectional': { id: 'garage_sectional', name: 'Sectional Overhead (Garage)', icon: 'repeating-linear-gradient(180deg, #cbd5e1 0%, #cbd5e1 22%, #475569 22%, #475569 25%)' },
    'garage_modern_glass': { id: 'garage_modern_glass', name: 'Modern Glass Grid (Garage)', icon: 'repeating-conic-gradient(#bae6fd 0% 25%, #334155 0% 50%) 50% / 20px 15px' },
    'garage_carriage': { id: 'garage_carriage', name: 'Carriage House (Garage)', icon: 'linear-gradient(45deg, #a0522d 25%, transparent 25%), linear-gradient(-45deg, #a0522d 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #a0522d 75%), linear-gradient(-45deg, transparent 75%, #a0522d 75%)' },
    'patio_multi_slide': { id: 'patio_multi_slide', name: 'Multi-Slide Glass (Patio)', icon: 'repeating-linear-gradient(90deg, #38bdf8 0%, #38bdf8 30%, #0f172a 30%, #0f172a 33%)' },
    'patio_bifold': { id: 'patio_bifold', name: 'Bi-Fold Accordion (Patio)', icon: 'repeating-linear-gradient(90deg, #bae6fd 0%, #bae6fd 22%, #334155 22%, #334155 25%)' },
    'gate_slat_modern': { id: 'gate_slat_modern', name: 'Horizontal Slat (Main Gate)', icon: 'repeating-linear-gradient(180deg, #334155 0%, #334155 12px, #0f172a 12px, #0f172a 16px)' },
    'gate_wrought_iron': { id: 'gate_wrought_iron', name: 'Wrought Iron (Main Gate)', icon: 'repeating-linear-gradient(90deg, #1e293b 0%, #1e293b 4px, transparent 4px, transparent 16px)' },
    'gate_pedestrian_wicket': { id: 'gate_pedestrian_wicket', name: 'Pedestrian Wicket Gate', icon: 'repeating-linear-gradient(90deg, #334155 0%, #334155 3px, transparent 3px, transparent 12px)' },
    'gate_driveway_sliding': { id: 'gate_driveway_sliding', name: 'Sliding Driveway Gate', icon: 'repeating-linear-gradient(90deg, #1e293b 0%, #1e293b 4px, #64748b 4px, #64748b 14px)' },
    'gate_garden_picket': { id: 'gate_garden_picket', name: 'Garden Picket Gate', icon: 'repeating-linear-gradient(90deg, #f8fafc 0%, #f8fafc 8px, #cbd5e1 8px, #cbd5e1 14px)' }
};

export const DOOR_SHAPES_REGISTRY = {
    'square': { id: 'square', name: 'Square Top' },
    'radius': { id: 'radius', name: 'Radius Arch' },
    'segment': { id: 'segment', name: 'Segment Arch' }
};

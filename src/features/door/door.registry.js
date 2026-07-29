export const DOOR_TYPES = { single: { label: "Single Hinged Door" }, double: { label: "Double Door" }, sliding: { label: "Sliding Door" }, double_sliding: { label: "Double Sliding Door" }, folding: { label: "Folding / Bi-fold" }, pivot: { label: "Pivot Door" }, pocket: { label: "Pocket Door" }, french: { label: "French Door (Glass)" } };

export const DOOR_MATERIALS = {
    wood: { label: "White Oak", color: 0xc4a482, roughness: 0.6, metalness: 0.05, texture: 'textures/wood/wood_golden_teak.png', bumpScale: 0.005, clearcoat: 0.05 },
    steel: { label: "Brushed Steel", color: 0xa0a5aa, roughness: 0.35, metalness: 0.8, bumpScale: 0.005, clearcoat: 0.2 },
    glass: { label: "Double-Pane Glass", color: 0xeff6ff, roughness: 0.0, metalness: 0.1, transmission: 0.98, transparent: true, ior: 1.52, thickness: 3.0, clearcoat: 1.0 },
    aluminium: { label: "Aluminium", color: 0xc8cdd0, roughness: 0.4, metalness: 0.6 },
    pvc: { label: "Matte White", color: 0xfdfdfd, roughness: 0.7, metalness: 0.0, clearcoat: 0.0 },
    laminate: { label: "Charcoal Black", color: 0x2e2b2a, roughness: 0.4, metalness: 0.1, texture: 'textures/wood/wood_dark_walnut.png', bumpScale: 0.002, clearcoat: 0.1 }
};

export const DOOR_MATERIALS_REGISTRY = {
    // 🪵 5 Photorealistic Wood Species (Unique HD Texture Maps)
    'wood_golden_teak': {
        id: 'wood_golden_teak',
        name: 'Natural Burmese Golden Teak',
        texture: 'textures/wood/wood_golden_teak.png',
        thumbnail: 'textures/wood/wood_golden_teak.png',
        roughness: 0.55, bumpScale: 0.005,
        defaultWidth: 100, defaultHeight: 100, defaultDepth: 0.2, defaultRepeat: 1, scaleMultiplier: 1
    },
    'wood_dark_walnut': {
        id: 'wood_dark_walnut',
        name: 'Solid Dark American Walnut',
        texture: 'textures/wood/wood_dark_walnut.png',
        thumbnail: 'textures/wood/wood_dark_walnut.png',
        roughness: 0.5, bumpScale: 0.005,
        defaultWidth: 100, defaultHeight: 100, defaultDepth: 0.2, defaultRepeat: 1, scaleMultiplier: 1
    },
    'wood_white_oak': {
        id: 'wood_white_oak',
        name: 'Natural White American Oak',
        texture: 'textures/wood/wood_white_oak.png',
        thumbnail: 'textures/wood/wood_white_oak.png',
        roughness: 0.6, bumpScale: 0.005,
        defaultWidth: 100, defaultHeight: 100, defaultDepth: 0.2, defaultRepeat: 1, scaleMultiplier: 1
    },
    'wood_mahogany': {
        id: 'wood_mahogany',
        name: 'Heritage Red Mahogany',
        texture: 'textures/wood/wood_mahogany.png',
        thumbnail: 'textures/wood/wood_mahogany.png',
        roughness: 0.45, bumpScale: 0.005,
        defaultWidth: 100, defaultHeight: 100, defaultDepth: 0.2, defaultRepeat: 1, scaleMultiplier: 1
    },
    'wood_wenge': {
        id: 'wood_wenge',
        name: 'Deep Ebony Wenge Timber',
        texture: 'textures/wood/wood_wenge.png',
        thumbnail: 'textures/wood/wood_wenge.png',
        roughness: 0.4, bumpScale: 0.005,
        defaultWidth: 100, defaultHeight: 100, defaultDepth: 0.2, defaultRepeat: 1, scaleMultiplier: 1
    },

    // Backward compatibility aliases
    'door_indian_1': {
        id: 'door_indian_1', name: 'Indian Carved Wood', texture: 'textures/wood/wood_golden_teak.png', thumbnail: 'textures/wood/wood_golden_teak.png', isAlias: true
    },
    'door_indian_2': {
        id: 'door_indian_2', name: 'Dark Teak Door', texture: 'textures/wood/wood_dark_walnut.png', thumbnail: 'textures/wood/wood_dark_walnut.png', isAlias: true
    },
    'door_modern_1': {
        id: 'door_modern_1', name: 'Modern Panel', texture: 'textures/wood/wood_white_oak.png', thumbnail: 'textures/wood/wood_white_oak.png', isAlias: true
    }
};

export const DOOR_STYLES_REGISTRY = {
    'flat': { id: 'flat', name: 'Flat Panel', icon: 'solid #64748b' },
    'classic_4_horizontal': { id: 'classic_4_horizontal', name: 'Classic 4-Panel (Horiz)', icon: 'repeating-linear-gradient(180deg, #64748b, #64748b 20%, #475569 20%, #475569 25%)' },
    'classic_2_panel': { id: 'classic_2_panel', name: 'Classic 2-Panel', icon: 'linear-gradient(180deg, #64748b 0%, #64748b 60%, #475569 60%, #475569 65%, #64748b 65%, #64748b 100%)' },
    'classic_4_panel': { id: 'classic_4_panel', name: 'Classic 4-Panel', icon: 'conic-gradient(at 50% 50%, #64748b 25%, #475569 25%, #475569 50%, #64748b 50%, #64748b 75%, #475569 75%)' },
    'grid_panel': { id: 'grid_panel', name: 'Grid Panel', icon: 'repeating-conic-gradient(#64748b 0% 25%, #475569 0% 50%) 50% / 10px 10px' },
    'glass_bottom_panel': { id: 'glass_bottom_panel', name: 'Glass & Bottom Panel', icon: 'linear-gradient(180deg, #bae6fd 0%, #bae6fd 70%, #64748b 70%, #64748b 100%)' },
    'glass_grid': { id: 'glass_grid', name: 'Glass with Grid', icon: 'repeating-linear-gradient(90deg, #bae6fd, #bae6fd 40%, #1e293b 40%, #1e293b 60%, #bae6fd 60%, #bae6fd 100%)' }
};

export const DOOR_SHAPES_REGISTRY = {
    'square': { id: 'square', name: 'Square Top' },
    'radius': { id: 'radius', name: 'Radius Arch' },
    'segment': { id: 'segment', name: 'Segment Arch' },
    'gothic': { id: 'gothic', name: 'Gothic Arch' }
};

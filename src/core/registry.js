import Konva from 'konva';
import * as THREE from 'three';

export const GRID = 20;
export const PX_TO_FT = 1 / GRID;
export const WALL_HEIGHT = 120;
export const DOOR_HEIGHT = 80;
export const WINDOW_SILL = 35;
export const WINDOW_HEIGHT = 45;
export const SNAP_DIST = 25; 

export const WORKSPACE_2D_SHAPES = {
    'couch': "M 5 5 L 95 5 L 95 95 L 5 95 Z M 20 30 L 80 30 L 80 95 L 20 95 Z M 20 30 L 20 5 M 80 30 L 80 5 M 40 30 L 40 95 M 60 30 L 60 95",
    'chair': "M 15 15 L 85 15 L 85 85 L 15 85 Z M 25 35 L 75 35 L 75 85 L 25 85 Z M 25 35 L 25 15 M 75 35 L 75 15 M 40 15 L 40 35 M 50 15 L 50 35 M 60 15 L 60 35",
    'table_dining': "M 20 25 L 80 25 L 80 75 L 20 75 Z M 25 10 L 40 10 L 40 20 L 25 20 Z M 60 10 L 75 10 L 75 20 L 60 20 Z M 25 80 L 40 80 L 40 90 L 25 90 Z M 60 80 L 75 80 L 75 90 L 60 90 Z M 5 40 L 15 40 L 15 60 L 5 60 Z M 85 40 L 95 40 L 95 60 L 85 60 Z",
    'bed': "M 5 5 L 95 5 L 95 95 L 5 95 Z M 5 25 L 95 25 M 15 10 L 40 10 L 40 20 L 15 20 Z M 60 10 L 85 10 L 85 20 L 60 20 Z M 5 35 L 95 35",
    'tv_unit': "M 10 30 L 90 30 L 90 70 L 10 70 Z M 15 35 L 85 35 L 85 65 L 15 65 Z",
    'default': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 0 0 L 100 100 M 100 0 L 0 100"
};

export const DOOR_TYPES = { single: { label: "Single Hinged Door" }, double: { label: "Double Door" }, sliding: { label: "Sliding Door" }, double_sliding: { label: "Double Sliding Door" }, folding: { label: "Folding / Bi-fold" }, pivot: { label: "Pivot Door" }, pocket: { label: "Pocket Door" }, french: { label: "French Door (Glass)" } };
export const WINDOW_TYPES = { sliding_std: { label: "Standard Sliding Window", type: "sliding", hasChajja: false }, casement_std: { label: "Casement / Hinged Window", type: "casement", hasChajja: false }, casement_chajja: { label: "Window with Concrete Sunshade", type: "casement", hasChajja: true }, fixed_elevation: { label: "Fixed Elevation Glass", type: "fixed", hasChajja: false }, modern_split: { label: "Modern Asymmetric", type: "split_asymmetric", hasChajja: false }, bay_box: { label: "Box Bay Window (Villa Style)", type: "bay", hasChajja: true }, window_seat: { label: "Double Picture Window", type: "window_seat", hasChajja: false }, garden_open: { label: "Open Garden Window", type: "garden_open", hasChajja: true }, panoramic_slider: { label: "Panoramic Slider", type: "panoramic_slider", hasChajja: false }, shutter_double: { label: "Double Louvered Shutter", type: "shutter_double", hasChajja: false }, louver_vent: { label: "Vent / Louver (Bathroom)", type: "louver", hasChajja: false }, traditional_indian: { label: "Traditional Wooden Shutter", type: "traditional", hasChajja: true } };


export const DOOR_MATERIALS = {
    wood: { label: "White Oak", color: 0xc4a482, roughness: 0.6, metalness: 0.05, texture: 'wood', bumpScale: 0.005, clearcoat: 0.05 },
    steel: { label: "Brushed Steel", color: 0xa0a5aa, roughness: 0.35, metalness: 0.8, texture: 'brushed', bumpScale: 0.005, clearcoat: 0.2 },
    glass: { label: "Double-Pane Glass", color: 0xeff6ff, roughness: 0.0, metalness: 0.1, transmission: 0.98, transparent: true, ior: 1.52, thickness: 3.0, clearcoat: 1.0 },
    aluminium: { label: "Aluminium", color: 0xc8cdd0, roughness: 0.4, metalness: 0.6, texture: 'solid' },
    pvc: { label: "Matte White", color: 0xfdfdfd, roughness: 0.7, metalness: 0.0, texture: 'solid', clearcoat: 0.0 },
    laminate: { label: "Charcoal Black", color: 0x2e2b2a, roughness: 0.4, metalness: 0.1, texture: 'wood', bumpScale: 0.002, clearcoat: 0.1 }
};

export const WINDOW_FRAME_MATERIALS = { upvc_white: { label: "White uPVC", color: 0xffffff, roughness: 0.8, metalness: 0.0, texture: 'solid' }, upvc_wood: { label: "Wood Finish uPVC", color: 0x8b5a2b, roughness: 0.7, metalness: 0.0, texture: 'wood', bumpScale: 0.005 }, alum_powder: { label: "Powder Coated Alum (Black)", color: 0x1f1f1f, roughness: 0.5, metalness: 0.6, texture: 'solid' }, wood_teak: { label: "Teak Wood", color: 0x6b4226, roughness: 0.6, metalness: 0.1, texture: 'wood', bumpScale: 0.005 }, steel_ms: { label: "MS Steel Frame", color: 0x222222, roughness: 0.4, metalness: 0.9, texture: 'solid' } };
export const WINDOW_GLASS_MATERIALS = { clear: { label: "Clear Glass", color: 0xeff6ff, transmission: 0.95, roughness: 0.0, ior: 1.5, transparent: true }, frosted: { label: "Frosted / Privacy Glass", color: 0xffffff, transmission: 0.5, roughness: 0.5, ior: 1.4, transparent: true }, tinted: { label: "Tinted Glass (Dark)", color: 0x222222, transmission: 0.85, roughness: 0.0, ior: 1.5, transparent: true }, reflective: { label: "Reflective / Mirror", color: 0xaaaaaa, transmission: 0.3, roughness: 0.0, metalness: 1.0, ior: 2.0, transparent: true } };

export const JALI_PATTERNS = {
    geometric: { label: "Geometric Lattice" },
    islamic: { label: "Islamic Star" },
    modern: { label: "Modern Slats" },
    kolam: { label: "Kolam (Rangoli)", texture: 'textures/jali/kolam.png' },
    lotus: { label: "Lotus Motif", texture: 'textures/jali/lotus.png' },
    peacock: { label: "Peacock (Mayil)", texture: 'textures/jali/peacock.png' },
    gopuram: { label: "Temple Gopuram", texture: 'textures/jali/gopuram.png' },
    ventilation: { label: "Geometric Vent Block", texture: 'textures/jali/ventilation.png' },
    mango: { label: "Mango Paisley Vine", texture: 'textures/jali/mango.png' },
    chettinad: { label: "Chettinad Wooden Jali", texture: 'textures/jali/chettinad.png' }
};

export const JALI_MATERIALS = {
    wood: { label: "Teak Wood", color: 0x6b4226, roughness: 0.4, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.1, texture: 'wood' },
    mdf: { label: "White Painted MDF", color: 0xfdfdfd, roughness: 0.3, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.1, texture: 'solid' },
    brass: { label: "Brass Finish", color: 0xb5a642, roughness: 0.2, metalness: 0.9, clearcoat: 0.5, clearcoatRoughness: 0.1, texture: 'solid' },
    wpc: { label: "WPC (Wood Plastic)", color: 0x8b5a2b, roughness: 0.5, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.2, texture: 'wood' },
    stone: { label: "Sandstone", color: 0xd2b48c, roughness: 0.9, metalness: 0, clearcoat: 0, clearcoatRoughness: 0, texture: 'solid' },
    metal_black: { label: "Matte Black Metal", color: 0x1a1a1a, roughness: 0.4, metalness: 0.8, clearcoat: 0.1, clearcoatRoughness: 0.2, texture: 'solid' }
};
export const WINDOW_GRILLE_PATTERNS = { grid: { label: "Standard Grid" }, horizontal: { label: "Horizontal Bars" }, vertical: { label: "Vertical Bars" }, diamond: { label: "Diamond Pattern" }, none: { label: "No Safety Grille" } };

// Outer wall is thicker (16), Inner wall is less thick (8)
export const WALL_REGISTRY = {
    'outer': { type: "outer", label: "OUTER WALL", thickness: 16, height: 120, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] },
    'inner': { type: "inner", label: "INNER WALL", thickness: 8, height: 120, events: ["proximity_highlight", "snap_preview", "snap_to_wall", "collision_detected", "stop_collision"] },
    'railing': { type: "railing", label: "RAILING", thickness: 4, height: 0, events: ["proximity_highlight", "snap_preview", "snap_to_wall"] }
};

export const MOLDING_REGISTRY = {
    'molding_band': { type: 'molding_band', label: 'Horizontal Band', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 3, heightOffset: 50, profileType: 'flat', material: 'white_paint', color: '#ffffff' } },
    'molding_crown': { type: 'molding_crown', label: 'Crown Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 5, heightOffset: 110, profileType: 'crown', material: 'white_paint', color: '#ffffff' } },
    'molding_ogee': { type: 'molding_ogee', label: 'Ogee (Cyma) Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 6, heightOffset: 110, profileType: 'ogee', material: 'white_paint', color: '#ffffff' } },
    'molding_egg_and_dart': { type: 'molding_egg_and_dart', label: 'Egg and Dart Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 6, heightOffset: 110, profileType: 'egg_and_dart', material: 'white_paint', color: '#ffffff' } },
    'molding_dentil': { type: 'molding_dentil', label: 'Dentil Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 6, heightOffset: 110, profileType: 'dentil', material: 'white_paint', color: '#ffffff' } },
    'molding_craftsman': { type: 'molding_craftsman', label: 'Step / Craftsman Molding', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 6, heightOffset: 110, profileType: 'craftsman', material: 'white_paint', color: '#ffffff' } },
    'molding_window': { type: 'molding_window', label: 'Window Frame', events: ['snap_to_wall', 'drag_along_wall'], defaultConfig: { width: 45, depth: 4, heightOffset: 35, profileType: 'frame', material: 'white_paint', color: '#ffffff', frameWidth: 5 } },
    'molding_door': { type: 'molding_door', label: 'Door Frame', events: ['snap_to_wall', 'drag_along_wall'], defaultConfig: { width: 40, depth: 4, heightOffset: 0, profileType: 'frame', material: 'white_paint', color: '#ffffff', frameWidth: 5 } },
    'molding_groove': { type: 'molding_groove', label: 'Decorative Groove', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: -2, heightOffset: 50, profileType: 'groove', material: 'wall_material', color: '#000000', grooveWidth: 2 } },
    'molding_layered': { type: 'molding_layered', label: 'Layered Projection', events: ['snap_to_wall', 'drag_along_wall', 'resize_handles_along_wall_axis'], defaultConfig: { width: 50, depth: 5, heightOffset: 50, profileType: 'layered', material: 'white_paint', color: '#ffffff', layers: 3, layerGap: 1 } }
};

export const RAILING_REGISTRY = {
    'default_basic': {
        id: 'default_basic', name: 'Basic Glass (Default)', type: 'railing',
        model: 'models/railing/rail_1.obj',
        color: 0x88ccff, transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.1,
        thumbnail: 'https://via.placeholder.com/150/88ccff/000000?text=Basic'
    },
    'rail_1': {
        id: 'rail_1', name: 'Railing Type 1', type: 'railing',
        model: 'models/railing/rail_1.obj',
        color: 0x88ccff, transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.1,
        thumbnail: 'https://via.placeholder.com/150/88ccff/000000?text=Glass'
    },
    'rail_2': {
        id: 'rail_2', name: 'Railing Type 2', type: 'railing',
        model: 'models/railing/rail_2.obj',
        texture: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
        thumbnail: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
        roughness: 0.8, repeat: 1
    },
    'rail_3': {
        id: 'rail_3', name: 'Railing Type 3', type: 'railing',
        model: 'models/railing/rail_3.obj',
        color: 0x444444, metalness: 0.8, roughness: 0.3,
        thumbnail: 'https://via.placeholder.com/150/444444/ffffff?text=Metal'
    }
};

// --- PNG WALL PATTERNS REGISTRY ---
export const DOOR_MATERIALS_REGISTRY = {
    'door_indian_1': {
        id: 'door_indian_1',
        name: 'Indian Carved Wood',
        texture: 'models/wall/wood_1_light.png', 
        thumbnail: 'models/wall/wood_1_light.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 1,
        scaleMultiplier: 1
    },
    'door_indian_2': {
        id: 'door_indian_2',
        name: 'Dark Teak Door',
        texture: 'models/wall/wood_2_dark.png', 
        thumbnail: 'models/wall/wood_2_dark.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 1,
        scaleMultiplier: 1
    },
    'door_modern_1': {
        id: 'door_modern_1',
        name: 'Modern Panel',
        texture: 'models/wall/marble_1_white.png', 
        thumbnail: 'models/wall/marble_1_white.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 1,
        scaleMultiplier: 1
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

export const WALL_DECOR_REGISTRY = {
    'brick_wall': {
        id: 'brick_wall',
        name: 'Red Bricks',
        texture: 'models/wall/redbrick.png', 
        // texture: 'https://threejs.org/examples/textures/brick_diffuse.jpg', 
        thumbnail: 'https://threejs.org/examples/textures/brick_diffuse.jpg', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2, // Reference Code logic
        defaultRepeat: 3   // Reference Code logic
    },
    'brick_1_orange': {
        id: 'brick_1_orange',
        name: 'Orange Textured Brick',
        texture: 'models/wall/brick_1_orange.png', 
        thumbnail: 'models/wall/brick_1_orange.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_2_mixed': {
        id: 'brick_2_mixed',
        name: 'Mixed Brown Brick',
        texture: 'models/wall/brick_2_mixed.png', 
        thumbnail: 'models/wall/brick_2_mixed.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_3_red': {
        id: 'brick_3_red',
        name: 'Classic Red Brick',
        texture: 'models/wall/brick_3_red.png', 
        thumbnail: 'models/wall/brick_3_red.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_4_burgundy': {
        id: 'brick_4_burgundy',
        name: 'Dark Burgundy Brick',
        texture: 'models/wall/brick_4_burgundy.png', 
        thumbnail: 'models/wall/brick_4_burgundy.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_5_cream': {
        id: 'brick_5_cream',
        name: 'Cream Sand Brick',
        texture: 'models/wall/brick_5_cream.png', 
        thumbnail: 'models/wall/brick_5_cream.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_6_beige': {
        id: 'brick_6_beige',
        name: 'Light Beige Brick',
        texture: 'models/wall/brick_6_beige.png', 
        thumbnail: 'models/wall/brick_6_beige.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_7_yellow': {
        id: 'brick_7_yellow',
        name: 'Yellow Ochre Brick',
        texture: 'models/wall/brick_7_yellow.png', 
        thumbnail: 'models/wall/brick_7_yellow.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_8_white': {
        id: 'brick_8_white',
        name: 'White Grey Brick',
        texture: 'models/wall/brick_8_white.png', 
        thumbnail: 'models/wall/brick_8_white.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_9_grey': {
        id: 'brick_9_grey',
        name: 'Grey Brown Brick',
        texture: 'models/wall/brick_9_grey.png', 
        thumbnail: 'models/wall/brick_9_grey.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'stone_wall': {
        id: 'stone_wall',
        name: 'Premium Stone',
        texture: 'models/wall/stone.png',
        thumbnail: 'models/wall/stone.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'marble_tiles': {
        id: 'marble_tiles',
        name: 'Premium Marble',
        texture: 'models/wall/marble.png',
        thumbnail: 'models/wall/marble.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'wood_panel': {
        id: 'wood_panel',
        name: 'Wood Panels',
        texture: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg', 
        thumbnail: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2, 
        defaultRepeat: 3   
    }
};

export const SKY_REGISTRY = {
    'arch_viz_sunny': {
        id: 'arch_viz_sunny',
        name: 'Vibrant Sunny',
        type: 'color',
        skyColor: 0x5dade2,
        fogColor: 0xe0eaf5,
        hemiSky: 0xffffff,
        hemiGround: 0x4ade80,
        sunColor: 0xffffee,
        ambient: 0.3,
        hemi: 0.8,
        sun: 2.5
    },
    'cloudy_day': {
        id: 'cloudy_day',
        name: 'Realistic Cloudy',
        type: 'hdri',
        url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/jpg/1k/cloudy_sky_1k.jpg',
        sunColor: 0xffffff,
        ambient: 0.7,
        hemi: 0.6,
        sun: 1.8
    }
};

export const FLOOR_REGISTRY = {
    'hardwood': {
        id: 'hardwood', name: 'Hardwood Floor', type: 'floor',
        texture: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
        thumbnail: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
        roughness: 0.6, repeat: 5
    },
    'tiles': {
        id: 'tiles', name: 'Ceramic Tiles', type: 'floor',
        texture: 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg', // Placeholder tile
        thumbnail: 'https://via.placeholder.com/150/ffffff/000000?text=Tiles',
        color: 0xcccccc, roughness: 0.2, repeat: 10
    },
    'carpet': {
        id: 'carpet', name: 'Soft Carpet', type: 'floor',
        color: 0x8b5a2b, roughness: 0.9,
        thumbnail: 'https://via.placeholder.com/150/8b5a2b/fff?text=Carpet'
    }
};

export const GROUND_REGISTRY = {
    'grid': {
        id: 'grid', name: 'Blueprint Grid', type: 'grid', color: 0x9aa297,
        thumbnail: 'https://via.placeholder.com/150/9aa297/fff?text=Grid'
    },
    'grass': {
        id: 'grass', name: 'Lush Grass', type: 'terrain',
        texture: 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
        thumbnail: 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
        normal: 'https://threejs.org/examples/textures/water/Water_1_M_Normal.jpg',
        repeat: 200, roughness: 1.0, normalScale: 1.0, terrainHeight: 15
    },
    'dark_soil': {
        id: 'dark_soil', name: 'Dark Soil', type: 'terrain',
        texture: 'assets/ground/soil.jpg',
        thumbnail: 'assets/ground/soil.jpg',
        normal: 'https://threejs.org/examples/textures/water/Water_1_M_Normal.jpg',
        repeat: 200, roughness: 1.0, normalScale: 1.2, terrainHeight: 18
    },
    'sand': {
        id: 'sand', name: 'Sand Terrain', type: 'terrain',
        texture: 'https://cdn.renderhub.com/eagle-soft/ground-terrain-gravel-pbr-texture/ground-terrain-gravel-pbr-texture-01.jpg',
        thumbnail: 'https://cdn.renderhub.com/eagle-soft/ground-terrain-gravel-pbr-texture/ground-terrain-gravel-pbr-texture-01.jpg',
        normal: 'https://threejs.org/examples/textures/water/Water_1_M_Normal.jpg',
        repeat: 200, roughness: 1.0, normalScale: 0.8, terrainHeight: 10
    }
};

export const ROOF_DECOR_REGISTRY = {
    'asphalt_shingles': {
        id: 'asphalt_shingles',
        name: 'Dark Shingles',
        texture: 'models/wall/redbrick.png', 
         thumbnail:'models/wall/redbrick.png',
        repeat: 2
    },
    'concrete_flat': {
        id: 'concrete_flat',
        name: 'Concrete Flat',
        texture: 'https://via.placeholder.com/512x512/d1d5db/d1d5db', 
        thumbnail: 'https://via.placeholder.com/150/d1d5db/000?text=Concrete', 
        repeat: 1
    }
};

export const FURNITURE_REGISTRY = {
      'couch_1': {
        id: 'couch_1',
        name: 'Ekero couch',
        model: 'models/chairs_couch/couch.glb', 
        texture: 'textures/ik-ekero-orange_baked.png',
        preview: 'https://via.placeholder.com/150/FF8C00/FFFFFF?text=Chair', 
        default: { width: 40, height: 50, depth: 40 }, 
        editable: { resize: true, rotation: true, move: true },
        shape2D: 'couch'
    },
    'chair_ekero': {
        id: 'chair_ekero',
        name: 'Ekero Chair',
        model: 'models/chair_ekero.glb', 
        texture: 'textures/ik-ekero-orange_baked.png',
        preview: 'https://via.placeholder.com/150/FF8C00/FFFFFF?text=Chair', 
        default: { width: 40, height: 50, depth: 40 }, 
        editable: { resize: true, rotation: true, move: true },
        shape2D: 'chair'
    },
    'table_dining': {
        id: 'table_dining',
        name: 'Dining Table',
        model: 'models/table_dining.glb',
        preview: 'https://via.placeholder.com/150/8B4513/FFFFFF?text=Table',
        default: { width: 100, height: 40, depth: 60 },
        editable: { resize: true, rotation: true, move: true },
        shape2D: 'table_dining'
    }
};

export const createDoorShape = (w, h, type = 'square') => {
    const shape = new THREE.Shape();
    const hw = w / 2;
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    
    if (type === 'radius') {
        const straightH = Math.max(0, h - hw);
        shape.lineTo(hw, straightH);
        if (hw > 0) shape.absarc(0, straightH, hw, 0, Math.PI, false);
    } else if (type === 'segment') {
        const rise = w * 0.15;
        const straightH = Math.max(0, h - rise);
        shape.lineTo(hw, straightH);
        shape.quadraticCurveTo(0, h + rise*0.5, -hw, straightH);
    } else if (type === 'gothic') {
        const straightH = Math.max(0, h - (w * 0.7));
        shape.lineTo(hw, straightH);
        shape.quadraticCurveTo(hw * 0.2, h, 0, h);
        shape.quadraticCurveTo(-hw * 0.2, h, -hw, straightH);
    } else {
        shape.lineTo(hw, h);
        shape.lineTo(-hw, h);
    }
    shape.lineTo(-hw, 0);
    return shape;
};

function buildDetailedDoorPanel(entity, width, height, thickness, material, type, isGlass, signX = 1, helpers) {
    const mats = (helpers && helpers.getFaceMaterials) ? helpers.getFaceMaterials(entity, material, { width, height, thick: thickness }).box : material;
    const group = new THREE.Group(); const gap = 0.2; 
    const style = entity && entity.doorStyle ? entity.doorStyle : 'flat';
    
    if (style === 'glass_bottom_panel') {
        const frameW = 3.5; const topRailH = 3.5; const botRailH = height * 0.28;
        const geoStile = new THREE.BoxGeometry(frameW, height, thickness); const geoRailT = new THREE.BoxGeometry(width - frameW*2, topRailH, thickness); const geoRailB = new THREE.BoxGeometry(width - frameW*2, botRailH, thickness);
        const stileL = new THREE.Mesh(geoStile, mats); stileL.position.set(-width/2 + frameW/2, height/2, 0); const stileR = new THREE.Mesh(geoStile, mats); stileR.position.set(width/2 - frameW/2, height/2, 0);
        const railT = new THREE.Mesh(geoRailT, mats); railT.position.set(0, height - topRailH/2, 0); const railB = new THREE.Mesh(geoRailB, mats); railB.position.set(0, botRailH/2, 0);
        [stileL, stileR, railT, railB].forEach(m => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
        
        const grooveGeo = new THREE.BoxGeometry(width - frameW*2, 0.4, thickness + 0.1);
        const groove1 = new THREE.Mesh(grooveGeo, mats); groove1.position.set(0, botRailH * 0.4, 0); group.add(groove1);
        const groove2 = new THREE.Mesh(grooveGeo, mats); groove2.position.set(0, botRailH * 0.7, 0); group.add(groove2);

        const glassMat = helpers.getDynamicMaterial('glass', 'door'); const geoGlass = new THREE.BoxGeometry(width - frameW*2, height - topRailH - botRailH, thickness * 0.4);
        const glass = new THREE.Mesh(geoGlass, glassMat); glass.position.set(0, height/2 + (botRailH - topRailH)/2, 0); group.add(glass);
    } else if (style === 'glass_grid') {
        const frameW = 3.5; const topRailH = 3.5; const botRailH = 5;
        const geoStile = new THREE.BoxGeometry(frameW, height, thickness); const geoRailT = new THREE.BoxGeometry(width - frameW*2, topRailH, thickness); const geoRailB = new THREE.BoxGeometry(width - frameW*2, botRailH, thickness);
        const stileL = new THREE.Mesh(geoStile, mats); stileL.position.set(-width/2 + frameW/2, height/2, 0); const stileR = new THREE.Mesh(geoStile, mats); stileR.position.set(width/2 - frameW/2, height/2, 0);
        const railT = new THREE.Mesh(geoRailT, mats); railT.position.set(0, height - topRailH/2, 0); const railB = new THREE.Mesh(geoRailB, mats); railB.position.set(0, botRailH/2, 0);
        [stileL, stileR, railT, railB].forEach(m => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
        
        const mullionW = 1.5; const glassH = height - topRailH - botRailH; const glassW = width - frameW*2;
        const vMullionGeo = new THREE.BoxGeometry(mullionW, glassH, thickness);
        const vMullion = new THREE.Mesh(vMullionGeo, mats); vMullion.position.set(0, height/2 + (botRailH - topRailH)/2, 0); group.add(vMullion);
        
        const hMullionGeo = new THREE.BoxGeometry(glassW, mullionW, thickness);
        for (let i = 1; i <= 3; i++) {
            const hMullion = new THREE.Mesh(hMullionGeo, mats);
            hMullion.position.set(0, botRailH + (glassH / 4) * i, 0);
            group.add(hMullion);
        }

        const glassMat = helpers.getDynamicMaterial('glass', 'door'); const geoGlass = new THREE.BoxGeometry(glassW, glassH, thickness * 0.4);
        const glass = new THREE.Mesh(geoGlass, glassMat); glass.position.set(0, height/2 + (botRailH - topRailH)/2, 0); group.add(glass);
    } else if (isGlass || type === 'french') {
        const frameW = 3.5; const topRailH = 3.5; const botRailH = 5;
        const geoStile = new THREE.BoxGeometry(frameW, height, thickness); const geoRailT = new THREE.BoxGeometry(width - frameW*2, topRailH, thickness); const geoRailB = new THREE.BoxGeometry(width - frameW*2, botRailH, thickness);
        const stileL = new THREE.Mesh(geoStile, mats); stileL.position.set(-width/2 + frameW/2, height/2, 0); const stileR = new THREE.Mesh(geoStile, mats); stileR.position.set(width/2 - frameW/2, height/2, 0);
        const railT = new THREE.Mesh(geoRailT, mats); railT.position.set(0, height - topRailH/2, 0); const railB = new THREE.Mesh(geoRailB, mats); railB.position.set(0, botRailH/2, 0);
        [stileL, stileR, railT, railB].forEach(m => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
        const glassMat = helpers.getDynamicMaterial('glass', 'door'); const geoGlass = new THREE.BoxGeometry(width - frameW*2, height - topRailH - botRailH, thickness * 0.4);
        const glass = new THREE.Mesh(geoGlass, glassMat); glass.position.set(0, height/2 + (botRailH - topRailH)/2, 0); group.add(glass);
    } else {
        const shapeType = entity && entity.doorShape ? entity.doorShape : 'square';
        const doorOutline = createDoorShape(width, height, shapeType);
        const coreGeo = new THREE.ExtrudeGeometry(doorOutline, { depth: Math.max(0.01, thickness - 0.1), bevelEnabled: false });
        coreGeo.translate(0, 0, -Math.max(0.01, thickness - 0.1) / 2);
        
        const matsExtrude = Array.isArray(mats) ? [mats[4], mats[1]] : mats;
        const core = new THREE.Mesh(coreGeo, matsExtrude); core.position.set(0, 0, 0); core.castShadow = true; core.receiveShadow = true; group.add(core);
        
        const createBeveledPanelGeo = (pw, ph, pth, panelShape = 'square') => {
            const bSize = 0.12; const bThick = 0.06;
            const sw = Math.max(0.1, pw - bSize*2); const sh = Math.max(0.1, ph - bSize*2);
            
            const shape = new THREE.Shape();
            const hw = sw / 2;
            shape.moveTo(-hw, -sh/2); shape.lineTo(hw, -sh/2);
            
            if (panelShape === 'radius') {
                const straightH = (sh/2) - hw;
                shape.lineTo(hw, straightH);
                if (hw > 0) shape.absarc(0, straightH, hw, 0, Math.PI, false);
            } else if (panelShape === 'segment') {
                const rise = sw * 0.15;
                const straightH = (sh/2) - rise;
                shape.lineTo(hw, straightH);
                shape.quadraticCurveTo(0, sh/2 + rise*0.5, -hw, straightH);
            } else if (panelShape === 'gothic') {
                const straightH = (sh/2) - (sw * 0.7);
                shape.lineTo(hw, straightH);
                shape.quadraticCurveTo(hw * 0.2, sh/2, 0, sh/2);
                shape.quadraticCurveTo(-hw * 0.2, sh/2, -hw, straightH);
            } else {
                shape.lineTo(hw, sh/2);
                shape.lineTo(-hw, sh/2);
            }
            shape.lineTo(-hw, -sh/2);
            
            const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, pth - bThick*2), bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: bSize, bevelThickness: bThick });
            geo.translate(0, 0, -Math.max(0.01, pth - bThick*2)/2);
            return geo;
        };
        


        if (style === 'classic_4_horizontal') {
            const numPanels = 4; const panelHeight = (height - (gap * (numPanels - 1))) / numPanels; 
            for (let i = 0; i < numPanels; i++) { 
                const isTop = (i === numPanels - 1);
                const geoPanel = createBeveledPanelGeo(width - 0.6, panelHeight, thickness + 0.05, isTop ? shapeType : 'square'); 
                const p = new THREE.Mesh(geoPanel, matsExtrude); 
                const yPos = (panelHeight / 2) + i * (panelHeight + gap); 
                p.position.set(0, yPos, 0); p.castShadow = true; p.receiveShadow = true; group.add(p); 
            }
        } else if (style === 'classic_2_panel') {
            const topH = height * 0.65; const botH = height * 0.25; 
            const geoTop = createBeveledPanelGeo(width - 0.8, topH, thickness + 0.05, shapeType); const geoBot = createBeveledPanelGeo(width - 0.8, botH, thickness + 0.05, 'square');
            const pTop = new THREE.Mesh(geoTop, matsExtrude); pTop.position.set(0, height - topH/2 - gap, 0); pTop.castShadow = true; group.add(pTop);
            const pBot = new THREE.Mesh(geoBot, matsExtrude); pBot.position.set(0, botH/2 + gap*2, 0); pBot.castShadow = true; group.add(pBot);
        } else if (style === 'classic_4_panel') {
            const topH = height * 0.55; const botH = height * 0.3; const pw = width/2 - 0.4;
            const geoTop = createBeveledPanelGeo(pw, topH, thickness + 0.05, shapeType); const geoBot = createBeveledPanelGeo(pw, botH, thickness + 0.05, 'square');
            [-1, 1].forEach(side => {
                const xOff = (pw/2 + 0.15) * side;
                const pTop = new THREE.Mesh(geoTop, matsExtrude); pTop.position.set(xOff, height - topH/2 - gap, 0); pTop.castShadow = true; group.add(pTop);
                const pBot = new THREE.Mesh(geoBot, matsExtrude); pBot.position.set(xOff, botH/2 + gap*2, 0); pBot.castShadow = true; group.add(pBot);
            });
        } else if (style === 'grid_panel') {
            const rows = 5; const cols = 3; const pW = (width - gap*(cols+1))/cols; const pH = (height - gap*(rows+1))/rows;
            for (let r=0; r<rows; r++) {
                const isTop = (r === rows - 1);
                for (let c=0; c<cols; c++) {
                    const geoGrid = createBeveledPanelGeo(pW - 0.1, pH - 0.1, thickness + 0.05, isTop ? shapeType : 'square');
                    const p = new THREE.Mesh(geoGrid, matsExtrude);
                    const xPos = -width/2 + gap + pW/2 + c*(pW + gap);
                    const yPos = gap + pH/2 + r*(pH + gap);
                    p.position.set(xPos, yPos, 0); p.castShadow = true; group.add(p);
                }
            }
        }
    }
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 }); const silverMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.9, roughness: 0.15 }); const handleY = height * 0.45; 
    if (['sliding', 'double_sliding'].includes(type) && isGlass) {
        const handleGeo = new THREE.CylinderGeometry(0.35, 0.35, 30, 16); const standoffGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
        [-1, 1].forEach(side => { const zPos = side === 1 ? thickness/2 + 1.2 : -thickness/2 - 1.2; const pull = new THREE.Mesh(handleGeo, silverMat); pull.position.set((width/2 - 3) * signX, handleY, zPos); const so1 = new THREE.Mesh(standoffGeo, silverMat); so1.rotation.x = Math.PI/2; so1.position.set((width/2 - 3) * signX, handleY + 12, zPos - side*0.6); const so2 = new THREE.Mesh(standoffGeo, silverMat); so2.rotation.x = Math.PI/2; so2.position.set((width/2 - 3) * signX, handleY - 12, zPos - side*0.6); [pull, so1, so2].forEach(m => { m.castShadow = true; group.add(m); }); });
    } else if (['sliding', 'double_sliding', 'pocket'].includes(type)) {
        const flushGeo = new THREE.BoxGeometry(2, 10, 0.4); const pullF = new THREE.Mesh(flushGeo, metalMat); pullF.position.set((width/2 - 4) * signX, handleY, thickness/2 + 0.1); const pullB = new THREE.Mesh(flushGeo, metalMat); pullB.position.set((width/2 - 4) * signX, handleY, -thickness/2 - 0.1); [pullF, pullB].forEach(m => group.add(m));
    } else if (type === 'pivot') {
        const barGeo = new THREE.CylinderGeometry(0.5, 0.5, 24, 16); const standoffGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 8);
        [-1, 1].forEach(side => { const zPos = side === 1 ? thickness/2 + 1.5 : -thickness/2 - 1.5; const bar = new THREE.Mesh(barGeo, metalMat); bar.position.set((width/2 - 4) * signX, handleY, zPos); const so1 = new THREE.Mesh(standoffGeo, metalMat); so1.rotation.x = Math.PI/2; so1.position.set((width/2 - 4) * signX, handleY + 10, zPos - side); const so2 = new THREE.Mesh(standoffGeo, metalMat); so2.rotation.x = Math.PI/2; so2.position.set((width/2 - 4) * signX, handleY - 10, zPos - side); [bar, so1, so2].forEach(m => { m.castShadow = true; group.add(m); }); });
    } else if (type === 'folding_lead') { const pullGeo = new THREE.BoxGeometry(0.8, 14, thickness + 1.2); const pull = new THREE.Mesh(pullGeo, metalMat); pull.position.set((width/2 - 1.5) * -signX, handleY, 0); pull.castShadow = true; group.add(pull);
    } else if (['single', 'double', 'french'].includes(type)) {
        const rose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 6, thickness + 1.2), metalMat); rose.position.set((width/2 - 3.5) * signX, handleY, 0); const leverF = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 1.0), metalMat); leverF.position.set((width/2 - 5.5) * signX, handleY, thickness/2 + 0.9); const leverB = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 1.0), metalMat); leverB.position.set((width/2 - 5.5) * signX, handleY, -thickness/2 - 0.9); [rose, leverF, leverB].forEach(m => { m.castShadow = true; group.add(m); });
    }
    if (['single', 'double', 'french', 'folding_main'].includes(type) && signX !== 0) { const hingeGeo = new THREE.CylinderGeometry(0.2, 0.2, 4, 12); [height * 0.88, height * 0.5, height * 0.12].forEach(y => { const hinge = new THREE.Mesh(hingeGeo, metalMat); hinge.position.set((width/2) * -signX, y, thickness/2 + 0.2); hinge.castShadow = true; group.add(hinge); }); }
    return group;
}

export const WIDGET_REGISTRY = {
    'jali_panel': {
        widget: "jali_panel", label: "JALI PANEL",
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 40, height: 100, jaliPattern: 'geometric', jaliMat: 'wood', thick: 2, elevation: 0 },
        render2D: (group, entity) => {
            const hw = entity.width / 2; const thick = entity.wall ? (entity.wall.thickness || entity.wall.config.thickness) : (entity.thick || 4);
            const w = entity.width; const h = thick;
            const rect = new Konva.Rect({ x: -hw, y: -h/2, width: w, height: h, fill: 'transparent', stroke: '#d97706', strokeWidth: 2, dash: [4, 2] });
            group.add(rect);
            for(let i = -hw + 4; i < hw; i += 8) { group.add(new Konva.Line({ points: [i, -h/2, i+4, h/2], stroke: '#d97706', strokeWidth: 1 })); }
        },
        render3D: (sceneGroup, entity, helpers) => {
            let baseElev = entity.elevation || 0; let rawHeight = entity.height || 100;
            let bottomY = Math.max(0.2, baseElev); let topY = baseElev + rawHeight; let height = topY - bottomY;
            const jaliGroup = new THREE.Group(); jaliGroup.position.set(entity.x, bottomY, entity.z); jaliGroup.rotation.y = -entity.angle;
            
            const mount = entity.jaliMount || 'flush';
            if (mount === 'recessed') jaliGroup.translateZ(-4);
            if (mount === 'protruding') jaliGroup.translateZ(4);
            
            const matConfig = JALI_MATERIALS[entity.jaliMat || 'wood'];
            const matFrame = new THREE.MeshPhysicalMaterial({ 
                color: matConfig.color, 
                roughness: matConfig.roughness, 
                metalness: matConfig.metalness,
                clearcoat: matConfig.clearcoat || 0,
                clearcoatRoughness: matConfig.clearcoatRoughness || 0
            });
            let matExtrude = matFrame;
            let matBox = matFrame;
            if (helpers && helpers.getFaceMaterials) {
                const mm = helpers.getFaceMaterials(entity, matFrame, { width: entity.width, height: height });
                matExtrude = mm.extrude;
                matBox = mm.box;
            }
            const frameW = 2; const fThick = entity.thick || 2;
            const createBeveledFramePiece = (w, h) => {
                const shape = new THREE.Shape();
                shape.moveTo(-w/2, -h/2); shape.lineTo(w/2, -h/2); shape.lineTo(w/2, h/2); shape.lineTo(-w/2, h/2); shape.lineTo(-w/2, -h/2);
                const extrudeSettings = { depth: fThick, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.1, bevelThickness: 0.1 };
                const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geo.translate(0, 0, -fThick/2);
                return new THREE.Mesh(geo, matExtrude);
            };
            const sl = createBeveledFramePiece(frameW, height); sl.position.set(-entity.width/2 + frameW/2, height/2, 0);
            const sr = createBeveledFramePiece(frameW, height); sr.position.set(entity.width/2 - frameW/2, height/2, 0);
            const rt = createBeveledFramePiece(entity.width - frameW*2, frameW); rt.position.set(0, height - frameW/2, 0);
            const rb = createBeveledFramePiece(entity.width - frameW*2, frameW); rb.position.set(0, frameW/2, 0);
            [sl, sr, rt, rb].forEach(m => { m.castShadow = true; m.receiveShadow = true; jaliGroup.add(m); });
            const iW = entity.width - frameW*2; const iH = height - frameW*2; const lThick = fThick * 0.5;
            const latticeGroup = new THREE.Group(); latticeGroup.position.set(0, height/2, 0);
            
            if (['kolam', 'lotus', 'peacock', 'gopuram', 'ventilation', 'mango', 'chettinad'].includes(entity.jaliPattern)) {
                const targetStep = entity.jaliPatternSize || 20;
                const cols = Math.max(1, Math.round(iW / targetStep));
                const rows = Math.max(1, Math.round(iH / targetStep));
                const stepX = iW / cols; const stepY = iH / rows;
                
                const shape = new THREE.Shape();
                shape.moveTo(-stepX/2, -stepY/2); shape.lineTo(stepX/2, -stepY/2); shape.lineTo(stepX/2, stepY/2); shape.lineTo(-stepX/2, stepY/2); shape.lineTo(-stepX/2, -stepY/2);
                
                const maxSize = Math.min(stepX, stepY);
                const hw = maxSize * 0.45; const hh = maxSize * 0.45;
                
                if (entity.jaliPattern === 'ventilation') {
                    const hole = new THREE.Path();
                    hole.absellipse(0, 0, hw*0.8, hh*0.8, 0, Math.PI * 2, false);
                    shape.holes.push(hole);
                } else if (entity.jaliPattern === 'lotus') {
                    const h1 = new THREE.Path(); h1.moveTo(0, hh*0.8); h1.quadraticCurveTo(hw*0.4, 0, 0, -hh*0.8); h1.quadraticCurveTo(-hw*0.4, 0, 0, hh*0.8);
                    const h2 = new THREE.Path(); h2.moveTo(hw*0.1, -hh*0.6); h2.quadraticCurveTo(hw*0.8, -hh*0.2, hw*0.9, hh*0.4); h2.quadraticCurveTo(hw*0.5, hh*0.1, hw*0.1, -hh*0.6);
                    const h3 = new THREE.Path(); h3.moveTo(-hw*0.1, -hh*0.6); h3.quadraticCurveTo(-hw*0.8, -hh*0.2, -hw*0.9, hh*0.4); h3.quadraticCurveTo(-hw*0.5, hh*0.1, -hw*0.1, -hh*0.6);
                    shape.holes.push(h1, h2, h3);
                } else if (entity.jaliPattern === 'peacock') {
                    const p = new THREE.Path();
                    p.moveTo(0, -hh); p.quadraticCurveTo(hw, -hh, hw, -hh*0.2);
                    p.quadraticCurveTo(hw*0.8, hh*0.6, 0, hh*0.8);
                    p.quadraticCurveTo(-hw*0.6, hh*0.6, -hw*0.6, 0); p.quadraticCurveTo(-hw, hh*0.2, -hw*0.8, 0);
                    p.quadraticCurveTo(-hw*0.2, -0.4, 0, -hh);
                    shape.holes.push(p);
                } else if (entity.jaliPattern === 'gopuram') {
                    const t1 = new THREE.Path(); t1.moveTo(-hw*0.8, -hh*0.8); t1.lineTo(hw*0.8, -hh*0.8); t1.lineTo(hw*0.6, -hh*0.2); t1.lineTo(-hw*0.6, -hh*0.2); t1.lineTo(-hw*0.8, -hh*0.8);
                    const t2 = new THREE.Path(); t2.moveTo(-hw*0.5, -hh*0.1); t2.lineTo(hw*0.5, -hh*0.1); t2.lineTo(hw*0.3, hh*0.4); t2.lineTo(-hw*0.3, hh*0.4); t2.lineTo(-hw*0.5, -hh*0.1);
                    const t3 = new THREE.Path(); t3.moveTo(-hw*0.2, hh*0.5); t3.lineTo(hw*0.2, hh*0.5); t3.lineTo(0, hh*0.9); t3.lineTo(-hw*0.2, hh*0.5);
                    shape.holes.push(t1, t2, t3);
                } else if (entity.jaliPattern === 'mango') {
                    const m = new THREE.Path();
                    m.moveTo(0, -hh*0.8);
                    m.bezierCurveTo(hw, -hh*0.8, hw, hh*0.6, 0, hh*0.8);
                    m.bezierCurveTo(-hw*0.8, hh*0.8, -hw, hh*0.2, -hw*0.4, hh*0.2);
                    m.bezierCurveTo(-hw*0.2, hh*0.2, -hw*0.2, hh*0.4, 0, hh*0.4);
                    m.bezierCurveTo(-hw*0.8, hh*0.4, -hw*0.8, -hh*0.6, 0, -hh*0.8);
                    shape.holes.push(m);
                } else if (entity.jaliPattern === 'chettinad' || entity.jaliPattern === 'kolam') {
                    const d = new THREE.Path();
                    d.moveTo(0, hh*0.8); d.lineTo(hw*0.8, 0); d.lineTo(0, -hh*0.8); d.lineTo(-hw*0.8, 0); d.lineTo(0, hh*0.8);
                    shape.holes.push(d);
                    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([dx, dy]) => {
                        const c = new THREE.Path();
                        c.absellipse(dx*hw*0.8, dy*hh*0.8, hw*0.15, hh*0.15, 0, Math.PI * 2, false);
                        shape.holes.push(c);
                    });
                }
                
                const extrudeSettings = { 
                    depth: lThick, 
                    bevelEnabled: true, 
                    bevelSegments: 5, 
                    curveSegments: 64,
                    steps: 1, 
                    bevelSize: lThick * 0.02, 
                    bevelThickness: lThick * 0.015 
                };
                const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                const iMesh = new THREE.InstancedMesh(geo, matFrame, cols * rows);
                iMesh.castShadow = true; iMesh.receiveShadow = true;
                
                const dummy = new THREE.Object3D();
                let idx = 0;
                for (let c = 0; c < cols; c++) {
                    for (let rIdx = 0; rIdx < rows; rIdx++) {
                        dummy.position.set(-iW/2 + (c + 0.5) * stepX, -iH/2 + (rIdx + 0.5) * stepY, -lThick/2);
                        dummy.updateMatrix();
                        iMesh.setMatrixAt(idx++, dummy.matrix);
                    }
                }
                latticeGroup.add(iMesh);
            } else if (entity.jaliPattern === 'modern') {
                const targetStep = entity.jaliPatternSize || 4;
                const cols = Math.max(1, Math.round(iW / targetStep));
                const stepX = iW / cols;
                for (let c = 1; c < cols; c++) {
                    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.5, iH, lThick), matFrame);
                    slat.position.set(-iW/2 + c * stepX, 0, 0); slat.castShadow = true; latticeGroup.add(slat);
                }
            } else {
                const defaultStep = entity.jaliPattern === 'geometric' ? 6 : 8;
                const targetStep = entity.jaliPatternSize || defaultStep;
                const cols = Math.max(1, Math.round(iW / targetStep));
                const rows = Math.max(1, Math.round(iH / targetStep));
                const stepX = iW / cols;
                const stepY = iH / rows;
                
                for (let c = 0; c < cols; c++) {
                    const vBar = new THREE.Mesh(new THREE.BoxGeometry(1, iH, lThick), matBox);
                    vBar.position.set(-iW/2 + (c + 0.5) * stepX, 0, 0); vBar.castShadow = true; latticeGroup.add(vBar);
                }
                for (let r = 0; r < rows; r++) {
                    const hBar = new THREE.Mesh(new THREE.BoxGeometry(iW, 1, lThick), matBox);
                    hBar.position.set(0, -iH/2 + (r + 0.5) * stepY, 0); hBar.castShadow = true; latticeGroup.add(hBar);
                }
                
                if (entity.jaliPattern === 'islamic') {
                    const diagLen = Math.hypot(stepX, stepY);
                    const angle = Math.atan2(stepY, stepX);
                    for (let c = 0; c < cols; c++) {
                        for (let r = 0; r < rows; r++) {
                            const cx = -iW/2 + (c + 0.5) * stepX;
                            const cy = -iH/2 + (r + 0.5) * stepY;
                            const c1 = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.5, lThick), matBox);
                            c1.position.set(cx, cy, 0); c1.rotation.z = angle; c1.castShadow = true; latticeGroup.add(c1);
                            const c2 = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.5, lThick), matBox);
                            c2.position.set(cx, cy, 0); c2.rotation.z = -angle; c2.castShadow = true; latticeGroup.add(c2);
                        }
                    }
                }
            }
            jaliGroup.add(latticeGroup);
            const hitboxGeo = new THREE.BoxGeometry(entity.width + 10, height + 10, (entity.thick || 20) + 10);
            const hitbox = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}));
            hitbox.position.set(0, height/2, 0); jaliGroup.add(hitbox);
            jaliGroup.userData = { isWidget: true, entity: entity }; sceneGroup.add(jaliGroup);
            return jaliGroup;
        }
    },
    'door': {
        widget: "door", label: "DOOR",
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 40, doorType: 'single', doorMat: 'wood', facing: 1, side: 1 },
        render2D: (group, entity) => {
            const hw = entity.width / 2; const thick = entity.wall.thickness || entity.wall.config.thickness;
            const slWidth = (entity.hasSidelights && (!entity.doorShape || entity.doorShape === 'square') && !['pocket', 'sliding'].includes(entity.doorType)) ? Math.min(60, entity.width * 0.22) : 0;
            const doorW = entity.width - (slWidth * 2);
            const doorHW = doorW / 2;
            const pivotBase = hw - slWidth;
            
            if (slWidth > 0) {
                group.add(new Konva.Rect({ x: -hw, y: -thick/2, width: slWidth, height: thick, fill: '#bae6fd', opacity: 0.3, stroke: '#9ca3af' }));
                group.add(new Konva.Rect({ x: hw - slWidth, y: -thick/2, width: slWidth, height: thick, fill: '#bae6fd', opacity: 0.3, stroke: '#9ca3af' }));
            }

            if (entity.doorType === 'single') {
                const hingeX = (entity.side === 1) ? pivotBase : -pivotBase; const arcRot = (entity.side === 1) ? ((entity.facing === 1) ? 180 : 90) : ((entity.facing === 1) ? 270 : 0); 
                group.add(new Konva.Arc({ x: hingeX, y: 0, innerRadius: doorW, outerRadius: doorW, angle: 90, stroke: '#9ca3af', dash: [4, 4], rotation: arcRot }), new Konva.Line({ points: [hingeX, 0, hingeX, -doorW * entity.facing], stroke: '#374151', strokeWidth: 3 })); 
            } else if (entity.doorType === 'double' || entity.doorType === 'french') { 
                const arcRotL = entity.facing === 1 ? 270 : 0, arcRotR = entity.facing === 1 ? 180 : 90; 
                group.add(new Konva.Arc({ x: -pivotBase, y: 0, innerRadius: doorHW, outerRadius: doorHW, angle: 90, rotation: arcRotL, stroke: '#9ca3af', dash: [4, 4] }), new Konva.Line({ points: [-pivotBase, 0, -pivotBase, -doorHW * entity.facing], stroke: '#374151', strokeWidth: 3 }), new Konva.Arc({ x: pivotBase, y: 0, innerRadius: doorHW, outerRadius: doorHW, angle: 90, rotation: arcRotR, stroke: '#9ca3af', dash: [4, 4] }), new Konva.Line({ points: [pivotBase, 0, pivotBase, -doorHW * entity.facing], stroke: '#374151', strokeWidth: 3 })); 
            } else if (entity.doorType === 'sliding' || entity.doorType === 'double_sliding') { 
                const off = thick * 0.2; group.add(new Konva.Line({ points: [-doorHW, -off, 0, -off], stroke: '#374151', strokeWidth: 3 }), new Konva.Line({ points: [0, off, doorHW, off], stroke: '#374151', strokeWidth: 3 })); 
            } else if (entity.doorType === 'pocket') { 
                group.add(new Konva.Line({ points: [-doorHW, 0, 0, 0], stroke: '#374151', strokeWidth: 3 }), new Konva.Line({ points: [0, 0, doorHW, 0], stroke: '#374151', strokeWidth: 3, dash: [4,4] })); 
            } else if (entity.doorType === 'pivot') { 
                const pivotX = entity.side === 1 ? pivotBase - 10 : -pivotBase + 10, arcRot = entity.side === 1 ? (entity.facing===1?180:90) : (entity.facing===1?270:0); group.add(new Konva.Line({ points: [pivotX, doorW*0.2*entity.facing, pivotX, -doorW*0.8*entity.facing], stroke: '#374151', strokeWidth: 3 }), new Konva.Arc({ x: pivotX, y: 0, innerRadius: doorW*0.8, outerRadius: doorW*0.8, angle: 90, rotation: arcRot, stroke: '#9ca3af', dash: [4, 4] })); 
            } else if (entity.doorType === 'folding') { 
                const qw = doorW / 4; group.add(new Konva.Line({ points: [-doorHW, 0, -doorHW + qw, -qw*entity.facing], stroke: '#374151', strokeWidth: 3 }), new Konva.Line({ points: [-doorHW + qw, -qw*entity.facing, 0, 0], stroke: '#374151', strokeWidth: 3 })); 
            }
        },
        render3D: (sceneGroup, entity, helpers) => {
            let baseElev = entity.elevation || 0;
            let rawHeight = entity.height || DOOR_HEIGHT;
            let bottomY = Math.max(0.2, baseElev); // Prevent frame from sinking into floor
            let topY = baseElev + rawHeight;
            let height = topY - bottomY;
            const doorGroup = new THREE.Group(); 
            if (entity.localX !== undefined) {
                doorGroup.position.set(entity.localX, bottomY, 0);
                doorGroup.rotation.y = 0;
            } else {
                doorGroup.position.set(entity.x, bottomY, entity.z);
                doorGroup.rotation.y = -entity.angle;
            }
            const isSliding = entity.doorType === 'sliding' || entity.doorType === 'double_sliding' || entity.doorType === 'pocket';
            const fW = 4; const fThick = entity.thick + 0.2;
            const matDoor = helpers.getDynamicMaterial(entity.doorMat, 'door'); 
            const frameMatKey = entity.frameMat || entity.doorMat;
            const matFrame = helpers.getDynamicMaterial(frameMatKey, 'door');
            
            if (entity.doorShape !== 'radius' && entity.doorShape !== 'segment' && entity.doorShape !== 'gothic') {
                const frameShape = new THREE.Shape();
                frameShape.moveTo(-entity.width/2, 0);
                frameShape.lineTo(-entity.width/2, height);
                frameShape.lineTo(entity.width/2, height);
                frameShape.lineTo(entity.width/2, 0);
                frameShape.lineTo(entity.width/2 - fW, 0);
                frameShape.lineTo(entity.width/2 - fW, height - fW);
                frameShape.lineTo(-entity.width/2 + fW, height - fW);
                frameShape.lineTo(-entity.width/2 + fW, 0);
                frameShape.lineTo(-entity.width/2, 0);
                
                const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: fThick, bevelEnabled: false });
                frameGeo.translate(0, 0, -fThick/2);
                const mainFrame = new THREE.Mesh(frameGeo, matFrame); mainFrame.castShadow = true; mainFrame.receiveShadow = true; mainFrame.userData = { isFrame: true }; doorGroup.add(mainFrame);
            } else {
                const makeFrameBox = (w, h, depth) => { const bg = new THREE.BoxGeometry(w, h, depth); const bm = new THREE.Mesh(bg, matFrame); bm.castShadow = true; bm.receiveShadow = true; bm.userData = { isFrame: true }; return bm; };
                const sL = makeFrameBox(fW, height, fThick); sL.position.set(-entity.width/2 + fW/2, height/2, 0); doorGroup.add(sL);
                const sR = makeFrameBox(fW, height, fThick); sR.position.set(entity.width/2 - fW/2, height/2, 0); doorGroup.add(sR);
            }
            const metalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 });
            
            // Helper to tag frame meshes so GizmoManager knows it's the frame
            const tagFrame = (mesh) => {
                if (Array.isArray(mesh)) {
                    mesh.forEach(m => m.userData = { ...m.userData, isFrame: true });
                } else {
                    mesh.userData = { ...mesh.userData, isFrame: true };
                }
                return mesh;
            };
            const isGlassDoor = entity.doorMat === 'glass'; const frameWidth = 1.5; const frameThick = entity.thick + 1; const doorThick = 2.0; const gapSide = 0.15; const gapTop = 0.15; const gapBottom = 0.5; 
            const slWidth = (entity.hasSidelights && (!entity.doorShape || entity.doorShape === 'square') && !['pocket', 'sliding'].includes(entity.doorType)) ? Math.min(60, entity.width * 0.22) : 0;
            const leafWidth = entity.width - (frameWidth * 2) - (gapSide * 2) - (slWidth * 2); const leafHeight = height - frameWidth - gapTop - gapBottom;
            const openAngle = (Math.PI / 4) * (entity.facing === 1 ? 1 : -1); const pivotXOffset = -entity.width/2 + frameWidth + slWidth + gapSide/2; const hingePinZ = 0; 
            
            const thresholdGeo = new THREE.BoxGeometry(entity.width, 0.4, (entity.thick || 20) + 0.5);
            const threshold = tagFrame(new THREE.Mesh(thresholdGeo, matFrame));
            threshold.position.set(0, 0, 0);
            threshold.receiveShadow = true; threshold.castShadow = true;
            doorGroup.add(threshold);
            
            if (entity.doorType !== 'pocket') { 
                const shapeType = entity.doorShape || 'square';
                if (shapeType === 'square') {
                    const jamGeo = new THREE.BoxGeometry(frameWidth, height, frameThick); const jamL = tagFrame(new THREE.Mesh(jamGeo, matFrame)); jamL.position.set(-entity.width/2 + frameWidth/2, height/2, 0); const jamR = tagFrame(new THREE.Mesh(jamGeo, matFrame)); jamR.position.set(entity.width/2 - frameWidth/2, height/2, 0); const jamT = tagFrame(new THREE.Mesh(new THREE.BoxGeometry(entity.width - (frameWidth * 2), frameWidth, frameThick), matFrame)); jamT.position.set(0, height - frameWidth/2, 0);
                    const trimStile = new THREE.BoxGeometry(4, height + 2, 0.5); const trimRail = new THREE.BoxGeometry(entity.width + 8, 4, 0.5);
                    [-frameThick/2 - 0.25, frameThick/2 + 0.25].forEach(zOff => { const tL = tagFrame(new THREE.Mesh(trimStile, matFrame)); tL.position.set(-entity.width/2 - 2 + frameWidth, height/2 + 1, zOff); const tR = tagFrame(new THREE.Mesh(trimStile, matFrame)); tR.position.set(entity.width/2 + 2 - frameWidth, height/2 + 1, zOff); const tT = tagFrame(new THREE.Mesh(trimRail, matFrame)); tT.position.set(0, height + 2, zOff); [tL, tR, tT].forEach(m => { m.castShadow = true; m.receiveShadow = true; doorGroup.add(m); }); });
                    [jamL, jamR, jamT].forEach(m => { m.castShadow = true; m.receiveShadow = true; doorGroup.add(m); });
                    
                    if (slWidth > 0) {
                        const innerJamGeo = new THREE.BoxGeometry(frameWidth, height - frameWidth, frameThick);
                        const iJamL = tagFrame(new THREE.Mesh(innerJamGeo, matFrame)); iJamL.position.set(-entity.width/2 + frameWidth + slWidth - frameWidth/2, (height - frameWidth)/2, 0);
                        const iJamR = tagFrame(new THREE.Mesh(innerJamGeo, matFrame)); iJamR.position.set(entity.width/2 - frameWidth - slWidth + frameWidth/2, (height - frameWidth)/2, 0);
                        [iJamL, iJamR].forEach(m => { m.castShadow = true; m.receiveShadow = true; doorGroup.add(m); });
                        
                        const slGlassW = slWidth - frameWidth;
                        const slBotGeo = new THREE.BoxGeometry(slGlassW, 5, frameThick);
                        const slBotL = tagFrame(new THREE.Mesh(slBotGeo, matFrame)); slBotL.position.set(-entity.width/2 + frameWidth + slGlassW/2, 2.5, 0);
                        const slBotR = tagFrame(new THREE.Mesh(slBotGeo, matFrame)); slBotR.position.set(entity.width/2 - frameWidth - slGlassW/2, 2.5, 0);
                        [slBotL, slBotR].forEach(m => doorGroup.add(m));
                        
                        const glassMat = helpers.getDynamicMaterial('glass', 'door');
                        const slGlassGeo = new THREE.BoxGeometry(slGlassW, height - frameWidth - 5, 0.4);
                        const glassL = new THREE.Mesh(slGlassGeo, glassMat); glassL.position.set(-entity.width/2 + frameWidth + slGlassW/2, 5 + (height - frameWidth - 5)/2, 0);
                        const glassR = new THREE.Mesh(slGlassGeo, glassMat); glassR.position.set(entity.width/2 - frameWidth - slGlassW/2, 5 + (height - frameWidth - 5)/2, 0);
                        doorGroup.add(glassL, glassR);
                    }
                } else {
                    const createArchedFrameShape = (wOuter, hOuter, wInner, hInner, type) => {
                        const shape = new THREE.Shape();
                        const hwO = wOuter / 2;
                        const hwI = wInner / 2;
                        
                        shape.moveTo(-hwO, 0);
                        if (type === 'radius') {
                            const strHO = Math.max(0, hOuter - hwO);
                            shape.lineTo(-hwO, strHO);
                            if (hwO > 0) shape.absarc(0, strHO, hwO, Math.PI, 0, true);
                        } else if (type === 'segment') {
                            const riseO = wOuter * 0.15;
                            const strHO = Math.max(0, hOuter - riseO);
                            shape.lineTo(-hwO, strHO);
                            shape.quadraticCurveTo(0, hOuter + riseO*0.5, hwO, strHO);
                        } else if (type === 'gothic') {
                            const strHO = Math.max(0, hOuter - (wOuter * 0.7));
                            shape.lineTo(-hwO, strHO);
                            shape.quadraticCurveTo(-hwO * 0.2, hOuter, 0, hOuter);
                            shape.quadraticCurveTo(hwO * 0.2, hOuter, hwO, strHO);
                        }
                        
                        shape.lineTo(hwO, 0);
                        shape.lineTo(hwI, 0);
                        
                        if (type === 'radius') {
                            const strHI = Math.max(0, hInner - hwI);
                            shape.lineTo(hwI, strHI);
                            if (hwI > 0) shape.absarc(0, strHI, hwI, 0, Math.PI, false);
                        } else if (type === 'segment') {
                            const riseI = wInner * 0.15;
                            const strHI = Math.max(0, hInner - riseI);
                            shape.lineTo(hwI, strHI);
                            shape.quadraticCurveTo(0, hInner + riseI*0.5, -hwI, strHI);
                        } else if (type === 'gothic') {
                            const strHI = Math.max(0, hInner - (wInner * 0.7));
                            shape.lineTo(hwI, strHI);
                            shape.quadraticCurveTo(hwI * 0.2, hInner, 0, hInner);
                            shape.quadraticCurveTo(-hwI * 0.2, hInner, -hwI, strHI);
                        }
                        
                        shape.lineTo(-hwI, 0);
                        shape.lineTo(-hwO, 0);
                        return shape;
                    };
                    
                    const frameShape = createArchedFrameShape(entity.width, height, entity.width - (frameWidth * 2), height - frameWidth, shapeType);
                    const jamGeo = new THREE.ExtrudeGeometry(frameShape, { depth: frameThick, bevelEnabled: false });
                    jamGeo.translate(0, 0, -frameThick/2);
                    const jam = tagFrame(new THREE.Mesh(jamGeo, matFrame));
                    jam.position.set(0, 0, 0);
                    jam.castShadow = true; jam.receiveShadow = true; doorGroup.add(jam);
                    
                    [-frameThick/2 - 0.25, frameThick/2 + 0.25].forEach(zOff => {
                        const trimShape = createArchedFrameShape(entity.width + 8, height + 4, entity.width - (frameWidth * 2), height - frameWidth, shapeType);
                        const trimGeo = new THREE.ExtrudeGeometry(trimShape, { depth: 0.5, bevelEnabled: false });
                        trimGeo.translate(0, 0, -0.25);
                        const trim = tagFrame(new THREE.Mesh(trimGeo, matFrame));
                        trim.position.set(0, 0, zOff);
                        trim.castShadow = true; trim.receiveShadow = true; doorGroup.add(trim);
                    });
                }
            }
            if (entity.doorType === 'single') {
                const panel = buildDetailedDoorPanel(entity, leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, entity.side, helpers); const hingeHolder = new THREE.Group(); 
                if (entity.side === 1) { hingeHolder.position.set(-pivotXOffset, gapBottom, hingePinZ); panel.position.set(-leafWidth/2 - gapSide/2, 0, -hingePinZ); panel.rotation.y = Math.PI; hingeHolder.rotation.y = -openAngle; } else { hingeHolder.position.set(pivotXOffset, gapBottom, hingePinZ); panel.position.set(leafWidth/2 + gapSide/2, 0, -hingePinZ); hingeHolder.rotation.y = openAngle; } 
                hingeHolder.add(panel); doorGroup.add(hingeHolder);
            } else if (entity.doorType === 'double' || entity.doorType === 'french') {
                const hw = leafWidth / 2 - gapSide/2; const hL = new THREE.Group(); hL.position.set(pivotXOffset, gapBottom, hingePinZ); hL.rotation.y = openAngle; 
                const panelL = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); panelL.position.set(hw/2 + gapSide/2, 0, -hingePinZ); hL.add(panelL);
                const hR = new THREE.Group(); hR.position.set(-pivotXOffset, gapBottom, hingePinZ); hR.rotation.y = -openAngle;
                const panelR = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); panelR.position.set(-hw/2 - gapSide/2, 0, -hingePinZ); panelR.rotation.y = Math.PI; hR.add(panelR);
                doorGroup.add(hL, hR);
            } else if (entity.doorType === 'sliding' || entity.doorType === 'double_sliding') {
                const trackMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.5 }); const trackW = doorThick * 2.5; const trackGeo = new THREE.BoxGeometry(leafWidth, 0.5, trackW); 
                const trackT = new THREE.Mesh(trackGeo, trackMat); trackT.position.set(0, height - frameWidth - 0.25, 0); const trackB = new THREE.Mesh(trackGeo, trackMat); trackB.position.set(0, gapBottom - 0.25, 0); doorGroup.add(trackT, trackB);
                const overlap = 2; 
                if (entity.doorType === 'sliding') {
                    const hw = (leafWidth / 2) + (overlap / 2);
                    const pFixed = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); pFixed.position.set(hw/2 - overlap/2, gapBottom, -doorThick/2 - 0.1); doorGroup.add(pFixed);
                    const pSlide = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers); const slideAmount = hw * 0.4; pSlide.position.set(-hw/2 + overlap/2 + slideAmount, gapBottom, doorThick/2 + 0.1); doorGroup.add(pSlide);
                } else {
                    const hw = (leafWidth / 4) + (overlap / 2);
                    const pFixL = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 0, helpers); pFixL.position.set(-leafWidth/2 + hw/2, gapBottom, -doorThick/2 - 0.1);
                    const pFixR = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 0, helpers); pFixR.position.set(leafWidth/2 - hw/2, gapBottom, -doorThick/2 - 0.1);
                    const slideAmount = hw * 0.45;
                    const pSlideL = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, -1, helpers); pSlideL.position.set(-leafWidth/4 + slideAmount/2, gapBottom, doorThick/2 + 0.1); 
                    const pSlideR = buildDetailedDoorPanel(entity, hw, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); pSlideR.position.set(leafWidth/4 - slideAmount/2, gapBottom, doorThick/2 + 0.1);
                    doorGroup.add(pFixL, pFixR, pSlideL, pSlideR);
                }
            } else if (entity.doorType === 'pocket') {
                const jamL = tagFrame(new THREE.Mesh(new THREE.BoxGeometry(frameWidth, height, frameThick), matFrame)); jamL.position.set(-entity.width/2 + frameWidth/2, height/2, 0); doorGroup.add(jamL);
                const p = buildDetailedDoorPanel(entity, leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); p.position.set(pivotXOffset - leafWidth * 0.4, gapBottom, 0); doorGroup.add(p);
            } else if (entity.doorType === 'pivot') {
                const p = buildDetailedDoorPanel(entity, leafWidth, leafHeight, doorThick, matDoor, entity.doorType, isGlassDoor, 1, helpers); const off = leafWidth * 0.15; p.position.set(leafWidth/2 - off, gapBottom, 0);
                doorGroup.add(p); const pivot = new THREE.Group(); const signX = entity.side === 1 ? 1 : -1; pivot.position.set(pivotXOffset + off, 0, 0); pivot.rotation.y = -openAngle * 1.2 * signX; pivot.add(p);
                const plateGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16); const floorPlate = new THREE.Mesh(plateGeo, metalMat); floorPlate.position.set(pivotXOffset + off, 0.2, 0); const topPlate = new THREE.Mesh(plateGeo, metalMat); topPlate.position.set(pivotXOffset + off, height - 0.2, 0); doorGroup.add(pivot, floorPlate, topPlate);
            } else if (entity.doorType === 'folding') {
                const numPanels = 2;
                const trackGeo = new THREE.BoxGeometry(entity.width - frameWidth*2, 1.5, doorThick + 1); const track = new THREE.Mesh(trackGeo, metalMat); track.position.set(0, height - frameWidth/2 - 0.75, 0); doorGroup.add(track);
                const panelW = (leafWidth - (gapSide * (numPanels - 1))) / numPanels; const swingDir = entity.facing === 1 ? 1 : -1; const isRightHinge = entity.side === 1; const signX = isRightHinge ? 1 : -1;
                
                const pivot1 = new THREE.Group(); pivot1.position.set(pivotXOffset * -signX, gapBottom, hingePinZ); pivot1.rotation.y = openAngle * 1.5; doorGroup.add(pivot1);
                const p1HingeSide = isRightHinge ? -1 : 1; const p1 = buildDetailedDoorPanel(entity, panelW, leafHeight, doorThick, matDoor, 'folding_main', isGlassDoor, p1HingeSide, helpers); p1.position.set((panelW/2 + gapSide/2) * -signX, 0, -hingePinZ * swingDir); pivot1.add(p1);
                
                const pivot2 = new THREE.Group(); pivot2.position.set((panelW + gapSide) * -signX, 0, 0); pivot2.rotation.y = -openAngle * 3; pivot1.add(pivot2);
                const p2 = buildDetailedDoorPanel(entity, panelW, leafHeight, doorThick, matDoor, 'folding_lead', isGlassDoor, p1HingeSide, helpers); p2.position.set((panelW/2 + gapSide/2) * -signX, 0, 0); pivot2.add(p2);
                const jointHingeGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 12); [leafHeight * 0.85, leafHeight * 0.5, leafHeight * 0.15].forEach(yPos => { const hingeMesh = new THREE.Mesh(jointHingeGeo, metalMat); hingeMesh.position.set(0, yPos, (doorThick/2 + 0.1) * swingDir); pivot2.add(hingeMesh); });
                const guidePin = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 8), metalMat); guidePin.position.set((panelW - 2) * -signX, leafHeight, 0); p2.add(guidePin); p1.add(pivot2); doorGroup.add(pivot1);
            }
            const hitboxGeo = new THREE.BoxGeometry(entity.width + 10, height + 10, (entity.thick || 20) + 10);
            const hitbox = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}));
            hitbox.position.set(0, height/2, 0);
            doorGroup.add(hitbox);
            doorGroup.userData = { isWidget: true, entity: entity };
            sceneGroup.add(doorGroup);
            return doorGroup;
        }
    },
    'window': {
        widget: "window", label: "WINDOW",
        events: ["drag_along_wall", "hinge_flip", "snap_to_corners", "snap_to_center", "prevent_overlap", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 50, windowType: 'sliding_std', frameMat: 'alum_powder', glassMat: 'clear', grillePattern: 'grid', facing: 1, side: 1 },
        render2D: (group, entity) => {
            const hw = entity.width / 2; const thick = entity.wall.thickness || entity.wall.config.thickness; const wConf = WINDOW_TYPES[entity.windowType] || WINDOW_TYPES.sliding_std;
            if (wConf.type === 'fixed' || wConf.type === 'louver') { group.add(new Konva.Rect({ fill: '#bae6fd', opacity: 0.6, stroke: '#38bdf8', strokeWidth: 1, width: entity.width - 8, height: thick * 0.4, x: -hw + 4, y: -thick * 0.2 })); } 
            else if (wConf.type === 'sliding') { const off = thick * 0.2; group.add(new Konva.Line({ points: [-hw, -off, 0, -off], stroke: '#38bdf8', strokeWidth: 2 }), new Konva.Line({ points: [0, off, hw, off], stroke: '#38bdf8', strokeWidth: 2 })); } 
            else if (wConf.type === 'casement' || wConf.type === 'traditional') { const hingeX = (entity.side === 1) ? hw : -hw, arcRot = (entity.side === 1) ? ((entity.facing === 1) ? 180 : 90) : ((entity.facing === 1) ? 270 : 0); group.add(new Konva.Arc({ x: hingeX, y: 0, innerRadius: entity.width, outerRadius: entity.width, angle: 60, stroke: '#9ca3af', dash: [4, 4], rotation: arcRot }), new Konva.Line({ points: [hingeX, 0, hingeX, -entity.width * 0.8 * entity.facing], stroke: '#38bdf8', strokeWidth: 2 })); }
            else if (wConf.type === 'bay') { group.add(new Konva.Line({ points: [-hw, 0, -hw+10, -20*entity.facing, hw-10, -20*entity.facing, hw, 0], stroke: '#38bdf8', strokeWidth: 2 })); }
            if (entity.grillePattern !== 'none') { group.add(new Konva.Line({ points: [-hw, thick*0.4, hw, thick*0.4], stroke: '#ef4444', dash: [2,2] })); }
        },
        render3D: (sceneGroup, entity, helpers) => {
            let baseElev = entity.elevation !== undefined ? entity.elevation : WINDOW_SILL;
            let rawHeight = entity.height !== undefined ? entity.height : WINDOW_HEIGHT;
            let bottomY = Math.max(0.2, baseElev);
            let topY = baseElev + rawHeight;
            let height = topY - bottomY;
            const winGroup = new THREE.Group(); 
            if (entity.localX !== undefined) {
                winGroup.position.set(entity.localX, bottomY, 0);
                winGroup.rotation.y = 0;
            } else {
                winGroup.position.set(entity.x, bottomY, entity.z);
                winGroup.rotation.y = -entity.angle;
            }
            const wConf = WINDOW_TYPES[entity.windowType] || WINDOW_TYPES.sliding_std;
            const matFrame = helpers.getDynamicMaterial(entity.frameMat, 'window_frame'); const matGlass = helpers.getDynamicMaterial(entity.glassMat, 'window_glass');
            const isTrad = wConf.type === 'traditional'; const isBay = wConf.type === 'bay'; const fW = isTrad ? 5 : 3; const fThick = isTrad ? entity.thick + 2 : entity.thick + 0.2; const zOffset = isBay ? 12 : 0; 
            const matGrille = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 }); const matConcrete = new THREE.MeshStandardMaterial({ color: 0xd4d4d4, roughness: 1.0 });
            
            const frameShape = new THREE.Shape();
            frameShape.moveTo(-entity.width/2, 0); frameShape.lineTo(entity.width/2, 0); frameShape.lineTo(entity.width/2, height); frameShape.lineTo(-entity.width/2, height); frameShape.lineTo(-entity.width/2, 0);
            const frameHole = new THREE.Path();
            frameHole.moveTo(-entity.width/2 + fW, fW); frameHole.lineTo(entity.width/2 - fW, fW); frameHole.lineTo(entity.width/2 - fW, height - fW); frameHole.lineTo(-entity.width/2 + fW, height - fW); frameHole.lineTo(-entity.width/2 + fW, fW);
            frameShape.holes.push(frameHole);
            const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: fThick, bevelEnabled: false });
            frameGeo.translate(0, 0, -fThick/2 + zOffset);
            const mainFrame = new THREE.Mesh(frameGeo, matFrame); mainFrame.castShadow = true; mainFrame.receiveShadow = true; mainFrame.userData = { isFrame: true }; winGroup.add(mainFrame);

            const iW = entity.width - fW*2; const iH = height - fW*2; const sThick = entity.thick * 0.6;
            const makeSash = (w, h, useGlass=true) => {
                const sG = new THREE.Group(); const sFw = isTrad ? 4 : 2.5; const geoS = new THREE.BoxGeometry(sFw, h, sThick); const geoR = new THREE.BoxGeometry(w - sFw*2, sFw, sThick);
                const s1 = new THREE.Mesh(geoS, matFrame); s1.position.set(-w/2 + sFw/2, h/2, 0); const s2 = new THREE.Mesh(geoS, matFrame); s2.position.set(w/2 - sFw/2, h/2, 0);
                const r1 = new THREE.Mesh(geoR, matFrame); r1.position.set(0, h - sFw/2, 0); const r2 = new THREE.Mesh(geoR, matFrame); r2.position.set(0, sFw/2, 0);
                [s1, s2, r1, r2].forEach(m => { m.castShadow = true; m.receiveShadow = true; m.userData = { isFrame: true }; sG.add(m); });
                if (useGlass) { const glass = new THREE.Mesh(new THREE.BoxGeometry(w - sFw*2, h - sFw*2, sThick*0.3), matGlass); glass.position.set(0, h/2, 0); glass.userData = { isGlass: true }; sG.add(glass); } 
                else { const woodPanel = new THREE.Mesh(new THREE.BoxGeometry(w - sFw*2, h - sFw*2, sThick*0.5), matFrame); woodPanel.position.set(0, h/2, 0); woodPanel.userData = { isFrame: true }; sG.add(woodPanel); }
                return sG;
            };
            if (wConf.type === 'fixed') { const sash = makeSash(iW, iH); sash.position.set(0, fW, zOffset); winGroup.add(sash); } 
            else if (wConf.type === 'casement' || wConf.type === 'traditional') {
                const hw = iW / 2; const useGlass = wConf.type !== 'traditional';
                const sL = makeSash(hw, iH, useGlass); const pL = new THREE.Group(); pL.position.set(-iW/2, fW, zOffset); sL.position.set(hw/2, 0, 0); pL.rotation.y = (Math.PI / 4) * entity.facing; pL.add(sL);
                const sR = makeSash(hw, iH, useGlass); const pR = new THREE.Group(); pR.position.set(iW/2, fW, zOffset); sR.position.set(-hw/2, 0, 0); pR.rotation.y = -(Math.PI / 4) * entity.facing; pR.add(sR); winGroup.add(pL, pR);
            } else if (wConf.type === 'sliding') {
                const overlap = 2; const panes = 2; const hw = (iW / panes) + (overlap/2);
                for(let i=0; i<panes; i++) { const sash = makeSash(hw, iH); const zOff = (i % 2 === 0) ? sThick/2 + 0.1 : -sThick/2 - 0.1; let xPos = -iW/2 + hw/2 + (i * (hw - overlap)); if (i === panes - 1) xPos -= hw * 0.3 * entity.facing; sash.position.set(xPos, fW, zOffset + zOff); winGroup.add(sash); }
            } else if (wConf.type === 'louver') { const slatH = 5; const count = Math.floor(iH / (slatH - 0.5)); for(let i=0; i<count; i++) { const slat = new THREE.Mesh(new THREE.BoxGeometry(iW - 1, slatH, 0.5), matGlass); slat.position.set(0, fW + (i * (slatH - 0.5)) + slatH/2, 0); slat.rotation.x = Math.PI / 6; winGroup.add(slat); } }
            else if (wConf.type === 'bay') {
                const frontW = iW * 0.6; const frontSash = makeSash(frontW, iH); frontSash.position.set(0, fW, zOffset); winGroup.add(frontSash);
                const sideW = Math.hypot(iW*0.2, zOffset); const sideAng = Math.atan2(zOffset, iW*0.2);
                const sL = makeSash(sideW, iH); sL.position.set(-iW/2 + (iW*0.2)/2, fW, zOffset/2); sL.rotation.y = -sideAng; winGroup.add(sL); const sR = makeSash(sideW, iH); sR.position.set(iW/2 - (iW*0.2)/2, fW, zOffset/2); sR.rotation.y = sideAng; winGroup.add(sR);
                const capShape = new THREE.Shape(); capShape.moveTo(-iW/2 - fW, 0); capShape.lineTo(iW/2 + fW, 0); capShape.lineTo(frontW/2 + fW, zOffset + fThick/2); capShape.lineTo(-frontW/2 - fW, zOffset + fThick/2);
                const capGeo = new THREE.ExtrudeGeometry(capShape, {depth: fW, bevelEnabled:false}); capGeo.rotateX(Math.PI/2); const capT = new THREE.Mesh(capGeo, matFrame); capT.position.set(0, height, 0); const capB = new THREE.Mesh(capGeo, matFrame); capB.position.set(0, fW, 0); [capT, capB].forEach(m => m.userData = { isFrame: true }); winGroup.add(capT, capB);
            } else if (wConf.type === 'split_asymmetric') {
                const leftW = iW * 0.45; const rightW = iW - leftW;
                const rightSash = makeSash(rightW, iH); rightSash.position.set(iW/2 - rightW/2, fW, zOffset); winGroup.add(rightSash);
                const botH = iH * 0.4; const topH = iH - botH;
                const botSash = makeSash(leftW, botH); botSash.position.set(-iW/2 + leftW/2, fW, zOffset); winGroup.add(botSash);
                const topSash = makeSash(leftW, topH); topSash.position.set(-iW/2 + leftW/2, fW + botH, zOffset); winGroup.add(topSash);
            } else if (wConf.type === 'window_seat') {
                const hw = iW / 2;
                const sL = makeSash(hw, iH); sL.position.set(-hw/2, fW, 0); winGroup.add(sL);
                const sR = makeSash(hw, iH); sR.position.set(hw/2, fW, 0); winGroup.add(sR);
            } else if (wConf.type === 'garden_open') {
                const frontW = iW * 0.6; const frontSash = makeSash(frontW, iH); frontSash.position.set(0, fW, zOffset); winGroup.add(frontSash);
                const sideW = Math.hypot(iW*0.2, zOffset);
                const sL = makeSash(sideW, iH, true); const pL = new THREE.Group(); pL.position.set(-frontW/2, fW, zOffset); sL.position.set(-sideW/2, 0, 0); pL.rotation.y = -Math.PI/3; pL.add(sL); winGroup.add(pL);
                const sR = makeSash(sideW, iH, true); const pR = new THREE.Group(); pR.position.set(frontW/2, fW, zOffset); sR.position.set(sideW/2, 0, 0); pR.rotation.y = Math.PI/3; pR.add(sR); winGroup.add(pR);
                const capShape = new THREE.Shape(); capShape.moveTo(-iW/2 - fW, 0); capShape.lineTo(iW/2 + fW, 0); capShape.lineTo(frontW/2 + fW, zOffset + fThick/2); capShape.lineTo(-frontW/2 - fW, zOffset + fThick/2);
                const capGeo = new THREE.ExtrudeGeometry(capShape, {depth: fW, bevelEnabled:false}); capGeo.rotateX(Math.PI/2); const capT = new THREE.Mesh(capGeo, matFrame); capT.position.set(0, height, 0); const capB = new THREE.Mesh(capGeo, matFrame); capB.position.set(0, fW, 0); [capT, capB].forEach(m => m.userData = { isFrame: true }); winGroup.add(capT, capB);
            } else if (wConf.type === 'panoramic_slider') {
                const overlap = 2; const panes = 3; const hw = (iW / panes) + (overlap/2);
                for(let i=0; i<panes; i++) { 
                    const pG = new THREE.Group(); const thinFw = 1.0;
                    const tGeoS = new THREE.BoxGeometry(thinFw, iH, sThick); const tGeoR = new THREE.BoxGeometry(hw - thinFw*2, thinFw, sThick);
                    const s1 = new THREE.Mesh(tGeoS, matFrame); s1.position.set(-hw/2 + thinFw/2, iH/2, 0); const s2 = new THREE.Mesh(tGeoS, matFrame); s2.position.set(hw/2 - thinFw/2, iH/2, 0);
                    const r1 = new THREE.Mesh(tGeoR, matFrame); r1.position.set(0, iH - thinFw/2, 0); const r2 = new THREE.Mesh(tGeoR, matFrame); r2.position.set(0, thinFw/2, 0);
                    const glass = new THREE.Mesh(new THREE.BoxGeometry(hw - thinFw*2, iH - thinFw*2, sThick*0.3), matGlass); glass.position.set(0, iH/2, 0);
                    [s1, s2, r1, r2, glass].forEach(m => { m.castShadow = true; m.receiveShadow = true; pG.add(m); });
                    const zOff = (i % 2 === 0) ? sThick/2 + 0.1 : -sThick/2 - 0.1; 
                    let xPos = -iW/2 + hw/2 + (i * (hw - overlap)); 
                    pG.position.set(xPos, fW, zOffset + zOff); winGroup.add(pG); 
                }
            }
            if (entity.grillePattern && entity.grillePattern !== 'none') {
                const grilleGroup = new THREE.Group(); const grilleZ = entity.facing === 1 ? fThick/2 - 0.5 : -fThick/2 + 0.5; grilleGroup.position.set(0, 0, grilleZ); const barRadius = 0.3;
                const makeVBar = (x) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(barRadius, barRadius, iH + 2, 8), matGrille); b.position.set(x, height/2, 0); return b; }; const makeHBar = (y) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(barRadius, barRadius, iW + 2, 8), matGrille); b.rotation.z = Math.PI/2; b.position.set(0, y, 0); return b; };
                if (entity.grillePattern === 'vertical' || entity.grillePattern === 'grid') { for (let i = -iW/2 + 5; i < iW/2; i += 5) { grilleGroup.add(makeVBar(i)); } }
                if (entity.grillePattern === 'horizontal' || entity.grillePattern === 'grid') { for (let j = fW + 6; j < height - fW; j += 6) { grilleGroup.add(makeHBar(j)); } }
                if (entity.grillePattern === 'diamond') { const dGroup = new THREE.Group(); const maxDim = Math.max(iW, iH) * 1.5; for (let i = -maxDim/2; i <= maxDim/2; i += 6) { const v = new THREE.Mesh(new THREE.CylinderGeometry(barRadius, barRadius, maxDim, 8), matGrille); v.position.set(i, 0, 0); dGroup.add(v); const h = new THREE.Mesh(new THREE.CylinderGeometry(barRadius, barRadius, maxDim, 8), matGrille); h.rotation.z = Math.PI/2; h.position.set(0, i, 0); dGroup.add(h); } dGroup.rotation.z = Math.PI / 4; dGroup.position.set(0, height/2, 0); grilleGroup.add(dGroup); }
                winGroup.add(grilleGroup);
            }
            // Chajja logic moved to standalone sunshade widget
            const hitboxGeo = new THREE.BoxGeometry(entity.width + 10, height + 10, (entity.thick || 20) + 10);
            const hitbox = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}));
            hitbox.position.set(0, height/2, 0);
            winGroup.add(hitbox);
            winGroup.userData = { isWidget: true, entity: entity };
            sceneGroup.add(winGroup);
            return winGroup;
        }
    },
    'sunshade': {
        widget: "sunshade", label: "SUNSHADE / CHAJJA", cutsWall: false,
        events: ["drag_along_wall", "snap_to_corners", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 60, elevation: 90, thick: 20, chajjaType: 'concrete_slab', facing: -1, depth: 40 },
        render2D: (group, entity) => {
            const hw = entity.width / 2;
            const w = entity.width; 
            const d = entity.depth || 40; 
            const thick = entity.wall?.thickness || entity.wall?.config?.thickness || 20;
            const wallOffset = thick / 2; 
            // Default to pointing OUTSIDE (negative Y) for clockwise rooms
            const signY = entity.facing === 1 ? 1 : -1; 
            const rectY = signY === 1 ? wallOffset : -wallOffset - d;
            
            const rect = new Konva.Rect({ 
                x: -hw, y: rectY, width: w, height: d, 
                fill: '#fcd34d', opacity: 0.4, stroke: '#f59e0b', strokeWidth: 1 
            });
            group.add(rect);
        },
        render3D: (sceneGroup, entity, helpers) => {
            const sunshadeGroup = new THREE.Group();
            let baseElev = entity.elevation || 90;
            sunshadeGroup.position.set(entity.x, baseElev, entity.z);
            sunshadeGroup.rotation.y = -entity.angle;

            const thick = entity.thick || 20;
            const wallOffset = thick / 2; 
            // Default to pointing OUTSIDE (negative Z) for clockwise rooms
            const signZ = (entity.facing === -1) ? -1 : 1;
            
            const contentGroup = new THREE.Group();
            contentGroup.position.z = wallOffset * signZ;
            sunshadeGroup.add(contentGroup);

            let chajjaStyle = entity.chajjaType || 'concrete_slab';
            const matConcrete = helpers.getDynamicMaterial('concrete', 'wall');
            const cDepth = entity.depth || 40;
            
            let mmBox = matConcrete;
            let mmExtrude = matConcrete;
            if (helpers && helpers.getFaceMaterials) {
                const mats = helpers.getFaceMaterials(entity, matConcrete, { width: entity.width, height: cDepth });
                
                // Inherit painted material for unpainted faces of the sunshade
                const p = entity.params || {};
                const paintedMat = mats.box.find((m, i) => {
                    const key = ['textureRight', 'textureLeft', 'textureTop', 'textureBottom', 'textureFront', 'textureBack'][i];
                    return p[key];
                });
                if (paintedMat) {
                    for (let i = 0; i < 6; i++) {
                        const key = ['textureRight', 'textureLeft', 'textureTop', 'textureBottom', 'textureFront', 'textureBack'][i];
                        if (!p[key]) {
                            mats.box[i] = paintedMat;
                        }
                    }
                }
                
                mmBox = mats.box;
                mmExtrude = mats.extrude;
            }
            
            if (chajjaStyle === 'concrete_slab') {
                const cH = 2; 
                const cGeo = new THREE.BoxGeometry(entity.width, cH, cDepth); 
                const cMesh = new THREE.Mesh(cGeo, mmBox); 
                cMesh.position.set(0, cH/2, (cDepth/2) * signZ); 
                cMesh.castShadow = true; 
                contentGroup.add(cMesh);
            } else if (chajjaStyle === 'wooden_pergola' || chajjaStyle === 'metal_louvers') {
                const isWood = chajjaStyle === 'wooden_pergola';
                const cMat = isWood ? JALI_MATERIALS['wood'] : JALI_MATERIALS['metal_black'];
                const matLouver = new THREE.MeshStandardMaterial({
                    color: cMat.color, roughness: cMat.roughness, metalness: cMat.metalness
                });
                
                const cWidth = entity.width;
                const joistWidth = isWood ? 2 : 2;
                const joistHeight = isWood ? 8 : 8;
                const joistGeo = new THREE.BoxGeometry(joistWidth, joistHeight, cDepth);
                
                const jL = new THREE.Mesh(joistGeo, matLouver);
                jL.position.set(-cWidth/2 + joistWidth/2, joistHeight/2, (cDepth/2) * signZ);
                jL.castShadow = true;
                
                const jR = new THREE.Mesh(joistGeo, matLouver);
                jR.position.set(cWidth/2 - joistWidth/2, joistHeight/2, (cDepth/2) * signZ);
                jR.castShadow = true;
                
                contentGroup.add(jL, jR);
                
                const fasciaGeo = new THREE.BoxGeometry(cWidth, joistHeight, joistWidth);
                const fascia = new THREE.Mesh(fasciaGeo, matLouver);
                fascia.position.set(0, joistHeight/2, (cDepth - joistWidth/2) * signZ);
                fascia.castShadow = true;
                contentGroup.add(fascia);
                
                const numJoists = Math.max(3, Math.floor(cWidth / 40));
                if (numJoists > 2) {
                    const joistSpacing = (cWidth - joistWidth) / (numJoists - 1);
                    for (let i = 1; i < numJoists - 1; i++) {
                        const jM = new THREE.Mesh(joistGeo, matLouver);
                        jM.position.set(-cWidth/2 + joistWidth/2 + i * joistSpacing, joistHeight/2, (cDepth/2) * signZ);
                        jM.castShadow = true;
                        contentGroup.add(jM);
                    }
                }
                
                const louverThick = isWood ? 2 : 1; 
                const louverHeight = isWood ? 4 : 4;
                const spacing = isWood ? 8 : 8; 
                const numLouvers = Math.floor(cDepth / spacing);
                
                const lGeo = new THREE.BoxGeometry(cWidth, louverHeight, louverThick);
                
                for(let i=1; i<=numLouvers; i++) {
                    const l = new THREE.Mesh(lGeo, matLouver);
                    l.position.set(0, joistHeight + louverHeight/2 - (isWood ? 2 : 0), (i * spacing - louverThick/2) * signZ);
                    l.rotation.x = isWood ? 0 : (Math.PI / 4) * signZ;
                    l.castShadow = true;
                    contentGroup.add(l);
                }
            } else if (chajjaStyle === 'glass_canopy' || chajjaStyle === 'polycarbonate_canopy') {
                const isPoly = chajjaStyle === 'polycarbonate_canopy';
                const cWidth = entity.width; const glassThick = 0.5;
                const matGlassConf = WINDOW_GLASS_MATERIALS['clear'];
                
                let matCanopyPanel;
                if (isPoly) {
                    matCanopyPanel = new THREE.MeshPhysicalMaterial({
                        color: 0xffffff, transmission: 0.4, roughness: 0.6, transparent: true, ior: 1.2, thickness: 0.5
                    });
                } else {
                    matCanopyPanel = new THREE.MeshPhysicalMaterial({
                        color: matGlassConf.color, transmission: matGlassConf.transmission, roughness: matGlassConf.roughness, transparent: true, ior: matGlassConf.ior, thickness: 0.5
                    });
                }
                const matMetal = new THREE.MeshStandardMaterial({color: 0xe0e0e0, metalness: 0.9, roughness: 0.2});
                
                const frameThick = 1.5;
                const fSideGeo = new THREE.BoxGeometry(frameThick, frameThick, cDepth);
                const fFrontGeo = new THREE.BoxGeometry(cWidth, frameThick, frameThick);
                const fL = new THREE.Mesh(fSideGeo, matMetal); fL.position.set(-cWidth/2 + frameThick/2, frameThick/2, (cDepth/2)*signZ); fL.castShadow = true;
                const fR = new THREE.Mesh(fSideGeo, matMetal); fR.position.set(cWidth/2 - frameThick/2, frameThick/2, (cDepth/2)*signZ); fR.castShadow = true;
                const fF = new THREE.Mesh(fFrontGeo, matMetal); fF.position.set(0, frameThick/2, (cDepth - frameThick/2)*signZ); fF.castShadow = true;
                contentGroup.add(fL, fR, fF);
                
                const numPanes = Math.max(1, Math.floor(cWidth / 40));
                const paneWidth = (cWidth - frameThick * 2) / numPanes;
                for (let i = 1; i < numPanes; i++) {
                    const m = new THREE.Mesh(fSideGeo, matMetal);
                    m.position.set(-cWidth/2 + frameThick + i * paneWidth, frameThick/2, (cDepth/2)*signZ);
                    m.castShadow = true;
                    contentGroup.add(m);
                }

                const gGeo = new THREE.BoxGeometry(cWidth - frameThick*2, glassThick, cDepth - frameThick);
                const gMesh = new THREE.Mesh(gGeo, matCanopyPanel);
                gMesh.position.set(0, frameThick/2, (cDepth/2)*signZ);
                contentGroup.add(gMesh);
                
                const tieHeight = Math.max(15, cDepth * 0.6);
                const tieZ = cDepth * 0.8;
                
                const bracketGeo = new THREE.BoxGeometry(1, 4, 2);
                
                const rodPositions = [];
                if (numPanes > 1) {
                    rodPositions.push(-cWidth/2 + 4, cWidth/2 - 4);
                    for (let i=1; i<numPanes; i++) rodPositions.push(-cWidth/2 + frameThick + i * paneWidth);
                } else {
                    rodPositions.push(-cWidth/2 + 4, cWidth/2 - 4);
                }
                
                const bracketZ = 1; 
                const spiderY = frameThick/2 + 0.5;
                const dz = tieZ - bracketZ;
                const dy = tieHeight - spiderY;
                const tieLen = Math.hypot(dz, dy);
                const angle = Math.atan2(dz, dy);
                const tieGeo = new THREE.CylinderGeometry(0.2, 0.2, tieLen, 8);
                
                rodPositions.forEach(x => {
                    const tieGroup = new THREE.Group();
                    const tie = new THREE.Mesh(tieGeo, matMetal);
                    tie.position.set(0, spiderY + dy/2, ((bracketZ + tieZ)/2) * signZ);
                    tie.rotation.x = -angle * signZ;
                    tie.castShadow = true;
                    tieGroup.add(tie);
                    
                    const wBracket = new THREE.Mesh(bracketGeo, matMetal);
                    wBracket.position.set(0, tieHeight, bracketZ * signZ);
                    wBracket.castShadow = true;
                    tieGroup.add(wBracket);
                    
                    const spiderGeo = new THREE.CylinderGeometry(0.8, 0.8, 1, 8);
                    const spider = new THREE.Mesh(spiderGeo, matMetal);
                    spider.position.set(0, spiderY, tieZ * signZ);
                    spider.castShadow = true;
                    tieGroup.add(spider);
                    
                    tieGroup.position.x = x;
                    contentGroup.add(tieGroup);
                });
            } else if (chajjaStyle === 'metal_canopy') {
                const cWidth = entity.width;
                const matMetalDark = new THREE.MeshStandardMaterial({color: 0x222222, metalness: 0.5, roughness: 0.5});
                const matMetalRoof = new THREE.MeshStandardMaterial({color: 0x444444, metalness: 0.3, roughness: 0.8});
                
                const lipDrop = 4;
                const lipThick = 2;
                const roofThick = 2;
                
                const roofGeo = new THREE.BoxGeometry(cWidth, roofThick, cDepth);
                const roof = new THREE.Mesh(roofGeo, matMetalRoof);
                roof.position.set(0, lipDrop - roofThick/2, (cDepth/2)*signZ);
                roof.castShadow = true;
                contentGroup.add(roof);
                
                const fLipGeo = new THREE.BoxGeometry(cWidth, lipDrop, lipThick);
                const fLip = new THREE.Mesh(fLipGeo, matMetalDark);
                fLip.position.set(0, lipDrop/2, (cDepth - lipThick/2)*signZ);
                fLip.castShadow = true;
                contentGroup.add(fLip);
                
                const sLipGeo = new THREE.BoxGeometry(lipThick, lipDrop, cDepth - lipThick);
                const sL = new THREE.Mesh(sLipGeo, matMetalDark);
                sL.position.set(-cWidth/2 + lipThick/2, lipDrop/2, ((cDepth - lipThick)/2)*signZ);
                sL.castShadow = true;
                const sR = new THREE.Mesh(sLipGeo, matMetalDark);
                sR.position.set(cWidth/2 - lipThick/2, lipDrop/2, ((cDepth - lipThick)/2)*signZ);
                sR.castShadow = true;
                contentGroup.add(sL, sR);
            } else if (chajjaStyle === 'curved_rcc') {
                const cH = 4;
                const radius = Math.min(20, cDepth/2, entity.width/4);
                const halfW = entity.width/2;
                const shape = new THREE.Shape();
                shape.moveTo(-halfW, 0);
                shape.lineTo(-halfW, cDepth - radius);
                shape.quadraticCurveTo(-halfW, cDepth, -halfW + radius, cDepth);
                shape.lineTo(halfW - radius, cDepth);
                shape.quadraticCurveTo(halfW, cDepth, halfW, cDepth - radius);
                shape.lineTo(halfW, 0);
                shape.lineTo(-halfW, 0);
                
                const cGeo = new THREE.ExtrudeGeometry(shape, { depth: cH, bevelEnabled: false });
                const cMesh = new THREE.Mesh(cGeo, mmExtrude);
                cMesh.rotation.x = -Math.PI / 2; 
                if (signZ === 1) cMesh.rotation.y = Math.PI; 
                cMesh.position.set(0, 0, 0);
                cMesh.castShadow = true;
                contentGroup.add(cMesh);
            } else if (chajjaStyle === 'cantilever_rcc') {
                const cH = 2; 
                const cGeo = new THREE.BoxGeometry(entity.width, cH, cDepth);
                const cMesh = new THREE.Mesh(cGeo, mmBox);
                cMesh.position.set(0, cH/2, (cDepth/2) * signZ);
                cMesh.castShadow = true;
                contentGroup.add(cMesh);
            } else if (chajjaStyle === 'jali_canopy') {
                const cWidth = entity.width;
                const roofThick = 2;
                const dropH = 15;
                const matSolid = new THREE.MeshStandardMaterial({color: 0xf5f5f5, roughness: 0.9});
                
                const roofGeo = new THREE.BoxGeometry(cWidth, roofThick, cDepth);
                const roof = new THREE.Mesh(roofGeo, matSolid);
                roof.position.set(0, dropH - roofThick/2, (cDepth/2)*signZ);
                roof.castShadow = true;
                contentGroup.add(roof);
                
                const buildGrid = (w, h, mat) => {
                    const group = new THREE.Group();
                    const thick = 1;
                    const step = 5;
                    const hGeo = new THREE.BoxGeometry(w, thick, thick);
                    const vGeo = new THREE.BoxGeometry(thick, h, thick);
                    for (let y = -h/2 + step/2; y < h/2; y += step) {
                        const m = new THREE.Mesh(hGeo, mat);
                        m.position.y = y; m.castShadow = true;
                        group.add(m);
                    }
                    for (let x = -w/2 + step/2; x < w/2; x += step) {
                        const m = new THREE.Mesh(vGeo, mat);
                        m.position.x = x; m.castShadow = true;
                        group.add(m);
                    }
                    const t = new THREE.Mesh(new THREE.BoxGeometry(w, 2, 2), mat); t.position.y = h/2; t.castShadow = true; group.add(t);
                    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 2, 2), mat); b.position.y = -h/2; b.castShadow = true; group.add(b);
                    const l = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), mat); l.position.x = -w/2; l.castShadow = true; group.add(l);
                    const r = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), mat); r.position.x = w/2; r.castShadow = true; group.add(r);
                    return group;
                };
                
                const fJali = buildGrid(cWidth, dropH, matSolid);
                fJali.position.set(0, dropH/2, cDepth * signZ);
                if (signZ === -1) fJali.rotation.y = Math.PI;
                contentGroup.add(fJali);
                
                const sL = buildGrid(cDepth, dropH, matSolid);
                sL.position.set(-cWidth/2, dropH/2, (cDepth/2)*signZ);
                sL.rotation.y = -Math.PI / 2;
                
                const sR = buildGrid(cDepth, dropH, matSolid);
                sR.position.set(cWidth/2, dropH/2, (cDepth/2)*signZ);
                sR.rotation.y = Math.PI / 2;
                
                contentGroup.add(sL, sR);
            } else if (chajjaStyle === 'box_frame') {
                const cWidth = entity.width;
                const frameDrop = entity.frameHeight || 150;
                const frameThick = 6;
                
                const topGeo = new THREE.BoxGeometry(cWidth, frameThick, cDepth);
                const topM = new THREE.Mesh(topGeo, mmBox);
                topM.position.set(0, frameThick/2, (cDepth/2)*signZ);
                topM.castShadow = true;
                contentGroup.add(topM);
                
                const sideGeo = new THREE.BoxGeometry(frameThick, frameDrop, cDepth);
                const sL = new THREE.Mesh(sideGeo, mmBox);
                sL.position.set(-cWidth/2 + frameThick/2, -frameDrop/2 + frameThick, (cDepth/2)*signZ);
                sL.castShadow = true;
                
                const sR = new THREE.Mesh(sideGeo, mmBox);
                sR.position.set(cWidth/2 - frameThick/2, -frameDrop/2 + frameThick, (cDepth/2)*signZ);
                sR.castShadow = true;
                
                const botGeo = new THREE.BoxGeometry(cWidth, frameThick, cDepth);
                const botM = new THREE.Mesh(botGeo, mmBox);
                botM.position.set(0, -frameDrop + frameThick/2, (cDepth/2)*signZ);
                botM.castShadow = true;
                
                contentGroup.add(sL, sR, botM);
            }

            const hbHeight = chajjaStyle === 'box_frame' ? (entity.frameHeight || 150) : 10;
            const hbY = chajjaStyle === 'box_frame' ? -hbHeight/2 + 6 : 5;
            const hitboxGeo = new THREE.BoxGeometry(entity.width, hbHeight, cDepth);
            const hitbox = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}));
            hitbox.position.set(0, hbY, (cDepth/2)*signZ);
            hitbox.userData = { isHitbox: true };
            contentGroup.add(hitbox);
            sunshadeGroup.userData = { isWidget: true, entity: entity };
            sceneGroup.add(sunshadeGroup);
            return sunshadeGroup;
        }
    },
    'elevation_fascia': {
        widget: "elevation_fascia", label: "ELEVATION FASCIA", cutsWall: false,
        events: ["drag_along_wall", "snap_to_corners", "resize_handles_along_wall_axis"],
        defaultConfig: { width: 100, height: 120, depth: 40, thick: 10, elevation: 0, profileType: 'c_shape_left', fasciaMat: 'white' },
        render2D: (group, entity) => {
            const hw = entity.width / 2; const thick = entity.wall ? (entity.wall.thickness || entity.wall.config.thickness) : (entity.thick || 4);
            const w = entity.width; const h = thick;
            const rect = new Konva.Rect({ x: -hw, y: -h/2, width: w, height: h, fill: '#60a5fa', stroke: '#2563eb', strokeWidth: 2, opacity: 0.5 });
            group.add(rect);
            const d = entity.depth || 40;
            const projDir = entity.facing === 1 ? 1 : -1; 
            const projY = projDir === 1 ? h/2 : -h/2 - d;
            const projRect = new Konva.Rect({ x: -hw, y: projY, width: w, height: d, stroke: '#2563eb', strokeWidth: 1, dash: [4, 4] });
            group.add(projRect);
        },
        render3D: (sceneGroup, entity, helpers) => {
            let baseElev = entity.elevation || 0; let height = entity.height || 120;
            let width = entity.width || 100; let depth = entity.depth || 40; let thick = entity.thick || 10;
            const fasciaGroup = new THREE.Group(); fasciaGroup.position.set(entity.x, baseElev, entity.z); fasciaGroup.rotation.y = -entity.angle;
            
            let fColor = 0xffffff;
            if (entity.fasciaMat === 'dark_grey') fColor = 0x333333;
            else if (entity.fasciaMat === 'stone') fColor = 0xa8a29e;
            else if (entity.fasciaMat === 'wood') fColor = 0x8b5a2b;
            const matFascia = new THREE.MeshStandardMaterial({ color: fColor, roughness: 0.8 });
            
            let blockCounter = 0;
            const createBlock = (w, h, d, x, y, z, exposed = {}, blockRadii = [0,0,0,0]) => {
                let geo;
                if (!blockRadii.some(r => r > 0)) {
                    geo = new THREE.BoxGeometry(w, h, d);
                } else {
                    const shape = new THREE.Shape();
                    const [rBL, rBR, rTR, rTL] = blockRadii;
                    if (rBL > 0) { shape.moveTo(rBL, 0); shape.absarc(rBL, rBL, rBL, Math.PI, Math.PI*1.5, false); } else shape.moveTo(0, 0);
                    if (rBR > 0) { shape.lineTo(w - rBR, 0); shape.absarc(w - rBR, rBR, rBR, Math.PI*1.5, Math.PI*2, false); } else shape.lineTo(w, 0);
                    if (rTR > 0) { shape.lineTo(w, h - rTR); shape.absarc(w - rTR, h - rTR, rTR, 0, Math.PI*0.5, false); } else shape.lineTo(w, h);
                    if (rTL > 0) { shape.lineTo(rTL, h); shape.absarc(rTL, h - rTL, rTL, Math.PI*0.5, Math.PI, false); } else shape.lineTo(0, h);
                    shape.lineTo(rBL > 0 ? 0 : 0, rBL > 0 ? rBL : 0);
                    
                    const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 8 });
                    extrudeGeo.translate(-w/2, -h/2, -d/2);
                    
                    const geoNonIdx = extrudeGeo.toNonIndexed();
                    const pos = geoNonIdx.attributes.position.array;
                    const norm = geoNonIdx.attributes.normal.array;
                    
                    const groupedVerts = [[], [], [], [], [], []];
                    const groupedNorms = [[], [], [], [], [], []];
                    const groupedUVs = [[], [], [], [], [], []];
                    
                    for (let i = 0; i < pos.length / 9; i++) {
                        const nx = norm[i*9]; const ny = norm[i*9+1]; const nz = norm[i*9+2];
                        let matIndex = 0;
                        if (nz > 0.5) matIndex = 4;
                        else if (nz < -0.5) matIndex = 5;
                        else {
                            if (Math.abs(nx) > Math.abs(ny)) matIndex = nx > 0 ? 0 : 1;
                            else matIndex = ny > 0 ? 2 : 3;
                        }
                        
                        for(let j=0; j<3; j++) {
                            const vx = pos[i*9 + j*3]; const vy = pos[i*9 + j*3 + 1]; const vz = pos[i*9 + j*3 + 2];
                            groupedVerts[matIndex].push(vx, vy, vz);
                            groupedNorms[matIndex].push(norm[i*9 + j*3], norm[i*9 + j*3 + 1], norm[i*9 + j*3 + 2]);
                            
                            let u = 0, v = 0;
                            if (matIndex === 4) { u = (vx + w/2)/w; v = (vy + h/2)/h; }
                            else if (matIndex === 5) { u = (-vx + w/2)/w; v = (vy + h/2)/h; }
                            else if (matIndex === 0) { u = (-vz + d/2)/d; v = (vy + h/2)/h; }
                            else if (matIndex === 1) { u = (vz + d/2)/d; v = (vy + h/2)/h; }
                            else if (matIndex === 2) { u = (vx + w/2)/w; v = (-vz + d/2)/d; }
                            else if (matIndex === 3) { u = (vx + w/2)/w; v = (vz + d/2)/d; }
                            groupedUVs[matIndex].push(u, v);
                        }
                    }
                    
                    geo = new THREE.BufferGeometry();
                    let flatPos = [], flatNorm = [], flatUV = [];
                    let offset = 0;
                    for(let m=0; m<6; m++) {
                        const count = groupedVerts[m].length / 3;
                        if (count > 0) {
                            flatPos.push(...groupedVerts[m]); flatNorm.push(...groupedNorms[m]); flatUV.push(...groupedUVs[m]);
                            geo.addGroup(offset, count, m); offset += count;
                        }
                    }
                    geo.setAttribute('position', new THREE.Float32BufferAttribute(flatPos, 3));
                    geo.setAttribute('normal', new THREE.Float32BufferAttribute(flatNorm, 3));
                    geo.setAttribute('uv', new THREE.Float32BufferAttribute(flatUV, 2));
                    extrudeGeo.dispose(); geoNonIdx.dispose();
                }

                let materials = matFascia;
                const blockIndex = blockCounter++;
                if (helpers && helpers.getFaceMaterials) {
                    const blockEntity = { params: {} };
                    if (entity.params) {
                        Object.assign(blockEntity.params, entity.params);
                        delete blockEntity.params.texture; delete blockEntity.params.textureFront; delete blockEntity.params.textureBack;
                        delete blockEntity.params.textureLeft; delete blockEntity.params.textureRight; delete blockEntity.params.textureTop; delete blockEntity.params.textureBottom; delete blockEntity.params.textureSides;
                    }
                    if (entity.params && entity.params.blocks && entity.params.blocks[blockIndex]) {
                        Object.assign(blockEntity.params, entity.params.blocks[blockIndex]);
                    }
                    const multiMat = helpers.getFaceMaterials(blockEntity, matFascia, { width: w, height: h });
                    materials = [ multiMat.box[0], multiMat.box[1], multiMat.box[2], multiMat.box[3], multiMat.box[4], multiMat.box[5] ];
                }
                const mesh = new THREE.Mesh(geo, materials);
                mesh.position.set(x, y + h/2, z);
                mesh.castShadow = true; mesh.receiveShadow = true;
                return mesh;
            };

            const createInnerFillet = (r, d, x, y, z, quad) => {
                if (!r || r <= 0) return;
                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                if (quad === 1) { shape.lineTo(r, 0); shape.absarc(r, r, r, Math.PI*1.5, Math.PI, true); shape.lineTo(0, r); }
                else if (quad === 2) { shape.lineTo(0, r); shape.absarc(-r, r, r, 0, Math.PI*1.5, true); shape.lineTo(-r, 0); }
                else if (quad === 3) { shape.lineTo(-r, 0); shape.absarc(-r, -r, r, Math.PI*0.5, 0, true); shape.lineTo(0, -r); }
                else if (quad === 4) { shape.lineTo(0, -r); shape.absarc(r, -r, r, Math.PI, Math.PI*0.5, true); shape.lineTo(r, 0); }
                shape.lineTo(0, 0);
                
                const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 8 });
                extrudeGeo.translate(0, 0, -d/2);
                const geoNonIdx = extrudeGeo.toNonIndexed();
                const pos = geoNonIdx.attributes.position.array;
                const norm = geoNonIdx.attributes.normal.array;
                
                const groupedVerts = [[], [], [], [], [], []];
                const groupedNorms = [[], [], [], [], [], []];
                const groupedUVs = [[], [], [], [], [], []];
                for (let i = 0; i < pos.length / 9; i++) {
                    const nx = norm[i*9]; const ny = norm[i*9+1]; const nz = norm[i*9+2];
                    let matIndex = 0;
                    if (nz > 0.5) matIndex = 4; else if (nz < -0.5) matIndex = 5;
                    else { if (Math.abs(nx) > Math.abs(ny)) matIndex = nx > 0 ? 0 : 1; else matIndex = ny > 0 ? 2 : 3; }
                    for(let j=0; j<3; j++) {
                        const vx = pos[i*9 + j*3]; const vy = pos[i*9 + j*3 + 1]; const vz = pos[i*9 + j*3 + 2];
                        groupedVerts[matIndex].push(vx, vy, vz); groupedNorms[matIndex].push(norm[i*9 + j*3], norm[i*9 + j*3 + 1], norm[i*9 + j*3 + 2]);
                        let u = 0, v = 0;
                        if (matIndex === 4) { u = vx/r; v = vy/r; } else if (matIndex === 5) { u = -vx/r; v = vy/r; }
                        else if (matIndex === 0) { u = -vz/d; v = vy/r; } else if (matIndex === 1) { u = vz/d; v = vy/r; }
                        else if (matIndex === 2) { u = vx/r; v = -vz/d; } else if (matIndex === 3) { u = vx/r; v = vz/d; }
                        groupedUVs[matIndex].push(u, v);
                    }
                }
                const geo = new THREE.BufferGeometry();
                let flatPos = [], flatNorm = [], flatUV = []; let offset = 0;
                for(let m=0; m<6; m++) {
                    const count = groupedVerts[m].length / 3;
                    if (count > 0) { flatPos.push(...groupedVerts[m]); flatNorm.push(...groupedNorms[m]); flatUV.push(...groupedUVs[m]); geo.addGroup(offset, count, m); offset += count; }
                }
                geo.setAttribute('position', new THREE.Float32BufferAttribute(flatPos, 3));
                geo.setAttribute('normal', new THREE.Float32BufferAttribute(flatNorm, 3));
                geo.setAttribute('uv', new THREE.Float32BufferAttribute(flatUV, 2));
                extrudeGeo.dispose(); geoNonIdx.dispose();

                let materials = matFascia;
                if (helpers && helpers.getFaceMaterials) {
                    const multiMat = helpers.getFaceMaterials(entity, matFascia, { width: r, height: r });
                    materials = [multiMat.box[0], multiMat.box[1], multiMat.box[2], multiMat.box[3], multiMat.box[4], multiMat.box[5]];
                }
                const mesh = new THREE.Mesh(geo, materials);
                mesh.position.set(x, y, z);
                mesh.castShadow = true; mesh.receiveShadow = true;
                fasciaGroup.add(mesh);
            };
            
            const wallThick = entity.wall ? (entity.wall.thickness || entity.wall.config.thickness) : 16;
            const zOffset = (entity.facing === -1) ? (wallThick/2 + depth/2) : -(wallThick/2 + depth/2);

            let topArm = entity.topArm !== undefined ? entity.topArm : width;
            let bottomArm = entity.bottomArm !== undefined ? entity.bottomArm : width;

            const radii = entity.cornerRadii || [];
            const getR = (idx) => Math.max(0, radii[idx] || 0);

            if (entity.profileType === 'c_shape_left') {
                fasciaGroup.add(createBlock(topArm, thick, depth, -width/2 + topArm/2, height - thick, zOffset, { bottom: false }, [0, getR(5), getR(6), getR(7)])); 
                fasciaGroup.add(createBlock(thick, height - 2*thick, depth, -width/2 + thick/2, thick, zOffset, { top: false, bottom: false, right: false })); 
                fasciaGroup.add(createBlock(bottomArm, thick, depth, -width/2 + bottomArm/2, 0, zOffset, { top: false }, [getR(0), getR(1), getR(2), 0])); 
                createInnerFillet(getR(3), depth, -width/2 + thick, thick, zOffset, 1);
                createInnerFillet(getR(4), depth, -width/2 + thick, height - thick, zOffset, 4);
                entity.computedPts = [ new THREE.Vector2(-width/2, 0), new THREE.Vector2(-width/2 + bottomArm, 0), new THREE.Vector2(-width/2 + bottomArm, thick), new THREE.Vector2(-width/2 + thick, thick), new THREE.Vector2(-width/2 + thick, height - thick), new THREE.Vector2(-width/2 + topArm, height - thick), new THREE.Vector2(-width/2 + topArm, height), new THREE.Vector2(-width/2, height) ];
            } else if (entity.profileType === 'c_shape_right') {
                fasciaGroup.add(createBlock(topArm, thick, depth, width/2 - topArm/2, height - thick, zOffset, { bottom: false }, [getR(4), 0, getR(2), getR(3)])); 
                fasciaGroup.add(createBlock(thick, height - 2*thick, depth, width/2 - thick/2, thick, zOffset, { top: false, bottom: false, left: false })); 
                fasciaGroup.add(createBlock(bottomArm, thick, depth, width/2 - bottomArm/2, 0, zOffset, { top: false }, [getR(0), getR(1), 0, getR(7)])); 
                createInnerFillet(getR(5), depth, width/2 - thick, height - thick, zOffset, 3);
                createInnerFillet(getR(6), depth, width/2 - thick, thick, zOffset, 2);
                entity.computedPts = [ new THREE.Vector2(width/2 - bottomArm, 0), new THREE.Vector2(width/2, 0), new THREE.Vector2(width/2, height), new THREE.Vector2(width/2 - topArm, height), new THREE.Vector2(width/2 - topArm, height - thick), new THREE.Vector2(width/2 - thick, height - thick), new THREE.Vector2(width/2 - thick, thick), new THREE.Vector2(width/2 - bottomArm, thick) ];
            } else if (entity.profileType === 'l_shape_left') {
                fasciaGroup.add(createBlock(topArm, thick, depth, -width/2 + topArm/2, height - thick, zOffset, { bottom: false }, [0, getR(3), getR(4), getR(5)])); 
                fasciaGroup.add(createBlock(thick, height - thick, depth, -width/2 + thick/2, 0, zOffset, { top: false, right: false }, [getR(0), getR(1), 0, 0])); 
                createInnerFillet(getR(2), depth, -width/2 + thick, height - thick, zOffset, 4);
                entity.computedPts = [ new THREE.Vector2(-width/2, 0), new THREE.Vector2(-width/2 + thick, 0), new THREE.Vector2(-width/2 + thick, height - thick), new THREE.Vector2(-width/2 + topArm, height - thick), new THREE.Vector2(-width/2 + topArm, height), new THREE.Vector2(-width/2, height) ];
            } else if (entity.profileType === 'l_shape_right') {
                fasciaGroup.add(createBlock(topArm, thick, depth, width/2 - topArm/2, height - thick, zOffset, { bottom: false }, [getR(4), 0, 0, getR(3)])); 
                fasciaGroup.add(createBlock(thick, height - thick, depth, width/2 - thick/2, 0, zOffset, { top: false, left: false }, [0, getR(1), getR(2), 0])); 
                createInnerFillet(getR(5), depth, width/2 - thick, height - thick, zOffset, 3);
                entity.computedPts = [ new THREE.Vector2(width/2 - thick, 0), new THREE.Vector2(width/2, 0), new THREE.Vector2(width/2, height), new THREE.Vector2(width/2 - topArm, height), new THREE.Vector2(width/2 - topArm, height - thick), new THREE.Vector2(width/2 - thick, height - thick) ];
            } else if (entity.profileType === 'full_box') {
                fasciaGroup.add(createBlock(width, thick, depth, 0, height - thick, zOffset, { bottom: false }, [0, 0, getR(2), getR(3)])); 
                fasciaGroup.add(createBlock(width, thick, depth, 0, 0, zOffset, { top: false }, [getR(0), getR(1), 0, 0])); 
                fasciaGroup.add(createBlock(thick, height - 2*thick, depth, -width/2 + thick/2, thick, zOffset, { top: false, bottom: false, right: false })); 
                fasciaGroup.add(createBlock(thick, height - 2*thick, depth, width/2 - thick/2, thick, zOffset, { top: false, bottom: false, left: false })); 
                createInnerFillet(getR(4), depth, -width/2 + thick, thick, zOffset, 1);
                createInnerFillet(getR(5), depth, -width/2 + thick, height - thick, zOffset, 4);
                createInnerFillet(getR(6), depth, width/2 - thick, height - thick, zOffset, 3);
                createInnerFillet(getR(7), depth, width/2 - thick, thick, zOffset, 2);
                entity.computedPts = [ new THREE.Vector2(-width/2, 0), new THREE.Vector2(width/2, 0), new THREE.Vector2(width/2, height), new THREE.Vector2(-width/2, height), new THREE.Vector2(-width/2 + thick, thick), new THREE.Vector2(-width/2 + thick, height - thick), new THREE.Vector2(width/2 - thick, height - thick), new THREE.Vector2(width/2 - thick, thick) ];
            }
            
            entity.computedZOffset = zOffset;

            const hitboxGeo = new THREE.BoxGeometry(width + 10, height + 10, depth + 20);
            const hitbox = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}));
            hitbox.position.set(0, height/2, zOffset); fasciaGroup.add(hitbox);
            
            fasciaGroup.userData = { isWidget: true, entity: entity }; sceneGroup.add(fasciaGroup);
            return fasciaGroup;
        }
    }
};
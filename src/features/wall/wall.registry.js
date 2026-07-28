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

export const WALL_DECOR_REGISTRY = {
    'brick_wall': {
        id: 'brick_wall',
        name: 'Red Bricks',
        texture: 'models/wall/redbrick.png', 
        thumbnail: 'https://threejs.org/examples/textures/brick_diffuse.jpg', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2, 
        defaultRepeat: 3   
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

export const MARBLE_REGISTRY = {
    'marble_calacatta_gold': {
        id: 'marble_calacatta_gold',
        name: 'Italian Calacatta',
        texture: 'textures/marbles/marble_calacatta_gold.png',
        thumbnail: 'textures/marbles/marble_calacatta_gold.png',
        roughness: 0.12, clearcoat: 0.90
    },
    'marble_statuario_venato': {
        id: 'marble_statuario_venato',
        name: 'High-Contrast Statuario',
        texture: 'textures/marbles/marble_statuario_venato.png',
        thumbnail: 'textures/marbles/marble_statuario_venato.png',
        roughness: 0.10, clearcoat: 0.95
    },
    'marble_blue_sodalite': {
        id: 'marble_blue_sodalite',
        name: 'Royal Sodalite Blue',
        texture: 'textures/marbles/marble_blue_sodalite.png',
        thumbnail: 'textures/marbles/marble_blue_sodalite.png',
        roughness: 0.12, clearcoat: 0.90
    },
    'marble_onyx_amber': {
        id: 'marble_onyx_amber',
        name: 'Translucent Honey Onyx',
        texture: 'textures/marbles/marble_onyx_amber.png',
        thumbnail: 'textures/marbles/marble_onyx_amber.png',
        roughness: 0.08, clearcoat: 0.98
    },
    'marble_sahara_noir': {
        id: 'marble_sahara_noir',
        name: 'Sahara Noir',
        texture: 'textures/marbles/marble_sahara_noir.png',
        thumbnail: 'textures/marbles/marble_sahara_noir.png',
        roughness: 0.10, clearcoat: 0.92
    },
    'marble_carrara': {
        id: 'marble_carrara',
        name: 'Italian Carrara White',
        texture: 'textures/marbles/marble_carrara.png',
        thumbnail: 'textures/marbles/marble_carrara.png',
        roughness: 0.15, clearcoat: 0.85
    },
    'marble_nero_marquina': {
        id: 'marble_nero_marquina',
        name: 'Nero Marquina Black',
        texture: 'textures/marbles/marble_nero_marquina.png',
        thumbnail: 'textures/marbles/marble_nero_marquina.png',
        roughness: 0.12, clearcoat: 0.90
    },
    'marble_verde_guatemala': {
        id: 'marble_verde_guatemala',
        name: 'Emerald Verde Guatemala',
        texture: 'textures/marbles/marble_verde_guatemala.png',
        thumbnail: 'textures/marbles/marble_verde_guatemala.png',
        roughness: 0.15, clearcoat: 0.80
    },
    'marble_emperador_dark': {
        id: 'marble_emperador_dark',
        name: 'Dark Emperador Chocolate',
        texture: 'textures/marbles/marble_emperador_dark.png',
        thumbnail: 'textures/marbles/marble_emperador_dark.png',
        roughness: 0.18, clearcoat: 0.80
    },
    'marble_calacatta_viola': {
        id: 'marble_calacatta_viola',
        name: 'Italian Calacatta Viola',
        texture: 'textures/marbles/marble_calacatta_viola.png',
        thumbnail: 'textures/marbles/marble_calacatta_viola.png',
        roughness: 0.14, clearcoat: 0.88
    }
};

export const STONE_REGISTRY = {
    'stone_stacked_fieldstone': {
        id: 'stone_stacked_fieldstone',
        name: 'Rustic Stacked Fieldstone',
        texture: 'textures/stones/stone_stacked_fieldstone.png',
        thumbnail: 'textures/stones/stone_stacked_fieldstone.png',
        roughness: 0.8
    },
    'stone_slate_charcoal': {
        id: 'stone_slate_charcoal',
        name: 'Charcoal Black Cleft Slate',
        texture: 'textures/stones/stone_slate_charcoal.png',
        thumbnail: 'textures/stones/stone_slate_charcoal.png',
        roughness: 0.65, clearcoat: 0.1
    },
    'stone_travertine_beige': {
        id: 'stone_travertine_beige',
        name: 'Roman Ivory Travertine Limestone',
        texture: 'textures/stones/stone_travertine_beige.png',
        thumbnail: 'textures/stones/stone_travertine_beige.png',
        roughness: 0.4, clearcoat: 0.2
    },
    'stone_granite_black': {
        id: 'stone_granite_black',
        name: 'Polished Black Absolute Granite',
        texture: 'textures/stones/stone_granite_black.png',
        thumbnail: 'textures/stones/stone_granite_black.png',
        roughness: 0.18, clearcoat: 0.75
    },
    'stone_sandstone_golden': {
        id: 'stone_sandstone_golden',
        name: 'Desert Golden Amber Sandstone',
        texture: 'textures/stones/stone_sandstone_golden.png',
        thumbnail: 'textures/stones/stone_sandstone_golden.png',
        roughness: 0.7, clearcoat: 0.05
    },
    'stone_basalt_lava': {
        id: 'stone_basalt_lava',
        name: 'Volcanic Charcoal Basalt Stone',
        texture: 'textures/stones/stone_basalt_lava.png',
        thumbnail: 'textures/stones/stone_basalt_lava.png',
        roughness: 0.6, clearcoat: 0.15
    },
    'stone_limestone_portuguese': {
        id: 'stone_limestone_portuguese',
        name: 'Portuguese Cream Limestone',
        texture: 'textures/stones/stone_limestone_portuguese.png',
        thumbnail: 'textures/stones/stone_limestone_portuguese.png',
        roughness: 0.35, clearcoat: 0.3
    },
    'stone_wall': {
        id: 'stone_wall',
        name: 'Rough Hewn Fieldstone',
        texture: 'models/wall/stone.png',
        thumbnail: 'models/wall/stone.png',
        roughness: 0.85
    },
    'brick_1_orange': {
        id: 'brick_1_orange',
        name: 'Orange Textured Brick Stone',
        texture: 'models/wall/brick_1_orange.png',
        thumbnail: 'models/wall/brick_1_orange.png',
        roughness: 0.75
    },
    'brick_2_mixed': {
        id: 'brick_2_mixed',
        name: 'Mixed Brown Brick Stone',
        texture: 'models/wall/brick_2_mixed.png',
        thumbnail: 'models/wall/brick_2_mixed.png',
        roughness: 0.75
    },
    'brick_3_red': {
        id: 'brick_3_red',
        name: 'Classic Red Brick Stone',
        texture: 'models/wall/brick_3_red.png',
        thumbnail: 'models/wall/brick_3_red.png',
        roughness: 0.75
    },
    'brick_4_burgundy': {
        id: 'brick_4_burgundy',
        name: 'Dark Burgundy Brick Stone',
        texture: 'models/wall/brick_4_burgundy.png',
        thumbnail: 'models/wall/brick_4_burgundy.png',
        roughness: 0.75
    },
    'brick_5_cream': {
        id: 'brick_5_cream',
        name: 'Cream Sand Brick Stone',
        texture: 'models/wall/brick_5_cream.png',
        thumbnail: 'models/wall/brick_5_cream.png',
        roughness: 0.75
    },
    'brick_6_beige': {
        id: 'brick_6_beige',
        name: 'Light Beige Brick Stone',
        texture: 'models/wall/brick_6_beige.png',
        thumbnail: 'models/wall/brick_6_beige.png',
        roughness: 0.75
    },
    'brick_7_yellow': {
        id: 'brick_7_yellow',
        name: 'Yellow Ochre Brick Stone',
        texture: 'models/wall/brick_7_yellow.png',
        thumbnail: 'models/wall/brick_7_yellow.png',
        roughness: 0.75
    },
    'brick_8_white': {
        id: 'brick_8_white',
        name: 'White Grey Brick Stone',
        texture: 'models/wall/brick_8_white.png',
        thumbnail: 'models/wall/brick_8_white.png',
        roughness: 0.75
    },
    'brick_9_grey': {
        id: 'brick_9_grey',
        name: 'Grey Brown Brick Stone',
        texture: 'models/wall/brick_9_grey.png',
        thumbnail: 'models/wall/brick_9_grey.png',
        roughness: 0.75
    }
};

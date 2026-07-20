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
    'crepe_satin': {
        id: 'crepe_satin',
        name: 'Fabric: Crepe Satin',
        texture: 'textures/fabrics/crepe_satin/diffuse.jpg',
        thumbnail: 'textures/fabrics/crepe_satin/diffuse.jpg',
        normal: 'textures/fabrics/crepe_satin/normal.jpg',
        roughnessMap: 'textures/fabrics/crepe_satin/roughness.jpg',
        defaultRepeat: 4,
        roughness: 0.6
    },
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

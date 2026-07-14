export const WORKSPACE_2D_SHAPES = {
    'couch': "M 5 5 L 95 5 L 95 95 L 5 95 Z M 20 30 L 80 30 L 80 95 L 20 95 Z M 20 30 L 20 5 M 80 30 L 80 5 M 40 30 L 40 95 M 60 30 L 60 95",
    'chair': "M 15 15 L 85 15 L 85 85 L 15 85 Z M 25 35 L 75 35 L 75 85 L 25 85 Z M 25 35 L 25 15 M 75 35 L 75 15 M 40 15 L 40 35 M 50 15 L 50 35 M 60 15 L 60 35",
    'bench': "M 10 20 L 90 20 L 90 80 L 10 80 Z M 10 35 L 90 35 M 20 35 L 20 80 M 80 35 L 80 80",
    'bed': "M 5 5 L 95 5 L 95 95 L 5 95 Z M 5 25 L 95 25 M 15 10 L 40 10 L 40 20 L 15 20 Z M 60 10 L 85 10 L 85 20 L 60 20 Z M 5 35 L 95 35",
    'tv_unit': "M 10 30 L 90 30 L 90 70 L 10 70 Z M 15 35 L 85 35 L 85 65 L 15 65 Z",
    'kitchen_straight': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 0 35 L 100 35",
    'kitchen_l_shape': "M 0 0 L 100 0 L 100 30 L 30 30 L 30 100 L 0 100 Z",
    'kitchen_u_shape': "M 0 0 L 100 0 L 100 100 L 70 100 L 70 30 L 30 30 L 30 100 L 0 100 Z",
    'default': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 0 0 L 100 100 M 100 0 L 0 100"
};

export const FURNITURE_REGISTRY = {
    'kitchen_straight': {
        id: 'kitchen_straight', label: 'Straight Kitchen',
        procedural: true,
        default: { width: 240, height: 90, depth: 60 },
        shape2D: 'kitchen_straight'
    },
    'kitchen_l_shape': {
        id: 'kitchen_l_shape', label: 'L-Shape Kitchen',
        procedural: true,
        default: { width: 240, height: 90, depth: 240 },
        shape2D: 'kitchen_l_shape'
    },
    'kitchen_u_shape': {
        id: 'kitchen_u_shape', label: 'U-Shape Kitchen',
        procedural: true,
        default: { width: 240, height: 90, depth: 240 },
        shape2D: 'kitchen_u_shape'
    },
    'kitchen_straight_upper': {
        id: 'kitchen_straight_upper', label: 'Straight Upper Cabinets',
        procedural: true,
        default: { width: 240, height: 70, depth: 35 },
        shape2D: 'kitchen_straight'
    },
    'kitchen_l_shape_upper': {
        id: 'kitchen_l_shape_upper', label: 'L-Shape Upper Cabinets',
        procedural: true,
        default: { width: 240, height: 70, depth: 240 },
        shape2D: 'kitchen_l_shape'
    },
    'kitchen_u_shape_upper': {
        id: 'kitchen_u_shape_upper', label: 'U-Shape Upper Cabinets',
        procedural: true,
        default: { width: 240, height: 70, depth: 240 },
        shape2D: 'kitchen_u_shape'
    },
    'table_dining': {
        id: 'table_dining',
        name: 'Bench',
        model: 'models/table_dining.glb',
        preview: 'https://via.placeholder.com/150/8B4513/FFFFFF?text=Bench',
        default: { width: 100, height: 40, depth: 60 },
        editable: { resize: true, rotation: true, move: true },
        shape2D: 'bench'
    }
};

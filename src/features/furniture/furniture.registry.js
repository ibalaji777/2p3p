export const WORKSPACE_2D_SHAPES = {
    'couch': "M 5 5 L 95 5 L 95 95 L 5 95 Z M 20 30 L 80 30 L 80 95 L 20 95 Z M 20 30 L 20 5 M 80 30 L 80 5 M 40 30 L 40 95 M 60 30 L 60 95",
    'chair': "M 15 15 L 85 15 L 85 85 L 15 85 Z M 25 35 L 75 35 L 75 85 L 25 85 Z M 25 35 L 25 15 M 75 35 L 75 15 M 40 15 L 40 35 M 50 15 L 50 35 M 60 15 L 60 35",
    'table_dining': "M 20 25 L 80 25 L 80 75 L 20 75 Z M 25 10 L 40 10 L 40 20 L 25 20 Z M 60 10 L 75 10 L 75 20 L 60 20 Z M 25 80 L 40 80 L 40 90 L 25 90 Z M 60 80 L 75 80 L 75 90 L 60 90 Z M 5 40 L 15 40 L 15 60 L 5 60 Z M 85 40 L 95 40 L 95 60 L 85 60 Z",
    'bed': "M 5 5 L 95 5 L 95 95 L 5 95 Z M 5 25 L 95 25 M 15 10 L 40 10 L 40 20 L 15 20 Z M 60 10 L 85 10 L 85 20 L 60 20 Z M 5 35 L 95 35",
    'tv_unit': "M 10 30 L 90 30 L 90 70 L 10 70 Z M 15 35 L 85 35 L 85 65 L 15 65 Z",
    'default': "M 0 0 L 100 0 L 100 100 L 0 100 Z M 0 0 L 100 100 M 100 0 L 0 100"
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

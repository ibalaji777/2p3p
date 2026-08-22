/**
 * Type-safe CAD/BIM Material Slots, Component Types, and Explicit Inheritance Definitions.
 * Architectural roles separate components logically (Frame, Sashes, Glass, Hardware, Seals, Screen).
 */

export const MaterialSlots = {
    FRAME: 'frame',
    LEAF: 'leaf',
    GLASS: 'glass',
    HARDWARE: 'hardware',
    SEAL: 'seal',
    SCREEN: 'screen',
    GRILLE: 'grille',
    TRIM: 'trim',
    WALL_FRONT: 'wall_front',
    WALL_BACK: 'wall_back',
    WALL_LEFT: 'wall_left',
    WALL_RIGHT: 'wall_right',
    WALL_TOP: 'wall_top',
    WALL_BOTTOM: 'wall_bottom',
    CUSTOM: 'custom',
    
    // Architectural Moldings & Skirting
    SKIRTING: 'skirting',
    BASEBOARD: 'baseboard',
    MOLDING: 'molding',

    // Soft Furnishings & Fabrics
    FABRIC: 'fabric',
    SHEER: 'sheer',
    DRAPES: 'drapes',
    CARPET: 'carpet',
    BORDER: 'border',
    FRINGES: 'fringes',
    ROD: 'rod',
    RINGS: 'rings',
    FINIALS: 'finials',
    PELMET: 'pelmet',
    CASSETTE: 'cassette',
    HEADRAIL: 'headrail',
    CHAIN: 'chain',
    POT: 'pot',
    FOLIAGE: 'foliage',
    CANVAS: 'canvas',
    PHOTO: 'photo',
    MATTING: 'matting',
    DIAL: 'dial',
    HANDS: 'hands',
    RIM: 'rim',
    CUSHION_A: 'cushionA',
    CUSHION_B: 'cushionB',
    VASE_A: 'vaseA',
    VASE_B: 'vaseB',
    COVER: 'cover',
    PAGES: 'pages',
    PLATES: 'plates',
    CUTLERY: 'cutlery',

    // Stairs
    TREADS: 'treads',
    RISERS: 'risers',
    STRINGERS: 'stringers',
    LANDINGS: 'landings',
    
    // Railings
    HANDRAIL: 'handrail',
    BALUSTERS: 'balusters',
    POSTS: 'posts',
    BOTTOM_RAIL: 'bottom_rail'
};

export const ComponentTypes = {
    FRAME: 'frame',
    SASH: 'sash',
    LEAF: 'leaf',
    GLASS: 'glass',
    HARDWARE: 'hardware',
    SEAL: 'seal',
    SCREEN: 'screen',
    TRIM: 'trim',
    WALL: 'wall',
    WIDGET: 'widget',
    STAIRCASE: 'staircase',
    RAILING: 'railing',
    CURTAIN: 'curtain',
    RUG: 'rug',
    DECOR: 'decor',
    SKIRTING: 'skirting',
    BASEBOARD: 'baseboard',
    MOLDING: 'molding'
};

export const SLOT_DEFINITIONS = {
    [MaterialSlots.FRAME]: { id: MaterialSlots.FRAME, label: 'Outer Frame', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.LEAF]: { id: MaterialSlots.LEAF, label: 'Leaf / Sash', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.GLASS]: { id: MaterialSlots.GLASS, label: 'Glass Panes', inherits: null, paintable: true, defaultCategory: 'glass' },
    [MaterialSlots.HARDWARE]: { id: MaterialSlots.HARDWARE, label: 'Hardware', inherits: null, paintable: false, defaultCategory: 'metal' },
    [MaterialSlots.SEAL]: { id: MaterialSlots.SEAL, label: 'Seals & Gaskets', inherits: null, paintable: false, defaultCategory: 'plastic' },
    [MaterialSlots.SCREEN]: { id: MaterialSlots.SCREEN, label: 'Insect Screen', inherits: null, paintable: false, defaultCategory: 'fabric' },
    [MaterialSlots.TRIM]: { id: MaterialSlots.TRIM, label: 'Trim & Architrave', inherits: MaterialSlots.FRAME, paintable: false, defaultCategory: 'wood' },
    [MaterialSlots.SKIRTING]: { id: MaterialSlots.SKIRTING, label: 'Skirting / Baseboard', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.BASEBOARD]: { id: MaterialSlots.BASEBOARD, label: 'Baseboard', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.MOLDING]: { id: MaterialSlots.MOLDING, label: 'Molding Profile', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.WALL_FRONT]: { id: MaterialSlots.WALL_FRONT, label: 'Front Wall Face', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.WALL_BACK]: { id: MaterialSlots.WALL_BACK, label: 'Back Wall Face', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.WALL_LEFT]: { id: MaterialSlots.WALL_LEFT, label: 'Left Wall Face', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.WALL_RIGHT]: { id: MaterialSlots.WALL_RIGHT, label: 'Right Wall Face', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.WALL_TOP]: { id: MaterialSlots.WALL_TOP, label: 'Top Wall Face', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.WALL_BOTTOM]: { id: MaterialSlots.WALL_BOTTOM, label: 'Bottom Wall Face', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.CUSTOM]: { id: MaterialSlots.CUSTOM, label: 'Custom Accent', inherits: null, paintable: true, defaultCategory: 'categories' },

    // Soft Furnishings & Fabrics
    [MaterialSlots.FABRIC]: { id: MaterialSlots.FABRIC, label: 'Fabric / Drapery', inherits: null, paintable: true, defaultCategory: 'fabric' },
    [MaterialSlots.SHEER]: { id: MaterialSlots.SHEER, label: 'Sheer Fabric', inherits: null, paintable: true, defaultCategory: 'fabric' },
    [MaterialSlots.DRAPES]: { id: MaterialSlots.DRAPES, label: 'Drapery Fabric', inherits: null, paintable: true, defaultCategory: 'fabric' },
    [MaterialSlots.CARPET]: { id: MaterialSlots.CARPET, label: 'Rug / Carpet Pile', inherits: null, paintable: true, defaultCategory: 'fabric' },
    [MaterialSlots.BORDER]: { id: MaterialSlots.BORDER, label: 'Rug Border', inherits: null, paintable: true, defaultCategory: 'fabric' },
    [MaterialSlots.FRINGES]: { id: MaterialSlots.FRINGES, label: 'Fringes & Tassels', inherits: null, paintable: true, defaultCategory: 'fabric' },
    [MaterialSlots.ROD]: { id: MaterialSlots.ROD, label: 'Curtain Rod', inherits: null, paintable: true, defaultCategory: 'metal' },
    [MaterialSlots.RINGS]: { id: MaterialSlots.RINGS, label: 'Curtain Rings', inherits: null, paintable: true, defaultCategory: 'metal' },
    [MaterialSlots.FINIALS]: { id: MaterialSlots.FINIALS, label: 'Curtain Finials', inherits: null, paintable: true, defaultCategory: 'metal' },
    [MaterialSlots.PELMET]: { id: MaterialSlots.PELMET, label: 'Pelmet Cornice', inherits: null, paintable: true, defaultCategory: 'wood' },
    [MaterialSlots.CASSETTE]: { id: MaterialSlots.CASSETTE, label: 'Blind Cassette', inherits: null, paintable: true, defaultCategory: 'metal' },
    [MaterialSlots.HEADRAIL]: { id: MaterialSlots.HEADRAIL, label: 'Headrail', inherits: null, paintable: true, defaultCategory: 'wood' },
    [MaterialSlots.CHAIN]: { id: MaterialSlots.CHAIN, label: 'Pull Chain', inherits: null, paintable: true, defaultCategory: 'metal' },
    [MaterialSlots.POT]: { id: MaterialSlots.POT, label: 'Planter Pot', inherits: null, paintable: true, defaultCategory: 'stone' },
    [MaterialSlots.FOLIAGE]: { id: MaterialSlots.FOLIAGE, label: 'Botanical Foliage', inherits: null, paintable: true, defaultCategory: 'plastic' },
    [MaterialSlots.CANVAS]: { id: MaterialSlots.CANVAS, label: 'Canvas Artwork', inherits: null, paintable: true, defaultCategory: 'fabric' },
    [MaterialSlots.PHOTO]: { id: MaterialSlots.PHOTO, label: 'Photograph Print', inherits: null, paintable: true, defaultCategory: 'fabric' },
    [MaterialSlots.MATTING]: { id: MaterialSlots.MATTING, label: 'Photo Matting Board', inherits: null, paintable: true, defaultCategory: 'plastic' },
    [MaterialSlots.DIAL]: { id: MaterialSlots.DIAL, label: 'Clock Dial', inherits: null, paintable: true, defaultCategory: 'metal' },
    [MaterialSlots.HANDS]: { id: MaterialSlots.HANDS, label: 'Clock Hands', inherits: null, paintable: true, defaultCategory: 'metal' },
    [MaterialSlots.RIM]: { id: MaterialSlots.RIM, label: 'Clock Rim Frame', inherits: null, paintable: true, defaultCategory: 'metal' },
    [MaterialSlots.CUSHION_A]: { id: MaterialSlots.CUSHION_A, label: 'Primary Cushion', inherits: null, paintable: true, defaultCategory: 'fabric' },
    [MaterialSlots.CUSHION_B]: { id: MaterialSlots.CUSHION_B, label: 'Accent Cushion', inherits: null, paintable: true, defaultCategory: 'fabric' },
    [MaterialSlots.VASE_A]: { id: MaterialSlots.VASE_A, label: 'Ceramic Vase', inherits: null, paintable: true, defaultCategory: 'stone' },
    [MaterialSlots.VASE_B]: { id: MaterialSlots.VASE_B, label: 'Accent Vase', inherits: null, paintable: true, defaultCategory: 'metal' },
    [MaterialSlots.COVER]: { id: MaterialSlots.COVER, label: 'Book Hardcover', inherits: null, paintable: true, defaultCategory: 'fabric' },
    [MaterialSlots.PAGES]: { id: MaterialSlots.PAGES, label: 'Book Pages Block', inherits: null, paintable: true, defaultCategory: 'wood' },
    [MaterialSlots.PLATES]: { id: MaterialSlots.PLATES, label: 'Dining Plates', inherits: null, paintable: true, defaultCategory: 'marble' },
    [MaterialSlots.CUTLERY]: { id: MaterialSlots.CUTLERY, label: 'Table Cutlery', inherits: null, paintable: true, defaultCategory: 'metal' },
    
    // Stairs
    [MaterialSlots.TREADS]: { id: MaterialSlots.TREADS, label: 'Treads', inherits: null, paintable: true, defaultCategory: 'wood' },
    [MaterialSlots.RISERS]: { id: MaterialSlots.RISERS, label: 'Risers', inherits: null, paintable: true, defaultCategory: 'wood' },
    [MaterialSlots.STRINGERS]: { id: MaterialSlots.STRINGERS, label: 'Stringers', inherits: null, paintable: true, defaultCategory: 'metal' },
    [MaterialSlots.LANDINGS]: { id: MaterialSlots.LANDINGS, label: 'Landings', inherits: MaterialSlots.TREADS, paintable: true, defaultCategory: 'wood' },
    
    // Railings
    [MaterialSlots.HANDRAIL]: { id: MaterialSlots.HANDRAIL, label: 'Handrail', inherits: null, paintable: true, defaultCategory: 'wood' },
    [MaterialSlots.BALUSTERS]: { id: MaterialSlots.BALUSTERS, label: 'Balusters', inherits: null, paintable: true, defaultCategory: 'metal' },
    [MaterialSlots.POSTS]: { id: MaterialSlots.POSTS, label: 'Posts', inherits: null, paintable: true, defaultCategory: 'metal' },
    [MaterialSlots.BOTTOM_RAIL]: { id: MaterialSlots.BOTTOM_RAIL, label: 'Bottom Rail', inherits: null, paintable: true, defaultCategory: 'metal' }
};

export const INTERACTION_MODES = {
    COMPONENT: 'component', // Selects/highlights entire componentId
    SLOT: 'slot',           // Selects/highlights materialSlot
    MESH: 'mesh'            // Selects individual raycasted mesh
};

if (typeof window !== 'undefined') {
    window.MaterialSlots = MaterialSlots;
    window.ComponentTypes = ComponentTypes;
    window.SLOT_DEFINITIONS = SLOT_DEFINITIONS;
    window.INTERACTION_MODES = INTERACTION_MODES;
}

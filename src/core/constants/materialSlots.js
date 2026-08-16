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
    RAILING: 'railing'
};

export const SLOT_DEFINITIONS = {
    [MaterialSlots.FRAME]: { id: MaterialSlots.FRAME, label: 'Outer Frame', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.LEAF]: { id: MaterialSlots.LEAF, label: 'Leaf / Sash', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.GLASS]: { id: MaterialSlots.GLASS, label: 'Glass Panes', inherits: null, paintable: true, defaultCategory: 'glass' },
    [MaterialSlots.HARDWARE]: { id: MaterialSlots.HARDWARE, label: 'Hardware', inherits: null, paintable: false, defaultCategory: 'metal' },
    [MaterialSlots.SEAL]: { id: MaterialSlots.SEAL, label: 'Seals & Gaskets', inherits: null, paintable: false, defaultCategory: 'plastic' },
    [MaterialSlots.SCREEN]: { id: MaterialSlots.SCREEN, label: 'Insect Screen', inherits: null, paintable: false, defaultCategory: 'fabric' },
    [MaterialSlots.TRIM]: { id: MaterialSlots.TRIM, label: 'Trim & Architrave', inherits: MaterialSlots.FRAME, paintable: false, defaultCategory: 'wood' },
    [MaterialSlots.WALL_FRONT]: { id: MaterialSlots.WALL_FRONT, label: 'Front Wall Face', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.WALL_BACK]: { id: MaterialSlots.WALL_BACK, label: 'Back Wall Face', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.WALL_LEFT]: { id: MaterialSlots.WALL_LEFT, label: 'Left Wall Face', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.WALL_RIGHT]: { id: MaterialSlots.WALL_RIGHT, label: 'Right Wall Face', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.WALL_TOP]: { id: MaterialSlots.WALL_TOP, label: 'Top Wall Face', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.WALL_BOTTOM]: { id: MaterialSlots.WALL_BOTTOM, label: 'Bottom Wall Face', inherits: null, paintable: true, defaultCategory: 'categories' },
    [MaterialSlots.CUSTOM]: { id: MaterialSlots.CUSTOM, label: 'Custom Accent', inherits: null, paintable: true, defaultCategory: 'categories' },
    
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

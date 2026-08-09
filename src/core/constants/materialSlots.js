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
    CUSTOM: 'custom'
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
    WIDGET: 'widget'
};

export const SLOT_DEFINITIONS = {
    [MaterialSlots.FRAME]: { id: MaterialSlots.FRAME, label: 'Outer Frame', inherits: null, paintable: true, defaultCategory: 'wood' },
    [MaterialSlots.LEAF]: { id: MaterialSlots.LEAF, label: 'Leaf / Sash', inherits: null, paintable: true, defaultCategory: 'wood' },
    [MaterialSlots.GLASS]: { id: MaterialSlots.GLASS, label: 'Glass Panes', inherits: null, paintable: true, defaultCategory: 'glass' },
    [MaterialSlots.HARDWARE]: { id: MaterialSlots.HARDWARE, label: 'Hardware', inherits: null, paintable: false, defaultCategory: 'metal' },
    [MaterialSlots.SEAL]: { id: MaterialSlots.SEAL, label: 'Seals & Gaskets', inherits: null, paintable: false, defaultCategory: 'plastic' },
    [MaterialSlots.SCREEN]: { id: MaterialSlots.SCREEN, label: 'Insect Screen', inherits: null, paintable: false, defaultCategory: 'fabric' },
    [MaterialSlots.TRIM]: { id: MaterialSlots.TRIM, label: 'Trim & Architrave', inherits: MaterialSlots.FRAME, paintable: false, defaultCategory: 'wood' },
    [MaterialSlots.CUSTOM]: { id: MaterialSlots.CUSTOM, label: 'Custom Accent', inherits: null, paintable: true, defaultCategory: 'categories' }
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

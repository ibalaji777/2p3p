/**
 * Type-safe CAD/BIM Material Slots, Component Types, and Explicit Inheritance Definitions.
 * Architectural roles separate components logically (Frame, Sashes, Glass, Hardware, Seals, Screen).
 */

export const MaterialSlots = {
    FRAME: 'frame',
    SASH_LEFT: 'sash_left',
    SASH_RIGHT: 'sash_right',
    SASH_TOP: 'sash_top',
    SASH_BOTTOM: 'sash_bottom',
    LEAF: 'leaf',
    GLASS: 'glass',
    HARDWARE: 'hardware',
    SEAL: 'seal',
    SCREEN: 'screen',
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
    [MaterialSlots.FRAME]: { id: MaterialSlots.FRAME, label: 'Outer Frame', inherits: null },
    [MaterialSlots.SASH_LEFT]: { id: MaterialSlots.SASH_LEFT, label: 'Left Sash', inherits: MaterialSlots.FRAME },
    [MaterialSlots.SASH_RIGHT]: { id: MaterialSlots.SASH_RIGHT, label: 'Right Sash', inherits: MaterialSlots.FRAME },
    [MaterialSlots.SASH_TOP]: { id: MaterialSlots.SASH_TOP, label: 'Top Sash', inherits: MaterialSlots.FRAME },
    [MaterialSlots.SASH_BOTTOM]: { id: MaterialSlots.SASH_BOTTOM, label: 'Bottom Sash', inherits: MaterialSlots.FRAME },
    [MaterialSlots.LEAF]: { id: MaterialSlots.LEAF, label: 'Door Leaf', inherits: null },
    [MaterialSlots.GLASS]: { id: MaterialSlots.GLASS, label: 'Glass Panes', inherits: null },
    [MaterialSlots.HARDWARE]: { id: MaterialSlots.HARDWARE, label: 'Hardware', inherits: null },
    [MaterialSlots.SEAL]: { id: MaterialSlots.SEAL, label: 'Seals & Gaskets', inherits: null },
    [MaterialSlots.SCREEN]: { id: MaterialSlots.SCREEN, label: 'Insect Screen', inherits: null },
    [MaterialSlots.TRIM]: { id: MaterialSlots.TRIM, label: 'Trim & Architrave', inherits: MaterialSlots.FRAME },
    [MaterialSlots.CUSTOM]: { id: MaterialSlots.CUSTOM, label: 'Custom Accent', inherits: null }
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

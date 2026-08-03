/**
 * Type-safe CAD/BIM Material Slots and Component Types Registry.
 * Used across selection, highlighting, property panels, material pipeline, and rendering.
 */

export const MaterialSlots = {
    FRAME: 'frame',
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
    LEAF: 'leaf',
    GLASS: 'glass',
    HARDWARE: 'hardware',
    SEAL: 'seal',
    SCREEN: 'screen',
    TRIM: 'trim',
    WALL: 'wall',
    WIDGET: 'widget'
};

if (typeof window !== 'undefined') {
    window.MaterialSlots = MaterialSlots;
    window.ComponentTypes = ComponentTypes;
}

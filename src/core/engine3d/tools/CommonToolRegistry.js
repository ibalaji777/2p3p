/**
 * CommonToolRegistry.js
 * Universal Tool Registry & Metadata for 3D Scene Interactions (Sims 4 Style)
 */

export const COMMON_TOOLS = {
    SELECT: 'select',
    MATERIAL: 'material',
    MOVE: 'move',
    SPIN: 'spin',
    TILT: 'tilt',
    AXIS_UP: 'axis_up',
    AXIS_DOWN: 'axis_down'
};

export const COMMON_TOOL_DEFINITIONS = [
    {
        id: COMMON_TOOLS.SELECT,
        label: 'Select',
        icon: 'pointer',
        hotkey: 'V',
        tooltip: 'Select Object (V / Esc)',
        description: 'Select objects to view properties, transform, or move.',
        requiresSelection: false
    },
    {
        id: COMMON_TOOLS.MATERIAL,
        label: 'Material',
        icon: 'paint-brush',
        hotkey: 'B',
        tooltip: 'Paint Material (B)',
        description: 'Hover and click any face to apply materials consecutively.',
        requiresSelection: false
    },
    {
        id: COMMON_TOOLS.MOVE,
        label: 'Move',
        icon: 'move',
        hotkey: 'M',
        tooltip: 'Move Object (M / G)',
        description: 'Translate object along floor or wall baseline.',
        requiresSelection: true,
        capability: 'movable'
    },
    {
        id: COMMON_TOOLS.SPIN,
        label: 'Spin',
        icon: 'rotate-cw',
        hotkey: 'R',
        tooltip: 'Spin / Rotate (R)',
        description: 'Rotate object around vertical Y-axis (Yaw).',
        requiresSelection: true,
        capability: 'rotatable'
    },
    {
        id: COMMON_TOOLS.TILT,
        label: 'Tilt',
        icon: 'rotate-3d',
        hotkey: 'T',
        tooltip: 'Tilt (T)',
        description: 'Tilt object around horizontal X-axis (Pitch).',
        requiresSelection: true,
        capability: 'tiltable'
    },
    {
        id: COMMON_TOOLS.AXIS_UP,
        label: 'Elevate ↑',
        icon: 'arrow-up',
        hotkey: ']',
        tooltip: 'Axis Up / Elevate (] / PageUp)',
        description: 'Raise elevation from floor.',
        requiresSelection: true,
        capability: 'elevatable',
        isAction: true
    },
    {
        id: COMMON_TOOLS.AXIS_DOWN,
        label: 'Elevate ↓',
        icon: 'arrow-down',
        hotkey: '[',
        tooltip: 'Axis Down / Lower ([ / PageDown)',
        description: 'Lower elevation towards floor.',
        requiresSelection: true,
        capability: 'elevatable',
        isAction: true
    }
];

export function getToolDefinition(toolId) {
    return COMMON_TOOL_DEFINITIONS.find(t => t.id === toolId) || null;
}

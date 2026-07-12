import { PRESET_CATEGORIES } from '../engine2d/presetRegistry.js';

export const getMenuCategories = () => [
    {
        id: 'common', name: 'Common',
        icon: '<path d="M4 6h16M4 12h16M4 18h16M8 6v12M16 6v12"></path>',
        tools: [
            { id: 'railing', name: 'Draw Railing' }
        ]
    },
    {
        id: 'tools', name: 'General',
        icon: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="M13 13l6 6"></path>',
        tools: [
            { id: 'select', name: 'Select & Edit' },
            { id: 'pan', name: 'Pan / Move Canvas' }
        ]
    },
    {
        id: 'walls', name: 'Walls',
        icon: '<path d="M4 4h16v16H4z"></path><path d="M4 12h16"></path><path d="M12 4v16"></path>',
        tools: [
            { id: 'outer', name: 'Outer Wall' },
            { id: 'inner', name: 'Inner Wall' },
            { id: 'arc', name: 'Curved Wall (Arc)' }
        ]
    },
    {
        id: 'doors_windows', name: 'Doors & Windows',
        icon: '<path d="M4 22h16"></path><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"></path><path d="M14 12h2"></path>',
        tools: [
            { id: 'door', name: 'Door' },
            { id: 'window', name: 'Window' },
            { id: 'sunshade', name: 'Sunshade' },
            { id: 'jali_panel', name: 'Jali Panel' }
        ]
    },
    {
        id: 'staircases', name: 'Staircases',
        icon: '<path d="M19 3H15V7H11V11H7V15H3V21H19Z"></path>',
        tools: [
            { isDivider: true, name: 'Staircases' },
            { id: 'staircase', name: 'Staircase' },

            { isDivider: true, name: 'Floor Cuts' },
            { id: 'shape_floor_cut', name: 'Floor Cut (Hole)' }
        ]
    },
    {
        id: 'roof_presets', name: 'Roof Presets',
        icon: '<path d="M3 10l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>',
        tools: [
            { isDivider: true, name: 'Custom Roofs' },
            { id: 'roof', name: 'Roof' },
            { id: 'auto_roof', name: 'Generate Auto-Roof', action: 'auto_roof' },
            { isDivider: true, name: 'Dormers' },
            { id: 'dormer', name: 'Dormer' },
            ...Object.keys(PRESET_CATEGORIES).filter(cat => cat !== 'Dormers').reduce((acc, catName) => {
                acc.push({ isDivider: true, name: catName });
                PRESET_CATEGORIES[catName].forEach(preset => acc.push({ id: preset.id, name: preset.name, presetParams: { ...preset.defaultParams } }));
                return acc;
            }, [])
        ]
    },
    {
        id: 'furniture', name: 'Furniture',
        icon: '<path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"></path><path d="M2 13h20v5H2z"></path><path d="M4 18v2"></path><path d="M20 18v2"></path>',
        tools: [
            { id: 'couch_1', name: 'Couch', action: 'furniture' },
            { id: 'chair_ekero', name: 'Chair', action: 'furniture' },
            { id: 'table_dining', name: 'Dining Table', action: 'furniture' }
        ]
    },
    {
        id: 'shapes', name: 'Shapes',
        icon: '<path d="M3 8l4-4 4 4v4H3V8z"></path><circle cx="17" cy="6" r="3"></circle><rect x="14" y="14" width="6" height="6" rx="1"></rect><path d="M3 14h6v6H3z"></path>',
        tools: [
            { id: 'shape_rect', name: 'Box (Rectangle)' },
            { id: 'shape_circle', name: 'Cylinder (Circle)' },
            { id: 'shape_triangle', name: 'Prism (Polygon)' }
        ]
    },
    {
        id: 'smart_wizard', name: 'Smart Wizard',
        icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
        tools: [
            { id: 'smart_facing', name: 'Facing', action: 'wizard' },
            { id: 'smart_wall_resize', name: 'Resize Plan', action: 'wizard' }
        ]
    },
    {
        id: 'advance_openings', name: 'Advanced Openings',
        icon: '<path d="M12 2L2 22h20L12 2z"></path><circle cx="12" cy="14" r="3"></circle>',
        tools: [
            { id: 'arch_opening', name: 'Arch Opening' },
            { id: 'circular_opening', name: 'Circular & Oval' },
            { id: 'custom_shape_opening', name: 'Custom Shape Cut' },
            { id: 'niche_recess', name: 'Niche & Recess' },
            { id: 'pattern_opening', name: 'Pattern Opening' },
            { id: 'boolean_cut', name: 'Boolean Cut' }
        ]
    },
    {
        id: 'architectural_details', name: 'Architectural Details',
        icon: '<path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"></path>',
        tools: [
            { id: 'molding_band', name: 'Horizontal Band', action: 'molding' },
            { id: 'molding_crown', name: 'Crown Molding', action: 'molding' },
            { id: 'molding_ogee', name: 'Ogee (Cyma) Molding', action: 'molding' },
            { id: 'molding_egg_and_dart', name: 'Egg and Dart Molding', action: 'molding' },
            { id: 'molding_dentil', name: 'Dentil Molding', action: 'molding' },
            { id: 'molding_craftsman', name: 'Step / Craftsman', action: 'molding' },
            { id: 'molding_window', name: 'Window Frame', action: 'molding' },
            { id: 'molding_door', name: 'Door Frame', action: 'molding' },
            { id: 'molding_groove', name: 'Decorative Groove', action: 'molding' },
            { id: 'molding_layered', name: 'Layered Projection', action: 'molding' },
            { id: 'elevation_fascia', name: 'Elevation Fascia (C/L Shape)' }
        ]
    }
];

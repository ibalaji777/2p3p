export const FACADE_RIBBON_MATERIALS = {
    wood: { id: 'wood', name: 'Wood Louvers / Slats', color: 0x8b5a2b, roughness: 0.6 },
    dark_wood: { id: 'dark_wood', name: 'Dark Teak / Walnut', color: 0x4a2e18, roughness: 0.5 },
    travertine: { id: 'travertine', name: 'Warm Travertine Stone', color: 0xd6c7b2, roughness: 0.75 },
    marble: { id: 'marble', name: 'White Carrara Marble', color: 0xf1f5f9, roughness: 0.25 },
    bronze: { id: 'bronze', name: 'Architectural Bronze', color: 0x785338, roughness: 0.4 },
    stone: { id: 'stone', name: 'Stone Cladding', color: 0xa8a29e, roughness: 0.8 },
    dark_grey: { id: 'dark_grey', name: 'Charcoal Composite', color: 0x222222, roughness: 0.5 },
    white: { id: 'white', name: 'Pristine White Stucco', color: 0xffffff, roughness: 0.7 }
};

export const FACADE_RIBBON_CONFIG = {
    id: 'facade_ribbon_draw',
    label: '3D Facade Ribbon',
    description: 'Draw continuous architectural elevation bands wrapping across multiple walls and floors with automatic 45° miters.',
    defaultParams: {
        width: 40,            // beam height / thickness (cm)
        depth: 50,            // cantilever overhang (cm)
        material: 'wood',     // default material preset
        hasSpotlights: true,  // under-soffit recessed puck lights
        spotlightSpacing: 80  // spacing in cm between spotlights
    }
};

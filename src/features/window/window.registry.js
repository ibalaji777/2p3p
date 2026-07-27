export const WINDOW_TYPES = { sliding_std: { label: "Standard Sliding Window", type: "sliding", hasChajja: false }, casement_std: { label: "Casement / Hinged Window", type: "casement", hasChajja: false }, casement_chajja: { label: "Window with Concrete Sunshade", type: "casement", hasChajja: true }, fixed_elevation: { label: "Fixed Elevation Glass", type: "fixed", hasChajja: false }, modern_split: { label: "Modern Asymmetric", type: "split_asymmetric", hasChajja: false }, bay_box: { label: "Box Bay Window (Villa Style)", type: "bay", hasChajja: true }, window_seat: { label: "Double Picture Window", type: "window_seat", hasChajja: false }, garden_open: { label: "Open Garden Window", type: "garden_open", hasChajja: true }, panoramic_slider: { label: "Panoramic Slider", type: "panoramic_slider", hasChajja: false }, shutter_double: { label: "Double Louvered Shutter", type: "shutter_double", hasChajja: false }, louver_vent: { label: "Vent / Louver (Bathroom)", type: "louver", hasChajja: false }, traditional_indian: { label: "Traditional Wooden Shutter", type: "traditional", hasChajja: true } };

export const WINDOW_FRAME_MATERIALS = { upvc_white: { label: "White uPVC", color: 0xffffff, roughness: 0.8, metalness: 0.0, texture: 'solid' }, upvc_wood: { label: "Wood Finish uPVC", color: 0x8b5a2b, roughness: 0.7, metalness: 0.0, texture: 'wood', bumpScale: 0.005 }, alum_powder: { label: "Powder Coated Alum (Black)", color: 0x1f1f1f, roughness: 0.5, metalness: 0.6, texture: 'solid' }, wood_teak: { label: "Teak Wood", color: 0x6b4226, roughness: 0.6, metalness: 0.1, texture: 'wood', bumpScale: 0.005 }, steel_ms: { label: "MS Steel Frame", color: 0x222222, roughness: 0.4, metalness: 0.9, texture: 'solid' } };

export const WINDOW_GLASS_MATERIALS = {
    clear: {
        label: "Clear Tempered Glass", color: 0xeff6ff, transmission: 0.95, roughness: 0.0, ior: 1.5, transparent: true,
        cssSphere: "background: radial-gradient(circle at 30% 25%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.55) 15%, rgba(186,230,253,0.45) 45%, rgba(56,189,248,0.2) 75%, rgba(15,23,42,0.5) 100%); border: 1.5px solid rgba(255, 255, 255, 0.9); box-shadow: inset -5px -7px 12px rgba(0,0,0,0.5), inset 3px 3px 8px rgba(255,255,255,0.95), 0 6px 20px rgba(56,189,248,0.35);"
    },
    frosted: {
        label: "Frosted Satin Privacy Glass", color: 0xffffff, transmission: 0.5, roughness: 0.5, ior: 1.4, transparent: true,
        cssSphere: "background: radial-gradient(circle at 35% 25%, rgba(255,255,255,0.98) 0%, rgba(241,245,249,0.85) 40%, rgba(203,213,225,0.7) 75%, rgba(100,116,139,0.6) 100%); border: 1.5px solid rgba(255, 255, 255, 0.95); box-shadow: inset -4px -6px 12px rgba(100,116,139,0.35), inset 2px 2px 8px rgba(255,255,255,0.95), 0 4px 15px rgba(255,255,255,0.3);"
    },
    tinted: {
        label: "Architectural Dark Tinted Glass", color: 0x222222, transmission: 0.85, roughness: 0.0, ior: 1.5, transparent: true,
        cssSphere: "background: radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.35) 12%, rgba(51,65,85,0.75) 45%, rgba(15,23,42,0.9) 85%); border: 1.5px solid rgba(255, 255, 255, 0.7); box-shadow: inset -5px -7px 14px rgba(0,0,0,0.85), inset 3px 3px 8px rgba(255,255,255,0.8), 0 4px 15px rgba(15,23,42,0.5);"
    },
    reflective: {
        label: "Reflective Silver Mirror", color: 0xaaaaaa, transmission: 0.3, roughness: 0.0, metalness: 1.0, ior: 2.0, transparent: true,
        cssSphere: "background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(226,232,240,0.9) 25%, rgba(148,163,184,0.8) 45%, rgba(255,255,255,1) 50%, rgba(71,85,105,0.9) 75%, rgba(15,23,42,0.95) 100%); border: 1.5px solid rgba(255, 255, 255, 0.95); box-shadow: inset -5px -7px 12px rgba(0,0,0,0.65), inset 3px 3px 8px rgba(255,255,255,0.95), 0 4px 20px rgba(226,232,240,0.45);"
    },
    bronze: {
        label: "Bronze Warm Solar Glazing", color: 0x78350f, transmission: 0.8, roughness: 0.0, ior: 1.5, transparent: true,
        cssSphere: "background: radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95) 0%, rgba(254,215,170,0.7) 20%, rgba(180,83,9,0.5) 55%, rgba(67,20,7,0.8) 90%); border: 1.5px solid rgba(254, 215, 170, 0.8); box-shadow: inset -5px -7px 12px rgba(0,0,0,0.6), inset 3px 3px 8px rgba(255,255,255,0.85), 0 4px 15px rgba(180,83,9,0.35);"
    },
    blue_solar: {
        label: "Blue Reflective Solar Control", color: 0x1d4ed8, transmission: 0.82, roughness: 0.0, ior: 1.52, transparent: true,
        cssSphere: "background: radial-gradient(circle at 30% 25%, rgba(255,255,255,0.98) 0%, rgba(191,219,254,0.75) 20%, rgba(37,99,235,0.5) 55%, rgba(30,58,138,0.85) 90%); border: 1.5px solid rgba(191, 219, 254, 0.85); box-shadow: inset -5px -7px 12px rgba(0,0,0,0.6), inset 3px 3px 8px rgba(255,255,255,0.9), 0 4px 15px rgba(37,99,235,0.35);"
    },
    emerald_tint: {
        label: "Emerald Architectural Tint", color: 0x047857, transmission: 0.8, roughness: 0.0, ior: 1.5, transparent: true,
        cssSphere: "background: radial-gradient(circle at 30% 25%, rgba(255,255,255,0.98) 0%, rgba(167,243,208,0.75) 20%, rgba(5,150,105,0.5) 55%, rgba(6,78,59,0.85) 90%); border: 1.5px solid rgba(167, 243, 208, 0.85); box-shadow: inset -5px -7px 12px rgba(0,0,0,0.6), inset 3px 3px 8px rgba(255,255,255,0.9), 0 4px 15px rgba(5,150,105,0.35);"
    },
    fluted: {
        label: "Ribbed Fluted Privacy Glass", color: 0xe2e8f0, transmission: 0.65, roughness: 0.35, ior: 1.48, transparent: true,
        cssSphere: "background: repeating-linear-gradient(90deg, rgba(255,255,255,0.7) 0px, rgba(241,245,249,0.5) 4px, rgba(203,213,225,0.8) 8px), radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95) 0%, rgba(186,230,253,0.5) 50%, rgba(51,65,85,0.7) 100%); border: 1.5px solid rgba(255, 255, 255, 0.85); box-shadow: inset -4px -6px 12px rgba(0,0,0,0.4), inset 2px 2px 8px rgba(255,255,255,0.9), 0 4px 15px rgba(186,230,253,0.3);"
    }
};

export const WINDOW_GRILLE_PATTERNS = { grid: { label: "Standard Grid" }, horizontal: { label: "Horizontal Bars" }, vertical: { label: "Vertical Bars" }, diamond: { label: "Diamond Pattern" }, none: { label: "No Safety Grille" } };

export const METAL_REGISTRY = {
    'metal_brushed_steel': {
        id: 'metal_brushed_steel',
        name: 'Brushed Stainless Steel',
        texture: 'textures/metals/metal_brushed_steel.png',
        thumbnail: 'textures/metals/metal_brushed_steel.png',
        metalness: 0.9, roughness: 0.25, clearcoat: 0.1
    },
    'metal_brushed_gold': {
        id: 'metal_brushed_gold',
        name: 'Luxury Brushed Champagne Gold',
        texture: 'textures/metals/metal_brushed_gold.png',
        thumbnail: 'textures/metals/metal_brushed_gold.png',
        metalness: 0.95, roughness: 0.2, clearcoat: 0.2
    },
    'metal_gunmetal_black': {
        id: 'metal_gunmetal_black',
        name: 'Anodized Gunmetal Black Steel',
        texture: 'textures/metals/metal_gunmetal_black.png',
        thumbnail: 'textures/metals/metal_gunmetal_black.png',
        metalness: 0.85, roughness: 0.35
    },
    'metal_rose_bronze': {
        id: 'metal_rose_bronze',
        name: 'Polished Antique Rose Bronze',
        texture: 'textures/metals/metal_rose_bronze.png',
        thumbnail: 'textures/metals/metal_rose_bronze.png',
        metalness: 0.9, roughness: 0.25, clearcoat: 0.15
    },
    'metal_brushed_aluminum': {
        id: 'metal_brushed_aluminum',
        name: 'Silver Satin Brushed Aluminum',
        texture: 'textures/metals/metal_brushed_aluminum.png',
        thumbnail: 'textures/metals/metal_brushed_aluminum.png',
        metalness: 0.88, roughness: 0.3, clearcoat: 0.05
    }
};

export const PLASTIC_REGISTRY = {
    'plastic_speckled_terrazzo': {
        id: 'plastic_speckled_terrazzo',
        name: 'Eco Recycled Terrazzo Plastic',
        texture: 'textures/plastics/plastic_speckled_terrazzo.png',
        thumbnail: 'textures/plastics/plastic_speckled_terrazzo.png',
        roughness: 0.4, clearcoat: 0.2
    },
    'plastic_white_pvc': {
        id: 'plastic_white_pvc',
        name: 'Glossy White PVC Panel',
        texture: 'textures/plastics/plastic_white_pvc.png',
        thumbnail: 'textures/plastics/plastic_white_pvc.png',
        roughness: 0.2, clearcoat: 0.5
    }
};

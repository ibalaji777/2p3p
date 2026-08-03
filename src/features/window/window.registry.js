export const WINDOW_TYPES = { sliding_std: { label: "Standard Sliding Window", type: "sliding", hasChajja: false }, casement_std: { label: "Casement / Hinged Window", type: "casement", hasChajja: false }, casement_chajja: { label: "Window with Concrete Sunshade", type: "casement", hasChajja: true }, fixed_elevation: { label: "Fixed Elevation Glass", type: "fixed", hasChajja: false }, modern_split: { label: "Modern Asymmetric", type: "split_asymmetric", hasChajja: false }, bay_box: { label: "Box Bay Window (Villa Style)", type: "bay", hasChajja: true }, window_seat: { label: "Double Picture Window", type: "window_seat", hasChajja: false }, garden_open: { label: "Open Garden Window", type: "garden_open", hasChajja: true }, panoramic_slider: { label: "Panoramic Slider", type: "panoramic_slider", hasChajja: false }, shutter_double: { label: "Double Louvered Shutter", type: "shutter_double", hasChajja: false }, louver_vent: { label: "Vent / Louver (Bathroom)", type: "louver", hasChajja: false }, traditional_indian: { label: "Traditional Wooden Shutter", type: "traditional", hasChajja: true } };

export const WINDOW_FRAME_MATERIALS = { 
    upvc_white: { label: "White uPVC", color: 0xfafafa, roughness: 0.3, metalness: 0.05, clearcoat: 0.2 }, 
    upvc_wood: { label: "Wood Finish uPVC", color: 0x8b5a2b, roughness: 0.65, metalness: 0.0, texture: 'textures/wood/wood_golden_teak.png', bumpScale: 0.008 }, 
    alum_powder: { label: "Powder Coated Alum (Black)", color: 0x1a1a1a, roughness: 0.45, metalness: 0.7 }, 
    wood_teak: { label: "Teak Wood", color: 0x6b4226, roughness: 0.55, metalness: 0.05, texture: 'textures/wood/wood_golden_teak.png', bumpScale: 0.010 }, 
    wood_oak: { label: "Natural Oak Wood", color: 0x8b6544, roughness: 0.5, metalness: 0.05, texture: 'textures/wood/wood_golden_teak.png', bumpScale: 0.010 }, 
    wood_walnut: { label: "Dark Walnut Wood", color: 0x3d2314, roughness: 0.45, metalness: 0.05, texture: 'textures/wood/wood_golden_teak.png', bumpScale: 0.010 }, 
    steel_ms: { label: "MS Steel Frame", color: 0x222222, roughness: 0.35, metalness: 0.9 } 
};
export const WINDOW_GLASS_MATERIALS = {
    clear: {
        id: "clear",
        label: "Clear Tempered Glass",
        name: "Clear Tempered Glass",
        color: 0xffffff,
        transmission: 0.95,
        ior: 1.52,
        roughness: 0.015,
        thickness: 8.0,
        specularIntensity: 3.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.01,
        bumpScale: 0.002,
        attenuationColor: 0xdcfce7,
        attenuationDistance: 15.0,
        transparent: true,
        categoryLabel: "Glass",
        description: "Crystal clear float glass with 8mm thickness, 1.52 float glass refraction, 1.0 clearcoat specular highlights, signature float glass blue-green tint, and environment reflections."
    },
    frosted: {
        id: "frosted",
        label: "Frosted Satin Glass",
        name: "Frosted Satin Glass",
        color: 0xffffff,
        transmission: 0.88,
        ior: 1.45,
        roughness: 0.35,
        thickness: 6.0,
        transparent: true,
        categoryLabel: "Glass",
        description: "Soft translucent appearance, blurred transparency, satin finish, smooth light diffusion."
    },
    tinted: {
        id: "tinted",
        label: "Architectural Dark Glass",
        name: "Architectural Dark Glass",
        color: 0x111827,
        transmission: 0.70,
        ior: 1.52,
        roughness: 0.03,
        thickness: 8.0,
        attenuationColor: 0x030712,
        attenuationDistance: 10.0,
        transparent: true,
        categoryLabel: "Glass",
        description: "Transparent charcoal tint, modern building glass, rich reflections, clear visibility through the glass."
    },
    reflective: {
        id: "reflective",
        label: "Reflective Silver Glass",
        name: "Reflective Silver Glass",
        color: 0xffffff,
        transmission: 0.20,
        metalness: 0.85,
        ior: 2.0,
        roughness: 0.02,
        thickness: 6.0,
        specularIntensity: 2.0,
        transparent: true,
        categoryLabel: "Glass",
        description: "Mirror-coated architectural glass, partial transparency, strong environment reflections."
    },
    bronze: {
        id: "bronze",
        label: "Bronze Glass",
        name: "Bronze Glass",
        color: 0xfcd34d,
        transmission: 0.82,
        ior: 1.50,
        roughness: 0.03,
        thickness: 6.0,
        attenuationColor: 0xb45309,
        attenuationDistance: 6.0,
        transparent: true,
        categoryLabel: "Glass",
        description: "Warm bronze tint, natural transparency, soft golden reflections, luxury architectural appearance."
    },
    blue_solar: {
        id: "blue_solar",
        label: "Blue Reflective Glass",
        name: "Blue Reflective Glass",
        color: 0x60a5fa,
        transmission: 0.82,
        metalness: 0.15,
        ior: 1.52,
        roughness: 0.03,
        thickness: 6.0,
        attenuationColor: 0x3b82f6,
        attenuationDistance: 6.0,
        transparent: true,
        categoryLabel: "Glass",
        description: "Soft blue tint, sky reflections, high transparency, modern commercial building glass."
    }
};

export const WINDOW_GRILLE_PATTERNS = { grid: { label: "Standard Grid" }, horizontal: { label: "Horizontal Bars" }, vertical: { label: "Vertical Bars" }, diamond: { label: "Diamond Pattern" }, none: { label: "No Safety Grille" } };

export const METAL_REGISTRY = {
    'metal_brushed_steel': {
        id: 'metal_brushed_steel',
        name: 'Brushed Stainless Steel',
        texture: 'textures/metals/metal_brushed_steel.png',
        thumbnail: 'textures/metals/metal_brushed_steel.png',
        metalness: 0.9, roughness: 0.25, clearcoat: 0.1, defaultRepeat: 1
    },
    'metal_brushed_gold': {
        id: 'metal_brushed_gold',
        name: 'Luxury Brushed Champagne Gold',
        texture: 'textures/metals/metal_brushed_gold.png',
        thumbnail: 'textures/metals/metal_brushed_gold.png',
        metalness: 0.95, roughness: 0.2, clearcoat: 0.2, defaultRepeat: 1
    },
    'metal_gunmetal_black': {
        id: 'metal_gunmetal_black',
        name: 'Anodized Gunmetal Black Steel',
        texture: 'textures/metals/metal_gunmetal_black.png',
        thumbnail: 'textures/metals/metal_gunmetal_black.png',
        metalness: 0.85, roughness: 0.35, defaultRepeat: 1
    },
    'metal_rose_bronze': {
        id: 'metal_rose_bronze',
        name: 'Polished Antique Rose Bronze',
        texture: 'textures/metals/metal_rose_bronze.png',
        thumbnail: 'textures/metals/metal_rose_bronze.png',
        metalness: 0.9, roughness: 0.25, clearcoat: 0.15, defaultRepeat: 1
    },
    'metal_brushed_aluminum': {
        id: 'metal_brushed_aluminum',
        name: 'Silver Satin Brushed Aluminum',
        texture: 'textures/metals/metal_brushed_aluminum.png',
        thumbnail: 'textures/metals/metal_brushed_aluminum.png',
        metalness: 0.88, roughness: 0.3, clearcoat: 0.05, defaultRepeat: 1
    },
    'metal_diamond_tread': {
        id: 'metal_diamond_tread',
        name: 'Industrial Diamond Tread Steel',
        texture: 'textures/metals/metal_diamond_tread.png',
        thumbnail: 'textures/metals/metal_diamond_tread.png',
        metalness: 0.92, roughness: 0.2, clearcoat: 0.1, defaultRepeat: 1
    },
    'metal_damascus_steel': {
        id: 'metal_damascus_steel',
        name: 'Forged Damascus Wave Steel',
        texture: 'textures/metals/metal_damascus_steel.png',
        thumbnail: 'textures/metals/metal_damascus_steel.png',
        metalness: 0.90, roughness: 0.25, clearcoat: 0.15, defaultRepeat: 1
    },
    'metal_hammered_copper': {
        id: 'metal_hammered_copper',
        name: 'Faceted Hand-Hammered Copper',
        texture: 'textures/metals/metal_hammered_copper.png',
        thumbnail: 'textures/metals/metal_hammered_copper.png',
        metalness: 0.94, roughness: 0.22, clearcoat: 0.2, defaultRepeat: 1
    },
    'metal_brass_chevrons': {
        id: 'metal_brass_chevrons',
        name: 'Chevron Geometric Brushed Brass',
        texture: 'textures/metals/metal_brass_chevrons.png',
        thumbnail: 'textures/metals/metal_brass_chevrons.png',
        metalness: 0.92, roughness: 0.18, clearcoat: 0.15, defaultRepeat: 1
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

export const WOOD_REGISTRY = {
    // 🪵 Photorealistic Wood Species
    'wood_golden_teak': {
        id: 'wood_golden_teak',
        category: 'wood',
        name: 'Natural Burmese Golden Teak',
        texture: 'textures/wood/wood_golden_teak.png',
        thumbnail: 'textures/wood/wood_golden_teak.png',
        color: 0xc4a482, metalness: 0.0, envMapIntensity: 0.2, roughness: 0.55, bumpScale: 0.005,
        defaultWidth: 100, defaultHeight: 100, defaultDepth: 0.2, defaultRepeat: 1, scaleMultiplier: 1
    },
    'wood_dark_walnut': {
        id: 'wood_dark_walnut',
        category: 'wood',
        name: 'Solid Dark American Walnut',
        texture: 'textures/wood/wood_dark_walnut.png',
        thumbnail: 'textures/wood/wood_dark_walnut.png',
        color: 0x5c4033, metalness: 0.0, envMapIntensity: 0.2, roughness: 0.5, bumpScale: 0.005,
        defaultWidth: 100, defaultHeight: 100, defaultDepth: 0.2, defaultRepeat: 1, scaleMultiplier: 1
    },
    'wood_white_oak': {
        id: 'wood_white_oak',
        category: 'wood',
        name: 'Natural White American Oak',
        texture: 'textures/wood/wood_white_oak.png',
        thumbnail: 'textures/wood/wood_white_oak.png',
        color: 0xd8c8b8, metalness: 0.0, envMapIntensity: 0.2, roughness: 0.6, bumpScale: 0.005,
        defaultWidth: 100, defaultHeight: 100, defaultDepth: 0.2, defaultRepeat: 1, scaleMultiplier: 1
    },
    'wood_mahogany': {
        id: 'wood_mahogany',
        category: 'wood',
        name: 'Heritage Red Mahogany',
        texture: 'textures/wood/wood_mahogany.png',
        thumbnail: 'textures/wood/wood_mahogany.png',
        color: 0x8b4513, metalness: 0.0, envMapIntensity: 0.2, roughness: 0.45, bumpScale: 0.005,
        defaultWidth: 100, defaultHeight: 100, defaultDepth: 0.2, defaultRepeat: 1, scaleMultiplier: 1
    },
    'wood_wenge': {
        id: 'wood_wenge',
        category: 'wood',
        name: 'Deep Ebony Wenge Timber',
        texture: 'textures/wood/wood_wenge.png',
        thumbnail: 'textures/wood/wood_wenge.png',
        color: 0x3d2b1f, metalness: 0.0, envMapIntensity: 0.2, roughness: 0.4, bumpScale: 0.005,
        defaultWidth: 100, defaultHeight: 100, defaultDepth: 0.2, defaultRepeat: 1, scaleMultiplier: 1
    },

    // Backward compatibility aliases
    'door_indian_1': {
        id: 'door_indian_1', category: 'wood', name: 'Indian Carved Wood', texture: 'textures/wood/wood_golden_teak.png', thumbnail: 'textures/wood/wood_golden_teak.png', isAlias: true
    },
    'door_indian_2': {
        id: 'door_indian_2', category: 'wood', name: 'Dark Teak Door', texture: 'textures/wood/wood_dark_walnut.png', thumbnail: 'textures/wood/wood_dark_walnut.png', isAlias: true
    },
    'door_modern_1': {
        id: 'door_modern_1', category: 'wood', name: 'Modern Panel', texture: 'textures/wood/wood_white_oak.png', thumbnail: 'textures/wood/wood_white_oak.png', isAlias: true
    }
};

export const COMMON_MATERIALS = {
    wood: { label: "White Oak", color: 0xc4a482, roughness: 0.6, metalness: 0.05, texture: 'textures/wood/wood_golden_teak.png', bumpScale: 0.005, clearcoat: 0.05 },
    wpc: { label: "Wood Plastic Composite", color: 0x8a6b4e, roughness: 0.7, metalness: 0.0, clearcoat: 0.05 },
    upvc: { label: "Rigid uPVC", color: 0xffffff, roughness: 0.4, metalness: 0.05, clearcoat: 0.2 },
    pvc: { label: "Matte White PVC", color: 0xfdfdfd, roughness: 0.7, metalness: 0.0, clearcoat: 0.0 },
    aluminium: { label: "Aluminium", color: 0xc8cdd0, roughness: 0.4, metalness: 0.6 },
    steel: { label: "Brushed Steel", color: 0xa0a5aa, roughness: 0.35, metalness: 0.8, bumpScale: 0.005, clearcoat: 0.2 },
    glass: { label: "Double-Pane Glass", color: 0xeff6ff, roughness: 0.0, metalness: 0.1, transmission: 0.98, transparent: true, ior: 1.52, thickness: 3.0, clearcoat: 1.0 },
    frp: { label: "Fiber Reinforced Plastic", color: 0xe6e6e6, roughness: 0.8, metalness: 0.0, bumpScale: 0.015 },
    composite: { label: "Slate Blue Composite", color: 0x3b82f6, roughness: 0.35, metalness: 0.2, clearcoat: 0.15 },
    laminate: { label: "Charcoal Black", color: 0x2e2b2a, roughness: 0.4, metalness: 0.1, texture: 'textures/wood/wood_dark_walnut.png', bumpScale: 0.002, clearcoat: 0.1 },
    upvc_white: { label: "White uPVC", color: 0xfafafa, roughness: 0.3, metalness: 0.05, clearcoat: 0.2 }, 
    upvc_wood: { label: "Wood Finish uPVC", color: 0x8b5a2b, roughness: 0.65, metalness: 0.0, texture: 'textures/wood/wood_golden_teak.png', bumpScale: 0.008 }, 
    alum_powder: { label: "Powder Coated Alum (Black)", color: 0x1a1a1a, roughness: 0.45, metalness: 0.7 }, 
    wood_teak: { label: "Teak Wood", color: 0x6b4226, roughness: 0.55, metalness: 0.05, texture: 'textures/wood/wood_golden_teak.png', bumpScale: 0.010 }, 
    wood_oak: { label: "Natural Oak Wood", color: 0x8b6544, roughness: 0.5, metalness: 0.05, texture: 'textures/wood/wood_golden_teak.png', bumpScale: 0.010 }, 
    wood_walnut: { label: "Dark Walnut Wood", color: 0x3d2314, roughness: 0.45, metalness: 0.05, texture: 'textures/wood/wood_golden_teak.png', bumpScale: 0.010 }, 
    steel_ms: { label: "MS Steel Frame", color: 0x222222, roughness: 0.35, metalness: 0.9 } 
};

export const JALI_PATTERNS = {
    geometric: { label: "Geometric Lattice" },
    islamic: { label: "Islamic Star" },
    modern: { label: "Modern Slats" },
    kolam: { label: "Kolam (Rangoli)", texture: 'textures/jali/kolam.png' },
    lotus: { label: "Lotus Motif", texture: 'textures/jali/lotus.png' },
    peacock: { label: "Peacock (Mayil)", texture: 'textures/jali/peacock.png' },
    gopuram: { label: "Temple Gopuram", texture: 'textures/jali/gopuram.png' },
    ventilation: { label: "Geometric Vent Block", texture: 'textures/jali/ventilation.png' },
    mango: { label: "Mango Paisley Vine", texture: 'textures/jali/mango.png' },
    chettinad: { label: "Chettinad Wooden Jali", texture: 'textures/jali/chettinad.png' }
};

export const JALI_MATERIALS = {
    wood: { label: "Teak Wood", color: 0x6b4226, roughness: 0.4, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.1, texture: 'textures/wood/wood_golden_teak.png' },
    mdf: { label: "White Painted MDF", color: 0xfdfdfd, roughness: 0.3, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.1 },
    brass: { label: "Brass Finish", color: 0xb5a642, roughness: 0.2, metalness: 0.9, clearcoat: 0.5, clearcoatRoughness: 0.1 },
    wpc: { label: "WPC (Wood Plastic)", color: 0x8b5a2b, roughness: 0.5, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.2, texture: 'textures/wood/wood_golden_teak.png' },
    stone: { label: "Sandstone", color: 0xd2b48c, roughness: 0.9, metalness: 0, clearcoat: 0, clearcoatRoughness: 0 },
    metal_black: { label: "Matte Black Metal", color: 0x1a1a1a, roughness: 0.4, metalness: 0.8, clearcoat: 0.1, clearcoatRoughness: 0.2 }
};

import { patternManager } from '../services/pattern/PatternManager.js';
import { PatternTextureBlender } from '../services/pattern/PatternTextureBlender.js';

const COMPOSITE_VARIANT_CACHE = new Map();

export const FABRIC_REGISTRY = {
    // Unique 1K PBR Physical Texture Suites
    'caban_neutral': {
        id: 'caban_neutral', name: 'Premium Caban Weave', type: 'fabric',
        texture: 'textures/fabrics/caban/caban_fabric_diff.jpg',
        thumbnail: 'textures/fabrics/caban/caban_fabric_diff.jpg',
        normal: 'textures/fabrics/caban/caban_nor_gl_1k.png',
        roughnessMap: 'textures/fabrics/caban/caban_rough_1k.png',
        defaultTileSize: 40, normalScale: 0.35, roughness: 0.85, rotation: Math.PI / 2,
        supportsPatterns: true
    },
    'crepe_satin_real': {
        id: 'crepe_satin_real', name: 'Crepe Satin Silk', type: 'fabric',
        texture: 'textures/fabrics/crepe_satin_1k/textures/crepe_satin_diff_1k.jpg',
        thumbnail: 'textures/fabrics/crepe_satin_1k/textures/crepe_satin_diff_1k.jpg',
        defaultTileSize: 30, roughness: 0.35, metalness: 0.1,
        supportsPatterns: true
    },
    'curly_teddy_checkered': {
        id: 'curly_teddy_checkered', name: 'Curly Teddy Bouclé Upholstery', type: 'fabric',
        texture: 'textures/fabrics/curly_teddy_checkered_1k/textures/curly_teddy_checkered_diff_1k.jpg',
        thumbnail: 'textures/fabrics/curly_teddy_checkered_1k/textures/curly_teddy_checkered_diff_1k.jpg',
        defaultTileSize: 35, roughness: 0.9,
        supportsPatterns: true
    },

    // Backward compatibility aliases for existing default scenes (hidden from grid via isAlias)
    'caban': {
        id: 'caban', name: 'Premium Caban', type: 'fabric', isAlias: true,
        texture: 'textures/fabrics/caban/caban_fabric_diff.jpg',
        thumbnail: 'textures/fabrics/caban/caban_fabric_diff.jpg',
        supportsPatterns: true
    },
    'linen_ivory': { id: 'linen_ivory', name: 'Belgian Linen', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'linen_oatmeal': { id: 'linen_oatmeal', name: 'Belgian Linen', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'linen_navy': { id: 'linen_navy', name: 'Belgian Linen', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'linen_emerald': { id: 'linen_emerald', name: 'Belgian Linen', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'velvet_sapphire': { id: 'velvet_sapphire', name: 'Plush Velvet', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'velvet_ruby': { id: 'velvet_ruby', name: 'Plush Velvet', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'velvet_gold': { id: 'velvet_gold', name: 'Plush Velvet', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'velvet_slate': { id: 'velvet_slate', name: 'Plush Velvet', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'cotton_olive': { id: 'cotton_olive', name: 'Cotton Canvas', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'cotton_terracotta': { id: 'cotton_terracotta', name: 'Cotton Canvas', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'cotton_blush': { id: 'cotton_blush', name: 'Cotton Canvas', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'cotton_cream': { id: 'cotton_cream', name: 'Cotton Canvas', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'boucle_snow': { id: 'boucle_snow', name: 'Woven Bouclé', type: 'fabric', isAlias: true, texture: 'textures/fabrics/curly_teddy_checkered_1k/textures/curly_teddy_checkered_diff_1k.jpg' },
    'boucle_taupe': { id: 'boucle_taupe', name: 'Woven Bouclé', type: 'fabric', isAlias: true, texture: 'textures/fabrics/curly_teddy_checkered_1k/textures/curly_teddy_checkered_diff_1k.jpg' },
    'silk_pearl': { id: 'silk_pearl', name: 'Silk Sateen', type: 'fabric', isAlias: true, texture: 'textures/fabrics/crepe_satin_1k/textures/crepe_satin_diff_1k.jpg' },
    'silk_emerald': { id: 'silk_emerald', name: 'Silk Sateen', type: 'fabric', isAlias: true, texture: 'textures/fabrics/crepe_satin_1k/textures/crepe_satin_diff_1k.jpg' },
    'suede_camel': { id: 'suede_camel', name: 'Ultra Suede', type: 'fabric', isAlias: true, texture: 'textures/fabrics/fabric_leather_02_1k/textures/fabric_leather_02_diff_1k.jpg' },
    'suede_espresso': { id: 'suede_espresso', name: 'Ultra Suede', type: 'fabric', isAlias: true, texture: 'textures/fabrics/fabric_leather_02_1k/textures/fabric_leather_02_diff_1k.jpg' },
    'sheer_voile': { id: 'sheer_voile', name: 'Sheer Silk Voile', type: 'fabric', isAlias: true, texture: 'textures/fabrics/crepe_satin_1k/textures/crepe_satin_diff_1k.jpg' },
    'linen_natural': { id: 'linen_natural', name: 'Belgian Linen', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'velvet_soft': { id: 'velvet_soft', name: 'Plush Velvet', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' },
    'boucle_woven': { id: 'boucle_woven', name: 'Woven Bouclé', type: 'fabric', isAlias: true, texture: 'textures/fabrics/curly_teddy_checkered_1k/textures/curly_teddy_checkered_diff_1k.jpg' },
    'cotton_canvas': { id: 'cotton_canvas', name: 'Cotton Canvas', type: 'fabric', isAlias: true, texture: 'textures/fabrics/caban/caban_fabric_diff.jpg' }
};

export const LEATHER_REGISTRY = {
    'leather_brown_real': {
        id: 'leather_brown_real', name: 'Real Brown Aniline Leather', type: 'leather',
        texture: 'textures/fabrics/brown_leather_1k/textures/brown_leather_albedo_1k.jpg',
        thumbnail: 'textures/fabrics/brown_leather_1k/textures/brown_leather_albedo_1k.jpg',
        roughnessMap: 'textures/fabrics/brown_leather_1k/textures/brown_leather_rough_1k.jpg',
        defaultTileSize: 35, roughness: 0.45,
        supportsPatterns: true
    },
    'fabric_leather_02': {
        id: 'fabric_leather_02', name: 'Fine Grain Leather', type: 'leather',
        texture: 'textures/fabrics/fabric_leather_02_1k/textures/fabric_leather_02_diff_1k.jpg',
        thumbnail: 'textures/fabrics/fabric_leather_02_1k/textures/fabric_leather_02_diff_1k.jpg',
        roughnessMap: 'textures/fabrics/fabric_leather_02_1k/textures/fabric_leather_02_rough_1k.jpg',
        defaultTileSize: 35, roughness: 0.5,
        supportsPatterns: true
    },
    'leather_red_real': {
        id: 'leather_red_real', name: 'Vintage Red Leather', type: 'leather',
        texture: 'textures/fabrics/leather_red_03_1k/textures/leather_red_03_coll1_1k.png',
        thumbnail: 'textures/fabrics/leather_red_03_1k/textures/leather_red_03_coll1_1k.png',
        defaultTileSize: 35, roughness: 0.4,
        supportsPatterns: true
    }
};

/**
 * Parses a composite fabric pattern material key into its base components.
 * Format: 'baseFabricId::pattern::patternId' or simply 'baseFabricId'.
 * @param {string} matKey 
 * @returns {{ baseFabricId: string, patternId: string|null, isComposite: boolean }}
 */
export function parseCompositeMaterialKey(matKey) {
    if (typeof matKey === 'string' && matKey.includes('::pattern::')) {
        const parts = matKey.split('::pattern::');
        return {
            baseFabricId: parts[0] || '',
            patternId: parts[1] || null,
            isComposite: Boolean(parts[1])
        };
    }
    return {
        baseFabricId: matKey || '',
        patternId: null,
        isComposite: false
    };
}

/**
 * Resolves or synthesizes a composite fabric configuration given a material key and optional transform options.
 * @param {string} matKey 
 * @param {Object} [transformOptions]
 * @returns {Promise<Object>} Resolved material configuration object.
 */
export async function resolveFabricConfig(matKey, transformOptions = {}) {
    if (!matKey) return null;
    const optsKey = transformOptions ? `::s${transformOptions.scale || 120}_r${transformOptions.rotation || 45}_rp${transformOptions.repeat || 2.0}_o${transformOptions.opacity || 100}_m${transformOptions.mirror || 'off'}_rg${transformOptions.roughness || 50}_sh${transformOptions.sheen || 50}` : '';
    const fullMatKey = matKey + optsKey;
    if (COMPOSITE_VARIANT_CACHE.has(fullMatKey)) return COMPOSITE_VARIANT_CACHE.get(fullMatKey);

    const { baseFabricId, patternId, isComposite } = parseCompositeMaterialKey(matKey);
    if (!isComposite) {
        return FABRIC_REGISTRY[baseFabricId] || null;
    }

    const baseConfig = FABRIC_REGISTRY[baseFabricId];
    if (!baseConfig) return null;

    const patternObj = await patternManager.getPatternById(patternId);
    if (!patternObj || !patternObj.textureUrl) {
        return baseConfig;
    }

    const baseTex = baseConfig.texture || baseConfig.thumbnail || '';
    const blendOpts = Object.assign({
        blendMode: 'multiply',
        patternOpacity: 0.9,
        size: 512,
        color: '#ffffff'
    }, transformOptions);
    const blendedTexture = await PatternTextureBlender.blend(baseTex, patternObj.textureUrl, blendOpts);

    const compositeConfig = Object.assign({}, baseConfig, {
        id: matKey,
        name: `${baseConfig.name} + ${patternObj.title}`,
        texture: blendedTexture || baseTex || patternObj.textureUrl,
        thumbnail: blendedTexture || baseConfig.thumbnail || patternObj.thumbnail,
        roughness: transformOptions && transformOptions.roughness !== undefined ? (transformOptions.roughness / 100) : (baseConfig.roughness !== undefined ? baseConfig.roughness : 0.5),
        sheen: transformOptions && transformOptions.sheen !== undefined ? (transformOptions.sheen / 100) : 0.5,
        opacity: transformOptions && transformOptions.opacity !== undefined ? (transformOptions.opacity / 100) : 1.0,
        baseFabricId,
        patternId,
        patternObj,
        isComposite: true,
        supportsPatterns: true
    });

    // Cache internal variant without polluting FABRIC_REGISTRY card keys
    COMPOSITE_VARIANT_CACHE.set(fullMatKey, compositeConfig);
    return compositeConfig;
}

/**
 * Synchronous helper to grab either the direct config or a partial fallback for a composite material key.
 * @param {string} matKey 
 * @returns {Object|null}
 */
export function getFabricBaseConfig(matKey) {
    if (!matKey) return null;
    if (FABRIC_REGISTRY[matKey]) return FABRIC_REGISTRY[matKey];
    const { baseFabricId, isComposite } = parseCompositeMaterialKey(matKey);
    if (isComposite && FABRIC_REGISTRY[baseFabricId]) {
        return Object.assign({}, FABRIC_REGISTRY[baseFabricId], { id: matKey, isComposite: true });
    }
    return null;
}


export const SKY_REGISTRY = {
    'arch_viz_sunny': {
        id: 'arch_viz_sunny',
        name: 'Vibrant Sunny',
        type: 'color',
        skyColor: 0x5dade2,
        fogColor: 0xe0eaf5,
        hemiSky: 0xffffff,
        hemiGround: 0x4ade80,
        sunColor: 0xffffee,
        ambient: 1.8,
        hemi: 1.8,
        sun: 1.8
    },
    'cloudy_day': {
        id: 'cloudy_day',
        name: 'Realistic Cloudy',
        type: 'hdri',
        url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/cloudy_sky_1k.hdr',
        sunColor: 0xffffff,
        ambient: 2.8,
        hemi: 2.2,
        sun: 1.2
    },
    'venice_sunset': {
        id: 'venice_sunset',
        name: 'Venice Sunset',
        type: 'hdri',
        url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/venice_sunset_1k.hdr',
        sunColor: 0xffeebb,
        fogColor: 0xdab7a2,
        ambient: 2.5,
        hemi: 2.0,
        sun: 2.0
    }
};

export const FLOOR_REGISTRY = {
    'hardwood': {
        id: 'hardwood', name: 'Hardwood Floor', type: 'floor',
        texture: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
        thumbnail: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
        roughness: 0.6, tileSize: 150
    },
    'tiles': {
        id: 'tiles', name: 'Ceramic Tiles', type: 'floor',
        texture: 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg', 
        color: 0xcccccc, roughness: 0.2, tileSize: 60
    },
    'carpet': {
        id: 'carpet', name: 'Soft Carpet', type: 'floor',
        color: 0x8b5a2b, roughness: 0.9
    }
};

export const GROUND_REGISTRY = {
    'grid': {
        id: 'grid', name: 'Blueprint Grid', type: 'grid', color: 0x9aa297
    },
    'grass': {
        id: 'grass', name: 'Lush Grass', type: 'terrain',
        texture: 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
        thumbnail: 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
        normal: 'https://threejs.org/examples/textures/water/Water_1_M_Normal.jpg',
        repeat: 25, roughness: 1.0, normalScale: 0.3, terrainHeight: 5
    },
    'studio_dark': {
        id: 'studio_dark', name: 'Dark Studio Base', type: 'terrain',
        color: 0x333533, roughness: 0.9, metalness: 0.05
    },
    'dark_soil': {
        id: 'dark_soil', name: 'Dark Soil', type: 'terrain',
        texture: 'assets/ground/soil.jpg',
        thumbnail: 'assets/ground/soil.jpg',
        normal: 'https://threejs.org/examples/textures/water/Water_1_M_Normal.jpg',
        repeat: 200, roughness: 1.0, normalScale: 1.2, terrainHeight: 18
    },
    'sand': {
        id: 'sand', name: 'Sand Terrain', type: 'terrain',
        texture: 'https://cdn.renderhub.com/eagle-soft/ground-terrain-gravel-pbr-texture/ground-terrain-gravel-pbr-texture-01.jpg',
        thumbnail: 'https://cdn.renderhub.com/eagle-soft/ground-terrain-gravel-pbr-texture/ground-terrain-gravel-pbr-texture-01.jpg',
        normal: 'https://threejs.org/examples/textures/water/Water_1_M_Normal.jpg',
        repeat: 200, roughness: 1.0, normalScale: 0.8, terrainHeight: 10
    }
};


export const GLASS_REGISTRY = {
    fluted: {
        id: "fluted",
        label: "Fluted / Ribbed Glass",
        name: "Fluted / Ribbed Glass",
        color: 0xffffff,
        transmission: 0.90,
        ior: 1.5,
        roughness: 0.4,
        thickness: 6.0,
        bumpScale: 0.05,
        transparent: true,
        categoryLabel: "Glass",
        description: "Vertical ribbed fluted texture for privacy while allowing maximum light transmission."
    },
    glass_clear: {
        isAlias: true,
        targetId: 'clear'
    },
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

export const METAL_REGISTRY = {
    'metal_brushed_steel': {
        id: 'metal_brushed_steel',
        group: 'steel',
        name: 'Brushed Stainless Steel',
        texture: 'textures/metals/metal_brushed_steel.png',
        thumbnail: 'textures/metals/metal_brushed_steel.png',
        metalness: 0.9, roughness: 0.25, clearcoat: 0.1, defaultRepeat: 1
    },
    'metal_light_steel': {
        id: 'metal_light_steel',
        group: 'steel',
        name: 'Light Smooth Steel',
        color: 0xa0a5aa,
        metalness: 0.85, roughness: 0.3, clearcoat: 0.1
    },
    'steel_ms': {
        id: 'steel_ms',
        group: 'steel',
        name: 'MS Steel Frame',
        color: 0x222222,
        roughness: 0.6, metalness: 0.8
    },
    'metal_brushed_gold': {
        id: 'metal_brushed_gold',
        group: 'steel',
        name: 'Luxury Brushed Champagne Gold',
        texture: 'textures/metals/metal_brushed_gold.png',
        thumbnail: 'textures/metals/metal_brushed_gold.png',
        color: 0xd4af37,
        metalness: 0.95, roughness: 0.2, clearcoat: 0.2, defaultRepeat: 1
    },
    'metal_gunmetal_black': {
        id: 'metal_gunmetal_black',
        group: 'steel',
        name: 'Anodized Gunmetal Black Steel',
        texture: 'textures/metals/metal_gunmetal_black.png',
        thumbnail: 'textures/metals/metal_gunmetal_black.png',
        color: 0x22252a,
        metalness: 0.85, roughness: 0.35, defaultRepeat: 1
    },
    'metal_rose_bronze': {
        id: 'metal_rose_bronze',
        group: 'steel',
        name: 'Polished Antique Rose Bronze',
        texture: 'textures/metals/metal_rose_bronze.png',
        thumbnail: 'textures/metals/metal_rose_bronze.png',
        color: 0xb76e79,
        metalness: 0.9, roughness: 0.25, clearcoat: 0.15, defaultRepeat: 1
    },
    'metal_brushed_aluminum': {
        id: 'metal_brushed_aluminum',
        group: 'aluminium',
        name: 'Silver Satin Brushed Aluminum',
        texture: 'textures/metals/metal_brushed_aluminum.png',
        thumbnail: 'textures/metals/metal_brushed_aluminum.png',
        color: 0xc8cdd0,
        metalness: 0.88, roughness: 0.3, clearcoat: 0.05, defaultRepeat: 1
    },
    'alum_silver': {
        id: 'alum_silver',
        group: 'aluminium',
        name: 'Silver Aluminium',
        color: 0xc8cdd0,
        roughness: 0.3, metalness: 0.9, clearcoat: 0.1
    },
    'alum_powder': {
        id: 'alum_powder',
        group: 'aluminium',
        name: 'Black Powder Aluminium',
        color: 0x1a1a1a,
        roughness: 0.4, metalness: 0.8, clearcoat: 0.1
    },
    'metal_diamond_tread': {
        id: 'metal_diamond_tread',
        group: 'steel',
        name: 'Industrial Diamond Tread Steel',
        texture: 'textures/metals/metal_diamond_tread.png',
        thumbnail: 'textures/metals/metal_diamond_tread.png',
        color: 0x444850,
        metalness: 0.92, roughness: 0.2, clearcoat: 0.1, defaultRepeat: 1
    },
    'metal_damascus_steel': {
        id: 'metal_damascus_steel',
        group: 'steel',
        name: 'Forged Damascus Wave Steel',
        texture: 'textures/metals/metal_damascus_steel.png',
        thumbnail: 'textures/metals/metal_damascus_steel.png',
        metalness: 0.90, roughness: 0.25, clearcoat: 0.15, defaultRepeat: 1
    },
    'metal_hammered_copper': {
        id: 'metal_hammered_copper',
        group: 'steel',
        name: 'Faceted Hand-Hammered Copper',
        texture: 'textures/metals/metal_hammered_copper.png',
        thumbnail: 'textures/metals/metal_hammered_copper.png',
        metalness: 0.94, roughness: 0.22, clearcoat: 0.2, defaultRepeat: 1
    },
    'metal_brass_chevrons': {
        id: 'metal_brass_chevrons',
        group: 'steel',
        name: 'Chevron Geometric Brushed Brass',
        texture: 'textures/metals/metal_brass_chevrons.png',
        thumbnail: 'textures/metals/metal_brass_chevrons.png',
        metalness: 0.92, roughness: 0.18, clearcoat: 0.15, defaultRepeat: 1
    }
};

export const PLASTIC_REGISTRY = {
    'plastic_white_pvc': {
        id: 'plastic_white_pvc',
        group: 'pvc',
        name: 'Glossy White PVC Panel',
        texture: 'textures/plastics/plastic_white_pvc.png',
        thumbnail: 'textures/plastics/plastic_white_pvc.png',
        roughness: 0.2, clearcoat: 0.5
    },
    'seal_black': {
        id: 'seal_black',
        group: 'rubber',
        name: 'Black EPDM Rubber',
        color: 0x111111, roughness: 0.9, metalness: 0.0, bumpScale: 0.02
    },
    'seal_grey': {
        id: 'seal_grey',
        group: 'rubber',
        name: 'Grey Silicone',
        color: 0x666666, roughness: 0.8, metalness: 0.0, bumpScale: 0.01
    },
    'seal_white': {
        id: 'seal_white',
        group: 'rubber',
        name: 'White Silicone',
        color: 0xeeeeee, roughness: 0.8, metalness: 0.0, bumpScale: 0.01
    },
    'pvc_matte': {
        id: 'pvc_matte',
        group: 'pvc',
        name: 'Matte White PVC',
        color: 0xfdfdfd, roughness: 0.7, metalness: 0.0

    },
    'upvc_white': {
        id: 'upvc_white',
        group: 'upvc',
        name: 'White uPVC',
        color: 0xfafafa, roughness: 0.3, metalness: 0.05, clearcoat: 0.2

    },
    'wpc': {
        id: 'wpc',
        group: 'wpc',
        name: 'Wood Plastic Composite',
        color: 0x8a6b4e, roughness: 0.7, metalness: 0.0, clearcoat: 0.05

    },
    'frp': {
        id: 'frp',
        group: 'frp',
        name: 'Fiber Reinforced Plastic',
        color: 0xe6e6e6, roughness: 0.8, metalness: 0.0, bumpScale: 0.015

    },
    'plastic_speckled_terrazzo': {
        id: 'plastic_speckled_terrazzo',
        group: 'composite',
        name: 'Eco Recycled Terrazzo Plastic',
        texture: 'textures/plastics/plastic_speckled_terrazzo.png',
        thumbnail: 'textures/plastics/plastic_speckled_terrazzo.png',
        roughness: 0.4, clearcoat: 0.2
    }
};




export const STONE_REGISTRY = {
    'stone_stacked_fieldstone': {
        id: 'stone_stacked_fieldstone',
        name: 'Rustic Stacked Fieldstone',
        texture: 'textures/stones/stone_stacked_fieldstone.png',
        thumbnail: 'textures/stones/stone_stacked_fieldstone.png',
        roughness: 0.8, defaultTileSize: 60
    },
    'stone_slate_charcoal': {
        id: 'stone_slate_charcoal',
        name: 'Charcoal Black Cleft Slate',
        texture: 'textures/stones/stone_slate_charcoal.png',
        thumbnail: 'textures/stones/stone_slate_charcoal.png',
        roughness: 0.65, clearcoat: 0.1, defaultTileSize: 80
    },
    'stone_travertine_beige': {
        id: 'stone_travertine_beige',
        name: 'Roman Ivory Travertine Limestone',
        texture: 'textures/stones/stone_travertine_beige.png',
        thumbnail: 'textures/stones/stone_travertine_beige.png',
        roughness: 0.4, clearcoat: 0.2, defaultTileSize: 120
    },
    'stone_granite_black': {
        id: 'stone_granite_black',
        name: 'Polished Black Absolute Granite',
        texture: 'textures/stones/stone_granite_black.png',
        thumbnail: 'textures/stones/stone_granite_black.png',
        roughness: 0.18, clearcoat: 0.75, defaultTileSize: 150
    },
    'stone_sandstone_golden': {
        id: 'stone_sandstone_golden',
        name: 'Desert Golden Amber Sandstone',
        texture: 'textures/stones/stone_sandstone_golden.png',
        thumbnail: 'textures/stones/stone_sandstone_golden.png',
        roughness: 0.7, clearcoat: 0.05, defaultTileSize: 100
    },
    'stone_basalt_lava': {
        id: 'stone_basalt_lava',
        name: 'Volcanic Charcoal Basalt Stone',
        texture: 'textures/stones/stone_basalt_lava.png',
        thumbnail: 'textures/stones/stone_basalt_lava.png',
        roughness: 0.6, clearcoat: 0.15, defaultTileSize: 80
    },
    'stone_limestone_portuguese': {
        id: 'stone_limestone_portuguese',
        name: 'Portuguese Cream Limestone',
        texture: 'textures/stones/stone_limestone_portuguese.png',
        thumbnail: 'textures/stones/stone_limestone_portuguese.png',
        roughness: 0.35, clearcoat: 0.3, defaultTileSize: 120
    },
    'stone_wall': {
        id: 'stone_wall',
        name: 'Rough Hewn Fieldstone',
        texture: 'models/wall/stone.png',
        thumbnail: 'models/wall/stone.png',
        roughness: 0.85, defaultTileSize: 60
    },
    'brick_1_orange': {
        id: 'brick_1_orange',
        name: 'Orange Textured Brick Stone',
        texture: 'models/wall/brick_1_orange.png',
        thumbnail: 'models/wall/brick_1_orange.png',
        roughness: 0.75
    },
    'brick_2_mixed': {
        id: 'brick_2_mixed',
        name: 'Mixed Brown Brick Stone',
        texture: 'models/wall/brick_2_mixed.png',
        thumbnail: 'models/wall/brick_2_mixed.png',
        roughness: 0.75
    },
    'brick_3_red': {
        id: 'brick_3_red',
        name: 'Classic Red Brick Stone',
        texture: 'models/wall/brick_3_red.png',
        thumbnail: 'models/wall/brick_3_red.png',
        roughness: 0.75
    },
    'brick_4_burgundy': {
        id: 'brick_4_burgundy',
        name: 'Dark Burgundy Brick Stone',
        texture: 'models/wall/brick_4_burgundy.png',
        thumbnail: 'models/wall/brick_4_burgundy.png',
        roughness: 0.75
    },
    'brick_5_cream': {
        id: 'brick_5_cream',
        name: 'Cream Sand Brick Stone',
        texture: 'models/wall/brick_5_cream.png',
        thumbnail: 'models/wall/brick_5_cream.png',
        roughness: 0.75
    },
    'brick_6_beige': {
        id: 'brick_6_beige',
        name: 'Light Beige Brick Stone',
        texture: 'models/wall/brick_6_beige.png',
        thumbnail: 'models/wall/brick_6_beige.png',
        roughness: 0.75
    },
    'brick_7_yellow': {
        id: 'brick_7_yellow',
        name: 'Yellow Ochre Brick Stone',
        texture: 'models/wall/brick_7_yellow.png',
        thumbnail: 'models/wall/brick_7_yellow.png',
        roughness: 0.75
    },
    'brick_8_white': {
        id: 'brick_8_white',
        name: 'White Grey Brick Stone',
        texture: 'models/wall/brick_8_white.png',
        thumbnail: 'models/wall/brick_8_white.png',
        roughness: 0.75
    },
    'brick_9_grey': {
        id: 'brick_9_grey',
        name: 'Grey Brown Brick Stone',
        texture: 'models/wall/brick_9_grey.png',
        thumbnail: 'models/wall/brick_9_grey.png',
        roughness: 0.75
    }
};

export const WALL_DECOR_REGISTRY = {
    'brick_wall': {
        id: 'brick_wall',
        name: 'Red Bricks',
        texture: 'models/wall/redbrick.png', 
        thumbnail: 'https://threejs.org/examples/textures/brick_diffuse.jpg', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2, 
        defaultRepeat: 3   
    },
    'brick_1_orange': {
        id: 'brick_1_orange',
        name: 'Orange Textured Brick',
        texture: 'models/wall/brick_1_orange.png', 
        thumbnail: 'models/wall/brick_1_orange.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_2_mixed': {
        id: 'brick_2_mixed',
        name: 'Mixed Brown Brick',
        texture: 'models/wall/brick_2_mixed.png', 
        thumbnail: 'models/wall/brick_2_mixed.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_3_red': {
        id: 'brick_3_red',
        name: 'Classic Red Brick',
        texture: 'models/wall/brick_3_red.png', 
        thumbnail: 'models/wall/brick_3_red.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_4_burgundy': {
        id: 'brick_4_burgundy',
        name: 'Dark Burgundy Brick',
        texture: 'models/wall/brick_4_burgundy.png', 
        thumbnail: 'models/wall/brick_4_burgundy.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_5_cream': {
        id: 'brick_5_cream',
        name: 'Cream Sand Brick',
        texture: 'models/wall/brick_5_cream.png', 
        thumbnail: 'models/wall/brick_5_cream.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_6_beige': {
        id: 'brick_6_beige',
        name: 'Light Beige Brick',
        texture: 'models/wall/brick_6_beige.png', 
        thumbnail: 'models/wall/brick_6_beige.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_7_yellow': {
        id: 'brick_7_yellow',
        name: 'Yellow Ochre Brick',
        texture: 'models/wall/brick_7_yellow.png', 
        thumbnail: 'models/wall/brick_7_yellow.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_8_white': {
        id: 'brick_8_white',
        name: 'White Grey Brick',
        texture: 'models/wall/brick_8_white.png', 
        thumbnail: 'models/wall/brick_8_white.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'brick_9_grey': {
        id: 'brick_9_grey',
        name: 'Grey Brown Brick',
        texture: 'models/wall/brick_9_grey.png', 
        thumbnail: 'models/wall/brick_9_grey.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'stone_wall': {
        id: 'stone_wall',
        name: 'Premium Stone',
        texture: 'models/wall/stone.png',
        thumbnail: 'models/wall/stone.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'marble_tiles': {
        id: 'marble_tiles',
        name: 'Premium Marble',
        texture: 'models/wall/marble.png',
        thumbnail: 'models/wall/marble.png', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2,
        defaultRepeat: 3,
        scaleMultiplier: 2
    },
    'wood_panel': {
        id: 'wood_panel',
        name: 'Wood Panels',
        texture: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg', 
        thumbnail: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg', 
        defaultWidth: 100,
        defaultHeight: 100,
        defaultDepth: 0.2, 
        defaultRepeat: 3   
    }
};





export const MARBLE_REGISTRY = {
    'marble_calacatta_gold': {
        id: 'marble_calacatta_gold',
        name: 'Italian Calacatta',
        texture: 'textures/marbles/marble_calacatta_gold.png',
        thumbnail: 'textures/marbles/marble_calacatta_gold.png',
        roughness: 0.12, clearcoat: 0.90, defaultRepeat: 1
    },
    'marble_statuario_venato': {
        id: 'marble_statuario_venato',
        name: 'High-Contrast Statuario',
        texture: 'textures/marbles/marble_statuario_venato.png',
        thumbnail: 'textures/marbles/marble_statuario_venato.png',
        roughness: 0.10, clearcoat: 0.95, defaultRepeat: 1
    },
    'marble_blue_sodalite': {
        id: 'marble_blue_sodalite',
        name: 'Royal Sodalite Blue',
        texture: 'textures/marbles/marble_blue_sodalite.png',
        thumbnail: 'textures/marbles/marble_blue_sodalite.png',
        roughness: 0.12, clearcoat: 0.90, defaultRepeat: 1
    },
    'marble_onyx_amber': {
        id: 'marble_onyx_amber',
        name: 'Translucent Honey Onyx',
        texture: 'textures/marbles/marble_onyx_amber.png',
        thumbnail: 'textures/marbles/marble_onyx_amber.png',
        roughness: 0.08, clearcoat: 0.98, defaultRepeat: 1
    },
    'marble_sahara_noir': {
        id: 'marble_sahara_noir',
        name: 'Sahara Noir',
        texture: 'textures/marbles/marble_sahara_noir.png',
        thumbnail: 'textures/marbles/marble_sahara_noir.png',
        roughness: 0.10, clearcoat: 0.92, defaultRepeat: 1
    },
    'marble_carrara': {
        id: 'marble_carrara',
        name: 'Italian Carrara White',
        texture: 'textures/marbles/marble_carrara.png',
        thumbnail: 'textures/marbles/marble_carrara.png',
        color: 0xeeeeee, roughness: 0.15, clearcoat: 0.85, defaultRepeat: 1
    },
    'marble_nero_marquina': {
        id: 'marble_nero_marquina',
        name: 'Nero Marquina Black',
        texture: 'textures/marbles/marble_nero_marquina.png',
        thumbnail: 'textures/marbles/marble_nero_marquina.png',
        color: 0x222222, roughness: 0.12, clearcoat: 0.90, defaultRepeat: 1
    },
    'marble_verde_guatemala': {
        id: 'marble_verde_guatemala',
        name: 'Emerald Verde Guatemala',
        texture: 'textures/marbles/marble_verde_guatemala.png',
        thumbnail: 'textures/marbles/marble_verde_guatemala.png',
        roughness: 0.15, clearcoat: 0.80, defaultRepeat: 1
    },
    'marble_emperador_dark': {
        id: 'marble_emperador_dark',
        name: 'Dark Emperador Chocolate',
        texture: 'textures/marbles/marble_emperador_dark.png',
        thumbnail: 'textures/marbles/marble_emperador_dark.png',
        roughness: 0.18, clearcoat: 0.80, defaultRepeat: 1
    },
    'marble_calacatta_viola': {
        id: 'marble_calacatta_viola',
        name: 'Italian Calacatta Viola',
        texture: 'textures/marbles/marble_calacatta_viola.png',
        thumbnail: 'textures/marbles/marble_calacatta_viola.png',
        roughness: 0.14, clearcoat: 0.88, defaultRepeat: 1
    }
};

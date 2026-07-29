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
        thumbnail: 'https://via.placeholder.com/150/ffffff/000000?text=Tiles',
        color: 0xcccccc, roughness: 0.2, tileSize: 60
    },
    'carpet': {
        id: 'carpet', name: 'Soft Carpet', type: 'floor',
        color: 0x8b5a2b, roughness: 0.9,
        thumbnail: 'https://via.placeholder.com/150/8b5a2b/fff?text=Carpet'
    }
};

export const GROUND_REGISTRY = {
    'grid': {
        id: 'grid', name: 'Blueprint Grid', type: 'grid', color: 0x9aa297,
        thumbnail: 'https://via.placeholder.com/150/9aa297/fff?text=Grid'
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
        color: 0x333533, roughness: 0.9, metalness: 0.05,
        thumbnail: 'https://via.placeholder.com/150/333533/fff?text=Dark+Base'
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

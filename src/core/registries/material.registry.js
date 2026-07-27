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
    wood: { label: "Teak Wood", color: 0x6b4226, roughness: 0.4, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.1, texture: 'wood' },
    mdf: { label: "White Painted MDF", color: 0xfdfdfd, roughness: 0.3, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.1, texture: 'solid' },
    brass: { label: "Brass Finish", color: 0xb5a642, roughness: 0.2, metalness: 0.9, clearcoat: 0.5, clearcoatRoughness: 0.1, texture: 'solid' },
    wpc: { label: "WPC (Wood Plastic)", color: 0x8b5a2b, roughness: 0.5, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.2, texture: 'wood' },
    stone: { label: "Sandstone", color: 0xd2b48c, roughness: 0.9, metalness: 0, clearcoat: 0, clearcoatRoughness: 0, texture: 'solid' },
    metal_black: { label: "Matte Black Metal", color: 0x1a1a1a, roughness: 0.4, metalness: 0.8, clearcoat: 0.1, clearcoatRoughness: 0.2, texture: 'solid' }
};

import { patternManager } from '../services/pattern/PatternManager.js';
import { PatternTextureBlender } from '../services/pattern/PatternTextureBlender.js';

export const FABRIC_REGISTRY = {
    // Caban Weave (Medium textured upholstery)
    'caban_neutral': {
        id: 'caban_neutral', name: 'Premium Caban (Warm Neutral)', type: 'fabric',
        texture: 'textures/fabrics/caban/caban_fabric_diff.jpg',
        thumbnail: 'textures/fabrics/caban/caban_fabric_diff.jpg',
        normal: 'textures/fabrics/caban/caban_nor_gl_1k.png',
        roughnessMap: 'textures/fabrics/caban/caban_rough_1k.png',
        defaultTileSize: 40, normalScale: 0.35, roughness: 0.85, rotation: Math.PI / 2,
        supportsPatterns: true
    },
    'caban_charcoal': {
        id: 'caban_charcoal', name: 'Premium Caban (Deep Charcoal)', type: 'fabric',
        color: 0x334155,
        normal: 'textures/fabrics/caban/caban_nor_gl_1k.png',
        roughnessMap: 'textures/fabrics/caban/caban_rough_1k.png',
        defaultTileSize: 40, normalScale: 0.35, roughness: 0.85, rotation: Math.PI / 2,
        supportsPatterns: true
    },
    // Belgian Linens (Natural organic woven fiber)
    'linen_ivory': {
        id: 'linen_ivory', name: 'Belgian Linen (Ivory Cream)', type: 'fabric',
        color: 0xfaf5ff, defaultTileSize: 35, roughness: 0.82,
        supportsPatterns: true
    },
    'linen_oatmeal': {
        id: 'linen_oatmeal', name: 'Belgian Linen (Natural Oatmeal)', type: 'fabric',
        color: 0xd6d3d1, defaultTileSize: 35, roughness: 0.82,
        supportsPatterns: true
    },
    'linen_navy': {
        id: 'linen_navy', name: 'Belgian Linen (Royal Navy)', type: 'fabric',
        color: 0x1e3a8a, defaultTileSize: 35, roughness: 0.82,
        supportsPatterns: true
    },
    'linen_emerald': {
        id: 'linen_emerald', name: 'Belgian Linen (Forest Emerald)', type: 'fabric',
        color: 0x065f46, defaultTileSize: 35, roughness: 0.82,
        supportsPatterns: true
    },
    // Plush Velvets (Low roughness, high visual depth & sheen)
    'velvet_sapphire': {
        id: 'velvet_sapphire', name: 'Plush Velvet (Sapphire Blue)', type: 'fabric',
        color: 0x1d4ed8, defaultTileSize: 50, roughness: 0.45,
        supportsPatterns: true
    },
    'velvet_ruby': {
        id: 'velvet_ruby', name: 'Plush Velvet (Ruby Red)', type: 'fabric',
        color: 0x991b1b, defaultTileSize: 50, roughness: 0.45,
        supportsPatterns: true
    },
    'velvet_gold': {
        id: 'velvet_gold', name: 'Plush Velvet (Mustard Gold)', type: 'fabric',
        color: 0xd97706, defaultTileSize: 50, roughness: 0.45,
        supportsPatterns: true
    },
    'velvet_slate': {
        id: 'velvet_slate', name: 'Plush Velvet (Slate Grey)', type: 'fabric',
        color: 0x475569, defaultTileSize: 50, roughness: 0.45,
        supportsPatterns: true
    },
    // Heavy Duty Cotton Canvas (Sturdy, matte casual cotton)
    'cotton_olive': {
        id: 'cotton_olive', name: 'Cotton Canvas (Olive Green)', type: 'fabric',
        color: 0x4d7c0f, defaultTileSize: 40, roughness: 0.88,
        supportsPatterns: true
    },
    'cotton_terracotta': {
        id: 'cotton_terracotta', name: 'Cotton Canvas (Warm Terracotta)', type: 'fabric',
        color: 0xc2410c, defaultTileSize: 40, roughness: 0.88,
        supportsPatterns: true
    },
    'cotton_blush': {
        id: 'cotton_blush', name: 'Cotton Canvas (Soft Blush)', type: 'fabric',
        color: 0xf43f5e, defaultTileSize: 40, roughness: 0.88,
        supportsPatterns: true
    },
    'cotton_cream': {
        id: 'cotton_cream', name: 'Cotton Canvas (Warm Cream)', type: 'fabric',
        color: 0xfef9c3, defaultTileSize: 40, roughness: 0.88,
        supportsPatterns: true
    },
    // Woven Bouclé (Knobby luxury textured upholstery)
    'boucle_snow': {
        id: 'boucle_snow', name: 'Woven Bouclé (Snow White)', type: 'fabric',
        color: 0xf8fafc, defaultTileSize: 30, roughness: 0.92, normalScale: 0.5,
        supportsPatterns: true
    },
    'boucle_taupe': {
        id: 'boucle_taupe', name: 'Woven Bouclé (Warm Taupe)', type: 'fabric',
        color: 0x78716c, defaultTileSize: 30, roughness: 0.92, normalScale: 0.5,
        supportsPatterns: true
    },
    // Silk Sateen (Smooth high-sheen satin)
    'silk_pearl': {
        id: 'silk_pearl', name: 'Silk Sateen (Pearl White)', type: 'fabric',
        color: 0xfafaf9, roughness: 0.3, metalness: 0.1,
        supportsPatterns: true
    },
    'silk_emerald': {
        id: 'silk_emerald', name: 'Silk Sateen (Deep Emerald)', type: 'fabric',
        color: 0x047857, roughness: 0.3, metalness: 0.1,
        supportsPatterns: true
    },
    // Suede & Leather (Specialized upholstery)
    'suede_camel': {
        id: 'suede_camel', name: 'Ultra Suede (Camel Brown)', type: 'fabric',
        color: 0xb45309, roughness: 0.75,
        supportsPatterns: true
    },
    'suede_espresso': {
        id: 'suede_espresso', name: 'Ultra Suede (Espresso Dark)', type: 'fabric',
        color: 0x451a03, roughness: 0.75,
        supportsPatterns: true
    },
    'sheer_voile': {
        id: 'sheer_voile', name: 'Sheer Silk Voile (Transparent)', type: 'fabric',
        color: 0xfafaf9, roughness: 0.35, transparent: true, opacity: 0.65,
        supportsPatterns: false
    },
    'quilted_leather': {
        id: 'quilted_leather', name: 'Aniline Quilted Leather', type: 'fabric',
        color: 0x271712, roughness: 0.28, metalness: 0.12,
        supportsPatterns: false
    },
    // Backward compatibility aliases for existing default scenes (hidden from grid via isAlias)
    'caban': {
        id: 'caban', name: 'Premium Caban (Warm Neutral)', type: 'fabric', isAlias: true,
        texture: 'textures/fabrics/caban/caban_fabric_diff.jpg',
        thumbnail: 'textures/fabrics/caban/caban_fabric_diff.jpg',
        normal: 'textures/fabrics/caban/caban_nor_gl_1k.png',
        roughnessMap: 'textures/fabrics/caban/caban_rough_1k.png',
        defaultTileSize: 40, normalScale: 0.35, roughness: 0.85, rotation: Math.PI / 2,
        supportsPatterns: true
    },
    'linen_natural': {
        id: 'linen_natural', name: 'Belgian Linen (Natural)', type: 'fabric', isAlias: true,
        color: 0xe7e5e4, defaultTileSize: 35, roughness: 0.82,
        supportsPatterns: true
    },
    'velvet_soft': {
        id: 'velvet_soft', name: 'Plush Velvet (Slate)', type: 'fabric', isAlias: true,
        color: 0x334155, defaultTileSize: 50, roughness: 0.45,
        supportsPatterns: true
    },
    'boucle_woven': {
        id: 'boucle_woven', name: 'Woven Bouclé (Cream)', type: 'fabric', isAlias: true,
        color: 0xf5f5f4, defaultTileSize: 30, roughness: 0.92,
        supportsPatterns: true
    },
    'cotton_canvas': {
        id: 'cotton_canvas', name: 'Cotton Canvas (Oatmeal)', type: 'fabric', isAlias: true,
        color: 0xd6d3d1, defaultTileSize: 40, roughness: 0.88,
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
 * Asynchronously resolves a fabric material configuration, blending textures when a composite pattern is requested.
 * Caches resolved composite configs in FABRIC_REGISTRY for fast subsequent sync lookups.
 * @param {string} matKey 
 * @returns {Promise<Object>} Resolved material configuration object.
 */
export async function resolveFabricConfig(matKey) {
    if (!matKey) return null;
    if (FABRIC_REGISTRY[matKey]) return FABRIC_REGISTRY[matKey];

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
    const fabricColor = baseConfig.color !== undefined ? '#' + baseConfig.color.toString(16).padStart(6, '0') : '#ffffff';
    const blendedTexture = await PatternTextureBlender.blend(baseTex, patternObj.textureUrl, {
        blendMode: 'multiply',
        patternOpacity: 0.9,
        size: 512,
        color: fabricColor
    });

    const compositeConfig = Object.assign({}, baseConfig, {
        id: matKey,
        name: `${baseConfig.name} + ${patternObj.title}`,
        texture: blendedTexture || baseTex || patternObj.textureUrl,
        thumbnail: blendedTexture || baseConfig.thumbnail || patternObj.thumbnail,
        color: undefined, // Color is now baked into the synthesized diffuse texture
        baseFabricId,
        patternId,
        patternObj,
        isComposite: true,
        supportsPatterns: true
    });

    // Cache into registry for immediate synchronous reads
    FABRIC_REGISTRY[matKey] = compositeConfig;
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
        ambient: 0.3,
        hemi: 0.8,
        sun: 2.5
    },
    'cloudy_day': {
        id: 'cloudy_day',
        name: 'Realistic Cloudy',
        type: 'hdri',
        url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/jpg/1k/cloudy_sky_1k.jpg',
        sunColor: 0xffffff,
        ambient: 0.7,
        hemi: 0.6,
        sun: 1.8
    }
};

export const FLOOR_REGISTRY = {
    'hardwood': {
        id: 'hardwood', name: 'Hardwood Floor', type: 'floor',
        texture: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
        thumbnail: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
        roughness: 0.6, repeat: 5
    },
    'tiles': {
        id: 'tiles', name: 'Ceramic Tiles', type: 'floor',
        texture: 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg', 
        thumbnail: 'https://via.placeholder.com/150/ffffff/000000?text=Tiles',
        color: 0xcccccc, roughness: 0.2, repeat: 10
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
        repeat: 200, roughness: 1.0, normalScale: 1.0, terrainHeight: 15
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

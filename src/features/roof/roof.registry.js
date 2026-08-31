import { GLASS_ROOF_TEXTURE_DATA } from './generators/generate_glass_roof_textures.js';

export const ROOF_DECOR_REGISTRY = {
    'glass_roof_square_grid': {
        id: 'glass_roof_square_grid',
        name: 'Square Grid Glass',
        label: 'Square Grid Glass (Modern Atrium)',
        category: 'glass',
        isGlass: true,
        pattern: 'square_grid',
        texture: 'models/wall/glass_roof_square_grid.svg',
        thumbnail: GLASS_ROOF_TEXTURE_DATA.glass_roof_square_grid.dataUri,
        dataUri: GLASS_ROOF_TEXTURE_DATA.glass_roof_square_grid.dataUri,
        scaleRatio: 1.0,
        transmission: 0.92,
        roughness: 0.05,
        metalness: 0.15,
        ior: 1.52,
        clearcoat: 1.0,
        color: 0xffffff,
        description: 'Modern architectural glass atrium with dark steel structural mullion grid.'
    },
    'glass_roof_diamond_lattice': {
        id: 'glass_roof_diamond_lattice',
        name: 'Diamond Lattice Glass',
        label: 'Diamond Lattice Glass (Victorian Greenhouse)',
        category: 'glass',
        isGlass: true,
        pattern: 'diamond_lattice',
        texture: 'models/wall/glass_roof_diamond_lattice.svg',
        thumbnail: GLASS_ROOF_TEXTURE_DATA.glass_roof_diamond_lattice.dataUri,
        dataUri: GLASS_ROOF_TEXTURE_DATA.glass_roof_diamond_lattice.dataUri,
        scaleRatio: 1.0,
        transmission: 0.90,
        roughness: 0.06,
        metalness: 0.20,
        ior: 1.52,
        clearcoat: 1.0,
        color: 0xffffff,
        description: 'Victorian conservatory diagonal diamond lattice with ornate leaded/bronze structural framing.'
    },
    'glass_roof_hexagonal_honeycomb': {
        id: 'glass_roof_hexagonal_honeycomb',
        name: 'Hexagonal Honeycomb Glass',
        label: 'Hexagonal Honeycomb Glass (Futuristic Solarium)',
        category: 'glass',
        isGlass: true,
        pattern: 'hexagonal_honeycomb',
        texture: 'models/wall/glass_roof_hexagonal_honeycomb.svg',
        thumbnail: GLASS_ROOF_TEXTURE_DATA.glass_roof_hexagonal_honeycomb.dataUri,
        dataUri: GLASS_ROOF_TEXTURE_DATA.glass_roof_hexagonal_honeycomb.dataUri,
        scaleRatio: 1.0,
        transmission: 0.92,
        roughness: 0.04,
        metalness: 0.25,
        ior: 1.52,
        clearcoat: 1.0,
        color: 0xffffff,
        description: 'Futuristic geodesic solarium roof with titanium hexagonal structural grid.'
    },
    'glass_roof_solid_clear': {
        id: 'glass_roof_solid_clear',
        name: 'Solid Clear Glass',
        label: 'Solid Clear Glass (Frameless Skylight)',
        category: 'glass',
        isGlass: true,
        pattern: 'solid_clear',
        texture: 'models/wall/glass_roof_solid_clear.svg',
        thumbnail: GLASS_ROOF_TEXTURE_DATA.glass_roof_solid_clear.dataUri,
        dataUri: GLASS_ROOF_TEXTURE_DATA.glass_roof_solid_clear.dataUri,
        scaleRatio: 1.0,
        transmission: 0.96,
        roughness: 0.02,
        metalness: 0.05,
        ior: 1.52,
        clearcoat: 1.0,
        color: 0xffffff,
        description: 'Frameless ultra-clear architectural float glass for unobstructed panoramic sky views.'
    },
    'dark_asphalt_roof': {
        id: 'dark_asphalt_roof',
        name: 'Dark Asphalt',
        category: 'shingle',
        texture: 'models/wall/dark_asphalt_roof.png', 
        thumbnail: 'models/wall/dark_asphalt_roof.png', 
        scaleRatio: 1.5
    },
    'white_gravel_roof': {
        id: 'white_gravel_roof',
        name: 'White Gravel',
        category: 'gravel',
        texture: 'models/wall/white_gravel_roof.png', 
        thumbnail: 'models/wall/white_gravel_roof.png', 
        scaleRatio: 0.5
    },
    'terracotta_tiles_roof': {
        id: 'terracotta_tiles_roof',
        name: 'Terracotta Tiles',
        category: 'tile',
        texture: 'models/wall/terracotta_tiles_roof.png', 
        thumbnail: 'models/wall/terracotta_tiles_roof.png', 
        scaleRatio: 1.2
    },
    'terracotta_green_roof': {
        id: 'terracotta_green_roof',
        name: 'Terracotta Green',
        category: 'tile',
        texture: 'models/wall/roof_terracotta_green.png', 
        thumbnail: 'models/wall/roof_terracotta_green.png', 
        scaleRatio: 1.2
    },
    'terracotta_red_roof': {
        id: 'terracotta_red_roof',
        name: 'Terracotta Red',
        category: 'tile',
        texture: 'models/wall/roof_terracotta_red.png', 
        thumbnail: 'models/wall/roof_terracotta_red.png', 
        scaleRatio: 1.2
    },
    'grey_slate_roof': {
        id: 'grey_slate_roof',
        name: 'Grey Slate Tiles',
        category: 'slate',
        texture: 'models/wall/grey_slate_roof.png', 
        thumbnail: 'models/wall/grey_slate_roof.png', 
        scaleRatio: 1.2
    },
    'blue_ceramic_tiles_roof': {
        id: 'blue_ceramic_tiles_roof',
        name: 'Blue Ceramic Tiles',
        category: 'tile',
        texture: 'models/wall/blue_ceramic_tiles_roof.png', 
        thumbnail: 'models/wall/blue_ceramic_tiles_roof.png', 
        scaleRatio: 1.2
    }
};


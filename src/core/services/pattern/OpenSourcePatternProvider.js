import { PatternProvider } from './PatternProvider.js';

/**
 * Offline Pattern Library backed exclusively by local downloaded PNG pattern images in /fabric-pattern/
 */
export class OpenSourcePatternProvider extends PatternProvider {
    constructor() {
        super('open_source', 'Offline Fabric Pattern Library (Local /fabric-pattern/)');
        this.catalog = this._initializeCatalog();
    }

    _initializeCatalog() {
        return [
            {
                id: 'offline_stylishart_damask_9947374',
                title: 'Stylish Art Ornamental Damask',
                category: 'Traditional',
                tags: ['damask', 'ornamental', 'traditional', 'seamless', 'stylishart', '9947374'],
                thumbnail: '/fabric-pattern/stylishart-seamless-pattern-9947374_1920.png',
                textureUrl: '/fabric-pattern/stylishart-seamless-pattern-9947374_1920.png',
                license: 'Offline Pattern Asset',
                attribution: 'Local Fabric Pattern Asset (9947374)',
                provider: this.id
            },
            {
                id: 'offline_tanrica_flowers_9694631',
                title: 'Tanrica Decorative Floral Pattern',
                category: 'Floral',
                tags: ['floral', 'flower', 'tanrica', 'damask', 'seamless', '9694631'],
                thumbnail: '/fabric-pattern/tanrica-flowers-9694631_1920.png',
                textureUrl: '/fabric-pattern/tanrica-flowers-9694631_1920.png',
                license: 'Offline Pattern Asset',
                attribution: 'Local Fabric Pattern Asset (9694631)',
                provider: this.id
            },
            {
                id: 'offline_maple_leaves_7453138',
                title: 'Maple Leaf Botanical Pattern',
                category: 'Botanical',
                tags: ['maple', 'leaves', 'botanical', 'autumn', 'seamless', '7453138'],
                thumbnail: '/fabric-pattern/panjtanpak_graphics05-maple-7453138_1920.png',
                textureUrl: '/fabric-pattern/panjtanpak_graphics05-maple-7453138_1920.png',
                license: 'Offline Pattern Asset',
                attribution: 'Local Fabric Pattern Asset (7453138)',
                provider: this.id
            },
            {
                id: 'offline_yayangart_leaves_6753460',
                title: 'Yayangart Tropical Leaf Motif',
                category: 'Botanical',
                tags: ['leaves', 'tropical', 'botanical', 'yayangart', 'seamless', '6753460'],
                thumbnail: '/fabric-pattern/yayangart-leaves-6753460_1920.png',
                textureUrl: '/fabric-pattern/yayangart-leaves-6753460_1920.png',
                license: 'Offline Pattern Asset',
                attribution: 'Local Fabric Pattern Asset (6753460)',
                provider: this.id
            }
        ];
    }

    async search({ query = '', category = 'All', page = 1, limit = 24 } = {}) {
        let results = this.catalog.slice();
        
        if (category && category !== 'All') {
            results = results.filter(p => p.category.toLowerCase() === category.toLowerCase());
        }
        
        if (query && query.trim() !== '') {
            const q = query.toLowerCase().trim();
            results = results.filter(p => 
                p.title.toLowerCase().includes(q) || 
                (p.tags && p.tags.some(t => t.toLowerCase().includes(q))) ||
                p.category.toLowerCase().includes(q)
            );
        }
        
        const total = results.length;
        const startIndex = (page - 1) * limit;
        const pagedResults = results.slice(startIndex, startIndex + limit);
        
        return { patterns: pagedResults, total };
    }

    async getPattern(patternId) {
        return this.catalog.find(p => p.id === patternId) || null;
    }
}

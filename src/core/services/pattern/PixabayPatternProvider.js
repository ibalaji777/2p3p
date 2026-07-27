import { PatternProvider } from './PatternProvider.js';

/**
 * Provider for fetching commercial-free seamless textures and vector patterns from Pixabay API.
 * Adheres to Pixabay license guidelines with full attribution support.
 */
const CURATED_PIXABAY_PATTERNS = [];

export class PixabayPatternProvider extends PatternProvider {
    constructor(apiKey = '') {
        super('pixabay', 'Pixabay Open Library (Free for commercial use)');
        this.apiKey = apiKey || (typeof window !== 'undefined' && window.PIXABAY_API_KEY ? window.PIXABAY_API_KEY : '');
        this.baseUrl = 'https://pixabay.com/api/';
        this._cache = new Map();
        CURATED_PIXABAY_PATTERNS.forEach(p => this._cache.set(`pattern_${p.id}`, p));
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    async search({ query = '', category = 'All', page = 1, limit = 24 } = {}) {
        if (!this.apiKey) {
            let list = CURATED_PIXABAY_PATTERNS.slice();
            if (category && category !== 'All') {
                list = list.filter(p => p.category.toLowerCase() === category.toLowerCase());
            }
            if (query && query.trim()) {
                const q = query.toLowerCase().trim();
                list = list.filter(p => p.title.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q)));
            }
            return { patterns: list, total: list.length };
        }

        const cacheKey = `pixabay_${query}_${category}_${page}_${limit}`;
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        let searchTerm = query || 'seamless ornament pattern motif';
        if (category && category !== 'All') {
            searchTerm = `seamless ${category.toLowerCase()} pattern motif ornament`;
        }

        const params = new URLSearchParams({
            key: this.apiKey,
            q: encodeURIComponent(searchTerm),
            image_type: 'illustration',
            orientation: 'horizontal',
            category: 'backgrounds',
            per_page: limit.toString(),
            page: page.toString(),
            safesearch: 'true'
        });

        try {
            const res = await fetch(`${this.baseUrl}?${params.toString()}`);
            if (!res.ok) {
                console.warn(`[PixabayPatternProvider] API request returned status ${res.status}`);
                return { patterns: [], total: 0 };
            }

            const data = await res.json();
            const patterns = (data.hits || []).map(hit => ({
                id: `pixabay_${hit.id}`,
                title: hit.tags ? hit.tags.split(',')[0].trim() || 'Pixabay Pattern' : 'Seamless Pattern',
                category: category !== 'All' ? category : 'Abstract',
                tags: hit.tags ? hit.tags.split(',').map(t => t.trim()) : [],
                thumbnail: hit.previewURL || hit.webformatURL,
                textureUrl: hit.webformatURL || hit.largeImageURL,
                license: 'Pixabay License (Free for commercial use)',
                attribution: `Pixabay / ${hit.user}`,
                provider: this.id,
                sourceUrl: hit.pageURL
            }));

            const result = { patterns, total: data.totalHits || patterns.length };
            this._cache.set(cacheKey, result);
            
            // Re-cache individual patterns for quick getPattern lookup
            patterns.forEach(p => this._cache.set(`pattern_${p.id}`, p));

            return result;
        } catch (err) {
            console.error('[PixabayPatternProvider] Failed to fetch patterns from Pixabay:', err);
            return { patterns: [], total: 0 };
        }
    }

    async getPattern(patternId) {
        if (this._cache.has(`pattern_${patternId}`)) {
            return this._cache.get(`pattern_${patternId}`);
        }
        
        const numericId = patternId.replace(/^pixabay_/, '');
        if (!this.apiKey || !numericId) return null;

        try {
            const res = await fetch(`${this.baseUrl}?key=${this.apiKey}&id=${numericId}`);
            if (!res.ok) return null;
            const data = await res.json();
            if (data.hits && data.hits.length > 0) {
                const hit = data.hits[0];
                const pattern = {
                    id: `pixabay_${hit.id}`,
                    title: hit.tags ? hit.tags.split(',')[0].trim() || 'Pixabay Pattern' : 'Seamless Pattern',
                    category: 'Abstract',
                    tags: hit.tags ? hit.tags.split(',').map(t => t.trim()) : [],
                    thumbnail: hit.previewURL || hit.webformatURL,
                    textureUrl: hit.webformatURL || hit.largeImageURL,
                    license: 'Pixabay License (Free for commercial use)',
                    attribution: `Pixabay / ${hit.user}`,
                    provider: this.id,
                    sourceUrl: hit.pageURL
                };
                this._cache.set(`pattern_${pattern.id}`, pattern);
                return pattern;
            }
        } catch (e) {
            console.error('[PixabayPatternProvider] Error fetching single pattern:', e);
        }
        return null;
    }
}

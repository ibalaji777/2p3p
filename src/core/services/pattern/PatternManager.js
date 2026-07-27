import { OpenSourcePatternProvider } from './OpenSourcePatternProvider.js';
import { PixabayPatternProvider } from './PixabayPatternProvider.js';

/**
 * Singleton service for managing seamless fabric patterns.
 * Orchestrates multi-provider searching (Open-Source CC0 & Pixabay), caching, and category filtering.
 * Extensible design allows plugging in future providers with zero UI changes.
 */
export class PatternManager {
    constructor() {
        this.providers = new Map();
        this.patternCache = new Map();
        
        // Register default providers
        this.registerProvider(new OpenSourcePatternProvider());
        this.registerProvider(new PixabayPatternProvider());
    }

    /**
     * Register a new pattern provider.
     * @param {import('./PatternProvider.js').PatternProvider} provider 
     */
    registerProvider(provider) {
        if (!provider || !provider.id) {
            throw new Error('[PatternManager] Invalid provider instance.');
        }
        this.providers.set(provider.id, provider);
    }

    /**
     * Get a registered provider by ID.
     * @param {string} id 
     * @returns {import('./PatternProvider.js').PatternProvider|null}
     */
    getProvider(id) {
        return this.providers.get(id) || null;
    }

    /**
     * Search across providers or a specific provider.
     * @param {Object} options 
     * @param {string} [options.query='']
     * @param {string} [options.category='All']
     * @param {string} [options.provider='all']
     * @param {number} [options.page=1]
     * @param {number} [options.limit=30]
     * @returns {Promise<{ patterns: Array<Object>, total: number }>}
     */
    async search({ query = '', category = 'All', provider = 'all', page = 1, limit = 30 } = {}) {
        let results = [];
        let totalCount = 0;

        const targetProviders = provider === 'all' 
            ? Array.from(this.providers.values()) 
            : [this.providers.get(provider)].filter(Boolean);

        for (const p of targetProviders) {
            try {
                const res = await p.search({ query, category, page, limit });
                if (res && res.patterns) {
                    results.push(...res.patterns);
                    totalCount += res.total || res.patterns.length;
                    
                    // Populate local singleton cache for instant resolving later
                    res.patterns.forEach(pat => {
                        this.patternCache.set(pat.id, pat);
                    });
                }
            } catch (e) {
                console.error(`[PatternManager] Error searching provider ${p.id}:`, e);
            }
        }

        return { patterns: results, total: totalCount };
    }

    /**
     * Resolve a pattern object by its unique ID across all providers.
     * @param {string} patternId 
     * @returns {Promise<Object|null>}
     */
    async getPatternById(patternId) {
        if (!patternId) return null;
        if (this.patternCache.has(patternId)) {
            return this.patternCache.get(patternId);
        }

        for (const p of this.providers.values()) {
            try {
                if (patternId.startsWith(p.id) || p.id === 'open_source') {
                    const pat = await p.getPattern(patternId);
                    if (pat) {
                        this.patternCache.set(pat.id, pat);
                        return pat;
                    }
                }
            } catch (e) {
                console.error(`[PatternManager] Provider ${p.id} failed to retrieve pattern ${patternId}:`, e);
            }
        }
        return null;
    }

    /**
     * Get available categories supported by the pattern catalog.
     * @returns {Array<string>}
     */
    getCategories() {
        return ['All', 'Floral', 'Geometric', 'Stripes', 'Checks', 'Dots', 'Abstract', 'Traditional', 'Kids', 'Modern'];
    }
}

// Global singleton export
export const patternManager = new PatternManager();

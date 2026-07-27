/**
 * Abstract Base Provider Interface for Fabric Pattern Libraries.
 * Ensures a modular, extensible architecture where multiple sources (Open-Source, Pixabay, custom backends)
 * can be plugged into the Material Gizmo without altering UI code.
 */
export class PatternProvider {
    constructor(id, name) {
        if (new.target === PatternProvider) {
            throw new TypeError('Cannot instantiate abstract class PatternProvider directly');
        }
        this.id = id;
        this.name = name;
    }

    /**
     * Search patterns across categories or by keyword.
     * @param {Object} options - Search options.
     * @param {string} [options.query=''] - Keyword search term.
     * @param {string} [options.category='All'] - Category filter (Floral, Geometric, Stripes, Checks, Dots, Abstract, Traditional, Kids, Modern).
     * @param {number} [options.page=1] - Pagination page number.
     * @param {number} [options.limit=24] - Number of items per page.
     * @returns {Promise<{ patterns: Array<Object>, total: number }>}
     */
    async search(options = {}) {
        throw new Error('Method search() must be implemented by child provider');
    }

    /**
     * Retrieve a specific pattern by its unique ID.
     * @param {string} patternId
     * @returns {Promise<Object|null>}
     */
    async getPattern(patternId) {
        throw new Error('Method getPattern() must be implemented by child provider');
    }
}

/**
 * Utility for real-time composite texture blending between physical base fabric textures and decorative patterns.
 * Uses standard HTML5 Canvas composite operations to dye patterns straight into cloth fibers without custom shaders,
 * preserving Three.js shadow maps, UV scaling, normal maps, and export compatibility.
 */
export class PatternTextureBlender {
    static _cache = new Map();

    /**
     * Asynchronously loads an HTML Image element from a URL or DataURI.
     * @param {string} src 
     * @returns {Promise<HTMLImageElement>}
     */
    static _loadImage(src) {
        return new Promise((resolve, reject) => {
            if (typeof document === 'undefined' || typeof Image === 'undefined') {
                return reject(new Error('Canvas blending requires a browser environment.'));
            }
            const img = new Image();
            if (!src.startsWith('data:')) {
                img.crossOrigin = 'anonymous';
            }
            img.onload = () => resolve(img);
            img.onerror = (err) => {
                console.warn(`[PatternTextureBlender] Failed to load image from source: ${src.slice(0, 80)}...`, err);
                reject(err);
            };
            img.src = src;
        });
    }

    /**
     * Blends a seamless decorative pattern texture with a physical fabric base texture.
     * @param {string} fabricTextureUrl - Base fabric diffuse map URL.
     * @param {string} patternTextureUrl - Decorative pattern URL or Data URI.
     * @param {Object} [options]
     * @param {string} [options.blendMode='multiply'] - Canvas globalCompositeOperation (e.g. 'multiply', 'overlay', 'soft-light').
     * @param {number} [options.patternOpacity=0.95] - Opacity factor for the pattern overlay.
     * @param {number} [options.size=1024] - Size of the synthesized square canvas texture in pixels.
     * @returns {Promise<string>} Data URL of the composite texture.
     */
    static async blend(fabricTextureUrl, patternTextureUrl, options = {}) {
        if (!patternTextureUrl && !fabricTextureUrl) return '';
        if (!patternTextureUrl) return fabricTextureUrl;

        const blendMode = options.blendMode || 'multiply';
        const opacity = options.patternOpacity !== undefined ? options.patternOpacity : 0.95;
        const targetSize = options.size || 512;
        const color = options.color || '#ffffff';

        const cacheKey = `${(fabricTextureUrl || '').slice(0, 80)}_${patternTextureUrl.slice(0, 80)}_${color}_${blendMode}_${opacity}_${targetSize}`;
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        try {
            const [fabricImg, patternImg] = await Promise.all([
                fabricTextureUrl ? this._loadImage(fabricTextureUrl).catch(() => null) : Promise.resolve(null),
                patternTextureUrl ? this._loadImage(patternTextureUrl).catch(() => null) : Promise.resolve(null)
            ]);

            if (!patternImg && !fabricImg) return fabricTextureUrl || '';
            if (!patternImg) return fabricTextureUrl;

            const canvas = document.createElement('canvas');
            canvas.width = targetSize;
            canvas.height = targetSize;
            const ctx = canvas.getContext('2d');

            // 1. Fill base canvas background with fabric color (e.g., Navy, Ruby, Emerald, Gold, Cream)
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, targetSize, targetSize);

            // 2. Draw pattern image with specified opacity
            ctx.globalAlpha = opacity;
            ctx.drawImage(patternImg, 0, 0, targetSize, targetSize);

            // 3. If fabric texture image is available, multiply fabric weave texture over pattern & color
            if (fabricImg) {
                ctx.globalAlpha = 1.0;
                ctx.globalCompositeOperation = blendMode;
                ctx.drawImage(fabricImg, 0, 0, targetSize, targetSize);
            }

            // 4. Reset composite operation and export Data URL
            ctx.globalCompositeOperation = 'source-over';
            const dataUrl = canvas.toDataURL('image/png');
            this._cache.set(cacheKey, dataUrl);
            return dataUrl;
        } catch (e) {
            console.error('[PatternTextureBlender] Synthesis failed, falling back to pattern/base texture:', e);
            return patternTextureUrl || fabricTextureUrl;
        }
    }
}

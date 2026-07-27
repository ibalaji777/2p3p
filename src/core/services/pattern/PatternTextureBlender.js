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
     * @param {number} [options.size=512] - Size of the synthesized square canvas texture in pixels.
     * @returns {Promise<string>} Data URL of the composite texture.
     */
    static async blend(fabricTextureUrl, patternTextureUrl, options = {}) {
        if (!patternTextureUrl && !fabricTextureUrl) return '';
        if (!patternTextureUrl) return fabricTextureUrl;

        const blendMode = options.blendMode || 'multiply';
        const opacity = options.patternOpacity !== undefined ? options.patternOpacity : (options.opacity !== undefined ? options.opacity / 100 : 0.95);
        const targetSize = options.size || 512;
        const color = options.color || '#ffffff';
        const scale = options.scale !== undefined ? (options.scale / 100) : 1.2;
        const rotation = options.rotation !== undefined ? (options.rotation * Math.PI / 180) : (45 * Math.PI / 180);
        const repeat = options.repeat !== undefined ? options.repeat : 2.0;
        const mirror = options.mirror || 'off';
        const roughness = options.roughness !== undefined ? options.roughness : 50;
        const sheen = options.sheen !== undefined ? options.sheen : 50;

        const cacheKey = `${(fabricTextureUrl || '').slice(0, 50)}_${patternTextureUrl.slice(0, 50)}_${color}_${opacity}_${scale}_${rotation}_${repeat}_${mirror}_${roughness}_${sheen}_${targetSize}`;
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

            // 1. Base fabric color background
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, targetSize, targetSize);

            // 2. Draw scaled, rotated & repeated pattern
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.translate(targetSize / 2, targetSize / 2);
            ctx.rotate(rotation);

            // Calculate tile dimension in canvas pixels based on scale & repeat
            const tileSize = (targetSize / Math.max(0.2, repeat)) * scale;
            let flipX = 1;
            let flipY = 1;
            if (mirror === 'horizontal' || mirror === 'both') flipX = -1;
            if (mirror === 'vertical' || mirror === 'both') flipY = -1;

            const bounds = targetSize * 2.5;
            const startX = -bounds;
            const endX = bounds;
            const startY = -bounds;
            const endY = bounds;

            for (let y = startY; y < endY; y += tileSize) {
                for (let x = startX; x < endX; x += tileSize) {
                    ctx.save();
                    ctx.translate(x + tileSize / 2, y + tileSize / 2);
                    ctx.scale(flipX, flipY);
                    ctx.drawImage(patternImg, -tileSize / 2, -tileSize / 2, tileSize, tileSize);
                    ctx.restore();
                }
            }
            ctx.restore();

            // 3. If fabric texture image is available, multiply weave texture over pattern
            if (fabricImg) {
                ctx.globalAlpha = 0.85;
                ctx.globalCompositeOperation = blendMode;
                ctx.drawImage(fabricImg, 0, 0, targetSize, targetSize);
            }

            // 4. Physical Cloth Sheen / Velvet Micro-Fiber highlights
            if (sheen > 0) {
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = (sheen / 100) * 0.25;
                const grad = ctx.createRadialGradient(targetSize / 2, targetSize / 2, 10, targetSize / 2, targetSize / 2, targetSize * 0.7);
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
                grad.addColorStop(0.6, 'rgba(192, 132, 252, 0.3)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, targetSize, targetSize);
            }

            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;

            const dataUrl = canvas.toDataURL('image/png');
            this._cache.set(cacheKey, dataUrl);
            return dataUrl;
        } catch (e) {
            console.error('[PatternTextureBlender] Synthesis failed, falling back to base texture:', e);
            return fabricTextureUrl || patternTextureUrl;
        }
    }
}

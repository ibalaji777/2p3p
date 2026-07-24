import * as THREE from 'three';

export class MaterialFactory {
    /**
     * Replaces or creates a PBR MeshStandardMaterial based on registry config.
     * @param {THREE.Mesh} targetMesh - The mesh to apply the material to.
     * @param {Object} config - The material configuration from the registry.
     * @param {Object} ctx - The global context containing asset manager and renderer.
     * @param {number} materialIndex - If the mesh uses an array of materials, which index to replace.
     */
    static async applyPBRMaterial(targetMesh, config, ctx, materialIndex = -1) {
        if (!targetMesh || !config) return;

        // Clone existing material to avoid shared GLTF instance corruption
        let newMat;
        if (materialIndex !== -1 && Array.isArray(targetMesh.material)) {
            newMat = targetMesh.material[materialIndex].clone();
        } else {
            newMat = Array.isArray(targetMesh.material) ? targetMesh.material[0].clone() : targetMesh.material.clone();
        }

        // Fetch textures concurrently
        const fetches = [
            config.texture ? ctx.assets.getTexture(config.texture, { isColorData: true }) : Promise.resolve(null),
            config.normal ? ctx.assets.getTexture(config.normal, { isColorData: false }) : Promise.resolve(null),
            config.roughnessMap ? ctx.assets.getTexture(config.roughnessMap, { isColorData: false }) : Promise.resolve(null),
            config.aoMap ? ctx.assets.getTexture(config.aoMap, { isColorData: false }) : Promise.resolve(null),
            config.metalnessMap ? ctx.assets.getTexture(config.metalnessMap, { isColorData: false }) : Promise.resolve(null)
        ];

        const [tex, normalTex, roughTex, aoTex, metalTex] = await Promise.all(fetches);

        // Shared Texture Lifetime Management: Detach references instead of disposing.
        // Disposing would destroy the texture from the global AssetManager cache.
        if (newMat.map) newMat.map = null;
        if (newMat.normalMap) newMat.normalMap = null;
        if (newMat.roughnessMap) newMat.roughnessMap = null;
        if (newMat.aoMap) newMat.aoMap = null;
        if (newMat.metalnessMap) newMat.metalnessMap = null;

        // Robust Entity Lookup for Imported GLB Models
        let targetEntity = targetMesh.userData.entity;
        if (!targetEntity) {
            let current = targetMesh;
            while (current && !current.userData.entity) {
                current = current.parent;
            }
            if (current) targetEntity = current.userData.entity;
        }

        // Calculate UV Density based on real-world dimensions (defaultTileSize or fixed config.repeat)
        let repeatScale = 1;
        if (config.repeat) {
            repeatScale = config.repeat;
        } else if (targetEntity) {
            const dim = Math.max(targetEntity.width || 100, targetEntity.height || 100);
            const ts = config.defaultTileSize || 40;
            repeatScale = dim / ts;
        }
        
        // Setup shared texture properties (wrap, repeat, rotation, anisotropy)
        const setupTex = (t) => {
            if (!t) return null;
            const tClone = t.clone();
            tClone.wrapS = tClone.wrapT = THREE.RepeatWrapping;
            tClone.repeat.set(repeatScale, repeatScale);
            
            if (config.rotation) {
                tClone.rotation = config.rotation;
                tClone.center.set(0.5, 0.5);
            }
            if (config.flipY !== undefined) {
                tClone.flipY = config.flipY;
            }
            if (ctx.renderer) {
                tClone.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
            }
            tClone.needsUpdate = true;
            return tClone;
        };

        newMat.map = setupTex(tex);
        newMat.normalMap = setupTex(normalTex);
        newMat.roughnessMap = setupTex(roughTex);
        newMat.aoMap = setupTex(aoTex);
        newMat.metalnessMap = setupTex(metalTex);

        // Apply physical properties
        if (config.color !== undefined) {
            newMat.color.setHex(config.color);
        } else if (newMat.map) {
            newMat.color.setHex(0xffffff); // Reset base color if using map
        }
        
        if (config.roughness !== undefined) newMat.roughness = config.roughness;
        if (config.metalness !== undefined) newMat.metalness = config.metalness;
        if (config.normalScale !== undefined && newMat.normalMap) {
            newMat.normalScale.set(config.normalScale, config.normalScale);
        }
        if (config.aoIntensity !== undefined && newMat.aoMap) {
            newMat.aoMapIntensity = config.aoIntensity;
        }
        if (config.transparent) {
            newMat.transparent = true;
            newMat.opacity = config.opacity !== undefined ? config.opacity : 1.0;
        }

        newMat.needsUpdate = true;

        // Safely apply back to mesh
        if (materialIndex !== -1 && Array.isArray(targetMesh.material)) {
            targetMesh.material[materialIndex] = newMat;
        } else {
            targetMesh.material = newMat;
        }
    }
}

import * as THREE from 'three';
import { resolveFabricConfig } from '../registry.js';

export class MaterialFactory {
    /**
     * Identifies if a material configuration originates from the central Material Library.
     * @param {Object|string} config - The material key or configuration object.
     * @returns {boolean} True if from Material Library, false if basic/default.
     */
    static isLibraryMaterial(config) {
        if (!config) return false;
        if (typeof config === 'string') {
            return Boolean(
                config.includes('wood') ||
                config.includes('marble') ||
                config.includes('stone') ||
                config.includes('metal') ||
                config.includes('door_') ||
                config.includes('::pattern::') ||
                config.includes('/')
            );
        }
        return Boolean(config.id || config.texture || config.isLibrary || config.tileSize);
    }

    /**
     * Automatically computes texture UV repeat scaling based on object physical dimensions and material tile size.
     * For Material Library textures, applies real-world texel density.
     * For non-library textures or basic fallbacks, defaults to standard 1x1 behavior.
     * @param {THREE.Mesh} targetMesh - The mesh being rendered or textured.
     * @param {Object} config - Material configuration object containing tileSize / repeat parameters.
     * @returns {{repeatX: number, repeatY: number}} Calculated UV repeat factors.
     */
    static calculateTexelDensity(targetMesh, config = {}) {
        if (!MaterialFactory.isLibraryMaterial(config) && !config.repeat && !config.tileSize) {
            return { repeatX: 1, repeatY: 1 };
        }

        if (typeof config.repeat === 'object') {
            return { repeatX: config.repeat.x || 1, repeatY: config.repeat.y || 1 };
        } else if (typeof config.repeat === 'number') {
            return { repeatX: config.repeat, repeatY: config.repeat };
        } else if (config.defaultRepeat !== undefined) {
            return { repeatX: config.defaultRepeat, repeatY: config.defaultRepeat };
        }

        // Determine real-world physical tile size (in cm)
        let ts = config.realWorldSize || config.tileSize || config.defaultTileSize;
        if (!ts) {
            const matId = config.id || (typeof config === 'string' ? config : '');
            if (matId.includes('marble')) ts = 160;
            else if (matId.includes('wood')) ts = 150;
            else if (matId.includes('metal')) ts = 120;
            else if (matId.includes('stone') || matId.includes('brick')) ts = 60;
            else ts = 60;
        }

        // Determine object physical dimensions
        let width = 100, height = 100;
        let targetEntity = targetMesh?.userData?.entity;
        if (!targetEntity && targetMesh) {
            let current = targetMesh;
            while (current && !current.userData?.entity) {
                current = current.parent;
            }
            if (current) targetEntity = current.userData.entity;
        }

        if (targetEntity) {
            width = targetEntity.width || targetEntity.params?.width || 100;
            height = targetEntity.height || targetEntity.params?.height || targetEntity.depth || 100;
        } else if (targetMesh && targetMesh.geometry) {
            if (!targetMesh.geometry.boundingBox) targetMesh.geometry.computeBoundingBox();
            const box = targetMesh.geometry.boundingBox;
            if (box) {
                const sizeX = Math.abs(box.max.x - box.min.x);
                const sizeY = Math.abs(box.max.y - box.min.y);
                const sizeZ = Math.abs(box.max.z - box.min.z);
                width = sizeX > 0.001 ? sizeX : 100;
                height = Math.max(sizeY, sizeZ) > 0.001 ? Math.max(sizeY, sizeZ) : 100;
            }
        }

        return {
            repeatX: width / ts,
            repeatY: height / ts
        };
    }

    /**
     * Replaces or creates a PBR MeshStandardMaterial based on registry config.
     * @param {THREE.Mesh} targetMesh - The mesh to apply the material to.
     * @param {Object|string} config - The material configuration from the registry or composite key.
     * @param {Object} ctx - The global context containing asset manager and renderer.
     * @param {number} materialIndex - If the mesh uses an array of materials, which index to replace.
     */
    static async applyPBRMaterial(targetMesh, config, ctx, materialIndex = -1) {
        if (!targetMesh || !config) return;

        if (typeof config === 'string') {
            const res = await resolveFabricConfig(config);
            if (res) config = res;
            else config = { texture: config };
        } else if (config.id && typeof config.id === 'string' && config.id.includes('::pattern::') && !config.isComposite) {
            const res = await resolveFabricConfig(config.id);
            if (res) config = res;
        }

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
        if (newMat.map) newMat.map = null;
        if (newMat.normalMap) newMat.normalMap = null;
        if (newMat.roughnessMap) newMat.roughnessMap = null;
        if (newMat.aoMap) newMat.aoMap = null;
        if (newMat.metalnessMap) newMat.metalnessMap = null;

        // Calculate UV Density automatically based on real-world dimensions & tile size
        const { repeatX, repeatY } = MaterialFactory.calculateTexelDensity(targetMesh, config);
        
        // Setup shared texture properties (wrap, repeat, rotation, anisotropy)
        const setupTex = (t) => {
            if (!t) return null;
            const tClone = t.clone();
            tClone.wrapS = tClone.wrapT = THREE.RepeatWrapping;
            tClone.repeat.set(repeatX, repeatY);
            
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
        if (config.color !== undefined && config.color !== null) {
            newMat.color.setHex(config.color);
        } else {
            newMat.color.setHex(0xffffff); // Reset base color to white so textures render bright
        }
        
        // Physical Roughness & Metalness
        if (config.roughness !== undefined) {
            newMat.roughness = config.roughness;
        }
        newMat.metalness = config.metalness !== undefined ? config.metalness : 0.0;

        // Physical Sheen (Velvet/Satin micro-fibers)
        if (config.sheen !== undefined) {
            newMat.sheen = config.sheen;
            if (!newMat.sheenColor) newMat.sheenColor = new THREE.Color(0xffffff);
            else newMat.sheenColor.setHex(0xffffff);
        }

        if (config.clearcoat !== undefined) newMat.clearcoat = config.clearcoat;
        if (config.clearcoatRoughness !== undefined) newMat.clearcoatRoughness = config.clearcoatRoughness;
        if (config.normalScale !== undefined && newMat.normalMap) {
            newMat.normalScale.set(config.normalScale, config.normalScale);
        }
        if (config.aoIntensity !== undefined && newMat.aoMap) {
            newMat.aoMapIntensity = config.aoIntensity;
        }

        // Support Physical Transmission & Glass Properties
        if (config.transmission !== undefined || config.transparent) {
            if (newMat.type !== 'MeshPhysicalMaterial') {
                newMat = new THREE.MeshPhysicalMaterial({
                    color: newMat.color ? newMat.color.clone() : new THREE.Color(0xffffff)
                });
            }
            newMat.transmission = config.transmission !== undefined ? config.transmission : 0.9;
            newMat.ior = config.ior || 1.5;
            newMat.thickness = config.thickness || 2.0;
            newMat.transparent = true;
            newMat.opacity = config.opacity !== undefined ? config.opacity : 1.0;
            newMat.depthWrite = config.depthWrite !== undefined ? config.depthWrite : false;
            newMat.depthTest = true;
            newMat.roughness = config.roughness !== undefined ? config.roughness : 0.02;
            newMat.metalness = config.metalness !== undefined ? config.metalness : 0.0;
            if (config.attenuationColor) {
                newMat.attenuationColor = new THREE.Color(config.attenuationColor);
                newMat.attenuationDistance = config.attenuationDistance || 15.0;
            }
            if (config.specularIntensity !== undefined) {
                newMat.specularIntensity = config.specularIntensity;
            }
        } else {
            // Guarantee Mesh Visibility, Opaque Rendering, and Depth Writing for opaque materials
            newMat.visible = true;
            newMat.depthWrite = true;
            newMat.depthTest = true;
            newMat.opacity = 1.0;
            newMat.transparent = false;
        }

        if (newMat.map) newMat.map.needsUpdate = true;
        newMat.needsUpdate = true;

        // Safely apply back to mesh
        if (materialIndex !== -1 && Array.isArray(targetMesh.material)) {
            let targetIdx = materialIndex;
            if (targetIdx >= targetMesh.material.length) {
                targetIdx = targetMesh.material.length === 2 ? 0 : (targetMesh.material.length - 1);
            }
            targetMesh.material[targetIdx] = newMat;
        } else {
            targetMesh.material = newMat;
        }

        // Trigger real-time 3D viewport re-render
        if (ctx && typeof ctx.requestRender === 'function') ctx.requestRender();
        else if (ctx && typeof ctx.render === 'function') ctx.render();
        else if (window.engine3d && typeof window.engine3d.requestRender === 'function') window.engine3d.requestRender();
    }
}

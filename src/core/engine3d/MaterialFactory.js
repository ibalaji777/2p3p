import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { resolveFabricConfig } from '../registry.js';

export class MaterialFactory {
    static materialCache = new Map();

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

    static extractAverageColor(image) {
        if (!image) return { color: new THREE.Color(0xefede5), luminance: 0.8 };
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const width = canvas.width = image.width || image.videoWidth || 64;
        const height = canvas.height = image.height || image.videoHeight || 64;
        context.drawImage(image, 0, 0, width, height);
        
        let data;
        try {
            data = context.getImageData(0, 0, width, height).data;
        } catch(e) {
            return { color: new THREE.Color(0xefede5), luminance: 0.8 };
        }
        
        let r = 0, g = 0, b = 0, count = 0;
        const step = 4 * 10;
        for (let i = 0; i < data.length; i += step) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
        }
        if (count > 0) {
            r = r / count / 255;
            g = g / count / 255;
            b = b / count / 255;
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            return { color: new THREE.Color(r, g, b), luminance };
        }
        return { color: new THREE.Color(0xefede5), luminance: 0.8 };
    }

    static calculateTexelDensity(dimensions, config = {}) {
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

        let ts = config.realWorldSize || config.tileSize || config.defaultTileSize;
        if (!ts) {
            const matId = config.id || (typeof config === 'string' ? config : '');
            if (matId.includes('marble')) ts = 160;
            else if (matId.includes('wood')) ts = 150;
            else if (matId.includes('metal')) ts = 120;
            else if (matId.includes('stone') || matId.includes('brick')) ts = 60;
            else ts = 60;
        }

        const width = dimensions.width || 100;
        const height = dimensions.height || 100;

        if (dimensions.isWorldUV) {
            return {
                repeatX: 1 / ts,
                repeatY: 1 / ts
            };
        }

        return {
            repeatX: width / ts,
            repeatY: height / ts
        };
    }

    static resolveOrientation(config, dimensions, faceName) {
        let mode = config.orientation || 'AUTO';
        
        if (mode === 'CUSTOM' && config.rotation !== undefined) {
            return config.rotation;
        }
        if (mode === 'VERTICAL') return 0;
        if (mode === 'HORIZONTAL') return Math.PI / 2;
        if (mode === 'UV') return 0; // Depends on UV layout entirely

        // AUTO mode
        if (config.rotation !== undefined) return config.rotation;
        
        const matId = config.id || (typeof config === 'string' ? config : '');
        const isWood = typeof matId === 'string' && matId.includes('wood');
        
        if (isWood) {
            const w = dimensions.width || 100;
            const h = dimensions.height || 100;
            // Intelligent Orientation Resolver: Wood grain usually flows along the longest axis.
            if (w > h) {
                return Math.PI / 2;
            }
        }
        return 0;
    }

    static async buildPBRMaterial(options) {
        let { material, config, ctx, dimensions, faceName } = options;
        if (!config) return material || new THREE.MeshStandardMaterial();

        let originalConfigId = typeof config === 'string' ? config : config.id;

        if (typeof config === 'string') {
            const res = await resolveFabricConfig(config);
            if (res) config = res;
            else config = { texture: config, id: originalConfigId };
        } else if (config.id && typeof config.id === 'string' && config.id.includes('::pattern::') && !config.isComposite) {
            const res = await resolveFabricConfig(config.id);
            if (res) config = res;
        }
        
        if (!config.id && originalConfigId) config.id = originalConfigId;

        const dims = dimensions || { width: 100, height: 100 };
        const { repeatX, repeatY } = this.calculateTexelDensity(dims, config);
        const rotation = this.resolveOrientation(config, dims, faceName);

        // Global Material Cache key based on config ID and UV Transform
        const cacheKey = `${config.id}_${repeatX.toFixed(4)}_${repeatY.toFixed(4)}_${rotation.toFixed(4)}_${config.color || 'default'}`;
        if (config.id && this.materialCache.has(cacheKey)) {
            const cachedMat = this.materialCache.get(cacheKey);
            // If we received an existing material object to mutate in-place, we must copy the cached material's properties
            if (material) {
                material.copy(cachedMat);
                return material;
            }
            return cachedMat; // Otherwise we can just share the cached reference
        }

        let newMat = material || new THREE.MeshStandardMaterial();

        // Assets caching is handled internally by ctx.assets.getTexture
        const fetches = [
            (config.texture && ctx && ctx.assets) ? ctx.assets.getTexture(config.texture, { isColorData: true }) : Promise.resolve(null),
            (config.normal && ctx && ctx.assets) ? ctx.assets.getTexture(config.normal, { isColorData: false }) : Promise.resolve(null),
            (config.roughnessMap && ctx && ctx.assets) ? ctx.assets.getTexture(config.roughnessMap, { isColorData: false }) : Promise.resolve(null),
            (config.aoMap && ctx && ctx.assets) ? ctx.assets.getTexture(config.aoMap, { isColorData: false }) : Promise.resolve(null),
            (config.metalnessMap && ctx && ctx.assets) ? ctx.assets.getTexture(config.metalnessMap, { isColorData: false }) : Promise.resolve(null)
        ];

        const [tex, normalTex, roughTex, aoTex, metalTex] = await Promise.all(fetches);

        const setupTex = (t, isColor) => {
            if (!t) return null;
            const tClone = t.clone();
            tClone.wrapS = tClone.wrapT = THREE.RepeatWrapping;
            tClone.repeat.set(repeatX, repeatY);
            
            tClone.rotation = rotation;
            tClone.center.set(0.5, 0.5);

            if (config.flipY !== undefined) {
                tClone.flipY = config.flipY;
            }
            if (ctx && ctx.renderer) {
                tClone.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
            }
            
            // Universal Color Space assignment
            if (isColor && THREE.SRGBColorSpace) {
                tClone.colorSpace = THREE.SRGBColorSpace;
            } else if (!isColor && THREE.NoColorSpace) {
                tClone.colorSpace = THREE.NoColorSpace;
            }

            tClone.needsUpdate = true;
            return tClone;
        };

        newMat.map = setupTex(tex, true);
        newMat.normalMap = setupTex(normalTex, false);
        newMat.roughnessMap = setupTex(roughTex, false);
        newMat.aoMap = setupTex(aoTex, false);
        if (ctx && ctx.renderer && !MaterialFactory.sharedEnvMap) {
            const pmremGenerator = new THREE.PMREMGenerator(ctx.renderer);
            pmremGenerator.compileEquirectangularShader();
            const roomEnv = new RoomEnvironment();
            MaterialFactory.sharedEnvMap = pmremGenerator.fromScene(roomEnv).texture;
            roomEnv.dispose();
            pmremGenerator.dispose();
        }

        if (MaterialFactory.sharedEnvMap) {
            newMat.envMap = MaterialFactory.sharedEnvMap;
            newMat.envMapIntensity = config.envMapIntensity !== undefined ? config.envMapIntensity : 0.25;
        }

        if (tex) {
            newMat.color.setHex(0xffffff);
        } else if (config.color !== undefined && config.color !== null) {
            newMat.color.setHex(config.color);
        } else {
            newMat.color.setHex(0xffffff);
        }
        
        newMat.roughness = config.roughness !== undefined ? config.roughness : 0.5;
        newMat.metalness = config.metalness !== undefined ? config.metalness : 0.0;

        if (config.sheen !== undefined) {
            newMat.sheen = config.sheen;
            if (!newMat.sheenColor) newMat.sheenColor = new THREE.Color(0xffffff);
            else newMat.sheenColor.setHex(0xffffff);
        }

        if (config.clearcoat !== undefined && ('clearcoat' in newMat || newMat.isMeshPhysicalMaterial)) {
            newMat.clearcoat = config.clearcoat;
        }
        if (config.clearcoatRoughness !== undefined && ('clearcoatRoughness' in newMat || newMat.isMeshPhysicalMaterial)) {
            newMat.clearcoatRoughness = config.clearcoatRoughness;
        }
        if (config.normalScale !== undefined && newMat.normalMap) {
            newMat.normalScale = new THREE.Vector2(config.normalScale, config.normalScale);
        } else if (newMat.normalMap) {
            newMat.normalScale = new THREE.Vector2(1, 1);
        }
        if (config.aoIntensity !== undefined && newMat.aoMap) {
            newMat.aoMapIntensity = config.aoIntensity;
        }

        if (config.transmission !== undefined || config.transparent) {
            if (newMat.type !== 'MeshPhysicalMaterial') {
                if (!material) {
                    const oldColor = newMat.color.clone();
                    newMat = new THREE.MeshPhysicalMaterial({ color: oldColor });
                }
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
            newMat.visible = true;
            newMat.depthWrite = true;
            newMat.depthTest = true;
            newMat.opacity = 1.0;
            newMat.transparent = false;
        }

        if (newMat.map) newMat.map.needsUpdate = true;
        newMat.needsUpdate = true;

        if (faceName === 'floor') {
            let avgColor = new THREE.Color(0xefede5);
            let luminance = 0.8;
            if (tex && tex.image) {
                if (tex.userData?.averageColor && tex.userData?.luminance !== undefined) {
                    avgColor = tex.userData.averageColor;
                    luminance = tex.userData.luminance;
                } else {
                    const extracted = this.extractAverageColor(tex.image);
                    avgColor = extracted.color;
                    luminance = extracted.luminance;
                    tex.userData.averageColor = avgColor;
                    tex.userData.luminance = luminance;
                }
            } else if (config.color) {
                avgColor = new THREE.Color(config.color);
                luminance = 0.299 * avgColor.r + 0.587 * avgColor.g + 0.114 * avgColor.b;
            }
            
            // Calculate reflectivity based on material
            let reflectivity = 0.20; // Default
            const matId = String(config.id || '').toLowerCase();
            if (matId.includes('wood')) reflectivity = 0.30;
            else if (matId.includes('marble')) reflectivity = 0.18;
            else if (matId.includes('concrete')) reflectivity = 0.12;
            else if (matId.includes('carpet') || matId.includes('fabric')) reflectivity = 0.08;
            else if (matId.includes('tile')) {
                reflectivity = luminance > 0.5 ? 0.25 : 0.05; 
            }
            
            const bounceIntensity = luminance * reflectivity;

            if (window.updateFloorBounce) {
                window.updateFloorBounce(avgColor, bounceIntensity);
            }
        }

        if (config.id) {
            this.materialCache.set(cacheKey, newMat);
        }

        return newMat;
    }

    static async applyPBRMaterial(targetMesh, config, ctx, materialIndex = -1) {
        if (!targetMesh || !config) return;

        let dimensions = { width: 100, height: 100 };
        let targetEntity = targetMesh?.userData?.entity;
        if (!targetEntity && targetMesh) {
            let current = targetMesh;
            while (current && !current.userData?.entity) {
                current = current.parent;
            }
            if (current) targetEntity = current.userData.entity;
        }

        if (targetEntity) {
            dimensions.width = targetEntity.width || targetEntity.params?.width || targetEntity.length3D || 100;
            dimensions.height = targetEntity.height || targetEntity.params?.height || targetEntity.depth || 100;
            const isWall = targetEntity.type === 'outer' || targetEntity.type === 'inner' || targetEntity.type === 'wall' || targetEntity.startX !== undefined;
            if (isWall) dimensions.isWorldUV = true;
        } else if (targetMesh && targetMesh.geometry) {
            if (!targetMesh.geometry.boundingBox) targetMesh.geometry.computeBoundingBox();
            const box = targetMesh.geometry.boundingBox;
            if (box) {
                const sizeX = Math.abs(box.max.x - box.min.x);
                const sizeY = Math.abs(box.max.y - box.min.y);
                const sizeZ = Math.abs(box.max.z - box.min.z);
                dimensions.width = sizeX > 0.001 ? sizeX : 100;
                dimensions.height = Math.max(sizeY, sizeZ) > 0.001 ? Math.max(sizeY, sizeZ) : 100;
            }
        }

        let baseMaterial;
        if (materialIndex !== -1 && Array.isArray(targetMesh.material)) {
            baseMaterial = targetMesh.material[materialIndex];
        } else {
            baseMaterial = Array.isArray(targetMesh.material) ? targetMesh.material[0] : targetMesh.material;
        }

        const newMat = await this.buildPBRMaterial({
            material: baseMaterial,
            config: config,
            ctx: ctx,
            dimensions: dimensions,
            faceName: 'front'
        });

        if (materialIndex !== -1 && Array.isArray(targetMesh.material)) {
            let targetIdx = materialIndex;
            if (targetIdx >= targetMesh.material.length) {
                targetIdx = targetMesh.material.length === 2 ? 0 : (targetMesh.material.length - 1);
            }
            targetMesh.material[targetIdx] = newMat;
        } else {
            targetMesh.material = newMat;
        }

        if (ctx && typeof ctx.requestRender === 'function') ctx.requestRender();
        else if (ctx && typeof ctx.render === 'function') ctx.render();
        else if (window.engine3d && typeof window.engine3d.requestRender === 'function') window.engine3d.requestRender();
    }
}

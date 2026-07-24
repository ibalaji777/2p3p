import * as THREE from 'three';

export class PreviewMeshRegistry {
    constructor(ctx) {
        this.ctx = ctx;
        this.meshCache = new Map();
        
        this.mappings = {
            'fabric': 'models/material_previews/draped_cloth_optimized.glb',
            'leather': 'models/material_previews/upholstered_cushion.glb',
            'wood': 'models/material_previews/rounded_cube.glb',
            'marble': 'models/material_previews/beveled_slab.glb',
            'tile': 'models/material_previews/floor_plane.glb',
            'metal': 'models/material_previews/chamfered_block.glb',
            'glass': 'models/material_previews/beveled_glass_cube.glb',
            'stone': 'models/material_previews/carved_block.glb',
            'concrete': 'models/material_previews/architectural_panel.glb'
        };
    }

    async getPreviewMesh(materialType) {
        const type = materialType || 'fabric';
        
        if (this.meshCache.has(type)) {
            return this.meshCache.get(type).clone();
        }

        const modelPath = this.mappings[type];
        
        if (modelPath && this.ctx && this.ctx.assets) {
            try {
                // Attempt to load the dedicated GLB preview mesh
                const model = await this.ctx.assets.getModel({ model: modelPath });
                if (model) {
                    // Normalize the GLB scale and center it so framing is easier
                    const clone = model.clone();
                    
                    const bbox = new THREE.Box3().setFromObject(clone);
                    const size = bbox.getSize(new THREE.Vector3());
                    const center = bbox.getCenter(new THREE.Vector3());
                    
                    clone.position.sub(center);
                    
                    // Standardize size to roughly 100 units
                    const maxDim = Math.max(size.x, size.y, size.z);
                    if (maxDim > 0) {
                        const scale = 100 / maxDim;
                        clone.scale.setScalar(scale);
                    }
                    
                    this.meshCache.set(type, clone);
                    return clone.clone();
                }
            } catch (err) {
                console.warn(`[PreviewMeshRegistry] Could not load ${modelPath}, falling back to procedural mesh for ${type}.`);
            }
        }

        // Fallback procedural geometry if GLB is missing
        const mesh = this._generateProceduralFallback(type);
        this.meshCache.set(type, mesh);
        return mesh.clone();
    }

    _generateProceduralFallback(type) {
        let geo;
        
        switch (type) {
            case 'fabric':
            case 'leather':
                // Procedural perturbed sphere to simulate soft object
                geo = new THREE.SphereGeometry(45, 64, 64);
                const pos = geo.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const nx = pos.getX(i);
                    const ny = pos.getY(i);
                    const nz = pos.getZ(i);
                    const noise = Math.sin(nx * 0.1) * Math.cos(ny * 0.1) * Math.sin(nz * 0.1) * 3;
                    pos.setX(i, nx + (nx/45)*noise);
                    pos.setY(i, ny + (ny/45)*noise);
                    pos.setZ(i, nz + (nz/45)*noise);
                }
                geo.computeVertexNormals();
                break;
            case 'wood':
            case 'metal':
                geo = new THREE.BoxGeometry(80, 80, 80);
                break;
            case 'tile':
            case 'marble':
                geo = new THREE.PlaneGeometry(100, 100);
                geo.rotateX(-Math.PI / 2);
                break;
            case 'glass':
                geo = new THREE.BoxGeometry(60, 80, 60);
                break;
            default:
                geo = new THREE.SphereGeometry(45, 32, 32);
                break;
        }

        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
        return mesh;
    }
}

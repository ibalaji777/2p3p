import * as THREE from 'three';
import { FURNITURE_REGISTRY } from '../registry.js';

export class FurnitureManager {
    // SOLID: Dependency Injection via constructor parameters.
    constructor(assets, structureGroup, interactables, callbacks) { 
        this.assets = assets; 
        this.structureGroup = structureGroup;
        this.interactables = interactables;
        this.callbacks = callbacks; // Expects { onAutoSelect }
        this.isUpdatingFrom3D = false;
    }

    async load(entity) {
        const config = FURNITURE_REGISTRY[entity.configId || (entity.config && entity.config.id)];
        if (!config) return;

        try {
            const model = await this.assets.getModel(config);
            const gltfScene = model.clone();
            
            // Clone materials so highlighting one chair doesn't highlight all chairs
            gltfScene.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material = Array.isArray(child.material) 
                        ? child.material.map(m => m.clone()) 
                        : child.material.clone();
                }
            });

            const wrapper = new THREE.Group();
            wrapper.add(gltfScene);
            
            // Calculate perfect bounding box for the hitbox
            const box = new THREE.Box3().setFromObject(gltfScene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            // Center the model perfectly inside the wrapper
            gltfScene.position.set(-center.x, -box.min.y, -center.z);

            // Create invisible hitbox for raycasting
            const hitBox = new THREE.Mesh(
                new THREE.BoxGeometry(size.x, size.y, size.z), 
                new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
            );
            hitBox.position.set(0, size.y / 2, 0);
            hitBox.userData = { isHitbox: true };
            wrapper.add(hitBox);

            wrapper.traverse((child) => { 
                if (child.isMesh && !child.userData.isHitbox) { 
                    child.castShadow = true; 
                    child.receiveShadow = true; 
                    this.interactables.push(child); 
                } 
            });

            // Protect against zero-size division errors
            const safeW = size.x > 0 ? size.x : 1;
            const safeH = size.y > 0 ? size.y : 1;
            const safeD = size.z > 0 ? size.z : 1;
            
            wrapper.userData = { 
                isFurniture: true, 
                entity: entity, 
                originalSize: new THREE.Vector3(safeW, safeH, safeD) 
            };
            entity.mesh3D = wrapper;
            
            this.interactables.push(hitBox);
            this.structureGroup.add(wrapper);
            this.updateLive(entity);

            // Notify Orchestrator if this model was spawned while already selected in UI
            if (this.callbacks && this.callbacks.onAutoSelect) {
                this.callbacks.onAutoSelect(entity, wrapper);
            }
        } catch (e) { 
            console.error("Failed to load furniture model:", e); 
        }
    }

    updateLive(entity) {
        if (!entity || !entity.mesh3D || this.isUpdatingFrom3D) return;
        
        this.isUpdatingFrom3D = true;
        const obj = entity.mesh3D;
        
        // Handle coordinates whether they come from active Konva groups or static JSON data
        const xPos = entity.group ? entity.group.x() : entity.x;
        const zPos = entity.group ? entity.group.y() : entity.y;
        
        obj.position.set(xPos, 0, zPos);
        obj.rotation.y = -(entity.rotation || 0) * (Math.PI / 180);
        
        const origSize = obj.userData.originalSize;
        obj.scale.set(
            entity.width / origSize.x, 
            entity.height / origSize.y, 
            entity.depth / origSize.z
        );
        
        obj.updateMatrixWorld();
        this.isUpdatingFrom3D = false;
    }
}
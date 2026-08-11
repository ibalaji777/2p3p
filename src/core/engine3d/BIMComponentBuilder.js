import * as THREE from 'three';
import { MaterialSlots } from '../constants/materialSlots.js';
import { ComponentRegistry } from './ComponentRegistry.js';

/**
 * Universal builder for assembling 3D BIM Components.
 * Handles unified mesh creation, hitboxes, shadows, and automatic ComponentRegistry tracking.
 */
export class BIMComponentBuilder {
    constructor(entity, helpers) {
        this.entity = entity;
        this.helpers = helpers;
        this.group = new THREE.Group();
        this.group.userData.entity = this.entity;
        this.group.userData.isComponentGroup = true;
        this.materialCache = {};
        this.meshes = [];
    }

    getMaterialForSlot(slot, isGlass) {
        if (this.materialCache[slot]) return this.materialCache[slot];

        let category = 'frame';
        if (isGlass || slot === MaterialSlots.GLASS) {
            category = 'glass';
        } else if (slot === MaterialSlots.HARDWARE) {
            category = 'hardware';
        } else if (slot === MaterialSlots.GRILLE) {
            category = 'grille';
        }

        const matInfo = (this.entity.materials && this.entity.materials[slot])
                        ? this.entity.materials[slot] 
                        : (this.entity.params?.materials && this.entity.params.materials[slot])
                            ? this.entity.params.materials[slot]
                            : null;
        
        const matKey = matInfo ? matInfo.id : null;
        
        let mat = this.helpers.getDynamicMaterial(matKey, category);
        
        if (!mat) {
            console.warn(`BIMComponentBuilder: Failed to resolve material for slot '${slot}' on entity ${this.entity.id}.`);
            mat = new THREE.MeshStandardMaterial({ color: 0xff00ff }); // Magenta error fallback
        }

        this.materialCache[slot] = mat;
        return mat;
    }

    /**
     * Adds a physical node (mesh) to the component assembly and returns the constructed THREE.Mesh.
     * @returns {THREE.Mesh}
     */
    addNode(config) {
        if (!config || !config.geometry) {
            console.warn(`BIMComponentBuilder: Node '${config.id}' missing geometry.`);
            return;
        }

        let material;
        if (config.isHitbox) {
            material = new THREE.MeshBasicMaterial({ visible: false });
        } else if (config.materialOverride) {
            material = config.materialOverride;
        } else {
            material = this.getMaterialForSlot(config.slot || MaterialSlots.CUSTOM, config.isGlass);
            if (config.geometry.type === 'ExtrudeGeometry' && Array.isArray(material)) {
                material = [material[4] || material[0], material[1] || material[0]];
            }
        }

        const mesh = new THREE.Mesh(config.geometry, material);
        
        const pos = config.position || [0,0,0];
        if (pos.isVector3) mesh.position.copy(pos);
        else if (Array.isArray(pos)) mesh.position.set(pos[0], pos[1], pos[2]);
        
        const rot = config.rotation || [0,0,0];
        if (rot.isEuler) mesh.rotation.copy(rot);
        else if (Array.isArray(rot)) mesh.rotation.set(rot[0], rot[1], rot[2]);
        
        if (!config.isHitbox) {
            mesh.castShadow = config.castShadow !== undefined ? config.castShadow : true;
            mesh.receiveShadow = config.receiveShadow !== undefined ? config.receiveShadow : true;
        }

        mesh.userData = {
            ...(config.userData || {}),
            entity: this.entity,
            materialSlot: config.slot || MaterialSlots.CUSTOM,
            componentId: `${this.entity.id}_${config.slot || MaterialSlots.CUSTOM}`,
            isHitbox: config.isHitbox || false,
            paintable: config.paintable !== undefined ? config.paintable : true
        };

        if (config.parent) {
            config.parent.add(mesh);
        } else {
            this.group.add(mesh);
        }

        if (!config.isHitbox) {
            this.meshes.push({ slot: config.slot || MaterialSlots.CUSTOM, mesh });
        }

        return mesh;
    }

    /**
     * Finalizes the assembly and registers all meshes to the ComponentRegistry.
     * @returns {THREE.Group}
     */
    build() {
        this.meshes.forEach(m => {
            ComponentRegistry.registerMesh(this.entity, m.slot, m.mesh, { componentId: `${this.entity.id}_${m.slot}` });
        });
        return this.group;
    }
}

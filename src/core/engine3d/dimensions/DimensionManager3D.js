import * as THREE from 'three';
import { MeasurementRenderer } from './MeasurementRenderer.js';
import { WallProvider } from './providers/WallProvider.js';
import { OpeningProvider } from './providers/OpeningProvider.js';
import { FurnitureProvider } from './providers/FurnitureProvider.js';
import { useSettingsStore } from '../../../stores/useSettingsStore.js';

export class DimensionManager3D {
    constructor(ctx) {
        this.ctx = ctx;
        this.renderers = new Map(); // id -> MeasurementRenderer
        this.group = new THREE.Group();
        this.group.name = 'DimensionsGroup';
        this.ctx.scene.add(this.group);
        
        this.activeProvider = null;
        this.activeEntity = null;
        this.activeMesh = null;
        
        this.raycaster = new THREE.Raycaster();
    }

    /**
     * Called when the selection changes.
     */
    onSelect(entity, mesh) {
        this.clear();
        this.activeEntity = entity;
        this.activeMesh = mesh;
        
        if (!entity || !mesh) return;

        const settings = useSettingsStore().floorPlanSettings;
        if (settings.show3DMeasurements === false) return;

        // Factory for providers
        if (entity.type === 'outer' || entity.type === 'inner' || entity.type === 'compound') {
            this.activeProvider = new WallProvider(entity, mesh);
        } else if (entity.type === 'door' || entity.type === 'window') {
            this.activeProvider = new OpeningProvider(entity, mesh);
        } else if (mesh.userData.isFurniture) {
            this.activeProvider = new FurnitureProvider(entity, mesh);
        }

        this.update();
    }

    /**
     * Called when selection is cleared.
     */
    onDeselect() {
        this.clear();
        this.activeEntity = null;
        this.activeMesh = null;
        this.activeProvider = null;
    }

    /**
     * Re-evaluates measurements and updates renderers.
     * Called on transform/geometry change.
     */
    update() {
        if (!this.activeProvider) return;
        
        const settings = useSettingsStore().floorPlanSettings;
        if (settings.show3DMeasurements === false) {
            this.clear();
            return;
        }

        const measurements = this.activeProvider.getMeasurements();
        
        // Track which renderers are needed this frame
        const neededIds = new Set(measurements.map(m => m.id));
        
        // Remove unused renderers
        for (const [id, renderer] of this.renderers.entries()) {
            if (!neededIds.has(id)) {
                renderer.dispose();
                this.group.remove(renderer);
                this.renderers.delete(id);
            }
        }
        
        // Update or create renderers
        for (const m of measurements) {
            let renderer = this.renderers.get(m.id);
            if (!renderer) {
                renderer = new MeasurementRenderer();
                this.renderers.set(m.id, renderer);
                this.group.add(renderer);
            }
            renderer.update(m.start, m.end, m.text, m.extStart1, m.extStart2);
        }
    }
    
    /**
     * Handles camera updates (resizing lines, occlusion).
     * Should be called from the animate loop or camera change event.
     */
    onCameraUpdate(camera, width, height) {
        if (this.renderers.size === 0) return;
        
        for (const renderer of this.renderers.values()) {
            renderer.updateResolution(width, height);
            
            // Basic occlusion test using raycaster
            const midPoint = renderer.label.position.clone();
            const camPos = camera.position.clone();
            const dir = new THREE.Vector3().subVectors(midPoint, camPos);
            const dist = dir.length();
            dir.normalize();
            
            this.raycaster.set(camPos, dir);
            // Raycast against structure groups
            const intersects = this.raycaster.intersectObjects(this.ctx.interactables, false);
            
            let occluded = false;
            for (const hit of intersects) {
                if (hit.distance < dist - 5 && hit.object !== this.activeMesh && !hit.object.userData.isOpeningHandle) {
                    occluded = true;
                    break;
                }
            }
            
            renderer.setHidden(occluded);
        }
    }

    clear() {
        for (const renderer of this.renderers.values()) {
            renderer.dispose();
            this.group.remove(renderer);
        }
        this.renderers.clear();
    }

    dispose() {
        this.clear();
        if (this.group.parent) this.group.parent.remove(this.group);
    }
}

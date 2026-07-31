import * as THREE from 'three';
import { MeasurementProvider } from './MeasurementProvider.js';
import { UnitConverter } from '../../../units/UnitConverter.js';
import { useSettingsStore } from '../../../../stores/useSettingsStore.js';

export class FurnitureProvider extends MeasurementProvider {
    getMeasurements() {
        if (!this.entity || !this.mesh.userData.isFurniture) return [];
        
        const settings = useSettingsStore().floorPlanSettings;
        const unit = settings.measurementUnit;
        const measurements = [];
        
        const w = this.entity.width || 100;
        const d = this.entity.depth || this.entity.height || 100; // In 2D, height is depth
        const h = this.entity.elevation || this.entity.zHeight || 100;
        
        this.mesh.updateMatrixWorld();
        
        // Base box dimensions
        const p1 = new THREE.Vector3(-w/2, 0, d/2).applyMatrix4(this.mesh.matrixWorld); // Front-left
        const p2 = new THREE.Vector3(w/2, 0, d/2).applyMatrix4(this.mesh.matrixWorld);  // Front-right
        const p3 = new THREE.Vector3(w/2, 0, -d/2).applyMatrix4(this.mesh.matrixWorld); // Back-right
        const p4 = new THREE.Vector3(-w/2, h, d/2).applyMatrix4(this.mesh.matrixWorld); // Top-left
        
        const rightDir = new THREE.Vector3().subVectors(p2, p1).normalize();
        const backDir = new THREE.Vector3().subVectors(p3, p2).normalize();
        const upDir = new THREE.Vector3(0, 1, 0); // Assuming furniture is upright
        
        // 1. Width (Front)
        measurements.push(this.createOffsetMeasurement(
            p1, 
            p2, 
            backDir.clone().negate(), // offset outwards towards front
            15, 
            UnitConverter.formatLabel(w, unit), 
            'furn-width'
        ));

        // 2. Depth (Right Side)
        measurements.push(this.createOffsetMeasurement(
            p2, 
            p3, 
            rightDir, // offset outwards towards right
            15, 
            UnitConverter.formatLabel(d, unit), 
            'furn-depth'
        ));

        // 3. Height (Front-left edge)
        measurements.push(this.createOffsetMeasurement(
            p1, 
            p4, 
            rightDir.clone().negate(), // offset left
            15, 
            UnitConverter.formatLabel(h, unit), 
            'furn-height'
        ));
        
        return measurements;
    }
}

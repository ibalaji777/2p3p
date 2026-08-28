import * as THREE from 'three';
import { MeasurementProvider } from './MeasurementProvider.js';
import { UnitConverter } from '../../../units/UnitConverter.js';
import { useSettingsStore } from '../../../../stores/useSettingsStore.js';

export class OpeningProvider extends MeasurementProvider {
    getMeasurements() {
        if (!this.entity || (this.entity.type !== 'door' && this.entity.type !== 'window')) return [];
        
        const settings = useSettingsStore().floorPlanSettings;
        const unit = settings.measurementUnit;
        const measurements = [];
        
        const w = this.entity.width || 100;
        const h = this.entity.height || (this.entity.type === 'door' ? 210 : 120);
        // Ensure full parent hierarchy world matrix is updated
        if (this.mesh.parent) {
            this.mesh.parent.updateWorldMatrix(true, true);
        }
        this.mesh.updateWorldMatrix(true, true);
        
        // Opening dimensions (Width and Height)
        const topLeft = new THREE.Vector3(-w/2, h, 0).applyMatrix4(this.mesh.matrixWorld);
        const topRight = new THREE.Vector3(w/2, h, 0).applyMatrix4(this.mesh.matrixWorld);
        const bottomLeft = new THREE.Vector3(-w/2, 0, 0).applyMatrix4(this.mesh.matrixWorld);
        const bottomRight = new THREE.Vector3(w/2, 0, 0).applyMatrix4(this.mesh.matrixWorld);
        
        const upDir = new THREE.Vector3(0, 1, 0);
        const rightDir = new THREE.Vector3().subVectors(topRight, topLeft).normalize();

        // 1. Width (Top)
        measurements.push(this.createOffsetMeasurement(
            topLeft, 
            topRight, 
            upDir, 
            15, 
            UnitConverter.formatLabel(w, unit), 
            'opening-width'
        ));

        // 2. Height (Side)
        measurements.push(this.createOffsetMeasurement(
            bottomRight, 
            topRight, 
            rightDir, 
            15, 
            UnitConverter.formatLabel(h, unit), 
            'opening-height'
        ));

        // 3. Elevation (Sill height) if > 0
        if (elev > 0) {
            const floorPos = new THREE.Vector3(w/2, -elev, 0).applyMatrix4(this.mesh.matrixWorld);
            measurements.push(this.createOffsetMeasurement(
                floorPos, 
                bottomRight, 
                rightDir, 
                15, 
                UnitConverter.formatLabel(elev, unit), 
                'opening-elev'
            ));
        }
        
        return measurements;
    }
}

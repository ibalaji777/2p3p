import * as THREE from 'three';
import { MeasurementProvider } from './MeasurementProvider.js';
import { UnitConverter } from '../../../units/UnitConverter.js';
import { useSettingsStore } from '../../../../stores/useSettingsStore.js';
import { WALL_HEIGHT } from '../../../registry.js';

export class WallProvider extends MeasurementProvider {
    getMeasurements() {
        if (!this.entity || this.entity.type !== 'outer' && this.entity.type !== 'inner') return [];
        
        const settings = useSettingsStore().floorPlanSettings;
        const unit = settings.measurementUnit;
        const measurements = [];
        
        const p1 = this.entity.startAnchor ? this.entity.startAnchor.position() : { x: this.entity.startX, y: this.entity.startY };
        const p2 = this.entity.endAnchor ? this.entity.endAnchor.position() : { x: this.entity.endX, y: this.entity.endY };
        const h = this.entity.height !== undefined ? this.entity.height : (this.entity.config?.height || WALL_HEIGHT);
        
        const baseStart = new THREE.Vector3(p1.x, 0, p1.y);
        const baseEnd = new THREE.Vector3(p2.x, 0, p2.y);
        
        const dir = new THREE.Vector3().subVectors(baseEnd, baseStart).normalize();
        const normal = new THREE.Vector3(-dir.z, 0, dir.x); // Perpendicular outward
        const offsetDist = 30; // 30cm offset for dimension lines

        // 1. Length (Top edge)
        const topStart = new THREE.Vector3(p1.x, h, p1.y);
        const topEnd = new THREE.Vector3(p2.x, h, p2.y);
        measurements.push(this.createOffsetMeasurement(
            topStart, 
            topEnd, 
            new THREE.Vector3(0, 1, 0), // offset upwards
            15, 
            UnitConverter.formatLabel(this.entity.length3D || baseStart.distanceTo(baseEnd), unit), 
            'wall-length'
        ));

        // 2. Height (Side edge)
        measurements.push(this.createOffsetMeasurement(
            baseStart, 
            topStart, 
            dir.clone().negate(), // offset outwards from start
            15, 
            UnitConverter.formatLabel(h, unit), 
            'wall-height'
        ));
        
        return measurements;
    }
}

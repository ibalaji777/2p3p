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
        
        const length = this.entity.length3D || Math.hypot(p2.x - p1.x, p2.y - p1.y);
        
        if (this.mesh) this.mesh.updateMatrixWorld();
        
        // Wall meshes are built locally along the positive X-axis
        const baseStart = new THREE.Vector3(0, 0, 0);
        const baseEnd = new THREE.Vector3(length, 0, 0);
        if (this.mesh) {
            baseStart.applyMatrix4(this.mesh.matrixWorld);
            baseEnd.applyMatrix4(this.mesh.matrixWorld);
        }
        
        const dir = new THREE.Vector3().subVectors(baseEnd, baseStart).normalize();
        const normal = new THREE.Vector3(-dir.z, 0, dir.x); // Perpendicular outward
        const offsetDist = 30; // 30cm offset for dimension lines

        // 1. Length (Top edge)
        const topStart = new THREE.Vector3(0, h, 0);
        const topEnd = new THREE.Vector3(length, h, 0);
        if (this.mesh) {
            topStart.applyMatrix4(this.mesh.matrixWorld);
            topEnd.applyMatrix4(this.mesh.matrixWorld);
        }
        measurements.push(this.createOffsetMeasurement(
            topStart, 
            topEnd, 
            new THREE.Vector3(0, 1, 0), // offset upwards
            15, 
            UnitConverter.formatLabel(length, unit), 
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

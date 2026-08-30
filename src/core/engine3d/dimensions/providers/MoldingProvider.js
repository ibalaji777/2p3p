import * as THREE from 'three';
import { MeasurementProvider } from './MeasurementProvider.js';
import { UnitConverter } from '../../../units/UnitConverter.js';
import { useSettingsStore } from '../../../../stores/useSettingsStore.js';

export class MoldingProvider extends MeasurementProvider {
    getMeasurements() {
        if (!this.entity) return [];

        const settings = useSettingsStore().floorPlanSettings;
        const unit = settings.measurementUnit;
        const measurements = [];

        const w = this.entity.width || this.entity.length || (this.entity.wall ? (this.entity.wall.length3D || (typeof this.entity.wall.getLength === 'function' ? this.entity.wall.getLength() : 100)) : 100);
        const h = this.entity.moldingHeight || this.entity.height || 12;
        const elev = this.entity.heightOffset || this.entity.elevation || 0;

        if (this.mesh.parent) {
            this.mesh.parent.updateWorldMatrix(true, true);
        }
        this.mesh.updateWorldMatrix(true, true);

        // Bounding dimensions along the wall
        const startBottom = new THREE.Vector3(0, 0, 0).applyMatrix4(this.mesh.matrixWorld);
        const endBottom = new THREE.Vector3(w, 0, 0).applyMatrix4(this.mesh.matrixWorld);
        const startTop = new THREE.Vector3(0, h, 0).applyMatrix4(this.mesh.matrixWorld);
        const endTop = new THREE.Vector3(w, h, 0).applyMatrix4(this.mesh.matrixWorld);

        const upDir = new THREE.Vector3(0, 1, 0);
        const dir = new THREE.Vector3().subVectors(endBottom, startBottom).normalize();

        // 1. Length (Top edge)
        measurements.push(this.createOffsetMeasurement(
            startTop,
            endTop,
            upDir,
            12,
            UnitConverter.formatLabel(w, unit),
            'molding-length'
        ));

        // 2. Profile Height (Vertical)
        measurements.push(this.createOffsetMeasurement(
            endBottom,
            endTop,
            dir,
            12,
            UnitConverter.formatLabel(h, unit),
            'molding-height'
        ));

        // 3. Elevation from floor if > 0 (e.g. Crown molding, chair rail)
        if (elev > 0) {
            const floorPt = new THREE.Vector3(0, -elev, 0).applyMatrix4(this.mesh.matrixWorld);
            measurements.push(this.createOffsetMeasurement(
                floorPt,
                startBottom,
                dir.clone().negate(),
                12,
                UnitConverter.formatLabel(elev, unit),
                'molding-elev'
            ));
        }

        return measurements;
    }
}

import * as THREE from 'three';
import { MeasurementProvider } from './MeasurementProvider.js';
import { UnitConverter } from '../../../units/UnitConverter.js';
import { useSettingsStore } from '../../../../stores/useSettingsStore.js';

export class WidgetProvider extends MeasurementProvider {
    getMeasurements() {
        if (!this.entity) return [];

        const settings = useSettingsStore().floorPlanSettings;
        const unit = settings.measurementUnit;
        const measurements = [];

        const type = this.entity.type || this.entity.configId || '';
        const w = this.entity.width || 100;
        const h = this.entity.height || (type === 'sunshade' ? 15 : 100);
        const d = this.entity.depth || this.entity.thick || (type === 'sunshade' ? 45 : 10);
        const elev = this.entity.elevation || 0;

        if (this.mesh.parent) {
            this.mesh.parent.updateWorldMatrix(true, true);
        }
        this.mesh.updateWorldMatrix(true, true);

        // Dimensions of the widget
        const topLeft = new THREE.Vector3(-w / 2, h, 0).applyMatrix4(this.mesh.matrixWorld);
        const topRight = new THREE.Vector3(w / 2, h, 0).applyMatrix4(this.mesh.matrixWorld);
        const bottomRight = new THREE.Vector3(w / 2, 0, 0).applyMatrix4(this.mesh.matrixWorld);
        const frontRight = new THREE.Vector3(w / 2, 0, d).applyMatrix4(this.mesh.matrixWorld);

        const upDir = new THREE.Vector3(0, 1, 0);
        const rightDir = new THREE.Vector3().subVectors(topRight, topLeft).normalize();

        // 1. Width (Top)
        measurements.push(this.createOffsetMeasurement(
            topLeft,
            topRight,
            upDir,
            15,
            UnitConverter.formatLabel(w, unit),
            'widget-width'
        ));

        // 2. Height / Thickness (Side)
        measurements.push(this.createOffsetMeasurement(
            bottomRight,
            topRight,
            rightDir,
            15,
            UnitConverter.formatLabel(h, unit),
            'widget-height'
        ));

        // 3. Depth / Projection from wall (for sunshades, fascias, etc.)
        if (d > 0 && Math.abs(d) >= 1) {
            measurements.push(this.createOffsetMeasurement(
                bottomRight,
                frontRight,
                upDir.clone().negate(),
                12,
                UnitConverter.formatLabel(d, unit),
                'widget-depth'
            ));
        }

        // 4. Elevation from floor if > 0
        if (elev > 0) {
            const floorPos = new THREE.Vector3(w / 2, -elev, 0).applyMatrix4(this.mesh.matrixWorld);
            measurements.push(this.createOffsetMeasurement(
                floorPos,
                bottomRight,
                rightDir,
                15,
                UnitConverter.formatLabel(elev, unit),
                'widget-elev'
            ));
        }

        return measurements;
    }
}

import * as THREE from 'three';

export class MeasurementProvider {
    /**
     * @param {Object} entity The selected entity
     * @param {THREE.Object3D} mesh The corresponding 3D mesh
     */
    constructor(entity, mesh) {
        this.entity = entity;
        this.mesh = mesh;
    }

    /**
     * Calculates and returns an array of measurements to display.
     * @returns {Array<{
     *   id: string,
     *   start: THREE.Vector3,
     *   end: THREE.Vector3,
     *   text: string,
     *   extStart1: THREE.Vector3|null,
     *   extStart2: THREE.Vector3|null
     * }>}
     */
    getMeasurements() {
        return [];
    }

    /**
     * Helper to offset points away from the object to create extension lines.
     */
    createOffsetMeasurement(p1, p2, normalDir, offsetDist, text, id) {
        const p1Offset = p1.clone().add(normalDir.clone().multiplyScalar(offsetDist));
        const p2Offset = p2.clone().add(normalDir.clone().multiplyScalar(offsetDist));
        return {
            id,
            start: p1Offset,
            end: p2Offset,
            text,
            extStart1: p1,
            extStart2: p2
        };
    }
}

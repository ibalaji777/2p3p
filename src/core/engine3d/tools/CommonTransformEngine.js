/**
 * CommonTransformEngine.js
 * Centralized Transformation Engine for 3D Scene Interactions.
 * 
 * Executes Move, Spin, Tilt, and Axis Up/Down operations across all object types
 * respecting their capabilities and constraints.
 */

import * as THREE from 'three';
import { ObjectCapabilityEvaluator } from './ObjectCapabilityEvaluator.js';
import { coreEventBus } from '../../EventBus.js';
import { usePlannerStore } from '../../../stores/usePlannerStore.js';

/**
 * Helper to compute local geometric center of any 3D object/group in its own local coordinate space.
 */
export function getObjectLocalCenter(obj) {
    if (!obj) return new THREE.Vector3(0, 0, 0);
    const localBox = new THREE.Box3();
    obj.updateMatrixWorld(true);
    const invMat = obj.matrixWorld.clone().invert();

    obj.traverse(child => {
        if (child.isMesh && child.geometry && !child.userData?.isGizmoNonInteractive && !child.userData?.isHitbox) {
            const geo = child.geometry;
            if (!geo.boundingBox) geo.computeBoundingBox();
            if (geo.boundingBox) {
                child.updateMatrixWorld(true);
                const toLocal = invMat.clone().multiply(child.matrixWorld);
                const childBox = geo.boundingBox.clone().applyMatrix4(toLocal);
                localBox.union(childBox);
            }
        }
    });

    const localCenter = new THREE.Vector3();
    if (!localBox.isEmpty() && isFinite(localBox.min.x)) {
        localBox.getCenter(localCenter);
    } else {
        const ent = obj.userData?.entity;
        if (ent && (ent.type?.includes('stair') || ent.flight1Steps || ent.stepCount)) {
            const steps = ent.totalSteps || ent.stepCount || ent.flight1Steps || 15;
            const depth = ent.stepDepth || 18.33;
            localCenter.set(0, (ent.height || 150) / 2, (steps * depth) / 2);
        }
    }
    return localCenter;
}

export class CommonTransformEngine {
    constructor(ctx) {
        this.ctx = ctx;
    }

    /**
     * Executes translation/movement on an entity.
     * @param {Object} entity
     * @param {THREE.Vector3|Object} deltaPos
     * @param {Object} options
     */
    executeMove(entity, deltaPos, options = {}) {
        if (!entity) return false;
        const caps = ObjectCapabilityEvaluator.getCapabilities(entity);
        if (!caps.movable) return false;

        const obj = entity.mesh3D;

        // 1. Wall-Anchored Openings & Plugins (Doors, Windows, Sunshades, Jali, Curtains)
        if (entity.wall && (entity.t !== undefined || entity.wall.length3D)) {
            const wall = entity.wall;
            const wallLength = wall.length3D || 100;
            const deltaLocalX = deltaPos.x || 0;
            const currentLocalX = (entity.t || 0.5) * wallLength;
            const newLocalX = Math.max(5, Math.min(wallLength - 5, currentLocalX + deltaLocalX));
            entity.t = newLocalX / wallLength;

            if (deltaPos.y !== undefined && deltaPos.y !== 0) {
                const currentElev = entity.elevation || 0;
                const wallH = wall.height || wall.config?.height || 300;
                const opH = entity.height || 80;
                entity.elevation = Math.max(0, Math.min(wallH - opH, currentElev + deltaPos.y));
            }

            if (this.ctx.realtimeUpdate) {
                this.ctx.realtimeUpdate.markDirty(entity, 'geometry');
            }
        }
        // 2. Free Objects (Furniture, Stairs, Shapes, Roofs)
        else {
            const newX = (entity.x !== undefined ? entity.x : (obj ? obj.position.x : 0)) + (deltaPos.x || 0);
            const newZ = (entity.y !== undefined ? entity.y : (obj ? obj.position.z : 0)) + (deltaPos.z || deltaPos.y || 0);

            entity.x = newX;
            entity.y = newZ;

            if (entity.group && typeof entity.group.x === 'function') {
                entity.group.x(newX);
                entity.group.y(newZ);
            }
            if (obj) {
                obj.position.x = newX;
                obj.position.z = newZ;
            }

            if (this.ctx.realtimeUpdate) {
                this.ctx.realtimeUpdate.markDirty(entity, 'transform');
            }
        }

        this.notifyTransformChanged(entity);
        return true;
    }

    /**
     * Executes vertical Y-axis rotation (Spin / Yaw) strictly around the geometric center.
     * @param {Object} entity
     * @param {number} deltaDeg - Angle delta in degrees.
     * @param {number|null} absoluteDeg - Optional absolute angle in degrees.
     */
    executeSpin(entity, deltaDeg = 0, absoluteDeg = null) {
        if (!entity) return false;
        const caps = ObjectCapabilityEvaluator.getCapabilities(entity);
        if (!caps.rotatable) return false;

        const currentRot = entity.rotation !== undefined ? entity.rotation : 0;
        let newAngle = absoluteDeg !== null ? absoluteDeg : (currentRot + deltaDeg);
        newAngle = ((Math.round(newAngle) % 360) + 360) % 360;

        const mesh = entity.mesh3D;
        if (mesh) {
            const localCenter = getObjectLocalCenter(mesh);
            const currentRotY = -(currentRot * Math.PI / 180);

            const currentX = entity.x !== undefined ? entity.x : mesh.position.x;
            const currentY = entity.elevation !== undefined ? entity.elevation : mesh.position.y;
            const currentZ = entity.y !== undefined ? entity.y : mesh.position.z;

            // 1. Calculate Fixed World Center using Three.js Vector applyAxisAngle
            const currentRotOffset = localCenter.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), currentRotY);
            const worldCenter = new THREE.Vector3(currentX, currentY, currentZ).add(currentRotOffset);

            // 2. Calculate New Position such that World Center remains 100% stationary
            const newRotY = -(newAngle * Math.PI / 180);
            const newRotOffset = localCenter.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), newRotY);
            const newPos = worldCenter.clone().sub(newRotOffset);

            entity.x = Math.round(newPos.x * 10) / 10;
            entity.y = Math.round(newPos.z * 10) / 10;

            mesh.position.x = entity.x;
            mesh.position.z = entity.y;
            mesh.rotation.y = newRotY;

            if (entity.group && typeof entity.group.x === 'function') {
                entity.group.x(entity.x);
                entity.group.y(entity.y);
            }
        }

        entity.rotation = newAngle;

        // 2. Roof Rotation & Ridge Axis
        if (entity.type === 'roof' || entity.config?.roofType) {
            const conf = entity.config || entity;
            conf.rotation = newAngle;
            if (entity.group && typeof entity.group.rotation === 'function') {
                entity.group.rotation(newAngle);
            }
            if (this.ctx.envBuilder?.updateRoofLive) {
                this.ctx.envBuilder.updateRoofLive(entity);
            }
            if (this.ctx.interactions?.roofPitchGizmo) {
                this.ctx.interactions.roofPitchGizmo.updateHandlePositions();
            }
        }
        // 3. Standard 3D Object
        else {
            if (entity.group && typeof entity.group.rotation === 'function') {
                entity.group.rotation(newAngle);
            }
            if (typeof entity.update2D === 'function') {
                entity.update2D();
            }
            if (this.ctx.realtimeUpdate) {
                this.ctx.realtimeUpdate.markDirty(entity, 'transform');
            }
        }

        // 4. Two-way synchronization with UniversalSpinGizmo & HUD
        if (this.ctx.interactions?.universalSpinGizmo && this.ctx.interactions.universalSpinGizmo.visible) {
            this.ctx.interactions.universalSpinGizmo.currentRotation = newAngle;
            this.ctx.interactions.universalSpinGizmo._updateHeadingArrowRotation(newAngle);
            this.ctx.interactions.universalSpinGizmo.syncHUD();
        }

        this.notifyTransformChanged(entity);
        return true;
    }

    /**
     * Executes horizontal X-axis rotation (Tilt / Pitch).
     * @param {Object} entity
     * @param {number} deltaDeg - Tilt delta in degrees.
     */
    executeTilt(entity, deltaDeg = 0) {
        if (!entity) return false;
        const caps = ObjectCapabilityEvaluator.getCapabilities(entity);
        if (!caps.tiltable) return false;

        const currentTilt = entity.tilt || entity.pitch || 0;
        let newTilt = currentTilt + deltaDeg;
        newTilt = Math.max(-85, Math.min(85, newTilt)); // Clamp tilt safely

        entity.tilt = newTilt;
        if (entity.mesh3D) {
            entity.mesh3D.rotation.x = (newTilt * Math.PI / 180);
        }

        if (this.ctx.realtimeUpdate) {
            this.ctx.realtimeUpdate.markDirty(entity, 'transform');
        }

        this.notifyTransformChanged(entity);
        return true;
    }

    /**
     * Steps elevation up or down.
     * @param {Object} entity
     * @param {number} direction - +1 for up, -1 for down.
     * @param {number} step - Step distance in units (default 10).
     */
    executeAxisStep(entity, direction = 1, step = 10) {
        if (!entity) return false;
        const caps = ObjectCapabilityEvaluator.getCapabilities(entity);
        if (!caps.elevatable) return false;

        const currentElev = entity.elevation || 0;
        const newElev = Math.max(0, currentElev + (direction * step));

        entity.elevation = newElev;

        if (entity.mesh3D) {
            entity.mesh3D.position.y = newElev;
        }

        if (entity.wall && this.ctx.realtimeUpdate) {
            this.ctx.realtimeUpdate.markDirty(entity, 'geometry');
        } else if (this.ctx.realtimeUpdate) {
            this.ctx.realtimeUpdate.markDirty(entity, 'transform');
        }

        console.info(`%c[CommonTransformEngine] %cElevation updated for %c${entity.type || 'Object'}: %c${newElev} (Δ: ${direction * step})`,
            'color: #3b82f6; font-weight: bold;', 'color: #9ca3af;', 'color: #10b981; font-weight: bold;', 'color: #f59e0b;');

        this.notifyTransformChanged(entity);
        return true;
    }

    /**
     * Notifies all listeners of transformation changes.
     * @param {Object} entity
     */
    notifyTransformChanged(entity) {
        if (this.ctx.syncToUI) this.ctx.syncToUI();
        if (this.ctx.requestRender) this.ctx.requestRender('transform_changed');

        const entId = entity.id || (entity.group && typeof entity.group.id === 'function' ? entity.group.id() : null);
        if (entId) {
            coreEventBus.emit('EntityTransformUpdated3D', {
                entity: entId,
                x: entity.x,
                y: entity.y,
                elevation: entity.elevation || 0,
                rotation: entity.rotation || 0
            });

            try {
                const store = usePlannerStore();
                store.updateEntityTransform(entId, entity.x, entity.y, entity.rotation, entity.elevation);
            } catch (e) {}
        }

        if (window.plannerInstance && window.plannerInstance.syncAll) {
            window.plannerInstance.syncAll();
        }
    }
}

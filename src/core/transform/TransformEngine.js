/**
 * TransformEngine.js
 * 
 * UNIVERSAL CENTRALIZED TRANSFORMATION ENGINE FOR 2D/3D & ALL DEVICES.
 * 
 * The single authoritative authority for Translation (Move) and Rotation (Spin/Yaw).
 * Guarantees:
 * 1. Single atomic TransformCommand per user interaction (zero Double Undo bugs).
 * 2. Unified Center-Pivot Mathematics across 2D Canvas and 3D Viewport.
 * 3. Consistent Angle Snapping (15°, 45°, 90°, magnetic latching).
 * 4. Full integration with CommandManager, SpatialDependencyEngine, WallEngine, StairEngine, and RoofEngine.
 */

import * as THREE from 'three';
import { coreEventBus } from '../EventBus.js';
import { TransformCommand } from '../commands/TransformCommand.js';
import { globalSpatialDependencyEngine, RELATIONSHIP_TYPES } from '../spatial/SpatialDependencyEngine.js';
import { SpatialHostResolver } from '../spatial/SpatialHostResolver.js';
import { WallEngine } from '../wall/WallEngine.js';
import { StairEngine } from '../stairs/StairEngine.js';
import { RoofEngine } from '../roof/RoofEngine.js';
import { StairHeightDetector } from '../../features/stairs/StairHeightDetector.js';
import { SnapEngine } from '../snap/SnapEngine.js';

/**
 * Computes the 3D local bounding box center of any object/mesh in its own local coordinate frame.
 * @param {THREE.Object3D|Object} obj 
 * @returns {THREE.Vector3}
 */
export function getObjectLocalCenter(obj) {
    if (!obj) return new THREE.Vector3(0, 0, 0);

    const mesh = obj.isObject3D ? obj : (obj.mesh3D || null);
    if (mesh && typeof THREE !== 'undefined') {
        const localBox = new THREE.Box3();
        if (typeof mesh.updateMatrixWorld === 'function') mesh.updateMatrixWorld(true);
        const invMat = mesh.matrixWorld ? mesh.matrixWorld.clone().invert() : new THREE.Matrix4();

        let hasGeometry = false;
        if (typeof mesh.traverse === 'function') {
            mesh.traverse(child => {
                if (child.isMesh && child.geometry && !child.userData?.isGizmoNonInteractive && !child.userData?.isHitbox) {
                    const geo = child.geometry;
                    if (!geo.boundingBox) geo.computeBoundingBox();
                    if (geo.boundingBox) {
                        if (typeof child.updateMatrixWorld === 'function') child.updateMatrixWorld(true);
                        const toLocal = invMat.clone().multiply(child.matrixWorld);
                        const childBox = geo.boundingBox.clone().applyMatrix4(toLocal);
                        localBox.union(childBox);
                        hasGeometry = true;
                    }
                }
            });
        }

        const localCenter = new THREE.Vector3();
        if (hasGeometry && !localBox.isEmpty() && isFinite(localBox.min.x)) {
            localBox.getCenter(localCenter);
            return localCenter;
        }
    }

    // Fallback based on entity dimensions
    const ent = obj.userData?.entity || obj;
    const w = Number(ent.width) || 100;
    const d = Number(ent.depth || ent.length) || 100;
    const h = Number(ent.height) || 100;
    return new THREE.Vector3(0, h / 2, 0);
}

export class TransformEngine {
    /** Active interactive transformation session */
    static _session = null;

    // ==========================================
    // 1. ENTITY RESOLUTION & CAPABILITIES
    // ==========================================

    /**
     * Resolves canonical entity instance from planner by ID or reference.
     * @param {Object} planner 
     * @param {Object|string|number} entityOrId 
     * @returns {Object|null}
     */
    static findEntity(planner, entityOrId) {
        if (!planner) return (typeof entityOrId === 'object' && entityOrId !== null) ? entityOrId : null;
        if (typeof entityOrId === 'object' && entityOrId !== null) return entityOrId;

        const id = entityOrId;
        if (typeof planner.getEntities === 'function') {
            const ent = planner.getEntities().find(e => e && (e.id === id || (e.group && typeof e.group.id === 'function' && e.group.id() === id)));
            if (ent) return ent;
        }

        // Secondary searches across domain collections
        const collections = [
            planner.furniture,
            planner.stairs,
            planner.platforms,
            planner.shapes,
            planner.roofs,
            planner.rooms,
            planner.walls
        ];

        for (const list of collections) {
            if (Array.isArray(list)) {
                const found = list.find(e => e && (e.id === id || (e.group && typeof e.group.id === 'function' && e.group.id() === id)));
                if (found) return found;
            }
        }

        // Search wall attached items
        if (Array.isArray(planner.walls)) {
            for (const w of planner.walls) {
                const attached = [
                    ...(w.attachedWidgets || []),
                    ...(w.attachedDecor || []),
                    ...(w.attachedMoldings || []),
                    ...(w.openings || [])
                ];
                const found = attached.find(a => a && a.id === id);
                if (found) return found;
            }
        }

        return null;
    }

    // ==========================================
    // 2. MATHEMATICS & SNAPPING AUTHORITY
    // ==========================================

    /**
     * Snaps a raw angle in degrees based on CAD constraints.
     * Delegates to centralized SnapEngine authority.
     * 
     * @param {number} rawAngleDeg 
     * @param {Object} [options={}]
     * @returns {{ angle: number, isSnapped: boolean }}
     */
    static snapAngle(rawAngleDeg, options = {}) {
        return SnapEngine.resolveAngle(rawAngleDeg, options);
    }

    /**
     * Calculates new position (x, y) such that the object's world center remains 100% stationary
     * when rotating around its geometric centroid.
     * 
     * @param {Object} entity 
     * @param {number} newAngleDeg 
     * @param {THREE.Vector3} [fixedWorldCenter=null] 
     * @param {THREE.Vector3} [localCenter=null] 
     * @returns {{ x: number, y: number }}
     */
    static computeCenterCompensatedPosition(entity, newAngleDeg, fixedWorldCenter = null, localCenter = null) {
        const mesh = entity.mesh3D;
        const currentRot = Number(entity.rotation) || 0;
        const curX = entity.x !== undefined ? entity.x : (mesh ? mesh.position.x : 0);
        const curElev = Number(entity.elevation) || (mesh ? mesh.position.y : 0);
        const curY = entity.y !== undefined ? entity.y : (mesh ? mesh.position.z : 0);

        const lCenter = localCenter || getObjectLocalCenter(mesh || entity);

        // 1. Calculate Fixed World Center if not provided
        let worldCenter = fixedWorldCenter;
        if (!worldCenter) {
            const currentRotY = -(currentRot * Math.PI / 180);
            const currentRotOffset = lCenter.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), currentRotY);
            worldCenter = new THREE.Vector3(curX, curElev, curY).add(currentRotOffset);
        }

        // 2. Calculate New Position such that World Center remains stationary
        const newRotY = -(newAngleDeg * Math.PI / 180);
        const newRotOffset = lCenter.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), newRotY);
        const newPos = worldCenter.clone().sub(newRotOffset);

        return {
            x: Math.round(newPos.x * 10) / 10,
            y: Math.round(newPos.z * 10) / 10
        };
    }

    // ==========================================
    // 3. INTERACTIVE SESSION LIFECYCLE (60 FPS)
    // ==========================================

    /**
     * Starts an interactive transformation drag session (mouse / touch / gizmo).
     * @param {Object} entity 
     * @param {'move'|'spin'|'tilt'|'openings'} operation 
     * @param {Object} [initialCoords={}]
     */
    static startSession(entity, operation = 'move', initialCoords = {}) {
        if (!entity) return;

        const mesh = entity.mesh3D;
        const curX = entity.x !== undefined ? entity.x : (mesh ? mesh.position.x : (entity.group?.x?.() || 0));
        const curY = entity.y !== undefined ? entity.y : (mesh ? mesh.position.z : (entity.group?.y?.() || 0));
        const curElev = Number(entity.elevation) || (mesh ? mesh.position.y : 0);
        const curRot = Number(entity.rotation) || 0;
        const curTilt = Number(entity.tilt || entity.pitch) || 0;
        const curT = entity.t !== undefined ? entity.t : null;

        const localCenter = getObjectLocalCenter(mesh || entity);
        const currentRotY = -(curRot * Math.PI / 180);
        const currentRotOffset = localCenter.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), currentRotY);
        const worldCenter = new THREE.Vector3(curX, curElev, curY).add(currentRotOffset);

        this._session = {
            entity,
            entityId: entity.id || (entity.group && typeof entity.group.id === 'function' ? entity.group.id() : null),
            entityType: entity.type || entity.constructor?.name || '',
            operation,
            initialState: {
                x: curX,
                y: curY,
                elevation: curElev,
                rotation: curRot,
                tilt: curTilt,
                t: curT,
                points: Array.isArray(entity.points) ? JSON.parse(JSON.stringify(entity.points)) : null
            },
            initialCoords: { ...initialCoords },
            currentState: {
                x: curX,
                y: curY,
                elevation: curElev,
                rotation: curRot,
                tilt: curTilt,
                t: curT,
                points: Array.isArray(entity.points) ? JSON.parse(JSON.stringify(entity.points)) : null
            },
            localCenter,
            worldCenter
        };
    }

    /**
     * Checks if a transformation session is currently active.
     * @returns {boolean}
     */
    static isSessionActive() {
        return Boolean(this._session);
    }

    /**
     * Retrieves the current session object.
     * @returns {Object|null}
     */
    static getSession() {
        return this._session;
    }

    /**
     * Updates transient preview during translation drag (60 FPS, no command created).
     * @param {Object} entity 
     * @param {{ x?: number, y?: number, z?: number }} delta - Coordinate deltas.
     * @param {Object} [options={}]
     */
    static previewMove(entity, delta = {}, options = {}) {
        if (!entity || !this._session) return;
        const s = this._session;

        // 1. Wall-Mounted Opening / Plugin (t along host wall)
        if (delta.absoluteT !== undefined || delta.t !== undefined) {
            const rawT = delta.absoluteT !== undefined ? delta.absoluteT : delta.t;
            const newT = Math.max(0.01, Math.min(0.99, rawT));
            entity.t = newT;
            s.currentState.t = newT;
            if (typeof entity.update2D === 'function') entity.update2D();
            else if (typeof entity.update === 'function') entity.update();
            if (options.realtimeUpdate) options.realtimeUpdate.markDirty(entity, 'geometry');
            return;
        }

        if (entity.wall && (entity.t !== undefined || entity.wall.length3D || entity.wall.getLength)) {
            const wall = entity.wall;
            const wallLength = wall.length3D || (typeof wall.getLength === 'function' ? wall.getLength() : 100);
            const startT = s.initialState.t !== null ? s.initialState.t : 0.5;
            const startLocalX = startT * wallLength;

            // Fix 1: Projected longitudinal delta along wall baseline
            let deltaAlongWall = delta.alongWall;
            if (deltaAlongWall === undefined) {
                if (delta.z !== undefined && delta.x !== undefined) {
                    const p1 = wall.startAnchor ? (typeof wall.startAnchor.position === 'function' ? wall.startAnchor.position() : wall.startAnchor) : { x: wall.startX || 0, y: wall.startY || 0 };
                    const p2 = wall.endAnchor ? (typeof wall.endAnchor.position === 'function' ? wall.endAnchor.position() : wall.endAnchor) : { x: wall.endX || 0, y: wall.endY || 0 };
                    const dxW = p2.x - p1.x;
                    const dyW = p2.y - p1.y;
                    const len = Math.hypot(dxW, dyW);
                    if (len > 0.001) {
                        deltaAlongWall = delta.x * (dxW / len) + delta.z * (dyW / len);
                    }
                }
            }
            if (deltaAlongWall === undefined) {
                deltaAlongWall = delta.x || 0;
            }

            const newLocalX = Math.max(5, Math.min(wallLength - 5, startLocalX + deltaAlongWall));
            const newT = newLocalX / wallLength;

            entity.t = newT;
            s.currentState.t = newT;

            // Fix 10: Elevation clamping with sloped/gable top profiles support
            if (delta.y !== undefined && delta.y !== 0 && entity.elevation !== undefined) {
                let wallH = wall.height || wall.config?.height || 300;
                if (wall.topProfileType === 'single') {
                    const sH = Number(wall.startHeight) || wallH;
                    const eH = Number(wall.endHeight) || wallH;
                    wallH = sH + newT * (eH - sH);
                } else if (wall.topProfileType === 'gable') {
                    const sH = Number(wall.startHeight) || wallH;
                    const eH = Number(wall.endHeight) || wallH;
                    const pH = Number(wall.peakHeight) || wallH;
                    wallH = newT <= 0.5 ? (sH + 2 * newT * (pH - sH)) : (pH + 2 * (newT - 0.5) * (eH - pH));
                }
                const opH = entity.height || 80;
                const startElev = s.initialState.elevation || 0;
                entity.elevation = Math.max(0, Math.min(wallH - opH, startElev + delta.y));
                s.currentState.elevation = entity.elevation;
            }

            if (typeof entity.update2D === 'function') entity.update2D();
            else if (typeof entity.update === 'function') entity.update();

            if (options.realtimeUpdate) {
                options.realtimeUpdate.markDirty(entity, 'geometry');
            }
            return;
        }

        // Polygon Points (Roofs, Custom Polygons)
        if (delta.points && Array.isArray(delta.points)) {
            s.currentState.points = JSON.parse(JSON.stringify(delta.points));
            entity.points = JSON.parse(JSON.stringify(delta.points));
            if (typeof entity.update2D === 'function') entity.update2D();
            else if (typeof entity.update === 'function') entity.update();
            return;
        }

        // 2. Free Planar Entities (Furniture, Stairs, Platforms, Shapes, Roofs)
        const dx = delta.x || 0;
        const dy = delta.z !== undefined ? delta.z : (delta.y || 0);
        const dElev = delta.y !== undefined && delta.z !== undefined ? delta.y : 0;
        const isExplicitElev = (dElev !== 0 || delta.absoluteElevation !== undefined);

        const newX = delta.absoluteX !== undefined ? Math.round(delta.absoluteX * 10) / 10 : Math.round((s.initialState.x + dx) * 10) / 10;
        const newY = delta.absoluteY !== undefined ? Math.round(delta.absoluteY * 10) / 10 : Math.round((s.initialState.y + dy) * 10) / 10;
        const newElev = delta.absoluteElevation !== undefined ? Math.round(delta.absoluteElevation * 10) / 10 : Math.round((s.initialState.elevation + dElev) * 10) / 10;

        entity.x = newX;
        entity.y = newY;
        if (isExplicitElev && entity.elevation !== undefined) {
            entity.elevation = newElev;
        }

        s.currentState.x = newX;
        s.currentState.y = newY;
        if (isExplicitElev) {
            s.currentState.elevation = entity.elevation || newElev;
            s.hasExplicitElevation = true;
        } else {
            delete s.currentState.elevation;
            s.hasExplicitElevation = false;
        }

        // In-place 3D mesh sync
        if (entity.mesh3D) {
            entity.mesh3D.position.x = newX;
            entity.mesh3D.position.z = newY;
            if (isExplicitElev) entity.mesh3D.position.y = newElev;
            if (typeof entity.mesh3D.updateMatrixWorld === 'function') entity.mesh3D.updateMatrixWorld(true);
        }

        // In-place 2D group sync
        if (entity.group && typeof entity.group.position === 'function') {
            entity.group.position({ x: newX, y: newY });
        }

        // Staircase Dynamic Height Auto-Detection during drag
        const isStair = !entity.isFloor && !entity.isPlatform && Boolean(
            (typeof entity.type === 'string' && entity.type.startsWith('stair')) ||
            entity.constructor?.name === 'PremiumStaircase' ||
            entity.totalSteps !== undefined
        );
        if (isStair && options.planner) {
            const detection = StairHeightDetector.detect({
                x: newX,
                z: newY,
                elevation: entity.elevation || 0,
                rotation: entity.rotation || 0,
                preset: entity,
                planner: options.planner,
                isCenterAnchored: false
            });
            if (detection.hasTarget) {
                const currentH = Number(entity.height) || 300;
                if (Math.abs(currentH - detection.detectedHeight) > 1) {
                    s.pendingStairUpdate = {
                        height: detection.detectedHeight,
                        totalSteps: detection.optimalSteps,
                        flight1Steps: detection.flight1Steps,
                        flight2Steps: detection.flight2Steps,
                        stepHeight: detection.stepHeight,
                        length: detection.flightLength
                    };
                }
            }
        }

        if (options.realtimeUpdate) {
            options.realtimeUpdate.markDirty(entity, 'transform');
        }

        coreEventBus.emit('EntityTransformPreview', {
            entity,
            x: newX,
            y: newY,
            elevation: entity.elevation || newElev,
            rotation: entity.rotation || 0
        });
    }

    /**
     * Updates transient preview during rotation drag (60 FPS, no command created).
     * @param {Object} entity 
     * @param {number} rawAngleDeg - Raw pointer angle in degrees.
     * @param {Object} [options={}] - Snapping options.
     * @returns {{ angle: number, isSnapped: boolean }}
     */
    static previewSpin(entity, rawAngleDeg, options = {}) {
        if (!entity || !this._session) return { angle: rawAngleDeg, isSnapped: false };
        const s = this._session;

        const { angle: newAngle, isSnapped } = this.snapAngle(rawAngleDeg, options);
        s.currentState.rotation = newAngle;

        // Calculate center-compensated position
        const { x: newX, y: newY } = this.computeCenterCompensatedPosition(entity, newAngle, s.worldCenter, s.localCenter);
        s.currentState.x = newX;
        s.currentState.y = newY;

        entity.x = newX;
        entity.y = newY;
        entity.rotation = newAngle;

        const newRotY = -(newAngle * Math.PI / 180);

        // In-place 3D mesh sync
        if (entity.mesh3D) {
            entity.mesh3D.position.x = newX;
            entity.mesh3D.position.z = newY;
            entity.mesh3D.rotation.y = newRotY;
            if (typeof entity.mesh3D.updateMatrixWorld === 'function') entity.mesh3D.updateMatrixWorld(true);
        }

        // In-place 2D group sync
        if (entity.group) {
            if (typeof entity.group.position === 'function') entity.group.position({ x: newX, y: newY });
            if (typeof entity.group.rotation === 'function') entity.group.rotation(newAngle);
        }

        if (typeof entity.update2D === 'function') entity.update2D();

        if (options.realtimeUpdate) {
            options.realtimeUpdate.markDirty(entity, 'transform');
        }

        coreEventBus.emit('EntityTransformPreview', {
            entity,
            x: newX,
            y: newY,
            rotation: newAngle,
            isSnapped
        });

        return { angle: newAngle, isSnapped };
    }

    /**
     * Commits the active session, creating and executing exactly ONE TransformCommand.
     * @param {Object} planner - FloorPlanner instance.
     * @returns {TransformCommand|null}
     */
    static commitSession(planner) {
        if (!this._session) return null;
        const s = this._session;
        this._session = null;

        const p = planner || (typeof window !== 'undefined' ? (window.planner?.value || window.planner || window.plannerInstance) : null);
        if (!p || !p.commandManager) {
            return null;
        }

        const before = s.initialState;
        const after = s.currentState;

        if (!s.hasExplicitElevation) {
            delete after.elevation;
        }

        // Check if anything actually changed
        const posChanged = Math.abs((after.x || 0) - (before.x || 0)) > 0.001 || Math.abs((after.y || 0) - (before.y || 0)) > 0.001;
        const rotChanged = Math.abs((after.rotation || 0) - (before.rotation || 0)) > 0.001;
        const elevChanged = s.hasExplicitElevation && Math.abs((after.elevation || 0) - (before.elevation || 0)) > 0.001;
        const tChanged = before.t !== null && after.t !== null && Math.abs(after.t - before.t) > 0.0001;

        if (!posChanged && !rotChanged && !elevChanged && !tChanged) {
            return null;
        }

        if (s.pendingStairUpdate && s.entity && (s.entityType === 'staircase' || (typeof s.entityType === 'string' && s.entityType.startsWith('stair')))) {
            StairEngine.batchUpdate(p, s.entity, s.pendingStairUpdate);
            if (p.scene3D?.realtimeUpdate) {
                p.scene3D.realtimeUpdate.markDirty(s.entity, 'geometry');
            }
        }

        const cmd = new TransformCommand(p, s.entityId, s.entityType, before, after);
        p.commandManager.execute(cmd);
        return cmd;
    }

    /**
     * Cancels the active session, reverting the entity to its initial baseline state.
     * @param {Object} [planner]
     */
    static cancelSession(planner) {
        if (!this._session) return;
        const s = this._session;
        this._session = null;

        const p = planner || (typeof window !== 'undefined' ? (window.planner?.value || window.planner || window.plannerInstance) : null);
        this.applyState(p, s.entityId, s.initialState);
    }

    // ==========================================
    // 4. DISCRETE ONE-SHOT TRANSFORMATIONS
    // ==========================================

    /**
     * Executes a discrete, atomic transformation (e.g. keyboard 'R', 45° Sims 4 tap, sidebar slider).
     * Immediately creates and executes a single TransformCommand.
     * 
     * @param {Object} planner 
     * @param {Object|string|number} entityOrId 
     * @param {Object} params
     * @param {number} [params.deltaRotation] - Degree delta to add.
     * @param {number} [params.absoluteRotation] - Absolute rotation in degrees.
     * @param {{ x?: number, y?: number, elevation?: number }} [params.deltaPosition] - Position delta.
     * @param {{ x?: number, y?: number, elevation?: number }} [params.absolutePosition] - Absolute position.
     * @returns {TransformCommand|null}
     */
    static executeDiscreteStep(planner, entityOrId, params = {}) {
        const p = planner || (typeof window !== 'undefined' ? (window.planner?.value || window.planner || window.plannerInstance) : null);
        if (!p) return null;

        const entity = this.findEntity(p, entityOrId);
        if (!entity) return null;

        const id = entity.id || (entity.group && typeof entity.group.id === 'function' ? entity.group.id() : null);
        const type = entity.type || entity.constructor?.name || '';

        const beforeState = {
            x: entity.x !== undefined ? entity.x : (entity.mesh3D ? entity.mesh3D.position.x : (entity.group?.x?.() || 0)),
            y: entity.y !== undefined ? entity.y : (entity.mesh3D ? entity.mesh3D.position.z : (entity.group?.y?.() || 0)),
            elevation: Number(entity.elevation) || (entity.mesh3D ? entity.mesh3D.position.y : 0),
            rotation: Number(entity.rotation) || 0,
            t: entity.t !== undefined ? entity.t : null,
            points: Array.isArray(entity.points) ? JSON.parse(JSON.stringify(entity.points)) : null
        };

        const afterState = { ...beforeState };

        const hasExplicitElevation = (params.deltaPosition && params.deltaPosition.elevation !== undefined) ||
            (params.absolutePosition && params.absolutePosition.elevation !== undefined);
        if (!hasExplicitElevation) {
            delete afterState.elevation;
        }

        // Rotation Step (Center-Compensated)
        if (params.deltaRotation !== undefined || params.absoluteRotation !== undefined) {
            const rawTargetRot = params.absoluteRotation !== undefined
                ? params.absoluteRotation
                : (beforeState.rotation + params.deltaRotation);
            const targetRot = ((Math.round(rawTargetRot) % 360) + 360) % 360;
            afterState.rotation = targetRot;

            const { x: newX, y: newY } = this.computeCenterCompensatedPosition(entity, targetRot);
            afterState.x = newX;
            afterState.y = newY;
        }

        // Position Step
        if (params.deltaPosition) {
            if (params.deltaPosition.x !== undefined) afterState.x = Math.round((afterState.x + params.deltaPosition.x) * 10) / 10;
            if (params.deltaPosition.y !== undefined) afterState.y = Math.round((afterState.y + params.deltaPosition.y) * 10) / 10;
            if (params.deltaPosition.elevation !== undefined) afterState.elevation = Math.round((afterState.elevation + params.deltaPosition.elevation) * 10) / 10;
        }
        if (params.absolutePosition) {
            if (params.absolutePosition.x !== undefined) afterState.x = params.absolutePosition.x;
            if (params.absolutePosition.y !== undefined) afterState.y = params.absolutePosition.y;
            if (params.absolutePosition.elevation !== undefined) afterState.elevation = params.absolutePosition.elevation;
        }

        // Opening T Step
        if (params.deltaT !== undefined || params.t !== undefined) {
            const rawT = params.t !== undefined ? params.t : ((beforeState.t !== null ? beforeState.t : 0.5) + params.deltaT);
            afterState.t = Math.max(0.01, Math.min(0.99, Math.round(rawT * 1000) / 1000));
        }

        // Points Step (Roofs, Platforms)
        if (params.points && Array.isArray(params.points)) {
            afterState.points = JSON.parse(JSON.stringify(params.points));
        }

        if (p.commandManager) {
            const cmd = new TransformCommand(p, id, type, beforeState, afterState);
            p.commandManager.execute(cmd);
            return cmd;
        } else {
            this.applyState(p, id, afterState);
            return null;
        }
    }

    // ==========================================
    // 5. AUTHORITATIVE STATE APPLICATION
    // ==========================================

    /**
     * Authoritative routine called by TransformCommand.execute() and TransformCommand.undo().
     * Applies full transform state and synchronizes all subsystems.
     * 
     * @param {Object} planner 
     * @param {string|number} entityId 
     * @param {Object} state - { x, y, elevation, rotation, t, points }
     */
    static applyState(planner, entityId, state) {
        if (!state) return;
        const p = planner || (typeof window !== 'undefined' ? (window.planner?.value || window.planner || window.plannerInstance) : null);
        const entity = this.findEntity(p, entityId);
        if (!entity) return;

        // 1. Planar Coordinates (x, y)
        if (state.x !== undefined && state.y !== undefined) {
            entity.x = state.x;
            entity.y = state.y;

            if (entity.group && typeof entity.group.position === 'function') {
                entity.group.position({ x: state.x, y: state.y });
            }

            // Subsystem Delegation
            const isStair = Boolean(
                (typeof entity.type === 'string' && entity.type.startsWith('stair')) ||
                entity.constructor?.name === 'PremiumStaircase' ||
                entity.totalSteps !== undefined
            );

            if (isStair && p) {
                StairEngine.setPosition(p, entity, state.x, state.y);
            } else if (entity.isAnchor || entity.constructor?.name === 'Anchor') {
                WallEngine.moveAnchor(entity, { x: state.x, y: state.y }, p, false);
            }

            // Spatial Host Resolution for Floor-Mounted Movable Entities
            const isMovableChild = entity.type === 'furniture' || entity.type === 'shape' ||
                (typeof entity.type === 'string' && entity.type.startsWith('shape_')) || isStair ||
                entity.type === 'glb' || entity.type === 'model' || entity.type === 'decor' ||
                entity.type === 'fixture' || entity.type === 'custom_entity' || entity.type === 'custom' ||
                entity.type === 'surface_attached' || Boolean(entity.parentWallId || entity.hostPlatformId);

            if (isMovableChild && p) {
                const hostRes = SpatialHostResolver.findHostAt(p, state.x, state.y, entity.type, {
                    rotation: entity.rotation,
                    elevation: state.elevation !== undefined ? state.elevation : entity.elevation,
                    ignoreEntity: entity
                });

                if (hostRes && hostRes.host) {
                    if (hostRes.hostType === 'platform') {
                        if (state.elevation === undefined) {
                            entity.elevation = hostRes.surfaceElevation;
                        }
                        entity.hostPlatformId = hostRes.hostId;
                        if (isStair) {
                            const targetH = Math.max(20, (Number(hostRes.host.elevation) || 0) + (Number(hostRes.host.height) || 0) - (Number(entity.baseElevation) || 0));
                            if (typeof StairHeightDetector?.recalculateStairForHeight === 'function' && Math.abs((entity.height || 0) - targetH) > 1) {
                                StairHeightDetector.recalculateStairForHeight(entity, targetH);
                            }
                        }
                    } else if (hostRes.hostType === 'wall') {
                        entity.parentWallId = hostRes.hostId;
                    }
                    globalSpatialDependencyEngine.attach(entity, hostRes.host, {
                        relationshipType: hostRes.relationshipType,
                        localTransform: hostRes.localTransform
                    });
                } else if (entity.hostPlatformId || entity.hostId || entity.parentWallId) {
                    globalSpatialDependencyEngine.detach(entity);
                    if (state.elevation === undefined) {
                        entity.elevation = Number(entity.baseElevation) || 0;
                    }
                    entity.hostPlatformId = null;
                    entity.parentWallId = null;
                    entity.hostId = null;
                }
            }

            // Notify dependents if this entity is a host (e.g. platform, table)
            if (p && (entity.type === 'platform' || globalSpatialDependencyEngine.getDependents(entity.id).length > 0)) {
                globalSpatialDependencyEngine.onHostTransformed(entity, p);
            }
        }

        // 2. Vertical Elevation
        if (state.elevation !== undefined) {
            entity.elevation = state.elevation;
        } else {
            state.elevation = Number(entity.elevation) || 0;
        }

        // 3. Rotation (Degrees)
        if (state.rotation !== undefined) {
            const rot = ((Math.round(state.rotation) % 360) + 360) % 360;
            entity.rotation = rot;

            if (entity.group && typeof entity.group.rotation === 'function') {
                entity.group.rotation(rot);
            }

            // Subsystem Delegation
            if (entity.type === 'roof' || entity.config?.roofType) {
                RoofEngine.setRotation(entity, rot, p);
            } else if (entity.type?.includes('stair') || entity.totalSteps !== undefined) {
                if (p) StairEngine.setRotation(p, entity, rot);
            }

            // Update local transform relative to host if attached
            if (entity.hostId && p) {
                const hostRecord = globalSpatialDependencyEngine.getHostRecord(entity.id);
                if (hostRecord) {
                    const hostEntity = this.findEntity(p, hostRecord.hostId);
                    if (hostEntity) {
                        globalSpatialDependencyEngine.attach(entity, hostEntity, {
                            relationshipType: hostRecord.relationshipType,
                            computeFromCurrentWorld: true
                        });
                    }
                }
            }

            // Notify dependents if this entity is a host
            if (p && globalSpatialDependencyEngine.getDependents(entity.id).length > 0) {
                globalSpatialDependencyEngine.onHostTransformed(entity, p);
            }
        }

        // 4. Wall Opening / Plugin 't' parameter
        if (state.t !== undefined) {
            entity.t = state.t;
            if (entity.update && typeof entity.update === 'function') {
                entity.update();
            }
        }

        // 5. Polygon Points (Roofs, Platforms)
        if (Array.isArray(state.points)) {
            if (entity.type === 'roof' || entity.config?.roofType) {
                RoofEngine.setPoints(entity, state.points, p);
            } else {
                entity.points = JSON.parse(JSON.stringify(state.points));
            }
        }

        // 6. 3D Viewport Mesh Sync
        if (entity.mesh3D) {
            const posX = entity.x !== undefined ? entity.x : (entity.group?.x?.() || 0);
            const posZ = entity.y !== undefined ? entity.y : (entity.group?.y?.() || 0);
            const posY = Number(entity.elevation) || 0;
            entity.mesh3D.position.set(posX, posY, posZ);

            if (entity.rotation !== undefined) {
                entity.mesh3D.rotation.y = -(Number(entity.rotation) * Math.PI / 180);
            }
            if (typeof entity.mesh3D.updateMatrixWorld === 'function') {
                entity.mesh3D.updateMatrixWorld(true);
            }
        }

        // 7. Render & Viewport Notifications
        if (typeof entity.update3D === 'function') entity.update3D();
        if (typeof entity.update2D === 'function') entity.update2D();
        else if (typeof entity.update === 'function') entity.update();

        coreEventBus.emit('EntityTransformUpdated', {
            id: entityId,
            entity,
            x: entity.x,
            y: entity.y,
            elevation: entity.elevation || 0,
            rotation: entity.rotation || 0,
            t: entity.t
        });

        if (p && typeof p.syncAll === 'function') {
            p.syncAll();
        }
    }
}

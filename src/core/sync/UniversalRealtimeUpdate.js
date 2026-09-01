import * as THREE from 'three';
import { coreEventBus } from '../EventBus.js';
import { WIDGET_REGISTRY, MOLDING_REGISTRY, DOOR_TYPES, WINDOW_TYPES, WALL_DECOR_REGISTRY } from '../registry.js';
import { Stair3DBuilder } from '../../features/stairs/stairs.renderer3d.js';
import { Railing3DBuilder } from '../../features/railing/builders/Railing3DBuilder.js';

export class UniversalRealtimeUpdate {
    constructor(engine3D) {
        this.ctx = engine3D;
        this._dirtyEntities = new Map(); // entity -> Set<updateType>
        this._batchRaf = null;
        this._syncUiRaf = null;
        
        this.strategies = {
            transform: (entity) => {
                if (!entity || !entity.mesh3D) return false;
                const obj = entity.mesh3D;
                if (entity.x !== undefined && entity.y !== undefined) {
                    obj.position.set(entity.x, entity.elevation || 0, entity.y);
                }
                if (entity.rotation !== undefined) {
                    obj.rotation.y = -(entity.rotation || 0) * Math.PI / 180;
                }
                return true;
            },
            material: (entity) => {
                if (!entity || !entity.mesh3D) return false;
                if (typeof this.ctx.updateMaterialLive === 'function') {
                    this.ctx.updateMaterialLive(entity);
                    return true;
                }
                return false;
            },
            geometry: (entity) => {
                if (!entity) return false;
                let success = false;
                
                // 1. Rebuild the object itself (if it's not a wall)
                if (entity.startX === undefined || entity.endX === undefined) {
                    success = this.rebuildMeshInPlace(entity) || success;
                }
                
                // 2. If it is a wall itself, update its geometry
                if (entity.startAnchor || (entity.startX !== undefined && entity.endX !== undefined)) {
                    if (entity.update) entity.update();
                    if (this.ctx.updateWallGeometryLive) {
                        this.ctx.updateWallGeometryLive(entity);
                        success = true;
                    }
                }
                
                // 3. If it belongs to a wall (like a door, window, molding), update the parent wall's geometry for cutouts
                if (entity.wall && this.ctx.updateWallGeometryLive) {
                    this.ctx.updateWallGeometryLive(entity.wall);
                    success = true;
                }
                
                return success;
            }
        };
    }

    /**
     * Professional CAD Dirty Queue Registration
     * Batches property inputs within the same animation frame.
     */
    markDirty(entity, updateType = 'geometry') {
        if (!entity) return;
        if (!this._dirtyEntities.has(entity)) {
            this._dirtyEntities.set(entity, new Set());
        }
        this._dirtyEntities.get(entity).add(updateType);

        if (!this._batchRaf) {
            this._batchRaf = requestAnimationFrame(() => this.flushDirtyQueue());
        }
    }

    flushDirtyQueue() {
        this._batchRaf = null;
        if (this._dirtyEntities.size === 0) return;

        this._dirtyEntities.forEach((types, entity) => {
            const highestType = types.has('geometry') ? 'geometry' : (types.has('material') ? 'material' : 'transform');
            const strategy = this.strategies[highestType] || this.strategies.geometry;
            strategy(entity);
        });

        this._dirtyEntities.clear();
        this.ctx.requestRender('batch_dirty_flush', 2);
    }

    /**
     * 1. Universal Entity Update Entrypoint
     * Strategy dispatch map for transform, material, and geometry updates.
     */
    updateEntity(entity, updateType = 'geometry') {
        if (!entity || this.ctx.isUpdatingFrom3D) return false;
        const strategy = this.strategies[updateType] || this.strategies.geometry;
        const success = strategy(entity);
        this.ctx.requestRender('universal_realtime_update', 2);
        return success;
    }

    /**
     * 2. Realtime Property Mutation
     * Mutates JSON entity property, updates 2D shape, and triggers 3D rebuild.
     */
    updateProperty(entity, key, value) {
        if (!entity || key === undefined) return false;
        entity[key] = value;
        if (typeof entity.update2D === 'function') entity.update2D();
        else if (typeof entity.update === 'function') entity.update();
        return this.updateEntity(entity, 'geometry');
    }

    /**
     * 3. 60fps Frame-by-Frame Continuous Cursor & Gizmo Tracking
     */
    updateTransform(entity, x, y, z, rotation) {
        if (!entity) return false;
        if (x !== undefined) entity.x = x;
        if (y !== undefined) entity.y = y;
        if (z !== undefined) entity.elevation = z;
        if (rotation !== undefined) entity.rotation = rotation;

        if (entity.mesh3D) {
            entity.mesh3D.position.set(entity.x || 0, entity.elevation || 0, entity.y || 0);
            if (entity.rotation !== undefined) {
                entity.mesh3D.rotation.y = -(entity.rotation || 0) * Math.PI / 180;
            }
        }

        if (entity.group && typeof entity.group.x === 'function') {
            entity.group.x(entity.x || 0);
            entity.group.y(entity.y || 0);
            if (typeof entity.group.rotation === 'function' && entity.rotation !== undefined) {
                entity.group.rotation(entity.rotation);
            }
        }

        if (typeof entity.update2D === 'function') entity.update2D();
        else if (typeof entity.update === 'function') entity.update();

        if (!this._syncUiRaf) {
            this._syncUiRaf = requestAnimationFrame(() => {
                if (this.ctx.onEntityTransform) this.ctx.onEntityTransform();
                this._syncUiRaf = null;
            });
        }
        return true;
    }

    /**
     * 4. Universal In-Place 3D WebGL Buffer Swap
     */
    rebuildMeshInPlace(entity) {
        if (!entity) return false;
        const oldMesh = entity.mesh3D || (this.ctx.interactables && this.ctx.interactables.find(m => m.userData && m.userData.entity === entity));
        if (!oldMesh) return false;
        const parent = oldMesh.parent || this.ctx.structureGroup;
        if (!parent) return false;

        let renderFunc = null;
        const type = entity.type || '';
        const subType = entity.widgetType || entity.configId || entity.furnitureType || type;
        
        if (WIDGET_REGISTRY[subType] || WIDGET_REGISTRY[type]) renderFunc = (WIDGET_REGISTRY[subType] || WIDGET_REGISTRY[type]).render3D;
        else if (MOLDING_REGISTRY[subType] || MOLDING_REGISTRY[type]) renderFunc = (MOLDING_REGISTRY[subType] || MOLDING_REGISTRY[type]).render3D;
        else if (DOOR_TYPES && (DOOR_TYPES[subType] || DOOR_TYPES[type])) renderFunc = (DOOR_TYPES[subType] || DOOR_TYPES[type]).render3D;
        else if (WINDOW_TYPES && (WINDOW_TYPES[subType] || WINDOW_TYPES[type])) renderFunc = (WINDOW_TYPES[subType] || WINDOW_TYPES[type]).render3D;
        else if (WALL_DECOR_REGISTRY && (WALL_DECOR_REGISTRY[subType] || WALL_DECOR_REGISTRY[type])) renderFunc = (WALL_DECOR_REGISTRY[subType] || WALL_DECOR_REGISTRY[type]).render3D;
        else if (type === 'stair' || subType.startsWith('stair_') || type === 'staircase') {
            renderFunc = (group, ent, helpers) => {
                const tempWrapper = new THREE.Group();
                const stairBuilder = new Stair3DBuilder(helpers.ctx?.assets, helpers.ctx?.interactables, helpers);
                const wallH = helpers.ctx?.envBuilder?.wallHeight || 300;
                stairBuilder.build([ent], tempWrapper, 0, false, wallH);
                const actualStairGroup = tempWrapper.children[0] || tempWrapper;
                tempWrapper.remove(actualStairGroup);
                return actualStairGroup;
            };
        } else if (type === 'railing' || subType === 'railing') {
            renderFunc = (group, ent, helpers) => Railing3DBuilder.build(ent);
        } else if ((type === 'furniture' || entity.isFurniture) && window.FURNITURE_REGISTRY) {
            const fConf = window.FURNITURE_REGISTRY[subType] || window.FURNITURE_REGISTRY[type];
            if (fConf) renderFunc = fConf.render3D;
        } else if (type.startsWith('shape_') || subType.startsWith('shape_')) {
            this.ctx.updateShapeLive(entity);
            if (coreEventBus) coreEventBus.emit('EntityGeometryUpdated', { entity, object3D: entity.mesh3D });
            return true;
        }

        if (renderFunc) {
            const newGroup = new THREE.Group();
            const newMesh = renderFunc(newGroup, entity, this.ctx.helpers);
            
            parent.add(newMesh);
            parent.remove(oldMesh);
            
            oldMesh.traverse(child => {
                if (child.isMesh && child.geometry) child.geometry.dispose();
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => { if (m && m.dispose) m.dispose(); });
                    else if (child.material.dispose) child.material.dispose();
                }
            });

            entity.mesh3D = newMesh;

            if (coreEventBus) {
                coreEventBus.emit('EntityGeometryUpdated', { entity, object3D: newMesh });
            }

            const interactions = this.ctx.interactions;
            if (interactions && interactions.selectedObject === oldMesh) {
                interactions.selectedObject = newMesh;
                const idx = this.ctx.interactables.indexOf(oldMesh);
                if (idx > -1) this.ctx.interactables[idx] = newMesh;
                else this.ctx.interactables.push(newMesh);

                if (interactions.refreshSelectionHighlight) {
                    interactions.refreshSelectionHighlight(newMesh);
                }
            }
            return true;
        }
        return false;
    }
}

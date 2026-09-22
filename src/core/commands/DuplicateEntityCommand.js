import { Command } from './Command.js';
import { ValidationLayer } from '../api/ValidationLayer.js';
import { PremiumFurniture } from '../../features/furniture/furniture.renderer2d.js';
import { StairEngine } from '../stairs/StairEngine.js';
import { WallEngine } from '../wall/WallEngine.js';
import { RoofEngine } from '../roof/RoofEngine.js';

export class DuplicateEntityCommand extends Command {
    constructor(planner, entityId, id) {
        super();
        this.planner = planner;
        this.entityId = entityId;
        this.id = id;
        this.createdEntity = null;
        this.hostWall = null;
        this.serializedRoof = null;
        this.serializedStair = null;
        this.serializedWidget = null;
    }

    execute() {
        if (this.serializedWidget && this.hostWall) {
            this.createdEntity = WallEngine.deserializeWidget(this.planner, this.hostWall, this.serializedWidget);
            WallEngine.attachWidget(this.hostWall, this.createdEntity, false, this.planner);
            this.planner.syncAll();
            return;
        }

        if (this.serializedStair) {
            const restored = StairEngine.deserialize(this.planner, this.serializedStair);
            if (restored) {
                this.createdEntity = restored;
                if (this.id) this.createdEntity.id = this.id;
                if (!this.planner.stairs) this.planner.stairs = [];
                if (!this.planner.stairs.includes(restored)) {
                    this.planner.stairs.push(restored);
                }
            }
            this.planner.syncAll();
            return;
        }

        if (this.serializedRoof) {
            const restored = RoofEngine.deserialize(this.serializedRoof, this.planner, { addToPlanner: true });
            if (restored) {
                this.createdEntity = restored;
                if (this.id) this.createdEntity.id = this.id;
            }
            this.planner.syncAll();
            return;
        }

        if (!this.createdEntity) {
            const sourceEntity = ValidationLayer.findEntity(this.planner, this.entityId);
            if (!sourceEntity) throw new Error('Source entity not found for duplication');

            const hostWall = sourceEntity.wall || sourceEntity.parentWall || 
                (this.planner?.walls && this.planner.walls.find(w => 
                    (w.attachedWidgets && (w.attachedWidgets.includes(sourceEntity) || w.attachedWidgets.some(widg => widg.id === this.entityId))) ||
                    (w.id === sourceEntity.parentWallId)
                ));

            // Quick deep copy simulation for the duplicated entity based on serialized state
            if (sourceEntity.constructor?.name === 'PremiumFurniture') {
                this.createdEntity = new PremiumFurniture(
                    this.planner, 
                    sourceEntity.group ? sourceEntity.group.x() + 20 : 0, 
                    sourceEntity.group ? sourceEntity.group.y() + 20 : 0, 
                    sourceEntity.config?.id
                );
                this.createdEntity.id = this.id;
                this.createdEntity.rotation = sourceEntity.rotation;
                this.createdEntity.width = sourceEntity.width;
                this.createdEntity.depth = sourceEntity.depth;
                this.createdEntity.height = sourceEntity.height;
                this.createdEntity.elevation = sourceEntity.elevation;
                if (sourceEntity.params) this.createdEntity.params = JSON.parse(JSON.stringify(sourceEntity.params));
            } else if (sourceEntity.constructor?.name === 'PremiumStaircase' || (sourceEntity.type && sourceEntity.type.startsWith('stair_'))) {
                this.createdEntity = StairEngine.duplicateStair(this.planner, sourceEntity, { x: 30, y: 30 });
                if (this.id) this.createdEntity.id = this.id;
                this.serializedStair = StairEngine.serialize(this.createdEntity);
                this.planner.syncAll();
                return;
            } else if (sourceEntity.constructor?.name === 'PremiumHipRoof' || sourceEntity.type === 'roof' || (this.planner?.roofs && this.planner.roofs.includes(sourceEntity))) {
                this.createdEntity = RoofEngine.duplicateRoof(this.planner, sourceEntity, { x: 30, y: 30 });
                if (this.id) this.createdEntity.id = this.id;
                this.serializedRoof = RoofEngine.serialize(this.createdEntity);
                this.planner.syncAll();
                return;
            } else if (hostWall && (sourceEntity.type === 'door' || sourceEntity.type === 'window' || sourceEntity.doorType || sourceEntity.windowType || sourceEntity.type?.startsWith('door_') || sourceEntity.type?.startsWith('window_') || sourceEntity.constructor?.name === 'PremiumWidget' || sourceEntity.constructor?.name === 'advance_openings' || sourceEntity.type === 'jali_panel' || sourceEntity.type === 'sunshade')) {
                this.hostWall = hostWall;
                const baseT = sourceEntity.t !== undefined ? sourceEntity.t : 0.5;
                const newT = Math.min(0.9, Math.max(0.1, baseT + 0.15));
                const newId = this.id || ('w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));

                const configId = sourceEntity.configId || sourceEntity.type || 'door';
                const options = {
                    id: newId,
                    width: sourceEntity.width,
                    height: sourceEntity.height,
                    depth: sourceEntity.depth,
                    elevation: sourceEntity.elevation,
                    facing: sourceEntity.facing !== undefined ? sourceEntity.facing : 1,
                    side: sourceEntity.side,
                    flip: sourceEntity.flip || false,
                    doorType: sourceEntity.doorType,
                    doorShape: sourceEntity.doorShape || sourceEntity.params?.doorShape,
                    doorStyle: sourceEntity.doorStyle || sourceEntity.params?.doorStyle,
                    windowType: sourceEntity.windowType,
                    windowShape: sourceEntity.windowShape || sourceEntity.params?.windowShape,
                    params: sourceEntity.params ? JSON.parse(JSON.stringify(sourceEntity.params)) : {},
                    materials: sourceEntity.materials ? JSON.parse(JSON.stringify(sourceEntity.materials)) : {},
                    attach: false
                };

                try {
                    this.createdEntity = WallEngine.createWidget(this.planner, hostWall, newT, configId, options);
                } catch (e) {
                    const { wall: _w, parentWall: _pw, mesh3D: _m, group: _g, poly: _p, ...clonedProps } = sourceEntity;
                    this.createdEntity = {
                        ...clonedProps,
                        ...options,
                        t: newT,
                        wall: hostWall,
                        parentWall: hostWall,
                        parentWallId: hostWall.id
                    };
                }
                this.serializedWidget = WallEngine.serializeWidget(this.createdEntity);
            } else {
                throw new Error('Duplication currently only supports PremiumFurniture, Staircases, Roofs, and Attached Wall Openings/Widgets via AutomationAPI');
            }
        }
        
        if (this.hostWall && this.createdEntity) {
            WallEngine.attachWidget(this.hostWall, this.createdEntity, false, this.planner);
        } else if (this.createdEntity.constructor?.name === 'PremiumFurniture') {
            this.planner.furniture.push(this.createdEntity);
        }
        
        if (this.createdEntity.group && typeof this.createdEntity.group.show === 'function') {
            this.createdEntity.group.show();
        }
        this.planner.syncAll();
    }

    undo() {
        if (!this.createdEntity) return;
        if (this.hostWall) {
            this.serializedWidget = WallEngine.serializeWidget(this.createdEntity);
            WallEngine.deleteWidget(this.planner, this.hostWall, this.createdEntity, false);
            this.createdEntity = null;
        } else if (this.createdEntity.constructor?.name === 'PremiumStaircase' || (this.createdEntity.type && (this.createdEntity.type.startsWith('stair_') || this.createdEntity.type === 'stair'))) {
            this.serializedStair = StairEngine.serialize(this.createdEntity);
            StairEngine.deleteStair(this.planner, this.createdEntity);
            this.createdEntity = null;
        } else if (this.createdEntity.constructor?.name === 'PremiumHipRoof' || this.createdEntity.type === 'roof' || (this.planner?.roofs && this.planner.roofs.includes(this.createdEntity))) {
            this.serializedRoof = RoofEngine.serialize(this.createdEntity);
            RoofEngine.deleteRoof(this.planner, this.createdEntity);
            this.createdEntity = null;
        } else if (typeof this.createdEntity.remove === 'function') {
            this.createdEntity.remove();
        }
        this.planner.syncAll();
    }
}

import { Command } from './Command.js';
import { ValidationLayer } from '../api/ValidationLayer.js';
import { PremiumFurniture } from '../../features/furniture/furniture.renderer2d.js';
import { PremiumWidget } from '../engine2d/PremiumWidget.js';
import { StairEngine } from '../stairs/StairEngine.js';
import { StairTopologyEngine } from '../stairs/StairTopologyEngine.js';
import { WallEngine } from '../wall/WallEngine.js';

export class DuplicateEntityCommand extends Command {
    constructor(planner, entityId, id) {
        super();
        this.planner = planner;
        this.entityId = entityId;
        this.id = id;
        this.createdEntity = null;
        this.hostWall = null;
    }

    execute() {
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
                return;
            } else if (hostWall && (sourceEntity.type === 'door' || sourceEntity.type === 'window' || sourceEntity.doorType || sourceEntity.windowType || sourceEntity.type?.startsWith('door_') || sourceEntity.type?.startsWith('window_') || sourceEntity.constructor?.name === 'PremiumWidget' || sourceEntity.type === 'jali_panel' || sourceEntity.type === 'sunshade')) {
                this.hostWall = hostWall;
                const baseT = sourceEntity.t !== undefined ? sourceEntity.t : 0.5;
                const newT = Math.min(0.9, Math.max(0.1, baseT + 0.15));
                const newId = this.id || ('w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));

                const { wall: _w, parentWall: _pw, mesh3D: _m, group: _g, poly: _p, ...clonedProps } = sourceEntity;
                const safeClone = {
                    ...clonedProps,
                    id: newId,
                    t: newT,
                    wall: hostWall,
                    parentWall: hostWall,
                    parentWallId: hostWall.id,
                    params: sourceEntity.params ? JSON.parse(JSON.stringify(sourceEntity.params)) : {},
                    materials: sourceEntity.materials ? JSON.parse(JSON.stringify(sourceEntity.materials)) : {}
                };

                if (sourceEntity.constructor?.name === 'PremiumWidget' && this.planner?.wallLayer && typeof window !== 'undefined' && typeof document !== 'undefined') {
                    try {
                        this.createdEntity = new PremiumWidget(this.planner, hostWall, newT, sourceEntity.configId || sourceEntity.type);
                        this.createdEntity.id = newId;
                        this.createdEntity.parentWallId = hostWall.id;
                        this.createdEntity.parentWall = hostWall;
                        this.createdEntity.width = sourceEntity.width;
                        this.createdEntity.height = sourceEntity.height;
                        this.createdEntity.elevation = sourceEntity.elevation;
                        this.createdEntity.facing = sourceEntity.facing !== undefined ? sourceEntity.facing : 1;
                        this.createdEntity.flip = sourceEntity.flip || false;
                        if (sourceEntity.params) this.createdEntity.params = JSON.parse(JSON.stringify(sourceEntity.params));
                        if (sourceEntity.materials) this.createdEntity.materials = JSON.parse(JSON.stringify(sourceEntity.materials));
                    } catch (e) {
                        this.createdEntity = safeClone;
                    }
                } else {
                    this.createdEntity = safeClone;
                }
            } else {
                throw new Error('Duplication currently only supports PremiumFurniture, Staircases, and Attached Wall Openings/Widgets via AutomationAPI');
            }
        }
        
        if (this.hostWall && this.createdEntity) {
            WallEngine.attachWidget(this.hostWall, this.createdEntity, false, this.planner);
        } else if (this.createdEntity.constructor?.name === 'PremiumFurniture') {
            this.planner.furniture.push(this.createdEntity);
        } else if (this.createdEntity.constructor?.name === 'PremiumStaircase' || (this.createdEntity.type && this.createdEntity.type.startsWith('stair_'))) {
            if (!this.planner.stairs.includes(this.createdEntity)) {
                this.planner.stairs.push(this.createdEntity);
            }
        }
        
        if (this.createdEntity.group && typeof this.createdEntity.group.show === 'function') {
            this.createdEntity.group.show();
        }
        this.planner.syncAll();
    }

    undo() {
        if (!this.createdEntity) return;
        if (this.hostWall) {
            WallEngine.removeWidget(this.hostWall, this.createdEntity, false, this.planner);
            if (typeof this.createdEntity.remove === 'function') {
                this.createdEntity.remove();
            }
        } else if (this.createdEntity.constructor?.name === 'PremiumStaircase' || (this.createdEntity.type && (this.createdEntity.type.startsWith('stair_') || this.createdEntity.type === 'stair'))) {
            StairTopologyEngine.deleteStair(this.planner, this.createdEntity);
        } else if (typeof this.createdEntity.remove === 'function') {
            this.createdEntity.remove();
        }
        this.planner.syncAll();
    }
}

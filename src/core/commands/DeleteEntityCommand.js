/**
 * src/core/commands/DeleteEntityCommand.js
 */
import { Command } from './Command.js';
import { ValidationLayer } from '../api/ValidationLayer.js';
import { StairTopologyEngine } from '../stairs/StairTopologyEngine.js';
import { WallEngine } from '../wall/WallEngine.js';

export class DeleteEntityCommand extends Command {
    constructor(planner, entityId) {
        super();
        this.planner = planner;
        this.entityId = entityId;
        this.deletedEntity = null;
        this.serializedStair = null;
        this.hostWall = null;
        this.hostWallId = null;
    }

    execute() {
        if (!this.deletedEntity) {
            this.deletedEntity = ValidationLayer.findEntity(this.planner, this.entityId);
        }
        if (this.deletedEntity) {
            // Check if entity is an attached widget on a wall
            const hostWall = this.deletedEntity.wall || this.deletedEntity.parentWall || 
                (this.planner?.walls && this.planner.walls.find(w => 
                    (w.attachedWidgets && (w.attachedWidgets.includes(this.deletedEntity) || w.attachedWidgets.some(widg => widg.id === this.entityId))) ||
                    (w.id === this.deletedEntity.parentWallId)
                ));

            if (hostWall) {
                this.hostWall = hostWall;
                this.hostWallId = hostWall.id;
            }

            if (this.deletedEntity.constructor?.name === 'PremiumStaircase' || (this.deletedEntity.type && (this.deletedEntity.type.startsWith('stair_') || this.deletedEntity.type === 'stair'))) {
                this.serializedStair = StairTopologyEngine.serialize(this.deletedEntity);
                StairTopologyEngine.deleteStair(this.planner, this.deletedEntity);
            } else if (hostWall && (this.deletedEntity.type === 'door' || this.deletedEntity.type === 'window' || this.deletedEntity.doorType || this.deletedEntity.windowType || this.deletedEntity.type?.startsWith('door_') || this.deletedEntity.type?.startsWith('window_') || this.deletedEntity.constructor?.name === 'PremiumWidget')) {
                if (typeof this.deletedEntity.remove === 'function') {
                    this.deletedEntity.remove();
                }
                WallEngine.removeWidget(hostWall, this.deletedEntity, false, this.planner);
            } else if (typeof this.deletedEntity.remove === 'function') {
                this.deletedEntity.remove();
            } else if (typeof this.deletedEntity.destroy === 'function') {
                this.deletedEntity.destroy();
            } else if (this.deletedEntity.group) {
                this.deletedEntity.group.visible(false);
            }
            this.planner.syncAll();
        }
    }

    undo() {
        if (this.deletedEntity) {
            if (this.deletedEntity.type === 'outer' || this.deletedEntity.type === 'inner' || this.deletedEntity.type === 'compound') {
                this.planner.walls.push(this.deletedEntity);
            } else if (this.hostWall || this.hostWallId) {
                const wall = this.hostWall || (this.planner?.walls && this.planner.walls.find(w => w.id === this.hostWallId));
                if (wall) {
                    WallEngine.attachWidget(wall, this.deletedEntity, false, this.planner);
                }
            } else if (this.deletedEntity.constructor?.name === 'PremiumFurniture') {
                this.planner.furniture.push(this.deletedEntity);
            } else if (this.serializedStair) {
                const restored = StairTopologyEngine.deserialize(this.planner, this.serializedStair);
                if (restored) {
                    if (!this.planner.stairs) this.planner.stairs = [];
                    if (!this.planner.stairs.includes(restored)) {
                        this.planner.stairs.push(restored);
                    }
                    this.deletedEntity = restored;
                }
            } else if (this.deletedEntity.constructor?.name === 'PremiumStaircase' || (this.deletedEntity.type && (this.deletedEntity.type.startsWith('stair_') || this.deletedEntity.type === 'stair'))) {
                if (!this.planner.stairs.includes(this.deletedEntity)) {
                    this.planner.stairs.push(this.deletedEntity);
                }
            }
            if (this.deletedEntity.group && typeof this.deletedEntity.group.visible === 'function') {
                this.deletedEntity.group.visible(true);
            }
            if (this.deletedEntity.poly && typeof this.deletedEntity.poly.visible === 'function') {
                this.deletedEntity.poly.visible(true);
            }
            this.planner.syncAll();
        }
    }
}

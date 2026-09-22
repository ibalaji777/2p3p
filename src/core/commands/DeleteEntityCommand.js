/**
 * src/core/commands/DeleteEntityCommand.js
 */
import { Command } from './Command.js';
import { ValidationLayer } from '../api/ValidationLayer.js';
import { StairEngine } from '../stairs/StairEngine.js';
import { WallEngine } from '../wall/WallEngine.js';
import { RoofEngine } from '../roof/RoofEngine.js';
import { FurnitureEngine } from '../furniture/FurnitureEngine.js';
import { OutdoorZoneEngine } from '../outdoor/OutdoorZoneEngine.js';

export class DeleteEntityCommand extends Command {
    constructor(planner, entityId) {
        super();
        this.planner = planner;
        this.entityId = entityId;
        this.deletedEntity = null;
        this.serializedStair = null;
        this.serializedRoof = null;
        this.serializedWidget = null;
        this.serializedMolding = null;
        this.serializedFurniture = null;
        this.serializedOutdoorZone = null;
        this.hostWall = null;
        this.hostWallId = null;
    }

    execute() {
        if (!this.deletedEntity) {
            this.deletedEntity = ValidationLayer.findEntity(this.planner, this.entityId);
        }
        if (this.deletedEntity) {
            // Check if entity is an attached widget or molding on a wall
            const hostWall = this.deletedEntity.wall || this.deletedEntity.parentWall || 
                (this.planner?.walls && this.planner.walls.find(w => 
                    (w.attachedWidgets && (w.attachedWidgets.includes(this.deletedEntity) || w.attachedWidgets.some(widg => widg.id === this.entityId))) ||
                    (w.attachedMoldings && (w.attachedMoldings.includes(this.deletedEntity) || w.attachedMoldings.some(m => m.id === this.entityId))) ||
                    (w.id === this.deletedEntity.parentWallId)
                ));

            if (hostWall) {
                this.hostWall = hostWall;
                this.hostWallId = hostWall.id;
            }

            const isMolding = this.deletedEntity.constructor?.name === 'PremiumMolding' || 
                (this.deletedEntity.type && this.deletedEntity.type.startsWith('molding_')) ||
                (hostWall && hostWall.attachedMoldings && hostWall.attachedMoldings.includes(this.deletedEntity));

            if (this.deletedEntity.constructor?.name === 'PremiumFurniture' || this.deletedEntity.type === 'furniture') {
                this.serializedFurniture = FurnitureEngine.serialize(this.deletedEntity);
                FurnitureEngine.deleteFurniture(this.planner, this.deletedEntity);
            } else if (this.deletedEntity.constructor?.name === 'PremiumStaircase' || (this.deletedEntity.type && (this.deletedEntity.type.startsWith('stair_') || this.deletedEntity.type === 'stair'))) {
                this.serializedStair = StairEngine.serialize(this.deletedEntity);
                StairEngine.deleteStair(this.planner, this.deletedEntity);
            } else if (this.deletedEntity.constructor?.name === 'PremiumHipRoof' || (this.deletedEntity.type && this.deletedEntity.type === 'roof')) {
                this.serializedRoof = RoofEngine.serialize(this.deletedEntity);
                RoofEngine.deleteRoof(this.planner, this.deletedEntity);
            } else if (hostWall && isMolding) {
                this.serializedMolding = WallEngine.serializeMolding(this.deletedEntity);
                WallEngine.deleteMolding(this.planner, hostWall, this.deletedEntity, false);
            } else if (hostWall && (this.deletedEntity.type === 'door' || this.deletedEntity.type === 'window' || this.deletedEntity.doorType || this.deletedEntity.windowType || this.deletedEntity.type?.startsWith('door_') || this.deletedEntity.type?.startsWith('window_') || this.deletedEntity.constructor?.name === 'PremiumWidget' || this.deletedEntity.constructor?.name === 'advance_openings' || this.deletedEntity.type === 'sunshade' || this.deletedEntity.type === 'jali_panel')) {
                this.serializedWidget = WallEngine.serializeWidget(this.deletedEntity);
                WallEngine.deleteWidget(this.planner, hostWall, this.deletedEntity, false);
            } else if (this.deletedEntity.constructor?.name === 'PremiumOutdoorZone' || this.deletedEntity.type === 'outdoor_zone' || (this.planner?.outdoorZones && this.planner.outdoorZones.includes(this.deletedEntity))) {
                this.serializedOutdoorZone = OutdoorZoneEngine.serialize(this.deletedEntity);
                OutdoorZoneEngine.deleteOutdoorZone(this.planner, this.deletedEntity);
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
            } else if (this.serializedMolding && (this.hostWall || this.hostWallId)) {
                const wall = this.hostWall || (this.planner?.walls && this.planner.walls.find(w => w.id === this.hostWallId));
                if (wall) {
                    const restored = WallEngine.deserializeMolding(this.planner, wall, this.serializedMolding);
                    if (restored) {
                        WallEngine.attachMolding(wall, restored, false, this.planner);
                        this.deletedEntity = restored;
                    } else {
                        WallEngine.attachMolding(wall, this.deletedEntity, false, this.planner);
                    }
                }
            } else if (this.serializedWidget && (this.hostWall || this.hostWallId)) {
                const wall = this.hostWall || (this.planner?.walls && this.planner.walls.find(w => w.id === this.hostWallId));
                if (wall) {
                    const restored = WallEngine.deserializeWidget(this.planner, wall, this.serializedWidget);
                    if (restored) {
                        WallEngine.attachWidget(wall, restored, false, this.planner);
                        this.deletedEntity = restored;
                    } else {
                        WallEngine.attachWidget(wall, this.deletedEntity, false, this.planner);
                    }
                }
            } else if (this.hostWall || this.hostWallId) {
                const wall = this.hostWall || (this.planner?.walls && this.planner.walls.find(w => w.id === this.hostWallId));
                if (wall) {
                    WallEngine.attachWidget(wall, this.deletedEntity, false, this.planner);
                }
            } else if (this.serializedFurniture) {
                const restored = FurnitureEngine.deserialize(this.planner, this.serializedFurniture, { addToPlanner: true });
                if (restored) {
                    this.deletedEntity = restored;
                }
            } else if (this.deletedEntity.constructor?.name === 'PremiumFurniture') {
                this.planner.furniture.push(this.deletedEntity);
            } else if (this.serializedRoof) {
                const restored = RoofEngine.deserialize(this.serializedRoof, this.planner, { addToPlanner: true });
                if (restored) {
                    this.deletedEntity = restored;
                }
            } else if (this.serializedStair) {
                const restored = StairEngine.deserialize(this.planner, this.serializedStair);
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
            } else if (this.serializedOutdoorZone) {
                const restored = OutdoorZoneEngine.deserialize(this.planner, this.serializedOutdoorZone, { addToPlanner: true });
                if (restored) {
                    this.deletedEntity = restored;
                }
            } else if (this.deletedEntity.constructor?.name === 'PremiumOutdoorZone' || this.deletedEntity.type === 'outdoor_zone') {
                if (!this.planner.outdoorZones) this.planner.outdoorZones = [];
                if (!this.planner.outdoorZones.includes(this.deletedEntity)) {
                    this.planner.outdoorZones.push(this.deletedEntity);
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

/**
 * src/core/commands/CreateFurnitureCommand.js
 */
import { Command } from './Command.js';
import { FurnitureEngine } from '../furniture/FurnitureEngine.js';

export class CreateFurnitureCommand extends Command {
    constructor(planner, x, y, configId, id) {
        super();
        this.planner = planner;
        this.x = x;
        this.y = y;
        this.configId = configId;
        this.id = id;
        this.createdEntity = null;
        this.serializedFurniture = null;
    }

    execute() {
        if (!this.createdEntity) {
            if (this.serializedFurniture) {
                this.createdEntity = FurnitureEngine.deserialize(this.planner, this.serializedFurniture, { addToPlanner: true });
            } else {
                this.createdEntity = FurnitureEngine.createFurniture(this.planner, {
                    x: this.x,
                    y: this.y,
                    configId: this.configId,
                    id: this.id,
                    addToPlanner: true
                });
            }
            this.serializedFurniture = FurnitureEngine.serialize(this.createdEntity);
        }
        
        if (this.createdEntity?.group && typeof this.createdEntity.group.show === 'function') {
            this.createdEntity.group.show();
        }
        if (this.planner?.syncAll) this.planner.syncAll();
    }

    undo() {
        if (!this.createdEntity) return;
        this.serializedFurniture = FurnitureEngine.serialize(this.createdEntity);
        FurnitureEngine.deleteFurniture(this.planner, this.createdEntity);
        this.createdEntity = null;
        if (this.planner?.syncAll) this.planner.syncAll();
    }
}

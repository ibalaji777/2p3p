/**
 * src/core/commands/CreateFurnitureCommand.js
 */
import { Command } from './Command.js';
import { PremiumFurniture } from '../../features/furniture/furniture.renderer2d.js';

export class CreateFurnitureCommand extends Command {
    constructor(planner, x, y, configId, id) {
        super();
        this.planner = planner;
        this.x = x;
        this.y = y;
        this.configId = configId;
        this.id = id;
        this.createdEntity = null;
    }

    execute() {
        if (!this.createdEntity) {
            this.createdEntity = new PremiumFurniture(this.planner, this.x, this.y, this.configId);
            this.createdEntity.id = this.id;
        }
        
        this.planner.furniture.push(this.createdEntity);
        if (this.createdEntity.group && typeof this.createdEntity.group.show === 'function') {
            this.createdEntity.group.show();
        }
        this.planner.syncAll();
    }

    undo() {
        if (!this.createdEntity) return;
        this.createdEntity.remove();
        this.planner.syncAll();
    }
}

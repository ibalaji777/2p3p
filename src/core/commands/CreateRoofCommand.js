/**
 * src/core/commands/CreateRoofCommand.js
 */
import { Command } from './Command.js';
import { PremiumHipRoof } from '../../features/roof/roof.renderer2d.js';

export class CreateRoofCommand extends Command {
    constructor(planner, points, configId, id) {
        super();
        this.planner = planner;
        this.points = points; // array of {x, y}
        this.configId = configId;
        this.id = id;
        this.createdEntity = null;
    }

    execute() {
        if (!this.createdEntity) {
            this.createdEntity = new PremiumHipRoof(this.planner, this.points, this.configId);
            this.createdEntity.id = this.id;
        }
        
        this.planner.roofs.push(this.createdEntity);
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

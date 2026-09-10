/**
 * src/core/commands/CreateRoofCommand.js
 */
import { Command } from './Command.js';
import { RoofEngine } from '../roof/index.js';

export class CreateRoofCommand extends Command {
    constructor(planner, points, config = {}, id = null) {
        super();
        this.planner = planner;
        this.points = points; // array of {x, y}
        this.config = typeof config === 'string' ? { material: config } : (config || {});
        this.id = id;
        this.createdEntity = null;
    }

    execute() {
        if (!this.createdEntity) {
            this.createdEntity = RoofEngine.createRoof(this.planner, this.points, this.config, {
                id: this.id,
                addToPlanner: false
            });
            if (this.createdEntity && this.id) {
                this.createdEntity.id = this.id;
            }
        }
        
        if (this.createdEntity) {
            if (!this.planner.roofs) this.planner.roofs = [];
            if (!this.planner.roofs.includes(this.createdEntity)) {
                this.planner.roofs.push(this.createdEntity);
            }
            if (this.createdEntity.group && typeof this.createdEntity.group.show === 'function') {
                this.createdEntity.group.show();
            }
            RoofEngine.notifyRoofUpdated(this.createdEntity, this.planner, 'create');
        }
        this.planner.syncAll();
    }

    undo() {
        if (!this.createdEntity) return;
        RoofEngine.deleteRoof(this.planner, this.createdEntity);
        this.planner.syncAll();
    }
}

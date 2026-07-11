import { Command } from './Command.js';

export class CreateCommand extends Command {
    constructor(planner, type, config) {
        super();
        this.planner = planner;
        this.type = type;
        this.config = config;
        this.entityState = null;
        this.entityId = null;
    }

    execute() {
        if (!this.entityState) {
            // First time execution, create brand new
            const entity = this.planner._applyCreate(this.type, this.config);
            this.entityId = entity.id || (entity.group ? entity.group.id() : null);
            this.entityState = this.planner.exportEntityState(entity);
        } else {
            // Redo: restore from saved state
            this.planner._applyRestore(this.type, this.entityState);
        }
    }

    undo() {
        this.planner._applyDelete(this.entityId);
    }
}

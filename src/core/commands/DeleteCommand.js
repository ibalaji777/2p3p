import { Command } from './Command.js';

export class DeleteCommand extends Command {
    constructor(planner, entity) {
        super();
        this.planner = planner;
        this.entityId = entity.id || (entity.group ? entity.group.id() : null);
        this.entityState = planner.exportEntityState(entity);
        this.entityType = entity.type;
    }

    execute() {
        this.planner._applyDelete(this.entityId);
    }

    undo() {
        this.planner._applyRestore(this.entityType, this.entityState);
    }
}

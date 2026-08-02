import { Command } from './Command.js';

export class DeleteCommand extends Command {
    constructor(planner, entity) {
        super();
        this.planner = planner;
        this.entity = entity;
        this.entityId = entity ? (entity.id || (entity.group && typeof entity.group.id === 'function' ? entity.group.id() : null)) : null;
        this.entityState = (planner && typeof planner.exportEntityState === 'function') ? planner.exportEntityState(entity) : null;
        this.entityType = entity ? entity.type : null;
    }

    execute() {
        this.planner._applyDelete(this.entityId || this.entity);
    }

    undo() {
        if (this.planner && typeof this.planner._applyRestore === 'function') {
            this.planner._applyRestore(this.entityType, this.entityState);
        }
    }
}

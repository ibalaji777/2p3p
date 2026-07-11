import { Command } from './Command.js';

export class ResizeCommand extends Command {
    constructor(planner, entityId, startValues, endValues) {
        super();
        this.planner = planner;
        this.entityId = entityId;
        this.startValues = { ...startValues };
        this.endValues = { ...endValues };
    }

    execute() {
        this.planner._applyResize(this.entityId, this.endValues);
    }

    undo() {
        this.planner._applyResize(this.entityId, this.startValues);
    }
}

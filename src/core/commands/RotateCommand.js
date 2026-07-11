import { Command } from './Command.js';

export class RotateCommand extends Command {
    constructor(planner, entityId, startRot, endRot) {
        super();
        this.planner = planner;
        this.entityId = entityId;
        this.startRot = startRot;
        this.endRot = endRot;
    }

    execute() {
        this.planner._applyRotate(this.entityId, this.endRot);
    }

    undo() {
        this.planner._applyRotate(this.entityId, this.startRot);
    }
}

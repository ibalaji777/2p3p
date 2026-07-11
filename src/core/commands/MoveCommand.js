import { Command } from './Command.js';
import { EVENTS } from '../constants/events.js';

export class MoveCommand extends Command {
    constructor(planner, entityId, startPos, endPos) {
        super();
        this.planner = planner;
        this.entityId = entityId;
        this.startPos = { ...startPos };
        this.endPos = { ...endPos };
    }

    execute() {
        this.planner._applyMove(this.entityId, this.endPos.x, this.endPos.y);
    }

    undo() {
        this.planner._applyMove(this.entityId, this.startPos.x, this.startPos.y);
    }
}

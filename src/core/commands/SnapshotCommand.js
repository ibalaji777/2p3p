import { Command } from './Command.js';

export class SnapshotCommand extends Command {
    constructor(planner) {
        super();
        this.planner = planner;
        this.stateBefore = planner.exportState();
        this.stateAfter = null;
        this.isFirstExecution = true;
    }
    
    finalize() {
        this.stateAfter = this.planner.exportState();
        return this.stateBefore !== this.stateAfter;
    }

    execute() {
        if (!this.isFirstExecution && this.stateAfter) {
            this.planner.importState(this.stateAfter);
            this.planner.syncAll();
        }
        this.isFirstExecution = false;
    }

    undo() {
        if (this.stateBefore) {
            this.planner.importState(this.stateBefore);
            this.planner.syncAll();
        }
    }
}

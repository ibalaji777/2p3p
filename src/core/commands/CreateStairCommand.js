/**
 * src/core/commands/CreateStairCommand.js
 */
import { Command } from './Command.js';
import { StairEngine } from '../stairs/StairEngine.js';

export class CreateStairCommand extends Command {
    constructor(planner, options = {}, id) {
        super();
        this.planner = planner;
        this.options = { ...options };
        if (id) this.options.id = id;
        this.createdEntity = null;
        this.serializedState = null;
    }

    execute() {
        if (this.serializedState) {
            this.createdEntity = StairEngine.deserialize(this.planner, this.serializedState);
            if (!this.planner.stairs) this.planner.stairs = [];
            if (!this.planner.stairs.includes(this.createdEntity)) {
                this.planner.stairs.push(this.createdEntity);
            }
            if (this.createdEntity.group && typeof this.createdEntity.group.show === 'function') {
                this.createdEntity.group.show();
            }
            if (typeof this.planner.syncAll === 'function') {
                this.planner.syncAll();
            }
            return;
        }

        if (!this.createdEntity) {
            this.createdEntity = StairEngine.createStair(this.planner, {
                ...this.options,
                addToPlanner: true
            });
            this.serializedState = StairEngine.serialize(this.createdEntity);
        }

        if (this.createdEntity.group && typeof this.createdEntity.group.show === 'function') {
            this.createdEntity.group.show();
        }

        if (typeof this.planner.syncAll === 'function') {
            this.planner.syncAll();
        }
    }

    undo() {
        if (!this.createdEntity) return;

        this.serializedState = StairEngine.serialize(this.createdEntity);
        StairEngine.deleteStair(this.planner, this.createdEntity);
        this.createdEntity = null;

        if (typeof this.planner.syncAll === 'function') {
            this.planner.syncAll();
        }
    }
}

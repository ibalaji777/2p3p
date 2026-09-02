/**
 * src/core/commands/CreateWallCommand.js
 */
import { Command } from './Command.js';
import { WallFactory } from '../../features/wall/wall.factory.js';

export class CreateWallCommand extends Command {
    constructor(planner, startPos, endPos, type = 'outer', id) {
        super();
        this.planner = planner;
        this.startPos = { ...startPos };
        this.endPos = { ...endPos };
        this.type = type;
        this.id = id;
        this.createdEntity = null;
    }

    execute() {
        if (!this.createdEntity) {
            this.createdEntity = WallFactory.createWall(this.planner, {
                start: this.startPos,
                end: this.endPos,
                type: this.type,
                id: this.id,
                addToPlanner: false
            });
        }
        
        this.planner.walls.push(this.createdEntity);
        this.planner.syncAll();
    }

    undo() {
        if (!this.createdEntity) return;
        WallFactory.destroyWall(this.planner, this.createdEntity);
    }
}

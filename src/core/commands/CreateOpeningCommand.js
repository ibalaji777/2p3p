/**
 * src/core/commands/CreateOpeningCommand.js
 */
import { Command } from './Command.js';
import { WallEngine } from '../wall/WallEngine.js';

export class CreateOpeningCommand extends Command {
    constructor(planner, type, wallId, x, configId, id) {
        super();
        this.planner = planner;
        this.type = type; // 'door' or 'window'
        this.wallId = wallId;
        this.x = x; // distance along the wall
        this.configId = configId;
        this.id = id;
        this.createdEntity = null;
        this.serializedState = null;
        this.wall = null;
    }

    execute() {
        if (!this.wall) {
            const allEntities = this.planner.getEntities ? this.planner.getEntities() : [];
            this.wall = allEntities.find(e => e.id === this.wallId) || (this.planner.walls && this.planner.walls.find(w => w.id === this.wallId));
            if (!this.wall) throw new Error('Wall not found for opening');
        }

        if (this.serializedState) {
            this.createdEntity = WallEngine.deserializeWidget(this.planner, this.wall, this.serializedState);
            WallEngine.attachWidget(this.wall, this.createdEntity, false, this.planner);
        } else if (!this.createdEntity) {
            const wallLength = typeof this.wall.getLength === 'function' ? this.wall.getLength() : 400;
            const t = this.x > 1 ? this.x / wallLength : this.x;
            const config = this.configId || this.type;
            this.createdEntity = WallEngine.createWidget(this.planner, this.wall, t, config, {
                id: this.id,
                attach: true,
                shouldSync: false
            });
            this.serializedState = WallEngine.serializeWidget(this.createdEntity);
        } else {
            WallEngine.attachWidget(this.wall, this.createdEntity, false, this.planner);
        }
        
        this.planner.syncAll();
    }

    undo() {
        if (!this.createdEntity) return;
        this.serializedState = WallEngine.serializeWidget(this.createdEntity);
        WallEngine.deleteWidget(this.planner, this.wall, this.createdEntity, false);
        this.createdEntity = null;
        this.planner.syncAll();
    }
}

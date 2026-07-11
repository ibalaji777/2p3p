/**
 * src/core/commands/CreateOpeningCommand.js
 */
import { Command } from './Command.js';
import { PremiumWidget } from '../engine2d/PremiumWidget.js';

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
        this.wall = null;
    }

    execute() {
        if (!this.wall) {
            const allEntities = this.planner.getEntities ? this.planner.getEntities() : [];
            this.wall = allEntities.find(e => e.id === this.wallId);
            if (!this.wall) throw new Error('Wall not found for opening');
        }

        if (!this.createdEntity) {
            // Determine the class based on type
            const wallLength = this.wall.getLength();
            const t = this.x > 1 ? this.x / wallLength : this.x; // if x > 1 assume it's distance, else it's ratio
            this.createdEntity = new PremiumWidget(this.planner, this.wall, t, this.configId);
            this.createdEntity.id = this.id;
            this.createdEntity.parentWallId = this.wallId;
            this.createdEntity.parentWall = this.wall;
            
            // Calculate absolute position based on wall and local x
            // A simple approximation for the command if the engine handles attaching automatically
        }
        
        if (this.type === 'door') {
            this.planner.doors.push(this.createdEntity);
        } else {
            this.planner.windows.push(this.createdEntity);
        }
        
        // Attach to wall
        if (!this.wall.attachedWidgets) this.wall.attachedWidgets = [];
        this.wall.attachedWidgets.push(this.createdEntity);
        
        this.planner.syncAll();
    }

    undo() {
        if (!this.createdEntity) return;
        this.createdEntity.remove();
        // Remove from wall
        if (this.wall && this.wall.attachedWidgets) {
            this.wall.attachedWidgets = this.wall.attachedWidgets.filter(w => w !== this.createdEntity);
        }
        this.planner.syncAll();
    }
}

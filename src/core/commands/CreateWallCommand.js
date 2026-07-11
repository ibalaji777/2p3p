/**
 * src/core/commands/CreateWallCommand.js
 */
import { Command } from './Command.js';
import { PremiumWall } from '../../features/wall/wall.renderer2d.js';

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
            // It's the first execution, create the wall
            const a1 = this.planner.getOrCreateAnchor(this.startPos.x, this.startPos.y);
            const a2 = this.planner.getOrCreateAnchor(this.endPos.x, this.endPos.y);
            
            // Create the appropriate wall type
            this.createdEntity = new PremiumWall(this.planner, a1, a2, this.type);
            this.createdEntity.id = this.id;
        }
        
        this.planner.walls.push(this.createdEntity);
        
        this.planner.syncAll();
    }

    undo() {
        if (!this.createdEntity) return;
        
        // Remove from planner arrays
        this.planner.walls = this.planner.walls.filter(w => w !== this.createdEntity);
        
        // Call destroy if it exists
        if (typeof this.createdEntity.destroy === 'function') {
            this.createdEntity.destroy();
        } else if (typeof this.createdEntity.remove === 'function') {
            this.createdEntity.remove();
        } else if (this.createdEntity.group) {
            this.createdEntity.group.visible(false);
        }
        
        this.planner.syncAll();
    }
}

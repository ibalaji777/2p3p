/**
 * src/core/commands/DuplicateEntityCommand.js
 */
import { Command } from './Command.js';
import { ValidationLayer } from '../api/ValidationLayer.js';
import { PremiumFurniture } from '../../features/furniture/furniture.renderer2d.js';

export class DuplicateEntityCommand extends Command {
    constructor(planner, entityId, id) {
        super();
        this.planner = planner;
        this.entityId = entityId;
        this.id = id;
        this.createdEntity = null;
    }

    execute() {
        if (!this.createdEntity) {
            const sourceEntity = ValidationLayer.findEntity(this.planner, this.entityId);
            if (!sourceEntity) throw new Error('Source entity not found for duplication');

            // Quick deep copy simulation for the duplicated entity based on serialized state
            // FloorPlanner typically has an export/import flow, but for a single entity we approximate
            if (sourceEntity.constructor.name === 'PremiumFurniture') {
                this.createdEntity = new PremiumFurniture(
                    this.planner, 
                    sourceEntity.group ? sourceEntity.group.x() + 20 : 0, 
                    sourceEntity.group ? sourceEntity.group.y() + 20 : 0, 
                    sourceEntity.config?.id
                );
                this.createdEntity.id = this.id;
                this.createdEntity.rotation = sourceEntity.rotation;
                this.createdEntity.width = sourceEntity.width;
                this.createdEntity.depth = sourceEntity.depth;
                this.createdEntity.height = sourceEntity.height;
                this.createdEntity.elevation = sourceEntity.elevation;
                if (sourceEntity.params) this.createdEntity.params = JSON.parse(JSON.stringify(sourceEntity.params));
            } else {
                throw new Error('Duplication currently only supports PremiumFurniture via AutomationAPI');
            }
        }
        
        if (this.createdEntity.constructor.name === 'PremiumFurniture') {
            this.planner.furniture.push(this.createdEntity);
        }
        
        if (this.createdEntity.group && typeof this.createdEntity.group.show === 'function') {
            this.createdEntity.group.show();
        }
        this.planner.syncAll();
    }

    undo() {
        if (!this.createdEntity) return;
        this.createdEntity.remove();
        this.planner.syncAll();
    }
}

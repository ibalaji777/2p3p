import { Command } from './Command.js';
import { ValidationLayer } from '../api/ValidationLayer.js';
import { PremiumFurniture } from '../../features/furniture/furniture.renderer2d.js';

import { StairEngine } from '../stairs/StairEngine.js';
import { StairTopologyEngine } from '../stairs/StairTopologyEngine.js';

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
            } else if (sourceEntity.constructor.name === 'PremiumStaircase' || (sourceEntity.type && sourceEntity.type.startsWith('stair_'))) {
                this.createdEntity = StairEngine.duplicateStair(this.planner, sourceEntity, { x: 30, y: 30 });
                if (this.id) this.createdEntity.id = this.id;
                return;
            } else {
                throw new Error('Duplication currently only supports PremiumFurniture and Staircases via AutomationAPI');
            }
        }
        
        if (this.createdEntity.constructor.name === 'PremiumFurniture') {
            this.planner.furniture.push(this.createdEntity);
        } else if (this.createdEntity.constructor.name === 'PremiumStaircase' || (this.createdEntity.type && this.createdEntity.type.startsWith('stair_'))) {
            if (!this.planner.stairs.includes(this.createdEntity)) {
                this.planner.stairs.push(this.createdEntity);
            }
        }
        
        if (this.createdEntity.group && typeof this.createdEntity.group.show === 'function') {
            this.createdEntity.group.show();
        }
        this.planner.syncAll();
    }

    undo() {
        if (!this.createdEntity) return;
        if (this.createdEntity.constructor?.name === 'PremiumStaircase' || (this.createdEntity.type && (this.createdEntity.type.startsWith('stair_') || this.createdEntity.type === 'stair'))) {
            StairTopologyEngine.deleteStair(this.planner, this.createdEntity);
        } else if (typeof this.createdEntity.remove === 'function') {
            this.createdEntity.remove();
        }
        this.planner.syncAll();
    }
}

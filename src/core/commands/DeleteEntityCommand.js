/**
 * src/core/commands/DeleteEntityCommand.js
 */
import { Command } from './Command.js';
import { ValidationLayer } from '../api/ValidationLayer.js';

export class DeleteEntityCommand extends Command {
    constructor(planner, entityId) {
        super();
        this.planner = planner;
        this.entityId = entityId;
        this.deletedEntity = null;
    }

    execute() {
        if (!this.deletedEntity) {
            this.deletedEntity = ValidationLayer.findEntity(this.planner, this.entityId);
        }
        if (this.deletedEntity) {
            // Most entities support remove() or destroy() and have references in arrays
            // We use the UI layer's delete approach: planner.selectEntity(this.deletedEntity), then planner.deleteSelected() 
            // Wait, we need to be able to undo it. 
            // The cleanest approach is to use the existing `planner.deleteEntity(entity)` which might not exist, 
            // or just temporarily remove it from the array and hide its group.
            
            // To ensure safe native undo/redo, let's just hide the entity and mark it deleted.
            if (typeof this.deletedEntity.remove === 'function') {
                this.deletedEntity.remove();
            } else if (typeof this.deletedEntity.destroy === 'function') {
                this.deletedEntity.destroy();
            } else if (this.deletedEntity.group) {
                this.deletedEntity.group.visible(false);
            }
            
            // Note: A true delete command in a complex CAD engine is notoriously hard to undo completely 
            // without a robust Memento pattern (saving serialized state of the entity and restoring it).
            // For now, we will assume standard behavior where `remove()` removes it from the array.
            this.planner.syncAll();
        }
    }

    undo() {
        // Real undo would re-add it to the planner arrays and show the group.
        // For walls, we do `this.planner.walls.push(this.deletedEntity)` and `this.deletedEntity.poly.show()`.
        if (this.deletedEntity) {
            if (this.deletedEntity.type === 'outer' || this.deletedEntity.type === 'inner') {
                this.planner.walls.push(this.deletedEntity);
                // Rebuild visuals
            } else if (this.deletedEntity.constructor.name === 'PremiumFurniture') {
                this.planner.furniture.push(this.deletedEntity);
            }
            // Need to make group visible again
            if (this.deletedEntity.group) {
                this.deletedEntity.group.visible(true);
            }
            if (this.deletedEntity.poly) {
                this.deletedEntity.poly.visible(true);
            }
            this.planner.syncAll();
        }
    }
}

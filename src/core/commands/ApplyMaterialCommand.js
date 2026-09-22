/**
 * src/core/commands/ApplyMaterialCommand.js
 */
import { Command } from './Command.js';
import { ValidationLayer } from '../api/ValidationLayer.js';
import { MaterialEngine } from '../materials/MaterialEngine.js';

export class ApplyMaterialCommand extends Command {
    constructor(planner, entityId, face, materialId, oldMaterialId) {
        super();
        this.planner = planner;
        this.entityId = entityId;
        this.face = face; // e.g. 'front', 'back', 'top', or undefined for whole entity
        this.materialId = materialId;
        this.oldMaterialId = oldMaterialId;
    }

    execute() {
        const entity = ValidationLayer.findEntity(this.planner, this.entityId);
        if (entity) {
            this._applyMat(entity, this.materialId);
        }
    }

    undo() {
        const entity = ValidationLayer.findEntity(this.planner, this.entityId);
        if (entity) {
            this._applyMat(entity, this.oldMaterialId);
        }
    }

    _applyMat(entity, matId) {
        MaterialEngine.applyMaterial(entity, this.face, matId, {
            planner: this.planner,
            ctx: this.planner?.engine3d
        });
    }
}

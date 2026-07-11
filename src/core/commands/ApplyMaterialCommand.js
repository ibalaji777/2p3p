/**
 * src/core/commands/ApplyMaterialCommand.js
 */
import { Command } from './Command.js';
import { ValidationLayer } from '../api/ValidationLayer.js';

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
        if (!entity.params) entity.params = {};
        
        if (this.face === 'front') {
            entity.params.textureFront = matId;
            if (entity.elevationLayers && entity.elevationLayers.front) {
                entity.elevationLayers.front.forEach(layer => layer.texture = matId);
            }
        } else if (this.face === 'back') {
            entity.params.textureBack = matId;
            if (entity.elevationLayers && entity.elevationLayers.back) {
                entity.elevationLayers.back.forEach(layer => layer.texture = matId);
            }
        } else {
            entity.params.texture = matId;
            entity.params.material = matId;
            if (entity.config) entity.config.material = matId;
        }

        // Live update the 3D view if it's active
        if (this.planner.engine3d && this.planner.engine3d.gizmoManager && this.planner.engine3d.gizmoManager.updateMaterialLive) {
            this.planner.engine3d.gizmoManager.updateMaterialLive(entity);
        } else {
            this.planner.syncAll();
        }
    }
}

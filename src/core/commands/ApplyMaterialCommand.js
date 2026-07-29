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
        
        // Handle explicit face or BIM slot names
        if (this.face && this.face !== 'all') {
            const validFaceParams = ['front', 'back', 'top', 'bottom', 'left', 'right', 'doorMat', 'frameMat', 'handleMat', 'glassMat', 'fabricMat', 'cushionMat', 'legMat', 'baseMat', 'casingMat', 'trimMat', 'roofMat'];
            if (validFaceParams.includes(this.face)) {
                // Map basic face names to texture params for walls/floors
                const faceToParam = {
                    'front': 'textureFront',
                    'back': 'textureBack',
                    'top': 'textureTop',
                    'bottom': 'textureBottom',
                    'left': 'textureLeft',
                    'right': 'textureRight'
                };
                
                const paramName = faceToParam[this.face] || this.face;
                
                // BIM slots like doorMat belong on the root entity, not in params
                const rootLevelParams = ['doorMat', 'frameMat', 'handleMat', 'glassMat', 'casingMat', 'trimMat', 'roofMat'];
                if (rootLevelParams.includes(paramName)) {
                    entity[paramName] = matId;
                    console.warn(`%c[BIM Applied Area] %cMapped ${this.face} -> Root Property: %c${paramName} %c= %c${matId}`, 
                        'color: #10b981; font-weight: bold;', 'color: #9ca3af;', 'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #8b5cf6; font-weight: bold;');
                } else {
                    entity.params[paramName] = matId;
                    console.warn(`%c[BIM Applied Area] %cMapped ${this.face} -> Param Property: %c${paramName} %c= %c${matId}`, 
                        'color: #10b981; font-weight: bold;', 'color: #9ca3af;', 'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #8b5cf6; font-weight: bold;');
                }
                
                if (this.face === 'front' && entity.elevationLayers && entity.elevationLayers.front) {
                    entity.elevationLayers.front.forEach(layer => layer.texture = matId);
                } else if (this.face === 'back' && entity.elevationLayers && entity.elevationLayers.back) {
                    entity.elevationLayers.back.forEach(layer => layer.texture = matId);
                }
            } else {
                entity.params[this.face] = matId; // Fallback for custom slots
                console.warn(`%c[BIM Applied Area] %cFallback -> Param Property: %c${this.face} %c= %c${matId}`, 
                    'color: #10b981; font-weight: bold;', 'color: #9ca3af;', 'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #8b5cf6; font-weight: bold;');
            }
        } else {
            // Apply universally to base texture/material if no specific face is targeted
            entity.params.texture = matId;
            entity.params.material = matId;
            if (entity.config) entity.config.material = matId;
            console.warn(`%c[BIM Applied Area] %cGlobal Override -> Param Property: %ctexture %c= %c${matId}`, 
                'color: #ef4444; font-weight: bold;', 'color: #9ca3af;', 'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #8b5cf6; font-weight: bold;');
        }

        // Live update the 3D view if it's active
        let liveUpdated = false;
        if (this.planner.engine3d && typeof this.planner.engine3d.updateMaterialLive === 'function') {
            liveUpdated = this.planner.engine3d.updateMaterialLive(entity);
        }
        
        if (!liveUpdated) {
            this.planner.syncAll();
        }
    }
}

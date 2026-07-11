/**
 * src/core/api/CommandFactory.js
 * 
 * Translates validated JSON automation payloads into instantiated Command objects.
 */
import { MoveCommand } from '../commands/MoveCommand.js';
import { RotateCommand } from '../commands/RotateCommand.js';
import { ResizeCommand } from '../commands/ResizeCommand.js';
import { CreateWallCommand } from '../commands/CreateWallCommand.js';
import { CreateFurnitureCommand } from '../commands/CreateFurnitureCommand.js';
import { CreateOpeningCommand } from '../commands/CreateOpeningCommand.js';
import { CreateRoofCommand } from '../commands/CreateRoofCommand.js';
import { DeleteEntityCommand } from '../commands/DeleteEntityCommand.js';
import { DuplicateEntityCommand } from '../commands/DuplicateEntityCommand.js';
import { UpdatePropertyCommand } from '../commands/UpdatePropertyCommand.js';
import { ApplyMaterialCommand } from '../commands/ApplyMaterialCommand.js';
import { CompositeCommand } from '../commands/CompositeCommand.js';
import { ValidationLayer } from './ValidationLayer.js';

export class CommandFactory {
    /**
     * @param {Object} planner 
     * @param {Object} payload - Validated payload
     * @returns {Command}
     */
    static create(planner, payload) {
        switch (payload.action) {
            case 'createWall':
                return new CreateWallCommand(
                    planner, 
                    { x: payload.startX, y: payload.startY }, 
                    { x: payload.endX, y: payload.endY }, 
                    payload.type || 'outer',
                    payload.entityId || this._generateId()
                );
            case 'createDoor':
            case 'createWindow':
                return new CreateOpeningCommand(
                    planner,
                    payload.action === 'createDoor' ? 'door' : 'window',
                    payload.wallId,
                    payload.x,
                    payload.configId,
                    payload.entityId || this._generateId()
                );
            case 'createRoof':
                return new CreateRoofCommand(
                    planner,
                    payload.points,
                    payload.configId,
                    payload.entityId || this._generateId()
                );
            case 'createFurniture':
                return new CreateFurnitureCommand(
                    planner,
                    payload.x,
                    payload.y,
                    payload.configId,
                    payload.entityId || this._generateId()
                );
            case 'deleteEntity':
                return new DeleteEntityCommand(planner, payload.entityId);
            case 'duplicateEntity':
                return new DuplicateEntityCommand(planner, payload.entityId, payload.newEntityId || this._generateId());
            case 'updateProperty': {
                const entity = ValidationLayer.findEntity(planner, payload.entityId);
                let oldProps = {};
                for (const key in payload.properties) {
                    if (key.startsWith('params.') && entity.params) oldProps[key] = entity.params[key.substring(7)];
                    else if (key.startsWith('config.') && entity.config) oldProps[key] = entity.config[key.substring(7)];
                    else oldProps[key] = entity[key];
                }
                return new UpdatePropertyCommand(planner, payload.entityId, payload.properties, oldProps);
            }
            case 'applyMaterial': {
                const entity = ValidationLayer.findEntity(planner, payload.entityId);
                let oldMat = entity.params?.texture;
                if (payload.face === 'front') oldMat = entity.params?.textureFront;
                else if (payload.face === 'back') oldMat = entity.params?.textureBack;
                return new ApplyMaterialCommand(planner, payload.entityId, payload.face, payload.materialId, oldMat);
            }
            case 'moveEntity': {
                const entity = ValidationLayer.findEntity(planner, payload.entityId);
                const startPos = { x: entity.group ? entity.group.x() : entity.startAnchor.x, y: entity.group ? entity.group.y() : entity.startAnchor.y };
                return new MoveCommand(planner, payload.entityId, startPos, { x: payload.x, y: payload.y });
            }
            case 'rotateEntity': {
                const entity = ValidationLayer.findEntity(planner, payload.entityId);
                const startRot = entity.rotation || 0;
                return new RotateCommand(planner, payload.entityId, startRot, payload.rotation);
            }
            case 'resizeEntity': {
                const entity = ValidationLayer.findEntity(planner, payload.entityId);
                const startValues = { width: entity.width || entity.config?.width, depth: entity.depth || entity.config?.depth, height: entity.height || entity.config?.height, elevation: entity.elevation };
                return new ResizeCommand(planner, payload.entityId, startValues, payload.endValues);
            }
            case 'transaction': {
                const commands = payload.commands.map(cmdPayload => this.create(planner, cmdPayload));
                return new CompositeCommand(commands);
            }
            default:
                throw new Error(`Factory does not support action: ${payload.action}`);
        }
    }

    static _generateId() {
        return 'auto_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

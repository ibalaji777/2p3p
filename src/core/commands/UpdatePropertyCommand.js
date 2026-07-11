/**
 * src/core/commands/UpdatePropertyCommand.js
 */
import { Command } from './Command.js';
import { ValidationLayer } from '../api/ValidationLayer.js';

export class UpdatePropertyCommand extends Command {
    constructor(planner, entityId, properties, oldProperties) {
        super();
        this.planner = planner;
        this.entityId = entityId;
        this.properties = { ...properties };
        this.oldProperties = { ...oldProperties };
    }

    execute() {
        const entity = ValidationLayer.findEntity(this.planner, this.entityId);
        if (entity) {
            this._applyProps(entity, this.properties);
        }
    }

    undo() {
        const entity = ValidationLayer.findEntity(this.planner, this.entityId);
        if (entity) {
            this._applyProps(entity, this.oldProperties);
        }
    }

    _applyProps(entity, props) {
        for (const key in props) {
            // Support updating entity.params or entity.config
            if (key.startsWith('params.')) {
                if (!entity.params) entity.params = {};
                entity.params[key.substring(7)] = props[key];
            } else if (key.startsWith('config.')) {
                if (!entity.config) entity.config = {};
                entity.config[key.substring(7)] = props[key];
            } else {
                entity[key] = props[key];
            }
        }
        this.planner.syncAll();
    }
}

/**
 * src/core/commands/UpdatePropertyCommand.js
 */
import { Command } from './Command.js';
import { ValidationLayer } from '../api/ValidationLayer.js';
import { WallEngine } from '../wall/WallEngine.js';

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
        const isWall = entity.isWall || (entity.startAnchor && entity.endAnchor);
        if (isWall) {
            const batchProps = {};
            const otherProps = {};
            for (const key in props) {
                if (key.startsWith('params.')) {
                    if (!batchProps.params) batchProps.params = {};
                    batchProps.params[key.substring(7)] = props[key];
                } else if ([
                    'thickness', 'height', 'elevation', 'topProfileType',
                    'startHeight', 'endHeight', 'peakHeight', 'peakPos', 'flipSlope'
                ].includes(key)) {
                    batchProps[key] = props[key];
                } else {
                    otherProps[key] = props[key];
                }
            }
            WallEngine.batchUpdate(this.planner, [entity], batchProps);
            if (Object.keys(otherProps).length > 0) {
                for (const key in otherProps) {
                    if (key.startsWith('config.')) {
                        if (!entity.config) entity.config = {};
                        entity.config[key.substring(7)] = otherProps[key];
                    } else {
                        entity[key] = otherProps[key];
                    }
                }
                if (this.planner && typeof this.planner.syncAll === 'function') {
                    this.planner.syncAll();
                }
            }
            return;
        }

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
        if (this.planner && typeof this.planner.syncAll === 'function') {
            this.planner.syncAll();
        }
    }
}

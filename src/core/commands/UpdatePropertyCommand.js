/**
 * src/core/commands/UpdatePropertyCommand.js
 */
import { Command } from './Command.js';
import { ValidationLayer } from '../api/ValidationLayer.js';
import { WallEngine } from '../wall/WallEngine.js';
import { StairEngine } from '../stairs/StairEngine.js';
import { RoofEngine } from '../roof/RoofEngine.js';

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

        const isStair = entity.constructor.name === 'PremiumStaircase' || (entity.type && entity.type.startsWith('stair_'));
        if (isStair) {
            StairEngine.batchUpdate(this.planner, [entity], props);
            return;
        }

        const isRoof = entity.type === 'roof' || (entity.config && entity.config.roofType);
        if (isRoof) {
            for (const key in props) {
                const cleanKey = key.startsWith('config.') ? key.substring(7) : key;
                const val = props[key];
                if (cleanKey === 'pitch') RoofEngine.setPitch(entity, val, this.planner);
                else if (cleanKey === 'peakHeight') RoofEngine.setPeakHeight(entity, val, this.planner);
                else if (cleanKey === 'overhang') RoofEngine.setOverhang(entity, val, null, this.planner);
                else if (cleanKey === 'roofType') RoofEngine.setRoofType(entity, val, this.planner);
                else if (cleanKey === 'points') RoofEngine.setPoints(entity, val, this.planner);
                else if (cleanKey === 'rotation') RoofEngine.setRotation(entity, val, this.planner);
                else if (cleanKey === 'elevation') RoofEngine.setElevation(entity, val, this.planner);
                else if (cleanKey === 'ridgeAxis') RoofEngine.setRidgeAxis(entity, val, this.planner);
                else if (cleanKey === 'curve') RoofEngine.setCurve(entity, val, this.planner);
                else if (cleanKey === 'wallGap') RoofEngine.setWallGap(entity, val, this.planner);
                else if (cleanKey === 'thickness') RoofEngine.setThickness(entity, val, this.planner);
                else if (cleanKey === 'material') RoofEngine.setMaterial(entity, val, 'single', null, this.planner);
                else if (cleanKey === 'fasciaMaterial') RoofEngine.setMaterial(entity, val, 'single', 'fascia', this.planner);
                else if (cleanKey === 'gableMaterial') RoofEngine.setMaterial(entity, val, 'single', 'gable', this.planner);
                else if (cleanKey === 'autoShapeWalls') RoofEngine.setAutoShapeWalls(entity, val, this.planner);
                else {
                    if (key.startsWith('config.')) {
                        if (!entity.config) entity.config = {};
                        entity.config[cleanKey] = val;
                    } else {
                        entity[key] = val;
                    }
                    RoofEngine.notifyRoofUpdated(entity, this.planner);
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

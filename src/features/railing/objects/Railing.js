// src/features/railing/objects/Railing.js
import { PremiumWall } from '../../wall/wall.renderer2d.js';
import { getRailingConfig } from '../registry/railing.registry.js';

/**
 * Railing
 * Backward-compatible adapter for railing walls. Inherits directly from canonical PremiumWall.
 */
export class Railing extends PremiumWall {
    constructor(planner, startAnchor, endAnchor) {
        super(planner, startAnchor, endAnchor, 'railing');
        this.configId = planner?.activePresetParams?.type || planner?.activePresetParams?.configId || 'glass_stainless';
        this.config = getRailingConfig(this.configId);
    }

    setConfig(configId) {
        this.configId = configId;
        this.config = getRailingConfig(configId);
        if (this.config.thickness) this.thickness = this.config.thickness;
        if (this.config.height) this.height = this.config.height;
        if (this.planner && this.planner.syncAll) this.planner.syncAll();
    }
}

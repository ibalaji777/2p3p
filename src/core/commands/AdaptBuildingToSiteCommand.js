/**
 * src/core/commands/AdaptBuildingToSiteCommand.js
 * 
 * Command pattern implementation for adapting an existing building layout to a site envelope.
 * Supports atomic site configuration + adaptation with full 1-click Undo and Redo with state snapshots.
 */

import { Command } from './Command.js';
import { SiteEngine } from '../site/SiteEngine.js';
import { BuildingAdaptationEngine } from '../adaptation/BuildingAdaptationEngine.js';

export class AdaptBuildingToSiteCommand extends Command {
    /**
     * @param {Object} planner - Canonical FloorPlanner instance
     * @param {Object} [options={}] - Adaptation options (targetAreaSqFt, preserveAspectRatio, siteConfig, etc.)
     */
    constructor(planner, options = {}) {
        super();
        this.planner = planner;
        this.options = options;
        // Capture authoritative state before ANY site creation or adaptation mutation
        this.stateBefore = (planner && typeof planner.exportState === 'function') 
            ? planner.exportState() 
            : null;
        this.fallbackBefore = (!this.stateBefore && planner) ? {
            site: planner.site ? JSON.parse(JSON.stringify(planner.site)) : null,
            anchors: (planner.anchors || []).map(a => {
                const pos = typeof a.position === 'function' ? a.position() : a;
                return { anchor: a, x: pos.x, y: pos.y };
            })
        } : null;

        this.stateAfter = null;
        this.fallbackAfter = null;
        this.result = null;
        this.isFirstExecution = true;
    }

    /**
     * Executes the adaptation or re-applies the adapted state on Redo.
     * @returns {Object}
     */
    execute() {
        if (this.isFirstExecution) {
            // If site configuration was passed to be atomically applied with adaptation:
            if (this.options.siteConfig && this.planner && this.options.siteConfig.vertices) {
                SiteEngine.createSite(
                    this.planner,
                    this.options.siteConfig.vertices,
                    this.options.siteConfig
                );
            }

            this.result = BuildingAdaptationEngine.adapt(this.planner, this.options);

            if (!this.result || !this.result.success) {
                // Rollback building changes if adaptation failed
                this.undo();
                // Ensure user-configured site is preserved if siteConfig was provided
                if (this.options.siteConfig && this.planner && this.options.siteConfig.vertices) {
                    SiteEngine.createSite(
                        this.planner,
                        this.options.siteConfig.vertices,
                        this.options.siteConfig
                    );
                }
                this.isFirstExecution = false;
                return this.result || { success: false, status: 'impossible', error: 'Adaptation failed.' };
            }

            if (this.planner && typeof this.planner.exportState === 'function') {
                this.stateAfter = this.planner.exportState();
            } else if (this.planner) {
                this.fallbackAfter = {
                    site: this.planner.site ? JSON.parse(JSON.stringify(this.planner.site)) : null,
                    anchors: (this.planner.anchors || []).map(a => {
                        const pos = typeof a.position === 'function' ? a.position() : a;
                        return { anchor: a, x: pos.x, y: pos.y };
                    })
                };
            }
            this.isFirstExecution = false;
            return this.result;
        }

        if (this.stateAfter && this.planner && typeof this.planner.importState === 'function') {
            this.planner.importState(this.stateAfter);
            BuildingAdaptationEngine.sync(this.planner);
        } else if (this.fallbackAfter && this.planner) {
            this.planner.site = this.fallbackAfter.site ? JSON.parse(JSON.stringify(this.fallbackAfter.site)) : null;
            this.fallbackAfter.anchors.forEach(rec => {
                if (typeof rec.anchor.position === 'function') {
                    rec.anchor.position({ x: rec.x, y: rec.y });
                } else {
                    rec.anchor.x = rec.x;
                    rec.anchor.y = rec.y;
                }
            });
            BuildingAdaptationEngine.sync(this.planner);
        }
        return this.result;
    }

    /**
     * Reverts the plan to the pre-adaptation state.
     */
    undo() {
        if (this.stateBefore && this.planner && typeof this.planner.importState === 'function') {
            this.planner.importState(this.stateBefore);
            BuildingAdaptationEngine.sync(this.planner);
        } else if (this.fallbackBefore && this.planner) {
            this.planner.site = this.fallbackBefore.site ? JSON.parse(JSON.stringify(this.fallbackBefore.site)) : null;
            this.fallbackBefore.anchors.forEach(rec => {
                if (typeof rec.anchor.position === 'function') {
                    rec.anchor.position({ x: rec.x, y: rec.y });
                } else {
                    rec.anchor.x = rec.x;
                    rec.anchor.y = rec.y;
                }
            });
            BuildingAdaptationEngine.sync(this.planner);
        }
    }

    /**
     * Re-applies the adaptation state on Redo.
     */
    redo() {
        return this.execute();
    }
}

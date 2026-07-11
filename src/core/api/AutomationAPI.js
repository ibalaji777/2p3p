/**
 * src/core/api/AutomationAPI.js
 * 
 * The single entry point for external systems (AI, Scripts, Imports) to safely
 * interact with the FloorPlanner engine.
 */
import { ValidationLayer } from './ValidationLayer.js';
import { CommandFactory } from './CommandFactory.js';

export class AutomationAPI {
    constructor(planner) {
        this.planner = planner;
    }

    /**
     * Executes an automation payload.
     * @param {Object} payload 
     * @returns {Object} Standardized response { success: boolean, error?: string, data?: any }
     */
    execute(payload) {
        try {
            if (payload.action === 'undo') {
                this.planner.commandManager.undo();
                return { success: true };
            }
            if (payload.action === 'redo') {
                this.planner.commandManager.redo();
                return { success: true };
            }

            // 1. Validate
            ValidationLayer.validate(this.planner, payload);

            // 2. Create Command
            const command = CommandFactory.create(this.planner, payload);

            // 3. Execute
            this.planner.commandManager.execute(command);

            return { success: true, data: { action: payload.action, id: payload.entityId || command.id } };
        } catch (error) {
            console.error('[Automation API Error]:', error);
            return {
                success: false,
                error: error.message,
                action: payload?.action
            };
        }
    }

    /**
     * Queries engine state safely.
     */
    query(action, params = {}) {
        try {
            switch (action) {
                case 'getEntities':
                    return { success: true, data: this.planner.getEntities ? this.planner.getEntities() : [] };
                case 'getEntity':
                    return { success: true, data: ValidationLayer.findEntity(this.planner, params.id) };
                case 'getSelection':
                    return { success: true, data: this.planner.getSelection ? this.planner.getSelection() : [] };
                case 'getSceneState':
                    return { success: true, data: JSON.parse(this.planner.exportState()) };
                case 'getRooms':
                    return { success: true, data: this.planner.getRooms ? this.planner.getRooms() : [] };
                case 'getWalls':
                    return { success: true, data: this.planner.getWalls ? this.planner.getWalls() : [] };
                default:
                    return { success: false, error: `Unsupported query action: ${action}` };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

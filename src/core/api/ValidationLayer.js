/**
 * src/core/api/ValidationLayer.js
 * 
 * Validates Automation API payloads before they are converted into Commands.
 * Throws structured errors if validation fails.
 */

export class ValidationLayer {
    /**
     * @param {Object} planner - The FloorPlanner instance
     * @param {Object} payload - The command payload from external system
     */
    static validate(planner, payload, context) {
        if (!context) context = { pendingEntities: new Set() };
        if (!payload || typeof payload !== 'object') {
            throw new Error('Payload must be a valid JSON object.');
        }

        if (!payload.action || typeof payload.action !== 'string') {
            throw new Error('Payload must include an "action" string property.');
        }

        if (!payload.action) {
            throw new Error('Payload must contain an "action" field.');
        }

        // Keep track of entities created in this transaction to bypass strict existence checks
        if (payload.action.startsWith('create') && payload.entityId) {
            context.pendingEntities.add(payload.entityId);
        }

        if (payload.action === 'transaction') {
            if (!Array.isArray(payload.commands)) {
                throw new Error('transaction requires a commands array.');
            }
            // Validate all sub-commands, passing the shared context
            payload.commands.forEach((cmd, idx) => {
                try {
                    this.validate(planner, cmd, context);
                } catch (e) {
                    console.error('Inner validation error:', e.stack);
                    throw new Error(`Transaction validation failed at command ${idx}: ${e.message}`);
                }
            });
            return;
        }

        if (payload.action.startsWith('create')) {
            this._validateCreation(planner, payload, context);
        } else if (['undo', 'redo'].includes(payload.action)) {
            // No payload validation needed
        } else {
            this._validateModification(planner, payload, context);
        }
    }

    static _validateCreation(planner, payload, context) {
        if (payload.action === 'createWall') {
            if (typeof payload.startX !== 'number' || typeof payload.startY !== 'number' || 
                typeof payload.endX !== 'number' || typeof payload.endY !== 'number') {
                throw new Error('createWall requires startX, startY, endX, and endY as numbers.');
            }
        }
        if (payload.action === 'createFurniture') {
            if (typeof payload.x !== 'number' || typeof payload.y !== 'number' || !payload.configId) {
                throw new Error('createFurniture requires x, y, and configId.');
            }
        }
        // Additional create validation rules can be added here
        if (payload.action === 'createDoor' || payload.action === 'createWindow') {
            if (!payload.wallId || typeof payload.x !== 'number' || !payload.configId) {
                throw new Error(`${payload.action} requires wallId, x, and configId.`);
            }
            if (!context.pendingEntities.has(payload.wallId) && !this.findEntity(planner, payload.wallId)) {
                throw new Error(`Wall with ID ${payload.wallId} not found.`);
            }
        }
        if (payload.action === 'createRoof') {
            if (!Array.isArray(payload.points) || payload.points.length < 3) {
                throw new Error('createRoof requires an array of points (min 3).');
            }
        }
    }

    static _validateModification(planner, payload, context) {
        if (!payload.entityId) {
            throw new Error(`${payload.action} requires an entityId.`);
        }
        
        // Ensure entity exists (unless it was created earlier in the same transaction)
        if (!context.pendingEntities.has(payload.entityId)) {
            const entity = this.findEntity(planner, payload.entityId);
            if (!entity) {
                throw new Error(`Entity with ID ${payload.entityId} not found.`);
            }
        }

        if (payload.action === 'moveEntity') {
            if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
                throw new Error('moveEntity requires x and y coordinates.');
            }
        }
        
        if (payload.action === 'rotateEntity') {
            if (typeof payload.rotation !== 'number') {
                throw new Error('rotateEntity requires a rotation value (number).');
            }
        }

        if (payload.action === 'resizeEntity') {
            if (!payload.endValues || typeof payload.endValues !== 'object') {
                throw new Error('resizeEntity requires endValues object.');
            }
        }

        if (payload.action === 'updateProperty') {
            if (!payload.properties || typeof payload.properties !== 'object') {
                throw new Error('updateProperty requires properties object.');
            }
        }

        if (payload.action === 'applyMaterial') {
            if (!payload.materialId) {
                throw new Error('applyMaterial requires materialId.');
            }
        }
    }

    static findEntity(planner, id) {
        // Search through standard engine collections
        const allEntities = planner.getEntities ? planner.getEntities() : [];
        return allEntities.find(e => e.id === id);
    }
}

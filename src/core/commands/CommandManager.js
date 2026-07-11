import { EVENTS } from '../constants/events.js';
import { coreEventBus } from '../EventBus.js';

export class CommandManager {
    constructor(limit = 100) {
        this.undoStack = [];
        this.redoStack = [];
        this.limit = limit;
    }

    execute(command) {
        command.execute();
        this.undoStack.push(command);
        
        // Clear redo stack on new action
        this.redoStack = [];

        // Enforce limit
        if (this.undoStack.length > this.limit) {
            this.undoStack.shift();
        }

        if (typeof window !== 'undefined') {
            coreEventBus.emit(EVENTS.HISTORY_CHANGED);
            coreEventBus.emit(EVENTS.SCENE_CHANGED);
        }
    }

    undo() {
        if (this.undoStack.length === 0) return;
        
        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);
        
        if (typeof window !== 'undefined') {
            coreEventBus.emit(EVENTS.HISTORY_CHANGED);
            coreEventBus.emit(EVENTS.SCENE_CHANGED);
        }
    }

    redo() {
        if (this.redoStack.length === 0) return;
        
        const command = this.redoStack.pop();
        command.execute();
        this.undoStack.push(command);
        
        if (typeof window !== 'undefined') {
            coreEventBus.emit(EVENTS.HISTORY_CHANGED);
            coreEventBus.emit(EVENTS.SCENE_CHANGED);
        }
    }
}

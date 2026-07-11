import { EVENTS } from '../constants/events.js';

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
            window.dispatchEvent(new CustomEvent(EVENTS.HISTORY_CHANGED));
        }
    }

    undo() {
        if (this.undoStack.length === 0) return;
        
        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);
        
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(EVENTS.HISTORY_CHANGED));
        }
    }

    redo() {
        if (this.redoStack.length === 0) return;
        
        const command = this.redoStack.pop();
        command.execute();
        this.undoStack.push(command);
        
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(EVENTS.HISTORY_CHANGED));
        }
    }
}

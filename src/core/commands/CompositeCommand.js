/**
 * src/core/commands/CompositeCommand.js
 * 
 * Supports executing multiple commands atomically.
 * If one command fails, all previously executed commands in the transaction are undone.
 */
export class CompositeCommand {
    constructor(commands = []) {
        this.commands = commands;
        this.executedCommands = [];
    }

    execute() {
        try {
            for (let cmd of this.commands) {
                cmd.execute();
                this.executedCommands.push(cmd);
            }
        } catch (error) {
            // Rollback
            this.undo();
            throw new Error(`CompositeCommand execution failed: ${error.message}`);
        }
    }

    undo() {
        // Undo in reverse order
        for (let i = this.executedCommands.length - 1; i >= 0; i--) {
            this.executedCommands[i].undo();
        }
        this.executedCommands = [];
    }
}

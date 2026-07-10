/**
 * wall.commands.js
 * Formalized commands for mutating walls to replace direct state mutation.
 */

export class Command {
    execute() { throw new Error("Must implement execute()"); }
    undo() { throw new Error("Must implement undo()"); }
}

export class DrawWallCommand extends Command {
    constructor(planner, startAnchor, endAnchor, type) {
        super();
        this.planner = planner;
        this.startAnchor = startAnchor;
        this.endAnchor = endAnchor;
        this.type = type;
        this.wall = null;
    }

    execute() {
        // Implementation for drawing a wall will be defined here
    }

    undo() {
        // Implementation for removing the wall will be defined here
    }
}

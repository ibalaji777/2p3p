/**
 * wall.commands.js
 * Formalized commands for mutating walls to replace direct state mutation.
 */

import { WallFactory } from './wall.factory.js';

export class DrawWallCommand {
    constructor(planner, startAnchor, endAnchor, type = 'outer', options = {}) {
        this.planner = planner;
        this.startAnchor = startAnchor;
        this.endAnchor = endAnchor;
        this.type = type;
        this.options = options;
        this.wall = null;
    }

    execute() {
        if (!this.wall) {
            this.wall = WallFactory.createWall(this.planner, {
                startAnchor: this.startAnchor,
                endAnchor: this.endAnchor,
                type: this.type,
                ...this.options
            });
        } else {
            this.planner.walls.push(this.wall);
            this.planner.syncAll();
        }
        return this.wall;
    }

    undo() {
        if (!this.wall) return;
        WallFactory.destroyWall(this.planner, this.wall);
    }
}


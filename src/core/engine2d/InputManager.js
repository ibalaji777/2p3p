
import { setupDragEvents } from './DragEvents.js';
import { setupPointerEvents } from './PointerEvents.js';
import { setupSelectionEvents } from './SelectionEvents.js';
import { setupDrawingEvents } from './DrawingEvents.js';

/**
 * Central orchestrator for all 2D Engine user input.
 */
export class InputManager {
    /**
     * @param {Object} planner - The FloorPlanner instance.
     */
    constructor(planner) {
        this.planner = planner;
        this.setupAllEvents();
    }
    
    /**
     * Initializes all event modules.
     */
    setupAllEvents() {
        setupDrawingEvents(this.planner);
        setupSelectionEvents(this.planner);
        setupDragEvents(this.planner);
        setupPointerEvents(this.planner);
        
        this._handleGlobalKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (this.planner && this.planner.finishChain) {
                    this.planner.finishChain();
                }
            }
        };
        window.addEventListener('keydown', this._handleGlobalKeyDown);
    }
    
    /**
     * Cleans up global events on destroy.
     */
    destroy() {
        if (this._handleGlobalKeyDown) {
            window.removeEventListener('keydown', this._handleGlobalKeyDown);
        }
    }
}

/**
 * A lightweight, centralized publish-subscribe EventBus.
 * Used to decouple application events from the global window DOM object.
 */
class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event.
     * @param {string} event - The name of the event to listen for.
     * @param {Function} callback - The function to call when the event is emitted.
     * @returns {Function} - An unsubscribe function that can be called to remove the listener.
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        
        return () => {
            this.off(event, callback);
        };
    }

    /**
     * Unsubscribe from an event.
     * @param {string} event - The name of the event.
     * @param {Function} callback - The original callback function to remove.
     */
    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
        
        // Clean up empty event arrays to prevent memory leaks over time
        if (this.events[event].length === 0) {
            delete this.events[event];
        }
    }

    /**
     * Emit an event to all subscribers.
     * @param {string} event - The name of the event to emit.
     * @param {any} [data] - Optional data payload to pass to the listeners.
     */
    emit(event, data) {
        if (!this.events[event]) return;
        
        // Create a shallow copy to prevent issues if a listener unsubscribes during execution
        const callbacks = [...this.events[event]];
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error executing event listener for ${event}:`, error);
            }
        });
    }
}

export const coreEventBus = new EventBus();

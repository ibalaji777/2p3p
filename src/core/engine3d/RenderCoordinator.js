import * as THREE from 'three';

/**
 * RenderCoordinator
 * 
 * Centralized authority for scheduling viewport updates across the 3D engine.
 * Coalesces render requests from all subsystems into a single requestAnimationFrame pass,
 * preserving GPU efficiency while guaranteeing immediate visual updates for all scene modifications.
 */
export class RenderCoordinator {
    static instances = new Set();
    static hooksInstalled = false;

    constructor(engine) {
        this.engine = engine;
        this.dirtyFrames = 0;
        this.continuousSources = new Set();
        this.isDisposed = false;

        RenderCoordinator.instances.add(this);
        RenderCoordinator.installGlobalHooks();
    }

    /**
     * Submit a render request for one or more frames.
     * @param {string} reason - Descriptive cause for invalidation (debugging & logging)
     * @param {number} frames - Number of frames to schedule (default 2 for microtask safety)
     */
    notifyChange(reason = 'unspecified', frames = 2) {
        if (this.isDisposed) return;
        this.dirtyFrames = Math.max(this.dirtyFrames, frames);
    }

    /**
     * Start continuous rendering driven by an active source (e.g. orbit controls damping, gizmo drag).
     * @param {string} sourceId 
     */
    startContinuousRender(sourceId) {
        if (this.isDisposed) return;
        this.continuousSources.add(sourceId);
    }

    /**
     * Stop continuous rendering for a given source.
     * @param {string} sourceId 
     */
    stopContinuousRender(sourceId) {
        if (this.isDisposed) return;
        this.continuousSources.delete(sourceId);
        // Schedule a trailing frame to ensure final state is rendered cleanly
        this.notifyChange('continuous_stop_trailer', 2);
    }

    /**
     * Returns true if the viewport needs a render pass this frame.
     * @returns {boolean}
     */
    shouldRender() {
        return this.dirtyFrames > 0 || this.continuousSources.size > 0 || this.engine.isUpdatingFromUI;
    }

    /**
     * Called at the end of each frame render pass to decrement dirty frames counter.
     */
    onFrameRendered() {
        if (this.dirtyFrames > 0) {
            this.dirtyFrames--;
        }
    }

    /**
     * Clean up coordinator resources.
     */
    dispose() {
        this.isDisposed = true;
        RenderCoordinator.instances.delete(this);
        this.continuousSources.clear();
    }

    /**
     * Notify all active RenderCoordinator instances of a global scene/material/texture change.
     * @param {string} reason 
     * @param {number} frames 
     */
    static notifyGlobalChange(reason = 'global_change', frames = 2) {
        for (const coordinator of RenderCoordinator.instances) {
            coordinator.notifyChange(reason, frames);
        }
    }

    /**
     * Legacy global hooks removed in favor of explicit requestRender() calls
     * driven by the Dirty Flag system.
     */
    static installGlobalHooks() {
        if (RenderCoordinator.hooksInstalled) return;
        RenderCoordinator.hooksInstalled = true;
        
        console.info('%c[RenderCoordinator] %cGlobal architecture hooks removed. Using explicit dirty flags.', 
            'color: #10b981; font-weight: bold;', 'color: #9ca3af;');
    }
}

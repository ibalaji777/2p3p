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
     * Installs global monkey-patches on THREE.Object3D, THREE.Material, and THREE.Texture.
     * Guaranteed to run only once.
     */
    static installGlobalHooks() {
        if (RenderCoordinator.hooksInstalled) return;
        RenderCoordinator.hooksInstalled = true;

        // 1. Hook Object3D scene graph mutations (add, remove, clear, attach)
        const origAdd = THREE.Object3D.prototype.add;
        THREE.Object3D.prototype.add = function (...objects) {
            const res = origAdd.apply(this, objects);
            RenderCoordinator.notifyGlobalChange('object_added');
            return res;
        };

        const origRemove = THREE.Object3D.prototype.remove;
        THREE.Object3D.prototype.remove = function (...objects) {
            const res = origRemove.apply(this, objects);
            RenderCoordinator.notifyGlobalChange('object_removed');
            return res;
        };

        const origClear = THREE.Object3D.prototype.clear;
        THREE.Object3D.prototype.clear = function () {
            const res = origClear.apply(this);
            RenderCoordinator.notifyGlobalChange('object_cleared');
            return res;
        };

        const origAttach = THREE.Object3D.prototype.attach;
        THREE.Object3D.prototype.attach = function (object) {
            const res = origAttach.call(this, object);
            RenderCoordinator.notifyGlobalChange('object_attached');
            return res;
        };

        // 2. Hook Object3D.visible setter safely
        const origVisibleDesc = Object.getOwnPropertyDescriptor(THREE.Object3D.prototype, 'visible');
        let _visibleSymbol = Symbol('visible');
        
        Object.defineProperty(THREE.Object3D.prototype, 'visible', {
            get() {
                if (origVisibleDesc && origVisibleDesc.get) return origVisibleDesc.get.call(this);
                return this[_visibleSymbol] !== undefined ? this[_visibleSymbol] : true;
            },
            set(val) {
                const prev = this.visible;
                if (origVisibleDesc && origVisibleDesc.set) {
                    origVisibleDesc.set.call(this, val);
                } else {
                    this[_visibleSymbol] = val;
                }
                if (prev !== val) {
                    RenderCoordinator.notifyGlobalChange('visibility_changed');
                }
            },
            configurable: true,
            enumerable: true
        });

        // 3. Hook Material.needsUpdate setter PRESERVING Three.js native version++ logic
        const matNeedsUpdateDesc = Object.getOwnPropertyDescriptor(THREE.Material.prototype, 'needsUpdate');
        if (matNeedsUpdateDesc) {
            Object.defineProperty(THREE.Material.prototype, 'needsUpdate', {
                get() {
                    return matNeedsUpdateDesc.get ? matNeedsUpdateDesc.get.call(this) : false;
                },
                set(val) {
                    if (matNeedsUpdateDesc.set) {
                        matNeedsUpdateDesc.set.call(this, val);
                    }
                    if (val) {
                        RenderCoordinator.notifyGlobalChange('material_needs_update');
                    }
                },
                configurable: true,
                enumerable: true
            });
        }

        // 4. Hook Texture.needsUpdate setter PRESERVING Three.js native version++ & source.version++ logic
        const texNeedsUpdateDesc = Object.getOwnPropertyDescriptor(THREE.Texture.prototype, 'needsUpdate');
        if (texNeedsUpdateDesc) {
            Object.defineProperty(THREE.Texture.prototype, 'needsUpdate', {
                get() {
                    return texNeedsUpdateDesc.get ? texNeedsUpdateDesc.get.call(this) : false;
                },
                set(val) {
                    if (texNeedsUpdateDesc.set) {
                        texNeedsUpdateDesc.set.call(this, val);
                    }
                    if (val) {
                        RenderCoordinator.notifyGlobalChange('texture_needs_update');
                    }
                },
                configurable: true,
                enumerable: true
            });
        }

        console.info('%c[RenderCoordinator] %cGlobal architecture hooks installed safely.', 
            'color: #10b981; font-weight: bold;', 'color: #9ca3af;');
    }
}

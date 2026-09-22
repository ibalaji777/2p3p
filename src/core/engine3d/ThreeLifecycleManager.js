import { ComponentRegistry } from './ComponentRegistry.js';

/**
 * ThreeLifecycleManager
 * 
 * Centralized Three.js Resource Lifecycle, Disposal, and Interactables Management.
 * 
 * Solves:
 * 1. WebGL memory leaks from orphaned Geometries, Materials, and Textures during 3D live dragging.
 * 2. Ghost hitboxes and raycast target pollution in ctx.interactables.
 * 3. Stale mesh reference retention in ComponentRegistry.
 * 4. Safe preservation of cached textures and keepAlive assets.
 */
export class ThreeLifecycleManager {

    /**
     * Safely disposes a THREE.Object3D hierarchy.
     * 
     * @param {THREE.Object3D} obj - Root object to dispose
     * @param {Object} [options={}] - Options
     * @param {Array} [options.interactables] - ctx.interactables array to clean up in-place
     * @param {boolean} [options.disposeMaterials=true] - Whether to dispose materials
     * @param {boolean} [options.disposeTextures=true] - Whether to dispose custom texture maps
     */
    static disposeHierarchy(obj, options = {}) {
        if (!obj) return;
        if (obj.userData && obj.userData.keepAlive) return;

        const interactables = options.interactables;
        const disposeMaterials = options.disposeMaterials !== false;
        const disposeTextures = options.disposeTextures !== false;

        const objectsToPurge = new Set();

        obj.traverse(c => {
            if (!c) return;
            if (c.userData && c.userData.keepAlive) return;

            objectsToPurge.add(c);

            // 1. Dispose Geometry
            if (c.geometry && !c.geometry.userData?.keepAlive) {
                if (typeof c.geometry.dispose === 'function') {
                    c.geometry.dispose();
                }
            }

            // 2. Dispose Material(s)
            if (disposeMaterials && c.material) {
                const mats = Array.isArray(c.material) ? c.material : [c.material];
                mats.forEach(m => {
                    if (!m || m.userData?.keepAlive) return;

                    if (disposeTextures) {
                        const texSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'bumpMap', 'alphaMap'];
                        texSlots.forEach(slot => {
                            const tex = m[slot];
                            if (tex && tex.isTexture && !tex.userData?.keepAlive && tex._disposable) {
                                if (typeof tex.dispose === 'function') tex.dispose();
                            }
                        });
                    }

                    if (typeof m.dispose === 'function') {
                        m.dispose();
                    }
                });
            }
        });

        // 3. Purge from Interactables
        if (Array.isArray(interactables) && objectsToPurge.size > 0) {
            for (let i = interactables.length - 1; i >= 0; i--) {
                if (objectsToPurge.has(interactables[i])) {
                    interactables.splice(i, 1);
                }
            }
        }

        // 4. Detach from Scene Graph
        if (obj.parent) {
            obj.parent.remove(obj);
        }
    }

    /**
     * Purges all raycast targets linked to an entity from an interactables array.
     * 
     * @param {Array} interactables - The ctx.interactables array
     * @param {Object|string} entityOrId - Domain entity or entity ID
     */
    static purgeEntityInteractables(interactables, entityOrId) {
        if (!interactables || !Array.isArray(interactables)) return;

        const entityId = typeof entityOrId === 'object' ? entityOrId?.id : entityOrId;

        for (let i = interactables.length - 1; i >= 0; i--) {
            const item = interactables[i];
            if (!item) {
                interactables.splice(i, 1);
                continue;
            }
            const ud = item.userData;
            if (!ud) continue;

            if (
                ud.entity === entityOrId ||
                (entityId && (
                    ud.wallId === entityId ||
                    ud.roofId === entityId ||
                    ud.moldingId === entityId ||
                    ud.entityId === entityId ||
                    ud.targetEntity === entityOrId ||
                    ud.entity?.id === entityId
                )) ||
                item === entityOrId?.mesh3D ||
                item === entityOrId?.wallMesh3D
            ) {
                interactables.splice(i, 1);
            }
        }
    }

    /**
     * Fully disposes an entity's 3D representations, cleans up interactables, and unregisters ComponentRegistry.
     * 
     * @param {Object} entity - The domain entity (wall, roof, room, widget)
     * @param {Object} [ctx=null] - 3D scene context (with interactables, structureGroup, etc.)
     */
    static disposeEntity(entity, ctx = null) {
        if (!entity) return;

        // 1. Unregister from ComponentRegistry
        if (typeof ComponentRegistry !== 'undefined' && typeof ComponentRegistry.unregisterEntity === 'function') {
            ComponentRegistry.unregisterEntity(entity);
        }

        const interactables = ctx?.interactables;

        // 2. Purge from interactables list
        if (interactables) {
            this.purgeEntityInteractables(interactables, entity);
        }

        // 3. Dispose 3D mesh representations
        if (entity.mesh3D) {
            this.disposeHierarchy(entity.mesh3D, { interactables });
            entity.mesh3D = null;
        }

        if (entity.wallMesh3D) {
            this.disposeHierarchy(entity.wallMesh3D, { interactables });
            entity.wallMesh3D = null;
        }

        if (entity.patternMesh3D) {
            this.disposeHierarchy(entity.patternMesh3D, { interactables });
            entity.patternMesh3D = null;
        }

        // 4. Cascade to attached moldings if present
        if (Array.isArray(entity.moldings)) {
            entity.moldings.forEach(m => {
                if (m.mesh3D) {
                    this.disposeHierarchy(m.mesh3D, { interactables });
                    m.mesh3D = null;
                }
            });
        }
    }

    /**
     * Synchronizes interactables for an entity, removing stale meshes and appending active ones.
     * 
     * @param {Array} interactables - ctx.interactables
     * @param {Object} entity - Parent entity
     * @param {Array<THREE.Object3D>} activeMeshes - Active interactable meshes to register
     */
    static syncEntityInteractables(interactables, entity, activeMeshes = []) {
        if (!interactables || !Array.isArray(interactables)) return;

        // Clean out previous entries for this entity
        this.purgeEntityInteractables(interactables, entity);

        // Append current active meshes without duplicates
        (activeMeshes || []).forEach(m => {
            if (m && !interactables.includes(m)) {
                interactables.push(m);
            }
        });
    }
}

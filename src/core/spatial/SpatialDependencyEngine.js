/**
 * src/core/spatial/SpatialDependencyEngine.js
 * 
 * Centralized Authority for Universal Object Placement, Host Tracking,
 * Spatial Dependency Propagation, and Kinematics across 2D and 3D.
 * 
 * Core Capabilities:
 * 1. Authoritative Attachment & Detachment:
 *    - attach(dependent, host, options)
 *    - detach(dependent)
 *    - reattach(dependent, newHost)
 * 2. Forward Kinematics (Host Transform -> Dependent World Transform):
 *    P_world = P_host + R(theta_host) * P_local
 *    theta_world = theta_host + theta_local
 *    elevation_world = elevation_host + hostTop + elevation_local
 * 3. Inverse Kinematics (World Transform -> Local Attachment):
 *    Calculates exact local coordinate offsets when an object is placed or snapped on a host.
 * 4. Dependency Graph & Cycle Detection:
 *    Maintains in-memory DAG. Prevents A -> B -> A and multi-step circular dependencies.
 * 5. Multi-Level Recursive Propagation:
 *    Host Mutation -> Notify Direct Dependents -> Recurse to Nested Dependents (Level -> Wall -> Platform -> Stair -> Furniture).
 * 6. Passive 2D/3D Synchronization:
 *    Updates canonical entity, 2D Konva representation, and 3D Three.js scene graphs in place.
 * 7. Persistence & Deserialization:
 *    Re-indexes graph on state import and snapshot undo/redo.
 */

export const RELATIONSHIP_TYPES = {
    HOSTED: 'hosted',                     // e.g. Door/Window inside Wall opening
    SUPPORTED: 'supported',               // e.g. Staircase resting on Platform / Floor
    SURFACE_ATTACHED: 'surface_attached', // e.g. Sofa/Furniture on Platform/Floor, Sunshade on Wall face
    CONTAINED: 'contained',               // e.g. Furniture inside Room
    BOUNDED: 'bounded',                   // e.g. Platform bounded by Room walls
    LEVEL_DEPENDENT: 'level_dependent'    // e.g. Wall/Floor hosted on Level
};

export class SpatialDependencyEngine {
    constructor() {
        // Map<hostId, Set<dependentId>>
        this.dependencies = new Map();
        // Map<dependentId, { hostId, hostType, relationshipType, localTransform }>
        this.registry = new Map();
    }

    /**
     * Resets the entire in-memory graph index.
     */
    clear() {
        this.dependencies.clear();
        this.registry.clear();
    }

    // ==========================================
    // 1. KINEMATIC MATHEMATICS
    // ==========================================

    /**
     * Computes world transform from host transform and local attachment.
     * @param {Object} hostTransform - { x, y, elevation, rotation, height }
     * @param {Object} localTransform - { x, y, elevation, rotation }
     * @returns {{ x: number, y: number, elevation: number, rotation: number }}
     */
    static computeWorldTransform(hostTransform, localTransform) {
        const hX = Number(hostTransform.x) || 0;
        const hY = Number(hostTransform.y) || 0;
        const hElev = Number(hostTransform.elevation) || 0;
        const hH = Number(hostTransform.height) || 0;
        const hRot = Number(hostTransform.rotation) || 0;

        const lX = Number(localTransform.x) || 0;
        const lY = Number(localTransform.y) || 0;
        const lElev = Number(localTransform.elevation) || 0;
        const lRot = Number(localTransform.rotation) || 0;

        // Yaw angle in radians (Standard 2D counter-clockwise rotation)
        const rad = (hRot * Math.PI) / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);

        // Rotate local offset around host origin/center
        const deltaX = lX * cosR - lY * sinR;
        const deltaY = lX * sinR + lY * cosR;

        const worldX = Math.round((hX + deltaX) * 100) / 100;
        const worldY = Math.round((hY + deltaY) * 100) / 100;
        const worldElev = Math.round((hElev + hH + lElev) * 100) / 100;
        const worldRot = Math.round((((hRot + lRot) % 360) + 360) % 360 * 100) / 100;

        return {
            x: worldX,
            y: worldY,
            elevation: worldElev,
            rotation: worldRot
        };
    }

    /**
     * Computes local attachment transform from world transform and host transform (Inverse Kinematics).
     * @param {Object} worldTransform - { x, y, elevation, rotation }
     * @param {Object} hostTransform - { x, y, elevation, rotation, height }
     * @returns {{ x: number, y: number, elevation: number, rotation: number }}
     */
    static computeLocalTransform(worldTransform, hostTransform) {
        const wX = Number(worldTransform.x) || 0;
        const wY = Number(worldTransform.y) || 0;
        const wElev = Number(worldTransform.elevation) || 0;
        const wRot = Number(worldTransform.rotation) || 0;

        const hX = Number(hostTransform.x) || 0;
        const hY = Number(hostTransform.y) || 0;
        const hElev = Number(hostTransform.elevation) || 0;
        const hH = Number(hostTransform.height) || 0;
        const hRot = Number(hostTransform.rotation) || 0;

        const deltaX = wX - hX;
        const deltaY = wY - hY;

        // Inverse rotation (-hRot)
        const rad = (-hRot * Math.PI) / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);

        const localX = Math.round((deltaX * cosR - deltaY * sinR) * 100) / 100;
        const localY = Math.round((deltaX * sinR + deltaY * cosR) * 100) / 100;
        const localElev = Math.round((wElev - (hElev + hH)) * 100) / 100;
        const localRot = Math.round((((wRot - hRot) % 360) + 360) % 360 * 100) / 100;

        return {
            x: localX,
            y: localY,
            elevation: localElev,
            rotation: localRot
        };
    }

    /**
     * Extracts canonical 2D/3D transform from any entity type (wall, platform, furniture, shape, stair).
     * @param {Object} entity
     * @returns {{ x: number, y: number, elevation: number, height: number, rotation: number }}
     */
    static getEntityTransform(entity) {
        if (!entity) return { x: 0, y: 0, elevation: 0, height: 0, rotation: 0 };

        // 1. Wall Entity (defined by start/end anchors or coordinates)
        if (entity.startAnchor || entity.poly?.isWallPoly || entity.isWall || ['outer', 'inner', 'foundation', 'half_wall', 'compound', 'wall'].includes(entity.type)) {
            const p1 = typeof entity.startAnchor?.position === 'function'
                ? entity.startAnchor.position()
                : (entity.startAnchor || { x: entity.startX || 0, y: entity.startY || 0 });
            const p2 = typeof entity.endAnchor?.position === 'function'
                ? entity.endAnchor.position()
                : (entity.endAnchor || { x: entity.endX || 0, y: entity.endY || 0 });

            const p1x = Number(p1.x || 0);
            const p1y = Number(p1.y || 0);
            const p2x = Number(p2.x || 0);
            const p2y = Number(p2.y || 0);

            const midX = (p1x + p2x) / 2;
            const midY = (p1y + p2y) / 2;
            const angleDeg = Math.atan2(p2y - p1y, p2x - p1x) * (180 / Math.PI);

            return {
                x: midX,
                y: midY,
                elevation: Number(entity.elevation) || 0,
                height: 0, // Wall surface attachment anchors to wall base elevation
                rotation: angleDeg
            };
        }

        // 2. Standard 2D/3D entities (platform, furniture, shape, stair)
        const x = entity.x !== undefined ? Number(entity.x) : (entity.group && typeof entity.group.x === 'function' ? entity.group.x() : 0);
        const y = entity.y !== undefined ? Number(entity.y) : (entity.group && typeof entity.group.y === 'function' ? entity.group.y() : 0);
        const elevation = Number(entity.elevation) || 0;
        const height = Number(entity.height) || 0;
        const rotation = entity.rotation !== undefined ? Number(entity.rotation) : (entity.group && typeof entity.group.rotation === 'function' ? entity.group.rotation() : 0);

        return { x, y, elevation, height, rotation };
    }

    // ==========================================
    // 2. GRAPH & RELATIONSHIP MANAGEMENT
    // ==========================================

    /**
     * Checks if attaching dependentId to candidateHostId would create a cycle in the DAG.
     * @param {string} candidateHostId 
     * @param {string} dependentId 
     * @returns {boolean} True if a cycle would be introduced
     */
    hasCycle(candidateHostId, dependentId) {
        if (!candidateHostId || !dependentId) return false;
        if (candidateHostId === dependentId) return true;

        let currentHostId = candidateHostId;
        const visited = new Set();

        while (currentHostId) {
            if (visited.has(currentHostId)) return true;
            visited.add(currentHostId);

            if (currentHostId === dependentId) return true;

            const record = this.registry.get(currentHostId);
            currentHostId = record?.hostId || null;
        }

        return false;
    }

    /**
     * Attaches a dependent entity to a host entity.
     * @param {Object} dependent - The child entity
     * @param {Object} host - The parent host entity
     * @param {Object} options - { relationshipType, localTransform, computeFromCurrentWorld }
     * @returns {boolean} Success
     */
    attach(dependent, host, options = {}) {
        if (!dependent || !host || !dependent.id || !host.id) return false;

        const dependentId = dependent.id;
        const hostId = host.id;

        // 1. Cycle Prevention
        if (this.hasCycle(hostId, dependentId)) {
            console.warn(`[SpatialDependencyEngine] Prevented circular attachment: ${dependentId} -> ${hostId}`);
            return false;
        }

        // 2. Detach from existing host if attached
        if (this.registry.has(dependentId)) {
            this.detach(dependent);
        }

        // 3. Compute or preserve localTransform
        let localTransform = options.localTransform;
        if (!localTransform || options.computeFromCurrentWorld) {
            const hostTransform = SpatialDependencyEngine.getEntityTransform(host);
            const worldTransform = SpatialDependencyEngine.getEntityTransform(dependent);

            localTransform = SpatialDependencyEngine.computeLocalTransform(worldTransform, hostTransform);
        }

        const isWall = !!(host.startAnchor || host.poly?.isWallPoly || host.isWall || ['outer', 'inner', 'foundation', 'half_wall', 'compound', 'wall'].includes(host.type));
        const hostType = isWall ? 'wall' : (host.type || (host.isBuildingFoundation ? 'platform' : 'platform'));
        const relationshipType = options.relationshipType || RELATIONSHIP_TYPES.SURFACE_ATTACHED;

        // 4. Update In-Memory Index
        if (!this.dependencies.has(hostId)) {
            this.dependencies.set(hostId, new Set());
        }
        this.dependencies.get(hostId).add(dependentId);

        this.registry.set(dependentId, {
            hostId,
            hostType,
            relationshipType,
            localTransform: { ...localTransform }
        });

        // 5. Update Canonical Entity Metadata
        dependent.hostId = hostId;
        dependent.hostType = hostType;
        dependent.relationshipType = relationshipType;
        dependent.localTransform = { ...localTransform };
        dependent.relativeElevation = localTransform.elevation;

        // Legacy compatibility mappings
        if (hostType === 'platform') dependent.hostPlatformId = hostId;
        if (hostType === 'wall') dependent.parentWallId = hostId;
        if (hostType === 'furniture') dependent.hostFurnitureId = hostId;
        if (hostType === 'level') dependent.hostLevelId = hostId;

        return true;
    }

    /**
     * Detaches an entity from its current host.
     * @param {Object|string} dependentOrId 
     * @returns {boolean}
     */
    detach(dependentOrId) {
        const dependentId = typeof dependentOrId === 'string' ? dependentOrId : dependentOrId?.id;
        if (!dependentId || !this.registry.has(dependentId)) return false;

        const record = this.registry.get(dependentId);
        const hostId = record.hostId;

        if (this.dependencies.has(hostId)) {
            this.dependencies.get(hostId).delete(dependentId);
            if (this.dependencies.get(hostId).size === 0) {
                this.dependencies.delete(hostId);
            }
        }

        this.registry.delete(dependentId);

        if (typeof dependentOrId === 'object' && dependentOrId !== null) {
            dependentOrId.hostId = null;
            dependentOrId.hostType = null;
            dependentOrId.relationshipType = null;
            dependentOrId.localTransform = null;
            if (dependentOrId.hostPlatformId) dependentOrId.hostPlatformId = null;
            if (dependentOrId.parentWallId) dependentOrId.parentWallId = null;
            if (dependentOrId.hostFurnitureId) dependentOrId.hostFurnitureId = null;
            if (dependentOrId.hostLevelId) dependentOrId.hostLevelId = null;
        }

        return true;
    }

    /**
     * Returns direct dependents of a host entity.
     * @param {string} hostId 
     * @returns {Array<string>} Dependent IDs
     */
    getDependents(hostId) {
        if (!hostId || !this.dependencies.has(hostId)) return [];
        return Array.from(this.dependencies.get(hostId));
    }

    /**
     * Returns the host relationship record for a dependent.
     * @param {string} dependentId 
     * @returns {Object|null}
     */
    getHostRecord(dependentId) {
        return this.registry.get(dependentId) || null;
    }

    // ==========================================
    // 3. MUTATION PROPAGATION (FORWARD KINEMATICS)
    // ==========================================

    /**
     * Called whenever a host entity undergoes transform or geometry mutation.
     * Propagates new world transforms recursively to all descendants.
     * 
     * @param {Object} host - The mutated host entity
     * @param {Object} planner - The canonical planner instance
     * @param {Object} [delta] - Optional delta { dx, dy, dElev, dRot }
     * @param {Set<string>} [visited] - Internal cycle safeguard
     */
    onHostTransformed(host, planner, delta = null, visited = new Set()) {
        if (!host || !host.id) return;
        const hostId = host.id;

        if (visited.has(hostId)) return;
        visited.add(hostId);

        const dependentIds = this.getDependents(hostId);
        if (dependentIds.length === 0) return;

        const p = planner || host.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null);
        if (!p) return;

        const hostTransform = SpatialDependencyEngine.getEntityTransform(host);

        const allEntities = this._collectAllEntities(p);

        dependentIds.forEach(depId => {
            const depEntity = allEntities.find(e => e && e.id === depId);
            if (!depEntity) return;

            const record = this.registry.get(depId);
            if (!record || !record.localTransform) return;

            // 1. Calculate new world transform
            const newWorld = SpatialDependencyEngine.computeWorldTransform(hostTransform, record.localTransform);

            // 2. Apply to entity domain state
            depEntity.x = newWorld.x;
            depEntity.y = newWorld.y;
            depEntity.elevation = newWorld.elevation;
            depEntity.rotation = newWorld.rotation;

            // 3. Update 2D Konva Representation in place
            if (depEntity.group) {
                if (typeof depEntity.group.position === 'function') {
                    depEntity.group.position({ x: newWorld.x, y: newWorld.y });
                }
                if (typeof depEntity.group.rotation === 'function') {
                    depEntity.group.rotation(newWorld.rotation);
                }
            }

            // 4. Update 3D Three.js Representation in place
            if (depEntity.mesh3D) {
                depEntity.mesh3D.position.set(newWorld.x, newWorld.elevation, newWorld.y);
                depEntity.mesh3D.rotation.y = (-newWorld.rotation * Math.PI) / 180;
                if (typeof depEntity.mesh3D.updateMatrixWorld === 'function') {
                    depEntity.mesh3D.updateMatrixWorld(true);
                }
            }

            // 5. Domain Engine Notification Hook (if dependent implements onHostTransformed)
            if (typeof depEntity.onHostTransformed === 'function') {
                depEntity.onHostTransformed(hostTransform, newWorld, record);
            }

            // 5a. Specialized Staircase Recalculation on Platform Height Change (Fallback)
            if ((depEntity.type?.includes('stair') || depEntity.shape) && record.relationshipType === RELATIONSHIP_TYPES.SUPPORTED && record.hostType === 'platform') {
                const targetH = Math.max(20, Math.abs(hostTransform.elevation + hostTransform.height - (Number(depEntity.baseElevation) || 0)));
                if (Math.abs((depEntity.height || 0) - targetH) > 1) {
                    depEntity.height = targetH;
                    if (typeof depEntity.update === 'function') depEntity.update();
                }
            }

            // 5b. Specialized BOUNDED Polygon Recalculation (e.g. room-bounded platform)
            if (record.relationshipType === RELATIONSHIP_TYPES.BOUNDED && host.path && Array.isArray(host.path) && host.path.length >= 3) {
                let cx = 0, cy = 0;
                host.path.forEach(pt => { cx += pt.x; cy += pt.y; });
                cx /= host.path.length;
                cy /= host.path.length;
                depEntity.x = cx;
                depEntity.y = cy;
                depEntity.shapeType = 'polygon';
                depEntity.points = host.path.map(pt => ({ x: pt.x - cx, y: pt.y - cy }));
                if (typeof depEntity.update2D === 'function') depEntity.update2D();
                else if (typeof depEntity.update === 'function') depEntity.update();
                if (typeof depEntity._sync3DGeometry === 'function') depEntity._sync3DGeometry();
                if (typeof depEntity._sync3DTransform === 'function') depEntity._sync3DTransform();
            }

            // 6. Refresh 2D visual handles if entity supports it
            if (typeof depEntity.update2D === 'function') {
                depEntity.update2D();
            } else if (typeof depEntity.update === 'function') {
                depEntity.update();
            }

            // 6b. Refresh 3D representation if entity implements update3D
            if (typeof depEntity.update3D === 'function') {
                depEntity.update3D();
            }

            // 7. Mark dirty for 3D render pipeline
            const realtimeUpdate = p.renderer3D?.realtimeUpdate || p.engine3d?.realtimeUpdate || (typeof window !== 'undefined' ? window.renderer3D?.realtimeUpdate : null);
            if (realtimeUpdate && typeof realtimeUpdate.markDirty === 'function') {
                realtimeUpdate.markDirty(depEntity, 'transform');
            }

            // 8. Recurse down the dependency tree
            this.onHostTransformed(depEntity, p, delta, visited);
        });
    }

    /**
     * Handles clean detachment or cascade when a host entity is deleted.
     * @param {Object} host - The deleted host
     * @param {Object} planner - The canonical planner
     */
    onHostDeleted(host, planner) {
        if (!host || !host.id) return;
        const hostId = host.id;
        const dependentIds = this.getDependents(hostId);
        if (dependentIds.length === 0) return;

        const p = planner || host.planner;
        const allEntities = this._collectAllEntities(p);

        dependentIds.forEach(depId => {
            const dep = allEntities.find(e => e && e.id === depId);
            if (dep) {
                // Ground surface-attached objects (furniture drops to floor elevation = 0)
                dep.elevation = 0;
                if (dep.mesh3D) dep.mesh3D.position.y = 0;
                this.detach(dep);
                if (typeof dep.update === 'function') dep.update();
            }
        });

        this.dependencies.delete(hostId);
    }

    /**
     * Synchronizes and rebuilds the dependency index from active planner state
     * (e.g. after JSON project load or undo/redo snapshot import).
     * 
     * @param {Object} planner
     */
    rebuildFromPlanner(planner) {
        if (!planner) return;
        this.clear();

        const allEntities = this._collectAllEntities(planner);

        allEntities.forEach(entity => {
            if (!entity) return;

            // Check for explicit hostId
            let hId = entity.hostId || entity.hostPlatformId || entity.parentWallId;
            let hType = entity.hostType || (entity.hostPlatformId ? 'platform' : (entity.parentWallId ? 'wall' : null));

            if (hId && hType) {
                const hostEntity = allEntities.find(e => e && e.id === hId);
                if (hostEntity) {
                    const localTransform = entity.localTransform || {
                        x: 0,
                        y: 0,
                        elevation: Number(entity.relativeElevation) || 0,
                        rotation: 0
                    };

                    this.attach(entity, hostEntity, {
                        relationshipType: entity.relationshipType || RELATIONSHIP_TYPES.SURFACE_ATTACHED,
                        localTransform,
                        computeFromCurrentWorld: !entity.localTransform
                    });
                }
            }
        });
    }

    /**
     * Helper to collect all potential hosts and dependents from planner.
     * @private
     */
    _collectAllEntities(planner) {
        if (!planner) return [];
        const list = [];
        if (planner.walls) list.push(...planner.walls);
        if (planner.platforms) list.push(...planner.platforms);
        if (planner.stairs) list.push(...planner.stairs);
        if (planner.furniture) list.push(...planner.furniture);
        if (planner.shapes) list.push(...planner.shapes);
        return list;
    }
}

// Global Singleton Authority
export const globalSpatialDependencyEngine = new SpatialDependencyEngine();

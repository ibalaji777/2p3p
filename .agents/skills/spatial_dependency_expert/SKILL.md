---
name: Spatial Dependency & Host Tracking Expert
description: Complete unified CAD/BIM standard for spatial dependency, host resolution, 2D/3D kinematic propagation, and auto-adjustment of furniture, stairs, shapes, panels, platforms, and plugins when supporting walls or architecture change.
---

# Spatial Dependency & Host Tracking Expert Skill

## Purpose & Mandate

When architecture changes—such as when a wall moves, wall endpoints are dragged, anchors shift, room boundaries deform, or a platform changes elevation or height—every dependent element attached to, resting on, or bounded by that architecture **must automatically follow, track, and adjust its position and dimensions deterministically in place**.

This skill establishes the universal CAD/BIM architectural contract that **every new feature, placed entity, shape, elevation element, staircase, furniture item, or wall plugin** must follow to ensure 100% synchronized 2D/3D kinematics, undo/redo invariance, and export/import persistence without duplicate or competing tracking systems.

---

## 1. Single Source of Truth Architecture

```text
Host Architecture Mutation (Wall / Platform / Floor)
    ↓
WallEngine / PlatformEngine / VerticalPropagationEngine
    ↓
SpatialDependencyEngine.onHostTransformed(host, planner)
    ↓
Forward Kinematics: computeWorldTransform(hostTransform, localTransform)
    ↓
In-Place 2D Update (depEntity.group.position / rotation)
    ↓
In-Place 3D Update (depEntity.mesh3D.position / rotation)
    ↓
Domain Hook: depEntity.onHostTransformed(hostTransform, newWorld)
```

### Primary Authorities

| Component | Absolute Path | Responsibility |
| :--- | :--- | :--- |
| **Spatial Dependency Engine** | [SpatialDependencyEngine.js](file:///d:/business/android-planner/src/core/spatial/SpatialDependencyEngine.js) | Single authoritative DAG (`dependencies`, `registry`), forward/inverse kinematics math, cycle prevention, cascade propagation, and transform extraction. |
| **Spatial Host Resolver** | [SpatialHostResolver.js](file:///d:/business/android-planner/src/core/spatial/SpatialHostResolver.js) | Stateless geometric query engine (`findHostAt`, `findPlatformUnderPoint`, `findWallNearPoint`, `isPointInPolygon`). Evaluates arbitrary platform rotations, polygon boundaries, and elevations without mutating domain state. |
| **Central 2D Orchestrator** | [index.js](file:///d:/business/android-planner/src/core/engine2d/index.js) | Hosts `planner.spatial` and `planner.hostResolver`; routes `_applyMove` and `_applyRotate` through host resolution, attachment, and dependent notifications. |
| **Wall Topology Engine** | [WallTopologyEngine.js](file:///d:/business/android-planner/src/core/wall/WallTopologyEngine.js) | Cascades wall deletions to `globalSpatialDependencyEngine.onHostDeleted(wall, planner)`. |
| **Platform Engine** | [PlatformEngine.js](file:///d:/business/android-planner/src/core/platform/PlatformEngine.js) | Manages platform lifecycle; notifies `onHostTransformed` on move/rise/rotate and `onHostDeleted` on platform removal. |
| **Universal Move Gizmo (3D)** | [UniversalMoveGizmo.js](file:///d:/business/android-planner/src/core/engine3d/UniversalMoveGizmo.js) | Routes 3D translation commits through `planner.move(id, x, y)`, updating canonical 2D/3D transforms and triggering DAG propagation. |

---

## 2. Mandatory Contracts for Adding Any New Object or Feature

Whenever adding a new object type (e.g. custom panel, wall art, appliance, fixture, staircase variant, deck, or attached widget):

### Contract 1: Identity & Metadata
Every entity MUST expose or declare:
```javascript
{
    id: string,               // Stable unique identifier (never regenerated on transform)
    x: number,                // Canonical 2D world X
    y: number,                // Canonical 2D world Y
    elevation: number,        // Canonical elevation above floor level (Z=0 plane)
    rotation: number,         // Canonical 2D yaw angle in degrees
    hostId: string | null,    // ID of supporting/parent entity (wall, platform, furniture)
    hostType: string | null,  // 'wall' | 'platform' | 'furniture' | 'level'
    relationshipType: string, // RELATIONSHIP_TYPES.SURFACE_ATTACHED | SUPPORTED | BOUNDED
    localTransform: {         // Relative attachment offset in host local coordinate space
        x: number,
        y: number,
        elevation: number,
        rotation: number
    }
}
```

### Contract 2: Host Resolution on Placement & Drag-End
Never resolve hosts continuously during active 60 FPS `dragmove` (which would thrash the DAG). Commit host attachment strictly on `dragend` or in `_applyMove`:
```javascript
import { SpatialHostResolver } from '../spatial/SpatialHostResolver.js';
import { globalSpatialDependencyEngine, RELATIONSHIP_TYPES } from '../spatial/SpatialDependencyEngine.js';

// Inside dragend or placement commit:
const hostRes = SpatialHostResolver.findHostAt(planner, curX, curY, entity.type, {
    rotation: entity.rotation,
    elevation: entity.elevation,
    ignoreEntity: entity
});

if (hostRes && hostRes.host) {
    if (hostRes.hostType === 'platform') {
        entity.elevation = hostRes.surfaceElevation;
        entity.hostPlatformId = hostRes.hostId;
    } else if (hostRes.hostType === 'wall') {
        entity.parentWallId = hostRes.hostId;
    }
    globalSpatialDependencyEngine.attach(entity, hostRes.host, {
        relationshipType: hostRes.relationshipType,
        localTransform: hostRes.localTransform
    });
} else if (entity.hostId || entity.hostPlatformId || entity.parentWallId) {
    globalSpatialDependencyEngine.detach(entity);
    entity.hostId = null;
    entity.hostPlatformId = null;
    entity.parentWallId = null;
}
```

### Contract 3: Standard Transform Extraction (`getEntityTransform`)
Never write ad-hoc `{ x: host.x, y: host.y }` literal lookups. Always extract host and dependent transforms using:
```javascript
const hostTransform = SpatialDependencyEngine.getEntityTransform(hostEntity);
```
`getEntityTransform` automatically handles:
- **Walls**: Calculates baseline midpoint `(midX, midY)`, orientation angle, base elevation, and height `0` (surface attachment anchor).
- **Platforms, Furniture, Stairs, Shapes**: Resolves group vs property coordinates, elevation, height, and yaw.

### Contract 4: In-Place Updates (`update2D` & `update3D`)
Never destroy and recreate render nodes when an object moves due to a host shift. The entity MUST implement:
```javascript
update2D() {
    if (this.group) {
        this.group.position({ x: this.x, y: this.y });
        this.group.rotation(this.rotation);
    }
    // Update any decorative handles, labels, or edge seals
}

update3D() {
    if (this.mesh3D) {
        this.mesh3D.position.set(this.x, Number(this.elevation) || 0, this.y);
        this.mesh3D.rotation.y = (-(Number(this.rotation) || 0) * Math.PI) / 180;
        if (typeof this.mesh3D.updateMatrixWorld === 'function') {
            this.mesh3D.updateMatrixWorld(true);
        }
    }
}
```

### Contract 5: Custom Dynamic Adaptation Hook (`onHostTransformed`)
If the new entity requires geometric adaptation when its host changes (e.g. stair recalculating step count, bounded slab recalculating polygon points, or shelf resizing):
```javascript
onHostTransformed(hostTransform, newWorld) {
    // 1. Position and rotation have already been applied to this.x, this.y, this.elevation, this.rotation
    // 2. Perform entity-specific geometric recalculation:
    if (this.isAdaptive) {
        this.recalculateGeometryForHost(hostTransform);
    }
    // 3. Sync 2D and 3D representations
    this.update2D();
    this.update3D();
}
```

### Contract 6: Cascading Host Deletion Cleanup
When deleting any entity that can act as a host (walls, platforms, furniture tables):
```javascript
globalSpatialDependencyEngine.onHostDeleted(hostEntity, planner);
```
This automatically:
- Un-links all children from the dependency DAG.
- Grounds resting objects (drops furniture elevation to 0).
- Prevents dangling or orphaned entity IDs in the project graph.

### Contract 7: Serialization & Deserialization
In `exportState()` and `importState()`:
- **Export**: Must include `id`, `hostId`, `hostType`, `relationshipType`, `localTransform`, and `elevation`.
- **Import / Rebuild**: Call `globalSpatialDependencyEngine.rebuildFromPlanner(planner)` after populating entity lists. This reconstructs all graph edges in $O(N)$ time with zero drift.

---

## 3. Strict Prohibitions & Anti-Patterns

1. **NO Parallel Dependency Engines**:
   Never create a `CustomTrackingManager` or `WallAttachmentService`. All parent-child and host-dependent tracking MUST route through `SpatialDependencyEngine`.
2. **NO Uncoordinated Manual Y/Elevation Offsets**:
   Never write `mesh.position.y += deltaY` directly in tool event handlers. All elevation shifts must derive from `hostTransform` and `localTransform`.
3. **Rooms Are Derived Geometry, NOT Graph Nodes**:
   Never treat rooms as persistent DAG nodes. Rooms are dynamically regenerated cycle polygons (`detectRooms()`). The architectural chain is:
   $$\text{Wall} \longrightarrow \text{Derived Room Polygon} \longrightarrow \text{Bounded Platform (Canonical)} \longrightarrow \text{SpatialDependencyEngine} \longrightarrow \text{Furniture/Stairs}$$
4. **NO In-Place Rebuilds During Drag**:
   Never thrash geometries or rebuild Three.js groups on `dragmove`. Perform in-place position updates during drag; commit graph edges strictly on `dragend`.
5. **NO Direct Property Bypass**:
   Moving an object must invoke `planner.move(id, x, y)` or use `_applyMove(id, x, y)` so that command history, 2D visual groups, 3D meshes, and dependent children update concurrently.

---

## 4. Verification Checklist for New Entities

Before completing any new feature or entity:
- [ ] Dragging the entity onto a platform or against a wall snaps and sets `hostId`, `hostType`, and `relationshipType`.
- [ ] Moving the host wall or platform automatically moves the child entity in 2D and 3D simultaneously.
- [ ] Rotating the host platform rotates the child entity around the host center point.
- [ ] Raising or lowering wall/platform height or elevation adjusts the child's world elevation.
- [ ] Deleting the host cleanly unlinks the child and grounds its elevation to 0.
- [ ] `exportState` -> `importState` restores the dependency relationship and keeps positions identical.
- [ ] Undo and Redo revert both host and dependent positions without losing attachment.
- [ ] Automated regression tests in `src/core/spatial/test/SpatialDependencyMasterE2E.spec.js` pass.

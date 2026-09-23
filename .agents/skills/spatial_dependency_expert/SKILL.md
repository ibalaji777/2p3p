---
name: Spatial Dependency & Host Tracking Expert
description: Complete unified CAD/BIM standard for spatial dependency, host resolution, 2D/3D kinematic propagation, and auto-adjustment of furniture, stairs, shapes, panels, platforms, and plugins when supporting walls or architecture change.
---

# Spatial Dependency & Host Tracking Expert Skill

## Purpose & Mandate

When architecture changes—such as when a wall moves, wall endpoints are dragged, anchors shift, room boundaries deform, or a platform changes elevation or height—every dependent element attached to, resting on, or bounded by that architecture **must automatically follow, track, and adjust its position and dimensions deterministically in place**.

This skill establishes the universal CAD/BIM architectural contract that **every new feature, placed entity, shape, elevation element, staircase, furniture item, GLB model, or floor/wall plugin** must follow to ensure 100% synchronized 2D/3D kinematics, undo/redo invariance, and export/import persistence without duplicate or competing tracking systems.

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

### 1.1 Anchor ↔ Wall ↔ Dependent Object Chain of Custody
Anchors are **not** direct spatial hosts. Anchors are geometric endpoints defining walls.
- When an anchor moves (via `WallEngine.moveAnchor` or 2D anchor dragging):
  1. The anchor updates its position.
  2. The connected wall geometries are recalculated via `WallEngine.recalculateGeometry(wall, planner)`.
  3. The wall notifies `globalSpatialDependencyEngine.onHostTransformed(wall, planner)`.
  4. All objects attached to the wall (`SURFACE_ATTACHED`) follow rigidly using forward kinematics (`computeWorldTransform`).
  5. Both 2D (`update2D()`) and 3D (`update3D()` / `_sync3DTransform()`) update in place.
- **Legacy Renderer Scaling Deprecated**: Anchors must **never** maintain private `trackedObjects` arrays or compute `scaleRatio` stretching. Rigid entities must never scale, stretch, or deform when wall anchors move.

### 1.2 Primary Authorities

| Component | Absolute Path | Responsibility |
| :--- | :--- | :--- |
| **Spatial Dependency Engine** | [SpatialDependencyEngine.js](file:///d:/business/android-planner/src/core/spatial/SpatialDependencyEngine.js) | Single authoritative DAG (`dependencies`, `registry`), forward/inverse kinematics math, cycle prevention, cascade propagation, and transform extraction. |
| **Spatial Host Resolver** | [SpatialHostResolver.js](file:///d:/business/android-planner/src/core/spatial/SpatialHostResolver.js) | Stateless geometric query engine (`findHostAt`, `findPlatformUnderPoint`, `findWallNearPoint`, `isPointInPolygon`). Evaluates arbitrary platform rotations, polygon boundaries, and elevations without mutating domain state. |
| **Wall Mutation Engine** | [WallMutationEngine.js](file:///d:/business/android-planner/src/core/wall/WallMutationEngine.js) | Central authority for anchor movement (`moveAnchor`), wall endpoint adjustment (`setEndpoints`), and wall translation (`moveWall`), cascading directly to `SpatialDependencyEngine`. |
| **Central 2D Orchestrator** | [index.js](file:///d:/business/android-planner/src/core/engine2d/index.js) | Hosts `planner.spatial` and `planner.hostResolver`; routes `_applyMove` and `_applyRotate` through host resolution, attachment, and dependent notifications. |
| **Wall Topology Engine** | [WallTopologyEngine.js](file:///d:/business/android-planner/src/core/wall/WallTopologyEngine.js) | Cascades wall deletions to `globalSpatialDependencyEngine.onHostDeleted(wall, planner)`. |
| **Platform Engine** | [PlatformEngine.js](file:///d:/business/android-planner/src/core/platform/PlatformEngine.js) | Manages platform lifecycle; notifies `onHostTransformed` on move/rise/rotate and `onHostDeleted` on platform removal. |
| **Universal Move Gizmo (3D)** | [UniversalMoveGizmo.js](file:///d:/business/android-planner/src/core/engine3d/UniversalMoveGizmo.js) | Routes 3D translation commits through `planner.move(id, x, y)`, updating canonical 2D/3D transforms and triggering DAG propagation. |

---

## 2. Universal Floor & Wall Placement Architecture

Whenever ANY object is placed on the floor or moved in the scene, it follows a strict 3-tier host resolution hierarchy in `SpatialHostResolver.findHostAt`:

```text
                     Object Placed / Moved
                              ↓
             Is it over an elevated Platform?
               /                           \
            YES                             NO
            ↓                               ↓
   Host: Platform                   Is it within snap distance (≤ 40 cm) of a Wall?
   Type: SUPPORTED                   /                           \
   Elev: platform.elevation + H   YES                             NO
                                  ↓                               ↓
                         Host: Wall                      Host: None (Freestanding)
                         Type: SURFACE_ATTACHED          Elev: 0 (Ground level)
                         LocalTransform: relative        parentWallId: null
                           to Wall midpoint & angle
```

### Hierarchy Rules:
1. **Tier 1 — Platform Host (`SUPPORTED`)**:
   - An elevated platform takes highest precedence.
   - Sets `elevation = platform.elevation + platform.height`.
   - Records `hostPlatformId = platform.id`.
   - If the platform elevates, rotates, or moves, the object follows both laterally and vertically.
2. **Tier 2 — Wall Surface Attachment (`SURFACE_ATTACHED`)**:
   - If not on a platform, check if the entity is within snap distance ($\le 40\text{ cm}$) of any wall via `findWallNearPoint`.
   - Automatically binds `parentWallId = wall.id` and computes canonical `localTransform` relative to wall midpoint `(midX, midY)` and wall orientation angle via `SpatialDependencyEngine.getEntityTransform(wall)`.
   - Moving or rotating the wall (or dragging its anchors) rigidly translates and rotates the attached object with **zero scaling**.
3. **Tier 3 — Freestanding Floor Entity (`FREESTANDING`)**:
   - If moved away into open room space ($> 40\text{ cm}$ from walls and not over a platform), it cleanly detaches: `parentWallId = null`, `hostPlatformId = null`, elevation grounded to floor ($0$).
   - It is detached from `SpatialDependencyEngine` and moves independently.

---

## 3. Mandatory Contracts for All Entities (Current & Future)

Whenever adding ANY new entity type placed on the floor or scene (furniture, stairs, shapes, GLB models, appliances, electronics, rugs, fixtures, decor, or architectural elements):

### Contract 1: Identity & Metadata
Every entity MUST expose or declare:
```javascript
{
    id: string,               // Stable unique identifier (never regenerated on transform)
    x: number,                // Canonical 2D world X
    y: number,                // Canonical 2D world Y
    elevation: number,        // Canonical elevation above floor level (Z=0 plane)
    rotation: number,         // Canonical 2D yaw angle in degrees
    width: number,            // Physical dimension width (rigid, never scaled by wall moves)
    depth: number,            // Physical dimension depth (rigid, never scaled by wall moves)
    height: number,           // Physical dimension height (rigid, never scaled by wall moves)
    parentWallId: string|null,// ID of host wall if surface-attached
    hostPlatformId: string|null, // ID of host platform if resting on platform
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
        entity.parentWallId = null;
    } else if (hostRes.hostType === 'wall') {
        entity.parentWallId = hostRes.hostId;
        entity.hostPlatformId = null;
    }
    globalSpatialDependencyEngine.attach(entity, hostRes.host, {
        relationshipType: hostRes.relationshipType,
        localTransform: hostRes.localTransform
    });
} else {
    // Detach when moved to open space (> 40 cm away)
    if (entity.hostId || entity.hostPlatformId || entity.parentWallId) {
        globalSpatialDependencyEngine.detach(entity);
        entity.hostId = null;
        entity.hostPlatformId = null;
        entity.parentWallId = null;
    }
}
```

### Contract 3: Standard Transform Extraction (`getEntityTransform`)
Never write ad-hoc `{ x: host.x, y: host.y }` literal lookups. Always extract host and dependent transforms using:
```javascript
const hostTransform = SpatialDependencyEngine.getEntityTransform(hostEntity);
```
`getEntityTransform` automatically handles:
- **Walls**: Calculates baseline midpoint `(midX, midY)`, orientation angle, base elevation, and height `0` (surface attachment anchor).
- **Platforms, Furniture, Stairs, Shapes, GLBs**: Resolves group vs property coordinates, elevation, height, and yaw.

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

_sync3DTransform() {
    this.update3D();
}
```

### Contract 5: Strict Zero-Scaling & Zero-Shrinking Invariant
- **Rigid Dimensions Invariant**: Entity `width`, `depth`, and `height` must **never** be multiplied by a scaling factor or ratio when walls or anchors move.
- **Lateral vs. Vertical Isolation**: Lateral wall movements must never alter vertical dimensions or step counts. Vertical step recalculation (e.g. `StairHeightDetector`) must only run when `record.hostType === 'platform'` or level elevation changes.
```javascript
onHostTransformed(hostTransform, newWorld, record) {
    // 1. Position and rotation have already been applied to this.x, this.y, this.elevation, this.rotation
    // 2. ONLY adapt vertical geometry if the host is actually a vertical platform/level:
    if (this.isAdaptive && record && record.hostType === 'platform') {
        this.recalculateGeometryForHost(hostTransform);
    }
    // 3. Sync 2D and 3D representations
    this.update2D();
    this.update3D();
}
```

### Contract 6: Universal Host Whitelisting in `SpatialHostResolver`
Any new entity type or missing entity placed on the floor must be recognized by `isWallAttachable` in `SpatialHostResolver.findHostAt`:
```javascript
const isWallAttachable = entityType === 'shape' || entityType === 'surface_attached' ||
    entityType === 'furniture' || (typeof entityType === 'string' && entityType.startsWith('shape_')) ||
    entityType === 'glb' || entityType === 'model' || entityType === 'decor' || entityType === 'fixture';
```

### Contract 7: Cascading Host Deletion Cleanup
When deleting any entity that can act as a host (walls, platforms, furniture tables):
```javascript
globalSpatialDependencyEngine.onHostDeleted(hostEntity, planner);
```
This automatically:
- Un-links all children from the dependency DAG.
- Grounds resting objects (drops furniture elevation to 0).
- Clears `parentWallId` and `hostPlatformId`.
- Prevents dangling or orphaned entity IDs in the project graph.

### Contract 8: Serialization & Deserialization Integrity
In `exportState()` and `importState()`:
- **Export**: Must include `id`, `hostId`, `parentWallId`, `hostPlatformId`, `hostType`, `relationshipType`, `localTransform`, and `elevation`.
- **Import / Rebuild**: Call `globalSpatialDependencyEngine.rebuildFromPlanner(planner)` after populating entity lists. This reconstructs all graph edges in $O(N)$ time with zero drift.

---

## 4. Blueprint: Implementing Any Future / Missing Floor-Placed Entity

Whenever a new floor-placed entity type (e.g. GLB model, appliance, custom shape, rug, railing, column, or interactive decor) is created, implement the following standard pattern:

```javascript
export class PremiumCustomEntity {
    constructor(planner, config) {
        this.planner = planner;
        this.id = config.id || ('custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
        this.type = 'custom_entity'; // or 'glb', 'decor', etc.
        
        // Canonical transform
        this.x = Number(config.x) || 0;
        this.y = Number(config.y) || 0;
        this.elevation = Number(config.elevation) || 0;
        this.rotation = Number(config.rotation) || 0;

        // Rigid dimensions (NEVER scale with wall moves)
        this.width = Number(config.width) || 100;
        this.depth = Number(config.depth) || 100;
        this.height = Number(config.height) || 100;

        // Host tracking state
        this.parentWallId = config.parentWallId || null;
        this.hostPlatformId = config.hostPlatformId || null;
        this.hostId = config.hostId || null;
        this.hostType = config.hostType || null;
        this.relationshipType = config.relationshipType || null;
        this.localTransform = config.localTransform || null;

        this.init2D();
    }

    update2D() {
        if (this.group) {
            this.group.position({ x: this.x, y: this.y });
            this.group.rotation(this.rotation);
        }
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

    _sync3DTransform() {
        this.update3D();
    }

    onHostTransformed(hostTransform, newWorld, record) {
        // Only adapt vertical profile if host is a platform
        this.update2D();
        this.update3D();
    }

    serialize() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            elevation: this.elevation,
            rotation: this.rotation,
            width: this.width,
            depth: this.depth,
            height: this.height,
            parentWallId: this.parentWallId,
            hostPlatformId: this.hostPlatformId,
            hostId: this.hostId,
            hostType: this.hostType,
            relationshipType: this.relationshipType,
            localTransform: this.localTransform
        };
    }
}
```

---

## 5. Strict Prohibitions & Anti-Patterns

1. **NO Private Anchor Tracking Arrays (`this.trackedObjects`)**:
   Never store lists of attached entities on anchors. Anchors define wall endpoints; walls own spatial attachment.
2. **NO Scaling of Rigid Objects (`scaleRatio`)**:
   Never scale or stretch rigid bodies (furniture, stairs, shapes, GLBs) during anchor or wall moves. They must rotate and translate rigidly with zero dimension mutation.
3. **NO Vertical Step Recalculation on Lateral Wall Shifts**:
   Never recalculate staircase step counts or floor entity heights when a wall moves laterally. Walls have `height: 0` for surface attachments; adapting height to a wall crushes stairs and furniture to 20 cm.
4. **NO Ad-Hoc Origin Fallbacks**:
   Never use `{ x: host.x || 0, y: host.y || 0 }` for walls, which defaults to world origin `(0, 0)`. Always use `SpatialDependencyEngine.getEntityTransform(wall)`.
5. **NO Parallel Dependency Engines**:
   Never create a `CustomTrackingManager` or `WallAttachmentService`. All parent-child tracking MUST route through `SpatialDependencyEngine`.
6. **NO Direct Property Bypass**:
   Moving an object must route through `planner.move(id, x, y)` or `_applyMove(id, x, y)` so that command history, 2D visual groups, 3D meshes, and dependent children update concurrently.

---

## 6. Verification Checklist for All Floor & Wall Placed Entities

Before completing any new feature, entity, or bug fix:
- [ ] Placing over an elevated platform sets `hostPlatformId`, `relationshipType: SUPPORTED`, and `elevation = platform.elevation + platform.height`.
- [ ] Placing abutting or near a wall ($\le 40\text{ cm}$) sets `parentWallId`, `relationshipType: SURFACE_ATTACHED`, and canonical `localTransform`.
- [ ] Moving the object into open floor space ($> 40\text{ cm}$) clears `parentWallId` and detaches the object.
- [ ] Moving a wall anchor moves attached entities in 2D and 3D simultaneously with **zero dimensional scaling** (`width`, `depth`, `height` remain constant).
- [ ] Lateral wall movements preserve 100% of staircase height and step counts without shrinking.
- [ ] Rotating a host platform rotates attached entities around the platform center.
- [ ] Deleting a host wall or platform cleanly unlinks dependent entities and grounds them without errors.
- [ ] `exportState` -> `importState` restores host relationships and exact positions.
- [ ] Undo and Redo revert both host and dependent positions cleanly.
- [ ] Automated regression tests in `src/core/spatial/test/AnchorMovementSync.spec.js` pass.

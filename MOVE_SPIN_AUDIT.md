# Architectural Audit: Centralized Move & Spin/Rotate System

**Document Version:** 1.0.0  
**Scope:** Complete cross-subsystem audit of Translation (Move) and Rotation (Spin/Yaw/Tilt) across 2D Canvas, 3D Viewport, Desktop, Mobile, Tablet, Mouse, Touch, Pointer, Gizmos, HUDs, Shortcuts, and Entity Renderers.  
**Objective:** Establish a unified, authoritative transformation architecture (`TransformEngine`) eliminating fragmented math, direct state mutation bypasses, duplicate history entries, and coordinate mismatches.

---

## Executive Summary

The audit revealed that **movement and rotation logic are currently fragmented across more than 16 separate files and 8 independent interaction subsystems**. 

### Critical Architecture Flaws Identified:
1. **Broken Command Integrity & Double Undo Bug:**
   - In 3D, rotating an object with `UniversalSpinGizmo` pivots around the object's geometric center, which shifts both its `rotation` and its `(x, y)` planar position. Upon pointer release, the gizmo calls `plannerInst.rotate(...)` **and** `plannerInst.move(...)`. This produces **two separate commands** in `CommandManager`. When a user presses `Ctrl+Z`, only the translation is undone, leaving the object with the new rotation at the old position. A second `Ctrl+Z` is required to restore the rotation.
   - In 2D, rotating via Konva handles pivots around the group's local origin/offset, mutating `rotation` directly. In `PremiumPlatform` and `PremiumShape`, `dragend` invokes `debouncedSaveHistory()` without creating any `MoveCommand` or `RotateCommand`, completely bypassing the `CommandManager` stack.
   - For stairs in 2D (`stairs.renderer2d.js`), dragging calls `StairEngine.setPosition(planner, stair, curX, curY)` and `StairEngine.setRotation(planner, stair, rot)`, which mutate domain properties directly and call `debouncedSaveHistory()`, with zero Command integration.
   - For wall openings in 2D (`advance_openings.js`), dragging directly mutates `this.t` during `dragmove` with no `dragend` handler and no command recorded.
   - In 3D `OpeningGizmo` (`InteractionSystem.js`), dragging handles mutates `entity.t`, `entity.elevation`, `entity.width`, `entity.height` directly and emits an event, with zero CommandManager integration.
   - In 3D right-click Sims 4 rotation (`InteractionSystem.js:rotateSelectedObjectSims4`), a single right-click step (45°) calls `CommonTransformEngine.executeSpin()` directly without recording any command. A right-click drag spin commits `plannerInst.rotate(...)` but discards the `(x, y)` shift produced by `executeSpin`.
   - Keyboard shortcut 'R' (`CommonInteractionController.js`) calls `transformEngine.executeSpin(entity, 90)` with zero Command recording.
   - Property panels (`furniture.properties.vue`, `ShapePanel.vue`) use `v-model.number="selectedEntity.rotation"` mutating domain objects directly before emitting `sync-engine`.

2. **Scattered Duplicate Mathematics:**
   - **2D Rotation Handle Math:** Identical `Math.atan2(pos.y - group.y(), pos.x - group.x()) * 180 / Math.PI + 90` is independently implemented across `furniture.renderer2d.js`, `PremiumPlatform.js`, `stairs.renderer2d.js`, and `PremiumShape.js`.
   - **Snapping Math:** Angle snapping logic (15°, 45°, 90°, magnetic zones) is independently reimplemented in `UniversalSpinGizmo.js`, `InteractionSystem.js`, `PremiumPlatform.js`, `stairs.renderer2d.js`, and `smartGuides.js`.
   - **Translation Math & Raycasting:** 3D translation raycasting onto horizontal ground planes is duplicated across `UniversalMoveGizmo.js`, `TransformControls.js`, `InteractionSystem.js` (`dragPlane`), and placement systems.
   - **Pivot Center Discrepancy:** 2D rotates around group top-left or offset center (`group.offsetX()`), whereas 3D rotates around computed 3D bounding box center (`getObjectLocalCenter`), causing visible position shifts when alternating edits between 2D and 3D.

3. **Subsystem Isolation:**
   - There exists a partial `CommonTransformEngine.js` in `src/core/engine3d/tools/`, but it is strictly confined to 3D, possesses no 2D awareness, mutates domain state directly during execution, and does not integrate with `CommandManager`.

---

## Section A: Current Movement (Translation) Implementations

The following table comprehensively details all existing translation mechanisms in the project:

| Subsystem / File | Trigger / Input | Object Types Handled | Coordinate Space & Math | State Mutations | History / Command Integration | Spatial / Host Dependency Sync | Identified Architectural Issues |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`src/core/engine2d/index.js`**<br>`_applyMove(id, x, y)` | Internal command executor (invoked by `MoveCommand`) | Furniture, shapes, stairs, models, decor, fixtures, platform children | 2D World coordinates `(x, y)`. Directly sets `entity.x = x; entity.y = y; entity.group.position({x, y})`. | Mutates `entity.x`, `entity.y`, `mesh3D.position`. | Authoritative executor for `MoveCommand`. | Invokes `SpatialHostResolver.findHostAt`, attaches/detaches hosts via `globalSpatialDependencyEngine`, calls `onHostTransformed`. | Only handles planar point translation; does not handle wall-anchored `t` progression or bounding wall anchors. |
| **`src/core/engine2d/DragEvents.js`**<br>`setupDragEvents(planner)` | 2D Stage-level mouse/touch drag on Konva Group/Shape | Any draggable 2D entity on stage | Intercepts Konva `dragstart` & `dragend`. On `dragend`, reverts `entity.group.position(dragStartData2D)` then calls `planner.move(id, endX, endY)`. | Reverts Konva node position so `MoveCommand` can execute. | Creates `MoveCommand`. | Handled inside `_applyMove`. | Competes with entity-level `dragend` listeners. Temporary position reversion causes flicker. |
| **`src/features/furniture/furniture.renderer2d.js`** | 2D Mouse / touch drag on furniture group | Furniture entities | Directly sets `this.x = this.group.x(); this.y = this.group.y();` on `dragmove`. On `dragend`, reverts group position and calls `planner.move(id, endX, endY)`. | Mutates `this.x`, `this.y`, and `this.mesh3D.position` during `dragmove`. | Creates `MoveCommand` on `dragend`. | Handled inside `_applyMove` upon `dragend`. | Redundant with `DragEvents.js`; mutates domain properties on every pointer frame before command commit. |
| **`src/core/engine2d/PremiumPlatform.js`** | 2D Mouse / touch drag on platform group | Platform entities | Calculates `dragOffset` from pointer, sets `this.x = Math.round(rawX); this.y = Math.round(rawY);` on `dragmove`. | Mutates `this.x`, `this.y`, `this.group`, calls `_sync3DTransform()`. | **Bypasses CommandManager!** Calls `debouncedSaveHistory()` only. No `MoveCommand`! | Calls `globalSpatialDependencyEngine.onHostTransformed`. | History stack corrupted: platform moves cannot be undone cleanly via `CommandManager.undo()`. |
| **`src/features/stairs/stairs.renderer2d.js`** | 2D Mouse / touch drag on staircase group | Staircase entities | In `dragend`, extracts `curX = this.group.x(); curY = this.group.y();` and calls `StairEngine.setPosition(planner, this, curX, curY)`. | `StairMutationEngine.setPosition` mutates `stair.x`, `stair.y`, `stair.group`. | **Bypasses CommandManager!** Calls `debouncedSaveHistory()` only. No `MoveCommand`! | Resolves host platform via `SpatialHostResolver.findHostAt` and attaches. | Bypasses `CommandManager`. Inconsistent with furniture move pipeline. |
| **`src/core/engine2d/Anchor.js`** | 2D Mouse / touch drag on wall corner anchor | Wall end anchors (`startAnchor`, `endAnchor`) | Snaps raw position to grid/walls, checks collisions, moves anchor via `WallEngine.moveAnchor(this, proposedPos, planner, false)`. | Mutates anchor position and attached wall geometry in place. | Uses `SnapshotCommand` initialized in `dragstart` and finalized in `dragend`. | Preserves wall topology and attached arc dimensions. | Correctly uses `SnapshotCommand` and `WallEngine`, but anchor drag is disconnected from multi-object move operations. |
| **`src/core/engine2d/advance_openings.js`** | 2D Mouse / touch drag on opening group | Wall openings (doors, windows, niches, boolean cuts) | Projects pointer onto wall segment vector: `t = ((pos.x - p1.x)*dx + (pos.y - p1.y)*dy) / lenSq`. Clamps `t ∈ [0.05, 0.95]`. Keyboard arrow nudge changes `t ± 0.01`. | Mutates `this.t` directly in `dragmove` and `keydown`. | **Zero Command Integration!** No `dragend` listener, no command created, no undo/redo. | Updates 2D cutter and 3D wall void via `syncAll()`. | Completely unrecorded in history; direct domain mutation on `this.t`. |
| **`src/core/engine2d/PremiumMolding.js`** | 2D Mouse / touch drag on molding visual group | Wall moldings (baseboard, crown, chair rail) | Projects pointer onto wall: `t = wall.getClosestT(pos)`. Clamps and snaps to corners/center. | Mutates `this.t` directly in `dragmove`. | **Zero Command Integration!** In `dragend`, only calls `syncAll()`. | Updates wall geometry and molding ribbon. | Unrecorded in history; direct domain mutation on `this.t`. |
| **`src/features/roof/roof.renderer2d.js`** | 2D Mouse / touch drag on roof group | Roof entities | On `dragend`, computes delta `(dx, dy)`, resets `group.position(0, 0)`, shifts all polygon points: `points.map(pt => ({ x: pt.x + dx, y: pt.y + dy }))`, calls `RoofEngine.setPoints()`. | Mutates `roof.points` array. | Calls `planner.history.record()`. Bypasses `CommandManager` command stack. | Recomputes hip lines and notifies 3D builder. | Translates raw polygon points rather than `(x, y)` origin; in 3D roofs are translated via `(x, y)`. |
| **`src/core/engine2d/PremiumShape.js`** | 2D Mouse / touch drag on shape group | Free/surface shapes (`shape_rect`, `shape_circle`, etc.) | Computes wall proximity snapping, aligns outward normal if snapped to wall, sets `group.position()`. | Mutates `this.group`, `this.parentWallId`, `this.hostId`. | **Bypasses CommandManager!** Calls `debouncedSaveHistory()` on `dragend`. | Attaches to wall via `globalSpatialDependencyEngine.attach` as `SURFACE_ATTACHED`. | Bypasses `CommandManager`. History cannot be undone in sequence with furniture/walls. |
| **`src/core/engine3d/UniversalMoveGizmo.js`** | 3D Pointer drag on gizmo axes / central disk | Openings, rooms, furniture, shapes, stairs, roofs | Intersects ray with virtual horizontal plane at object ground or wall plane. Computes `delta`. Translates mesh, entity, and Konva group live. | Mutates `ent.x`, `ent.y`, `ent.elevation`, `ent.t`, or wall anchors in room mode. | In `_commitTranslationToPlanner()`, calls `plannerInst.move(id, ent.x, ent.y, startPos)`. | Calls `globalSpatialDependencyEngine.onHostTransformed`. | For room move, translates anchors via `WallEngine.moveAnchor` but does NOT push a `SnapshotCommand` or `MoveCommand` for the room! |
| **`src/core/engine3d/InteractionSystem.js:OpeningGizmo`** | 3D Pointer drag on opening 3D bounding box handles | Wall openings (doors, windows) | Projects hit onto host wall: `projT = parentTarget.x / wall.length3D`. Clamps `t ∈ [0.01, 0.99]`. Computes `elevation`. | Mutates `entity.t`, `entity.elevation`, `entity.width`, `entity.height` directly. | **Zero Command Integration!** Only emits `OPENING_GIZMO_END` and calls `syncAll()`. | Triggers `realtimeUpdate.markDirty(entity, 'geometry')`. | Unrecorded in history; direct domain mutation. |
| **`src/core/engine3d/InteractionSystem.js:TransformControls`** | 3D Gizmo drag via Three.js `TransformControls` | Selected 3D entity | Standard Three.js translation along X/Y/Z axes. Synchronizes `ent.x`, `ent.y` via `_syncUI`. | Mutates `ent.x`, `ent.y`, `mesh.position`. | In `_onMoveEnd`, calls `plannerInst.move(id, endX, endY, startPos)`. | Calls `realtimeUpdate.markDirty`. | Duplicate gizmo system coexisting with `UniversalMoveGizmo`. Inconsistent start position caching. |
| **`src/core/engine3d/tools/CommonTransformEngine.js`**<br>`executeMove(entity, deltaPos)` | Programmatic / tool dispatcher | Wall openings, free 3D entities | Adds `deltaPos.x` and `deltaPos.z` to `entity.x` and `entity.y`. For wall openings, computes `newLocalX = (entity.t * wallLength) + deltaPos.x`. | Mutates `entity.x`, `entity.y`, `entity.t`, `mesh3D.position`, `entity.group`. | **Zero Command Integration!** Directly mutates domain entity without creating or executing a command. | Calls `globalSpatialDependencyEngine.onHostTransformed`. | Strictly confined to 3D; direct mutation bypasses CommandManager. |

---

## Section B: Current Spin / Rotation Implementations

The following table comprehensively details all existing rotation mechanisms in the project:

| Subsystem / File | Trigger / Input | Object Types Handled | Rotation Math & Center Pivot | State Mutations | History / Command Integration | Spatial / Host Dependency Sync | Identified Architectural Issues |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`src/core/engine2d/index.js`**<br>`_applyRotate(id, angle)` | Internal command executor (invoked by `RotateCommand`) | Furniture, shapes, stairs, platforms | Single scalar angle in degrees: `entity.rotation = angle; entity.group.rotation(angle);`. | Mutates `entity.rotation`, `entity.group.rotation`. | Authoritative executor for `RotateCommand`. | If attached to host, recomputes local transform; if host, notifies dependents via `onHostTransformed`. | Rotates strictly around entity origin `(x, y)` without adjusting position for off-center pivots. |
| **`src/features/furniture/furniture.renderer2d.js`** | 2D Mouse / touch drag on `this.rotHandle` | Furniture entities | `angleRad = Math.atan2(pos.y - group.y(), pos.x - group.x()); this.rotation = (angleRad * 180 / Math.PI) + 90;`. | Mutates `this.rotation`, `this.group.rotation()` live in `dragmove`. | On `dragend`, reverts rotation and calls `planner.rotate(this.id, endRot)`. | Emits `EntityTransformUpdated2D`. | Reversion hack causes visual jump; does not snap to angles; duplicates `atan2` calculation. |
| **`src/core/engine2d/PremiumPlatform.js`** | 2D Mouse / touch drag on `this.rotHandle` | Platform entities | `angle = Math.atan2(hPos.y, hPos.x) * 180 / Math.PI + 90;` Snaps to 45° if within 5°. | Mutates `this.rotation`, `this.group.rotation()`, calls `_sync3DTransform()`. | **Bypasses CommandManager!** Calls `debouncedSaveHistory()` only. No `RotateCommand`! | Calls `globalSpatialDependencyEngine.onHostTransformed`. | Platform rotation cannot be undone cleanly via `CommandManager.undo()`. |
| **`src/features/stairs/stairs.renderer2d.js`** | 2D Mouse / touch drag on `this.rotHandle` | Staircase entities | `angleRad = Math.atan2(pos.y - groupPos.y, pos.x - groupPos.x); newRot = (angleRad * 180 / Math.PI) - 90;` Snaps to 15°. Calls `StairEngine.setRotation()`. | `StairMutationEngine.setRotation` mutates `stair.rotation`, `stair.group.rotation()`. | **Bypasses CommandManager!** Calls `debouncedSaveHistory()` on `dragmove`. No `RotateCommand`! | Refreshes stair geometry and 3D mesh. | Fires `debouncedSaveHistory` on every dragmove frame! Bypasses `CommandManager`. |
| **`src/core/engine2d/PremiumShape.js`** | 2D Mouse / touch drag on `this.rotHandle` or `transform` | Shape entities | `angleRad = Math.atan2(pos.y - groupPos.y, pos.x - groupPos.x); this.rotation = (angleRad * 180 / Math.PI) + 90;`. | Mutates `this.rotation`, `this.group.rotation()`. | **Zero Command Integration!** In `dragend`, only calls `syncAll()`. No history saved! | Updates shape geometry. | Rotation completely unrecorded in history; direct domain mutation. |
| **`src/core/engine3d/UniversalSpinGizmo.js`** | 3D Pointer drag on spin ring / cardinal knobs (0°, 90°, 180°, 270°) | Furniture, stairs, shapes, roofs, elevation widgets | Projects pointer onto horizontal plane, computes polar angle around mesh bottom center. Applies magnetic snapping (3.5° latch to 15°/45°). Delegates to `CommonTransformEngine.executeSpin`. | Mutates `entity.rotation`, `entity.x`, `entity.y`, `mesh.rotation.y`, `mesh.position`. | **CRITICAL BUG: Double Undo Entry!** In `_commitRotationToPlanner()`, calls `plannerInst.rotate(...)` **AND** `plannerInst.move(...)`. | Emits `EntityTransformUpdated`. | Two separate commands pushed for a single rotation gesture; breaks `Ctrl+Z` undo sequence. |
| **`src/core/engine3d/InteractionSystem.js`**<br>`rotateSelectedObjectSims4(deltaDeg = 45)` | Right-click tap (button === 2) or drag in 3D viewport | Selected 3D entity | Increments rotation by 45° via `CommonTransformEngine.executeSpin(ent, deltaDeg)`. | Mutates `ent.rotation`, `ent.x`, `ent.y`. | **Tap: Zero Command Integration!**<br>**Drag:** In `_onPointerUp`, calls `plannerInst.rotate(...)` only, ignoring `(x, y)` shift! | Updates Sims 4 footprint and selection highlight. | Tap rotation cannot be undone. Drag rotation commits rotation without position, leaving model position desynchronized on undo. |
| **`src/core/engine3d/InteractionSystem.js`**<br>`_onTouchStart/_onTouchMove/_onTouchEnd` | 2-Finger Touch Twist gesture on touchscreens | Selected 3D entity | Computes 2-touch angle delta: `curAngle = atan2(t2.y - t1.y, t2.x - t1.x) * 180 / Math.PI`. Snaps to 15°. Delegates to `CommonTransformEngine.executeSpin`. | Mutates `ent.rotation`, `ent.x`, `ent.y`. | In `_onTouchEnd`, calls `plannerInst.rotate(id, ent.rotation)` only. | Updates `UniversalSpinGizmo` heading arrow live. | Position delta computed by `executeSpin` is discarded on commit; undo leaves model displaced. |
| **`src/core/engine3d/InteractionSystem.js:TransformControls`** | 3D Rotate Ring on Three.js `TransformControls` | Selected 3D entity | Standard Three.js Euler rotation around Y axis: `endRotDegrees = -(endRotRad * 180 / Math.PI)`. | Mutates `ent.rotation`, `mesh.rotation.y`. | In `_onRotateEnd`, calls `plannerInst.rotate(id, endRotDegrees)`. | Calls `realtimeUpdate.markDirty`. | Rotates around local Three.js origin, not geometric bounding box center; conflicts with `UniversalSpinGizmo`. |
| **`src/core/engine3d/tools/CommonTransformEngine.js`**<br>`executeSpin(entity, deltaDeg, absoluteDeg)` | Programmatic / tool dispatcher | All rotatable entities | **Closed-Form Geometric Center Pivot:** Computes `localCenter = getObjectLocalCenter(mesh)`. Computes world center `worldCenter = pos + rotOffset`. Computes new position `newPos = worldCenter - newRotOffset` so world center remains 100% stationary. | Mutates `entity.rotation`, `entity.x = newPos.x`, `entity.y = newPos.z`, `mesh.position`, `mesh.rotation.y`. | **Zero Command Integration!** Does not create or execute any command. | Calls `globalSpatialDependencyEngine.onHostTransformed`. | Alters both rotation AND position, but caller must handle commands; callers frequently forget position. |
| **`src/core/engine3d/RoomInteractiveSuite.js`**<br>`rotateRoom(degrees = 90)` | Room interactive HUD button (CW/CCW 90°) | Rooms & bounding walls | Computes room centroid `(cx, cy)`. Rotates all bounding wall anchors using trigonometric rotation: `rx = cx + (x - cx)cos - (y - cy)sin`. Rotates platforms. | Moves anchors via `WallEngine.moveAnchor`. Rotates associated platform points. | Creates `SnapshotCommand` initialized before anchor moves and executed after. | Calls `WallEngine.sync(planner)`. | Standalone implementation for rooms; isolated from general entity rotation system. |
| **`src/composables/useKeyboardShortcuts.js`** & `CommonInteractionController.js` | Keyboard shortcut key 'R' | Selected 3D entity | Dispatches `SHORTCUT_ACTIONS.SPIN` -> `transformEngine.executeSpin(selectedEntity, 90)`. | Mutates `entity.rotation`, `entity.x`, `entity.y`. | **Zero Command Integration!** Shortcut rotation is completely absent from CommandManager undo history! | Emits `EntityTransformUpdated3D`. | User cannot undo 'R' keyboard rotations. |
| **UI Property Panels**<br>(`ShapePanel.vue`, `furniture.properties.vue`) | Number input / Range slider in right sidebar | Selected shape / furniture | Binds `v-model.number="selectedEntity.rotation"` directly to domain entity, emits `@input="$emit('sync-engine')"`. | Mutates `selectedEntity.rotation` directly on input. | **Zero Command Integration!** Slider dragging produces zero commands in `CommandManager`. | Calls `selectedEntity.update2D()` and `planner.syncAll()`. | Bypasses `CommandManager`. User edits in sidebar cannot be undone via `Ctrl+Z`. |

---

## Section C: Duplicate Logic & Mathematical Redundancies

### 1. 2D Angle Calculation Duplication
The exact trigonometric angle calculation is duplicated across 4 distinct renderers:
```javascript
// furniture.renderer2d.js (line 119):
const angleRad = Math.atan2(pos.y - this.group.y(), pos.x - this.group.x());
this.rotation = (angleRad * 180 / Math.PI) + 90;

// PremiumPlatform.js (line 299):
const hPos = this.rotHandle.position();
let angle = Math.atan2(hPos.y, hPos.x) * 180 / Math.PI + 90;

// stairs.renderer2d.js (line 236):
const angleRad = Math.atan2(pos.y - groupPos.y, pos.x - groupPos.x);
let newRot = (angleRad * 180 / Math.PI) - 90; // Notice: -90 vs +90 inconsistency!

// PremiumShape.js (line 292):
const angleRad = Math.atan2(pos.y - groupPos.y, pos.x - groupPos.x);
this.rotation = (angleRad * 180 / Math.PI) + 90;
```
*Note the bug:* `stairs.renderer2d.js` uses `- 90`, while furniture, shapes, and platforms use `+ 90`. This leads to $180^\circ$ orientation discrepancies between staircases and other objects.

### 2. Duplicate 3D Ground Plane Raycasting
Both `UniversalMoveGizmo.js` and `InteractionSystem.js` construct their own independent Three.js `Raycaster` and `THREE.Plane(new THREE.Vector3(0, 1, 0))` to detect ground intersection coordinates.
- `UniversalMoveGizmo._onPointerMove`: Casts ray against internal horizontal plane at `startMeshPos.y`.
- `InteractionSystem._onPointerMove`: Casts ray against `this.dragPlane` for `OpeningGizmo`.
- `TransformControls.js`: Embeds its own internal plane raycasting logic.

### 3. Duplicate Angle Snapping Algorithms
Angle snapping is independently written in 5 separate locations:
1. `UniversalSpinGizmo._applyMagneticSnapping`: Has a 3.5° magnetic latch zone, 15° default step, 45° Shift key lock, and 0.1° Alt key override.
2. `InteractionSystem._onTouchMove`: Hardcoded `Math.round(targetAngle / 15) * 15`.
3. `PremiumPlatform._bindEvents`: Hardcoded `if (Math.abs(angle % 45) < 5) angle = Math.round(angle / 45) * 45;`.
4. `stairs.renderer2d.initHandles`: Hardcoded `Math.round(newRot / 15) * 15`.
5. `smartGuides.calculateAngleSnap`: Custom 45° angle snap against reference anchors.

### 4. Pivot Center Discrepancy (Geometric Center vs Local Origin)
- **2D Engine Pivot:** Konva objects rotate around `group.offsetX()` and `group.offsetY()`. For furniture, `offsetX = width / 2; offsetY = depth / 2;`. For platforms and shapes, the origin is either `(0, 0)` or center depending on shape type.
- **3D Engine Pivot (`CommonTransformEngine.executeSpin`):** Calculates `getObjectLocalCenter(mesh)` traversing child geometries, determining a 3D bounding box center $(C_x, C_y, C_z)$, and translating $(x, y)$ in world space so that the world center remains stationary.
- **Problem:** Because 2D does NOT perform world position compensation when rotating around non-center origins, an object rotated in 2D rotates around its local Konva anchor, whereas the same object rotated in 3D rotates around its 3D bounding box centroid. This causes the object to visually shift position when switching views!

---

## Section D: Direct Mutations Classification

To prevent bugs and satisfy architectural requirements, direct property mutations across the codebase are classified into three distinct categories:

### Group 1: Permissible Transient Preview Mutations (Allowed & Expected)
These are live, high-frequency (60 FPS) visual synchronization updates that occur during an active pointer drag *before* pointer release:
- Setting `mesh.position.set(x, y, z)` and `mesh.rotation.y = rad` during live gizmo dragging to provide immediate visual feedback.
- Setting `group.position({ x, y })` and `group.rotation(deg)` during live 2D dragging.
- Updating HUD badges, coordinate leader lines, and smart guide overlays during active drag.
- Marking render flags (`ctx.requestRender('drag')`, `realtimeUpdate.markDirty(ent, 'transform')`).

### Group 2: Harmful Domain Property Bypasses (Must Route Through TransformEngine & CommandManager)
These are permanent mutations that write directly to canonical domain entities without passing through `CommandManager`, preventing undo/redo and breaking serialization:
- `PremiumPlatform.js:285`: `this.x = Math.round(this.group.x()); this.y = Math.round(this.group.y());` followed by `debouncedSaveHistory()`.
- `PremiumPlatform.js:302`: `this.rotation = Math.round(angle);` followed by `debouncedSaveHistory()`.
- `stairs.renderer2d.js:176`: `StairEngine.setPosition(...)` followed by `debouncedSaveHistory()`.
- `stairs.renderer2d.js:239`: `StairEngine.setRotation(...)` followed by `debouncedSaveHistory()`.
- `advance_openings.js:78`: `this.t = Math.max(0.05, Math.min(0.95, t));` on `dragmove` with no `dragend` command.
- `advance_openings.js:98`: Arrow key nudging `this.t` with no command.
- `PremiumMolding.js:83`: `this.t = t;` with no command.
- `PremiumShape.js:284`: `this.rotation = ...` with no command or history save.
- `InteractionSystem.js:660`: `this.commonController.transformEngine.executeSpin(ent, deltaDeg)` on single right-click with no command.
- `CommonInteractionController.js:263`: `this.transformEngine.executeSpin(this.selectedEntity, 90)` on 'R' key with no command.
- `ShapePanel.vue:5` & `furniture.properties.vue:4`: `v-model.number="selectedEntity.rotation"` mutating domain objects directly.

### Group 3: Command Asynchrony & Compound Mutation Desynchronization
These are operations that alter multiple tightly coupled domain properties (such as position AND rotation) but only record one property in `CommandManager`, or record them as separate fragmented commands:
- `UniversalSpinGizmo.js:601`: Commits `plannerInst.rotate(id, rot)` followed immediately by `plannerInst.move(id, x, y)`. Results in **two distinct undo operations** for a single spin gesture!
- `InteractionSystem.js:1158` (Sims 4 drag spin) & `InteractionSystem.js:1250` (Touch twist): Both invoke `executeSpin` (which changes `rotation`, `x`, and `y`), but on drag end they only call `plannerInst.rotate(id, ent.rotation)`, completely discarding the `(x, y)` shift from history!

---

## Section E: Recommended Target Architecture (`TransformEngine.js`)

To solve all audited issues, we propose establishing a unified, authoritative transformation system centered around `src/core/transform/TransformEngine.js`.

### 1. Architectural Layers & Separation of Concerns

```mermaid
graph TD
    subgraph Input_Adapters ["Input Adapters (Transient 60 FPS)"]
        A1["2D Drag Handler (Mouse/Touch)"]
        A2["3D UniversalMoveGizmo"]
        A3["3D UniversalSpinGizmo"]
        A4["3D Touch Twist & Sims 4"]
        A5["Keyboard 'R' / Arrow Nudge"]
        A6["UI Sidebar Property Sliders"]
    end

    subgraph Transform_Session ["TransformEngine Live Session"]
        B1["startSession(entity, operation, initialCoords)"]
        B2["updateSession(delta / targetCoords)"]
        B3["commitSession()"]
        B4["cancelSession()"]
    end

    subgraph Command_Authority ["Command & History Authority"]
        C1["TransformCommand (Atomic Move + Rotate + Elevation + t)"]
        C2["CommandManager.execute(cmd)"]
    end

    subgraph Domain_Delegation ["Subsystem Domain Authority"]
        D1["WallEngine (Wall Anchors & Miters)"]
        D2["StairEngine (Staircase Kinematics)"]
        D3["RoofEngine (Roof Pitch, Overhangs & Points)"]
        D4["SpatialDependencyEngine (Host/Children)"]
        D5["Platform / Shape / Furniture Updaters"]
    end

    subgraph View_Synchronizers ["View Synchronizers"]
        E1["2D Canvas Sync (update2D, batchDraw)"]
        E2["3D Viewport Sync (mesh3D, updateMatrixWorld)"]
        E3["HUD & Property Panel Sync"]
    end

    Input_Adapters -->|dragstart / interaction start| B1
    Input_Adapters -->|live drag / 60 FPS preview| B2
    Input_Adapters -->|dragend / pointerup / commit| B3
    Input_Adapters -->|escape / cancel| B4

    B3 --> C1
    C1 --> C2

    C2 -->|execute() / undo() / redo()| D1
    C2 -->|execute() / undo() / redo()| D2
    C2 -->|execute() / undo() / redo()| D3
    C2 -->|execute() / undo() / redo()| D4
    C2 -->|execute() / undo() / redo()| D5

    D1 --> View_Synchronizers
    D2 --> View_Synchronizers
    D3 --> View_Synchronizers
    D4 --> View_Synchronizers
    D5 --> View_Synchronizers
```

### 2. Core Components of the Target System

#### A. Unified `TransformCommand.js` (`src/core/commands/TransformCommand.js`)
Currently, `MoveCommand` only stores `(startPos, endPos)` and `RotateCommand` only stores `(startRot, endRot)`.  
We replace or augment these with an atomic `TransformCommand`:
- Stores `entityId`, `entityType`.
- Stores `beforeState: { x, y, elevation, rotation, t, points }`.
- Stores `afterState: { x, y, elevation, rotation, t, points }`.
- In `execute()`: Applies `afterState` in a single transaction, routes to the appropriate subsystem engine, notifies `SpatialDependencyEngine`, and triggers a single scene redraw.
- In `undo()`: Applies `beforeState` in a single transaction, fully restoring both rotation AND position simultaneously.
- **Guarantee:** A single spin or move gesture produces **exactly ONE entry** in `CommandManager.undoStack`.

#### B. Authoritative `TransformEngine.js` (`src/core/transform/TransformEngine.js`)
A centralized engine that handles all transformation logic independently of whether the call came from 2D, 3D, Touch, Mouse, or UI:
- **`start(entity, sessionType)`**: Records initial state before any transformation begins.
- **`previewMove(entity, delta, options)`**: Updates transient visual preview in 2D and 3D at 60 FPS without polluting history.
- **`previewSpin(entity, angleDeg, options)`**: Evaluates pivot center (geometric center or custom pivot), calculates compensation vector $(\Delta x, \Delta y)$, snaps angle to configured increments (15°, 45°, 90°, magnetic zone), and updates preview.
- **`commit(entity)`**: Creates and executes a single `TransformCommand` via `planner.commandManager.execute()`.
- **`cancel(entity)`**: Restores initial state cleanly if user presses Escape or aborts drag.
- **`executeDiscreteStep(entity, { deltaRotation, deltaPosition, deltaElevation })`**: For discrete actions like keyboard 'R' (90° spin), arrow key nudges, or right-click Sims 4 taps, immediately creates and executes a `TransformCommand`.

#### C. Unified Pivot Calculation
Standardize the rotation pivot definition across 2D and 3D:
- For objects with defined footprints (furniture, stairs, shapes, platforms), rotation strictly computes around their **authoritative 2D centroid / 3D bounding box center**.
- The coordinate translation compensation formula:
  $$\vec{C}_{world} = \vec{P}_{orig} + \mathbf{R}(\theta_{orig}) \vec{C}_{local}$$
  $$\vec{P}_{new} = \vec{C}_{world} - \mathbf{R}(\theta_{new}) \vec{C}_{local}$$
  is calculated uniformly by `TransformEngine`, ensuring that the object stays centered at the exact same world spot in both 2D and 3D.

#### D. Subsystem Delegation Rules
`TransformEngine` delegates domain operations to their respective authorities:
1. **Wall Anchors:** Delegates to `WallEngine.moveAnchor(anchor, newPos, planner, false)`.
2. **Wall Openings (`t` along wall):** Computes `newT`, clamps to wall bounds, updates `entity.t`, and refreshes wall void cuts.
3. **Stairs:** Delegates to `StairEngine.setPosition` and `StairEngine.setRotation`, but wraps the operation inside `TransformCommand` so history is preserved.
4. **Roofs:** Translates `points` and `(x, y)` consistently, delegating to `RoofEngine.setPoints` / `setRotation`.
5. **Spatial Dependency:** Calls `globalSpatialDependencyEngine.onHostTransformed(entity, planner)` to cascade transformations to mounted child entities (e.g. decor on platforms or tables).

---

## Conclusion & Next Steps

This audit establishes the full map of transformation logic across the application.  
**DO NOT MODIFY CODE YET.**  
Once this audit report is approved by the user, the next step is to formulate the detailed **Implementation Plan** (`implementation_plan.md`) outlining the incremental refactoring phases, migration of existing gizmos and renderers, backwards-compatibility assurances, and unit test suites.

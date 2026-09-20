---
name: Vertical Dependency & Building Rise Expert
description: Complete unified guide for vertical dependency propagation, building rise, floor/platform height sync, stacked walls, resting roofs, attached moldings, openings, and staircase adaptations in 2D/3D.
---

# Vertical Dependency & Building Rise Expert Skill

This skill defines the complete authoritative pipeline for vertical dependencies, parametric wall-rise propagation, building rise, multi-story level coordination, and in-place CAD/BIM vertical synchronization.

When any lower wall, floor, platform, or building level changes height or elevation, every dependent element above it automatically recalculates and adjusts its vertical position while preserving its relative position, attachment, alignment, and connections.

---

## 1. Architecture & Primary Files

| Component / Module | Absolute File Path | Description |
| :--- | :--- | :--- |
| **Vertical Propagation Engine** | [VerticalPropagationEngine.js](file:///d:/business/android-planner/src/core/vertical/VerticalPropagationEngine.js) | Central authority orchestrating all vertical propagation events (walls, levels, platforms, roofs, moldings, openings, furniture, stairs). |
| **Wall Mutation Engine** | [WallMutationEngine.js](file:///d:/business/android-planner/src/core/wall/WallMutationEngine.js) | Wall height/elevation mutation authority; triggers VDE events on `setHeight`, `setElevation`, and `batchUpdate`. |
| **Wall Height Policy** | [WallHeightPolicy.js](file:///d:/business/android-planner/src/core/wall/WallHeightPolicy.js) | Enforces wall height boundaries (20–1000 cm), drag snapping (5 cm), input snapping (1 cm), and presets. |
| **Wall Height Transaction** | [WallHeightTransaction.js](file:///d:/business/android-planner/src/core/wall/WallHeightTransaction.js) | Manages atomic live drag transactions and single-step Undo/Redo (`SnapshotCommand`) for height adjustments. |
| **Wall Connectivity** | [WallConnectivity.js](file:///d:/business/android-planner/src/core/wall/WallConnectivity.js) | Resolves wall dependency scopes: single wall (`'wall'`), connected chain (`'connected'`), or room (`'room'`). |
| **Wall Height Gizmo (3D)** | [WallHeightGizmo.js](file:///d:/business/android-planner/src/core/engine3d/WallHeightGizmo.js) | Interactive 3D handles for individual wall height (center arrow) and sloped top heights (start/end handles). |
| **Room Interactive Suite (3D)** | [RoomInteractiveSuite.js](file:///d:/business/android-planner/src/core/engine3d/RoomInteractiveSuite.js) | Handles 3D Room Lift & Building Rise gizmos, live drag height interpolation, and in-place `_syncRoofs()`. |
| **Wall 2D Raiser Renderer** | [wall.renderer2d.js](file:///d:/business/android-planner/src/features/wall/wall.renderer2d.js) | Renders 2D interactive height drag handles (`raiserGroup`, `raiserHit`, `raiserBg`, `raiserText`) on wall midpoints. |
| **Roof Geometry Engine** | [RoofGeometryEngine.js](file:///d:/business/android-planner/src/core/roof/RoofGeometryEngine.js) | Mathematical authority for spatial wall detection under roofs (`getWallsUnderRoof`, `getMaxWallTopUnderRoof`). |
| **Roof Mutation Engine** | [RoofMutationEngine.js](file:///d:/business/android-planner/src/core/roof/RoofMutationEngine.js) | Synchronizes roof elevations with supporting walls and dispatches in-place 3D updates. |
| **Roof 3D Builder** | [Roof3DBuilder.js](file:///d:/business/android-planner/src/features/roof/builders/Roof3DBuilder.js) | Builds 3D roof geometry; tracks resting roofs bi-directionally (up/down); tags `roofGroup` and removes duplicates. |
| **Level Elevations Helper** | [levelElevations.js](file:///d:/business/android-planner/src/core/engine3d/helpers/levelElevations.js) | Computes cumulative level elevations based on authoritative wall heights and level configurations. |
| **Level Manager Composable** | [useLevelManager.js](file:///d:/business/android-planner/src/composables/useLevelManager.js) | Manages multi-story floor switching, stacked wall projection (`parentWallId`), and level height modifications. |
| **3D Molding Renderer** | [molding.renderer3d.js](file:///d:/features/molding/molding.renderer3d.js) | Dynamic top-anchoring for crown moldings/cornices ($wH - mH$) and bottom-anchoring for baseboards ($0$). |
| **Stair Height Detector** | [StairHeightDetector.js](file:///d:/business/android-planner/src/features/stairs/StairHeightDetector.js) | Automatically recalculates staircase step counts and riser heights (`recalculateStairForHeight`) when floor heights change. |
| **Furniture Placement System** | [Furniture3DPlacementSystem.js](file:///d:/business/android-planner/src/core/engine3d/Furniture3DPlacementSystem.js) | Detects platform heights during raycasting, sets `hostPlatformId`, and snaps furniture to `platformTop`. |
| **2D Engine State Serializer** | [index.js](file:///d:/business/android-planner/src/core/engine2d/index.js) | Serializes/restores vertical dependency metadata (`elevation`, `hostPlatformId`, `hostFurnitureId`, `relativeElevation`). |

---

## 2. Dependency Propagation Chain & Mathematical Foundations

### The Core Formula
$$\text{WorldElevation} = \text{HostSurfaceElevation} + \text{RelativeElevation}$$

### Propagation Flow
```
                      ┌────────────────────────────────────────┐
                      │              Source Change             │
                      │  (Wall Height, Elevation, or Level)    │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │       VerticalPropagationEngine        │
                      └───────────┬──────────────────┬─────────┘
                                  │                  │
         ┌────────────────────────┼──────────────────┼────────────────────────┐
         ▼                        ▼                  ▼                        ▼
┌──────────────────┐    ┌──────────────────┐   ┌───────────┐    ┌───────────────────────────┐
│ Upper Levels     │    │ Stacked Walls    │   │   Roofs   │    │ Wall Elements             │
│ Level 1 +ΔH      │    │ parentWallId     │   │ Resting   │    │ • Crown Moldings (top)    │
│ Level 2 +2ΔH     │    │ WorldElev =      │   │ Follows   │    │ • Baseboards (bottom)     │
│ 3D Group Y-shift │    │ HostTop + Rel    │   │ Wall Top  │    │ • Windows/Openings (clamp)│
└──────────────────┘    └──────────────────┘   │ (Up/Down) │    │ • Sunshades, Art, Curtains│
                                               └───────────┘    └───────────────────────────┘
```

1. **Lower Wall $\pm\Delta H$**:
   - Updates Wall top: $\text{top} = \text{elevation} + \text{height}$.
   - Notifies `VerticalPropagationEngine.onWallHeightChanged(wall, newH, prevH, planner)`.
2. **Level Height Synchronization**:
   - Level height updates if wall is tallest: $\text{level.height} = \max_{w \in \text{levelWalls}}(w.\text{height})$.
   - Cumulative level elevations recalculate: $\text{LevelElevation}_i = \sum_{k=0}^{i-1} \text{LevelHeight}_k$.
   - Upper level 3D groups shift along $Y$ in place: `structureGroup.position.y = LevelElevation_i`.
3. **Stacked Walls (`parentWallId`)**:
   - Secondary walls placed atop lower walls update their elevation:
     $$\text{wall.elevation} = \text{parentWall.elevation} + \text{parentWall.height} + \text{relativeElevation}$$
4. **Roofs Resting on Walls**:
   - Identified via `_restingOnWalls === true` or initial placement at `maxWallTop`.
   - Strictly follow supporting wall tops **both upward and downward**:
     $$\text{roof.elevation} = \text{maxWallTop}$$
5. **Moldings & Trims**:
   - **Crown Moldings / Cornices / Friezes** (`anchorMode: 'top'`):
     $$\text{heightOffset} = \max(0, \text{wallHeight} - \text{moldingHeight})$$
   - **Baseboards / Skirtings** (`anchorMode: 'bottom'`):
     $$\text{heightOffset} = 0$$
6. **Openings (Doors, Windows, Jali)**:
   - Clamped so they never punch out above the wall top:
     $$\text{opening.elevation} = \max(0, \min(\text{opening.elevation}, \text{wallHeight} - \text{opening.height}))$$
   - Doors are strictly floor-anchored ($\text{elevation} = 0$).
7. **Platforms & Furniture**:
   - Platforms update hosted furniture:
     $$\text{furniture.elevation} = \text{platform.elevation} + \text{platform.height} + \text{relativeElevation}$$
8. **Staircases**:
   - Floor-to-floor spanning staircases automatically recalculate steps, treads, and risers to fit the new height:
     $$\text{riserHeight} = \frac{\Delta H}{\text{numSteps}} \quad (15\text{ cm} \le \text{riserHeight} \le 20\text{ cm})$$

---

## 3. Wall Raiser System & Interactive Behaviors (2D & 3D)

The **Wall Raiser** system provides unified, bidirectional 2D and 3D interactions for adjusting wall heights, sloped gables, room walls, and building-wide rises.

### 1. 2D Wall Raiser Handle & Badge (`wall.renderer2d.js`)
- **Visual Handle**: A Konva group (`raiserGroup`) placed at the wall centerline midpoint:
  - `raiserBg`: Rounded pill background with elevation-styled accent colors.
  - `raiserText`: Real-time numerical badge showing current wall height (e.g., `280 cm`).
  - `raiserHit`: Expanded invisible touch/click hit area for smooth desktop and mobile pointer dragging.
- **Drag Interaction**:
  - Vertical pointer drag translates pixel displacement into height delta: $\Delta H = -\Delta Y \times \text{scale}$.
  - Snaps live to $5\text{ cm}$ increments via `WallHeightPolicy.processDragHeight`.
  - Live visual feedback via `wall.updateRaiserBadge(newHeight)` and `wall.positionRaiserHandle()`.
- **Serialization Safety**:
  - `WallSerializer.serialize(wall)` explicitly omits `raiserGroup`, `raiserHit`, `raiserBg`, and `raiserText`, preventing Konva circular references from corrupting JSON state.

### 2. 3D Wall Height Gizmo (`WallHeightGizmo.js`)
- **Target**: Single selected wall or sloped wall profile.
- **Handles**:
  1. **Center-Top Vertical Arrow**: Adjusts uniform wall height (`w.height`) with a floating Sims-styled HUD badge.
  2. **Left-Top Handle**: Adjusts `startHeight` for sloped profiles (`w.topProfileType = 'single'` or `'gable'`).
  3. **Right-Top Handle**: Adjusts `endHeight` for sloped profiles.
- **Viewport Adaptation**:
  - Scales handles inversely with camera distance to preserve constant screen-space hit targets.
  - Enables camera orbit freeze (`ctx.controls.enabled = false`) during active pointer drag.

### 3. 3D Room Lift & Building Rise Suite (`RoomInteractiveSuite.js`)
- **Target**: Room bounding walls or entire multi-wall building structures.
- **Gizmo Visuals**:
  - Volumetric center-room double-arrow gizmo (`up` and `down` cones) rendered at $Y = \text{elev} + \text{wallH} \times 0.45$.
  - Billboards dynamically to face camera azimuth: `_updateGizmoFacing()`.
- **Interactive Scopes**:
  - **Single Wall Scope (`'wall'`)**: Modifies only the selected wall.
  - **Connected Chain Scope (`'connected'`)**: Traverses `WallConnectivity.getScopeWalls(wall, 'connected')` to adjust all walls sharing corner anchors.
  - **Room Scope (`'room'`)**: Modifies all bounding walls of the room and updates `room.wallHeight`.
  - **Building Scope (`'building'`)**: Modifies all non-hidden, non-railing walls across the entire building (`setAllWallsHeight`).
- **Real-Time 60 FPS Drag Optimization**:
  - Tracks `_lastLiveWallHeight` to avoid redundant mutations.
  - Dispatches `this.ctx.requestRender('live_wall_height_drag')`.
  - Smoothly updates resting roofs in 3D during drag via `_baseRoofY + heightDiff`.

### 4. Policy, Transactions & Undo/Redo Lifecycle
- **`WallHeightPolicy.js`**:
  - **Safe Clamping**: $20\text{ cm} \le h \le 1000\text{ cm}$.
  - **Interactive Drag Snapping**: $5\text{ cm}$ increments via `WallHeightPolicy.snap(h, 5)`.
  - **Numerical Input Snapping**: $1\text{ cm}$ precision via `WallHeightPolicy.snap(h, 1)`.
  - **Standard Presets**: $240\text{ cm}$, $280\text{ cm}$, $300\text{ cm}$, $360\text{ cm}$.
- **`WallHeightTransaction.js`**:
  - `begin(wall, scope)`: Captures pre-drag snapshot via `SnapshotCommand`.
  - `update(newHeight)`: Mutates walls via `WallEngine.batchUpdate` without polluting the undo stack during pointer movement.
  - `commit()`: Finalizes the transaction, triggers `VerticalPropagationEngine`, and records a single atomic undo/redo command.
  - `rollback()`: Restores original heights if cancelled via Escape.
- **`WallEngine.raiseWall(wall, height, scope, shouldSync, planner)`**:
  - The canonical entry point for all height adjustments across 2D, 3D, sidebars, and keyboard shortcuts.

---

## 4. Mandatory Architectural Rules

### Rule 1: Centralized Propagation Authority (No Ad-Hoc Y-Offsets)
- **Requirement**: NEVER apply direct, uncoordinated Y-position shifts to individual meshes.
- All height and elevation changes MUST route through `WallEngine` and `VerticalPropagationEngine`.
- Vertical dependencies must be derived from parent-child relationships (`parentWallId`, `hostLevelId`, `hostPlatformId`, `_restingOnWalls`).

### Rule 2: Bi-Directional Resting Roof Tracking (UP and DOWN)
- **Requirement**: When a roof rests on supporting walls (`_restingOnWalls !== false`), changing the wall height must adjust the roof elevation **both upward and downward**.
- **Forbidden**: NEVER use `Math.max(roof.elevation, maxWallTop)` without checking `isResting`. Unconditional `Math.max` prevents roofs from ever moving downward when walls are lowered, causing roofs to float in mid-air.
- Always use:
  ```javascript
  if (maxWallTop > 0 && isResting) {
      baseHeight = maxWallTop;
      roof.elevation = maxWallTop;
      roof._restingOnWalls = true;
      roof._lastSyncedWallTop = maxWallTop;
  }
  ```

### Rule 3: Universal In-Place CAD Updates (Zero Duplicate Groups)
- **Requirement**: Adjusting wall height or level elevations must update existing 3D groups in place.
- In `Roof3DBuilder.js`:
  - Tag parent `roofGroup.userData` with `{ isRoof: true, isRoofGroup: true, entity: roof, roofId: roof.id }`.
  - In `targetGroup.add(roofGroup)`, remove and dispose any existing group for that roof ID/entity before adding.
- In `RoomInteractiveSuite.js`:
  - Use `env.updateRoofLive(rf)` to swap geometry and update transforms in place.
  - Purge orphaned roof groups from `structureGroup` that do not match active roofs.
  - Never call `buildRoofs(...)` repeatedly during live wall rises, which stacks duplicate meshes.

### Rule 4: Dynamic Top/Bottom Anchoring for Wall Moldings
- **Requirement**: Wall moldings must declare their anchor reference (`anchorMode: 'top' | 'bottom'`).
- In `molding.renderer3d.js`:
  ```javascript
  const isTopAnchored = molding.anchorMode === 'top' || 
      (molding.profile && (molding.profile.category === 'crown' || molding.profile.category === 'cornice'));
  const heightOffset = isTopAnchored 
      ? Math.max(0, wallHeight - moldingHeight) 
      : (molding.elevation || 0);
  ```

### Rule 5: Platform & Furniture Host Hierarchy
- **Requirement**: Furniture resting on a platform must record `hostPlatformId` and `relativeElevation`.
- In `Furniture3DPlacementSystem.js`:
  - Raycast checks platforms; when placed on a platform, set `item.hostPlatformId = platform.id` and `item.relativeElevation = hitY - platformTop`.
- When the platform moves or changes height, `VerticalPropagationEngine.onPlatformHeightChanged` moves the hosted furniture accordingly.

### Rule 6: Dynamic Staircase Step Adaptation
- **Requirement**: When the vertical span between levels or from floor to platform changes, staircases must adapt their step count and riser height via `StairHeightDetector.recalculateStairForHeight(stair, targetHeight)`.
- Stair geometry must remain physically sound (IRC compliant: 15–20 cm risers, 25–30 cm treads).

### Rule 7: Full Serialization & Persistence Integrity
- All vertical dependency properties MUST be serialized and deserialized:
  - Walls: `hostLevelId`, `relativeElevation`, `anchorMode`.
  - Roofs: `_restingOnWalls`, `_lastSyncedWallTop`, `hostWallIds`.
  - Furniture: `elevation`, `hostPlatformId`, `hostFurnitureId`, `relativeElevation`.
  - Platforms: `isRoomInteriorPlatform`, `associatedRoomId`.

---

## 4. Verification & Testing Checklist

When adding or modifying vertical propagation features, verify that:
1. **Wall Rise**: Increasing lower wall height raises upper levels, stacked walls, resting roofs, and top moldings.
2. **Wall Lower**: Decreasing lower wall height moves resting roofs and top moldings downward flush with the wall top (zero floating roofs).
3. **No Mesh Duplication**: Inspect `structureGroup.children` to ensure roof and wall mesh counts remain strictly constant during and after height adjustments.
4. **Window/Door Clamping**: Lowering a wall below an attached window clamps the window cleanly to the wall top.
5. **Platform Lifts**: Raising/lowering a platform shifts all hosted furniture in 2D and 3D.
6. **Staircase Spanning**: Changing level height updates staircase step count and riser geometry.
7. **Save & Reload**: Exporting to JSON and re-importing preserves all parent-child relationships and resting flags.

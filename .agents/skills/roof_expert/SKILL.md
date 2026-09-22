---
name: Roof Expert
description: Complete unified CAD/BIM guide for parametric roofs, 11 roof topologies, 2D/3D synchronization, in-place GPU vertex buffer updates, architectural detachment, rotated coordinate inversion, multi-mesh groups, first-class overhangs and corner radii, serialization, and mobile/tablet interactions.
---

# Roof Expert Skill

You are an expert on the **Production CAD/BIM Roof Architecture** for this 2D/3D architectural floor planner.

All existing and upcoming roof-related features (tools, 3D builders, gizmos, sidebars, auto-gables, elevation sync, materials, sculptures, and level associations) **MUST strictly adhere to this centralized architecture**.

---

## 1. Architectural Model & Data Flow

```text
                    USER ACTION / TOOLS / GIZMOS / UI
                                   │
                                   ▼
                              RoofEngine
                 (Single Authoritative Public Façade)
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
 RoofMutationEngine        RoofTopologyEngine        RoofGeometryEngine
(Dimensions, Slopes,      (Instantiations, Clones,  (Polygons, Heights, Eaves,
 Overhangs, Detachment)    Deletions, Auto-Gables)   Spatial Wall Detections)
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   ▼
                         Canonical Roof State
                           planner.roofs[]
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
            2D Renderer                         3D Renderer
        (roof.renderer2d.js)               (Roof3DBuilder.js)
            [READ ONLY]                         [READ ONLY]
                 │                                   │
                 ▼                                   ▼
         2D Konva Groups                   EnvironmentBuilder
      (Handles & Wireframe)               (updateRoofLive In-Place)
```

---

## 2. Directory Structure & Key Files

| Module / Component | File Path | Role & Responsibilities |
| :--- | :--- | :--- |
| **Public Façade** | [`RoofEngine.js`](file:///d:/business/android-planner/src/core/roof/RoofEngine.js) | Authoritative public API for all tools, gizmos, and UI. Never mutate `roof` properties directly. |
| **Mutation Authority** | [`RoofMutationEngine.js`](file:///d:/business/android-planner/src/core/roof/RoofMutationEngine.js) | Handles mutations (pitch, overhangs, corner radii, thickness, elevation, curve, materials), dispatches in-place live updates, synchronizes auto-gables. |
| **Topology Authority** | [`RoofTopologyEngine.js`](file:///d:/business/android-planner/src/core/roof/RoofTopologyEngine.js) | Sole factory for `createRoof()`, `duplicateRoof()`, and `deleteRoof()` (with safe targeted auto-gable cleanup). |
| **Geometry Authority** | [`RoofGeometryEngine.js`](file:///d:/business/android-planner/src/core/roof/RoofGeometryEngine.js) | Mathematical authority for polygon footprints, pitch-to-height trigonometry, eaves offsets, and spatial wall detection (`getWallsUnderRoof`, `getMaxWallTopUnderRoof`). |
| **Persistence Engine** | [`RoofSerializer.js`](file:///d:/business/android-planner/src/core/roof/RoofSerializer.js) | Canonical JSON serialization/deserialization, backward-compatibility hydration, and level association. |
| **3D Live Reconciler** | [`EnvironmentBuilder.js`](file:///d:/business/android-planner/src/core/engine3d/EnvironmentBuilder.js) | Executes `updateRoofLive()`: in-place GPU vertex buffer copying for single meshes and structural reconciliation for multi-mesh groups. |
| **3D Master Builder** | [`Roof3DBuilder.js`](file:///d:/business/android-planner/src/features/roof/builders/Roof3DBuilder.js) | Master dispatcher routing roof types to specialized builders; manages `baseHeight` clamping and resting roof elevation. |
| **2D Renderer** | [`roof.renderer2d.js`](file:///d:/business/android-planner/src/features/roof/roof.renderer2d.js) | Konva 2D display; preserves handle instances across live drags, handles group translation and undo history. |
| **Interactive Gizmos** | `src/features/roof/*Gizmo.js` | 3D transform, pitch, curvature, overhang, and corner gizmos with rotated coordinate inversion and touch isolation. |

---

## 3. The 11 Supported Roof Topologies

Every roof entity has a `roofType` stored in `roof.config.roofType`. The engine supports 11 distinct parametric topologies:

| Topology | Key | Special Characteristics & Parameters | Primary 3D Builder |
| :--- | :--- | :--- | :--- |
| **Flat Roof** | `'flat'` | Slab thickness, parapet height, overhangs, perimeter fascia. | [`FlatRoof3DBuilder.js`](file:///d:/features/roof/builders/FlatRoof3DBuilder.js) |
| **Hip Roof** | `'hip'` | 4-way inward sloping rafters meeting at ridge line/apex, fascia eave trim. | [`HipRoof3DBuilder.js`](file:///d:/features/roof/builders/HipRoof3DBuilder.js) |
| **Gable Roof** | `'gable'` | Dual sloping planes, ridge axis (`'x'` or `'y'`), auto-gable triangular wall infill. | [`GableRoof3DBuilder.js`](file:///d:/features/roof/builders/GableRoof3DBuilder.js) |
| **Half Gable (Shed)** | `'half_gable'` / `'shed'` | Single mono-pitch slope, high-side vertical wall, flip direction flag (`flipSlope`). | [`ShedRoof3DBuilder.js`](file:///d:/features/roof/builders/ShedRoof3DBuilder.js) |
| **Mansard Roof** | `'mansard'` | Double slope per side: steep lower curb slope ($60^\circ\text{--}75^\circ$) + shallow upper slope ($15^\circ\text{--}30^\circ$). | [`MansardRoof3DBuilder.js`](file:///d:/features/roof/builders/MansardRoof3DBuilder.js) |
| **Gambrel Roof** | `'gambrel'` | Barn-style dual pitch along ridge: steep lower pitch + shallow upper pitch with gable ends. | [`GambrelRoof3DBuilder.js`](file:///d:/features/roof/builders/GambrelRoof3DBuilder.js) |
| **Saltbox Roof** | `'saltbox'` | Asymmetrical gable with unequal pitch lengths (one side longer than the other). | [`SaltboxRoof3DBuilder.js`](file:///d:/features/roof/builders/SaltboxRoof3DBuilder.js) |
| **Curved / Barrel** | `'curved'` | Parametric curvature `curve` ($-80$ to $+80$) for concave pagoda or convex barrel profiles. | [`CurvedRoof3DBuilder.js`](file:///d:/features/roof/builders/CurvedRoof3DBuilder.js) |
| **Curved Portal / Wrap** | `'curved_portal'` | Modern slab with smooth circular arc fillet transitions (`radius` or `cornerRadii: [r0, r1, r2, r3]`) dropping to vertical exterior walls, optional under-soffit LED downlights (`hasSpotlights`). | [`CurvedPortal3DBuilder.js`](file:///d:/business/android-planner/src/features/roof/builders/CurvedPortal3DBuilder.js) |
| **Glass Atrium** | `'glass_atrium'` | Transparent double-sided glass roof panels with structural aluminum mullions and skylights. | [`GlassRoof3DBuilder.js`](file:///d:/features/roof/builders/GlassRoof3DBuilder.js) |
| **Decorative Accents** | N/A | Crestings, finials, and chimneys attached parametrically along ridges. | [`RoofSculptures3DBuilder.js`](file:///d:/features/roof/builders/RoofSculptures3DBuilder.js) |

---

## 4. Mandatory Architectural Invariants

### Invariant 1: Universal In-Place GPU Vertex Buffer Mutation (60 FPS Performance)
- **Problem**: Calling `new THREE.BufferGeometry()` and recreating meshes 60 times per second during slider drags (pitch, overhang, thickness, elevation) thrashes the GPU VBO allocator and triggers garbage-collection frame drops.
- **Mandate**: In [`EnvironmentBuilder.js:updateRoofLive()`](file:///d:/business/android-planner/src/core/engine3d/EnvironmentBuilder.js#L1982-L2005):
  1. For single-mesh roofs (`oldMesh.isMesh && newMesh.isMesh`):
     - If `oldMesh.geometry.attributes.position.count === newMesh.geometry.attributes.position.count`, copy attributes **in place**:
       ```javascript
       oldMesh.geometry.attributes.position.copy(newMesh.geometry.attributes.position);
       oldMesh.geometry.attributes.position.needsUpdate = true;
       if (oldMesh.geometry.attributes.normal && newMesh.geometry.attributes.normal) {
           oldMesh.geometry.attributes.normal.copy(newMesh.geometry.attributes.normal);
           oldMesh.geometry.attributes.normal.needsUpdate = true;
       }
       if (oldMesh.geometry.attributes.uv && newMesh.geometry.attributes.uv) {
           oldMesh.geometry.attributes.uv.copy(newMesh.geometry.attributes.uv);
           oldMesh.geometry.attributes.uv.needsUpdate = true;
       }
       oldMesh.geometry.computeBoundingBox();
       oldMesh.geometry.computeBoundingSphere();
       newMesh.geometry.dispose(); // Dispose temporary geometry immediately
       ```
     - Only if vertex counts differ (e.g. topology change or different subdivisions), dispose `oldMesh.geometry` and swap references.
  2. For multi-mesh groups (`THREE.Group`, e.g. `curved_portal`):
     - Retain `realRoofGroup` reference on `roof.mesh3D`.
     - Reconcile children in place, disposing obsolete child geometries/materials, and re-registering sub-meshes in `ComponentRegistry`.

### Invariant 2: Architectural Detachment (`_restingOnWalls`)
- **Problem**: When a roof rests on walls, changing wall height should move the roof. However, if a user manually sets an elevation or uses an elevation gizmo to create a detached low porch canopy, subsequent wall height changes must NOT recapture and forcibly move the roof!
- **Mandate**:
  1. `roof._restingOnWalls` tracks whether the roof is resting on supporting walls.
  2. In `RoofMutationEngine.setElevation(roof, elevation, planner, options)`:
     - If `!options.fromWallSync`, explicitly set `roof._restingOnWalls = false`.
  3. In `syncRoofsWithWalls()`:
     - Return early immediately if `rf._restingOnWalls === false`.
  4. In `Roof3DBuilder.js`:
     - When `roof._restingOnWalls === false`, use `baseHeight = Number(roof.elevation) || 0` directly. Do NOT clamp with `Math.max(roof.elevation, maxWallTop)`.

### Invariant 3: Rotated Coordinate Inversion Math in All 3D Gizmos
- **Problem**: When a roof is rotated by angle $\theta$ (in degrees), dragging a 3D gizmo handle produces world-space delta vectors $(\Delta x_w, \Delta z_w)$. Using world vectors directly causes inverted or slanted movement on rotated roofs.
- **Mandate**: Transform world deltas into the roof's local coordinate system using the mathematically exact inverse 2D rotation:
  $$\Delta x_l = \Delta x_w \cos\theta + \Delta z_w \sin\theta$$
  $$\Delta z_l = -\Delta x_w \sin\theta + \Delta z_w \cos\theta$$
- Applied consistently across `FlatRoofGizmo.js`, `GableRoofGizmo.js`, `HalfGableRoofGizmo.js`, `RoofPitchCurvatureGizmo.js`, and `CurvedPortalRoofGizmo.js`.

### Invariant 4: First-Class BIM Overhangs & Corner Radii
- **Master vs Per-Edge Overhangs**:
  - `roof.config.overhang`: Master overhang depth (cm).
  - `roof.config.overhangs`: Array of depths `[o0, o1, o2, o3, ...]` per polygon edge.
  - Polymorphic call `RoofEngine.setOverhang(roof, overhang, edgeIndex, planner)`:
    - If `edgeIndex` is an object, treat as `planner`.
    - If `edgeIndex === null`, update both master `overhang` and fill `overhangs`.
    - Use `RoofEngine.setOverhangs(roof, overhangsArray, planner)` for bulk assignment.
- **Master vs Per-Corner Fillet Radii**:
  - `roof.config.radius` / `roof.radius`: Master fillet radius (cm).
  - `roof.config.cornerRadii` / `roof.cornerRadii`: Array `[r0, r1, r2, r3]` for Left, Right, Front, Back fillet arcs.
  - Polymorphic call `RoofEngine.setCornerRadius(roof, radius, cornerIndex, planner)`:
    - If `cornerIndex` is an object, treat as `planner`.
    - If `cornerIndex === null`, update master `radius` and fill `cornerRadii`.
    - Use `RoofEngine.setCornerRadii(roof, radiiArray, planner)` for bulk assignment.
- Both structures must be serialized in `RoofSerializer.js` and deep-cloned in `RoofTopologyEngine.duplicateRoof()`.

### Invariant 5: 3-Layer CAD/BIM Component & Material Pipeline
All roof geometries must adhere to the 3-layer architecture:
1. Every child mesh MUST attach `userData`:
   ```javascript
   mesh.userData = {
       isRoof: true,
       entity: roof,
       roofId: roof.id,
       materialSlot: slotName,
       componentType: slotName
   };
   ```
2. Every child mesh MUST register with `ComponentRegistry`:
   ```javascript
   ComponentRegistry.registerMesh(roof, slotName, mesh);
   ```
3. Canonical material slots for roofs:
   - `'outer'`: Primary roof rafter/shingle/slab face.
   - `'ceiling'`: Soffit / underside interior finish.
   - `'fascia'`: Perimeter edge trim / rafter tails.
   - `'spotlights'`: Recessed under-soffit fixtures.
   - `'glass'`: Transparent atrium panels.
   - `'mullions'`: Aluminum structural glazing frame.
4. Updates MUST flow through `MaterialManager.updateEntityMaterialSlot()` or `RoofMutationEngine.setMaterialSlot()`.

### Invariant 6: Safe Cascading Deletion & Auto-Gable Isolation
- **Problem**: Deleting a roof must clean up auto-gable walls created for it, but must NEVER delete auto-gable walls belonging to other roofs!
- **Mandate**: In [`RoofTopologyEngine.deleteRoof()`](file:///d:/business/android-planner/src/core/roof/RoofTopologyEngine.js#L237-L245):
  ```javascript
  const autoGablesToDelete = planner.walls.filter(w => w.isAutoGable && w.roofId === roof.id);
  autoGablesToDelete.forEach(w => WallEngine.deleteWall(planner, w));
  ```
- Auto-gable walls (`isAutoGable === true`) must have 2D visibility suppressed in `wall.renderer2d.js` so they do not clutter floor plan views.

### Invariant 7: Curve Lock Invariance (`curve: 0`)
- In `Roof3DBuilder.js`, never use `conf.curve || defaultVal` because $0$ is falsy.
- Always use explicit check:
  ```javascript
  const curve = conf.curve !== undefined ? conf.curve : (conf.roofType === 'curved' ? -20 : 0);
  ```
  This guarantees users can reset a curved roof to completely flat/straight ($0$) without it reverting to $-20$.

### Invariant 8: Mobile & Cross-Device Input Handling
1. **Touch / Pointer Event Isolation**:
   - In all gizmos, explicitly disable `OrbitControls` on handle hit:
     ```javascript
     if (this.ctx.controls) this.ctx.controls.enabled = false;
     ```
   - Cleanly re-enable controls in `_onPointerUp`:
     ```javascript
     if (this.ctx.controls) this.ctx.controls.enabled = true;
     ```
2. **Viewport Boundary Clamping**:
   - All floating badges, dimensions, and HUD buttons must be clamped within screen bounds:
     ```javascript
     const screenX = Math.max(16, Math.min(window.innerWidth - 120, rawX));
     const screenY = Math.max(16, Math.min(window.innerHeight - 60, rawY));
     ```
3. **2D Konva Handle Stability**:
   - In `roof.renderer2d.js`, preserve existing `Konva.Circle` handle instances when vertex count is unchanged. Never destroy and recreate handles during active drag!
   - On `dragend` of the 2D group, compute translation delta $(\Delta x, \Delta y)$, reset group position to $(0, 0)$, update `roof.points` via `RoofEngine.setPoints()`, and record history.

### Invariant 9: Flat Roof Plain Wall Plaster Standard
- Flat roofs (`roofType === 'flat'`) do **not** use textured roof materials (such as `white_gravel_roof`, `terracotta_tiles_roof`, or `dark_asphalt_roof`) by default.
- Flat roofs default strictly to `'white_plaster_wall'` (clean, untextured plain wall plaster), matching host walls.
- In `Roof3DBuilder.js`:
  - `material[0]` (top/bottom terrace slab caps) resolves via `helpers.getDynamicMaterial(matId, 'wall')` and defaults to `'white_plaster_wall'`.
  - `material[1]` (perimeter fascia wall band) resolves via `helpers.getDynamicMaterial(fasciaMatId, 'wall')` and defaults to `'white_plaster_wall'`.
  - If a legacy default roof texture (`white_gravel_roof`, `terracotta_tiles_roof`, `dark_asphalt_roof`) is encountered on a flat roof without explicit user customization, it safely falls back to `'white_plaster_wall'`.
- In `CatalogGallery.vue` and `useAppTools.js`, flat roof presets specify `material: 'white_plaster_wall'`, `specs: '150 mm Slab'`, and `pitch: 0`.

---

## 5. Step-by-Step Implementation Guide for New Roof Features

### Adding a New 3D Roof Builder
1. Create `src/features/roof/builders/MyNewRoof3DBuilder.js`.
2. Implement static `build(roof, conf, pts, h, ctx, resolveRoofMaterial)`.
3. Extract normalized dimensions and materials via `ctx.helpers.getDynamicMaterial`.
4. Construct geometry and tag sub-meshes with `userData.isRoof = true`, `userData.materialSlot = ...`.
5. Register with `ComponentRegistry.registerMesh(roof, slotName, mesh)`.
6. Add builder call in [`Roof3DBuilder.js:buildRoofMesh()`](file:///d:/business/android-planner/src/features/roof/builders/Roof3DBuilder.js).
7. Ensure `EnvironmentBuilder.js:updateRoofLive()` handles the new geometry structure.

### Adding a New Interactive Gizmo Parameter Handle
1. In the respective gizmo (`*Gizmo.js`), create a handle mesh (`THREE.SphereGeometry` or `THREE.CylinderGeometry`).
2. Tag `handle.userData = { isHandle: true, type: 'my_param', axis: ... }`.
3. In `_onPointerDown`, save start value and set `this.ctx.controls.enabled = false`.
4. In `_onPointerMove`, project ray, invert rotated coordinates $(\Delta x_l, \Delta z_l)$, and call the appropriate `RoofEngine` mutation method.
5. In `_onPointerUp`, re-enable `this.ctx.controls.enabled = true` and call `planner.debouncedSaveHistory()`.

---

## 6. Pre-Commit Quality Gate & Verification Checklist

Before finalizing any changes to the roof system, you MUST run all automated test suites and verify:

```bash
cmd /c "npx vitest run src/core/roof src/features/roof"
cmd /c "npx vitest run src/core/vertical src/core/wall"
```

### Verification Checklist:
- [ ] **Zero VBO Thrashing**: Standard single-mesh sliders update geometry in place (`position.copy`) with matching vertex counts.
- [ ] **Detached Elevation Invariance**: Changing wall heights does not recapture or snap roofs with `_restingOnWalls === false`.
- [ ] **Gizmo Inversion**: Dragging handles on a roof rotated at $45^\circ$, $90^\circ$, or $180^\circ$ moves strictly along the local axis.
- [ ] **Serialization Integrity**: Every property in `roof.config` survives `RoofSerializer.serialize()` and `deserialize()`.
- [ ] **Duplication Independence**: Mutating a duplicated roof does not mutate the original roof (`cornerRadii`, `overhangs`, `points` cloned).
- [ ] **Auto-Gable Cleanup**: Deleting a roof deletes only walls with `w.roofId === roof.id`.
- [ ] **Multi-Mesh Group Reconciliation**: `updateRoofLive` on multi-mesh groups (`curved_portal`, `glass_atrium`) completes without property read errors.
- [ ] **142 / 142 Tests Passing**: All tests in `src/core/roof` and `src/features/roof` pass with zero failures.

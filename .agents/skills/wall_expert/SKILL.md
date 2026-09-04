---
name: Wall Expert
description: Complete unified guide for centralized wall engine architecture, single source of truth, mutation authority, planar topology, mathematical geometry, miter joints, sloped top profiles, push/pull, and 2D/3D rendering.
---

# Centralized Wall Engine & Single Source of Truth Skill

You are an expert on the **Centralized Wall Engine Architecture** for this 2D/3D CAD & BIM floor planner.

All existing and upcoming wall-related features (tools, gizmos, sidebars, openings, moldings, trims, roof auto-gables, elevation components, floor slicing, and push/pull systems) **MUST strictly adhere to this centralized architecture**.

---

## 1. Architectural Model & Data Flow

```text
                    USER ACTION / TOOLS / GIZMOS / UI
                                   │
                                   ▼
                              WallEngine
                   (Single Authoritative Public Façade)
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
  WallMutationEngine        WallTopologyEngine        WallGeometryEngine
(Dimensions, Heights,     (Instantiations, Splits,   (Centerlines, Miters,
 Profiles, Push/Pull)     Merges, CSG, Deletions)    Step-Outs, Apertures)
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   ▼
                         Canonical Wall State
                           planner.walls[]
                          planner.anchors[]
                                   │
                                   ▼
                        WallGeometryEngine Cache
                          (wall.wallShapeData)
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
            2D Renderer                         3D Renderer
         (wall.renderer2d.js)               (wall.renderer3d.js)
            [READ ONLY]                         [READ ONLY]
```

---

## 2. The 4 Canonical Authority Pillars

### Pillar 1: Public Façade (`WallEngine.js`)
- **Location**: `src/core/wall/WallEngine.js`
- **Rule**: All external code (Tools, Gizmos, UI controls, Roof engines, Level managers) **MUST ONLY CALL `WallEngine`**.
- Never import or call lower-level engines directly when `WallEngine` provides the public method.

### Pillar 2: Mutation Authority (`WallMutationEngine.js`)
- **Location**: `src/core/wall/WallMutationEngine.js`
- **Responsibilities**:
  - `setThickness(wall, thickness, shouldSync, planner)`: Clamps $1 \le t \le 200$, updates `wall.thickness` and `wall.config.thickness`.
  - `setHeight(wall, height, shouldSync, planner)`: Updates `wall.height` and `wall.config.height`.
  - `setElevation(wall, elevation, shouldSync, planner)`: Updates `wall.elevation`.
  - `setEndpoints(wall, startPos, endPos, shouldSync, planner)`: Moves wall anchors and synchronizes connected wall miters.
  - `setTopProfile(wall, profileType, options, shouldSync, planner)`: Configures `'normal'`, `'single'`, `'gable'`, or `'dual'` profiles (`startHeight`, `endHeight`, `peakHeight`, `peakPos`, `flipSlope`).
  - `pushPull(wall, side, distance, options, planner)`: Handles **Baseline Move Mode** (translating both anchors) and **Single-Sided Pinned Face Thickness Mode** ($\Delta t$, centerline moves by $\frac{\Delta t}{2} \cdot \vec{n}$).
  - `applyMaterial(wall, options, planner)`: Updates `wall.params.textureFront` / `textureBack` / `texture`.
  - `batchUpdate(planner, walls, updates)`: Atomically updates multiple walls.
  - `attachWidget` / `removeWidget`, `attachMolding` / `removeMolding`.

### Pillar 3: Topology Authority (`WallTopologyEngine.js`)
- **Location**: `src/core/wall/WallTopologyEngine.js`
- **Responsibilities**:
  - `createWall(planner, options)`: **The ONLY place where `new PremiumWall(...)` is instantiated** and registered into `planner.walls[]`.
  - `createRoomBox(planner, bounds)`: Creates 4 connected walls sharing 4 corner anchors.
  - `splitWall(planner, wall, splitPoint)`: Splits a wall into two connected segments and redistributes attached widgets/openings proportionally.
  - `mergeWalls(planner, wall1, wall2)`: Merges two collinear adjacent walls sharing a degree-2 anchor into a single continuous wall.
  - `deleteWall(planner, wall)`: Cascades deletion to child auto-gables, openings, moldings, Konva 2D groups, and Three.js 3D meshes without orphaned nodes.
  - `reformAndAddWallSegments(planner, inputSegments, wallType, wallConfig)`: Planar CSG network slicing, intersection snapping, and collinear interval overlap resolution.
  - `extrudeWallSegment(planner, wall, tStart, tEnd, depth)`: Slices a section of a wall outward/inward into 3–5 replacement bay walls with molding migration.

### Pillar 4: Geometry Authority (`WallGeometryEngine.js`)
- **Location**: `src/core/wall/WallGeometryEngine.js`
- **Responsibilities**:
  - `getLength(wall)`: $\sqrt{\Delta x^2 + \Delta y^2}$.
  - `getDirection(wall)`: Unit vector along wall length.
  - `getNormal(wall)`: Left-handed unit normal $(-\Delta y / L, \Delta x / L)$.
  - `getCenterline(wall)`: Midline segment points.
  - `getCorners(wall, anchor, isStart, allWalls)`: Solves collinear through-walls, T-junctions, cross-junctions, and multi-angle radial bisector miters.
  - `getExactPolygonPoints(wall, allWalls)`: Constructs the monolithic 2D contour including step-outs for solid protrusions.
  - `getTopProfile(wall)`: Returns derived polygonal 3D profile for sloped roofs/gables.
  - `getApertureVoids(wall)`: Mathematical cutouts for doors, windows, and niches.

---

## 3. Strict Rules for All Upcoming Development

### Rule 1: Zero Direct Wall Mutation Bypasses
NEVER directly write to canonical properties outside `WallMutationEngine`:
```javascript
// ❌ FORBIDDEN:
wall.thickness = 24;
wall.height = 280;
wall.elevation = 40;
wall.topProfileType = 'single';
wall.startAnchor = newAnchor;
wall.startX = 100;

// ✅ REQUIRED:
WallEngine.setThickness(wall, 24, true, planner);
WallEngine.setHeight(wall, 280, true, planner);
WallEngine.setElevation(wall, 40, true, planner);
WallEngine.setTopProfile(wall, 'single', { startHeight: 280, endHeight: 350 }, true, planner);
WallEngine.setEndpoints(wall, newStartPos, newEndPos, true, planner);
```

### Rule 2: Zero Direct `planner.walls[]` Manipulation
NEVER manually instantiate `PremiumWall` or manipulate `planner.walls` array:
```javascript
// ❌ FORBIDDEN:
const wall = new PremiumWall(planner, a1, a2);
planner.walls.push(wall);
planner.walls.splice(idx, 1);

// ✅ REQUIRED:
const wall = WallEngine.createWall(planner, { startAnchor: a1, endAnchor: a2, thickness: 20, height: 120, addToPlanner: true });
WallEngine.deleteWall(planner, wall);
```

### Rule 3: 2D & 3D Renderers Are 100% Read-Only
- `wall.renderer2d.js` and `wall.renderer3d.js` must NEVER mutate canonical wall properties, anchors, dimensions, or materials.
- User interactions in 2D or 3D must delegate to `WallEngine` methods.

### Rule 4: Wall Hole Shearing & Miter Joints
- When applying miter shearing in `Wall3DBuilder.js`, `shearGeo` must ONLY shift vertices at extreme ends (`x <= 0.1` and `x >= length - 0.1`).
- All internal vertices (openings, cutouts) must be left untouched to preserve rectangular apertures.

### Rule 5: 3D Push / Pull Architecture
- **Baseline Move Mode**: Shifts both anchors along $\vec{n}$.
- **Single-Sided Pinned Face Mode**: Increases/decreases `wall.thickness` and shifts centerline by $\frac{\Delta t}{2} \cdot \vec{n}$, keeping the opposite face stationary in world space.
- Always use `WallEngine.pushPull(wall, side, dist, options, planner)`.

### Rule 6: Undo / Redo & Serialization
- All multi-property edits must integrate with `SnapshotCommand` via `planner.exportState()` / `planner.importState()`.
- `WallSerializer.js` is the single serialization authority. All canonical fields must be preserved during save/load.

### Rule 7: Strict Wall Corner Miter & Baseline Geometry Lockdown (Zero Unauthorized Changes)
- **Zero Modifications Without Explicit User Approval**: Wall corner miter calculations, bevel logic, endpoint/corner vertex mappings, and 2D/3D corner boundary generation are strictly locked down.
- **Invariants**:
  - `startL`/`startR` MUST remain strictly mapped to `startData.corners[0]`/`startData.corners[1]`.
  - `endL`/`endR` MUST remain strictly mapped to `endData.corners[0]`/`endData.corners[1]`.
  - `frontVerts` MUST start with `startL` and end with `endL`.
  - `backVerts` MUST start with `endR` and end with `startR`.
  - NEVER connect `bevelL`/`bevelR` to `startTrue` or `endTrue` in `sceneFunc` or `recalculateGeometry`.
- Any proposed change to corner miter math or vertex routing MUST be explicitly presented to and approved by the user first.

---

## 4. Quick API Reference Recipes

### Creating a Wall
```javascript
import { WallEngine } from '@/core/wall/WallEngine.js';

const wall = WallEngine.createWall(planner, {
    startAnchor: a1,
    endAnchor: a2,
    type: 'outer',
    thickness: 20,
    height: 120,
    elevation: 0,
    params: { texture: 'white_plaster_wall' },
    addToPlanner: true
});
```

### Moving a Wall Anchor
```javascript
WallEngine.moveAnchor(anchor, { x: 250, y: 100 }, planner, true);
```

### Sloped Wall / Gable Creation
```javascript
WallEngine.setTopProfile(wall, 'gable', {
    startHeight: 0,
    endHeight: 0,
    peakHeight: 180,
    peakPos: 0.5
}, true, planner);
```

### Splitting a Wall
```javascript
const [w1, w2] = WallEngine.splitWall(planner, wall, { x: 150, y: 0 });
```

### Batch Updating Multiple Walls
```javascript
WallEngine.batchUpdate(planner, selectedWalls, {
    thickness: 24,
    height: 300,
    elevation: 0
});
```


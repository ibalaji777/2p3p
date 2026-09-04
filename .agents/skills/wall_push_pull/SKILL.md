---
name: Wall Push/Pull & Solid Protrusions Expert
description: Universal CAD/BIM standard for 2D & 3D wall push/pull operations, exterior solid wall protrusions, monolithic 2D contour generation, and gapless 45-degree mitered molding wrapping.
---

# Wall Push/Pull & Solid Protrusions Expert Guidelines

This skill defines the architectural and geometric standard for wall push/pull operations and exterior solid wall protrusions in both 2D and 3D.

---

## 1. Architectural Design Principles

- **Full Wall Pull**: Increases `wall.thickness`, adjusting anchor miter connections at corners.
- **Specific Area / Sub-Region Pull**: Creates a **solid exterior wall block / protrusion** (`solid_protrusion`) attached seamlessly to the host wall for exterior elevation design.
- **Monolithic Wall Identity**: A pulled section is structurally part of the host wall, NOT a hollow room, niche, or detached object.
- **Zero-Hole Host Wall**: The host wall behind the protrusion must remain 100% solid in both 2D and 3D.

---

## 2. 2D Floor Plan & Wall Geometry Standards

### A. Single Monolithic Wall Polygon (`wall.renderer2d.js`)
- The wall's single 2D polygon (`this.poly.points`) must directly step outward at the protrusion and return cleanly to enclose both the base wall and the protrusion in **one continuous filled polygon**:
  - Front Face (+n): `startL -> ... -> ptA -> ptA_out -> ptB_out -> ptB -> ... -> endL`
  - Back Face (-n): `endR -> ... -> ptB -> ptB_out -> ptA_out -> ptA -> ... -> startR`
- **Locked Baseline Corners**:
  - `startL`/`startR` and `endL`/`endR` are strictly bound to `startData.corners` and `endData.corners`.
  - Corner miter math and bevel cutoffs are locked and must never be altered during push/pull calculations.
- **Baseline Edge Anchoring**:
  Calculate `ptA` and `ptB` directly along the true baseline edge vectors (`p1_L -> p2_L` for front, `p1_R -> p2_R` for back) using normalized span `t1, t2 = tCenter +/- (width / 2) / length`. Never interpolate between corner-mitered true corners which skew near wall junctions.

### B. Zero Erase Cutter & Zero Duplicate Shapes (`advance_openings.js`, `registry.js`)
- **No Destination-Out Cutter**: `advance_openings` must NEVER attach or activate a `destination-out` erasing cutter on `wallLayer` for `solid_protrusion`.
- **No Competing Rectangles**: `registry.js['solid_protrusion'].render2D` and `advance_openings.js` must NEVER render duplicate background rectangles on `widgetLayer` that overlap and conflict with `this.poly`.
- `advance_openings` only renders the dimension badge text (`+${depth}`).

---

## 3. 2D Molding & Trim Ribbon Generation (`PremiumMolding.js`)

### A. Universal Polyline Offset with Bisector Mitering
When offsetting the stepped wall contour (`baseVerts`) to generate the 2D molding ribbon:
1. Compute the unit normal vector for every segment along the polyline.
2. At every internal corner (where segment `i-1` meets segment `i`), compute the corner bisector vector:
   `B = normalize(n_{i-1} + n_i)`
   `miterScale = 1 / dot(n_{i-1}, B)`
3. Offset outer corner points by `B * (visualDepth * miterScale)`.
4. This guarantees a continuous, uniform green ribbon fill across the base wall, the top side return, the front face, and the bottom side return with zero thin/missing regions or self-intersections.

---

## 4. 3D Wall & Solid Protrusion Generation (`EnvironmentBuilder.js`)

1. **Explicit Void Suppression**:
   In both active wall and static floor builders, `solid_protrusion` must explicitly set `hasHole = false` before the default cutout branch. Three.js must not punch holes through the base wall.
2. **Interactive Raycasting & Snapping**:
   Protrusion meshes must have `userData`:
   ```javascript
   protrusionMesh.userData = { 
       isWidget: true, 
       isWallSide: true, 
       isProtrusion: true, 
       parentWall: wall, 
       entity: wall, 
       widget: widg 
   };
   ```
   and be pushed to `interactables` for direct clicking, painting, and plugin snapping.

---

## 5. 3D Continuous Molding Wrapping & 45-Degree Mitering (`Molding3DBuilder.js`)

### A. Segment Splitting & Side Returns
Wall moldings automatically split around protrusions into:
- Base wall segment before protrusion (`0 -> seg.start` at `Z = zOffset`)
- Start side return (`seg.start` running along `Z` from `zOffset -> zOffset + extraZ`)
- Protrusion front face segment (`seg.start -> seg.end` at `Z = zOffset + extraZ`)
- End side return (`seg.end` running along `Z` from `zOffset + extraZ -> zOffset`)
- Base wall segment after protrusion (`seg.end -> wallLength` at `Z = zOffset`)

### B. Normal Preservation (No Negative Scale Mirroring)
- Start side return MUST rotate 180 degrees (`Math.PI` radians) around the Y-axis:
  ```javascript
  startRetGeo.rotateY(Math.PI);
  startRetGeo.translate(seg.start, heightOffset, zOffset + seg.extraZ);
  ```
- NEVER use negative scale (`scale(-1, 1, 1)`), which inverts face normals and causes dark inside-out shading.

### C. 45-Degree Geometric Miter Joint Shearing
Every vertex on the molding cross-section (flutes, grooves, ogees, fillets) is sheared proportionally to its depth distance from the wall face:
- **Inside Corner 1** (`x = seg.start, z = zOffset`):
  - Base segment end: `x = seg.start - distZ`
  - Start return start: `z = zOffset + distX * signZ`
- **Outside Corner 2** (`x = seg.start, z = zOffset + extraZ`):
  - Start return end: `z = (zOffset + extraZ) + distX * signZ`
  - Front segment start: `x = seg.start - distZ`
- **Outside Corner 3** (`x = seg.end, z = zOffset + extraZ`):
  - Front segment end: `x = seg.end + distZ`
  - End return start: `z = (zOffset + extraZ) + distX * signZ`
- **Inside Corner 4** (`x = seg.end, z = zOffset`):
  - End return end: `z = zOffset + distX * signZ`
  - Base segment start: `x = seg.end + distZ`

This produces completely gapless, solid, injection-molded quality 45-degree miter joints matching real architectural carpentry across all complex trim profiles.

---

## 6. 3D Interactive Push/Pull Gizmo & Real-Time Drag Math (`WallPushPullGizmo.js`)

### A. 3-Step Elevation Workflow
1. **Area Selection**:
   - Width Boundary Handles (Vertical Cyan Laser Lines at `tStart` and `tEnd`).
   - Height/Elevation Boundary Handles (Horizontal Gold Laser Lines at `elevBottom` and `elevTop`).
   - Glowing 2D Selection Box on the wall face framing the selected area.
2. **Live Dynamic Dragging**:
   - Central Circle & Bi-directional Arrow Handles (+Z Outward Pull / -Z Inward Push).
   - Real-time CAD/BIM axis-aligned plane projection.
   - Dynamic 60 FPS live geometry rebuilds via `ctx.updateWallGeometryLive(w)`.
3. **HUD Commitment**:
   - Floating confirmation bar (`✓ Done` commits changes, `✕ Cancel` reverts state).

### B. Camera-Facing Axis-Aligned Projection Plane Math
When dragging a 3D gizmo handle along a directional axis $\vec{A}$ (such as normal axis $\vec{N}$, width axis $\vec{W}$, or height axis $\vec{H}$), the drag plane MUST contain the translation axis $\vec{A}$ and be tilted directly towards the camera direction $\vec{C}_{\text{cam}}$:
$$\vec{T} = \vec{C}_{\text{cam}} \times \vec{A}$$
$$\vec{P}_{\text{normal}} = \text{normalize}(\vec{A} \times \vec{T})$$
$$\text{dragPlane.setFromNormalAndCoplanarPoint}(\vec{P}_{\text{normal}}, \text{hitPoint})$$

**Why this is mandatory:**
- If a fixed horizontal plane `(0, 1, 0)` is used, raycasting fails when the camera is at near eye level.
- With the axis-aligned camera-facing plane, the axis $\vec{A}$ lies strictly on the plane ($\vec{P}_{\text{normal}} \cdot \vec{A} = 0$), guaranteeing 100% intersection reliability and zero dead-zones across any perspective.

### C. Three Dynamic Interaction Modes
1. **Full Wall Thickness (`mode === 'thickness' && !isSubRegion`)**:
   - Single-sided expansion: Opposite face remains strictly pinned.
   - Updates `wall.thickness` and shifts the wall baseline centerline by `actualDelta / 2` via `WallEngine.pushPull`.
2. **Room Baseline Move (`mode === 'baseline'`)**:
   - Shifts the entire wall perpendicularly along the normal vector, preserving room topology and moving attached corner junctions.
3. **Sub-Region Solid Protrusion / Niche (`isSubRegion`)**:
   - Renders a live 3D `solidBlockPreview` mesh:
     - **Outward Pull ($+D$)**: Emerald green bounding volume (`0x22c55e`) representing the solid exterior block.
     - **Inward Push ($-D$)**: Amethyst purple bounding volume (`0xa855f7`) representing the recessed architectural niche cavity.

### D. Safe BufferGeometry Merging Invariants (`wall.renderer3d.js`)
When assembling stepped 3D wall skins with cutouts and side returns:
1. **Non-Indexed Uniformity**: All geometries passed to `BufferGeometryUtils.mergeGeometries(frontGeos, false)` must be non-indexed:
   ```javascript
   const nonIndexedFront = frontGeos.map(g => g.index ? g.toNonIndexed() : g);
   skinFrontGeo = BufferGeometryUtils.mergeGeometries(nonIndexedFront, false);
   ```
   Mixing indexed `ShapeGeometry` with non-indexed quad `BufferGeometry` causes Three.js merge failures and returns `null`.
2. **Null-Safe Shearing**: `shearGeo` must guard against null/undefined geometry before accessing `geo.attributes.position`.

### E. Safe State Rollback on Cancel
When the user clicks `✕ Cancel` or presses `Esc`:
- If editing full wall thickness, restore `wall.thickness = initialThickness` and reset endpoints to `initialStart` / `initialEnd` via `WallEngine.setEndpoints`.
- Discard `solidBlockPreview` and roll back any pending `SnapshotCommand`.


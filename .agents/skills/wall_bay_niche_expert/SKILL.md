---
name: Wall Bay & Niche Extrusion Expert
description: Universal CAD/BIM architectural standard for 3D wall bay/niche extrusion and recess (extrude_recess / bay_niche), symmetrical corner hover tracking, connected corner clearance validation, strictly perpendicular 90-degree return walls, anchor preservation, and real-time invalid corner highlight feedback.
---

# Wall Bay & Niche Extrusion Expert Guidelines

This skill defines the architectural, geometric, and interaction standards for the **Bay / Niche Tool** (`COMMON_TOOLS.BAY_NICHE` / `mode: 'extrude_recess'` / `bay_niche`) and parametric wall segment extrusion (`WallTopologyEngine.extrudeWallSegment`) in the 2D/3D planner engine.

---

## 1. Architectural Architecture & Core Invariants

### A. The Bay / Niche Tool Role
The Bay / Niche tool allows users to select a section of a wall and either:
1. **Pull outward ($depth > 0$)**: Partition the single host wall into an architectural outward bay assembly forming a 3D bay room bump-out (`wStart`, `wReturn1`, `wFront`, `wReturn2`, `wEnd`).
2. **Push inward ($depth < 0$)**:
   - If $|depth| \le \text{thickness} - 2$: Creates an attached architectural wall cutout widget (`niche_recess`).
   - If $|depth| > \text{thickness} - 2$: Partitions the wall inward into a recessed room bay assembly.

### B. Core Architectural Invariants
1. **Strict 90° Perpendicular Return Walls**:
   - Return walls (`wReturn1` and `wReturn2`) MUST be mathematically perpendicular to the host wall baseline.
   - Vector dot product with host wall baseline MUST be identically zero:
     $$\vec{wReturn1} \cdot \vec{baseline} = 0, \quad \vec{wReturn2} \cdot \vec{baseline} = 0$$
   - Front extruded wall (`wFront`) MUST be strictly parallel to the baseline.
   - Angled, sheared, or trapezoidal walls are strictly prohibited.
2. **Permanent Corner Anchor Preservation**:
   - Any adjoining wall connected to `wall.startAnchor` (`anc1`) or `wall.endAnchor` (`anc2`) MUST retain its connection without breaking, detaching, or creating mid-air gaps when the host wall is partitioned.
   - Zero degenerate 0-length loops (`startAnchor === endAnchor`).
3. **Symmetrical Corner Tracking & Clamping**:
   - Previewing and dragging MUST behave identically on both the left corner ($t = 0$) and right corner ($t = 1$).
   - Never use arbitrary asymmetric clamps like `[0.15, 0.85]`. Bounds must derive dynamically from the feature's physical span:
     `minCenter = halfSpan`, `maxCenter = 1 - halfSpan`.

---

## 2. Symmetrical Span-Aware Hover Clamping & Tracking

### A. Why Hardcoded Clamping Fails
If `projT` is clamped artificially to `[0.15, 0.85]`, then on walls $\ge 350\text{ cm}$:
- Center projection freezes at $0.15 \times \text{wallLen} \ge 50\text{ cm}$.
- Left edge of the feature freezes at $\ge 25\text{ cm}$ from the left corner.
- The preview box stops moving before entering the clearance zone, never triggering `distStart < 25`, and freezing in cyan state without displaying the required red warning.

### B. Canonical Span-Aware Clamping Formula
In `previewExtrude(wallMesh, hitPoint)` and `previewExtender(wallMesh, hitPoint)`:
```javascript
let projT = 0.5;
if (hitPoint) {
    projT = ((hitPoint.x - p1.x) * dx + (hitPoint.z - p1.y) * dy) / (wallLen * wallLen);
}

const halfSpan = Math.min(0.25, Math.max(0.08, 50 / wallLen));
const minCenter = halfSpan;
const maxCenter = Math.max(minCenter, 1 - halfSpan);
const clampedCenter = Math.max(minCenter, Math.min(maxCenter, projT));

this.extrudeStartT = Math.max(0, clampedCenter - halfSpan);
this.extrudeEndT = Math.min(1, clampedCenter + halfSpan);
```

- When moving to the left corner ($t \to 0$): `extrudeStartT` reaches `0`, positioning the preview box flush with the corner.
- When moving to the right corner ($t \to 1$): `extrudeEndT` reaches `1`, positioning the preview box flush with the corner.
- Both ends track smoothly, allowing clearance validation to trigger consistently on both sides.

---

## 3. Corner Clearance & Wing Validation Rules

### A. Validation Criteria (`_validatePlacementSpace`)
```javascript
// 1. Minimum Wall Dimensions
if (wallLen < 40) return { isValid: false, reason: 'wall_too_short', message: '🚫 Wall Too Short' };
if (spanCm < 30) return { isValid: false, reason: 'space_too_short', message: '🚫 Space Too Short' };

// 2. Connected Corner Clearances (miter / intersection safety: min 25 cm)
if (startNeighbors.length > 0 && distStart < 25) {
    return { isValid: false, reason: 'connected_corner', message: `🚫 Too Close to Connected Corner (${distStart} cm · Min 25 cm)` };
}
if (endNeighbors.length > 0 && distEnd < 25) {
    return { isValid: false, reason: 'connected_corner', message: `🚫 Too Close to Connected Corner (${distEnd} cm · Min 25 cm)` };
}

// 3. Minimum Wing Clearance for Wall Cuts (bay/niche cuts: min 20 cm)
if (toolMode === 'extrude_recess') {
    if (distStart < 20) return { isValid: false, reason: 'corner_clearance', message: `🚫 Too Close to Corner (${distStart} cm · Min 20 cm)` };
    if (distEnd < 20) return { isValid: false, reason: 'corner_clearance', message: `🚫 Too Close to Corner (${distEnd} cm · Min 20 cm)` };
}
```

### B. Visual Feedback Invariants
- **Valid Placement (`isValid === true`)**:
  - Preview Box: Translucent Cyan (`matNeutralGhost`, color `0x00f0ff`, opacity `0.20`).
  - Outline: Glowing Cyan (`0x00f0ff`).
  - Badge: Dark slate pill `🔲 Click to Place Bay/Niche (${bayLen} cm)`.
  - Cursor: `pointer`.
  - Handles: Boundary and depth arrow handles visible.
- **Invalid Placement (`isValid === false`)**:
  - Preview Box: Translucent Red (`matInvalidGhost`, color `0xef4444`, opacity `0.35`).
  - Outline: Glowing Red (`matInvalidOutline`, color `0xef4444`).
  - Badge: Crimson red pill `🚫 ${reasonMessage}` with error icon.
  - Cursor: `not-allowed`.
  - Handles: Boundary and depth handles hidden to prevent committing in invalid state.
  - Commit Block: Clicking or pressing Enter shakes the badge (`_shakeBadge`) and rejects the commit.

---

## 4. Strictly Perpendicular 90° Return Wall Geometry

### A. Pegging Extruded Corners Directly to Baseline Anchors
In `WallTopologyEngine.extrudeWallSegment(planner, wall, tStart, tEnd, depth)`:

```javascript
const p1 = WallGeometryEngine.getAnchorPosition(wall.startAnchor);
const p2 = WallGeometryEngine.getAnchorPosition(wall.endAnchor);
const dx = p2.x - p1.x;
const dy = p2.y - p1.y;
const len = Math.hypot(dx, dy);
const nx = -dy / len;
const ny = dx / len;

// 1. Resolve baseline cut anchors first
const anc1 = wall.startAnchor || getAnchor(p1.x, p1.y);
const anc2 = wall.endAnchor || getAnchor(p2.x, p2.y);
const isStartFlush = distStart < 25 || tStart <= 0.05;
const isEndFlush = distEnd < 25 || tEnd >= 0.95;

const ancA = isStartFlush ? anc1 : getAnchor(ptA.x, ptA.y);
const ancB = isEndFlush ? anc2 : getAnchor(ptB.x, ptB.y);

// 2. CRITICAL: Peg extruded corners directly to resolved baseline anchors
const ptA_ext = { x: Math.round(ancA.x + depth * nx), y: Math.round(ancA.y + depth * ny) };
const ptB_ext = { x: Math.round(ancB.x + depth * nx), y: Math.round(ancB.y + depth * ny) };

const ancA_ext = getAnchor(ptA_ext.x, ptA_ext.y);
const ancB_ext = getAnchor(ptB_ext.x, ptB_ext.y);
```

### B. Why This Guarantees 100% Perpendicularity
- Return wall 1 vector: $\vec{r}_1 = \text{ancA\_ext} - \text{ancA} = (depth \times nx, depth \times ny)$.
  $$\vec{r}_1 \cdot \vec{baseline} = depth \times \left( -\frac{dy}{len} \times dx + \frac{dx}{len} \times dy \right) = 0$$
- Return wall 2 vector: $\vec{r}_2 = \text{ancB} - \text{ancB\_ext} = (-depth \times nx, -depth \times ny)$.
  $$\vec{r}_2 \cdot \vec{baseline} = 0$$
- Front wall vector: $\vec{f} = \text{ancB\_ext} - \text{ancA\_ext} = \text{ancB} - \text{ancA}$ (parallel to baseline).
- **Never calculate `ptA_ext` from unsnapped `ptA`** when `ancA` is snapped to `anc1`. Doing so introduces a shearing offset $(\Delta x \cdot \vec{baseline})$, creating an angled trapezoid.

### C. Tight Snap Tolerance for Anchor Allocation
When searching `planner.anchors`, use a tight CAD tolerance ($3\text{ cm}$) to ensure extruded corner anchors do not collapse back into baseline anchors when $|depth| < 25\text{ cm}$.

---

## 5. Safe Wall Replacement & Widget Migration

When replacing the host wall with the new bay wall segments:
1. **Wings (`wStart`, `wEnd`)**:
   - `wStart` is created between `anc1` and `ancA` only if `!isStartFlush && ancA !== anc1 && tStart > 0.02`.
   - `wEnd` is created between `ancB` and `anc2` only if `!isEndFlush && ancB !== anc2 && tEnd < 0.98`.
2. **Attached Openings & Widgets**:
   - Transfer existing windows, doors, and attached widgets to the appropriate replacement segment based on their parameter $t$:
     - $t < tStart \implies$ mapped to `wStart` ($t' = t / tStart$).
     - $t > tEnd \implies$ mapped to `wEnd` ($t' = (t - tEnd) / (1 - tEnd)$).
     - Otherwise $\implies$ mapped to `wFront` ($t' = (t - tStart) / (tEnd - tStart)$).
3. **Attached Moldings**:
   - Propagate moldings across all replacement wall segments (`wStart`, `wReturn1`, `wFront`, `wReturn2`, `wEnd`), preserving profile type and offsets.
4. **Canonical Cleanup**:
   - Delete original wall strictly via `this.deleteWall(planner, wall)`.
   - Invoke `planner.syncAll()` and `planner.findRooms()` to rebuild planar room polygons.

---

## 6. Verification Checklist

Whenever modifying bay/niche or wall extrusion logic, verify:
1. **Left Corner Hover**: Cursor at $t \le 0.05$ slides to the corner and turns **RED** (`🚫 Too Close to Connected Corner`).
2. **Right Corner Hover**: Cursor at $t \ge 0.95$ slides to the corner and turns **RED** (`🚫 Too Close to Connected Corner`).
3. **Wall Center Hover**: Cursor at $t = 0.5$ turns **CYAN** (`🔲 Click to Place Bay/Niche`).
4. **Perpendicular Return Walls**: Pulling outward or inward produces exact $90^\circ$ return walls on both sides ($\vec{r} \cdot \vec{baseline} = 0$).
5. **Anchor Preservation**: Any room wall meeting at the host wall's endpoints remains connected after extrusion.
6. **Zero Regression**: All tests in `WallInteractiveSuite.spec.js`, `WallEngine.spec.js`, and `WallExtender.spec.js` pass.

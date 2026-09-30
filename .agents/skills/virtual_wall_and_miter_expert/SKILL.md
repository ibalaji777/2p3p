---
name: Virtual Wall & Corner Miter Expert
description: Complete CAD/BIM standard for 0-height virtual walls, hidden walls, straight square butt cuts, solid block corner junctions, 3D suppression, and 2D reference representation.
---

# Virtual Wall & Corner Miter Expert Guidelines

You are an expert on **Virtual Walls, Hidden Walls, Corner Miter Geometry, and Solid Block Junctions** for this 2D/3D CAD & BIM floor planner.

This skill establishes the universal architectural and mathematical standard for:
1. **0-Height Virtual Walls (`wall.height === 0`)** used as room dividers or reference boundaries.
2. **Hidden Walls (`wall.hidden === true`)** toggled off by users.
3. **Corner Miter Mathematics (`WallGeometryEngine.getCorners`)**: Guaranteeing that full-height side walls meeting 0-height or hidden walls terminate with a **straight square cut ($90^\circ$ flat end cap)** extending full to $P_{outer}$ to produce a seamless **solid block** appearance with **zero $45^\circ$ diagonal slant**.
4. **3D Invisibility**: Complete suppression of virtual and hidden walls from the Three.js scene graph.
5. **2D Reference Representation**: Non-occluding transparent dashed outlines, reference badges, and interaction handle suppression in Konva.

---

## 1. Architectural Principles

- **Separation of Space Without Geometry**: A 0-height virtual wall or hidden wall defines room boundaries, zoning, or drafting references without physically existing in the 3D elevation.
- **Zero Exposed Diagonal Cuts (Solid Block Guarantee)**: In real-world architecture, when an interior room divider or hidden wall meets an exterior or full-height wall, the full-height wall does NOT receive a $45^\circ$ diagonal bevel slicing into mid-air. It must terminate squarely against the outer corner boundary ($P_{outer}$) as a solid block.
- **Effective Height 0 Authority**: Any wall that is hidden (`hidden === true`) or has height 0 (`height === 0`) MUST evaluate strictly to `effectiveHeight = 0` during corner ray calculations, regardless of what value is stored in its config or height slider.

---

## 2. Corner Miter Mathematics (`WallGeometryEngine.getCorners`)

### A. Centralized Effective Height Helper
In `WallGeometryEngine.getCorners`:
```javascript
const getWallEffectiveHeight = (w) => {
    if (!w) return 0;
    if (w.hidden) return 0;
    if (w.height !== undefined && w.height !== null) {
        const h = Number(w.height);
        if (!isNaN(h)) return Math.max(0, h);
    }
    if (w.config?.height !== undefined && w.config?.height !== null) {
        const ch = Number(w.config.height);
        if (!isNaN(ch)) return Math.max(0, ch);
    }
    return 120;
};
```

> [!WARNING]
> **Falsy 0 Fallback Trap**: Never use `Number(w.height) || 120` or `Number(w.height) || Number(w.config?.height)`. In JavaScript, `0` is falsy, causing a 0-height wall to mistakenly evaluate to 120 or 280, tricking the engine into calculating an equal-height $45^\circ$ diagonal miter cut!

### B. Neighbor Ray Collection & Level Compatibility
Hidden walls must NOT be skipped from ray evaluation. They must be collected so the full-height wall can locate the true outer corner boundary ($P_{outer}$):
```javascript
allWalls.forEach(w => {
    if ((w.startAnchor === anchor || w.endAnchor === anchor) && w.type !== 'railing') {
        const wBot = Number(w.elevation) || 0;
        const wEffectiveH = getWallEffectiveHeight(w);
        const wTop = wBot + wEffectiveH;
        
        // Two physical walls miter if their 3D vertical spans overlap.
        // If either wall has 0 effective height (hidden or 0-height reference),
        // they interact if they share the same floor base elevation.
        if (wallEffectiveH > 0 && wEffectiveH > 0) {
            if (Math.max(wallBot, wBot) >= Math.min(wallTop, wTop) - 2.0) return;
        } else {
            if (Math.abs(wallBot - wBot) > 5.0) return;
        }
        ...
```

### C. Taller Dominant Butt-Joint Activation (Solid Block Math)
When a normal wall ($H = 280\text{ cm}$) meets a 0-height or hidden wall ($H = 0\text{ cm}$):
$$\text{topDiff} = \text{wallTop} - \text{otherTop} = 280 - 0 = 280 > 2.0$$

This activates the Unequal-Height Smart Butt-Joint:
1. **Turn Direction Vector Cross Product**:
   $$cp = \vec{d}_{\text{my}} \times \vec{d}_{\text{other}} = d_{x1} d_{y2} - d_{y1} d_{x2}$$
   - $cp > 0$ (turning left): $P_{outer} = \text{intersect}(R_{\text{my}}, L_{\text{other}})$, $P_{inner} = \text{intersect}(L_{\text{my}}, R_{\text{other}})$
   - $cp < 0$ (turning right): $P_{outer} = \text{intersect}(L_{\text{my}}, R_{\text{other}})$, $P_{inner} = \text{intersect}(R_{\text{my}}, L_{\text{other}})$
2. **Outer Extension Distance**:
   $$\text{distAlongDir} = (P_{outer} - P) \cdot \vec{d}_{\text{my}}$$
3. **Square Cut Corner Points**:
   $$\text{buttL} = P + \vec{n}_{\text{my}} \cdot \frac{T}{2} + \vec{d}_{\text{my}} \cdot \text{distAlongDir}$$
   $$\text{buttR} = P - \vec{n}_{\text{my}} \cdot \frac{T}{2} + \vec{d}_{\text{my}} \cdot \text{distAlongDir}$$
4. **Zero Slant Invariant**:
   $$\text{toLocalX}(\text{buttL}) = \text{toLocalX}(\text{buttR}) = \text{distAlongDir} \implies X_L - X_R = 0\text{ cm}$$
   The end cap is $90^\circ$ perpendicular to the wall axis, extending all the way to $P_{outer}$ to form a gapless solid block.
5. **Virtual Wall Inset**:
   The 0-height / hidden wall receives $\text{distAlongDir} = (P_{inner} - P) \cdot \vec{d}$, butting squarely into the inner face of the taller wall.

### D. Equal-Height Virtual Miters (2D Reference Consistency)
When **two** 0-height reference walls meet at a corner, $\text{topDiff} = 0 - 0 = 0$. They maintain the standard $45^\circ$ miter, allowing their 2D reference dashed lines to meet seamlessly at the shared corner.

---

## 3. 3D Scene Graph Invisibility Standard

Virtual and hidden walls must be completely excluded from 3D rendering to prevent invisible raycast blockers, shadow artifacts, and GPU overhead.

### Implementation Checklist:
1. **`wall.renderer3d.js` (`buildWallGroup`, `buildStaticWallGroup`)**:
   ```javascript
   if (w.hidden || (w.height !== undefined && Number(w.height) <= 0)) {
       if (w.mesh3D) {
           disposeMesh(w.mesh3D);
           w.mesh3D = null;
       }
       return { wallGroup: null, wallMesh: null };
   }
   ```
2. **`EnvironmentBuilder.js` (`buildScene`, `buildWallGroup`)**:
   Filter out hidden and 0-height walls before building active or static wall groups:
   ```javascript
   const standardWalls = walls.filter(w => (w.height === undefined || Number(w.height) > 0) && !w.hidden);
   ```
3. **`engine3d.js` (`updateWallGeometryLive`)**:
   When height becomes 0 or hidden is toggled on:
   - Detach the 3D interactive suite (`suite.detach()`).
   - Clear gizmo and active selections if the wall was selected.
   - Remove the wall group from `structureGroup` and dispose geometries/materials.

---

## 4. 2D Reference Representation Standard (`wall.renderer2d.js`)

Virtual and hidden walls remain accessible in 2D for drafting, selection, and room definition, but with distinct non-intrusive styling:

1. **Classification**:
   ```javascript
   const isReference = Boolean(this.hidden || (this.height !== undefined && Number(this.height) <= 0));
   ```
2. **Styling Invariants**:
   - `fillEnabled(!isReference)`: Must be completely transparent so floor finishes, tiles, and room fills are unobstructed.
   - `dash: isReference ? [8, 6] : null`: Clear architectural dashed centerline / boundary stroke.
   - `stroke: '#64748b'`: Muted slate-gray outline (highlighted to `#4f46e5` when selected).
   - Reference Badge: Renders `(Hidden)` or `(0cm)` alongside dimensions.
   - **Handle Suppression**: Hide the vertical 2D wall raiser handle and sloped roof foldout indicators (`foldoutGroup.visible(false)`).

---

## 5. Height Policy Contract (`WallHeightPolicy.js`)

1. **Virtual Wall Support ($H = 0$)**:
   - `clamp(0)` returns `0`.
   - `processInputHeight(0)` returns `0`.
   - `processDragHeight(0, ...)` returns `0`.
   - `validate(0)` returns `true`.
2. **Physical Wall Minimum Clamping ($H > 0$)**:
   - Any physical wall height $0 < H < 20\text{ cm}$ continues to be clamped to `MIN_HEIGHT = 20cm`.

---

## 6. Verification & Automated Testing Matrix

Every update to wall geometry, miters, or height systems must pass the following regression suites:
- `WallCornerHeightMiter.spec.js`:
  - Test 4: Normal wall (280cm) meeting 0-height wall $\to$ straight square cut ($X_L = X_R$, $\Delta X = 0$, solid block).
  - Test 5: Normal wall (280cm) meeting hidden wall $\to$ straight square cut ($X_L = X_R$, $\Delta X = 0$, solid block).
  - Test 6: Two 0-height reference walls meeting $\to$ $45^\circ$ reference miter preserved.
- `WallHiddenAndZeroHeight.spec.js`: 3D invisibility, mesh disposal, and 2D dashed reference representation.
- `WallPropertiesAudit.spec.js` & `WallPropertiesPipelineFixes.spec.js`: Property mutation pipeline and undo/redo invariance.

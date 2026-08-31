---
name: Wall Plugin 3D Placement & Aperture Highlighting Expert
description: Universal CAD/BIM standard for Sims 4-style direct 3D wall placement, camera line-of-sight face detection, shape-accurate aperture void highlighting, 4-vertex mitered ribbon generation, tool preset state isolation, and live ghost preview rendering for all doors, windows, baseboards, moldings, jali panels, sunshades, fascias, curtains, and wall art.
---

# Universal 3D Wall Plugin Placement & Aperture Highlighting Expert

When modifying, adding, or debugging 3D wall-attached elements (doors, windows, baseboards, crown moldings, jali panels, sunshades/chajjas, elevation fascias, curtains, blinds, and wall art), you MUST strictly adhere to this architectural standard:

---

## 1. Tool Preset State Isolation (`useAppTools.js`)

Never allow `activePresetParams` from one tool category to contaminate another when switching tools in the sidebar.

```javascript
// Strict validation and reset when switching tools:
if (tool === 'door' || tool.startsWith('door_')) {
    if (!activePresetParams.value || !activePresetParams.value.doorType) {
        activePresetParams.value = { doorType: 'single', doorStyle: 'flat' };
        planner.value.activePresetParams = activePresetParams.value;
    }
} else if (tool === 'window' || tool.startsWith('window_')) {
    if (!activePresetParams.value || !activePresetParams.value.windowType) {
        activePresetParams.value = { windowType: 'sliding_std' };
        planner.value.activePresetParams = activePresetParams.value;
    }
} else if (tool === 'skirting' || tool === 'molding' || tool.startsWith('molding_') || tool.startsWith('skirting_')) {
    if (!activePresetParams.value || (!activePresetParams.value.profileType && !activePresetParams.value.type?.startsWith('molding_'))) {
        activePresetParams.value = (tool === 'skirting' || tool.startsWith('skirting_'))
            ? { type: 'molding_skirting_flat', profileType: 'skirting_flat', heightOffset: 0, moldingHeight: 12, depth: 2, material: 'white_paint' }
            : { type: 'molding_crown', profileType: 'crown', heightOffset: 110, moldingHeight: 10, depth: 5, material: 'white_paint' };
        planner.value.activePresetParams = activePresetParams.value;
    }
}
```

---

## 2. Camera Line-of-Sight Face Detection ("Looking Logic")

Never rely solely on static raycast face normals or geometric dot products, which misclassify faces at oblique angles. 

**Authoritative Camera Line-of-Sight Formula**:
```javascript
// 1. Calculate vector from 3D hit point to camera
const camPos = this.ctx.camera.position;
const toCamX = camPos.x - hitPt.x;
const toCamZ = camPos.z - hitPt.z;

// 2. Compute 2D dot product with wall surface normal (-wallDirY, wallDirX)
const dotCam = toCamX * (-wallDirY) + toCamZ * wallDirX;

// 3. Determine active side and facing multiplier
const side = dotCam >= 0 ? 'front' : 'back';
const facing = (side === 'back') ? -1 : 1;
```

* **Front Face (`facing === 1`)**: Element attaches flush to $+Z$ in wall local coordinates ($+\text{thickness}/2$).
* **Back Face (`facing === -1`)**: Element attaches flush to $-Z$ in wall local coordinates ($-\text{thickness}/2$).

---

## 3. Placement Freedom & Floor Anchoring Standards

1. **Free 2D ($X, Y$) Wall Placement (Windows, Curtains, Wall Art, Jali, Sunshades, Fascias)**:
   - **Horizontal ($X$)**: Can be placed anywhere along the wall span ($t \in [0, 1]$, `projDist = t * wallLen`).
   - **Vertical ($Y$)**: Follows cursor / touch height across the full wall span (`localHitY - itemH/2`), with smart sill (`80cm`) and window top lintel snapping.
2. **Floor-Anchored Placement (Doors)**:
   - Doors are strictly floor-anchored at `elev = 0` across the full horizontal span ($t \in [0, 1]$).
   - In `registry.js` door renderer, side jambs, architraves, stops, threshold, and contact shadows MUST use local group heights directly (`jamHeight = height`, `jamY = height / 2`), never adding/subtracting artificial `bottomY`.

---

## 4. Shape-Accurate 3D Aperture Void & Ribbon Highlighting

Every 3D wall tool must render a glowing aperture void volume (`#00f0ff` cyan when valid, `#ef4444` red when invalid) with sharp outline boundary edges (`THREE.EdgesGeometry`):

### Category A: Wall-Cutting Openings (Doors, Windows, Jali Panels)
* **Geometry**: `new THREE.BoxGeometry(itemW, itemH, wallThick + 4)`
* **Position**: `(projDist, elev + itemH / 2, 0)` (centered through the wall thickness).

### Category B: Protruding Surface Attachments (Sunshades, Curtains, Wall Art, Fascias)
* **Z-Positioning Standard**: `zOffset = ((wallThick / 2) + (depth / 2)) * facing`
* **Elevation Fascia Shape Accuracy**:
  - Fascias must NOT use simple bounding boxes.
  - Dynamically construct `THREE.Shape` and `THREE.ExtrudeGeometry` matching the exact profile (`c_shape_left`, `c_shape_right`, `l_shape_left`, `l_shape_right`, `full_box`) via `createFasciaShapeGeometry` so the glowing highlight hugs the wall profile shape.

### Category C: Miter-Sheared Quad Ribbon & Door Cutouts (Baseboards / Skirting, Crown Moldings, Friezes)
* **Isolated Height Calculation**:
  - Never allow stale `preset.height` from large objects (e.g. 120cm fascias) to contaminate moldings.
  - Baseboards/skirting must strictly use `itemH = 10cm - 14cm`.
* **Automatic Opening & Door Interruption**:
  - Baseboards and moldings must NEVER pass continuously through door openings or floor-level cutouts.
  - Intersecting vertical height spans (`[elev, elev + height]` vs `[wElev, wElev + wH]`) automatically split the molding into segments via `getMoldingSegments()`, leaving doorways completely open and clear.
* **Explicit 4-Vertex Quad Construction (NO PlaneGeometry Rotation)**:
  - NEVER rotate `PlaneGeometry` with `rotateY(Math.PI)` because it inverts the $Z$-axis and breaks miter offsets on the back wall face.
  - Construct direct 4-vertex `BufferGeometry` quads for each solid segment using wall polygon miter coordinates:
    ```javascript
    const zOffset = ((thick / 2) + 0.3) * facing;
    const yBottom = isCrown ? Math.max(0, wallH - itemH) : elev;
    const yTop = yBottom + itemH;

    const segments = this.molding3DBuilder.getMoldingSegments(wallLen, yBottom, itemH, wallEntity);
    // Extrude and build ribbon quads across each segment [seg.start, seg.end]
    ```

---

## 5. Real-Time 60 FPS Tracking & Raycast Occlusion Bypass

1. **Raycast Bypass**:
   Every ghost container mesh (`placementGroup`, `modelPreviewGroup`, `apertureVoidMesh`, `apertureEdges`) and its children MUST define:
   ```javascript
   mesh.raycast = () => {};
   ```
   This prevents the mouse ray from intersecting the preview itself (which causes jitter and flickering).

2. **On-Demand Engine Render Wakeup**:
   Always call `this.ctx.requestRender()` in `onPointerMove` and `hideGhost()`:
   ```javascript
   if (this.ctx && typeof this.ctx.requestRender === 'function') {
       this.ctx.requestRender();
   }
   ```

3. **High-Performance Ghost Caching**:
   For wall-spanning moldings and fascias, include `wallId` in cache keys to ensure instant updates when crossing walls, while ignoring sub-pixel $X$ movements (`projDist`).

---

## 6. 2-Step Pinned Confirmation Workflow & HUD Popup

All 3D wall plugins MUST follow the 2-step CAD / Sims-4 placement and review workflow:

1. **Step 1: Real-Time Preview & Hover**:
   - As the pointer moves across walls, `onPointerMove(e)` dynamically updates the glowing aperture highlight and 3D preview model.
   - The HUD badge popup follows the cursor and displays real-time measurements and active face (`FRONT` / `BACK`).

2. **Step 2: Click to Pin & Inspect (`this.isPinned = true`)**:
   - When the user clicks or taps on the wall (`onPointerDown`), the system **pins the preview and highlight** at that exact location.
   - While pinned, hovering does not displace the preview (`if (this.isPinned && e.buttons === 0) return true;`).
   - The floating HUD popup badge remains anchored above the pinned element with 3 active controls:
     - **`⇄ Flip Face`**: Calls `this.flipFace()`, flipping between $+Z$ and $-Z$ wall faces in-place.
     - **`✓ Place`**: Calls `this.placePlugin()`, applying the element to the actual wall in the design.
     - **`✕`**: Cancels and closes the tool.
   - Clicking elsewhere on the wall updates and re-pins the preview to the new position.
   - Dragging with mouse down unpins dynamically until released.

3. **Step 3: Commit to Original Design (`placePlugin()`)**:
   When the user clicks **`✓ Place`**:
   - **Entity Creation**: Instantiate `PremiumWidget` (or `PremiumMolding`), assign `facing`, `elevation`, `width`, `height`, `depth`.
   - **Wall Attachment**: Push into `wall.attachedWidgets` or `wall.attachedMoldings`.
   - **In-Place CAD Rebuild**:
     ```javascript
     if (this.ctx.envBuilder?.buildWallGroup) this.ctx.envBuilder.buildWallGroup(wall);
     if (this.ctx.buildScene) this.ctx.buildScene(...);
     if (this.ctx.requestRender) this.ctx.requestRender('3D Placement Complete', 5);
     ```
   - **Stable Selection**: Prevent camera jump by passing `preventAutoFocus = true` and updating world matrices recursively:
     ```javascript
     createdEntity.mesh3D.updateWorldMatrix(true, true);
     this.interactions.selectObject(createdEntity.mesh3D, null, true);
     ```
   - **Cleanup**: Call `this.hideGhost()` which resets `this.isPinned = false` and hides the HUD badge.


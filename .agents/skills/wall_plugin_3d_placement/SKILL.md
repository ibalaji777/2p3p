---
name: Wall Plugin 3D Placement & Aperture Highlighting Expert
description: Universal CAD/BIM standard for Sims 4-style direct 3D wall placement, camera line-of-sight face detection, shape-accurate aperture void highlighting, and live ghost preview rendering for all doors, windows, baseboards, moldings, jali panels, sunshades, fascias, curtains, and wall art.
---

# Universal 3D Wall Plugin Placement & Aperture Highlighting Expert

When modifying, adding, or debugging 3D wall-attached elements (doors, windows, baseboards, crown moldings, jali panels, sunshades/chajjas, elevation fascias, curtains, blinds, and wall art), you MUST strictly adhere to this architectural standard:

---

## 1. Camera Line-of-Sight Face Detection ("Looking Logic")

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

## 2. Shape-Accurate 3D Aperture Void & Ribbon Highlighting

Every 3D wall tool must render a glowing aperture void volume (`#00f0ff` cyan when valid, `#ef4444` red when invalid) with sharp outline boundary edges (`THREE.EdgesGeometry`):

### Category A: Wall-Cutting Openings (Doors, Windows, Jali Panels, Niches)
* **Geometry**: `new THREE.BoxGeometry(itemW, itemH, wallThick + 4)`
* **Position**: `(projDist, elev + itemH / 2, 0)` (centered through the wall thickness).

### Category B: Protruding Surface Attachments (Sunshades, Curtains, Wall Art, Fascias)
* **Z-Positioning Standard**: `zOffset = ((wallThick / 2) + (depth / 2)) * facing`
* **Elevation Fascia Shape Accuracy**:
  - Fascias must NOT use simple bounding boxes.
  - Dynamically construct `THREE.Shape` and `THREE.ExtrudeGeometry` matching the exact profile (`c_shape_left`, `c_shape_right`, `l_shape_left`, `l_shape_right`, `full_box`) via `createFasciaShapeGeometry` so the glowing highlight hugs the wall profile shape.

### Category C: Miter-Sheared Full-Wall Trims (Baseboards / Skirting, Crown Moldings, Friezes)
* **Isolated Height Calculation**:
  - Never allow stale `preset.height` from large objects (e.g. 120cm fascias) to contaminate moldings.
  - Baseboards/skirting must strictly use `mH = 10cm - 14cm` starting at floor level $Y = 0$.
* **Corner Miter Snapping & Shearing**:
  - Read `wallEntity.poly.points()` (supporting both array and function formats) to extract `localSL_x`, `localSR_x`, `localEL_x`, `localER_x`.
  - Span ribbon from $x = 0$ to $x = \text{wallLen}$ translated to `wallOffset = ((thick / 2) + (mDepth / 2)) * facing`.
  - Apply vertex displacement to the highlight ribbon geometry so corner vertices match connecting wall miters:
    ```javascript
    const pos = ribbonGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const tZ = (z + thick / 2) / thick;
        const startX = localSR_x + tZ * (localSL_x - localSR_x);
        const endX = localER_x + tZ * (localEL_x - localER_x);

        if (x <= 0.1) {
            pos.setX(i, startX);
        } else if (x >= wallLen - 0.1) {
            pos.setX(i, endX);
        }
    }
    ribbonGeo.computeVertexNormals();
    ```

---

## 3. Real-Time 60 FPS Tracking & Raycast Occlusion Bypass

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

## 4. 1-Click Placement, Stability & CAD Synchronization

When `onPointerDown` fires:
1. **Entity Creation**: Instantiate `PremiumWidget` (or `PremiumMolding`), assign `facing`, `elevation`, `width`, `height`, `depth`.
2. **Wall Attachment**: Push into `wall.attachedWidgets` or `wall.attachedMoldings`.
3. **In-Place CAD Rebuild**:
   ```javascript
   if (this.ctx.envBuilder?.buildWallGroup) this.ctx.envBuilder.buildWallGroup(wall);
   if (this.ctx.buildScene) this.ctx.buildScene(...);
   if (this.ctx.requestRender) this.ctx.requestRender('3D Placement Complete', 5);
   ```
4. **Stable Selection**: Prevent camera jump by passing `preventAutoFocus = true` and updating world matrices recursively:
   ```javascript
   createdEntity.mesh3D.updateWorldMatrix(true, true);
   this.interactions.selectObject(createdEntity.mesh3D, null, true);
   ```

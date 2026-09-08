---
name: Door Expert
description: Use this skill when modifying, creating, or debugging doors, door styles, door materials, or door geometry in the 3D engine.
---

# Door Expert Guidelines

When creating, modifying, or debugging doors (`entity.type === 'door'`), you must strictly adhere to the centralized feature architecture and the 3-layer CAD/BIM component and material pipeline standard:

---

## 1. Feature Modularization & Directory Structure

All door logic is centralized inside `src/features/door/`:

- `src/features/door/door.registry.js`: Central door definition, presets, default parameters, and unified registration.
- `src/features/door/door.geometry.js`: Analytical leaf geometry, arch profile math, stile & rail cutouts, recessed beveled panels, and UV normalization helpers.
- `src/features/door/door.renderer2d.js`: Passive 2D canvas/Konva renderer (swing arc paths, sliding tracks, opening indicators).
- `src/features/door/door.renderer3d.js`: 3D BIM assembly builder, outer casing/trim, hardware, threshold, and animation hinges.
- `src/features/door/door.properties.vue`: Dedicated door property editor panel (dimensions, swing angles, materials, arch styles).
- `src/features/door/test/DoorEngine.spec.js`: Automated test suite for door geometry, material slots, and boundary integrity.

---

## 2. Step-by-Step Code Template for Implementing a New Door / Door Style

When adding or modifying doors in `src/features/door/`:

```javascript
// 1. Resolve unified material references (DO NOT use .clone() on material arrays)
const matFrame = helpers.getDynamicMaterial(entity.materials?.[MaterialSlots.FRAME]?.id || 'wood_teak', 'door_frame');
const matLeaf = helpers.getDynamicMaterial(entity.materials?.[MaterialSlots.LEAF]?.id || 'wood_teak', 'door');
const matGlass = helpers.getDynamicMaterial(entity.materials?.[MaterialSlots.GLASS]?.id || 'clear', 'door');

// 2. Build assembly using BIMComponentBuilder
const builder = new BIMComponentBuilder(entity, helpers);

// 3. Extrude geometry with normalized UVs
const frameShape = createDoorShape(width, leafH, shapeType, halfSide);
const topHole = createArchedHolePath(xLeft, xRight, yStart, leafH, width, shapeType, halfSide, frameW);
frameShape.holes.push(topHole);

const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.04
});
frameGeo.translate(0, 0, -thickness / 2);
normalizeExtrudeUVs(frameGeo, width, leafH, thickness, -width / 2, 0);

builder.addNode({
    geometry: frameGeo,
    materialOverride: matsExtrude,
    parent: group,
    castShadow: true,
    receiveShadow: true,
    slot: MaterialSlots.LEAF
});
```

---

## 3. Concentric Arch Leaf Framing & Recessed Panels

To prevent rectangular "ears" or protrusions through the top curve of arched doors (`shapeType: 'radius' | 'arch' | 'segment' | 'gothic'`):

1. **Analytical Arch Boundary**:
   - Use `getDoorArchHeightAtX(x, w, h, shapeType, halfSide)` to compute the exact top curve $Y$-coordinate for any local $X$.
2. **Clockwise Hole Cutouts for Stile & Rail Frames**:
   - Use `createArchedHolePath(xLeft, xRight, yStart, h, w, shapeType, halfSide, frameW)` pushed into `THREE.Shape.holes`.
   - Single doors (`halfSide = 0`): Arc center at $(0, h - w/2)$ with radius $r = w/2 - \text{frameW}$.
   - Double doors (`halfSide = -1` left, `halfSide = 1` right): Leaf width $w$, radius $R = w$. Arc sweeps from outer margin to continuous tangent mating at centerline ($Y = h$).
3. **Counter-Clockwise Arched Recessed Panels**:
   - Use `createArchedPanelShape(xLeft, xRight, yStart, h, w, shapeType, halfSide, frameW)` to generate beveled recessed field panels (`depth: thickness * 0.55`) or glass panes.

---

## 4. Universal `ExtrudeGeometry` UV Normalization Standard

**CRITICAL MANDATE**:
Three.js `ExtrudeGeometry` defaults to raw physical vertex coordinate units ($u = \text{pos}.x, v = \text{pos}.y$). On doors spanning $40\text{--}80\,\text{cm}$ in width and $80\text{--}240\,\text{cm}$ in height, un-normalized UVs cause textures to tile $40\text{--}240\times$, creating an extreme micro-grid / checkerboard artifact.

- **Required Behavior**:
  Every `ExtrudeGeometry` in `door.geometry.js` and `door.renderer3d.js` MUST call `normalizeExtrudeUVs(geo, w, h, depth, minX, minY)`.
  - Cap faces (front/back): Normalizes $u \in [0, 1]$ and $v \in [0, 1]$ across the width and height.
  - Extruded sides/bevels: Normalizes $u \in [0, 1]$ across the depth and $v \in [0, 1]$ across the height.
  - For horizontal grain orientation on rails/mullions, chain with `rotateUVs(geo)`.

---

## 5. Three.js ExtrudeGeometry & Material Index Mapping

- `ExtrudeGeometry` only uses **two** material indices:
  - `materialIndex 0`: Front and back flat caps.
  - `materialIndex 1`: Extruded/beveled sides.
- Re-map multi-face material arrays when passing to `ExtrudeGeometry`:
  ```javascript
  const matsExtrude = Array.isArray(mats) ? [mats[4], mats[1]] : mats;
  ```

---

## 6. Wall Aperture Voids & Miter Joints

- Aperture cutouts for all door styles in host walls route through `WallGeometryEngine.createApertureVoidPath(widg, length, maxH, wallBottom, THREE)`.
- Doors are floor-anchored (`elev = 0`). Side jambs compute directly from local group height (`jamHeight = height`, `jamY = height / 2`).
- When shearing wall miters, `shearGeo` must only affect extreme ends (`x <= 0.1` and `x >= length - 0.1`), preserving rigid rectangular or arched aperture voids.


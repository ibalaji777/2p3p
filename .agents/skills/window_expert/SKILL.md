---
name: Window Expert
description: Use this skill when modifying, creating, or debugging windows, window styles, window materials, window cutouts, or window geometry in the 3D engine.
---

# Window Expert Guidelines

When creating, modifying, or debugging windows (`entity.type === 'window'`), you must strictly adhere to the centralized feature architecture and the 3-layer CAD/BIM component and material pipeline standard:

---

## 1. Feature Modularization & Directory Structure

All window logic is centralized inside `src/features/window/`:

- `src/features/window/window.registry.js`: Central window definition, presets, default parameters, and unified registration.
- `src/features/window/window.geometry.js`: 45-degree mitered sashes, beveled rails, cremone hardware, muntin grilles, and UV normalization helpers.
- `src/features/window/window.renderer2d.js`: Passive 2D canvas/Konva renderer (glass lines, sills, sash opening indicators).
- `src/features/window/window.renderer3d.js`: 3D BIM assembly builder, outer miter frame, sashes, glass, seals, and hardware.
- `src/features/window/window.properties.vue`: Dedicated window property editor panel (dimensions, sills, styles, materials).
- `src/features/window/test/WindowEngine.spec.js`: Automated test suite for window geometry, material slots, and aperture voids.

---

## 2. Step-by-Step Code Template for Implementing a New Window / Window Variant

When adding or modifying windows in `src/features/window/`:

```javascript
// 1. Resolve unified material references (DO NOT use .clone() on material arrays)
const matFrame = helpers.getDynamicMaterial(entity.materials?.[MaterialSlots.FRAME]?.id || 'alum_black', 'window_frame');
const matGlass = helpers.getDynamicMaterial(entity.materials?.[MaterialSlots.GLASS]?.id || 'clear', 'window_glass');
const matSash = helpers.getDynamicMaterial(entity.materials?.[MaterialSlots.SASH]?.id || 'alum_black', 'window_sash');

// 2. Build assembly using BIMComponentBuilder
const builder = new BIMComponentBuilder(entity, helpers);

// 3. Assemble 45-degree mitered frame members with normalized UVs
const topRailGeo = createMiterRailTopGeo(entity.width, frameW, frameThick);
builder.addNode({
    geometry: topRailGeo,
    materialOverride: matFrame,
    parent: winGroup,
    position: [0, height - frameW / 2, 0],
    slot: MaterialSlots.FRAME
});
```

---

## 3. Wall-Thickness Compatibility & Dimensions

- **Wall Thickness**: Always calculate `wallThickness = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || entity.thick || 20) : (entity.thick || 20)`.
- **Frame Depth (`fThick`)**: Set to `wallThickness + 0.5` units to guarantee clean flush alignment with host wall cutouts.
- **Sash Depth (`sThick`)**: Set to `wallThickness * 0.35` (35 mm engineered slim sash profile).

---

## 4. Universal UV Normalization for Mitered Rails & Grilles

- All extruded rails (`createMiterRailTopGeo`, `createMiterRailBotGeo`, `createMiterRailSideGeo`) and beveled rects (`createBeveledRect`) explicitly normalize UVs to $[0, 1]$.
- For horizontal grain orientation on wooden window frames, chain geometries with `rotateUVs(geo)`.

---

## 5. Canonical Wall Aperture Voids & Miter Joints

- Aperture cutouts for all window shapes (`square`, `radius`, `arch`, `segment`, `gothic`, `circular_opening`) route through `WallGeometryEngine.createApertureVoidPath(widg, length, maxH, wallBottom, THREE)`.
- The `shearGeo` function on host walls must ONLY shift the vertices at the extreme ends (`x <= 0.1` and `x >= length - 0.1`), preserving rigid rectangular or arched window cutouts.
- Window meshes are placed at `entity.localX = wCenter`, perfectly matching the un-sheared wall voids.


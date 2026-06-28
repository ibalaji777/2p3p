---
name: Window Expert
description: Use this skill when modifying, creating, or debugging windows, window styles, window materials, window cutouts, or window geometry in the 3D engine.
---

# Window Placement & Geometry Rules

**CRITICAL: Wall Hole Shearing & Miter Joints**
When applying a shear transformation to wall geometry to form mitered joints (e.g., `shearGeo` in `EnvironmentBuilder.js` or `Wall3DBuilder.js`), you MUST NOT shear the entire wall linearly.
If the entire wall is sheared (shifted based on `x / length`), any holes (for windows, doors, etc.) inside the wall will also be sheared, causing:
1. **Slanting:** Rectangular holes turn into parallelograms.
2. **Scaling:** The width of the hole is scaled proportionally to the corner stretch, creating massive gaps between frames and walls.

* **REQUIRED FIX:** The `shearGeo` function must ONLY shift the vertices at the extreme ends of the wall (`x <= 0.1` and `x >= length - 0.1`). 
* All internal vertices (holes, cutouts) must be left untouched (`pos.setX(i, x)`).
* Window meshes should simply be placed at `entity.localX = wCenter`, ensuring they match the mathematically perfect, un-sheared holes. Do not apply complex reverse-shearing math to the widget's local coordinates.

# Material Application Rules

**CRITICAL: Dynamic Materials vs Legacy Fallbacks**
Do not attempt to manually inject legacy fallbacks for materials (like `helpers.getWindowMaterial`, `helpers.getDoorMaterial`) or manually check undefined registries.
* Always use `helpers.getDynamicMaterial(matKey, type)` to fetch materials for windows, frames, and glasses.
* `getDynamicMaterial` natively handles standard lookups, default fallbacks, and caching. Writing custom fallback blocks around it introduces `TypeError` crashes and circumvents the unified material pipeline.

**CRITICAL: Material Scaling & Gizmo Updates**
When applying materials to window widgets via the Material Gizmo (`GizmoManager.js`), NEVER replace the materials directly in-place on the existing meshes.
* In `GizmoManager.js`, always use `if (this.ctx.updateMaterialLive) this.ctx.updateMaterialLive(entity);` after updating entity params for windows.
* Widget geometries (like `ExtrudeGeometry`) rely on `getFaceMaterials` when being built to calculate correct UV scaling factors based on exact physical dimensions. In-place swapping destroys this scaling and causes texture stretching (the "box shape" bug).

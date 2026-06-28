---
name: Door Expert
description: Use this skill when modifying, creating, or debugging doors, door styles, door materials, or door geometry in the 3D engine.
---

# Door Expert Agent Guidelines

You are an expert at handling the complexities of door generation and material application within this 3D Engine. Whenever you are tasked with working on doors (`entity.type === 'door'`), you must strictly adhere to the following rules:

## 1. 3D Geometry Extrusions (Carved Doors)
- When generating complex doors with styles (e.g. `classic_4_horizontal`, `grid_panel`), we use `THREE.ExtrudeGeometry` to create raised and beveled panels.
- **Material Index Warning**: Unlike `BoxGeometry` which expects a standard 6-material array mapping to its 6 sides, `ExtrudeGeometry` uses **ONLY TWO** material indices:
  - `materialIndex 0`: Applied to the front and back flat caps of the geometry.
  - `materialIndex 1`: Applied to the extruded/beveled sides.
- **Re-mapping Requirement**: When painting an `ExtrudeGeometry` panel inside `buildDetailedDoorPanel` (in `registry.js`), you must map the materials so that the front face receives the correct texture.
  - Example: `const matsExtrude = Array.isArray(mats) ? [mats[4], mats[1]] : mats;` 
  - `mats[4]` represents the front face (Z+).

## 2. Monolithic Material Application in GizmoManager
- When users apply a material to a door via the 3D Gizmo interface, doors are treated as **monolithic entities**.
- **No Sub-Block Nesting**: In `engine3d.GizmoManager.js`, you must NEVER map door materials into `entity.params.blocks[activeSubMeshIndex]`.
- Doors should route their material assignments directly to `entity.params.textureFront`, `entity.params.textureTop`, etc., bypassing subMesh indexing.
  - Correct Logic Check: `if (this.activeSubMeshIndex !== -1 && !entity.type.startsWith('shape_') && entity.type !== 'door')`

## 3. Modifying Door Geometries
- All logic for assembling door structures (stiles, rails, glass, carved panels) happens in `registry.js` under `buildDetailedDoorPanel`.
- Ensure new door styles define proper `depth` and `bevel` calculations to ensure realistic rendering without z-fighting.
- Always translate extruded geometries back by half their Z-depth to ensure they rotate and place perfectly inside the wall's core opening.

## 4. Door Placement & Geometry Rules

**CRITICAL: Wall Hole Shearing & Miter Joints**
When applying a shear transformation to wall geometry to form mitered joints (e.g., `shearGeo` in `EnvironmentBuilder.js` or `Wall3DBuilder.js`), you MUST NOT shear the entire wall linearly.
If the entire wall is sheared (shifted based on `x / length`), any holes (for windows, doors, etc.) inside the wall will also be sheared, causing:
1. **Slanting:** Rectangular holes turn into parallelograms.
2. **Scaling:** The width of the hole is scaled proportionally to the corner stretch, creating massive gaps between frames and walls.

* **REQUIRED FIX:** The `shearGeo` function must ONLY shift the vertices at the extreme ends of the wall (`x <= 0.1` and `x >= length - 0.1`). 
* All internal vertices (holes, cutouts) must be left untouched (`pos.setX(i, x)`).
* Door meshes should simply be placed at `entity.localX = wCenter`, ensuring they match the mathematically perfect, un-sheared holes. Do not apply complex reverse-shearing math to the widget's local coordinates.

## 5. Material Application Rules

**CRITICAL: Dynamic Materials vs Legacy Fallbacks**
Do not attempt to manually inject legacy fallbacks for materials (like `helpers.getDoorMaterial`) or manually check undefined registries.
* Always use `helpers.getDynamicMaterial(matKey, type)` to fetch materials for doors and frames.
* `getDynamicMaterial` natively handles standard lookups, default fallbacks, and caching. Writing custom fallback blocks around it introduces `TypeError` crashes and circumvents the unified material pipeline.

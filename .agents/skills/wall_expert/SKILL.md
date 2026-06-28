---
name: Wall Expert
description: Use this skill when modifying, creating, or debugging wall geometry, wall rendering, miter joints, or wall materials in the 3D engine.
---

# Wall Expert Agent Guidelines

You are an expert at handling the complexities of wall geometry generation and material application within this 3D Engine. Whenever you are tasked with working on walls (`entity.type === 'outer'` or `entity.type === 'inner'`), you must strictly adhere to the following rules:

## 1. Wall Hole Shearing & Miter Joints
**CRITICAL:** When applying a shear transformation to wall geometry to form mitered joints (e.g., `shearGeo` in `EnvironmentBuilder.js` or `Wall3DBuilder.js`), you MUST NOT shear the entire wall linearly.

If the entire wall is sheared (shifted based on `x / length`), any holes (for windows, doors, etc.) inside the wall will also be sheared, causing:
1. **Slanting:** Rectangular holes turn into parallelograms.
2. **Scaling:** The width of the hole is scaled proportionally to the corner stretch, creating massive gaps between frames and walls.

* **REQUIRED FIX:** The `shearGeo` function must ONLY shift the vertices at the extreme ends of the wall (`x <= 0.1` and `x >= length - 0.1`). 
* All internal vertices (holes, cutouts) must be left untouched (`pos.setX(i, x)`).
* Do not attempt to calculate reverse-shearing math to fix holes. The holes themselves must remain perfectly orthogonal.

## 2. In-Place Material Swapping for Walls
- In `engine3d.GizmoManager.js`, walls (unlike widgets) support in-place material swapping directly via `mesh.material[x] = newMat`.
- This is permitted for Base Walls (`entity.type === 'outer'` or `'inner'`) because walls calculate their UV projections globally on the vertex level inside `EnvironmentBuilder.js` rather than relying on `getFaceMaterials()` during instantiation.
- Do NOT use `updateMaterialLive` for base walls, as it would require rebuilding the entire wall geometry which is computationally expensive and unnecessary.

## 3. Widget Alignment on Walls
- Window and door meshes should simply be placed at `entity.localX = wCenter`, ensuring they match the mathematically perfect, un-sheared holes.
- Do not apply complex reverse-shearing math to the widget's local coordinates.

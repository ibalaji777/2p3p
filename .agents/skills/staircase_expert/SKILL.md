---
name: Staircase Expert
description: Complete unified guide for 3D staircase geometry, step treads, risers, stringers, landings, railings, materials, and world-space UV projection in the 3D engine.
---

# Staircase & Railing Expert Skill

This skill defines the complete authoritative pipeline for building, rendering, texturing, selecting, and maintaining 3D staircases (Straight, L-Shape, U-Shape, T-Shape) and integrated railings.

---

## 1. Architecture & Primary Files

| Component / Module | Absolute File Path | Description |
| :--- | :--- | :--- |
| **3D Stair Renderer** | [stairs.renderer3d.js](file:///d:/business/android-planner/src/features/stairs/stairs.renderer3d.js) | Constructs 3D step treads, risers, stringers, solid bases, landings, supports, and attaches railings. |
| **Stair Registry** | [stairs.registry.js](file:///d:/business/android-planner/src/features/stairs/stairs.registry.js) | Defines staircase metadata, `defaultConfig`, parametric properties, and shape handlers (`straight`, `L`, `U`, `T`). |
| **Catalog Gallery** | [CatalogGallery.vue](file:///d:/business/android-planner/src/components/sidebar/CatalogGallery.vue) | Defines staircase catalog presets, material combinations, and thumbnail generation triggers. |
| **3D Railing Builder** | [Railing3DBuilder.js](file:///d:/business/android-planner/src/features/railing/builders/Railing3DBuilder.js) | Builds 3D stair railings (posts, balusters, handrails, cables, glass panels). |
| **Railing Registry** | [railing.registry.js](file:///d:/business/android-planner/src/features/railing/registry/railing.registry.js) | Defines railing presets (`stair_glass_default`, `stair_cable_default`, `stair_baluster_default`). |

---

## 2. Material Slots & Pipeline Hierarchy

Staircases use 4 core material slots (plus railing slots):

| Material Slot | Key Identifier | Description & Assignment Rules |
| :--- | :--- | :--- |
| **Treads** | `treads` | Applied to horizontal step plates and the top landing surface plate (`treadMat`). |
| **Risers** | `risers` | Applied to vertical step riser panels (`riserMat`). |
| **Stringers** | `stringers` | Applied to **100% of all structural support bases**: flight stringers, mono beams, double beams, side skirtboards, box frames, solid landing bases, and columns (`structureMat`). |
| **Landings** | `landings` | Applied to landing top surface plate (defaults to matching `treads`). |
| **Railings** | `handrail`, `balusters`, `posts`, `glass`, `bottom_rail` | Applied to stair railing sub-components. |

---

## 3. Mandatory Architectural Rules

### Rule 1: Unified Single-Material Stringer Structure
- **Requirement**: All structural support elements—including Flight 1 solid stringers, landing sub-bases, Flight 2 solid stringers, Flight 3 solid stringers, frames, and columns—MUST use `structureMat` (`slot = 'stringers'`).
- **Forbidden**: NEVER paint solid landing base blocks with `landingMat` when `landingMat` differs from `structureMat`. Dual-material splits on stringer bases are strictly prohibited.

### Rule 2: Universal Sub-Mesh Registration & Selection
- Every sub-mesh generated inside `stairs.renderer3d.js` MUST:
  1. Set `child.userData.entity = stair`.
  2. Set `child.userData.materialSlot = slot`.
  3. Register via `ComponentRegistry.registerMesh(stair, slot, child)`.
- **Outcome**: Selecting or applying a material to ANY point on a stringer paints 100% of the entire stringer structure simultaneously without missing or unpainted sub-meshes.

### Rule 3: Absolute World-Space UV Projection
- **Requirement**: All UV coordinates for stringers, solid bases, treads, and risers MUST be derived from absolute 3D world coordinates:
  ```javascript
  const wx = (pos.getX(k) + worldPos.x) / scale;
  const wy = (pos.getY(k) + worldPos.y) / scale;
  const wz = (pos.getZ(k) + worldPos.z) / scale;
  ```
- **Forbidden**: NEVER use local mesh bounding-box minimums (`pos.getX(k) - minX`) inside `group.traverse`. Local bounding-box UVs reset texture coordinates per mesh, creating visible texture seam lines, breaks, and glitches.

### Rule 4: Flush Geometry Alignment (No Seam Lines)
- Solid flight base top contours and solid landing base tops MUST meet at exact matching Y elevations (`topHeight - treadThick`) with 0 mm height offset.
- Solid landing base dimensions MUST match full flight width (`lw`, `lh`) without inset margin offsets (`-0.2 cm`), ensuring 100% flush contact without border indents or seam lines.

### Rule 5: Hardware Depth Offset (Z-Fighting Mitigation)
- Stringer materials MUST enable WebGL hardware depth offsetting to prevent flickering lines under step treads:
  ```javascript
  if (m) {
      m.polygonOffset = true;
      m.polygonOffsetFactor = 1;
      m.polygonOffsetUnits = 1;
  }
  ```

---

## 4. Architectural Geometry Specifications

Standard real-world IRC/IBC architectural dimensions for all presets:

- **Staircase Width**: `100 cm` (`1000 mm`)
- **Total Flight Length**: `330 cm` (`3300 mm`)
- **Step Depth**: `28 cm` (`280 mm`)
- **Step Height**: `17.5 cm` (`175 mm`)
- **Tread Thickness**: `1.5 cm`
- **Riser Panel Thickness**: `3.0 cm`

---

## 5. Integrated Railing Protocol

When attaching railings to a staircase in `stairs.renderer3d.js`:
1. Calculate 3D start vector (`railStart`) and end vector (`railEnd`) along the flight slope.
2. Inject `standardConfig.isStairStyle = true` to force routing through `UniversalStairGenerator`.
3. Pass material slot overrides (`handrail`, `balusters`, `posts`, `glass`, `bottom_rail`) directly from `stair.materials` into `Railing3DBuilder.build3D()`.

---

## 6. Verification Checklist

After modifying any staircase or railing feature:
1. Verify that flight stringers and landing bases share a **single, unified stringer material**.
2. Verify that applying a material via the Material Gizmo updates 100% of all stringers with zero missing places.
3. Verify that marble/wood textures flow seamlessly across flights and landings with zero seam lines or glitches.
4. Run `npm run build` (`vite build`) to confirm clean compilation and thumbnail generation without `ReferenceError`.

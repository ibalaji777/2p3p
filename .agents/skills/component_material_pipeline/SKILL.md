---
name: Component Material Pipeline
description: Use this skill when modifying, creating, or debugging 3D doors, windows, walls, widgets, furniture, elevation elements, component selection, real-time highlighting, or material slots in the 3D engine.
---

# Enterprise 3-Layer CAD/BIM Component, Highlight, & Material Pipeline Standard

This sytem governs all 3D asset selection, hover highlighting, material application, and JSON state management in Antigravity CAD/BIM applications.

## 1. The 3-Layer Architecture Model

```text
Window / Door / Wall / Widget Assembly
│
├── Layer 1: Component Registry (componentId)
│   ├── Component Selection & Real-Time Hovering
│   ├── Interaction Modes (Component, Slot, Mesh)
│   ├── Property Panel Binding
│   └── Component Visibility & Locking
│
├── Layer 2: Material Slots (materialSlot)
│   ├── Explicit Slot Inheritance (SLOT_DEFINITIONS)
│   ├── Overrides ({ id: "wood_walnut", inherits: false })
│   └── Authoritative Serialization (entity.materials)
│
└── Layer 3: Mesh Registry (THREE.Mesh)
    ├── O(1) Fast Material Application (Set<THREE.Mesh>)
    ├── Shared PBR Material Cache
    └── RenderCoordinator Batching
```

---

## 2. Mandatory Rules for All 3D Assets

### Rule A: Universal Sub-Mesh Registration Mandate
Whenever generating 3D meshes in `registry.js` (doors, windows, moldings, sunshades, chajjas, railings, furniture, or future widgets):
1. **Every single sub-mesh** (left jamb, right jamb, header, sill, threshold, stop, mullions, panels, glass, handles, seals) MUST be attached with:
   - `mesh.userData.entity = entity`
   - `mesh.userData.materialSlot = slotName` (from `MaterialSlots`)
   - `mesh.userData.componentId = `${entity.id}_${slotName}``
2. Call `ComponentRegistry.registerMesh(entity, slotName, mesh, { componentId, componentType })` during mesh creation.
3. At the end of every `render3D` function, perform a full `group.traverse()` pass to verify 100% registration coverage.

### Rule B: Unified Material References (NO Material Cloning)
- **NEVER** create `.clone()` material arrays on individual sub-meshes (such as horizontal frame rails vs vertical stiles).
- All sub-meshes belonging to the same material slot (e.g. `MaterialSlots.FRAME` or `MaterialSlots.LEAF`) **MUST share the exact same material reference or material array instance** returned by `helpers.getDynamicMaterial()`.
- Directional grain variation (horizontal vs vertical wood grain) MUST be handled procedurally on the geometry attribute level (`rotateUVs(geo)`), NEVER by instantiating cloned material objects in memory.

### Rule C: 100% Shared Material Group Selection & Real-Time Highlighting
- When a user hovers over or clicks ANY single sub-mesh (e.g. left jamb):
  1. Resolve `entity.id` and `slotName` / `componentId`.
  2. Call `ComponentRegistry.setSlotHighlight(entity.id, slotName, true, color, ctx)`.
  3. **100% of all sub-meshes** sharing that material slot/component (vertical stiles AND horizontal rails, head, sill, mullions) MUST highlight together in unison.
- When applying a material:
  1. Call `MaterialManager.updateEntityMaterialSlot(entity, slotName, matConfig, ctx)`.
  2. Update the authoritative JSON model (`entity.materials[slotName] = descriptor`).
  3. Paint **100% of all registered meshes** in the material group simultaneously in O(1) time.

### Rule D: Material Independence & Lock Enforcement
- Attaching or modifying elevation features must never alter parent wall materials.
- Meshes with `mesh.userData.materialLocked = true` must reject material changes.

---

## 3. Verification Checklist

Before completing any task involving doors, windows, walls, widgets, or 3D elevation elements, verify:
1. [ ] Selecting ANY sub-mesh highlights 100% of all meshes in that material group (top, bottom, left, right).
2. [ ] Applying a material updates 100% of all meshes in that material group without leaving unpainted/white regions.
3. [ ] No sub-mesh uses `.clone()` material arrays.
4. [ ] `ComponentRegistry.getMeshesForSlot(entity.id, slot)` returns all expected meshes.
5. [ ] Vitest unit tests pass: `cmd.exe /c npx vitest run src/core/engine3d/test/ComponentMaterialPipeline.spec.js`.

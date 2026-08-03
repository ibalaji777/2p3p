---
name: Door Expert
description: Use this skill when modifying, creating, or debugging doors, door styles, door materials, or door geometry in the 3D engine.
---

# Door Expert Guidelines

When creating, modifying, or debugging doors (`entity.type === 'door'`), you must strictly adhere to the 3-layer CAD/BIM component and material architecture standard:

## 1. Step-by-Step Code Template for Implementing a New Door / Door Style

When adding or modifying doors in `src/core/registry.js` under `buildDetailedDoorPanel` / `createDoor3D`:

```javascript
// 1. Resolve unified material reference (DO NOT use .clone() on material arrays)
const matFrame = helpers.getDynamicMaterial(entity.frameMat || 'wood_teak', 'door_frame');
const matLeaf = helpers.getDynamicMaterial(entity.doorMat || 'wood_teak', 'door');

// 2. Tag and register sub-meshes as they are built
const stileLeft = new THREE.Mesh(geoStile, matFrame);
stileLeft.userData = { isFrame: true, materialSlot: MaterialSlots.FRAME, entity: entity };
ComponentRegistry.registerMesh(entity, MaterialSlots.FRAME, stileLeft, {
    componentId: `${entity.id}_frame`,
    componentType: ComponentTypes.FRAME
});

// 3. At the end of doorGroup rendering, perform a full assembly traversal pass
doorGroup.userData = { isWidget: true, entity: entity };
doorGroup.traverse(child => {
    if (child && child.isMesh && !child.userData?.isHitbox) {
        child.userData.entity = entity;
        const isFrame = Boolean(child.userData?.isFrame);
        const isGlass = Boolean(child.userData?.isGlass);
        const isHandle = Boolean(child.userData?.isHandle);
        let slotName = child.userData?.materialSlot || (isFrame ? MaterialSlots.FRAME : (isGlass ? MaterialSlots.GLASS : (isHandle ? MaterialSlots.HARDWARE : MaterialSlots.LEAF)));
        child.userData.materialSlot = slotName;
        ComponentRegistry.registerMesh(entity, slotName, child, {
            componentId: `${entity.id}_${slotName}`
        });
    }
});
```

---

## 2. 3D Geometry Extrusions (Carved Doors)
- When generating complex doors with styles (e.g. `classic_4_horizontal`, `grid_panel`), we use `THREE.ExtrudeGeometry` to create raised and beveled panels.
- **Material Index Warning**: Unlike `BoxGeometry` which expects a standard 6-material array mapping to its 6 sides, `ExtrudeGeometry` uses **ONLY TWO** material indices:
  - `materialIndex 0`: Applied to the front and back flat caps of the geometry.
  - `materialIndex 1`: Applied to the extruded/beveled sides.
- **Re-mapping Requirement**: When painting an `ExtrudeGeometry` panel inside `buildDetailedDoorPanel` (in `registry.js`), map the materials so that the front face receives the correct texture.
  - Example: `const matsExtrude = Array.isArray(mats) ? [mats[4], mats[1]] : mats;` (`mats[4]` represents the front face Z+).

---

## 3. Monolithic Material Application in GizmoManager
- When users apply a material to a door via the 3D Gizmo interface, doors route material assignments directly to `entity.params.textureFront`, `entity.params.textureTop`, etc., bypassing subMesh indexing.
  - Check: `if (this.activeSubMeshIndex !== -1 && !entity.type.startsWith('shape_') && entity.type !== 'door')`

---

## 4. Wall Hole Shearing & Miter Joints
- The `shearGeo` function must ONLY shift the vertices at the extreme ends of the wall (`x <= 0.1` and `x >= length - 0.1`).
- All internal vertices (holes, cutouts) must be left untouched (`pos.setX(i, x)`).
- Door meshes should simply be placed at `entity.localX = wCenter`, ensuring they match un-sheared holes.

---

## 5. Material Application Rules
- Always use `helpers.getDynamicMaterial(matKey, type)` to fetch materials for doors and frames.

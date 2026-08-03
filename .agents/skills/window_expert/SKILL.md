---
name: Window Expert
description: Use this skill when modifying, creating, or debugging windows, window styles, window materials, window cutouts, or window geometry in the 3D engine.
---

# Window Expert Guidelines

When creating, modifying, or debugging windows (`entity.type === 'window'`), you must strictly adhere to the 3-layer CAD/BIM component and material architecture standard:

## 1. Step-by-Step Code Template for Implementing a New Window / Window Variant

When adding or modifying windows in `src/core/registry.js` under `render3D`:

```javascript
// 1. Resolve unified material reference (DO NOT use .clone() on material arrays)
const matFrame = helpers.getDynamicMaterial(entity.frameMat || 'wood_teak', 'window_frame');
const matGlass = helpers.getDynamicMaterial(entity.glassMat || 'clear', 'window_glass');

// 2. Tag and register sub-meshes as they are built
const stileL = new THREE.Mesh(geoStileL, matsExtrudeStile);
stileL.userData = { isFrame: true, materialSlot: MaterialSlots.FRAME, entity: entity };
ComponentRegistry.registerMesh(entity, MaterialSlots.FRAME, stileL, {
    componentId: `${entity.id}_frame`,
    componentType: ComponentTypes.FRAME
});

// 3. At the end of winGroup rendering, perform a full assembly traversal pass
winGroup.userData = { isWidget: true, entity: entity };
winGroup.traverse(child => {
    if (child && child.isMesh && !child.userData?.isHitbox) {
        child.userData.entity = entity;
        const isGlass = Boolean(child.userData?.isGlass);
        const isHandle = Boolean(child.userData?.isHandle);
        const isSeal = Boolean(child.userData?.isSeal);
        let slotName = child.userData?.materialSlot || (isGlass ? MaterialSlots.GLASS : (isHandle ? MaterialSlots.HARDWARE : (isSeal ? MaterialSlots.SEAL : MaterialSlots.FRAME)));
        child.userData.materialSlot = slotName;
        ComponentRegistry.registerMesh(entity, slotName, child, {
            componentId: `${entity.id}_${slotName}`
        });
    }
});
```

---

## 2. Wall-Thickness Compatibility & Dimensions
- **Wall Thickness**: Always calculate `wallThickness = entity.wall ? (entity.wall.thickness || entity.wall.config?.thickness || entity.thick || 20) : (entity.thick || 20)`.
- **Frame Depth (`fThick`)**: Set `wallThickness + 0.5` units to guarantee flush alignment with wall cutouts.
- **Sash Depth (`sThick`)**: Set `wallThickness * 0.35` (35 mm engineered slim sash profile).

---

## 3. Wall Hole Shearing & Miter Joints
- The `shearGeo` function must ONLY shift the vertices at the extreme ends of the wall (`x <= 0.1` and `x >= length - 0.1`).
- All internal vertices (holes, cutouts) must be left untouched (`pos.setX(i, x)`).
- Window meshes should simply be placed at `entity.localX = wCenter`, ensuring they match un-sheared holes.

---

## 4. Material Application Rules
- Always use `helpers.getDynamicMaterial(matKey, type)` to fetch materials for windows, frames, and glass.
- NEVER replace materials directly in-place on existing widget meshes without updating `ComponentRegistry` or calling `updateMaterialLive(entity)`.

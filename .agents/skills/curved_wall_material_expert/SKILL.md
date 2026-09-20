---
name: Curved Wall Material Expert
description: Complete unified guide for curved wall & corner fillet material architecture, bidirectional segment synchronization, gizmo raycast neutrality, and 3D in-place live updates.
---

# Curved Wall Material Expert & BIM Synchronization Standard

This skill governs the architecture, material application, raycasting transparency, and real-time 3D rendering pipeline for curved walls (`PremiumArc`) and filleted wall corners in the Antigravity CAD/BIM engine.

---

## 1. The Curved Wall BIM Architecture Model

A curved wall in this system is represented as a high-level parametric arc entity (`PremiumArc`) comprised of smooth, contiguous linear wall segments:

```text
                                PremiumArc (entity.type === 'arc')
                                 │  id: 'arc_...'
                                 │  params: { textureFront, textureBack, texture, ... }
                                 │  radius, startAngle, endAngle, center
                                 ▼
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
  Segment Wall 1           Segment Wall 2           Segment Wall N
  w.parentArc = arc        w.parentArc = arc        w.parentArc = arc
  w.params = {...}         w.params = {...}         w.params = {...}
  w.mesh3D = wallGroup     w.mesh3D = wallGroup     w.mesh3D = wallGroup
```

### Key Architectural Invariants:
1. **Canonical Arc Entity ID**: `PremiumArc` must always possess an authoritative unique ID (`this.id = options.id || ('arc_' + Date.now() + '_' + Math.floor(Math.random() * 10000))`). This ensures `ValidationLayer.findEntity` and `ApplyMaterialCommand` can locate the entity during undo/redo and automation transactions.
2. **Bidirectional Parent-Segment Link**: Every segment `w` in `arc.walls` has `w.parentArc = arc`. The parent arc has `arc.walls = [w_1, w_2, ..., w_n]`.
3. **Parametric Mirroring**: Materials assigned to either the parent `arc` or to any individual segment `w` MUST propagate bidirectionally across the entire arc assembly so that all segments maintain visual continuity without gaps or unpainted patches.

---

## 2. Universal Material Propagation Rules

### Rule 1: Authoritative Mutation via WallEngine
All material mutations MUST route through `WallEngine.applyMaterial`:
```javascript
WallEngine.applyMaterial(wallOrArc, {
    target: 'front' | 'back' | 'all' | 'sides',
    key: materialId,
    ctx: renderer3D.value
}, planner);
```

### Rule 2: Bidirectional Arc & Sibling Propagation (`WallMutationEngine.js`)
When `applyMaterial` executes:
1. Resolve `arcWalls = (wall.parentArc && wall.parentArc.walls) ? wall.parentArc.walls : (wall.walls ? wall.walls : null)`.
2. Resolve `arcEntity = wall.parentArc || (wall.walls ? wall : null)`.
3. Update `arcEntity.params` with the incoming face texture.
4. Iterate over `arcWalls` with `_propagatingArcMaterial = true` to update all sibling segments in-place without recursion cycles.
5. Trigger `ctx.updateMaterialLive(wall)` and `ctx.updateMaterialLive(arcEntity)`.

### Rule 3: Parameter Inheritance in 3D (`engine3d.js:getFaceMaterials`)
When building or updating materials for any segment:
```javascript
if (entity && (entity.params || defaultWallMat || defaultCopingMat || (entity.parentArc && entity.parentArc.params))) {
    const ep = Object.assign({}, entity.parentArc ? entity.parentArc.params : null, entity.params || {});
    // Resolve textures using ep
}
```
If an arc has `arc.params.textureFront = 'stone_slate'`, any segment `w` inherits this property even if `w.params` was previously unassigned.

### Rule 4: Live 3D Mesh In-Place Updates (`engine3d.js:updateMaterialLive`)
`updateMaterialLive(entity)` must never exit early when called with a `PremiumArc`:
```javascript
let obj = entity.mesh3D;
if (!obj && (entity.type === 'arc' || (entity.walls && Array.isArray(entity.walls)))) {
    const firstWall = entity.walls && entity.walls[0];
    if (firstWall && firstWall.mesh3D) {
        obj = firstWall.mesh3D;
    }
}
```
All constituent walls in `wallsToUpdate` must update their `wallMesh.material` in-place, copy front materials to attached pattern layers if present, and trigger `this.requestRender('wall_material_update', 2)`.

---

## 3. Strict Gizmo Raycasting Transparency Rule

**CRITICAL MANDATE - ZERO RAYCAST OCCLUSION**

Helper meshes, lines, rings, and badges in 3D gizmos (such as `WallCornerFilletGizmo.js` and `AllWallCornersGizmo.js`) MUST NEVER intercept raycasts meant for wall faces or openings.

### Required Behavior:
1. **Interactive Colliders Only**: Only designated, invisible hit colliders (e.g. `hitMesh` with `userData.isCornerFilletHandle = true`) may respond to raycasts.
2. **Raycast Neutrality**: Set `raycast = () => {}` on ALL decorative, preview, and ghost meshes:
   - `lineMesh.raycast = () => {}` (dashed bisector guidelines)
   - `ringMesh.raycast = () => {}` (torus rings)
   - `discMesh.raycast = () => {}` (accent discs)
   - `coreMesh.raycast = () => {}` (diamond core symbols)
   - `badgeSprite.raycast = () => {}` (angle and radius badge sprites)
   - `ghostWallMesh.raycast = () => {}` (translucent arc preview)
   - `ghostLinesMesh.raycast = () => {}` (glowing contour lines)
   - `ghostCutLinesMesh.raycast = () => {}` (tangent cut lines)

---

## 4. UI Dispatcher Integration (`useAppMaterials.js` & `useAppTools.js`)

When the user selects materials from the left library, properties panel pattern layers, or 3D gizmos:
1. Always pass `ctx: renderer3D.value` into `WallEngine.applyMaterial(w, { target, key, ctx: renderer3D.value }, planner)`.
2. Explicitly call `renderer3D.value.updateMaterialLive(arc)` after segment updates.
3. In `spawnWallPattern`, avoid silent parameter mutation without engine dispatch. Always call `WallEngine.applyMaterial` and `updateMaterialLive`.

---

## 5. Verification Checklist

Before completing any task touching curved walls, filleted corners, or wall materials:
1. [ ] Curved walls can be painted with any material from the Material Library.
2. [ ] All constituent wall segments of a curved wall update simultaneously in 3D.
3. [ ] Clicking a curved wall in 3D correctly selects the wall and opens the material palette without gizmo occlusion.
4. [ ] In-place material updates preserve camera position (`preventAutoFocus = true`).
5. [ ] Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`) revert and restore curved wall materials cleanly.
6. [ ] Unit tests pass: `npx vitest run src/core/engine3d/test/CurvedWallMaterial.spec.js`.

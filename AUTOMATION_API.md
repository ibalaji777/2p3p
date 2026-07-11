# 🤖 Engine Automation API Reference

The Automation API provides a unified, command-driven interface to programmatically control the FloorPlanner engine. All commands are validated, securely executed, and natively support Undo/Redo.

**To execute a command, pass a JSON payload to:**
```javascript
window.planner.automationApi.execute({ ...payload });
```

---

## 🏗️ Creation Commands

### `createWall`
Creates a wall between two coordinates.
```json
{
  "action": "createWall",
  "startX": 0,
  "startY": 0,
  "endX": 300,
  "endY": 0,
  "type": "outer",      // Optional: 'outer' (default), 'inner', 'railing'
  "entityId": "wall_1"  // Optional: Custom ID for later reference
}
```

### `createDoor`
Snaps a door into an existing wall at a specific distance.
```json
{
  "action": "createDoor",
  "wallId": "wall_1",
  "x": 150,             // Distance along the wall
  "configId": "door_standard"
}
```

### `createWindow`
Snaps a window into an existing wall at a specific distance.
```json
{
  "action": "createWindow",
  "wallId": "wall_1",
  "x": 100,
  "configId": "window_standard"
}
```

### `createFurniture`
Places a 3D/2D furniture model at specific coordinates.
```json
{
  "action": "createFurniture",
  "x": 200,
  "y": 200,
  "configId": "sofa_01"
}
```

### `createRoof`
Generates a roof over a set of points.
```json
{
  "action": "createRoof",
  "points": [
    { "x": 0, "y": 0 },
    { "x": 300, "y": 0 },
    { "x": 300, "y": 300 },
    { "x": 0, "y": 300 }
  ],
  "configId": "roof_hip"
}
```

---

## 🔧 Modification Commands

### `moveEntity`
Moves an entity (furniture, etc.) to new absolute coordinates.
```json
{
  "action": "moveEntity",
  "entityId": "sofa_01",
  "x": 400,
  "y": 400
}
```

### `rotateEntity`
Rotates an entity to an absolute angle (in degrees).
```json
{
  "action": "rotateEntity",
  "entityId": "sofa_01",
  "rotation": 90
}
```

### `resizeEntity`
Updates the dimensions of an entity.
```json
{
  "action": "resizeEntity",
  "entityId": "sofa_01",
  "endValues": {
    "width": 150,
    "depth": 80,
    "height": 90
  }
}
```

### `updateProperty`
Modifies internal parameters or configuration of an entity. Prefix keys with `params.` or `config.` to drill down.
```json
{
  "action": "updateProperty",
  "entityId": "wall_1",
  "properties": {
    "thickness": 20,
    "params.textureScale": 1.5
  }
}
```

### `applyMaterial`
Applies a material texture to an entity. Supports multi-face targeting.
```json
{
  "action": "applyMaterial",
  "entityId": "wall_1",
  "face": "front",      // Optional: 'front', 'back'. Leave blank to apply globally.
  "materialId": "brick_red"
}
```

### `duplicateEntity`
Clones an existing entity slightly offset from the original.
```json
{
  "action": "duplicateEntity",
  "entityId": "sofa_01",
  "newEntityId": "sofa_02" // Optional
}
```

### `deleteEntity`
Safely removes an entity from the canvas.
```json
{
  "action": "deleteEntity",
  "entityId": "wall_1"
}
```

---

## 🔄 Transactions & History

### `transaction`
Executes an array of commands atomically. If *any* command in the array fails validation or execution, **all previously successful commands in the transaction are automatically rolled back**, ensuring zero state corruption.
```json
{
  "action": "transaction",
  "commands": [
    { "action": "createWall", "startX": 0, "startY": 0, "endX": 100, "endY": 0 },
    { "action": "createWall", "startX": 100, "startY": 0, "endX": 100, "endY": 100 }
  ]
}
```

### `undo` & `redo`
Triggers the engine's native history stack.
```json
{ "action": "undo" }
```
```json
{ "action": "redo" }
```

---

## 🔍 Query APIs

Used to retrieve data rather than mutate it.
**Usage:** `window.planner.automationApi.query('actionName', { params })`

* `getEntities`: Returns all entities in the scene.
* `getEntity`: Pass `{ id: "..." }` to get a specific entity.
* `getRooms`: Returns calculated room polygons and areas.
* `getWalls`: Returns the array of wall objects.
* `getSelection`: Returns the currently selected entity.
* `getSceneState`: Returns the fully serialized JSON save file.

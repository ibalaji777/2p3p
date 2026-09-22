---
name: Architecture Standardization & Quality
description: Universal CAD/BIM architectural standard ensuring all features, refactors, and bug fixes strictly follow existing architecture, single source of truth, centralized domain engines, command-first mutations, 2D/3D synchronization, and persistence contracts.
---

# Skill: Architecture Standardization & Quality

## Purpose

This skill ensures that every new feature, modification, refactor, bug fix, or generated code follows the **existing project's architecture, structure, naming, paths, state flow, mutation rules, command system, import/export format, undo/redo behavior, and 2D/3D synchronization model**.

The AI must NOT create a different architecture for each feature.

The goal is:

> **One project → one consistent architecture → reusable systems → centralized domain logic → predictable mutations → synchronized 2D/3D → reliable commands/history → stable import/export.**

Before writing code, inspect and understand the existing system.

---

# 1. PRIMARY RULE — EXTEND, DO NOT REINVENT

Before implementing anything:

1. Inspect the existing implementation.
2. Identify the current architectural pattern.
3. Identify existing engines, managers, registries, commands, utilities, renderers, serializers, and state owners.
4. Reuse existing systems wherever possible.
5. Extend an existing centralized system instead of creating a parallel system.
6. Only introduce a new system when the existing architecture genuinely cannot support the requirement.
7. If a new system is required, make it follow the same architectural conventions as the existing system.

### Never do this

```text
Feature A → ManagerA
Feature B → EngineB
Feature C → ServiceC
Feature D → ControllerD
Feature E → Direct mutation
```

when the project already has a common architecture capable of handling those responsibilities.

### Prefer

```text
User Action
    ↓
Command
    ↓
Central Domain Engine
    ↓
Canonical Project Model
    ↓
2D Renderer
    ↓
3D Renderer
```

---

# 2. ARCHITECTURE DISCOVERY BEFORE CODING

Before modifying code, perform an architecture audit.

Determine:

### Domain ownership

* Where is the canonical project data stored?
* Which system owns walls?
* Which system owns floors?
* Which system owns roofs?
* Which system owns stairs?
* Which system owns rooms?
* Which system owns levels/elevations?
* Which system owns materials?
* Which system owns geometry?

### Mutation ownership

Find:

* direct array pushes
* direct array splices
* direct object mutation
* renderer mutation
* UI mutation
* duplicated state
* hidden state
* temporary state becoming permanent state
* mutation outside the domain engine

### Command ownership

Determine:

* existing command pattern
* command registration
* execute()
* undo()
* redo()
* command history
* command grouping/batching
* transaction behavior
* command serialization if applicable

### Persistence ownership

Determine:

* import pipeline
* export pipeline
* project schema
* versioning
* migrations
* serialization/deserialization
* backward compatibility
* default values
* validation

### Rendering ownership

Determine:

* 2D renderer
* 3D renderer
* geometry generation
* material generation
* selection/highlighting
* synchronization mechanism
* lifecycle/disposal

---

# 3. CANONICAL DATA MODEL

There must be one authoritative source of truth for domain data.

Prefer:

```text
Canonical Project Model
        ↓
 ┌──────┴──────┐
 ↓             ↓
2D Renderer   3D Renderer
```

Avoid:

```text
2D State
   ↕
3D State
   ↕
UI State
```

where each system independently owns project data.

### Rule

2D and 3D must be **representations of the same canonical model**, not separate competing models.

If a property changes:

```text
wall.height
wall.thickness
wall.material
wall.shape
wall.position
wall.level
```

the change must originate from the domain model/command flow and both 2D and 3D must reflect it.

---

# 4. 2D / 3D SYNCHRONIZATION

Every feature that affects geometry must be audited for both 2D and 3D.

For every domain property ask:

```text
Does 2D use it?
Does 3D use it?
Are both reading the same canonical value?
Can changing it through 2D update 3D?
Can changing it through 3D update 2D?
Does undo restore both?
Does redo restore both?
Does import restore both?
Does export preserve it?
```

Never implement:

```text
2D-only behavior
```

or

```text
3D-only behavior
```

unless the property is explicitly presentation-specific.

### Rendering rule

Renderers should generally be:

```text
Model → Renderer
```

not:

```text
Renderer → mutate model
```

---

# 5. COMMAND-FIRST MUTATION

User-visible domain changes must go through the project's command/history architecture.

Prefer:

```text
UI Event
   ↓
Command
   ↓
Domain Engine
   ↓
Canonical Model
   ↓
Render Update
```

Example:

```js
UpdateWallHeightCommand
```

rather than:

```js
wall.height = value;
```

inside a UI component.

### Every command should define

```js
execute()
undo()
```

and, where the project supports it:

```js
redo()
```

or rely on the established command-history mechanism.

Commands must contain enough information to reliably reverse their operation.

---

# 6. NO DIRECT DOMAIN MUTATION FROM UI

UI components must not become domain owners.

Avoid:

```js
planner.walls.push(...)
planner.walls.splice(...)
wall.height = value
planner.roofs.push(...)
planner.stairs.push(...)
```

inside:

* Vue components
* React components
* event handlers
* HUDs
* property panels
* drag handlers
* renderer code

Instead:

```text
UI
 ↓
Intent/Event
 ↓
Command
 ↓
Engine
 ↓
Canonical Model
```

The UI may collect user input, but the domain system owns the mutation.

---

# 7. CENTRALIZATION RULE

Before creating:

```text
NewManager
NewEngine
NewService
NewRegistry
NewHelper
NewStore
NewController
```

search the project for an existing equivalent.

Ask:

> "Can this behavior belong to an existing centralized system?"

If yes:

**extend it.**

If no:

create the smallest reusable abstraction necessary.

Do not create feature-specific systems that duplicate existing responsibilities.

---

# 8. REUSABILITY RULE

New logic should be reusable when the same concept can appear in multiple features.

For example:

```text
Geometry rules
Material rules
Level/elevation rules
Transform rules
Selection rules
Command rules
Serialization rules
Validation rules
Snap rules
Shape rules
```

should not be duplicated across:

```text
Wall
Roof
Floor
Stair
Room
Facade
```

when the behavior is conceptually shared.

Use shared domain utilities/engines where appropriate.

---

# 9. IMPORT / EXPORT CONTRACT

Every new persistent property must be considered part of the project's persistence contract.

When adding:

```js
wall.newProperty
```

check:

```text
Creation
↓
Runtime mutation
↓
Undo
↓
Redo
↓
2D
↓
3D
↓
Export
↓
Import
↓
Validation
↓
Backward compatibility
```

Do not create runtime-only properties that accidentally disappear after export/import.

### Import must

* validate input
* normalize defaults
* preserve existing supported data
* support schema versions
* migrate old formats when required
* rebuild derived/runtime data correctly

### Export must

* serialize canonical domain data
* avoid serializing unnecessary renderer objects
* avoid circular runtime objects
* preserve required properties
* preserve relationships/references
* remain deterministic where possible

---

# 10. UNDO / REDO CONTRACT

Every user-visible domain mutation must be evaluated for history behavior.

For every feature ask:

```text
Create → Undo → Redo
Delete → Undo → Redo
Move → Undo → Redo
Resize → Undo → Redo
Rotate → Undo → Redo
Material → Undo → Redo
Shape change → Undo → Redo
Level change → Undo → Redo
Import → Undo/Redo if supported by project rules
```

Undo must restore the previous canonical state, not merely visually approximate it.

Redo must reproduce the same operation deterministically.

---

# 11. PATH AND FILE STRUCTURE

Preserve the project's existing directory conventions.

Before creating a file:

1. Search for similar files.
2. Identify where similar functionality already lives.
3. Follow existing naming conventions.
4. Follow existing module boundaries.
5. Do not create duplicate folders for the same responsibility.

Example:

If existing architecture is:

```text
src/core/walls/
src/core/roofs/
src/core/floors/
```

do not suddenly introduce:

```text
src/services/roof/
src/features/wall/
src/utils/floor/
```

unless there is a documented architectural reason.

### Path stability matters

Do not unnecessarily move or rename existing files.

If moving is genuinely required:

* update all imports
* update tests
* update registries
* update dynamic imports
* update exports
* verify build
* verify runtime paths
* verify import/export behavior

---

# 12. CODE STYLE CONSISTENCY

New code must match the existing project's:

* naming convention
* function style
* class style
* module style
* import style
* error handling
* logging
* comments
* typing
* async patterns
* dependency injection patterns
* event patterns

Do not introduce a new coding style merely because it is personally preferred.

---

# 13. ENGINE / RENDERER SEPARATION

Prefer this responsibility boundary:

```text
Domain Engine
    ↓
Canonical Data
    ↓
Renderer
    ↓
Three.js / Canvas / Konva / DOM
```

Domain engines should own:

* business rules
* geometry rules
* relationships
* validation
* mutation
* commands
* state transitions

Renderers should own:

* meshes
* lines
* sprites
* visual materials
* visual transforms
* scene graph
* drawing

Renderer code should not become a second domain engine.

---

# 14. DERIVED DATA

Clearly distinguish:

### Canonical data

Information that must be persisted.

Example:

```js
{
  id,
  position,
  height,
  thickness,
  material,
  levelId
}
```

### Derived data

Information that can be reconstructed.

Example:

```text
THREE.Mesh
BufferGeometry
BoundingBox
Temporary handles
Selection outlines
Render caches
```

Do not unnecessarily export derived rendering objects.

---

# 15. DISPOSAL / LIFECYCLE

For Three.js or other rendering systems, every new implementation must consider:

```text
create
update
replace
remove
dispose
```

Check:

* geometry disposal
* material disposal
* texture disposal
* event listener cleanup
* scene object removal
* stale references
* renderer cache cleanup

Repeated editing must not create memory leaks.

---

# 16. TESTING STANDARD

Before considering implementation complete, test:

### Domain

* creation
* update
* deletion
* relationships
* validation

### Commands

* execute
* undo
* redo
* repeated operations
* grouped operations if supported

### Persistence

* export
* import
* round trip

```text
Project
 → Export
 → Import
 → Compare canonical model
```

### Rendering

* 2D update
* 3D update
* 2D → model → 3D
* 3D interaction → model → 2D

### Regression

Existing functionality must continue working.

---

# 17. NO DUPLICATED SOURCE OF TRUTH

If the same value exists in multiple places, determine which one is authoritative.

Example:

```text
wall.height
room.height
mesh.scale.y
HUD.value
```

Do not allow all four to independently become authoritative.

Define:

```text
Canonical source
```

and derive everything else from it.

---

# 18. FEATURE IMPLEMENTATION CHECKLIST

Before writing code:

```text
[ ] Existing implementation searched
[ ] Similar feature searched
[ ] Existing engine identified
[ ] Existing command identified
[ ] Existing mutation path identified
[ ] Existing import/export identified
[ ] Existing 2D renderer identified
[ ] Existing 3D renderer identified
[ ] Existing tests identified
[ ] Existing file/path convention identified
```

During implementation:

```text
[ ] Reuse existing architecture
[ ] No unnecessary new engine
[ ] No direct domain mutation from UI
[ ] No duplicate state
[ ] Command-based mutation
[ ] 2D/3D use canonical model
[ ] Import/export supported
[ ] Undo/redo supported
[ ] Existing paths preserved
[ ] Existing naming conventions preserved
```

After implementation:

```text
[ ] Build passes
[ ] Existing tests pass
[ ] New tests added
[ ] Import/export round trip verified
[ ] Undo/redo verified
[ ] 2D/3D synchronization verified
[ ] No duplicate implementation created
[ ] No unused code introduced
[ ] No dead imports
[ ] No dead files
[ ] No direct mutation bypasses
[ ] No unnecessary architecture introduced
```

---

# 19. STANDARDIZATION RULE

When AI-generated code uses a different structure from the existing project:

**DO NOT accept the new structure simply because it works.**

Instead:

1. Detect the difference.
2. Compare it with existing project patterns.
3. Refactor the new code to match the established architecture.
4. Reuse existing abstractions.
5. Preserve existing behavior.
6. Verify imports and exports.
7. Verify commands.
8. Verify undo/redo.
9. Verify 2D/3D synchronization.
10. Verify tests.

The objective is not merely:

> "Does this code work?"

The objective is:

> **"Does this code work while behaving like it belongs to this project?"**

---

# 20. CODE QUALITY GATE

Before returning implementation, AI must perform a final architecture review.

Ask:

### Structure

* Did I follow the existing folder structure?
* Did I reuse existing modules?
* Did I introduce unnecessary files?

### Ownership

* Is there one clear owner for this domain behavior?
* Is the canonical model still the source of truth?

### Mutation

* Are all domain mutations centralized?
* Did any UI/renderer bypass the command/engine?

### Commands

* Can the operation be undone?
* Can it be redone?
* Is the operation deterministic?

### Persistence

* Does export preserve the new state?
* Does import restore it?
* Is backward compatibility considered?

### Synchronization

* Does 2D reflect the same canonical data?
* Does 3D reflect the same canonical data?

### Reuse

* Did I duplicate existing logic?
* Can this implementation be reused elsewhere?

### Cleanup

* Did I leave unused imports?
* Did I leave dead code?
* Did I create obsolete files?
* Did I create duplicate engines/managers?

### Regression

* Could this change break existing features?
* Did I preserve existing APIs and behavior?

---

# 21. FINAL PRINCIPLE

The AI must follow this priority:

```text
Existing Architecture
        ↓
Existing Domain Ownership
        ↓
Existing Command System
        ↓
Existing Canonical Model
        ↓
Existing Import/Export
        ↓
Existing Undo/Redo
        ↓
Existing 2D/3D Pipeline
        ↓
Existing File/Path Structure
        ↓
Reuse
        ↓
Extend
        ↓
Refactor
        ↓
Only then Create New Architecture
```

Never optimize for "new code".

Optimize for:

**consistency + reuse + centralized ownership + predictable mutation + persistence + history + 2D/3D synchronization + maintainability.**

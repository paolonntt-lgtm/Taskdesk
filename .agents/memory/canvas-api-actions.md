---
name: Canvas API action formats
description: Which applyCanvasActions formats actually work — critical differences between create-auto, update, and delete.
---

# Canvas API action formats

## Working formats (verified July 2026)

### create-auto (iframes only)
```js
{
  type: "create-auto",
  shapeIds: ["my-id"],   // plural array
  names: ["my-id"],      // REQUIRED, must match shapeIds
  shape: {
    shapeId: "my-id",
    type: "iframe",      // tldraw internal type name, NOT shapeType
    componentName: "...",
    componentPath: "artifacts/mockup-sandbox/src/components/mockups/...",
    url: "https://.../__mockup/preview/...",
    state: "live",
    x: 0, y: 0, w: 900, h: 720,  // position is IGNORED — shape placed at auto position
  }
}
```
Position is auto-assigned; use `update` afterward to move it.

### update (reposition, rename, etc.)
```js
{
  type: "update",
  shapeId: "my-id",    // singular — NOT shapeIds
  updates: {
    shapeType: "iframe",  // REQUIRED in updates for type safety
    x: 40,
    y: 4300,
    componentName: "New Name",
  }
}
```

### delete
```js
{
  type: "delete",
  shapeId: "my-id",    // singular — NOT shapeIds
}
```

## Not working (always fail with "procedure init failed validation")
- `create` action for text shapes — no format works (tried: nested shape with type/shapeType, flat fields, tldraw internal format with id/props, with/without richText, minimal/maximal)
- `move` action — all formats fail
- `resize` action — fails
- `update` with `shapeIds` (plural) — fails; must use singular `shapeId`
- `delete` with `shapeIds` (plural) — fails; must use singular `shapeId`

## Text labels
Cannot be created via the API as of July 2026. The only way to add text to the canvas is via the canvas UI directly. Workarounds: embed labels inside the mockup components themselves, or accept missing labels.

**Why:** The scribe service validates action payloads with strict schema checks. `create-auto` has a more permissive schema than `create`. The plural vs. singular `shapeId` inconsistency is a real API design quirk — `create-auto` uses plural (multiple shapes at once) while `update`/`delete` use singular (one shape per action).

**How to apply:** When adding shapes to the canvas, always use `create-auto` first, then `update` to correct the position. Budget one extra round-trip per iframe shape added.

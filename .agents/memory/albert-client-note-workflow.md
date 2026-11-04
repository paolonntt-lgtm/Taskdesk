---
name: Albert client-note workflow
description: The intended interaction for creating client notes from Albert.
---

Albert should expose an explicit “Aggiungi nota” quick action. After activating it, the user selects a client with `@` autocomplete and writes the note; the text does not need to repeat an “add note” command.

**Why:** Albert is conversational, so a normal client mention should not accidentally save a note. The explicit mode signals intent while keeping the flow close to the Notes Console.

**How to apply:** Preserve the quick action and client selection when changing Albert’s note flow. Direct note commands may remain supported for compatibility.

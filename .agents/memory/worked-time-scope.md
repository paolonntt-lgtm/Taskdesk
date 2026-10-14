---
name: Timer module and manual worked-time scope
description: Product decision separating organization-gated timers from the existing manual worked-time flow.
---

A separate organization-level timer module is disabled by default, and tracked tickets additionally require an explicit per-ticket opt-in. When the module is off, timer, compensation-classification, and report controls are hidden and their API writes are blocked, while saved classifications and sessions remain intact. Existing manual worked-time entry remains governed by its original setting and is not disabled by the timer-module switch.

**Why:** The task explicitly requires a separate organization gate while preserving the existing manual workflow. This supersedes the earlier per-ticket-only decision.

**How to apply:** Gate timer sessions, compensation settings, and the dedicated hours report on the organization module without deleting historical data; keep manual worked-time recording and its existing customer report independent.
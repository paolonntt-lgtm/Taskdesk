---
name: Timer module and manual worked-time scope
description: Product decision separating organization-gated timers from the existing manual worked-time flow.
---

A separate organization-level timer module is disabled by default, and tracked tickets additionally require an explicit per-ticket opt-in. When the module is off, timer, compensation-classification, and report controls are hidden and their API writes are blocked, while saved classifications and sessions remain intact. Existing manual worked-time entry remains governed by its original setting and is not disabled by the timer-module switch. If an admin or group manager starts a tracked ticket assigned to someone else, attribute the timer to that collaborator rather than the manager who changed the status.

**Why:** The task explicitly requires a separate organization gate while preserving the existing manual workflow. The user also expects distinct collaborators' practices to run concurrently, including when one admin or manager changes both statuses; attributing both sessions to that manager incorrectly trips the one-active-timer-per-user constraint.

**How to apply:** Gate timer sessions, compensation settings, and the dedicated hours report on the organization module without deleting historical data; keep manual worked-time recording and its existing customer report independent. Resolve the timer user from the assigned collaborator when an admin or group manager changes a ticket's status; keep the actor as owner when no individual assignee exists.
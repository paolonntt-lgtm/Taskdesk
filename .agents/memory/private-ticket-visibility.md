---
name: Private ticket visibility
description: Durable access-control rule for admin-only inbound tickets.
---

Tickets marked `admins` are an access-control boundary, not just a UI label: non-admin users must receive no ticket data or related resources, while admins can explicitly publish the ticket to the organization.

**Why:** A private ticket can leak through secondary endpoints (comments, files, activity, notes, checklists, search, statistics, bot context, or notifications) even when the main ticket list is filtered.

**How to apply:** Every endpoint or background job that returns or mutates ticket-derived data, including notification read actions, must enforce the same visibility rule. Assignment is independent from publication; assigning a private ticket must not grant access.
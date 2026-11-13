---
name: Mobile push notification routing
description: Open ticket links from TaskDesk push notifications on Android and iOS.
---

On native mobile, handle both response-listener events and the last notification response at startup. Queue ticket navigation until authentication is ready, then clear the handled response so an old push does not reopen on a later app launch. Ignore missing or invalid ticket IDs.

**Why:** A push can cold-start the app before the listener or authenticated route is ready; the root auth redirect can otherwise replace the intended ticket route.

**How to apply:** Preserve `ticketId` in Expo push data. Keep response parsing validated, defer routing until an authenticated user is available, and clear/deduplicate the startup response after handling.

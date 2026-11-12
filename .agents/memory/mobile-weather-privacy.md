---
name: Mobile weather privacy
description: User-selected provider and location-consent boundaries for TaskDesk Mobile weather.
---

Use WeatherAPI for the mobile dashboard's live weather. The user chose its free commercial plan and current GPS location. Keep the provider key on the server; ask permission before sending location, round coordinates to about 1 km, and do not persist them to the account. Be transparent that the rounded area is held temporarily in server memory for request caching.

**Why:** The user explicitly selected WeatherAPI and GPS after learning that a free commercial-use plan requires an account; location privacy remains a requirement.

**How to apply:** Keep the WeatherAPI key out of all mobile bundles and API responses. Maintain explicit Italian and English consent copy if changing the location flow or cache behavior.

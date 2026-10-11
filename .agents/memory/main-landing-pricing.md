---
name: Main landing pricing
description: Pricing presentation scope for the general homepage versus profession-specific landing pages.
---

Show only the three published fixed-price tiers on the general landing: Starter (€35/month), Team (€60/month), and Business (€100/month). Do not show the quote-based Enterprise tier there. Profession-specific pages may retain their existing Enterprise option.

**Why:** The user approved a five-section homepage and explicitly chose these three current prices, while preserving the existing profession pages. A prerendered-route check also exposed stale structured data that still published four offers and FAQ content after the visible section was removed.

**How to apply:** Filter Enterprise only from the general homepage and its structured pricing data. Keep the independent JSON-LD generator used by prerendering aligned with the React page, and test the generated HTML. Do not remove Enterprise from shared pricing data or profession routes as a side effect.

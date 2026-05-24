declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export type CtaLocation =
  | "navbar"
  | "hero"
  | "how_it_works"
  | "features"
  | "pricing"
  | "final";

export type ScrollDepthPct = 25 | 50 | 75 | 100;

function fire(eventName: string, params: Record<string, string | number>): void {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
  if (import.meta.env.DEV) {
    console.log(`[analytics] ${eventName}`, params);
  }
}

export function trackCta(location: CtaLocation, planName?: string): void {
  const params: Record<string, string> = { location };
  if (planName) params.plan = planName;
  fire("cta_click", params);
}

export function trackScrollDepth(pct: ScrollDepthPct): void {
  fire("scroll_depth", { percent: pct });
}

export function trackSectionView(section: string): void {
  fire("section_view", { section });
}

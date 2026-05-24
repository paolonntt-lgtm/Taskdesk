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

export function trackCta(location: CtaLocation, planName?: string): void {
  const params: Record<string, string> = { location };
  if (planName) params.plan = planName;

  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "cta_click", params);
  }

  if (import.meta.env.DEV) {
    console.log("[analytics] cta_click", params);
  }
}

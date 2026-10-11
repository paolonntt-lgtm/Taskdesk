import type { ProfessionId, ProfessionLanguage } from "../profession-content";

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export type AnalyticsData = Record<string, string | number | boolean>;

export type CtaLocation =
  | "navbar"
  | "hero"
  | "how_it_works"
  | "features"
  | "pricing"
  | "final";

export type ScrollDepthPct = 25 | 50 | 75 | 100;

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never break the app.
  }

  if (import.meta.env.DEV) {
    console.log(`[analytics] ${name}`, data);
  }
}

export function trackCta(location: CtaLocation, planName?: string): void {
  const params: AnalyticsData = { location };
  if (planName) params.plan = planName;
  trackEvent("cta_click", params);
}

export type ProfessionalTrialCtaLocation =
  | "navbar"
  | "hero"
  | "message"
  | "pricing"
  | "final"
  | "footer";

export const PROFESSIONAL_CAMPAIGNS = [
  "professionals-google-search",
  "professionals-meta-ads",
  "professionals-linkedin-ads",
  "professionals-newsletter",
  "professionals-partner",
] as const;

export type ProfessionalCampaign = (typeof PROFESSIONAL_CAMPAIGNS)[number] | "unattributed";

const PROFESSIONAL_CAMPAIGN_SET: ReadonlySet<string> = new Set(PROFESSIONAL_CAMPAIGNS);

export function getProfessionalCampaign(search: string): ProfessionalCampaign {
  const rawCampaign = new URLSearchParams(search).get("utm_campaign");
  if (!rawCampaign) return "unattributed";

  const normalizedCampaign = rawCampaign.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return PROFESSIONAL_CAMPAIGN_SET.has(normalizedCampaign)
    ? (normalizedCampaign as ProfessionalCampaign)
    : "unattributed";
}

export function trackProfessionalTrialCta(
  profession: ProfessionId,
  language: ProfessionLanguage,
  location: ProfessionalTrialCtaLocation,
  campaign: ProfessionalCampaign = "unattributed",
): void {
  trackEvent("professional_trial_cta_click", { profession, language, location, campaign });
}

export function trackScrollDepth(pct: ScrollDepthPct): void {
  trackEvent("scroll_depth", { percent: pct });
}

export function trackSectionView(section: string): void {
  trackEvent("section_view", { section });
}

export function trackBillingCycle(cycle: "monthly" | "annual"): void {
  trackEvent("billing_cycle_selected", { cycle });
}

export function trackLanguageChange(language: "it" | "en"): void {
  trackEvent("landing_language_changed", { language });
}

export function trackFaqToggle(opened: boolean): void {
  trackEvent("faq_toggled", { opened });
}

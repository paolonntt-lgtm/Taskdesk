export const PROFESSIONAL_DASHBOARD_PRESETS = {
  commercialisti: {
    businessType: "professional_studio",
    visibleIds: ["stat-open", "stat-overdue", "feed-my", "feed-due", "chart-category", "chart-priority"],
  },
  avvocati: {
    businessType: "professional_studio",
    visibleIds: ["stat-open", "stat-urgent", "feed-my", "feed-due", "chart-category", "chart-priority"],
  },
  "consulenti-del-lavoro": {
    businessType: "professional_studio",
    visibleIds: ["stat-open", "stat-overdue", "feed-my", "feed-due", "chart-category", "chart-priority"],
  },
  notai: {
    businessType: "professional_studio",
    visibleIds: ["stat-open", "stat-overdue", "feed-my", "feed-due", "chart-category", "chart-priority"],
  },
  commercio: {
    businessType: "other",
    visibleIds: ["stat-open", "stat-urgent", "stat-overdue", "feed-recent", "feed-assigned", "chart-status"],
  },
  agenzie: {
    businessType: "agency",
    visibleIds: ["stat-open", "stat-resolved", "stat-urgent", "feed-recent", "feed-assigned", "chart-trend", "chart-assignee"],
  },
} as const;

export type ProfessionalDashboardPresetId = keyof typeof PROFESSIONAL_DASHBOARD_PRESETS;
export type OnboardingProfileId = ProfessionalDashboardPresetId | "it_support" | "other";

export function isProfessionalDashboardPresetId(value: unknown): value is ProfessionalDashboardPresetId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PROFESSIONAL_DASHBOARD_PRESETS, value);
}

export function getOnboardingBusinessType(profile: OnboardingProfileId): string {
  if (isProfessionalDashboardPresetId(profile)) {
    return PROFESSIONAL_DASHBOARD_PRESETS[profile].businessType;
  }
  return profile;
}

export function getOnboardingDashboardPreset(profile: OnboardingProfileId): string[] {
  if (isProfessionalDashboardPresetId(profile)) {
    return [...PROFESSIONAL_DASHBOARD_PRESETS[profile].visibleIds];
  }

  if (profile === "it_support") {
    return ["stat-open", "stat-urgent", "stat-overdue", "stat-resolved", "feed-my", "feed-due", "chart-trend", "chart-status"];
  }

  return ["stat-open", "stat-resolved", "stat-urgent", "stat-overdue", "feed-my", "feed-due", "feed-recent"];
}

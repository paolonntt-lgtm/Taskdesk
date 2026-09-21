import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n";

const CONSENT_KEY = "td_cookie_consent_v1";
const GOOGLE_ANALYTICS_ID = "G-TW2H7Y4P9T";

type CookieConsent = "accepted" | "rejected" | null;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function setAnalyticsDisabled(disabled: boolean) {
  const windowWithAnalyticsFlag = window as unknown as Window & Record<string, unknown>;
  windowWithAnalyticsFlag[`ga-disable-${GOOGLE_ANALYTICS_ID}`] = disabled;
}

function loadGoogleAnalytics() {
  if (document.querySelector("script[data-taskdesk-google-analytics]")) return;

  setAnalyticsDisabled(false);
  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ANALYTICS_ID, { anonymize_ip: true });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
  script.dataset.taskdeskGoogleAnalytics = "true";
  document.head.appendChild(script);
}

function removeGoogleAnalytics() {
  setAnalyticsDisabled(true);
  document.querySelector("script[data-taskdesk-google-analytics]")?.remove();

  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.trim().split("=")[0];
    if (!name || (name !== "_ga" && !name.startsWith("_ga_"))) return;
    document.cookie = `${name}=; Max-Age=0; path=/`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}`;
  });
}

export default function CookieConsentBanner() {
  const { lang } = useLanguage();
  const [consent, setConsent] = useState<CookieConsent>(() => {
    try {
      const saved = localStorage.getItem(CONSENT_KEY);
      return saved === "accepted" || saved === "rejected" ? saved : null;
    } catch {
      return null;
    }
  });
  const [open, setOpen] = useState(consent === null);
  const isItalian = lang === "it";

  useEffect(() => {
    if (consent === "accepted") loadGoogleAnalytics();
  }, [consent]);

  useEffect(() => {
    const openSettings = () => setOpen(true);
    window.addEventListener("td-open-cookie-settings", openSettings);
    return () => window.removeEventListener("td-open-cookie-settings", openSettings);
  }, []);

  const saveConsent = (value: Exclude<CookieConsent, null>) => {
    try { localStorage.setItem(CONSENT_KEY, value); } catch { /* continue for restricted browsers */ }
    if (value === "accepted") loadGoogleAnalytics();
    else removeGoogleAnalytics();
    setConsent(value);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label={isItalian ? "Preferenze cookie" : "Cookie preferences"}
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 1600,
        maxWidth: 960,
        margin: "0 auto",
        padding: "18px 20px",
        border: "1px solid #dbe3ef",
        borderRadius: 16,
        background: "#fff",
        boxShadow: "0 16px 44px rgba(15, 23, 42, .16)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <strong style={{ display: "block", color: "#111827", fontSize: 14, marginBottom: 5 }}>
            {isItalian ? "Preferenze cookie" : "Cookie preferences"}
          </strong>
          <p style={{ margin: 0, color: "#4b5563", fontSize: 13, lineHeight: 1.5 }}>
            {isItalian
              ? "Usiamo cookie tecnici per il funzionamento del sito. Con il tuo consenso possiamo usare Google Analytics per capire come viene utilizzato il sito."
              : "We use technical cookies to operate the site. With your consent, we may use Google Analytics to understand how the site is used."}
          </p>
          <div style={{ marginTop: 7, fontSize: 12 }}>
            <a href={`${window.location.origin}/${isItalian ? "it" : "en"}/privacy-policy`} style={{ color: "#2563eb" }}>
              Privacy policy
            </a>
            {" · "}
            <a href={`${window.location.origin}/${isItalian ? "it" : "en"}/cookie-policy`} style={{ color: "#2563eb" }}>
              Cookie policy
            </a>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
          <button
            type="button"
            onClick={() => saveConsent("rejected")}
            style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 9, padding: "8px 13px", cursor: "pointer", fontWeight: 600 }}
          >
            {isItalian ? "Rifiuta" : "Reject"}
          </button>
          <button
            type="button"
            onClick={() => saveConsent("accepted")}
            style={{ border: "1px solid #2563eb", background: "#2563eb", color: "#fff", borderRadius: 9, padding: "8px 13px", cursor: "pointer", fontWeight: 700 }}
          >
            {isItalian ? "Accetta" : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/i18n";
import { InstallPrompt } from "@/components/InstallPrompt";
import { AndroidAppPrompt } from "@/components/AndroidAppPrompt";
import AccountDeletion from "./AccountDeletion";
import { PROFESSION_IDS, PROFESSION_SLUGS } from "../profession-routes";
import Landing from "./Landing";

describe("public visitor controls", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("IntersectionObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    sessionStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const useUserAgent = (userAgent: string) => {
    const mockNavigator = Object.create(window.navigator);
    Object.defineProperty(mockNavigator, "userAgent", {
      value: userAgent,
      configurable: true,
    });
    vi.stubGlobal("navigator", mockNavigator);
  };
  const useAndroidPhone = () => useUserAgent(
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit Mobile Safari",
  );

  it.each(["it", "en"])("exposes the active billing cycle and updates prices in %s", async (lang) => {
    window.history.replaceState({}, "", `/${lang}/`);
    await act(async () => {
      root.render(createElement(LanguageProvider, null, createElement(Landing)));
    });
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")];
    expect(buttons).toHaveLength(2);
    const [monthly, annual] = buttons;
    expect(monthly.getAttribute("aria-pressed")).toBe("true");
    expect(annual.getAttribute("aria-pressed")).toBe("false");
    const price = container.querySelector('[data-testid="landing-plan-card-starter"] .text-5xl')!;
    const monthlyPrice = price.textContent;

    await act(async () => annual.click());
    expect(monthly.getAttribute("aria-pressed")).toBe("false");
    expect(annual.getAttribute("aria-pressed")).toBe("true");
    expect(price.textContent).not.toBe(monthlyPrice);

    await act(async () => monthly.click());
    expect(monthly.getAttribute("aria-pressed")).toBe("true");
    expect(annual.getAttribute("aria-pressed")).toBe("false");
    expect(price.textContent).toBe(monthlyPrice);
  });

  it.each(["it", "en"])("keeps illustrations static and pricing copy readable in %s", async (lang) => {
    window.history.replaceState({}, "", `/${lang}/`);
    await act(async () => {
      root.render(createElement(LanguageProvider, null, createElement(Landing)));
    });
    for (const testId of ["hero-unified-request-visual", "ticket-chat-mockup"]) {
      const illustration = container.querySelector(`[data-testid="${testId}"]`)!;
      expect(illustration).not.toBeNull();
      expect(illustration.classList.contains("ld-float")).toBe(false);
    }
    expect(container.querySelector("style")?.textContent).not.toContain("ld-float");
    expect(container.querySelector("#pricing p.text-lg")?.classList.contains("text-gray-600"))
      .toBe(true);
  });

  it.each(["it", "en"])("keeps footer copy and legal controls readable in %s", async (lang) => {
    window.history.replaceState({}, "", `/${lang}/`);
    await act(async () => {
      root.render(createElement(LanguageProvider, null, createElement(Landing)));
    });
    const footer = container.querySelector("footer")!;
    const copy = footer.querySelector("p")!;
    expect(copy.textContent?.trim()).toBeTruthy();
    expect(copy.classList.contains("text-gray-600")).toBe(true);
    expect(copy.classList.contains("text-gray-400")).toBe(false);
    const controls = [...footer.querySelectorAll("a, button")];
    expect(controls).toHaveLength(6);
    for (const control of controls) {
      expect(control.textContent?.trim()).toBeTruthy();
      expect(control.classList.contains("text-gray-600")).toBe(true);
      expect(control.classList.contains("text-gray-400")).toBe(false);
      expect(control.classList.contains("hover:text-gray-900")).toBe(true);
      expect(control.classList.contains("focus-visible:text-gray-900")).toBe(true);
    }
    const cookieButton = footer.querySelector("button")!;
    expect(cookieButton.textContent?.trim())
      .toBe(lang === "it" ? "Preferenze cookie" : "Cookie preferences");
    expect(footer.querySelector('[data-testid="link-account-deletion"]')?.getAttribute("href"))
      .toBe(`/${lang}/account-deletion`);
    const openSettings = vi.fn();
    window.addEventListener("td-open-cookie-settings", openSettings);
    try {
      await act(async () => cookieButton.click());
      expect(openSettings).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("td-open-cookie-settings", openSettings);
    }
  });

  it.each(["it", "en"] as const)("links every profession card to its localized public page in %s", async (lang) => {
    window.history.replaceState({}, "", `/${lang}/`);
    await act(async () => {
      root.render(createElement(LanguageProvider, null, createElement(Landing)));
    });

    const links = container.querySelectorAll<HTMLAnchorElement>('[data-testid^="link-profession-card-"]');
    expect(links).toHaveLength(PROFESSION_IDS.length);

    for (const profession of PROFESSION_IDS) {
      const link = container.querySelector<HTMLAnchorElement>(
        `[data-testid="link-profession-card-${profession}"]`,
      );
      expect(link).not.toBeNull();
      const destination = new URL(link!.href);
      expect(destination.pathname).toBe(`/${lang}/${PROFESSION_SLUGS[lang][profession]}`);
      expect(destination.search).toBe("");
      expect(link!.textContent?.trim()).toBeTruthy();
    }
  });

  it("keeps the darker install close icon named and functional", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/en/");
    await act(async () => {
      root.render(createElement(LanguageProvider, null, createElement(InstallPrompt)));
    });
    await act(async () => {
      window.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true }));
      vi.advanceTimersByTime(3000);
    });
    const close = container.querySelector<HTMLButtonElement>("button[aria-label]")!;
    expect(close).not.toBeNull();
    expect(close.getAttribute("aria-label")).toBeTruthy();
    expect(close.style.color).toBe("rgb(75, 85, 99)");
    await act(async () => close.click());
    expect(container.querySelector("button[aria-label]")).toBeNull();
    expect(sessionStorage.getItem("taskdesk-install-dismissed")).toBe("1");
  });

  it("offers the Play Store app to Android phones when a store link is configured", async () => {
    vi.useFakeTimers();
    useAndroidPhone();
    window.history.replaceState({}, "", "/it/");
    await act(async () => {
      root.render(createElement(LanguageProvider, null, createElement(AndroidAppPrompt, {
        storeUrl: "https://play.google.com/store/apps/details?id=com.taskdesk.mobile",
      })));
    });
    expect(container.querySelector('[data-testid="android-app-prompt"]')).toBeNull();

    await act(async () => vi.advanceTimersByTime(3000));
    const link = container.querySelector<HTMLAnchorElement>('[data-testid="link-download-android-app"]');
    expect(link?.href).toBe("https://play.google.com/store/apps/details?id=com.taskdesk.mobile");
    expect(link?.textContent).toContain("Scarica dal Play Store");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="button-dismiss-android-app-prompt"]')?.click();
    });
    expect(container.querySelector('[data-testid="android-app-prompt"]')).toBeNull();
    expect(sessionStorage.getItem("taskdesk-android-app-dismissed")).toBe("1");
  });

  it("does not show the Android app prompt without a published store link", async () => {
    vi.useFakeTimers();
    useAndroidPhone();
    await act(async () => {
      root.render(createElement(LanguageProvider, null, createElement(AndroidAppPrompt, { storeUrl: "" })));
    });
    await act(async () => vi.advanceTimersByTime(5000));
    expect(container.querySelector('[data-testid="android-app-prompt"]')).toBeNull();
  });

  it("does not show the Android app prompt on iPhones", async () => {
    vi.useFakeTimers();
    useUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari");
    await act(async () => {
      root.render(createElement(LanguageProvider, null, createElement(AndroidAppPrompt, {
        storeUrl: "https://play.google.com/store/apps/details?id=com.taskdesk.mobile",
      })));
    });
    await act(async () => vi.advanceTimersByTime(5000));
    expect(container.querySelector('[data-testid="android-app-prompt"]')).toBeNull();
  });

  it.each(["it", "en"] as const)("provides a public account deletion request path in %s", async (lang) => {
    window.history.replaceState({}, "", `/${lang}/`);
    await act(async () => {
      root.render(createElement(LanguageProvider, null, createElement(AccountDeletion)));
    });

    expect(container.textContent).toContain(
      lang === "it" ? "Eliminazione account e dati" : "Account and data deletion",
    );
    expect(container.querySelector('[data-testid="link-open-taskdesk-for-deletion"]')?.getAttribute("href"))
      .toBe("/app/");
    expect(container.querySelector('[data-testid="link-account-deletion-email"]')?.getAttribute("href"))
      .toContain("mailto:privacy@taskdesk.it");
    expect(container.textContent).toContain(
      lang === "it" ? "fatture" : "invoices",
    );
  });
});

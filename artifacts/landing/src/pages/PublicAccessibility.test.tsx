import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/i18n";
import { InstallPrompt } from "@/components/InstallPrompt";
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
});

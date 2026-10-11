import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "@/i18n";
import { PROFESSION_IDS, PROFESSION_SLUGS, getProfessionPageProps } from "../profession-routes";
import ProfessionLanding from "./ProfessionLanding";

const campaignSearch = "?utm_source=partner&utm_medium=email&utm_campaign=professionals-newsletter&ref=launch";

describe("ProfessionLanding language switch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it.each(PROFESSION_IDS.flatMap((profession) => [
    { profession, from: "it" as const, to: "en" as const },
    { profession, from: "en" as const, to: "it" as const },
  ]))(
    "switches $profession from $from to its equivalent $to page and keeps campaign parameters",
    async ({ profession, from, to }) => {
      const currentPath = `/${from}/${PROFESSION_SLUGS[from][profession]}${campaignSearch}`;
      const expectedPath = `/${to}/${PROFESSION_SLUGS[to][profession]}`;
      window.history.replaceState({}, "", currentPath);

      await act(async () => {
        root.render(
          createElement(
            LanguageProvider,
            null,
            createElement(ProfessionLanding, getProfessionPageProps(profession)),
          ),
        );
      });

      const languageButton = container.querySelector<HTMLButtonElement>(
        '[data-testid="button-language"]',
      );
      expect(languageButton).not.toBeNull();

      await act(async () => {
        languageButton!.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          button: 0,
        }));
      });

      expect(window.location.pathname).toBe(expectedPath);
      expect(window.location.search).toBe(campaignSearch);
      expect(container.querySelector('[data-testid="button-language"]')?.textContent)
        .toBe(to === "en" ? "IT" : "EN");
    },
  );
});

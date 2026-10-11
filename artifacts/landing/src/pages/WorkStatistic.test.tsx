import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "@/i18n";
import { WorkStatistic } from "./Landing";

const sourceUrl =
  "https://www.microsoft.com/en-us/worklab/work-trend-index/2025-the-year-the-frontier-firm-is-born";

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0.15];

  constructor(_callback: IntersectionObserverCallback) {}

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

describe("Microsoft Work Trend Index statistic", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.IntersectionObserver = TestIntersectionObserver;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it.each([
    {
      language: "it",
      path: "/it",
      statement:
        "dei dipendenti intervistati afferma che il proprio lavoro è caotico e frammentato.",
      survey: "31.000 lavoratori in 31 Paesi",
      source: "Microsoft Work Trend Index 2025",
    },
    {
      language: "en",
      path: "/en",
      statement: "of employees surveyed say their work feels chaotic and fragmented.",
      survey: "31,000 workers across 31 countries",
      source: "Microsoft Work Trend Index 2025",
    },
  ])(
    "renders the sourced survey statistic in $language",
    async ({ path, statement, survey, source }) => {
      window.history.replaceState({}, "", path);

      await act(async () => {
        root.render(
          createElement(
            LanguageProvider,
            null,
            createElement(WorkStatistic),
          ),
        );
      });

      const content = container.textContent ?? "";
      const sourceLink = container.querySelector<HTMLAnchorElement>("a");

      expect(content).toContain("48%");
      expect(content).toContain(statement);
      expect(content).toContain(survey);
      expect(content).toContain(source);
      expect(sourceLink?.getAttribute("href")).toBe(sourceUrl);
      expect(content).not.toMatch(/TaskDesk/i);
    },
  );
});

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfessionEntryDialog } from "./ProfessionEntryDialog";
import { LanguageProvider } from "@/i18n";

describe("ProfessionEntryDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    window.history.replaceState({}, "", "/it");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete window.umami;
    vi.restoreAllMocks();
  });

  async function renderOpenDialog(onOpenChange = vi.fn()) {
    await act(async () => {
      root.render(
        createElement(
          LanguageProvider,
          null,
          createElement(ProfessionEntryDialog, { open: true, onOpenChange }),
        ),
      );
    });
  }

  it("tracks opening and selection as separate events", async () => {
    const track = vi.fn();
    window.umami = { track };
    await renderOpenDialog();

    const link = document.querySelector<HTMLAnchorElement>(
      '[data-testid="link-entry-profession-avvocati"]',
    );
    expect(link).not.toBeNull();
    expect(track).toHaveBeenCalledWith("profession_dialog_opened", { language: "it" });

    await act(async () => {
      link!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(track).toHaveBeenNthCalledWith(2, "profession_dialog_profession_selected", {
      profession: "avvocati",
      language: "it",
    });
    expect(window.location.pathname).toBe("/it/avvocato");
  });

  it("keeps profession navigation working when Umami is missing", async () => {
    delete window.umami;
    await renderOpenDialog();

    const link = document.querySelector<HTMLAnchorElement>(
      '[data-testid="link-entry-profession-avvocati"]',
    );
    expect(link).not.toBeNull();

    await act(async () => {
      link!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(window.location.pathname).toBe("/it/avvocato");
  });

  it.each([
    ["notai", "/it/notaio"],
    ["commercio", "/it/commercio"],
    ["agenzie", "/it/agenzia"],
  ])("opens the dedicated route for %s", async (profession, expectedPath) => {
    await renderOpenDialog();

    const link = document.querySelector<HTMLAnchorElement>(
      `[data-testid="link-entry-profession-${profession}"]`,
    );
    expect(link).not.toBeNull();

    await act(async () => {
      link!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(window.location.pathname).toBe(expectedPath);
  });

  it("uses the same mark dimensions and profile-specific presentation", async () => {
    await renderOpenDialog();

    const accountantsMark = document.querySelector<HTMLImageElement>(
      '[data-testid="link-entry-profession-commercialisti"] img',
    );
    const lawyersMark = document.querySelector<HTMLImageElement>(
      '[data-testid="link-entry-profession-avvocati"] img',
    );
    const consultantsMark = document.querySelector<HTMLImageElement>(
      '[data-testid="link-entry-profession-consulenti-del-lavoro"] img',
    );

    expect(accountantsMark?.className).toBe("h-10 w-20 object-contain");
    expect(lawyersMark?.className).toBe("h-10 w-10 object-contain");
    expect(consultantsMark?.className).toBe("h-10 w-10 object-contain");

    const markBackgrounds = [
      accountantsMark,
      lawyersMark,
      consultantsMark,
    ].map((image) => image?.parentElement?.className);
    expect(markBackgrounds.every((className) => className?.includes("bg-white"))).toBe(true);
    expect(new Set(markBackgrounds.map((className) => className?.replace(" mb-4", ""))).size).toBe(1);
  });

  it("centers each profession mark, title, and description", async () => {
    await renderOpenDialog();

    const cards = document.querySelectorAll<HTMLElement>(
      '[data-testid^="link-entry-profession-"]',
    );
    expect(cards).toHaveLength(6);
    expect(document.querySelector('[data-testid="link-entry-profession-helpdesk-it"]')).toBeNull();
    for (const card of cards) {
      expect(card.classList.contains("items-center")).toBe(true);
      expect(card.classList.contains("text-center")).toBe(true);
      expect(card.querySelector(".relative.block")?.classList.contains("text-center")).toBe(true);
      expect(card.querySelector(".mt-2.w-full")?.classList.contains("text-center")).toBe(true);
    }
  });

  it.each([
    ["close button", (container: HTMLElement) => {
      const button = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Chiudi la scelta della professione"]',
      );
      if (!button) throw new Error("Profession dialog close button not found");
      button.click();
    }, "x"],
    ["backdrop", () => {
      const overlay = document.querySelector<HTMLElement>(
        '[data-state="open"].fixed.inset-0',
      );
      if (!overlay) throw new Error("Profession dialog overlay not found");
      overlay.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    }, "backdrop"],
    ["Escape", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }));
    }, "escape"],
  ] as const)("tracks closing by %s with its method", async (_label, close, method) => {
    const track = vi.fn();
    window.umami = { track };
    await renderOpenDialog();
    track.mockClear();

    await act(async () => close(container));

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("profession_dialog_closed", { language: "it", method });
  });
});

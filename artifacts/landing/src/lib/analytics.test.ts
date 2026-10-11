import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  trackProfessionDialogClosed,
  trackProfessionDialogOpened,
  trackProfessionDialogProfessionSelected,
} from "./analytics";

describe("profession dialog analytics", () => {
  const track = vi.fn();

  beforeEach(() => {
    track.mockClear();
    window.umami = { track };
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete window.umami;
    vi.restoreAllMocks();
  });

  it("sends distinct open, selection, and close events with only their allowed properties", () => {
    trackProfessionDialogOpened("it");
    trackProfessionDialogProfessionSelected("avvocati", "en");

    for (const method of ["x", "backdrop", "escape"] as const) {
      trackProfessionDialogClosed("it", method);
    }

    expect(track.mock.calls).toEqual([
      ["profession_dialog_opened", { language: "it" }],
      ["profession_dialog_profession_selected", { profession: "avvocati", language: "en" }],
      ["profession_dialog_closed", { language: "it", method: "x" }],
      ["profession_dialog_closed", { language: "it", method: "backdrop" }],
      ["profession_dialog_closed", { language: "it", method: "escape" }],
    ]);
    expect(new Set(track.mock.calls.map(([eventName]) => eventName)).size).toBe(3);
    for (const [, properties] of track.mock.calls) {
      expect(Object.keys(properties!)).toEqual(
        properties && "profession" in properties
          ? ["profession", "language"]
          : properties && "method" in properties
            ? ["language", "method"]
            : ["language"],
      );
    }
  });

  it("does not send unsupported professions, languages, or close methods", () => {
    trackProfessionDialogOpened("fr");
    trackProfessionDialogOpened(undefined);
    trackProfessionDialogProfessionSelected("avvocati", "fr");
    trackProfessionDialogProfessionSelected("consulente", "it");
    trackProfessionDialogClosed("de", "escape");
    trackProfessionDialogClosed("it", "button" as "x");

    expect(track).not.toHaveBeenCalled();
  });

  it.each(["helpdesk-it", "agenzie"] as const)("tracks the new %s profile", (profession) => {
    trackProfessionDialogProfessionSelected(profession, "it");
    expect(track).toHaveBeenCalledWith("profession_dialog_profession_selected", {
      profession,
      language: "it",
    });
  });

  it("keeps tracking calls safe when Umami is missing or throws", () => {
    delete window.umami;
    expect(() => trackProfessionDialogOpened("it")).not.toThrow();

    window.umami = {
      track: () => {
        throw new Error("tracker unavailable");
      },
    };
    expect(() => trackProfessionDialogProfessionSelected("avvocati", "it")).not.toThrow();
  });
});

// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useResolvedColorScheme, useThemePreference } from "./ThemeContext";

const mocks = vi.hoisted(() => ({
  stored: new Map<string, string>(),
  setColorScheme: vi.fn(),
  systemScheme: "light" as "light" | "dark",
}));

vi.mock("react-native", () => ({
  Appearance: { setColorScheme: mocks.setColorScheme },
  Platform: { OS: "ios" },
  useColorScheme: () => mocks.systemScheme,
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => mocks.stored.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      mocks.stored.set(key, value);
    }),
  },
}));

function ThemeProbe() {
  const { preference, isLoaded, setThemePreference } = useThemePreference();
  const colorScheme = useResolvedColorScheme();
  return (
    <div>
      <span data-testid="theme-preference">{preference}</span>
      <span data-testid="resolved-scheme">{colorScheme}</span>
      <span data-testid="theme-loaded">{String(isLoaded)}</span>
      <button data-testid="choose-light" onClick={() => void setThemePreference("light")}>Light</button>
      <button data-testid="choose-system" onClick={() => void setThemePreference("system")}>Automatic</button>
    </div>
  );
}

describe("mobile theme preference", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.stored.clear();
    mocks.setColorScheme.mockClear();
    mocks.systemScheme = "light";
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  const renderTheme = async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  };

  it("restores a saved dark preference when the provider loads", async () => {
    mocks.stored.set("theme-preference", "dark");
    await renderTheme();

    expect(host.querySelector('[data-testid="theme-preference"]')?.textContent).toBe("dark");
    expect(host.querySelector('[data-testid="resolved-scheme"]')?.textContent).toBe("dark");
    expect(host.querySelector('[data-testid="theme-loaded"]')?.textContent).toBe("true");
    expect(mocks.setColorScheme).toHaveBeenLastCalledWith("dark");
  });

  it("saves explicit themes and returns to following the system", async () => {
    mocks.systemScheme = "dark";
    await renderTheme();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="choose-light"]')?.click();
      await Promise.resolve();
    });
    expect(host.querySelector('[data-testid="theme-preference"]')?.textContent).toBe("light");
    expect(host.querySelector('[data-testid="resolved-scheme"]')?.textContent).toBe("light");
    expect(mocks.stored.get("theme-preference")).toBe("light");
    expect(mocks.setColorScheme).toHaveBeenLastCalledWith("light");

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="choose-system"]')?.click();
      await Promise.resolve();
    });
    expect(host.querySelector('[data-testid="theme-preference"]')?.textContent).toBe("system");
    expect(host.querySelector('[data-testid="resolved-scheme"]')?.textContent).toBe("dark");
    expect(mocks.stored.get("theme-preference")).toBe("system");
    expect(mocks.setColorScheme).toHaveBeenLastCalledWith("unspecified");
  });
});

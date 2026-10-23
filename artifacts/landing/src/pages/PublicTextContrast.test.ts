import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");
const theme = readFileSync(new URL(import.meta.resolve("tailwindcss/theme.css")), "utf8");
const stylesheet = source("../index.css");

// WCAG relative luminance uses linear sRGB, not the OKLCH lightness value.
function luminance(rgb: number[]) {
  return rgb.reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
}

function hexLuminance(hex: string) {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map(c => c + c).join("")}` : hex;
  return luminance([1, 3, 5].map(i => {
    const srgb = parseInt(full.slice(i, i + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  }));
}

function tokenLuminance(token: string) {
  const declaration = theme.match(new RegExp(`--color-${token}:\\s*([^;]+);`))?.[1];
  expect(declaration, `Tailwind ${token} token`).toBeDefined();
  // Fail explicitly if the palette changes format or the app overrides this token.
  expect(stylesheet).not.toMatch(new RegExp(`--color-${token}\\s*:`));
  const oklch = declaration!.match(/^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)$/);
  expect(oklch, `Supported palette format for ${token}`).not.toBeNull();
  const lightness = Number(oklch![1]) / 100;
  const chroma = Number(oklch![2]);
  const hue = Number(oklch![3]) * Math.PI / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return luminance([
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(c => Math.max(0, Math.min(1, c))));
}

function contrast(a: number, b: number) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("source-confirmed public small-text contrast (WCAG 1.4.3 AA)", () => {
  it.each(["Pratica", "Request"])("keeps the homepage %s label above 4.5:1", label => {
    const landing = source("./Landing.tsx");
    const header = landing.match(
      /<div className="([^"]*\bbg-white\b[^"]*)">\s*<div className="([^"]+)">\s*\{lang === "it" \? "Pratica" : "Request"\}/,
    );
    expect(header, `Shared IT/EN ticket header for ${label}`).not.toBeNull();
    expect(header![2]).toContain("text-xs");
    const foreground = header![2].match(/\btext-(gray-\d+)\b/)?.[1];
    expect(foreground).toBeDefined();
    expect(stylesheet).not.toMatch(/--color-white\s*:/);
    expect(theme).toMatch(/--color-white:\s*#fff;/);
    expect(contrast(tokenLuminance(foreground!), hexLuminance("#fff"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["PrivacyPolicy", "TermsOfService", "DPA", "CookiePolicy"])(
    "keeps the %s breadcrumb above 4.5:1 on its explicit header background",
    page => {
      const header = source(`./${page}.tsx`).match(/<header\b[\s\S]*?<\/header>/)?.[0];
      expect(header).toBeDefined();
      const background = header!.match(/backgroundColor:\s*"(#[a-f\d]{3,6})"/i)?.[1];
      const breadcrumb = header!.match(
        /<span style=\{\{ color: "(#[a-f\d]{6})", fontSize: 14 \}\}>\/ [^<]+<\/span>/i,
      );
      expect(background).toBeDefined();
      expect(breadcrumb).not.toBeNull();
      expect(contrast(hexLuminance(breadcrumb![1]), hexLuminance(background!)))
        .toBeGreaterThanOrEqual(4.5);
    },
  );

  it("rejects the previously faint foregrounds against white", () => {
    expect(contrast(tokenLuminance("gray-400"), 1)).toBeLessThan(4.5);
    expect(contrast(hexLuminance("#9ca3af"), 1)).toBeLessThan(4.5);
  });
});

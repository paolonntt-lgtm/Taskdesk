// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROFESSION_SLUGS, getProfessionPageProps } from "./profession-routes";
import type { ProfessionId, ProfessionLanguage } from "./profession-content";

describe("llms.txt canonical landing pages", () => {
  it("lists every localized profession canonical exactly once, without stale routes", () => {
    const content = readFileSync(
      new URL("../public/llms.txt", import.meta.url),
      "utf8",
    );
    const section = content.split("## Landing pages (canonical content, indexed)\n")[1]
      ?.split("\n## ")[0];
    expect(section).toBeDefined();

    const urls = [...section!.matchAll(/^- (https:\/\/\S+) — .+$/gm)]
      .map((match) => match[1]);
    const expected = ["https://taskdesk.it/it/", "https://taskdesk.it/en/"];

    for (const lang of Object.keys(PROFESSION_SLUGS) as ProfessionLanguage[]) {
      for (const profession of Object.keys(PROFESSION_SLUGS[lang]) as ProfessionId[]) {
        const url = `https://taskdesk.it/${lang}/${PROFESSION_SLUGS[lang][profession]}`;
        expect(getProfessionPageProps(profession).metadata[lang].canonical).toBe(url);
        expected.push(url);
      }
    }

    expect(urls.sort()).toEqual(expected.sort());
  });
});

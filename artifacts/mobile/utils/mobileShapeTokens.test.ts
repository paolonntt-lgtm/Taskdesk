import { describe, expect, it } from "vitest";
import { radii } from "@/constants/colors";

describe("mobile shape tokens", () => {
  it("keeps controls, cards, and prominent panels visually distinct", () => {
    expect(radii.compact).toBeLessThan(radii.control);
    expect(radii.control).toBeLessThan(radii.card);
    expect(radii.card).toBeLessThan(radii.prominent);
    expect(radii.pill).toBeGreaterThan(radii.prominent);
  });
});

import { describe, expect, it } from "vitest";
import { getMobileBottomBarLayout } from "./mobileBottomBarLayout";

describe("mobile bottom bar layout", () => {
  it.each([
    ["compact iPhone", 320],
    ["standard iPhone", 390],
    ["compact Android", 360],
    ["standard Android", 412],
  ])("keeps the New action centered and tappable on a %s width (%i pt)", (_device, width) => {
    const layout = getMobileBottomBarLayout(
      ["index", "tickets", "calendar"],
      true,
    );
    const newAction = layout.find(({ routeName }) => routeName === "new");

    expect(newAction).toEqual({ routeName: "new", left: 40, width: 20 });
    expect((newAction!.left + newAction!.width / 2) * width / 100).toBe(width / 2);
    expect(newAction!.width * width / 100).toBeGreaterThanOrEqual(56);
  });

  it("puts New in the exact center when one optional tab is hidden", () => {
    const layout = getMobileBottomBarLayout(
      ["index", "tickets", "calendar", "clients-tab"],
      true,
    );

    expect(layout.map(({ routeName }) => routeName)).toEqual([
      "index",
      "tickets",
      "new",
      "calendar",
      "clients-tab",
    ]);
    expect(layout.find(({ routeName }) => routeName === "new")?.left).toBe(40);
  });

  it("keeps New centered when both optional tabs are hidden", () => {
    const layout = getMobileBottomBarLayout(
      ["index", "tickets", "calendar"],
      true,
    );

    expect(layout.map(({ routeName }) => routeName)).toEqual([
      "index",
      "tickets",
      "new",
      "calendar",
    ]);
    expect(layout.find(({ routeName }) => routeName === "new")?.left).toBe(40);
  });

  it("uses the full row for navigation when both optional products are enabled", () => {
    const layout = getMobileBottomBarLayout(
      ["index", "tickets", "calendar", "hours-report-tab", "clients-tab"],
      false,
    );

    expect(layout).toHaveLength(5);
    expect(layout.some(({ routeName }) => routeName === "new")).toBe(false);
    expect(layout.every(({ width }) => width === 20)).toBe(true);
  });
});

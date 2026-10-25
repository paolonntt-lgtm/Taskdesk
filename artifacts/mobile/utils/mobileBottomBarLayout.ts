export type MobileBottomBarItemPosition = {
  routeName: string;
  left: number;
  width: number;
};

const CENTER_ACTION_SLOT = 2;
const SLOT_WIDTH = 20;

export function getMobileBottomBarLayout(
  routeNames: string[],
  showNewTicket: boolean,
): MobileBottomBarItemPosition[] {
  if (!showNewTicket) {
    const width = routeNames.length ? 100 / routeNames.length : 0;
    return routeNames.map((routeName, index) => ({
      routeName,
      left: index * width,
      width,
    }));
  }

  const routeSlots =
    routeNames.length >= 4
      ? [0, 1, 3, 4]
      : routeNames.length === 3
        ? [0, 1, 3]
        : routeNames.length === 2
          ? [0, 4]
          : [1];
  const items = routeNames.slice(0, routeSlots.length).map((routeName, index) => ({
    routeName,
    left: routeSlots[index] * SLOT_WIDTH,
    width: SLOT_WIDTH,
  }));
  items.push({
    routeName: "new",
    left: CENTER_ACTION_SLOT * SLOT_WIDTH,
    width: SLOT_WIDTH,
  });
  return items.sort((a, b) => a.left - b.left);
}

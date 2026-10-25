import colors from "@/constants/colors";

/**
 * Returns the light palette while the mobile app is being tried in light mode.
 */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}

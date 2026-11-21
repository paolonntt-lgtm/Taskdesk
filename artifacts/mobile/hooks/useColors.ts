import colors from "@/constants/colors";
import { useResolvedColorScheme } from "@/contexts/ThemeContext";

/**
 * Returns the palette matching the selected app appearance.
 */
export function useColors() {
  const scheme = useResolvedColorScheme();
  return { ...(scheme === "dark" ? colors.dark : colors.light), radius: colors.radius };
}

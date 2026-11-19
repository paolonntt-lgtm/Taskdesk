import colors from "@/constants/colors";
import { useColorScheme } from "react-native";

/**
 * Returns the palette matching the device appearance.
 */
export function useColors() {
  const scheme = useColorScheme();
  return { ...(scheme === "dark" ? colors.dark : colors.light), radius: colors.radius };
}

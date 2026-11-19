import React from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { useGetMobileWidgetSummary } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { clearTicketsWidget, syncTicketsWidget } from "@/utils/ticketsWidget";

export function TicketsWidgetSync() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const scope = user ? `${user.id}:${user.activeWorkspaceId ?? user.organizationId ?? "none"}` : null;
  const summaryQuery = useGetMobileWidgetSummary({
    query: {
      queryKey: ["/api/stats/mobile-widget", user?.id],
      enabled: Platform.OS === "android" && Constants.appOwnership !== "expo" && !!user,
      refetchInterval: 15 * 60_000,
      refetchIntervalInBackground: false,
    },
  });
  const lastScope = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (Platform.OS !== "android") return;
    if (lastScope.current !== scope) {
      lastScope.current = scope;
      void clearTicketsWidget();
    }
  }, [scope]);

  React.useEffect(() => {
    if (Platform.OS !== "android" || !user || !summaryQuery.isSuccess || summaryQuery.isFetching) return;
    void syncTicketsWidget(summaryQuery.data, lang).catch(() => {});
  }, [lang, scope, summaryQuery.data, summaryQuery.isFetching, summaryQuery.isSuccess, user]);

  return null;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import type { MobileWidgetSummary } from "@workspace/api-client-react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import type { TicketWidgetLanguage } from "@/components/TaskDeskTicketsWidget";

const WIDGET_STORAGE_KEY = "taskdesk.ticket-widget.v1";
const EMPTY_TICKET_WIDGET: MobileWidgetSummary = {
  openCount: 0,
  assignedCount: 0,
  openTickets: [],
  assignedTickets: [],
};

if (Constants.appOwnership !== "expo") {
  const { registerWidgetTaskHandler } = require("react-native-android-widget");
  registerWidgetTaskHandler(async ({ renderWidget }: WidgetTaskHandlerProps) => {
    let summary = EMPTY_TICKET_WIDGET;
    let language: TicketWidgetLanguage = "it";
    try {
      const stored = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
      if (stored) {
        const payload = JSON.parse(stored) as {
          summary?: MobileWidgetSummary;
          language?: TicketWidgetLanguage;
        };
        if (payload.summary) summary = payload.summary;
        if (payload.language === "it" || payload.language === "en") language = payload.language;
      }
    } catch {
      // Render an empty, safe state if stored data is missing or invalid.
    }
    const { TaskDeskTicketsWidget } = require("./components/TaskDeskTicketsWidget");
    renderWidget(<TaskDeskTicketsWidget summary={summary} language={language} />);
  });
}

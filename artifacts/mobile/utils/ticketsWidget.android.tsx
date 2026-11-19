import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import type { MobileWidgetSummary } from "@workspace/api-client-react";
import {
  type TicketWidgetLanguage,
} from "@/components/TaskDeskTicketsWidget";

const WIDGET_STORAGE_KEY = "taskdesk.ticket-widget.v1";
const WIDGET_NAME = "TaskDeskTickets";

export async function syncTicketsWidget(
  summary: MobileWidgetSummary,
  language: TicketWidgetLanguage,
): Promise<void> {
  if (Constants.appOwnership === "expo") return;
  await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify({ summary, language }));
  const { requestWidgetUpdate } = require("react-native-android-widget");
  const { TaskDeskTicketsWidget } = require("../components/TaskDeskTicketsWidget");
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: () => <TaskDeskTicketsWidget summary={summary} language={language} />,
  });
}

export async function clearTicketsWidget(): Promise<void> {
  if (Constants.appOwnership === "expo") return;
  await AsyncStorage.removeItem(WIDGET_STORAGE_KEY);
  const { requestWidgetUpdate } = require("react-native-android-widget");
  const { TaskDeskTicketsWidget, EMPTY_TICKET_WIDGET } = require("../components/TaskDeskTicketsWidget");
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: () => <TaskDeskTicketsWidget summary={EMPTY_TICKET_WIDGET} language="it" />,
  });
}

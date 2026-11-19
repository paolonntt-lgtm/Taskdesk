import type { MobileWidgetSummary } from "@workspace/api-client-react";
import type { TicketWidgetLanguage } from "@/components/TaskDeskTicketsWidget";

export async function syncTicketsWidget(
  _summary: MobileWidgetSummary,
  _language: TicketWidgetLanguage,
): Promise<void> {}
export async function clearTicketsWidget(): Promise<void> {}

import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { MobileWidgetSummary } from "@workspace/api-client-react";

export const EMPTY_TICKET_WIDGET: MobileWidgetSummary = {
  openCount: 0,
  assignedCount: 0,
  openTickets: [],
  assignedTickets: [],
};

export type TicketWidgetLanguage = "it" | "en";
const OPEN_TICKETS_URI = "mobile:///tickets?status=open";
const ASSIGNED_TICKETS_URI = "mobile:///tickets?assignedTo=me";

function TicketSection({
  title,
  count,
  tickets,
  uri,
  language,
}: {
  title: string;
  count: number;
  tickets: MobileWidgetSummary["openTickets"];
  uri: string;
  language: TicketWidgetLanguage;
}) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      accessibilityLabel={`${title}: ${count}`}
      style={{
        backgroundColor: "#FFFFFF",
        borderColor: "#D8E2F0",
        borderRadius: 14,
        borderWidth: 1,
        padding: 12,
        flex: 1,
        flexDirection: "column",
      }}
    >
      <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <TextWidget text={title} style={{ color: "#172B4D", fontSize: 13, fontWeight: "700" }} />
        <TextWidget text={String(count)} style={{ color: "#0F62FE", fontSize: 18, fontWeight: "700" }} />
      </FlexWidget>
      {tickets.length === 0 ? (
        <TextWidget text={language === "it" ? "Nessun ticket" : "No tickets"} style={{ color: "#64748B", fontSize: 11, marginTop: 6 }} />
      ) : tickets.slice(0, 2).map((ticket) => (
        <TextWidget
          key={ticket.id}
          text={`${ticket.ticketNumber ? `#${ticket.ticketNumber} ` : ""}${ticket.title}`}
          maxLines={1}
          truncate="END"
          style={{ color: "#334155", fontSize: 11, marginTop: 6 }}
        />
      ))}
    </FlexWidget>
  );
}

export function TaskDeskTicketsWidget({
  summary,
  language,
}: {
  summary: MobileWidgetSummary;
  language: TicketWidgetLanguage;
}) {
  return (
    <FlexWidget
      style={{
        backgroundColor: "#EEF4FF",
        borderRadius: 20,
        padding: 12,
        flex: 1,
        flexDirection: "column",
      }}
    >
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <TextWidget text="TaskDesk" style={{ color: "#0F62FE", fontSize: 15, fontWeight: "700" }} />
        <TextWidget text={language === "it" ? "  ·  I tuoi ticket" : "  ·  Your tickets"} style={{ color: "#64748B", fontSize: 11 }} />
      </FlexWidget>
      <FlexWidget style={{ flex: 1, flexDirection: "row", flexGap: 8 }}>
        <TicketSection title={language === "it" ? "Aperti" : "Open"} count={summary.openCount} tickets={summary.openTickets} uri={OPEN_TICKETS_URI} language={language} />
        <TicketSection title={language === "it" ? "Assegnati a me" : "Assigned to me"} count={summary.assignedCount} tickets={summary.assignedTickets} uri={ASSIGNED_TICKETS_URI} language={language} />
      </FlexWidget>
    </FlexWidget>
  );
}

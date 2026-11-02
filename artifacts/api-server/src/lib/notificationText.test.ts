import { describe, expect, it } from "vitest";
import { buildNotificationEmail } from "./email";
import { renderNotificationText, type NotificationContent } from "./notificationText";

describe("renderNotificationText", () => {
  it("renders one structured ticket notification in each recipient language", () => {
    const content: NotificationContent = {
      key: "ticket_assigned",
      actorName: "Alex",
      ticketNumber: 42,
      ticketTitle: "Printer offline",
    };

    expect(renderNotificationText(content, "it"))
      .toBe('Alex ti ha assegnato il ticket #42: "Printer offline"');
    expect(renderNotificationText(content, "en"))
      .toBe('Alex assigned you ticket #42: "Printer offline"');
  });

  it("localizes status and priority labels while preserving ticket details", () => {
    expect(renderNotificationText({
      key: "ticket_status_changed",
      actorName: "Alex",
      ticketNumber: 42,
      status: "In lavorazione",
      ticketTitle: "Printer offline",
    }, "en")).toBe('Alex changed the status of ticket #42 to "In progress": "Printer offline"');

    expect(renderNotificationText({
      key: "ticket_priority_changed",
      actorName: "Alex",
      ticketNumber: 42,
      priority: "urgent",
      ticketTitle: "Printer offline",
    }, "en")).toBe('Alex changed the priority of ticket #42 to "Urgent": "Printer offline"');
  });

  it.each([
    [
      { key: "ticket_assigned_to_group", actorName: "Alex", ticketNumber: 42, groupName: "Support", ticketTitle: "Printer offline" },
      'Alex ha assegnato il ticket #42 al tuo gruppo "Support": "Printer offline"',
      'Alex assigned ticket #42 to your group "Support": "Printer offline"',
    ],
    [
      { key: "ticket_assigned_to_you", ticketNumber: 42, ticketTitle: "Printer offline" },
      'Ti è stato assegnato il ticket #42: "Printer offline"',
      'Ticket #42 has been assigned to you: "Printer offline"',
    ],
    [
      { key: "recurring_ticket_assigned", ticketNumber: 42, ticketTitle: "Printer offline" },
      'Nuova pratica ricorrente #42: "Printer offline"',
      'New recurring ticket #42: "Printer offline"',
    ],
    [
      { key: "ticket_created_from_email", senderName: "Sam", ticketNumber: 42, ticketTitle: "Printer offline" },
      'Nuova richiesta via email da Sam: "Printer offline" (ticket #42)',
      'New request via email from Sam: "Printer offline" (ticket #42)',
    ],
    [
      { key: "ticket_commented", actorName: "Alex", ticketNumber: 42, ticketTitle: "Printer offline" },
      'Alex ha commentato il ticket #42: "Printer offline"',
      'Alex commented on ticket #42: "Printer offline"',
    ],
    [
      { key: "ticket_email_reply", actorName: "Sam", ticketNumber: 42, ticketTitle: "Printer offline" },
      'Sam ha risposto via email al ticket #42: "Printer offline"',
      'Sam replied by email to ticket #42: "Printer offline"',
    ],
    [
      { key: "ticket_mentioned", actorName: "Alex", ticketNumber: 42, ticketTitle: "Printer offline" },
      'Alex ti ha menzionato nel ticket #42: "Printer offline"',
      'Alex mentioned you in ticket #42: "Printer offline"',
    ],
    [
      { key: "group_mentioned", actorName: "Alex", groupName: "Support", ticketNumber: 42, ticketTitle: "Printer offline" },
      'Alex ha menzionato il gruppo "Support" nel ticket #42: "Printer offline"',
      'Alex mentioned the group "Support" in ticket #42: "Printer offline"',
    ],
    [
      { key: "ticket_due", ticketNumber: 42, ticketTitle: "Printer offline" },
      'Il ticket #42 "Printer offline" è scaduto e non è ancora stato risolto.',
      'Ticket #42 "Printer offline" is overdue and has not been resolved.',
    ],
    [
      { key: "time_session_corrected", ticketNumber: 42, ticketTitle: "Printer offline" },
      'L\'amministratore ha aggiornato le tue ore registrate sul ticket #42: "Printer offline".',
      'The administrator updated your recorded hours on ticket #42: "Printer offline".',
    ],
    [
      { key: "daily_report_submitted", actorName: "Alex", location: "Milan" },
      'Alex ha pubblicato il report di oggi — Sede: Milan',
      "Alex submitted today's report — Location: Milan",
    ],
    [
      { key: "workspace_member_added", actorName: "Alex", workspaceName: "Team" },
      "Alex ti ha aggiunto allo spazio condiviso Team.",
      "Alex added you to the shared workspace Team.",
    ],
    [
      { key: "workspace_invite_accepted", actorName: "Alex", workspaceName: "Team" },
      "Alex ha accettato l'invito allo spazio condiviso Team.",
      "Alex accepted the invitation to the shared workspace Team.",
    ],
  ] as const)("localizes %s for both supported languages", (content, italian, english) => {
    expect(renderNotificationText(content, "it")).toBe(italian);
    expect(renderNotificationText(content, "en")).toBe(english);
  });

  it("keeps untranslated legacy copy unchanged instead of guessing its meaning", () => {
    const invitation = {
      key: "legacy" as const,
      text: "You received an invitation to a shared workspace.",
    };
    expect(renderNotificationText(invitation, "it")).toBe(invitation.text);
    expect(renderNotificationText(invitation, "en")).toBe(invitation.text);
  });

  it("uses the same localized body in notification emails", () => {
    const message = renderNotificationText({
      key: "ticket_assigned",
      actorName: "Alex",
      ticketNumber: 42,
      ticketTitle: "Printer offline",
    }, "en");
    const email = buildNotificationEmail({
      recipientName: "Jamie",
      text: message,
      ticketId: 42,
      appBaseUrl: "https://taskdesk.example",
      language: "en",
    });

    expect(email.text).toContain(`\n\n${message}\n\n`);
    expect(email.html).toContain(message.replaceAll('"', "&quot;"));
    expect(email.html).toContain("Hi <strong>Jamie</strong>");
    expect(email.html).toContain("Open in TaskDesk");
    expect(email.html).toContain("You received this email");
  });
});

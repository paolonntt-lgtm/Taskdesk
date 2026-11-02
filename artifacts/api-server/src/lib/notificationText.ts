export type NotificationLanguage = "it" | "en";

export type NotificationMessage =
  | { key: "ticket_assigned"; actorName: string; ticketNumber: number | string; ticketTitle: string }
  | { key: "ticket_assigned_to_group"; actorName: string; ticketNumber: number | string; groupName: string; ticketTitle: string }
  | { key: "ticket_assigned_to_you"; ticketNumber: number | string; ticketTitle: string }
  | { key: "recurring_ticket_assigned"; ticketNumber: number | string; ticketTitle: string }
  | { key: "ticket_created_from_email"; senderName: string; ticketTitle: string; ticketNumber: number | string }
  | { key: "ticket_commented"; actorName: string; ticketNumber: number | string; ticketTitle: string }
  | { key: "ticket_email_reply"; actorName: string; ticketNumber: number | string; ticketTitle: string }
  | { key: "ticket_mentioned"; actorName: string; ticketNumber: number | string; ticketTitle: string }
  | { key: "group_mentioned"; actorName: string; groupName: string; ticketNumber: number | string; ticketTitle: string }
  | { key: "ticket_status_changed"; actorName: string; ticketNumber: number | string; status: string; statusLabels?: { it?: string | null; en?: string | null }; ticketTitle: string }
  | { key: "ticket_priority_changed"; actorName: string; ticketNumber: number | string; priority: string; ticketTitle: string }
  | { key: "ticket_due"; ticketNumber: number | string; ticketTitle: string }
  | { key: "time_session_corrected"; ticketNumber: number | string; ticketTitle: string }
  | { key: "daily_report_submitted"; actorName: string; location?: string }
  | { key: "workspace_member_added"; actorName: string; workspaceName: string }
  | { key: "workspace_invite_accepted"; actorName: string; workspaceName: string };

export type NotificationContent = NotificationMessage | { key: "legacy"; text: string };

const englishDefaultStatusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
  Aperto: "Open",
  "In lavorazione": "In progress",
  "In attesa": "Waiting",
  Risolto: "Resolved",
  Chiuso: "Closed",
};

function renderStatus(
  status: string,
  language: NotificationLanguage,
  statusLabels?: { it?: string | null; en?: string | null },
): string {
  const localizedLabel = statusLabels?.[language]?.trim();
  if (localizedLabel) return localizedLabel;
  const italianLabels: Record<string, string> = {
    open: "Aperto",
    in_progress: "In lavorazione",
    waiting: "In attesa",
    resolved: "Risolto",
    closed: "Chiuso",
  };
  if (language === "it") return italianLabels[status] ?? status;
  return englishDefaultStatusLabels[status] ?? englishDefaultStatusLabels[status.charAt(0).toUpperCase() + status.slice(1)] ?? status;
}

export function renderNotificationText(
  content: NotificationContent,
  language: NotificationLanguage,
): string {
  if (content.key === "legacy") {
    // Invitation messages and older/untranslated flows intentionally retain their supplied copy.
    return content.text;
  }

  const { key } = content;
  if (language === "it") {
    switch (key) {
      case "ticket_assigned":
        return `${content.actorName} ti ha assegnato il ticket #${content.ticketNumber}: "${content.ticketTitle}"`;
      case "ticket_assigned_to_group":
        return `${content.actorName} ha assegnato il ticket #${content.ticketNumber} al tuo gruppo "${content.groupName}": "${content.ticketTitle}"`;
      case "ticket_assigned_to_you":
        return `Ti è stato assegnato il ticket #${content.ticketNumber}: "${content.ticketTitle}"`;
      case "recurring_ticket_assigned":
        return `Nuova pratica ricorrente #${content.ticketNumber}: "${content.ticketTitle}"`;
      case "ticket_created_from_email":
        return `Nuova richiesta via email da ${content.senderName}: "${content.ticketTitle}" (ticket #${content.ticketNumber})`;
      case "ticket_commented":
        return `${content.actorName} ha commentato il ticket #${content.ticketNumber}: "${content.ticketTitle}"`;
      case "ticket_email_reply":
        return `${content.actorName} ha risposto via email al ticket #${content.ticketNumber}: "${content.ticketTitle}"`;
      case "ticket_mentioned":
        return `${content.actorName} ti ha menzionato nel ticket #${content.ticketNumber}: "${content.ticketTitle}"`;
      case "group_mentioned":
        return `${content.actorName} ha menzionato il gruppo "${content.groupName}" nel ticket #${content.ticketNumber}: "${content.ticketTitle}"`;
      case "ticket_status_changed":
        return `${content.actorName} ha cambiato lo stato del ticket #${content.ticketNumber} in "${renderStatus(content.status, language, content.statusLabels)}": "${content.ticketTitle}"`;
      case "ticket_priority_changed": {
        const labels: Record<string, string> = { low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" };
        return `${content.actorName} ha cambiato la priorità del ticket #${content.ticketNumber} in "${labels[content.priority] ?? content.priority}": "${content.ticketTitle}"`;
      }
      case "ticket_due":
        return `Il ticket #${content.ticketNumber} "${content.ticketTitle}" è scaduto e non è ancora stato risolto.`;
      case "time_session_corrected":
        return `L'amministratore ha aggiornato le tue ore registrate sul ticket #${content.ticketNumber}: "${content.ticketTitle}".`;
      case "daily_report_submitted":
        return `${content.actorName} ha pubblicato il report di oggi${content.location ? ` — Sede: ${content.location}` : ""}`;
      case "workspace_member_added":
        return `${content.actorName} ti ha aggiunto allo spazio condiviso ${content.workspaceName}.`;
      case "workspace_invite_accepted":
        return `${content.actorName} ha accettato l'invito allo spazio condiviso ${content.workspaceName}.`;
    }
  }

  switch (key) {
    case "ticket_assigned":
      return `${content.actorName} assigned you ticket #${content.ticketNumber}: "${content.ticketTitle}"`;
    case "ticket_assigned_to_group":
      return `${content.actorName} assigned ticket #${content.ticketNumber} to your group "${content.groupName}": "${content.ticketTitle}"`;
    case "ticket_assigned_to_you":
      return `Ticket #${content.ticketNumber} has been assigned to you: "${content.ticketTitle}"`;
    case "recurring_ticket_assigned":
      return `New recurring ticket #${content.ticketNumber}: "${content.ticketTitle}"`;
    case "ticket_created_from_email":
      return `New request via email from ${content.senderName}: "${content.ticketTitle}" (ticket #${content.ticketNumber})`;
    case "ticket_commented":
      return `${content.actorName} commented on ticket #${content.ticketNumber}: "${content.ticketTitle}"`;
    case "ticket_email_reply":
      return `${content.actorName} replied by email to ticket #${content.ticketNumber}: "${content.ticketTitle}"`;
    case "ticket_mentioned":
      return `${content.actorName} mentioned you in ticket #${content.ticketNumber}: "${content.ticketTitle}"`;
    case "group_mentioned":
      return `${content.actorName} mentioned the group "${content.groupName}" in ticket #${content.ticketNumber}: "${content.ticketTitle}"`;
    case "ticket_status_changed":
      return `${content.actorName} changed the status of ticket #${content.ticketNumber} to "${renderStatus(content.status, language, content.statusLabels)}": "${content.ticketTitle}"`;
    case "ticket_priority_changed": {
      const labels: Record<string, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
      return `${content.actorName} changed the priority of ticket #${content.ticketNumber} to "${labels[content.priority] ?? content.priority}": "${content.ticketTitle}"`;
    }
    case "ticket_due":
      return `Ticket #${content.ticketNumber} "${content.ticketTitle}" is overdue and has not been resolved.`;
    case "time_session_corrected":
      return `The administrator updated your recorded hours on ticket #${content.ticketNumber}: "${content.ticketTitle}".`;
    case "daily_report_submitted":
      return `${content.actorName} submitted today's report${content.location ? ` — Location: ${content.location}` : ""}`;
    case "workspace_member_added":
      return `${content.actorName} added you to the shared workspace ${content.workspaceName}.`;
    case "workspace_invite_accepted":
      return `${content.actorName} accepted the invitation to the shared workspace ${content.workspaceName}.`;
  }
}

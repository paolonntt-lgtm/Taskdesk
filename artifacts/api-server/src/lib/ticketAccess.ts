import { and, eq, isNull } from "drizzle-orm";
import { db, ticketsTable } from "@workspace/db";

export async function getTicketForUser(ticketId: number, orgId: number | null, isAdmin: boolean) {
  const [ticket] = await db
    .select({ id: ticketsTable.id, organizationId: ticketsTable.organizationId, visibility: ticketsTable.visibility })
    .from(ticketsTable)
    .where(
      and(
        eq(ticketsTable.id, ticketId),
        isNull(ticketsTable.deletedAt),
        orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined
      )
    );
  if (!ticket || (!isAdmin && ticket.visibility === "admins")) return null;
  return ticket;
}

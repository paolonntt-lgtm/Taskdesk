import { eq } from "drizzle-orm";
import { db, organizationsTable } from "@workspace/db";

export async function isClientFeatureEnabled(organizationId: number | null | undefined): Promise<boolean> {
  if (organizationId == null) return false;

  const [organization] = await db
    .select({ clientsEnabled: organizationsTable.clientsEnabled })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, organizationId))
    .limit(1);

  return organization?.clientsEnabled ?? false;
}

export function redactClientData<T extends object>(value: T, clientsEnabled: boolean): T {
  if (clientsEnabled) return value;

  const { clientId: _clientId, client: _client, ...ticketWithoutClientData } = value as T & {
    clientId?: unknown;
    client?: unknown;
  };
  return ticketWithoutClientData as T;
}

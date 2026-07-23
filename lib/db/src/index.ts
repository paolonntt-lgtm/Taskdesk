import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function toPoolerUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes(".neon.tech") && parsed.hostname.startsWith("ep-") && !parsed.hostname.includes("-pooler")) {
      const parts = parsed.hostname.split(".");
      parts[0] = parts[0] + "-pooler";
      parsed.hostname = parts.join(".");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export const pool = new Pool({
  connectionString: toPoolerUrl(process.env.DATABASE_URL),
  max: 5,
  idleTimeoutMillis: 20000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
export * from "./lib/defaultStatuses";

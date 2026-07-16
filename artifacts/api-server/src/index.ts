import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty, backfillOrgTicketStatuses } from "./lib/seed";
import { runAppMigrations } from "./lib/migrate";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { scheduleNightlyBackups } from "./routes/backup";
import { startUploadCleanupJob } from "./lib/uploadCleanup";
import { startTicketDueNotifier } from "./lib/ticketDueNotifier";
import { startAppointmentReminderJob } from "./lib/appointmentReminderJob";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }
  try {
    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    logger.info("Stripe webhook configured");

    stripeSync
      .syncBackfill()
      .then(() => logger.info("Stripe data synced"))
      .catch((err: Error) => logger.error({ err }, "Stripe backfill error"));
  } catch (error) {
    logger.error(
      { err: error },
      "Stripe initialization failed — payments will not work until Stripe is connected"
    );
  }
}

seedIfEmpty()
  .then(() => runAppMigrations())
  .then(() => backfillOrgTicketStatuses())
  .then(() => startAppointmentReminderJob())
  .catch((err) => logger.error({ err }, "Seed/migration failed"));
initStripe().catch((err) => logger.error({ err }, "initStripe failed"));
scheduleNightlyBackups();
startUploadCleanupJob();
startTicketDueNotifier();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

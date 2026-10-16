import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db, appointmentsTable, usersTable } from "@workspace/db";
import { sendEmailForOrg, buildAppointmentReminderEmail } from "./email";
import { appBaseUrl } from "./appUrl";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Grace window: reminders are still sent up to GRACE_MS after the appointment starts,
 * covering cases where the job run was delayed or the reminder_minutes is 0.
 */
const GRACE_MS = 60 * 60 * 1000;

async function checkAppointmentReminders(): Promise<void> {
  try {
    const now = new Date();
    const graceCutoff = new Date(now.getTime() - GRACE_MS);

    /**
     * Select appointments that:
     *  - have no reminder sent yet
     *  - haven't started so long ago that sending would be pointless (within grace window)
     *  - reminder time has already passed: starts_at - reminder_minutes*60s <= now
     */
    const due = await db
      .select({
        id: appointmentsTable.id,
        organizationId: appointmentsTable.organizationId,
        createdBy: appointmentsTable.createdBy,
        assignedTo: appointmentsTable.assignedTo,
        title: appointmentsTable.title,
        description: appointmentsTable.description,
        startsAt: appointmentsTable.startsAt,
        reminderMinutes: appointmentsTable.reminderMinutes,
        reminderSentAt: appointmentsTable.reminderSentAt,
      })
      .from(appointmentsTable)
      .where(
        and(
          isNull(appointmentsTable.reminderSentAt),
          eq(appointmentsTable.isAllDay, false),
          gt(appointmentsTable.startsAt, graceCutoff),
          sql`${appointmentsTable.startsAt} - (${appointmentsTable.reminderMinutes} * interval '1 minute') <= ${now}`
        )
      );

    if (due.length === 0) return;

    const userIds = new Set<number>();
    for (const appt of due) {
      userIds.add(appt.createdBy);
      if (appt.assignedTo) userIds.add(appt.assignedTo);
    }

    const users =
      userIds.size > 0
        ? await db
            .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
            .from(usersTable)
            .where(inArray(usersTable.id, [...userIds]))
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));
    const baseUrl = appBaseUrl();

    for (const appt of due) {
      const recipientIds = new Set<number>([appt.createdBy]);
      if (appt.assignedTo) recipientIds.add(appt.assignedTo);

      let anySent = false;

      for (const userId of recipientIds) {
        const user = userMap.get(userId);
        if (!user?.email) continue;

        const { subject, html, text } = buildAppointmentReminderEmail({
          recipientName: user.name,
          title: appt.title,
          description: appt.description,
          startsAt: appt.startsAt,
          reminderMinutes: appt.reminderMinutes,
          appBaseUrl: baseUrl,
        });

        const result = await sendEmailForOrg(appt.organizationId, { to: user.email, subject, html, text });
        if (!result.ok) {
          logger.warn(
            { appointmentId: appt.id, userId, error: result.error },
            "appointmentReminderJob: email send failed"
          );
        } else {
          anySent = true;
          logger.info(
            { appointmentId: appt.id, userId },
            "appointmentReminderJob: reminder sent"
          );
        }
      }

      if (anySent) {
        await db
          .update(appointmentsTable)
          .set({ reminderSentAt: new Date() })
          .where(eq(appointmentsTable.id, appt.id));
      } else {
        logger.warn(
          { appointmentId: appt.id },
          "appointmentReminderJob: no emails sent for appointment — will retry next cycle"
        );
      }
    }
  } catch (err) {
    logger.warn({ err }, "appointmentReminderJob: check failed");
  }
}

export function startAppointmentReminderJob(): void {
  void checkAppointmentReminders();
  const interval = setInterval(() => {
    void checkAppointmentReminders();
  }, CHECK_INTERVAL_MS);
  interval.unref();
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "appointmentReminderJob: started");
}
